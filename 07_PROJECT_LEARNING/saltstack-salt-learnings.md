# Forensic Learning Record (Deep Inspection): saltstack/salt

> **Canonical Artifact**: `07_PROJECT_LEARNING/saltstack-salt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/saltstack/salt](https://github.com/saltstack/salt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:23:25.485Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `saltstack/salt`
- **Description**: Software to automate the management and configuration of infrastructure and applications at scale.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml
- **Stars / Engagement**: 15685 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cicd/windows-ssl-104135-patch.py`
```
"""
Patch the salt onedir Python's ``Lib/ssl.py`` in place to apply
cpython#104135's iterate-and-skip variant of
``ssl.SSLContext._load_windows_store_certs``.

Usage: ``python windows-ssl-104135-patch.py <path-to-ssl.py>``

Background
----------

The build-deps-ci Windows job extracts the salt onedir, then runs
``nox --install-only -e ci-test-onedir`` and ``nox -e pre-archive-cleanup``.
Both sessions target the onedir's relenv-bundled Python (3.10.21 on 3006.x)
and create virtualenvs from it. The ``ci-test-onedir`` session uses
``--system-site-packages``; ``pre-archive-cleanup`` does not. Either way,
both venvs share the onedir's ``Lib/ssl.py`` because virtualenv leaves the
base Python's stdlib on ``sys.path``.

Python 3.10's stdlib ``ssl._load_windows_store_certs`` concatenates every
cert from the Windows root store and feeds them to
``load_verify_locations(cadata=...)`` as one blob. OpenSSL 3.5.x (shipped by
relenv >= 0.22.13) rejects the whole blob on a single ASN.1-malformed cert,
so pip's TLS to pypi.org dies with ``[ASN1: NOT_ENOUGH_DATA]`` before any
deps land. See cpython#104135.

Appending the patch to ``Lib/ssl.py`` means every Python invocation using
the onedir picks up the fix - the ``ci-test-onedir`` venv, the
``pre-archive-cleanup`` venv, the raw onedir python itself, anything.

A ``sitecustomize.py`` would only reach the venv that turns on
``--system-site-packages``; a ``Lib/ssl.py`` append covers both.

Self-disables on Python 3.12+ (whose stdlib already has the upstream
iterate-and-skip fix; 3.10 and 3.11 never received the backport).

Durable cleanup
~~~~~~~~~~~~~~~

The right home for this patch is relenv's cpython build step - patching
``Lib/ssl.py`` once during the onedir build means every consumer
(production salt installs, plus our CI) gets the fix without any
salt-side workarounds. Once a relenv release carrying that patch lands
in this branch's onedir, drop this file together with the trio it pairs
with:

  - ``salt/__init__.py`` ``_load_windows_store_certs`` monkey-patch
  - ``salt/ext/tornado/netutil.py`` Windows ``certifi.where()`` pin
  - the ``Patch cpython#104135 in onedir Lib/ssl.py`` workflow steps in
    ``.github/workflows/{build-deps-ci,test,test-packages}-action.yml``

Until then, also drop the lot on any branch whose onedir Python is >=
3.12.
"""

import sys

MARKER = "# >>> cpython#104135 patch (windows-ssl-104135-patch.py) <<<"

PATCH_BODY = f"""

{MARKER}
# Replace the pre-fix _load_windows_store_certs with the iterate-and-skip
# variant cpython merged for the 3.12 branch. See cpython#104135.
# Self-disable on Python 3.12+ (where Lib/ssl.py already has the upstream
# fix; 3.10 and 3.11 never received the backport) and on non-Windows.
import sys as _patch_sys

if _patch_sys.platform == "win32" and _patch_sys.version_info < (3, 12):

    def _salt_safe_load_windows_store_certs(
        self, storename, purpose, _SSLError=SSLError
    ):
        try:
            from _ssl import enum_certificates
        except ImportError:
            return
        try:
            for cert, encoding, trust in enum_certificates(storename):
                if encoding != "x509_asn":
                    continue
                if trust is True or purpose.oid in trust:
                    try:
                        self.load_verify_locations(cadata=cert)
                    except _SSLError:
                        pass
        except PermissionError:
            pass

    SSLContext._load_windows_store_certs = _salt_safe_load_windows_store_certs
"""


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print(
            f"usage: {argv[0]} <path-to-ssl.py>",
            file=sys.stderr,
        )
        return 2
    path = argv[1]
    with open(path, encoding="utf-8") as fh:
        contents = fh.read()
    if MARKER in contents:
        print(f"{path}: already patched, leaving alone")
        return 0
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(PATCH_BODY)
    print(f"{path}: appended cpython#104135 work-around")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

```

### Core Architecture Module: `doc/_ext/saltautodoc.py`
```
"""
    :codeauthor: Pedro Algarvio (pedro@algarvio.me)


    saltautodoc.py
    ~~~~~~~~~~~~~~

    Properly handle ``__func_alias__``
"""

from sphinx.ext.autodoc import FunctionDocumenter


class SaltFunctionDocumenter(FunctionDocumenter):
    """
    Simple override of sphinx.ext.autodoc.FunctionDocumenter to properly render
    salt's aliased function names.
    """

    def format_name(self):
        """
        Format the function name
        """
        if not hasattr(self.module, "__func_alias__"):
            # Resume normal sphinx.ext.autodoc operation
            return super(FunctionDocumenter, self).format_name()

        if not self.objpath:
            # Resume normal sphinx.ext.autodoc operation
            return super(FunctionDocumenter, self).format_name()

        if len(self.objpath) > 1:
            # Resume normal sphinx.ext.autodoc operation
            return super(FunctionDocumenter, self).format_name()

        # Use the salt func aliased name instead of the real name
        return self.module.__func_alias__.get(self.objpath[0], self.objpath[0])


def setup(app):
    def add_documenter(app, env, docnames):
        app.add_autodocumenter(SaltFunctionDocumenter)

    # add_autodocumenter() must be called after the initial setup and the
    # 'builder-inited' event, as sphinx.ext.autosummary will restore the
    # original documenter on 'builder-inited'
    app.connect("env-before-read-docs", add_documenter)

```

### Core Architecture Module: `doc/_ext/saltdomain.py`
```
import itertools
import os
import re

from docutils import nodes
from docutils.parsers.rst import Directive
from docutils.statemachine import ViewList
from sphinx import addnodes
from sphinx.domains import ObjType
from sphinx.domains import python as python_domain
from sphinx.domains.python import PyObject
from sphinx.locale import _
from sphinx.roles import XRefRole
from sphinx.util.nodes import make_refnode, nested_parse_with_titles, set_source_info

import salt


class Event(PyObject):
    """
    Document Salt events
    """

    domain = "salt"


class LiterateCoding(Directive):
    """
    Auto-doc SLS files using literate-style comment/code separation
    """

    has_content = False
    required_arguments = 1
    optional_arguments = 0
    final_argument_whitespace = False

    def parse_file(self, fpath):
        """
        Read a file on the file system (relative to salt's base project dir)

        :returns: A file-like object.
        :raises IOError: If the file cannot be found or read.
        """
        sdir = os.path.abspath(os.path.join(os.path.dirname(salt.__file__), os.pardir))
        with open(os.path.join(sdir, fpath), "rb") as f:
            return f.readlines()

    def parse_lit(self, lines):
        """
        Parse a string line-by-line delineating comments and code

        :returns: An tuple of boolean/list-of-string pairs. True designates a
            comment; False designates code.
        """
        comment_char = "#"  # TODO: move this into a directive option
        comment = re.compile(rf"^\s*{comment_char}[ \n]")
        section_test = lambda val: bool(comment.match(val))

        sections = []
        for is_doc, group in itertools.groupby(lines, section_test):
            if is_doc:
                text = [comment.sub("", i).rstrip("\r\n") for i in group]
            else:
                text = [i.rstrip("\r\n") for i in group]

            sections.append((is_doc, text))

        return sections

    def run(self):
        try:
            lines = self.parse_lit(self.parse_file(self.arguments[0]))
        except OSError as exc:
            document = self.state.document
            return [document.reporter.warning(str(exc), line=self.lineno)]

        node = nodes.container()
        node["classes"] = ["lit-container"]
        node.document = self.state.document

        enum = nodes.enumerated_list()
        enum["classes"] = ["lit-docs"]
        node.append(enum)

        # make first list item
        list_item = nodes.list_item()
        list_item["classes"] = ["lit-item"]

        for is_doc, line in lines:
            if is_doc and line == [""]:
                continue

            section = nodes.section()

            if is_doc:
                section["classes"] = ["lit-annotation"]

                nested_parse_with_titles(self.state, ViewList(line), section)
            else:
                section["classes"] = ["lit-content"]

                code = "\n".join(line)
                literal = nodes.literal_block(code, code)
                literal["language"] = "yaml"
                set_source_info(self, literal)
                section.append(literal)

            list_item.append(section)

            # If we have a pair of annotation/content items, append the list
            # item and create a new list item
            if len(list_item.children) == 2:
                enum.append(list_item)
                list_item = nodes.list_item()
                list_item["classes"] = ["lit-item"]

        # Non-semantic div for styling
        bg = nodes.container()
        bg["classes"] = ["lit-background"]
        node.append(bg)

        return [node]


class LiterateFormula(LiterateCoding):
    """
    Customizations to handle finding and parsing SLS files
    """

    def parse_file(self, sls_path):
        """
        Given a typical Salt SLS path (e.g.: apache.vhosts.standard), find the
        file on the file system and parse it
        """
        config = self.state.document.settings.env.config
        formulas_dirs = config.formulas_dirs
        fpath = sls_path.replace(".", "/")

        name_options = (f"{fpath}.sls", os.path.join(fpath, "init.sls"))

        paths = [
            os.path.join(fdir, fname)
            for fname in name_options
            for fdir in formulas_dirs
        ]

        for i in paths:
            try:
                with open(i, "rb") as f:
                    return f.readlines()
            except OSError:
                pass

        raise OSError(f"Could not find sls file '{sls_path}'")


class CurrentFormula(Directive):
    domain = "salt"
    has_content = False
    required_arguments = 1
    optional_arguments = 0
    final_argument_whitespace = False
    option_spec = {}

    def run(self):
        env = self.state.document.settings.env
        modname = self.arguments[0].strip()
        if modname == "None":
            env.temp_data["salt:formula"] = None
        else:
            env.temp_data["salt:formula"] = modname
        return []


class Formula(Directive):
    domain = "salt"
    has_content = True
    required_arguments = 1

    def run(self):
        env = self.state.document.settings.env
        formname = self.arguments[0].strip()

        env.temp_data["salt:formula"] = formname

        if "noindex" in self.options:
            return []

        env.domaindata["salt"]["formulas"][formname] = (
            env.docname,
            self.options.get("synopsis", ""),
            self.options.get("platform", ""),
            "deprecated" in self.options,
        )

        targetnode = nodes.target("", "", ids=["module-" + formname], ismod=True)
        self.state.document.note_explicit_target(targetnode)

        indextext = f"{formname}-formula)"
        inode = addnodes.index(
            entries=[("single", indextext, "module-" + formname, "")]
        )

        return [targetnode, inode]


class State(Directive):
    domain = "salt"
    has_content = True
    required_arguments = 1

    def run(self):
        env = self.state.document.settings.env
        statename = self.arguments[0].strip()

        if "noindex" in self.options:
            return []

        targetnode = nodes.target("", "", ids=["module-" + statename], ismod=True)
        self.state.document.note_explicit_target(targetnode)

        formula = env.temp_data.get("salt:formula")

        indextext = f"{statename} ({formula}-formula)"
        inode = addnodes.index(
            entries=[("single", indextext, f"module-{statename}", "")]
        )

        return [targetnode, inode]


class SLSXRefRole(XRefRole):
    pass


class SaltModuleIndex(python_domain.PythonModuleIndex):
    name = "modindex"
    localname = _("Salt Module Index")
    shortname = _("all salt modules")


class SaltDomain(python_domain.PythonDomain):
    name = "salt"
    label = "Salt"
    data_version = 2

    object_types = python_domain.PythonDomain.object_types
    object_types.update({"state": ObjType(_("state"), "state")})

    directives = python_domain.PythonDomain.directives
    directives.update(
        {
            "event": Event,
            "state": State,
            "formula": LiterateFormula,
            "currentformula": CurrentFormula,
            "saltconfig": LiterateCoding,
        }
    )

    roles = python_domain.PythonDomain.roles
    roles.update({"formula": SLSXRefRole()})

    initial_data = python_domain.PythonDomain.initial_data
    initial_data.update({"formulas": {}})

    indices = [
        SaltModuleIndex,
    ]

    def resolve_xref(self, env, fromdocname, builder, type, target, node, contnode):
        if type == "formula" and target in self.data["formulas"]:
            doc, _, _, _ = self.data["formulas"].get(target, (None, None))
            if doc:
                return make_refnode(builder, fromdocname, doc, target, contnode, target)
        else:
            super().resolve_xref(
                env, fromdocname, builder, type, target, node
```

### Core Architecture Module: `doc/_ext/salthttpanchors.py`
```
"""
Keep HTML anchors on ``:noindex:``'d httpdomain directives.

sphinxcontrib-httpdomain's ``add_target_and_index`` intentionally splits its
two jobs: it always appends the ``#<method>--<path>`` anchor to the signature
node, and only gates the global route *registration* behind ``:noindex:``.
Sphinx's ``ObjectDescription.run`` however skips the whole method when
``noindex`` is set, so the anchor (and its permalink) is lost along with the
index entry. Anchors are per-page HTML ids and cannot collide across pages,
so restoring them is safe; only the global registration can produce the
parallel-build duplicate-route warnings.

Hide the option from Sphinx's outer gate and re-present it to httpdomain's
inner gate, so ``:noindex:`` means what httpdomain meant it to mean: no index
entry, anchor kept.
"""

from sphinxcontrib.httpdomain import HTTPDomain


def _make_anchored(cls):
    class AnchoredHTTPResource(cls):
        def run(self):
            self._salt_noindex = "noindex" in self.options
            self.options.pop("noindex", None)
            return super().run()

        def add_target_and_index(self, name_cls, sig, signode):
            if self._salt_noindex:
                self.options["noindex"] = None
            try:
                super().add_target_and_index(name_cls, sig, signode)
            finally:
                if self._salt_noindex:
                    self.options.pop("noindex", None)

    AnchoredHTTPResource.__name__ = f"Anchored{cls.__name__}"
    return AnchoredHTTPResource


def setup(app):
    app.setup_extension("sphinxcontrib.httpdomain")
    for name, cls in list(HTTPDomain.directives.items()):
        app.add_directive_to_domain("http", name, _make_anchored(cls), override=True)
    return {"parallel_read_safe": True, "parallel_write_safe": True}

```

### Core Architecture Module: `doc/_ext/saltrepo.py`
```
"""
    saltrepo
    ~~~~~~~~

    SaltStack Repository Sphinx directives
"""


def source_read_handler(app, docname, source):
    if "|repo_primary_branch|" in source[0]:
        source[0] = source[0].replace(
            "|repo_primary_branch|", app.config.html_context["repo_primary_branch"]
        )


def setup(app):
    app.connect("source-read", source_read_handler)

    return {
        "version": "builtin",
        "parallel_read_safe": True,
        "parallel_write_safe": True,
    }

```

### Core Architecture Module: `doc/_ext/vaultpolicylexer.py`
```
from pygments.lexer import bygroups, inherit
from pygments.lexers.configs import TerraformLexer
from pygments.token import Keyword, Name, Punctuation, Whitespace


class VaultPolicyLexer(TerraformLexer):
    aliases = ["vaultpolicy"]
    filenames = ["*.hcl"]
    mimetypes = ["application/x-hcl-policy"]

    tokens = {
        "basic": [
            inherit,
            (
                r"(path)(\s+)(\".*\")(\s+)(\{)",
                bygroups(
                    Keyword.Reserved, Whitespace, Name.Variable, Whitespace, Punctuation
                ),
            ),
        ],
    }


def setup(app):
    app.add_lexer("vaultpolicy", VaultPolicyLexer)
    return {"parallel_read_safe": True}

```

### Core Architecture Module: `doc/_themes/saltstack/static/js/main.js`
```


```

### Core Architecture Module: `doc/_themes/saltstack2/static/js/webhelp.min_v1.4.4.js`
```
/*custom webhelp*/
var windowheight = $( window ).height();
var windowwidth = $( window ).width();

$( document ).ready(function() {

    /*adjust dev branch notification*/
    if ($( '#dev-notification' ).length ) {
        $( '#dev-notification', '.dev-notification-text' ).width($( '.navbar-header' ).width());
        $( '.navbar-header' ).css("padding-top", $( '#dev-notification' ).height() + 10);
    }

    /*insert links to module functions*/
    if ($( 'a.current' ).length && $( 'dt .headerlink' ).length ) {
        if (window.location.href.indexOf('/ref/cli/') == -1) {
            var tgt = $( 'a.current' );
            tgt.after('<ul id="function-list"></ul>');
            $('dt .headerlink').each(function(idx, elem) {
                var i = [
                '<li><a class="function-nav-link" href="', elem.href, '">',
                last(elem.href.split('.')),
                '</a></li>']
                .join('');
                $( '#function-list' ).append(i);
            });
        }
    }

    /*scroll the right-hand navigation*/
    //var wheight = $( window ).height() - $( '#sidebar-static' ).height() - $( '#sidebar-static-bottom' ).height();
    var wheight = $( window ).height() - 160;
    $(function(){
        $( '#sidebar-nav' ).slimScroll({
            width: 'inherit',
            size: '14px',
            height: wheight
        }).promise().done(function() {

            if (window.location.hash) {
                var hash = window.location.hash.substring(1);
                var $link = $( '#sidebar-nav').find('a[href$="#' + hash + '"]').addClass("selected");
                if ($link.length) {
                    var scrollTo_val = $link.offset().top - ($( '#sidebar-static' ).height() + 200) + 'px';
                    $( '#sidebar-nav' ).slimScroll({ scrollTo : scrollTo_val });
                }
                else if ($( 'a.current' ).length) {
                    var scrollTo_val = $( 'a.current' ).offset().top - ($( '#sidebar-static' ).height() + 200) + 'px';
                    $( '#sidebar-nav' ).slimScroll({ scrollTo : scrollTo_val });
                }
            }
            else if ($( 'a.current' ).length) {
                var scrollTo_val = $( 'a.current' ).offset().top - ($( '#sidebar-static' ).height() + 200) + 'px';
                $( '#sidebar-nav' ).slimScroll({ scrollTo : scrollTo_val });
            }
            /*hidden by css - make visible after slimScroll plug-in loads*/
            $( '#sidebar-wrapper').css('visibility','visible');
        });
    });

    /*permalink display*/
    $( 'a.headerlink').html( '<span class="permalink"><i  data-container="body" data-toggle="tooltip" data-placement="bottom" title="Link to this location" class="glyphicon glyphicon-link"></i></span>');

    $( 'h1,h2,h3,h4,h5,h6').mouseenter(function(){
       $(this).find( '.permalink' ).find( 'i' ).css({'color':'#000'});
    }).mouseleave(function(){
        $(this).find( '.permalink' ).find( 'i' ).css({'color':'#fff'});
    });

    /*smooth on-page scrolling for long topic*/
    $( '#sidebar-nav' ).on('click','a[href^="#"]',function (e) {
        e.preventDefault();
        $( '#sidebar-nav' ).find( 'a' ).removeClass('selected');
        $(this).addClass('selected');
        var target = this.hash;
        var $target = $(target);

        $('html, body').stop().animate({
            'scrollTop': $target.offset().top + 200
        }, 900, 'swing', function () {
            window.location.hash = target;
        });
    });

    /*scroll to active topic*/
    $( '#sidebar-nav' ).on('click','a.function-nav-link',function (e) {
        e.preventDefault();
        $( 'a.function-nav-link' ).removeClass('selected');
        $(this).addClass('selected');
        var target = this.hash.substring(1);
        var $target = $('dt[id="' + target + '"]');

        $('html, body').stop().animate({
            'scrollTop': $target.offset().top + 200
        }, 900, 'swing', function () {
            window.location.hash = target;
        });
    });

    /*search form*/
    $( '#search-form' ).find( 'input' ).keypress(function(e) {
        if(e.which == 13) {
            var cx = '004624818632696854117:yfmprrbw3pk&q=';
            'find which search instance to use'
            if (DOCUMENTATION_OPTIONS.SEARCH_CX) {
                cx = DOCUMENTATION_OPTIONS.SEARCH_CX;
            }
            var searchterm = encodeURIComponent($(this).val());
            $(this).val("");
            window.location.href = 'https://www.google.com/cse?cx=' + cx + '&q=' + searchterm;
        }
    });

    /*menu collapse*/
    $( '#menu-toggle' ).click(function(e) {
        e.preventDefault();
        $( '#wrapper' ).toggleClass( 'toggled' );
    });

    /*version page selector*/
    $( 'div.releaselinks' ).on('click', 'a', function (e) {
        e.preventDefault();
        var clickedVer = $(this).attr("href");
        var $currentVer = $( 'div.versions' ).find( 'a.active' ).first();
        if (window.location.href.indexOf(clickedVer) == -1) {
            window.location.href = window.location.href.replace($currentVer.attr("href"), clickedVer);
        }
        else {
            if ($currentVer.text().indexOf(DOCUMENTATION_OPTIONS.REPO_PRIMARY_BRANCH_TAB_NAME) == -1) {
                window.location.href = clickedVer + "topics/releases/" + $currentVer.text().trim() + ".html";
            }
            else window.location.href = clickedVer + "topics/releases/";
        }
    });

    /*lightbox around images*/
    $( 'img' ).not( '.nolightbox' ).each(function() {
        var source = $(this).attr( 'src' );
        var id = $(this).attr( 'id' );
        $(this).wrap('<a href="'+ source + '" data-lightbox="' + id + '"></a>' )
    });

    /*enable bootstrap tooltips*/
    $(function () {
        $('[data-toggle="tooltip"]').tooltip();
    });

    /*notification box*/
    var box;
    $("#notifications").on('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $.get('//docs.saltproject.io/en/announcements.html?id=1', function (data) {
            box = bootbox.dialog({
                title: "Announcements",
                message: data
            });
        _gaq.push(['_trackEvent', 'docs', 'announcement-view']);
        });
    });
    $(document).on('click', '.bootbox', function (event) {
        box.modal('hide');
    });

    getMetaStatus();
}); // $.document.ready

//refresh on window resize
var rtime = new Date(1, 1, 2000, 12,00,00);
var timeout = false;
var delta = 200;
$(window).resize(function() {

    if (!$( '#menu-toggle' ).is(":visible")) {
        rtime = new Date();
        if (timeout === false) {
            timeout = true;
            setTimeout(resizeend, delta);
        }
    }
});

function resizeend() {
    if (new Date() - rtime < delta) {
        setTimeout(resizeend, delta);
    } else {
        timeout = false;
        if ($( window ).height() != windowheight && $(window).width() != windowwidth) {
            location.reload(false);
        }
    }
}

function last(list) {
    return list[list.length - 1];
}

var reviewTag = '<p><strong>Status:&nbsp;&nbsp;</strong><span class="label label-warning label-status" data-container="body" data-delay=\'{ "show": 100, "hide": 100 }\' data-toggle="tooltip" data-placement="right" title="This topic is being reviewed for technical accuracy">Technical Review</span></p>';
var draftTag = '<p><strong>Status:&nbsp;&nbsp;</strong><span class="label label-important label-status" data-container="body" data-delay=\'{ "show": 100, "hide": 100 }\' data-toggle="tooltip" data-placement="right" title="This topic is a work in progress and might describe functionality that is not yet implemented. Use with caution.">Draft Content</span></p>';

function getMetaStatus() {
   var metas = document.getElementsByTagName('meta');

   for (i=0; i<metas.length; i++) {
      if (metas[i].getAttribute("name") == "status") {
         var statusType = metas[i].getAtt
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #70300** (2026-09-30): **[Bug]: file.serialize dataset_pillar corrupts files**
  *Symptoms*: ### What happened?  On 3008.2, files created with [file.serialize](https://docs.saltproject.io/en/3008/ref/states/all/salt.states.file.html#salt.states.file.serialize) using `dataset_pillar` contain asterisks instead of actual values. Works as expected on 3006.x.  To reproduce, create a pillar dict containing string values. ``` test:   config:     foo: bar ```  Then create a test file using `file.serialize`. ``` /tmp/testconf:   file.serialize:     - dataset_pillar: test:config     - formatter: yaml ```  The test file contains `foo: '**********'` instead of `foo: 'bar'` as expected. Replacing  `dataset_pillar` with `dataset` + `pillar.get` works around the bug. ```     - dataset: {{ salt['pillar.get']('test:config') }} ```  Please fix `dataset_pillar` so that values are unmasked in files created by file.serialize. Thank you!  ### Type of salt install  Official rpm  ### Major version  3008.x  ### What supported OS are you seeing the problem on? Can select multiple. (If bug appears on an unsupported OS, please open a GitHub Discussion instead)  rhel-10  ### salt --versions-report output  ```shell Salt Version:           Salt: 3008.2   Python Version:         Python: 3.14.6 (main, Jun 11 2026, 02:19:05) [GCC 11.2.0]   Dependency Versions:           cffi: 2.0.0       cherrypy: 18.10.0   cryptography: 48.0.0       dateutil: 2.9.0.post0      docker-py: Not Installed          gitdb: 4.0.12      gitpython: 3.1.50         Jinja2: 3.1.6        libgit2: Not Installed   looseversion: 1.3
  **Post-Mortem & Fix Analysis**:
  > It looks like this issue was already reported in #69709 and should be fixed in 3008.3 by #69710.

- **Issue #70284** (2026-09-15): **[Bug]: extensions are not included with thin client**
  *Symptoms*: ### What happened?  salt-ssh does not send the `saltext-mysql` module onto targets.  I am running a Salt masterless setup. The target does not have salt installed locally. I installed the extension using `salt-pip` on my local PC, I can see it is installed in `sys.list_modules` and in `--versions-report`.  My desktop is Ubuntu 24.04 and the target 26.04.  For example: ``` $ salt-call --local sys.list_modules | grep sql     - mysql     - sqlite3 $ salt-ssh -t  example-server sys.list_modules | grep sql     - sqlite3 ```  I have tried: - Regenerating the thin client - Manually setting `thin_extra_mods: "saltext.mysql"` in  `master` and  `master.d/localuser.conf` files, however this returns a different error.  The only way extensions are working is by manually pip installing the package server-side (`pip install saltext-mysql --break-system-packages --ignore-installed`) - but according to the release notes I should not need to do this.  ### Type of salt install  Official deb  ### Major version  3008.x  ### What supported OS are you seeing the problem on? Can select multiple. (If bug appears on an unsupported OS, please open a GitHub Discussion instead)  ubuntu-24.04  ### salt --versions-report output  ```shell salt-ssh --versions-report Salt Version:           Salt: 3008.2   Python Version:         Python: 3.14.6 (main, Jun 11 2026, 02:19:05) [GCC 11.2.0]   Dependency Versions:           cffi: 2.0.0       cherrypy: 18.10.0   cryptography: 48.0.0       dateutil: 2.9.0.post0      
  **Post-Mortem & Fix Analysis**:
  > The new functionality packs installed saltexts into the thin tar, but it does not account for their dependencies. Resolving these can be hard, and some might include compiled extension modules (e.g. `cryptography`) that are platform-specific binaries and thus not guaranteed to work on the target.  Maybe the module isn't loaded because neither `pymysql` nor `mysqlclient` is importable by the Python interpreter Salt-SSH uses on the target?  You could run `tar tf <master_cachedir>/thin/thin.tgz | grep py3/saltext` to verify whether the extension is included. It needs several `py3/saltext/mysql/*` files and a `py3/saltext.mysql.dist-info/entry_points.txt` one.  If it is indeed caused by a missing dependency, it should be fixable by manually including `pymysql` (pure Python) in the `thin_extra_mods` config, assuming it is installed in the onedir. `mysqlclient` is an example for a package that includes compiled extension modules.  --- General note: I don't think we should automatically inclu
  > Thank you. The tar confirmed it and setting `thin_extra_mods: "pymysql"` has fixed the MySQL extension.  The bigger issue then is the lack of clear error messages. "module could not be loaded" is clearly too generic.  In addition, how can we identify missing dependencies?
  > Glad we found the cause.  > The bigger issue then is the lack of clear error messages.  I tried reproducing this on a 3007.14 system (i.e. without the saltext factor) and this is the output I got:  ```console $ salt-ssh minion mysql.db_exists foo minion:     ----------     _error:         The command resulted in a non-zero exit code     parsed:         None     retcode:         255     stderr:         'mysql' __virtual__ returned False: No python mysql client installed.     stdout: ```  What was yours specifically?  > In addition, how can we identify missing dependencies?  That really depends. Many Salt modules had some kind of handling for missing dependencies that should result in output similar to the above. Salt extensions don't need to expect missing dependencies anymore since they can require them during installation (Salt-SSH is an edge case here). They would crash during import instead, which can be found in the remote logs only.  `saltext-mysql` is special because it supports 

- **Issue #70233** (2026-09-09): **[Vulnerability]: OpenSSL 3.5.0 < 3.5.7 Multiple Vulnerabilities**
  *Symptoms*: ### What happened?  Vulnerable libcrypto in /opt/saltstack is being reported by the nessus scanner  PluginID: 320136  Output: Path : /var/lib/kube-node-binaries/usr/lib/libcrypto.so.3 Reported version : 3.5.5 Fixed version : 3.5.7  Solution: Upgrade to OpenSSL version 3.5.7 or later. https://openssl-library.org/news/secadv/20260609.txt https://www.cve.org/CVERecord?id=CVE-2026-34180 https://www.cve.org/CVERecord?id=CVE-2026-34181 https://www.cve.org/CVERecord?id=CVE-2026-34182 https://www.cve.org/CVERecord?id=CVE-2026-34183 https://www.cve.org/CVERecord?id=CVE-2026-42764 https://www.cve.org/CVERecord?id=CVE-2026-42766 https://www.cve.org/CVERecord?id=CVE-2026-42767 https://www.cve.org/CVERecord?id=CVE-2026-42768 https://www.cve.org/CVERecord?id=CVE-2026-42769 https://www.cve.org/CVERecord?id=CVE-2026-42770 https://www.cve.org/CVERecord?id=CVE-2026-45445 https://www.cve.org/CVERecord?id=CVE-2026-45446 https://www.cve.org/CVERecord?id=CVE-2026-45447 https://www.cve.org/CVERecord?id=CVE-2026-7383 https://www.cve.org/CVERecord?id=CVE-2026-9076 http://www.nessus.org/u?0e3bc6fb http://www.nessus.org/u?127eac4d http://www.nessus.org/u?12ed55c7 http://www.nessus.org/u?19aa882e http://www.nessus.org/u?31a039ad http://www.nessus.org/u?393a19fc http://www.nessus.org/u?4288f61d http://www.nessus.org/u?44f654e8 http://www.nessus.org/u?65c1c38c http://www.nessus.org/u?7333a3ce http://www.nessus.org/u?91eee2fe http://www.nessus.org/u?a16e7630 http://www.nessus.org/u?b124ca0e http://www.ness
  **Post-Mortem & Fix Analysis**:
  > Hi there! Welcome to the Salt Community! Thank you for making your first contribution. We have a lengthy process for issues and PRs. Someone from the Core Team will follow up as soon as possible. In the meantime, here's some information that may help as you continue your Salt journey. Please be sure to review our [Code of Conduct](https://github.com/saltstack/salt/blob/master/CODE_OF_CONDUCT.md). Also, check out some of our community resources including:    - [Salt's Contributor Guide](https://docs.saltproject.io/en/master/topics/development/contributing.html)   - [Join our Community Discord](https://discord.com/invite/J7b7EscrAs)   - [Salt Project YouTube channel](https://www.youtube.com/channel/UCpveTIucFx9ljGelW63-BWg)   - [GitHub Discussions](https://github.com/saltstack/salt/discussions)  There are lots of ways to get involved in our community. Every month, there are around a dozen opportunities to meet with other contributors and the Salt Core team and collaborate in real time. T
  > This path has nothing to do with salt's onedir packages /var/lib/kube-node-binaries/usr/lib/libcrypto.so.3

- **Issue #70232** (2026-09-09): **[Vulnerability]: OpenSSL 3.5.0 < 3.5.8 Vulnerability**
  *Symptoms*: ### What happened?  Vulnerable libcrypto in /opt/saltstack is being reported by the nessus scanner   PluginID: 335167  Output: Path : /var/lib/kube-node-binaries/usr/lib/libcrypto.so.3 Reported version : 3.5.5 Fixed version : 3.5.8  Solution: Upgrade to OpenSSL version 3.5.8 or later. https://openssl-library.org/news/secadv/20260813.txt https://www.cve.org/CVERecord?id=CVE-2026-14456 http://www.nessus.org/u?eac4598c  ### Type of salt install  Official rpm  ### Major version  3006.x  ### What supported OS are you seeing the problem on? Can select multiple. (If bug appears on an unsupported OS, please open a GitHub Discussion instead)  rhel-9  ### salt --versions-report output  ```shell Output: Path : /var/lib/kube-node-binaries/usr/lib/libcrypto.so.3 Reported version : 3.5.5 Fixed version : 3.5.8 ```
  **Post-Mortem & Fix Analysis**:
  > Hi there! Welcome to the Salt Community! Thank you for making your first contribution. We have a lengthy process for issues and PRs. Someone from the Core Team will follow up as soon as possible. In the meantime, here's some information that may help as you continue your Salt journey. Please be sure to review our [Code of Conduct](https://github.com/saltstack/salt/blob/master/CODE_OF_CONDUCT.md). Also, check out some of our community resources including:    - [Salt's Contributor Guide](https://docs.saltproject.io/en/master/topics/development/contributing.html)   - [Join our Community Discord](https://discord.com/invite/J7b7EscrAs)   - [Salt Project YouTube channel](https://www.youtube.com/channel/UCpveTIucFx9ljGelW63-BWg)   - [GitHub Discussions](https://github.com/saltstack/salt/discussions)  There are lots of ways to get involved in our community. Every month, there are around a dozen opportunities to meet with other contributors and the Salt Core team and collaborate in real time. T
  > This path  /var/lib/kube-node-binaries/usr/lib/libcrypto.so.3 has nothing to do with salt's onedir packages.

- **Issue #70169** (2026-09-15): **SyncWrapper leaks asyncio Task/Coroutine/Context per call — 18k retained over 26h on EventReturn**
  *Symptoms*: ### Description  `salt.utils.asynchronous.SyncWrapper` creates a per-wrapper `asyncio.new_event_loop()` in `__init__`, installs it on the worker thread with `asyncio.set_event_loop(self.asyncio_loop)` in `_target`, then runs the wrapped async method through **tornado's** `io_loop.run_sync`. `self.asyncio_loop` is installed as the current asyncio loop for the worker thread but never has `.run_forever()` / `.run_until_complete()` called on it during dispatch. Any coroutine on the wrapped call path that touches `asyncio.get_event_loop().create_task(...)` / `asyncio.ensure_future(...)` schedules a `Task` on that asyncio loop. Because the loop is never iterated, the `Task` never runs, never completes, is never `_finish_coro`'d, and is never garbage collected. It retains:  - the coroutine object, - the coroutine's frame (including all locals, event dicts, msgpack buffers, ...), - a fresh `contextvars.Context`.  The existing task-reap at `close()` catches this on shutdown, but wrappers that live for the lifetime of a long-running process (`EventReturn`, `BatchManager`, ...) never call `close()` in the steady state, so per-call task retention accumulates for the process lifetime.  ### Setup  3008.x HEAD. Salt master under sustained event traffic. No special configuration required; any driver process using `SyncWrapper` for its subscriber (`EventReturn`, `BatchManager`, ...) exhibits the retention.  ### Steps to Reproduce the behavior  1. Construct a `SyncWrapper` around an async clas

- **Issue #70151** (2026-09-15): **[Bug]: salt-pip does not isolate the pip subprocess's PYTHONPATH, which can cause it to uninstall unrelated system packages**
  *Symptoms*: ### What happened? ``salt-pip`` is meant to be a self-contained wrapper around the onedir's bundled pip: packages it installs go into an isolated extras-<major>.<minor> directory alongside the onedir, kept separate from the system Python (see doc/topics/packaging/index.rst). In practice, that isolation is incomplete.  ``_pip_environment()`` in ``salt/scripts.py`` builds the environment for the pip subprocess like this:  ```python def _pip_environment(env, extras):     new_env = env.copy()     if "PYTHONPATH" in env:         new_env["PYTHONPATH"] = f"{extras}{os.pathsep}{env['PYTHONPATH']}"     else:         new_env["PYTHONPATH"] = extras     return new_env ```  Rather than isolating the subprocess, it prepends salt's own ``extras`` directory onto whatever ``PYTHONPATH`` was already present in the calling process's environment. If anything invoking ``salt-pip`` — a shell session, an init/systemd unit, a packaging post-install hook, a CI job, etc. — has a ``PYTHONPATH`` set (intentionally or via leakage from unrelated tooling), that path is carried straight through into salt's supposedly isolated Python subprocess.  ### Why this is a problem  ``PYTHONPATH`` entries are visible to whichever interpreter is running, regardless of which Python installation they actually belong to — a pure-Python package sitting in an unrelated Python 3.x installation's ``site-packages`` is just as importable from salt's bundled/relenv interpreter as one installed properly inside extras.  This becom

- **Issue #70147** (2026-08-31): **PubServer.publish_payload schedules unbounded per-(subscriber × event) drain tasks under bursty load**
  *Symptoms*: @/tmp/issue_body.md

- **Issue #70090** (2026-08-31): **[Bug]: 3008.2 Migrating from a shared-filesystem cluster to isolated filesystem**
  *Symptoms*: ### What happened?  After migrating to an isolated filesystem following the instructions at https://docs.saltproject.io/en/latest/topics/tutorials/master-cluster.html#migrating-from-a-shared-filesystem-cluster , I encountered an issue where minions are unable to connect to the masters due to a key-related problem. ``` [root@salt-01 salt]# cat master.d/cluster.conf id: 10.249.207.118 cluster_id: master_cluster cluster_peers:   - 10.249.207.111 cluster_pki_dir: /etc/salt/cluster.d/pki cachedir: /etc/salt/cluster.d/cache pki_dir: /etc/salt/cluster.d/pki file_roots:   base:     - /srv/salt pillar_roots:   base:     - /srv/pillar cluster_isolated_filesystem: True keys.cache_driver: mmap_key cluster_secret: "secret" ```  ``` Aug 19 13:01:09 salt-01.infra.example.com systemd[1]: Starting salt-master.service - The Salt Master Server... Aug 19 13:01:10 salt-01.infra.example.com systemd[1]: Started salt-master.service - The Salt Master Server. Aug 19 13:01:13 salt-01.infra.example.com salt-master[2705565]: [ERROR   ] SaltPeer: failed to send cluster/raft/pre-request-vote to 10.249.207.111 Aug 19 13:01:13 salt-01.infra.example.com salt-master[2705565]: Traceback (most recent call last): Aug 19 13:01:13 salt-01.infra.example.com salt-master[2705565]:   File "/usr/lib/python3.11/site-packages/salt/cluster/consensus/peer.py", line 155, in _send Aug 19 13:01:13 salt-01.infra.example.com salt-master[2705565]:     await _publish(self._pusher, raw) Aug 19 13:01:13 salt-01.infra.example.com sal
  **Post-Mortem & Fix Analysis**:
  > the same problem occures when i deploy fresh salt-master cluster with isolated fs.  Minion -> Haproxy -> Salt cluster Minion gets error: ``` [root@test-salt-01 salt]# salt-call pillar.items [ERROR   ] The master key has changed, the salt master could have been subverted, verify salt master's public key [CRITICAL] The Salt Master server's public key did not authenticate! The master may need to be updated if it is a version of Salt lower than 3008.2, or If you are confident that you are connecting to a valid Salt Master, then remove the master public key and restart the Salt Minion. The master public key can be found at: /etc/salt/pki/minion/minion_master.pub [ERROR   ] Exception getting pillar: Traceback (most recent call last):   File "/usr/lib/python3.11/site-packages/salt/utils/asynchronous.py", line 243, in wrap     asyncio.get_running_loop() RuntimeError: no running event loop  During handling of the above exception, another exception occurred:  Traceback (most recent call last):  

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `f37cdcd1` (2026-09-18)
**Commit Message**: Merge pull request #70302 from dwoz/fix/publish-nightly-download-continue-on-error

publish-nightly-release: continue-on-error on primary download-artifact

**File**: `.github/workflows/publish-nightly-release.yml` (modified, +12/-1)
```diff
@@ -141,7 +141,18 @@ jobs:
 
       - name: download all artifacts from the triggering nightly.yml run
         if: steps.check.outputs.already-exists != 'true' && steps.test-branch-check.outputs.skip != 'true'
-
+        # continue-on-error is intentional: on runs with hundreds of
+        # artifacts (~800+ on 3008.x), download-artifact@v4 sometimes
+        # trips GitHub's secondary rate limit and fails the entire step
+        # with HTTP 403. Concrete instance: publish 35303319228 on
+        # 2026-09-18 tried to fetch 800 artifacts for v3008.2+599 and
+        # got "You have exceeded a secondary rate limit" mid-download,
+        # aborting the publish. The backfill step below is more resilient
+        # (per-artifact `gh api /zip` requests, naturally paced) and can
+        # complete the download by itself. Marking this step
+        # continue-on-error means a rate-limit trip is a slowdown, not a
+        # failed publish.
+        continue-on-error: true
         uses: actions/download-artifact@v4
         with:
           run-id: ${{ github.event.workflow_run.id }}
```

---

### Incident Patch 2: `3a42673c` (2026-09-15)
**Commit Message**: Merge pull request #70286 from dwoz/dwoz/master-version-fixes

version: anchor master version on next_release codename

**File**: `salt/version.py` (modified, +36/-8)
```diff
@@ -608,9 +608,18 @@ def __repr__(self):
 
 # ----- Hardcoded Salt Codename Version Information ----------------------------------------------------------------->
 #
-#   There's no need to do anything here. The last released codename will be picked up
+#   On master we anchor the reported version on the NEXT (unreleased) codename
+#   from SaltVersionsInfo rather than the current release. Master is always
+#   ahead of the latest release cut, so `current_release()` reports the wrong
+#   line -- e.g. today it returns Argon (3008), which makes every master build
+#   look like `3008.<N>+...` when the truth is closer to `3009.0.dev0+...`.
+#   `next_release()` returns the first codename with released=False (Potassium
+#   / 3009 today), which is what a nightly built on master should carry. This
+#   line is master-only; release branches (3008.x, 3007.x, 3006.x) should keep
+#   `current_release()` because on a release branch the "current" codename is
+#   the correct anchor.
 # --------------------------------------------------------------------------------------------------------------------
-__saltstack_version__ = SaltStackVersion.current_release()
+__saltstack_version__ = SaltStackVersion.next_release()
 # <---- Hardcoded Salt Version Information ---------------------------------------------------------------------------
 
 
@@ -645,13 +654,32 @@ def __discover_version(saltstack_version):
                 "describe",
                 "--tags",
                 "--long",
-                # Constrain to the branch's own major (3008.x) so tags
-                # from other majors reachable in the git graph do not hijack
-                # the detected version. Merged forward from 3007.x's
-                # v3007.* constraint (see git log for f3ffc8f9c9ea) and
-                # rebased to this branch's major.
+                # Constrain to master's own major (3009.x, currently
+                # unreleased -- Potassium in SaltVersionsInfo). No v3009.*
+                # tag exists yet on master, so `git describe` will fall
+                # through to `--always` and return just the sha, and the
+                # parse below will keep saltstack_version anchored on
+                # `next_release()` (see the __saltstack_version__ init
+                # further up). This is intentional: master needs no
+                # hand-cut dev-sentinel tag; the codename table is the
+                # single source of truth for the base version. Merged
+                # forward from 3007.x's v3007.* constraint (see git log
+                # for f3ffc8f9c9ea) and rebased forward for master.
                 "--match",
-                "v3008.*",
+                "v3009.*",
+                # Exclude nightly-shaped tags (anything containing `+` in
+                # the tag name, e.g. v3009.0+123.gabcdef) so that the
+                # nightly publish workflow's own release tags don't get
+                # picked up as version anchors on subsequent builds.
+                # Without this, every publish poisons the tag pool for
+                # the next build of the same or later commit. Concrete
+                # instance on 3008.x: a nightly published tag
+                # `v3008.2+588.g02ea048903` caused the following build at
+                # `80f8673901` to report `3008.2+3.g80f8673901` (measured
+                # from the poison tag) rather than the true distance
+                # (600+ commits) from `v3008.2`.
+                "--exclude",
+                "*+*",
                 "--always",
                 "--candidates=150",
             ],
```

---

### Incident Patch 3: `02ea0489` (2026-09-11)
**Commit Message**: Merge pull request #70267 from dwoz/dwoz/fix/yumpkg-group-info-dnf5-3008x

Support dnf5 group list/info in pkg.group_list/group_info

**File**: `salt/modules/yumpkg.py` (modified, +85/-11)
```diff
@@ -2623,6 +2623,37 @@ def group_list():
         "available language groups:": "available languages",
     }
 
+    if _yum() == "dnf5":
+        # dnf5 lists environment groups and language groups under separate
+        # subcommands ("dnf5 environment list"), not under "group list", so the
+        # "installed/available environments" and "available languages" keys
+        # stay empty on dnf5 (the dnf/yum path below still fills them).
+        out = __salt__["cmd.run_stdout"](
+            [_yum(), "group", "list", "--hidden"],
+            output_loglevel="trace",
+            python_shell=False,
+        )
+        for line in salt.utils.itertools.split(out, "\n"):
+            # dnf5 'group list' is a whitespace-aligned table:
+            #   ID   Name (may contain spaces)   Installed (yes|no)
+            # Tokenize the row rather than matching the name with a regex, so a
+            # group name that happens to contain the word "yes" or "no" cannot
+            # be mistaken for the trailing Installed column. The header row and
+            # any blank/administrative lines have no yes/no last column and are
+            # skipped here.
+            parts = line.split()
+            if len(parts) < 3:
+                continue
+            installed = parts[-1].lower()
+            if installed not in ("yes", "no"):
+                continue
+            group_id = parts[0]
+            if installed == "yes":
+                ret["installed"].append(group_id)
+            else:
+                ret["available"].append(group_id)
+        return ret
+
     out = __salt__["cmd.run_stdout"](
         [_yum(), "grouplist", "hidden"], output_loglevel="trace", python_shell=False
     )
@@ -2726,7 +2757,10 @@ def group_info(name, expand=False, ignore_groups=None, **kwargs):
         }
     )
 
-    cmd = [_yum(), "--quiet"] + options + ["groupinfo", name]
+    if _yum() == "dnf5":
+        cmd = [_yum(), "--quiet"] + options + ["group", "info", name]
+    else:
+        cmd = [_yum(), "--quiet"] + options + ["groupinfo", name]
     out = __salt__["cmd.run_stdout"](cmd, output_loglevel="trace", python_shell=False)
 
     g_info = {}
@@ -2741,9 +2775,17 @@ def group_info(name, expand=False, ignore_groups=None, **kwargs):
         ret["type"] = "environment group"
     elif "group" in g_info:
         ret["type"] = "package group"
+    elif "name" in g_info:
+        # dnf5 'group info' labels a package group with "Name"/"Id" rather than
+        # the "Group"/"Group-Id" that dnf uses.
+        ret["type"] = "package group"
 
-    ret["group"] = g_info.get("environment group") or g_info.get("group")
-    ret["id"] = g_info.get("environment-id") or g_info.get("group-id")
+    ret["group"] = (
+        g_info.get("environment group") or g_info.get("group") or g_info.get("name")
+    )
+    ret["id"] = (
+        g_info.get("environment-id") or g_info.get("group-id") or g_info.get("id")
+    )
     if not ret["group"] and not ret["id"]:
         raise CommandExecutionError(f"Group '{name}' not found")
 
@@ -2754,7 +2796,14 @@ def group_info(name, expand=False, ignore_groups=None, **kwargs):
     for pkgtype in pkgtypes:
         target_found = False
         for line in salt.utils.itertools.split(out, "\n"):
-            line = line.strip().lstrip(string.punctuation)
+            line = line.strip().lstrip(string.punctuation).strip()
+            # ``member`` is the group member (a package or, for environment
+            # groups, a subgroup) this line contributes. For an ordinary member
+            # line it is the line itself; a dnf5 section header (below) carries
+            # its section's first member inline and overrides it.
+            member = line
+            # dnf (yum): the section header sits on its own line, e.g.
+            # "Mandatory Packages:", with members on the lines that follow.
             match = re.match(
                 pkgtypes_capturegroup + r" (?:groups|packages):\s*$", line.lower()
         
```

**File**: `tests/pytests/unit/modules/test_yumpkg.py` (modified, +103/-1)
```diff
@@ -2944,7 +2944,6 @@ def test_group_info():
             "yelp",
         ],
         "optional": [
-            "",
             "alacarte",
             "dconf-editor",
             "dvgrab",
@@ -3580,3 +3579,106 @@ def fake_parse(*args, **kwargs):
         yumpkg.install("fnord", version=new)
         call = cmd_mock.mock_calls[0][1][0]
         assert call == expected_cmd
+
+
+def test_67975_dnf5_group_info():
+    """
+    Test yumpkg.group_info parsing of the dnf5 'group info' format, where each
+    package section carries its first member inline after the colon and the
+    rest on continuation lines.
+    """
+    cmd_out = """\
+Id                   : libreoffice
+Name                 : LibreOffice
+Description          : LibreOffice Productivity Suite
+Installed            : yes
+Order                :
+Langonly             :
+Uservisible          : yes
+Repositories         : @System
+Mandatory packages   : libreoffice-calc
+                     : libreoffice-emailmerge
+                     : libreoffice-graphicfilter
+                     : libreoffice-impress
+                     : libreoffice-writer
+Optional packages    : libreoffice-base
+                     : libreoffice-draw
+                     : libreoffice-math
+                     : libreoffice-pyuno"""
+    expected = {
+        "mandatory": [
+            "libreoffice-calc",
+            "libreoffice-emailmerge",
+            "libreoffice-graphicfilter",
+            "libreoffice-impress",
+            "libreoffice-writer",
+        ],
+        "optional": [
+            "libreoffice-base",
+            "libreoffice-draw",
+            "libreoffice-math",
+            "libreoffice-pyuno",
+        ],
+        "default": [],
+        "conditional": [],
+        "type": "package group",
+        "group": "LibreOffice",
+        "id": "libreoffice",
+        "description": "LibreOffice Productivity Suite",
+    }
+    with patch.object(yumpkg, "_yum", MagicMock(return_value="dnf5")), patch.dict(
+        yumpkg.__salt__, {"cmd.run_stdout": MagicMock(return_value=cmd_out)}
+    ):
+        assert yumpkg.group_info("libreoffice") == expected
+
+
+def test_67975_dnf5_group_list():
+    """
+    Test yumpkg.group_list parsing of the dnf5 'group list' table. The group
+    name column is tokenized rather than matched with a regex, so a name that
+    contains or ends with the word "yes"/"no" (``Just (testing) yes``) is not
+    mistaken for the trailing Installed column, and a row with trailing
+    whitespace (``last``) is still classified rather than dropped.
+    """
+    cmd_out = (
+        "ID                   Name             Installed\n"
+        "foo                  Foo package             no\n"
+        "bar                  Bar package             no\n"
+        "brackets             Just (testing) yes     yes\n"
+        "cleaners             Mop and bucket         yes\n"
+        "last                 But not least           no    \n"
+    )
+    expected = {
+        "installed": ["brackets", "cleaners"],
+        "available": ["foo", "bar", "last"],
+        "installed environments": [],
+        "available environments": [],
+        "available languages": {},
+    }
+    with patch.object(yumpkg, "_yum", MagicMock(return_value="dnf5")), patch.dict(
+        yumpkg.__salt__, {"cmd.run_stdout": MagicMock(return_value=cmd_out)}
+    ):
+        assert yumpkg.group_list() == expected
+
+
+def test_dnf5_group_info_skips_blank_member_lines():
+    """
+    A blank line inside a package section (e.g. between sections) must not be
+    recorded as an empty package name.
+    """
+    cmd_out = (
+        "Id                   : development-tools\n"
+        "Name                 : Development Tools\n"
+        "Installed            : no\n"
+        "Mandatory packages   : gettext\n"
+        "\n"
+        "Optional packages    : cmake\n"
+    )
+    with patch.object(yumpkg, "_yum", MagicMock(return_value="dnf5")), patch.dict(
+        yumpkg.
```

---

### Incident Patch 4: `8f81fb37` (2026-09-11)
**Commit Message**: Merge pull request #70261 from dwoz/dwoz/fix/70175-del-cleanup-safety-net

Restore __del__ safety-net cleanup on SyncWrapper + PublishServer + _…

**File**: `changelog/70175.fixed.md` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_async`` path did, so non-SIGTERM shutdown paths triggered the three-warning cascade in issue #70175. ``PublishServer.close`` also now calls ``pub.close()`` on every ``_TCPPubServerPublisher`` cached in ``_async_pub_by_loop`` (previously it closed the underlying stream only, leaving ``_closing = False`` and letting the publisher's ``__del__`` emit the "unclosed publisher client" warning at GC). ``PubServer._discard_on_close`` now cancels the pending ``_stream_read`` Task and force-closes the Subscriber so the coroutine frame (with its 1 MiB msgpack Unpacker buffer) is released the moment a subscriber disconnects, closing the per-job leak path on the steady-state per-job path. Fire-and-forget ``MinionEvent`` callers in ``salt.modules.event.fire_master`` and ``salt.modules.mine._mine_send`` are now wrapped in ``with`` blocks so the ``PublishServer`` / ``_TCPPubServerPublisher`` / ``SyncWrapper`` triad is torn down synchronously instead of leaking one bundle per invocation onto the minion event bus. ``salt.utils.error.fire_exception`` is also wrapped in a ``with`` block so the temporary ``SaltEvent`` it constructs closes both pusher and subscriber synchronously -- previously the helper (called from ``salt/minion.py:_thread_return`` job-exception path and from ``salt/metaproxy/{proxy,deltaproxy}.py``) dropped the ``SaltEvent`` reference immediately after ``fire_event``, so cleanup ran only when GC invoked ``SaltEvent.__del__`` and each finalization emitted the three-warning triad from the underlying transport chain.
+Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_async`` path did, so non-SIGTERM shutdown paths triggered the three-warning cascade in issue #70175. ``PublishServer.close`` also now calls ``pub.close()`` on every ``_TCPPubServerPublisher`` cached in ``_async_pub_by_loop`` (previously it closed the underlying stream only, leaving ``_closing = False`` and letting the publisher's ``__del__`` emit the "unclosed publisher client" warning at GC). ``PubServer._discard_on_close`` now cancels the pending ``_stream_read`` Task and force-closes the Subscriber so the coroutine frame (with its 1 MiB msgpack Unpacker buffer) is released the moment a subscriber disconnects, closing the per-job leak path on the steady-state per-job path. Fire-and-forget ``MinionEvent`` callers in ``salt.modules.event.fire_master`` and ``salt.modules.mine._mine_send`` are now wrapped in ``with`` blocks so the ``PublishServer`` / ``_TCPPubServerPublisher`` / ``SyncWrapper`` triad is torn down synchronously instead of leaking one bundle per invocation onto the minion event bus. ``salt.utils.error.fire_exception`` is also wrapped in a ``with`` block so the temporary ``SaltEvent`` it constructs closes both pusher and subscriber synchronously -- previously the helper (called from ``salt/minion.py:_thread_return`` job-exception path and from ``salt/metaproxy/{proxy,deltaproxy}.py``) dropped the ``SaltEvent`` reference immediately after ``fire_event``, so cleanup ran only when GC invoked ``SaltEvent.__del__`` and each finalization emitted the three-warning triad from the underlying transport chain. ``salt.utils.asynchronous.SyncWrapper.__del__``, ``salt.transport.tcp.PublishServer.__del__``, and ``salt.transport.tc
```

**File**: `salt/transport/tcp.py` (modified, +297/-51)
```diff
@@ -1437,33 +1437,51 @@ async def _stream_read(
         self, client, _StreamClosedError=tornado.iostream.StreamClosedError
     ):
         unpacker = salt.utils.msgpack.Unpacker()
-        while not self._closing:
-            try:
-                client._read_until_future = client.stream.read_bytes(4096, partial=True)
-                wire_bytes = await client._read_until_future
-                unpacker.feed(wire_bytes)
-                for framed_msg in unpacker:
-                    framed_msg = salt.transport.frame.decode_embedded_strs(framed_msg)
-                    body = framed_msg["body"]
-                    if self.presence_callback:
-                        result = self.presence_callback(client, body)
-                        # Callbacks that need to perform I/O (auth check,
-                        # cache lookup) are ``async def`` and return a
-                        # coroutine; await it so the verification actually
-                        # runs. Sync callbacks return a value directly.
-                        if asyncio.iscoroutine(result):
-                            await result
-            except _StreamClosedError as e:
-                log.debug("tcp stream to %s closed, unable to recv", client.address)
-                client.close()
-                self.remove_presence_callback(client)
-                self.clients.discard(client)
-                break
-            except Exception as e:  # pylint: disable=broad-except
-                log.error(
-                    "Exception parsing response from %s", client.address, exc_info=True
-                )
-                continue
+        try:
+            while not self._closing:
+                try:
+                    client._read_until_future = client.stream.read_bytes(
+                        4096, partial=True
+                    )
+                    wire_bytes = await client._read_until_future
+                    unpacker.feed(wire_bytes)
+                    for framed_msg in unpacker:
+                        framed_msg = salt.transport.frame.decode_embedded_strs(
+                            framed_msg
+                        )
+                        body = framed_msg["body"]
+                        if self.presence_callback:
+                            result = self.presence_callback(client, body)
+                            # Callbacks that need to perform I/O (auth check,
+                            # cache lookup) are ``async def`` and return a
+                            # coroutine; await it so the verification actually
+                            # runs. Sync callbacks return a value directly.
+                            if asyncio.iscoroutine(result):
+                                await result
+                except _StreamClosedError as e:
+                    log.debug("tcp stream to %s closed, unable to recv", client.address)
+                    client.close()
+                    self.remove_presence_callback(client)
+                    self.clients.discard(client)
+                    break
+                except Exception as e:  # pylint: disable=broad-except
+                    log.error(
+                        "Exception parsing response from %s",
+                        client.address,
+                        exc_info=True,
+                    )
+                    continue
+        finally:
+            # Release the 1 MiB msgpack Unpacker buffer and break the
+            # ``client -> _read_task -> coroutine frame -> client`` reference
+            # cycle so the Subscriber + its stream/read buffers reclaim
+            # immediately on exit rather than waiting for a full cyclic-GC
+            # pass.  Under bursty per-job subscriber churn (each state.apply
+            # child forks a fresh event-bus subscriber) tracemalloc showed
+            # +35 pinned Unpackers -> +37 MiB retained after only 20 jobs
+            # on 3008.x.
+            del unpacker
+            client._read_
```

**File**: `salt/utils/asynchronous.py` (modified, +43/-18)
```diff
@@ -97,11 +97,14 @@ def __init__(
         self.loop_kwarg = loop_kwarg
         self.cls = cls
         # Record creating pid so a forked child that inherits this wrapper via
-        # copy-on-write does NOT emit an ``unclosed SyncWrapper`` warning in
-        # its ``__del__`` -- the parent still owns the wrapped ``obj`` +
-        # io_loop + asyncio_loop; touching them from a child would double-
-        # close the parent's resources.  Same rationale + pattern as the
-        # transport classes patched in this PR for ``salt/transport/tcp.py``.
+        # copy-on-write does NOT touch (close) or warn on the wrapped ``obj`` +
+        # io_loop + asyncio_loop in its ``__del__`` -- the parent still owns
+        # them; closing the wrapped socket FDs from the child would break the
+        # parent's transport (observed in tests/pytests/unit/utils/event/
+        # test_event.py::test_event_no_timeout when ``EventSender``'s fork
+        # inherited the ``MasterEvent`` subscriber ``SyncWrapper`` and, on
+        # exit, GC-closed the shared IPC socket).  Same rationale + pattern
+        # as the transport classes in ``salt/transport/tcp.py``.
         self._creator_pid = os.getpid()
         if loop_kwarg:
             kwargs[self.loop_kwarg] = self.io_loop
@@ -431,16 +434,14 @@ def __exit__(self, exc_type, exc_val, tb):
 
     # pylint: disable=W1701
     def __del__(self):
-        # PATCH: mirror ``SaltEvent.__del__`` at ``salt/utils/event.py``
-        # -- deliberately do NOT close the wrapped ``obj`` / io_loop /
-        # asyncio_loop from ``__del__``.  ``__del__`` fires during GC
-        # (may be arbitrarily delayed, may skip on reference cycles)
-        # and during interpreter shutdown, when the world is already
-        # tearing down and touching a tornado/asyncio loop can raise
-        # from a partially-freed C extension.  Instead, emit a
-        # ``ResourceWarning`` so callers that missed ``close()`` /
-        # context-manager surface loudly in tests / sentry / log
-        # aggregators.
+        # On this LTS branch ``__del__`` both surfaces the leak via
+        # ``warn_until_close`` (loud WARNING-level log record and
+        # ``ResourceWarning``) AND falls back to calling ``close()`` as
+        # a safety net, so callers that historically relied on GC-time
+        # cleanup do not silently leak a whole ``asyncio`` event loop,
+        # its tornado IOLoop, and the ZMQ context / socketpairs backing
+        # the wrapped async object (typically ``AsyncReqChannel``,
+        # ``AsyncPubChannel`` or ``AsyncEventPublisher``).
         #
         # Motivation: ``SyncWrapper``-owned asyncio loops are the
         # dominant leak surface on the minion under sustained
@@ -451,6 +452,18 @@ def __del__(self):
         # 1024-file ulimit critical threshold and the minion's own
         # sock-throttle logic.
         #
+        # The companion change on ``master`` (Potassium) drops the
+        # ``close()`` fallback and requires callers to use a context
+        # manager or explicit ``close()``; the loud warning here is the
+        # migration signal for that change.
+        #
+        # Python's ``__del__`` runs during GC (may be delayed, may skip
+        # on reference cycles) and during interpreter shutdown (when the
+        # world is already tearing down and touching a tornado/asyncio
+        # loop can raise from a partially-freed C extension).  The
+        # ``close()`` call chain below is guarded so a finalizer never
+        # propagates an exception.
+        #
         # Use ``self.__dict__.get(...)`` rather than ``getattr()`` for the
         # attribute probes below: ``SyncWrapper.__getattr__`` delegates
         # missing attributes to ``self.obj``, so a partially-initialized
@@ -461,9 +474,11 @@ def __del__(self):
         if _creator_pid is not None and os.getpid() != _creator_pid:
             # Forked child: the parent still owns the wrapped ``obj`` /
             # io_loop /
```

**File**: `tests/pytests/unit/transport/test_tcp.py` (modified, +366/-5)
```diff
@@ -2339,13 +2339,14 @@ def closed(self):
         "minion under 132-job / 5-min mixed load)"
     )
 
-    # Also assert on the per-Subscriber Task refs so a future
-    # refactor that stops storing them on the client is caught.
+    # After ``_discard_on_close._cb`` fires, ``client._read_task`` is
+    # cleared to ``None`` so the ``client -> _read_task -> coroutine frame
+    # -> client`` reference cycle is broken and refcount collection can
+    # reclaim the coroutine frame (and its 1 MiB Unpacker) immediately.
     for client, _ in subscribers:
-        assert client._read_task is not None
         assert (
-            client._read_task.done()
-        ), f"Subscriber._read_task still pending for {client!r}"
+            client._read_task is None
+        ), f"Subscriber._read_task not cleared post-close for {client!r}"
 
 
 def test_publish_server_connect_wires_ipc_write_buffer_into_publisher(
@@ -2384,3 +2385,363 @@ def connect(self, timeout=None):
     assert captured["cls"] is salt.transport.tcp._TCPPubServerPublisher
     assert captured["kwargs"] == {"max_write_buffer_size": 4321}
     assert captured.get("connect_called") is True
+
+
+def test_publish_server_del_safety_net_calls_close_70175(master_opts):
+    """
+    Regression test for the __del__ safety-net cleanup extension of #70175.
+
+    When a caller drops the last reference to a ``PublishServer`` without
+    invoking ``close()`` first (typical of shutdown paths that skip
+    ``MinionManager.destroy``), the ``__del__`` finalizer must:
+
+    1. Emit the ``ResourceWarning`` so the leaky caller still surfaces
+       for tracking (behavior preserved from the warn-only revision).
+    2. Fall back to ``close()`` so the ``pub_sock`` / ``pub_server`` /
+       ``pull_sock`` / io_loop / per-loop cached publishers are
+       released, converting a ~50 MB/hr RSS leak into a bounded per-GC
+       cleanup.
+    """
+    server = salt.transport.tcp.PublishServer(
+        master_opts,
+        pub_host="127.0.0.1",
+        pub_port=1,
+        pull_host="127.0.0.1",
+        pull_port=2,
+    )
+    assert server._closing is False
+
+    # Wire fake sub-resources so we can observe that close() actually
+    # traversed them. Each mock records whether ``close()`` was called.
+    saved_pub_sock = MagicMock()
+    saved_pub_server = MagicMock()
+    saved_pull_sock = MagicMock()
+    saved_io_loop = MagicMock()
+    stale_pub = MagicMock()
+    stale_pub.close = MagicMock()
+    server.pub_sock = saved_pub_sock
+    server.pub_server = saved_pub_server
+    server.pull_sock = saved_pull_sock
+    server.io_loop = saved_io_loop
+    server._async_pub_by_loop = {"loop-key": (stale_pub, MagicMock())}
+
+    with warnings.catch_warnings(record=True) as caught:
+        warnings.simplefilter("always")
+        del server
+        gc.collect()
+
+    # 1. ResourceWarning still fires (behavior preserved).
+    resource_warnings = [w for w in caught if issubclass(w.category, ResourceWarning)]
+    assert resource_warnings, (
+        "expected ResourceWarning from PublishServer.__del__; got "
+        f"{[(w.category, str(w.message)) for w in caught]}"
+    )
+    assert any("unclosed publish server" in str(w.message) for w in resource_warnings)
+
+    # 2. Safety-net close() ran -- observed via the sub-resource mocks
+    #    (each ``.close()`` was invoked exactly once by ``PublishServer.close``).
+    saved_pub_sock.close.assert_called_once()
+    saved_pub_server.close.assert_called_once()
+    saved_pull_sock.close.assert_called_once()
+    # 3. io_loop had stop() + close() driven.
+    saved_io_loop.stop.assert_called_once()
+    saved_io_loop.close.assert_called_once_with(all_fds=True)
+    # 4. Per-loop cached publisher was drained.
+    stale_pub.close.assert_called_once()
+
+
+def test_tcppubserverpublisher_del_safety_net_calls_close_70175():
+    """
+    Regression test for the __del__ safety-net cleanup extension of #70175.
+
+    When a caller drops the 
```

**File**: `tests/pytests/unit/transport/test_tcp_pubserver_close_cycle.py` (added, +212/-0)
```diff
@@ -0,0 +1,212 @@
+"""
+Regression tests for the ``PubServer`` close-path Unpacker + drainer leak
+on 3008.x.
+
+Two independent retention paths were observed by tracemalloc on a live
+salt-minion under sustained ``state.apply`` load (issue #70175):
+
+1. ``PubServer._stream_read`` allocated one ``salt.utils.msgpack.Unpacker``
+   (~1 MiB internal read buffer) per accepted stream.  On subscriber
+   disconnect the coroutine's Task was cancelled, but the coroutine
+   frame -- which holds the ``unpacker`` and ``client`` locals -- was
+   pinned by a reference cycle::
+
+       client -> client._read_task -> task._coro -> coroutine frame -> client
+
+   Cyclic GC eventually collected it, but under bursty per-job
+   subscriber churn tracemalloc showed +35 pinned ``Unpacker`` instances
+   / +37 MiB retained after only 20 jobs.
+
+2. ``PubServer._writers[client]`` -- an ``asyncio.Queue`` + drain-Task
+   tuple created by ``_get_or_create_drainer`` -- was popped by
+   ``_discard_slow_client`` on the drain-timeout path but NOT by
+   ``_discard_on_close._cb()`` on the clean-close path.  Each cleanly
+   disconnected subscriber leaked its Queue + Task pair (~25 kB apiece).
+
+The fix in ``salt/transport/tcp.py``:
+
+  * ``_stream_read`` gains a ``try/finally`` that does ``del unpacker``
+    and ``client._read_task = None`` so the retention chain is broken
+    immediately on coroutine exit -- no wait for the next cyclic-GC pass.
+  * ``_discard_on_close._cb()`` also clears ``client._read_task`` (for
+    the case where the coroutine has not yet resumed to observe the
+    cancellation) and pops the ``self._writers`` entry, cancelling the
+    drain task.
+
+The two tests below assert those post-fix invariants.  Both were
+verified to FAIL on ``origin/3008.x`` without the patch and PASS with
+the patch (see PR description).
+"""
+
+import asyncio
+import gc
+import weakref
+
+import pytest
+import tornado.iostream
+
+import salt.transport.tcp
+
+pytestmark = [
+    pytest.mark.core_test,
+]
+
+
+class _EOFStream:
+    """
+    Minimal ``IOStream``-lookalike whose ``read_bytes`` immediately raises
+    ``StreamClosedError``.  Drives ``PubServer._stream_read`` through the
+    ``_StreamClosedError`` branch -> ``break`` -> ``finally`` on the very
+    first read, mimicking a peer that closed just after connect.
+    """
+
+    def __init__(self):
+        self._closed = False
+
+    def read_bytes(self, *args, **kwargs):
+        raise tornado.iostream.StreamClosedError()
+
+    def closed(self):
+        return self._closed
+
+    def close(self):
+        self._closed = True
+
+
+async def test_stream_read_releases_unpacker_and_task_ref_on_close(
+    master_opts, io_loop
+):
+    """
+    Post-fix contract: when ``_stream_read`` exits (either normally via
+    ``StreamClosedError`` or via cancellation), the per-connection
+    ``msgpack.Unpacker`` and the ``client._read_task`` back-reference
+    must be released *immediately* -- without waiting for the cyclic
+    garbage collector to break the ``client -> _read_task -> coro frame
+    -> client`` cycle.
+
+    Test strategy: disable the cyclic collector for the duration of the
+    check so only refcount-based collection is available.  Track the
+    ``Subscriber`` via ``weakref``.  On the patched code the ``finally``
+    block clears ``client._read_task`` and drops the ``unpacker`` local
+    from the frame, refcounts drop to zero, and the weakref returns
+    ``None`` after a single event-loop turn.  On unpatched 3008.x the
+    cycle survives (only cyclic GC could collect it) and the weakref
+    stays live.
+    """
+    server = salt.transport.tcp.PubServer(master_opts, io_loop=io_loop)
+    try:
+        stream = _EOFStream()
+        subscriber = salt.transport.tcp.Subscriber(stream, "eof-client")
+        server.clients.add(subscriber)
+        subscriber_ref = weakref.ref(subscriber)
+
+        # Mimic ``handle_stream``: schedule ``_stream_read`` and record
+        # t
```

---

### Incident Patch 5: `46ce6a52` (2026-09-11)
**Commit Message**: Fix per-job Unpacker + drainer leak in PubServer close path

``_stream_read`` retained a 1 MiB msgpack.Unpacker per accepted stream
because the ``client -> _read_task -> coroutine frame -> client``
reference cycle only collected on the next cyclic-GC pass -- under
sustained per-job subscriber churn (each state.apply child forks a
fresh event-bus subscriber) tracemalloc showed +35 pinned Unpackers
~= +37 MiB retained after only 20 jobs on a live minion.

``_discard_on_close._cb()`` also leaked the per-subscriber
``self._writers`` entry -- an ``asyncio.Queue`` + drain-Task tuple,
~25 kB apiece.  ``_discard_slow_client`` already popped this on the
drain-timeout path, but the clean-close callback did not.

This is the follow-up to PR #70260 (which cancelled the read task):
that alone was not enough because the coroutine frame stayed pinned
via the cycle above.

Fixes:

* ``_stream_read`` gains a ``try/finally`` that does ``del unpacker``
  and clears ``client._read_task = None`` so refcount collection
  reclaims the coroutine frame (and its Unpacker) immediately on exit.
* ``_discard_on_close._cb()`` also clears ``client._read_task`` (for
  the case where the coroutine has not yet resu

**File**: `changelog/70175.fixed.md` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_async`` path did, so non-SIGTERM shutdown paths triggered the three-warning cascade in issue #70175. ``PublishServer.close`` also now calls ``pub.close()`` on every ``_TCPPubServerPublisher`` cached in ``_async_pub_by_loop`` (previously it closed the underlying stream only, leaving ``_closing = False`` and letting the publisher's ``__del__`` emit the "unclosed publisher client" warning at GC). ``PubServer._discard_on_close`` now cancels the pending ``_stream_read`` Task and force-closes the Subscriber so the coroutine frame (with its 1 MiB msgpack Unpacker buffer) is released the moment a subscriber disconnects, closing the per-job leak path on the steady-state per-job path. Fire-and-forget ``MinionEvent`` callers in ``salt.modules.event.fire_master`` and ``salt.modules.mine._mine_send`` are now wrapped in ``with`` blocks so the ``PublishServer`` / ``_TCPPubServerPublisher`` / ``SyncWrapper`` triad is torn down synchronously instead of leaking one bundle per invocation onto the minion event bus. ``salt.utils.error.fire_exception`` is also wrapped in a ``with`` block so the temporary ``SaltEvent`` it constructs closes both pusher and subscriber synchronously -- previously the helper (called from ``salt/minion.py:_thread_return`` job-exception path and from ``salt/metaproxy/{proxy,deltaproxy}.py``) dropped the ``SaltEvent`` reference immediately after ``fire_event``, so cleanup ran only when GC invoked ``SaltEvent.__del__`` and each finalization emitted the three-warning triad from the underlying transport chain. ``salt.utils.asynchronous.SyncWrapper.__del__``, ``salt.transport.tcp.PublishServer.__del__``, and ``salt.transport.tcp._TCPPubServerPublisher.__del__`` also now fall back to ``close()`` as a GC-time safety net -- mirroring the pattern on ``salt.utils.event.SaltEvent.__del__`` -- while still emitting the ``ResourceWarning`` so leaky callers can be surfaced for tracking pre-Potassium. ``salt.transport.tcp.TCPPuller.handle_stream`` also no longer spins the tornado io_loop when a ``ValueError('fd %s added twice')`` (from ``IOLoop.add_handler`` via tornado's ``IOStream._add_io_state``) or ``AssertionError('Already reading')`` (the modern tornado surface for the "prior read still outstanding" state, historically named ``StreamAlreadyReadingError``) is raised inside the reader loop under heavy master/minion connection churn. The historical broad-except swallowed the error and the outer ``while not stream.closed()`` loop immediately re-invoked ``stream.read_bytes`` on the same broken fd, driving the tornado io_loop to 77-119% CPU and growing the log to hundreds of MB in seconds until the CI step timed out (deterministic repro on a 32-CPU Rocky 9 container running the 4-master cluster tests, probabilistic in CI). ``handle_stream`` now narrow-catches those state errors, closes the stream, and breaks out of the reader loop so the accept handler is free to service the next connection. ``_TCPPubServerPublisher.close`` also best-effort calls ``stream.io_loop.remove_handler(fd)`` before closing the stream so a fd left partially registered by a failed connect() doesn't resurface as another ``fd added twice`` the next time the fd is reused.
+Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_as
```

**File**: `salt/transport/tcp.py` (modified, +63/-27)
```diff
@@ -1437,33 +1437,51 @@ async def _stream_read(
         self, client, _StreamClosedError=tornado.iostream.StreamClosedError
     ):
         unpacker = salt.utils.msgpack.Unpacker()
-        while not self._closing:
-            try:
-                client._read_until_future = client.stream.read_bytes(4096, partial=True)
-                wire_bytes = await client._read_until_future
-                unpacker.feed(wire_bytes)
-                for framed_msg in unpacker:
-                    framed_msg = salt.transport.frame.decode_embedded_strs(framed_msg)
-                    body = framed_msg["body"]
-                    if self.presence_callback:
-                        result = self.presence_callback(client, body)
-                        # Callbacks that need to perform I/O (auth check,
-                        # cache lookup) are ``async def`` and return a
-                        # coroutine; await it so the verification actually
-                        # runs. Sync callbacks return a value directly.
-                        if asyncio.iscoroutine(result):
-                            await result
-            except _StreamClosedError as e:
-                log.debug("tcp stream to %s closed, unable to recv", client.address)
-                client.close()
-                self.remove_presence_callback(client)
-                self.clients.discard(client)
-                break
-            except Exception as e:  # pylint: disable=broad-except
-                log.error(
-                    "Exception parsing response from %s", client.address, exc_info=True
-                )
-                continue
+        try:
+            while not self._closing:
+                try:
+                    client._read_until_future = client.stream.read_bytes(
+                        4096, partial=True
+                    )
+                    wire_bytes = await client._read_until_future
+                    unpacker.feed(wire_bytes)
+                    for framed_msg in unpacker:
+                        framed_msg = salt.transport.frame.decode_embedded_strs(
+                            framed_msg
+                        )
+                        body = framed_msg["body"]
+                        if self.presence_callback:
+                            result = self.presence_callback(client, body)
+                            # Callbacks that need to perform I/O (auth check,
+                            # cache lookup) are ``async def`` and return a
+                            # coroutine; await it so the verification actually
+                            # runs. Sync callbacks return a value directly.
+                            if asyncio.iscoroutine(result):
+                                await result
+                except _StreamClosedError as e:
+                    log.debug("tcp stream to %s closed, unable to recv", client.address)
+                    client.close()
+                    self.remove_presence_callback(client)
+                    self.clients.discard(client)
+                    break
+                except Exception as e:  # pylint: disable=broad-except
+                    log.error(
+                        "Exception parsing response from %s",
+                        client.address,
+                        exc_info=True,
+                    )
+                    continue
+        finally:
+            # Release the 1 MiB msgpack Unpacker buffer and break the
+            # ``client -> _read_task -> coroutine frame -> client`` reference
+            # cycle so the Subscriber + its stream/read buffers reclaim
+            # immediately on exit rather than waiting for a full cyclic-GC
+            # pass.  Under bursty per-job subscriber churn (each state.apply
+            # child forks a fresh event-bus subscriber) tracemalloc showed
+            # +35 pinned Unpackers -> +37 MiB retained after only 20 jobs
+            # on 3008.x.
+            del unpacker
+            client._read_
```

**File**: `tests/pytests/unit/transport/test_tcp.py` (modified, +6/-5)
```diff
@@ -2339,13 +2339,14 @@ def closed(self):
         "minion under 132-job / 5-min mixed load)"
     )
 
-    # Also assert on the per-Subscriber Task refs so a future
-    # refactor that stops storing them on the client is caught.
+    # After ``_discard_on_close._cb`` fires, ``client._read_task`` is
+    # cleared to ``None`` so the ``client -> _read_task -> coroutine frame
+    # -> client`` reference cycle is broken and refcount collection can
+    # reclaim the coroutine frame (and its 1 MiB Unpacker) immediately.
     for client, _ in subscribers:
-        assert client._read_task is not None
         assert (
-            client._read_task.done()
-        ), f"Subscriber._read_task still pending for {client!r}"
+            client._read_task is None
+        ), f"Subscriber._read_task not cleared post-close for {client!r}"
 
 
 def test_publish_server_connect_wires_ipc_write_buffer_into_publisher(
```

**File**: `tests/pytests/unit/transport/test_tcp_pubserver_close_cycle.py` (added, +212/-0)
```diff
@@ -0,0 +1,212 @@
+"""
+Regression tests for the ``PubServer`` close-path Unpacker + drainer leak
+on 3008.x.
+
+Two independent retention paths were observed by tracemalloc on a live
+salt-minion under sustained ``state.apply`` load (issue #70175):
+
+1. ``PubServer._stream_read`` allocated one ``salt.utils.msgpack.Unpacker``
+   (~1 MiB internal read buffer) per accepted stream.  On subscriber
+   disconnect the coroutine's Task was cancelled, but the coroutine
+   frame -- which holds the ``unpacker`` and ``client`` locals -- was
+   pinned by a reference cycle::
+
+       client -> client._read_task -> task._coro -> coroutine frame -> client
+
+   Cyclic GC eventually collected it, but under bursty per-job
+   subscriber churn tracemalloc showed +35 pinned ``Unpacker`` instances
+   / +37 MiB retained after only 20 jobs.
+
+2. ``PubServer._writers[client]`` -- an ``asyncio.Queue`` + drain-Task
+   tuple created by ``_get_or_create_drainer`` -- was popped by
+   ``_discard_slow_client`` on the drain-timeout path but NOT by
+   ``_discard_on_close._cb()`` on the clean-close path.  Each cleanly
+   disconnected subscriber leaked its Queue + Task pair (~25 kB apiece).
+
+The fix in ``salt/transport/tcp.py``:
+
+  * ``_stream_read`` gains a ``try/finally`` that does ``del unpacker``
+    and ``client._read_task = None`` so the retention chain is broken
+    immediately on coroutine exit -- no wait for the next cyclic-GC pass.
+  * ``_discard_on_close._cb()`` also clears ``client._read_task`` (for
+    the case where the coroutine has not yet resumed to observe the
+    cancellation) and pops the ``self._writers`` entry, cancelling the
+    drain task.
+
+The two tests below assert those post-fix invariants.  Both were
+verified to FAIL on ``origin/3008.x`` without the patch and PASS with
+the patch (see PR description).
+"""
+
+import asyncio
+import gc
+import weakref
+
+import pytest
+import tornado.iostream
+
+import salt.transport.tcp
+
+pytestmark = [
+    pytest.mark.core_test,
+]
+
+
+class _EOFStream:
+    """
+    Minimal ``IOStream``-lookalike whose ``read_bytes`` immediately raises
+    ``StreamClosedError``.  Drives ``PubServer._stream_read`` through the
+    ``_StreamClosedError`` branch -> ``break`` -> ``finally`` on the very
+    first read, mimicking a peer that closed just after connect.
+    """
+
+    def __init__(self):
+        self._closed = False
+
+    def read_bytes(self, *args, **kwargs):
+        raise tornado.iostream.StreamClosedError()
+
+    def closed(self):
+        return self._closed
+
+    def close(self):
+        self._closed = True
+
+
+async def test_stream_read_releases_unpacker_and_task_ref_on_close(
+    master_opts, io_loop
+):
+    """
+    Post-fix contract: when ``_stream_read`` exits (either normally via
+    ``StreamClosedError`` or via cancellation), the per-connection
+    ``msgpack.Unpacker`` and the ``client._read_task`` back-reference
+    must be released *immediately* -- without waiting for the cyclic
+    garbage collector to break the ``client -> _read_task -> coro frame
+    -> client`` cycle.
+
+    Test strategy: disable the cyclic collector for the duration of the
+    check so only refcount-based collection is available.  Track the
+    ``Subscriber`` via ``weakref``.  On the patched code the ``finally``
+    block clears ``client._read_task`` and drops the ``unpacker`` local
+    from the frame, refcounts drop to zero, and the weakref returns
+    ``None`` after a single event-loop turn.  On unpatched 3008.x the
+    cycle survives (only cyclic GC could collect it) and the weakref
+    stays live.
+    """
+    server = salt.transport.tcp.PubServer(master_opts, io_loop=io_loop)
+    try:
+        stream = _EOFStream()
+        subscriber = salt.transport.tcp.Subscriber(stream, "eof-client")
+        server.clients.add(subscriber)
+        subscriber_ref = weakref.ref(subscriber)
+
+        # Mimic ``handle_stream``: schedule ``_stream_read`` and record
+        # t
```

---

### Incident Patch 6: `ae7e550c` (2026-09-11)
**Commit Message**: Fix tornado spinloop in TCPPuller.handle_stream on transient state errors

Under heavy master/minion connection churn (observed running the
4-master cluster tests on a 32-CPU Rocky 9 container, probabilistic in
CI), a tornado call inside ``TCPPuller.handle_stream`` intermittently
raises either:

  * ``ValueError('fd %s added twice')`` from ``IOLoop.add_handler``
    (called from tornado's ``IOStream._add_io_state`` when a stream
    tries to register a fd already being tracked by another handler), or
  * ``AssertionError('Already reading')`` from ``IOStream.read_bytes``
    when a prior read on the same stream is still outstanding. (Older
    tornado forks surfaced this as ``StreamAlreadyReadingError``; on
    tornado 6.x it is an ``AssertionError``.)

Both were being swallowed by the historical broad-except on line 1957
of ``salt/transport/tcp.py`` -- so the outer ``while not stream.closed()``
loop immediately re-invoked ``stream.read_bytes`` on the same broken
fd, spinning the tornado io_loop at 77-119% CPU and growing the log
file to hundreds of MB in seconds until the CI step timed out. The
``EventPublisher`` pinned; cluster tests hung; CI killed them with
SIGTERM. Deterministi

**File**: `changelog/70175.fixed.md` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_async`` path did, so non-SIGTERM shutdown paths triggered the three-warning cascade in issue #70175. ``PublishServer.close`` also now calls ``pub.close()`` on every ``_TCPPubServerPublisher`` cached in ``_async_pub_by_loop`` (previously it closed the underlying stream only, leaving ``_closing = False`` and letting the publisher's ``__del__`` emit the "unclosed publisher client" warning at GC). ``PubServer._discard_on_close`` now cancels the pending ``_stream_read`` Task and force-closes the Subscriber so the coroutine frame (with its 1 MiB msgpack Unpacker buffer) is released the moment a subscriber disconnects, closing the per-job leak path on the steady-state per-job path. Fire-and-forget ``MinionEvent`` callers in ``salt.modules.event.fire_master`` and ``salt.modules.mine._mine_send`` are now wrapped in ``with`` blocks so the ``PublishServer`` / ``_TCPPubServerPublisher`` / ``SyncWrapper`` triad is torn down synchronously instead of leaking one bundle per invocation onto the minion event bus. ``salt.utils.error.fire_exception`` is also wrapped in a ``with`` block so the temporary ``SaltEvent`` it constructs closes both pusher and subscriber synchronously -- previously the helper (called from ``salt/minion.py:_thread_return`` job-exception path and from ``salt/metaproxy/{proxy,deltaproxy}.py``) dropped the ``SaltEvent`` reference immediately after ``fire_event``, so cleanup ran only when GC invoked ``SaltEvent.__del__`` and each finalization emitted the three-warning triad from the underlying transport chain. ``salt.utils.asynchronous.SyncWrapper.__del__``, ``salt.transport.tcp.PublishServer.__del__``, and ``salt.transport.tcp._TCPPubServerPublisher.__del__`` also now fall back to ``close()`` as a GC-time safety net -- mirroring the pattern on ``salt.utils.event.SaltEvent.__del__`` -- while still emitting the ``ResourceWarning`` so leaky callers can be surfaced for tracking pre-Potassium.
+Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_async`` path did, so non-SIGTERM shutdown paths triggered the three-warning cascade in issue #70175. ``PublishServer.close`` also now calls ``pub.close()`` on every ``_TCPPubServerPublisher`` cached in ``_async_pub_by_loop`` (previously it closed the underlying stream only, leaving ``_closing = False`` and letting the publisher's ``__del__`` emit the "unclosed publisher client" warning at GC). ``PubServer._discard_on_close`` now cancels the pending ``_stream_read`` Task and force-closes the Subscriber so the coroutine frame (with its 1 MiB msgpack Unpacker buffer) is released the moment a subscriber disconnects, closing the per-job leak path on the steady-state per-job path. Fire-and-forget ``MinionEvent`` callers in ``salt.modules.event.fire_master`` and ``salt.modules.mine._mine_send`` are now wrapped in ``with`` blocks so the ``PublishServer`` / ``_TCPPubServerPublisher`` / ``SyncWrapper`` triad is torn down synchronously instead of leaking one bundle per invocation onto the minion event bus. ``salt.utils.error.fire_exception`` is also wrapped in a ``with`` block so the temporary ``SaltEvent`` it constructs closes both pusher and subscriber synchronously -- previously the helper (called from ``salt/minion.py:_thread_return`` job-exception path a
```

**File**: `salt/transport/tcp.py` (modified, +106/-3)
```diff
@@ -1951,10 +1951,72 @@ async def handle_stream(self, stream):
                         "spurious exception: %s",
                         exc,
                     )
-                else:
-                    log.error("Exception occurred while handling stream: %s", exc)
+                    continue
+                # A real OSError (EBADF, ECONNRESET, ...) means the underlying
+                # fd is unusable.  Continuing the while loop would immediately
+                # re-invoke ``stream.read_bytes`` on a broken stream and spin
+                # the io_loop.  Close the stream and break out so the accept
+                # handler can service the next connection.
+                log.warning("Closing IPC stream after OSError: %s", exc, exc_info=True)
+                if not stream.closed():
+                    try:
+                        stream.close()
+                    except Exception:  # pylint: disable=broad-except
+                        log.debug("Ignoring error closing IPC stream", exc_info=True)
+                break
+            except (ValueError, AssertionError) as exc:
+                # Two unrecoverable state errors from tornado surface here:
+                #
+                #   * ``ValueError('fd %s added twice')`` from
+                #     ``IOLoop.add_handler`` (called from
+                #     ``IOStream._add_io_state``) when a stream tries to
+                #     register a fd that is already being tracked.
+                #   * ``AssertionError('Already reading')`` from
+                #     ``IOStream.read_bytes`` when a prior read on the same
+                #     stream is still outstanding.  (Older tornado forks
+                #     surfaced this as ``StreamAlreadyReadingError``; on
+                #     modern tornado it is an ``AssertionError``.)
+                #
+                # Both fire deterministically under heavy master/minion
+                # connection churn (observed in the 4-master cluster tests).
+                # With the historical broad-except the outer
+                # ``while not stream.closed()`` loop immediately re-entered
+                # ``stream.read_bytes`` on the same broken fd, spinning the
+                # tornado io_loop at 77-119% CPU and growing the log to
+                # hundreds of MB in seconds until the CI step timed out
+                # (deterministic repro on a 32-CPU Rocky 9 container,
+                # probabilistic in CI).  The stream is not recoverable at
+                # this point -- close it and let the accept handler service
+                # the next connection.
+                log.warning(
+                    "Closing IPC stream after unrecoverable state error: %s",
+                    exc,
+                    exc_info=True,
+                )
+                if not stream.closed():
+                    try:
+                        stream.close()
+                    except Exception:  # pylint: disable=broad-except
+                        log.debug("Ignoring error closing IPC stream", exc_info=True)
+                break
             except Exception as exc:  # pylint: disable=broad-except
-                log.error("Exception occurred while handling stream: %s", exc)
+                # Any other unexpected exception at this level indicates the
+                # per-stream reader can no longer make progress on this fd.
+                # Historical behavior was to log and continue, which under
+                # persistent errors spun the io_loop; close the stream and
+                # break so the accept handler is free to service the next
+                # connection.
+                log.error(
+                    "Exception occurred while handling stream: %s",
+                    exc,
+                    exc_info=True,
+                )
+                if not stream.closed():
+                    try:
+                        stream.close()
+                    except Exception:  # py
```

**File**: `tests/pytests/unit/transport/test_tcp.py` (modified, +138/-0)
```diff
@@ -2606,3 +2606,141 @@ def test_tcppubserverpublisher_del_forked_child_does_not_close_parent_fd_70175(
     fake_stream.socket.close.assert_not_called()
 
     io_loop.close()
+
+
+# ---------------------------------------------------------------------------
+# tcp handle_stream spinloop regression: on 3008.x, when a tornado call
+# inside ``TCPPuller.handle_stream`` raises the modern
+# ``AssertionError('Already reading')`` (historical
+# ``StreamAlreadyReadingError``) or ``ValueError('fd %s added twice')`` from
+# ``IOLoop.add_handler`` (observed under cluster-scale connection churn in
+# the 4-master cluster tests), the historical broad-except swallowed the
+# error and the outer ``while not stream.closed()`` loop immediately re-
+# invoked ``stream.read_bytes`` on the same broken fd, spinning the tornado
+# io_loop at 77-119% CPU.  The fix narrow-catches those state errors,
+# closes the stream, and breaks out of the loop.  See the sibling
+# changelog entry in ``changelog/70175.fixed.md`` for the deterministic
+# Rocky 9 container repro.
+# ---------------------------------------------------------------------------
+
+
+async def test_tcp_puller_handle_stream_breaks_on_stream_already_reading():
+    """
+    An ``AssertionError('Already reading')`` raised from ``read_bytes``
+    (tornado's surface for the "prior read is still outstanding on this
+    stream" state; older tornado forks named this
+    ``StreamAlreadyReadingError``) must terminate the reader loop and close
+    the stream, rather than looping and spinning the io_loop.
+    """
+
+    async def handler(body):  # pragma: no cover - never invoked
+        raise RuntimeError("handler must not run when read_bytes raises")
+
+    puller = salt.transport.tcp.TCPPuller(payload_handler=handler)
+
+    class BrokenStream:
+        def __init__(self):
+            self._closed = False
+            self.reads = 0
+            self.close_calls = 0
+
+        async def read_bytes(self, n, partial=False):
+            self.reads += 1
+            raise AssertionError("Already reading")
+
+        def closed(self):
+            return self._closed
+
+        def close(self):
+            self.close_calls += 1
+            self._closed = True
+
+    stream = BrokenStream()
+    try:
+        # If the fix regresses, handle_stream loops indefinitely; the
+        # ``wait_for`` timeout would fire and fail the test.
+        await asyncio.wait_for(puller.handle_stream(stream), timeout=5)
+
+        assert stream.reads == 1, "reader must not retry on unrecoverable state error"
+        assert stream.close_calls >= 1, "stream must be closed on exit"
+    finally:
+        # Silence the ``unclosed tcp puller`` ResourceWarning that would
+        # otherwise leak into unrelated tests scanning warnings.
+        puller.close()
+
+
+async def test_tcp_puller_handle_stream_breaks_on_fd_added_twice():
+    """
+    A ``ValueError('fd N added twice')`` raised from within tornado's
+    ``_add_io_state`` (surfacing at ``read_bytes``) must terminate the
+    reader loop and close the stream, rather than spinning.
+    """
+
+    async def handler(body):  # pragma: no cover - never invoked
+        raise RuntimeError("handler must not run when read_bytes raises")
+
+    puller = salt.transport.tcp.TCPPuller(payload_handler=handler)
+
+    class BrokenStream:
+        def __init__(self):
+            self._closed = False
+            self.reads = 0
+            self.close_calls = 0
+
+        async def read_bytes(self, n, partial=False):
+            self.reads += 1
+            raise ValueError("fd 42 added twice")
+
+        def closed(self):
+            return self._closed
+
+        def close(self):
+            self.close_calls += 1
+            self._closed = True
+
+    stream = BrokenStream()
+    try:
+        await asyncio.wait_for(puller.handle_stream(stream), timeout=5)
+
+        assert stream.reads == 1, "reader must not retry on fd-added-twice error"
+        assert strea
```

---

### Incident Patch 7: `ecc39e73` (2026-09-10)
**Commit Message**: Cancel PubServer read task on stream close to release per-job leak

Companion to #70206 which fixed the shutdown path for the same
issue #70175 symptoms.  This handles the steady-state per-job
path.

Root cause: ``PubServer.handle_stream`` scheduled
``_stream_read`` as an asyncio Task at accept time; the task
awaited ``stream.read_bytes(...)`` and its coroutine frame held a
1 MiB msgpack ``Unpacker`` local and a ``client`` local.  When
the peer closed the connection, ``_discard_on_close`` removed the
``Subscriber`` from ``self.clients`` and cleared presence, but
did NOT cancel the Task.  If tornado did not translate the FIN
to a prompt ``StreamClosedError`` (observed on real 3008.x
minions), the Task stayed pending in ``asyncio.all_tasks()``
forever, pinning the ``Unpacker`` buffer, the ``client``, and
the ``IOStream`` graph.

Tracemalloc on a live 3008.x minion under a 132-job / 5-min
mixed load: +140 pinned ``Subscriber`` and +140 pinned
``Unpacker`` instances (~142 MiB retention).

Fix: ``handle_stream`` and ``_validate_ssl_and_add_client`` now
store the ``_stream_read`` Task on ``Subscriber._read_task``;
``_discard_on_close`` cancels that Task (idempotent) and calls
``client.cl

**File**: `changelog/70175.fixed.md` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Wrap fire-and-forget ``MinionEvent`` callers in ``salt.modules.event.fire_master`` and ``salt.modules.mine._mine_send`` with ``with`` blocks so the ``PublishServer`` / ``_TCPPubServerPublisher`` / ``SyncWrapper`` triad is torn down synchronously instead of leaking one bundle per invocation onto the minion event bus.
\ No newline at end of file
+Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_async`` path did, so non-SIGTERM shutdown paths triggered the three-warning cascade in issue #70175. ``PublishServer.close`` also now calls ``pub.close()`` on every ``_TCPPubServerPublisher`` cached in ``_async_pub_by_loop`` (previously it closed the underlying stream only, leaving ``_closing = False`` and letting the publisher's ``__del__`` emit the "unclosed publisher client" warning at GC). ``PubServer._discard_on_close`` now cancels the pending ``_stream_read`` Task and force-closes the Subscriber so the coroutine frame (with its 1 MiB msgpack Unpacker buffer) is released the moment a subscriber disconnects, closing the per-job leak path on the steady-state per-job path. Fire-and-forget ``MinionEvent`` callers in ``salt.modules.event.fire_master`` and ``salt.modules.mine._mine_send`` are now wrapped in ``with`` blocks so the ``PublishServer`` / ``_TCPPubServerPublisher`` / ``SyncWrapper`` triad is torn down synchronously instead of leaking one bundle per invocation onto the minion event bus.
```

**File**: `salt/transport/tcp.py` (modified, +49/-2)
```diff
@@ -1340,6 +1340,11 @@ def __init__(self, stream, address):
         self.address = address
         self._closing = False
         self._read_until_future = None
+        # ``PubServer.handle_stream`` assigns the ``_stream_read`` Task
+        # here so ``PubServer._discard_on_close`` can cancel it on stream
+        # close.  Cancelling releases the coroutine frame that pins the
+        # per-connection 1 MiB msgpack ``Unpacker`` buffer.
+        self._read_task = None
         self.id_ = None
 
     def close(self):
@@ -1474,9 +1479,43 @@ def _discard_on_close(self, client):
         ``EventPublisher`` process observed over 24 h uptime.  This
         matches the ``discard_after_closed`` callback the 3006.x
         ``IPCMessagePublisher`` installed.
+
+        Presence/set removal alone is not enough on the per-job path.
+        ``_stream_read`` was scheduled as an asyncio ``Task`` at
+        connection accept time and awaits ``stream.read_bytes(...)``.
+        The task pins its coroutine frame -> the local ``unpacker``
+        (a msgpack ``Unpacker`` with a 1 MiB internal buffer) and the
+        ``client`` local, even after the ``Subscriber`` is dropped from
+        ``self.clients``.  Tracemalloc on a live 3008.x minion under
+        132-job / 5-min load showed +140 pinned ``Subscriber`` and +140
+        pinned ``Unpacker`` instances (~142 MiB RSS retention) -- the
+        objects were only GC'd on eventual very-delayed StreamClosedError,
+        or never at all if the FIN did not translate promptly.  Fix:
+        cancel the read task and force-close the client stream from the
+        close callback.  Both are idempotent.
         """
 
         def _cb():
+            # Cancel the pending _stream_read task first so any awaiting
+            # read_bytes raises CancelledError promptly and the
+            # coroutine frame (with its 1 MiB Unpacker) is released
+            # regardless of whether client.close() succeeds in
+            # translating the FIN to a StreamClosedError.
+            read_task = getattr(client, "_read_task", None)
+            if read_task is not None and not read_task.done():
+                read_task.cancel()
+            # Force-close the stream/Subscriber -- belt AND suspenders.
+            # Subscriber.close() is idempotent and consumes the read
+            # future's exception to avoid the "Future exception was
+            # never retrieved" warning.
+            try:
+                client.close()
+            except Exception:  # pylint: disable=broad-except
+                log.debug(
+                    "Ignoring error closing subscriber %r on stream close",
+                    client,
+                    exc_info=True,
+                )
             self.remove_presence_callback(client)
             self.clients.discard(client)
 
@@ -1538,7 +1577,12 @@ def handle_stream(self, stream, address):
         client = Subscriber(stream, address)
         self.clients.add(client)
         stream.set_close_callback(self._discard_on_close(client))
-        self.io_loop.create_task(self._stream_read(client))
+        # Store the Task on the Subscriber so ``_discard_on_close`` can
+        # cancel it -- otherwise the coroutine frame retains its
+        # ``unpacker`` (1 MiB Unpacker buffer) and ``client`` locals
+        # for the lifetime of the ioloop's task set even after the
+        # Subscriber is dropped from ``self.clients``.
+        client._read_task = self.io_loop.create_task(self._stream_read(client))
 
     def _apply_write_buffer_cap(self, stream):
         """
@@ -1580,7 +1624,10 @@ async def _validate_ssl_and_add_client(self, stream, address):
                 client = Subscriber(stream, address)
                 self.clients.add(client)
                 stream.set_close_callback(self._discard_on_close(client))
-                self.io_loop.create_task(self._stream_read(client))
+                # Store the Task on the Subscriber so ``_discard_on_close``
+ 
```

**File**: `tests/pytests/unit/transport/test_tcp.py` (modified, +136/-0)
```diff
@@ -2212,6 +2212,142 @@ def test_tcp_pub_server_publisher_accepts_max_write_buffer_size():
     assert pub_zero.max_write_buffer_size is None
 
 
+async def test_pub_server_discard_on_close_cancels_read_task(master_opts):
+    """
+    Regression for the per-job PubServer leak observed on 3008.x:
+    tracemalloc on a live minion under 132-job / 5-min mixed load
+    showed +140 pinned ``Subscriber`` and +140 pinned msgpack
+    ``Unpacker`` instances (~142 MiB RSS retention) traceable to
+    ``PubServer.handle_stream`` / ``_stream_read``.
+
+    Root cause: ``_stream_read`` was scheduled as an asyncio Task at
+    accept time and awaited ``stream.read_bytes(...)``.  When the peer
+    closed the connection, ``_discard_on_close`` removed the
+    ``Subscriber`` from ``self.clients`` but did NOT cancel the Task.
+    The Task's coroutine frame retained a local 1 MiB ``Unpacker``
+    buffer and the ``client`` local for the lifetime of the ioloop's
+    task set, until the ``read_bytes`` future eventually resolved
+    with ``StreamClosedError`` -- which was arbitrarily delayed (or
+    never fired) on FIN paths that did not translate promptly to a
+    tornado StreamClosedError.
+
+    Companion fix to PR #70206 (which handled the SHUTDOWN path for
+    the same #70175 symptom).  This test drives the STEADY-STATE
+    per-job path: N ``Subscriber``\\s are registered with a stream
+    whose ``read_bytes`` future NEVER completes (the pathological
+    case, since a completed read is the "easy" path already handled
+    by ``_stream_read``'s ``StreamClosedError`` branch); the test
+    then fires the ``stream.set_close_callback`` thunk (as tornado
+    would when the FIN callback dispatches) and asserts every
+    ``_stream_read`` Task has been cancelled and the client set has
+    drained.  Fails on unpatched 3008.x -- the tasks stay pending
+    and pin the coroutine frame with its 1 MiB Unpacker local.
+    """
+
+    loop = asyncio.get_running_loop()
+    pub_server = salt.transport.tcp.PubServer(master_opts, io_loop=loop)
+    baseline_tasks = asyncio.all_tasks(loop)
+
+    class _NeverCompletingStream:
+        """
+        A minimal fake ``tornado.iostream.IOStream`` whose
+        ``read_bytes`` returns a Future that never resolves -- the
+        pathological "peer FIN not translated to StreamClosedError"
+        state seen in production tracemalloc snapshots.
+        """
+
+        def __init__(self):
+            self._closing = False
+            self._close_callback = None
+
+        def read_bytes(self, *args, **kwargs):
+            # Never-resolving future.  Any real read would either
+            # yield bytes (happy path) or raise StreamClosedError
+            # (already handled) -- neither of which reproduces the
+            # observed leak.
+            return loop.create_future()
+
+        def set_close_callback(self, cb):
+            self._close_callback = cb
+
+        def close(self):
+            self._closing = True
+            if self._close_callback is not None:
+                cb, self._close_callback = self._close_callback, None
+                cb()
+
+        def closed(self):
+            return self._closing
+
+    subscribers = []
+    for _ in range(50):
+        stream = _NeverCompletingStream()
+        client = salt.transport.tcp.Subscriber(stream, "127.0.0.1")
+        pub_server.clients.add(client)
+        stream.set_close_callback(pub_server._discard_on_close(client))
+        client._read_task = loop.create_task(pub_server._stream_read(client))
+        subscribers.append((client, stream))
+
+    # Yield so the newly-scheduled ``_stream_read`` tasks reach their
+    # first ``await read_bytes(...)`` and park.
+    await asyncio.sleep(0)
+
+    # Sanity: all N Subscribers registered, all N read Tasks pending.
+    assert len(pub_server.clients) == 50
+    pending_before = [
+        c._read_task
+        for (c, _) in subscribers
+        if c._read_task is not None and not c._r
```

---

### Incident Patch 8: `b5f43ae7` (2026-09-10)
**Commit Message**: Merge pull request #70258 from dwoz/dwoz/fix/70175-saltevent-caller-close

Wrap fire-and-forget MinionEvent callers to close SaltEvent chain (#7…

**File**: `changelog/70175.fixed.md` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_async`` path did, so non-SIGTERM shutdown paths triggered the three-warning cascade in issue #70175. ``PublishServer.close`` also now calls ``pub.close()`` on every ``_TCPPubServerPublisher`` cached in ``_async_pub_by_loop`` (previously it closed the underlying stream only, leaving ``_closing = False`` and letting the publisher's ``__del__`` emit the "unclosed publisher client" warning at GC).
+Wrap fire-and-forget ``MinionEvent`` callers in ``salt.modules.event.fire_master`` and ``salt.modules.mine._mine_send`` with ``with`` blocks so the ``PublishServer`` / ``_TCPPubServerPublisher`` / ``SyncWrapper`` triad is torn down synchronously instead of leaking one bundle per invocation onto the minion event bus.
\ No newline at end of file
```

**File**: `salt/modules/event.py` (modified, +15/-4)
```diff
@@ -85,10 +85,21 @@ def fire_master(data, tag, preload=None):
         # Usually, we can send the event via the minion, which is faster
         # because it is already authenticated
         try:
-            return salt.utils.event.MinionEvent(__opts__, listen=False).fire_event(
-                {"data": data, "tag": tag, "events": None, "pretag": None},
-                "fire_master",
-            )
+            # Use MinionEvent as a context manager so its subscriber /
+            # pusher / SyncWrapper chain is closed synchronously on the
+            # way out.  Previous ``MinionEvent(...).fire_event(...)``
+            # left the temporary event object unreferenced and reliant
+            # on GC to run ``__del__`` -- each per-job invocation from
+            # returners / callers leaked one ``PublishServer`` +
+            # ``_TCPPubServerPublisher`` + ``SyncWrapper`` bundle onto
+            # the minion event bus, surfacing as the ``unclosed publish
+            # server`` / ``unclosed publisher client`` / ``unclosed
+            # SyncWrapper`` triad flagged by issue #70175.
+            with salt.utils.event.MinionEvent(__opts__, listen=False) as evt:
+                return evt.fire_event(
+                    {"data": data, "tag": tag, "events": None, "pretag": None},
+                    "fire_master",
+                )
         except Exception:  # pylint: disable=broad-except
             exc_type, exc_value, exc_traceback = sys.exc_info()
             lines = traceback.format_exception(exc_type, exc_value, exc_traceback)
```

**File**: `salt/modules/mine.py` (modified, +13/-6)
```diff
@@ -58,12 +58,19 @@ def _mine_function_available(func):
 
 
 def _mine_send(load, opts):
-    eventer = salt.utils.event.MinionEvent(opts, listen=False)
-    event_ret = eventer.fire_event(load, "_minion_mine")
-    # We need to pause here to allow for the decoupled nature of
-    # events time to allow the mine to propagate
-    time.sleep(0.5)
-    return event_ret
+    # Use MinionEvent as a context manager so its subscriber / pusher /
+    # SyncWrapper chain is torn down synchronously.  Prior fire-and-forget
+    # form (``MinionEvent(...); .fire_event(...); return``) left the
+    # temporary event bundle unreferenced and reliant on GC to invoke
+    # ``__del__``; each per-mine-tick invocation leaked one
+    # ``PublishServer`` + ``_TCPPubServerPublisher`` + ``SyncWrapper``
+    # onto the minion event bus (issue #70175's per-job triad).
+    with salt.utils.event.MinionEvent(opts, listen=False) as eventer:
+        event_ret = eventer.fire_event(load, "_minion_mine")
+        # We need to pause here to allow for the decoupled nature of
+        # events time to allow the mine to propagate
+        time.sleep(0.5)
+        return event_ret
 
 
 def _mine_get(load, opts):
```

**File**: `tests/pytests/unit/modules/test_event.py` (modified, +88/-0)
```diff
@@ -4,6 +4,9 @@
     Test cases for salt.modules.event
 """
 
+import gc
+import warnings
+
 import pytest
 
 import salt.modules.event as event
@@ -92,3 +95,88 @@ def test_send_use_master_when_local_true():
         with patch_master_opts, patch_file_client, patch_send:
             assert event.send("tag") == "B"
             patch_send.assert_called_once()
+
+
+def test_fire_master_context_managed_no_unclosed_warnings(tmp_path):
+    """
+    Regression test for issue #70175.
+
+    ``salt.modules.event.fire_master`` used to construct a temporary
+    ``MinionEvent`` in an expression, call ``.fire_event()`` on it, and
+    return the result -- e.g.::
+
+        return salt.utils.event.MinionEvent(__opts__, listen=False).fire_event(...)
+
+    That fire-and-forget form left the ``MinionEvent`` unreferenced and
+    reliant on GC to invoke ``__del__`` (see ``SaltEvent.__del__`` in
+    ``salt/utils/event.py``).  Each per-job call therefore emitted one
+    three-warning triad from the underlying transport chain when the
+    finalizer eventually ran:
+
+        - ``unclosed publish server <PublishServer ...>``
+        - ``unclosed publisher client <_TCPPubServerPublisher ...>``
+        - ``unclosed SyncWrapper for cls=<class '..._TCPPubServerPublisher'>``
+
+    On a 3008.x minion under mixed-job load this surfaced as ~3 warnings
+    per job (issue #70175 reports 646 warnings across ~200 jobs -- the
+    file descriptors backing each unclosed publisher pinned an
+    ``PublishServer`` graph until GC ran).
+
+    The fix wraps the ``MinionEvent`` in a ``with`` block so
+    ``__exit__`` -> ``destroy()`` -> ``close_pub()`` / ``close_pull()``
+    tears down the ``SyncWrapper`` -> ``_TCPPubServerPublisher`` chain
+    synchronously.
+
+    Pre-patch failure mode against N=50 iterations::
+
+        AssertionError: fire_master leaked 143 unclosed-resource warnings
+        across 50 iterations (expected 0).  Sample warnings:
+          - unclosed publisher client <_TCPPubServerPublisher ...>
+          - unclosed publish server <PublishServer ...>
+          - unclosed SyncWrapper for cls=<class '..._TCPPubServerPublisher'>
+
+    Post-patch: 0 warnings.
+    """
+    tmp_sock = tmp_path / "sock"
+    tmp_sock.mkdir()
+    opts = {
+        "id": "test-minion",
+        "sock_dir": str(tmp_sock),
+        "transport": "tcp",
+        "ipc_mode": "ipc",
+        "hash_type": "sha256",
+        "acceptance_wait_time": 0,
+        "acceptance_wait_time_max": 0,
+        "loop_interval": 60,
+        "local": False,
+        "use_master_when_local": False,
+        "max_event_size": 1048576,
+    }
+
+    triad_markers = (
+        "unclosed publish server",
+        "unclosed publisher client",
+        "unclosed SyncWrapper",
+    )
+    n_iterations = 50
+    with patch.dict(event.__opts__, opts):
+        with warnings.catch_warnings(record=True) as caught:
+            warnings.simplefilter("always", ResourceWarning)
+            warnings.simplefilter("always")
+            for i in range(n_iterations):
+                event.fire_master({"i": i}, f"test/tag/{i}")
+            # Force any deferred ``__del__`` runs.
+            gc.collect()
+            gc.collect()
+
+        leaked = [
+            str(record.message)
+            for record in caught
+            if any(marker in str(record.message) for marker in triad_markers)
+        ]
+
+    assert not leaked, (
+        f"fire_master leaked {len(leaked)} unclosed-resource warnings "
+        f"across {n_iterations} iterations (expected 0).  Sample warnings:\n"
+        + "\n".join(f"  - {msg[:160]}" for msg in leaked[:6])
+    )
```

---

### Incident Patch 9: `21f90c85` (2026-09-10)
**Commit Message**: Merge branch '3008.x' into dwoz/fix/70175-saltevent-caller-close

**File**: `changelog/70175.fixed.md` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Wrap fire-and-forget ``MinionEvent`` callers in ``salt.modules.event.fire_master`` and ``salt.modules.mine._mine_send`` with ``with`` blocks so the ``PublishServer`` / ``_TCPPubServerPublisher`` / ``SyncWrapper`` triad is torn down synchronously instead of leaking one bundle per invocation onto the minion event bus.
+Wrap fire-and-forget ``MinionEvent`` callers in ``salt.modules.event.fire_master`` and ``salt.modules.mine._mine_send`` with ``with`` blocks so the ``PublishServer`` / ``_TCPPubServerPublisher`` / ``SyncWrapper`` triad is torn down synchronously instead of leaking one bundle per invocation onto the minion event bus.
\ No newline at end of file
```

**File**: `changelog/70226.fixed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Stopped proxy minions logging ``Error during asyncio shutdown: The future belongs to a different loop than the one specified as the loop argument`` on Python 3.14. ``asyncio.gather`` takes no ``loop`` argument any more and resolves the loop from the calling context, but ``SyncWrapper.close()`` runs outside the loop it is tearing down, so gathering that loop's pending tasks was rejected and they were never drained.
```

**File**: `changelog/70250.fixed.md` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+Extend the ``whitelist_modules`` two-loader model to Salt-internal
+subsystems -- beacons, engines, mine, schedule, and the sys.doc
+error-path lookups on caller / minion / metaproxy -- so shipped
+beacons (``salt.beacons.status``, ``.sh``, ``.load``), engines
+(``salt.engines.slack``, ``.webhook``, ``.sqs``), and scheduler
+bookkeeping (``timezone.get_offset``, ``config.merge``, internal
+``__mine_interval`` / ``__master_alive_*`` jobs) compose with their
+helper execution modules regardless of ``whitelist_modules``.
+User-configured scheduled jobs, beacon overrides, and wire dispatch
+stay on the outer whitelist-filtered loader.  Also mirror the
+``pillar_refresh`` rebind into the inner loader's ``pack["__pillar__"]``
+so ``config.merge`` dispatched through the inner loader sees the
+freshly compiled pillar and pillar-injected beacons actually
+activate on refresh.
```

**File**: `changelog/70251.fixed.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+Add a 5-second timeout to the ``lspci`` shell-out in the GPU grain
+collector so a hung ``lspci`` (e.g. in a container without a live PCI
+bus) can no longer leak orphan child processes on every grains
+refresh. On timeout the grain returns empty (matching the
+``lspci``-not-found path) and logs a warning.
```

**File**: `salt/cli/caller.py` (modified, +9/-1)
```diff
@@ -132,7 +132,15 @@ def call(self):
             salt.minion.get_proc_dir(self.opts["cachedir"]), ret["jid"]
         )
         if fun not in self.minion.functions:
-            docs = self.minion.functions["sys.doc"](f"{fun}*")
+            # Error-path documentation lookup: route through the unfiltered
+            # inner loader so ``sys.doc`` still resolves under a strict
+            # ``whitelist_modules`` that omits ``sys``.  The user-facing
+            # membership check above stays on the wire-filtered loader.
+            _sys_loader = (
+                getattr(self.minion.functions, "_dunder_salt", None)
+                or self.minion.functions
+            )
+            docs = _sys_loader["sys.doc"](f"{fun}*")
             if docs:
                 docs[fun] = self.minion.functions.missing_fun_string(fun)
                 ret["out"] = "nested"
```

---

### Incident Patch 10: `adbbb907` (2026-09-01)
**Commit Message**: Fix unclosed PublishServer / _TCPPubServerPublisher leak on minion shutdown

MinionManager.destroy() (invoked from cli.daemons.Minion.shutdown on
KeyboardInterrupt / SaltSystemExit / early-exit and from __del__ on GC)
was missing the close/destroy chain for the local event_publisher
PublishServer graph and the event SaltEvent that MinionManager._bind
creates. Only the SIGTERM stop_async path closed them, so any
non-SIGTERM shutdown leaked the graph and surfaced the three-warning
cascade reported in #70175 (unclosed publish server / SyncWrapper /
publisher client).

**File**: `changelog/70175.fixed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_async`` path did, so non-SIGTERM shutdown paths triggered the three-warning cascade in issue #70175.
```

**File**: `salt/minion.py` (modified, +27/-0)
```diff
@@ -1559,6 +1559,33 @@ def destroy(self):
                 if hasattr(minion, "destroy"):
                     minion.destroy()
             self.minions = []
+        # Close the local event publisher and event bus.  ``stop_async``
+        # (invoked from the SIGTERM signal handler) already does this,
+        # but ``destroy`` is *also* reached from
+        # ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt / SaltSystemExit
+        # / early-exit ``shutdown(1)`` guards) and from ``__del__`` on GC.
+        # Without this the ``PublishServer`` graph created in ``_bind``
+        # (``event_publisher`` -> ``pub_sock`` SyncWrapper ->
+        # ``_TCPPubServerPublisher``) leaks at process exit, surfacing as
+        # the three-warning cascade in issue #70175.
+        if getattr(self, "event_publisher", None) is not None:
+            try:
+                self.event_publisher.close()
+            except Exception:  # pylint: disable=broad-except
+                log.debug(
+                    "Error closing event_publisher during MinionManager.destroy",
+                    exc_info=True,
+                )
+            self.event_publisher = None
+        if getattr(self, "event", None) is not None:
+            try:
+                self.event.destroy()
+            except Exception:  # pylint: disable=broad-except
+                log.debug(
+                    "Error destroying event during MinionManager.destroy",
+                    exc_info=True,
+                )
+            self.event = None
 
     def _create_minion_object(
         self,
```

**File**: `tests/pytests/unit/test_minion.py` (modified, +50/-0)
```diff
@@ -2045,6 +2045,56 @@ async def test_minion_manager_async_stop(io_loop, minion_opts, tmp_path):
     assert mm.event is None
 
 
+async def test_minion_manager_destroy_closes_event_publisher(
+    io_loop, minion_opts, tmp_path
+):
+    """
+    Regression test for issue #70175.
+
+    ``MinionManager.destroy()`` is invoked from
+    ``cli.daemons.Minion.shutdown()`` (KeyboardInterrupt, SaltSystemExit,
+    the ``shutdown(1)`` guard in ``prepare()``) and from
+    ``MinionManager.__del__`` on GC.  It must close the ``event_publisher``
+    ``PublishServer`` graph -- otherwise the three-warning cascade
+    from #70175 fires at interpreter shutdown:
+
+      - ``unclosed publish server <PublishServer>``
+      - ``unclosed SyncWrapper for cls=<_TCPPubServerPublisher>``
+      - ``unclosed publisher client <_TCPPubServerPublisher>``
+
+    Only the ``stop_async`` shutdown path (invoked from the SIGTERM
+    signal handler) used to close these; ``destroy()`` did not, so any
+    non-SIGTERM exit leaked them.
+    """
+    minion_opts["sock_dir"] = str(tmp_path / "sock")
+    os.makedirs(minion_opts["sock_dir"])
+
+    mm = salt.minion.MinionManager(minion_opts)
+    mm._bind()
+    assert mm.event_publisher is not None
+    assert mm.event is not None
+
+    # Wait for pub server to bind so the underlying PublishServer graph
+    # is fully constructed.
+    while not list(pathlib.Path(minion_opts["sock_dir"]).glob("*")):
+        await tornado.gen.sleep(0.1)
+
+    ep = mm.event_publisher
+    ev = mm.event
+
+    # Call destroy directly (the buggy path).  Post-fix it must close
+    # both resources and null the references.
+    mm.destroy()
+
+    assert mm.event_publisher is None
+    assert mm.event is None
+    # PublishServer.close() sets _closing=True so __del__ won't warn.
+    assert ep._closing is True
+    # SaltEvent.destroy() closes pusher / subscriber and clears them.
+    assert ev.subscriber is None
+    assert ev.pusher is None
+
+
 def test_minion_io_loop_is_asyncio_loop(minion_opts):
     """
     Test that Minion io_loop is converted to asyncio.AbstractEventLoop.
```

#### Recent Merged Pull Requests:
- **PR #70339** (2026-09-30): build-packages: pick signing key by inputs.environment (@dwoz)
- **PR #70337** (2026-09-30): Merge forward 3007.x into 3008.x (@dwoz)
- **PR #70336** (2026-09-30): Merge forward 3006.x into 3007.x (@dwoz)
- **PR #70335** (2026-09-30): Bump relenv to 0.22.27 (@dwoz)
- **PR #70334** (2026-09-29): Update bootstrap script to v2026.09.28 (@twangboy)
- **PR #70324** (2026-09-30): tests/stress: fix two 3008.x branch-build flakes (@dwoz)
- **PR #70322** (2026-09-25): [wip] close async audit 3008.x (@dwoz)
- **PR #70316** (2026-09-24): transport/zeromq + channel + minion: async close for req channel reconnect (@dwoz)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
