# Forensic Learning Record (Deep Inspection): vitali87/code-graph-rag

> **Canonical Artifact**: `07_PROJECT_LEARNING/vitali87-code-graph-rag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vitali87/code-graph-rag](https://github.com/vitali87/code-graph-rag))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:26:48.765Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vitali87/code-graph-rag`
- **Description**: The ultimate RAG for your monorepo. Query, understand, and edit multi-language codebases with the power of AI and knowledge graphs
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5232 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `codebase_rag/cgr_state.py`
```
from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import TypedDict

from loguru import logger

from .config import settings

STATE_FILENAME = "state.json"


class _StateShape(TypedDict, total=False):
    last_sync: dict[str, str]


def state_path(home: Path | None = None) -> Path:
    base = (home or settings.CGR_HOME).expanduser()
    return base / STATE_FILENAME


def _load(path: Path) -> _StateShape:
    if not path.exists():
        return _StateShape()
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return _StateShape(last_sync=data.get("last_sync", {}))
    except (OSError, json.JSONDecodeError) as e:
        logger.warning(f"Failed to load cgr state from {path}: {e}")
    return _StateShape()


def _save(path: Path, data: _StateShape) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except OSError as e:
        logger.warning(f"Failed to save cgr state to {path}: {e}")


def record_sync(project_name: str, home: Path | None = None) -> None:
    path = state_path(home)
    state = _load(path)
    last_sync = state.get("last_sync", {})
    last_sync[project_name] = datetime.now(UTC).isoformat()
    state["last_sync"] = last_sync
    _save(path, state)


def read_sync_timestamps(home: Path | None = None) -> dict[str, str]:
    state = _load(state_path(home))
    return dict(state.get("last_sync", {}))

```

### Core Architecture Module: `codebase_rag/constants/core.py`
```
# Cross-cutting kernel constants: separators, chars, paths, misc keys.

from enum import StrEnum

INIT_PY = "__init__.py"
INIT_PYI = "__init__.pyi"
# The files that name their PACKAGE rather than themselves: a stub-only
# package ships `__init__.pyi` in place of `__init__.py` (issue #2445).
PY_PACKAGE_INIT_FILES: tuple[str, ...] = (INIT_PY, INIT_PYI)

ENCODING_UTF8 = "utf-8"
ENCODING_UTF8_SIG = "utf-8-sig"
ENCODING_ASCII = "ascii"
# Codec names (as `codecs.lookup` normalises them) whose bytes the grammar
# already reads as they are, so a source declaring one needs no transcoding.
UTF8_CODEC_NAMES: frozenset[str] = frozenset({ENCODING_UTF8, ENCODING_UTF8_SIG})
# PEP 263's declaration pattern, over bytes: the declaration is ASCII by
# definition, and matching bytes lets a line that is not valid UTF-8 still be
# searched. Only line 1, or line 2 under a blank or comment-only line 1, is
# read, which is where CPython's tokenizer looks.
PY_CODING_COOKIE_PATTERN = rb"^[ \t\f]*#.*?coding[:=][ \t]*([-\w.]+)"
PY_CODING_BLANK_LINE_PATTERN = rb"^[ \t\f]*(?:[#\r\n]|$)"
# Every 7-bit byte. PEP 263 admits only encodings that read these as ASCII: a
# declaration is itself ASCII, so an encoding that reads it differently (UTF-16,
# EBCDIC) cannot have been what the author meant, and CPython rejects the file.
ASCII_BYTES = bytes(range(128))
# Longest UTF-8 sequence, so a window this size either side of a name spans
# any single character that could legitimately sit next to it.
UTF8_MAX_SEQUENCE_BYTES = 4
# Sigils an ingestor prepends to a synthesized symbol name (a C# destructor
# is stored as `~Greeter` while the source leaf is `Greeter`).
SYNTHETIC_NAME_PREFIXES = "~"
# What `errors="replace"` substitutes for an undecodable byte. Its presence
# in an extracted symbol name means the name is damaged.
UNICODE_REPLACEMENT_CHAR = "\ufffd"

ARG_TARGET_CODE = "target_code"
ARG_REPLACEMENT_CODE = "replacement_code"
ARG_FILE_PATH = "file_path"
ARG_CONTENT = "content"
ARG_COMMAND = "command"
ARG_PATTERN = "pattern"
ARG_REWRITE = "rewrite"
ARG_LANGUAGE = "language"
ARG_DRY_RUN = "dry_run"

SEPARATOR_DOT = "."
SEPARATOR_SLASH = "/"
# Splits "provider:model" both in user-supplied settings and in the model
# names pydantic-ai enumerates.
MODEL_STRING_SEPARATOR = ":"
# `derive_project_name` builds "<name>__<8-hex-digest>", so this marker is
# what distinguishes a project-qualified name from free text that merely
# contains dots (a docstring, a file path).
PROJECT_NAME_DIGEST_MARKER = "__"
# Hex digits after the marker. Shared so `derive_project_name` and the
# scoping filter that recognises its output cannot drift apart.
PROJECT_NAME_DIGEST_LEN = 8
# Qualified names are `<project>.<package path>.<module>.<symbol>` and nodes
# merge on them, so a `.` in a project name aliases another project's package
# (issue #2412).
ERR_PROJECT_NAME_HAS_SEPARATOR = (
    "Project name '{name}' contains '.', which separates the parts of a "
    "qualified name: its nodes would merge with those of a package at the "
    "same path in another project. Use a name without '.', e.g. '{suggestion}'."
)
# Disambiguates definitions that share one qualified name (if/else import
# fallbacks, typing.overload, try/except fallbacks): "<qn>@<start_line>".
DUP_QN_MARKER = "@"
# Joined after the line when a same-named definition already holds that line,
# so same-line twins stay distinct (issue #1071). Every consumer splits on
# DUP_QN_MARKER and keeps the base, so nothing reads the suffix back.
DUP_QN_COLUMN_MARKER = "_"

PATH_CURRENT_DIR = "."
PATH_PARENT_DIR = ".."
GLOB_ALL = "*"

TRIE_TYPE_KEY = "__type__"
TRIE_QN_KEY = "__qn__"
TRIE_INTERNAL_PREFIX = "__"

BYTES_PER_MB = 1024 * 1024

EMPTY_PARENS = "()"
DOCSTRING_STRIP_CHARS = "'\" \n"

INLINE_MODULE_PATH_PREFIX = "inline_module_"

# Method name constants for getattr/hasattr
METHOD_FIND_WITH_PREFIX = "find_with_prefix"
METHOD_ITEMS = "items"

JSON_INDENT = 2


class EventType(StrEnum):
    MODIFIED = "modified"
    CREATED = "created"
    DELETED = "deleted"
    MOVED = "moved"
    CLOSED = "closed"


# `opened` and `closed_no_write` are reads, and `closed` only ends a write
# whose `modified` normally came first, so none of them is re-ingested alone.
CONTENT_EVENT_TYPES = frozenset(
    {EventType.MODIFIED, EventType.CREATED, EventType.DELETED}
)


REALTIME_LOGGER_FORMAT = (
    "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
    "<level>{level: <8}</level> | "
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
    "<level>{message}</level>"
)

WATCHER_SLEEP_INTERVAL = 1
LOG_LEVEL_INFO = "INFO"
LOG_LEVEL_ERROR = "ERROR"
ENV_LOGURU_LEVEL = "LOGURU_LEVEL"
LOGURU_DEFAULT_HANDLER_ID = 0

# Debounce settings for realtime watcher
DEFAULT_DEBOUNCE_SECONDS = 5
DEFAULT_MAX_WAIT_SECONDS = 30

CHAR_HYPHEN = "-"
CHAR_UNDERSCORE = "_"
CHAR_EQUALS = "="

CHAR_SEMICOLON = ";"
CHAR_COMMA = ","
CHAR_COLON = ":"
CHAR_ANGLE_OPEN = "<"
CHAR_ANGLE_CLOSE = ">"
CHAR_EQUALS = "="
CHAR_PAREN_OPEN = "("
CHAR_PAREN_CLOSE = ")"
CHAR_QUESTION_MARK = "?"

CHAR_SPACE = " "
SEPARATOR_COMMA_SPACE = ", "
SEPARATOR_SEMICOLON_SPACE = "; "
PUNCTUATION_TYPES = (CHAR_PAREN_OPEN, CHAR_PAREN_CLOSE, CHAR_COMMA)

REGEX_METHOD_CHAIN_SUFFIX = r"\)\.[^)]*$"
# Receiver chains longer than this many hops stay unresolved. Every call in a
# chain re-reads its whole receiver, so resolving an n-hop chain cost O(n^2):
# a 20 KB file of `.m()` hops took minutes and gigabytes (#2262). Hand-written
# fluent chains are far shorter.
MAX_RECEIVER_CHAIN_HOPS = 64
REGEX_FINAL_METHOD_CAPTURE = r"\.([^.()]+)$"

DEFAULT_NAME = "Unknown"
TEXT_UNKNOWN = "unknown"

TMP_EXTENSION = ".tmp"

# Filenames whose module IS their directory, PER LANGUAGE: an importer writes
# the directory name, never the file's own stem. The extension is part of the
# rule, not decoration -- `index.py` and `mod.py` are ordinary Python modules
# imported by those names, and a language-blind stem set silently gives them no
# importable name at all. `lib.rs`/`main.rs` are crate roots named by the
# manifest rather than the directory, so they are deliberately absent.
DIRECTORY_MODULE_STEM_BY_EXT: dict[str, str] = {
    ".py": "__init__",
    ".pyi": "__init__",
    ".rs": "mod",
    ".js": "index",
    ".jsx": "index",
    ".mjs": "index",
    ".cjs": "index",
    ".ts": "index",
    ".tsx": "index",
    # `.mts`/`.cts` are TypeScript's ESM/CJS forms and are directory entry
    # points exactly as `.mjs`/`.cjs` are. They belong to `TS_EXTENSIONS` and
    # to `JS_TS_MODULE_EXTENSIONS`, which is the set cgr's own directory-index
    # resolution already searches, so omitting them here made `pkg/index.mts`
    # derive `pkg.index` instead of `pkg` and the unresolved-importer query
    # asked for a name no waiter had written (issue #1682 review).
    ".mts": "index",
    ".cts": "index",
}
MOD_RS = "mod.rs"
LIB_RS = "lib.rs"
MAIN_RS = "main.rs"
SEPARATOR_DOUBLE_COLON = "::"
SEPARATOR_PROTOTYPE = ".prototype."
RUST_CRATE_KEYWORD = "crate"
# A Rust crate path whose module is backed by a file the qn scheme cannot key
# (an unrepresentable `#[path]` target: absolute, Windows-separated, or a climb
# above the repository root) has no referent in the graph. The resolvers return
# this qn so the path binds nothing and callers treat it as a decided drop
# rather than falling back to a name-derived shadow file (issue #1082). The NUL
# byte keeps it distinct from every real qn while remaining an ordinary str.
RUST_UNRESOLVABLE_QN = "\x00unrepresentable"
BUILTIN_PREFIX = "builtin"
IIFE_FUNC_PREFIX = "iife_func_"
IIFE_ARROW_PREFIX = "iife_arrow_"
OPERATOR_PREFIX = "operator"
KEYWORD_SUPER = "super"
KEYWORD_SELF = "self"
KEYWORD_CONSTRUCTOR = "constructor"
# Receivers that name the enclosing type rather than an ordinary value, so
# `self.Inner()` and `cls.Inner()` are real nested-class constructions.
# Membership is not sufficient on its own: `self` is also a legal Go receiver
# name, and a spelling test alone accepted `self.Error()` for a module-level
# `Error`. The caller pairs this with a nesting check against the enclosing
# type, which is what actually distinguishes the two (issue #1641).
SELF_RECEIVER_KEYWORDS = frozenset({"self", "cls", "this"})

# Incremental update hash cache
HASH_CACHE_FILENAME = ".cgr-hash-cache.json"
# The cache entry of a file the run could not read: never a real digest, so
# the next run hashes the file whatever its mtime and, finding no match,
# re-parses it with the delete-before-reparse a KNOWN file gets (issue #1983).
HASH_CACHE_UNREADABLE = "unreadable"
DIR_MTIMES_FILENAME = ".cgr-dir-mtimes.json"
# `cgr index` keeps a run's sync state in a throwaway directory with this
# prefix instead of the repository (issue #2401).
INDEX_STATE_DIR_PREFIX = "cgr-index-state-"
# Present while an EXPOSES cleanup the last run skipped (its project registry
# was unreadable) is still owed; the in-sync fast path refuses until a batch
# run has done it (issue #2193).
EXPOSES_CLEANUP_PENDING_FILENAME = ".cgr-exposes-cleanup-pending"
# Present while an orphan prune the last run cut short is still owed: a path
# read failed, or the project registry was unreadable and rows whose owner it
# could not establish were left (issue #1985). Unchanged files would otherwise
# take the in-sync fast path, which never prunes, and keep those rows forever.
PRUNE_PENDING_FILENAME = ".cgr-prune-pending"
PARSER_FINGERPRINT_FILENAME = ".cgr-parser-fingerprint"
DELOMBOK_STATE_FILENAME = ".cgr-delombok-state.json"
# The exclusion set the last run indexed under, covering both the excludes and
# the unignores (which come from `!` lines in .cgrignore/.gitignore and from
# interactive setup; there is no --unignore flag). Nothing on disk changes when
# only the CLI --exclude flags do, so without this the sync check cannot tell
# that the eligible set moved (issue #1606).
EXCLUSION_STATE_FILENAME = ".cgr-exclusion-state.json"
# Each project's own stamp inside the exclusion state file, keyed by project
# name. The top-
```

### Core Architecture Module: `codebase_rag/parsers/class_ingest/utils.py`
```
from __future__ import annotations

from tree_sitter import Node

from ... import constants as cs
from ..utils import safe_decode_with_fallback


def decode_node_stripped(node: Node) -> str:
    return safe_decode_with_fallback(node).strip() if node.text else ""


def find_child_by_type(node: Node, node_type: str) -> Node | None:
    return next((c for c in node.children if c.type == node_type), None)


def csharp_has_override_modifier(method_node: Node) -> bool:
    # A C# member declares `override` via a `modifier` child that wraps
    # exactly one keyword; its stripped text IS the keyword. Its presence is
    # what separates a real base override from an explicit `new` hide (which
    # must not become OVERRIDES).
    for child in method_node.children:
        if child.type == cs.TS_CSHARP_MODIFIER and (
            decode_node_stripped(child) == cs.TS_CSHARP_MODIFIER_OVERRIDE
        ):
            return True
    return False

```

### Core Architecture Module: `codebase_rag/parsers/cpp/utils.py`
```
from tree_sitter import Node

from ... import constants as cs
from ..utils import safe_decode_text, safe_decode_with_fallback


def convert_operator_symbol_to_name(symbol: str) -> str:
    return cs.CPP_OPERATOR_SYMBOL_MAP.get(
        symbol,
        f"{cs.OPERATOR_PREFIX}{cs.CHAR_UNDERSCORE}{symbol.replace(cs.CHAR_SPACE, cs.CHAR_UNDERSCORE)}",
    )


def build_qualified_name(node: Node, module_qn: str, name: str) -> str:
    module_parts = module_qn.split(cs.SEPARATOR_DOT)

    is_module_file = len(module_parts) >= 3 and (
        bool(cs.CPP_MODULE_PATH_MARKERS & set(module_parts))
        or any(part.endswith(cs.CPP_MODULE_EXTENSIONS) for part in module_parts)
    )

    if is_module_file:
        project_name = module_parts[0]
        filename = module_parts[-1]

        return cs.SEPARATOR_DOT.join([project_name, filename, name])

    path_parts = extract_namespace_path(node)

    if path_parts:
        return cs.SEPARATOR_DOT.join([module_qn, *path_parts, name])
    return cs.SEPARATOR_DOT.join([module_qn, name])


def extract_namespace_path(node: Node) -> list[str]:
    """Names of the namespace blocks enclosing *node*, outermost first.

    C++17 nested syntax (`namespace a::b {`) parses as ONE namespace node
    named `a::b`; split it so both spellings of the same namespaces yield
    identical qn segments (`a.b`), matching classic nesting and the libclang
    frontend's nested cursors.
    """
    path_parts: list[str] = []
    current = node.parent

    while current and current.type != cs.CppNodeType.TRANSLATION_UNIT:
        if current.type == cs.CppNodeType.NAMESPACE_DEFINITION and (
            namespace_name := _namespace_name(current)
        ):
            path_parts.extend(reversed(namespace_name.split(cs.SEPARATOR_DOUBLE_COLON)))
        current = current.parent

    path_parts.reverse()
    return path_parts


def _namespace_name(namespace: Node) -> str | None:
    # The `name` field, else the first identifier child (older grammars).
    name_node = namespace.child_by_field_name(cs.KEY_NAME)
    if name_node and name_node.text:
        return safe_decode_text(name_node)
    for child in namespace.children:
        if (
            child.type
            in (cs.CppNodeType.NAMESPACE_IDENTIFIER, cs.CppNodeType.IDENTIFIER)
            and child.text
        ):
            return safe_decode_text(child)
    return None


_EXPORT_CANDIDATE_TYPES = frozenset(
    {
        cs.CppNodeType.EXPORT,
        cs.CppNodeType.EXPORT_KEYWORD,
        cs.CppNodeType.IDENTIFIER,
        cs.CppNodeType.PRIMITIVE_TYPE,
    }
)

_EXPORT_STOP_TYPES = frozenset(
    {
        cs.CppNodeType.DECLARATION,
        cs.CppNodeType.FUNCTION_DEFINITION,
        cs.CppNodeType.TEMPLATE_DECLARATION,
        cs.CppNodeType.CLASS_SPECIFIER,
        cs.CppNodeType.TRANSLATION_UNIT,
    }
)


def is_exported(node: Node) -> bool:
    current = node
    export_text = cs.CppNodeType.EXPORT
    while current.parent:
        parent = current.parent

        for child in parent.children:
            if child == current:
                break
            if (
                child.type in _EXPORT_CANDIDATE_TYPES
                and child.text
                and safe_decode_text(child) == export_text
            ):
                return True

        if current.type in _EXPORT_STOP_TYPES:
            break
        current = current.parent

    return False


def extract_exported_class_name(class_node: Node) -> str | None:
    return next(
        (
            safe_decode_text(child)
            for child in class_node.children
            if child.type == cs.CppNodeType.IDENTIFIER and child.text
        ),
        None,
    )


def extract_operator_name(operator_node: Node) -> str:
    if not operator_node.text:
        return cs.CPP_FALLBACK_OPERATOR

    operator_text = safe_decode_with_fallback(operator_node).strip()

    if operator_text.startswith(cs.CPP_OPERATOR_TEXT_PREFIX):
        symbol = operator_text[len(cs.CPP_OPERATOR_TEXT_PREFIX) :].strip()
        return convert_operator_symbol_to_name(symbol)

    return cs.CPP_FALLBACK_OPERATOR


def extract_destructor_name(destructor_node: Node) -> str:
    for child in destructor_node.children:
        if child.type == cs.CppNodeType.IDENTIFIER and child.text:
            class_name = safe_decode_text(child)
            return f"{cs.CPP_DESTRUCTOR_PREFIX}{class_name}"
    return cs.CPP_FALLBACK_DESTRUCTOR


def _extract_name_from_function_definition(func_node: Node) -> str | None:
    def find_function_declarator(node: Node) -> str | None:
        if node.type == cs.CppNodeType.FUNCTION_DECLARATOR:
            return extract_function_name(node)

        for child in node.children:
            if child.type in (
                cs.CppNodeType.POINTER_DECLARATOR,
                cs.CppNodeType.REFERENCE_DECLARATOR,
                cs.CppNodeType.FUNCTION_DECLARATOR,
                cs.CppNodeType.PARENTHESIZED_DECLARATOR,
                # A macro-attributed ctor buries its REAL declarator inside
                # the ERROR while the base-initializer (`: exception(...)`)
                # survives as a sibling declarator; depth-first source order
                # must enter the ERROR so the ctor's own name wins.
                cs.TS_ERROR,
            ):
                result = find_function_declarator(child)
                if result:
                    return result
        return None

    return find_function_declarator(func_node)


def _extract_name_from_declaration(func_node: Node) -> str | None:
    return next(
        (
            extract_function_name(child)
            for child in func_node.children
            if child.type == cs.CppNodeType.FUNCTION_DECLARATOR
        ),
        None,
    )


def _extract_name_from_field_declaration(func_node: Node) -> str | None:
    for child in func_node.children:
        if child.type != cs.CppNodeType.FUNCTION_DECLARATOR:
            continue
        if (name := _function_declarator_field_name(child)) is not None:
            return name
    return None


def _function_declarator_field_name(declarator_node: Node) -> str | None:
    """The field identifier a `function_declarator` names: its `declarator`
    field when that is one, else the first field-identifier child."""
    declarator = declarator_node.child_by_field_name(cs.FIELD_DECLARATOR)
    if (
        declarator
        and declarator.type == cs.CppNodeType.FIELD_IDENTIFIER
        and declarator.text
    ):
        return safe_decode_text(declarator)
    for grandchild in declarator_node.children:
        if grandchild.type == cs.CppNodeType.FIELD_IDENTIFIER and grandchild.text:
            return safe_decode_text(grandchild)
    return None


def _extract_name_from_function_declarator(func_node: Node) -> str | None:
    for child in func_node.children:
        if (
            child.type
            in (
                cs.CppNodeType.IDENTIFIER,
                cs.CppNodeType.FIELD_IDENTIFIER,
            )
            and child.text
        ):
            return safe_decode_text(child)
        if child.type == cs.CppNodeType.QUALIFIED_IDENTIFIER:
            return _find_rightmost_name(child)
        if child.type == cs.CppNodeType.OPERATOR_NAME:
            return extract_operator_name(child)
        if child.type == cs.CppNodeType.DESTRUCTOR_NAME:
            return extract_destructor_name(child)
    return None


def _find_rightmost_name(node: Node) -> str | None:
    # Handle out-of-class method definitions like Calculator::add
    # or deeply nested like Outer::Inner::MyClass::method
    last_name = None
    for qchild in node.children:
        match qchild.type:
            case cs.CppNodeType.IDENTIFIER | cs.CppNodeType.FIELD_IDENTIFIER:
                last_name = safe_decode_text(qchild)
            case cs.CppNodeType.OPERATOR_NAME:
                last_name = extract_operator_name(qchild)
            case cs.CppNodeType.DESTRUCTOR_NAME:
                last_name = extract_destructor_name(qchild)
            case cs.CppNodeType.QUALIFIED_IDENTIFIER:
                if nested := _find_rightmost_name(qchild):
                    last_name = nested
    return last_name


def _extract_name_from_template_declaration(func_node: Node) -> str | None:
    return next(
        (
            extract_function_name(child)
            for child in func_node.children
            if child.type
            in (
                cs.CppNodeType.FUNCTION_DEFINITION,
                cs.CppNodeType.FUNCTION_DECLARATOR,
                cs.CppNodeType.DECLARATION,
            )
        ),
        None,
    )


def _enclosing_class_name(node: Node) -> str | None:
    current = node.parent
    while current is not None:
        if current.type in cs.CPP_TYPE_SPECIFIER_NODE_TYPES:
            name = current.child_by_field_name(cs.FIELD_NAME)
            if name is None:
                return None
            # A specialization's name (`formatter<T, char>`) is a
            # template_type; the ctor identifier repeats only the bare name.
            if name.type == cs.CppNodeType.TEMPLATE_TYPE:
                inner = name.child_by_field_name(cs.FIELD_NAME)
                return safe_decode_text(inner) if inner is not None else None
            return safe_decode_text(name)
        current = current.parent
    return None


def _has_named_parameter(declarator: Node) -> bool:
    # A macro invocation's "parameters" are expressions (`(...)`, bare
    # identifiers parsed as type-only declarations, or call shapes), so none
    # carries a NAMED declarator. A real definition's `int fd` / `const S& s`
    # does. One named parameter is proof of a genuine declaration even when
    # recovery orphaned it from its class.
    params = declarator.child_by_field_name(cs.FIELD_PARAMETERS)
    if params is None:
        return False
    for param in params.children:
        if param.type not in (
            cs.CppNodeType.PARAMETER_DECLARATION,
            cs.CppNodeType.OPTIONAL_PAR
```

### Core Architecture Module: `codebase_rag/parsers/csharp/utils.py`
```
from __future__ import annotations

from collections.abc import Iterator, Mapping
from functools import lru_cache
from types import MappingProxyType

from tree_sitter import Node

from ... import constants as cs
from ..utils import safe_decode_text


def _first_attribute_list(node: Node) -> Node | None:
    # First attribute_list in document order anywhere under `node` (pre-order
    # DFS), so an attribute nested in an inner `#if` (a conditional block
    # inside another) is still found, not only an immediate grandchild.
    if node.type == cs.TS_CSHARP_ATTRIBUTE_LIST:
        return node
    for child in node.children:
        if (found := _first_attribute_list(child)) is not None:
            return found
    return None


def definition_start_point(node: Node) -> tuple[int, int]:
    """The 1-based line and 0-based column a declaration truly starts at.

    The line alone is not enough for a caller that pairs the two: taking the
    line from a nested attribute and the column from the outer node names a
    point that is nowhere in the source (issue #1071).
    """
    for child in node.children:
        if child.type == cs.TS_CSHARP_PREPROC_IF_IN_ATTR_LIST:
            if (attr_list := _first_attribute_list(child)) is not None:
                return attr_list.start_point[0] + 1, attr_list.start_point[1]
            continue
        return child.start_point[0] + 1, child.start_point[1]
    return node.start_point[0] + 1, node.start_point[1]


def definition_start_line(node: Node) -> int:
    # The 1-based line a declaration truly starts on. When its attributes are
    # wrapped in a conditional-compilation block (`#if SYMBOL [Attr] #endif`),
    # tree-sitter nests a leading preproc_if_in_attribute_list child, so the
    # declaration's own start_point is the `#if` directive line. Roslyn treats
    # the directives as trivia and starts the span at the conditional
    # attribute, so return that attribute's line (else the first non-directive
    # child's line). Falls back to the node's own start for the common case
    # with no leading directive.
    for child in node.children:
        if child.type == cs.TS_CSHARP_PREPROC_IF_IN_ATTR_LIST:
            if (attr_list := _first_attribute_list(child)) is not None:
                return attr_list.start_point[0] + 1
            continue
        return child.start_point[0] + 1
    return node.start_point[0] + 1


def _normalize_type_name(text: str) -> str:
    # Strip generic arguments (`List<int>` -> `List`), a nullable suffix
    # (`Widget?`/`int?` -> the underlying type, so a nullable receiver still
    # binds), and whitespace, so a parameter signature is stable and matches
    # the registered, generic-free type names. Array brackets are kept (they
    # distinguish overloads).
    normalized: list[str] = []
    generic_depth = 0
    for char in text:
        if char == cs.CHAR_ANGLE_OPEN:
            generic_depth += 1
        elif char == cs.CHAR_ANGLE_CLOSE and generic_depth:
            generic_depth -= 1
        elif generic_depth == 0:
            normalized.append(char)
    return "".join(normalized).strip().rstrip(cs.CHAR_QUESTION_MARK)


def strip_generic_arguments(text: str) -> str:
    """A type path with every segment's generic arguments removed.

    `Lib.Util<int>.Helper<T>` -> `Lib.Util.Helper`: unlike a cut at the
    first `<`, a generic NON-LEAF segment keeps the segments after it.
    """
    out: list[str] = []
    depth = 0
    for ch in text:
        if ch == cs.CHAR_ANGLE_OPEN:
            depth += 1
        elif ch == cs.CHAR_ANGLE_CLOSE:
            depth = max(depth - 1, 0)
        elif depth == 0:
            out.append(ch)
    return "".join(out).replace(" ", "")


def leaf_type_segment(text: str) -> str:
    """The last segment of a type path, split at the last dot OUTSIDE generic
    arguments: `Lib.Helper<System.String>` -> `Helper<System.String>`, where a
    plain rsplit would hand back `String>`.
    """
    depth = 0
    cut = -1
    for index, ch in enumerate(text):
        if ch == cs.CHAR_ANGLE_OPEN:
            depth += 1
        elif ch == cs.CHAR_ANGLE_CLOSE:
            depth = max(depth - 1, 0)
        elif ch == cs.SEPARATOR_DOT and depth == 0:
            cut = index
    return text[cut + 1 :]


def generic_arity_of_type_text(text: str) -> int:
    # Number of top-level type arguments in a type reference:
    # `Builder` -> 0, `Builder<T>` -> 1, `Map<K, List<V>>` -> 2. Used to
    # disambiguate same-simple-name generic/non-generic type declarations.
    open_idx = text.find(cs.CHAR_ANGLE_OPEN, _type_leaf_start(text))
    if open_idx < 0:
        return 0
    return _count_top_level_type_args(text[open_idx + 1 :])


def _type_leaf_start(text: str) -> int:
    # Index where the last top-level `.`/`::`-separated segment begins, so
    # `Outer<A>.Inner<B, C>` counts Inner's arguments, not Outer's.
    leaf_start = 0
    depth = 0
    index = 0
    while index < len(text):
        char = text[index]
        if char == cs.CHAR_ANGLE_OPEN:
            depth += 1
        elif char == cs.CHAR_ANGLE_CLOSE and depth:
            depth -= 1
        elif depth == 0:
            if text.startswith(cs.SEPARATOR_DOUBLE_COLON, index):
                leaf_start = index + len(cs.SEPARATOR_DOUBLE_COLON)
                index += len(cs.SEPARATOR_DOUBLE_COLON) - 1
            elif char == cs.SEPARATOR_DOT:
                leaf_start = index + 1
        index += 1
    return leaf_start


def _count_top_level_type_args(args_text: str) -> int:
    # Comma-separated arguments up to the `>` closing the list `args_text`
    # opens after; nested `<>`, `()` and `[]` commas are not counted.
    depth = 0
    count = 1
    for ch in args_text:
        if ch in "<([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        elif ch == cs.CHAR_ANGLE_CLOSE:
            if depth == 0:
                break
            depth -= 1
        elif ch == cs.CHAR_COMMA and depth == 0:
            count += 1
    return count


GENERIC_ARITY_MARKER = "`"


def annotate_type_ref(text: str) -> str:
    # Normalized type reference carrying its WRITTEN generic arity in CLR
    # style (`Builder<T>` -> "Builder`1", `Builder` -> "Builder"): a plain
    # name always means arity 0, so simple-name twins stay distinguishable
    # through every stored type map without touching method signatures.
    return type_ref(_normalize_type_name(text), generic_arity_of_type_text(text))


def type_ref(name: str, arity: int) -> str:
    return f"{name}{GENERIC_ARITY_MARKER}{arity}" if arity else name


def split_type_ref(name: str) -> tuple[str, int]:
    if GENERIC_ARITY_MARKER in name:
        base, _, tail = name.rpartition(GENERIC_ARITY_MARKER)
        if tail.isdigit():
            return base, int(tail)
    return name, 0


def normalize_csharp_type_name(type_node: Node) -> str | None:
    # A type node's normalized name (generic-free, nullable-stripped) or
    # None for unnameable types (`void` callers never chain off it, but a
    # void return is recorded harmlessly and simply never resolves).
    text = safe_decode_text(type_node)
    return _normalize_type_name(text) if text else None


def extract_parameter_type_names(method_node: Node) -> list[str]:
    # The declared type of each parameter, in order, for the method-qn
    # signature that keeps C# overloads distinct. A `params object[]` tail is
    # not wrapped in a `parameter` node (grammar quirk); its `array_type`
    # sits directly under the parameter_list, so capture that too.
    param_list = method_node.child_by_field_name(cs.FIELD_PARAMETERS)
    if param_list is None:
        return []
    types: list[str] = []
    for child in param_list.children:
        type_node: Node | None = None
        if child.type == cs.TS_CSHARP_PARAMETER:
            type_node = child.child_by_field_name(cs.FIELD_TYPE)
        elif child.type == cs.TS_CSHARP_ARRAY_TYPE:
            type_node = child
        if type_node is not None and type_node.text:
            if name := safe_decode_text(type_node):
                types.append(_normalize_type_name(name))
    return types


_CSHARP_TYPE_DECLARATIONS = frozenset(
    {
        cs.TS_CSHARP_CLASS_DECLARATION,
        cs.TS_CSHARP_STRUCT_DECLARATION,
        cs.TS_CSHARP_RECORD_DECLARATION,
        cs.TS_CSHARP_INTERFACE_DECLARATION,
        cs.TS_CSHARP_ENUM_DECLARATION,
    }
)


def _declared_name(node: Node) -> str | None:
    name_node = node.child_by_field_name(cs.TS_CSHARP_FIELD_NAME)
    if name_node is None or not name_node.text:
        return None
    return safe_decode_text(name_node)


def _file_scoped_namespace(unit: Node) -> str | None:
    # A file-scoped `namespace N;` is a SIBLING of the declarations it
    # governs under the compilation unit, not their ancestor.
    for child in unit.children:
        if child.type == cs.TS_CSHARP_FILE_SCOPED_NAMESPACE_DECLARATION:
            return _declared_name(child)
    return None


def _scope_of(node: Node) -> tuple[bool, str] | None:
    # (is namespace, name) when `node` is a scope the qualified name walks.
    if node.type == cs.TS_CSHARP_NAMESPACE_DECLARATION:
        name = _declared_name(node)
        return (True, name) if name else None
    if node.type in _CSHARP_TYPE_DECLARATIONS:
        name = _declared_name(node)
        return (False, name) if name else None
    if node.type == cs.TS_CSHARP_COMPILATION_UNIT:
        name = _file_scoped_namespace(node)
        return (True, name) if name else None
    return None


def _enclosing_scopes(node: Node) -> tuple[list[str], list[str]]:
    # (namespace segments, enclosing type names) of `node`, outermost first.
    # Block namespaces are ancestors and nest; the file-scoped one is read
    # from the compilation unit.
    namespaces: list[str] = []
    types: list[str] = []
    current = node.parent
    while current is not None:
        scope = _scope_of(current)
        if scope is not None:
            (namespaces if scope[0]
```

### Core Architecture Module: `codebase_rag/parsers/dart/utils.py`
```
from __future__ import annotations

from collections.abc import Iterator
from typing import NamedTuple

from tree_sitter import Node

from ... import constants as cs
from ...language_spec import decode_node_text


class DartConstructorDelegation(NamedTuple):
    """A Dart constructor's `: this(...)` or `: super(...)` clause: the clause
    node (the edge site), whether it runs a SUPERCLASS constructor, and the
    named constructor it targets (None for the unnamed one)."""

    site: Node
    to_super: bool
    name: str | None


def _identifier_texts(node: Node) -> list[bytes]:
    return [
        text
        for child in node.named_children
        if child.type == cs.TS_IDENTIFIER and (text := child.text)
    ]


def dart_get_name(node: Node) -> str | None:
    # The single source of truth for Dart declaration names; language_spec's
    # DART_FQN_SPEC delegates here. Most Dart declarations expose a `name`
    # field (functions, getters, setters, classes, enums, extensions).
    # Constructors/factories and mixins do not: their LAST bare `identifier`
    # child is the declared name (`C.named` -> `named`, `mixin Swimmer` ->
    # `Swimmer`, a default constructor `C(...)` -> `C`). The constructor check
    # comes FIRST: the grammar's `name` field on constructor_signature is the
    # CLASS identifier, which would collapse every named constructor into a
    # duplicate of the default one.
    if node.type in cs.DART_CONSTRUCTOR_SIGNATURE_TYPES:
        texts = _identifier_texts(node)
        if texts:
            return decode_node_text(texts[-1])
        return None
    name_node = node.child_by_field_name(cs.FIELD_NAME)
    if name_node and name_node.text:
        return decode_node_text(name_node.text)
    texts = _identifier_texts(node)
    if texts:
        return decode_node_text(texts[-1])
    return None


def dart_definition_end_point(node: Node) -> tuple[int, int]:
    """End point of a captured Dart function/method, including its body.

    The grammar splits a definition into a `*_signature` node and a sibling
    `function_body`, so the signature's own end excludes the body. A signature
    under a `method_signature`/`declaration` wrapper takes the wrapper's
    following `function_body` sibling; a top-level signature takes its own.
    Any non-signature node returns its end point unchanged.
    """
    if node.type not in cs.DART_SIGNATURE_TYPES:
        return node.end_point
    base = node
    if node.parent is not None and node.parent.type in cs.DART_SIGNATURE_WRAPPERS:
        base = node.parent
    following = base.next_named_sibling
    if following is not None and following.type == cs.TS_DART_FUNCTION_BODY:
        return following.end_point
    return base.end_point


def dart_body_node(node: Node) -> Node | None:
    """The sibling `function_body` completing a captured signature, or None."""
    if node.type not in cs.DART_SIGNATURE_TYPES:
        return None
    base = node
    if node.parent is not None and node.parent.type in cs.DART_SIGNATURE_WRAPPERS:
        base = node.parent
    following = base.next_named_sibling
    if following is not None and following.type == cs.TS_DART_FUNCTION_BODY:
        return following
    return None


def dart_definition_end_byte(node: Node) -> int:
    """End byte of a captured Dart definition, including its sibling body.

    A body-less constructor still runs its `: this(...)` / `: super(...)` /
    field-initializer clauses, so it ends with the last of them; the calls in
    their arguments belong to it, not to the enclosing module (issue #2482).
    """
    body = dart_body_node(node)
    if body is not None:
        return body.end_byte
    if clauses := dart_constructor_clauses(node):
        return clauses[-1].end_byte
    return node.end_byte


def dart_constructor_clauses(node: Node) -> list[Node]:
    """The `redirection` / `initializers` clauses of a constructor signature.

    They are siblings of the signature inside its `method_signature` (bodied)
    or `declaration` (body-less) wrapper; any other node has none.
    """
    if node.type not in cs.DART_CONSTRUCTOR_SIGNATURE_TYPES:
        return []
    wrapper = node.parent
    if wrapper is None or wrapper.type not in cs.DART_SIGNATURE_WRAPPERS:
        return []
    return [
        child
        for child in wrapper.named_children
        if child.type in cs.DART_CONSTRUCTOR_CLAUSE_TYPES
    ]


def dart_constructor_delegations(node: Node) -> list[DartConstructorDelegation]:
    """The other constructors a constructor signature delegates to.

    `: this(...)` / `: this.named(...)` redirect to a constructor of the same
    class; a `: super(...)` / `: super.named(...)` initializer entry runs one
    of the superclass. Field initializers and asserts delegate nothing.
    """
    delegations: list[DartConstructorDelegation] = []
    for clause in dart_constructor_clauses(node):
        if clause.type == cs.TS_DART_REDIRECTION:
            entries = [(clause, cs.TS_DART_THIS)]
        else:
            entries = [
                (entry, cs.TS_DART_SUPER)
                for entry in clause.named_children
                if entry.type == cs.TS_DART_INITIALIZER_LIST_ENTRY
            ]
        for entry, keyword in entries:
            head = entry.named_children[0] if entry.named_children else None
            if head is None or head.type != keyword:
                continue
            delegations.append(
                DartConstructorDelegation(
                    site=entry,
                    to_super=keyword == cs.TS_DART_SUPER,
                    name=_first_identifier_text(entry),
                )
            )
    return delegations


def _written_type_after(node: Node, keyword: str) -> str | None:
    """The type named right after the `keyword` token among `node`'s children.

    An import prefix is a flat sibling run (`p` `.` `Point`), so the run is
    glued back to `p.Point` for the resolver to fold against the declaring
    library's own `as` imports; type arguments (`List<T>`) end the run.
    """
    names: list[str] = []
    after_keyword = False
    for child in node.children:
        if not after_keyword:
            after_keyword = child.type == keyword
            continue
        if child.type == cs.TS_DART_TYPE_IDENTIFIER and child.text:
            names.append(decode_node_text(child.text))
        elif child.type != cs.SEPARATOR_DOT:
            break
    return cs.SEPARATOR_DOT.join(names) or None


def dart_extension_on_type(node: Node) -> str | None:
    """The type an `extension ... on T` declaration extends, as written
    (`on p.Point` -> `p.Point`, `on List<T>` -> `List`)."""
    if node.type != cs.TS_DART_EXTENSION_DECLARATION:
        return None
    return _written_type_after(node, cs.DART_EXTENSION_ON_KEYWORD)


def dart_superclass_type(node: Node) -> str | None:
    """The `extends` type, as written, of the class enclosing `node`.

    Only that class declares the constructors a `: super(...)` initializer
    can run: a `with` mixin declares none, an `implements` interface's are
    never inherited, and a class with no `extends` delegates to Object.
    """
    current = node.parent
    while current is not None and current.type != cs.TS_DART_CLASS_DEFINITION:
        current = current.parent
    if current is None:
        return None
    superclass = next(
        (c for c in current.named_children if c.type == cs.TS_DART_SUPERCLASS),
        None,
    )
    if superclass is None:
        return None
    return _written_type_after(superclass, cs.DART_EXTENDS_KEYWORD)


def dart_exposes_library(directive: Node) -> bool:
    """Does this directive hand its target's names to the library's importers?

    `export 'x.dart';` re-exports x, and `part 'x.dart';` makes x part of the
    library itself; a plain `import` only brings x into this file's scope.
    """
    if directive.type == cs.TS_DART_PART_DIRECTIVE:
        return True
    return any(
        child.type == cs.TS_DART_LIBRARY_EXPORT for child in directive.named_children
    )


def _selector_member_name(selector: Node) -> str | None:
    # `.m` / `?.m` -> "m"; an index selector (`[i]`) or a nested
    # argument_part has no static member name.
    for child in selector.named_children:
        if child.type in (
            cs.TS_DART_UNCONDITIONAL_ASSIGNABLE_SELECTOR,
            cs.TS_DART_CONDITIONAL_ASSIGNABLE_SELECTOR,
        ):
            for inner in child.named_children:
                if inner.type == cs.TS_IDENTIFIER and inner.text:
                    return decode_node_text(inner.text)
            return None
    return None


def _first_identifier_text(node: Node) -> str | None:
    for inner in node.named_children:
        if inner.type == cs.TS_IDENTIFIER and inner.text:
            return decode_node_text(inner.text)
    return None


_CALL_HOP = "()"


def _selector_has_argument_part(node: Node) -> bool:
    return node.type == cs.TS_DART_SELECTOR and any(
        child.type == cs.TS_DART_ARGUMENT_PART for child in node.named_children
    )


def _holds_only_type_arguments(selector: Node) -> bool:
    return bool(selector.named_children) and all(
        child.type == cs.TS_DART_TYPE_ARGUMENTS for child in selector.named_children
    )


def _skip_type_argument_selectors(node: Node | None) -> Node | None:
    # `Box<int>.of(1);` in statement position is `Box` + selector(<int>) +
    # selector(.of) + selector((1)): a selector holding only type arguments
    # is not a hop (local review).
    while (
        node is not None
        and node.type == cs.TS_DART_SELECTOR
        and _holds_only_type_arguments(node)
    ):
        node = node.prev_named_sibling
    return node


def _relational_operator_text(node: Node) -> str | None:
    # The relational operator joining a relational_expression's operands.
    for child in node.children:
        if child.type == cs.TS_DART_RELATIONAL_OPERATOR and child.text:
            return decode_node_text(child.text)
    retur
```

### Core Architecture Module: `codebase_rag/parsers/go/utils.py`
```
from __future__ import annotations

from tree_sitter import Node

from ... import constants as cs
from ..utils import safe_decode_text


def extract_package_name(root: Node) -> str | None:
    # The `package foo` clause names the Go package a file belongs to;
    # membership is (directory, package name), not directory alone.
    for child in root.named_children:
        if child.type != cs.TS_GO_PACKAGE_CLAUSE:
            continue
        for ident in child.named_children:
            if ident.type == cs.TS_GO_PACKAGE_IDENTIFIER:
                return safe_decode_text(ident)
    return None


def is_receiver_method(node: Node) -> bool:
    return (
        node.type == cs.TS_GO_METHOD_DECLARATION
        and node.child_by_field_name(cs.FIELD_RECEIVER) is not None
    )


def extract_receiver_type_name(node: Node) -> str | None:
    receiver = node.child_by_field_name(cs.FIELD_RECEIVER)
    if receiver is None:
        return None
    for param in receiver.children:
        if param.type != cs.TS_GO_PARAMETER_DECLARATION:
            continue
        type_node = param.child_by_field_name(cs.FIELD_TYPE)
        if type_node is not None:
            return type_identifier_text(type_node)
    return None


def extract_return_type_name(node: Node) -> str | None:
    # Name of a Go function/method's single return type as its file spells it
    # (`Root() *Command` -> "Command", `Item() *model.Item` -> "model.Item"), for
    # chained-call resolution. A parameter_list result (multiple/named returns)
    # is ambiguous for chaining, so it is skipped.
    result = node.child_by_field_name(cs.FIELD_RESULT)
    if result is None or result.type == cs.TS_GO_PARAMETER_LIST:
        return None
    name = _return_type_identifier(result)
    # A type parameter (`Identity[T any](v T) T`, `(h *Holder[T]) Get() T`)
    # stands for the call's type argument; a declared type sharing its name
    # (a struct `T`) is not what the call returns.
    if name is not None and name in _type_parameter_names(node):
        return None
    return name


def extract_first_return_type_name(node: Node) -> str | None:
    # FIRST return type of a Go function, for typing `v, err := f()` bindings under
    # the (T, error) idiom. Unlike extract_return_type_name (chaining, where a
    # multi-return callee is uncallable so the skip is correct), a parameter_list
    # result contributes its first declared type, and a qualified `pkg.T` keeps its
    # dotted text so a local bound to an external package's type stays typed rather
    # than trie-guessed.
    result = node.child_by_field_name(cs.FIELD_RESULT)
    if result is None:
        return None
    if result.type == cs.TS_GO_PARAMETER_LIST:
        for param in result.children:
            if param.type != cs.TS_GO_PARAMETER_DECLARATION:
                continue
            type_node = param.child_by_field_name(cs.FIELD_TYPE)
            return _first_return_identifier(type_node) if type_node else None
        return None
    return _first_return_identifier(result)


def _first_return_identifier(type_node: Node) -> str | None:
    if type_node.type == cs.TS_GO_QUALIFIED_TYPE:
        return safe_decode_text(type_node)
    if type_node.type == cs.TS_GO_POINTER_TYPE:
        for child in type_node.named_children:
            return _first_return_identifier(child)
        return None
    return _return_type_identifier(type_node)


def _return_type_identifier(type_node: Node) -> str | None:
    # Like type_identifier_text but does NOT unwrap composite types: a
    # `[]Command`/`map[k]Command`/`chan Command` return is a container, and a chained
    # call lands on the container, not the element, so it must not be unwrapped to
    # "Command" (which would emit a false edge). Only a plain type_identifier, a
    # pointer to one (`*Command`), or a generic base resolves. A type of another
    # package keeps its qualifier (`model.Item`, issue #2467): the bare `Item`
    # would name whatever the reader's own package calls Item, so the reader
    # resolves the qualifier through the declaring file's imports instead.
    if type_node.type in cs.TS_GO_CONTAINER_TYPES:
        return None
    if type_node.type == cs.TS_TYPE_IDENTIFIER and type_node.text:
        return safe_decode_text(type_node)
    if type_node.type == cs.TS_GO_QUALIFIED_TYPE:
        package = type_node.child_by_field_name(cs.FIELD_GO_PACKAGE)
        name = type_node.child_by_field_name(cs.FIELD_NAME)
        if package is None or name is None:
            return None
        return f"{safe_decode_text(package)}{cs.SEPARATOR_DOT}{safe_decode_text(name)}"
    if type_node.type in (cs.TS_GO_POINTER_TYPE, cs.TS_GENERIC_TYPE):
        for child in type_node.children:
            if name := _return_type_identifier(child):
                return name
    return None


def type_identifier_text(type_node: Node) -> str | None:
    if type_node.type == cs.TS_TYPE_IDENTIFIER and type_node.text:
        return safe_decode_text(type_node)
    # Unwrap pointer (*T) and generic (T[P]) receivers to the base name.
    for child in type_node.children:
        if name := type_identifier_text(child):
            return name
    return None


def call_receiver_chain(call_node: Node) -> tuple[Node, list[str]] | None:
    """`NewBox().With(1).Bump()` -> (the `NewBox()` call, ["With", "Bump"]).

    The method names called along a receiver chain, innermost first, and the
    node the chain starts from: a call, or a composite literal with its
    parentheses and `&` taken off (`(&Box{}).Bump()`). None when the callee
    is not a method on such a value; a variable, field or package receiver
    (`b.Bump()`, `pkg.F()`) is what the name-based resolver types already.
    """
    methods: list[str] = []
    node = call_node
    while node.type == cs.TS_GO_CALL_EXPRESSION:
        selector = node.child_by_field_name(cs.TS_FIELD_FUNCTION)
        if selector is None or selector.type != cs.TS_GO_SELECTOR_EXPRESSION:
            break
        field = selector.child_by_field_name(cs.FIELD_FIELD)
        receiver = _value_receiver(selector.child_by_field_name(cs.FIELD_OPERAND))
        if field is None or receiver is None or not (name := safe_decode_text(field)):
            break
        methods.append(name)
        node = receiver
    if not methods:
        return None
    methods.reverse()
    return node, methods


def _value_receiver(operand: Node | None) -> Node | None:
    # A call or a composite literal under any parentheses. A unary operand
    # counts only around a literal, where `&Box{}` is Go's pointer to a fresh
    # value; `(*p).M()` and `(&x).M()` start from a variable instead.
    node = _unparenthesized(operand)
    if node is not None and node.type == cs.TS_GO_UNARY_EXPRESSION:
        inner = _unparenthesized(node.child_by_field_name(cs.FIELD_OPERAND))
        if inner is not None and inner.type == cs.TS_GO_COMPOSITE_LITERAL:
            return inner
        return None
    if node is not None and node.type in (
        cs.TS_GO_CALL_EXPRESSION,
        cs.TS_GO_COMPOSITE_LITERAL,
    ):
        return node
    return None


def _unparenthesized(node: Node | None) -> Node | None:
    while node is not None and node.type == cs.TS_PARENTHESIZED_EXPRESSION:
        node = next(iter(node.named_children), None)
    return node


def _type_parameter_names(node: Node) -> frozenset[str]:
    # The function's own `[T any, U comparable]` list, plus for a method the
    # names its generic receiver binds (`(h *Holder[T])` binds `T`).
    names: set[str] = set()
    params = node.child_by_field_name(cs.FIELD_GO_TYPE_PARAMETERS)
    if params is not None:
        for decl in params.named_children:
            if decl.type == cs.TS_GO_TYPE_PARAMETER_DECLARATION:
                names.update(
                    text
                    for child in decl.children_by_field_name(cs.FIELD_NAME)
                    if (text := safe_decode_text(child))
                )
    receiver = node.child_by_field_name(cs.FIELD_RECEIVER)
    if receiver is not None:
        for param in receiver.named_children:
            if param.type == cs.TS_GO_PARAMETER_DECLARATION:
                names.update(_receiver_type_arguments(param))
    return frozenset(names)


def _receiver_type_arguments(param: Node) -> set[str]:
    type_node = param.child_by_field_name(cs.FIELD_TYPE)
    if type_node is not None and type_node.type == cs.TS_GO_POINTER_TYPE:
        type_node = next(iter(type_node.named_children), None)
    if type_node is None or type_node.type != cs.TS_GO_GENERIC_TYPE:
        return set()
    arguments = type_node.child_by_field_name(cs.FIELD_GO_TYPE_ARGUMENTS)
    if arguments is None:
        return set()
    return {
        text
        for elem in arguments.named_children
        if elem.type == cs.TS_GO_TYPE_ELEM
        for ident in elem.named_children
        if ident.type == cs.TS_TYPE_IDENTIFIER and (text := safe_decode_text(ident))
    }


def binds_locally(node: Node, name: str) -> bool:
    # Whether `name`, used at `node`, is bound inside its function rather than
    # at package level: a parameter, receiver or named result of an enclosing
    # function or closure, or a declaration earlier in an enclosing block.
    # Go scopes a local from the end of its declaration to the end of its
    # block, so a declaration counts only when it precedes the use in a block
    # that encloses it (`NewBox := NewBox()` still calls the package's).
    child = node
    parent = node.parent
    while parent is not None and parent.type != cs.TS_GO_SOURCE_FILE:
        if parent.type in cs.TS_GO_FUNCTION_SCOPES:
            if name in _signature_names(parent):
                return True
            if parent.type != cs.TS_GO_FUNC_LITERAL:
                return False
        elif any(
            name in _declared_names(parent, sibling)
            for sibling in parent.children
            if sibling.end_byte <= child.start_byte
        ):
            return True
        c
```

### Core Architecture Module: `codebase_rag/parsers/java/utils.py`
```
from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, NamedTuple

from tree_sitter import Node

from ... import constants as cs
from ...models import MethodModifiersAndAnnotations
from ...types_defs import (
    ASTNode,
    JavaAnnotationInfo,
    JavaClassInfo,
    JavaFieldInfo,
    JavaMethodCallInfo,
    JavaMethodInfo,
    JavaMethodReferenceParts,
)
from ..utils import safe_decode_text

if TYPE_CHECKING:
    from ...types_defs import ASTCacheProtocol


class ClassContext(NamedTuple):
    module_qn: str
    target_class_name: str
    root_node: Node


def get_root_node_from_module_qn(
    module_qn: str,
    module_qn_to_file_path: dict[str, Path],
    ast_cache: ASTCacheProtocol,
    min_parts: int = 2,
) -> Node | None:
    parts = module_qn.split(cs.SEPARATOR_DOT)
    if len(parts) < min_parts:
        return None

    file_path = module_qn_to_file_path.get(module_qn)
    if file_path is None or not (entry := ast_cache.load(file_path)):
        return None

    root_node, _ = entry
    return root_node


def get_class_context_from_qn(
    class_qn: str,
    module_qn_to_file_path: dict[str, Path],
    ast_cache: ASTCacheProtocol,
) -> ClassContext | None:
    parts = class_qn.split(cs.SEPARATOR_DOT)
    if len(parts) < 2:
        return None

    module_qn = cs.SEPARATOR_DOT.join(parts[:-1])
    target_class_name = parts[-1]

    root_node = get_root_node_from_module_qn(
        module_qn, module_qn_to_file_path, ast_cache, min_parts=1
    )
    if root_node is None:
        return None

    return ClassContext(module_qn, target_class_name, root_node)


def extract_package_name(package_node: ASTNode) -> str | None:
    if package_node.type != cs.TS_PACKAGE_DECLARATION:
        return None

    return next(
        (
            safe_decode_text(child)
            for child in package_node.children
            if child.type in [cs.TS_SCOPED_IDENTIFIER, cs.TS_IDENTIFIER]
        ),
        None,
    )


def extract_import_path(import_node: ASTNode) -> dict[str, str]:
    if import_node.type != cs.TS_IMPORT_DECLARATION:
        return {}

    imports: dict[str, str] = {}
    imported_path = None
    is_wildcard = False

    for child in import_node.children:
        match child.type:
            case cs.TS_SCOPED_IDENTIFIER | cs.TS_IDENTIFIER:
                imported_path = safe_decode_text(child)
            case cs.TS_ASTERISK:
                is_wildcard = True

    if not imported_path:
        return imports

    if is_wildcard:
        wildcard_key = f"*{imported_path}"
        imports[wildcard_key] = imported_path
    elif parts := imported_path.split(cs.SEPARATOR_DOT):
        imported_name = parts[-1]
        imports[imported_name] = imported_path

    return imports


def _extract_superclass(class_node: ASTNode) -> str | None:
    superclass_node = class_node.child_by_field_name(cs.TS_FIELD_SUPERCLASS)
    if not superclass_node:
        return None
    return _extract_type_identifier_name(superclass_node)


def _extract_type_identifier_name(node: ASTNode) -> str | None:
    match node.type:
        case cs.TS_TYPE_IDENTIFIER:
            return safe_decode_text(node)
        case cs.TS_SCOPED_TYPE_IDENTIFIER:
            # `Outer.Base`/`pkg.Base`: keep the full scoped name rather than descend
            # to the first segment (the outer/package), which would point resolution
            # at the wrong class.
            return safe_decode_text(node)
        case cs.TS_GENERIC_TYPE:
            # The base of a generic type is its first type_identifier/scoped child
            # (`Box<T>` -> Box, `Outer.Base<T>` -> Outer.Base); ignore the
            # type_arguments that follow.
            for child in node.children:
                if child.type in (
                    cs.TS_TYPE_IDENTIFIER,
                    cs.TS_SCOPED_TYPE_IDENTIFIER,
                ):
                    return safe_decode_text(child)
            return None
        case _:
            # `extends X` exposes a `superclass` wrapper node, not the type itself;
            # descend to reach the type_identifier/generic_type.
            for child in node.children:
                if name := _extract_type_identifier_name(child):
                    return name
            return None


_JAVA_NAMED_TYPE_NODES = (cs.TS_TYPE_IDENTIFIER, cs.TS_SCOPED_TYPE_IDENTIFIER)


def _extract_interface_name(type_child: ASTNode) -> str | None:
    # A scoped name (`Outer.Inner`, `Map.Entry<K, V>`) stays whole, as the
    # superclass does: its last segment alone may name another type.
    match type_child.type:
        case cs.TS_TYPE_IDENTIFIER | cs.TS_SCOPED_TYPE_IDENTIFIER:
            return safe_decode_text(type_child)
        case cs.TS_GENERIC_TYPE:
            for sub_child in type_child.children:
                if sub_child.type in _JAVA_NAMED_TYPE_NODES:
                    return safe_decode_text(sub_child)
    return None


def _clause_types(clause: ASTNode | None) -> list[ASTNode]:
    # The types an `extends` or `implements` clause writes, one node each;
    # keywords, commas and comments are none.
    if clause is None:
        return []
    types: list[ASTNode] = []
    for child in clause.named_children:
        if child.type == cs.TS_TYPE_LIST:
            types.extend(entry for entry in child.named_children if not entry.is_extra)
        elif not child.is_extra:
            types.append(child)
    return types


def _extract_interfaces(class_node: ASTNode) -> list[str]:
    return [
        interface_name
        for type_child in _clause_types(
            class_node.child_by_field_name(cs.TS_FIELD_INTERFACES)
        )
        if (interface_name := _extract_interface_name(type_child))
    ]


def java_written_supertype_count(declaration: ASTNode) -> int:
    # Every supertype a type declaration writes, whether or not a reader
    # names it: its superclass, the interfaces it implements and, for an
    # interface, the ones it extends.
    extends_interfaces = next(
        (
            child
            for child in declaration.children
            if child.type == cs.TS_JAVA_EXTENDS_INTERFACES
        ),
        None,
    )
    return sum(
        len(_clause_types(clause))
        for clause in (
            declaration.child_by_field_name(cs.TS_FIELD_SUPERCLASS),
            declaration.child_by_field_name(cs.TS_FIELD_INTERFACES),
            extends_interfaces,
        )
    )


def _extract_type_parameters(declaration: ASTNode) -> list[str]:
    type_params_node = declaration.child_by_field_name(cs.TS_FIELD_TYPE_PARAMETERS)
    if not type_params_node:
        return []

    type_parameters: list[str] = []
    for child in type_params_node.children:
        if child.type != cs.TS_TYPE_PARAMETER:
            continue
        # The grammar gives a type parameter's name no field: it is the
        # type_identifier after any annotations, before any bound.
        name_node = child.child_by_field_name(cs.TS_FIELD_NAME) or next(
            (c for c in child.children if c.type == cs.TS_TYPE_IDENTIFIER), None
        )
        if param_name := safe_decode_text(name_node):
            type_parameters.append(param_name)
    return type_parameters


def extract_from_modifiers_node(
    node: ASTNode, allowed_modifiers: frozenset[str]
) -> MethodModifiersAndAnnotations:
    result = MethodModifiersAndAnnotations()
    modifiers_node = next(
        (child for child in node.children if child.type == cs.TS_MODIFIERS), None
    )
    if not modifiers_node:
        return result
    for modifier_child in modifiers_node.children:
        match modifier_child.type:
            case _ if modifier_child.type in allowed_modifiers:
                if modifier := safe_decode_text(modifier_child):
                    result.modifiers.append(modifier)
            case cs.TS_ANNOTATION | cs.TS_MARKER_ANNOTATION:
                if annotation := safe_decode_text(modifier_child):
                    result.annotations.append(annotation)
    return result


def _extract_class_modifiers(class_node: ASTNode) -> list[str]:
    return extract_from_modifiers_node(class_node, cs.JAVA_CLASS_MODIFIERS).modifiers


def extract_class_info(class_node: ASTNode) -> JavaClassInfo:
    if class_node.type not in cs.JAVA_CLASS_NODE_TYPES:
        return JavaClassInfo(
            name=None,
            type="",
            superclass=None,
            interfaces=[],
            modifiers=[],
            type_parameters=[],
        )

    name: str | None = None
    if name_node := class_node.child_by_field_name(cs.TS_FIELD_NAME):
        name = safe_decode_text(name_node)

    return JavaClassInfo(
        name=name,
        type=class_node.type.replace(cs.JAVA_DECLARATION_SUFFIX, ""),
        superclass=_extract_superclass(class_node),
        interfaces=_extract_interfaces(class_node),
        modifiers=_extract_class_modifiers(class_node),
        type_parameters=_extract_type_parameters(class_node),
    )


def _get_method_type(method_node: ASTNode) -> str:
    if method_node.type == cs.TS_CONSTRUCTOR_DECLARATION:
        return cs.JAVA_TYPE_CONSTRUCTOR
    return cs.JAVA_TYPE_METHOD


def _extract_method_return_type(method_node: ASTNode) -> str | None:
    if method_node.type != cs.TS_METHOD_DECLARATION:
        return None
    if type_node := method_node.child_by_field_name(cs.TS_FIELD_TYPE):
        return safe_decode_text(type_node)
    return None


def _extract_formal_param_type(param_node: ASTNode) -> str | None:
    if param_type_node := param_node.child_by_field_name(cs.TS_FIELD_TYPE):
        return safe_decode_text(param_type_node)
    return None


# Inside a `spread_parameter` the element type is the child that is neither
# the `modifiers` (`final`, an annotation) nor the declarator that carries
# the name: a generic, array or primitive element is not a
# `type_identifier`, and matching that alone yielded no parameter at all
# for `List<String>... xs`, `String[]... xs` and `int... xs` (issue #
```

### Core Architecture Module: `codebase_rag/parsers/js_ts/utils.py`
```
from collections.abc import Mapping
from typing import TYPE_CHECKING

from tree_sitter import Language, Node, QueryCursor

from ... import constants as cs
from ..utils import get_cached_query, safe_decode_text

if TYPE_CHECKING:
    from ...types_defs import LanguageQueries


def get_js_ts_language_obj(
    language: cs.SupportedLanguage,
    queries: Mapping[cs.SupportedLanguage, "LanguageQueries"],
) -> Language | None:
    if language not in cs.JS_TS_LANGUAGES:
        return None

    lang_queries = queries[language]
    return lang_queries.get(cs.QUERY_LANGUAGE)


def _extract_class_qn(method_qn: str) -> str | None:
    qn_parts = method_qn.split(cs.SEPARATOR_DOT)
    return cs.SEPARATOR_DOT.join(qn_parts[:-1]) if len(qn_parts) >= 2 else None


def extract_method_call(member_expr_node: Node) -> str | None:
    object_node = member_expr_node.child_by_field_name(cs.FIELD_OBJECT)
    property_node = member_expr_node.child_by_field_name(cs.FIELD_PROPERTY)

    if object_node and property_node:
        object_text = object_node.text
        property_text = property_node.text

        if object_text and property_text:
            object_name = safe_decode_text(object_node)
            property_name = safe_decode_text(property_node)
            return f"{object_name}{cs.SEPARATOR_DOT}{property_name}"

    return None


def find_method_in_class_body(class_body_node: Node, method_name: str) -> Node | None:
    for child in class_body_node.children:
        if child.type == cs.TS_METHOD_DEFINITION:
            name_node = child.child_by_field_name(cs.FIELD_NAME)
            if name_node and name_node.text:
                found_name = safe_decode_text(name_node)
                if found_name == method_name:
                    return child

    return None


_CLASS_BODY_CACHE: dict[str, Node | None] = {}
# The OWNER is a strong reference, never a bare id(): a freed tree's heap
# address gets recycled, so an integer owner could masquerade as current and
# serve Node values from a dead tree (the xdist worker-distribution flake,
# issue #1042). Holding the reference pins the owner's tree, so no live tree
# can alias its address — which is what makes NODE EQUALITY sound here, and
# equality (not identity) is required because each `tree.root_node` access
# mints a fresh wrapper object over the same tree node. Pins exactly one
# tree, the one the cache describes.
_CLASS_BODY_CACHE_OWNER: Node | None = None


def find_method_in_ast(
    root_node: Node, class_name: str, method_name: str
) -> Node | None:
    global _CLASS_BODY_CACHE_OWNER
    if _CLASS_BODY_CACHE_OWNER != root_node:
        _CLASS_BODY_CACHE.clear()
        _CLASS_BODY_CACHE_OWNER = root_node
    cache_key = class_name
    if cache_key in _CLASS_BODY_CACHE:
        body_node = _CLASS_BODY_CACHE[cache_key]
        if body_node is not None:
            return find_method_in_class_body(body_node, method_name)
        return None

    declaration = _class_declaration_named(root_node, class_name)
    body_node = (
        declaration.child_by_field_name(cs.FIELD_BODY)
        if declaration is not None
        else None
    )
    _CLASS_BODY_CACHE[cache_key] = body_node
    if body_node:
        return find_method_in_class_body(body_node, method_name)
    return None


def _class_declaration_named(root_node: Node, class_name: str) -> Node | None:
    # The first `class_declaration` named `class_name`, in source order.
    stack: list[Node] = [root_node]
    while stack:
        current = stack.pop()
        if current.type == cs.TS_CLASS_DECLARATION:
            name_node = current.child_by_field_name(cs.FIELD_NAME)
            if (
                name_node
                and name_node.text
                and safe_decode_text(name_node) == class_name
            ):
                return current
        stack.extend(reversed(current.children))
    return None


_JS_RETURN_QUERY = "(return_statement) @return_stmt"


def find_return_statements(
    node: Node, return_nodes: list[Node], language_obj=None
) -> None:
    if language_obj is not None:
        try:
            q = get_cached_query(language_obj, _JS_RETURN_QUERY)
            cursor = QueryCursor(q)
            captures = cursor.captures(node)
            return_nodes.extend(captures.get("return_stmt", []))
            return
        except Exception:  # noqa: S110 - a failed query falls back to the walk below
            pass
    stack: list[Node] = [node]
    while stack:
        current = stack.pop()
        if current.type == cs.TS_RETURN_STATEMENT:
            return_nodes.append(current)
        stack.extend(reversed(current.children))


def extract_constructor_name(new_expr_node: Node) -> str | None:
    if new_expr_node.type != cs.TS_NEW_EXPRESSION:
        return None

    constructor_node = new_expr_node.child_by_field_name(cs.FIELD_CONSTRUCTOR)
    if constructor_node and constructor_node.type == cs.TS_IDENTIFIER:
        constructor_text = constructor_node.text
        if constructor_text:
            return safe_decode_text(constructor_node)

    return None


def construction_at(root: Node, start: int, text: str) -> Node | None:
    # A call name carries a chain's receiver as text that starts where the
    # call does. Finding that span in the file's own tree, rather than
    # parsing the text alone, keeps the scopes around it, so `new Box()`
    # reads the `Box` bound there. Only a receiver that IS the construction,
    # under any parentheses, is returned: `(new Box() || other)` can
    # evaluate to something else.
    text = text.rstrip()
    if not text.lstrip(cs.JS_RECEIVER_LEADING_CHARS).startswith(cs.JS_NEW_KEYWORD):
        return None
    end = start + len(text.encode(cs.ENCODING_UTF8))
    node = root.named_descendant_for_byte_range(start, end)
    if node is None or node.start_byte != start or node.end_byte != end:
        return None
    while node.type == cs.TS_PARENTHESIZED_EXPRESSION and node.named_child_count == 1:
        node = node.named_children[0]
    return node if node.type == cs.TS_NEW_EXPRESSION else None


_BINDING_WRAPPER_TYPES = cs.TS_CAST_WRAPPER_TYPES | {cs.TS_PARENTHESIZED_EXPRESSION}


def arrow_binding_name(func_node: Node) -> str | None:
    # An arrow / function expression has no `name` field. Recover the binding
    # name for the two named forms whose VALUE is the arrow: a module/local
    # `const f = () => ...` (variable_declarator) and a class field
    # `helper = () => ...` (public_field_definition). Both the definition pass
    # (registering the arrow's qn) and the call pass (attributing the body's
    # calls) must derive the SAME name, or the caller qn is a phantom and the
    # arrow's body callbacks report dead; sharing this one helper keeps them in
    # step. Anonymous / destructured arrows, and arrows that are merely an
    # argument to a call bound to a name (`const m = useMutation(() => {})`),
    # stay unnamed: the arrow is not the binding's own value there.
    if func_node.type not in (
        cs.TS_ARROW_FUNCTION,
        cs.TS_FUNCTION_EXPRESSION,
        cs.TS_GENERATOR_FUNCTION,
    ):
        return None
    return _value_binding_name(func_node)


def _value_binding_name(node: Node) -> str | None:
    # Recover the name a nameless expression is bound to: the `name` of the
    # variable_declarator / public_field_definition whose `value` is this node.
    # The node may sit behind transparent wrappers (parens, TS casts:
    # `export const create = ((s) => ...) as Create`); climb them first so the
    # node is recognised as the binding's value.
    parent = node.parent
    while parent is not None and parent.type in _BINDING_WRAPPER_TYPES:
        node = parent
        parent = node.parent
    if parent is None:
        return None
    # `==` not `is`: py-tree-sitter returns a fresh Node wrapper per access, so
    # identity comparison always fails.
    if parent.child_by_field_name(cs.FIELD_VALUE) != node:
        return None
    name_node = parent.child_by_field_name(cs.FIELD_NAME)
    if name_node is None or name_node.type not in (
        cs.TS_IDENTIFIER,
        cs.TS_PROPERTY_IDENTIFIER,
    ):
        return None
    return safe_decode_text(name_node)


def name_is_body_scoped(func_node: Node) -> bool:
    # A named function expression binds its own name inside its body alone;
    # code elsewhere reaches it through whatever the VALUE is stored under.
    # Where that is the same name (`var f = function f`, `exports.f =
    # function f`) a lookup by the name still lands on a real binding. The
    # module's own export (`module.exports = function f`) is bound by each
    # importer under a name of its choosing, commonly `f`, so it keeps its
    # name too. What is left, a value stored under another name or none (a
    # callback argument, a return value, `var g = function f`), has a name
    # nothing outside its body can call (issue #2402).
    if func_node.type not in (cs.TS_FUNCTION_EXPRESSION, cs.TS_GENERATOR_FUNCTION):
        return False
    name_node = func_node.child_by_field_name(cs.FIELD_NAME)
    if name_node is None:
        return False
    value, holder = func_node, func_node.parent
    while holder is not None and holder.type in _BINDING_WRAPPER_TYPES:
        value, holder = holder, holder.parent
    if holder is None:
        return True
    if _holds_module_export(holder, value):
        return False
    return safe_decode_text(name_node) != _stored_under_name(holder, value)


def _holds_module_export(holder: Node, value: Node) -> bool:
    # `export default (function f () {})`, `module.exports = ...`, and the
    # `module.exports = exports = ...` chain's inner link.
    if holder.type == cs.TS_EXPORT_STATEMENT:
        return True
    target = _assignment_target(holder, value)
    if target is None:
        return False
    if target.type == cs.TS_IDENTIFIER:
        return safe_decode_text(target) == cs.JS_EXPORTS_KEYWORD
    if target.type != cs.TS_MEMBER_EXPRESSION:
        return False
 
```

### Core Architecture Module: `codebase_rag/parsers/lua/utils.py`
```
from tree_sitter import Node

from ... import constants as cs
from ..utils import contains_node, safe_decode_text


def extract_assigned_name(
    target_node: Node, accepted_var_types: tuple[str, ...] = cs.LUA_DEFAULT_VAR_TYPES
) -> str | None:
    var_child = _assignment_target(target_node)
    if var_child is None or var_child.type not in accepted_var_types:
        return None
    if var_child.type == cs.TS_LUA_BRACKET_INDEX_EXPRESSION:
        return bracket_key_path(var_child)
    return safe_decode_text(var_child)


def _assignment_target(target_node: Node) -> Node | None:
    """The variable the nearest enclosing assignment binds to the value that
    holds `target_node`, or None when no value of that assignment does."""
    current = target_node.parent
    while current and current.type != cs.TS_LUA_ASSIGNMENT_STATEMENT:
        current = current.parent

    if not current:
        return None

    expression_list = next(
        (
            child
            for child in current.children
            if child.type == cs.TS_LUA_EXPRESSION_LIST
        ),
        None,
    )
    if not expression_list:
        return None

    values = [
        child
        for i in range(expression_list.child_count)
        if expression_list.field_name_for_child(i) == cs.FIELD_VALUE
        and (child := expression_list.child(i)) is not None
    ]
    target_index = next(
        (
            idx
            for idx, value in enumerate(values)
            if value == target_node or contains_node(value, target_node)
        ),
        -1,
    )
    if target_index == -1:
        return None

    variable_list = next(
        (child for child in current.children if child.type == cs.TS_LUA_VARIABLE_LIST),
        None,
    )
    if not variable_list:
        return None

    names = [
        child
        for i in range(variable_list.child_count)
        if variable_list.field_name_for_child(i) == cs.FIELD_NAME
        and (child := variable_list.child(i)) is not None
    ]
    return names[target_index] if target_index < len(names) else None


def bracket_key_path(index_node: Node) -> str | None:
    """`t.key` for the target `t["key"]`: the same table slot, spelled the way
    the dotted form `t.key = function` names its function (issue #2578).

    None unless every bracketed key on the way is a string literal that is a
    Lua name. `t["lume.clamp"]` spelled `t.lume.clamp` would forge a nested
    table that does not exist, `t["has space"]` and `t["end"]` have no dotted
    spelling at all, and a computed `t[k]` names nothing; those functions
    keep the generated name every language gives a nameless function.
    """
    key = _string_literal_content(index_node.child_by_field_name(cs.FIELD_FIELD))
    if key is None or not _is_lua_name(key):
        return None
    owner = bracket_table_path(index_node)
    return f"{owner}{cs.SEPARATOR_DOT}{key}" if owner else None


def bracket_table_path(index_node: Node) -> str | None:
    """The table `t[...]` indexes, as a dotted path (`t`, `a.b`, and `t.k`
    for `t["k"][...]`), or None when no path spells it."""
    table = index_node.child_by_field_name(cs.TS_LUA_FIELD_TABLE)
    if table is None:
        return None
    match table.type:
        case cs.TS_LUA_BRACKET_INDEX_EXPRESSION:
            return bracket_key_path(table)
        case cs.TS_LUA_IDENTIFIER | cs.TS_DOT_INDEX_EXPRESSION:
            return safe_decode_text(table)
        case _:
            return None


def bracket_assignment_target(func_node: Node) -> Node | None:
    """The `t[...]` target when `func_node` IS the value assigned to it.

    Such a function has a node of its own even when `bracket_key_path` finds
    no name for it, so the call pass must credit its body's calls to it. A
    callback nested inside that value is not the value: it stays nameless and
    its calls bubble to the function around it, as they do everywhere else.
    """
    value = func_node
    while (
        value.parent is not None and value.parent.type == cs.TS_PARENTHESIZED_EXPRESSION
    ):
        value = value.parent
    if not _is_assigned_value(value):
        return None
    target = _assignment_target(func_node)
    if target is None or target.type != cs.TS_LUA_BRACKET_INDEX_EXPRESSION:
        return None
    return target


def is_module_return_value(func_node: Node) -> bool:
    """True when `func_node` is part of the value the chunk returns: the
    returned function itself, or an entry of a returned table at any depth.

    That value is what `require` hands the caller, so the function is the
    module's API (issue #2578). A function nested in such an entry's body
    is not part of the value; it exists only once the entry runs.
    """
    value = func_node
    while value.parent is not None and value.parent.type in _VALUE_PART_TYPES:
        value = value.parent
    return is_chunk_return_list(value.parent)


def is_chunk_return_list(node: Node | None) -> bool:
    """True for the expression list of the chunk's own `return`: a `return`
    inside a function returns from that function, not from the module."""
    statement = node.parent if node is not None else None
    return (
        node is not None
        and node.type == cs.TS_LUA_EXPRESSION_LIST
        and statement is not None
        and statement.type == cs.TS_RETURN_STATEMENT
        and statement.parent is not None
        and statement.parent.type == cs.TS_LUA_CHUNK
    )


# What a function can sit in while still being part of the one value its
# statement produces: `{ f = <fn> }`, `{ sub = { <fn> } }`, `(<fn>)`.
_VALUE_PART_TYPES = frozenset(
    {cs.TS_LUA_FIELD, cs.TS_LUA_TABLE_CONSTRUCTOR, cs.TS_PARENTHESIZED_EXPRESSION}
)


def anonymous_function_name(func_node: Node) -> str:
    """The name the definition pass generates for a function nothing names."""
    row, col = func_node.start_point
    return f"{cs.PREFIX_ANONYMOUS}{row}{cs.CHAR_UNDERSCORE}{col}"


def _string_literal_content(node: Node | None) -> str | None:
    if node is None or node.type not in cs.LUA_STRING_TYPES:
        return None
    content = next(
        (c for c in node.named_children if c.type == cs.TS_LUA_STRING_CONTENT),
        None,
    )
    return safe_decode_text(content) if content is not None else None


def _is_lua_name(text: str) -> bool:
    # ASCII letters, digits and underscores, not starting with a digit: the
    # ASCII subset of a Python identifier is exactly a Lua name.
    return text.isascii() and text.isidentifier() and text not in cs.LUA_RESERVED_WORDS


def find_ancestor_statement(node: Node) -> Node | None:
    stmt = node.parent
    while stmt and not (
        stmt.type.endswith(cs.LUA_STATEMENT_SUFFIX)
        or stmt.type in {cs.TS_LUA_ASSIGNMENT_STATEMENT, cs.TS_LUA_LOCAL_STATEMENT}
    ):
        stmt = stmt.parent
    return stmt


def extract_pcall_second_identifier(call_node: Node) -> str | None:
    stmt = find_ancestor_statement(call_node)
    if not stmt:
        return None

    variable_list = next(
        (child for child in stmt.children if child.type == cs.TS_LUA_VARIABLE_LIST),
        None,
    )
    if not variable_list:
        return None

    names = []
    for i in range(variable_list.child_count):
        if variable_list.field_name_for_child(i) == cs.FIELD_NAME:
            name_node = variable_list.child(i)
            if name_node and name_node.type == cs.TS_LUA_IDENTIFIER:
                if decoded := safe_decode_text(name_node):
                    names.append(decoded)

    return names[1] if len(names) >= 2 else None


def field_key_name(field: Node) -> str | None:
    """The key a table-constructor `field` binds: `f` in `f = ...`, `set` in
    `["set"] = ...`. None for a positional entry or a computed key.

    tree-sitter-lua exposes `k = v` and `[k] = v` alike as `name: identifier`;
    the opening bracket is what tells a computed key from a literal one
    (#1631 review), so a bracketed identifier is computed and names nothing.
    """
    key = field.child_by_field_name(cs.FIELD_NAME)
    if key is None:
        return None
    bracketed = bool(field.children) and field.children[0].type == cs.LUA_OPEN_BRACKET
    if key.type == cs.TS_LUA_IDENTIFIER:
        return None if bracketed else safe_decode_text(key)
    return _string_literal_content(key)


def field_function_path(func_node: Node) -> tuple[str, str] | None:
    """(`table.key` path, `key`) for a function that is a table field's value.

    Shared by the definition pass, which registers the node under the path,
    and the call pass, which must recover the same name or the body's calls
    are skipped or credited to the enclosing function (#1631 review). Nested
    constructors chain their keys (`M = { sub = { f = ... } }` gives
    `M.sub.f`); the outermost table takes the name its statement assigns it,
    through `extract_assigned_name`. A constructor with no assignment (a
    returned or passed table) names the function by its keys alone.

    None when the function is not a field value, when its key is positional
    or computed, or when any enclosing constructor sits in a positional or
    computed field: `{ { run = function() end } }` has no field `run` on the
    outer list, and inventing `list.run` brings back the `@line` collisions
    this exists to remove. The caller then falls back to the assignment form.
    """
    field = _field_valued_by(func_node)
    if field is None:
        return None
    key = field_key_name(field)
    if not key:
        return None
    parts = [key]
    table = field.parent
    while table is not None and table.type == cs.TS_LUA_TABLE_CONSTRUCTOR:
        enclosing = table.parent
        if enclosing is None or enclosing.type != cs.TS_LUA_FIELD:
            break
        outer_key = field_key_name(enclosing)
        if not outer_key:
            return None
        parts.insert(0, outer_key)
        table = enclosing.parent
    # The outermost constructor takes an owner only when it IS the value
```

### Core Architecture Module: `codebase_rag/parsers/php/utils.py`
```
from __future__ import annotations

from tree_sitter import Node

from ... import constants as cs
from ...language_spec import LANGUAGE_FQN_SPECS
from ...utils.fqn_resolver import scoped_name_parts
from ..utils import safe_decode_text

# Where an anonymous class's anchor stops: the nearest type or namespace,
# which the FQN scope walk names on its own.
_ANCHOR_STOP_TYPES = frozenset(cs.FQN_PHP_SCOPE_TYPES) | frozenset(
    cs.SPEC_PHP_CLASS_TYPES
)
_CALLABLE_TYPES = frozenset(cs.FQN_PHP_FUNCTION_TYPES)


def _positional_name(node: Node) -> str:
    # The shape a nameless function takes in the definition pass
    # (`anonymous_<row>_<col>`, 0-based), so anonymous classes and closures
    # read alike and a re-index of the same source names each one the same.
    return f"{cs.PREFIX_ANONYMOUS}{node.start_point[0]}_{node.start_point[1]}"


def anonymous_class_name(node: Node) -> str | None:
    """`anonymous_<row>_<col>` for a PHP anonymous class, else None.

    The position is the `class` keyword's, so two anonymous classes in one
    file never share a name.
    """
    if node.type != cs.TS_PHP_ANONYMOUS_CLASS:
        return None
    return _positional_name(node)


def _anchor_walk(node: Node) -> tuple[list[Node], Node | None]:
    # The callables between an anonymous class and its anchor stop, innermost
    # first, and the stop itself (None only off a detached subtree).
    callables: list[Node] = []
    current = node.parent
    while current is not None and current.type not in _ANCHOR_STOP_TYPES:
        if current.type in _CALLABLE_TYPES:
            callables.append(current)
        current = current.parent
    return callables, current


def _registered_segments(callables: list[Node]) -> list[str]:
    # The segments the definition pass registers the innermost of `callables`
    # under, below the anchor stop. A method or named function registers
    # under its type scope alone (`Box.inner` for a function declared in
    # `Box::run`); a closure or arrow fn registers under the NAMED callables
    # around it, an enclosing closure adding nothing (`Box.run.anonymous_8_21`
    # inside another closure in `run`).
    if not callables:
        return []
    innermost, *outer = callables
    if name := _declared_name(innermost):
        return [name]
    named = [name for c in reversed(outer) if (name := _declared_name(c))]
    return [*named, _positional_name(innermost)]


def anonymous_class_scope_name(node: Node) -> str | None:
    """The anonymous class's qn segment: its name under the callable it is
    written in, `add.anonymous_19_25` for one built in `Dispatcher::add`.

    PHP's FQN scopes are types and namespaces only, so without the callable
    the class would sit directly under `Dispatcher` beside its methods. The
    callable's part is spelled as that callable is registered, so the class's
    qn prefix is the qn of the node that DEFINES it: a class built in a
    function declared inside `Box::run` is `Box.inner.anonymous_9_23`, not
    `Box.run.inner.anonymous_9_23` under a parent `Box.inner`.
    """
    if (name := anonymous_class_name(node)) is None:
        return None
    callables, _stop = _anchor_walk(node)
    return cs.SEPARATOR_DOT.join([*_registered_segments(callables), name])


def anonymous_class_anchor_stop(node: Node) -> Node | None:
    """The nearest type or namespace above a PHP anonymous class.

    Everything between the class and this node is already spelled by the
    class's scope name, so a walk naming a closure inside the class resumes
    here rather than naming those callables a second time, differently.
    """
    if node.type != cs.TS_PHP_ANONYMOUS_CLASS:
        return None
    return _anchor_walk(node)[1]


def anonymous_class_qn(node: Node, module_qn: str) -> str | None:
    """The qn the definition pass registers an anonymous class under.

    The call pass's own class-qn builder walks class ancestors only and
    would drop the enclosing callables, so it asks for this instead.
    """
    if node.type != cs.TS_PHP_ANONYMOUS_CLASS:
        return None
    parts = scoped_name_parts(
        node, LANGUAGE_FQN_SPECS[cs.SupportedLanguage.PHP], module_qn, None
    )
    return cs.SEPARATOR_DOT.join([module_qn, *parts])


def _declared_name(node: Node) -> str | None:
    name_node = node.child_by_field_name(cs.FIELD_NAME)
    return (safe_decode_text(name_node) or None) if name_node is not None else None

```

### Core Architecture Module: `codebase_rag/parsers/py/utils.py`
```
from __future__ import annotations

from collections.abc import Iterator
from typing import TYPE_CHECKING

from ...constants import SEPARATOR_DOT
from ...types_defs import FunctionRegistryTrieProtocol, NodeType
from ..utils import follow_reexports

if TYPE_CHECKING:
    from ..import_processor import ImportProcessor


def resolve_dotted_class(
    path: str,
    module_qn: str,
    import_processor: ImportProcessor,
    function_registry: FunctionRegistryTrieProtocol,
    own_class_rebinds: bool = False,
) -> str | None:
    """The indexed class a dotted path names from `module_qn`, else None.

    `pkg.Client`, `pkg._client.Client` and `Outer.Inner` start with a name
    the module binds (an import, or a class of its own); the rest is looked
    up under what that name refers to, following the package's re-exports
    (`pkg/__init__.py`'s `from ._client import Client`). A path into a module
    outside the project (`pd.DataFrame`) names no indexed class.
    `own_class_rebinds`: the module's own class of that name is defined
    after the import and rebinds it, so only the class is looked in.
    """
    head, _, rest = path.partition(SEPARATOR_DOT)
    if not rest:
        return None
    import_mapping = import_processor.import_mapping
    own_class = f"{module_qn}{SEPARATOR_DOT}{head}"
    bases = (
        [own_class]
        if own_class_rebinds
        else _dotted_head_bases(head, module_qn, import_mapping.get(module_qn, {}))
    )
    for base in bases:
        qn = follow_reexports(
            f"{base}{SEPARATOR_DOT}{rest}", import_mapping, function_registry
        )
        if function_registry.get(qn) == NodeType.CLASS:
            return qn
    return None


def _dotted_head_bases(
    head: str, module_qn: str, import_map: dict[str, str]
) -> Iterator[str]:
    """What the first name of a dotted path can refer to, most specific first.

    `import pkg._client` binds `pkg` but is recorded as `pkg ->
    <project>.pkg._client`, so besides the recorded target the package
    itself is tried: the target cut after its `pkg` segment.
    """
    if target := import_map.get(head):
        yield target
        parts = target.split(SEPARATOR_DOT)
        for end in range(len(parts) - 1, 0, -1):
            if parts[end - 1] == head:
                yield SEPARATOR_DOT.join(parts[:end])
    yield f"{module_qn}{SEPARATOR_DOT}{head}"


def resolve_class_name(
    class_name: str,
    module_qn: str,
    import_processor: ImportProcessor,
    function_registry: FunctionRegistryTrieProtocol,
    require_registered: bool = False,
    kinds: frozenset[NodeType] | None = None,
) -> str | None:
    """The class qn `class_name` names from `module_qn`: import map first, then
    the module and its enclosing packages, then the registry's name search.

    `kinds` limits the two registry tiers to those node kinds. The name
    search matches any registered node whose last segment is the name, so
    without it a same-named method or property answers for a type.
    """
    # `is not None`, not truthiness: an import-map entry can be the empty
    # string (a relative JS specifier that climbs to the root), and the
    # original returned it as the answer rather than falling through.
    mapped = _import_mapped_class(
        class_name, module_qn, import_processor, function_registry, require_registered
    )
    if mapped is not None:
        return mapped
    return _class_in_module_or_enclosing_package(
        class_name, module_qn, function_registry, kinds
    ) or _class_by_simple_name(class_name, module_qn, function_registry, kinds)


def _is_wanted_kind(
    qualified_name: str,
    function_registry: FunctionRegistryTrieProtocol,
    kinds: frozenset[NodeType] | None,
) -> bool:
    if kinds is None:
        return qualified_name in function_registry
    return function_registry.get(qualified_name) in kinds


def _import_mapped_class(
    class_name: str,
    module_qn: str,
    import_processor: ImportProcessor,
    function_registry: FunctionRegistryTrieProtocol,
    require_registered: bool,
) -> str | None:
    import_map = import_processor.import_mapping.get(module_qn)
    if not import_map or class_name not in import_map:
        return None
    mapped = import_map[class_name]
    # C++ include entries map header STEMS to MODULE qns; when the
    # stem coincides with a class name (Directive.h defining class
    # Directive, the dominant C++ layout) the map answer is a module,
    # not a class. Callers that need a real registered node (call
    # attribution in Pass 3) must fall through to the registry-backed
    # steps below (issue #652: 11k phantom callers on souffle).
    if require_registered and function_registry.get(mapped) is None:
        return None
    return mapped


def _class_in_module_or_enclosing_package(
    class_name: str,
    module_qn: str,
    function_registry: FunctionRegistryTrieProtocol,
    kinds: frozenset[NodeType] | None = None,
) -> str | None:
    same_module_qn = f"{module_qn}.{class_name}"
    if _is_wanted_kind(same_module_qn, function_registry, kinds):
        return same_module_qn
    module_parts = module_qn.split(SEPARATOR_DOT)
    for i in range(len(module_parts) - 1, 0, -1):
        parent_module = SEPARATOR_DOT.join(module_parts[:i])
        potential_qn = f"{parent_module}.{class_name}"
        if _is_wanted_kind(potential_qn, function_registry, kinds):
            return potential_qn
    return None


def _class_by_simple_name(
    class_name: str,
    module_qn: str,
    function_registry: FunctionRegistryTrieProtocol,
    kinds: frozenset[NodeType] | None = None,
) -> str | None:
    matches = [
        match
        for match in function_registry.find_ending_with(class_name)
        if kinds is None or function_registry.get(match) in kinds
    ]
    # Among same-named candidates in different files (gson's per-factory nested
    # `Adapter`), prefer one nested in the CURRENT module: a sibling/enclosing
    # nested class shadows a same-named class elsewhere, so `class Sub extends
    # Adapter` binds to its own file's Adapter, not another file's that merely
    # sorts first. Fall back to the first full-segment match otherwise. A
    # dotted name (`Outer.Inner`, a nested type through its outer) matches on
    # its whole segment sequence; `class_name in parts` could never match it
    # and left every such base unresolved (CodeRabbit, #1770).
    wanted = class_name.split(SEPARATOR_DOT)
    module_prefix = f"{module_qn}{SEPARATOR_DOT}"
    same_module = [
        match
        for match in matches
        if match.startswith(module_prefix) and _ends_with_segments(match, wanted)
    ]
    if same_module:
        return str(min(same_module, key=len))
    for match in matches:
        if _ends_with_segments(match, wanted):
            return str(match)
    return None


def _ends_with_segments(qualified_name: str, wanted: list[str]) -> bool:
    """Whether the last `len(wanted)` dotted segments of `qualified_name` are
    exactly `wanted`: a full-segment match, one segment or several."""
    parts = qualified_name.split(SEPARATOR_DOT)
    return len(parts) >= len(wanted) and parts[-len(wanted) :] == wanted


def external_stdlib_base_method_names(parent_qns: list[str]) -> frozenset[str]:
    # Method names defined by any EXTERNAL stdlib base among a class's parents
    # (`textwrap.TextWrapper` -> its full attribute set). A subclass method with
    # one of these names overrides the stdlib base and is invoked by the base's
    # machinery (click's `_wrap_chunks` via textwrap's `wrap()`), so callers mark
    # it as an external-override reachability root. Only stdlib modules are
    # imported (sys.stdlib_module_names gate): importing them is side-effect-safe
    # and requires no third-party environment.
    import importlib
    import sys

    names: set[str] = set()
    for parent_qn in parent_qns:
        module_path, _, class_name = parent_qn.rpartition(SEPARATOR_DOT)
        if not module_path or not class_name:
            continue
        top_module = module_path.split(SEPARATOR_DOT, 1)[0]
        if top_module not in sys.stdlib_module_names:
            continue
        try:
            module = importlib.import_module(module_path)
            base = getattr(module, class_name, None)
        except Exception:  # noqa: S112
            # Broad on purpose: importing a stdlib module executes its
            # module-level code, which can raise arbitrary platform-specific
            # errors; the parser must degrade to "no external base info"
            # rather than crash the indexing run.
            continue
        if isinstance(base, type):
            names.update(dir(base))
    return frozenset(names)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2886** (2026-10-04): **[Bug]: `cgr rename` refusal tells CLI users to "pass allow_heuristic" (the MCP parameter); the CLI flag is `--allow-heuristic`**
  *Symptoms*: ### What happened?  When `cgr rename` refuses because some sites are heuristic, overload fan-out or trace-only, the CLI prints:  ``` Refusing to rename <qn>: N site(s) were resolved heuristically, by overload fan-out, or only by a trace; pass allow_heuristic to rewrite through them ```  `allow_heuristic` is the MCP tool's parameter name. On the command line the option is `--allow-heuristic`, and `cgr rename … allow_heuristic` doesn't work (it's read as an extra positional argument).  ### What did you expect to happen?  The CLI message names the CLI flag: `… pass --allow-heuristic to rewrite through them`. The MCP tool keeps `allow_heuristic`.  ### Minimal reproduction  Any rename with a heuristic site, e.g. a Python method called through `self.` (see #2475):  ```bash cgr start --repo-path . --update-graph cgr rename <project>.pkg.mod.Store.get fetch --repo-path . # Refusing to rename ...: 1 site(s) were resolved heuristically, ...; pass allow_heuristic to rewrite through them ```  ### Root cause  - `codebase_rag/constants/cli.py:707-710` `RENAME_AMBIGUOUS` hard-codes `pass allow_heuristic`. - It is raised from `codebase_rag/editing/rename.py:719-722` (`RenameRefused`) and printed unchanged by the CLI in `codebase_rag/cli.py:1665-1666` (`typer.echo(str(refused), err=True)`). The MCP `rename` tool returns the same text, which is where the parameter name fits.  ### Suggested fix  Give the option name as a parameter, e.g. `RENAME_AMBIGUOUS = "… pass {option} to rewrite through th

- **Issue #2881** (2026-10-04): **[Bug]: `cgr mcp-server` adds "Hint: Make sure TARGET_REPO_PATH environment variable is set." to every configuration error, e.g. the refusal to bind HTTP to 0.0.0.0 without `MCP_HTTP_AUTH_TOKEN`**
  *Symptoms*: ### What happened?  `cgr mcp-server --transport http --host 0.0.0.0` without `MCP_HTTP_AUTH_TOKEN` is correctly refused. But the refusal ends with a hint about something else, which sends the user looking in the wrong place (here `TARGET_REPO_PATH` *was* set):  ``` $ TARGET_REPO_PATH=$PWD cgr mcp-server --transport http --host 0.0.0.0 --port 18765 Configuration Error: Refusing to bind the HTTP MCP server to 0.0.0.0: the endpoint has no authentication unless MCP_HTTP_AUTH_TOKEN is set. Configure a token to expose it beyond loopback, or bind to 127.0.0.1.  Hint: Make sure TARGET_REPO_PATH environment variable is set. $ echo $? 1 ```  ### What did you expect to happen?  The refusal on its own, or a hint about the real problem (set `MCP_HTTP_AUTH_TOKEN` or bind to `127.0.0.1`). The `TARGET_REPO_PATH` hint should only appear for errors about the repository path.  ### Minimal reproduction  ```bash env -u MCP_HTTP_AUTH_TOKEN TARGET_REPO_PATH=$PWD cgr mcp-server --transport http --host 0.0.0.0 ```  ### Root cause  `codebase_rag/cli.py:1412-1416`. The `mcp_server` command catches every `ValueError` and always prints `cs.CLI_MSG_HINT_TARGET_REPO` (`codebase_rag/constants/cli.py:202-204`) after it:  ```python except ValueError as e:     _mcp_server_notice(style(cs.CLI_ERR_CONFIG.format(error=e), cs.Color.RED))     if not settings.QUIET:         _mcp_server_notice(style(cs.CLI_MSG_HINT_TARGET_REPO, cs.Color.YELLOW))     raise typer.Exit(1) from e ```  The HTTP bind refusal (`logs.py:1022

- **Issue #2704** (2026-09-30): **[Bug]: `cgr rename` prints `ERROR … An exception occurred: .` and a two-part traceback whenever it (correctly) refuses a rename**
  *Symptoms*: ### What happened?  When `cgr rename` refuses, for example because a site was resolved heuristically (the documented safety behaviour, overridable with `--allow-heuristic`), it prints the refusal message and then:  ``` ERROR    | codebase_rag.services.graph_service:__exit__:256 - An exception occurred: . Attempting best-effort flush... Traceback (most recent call last):   File ".../codebase_rag/cli.py", line 1486, in rename_command     report = rename(   ... codebase_rag.editing.rename.RenameRefused: Refusing to rename …  The above exception was the direct cause of the following exception:  Traceback (most recent call last):   File ".../codebase_rag/cli.py", line 1502, in rename_command     raise typer.Exit(code=1) from refused typer.exceptions.Exit ```  An expected outcome, printed as the same refusal text from the MCP `rename` tool, looks like a crash on the CLI: an `ERROR` line with an empty exception message, a claimed "best-effort flush", and about 20 lines of traceback, including internal paths. `--dry-run` refusals do this too. Other commands that exit non-zero (`dead-code -n <unknown>`, `stats -n <unknown>`, `delete-project <unknown>`) exit cleanly without a traceback.  ![rename refusal traceback](https://raw.githubusercontent.com/vitali87/code-graph-rag/a3b84a47e870f11da38dd8be26358149e3182aab/issue-media/rename-refusal-traceback.gif)  ### What did you expect to happen?  The refusal message and its site list on stderr, exit code 1, and nothing else: no `ERROR` log, n
  **Post-Mortem & Fix Analysis**:
  > Closing as a duplicate of #2414: same mechanism (`typer.Exit` raised inside the ingestor context and logged by `MemgraphIngestor.__exit__`). This is just another trigger site, the `RenameRefused` handler at `cli.py:1502`. The generic `__exit__` fix in #2496 covers it. A refused `cgr rename` (repro above) would make a good extra regression case there.  --- _Generated by [Claude Code](https://claude.ai/code)_

- **Issue #2693** (2026-10-01): **[Bug]: Python `broad_except` smell fires on `except FileNotFoundError:` when its body contains a nested `except Exception`, and on `except ExceptionGroup`; typed mutable defaults are never flagged**
  *Symptoms*: ### What happened?  With `--capture findings`, the Python code-smell rules misreport in two ways.  - **`broad_except` flags specific handlers.** The regex runs over the whole `except_clause` text, including its body, and is not anchored. So:   - `except FileNotFoundError:` (line 8) is flagged because its fallback body contains a nested `try … except Exception:`. The nested-fallback shape (retry or fallback inside a handler) is common, and each such handler is reported twice: once on the outer, specific clause and once on the real one.   - `except ExceptionGroup:` (line 27) is flagged, because `except\s+Exception` also matches any name that starts with `Exception` (`ExceptionGroup`, a project's own `ExceptionalCaseError`, and so on).   - The same happens when the body only mentions the words, e.g. a comment `# don't use except Exception here`. - **`mutable_default_list` / `mutable_default_dict` miss annotated parameters.** `def merge(items: list = [], opts: dict = {})` (line 19) produces no smell. The rules match only `default_parameter`, and tree-sitter gives an annotated default the kind `typed_default_parameter`. In type-annotated code, which is most modern Python, the rule never fires.  ![broad_except on specific handlers, typed mutable defaults missed](https://raw.githubusercontent.com/vitali87/code-graph-rag/7fff8e0072576e10f2ec285cd9a5de96d297823c/issue-media/python-smell-rule-misfires.gif)  *Lines 8 and 27 are specific handlers but are reported as `broad_except`. Line 

- **Issue #2691** (2026-10-02): **[Bug]: Python security findings flag `yaml.load(..., Loader=yaml.SafeLoader)` and any call with an `execute` identifier plus an f-string; nested calls give duplicate findings**
  *Symptoms*: ### What happened?  With the `findings` capture group on, two of the Python security rules fire on safe code. Only `python.yaml` has these rules.  - **`yaml_load`** matches every `yaml.load(...)` call. `yaml.load(f, Loader=yaml.SafeLoader)` and `Loader=yaml.CSafeLoader` are reported as "yaml.load() without SafeLoader can execute arbitrary code". That is the fix the message asks for. - **`sqli_fstring`** matches any `call` node that contains, anywhere inside it, an identifier `execute` and an f-string. It does not check that `execute` is the callee or that the f-string is its argument. In the repro:   - `scheduler.submit(f"nightly-{name}", execute=True)` is flagged as SQL injection. The keyword name `execute` is enough.   - `log.info(f"checked {n} rows", cursor.execute("SELECT 1"))` is flagged, although the query is a constant.   - `results.append(cursor.execute(f"... {uid}"))` produces **two** SecurityIssue nodes on the same line: one for the real `execute` call (column 19), and a second for the enclosing `append` call (column 4). This happens because the rule matches every enclosing call.  In the repro, 5 of 8 findings are false or duplicate. Only `cfg.py:16` (`Loader=yaml.Loader`), `jobs.py:6` and one of the two `jobs.py:14` findings are real.  ![security findings on safe code](https://raw.githubusercontent.com/vitali87/code-graph-rag/c32063a313456e2ac225e27e7e8c41a587cfac36/issue-media/security-rule-false-positives.gif)  *`grep` shows the eight calls. The `HAS_VULNERABILIT

- **Issue #2675** (2026-10-01): **[Bug]: `cgr daemon up` starts Memgraph and Qdrant with vendor telemetry on, so every local index reports system and graph-size statistics off the machine without the user being told**
  *Symptoms*: ### What happened?  The stack that the README's Quick Start starts with `cgr daemon up` runs both databases with their vendors' usage telemetry **enabled**:  - **Memgraph:** `SHOW CONFIG` reports `telemetry_enabled = true`. Memgraph's own description of the flag: "We collect information about the running system (CPU and memory information) and information about the database runtime (vertex and edge counts and resource usage)." - **Qdrant:** its config has `telemetry_disabled: false`, and its log shows it trying to send a report on startup: `ERROR qdrant::common::telemetry_reporting: Failed to report telemetry … error sending request for url (https://telemetry.qdrant.io/)`. It failed here only because this machine's egress proxy rejected the TLS connection.  Nothing in cgr's docs, the compose file or `cgr daemon up`'s output mentions this. The project goes out of its way elsewhere to avoid telemetry: `docs/architecture/security.md` notes that the .NET CLI runs with `DOTNET_CLI_TELEMETRY_OPTOUT=1`. It also sells on-premise and air-gapped deployments. A user who indexes a private codebase with the default stack is sending its graph's size and the host's resource profile to two vendors without knowing it.  ![telemetry enabled in the bundled stack](https://raw.githubusercontent.com/vitali87/code-graph-rag/3720b8f/issue-media/stack-telemetry.png)  *The stack is running from `cgr daemon up`. Memgraph's `telemetry_enabled` current value is `true`. Qdrant has `telemetry_disabled: fals

- **Issue #2669** (2026-10-01): **[Bug]: `structural_replace` glues `$$$` captures together with no separator, so a JS function body becomes `…i.price)return …` (SyntaxError) and every multi-line call collapses onto one line; the MCP tool still reports "Applied"**
  *Symptoms*: ### What happened?  `structural_replace` substitutes a multi-node metavariable (`$$$NAME`) by concatenating the text of the captured nodes with `""`. Everything between them is lost: whitespace, newlines and indentation. When the nodes are statements, the result isn't just reformatted, it's broken:  - **JavaScript without semicolons** (StandardJS / ASI style): `function $F($$$P) { $$$B }` captures `const prices = items.map((i) => i.price)` and `return prices.reduce(…)` as two nodes. They come back as `…i.price)return prices.reduce(…)`, which is a `SyntaxError: Unexpected token 'return'`. This happens even when the rewrite is **identical to the pattern**. - **Every other `$$$` capture** is flattened onto one line with the spaces removed: `want_bytes(string, encoding="ascii", errors="ignore")` → `to_bytes(string,encoding="ascii",errors="ignore")`. A three-line `fetch(\n    "https://…",\n    timeout=5,\n)` → `http_get("https://…",timeout=5,)`. JS bodies with semicolons become one-liners.  With `dry_run=false`, the MCP tool writes the broken file and returns `isError: false` with "Applied: rewrote 1 file(s)". The appended structural delta raises no alarm about a file that no longer parses.  ![identity rewrite breaks a JS file](https://raw.githubusercontent.com/vitali87/code-graph-rag/3aef9cb/issue-media/sg-join.png)  *`util.js` passes `node --check`. Rewriting `function $F($$$P) { $$$B }` to **the same template** produces `…i.price)return prices…`, and `node --check` then fails w

- **Issue #2666** (2026-10-01): **[Bug]: Python parameters and locals that shadow a same-module function or method are resolved to that function as `exact`, so `cgr rename key by_priority` silently rewrites `sorted(items, key=key)` to ignore the caller's argument**
  *Symptoms*: ### What happened?  Suppose a Python function has a parameter or local variable with the same name as a function defined in its module. Every use of that parameter or local is then recorded as a CALLS or REFERENCES edge to the module-level function, labelled **`exact`**. This happens for a call (`key(item)`), a bare reference (`f = key`), a keyword argument (`sorted(items, key=key)`) and a positional argument (`map(key, items)`). A parameter named like a method of the enclosing class does the same: in `Runner.__init__(self, run)`, `self._run = run` becomes a REFERENCES edge to `Runner.run`.  Because the edges are `exact`, `cgr rename` rewrites these sites **without** `--allow-heuristic`. The result still runs, but it behaves differently. `pick(items, key)` stops using the `key` its caller passed and always sorts by priority. `cgr graph callers`, `tests-reaching` and dead-code reachability also count these phantom callers.  ![parameter uses are renamed as calls to the module function](https://raw.githubusercontent.com/vitali87/code-graph-rag/5bde634/issue-media/param-shadow.png)  *`key` in `pick` and `apply` is a parameter. `graph callers jobs.key` still lists both as `exact` callers, and `cgr rename jobs.key by_priority --dry-run` rewrites both bodies. Nothing refuses, and nothing is marked ambiguous.*  Every form produces the wrong edge (`MATCH (a)-[r:CALLS|REFERENCES]->(b)`):  | code in the function | shadowing name | edge recorded | |---|---|---| | `def apply_call(key, ite
  **Post-Mortem & Fix Analysis**:
  > The same "local binding is ignored" gap also reaches **across modules** through the simple-name trie. There the edges are labelled `heuristic` and can point into test code. A parameter or comprehension variable passed as an argument is looked up by its bare name anywhere in the project, even when the only same-named definition is a function nested inside a test in a file the caller never imports.  ```python # lib/items.py class Item:     def __init__(self, value):         self.value = value   def wrap(values):     return [Item(c) for c in values]       # c: comprehension variable   def first(b, sink):     sink.write(b)                           # b: parameter     return Item(b) ``` ```python # tests/test_chain.py   (not imported by lib) def test_chain():     def b():         pass      def c():         pass      return b, c ```  Result, identical with `PYTHON_FRONTEND=heuristic` and `=jedi` (main @ 83ffd51):  | site | edge | |---|---| | `wrap`, line 7 `Item(c)` | REFERENCES → `tests.tes

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

### Incident Patch 1: `9c6cdaf0` (2026-10-05)
**Commit Message**: Merge pull request #3068 from vitali87/claude/ci-timeouts-grown-suite

ci: give the unit-test and SonarCloud jobs room for the grown suite

**File**: `.github/workflows/ci.yml` (modified, +24/-9)
```diff
@@ -124,10 +124,10 @@ jobs:
   test-unit:
     name: Unit Tests (${{ matrix.os }}, py${{ matrix.python-version }})
     runs-on: ${{ matrix.os }}
-    # Slow runners (ubuntu/windows py3.13) can exceed 20 min on the full -n auto
-    # suite and hit the cap as a spurious CANCELLED; 30 min absorbs the variance
-    # while still bounding a genuine hang.
-    timeout-minutes: 30
+    # The full -n auto suite now takes 25-30 min on Windows and on macOS with
+    # coverage, so a 30 min cap cancelled healthy runs mid-suite (a spurious
+    # CANCELLED); 45 min absorbs slow runners while still bounding a hang.
+    timeout-minutes: 45
     strategy:
       fail-fast: false
       matrix:
@@ -485,7 +485,10 @@ jobs:
       && github.event.pull_request.base.ref == 'main'
       && github.event.pull_request.user.login != 'dependabot[bot]'
       && github.event.pull_request.head.repo.full_name == github.repository
-    timeout-minutes: 45
+    # The polling loop below does the waiting (it holds out for as long as
+    # SonarCloud Analysis is queued or running); this cap only bounds a hang,
+    # and covers that job's 50 min cap, a late start and the publish window.
+    timeout-minutes: 90
     permissions:
       # checks: read backs the check-runs API call that detects a failed
       # SonarCloud Analysis job, so the gate fails fast instead of waiting
@@ -511,8 +514,13 @@ jobs:
           # positive) in the SonarCloud UI. Both endpoints are public for
           # public projects, so no token is needed. Analysis lands minutes
           # after the SonarCloud Analysis job finishes, so poll until the
-          # reported analyzed commit is this exact commit.
-          deadline=$(( $(date +%s) + 2400 ))
+          # reported analyzed commit is this exact commit. The window for
+          # publishing restarts while the analysis job is queued or running,
+          # so a job that starts late or runs long is not cut short (within
+          # this job's own cap); the first deadline covers a job that never
+          # shows up at all.
+          publish_window=900
+          deadline=$(( $(date +%s) + 3600 ))
           while :; do
             analyzed=$(curl -sf "https://sonarcloud.io/api/project_pull_requests/list?project=$PROJECT_KEY" \
               | jq -r --arg pr "$PR" \
@@ -543,9 +551,12 @@ jobs:
               # started_at null while queued, which jq sorts before every
               # real timestamp, so only the completed runs are ranked and
               # any active run suppresses the fast fail until it finishes.
+              # An unreadable check-runs reply (rate limit, outage) is null,
+              # which jq cannot iterate, so `active` falls back to 1 and the
+              # verdict stays open instead of reading as "no job".
               runs=$(gh api "repos/$REPO/commits/$HEAD_SHA/check-runs?per_page=100" \
                 --jq '[.check_runs[] | select(.name == "SonarCloud Analysis")]' \
-                2>/dev/null || echo '[]')
+                2>/dev/null || echo 'null')
               active=$(printf '%s' "$runs" \
                 | jq '[.[] | select(.status != "completed")] | length' \
                 2>/dev/null || echo 1)
@@ -559,10 +570,14 @@ jobs:
                 echo "Fix or re-run SonarCloud Analysis, then re-run this job."
                 exit 1
               fi
+              if [ "$active" != "0" ]; then
+                held=$(( $(date +%s) + publish_window ))
+                if [ "$held" -gt "$deadline" ]; then deadline=$held; fi
+              fi
               echo "No SonarCloud analysis of $HEAD_SHA yet (last analyzed: ${analyzed:-none}), waiting ..."
             fi
             if [ "$(date +%s)" -ge "$deadline" ]; then
-              echo "❌ No SonarCloud analysis of $HEAD_SHA appeared within 40 minutes."
+              echo "❌ No SonarCloud analysis of $HEAD_SHA appeared within $(( publish_window / 60 )) min of SonarCloud Analysis finishing (or 60 min with no such job)."
               echo "Check the SonarCloud Analysis job, then re-run this job."
               exit 1
             fi
```

**File**: `.github/workflows/sonarcloud.yml` (modified, +3/-1)
```diff
@@ -23,7 +23,9 @@ jobs:
     # ci.yml mirrors this condition, so both must key on the same field.
     if: github.event_name == 'push' || (github.event.pull_request.user.login != 'dependabot[bot]' && github.event.pull_request.head.repo.full_name == github.repository)
     runs-on: ubuntu-latest
-    timeout-minutes: 30
+    # The coverage run of the full suite alone takes about 28 min, so a 30 min
+    # cap cut the scan off and the Sonar gate never saw an analysis.
+    timeout-minutes: 50
 
     steps:
       - name: Checkout code
```

---

### Incident Patch 2: `88b26fd3` (2026-10-05)
**Commit Message**: ci: give the unit-test and SonarCloud jobs room for the grown suite

Unit Tests on Windows and on macOS with coverage now run 25-30 min and were cancelled at the 30 min cap mid-suite; the SonarCloud Analysis coverage run alone takes about 28 min, so its 30 min cap cut off the scan and the Sonar gate never saw an analysis. Raise them to 45 and 50 min.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01NA8ea1a3KkMTaa9FAp5qve

**File**: `.github/workflows/ci.yml` (modified, +4/-4)
```diff
@@ -124,10 +124,10 @@ jobs:
   test-unit:
     name: Unit Tests (${{ matrix.os }}, py${{ matrix.python-version }})
     runs-on: ${{ matrix.os }}
-    # Slow runners (ubuntu/windows py3.13) can exceed 20 min on the full -n auto
-    # suite and hit the cap as a spurious CANCELLED; 30 min absorbs the variance
-    # while still bounding a genuine hang.
-    timeout-minutes: 30
+    # The full -n auto suite now takes 25-30 min on Windows and on macOS with
+    # coverage, so a 30 min cap cancelled healthy runs mid-suite (a spurious
+    # CANCELLED); 45 min absorbs slow runners while still bounding a hang.
+    timeout-minutes: 45
     strategy:
       fail-fast: false
       matrix:
```

**File**: `.github/workflows/sonarcloud.yml` (modified, +3/-1)
```diff
@@ -23,7 +23,9 @@ jobs:
     # ci.yml mirrors this condition, so both must key on the same field.
     if: github.event_name == 'push' || (github.event.pull_request.user.login != 'dependabot[bot]' && github.event.pull_request.head.repo.full_name == github.repository)
     runs-on: ubuntu-latest
-    timeout-minutes: 30
+    # The coverage run of the full suite alone takes about 28 min, so a 30 min
+    # cap cut the scan off and the Sonar gate never saw an analysis.
+    timeout-minutes: 50
 
     steps:
       - name: Checkout code
```

---

### Incident Patch 3: `597643a4` (2026-10-04)
**Commit Message**: Merge pull request #2677 from xujiantop-crypto/fix/quiet-logs-stderr

fix(cli): keep quiet error logs on stderr

**File**: `codebase_rag/cli.py` (modified, +1/-1)
```diff
@@ -256,7 +256,7 @@ def _global_options(
     if quiet:
         logger.remove()
         logger.add(
-            lambda msg: app_context.console.print(msg, end=""),
+            sys.stderr,
             level="ERROR",
             backtrace=False,
             diagnose=False,
```

**File**: `codebase_rag/tests/test_cli_quiet_logging.py` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+"""Quiet CLI logging must not contaminate command output."""
+
+import subprocess
+import sys
+from pathlib import Path
+
+
+def test_quiet_error_log_stays_on_stderr() -> None:
+    repo_root = Path(__file__).parents[2]
+    probe = (
+        "from codebase_rag.cli import _global_options\n"
+        "from loguru import logger\n"
+        "_global_options(quiet=True, version=None)\n"
+        "logger.error('quiet-route-marker')\n"
+    )
+
+    result = subprocess.run(
+        [sys.executable, "-c", probe],
+        cwd=repo_root,
+        capture_output=True,
+        text=True,
+        encoding="utf-8",
+        timeout=120,
+        check=True,
+    )
+
+    assert "quiet-route-marker" in result.stderr
+    assert result.stdout == ""
```

**File**: `codebase_rag/tests/test_log_sinks_no_diagnose.py` (modified, +4/-4)
```diff
@@ -8,11 +8,11 @@
 import ast
 import io
 from collections.abc import Generator
+from contextlib import redirect_stderr
 from pathlib import Path
 
 import pytest
 from loguru import logger
-from rich.console import Console
 
 from codebase_rag import cli
 from codebase_rag import main as cgr_main
@@ -116,8 +116,8 @@ def test_the_chat_sink_keeps_the_secret_out(
 @pytest.mark.usefixtures("_clean_logger")
 def test_the_quiet_sink_keeps_the_secret_out(monkeypatch: pytest.MonkeyPatch) -> None:
     buffer = io.StringIO()
-    monkeypatch.setattr(cli.app_context, "console", Console(file=buffer, width=200))
     monkeypatch.setattr(cli.settings, "QUIET", cli.settings.QUIET)
-    cli._global_options(version=None, quiet=True)
-    _log_a_failure_holding_the_secret()
+    with redirect_stderr(buffer):
+        cli._global_options(version=None, quiet=True)
+        _log_a_failure_holding_the_secret()
     _assert_logged_without_the_secret(buffer.getvalue())
```

---

### Incident Patch 4: `07201e5e` (2026-10-04)
**Commit Message**: Merge pull request #2794 from vitali87/claude/cpp-builtin-operators-2554

fix(cpp): bind operator expressions only through an operand of class type

**File**: `codebase_rag/constants/ast_cpp.py` (modified, +27/-0)
```diff
@@ -20,6 +20,10 @@ class CppNodeType(StrEnum):
     FUNCTION_DECLARATOR = "function_declarator"
     VARIADIC_PARAMETER = "variadic_parameter"
     POINTER_DECLARATOR = "pointer_declarator"
+    ARRAY_DECLARATOR = "array_declarator"
+    ABSTRACT_POINTER_DECLARATOR = "abstract_pointer_declarator"
+    ABSTRACT_ARRAY_DECLARATOR = "abstract_array_declarator"
+    FIELD_DECLARATION_LIST = "field_declaration_list"
     REFERENCE_DECLARATOR = "reference_declarator"
     # An attribute MACRO before a definition (`JSON_HEDLEY_NON_NULL(3)
     # bool sax_parse(...)`) parses as a parenthesized_declarator wrapping
@@ -211,6 +215,29 @@ class CppNodeType(StrEnum):
 # `operator` field. Only address-of names a function it hands over.
 TS_CPP_POINTER_EXPRESSION = "pointer_expression"
 CPP_ADDRESS_OF = "&"
+CPP_DEREFERENCE = "*"
+# Declarators that put a pointer or an array between a declared type and its
+# name (or its unnamed slot): it holds an address, not a value of that type.
+CPP_INDIRECT_DECLARATOR_TYPES = frozenset(
+    {
+        CppNodeType.POINTER_DECLARATOR,
+        CppNodeType.ARRAY_DECLARATOR,
+        CppNodeType.ABSTRACT_POINTER_DECLARATOR,
+        CppNodeType.ABSTRACT_ARRAY_DECLARATOR,
+    }
+)
+# Parameter declarations a C++ parameter list holds, a pack among them.
+CPP_PARAMETER_DECLARATION_TYPES = frozenset(
+    {
+        CppNodeType.PARAMETER_DECLARATION,
+        CppNodeType.OPTIONAL_PARAMETER_DECLARATION,
+        CppNodeType.VARIADIC_PARAMETER_DECLARATION,
+    }
+)
+# The nodes a free function is declared by: a definition or a prototype.
+CPP_FREE_FUNCTION_DECLARATION_TYPES = frozenset(
+    {CppNodeType.FUNCTION_DEFINITION, CppNodeType.DECLARATION}
+)
 # `return {args};` -- a braced construction of the declared return type.
 TS_CPP_INITIALIZER_LIST = "initializer_list"
 # Stream-insertion operator; a `binary_expression` using it whose left-spine base
```

**File**: `codebase_rag/parsers/call_processor.py` (modified, +118/-32)
```diff
@@ -174,6 +174,7 @@ class _CallScanContext:
     alias_map: dict[str, str] | None = None
     factory_aliases: dict[str, str] | None = None
     cpp_local_aliases: dict[str, list[tuple[str, int, int]]] | None = None
+    cpp_indirection: dict[str, int] | None = None
 
 
 _TYPED_LANGUAGES = frozenset(
@@ -310,6 +311,22 @@ class _ReceiverDeclaration(NamedTuple):
 _CHAIN_SPINE_WALK_LIMIT = cs.MAX_RECEIVER_CHAIN_HOPS * 8
 
 
+def _cpp_without_parentheses(operand: Node | None) -> Node | None:
+    """`(a)` and `((a))` as `a`."""
+    while operand is not None and operand.type == cs.TS_PARENTHESIZED_EXPRESSION:
+        operand = operand.named_children[0] if operand.named_children else None
+    return operand
+
+
+def _is_cpp_dereference(operand: Node) -> bool:
+    """Whether `operand` is `*p`, as opposed to another pointer expression (`&a`)."""
+    return (
+        operand.type == cs.TS_CPP_POINTER_EXPRESSION
+        and safe_decode_text(operand.child_by_field_name(cs.FIELD_OPERATOR))
+        == cs.CPP_DEREFERENCE
+    )
+
+
 def _exceeds_receiver_chain_cap(call_node: Node) -> bool:
     """Whether `call_node` ends a receiver chain of too many calls (#2262).
 
@@ -3575,20 +3592,94 @@ def _overlay_span_binding(
             return local_var_types
         return {**local_var_types, base: best[1]}
 
-    def _cpp_operator_operand_name(self, call_node: Node) -> str | None:
-        # The receiver-analog operand of an operator expression: the LEFT
-        # side of a binary op, the sole argument of a unary/update op. Only
-        # a bare identifier is returned; anything more complex stays with
-        # the legacy paths.
-        field = (
-            cs.FIELD_LEFT
-            if call_node.type == cs.TS_CPP_BINARY_EXPRESSION
-            else cs.TS_FIELD_ARGUMENT
-        )
-        operand = call_node.child_by_field_name(field)
+    def _cpp_operator_callee(
+        self,
+        ctx: _CallScanContext,
+        call_node: Node,
+        call_name: str,
+        var_types: dict[str, str] | None,
+    ) -> tuple[str, str] | None:
+        # The left operand (the sole one of a unary/update op) selects a
+        # member or a free overload. The right one selects only a free
+        # overload (`os << v`, `2 * v`): a member operator takes its own
+        # class on the left. A free overload takes every operand as a
+        # parameter, plus the dummy `int` that marks a postfix `v++`.
+        if call_node.type == cs.TS_CPP_BINARY_EXPRESSION:
+            operands = (
+                call_node.child_by_field_name(cs.FIELD_LEFT),
+                call_node.child_by_field_name(cs.FIELD_RIGHT),
+            )
+            arity = 2
+        else:
+            argument = call_node.child_by_field_name(cs.TS_FIELD_ARGUMENT)
+            operator = call_node.child_by_field_name(cs.FIELD_OPERATOR)
+            operands = (argument,)
+            arity = (
+                2
+                if argument is not None
+                and operator is not None
+                and operator.start_byte > argument.start_byte
+                else 1
+            )
+        resolver = self._resolver
+        for position, operand in enumerate(operands):
+            if (class_qn := self._cpp_operand_class(ctx, operand, var_types)) is None:
+                continue
+            if position == 0 and (
+                member := resolver.cpp_member_operator(call_name, class_qn)
+            ):
+                return member
+            if free := resolver.cpp_free_operator_for_type(
+                call_name, class_qn, position, arity
+            ):
+                return free
+        return None
+
+    def _cpp_operand_class(
+        self,
+        ctx: _CallScanContext,
+        operand: Node | None,
+        var_types: dict[str, str] | None,
+    ) -> str | None:
+        # The registered class an operand is a value of: a local or
+        # parameter of that type (not a pointer or array of it), `*p` on a
+        # single pointer to it, or `*this`. A field, a call result or a
+        # literal is never typed here, so it selects no overload.
+        operand = _cpp_without_parentheses(operand)
+        depth = 0
+        if operand is not None and _is_cpp_dereference(operand):
+            operand = operand.child_by_field_name(cs.TS_FIELD_ARGUMENT)
+            depth = 1
+            if operand is not None and operand.type == cs.CppNodeType.THIS:
+                return self._cpp_this_class(ctx)
         if operand is None or operand.type != cs.TS_IDENTIFIER:
             return None
-        return safe_decode_text(operand)
+        return self._cpp_variable_class(ctx, operand, depth, var_types)
+
+    def _cpp_this_class(self, ctx: _CallScanContext) -> str | None:
+        # `*this`: the enclosing class, when it is a registered one.
+        class_qn = ctx.class_context
+        if class_qn and class_qn in self._resolver.function_registry:
+            return class_qn
+        return None
+
+    def _cpp_varia
```

**File**: `codebase_rag/parsers/call_resolver.py` (modified, +107/-14)
```diff
@@ -12,11 +12,13 @@
 from .. import constants as cs
 from .. import logs as ls
 from ..language_spec import get_language_for_extension
-from ..types_defs import FunctionRegistryTrieProtocol, NodeType
+from ..types_defs import CppOperatorSignature, FunctionRegistryTrieProtocol, NodeType
 from ..utils import qn_markers
+from .cpp import utils as cpp_utils
 from .import_processor import ImportProcessor
 from .js_ts import utils as js_ts_utils
 from .lua import utils as lua_utils
+from .parameter_nodes import c_family_parameter_list
 from .py import resolve_class_name
 from .rs import utils as rs_utils
 from .semantic_call_join import call_site_key, declared_location
@@ -271,6 +273,7 @@ class CallResolver:
         "_subclass_map_cache",
         "_protocol_classes_cache",
         "_struct_impl_cache",
+        "_cpp_free_operators",
         "_ctor_params",
         "_ctor_param_attrs",
         "_pending_field_bindings",
@@ -335,6 +338,10 @@ def __init__(
         self._subclass_map_cache: dict[str, set[str]] | None = None
         self._protocol_classes_cache: set[str] | None = None
         self._struct_impl_cache: dict[str, set[str]] = {}
+        # {module qn: {free operator qn: its declarations' signatures}}.
+        self._cpp_free_operators: dict[
+            str, dict[str, tuple[CppOperatorSignature, ...]]
+        ] = {}
         # Ordered constructor parameter names per class (explicit __init__
         # params, or annotated class-body fields for NamedTuple/dataclass),
         # plus the param -> stored-attribute renames found in __init__ bodies
@@ -537,6 +544,7 @@ def reset_resolution_caches(self) -> None:
         self._subclass_map_cache = None
         self._protocol_classes_cache = None
         self._struct_impl_cache.clear()
+        self._cpp_free_operators.clear()
         # The qn -> language memo goes too: after a same-stem replacement
         # across languages (`util.rs` deleted, `util.py` added) the bare qn
         # `proj.util` now names a Python module, and a stale RUST answer
@@ -4598,30 +4606,116 @@ def resolve_builtin_call(self, call_name: str) -> tuple[str, str] | None:
 
         return None
 
-    def cpp_operator_for_type(
+    def cpp_member_operator(
         self, call_name: str, operand_type_qn: str
     ) -> tuple[str, str] | None:
         # Operand-type-directed operator binding: the overload is either a
-        # member of the operand's own class or a free overload in that
-        # class's module (the beside-the-class convention). A typed operand
-        # with NEITHER is a builtin operation (enum/int comparison) with no
-        # first-party callee; nlohmann's `token == token_type::x` must
-        # not rebind to an unrelated class's operator== and fan out to all
-        # its overload variants.
+        # member of the operand's own class or a free overload beside it. A
+        # typed operand with NEITHER is a builtin operation (enum/int
+        # comparison) with no first-party callee; nlohmann's
+        # `token == token_type::x` must not rebind to an unrelated class's
+        # operator== and fan out to all its overload variants.
         # _try_resolve_method covers both the direct member and one
         # INHERITED from a base (Derived : Base with Base::operator==).
-        if member := self._try_resolve_method(operand_type_qn, call_name):
-            return member
+        return self._try_resolve_method(operand_type_qn, call_name)
+
+    def cpp_free_operator_for_type(
+        self, call_name: str, operand_type_qn: str, position: int, arity: int
+    ) -> tuple[str, str] | None:
         # ADL: a free overload may live in ANY enclosing namespace of the
-        # operand's type, not only its immediate parent scope.
+        # operand's type, not only its immediate parent scope. Sharing the
+        # name is not enough: `1 + v` with V converting to int is built-in
+        # `+` even beside an unrelated `operator+(W, W)`, so an overload set
+        # counts only when one of its declarations takes the operand's class
+        # at the operand's position (issue #2554 review).
         parts = operand_type_qn.split(cs.SEPARATOR_DOT)
         for depth in range(len(parts) - 1, 0, -1):
             scope = cs.SEPARATOR_DOT.join(parts[:depth])
             free_qn = f"{scope}{cs.SEPARATOR_DOT}{call_name}"
-            if free_qn in self.function_registry:
+            if free_qn in self.function_registry and any(
+                self._cpp_operator_accepts(signature, operand_type_qn, position, arity)
+                for signature in self._cpp_free_operator_signatures(free_qn)
+            ):
                 return (self.function_registry[free_qn], free_qn)
         return None
 
+    def _cpp_operator_accepts(
+        self,
+        signature: CppOperatorSignature,
+        operand_type_qn: str,
+        position: int,
+        arity: int,
+    ) -> bool:
+        # The parameter at the operand's position takes its class by value
+        #
```

**File**: `codebase_rag/parsers/cpp/type_inference.py` (modified, +72/-22)
```diff
@@ -1,8 +1,11 @@
 from __future__ import annotations
 
+from collections.abc import Iterator
+
 from tree_sitter import Node
 
 from ... import constants as cs
+from ...types_defs import CppParameterType
 from ..utils import safe_decode_text
 
 
@@ -18,10 +21,8 @@ class CppTypeInferenceEngine:
 
     def build_local_variable_type_map(self, caller_node: Node) -> dict[str, str]:
         decls: list[tuple[str, str]] = []
-        if declarator := self._function_declarator(caller_node):
-            self._collect_parameters(declarator, decls)
-        if body := caller_node.child_by_field_name(cs.FIELD_BODY):
-            self._collect_body_declarations(body, decls)
+        for declaration in self._local_declarations(caller_node):
+            self._record_declaration(declaration, decls)
         # The map is keyed by name only, with no knowledge of a call's lexical
         # position, so it cannot tell an outer `Zeta z` from an inner-block
         # `Alpha z` that shadows it. Rather than pick a write order wrong for
@@ -42,6 +43,22 @@ def build_local_variable_type_map(self, caller_node: Node) -> dict[str, str]:
             var_types[name] = type_name
         return var_types
 
+    def build_indirection_map(self, caller_node: Node) -> dict[str, int]:
+        # The type map strips `*` and `[]` so `p->m()` dispatches on the
+        # pointee, but an operator applied to `p` itself (`p == nullptr`,
+        # `++p`, `arr + 1`) is built-in pointer arithmetic that no class
+        # overload can serve (issue #2554). Maps each local declared through
+        # pointers or arrays to that depth; a name declared at several depths
+        # keeps the deepest, so its value form is never assumed.
+        depths: dict[str, int] = {}
+        for declaration in self._local_declarations(caller_node):
+            for declarator in declaration.children_by_field_name(cs.FIELD_DECLARATOR):
+                if (depth := self._indirection_depth(declarator)) and (
+                    name := self._declarator_name(declarator)
+                ):
+                    depths[name] = max(depth, depths.get(name, 0))
+        return depths
+
     def collect_type_aliases(
         self, root_node: Node, aliases: dict[str, str], conflicts: set[str]
     ) -> None:
@@ -254,35 +271,32 @@ def _function_declarator(self, caller_node: Node) -> Node | None:
             declarator = declarator.child_by_field_name(cs.FIELD_DECLARATOR)
         return None
 
-    def _collect_parameters(
-        self, declarator: Node, decls: list[tuple[str, str]]
-    ) -> None:
-        params = declarator.child_by_field_name(cs.KEY_PARAMETERS)
-        if params is None:
-            return
-        for param in params.children:
-            if param.type not in (
-                cs.CppNodeType.PARAMETER_DECLARATION,
-                cs.CppNodeType.OPTIONAL_PARAMETER_DECLARATION,
-            ):
-                continue
-            self._record_declaration(param, decls)
+    def _local_declarations(self, caller_node: Node) -> Iterator[Node]:
+        if (declarator := self._function_declarator(caller_node)) and (
+            params := declarator.child_by_field_name(cs.KEY_PARAMETERS)
+        ):
+            for param in params.children:
+                if param.type in (
+                    cs.CppNodeType.PARAMETER_DECLARATION,
+                    cs.CppNodeType.OPTIONAL_PARAMETER_DECLARATION,
+                ):
+                    yield param
+        if body := caller_node.child_by_field_name(cs.FIELD_BODY):
+            yield from self._body_declarations(body)
 
-    def _collect_body_declarations(
-        self, node: Node, decls: list[tuple[str, str]]
-    ) -> None:
+    def _body_declarations(self, node: Node) -> Iterator[Node]:
         for child in node.children:
             # A lambda / nested function / local class body opens its own scope;
             # its declarations are not locals of the enclosing function, so stop
             # here or an inner `x` would be attributed to the outer `x`.
             if child.type in cs.CPP_NESTED_SCOPE_NODE_TYPES:
                 continue
             if child.type == cs.CppNodeType.DECLARATION:
-                self._record_declaration(child, decls)
+                yield child
             # Recurse into ordinary nested blocks (if/for/while/try bodies) so a
             # variable declared only in an inner block still resolves; conflicting
             # redecls across scopes are reconciled by the caller (drop-on-conflict).
-            self._collect_body_declarations(child, decls)
+            yield from self._body_declarations(child)
 
     def _record_declaration(self, node: Node, decls: list[tuple[str, str]]) -> None:
         type_node = node.child_by_field_name(cs.FIELD_TYPE)
@@ -339,6 +353,42 @@ def _declarator_name(self, declarator: Node | None) -> str | None:
             current = self._first_declarator_child(current)
         return None
 
+    def parameter_types(self, pa
```

**File**: `codebase_rag/parsers/parameter_nodes.py` (modified, +3/-10)
```diff
@@ -300,13 +300,6 @@ def _js_ts_typed_slot(node: Node, slots: _Slots) -> None:
 
 # --- C / C++ -----------------------------------------------------------------
 
-_C_FAMILY_PARAMETER_DECLARATIONS = frozenset(
-    {
-        cs.CppNodeType.PARAMETER_DECLARATION,
-        cs.CppNodeType.OPTIONAL_PARAMETER_DECLARATION,
-        cs.CppNodeType.VARIADIC_PARAMETER_DECLARATION,
-    }
-)
 _C_FAMILY_DEFINITIONS = frozenset(
     {cs.CppNodeType.FUNCTION_DEFINITION, cs.TS_CPP_DECLARATION}
 )
@@ -321,14 +314,14 @@ def c_cpp_declared_parameters(func_node: Node) -> list[DeclaredParameter]:
     `extract_type_facts` gives a C/C++ return type. A C `...` and an unnamed
     parameter keep their positions; a pack (`Args&&... args`) is one variadic
     slot. A C++ C-style `...` is an anonymous token and takes no position."""
-    params = _c_family_parameter_list(func_node)
+    params = c_family_parameter_list(func_node)
     if params is None:
         return []
     slots = _Slots()
     for decl in params.named_children:
         if decl.type == cs.CppNodeType.VARIADIC_PARAMETER:
             slots.skip()
-        elif decl.type in _C_FAMILY_PARAMETER_DECLARATIONS:
+        elif decl.type in cs.CPP_PARAMETER_DECLARATION_TYPES:
             slots.add(
                 _c_family_name_node(decl.child_by_field_name(cs.FIELD_DECLARATOR)),
                 _field_type_text(decl),
@@ -338,7 +331,7 @@ def c_cpp_declared_parameters(func_node: Node) -> list[DeclaredParameter]:
     return slots.declared
 
 
-def _c_family_parameter_list(func_node: Node) -> Node | None:
+def c_family_parameter_list(func_node: Node) -> Node | None:
     node = func_node
     if node.type == cs.TS_CPP_TEMPLATE_DECLARATION:
         # `template<...> void f(...)`: the definition is the wrapped child.
```

**File**: `codebase_rag/tests/test_cpp_builtin_operator_calls.py` (added, +442/-0)
```diff
@@ -0,0 +1,442 @@
+# Issue #2554: every C++ binary/unary/update expression is named as a call to
+# its operator (`a + b` -> operator_plus). When the operands are built-in
+# (int, double, bool, pointers) there is no overload to find, yet the name was
+# still resolved: by bare name to ANY project type overloading that operator
+# (heuristic, 29% of fmt's CALLS, 573 library->test edges), or, inside the
+# class that defines the operator, through the class scope to its own
+# overload (exact, a fake self-recursion from `x + o.x` on `int` fields). An
+# operator expression binds only through an operand whose type is a known
+# first-party class with that overload; anything else emits no edge.
+from __future__ import annotations
+
+from pathlib import Path
+from unittest.mock import MagicMock
+
+import pytest
+
+from codebase_rag import constants as cs
+from codebase_rag.tests.conftest import create_and_run_updater, get_relationships
+
+MONEY_H = """struct Money {
+  long cents;
+  Money operator+(const Money& o) const { return Money{cents + o.cents}; }
+  bool operator<(const Money& o) const { return cents < o.cents; }
+  bool operator==(const Money& o) const { return cents == o.cents; }
+  bool operator!=(const Money& o) const { return !(*this == o); }
+  Money& operator=(const Money& o) {
+    if (this == &o) return *this;
+    cents = o.cents;
+    return *this;
+  }
+};
+"""
+
+ASSERTION_H = """struct AssertionResult {
+  bool ok;
+  AssertionResult operator!() const { return AssertionResult{!ok}; }
+  AssertionResult& operator++() { return *this; }
+};
+"""
+
+UTIL_CPP = """#include "money.h"
+int add(int a, int b) { return a + b; }
+bool less(double x, double y) { return x < y; }
+bool neg(bool v) { return !v; }
+int bump(int i) { return ++i; }
+Money sum(Money a, Money b) { return a + b; }
+bool before(const Money& a, const Money& b) { return a < b; }
+"""
+
+VEC_HPP = """struct Vec {
+    int x, y;
+    Vec operator+(const Vec& o) const { return Vec{x + o.x, y + o.y}; }
+    int dot(const Vec& o) const { return x * o.x + y * o.y; }
+};
+"""
+
+
+def _calls(mock_ingestor: MagicMock) -> list[tuple[str, str, str]]:
+    edges = []
+    for call in get_relationships(mock_ingestor, cs.RelationshipType.CALLS.value):
+        props = call.kwargs.get("properties") or (
+            call.args[3] if len(call.args) > 3 else {}
+        )
+        edges.append(
+            (
+                str(call.args[0][2]),
+                str(call.args[2][2]),
+                str((props or {}).get(cs.KEY_RESOLUTION)),
+            )
+        )
+    return edges
+
+
+def _operator_calls_from(
+    edges: list[tuple[str, str, str]], caller: str
+) -> list[tuple[str, str]]:
+    return [
+        (callee, resolution)
+        for src, callee, resolution in edges
+        if src == caller and callee.rsplit(".", 1)[-1].startswith("operator_")
+    ]
+
+
+def _index(temp_repo: Path, mock_ingestor: MagicMock, files: dict[str, str]) -> None:
+    for rel_path, source in files.items():
+        path = temp_repo / rel_path
+        path.parent.mkdir(parents=True, exist_ok=True)
+        path.write_text(source, encoding="utf-8")
+    create_and_run_updater(temp_repo, mock_ingestor, skip_if_missing="cpp")
+
+
+@pytest.fixture
+def issue_repo_calls(
+    temp_repo: Path, mock_ingestor: MagicMock
+) -> tuple[str, list[tuple[str, str, str]]]:
+    _index(
+        temp_repo,
+        mock_ingestor,
+        {
+            "money.h": MONEY_H,
+            "test/assertion.h": ASSERTION_H,
+            "util.cpp": UTIL_CPP,
+        },
+    )
+    return temp_repo.name, _calls(mock_ingestor)
+
+
+@pytest.mark.parametrize("caller", ["add", "less", "neg", "bump"])
+def test_builtin_operand_binds_no_operator_overload(
+    issue_repo_calls: tuple[str, list[tuple[str, str, str]]], caller: str
+) -> None:
+    project, edges = issue_repo_calls
+    assert _operator_calls_from(edges, f"{project}.util.{caller}") == []
+
+
+def test_builtin_operator_does_not_reach_a_test_helper(
+    issue_repo_calls: tuple[str, list[tuple[str, str, str]]],
+) -> None:
+    project, edges = issue_repo_calls
+    library_to_test = [
+        (src, dst)
+        for src, dst, _ in edges
+        if src.startswith(f"{project}.util.") and dst.startswith(f"{project}.test.")
+    ]
+    assert library_to_test == []
+
+
+def test_builtin_member_field_arithmetic_is_no_self_call(
+    issue_repo_calls: tuple[str, list[tuple[str, str, str]]],
+) -> None:
+    # `cents + o.cents` / `cents < o.cents` / `!ok` on built-in fields.
+    project, edges = issue_repo_calls
+    for method in ("operator_plus", "operator_less", "operator_equal"):
+        caller = f"{project}.money.Money.{method}"
+        assert _operator_calls_from(edges, caller) == [], caller
+    helper = f"{project}.test.assertion.AssertionResult.operator_not"
+    assert _operator_calls_from(edges, helper) == []
+
+
+def test_pointer_comparison_with_this_binds_nothing(
+    issue_repo_calls: tuple[str, list[tu
```

**File**: `codebase_rag/tests/test_cpp_operator_operand_binding.py` (modified, +8/-7)
```diff
@@ -4,8 +4,9 @@
 # every duplicate-qn overload variant (9 edges of pure noise). When the
 # left operand's type is KNOWN, the operator must bind only to that type's
 # own operator (member, or a free overload in the type's module) or emit
-# nothing at all; only an UNTYPED operand keeps the old best-candidate
-# behaviour so no existing edge drops.
+# nothing at all. An UNTYPED operand emits nothing either (issue #2554):
+# the old best-candidate fallback bound built-in arithmetic to any
+# same-named overload in the project.
 from pathlib import Path
 
 from evals.cgr_graph import _capture
@@ -86,10 +87,10 @@ def test_typed_operand_binds_free_operator_in_type_module(tmp_path: Path) -> Non
     assert ("proj.free.driver", "proj.free.Aaa.operator_equal") not in calls
 
 
-def test_untyped_operand_keeps_existing_binding(tmp_path: Path) -> None:
-    # fmt regression guard shape: an operand the type inference cannot see
-    # (a macro-produced expression) must keep the pre-existing
-    # best-candidate behaviour rather than dropping edges wholesale.
+def test_untyped_operand_binds_nothing(tmp_path: Path) -> None:
+    # An operand the type inference cannot see (a macro-produced
+    # expression) gives no type to select an overload with, so binding the
+    # project's only operator== by name would be a guess (issue #2554).
     (tmp_path / "keep.hpp").write_text(
         "struct Only {\n"
         "    bool operator==(const Only& rhs) const { return true; }\n"
@@ -100,7 +101,7 @@ def test_untyped_operand_keeps_existing_binding(tmp_path: Path) -> None:
         encoding="utf-8",
     )
     calls = _calls(tmp_path)
-    assert ("proj.keep.driver", "proj.keep.Only.operator_equal") in calls, sorted(
+    assert ("proj.keep.driver", "proj.keep.Only.operator_equal") not in calls, sorted(
         c for c in calls if "operator" in c[1]
     )
 
```

**File**: `codebase_rag/types_defs.py` (modified, +15/-0)
```diff
@@ -828,6 +828,21 @@ class FunctionLocation(NamedTuple):
     is_named: bool = True
 
 
+class CppParameterType(NamedTuple):
+    """A C++ parameter's bare type name and its pointer/array depth."""
+
+    type_name: str | None
+    indirection: int
+
+
+class CppOperatorSignature(NamedTuple):
+    """What overload viability reads from a free C++ operator's declaration."""
+
+    module_qn: str
+    parameters: tuple[CppParameterType, ...]
+    template_params: frozenset[str]
+
+
 # The source `dict.update` reads as a mapping: anything with keys() and
 # indexing, which is wider than Mapping.
 class KeysAndGetItem[KT, VT](Protocol):
```

---

### Incident Patch 5: `db30090d` (2026-10-04)
**Commit Message**: Merge pull request #2844 from vitali87/claude/trace-windows-case-2587

fix(trace): match Windows frames under a differently-cased directory

**File**: `codebase_rag/crash_correlation.py` (modified, +4/-2)
```diff
@@ -474,14 +474,16 @@ def _rebase_for(
     A root the caller names beats one guessed from the paths, so inference
     runs only when no given prefix anchors any frame.
     """
-    given = PathRebase.from_prefix_map(repo_root, path_prefix_map or {})
+    given = PathRebase.from_prefix_map(
+        repo_root, path_prefix_map or {}, resolver.path_spellings
+    )
     if any(given.matches(frame) for frame in frames):
         return given, None
     inferred = resolver.infer_recorded_root(frames)
     if inferred is None:
         return given, None
     return PathRebase.from_prefix_map(
-        repo_root, {inferred: cs.PATH_CURRENT_DIR}
+        repo_root, {inferred: cs.PATH_CURRENT_DIR}, resolver.path_spellings
     ), inferred
 
 
```

**File**: `codebase_rag/tests/test_traceback_other_checkout.py` (modified, +263/-1)
```diff
@@ -29,6 +29,7 @@
     CYPHER_FLOW_REMOTE_EDGES,
 )
 from codebase_rag.mcp.tools import MCPToolsRegistry
+from codebase_rag.trace import resolution
 from codebase_rag.trace.ingest import ingest_trace
 from codebase_rag.trace.records import (
     CallRecord,
@@ -605,8 +606,11 @@ def flush_all(self):
         pass
 
 
-def _write_trace(trace_path: Path, recorded_root: str, frames_root: str) -> None:
+def _write_trace(
+    trace_path: Path, recorded_root: str, frames_root: str, package: str = "shop"
+) -> None:
     def point(rel: str, name: str, line: int) -> FramePoint:
+        rel = rel.replace("shop/", f"{package}/", 1)
         return FramePoint(path=f"{frames_root}/{rel}", qualname=name, line=line)
 
     write_trace_file(
@@ -740,3 +744,261 @@ def test_a_frame_under_the_checkout_in_another_case_stays_under_it():
 
     assert rebase.apply(frame).path == "C:/Users/dev/tbdemo/shop/pricing.py"
     assert not rebase.matches(frame)
+
+
+# --- a Windows frame spelling an in-repo directory in another case ----------
+# Windows names one file whatever the case of its path, so a traceback or
+# trace recorded there can spell `shop\pricing.py` as `SHOP\pricing.py`
+# (the script typed on the command line, a tool that normalises case). The
+# rebase kept that recorded spelling, so the frame matched no graph node: the
+# trace lost its call edge and the traceback lost the frame (follow-up to
+# issue #2587).
+
+_WINDOWS_LOCAL_ROOT = "C:/Users/dev/tbdemo/"
+
+
+def _recased(text: str, package: str, *files: str) -> str:
+    for name in files:
+        text = text.replace(f"\\shop\\{name}", f"\\{package}\\{name}")
+    return text
+
+
+def _ambiguous_fetch_all(project: str):
+    """A POSIX checkout may hold two files whose paths differ only in case."""
+    nodes = [
+        _row(cs.NodeLabel.MODULE, f"{project}.shop.cli", "shop/cli.py"),
+        _row(cs.NodeLabel.FUNCTION, f"{project}.shop.cli.main", "shop/cli.py", 20, 24),
+        _row(cs.NodeLabel.MODULE, f"{project}.shop.util", "shop/util.py"),
+        _row(cs.NodeLabel.FUNCTION, f"{project}.shop.util.fmt", "shop/util.py", 1, 9),
+        _row(cs.NodeLabel.MODULE, f"{project}.Shop.util", "Shop/util.py"),
+        _row(cs.NodeLabel.FUNCTION, f"{project}.Shop.util.fmt", "Shop/util.py", 1, 9),
+    ]
+
+    def fetch_all(query: str, params: dict | None = None) -> list[dict]:
+        return nodes if query == CYPHER_TRACE_CALLABLES else []
+
+    return fetch_all
+
+
+def test_a_windows_frame_in_a_differently_cased_directory_resolves(tmp_path):
+    """The reported case: `cli.py` frames name `shop`, `pricing.py` frames
+    name `SHOP`. Both are this checkout's `shop/` package."""
+    text = _recased(_shop_traceback(_WINDOWS_ROOT, "\\"), "SHOP", "pricing.py")
+
+    report = explain_traceback(_fetch_all_for(_P), _P, tmp_path, text)
+
+    assert _qns(report) == _resolved(_P)
+    assert report.resolution.resolved == 6
+
+
+def test_a_windows_traceback_wholly_under_a_differently_cased_directory_resolves(
+    tmp_path,
+):
+    """With no frame spelled as indexed, the checkout root is still inferred."""
+    text = _recased(
+        _shop_traceback(_WINDOWS_ROOT, "\\"), "Shop", "cli.py", "pricing.py"
+    )
+
+    report = explain_traceback(_fetch_all_for(_P), _P, tmp_path, text)
+
+    assert _qns(report) == _resolved(_P)
+    assert report.inferred_root == _WINDOWS_LOCAL_ROOT
+
+
+def test_a_frame_under_a_windows_checkout_in_another_case_resolves(
+    tmp_path, monkeypatch
+):
+    """The checkout itself on Windows: no rebase moves the frame, yet its
+    in-repo directory is spelled differently from the indexed path. The
+    frames use forward slashes, the form `Path.as_posix` gives on Windows,
+    so the simulated checkout behaves alike on every host."""
+    monkeypatch.setattr(
+        resolution, "_repo_root_posix", lambda _root: _WINDOWS_LOCAL_ROOT
+    )
+    text = _recased(
+        _shop_traceback(_WINDOWS_ROOT, "\\"), "SHOP", "cli.py", "pricing.py"
+    ).replace("\\", "/")
+
+    report = explain_traceback(_fetch_all_for(_P), _P, tmp_path, text)
+
+    assert _qns(report) == _resolved(_P)
+    assert report.inferred_root is None
+
+
+def test_a_windows_frame_mapped_into_a_subdirectory_is_respelled_below_it(
+    tmp_path,
+):
+    """Only the recorded part is re-spelled; the mapped target `src` is this
+    checkout's own directory and is used as given."""
+    nodes = [
+        {**row, cs.KEY_PATH: f"src/{row[cs.KEY_PATH]}"}
+        for row in _shop_nodes(_P)
+        if row[cs.KEY_PATH].startswith("shop/")
+    ]
+
+    def fetch_all(query: str, params: dict | None = None) -> list[dict]:
+        return nodes if query == CYPHER_TRACE_CALLABLES else []
+
+    report = explain_traceback(
+        fetch_all,
+        _P,
+        tmp_path,
+        _recased(_shop_traceback("D:\\build", "\\"), "SHOP", "pricing.py"),
+        path_prefix_map={"D:\\build": "src"},
+    )
+
+    assert _qns(report) == _resolved(_P)
+
+
+def test_trace_ingest_
```

**File**: `codebase_rag/trace/ingest.py` (modified, +4/-1)
```diff
@@ -34,6 +34,7 @@
     PathRebase,
     PhpFrameResolver,
     ResolutionStats,
+    path_spellings,
 )
 
 if TYPE_CHECKING:
@@ -182,7 +183,9 @@ def ingest_trace(
     resolver = _resolver_for(header, repo_root, nodes)
     # A trace recorded in CI or a container names files under THAT machine's
     # checkout, which its header records; they are this checkout's files.
-    rebase = PathRebase.from_recorded_root(repo_root, header.repo_root)
+    rebase = PathRebase.from_recorded_root(
+        repo_root, header.repo_root, path_spellings(node.path for node in nodes)
+    )
 
     summary = TraceIngestSummary()
     resolved_frames: dict[tuple[ResolvedFrame, ResolvedFrame], _EdgeStats] = {}
```

**File**: `codebase_rag/trace/resolution.py` (modified, +89/-21)
```diff
@@ -67,18 +67,38 @@ def _dir_prefix(path: str) -> str:
     return path.rstrip(cs.SEPARATOR_SLASH) + cs.SEPARATOR_SLASH
 
 
+def _recorded_on_windows(posix_path: str) -> bool:
+    """Whether a POSIX-form path is rooted at a Windows drive or share."""
+    return PureWindowsPath(posix_path).is_absolute()
+
+
 def _prefix_key(posix_path: str) -> str:
     """How a POSIX-form path compares as a prefix on the OS that recorded it.
 
     Windows names one file whatever the case of its path, and a drive letter
     is written either way (``sys.path`` can hold ``c:\\``), so a Windows path
     compares without case; a POSIX path keeps it.
     """
-    if PureWindowsPath(posix_path).is_absolute():
+    if _recorded_on_windows(posix_path):
         return posix_path.casefold()
     return posix_path
 
 
+def path_spellings(graph_paths: Iterable[str]) -> dict[str, str]:
+    """Each graph path keyed without case, for frames recorded on Windows.
+
+    A Windows frame can spell an in-repo directory unlike the indexed path
+    (``SHOP\\cli.py`` for ``shop/cli.py``: the script typed on the command
+    line, a tool that normalises case) and still name the same file. Two
+    graph paths differing only in case, which a POSIX checkout can hold, give
+    no one answer, so that key is left out and only an exact spelling matches.
+    """
+    found: dict[str, set[str]] = {}
+    for path in graph_paths:
+        found.setdefault(path.casefold(), set()).add(path)
+    return {key: next(iter(paths)) for key, paths in found.items() if len(paths) == 1}
+
+
 def _below_dir(posix_path: str, dir_prefix: str) -> str | None:
     """``posix_path`` relative to ``dir_prefix``, or None when not under it."""
     if not _prefix_key(posix_path).startswith(_prefix_key(dir_prefix)):
@@ -112,14 +132,22 @@ class PathRebase:
     matching prefix wins. A frame already under the checkout is never
     rebased: a recorded root can be an ancestor of the checkout, and
     re-rooting such a frame would move it to a path that does not exist.
+    A frame recorded on Windows also takes the graph's spelling of its
+    in-repo path (``spellings``), since there one file answers to any case.
     """
 
     local_root: str
     rules: tuple[tuple[str, str], ...] = ()
+    spellings: Mapping[str, str] = field(
+        default_factory=dict, repr=False, compare=False
+    )
 
     @classmethod
     def from_prefix_map(
-        cls, repo_root: Path, prefix_map: Mapping[str, str]
+        cls,
+        repo_root: Path,
+        prefix_map: Mapping[str, str],
+        spellings: Mapping[str, str] | None = None,
     ) -> PathRebase:
         local_root = _repo_root_posix(repo_root)
         rules = [
@@ -137,18 +165,27 @@ def from_prefix_map(
             if recorded
         ]
         rules.sort(key=lambda rule: len(rule[0]), reverse=True)
-        return cls(local_root=local_root, rules=tuple(rules))
+        return cls(local_root=local_root, rules=tuple(rules), spellings=spellings or {})
 
     @classmethod
-    def from_recorded_root(cls, repo_root: Path, recorded_root: str) -> PathRebase:
+    def from_recorded_root(
+        cls,
+        repo_root: Path,
+        recorded_root: str,
+        spellings: Mapping[str, str] | None = None,
+    ) -> PathRebase:
         """Rebase from the root a trace header says it was recorded under.
 
         A relative header root names no machine's checkout, so it is not a
         prefix anything can be stripped by.
         """
         if not is_absolute_on_any_os(recorded_root):
-            return cls(local_root=_repo_root_posix(repo_root))
-        return cls.from_prefix_map(repo_root, {recorded_root: cs.PATH_CURRENT_DIR})
+            return cls(
+                local_root=_repo_root_posix(repo_root), spellings=spellings or {}
+            )
+        return cls.from_prefix_map(
+            repo_root, {recorded_root: cs.PATH_CURRENT_DIR}, spellings
+        )
 
     def matches(self, frame: FramePoint) -> bool:
         """Whether a rule, rather than the checkout root, anchors the frame."""
@@ -159,19 +196,36 @@ def matches(self, frame: FramePoint) -> bool:
 
     def apply(self, frame: FramePoint) -> FramePoint:
         path = _portable_posix(frame.path)
-        if path.startswith(self.local_root):
+        windows = _recorded_on_windows(path)
+        # A Windows frame already under the checkout still goes through the
+        # loop: its in-repo part may be spelled unlike the indexed path.
+        if path.startswith(self.local_root) and not windows:
             return frame
         # The checkout root first: a frame under it in another case (Windows)
         # is re-cased onto it rather than moved by an ancestor's rule.
         for recorded, local in ((self.local_root, self.local_root), *self.rules):
             if (rest := _below_dir(path, recorded)) is not None:
+                if windows:
+                    rest = self._indexed_spelling(local, rest)
                 return FramePoint(

```

---

### Incident Patch 6: `e461caf1` (2026-10-04)
**Commit Message**: Merge pull request #2147 from vitali87/pr-split/rebuild-split-pr1926-source/pr-3

feat(check): cgr check --isolated wiring and the graph emulator's capture queries (#1718)

**File**: `codebase_rag/cli.py` (modified, +2/-0)
```diff
@@ -1581,6 +1581,7 @@ def check_command(
     fail_on_found: bool = typer.Option(
         False, "--fail-on-found", help=ch.HELP_CHECK_FAIL_ON_FOUND
     ),
+    isolated: bool = typer.Option(False, "--isolated", help=ch.HELP_CHECK_ISOLATED),
 ) -> None:
     from .structural_check import CheckError, indexed_scope, run_check
     from .structural_delta import has_findings
@@ -1607,6 +1608,7 @@ def check_command(
                 exclude_paths=exclude_paths,
                 unignore_paths=unignore_paths,
                 project_named=project is not None,
+                isolated=isolated,
             )
         except CheckError as error:
             typer.echo(str(error), err=True)
```

**File**: `codebase_rag/cli_help.py` (modified, +1/-0)
```diff
@@ -142,6 +142,7 @@ class CLICommandName(StrEnum):
 )
 EXAMPLES_CHECK = (
     "Examples:\n  cgr check --base HEAD\n  cgr check --base origin/main --fail-on-found"
+    "\n  cgr check --base origin/main --isolated --fail-on-found"
 )
 HELP_CHECK_BASE = (
     "Git ref the graph was indexed at; files differing from it are re-ingested."
```

**File**: `codebase_rag/stack/health.py` (modified, +27/-10)
```diff
@@ -122,6 +122,9 @@ def dup2(self, fd: int, fd2: int) -> None:
             _c_runtime_result(self._crt._dup2(fd, fd2))
 
         def close(self, fd: int) -> None:
+            # Closing fd 2 itself would otherwise strand what stderr still
+            # buffers for it.
+            self._crt.fflush(None)
             _c_runtime_result(self._crt._close(fd))
 
         def open_file(self, file: IO[bytes]) -> int:
@@ -155,21 +158,35 @@ def _mgclient_own_c_runtime() -> _CRuntime | None:
 @contextmanager
 def _stderr_into(runtime: _CRuntime, capture: IO[bytes]) -> Iterator[None]:
     try:
-        saved = runtime.dup(cs.NATIVE_STDERR_FD)
+        saved: int | None = runtime.dup(cs.NATIVE_STDERR_FD)
     except OSError:
-        # With fd 2 closed there is no terminal to keep clean.
-        yield
-        return
+        # fd 2 is closed, or, in msvcrt.dll under a test runner, holds a
+        # handle closed under it once the UCRT's fd 2 was moved. There is no
+        # terminal to put back, but the message still belongs in the capture
+        # rather than nowhere.
+        saved = None
+    redirected = False
     try:
-        target = runtime.open_file(capture)
         try:
-            runtime.dup2(target, cs.NATIVE_STDERR_FD)
-        finally:
-            runtime.close(target)
+            target = runtime.open_file(capture)
+            # With fd 2 free, the capture's descriptor is given that number.
+            if target != cs.NATIVE_STDERR_FD:
+                try:
+                    runtime.dup2(target, cs.NATIVE_STDERR_FD)
+                finally:
+                    runtime.close(target)
+            redirected = True
+        except OSError:
+            # Keeping the terminal clean is best-effort: the probe still runs
+            # and reports its result, its message going where fd 2 points.
+            pass
         yield
     finally:
-        runtime.dup2(saved, cs.NATIVE_STDERR_FD)
-        runtime.close(saved)
+        if saved is not None:
+            runtime.dup2(saved, cs.NATIVE_STDERR_FD)
+            runtime.close(saved)
+        elif redirected:
+            runtime.close(cs.NATIVE_STDERR_FD)
 
 
 @contextmanager
```

**File**: `codebase_rag/structural_check.py` (modified, +180/-11)
```diff
@@ -9,25 +9,35 @@
 The check measures the graph against the working tree, and the re-ingest
 brings the graph up to the tree, so a second run on an unchanged tree
 reports nothing: the delta was already applied. Rebuild the graph at the
-base (or index at the base before editing) to measure the same edit again.
-The CLI holds no lock against a concurrently running MCP server; like every
-other command that writes the graph, run it when no other writer is active.
+base (or index at the base before editing) to measure the same edit again,
+or run the check isolated (`--isolated`, issue #1718): the subgraph the
+re-ingest replaces is captured inside its prologue and put back once the
+delta is computed, the hash cache with it, so the graph reads as it did
+before and the same edit measures the same way every time. The CLI holds
+no lock against a concurrently running MCP server; like every other
+command that writes the graph, run it when no other writer is active.
 """
 
 from __future__ import annotations
 
+import os
 import subprocess
-from collections.abc import Mapping
+import uuid
+from collections.abc import Callable, Mapping
 from pathlib import Path
+from typing import cast
 
 from tree_sitter import Parser
 
 from . import constants as cs
+from . import cypher_queries as cq
+from .capture import CaptureSelection, default_capture
+from .check_isolation import GraphStore, IsolationGuard
 from .config import load_ignore_patterns
 from .graph_updater import GraphUpdater, _load_exclusion_state, _load_project_stamps
 from .services import QueryingIngestorProtocol
 from .structural_delta import StructuralDelta, normalise_paths, observe
-from .types_defs import LanguageQueries
+from .types_defs import LanguageQueries, PropertyDict, ReingestReport
 from .utils.path_utils import derive_project_name
 
 _GIT_DELETED = "D"
@@ -221,6 +231,145 @@ def indexed_scope(
     return cgrignore.exclude or None, cgrignore.unignore or None
 
 
+class _FileSnapshot:
+    """A file's bytes and timestamps, to be put back after the check.
+
+    The re-ingest records the files it re-parsed in the hash cache, which
+    would make a later full run skip them and keep the base graph for files
+    the working tree changed. The cache's mtime is also a judgement about
+    every file NOT in it (`_reingest_update_hashes`), so it goes back too.
+    """
+
+    def __init__(self, path: Path) -> None:
+        self._path = path
+        self._content: bytes | None = None
+        self._times: tuple[int, int] | None = None
+        # Absent and unreadable are different states and must not share one
+        # representation: treating a permission error as absence made the
+        # restore DELETE a cache it could not read (Greptile, #1718). Only a
+        # confirmed absence licenses the unlink.
+        self._absent = False
+        self._readable = False
+        try:
+            self._content = path.read_bytes()
+            stat = path.stat()
+            self._times = (stat.st_atime_ns, stat.st_mtime_ns)
+            self._readable = True
+        except FileNotFoundError:
+            self._absent = True
+        except OSError:
+            # Unreadable: leave whatever is there alone.
+            pass
+
+    @property
+    def unrestorable(self) -> bool:
+        """Present but unreadable: the re-ingest may still WRITE it (mode
+        0o200 allows that), and `put_back` could not undo the write (bot
+        review, #1718)."""
+        return not self._absent and not self._readable
+
+    def put_back(self) -> None:
+        if self._absent:
+            self._path.unlink(missing_ok=True)
+            return
+        if not self._readable or self._content is None or self._times is None:
+            return
+        self._path.write_bytes(self._content)
+        os.utime(self._path, ns=self._times)
+
+
+_UNRESTORABLE_RELS = (
+    cs.RelationshipType.RESOLVES_TO,
+    cs.RelationshipType.FLOWS_TO,
+)
+
+
+def _refuse_unrestorable_capture(capture: CaptureSelection) -> None:
+    """Refuse an isolated run whose capture holds links it cannot restore.
+
+    The guard restores by walking out from the re-parsed modules, and a
+    `Resource` is not on that walk: it is only ever the far end of an edge.
+    The endpoint pass then deletes every network `RESOLVES_TO` edge in the
+    graph and rebuilds them from the edited tree, and a Resource-to-Resource
+    `FLOWS_TO` chain touches no scoped node at all, so neither can be put
+    back from the capture. Losing them silently is worse than not offering
+    the mode, so this refuses instead (greptile-local, #1718).
+    """
+    enabled = [rel for rel in _UNRESTORABLE_RELS if capture.rel_enabled(rel)]
+    if enabled:
+        raise CheckError(
+            cs.CHECK_ISOLATED_WITH_IO.format(
+                groups=", ".join(rel.value for rel in enabled)
+            )
+        )
+
+
+def _refuse_graph_holding_io_links(ingestor: object) -> None:
+    """Refuse an isolated run over a g
```

**File**: `codebase_rag/tests/test_check_isolated_wiring.py` (added, +298/-0)
```diff
@@ -0,0 +1,298 @@
+"""`run_check(isolated=True)` and `cgr check --isolated`, end to end (#1718).
+
+The isolated check measures the working tree's delta and then puts the
+graph and the on-disk hash cache back, so the same edit measures the same
+way on a second run. These drive the wiring on the eval emulator: the round
+trip itself, the refusals that keep it from starting when it could not put
+everything back, the hash-cache snapshot, and the CLI flag reaching it.
+"""
+
+from __future__ import annotations
+
+import copy
+import os
+import subprocess
+from pathlib import Path
+from unittest.mock import MagicMock, patch
+
+import pytest
+from typer.testing import CliRunner
+
+from codebase_rag import constants as cs
+from codebase_rag import cypher_queries as cq
+from codebase_rag.capture import resolve_capture
+from codebase_rag.cli import app
+from codebase_rag.graph_updater import GraphUpdater
+from codebase_rag.parser_loader import load_parsers
+from codebase_rag.structural_check import (
+    CheckError,
+    _FileSnapshot,
+    _refuse_graph_holding_io_links,
+    _refuse_unrestorable_capture,
+    run_check,
+)
+from codebase_rag.tests.conftest import git_env
+from codebase_rag.types_defs import PropertyDict, ResultRow
+from evals.cgr_graph import _StatefulIngestor
+
+PROJECT = "wiring_fixture"
+
+FIXTURE: dict[str, str] = {
+    "pkg/__init__.py": "",
+    "pkg/util.py": "def helper(a):\n    return a + 1\n",
+    "pkg/app.py": "from pkg.util import helper\n\n\ndef run():\n    return helper(1)\n",
+    "main.py": "from pkg.app import run\n\n\ndef main():\n    run()\n",
+}
+
+
+def _git(root: Path, *args: str) -> None:
+    subprocess.run(
+        ["git", "-c", "user.name=t", "-c", "user.email=t@t", *args],
+        cwd=root,
+        check=True,
+        capture_output=True,
+        env=git_env(),
+    )
+
+
+def _write(root: Path, rel: str, text: str) -> None:
+    path = root / rel
+    path.parent.mkdir(parents=True, exist_ok=True)
+    path.write_text(text, encoding="utf-8")
+
+
+@pytest.fixture
+def indexed(temp_repo: Path) -> tuple[Path, _StatefulIngestor]:
+    root = temp_repo / PROJECT
+    root.mkdir()
+    for rel, text in FIXTURE.items():
+        _write(root, rel, text)
+    _git(root, "init", "-q")
+    _git(root, "add", "-A")
+    _git(root, "commit", "-q", "-m", "base")
+    store = _StatefulIngestor()
+    parsers, queries = load_parsers()
+    GraphUpdater(
+        ingestor=store,
+        repo_path=root,
+        parsers=parsers,
+        queries=queries,
+        project_name=PROJECT,
+    ).run(force=True)
+    return root, store
+
+
+def _edit(root: Path) -> None:
+    """A rename whose caller dangles, a deleted module, a new module."""
+    _write(root, "pkg/util.py", FIXTURE["pkg/util.py"].replace("helper", "assist"))
+    (root / "main.py").unlink()
+    _write(root, "lib/tool.py", "def tool():\n    return 1\n")
+
+
+def _state(store: _StatefulIngestor) -> tuple[dict, set, dict]:
+    return (
+        copy.deepcopy(store.nodes),
+        set(store.edges),
+        copy.deepcopy(store.edge_props),
+    )
+
+
+def _delta(root: Path, store: _StatefulIngestor, *, isolated: bool) -> dict:
+    parsers, queries = load_parsers()
+    delta = run_check(
+        root,
+        "HEAD",
+        PROJECT,
+        store,
+        parsers,
+        queries,
+        isolated=isolated,
+        capture=resolve_capture([]),
+    )
+    return {k: v for k, v in delta.items() if k not in ("reingest_ms", "delta_ms")}
+
+
+# --- the round trip -------------------------------------------------------------
+
+
+def test_an_isolated_check_reports_the_delta_and_leaves_graph_and_cache(
+    indexed: tuple[Path, _StatefulIngestor],
+) -> None:
+    root, store = indexed
+    _edit(root)
+    before = _state(store)
+    cache = root / cs.HASH_CACHE_FILENAME
+    cache_before = cache.read_bytes() if cache.exists() else None
+
+    first = _delta(root, store, isolated=True)
+
+    assert first["dangling_callers"][0]["target"] == f"{PROJECT}.pkg.util.helper"
+    assert f"{PROJECT}.main.main" in first["symbols"]["removed"]
+    assert _state(store) == before
+    assert (cache.read_bytes() if cache.exists() else None) == cache_before
+    # Nothing was kept, so the same edit measures the same way again.
+    assert _delta(root, store, isolated=True) == first
+
+
+def test_the_same_edit_applied_without_isolation_lands(
+    indexed: tuple[Path, _StatefulIngestor],
+) -> None:
+    """The control: without the flag the re-ingest stays in the graph."""
+    root, store = indexed
+    _edit(root)
+    before = _state(store)
+
+    _delta(root, store, isolated=False)
+
+    assert _state(store) != before
+
+
+# --- refusals ------------------------------------------------------------------
+
+
+@pytest.mark.parametrize("rel", ["FLOWS_TO", "RESOLVES_TO"])
+def test_a_capture_holding_an_unrestorable_link_is_refused(rel: str) -> None:
+    selection = resolve_capture(["all"])
+    assert selection.rel_enab
```

**File**: `codebase_rag/tests/test_check_isolation_marker.py` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+"""The isolated check's incomplete-run marker outlives any failed put-back (#1718).
+
+The check marks the project incomplete before it writes and clears the mark
+once the graph and the on-disk hash cache are both back. A cache left
+holding the re-parse's hashes makes the next update skip the edited files,
+so a failed cache restore must leave the project marked, exactly as a failed
+graph restore does.
+"""
+
+from __future__ import annotations
+
+from collections.abc import Callable
+from pathlib import Path
+from types import SimpleNamespace
+from typing import cast
+
+import pytest
+
+from codebase_rag import constants as cs
+from codebase_rag import cypher_queries as cq
+from codebase_rag.graph_updater import GraphUpdater
+from codebase_rag.structural_check import _measure_then_restore
+from codebase_rag.structural_delta import StructuralDelta
+from codebase_rag.types_defs import PropertyDict, ReingestReport, ResultRow
+
+
+class _RecordingStore:
+    def __init__(self) -> None:
+        self.writes: list[str] = []
+
+    def fetch_all(
+        self, query: str, params: PropertyDict | None = None
+    ) -> list[ResultRow]:
+        return []
+
+    def execute_write(self, query: str, params: PropertyDict | None = None) -> None:
+        self.writes.append(query)
+
+    def ensure_node_batch(self, label: str, properties: PropertyDict) -> None:
+        pass
+
+    def ensure_relationship_batch(self, *args: object, **kwargs: object) -> None:
+        pass
+
+    def flush_all(self) -> None:
+        pass
+
+
+def _run(
+    root: Path, store: _RecordingStore, during: Callable[[], None] | None = None
+) -> None:
+    def measure(apply: Callable[[], ReingestReport]) -> StructuralDelta:
+        if during is not None:
+            during()
+        return cast(StructuralDelta, {})
+
+    _measure_then_restore(
+        cast(GraphUpdater, SimpleNamespace(reingest_scope=())),
+        store,
+        "proj",
+        root,
+        lambda hook: cast(ReingestReport, {}),
+        measure,
+    )
+
+
+def test_the_marker_is_cleared_once_graph_and_cache_are_back(tmp_path: Path) -> None:
+    store = _RecordingStore()
+    (tmp_path / cs.HASH_CACHE_FILENAME).write_text("{}")
+
+    _run(tmp_path, store)
+
+    assert store.writes == [
+        cq.CYPHER_MARK_PROJECT_INCOMPLETE,
+        cq.CYPHER_CLEAR_PROJECT_INCOMPLETE,
+    ]
+
+
+def test_a_failed_cache_restore_leaves_the_project_marked(tmp_path: Path) -> None:
+    store = _RecordingStore()
+    cache = tmp_path / cs.HASH_CACHE_FILENAME
+    cache.write_text("{}")
+
+    def block_the_cache() -> None:
+        # A directory where the cache file was: writing it back fails.
+        cache.unlink()
+        cache.mkdir()
+
+    with pytest.raises(OSError):
+        _run(tmp_path, store, during=block_the_cache)
+
+    assert store.writes == [cq.CYPHER_MARK_PROJECT_INCOMPLETE]
```

**File**: `codebase_rag/tests/test_stack_quiet_wait.py` (modified, +62/-11)
```diff
@@ -331,13 +331,28 @@ def slow_noisy_connect(**_: object) -> MagicMock:
     assert capfd.readouterr().err == "after\n"
 
 
-def test_a_process_without_stderr_still_probes() -> None:
-    # A service started with fd 2 closed has nothing to redirect.
+def test_a_process_without_stderr_still_probes(
+    debug_records: list[tuple[str, str]],
+) -> None:
+    # A service started with fd 2 closed: the C library's message still goes
+    # to the debug log, and fd 2 is left closed.
+    runtime = _SeparateCRuntime(stderr=None)
+
+    def connect(**_: object) -> MagicMock:
+        runtime.perror(f"{MGCLIENT_NOISE}_recv: connection closed by server")
+        raise health.mgclient.OperationalError("failed to receive handshake")
+
     with (
-        patch.object(os, "dup", side_effect=OSError(errno.EBADF, "closed")),
-        patch.object(health.mgclient, "connect"),
+        patch.object(health, "_PYTHON_C_RUNTIME", runtime),
+        patch.object(health, "_mgclient_own_c_runtime", return_value=None),
+        patch.object(health.mgclient, "connect", side_effect=connect),
     ):
-        assert health._bolt_reachable(cs.LOOPBACK_HOST, 7687)
+        assert not health._bolt_reachable(cs.LOOPBACK_HOST, 7687)
+
+    assert runtime.fds == {}
+    assert [level for level, text in debug_records if MGCLIENT_NOISE in text] == [
+        "DEBUG"
+    ]
 
 
 @pytest.mark.parametrize(
@@ -396,10 +411,10 @@ def __init__(self, stderr: int | None) -> None:
         self.fds: dict[int, int] = {}
         if stderr is not None:
             self.fds[STDERR_FD] = os.dup(stderr)
-        self._numbers = itertools.count(STDERR_FD + 1)
 
     def _add(self, real_fd: int) -> int:
-        fd = next(self._numbers)
+        # The lowest free number, so with fd 2 closed the next one is fd 2.
+        fd = next(n for n in itertools.count(STDERR_FD) if n not in self.fds)
         self.fds[fd] = real_fd
         return fd
 
@@ -489,26 +504,62 @@ def connect(**_: object) -> MagicMock:
 
 
 def test_a_c_runtime_without_stderr_still_probes(
+    debug_records: list[tuple[str, str]],
     capfd: pytest.CaptureFixture[str],
 ) -> None:
-    # A service started with no stderr: msvcrt.dll has no fd 2 to move, and
-    # Python's fd 2 is still kept clean.
+    # msvcrt.dll with no usable fd 2, as under a test runner whose capture
+    # closed the handle it shared: mgclient's message still reaches the debug
+    # log, and Python's fd 2 is still kept clean.
     runtime = _SeparateCRuntime(stderr=None)
-    failure = health.mgclient.OperationalError("failed to receive handshake")
+
+    def connect(**_: object) -> MagicMock:
+        runtime.perror(f"{MGCLIENT_NOISE}_recv: connection closed by server")
+        os.write(STDERR_FD, f"{MGCLIENT_NOISE}: Connection reset by peer\n".encode())
+        raise health.mgclient.OperationalError("failed to receive handshake")
 
     with (
         patch.object(health, "_mgclient_own_c_runtime", return_value=runtime),
-        patch.object(health.mgclient, "connect", side_effect=_noisy_connect(failure)),
+        patch.object(health.mgclient, "connect", side_effect=connect),
     ):
         assert (
             health.memgraph_anonymous_access(cs.LOOPBACK_HOST, 7687)
             is cs.AnonymousAccess.NO_ANSWER
         )
 
     assert runtime.fds == {}
+    assert [level for level, text in debug_records if MGCLIENT_NOISE in text] == [
+        "DEBUG"
+    ]
     assert capfd.readouterr().err == ""
 
 
+def test_an_unusable_fd_2_that_refuses_the_capture_is_left_as_it_was(
+    tmp_path: Path,
+) -> None:
+    # msvcrt.dll's fd 2 still taken, but by a handle it can no longer dup:
+    # when it will not take the capture either, the probe still runs and
+    # reports its result, and nothing is closed after.
+    with (tmp_path / "terminal").open("wb") as file:
+        runtime = _SeparateCRuntime(file.fileno())
+    failure = health.mgclient.OperationalError("failed to receive handshake")
+    try:
+        with (
+            patch.object(health, "_mgclient_own_c_runtime", return_value=runtime),
+            patch.object(runtime, "dup", side_effect=OSError(errno.EBADF, "gone")),
+            patch.object(runtime, "dup2", side_effect=OSError(errno.EBADF, "bad")),
+            patch.object(health.mgclient, "connect", side_effect=failure),
+        ):
+            assert (
+                health.memgraph_anonymous_access(cs.LOOPBACK_HOST, 7687)
+                is cs.AnonymousAccess.NO_ANSWER
+            )
+
+        assert set(runtime.fds) == {STDERR_FD}
+    finally:
+        for real_fd in runtime.fds.values():
+            os.close(real_fd)
+
+
 def test_mgclient_has_a_c_runtime_of_its_own_only_on_windows() -> None:
     # Everywhere else mgclient and Python share the kernel's descriptors.
     own_runtime = health._mgclient_own_c_runtime()
```

**File**: `docs/architecture/structural-delta.md` (modified, +42/-0)
```diff
@@ -110,3 +110,45 @@ included, are re-ingested and the delta printed as JSON. With
 callers, `too_many` arity findings, new duplicates or new import cycles.
 A project that is not indexed is refused: a scoped re-ingest completes a
 graph, it cannot stand in for the first index.
+
+The re-ingest is also what brings the graph up to the working tree, so a
+second run on the same edit reports nothing. `--isolated` measures without
+keeping the write:
+
+```bash
+cgr check --base origin/main --isolated --fail-on-found
+```
+
+The subgraph the re-ingest replaces (the changed files' module subtrees and
+those of their dependents, the File nodes at those paths, the containers
+above them and every relationship touching any of it) is captured inside the
+re-ingest's own prologue, so the scope is the updater's rather than a guess
+from the diff, and put back once the delta is computed; the hash cache is
+restored byte for byte, timestamps included. Nodes the check creates beside
+the subtrees (a new file's File node, a new directory's Folder, a new
+finding, an ExternalModule for a new import) are removed; a shared node that
+already existed is kept even when the check links it, and every node that
+outlived the check gets its captured properties back exactly, with any key
+the check added removed. A re-ingest that fails after its first write is
+rolled back the same way.
+
+What `--isolated` does not promise:
+
+- **The graph changes while the check runs.** The re-ingest writes to the
+  shared graph and the restore undoes it afterwards; a reader in between
+  sees the check's state.
+- **The restore is not one transaction.** It deletes before it re-creates.
+  The project's incomplete-run marker is set before the first write and
+  cleared only once the restore finishes, so if the restore fails partway
+  the marker stays, readers refuse, and the next full update repairs the
+  graph.
+- **Some graphs are refused.** A capture that enables IO resource links, a
+  graph that already holds any, and a hash cache that exists but cannot be
+  read are all refused before anything is written, because the restore could
+  not undo them.
+
+The capture and restore read the changed files' subgraph plus one
+graph-wide scan of the shared ExternalModule and Resource nodes, the same
+set the re-ingest's own repo-wide sweeps touch. The delta itself still does
+its project-wide reads (the duplicate-fingerprint lookup above), and the
+re-ingest still runs its repo-wide cleanup passes.
```

---

### Incident Patch 7: `65ec2b5a` (2026-10-04)
**Commit Message**: fix(context): check the MCP budget under the ingestor lock

The early return in the context handler made it more than a pure
delegation to _graph_query, so the handler-lock guard flagged it as
unlocked. The check now runs inside _run_context.

**File**: `codebase_rag/mcp/tools.py` (modified, +11/-9)
```diff
@@ -2970,15 +2970,6 @@ async def context(
         budget_tokens: int = cs.CONTEXT_DEFAULT_BUDGET,
         project: str | None = None,
     ) -> object:
-        # The CLI enforces this with typer's min=1; without the same check an
-        # MCP caller's zero or negative budget returns an empty slice that
-        # reads as success.
-        if budget_tokens < 1:
-            return {
-                cs.DICT_KEY_ERROR: cs.MCP_CONTEXT_BUDGET_INVALID.format(
-                    budget=budget_tokens
-                )
-            }
         return await self._graph_query(
             cs.MCPToolName.CONTEXT,
             project,
@@ -2990,6 +2981,17 @@ def _run_context(
     ) -> object:
         from codebase_rag.context_slice import context as build_context
 
+        # The CLI enforces this with typer's min=1; without the same check an
+        # MCP caller's zero or negative budget returns an empty slice that
+        # reads as success. Checked here rather than in `context` so that
+        # handler stays a pure delegation to the locked `_graph_query`.
+        if budget_tokens < 1:
+            return {
+                cs.DICT_KEY_ERROR: cs.MCP_CONTEXT_BUDGET_INVALID.format(
+                    budget=budget_tokens
+                )
+            }
+
         # Scoped to the project `_graph_query` resolved, not the optional
         # argument: an omitted `project` would otherwise search every project
         # and resolve to a name the project-scoped reads cannot find.
```

---

### Incident Patch 8: `f07f817b` (2026-10-04)
**Commit Message**: fix(context): reject an MCP context budget below one

**File**: `codebase_rag/constants/mcp.py` (modified, +1/-0)
```diff
@@ -147,6 +147,7 @@ class MCPParamName(StrEnum):
 # Structural delta appended to write tools (issue #1525).
 MCP_DELTA_HEADER = "Structural delta:"
 CONTEXT_DEFAULT_BUDGET = 4000
+MCP_CONTEXT_BUDGET_INVALID = "budget_tokens must be at least 1, got {budget}"
 MCP_DELTA_ERROR = "Structural delta unavailable: {error}"
 MCP_REINGEST_NEEDS_INDEX = (
     "Project {project} is not indexed; run index_repository or update_repository "
```

**File**: `codebase_rag/mcp/tools.py` (modified, +9/-0)
```diff
@@ -2970,6 +2970,15 @@ async def context(
         budget_tokens: int = cs.CONTEXT_DEFAULT_BUDGET,
         project: str | None = None,
     ) -> object:
+        # The CLI enforces this with typer's min=1; without the same check an
+        # MCP caller's zero or negative budget returns an empty slice that
+        # reads as success.
+        if budget_tokens < 1:
+            return {
+                cs.DICT_KEY_ERROR: cs.MCP_CONTEXT_BUDGET_INVALID.format(
+                    budget=budget_tokens
+                )
+            }
         return await self._graph_query(
             cs.MCPToolName.CONTEXT,
             project,
```

**File**: `codebase_rag/tests/test_context_slice.py` (modified, +23/-0)
```diff
@@ -272,6 +272,29 @@ async def test_mcp_context_tool(
     assert payload["used_tokens"] <= 300
 
 
+async def test_mcp_context_tool_rejects_a_budget_below_one(
+    repo: tuple[Path, _StatefulIngestor, GraphUpdater],
+) -> None:
+    from unittest.mock import MagicMock
+
+    from codebase_rag.mcp.tools import MCPToolsRegistry
+
+    root, store, _updater = repo
+    ingestor = MagicMock()
+    ingestor.fetch_all = store.fetch_all
+    ingestor.list_projects.return_value = [PROJECT]
+    registry = MCPToolsRegistry(
+        project_root=str(root), ingestor=ingestor, cypher_gen=MagicMock()
+    )
+    for budget in (0, -5):
+        payload = await registry.context(
+            target=_qn("pkg.util.helper"), budget_tokens=budget, project=PROJECT
+        )
+        assert payload == {
+            cs.DICT_KEY_ERROR: cs.MCP_CONTEXT_BUDGET_INVALID.format(budget=budget)
+        }
+
+
 # A broken skip guard is invisible: if `_markdown_unavailable` silently returned
 # a constant, the two tests it gates would SKIP or would run without the grammar,
 # and a skip reads as green in every summary while also being the legitimate
```

---

### Incident Patch 9: `dfa02f6c` (2026-10-04)
**Commit Message**: Merge pull request #2505 from vitali87/claude/js-require-binding-2402

fix(js): bind bare calls to their require/import, not to other files' function expressions

**File**: `codebase_rag/constants/graph.py` (modified, +3/-1)
```diff
@@ -29,6 +29,7 @@
 # through its object (issue #2435).
 KEY_IS_OBJECT_MEMBER = "is_object_member"
 KEY_IS_MACRO = "is_macro"
+KEY_IS_BODY_SCOPED_NAME = "is_body_scoped_name"
 KEY_QUERY = "query"
 KEY_RESPONSE = "response"
 KEY_START_LINE = "start_line"
@@ -986,7 +987,8 @@ class AuditCheck(StrEnum):
     "OR n:Enum OR n:Type OR n:Union) "
     "AND n.qualified_name STARTS WITH $project_prefix "
     "RETURN n.qualified_name AS qualified_name, head(labels(n)) AS label, "
-    "n.is_property AS is_property, n.is_macro AS is_macro, n.path AS path, "
+    "n.is_property AS is_property, n.is_macro AS is_macro, "
+    "n.is_body_scoped_name AS is_body_scoped_name, n.path AS path, "
     "n.start_line AS start_line, n.end_line AS end_line, "
     "n.return_type AS return_type, n.param_types AS param_types, "
     "n.namespace AS namespace, n.is_object_member AS is_object_member"
```

**File**: `codebase_rag/function_registry.py` (modified, +9/-0)
```diff
@@ -29,6 +29,7 @@ class FunctionRegistryTrie:
         "_property_names",
         "_object_members",
         "_abstracts",
+        "_body_scoped_names",
         "_callable_params",
         "_reserved",
     )
@@ -49,6 +50,7 @@ def __init__(self, simple_name_lookup: SimpleNameLookup | None = None) -> None:
         self._property_names: set[str] = set()
         self._object_members: set[QualifiedName] = set()
         self._abstracts: set[QualifiedName] = set()
+        self._body_scoped_names: set[QualifiedName] = set()
         self._callable_params: dict[QualifiedName, dict[str, int]] = {}
         self._reserved: dict[QualifiedName, tuple[int, int]] = {}
 
@@ -96,6 +98,12 @@ def mark_abstract(self, qualified_name: QualifiedName) -> None:
     def is_abstract(self, qualified_name: QualifiedName) -> bool:
         return qualified_name in self._abstracts
 
+    def mark_body_scoped_name(self, qualified_name: QualifiedName) -> None:
+        self._body_scoped_names.add(qualified_name)
+
+    def is_body_scoped_name(self, qualified_name: QualifiedName) -> bool:
+        return qualified_name in self._body_scoped_names
+
     def register_unique_qn(
         self, natural_qn: QualifiedName, start_line: int, start_col: int = 0
     ) -> QualifiedName:
@@ -188,6 +196,7 @@ def __delitem__(self, qualified_name: QualifiedName) -> None:
                 self._property_names.discard(simple_name)
         self._object_members.discard(qualified_name)
         self._abstracts.discard(qualified_name)
+        self._body_scoped_names.discard(qualified_name)
         self._callable_params.pop(qualified_name, None)
 
         self._invalidate_ending_with_cache(simple_name)
```

**File**: `codebase_rag/graph_updater.py` (modified, +5/-0)
```diff
@@ -3247,6 +3247,11 @@ def _rehydrate_definition_row(self, row: ResultRow) -> bool:
         # macro defined elsewhere would otherwise drop.
         if row.get(cs.KEY_IS_MACRO):
             self.factory.definition_processor.macro_qns.add(qn)
+        # Restore the body-scoped-name set for unchanged files, or a
+        # re-parsed file's bare call binds by name to a function expression
+        # only its own body can call by that name (issue #2402).
+        if row.get(cs.KEY_IS_BODY_SCOPED_NAME):
+            self.function_registry.mark_body_scoped_name(qn)
         # Record the defining file so _is_cpp_defined can language-check
         # rehydrated candidates (deferred C++ INHERITS resolution runs
         # after this and must reach bases in UNCHANGED headers).
```

**File**: `codebase_rag/parsers/call_processor.py` (modified, +1/-0)
```diff
@@ -5401,6 +5401,7 @@ def _emit_resolved_callee_targets(
             call_name,
             ctx.module_qn,
             self._resolver.function_registry.variants(callee_qn),
+            ctx.caller_qn,
         )
         if len(
             targets
```

**File**: `codebase_rag/parsers/call_resolver.py` (modified, +96/-10)
```diff
@@ -907,9 +907,7 @@ def _resolve_enclosing_scope(
             return None
         scope = caller_qn
         while True:
-            if hit := self._scope_candidate(scope, call_name, language):
-                return hit
-            if hit := self._dup_variant_scope_candidate(scope, call_name, language):
+            if hit := self._probe_scope(scope, call_name, language):
                 return hit
             if cs.SEPARATOR_DOT not in scope:
                 return None
@@ -923,6 +921,48 @@ def _resolve_enclosing_scope(
                 return None
             scope = parent
 
+    def _probe_scope(
+        self, scope: str, call_name: str, language: cs.SupportedLanguage | None
+    ) -> tuple[str, str] | None:
+        # One step of the scope-chain walk: the name defined directly in
+        # `scope`, then in its variant-stripped form, then `scope`'s own
+        # body-scoped name.
+        return (
+            self._scope_candidate(scope, call_name, language)
+            or self._dup_variant_scope_candidate(scope, call_name, language)
+            or self._own_body_scoped_name(scope, call_name)
+        )
+
+    def _own_body_scoped_name(
+        self, scope: str, call_name: str
+    ) -> tuple[str, str] | None:
+        # A JS/TS named function expression's name is in scope inside its own
+        # body, the one place a bare call can reach it by that name (issue
+        # #2402). Answered from the caller's scope chain, ahead of the
+        # module-keyed cache, since callers elsewhere must not see it. The
+        # natural qn is what the same-module probe used to return, so the
+        # `@line` variants fan out exactly as they did.
+        if not self.function_registry.is_body_scoped_name(scope):
+            return None
+        natural = qn_markers.natural_qn(scope)
+        if natural.rsplit(cs.SEPARATOR_DOT, 1)[-1] != call_name:
+            return None
+        target = natural if natural in self.function_registry else scope
+        return self.function_registry[target], target
+
+    def _name_hidden_in_body(self, qualified_name: str) -> bool:
+        # A JS/TS function expression's own name, which only its body can call
+        # (issue #2402). A same-named definition beside it (an `@line`
+        # variant) keeps the name bound, so the variant group stays nameable
+        # and fans out as before.
+        registry = self.function_registry
+        if not registry.is_body_scoped_name(qualified_name):
+            return False
+        return all(
+            registry.is_body_scoped_name(variant)
+            for variant in registry.variants(qn_markers.natural_qn(qualified_name))
+        )
+
     def _local_stops_at_class(self, call_name: str, caller_qn: str, scope: str) -> bool:
         return (
             call_name in self.python_local_names.get(caller_qn, frozenset())
@@ -933,8 +973,10 @@ def _scope_candidate(
         self, scope: str, call_name: str, language: cs.SupportedLanguage | None
     ) -> tuple[str, str] | None:
         candidate = f"{scope}{cs.SEPARATOR_DOT}{call_name}"
-        if candidate in self.function_registry and self._bare_call_allowed(
-            language, candidate
+        if (
+            candidate in self.function_registry
+            and self._bare_call_allowed(language, candidate)
+            and not self._name_hidden_in_body(candidate)
         ):
             return self.function_registry[candidate], candidate
         return None
@@ -987,23 +1029,45 @@ def _only_object_members(self, qualified_name: str) -> bool:
         )
 
     def lexical_call_targets(
-        self, call_name: str, module_qn: str, targets: list[str]
+        self,
+        call_name: str,
+        module_qn: str,
+        targets: list[str],
+        caller_qn: str | None = None,
     ) -> list[str]:
         """The members of a bare call's `@line` group its name can reach.
 
         `function delay` and `{delay: () => 0}` in one file share a group, and
         the bare name means the declaration, not the object's value (issue
         #2435). A name the module imports is left whole: the import may bind
         a module's exported object member, which it does reach by name.
+        Inside a JS/TS named function expression's own body, its name is that
+        expression and shadows every same-named declaration (issue #2402).
         """
         if len(targets) < 2 or cs.SEPARATOR_DOT in call_name:
             return targets
+        registry = self.function_registry
+        if self._calls_own_body_name(call_name, caller_qn, targets):
+            # Same-named function expressions keep their spread (#2403).
+            return [qn for qn in targets if registry.is_body_scoped_name(qn)]
         if call_name in self.import_processor.import_mapping.get(module_qn, {}):
             return targets
-        registry = self.function_registry
         bound = [qn for qn in targets if not registry.is_object_member(qn)]
         return bound or targets
 
+ 
```

**File**: `codebase_rag/parsers/function_ingest.py` (modified, +21/-8)
```diff
@@ -1396,14 +1396,10 @@ def _register_function(
         func_props = self._build_function_props(
             func_node, resolution, module_qn, lang_queries, language
         )
-        if language in cs.JS_TS_LANGUAGES and js_ts_utils.is_object_literal_method(
-            func_node
-        ):
-            # `{delay () {...}}` registers here, under its key, before the
-            # object-literal pass would; only its object reaches it (issue
-            # #2435), and the persisted mark keeps that across incremental runs.
-            func_props[cs.KEY_IS_OBJECT_MEMBER] = True
-            self.function_registry.mark_object_member(resolution.qualified_name)
+        if language in cs.JS_TS_LANGUAGES:
+            self._mark_js_ts_name_scope(
+                func_node, resolution.qualified_name, func_props
+            )
         is_macro = func_node.type == cs.TS_RS_MACRO_DEFINITION
         if is_macro:
             # Rust macros live in a separate namespace from functions; Pass-3 gates
@@ -1516,6 +1512,23 @@ def _register_function(
             func_node, resolution, module_qn, language, lang_config
         )
 
+    def _mark_js_ts_name_scope(
+        self, func_node: Node, qualified_name: str, func_props: PropertyDict
+    ) -> None:
+        if js_ts_utils.is_object_literal_method(func_node):
+            # `{delay () {...}}` registers here, under its key, before the
+            # object-literal pass would; only its object reaches it (issue
+            # #2435), and the persisted mark keeps that across incremental runs.
+            func_props[cs.KEY_IS_OBJECT_MEMBER] = True
+            self.function_registry.mark_object_member(qualified_name)
+        # A JS/TS function expression whose name only its own body can call:
+        # bare-name resolution skips it everywhere else (issue #2402), and the
+        # persisted property lets an incremental run's rehydrated registry
+        # skip it too (the is_macro pattern).
+        if js_ts_utils.name_is_body_scoped(func_node):
+            func_props[cs.KEY_IS_BODY_SCOPED_NAME] = True
+            self.function_registry.mark_body_scoped_name(qualified_name)
+
     def _record_csharp_local_function(
         self, func_node: Node, qualified_name: str, module_qn: str
     ) -> None:
```

**File**: `codebase_rag/parsers/js_ts/utils.py` (modified, +72/-0)
```diff
@@ -193,6 +193,78 @@ def _value_binding_name(node: Node) -> str | None:
     return safe_decode_text(name_node)
 
 
+def name_is_body_scoped(func_node: Node) -> bool:
+    # A named function expression binds its own name inside its body alone;
+    # code elsewhere reaches it through whatever the VALUE is stored under.
+    # Where that is the same name (`var f = function f`, `exports.f =
+    # function f`) a lookup by the name still lands on a real binding. The
+    # module's own export (`module.exports = function f`) is bound by each
+    # importer under a name of its choosing, commonly `f`, so it keeps its
+    # name too. What is left, a value stored under another name or none (a
+    # callback argument, a return value, `var g = function f`), has a name
+    # nothing outside its body can call (issue #2402).
+    if func_node.type not in (cs.TS_FUNCTION_EXPRESSION, cs.TS_GENERATOR_FUNCTION):
+        return False
+    name_node = func_node.child_by_field_name(cs.FIELD_NAME)
+    if name_node is None:
+        return False
+    value, holder = func_node, func_node.parent
+    while holder is not None and holder.type in _BINDING_WRAPPER_TYPES:
+        value, holder = holder, holder.parent
+    if holder is None:
+        return True
+    if _holds_module_export(holder, value):
+        return False
+    return safe_decode_text(name_node) != _stored_under_name(holder, value)
+
+
+def _holds_module_export(holder: Node, value: Node) -> bool:
+    # `export default (function f () {})`, `module.exports = ...`, and the
+    # `module.exports = exports = ...` chain's inner link.
+    if holder.type == cs.TS_EXPORT_STATEMENT:
+        return True
+    target = _assignment_target(holder, value)
+    if target is None:
+        return False
+    if target.type == cs.TS_IDENTIFIER:
+        return safe_decode_text(target) == cs.JS_EXPORTS_KEYWORD
+    if target.type != cs.TS_MEMBER_EXPRESSION:
+        return False
+    owner = target.child_by_field_name(cs.FIELD_OBJECT)
+    member = target.child_by_field_name(cs.FIELD_PROPERTY)
+    return (
+        owner is not None
+        and member is not None
+        and safe_decode_text(owner) == cs.JS_MODULE_KEYWORD
+        and safe_decode_text(member) == cs.JS_EXPORTS_KEYWORD
+    )
+
+
+def _assignment_target(holder: Node, value: Node) -> Node | None:
+    if (
+        holder.type != cs.TS_JS_ASSIGNMENT_EXPRESSION
+        or holder.child_by_field_name(cs.FIELD_RIGHT) != value
+    ):
+        return None
+    return holder.child_by_field_name(cs.FIELD_LEFT)
+
+
+def _stored_under_name(holder: Node, value: Node) -> str | None:
+    # The name `holder` stores `value` under: an object key, an assignment
+    # target (its property, for `a.b = ...`), or a declarator / class field.
+    if holder.type == cs.TS_PY_PAIR:
+        key = holder.child_by_field_name(cs.FIELD_KEY)
+        if key is None or holder.child_by_field_name(cs.FIELD_VALUE) != value:
+            return None
+        return safe_decode_text(key)
+    if holder.type == cs.TS_JS_ASSIGNMENT_EXPRESSION:
+        target = _assignment_target(holder, value)
+        if target is not None and target.type == cs.TS_MEMBER_EXPRESSION:
+            target = target.child_by_field_name(cs.FIELD_PROPERTY)
+        return safe_decode_text(target) if target is not None else None
+    return _value_binding_name(value)
+
+
 def class_binding_name(class_node: Node) -> str | None:
     # An anonymous CLASS EXPRESSION (`static Proxy = class {...}`,
     # `const Proxy = class {...}`) has no `name` field. Recover the field /
```

**File**: `codebase_rag/tests/test_call_resolver.py` (modified, +3/-0)
```diff
@@ -86,6 +86,9 @@ def mark_abstract(self, qn: QualifiedName) -> None:
     def is_abstract(self, qn: QualifiedName) -> bool:
         return qn in self._abstracts
 
+    def is_body_scoped_name(self, qn: QualifiedName) -> bool:
+        return False
+
 
 @pytest.fixture
 def mock_function_registry() -> MockFunctionRegistry:
```

---

### Incident Patch 10: `2561d500` (2026-10-03)
**Commit Message**: fix(rename): resolve a call site with no recorded end

A CALLS row with a start but no end was given a synthetic end before the
call lookup, which then found no call ending there and refused the rename
as stale. The lookup now gets no end, so it picks the outermost call; the
synthetic span is kept for the text fallback only.

**File**: `codebase_rag/editing/rename.py` (modified, +12/-5)
```diff
@@ -299,8 +299,8 @@ def _last_identifier(
     source: bytes,
     line: int,
     col: int,
-    end_line: int,
-    end_col: int,
+    end_line: int | None,
+    end_col: int | None,
     name: str,
     language: cs.SupportedLanguage | None = None,
     is_call: bool = False,
@@ -312,7 +312,14 @@ def _last_identifier(
     its arguments; for any other site it is the rightmost `name` in the span.
     """
     start = line_col_to_byte(source, line, col)
-    end = line_col_to_byte(source, end_line, end_col)
+    # A site with no recorded end gets a span that covers the name, for the
+    # text fallback only: handed to the call lookup it would read as a
+    # recorded end that no call matches, and mark a live call stale.
+    end = line_col_to_byte(
+        source,
+        end_line if end_line is not None else line,
+        end_col if end_col is not None else col + len(name),
+    )
     callee = _callee_span(source, language, line, col, end_line, end_col)
     if callee is None and is_call and _calls_start_at(source, language, line, col):
         # Calls DO start at the recorded position but none ends where the
@@ -556,8 +563,8 @@ def _add_site(
             source,
             line,
             col,
-            end_line if isinstance(end_line, int) else line,
-            end_col if isinstance(end_col, int) else col + len(old_name),
+            end_line if isinstance(end_line, int) else None,
+            end_col if isinstance(end_col, int) else None,
             old_name,
             get_language_for_extension(Path(path).suffix),
             is_call=kind == "call",
```

**File**: `codebase_rag/tests/test_rename_stale_call_site.py` (modified, +7/-0)
```diff
@@ -36,3 +36,10 @@ def test_a_reference_site_is_not_treated_as_a_stale_call() -> None:
     token = _last_identifier(SOURCE, 2, 4, 2, 15, "helper", LANG, is_call=False)
     assert token is not None
     assert token != _STALE_CALL
+
+
+def test_a_call_site_with_no_recorded_end_names_the_outer_callee() -> None:
+    # A CALLS row with a start but no end must not be held to a synthetic
+    # end: no call ends there, so it read as stale and refused the rename.
+    token = _last_identifier(SOURCE, 2, 4, None, None, "helper", LANG, is_call=True)
+    assert token == (2, 4)
```

---

### Incident Patch 11: `559f6e1c` (2026-10-03)
**Commit Message**: fix(context): keep excerpts inside the project root

An indexed path that is a symlink out of the project made the target
excerpt fall back to reading the outside file. The excerpt reader now
resolves the path and returns nothing when it leaves the root, as
graph_query.definition already does.

**File**: `codebase_rag/context_slice.py` (modified, +7/-1)
```diff
@@ -107,7 +107,13 @@ def _normalise(text: str) -> str:
 def _lines(repo_root: Path | None, path: str | None, start: int, end: int) -> str:
     if repo_root is None or not path or start < 1 or end < start:
         return ""
-    return _normalise(extract_source_lines(repo_root / path, start, end) or "")
+    # Same containment as graph_query.definition: an indexed path that is a
+    # symlink out of the project must not leak its target through a fallback.
+    root = repo_root.resolve()
+    candidate = (root / path).resolve()
+    if not candidate.is_relative_to(root):
+        return ""
+    return _normalise(extract_source_lines(candidate, start, end) or "")
 
 
 def _line(repo_root: Path | None, path: str | None, line: int | None) -> str:
```

**File**: `codebase_rag/tests/test_context_slice_normalisation.py` (modified, +23/-0)
```diff
@@ -223,3 +223,26 @@ def test_a_target_missing_from_the_graph_yields_no_excerpt(tmp_path: Path) -> No
 
     assert piece.source == "", repr(piece.source)
     assert "import os" not in piece.source, repr(piece.source)
+
+
+# graph_query.definition drops source for a path that resolves outside the
+# project, and the target excerpt then falls back to _lines. An indexed
+# symlink pointing out of the project must read as empty there too, or the
+# MCP `context` tool would return the outside file's contents.
+def test_an_excerpt_through_a_symlink_out_of_the_project_is_empty(
+    tmp_path: Path,
+) -> None:
+    from codebase_rag.context_slice import _lines
+
+    outside = tmp_path / "outside.py"
+    outside.write_text("SECRET = 1\nTOKEN = 2\n", encoding=cs.ENCODING_UTF8)
+    root = tmp_path / "proj"
+    root.mkdir()
+    (root / "inside.py").write_text("A = 1\nB = 2\n", encoding=cs.ENCODING_UTF8)
+    try:
+        (root / "leak.py").symlink_to(outside)
+    except OSError:
+        pytest.skip("symlinks are not available here")
+
+    assert _lines(root, "leak.py", 1, 2) == ""
+    assert _lines(root, "inside.py", 1, 2) == "A = 1\nB = 2"
```

---

### Incident Patch 12: `82a3f98f` (2026-09-29)
**Commit Message**: fix(context): scope the MCP tool's free-text search to the resolved project

With `project` omitted, _graph_query reads the project the server's root
derives to, but the semantic-search callback still passed the raw None,
so free text could resolve to another project's symbol that the
project-scoped reads then could not find. The callback now searches the
resolved project_name, and the now-unused argument is dropped.

**File**: `codebase_rag/mcp/tools.py` (modified, +6/-3)
```diff
@@ -2973,16 +2973,19 @@ async def context(
         return await self._graph_query(
             cs.MCPToolName.CONTEXT,
             project,
-            lambda name: self._run_context(name, target, budget_tokens, project),
+            lambda name: self._run_context(name, target, budget_tokens),
         )
 
     def _run_context(
-        self, project_name: str, target: str, budget_tokens: int, project: str | None
+        self, project_name: str, target: str, budget_tokens: int
     ) -> object:
         from codebase_rag.context_slice import context as build_context
 
+        # Scoped to the project `_graph_query` resolved, not the optional
+        # argument: an omitted `project` would otherwise search every project
+        # and resolve to a name the project-scoped reads cannot find.
         def search(text: str) -> list[SemanticSearchResult]:
-            return semantic_code_search(self.ingestor, text, project=project)
+            return semantic_code_search(self.ingestor, text, project=project_name)
 
         return build_context(
             self.ingestor.fetch_all,
```

**File**: `codebase_rag/tests/test_context_source_root.py` (modified, +44/-0)
```diff
@@ -141,3 +141,47 @@ def test_cli_context_exits_nonzero_when_nothing_matches(
     assert cs.CONTEXT_UNRESOLVED.format(target=f"{LOCAL}.pkg.mod.missing") in (
         result.stderr
     )
+
+
+async def test_mcp_context_scopes_free_text_search_to_the_resolved_project(
+    graph: tuple[Path, _StatefulIngestor], monkeypatch: pytest.MonkeyPatch
+) -> None:
+    # With `project` omitted the tool reads the project this server's root
+    # derives to; the embedding search that resolves free text must be held
+    # to that same project, or it can pick another project's symbol that the
+    # project-scoped reads then cannot find.
+    from codebase_rag.mcp import tools as mcp_tools
+    from codebase_rag.mcp.tools import MCPToolsRegistry
+    from codebase_rag.utils.path_utils import derive_project_name
+
+    local_root, store = graph
+    ingestor = MagicMock()
+    ingestor.fetch_all = store.fetch_all
+    ingestor.list_projects.return_value = [LOCAL, OTHER]
+    registry = MCPToolsRegistry(
+        project_root=str(local_root), ingestor=ingestor, cypher_gen=MagicMock()
+    )
+    registry._semantic_search_tool = MagicMock()
+    scopes: list[str | None] = []
+
+    def fake_search(
+        _ingestor: object, _text: str, top_k: int = 5, project: str | None = None
+    ) -> list:
+        scopes.append(project)
+        return [
+            {
+                "node_id": 1,
+                "qualified_name": f"{project}.pkg.mod.f",
+                "name": "f",
+                "type": "Function",
+                "score": 0.9,
+            }
+        ]
+
+    monkeypatch.setattr(mcp_tools, "semantic_code_search", fake_search)
+
+    derived = derive_project_name(local_root)
+    payload = await registry.context(target="return the checkout source")
+    assert scopes == [derived]
+    assert isinstance(payload, dict)
+    assert payload["resolved"] == f"{derived}.pkg.mod.f"
```

---

### Incident Patch 13: `b7c26501` (2026-09-29)
**Commit Message**: fix(context): read the slice's source from the selected project's root

Both entry points passed the current checkout to build_context, so a
project indexed elsewhere whose relative path also exists locally got the
local file's lines as its excerpts. The MCP tool now takes the root from
_source_root_for(project) and `cgr context` from
graph_query.source_root_for, the way definition does: a project not
indexed from this checkout gets no excerpt instead of the wrong one.

**File**: `codebase_rag/cli.py` (modified, +2/-1)
```diff
@@ -1892,6 +1892,7 @@ def context_command(
     ),
     project: str | None = typer.Option(None, "--project", help=ch.HELP_GRAPH_PROJECT),
 ) -> None:
+    from . import graph_query
     from .context_slice import context as build_context
     from .graph_cli import _project_and_fetch
     from .tools.semantic_search import semantic_code_search
@@ -1903,7 +1904,7 @@ def context_command(
             name,
             target,
             budget,
-            repo_path.resolve(),
+            graph_query.source_root_for(fetch_all, name, repo_path),
             search=lambda text: semantic_code_search(ingestor, text, project=name),  # type: ignore[arg-type]
         )
     typer.echo(json.dumps(payload, indent=cs.MCP_JSON_INDENT))
```

**File**: `codebase_rag/mcp/tools.py` (modified, +1/-1)
```diff
@@ -2989,7 +2989,7 @@ def search(text: str) -> list[SemanticSearchResult]:
             project_name,
             target,
             budget_tokens,
-            Path(self.project_root),
+            self._source_root_for(project_name),
             search=search if self._semantic_search_tool is not None else None,
         )
 
```

**File**: `codebase_rag/tests/test_context_source_root.py` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+"""The context slice reads source only from the selected project's own root
+(issue #1536).
+
+Both entry points accept a project other than the checkout they run in. A
+definition of that project carries a repo-relative path that may also exist
+in the local checkout, so reading it there would return local source labelled
+as the selected project's. The slice must take its source root from the
+Project node's stored root, the way `definition` does, and answer a foreign
+project with no excerpt rather than the wrong one.
+"""
+
+from __future__ import annotations
+
+import contextlib
+import json
+from pathlib import Path
+from unittest.mock import MagicMock
+
+import pytest
+from typer.testing import CliRunner
+
+from codebase_rag import constants as cs
+from evals.cgr_graph import _StatefulIngestor
+
+LOCAL = "local"
+OTHER = "other"
+REL = "pkg/mod.py"
+LOCAL_BODY = "def f():\n    return 'local checkout source'\n"
+
+
+def _function(store: _StatefulIngestor, project: str) -> str:
+    qn = f"{project}.pkg.mod.f"
+    store.ensure_node_batch(
+        cs.NodeLabel.FUNCTION.value,
+        {
+            cs.KEY_QUALIFIED_NAME: qn,
+            cs.KEY_NAME: "f",
+            cs.KEY_PATH: REL,
+            cs.KEY_START_LINE: 1,
+            cs.KEY_END_LINE: 2,
+        },
+    )
+    return qn
+
+
+@pytest.fixture
+def graph(temp_repo: Path) -> tuple[Path, _StatefulIngestor]:
+    local_root = temp_repo / LOCAL
+    (local_root / "pkg").mkdir(parents=True)
+    (local_root / REL).write_text(LOCAL_BODY)
+    store = _StatefulIngestor()
+    for name, root in ((LOCAL, local_root), (OTHER, temp_repo / OTHER)):
+        store.ensure_node_batch(
+            cs.NodeLabel.PROJECT.value,
+            {cs.KEY_NAME: name, cs.KEY_ROOT_PATH: str(root.resolve())},
+        )
+        _function(store, name)
+    return local_root, store
+
+
+def _sources(payload: object) -> str:
+    assert isinstance(payload, dict)
+    return "\n".join(piece["source"] for piece in payload["pieces"])
+
+
+async def test_mcp_context_reads_no_local_source_for_another_project(
+    graph: tuple[Path, _StatefulIngestor],
+) -> None:
+    from codebase_rag.mcp.tools import MCPToolsRegistry
+
+    local_root, store = graph
+    ingestor = MagicMock()
+    ingestor.fetch_all = store.fetch_all
+    ingestor.list_projects.return_value = [LOCAL, OTHER]
+    registry = MCPToolsRegistry(
+        project_root=str(local_root), ingestor=ingestor, cypher_gen=MagicMock()
+    )
+
+    foreign = await registry.context(
+        target=f"{OTHER}.pkg.mod.f", budget_tokens=500, project=OTHER
+    )
+    assert isinstance(foreign, dict) and foreign["resolved"] == f"{OTHER}.pkg.mod.f"
+    assert "local checkout source" not in _sources(foreign)
+
+    # The project indexed from this checkout still gets its excerpt.
+    own = await registry.context(
+        target=f"{LOCAL}.pkg.mod.f", budget_tokens=500, project=LOCAL
+    )
+    assert "local checkout source" in _sources(own)
+
+
+def test_cli_context_reads_no_local_source_for_another_project(
+    graph: tuple[Path, _StatefulIngestor], monkeypatch: pytest.MonkeyPatch
+) -> None:
+    from codebase_rag import graph_cli
+    from codebase_rag.cli import app
+
+    local_root, store = graph
+
+    def fake_project_and_fetch(project: str | None, repo_path: Path) -> tuple:
+        return project or LOCAL, store.fetch_all, contextlib.nullcontext()
+
+    monkeypatch.setattr(graph_cli, "_project_and_fetch", fake_project_and_fetch)
+
+    def run(project: str) -> str:
+        result = CliRunner().invoke(
+            app,
+            [
+                "context",
+                f"{project}.pkg.mod.f",
+                "--repo-path",
+                str(local_root),
+                "--project",
+                project,
+            ],
+        )
+        assert result.exit_code == 0, result.output
+        return _sources(json.loads(result.stdout))
+
+    assert "local checkout source" not in run(OTHER)
+    assert "local checkout source" in run(LOCAL)
```

---

### Incident Patch 14: `bed6ccf2` (2026-10-03)
**Commit Message**: fix(mcp): show the TARGET_REPO_PATH hint only for a repo-path error

`cgr mcp-server` treated every `ValueError` as a configuration error
and always added "Hint: Make sure TARGET_REPO_PATH environment variable
is set." So the refusal to bind HTTP to 0.0.0.0 without a token, an
unknown workspace and a missing API key all sent the user to a variable
that was set.

`get_project_root` now raises `RepoPathError`, a `ValueError` subclass,
for a root that is missing or not a directory, and the CLI adds the hint
only for that. Every other configuration error prints alone, still on
stderr with exit code 1.

Fixes #2881

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01EbsCWQcSTGQXv3g5sk418m

**File**: `codebase_rag/cli.py` (modified, +4/-1)
```diff
@@ -1411,7 +1411,10 @@ def mcp_server(
         _mcp_server_notice(style(cs.CLI_MSG_APP_TERMINATED, cs.Color.RED))
     except ValueError as e:
         _mcp_server_notice(style(cs.CLI_ERR_CONFIG.format(error=e), cs.Color.RED))
-        if not settings.QUIET:
+        # Only a bad repository root is about TARGET_REPO_PATH. The HTTP bind
+        # refusal, an unknown workspace or a missing API key are ValueErrors
+        # too, and the hint sent the user to a variable that was set (#2881).
+        if isinstance(e, ex.RepoPathError) and not settings.QUIET:
             _mcp_server_notice(style(cs.CLI_MSG_HINT_TARGET_REPO, cs.Color.YELLOW))
         raise typer.Exit(1) from e
     except Exception as e:
```

**File**: `codebase_rag/exceptions.py` (modified, +9/-0)
```diff
@@ -181,6 +181,15 @@ class ReadOnlyQueryError(Exception):
     """An untrusted query would write, so it was never executed."""
 
 
+class RepoPathError(ValueError):
+    """The repository root the MCP server was pointed at is missing or no directory.
+
+    A `ValueError` like every other configuration error, so existing handlers
+    still catch it. Its own type is what lets `cgr mcp-server` add the
+    `TARGET_REPO_PATH` hint to this error and no other (issue #2881).
+    """
+
+
 # Deriving from Exception would let every `except Exception` handler between
 # the embeddings pass and the top level swallow a Ctrl+C (python:S5709
 # accepted).
```

**File**: `codebase_rag/mcp/server.py` (modified, +3/-2)
```diff
@@ -14,6 +14,7 @@
 from mcp.types import CallToolResult, TextContent, Tool
 
 from codebase_rag import constants as cs
+from codebase_rag import exceptions as ex
 from codebase_rag import logs as lg
 from codebase_rag import tool_errors as te
 from codebase_rag.config import settings
@@ -61,10 +62,10 @@ def get_project_root() -> Path:
     project_root = Path(repo_path).resolve()
 
     if not project_root.exists():
-        raise ValueError(te.MCP_PATH_NOT_EXISTS.format(path=project_root))
+        raise ex.RepoPathError(te.MCP_PATH_NOT_EXISTS.format(path=project_root))
 
     if not project_root.is_dir():
-        raise ValueError(te.MCP_PATH_NOT_DIR.format(path=project_root))
+        raise ex.RepoPathError(te.MCP_PATH_NOT_DIR.format(path=project_root))
 
     logger.info(lg.MCP_SERVER_ROOT_RESOLVED.format(path=project_root))
     return project_root
```

**File**: `codebase_rag/tests/test_mcp_server_config_hint.py` (added, +153/-0)
```diff
@@ -0,0 +1,153 @@
+"""Issue #2881: the `TARGET_REPO_PATH` hint follows only a repository-path error.
+
+`cgr mcp-server` caught every `ValueError` as a configuration error and always
+added "Hint: Make sure TARGET_REPO_PATH environment variable is set." So the
+refusal to bind HTTP to 0.0.0.0 without a token, an unknown workspace or a
+missing API key all sent the user to a variable that was set.
+"""
+
+from __future__ import annotations
+
+from collections.abc import Iterator
+from pathlib import Path
+from unittest.mock import MagicMock, PropertyMock, patch
+
+import pytest
+import typer
+
+from codebase_rag import cli
+from codebase_rag import constants as cs
+from codebase_rag.config import AppConfig
+from codebase_rag.mcp import server as srv
+
+HINT = "TARGET_REPO_PATH environment variable"
+
+
+@pytest.fixture(autouse=True)
+def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
+    root = tmp_path / "repo"
+    root.mkdir()
+    monkeypatch.setenv(cs.MCPEnvVar.TARGET_REPO_PATH, str(root))
+    monkeypatch.delenv(cs.MCPEnvVar.MCP_WORKSPACE, raising=False)
+    with (
+        patch.object(srv, "setup_logging"),
+        patch.object(cli.settings, "QUIET", False),
+    ):
+        yield root
+
+
+def _serve(
+    transport: cs.MCPTransport = cs.MCPTransport.STDIO,
+    host: str = "127.0.0.1",
+    workspace: str | None = None,
+) -> int:
+    # Every case is refused before the server binds, so the port is unused.
+    try:
+        cli.mcp_server(transport=transport, host=host, port=18765, workspace=workspace)
+    except typer.Exit as exit_:
+        return exit_.exit_code
+    return 0
+
+
+def test_the_http_bind_refusal_has_no_repo_path_hint(
+    capsys: pytest.CaptureFixture[str],
+) -> None:
+    with patch.object(srv.settings, "MCP_HTTP_AUTH_TOKEN", None):
+        code = _serve(cs.MCPTransport.HTTP, host="0.0.0.0")
+
+    _out, err = capsys.readouterr()
+    assert code == 1
+    assert "Refusing to bind the HTTP MCP server to 0.0.0.0" in err
+    assert HINT not in err
+
+
+def test_an_unknown_workspace_has_no_repo_path_hint(
+    capsys: pytest.CaptureFixture[str],
+) -> None:
+    code = _serve(workspace="no-such-workspace-2881")
+
+    _out, err = capsys.readouterr()
+    assert code == 1
+    assert "no-such-workspace-2881" in err
+    assert HINT not in err
+
+
+def test_a_missing_api_key_has_no_repo_path_hint(
+    capsys: pytest.CaptureFixture[str],
+) -> None:
+    config = MagicMock()
+    config.validate_api_key.side_effect = ValueError("provider requires api_key")
+    with patch.object(
+        AppConfig,
+        "active_orchestrator_config",
+        new_callable=PropertyMock,
+        return_value=config,
+    ):
+        code = _serve()
+
+    _out, err = capsys.readouterr()
+    assert code == 1
+    assert "provider requires api_key" in err
+    assert HINT not in err
+
+
+# Negative: what must not change.
+
+
+def test_a_missing_repo_path_still_gets_the_hint(
+    repo: Path,
+    monkeypatch: pytest.MonkeyPatch,
+    capsys: pytest.CaptureFixture[str],
+) -> None:
+    monkeypatch.setenv(cs.MCPEnvVar.TARGET_REPO_PATH, str(repo / "missing"))
+
+    code = _serve()
+
+    _out, err = capsys.readouterr()
+    assert code == 1
+    assert "Target repository path does not exist" in err
+    assert HINT in err
+
+
+def test_a_repo_path_that_is_a_file_still_gets_the_hint(
+    repo: Path,
+    monkeypatch: pytest.MonkeyPatch,
+    capsys: pytest.CaptureFixture[str],
+) -> None:
+    afile = repo / "afile.txt"
+    afile.write_text("x", encoding="utf-8")
+    monkeypatch.setenv(cs.MCPEnvVar.TARGET_REPO_PATH, str(afile))
+
+    code = _serve()
+
+    _out, err = capsys.readouterr()
+    assert code == 1
+    assert "Target repository path is not a directory" in err
+    assert HINT in err
+
+
+def test_quiet_still_drops_the_hint(
+    repo: Path,
+    monkeypatch: pytest.MonkeyPatch,
+    capsys: pytest.CaptureFixture[str],
+) -> None:
+    monkeypatch.setenv(cs.MCPEnvVar.TARGET_REPO_PATH, str(repo / "missing"))
+
+    with patch.object(cli.settings, "QUIET", True):
+        code = _serve()
+
+    _out, err = capsys.readouterr()
+    assert code == 1
+    assert "Target repository path does not exist" in err
+    assert HINT not in err
+
+
+def test_the_bind_refusal_is_still_a_configuration_error(
+    capsys: pytest.CaptureFixture[str],
+) -> None:
+    with patch.object(srv.settings, "MCP_HTTP_AUTH_TOKEN", None):
+        _serve(cs.MCPTransport.HTTP, host="0.0.0.0")
+
+    out, err = capsys.readouterr()
+    assert out == ""
+    assert err.startswith("Configuration Error: Refusing to bind")
```

---

### Incident Patch 15: `4cce83ce` (2026-10-03)
**Commit Message**: fix(rename): name the CLI's --allow-heuristic in the CLI refusal

A rename refused for heuristic, overload or trace-only sites told every
caller to "pass allow_heuristic". That is the MCP parameter; on the
command line it is read as an extra positional argument, a usage error.

The refusal now names the opt-in as the caller spells it. `rename()`
takes `heuristic_opt_in` (default: the MCP parameter name), the CLI
passes `--allow-heuristic` (now a constant, shared with the option it
declares) and the MCP handler passes `allow_heuristic` explicitly.

Fixes #2886

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01EbsCWQcSTGQXv3g5sk418m

**File**: `codebase_rag/cli.py` (modified, +2/-1)
```diff
@@ -1632,7 +1632,7 @@ def rename_command(
     ),
     project: str | None = typer.Option(None, "--project", help=ch.HELP_GRAPH_PROJECT),
     allow_heuristic: bool = typer.Option(
-        False, "--allow-heuristic", help=ch.HELP_RENAME_ALLOW_HEURISTIC
+        False, cs.RENAME_CLI_ALLOW_HEURISTIC, help=ch.HELP_RENAME_ALLOW_HEURISTIC
     ),
     dry_run: bool = typer.Option(False, "--dry-run", help=ch.HELP_RENAME_DRY_RUN),
 ) -> None:
@@ -1661,6 +1661,7 @@ def rename_command(
                 allow_heuristic=allow_heuristic,
                 dry_run=dry_run,
                 reingest=updater.reingest,
+                heuristic_opt_in=cs.RENAME_CLI_ALLOW_HEURISTIC,
             )
         except RenameRefused as refused:
             typer.echo(str(refused), err=True)
```

**File**: `codebase_rag/constants/cli.py` (modified, +4/-1)
```diff
@@ -704,10 +704,13 @@ class DiffMarker:
     "The index names a file the tree no longer has; re-index and retry."
 )
 RENAME_BAD_NAME = "Not a valid identifier: {name}"
+# `{option}` is the opt-in as the caller spells it: `--allow-heuristic` on the
+# command line, `allow_heuristic` in MCP (issue #2886).
 RENAME_AMBIGUOUS = (
     "Refusing to rename {qn}: {count} site(s) were resolved heuristically, by overload "
-    "fan-out, or only by a trace; pass allow_heuristic to rewrite through them"
+    "fan-out, or only by a trace; pass {option} to rewrite through them"
 )
+RENAME_CLI_ALLOW_HEURISTIC = "--allow-heuristic"
 RENAME_UNLOCATABLE_SITE = "{owner}: site cannot be located ({resolution})"
 RENAME_SITELESS = (
     "Cannot rename {qn}: {count} graph-known site(s) carry no rewrite location, "
```

**File**: `codebase_rag/editing/rename.py` (modified, +9/-1)
```diff
@@ -386,6 +386,7 @@ def __init__(
         verify: Callable[[StagedTree], VerificationResult | bool | None] | None = None,
         after_apply: Callable[[list[str]], None] | None = None,
         reingest: Reingest | None = None,
+        heuristic_opt_in: str = cs.MCPParamName.ALLOW_HEURISTIC,
     ) -> None:
         self.repo_root = repo_root.resolve()
         self.fetch_all = fetch_all
@@ -396,6 +397,9 @@ def __init__(
         # (issue #1531): the delta of what it wrote is measured and the
         # transaction undone when the contract fails.
         self.reingest = reingest
+        # How the caller spells the opt-in the heuristic refusal tells the
+        # user to pass: a CLI flag is not an MCP parameter (issue #2886).
+        self.heuristic_opt_in = heuristic_opt_in
 
     def _module_of(self, qn: str) -> tuple[str, str | None]:
         # The defining module's qn and path, from the definition's own path:
@@ -718,7 +722,9 @@ def plan(
         ]
         if ambiguous and not allow_heuristic:
             raise RenameRefused(
-                cs.RENAME_AMBIGUOUS.format(qn=qn, count=len(ambiguous)),
+                cs.RENAME_AMBIGUOUS.format(
+                    qn=qn, count=len(ambiguous), option=self.heuristic_opt_in
+                ),
                 ambiguous,
                 unlocatable,
             )
@@ -1277,6 +1283,7 @@ def rename(
     verify: Callable[[StagedTree], VerificationResult | bool | None] | None = None,
     after_apply: Callable[[list[str]], None] | None = None,
     reingest: Reingest | None = None,
+    heuristic_opt_in: str = cs.MCPParamName.ALLOW_HEURISTIC,
 ) -> RenameReport:
     """The op: plan (and refuse on ambiguity) or plan and apply.
 
@@ -1290,6 +1297,7 @@ def rename(
         verify=verify,
         after_apply=after_apply,
         reingest=reingest,
+        heuristic_opt_in=heuristic_opt_in,
     )
     if dry_run:
         return renamer.preview(qualified_name, new_name, allow_heuristic)
```

**File**: `codebase_rag/mcp/tools.py` (modified, +1/-0)
```diff
@@ -3127,6 +3127,7 @@ def _run_rename(
                 allow_heuristic=allow_heuristic,
                 dry_run=dry_run,
                 reingest=reingest,
+                heuristic_opt_in=cs.MCPParamName.ALLOW_HEURISTIC,
             )
         except RenameRefused as refused:
             return {
```

**File**: `codebase_rag/tests/test_rename_heuristic_opt_in_name.py` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+"""Issue #2886: a heuristic rename refusal names the opt-in each front end takes.
+
+The refusal read "pass allow_heuristic to rewrite through them" everywhere.
+That is the MCP parameter. On the command line the option is
+`--allow-heuristic`, and `cgr rename ... allow_heuristic` is read as an extra
+positional argument.
+"""
+
+from __future__ import annotations
+
+import re
+from pathlib import Path
+from unittest.mock import MagicMock, patch
+
+import pytest
+import typer
+from typer.core import TyperCommand, TyperGroup
+from typer.testing import CliRunner, Result
+
+from codebase_rag import cli_help as ch
+from codebase_rag import constants as cs
+from codebase_rag.cli import app
+from codebase_rag.mcp.tools import MCPToolsRegistry
+from codebase_rag.tests.test_rename_op import RecordedGraph, _index, _write
+
+OPT_IN = re.compile(r"pass (\S+) to rewrite through them")
+
+
+@pytest.fixture
+def heuristic_repo(tmp_path: Path) -> tuple[Path, RecordedGraph]:
+    root = tmp_path / "heur"
+    _write(root, "pkg/__init__.py", "")
+    _write(root, "pkg/util.py", "def lonely():\n    return 1\n")
+    # Not imported: the call binds by name alone, so its site is heuristic.
+    _write(root, "pkg/app.py", "def run():\n    return lonely()\n")
+    return root, _index(root, MagicMock())
+
+
+def _cli_rename(repo: tuple[Path, RecordedGraph], new_name: str, *extra: str) -> Result:
+    root, graph = repo
+    with patch(
+        "codebase_rag.graph_cli._project_and_fetch",
+        return_value=(graph.project, graph.fetch_all, MagicMock()),
+    ):
+        return CliRunner().invoke(
+            app,
+            [
+                "rename",
+                f"{graph.project}.pkg.util.lonely",
+                new_name,
+                "--repo-path",
+                str(root),
+                *extra,
+            ],
+        )
+
+
+def _rename_options() -> set[str]:
+    command = typer.main.get_command(app)
+    assert isinstance(command, TyperGroup)
+    rename = command.commands[ch.CLICommandName.RENAME]
+    assert isinstance(rename, TyperCommand)
+    return {opt for param in rename.params for opt in param.opts}
+
+
+def _mcp_refusal(repo: tuple[Path, RecordedGraph]) -> str:
+    root, graph = repo
+    ingestor = MagicMock()
+    ingestor.fetch_all = graph.fetch_all
+    with patch("codebase_rag.mcp.tools.load_parsers", return_value=({}, {})):
+        registry = MCPToolsRegistry(
+            project_root=str(root), ingestor=ingestor, cypher_gen=MagicMock()
+        )
+    result = registry._run_rename(
+        graph.project, f"{graph.project}.pkg.util.lonely", "alone", False, True
+    )
+    assert isinstance(result, dict)
+    return str(result[cs.DICT_KEY_ERROR])
+
+
+def test_the_cli_refusal_names_the_cli_flag(
+    heuristic_repo: tuple[Path, RecordedGraph],
+) -> None:
+    result = _cli_rename(heuristic_repo, "alone", "--dry-run")
+
+    assert result.exit_code == 1
+    assert "pass --allow-heuristic to rewrite through them" in result.stderr
+
+
+def test_the_flag_the_cli_names_is_one_it_accepts(
+    heuristic_repo: tuple[Path, RecordedGraph],
+) -> None:
+    result = _cli_rename(heuristic_repo, "alone", "--dry-run")
+
+    named = OPT_IN.search(result.stderr)
+    assert named is not None, result.stderr
+    assert named.group(1) in _rename_options()
+
+
+def test_the_cli_refusal_does_not_name_the_mcp_parameter(
+    heuristic_repo: tuple[Path, RecordedGraph],
+) -> None:
+    result = _cli_rename(heuristic_repo, "alone", "--dry-run")
+
+    assert cs.MCPParamName.ALLOW_HEURISTIC not in result.stderr
+
+
+# Negative: what must not change.
+
+
+def test_the_mcp_refusal_still_names_the_parameter(
+    heuristic_repo: tuple[Path, RecordedGraph],
+) -> None:
+    refusal = _mcp_refusal(heuristic_repo)
+
+    assert "pass allow_heuristic to rewrite through them" in refusal
+
+
+def test_the_mcp_refusal_still_counts_the_heuristic_sites(
+    heuristic_repo: tuple[Path, RecordedGraph],
+) -> None:
+    refusal = _mcp_refusal(heuristic_repo)
+
+    assert "1 site(s) were resolved heuristically" in refusal
+
+
+def test_the_cli_flag_still_lifts_the_refusal(
+    heuristic_repo: tuple[Path, RecordedGraph],
+) -> None:
+    result = _cli_rename(heuristic_repo, "alone", "--allow-heuristic", "--dry-run")
+
+    assert result.exit_code == 0, result.stderr
+    assert '"applied": false' in result.stdout
+
+
+def test_another_cli_refusal_is_printed_unchanged(
+    heuristic_repo: tuple[Path, RecordedGraph],
+) -> None:
+    result = _cli_rename(heuristic_repo, "1bad", "--dry-run")
+
+    assert result.exit_code == 1
+    assert result.stderr == cs.RENAME_BAD_NAME.format(name="1bad") + "\n"
```

#### Recent Merged Pull Requests:
- **PR #3068** (2026-10-05): ci: give the unit-test and SonarCloud jobs room for the grown suite (@vitali87)
- **PR #2995** (2026-10-05): test(context): list the server's derived project in the MCP scope test (@vitali87)
- **PR #2983** (2026-10-05): docs(mcp): document io capture for flow tools (@BLVCK-MAMBA-6)
- **PR #2904** (2026-10-04): fix(mcp): show the TARGET_REPO_PATH hint only for a repo-path error (@vitali87)
- **PR #2898** (2026-10-04): fix(rename): name the CLI's --allow-heuristic in the CLI refusal (@vitali87)
- **PR #2862** (2026-10-03): docs: add recorded demo GIFs to every feature page (@vitali87)
- **PR #2844** (2026-10-04): fix(trace): match Windows frames under a differently-cased directory (@vitali87)
- **PR #2833** (2026-10-04): fix(parsers): bind JS/TS calls through barrel re-exports to the definition (@vitali87)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
