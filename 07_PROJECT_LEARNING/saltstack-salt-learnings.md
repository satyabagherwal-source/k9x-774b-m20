# Forensic Learning Record (Deep Inspection): saltstack/salt

> **Canonical Artifact**: `07_PROJECT_LEARNING/saltstack-salt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/saltstack/salt](https://github.com/saltstack/salt))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:56:40.679Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `saltstack/salt`
- **Description**: Software to automate the management and configuration of infrastructure and applications at scale.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml
- **Stars / Engagement**: 15692 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `salt/client/ssh/state.py`
```
"""
Create ssh executor system
"""

import logging
import os
import shutil
import tarfile
import tempfile
from contextlib import closing

import salt.client.ssh
import salt.client.ssh.shell
import salt.loader
import salt.minion
import salt.roster
import salt.state
import salt.utils.files
import salt.utils.json
import salt.utils.path
import salt.utils.stringutils
import salt.utils.thin
import salt.utils.url
import salt.utils.verify

log = logging.getLogger(__name__)


class SSHState(salt.state.State):
    """
    Create a State object which wraps the SSH functions for state operations
    """

    def __init__(
        self,
        opts,
        pillar_override=None,
        wrapper=None,
        context=None,
        initial_pillar=None,
    ):
        self.wrapper = wrapper
        self.context = context
        # ``opts`` is the per-minion opts package returned by
        # ``test.opts_pkg`` running inside salt-thin on the target. Its
        # ``cachedir`` is rooted under the on-target ``thin_dir`` (e.g.
        # ``/var/tmp/.root_XXXXX_salt/running_data/var/cache/salt``).
        # The state runs on the master, so the state fileclient and the
        # jinja loader search path
        # (``opts['cachedir']/files/<saltenv>``) need to be anchored
        # under the configured master ``cachedir`` instead. See #68458.
        if wrapper is not None and getattr(wrapper, "fsclient", None) is not None:
            opts["cachedir"] = wrapper.fsclient.opts["cachedir"]
        super().__init__(opts, pillar_override, initial_pillar=initial_pillar)

    def load_modules(self, data=None, proxy=None):
        """
        Load up the modules for remote compilation via ssh
        """
        self.functions = self.wrapper
        # Salt-SSH runs execution modules on the target via ``self.wrapper``
        # (a :class:`salt.client.ssh.FunctionWrapper`), which has no
        # two-loader model -- there is no ``_dunder_salt`` inner loader to
        # fall back to.  ``State`` machinery (global state conditions,
        # requisite/aggregate composition, ``saltutil.refresh_modules``,
        # ``event.fire_master``, ``test.sleep`` in the retry loop) reads
        # from ``self._trusted_functions``; mirror the wrapper so those
        # trusted internal call sites keep working.  Matches
        # :meth:`MasterState.load_modules`.
        self._trusted_functions = self.functions
        self.utils = salt.loader.utils(self.opts)
        self.serializers = salt.loader.serializers(self.opts)
        locals_ = salt.loader.minion_mods(self.opts, utils=self.utils)
        self.states = salt.loader.states(
            self.opts, locals_, self.utils, self.serializers
        )
        self.rend = salt.loader.render(self.opts, self.functions)

    def _gather_pillar(self):
        """
        The opts used during pillar rendering should contain the master
        opts in the root namespace. self.opts is the modified minion opts,
        containing the original master opts in __master_opts__.
        """
        _opts = self.opts
        popts = {}
        # Pillar compilation needs the master opts primarily,
        # same as during regular operation.
        popts.update(_opts)
        popts.update(_opts.get("__master_opts__", {}))
        # But, salt.state.State takes the parameters for get_pillar from
        # the opts, so we need to ensure they are correct for the minion.
        popts["id"] = _opts["id"]
        popts["saltenv"] = _opts["saltenv"]
        popts["pillarenv"] = _opts.get("pillarenv")
        self.opts = popts
        pillar = super()._gather_pillar()
        self.opts = _opts
        return pillar

    def check_refresh(self, data, ret):
        """
        Stub out check_refresh
        """
        return

    def module_refresh(self):
        """
        Module refresh is not needed, stub it out
        """
        return


class SSHHighState(salt.state.BaseHighState):
    """
    Used to compile the highstate on the master
    """

    stack = []

    def __init__(
        self,
        opts,
        pillar_override=None,
        wrapper=None,
        fsclient=None,
        context=None,
        initial_pillar=None,
    ):
        self.client = fsclient
        # ``opts`` is the per-minion opts package; its ``cachedir`` is a
        # thin_dir-relative path on the target. The highstate runs on the
        # master, so anchor ``opts['cachedir']`` under the master
        # ``cachedir`` (taken from the master-side fileclient) so master
        # fileserver caching and jinja template resolution don't write to
        # the minion's thin_dir path on the master filesystem. See
        # #68458.
        if fsclient is not None and getattr(fsclient, "opts", None) is not None:
            opts["cachedir"] = fsclient.opts["cachedir"]
        salt.state.BaseHighState.__init__(self, opts)
        self.state = SSHState(
            opts,
            pillar_override,
            wrapper,
            context=context,
            initial_pillar=initial_pillar,
        )
        self.matchers = salt.loader.matchers(self.opts)

        self._pydsl_all_decls = {}
        self._pydsl_render_stack = []

    def push_active(self):
        salt.state.HighState.stack.append(self)

    def load_dynamic(self, matches):
        """
        Stub out load_dynamic
        """
        return

    def _master_tops(self):
        """
        Evaluate master_tops locally
        """
        return self._local_master_tops()

    def destroy(self):
        if self.client:
            self.client.destroy()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.destroy()


def lowstate_file_refs(chunks, extras=""):
    """
    Create a list of file ref objects to reconcile
    """
    refs = {}
    for chunk in chunks:
        if not isinstance(chunk, dict):
            continue
        saltenv = "base"
        crefs = []
        for state in chunk:
            if state == "__env__":
                saltenv = chunk[state]
            elif state.startswith("__"):
                continue
            crefs.extend(salt_refs(chunk[state]))
        if saltenv not in refs:
            refs[saltenv] = []
        if crefs:
            refs[saltenv].append(crefs)
    if extras:
        extra_refs = extras.split(",")
        if extra_refs:
            for env in refs:
                for x in extra_refs:
                    refs[env].append([x])
    return refs


def salt_refs(data, ret=None):
    """
    Pull salt file references out of the states
    """
    proto = "salt://"
    if ret is None:
        ret = []
    if isinstance(data, str):
        if data.startswith(proto) and data not in ret:
            ret.append(data)
    if isinstance(data, list):
        for comp in data:
            salt_refs(comp, ret)
    if isinstance(data, dict):
        for comp in data:
            salt_refs(data[comp], ret)
    return ret


def prep_trans_tar(
    file_client, chunks, file_refs, pillar=None, id_=None, roster_grains=None
):
    """
    Generate the execution package from the saltenv file refs and a low state
    data structure
    """
    gendir = tempfile.mkdtemp()
    trans_tar = salt.utils.files.mkstemp()
    lowfn = os.path.join(gendir, "lowstate.json")
    pillarfn = os.path.join(gendir, "pillar.json")
    roster_grainsfn = os.path.join(gendir, "roster_grains.json")
    sync_refs = [
        [salt.utils.url.create("_modules")],
        [salt.utils.url.create("_states")],
        [salt.utils.url.create("_grains")],
        [salt.utils.url.create("_renderers")],
        [salt.utils.url.create("_returners")],
        [salt.utils.url.create("_output")],
        [salt.utils.url.create("_utils")],
    ]
    with salt.utils.files.fopen(lowfn, "w+") as fp_:
        salt.utils.json.dump(chunks, fp_)
    if pillar:
        with salt.utils.files.fopen(pillarfn, "w+") as fp_:
            salt.utils.json.dump(pillar, fp_)
    if roster_grains:
        with salt.utils.files.fopen(roster_grainsfn, "w+") as fp_:
            salt.utils.json.dump(roster_grains, fp_)

    if id_ is None:
        id_ = ""
    try:
        cachedir = os.path.join("salt-ssh", id_).rstrip(os.sep)
    except AttributeError:
        # Minion ID should always be a str, but don't let an int break this
        cachedir = os.path.join("salt-ssh", str(id_)).rstrip(os.sep)

    for saltenv in file_refs:
        # Location where files in this saltenv will be cached
        cache_dest_root = os.path.join(cachedir, "files", saltenv)
        file_refs[saltenv].extend(sync_refs)
        env_root = os.path.join(gendir, saltenv)
        if not os.path.isdir(env_root):
            os.makedirs(env_root)
        for ref in file_refs[saltenv]:
            for name in ref:
                short = salt.utils.url.parse(name)[0].lstrip("/")
                cache_dest = os.path.join(cache_dest_root, short)
                try:
                    path = file_client.cache_file(name, saltenv, cachedir=cachedir)
                except OSError:
                    path = ""
                if path:
                    tgt = os.path.join(env_root, short)
                    tgt_dir = os.path.dirname(tgt)
                    if not os.path.isdir(tgt_dir):
                        os.makedirs(tgt_dir)
                    shutil.copy(path, tgt)
                    continue
                try:
                    files = file_client.cache_dir(name, saltenv, cachedir=cachedir)
                except OSError:
                    files = ""
                if files:
                    for filename in files:
                        fn = filename[
                            len(file_client.get_cachedir(cache_dest)) :
                        ].strip("/")
                        tgt = os.path.join(env_root, short, fn)
                        tgt_dir = os.path.dirname(tgt)
                        if not os.path.isdir(tgt_dir):
                            os.makedirs(tgt_dir)
                     
```

### Core Architecture Module: `salt/client/ssh/wrapper/slsutil.py`
```
import os.path
import posixpath

import salt.exceptions
import salt.loader
import salt.template
import salt.utils.args
import salt.utils.dictupdate
import salt.utils.stringio
from salt.client.ssh.wrapper.state import _merge_extra_filerefs

CONTEXT_BASE = "slsutil"


def update(dest, upd, recursive_update=True, merge_lists=False):
    """
    Merge ``upd`` recursively into ``dest``

    If ``merge_lists=True``, will aggregate list object types instead of
    replacing. This behavior is only activated when ``recursive_update=True``.

    CLI Example:

    .. code-block:: shell

        salt '*' slsutil.update '{foo: Foo}' '{bar: Bar}'

    """
    return salt.utils.dictupdate.update(dest, upd, recursive_update, merge_lists)


def merge(obj_a, obj_b, strategy="smart", renderer="yaml", merge_lists=False):
    """
    Merge a data structure into another by choosing a merge strategy

    Strategies:

    * aggregate
    * list
    * overwrite
    * recurse
    * smart

    CLI Example:

    .. code-block:: shell

        salt '*' slsutil.merge '{foo: Foo}' '{bar: Bar}'
    """
    return salt.utils.dictupdate.merge(obj_a, obj_b, strategy, renderer, merge_lists)


def merge_all(lst, strategy="smart", renderer="yaml", merge_lists=False):
    """
    .. versionadded:: 2019.2.0

    Merge a list of objects into each other in order

    :type lst: Iterable
    :param lst: List of objects to be merged.

    :type strategy: String
    :param strategy: Merge strategy. See utils.dictupdate.

    :type renderer: String
    :param renderer:
        Renderer type. Used to determine strategy when strategy is 'smart'.

    :type merge_lists: Bool
    :param merge_lists: Defines whether to merge embedded object lists.

    CLI Example:

    .. code-block:: shell

        $ salt-call --output=txt slsutil.merge_all '[{foo: Foo}, {foo: Bar}]'
        local: {u'foo': u'Bar'}
    """

    ret = {}
    for obj in lst:
        ret = salt.utils.dictupdate.merge(ret, obj, strategy, renderer, merge_lists)

    return ret


def renderer(path=None, string=None, default_renderer="jinja|yaml", **kwargs):
    """
    Parse a string or file through Salt's renderer system

    .. versionchanged:: 2018.3.0
       Add support for Salt fileserver URIs.

    This is an open-ended function and can be used for a variety of tasks. It
    makes use of Salt's "renderer pipes" system to run a string or file through
    a pipe of any of the loaded renderer modules.

    :param path: The path to a file on Salt's fileserver (any URIs supported by
        :py:func:`cp.get_url <salt.modules.cp.get_url>`) or on the local file
        system.
    :param string: An inline string to be used as the file to send through the
        renderer system. Note, not all renderer modules can work with strings;
        the 'py' renderer requires a file, for example.
    :param default_renderer: The renderer pipe to send the file through; this
        is overridden by a "she-bang" at the top of the file.
    :param kwargs: Keyword args to pass to Salt's compile_template() function.

    Keep in mind the goal of each renderer when choosing a render-pipe; for
    example, the Jinja renderer processes a text file and produces a string,
    however the YAML renderer processes a text file and produces a data
    structure.

    One possible use is to allow writing "map files", as are commonly seen in
    Salt formulas, but without tying the renderer of the map file to the
    renderer used in the other sls files. In other words, a map file could use
    the Python renderer and still be included and used by an sls file that uses
    the default 'jinja|yaml' renderer.

    For example, the two following map files produce identical results but one
    is written using the normal 'jinja|yaml' and the other is using 'py':

    .. code-block:: jinja

        #!jinja|yaml
        {% set apache = salt['grains.filter_by']({
            ...normal jinja map file here...
        }, merge=salt.pillar.get('apache:lookup')) %}
        {{ apache | yaml() }}

    .. code-block:: python

        #!py
        def run():
            apache = __salt__.grains.filter_by({
                ...normal map here but as a python dict...
            }, merge=__salt__.pillar.get('apache:lookup'))
            return apache

    Regardless of which of the above map files is used, it can be accessed from
    any other sls file by calling this function. The following is a usage
    example in Jinja:

    .. code-block:: jinja

        {% set apache = salt['slsutil.renderer']('map.sls') %}

    CLI Example:

    .. code-block:: bash

        salt '*' slsutil.renderer salt://path/to/file
        salt '*' slsutil.renderer /path/to/file
        salt '*' slsutil.renderer /path/to/file.jinja default_renderer='jinja'
        salt '*' slsutil.renderer /path/to/file.sls default_renderer='jinja|yaml'
        salt '*' slsutil.renderer string='Inline template! {{ saltenv }}'
        salt '*' slsutil.renderer string='Hello, {{ name }}.' name='world'
    """
    if not path and not string:
        raise salt.exceptions.SaltInvocationError("Must pass either path or string")

    # Use the same FSClient as cp/get_url so Jinja SaltCacheLoader reads the
    # cache paths ssh cp.cache_file populates (loader.render defaults to no client).
    renderers = salt.loader.render(
        __opts__, __salt__, file_client=__context__.get("fileclient")
    )
    # Falsy saltenv (e.g. None injected on salt-ssh) makes Jinja use
    # FileSystemLoader on the temp copy only, so imports like map.jinja fail.
    saltenv = kwargs.get("saltenv") or "base"

    if path:
        # salt-ssh does not ship the whole fileserver tree; Jinja ``import`` /
        # ``from`` targets must be present on the target like ``state.*`` runs
        # (``lowstate_file_refs`` + ``extra_filerefs``). Honor the same
        # ``--extra-filerefs`` / ``__opts__`` / ``cp.cache_file`` context keys by
        # caching each ref before rendering (see ssh ``state`` wrapper).
        extra_filerefs = _merge_extra_filerefs(
            kwargs.get("extra_filerefs") or "",
            __opts__.get("extra_filerefs") or "",
            __context__.get("_cp_extra_filerefs") or "",
        )
        if extra_filerefs:
            for ref in extra_filerefs.split(","):
                ref = ref.strip()
                if ref:
                    __salt__["cp.cache_file"](ref, saltenv=saltenv)
        path_or_string = __context__["fileclient"].get_url(path, "", saltenv=saltenv)
    elif string:
        path_or_string = ":string:"
        kwargs["input_data"] = string

    compile_kwargs = dict(kwargs)
    compile_kwargs.pop("extra_filerefs", None)
    compile_kwargs["saltenv"] = saltenv
    ret = salt.template.compile_template(
        path_or_string,
        renderers,
        default_renderer,
        __opts__["renderer_blacklist"],
        __opts__["renderer_whitelist"],
        **compile_kwargs,
    )
    return ret.read() if salt.utils.stringio.is_readable(ret) else ret


def _get_serialize_fn(serializer, fn_name):
    serializers = salt.loader.serializers(__opts__)
    fns = getattr(serializers, serializer, None)
    fn = getattr(fns, fn_name, None)

    if not fns:
        raise salt.exceptions.CommandExecutionError(
            f"Serializer '{serializer}' not found."
        )

    if not fn:
        raise salt.exceptions.CommandExecutionError(
            f"Serializer '{serializer}' does not implement {fn_name}."
        )

    return fn


def serialize(serializer, obj, **mod_kwargs):
    """
    Serialize a Python object using one of the available
    :ref:`all-salt.serializers`.

    CLI Example:

    .. code-block:: bash

        salt '*' --no-parse=obj slsutil.serialize 'json' obj="{'foo': 'Foo!'}

    Jinja Example:

    .. code-block:: jinja

        {% set json_string = salt['slsutil.serialize']('json',
            {'foo': 'Foo!'}) %}
    """
    kwargs = salt.utils.args.clean_kwargs(**mod_kwargs)
    return _get_serialize_fn(serializer, "serialize")(obj, **kwargs)


def deserialize(serializer, stream_or_string, **mod_kwargs):
    """
    Deserialize a Python object using one of the available
    :ref:`all-salt.serializers`.

    CLI Example:

    .. code-block:: bash

        salt '*' slsutil.deserialize 'json' '{"foo": "Foo!"}'
        salt '*' --no-parse=stream_or_string slsutil.deserialize 'json' \\
            stream_or_string='{"foo": "Foo!"}'

    Jinja Example:

    .. code-block:: jinja

        {% set python_object = salt['slsutil.deserialize']('json',
            '{"foo": "Foo!"}') %}
    """
    kwargs = salt.utils.args.clean_kwargs(**mod_kwargs)
    return _get_serialize_fn(serializer, "deserialize")(stream_or_string, **kwargs)


def boolstr(value, true="true", false="false"):
    """
    Convert a boolean value into a string. This function is
    intended to be used from within file templates to provide
    an easy way to take boolean values stored in Pillars or
    Grains, and write them out in the appropriate syntax for
    a particular file template.

    :param value: The boolean value to be converted
    :param true: The value to return if ``value`` is ``True``
    :param false: The value to return if ``value`` is ``False``

    In this example, a pillar named ``smtp:encrypted`` stores a boolean
    value, but the template that uses that value needs ``yes`` or ``no``
    to be written, based on the boolean value.

    *Note: this is written on two lines for clarity. The same result
    could be achieved in one line.*

    .. code-block:: jinja

        {% set encrypted = salt[pillar.get]('smtp:encrypted', false) %}
        use_tls: {{ salt['slsutil.boolstr'](encrypted, 'yes', 'no') }}

    Result (assuming the value is ``True``):

    .. code-block:: none

        use_tls: yes

    """

    if value:
        return true

    return false


def _set_context(keys, function, fun_args=None, fun_kwargs=None, force=False):
    """
    Convenience function to set a v
```

### Core Architecture Module: `salt/client/ssh/wrapper/state.py`
```
"""
Create ssh executor system
"""

import logging
import os
import time

import salt.client.ssh.shell
import salt.client.ssh.state
import salt.defaults.exitcodes
import salt.loader
import salt.minion
import salt.roster
import salt.state
import salt.utils.args
import salt.utils.data
import salt.utils.files
import salt.utils.hashutils
import salt.utils.jid
import salt.utils.json
import salt.utils.platform
import salt.utils.state
import salt.utils.thin
from salt.exceptions import SaltInvocationError

__func_alias__ = {"apply_": "apply"}
log = logging.getLogger(__name__)


def _set_grains_shared():
    """
    Set grains on __opts__ in a way that's visible to all loaders.

    If __opts__ is an OptsDict, use set_shared() to set grains on the root
    so all children/loaders can see it. Otherwise, use direct assignment.
    """
    grains = __grains__.value() if hasattr(__grains__, "value") else __grains__
    if hasattr(__opts__, "set_shared"):
        __opts__.set_shared("grains", grains)
    else:
        __opts__["grains"] = grains


def _ssh_state(chunks, st_kwargs, kwargs, pillar, test=False):
    """
    Function to run a state with the given chunk via salt-ssh
    """
    file_refs = salt.client.ssh.state.lowstate_file_refs(
        chunks,
        _merge_extra_filerefs(
            kwargs.get("extra_filerefs", ""),
            __opts__.get("extra_filerefs", ""),
            __context__.get("_cp_extra_filerefs", ""),
        ),
    )
    # Create the tar containing the state pkg and relevant files.
    trans_tar = salt.client.ssh.state.prep_trans_tar(
        __context__["fileclient"],
        chunks,
        file_refs,
        pillar,
        st_kwargs["id_"],
    )
    trans_tar_sum = salt.utils.hashutils.get_hash(trans_tar, __opts__["hash_type"])
    cmd = "state.pkg {}/salt_state.tgz test={} pkg_sum={} hash_type={}".format(
        __opts__["thin_dir"], test, trans_tar_sum, __opts__["hash_type"]
    )
    single = salt.client.ssh.Single(
        __opts__,
        cmd,
        fsclient=__context__["fileclient"],
        minion_opts=__salt__.minion_opts,
        **st_kwargs,
    )
    single.shell.send(trans_tar, "{}/salt_state.tgz".format(__opts__["thin_dir"]))
    stdout, stderr, retcode = single.cmd_block()

    # Clean up our tar
    try:
        os.remove(trans_tar)
    except OSError:
        pass

    return {"local": salt.client.ssh.wrapper.parse_ret(stdout, stderr, retcode)}


def _check_pillar(kwargs, pillar=None):
    """
    Check the pillar for errors, refuse to run the state if there are errors
    in the pillar and return the pillar errors
    """
    if kwargs.get("force"):
        return True
    pillar_dict = pillar if pillar is not None else __pillar__.value()
    if "_errors" in pillar_dict:
        return False
    return True


def _wait(jid):
    """
    Wait for all previously started state jobs to finish running
    """
    if jid is None:
        jid = salt.utils.jid.gen_jid(__opts__)
    states = _prior_running_states(jid)
    while states:
        time.sleep(1)
        states = _prior_running_states(jid)


def _merge_extra_filerefs(*args):
    """
    Takes a list of filerefs and returns a merged list
    """
    ret = []
    for arg in args:
        if isinstance(arg, str):
            if arg:
                ret.extend(arg.split(","))
        elif isinstance(arg, list):
            if arg:
                ret.extend(arg)
    return ",".join(ret)


def _cleanup_slsmod_low_data(low_data):
    """
    Set "slsmod" keys to None to make
    low_data JSON serializable
    """
    for i in low_data:
        if "slsmod" in i:
            i["slsmod"] = None


def _cleanup_slsmod_high_data(high_data):
    """
    Set "slsmod" keys to None to make
    high_data JSON serializable
    """
    for i in high_data.values():
        if "stateconf" in i:
            stateconf_data = i["stateconf"][1]
            if "slsmod" in stateconf_data:
                stateconf_data["slsmod"] = None


def _parse_mods(mods):
    """
    Parse modules.
    """
    if isinstance(mods, str):
        mods = [item.strip() for item in mods.split(",") if item.strip()]

    return mods


def sls(mods, saltenv="base", test=None, exclude=None, **kwargs):
    """
    Create the seed file for a state.sls run
    """
    st_kwargs = __salt__.kwargs
    _set_grains_shared()
    opts = salt.utils.state.get_sls_opts(__opts__, **kwargs)
    opts["test"] = _get_test_value(test, **kwargs)
    initial_pillar = _get_initial_pillar(opts)
    pillar_override = kwargs.get("pillar")
    with salt.client.ssh.state.SSHHighState(
        opts,
        pillar_override,
        __salt__.value(),
        __context__["fileclient"],
        context=__context__.value(),
        initial_pillar=initial_pillar,
    ) as st_:
        if not _check_pillar(kwargs, st_.opts["pillar"]):
            __context__["retcode"] = salt.defaults.exitcodes.EX_PILLAR_FAILURE
            err = ["Pillar failed to render with the following messages:"]
            err += st_.opts["pillar"]["_errors"]
            return err
        try:
            pillar = st_.opts["pillar"].value()
        except AttributeError:
            pillar = st_.opts["pillar"]
        if pillar_override is not None or initial_pillar is None:
            # Ensure other wrappers use the correct pillar
            __pillar__.update(pillar)
        st_.push_active()
        mods = _parse_mods(mods)
        high_data, errors = st_.render_highstate(
            {saltenv: mods}, context=__context__.value()
        )
        if exclude:
            if isinstance(exclude, str):
                exclude = exclude.split(",")
            if "__exclude__" in high_data:
                high_data["__exclude__"].extend(exclude)
            else:
                high_data["__exclude__"] = exclude
        high_data, ext_errors = st_.state.reconcile_extend(high_data)
        errors += ext_errors
        errors += st_.state.verify_high(high_data)
        if errors:
            __context__["retcode"] = salt.defaults.exitcodes.EX_STATE_COMPILER_ERROR
            return errors
        high_data, req_in_errors = st_.state.requisite_in(high_data)
        errors += req_in_errors
        high_data = st_.state.apply_exclude(high_data)
        # Verify that the high data is structurally sound
        if errors:
            __context__["retcode"] = salt.defaults.exitcodes.EX_STATE_COMPILER_ERROR
            return errors
        # Compile and verify the raw chunks
        chunks, errors = st_.state.compile_high_data(high_data)
        if errors:
            __context__["retcode"] = salt.defaults.exitcodes.EX_STATE_COMPILER_ERROR
            return errors
        file_refs = salt.client.ssh.state.lowstate_file_refs(
            chunks,
            _merge_extra_filerefs(
                kwargs.get("extra_filerefs", ""),
                opts.get("extra_filerefs", ""),
                __context__.get("_cp_extra_filerefs", ""),
            ),
        )

        roster = salt.roster.Roster(opts, opts.get("roster", "flat"))
        roster_grains = roster.opts["grains"]

        # Create the tar containing the state pkg and relevant files.
        _cleanup_slsmod_low_data(chunks)
        trans_tar = salt.client.ssh.state.prep_trans_tar(
            __context__["fileclient"],
            chunks,
            file_refs,
            pillar,
            st_kwargs["id_"],
            roster_grains,
        )
        trans_tar_sum = salt.utils.hashutils.get_hash(trans_tar, opts["hash_type"])
        cmd = "state.pkg {}/salt_state.tgz test={} pkg_sum={} hash_type={}".format(
            opts["thin_dir"], test, trans_tar_sum, opts["hash_type"]
        )
        single = salt.client.ssh.Single(
            opts,
            cmd,
            fsclient=__context__["fileclient"],
            minion_opts=__salt__.minion_opts,
            **st_kwargs,
        )
        single.shell.send(trans_tar, "{}/salt_state.tgz".format(opts["thin_dir"]))
        stdout, stderr, retcode = single.cmd_block()

        # Clean up our tar
        try:
            os.remove(trans_tar)
        except OSError:
            pass

        return {"local": salt.client.ssh.wrapper.parse_ret(stdout, stderr, retcode)}


def running(concurrent=False):
    """
    Return a list of strings that contain state return data if a state function
    is already running. This function is used to prevent multiple state calls
    from being run at the same time.

    CLI Example:

    .. code-block:: bash

        salt '*' state.running
    """
    ret = []
    if concurrent:
        return ret
    active = __salt__["saltutil.is_running"]("state.*")
    for data in active:
        err = (
            'The function "{}" is running as PID {} and was started at {} '
            "with jid {}".format(
                data["fun"],
                data["pid"],
                salt.utils.jid.jid_to_time(data["jid"]),
                data["jid"],
            )
        )
        ret.append(err)
    return ret


def _prior_running_states(jid):
    """
    Return a list of dicts of prior calls to state functions.  This function is
    used to queue state calls so only one is run at a time.
    """

    ret = []
    active = __salt__["saltutil.is_running"]("state.*")
    for data in active:
        try:
            data_jid = int(data["jid"])
        except ValueError:
            continue
        if data_jid < int(jid):
            ret.append(data)
    return ret


def _check_queue(queue, kwargs):
    """
    Utility function to queue the state run if requested
    and to check for conflicts in currently running states
    """
    if queue:
        _wait(kwargs.get("__pub_jid"))
    else:
        conflict = running(concurrent=kwargs.get("concurrent", False))
        if conflict:
            __context__["retcode"] = salt.defaults.exitcodes.EX_STATE_COMPILER_ERROR
            return conflict


def _get_initial_pillar(opts):
    return __pillar__.value() if opts["pillarenv"] == __opts__["pi
```

### Core Architecture Module: `salt/cluster/consensus/raft/util.py`
```
"""
Small helpers for the Raft package (random election jitter, optional socket
checks, dynamic class loading).
"""

import functools
import logging
import random
import socket
import string

log = logging.getLogger(__name__)


def log_generator(size=6, chars=string.ascii_uppercase + string.digits):
    """Generate a random string of specified size."""
    return "".join(random.choice(chars) for _ in range(size))


def gettimeout(_min, _max):
    """Return a random timeout in seconds within the specified millisecond range."""
    return random.randint(_min, _max) * 0.001


def is_socket_closed(sock: socket.socket) -> bool:
    """Check non-blockingly if a TCP socket has been closed by the peer."""
    try:
        # this will try to read bytes without blocking and also without removing them from buffer (peek only)
        data = sock.recv(16, socket.MSG_DONTWAIT | socket.MSG_PEEK)
        if len(data) == 0:
            log.warning("Empty data")
            return True
    except BlockingIOError:
        return False  # socket is open and reading from it would block
    except ConnectionResetError:
        log.warning("Connection reset")
        return True  # socket was closed for some other reason
    except OSError as exc:
        if exc.errno == 107:  # Transport endpoint is not connected
            log.warning("Endpoint not connected")
            return False
        elif exc.errno == 9:  # Bad File Descriptor
            log.warning("Bad file descripor")
            return True
        log.exception("unexpected exception when checking if a socket is closed")
        return False
    except Exception:  # pylint: disable=broad-except
        log.exception("unexpected exception when checking if a socket is closed")
        return False
    return False


def log_exceptions_async(func):
    """Log unhandled exceptions in asynchronous functions as a decorator."""

    @functools.wraps(func)
    async def wrapped(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except Exception:
            log.exception("Unhandled exception in %r", func)
            raise

    return wrapped


def log_exceptions(func):
    """Log unhandled exceptions in synchronous functions as a decorator."""

    @functools.wraps(func)
    def wrapped(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception:
            log.exception("Unhandled exception in %r", func)
            raise

    return wrapped


def load_class(path):
    """
    Dynamically load a class from a string path.

    Example: ``salt.cluster.consensus.raft.log.CounterStateMachine``.
    """
    import importlib

    try:
        module_path, class_name = path.rsplit(".", 1)
        module = importlib.import_module(module_path)
        return getattr(module, class_name)
    except (ImportError, AttributeError, ValueError) as e:
        raise ImportError(f"Failed to load class from {path}: {e}")

```

### Core Architecture Module: `salt/cluster/state_sync.py`
```
"""
Paged bulk state-sync for cluster joiners.

The cluster join handshake (``cluster/peer/join`` ->
``cluster/peer/join-reply``) carries the cluster's identity material
(``cluster_aes``, ``cluster.pem``, peer pubs), but the joining master
also needs the *content* the cluster has accumulated: accepted /
denied minion keys, the file_roots tree, and the pillar_roots tree.
That content can run from a few KB on a fresh cluster to tens of MB
on a production deployment with thousands of minions and a large
SLS tree.

To keep the join-reply itself small and to give the joiner partial-
progress + per-channel failure isolation, the state-sync runs on
*four independent streams*, each chunked by its own budget:

==============  ==================  =======================
channel         chunked by          per-chunk budget
==============  ==================  =======================
``keys``        entry count         ``DEFAULT_KEY_CHUNK_COUNT``
``denied_keys`` entry count         ``DEFAULT_KEY_CHUNK_COUNT``
``file_roots``  cumulative bytes    ``DEFAULT_ROOTS_CHUNK_BYTES``
``pillar_roots`` cumulative bytes   ``DEFAULT_ROOTS_CHUNK_BYTES``
==============  ==================  =======================

Wire format
-----------
The responder allocates a session id, names it in the join-reply's
``state_sync_session`` field, then publishes a series of
``cluster/peer/state-sync-chunk`` events to the joiner.  Each event
payload is a Crypticle-encrypted dict (encrypted under the cluster
session AES key the joiner just received in the same join-reply)::

    {
        "session":  str,            # matches join-reply state_sync_session
        "channel":  str,            # one of ALL_CHANNELS
        "seq":      int,            # 0-indexed sequence within this channel
        "total":    int,            # total chunks for this channel (-1 if unknown)
        "eof":      bool,           # True on the final chunk for this channel
        "items":    list,           # channel-specific entries
    }

A channel with no data still emits one chunk with ``items=[]`` and
``eof=True``, so receivers can use the ``eof`` flag uniformly.

Receiver state machine
----------------------
:class:`StateSyncSession` is held by the joiner's
``MasterPubServerChannel`` and tracks per-channel ``eof`` flags.  The
caller provides an ``on_complete`` callback that fires when all four
channels have either eof'd or the deadline expires (whichever comes
first); the channel server uses that callback to call
``_start_raft_as_learner`` only after bulk sync is at rest.
"""

import logging
import secrets
import time

import salt.cache
import salt.exceptions

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Channel names + chunking knobs
# ---------------------------------------------------------------------------

KEYS_CHANNEL = "keys"
DENIED_CHANNEL = "denied_keys"
FILE_ROOTS_CHANNEL = "file_roots"
PILLAR_ROOTS_CHANNEL = "pillar_roots"

# Channel prefix for arbitrary cache banks (multi-ring migration).  A
# channel string ``"bank:jobs/loads"`` names the cache bank that
# carries the payload; the receiver routes by prefix to
# :func:`install_bank_chunk`.  Used by
# ``cluster.collect_from_peers`` for caches other than the four
# join-time channels above.
BANK_CHANNEL_PREFIX = "bank:"


def bank_channel(bank):
    """Return the wire channel name for *bank*."""
    return f"{BANK_CHANNEL_PREFIX}{bank}"


def bank_from_channel(channel):
    """Return the bank name a ``bank:`` channel was made from, or None."""
    if not channel or not channel.startswith(BANK_CHANNEL_PREFIX):
        return None
    return channel[len(BANK_CHANNEL_PREFIX) :]


ALL_CHANNELS = (
    KEYS_CHANNEL,
    DENIED_CHANNEL,
    FILE_ROOTS_CHANNEL,
    PILLAR_ROOTS_CHANNEL,
)

# Default count per chunk for cache-key channels.  Tuned so a 200-entry
# minion-key chunk (avg pub key ~500 bytes -> ~100 KB) fits comfortably in
# one Crypticle-encrypted message without dominating heartbeat bandwidth.
DEFAULT_KEY_CHUNK_COUNT = 200

# Default per-chunk byte budget for file-tree channels.  1 MB is a
# pragmatic compromise: small enough that a TCP retransmit is cheap, big
# enough that a typical SLS tree fits in a handful of chunks.
DEFAULT_ROOTS_CHUNK_BYTES = 1 * 1024 * 1024

# Default deadline (seconds) the joiner waits for all four channels to
# eof before falling back to event-driven replication.
DEFAULT_RECEIVE_TIMEOUT = 30


def new_session_id():
    """Return a fresh session id (URL-safe, no fixed length)."""
    return secrets.token_urlsafe(16)


# ---------------------------------------------------------------------------
# Sender-side: chunk generators
# ---------------------------------------------------------------------------


def _by_count(items, n):
    """Yield successive lists of *items* of size up to *n*."""
    chunk = []
    for item in items:
        chunk.append(item)
        if len(chunk) >= n:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


def iter_keys_chunks(opts, channel, count=DEFAULT_KEY_CHUNK_COUNT, key_filter=None):
    """
    Yield ``items`` lists for the ``keys`` or ``denied_keys`` channel.

    Each item is ``{"id": minion_id, "value": cache_value}`` — a
    self-contained record the receiver hands straight to ``cache.store``.

    A bank with no entries (or whose entries are all filtered out) still
    yields one empty list so the caller can emit a single eof chunk.

    :param key_filter: Optional ``callable(minion_id) -> bool``.  When
                       present, only entries whose id passes the
                       filter are emitted.  Used by the multi-ring
                       ``cluster.collect_from_peers`` runner so a peer
                       only sends back the keys the requester asked
                       for, rather than its entire bank.
    """
    if channel not in (KEYS_CHANNEL, DENIED_CHANNEL):
        raise ValueError(f"iter_keys_chunks: unsupported channel {channel!r}")
    cache = salt.cache.Cache(opts, driver=opts["keys.cache_driver"])
    try:
        dump = cache.list_all(channel, include_data=True)
    except (AttributeError, salt.exceptions.SaltCacheError):
        dump = {}
    pairs = list((dump or {}).items())
    if key_filter is not None:
        pairs = [(mid, value) for mid, value in pairs if key_filter(mid)]
    items = [{"id": mid, "value": value} for mid, value in pairs]
    if not items:
        yield []
        return
    yield from _by_count(items, count)


def iter_root_chunks(roots_map, byte_budget=DEFAULT_ROOTS_CHUNK_BYTES):
    """
    Yield ``items`` lists for the ``file_roots`` / ``pillar_roots`` channel.

    Each item is ``{"env": str, "path": str, "mode": int, "data": bytes}``
    — flattened across envs so the receiver can apply each entry without
    needing to track env boundaries within a chunk.

    Chunks are bounded by *byte_budget*: a chunk is closed when adding
    the next entry would exceed the budget *and* the chunk already holds
    at least one entry.  A single file larger than the budget gets its
    own chunk on its own.

    An empty / missing roots map yields one empty list so the caller can
    emit a single eof chunk.
    """
    # Lazy import to avoid a circular dependency at module load.
    from salt.cluster.file_sync import (  # pylint: disable=import-outside-toplevel
        collect_root_tree,
    )

    dump = collect_root_tree(roots_map)
    if not dump:
        yield []
        return

    chunk = []
    chunk_bytes = 0
    for env, files in dump.items():
        for entry in files:
            entry_bytes = len(entry.get("data") or b"")
            if chunk and chunk_bytes + entry_bytes > byte_budget:
                yield chunk
                chunk = []
                chunk_bytes = 0
            chunk.append(
                {
                    "env": env,
                    "path": entry["path"],
                    "mode": entry.get("mode", 0o644),
                    "data": entry["data"],
                }
            )
            chunk_bytes += entry_bytes
    if chunk:
        yield chunk


def iter_bank_chunks(opts, bank, count=DEFAULT_KEY_CHUNK_COUNT, key_filter=None):
    """
    Yield ``items`` lists for an arbitrary :class:`salt.cache.Cache`
    bank.

    Each item is ``{"key": str, "value": any}`` — the bank name is
    carried separately in the wire channel
    (``BANK_CHANNEL_PREFIX + bank``) so a single channel maps to a
    single bank on the receiver.

    Used by :func:`salt.runners.cluster.collect_from_peers` to pull
    arbitrary operator-routed caches (e.g. the salt_cache returner's
    ``jobs/loads``) from peers.  Mirrors :func:`iter_keys_chunks`'s
    contract: an empty bank still yields a single empty list so the
    eof flag fires uniformly.
    """
    cache_driver = opts.get("cache") or opts.get("keys.cache_driver")
    cache = salt.cache.Cache(opts, driver=cache_driver)
    pairs = []
    try:
        # Prefer the bulk list_all interface — drivers that implement
        # it avoid the N+1 fetch.
        dump = cache.list_all(bank, include_data=True)
        pairs = list((dump or {}).items())
    except (AttributeError, salt.exceptions.SaltCacheError):
        # Fallback for drivers that don't expose list_all (e.g.
        # custom plugin caches).
        try:
            for key in cache.list(bank):
                value = cache.fetch(bank, key)
                pairs.append((key, value))
        except salt.exceptions.SaltCacheError:
            pairs = []
    if key_filter is not None:
        pairs = [(k, v) for k, v in pairs if key_filter(k)]
    items = [{"key": k, "value": v} for k, v in pairs]
    if not items:
        yield []
        return
    yield from _by_count(items, count)


# ---------------------------------------------------------------------------
# Receiver-side: install one chunk
# ---------------------------------------------------------
```

### Core Architecture Module: `salt/config/worker_pools.py`
```
"""
Default worker-pool configuration and validation for the Salt master.

Worker pools partition the master's MWorkers into named groups and route
specific commands to specific groups, so a slow workload cannot starve
time-critical traffic (for example ``_auth``).  See the
:ref:`tunable worker pools <tunable-worker-pools>` topic guide for the
user-facing overview.

This module contains three things:

* :data:`DEFAULT_WORKER_POOLS`, the configuration used when the operator
  provides no explicit ``worker_pools`` stanza and no ``worker_threads``
  override.
* :func:`validate_worker_pools_config`, called from master configuration
  processing to enforce structural and security invariants before the master
  is allowed to start.
* :func:`get_worker_pools_config`, which resolves the effective pool layout
  from the master opts, handling backward compatibility with
  ``worker_threads`` and the ``worker_pools_enabled=False`` legacy switch.

The pool dictionary shape is::

    {
        "<pool-name>": {
            "worker_count": <int >= 1>,
            "commands": ["<cmd>", ..., "*"?],
        },
        ...
    }

``commands`` entries are either exact command names (for example ``_auth``)
or the catchall marker ``"*"``.  Exactly one pool must use ``"*"``, and no
command may be claimed by more than one pool.
"""

# Default worker pool routing configuration.
#
# Two pools: a single-worker ``auth`` pool that handles minion authentication
# (``_auth``) and a four-worker ``default`` pool that catches everything
# else.  Total worker count matches the long-standing ``worker_threads``
# default of 5, so existing deployments see the same number of MWorker
# processes — the only change is that one of those workers is dedicated to
# auth, so a slow workload (e.g. a slow ext_pillar) cannot starve out
# minion authentication.
#
# The auth pool is sized to one worker on purpose: ``salt.cache.Cache``
# stores minion key state under ``keys/<id>`` and ``denied_keys/<id>``, and
# concurrent auth workers writing the same minion id could race on the
# pending → accepted → denied transitions.  Operators that have audited
# the cache backend for atomic store semantics can raise this.
#
# The master falls back to this value only when the operator sets neither
# ``worker_pools`` nor ``worker_threads``.
DEFAULT_WORKER_POOLS = {
    "auth": {
        "worker_count": 1,
        "commands": ["_auth"],
    },
    "default": {
        "worker_count": 4,
        "commands": ["*"],
    },
}


def validate_worker_pools_config(opts):
    """
    Validate the effective worker-pool configuration at master startup.

    Called during master configuration processing.  Returns ``True`` when
    the configuration is acceptable; raises :class:`ValueError` with a
    consolidated multi-line message listing every problem the validator
    found.  The accumulated reporting style lets operators fix their config
    in a single pass instead of discovering errors one at a time.

    The following invariants are enforced:

    * ``worker_pools`` is a non-empty dictionary.
    * Pool names are non-empty strings, contain no path separators
      (``/`` or ``\\``), do not begin with ``..``, and contain no null
      byte.  These rules exist purely to prevent pool names from being
      abused to steer IPC sockets or logs out of the master's runtime
      directories.
    * Each pool value is a dictionary containing an integer
      ``worker_count >= 1`` and a non-empty list of string ``commands``.
    * No command string is claimed by more than one pool.
    * Exactly one pool uses the ``"*"`` catchall entry so that any
      command not listed explicitly has a well-defined destination.

    When ``worker_pools_enabled`` is ``False`` validation is skipped; the
    master runs in the legacy single-queue MWorker mode where pool routing
    does not apply.

    :param dict opts: The master configuration dictionary.
    :returns: ``True`` when the configuration is valid.
    :raises ValueError: If the configuration is invalid.  The exception
        message lists every detected error.
    """
    if not opts.get("worker_pools_enabled", True):
        # Legacy mode, no validation needed
        return True

    # Get the effective worker pools (handles defaults and backward compat)
    worker_pools = get_worker_pools_config(opts)

    # If pools are disabled, no validation needed
    if worker_pools is None:
        return True

    errors = []

    # 1. Validate pool structure
    if not isinstance(worker_pools, dict):
        errors.append("worker_pools must be a dictionary")
        raise ValueError("\n".join(errors))

    if not worker_pools:
        errors.append("worker_pools cannot be empty")
        raise ValueError("\n".join(errors))

    # 2. Validate each pool
    cmd_to_pool = {}
    catchall_pool = None

    for pool_name, pool_config in worker_pools.items():
        # Validate pool name format (security-focused: block path traversal only)
        if not isinstance(pool_name, str):
            errors.append(f"Pool name must be a string, got {type(pool_name).__name__}")
            continue

        if not pool_name:
            errors.append("Pool name cannot be empty")
            continue

        # Security: block path traversal attempts
        if "/" in pool_name or "\\" in pool_name:
            errors.append(
                f"Pool name '{pool_name}' is invalid. Pool names cannot contain "
                "path separators (/ or \\) to prevent path traversal attacks."
            )
            continue

        # Security: block relative path components
        if (
            pool_name == ".."
            or pool_name.startswith("../")
            or pool_name.startswith("..\\")
        ):
            errors.append(
                f"Pool name '{pool_name}' is invalid. Pool names cannot be or start with "
                "'../' to prevent path traversal attacks."
            )
            continue

        # Security: block null bytes
        if "\x00" in pool_name:
            errors.append("Pool name contains null byte, which is not allowed.")
            continue

        if not isinstance(pool_config, dict):
            errors.append(f"Pool '{pool_name}': configuration must be a dictionary")
            continue

        # Check worker_count
        worker_count = pool_config.get("worker_count")
        if not isinstance(worker_count, int) or worker_count < 1:
            errors.append(
                f"Pool '{pool_name}': worker_count must be integer >= 1, "
                f"got {worker_count}"
            )

        # Check commands list
        commands = pool_config.get("commands", [])
        if not isinstance(commands, list):
            errors.append(f"Pool '{pool_name}': commands must be a list")
            continue

        if not commands:
            errors.append(f"Pool '{pool_name}': commands list cannot be empty")
            continue

        # Check for duplicate command mappings and catchall
        for cmd in commands:
            if not isinstance(cmd, str):
                errors.append(f"Pool '{pool_name}': command '{cmd}' must be a string")
                continue

            if cmd == "*":
                # Found catchall pool
                if catchall_pool is not None:
                    errors.append(
                        f"Multiple pools have catchall ('*'): "
                        f"'{catchall_pool}' and '{pool_name}'. "
                        "Only one pool can use catchall."
                    )
                catchall_pool = pool_name
                continue

            if cmd in cmd_to_pool:
                errors.append(
                    f"Command '{cmd}' mapped to multiple pools: "
                    f"'{cmd_to_pool[cmd]}' and '{pool_name}'"
                )
            else:
                cmd_to_pool[cmd] = pool_name

    # 3. Require exactly one catchall pool
    if catchall_pool is None:
        errors.append(
            "No catchall pool ('*') found. One pool must include '*' in its "
            "commands so every command has a routing destination."
        )

    if errors:
        raise ValueError(
            "Worker pools configuration validation failed:\n  - "
            + "\n  - ".join(errors)
        )

    return True


def get_worker_pools_config(opts):
    """
    Resolve the effective worker-pool configuration from master opts.

    Resolution order, first match wins:

    1. ``worker_pools_enabled`` is ``False`` — returns ``None`` to signal
       the legacy non-pooled code path.
    2. ``worker_pools`` is set and non-empty — returned verbatim.  The
       operator is fully in charge of pool layout.
    3. ``worker_threads`` is set — returns a synthesized single-pool
       configuration whose ``worker_count`` matches ``worker_threads`` and
       whose ``commands`` is the catchall ``["*"]``.  This is the upgrade
       path that keeps pre-3008.0 configurations byte-for-byte compatible.
    4. Neither is set — returns :data:`DEFAULT_WORKER_POOLS`.

    :param dict opts: The master configuration dictionary.
    :returns: The resolved pool layout, or ``None`` when pooling is
        explicitly disabled.
    :rtype: dict or None
    """
    # If pools explicitly disabled, return None (legacy mode)
    if not opts.get("worker_pools_enabled", True):
        return None

    # Check if worker_pools is explicitly configured AND not empty
    if "worker_pools" in opts and opts["worker_pools"]:
        return opts["worker_pools"]

    # Backward compatibility: convert worker_threads to single catchall pool
    if "worker_threads" in opts:
        worker_count = opts["worker_threads"]
        return {
            "default": {
                "worker_count": worker_count,
                "commands": ["*"],
            }
        }

    # Use default configuration
    return DEFAULT_WORKER_POOLS

```

### Core Architecture Module: `salt/engines/__init__.py`
```
"""
Initialize the engines system. This plugin system allows for
complex services to be encapsulated within the salt plugin environment
"""

import logging

import salt
import salt.loader
import salt.utils.platform
import salt.utils.process

log = logging.getLogger(__name__)


def start_engines(opts, proc_mgr, proxy=None):
    """
    Fire up the configured engines!
    """
    utils = salt.loader.utils(opts, proxy=proxy)
    if opts["__role"] == "master":
        runners = salt.loader.runner(opts, utils=utils)
    else:
        runners = []
    funcs = salt.loader.minion_mods(opts, utils=utils, proxy=proxy)
    engines = salt.loader.engines(opts, funcs, runners, utils, proxy=proxy)

    engines_opt = opts.get("engines", [])
    if isinstance(engines_opt, dict):
        engines_opt = [{k: v} for k, v in engines_opt.items()]

    # Function references are not picklable. Spawning platforms, Windows
    # and macOS, need to pickle when spawning, these will need to be recalculated
    # in the spawned child process.
    if salt.utils.platform.spawning_platform():
        runners = None
        utils = None
        funcs = None

    for engine in engines_opt:
        if isinstance(engine, dict):
            engine, engine_opts = next(iter(engine.items()))
        else:
            engine_opts = None
        engine_name = None
        if engine_opts is not None and "engine_module" in engine_opts:
            fun = "{}.start".format(engine_opts["engine_module"])
            engine_name = engine
            del engine_opts["engine_module"]
        else:
            fun = f"{engine}.start"
        if fun in engines:
            start_func = engines[fun]
            if engine_name:
                name = f"Engine({start_func.__module__}, name={engine_name})"
            else:
                name = f"Engine({start_func.__module__})"
            log.info("Starting %s", name)
            proc_mgr.add_process(
                Engine,
                args=(opts, fun, engine_opts, funcs, runners, proxy),
                name=name,
            )


class Engine(salt.utils.process.SignalHandlingProcess):
    """
    Execute the given engine in a new process
    """

    def __init__(self, opts, fun, config, funcs, runners, proxy, **kwargs):
        """
        Set up the process executor
        """
        super().__init__(**kwargs)
        self.opts = opts
        self.config = config
        self.fun = fun
        self.funcs = funcs
        self.runners = runners
        self.proxy = proxy

    def run(self):
        """
        Run the master service!
        """
        self.utils = salt.loader.utils(self.opts, proxy=self.proxy)
        if salt.utils.platform.spawning_platform():
            # Calculate function references since they can't be pickled.
            if self.opts["__role"] == "master":
                self.runners = salt.loader.runner(self.opts, utils=self.utils)
            else:
                self.runners = []
            self.funcs = salt.loader.minion_mods(
                self.opts, utils=self.utils, proxy=self.proxy
            )

        self.engine = salt.loader.engines(
            self.opts, self.funcs, self.runners, self.utils, proxy=self.proxy
        )
        kwargs = self.config or {}

        try:
            self.engine[self.fun](**kwargs)
        except Exception:  # pylint: disable=broad-except
            log.critical(
                "%s could not be started!",
                self.name,
                exc_info=True,
            )

```

### Core Architecture Module: `salt/engines/reactor.py`
```
"""
Setup Reactor

Example Config in Master or Minion config

.. code-block:: yaml

    engines:
      - reactor:
          refresh_interval: 60
          worker_threads: 10
          worker_hwm: 10000

    reactor:
      - 'salt/cloud/*/destroyed':
        - /srv/reactor/destroy/*.sls

"""

import salt.utils.reactor


def start(refresh_interval=None, worker_threads=None, worker_hwm=None):
    if refresh_interval is not None:
        __opts__["reactor_refresh_interval"] = refresh_interval
    if worker_threads is not None:
        __opts__["reactor_worker_threads"] = worker_threads
    if worker_hwm is not None:
        __opts__["reactor_worker_hwm"] = worker_hwm

    salt.utils.reactor.Reactor(__opts__).run()

```

### Core Architecture Module: `salt/engines/script.py`
```
"""
Send events based on a script's stdout

Example Config

.. code-block:: yaml

    engines:
      - script:
          cmd: /some/script.py -a 1 -b 2
          output: json
          interval: 5
          onchange: false

Script engine configs:

cmd
    Script or command to execute

output
    Any available saltstack deserializer

interval
    How often in seconds to execute the command

onchange
    .. versionadded:: 3006.0

    Only fire an event if the tag-specific output changes. Defaults to False.
"""

import logging
import shlex
import subprocess
import time

import salt.loader
import salt.utils.event
import salt.utils.process
from salt.exceptions import CommandExecutionError

log = logging.getLogger(__name__)


def _read_stdout(proc):
    """
    Generator that returns stdout
    """
    yield from iter(proc.stdout.readline, b"")


def _get_serializer(output):
    """
    Helper to return known serializer based on
    pass output argument
    """
    serializers = salt.loader.serializers(__opts__)
    try:
        return getattr(serializers, output)
    except AttributeError:
        raise CommandExecutionError(
            f"Unknown serializer `{output}` found for output option"
        )


def start(cmd, output="json", interval=1, onchange=False):
    """
    Parse stdout of a command and generate an event

    The script engine will scrap stdout of the
    given script and generate an event based on the
    presence of the 'tag' key and its value.

    If there is a data obj available, that will also
    be fired along with the tag.

    Example:

        Given the following json output from a script:

            .. code-block:: json

                { "tag" : "lots/of/tacos",
                "data" : { "toppings" : "cilantro" }
                }

        This will fire the event 'lots/of/tacos'
        on the event bus with the data obj as is.

    :param cmd: The command to execute
    :param output: How to deserialize stdout of the script
    :param interval: How often to execute the script
    :param onchange: Only fire an event if the tag-specific output changes
    """
    try:
        cmd = shlex.split(cmd)
    except AttributeError:
        cmd = shlex.split(str(cmd))
    log.debug("script engine using command %s", cmd)

    serializer = _get_serializer(output)

    if __opts__.get("__role") == "master":
        fire_master = salt.utils.event.get_master_event(
            __opts__, __opts__["sock_dir"]
        ).fire_event
    else:
        fire_master = __salt__["event.send"]

    if onchange:
        events = {}

    while True:
        try:
            proc = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT
            )

            log.debug("Starting script with pid %d", proc.pid)

            for raw_event in _read_stdout(proc):
                log.debug(raw_event)

                event = serializer.deserialize(raw_event)
                tag = event.get("tag", None)
                data = event.get("data", {})

                if data and "id" not in data:
                    data["id"] = __opts__["id"]

                if tag:
                    if onchange and tag in events and events[tag] == data:
                        continue
                    log.info("script engine firing event with tag %s", tag)
                    fire_master(tag=tag, data=data)
                    if onchange:
                        events[tag] = data

            log.debug("Closing script with pid %d", proc.pid)
            proc.stdout.close()
            rc = proc.wait()
            if rc:
                raise subprocess.CalledProcessError(rc, cmd)

        except subprocess.CalledProcessError as e:
            log.error(e)
        finally:
            if proc.poll is None:
                proc.terminate()

        time.sleep(interval)

```

### Core Architecture Module: `salt/engines/thorium.py`
```
"""
Manage the Thorium complex event reaction system
"""

import salt.thorium


def start(grains=False, grain_keys=None, pillar=False, pillar_keys=None):
    """
    Execute the Thorium runtime
    """
    state = salt.thorium.ThorState(__opts__, grains, grain_keys, pillar, pillar_keys)
    state.start_runtime()

```

### Core Architecture Module: `salt/engines/webhook.py`
```
"""
Send events from webhook api
"""

import tornado.httpserver
import tornado.ioloop
import tornado.web

import salt.utils.event


def start(address=None, port=5000, ssl_crt=None, ssl_key=None):
    """
    Api to listen for webhooks to send to the reactor.

    Implement the webhook behavior in an engine.
    :py:class:`rest_cherrypy Webhook docs <salt.netapi.rest_cherrypy.app.Webhook>`

    Unlike the rest_cherrypy Webhook, this is only an unauthenticated webhook
    endpoint.  If an authenticated webhook endpoint is needed, use the salt-api
    webhook which runs on the master and authenticates through eauth.

    .. note: This is really meant to be used on the minion, because salt-api
             needs to be run on the master for use with eauth.

    .. warning:: Unauthenticated endpoint

        This engine sends webhook calls to the event stream.  If the engine is
        running on a minion with `file_client: local` the event is sent to the
        minion event stream.  Otherwise it is sent to the master event stream.

    Example Config

    .. code-block:: yaml

        engines:
          - webhook: {}

    .. code-block:: yaml

        engines:
          - webhook:
              port: 8000
              address: 10.128.1.145
              ssl_crt: /etc/pki/tls/certs/localhost.crt
              ssl_key: /etc/pki/tls/certs/localhost.key

    .. note: For making an unsigned key, use the following command
             `salt-call --local tls.create_self_signed_cert`
    """
    if __opts__.get("__role") == "master":
        fire_master = salt.utils.event.get_master_event(
            __opts__, __opts__["sock_dir"]
        ).fire_event
    else:
        fire_master = None

    def fire(tag, msg):
        """
        How to fire the event
        """
        if fire_master:
            fire_master(msg, tag)
        else:
            __salt__["event.send"](tag, msg)

    class WebHook(tornado.web.RequestHandler):  # pylint: disable=abstract-method
        def post(self, tag):  # pylint: disable=arguments-differ
            body = self.request.body
            headers = self.request.headers
            payload = {
                "headers": headers if isinstance(headers, dict) else dict(headers),
                "body": body,
            }
            fire("salt/engines/hook/" + tag, payload)

    application = tornado.web.Application([(r"/(.*)", WebHook)])
    ssl_options = None
    if all([ssl_crt, ssl_key]):
        ssl_options = {"certfile": ssl_crt, "keyfile": ssl_key}
    io_loop = tornado.ioloop.IOLoop()
    http_server = tornado.httpserver.HTTPServer(application, ssl_options=ssl_options)
    http_server.listen(port, address=address)
    io_loop.start()

```

### Core Architecture Module: `salt/ext/vsan/vsanapiutils.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Copyright 2016 VMware, Inc.  All rights reserved.

This module defines basic helper functions used in the sampe codes
"""

# pylint: skip-file
__author__ = 'VMware, Inc'

from pyVmomi import vim, vmodl, SoapStubAdapter
#import the VSAN API python bindings
import vsanmgmtObjects

VSAN_API_VC_SERVICE_ENDPOINT = '/vsanHealth'
VSAN_API_ESXI_SERVICE_ENDPOINT = '/vsan'

#Constuct a stub for VSAN API access using VC or ESXi sessions from  existing
#stubs. Correspoding VC or ESXi service endpoint is required. VC service
#endpoint is used as default
def _GetVsanStub(
      stub, endpoint=VSAN_API_VC_SERVICE_ENDPOINT,
      context=None, version='vim.version.version10'
   ):

   hostname = stub.host.split(':')[0]
   vsanStub = SoapStubAdapter(
      host=hostname,
      path=endpoint,
      version=version,
      sslContext=context
   )
   vsanStub.cookie = stub.cookie
   return vsanStub

#Construct a stub for access VC side VSAN APIs
def GetVsanVcStub(stub, context=None):
   return _GetVsanStub(stub, endpoint=VSAN_API_VC_SERVICE_ENDPOINT,
                       context=context)

#Construct a stub for access ESXi side VSAN APIs
def GetVsanEsxStub(stub, context=None):
   return _GetVsanStub(stub, endpoint=VSAN_API_ESXI_SERVICE_ENDPOINT,
                       context=context)

#Construct a stub for access ESXi side VSAN APIs
def GetVsanVcMos(vcStub, context=None):
   vsanStub = GetVsanVcStub(vcStub, context)
   vcMos = {
      'vsan-disk-management-system' : vim.cluster.VsanVcDiskManagementSystem(
                                         'vsan-disk-management-system',
                                         vsanStub
                                      ),
      'vsan-stretched-cluster-system' : vim.cluster.VsanVcStretchedClusterSystem(
                                           'vsan-stretched-cluster-system',
                                           vsanStub
                                        ),
      'vsan-cluster-config-system' : vim.cluster.VsanVcClusterConfigSystem(
                                        'vsan-cluster-config-system',
                                        vsanStub
                                     ),
      'vsan-performance-manager' : vim.cluster.VsanPerformanceManager(
                                      'vsan-performance-manager',
                                      vsanStub
                                   ),
      'vsan-cluster-health-system' : vim.cluster.VsanVcClusterHealthSystem(
                                        'vsan-cluster-health-system',
                                        vsanStub
                                     ),
      'vsan-upgrade-systemex' : vim.VsanUpgradeSystemEx(
                                   'vsan-upgrade-systemex',
                                    vsanStub
                                ),
      'vsan-cluster-space-report-system' : vim.cluster.VsanSpaceReportSystem(
                                              'vsan-cluster-space-report-system',
                                              vsanStub
                                           ),

      'vsan-cluster-object-system' : vim.cluster.VsanObjectSystem(
                                        'vsan-cluster-object-system',
                                        vsanStub
                                     ),
   }

   return vcMos

#Construct a stub for access ESXi side VSAN APIs
def GetVsanEsxMos(esxStub, context=None):
   vsanStub = GetVsanEsxStub(esxStub, context)
   esxMos = {
      'vsan-performance-manager' : vim.cluster.VsanPerformanceManager(
                                      'vsan-performance-manager',
                                      vsanStub
                                   ),
      'ha-vsan-health-system' : vim.host.VsanHealthSystem(
                                        'ha-vsan-health-system',
                                        vsanStub
                                     ),
      'vsan-object-system' : vim.cluster.VsanObjectSystem(
                                        'vsan-object-system',
                                        vsanStub
                                     ),
   }

   return esxMos

#Convert a VSAN Task to a Task MO binding to VC service
#@param vsanTask the VSAN Task MO
#@param stub the stub for the VC API
def ConvertVsanTaskToVcTask(vsanTask, vcStub):
  vcTask = vim.Task(vsanTask._moId, vcStub)
  return vcTask

def WaitForTasks(tasks, si):
   """
   Given the service instance si and tasks, it returns after all the
   tasks are complete
   """

   pc = si.content.propertyCollector

   taskList = [str(task) for task in tasks]

   # Create filter
   objSpecs = [vmodl.query.PropertyCollector.ObjectSpec(obj=task)
                                                            for task in tasks]
   propSpec = vmodl.query.PropertyCollector.PropertySpec(type=vim.Task,
                                                         pathSet=[], all=True)
   filterSpec = vmodl.query.PropertyCollector.FilterSpec()
   filterSpec.objectSet = objSpecs
   filterSpec.propSet = [propSpec]
   filter = pc.CreateFilter(filterSpec, True)

   try:
      version, state = None, None

      # Loop looking for updates till the state moves to a completed state.
      while len(taskList):
         update = pc.WaitForUpdates(version)
         for filterSet in update.filterSet:
            for objSet in filterSet.objectSet:
               task = objSet.obj
               for change in objSet.changeSet:
                  if change.name == 'info':
                     state = change.val.state
                  elif change.name == 'info.state':
                     state = change.val
                  else:
                     continue

                  if not str(task) in taskList:
                     continue

                  if state == vim.TaskInfo.State.success:
                     # Remove task from taskList
                     taskList.remove(str(task))
                  elif state == vim.TaskInfo.State.error:
                     raise task.info.error
         # Move to next version
         version = update.version
   finally:
      if filter:
         filter.Destroy()

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

### Incident Patch 2: `00230485` (2026-09-17)
**Commit Message**: build-packages template: disable sign-macos-packages for nightly

Change templates/build-packages.yml.jinja line 38 from hardcoded
`sign-macos-packages: true` to the same per-environment conditional
that sign-windows-packages and the others already use:

    sign-macos-packages: <% if gh_environment == 'nightly' -%> false
                            <%- else -%> ${{ inputs.sign-macos-packages }}
                            <%- endif %>

Nightly builds no longer submit macOS packages to Apple's notary
service. Rationale:

  1. Public salt-nightlies today has `sign-macos-packages: true` in
     the rendered nightly.yml but the MAC_SIGN_APP_SPEC_PWD /
     APPLE_TEAM_ID / APPLE_ACCT secrets are empty at runtime, so the
     notarize step already effectively no-ops there. Setting the
     flag to false makes the workflow file match the effective
     behaviour instead of silently hiding it behind empty secrets.

  2. Salt-priv (private security fork) inherits the same generated
     nightly.yml via forward-merge. Its Apple secrets ARE populated,
     which means the notarize step actually calls Apple's API. Any
     time those creds go stale (as they did today -- 2023-era app-
     spe

**File**: `.github/workflows/nightly.yml` (modified, +2/-2)
```diff
@@ -482,7 +482,7 @@ jobs:
       matrix: ${{ toJSON(fromJSON(needs.prepare-workflow.outputs.config)['build-matrix']) }}
       linux_arm_runner: ${{ fromJSON(needs.prepare-workflow.outputs.config)['linux_arm_runner'] }}
       environment: nightly
-      sign-macos-packages: true
+      sign-macos-packages: false
       sign-rpm-packages: true
       sign-deb-packages: true
       sign-windows-packages: false
@@ -505,7 +505,7 @@ jobs:
       matrix: ${{ toJSON(fromJSON(needs.prepare-workflow.outputs.config)['build-matrix']) }}
       linux_arm_runner: ${{ fromJSON(needs.prepare-workflow.outputs.config)['linux_arm_runner'] }}
       environment: nightly
-      sign-macos-packages: true
+      sign-macos-packages: false
       sign-rpm-packages: true
       sign-deb-packages: true
       sign-windows-packages: false
```

**File**: `.github/workflows/staging.yml` (modified, +2/-2)
```diff
@@ -515,7 +515,7 @@ jobs:
       matrix: ${{ toJSON(fromJSON(needs.prepare-workflow.outputs.config)['build-matrix']) }}
       linux_arm_runner: ${{ fromJSON(needs.prepare-workflow.outputs.config)['linux_arm_runner'] }}
       environment: staging
-      sign-macos-packages: true
+      sign-macos-packages: ${{ inputs.sign-macos-packages }}
       sign-rpm-packages: ${{ inputs.sign-rpm-packages }}
       sign-deb-packages: ${{ inputs.sign-deb-packages }}
       sign-windows-packages: ${{ inputs.sign-windows-packages }}
@@ -538,7 +538,7 @@ jobs:
       matrix: ${{ toJSON(fromJSON(needs.prepare-workflow.outputs.config)['build-matrix']) }}
       linux_arm_runner: ${{ fromJSON(needs.prepare-workflow.outputs.config)['linux_arm_runner'] }}
       environment: staging
-      sign-macos-packages: true
+      sign-macos-packages: ${{ inputs.sign-macos-packages }}
       sign-rpm-packages: ${{ inputs.sign-rpm-packages }}
       sign-deb-packages: ${{ inputs.sign-deb-packages }}
       sign-windows-packages: ${{ inputs.sign-windows-packages }}
```

**File**: `.github/workflows/templates/build-packages.yml.jinja` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@
       linux_arm_runner: ${{ fromJSON(needs.prepare-workflow.outputs.config)['linux_arm_runner'] }}
     <%- if gh_environment != "ci" %>
       environment: <{ gh_environment }>
-      sign-macos-packages: true
+      sign-macos-packages: <% if gh_environment == 'nightly' -%> false <%- else -%> ${{ inputs.sign-macos-packages }} <%- endif %>
       sign-rpm-packages: <% if gh_environment == 'nightly' -%> true <%- else -%> ${{ inputs.sign-rpm-packages }} <%- endif %>
       sign-deb-packages: <% if gh_environment == 'nightly' -%> true <%- else -%> ${{ inputs.sign-deb-packages }} <%- endif %>
       sign-windows-packages: <% if gh_environment == 'nightly' -%> false <%- else -%> ${{ inputs.sign-windows-packages }} <%- endif %>
```

---

### Incident Patch 3: `ceb21079` (2026-09-17)
**Commit Message**: build-packages: rename SIGNING_GPG_KEY -> NIGHTLY_SIGNING_GPG_KEY

Rename the two secrets that build-packages.yml pulls for RPM/DEB
signing:

  SIGNING_GPG_KEY      -> NIGHTLY_SIGNING_GPG_KEY
  SIGNING_PASSPHRASE   -> NIGHTLY_SIGNING_PASSPHRASE

build-packages.yml is a reusable workflow called only from
nightly.yml (release.yml has its own inline signing path that
also references SIGNING_GPG_KEY -- unchanged by this PR). So this
rename separates NIGHTLY signing key material from RELEASE signing
key material at the secret-name level:

  * nightly signing:  NIGHTLY_SIGNING_GPG_KEY / _PASSPHRASE
  * release signing:  SIGNING_GPG_KEY / SIGNING_PASSPHRASE (unchanged)

Motivation. Once a repo (public salt-nightlies, private
salt-priv) does both nightly builds and formal releases, we
don't want a single pair of secrets covering both. Different
threat models, different rotation cadences, and in the private
security flow potentially different keys entirely -- security
nightlies should not be signed with the same key that signs
public release artifacts.

The step-local env variable inside the shell (`SIGNING_GPG_KEY`,
`SIGNING_PASSPHRASE`) is intentionally left as-is -- those are
internal to

**File**: `.github/workflows/build-packages.yml` (modified, +6/-6)
```diff
@@ -27,7 +27,7 @@ on:
       sign-deb-packages:
         type: boolean
         default: false
-        description: Sign DEB Packages (via debsigs, using SIGNING_GPG_KEY)
+        description: Sign DEB Packages (via debsigs, using NIGHTLY_SIGNING_GPG_KEY)
       sign-macos-packages:
         type: boolean
         default: false
@@ -167,8 +167,8 @@ jobs:
       - name: Setup GnuPG
         if: ${{ inputs.sign-deb-packages }}
         env:
-          SIGNING_GPG_KEY: ${{ secrets.SIGNING_GPG_KEY }}
-          SIGNING_PASSPHRASE: ${{ secrets.SIGNING_PASSPHRASE }}
+          SIGNING_GPG_KEY: ${{ secrets.NIGHTLY_SIGNING_GPG_KEY }}
+          SIGNING_PASSPHRASE: ${{ secrets.NIGHTLY_SIGNING_PASSPHRASE }}
         run: |
           install -d -m 0700 -o "$(id -u)" -g "$(id -g)" /run/gpg
           GNUPGHOME="$(mktemp -d -p /run/gpg)"
@@ -299,8 +299,8 @@ jobs:
       - name: Setup GnuPG
         if: ${{ inputs.sign-rpm-packages }}
         env:
-          SIGNING_GPG_KEY: ${{ secrets.SIGNING_GPG_KEY }}
-          SIGNING_PASSPHRASE: ${{ secrets.SIGNING_PASSPHRASE }}
+          SIGNING_GPG_KEY: ${{ secrets.NIGHTLY_SIGNING_GPG_KEY }}
+          SIGNING_PASSPHRASE: ${{ secrets.NIGHTLY_SIGNING_PASSPHRASE }}
         run: |
           install -d -m 0700 -o "$(id -u)" -g "$(id -g)" /run/gpg
           GNUPGHOME="$(mktemp -d -p /run/gpg)"
@@ -317,7 +317,7 @@ jobs:
           # Discover the fingerprint of the just-imported signing key so
           # Build RPM can pass it to rpmsign without hardcoding a specific
           # key id. Lets each repo (saltstack/salt, saltstack/salt-nightlies)
-          # provide its own key material via SIGNING_GPG_KEY and have the
+          # provide its own key material via NIGHTLY_SIGNING_GPG_KEY and have the
           # workflow use whatever's in the resulting keyring.
           SIGN_KEY_ID=$(gpg --list-secret-keys --with-colons | awk -F: '$1=="fpr" {print $10; exit}')
           echo "SIGN_KEY_ID=${SIGN_KEY_ID}" >> "$GITHUB_ENV"
```

---

### Incident Patch 4: `3a42673c` (2026-09-15)
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

### Incident Patch 5: `02ea0489` (2026-09-11)
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
             )
@@ -2767,16 +2816,38 @@ def group_info(name, expand=False, ignore_groups=None, **kwargs):
                         # We've reached the targeted section
                         target_found = True
                     continue
+            # dnf5: the section header carries this section's first member
+            # inline, e.g. "Mandatory packages   : gettext".
+            match_dnf5 = re.match(
+                pkgtypes_capturegroup + r" (?:groups|packages)\s*:\s*(.*?)$",
+                line.lower(),
+            )
+            if match_dnf5:
+                if target_found:
+                    # We've reached a new section, break from loop
+                    break
+                if match_dnf5.group(1) != pkgtype:
+                    continue
+                # We've reached the targeted section
+                target_found = True
+                # Pull the inline first member into its own variable (keeping
+                # the original case) rather than overwriti
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
+        yumpkg.__salt__, {"cmd.run_stdout": MagicMock(return_value=cmd_out)}
+    ):
+        info = yumpkg.group_info("Development Tools")
+    assert info["mandatory"] == ["gettext"]
+    assert info["optional"] == ["cmake"]
+    assert "" not in info["mandatory"]
+    assert "" not in info["optional"]
```

---

### Incident Patch 6: `8f81fb37` (2026-09-11)
**Commit Message**: Merge pull request #70261 from dwoz/dwoz/fix/70175-del-cleanup-safety-net

Restore __del__ safety-net cleanup on SyncWrapper + PublishServer + _…

**File**: `changelog/70175.fixed.md` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_async`` path did, so non-SIGTERM shutdown paths triggered the three-warning cascade in issue #70175. ``PublishServer.close`` also now calls ``pub.close()`` on every ``_TCPPubServerPublisher`` cached in ``_async_pub_by_loop`` (previously it closed the underlying stream only, leaving ``_closing = False`` and letting the publisher's ``__del__`` emit the "unclosed publisher client" warning at GC). ``PubServer._discard_on_close`` now cancels the pending ``_stream_read`` Task and force-closes the Subscriber so the coroutine frame (with its 1 MiB msgpack Unpacker buffer) is released the moment a subscriber disconnects, closing the per-job leak path on the steady-state per-job path. Fire-and-forget ``MinionEvent`` callers in ``salt.modules.event.fire_master`` and ``salt.modules.mine._mine_send`` are now wrapped in ``with`` blocks so the ``PublishServer`` / ``_TCPPubServerPublisher`` / ``SyncWrapper`` triad is torn down synchronously instead of leaking one bundle per invocation onto the minion event bus. ``salt.utils.error.fire_exception`` is also wrapped in a ``with`` block so the temporary ``SaltEvent`` it constructs closes both pusher and subscriber synchronously -- previously the helper (called from ``salt/minion.py:_thread_return`` job-exception path and from ``salt/metaproxy/{proxy,deltaproxy}.py``) dropped the ``SaltEvent`` reference immediately after ``fire_event``, so cleanup ran only when GC invoked ``SaltEvent.__del__`` and each finalization emitted the three-warning triad from the underlying transport chain.
+Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_async`` path did, so non-SIGTERM shutdown paths triggered the three-warning cascade in issue #70175. ``PublishServer.close`` also now calls ``pub.close()`` on every ``_TCPPubServerPublisher`` cached in ``_async_pub_by_loop`` (previously it closed the underlying stream only, leaving ``_closing = False`` and letting the publisher's ``__del__`` emit the "unclosed publisher client" warning at GC). ``PubServer._discard_on_close`` now cancels the pending ``_stream_read`` Task and force-closes the Subscriber so the coroutine frame (with its 1 MiB msgpack Unpacker buffer) is released the moment a subscriber disconnects, closing the per-job leak path on the steady-state per-job path. Fire-and-forget ``MinionEvent`` callers in ``salt.modules.event.fire_master`` and ``salt.modules.mine._mine_send`` are now wrapped in ``with`` blocks so the ``PublishServer`` / ``_TCPPubServerPublisher`` / ``SyncWrapper`` triad is torn down synchronously instead of leaking one bundle per invocation onto the minion event bus. ``salt.utils.error.fire_exception`` is also wrapped in a ``with`` block so the temporary ``SaltEvent`` it constructs closes both pusher and subscriber synchronously -- previously the helper (called from ``salt/minion.py:_thread_return`` job-exception path and from ``salt/metaproxy/{proxy,deltaproxy}.py``) dropped the ``SaltEvent`` reference immediately after ``fire_event``, so cleanup ran only when GC invoked ``SaltEvent.__del__`` and each finalization emitted the three-warning triad from the underlying transport chain. ``salt.utils.asynchronous.SyncWrapper.__del__``, ``salt.transport.tcp.PublishServer.__del__``, and ``salt.transport.tcp._TCPPubServerPublisher.__del__`` also now fall back to ``close()`` as a GC-time safety net -- mirroring the pattern on ``salt.utils.event.SaltEvent.__del__`` -- while still emitting the ``ResourceWarning`` so leaky callers can be surfaced for tracking pre-Potassium. ``salt.transport.tcp.TCPPuller.handle_stream`` also no longer spins the tornado io_loop when a ``ValueError('fd %s added twice')`` (from ``IOLoop.add_handler`` via tornado's ``IOStream._add_io_state``) or ``AssertionError('Already reading')`` (the modern tornado surface for the "prior read still outstanding" state, historically named ``StreamAlreadyReadingError``) is raised inside the reader loop under heavy master/minion connection churn. The historical broad-except swallowed the error and the outer ``while not stream.closed()`` loop immediately re-invoked ``stream.read_bytes`` on the same broken fd, driving the tornado io_loop to 77-119% CPU and growing the log to hundreds of MB in seconds until the CI step timed out (d
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
+            client._read_task = None
 
     def _discard_on_close(self, client):
         """
@@ -1512,6 +1530,13 @@ def _cb():
             read_task = getattr(client, "_read_task", None)
             if read_task is not None and not read_task.done():
                 read_task.cancel()
+            # Drop the back-ref so the ``client -> _read_task -> coroutine
+            # frame -> client`` cycle can be collected immediately without
+            # waiting for cyclic-GC.  The ``try/finally`` inside
+            # ``_stream_read`` also clears this from the coroutine side; do
+            # it here for the case where the coroutine has not yet resumed
+            # to observe the cancellation.
+            client._read_task = None
             # Force-close the stream/Subscriber -- belt AND suspenders.
             # Subscriber.close() is idempotent and consumes the read
             # future's exception to avoid the "Future exception was
@@ -1526,6 +1551,17 @@ def _cb():
                 )
             self.
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
             # io_loop / asyncio_loop; do NOT touch them here (that would
-            # break the parent's transport) and do NOT emit a leak warning
-            # (this wrapper is not our responsibility).  Same rationale as
-            # the transport-class ``__del__`` guards in this PR.
+            # break the parent's transport by closing shared FDs) and do
+            # NOT emit a leak warning (this wrapper is not our
+            # responsibility).  Same rationale as the transport-class
+            # ``__del__`` guards for Subscriber / TCPPuller /
+            # PublishServer / _TCPPubServerPublisher.
             return
         try:
             _obj = self.__dict__.get("obj")
@@ -482,5 +497,15 @@ def __del__(self):
             source=self,
             log=log,
         )
+        try:
+            self.close()
+        except Exception:  # pylint: disable=broad-except
+            # Finalizer must never raise.  ``close()`` is itself heavily
+            # guarded at each step (see the try/excep
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
+    When a caller drops the last reference to a
+    ``_TCPPubServerPublisher`` without invoking ``close()`` first, the
+    ``__del__`` finalizer must both emit the ``ResourceWarning`` and
+    call ``close()`` so ``_closing`` flips True and the underlying
+    ``IOStream`` / socket FD are released rather than lingering as a
+    slow leak.
+    """
+    io_loop = tornado.ioloop.IOLoop()
+    publisher = salt.transport.tcp._TCPPubServerPublisher(
+        host="127.0.0.1", port=4511, path=None, io_loop=io_loop
+    )
+    # Install a fake stream so close() has something observable to
+    # close.  Its ``closed()`` returns False so ``close()`` walks the
+    # stream branch.
+    fake_stream = MagicMock()
+    fake_stream.closed.return_value = False
+    fake_stream.socket = MagicMock()
+    publisher.stream = fake_stream
+    publisher._connecting_future = tornado.concurrent.Future()
+    assert publisher._closing is False
+
+    with warnings.catch_warnings(record=True) as caught:
+        warnings.simplefilte
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
+        # the Task on the subscriber so the ``finally`` clause has
+        # something to clear.
+        subscriber._read_task = io_loop.asyncio_loop.create_task(
+            server._stream_read(subscriber)
+        )
+        task_ref = weakref.ref(subscriber._read_task)
+
+        # Freeze the cyclic collector -- we're specifically asserting
+        # that the fix does not rely on cyclic-GC to release memory.
+        gc.disable()
+        try:
+            # Let the task run.  The _EOFStream raises on the first read
+            # so ``_stream_read`` exits its while loop and runs finally.
+            await subscriber._read_task
+            # One extra turn so any post-return bookkeeping (e.g. Task
+            # ``__del__``) settles.
+            await asyncio.sleep(0)
+
+            assert (
+                subscriber not in server.clients
+            ), "Subscriber not removed from PubServer.clients on stream close"
+            assert subscriber._read_task is None, (
+              
```

**File**: `tests/pytests/unit/utils/test_asynchronous.py` (modified, +106/-0)
```diff
@@ -11,6 +11,8 @@
 """
 
 import asyncio
+import gc
+import warnings
 
 import pytest
 import tornado.gen
@@ -289,3 +291,107 @@ async def _close_from_another_running_loop():
     # cannot be driven to completion here -- a loop cannot be run from inside
     # another running loop -- so their state is not the thing under test.
     assert not errors, errors
+
+
+def test_syncwrapper_del_safety_net_calls_close_70175():
+    """
+    Regression test for the __del__ safety-net cleanup extension of #70175.
+
+    When a caller drops the last reference to a ``SyncWrapper`` without
+    invoking ``close()`` or using it as a context manager, the ``__del__``
+    finalizer must:
+
+    1. Emit the ``ResourceWarning`` so the leaky caller still surfaces for
+       tracking (behavior preserved from the warn-only revision).
+    2. Fall back to ``close()`` so the wrapped ``obj`` is released and the
+       owned ``asyncio.new_event_loop()`` is actually closed -- otherwise
+       every abandoned wrapper leaks a whole IOLoop + ZMQ context +
+       socketpairs, which is the observed ~50 MB/hr RSS growth on the
+       minion.
+    """
+    sync = asynchronous.SyncWrapper(HelperA)
+    asyncio_loop = sync.asyncio_loop
+    assert not asyncio_loop.is_closed()
+    assert sync.obj is not None
+
+    with warnings.catch_warnings(record=True) as caught:
+        warnings.simplefilter("always")
+        del sync
+        gc.collect()
+
+    # 1. ResourceWarning still fires.
+    resource_warnings = [w for w in caught if issubclass(w.category, ResourceWarning)]
+    assert resource_warnings, (
+        "expected ResourceWarning from SyncWrapper.__del__; got "
+        f"{[(w.category, str(w.message)) for w in caught]}"
+    )
+    assert any("unclosed SyncWrapper" in str(w.message) for w in resource_warnings)
+
+    # 2. Safety-net close() ran: the underlying asyncio loop is now closed.
+    #    Without the safety-net, ``asyncio_loop.is_closed()`` stays False
+    #    forever because nothing else has a handle on it -- it leaks as a
+    #    dangling loop object with its selector, kqueue/epoll fd, and any
+    #    tornado bridging state.  ``close()`` is the only place that drives
+    #    ``self.asyncio_loop.close()``.
+    assert (
+        asyncio_loop.is_closed()
+    ), "SyncWrapper.__del__ safety-net did not drive asyncio_loop.close()"
+
+
+def test_syncwrapper_del_forked_child_does_not_touch_parent_resources_70175(
+    monkeypatch,
+):
+    """
+    Regression test for fork-safety of the __del__ safety-net cleanup.
+
+    Reproduces the failure mode observed in
+    tests/pytests/unit/utils/event/test_event.py::test_event_no_timeout:
+    ``EventSender`` forks a child process which inherits the parent's
+    ``MasterEvent`` -> ``SyncWrapper`` -> ``ipc_publish_client`` (which
+    wraps a real socket FD).  When the child exits, GC calls the
+    inherited wrapper's ``__del__``; without the ``_creator_pid`` guard,
+    that ``__del__`` fires ``close()`` on the shared socket FD, breaking
+    the parent's transport (``recv()`` in the parent then blocks forever
+    waiting on an event bus with no live connection).
+
+    Guard contract:
+
+    - ``__init__`` records ``self._creator_pid = os.getpid()``.
+    - ``__del__`` short-circuits (no warn, no close) when
+      ``os.getpid() != self._creator_pid`` -- the parent still owns the
+      wrapped ``obj`` / io_loop / asyncio_loop; the child must NOT
+      ``close()`` them.
+    """
+    sync = asynchronous.SyncWrapper(HelperA)
+    asyncio_loop = sync.asyncio_loop
+    creator_pid = sync._creator_pid
+    assert creator_pid > 0
+    assert not asyncio_loop.is_closed()
+
+    # Simulate ``os.getpid()`` returning a different pid, as it would in
+    # a forked child.  Do NOT actually fork -- the parent's ``sync``
+    # reference has to survive so we can assert on it after GC.
+    monkeypatch.setattr("salt.utils.asynchronous.os.getpid", lambda: creator_pid + 1)
+
+    with warnings.catch_warnings(record=True) as caught:
+        warnings.simplefilter("always")
+        del sync
+        gc.collect()
+
+    # 1. No ResourceWarning: the wrapper is not "our" object in the child.
+    resource_warnings = [w for w in caught if issubclass(w.category, ResourceWarning)]
+    unclosed_syncwrapper = [
+        w for w in resource_warnings if "unclosed SyncWrapper" in str(w.message)
+    ]
+    assert not unclosed_syncwrapper, (
+        "forked-child SyncWrapper.__del__ must NOT emit 'unclosed SyncWrapper' warning "
+        f"(fork-safety guard broken): {[str(w.message) for w in unclosed_syncwrapper]}"
+    )
+
+    # 2. Safety-net close() did NOT run in the "child": the underlying
+    #    asyncio_loop is still open (the parent still owns it).  Without
+    #    the guard, ``__del__`` would drive ``asyncio_loop.close()``.
+    assert not asyncio_loop.is_closed(), (
+        "forked-child SyncWrapper.__del__ must NOT close the shared asyncio_loop "
+        "(fork-safety guard 
```

---

### Incident Patch 7: `46ce6a52` (2026-09-11)
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
+Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_async`` path did, so non-SIGTERM shutdown paths triggered the three-warning cascade in issue #70175. ``PublishServer.close`` also now calls ``pub.close()`` on every ``_TCPPubServerPublisher`` cached in ``_async_pub_by_loop`` (previously it closed the underlying stream only, leaving ``_closing = False`` and letting the publisher's ``__del__`` emit the "unclosed publisher client" warning at GC). ``PubServer._discard_on_close`` now cancels the pending ``_stream_read`` Task and force-closes the Subscriber so the coroutine frame (with its 1 MiB msgpack Unpacker buffer) is released the moment a subscriber disconnects, closing the per-job leak path on the steady-state per-job path. Fire-and-forget ``MinionEvent`` callers in ``salt.modules.event.fire_master`` and ``salt.modules.mine._mine_send`` are now wrapped in ``with`` blocks so the ``PublishServer`` / ``_TCPPubServerPublisher`` / ``SyncWrapper`` triad is torn down synchronously instead of leaking one bundle per invocation onto the minion ev
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
+            client._read_task = None
 
     def _discard_on_close(self, client):
         """
@@ -1512,6 +1530,13 @@ def _cb():
             read_task = getattr(client, "_read_task", None)
             if read_task is not None and not read_task.done():
                 read_task.cancel()
+            # Drop the back-ref so the ``client -> _read_task -> coroutine
+            # frame -> client`` cycle can be collected immediately without
+            # waiting for cyclic-GC.  The ``try/finally`` inside
+            # ``_stream_read`` also clears this from the coroutine side; do
+            # it here for the case where the coroutine has not yet resumed
+            # to observe the cancellation.
+            client._read_task = None
             # Force-close the stream/Subscriber -- belt AND suspenders.
             # Subscriber.close() is idempotent and consumes the read
             # future's exception to avoid the "Future exception was
@@ -1526,6 +1551,17 @@ def _cb():
                 )
             self.
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
+        # the Task on the subscriber so the ``finally`` clause has
+        # something to clear.
+        subscriber._read_task = io_loop.asyncio_loop.create_task(
+            server._stream_read(subscriber)
+        )
+        task_ref = weakref.ref(subscriber._read_task)
+
+        # Freeze the cyclic collector -- we're specifically asserting
+        # that the fix does not rely on cyclic-GC to release memory.
+        gc.disable()
+        try:
+            # Let the task run.  The _EOFStream raises on the first read
+            # so ``_stream_read`` exits its while loop and runs finally.
+            await subscriber._read_task
+            # One extra turn so any post-return bookkeeping (e.g. Task
+            # ``__del__``) settles.
+            await asyncio.sleep(0)
+
+            assert (
+                subscriber not in server.clients
+            ), "Subscriber not removed from PubServer.clients on stream close"
+            assert subscriber._read_task is None, (
+              
```

---

### Incident Patch 8: `ae7e550c` (2026-09-11)
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
+Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_async`` path did, so non-SIGTERM shutdown paths triggered the three-warning cascade in issue #70175. ``PublishServer.close`` also now calls ``pub.close()`` on every ``_TCPPubServerPublisher`` cached in ``_async_pub_by_loop`` (previously it closed the underlying stream only, leaving ``_closing = False`` and letting the publisher's ``__del__`` emit the "unclosed publisher client" warning at GC). ``PubServer._discard_on_close`` now cancels the pending ``_stream_read`` Task and force-closes the Subscriber so the coroutine frame (with its 1 MiB msgpack Unpacker buffer) is released the moment a subscriber disconnects, closing the per-job leak path on the steady-state per-job path. Fire-and-forget ``MinionEvent`` callers in ``salt.modules.event.fire_master`` and ``salt.modules.mine._mine_send`` are now wrapped in ``with`` blocks so the ``PublishServer`` / ``_TCPPubServerPublisher`` / ``SyncWrapper`` triad is torn down synchronously instead of leaking one bundle per invocation onto the minion event bus. ``salt.utils.error.fire_exception`` is also wrapped in a ``with`` block so the temporary ``SaltEvent`` it constructs closes both pusher and subscriber synchronously -- previously the helper (called from ``salt/minion.py:_thread_return`` job-exception path and from ``salt/metaproxy/{proxy,deltaproxy}.py``) dropped the ``SaltEvent`` reference immediately after ``fire_event``, so cleanup ran only when GC invoked ``SaltEvent.__del__`` and each finalization emitted the three-warning triad from the underlying transport chain. ``salt.utils.asynchronous.SyncWrapper.__del__``, ``salt.transport.tcp.PublishServer.__del__``, and ``salt.transport.tcp._TCPPubServerPublisher.__del__`` also now fall back to ``close()`` as a GC-time safety net -- mirroring the pattern on ``salt.utils.event.SaltEvent.__del__`` -- while still emitting the ``ResourceWarning`` so leaky callers can be surfaced for tracking pre-Potassium. ``salt.transport.tcp.TCPPuller.handle_stream`` also no longer spins the tornado io_loop when a ``ValueError('fd %s added twice')`` (from ``IOLoop.add_handler`` via tornado's ``IOStream._add_io_state``) or ``AssertionError('Already reading')`` (the modern tornado surface for the "prior read still outstanding" state, historically named ``Stream
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
+                    except Exception:  # pylint: disable=broad-except
+                        log.debug("Ignoring error closing IPC stream", exc_info=True)
+                break
 
     def handle_connection(self, connection, address):
         log.trace(
@@ -2667,6 +2729,47 @@ def close(self):
         log.debug("Closing %s instance", self.__class__.__name__)
 
         if self.stream is not None and not self.stream.closed():
+            # When ``stream.connect()`` raised ``ValueError('fd %s added twice')``
+            # (or the older ``StreamAlreadyReadingError``) earlier, the fd
+            # may have been partially registered with the tornado io_loop's
+            # selector.  Tornado's own ``stream.close()`` calls
+            # ``io_loop.remove_handler(fileno)`` only when ``_state is not
+            # None`` -- which is not always the case on the ``fd added
+            # twice`` path.  Best-effort remove the handler on the stream's
+            # own io_loop (a tornado ``IOLoop``, not the asyncio loop stored
+     
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
+        assert stream.close_calls >= 1, "stream must be closed on exit"
+    finally:
+        puller.close()
+
+
+def test_tcp_pubserver_publisher_close_removes_partial_fd(io_loop):
+    """
+    When ``_TCPPubServerPublisher.close()`` runs after a failed / partially
+    completed connect, the underlying fd may already be registered with the
+    stream's tornado io_loop's selector.  ``close()`` must best-effort call
+    ``stream.io_loop.remove_handler(fd)`` before closing the stream to
+    avoid a dangling selector entry that would resurface as another
+    ``fd added twice`` the next time the same fd is reused.
+    """
+    publisher = salt.transport.tcp._TCPPubServerPublisher(
+        host="127.0.0.1", port=4511, path=None, io_loop=io_loop
+    )
+
+    fake_socket = MagicMock()
+    fake_socket.fileno.return_value = 4242
+
+    remove_handler_calls = []
+
+    class FakeIOLoop:
+        def remove_handler(self, fd):
+            remove_handler_calls.append(fd)
+
+    fake_stream = MagicMock()
+ 
```

---

### Incident Patch 9: `ecc39e73` (2026-09-10)
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
+                # can cancel it and release the coroutine frame's 1 MiB
+                # ``Unpacker`` local.  See ``handle_stream`` for details.
+                client._read_task = self.io_loop.create_task(self._stream_read(client))
                 return
             except AttributeError as exc:
                 # Socket has no SSL - this shouldn't happen here but reject just in case
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
+        if c._read_task is not None and not c._read_task.done()
+    ]
+    assert len(pending_before) == 50, (
+        f"Expected 50 pending _stream_read tasks, got {len(pending_before)} "
+        "-- test scaffolding is broken"
+    )
+
+    # Now fire the close callback for every stream, exactly as tornado
+    # would when the FIN dispatches.  This is the path that leaked on
+    # unpatched 3008.x: without the fix, the callback discards the
+    # Subscriber from ``self.clients`` but does nothing about the
+    # pending Task, so the coroutine frame (with its 1 MiB Unpacker
+    # local) stays pinned in ``asyncio.all_tasks(loop)`` forever.
+    for _, stream in subscribers:
+        stream.close()
+
+    # Yield once so cancelled Tasks can run their finally blocks and
+    # asyncio can drop them from ``all_tasks``.
+    await asyncio.sleep(0)
+
+    # Every Subscriber must be gone from the server's client set.
+    assert pub_server.clients == set(), (
+        f"pub_server.clients did not drain: {len(pub_server.clients)} "

```

---

### Incident Patch 10: `b5f43ae7` (2026-09-10)
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

### Incident Patch 11: `21f90c85` (2026-09-10)
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

**File**: `salt/grains/core.py` (modified, +19/-1)
```diff
@@ -297,7 +297,18 @@ def _linux_gpu_data():
 
     devs = []
     try:
-        lspci_out = __salt__["cmd.run"](f"{lspci} -vmm")
+        # Run lspci directly (not via cmd.run) with a short timeout so a
+        # hung lspci -- e.g. inside a container without a live PCI bus --
+        # cannot leak orphan child processes on every grains refresh.
+        # On timeout subprocess.run kills the child before re-raising.
+        proc = subprocess.run(
+            [lspci, "-vmm"],
+            capture_output=True,
+            text=True,
+            timeout=5,
+            check=False,
+        )
+        lspci_out = proc.stdout
 
         cur_dev = {}
         error = False
@@ -325,6 +336,13 @@ def _linux_gpu_data():
                 "check that you have a valid shell configured and "
                 "permissions to run lspci command"
             )
+    except subprocess.TimeoutExpired:
+        log.warning(
+            "The `lspci` command timed out while collecting GPU grains. "
+            "GPU grains will not be available. Set `enable_gpu_grains: "
+            "False` in the minion config to skip this collection entirely."
+        )
+        return {}
     except OSError:
         pass
 
```

**File**: `salt/loader/__init__.py` (modified, +23/-3)
```diff
@@ -653,9 +653,18 @@ def engines(opts, functions, runners, utils, proxy=None, loaded_base_name=None):
     :param LazyLoader proxy: An optional LazyLoader instance returned from ``proxy``.
     :param str loaded_base_name: The imported modules namespace when imported
                                  by the salt loader.
+
+    Engines are internal Salt machinery (operator-configured, not
+    user-dispatched over the wire), so they receive the unfiltered inner
+    loader (``functions._dunder_salt`` when present) as ``__salt__``.
+    This lets shipped engines such as ``salt.engines.slack`` /
+    ``salt.engines.webhook`` compose with ``event.send`` / ``pillar.get``
+    even when the operator's ``whitelist_modules`` scopes the wire-facing
+    outer loader down.  Falls back to ``functions`` for salt-ssh
+    ``FunctionWrapper`` and plain-dict test fixtures.
     """
     pack = {
-        "__salt__": functions,
+        "__salt__": getattr(functions, "_dunder_salt", None) or functions,
         "__runners__": runners,
         "__proxy__": proxy,
         "__utils__": utils,
@@ -1237,12 +1246,23 @@ def beacons(opts, functions, context=None, proxy=None, loaded_base_name=None):
     :param LazyLoader proxy: An optional LazyLoader instance returned from ``proxy``.
     :param str loaded_base_name: The imported modules namespace when imported
                                  by the salt loader.
-    """
+
+    Beacons are internal Salt minion machinery (operator-configured, not
+    user-dispatched over the wire), so they receive the unfiltered inner
+    loader (``functions._dunder_salt`` when present) as ``__salt__``.
+    Shipped beacons such as ``salt.beacons.status`` (which invokes
+    ``__salt__[f"status.{func}"]``) or ``salt.beacons.sh`` (``status.procs()``)
+    then compose with their helper execution modules regardless of the
+    operator's ``whitelist_modules`` setting.  Falls back to
+    ``functions`` for salt-ssh ``FunctionWrapper`` and plain-dict test
+    fixtures.
+    """
+    salt_pack = getattr(functions, "_dunder_salt", None) or functions
     return LazyLoader(
         _module_dirs(opts, "beacons"),
         opts,
         tag="beacons",
-        pack={"__context__": context, "__salt__": functions, "__proxy__": proxy or {}},
+        pack={"__context__": context, "__salt__": salt_pack, "__proxy__": proxy or {}},
         virtual_funcs=[],
         loaded_base_name=loaded_base_name,
     )
```

**File**: `salt/metaproxy/deltaproxy.py` (modified, +13/-2)
```diff
@@ -223,7 +223,11 @@ async def post_master_init(self, master):
         )
 
     # add default scheduling jobs to the minions scheduler
-    if self.opts["mine_enabled"] and "mine.update" in self.functions:
+    # ``mine.update`` is Salt-internal machinery injected as
+    # ``__mine_interval``; route the presence check through the
+    # unfiltered inner loader (see companion fix in salt/minion.py).
+    _inner_functions = getattr(self.functions, "_dunder_salt", None) or self.functions
+    if self.opts["mine_enabled"] and "mine.update" in _inner_functions:
         self.schedule.add_job(
             {
                 "__mine_interval": {
@@ -802,7 +806,14 @@ def thread_return(cls, minion_instance, opts, data):
             ret["out"] = "nested"
             ret["retcode"] = salt.defaults.exitcodes.EX_GENERIC
     else:
-        docs = minion_instance.functions["sys.doc"](f"{function_name}*")
+        # Error-path documentation lookup: route through the unfiltered
+        # inner loader so ``sys.doc`` still resolves under a strict
+        # ``whitelist_modules`` that omits ``sys``.
+        _sys_loader = (
+            getattr(minion_instance.functions, "_dunder_salt", None)
+            or minion_instance.functions
+        )
+        docs = _sys_loader["sys.doc"](f"{function_name}*")
         if docs:
             docs[function_name] = minion_instance.functions.missing_fun_string(
                 function_name
```

---

### Incident Patch 12: `a142f2cf` (2026-09-02)
**Commit Message**: Gather a SyncWrapper's pending tasks inside its own loop (#70226)

asyncio.gather has taken no loop argument since 3.10, so it resolves the
loop from the calling context. SyncWrapper.close() runs outside the loop
it is tearing down and the pending tasks belong to that loop, so on
Python 3.14 ensure_future rejects the mismatch with "The future belongs
to a different loop than the one specified as the loop argument".
Earlier versions took the loop from the first future and let it through.

The broad except below caught it, so nothing crashed, but every proxy
minion logged it repeatedly at startup -- 20 lines for a single proxy,
58 for a deltaproxy with two sub-proxies, and on a fresh single proxy
that was the entire log. The pending tasks were also never drained,
which is the work close() was doing.

Build the gather inside the loop instead, where the running loop is the
right one on every version.

**File**: `changelog/70226.fixed.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Stopped proxy minions logging ``Error during asyncio shutdown: The future belongs to a different loop than the one specified as the loop argument`` on Python 3.14. ``asyncio.gather`` takes no ``loop`` argument any more and resolves the loop from the calling context, but ``SyncWrapper.close()`` runs outside the loop it is tearing down, so gathering that loop's pending tasks was rejected and they were never drained.
```

**File**: `salt/utils/asynchronous.py` (modified, +21/-8)
```diff
@@ -186,16 +186,29 @@ def close(self):
                 if pending_tasks:
                     for task in pending_tasks:
                         task.cancel()
-                    gathered = asyncio.gather(*pending_tasks, return_exceptions=True)
+
+                    # ``asyncio.gather`` has no ``loop`` argument any more, so it
+                    # resolves the loop from the calling context.  ``close()``
+                    # runs outside ``self.asyncio_loop`` -- the thread's current
+                    # loop is a different one -- so on Python 3.14 gathering
+                    # tasks that belong to ``self.asyncio_loop`` raises
+                    # ``ValueError: The future belongs to a different loop than
+                    # the one specified as the loop argument``.  Earlier versions
+                    # took the loop from the first future and let it pass.
+                    #
+                    # Build the gather *inside* the loop instead, where the
+                    # running loop is the right one on every version.
+                    async def _drain(tasks):
+                        await asyncio.gather(*tasks, return_exceptions=True)
+
+                    drain = _drain(pending_tasks)
                     try:
-                        self.asyncio_loop.run_until_complete(gathered)
+                        self.asyncio_loop.run_until_complete(drain)
                     except Exception:  # pylint: disable=broad-except
-                        # ``gathered`` is a Future; if run_until_complete bailed
-                        # part-way we still need to make sure the Future is
-                        # consumed so its exception (if any) isn't logged as
-                        # unhandled.  Tasks already cancelled above.
-                        if not gathered.done():
-                            gathered.cancel()
+                        # Close the coroutine we just built so it is not
+                        # garbage-collected unawaited, which would emit a
+                        # RuntimeWarning on stderr.  Tasks already cancelled.
+                        drain.close()
 
             if self._loop_can_run_until_complete(self.asyncio_loop):
                 shutdown_agens = self.asyncio_loop.shutdown_asyncgens()
```

**File**: `tests/pytests/unit/utils/test_asynchronous.py` (modified, +63/-0)
```diff
@@ -17,6 +17,7 @@
 import tornado.ioloop
 
 import salt.utils.asynchronous as asynchronous
+from tests.support.mock import patch
 
 
 class HelperA:
@@ -226,3 +227,65 @@ async def _driver():
     finally:
         outer_loop.close()
         sync.close()
+
+
+class HelperPending:
+    """A helper whose wrapped coroutine leaves a task pending on the loop."""
+
+    async_methods = [
+        "start_background",
+    ]
+
+    def __init__(self, io_loop=None):
+        self.io_loop = io_loop
+
+    @tornado.gen.coroutine
+    def start_background(self):
+        # Leave a long-lived task behind on this wrapper's own loop, so
+        # ``close()`` has something to drain.
+        asyncio.ensure_future(asyncio.sleep(3600))
+        raise tornado.gen.Return(True)
+
+
+def test_close_drains_tasks_belonging_to_the_wrappers_own_loop():
+    """
+    ``close()`` runs outside the loop it is tearing down -- the calling
+    thread's current loop is a different one.  ``asyncio.gather`` no longer
+    takes a ``loop`` argument, so it resolves the loop from the calling
+    context, and on Python 3.14 gathering tasks that belong to another loop
+    raises ``ValueError: The future belongs to a different loop than the one
+    specified as the loop argument``.  Earlier versions took the loop from the
+    first future and let it through, so this surfaced as a wall of
+    "Error during asyncio shutdown" for every proxy minion on 3.14.
+
+    Building the gather inside the loop drains the tasks on every version.
+    """
+    sync = asynchronous.SyncWrapper(HelperPending)
+    sync.start_background()
+
+    pending = [t for t in asyncio.all_tasks(sync.asyncio_loop) if not t.done()]
+    assert pending, "expected a task pending on the wrapper's loop"
+
+    # The failure only happens when ``close()`` is called from inside a
+    # *different running* loop, which is how it is reached in a proxy minion:
+    # ``asyncio.gather`` then resolves the running loop rather than the tasks'
+    # own loop and rejects them.  Drive it that way.
+    #
+    # Asserting on the tasks alone would not catch this either -- they are
+    # cancelled before the gather, so they end up done() regardless.  The
+    # symptom is the swallowed exception, so assert nothing was logged.
+    async def _close_from_another_running_loop():
+        with patch.object(asynchronous.log, "error") as log_error:
+            sync.close()
+        return log_error.call_args_list
+
+    driver = asyncio.new_event_loop()
+    try:
+        errors = driver.run_until_complete(_close_from_another_running_loop())
+    finally:
+        driver.close()
+
+    # Only the swallowed exception is asserted on.  The tasks themselves
+    # cannot be driven to completion here -- a loop cannot be run from inside
+    # another running loop -- so their state is not the thing under test.
+    assert not errors, errors
```

---

### Incident Patch 13: `e2622564` (2026-09-08)
**Commit Message**: Close cached publishers in PublishServer._async_pub_by_loop on close (#70175)

PublishServer.close iterated the per-loop publisher cache but called
stream.close() on each cached _TCPPubServerPublisher rather than
pub.close(). The stream FD was released (Bug 1 fix) but pub._closing
stayed False, so _TCPPubServerPublisher.__del__ still fired the
"unclosed publisher client" ResourceWarning at GC -- the third warning
of the cascade twangboy reported on 3008.2+506. Round 1 of this PR
closed the outer PublishServer + pub_sock SyncWrapper via
MinionManager.destroy (silences warnings 1 and 2); this round covers
the raw cached publishers created in the async-context bypass at
tcp.py:2242/:2281. _TCPPubServerPublisher.close is idempotent and
subsumes the previous stream-only close.

**File**: `changelog/70175.fixed.md` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_async`` path did, so non-SIGTERM shutdown paths triggered the three-warning cascade in issue #70175.
+Fixed leak of the minion's local ``PublishServer`` graph (``event_publisher`` -> ``pub_sock`` SyncWrapper -> ``_TCPPubServerPublisher``) when the minion exits through ``cli.daemons.Minion.shutdown`` (KeyboardInterrupt, SaltSystemExit, early-exit guards) or ``MinionManager`` GC. ``MinionManager.destroy`` now closes ``event_publisher`` and destroys ``event`` -- previously only the SIGTERM ``stop_async`` path did, so non-SIGTERM shutdown paths triggered the three-warning cascade in issue #70175. ``PublishServer.close`` also now calls ``pub.close()`` on every ``_TCPPubServerPublisher`` cached in ``_async_pub_by_loop`` (previously it closed the underlying stream only, leaving ``_closing = False`` and letting the publisher's ``__del__`` emit the "unclosed publisher client" warning at GC).
```

**File**: `salt/transport/tcp.py` (modified, +17/-6)
```diff
@@ -2310,15 +2310,26 @@ def close(self):
         # minion's local event bus (~450 leaked pull.ipc client FDs
         # under sustained stress -> ulimit trip).  Close every cached
         # publisher we still hold before dropping the map.
+        #
+        # PATCH (#70175 round 2): call ``pub.close()`` rather than reaching
+        # into ``pub.stream`` directly.  The stream-only close released
+        # the socket FD but never flipped ``pub._closing = True``, so
+        # every cached publisher tripped ``_TCPPubServerPublisher.__del__``
+        # at GC and emitted the "unclosed publisher client"
+        # ``ResourceWarning`` -- the third warning of the cascade the
+        # user reported on 3008.2+506 (round 1 closed the outer
+        # ``PublishServer`` + ``pub_sock`` SyncWrapper via
+        # ``MinionManager.destroy``; the raw cached publishers were
+        # still leaking their own warning).  ``_TCPPubServerPublisher.close``
+        # is idempotent (early-return on ``_closing``) and subsumes the
+        # stream close.
         per_loop = getattr(self, "_async_pub_by_loop", None)
         if per_loop is not None:
             for pub, _lock in list(per_loop.values()):
-                stream = getattr(pub, "stream", None)
-                if stream is not None and not stream.closed():
-                    try:
-                        stream.close()
-                    except Exception:  # pylint: disable=broad-except
-                        pass
+                try:
+                    pub.close()
+                except Exception:  # pylint: disable=broad-except
+                    pass
             try:
                 per_loop.clear()
             except Exception:  # pylint: disable=broad-except
```

**File**: `tests/pytests/unit/transport/test_tcp.py` (modified, +83/-0)
```diff
@@ -1218,6 +1218,89 @@ def _new_publisher(*args, **kwargs):
         server.close()
 
 
+async def test_publish_server_close_closes_cached_publishers(master_opts):
+    """
+    ``PublishServer.close()`` must call ``pub.close()`` on every publisher
+    cached in ``_async_pub_by_loop`` -- not just close the underlying
+    stream -- so ``_TCPPubServerPublisher._closing`` gets flipped to
+    ``True`` and the object's ``__del__`` does not emit the
+    "unclosed publisher client" ``ResourceWarning``.
+
+    Regression guard for issue #70175 round 2.  Pre-fix,
+    ``PublishServer.close`` did ``stream.close()`` directly on each
+    cached publisher, which released the socket FD (round-1 Bug 1 fix)
+    but left ``_closing = False`` on the publisher object.  When GC
+    reaped the cached publisher, its finalizer emitted the third
+    warning of the three-warning cascade the user reported on
+    3008.2+506.  Round-1 PR #70206 closed the outer PublishServer +
+    pub_sock SyncWrapper via MinionManager.destroy (silences warnings
+    1 and 2); round-2 must call ``pub.close()`` here (silences warning
+    3).
+    """
+    opts = dict(master_opts)
+
+    server = salt.transport.tcp.PublishServer(
+        opts,
+        pub_host="127.0.0.1",
+        pub_port=5151,
+        pull_host="127.0.0.1",
+        pull_port=5152,
+    )
+
+    # Populate the per-loop cache with two real ``_TCPPubServerPublisher``
+    # objects (no connect() -- we only need instances whose
+    # ``__del__`` will fire if ``close()`` is not called on them).
+    pub_a = salt.transport.tcp._TCPPubServerPublisher("127.0.0.1", 5152, None)
+    pub_b = salt.transport.tcp._TCPPubServerPublisher("127.0.0.1", 5152, None)
+    loop = asyncio.get_running_loop()
+    server._async_pub_by_loop = weakref.WeakKeyDictionary()
+    # Two distinct dummy loop keys so both cache slots are exercised.
+    key_a = asyncio.new_event_loop()
+    key_b = asyncio.new_event_loop()
+    try:
+        server._async_pub_by_loop[key_a] = (pub_a, asyncio.Lock())
+        server._async_pub_by_loop[key_b] = (pub_b, asyncio.Lock())
+
+        assert pub_a._closing is False
+        assert pub_b._closing is False
+
+        with warnings.catch_warnings(record=True) as caught:
+            warnings.simplefilter("always")
+            server.close()
+
+            # After close, every cached publisher must have been
+            # ``close()``-d (i.e. ``_closing`` flipped True) and the
+            # cache map dropped.
+            assert pub_a._closing is True
+            assert pub_b._closing is True
+            assert server._async_pub_by_loop is None
+
+            # Drop remaining strong refs and force GC to run
+            # ``_TCPPubServerPublisher.__del__`` for both cached pubs.
+            # With the fix in place their ``__del__`` sees
+            # ``_closing = True`` and returns silently -- no
+            # ``ResourceWarning`` emitted.
+            del pub_a
+            del pub_b
+            gc.collect()
+
+        unclosed_publisher_warnings = [
+            w
+            for w in caught
+            if issubclass(w.category, ResourceWarning)
+            and "unclosed publisher client" in str(w.message)
+        ]
+        assert unclosed_publisher_warnings == [], (
+            "PublishServer.close did not close the cached "
+            "_TCPPubServerPublisher instances -- their __del__ still "
+            "emits unclosed publisher client warnings.  This is the "
+            "third warning of the #70175 cascade."
+        )
+    finally:
+        key_a.close()
+        key_b.close()
+
+
 async def test_pub_server_paths_no_perms(master_opts, io_loop):
     def publish_payload(payload):
         return payload
```

---

### Incident Patch 14: `adbbb907` (2026-09-01)
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

---

### Incident Patch 15: `1eefb116` (2026-09-09)
**Commit Message**: Drop bullseye-EOL test workarounds now provided by salt-ci-containers

The `testing:debian-11` container image now bakes in the Debian 11 (bullseye)
EOL apt fix directly (snapshot.debian.org sources pinned to
`20260824T000000Z` plus `Acquire::Check-Valid-Until "false"` in
`apt.conf.d`), landed via saltstack/salt-ci-containers#144. The
test-suite-level workarounds this branch added while the container image
was still broken are now redundant, so drop them:

- `tests/pytests/pkg/conftest.py` (reverts e281a249090 + 7f760958faf):
  The pkg-test bootstrap `_system_up_to_date` fixture no longer needs
  `-o Acquire::Check-Valid-Until=false` on Debian 11 -- the option is
  now set globally inside the container via apt.conf.d. Restore the
  original plain `apt update` / `apt upgrade` calls.

- `tests/pytests/conftest.py` (reverts 3633647bbe2):
  The session-scoped autouse fixture that dropped
  `/etc/apt/apt.conf.d/99-salt-tests-bullseye-eol` on bullseye hosts
  is redundant with the container-baked equivalent, so remove it.

The `after_start` docker-exec snippet added by 811042b1f10 to
`tests/pytests/scenarios/compat/test_with_versions.py` is INTENTIONALLY
KEPT: that test spawns
`ghcr.io/s

**File**: `tests/pytests/conftest.py` (modified, +0/-52)
```diff
@@ -32,58 +32,6 @@
 log = logging.getLogger(__name__)
 
 
-@pytest.fixture(scope="session", autouse=True)
-def _bullseye_eol_apt_bypass():
-    """
-    Debian 11 (bullseye) reached EOL on 2026-08-31 and its
-    ``debian-security`` InRelease signatures are no longer refreshed.
-    Any test that shells out to ``apt-get update`` -- directly, via
-    ``salt.modules.aptpkg``, or through a state that calls ``pkg.installed``
-    -- fails with ``Release file ... is expired`` and raises
-    ``CommandExecutionError``.
-
-    Drop an ``apt.conf.d`` snippet for the pytest session that disables
-    only the ``Valid-Until`` freshness check on bullseye. GPG signature
-    verification is untouched. Scoped to bullseye specifically so
-    Debian 12 (bookworm) and Debian 13 (trixie) continue to enforce
-    Valid-Until as a real security signal.
-
-    No-op on non-Debian, on non-bullseye Debian, and when we lack write
-    access to ``/etc/apt/apt.conf.d/`` (e.g. running unprivileged).
-    """
-    if not sys.platform.startswith("linux"):
-        yield
-        return
-    os_release = pathlib.Path("/etc/os-release")
-    if not os_release.is_file():
-        yield
-        return
-    codename = None
-    for line in os_release.read_text(encoding="utf-8").splitlines():
-        if line.startswith("VERSION_CODENAME="):
-            codename = line.split("=", 1)[1].strip().strip('"')
-            break
-    if codename != "bullseye":
-        yield
-        return
-    conf = pathlib.Path("/etc/apt/apt.conf.d/99-salt-tests-bullseye-eol")
-    try:
-        conf.write_text('Acquire::Check-Valid-Until "false";\n', encoding="utf-8")
-    except OSError:
-        # No root, or apt.conf.d unavailable. Nothing to do; tests that
-        # need apt on this host will fail loudly at their own callsite.
-        yield
-        return
-    log.info("Wrote %s to bypass expired bullseye InRelease", conf)
-    try:
-        yield
-    finally:
-        try:
-            conf.unlink()
-        except OSError:
-            pass
-
-
 @pytest.fixture(scope="session")
 def salt_auth_account_1_factory():
     return TestAccount(username="saltdev-auth-1")
```

**File**: `tests/pytests/pkg/conftest.py` (modified, +2/-14)
```diff
@@ -54,18 +54,7 @@ def _system_up_to_date(
     #    gpg_dest,
     # )
     if grains["os_family"] == "Debian":
-        # Debian 11 (bullseye) reached EOL on 2026-08-31 and its
-        # debian-security InRelease signatures are no longer refreshed,
-        # so a plain ``apt update`` returns 100 with "Release file ...
-        # is expired" and the fixture assert below fails. Scope the
-        # freshness-check bypass to bullseye ONLY -- Debian 12 (bookworm)
-        # and 13 (trixie) are still supported and their Valid-Until is
-        # a real security signal that must not be silenced.
-        # Gpg signature verification is unaffected either way.
-        apt_opts = ()
-        if str(grains.get("osmajorrelease", "")) == "11":
-            apt_opts = ("-o", "Acquire::Check-Valid-Until=false")
-        ret = shell.run("apt-get", "update", *apt_opts)
+        ret = shell.run("apt", "update")
         assert ret.returncode == 0
         env = os.environ.copy()
         env["DEBIAN_FRONTEND"] = "noninteractive"
@@ -84,14 +73,13 @@ def _system_up_to_date(
             "salt-ssh",
         )
         ret = shell.run(
-            "apt-get",
+            "apt",
             "upgrade",
             "-y",
             "-o",
             "DPkg::Options::=--force-confdef",
             "-o",
             "DPkg::Options::=--force-confold",
-            *apt_opts,
             env=env,
         )
         shell.run(
```

#### Recent Merged Pull Requests:
- **PR #70339** (2026-09-30): build-packages: pick signing key by inputs.environment (@dwoz)
- **PR #70337** (2026-09-30): Merge forward 3007.x into 3008.x (@dwoz)
- **PR #70336** (2026-09-30): Merge forward 3006.x into 3007.x (@dwoz)
- **PR #70335** (2026-09-30): Bump relenv to 0.22.27 (@dwoz)
- **PR #70334** (2026-09-29): Update bootstrap script to v2026.09.28 (@twangboy)
- **PR #70328** (closed): Bump the all-pip-updates group across 3 directories with 56 updates (@dependabot[bot])
- **PR #70327** (closed): Bump the all-pip-updates group across 3 directories with 51 updates (@dependabot[bot])
- **PR #70326** (closed): Bump the all-pip-updates group across 3 directories with 50 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
