# Domain D — Research & Knowledge Intelligence: Research & Knowledge Intelligence: rdflib-rdflib-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "rdflib-rdflib-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T21:25:55.447Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rdflib-rdflib-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rdflib-rdflib-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T21:25:55.447Z`  
> **Learning ID**: `LEARN-EVO-rdflib-rdflib-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain D (Research & Knowledge Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), G (Architecture Intelligence), J (Search & Distribution Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), A (Human & Need Intelligence)
- **Confidence Rating**: 55%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from rdflib-rdflib-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rdflib-rdflib-learnings.md`  
> **Source**: github ([https://github.com/RDFLib/rdflib](https://github.com/RDFLib/rdflib))  
> **Source Version**: `a0a00f55`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T21:25:44.429Z  
> **Learning ID**: `learn-github-rdflib-rdflib`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): RDFLib/rdflib

> **Canonical Artifact**: `07_PROJECT_LEARNING/rdflib-rdflib-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/RDFLib/rdflib](https://github.com/RDFLib/rdflib))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-20T21:25:40.127Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RDFLib/rdflib`
- **Description**: RDFLib is a Python library for working with RDF, a simple yet powerful language for representing information.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2565 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `rdflib/contrib/graphdb/util.py`
```
from __future__ import annotations

import typing as t
import urllib.parse


def sanitize_filename(filename: str) -> str | None:
    filename = filename.strip().strip("\"'")
    if not filename:
        return None
    filename = filename.replace("\\", "/").split("/")[-1]
    if not filename or filename in {".", ".."}:
        return None
    return filename


def extract_filename_from_content_disposition(header: str) -> str | None:
    """Extract filename from Content-Disposition header.

    Supports both ``filename=`` and RFC 5987 ``filename*=``; prefers ``filename*=``
    when present. Returned filenames are sanitized to prevent path traversal.
    """
    if not header:
        return None

    filename_star: str | None = None
    filename_plain: str | None = None

    for part in header.split(";"):
        part = part.strip()
        lower = part.lower()
        if lower.startswith("filename*="):
            value = part[len("filename*=") :].strip()
            value = value.strip().strip("\"'")
            try:
                charset, rest = value.split("'", 1)
                _language, encoded = rest.split("'", 1)
            except ValueError:
                charset = "utf-8"
                encoded = value
            try:
                raw = urllib.parse.unquote_to_bytes(encoded)
                decoded = raw.decode(charset, errors="replace")
            except LookupError:
                raw = urllib.parse.unquote_to_bytes(encoded)
                decoded = raw.decode("utf-8", errors="replace")
            filename_star = sanitize_filename(decoded)
        elif lower.startswith("filename="):
            value = part[len("filename=") :].strip()
            filename_plain = sanitize_filename(value)

    return filename_star or filename_plain


def infer_filename_from_fileobj(file_obj: t.Any, fallback: str) -> str:
    """Infer a safe filename from a file-like object's ``.name`` attribute."""
    name = getattr(file_obj, "name", None)
    if isinstance(name, str) and name:
        inferred = sanitize_filename(name)
        if inferred:
            return inferred
    return fallback

```

### Core Architecture Module: `rdflib/contrib/rdf4j/util.py`
```
"""RDF4J utility functions."""

from __future__ import annotations

import io
import typing as t

from rdflib.graph import DATASET_DEFAULT_GRAPH_ID, Dataset, Graph
from rdflib.plugins.sparql.processor import prepareQuery
from rdflib.term import BNode, IdentifiedNode, URIRef

if t.TYPE_CHECKING:
    from rdflib.contrib.rdf4j.client import ObjectType, PredicateType, SubjectType


def build_context_param(
    params: dict[str, str],
    graph_name: IdentifiedNode | t.Iterable[IdentifiedNode] | str | None = None,
) -> None:
    """Build the RDF4J http context query parameters dictionary.

    !!! Note
        This mutates the params dictionary key `context`.

    Parameters:
        params: The `httpx.Request` parameter dictionary.
        graph_name: The graph name or iterable of graph names.

            This is the `context` query parameter value.
    """
    if graph_name is not None and isinstance(graph_name, IdentifiedNode):
        if graph_name == DATASET_DEFAULT_GRAPH_ID:
            # Special RDF4J null value for context-less statements.
            params["context"] = "null"
        else:
            params["context"] = graph_name.n3()
    elif graph_name is not None and isinstance(graph_name, str):
        params["context"] = URIRef(graph_name).n3()
    elif graph_name is not None and isinstance(graph_name, t.Iterable):
        # type error: "str" has no attribute "n3"
        graph_names = ",".join([x.n3() for x in graph_name])
        params["context"] = graph_names


def build_spo_param(
    params: dict[str, str],
    subj: SubjectType = None,
    pred: PredicateType = None,
    obj: ObjectType = None,
) -> None:
    """Build the RDF4J http subj, predicate, and object query parameters dictionary.

    !!! Note
        This mutates the params dictionary key `subj`, `pred`, and `obj`.

    Parameters:
        params: The `httpx.Request` parameter dictionary.
        subj: The `subj` query parameter value.
        pred: The `pred` query parameter value.
        obj: The `obj` query parameter value.
    """
    if subj is not None:
        params["subj"] = subj.n3()
    if pred is not None:
        params["pred"] = pred.n3()
    if obj is not None:
        params["obj"] = obj.n3()


def build_infer_param(
    params: dict[str, str],
    infer: bool = True,
) -> None:
    """Build the RDF4J http infer query parameters dictionary.

    !!! Note
        This mutates the params dictionary key `infer`.

    Parameters:
        params: The `httpx.Request` parameter dictionary.
        infer: The `infer` query parameter value.
    """
    if not infer:
        params["infer"] = "false"


def rdf_payload_to_stream(
    data: str | bytes | t.BinaryIO | Graph | Dataset,
) -> tuple[t.BinaryIO, bool]:
    """Convert an RDF payload into a file-like object.

    Parameters:
        data: The RDF payload.

            This can be a python `str`, `bytes`, `BinaryIO`, or a
            [`Graph`][rdflib.graph.Graph] or [`Dataset`][rdflib.graph.Dataset].

    Returns:
        A tuple containing the file-like object and a boolean indicating whether the
        immediate caller should close the stream.
    """
    stream: t.BinaryIO
    if isinstance(data, str):
        # Check if it looks like a file path. Assumes file path length is less than 260.
        if "\n" not in data and len(data) < 260:
            try:
                stream = open(data, "rb")
                should_close = True
            except (FileNotFoundError, OSError):
                # Treat as raw string content
                stream = io.BytesIO(data.encode("utf-8"))
                should_close = False
        else:
            # Treat as raw string content
            stream = io.BytesIO(data.encode("utf-8"))
            should_close = False
    elif isinstance(data, bytes):
        stream = io.BytesIO(data)
        should_close = False
    elif isinstance(data, (Graph, Dataset)):
        if data.context_aware:
            stream = io.BytesIO(
                data.serialize(format="application/n-quads", encoding="utf-8")
            )
        else:
            stream = io.BytesIO(
                data.serialize(format="application/n-triples", encoding="utf-8")
            )
        should_close = True
    else:
        # Assume it's already a file-like object
        stream = data
        should_close = False

    return stream, should_close


def build_sparql_query_accept_header(query: str, headers: dict[str, str]):
    """Build the SPARQL query accept header.

    !!! Note
        This mutates the headers dictionary key `Accept`.

    Parameters:
        query: The SPARQL query.
    """
    prepared_query = prepareQuery(query)
    if prepared_query.algebra.name in ("SelectQuery", "AskQuery"):
        headers["Accept"] = "application/sparql-results+json"
    elif prepared_query.algebra.name in ("ConstructQuery", "DescribeQuery"):
        headers["Accept"] = "application/n-triples"
    else:
        raise ValueError(f"Unsupported query type: {prepared_query.algebra.name}")


def validate_graph_name(graph_name: URIRef | t.Iterable[URIRef] | str | None):
    if (
        isinstance(graph_name, BNode)
        or isinstance(graph_name, t.Iterable)
        and any(isinstance(x, BNode) for x in graph_name)
    ):
        raise ValueError("Graph name must not be a BNode.")


def validate_no_bnodes(
    subj: SubjectType,
    pred: PredicateType,
    obj: ObjectType,
    graph_name: URIRef | t.Iterable[URIRef] | str | None,
) -> None:
    """Validate that the subject, predicate, and object are not BNodes."""
    if (
        isinstance(subj, BNode)
        or isinstance(pred, BNode)
        or isinstance(obj, BNode)
        or isinstance(graph_name, BNode)
    ):
        raise ValueError(
            f"Subject, predicate, and object must not be a BNode: {subj}, {pred}, {obj}"
        )
    validate_graph_name(graph_name)

```

### Core Architecture Module: `rdflib/extras/cmdlineutils.py`
```
from __future__ import annotations

import codecs
import getopt
import sys
import time
from typing import TextIO, Union

import rdflib
from rdflib.util import guess_format


def _help():
    sys.stderr.write("""
program.py [-f <format>] [-o <output>] [files...]
Read RDF files given on STDOUT - does something to the resulting graph
If no files are given, read from stdin
-o specifies file for output, if not given stdout is used
-f specifies parser to use, if not given it is guessed from extension

""")


def main(target, _help=_help, options="", stdin=True):
    """
    A main function for tools that read RDF from files given on commandline
    or from STDIN (if stdin parameter is true)
    """

    args, files = getopt.getopt(sys.argv[1:], "hf:o:" + options)
    dargs = dict(args)

    if "-h" in dargs:
        _help()
        sys.exit(-1)

    g = rdflib.Graph()

    if "-f" in dargs:
        f = dargs["-f"]
    else:
        f = None

    out: Union[TextIO, codecs.StreamReaderWriter]
    if "-o" in dargs:
        sys.stderr.write("Output to %s\n" % dargs["-o"])
        out = codecs.open(dargs["-o"], "w", "utf-8")
    else:
        out = sys.stdout

    start = time.time()
    if len(files) == 0 and stdin:
        sys.stderr.write("Reading from stdin as %s..." % f)
        g.parse(sys.stdin, format=f)
        sys.stderr.write("[done]\n")
    else:
        size = 0
        for x in files:
            if f is None:
                f = guess_format(x)
            start1 = time.time()
            sys.stderr.write("Loading %s as %s... " % (x, f))
            g.parse(x, format=f)
            sys.stderr.write(
                "done.\t(%d triples\t%.2f seconds)\n"
                % (len(g) - size, time.time() - start1)
            )
            size = len(g)

    sys.stderr.write(
        "Loaded a total of %d triples in %.2f seconds.\n"
        % (len(g), time.time() - start)
    )

    target(g, out, args)

```

### Core Architecture Module: `rdflib/plugins/shared/jsonld/util.py`
```
# https://github.com/RDFLib/rdflib-jsonld/blob/feature/json-ld-1.1/rdflib_jsonld/util.py
from __future__ import annotations

import json
import pathlib
import re
from html.parser import HTMLParser
from io import StringIO, TextIOBase, TextIOWrapper
from typing import IO, TYPE_CHECKING, Any, TextIO, Union

if TYPE_CHECKING:
    import json
else:
    try:
        import json

        assert json  # workaround for pyflakes issue #13
    except ImportError:
        import simplejson as json

from posixpath import normpath, sep
from typing import TYPE_CHECKING, cast
from urllib.parse import urljoin, urlsplit, urlunsplit

try:
    import orjson

    _HAS_ORJSON = True
except ImportError:
    orjson = None  # type: ignore[assignment, unused-ignore]
    _HAS_ORJSON = False


from rdflib.parser import (
    BytesIOWrapper,
    InputSource,
    PythonInputSource,
    StringInputSource,
    URLInputSource,
    create_input_source,
)
from rdflib.plugins.parsers.notation3 import join


def source_to_json(
    source: IO[bytes] | TextIO | InputSource | str | bytes | pathlib.PurePath | None,
    fragment_id: str | None = None,
    extract_all_scripts: bool | None = False,
) -> tuple[Union[dict, list[dict]], Any]:
    """Extract JSON from a source document.

    The source document can be JSON or HTML with embedded JSON script elements (type attribute = "application/ld+json").
    To process as HTML `source.content_type` must be set to "text/html" or "application/xhtml+xml".

    Args:
        source: the input source document (JSON or HTML)
        fragment_id: if source is an HTML document then extract only the script element with matching id attribute, defaults to None
        extract_all_scripts: if source is an HTML document then extract all script elements (unless fragment_id is provided), defaults to False (extract only the first script element)

    Returns:
        tuple with the extracted JSON document and value of the HTML base element
    """

    if isinstance(source, PythonInputSource):
        return source.data, None

    if isinstance(source, StringInputSource):
        # A StringInputSource is assumed to be never a HTMLJSON doc
        html_base: Any = None
        # We can get the original string from the StringInputSource
        # It's hidden in the BytesIOWrapper 'wrapped' attribute
        b_stream = source.getByteStream()
        original_string: str | None = None
        json_dict: dict | list[dict]
        if isinstance(b_stream, BytesIOWrapper):
            wrapped_inner = cast(Union[str, TextIO, TextIOBase], b_stream.wrapped)
            if isinstance(wrapped_inner, str):
                original_string = wrapped_inner
            elif isinstance(wrapped_inner, StringIO):
                original_string = wrapped_inner.getvalue()
        if _HAS_ORJSON:
            if original_string is not None:
                json_dict = orjson.loads(original_string)
            elif isinstance(b_stream, BytesIOWrapper):
                # use the CharacterStream instead
                c_stream = source.getCharacterStream()
                json_dict = orjson.loads(c_stream.read())  # type: ignore[union-attr]
            else:
                # orjson assumes its in utf-8 encoding so
                # don't bother to check the source.getEncoding()
                json_dict = orjson.loads(b_stream.read())  # type: ignore[union-attr]
        else:
            if original_string is not None:
                json_dict = json.loads(original_string)
            else:
                json_dict = json.load(source.getCharacterStream())  # type: ignore[arg-type]
        return json_dict, html_base

    # TODO: conneg for JSON (fix support in rdflib's URLInputSource!)
    source = create_input_source(source, format="json-ld")
    try:
        content_type = source.content_type
    except (AttributeError, LookupError):
        content_type = None

    is_html = content_type is not None and content_type.lower() in (
        "text/html",
        "application/xhtml+xml",
    )
    if is_html:
        html_docparser: HTMLJSONParser | None = HTMLJSONParser(
            fragment_id=fragment_id, extract_all_scripts=extract_all_scripts
        )
    else:
        html_docparser = None
    try:
        b_stream = source.getByteStream()
    except (AttributeError, LookupError):
        b_stream = None
    try:
        c_stream = source.getCharacterStream()
    except (AttributeError, LookupError):
        c_stream = None
    if b_stream is None and c_stream is None:
        raise ValueError(
            f"Source does not have a character stream or a byte stream and cannot be used {type(source)}"
        )
    try:
        b_encoding: str | None = None if b_stream is None else source.getEncoding()
    except (AttributeError, LookupError):
        b_encoding = None
    underlying_string: str | None = None
    if b_stream is not None and isinstance(b_stream, BytesIOWrapper):
        # Try to find an underlying wrapped Unicode string to use?
        wrapped_inner = b_stream.wrapped
        if isinstance(wrapped_inner, str):
            underlying_string = wrapped_inner
        elif isinstance(wrapped_inner, StringIO):
            underlying_string = wrapped_inner.getvalue()
    try:
        if is_html and html_docparser is not None:
            # Offload parsing to the HTMLJSONParser
            if underlying_string is not None:
                html_string: str = underlying_string
            elif c_stream is not None:
                html_string = c_stream.read()
            else:
                if TYPE_CHECKING:
                    assert b_stream is not None
                if b_encoding is None:
                    b_encoding = "utf-8"
                html_string = TextIOWrapper(b_stream, encoding=b_encoding).read()  # type: ignore[type-var]
            html_docparser.feed(html_string)
            json_dict, html_base = html_docparser.get_json(), html_docparser.get_base()
        elif _HAS_ORJSON:
            html_base = None
            if underlying_string is not None:
                json_dict = orjson.loads(underlying_string)
            elif (
                (b_stream is not None and isinstance(b_stream, BytesIOWrapper))
                or b_stream is None
            ) and c_stream is not None:
                # use the CharacterStream instead
                json_dict = orjson.loads(c_stream.read())
            else:
                if TYPE_CHECKING:
                    assert b_stream is not None
                # b_stream is not None
                json_dict = orjson.loads(b_stream.read())
        else:
            html_base = None
            if underlying_string is not None:
                return json.loads(underlying_string)
            if c_stream is not None:
                use_stream = c_stream
            else:
                if TYPE_CHECKING:
                    assert b_stream is not None
                # b_stream is not None
                if b_encoding is None:
                    b_encoding = "utf-8"
                use_stream = TextIOWrapper(b_stream, encoding=b_encoding)  # type: ignore[type-var]
            json_dict = json.load(use_stream)
        return json_dict, html_base
    finally:
        if b_stream is not None:
            try:
                b_stream.close()
            except AttributeError:
                pass
        if c_stream is not None:
            try:
                c_stream.close()
            except AttributeError:
                pass


VOCAB_DELIMS = ("#", "/", ":")


def split_iri(iri: str) -> tuple[str, str | None]:
    for delim in VOCAB_DELIMS:
        at = iri.rfind(delim)
        if at > -1:
            return iri[: at + 1], iri[at + 1 :]
    return iri, None


# The scheme of an absolute IRI (RFC 3986, section 3.1). urlsplit() is not
# used for this, as it strips leading spaces and raises on some inputs.
_SCHEME = re.compile(r"[A-Za-z][A-Za-z0-9+.-]*:")


def norm_url(base: str, url: str) -> str:
    """
    Resolve a reference against a base IRI.

    Against a base with a hierarchical path, such as `http://host/path`,
    `file:/path` or `s3://bucket/key`, this is reference resolution as RFC
    3986, section 5.2, describes it, done by the resolver of the N3 parser. It
    keeps empty components and repeated slashes. A query-only reference is
    resolved that way against any absolute base.

    ```python
    >>> norm_url('http://example.org/', '/one')
    'http://example.org/one'
    >>> norm_url('http://example.org/', '/one#')
    'http://example.org/one#'
    >>> norm_url('http://example.org/one', 'two')
    'http://example.org/two'
    >>> norm_url('http://example.org/one/', 'two')
    'http://example.org/one/two'
    >>> norm_url('http://example.org/', 'http://example.net/one')
    'http://example.net/one'
    >>> norm_url('http://example.org/', 'http://example.org//one')
    'http://example.org//one'
    >>> norm_url('http://example.org/one', '//example.net')
    'http://example.net'
    >>> norm_url('http://example.org', '?q')
    'http://example.org?q'
    >>> norm_url('http://example.org/one', 'two?')
    'http://example.org/two?'

    ```

    As in JSON-LD IRI expansion, a value whose part after the first colon
    begins with `//` is returned as it is. Against a URN base, a relative path
    is joined as a path below the base; against other bases without a
    hierarchical path, it is returned as it is.

    ```python
    >>> norm_url('http://example.org/one', 'two?u=http://example.net/')
    'two?u=http://example.net/'
    >>> norm_url('urn:ns:test', 'three')
    'urn:ns:test/three'

    ```
    """
    # Same-document references must not change the base path.
    if not url or url.startswith("#"):
        return (base or "").split("#", 1)[0] + url

    # An absolute IRI is not resolved, and neither is a value whose part after
    # the first colon begins with "//" (JSON-LD 1.1 API, IRI Expansion, step
    # 6.2).
    colon = url.find(":", 1)
    if _SCH
```

### Core Architecture Module: `rdflib/plugins/sparql/evalutils.py`
```
from __future__ import annotations

import collections
from collections.abc import Generator, Iterable, Mapping
from typing import (
    Any,
    TypeVar,
    Union,
    overload,
)

from rdflib.plugins.sparql.operators import EBV
from rdflib.plugins.sparql.parserutils import CompValue, Expr
from rdflib.plugins.sparql.sparql import (
    FrozenBindings,
    FrozenDict,
    NotBoundError,
    QueryContext,
    SPARQLError,
)
from rdflib.term import BNode, Identifier, Literal, URIRef, Variable

_ContextType = Union[FrozenBindings, QueryContext]
_FrozenDictT = TypeVar("_FrozenDictT", bound=FrozenDict)


def _diff(
    a: Iterable[_FrozenDictT], b: Iterable[_FrozenDictT], expr
) -> set[_FrozenDictT]:
    res = set()

    for x in a:
        if all(not x.compatible(y) or not _ebv(expr, x.merge(y)) for y in b):
            res.add(x)

    return res


def _minus(
    a: Iterable[_FrozenDictT], b: Iterable[_FrozenDictT]
) -> Generator[_FrozenDictT, None, None]:
    for x in a:
        if all((not x.compatible(y)) or x.disjointDomain(y) for y in b):
            yield x


@overload
def _join(
    a: Iterable[FrozenBindings], b: Iterable[Mapping[Identifier, Identifier]]
) -> Generator[FrozenBindings, None, None]: ...


@overload
def _join(
    a: Iterable[FrozenDict], b: Iterable[Mapping[Identifier, Identifier]]
) -> Generator[FrozenDict, None, None]: ...


def _join(
    a: Iterable[FrozenDict], b: Iterable[Mapping[Identifier, Identifier]]
) -> Generator[FrozenDict, None, None]:
    for x in a:
        for y in b:
            if x.compatible(y):
                yield x.merge(y)


def _ebv(expr: Union[Literal, Variable, Expr], ctx: FrozenDict) -> bool:
    """
    Return true/false for the given expr
    Either the expr is itself true/false
    or evaluates to something, with the given ctx

    an error is false
    """

    try:
        return EBV(expr)
    except SPARQLError:
        pass
    if isinstance(expr, Expr):
        try:
            return EBV(expr.eval(ctx))
        except SPARQLError:
            return False  # filter error == False
    # type error: Subclass of "Literal" and "CompValue" cannot exist: would have incompatible method signatures
    elif isinstance(expr, CompValue):  # type: ignore[unreachable]
        raise Exception("Weird - filter got a CompValue without evalfn! %r" % expr)
    elif isinstance(expr, Variable):
        try:
            return EBV(ctx[expr])
        except:  # noqa: E722
            return False
    return False


@overload
def _eval(
    expr: Union[Literal, URIRef],
    ctx: FrozenBindings,
    raise_not_bound_error: bool = ...,
) -> Union[Literal, URIRef]: ...


@overload
def _eval(
    expr: Union[Variable, Expr],
    ctx: FrozenBindings,
    raise_not_bound_error: bool = ...,
) -> Union[Any, SPARQLError]: ...


def _eval(
    expr: Union[Literal, URIRef, Variable, Expr],
    ctx: FrozenBindings,
    raise_not_bound_error: bool = True,
) -> Any:
    if isinstance(expr, (Literal, URIRef)):
        return expr
    if isinstance(expr, Expr):
        return expr.eval(ctx)
    elif isinstance(expr, Variable):
        try:
            return ctx[expr]
        except KeyError:
            if raise_not_bound_error:
                raise NotBoundError("Variable %s is not bound" % expr)
            else:
                return None
    elif isinstance(expr, CompValue):  # type: ignore[unreachable]
        raise Exception("Weird - _eval got a CompValue without evalfn! %r" % expr)
    else:
        raise Exception("Cannot eval thing: %s (%s)" % (expr, type(expr)))


def _filter(
    a: Iterable[FrozenDict], expr: Union[Literal, Variable, Expr]
) -> Generator[FrozenDict, None, None]:
    for c in a:
        if _ebv(expr, c):
            yield c


def _fillTemplate(
    template: Iterable[tuple[Identifier, Identifier, Identifier]],
    solution: _ContextType,
) -> Generator[tuple[Identifier, Identifier, Identifier], None, None]:
    """
    For construct/deleteWhere and friends

    Fill a triple template with instantiated variables
    """

    bnodeMap: collections.defaultdict[BNode, BNode] = collections.defaultdict(BNode)
    for t in template:
        s, p, o = t

        _s = solution.get(s)
        _p = solution.get(p)
        _o = solution.get(o)

        # instantiate new bnodes for each solution
        _s, _p, _o = [
            bnodeMap[x] if isinstance(x, BNode) else y for x, y in zip(t, (_s, _p, _o))
        ]

        if _s is not None and _p is not None and _o is not None:
            yield (_s, _p, _o)


_ValueT = TypeVar("_ValueT", Variable, BNode, URIRef, Literal)


def _val(v: _ValueT) -> tuple[int, _ValueT]:
    """utilitity for ordering things"""
    if isinstance(v, Variable):
        return (0, v)
    elif isinstance(v, BNode):
        return (1, v)
    elif isinstance(v, URIRef):
        return (2, v)
    elif isinstance(v, Literal):
        return (3, v)

```

### Core Architecture Module: `rdflib/plugins/sparql/parserutils.py`
```
"""

NOTE: PyParsing setResultName/__call__ provides a very similar solution to this
I didn't realise at the time of writing and I will remove a
lot of this code at some point

Utility classes for creating an abstract-syntax tree out with pyparsing actions

Lets you label and group parts of parser production rules

For example:

# [5] BaseDecl ::= 'BASE' IRIREF
BaseDecl = Comp('Base', Keyword('BASE') + Param('iri',IRIREF))

After parsing, this gives you back an CompValue object,
which is a dict/object with the parameters specified.
So you can access the parameters are attributes or as keys:

baseDecl.iri

Comp lets you set an evalFn that is bound to the eval method of
the resulting CompValue
"""

from __future__ import annotations

from collections import OrderedDict
from collections.abc import Callable, Mapping
from types import MethodType
from typing import (
    TYPE_CHECKING,
    Any,
    TypeVar,
    Union,
)

from pyparsing import ParserElement, ParseResults, TokenConverter

from rdflib.term import BNode, Identifier, Variable

if TYPE_CHECKING:
    from rdflib.plugins.sparql.sparql import FrozenBindings


# This is an alternative

# Comp('Sum')( Param('x')(Number) + '+' + Param('y')(Number) )


def value(
    ctx: FrozenBindings,
    val: Any,
    variables: bool = False,
    errors: bool = False,
) -> Any:
    """Utility function for evaluating something...

    Variables will be looked up in the context
    Normally, non-bound vars is an error,
    set variables=True to return unbound vars

    Normally, an error raises the error,
    set errors=True to return error
    """

    if isinstance(val, Expr):
        return val.eval(ctx)  # recurse?
    elif isinstance(val, CompValue):
        raise Exception("What do I do with this CompValue? %s" % val)

    elif isinstance(val, list):
        return [value(ctx, x, variables, errors) for x in val]

    elif isinstance(val, (BNode, Variable)):
        r = ctx.get(val)
        if isinstance(r, SPARQLError) and not errors:
            raise r
        if r is not None:
            return r

        # not bound
        if variables:
            return val
        elif errors:
            return NotBoundError()
        else:
            raise NotBoundError

    elif isinstance(val, ParseResults) and len(val) == 1:
        return value(ctx, val[0], variables, errors)
    else:
        return val


class ParamValue:
    """
    The result of parsing a Param
    This just keeps the name/value
    All cleverness is in the CompValue
    """

    def __init__(
        self, name: str, tokenList: Union[list[Any], ParseResults], isList: bool
    ):
        self.isList = isList
        self.name = name
        if isinstance(tokenList, (list, ParseResults)) and len(tokenList) == 1:
            tokenList = tokenList[0]

        self.tokenList = tokenList

    def __str__(self) -> str:
        return "Param(%s, %s)" % (self.name, self.tokenList)


class Param(TokenConverter):
    """
    A pyparsing token for labelling a part of the parse-tree
    if isList is true repeat occurrences of ParamList have
    their values merged in a list
    """

    def __init__(self, name: str, expr, isList: bool = False):
        self.isList = isList
        TokenConverter.__init__(self, expr)
        self.set_name(name)
        self.add_parse_action(self.postParse2)

    def postParse2(self, tokenList: Union[list[Any], ParseResults]) -> ParamValue:
        return ParamValue(self.name, tokenList, self.isList)


class ParamList(Param):
    """
    A shortcut for a Param with isList=True
    """

    def __init__(self, name: str, expr):
        Param.__init__(self, name, expr, True)


_ValT = TypeVar("_ValT")


class CompValue(OrderedDict):
    """
    The result of parsing a Comp
    Any included Params are available as Dict keys
    or as attributes
    """

    def __init__(self, name: str, **values):
        OrderedDict.__init__(self)
        self.name = name
        self.update(values)

    def clone(self) -> CompValue:
        return CompValue(self.name, **self)

    def __str__(self) -> str:
        return self.name + "_" + OrderedDict.__str__(self)

    def __repr__(self) -> str:
        return self.name + "_" + dict.__repr__(self)

    def _value(
        self, val: _ValT, variables: bool = False, errors: bool = False
    ) -> Union[_ValT, Any]:
        if self.ctx is not None:
            return value(self.ctx, val, variables, errors)
        else:
            return val

    def __getitem__(self, a):
        return self._value(OrderedDict.__getitem__(self, a))

    # type error: Signature of "get" incompatible with supertype "dict"
    # type error: Signature of "get" incompatible with supertype "Mapping"  [override]
    def get(self, a, variables: bool = False, errors: bool = False):  # type: ignore[override]
        return self._value(OrderedDict.get(self, a, a), variables, errors)

    def __getattr__(self, a: str) -> Any:
        # Hack hack: OrderedDict relies on this
        if a in ("_OrderedDict__root", "_OrderedDict__end"):
            raise AttributeError()
        try:
            return self[a]
        except KeyError:
            # raise AttributeError('no such attribute '+a)
            return None

    if TYPE_CHECKING:
        # this is here because properties are dynamically set on CompValue
        def __setattr__(self, __name: str, __value: Any) -> None: ...


class Expr(CompValue):
    """
    A CompValue that is evaluatable
    """

    def __init__(
        self,
        name: str,
        evalfn: Callable[[Any, Any], Any] | None = None,
        **values,
    ):
        super(Expr, self).__init__(name, **values)

        self._evalfn = None
        if evalfn:
            self._evalfn = MethodType(evalfn, self)

    def eval(self, ctx: Any = {}) -> Union[SPARQLError, Any]:
        try:
            self.ctx: Union[Mapping, FrozenBindings] | None = ctx
            # type error: "None" not callable
            return self._evalfn(ctx)  # type: ignore[misc]
        except SPARQLError as e:
            return e
        finally:
            self.ctx = None


class Comp(TokenConverter):
    """
    A pyparsing token for grouping together things with a label
    Any sub-tokens that are not Params will be ignored.

    Returns CompValue / Expr objects - depending on whether evalFn is set.
    """

    def __init__(self, name: str, expr: ParserElement):
        self.expr = expr
        TokenConverter.__init__(self, expr)
        self.set_name(name)
        self.evalfn: Callable[[Any, Any], Any] | None = None

    def parseImpl(
        self, instring: str, loc: int = 0, do_actions: bool = True
    ) -> tuple[int, ParseResults]:
        if self.name == "ServiceGraphPattern":
            # Embed the start position as a named key in the ParseResults so
            # postParse can extract the original SERVICE text, avoiding
            # RecursionError with nested SERVICE).
            new_loc, results = super().parseImpl(instring, loc, do_actions)
            results["_service_start"] = loc
            return new_loc, results
        return super().parseImpl(instring, loc, do_actions)

    def postParse(
        self, instring: str, loc: int, tokenList: ParseResults
    ) -> Union[Expr, CompValue]:
        res: Union[Expr, CompValue]
        if self.evalfn:
            res = Expr(self.name)
            res._evalfn = MethodType(self.evalfn, res)
        else:
            res = CompValue(self.name)
            if self.name == "ServiceGraphPattern":
                start = tokenList["_service_start"]
                res["service_string"] = instring[start:loc]

        for t in tokenList:
            if isinstance(t, ParamValue):
                if t.isList:
                    if t.name not in res:
                        res[t.name] = []
                    res[t.name].append(t.tokenList)
                else:
                    res[t.name] = t.tokenList
                # res.append(t.tokenList)
            # if isinstance(t,CompValue):
            #    res.update(t)
        return res

    def setEvalFn(self, evalfn: Callable[[Any, Any], Any]) -> Comp:
        self.evalfn = evalfn
        return self


def prettify_parsetree(t: ParseResults, indent: str = "", depth: int = 0) -> str:
    out: list[str] = []
    for e in t.as_list():
        out.append(_prettify_sub_parsetree(e, indent, depth + 1))
    for k, v in sorted(t.items()):
        out.append("%s%s- %s:\n" % (indent, "  " * depth, k))
        out.append(_prettify_sub_parsetree(v, indent, depth + 1))
    return "".join(out)


def _prettify_sub_parsetree(
    t: Union[Identifier, CompValue, set, list, dict, tuple, bool, None],
    indent: str = "",
    depth: int = 0,
) -> str:
    out: list[str] = []
    if isinstance(t, CompValue):
        out.append("%s%s> %s:\n" % (indent, "  " * depth, t.name))
        for k, v in t.items():
            out.append("%s%s- %s:\n" % (indent, "  " * (depth + 1), k))
            out.append(_prettify_sub_parsetree(v, indent, depth + 2))
    elif isinstance(t, dict):
        for k, v in t.items():
            out.append("%s%s- %s:\n" % (indent, "  " * (depth + 1), k))
            out.append(_prettify_sub_parsetree(v, indent, depth + 2))
    elif isinstance(t, list):
        for e in t:
            out.append(_prettify_sub_parsetree(e, indent, depth + 1))
    else:
        out.append("%s%s- %r\n" % (indent, "  " * depth, t))
    return "".join(out)


# hurrah for circular imports
from rdflib.plugins.sparql.sparql import NotBoundError, SPARQLError  # noqa: E402

```

### Core Architecture Module: `rdflib/plugins/stores/concurrent.py`
```
from threading import Lock


class ResponsibleGenerator:
    """A generator that will help clean up when it is done being used."""

    __slots__ = ["cleanup", "gen"]

    def __init__(self, gen, cleanup):
        self.cleanup = cleanup
        self.gen = gen

    def __del__(self):
        self.cleanup()

    def __iter__(self):
        return self

    def __next__(self):
        return next(self.gen)


class ConcurrentStore:
    """A store that allows concurrent reads and writes."""

    def __init__(self, store):
        self.store = store

        # number of calls to visit still in progress
        self.__visit_count = 0

        # lock for locking down the indices
        self.__lock = Lock()

        # lists for keeping track of added and removed triples while
        # we wait for the lock
        self.__pending_removes = []
        self.__pending_adds = []

    def add(self, triple):
        s, p, o = triple
        if self.__visit_count == 0:
            self.store.add((s, p, o))
        else:
            self.__pending_adds.append((s, p, o))

    def remove(self, triple):
        s, p, o = triple
        if self.__visit_count == 0:
            self.store.remove((s, p, o))
        else:
            self.__pending_removes.append((s, p, o))

    def triples(self, triple):
        su, pr, ob = triple
        g = self.store.triples((su, pr, ob))
        pending_removes = self.__pending_removes
        self.__begin_read()
        for s, p, o in ResponsibleGenerator(g, self.__end_read):
            if not (s, p, o) in pending_removes:  # noqa: E713
                yield s, p, o

        for s, p, o in self.__pending_adds:
            if (
                (su is None or su == s)
                and (pr is None or pr == p)
                and (ob is None or ob == o)
            ):
                yield s, p, o

    def __len__(self):
        return self.store.__len__()

    def __begin_read(self):
        lock = self.__lock
        lock.acquire()
        self.__visit_count = self.__visit_count + 1
        lock.release()

    def __end_read(self):
        lock = self.__lock
        lock.acquire()
        self.__visit_count = self.__visit_count - 1
        if self.__visit_count == 0:
            pending_removes = self.__pending_removes
            while pending_removes:
                s, p, o = pending_removes.pop()
                try:
                    self.store.remove((s, p, o))
                except:  # noqa: E722
                    # TODO: change to try finally?
                    print(s, p, o, "Not in store to remove")
            pending_adds = self.__pending_adds
            while pending_adds:
                s, p, o = pending_adds.pop()
                self.store.add((s, p, o))
        lock.release()

```

### Core Architecture Module: `rdflib/util.py`
```
"""
Some utility functions.

Miscellaneous utilities

* list2set
* first
* uniq
* more_than

Term characterisation and generation

* to_term
* from_n3

Date/time utilities

* date_time
* parse_date_time

"""

from __future__ import annotations

from calendar import timegm
from collections.abc import Callable, Hashable, Iterable, Iterator
from os.path import splitext

# from time import daylight
from time import altzone, gmtime, localtime, time, timezone
from typing import (
    TYPE_CHECKING,
    Any,
    Optional,
    TypeVar,
    Union,
    overload,
)
from urllib.parse import quote, urlsplit, urlunsplit

import rdflib.graph  # avoid circular dependency
import rdflib.namespace
import rdflib.term
from rdflib.compat import sign

if TYPE_CHECKING:
    from rdflib.graph import Graph


__all__ = [
    "list2set",
    "first",
    "uniq",
    "more_than",
    "to_term",
    "from_n3",
    "date_time",
    "parse_date_time",
    "guess_format",
    "find_roots",
    "get_tree",
    "_coalesce",
    "_iri2uri",
]

_HashableT = TypeVar("_HashableT", bound=Hashable)
_AnyT = TypeVar("_AnyT")


SUFFIX_FORMAT_MAP = {
    "xml": "xml",
    "rdf": "xml",
    "owl": "xml",
    "n3": "n3",
    "ttl": "turtle",
    "nt": "nt",
    "trix": "trix",
    "xhtml": "rdfa",
    "html": "rdfa",
    "svg": "rdfa",
    "nq": "nquads",
    "nquads": "nquads",
    "trig": "trig",
    "json": "json-ld",
    "jsonld": "json-ld",
    "json-ld": "json-ld",
}


FORMAT_MIMETYPE_MAP = {
    "xml": ["application/rdf+xml"],
    "n3": ["text/n3"],
    "turtle": ["text/turtle"],
    "nt": ["application/n-triples"],
    "trix": ["application/trix"],
    "rdfa": ["text/html", "application/xhtml+xml"],
    "nquads": ["application/n-quads"],
    "trig": ["application/trig"],
    "json-ld": ["application/ld+json"],
}


RESPONSE_TABLE_FORMAT_MIMETYPE_MAP = {
    "xml": ["application/sparql-results+xml"],
    "json": ["application/sparql-results+json"],
    "csv": ["text/csv"],
    "tsv": ["text/tab-separated-values"],
}


def list2set(seq: Iterable[_HashableT]) -> list[_HashableT]:
    """
    Return a new list without duplicates.
    Preserves the order, unlike set(seq)
    """
    seen = set()
    # type error: "add" of "set" does not return a value
    return [x for x in seq if x not in seen and not seen.add(x)]  # type: ignore[func-returns-value]


def first(seq: Iterable[_AnyT]) -> _AnyT | None:
    """
    return the first element in a python sequence
    for graphs, use graph.value instead
    """
    for result in seq:
        return result
    return None


def uniq(sequence: Iterable[str], strip: int = 0) -> set[str]:
    """removes duplicate strings from the sequence."""
    if strip:
        return set(s.strip() for s in sequence)
    else:
        return set(sequence)


def more_than(sequence: Iterable[Any], number: int) -> int:
    "Returns 1 if sequence has more items than number and 0 if not."
    i = 0
    for item in sequence:
        i += 1
        if i > number:
            return 1
    return 0


def to_term(
    s: str | None, default: rdflib.term.Identifier | None = None
) -> rdflib.term.Identifier | None:
    """
    Creates and returns an Identifier of type corresponding
    to the pattern of the given positional argument string `s`:

    '' returns the `default` keyword argument value or `None`

    '<s>' returns `URIRef(s)` (i.e. without angle brackets)

    '"s"' returns `Literal(s)` (i.e. without doublequotes)

    '_s' returns `BNode(s)` (i.e. without leading underscore)

    """
    if not s:
        return default
    elif s.startswith("<") and s.endswith(">"):
        return rdflib.term.URIRef(s[1:-1])
    elif s.startswith('"') and s.endswith('"'):
        return rdflib.term.Literal(s[1:-1])
    elif s.startswith("_"):
        return rdflib.term.BNode(s)
    else:
        msg = "Unrecognised term syntax: '%s'" % s
        raise Exception(msg)


def from_n3(
    s: str,
    default: str | None = None,
    backend: str | None = None,
    nsm: rdflib.namespace.NamespaceManager | None = None,
) -> Union[rdflib.term.Node, str] | None:
    r'''Creates the Identifier corresponding to the given n3 string.

    ```python
    >>> from rdflib.term import URIRef, Literal
    >>> from rdflib.namespace import NamespaceManager
    >>> from_n3('<http://ex.com/foo>') == URIRef('http://ex.com/foo')
    True
    >>> from_n3('"foo"@de') == Literal('foo', lang='de')
    True
    >>> from_n3('"""multi\nline\nstring"""@en') == Literal(
    ...     'multi\nline\nstring', lang='en')
    True
    >>> from_n3('42') == Literal(42)
    True
    >>> from_n3(Literal(42).n3()) == Literal(42)
    True
    >>> from_n3('"42"^^xsd:integer') == Literal(42)
    True
    >>> from rdflib import RDFS
    >>> from_n3('rdfs:label') == RDFS['label']
    True
    >>> nsm = NamespaceManager(rdflib.graph.Graph())
    >>> nsm.bind('dbpedia', 'http://dbpedia.org/resource/')
    >>> berlin = URIRef('http://dbpedia.org/resource/Berlin')
    >>> from_n3('dbpedia:Berlin', nsm=nsm) == berlin
    True

    ```
    '''
    if not s:
        return default
    if s.startswith("<"):
        # Hack: this should correctly handle strings with either native unicode
        # characters, or \u1234 unicode escapes.
        return rdflib.term.URIRef(
            s[1:-1].encode("raw-unicode-escape").decode("unicode-escape")
        )
    elif s.startswith('"'):
        if s.startswith('"""'):
            quotes = '"""'
        else:
            quotes = '"'
        value, rest = s.rsplit(quotes, 1)
        value = value[len(quotes) :]  # strip leading quotes
        datatype = None
        language = None

        # as a given datatype overrules lang-tag check for it first
        dtoffset = rest.rfind("^^")
        if dtoffset >= 0:
            # found a datatype
            # datatype has to come after lang-tag so ignore everything before
            # see: http://www.w3.org/TR/2011/WD-turtle-20110809/
            # #prod-turtle2-RDFLiteral
            datatype = from_n3(rest[dtoffset + 2 :], default, backend, nsm)
        else:
            if rest.startswith("@"):
                language = rest[1:]  # strip leading at sign

        value = value.replace(r"\"", '"')
        # unicode-escape interprets \xhh as an escape sequence,
        # but n3 does not define it as such.
        value = value.replace(r"\x", r"\\x")
        # Hack: this should correctly handle strings with either native unicode
        # characters, or \u1234 unicode escapes.
        value = value.encode("raw-unicode-escape").decode("unicode-escape")
        # type error: Argument 3 to "Literal" has incompatible type "Union[Node, str, None]"; expected "Optional[str]"
        return rdflib.term.Literal(value, language, datatype)  # type: ignore[arg-type]
    elif s == "true" or s == "false":
        return rdflib.term.Literal(s == "true")
    elif (
        s.lower()
        .replace(".", "", 1)
        .replace("-", "", 1)
        .replace("e", "", 1)
        .isnumeric()
    ):
        if "e" in s.lower():
            return rdflib.term.Literal(s, datatype=rdflib.namespace.XSD.double)
        if "." in s:
            return rdflib.term.Literal(float(s), datatype=rdflib.namespace.XSD.decimal)
        return rdflib.term.Literal(int(s), datatype=rdflib.namespace.XSD.integer)

    elif s.startswith("{"):
        identifier = from_n3(s[1:-1])
        # type error: Argument 1 to "QuotedGraph" has incompatible type "Optional[str]"; expected "Union[Store, str]"
        # type error: Argument 2 to "QuotedGraph" has incompatible type "Union[Node, str, None]"; expected "Union[IdentifiedNode, str, None]"
        return rdflib.graph.QuotedGraph(backend, identifier)  # type: ignore[arg-type]
    elif s.startswith("["):
        identifier = from_n3(s[1:-1])
        # type error: Argument 1 to "Graph" has incompatible type "Optional[str]"; expected "Union[Store, str]"
        # type error: Argument 2 to "Graph" has incompatible type "Union[Node, str, None]"; expected "Union[IdentifiedNode, str, None]"
        return rdflib.graph.Graph(backend, identifier)  # type: ignore[arg-type]
    elif s.startswith("_:"):
        return rdflib.term.BNode(s[2:])
    elif ":" in s:
        if nsm is None:
            # instantiate default NamespaceManager and rely on its defaults
            nsm = rdflib.namespace.NamespaceManager(rdflib.graph.Graph())
        prefix, last_part = s.split(":", 1)
        ns = dict(nsm.namespaces())[prefix]
        return rdflib.namespace.Namespace(ns)[last_part]
    else:
        return rdflib.term.BNode(s)


def date_time(t=None, local_time_zone=False):
    """http://www.w3.org/TR/NOTE-datetime ex: 1997-07-16T19:20:30Z

    ```python
    >>> date_time(1126482850)
    '2005-09-11T23:54:10Z'

    @@ this will change depending on where it is run
    #>>> date_time(1126482850, local_time_zone=True)
    #'2005-09-11T19:54:10-04:00'

    >>> date_time(1)
    '1970-01-01T00:00:01Z'

    >>> date_time(0)
    '1970-01-01T00:00:00Z'

    ```
    """
    if t is None:
        t = time()

    if local_time_zone:
        time_tuple = localtime(t)
        if time_tuple[8]:
            tz_mins = altzone // 60
        else:
            tz_mins = timezone // 60
        tzd = "-%02d:%02d" % (tz_mins // 60, tz_mins % 60)
    else:
        time_tuple = gmtime(t)
        tzd = "Z"

    year, month, day, hh, mm, ss, wd, y, z = time_tuple
    s = "%0004d-%02d-%02dT%02d:%02d:%02d%s" % (year, month, day, hh, mm, ss, tzd)
    return s


def parse_date_time(val: str) -> int:
    """always returns seconds in UTC

    ```python
    # tests are written like this to make any errors easier to understand
    >>> parse_date_time('2005-09-11T23:54:10Z') - 1126482850.0
    0.0

    >>> parse_date_time('2005-09-11T16:54:10-07:00') - 1126482850.0
    0.0

    >>> parse_date_time('1970-01-01T00:00:01Z') - 1.0
    0.0

    >>> parse_date_time('1970-01-01T00:00:00Z') - 0.0
    0.0
    >>> parse_date_time("2005-09-05T10:42:00") - 1125916920.0
    0.0

```

### Core Architecture Module: `admin/get_merged_prs.py`
```
"""Get all merged PRs since last release, save them to a JSON file"""

import json
import urllib.parse
import urllib.request

# https://api.github.com/search/issues?q=repo:rdflib/rdflib+is:pr+merged:%3E=2023-08-02&per_page=300&page=1
LAST_RELEASE_DATE = "2025-03-29"
ISSUES_URL = "https://api.github.com/search/issues"
ITEMS = []
PAGE = 1

# make sequential requests for each page of PRs
while True:
    params = {
        "q": f"repo:rdflib/rdflib+is:pr+merged:>={LAST_RELEASE_DATE}",
        "per_page": 100,
        "page": PAGE,
    }
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    url = ISSUES_URL + "?" + query_string

    print(f"Getting {url}")
    with urllib.request.urlopen(url) as response:
        response_text = response.read()
        link_headers = (
            response.info()["link"].split(",")
            if response.info()["link"] is not None
            else None
        )

    json_data = json.loads(response_text)
    ITEMS.extend(json_data["items"])

    keep_going = False
    if link_headers is not None:
        for link in link_headers:
            if 'rel="next"' in link:
                # url = link.strip("<").split(">")[0]
                PAGE += 1
                keep_going = True

    if not keep_going:
        break

with open("merged_prs.json", "w") as f:
    json.dump(ITEMS, f, indent=4)

# split interesting and boring PRs into two lists
good_prs = []
boring_prs = []
for pr in sorted(ITEMS, key=lambda k: k["closed_at"], reverse=True):
    matches = ["bump", "pre-commit.ci"]
    if any(x in pr["title"] for x in matches):
        boring_prs.append(
            f"""* {pr["closed_at"][:10]} - {pr["title"]}\n  [PR #{pr["number"]}]({pr["html_url"]})"""
        )
    else:
        good_prs.append(
            f"""* {pr["closed_at"][:10]} - {pr["title"]}\n  [PR #{pr["number"]}]({pr["html_url"]})"""
        )

for pr in good_prs:
    print(pr)

print()
print()

for pr in boring_prs:
    print(pr)

```

### Core Architecture Module: `admin/pr_markdown.py`
```
import json
import sys
from dataclasses import dataclass


@dataclass
class PR:
    number: int
    title: str
    pull_request_merged_at: str
    pull_request_url: str
    username: str

    def __repr__(self):
        return f"{self.title} by @{self.username} in [#{self.number}]({self.pull_request_url})"


try:
    json_data = json.load(sys.stdin)
    prs = [PR(**pr) for pr in json_data["items"]]
    for pr in prs:
        print(f"- {pr}")
except json.JSONDecodeError as e:
    print(f"Error parsing JSON: {e}")
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3735** (2026-11-19): **JSON-LD serializer drops blank nodes that only reference each other**
  *Symptoms*: I have a graph that has two blank nodes pointing at each other. The Graph holds this fine, but serializing to JSON-LD drops everything:  ```python from rdflib import Graph  ttl = """       @prefix bf: <http://id.loc.gov/ontologies/bibframe/> .       _:work a bf:Work ; bf:hasInstance _:instance .       _:instance a bf:Instance ; bf:instanceOf _:work .       """  g = Graph().parse(data=ttl, format="turtle")  assert len(g) == 4  print(g.serialize(format="json-ld")) ```  The final print will not print any graph. Whereas using pyld will:  ```python from pyld import jsonld  print(jsonld.from_rdf(g.serialize(format='ntriples'))) ```

- **Issue #3602** (2026-10-24): **SPARQL `ORDER BY` on an expression that errors raises `TypeError`**
  *Symptoms*: ### Description  `evalOrderBy` (`rdflib/plugins/sparql/evaluate.py`) sorts with `key=lambda x: _val(value(x, e.expr, variables=True))`. When the sort expression errors for a solution, `value()` returns a `SPARQLError` object. `_val` (`rdflib/plugins/sparql/evalutils.py`) only handles `Variable`, `BNode`, `URIRef` and `Literal`, so it falls through and returns `None`. Python's `sorted` then compares `None` with `None` or with a `(rank, term)` tuple and raises `TypeError` out of the query.  SPARQL 1.1 §15.1 (ORDER BY) ranks "no value assigned to the variable or expression" lowest, below blank nodes, IRIs and literals. So a solution whose key errors or is unbound should sort as the lowest value, and the query should not crash. A *bare* unbound variable (`ORDER BY ?u`) already works, because `variables=True` returns the `Variable` and `_val` ranks it `0`. Only error results from expressions are affected. The bug needs at least two solutions to show, because with one solution `sorted` never compares keys.  ### Reproducer  ```python from rdflib import Graph  for key in ["DESC(?o = ?u)", "DESC(?o IN (1/0, 2))", "(1/0)", "?u"]:     q = f"SELECT ?o WHERE {{ VALUES ?o {{ 1 2 }} }} ORDER BY {key}"     try:         print(key, list(Graph().query(q)))     except Exception as e:         print(key, type(e).__name__, e) ```  ### Observed (rdflib 7.7.0a0, `main` and #3580 head)  | `ORDER BY` key | rdflib result | |---|---| | `DESC(?o = ?u)` | `TypeError: '<' not supported between instances of 

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

### Incident Patch 1: `e775564d` (2026-11-20)
**Commit Message**: fix: promote numeric types in SPARQL multiplication and division (#3694)

MultiplicativeExpression turned the first operand into a Decimal and
only switched to float when a later operand was a float, and it typed
the result by its Python type. So 2 * 3 was an xsd:decimal, 1.5e0 * 2
a decimal instead of a double, and 1e308 * 10 a decimal rounded to 28
digits instead of infinity. Dividing a double by zero was an error, and
an ill-typed operand could give a wrong value.

Promote the operands with type_promotion, as AdditiveExpression does
and as op:numeric-multiply and op:numeric-divide require (SPARQL 1.1,
section 17.3; XPath 3.1 Functions and Operators, section 4.2). Integer
division gives a decimal, and a float or double divided by zero gives
INF, -INF or NaN; integer and decimal division by zero stay errors. An
ill-typed operand is a type error, an integer too large for a double is
INF or -INF next to a double, and overflows are SPARQL errors. Add an
upgrade note for the changed result types.

Signed-off-by: jdsika <[REDACTED_EMAIL]>
Co-authored-by: Nicholas Car <[REDACTED_EMAIL]>

**File**: `docs/upgrade7to8.md` (modified, +18/-0)
```diff
@@ -31,6 +31,24 @@ these operations are constant-time, especially in loops over large or remote
 datasets. A dataset containing only empty named graphs has length zero and is
 false, even though those graph names remain present.
 
+## SPARQL multiplication and division
+
+SPARQL `*` and `/` now give the result the promoted type of their operands, as
+XPath's `op:numeric-multiply` and `op:numeric-divide` define it and as `+` and
+`-` already did:
+
+- An integer times an integer is an `xsd:integer`, and exact for large values.
+  It was an `xsd:decimal`, rounded to 28 digits.
+- A product or quotient with an `xsd:float` or `xsd:double` operand is a float
+  or double, also when that operand comes first, so `toPython()` gives a
+  Python `float` where it gave a `Decimal`.
+- A float or double divided by zero is `INF`, `-INF` or `NaN` instead of an
+  error. Integer and decimal division by zero are still errors.
+- An ill-typed operand, such as `"abc"^^xsd:integer`, is an error.
+
+`DATATYPE()`, `sameTerm()`, `DISTINCT` and joins on such computed values change
+accordingly.
+
 ## Infinite and NaN doubles
 
 A [`Literal`][rdflib.term.Literal] made from an infinite or NaN float, or
```

**File**: `rdflib/plugins/sparql/operators.py` (modified, +52/-14)
```diff
@@ -16,7 +16,7 @@
 import uuid
 import warnings
 from collections.abc import Callable
-from decimal import ROUND_HALF_DOWN, ROUND_HALF_UP, Decimal, InvalidOperation
+from decimal import ROUND_HALF_DOWN, ROUND_HALF_UP, Decimal
 from functools import reduce
 from typing import Any, NoReturn, Union, overload
 from urllib.parse import quote
@@ -758,23 +758,61 @@ def MultiplicativeExpression(
     # we sometimes have nothing to do
     if other is None:
         return expr
-    try:
-        res: Union[Decimal, float]
-        res = Decimal(numeric(expr))
-        for op, f in zip(e.op, other):
-            f = numeric(f)
-
-            if type(f) == float:  # noqa: E721
-                res = float(res)
 
-            if op == "*":
-                res *= f
+    # The operands are promoted to a common type, as op:numeric-multiply and
+    # op:numeric-divide do (SPARQL 1.1, section 17.3; XPath 3.1 Functions and
+    # Operators, section 4.2), and the result has that type. As in
+    # AdditiveExpression, xsd:float values are computed in double precision.
+    res: Union[int, Decimal, float] = _number(expr)
+    dt = expr.datatype
+    try:
+        for op, term in zip(e.op, other):
+            n = _number(term)
+            dt = type_promotion(dt, term.datatype)
+            if dt in (XSD.float, XSD.double):
+                res, n = _to_float(res), _to_float(n)
+                res = res * n if op == "*" else _float_divide(res, n)
+            elif op == "*":
+                res = res * n
             else:
-                res /= f
-    except (InvalidOperation, ZeroDivisionError):
+                # Dividing integers gives a decimal.
+                res = Decimal(res) / Decimal(n)
+                dt = XSD.decimal
+        return Literal(res, datatype=dt)
+    except ZeroDivisionError:
         raise SPARQLError("divide by 0")
+    except (ArithmeticError, ValueError) as error:
+        raise SPARQLError("numeric overflow or invalid operation: %r" % error)
+
 
-    return Literal(res)
+def _number(term: Literal) -> Any:
+    """The value of a numeric literal, or a type error if it is ill-typed."""
+    value = numeric(term)
+    if not isinstance(value, (int, Decimal, float)):
+        raise SPARQLTypeError("%r is not a valid %s" % (term, term.datatype))
+    return value
+
+
+def _to_float(value: Union[int, Decimal, float]) -> float:
+    """Cast to xs:double; an integer too large for a double is INF or -INF."""
+    try:
+        return float(value)
+    except OverflowError:
+        return math.inf if value > 0 else -math.inf
+
+
+def _float_divide(dividend: float, divisor: float) -> float:
+    """Divide two floats as op:numeric-divide does for xs:float and xs:double.
+
+    Dividing by zero gives INF, -INF or NaN (XPath 3.1 Functions and
+    Operators, section 4.2.4), where Python raises an exception.
+    """
+    try:
+        return dividend / divisor
+    except ZeroDivisionError:
+        if dividend == 0 or math.isnan(dividend):
+            return math.nan
+        return math.copysign(math.inf, dividend) * math.copysign(1.0, divisor)
 
 
 # type error: Missing return statement
```

**File**: `test/test_sparql/test_expressions.py` (modified, +72/-1)
```diff
@@ -1,7 +1,11 @@
+import math
+from decimal import Decimal
 from functools import partial
 
+import pytest
+
 import rdflib.plugins.sparql.parser as p
-from rdflib import Literal, Variable
+from rdflib import XSD, Literal, URIRef, Variable
 from rdflib.plugins.sparql.algebra import translatePName, traverse
 from rdflib.plugins.sparql.operators import simplify
 from rdflib.plugins.sparql.sparql import Prologue, QueryContext, SPARQLError
@@ -63,6 +67,73 @@ def test_arithmetic():
     eq(_eval(_translate(p.Expression.parse_string("(2+4)/2")[0])).value, 3)
 
 
+FLOAT = f"<{XSD.float}>"
+INT = f"<{XSD.int}>"
+SHORT = f"<{XSD.short}>"
+
+
+@pytest.mark.parametrize(
+    ("expression", "value", "datatype"),
+    [
+        pytest.param("2*3", 6, XSD.integer, id="integer"),
+        pytest.param(f'"3"^^{INT}*"2"^^{SHORT}', 6, XSD.integer, id="integer-subtypes"),
+        pytest.param(
+            "123456789012345678901234567890*3",
+            370370367037037036703703703670,
+            XSD.integer,
+            id="large-integer",
+        ),
+        pytest.param("2*1.5", Decimal("3.0"), XSD.decimal, id="decimal"),
+        pytest.param("1.5e0*2", 3.0, XSD.double, id="double-first"),
+        pytest.param("1.5e0*2*3", 9.0, XSD.double, id="double-chain"),
+        pytest.param(f'"2.5"^^{FLOAT}*2', 5.0, XSD.float, id="float"),
+        pytest.param("7/2", Decimal("3.5"), XSD.decimal, id="integer-division"),
+        pytest.param("7e0/2", 3.5, XSD.double, id="double-division"),
+        pytest.param("1e308*10", math.inf, XSD.double, id="overflow"),
+        pytest.param("-1e308*10", -math.inf, XSD.double, id="negative-overflow"),
+        pytest.param(f"1{'0' * 400}*1e0", math.inf, XSD.double, id="huge-integer"),
+        pytest.param("1e0/0", math.inf, XSD.double, id="divide-by-zero"),
+        pytest.param("-1e0/0", -math.inf, XSD.double, id="negative-by-zero"),
+        pytest.param("1e0/-0e0", -math.inf, XSD.double, id="by-negative-zero"),
+        pytest.param(f'"2"^^{FLOAT}/0', math.inf, XSD.float, id="float-by-zero"),
+    ],
+)
+def test_multiplication_and_division_promote_numeric_types(
+    expression: str, value: object, datatype: URIRef
+) -> None:
+    """The result has the promoted type of the operands, as in XPath 3.1
+    Functions and Operators, section 4.2: integer times double is a double,
+    and a double divided by zero is infinite."""
+    result = _eval(_translate(p.Expression.parse_string(expression)[0]))
+
+    assert (result.value, result.datatype) == (value, datatype)
+
+
+def test_zero_divided_by_zero_is_nan_for_doubles() -> None:
+    result = _eval(_translate(p.Expression.parse_string("0e0/0")[0]))
+
+    assert math.isnan(result.value) and result.datatype == XSD.double
+
+
+@pytest.mark.parametrize(
+    "expression",
+    [
+        pytest.param("1/0", id="integer-by-zero"),
+        pytest.param("1.0/0", id="decimal-by-zero"),
+        pytest.param(f'"abc"^^<{XSD.integer}>*2', id="ill-typed-integer"),
+        pytest.param(f'2*"abc"^^<{XSD.decimal}>', id="ill-typed-decimal"),
+        pytest.param(f'"1.5"^^<{XSD.integer}>*3', id="ill-typed-fraction"),
+        pytest.param(f'"abc"^^<{XSD.double}>*2', id="ill-typed-double"),
+        pytest.param(f'2e0*"abc"^^<{XSD.integer}>', id="ill-typed-with-double"),
+        pytest.param(f"1{'0' * 2200}*1{'0' * 2200}", id="too-many-digits"),
+    ],
+)
+def test_multiplication_and_division_errors(expression: str) -> None:
+    """Integer and decimal division by zero, ill-typed operands, and an integer
+    too long to write are errors, not crashes or strings."""
+    assert _eval(_translate(p.Expression.parse_string(expression)[0])) is False
+
+
 def test_arithmetic_var():
     ctx = QueryContext()
     ctx[Variable("x")] = Literal(2)
```

---

### Incident Patch 2: `663b2ac0` (2026-11-18)
**Commit Message**: fix: write infinite and NaN doubles as INF, -INF and NaN (#3691)

* fix: write infinite and NaN doubles as INF, -INF and NaN

A float literal took its lexical form from str(), so infinity and NaN
became "inf" and "nan", which are not in the lexical space of xsd:double
or xsd:float (XML Schema 1.1 Part 2, sections 3.3.4.2 and 3.3.5.2). Only
Turtle and N3 output corrected them. N-Triples, N-Quads, RDF/XML and
SPARQL wrote the Python spelling, and normalizing a parsed "INF" turned
it into "inf". Give a float value its canonical XSD form when the
literal is made, and add an upgrade note for the change.

Signed-off-by: jdsika <[REDACTED_EMAIL]>

* fix: write an unnormalized INF or NaN in n3() with _float_lexical

_literal_n3 replaced "inf" and "nan" in the lexical form of a special
value, so "infinity" became "INFinity", and "INFINITY" and "NAN" were
written as they were; none of these is a valid xsd:double. Write the
canonical form from _float_lexical instead when the lexical form is a
Python spelling: not in the xsd:double lexical space and without
digits, so that valid forms such as "+INF", and numerals that overflow
such as "1e400", are kept. This covers Turtle, N3, TriG and the oth

**File**: `docs/upgrade7to8.md` (modified, +26/-0)
```diff
@@ -30,3 +30,29 @@ Results are not cached, so repeated checks repeat the work. Avoid assuming
 these operations are constant-time, especially in loops over large or remote
 datasets. A dataset containing only empty named graphs has length zero and is
 false, even though those graph names remain present.
+
+## Infinite and NaN doubles
+
+A [`Literal`][rdflib.term.Literal] made from an infinite or NaN float, or
+parsed as an infinite or NaN `xsd:double` or `xsd:float`, now has the lexical
+form `INF`, `-INF` or `NaN`, the canonical XML Schema forms. RDFLib 7 used
+Python's spelling, `inf`, `-inf` and `nan`, which is not a valid `xsd:double`
+or `xsd:float`. Turtle and N3 output already used the new forms; `str()`,
+N-Triples, N-Quads, RDF/XML, TriX, HexT, Patch and SPARQL results change.
+
+- A literal made with `normalize=False` keeps its lexical form. Only `n3()`,
+  and so Turtle, N3, TriG and the SPARQL stores, writes a special value spelled
+  as Python does, such as `infinity`, `INFINITY` or `NAN`, in its XSD form, as
+  it already did for `inf` and `nan`; a numeral is kept, even when it
+  overflows. Comparisons that use `n3()`, such as
+  [`isomorphic`][rdflib.compare.isomorphic], treat such a literal as equal to
+  the canonical one.
+- Such a literal no longer equals one made with `normalize=False` from the old
+  spelling, such as `Literal("inf", datatype=XSD.double, normalize=False)`.
+  Literals in SPARQL queries aren't normalized, so a query that spells the
+  value `"inf"^^xsd:double` no longer matches, and `"INF"^^xsd:double` now does.
+- A persistent store that indexes literals by their lexical form, such as the
+  BerkeleyDB store, keeps the old spelling for data written by RDFLib 7.
+  RDFLib 8 reads such data back as `INF` and `NaN`, but can't find or remove
+  it by value. To migrate such a store, export its data with RDFLib 8 and load
+  it into a new store.
```

**File**: `rdflib/term.py` (modified, +41/-9)
```diff
@@ -1713,14 +1713,16 @@ def _literal_n3(
             if datatype in _NUMERIC_INF_NAN_LITERAL_TYPES:
                 try:
                     v = float(self)
-                    if math.isinf(v):
-                        # py string reps: float: 'inf', Decimal: 'Infinity"
-                        # both need to become "INF" in xsd datatypes
-                        encoded = encoded.replace("inf", "INF").replace(
-                            "Infinity", "INF"
-                        )
-                    if math.isnan(v):
-                        encoded = encoded.replace("nan", "NaN")
+                    # A special value spelled as Python does, such as "inf",
+                    # "Infinity" (also a Decimal's lexical form) or "nan", is
+                    # written in its XSD form. A numeral that overflows to
+                    # infinity is kept as it is.
+                    if (
+                        (math.isinf(v) or math.isnan(v))
+                        and not _XSD_DOUBLE_LEXICAL.fullmatch(self)
+                        and not any(c.isdigit() for c in self)
+                    ):
+                        encoded = f'"{_float_lexical(v)}"'
                 except ValueError:
                     # if we can't cast to float something is wrong, but we can
                     # still serialize. Warn user about it
@@ -1865,6 +1867,36 @@ def _writeXML(  # noqa: N802
     return s
 
 
+# The lexical space of xsd:double and xsd:float (XML Schema 1.1 Part 2,
+# sections 3.3.4.2 and 3.3.5.2). _literal_n3 also uses it for xsd:decimal,
+# whose lexical space has no special values, to keep valid forms as they are.
+_XSD_DOUBLE_LEXICAL = compile(
+    r"(\+|-)?([0-9]+(\.[0-9]*)?|\.[0-9]+)([Ee](\+|-)?[0-9]+)?|(\+|-)?INF|NaN"
+)
+
+
+def _float_lexical(value: float) -> str:
+    """The lexical form of a float as an `xsd:double` or `xsd:float`.
+
+    The special values are written in their canonical forms, `INF`, `-INF` and
+    `NaN` (XML Schema 1.1 Part 2, appendix E.1, `specialRepCanonicalMap`).
+    Python's `inf` and `nan` are not in the lexical space of these types
+    (sections 3.3.4.2 and 3.3.5.2). Other values keep the form that `str()`
+    gives them.
+
+    Args:
+        value: The float.
+
+    Returns:
+        The lexical form.
+    """
+    if math.isnan(value):
+        return "NaN"
+    if math.isinf(value):
+        return "INF" if value > 0 else "-INF"
+    return str(value)
+
+
 def _unhexlify(value: str | bytes | Literal) -> bytes:
     # In Python 3.2, unhexlify does not support str (only bytes)
     if isinstance(value, str):
@@ -2147,7 +2179,7 @@ def _castPythonToLiteral(  # noqa: N802
     tuple[type[Any], tuple[Callable[[Any], str | bytes] | None, str | None]]
 ] = [
     (str, (None, None)),
-    (float, (None, _XSD_DOUBLE)),
+    (float, (_float_lexical, _XSD_DOUBLE)),
     (bool, (lambda i: str(i).lower(), _XSD_BOOLEAN)),
     (int, (None, _XSD_INTEGER)),
     (long_type, (None, _XSD_INTEGER)),
```

**File**: `test/test_literal/test_special_doubles.py` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+"""
+Infinite and NaN doubles and floats have the lexical forms `INF`, `-INF` and
+`NaN`.
+
+These are the canonical forms of the special values of `xsd:double` and
+`xsd:float` (XML Schema 1.1 Part 2, appendix E.1). A literal took its lexical
+form from Python's `str()` instead, `inf` and `nan`, which are not in the
+lexical space of these types at all. Only Turtle and N3 output corrected that
+(#658). N-Triples, N-Quads, RDF/XML and SPARQL wrote the Python spelling, and
+reading a valid `"INF"^^xsd:double` turned it into `"inf"`.
+"""
+
+from __future__ import annotations
+
+import math
+
+import pytest
+
+from rdflib import XSD, Dataset, Graph, Literal, URIRef, Variable
+
+S = URIRef("http://example.org/s")
+P = URIRef("http://example.org/p")
+
+
+@pytest.mark.parametrize(
+    ("literal", "lexical"),
+    [
+        pytest.param(Literal(math.inf), "INF", id="float-inf"),
+        pytest.param(Literal(-math.inf), "-INF", id="float-minus-inf"),
+        pytest.param(Literal(math.nan), "NaN", id="float-nan"),
+        pytest.param(Literal(-math.nan), "NaN", id="float-minus-nan"),
+        pytest.param(Literal(math.inf, datatype=XSD.float), "INF", id="inf-as-float"),
+        pytest.param(Literal("INF", datatype=XSD.double), "INF", id="typed-INF"),
+        pytest.param(Literal("+INF", datatype=XSD.double), "INF", id="typed-plus-INF"),
+        pytest.param(
+            Literal("-INF", datatype=XSD.double), "-INF", id="typed-minus-INF"
+        ),
+        pytest.param(Literal("NaN", datatype=XSD.double), "NaN", id="typed-NaN"),
+        pytest.param(Literal("INF", datatype=XSD.float), "INF", id="typed-float-INF"),
+        pytest.param(
+            Literal("inf", datatype=XSD.double, normalize=False).normalize(),
+            "INF",
+            id="normalized",
+        ),
+    ],
+)
+def test_a_special_value_has_its_xsd_lexical_form(
+    literal: Literal, lexical: str
+) -> None:
+    assert str(literal) == lexical
+    assert literal == Literal(lexical, datatype=literal.datatype)
+
+
+@pytest.mark.parametrize(
+    "format", ["nt", "nquads", "xml", "pretty-xml", "trix", "hext", "patch"]
+)
+def test_special_values_are_written_in_their_xsd_lexical_forms(format: str) -> None:
+    g = Dataset() if format in ("nquads", "patch") else Graph()
+    for value in (math.inf, -math.inf, math.nan):
+        g.add((S, P, Literal(value)))
+
+    data = g.serialize(format=format)
+
+    for lexical in ("INF", "-INF", "NaN"):
+        assert f'"{lexical}"' in data or f">{lexical}<" in data
+    for python_form in ("inf", "-inf", "nan"):
+        assert f'"{python_form}"' not in data and f">{python_form}<" not in data
+
+
+def test_special_values_round_trip_through_n_triples_unchanged() -> None:
+    data = "".join(
+        f'<{S}> <{P}> "{lexical}"^^<{datatype}> .\n'
+        for lexical in ("INF", "-INF", "NaN")
+        for datatype in (XSD.double, XSD.float)
+    )
+
+    g = Graph().parse(data=data, format="nt")
+
+    assert sorted(g.serialize(format="nt").splitlines()) == sorted(data.splitlines())
+
+
+def test_a_sparql_pattern_with_a_special_value_matches_parsed_data() -> None:
+    g = Graph().parse(
+        data=f'<{S}> <{P}> "INF"^^<{XSD.double}>, "NaN"^^<{XSD.double}> .',
+        format="turtle",
+    )
+    query = 'SELECT ?s { ?s ?p "INF"^^xsd:double , "NaN"^^xsd:double }'
+
+    assert g.query(query, initNs={"xsd": XSD}).bindings == [{Variable("s"): S}]
+
+
+def test_sparql_str_of_a_special_value_is_its_xsd_lexical_form() -> None:
+    query = (
+        'SELECT (STR(xsd:double("INF")) AS ?inf) (STR(xsd:double("NaN")) AS ?nan) {}'
+    )
+
+    (binding,) = Graph().query(query, initNs={"xsd": XSD}).bindings
+
+    assert {str(name): str(value) for name, value in binding.items()} == {
+        "inf": "INF",
+        "nan": "NaN",
+    }
+
+
+@pytest.mark.parametrize(
+    ("literal", "lexical"),
+    [
+        pytest.param(Literal(1.5), "1.5", id="fraction"),
+        pytest.param(Literal(1e-07), "1e-07", id="small"),
+        pytest.param(Literal(-0.0), "-0.0", id="negative-zero"),
+        pytest.param(Literal(1e300), "1e+300", id="large"),
+        pytest.param(
+            Literal("inf", datatype=XSD.double, normalize=False),
+            "inf",
+            id="not-normalized",
+        ),
+        pytest.param(Literal("inf"), "inf", id="plain-string"),
+    ],
+)
+def test_other_lexical_forms_are_unchanged(literal: Literal, lexical: str) -> None:
+    """Guard: finite values, unnormalized literals and strings keep their form."""
+    assert str(literal) == lexical
+
+
+@pytest.mark.parametrize(
+    ("lexical", "written"),
+    [
+        pytest.param("infinity", "INF", id="infinity"),
+        pytest.param("INFINITY", "INF", id="uppercase-infinity"),
+        pytest.param("-Infinity", "-INF", id="minus-infinity"),
+        pytest.param("NAN", "NaN", id="uppercase-nan"),
+        pytest.param("inf", "INF", id="inf"),
+        pytest.param("+INF", "+INF", id="plus-INF-kept"
```

---

### Incident Patch 3: `2af41ffb` (2026-11-18)
**Commit Message**: fix: csv2rdf crashed on -i and rejected --ident, --default, --col<N> and --prop<N> (#3712)

Co-authored-by: Nicholas Car <[REDACTED_EMAIL]>

**File**: `rdflib/tools/csv2rdf.py` (modified, +13/-4)
```diff
@@ -132,7 +132,7 @@ def csv_reader(csv_data, dialect=csv.excel, **kwargs):
 
 def prefixuri(x, prefix, class_: URIRef | None = None):
     if prefix:
-        r = rdflib.URIRef(prefix + quote(x.encode("utf8").replace(" ", "_"), safe=""))
+        r = rdflib.URIRef(prefix + quote(x.replace(" ", "_"), safe=""))
     else:
         r = rdflib.URIRef(x)
     uris[x] = (r, class_)
@@ -377,8 +377,8 @@ def convert(self, csvreader):
                     uri = self.BASE[
                         "_".join(
                             [
-                                # type error: "int" has no attribute "encode"
-                                quote(x.encode("utf8").replace(" ", "_"), safe="")  # type: ignore[attr-defined]
+                                # type error: "int" has no attribute "replace"
+                                quote(x.replace(" ", "_"), safe="")  # type: ignore[attr-defined]
                                 # type error: Argument 2 to "index" has incompatible type "Union[tuple[str, ...], str]"; expected "tuple[int, ...]"
                                 for x in index(l_, self.IDENT)  # type: ignore[arg-type]
                             ]
@@ -457,6 +457,13 @@ def main():
     csv2rdf = CSV2RDF()
 
     opts: Union[dict[str, str], list[tuple[str, str]]]
+    # --col<N> and --prop<N> take a different name per column, so declare the
+    # ones that were actually given
+    column_opts = [
+        m.group(1) + "="
+        for m in (re.match(r"--((?:col|prop)\d+)", str(a)) for a in sys.argv[1:])
+        if m
+    ]
     opts, files = getopt.getopt(
         sys.argv[1:],
         "hc:b:p:i:o:Cf:l:s:d:D:",
@@ -466,11 +473,13 @@ def main():
             "delim=",
             "propbase=",
             "class=",
-            "default=ident=",
+            "default=",
+            "ident=",
             "label=",
             "skip=",
             "defineclass",
             "help",
+            *column_opts,
         ],
     )
     opts = dict(opts)
```

**File**: `test/test_tools/test_csv2rdf.py` (modified, +31/-0)
```diff
@@ -107,3 +107,34 @@ def test_csv2rdf_config_file_opened(self, config_mock):
                 csv2rdf.main()
                 # Check that we've "opened" the right file
                 open_mock.assert_called_once_with(config_file)
+
+
+class TestCSV2RDFOptions:
+    def _run(self, *args: str) -> subprocess.CompletedProcess:
+        return subprocess.run(
+            [sys.executable, "-m", "rdflib.tools.csv2rdf", *args],
+            capture_output=True,
+            text=True,
+        )
+
+    def test_ident_short_option(self):
+        """-i builds instance URIs from the given columns."""
+        completed = self._run("-i", "(0,)", str(REALESTATE_FILE_PATH))
+        assert completed.returncode == 0, completed.stderr
+        assert "<http://example.org/instances/3526_HIGH_ST>" in completed.stdout
+
+    def test_long_options(self):
+        """--ident, --default, --col<N> and --prop<N> are accepted."""
+        completed = self._run(
+            "--ident=(0,)",
+            "--default=ignore",
+            "--col2=int()",
+            "--prop2=http://example.org/props/postcode",
+            str(REALESTATE_FILE_PATH),
+        )
+        assert completed.returncode == 0, completed.stderr
+        assert "<http://example.org/instances/3526_HIGH_ST>" in completed.stdout
+        assert (
+            '<http://example.org/props/postcode> "95838"^^'
+            "<http://www.w3.org/2001/XMLSchema#integer>"
+        ) in completed.stdout
```

#### Recent Merged Pull Requests:
- **PR #3719** (2026-11-18): build(deps-dev): bump zensical from 0.1.0 to 0.1.1 (@dependabot[bot])
- **PR #3718** (2026-11-18): build(deps-dev): bump ruff from 0.17.4 to 0.17.5 (@dependabot[bot])
- **PR #3717** (2026-11-18): build(deps): bump berkeleydb from 18.1.17 to 18.1.18 (@dependabot[bot])
- **PR #3716** (2026-11-17): Support Python 3.15 (@nicholascar)
- **PR #3715** (2026-11-17): fix: keep the label of a TriG blank-node graph name used once as an object (@kushaldave002)
- **PR #3714** (2026-11-18): fix: handle NotImplemented in Literal comparisons for Python 3.14 (@yarrrly)

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

## X. promote numeric types in SPARQL multiplication and division

**RULE**:
When implementing operations in `docs/upgrade7to8.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RDFLib/rdflib. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e775564d`: promote numeric types in SPARQL multiplication and division. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/upgrade7to8.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
## SPARQL multiplication and division

SPARQL `*` and `/` now give the result the promoted type of their operands, as
XPath's `op:numeric-multiply` and `op:numeric-divide` define it and as `+` and
`-` already did:

- An integer times an integer is an `xsd:integer`, and exact for large values.
  It was an `xsd:decimal`, rounded to 28 digits.
- A product or quotient with an `xsd:float` or `xsd:double` operand is a float
  or double, also when that operand comes first, so `toPython()` gives a
  Python `float` where it gave a `Decimal`.
- A float or double divided by zero is `INF`, `-INF` or `NaN` instead of an
  error. Integer and decimal division by zero are still errors.
- An ill-typed operand, such as `"abc"^^xsd:integer`, is an error.

`DATATYPE()`, `sameTerm()`, `DISTINCT` and joins on such computed values change
accordingly.

```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e775564d` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
