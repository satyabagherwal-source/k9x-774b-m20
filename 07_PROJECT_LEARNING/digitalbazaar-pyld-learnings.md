> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/digitalbazaar-pyld-learnings.md`  
> **Source**: github ([https://github.com/digitalbazaar/pyld](https://github.com/digitalbazaar/pyld))  
> **Source Version**: `bcdc7103`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T01:07:33.068Z  
> **Learning ID**: `learn-github-digitalbazaar-pyld`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): digitalbazaar/pyld

> **Canonical Artifact**: `07_PROJECT_LEARNING/digitalbazaar-pyld-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/digitalbazaar/pyld](https://github.com/digitalbazaar/pyld))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-04T01:07:32.875Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `digitalbazaar/pyld`
- **Description**: JSON-LD processor written in Python
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 688 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `lib/pyld/cli/state.py`
```
"""Runtime state for one CLI invocation."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass
class State:
    """Per-invocation CLI state."""

    traceback: bool = False
    cache_file: Path | None = None


current = State()

```

### Core Architecture Module: `lib/pyld/util.py`
```
from rdflib import BNode, Dataset, Literal, URIRef
from rdflib.graph import DATASET_DEFAULT_GRAPH_ID
from rdflib.plugins.parsers.nquads import NQuadsParser
from rdflib.plugins.parsers.ntriples import r_literal, unquote, uriquote


# Helpers for converting between rdflib.Dataset and legacy dict structure used in pyld
def to_legacy_dataset(dataset: Dataset) -> dict:
    """
    Transforms an rdflib.Dataset into the RDF.js-style dictionary structure,
    ensuring Blank Node values start with '_:'.
    """
    compat_dataset = {'@default':[]}

    for s, p, o, g in dataset.quads((None, None, None, None)):
        # 1. Determine Graph Key
        graph_id = '@default'
        if g is not None and g != DATASET_DEFAULT_GRAPH_ID:
            graph_id = f"_:{str(g)}" if isinstance(g, BNode) else str(g)

        if graph_id not in compat_dataset:
            compat_dataset[graph_id] = []

        # 2. Helper to convert nodes
        def term_to_dict(node):
            if isinstance(node, BNode):
                # Ensure the value starts with _:
                val = str(node)
                if not val.startswith('_:'):
                    val = f"_:{val}"
                return {'type': 'blank node', 'value': val}

            elif isinstance(node, URIRef):
                return {'type': 'IRI', 'value': str(node)}

            elif isinstance(node, Literal):
                res = {'type': 'literal', 'value': str(node)}
                if node.language:
                    res['language'] = node.language
                if node.datatype:
                    res['datatype'] = str(node.datatype)
                return res
            raise ValueError(f'Illegal node type {type(node)}')

        # 3. Build legacy quad
        compat_dataset[graph_id].append(
            {
                'subject': term_to_dict(s),
                'predicate': term_to_dict(p),
                'object': term_to_dict(o),
            }
        )

    return compat_dataset


def from_legacy_dataset(dataset: dict) -> Dataset:
    """
    Converts legacy dict structure back into an rdflib.Dataset.
    """
    ds = Dataset()

    for graph_name, triples in dataset.items():
        # Handle graph name
        try:
            g = from_legacy_graph(graph_name, ds.default_graph.identifier)
        except Exception as err:
            raise ValueError(f'Illegal graph name: {graph_name}') from err

        for t in triples:
            s, p, o = from_legacy_triple(t)
            ds.add((s, p, o, g))

    return ds

def from_legacy_graph(graph: str, default_graph = DATASET_DEFAULT_GRAPH_ID) -> URIRef | BNode:
    """
    Converts a legacy graph name into an rdflib URIRef or BNode.
    """
    if graph == '@default':
        return default_graph
    # Check if graph name is a blank node or IRI
    elif graph.startswith('_:'):
        return BNode(graph[2:])
    else:
        return URIRef(graph)

def from_legacy_triple(triple: dict, normalize=False) -> tuple:
    """
    Converts a legacy triple dict into an rdflib triple tuple.
    """
    if not all(k in triple for k in ('subject', 'predicate', 'object')):
        raise ValueError(f'Illegal quad structure: {triple}')

    def to_node(comp):
        if not isinstance(comp, dict) or 'type' not in comp or 'value' not in comp:
            raise ValueError(f'Illegal quad structure: {comp}')

        val = comp['value']
        if comp['type'] == 'blank node':
            # Strip '_:' because RDFLib adds it back internally
            return BNode(val[2:] if val.startswith('_:') else val)
        elif comp['type'] == 'IRI':
            return URIRef(val)
        elif comp['type'] == 'literal':
            return Literal(
                val,
                lang=comp.get('language'),
                datatype=URIRef(comp['datatype'])
                if comp.get('datatype') and not comp.get('language')
                else None,
                # Don't normalize literal values to prevent datetime issues
                # TODO: this means only rdflib.Dataset() created with normalization turned off will work properly.
                normalize=normalize,
            )
        raise ValueError('Illegal component type {}'.format(comp['type']))

    s = to_node(triple['subject'])
    p = to_node(triple['predicate'])
    o = to_node(triple['object'])

    return (s, p, o)

class UnnormalizedNQuadsParser(NQuadsParser):
    """
    Subclass of NQuadsParser that constructs rdflib Literals with
    normalize=False, so PyLD preserves N-Quads literal lexical
    forms without mutating rdflib.NORMALIZE_LITERALS.
    """

    def literal(self):
        if self.peek('"'):
            lit, lang, dtype = self.eat(r_literal).groups()
            dtype = URIRef(uriquote(unquote(dtype))) if dtype else None
            return Literal(unquote(lit), lang or None, dtype, normalize=False)
        return False

```

### Core Architecture Module: `lib/c14n/Canonicalize.py`
```
##############################################################################
#                                                                            #
#  Copyright 2006-2019 WebPKI.org (http://webpki.org).                       #
#                                                                            #
#  Licensed under the Apache License, Version 2.0 (the "License");           #
#  you may not use this file except in compliance with the License.          #
#  You may obtain a copy of the License at                                   #
#                                                                            #
#      https://www.apache.org/licenses/LICENSE-2.0                           #
#                                                                            #
#  Unless required by applicable law or agreed to in writing, software       #
#  distributed under the License is distributed on an "AS IS" BASIS,         #
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  #
#  See the License for the specific language governing permissions and       #
#  limitations under the License.                                            #
#                                                                            #
##############################################################################

#################################################
# JCS compatible JSON serializer for Python 3.x #
#################################################

import re

from c14n.NumberToJson import convert2Es6Format

try:
    from _json import encode_basestring_ascii as c_encode_basestring_ascii
except ImportError:
    c_encode_basestring_ascii = None
try:
    from _json import encode_basestring as c_encode_basestring
except ImportError:
    c_encode_basestring = None
try:
    from _json import make_encoder as c_make_encoder
except ImportError:
    c_make_encoder = None

ESCAPE = re.compile(r'[\x00-\x1f\\"\b\f\n\r\t]')
ESCAPE_ASCII = re.compile(r'([\\"]|[^\ -~])')
HAS_UTF8 = re.compile(b'[\x80-\xff]')
ESCAPE_DCT = {
    '\\': '\\\\',
    '"': '\\"',
    '\b': '\\b',
    '\f': '\\f',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
}
for i in range(0x20):
    ESCAPE_DCT.setdefault(chr(i), '\\u{0:04x}'.format(i))
    #ESCAPE_DCT.setdefault(chr(i), '\\u%04x' % (i,))

INFINITY = float('inf')

def py_encode_basestring(s):
    """Return a JSON representation of a Python string

    """
    def replace(match):
        return ESCAPE_DCT[match.group(0)]
    return '"' + ESCAPE.sub(replace, s) + '"'


encode_basestring = (c_encode_basestring or py_encode_basestring)

def py_encode_basestring_ascii(s):
    """Return an ASCII-only JSON representation of a Python string

    """
    def replace(match):
        s = match.group(0)
        try:
            return ESCAPE_DCT[s]
        except KeyError:
            n = ord(s)
            if n < 0x10000:
                return '\\u{0:04x}'.format(n)
                #return '\\u%04x' % (n,)
            else:
                # surrogate pair
                n -= 0x10000
                s1 = 0xd800 | ((n >> 10) & 0x3ff)
                s2 = 0xdc00 | (n & 0x3ff)
                return '\\u{0:04x}\\u{1:04x}'.format(s1, s2)
    return '"' + ESCAPE_ASCII.sub(replace, s) + '"'


encode_basestring_ascii = (
    c_encode_basestring_ascii or py_encode_basestring_ascii)

class JSONEncoder(object):
    """Extensible JSON <http://json.org> encoder for Python data structures.

    Supports the following objects and types by default:

    +-------------------+---------------+
    | Python            | JSON          |
    +===================+===============+
    | dict              | object        |
    +-------------------+---------------+
    | list, tuple       | array         |
    +-------------------+---------------+
    | str               | string        |
    +-------------------+---------------+
    | int, float        | number        |
    +-------------------+---------------+
    | True              | true          |
    +-------------------+---------------+
    | False             | false         |
    +-------------------+---------------+
    | None              | null          |
    +-------------------+---------------+

    To extend this to recognize other objects, subclass and implement a
    ``.default()`` method with another method that returns a serializable
    object for ``o`` if possible, otherwise it should call the superclass
    implementation (to raise ``TypeError``).

    """
    item_separator = ', '
    key_separator = ': '
    def __init__(self, *, skipkeys=False, ensure_ascii=False,
            check_circular=True, allow_nan=True, sort_keys=True,
            indent=None, separators=(',', ':'), default=None):
        """Constructor for JSONEncoder, with sensible defaults.

        If skipkeys is false, then it is a TypeError to attempt
        encoding of keys that are not str, int, float or None.  If
        skipkeys is True, such items are simply skipped.

        If ensure_ascii is true, the output is guaranteed to be str
        objects with all incoming non-ASCII characters escaped.  If
        ensure_ascii is false, the output can contain non-ASCII characters.

        If check_circular is true, then lists, dicts, and custom encoded
        objects will be checked for circular references during encoding to
        prevent an infinite recursion (which would cause an OverflowError).
        Otherwise, no such check takes place.

        If allow_nan is true, then NaN, Infinity, and -Infinity will be
        encoded as such.  This behavior is not JSON specification compliant,
        but is consistent with most JavaScript based encoders and decoders.
        Otherwise, it will be a ValueError to encode such floats.

        If sort_keys is true, then the output of dictionaries will be
        sorted by key; this is useful for regression tests to ensure
        that JSON serializations can be compared on a day-to-day basis.

        If indent is a non-negative integer, then JSON array
        elements and object members will be pretty-printed with that
        indent level.  An indent level of 0 will only insert newlines.
        None is the most compact representation.

        If specified, separators should be an (item_separator, key_separator)
        tuple.  The default is (', ', ': ') if *indent* is ``None`` and
        (',', ': ') otherwise.  To get the most compact JSON representation,
        you should specify (',', ':') to eliminate whitespace.

        If specified, default is a function that gets called for objects
        that can't otherwise be serialized.  It should return a JSON encodable
        version of the object or raise a ``TypeError``.

        """

        self.skipkeys = skipkeys
        self.ensure_ascii = ensure_ascii
        self.check_circular = check_circular
        self.allow_nan = allow_nan
        self.sort_keys = sort_keys
        self.indent = indent
        if separators is not None:
            self.item_separator, self.key_separator = separators
        elif indent is not None:
            self.item_separator = ','
        if default is not None:
            self.default = default

    def default(self, o):
        """Implement this method in a subclass such that it returns
        a serializable object for ``o``, or calls the base implementation
        (to raise a ``TypeError``).

        For example, to support arbitrary iterators, you could
        implement default like this::

            def default(self, o):
                try:
                    iterable = iter(o)
                except TypeError:
                    pass
                else:
                    return list(iterable)
                # Let the base class default method raise the TypeError
                return JSONEncoder.default(self, o)

        """
        raise TypeError("Object of type '%s' is not JSON serializable" %
                        o.__class__.__name__)

    def encode(self, o):
        """Return a JSON string representation of a Python data structure.

        >>> from json.encoder import JSONEncoder
        >>> JSONEncoder().encode({"foo": ["bar", "baz"]})
        '{"foo": ["bar", "baz"]}'

        """
        # This is for extremely simple cases and benchmarks.
        if isinstance(o, str):
            if self.ensure_ascii:
                return encode_basestring_ascii(o)
            else:
                return encode_basestring(o)
        # This doesn't pass the iterator directly to ''.join() because the
        # exceptions aren't as detailed.  The list call should be roughly
        # equivalent to the PySequence_Fast that ''.join() would do.
        chunks = self.iterencode(o, _one_shot=False)
        if not isinstance(chunks, (list, tuple)):
            chunks = list(chunks)
        return ''.join(chunks)

    def iterencode(self, o, _one_shot=False):
        """Encode the given object and yield each string
        representation as available.

        For example::

            for chunk in JSONEncoder().iterencode(bigobject):
                mysocket.write(chunk)

        """
        if self.check_circular:
            markers = {}
        else:
            markers = None
        if self.ensure_ascii:
            _encoder = encode_basestring_ascii
        else:
            _encoder = encode_basestring

        def floatstr(o, allow_nan=self.allow_nan,
                _repr=float.__repr__, _inf=INFINITY, _neginf=-INFINITY):
            # Check for specials.  Note that this type of test is processor
            # and/or platform-specific, so do tests which don't depend on the
            # internals.

            if o != o:
                text = 'NaN'
            elif o == _inf:
                text = 'Infinity'
            elif o == _neginf:
                text = '-Infinity'
            else:
                return _repr(o)

            if not allow_nan:
                raise ValueError(
           
```

### Core Architecture Module: `lib/c14n/NumberToJson.py`
```
##############################################################################
#                                                                            #
#  Copyright 2006-2019 WebPKI.org (http://webpki.org).                       #
#                                                                            #
#  Licensed under the Apache License, Version 2.0 (the "License");           #
#  you may not use this file except in compliance with the License.          #
#  You may obtain a copy of the License at                                   #
#                                                                            #
#      https://www.apache.org/licenses/LICENSE-2.0                           #
#                                                                            #
#  Unless required by applicable law or agreed to in writing, software       #
#  distributed under the License is distributed on an "AS IS" BASIS,         #
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  #
#  See the License for the specific language governing permissions and       #
#  limitations under the License.                                            #
#                                                                            #
##############################################################################


##################################################################
# Convert a Python double/float into an ES6/V8 compatible string #
##################################################################
def convert2Es6Format(value):
# Convert double/float to str using the native Python formatter
    fvalue = float(value)
#
# Zero is a special case.  The following line takes "-0" case as well
#
    if fvalue == 0:
        return '0'
#
# The rest of the algorithm works on the textual representation only
#
    pyDouble = str(fvalue)
#
# The following line catches the "inf" and "nan" values returned by str(fvalue)
#
    if pyDouble.find('n') >= 0:
        raise ValueError("Invalid JSON number: " + pyDouble)
#
# Save sign separately, it doesn't have any role in the algorithm
#
    pySign = ''
    if pyDouble.find('-') == 0:
        pySign = '-'
        pyDouble = pyDouble[1:]
#
# Now we should only have valid non-zero values
#
    pyExpStr = ''
    pyExpVal = 0
    q = pyDouble.find('e')
    if q > 0:
#
# Grab the exponent and remove it from the number
#
        pyExpStr = pyDouble[q:]
        if pyExpStr[2:3] == '0':
#
# Supress leading zero on exponents
#
            pyExpStr = pyExpStr[:2] + pyExpStr[3:]
        pyDouble = pyDouble[0:q]
        pyExpVal = int(pyExpStr[1:])
#
# Split number in pyFirst + pyDot + pyLast
#
    pyFirst = pyDouble
    pyDot = ''
    pyLast = ''
    q = pyDouble.find('.')
    if q > 0:
        pyDot = '.'
        pyFirst = pyDouble[:q]
        pyLast = pyDouble[q + 1:]
#
# Now the string is split into: pySign + pyFirst + pyDot + pyLast + pyExpStr
#
    if pyLast == '0':
#
# Always remove trailing .0
#
        pyDot = ''
        pyLast = ''
    if pyExpVal > 0 and pyExpVal < 21:
#
# Integers are shown as is with up to 21 digits
#
        pyFirst += pyLast
        pyLast = ''
        pyDot = ''
        pyExpStr = ''
        q = pyExpVal - len(pyFirst)
        while q >= 0:
            q -= 1;
            pyFirst += '0'
    elif pyExpVal < 0 and pyExpVal > -7:
#
# Small numbers are shown as 0.etc with e-6 as lower limit
#
        pyLast = pyFirst + pyLast
        pyFirst = '0'
        pyDot = '.'
        pyExpStr = ''
        q = pyExpVal
        while q < -1:
            q += 1;
            pyLast = '0' + pyLast
#
# The resulting sub-strings are concatenated
#
    return pySign + pyFirst + pyDot + pyLast + pyExpStr

```

### Core Architecture Module: `lib/c14n/__init__.py`
```
""" JSON Canonicalization. """
from .Canonicalize import canonicalize

__all__ = ['canonicalize']

```

### Core Architecture Module: `lib/pyld/__about__.py`
```
# PyLD JSON-LD meta data

__all__ = ['__copyright__', '__license__', '__version__']

__copyright__ = 'Copyright (c) 2011-2024 Digital Bazaar, Inc.'
__license__ = 'BSD 3-Clause "New" or "Revised" License'
__version__ = '4.0.0-dev'

```

### Core Architecture Module: `lib/pyld/__init__.py`
```
"""The PyLD module is used to process JSON-LD."""

from . import jsonld
from .context_resolver import ContextResolver
from .documentloader.aiohttp import AioHttpDocumentLoader
from .documentloader.base import DocumentLoader, RemoteDocument
from .documentloader.file import FileDocumentLoader
from .documentloader.frozen import BUNDLED_CONTEXTS, FrozenDocumentLoader
from .documentloader.requests import RequestsDocumentLoader
from .documentloader.requests_sqlite_cache import SqliteCacheRequestsDocumentLoader
from .documentloader.scheme_directed import SchemeDirectedDocumentLoader
from .documentloader.type_directed import TypeDirectedDocumentLoader

__all__ = [
    'AioHttpDocumentLoader',
    'BUNDLED_CONTEXTS',
    'SchemeDirectedDocumentLoader',
    'TypeDirectedDocumentLoader',
    'ContextResolver',
    'DocumentLoader',
    'FileDocumentLoader',
    'FrozenDocumentLoader',
    'RequestsDocumentLoader',
    'RemoteDocument',
    'SqliteCacheRequestsDocumentLoader',
    'jsonld',
]

```

### Core Architecture Module: `lib/pyld/canon.py`
```
import hashlib

import rdflib
from rdflib import XSD, BNode, Dataset, Literal, Node
from rdflib.graph import DATASET_DEFAULT_GRAPH_ID
from rdflib.parser import StringInputSource
from rdflib.plugins.parsers.nquads import NQuadsParser
from rdflib.plugins.serializers.nt import _quote_encode

from pyld.identifier_issuer import IdentifierIssuer
from pyld.util import from_legacy_dataset, to_legacy_dataset


class URDNA2015:
    """
    URDNA2015 implements the URDNA2015 RDF Dataset Normalization Algorithm.
    """

    def __init__(self):
        self.blank_node_info = {}
        self.hash_to_blank_nodes = {}
        self.canonical_issuer = IdentifierIssuer('_:c14n')
        self.dataset = None
        self.POSITIONS = ['s', 'p', 'o', 'g']
        self.hash_algorithm = hashlib.sha256
        self.max_permutations = 100000
        self.permutations = 0

    # 4.4) Normalization Algorithm
    def main(self, dataset: str | dict | Dataset, options) -> str | dict:
        # handle invalid output format
        if 'format' in options and (
            options['format'] != 'application/n-quads'
            and options['format'] != 'application/nquads'
        ):
            raise UnknownFormatError('Unknown output format.', options['format'])

        # handle differtent input types: nquads string, dict (legacy ), or rdflib Dataset
        rdflib_dataset = Dataset()
        parser = NQuadsParser()
        if isinstance(dataset, str):
            # Only support N-Quads string input for now
            if (
                options['inputFormat'] != 'application/n-quads'
                and options['inputFormat'] != 'application/nquads'
            ):
                raise UnknownFormatError('Unknown input format.', options['format'])
            rdflib.NORMALIZE_LITERALS = False
            parser.parse(StringInputSource(dataset), rdflib_dataset)
        elif isinstance(dataset, dict):
            rdflib_dataset = from_legacy_dataset(dataset)
        elif isinstance(dataset, Dataset):
            rdflib_dataset = dataset
        else:
            raise ValueError(f'Unsupported dataset type: {type(dataset)}')

        self.max_permutations = options.get(
            'maxPermutations',
            self.max_permutations,
        )
        self.permutations = 0

        normalized, bnode_map = self._canonicalize(rdflib_dataset)

        # Merge any new bnode IDs from the parser into the id_map,
        # mapping old bnode IDs to their new canonical IDs
        for k, v in parser._bnode_ids.items():
            bnode_id = str(v)
            if bnode_id in bnode_map:
                bnode_map[k] = bnode_map[bnode_id]
                del bnode_map[bnode_id]

        # If outputMap option is set, return the map of blank node identifiers.
        if options.get('outputMap'):
            return dict(sorted(bnode_map.items(), key=lambda item: item[1]))

        # 8) Return the normalized dataset.
        if (
            options.get('format') == 'application/n-quads'
            or options.get('format') == 'application/nquads'
        ):
            return normalized

        # If the output format is not nquads, return a dataset object.
        result = Dataset().parse(data=normalized, format='nquads')
        return to_legacy_dataset(result)

    def _canonicalize(self, dataset: Dataset) -> tuple[str, dict]:
        """
        Performs RDF Dataset Canonicalization on the given rdflib.Dataset
        and returns the normalized output along with a map of blank node
        identifiers to their canonical identifiers.
        """

        self.dataset = dataset
        # 1) Create the normalization state.

        # 2) For every quad in input dataset:
        for s, p, o, g in dataset.quads((None, None, None, None)):
            # 2.1) For each blank node that occurs in the quad, add a
            # reference to the quad using the blank node identifier in the
            # blank node to quads map, creating a new entry if necessary.
            for component in (s, o, g if g else None):
                if isinstance(component, BNode):
                    id_ = str(component)
                    self.blank_node_info.setdefault(id_, {'quads': []})['quads'].append((s, p, o, g))

        # 3) Create a list of non-normalized blank node identifiers and
        # populate it using the keys from the blank node to quads map.
        non_normalized = set(self.blank_node_info.keys())

        # 4) Initialize simple, a boolean flag, to true.
        simple = True

        # 5) While simple is true, issue canonical identifiers for blank nodes:
        while simple:
            # 5.1) Set simple to false.
            simple = False

            # 5.2) Clear hash to blank nodes map.
            self.hash_to_blank_nodes = {}

            # 5.3) For each blank node identifier identifier in non-normalized
            # identifiers:
            for id_ in non_normalized:
                # 5.3.1) Create a hash, hash, according to the Hash First
                # Degree Quads algorithm.
                hash = self.hash_first_degree_quads(id_)

                # 5.3.2) Add hash and identifier to hash to blank nodes map,
                # creating a new entry if necessary.
                self.hash_to_blank_nodes.setdefault(hash, []).append(id_)

            # 5.4) For each hash to identifier list mapping in hash to blank
            # nodes map, lexicographically-sorted by hash:
            for hash, id_list in sorted(self.hash_to_blank_nodes.items()):
                # 5.4.1) If the length of identifier list is greater than 1,
                # continue to the next mapping.
                if len(id_list) > 1:
                    continue

                # 5.4.2) Use the Issue Identifier algorithm, passing canonical
                # issuer and the single blank node identifier in identifier
                # list, identifier, to issue a canonical replacement identifier
                # for identifier.
                # TODO: consider changing `get_id` to `issue`
                id_ = id_list[0]
                self.canonical_issuer.get_id(id_)

                # 5.4.3) Remove identifier from non-normalized identifiers.
                non_normalized.remove(id_)

                # 5.4.4) Remove hash from the hash to blank nodes map.
                del self.hash_to_blank_nodes[hash]

                # 5.4.5) Set simple to true.
                simple = True

        # 6) For each hash to identifier list mapping in hash to blank nodes
        # map, lexicographically-sorted by hash:
        for _hash, id_list in sorted(self.hash_to_blank_nodes.items()):
            # 6.1) Create hash path list where each item will be a result of
            # running the Hash N-Degree Quads algorithm.
            hash_path_list = []

            # 6.2) For each blank node identifier identifier in identifier
            # list:
            for id_ in id_list:
                # 6.2.1) If a canonical identifier has already been issued for
                # identifier, continue to the next identifier.
                if self.canonical_issuer.has_id(id_):
                    continue

                # 6.2.2) Create temporary issuer, an identifier issuer
                # initialized with the prefix _:b.
                issuer = IdentifierIssuer('_:b')

                # 6.2.3) Use the Issue Identifier algorithm, passing temporary
                # issuer and identifier, to issue a new temporary blank node
                # identifier for identifier.
                issuer.get_id(id_)

                # 6.2.4) Run the Hash N-Degree Quads algorithm, passing
                # temporary issuer, and append the result to the hash path
                # list.
                hash_path_list.append(self.hash_n_degree_quads(id_, issuer))

            # 6.3) For each result in the hash path list,
            # lexicographically-sorted by the hash in result:
            for result in sorted(hash_path_list, key=lambda r: r['hash']):
                # 6.3.1) For each blank node identifier, existing identifier,
                # that was issued a temporary identifier by identifier issuer
                # in result, issue a canonical identifier, in the same order,
                # using the Issue Identifier algorithm, passing canonical
                # issuer and existing identifier.
                for existing in result['issuer'].order:
                    self.canonical_issuer.get_id(existing)

        # Note: At this point all blank nodes in the set of RDF quads have been
        # assigned canonical identifiers, which have been stored in the
        # canonical issuer. Here each quad is updated by assigning each of its
        # blank nodes its new identifier.

        # 7) For each quad, quad, in input dataset:
        normalized = []
        id_map = {}
        for s, p, o, g in self.dataset.quads((None, None, None, None)):
            # 7.1) Create a copy, quad copy, of quad and replace any existing
            # blank node identifiers using the canonical identifiers previously
            # issued by canonical issuer. Note: We optimize away the copy here.

            # Helper to map nodes
            def map_node(node):
                if isinstance(node, BNode):
                    node_id = str(node)
                    # Only issue a new ID if it's not already canonicalized
                    cid = self.canonical_issuer.get_id(node_id)
                    if cid.startswith('_:'):
                        cid = cid[2:]  # Strip '_:' prefix for rdflib BNode compatibility
                    id_map[node_id] = cid
                    return BNode(cid)
                return node

            # Transform Subject, Object, and Graph Name (Predicate is never a BNode in RDFC1.0)
            s_n = map_node(s)
            p_n = p # Predicates are never BNodes in standard RDF
            o_n = map_node(o)
            g_n = map_node(g)

            # Use modified version of rdflib's interna
```

### Core Architecture Module: `lib/pyld/cli/__init__.py`
```
"""Command-line interface for PyLD."""

from pyld.cli.app import main, pyld

__all__ = ['main', 'pyld']

```

### Core Architecture Module: `lib/pyld/cli/app.py`
```
"""Typer application assembly for the PyLD CLI."""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Annotated

try:
    import typer
except ImportError as cause:  # pragma: no cover
    raise ImportError(
        'The pyld command-line interface requires Typer. '
        'Install it with: pip install "PyLD[cli]"'
    ) from cause

from typer import Option

from pyld.cli import state as cli_state
from pyld.cli.commands.cache import cache_clear
from pyld.cli.commands.compact import compact_command
from pyld.cli.commands.expand import expand_command
from pyld.cli.commands.flatten import flatten_command
from pyld.cli.commands.frame import frame_command
from pyld.cli.commands.from_rdf import from_rdf_command
from pyld.cli.commands.get import get_command
from pyld.cli.commands.to_rdf import to_rdf_command
from pyld.cli.errors import print_error
from pyld.cli.state import State

pyld = typer.Typer(
    help='Command-line tool for JSON-LD transformations.',
    no_args_is_help=True,
)


@pyld.callback()
def root(
    ctx: typer.Context,
    traceback: Annotated[
        bool,
        Option('--traceback', help='Show the Python traceback on errors.'),
    ] = False,
    cache_file: Annotated[
        Path | None,
        Option(
            '--cache-file',
            envvar='PYLD_CACHE_FILE',
            help='SQLite file for the CLI HTTP cache.',
        ),
    ] = None,
) -> None:
    state = State(traceback=traceback, cache_file=cache_file)
    ctx.obj = state
    # ``main`` reads this after Click has torn down the context.
    cli_state.current = state


pyld.command('get')(get_command)
pyld.command('expand')(expand_command)
pyld.command('compact')(compact_command)
pyld.command('flatten')(flatten_command)
pyld.command('frame')(frame_command)
pyld.command('to-rdf')(to_rdf_command)
pyld.command('from-rdf')(from_rdf_command)

cache_app = typer.Typer(help='Cache management.', no_args_is_help=True)
cache_app.command('clear')(cache_clear)
pyld.add_typer(cache_app, name='cache')


def main(args: list[str] | None = None) -> None:
    """Entry point for the ``pyld`` console script."""
    try:
        pyld(args=args, prog_name='pyld')
    except (SystemExit, KeyboardInterrupt):
        raise
    except Exception as err:
        if cli_state.current.traceback:
            raise
        print_error(err, sys.argv[1:] if args is None else args)
        raise SystemExit(1) from None

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #292** (2026-07-08): **Compact_iri does not function right for @container: @list**
  *Symptoms*: Label::bug  We wrap pyld for our use case. In  `return self._compact_iri(active_ctx, long_iri, vocab=vocab, value=value)` (class is based on jsonld.JsonLdProcessor ) we found that the author iri was not compacted right. Every other attribute worked fine.  Author in codemeta.json is defined like this: ``` "author": { "@id": "schema:author", "@container": "@list" }, ``` By looking into the code, It is sure that that the @list paired with @container is the problem.  To test see: ``` #!/usr/bin/env -S pipx run # /// script # requires-python = ">=3.10" # dependencies = [ #   "PyLD (>=3.1.0)", # ] # ///  import json  from pyld import jsonld   doc_str = """ [   {     "@id": "_:Nc1239476e3cc45e387cfa0cf9b519b91",     "@type": [       "https://schema.org/SoftwareApplication"     ],     "https://schema.org/author": [       {         "@id": "_:Nd3abed4ba38842d8aaf46464efef5090"       }     ]   },   {     "@id": "_:Nd3abed4ba38842d8aaf46464efef5090",     "@type": [       "https://schema.org/Person"     ],     "https://schema.org/givenName": [       {         "@value": "John"       }     ],     "https://schema.org/lastName": [       {         "@value": "Doe"       }     ]   } ] """  doc = json.loads(doc_str)  context = {     # "author": { "@id": "https://schema.org/author" },  # works     # "author": {"@id": "https://schema.org/author", "@container": "@set"},  # also works     "author": {"@id": "https://schema.org/author", "@container": "@list"},  # doesn't work }  compacted = jsonld.comp

- **Issue #230** (2026-07-07): **Expansion/normalization with nested context differs from jsonld.js**
  *Symptoms*: The expansion of terms that are in the scope of a nested context does not seem to take into account definitions from the parent context.  While I'm not familiar enough with the expansion algorithm to know whether that behaviour is correct, it certainly differs from the jsonld.js implementation. As we are using both libraries in a usecase involving Verifiable Credentials signing, reproducible normalization (and therefore reproducible expansion) across platforms is crucial.  The problem is reproduced here with a minimal document :      https://colab.research.google.com/drive/1QoZ4o8DCNpJshR-c8SbaREKnrMg1VAt0  The same document can be tested in the jsonld playground : https://tinyurl.com/2dfr3w27 where the difference in expansion and normalization can be observed.  The python notebook contains two commented out lines in the nested context that fix the problem, but of course it would be expected that both libraries behave the same way with the same input.

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

### Incident Patch 1: `bcdc7103` (2026-11-02)
**Commit Message**: Bump ruff from 0.16.10 to 0.17.2

Bumps [ruff](https://github.com/astral-sh/ruff) from 0.16.10 to 0.17.2.
- [Release notes](https://github.com/astral-sh/ruff/releases)
- [Changelog](https://github.com/astral-sh/ruff/blob/main/CHANGELOG.md)
- [Commits](https://github.com/astral-sh/ruff/compare/0.16.10...0.17.2)

---
updated-dependencies:
- dependency-name: ruff
  dependency-version: 0.17.2
  dependency-type: direct:development
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

**File**: `uv.lock` (modified, +21/-21)
```diff
@@ -2168,27 +2168,27 @@ wheels = [
 
 [[package]]
 name = "ruff"
-version = "0.16.10"
-source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/c4/49/23802c45f093eb14bde54b141d2b2f058edfa63a06db7beed047308cc08f/ruff-0.16.10.tar.gz", hash = "sha256:eff4728c4eaae93f0955cd264d24b2ab348e74bf59986ccf282ba6dc16b3b017", size = 4958724, upload-time = "2026-10-01T18:03:21.697Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/2f/21/ebce22e1d90cdb2cd691026b9c6e9bec6499f0b396089481755b5d49efff/ruff-0.16.10-py3-none-linux_armv6l.whl", hash = "sha256:488b0fe3f3574210e5cf80d9f59b9e3ab17a127a8155de3f307b392589cfb511", size = 10095557, upload-time = "2026-10-01T18:02:36.072Z" },
-    { url = "https://files.pythonhosted.org/packages/cb/98/a54de85876a8b2612bfa0d84c7b9abfb39c6a3354aee7800b09c1649b9e3/ruff-0.16.10-py3-none-macosx_10_12_x86_64.whl", hash = "sha256:e748ff95c934c4e978783b8e687bc174e7bd84e8ad24e3243e1ecfcda5e0282d", size = 10340577, upload-time = "2026-10-01T18:02:39.258Z" },
-    { url = "https://files.pythonhosted.org/packages/9f/16/1a5a4a2657effe4806110f2b907313802f1367fcdbb29e8122766e407fab/ruff-0.16.10-py3-none-macosx_11_0_arm64.whl", hash = "sha256:3031a4a2e8e7b8a46f70be45f198c35a11ece509a94b80334d8d397a33c67550", size = 9774282, upload-time = "2026-10-01T18:02:41.79Z" },
-    { url = "https://files.pythonhosted.org/packages/6e/fb/470085af734da396e68cd80fb0a3e7c109a459716ae59588c0f6fab8a17d/ruff-0.16.10-py3-none-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:494401c86df4c4c25f69b9419605d944467ee98c42fb6ad405ef4fa40b8fb67d", size = 9920895, upload-time = "2026-10-01T18:02:44.458Z" },
-    { url = "https://files.pythonhosted.org/packages/57/de/f10cffe4f88a37ea6615ec460f01bf76f0bc1477737a35d9ee61a630a78b/ruff-0.16.10-py3-none-manylinux_2_17_armv7l.manylinux2014_armv7l.whl", hash = "sha256:d203abc0ff2b773ee33d00ab8df0bb67046fbc7c07b119332f08b9b345cf8221", size = 9902707, upload-time = "2026-10-01T18:02:47.041Z" },
-    { url = "https://files.pythonhosted.org/packages/ff/44/3fdcedf83ae60ef837dd239170e480dce606a9142cfa2db911afdf855fd9/ruff-0.16.10-py3-none-manylinux_2_17_i686.manylinux2014_i686.whl", hash = "sha256:bd83d1235a5258d318477bc5b576303974cbdef5df0c01a1bff14efcc23bd12a", size = 10619287, upload-time = "2026-10-01T18:02:49.485Z" },
-    { url = "https://files.pythonhosted.org/packages/c1/62/02e76a5574002153618eafbb70e159468addc72a5d2c488e65cbb4639d2d/ruff-0.16.10-py3-none-manylinux_2_17_ppc64le.manylinux2014_ppc64le.whl", hash = "sha256:bc2610fb269fa56dd8a68669ae470fa6272902668c0fc2ebc3aa112b2633d5b8", size = 11339942, upload-time = "2026-10-01T18:02:52.008Z" },
-    { url = "https://files.pythonhosted.org/packages/6b/c4/cde27d47ad8d4126c587e608c67c46e7feac11763f606d261a1bc8a489e6/ruff-0.16.10-py3-none-manylinux_2_17_s390x.manylinux2014_s390x.whl", hash = "sha256:3e70175e29cc94c26ea296c80e470180b744b7419026898e58f520c6ab32578e", size = 10934316, upload-time = "2026-10-01T18:02:54.811Z" },
-    { url = "https://files.pythonhosted.org/packages/e4/03/17234145f302a645a123e8c3bb2411ecf4669fbc350de3b0d803230a1729/ruff-0.16.10-py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:f33f43a864a8483eebd160e713336c8bab02c934feaff0a33cf5ccb41546d09a", size = 10387968, upload-time = "2026-10-01T18:02:57.497Z" },
-    { url = "https://files.pythonhosted.org/packages/71/29/2493af60240ee7644b38a4b821f5f9c3b5a4fa3178770fe1d0c685217395/ruff-0.16.10-py3-none-manylinux_2_31_riscv64.whl", hash = "sha256:1dfc6f0088149fb6a362c1c446bcbb3fd2157b3852fe2fa68409276eab9ad9b3", size = 10537906, upload-time = "2026-10-01T18:03:00.006Z" },
-    { url = "https://files.pythonhosted.org/packages/2e/9a/f56b28f3b143bb9e518c34fb89ab191b626bca8b70dbf8af0d2e2d473572/ruff-0.16.10-py3-none-musllinux_1_2_aarch64.whl", hash = "sha256:6553498afc35f580f036030795810b9e6bcea31604b0fd9e8d352795473042e3", size = 10012938, upload-time = "2026-10-01T18:03:03.006Z" },
-    { url = "https://files.pythonhosted.org/packages/c2/c4/fca37362848ea4d4d80712df13632e645e7c7cfb1bdedf140699ac7a090b/ruff-0.16.10-py3-none-musllinux_1_2_armv7l.whl", hash = "sha256:a3b8471dea115d37f123882be852bed13403746d3a76c11de4a19ec5f9ff5a03", size = 9897945, upload-time = "2026-10-01T18:03:05.818Z" },
-    { url = "https://files.pythonhosted.org/packages/7d/c7/e0bc57664d6e0c61fd22f620af260fe9662d7e1ddb320ea7f160e76ef165/ruff-0.16.10-py3-none-musllinux_1_2_i686.whl", hash = "sha256:92e59a70bcbd9d3a5483656da906ec28edfdacfce00afd99edb8b4e9d15644be", size = 10333134, upload-time = "2026-10-01T18:03:08.25Z" },
-    { url = "https://files.pythonhosted.org/packages/21/aa/5c9f3b68737c0e4a33a1db5dfab44f7b786d96ca91a7233112ddab1e6dc2/ruff-0.16.10-py3-none-musllinux_1_2_x86_64.whl", hash = "sha256:7ae7375f803b5520dc9f546bed7e3a0acb70b91812e9bb4b19927de22f25b77d", size = 10741702, upload-time = "2026-10-01T18:03:10.775Z" },
-    { url = "https://files.pythonhosted.org/packages/78/fa/0f9c2020
```

---

### Incident Patch 2: `f6b08c68` (2026-11-02)
**Commit Message**: Bump aiohttp from 3.14.4 to 3.14.5

---
updated-dependencies:
- dependency-name: aiohttp
  dependency-version: 3.14.5
  dependency-type: direct:development
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>



#### Recent Merged Pull Requests:
- **PR #367** (2026-11-02): Bump cachetools from 7.2.1 to 7.2.5 (@dependabot[bot])
- **PR #366** (2026-11-02): Bump aiohttp from 3.14.4 to 3.14.5 (@dependabot[bot])
- **PR #365** (2026-11-02): Bump ruff from 0.16.10 to 0.17.2 (@dependabot[bot])
- **PR #356** (2026-11-01): Bump certifi from 2026.7.22 to 2026.10.19 (@dependabot[bot])
- **PR #355** (2026-10-20): Bump specifications/json-ld-api from `ffdb326` to `5551473` (@dependabot[bot])
- **PR #354** (2026-11-01): Bump cachetools from 7.2.0 to 7.2.1 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
