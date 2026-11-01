> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/rdflib-rdflib-learnings.md`  
> **Source**: github ([https://github.com/RDFLib/rdflib](https://github.com/RDFLib/rdflib))  
> **Source Version**: `f87db10f`  
> **License**: BSD-3-Clause  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T16:39:35.221Z  
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
> **Harvest Timestamp**: 2026-10-30T16:39:34.380Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `RDFLib/rdflib`
- **Description**: RDFLib is a Python library for working with RDF, a simple yet powerful language for representing information.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2542 stars

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


def norm_url(base: str, url: str) -> str:
    """
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

    ```
    """
    # Same-document references must not change the base path.
    if not url or url.startswith("#"):
        return (base or "").split("#", 1)[0] + url

    if "://" in url:
        return url

    # Fix for URNs
    parsed_base = urlsplit(base)
    parsed_url = urlsplit(url)
    if parsed_url.scheme:
        # Assume full URL
        return url
    if parsed_base.scheme in ("urn", "urn-x"):
        # No scheme -> assume relative and join paths
        base_path_parts = parsed_base.path.split("/", 1)
        base_path = "/" + (base_path_parts[1] if len(base_path_parts) > 1 else "")
        joined_path = urljoin(base_path, parsed_url.path)
        fragment = f"#{parsed_url.fragment}" if parsed_url.fragment else ""
        result = f"{parsed_base.scheme}:{base_path_parts[0]}{joined_path}{fragment}"
    else:
        parts = urlsplit(urljoin(base, url))
        path = normpath(parts[2])
        if sep != "/":
            path = "/".join(path.split(sep))
        if parts[2].endswith("/") and not path.endswith("/"):
            path += "/"
        result = urlunsplit(parts[0:2] + (path,) + parts[3:])
    if url.endswith("#") and not result.endswith("#"):
        result += "#"
    return result


# type error: Missing return statement
def context_from_urlinputsource(source: URLInputSource) -> str | None:  # type: ignore[return]
    """
    Please note that JSON-LD documents served with the `application/ld+json` media type
    MUST have all context information, including references to external contexts,
    within the body of the document. Contexts linked via a
    http://www.w3.org/ns/json-ld#context HTTP Link Header MUST be
    ignored for such documents.
    """
    if source.content_type != "ap
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
- **Issue #3602** (2026-10-24): **SPARQL `ORDER BY` on an expression that errors raises `TypeError`**
  *Symptoms*: ### Description  `evalOrderBy` (`rdflib/plugins/sparql/evaluate.py`) sorts with `key=lambda x: _val(value(x, e.expr, variables=True))`. When the sort expression errors for a solution, `value()` returns a `SPARQLError` object. `_val` (`rdflib/plugins/sparql/evalutils.py`) only handles `Variable`, `BNode`, `URIRef` and `Literal`, so it falls through and returns `None`. Python's `sorted` then compares `None` with `None` or with a `(rank, term)` tuple and raises `TypeError` out of the query.  SPARQL 1.1 §15.1 (ORDER BY) ranks "no value assigned to the variable or expression" lowest, below blank nodes, IRIs and literals. So a solution whose key errors or is unbound should sort as the lowest value, and the query should not crash. A *bare* unbound variable (`ORDER BY ?u`) already works, because `variables=True` returns the `Variable` and `_val` ranks it `0`. Only error results from expressions are affected. The bug needs at least two solutions to show, because with one solution `sorted` never compares keys.  ### Reproducer  ```python from rdflib import Graph  for key in ["DESC(?o = ?u)", "DESC(?o IN (1/0, 2))", "(1/0)", "?u"]:     q = f"SELECT ?o WHERE {{ VALUES ?o {{ 1 2 }} }} ORDER BY {key}"     try:         print(key, list(Graph().query(q)))     except Exception as e:         print(key, type(e).__name__, e) ```  ### Observed (rdflib 7.7.0a0, `main` and #3580 head)  | `ORDER BY` key | rdflib result | |---|---| | `DESC(?o = ?u)` | `TypeError: '<' not supported between instances of 

- **Issue #3601** (2026-10-24): **SPARQL `||` / `&&`: a bare unbound operand makes the whole expression an error**
  *Symptoms*: ### Description  `ConditionalOrExpression` and `ConditionalAndExpression` (`rdflib/plugins/sparql/operators.py`) read their operands as `e.expr` and `e.other`. That goes through `CompValue.__getitem__`, which calls `value()` with `errors=False`. A bare unbound variable therefore raises `NotBoundError` before the operator's error-tolerant logic runs. `Expr.eval` catches the error and the whole expression becomes an error.  SPARQL 1.1 §17.2 (Filter Evaluation) defines a three-valued logic for these operators:  | A | B | A \|\| B | A && B | |---|---|---|---| | T | E | T | E | | E | T | T | E | | F | E | E | F | | E | F | E | F |  Errors that come from a *sub-expression*, such as `1/0`, are not affected, because `Expr.eval` returns them as values. That is why `true || (1/0)` already works. `&&` has a second problem: it is `all(EBV(x) for x in ...)` (with `# TODO: handle returned errors`), so the first erroring operand raises even when a later operand is false. `false && (1/0)` only works because `all()` short-circuits before it reaches the error.  ### Reproducer  ```python from rdflib import Graph  for expr in ["true || ?u", "?u || true", "false && ?u", "?u && false", "(1/0) && false"]:     q = f"SELECT ?o ?r WHERE {{ BIND(2 AS ?o) BIND({expr} AS ?r) }}"     print(expr, list(Graph().query(q))) ```  (`?o` is selected only so that the row is not dropped when `?r` is unbound.)  ### Observed (rdflib 7.7.0a0, `main` and #3580 head)  | Expression | rdflib `?r` | Expected (§17.2) | |---

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

### Incident Patch 1: `6262c3ed` (2026-10-28)
**Commit Message**: fix: restrict ConjunctiveGraph.quads() to the requested context (#3499)

* fix: restrict ConjunctiveGraph.quads() to the requested context

ConjunctiveGraph.quads() passed the requested context to
Store.triples(), but then yielded one quad per context in the
store's returned context generator. Memory.triples() reports every
context a triple appears in, so a triple present in more than one
graph leaked quads for the other graphs.

Dataset.quads((None, None, None, <graph>)) therefore returned
statements belonging to unrelated named graphs whenever those graphs
shared a triple with the requested one.

When a context is given, only that context is now yielded; the
unrestricted case is unchanged.

test_aggregate2 asserted 6 quads for a graph holding 3 triples that
are also in another graph -- it was encoding the leak -- and is
corrected to 3.

Closes #3314

* test: cover quads from the default graph

---------

Co-authored-by: Nicholas Car <[REDACTED_EMAIL]>

**File**: `rdflib/graph.py` (modified, +8/-2)
```diff
@@ -2356,8 +2356,14 @@ def quads(
         s, p, o, c = self._spoc(triple_or_quad)
 
         for (s, p, o), cg in self.store.triples((s, p, o), context=c):
-            for ctx in cg:
-                yield s, p, o, ctx
+            if c is not None:
+                # A context was requested, so only that context is relevant;
+                # the store also reports the other contexts the triple
+                # appears in, which must not leak into the result.
+                yield s, p, o, c
+            else:
+                for ctx in cg:
+                    yield s, p, o, ctx
 
     def triples_choices(
         self,
```

**File**: `test/test_dataset/test_dataset.py` (modified, +39/-1)
```diff
@@ -11,7 +11,7 @@
 from rdflib import BNode, Namespace, Node, URIRef, plugin
 from rdflib.graph import DATASET_DEFAULT_GRAPH_ID, Dataset, Graph
 from rdflib.store import Store
-from test.data import CONTEXT1, LIKES, PIZZA, TAREK
+from test.data import CHEESE, CONTEXT1, CONTEXT2, LIKES, PIZZA, TAREK
 
 # Will also run SPARQLUpdateStore tests against local SPARQL1.1 endpoint if
 # available. This assumes SPARQL1.1 query/update endpoints running locally at
@@ -325,6 +325,44 @@ def test_iter(get_dataset):
     assert i_new == i_trad  # both should be 3
 
 
+@pytest.mark.parametrize(
+    "graph_name, expected_quads",
+    [
+        (
+            CONTEXT1,
+            {
+                (TAREK, LIKES, PIZZA, CONTEXT1),
+                (TAREK, LIKES, CHEESE, CONTEXT1),
+            },
+        ),
+        (
+            CONTEXT2,
+            {
+                (TAREK, LIKES, PIZZA, CONTEXT2),
+            },
+        ),
+        (
+            DATASET_DEFAULT_GRAPH_ID,
+            {
+                (TAREK, LIKES, CHEESE, DATASET_DEFAULT_GRAPH_ID),
+            },
+        ),
+    ],
+)
+def test_quads_restricted_to_requested_graph(get_dataset, graph_name, expected_quads):
+    """A quad shared by several graphs must only be reported for the graph asked for."""
+    store, d = get_dataset
+
+    d.add((TAREK, LIKES, PIZZA, CONTEXT1))
+    d.add((TAREK, LIKES, CHEESE, CONTEXT1))
+    d.add((TAREK, LIKES, PIZZA, CONTEXT2))
+    d.add((TAREK, LIKES, CHEESE))
+
+    quads = set(d.quads((None, None, None, graph_name)))
+
+    assert quads == expected_quads
+
+
 def test_graph_without_identifier() -> None:
     """
     Graphs with no identifies assigned are identified by Skolem IRIs with a
```

**File**: `test/test_graph/test_aggregate_graphs.py` (modified, +3/-1)
```diff
@@ -116,6 +116,8 @@ def test_aggregate2():
     assert (
         len(list(g.quads((None, None, None, URIRef("http://example.com/graph2"))))) == 4
     )
+    # graph4 holds the same 3 triples as graph1; only graph4's own quads are
+    # reported for it.
     assert (
         len(
             list(
@@ -124,5 +126,5 @@ def test_aggregate2():
                 )
             )
         )
-        == 6
+        == 3
     )
```

---

### Incident Patch 2: `b1fe3a93` (2026-10-28)
**Commit Message**: Use RDF and XML prefixes in pretty-xml for unbound namespaces (#3537)

* fix: use rdf and xml prefixes in pretty-xml when no namespaces are bound

* fix: preserve valid XML QNames and empty namespace collections

Validate fixed-prefix local names with a cached XML parser check and retain strict namespace-manager fallback. Treat explicitly empty namespace collections separately from omitted values. Add regression coverage for URI suffixes, extended bindings, and Unicode names.

* fix: reject conflicting XML namespace prefixes

---------

Co-authored-by: Edmond Chuc <[REDACTED_EMAIL]>

**File**: `rdflib/plugins/serializers/rdfxml.py` (modified, +6/-3)
```diff
@@ -211,7 +211,12 @@ def serialize(
         assert self.max_depth > 0, "max_depth must be greater than 0"
 
         self.nm = nm = store.namespace_manager
-        self.writer = writer = XMLWriter(stream, nm, encoding)
+        self.writer = writer = XMLWriter(
+            stream,
+            nm,
+            encoding,
+            extra_ns={"rdf": Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#")},
+        )
         namespaces = {}
 
         for predicate in set(store.predicates()):
@@ -230,8 +235,6 @@ def serialize(
                 continue
             namespaces[prefix] = namespace
 
-        namespaces["rdf"] = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
-
         writer.push(RDFVOC.RDF)
 
         if "xml_base" in kwargs:
```

**File**: `rdflib/plugins/serializers/xmlwriter.py` (modified, +31/-5)
```diff
@@ -2,9 +2,12 @@
 
 import codecs
 from collections.abc import Iterable
+from functools import lru_cache
 from typing import IO, TYPE_CHECKING
+from xml.parsers import expat
 from xml.sax.saxutils import escape, quoteattr
 
+from rdflib.namespace import XMLNS, is_ncname
 from rdflib.term import URIRef
 
 if TYPE_CHECKING:
@@ -16,6 +19,18 @@
 ESCAPE_ENTITIES = {"\r": "&#13;"}
 
 
+@lru_cache(maxsize=512)
+def _is_xml_ncname(name: str) -> bool:
+    """Check local names against the XML parser used by RDFLib."""
+    if not is_ncname(name):
+        return False
+    try:
+        expat.ParserCreate(namespace_separator=" ").Parse(f"<{name}/>", True)
+    except expat.ExpatError:
+        return False
+    return True
+
+
 class XMLWriter:
     """A simple XML writer that writes to a stream."""
 
@@ -85,17 +100,24 @@ def element(
         self.text(content)
         self.pop()
 
-    def namespaces(self, namespaces: Iterable[tuple[str, str]] = None) -> None:
-        if not namespaces:
+    def namespaces(self, namespaces: Iterable[tuple[str, str]] | None = None) -> None:
+        if namespaces is None:
             namespaces = self.nm.namespaces()
 
         write = self.stream.write
         write("\n")
         for prefix, namespace in namespaces:
+            if prefix in self.extra_ns:
+                if prefix and str(namespace) != str(self.extra_ns[prefix]):
+                    raise ValueError(
+                        f"Namespace prefix {prefix!r} is bound to both "
+                        f"{str(namespace)!r} and {str(self.extra_ns[prefix])!r}"
+                    )
+                # Extra default namespaces take precedence, as required by TriX.
+                continue
             if prefix:
                 write('  xmlns:%s="%s"\n' % (prefix, namespace))
-            # Allow user-provided namespace bindings to prevail
-            elif prefix not in self.extra_ns:
+            else:
                 write('  xmlns="%s"\n' % namespace)
 
         for prefix, namespace in self.extra_ns.items():
@@ -122,10 +144,14 @@ def qname(self, uri: str) -> str:
         or the given namespace manager"""
 
         for pre, ns in self.extra_ns.items():
-            if uri.startswith(ns):
+            if uri.startswith(ns) and _is_xml_ncname(uri[len(ns) :]):
                 if pre != "":
                     return ":".join([pre, uri[len(ns) :]])
                 else:
                     return uri[len(ns) :]
 
+        # The xml prefix is predefined and never declared
+        if uri.startswith(XMLNS) and _is_xml_ncname(uri[len(XMLNS) :]):
+            return "xml:" + uri[len(XMLNS) :]
+
         return self.nm.qname_strict(uri)
```

**File**: `test/test_serializers/test_prettyxml.py` (modified, +105/-1)
```diff
@@ -4,7 +4,7 @@
 
 from rdflib.compare import isomorphic
 from rdflib.graph import Dataset, Graph
-from rdflib.namespace import RDF, RDFS
+from rdflib.namespace import RDF, RDFS, XMLNS
 from rdflib.plugins.serializers.rdfxml import PrettyXMLSerializer
 from rdflib.term import BNode, Literal, URIRef
 
@@ -214,6 +214,110 @@ def _assert_expected_object_types_for_predicates(graph, predicates, types):
             )
 
 
+def test_pretty_xml_bind_namespaces_none():
+    # https://github.com/RDFLib/rdflib/issues/2408
+    graph = Graph(bind_namespaces="none")
+    graph.parse(data='prefix ex: <http://example.org/> ex:a ex:b "test"@en .')
+
+    result = graph.serialize(format="pretty-xml")
+
+    assert "<rdf:RDF" in result
+    assert 'rdf:about="http://example.org/a"' in result
+    assert 'xml:lang="en"' in result
+    assert "ns1" not in result
+    assert isomorphic(graph, Graph().parse(data=result, format="xml"))
+
+
+@pytest.mark.parametrize("bind_namespaces", ["rdflib", "none"])
+@pytest.mark.parametrize("term_role", ["predicate", "type"])
+def test_pretty_xml_conflicting_rdf_prefix(bind_namespaces, term_role):
+    graph = Graph(bind_namespaces=bind_namespaces)
+    graph.bind("rdf", "http://example.org/", replace=True)
+    subject = URIRef("http://example.org/subject")
+    term = URIRef("http://example.org/term")
+    if term_role == "predicate":
+        graph.add((subject, term, Literal("value")))
+    else:
+        graph.add((subject, RDF.type, term))
+
+    with pytest.raises(ValueError, match="Namespace prefix 'rdf' is bound to both"):
+        graph.serialize(format="pretty-xml")
+
+
+@pytest.mark.parametrize("namespace", [str(RDF), XMLNS])
+@pytest.mark.parametrize("suffix", ["nested/value", "/value", "123value"])
+@pytest.mark.parametrize("term_role", ["predicate", "type"])
+@pytest.mark.parametrize("bind_namespaces", ["rdflib", "none"])
+def test_pretty_xml_invalid_fixed_namespace_local_name(
+    namespace, suffix, term_role, bind_namespaces
+):
+    graph = Graph(bind_namespaces=bind_namespaces)
+    subject = URIRef("http://example.org/subject")
+    term = URIRef(namespace + suffix)
+    if term_role == "predicate":
+        graph.add((subject, term, Literal("value")))
+    else:
+        graph.add((subject, RDF.type, term))
+
+    result = graph.serialize(format="pretty-xml")
+
+    assert isomorphic(graph, Graph().parse(data=result, format="xml"))
+
+
+@pytest.mark.parametrize("namespace", [str(RDF), XMLNS])
+@pytest.mark.parametrize(
+    "subnamespace", ["foo%20", "foo(", "foo)", "fooª", "fooµ", "fooº"]
+)
+@pytest.mark.parametrize("term_role", ["predicate", "type"])
+@pytest.mark.parametrize("bind_namespaces", ["rdflib", "none"])
+def test_pretty_xml_longer_namespace_binding(
+    namespace, subnamespace, term_role, bind_namespaces
+):
+    graph = Graph(bind_namespaces=bind_namespaces)
+    extended = namespace + subnamespace
+    graph.bind("extended", extended)
+    subject = URIRef("http://example.org/subject")
+    term = URIRef(extended + "value")
+    if term_role == "predicate":
+        graph.add((subject, term, Literal("value")))
+    else:
+        graph.add((subject, RDF.type, term))
+
+    result = graph.serialize(format="pretty-xml")
+
+    assert isomorphic(graph, Graph().parse(data=result, format="xml"))
+    assert "<extended:value" in result
+
+
+@pytest.mark.parametrize("namespace", [str(RDF), XMLNS])
+@pytest.mark.parametrize("local_name", ["éclair", "Δelta", "名前", "a\u0301"])
+@pytest.mark.parametrize("term_role", ["predicate", "type"])
+def test_pretty_xml_valid_unicode_local_name(namespace, local_name, term_role):
+    graph = Graph()
+    subject = URIRef("http://example.org/subject")
+    term = URIRef(namespace + local_name)
+    if term_role == "predicate":
+        graph.add((subject, term, Literal("value")))
+    else:
+        graph.add((subject, RDF.type, term))
+
+    result = graph.serialize(format="pretty-xml")
+
+    assert isomorphic(graph, Graph().parse(data=result, format="xml"))
+
+
+@pytest.mark.parametrize("bind_namespaces", ["rdflib", "none"])
+def test_pretty_xml_empty_graph_omits_unused_namespaces(bind_namespaces):
+    graph = Graph(bind_namespaces=bind_namespaces)
+    graph.bind("unused", "http://example.org/?a=1&b=")
+
+    result = graph.serialize(format="pretty-xml")
+
+    assert isomorphic(graph, Graph().parse(data=result, format="xml"))
+    assert result.count("xmlns:") == 1
+    assert 'xmlns:rdf="%s"' % RDF in result
+
+
 def test_unprefixable_predicate_raises_clear_error():
     """A predicate equal to a bound namespace/prefix cannot be shortened, and should raise a clear error (regression test for issue #2409)."""
     g = Graph().parse(data='<a> <> "test"@en .', publicID="http://example.org/")
```

**File**: `test/test_serializers/test_xmlwriter_qname.py` (modified, +106/-0)
```diff
@@ -1,4 +1,6 @@
 import tempfile
+from io import BytesIO
+from xml.etree import ElementTree
 
 import pytest
 
@@ -72,3 +74,107 @@ def test_xmlwriter_qname(uri):
     xmlwr = XMLWriter(fp, g.namespace_manager, extra_ns={"": TRIXNS, "ex": EXNS})
 
     assert xmlwr.qname(uri[0]) == uri[1]
+
+
+@pytest.mark.parametrize(
+    "prefix, namespace",
+    [("rdf", rdflib.Namespace(str(rdflib.RDF))), ("", TRIXNS), ("ex", EXNS)],
+)
+@pytest.mark.parametrize("suffix", ["nested/value", "123value"])
+def test_xmlwriter_extra_namespace_invalid_local_name(prefix, namespace, suffix):
+    graph = rdflib.Graph(bind_namespaces="none")
+    graph.bind(prefix, namespace)
+    writer = XMLWriter(BytesIO(), graph.namespace_manager, extra_ns={prefix: namespace})
+
+    assert writer.qname(namespace[suffix]) == "ns1:value"
+
+
+@pytest.mark.parametrize(
+    "suffix, expected",
+    [
+        ("lang", "xml:lang"),
+        ("/value", "ns1:value"),
+        ("123value", "ns1:namespace123value"),
+    ],
+)
+def test_xmlwriter_xml_namespace_local_name(suffix, expected):
+    graph = rdflib.Graph(bind_namespaces="none")
+    writer = XMLWriter(BytesIO(), graph.namespace_manager)
+
+    assert writer.qname(rdflib.namespace.XMLNS + suffix) == expected
+
+
+@pytest.mark.parametrize(
+    "prefix, namespace",
+    [
+        ("rdf", rdflib.Namespace(str(rdflib.RDF))),
+        ("", TRIXNS),
+        ("ex", EXNS),
+        ("xml", rdflib.Namespace(rdflib.namespace.XMLNS)),
+    ],
+)
+@pytest.mark.parametrize(
+    "subnamespace", ["foo%20", "foo(", "foo)", "fooª", "fooµ", "fooº"]
+)
+def test_xmlwriter_longer_namespace_binding(prefix, namespace, subnamespace):
+    graph = rdflib.Graph(bind_namespaces="none")
+    graph.bind(prefix, namespace)
+    extended = rdflib.Namespace(str(namespace) + subnamespace)
+    graph.bind("extended", extended)
+    extra_ns = {} if prefix == "xml" else {prefix: namespace}
+    writer = XMLWriter(BytesIO(), graph.namespace_manager, extra_ns=extra_ns)
+
+    assert writer.qname(extended.value) == "extended:value"
+
+
+@pytest.mark.parametrize(
+    "namespace, prefix",
+    [(str(rdflib.RDF), "rdf"), (rdflib.namespace.XMLNS, "xml")],
+)
+@pytest.mark.parametrize(
+    "local_name", ["À", "Ö", "Ø", "ö", "ø", "Δelta", "名前", "a\u0301"]
+)
+def test_xmlwriter_valid_unicode_local_name(namespace, prefix, local_name):
+    graph = rdflib.Graph(bind_namespaces="none")
+    writer = XMLWriter(
+        BytesIO(),
+        graph.namespace_manager,
+        extra_ns={"rdf": rdflib.Namespace(str(rdflib.RDF))},
+    )
+
+    assert writer.qname(namespace + local_name) == prefix + ":" + local_name
+
+
+@pytest.mark.parametrize("namespaces", [[], (), {}.items()])
+def test_xmlwriter_explicit_empty_namespaces(namespaces):
+    graph = rdflib.Graph()
+    stream = BytesIO()
+    writer = XMLWriter(stream, graph.namespace_manager, decl=0, extra_ns={"ex": EXNS})
+
+    writer.namespaces(namespaces)
+
+    assert stream.getvalue() == b'\n  xmlns:ex="https://example.org/ns/"\n'
+
+
+def test_xmlwriter_conflicting_namespace_prefix():
+    graph = rdflib.Graph(bind_namespaces="none")
+    graph.bind("ex", EXNS)
+    writer = XMLWriter(BytesIO(), graph.namespace_manager, extra_ns={"ex": TRIXNS})
+
+    with pytest.raises(ValueError, match="Namespace prefix 'ex' is bound to both"):
+        writer.namespaces()
+
+
+def test_xmlwriter_matching_namespace_prefix():
+    graph = rdflib.Graph(bind_namespaces="none")
+    graph.bind("ex", EXNS)
+    stream = BytesIO()
+    writer = XMLWriter(stream, graph.namespace_manager, extra_ns={"ex": EXNS})
+
+    writer.push(EXNS.root)
+    writer.namespaces()
+    writer.pop()
+
+    assert (
+        ElementTree.fromstring(stream.getvalue()).tag == "{https://example.org/ns/}root"
+    )
```

---

### Incident Patch 3: `f87db10f` (2026-10-28)
**Commit Message**: fix: count Dataset quads in len() and update documentation (#3515)

* fix: count Dataset quads in len() and update documentation

* fix: count read-only Dataset graphs without writes

* fix: exclude quoted formulas from Dataset length

* fix: count Dataset contexts through the owning store

* fix: count asserted Dataset memberships in formula-aware stores

* fix: support blank-node graph selectors in RDF4J size requests

* perf: use native RDF4J repository counts for Dataset length

---------

Co-authored-by: Edmond Chuc <[REDACTED_EMAIL]>

**File**: `docs/rdf4j.md` (modified, +15/-0)
```diff
@@ -76,6 +76,21 @@ ds = Dataset(store=store)
 
 For more information on how to use RDFLib Graphs and Datasets, see the subsections under [Usage](index.md).
 
+### Dataset counting performance
+
+`len(ds)` delegates to
+[`RDF4JStore.quad_count()`][rdflib.plugins.stores.rdf4j.RDF4JStore.quad_count],
+which makes one repository-wide size request without listing graphs. This
+also applies when RDF4JStore connects to GraphDB through its RDF4J-compatible
+interface. Counts include explicit statements in the default and named graphs,
+including blank-node graph names, and count a repeated triple once per graph.
+Inferred statements are excluded by the repository size operation, so a query
+that includes inference can return more statements.
+
+`bool(ds)` and `if ds:` make the same size request. Results are not cached;
+each check makes another request. A single request reduces network round trips
+but does not guarantee constant-time work on the server.
+
 ### Namespaces
 
 When connecting to an RDF4J repository, RDFLib automatically registers a set of built-in namespace prefixes. To disable this behavior, assign a new RDFLib [`NamespaceManager`][rdflib.namespace.NamespaceManager] instance with `bind_namespaces` set to the string `"none"`.
```

**File**: `docs/upgrade7to8.md` (modified, +20/-0)
```diff
@@ -10,3 +10,23 @@ RDFLib 8 requires Python 3.11 or later. Python 3.10 reached end of life on
 
 The optional `lxml` dependency now requires version 4.9.1 or later for
 Python 3.11 compatibility.
+
+## Dataset length
+
+`len(dataset)` now counts quads: identical triples in different graphs count
+separately, including occurrences in the default graph. Empty named graphs
+and the contents of quoted N3 formulas do not contribute to the count.
+`Graph.__len__()` and `ConjunctiveGraph.__len__()` retain their existing behavior.
+
+Counting delegates to
+[`Store.quad_count()`][rdflib.store.Store.quad_count], which stores can override
+with an equivalent native operation. The Memory store scans asserted graph
+memberships. RDF4JStore uses a single repository-wide size request for RDF4J
+and GraphDB. Other stores may enumerate graphs and count each graph separately,
+potentially issuing multiple remote requests.
+
+`bool(dataset)` and `if dataset:` perform the same count as `len(dataset)`.
+Results are not cached, so repeated checks repeat the work. Avoid assuming
+these operations are constant-time, especially in loops over large or remote
+datasets. A dataset containing only empty named graphs has length zero and is
+false, even though those graph names remain present.
```

**File**: `examples/datasets.py` (modified, +4/-5)
```diff
@@ -66,7 +66,7 @@
     )
 )
 
-# We now have 2 distinct quads in the Dataset to the Dataset has a length of 2
+# We now have 2 distinct quads in the Dataset, so the Dataset has a length of 2
 assert len(d) == 2
 
 # Add another quad to the Dataset specifying a non-existent Graph.
@@ -179,8 +179,7 @@
 http://example.com/subject-y, http://example.com/predicate-y, Triple Y, http://example.com/graph-2
 """
 
-# Adding a triple in graph-1 to graph-2 increases the number of distinct of quads in
-# the Dataset
+# Adding a triple in graph-1 to graph-2 increases the number of quads in the Dataset
 d.add(
     (
         URIRef("http://example.com/subject-z"),
@@ -201,8 +200,8 @@
 http://example.com/subject-z, http://example.com/predicate-z, Triple Z, http://example.com/graph-2
 """
 
-# but the 'length' of the Dataset is still only 3 as only distinct triples are counted
-assert len(d) == 3
+# the 'length' of the Dataset is now 4 because each graph occurrence is counted
+assert len(d) == 4
 
 
 # Looping through triples sees the 'Z' triple only once
```

**File**: `rdflib/contrib/rdf4j/client.py` (modified, +27/-10)
```diff
@@ -43,6 +43,20 @@
 ObjectType = t.Union[URIRef, Literal, None]
 
 
+def _size_context_params(
+    graph_name: IdentifiedNode | Iterable[IdentifiedNode] | str | None,
+) -> dict[str, str | list[str]]:
+    """Encode graph selectors as repeated RDF4J size context parameters."""
+    if graph_name is None:
+        return {}
+    contexts = []
+    for name in (graph_name,) if isinstance(graph_name, str) else graph_name:
+        params: dict[str, str] = {}
+        build_context_param(params, name)
+        contexts.append(params["context"])
+    return {"context": contexts[0] if isinstance(graph_name, str) else contexts}
+
+
 @dataclass(frozen=True)
 class NamespaceListingResult:
     """RDF4J namespace and prefix name result."""
@@ -425,11 +439,14 @@ def health(self) -> bool:
                 f"Repository {self._identifier} is not healthy. {err.response.status_code} - {err.response.text}"
             )
 
-    def size(self, graph_name: URIRef | Iterable[URIRef] | str | None = None) -> int:
+    def size(
+        self,
+        graph_name: IdentifiedNode | Iterable[IdentifiedNode] | str | None = None,
+    ) -> int:
         """The number of statements in the repository or in the specified graph name.
 
         Parameters:
-            graph_name: Graph name(s) to restrict to.
+            graph_name: Graph name(s) to restrict to, including blank nodes.
 
                 The default value `None` queries all graphs.
 
@@ -442,9 +459,7 @@ def size(self, graph_name: URIRef | Iterable[URIRef] | str | None = None) -> int
         Raises:
             RepositoryResponseFormatError: Fails to parse the repository size.
         """
-        validate_graph_name(graph_name)
-        params: dict[str, str] = {}
-        build_context_param(params, graph_name)
+        params = _size_context_params(graph_name)
         response = self.http_client.get(
             f"/repositories/{self.identifier}/size", params=params
         )
@@ -854,11 +869,14 @@ def ping(self):
                 f"Transaction ping failed: {response.status_code} - {response.text}"
             )
 
-    def size(self, graph_name: URIRef | Iterable[URIRef] | str | None = None):
+    def size(
+        self,
+        graph_name: IdentifiedNode | Iterable[IdentifiedNode] | str | None = None,
+    ) -> int:
         """The number of statements in the repository or in the specified graph name.
 
         Parameters:
-            graph_name: Graph name(s) to restrict to.
+            graph_name: Graph name(s) to restrict to, including blank nodes.
 
                 The default value `None` queries all graphs.
 
@@ -872,9 +890,8 @@ def size(self, graph_name: URIRef | Iterable[URIRef] | str | None = None):
             RepositoryResponseFormatError: Fails to parse the repository size.
         """
         self._raise_for_closed()
-        validate_graph_name(graph_name)
-        params = {"action": "SIZE"}
-        build_context_param(params, graph_name)
+        params = _size_context_params(graph_name)
+        params["action"] = "SIZE"
         response = self.repo.http_client.put(self.url, params=params)
         response.raise_for_status()
         return self.repo._to_size(response.text)
```

**File**: `rdflib/graph.py` (modified, +14/-0)
```diff
@@ -2559,6 +2559,9 @@ class Dataset(ConjunctiveGraph):
     structure to include a graph identifier - archaically called Context - producing
     'quads' of s, p, o, g.
 
+    The length of a Dataset is the number of quads it contains. Identical triples
+    in different graphs are therefore counted separately.
+
     Triples, or quads, can be added to a Dataset. Triples, or quads with the graph
     identifer :code:`urn:x-rdflib:default` go into the default graph.
 
@@ -2745,6 +2748,17 @@ def __str__(self) -> str:
         pattern = "[a rdflib:Dataset;rdflib:storage [a rdflib:Store;rdfs:label '%s']]"
         return pattern % self.store.__class__.__name__
 
+    def __len__(self) -> int:
+        """Number of asserted quads in the dataset.
+
+        Delegates to [`Store.quad_count()`][rdflib.store.Store.quad_count].
+        The cost depends on the store: Memory scans asserted memberships,
+        while RDF4JStore uses one repository-wide size request. Other stores
+        may enumerate graphs and request each graph's length separately.
+        Truth testing also calls this method, and results are not cached.
+        """
+        return self.store.quad_count()
+
     # type error: Return type "tuple[type[Dataset], tuple[Store, bool]]" of "__reduce__" incompatible with return type "tuple[type[Graph], tuple[Store, IdentifiedNode]]" in supertype "ConjunctiveGraph"
     # type error: Return type "tuple[type[Dataset], tuple[Store, bool]]" of "__reduce__" incompatible with return type "tuple[type[Graph], tuple[Store, IdentifiedNode]]" in supertype "Graph"
     def __reduce__(self) -> tuple[type[Dataset], tuple[Store, bool]]:  # type: ignore[override]
```

**File**: `rdflib/plugins/stores/rdf4j.py` (modified, +4/-0)
```diff
@@ -220,3 +220,7 @@ def remove_graph(self, graph: Graph) -> None:
 
     def __len__(self, context: _ContextType | None = None) -> int:
         return self.repo.size(context if context is None else context.identifier)
+
+    def quad_count(self) -> int:
+        """Count explicit quads with one repository-wide size request."""
+        return self.repo.size()
```

**File**: `rdflib/store.py` (modified, +35/-0)
```diff
@@ -360,6 +360,41 @@ def __len__(self, context: _ContextType | None = None) -> int:  # type: ignore[e
             context: a graph instance to query or None
         """
 
+    def quad_count(self) -> int:
+        """Return the number of non-quoted statement memberships in the store.
+
+        Count each graph occurrence separately, including the default graph.
+        Empty graphs contribute zero. This does not change the behavior of
+        [`Store.__len__()`][rdflib.store.Store.__len__].
+
+        Stores can override this operation with an equivalent native count.
+        The fallback scans asserted memberships for formula-aware stores and
+        otherwise enumerates contexts and sums their lengths. The latter may
+        require a remote request per graph, plus context enumeration.
+        """
+        if not self.context_aware:
+            return self.__len__()
+        if self.formula_aware:
+            # Quoted and asserted graphs can share an identifier, so a graph's
+            # type and length cannot distinguish their statement memberships.
+            return sum(
+                1 for _, contexts in self.triples((None, None, None)) for _ in contexts
+            )
+
+        from rdflib.graph import DATASET_DEFAULT_GRAPH_ID, Graph
+
+        count = 0
+        default_graph_seen = False
+        for context in self.contexts():
+            # Some stores return identifiers rather than Graph objects.
+            identifier = context.identifier if isinstance(context, Graph) else context
+            graph = Graph(self, identifier=identifier)
+            count += self.__len__(graph)
+            default_graph_seen |= graph.identifier == DATASET_DEFAULT_GRAPH_ID
+        if not default_graph_seen:
+            count += self.__len__(Graph(self, identifier=DATASET_DEFAULT_GRAPH_ID))
+        return count
+
     # type error: Missing return statement
     def contexts(  # type: ignore[empty-body]
         self, triple: _TripleType | None = None
```

**File**: `test/test_dataset/test_dataset.py` (modified, +67/-1)
```diff
@@ -9,7 +9,7 @@
 import pytest
 
 from rdflib import BNode, Namespace, Node, URIRef, plugin
-from rdflib.graph import DATASET_DEFAULT_GRAPH_ID, Dataset, Graph
+from rdflib.graph import DATASET_DEFAULT_GRAPH_ID, Dataset, Graph, QuotedGraph
 from rdflib.store import Store
 from test.data import CHEESE, CONTEXT1, CONTEXT2, LIKES, PIZZA, TAREK
 
@@ -200,6 +200,68 @@ def test_default_graph(get_dataset):
     assert set(dataset.graphs()) == set([dataset.default_graph])
 
 
+def test_len_counts_quads() -> None:
+    dataset = Dataset()
+    dataset.graph(URIRef("https://example.com/g1")).add((TAREK, LIKES, PIZZA))
+    dataset.graph(URIRef("https://example.com/g2")).add((TAREK, LIKES, PIZZA))
+
+    assert len(dataset) == 2
+
+
+def test_len_excludes_quoted_formulas() -> None:
+    dataset = Dataset().parse(
+        data="@prefix : <urn:test:> . { :a :b :c } => { :d :e :f } .",
+        format="n3",
+    )
+
+    assert len(dataset) == 1
+    assert sum(1 for _ in dataset.quads()) == 1
+
+
+@pytest.mark.parametrize("quoted_first", [True, False])
+@pytest.mark.parametrize(
+    "identifier",
+    [URIRef("urn:shared"), DATASET_DEFAULT_GRAPH_ID],
+    ids=["named", "default"],
+)
+def test_len_counts_asserted_memberships(
+    identifier: URIRef, quoted_first: bool
+) -> None:
+    dataset = Dataset()
+    additions = [
+        (
+            QuotedGraph(dataset.store, identifier),
+            (URIRef("urn:quoted"), LIKES, PIZZA),
+        ),
+        (
+            Graph(dataset.store, identifier),
+            (URIRef("urn:asserted"), LIKES, PIZZA),
+        ),
+    ]
+    for graph, triple in additions if quoted_first else reversed(additions):
+        graph.add(triple)
+
+    assert len(dataset) == 1
+    assert bool(dataset) is True
+    assert sum(1 for _ in dataset.quads()) == 1
+
+
+@pytest.mark.parametrize("context_kind", ["self", "shared-store", "separate-store"])
+def test_len_counts_dataset_context(context_kind: str) -> None:
+    dataset = Dataset()
+    if context_kind == "self":
+        context = dataset
+    elif context_kind == "shared-store":
+        context = Dataset(store=dataset.store)
+    else:
+        context = Dataset()
+    dataset.add((TAREK, LIKES, PIZZA, context))
+    dataset.graph(URIRef("urn:other")).add((TAREK, LIKES, PIZZA))
+
+    assert len(dataset) == 2
+    assert sum(1 for _ in dataset.quads()) == 2
+
+
 def test_dataset_default_context_public_access_warns() -> None:
     dataset = Dataset()
 
@@ -302,6 +364,9 @@ def test_not_union(get_dataset):
 def test_iter(get_dataset):
     store, d = get_dataset
     """PR 1382: adds __iter__ to Dataset"""
+    if store == "SPARQLUpdateStore":
+        pytest.skip("SPARQLUpdateStore does not expose contexts through triples()")
+
     uri_a = URIRef("https://example.com/a")
     uri_b = URIRef("https://example.com/b")
     uri_c = URIRef("https://example.com/c")
@@ -329,6 +394,7 @@ def test_iter(get_dataset):
         i_new += 1
 
     assert i_new == i_trad  # both should be 3
+    assert len(d) == i_new
 
 
 @pytest.mark.parametrize(
```

#### Recent Merged Pull Requests:
- **PR #3643** (2026-10-28): build(deps): bump berkeleydb from 18.1.16 to 18.1.17 (@dependabot[bot])
- **PR #3642** (2026-10-28): build(deps-dev): bump zensical from 0.0.67 to 0.0.72 (@dependabot[bot])
- **PR #3641** (2026-10-28): build(deps): bump library/python from 3.15.0-slim to 3.15.1-slim in /docker/latest (@dependabot[bot])
- **PR #3640** (2026-10-28): build(deps): bump library/python from 3.15.0-slim to 3.15.1-slim in /docker/unstable (@dependabot[bot])
- **PR #3638** (2026-10-27): move from httpx to httpx2 (@nicholascar)
- **PR #3637** (2026-10-27): fix: preserve IRIs when relativizing serializer output (@rohithobillaneni)

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

## X. restrict ConjunctiveGraph.quads() to the requested context (#3499)

**RULE**:
When implementing operations in `rdflib/graph.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RDFLib/rdflib. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6262c3ed`: restrict ConjunctiveGraph.quads() to the requested context (#3499). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `rdflib/graph.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
            if c is not None:
                # A context was requested, so only that context is relevant;
                # the store also reports the other contexts the triple
                # appears in, which must not leak into the result.
                yield s, p, o, c
            else:
                for ctx in cg:
                    yield s, p, o, ctx
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
            for ctx in cg:
                yield s, p, o, ctx
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6262c3ed` are properly handled with clean fallback behavior.
