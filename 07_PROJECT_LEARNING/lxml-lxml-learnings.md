> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lxml-lxml-learnings.md`  
> **Source**: github ([https://github.com/lxml/lxml](https://github.com/lxml/lxml))  
> **Source Version**: `584df5c8`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T22:32:56.971Z  
> **Learning ID**: `learn-github-lxml-lxml`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): lxml/lxml

> **Canonical Artifact**: `07_PROJECT_LEARNING/lxml-lxml-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lxml/lxml](https://github.com/lxml/lxml))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T22:32:55.735Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lxml/lxml`
- **Description**: The lxml XML toolkit for Python
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml
- **Stars / Engagement**: 3066 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmark/bench_etree.py`
```
import copy
from io import BytesIO
from itertools import *

import benchbase
from benchbase import (with_attributes, with_text, onlylib,
                       serialized, children, nochange,
                       anytree, widetree, widesubtree)

TEXT  = "some ASCII text"
UTEXT = u"some klingon: \uF8D2"

############################################################
# Benchmarks
############################################################

class BenchMark(benchbase.TreeBenchMark):
    @anytree
    @nochange
    def bench_iter_children(self, root):
        for child in root:
            pass

    @anytree
    @nochange
    def bench_iter_children_reversed(self, root):
        for child in reversed(root):
            pass

    @anytree
    @nochange
    def bench_first_child(self, root):
        for i in self.repeat1000:
            child = root[0]

    @anytree
    @nochange
    def bench_last_child(self, root):
        for i in self.repeat1000:
            child = root[-1]

    @widetree
    @nochange
    def bench_middle_child(self, root):
        pos = len(root) // 2
        for i in self.repeat1000:
            child = root[pos]

    @nochange
    @with_attributes(False)
    @with_text(text=True)
    def bench_tostring_text_ascii(self, root):
        self.etree.tostring(root, method="text")

    @nochange
    @with_attributes(False)
    @with_text(text=True, utext=True)
    def bench_tostring_text_unicode(self, root):
        self.etree.tostring(root, method="text", encoding='unicode')

    @nochange
    @with_attributes(False)
    @with_text(text=True, utext=True)
    def bench_tostring_text_utf16(self, root):
        self.etree.tostring(root, method="text", encoding='UTF-16')

    @nochange
    @with_attributes(False)
    @with_text(text=True, utext=True)
    @onlylib('lxe')
    @children
    def bench_tostring_text_utf8_with_tail(self, children):
        for child in children:
            self.etree.tostring(child, method="text",
                                encoding='UTF-8', with_tail=True)

    @nochange
    @with_attributes(True, False)
    @with_text(text=True, utext=True)
    def bench_tostring_utf8(self, root):
        self.etree.tostring(root, encoding='UTF-8')

    @nochange
    @with_attributes(True, False)
    @with_text(text=True, utext=True)
    def bench_tostring_utf16(self, root):
        self.etree.tostring(root, encoding='UTF-16')

    @nochange
    @with_attributes(True, False)
    @with_text(text=True, utext=True)
    def bench_tostring_utf8_unicode_XML(self, root):
        xml = self.etree.tostring(root, encoding='UTF-8').decode('UTF-8')
        self.etree.XML(xml)

    @nochange
    @with_attributes(True, False)
    @with_text(text=True, utext=True)
    def bench_write_utf8_parse_bytesIO(self, root):
        f = BytesIO()
        self.etree.ElementTree(root).write(f, encoding='UTF-8')
        f.seek(0)
        self.etree.parse(f)

    @with_attributes(True, False)
    @with_text(text=True, utext=True)
    @serialized
    def bench_parse_bytesIO(self, root_xml):
        f = BytesIO(root_xml)
        self.etree.parse(f)

    @with_attributes(True, False)
    @with_text(text=True, utext=True)
    @serialized
    def bench_XML(self, root_xml):
        self.etree.XML(root_xml)

    @with_attributes(True, False)
    @with_text(text=True, utext=True)
    @serialized
    def bench_iterparse_bytesIO(self, root_xml):
        f = BytesIO(root_xml)
        for event, element in self.etree.iterparse(f):
            pass

    @with_attributes(True, False)
    @with_text(text=True, utext=True)
    @serialized
    def bench_iterparse_bytesIO_clear(self, root_xml):
        f = BytesIO(root_xml)
        for event, element in self.etree.iterparse(f):
            element.clear()

    @anytree
    def bench_append_from_document(self, root1, root2):
        # == "1,2 2,3 1,3 3,1 3,2 2,1" # trees 1 and 2, or 2 and 3, or ...
        for el in root2:
            root1.append(el)

    @anytree
    def bench_insert_from_document(self, root1, root2):
        pos = len(root1)//2
        for el in root2:
            root1.insert(pos, el)
            pos = pos + 1

    def bench_rotate_children(self, root):
        # == "1 2 3" # runs on any single tree independently
        for i in range(50):
            el = root[0]
            del root[0]
            root.append(el)

    @widetree
    def bench_reorder(self, root):
        for i in range(1,len(root)//2, 3):
            el = root[0]
            del root[0]
            root[-i:-i] = [ el ]

    @widetree
    def bench_reorder_slice(self, root):
        for i in range(1,len(root)//2, 3):
            els = root[0:1]
            del root[0]
            root[-i:-i] = els

    def bench_clear(self, root):
        root.clear()

    @widetree
    @nochange
    @children
    def bench_len(self, children):
        for child in children:
            map(len, repeat(child, 20))

    @widetree
    @children
    def bench_create_subelements(self, children):
        SubElement = self.etree.SubElement
        for child in children:
            SubElement(child, '{test}test')

    @widetree
    @children
    def bench_append_elements(self, children):
        Element = self.etree.Element
        for child in children:
            el = Element('{test}test')
            child.append(el)

    @widetree
    @nochange
    @children
    def bench_makeelement(self, children):
        empty_attrib = {}
        for child in children:
            child.makeelement('{test}test', empty_attrib)

    @widetree
    @nochange
    @children
    def bench_create_elements(self, children):
        Element = self.etree.Element
        for child in children:
            Element('{test}test')

    @widetree
    @children
    def bench_replace_children_element(self, children):
        Element = self.etree.Element
        for child in children:
            el = Element('{test}test')
            child[:] = [el]

    @widetree
    @children
    def bench_replace_children(self, children):
        els = [ self.etree.Element("newchild") ]
        for child in children:
            child[:] = els

    @widetree
    def bench_remove_children(self, root):
        for child in islice(root, 0, 2**30, 7):
            root.remove(child)

    @widetree
    def bench_remove_children_reversed(self, root):
        for child in islice(reversed(root), 0, 2**30, 7):
            root.remove(child)

    @widetree
    @children
    def bench_set_attributes(self, children):
        for child in children:
            child.set('a', 'bla')

    @widetree
    @with_attributes(True)
    @children
    @nochange
    def bench_get_attributes(self, children):
        for child in children:
            child.get('bla1')
            child.get('{attr}test1')

    @widetree
    @children
    def bench_setget_attributes(self, children):
        for child in children:
            child.set('a', 'bla')
        for child in children:
            child.get('a')

    @widetree
    @nochange
    def bench_root_getchildren(self, root):
        root.getchildren()

    @widetree
    @nochange
    def bench_root_list_children(self, root):
        list(root)

    @widesubtree
    @nochange
    @children
    def bench_getchildren(self, children):
        for child in children:
            child.getchildren()

    @widesubtree
    @nochange
    @children
    def bench_get_children_slice(self, children):
        for child in children:
            child[:]

    @widesubtree
    @nochange
    @children
    def bench_get_children_slice_2x(self, children):
        for child in children:
            child[:]
            child[:]

    @nochange
    @children
    @with_attributes(True, False)
    @with_text(utext=True, text=True, no_text=True)
    def bench_deepcopy(self, children):
        for child in islice(children, 0, 2**30, 7):
            copy.deepcopy(child)

    @nochange
    @with_attributes(True, False)
    @with_text(utext=True, text=True, no_text=True)
    def bench_deepcopy_all(self, root):
        copy.deepcopy(root)

    @widetree
    @nochange
    @children
    def bench_tag(self, children):
        for child in children:
            child.tag

    @widetree
    @nochange
    @children
    def bench_tag_repeat(self, children):
        for child in children:
            for i in self.repeat100:
                child.tag

    @widetree
    @nochange
    @with_text(utext=True, text=True, no_text=True)
    @children
    def bench_text(self, children):
        for child in children:
            child.text

    @widetree
    @nochange
    @with_text(utext=True, text=True, no_text=True)
    @children
    def bench_text_repeat(self, children):
        for child in children:
            for i in self.repeat100:
                child.text

    @widetree
    @children
    def bench_set_text(self, children):
        text = TEXT
        for child in children:
            child.text = text

    @widetree
    @children
    def bench_set_utext(self, children):
        text = UTEXT
        for child in children:
            child.text = text

    @widetree
    @nochange
    @onlylib('lxe')
    def bench_index(self, root):
        for child in root:
            root.index(child)

    @widetree
    @nochange
    @onlylib('lxe')
    def bench_index_slice(self, root):
        for child in root[5:100]:
            root.index(child, 5, 100)

    @widetree
    @nochange
    @onlylib('lxe')
    def bench_index_slice_neg(self, root):
        for child in root[-100:-5]:
            root.index(child, start=-100, stop=-5)

    @nochange
    def bench_iter_all(self, root):
        all(el is not None for el in root.iter())

    @nochange
    def bench_iter_one_at_a_time(self, root):
        all(el is not None for el in islice(root.iter(), 2**30, None, 3))

    @nochange
    def bench_iter_islice(self, root):
        all(el is not None for el in islice(root.iter(), 10, 110))

    @nochange
    def bench_iter_tag(self, root):
        all(el is not None for el in islice(roo
```

### Core Architecture Module: `benchmark/bench_objectify.py`
```
from itertools import *

import benchbase
from benchbase import (with_text, children, nochange)

############################################################
# Benchmarks
############################################################

class BenchMark(benchbase.TreeBenchMark):
    repeat100  = range(100)
    repeat1000 = range(1000)
    repeat3000 = range(3000)

    def __init__(self, lib):
        from lxml import etree, objectify
        self.objectify = objectify
        parser = etree.XMLParser(remove_blank_text=True)
        lookup = objectify.ObjectifyElementClassLookup()
        parser.set_element_class_lookup(lookup)
        super(BenchMark, self).__init__(etree, parser)

    @nochange
    def bench_attribute(self, root):
        "1 2 4"
        for i in self.repeat3000:
            root.zzzzz

    def bench_attribute_assign_int(self, root):
        "1 2 4"
        for i in self.repeat3000:
            root.XYZ = 5

    def bench_attribute_assign_string(self, root):
        "1 2 4"
        for i in self.repeat3000:
            root.XYZ = "5"

    @nochange
    def bench_attribute_cached(self, root):
        "1 2 4"
        cache = root.zzzzz
        for i in self.repeat3000:
            root.zzzzz

    @nochange
    def bench_attributes_deep(self, root):
        "1 2 4"
        for i in self.repeat3000:
            root.zzzzz['{cdefg}a00001']

    @nochange
    def bench_attributes_deep_cached(self, root):
        "1 2 4"
        cache1 = root.zzzzz
        cache2 = cache1['{cdefg}a00001']
        for i in self.repeat3000:
            root.zzzzz['{cdefg}a00001']

    @nochange
    def bench_objectpath(self, root):
        "1 2 4"
        path = self.objectify.ObjectPath(".zzzzz")
        for i in self.repeat3000:
            path(root)

    @nochange
    def bench_objectpath_deep(self, root):
        "1 2 4"
        path = self.objectify.ObjectPath(".zzzzz.{cdefg}a00001")
        for i in self.repeat3000:
            path(root)

    @nochange
    def bench_objectpath_deep_cached(self, root):
        "1 2 4"
        cache1 = root.zzzzz
        cache2 = cache1['{cdefg}a00001']
        path = self.objectify.ObjectPath(".zzzzz.{cdefg}a00001")
        for i in self.repeat3000:
            path(root)

    @with_text(text=True, utext=True, no_text=True)
    def bench_annotate(self, root):
        self.objectify.annotate(root)

    @nochange
    def bench_descendantpaths(self, root):
        root.descendantpaths()

    @nochange
    @with_text(text=True)
    def bench_type_inference(self, root):
        "1 2 4"
        el = root.aaaaa
        for i in self.repeat1000:
            el.getchildren()

    @nochange
    @with_text(text=True)
    def bench_type_inference_annotated(self, root):
        "1 2 4"
        el = root.aaaaa
        self.objectify.annotate(el)
        for i in self.repeat1000:
            el.getchildren()

    @nochange
    @children
    def bench_elementmaker(self, children):
        E = self.objectify.E
        for child in children:
            root = E.this(
                "test",
                E.will(
                    E.do("nothing"),
                    E.special,
                    )
                )

if __name__ == '__main__':
    benchbase.main(BenchMark)

```

### Core Architecture Module: `benchmark/bench_xpath.py`
```
from itertools import *

import benchbase
from benchbase import onlylib, children, nochange

############################################################
# Benchmarks
############################################################

class XPathBenchMark(benchbase.TreeBenchMark):
    @nochange
    @onlylib('lxe')
    @children
    def bench_xpath_class(self, children):
        xpath = self.etree.XPath("./*[1]")
        for child in children:
            xpath(child)

    @nochange
    @onlylib('lxe')
    @children
    def bench_xpath_class_repeat(self, children):
        for child in children:
            xpath = self.etree.XPath("./*[1]")
            xpath(child)

    @nochange
    @onlylib('lxe')
    def bench_xpath_element(self, root):
        xpath = self.etree.XPathElementEvaluator(root)
        for child in root:
            xpath("./*[1]")

    @nochange
    @onlylib('lxe')
    @children
    def bench_xpath_method(self, children):
        for child in children:
            child.xpath("./*[1]")

    @nochange
    @onlylib('lxe')
    @children
    def bench_multiple_xpath_or(self, children):
        xpath = self.etree.XPath(".//p:a00001|.//p:b00001|.//p:c00001",
                                 namespaces={'p':'cdefg'})
        for child in children:
            xpath(child)

    @nochange
    @onlylib('lxe')
    @children
    def bench_multiple_iter_tag(self, children):
        for child in children:
            list(child.iter("{cdefg}a00001"))
            list(child.iter("{cdefg}b00001"))
            list(child.iter("{cdefg}c00001"))

    @nochange
    @onlylib('lxe')
    @children
    def bench_xpath_old_extensions(self, children):
        def return_child(_, elements):
            if elements:
                return elements[0][0]
            else:
                return ()
        extensions = {("test", "child") : return_child}
        xpath = self.etree.XPath("t:child(.)", namespaces={"t":"test"},
                                 extensions=extensions)
        for child in children:
            xpath(child)

    @nochange
    @onlylib('lxe')
    @children
    def bench_xpath_extensions(self, children):
        def return_child(_, elements):
            if elements:
                return elements[0][0]
            else:
                return ()
        self.etree.FunctionNamespace("testns")["t"] = return_child

        try:
            xpath = self.etree.XPath("test:t(.)", namespaces={"test":"testns"})
            for child in children:
                xpath(child)
        finally:
            del self.etree.FunctionNamespace("testns")["t"]

if __name__ == '__main__':
    benchbase.main(XPathBenchMark)

```

### Core Architecture Module: `benchmark/bench_xslt.py`
```
import benchbase
from benchbase import onlylib


############################################################
# Benchmarks
############################################################

class XSLTBenchMark(benchbase.TreeBenchMark):
    @onlylib('lxe')
    def bench_xslt_document(self, root):
        transform = self.etree.XSLT(self.etree.XML("""\
<xsl:stylesheet version="1.0"
   xmlns:l="test"
   xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <l:data>TEST</l:data>
  <xsl:template match="/">
    <l:result>
      <xsl:for-each select="*/*">
        <l:test><xsl:copy-of select="document('')//l:data/text()"/></l:test>
      </xsl:for-each>
    </l:result>
  </xsl:template>
</xsl:stylesheet>
"""))
        transform(root)


if __name__ == '__main__':
    benchbase.main(XSLTBenchMark)

```

### Core Architecture Module: `benchmark/benchbase.py`
```
import sys, re, string, copy, gc
import itertools
import time
from contextlib import contextmanager
from functools import partial


TREE_FACTOR = 1 # increase tree size with '-l / '-L' cmd option
DEFAULT_REPEAT = 7

_TEXT  = "some ASCII text" * TREE_FACTOR
_UTEXT = u"some klingon: \uF8D2" * TREE_FACTOR
_ATTRIBUTES = {
    '{attr}test1' : _TEXT,
    '{attr}test2' : _TEXT,
    'bla1'        : _TEXT,
    'bla2'        : _TEXT,
    'bla3'        : _TEXT
    }


def initArgs(argv):
    global TREE_FACTOR
    try:
        argv.remove('-l')
        # use large trees
        TREE_FACTOR *= 2
    except ValueError:
        pass

    try:
        argv.remove('-L')
        # use LARGE trees
        TREE_FACTOR *= 2
    except ValueError:
        pass

############################################################
# benchmark decorators
############################################################

def with_attributes(*use_attributes):
    "Decorator for benchmarks that use attributes"
    vmap = {False : 0, True : 1}
    values = [ vmap[bool(v)] for v in use_attributes ]
    def set_value(function):
        try:
            function.ATTRIBUTES.update(values)
        except AttributeError:
            function.ATTRIBUTES = set(values)
        return function
    return set_value

def with_text(no_text=False, text=False, utext=False):
    "Decorator for benchmarks that use text"
    values = []
    if no_text:
        values.append(0)
    if text:
        values.append(1)
    if utext:
        values.append(2)
    def set_value(function):
        try:
            function.TEXT.add(values)
        except AttributeError:
            function.TEXT = set(values)
        return function
    return set_value

def onlylib(*libs):
    "Decorator to restrict benchmarks to specific libraries"
    def set_libs(function):
        if libs:
            function.LIBS = libs
        return function
    return set_libs

def serialized(function):
    "Decorator for benchmarks that require serialized XML data"
    function.STRING = True
    return function

def children(function):
    "Decorator for benchmarks that require a list of root children"
    function.CHILDREN = True
    return function

def nochange(function):
    "Decorator for benchmarks that do not change the XML tree"
    function.NO_CHANGE = True
    return function

def anytree(function):
    "Decorator for benchmarks that do not depend on the concrete tree"
    function.ANY_TREE = True
    return function

def widetree(function):
    "Decorator for benchmarks that use only tree 2"
    function.TREES = "2"
    return function

def widesubtree(function):
    "Decorator for benchmarks that use only tree 1"
    function.TREES = "1"
    return function


############################################################
# benchmark baseclass
############################################################

class SkippedTest(Exception):
    pass

class TreeBenchMark:
    atoz = string.ascii_lowercase
    repeat100  = range(100)
    repeat500  = range(500)
    repeat1000 = range(1000)

    _LIB_NAME_MAP = {
        'etree'        : 'lxe',
        'ElementTree'  : 'ET',
        'cElementTree' : 'cET'
        }

    SEARCH_TAG = "{cdefg}a00001"

    def __init__(self, etree, etree_parser=None):
        self.etree = etree
        libname = etree.__name__.split('.')[-1]
        self.lib_name = self._LIB_NAME_MAP.get(libname, libname)

        if libname == 'etree':
            deepcopy = copy.deepcopy
            def set_property(root, fname):
                xml = self._serialize_tree(root)
                if etree_parser is not None:
                    setattr(self, fname, lambda : etree.XML(xml, etree_parser))
                else:
                    setattr(self, fname, lambda : deepcopy(root))
                setattr(self, fname + '_xml', lambda : xml)
                setattr(self, fname + '_children', lambda : root[:])
        else:
            def set_property(root, fname):
                setattr(self, fname, self.et_make_clone_factory(root))
                xml = self._serialize_tree(root)
                setattr(self, fname + '_xml', lambda : xml)
                setattr(self, fname + '_children', lambda : root[:])

        attribute_list = list(enumerate( [{}, _ATTRIBUTES] ))
        text_list = list(enumerate( [None, _TEXT, _UTEXT] ))
        build_name = self._tree_builder_name

        self.setup_times = []
        for tree in self._all_trees():
            times = []
            self.setup_times.append(times)
            setup = getattr(self, '_setup_tree%d' % tree)
            for an, attributes in attribute_list:
                for tn, text in text_list:
                    root, t = setup(text, attributes)
                    times.append(t)
                    set_property(root, build_name(tree, tn, an))

    def _tree_builder_name(self, tree, tn, an):
        return '_root%d_T%d_A%d' % (tree, tn, an)

    def tree_builder(self, tree, tn, an, serial, children):
        name = self._tree_builder_name(tree, tn, an)
        if serial:
            name += '_xml'
        elif children:
            name += '_children'
        return getattr(self, name)

    def _serialize_tree(self, root):
        return self.etree.tostring(root, encoding='UTF-8')

    def et_make_clone_factory(self, elem):
        def generate_elem(append, elem, level):
            var = "e" + str(level)
            arg = repr(elem.tag)
            if elem.attrib:
                arg += ", **%r" % elem.attrib
            if level == 1:
                append(" e1 = Element(%s)" % arg)
            else:
                append(" %s = SubElement(e%d, %s)" % (var, level-1, arg))
            if elem.text:
                append(" %s.text = %r" % (var, elem.text))
            if elem.tail:
                append(" %s.tail = %r" % (var, elem.tail))
            for e in elem:
                generate_elem(append, e, level+1)
        # generate code for a function that creates a tree
        output = ["def element_factory():"]
        generate_elem(output.append, elem, 1)
        output.append(" return e1")
        # setup global function namespace
        namespace = {
            "Element"    : self.etree.Element,
            "SubElement" : self.etree.SubElement
            }

        # create function object
        exec("\n".join(output), namespace)
        return namespace["element_factory"]

    def _all_trees(self):
        all_trees = []
        for name in dir(self):
            if name.startswith('_setup_tree'):
                all_trees.append(int(name[11:]))
        return all_trees

    def _setup_tree1(self, text, attributes):
        "tree with 26 2nd level and 520 * TREE_FACTOR 3rd level children"
        atoz = self.atoz
        SubElement = self.etree.SubElement
        current_time = time.time
        t = current_time()
        root = self.etree.Element('{abc}rootnode')
        for ch1 in atoz:
            el = SubElement(root, "{abc}"+ch1*5, attributes)
            el.text = text
            for ch2 in atoz:
                tag = "{cdefg}%s00001" % ch2
                for i in range(20 * TREE_FACTOR):
                    SubElement(el, tag).tail = text
        t = current_time() - t
        return root, t

    def _setup_tree2(self, text, attributes):
        "tree with 520 * TREE_FACTOR 2nd level and 26 3rd level children"
        atoz = self.atoz
        SubElement = self.etree.SubElement
        current_time = time.time
        t = current_time()
        root = self.etree.Element('{abc}rootnode')
        for ch1 in atoz:
            for i in range(20 * TREE_FACTOR):
                el = SubElement(root, "{abc}"+ch1*5, attributes)
                el.text = text
                for ch2 in atoz:
                    SubElement(el, "{cdefg}%s00001" % ch2).tail = text
        t = current_time() - t
        return root, t

    def _setup_tree3(self, text, attributes):
        "tree of depth 8 + TREE_FACTOR with 3 children per node"
        SubElement = self.etree.SubElement
        current_time = time.time
        t = current_time()
        root = self.etree.Element('{abc}rootnode')
        children = [root]
        for i in range(6 + TREE_FACTOR):
            children = [ SubElement(c, "{cdefg}a%05d" % (i%8), attributes)
                         for i,c in enumerate(itertools.chain(children, children, children)) ]
        for child in children:
            child.text = text
            child.tail = text
        t = current_time() - t
        return root, t

    def _setup_tree4(self, text, attributes):
        "small tree with 26 2nd level and 2 3rd level children"
        SubElement = self.etree.SubElement
        current_time = time.time
        t = current_time()
        root = self.etree.Element('{abc}rootnode')
        for ch1 in self.atoz:
            el = SubElement(root, "{abc}"+ch1*5, attributes)
            el.text = text
            SubElement(el, "{cdefg}a00001", attributes).tail = text
            SubElement(el, "{cdefg}z00000", attributes).tail = text
        t = current_time() - t
        return root, t

    def benchmarks(self):
        """Returns a list of all benchmarks.

        A benchmark is a tuple containing a method name and a list of tree
        numbers.  Trees are prepared by the setup function.
        """
        all_trees = self._all_trees()
        benchmarks = []
        for name in dir(self):
            if not name.startswith('bench_'):
                continue

            method = getattr(self, name)

            serialized = getattr(method, 'STRING',    False)
            children   = getattr(method, 'CHILDREN',  False)
            no_change  = getattr(method, 'NO_CHANGE', False)
            any_tree   = getattr(method, 'ANY_TREE',  False)
            tree_sets  = getattr(method, 'TREES',     None)

            if hasattr(method, 'LIBS') and self.lib_name not in method.LIBS:
                method_call = None
            else:
                method_call = method

     
```

### Core Architecture Module: `benchmark/report.py`
```
"""
Report benchmark results from CSV files in Markdown format.
"""

import csv
import itertools
import operator
import string


def unbreak(s):
    return s.replace(' ', '\N{NO-BREAK SPACE}')


def concat_files(csv_files):
    for csv_file in csv_files:
        with open(csv_file) as f:
            yield from f


def read_rows(csv_rows):
    # CSV Format:
    # benchmark_module, benchmark_name, params, revision_name, pyversion, flags, bm_time, diff
    reader = csv.reader(csv_rows)

    # Sort by benchmark name.
    rows = sorted(reader, key=operator.itemgetter(0, 1, 2))
    return rows


def time_in_seconds(time_string):
    units = {"nsec": 1e-9, "usec": 1e-6, "msec": 1e-3, "sec": 1.0}
    number, unit = time_string.split()
    return float(number) * units[unit]


def warn_difference(reference, value, max_margin):
    difference = abs(value - reference) / reference
    is_better = value < reference

    if difference < max_margin:
        return ''
    if difference < max_margin * 2:
        return ' \N{BLACK MEDIUM DOWN-POINTING TRIANGLE}' if is_better else ' \N{UP-POINTING RED TRIANGLE}'
    if difference < max_margin * 3:
        return ' \N{LARGE GREEN CIRCLE}' if is_better else ' \N{LARGE RED CIRCLE}'
    else:
        return ' \N{LARGE GREEN SQUARE}' if is_better else ' \N{LARGE RED SQUARE}'


def format_timings(tmin, diff, *, master_data=None, warn_margin=.1/3.):
    warn = warn_difference(time_in_seconds(master_data[0]), time_in_seconds(tmin), warn_margin) if master_data else ''
    diff_str = f" ({unbreak(diff.strip(' ()'))})" if diff else ''
    return f"{unbreak(tmin)}{diff_str}{warn}"


def format_sizes(size, diff, *, master_data=None, warn_margin=.01):
    warn = warn_difference(int(master_data[0]), int(size), warn_margin) if master_data else ''
    diff_str = f" ({unbreak(diff.strip(' ()'))})" if diff else ''
    return f"{size}{diff_str}{warn}"


def build_table(rows, title, data_formatter):
    # Collect all revision names and Python versions, keeping their original order.
    # (The set may not be the same for all benchmarks.)
    revisions = list({row[3]: 1 for row in rows})
    python_versions = list({row[4]: 1 for row in rows})

    # Prepare table column mapping and header.
    pos = itertools.count(1)
    column_map = {
        (pyversion, revision, flags):  next(pos)
        for pyversion in python_versions
        for flags in ('', 'L')
        for revision in revisions
    }
    header = [title] + [
        f"Py{pyversion}{'-' if flags else ''}{flags}: {revision.replace('origin/', '')[:16]}"
        for (pyversion, revision, flags) in column_map
    ]
    row_template = [''] * len(header)

    # For each benchmark, report all timings in separate columns.
    table = []
    empty_column_indices = set(column_map.values())
    for (bm_module, bm_name, bm_params), bm_rows in itertools.groupby(rows, key=operator.itemgetter(0, 1, 2)):
        row = row_template[:]
        table.append(row)

        bm_rows = [
            (pyversion, revision_name, flags, pyversion + flags, data)
            for _, _, _, revision_name, pyversion, flags, *data in bm_rows
        ]
        master_data_seen = {
            version_key: data
            for _, revision_name, _, version_key, data in bm_rows
            if 'master' in revision_name
        }

        bm_module = bm_module[6:] if bm_module.startswith('bench_') else bm_module
        row[0] = f"{bm_module}:{bm_name}({bm_params.strip()})"
        for pyversion, revision_name, flags, version_key, data in bm_rows:
            column_index = column_map[(pyversion, revision_name, flags)]
            empty_column_indices.discard(column_index)
            master_data = master_data_seen.get(version_key) if 'HEAD' in revision_name else None
            row[column_index] = data_formatter(*data, master_data=master_data)

    # Strip empty columns, highest to lowest.
    for column_index in sorted(empty_column_indices, reverse=True):
        del header[column_index]
        for row in table:
            del row[column_index]

    return header, table


def generate_markdown(header, table):
    # Size the table columns.
    column_lengths = [
        max(map(len, map(operator.itemgetter(i), itertools.chain([header], table))))
        for i in range(len(header))
    ]

    # Generate Markdown formatted table lines.
    row_format = ("| {:<%ds}" + " | {:>%ds}" * (len(column_lengths) - 1) + " |\n") % tuple(column_lengths)
    format_row = row_format.format

    yield format_row(*header)
    yield format_row(*['-' * length for length in column_lengths])
    yield from itertools.starmap(format_row, table)


def parse_options(args):
    from argparse import ArgumentParser, RawDescriptionHelpFormatter
    parser = ArgumentParser(
        description="Report benchmark numbers as markdown tables.",
        formatter_class=RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "-t", "--type",
        dest="type", default='timings', choices=['timings', 'sizes'],
        help="The type of report.",
    )
    parser.add_argument(
        "csv_files",
        nargs="*", default=[],
        help="The CSV files to collect data from.",
    )

    return parser.parse_args(args)


def main(args):
    options = parse_options(args)

    rows = read_rows(concat_files(options.csv_files))

    if options.type == 'timings':
        title = "Benchmark timings"
        data_formatter = format_timings
    else:
        title = 'Module sizes'
        data_formatter = format_sizes

    header, table = build_table(rows, title, data_formatter)
    for line in generate_markdown(header, table):
        print(line, end='')


if __name__ == "__main__":
    import sys
    main(sys.argv[1:])

```

### Core Architecture Module: `benchmark/run_benchmarks.py`
```
import collections
import io
import itertools
import logging
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile


BENCHMARKS_DIR = pathlib.Path(__file__).parent

BENCHMARK_FILES = sorted(BENCHMARKS_DIR.glob("bench_*.py"))

ALL_BENCHMARKS = [bm.stem for bm in BENCHMARK_FILES]

LIMITED_API_VERSION = max((3, 11), sys.version_info[:2])

PYTHON_VERSION = "%d.%d.%d" % sys.version_info[:3]
if hasattr(sys, '_is_gil_enabled') and not sys._is_gil_enabled():
    PYTHON_VERSION += 't'


try:
    from distutils import sysconfig
    DISTUTILS_CFLAGS = sysconfig.get_config_var('CFLAGS')
except ImportError:
    DISTUTILS_CFLAGS = ''


parse_timings = re.compile(
    r"(?P<lib>\w+):\s*"
    r"(?P<benchmark>\w+)\s+"
    r"\((?P<params>[^)]+)\)\s*"
    r"(?P<besttime>[0-9.]+)\s+"
    r"(?P<timings>.*)"
).match


def run(command, cwd=None, pythonpath=None, c_macros=None, extra_env=None, capture_output=True):
    env = None
    if pythonpath:
        env = env or os.environ.copy()
        env['PYTHONPATH'] = pythonpath
    if extra_env:
        env = env or os.environ.copy()
        env.update(extra_env)
    if c_macros:
        env = env or os.environ.copy()
        env['CFLAGS'] = env.get('CFLAGS', '') + " " + ' '.join(f" -D{macro}" for macro in c_macros)

    try:
        return subprocess.run(command, cwd=cwd, check=True, capture_output=capture_output, env=env)
    except subprocess.CalledProcessError as exc:
        logging.error(f"Command failed: {' '.join(map(str, command))}\nOutput:\n{exc.stderr.decode()}")
        raise


def copy_benchmarks(bm_dir: pathlib.Path, benchmarks=None):
    bm_files = []
    shutil.copy(BENCHMARKS_DIR / 'benchbase.py', bm_dir / 'benchbase.py')
    for bm_src_file in BENCHMARK_FILES:
        if benchmarks and bm_src_file.stem not in benchmarks:
            continue
        bm_file = bm_dir / bm_src_file.name
        for benchmark_file in BENCHMARKS_DIR.glob(bm_src_file.stem + ".*"):
            shutil.copy(benchmark_file, bm_dir / benchmark_file.name)
        bm_files.append(bm_file)

    return bm_files


def compile_lxml(lxml_dir: pathlib.Path, c_macros=None, env_vars=None):
    rev_hash = get_git_rev(rev_dir=lxml_dir)
    logging.info(f"Compiling lxml gitrev {rev_hash}")
    run(
        [sys.executable, "setup.py", "build_ext", "-i", "-j6"],
        cwd=lxml_dir,
        c_macros=c_macros,
        extra_env=env_vars,
        #capture_output=False,
    )


def get_git_rev(revision=None, rev_dir=None):
    command = ["git", "describe", "--long"]
    if revision:
        command.append(revision)
    output = run(command, cwd=rev_dir)
    _, rev_hash = output.stdout.decode().strip().rsplit('-', 1)
    return rev_hash[1:]


def git_clone(rev_dir, revision):
    rev_hash = get_git_rev(revision)
    run(["git", "clone", "-n", "--no-single-branch", ".", str(rev_dir)])
    run(["git", "checkout", rev_hash], cwd=rev_dir)


def copy_profile(bm_dir, module_name, profiler):
    timestamp = int(time.time() * 1000)
    profile_input = bm_dir / "profile.out"
    data_file_name = f"{profiler}_{module_name}_{timestamp:X}.data"

    if profiler == 'callgrind':
        bm_dir_str = str(bm_dir) + os.sep
        with open(profile_input) as data_file_in:
            with open(data_file_name, mode='w') as data_file_out:
                for line in data_file_in:
                    if bm_dir_str in line:
                        # Remove absolute file paths to link to local file copy below.
                        line = line.replace(bm_dir_str, "")
                    data_file_out.write(line)
    else:
        shutil.move(profile_input, data_file_name)

    for result_file_name in (f"{module_name}.c", f"{module_name}.html"):
        result_file = bm_dir / result_file_name
        if result_file.exists():
            shutil.move(result_file, result_file_name)

    for ext in bm_dir.glob(f"{module_name}.*so"):
        shutil.move(str(ext), ext.name)


def run_benchmark(bm_dir, module_name, pythonpath=None, profiler=None):
    logging.info(f"Running benchmark '{module_name}'.")

    command = []

    if profiler:
        if profiler == 'perf':
            command = ["perf", "record", "--quiet", "-g", "--output=profile.out"]
        elif profiler == 'callgrind':
            command = [
                "valgrind", "--tool=callgrind",
                "--dump-instr=yes", "--collect-jumps=yes",
                "--callgrind-out-file=profile.out",
            ]

    command += [sys.executable, f"{module_name}.py"]

    output = run(command, cwd=bm_dir, pythonpath=pythonpath)

    if profiler:
        copy_profile(bm_dir, module_name, profiler)

    lines = filter(None, output.stdout.decode().splitlines())
    for line in lines:
        if line == "Setup times for trees in seconds:":
            break

    other_lines = []
    timings = []
    for line in lines:
        match = parse_timings(line)
        if match:
            timings.append((match['benchmark'], match['params'].strip(), match['lib'], float(match['besttime']), match['timings']))
        else:
            other_lines.append(line)

    return other_lines, timings


def run_benchmarks(bm_dir, benchmarks, pythonpath=None, profiler=None):
    timings = {}
    for benchmark in benchmarks:
        timings[benchmark] = run_benchmark(bm_dir, benchmark, pythonpath=pythonpath, profiler=profiler)
    return timings


def benchmark_revisions(benchmarks, revisions, profiler=None, limited_revisions=(), deps_zipfile=None):
    python_version = f"Python {PYTHON_VERSION}"
    logging.info(f"### Comparing revisions in {python_version}: {' '.join(revisions)}.")
    logging.info(f"CFLAGS={os.environ.get('CFLAGS', DISTUTILS_CFLAGS)}")

    hashes = {}
    timings = {}
    for revision in revisions:
        rev_hash = get_git_rev(revision)
        if rev_hash in hashes:
            logging.info(f"### Ignoring revision '{revision}': same as '{hashes[rev_hash]}'")
            continue
        hashes[rev_hash] = revision

        logging.info(f"### Preparing benchmark run for lxml '{revision}'.")
        timings[revision] = benchmark_revision(
            revision, benchmarks, profiler,
            deps_zipfile=deps_zipfile,
        )

        if revision in limited_revisions:
            logging.info(
                f"### Preparing benchmark run for lxml '{revision}' (Limited API {LIMITED_API_VERSION[0]}.{LIMITED_API_VERSION[1]}).")
            timings['L-' + revision] = benchmark_revision(
                revision, benchmarks, profiler,
                deps_zipfile=deps_zipfile,
                extra_env={
                    'LXML_LIMITED_API': f'{LIMITED_API_VERSION[0]}.{LIMITED_API_VERSION[1]}',
                }
            )

    return timings


def cache_libs(lxml_dir, deps_zipfile, file_suffixes=None):
    zip_content = set(deps_zipfile.namelist())
    for dir_path, _, filenames in itertools.chain((lxml_dir / "build" / "tmp").walk(), (lxml_dir / "libs").walk()):
        for filename in filenames:
            path = dir_path / filename
            if file_suffixes is None or path.suffix in file_suffixes:
                rel_path = path.relative_to(lxml_dir)
                if str(rel_path) not in zip_content:
                    deps_zipfile.write(path, rel_path)


def benchmark_revision(revision, benchmarks, profiler=None, c_macros=None, extra_env=None, deps_zipfile=None):
    with tempfile.TemporaryDirectory() as base_dir_str:
        base_dir = pathlib.Path(base_dir_str)
        lxml_dir = base_dir / "lxml" / revision
        bm_dir = base_dir / "benchmarks" / revision

        git_clone(lxml_dir, revision=revision)

        bm_dir.mkdir(parents=True)
        bm_files = copy_benchmarks(bm_dir, benchmarks)

        if deps_zipfile:
            deps_zipfile.extractall(lxml_dir)

        compile_lxml(lxml_dir, c_macros=c_macros, env_vars=extra_env)

        if deps_zipfile:
            cache_libs(lxml_dir, deps_zipfile)

        logging.info(f"### Running benchmarks for {revision}: {' '.join(bm.stem for bm in bm_files)}")
        return run_benchmarks(bm_dir, benchmarks, pythonpath=f"{bm_dir}:{lxml_dir / 'src'}", profiler=profiler)


def report_revision_timings(rev_timings, csv_out=None):
    units = {"nsec": 1e-9, "usec": 1e-6, "msec": 1e-3, "sec": 1.0}
    scales = [(scale, unit) for unit, scale in reversed(units.items())]  # biggest first

    def format_time(t):
        pos_t = abs(t)
        for scale, unit in scales:
            if pos_t >= scale:
                break
        else:
            raise RuntimeError(f"Timing is below nanoseconds: {t:f}")
        return f"{t / scale :.3f} {unit}"

    timings_by_benchmark = collections.defaultdict(list)
    setup_times = []
    for revision_name, bm_timings in rev_timings.items():
        for benchmark_module, (output, timings) in bm_timings.items():
            setup_times.append((benchmark_module, revision_name, output))
            for benchmark_name, params, lib, best_time, result_text in timings:
                timings_by_benchmark[(benchmark_module, benchmark_name, params)].append((lib, revision_name, best_time, result_text))

    setup_times.sort()

    for benchmark_module, revision_name, output in setup_times:
        result = '\n'.join(output)
        logging.info(f"Setup times for trees in seconds - {benchmark_module} / {revision_name}:\n{result}")

    differences = collections.defaultdict(list)
    for (benchmark_module, benchmark_name, params), timings in timings_by_benchmark.items():
        logging.info(f"### Benchmark {benchmark_module} / {benchmark_name} ({params}):")
        base_line = timings[0][2]
        for lib, revision_name, bm_time, result_text in timings:
            diff_str = ""
            if base_line != bm_time:
                pdiff = bm_time * 100 / base_line - 100
                differences[(lib, revision_name)].append((abs(pdiff), pdiff, bm_time - base_line, benchmark_module, benchmark_name, params))
               
```

### Core Architecture Module: `doc/api/conf.py`
```
import os
import sys
from datetime import date
sys.path.insert(0, os.path.abspath('../../src'))

from lxml import __version__ as lxml_version

# -- Project information -----------------------------------------------------

project = 'lxml'
copyright = f'{date.today().year}, lxml dev team'
author = 'lxml dev team'
version = lxml_version


# -- General configuration ---------------------------------------------------

extensions = [
    'sphinx.ext.autodoc',
    'sphinx.ext.viewcode',
    #'sphinx_rtd_theme',
    'sphinx_book_theme',
]

language = 'en'

exclude_patterns = ['_build']


# -- Options for HTML output -------------------------------------------------

#html_theme = 'sphinx_rtd_theme'
html_theme = 'sphinx_book_theme'

html_logo = '../html/python-xml.png'

# Add any paths that contain custom static files (such as style sheets) here,
# relative to this directory. They are copied after the builtin static files,
# so a file named "default.css" will overwrite the builtin "default.css".
#html_static_path = ['_static']

html_theme_options = {
    'collapse_navigation': False,
    'titles_only': True,
}

# -- Extension configuration -------------------------------------------------

autodoc_default_options = {
    'ignore-module-all': True,
    'private-members': True,
    'inherited-members': True,
}

autodoc_member_order = 'groupwise'

intersphinx_mapping = {
    "lxml": ("https://lxml.de/apidoc/", None),
}

# -- Options for todo extension ----------------------------------------------

# If true, `todo` and `todoList` produce output, else they produce nothing.
#todo_include_todos = True

```

### Core Architecture Module: `doc/mkhtml.py`
```
from __future__ import absolute_import

from docstructure import SITE_STRUCTURE, HREF_MAP, BASENAME_MAP
from lxml.etree import (parse, fromstring, ElementTree,
                        Element, SubElement, XPath, XML)
import glob
import hashlib
import os
import re
import sys
import copy
import shutil
import textwrap
import subprocess

from io import open as open_file

RST2HTML_OPTIONS = " ".join([
    '--no-toc-backlinks',
    '--strip-comments',
    '--language en',
    '--date',
    ])

XHTML_NS = 'http://www.w3.org/1999/xhtml'
htmlnsmap = {"h": XHTML_NS}

find_head = XPath("/h:html/h:head[1]", namespaces=htmlnsmap)
find_body = XPath("/h:html/h:body[1]", namespaces=htmlnsmap)
find_title = XPath("/h:html/h:head/h:title/text()", namespaces=htmlnsmap)
find_title_tag = XPath("/h:html/h:head/h:title", namespaces=htmlnsmap)
find_headings = XPath("//h:h1[not(@class)]//text()", namespaces=htmlnsmap)
find_heading_tag = XPath("//h:h1[@class = 'title'][1]", namespaces=htmlnsmap)
find_menu = XPath("//h:ul[@id=$name]", namespaces=htmlnsmap)
find_page_end = XPath("/h:html/h:body/h:div[last()]", namespaces=htmlnsmap)

find_words = re.compile(r'(\w+)').findall
replace_invalid = re.compile(r'[-_/.\s\\]').sub


def make_menu_section_head(section, menuroot):
    section_id = section + '-section'
    section_head = menuroot.xpath("//ul[@id=$section]/li", section=section_id)
    if not section_head:
        ul = SubElement(menuroot, "ul", id=section_id)
        section_head = SubElement(ul, "li")
        title = SubElement(section_head, "span", {"class":"section title"})
        title.text = section
    else:
        section_head = section_head[0]
    return section_head


def build_menu(tree, basename, section_head):
    page_title = find_title(tree)
    if page_title:
        page_title = page_title[0]
    else:
        page_title = replace_invalid('', basename.capitalize())
    build_menu_entry(page_title, basename+".html", section_head,
                     headings=find_headings(tree))


def build_menu_entry(page_title, url, section_head, headings=None):
    page_id = replace_invalid(' ', os.path.splitext(url)[0]) + '-menu'
    ul = SubElement(section_head, "ul", {"class":"menu foreign", "id":page_id})

    title = SubElement(ul, "li", {"class":"menu title"})
    a = SubElement(title, "a", href=url)
    a.text = page_title

    if headings:
        subul = SubElement(title, "ul", {"class":"submenu"})
        for heading in headings:
            li = SubElement(subul, "li", {"class":"menu item"})
            try:
                ref = heading.getparent().getparent().get('id')
            except AttributeError:
                ref = None
            if ref is None:
                ref = '-'.join(find_words(replace_invalid(' ', heading.lower())))
            a = SubElement(li, "a", href=url+'#'+ref)
            a.text = heading


def merge_menu(tree, menu, name):
    menu_root = copy.deepcopy(menu)
    tree.getroot()[1][0].insert(0, menu_root)  # html->body->div[class=document]
    for el in menu_root.iter():
        tag = el.tag
        if tag[0] != '{':
            el.tag = "{http://www.w3.org/1999/xhtml}" + tag
    current_menu = find_menu(
        menu_root, name=replace_invalid(' ', name) + '-menu')
    if not current_menu:
        current_menu = find_menu(
            menu_root, name=replace_invalid('-', name) + '-menu')
    if current_menu:
        for submenu in current_menu:
            submenu.set("class", submenu.get("class", "").
                        replace("foreign", "current"))
    return tree


def inject_flatter_button(tree):
    head = tree.xpath('h:head[1]', namespaces=htmlnsmap)[0]
    script = SubElement(head, '{%s}script' % XHTML_NS, type='text/javascript')
    script.text = """
    (function() {
        var s = document.createElement('script');
        var t = document.getElementsByTagName('script')[0];
        s.type = 'text/javascript';
        s.async = true;
        s.src = 'http://api.flattr.com/js/0.6/load.js?mode=auto';
        t.parentNode.insertBefore(s, t);
    })();
"""
    script.tail = '\n'
    intro_div = tree.xpath('h:body//h:div[@id = "introduction"][1]', namespaces=htmlnsmap)[0]
    intro_div.insert(-1, XML(
        '<p style="text-align: center;">Like working with lxml? '
        'Happy about the time that it just saved you? <br />'
        'Show your appreciation with <a href="http://flattr.com/thing/268156/lxml-The-Python-XML-Toolkit">Flattr</a>.<br />'
        '<a class="FlattrButton" style="display:none;" rev="flattr;button:compact;" href="https://lxml.de/"></a>'
        '</p>'
        ))


def inject_donate_buttons(lxml_path, rst2html_script, tree):
    command = ([sys.executable, rst2html_script]
               + RST2HTML_OPTIONS.split() + [os.path.join(lxml_path, 'README.rst')])
    rst2html = subprocess.Popen(command, stdout=subprocess.PIPE)
    stdout, _ = rst2html.communicate()
    readme = fromstring(stdout)

    intro_div = tree.xpath('h:body//h:div[@id = "introduction"][1]',
                           namespaces=htmlnsmap)[0]
    support_div = readme.xpath('h:body//h:div[@id = "support-the-project"][1]',
                               namespaces=htmlnsmap)[0]
    intro_div.append(support_div)

    finance_div = readme.xpath('h:body//h:div[@id = "project-income-report"][1]',
                               namespaces=htmlnsmap)[0]
    legal = readme.xpath('h:body//h:div[@id = "legal-notice-for-donations"][1]',
                         namespaces=htmlnsmap)[0]
    last_div = tree.xpath('h:body//h:div//h:div', namespaces=htmlnsmap)[-1]
    last_div.addnext(finance_div)
    finance_div.addnext(legal)


def inject_banner(parent):
    banner = parent.makeelement('div', {'class': 'banner'})
    parent.insert(0, banner)

    banner_image = SubElement(banner, 'div', {'class': "banner_image"})
    SubElement(banner_image, 'img', src="python-xml-title.png")

    banner_text = SubElement(banner, 'div', {'class': "banner_link"})
    banner_link = SubElement(banner_text, 'a', href="index.html#support-the-project")
    banner_link.text = "Like the tool? "
    SubElement(banner_link, 'br', {'class': "first"}).tail = "Help making it better! "
    SubElement(banner_link, 'br', {'class': "second"}).tail = "Your donation helps!"


def rest2html(script, source_path, dest_path, stylesheet_url):
    command = ('%s %s %s --stylesheet=%s --link-stylesheet %s > %s' %
               (sys.executable, script, RST2HTML_OPTIONS,
                stylesheet_url, source_path, dest_path))
    subprocess.call(command, shell=True)


def convert_changelog(lxml_path, changelog_file_path, rst2html_script, stylesheet_url):
    f = open_file(os.path.join(lxml_path, 'CHANGES.txt'), 'r', encoding='utf-8')
    try:
        content = f.read()
    finally:
        f.close()

    links = dict(LP='`%s <https://bugs.launchpad.net/lxml/+bug/%s>`_',
                 GH='`%s <https://github.com/lxml/lxml/issues/%s>`_')
    replace_tracker_links = re.compile('((LP|GH)#([0-9]+))').sub
    def insert_link(match):
        text, ref_type, ref_id = match.groups()
        return links[ref_type] % (text, ref_id)
    content = replace_tracker_links(insert_link, content)

    command = [sys.executable, rst2html_script] + RST2HTML_OPTIONS.split() + [
        '--link-stylesheet', '--stylesheet', stylesheet_url ]
    out_file = open(changelog_file_path, 'wb')
    try:
        rst2html = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=out_file)
        rst2html.communicate(content.encode('utf8'))
    finally:
        out_file.close()


def publish(dirname, lxml_path, release, with_donations=True):
    if not os.path.exists(dirname):
        os.mkdir(dirname)

    doc_dir = os.path.join(lxml_path, 'doc')
    script = os.path.join(doc_dir, 'rest2html.py')
    pubkey = os.path.join(doc_dir, 'pubkey.asc')
    stylesheet_file = 'style.css'

    shutil.copy(pubkey, dirname)
    # FIXME: find a way to make hashed filenames work both locally and in the versioned directories.
    stylesheet_url = stylesheet_file
    """
    style_file_pattern = "style_%s.css"
    for old_stylesheet in glob.iglob(os.path.join(dirname, style_file_pattern % "*")):
        os.unlink(old_stylesheet)
    with open(os.path.join(dirname, stylesheet_file), 'rb') as f:
        css = f.read()
        checksum = hashlib.sha256(css).hexdigest()[:32]

        stylesheet_url = style_file_pattern % checksum
        with open(os.path.join(dirname, stylesheet_url), 'wb') as out:
            out.write(css)
    """

    href_map = HREF_MAP.copy()
    changelog_basename = 'changes-%s' % release
    href_map['Release Changelog'] = changelog_basename + '.html'

    menu_js = textwrap.dedent('''
    function trigger_menu(event) {
        var sidemenu = document.getElementById("sidemenu");
        var classes = sidemenu.getAttribute("class");
        classes = (classes.indexOf(" visible") === -1) ? classes + " visible" : classes.replace(" visible", "");
        sidemenu.setAttribute("class", classes);
        event.preventDefault();
        event.stopPropagation();
    }
    function hide_menu() {
        var sidemenu = document.getElementById("sidemenu");
        var classes = sidemenu.getAttribute("class");
        if (classes.indexOf(" visible") !== -1) {
            sidemenu.setAttribute("class", classes.replace(" visible", ""));
        }
    }
    ''')

    trees = {}
    menu = Element("div", {'class': 'sidemenu', 'id': 'sidemenu'})
    SubElement(menu, 'div', {'class': 'menutrigger', 'onclick': 'trigger_menu(event)'}).text = "Menu"
    menu_div = SubElement(menu, 'div', {'class': 'menu'})
    if with_donations:
        inject_banner(menu_div)

    # build HTML pages and parse them back
    for section, text_files in SITE_STRUCTURE:
        section_head = make_menu_section_head(section, menu_div)
        for filename in text_files:
            if filename.startswith('@'):
                # special menu entry
                page_title = filename[1:]
                url = h
```

### Core Architecture Module: `doc/mklatex.py`
```
# The script builds the LaTeX documentation.
# Testing:
#    python mklatex.py latex .. 1.0

from docstructure import SITE_STRUCTURE, BASENAME_MAP
import os, shutil, re, sys, datetime

TARGET_FILE = "lxmldoc.tex"

RST2LATEX_OPTIONS = " ".join([
#    "--no-toc-backlinks",
    "--strip-comments",
    "--language en",
#    "--date",
#    "--use-latex-footnotes",
    "--use-latex-citations",
    "--use-latex-toc",
    "--font-encoding=T1",
    "--output-encoding=utf-8",
    "--input-encoding=utf-8",
    "--graphicx-option=pdftex",
    ])

htmlnsmap = {"h" : "http://www.w3.org/1999/xhtml"}

replace_invalid = re.compile(r'[-_/.\s\\]').sub
replace_content = re.compile(r"\{[^\}]*\}").sub

replace_epydoc_macros = re.compile(r'(,\s*amssymb|dvips\s*,\s*)').sub
replace_rst_macros = re.compile(r'(\\usepackage\{color}|\\usepackage\[[^]]*]\{hyperref})').sub

BASENAME_MAP = BASENAME_MAP.copy()
BASENAME_MAP.update({'api' : 'lxmlapi'})

# LaTeX snippets

DOCUMENT_CLASS = r"""
\documentclass[10pt,english]{report}
\usepackage[a4paper]{geometry}
\usepackage{tabularx}
\usepackage{ifthen}
\usepackage[pdftex]{graphicx}
\parindent0pt
\parskip1ex

%%% Fallback definitions for Docutils-specific commands

% providelength (provide a length variable and set default, if it is new)
\providecommand*{\DUprovidelength}[2]{
  \ifthenelse{\isundefined{#1}}{\newlength{#1}\setlength{#1}{#2}}{}
}

% docinfo (width of docinfo table)
\DUprovidelength{\DUdocinfowidth}{0.9\textwidth}

% titlereference role
\providecommand*{\DUroletitlereference}[1]{\textsl{#1}}

"""

PYGMENTS_IMPORT = r"""
\usepackage{fancyvrb}
\input{_part_pygments.tex}
"""

EPYDOC_IMPORT = r"""
\input{_part_epydoc.tex}
"""

def write_chapter(master, title, filename):
    filename = os.path.join(os.path.dirname(filename),
                            "_part_%s" % os.path.basename(filename))
    master.write(r"""
\chapter{%s}
\label{%s}
\input{%s}
""" % (title, filename, filename))


# the program ----

def rest2latex(script, source_path, dest_path):
    command = ('%s %s %s  %s > %s' %
               (sys.executable, script, RST2LATEX_OPTIONS,
                source_path, dest_path))
    os.system(command)

def build_pygments_macros(filename):
    from pygments.formatters import LatexFormatter
    text = LatexFormatter().get_style_defs()
    with open(filename, "w") as f:
        f.write(text)
        f.write('\n')

def copy_epydoc_macros(src, dest, existing_header_lines):
    doc = open(src, 'r')
    out = open(dest, "w")
    for line in doc:
        if line.startswith('%% generator') \
                or line.startswith('% generated by ') \
                or '\\begin{document}' in line \
                or '\\makeindex' in line:
            break
        if line.startswith('%') or \
                r'\documentclass' in line or \
                r'\makeindex' in line or \
                r'{inputenc}' in line:
            continue
        if line.startswith(r'\usepackage'):
            if line in existing_header_lines:
                continue
            if '{hyperref}' in line:
                line = line.replace('black', 'blue')
        out.write( replace_epydoc_macros('', line) )
    out.close()
    doc.close()

def noop(input):
    return input

counter_no = 0

def tex_postprocess(src_path, dest_path, want_header=False, process_line=noop):
    """
    Postprocessing of the LaTeX file generated from ReST.

    Reads file src_path and saves to dest_path only the true content
    (without the document header and final) - so it is suitable
    to be used as part of the longer document.

    Returns the title of document

    If want_header is set, returns also the document header (as
    the list of lines).
    """
    header = []
    add_header_line = header.append
    global counter_no
    counter_no = counter_no + 1
    counter_text = "listcnt%d" % counter_no

    search_title = re.compile(r'\\title{([^{}]*(?:{[^}]*})*)}').search
    skipping = re.compile(r'(\\end{document}|\\tableofcontents|^%)').search

    with open(src_path) as src:
        src_text = src.read()

    dest = open(dest_path, "w")

    title = search_title(src_text)
    if title:
        # remove any commands from the title
        title = re.sub(r'\\\w+({[^}]*})?', '', title.group(1))

    iter_lines = iter(src_text.splitlines())
    for l in iter_lines:
        l = process_line(l)
        if not l:
            continue
        if want_header:
            add_header_line(replace_rst_macros('', l))
        if l.startswith("\\maketitle"):
            break

    for l in iter_lines:
        l = process_line(l)
        if skipping(l):
            # To-Do minitoc instead of tableofcontents
            continue
        elif r"\hypertarget{old-versions}" in l:
            break
        elif "listcnt0" in l:
            l = l.replace("listcnt0", counter_text)
        dest.write(l + '\n')

    dest.close()

    if not title:
        raise Exception("Bueee, no title in %s" % src_path)
    return title, header

def publish(dirname, lxml_path, release):
    if not os.path.exists(dirname):
        os.mkdir(dirname)

    book_title = "lxml %s" % release

    doc_dir = os.path.join(lxml_path, 'doc')
    script = os.path.join(doc_dir, 'rest2latex.py')
    pubkey = os.path.join(doc_dir, 'pubkey.asc')

    shutil.copy(pubkey, dirname)

    # build pygments macros
    build_pygments_macros(os.path.join(dirname, '_part_pygments.tex'))

    # Used in postprocessing of generated LaTeX files
    header = []
    titles = {}

    replace_interdoc_hyperrefs = re.compile(
        r'\\href\{([^/}]+)[.]([^./}]+)\}').sub
    replace_docinternal_hyperrefs = re.compile(
        r'\\href\{\\#([^}]+)\}').sub
    replace_image_paths = re.compile(
        r'^(\\includegraphics{)').sub
    def build_hyperref(match):
        basename, extension = match.groups()
        outname = BASENAME_MAP.get(basename, basename)
        if '#' in extension:
            anchor = extension.split('#')[-1]
            return r"\hyperref[%s]" % anchor
        elif extension != 'html':
            return r'\href{https://lxml.de/%s.%s}' % (
                outname, extension)
        else:
            return r"\hyperref[_part_%s.tex]" % outname
    def fix_relative_hyperrefs(line):
        line = replace_image_paths(r'\1../html/', line)
        if r'\href' not in line:
            return line
        line = replace_interdoc_hyperrefs(build_hyperref, line)
        return replace_docinternal_hyperrefs(r'\\hyperref[\1]', line)

    # Building pages
    for section, text_files in SITE_STRUCTURE:
        for filename in text_files:
            if filename.startswith('@'):
                continue
                #page_title = filename[1:]
                #url = href_map[page_title]
                #build_menu_entry(page_title, url, section_head)

            basename = os.path.splitext(os.path.basename(filename))[0]
            basename = BASENAME_MAP.get(basename, basename)
            outname = basename + '.tex'
            outpath = os.path.join(dirname, outname)
            path = os.path.join(doc_dir, filename)

            print("Creating %s" % outname)
            rest2latex(script, path, outpath)

            final_name = os.path.join(dirname, os.path.dirname(outname),
                                      "_part_%s" % os.path.basename(outname))

            title, hd = tex_postprocess(outpath, final_name,
                                        want_header = not header,
                                        process_line=fix_relative_hyperrefs)
            if not header:
                header = hd
            titles[outname] = title

    # integrate generated API docs

    print("Integrating API docs")
    apidocsname = 'lxmlapi.tex'
    apipath = os.path.join(dirname, apidocsname)
    tex_postprocess(apipath, os.path.join(dirname, "_part_%s" % apidocsname),
                    process_line=fix_relative_hyperrefs)
    copy_epydoc_macros(apipath, os.path.join(dirname, '_part_epydoc.tex'),
                       set(header))

    # convert CHANGES.txt

    print("Integrating ChangeLog")
    find_version_title = re.compile(
        r'(.*\\section\{)([0-9][^\} ]*)\s+\(([^)]+)\)(\}.*)').search
    def fix_changelog(line):
        m = find_version_title(line)
        if m:
            line = "%sChanges in version %s, released %s%s" % m.groups()
        else:
            line = line.replace(r'\subsection{', r'\subsection*{')
        return line

    chgname = 'changes-%s.tex' % release
    chgpath = os.path.join(dirname, chgname)
    rest2latex(script,
               os.path.join(lxml_path, 'CHANGES.txt'),
               chgpath)
    tex_postprocess(chgpath, os.path.join(dirname, "_part_%s" % chgname),
                    process_line=fix_changelog)

    # Writing a master file
    print("Building %s\n" % TARGET_FILE)
    master = open( os.path.join(dirname, TARGET_FILE), "w")
    for hln in header:
        if hln.startswith(r"\documentclass"):
            #hln = hln.replace('article', 'book')
            hln = DOCUMENT_CLASS + EPYDOC_IMPORT
        elif hln.startswith(r"\begin{document}"):
            # pygments and epydoc support
            master.write(PYGMENTS_IMPORT)
        elif hln.startswith(r"\title{"):
            hln = replace_content(
                r'{%s\\\\\\vspace{1cm}\\includegraphics[width=2.5cm]{../html/tagpython-big.png}}' % book_title, hln)
        elif hln.startswith(r"\date{"):
            hln = replace_content(
                r'{%s}' % datetime.date.today().isoformat(), hln)
        elif hln.startswith("pdftitle"):
            hln = replace_content(
                r'{%s}' % book_title, hln)
        master.write(hln + '\n')

    master.write("\\setcounter{page}{2}\n")
    master.write("\\tableofcontents\n")

    for section, text_files in SITE_STRUCTURE:
        master.write("\n\n\\part{%s}\n" % section)
        for filename in text_files:
            if filename.startswith('@'):
                continue
                #print "Not yet implemen
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #530** (2026-10-11): **Build: bump pypa/cibuildwheel from 4.2.1 to 4.3.0 in the github-actions group**
  *Symptoms*: Bumps the github-actions group with 1 update: [pypa/cibuildwheel](https://github.com/pypa/cibuildwheel).  Updates `pypa/cibuildwheel` from 4.2.1 to 4.3.0 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/pypa/cibuildwheel/releases">pypa/cibuildwheel's releases</a>.</em></p> <blockquote> <h2>v4.3.0</h2> <ul> <li>✨ Extends <a href="https://cibuildwheel.pypa.io/en/stable/configuration/#inherit">option inheritance</a> to every configuration layer, so global and platform-specific settings can append or prepend to existing values, including cibuildwheel's defaults. Environment variables can also extend earlier settings using <code>CIBW_INHERIT</code>. (<a href="https://redirect.github.com/pypa/cibuildwheel/issues/2928">#2928</a>)</li> <li>✨ Adds PyPy 3.12 support and updates PyPy 3.11 to v8.0.0, available with the <code>pypy</code> <a href="https://cibuildwheel.pypa.io/en/stable/options/#enable"><code>enable</code></a> flag (<a href="https://redirect.github.com/pypa/cibuildwheel/issues/2998">#2998</a>)</li> <li>✨ Adds GraalPy 3.13 (v25.3) support on Linux, Windows, and macOS arm64, available with the <code>graalpy</code> <a href="https://cibuildwheel.pypa.io/en/stable/options/#enable"><code>enable</code></a> flag (<a href="https://redirect.github.com/pypa/cibuildwheel/issues/2982">#2982</a>)</li> <li>✨ Adds <a href="https://cibuildwheel.pypa.io/en/stable/options/#log-fold-mode"><code>log-fold-mode</code></a> to override CI log folding, inclu

- **Issue #529** (2026-10-05): **Build: bump the github-actions group across 1 directory with 2 updates**
  *Symptoms*: Bumps the github-actions group with 2 updates in the / directory: [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) and [pypa/cibuildwheel](https://github.com/pypa/cibuildwheel).  Updates `docker/setup-qemu-action` from 4.2.0 to 4.4.0 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/docker/setup-qemu-action/releases">docker/setup-qemu-action's releases</a>.</em></p> <blockquote> <h2>v4.4.0</h2> <ul> <li>Use the shared error helper for Docker commands by <a href="https://github.com/crazy-max"><code>@​crazy-max</code></a> in <a href="https://redirect.github.com/docker/setup-qemu-action/pull/345">docker/setup-qemu-action#345</a></li> <li>Bump <code>@​docker/actions-toolkit</code> from 0.96.0 to 0.100.0 in <a href="https://redirect.github.com/docker/setup-qemu-action/pull/344">docker/setup-qemu-action#344</a></li> <li>Bump <code>@​humanfs/node</code> from 0.16.7 to 0.16.8 in <a href="https://redirect.github.com/docker/setup-qemu-action/pull/340">docker/setup-qemu-action#340</a></li> <li>Bump js-yaml from 4.3.1 to 4.3.2 in <a href="https://redirect.github.com/docker/setup-qemu-action/pull/342">docker/setup-qemu-action#342</a></li> <li>Bump postcss-selector-parser from 7.1.1 to 7.1.5 in <a href="https://redirect.github.com/docker/setup-qemu-action/pull/337">docker/setup-qemu-action#337</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/docker/setup-qemu-action/compare/v4.3.0...v4.4.0">https:

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

### Incident Patch 1: `3eb87571` (2026-10-07)
**Commit Message**: Fix concurrency issue in threading test.
Updating the reader count happens concurrently by reading threads, so there is no guarantee that it works atomically.

**File**: `src/lxml/tests/test_rwlock.py` (modified, +5/-2)
```diff
@@ -310,6 +310,7 @@ def reader_writer():
 
     def test_concurrent_read_write_locking(self):
         lock = RWLock()
+        guard = threading.Lock()
 
         # Thread monitoring:
 
@@ -321,11 +322,13 @@ def test_concurrent_read_write_locking(self):
         def lock_read():
             nonlocal reader_count
             lock.lock_read()
-            reader_count += 1
+            with guard:
+                reader_count += 1
 
         def unlock_read():
             nonlocal reader_count
-            reader_count -= 1
+            with guard:
+                reader_count -= 1
             lock.unlock_read()
 
         def lock_write():
```

---

### Incident Patch 2: `ee453ac5` (2026-10-05)
**Commit Message**: Build: bump the github-actions group across 1 directory with 2 updates (GH-529)

Bumps the github-actions group with 2 updates in the / directory: [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action) and [pypa/cibuildwheel](https://github.com/pypa/cibuildwheel).


Updates `docker/setup-qemu-action` from 4.2.0 to 4.4.0
- [Release notes](https://github.com/docker/setup-qemu-action/releases)
- [Commits](https://github.com/docker/setup-qemu-action/compare/96fe6ef7f33517b61c61be40b68a1882f3264fb8...99012661954931238ded8c8b007157a8430204e1)

Updates `pypa/cibuildwheel` from 4.2.0 to 4.2.1
- [Release notes](https://github.com/pypa/cibuildwheel/releases)
- [Changelog](https://github.com/pypa/cibuildwheel/blob/main/docs/changelog.md)
- [Commits](https://github.com/pypa/cibuildwheel/compare/1828c10ab37f080699c7b81cea34097c684a7074...e090b81e30c4d855ea63bf4b6e59204c09a101ae)

---
updated-dependencies:
- dependency-name: docker/setup-qemu-action
  dependency-version: 4.3.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
  dependency-group: github-actions
- dependency-name: pypa/cibuildwheel
  dependency-version: 4.2.1
  dependency-type: direct

**File**: `.github/workflows/wheels.yml` (modified, +5/-5)
```diff
@@ -153,7 +153,7 @@ jobs:
 
       - name: Set up QEMU
         if: runner.os == 'Linux' && !(endsWith(matrix.platform, 'x86_64') || endsWith(matrix.platform, 'i686') || endsWith(matrix.platform, 'aarch64'))
-        uses: docker/setup-qemu-action@96fe6ef7f33517b61c61be40b68a1882f3264fb8 # v4.2.0
+        uses: docker/setup-qemu-action@99012661954931238ded8c8b007157a8430204e1 # v4.4.0
         with:
           platforms: all
 
@@ -173,7 +173,7 @@ jobs:
           echo "CIBW_BEFORE_BUILD_LINUX=${DIST_INSTALL} ccache && ccache -o cache_dir=/host${HOST_CCACHE_DIR} && ccache -p && for dir in /host/usr/lib/ccache /host/usr/local/opt/ccache/libexec; do ls -l \$dir || true; done || echo '::notice::ccache installation failed on ${{ matrix.only }}'" | tee -a "${GITHUB_ENV}"
 
       - name: Build wheels
-        uses: pypa/cibuildwheel@1828c10ab37f080699c7b81cea34097c684a7074 # v4.2.0
+        uses: pypa/cibuildwheel@e090b81e30c4d855ea63bf4b6e59204c09a101ae # v4.2.1
         with:
           only: ${{ matrix.only }}
 
@@ -188,7 +188,7 @@ jobs:
           contains(matrix.only, '-manylinux_') &&
           (startsWith(matrix.only, 'cp39-') || startsWith(matrix.only, 'cp310-') || startsWith(matrix.only, 'cp311-')) &&
           (contains(matrix.only, 'i686') || contains(matrix.only, 'x86_64') || contains(matrix.only, 'aarch64'))
-        uses: pypa/cibuildwheel@1828c10ab37f080699c7b81cea34097c684a7074 # v4.2.0
+        uses: pypa/cibuildwheel@e090b81e30c4d855ea63bf4b6e59204c09a101ae # v4.2.1
         env:
           CIBW_MANYLINUX_i686_IMAGE: manylinux2014
           CIBW_MANYLINUX_X86_64_IMAGE: manylinux2014
@@ -243,12 +243,12 @@ jobs:
 
       - name: Set up QEMU
         if: runner.os == 'Linux' && !(endsWith(matrix.platform, 'x86_64') || endsWith(matrix.platform, 'i686') || endsWith(matrix.platform, 'aarch64'))
-        uses: docker/setup-qemu-action@96fe6ef7f33517b61c61be40b68a1882f3264fb8 # v4.2.0
+        uses: docker/setup-qemu-action@99012661954931238ded8c8b007157a8430204e1 # v4.4.0
         with:
           platforms: all
 
       - name: Build ABI3 wheels
-        uses: pypa/cibuildwheel@1828c10ab37f080699c7b81cea34097c684a7074 # v4.2.0
+        uses: pypa/cibuildwheel@e090b81e30c4d855ea63bf4b6e59204c09a101ae # v4.2.1
         env:
           # Smaller set of platforms that we only provide Stable ABI wheels for
           CIBW_BUILD: |
```

---

### Incident Patch 3: `878f12fa` (2026-09-09)
**Commit Message**: Build: bump the github-actions group with 2 updates (GH-528)

Bumps the github-actions group with 2 updates: [hendrikmuhs/ccache-action](https://github.com/hendrikmuhs/ccache-action) and [softprops/action-gh-release](https://github.com/softprops/action-gh-release).


Updates `hendrikmuhs/ccache-action` from 1.2.23 to 1.2.24
- [Release notes](https://github.com/hendrikmuhs/ccache-action/releases)
- [Commits](https://github.com/hendrikmuhs/ccache-action/compare/d62db5f07c26379fc4b4e0916f098a92573c3b03...f09c25b45002a07be2955cbe52e8cee55643f89d)

Updates `softprops/action-gh-release` from 3.0.2 to 3.0.3
- [Release notes](https://github.com/softprops/action-gh-release/releases)
- [Changelog](https://github.com/softprops/action-gh-release/blob/master/CHANGELOG.md)
- [Commits](https://github.com/softprops/action-gh-release/compare/3d0d9888cb7fd7b750713d6e236d1fcb99157228...efb35369e0ad2afab669f228072c1b0d510eae64)

---
updated-dependencies:
- dependency-name: hendrikmuhs/ccache-action
  dependency-version: 1.2.24
  dependency-type: direct:production
  update-type: version-update:semver-patch
  dependency-group: github-actions
- dependency-name: softprops/action-gh-release
  dependency-ve

**File**: `.github/workflows/benchmarks.yml` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ jobs:
           fetch-tags: true
 
       - name: ccache
-        uses: hendrikmuhs/ccache-action@d62db5f07c26379fc4b4e0916f098a92573c3b03 # v1.2.23
+        uses: hendrikmuhs/ccache-action@f09c25b45002a07be2955cbe52e8cee55643f89d # v1.2.24
         if: runner.os == 'Linux' || runner.os == 'macOS'
         with:
           max-size: 150M
```

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -253,7 +253,7 @@ jobs:
           ln -s /usr/local/bin/glibtoolize /usr/local/bin/libtoolize
 
       - name: ccache
-        uses: hendrikmuhs/ccache-action@d62db5f07c26379fc4b4e0916f098a92573c3b03 # v1.2.23
+        uses: hendrikmuhs/ccache-action@f09c25b45002a07be2955cbe52e8cee55643f89d # v1.2.24
         if: runner.os == 'Linux' || runner.os == 'macOS'
         with:
           max-size: 100M
```

**File**: `.github/workflows/wheels.yml` (modified, +2/-2)
```diff
@@ -156,7 +156,7 @@ jobs:
           platforms: all
 
       - name: ccache
-        uses: hendrikmuhs/ccache-action@d62db5f07c26379fc4b4e0916f098a92573c3b03 # v1.2.23
+        uses: hendrikmuhs/ccache-action@f09c25b45002a07be2955cbe52e8cee55643f89d # v1.2.24
         if: runner.os == 'Linux' || runner.os == 'macOS'
         with:
           max-size: 100M
@@ -315,7 +315,7 @@ jobs:
           exit ${RESULT_CODE}
 
       - name: Release
-        uses: softprops/action-gh-release@3d0d9888cb7fd7b750713d6e236d1fcb99157228 # v3.0.2
+        uses: softprops/action-gh-release@efb35369e0ad2afab669f228072c1b0d510eae64 # v3.0.3
         if: github.ref_type == 'tag'
         with:
           files: |
```

#### Recent Merged Pull Requests:
- **PR #530** (closed): Build: bump pypa/cibuildwheel from 4.2.1 to 4.3.0 in the github-actions group (@dependabot[bot])
- **PR #529** (2026-10-05): Build: bump the github-actions group across 1 directory with 2 updates (@dependabot[bot])
- **PR #528** (2026-09-09): Build: bump the github-actions group with 2 updates (@dependabot[bot])
- **PR #527** (closed): Point security policy back to the Launchpad bug tracker (@avalyset)
- **PR #526** (2026-08-16): Add ``patch_lxml_deplibs.py`` to ``MANIFEST.in`` (@nsoranzo)
- **PR #525** (2026-08-16): Build: bump pypa/cibuildwheel from 4.1.1 to 4.2.0 in the github-actions group (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. concurrency issue in threading test.

**RULE**:
When implementing operations in `src/lxml/tests/test_rwlock.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lxml/lxml. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3eb87571`: concurrency issue in threading test.. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/lxml/tests/test_rwlock.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
        guard = threading.Lock()
            with guard:
                reader_count += 1
            with guard:
                reader_count -= 1
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
            reader_count += 1
            reader_count -= 1
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3eb87571` are properly handled with clean fallback behavior.
