# Forensic Learning Record (Deep Inspection): Graphify-Labs/graphify

> **Canonical Artifact**: `07_PROJECT_LEARNING/graphify-labs-graphify-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:20:41.860Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Graphify-Labs/graphify`
- **Description**: Turn any codebase, with its docs, SQL schemas, configs, and PDFs, into a queryable knowledge graph. A /graphify skill for Claude Code, Cursor, Codex, and Gemini CLI: local deterministic AST parsing, every edge explained, no vector store.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 124010 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `graphify/extractors/engine.py`
```
"""engine — moved verbatim from graphify/extract.py."""
from __future__ import annotations

import hashlib
import importlib
import json
from graphify.extractors.base import _LANGUAGE_BUILTIN_GLOBALS, _file_stem, _make_id, _read_text
from graphify.ids import normalize_id
from graphify.extractors.models import LanguageConfig
from graphify.extractors.resolution import _resolve_js_import_target
from graphify.security import sanitize_metadata
from pathlib import Path


def _csharp_namespace_id(dotted_name: str) -> str:
    digest = hashlib.sha1(dotted_name.encode("utf-8")).hexdigest()[:16]
    return f"csharp_namespace:{digest}"

# JSX tags that render a component (the closing tag repeats the name; not counted).
_JSX_ELEMENT_TYPES = frozenset({"jsx_opening_element", "jsx_self_closing_element"})

REFERENCE_CONTEXTS = frozenset({
    "field", "parameter_type", "return_type", "generic_arg", "attribute", "value", "type",
})

def _source_location(line: int | str | None) -> str | None:
    if line is None:
        return None
    if isinstance(line, str):
        return line if line.startswith("L") else f"L{line}"
    return f"L{line}"

def _semantic_reference_edge(
    source: str,
    target: str,
    context: str,
    source_file: str,
    line: int | str | None,
) -> dict:
    if context not in REFERENCE_CONTEXTS:
        raise ValueError(f"unknown reference context: {context}")
    return {
        "source": source,
        "target": target,
        "relation": "references",
        "context": context,
        "confidence": "EXTRACTED",
        "source_file": source_file,
        "source_location": _source_location(line),
        "weight": 1.0,
    }

_PYTHON_TYPE_CONTAINERS = frozenset({
    "list", "dict", "set", "tuple", "frozenset", "type",
    "List", "Dict", "Set", "Tuple", "FrozenSet", "Type",
    "Optional", "Union", "Sequence", "Iterable", "Mapping", "MutableMapping",
    "Iterator", "Callable", "Awaitable", "AsyncIterable", "AsyncIterator", "Coroutine",
    "Generator", "AsyncGenerator", "ContextManager", "AsyncContextManager",
    "Annotated", "ClassVar", "Final", "Literal", "Concatenate", "ParamSpec", "TypeVar",
    "None", "Ellipsis",
})

_PYTHON_ANNOTATION_NOISE = frozenset({
    # scalar builtins
    "str", "int", "float", "bool", "bytes", "bytearray", "complex", "object",
    "True", "False",
    # unittest.mock
    "MagicMock", "Mock", "AsyncMock", "NonCallableMock",
    "NonCallableMagicMock", "PropertyMock", "patch", "sentinel",
})

# Builtin/stdlib decorators (@property, @dataclass, @functools.wraps, …) are
# ambient vocabulary, not corpus symbols: emitting decorator edges for them
# fabricates sourceless stub nodes on nearly every class-heavy file, and the
# unique-function rewire can collapse them onto an unrelated local definition
# (a corpus defining its own `def wraps(...)` gets a false decorator edge).
# Same name-based tradeoff as `patch`/`Mock` in _PYTHON_ANNOTATION_NOISE.
_PYTHON_DECORATOR_NOISE = frozenset({
    "property", "staticmethod", "classmethod", "abstractmethod",
    "abstractproperty", "cached_property", "wraps", "lru_cache", "cache",
    "singledispatch", "singledispatchmethod", "total_ordering",
    "contextmanager", "asynccontextmanager", "overload", "override",
    "final", "no_type_check", "runtime_checkable", "dataclass",
})

def _python_collect_type_refs(node, source: bytes, generic: bool, out: list[tuple[str, str]]) -> None:
    """Walk a Python type annotation; append (name, role) where role is 'type' or 'generic_arg'.

    Builtin/typing containers (list, dict, Optional, Union, …) are not emitted as refs themselves,
    but their nested type arguments still count as generic_arg.
    """
    if node is None:
        return
    t = node.type
    if t == "type":
        for c in node.children:
            if c.is_named:
                _python_collect_type_refs(c, source, generic, out)
        return
    if t == "identifier":
        name = _read_text(node, source)
        if name and name not in _PYTHON_TYPE_CONTAINERS and name not in _PYTHON_ANNOTATION_NOISE:
            out.append((name, "generic_arg" if generic else "type"))
        return
    if t == "attribute":
        tail = _read_text(node, source).rsplit(".", 1)[-1]
        if tail and tail not in _PYTHON_TYPE_CONTAINERS and tail not in _PYTHON_ANNOTATION_NOISE:
            out.append((tail, "generic_arg" if generic else "type"))
        return
    if t == "generic_type":
        for c in node.children:
            if c.type == "identifier":
                container = _read_text(c, source)
                if container and container not in _PYTHON_TYPE_CONTAINERS and container not in _PYTHON_ANNOTATION_NOISE:
                    out.append((container, "generic_arg" if generic else "type"))
            elif c.type == "type_parameter":
                for sub in c.children:
                    if sub.is_named:
                        _python_collect_type_refs(sub, source, True, out)
        return
    if t == "subscript":
        value = node.child_by_field_name("value")
        if value is not None:
            _python_collect_type_refs(value, source, generic, out)
        for c in node.children:
            if c is value or not c.is_named:
                continue
            _python_collect_type_refs(c, source, True, out)
        return
    if node.is_named:
        for c in node.children:
            if c.is_named:
                _python_collect_type_refs(c, source, generic, out)

def _csharp_pre_scan_interfaces(root_node, source: bytes) -> set[str]:
    """Return names declared as `interface` in this C# compilation unit."""
    out: set[str] = set()
    stack = [root_node]
    while stack:
        n = stack.pop()
        if n.type == "interface_declaration":
            name_node = n.child_by_field_name("name")
            if name_node is not None:
                text = _read_text(name_node, source)
                if text:
                    out.add(text)
        stack.extend(n.children)
    return out

def _csharp_classify_base(name: str, interface_names: set[str]) -> str:
    """`implements` if the base name is an interface (declared or by I-prefix convention), else `inherits`."""
    if name in interface_names:
        return "implements"
    if len(name) >= 2 and name[0] == "I" and name[1].isupper():
        return "implements"
    return "inherits"

_CSHARP_TYPE_PARAMETER_SCOPE_DECLARATIONS = frozenset({
    "class_declaration",
    "interface_declaration",
    "record_declaration",
    "struct_declaration",
    "method_declaration",
})

def _csharp_type_parameters_in_scope(node, source: bytes) -> frozenset[str]:
    """Return C# type-parameter names visible from ``node``."""
    names: set[str] = set()
    scope = node
    while scope is not None:
        if scope.type in _CSHARP_TYPE_PARAMETER_SCOPE_DECLARATIONS:
            for child in scope.children:
                if child.type != "type_parameter_list":
                    continue
                for param in child.children:
                    if param.type == "type_parameter":
                        name_node = next(
                            (sub for sub in param.children if sub.type == "identifier"),
                            None,
                        )
                        if name_node is not None:
                            name = _read_text(name_node, source)
                            if name:
                                names.add(name)
                    elif param.type == "identifier":
                        name = _read_text(param, source)
                        if name:
                            names.add(name)
        scope = scope.parent
    return frozenset(names)

def _csharp_collect_type_refs(
    node,
    source: bytes,
    generic: bool,
    out: list[tuple[str, str, bool, str]],
    skip: frozenset[str] | None = None,
) -> None:
    """Walk a C# type expression; append (name, role, qualified, qualifier) tuples."""
    if node is None:
        return
    if skip is None:
        skip = _csharp_type_parameters_in_scope(node, source)
    t = node.type
    if t == "predefined_type":
        return
    if t == "identifier":
        name = _read_text(node, source)
        if name and name not in skip:
            out.append((name, "generic_arg" if generic else "type", False, ""))
        return
    if t == "qualified_name":
        prefix, _, text = _read_text(node, source).rpartition(".")
        text = text.split("<", 1)[0]
        if text and text not in skip:
            out.append((text, "generic_arg" if generic else "type", True, prefix))
        return
    if t == "generic_name":
        name_child = node.child_by_field_name("name")
        if name_child is None:
            for sub in node.children:
                if sub.type == "identifier":
                    name_child = sub
                    break
        if name_child is not None:
            qualified = name_child.type == "qualified_name"
            prefix, _, name = _read_text(name_child, source).rpartition(".")
            if name and name not in skip:
                out.append((name, "generic_arg" if generic else "type", qualified, prefix if qualified else ""))
        for sub in node.children:
            if sub.type == "type_argument_list":
                for arg in sub.children:
                    if arg.is_named:
                        _csharp_collect_type_refs(arg, source, True, out, skip)
        return
    if t in ("nullable_type", "array_type", "pointer_type", "ref_type"):
        for c in node.children:
            if c.is_named:
                _csharp_collect_type_refs(c, source, generic, out, skip)
        return
    if t == "tuple_type":
        # A named tuple element carries both a `type` and a `name` field
        # (`(int mode, string label)`). Only the `type` field feeds
        # type-reference collection; the `name` is an identifier, not a type
        # reference, and minting it produces junk "type" nodes 
```

### Core Architecture Module: `graphify/hooks.py`
```
# git hook integration - install/uninstall graphify post-commit and post-checkout hooks
from __future__ import annotations
import os
import re
import sys
from pathlib import Path

_HOOK_MARKER = "# graphify-hook-start"
_HOOK_MARKER_END = "# graphify-hook-end"
_CHECKOUT_MARKER = "# graphify-checkout-hook-start"
_CHECKOUT_MARKER_END = "# graphify-checkout-hook-end"

# __PINNED_PYTHON__ is replaced at install time with the absolute path of the
# Python interpreter that ran `graphify hook install`.  For uv-tool and pipx
# installs the interpreter lives inside an isolated venv, so the launcher on
# PATH is the only entry point — and GUI git clients / CI runners often have a
# minimal PATH that omits ~/.local/bin.  Pinning sys.executable at install time
# makes the hook work regardless of PATH at git-trigger time.
_PYTHON_DETECT = """\
# Detect the correct Python interpreter (handles uv tool, pipx, venv, system installs).
# _PINNED was recorded at hook-install time; tried first so the hook works even
# when the graphify launcher is not on PATH (common in GUI clients and CI).
#
# Probes check availability with importlib.util.find_spec instead of importing
# the package: a probe that imports graphify wholesale executes the full package
# import (10s+ cold on machines with AV-scanned or large site-packages) and used
# to run up to FOUR times synchronously, stalling every commit before the
# detached launch even started. find_spec locates the package without executing
# it, so each probe costs interpreter startup only. The detached rebuild still
# fails loudly in the log if the package is broken under that interpreter.
_GFY_PROBE="import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('graphify') else 1)"
GRAPHIFY_PYTHON=""
_PINNED='__PINNED_PYTHON__'
if [ -n "$_PINNED" ] && [ -x "$_PINNED" ] && "$_PINNED" -c "$_GFY_PROBE" 2>/dev/null; then
    GRAPHIFY_PYTHON="$_PINNED"
fi
# Second probe: read graphify-out/.graphify_python (written by the skill and
# CLI; survives uv-tool reinstalls and is the same source the README documents).
if [ -z "$GRAPHIFY_PYTHON" ]; then
    _GFY_PYTHON_FILE="graphify-out/.graphify_python"
    if [ -f "$_GFY_PYTHON_FILE" ]; then
        _FROM_FILE=$(cat "$_GFY_PYTHON_FILE" 2>/dev/null | tr -d '[:space:]')
        case "$_FROM_FILE" in
            *[!a-zA-Z0-9/_.@:\\\\-]*) _FROM_FILE="" ;;  # allowlist (covers Windows paths)
        esac
        if [ -n "$_FROM_FILE" ] && [ -x "$_FROM_FILE" ] && "$_FROM_FILE" -c "$_GFY_PROBE" 2>/dev/null; then
            GRAPHIFY_PYTHON="$_FROM_FILE"
        fi
    fi
fi
# Third probe: resolve via the graphify launcher on PATH.
if [ -z "$GRAPHIFY_PYTHON" ]; then
    GRAPHIFY_BIN=$(command -v graphify 2>/dev/null)
    if [ -n "$GRAPHIFY_BIN" ]; then
        # Windows pip layout: Scripts/graphify(.exe) sits beside ..\\python.exe
        # (or .\\python.exe inside a venv's Scripts dir). NOTE: command -v may
        # return the launcher path WITHOUT the .exe suffix, so this cannot key
        # on the extension.
        _GFY_BINDIR=$(dirname "$GRAPHIFY_BIN")
        if [ -x "$_GFY_BINDIR/../python.exe" ] && "$_GFY_BINDIR/../python.exe" -c "$_GFY_PROBE" 2>/dev/null; then
            GRAPHIFY_PYTHON="$_GFY_BINDIR/../python.exe"
        elif [ -x "$_GFY_BINDIR/python.exe" ] && "$_GFY_BINDIR/python.exe" -c "$_GFY_PROBE" 2>/dev/null; then
            GRAPHIFY_PYTHON="$_GFY_BINDIR/python.exe"
        fi
    fi
    if [ -z "$GRAPHIFY_PYTHON" ] && [ -n "$GRAPHIFY_BIN" ]; then
        # POSIX launcher: parse the shebang. head -c + tr strip NUL bytes first —
        # when the launcher is a Windows binary reached without its .exe suffix,
        # a raw `head -1` reads binary into the command substitution and the
        # shell warns about ignored null bytes on every commit. Gate on a
        # leading '#!': a launcher can also be a binary trampoline with no
        # shebang at all (uv tool installs on Windows), and its bytes must
        # never reach the shebang parse (#2852).
        case "$GRAPHIFY_BIN" in
            *.exe) _GFY_HEAD="" ;;
            *)     _GFY_HEAD=$(head -c 256 "$GRAPHIFY_BIN" 2>/dev/null | tr -d '\\000') ;;
        esac
        case "$_GFY_HEAD" in
            '#!'*) _SHEBANG=$(printf '%s\\n' "$_GFY_HEAD" | head -n 1 | sed 's/^#![[:space:]]*//') ;;
            *)     _SHEBANG="" ;;
        esac
        case "$_SHEBANG" in
            */env\\ *) GRAPHIFY_PYTHON="${_SHEBANG#*/env }" ;;
            *)         GRAPHIFY_PYTHON="$_SHEBANG" ;;
        esac
        # Allowlist: only keep characters valid in a filesystem path to prevent
        # injection if the shebang contains shell metacharacters.
        case "$GRAPHIFY_PYTHON" in
            *[!a-zA-Z0-9/_.@:\\\\-]*) GRAPHIFY_PYTHON="" ;;
        esac
        if [ -n "$GRAPHIFY_PYTHON" ] && ! "$GRAPHIFY_PYTHON" -c "$_GFY_PROBE" 2>/dev/null; then
            GRAPHIFY_PYTHON=""
        fi
    fi
fi
# Fourth probe: uv tool environments. `uv tool install` (the README's
# recommended method) puts graphify in an isolated venv that no ambient
# python can import, and on Windows its launcher on PATH is a binary
# trampoline with no shebang to parse — so the probes above can all miss a
# healthy install and the hook dies at the last-resort fallback (#2852).
# Scan the uv tool envs directly; UV_TOOL_DIR overrides the default
# location. A tool env is adopted only if its python passes the probe, so a
# co-installed tool without graphify never satisfies it.
#
# The snap roots matter because an install made from inside a snap-confined
# editor lands in that snap's private HOME, which the plain $HOME roots above
# never see once the hook runs from an ordinary shell. Revisions are globbed
# rather than pinned: snap rotates them on update, which is exactly what makes
# a pinned path unsafe (see _is_rotating_prefix).
if [ -z "$GRAPHIFY_PYTHON" ]; then
    for _GFY_TOOLS in \
        "${UV_TOOL_DIR:-}" \
        "$HOME/.local/share/uv/tools" \
        "$HOME/AppData/Roaming/uv/tools" \
        "$HOME"/snap/*/current/.local/share/uv/tools \
        "$HOME"/snap/*/[0-9]*/.local/share/uv/tools; do
        [ -n "$_GFY_TOOLS" ] || continue
        for _GFY_CAND in "$_GFY_TOOLS"/*/bin/python "$_GFY_TOOLS"/*/Scripts/python.exe; do
            [ -x "$_GFY_CAND" ] || continue
            if "$_GFY_CAND" -c "$_GFY_PROBE" 2>/dev/null; then
                GRAPHIFY_PYTHON="$_GFY_CAND"
                break 2
            fi
        done
    done
fi
# Last resort: try python3 / python (works for system/venv installs on PATH).
if [ -z "$GRAPHIFY_PYTHON" ]; then
    if command -v python3 >/dev/null 2>&1 && python3 -c "$_GFY_PROBE" 2>/dev/null; then
        GRAPHIFY_PYTHON="python3"
    elif command -v python >/dev/null 2>&1 && python -c "$_GFY_PROBE" 2>/dev/null; then
        GRAPHIFY_PYTHON="python"
    else
        echo "[graphify hook] could not locate a Python with graphify installed. Add the graphify bin dir to PATH or re-run 'graphify hook install' from the env where graphify lives." >&2
        exit 0
    fi
fi
"""

# The Python that the rebuild runs, shared by both hooks. Embedded verbatim into
# the launcher below and re-executed in the detached child. Must not contain the
# double-quote, $, backtick or backslash characters: it is carried inside a
# shell double-quoted `-c "..."` argument (see _detached_launch).
_REBUILD_BODY_COMMIT = """\
import os, signal, sys, threading, multiprocessing
from pathlib import Path

changed_raw = os.environ.get('GRAPHIFY_CHANGED', '')
changed = [Path(f.strip()) for f in changed_raw.strip().splitlines() if f.strip()]

if not changed:
    sys.exit(0)

print(f'[graphify hook] {len(changed)} file(s) changed - rebuilding graph...')

try:
    from graphify.watch import _rebuild_code, _apply_resource_limits
    _apply_resource_limits()
    _timeout = int(os.environ.get('GRAPHIFY_REBUILD_TIMEOUT', '600'))
    if _timeout > 0:
        if hasattr(signal, 'SIGALRM'):
            def _sigalrm_bail(*_a):
                # Killing here, before the exception unwinds, matters: once
                # TimeoutError starts propagating it passes straight through
                # the ProcessPoolExecutor with-block's own __exit__, which
                # calls shutdown(wait=True) and blocks until every worker
                # exits -- forever, for a worker stuck the way #3341 was,
                # since the alarm firing never actually stops it. Killing the
                # workers first means shutdown has nothing left to wait for.
                for _child in multiprocessing.active_children():
                    _child.kill()
                raise TimeoutError(f'graphify rebuild exceeded {_timeout}s')
            signal.signal(signal.SIGALRM, _sigalrm_bail)
            signal.alarm(_timeout)
        else:
            def _bail():
                print(f'[graphify hook] graphify rebuild exceeded {_timeout}s', flush=True)
                for _child in multiprocessing.active_children():
                    _child.kill()
                os._exit(1)
            _watchdog = threading.Timer(_timeout, _bail)
            _watchdog.daemon = True
            _watchdog.start()
    _force = os.environ.get('GRAPHIFY_FORCE', '').lower() in ('1', 'true', 'yes')
    _root = Path('.')
    _out = os.environ.get('GRAPHIFY_OUT', 'graphify-out')
    _saved = Path(_out) / '.graphify_root'
    if _saved.exists():
        _txt = _saved.read_text(encoding='utf-8-sig').strip()
        if _txt:
            _candidate = Path(_txt)
            try:
                _cwd = Path.cwd().resolve()
                _resolved = _candidate.resolve()
                # Python 3.13 no longer raises on a symlink loop (resolve returns
                # the path unresolved), so require a real directory: a loop or a
                # dangling target is not a dir and correctly falls back.
                _in_repo = (_resolved == _cwd or _cwd in _resolved.parents) and _resolved.is_dir()
            except (OSError, RuntimeError):
            
```

### Core Architecture Module: `worked/httpx/raw/utils.py`
```
"""
Utility functions shared across the library.
Small helpers that don't belong in any one module.
"""
import re
from models import Cookies


SENSITIVE_HEADERS = {"authorization", "cookie", "set-cookie", "proxy-authorization"}


def primitive_value_to_str(value) -> str:
    """Convert a primitive value to its string representation."""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def normalize_header_key(key: str) -> str:
    """Convert a header key to its canonical Title-Case form."""
    return "-".join(word.capitalize() for word in key.split("-"))


def flatten_queryparams(params: dict) -> list:
    """
    Expand a params dict into a flat list of (key, value) pairs.
    List values become multiple pairs with the same key.
    """
    result = []
    for key, value in params.items():
        if isinstance(value, list):
            for item in value:
                result.append((key, primitive_value_to_str(item)))
        else:
            result.append((key, primitive_value_to_str(value)))
    return result


def parse_content_type(content_type: str) -> tuple:
    """
    Parse a Content-Type header value.
    Returns (media_type, params_dict).
    Example: 'application/json; charset=utf-8' -> ('application/json', {'charset': 'utf-8'})
    """
    parts = [p.strip() for p in content_type.split(";")]
    media_type = parts[0]
    params = {}
    for part in parts[1:]:
        if "=" in part:
            key, _, value = part.partition("=")
            params[key.strip()] = value.strip()
    return media_type, params


def obfuscate_sensitive_headers(headers: dict) -> dict:
    """Return a copy of headers with sensitive values replaced by [obfuscated]."""
    return {
        k: "[obfuscated]" if k.lower() in SENSITIVE_HEADERS else v
        for k, v in headers.items()
    }


def unset_all_cookies(cookies: Cookies) -> None:
    """Clear all cookies from a cookie jar in place."""
    cookies.clear()


def is_known_encoding(encoding: str) -> bool:
    """Check if a character encoding label is recognized by Python's codec system."""
    import codecs
    try:
        codecs.lookup(encoding)
        return True
    except LookupError:
        return False


def build_url_with_params(base_url: str, params: dict) -> str:
    """Append query parameters to a URL string."""
    if not params:
        return base_url
    pairs = flatten_queryparams(params)
    query = "&".join(f"{k}={v}" for k, v in pairs)
    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}{query}"

```

### Core Architecture Module: `graphify/__init__.py`
```
"""graphify - extract · build · cluster · analyze · report."""


def __getattr__(name):
    # Lazy imports so `graphify install` works before heavy deps are in place.
    _map = {
        "extract": ("graphify.extract", "extract"),
        "collect_files": ("graphify.extract", "collect_files"),
        "build_from_json": ("graphify.build", "build_from_json"),
        "cluster": ("graphify.cluster", "cluster"),
        "score_all": ("graphify.cluster", "score_all"),
        "cohesion_score": ("graphify.cluster", "cohesion_score"),
        "god_nodes": ("graphify.analyze", "god_nodes"),
        "surprising_connections": ("graphify.analyze", "surprising_connections"),
        "suggest_questions": ("graphify.analyze", "suggest_questions"),
        "generate": ("graphify.report", "generate"),
        "to_json": ("graphify.export", "to_json"),
        "to_html": ("graphify.export", "to_html"),
        "to_svg": ("graphify.export", "to_svg"),
        "to_canvas": ("graphify.export", "to_canvas"),
        "to_wiki": ("graphify.wiki", "to_wiki"),
        "reflect": ("graphify.reflect", "reflect"),
        "save_query_result": ("graphify.ingest", "save_query_result"),
    }
    if name in _map:
        import importlib
        mod_name, attr = _map[name]
        mod = importlib.import_module(mod_name)
        return getattr(mod, attr)
    raise AttributeError(f"module 'graphify' has no attribute {name!r}")

```

### Core Architecture Module: `graphify/__main__.py`
```
"""graphify CLI - `graphify install` sets up the Claude Code skill."""

from __future__ import annotations
import contextlib
import errno
import functools
import io
import json
import os
import platform
import re
import shutil
import sys
from pathlib import Path

try:
    from importlib.metadata import version as _pkg_version

    __version__ = _pkg_version("graphifyy")
except Exception:
    __version__ = "unknown"

# Output directory — override with GRAPHIFY_OUT env var for worktrees or shared-output setups.
# Accepts a relative name ("graphify-out-feature") or an absolute path ("/shared/graphify-out").
# Defined once in graphify.paths so the security/callflow path guards honour the
# same override (#1423).
from graphify.paths import GRAPHIFY_OUT as _GRAPHIFY_OUT

# Install/uninstall subsystem moved to graphify/install.py; re-exported here so
# `from graphify.__main__ import <name>` keeps working unchanged.
from graphify.install import (  # noqa: E402,F401
    dispatch_install_cli,
    _agents_install,
    _agents_platform_install,
    _agents_platform_uninstall,
    _agents_uninstall,
    _always_on,
    _amp_install,
    _amp_legacy_cleanup,
    _amp_uninstall,
    _antigravity_finalize,
    _antigravity_install,
    _antigravity_uninstall,
    _canonical_platform,
    _claude_pretooluse_hooks,
    _copy_skill_file,
    _cursor_install,
    _cursor_uninstall,
    _devin_rules_install,
    _devin_rules_uninstall,
    _gemini_hook,
    _install_claude_hook,
    _install_codebuddy_hook,
    _install_codex_hook,
    _install_gemini_hook,
    _install_kilo_plugin,
    _install_opencode_plugin,
    _install_skill_references,
    _kilo_config_path,
    _kilo_config_write_path,
    _kilo_install,
    _kilo_uninstall,
    _kilo_uninstall_global,
    _kiro_install,
    _kiro_uninstall,
    _load_json_like,
    _packaged_skill_refs_dir,
    _platform_skill_destination,
    _print_banner,
    _print_install_usage,
    _print_project_git_add_hint,
    _project_install,
    _project_scope_root,
    _project_uninstall,
    _project_uninstall_all,
    _remove_claude_skill_registration,
    _remove_skill_file,
    _replace_or_append_section,
    _resolve_graphify_exe,
    _skill_registration,
    _strip_graphify_hook,
    _strip_graphify_md_section,
    _strip_json_comments,
    _uninstall_claude_hook,
    _uninstall_codebuddy_hook,
    _uninstall_codex_hook,
    _uninstall_gemini_hook,
    _uninstall_kilo_plugin,
    _uninstall_opencode_plugin,
    _vscode_skill_destination,
    claude_install,
    claude_uninstall,
    codebuddy_install,
    codebuddy_uninstall,
    gemini_install,
    gemini_uninstall,
    install,
    uninstall_all,
    vscode_install,
    vscode_uninstall,
    _PLATFORM_ALIASES,
    _CLAUDE_MD_MARKER,
    _CODEBUDDY_MD_MARKER,
    _AGENTS_MD_MARKER,
    _GEMINI_MD_MARKER,
    _VSCODE_INSTRUCTIONS_MARKER,
    _ANTIGRAVITY_RULES_PATH,
    _ANTIGRAVITY_WORKFLOW_PATH,
    _ANTIGRAVITY_WORKFLOW,
    _CURSOR_RULE_PATH,
    _CURSOR_RULE,
    _DEVIN_RULES_PATH,
    _DEVIN_RULES,
    _KILO_PLUGIN_JS,
    _KILO_PLUGIN_PATH,
    _KILO_CONFIG_JSON_PATH,
    _KILO_CONFIG_JSONC_PATH,
    _OPENCODE_PLUGIN_JS,
    _OPENCODE_PLUGIN_PATH,
    _OPENCODE_CONFIG_PATH,
    _PLATFORM_CONFIG,
    _skill_lock,
)
from graphify.cli import (  # noqa: E402,F401
    dispatch_command,
    _StageTimer,
    _clone_repo,
    _default_graph_path,
    _enforce_graph_size_cap_or_exit,
    _run_hook_guard,
    _SEARCH_NUDGE,
    _READ_NUDGE,
    _HOOK_SOURCE_EXTS,
    _GEMINI_NUDGE_TEXT,
)




_ALWAYS_ON_ALIASES = {
    "_CLAUDE_MD_SECTION": "claude-md",
    "_AGENTS_MD_SECTION": "agents-md",
    "_GEMINI_MD_SECTION": "gemini-md",
    "_VSCODE_INSTRUCTIONS_SECTION": "vscode-instructions",
    "_ANTIGRAVITY_RULES": "antigravity-rules",
    "_KIRO_STEERING": "kiro-steering",
}


def __getattr__(name: str) -> str:
    # PEP 562: lazily resolve the legacy always-on section constants for external
    # importers (e.g. the install-string tests). In-module code calls _always_on()
    # directly; nothing is read at import time, so a missing block can no longer
    # brick the CLI on `import graphify.__main__` (#1121 follow-up).
    base = _ALWAYS_ON_ALIASES.get(name)
    if base is not None:
        return _always_on(base)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")








def _check_skill_version(skill_dst: Path, platform_names: "list[str] | None" = None) -> None:
    """Warn if the installed skill is from an older graphify version.

    ``platform_names`` are the platforms installing into this destination
    (resolved here when not given - the call site passes one positional
    argument only, because tests stub this function with one-arg lambdas), so
    the warning can name the exact command that refreshes THIS copy (#3144):
    a plain `graphify install` only refreshes the detected platform, and a
    stale marker at another platform's destination made the warning permanent
    - the user followed the advice, the warning stayed, and only editing the
    marker by hand cleared it.
    """
    if platform_names is None:
        try:
            platform_names = [
                name for name in _skill_platforms()
                if _platform_skill_destination(name) == skill_dst
            ]
        except Exception:
            platform_names = []
    version_file = skill_dst.parent / ".graphify_version"
    try:
        if not version_file.exists():
            return
    except OSError:
        return
    try:
        skill_exists = skill_dst.exists()
    except OSError:
        return
    if not skill_exists:
        print("  warning: skill dir exists but SKILL.md is missing. Run 'graphify install' to repair.", file=sys.stderr)
        return
    # A progressive SKILL.md links to its references/ sidecar. If the body points
    # at references/ but the dir is gone (manual delete, partial upgrade), the
    # on-demand fragments won't load — flag it for repair.
    try:
        body = skill_dst.read_text(encoding="utf-8")
    except OSError:
        body = ""
    if "references/" in body and not (skill_dst.parent / "references").exists():
        print("  warning: skill references/ sidecar is missing. Run 'graphify install' to repair.", file=sys.stderr)
    try:
        installed = version_file.read_text(encoding="utf-8").strip()
    except OSError:
        return
    if installed != __version__:
        if _version_tuple(installed) > _version_tuple(__version__):
            # The skill on disk is NEWER than the running package. `graphify install`
            # writes the package's OWN (older) bundled skill and re-stamps the version,
            # so following the old "run install" advice would silently DOWNGRADE the
            # skill. The real fix is to upgrade the package (#1568). Common for a stale
            # `uv tool` CLI, or a contributor whose dev checkout stamped a newer skill.
            print(
                f"  warning: skill is from graphify {installed}, but the package is "
                f"{__version__} (older). Upgrade the package "
                f"(e.g. 'uv tool upgrade graphifyy' or 'pip install -U graphifyy'); "
                f"running 'graphify install' would downgrade the skill.",
                file=sys.stderr,
            )
        else:
            _cmd = (
                f"graphify install --platform {platform_names[0]}"
                if platform_names else "graphify install"
            )
            print(
                f"  warning: skill at {skill_dst.parent} is from graphify {installed}, "
                f"package is {__version__}. Run '{_cmd}' to update it "
                f"(a plain 'graphify install' refreshes only the detected platform).",
                file=sys.stderr,
            )


def _version_tuple(version: str) -> tuple[int, ...]:
    """Parse a version string into a comparable integer tuple (``0.9.2`` -> ``(0, 9, 2)``).

    Reads the leading digits of each dot-segment, so pre/post-release suffixes
    (``1.0.0rc1``) compare by their numeric core. A non-numeric or empty segment
    becomes 0, so a malformed stamp degrades to a conservative comparison rather
    than raising.
    """
    parts: list[int] = []
    for segment in str(version).split("."):
        digits = ""
        for ch in segment:
            if ch.isdigit():
                digits += ch
            else:
                break
        parts.append(int(digits) if digits else 0)
    return tuple(parts)


def _refresh_stale_skills() -> None:
    """Refresh user-scope skills left behind by a package upgrade (#1805).

    Upgrading the package (``uv tool upgrade graphifyy``, ``pip install -U``)
    does not touch the installed skill copies, and a plain ``graphify install``
    refreshes only the detected platform, so every other platform (codex,
    opencode, gemini, ...) kept running the old skill instructions until each
    was reinstalled by hand. On the first CLI run after an upgrade, re-copy
    every user-scope skill whose ``.graphify_version`` stamp is older than the
    running package - exactly the copies the stale-skill warning would tell the
    user to reinstall.

    Only copies graphify installed are touched (a stamp and SKILL.md exist);
    nothing is installed that was not there before. Left alone, so the
    warning still fires for them:

    * a stamp NEWER than the package - installing would downgrade it (#1568);
    * a directory written by more than one installer (gemini + agents on
      Windows, copilot + ``graphify vscode install``) - the stamp does not
      record which variant is there, and guessing would swap it.

    Directories are grouped by their resolved path, so two platforms sharing
    one directory through a symlink count as shared too.

    A locally edited SKILL.md is kept as ``SKILL.md.bak`` by _copy_skill_file
    (#3144). Output goes to stderr so piped stdout (``--json``, the MCP stdio
    server) stays clean. Set ``GRAPHIFY_NO_AUTO_REFRESH=1`` t
```

### Core Architecture Module: `graphify/_minhash.py`
```
"""MinHash + band-LSH — datasketch-compatible drop-in (no scipy).

datasketch.lsh has `from scipy.integrate import quad` at module level.
scipy's array_api_compat layer then lazily loads numpy.testing, which calls
platform.machine() at import time to set test-skip decorator constants — and
that in turn spawns cmd.exe via subprocess, hanging for minutes under EDR
software in corporate Windows environments.

Covers the exact MinHash/MinHashLSH API surface used by dedup.py.
Hash family (Mersenne-prime permutations) and LSH band structure are
equivalent to datasketch so dedup quality is unchanged.
"""
from __future__ import annotations
import hashlib
import struct

import numpy as np


_MP = np.uint64((1 << 61) - 1)  # Mersenne prime for the hash family
_MH = np.uint64(0xFFFF_FFFF)    # mask to 32-bit values

# One (a, b) coefficient array per num_perm, shared across all instances.
_MH_COEFFS: dict[int, tuple[np.ndarray, np.ndarray]] = {}


def _mh_coeffs(num_perm: int) -> tuple[np.ndarray, np.ndarray]:
    if num_perm not in _MH_COEFFS:
        rng = np.random.RandomState(1)
        a = rng.randint(1, int(_MP), num_perm, dtype=np.uint64)
        b = rng.randint(0, int(_MP), num_perm, dtype=np.uint64)
        _MH_COEFFS[num_perm] = (a, b)
    return _MH_COEFFS[num_perm]


class MinHash:
    """MinHash sketch — same API as datasketch.MinHash for the subset used here."""

    __slots__ = ("num_perm", "hashvalues", "_a", "_b")

    def __init__(self, num_perm: int = 128) -> None:
        self.num_perm = num_perm
        self.hashvalues = np.full(num_perm, int(_MH), dtype=np.uint64)
        self._a, self._b = _mh_coeffs(num_perm)

    def update(self, v: bytes) -> None:
        hv = np.uint64(struct.unpack("<I", hashlib.sha1(v).digest()[:4])[0])
        phv = np.bitwise_and((self._a * hv + self._b) % _MP, _MH)
        self.hashvalues = np.minimum(self.hashvalues, phv)


def _lsh_integrate(f, lo: float, hi: float, n: int = 128) -> float:
    """Numerical integration — replaces scipy.integrate.quad for LSH param search."""
    h = (hi - lo) / n
    return h * sum(f(lo + i * h) for i in range(n))


_LSH_PARAMS_CACHE: dict[tuple[float, int], tuple[int, int]] = {}


def _optimal_lsh_params(threshold: float, num_perm: int) -> tuple[int, int]:
    """Find (bands, rows) that minimise weighted FP+FN error, without scipy."""
    key = (threshold, num_perm)
    if key in _LSH_PARAMS_CACHE:
        return _LSH_PARAMS_CACHE[key]
    best_err, best = float("inf"), (1, 1)
    for b in range(1, num_perm + 1):
        for r in range(1, num_perm // b + 1):
            fp = _lsh_integrate(
                lambda s, _b=float(b), _r=float(r): 1 - (1 - s ** _r) ** _b,
                0.0, threshold,
            )
            fn = _lsh_integrate(
                lambda s, _b=float(b), _r=float(r): 1 - (1 - (1 - s ** _r) ** _b),
                threshold, 1.0,
            )
            err = 0.5 * fp + 0.5 * fn
            if err < best_err:
                best_err, best = err, (b, r)
    _LSH_PARAMS_CACHE[key] = best
    return best


class MinHashLSH:
    """Band-hashing LSH — same API as datasketch.MinHashLSH for the subset used here."""

    def __init__(self, threshold: float = 0.5, num_perm: int = 128) -> None:
        self.b, self.r = _optimal_lsh_params(threshold, num_perm)
        self._tables: list[dict[bytes, list[str]]] = [{} for _ in range(self.b)]
        self._keys: set[str] = set()

    def insert(self, key: str, minhash: MinHash) -> None:
        if key in self._keys:
            raise ValueError(f"Key {key!r} already exists in MinHashLSH")
        self._keys.add(key)
        hv = minhash.hashvalues
        for i, table in enumerate(self._tables):
            band = hv[i * self.r : (i + 1) * self.r].tobytes()
            table.setdefault(band, []).append(key)

    def query(self, minhash: MinHash) -> list[str]:
        hv = minhash.hashvalues
        candidates: set[str] = set()
        for i, table in enumerate(self._tables):
            band = hv[i * self.r : (i + 1) * self.r].tobytes()
            candidates.update(table.get(band, []))
        return list(candidates)

```

### Core Architecture Module: `graphify/affected.py`
```
from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
import unicodedata

import networkx as nx


DEFAULT_AFFECTED_RELATIONS = (
    "calls",
    "indirect_call",
    "references",
    "imports",
    "imports_from",
    # `import('…')` — emitted by the Svelte/Astro/Vue rescue passes and (since
    # #2575) by plain JS/TS too. Omitting it made every dynamic import
    # invisible to blast-radius traversal even where the edge WAS in the
    # graph, and dynamic import is precisely how codebases break require
    # cycles, so the missing edges sat under the most load-bearing modules.
    "dynamic_import",
    "re_exports",
    "inherits",
    "extends",
    "implements",
    "uses",
    "mixes_in",
    "embeds",
    "requires",
)


@dataclass(frozen=True)
class AffectedHit:
    node_id: str
    depth: int
    via_relation: str
    # The traversed edge's location — the actual call/import/reference SITE in
    # this node's file, not the node's own definition line (#BUG1). Defaults keep
    # existing constructors/tests working; None falls back to the node's def line.
    via_file: "str | None" = None
    via_location: "str | None" = None


def _node_label(graph: nx.Graph, node_id: str) -> str:
    data = graph.nodes[node_id]
    return str(data.get("label") or node_id)


def _format_location(data: dict) -> str:
    source_file = data.get("source_file") or "-"
    source_location = data.get("source_location")
    if source_location:
        return f"{source_file}:{source_location}"
    return str(source_file)


def _bare_name(label: str) -> str:
    """Lowercased label with the callable decoration (trailing "()") removed."""
    label = _normalize_label(label)
    return label[:-2] if label.endswith("()") else label


def _normalize_label(label: str) -> str:
    return unicodedata.normalize("NFC", label).casefold()


def _as_repo_relative(query: str, root: Path | None = None) -> str:
    """Repo-relative form of a path query, for matching a stored `source_file`.

    The graph stores repo-relative paths, so `./src/x.py` and
    `/abs/repo/src/x.py` name the same file as `src/x.py` and yet matched
    nothing. `affected` then printed an empty list and exited 0 — a blast-radius
    tool answering "nothing depends on this" about a file with sixteen
    dependents, and indistinguishable from a genuine zero or a typo.

    An absolute path is anchored to `root` when given — the repo root derived
    from the graph's own location — so a seed resolves regardless of the caller's
    working directory (#2706: an absolute-path seed previously only matched when
    cwd happened to be the analysed repo root, which no editor or script can
    guarantee). `root` falls back to the current directory to preserve the prior
    behaviour when a caller has no graph location to derive it from.

    Non-path queries pass through unchanged: `Path("myFunc()").as_posix()` is
    `"myFunc()"`, so label resolution is untouched. An absolute path rooted
    outside `root` is left alone — no basename guessing.
    """
    path = Path(query)
    if path.is_absolute():
        anchor = root if root is not None else Path.cwd()
        try:
            return path.relative_to(anchor).as_posix()
        except ValueError:
            # Rooted outside the repo: nothing here can make it repo-relative,
            # so leave it alone rather than guess at a basename that would match
            # some unrelated file with the same name.
            return query
    return path.as_posix()


def _prefer_file_node(
    graph: nx.Graph,
    node_ids: list[str],
    query: str,
) -> str | None:
    """Return the file-level node when a source_file query matches many nodes."""
    query_basename = _normalize_label(Path(query).name)
    exact_file_nodes = [
        node_id
        for node_id in node_ids
        if str(graph.nodes[node_id].get("source_location", "")) == "L1"
        and _normalize_label(str(graph.nodes[node_id].get("label", ""))) == query_basename
    ]
    if len(exact_file_nodes) == 1:
        return exact_file_nodes[0]

    l1_nodes = [
        node_id
        for node_id in node_ids
        if str(graph.nodes[node_id].get("source_location", "")) == "L1"
    ]
    if len(l1_nodes) == 1:
        return l1_nodes[0]

    basename_nodes = [
        node_id
        for node_id in node_ids
        if _normalize_label(str(graph.nodes[node_id].get("label", ""))) == query_basename
    ]
    if len(basename_nodes) == 1:
        return basename_nodes[0]

    return None


def resolve_seed(graph: nx.Graph, query: str, root: Path | None = None) -> str | None:
    # A trailing path separator must not change a source-file match — serve's
    # _find_node tokenizes the path (which drops it), so strip it here for parity
    # (otherwise `affected "src/x.ts/"` returned None while `explain` resolved it).
    query = query.rstrip("/\\") or query
    if query in graph:
        return query
    query_lower = _normalize_label(query)
    exact_label_matches = [
        str(node_id)
        for node_id, data in graph.nodes(data=True)
        if _normalize_label(str(data.get("label", ""))) == query_lower
    ]
    if len(exact_label_matches) == 1:
        return exact_label_matches[0]
    # Callable labels are decorated ("name()"), so a bare "name" query falls
    # through exact matching and then ties with any "name*" sibling in the
    # contains pass. Match on the undecorated name before giving up.
    query_bare = _bare_name(query_lower)
    bare_name_matches = [
        str(node_id)
        for node_id, data in graph.nodes(data=True)
        if _bare_name(str(data.get("label", ""))) == query_bare
    ]
    if len(bare_name_matches) == 1:
        return bare_name_matches[0]
    # Compare paths in repo-relative form. Only this branch is path-shaped; the
    # label branches above keep the query verbatim.
    query_path = _normalize_label(_as_repo_relative(query, root))
    exact_source_matches = [
        str(node_id)
        for node_id, data in graph.nodes(data=True)
        if _normalize_label(str(data.get("source_file", ""))) in (query_lower, query_path)
    ]
    if len(exact_source_matches) == 1:
        return exact_source_matches[0]
    if exact_source_matches:
        preferred_file_node = _prefer_file_node(
            graph, exact_source_matches, _as_repo_relative(query, root)
        )
        if preferred_file_node is not None:
            return preferred_file_node
    contains_matches = [
        str(node_id)
        for node_id, data in graph.nodes(data=True)
        if query_lower in _normalize_label(str(data.get("label", "")))
    ]
    if len(contains_matches) == 1:
        return contains_matches[0]
    return None


def affected_nodes(
    graph: nx.Graph,
    seed: str,
    *,
    relations: Iterable[str] = DEFAULT_AFFECTED_RELATIONS,
    depth: int = 2,
) -> list[AffectedHit]:
    relation_set = set(relations)
    seen = {seed}
    queue: deque[tuple[str, int]] = deque([(seed, 0)])
    hits: list[AffectedHit] = []

    # #1669: seed the reverse walk with the root's own member nodes (one outward
    # `method`/`contains` hop). A caller can bind to a class's method node rather
    # than the class node itself (e.g. `Service.call` resolves to the `def
    # self.call` node, #1634), so those callers are unreachable from the class
    # otherwise. The member nodes are seeds only (not reported as hits), and
    # `method`/`contains` stay out of the general relation-filtered walk, so this
    # adds no forward noise anywhere else.
    if hasattr(graph, "out_edges"):
        member_edges = graph.out_edges(seed, data=True)
    else:
        member_edges = (
            (s, t, d) for s, t, d in graph.edges(data=True) if s == seed
        )
    for _s, member, data in member_edges:
        if str(data.get("relation", "")) not in ("method", "contains"):
            continue
        member = str(member)
        if member not in seen:
            seen.add(member)
            queue.append((member, 0))

    while queue:
        current, current_depth = queue.popleft()
        if current_depth >= depth:
            continue
        if hasattr(graph, "in_edges"):
            incoming = graph.in_edges(current, data=True)
        else:
            incoming = (
                (source, target, data)
                for source, target, data in graph.edges(data=True)
                if target == current
            )
        for source, _target, data in incoming:
            relation = str(data.get("relation", ""))
            if relation not in relation_set:
                continue
            source = str(source)
            if source in seen:
                continue
            seen.add(source)
            # Carry the matched edge's location (taken from the SAME edge dict
            # whose relation passed the filter, so relation and location stay
            # consistent) — that is the call/import/reference site in `source`'s
            # own file, which is where the user should click (#BUG1).
            hit = AffectedHit(
                source, current_depth + 1, relation,
                via_file=str(data.get("source_file") or "") or None,
                via_location=str(data.get("source_location") or "") or None,
            )
            hits.append(hit)
            queue.append((source, current_depth + 1))

    return hits


def format_affected(
    graph: nx.Graph,
    query: str,
    *,
    relations: Iterable[str] = DEFAULT_AFFECTED_RELATIONS,
    depth: int = 2,
    root: Path | None = None,
) -> str:
    relation_list = tuple(relations)
    seed = resolve_seed(graph, query, root)
    if seed is None:
        return f"No unique node match for {query}"

    hits = affected_nodes(graph, seed, relations=relation_list, depth=depth)
    lines = [
        f"Affected nodes for {_node_label(graph, seed)}",
        f"Relations: {', '.join(relation_list)}",
```

### Core Architecture Module: `graphify/analyze.py`
```
"""Graph analysis: god nodes (most connected), surprising connections (cross-community), suggested questions."""
from __future__ import annotations
from pathlib import Path
import networkx as nx

from graphify.build import edge_data

# Builtin/mock names that can appear as annotation-derived nodes in pre-existing
# graphs. Excluded from god-node ranking so they don't displace real abstractions
# even if they weren't filtered at extraction time (#1147).
_BUILTIN_NOISE_LABELS = frozenset({
    "str", "int", "float", "bool", "bytes", "bytearray", "complex", "object",
    "True", "False",
    "MagicMock", "Mock", "AsyncMock", "NonCallableMock",
    "NonCallableMagicMock", "PropertyMock", "patch", "sentinel",
    # Python stdlib types commonly confused for project symbols
    "Path", "Any", "Optional", "List", "Dict", "Set", "Tuple", "Union",
    "Callable", "Type", "ClassVar", "Final", "Literal", "Protocol",
    "Counter", "defaultdict", "OrderedDict", "datetime", "Enum",
    "os", "sys", "re", "json", "io", "abc", "typing",
    # Swift / Foundation / SwiftUI framework symbols and module imports that
    # otherwise dominate god-node rankings on Swift codebases (#2147)
    "Foundation", "SwiftUI", "UIKit", "AppKit", "Combine",
    "String", "Int", "Double", "Float", "Bool", "Data", "URL", "Date", "UUID",
    "Sendable", "Codable", "Decodable", "Encodable", "Equatable", "Hashable",
    "Identifiable", "Comparable", "AnyObject", "Error", "LocalizedError",
    "NSObject", "NSString", "NSError", "NSLock",
    "View", "Color", "Font", "DispatchQueue",
})

# Language families — extensions sharing a runtime can legitimately call each other
_LANG_FAMILY: dict[str, str] = {
    **{e: "python" for e in (".py", ".pyw")},
    **{e: "js" for e in (".js", ".jsx", ".mjs", ".cjs", ".ejs", ".ts", ".tsx", ".mts", ".cts", ".vue", ".svelte")},
    **{e: "go" for e in (".go",)},
    **{e: "rust" for e in (".rs",)},
    **{e: "jvm" for e in (".java", ".kt", ".kts", ".scala")},
    **{e: "c" for e in (".c", ".h", ".cpp", ".cc", ".cxx", ".hpp")},
    **{e: "ruby" for e in (".rb", ".rake")},
    **{e: "swift" for e in (".swift",)},
    **{e: "dotnet" for e in (".cs", ".vb")},
    **{e: "php" for e in (".php",)},
    **{e: "r" for e in (".r",)},
    **{e: "cobol" for e in (".cbl", ".cob", ".cobol", ".cpy")},
    **{e: "solidity" for e in (".sol",)},
    **{e: "erlang" for e in (".erl", ".hrl", ".escript")},
}


def _cross_language(src_a: str, src_b: str) -> bool:
    """Return True if two source files belong to different language families."""
    ext_a = Path(src_a).suffix.lower()
    ext_b = Path(src_b).suffix.lower()
    fam_a = _LANG_FAMILY.get(ext_a)
    fam_b = _LANG_FAMILY.get(ext_b)
    if fam_a is None or fam_b is None:
        return False
    return fam_a != fam_b


def _node_community_map(communities: dict[int, list[str]]) -> dict[str, int]:
    """Invert communities dict: node_id -> community_id."""
    return {n: cid for cid, nodes in communities.items() for n in nodes}


def _is_file_node(G: nx.Graph, node_id: str) -> bool:
    """
    Return True if this node is a file-level hub node (e.g. 'client', 'models')
    or an AST method stub (e.g. '.auth_flow()', '.__init__()').

    These are synthetic nodes created by the AST extractor and should be excluded
    from god nodes, surprising connections, and knowledge gap reporting.
    """
    attrs = G.nodes[node_id]
    label = attrs.get("label", "")
    if not label:
        return False
    # File-level hub: label matches the actual source filename — bare basename OR
    # the directory-qualified form the #2032 disambiguation pass may assign.
    source_file = attrs.get("source_file", "")
    if source_file:
        from graphify.build import _is_file_node_label
        if _is_file_node_label(label, source_file):
            return True
    # Method stub: AST extractor labels methods as '.method_name()'
    if label.startswith(".") and label.endswith("()"):
        return True
    # Module-level function stub: labeled 'function_name()' - only has a contains edge
    # These are real functions but structurally isolated by definition; not a gap worth flagging
    if label.endswith("()") and G.degree(node_id) <= 1:
        return True
    return False


_JSON_NOISE_LABELS: frozenset[str] = frozenset({
    "start", "end", "name", "id", "type", "properties",
    "value", "key", "data", "items", "title", "description", "version",
    "dependencies", "devdependencies", "peerdependencies",
    "optionaldependencies", "bundleddependencies", "bundledependencies",
})


def _is_json_key_node(G: nx.Graph, node_id: str) -> bool:
    attrs = G.nodes[node_id]
    src = (attrs.get("source_file") or "").lower()
    if not src.endswith(".json"):
        return False
    label = (attrs.get("label") or "").strip().lower()
    return label in _JSON_NOISE_LABELS


def god_nodes(G: nx.Graph, top_n: int = 10,
              exclude_hubs_percentile: float | None = None) -> list[dict]:
    """Return the top_n most-connected real entities - the core abstractions.

    File-level hub nodes are excluded: they accumulate import/contains edges
    mechanically and don't represent meaningful architectural abstractions.

    ``exclude_hubs_percentile`` (0-100) suppresses nodes whose degree exceeds
    that percentile of the graph's degree distribution, using the same
    threshold computation ``cluster()`` applies (#3205) - so the one setting
    suppresses utility hubs in the ranking AND in community resolution,
    instead of only the latter. ``None`` keeps the historical ranking.
    """
    degree = dict(G.degree())
    hub_threshold: float | None = None
    if exclude_hubs_percentile is not None:
        degrees = sorted(degree.values())
        if degrees:
            idx = max(0, int(len(degrees) * exclude_hubs_percentile / 100) - 1)
            hub_threshold = degrees[idx]
    sorted_nodes = sorted(degree.items(), key=lambda x: x[1], reverse=True)
    result = []
    for node_id, deg in sorted_nodes:
        if hub_threshold is not None and deg > hub_threshold:
            continue
        if _is_file_node(G, node_id) or _is_concept_node(G, node_id) or _is_json_key_node(G, node_id):
            continue
        if G.nodes[node_id].get("label", "") in _BUILTIN_NOISE_LABELS:
            continue
        result.append({
            "id": node_id,
            "label": G.nodes[node_id].get("label", node_id),
            "degree": deg,
        })
        if len(result) >= top_n:
            break
    return result


def surprising_connections(
    G: nx.Graph,
    communities: dict[int, list[str]] | None = None,
    top_n: int = 5,
) -> list[dict]:
    """
    Find connections that are genuinely surprising - not obvious from file structure.

    Strategy:
    - Multi-file corpora: cross-file edges between real entities (not concept nodes).
      Sorted AMBIGUOUS → INFERRED → EXTRACTED.
    - Single-file / single-source corpora: cross-community edges that bridge
      distant parts of the graph (betweenness centrality on edges).
      These reveal non-obvious structural couplings.

    Concept nodes (empty source_file, or injected semantic annotations) are excluded
    from surprising connections because they are intentional, not discovered.
    """
    # Identify unique source files (ignore empty/null source_file)
    source_files = {
        data.get("source_file", "")
        for _, data in G.nodes(data=True)
        if data.get("source_file", "")
    }
    is_multi_source = len(source_files) > 1

    if is_multi_source:
        return _cross_file_surprises(G, communities or {}, top_n)
    else:
        return _cross_community_surprises(G, communities or {}, top_n)


def _is_concept_node(G: nx.Graph, node_id: str) -> bool:
    """
    Return True if this node is a manually-injected semantic concept node
    rather than a real entity found in source code.

    Signals:
    - Empty source_file
    - source_file doesn't look like a real file path (no extension)
    """
    data = G.nodes[node_id]
    source = data.get("source_file", "")
    if not source:
        return True
    # Has no file extension → probably a concept label, not a real file
    if "." not in source.split("/")[-1]:
        return True
    return False


from graphify.detect import CODE_EXTENSIONS, DOC_EXTENSIONS, PAPER_EXTENSIONS, IMAGE_EXTENSIONS


def _file_category(path: str) -> str:
    ext = ("." + path.rsplit(".", 1)[-1].lower()) if "." in path else ""
    if ext in CODE_EXTENSIONS:
        return "code"
    if ext in PAPER_EXTENSIONS:
        return "paper"
    if ext in IMAGE_EXTENSIONS:
        return "image"
    return "doc"


def _top_level_dir(path: str) -> str:
    """Return the first path component - used to detect cross-repo edges.

    A path with no "/" is a file at the scan root, so its top-level directory
    is the root itself ("."), not the filename: otherwise every pair of
    root-level files would look like it crosses repos/directories. "." keeps
    root files distinct from an absolute path outside the root, whose first
    component is "". Backslashes and a leading "./" are normalised first,
    since a graph.json loaded without build_from_json can still carry them.
    """
    path = path.replace("\\", "/")
    while path.startswith("./"):
        path = path[2:]
    return path.split("/")[0] if "/" in path else "."


def _surprise_score(
    G: nx.Graph,
    u: str,
    v: str,
    data: dict,
    node_community: dict[str, int],
    u_source: str,
    v_source: str,
    degrees: dict[str, int] | None = None,
) -> tuple[int, list[str]]:
    """Score how surprising a cross-file edge is. Returns (score, reasons)."""
    score = 0
    reasons: list[str] = []

    # 1. Confidence weight - uncertain connections are more noteworthy
    conf = data.get("confidence", "EXTRACTED")
    relation = data.get("relation", "")
    conf_bonus = {"AMBIGUOUS": 3, "INFERRED": 2, "EXTRACTED": 1}.get(conf, 1)

    cat_u = _file_catego
```

### Core Architecture Module: `graphify/benchmark.py`
```
"""Token-reduction benchmark - measures how much context graphify saves vs naive full-corpus approach."""
from __future__ import annotations
import sys
import networkx as nx

from graphify.build import edge_data
from graphify.serve import _query_terms
from graphify.paths import default_graph_json as _default_graph_json


_CHARS_PER_TOKEN = 4  # standard approximation


def _safe(unicode_char: str, ascii_fallback: str) -> str:
    """Return unicode_char if stdout can encode it, else ascii_fallback.

    Windows consoles often default to cp1252 which cannot encode box-drawing
    or arrow glyphs; printing them raises UnicodeEncodeError mid-output.
    """
    encoding = getattr(sys.stdout, "encoding", None) or ""
    try:
        unicode_char.encode(encoding)
        return unicode_char
    except (UnicodeEncodeError, LookupError):
        return ascii_fallback


def _hr(width: int = 50) -> str:
    """Horizontal rule that survives non-UTF-8 stdout (e.g. Windows cp1252 console)."""
    return _safe("─", "-") * width


def _estimate_tokens(text: str) -> int:
    return max(1, len(text) // _CHARS_PER_TOKEN)


def _query_subgraph_tokens(G: nx.Graph, question: str, depth: int = 3) -> int:
    """Run BFS from best-matching nodes and return estimated tokens in the subgraph context."""
    terms = _query_terms(question)
    scored = []
    for nid, data in G.nodes(data=True):
        label = (data.get("label") or "").lower()
        score = sum(1 for t in terms if t in label)
        if score > 0:
            scored.append((score, nid))
    scored.sort(reverse=True)
    start_nodes = [nid for _, nid in scored[:3]]
    if not start_nodes:
        return 0

    visited: set[str] = set(start_nodes)
    frontier = set(start_nodes)
    edges_seen: list[tuple] = []
    for _ in range(depth):
        next_frontier: set[str] = set()
        for n in frontier:
            for neighbor in G.neighbors(n):
                if neighbor not in visited:
                    next_frontier.add(neighbor)
                    edges_seen.append((n, neighbor))
        visited.update(next_frontier)
        frontier = next_frontier

    lines = []
    for nid in visited:
        d = G.nodes[nid]
        lines.append(f"NODE {d.get('label', nid)} src={d.get('source_file', '')} loc={d.get('source_location', '')}")
    for u, v in edges_seen:
        if u in visited and v in visited:
            d = edge_data(G, u, v)
            lines.append(f"EDGE {G.nodes[u].get('label', u)} --{d.get('relation', '')}--> {G.nodes[v].get('label', v)}")

    return _estimate_tokens("\n".join(lines))


_SAMPLE_QUESTIONS = [
    "how does authentication work",
    "what is the main entry point",
    "how are errors handled",
    "what connects the data layer to the api",
    "what are the core abstractions",
]


def run_benchmark(
    graph_path: str | None = None,
    corpus_words: int | None = None,
    questions: list[str] | None = None,
) -> dict:
    """Measure token reduction: corpus tokens vs graphify query tokens.

    Args:
        graph_path: path to the built graph
        corpus_words: total word count from detect() output; if None, estimated from graph
        questions: list of questions to benchmark; defaults to _SAMPLE_QUESTIONS

    Returns dict with: corpus_tokens, avg_query_tokens, reduction_ratio, per_question
    """
    graph_path = graph_path or _default_graph_json()
    # Size-cap check + links/edges normalization + node-link parse. A raw
    # --no-cluster graph stores edges under "edges" and used to KeyError
    # here (#2212).
    from graphify.paths import load_node_link_graph
    G = load_node_link_graph(graph_path)

    if corpus_words is None:
        # Rough estimate: each node label is ~3 words, plus source context
        corpus_words = G.number_of_nodes() * 50

    corpus_tokens = corpus_words * 100 // 75  # words → tokens (100 words ≈ 133 tokens)

    qs = questions or _SAMPLE_QUESTIONS
    per_question = []
    for q in qs:
        qt = _query_subgraph_tokens(G, q)
        if qt > 0:
            per_question.append({"question": q, "query_tokens": qt, "reduction": round(corpus_tokens / qt, 1)})

    if not per_question:
        return {"error": "No matching nodes found for sample questions. Build the graph first."}

    avg_query_tokens = sum(p["query_tokens"] for p in per_question) // len(per_question)
    reduction_ratio = round(corpus_tokens / avg_query_tokens, 1) if avg_query_tokens > 0 else 0

    return {
        "corpus_tokens": corpus_tokens,
        "corpus_words": corpus_words,
        "nodes": G.number_of_nodes(),
        "edges": G.number_of_edges(),
        "avg_query_tokens": avg_query_tokens,
        "reduction_ratio": reduction_ratio,
        "per_question": per_question,
    }


def print_benchmark(result: dict) -> None:
    """Print a human-readable benchmark report."""
    if "error" in result:
        print(f"Benchmark error: {result['error']}")
        return

    print(f"\ngraphify token reduction benchmark")
    print(_hr(50))
    arrow = _safe("→", "->")
    print(f"  Corpus:          {result['corpus_words']:,} words {arrow} ~{result['corpus_tokens']:,} tokens (naive)")
    print(f"  Graph:           {result['nodes']:,} nodes, {result['edges']:,} edges")
    print(f"  Avg query cost:  ~{result['avg_query_tokens']:,} tokens")
    print(f"  Reduction:       {result['reduction_ratio']}x fewer tokens per query")
    print(f"\n  Per question:")
    for p in result["per_question"]:
        print(f"    [{p['reduction']}x] {p['question'][:55]}")
    print()

```

### Core Architecture Module: `graphify/cache.py`
```
# per-file extraction cache - skip unchanged files on re-run
from __future__ import annotations

import atexit
import hashlib
import json
import os
import re
import tempfile
import time
import warnings
from collections.abc import Callable, Iterable
from pathlib import Path

# Output directory name — override with GRAPHIFY_OUT env var for worktrees or
# shared-output setups. Accepts a relative name ("graphify-out-feature") or an
# absolute path ("/shared/graphify-out"). Single source of truth in graphify.paths
# (#1423); re-exported here as _GRAPHIFY_OUT for the existing call sites.
from graphify.paths import GRAPHIFY_OUT as _GRAPHIFY_OUT
from graphify.paths import os_replace_with_fallback as _os_replace_with_fallback

# AST cache entries are the output of graphify's own extractor code, so they
# are only valid for the version that wrote them: keying purely on file
# content means extractor fixes shipped in a new release keep serving stale
# pre-fix results. The AST cache is therefore namespaced by package version
# and cache-key schema (cache/ast/v{version}-s{schema}/), with entries from
# other versions or schemas removed on first
# use. The semantic cache is deliberately NOT versioned — its entries are
# produced by the LLM from file contents, and invalidating them on every
# release would re-bill extraction for unchanged files.
try:
    from importlib.metadata import version as _pkg_version

    _EXTRACTOR_VERSION = _pkg_version("graphifyy")
except Exception:
    _EXTRACTOR_VERSION = "unknown"

# Bump when AST cache-key semantics change independently of the package version.
_AST_CACHE_SCHEMA = 5  # Python receiver-shadow facts in persisted raw calls.

# Version dirs already swept this process — cleanup runs once per (base, version).
_cleaned_ast_dirs: set[str] = set()


def _cleanup_stale_ast_entries(ast_base: Path, current_dir: Path) -> None:
    """Remove AST cache entries left behind by other graphify versions.

    Sweeps sibling ``v*/`` directories and unversioned ``*.json`` entries
    (the pre-versioning layout) under ``cache/ast/``. Best-effort: failures
    are ignored, stragglers are retried on the next run.
    """
    key = str(current_dir)
    if key in _cleaned_ast_dirs:
        return
    _cleaned_ast_dirs.add(key)
    if not ast_base.is_dir():
        return
    import shutil

    for child in ast_base.iterdir():
        if child == current_dir:
            continue
        try:
            if child.is_dir() and child.name.startswith("v"):
                shutil.rmtree(child, ignore_errors=True)
            elif child.suffix == ".json":
                child.unlink()
        except OSError:
            pass


# Semantic cache entries are LLM output, so they depend on the extraction prompt
# that produced them, not just on file contents. Keying purely on content means a
# release that changes the prompt keeps replaying entries from the older prompt on
# every unchanged file, silently mixing extraction vintages in one graph (#1939).
# Versioning them by package version (as the AST cache does) would re-bill LLM
# extraction on every patch release — the reason #1252 deliberately left them
# unversioned. Fingerprinting the prompt itself keeps both properties: entries
# survive releases that don't touch the prompt, and invalidate only when it
# actually changed. Entries live under cache/semantic/p{fingerprint}/ when the
# caller supplies its prompt; callers that don't keep the historical flat layout.
_PROMPT_FP_LEN = 12

# Count of pre-fingerprint (flat-layout) entries served this process, so
# check_semantic_cache can report N to the user (#1939).
_legacy_semantic_hits = 0

# Count of cache entries that failed to parse as JSON this process. A corrupt
# entry is not a miss: left in place it fails on every future run, silently
# re-extracting (and, for semantic kinds, re-billing) the file forever. The
# counter lets check_semantic_cache surface one aggregate warning (#2405).
_corrupt_cache_entries = 0

# Prompt-file fingerprints already computed, keyed by (path, size, mtime_ns) —
# the same stat signature the hash index uses. check_semantic_cache resolves the
# prompt once per FILE in the corpus, so without this a 500-doc run re-reads and
# re-hashes the same spec 500 times (and warns 500 times when it is unreadable).
_prompt_fp_cache: dict[tuple, str] = {}


def prompt_fingerprint(prompt: "str | Path") -> str:
    """Return a short stable fingerprint of an extraction prompt.

    ``prompt`` is either the prompt text itself (the Python extraction path owns
    its system prompt, :func:`graphify.llm._extraction_system`) or a Path to the
    prompt file an agent loaded (the skill path's
    ``references/extraction-spec.md``).

    Line endings and trailing whitespace are normalized before hashing: the same
    spec file checked out with CRLF on Windows must not fingerprint differently
    from the LF checkout that wrote the cache, or every Windows run would look
    like a prompt change and re-bill extraction.
    """
    if isinstance(prompt, Path):
        text = prompt.read_text(encoding="utf-8", errors="replace")
    else:
        text = prompt
    normalized = "\n".join(
        line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    ).strip()
    return hashlib.sha256(normalized.encode()).hexdigest()[:_PROMPT_FP_LEN]


def _resolve_prompt_fp(prompt: "str | Path | None" = None,
                       prompt_file: "str | Path | None" = None) -> str | None:
    """Fingerprint the caller's extraction prompt, or None when it supplied none.

    ``prompt`` is prompt TEXT; ``prompt_file`` is a path to a file CONTAINING the
    prompt. They are separate parameters rather than one overloaded argument
    because the skill-driven callers are markdown snippets an agent copies with a
    path substituted in — passing that path as ``prompt`` would hash the path
    string itself, yielding a fingerprint that is stable, plausible, and tracks
    nothing about the prompt. A silent wrong fingerprint is the exact failure
    class #1939 is about, so the two are not inferred from each other.

    Best-effort: an unreadable ``prompt_file`` falls back to the flat, unattributed
    layout rather than failing the run — a cache is never worth aborting an
    extraction over. It warns rather than falling back quietly, because that
    fallback silently restores the very behavior this fixes, and the skill-side
    caller substitutes this path by hand.
    """
    memo_key = None
    if prompt_file is not None:
        prompt = Path(prompt_file)
        try:
            st = prompt.stat()
            memo_key = (str(prompt), st.st_size, st.st_mtime_ns)
            if memo_key in _prompt_fp_cache:
                return _prompt_fp_cache[memo_key]
        except OSError:
            pass  # unreadable — fall through to the warning below
    if prompt is None:
        return None
    try:
        fp = prompt_fingerprint(prompt)
        if memo_key is not None:
            _prompt_fp_cache[memo_key] = fp
        return fp
    except (OSError, UnicodeError) as exc:
        warnings.warn(
            f"could not read extraction prompt {str(prompt)!r} ({exc}); semantic cache "
            "entries cannot be attributed to a prompt version and fall back to the "
            "unversioned layout, so this run may replay entries from an older "
            "extraction prompt (#1939).",
            RuntimeWarning,
            stacklevel=3,
        )
        return None


# A frontmatter delimiter is a whole line of exactly three dashes (optional
# trailing whitespace). Substring checks like startswith("---") /
# find("\n---") also match `----` thematic breaks and `--- text` prose,
# silently dropping everything above them from the hash (#1259).
_FRONTMATTER_DELIM = re.compile(r"^---[ \t]*\r?$", re.MULTILINE)


def _body_content(content: bytes) -> bytes:
    """Strip YAML frontmatter from Markdown content, returning only the body."""
    text = content.decode(errors="replace")
    opener = _FRONTMATTER_DELIM.match(text)
    if opener is None:
        return content
    closer = _FRONTMATTER_DELIM.search(text, opener.end())
    if closer is None:
        return content
    # Slice right after the closing `---` (not after its line) so the output
    # stays byte-identical with the historical implementation for well-formed
    # frontmatter -- existing semantic-cache hashes must not churn.
    return text[closer.start() + 3:].encode()


# Stat-based index: maps absolute path → {size, mtime_ns, indexed_at_ns, ...}.
# Loaded once per process, flushed via atexit. Skips full file reads when
# size+mtime_ns are unchanged — same trade-off as make(1).
# Correctness risks: `touch` causes a harmless extra re-hash. Same-size edits
# inside one mtime tick used to return the PREVIOUS content's digest; the
# racily-clean guard below closes that hole (see _stat_sig_fresh).
# `graphify extract --force` / `graphify update --force` (or GRAPHIFY_FORCE=1)
# skip the cache reads and re-dispatch everything when needed (#1894).
_stat_index: dict[str, dict] = {}
_stat_index_root: Path | None = None
# Key anchor for the ON-DISK index (#2199): the first caller's key-root, i.e.
# the corpus. Distinct from _stat_index_root, which is the cache-FILE location
# (cache_root, #1774) — the two differ under --out and must not be conflated.
_stat_index_anchor: Path | None = None
_stat_index_dirty: bool = False
_stat_index_atexit_registered: bool = False
# The resolved on-disk path for the CURRENTLY bound root, captured at bind
# time (#3989). A mid-process root switch must flush the OUTGOING root to
# the file it was actually loaded from, not wherever the live _GRAPHIFY_OUT
# happens to point by the time the switch is detected — a caller following
# the documented one-root-per-call pattern (set _GRAPHIFY_OUT, then call)
# has already moved it on to the NEW root before the switch is noticed.
_stat_index_path: Path | None = None


# Filesyst
```

### Core Architecture Module: `graphify/callflow_html.py`
```
#!/usr/bin/env python3
"""
callflow_html.py — Generate call-flow architecture HTML from graphify knowledge graph outputs.

Reads graph.json plus optional GRAPH_REPORT.md, .graphify_labels.json, and sections JSON,
then produces a self-contained HTML file with:
  - Dark-themed CSS (fixed template)
  - Navigation bar from section list
  - Architecture overview flowchart LR (aggregated section-level edges)
  - Per-section flowchart LR (auto-generated representative intra-section edges)
  - Call detail table scaffolding (headers + representative node rows)
  - Auto-generated section intros and key-file cards

Usage:
  python3 -m graphify export callflow-html
  python3 -m graphify export callflow-html /path/to/project/graphify-out/graph.json
  python3 -m graphify export callflow-html --graph /path/to/graph.json --output docs/architecture.html
"""

from __future__ import annotations

import json
import argparse
import os
import re
import sys
import hashlib
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, timezone
from html import escape

from graphify.paths import GRAPHIFY_OUT, GRAPHIFY_OUT_NAME


# ──────────────────────────────────────────────
# 1. CSS template (fixed, project-agnostic)
# ──────────────────────────────────────────────

CSS = """:root {
  --bg: #0f172a; --surface: #1e293b; --border: #334155;
  --text: #e2e8f0; --muted: #94a3b8; --accent: #38bdf8;
  --warn: #fbbf24; --err: #f87171; --ok: #34d399;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); line-height: 1.7; }
.container { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }
h1 { font-size: 2.4rem; margin-bottom: 8px; background: linear-gradient(135deg, var(--accent), #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
h2 { font-size: 1.7rem; margin: 48px 0 16px; padding-bottom: 8px; border-bottom: 2px solid var(--accent); }
h3 { font-size: 1.25rem; margin: 32px 0 12px; color: var(--accent); }
h4 { font-size: 1.05rem; margin: 20px 0 8px; color: var(--warn); }
p { margin: 8px 0; color: var(--muted); }
.subtitle { color: var(--muted); font-size: 1.1rem; margin-bottom: 32px; }
.mermaid { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin: 20px 0; overflow-x: auto; position: relative; }
.mermaid.is-enhanced { padding: 0; overflow: hidden; min-height: 260px; }
.mermaid-viewport { padding: 54px 24px 24px; overflow: hidden; cursor: grab; touch-action: none; min-height: 260px; }
.mermaid-viewport.is-dragging { cursor: grabbing; }
.mermaid-viewport svg { max-width: none !important; height: auto; transform-origin: 0 0; transition: transform 120ms ease; }
.mermaid-toolbar { position: absolute; top: 10px; right: 10px; z-index: 3; display: flex; align-items: center; gap: 6px; padding: 6px; background: rgba(15,23,42,0.92); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.28); }
.mermaid-toolbar button, .mermaid-toolbar .zoom-level { height: 28px; min-width: 32px; border: 1px solid var(--border); border-radius: 6px; background: #1e293b; color: var(--text); font: 600 0.78rem system-ui, sans-serif; display: inline-flex; align-items: center; justify-content: center; }
.mermaid-toolbar button { cursor: pointer; }
.mermaid-toolbar button:hover { border-color: var(--accent); color: var(--accent); }
.mermaid-toolbar .zoom-level { min-width: 52px; color: var(--muted); background: transparent; }
.call-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 0.92rem; }
.call-table th { background: #1a2744; color: var(--accent); text-align: left; padding: 10px 14px; border: 1px solid var(--border); }
.call-table td { padding: 8px 14px; border: 1px solid var(--border); vertical-align: top; }
.call-table tr:nth-child(even) { background: rgba(255,255,255,0.02); }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; }
.tag-async { background: #7c3aed33; color: #a78bfa; }
.tag-class { background: #05966933; color: var(--ok); }
.tag-func { background: #2563eb33; color: var(--accent); }
.tag-cmd { background: #d9770633; color: var(--warn); }
.tag-endpoint { background: #dc262633; color: var(--err); }
.tag-hook { background: #db277733; color: #f472b6; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin: 16px 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; margin: 16px 0; }
.arrow-chain { font-family: 'Fira Code', monospace; font-size: 0.85rem; color: var(--accent); padding: 10px; background: rgba(56,189,248,0.06); border-radius: 6px; }
code { font-family: 'Fira Code', 'Cascadia Code', monospace; background: rgba(255,255,255,0.06); padding: 1px 6px; border-radius: 3px; font-size: 0.88em; }
ul, ol { margin: 8px 0 8px 24px; color: var(--muted); }
li { margin: 4px 0; }
a { color: var(--accent); }
hr { border: none; border-top: 1px solid var(--border); margin: 40px 0; }
.nav { position: sticky; top: 0; background: var(--bg); z-index: 10; padding: 12px 0; border-bottom: 1px solid var(--border); display: flex; gap: 20px; flex-wrap: wrap; font-size: 0.9rem; }
.nav a { text-decoration: none; }
.nav a:hover { text-decoration: underline; }
@media (max-width: 768px) { .container { padding: 16px; } h1 { font-size: 1.8rem; } }
"""


# ──────────────────────────────────────────────
# 2. Data loading and normalization helpers
# ──────────────────────────────────────────────

def read_json(path: str | Path, default=None):
    """Read JSON with a useful error message."""
    if not path:
        return default
    path = Path(path)
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"ERROR: invalid JSON in {path}: {exc}") from exc


def first_present(mapping: dict, *keys, default=None):
    """Return the first non-empty value for any candidate key."""
    for key in keys:
        if key in mapping and mapping[key] not in (None, ""):
            return mapping[key]
    return default


def first_list(*values) -> list:
    """Return the first list from a set of possible schema locations."""
    for value in values:
        if isinstance(value, list):
            return value
    return []


def to_float(value, default: float = 0.0) -> float:
    """Convert graph numeric fields that may be serialized as strings."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def endpoint_id(value) -> str:
    """Normalize edge endpoints that may be strings or node-like objects."""
    if isinstance(value, dict):
        value = first_present(value, "id", "node_id", "key", "name", "qualified_name")
    return str(value or "")


def normalize_node(raw: dict, index: int) -> dict:
    """Normalize a graphify node across common graph.json schema variants."""
    node = dict(raw)
    node_id = first_present(
        node,
        "id",
        "node_id",
        "key",
        "uid",
        "name",
        "qualified_name",
        "fqname",
        "symbol",
        default=f"node_{index + 1}",
    )
    source_file = first_present(
        node,
        "source_file",
        "file",
        "file_path",
        "filepath",
        "path",
        "module_path",
        "defined_in",
        default="",
    )
    label = first_present(
        node,
        "label",
        "display_name",
        "title",
        "name",
        "qualified_name",
        "fqname",
        "symbol",
        default=node_id,
    )
    community = first_present(
        node,
        "community",
        "community_id",
        "cluster",
        "cluster_id",
        "group",
        "group_id",
        "modularity_class",
        default="unknown",
    )
    node_type = first_present(node, "node_type", "kind", "type", "category", default="")
    file_type = first_present(node, "file_type", "content_type", "artifact_type", default="")
    if not file_type:
        suffix = Path(str(source_file)).suffix.lower()
        file_type = "document" if suffix in {".md", ".mdx", ".rst", ".txt"} else "code"

    node["id"] = str(node_id)
    node["label"] = str(label)
    node["community"] = community
    node["source_file"] = str(source_file or "")
    node["node_type"] = str(node_type or "")
    node["file_type"] = str(file_type or "code")
    return node


def normalize_edge(raw: dict, index: int) -> dict | None:
    """Normalize graphify edges while preserving original fields."""
    edge = dict(raw)
    source = endpoint_id(first_present(edge, "source", "src", "from", "from_id", "start", "u"))
    target = endpoint_id(first_present(edge, "target", "dst", "to", "to_id", "end", "v"))
    if not source or not target:
        return None

    relation = first_present(edge, "relation", "type", "kind", "label", "predicate", default="relates")
    confidence = first_present(edge, "confidence", "evidence", "provenance", default="EXTRACTED")
    score = first_present(edge, "confidence_score", "score", "weight", "probability", default=1.0)

    edge["id"] = str(first_present(edge, "id", "edge_id", default=f"edge_{index + 1}"))
    edge["source"] = source
    edge["target"] = target
    edge["relation"] = str(relation or "relates").lower()
    edge["confidence"] = str(confidence or "EXTRACTED").upper()
    edge["confidence_score"] = to_float(score, 1.0)
    return edge


def _node_link_payload(data: dict) -> tuple[list, list] | None:
    """Read current graphify graph.json via NetworkX's node-link parser."""
    if not isinstance(data.get("nodes"), list):
        return None
    if not isinstance(data.get("links"), list) and not isinstance(data.get("edges"), list):
        return None

    try:
    
```

### Core Architecture Module: `graphify/cli.py`
```
"""graphify command dispatch — every non-install subcommand.

Extracted verbatim from __main__.main(); __main__ now calls dispatch_command(cmd)
after the install/platform dispatch. Kept out of __main__ to shrink the CLI entry
module. The path-redirect (`graphify <path>` -> extract) re-enters via a lazy
import of main to avoid a cli<->__main__ import cycle.
"""
from __future__ import annotations
import json
import os
import re
import sys
import time
from graphify.paths import GRAPHIFY_OUT as _GRAPHIFY_OUT
from pathlib import Path, PurePosixPath, PureWindowsPath


_SEARCH_NUDGE = json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "additionalContext": (
            'MANDATORY: graphify-out/graph.json exists. You MUST run '
            '`graphify query "<question>"` before grepping raw files. Only grep '
            'after graphify has oriented you, or to modify/debug specific lines.'
        ),
    }
}, ensure_ascii=False, separators=(",", ":")) + "\n"
_READ_NUDGE = json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "additionalContext": (
            'MANDATORY: graphify-out/graph.json exists. You MUST run graphify '
            'before reading source files. Use: `graphify query "<question>"` '
            '(scoped subgraph), `graphify explain "<concept>"`, or '
            '`graphify path "<A>" "<B>"`. Only read raw files after graphify has '
            'oriented you, or to modify/debug specific lines. This rule applies to '
            'subagents too — include it in every subagent prompt involving code '
            'exploration.'
        ),
    }
}, ensure_ascii=False, separators=(",", ":")) + "\n"
_READ_NUDGE_STALE = json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "additionalContext": (
            'graphify-out/graph.json exists but may be STALE for this file (the file '
            'changed after the last build). Prefer `graphify query "<question>"` for '
            'orientation, and run `graphify update` to refresh the graph. Reading the '
            'file directly is fine.'
        ),
    }
}, ensure_ascii=False, separators=(",", ":")) + "\n"
# Strict-mode block (opt-in). Claude Code PreToolUse honors
# hookSpecificOutput.permissionDecision == "deny" and shows permissionDecisionReason
# to the model. Fires at most once per session (see _mark_session_denied) so it can
# never strand an agent: the very next read proceeds with the soft nudge.
_READ_DENY = json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": (
            'graphify strict mode: this project has a fresh knowledge graph that covers '
            'this file. Run `graphify query "<your question>"` (or `graphify explain` / '
            '`graphify path`) FIRST to orient yourself, then re-issue this Read — it '
            'will be allowed. This block fires at most once per session; reading raw '
            'files to modify or debug specific lines is fine after one query. Apply the '
            'same rule in any subagent prompt that explores code.'
        ),
    }
}, ensure_ascii=False, separators=(",", ":")) + "\n"
_HOOK_SOURCE_EXTS = (
    '.py', '.js', '.cjs', '.ts', '.tsx', '.jsx', '.astro', '.vue', '.svelte', '.go',
    '.rs', '.java', '.rb', '.c', '.h', '.cpp', '.hpp', '.cc', '.cs', '.kt',
    '.swift', '.php', '.scala', '.lua', '.sh', '.md', '.rst', '.txt', '.mdx',
)
_GEMINI_NUDGE_TEXT = (
    'graphify: knowledge graph at graphify-out/. For focused questions, run '
    '`graphify query "<question>"` (scoped subgraph, usually much smaller than '
    'GRAPH_REPORT.md) instead of grepping raw files. Read GRAPH_REPORT.md only '
    'for broad architecture context.'
)


_DEFAULT_NUDGE_GRAPH = "graphify-out/graph.json"


def _nudge_for_out(nudge: str) -> str:
    """Name the effective graph.json in a hook-guard reminder (#4040).

    The reminder constants spell the default ``graphify-out/graph.json``. When
    ``GRAPHIFY_OUT`` points elsewhere, the reminder must name the graph that was
    actually found. Default output dir: returned byte-identical.
    """
    from graphify.paths import out_path
    try:
        ref = out_path("graph.json").as_posix()
    except Exception:
        return nudge
    if ref == _DEFAULT_NUDGE_GRAPH:
        return nudge
    d = json.loads(nudge)
    out = d["hookSpecificOutput"]
    out["additionalContext"] = out["additionalContext"].replace(_DEFAULT_NUDGE_GRAPH, ref)
    return json.dumps(d, ensure_ascii=False, separators=(",", ":")) + "\n"


def _default_graph_path() -> str:
    return str(Path(_GRAPHIFY_OUT) / "graph.json")


def _stamped_manifest_files(
    files_by_type: dict[str, list[str]],
    sem_result: dict,
    root: Path,
    partial_source_files: "set[str] | None" = None,
    failed_ast_sources: "set[str] | list[str] | None" = None,
    unverified_semantic_sources: "set[str] | list[str] | None" = None,
) -> dict[str, list[str]]:
    """Manifest-safe files dict: only stamp semantic files that actually
    produced output (cache hit or fresh extraction). Files whose chunk failed
    have no source_file entry in sem_result — leaving their semantic_hash
    empty so detect_incremental re-queues them (#933).

    A file in ``partial_source_files`` DID produce output this run, but only a
    truncated fragment of it, so it is excluded from stamping too — otherwise
    detect_incremental would see it "done" and never re-dispatch it, leaving the
    incomplete node set live forever on the warm-incremental path. Same #933
    mechanism: leave it unstamped and it is re-queued next run.

    ``unverified_semantic_sources`` (#3203): files whose semantic extraction
    under-produced compared to their prior representation (e.g. 3 -> 1 nodes).
    They are excluded from stamping unless --allow-partial is set, so the next
    incremental run retries them.

    Both sides of the membership test are resolved against the scan ``root``
    before comparing (#1897): node/edge/hyperedge ``source_file`` values are
    root-relative on a fresh extraction while ``files_by_type`` entries are
    absolute (from detect()), so a raw string comparison never matched and
    every freshly-extracted semantic doc was dropped from the manifest.
    Mirrors the #1890 path normalization in graphify.llm.

    Hyperedges are counted as output (#1920): a chunk whose only result for a
    document is a hyperedge (3+ nodes sharing a concept) is valid output that
    the semantic cache persists per-``source_file`` — omitting it here left the
    doc unstamped, so detect_incremental re-queued it on every run. The stamping
    condition mirrors the cache-write keying (a hyperedge carries its own
    ``source_file``); do not derive it from member nodes.

    ``failed_ast_sources`` (#2543): code files whose AST extractor errored
    (missing optional extra, etc.) or returned zero nodes. They must not be
    stamped as up-to-date or a later install of the extra will never re-run.
    """
    root = Path(root)

    def _resolve(value: str) -> Path:
        p = Path(value)
        if not p.is_absolute():
            p = root / p
        try:
            return p.resolve()
        except (OSError, RuntimeError):
            return p

    sem_extracted: set[Path] = set()
    # #2927: only nodes and hyperedges count as valid semantic output that stamps
    # the manifest. An edge-only result has no entity representation in the graph
    # and must be left unstamped so detect_incremental re-queues it (#933/#1666).
    for coll in ("nodes", "hyperedges"):
        for item in sem_result.get(coll, []):
            sf = item.get("source_file", "")
            if sf:
                sem_extracted.add(_resolve(sf))
    partial_resolved = {_resolve(p) for p in (partial_source_files or set())}
    unverified_resolved = {_resolve(p) for p in (unverified_semantic_sources or set())}
    failed_ast_resolved = {_resolve(p) for p in (failed_ast_sources or [])}
    sem_types = {"document", "paper", "image"}
    return {
        ftype: [
            f for f in flist
            if _resolve(f) not in failed_ast_resolved
            and (
                ftype not in sem_types
                or (
                    _resolve(f) in sem_extracted
                    and _resolve(f) not in partial_resolved
                    and _resolve(f) not in unverified_resolved
                )
            )
        ]
        for ftype, flist in files_by_type.items()
    }


def _handle_unverified_semantic_shrink(
    unverified_shrink,
    *,
    cli_allow_partial: bool,
    files_by_type,
    sem_result,
    target,
    partial_semantic_files,
    failed_ast_sources,
    semantic_files,
):
    """Shared handling for the #3203 unverified-semantic-shrink guard on both the
    raw and clustered write paths (they differ only in where the flag is read
    from — ``merged`` vs ``G.graph``). Always prints the actionable notice.

    Returns None when there is no shrink, else ``(incomplete, manifest_files,
    cleared_semantic)`` — the latter two are None unless the guard armed
    (``not cli_allow_partial``), so the caller mirrors the original inline logic.
    """
    if not unverified_shrink:
        return None
    incomplete = False
    manifest_files = None
    cleared_semantic = None
    if not cli_allow_partial:
        incomplete = True
        unverified_sources = set(unverified_shrink.keys())
        manifest_files = _stamped_manifest_files(
            files_by_type,
            sem_result,
            target,
            partial_source_files=partial_semantic_files,
            failed_ast_sources=failed_ast_sources,
            unverified_semantic_sources=unverified_sources,
        )
        stamped = {f for _flist in manifest_files.values() for f in _flist}
        cleared_semantic = {str(p) for p in semantic_files} - stamped
    details = ", ".join(
     
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4016** (2026-10-04): **[Bug]: one C# partial class drops every recursive call in the graph, in every language**
  *Symptoms*: ### Pre-flight checks  - [x] I have checked the Troubleshooting section in the README  ### What happened?  When a corpus contains a C# `partial class` split across two files (the default WinForms/WPF shape: `Form1.cs` + `Form1.Designer.cs`), every recursive `calls` self-loop disappears from `graph.json` — in Python, TypeScript, Java and C# alike, not only in the C# files.  `_merge_csharp_partial_class_nodes` (`graphify/extract.py`) collapses the partial halves, then rewrites **every** edge in the corpus and skips any edge whose endpoints are equal after the remap:  ```python for e in all_edges:     src = remap.get(e.get("source"), e.get("source"))     tgt = remap.get(e.get("target"), e.get("target"))     if src == tgt:         continue ```  That drops every pre-existing self-loop, not only the ones the merge creates. The same loop also dedups edges it never rewrote on `(src, tgt, relation, source_file, source_location)`, a key that ignores confidence/context, so it can prune legitimate parallel edges elsewhere.  **Expected:** only self-loops created by the merge itself (two distinct halves collapsing) are dropped, and edges the merge does not remap come out unchanged. That is the rule the Swift extension merge already follows (#2538) and the one `deduplicate_entities` adopted in #3809 (fixed in 0.9.69). Recursive calls are meant to be kept — `build_from_json` preserves them.  On real code (`graphify update --force --no-cluster`, v0.9.74):  | corpus | recursive `calls` self-lo
  **Post-Mortem & Fix Analysis**:
  > Thanks for opening this issue, @rohit-jsfreaky. A maintainer will take a look soon.  If you would like to discuss it in real time, come say hi on our [Discord server](https://discord.gg/XDnKVpzdXB). For longer-form questions and ideas there is also [GitHub Discussions](https://github.com/Graphify-Labs/graphify/discussions).  To help us triage, please make sure the report includes what you expected, what actually happened, and the steps (and a small sample) to reproduce it.
  > Fixed in **v0.9.75** (live on PyPI as `graphifyy==0.9.75`) via #4017, thanks @rohit-jsfreaky. 🙏

- **Issue #3931** (2026-09-30): **[Bug]: Java: calls to inherited methods get no calls edge (this.m(), super.m(), typed receivers)**
  *Symptoms*: ### Pre-flight checks  - [x] I have checked the Troubleshooting section in the README  ### What happened?  _resolve_java_member_calls looks a member call up only on the receiver's declared type. When the method is declared on a superclass, the call gets no calls edge: this.start(), super.close() and worker.start() below all stay unlinked. Expected: an edge to the superclass method, the way Java resolves it (JLS 15.12.2.1 includes inherited members in the search; for super, JLS 15.12.1 searches the direct superclass).   ### Steps to reproduce  ```shell Base.java:    class Base { void start() {} void close() {} } Worker.java:  class Worker extends Base {                   void viaThis() { this.start(); }                   void close() { super.close(); }               } Service.java: class Service {                   Worker worker;                   void viaField() { worker.start(); }               } graphify extract . --code-only ```  ### Error output or graph output  ```text Only Worker --inherits--> Base is emitted. No calls edge leaves .viaThis(), Worker.close() or .viaField(). On real code this leaves 1,693 calls edges missing in spring-amqp (679 Java files) and 2,776 in Debezium (3,101 files). ```  ### Graphify version  v8 @ 1cd9a36 (0.9.72, from source)  ### Operating System  macOS  ### Python Version  3.12  ### Installation Method  uv tool install (recommended)  ### Additional Environment Details  _No response_  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for opening this issue, @janwaleed09. A maintainer will take a look soon.  If you would like to discuss it in real time, come say hi on our [Discord server](https://discord.gg/XDnKVpzdXB). For longer-form questions and ideas there is also [GitHub Discussions](https://github.com/Graphify-Labs/graphify/discussions).  To help us triage, please make sure the report includes what you expected, what actually happened, and the steps (and a small sample) to reproduce it.
  > on it: fix being pushed 

- **Issue #3927** (2026-09-29): **[Bug]: Keyboard shortcut hints show ⌘ on Windows/Linux (search, deep research, onboarding Continue)**
  *Symptoms*: ### Pre-flight checks  - [x] I have checked the Troubleshooting section in the README  ### What happened?  The web app (app.graphify.com) shows the macOS `⌘` symbol in its keyboard shortcut hints even though I'm on Windows, where the modifier key is `Ctrl`. It appears in three places: - Dashboard sidebar search: `⌘K` - Dashboard "Deep research your codebase…" bar: `⌘I` - Onboarding, "Create your workspace" → Continue button: `⌘ ↵`  <img width="1917" height="1022" alt="Image" src="https://github.com/user-attachments/assets/88c06866-9b8d-43ad-98be-31588f7abe54" /> <img width="1917" height="1017" alt="Image" src="https://github.com/user-attachments/assets/59654469-0f94-4685-af6b-b93cdaeada43" />  ### Steps to reproduce  ```shell 1. Open https://app.graphify.com in Chrome on Windows. 2. On the dashboard, look at the search box and the "Deep research" bar. 3. Go through onboarding (`/onboarding`) and look at the Continue button. ```  ### Error output or graph output  ```text No error output. This is a display issue only. Screenshots attached. ```  ### Graphify version  _No response_  ### Operating System  Windows  ### Python Version  3.1  ### Installation Method  uv tool install (recommended)  ### Additional Environment Details  _No response_  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for opening this issue, @Graffian. A maintainer will take a look soon.  If you would like to discuss it in real time, come say hi on our [Discord server](https://discord.gg/XDnKVpzdXB). For longer-form questions and ideas there is also [GitHub Discussions](https://github.com/Graphify-Labs/graphify/discussions).  To help us triage, please make sure the report includes what you expected, what actually happened, and the steps (and a small sample) to reproduce it.
  > Hey @Graffian Thanks for dropping this issue. The app at app.graphify.com is not in the public Graphify repo, so a PR on that issue will not be able to change it. We will fix the labels on our side.   Thanks!!
  > Thanks for reporting this, @Graffian! This has now been implemented: shortcut hints show `Ctrl` on Windows/Linux and `⌘` on macOS, with a `+` separator for clarity (for example, `Ctrl+K` and `⌘+K`). This covers search, deep research, and onboarding Continue.  We really appreciate the time and effort you put into raising the issue and including clear steps and screenshots. Thanks for helping make Graphify better!

- **Issue #3886** (2026-09-29): **[Bug]: SQL: CREATE TABLEs inside BEGIN; … COMMIT; still dropped when a DO $$ … END $$; block makes tree-sitter-sql emit a top-level block (follow-up to #2953)**
  *Symptoms*: ### Pre-flight checks  - [x] I have checked the Troubleshooting section in the README  ### What happened?  `extract_sql` silently drops every `CREATE TABLE` inside a `BEGIN; … COMMIT;` transaction when the transaction also contains a `DO $$ … END $$;` block.  tree-sitter-sql parses `BEGIN;` as the opener of a `block` that closes on the `END` of the DO body. The top-level node is then `block` instead of `transaction`. Since #2953, the top-level dispatch in `graphify/extractors/sql.py` walks `statement`, `transaction`, `ERROR` and a few Firebird types, but not `block`, so nothing inside it is extracted. The `create_table` nodes are still in the tree, under the `block`. No error or warning is printed.  **Expected:** `users` is extracted as a table node. **Actual:** only the file node is produced.  Real-world impact: on an 850-line PostgreSQL `schema.sql` (PL/pgSQL trigger functions plus a few idempotent `DO $$` blocks), 8 of the 11 `CREATE TABLE` statements and all their triggers are missing from the graph.  ### Steps to reproduce  ```shell 1. Save as `repro.sql`:   BEGIN;  CREATE TABLE users (     id BIGSERIAL PRIMARY KEY );  DO $$ BEGIN     IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 't') THEN         CREATE TRIGGER t BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION touch();     END IF; END $$;  COMMIT;   2. Run in a fresh env:   uvx --from 'graphifyy[sql]==0.9.70' python -c " from pathlib import Path from graphify.extract import extract_sql print([n['la
  **Post-Mortem & Fix Analysis**:
  > Thanks for opening this issue, @mininic1. A maintainer will take a look soon.  If you would like to discuss it in real time, come say hi on our [Discord server](https://discord.gg/XDnKVpzdXB). For longer-form questions and ideas there is also [GitHub Discussions](https://github.com/Graphify-Labs/graphify/discussions).  To help us triage, please make sure the report includes what you expected, what actually happened, and the steps (and a small sample) to reproduce it.

- **Issue #3806** (2026-09-25): **[Bug]: Maven POM ingestion drops most inter-module `depends_on` edges: inherited groupId and `${...}` properties are not resolved**
  *Symptoms*: ### What happened?  ## Summary      `_parse_pom` (`graphify/manifest_ingest.py`) builds each module's package id and each   dependency's id from the literal text of the POM. Two common Maven patterns make those ids   disagree, so the `depends_on` edge points at a node that doesn't exist and is pruned as dangling   by `build_from_json`:    1. **Inherited groupId.** A module that takes its `groupId` from `<parent>` — the norm in a      multi-module reactor — gets the bare id `artifactId`, because `root.findtext("groupId")` only      reads the module's own top-level element:       ```python      gid = root.findtext("groupId")          # None when inherited from <parent>      name = f"{gid}:{aid}" if gid else aid   # -> "livy-server", not "org.apache.livy:livy-server"      ```       Dependencies on it always carry a groupId (Maven requires it), so they are emitted as      `org.apache.livy:livy-server` and never match. **Such a module can never be the target of an      edge.**    2. **Unresolved properties.** `${project.groupId}`, `${scala.binary.version}` and any other      property are kept verbatim in dependency coordinates (`${project.groupId}:livy-rsc`,      `livy-core_${scala.binary.version}`), while the target module's own id is written out      (`org.apache.livy:livy-rsc`). No match, no edge.    The failure is silent: nodes for every module are created, only the edges are missing.  ### Steps to reproduce  ```shell apache/livy` (21 modules) shows both causes in one file.   
  **Post-Mortem & Fix Analysis**:
  > Fixed in **v0.9.68** (now on PyPI) by #3823 — thanks @chiliec.  Release: https://github.com/Graphify-Labs/graphify/releases/tag/v0.9.68

- **Issue #3799** (2026-09-25): **[Bug]: Windows: `_pin_hash_seed_if_needed` re-exec returns before the command finishes, or segfaults**
  *Symptoms*: ### What happened?  `graphify extract` / `update` / `cluster-only` / `label` re-exec themselves via `os.execvpe` to pin `PYTHONHASHSEED=0` (#3641, #3779) when the caller has not set it. On Windows `os.exec*` does not replace the process: CPython starts a new process and the calling one exits. The caller therefore sees the command finish immediately while the real work continues detached, and in some runs the process crashes instead.  ### Steps to reproduce  ```shell Repro (Git Bash, any small corpus, `PYTHONHASHSEED` unset):  rm -rf graphify-out env -u PYTHONHASHSEED python -m graphify extract . --code-only; echo "exit=$?" ls graphify-out/graph.json   Observed over three runs: - exit 0 after ~0.5 s, `graph.json` absent on return, appears a few seconds later (the detached   child finished it); - exit 139 (segmentation fault / access violation), no output (twice). ```  ### Error output or graph output  ```text Effect: any script that runs `extract` and then reads `graph.json` (or runs `cluster-only`) fails intermittently on Windows. Setting `PYTHONHASHSEED=0` before calling graphify avoids the re-exec and everything works.  Suggested fix: on Windows (`os.name == "nt"`), run the child with `subprocess.run([sys.executable, "-m", "graphify", *sys.argv[1:]], env=...)` and `sys.exit(result.returncode)` instead of `os.execvpe`, so the parent waits and propagates the exit status. ```  ### Graphify version  _No response_  ### Environment  graphify 0.9.67 (pip `graphifyy`), Python 3.13.
  **Post-Mortem & Fix Analysis**:
  > Fixed in **v0.9.68** (now on PyPI) by #3816 — thanks @sinangumuskabak-sys.  Release: https://github.com/Graphify-Labs/graphify/releases/tag/v0.9.68

- **Issue #3796** (2026-09-27): **[Bug]: C#: named tuple element names are emitted as type references**
  *Symptoms*: ### What happened?  The element NAMES of a named tuple type are treated as type names.  ### Steps to reproduce  ```shell Repro — `Reader.cs`:  namespace Demo {     public class Reader     {         public static (int mode, string label) Read() => (1, "a");     } } ```  ### Error output or graph output  ```text Actual:  reader_demo_reader_read --references--> mode   (return_type) reader_demo_reader_read --references--> label  (return_type)  with `mode` and `label` minted as location-less placeholder nodes.  Expected: no references for `mode` / `label` (they are element names; the element TYPES are `int` and `string`). In tree-sitter-c-sharp the tuple element is a `tuple_element` with `type` and `name` fields; only the `type` field should feed type-reference collection.  Impact: one 5-element tuple return in our codebase produced five junk "type" nodes, repeated in every file that declares such a signature. ```  ### Graphify version  _No response_  ### Environment  graphify 0.9.67 (pip `graphifyy`), Python 3.13.1, Windows 10 (10.0.19045)  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Fixed in **v0.9.70** (now on PyPI) by #3877 — thanks @KaiyiQuan.  Release: https://github.com/Graphify-Labs/graphify/releases/tag/v0.9.70

- **Issue #1430** (2026-06-22): **Native-backend extraction prompt never requests hyperedges (drifted from skill extraction-spec)**
  *Symptoms*: ## Summary  `graphify extract --backend <gemini|claude|claude-cli|openai|kimi|deepseek|bedrock|…>` (the native, API/CLI semantic-extraction path) **never produces hyperedges** for any corpus. The agent/skill path produces them normally. The two extraction prompts had drifted apart.  ## Root cause  graphify has two semantic-extraction prompts:  - **Agent/skill path** — `tools/skillgen/fragments/references/shared/extraction-spec.md` fully documents hyperedges: *"if 3 or more nodes clearly participate together in a shared concept, flow, or pattern… add a hyperedge"*, with a populated schema example and a "max 3 per chunk" rule. - **Native-backend path** — `graphify/llm.py:_EXTRACTION_SYSTEM` only ever showed `"hyperedges":[]` (empty) in its output-schema example and never described what a hyperedge is. The prose Rules covered only nodes/edges; deep mode added only INFERRED *edges*.  So a model on the native path is literally shown an empty `hyperedges` array as the expected output and given zero guidance to populate it — it returns the empty array. The parse/merge side (`llm.py` `merged["hyperedges"].extend(...)`) and the consumers (`report.py`, `export.py`) already handle hyperedges, so it was purely a prompt gap, not plumbing.  `git log -S hyperedge -- graphify/llm.py` shows `_EXTRACTION_SYSTEM` never carried the instruction — long-standing drift, not a recent regression.  ## Impact  A documented, first-class flow (`graphify extract --backend X`) silently produced a lower-qual

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

### Incident Patch 1: `b57cf910` (2026-10-05)
**Commit Message**: docs: add GraphGuild community-program banner

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>



---

### Incident Patch 2: `33edd89b` (2026-10-03)
**Commit Message**: fix(extract): preserve Python import bindings across sibling cases

Use existing plain-import provenance to distinguish separate and same-line from-imports. Reject type aliases and dynamic namespace references, and protect changed and unchanged external callers through incremental CLI extraction.

Fixes #3793

AI-Assisted-By: OpenAI Codex
(cherry picked from commit 5e240c8bd39f58b87d7840ae40c1e34488781375)

**File**: `graphify/extract.py` (modified, +7/-9)
```diff
@@ -338,6 +338,8 @@ def _is_resolved_loose_sibling(edge: dict, module_id: str) -> bool:
         module_name = edge.pop("_python_import_module", None)
         bindings = edge.pop("_python_import_bindings", [])
         is_module_binding = edge.pop("_python_import_module_binding", False)
+        if is_module_binding is True:
+            edge["_python_plain_import"] = True
         marker_only = edge.pop("_python_import_marker_only", False)
         if not module_name:
             if not marker_only:
@@ -4083,22 +4085,16 @@ def _key(label: str) -> str:
     # to the module in the importing file. Keyed by (importing file, target module)
     # so two files aliasing the same module differently each match their own.
     import_alias_by_filenode: dict[str, dict[str, str]] = {}
-    from_targets = {(e.get("source"), e.get("target")) for e in all_edges
-                    if e.get("relation") == "imports_from"}
-    from_import_sites = {(e.get("source"), e.get("source_file"), e.get("source_location"))
-                         for e in all_edges if e.get("relation") == "imports_from"}
     external_plain_imports: dict[str, dict[str, list[str]]] = {}
     for e in all_edges:
         if e.get("relation") in ("imports", "imports_from"):
             imported_by_filenode.setdefault(e.get("source"), set()).add(e.get("target"))
             alias = e.get("local_alias")
             if alias:
                 import_alias_by_filenode.setdefault(e.get("source"), {})[e.get("target")] = _key(alias)
-        if e.get("relation") == "imports":
+        if e.get("relation") == "imports" and e.get("_python_plain_import") is True:
             src, target = e.get("source"), e.get("target")
-            if ((src, target) in from_targets
-                    or (src, e.get("source_file"), e.get("source_location")) in from_import_sites
-                    or not isinstance(target, str)):
+            if not isinstance(src, str) or not isinstance(target, str):
                 continue
             if target in node_by_id or target in contains_children or target in file_of_node:
                 continue
@@ -4150,7 +4146,8 @@ def _emit_call(caller: str, target_nid: "str | None", rc: dict) -> None:
         # older cached facts, from-imports, and ambiguous bindings fail closed.
         if rc.get("_python_receiver_shadowed") is False:
             caller_file = file_of_node.get(caller)
-            targets = external_plain_imports.get(caller_file, {}).get(receiver, [])
+            targets = (external_plain_imports.get(caller_file, {}).get(receiver, [])
+                       if caller_file is not None else [])
             if len(targets) == 1:
                 _emit_call(caller, targets[0], rc)
                 continue
@@ -9020,6 +9017,7 @@ def _canon(nid: str) -> str:
     # so it cannot be popped at that earlier point without breaking the fix.
     for e in all_edges:
         e.pop("local_alias", None)
+        e.pop("_python_plain_import", None)
 
     # Tag AST provenance so the incremental watch rebuild can distinguish
     # AST-extracted nodes from semantic/LLM nodes. On a full re-extraction
```

**File**: `graphify/extractors/engine.py` (modified, +22/-11)
```diff
@@ -1547,20 +1547,17 @@ def _python_receiver_shadow_checker(root, source: bytes):
     # A nested function can mutate module/captured bindings later. Dynamic
     # namespace operations can also replace an import without an assignment AST.
     dynamic_binding = False
+    dynamic_names = {"exec", "eval", "globals", "locals", "vars", "setattr", "delattr"}
     pending = [root]
     while pending:
         candidate = pending.pop()
-        if candidate.type in {"global_statement", "nonlocal_statement"}:
+        # Namespace mutators can be called directly, qualified, or saved under
+        # an alias. Reject references as well as calls, including imported aliases.
+        if (candidate.type in {"global_statement", "nonlocal_statement"}
+                or (candidate.type == "identifier"
+                    and _read_text(candidate, source) in dynamic_names)):
             dynamic_binding = True
             break
-        if candidate.type == "call":
-            function = candidate.child_by_field_name("function")
-            if (function is not None and function.type == "identifier"
-                    and _read_text(function, source) in {
-                        "exec", "eval", "globals", "locals", "vars", "setattr", "delattr",
-                    }):
-                dynamic_binding = True
-                break
         pending.extend(candidate.named_children)
 
     def target_names(node, names: set[str]) -> bool:
@@ -1578,7 +1575,13 @@ def target_names(node, names: set[str]) -> bool:
 
     def import_names(node) -> list[str] | None:
         names: list[str] = []
-        for item in node.named_children:
+        past_import = False
+        for item in node.children:
+            if item.type == "import":
+                past_import = True
+                continue
+            if not past_import:
+                continue
             if item.type == "aliased_import":
                 alias = item.child_by_field_name("alias")
                 if alias is None:
@@ -1596,7 +1599,8 @@ def facts(scope):
             return scopes[key]
         bound: set[str] = set()
         plain_imports: dict[str, int] = {}
-        unsafe = bool(scope.has_error or (scope.type == "module" and dynamic_binding))
+        unsafe = bool(scope.has_error or scope.child_by_field_name("type_parameters")
+                      or (scope.type == "module" and dynamic_binding))
         if scope.type in {"function_definition", "lambda"}:
             bound.update(_python_param_names(scope.child_by_field_name("parameters"), source))
 
@@ -1629,6 +1633,13 @@ def walk(node) -> None:
                 if kind in {"assignment", "augmented_assignment", "for_statement", "for_in_clause"}:
                     if not target_names(child.child_by_field_name("left"), bound):
                         unsafe = True
+                elif kind == "type_alias_statement":
+                    left = child.child_by_field_name("left")
+                    name = _read_text(left, source).split("[", 1)[0].strip() if left is not None else ""
+                    if name.isidentifier():
+                        bound.add(name)
+                    else:
+                        unsafe = True
                 elif kind == "named_expression":
                     if not target_names(child.child_by_field_name("name"), bound):
                         unsafe = True
```

**File**: `tests/test_cache.py` (modified, +1/-0)
```diff
@@ -665,6 +665,7 @@ def test_python_receiver_shadow_schema_retires_same_version_raw_calls(
     assert any(rc.get("_python_receiver_shadowed") is False
                for rc in fresh.get("raw_calls", []))
     warm = extract([target], cache_root=tmp_path, root=tmp_path)
+    assert len([e for e in cold["edges"] if e["relation"] == "calls"]) == 1
     assert [e for e in cold["edges"] if e["relation"] == "calls"] == [
         e for e in warm["edges"] if e["relation"] == "calls"
     ]
```

**File**: `tests/test_extract.py` (modified, +56/-22)
```diff
@@ -2024,21 +2024,24 @@ def test_python_external_resolver_requires_explicit_false_shadow_fact(hint):
     nodes = [{"id": "caller", "label": "caller.py", "source_file": "caller.py"},
              {"id": "caller_fetch", "label": "fetch()", "source_file": "caller.py"}]
     edges = [{"source": "caller", "target": "caller_fetch", "relation": "contains"},
-             {"source": "caller", "target": "requests", "relation": "imports"}]
+             {"source": "caller", "target": "requests", "relation": "imports",
+              "_python_plain_import": True}]
     _resolve_python_member_calls([{"raw_calls": [raw]}], nodes, edges)
     assert not any(e["relation"] == "calls" for e in edges)
 
 
-@pytest.mark.parametrize(("receiver", "imports", "extra_edges"), [
-    ("Requests", [("requests", "requests")], []),
-    ("Request", [("requests", None)], []),
-    ("requests", [], []),
-    ("requests", [("requests", None), ("other", "requests")], []),
-    ("requests", [("requests", None)], [("imports_from", "requests")]),
-    ("requests", [("requests", None)], [("imports_from", "other")]),
+@pytest.mark.parametrize(("receiver", "imports", "producer_hint"), [
+    ("Requests", [("requests", "requests")], True),
+    ("Request", [("requests", None)], True),
+    ("requests", [], True),
+    ("requests", [("requests", None), ("other", "requests")], True),
+    ("requests", [("requests", None)], None),
+    ("requests", [("requests", None)], False),
+    ("requests", [("requests", None)], 1),
+    ("requests", [("requests", None)], "true"),
 ])
 def test_python_external_resolver_requires_unique_exact_plain_import(
-    receiver, imports, extra_edges,
+    receiver, imports, producer_hint,
 ):
     from graphify.extract import _resolve_python_member_calls
 
@@ -2050,10 +2053,8 @@ def test_python_external_resolver_requires_unique_exact_plain_import(
     edges = [{"source": "caller", "target": "caller_fetch", "relation": "contains"}]
     edges.extend({"source": "caller", "target": target, "relation": "imports",
                   "source_file": "caller.py", "source_location": "L1",
+                  **({"_python_plain_import": producer_hint} if producer_hint is not None else {}),
                   **({"local_alias": alias} if alias else {})} for target, alias in imports)
-    edges.extend({"source": "caller", "target": target, "relation": relation,
-                  "source_file": "caller.py", "source_location": "L1"}
-                 for relation, target in extra_edges)
     _resolve_python_member_calls([{"raw_calls": [raw]}], nodes, edges)
     assert not any(e["relation"] == "calls" for e in edges)
 
@@ -2069,7 +2070,8 @@ def test_python_parsed_module_never_falls_back_to_coarse_call(member_count):
              {"id": "caller_fetch", "label": "fetch()", "source_file": "caller.py"},
              {"id": "helper", "label": "helper.py", "source_file": "helper.py"}]
     edges = [{"source": "caller", "target": "caller_fetch", "relation": "contains"},
-             {"source": "caller", "target": "helper", "relation": "imports"}]
+             {"source": "caller", "target": "helper", "relation": "imports",
+              "_python_plain_import": True}]
     for number in range(member_count):
         nid = f"helper_get_{number}"
         nodes.append({"id": nid, "label": "get()", "source_file": "helper.py"})
@@ -2078,21 +2080,15 @@ def test_python_parsed_module_never_falls_back_to_coarse_call(member_count):
     assert not any(e["relation"] == "calls" for e in edges)
 
 
-def test_python_external_module_call_survives_cache_and_context(tmp_path):
+def test_python_external_module_call_survives_cache(tmp_path):
     source = tmp_path / "caller.py"
     source.write_text("import requests\n\ndef fetch():\n    return requests.get('/data')\n")
     cold = extract([source], cache_root=tmp_path, root=tmp_path)
     warm = extract([source], cache_root=tmp_path, root=tmp_path)
-    context = extract(
-        [source], cache_root=tmp_path, root=tmp_path,
-        resolution_context_nodes=[{"id": "unrelated", "label": "unrelated.py",
-                                   "source_file": "unrelated.py"}],
-        resolution_context_edges=[],
-    )
     def calls(result):
         return [e for e in result["edges"] if e["relation"] == "calls" and e["target"] == "requests"]
-    assert len(calls(cold)) == len(calls(warm)) == len(calls(context)) == 1
-    assert calls(cold) == calls(warm) == calls(context)
+    assert len(calls(cold)) == len(calls(warm)) == 1
+    assert calls(cold) == calls(warm)
     graph = build_from_json(cold)
     assert graph.nodes["requests"]["external"] is True
     assert graph.get_edge_data("caller_fetch", "requests")["relation"] == "calls"
@@ -5410,3 +5406,41 @@ def test_3252_metadata_preservation(tmp_path):
     assert param_ref["source_location"] == "L2"
     assert node_by_id[param_ref["target"]]["label"] == "User"
     assert node_by_id[param_ref["target"]]["source_file"] == "models.py"
+
+
+def test_py
```

**File**: `tests/test_python_import_resolution.py` (modified, +24/-1)
```diff
@@ -41,6 +41,10 @@ def _has_edge(result: dict, source: str, target: str, relation: str) -> bool:
     ("import requests", "requests", "requests"),
     ("import requests as rq", "rq", "requests"),
     ("import requests as Requests", "Requests", "requests"),
+    ("import requests\nfrom requests import Session", "requests", "requests"),
+    ("from requests import Session; import requests", "requests", "requests"),
+    ("from other import value; import requests as rq", "rq", "requests"),
+    ("import requests as Requests\nfrom requests import Session", "Requests", "requests"),
     ("import os", "os", "os"),
     ("import pkg.sub as sub", "sub", "pkg_sub"),
 ])
@@ -61,7 +65,7 @@ def test_external_plain_import_member_call_targets_module(
     assert calls[0]["source"] == caller
     assert calls[0]["source_file"] == "caller.py"
     assert (calls[0]["confidence"], calls[0]["confidence_score"], calls[0]["context"],
-            calls[0]["source_location"], calls[0]["weight"]) == ("EXTRACTED", 1.0, "call", "L4", 1.0)
+            calls[0]["source_location"], calls[0]["weight"]) == ("EXTRACTED", 1.0, "call", f"L{len(import_line.splitlines()) + 3}", 1.0)
     assert not any(n.get("label") == "get()" for n in result["nodes"])
     assert not any("_python_receiver_shadowed" in item for item in result["nodes"] + result["edges"])
 
@@ -89,6 +93,14 @@ def test_external_plain_import_member_call_targets_module(
     "def fetch():\n    return (lambda *, requests=None: requests.get())()\n",
     "def fetch():\n    return (lambda **requests: requests.get())()\n",
     "requests = object()\ndef fetch():\n    return requests.get()\n",
+    "type requests = object\ndef fetch():\n    return requests.get()\n",
+    "def fetch():\n    type requests[T] = list[T]\n    return requests.get()\n",
+    "def fetch[requests]():\n    return requests.get()\n",
+    "import builtins\nbuiltins.exec('requests = object()')\ndef fetch():\n    return requests.get()\n",
+    "import builtins as bi\nbi.eval('globals().update(requests=object())')\ndef fetch():\n    return requests.get()\n",
+    "from builtins import exec as run\nrun('requests = object()')\ndef fetch():\n    return requests.get()\n",
+    "import builtins\nrun = builtins.exec\nrun('requests = object()')\ndef fetch():\n    return requests.get()\n",
+    "run = exec\nrun('requests = object()')\ndef fetch():\n    return requests.get()\n",
     "def outer():\n    requests = object()\n    def fetch():\n        return requests.get()\n",
     "if flag:\n    import requests\ndef fetch():\n    return requests.get()\n",
     "from elsewhere import *\ndef fetch():\n    return requests.get()\n",
@@ -108,6 +120,17 @@ def test_external_module_fallback_rejects_receiver_shadow(tmp_path: Path, body:
     assert not any(e["relation"] == "calls" and e["target"] == "requests" for e in result["edges"])
 
 
+@pytest.mark.parametrize("declaration", [
+    "from requests import Session",
+    "from other import value as requests",
+])
+def test_external_module_fallback_rejects_from_only_import(tmp_path: Path, declaration: str):
+    source = _write(tmp_path / "caller.py", f"{declaration}\ndef fetch():\n    return requests.get()\n")
+    result = extract([source], cache_root=tmp_path)
+    assert not any(e["relation"] == "calls" and e["target"] in {"requests", "other"}
+                   for e in result["edges"])
+
+
 def test_overdeep_relative_import_is_unresolved_not_fatal(tmp_path: Path):
     source = _write(
         tmp_path / "pkg" / "mod.py",
```

---

### Incident Patch 3: `6868fff8` (2026-10-03)
**Commit Message**: fix(extract): track calls to external Python modules

AI-Assisted-By: OpenAI Codex
(cherry picked from commit 3464399d4f8ae28a177f7b4c0af41063af12767a)

**File**: `graphify/cache.py` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@
     _EXTRACTOR_VERSION = "unknown"
 
 # Bump when AST cache-key semantics change independently of the package version.
-_AST_CACHE_SCHEMA = 4  # Rust generic-impl identity markers + Terraform block attributes.
+_AST_CACHE_SCHEMA = 5  # Python receiver-shadow facts in persisted raw calls.
 
 # Version dirs already swept this process — cleanup runs once per (base, version).
 _cleaned_ast_dirs: set[str] = set()
```

**File**: `graphify/extract.py` (modified, +27/-0)
```diff
@@ -4083,12 +4083,28 @@ def _key(label: str) -> str:
     # to the module in the importing file. Keyed by (importing file, target module)
     # so two files aliasing the same module differently each match their own.
     import_alias_by_filenode: dict[str, dict[str, str]] = {}
+    from_targets = {(e.get("source"), e.get("target")) for e in all_edges
+                    if e.get("relation") == "imports_from"}
+    from_import_sites = {(e.get("source"), e.get("source_file"), e.get("source_location"))
+                         for e in all_edges if e.get("relation") == "imports_from"}
+    external_plain_imports: dict[str, dict[str, list[str]]] = {}
     for e in all_edges:
         if e.get("relation") in ("imports", "imports_from"):
             imported_by_filenode.setdefault(e.get("source"), set()).add(e.get("target"))
             alias = e.get("local_alias")
             if alias:
                 import_alias_by_filenode.setdefault(e.get("source"), {})[e.get("target")] = _key(alias)
+        if e.get("relation") == "imports":
+            src, target = e.get("source"), e.get("target")
+            if ((src, target) in from_targets
+                    or (src, e.get("source_file"), e.get("source_location")) in from_import_sites
+                    or not isinstance(target, str)):
+                continue
+            if target in node_by_id or target in contains_children or target in file_of_node:
+                continue
+            binding = e.get("local_alias") or target
+            if isinstance(binding, str):
+                external_plain_imports.setdefault(src, {}).setdefault(binding, []).append(target)
 
     def _module_stem_key(nid: str) -> str:
         n = node_by_id.get(nid)
@@ -4129,6 +4145,17 @@ def _emit_call(caller: str, target_nid: "str | None", rc: dict) -> None:
         caller = rc.get("caller_nid")
         if not receiver or not callee or not caller:
             continue
+        # External modules have no parsed member definition. The extractor's
+        # present-false lexical fact and one exact plain import are both needed;
+        # older cached facts, from-imports, and ambiguous bindings fail closed.
+        if rc.get("_python_receiver_shadowed") is False:
+            caller_file = file_of_node.get(caller)
+            targets = external_plain_imports.get(caller_file, {}).get(receiver, [])
+            if len(targets) == 1:
+                _emit_call(caller, targets[0], rc)
+                continue
+            if targets:
+                continue
         if receiver[:1].isupper():
             # Class arm (#1446): a capitalized receiver is a class reference; an
             # instance (`self`, `obj`) never collides with a same-spelled class.
```

**File**: `graphify/extractors/engine.py` (modified, +147/-0)
```diff
@@ -1534,6 +1534,145 @@ def walk(n) -> None:
     walk(root)
     return bound
 
+
+def _python_receiver_shadow_checker(root, source: bytes):
+    """Conservative lexical guard for a plain external module receiver.
+
+    A module-root plain import is the only eligible binding. Other bindings in
+    any enclosing scope make the receiver unsafe, regardless of statement order.
+    Cache each scope scan because every member call in that scope asks again.
+    """
+    scope_types = {"module", "function_definition", "class_definition", "lambda"}
+    scopes: dict[int, tuple[set[str], dict[str, int], bool]] = {}
+    # A nested function can mutate module/captured bindings later. Dynamic
+    # namespace operations can also replace an import without an assignment AST.
+    dynamic_binding = False
+    pending = [root]
+    while pending:
+        candidate = pending.pop()
+        if candidate.type in {"global_statement", "nonlocal_statement"}:
+            dynamic_binding = True
+            break
+        if candidate.type == "call":
+            function = candidate.child_by_field_name("function")
+            if (function is not None and function.type == "identifier"
+                    and _read_text(function, source) in {
+                        "exec", "eval", "globals", "locals", "vars", "setattr", "delattr",
+                    }):
+                dynamic_binding = True
+                break
+        pending.extend(candidate.named_children)
+
+    def target_names(node, names: set[str]) -> bool:
+        if node is None:
+            return False
+        if node.type == "identifier":
+            names.add(_read_text(node, source))
+            return True
+        if node.type in {"tuple_pattern", "list_pattern", "pattern_list",
+                         "parenthesized_expression", "as_pattern_target"}:
+            return all(target_names(c, names) for c in node.named_children)
+        if node.type in {"attribute", "subscript"}:
+            return target_names(node.child_by_field_name("object") or node.named_children[0], names)
+        return False
+
+    def import_names(node) -> list[str] | None:
+        names: list[str] = []
+        for item in node.named_children:
+            if item.type == "aliased_import":
+                alias = item.child_by_field_name("alias")
+                if alias is None:
+                    return None
+                names.append(_read_text(alias, source))
+            elif item.type == "dotted_name":
+                names.append(_read_text(item, source).split(".")[0])
+            elif item.type == "wildcard_import":
+                return None
+        return names
+
+    def facts(scope):
+        key = scope.id
+        if key in scopes:
+            return scopes[key]
+        bound: set[str] = set()
+        plain_imports: dict[str, int] = {}
+        unsafe = bool(scope.has_error or (scope.type == "module" and dynamic_binding))
+        if scope.type in {"function_definition", "lambda"}:
+            bound.update(_python_param_names(scope.child_by_field_name("parameters"), source))
+
+        def walk(node) -> None:
+            nonlocal unsafe
+            for child in node.named_children:
+                kind = child.type
+                if kind in {"function_definition", "class_definition"}:
+                    name = child.child_by_field_name("name")
+                    if name is None:
+                        unsafe = True
+                    else:
+                        bound.add(_read_text(name, source))
+                    continue
+                if kind == "lambda":
+                    continue
+                if kind in {"global_statement", "nonlocal_statement", "match_statement", "ERROR"}:
+                    unsafe = True
+                    continue
+                if kind in {"import_statement", "import_from_statement"}:
+                    names = import_names(child)
+                    if names is None:
+                        unsafe = True
+                    elif kind == "import_statement" and scope.type == "module" and node == scope:
+                        for name in names:
+                            plain_imports[name] = plain_imports.get(name, 0) + 1
+                    else:
+                        bound.update(names)
+                    continue
+                if kind in {"assignment", "augmented_assignment", "for_statement", "for_in_clause"}:
+                    if not target_names(child.child_by_field_name("left"), bound):
+                        unsafe = True
+                elif kind == "named_expression":
+                    if not target_names(child.child_by_field_name("name"), bound):
+                        unsafe = True
+                elif kind == "with_item":
+                    alias = child.child_by_field_name("alias")
+                    value = child.child_by_field_name("value")
+                    if alias is None and value is not None and value.type == "as_pattern"
```

**File**: `tests/test_cache.py` (modified, +31/-0)
```diff
@@ -639,6 +639,37 @@ def test_ast_cache_schema_rejects_same_version_legacy_collision(
     assert not old_dir.exists()
 
 
+def test_python_receiver_shadow_schema_retires_same_version_raw_calls(
+    tmp_path, monkeypatch,
+):
+    """Schema-4 raw calls lack the lexical fact required by external resolution."""
+    import graphify.cache as cache_mod
+    from graphify.extract import extract
+
+    target = tmp_path / "caller.py"
+    target.write_text("import requests\n\ndef fetch():\n    return requests.get('/data')\n")
+    monkeypatch.setattr(cache_mod, "_EXTRACTOR_VERSION", "same-version")
+    monkeypatch.setattr(cache_mod, "_AST_CACHE_SCHEMA", 4)
+    monkeypatch.setattr(cache_mod, "_cleaned_ast_dirs", set())
+    save_cached(target, {"nodes": [], "edges": [], "raw_calls": [
+        {"caller_nid": "old", "receiver": "requests", "callee": "get"}
+    ]}, root=tmp_path, kind="ast")
+    old_dir = cache_dir(tmp_path, "ast")
+
+    monkeypatch.setattr(cache_mod, "_AST_CACHE_SCHEMA", 5)
+    assert load_cached(target, root=tmp_path, kind="ast") is None
+    assert not old_dir.exists()
+    cold = extract([target], cache_root=tmp_path, root=tmp_path)
+    fresh = load_cached(target, root=tmp_path, kind="ast")
+    assert fresh is not None
+    assert any(rc.get("_python_receiver_shadowed") is False
+               for rc in fresh.get("raw_calls", []))
+    warm = extract([target], cache_root=tmp_path, root=tmp_path)
+    assert [e for e in cold["edges"] if e["relation"] == "calls"] == [
+        e for e in warm["edges"] if e["relation"] == "calls"
+    ]
+
+
 def test_ast_cache_version_bump_cleans_stale_entries(tmp_path, monkeypatch):
     """Upgrading removes AST entries left behind by previous versions so the
     cache directory does not grow one full copy per release."""
```

**File**: `tests/test_extract.py` (modified, +93/-5)
```diff
@@ -1992,11 +1992,8 @@ def test_python_namespace_package_import_of_non_module_fabricates_nothing(tmp_pa
     assert fabricated == [], fabricated
 
 
-def test_python_external_aliased_import_fabricates_no_call_edge(tmp_path):
-    """#2082 must not over-resolve: an aliased import of an EXTERNAL/uncorpus
-    module (`import numpy as np; np.array()`) has no in-corpus callee, so it must
-    produce NO `calls` edge — the alias resolution stays inside the member-call
-    carve-out (in-corpus target required)."""
+def test_python_external_aliased_import_fabricates_no_member_node(tmp_path):
+    """External calls may target the imported module, never an invented member."""
     caller = tmp_path / "app.py"
     caller.write_text(
         "import numpy as np\n"
@@ -2016,6 +2013,97 @@ def test_python_external_aliased_import_fabricates_no_call_edge(tmp_path):
     assert fabricated == [], f"external aliased calls must not fabricate edges: {fabricated}"
 
 
+@pytest.mark.parametrize("hint", [None, 0, 1, "false"])
+def test_python_external_resolver_requires_explicit_false_shadow_fact(hint):
+    from graphify.extract import _resolve_python_member_calls
+
+    raw = {"caller_nid": "caller_fetch", "callee": "get", "receiver": "requests",
+           "is_member_call": True, "source_file": "caller.py", "source_location": "L4"}
+    if hint is not None:
+        raw["_python_receiver_shadowed"] = hint
+    nodes = [{"id": "caller", "label": "caller.py", "source_file": "caller.py"},
+             {"id": "caller_fetch", "label": "fetch()", "source_file": "caller.py"}]
+    edges = [{"source": "caller", "target": "caller_fetch", "relation": "contains"},
+             {"source": "caller", "target": "requests", "relation": "imports"}]
+    _resolve_python_member_calls([{"raw_calls": [raw]}], nodes, edges)
+    assert not any(e["relation"] == "calls" for e in edges)
+
+
+@pytest.mark.parametrize(("receiver", "imports", "extra_edges"), [
+    ("Requests", [("requests", "requests")], []),
+    ("Request", [("requests", None)], []),
+    ("requests", [], []),
+    ("requests", [("requests", None), ("other", "requests")], []),
+    ("requests", [("requests", None)], [("imports_from", "requests")]),
+    ("requests", [("requests", None)], [("imports_from", "other")]),
+])
+def test_python_external_resolver_requires_unique_exact_plain_import(
+    receiver, imports, extra_edges,
+):
+    from graphify.extract import _resolve_python_member_calls
+
+    raw = {"caller_nid": "caller_fetch", "callee": "get", "receiver": receiver,
+           "is_member_call": True, "source_file": "caller.py", "source_location": "L4",
+           "_python_receiver_shadowed": False}
+    nodes = [{"id": "caller", "label": "caller.py", "source_file": "caller.py"},
+             {"id": "caller_fetch", "label": "fetch()", "source_file": "caller.py"}]
+    edges = [{"source": "caller", "target": "caller_fetch", "relation": "contains"}]
+    edges.extend({"source": "caller", "target": target, "relation": "imports",
+                  "source_file": "caller.py", "source_location": "L1",
+                  **({"local_alias": alias} if alias else {})} for target, alias in imports)
+    edges.extend({"source": "caller", "target": target, "relation": relation,
+                  "source_file": "caller.py", "source_location": "L1"}
+                 for relation, target in extra_edges)
+    _resolve_python_member_calls([{"raw_calls": [raw]}], nodes, edges)
+    assert not any(e["relation"] == "calls" for e in edges)
+
+
+@pytest.mark.parametrize("member_count", [0, 2])
+def test_python_parsed_module_never_falls_back_to_coarse_call(member_count):
+    from graphify.extract import _resolve_python_member_calls
+
+    raw = {"caller_nid": "caller_fetch", "callee": "get", "receiver": "helper",
+           "is_member_call": True, "source_file": "caller.py", "source_location": "L4",
+           "_python_receiver_shadowed": False}
+    nodes = [{"id": "caller", "label": "caller.py", "source_file": "caller.py"},
+             {"id": "caller_fetch", "label": "fetch()", "source_file": "caller.py"},
+             {"id": "helper", "label": "helper.py", "source_file": "helper.py"}]
+    edges = [{"source": "caller", "target": "caller_fetch", "relation": "contains"},
+             {"source": "caller", "target": "helper", "relation": "imports"}]
+    for number in range(member_count):
+        nid = f"helper_get_{number}"
+        nodes.append({"id": nid, "label": "get()", "source_file": "helper.py"})
+        edges.append({"source": "helper", "target": nid, "relation": "contains"})
+    _resolve_python_member_calls([{"raw_calls": [raw]}], nodes, edges)
+    assert not any(e["relation"] == "calls" for e in edges)
+
+
+def test_python_external_module_call_survives_cache_and_context(tmp_path):
+    source = tmp_path / "caller.py"
+    source.write_text("import requests\n\ndef fetch():\n    return requests.get('/data')\n")
+    cold = extract([source], cache_root=tmp_path, root=tmp_pa
```

**File**: `tests/test_python_import_resolution.py` (modified, +73/-0)
```diff
@@ -2,6 +2,8 @@
 
 from pathlib import Path
 
+import pytest
+
 from graphify.extract import extract
 from graphify.extractors.resolution import (
     _SCAN_ROOT_NAMESPACE_CACHE,
@@ -35,6 +37,77 @@ def _has_edge(result: dict, source: str, target: str, relation: str) -> bool:
     )
 
 
+@pytest.mark.parametrize(("import_line", "receiver", "target"), [
+    ("import requests", "requests", "requests"),
+    ("import requests as rq", "rq", "requests"),
+    ("import requests as Requests", "Requests", "requests"),
+    ("import os", "os", "os"),
+    ("import pkg.sub as sub", "sub", "pkg_sub"),
+])
+def test_external_plain_import_member_call_targets_module(
+    tmp_path: Path, import_line: str, receiver: str, target: str,
+):
+    source = _write(tmp_path / "caller.py", (
+        f"{import_line}\n\n"
+        "def fetch():\n"
+        f"    return {receiver}.get('/data')\n\n"
+        "def unrelated():\n"
+        "    return 1\n"
+    ))
+    result = extract([source], cache_root=tmp_path)
+    caller = _node_id(result, "fetch()", "caller.py")
+    calls = [e for e in result["edges"] if e["relation"] == "calls" and e["target"] == target]
+    assert len(calls) == 1
+    assert calls[0]["source"] == caller
+    assert calls[0]["source_file"] == "caller.py"
+    assert (calls[0]["confidence"], calls[0]["confidence_score"], calls[0]["context"],
+            calls[0]["source_location"], calls[0]["weight"]) == ("EXTRACTED", 1.0, "call", "L4", 1.0)
+    assert not any(n.get("label") == "get()" for n in result["nodes"])
+    assert not any("_python_receiver_shadowed" in item for item in result["nodes"] + result["edges"])
+
+
+@pytest.mark.parametrize("body", [
+    "def fetch(requests):\n    return requests.get()\n",
+    "def fetch(*, requests=None):\n    return requests.get()\n",
+    "def fetch():\n    requests = object()\n    return requests.get()\n",
+    "def fetch():\n    requests, x = pair\n    return requests.get()\n",
+    "def fetch():\n    requests += 1\n    return requests.get()\n",
+    "def fetch():\n    (requests := object())\n    return requests.get()\n",
+    "def fetch():\n    for requests in xs: pass\n    return requests.get()\n",
+    "def fetch():\n    xs = [requests.get() for requests in things]\n    return requests.get()\n",
+    "def fetch():\n    with open('x') as requests: pass\n    return requests.get()\n",
+    "def fetch():\n    try: pass\n    except Exception as requests: pass\n    return requests.get()\n",
+    "def fetch():\n    def requests(): pass\n    return requests.get()\n",
+    "def fetch():\n    class requests: pass\n    return requests.get()\n",
+    "def fetch():\n    del requests\n    return requests.get()\n",
+    "def fetch():\n    requests.value = 1\n    return requests.get()\n",
+    "def fetch():\n    import requests\n    return requests.get()\n",
+    "def fetch():\n    global requests\n    return requests.get()\n",
+    "def fetch():\n    nonlocal requests\n    return requests.get()\n",
+    "def fetch():\n    match x:\n        case requests: pass\n    return requests.get()\n",
+    "def fetch():\n    return (lambda requests: requests.get())(object())\n",
+    "def fetch():\n    return (lambda *, requests=None: requests.get())()\n",
+    "def fetch():\n    return (lambda **requests: requests.get())()\n",
+    "requests = object()\ndef fetch():\n    return requests.get()\n",
+    "def outer():\n    requests = object()\n    def fetch():\n        return requests.get()\n",
+    "if flag:\n    import requests\ndef fetch():\n    return requests.get()\n",
+    "from elsewhere import *\ndef fetch():\n    return requests.get()\n",
+    "def fetch():\n    exec('requests = other')\n    return requests.get()\n",
+    "def fetch():\n    eval('globals().__setitem__(\\\"requests\\\", other)')\n    return requests.get()\n",
+    "def fetch():\n    globals()['requests'] = other\n    return requests.get()\n",
+    "def fetch():\n    locals()['requests'] = other\n    return requests.get()\n",
+    "def fetch():\n    setattr(requests, 'get', other)\n    return requests.get()\n",
+    "def fetch():\n    delattr(requests, 'get')\n    return requests.get()\n",
+    "def mutate():\n    global requests\n    requests = other\ndef fetch():\n    return requests.get()\n",
+    "import requests\ndef fetch():\n    return requests.get()\n",
+    "import other as requests\ndef fetch():\n    return requests.get()\n",
+])
+def test_external_module_fallback_rejects_receiver_shadow(tmp_path: Path, body: str):
+    source = _write(tmp_path / "caller.py", "import requests\n" + body)
+    result = extract([source], cache_root=tmp_path)
+    assert not any(e["relation"] == "calls" and e["target"] == "requests" for e in result["edges"])
+
+
 def test_overdeep_relative_import_is_unresolved_not_fatal(tmp_path: Path):
     source = _write(
         tmp_path / "pkg" / "mod.py",
```

---

### Incident Patch 4: `ea1f1585` (2026-09-29)
**Commit Message**: fix(path): resolve path::symbol and node-id endpoints before scoring (#3913)

`graphify path` and the MCP `shortest_path` tool picked endpoints by token
scoring only, so the forms `explain` already honours were misread:

- a bare label shared by symbols in several files was routed to one of them
  silently instead of being refused with the candidate ids;
- `src/b.ts::.nonce()` scored the path half and resolved to the file node;
- a full node id tokenized to its containing class.

Both entry points now share `_resolve_path_endpoint`: an exact
`_find_node` hit (path::symbol, node id, exact label or source path) is used
as-is and refused with the candidate list when it spans several files; only
queries without an exact hit fall through to `_score_nodes`.

Two same-named symbols in one file are refused as well, listing their
locations and ids, since `path::symbol` cannot tell them apart. A plain
file path still resolves to the file node. The ambiguity hint now suggests
`<path>::<label>` with the node's own label instead of echoing the query,
and `explain` prints the same shared message.

(cherry picked from commit c2d558aff71db0dfc26e1bd07209a58975ed370f)

**File**: `graphify/cli.py` (modified, +12/-20)
```diff
@@ -1628,7 +1628,7 @@ def dispatch_command(cmd: str) -> None:
                 file=sys.stderr,
             )
             sys.exit(1)
-        from graphify.serve import _pick_scored_endpoint, _score_nodes
+        from graphify.serve import _resolve_path_endpoint
         from networkx.readwrite import json_graph
         import networkx as _nx
 
@@ -1679,16 +1679,15 @@ def dispatch_command(cmd: str) -> None:
             G = json_graph.node_link_graph(_raw, edges="links")
         except TypeError:
             G = json_graph.node_link_graph(_raw)
-        src_scored = _score_nodes(G, [t.lower() for t in source_label.split()])
-        tgt_scored = _score_nodes(G, [t.lower() for t in target_label.split()])
-        if not src_scored:
-            print(f"No node matching '{source_label}' found.", file=sys.stderr)
-            sys.exit(1)
-        if not tgt_scored:
-            print(f"No node matching '{target_label}' found.", file=sys.stderr)
-            sys.exit(1)
-        src_nid = _pick_scored_endpoint(G, src_scored, source_label)
-        tgt_nid = _pick_scored_endpoint(G, tgt_scored, target_label)
+        src_nid, src_scored, src_err = _resolve_path_endpoint(G, source_label)
+        tgt_nid, tgt_scored, tgt_err = _resolve_path_endpoint(G, target_label)
+        for _label, _nid, _err in (
+            (source_label, src_nid, src_err),
+            (target_label, tgt_nid, tgt_err),
+        ):
+            if _err or _nid is None:
+                print(_err or f"No node matching '{_label}' found.", file=sys.stderr)
+                sys.exit(1)
         # Ambiguity guard: when both queries resolve to the same node, the
         # shortest path is trivially zero hops, which is almost never what the
         # caller wanted (see bug #828).
@@ -1805,7 +1804,7 @@ def dispatch_command(cmd: str) -> None:
         if len(sys.argv) < 3:
             print('Usage: graphify explain "<node>" [--graph path]', file=sys.stderr)
             sys.exit(1)
-        from graphify.serve import _find_node, find_node_ambiguity
+        from graphify.serve import _ambiguity_message, _find_node, find_node_ambiguity
         from networkx.readwrite import json_graph
 
         label = sys.argv[2]
@@ -1834,14 +1833,7 @@ def dispatch_command(cmd: str) -> None:
             sys.exit(0)
         rivals = find_node_ambiguity(G, label)
         if rivals:
-            print(f"Ambiguous: '{label}' matches {len(rivals)} nodes in different files.")
-            for rival in rivals:
-                print(f"  {G.nodes[rival].get('source_file') or rival}")
-                print(f"    id: {rival}")
-            print(
-                f"Retry with path::symbol using one of the paths above (e.g. "
-                f"<path>::{label}) or the full node id."
-            )
+            print(_ambiguity_message(G, label, rivals))
             sys.exit(1)
         nid = matches[0]
         d = G.nodes[nid]
```

**File**: `graphify/serve.py` (modified, +90/-22)
```diff
@@ -1625,16 +1625,20 @@ def find_node_ambiguity(G: nx.Graph, label: str) -> list[str]:
     nodes; this covers the symbol case it does not reach.
     """
     for tier in _find_node_tiers(G, label):
-        if not tier:
-            continue
-        by_source: dict[str, str] = {}
-        for nid in tier:
-            source = str(G.nodes[nid].get("source_file") or "")
-            by_source.setdefault(source, nid)
-        return list(by_source.values()) if len(by_source) > 1 else []
+        if tier:
+            return _rivals_across_files(G, tier)
     return []
 
 
+def _rivals_across_files(G: nx.Graph, tier: list[str]) -> list[str]:
+    """One node id per distinct source file in *tier*, or `[]` for a single file."""
+    by_source: dict[str, str] = {}
+    for nid in tier:
+        source = str(G.nodes[nid].get("source_file") or "")
+        by_source.setdefault(source, nid)
+    return list(by_source.values()) if len(by_source) > 1 else []
+
+
 def _resolve_single_node(G: nx.Graph, label: str) -> tuple[str | None, str | None]:
     """Shared node resolution for the get_node / get_neighbors tools.
 
@@ -1649,33 +1653,97 @@ def _resolve_single_node(G: nx.Graph, label: str) -> tuple[str | None, str | Non
         return None, f"No node matching '{label}' found."
     rivals = find_node_ambiguity(G, label)
     if rivals:
-        listing = "\n".join(
-            f"  {G.nodes[r].get('source_file') or r}\n    id: {r}" for r in rivals
-        )
-        return None, (
-            f"Ambiguous: '{label}' matches {len(rivals)} nodes in different files.\n"
-            f"{listing}\n"
-            f"Retry with path::symbol using one of the paths above (e.g. "
-            f"<path>::{label}) or the full node id."
-        )
+        return None, _ambiguity_message(G, label, rivals)
     return matches[0], None
 
 
+def _ambiguity_message(G: nx.Graph, label: str, rivals: list[str]) -> str:
+    listing = "\n".join(
+        f"  {G.nodes[r].get('source_file') or r}\n    id: {r}" for r in rivals
+    )
+    # The example names the matched node's own label: echoing the query would
+    # nest a path-scoped one (`index.ts::foo()`) behind a second path.
+    symbol = G.nodes[rivals[0]].get("label") or label
+    return (
+        f"Ambiguous: '{label}' matches {len(rivals)} nodes in different files.\n"
+        f"{listing}\n"
+        f"Retry with path::symbol using one of the paths above (e.g. "
+        f"<path>::{symbol}) or the full node id."
+    )
+
+
+def _same_file_ambiguity_message(G: nx.Graph, label: str, hits: list[str]) -> str:
+    source = G.nodes[hits[0]].get("source_file")
+    where = f"in {source}" if source else "with no source file"
+    listing = "\n".join(
+        f"  {G.nodes[h].get('source_location') or G.nodes[h].get('label', h)}\n    id: {h}"
+        for h in hits
+    )
+    return (
+        f"Ambiguous: '{label}' matches {len(hits)} nodes {where}.\n"
+        f"{listing}\n"
+        f"Retry with the full node id."
+    )
+
+
+def _resolve_path_endpoint(
+    G: nx.Graph, query: str
+) -> tuple[str | None, list[tuple[float, str]], str | None]:
+    """Resolve one endpoint of the `path` CLI / `shortest_path` tool (#3913).
+
+    A hit in `_find_node`'s exact tiers — the `path::symbol` form, a full node
+    id, an exact label or source path — names the node outright, so it is used
+    as-is, and refused with the candidate list when it spans several files (the
+    answer `explain` gives). Scoring alone tokenized those forms instead: the
+    path half of `path::symbol` pulled the route to the file node, and an id's
+    tokens to its containing class. Only a query without an exact hit falls
+    through to `_score_nodes`, which ranks the multi-word and partial labels
+    the tiers cannot.
+
+    Several hits in one file are refused too, unless the query is a file path
+    (whose tier is the file node followed by its members): two same-named
+    symbols of one file were split by graph order behind a score-tie warning,
+    and `path::symbol` cannot separate them — only the node id can.
+
+    Returns ``(node_id, scored, None)``, where ``scored`` is empty unless the
+    score fallback picked the node; ``(None, [], message)`` when ambiguous; and
+    ``(None, [], None)`` when nothing matches.
+    """
+    source_exact, exact, _, _ = _find_node_tiers(G, query)
+    hits = source_exact or exact
+    if hits:
+        rivals = _rivals_across_files(G, hits)
+        if rivals:
+            return None, [], _ambiguity_message(G, query, rivals)
+        # A `path::symbol` hit also lands in `source_exact`; only a plain path
+        # query makes that tier a file lookup.
+        file_query = bool(source_exact) and "::" not in query
+        if len(hits) > 1 and not file_query:
+            return None, [], _same_file_ambiguity_message(G, query, hits)
+        return hits[0], [], None
+    scored = _score_nodes(G, [t.lower() for t in query.split()])
+    if not scored:
+        return N
```

**File**: `tests/test_path_cli.py` (modified, +176/-0)
```diff
@@ -326,3 +326,179 @@ def test_explain_direction_recovered_from_src_tgt_markers(monkeypatch, tmp_path,
     out = capsys.readouterr().out
     assert "<-- spoke.ts [calls]" in out
     assert "--> spoke.ts" not in out
+
+
+# ── #3913: endpoints resolve like `explain` (refuse ambiguity, honor ::/id) ──
+
+def _twin_method_graph(tmp_path):
+    """`.nonce()` defined on a class in each of two files, both reachable from run()."""
+    data = {
+        "directed": False, "multigraph": False, "graph": {},
+        "nodes": [
+            {"id": "src_main", "label": "main.ts", "source_file": "src/main.ts",
+             "source_location": "L1"},
+            {"id": "src_main_run", "label": "run()", "source_file": "src/main.ts",
+             "source_location": "L3"},
+            {"id": "src_a", "label": "a.ts", "source_file": "src/a.ts",
+             "source_location": "L1"},
+            {"id": "src_a_alphaclient", "label": "AlphaClient", "source_file": "src/a.ts",
+             "source_location": "L1"},
+            {"id": "src_a_alphaclient_nonce", "label": ".nonce()", "source_file": "src/a.ts",
+             "source_location": "L1"},
+            {"id": "src_b", "label": "b.ts", "source_file": "src/b.ts",
+             "source_location": "L1"},
+            {"id": "src_b_betaclient", "label": "BetaClient", "source_file": "src/b.ts",
+             "source_location": "L1"},
+            {"id": "src_b_betaclient_nonce", "label": ".nonce()", "source_file": "src/b.ts",
+             "source_location": "L1"},
+        ],
+        "links": [
+            {"source": "src_main", "target": "src_main_run", "relation": "contains",
+             "confidence": "EXTRACTED"},
+            {"source": "src_main_run", "target": "src_a_alphaclient", "relation": "calls",
+             "confidence": "EXTRACTED"},
+            {"source": "src_main_run", "target": "src_b_betaclient", "relation": "calls",
+             "confidence": "EXTRACTED"},
+            {"source": "src_a", "target": "src_a_alphaclient", "relation": "contains",
+             "confidence": "EXTRACTED"},
+            {"source": "src_b", "target": "src_b_betaclient", "relation": "contains",
+             "confidence": "EXTRACTED"},
+            {"source": "src_a_alphaclient", "target": "src_a_alphaclient_nonce",
+             "relation": "method", "confidence": "EXTRACTED"},
+            {"source": "src_b_betaclient", "target": "src_b_betaclient_nonce",
+             "relation": "method", "confidence": "EXTRACTED"},
+        ],
+    }
+    gp = tmp_path / "graph.json"
+    gp.write_text(json.dumps(data))
+    return gp
+
+
+@pytest.mark.parametrize("ends", [("run()", ".nonce()"), (".nonce()", "run()")])
+def test_path_refuses_ambiguous_endpoint(monkeypatch, tmp_path, capsys, ends):
+    """A bare label naming symbols in two files is refused with the candidate ids,
+    as `explain` does, instead of a confident route through one of them — on
+    either end of the path."""
+    gp = _twin_method_graph(tmp_path)
+    monkeypatch.setattr(mainmod, "_check_skill_version", lambda _: None)
+    monkeypatch.setattr(mainmod.sys, "argv",
+        ["graphify", "path", *ends, "--graph", str(gp)])
+    with pytest.raises(SystemExit) as exc_info:
+        mainmod.main()
+    assert exc_info.value.code == 1
+    captured = capsys.readouterr()
+    assert "Shortest path" not in captured.out
+    assert "Ambiguous: '.nonce()' matches 2 nodes in different files." in captured.err
+    assert "src_a_alphaclient_nonce" in captured.err
+    assert "src_b_betaclient_nonce" in captured.err
+
+
+@pytest.mark.parametrize("target", ["src/b.ts::.nonce()", "src_b_betaclient_nonce"])
+def test_path_endpoint_selects_named_node(monkeypatch, tmp_path, capsys, target):
+    """The two retry forms `explain` suggests (`path::symbol`, full node id) end
+    the route at that method, not at its file or containing class."""
+    gp = _twin_method_graph(tmp_path)
+    out = _run(monkeypatch, gp, "run()", target, capsys)
+    assert "Shortest path (2 hops):" in out
+    assert "run() --calls [EXTRACTED]--> BetaClient --method [EXTRACTED]--> .nonce()" in out
+
+
+def test_shortest_path_tool_refuses_ambiguous_endpoint(tmp_path):
+    """The MCP `shortest_path` tool shares the resolution and refuses the same way."""
+    from graphify.serve import _shortest_path_text
+    raw = json.loads(_twin_method_graph(tmp_path).read_text())
+    G = json_graph.node_link_graph({**raw, "directed": True}, edges="links")
+    out = _shortest_path_text(G, {"source": "run()", "target": ".nonce()"})
+    assert out.startswith("Ambiguous: '.nonce()' matches 2 nodes in different files.")
+    out = _shortest_path_text(G, {"source": ".nonce()", "target": "run()"})
+    assert out.startswith("Ambiguous: '.nonce()' matches 2 nodes in different files.")
+    out = _shortest_path_text(G, {"source": "run()", "target": "src/b.ts::.nonce()"})
+    assert "Shortest path (2 hops):" in out
+    assert "BetaClient --method [EXTRACTED]-->
```

---

### Incident Patch 5: `aa448fbb` (2026-10-03)
**Commit Message**: fix(extract): end a Svelte script block's trailing comment and report read errors

Review follow-ups on #3928:

- A `//` comment closing one `<script>` block swallowed a second block on
  the same line, since masking leaves them on one line. Terminate each
  block with U+2028 then `;`: the line terminator ends the comment and
  the `;` ends a statement that had none. Line numbers and byte offsets
  are unchanged.
- An unreadable file returns the `error` key again instead of an empty
  result, matching the behavior before the masking change.

(cherry picked from commit 5de47e3df316c0662115ef9890ea5621bbdd2063)

**File**: `graphify/extract.py` (modified, +9/-6)
```diff
@@ -2408,10 +2408,13 @@ def _svelte_mask_non_script(src: str) -> tuple[str, str | None]:
             continue
         start, end = m.start(2), m.end(2)
         chars[start:end] = src[start:end]
-        # Terminate the region in place of the following `<`, so two scripts on
-        # one line don't run together into a single statement.
-        if end < len(chars) and chars[end] == " ":
-            chars[end] = ";"
+        # Terminate the region in place of the closing `</script`, so two scripts
+        # on one line don't run together. U+2028 is a JS line terminator, so it
+        # ends a trailing `//` comment that would otherwise swallow the next
+        # block; the `;` after it then ends the statement (inside the comment it
+        # would be inert). U+2028 is not a newline, so line numbers hold, and its
+        # 3 UTF-8 bytes replace 3 ASCII ones, so byte offsets do too.
+        chars[end:end + 4] = ["\u2028", ";", "", ""]
         if lang is None:
             lang_m = _SCRIPT_LANG_RE.search(m.group(1))
             if lang_m:
@@ -2442,8 +2445,8 @@ def extract_svelte(path: Path) -> dict:
     """
     try:
         src = path.read_text(encoding="utf-8", errors="replace")
-    except OSError:
-        return {"nodes": [], "edges": []}
+    except OSError as e:
+        return {"nodes": [], "edges": [], "error": str(e)}
 
     masked, lang = _svelte_mask_non_script(src)
     config = _JS_CONFIG if lang in ("js", "jsx") else _TS_CONFIG
```

**File**: `tests/test_svelte_extraction.py` (modified, +32/-0)
```diff
@@ -164,6 +164,38 @@ def test_extract_svelte_scripts_on_one_line_do_not_merge(tmp_path):
     assert "b()" in _labels(result)
 
 
+def test_extract_svelte_line_comment_does_not_swallow_next_script(tmp_path):
+    """A `//` comment ending one block must not hide a block on the same line."""
+    component = _write(
+        tmp_path / "src/Commented.svelte",
+        "<script module>// shared</script><script>function b() {}</script>\n"
+        "<script>function c() {}</script>\n",
+    )
+    result = extract_svelte(component)
+    assert result.get("parse_errors") is None
+    labels = _labels(result)
+    assert labels.get("b()") == "L1"
+    assert labels.get("c()") == "L2"
+
+
+def test_extract_svelte_comment_after_unterminated_statement(tmp_path):
+    """A statement with no `;` before the `//` comment still ends at the block."""
+    component = _write(
+        tmp_path / "src/Unterminated.svelte",
+        "<script module>const a = 1 // shared</script><script>function b() {}</script>\n",
+    )
+    result = extract_svelte(component)
+    assert result.get("parse_errors") is None
+    assert _labels(result).get("b()") == "L1"
+
+
+def test_extract_svelte_unreadable_file_reports_error(tmp_path):
+    """A file that cannot be read is reported, not returned as an empty result."""
+    result = extract_svelte(tmp_path / "missing" / "Gone.svelte")
+    assert result["nodes"] == [] and result["edges"] == []
+    assert "error" in result
+
+
 def test_extract_svelte_markup_only_component_does_not_crash(tmp_path):
     """A `.svelte` file need not have a `<script>` block at all."""
     component = _write(tmp_path / "src/Plain.svelte", "<h1>no script here</h1>\n")
```

---

### Incident Patch 6: `f9b42e8d` (2026-10-02)
**Commit Message**: fix(extract): parse only Svelte script blocks in the AST pass

extract_svelte fed the whole .svelte file to the JS grammar. The template
is not JS, so every component reported a syntax error at line 1 and no
symbol declared inside <script> was ever reached — only imports survived,
via the regex rescue pass.

Blank everything outside the <script> bodies (keeping newlines so
locations still match) and parse with the grammar the first block's lang
implies: js/jsx -> JS, ts or unset -> TS, a superset of JS and Svelte's
own default. <script module> and <script context="module"> are parsed
alongside the instance block. Scripts with a non-JS type
(application/ld+json, ...) are blanked too, and a script region is
terminated in place of the following `<` so two blocks on one line do not
run together. The existing regex import rescue is unchanged; an import
both passes resolve yields one edge after build.dedupe_edges, as on the
Astro path.

The masker mirrors _astro_mask_non_script and shares the script-tag and
non-JS-type patterns with it instead of duplicating them.

Fixes #3928. Covers the Svelte half of #3942 (markup is blanked, so a
template {#if} no longer mints a spurious if() node).


**File**: `graphify/extract.py` (modified, +77/-20)
```diff
@@ -154,6 +154,7 @@
     _ts_collect_type_refs,
     _ts_heritage_clause_entries,
     _ts_walk_class_members,
+    _VUE_SCRIPT_LANG_RE as _SCRIPT_LANG_RE,
     _vue_mask_non_script,
     _walk_js_tree,
     _walk_python_tree,
@@ -2380,17 +2381,79 @@ def _emit_rescued_import(
     existing_ids.add(node_id)
 
 
-def extract_svelte(path: Path) -> dict:
-    """Extract imports from .svelte files: script-block via JS AST + template regex fallback.
+_HTML_SCRIPT_TAG_RE = re.compile(
+    r"<script\b((?:\"[^\"]*\"|'[^']*'|[^>\"'])*)>([\s\S]*?)</script\s*>",
+    re.IGNORECASE,
+)
+_NON_JS_SCRIPT_TYPE_RE = re.compile(
+    r"""\btype\s*=\s*["']?(?!module\b|text/javascript\b|application/javascript\b)""",
+    re.IGNORECASE,
+)
+
+
+def _svelte_mask_non_script(src: str) -> tuple[str, str | None]:
+    """Blank everything in a ``.svelte`` file except JS ``<script>`` bodies.
 
-    Tree-sitter only sees the <script> block. Svelte template syntax like
-    {#await import('./X.svelte')} lives in the markup layer and is invisible
-    to the JS parser, so a regex pass covers those dynamic imports.
+    Every character outside those bodies becomes a space (``\\r``/``\\n`` are
+    kept), so AST locations match the original file. Scripts with a non-JS
+    ``type`` (``application/ld+json`` and the like) are blanked too: their
+    bodies are not statements and would only add parse errors. Returns
+    ``(masked_source, lang)``; ``lang`` is the first JS block's declared
+    ``lang``. Mirrors :func:`_astro_mask_non_script`.
+    """
+    chars = [c if c in "\r\n" else " " for c in src]
+    lang: str | None = None
+    for m in _HTML_SCRIPT_TAG_RE.finditer(src):
+        if _NON_JS_SCRIPT_TYPE_RE.search(m.group(1)):
+            continue
+        start, end = m.start(2), m.end(2)
+        chars[start:end] = src[start:end]
+        # Terminate the region in place of the following `<`, so two scripts on
+        # one line don't run together into a single statement.
+        if end < len(chars) and chars[end] == " ":
+            chars[end] = ";"
+        if lang is None:
+            lang_m = _SCRIPT_LANG_RE.search(m.group(1))
+            if lang_m:
+                lang = lang_m.group(1).lower()
+    return "".join(chars), lang
+
+
+def extract_svelte(path: Path) -> dict:
+    """Extract imports and symbols from .svelte files: script-block AST + template regex fallback.
+
+    The AST pass parses only the ``<script>`` bodies, blanking the markup and
+    style regions so line numbers still line up — the same masking
+    :func:`extract_vue` and :func:`extract_astro` use. Feeding the whole file to
+    the JS grammar made the template a top-level ERROR at line 1, so every
+    ``.svelte`` file was flagged as a syntax error and no symbol inside
+    ``<script>`` (functions, classes, runes) was ever reached; only imports
+    survived, via the regex rescue below (#3928).
+
+    The grammar follows the first block's declared ``lang`` (``js``/``jsx``→JS,
+    ``ts`` or unset→TS, a superset of JS), matching Svelte's own default. Both
+    ``<script>`` and ``<script module>`` / ``<script context="module">`` blocks
+    are parsed. A ``<script>`` carrying a non-JS ``type`` (``application/ld+json``
+    and the like) is masked out rather than parsed as code.
+
+    Svelte template syntax like {#await import('./X.svelte')} lives in the markup
+    layer and is invisible to the JS parser, so a regex pass covers those
+    dynamic imports.
     """
-    result = _extract_generic(path, _JS_CONFIG)
     try:
-        import re as _re
         src = path.read_text(encoding="utf-8", errors="replace")
+    except OSError:
+        return {"nodes": [], "edges": []}
+
+    masked, lang = _svelte_mask_non_script(src)
+    config = _JS_CONFIG if lang in ("js", "jsx") else _TS_CONFIG
+    masked_bytes = masked.encode("utf-8")
+    if config is _TS_CONFIG:
+        masked_bytes = _normalize_ts_import_types(masked_bytes) or masked_bytes
+
+    result = _extract_generic(path, config, source_override=masked_bytes)
+    try:
+        import re as _re
         existing_ids = {n["id"] for n in result.get("nodes", [])}
         # Source file node ID must match the one _extract_generic creates:
         # _make_id(str(path)) - single arg, no stem prefix. Otherwise the source
@@ -2410,11 +2473,11 @@ def extract_svelte(path: Path) -> dict:
                 result, existing_ids, file_node_id, path, raw,
                 "dynamic_import", aliases, base_url,
             )
-        # Static imports inside <script> blocks. The JS tree-sitter parser fed
-        # the full .svelte file produces a top-level ERROR node (HTML markup
-        # is not valid JS), so import_statement nodes are never reached and
-        # static imports are silently dropped (#713). Regex over each script
-        # body recovers them.
+        # Static imports inside <script> blocks (#713). The masked AST pass now
+        # reaches these import_statement nodes itself, so this is a 
```

**File**: `tests/test_svelte_extraction.py` (added, +173/-0)
```diff
@@ -0,0 +1,173 @@
+"""Tests for `.svelte` extraction (#3928).
+
+A `.svelte` file is markup with one or two `<script>` blocks. Tree-sitter fed
+the whole file produces a top-level ERROR node at line 1 because the template is
+not JS, so the AST pass never reached the `function_declaration` nodes inside
+`<script>` — every component was reported as a syntax error and only its
+imports survived, via the regex rescue pass. :func:`extract_svelte` masks the
+markup and style regions and parses just the script bodies, the same strategy
+:func:`extract_vue` and :func:`extract_astro` use.
+"""
+from __future__ import annotations
+
+from pathlib import Path
+
+from graphify.extract import _make_id, extract_svelte
+
+
+def _write(path: Path, body: str) -> Path:
+    path.parent.mkdir(parents=True, exist_ok=True)
+    path.write_text(body, encoding="utf-8")
+    return path
+
+
+def _labels(result: dict) -> dict[str, str]:
+    """Label -> source_location for every node except the file node."""
+    file_id = result.get("nodes", [{}])[0].get("id")
+    return {
+        str(n.get("label")): str(n.get("source_location"))
+        for n in result.get("nodes", [])
+        if n.get("id") != file_id
+    }
+
+
+def _import_targets(result: dict, *, relation: str | None = None) -> set[str]:
+    return {
+        str(e.get("target") or "")
+        for e in result.get("edges", [])
+        if relation is None or e.get("relation") == relation
+    }
+
+
+def test_extract_svelte_template_is_not_a_parse_error(tmp_path):
+    """The template is not JS; only `<script>` bodies are parsed (#3928).
+
+    Parsing the whole file reported every component as a syntax error at line 1
+    and dropped every symbol declared inside `<script>`.
+    """
+    component = _write(
+        tmp_path / "src/A.svelte",
+        """<script>
+  import { foo } from "./x";
+  let n = 1;
+  function bump() { n++; }
+</script>
+<button onclick={bump}>{n}</button>
+""",
+    )
+    result = extract_svelte(component)
+    assert result.get("parse_errors") is None
+    labels = _labels(result)
+    assert "bump()" in labels
+    # Masking keeps offsets, so locations still point at the original lines.
+    assert labels["bump()"] == "L4"
+
+
+def test_extract_svelte_parses_module_and_instance_scripts(tmp_path):
+    """Svelte 5 `<script module>` and the instance block are both code."""
+    component = _write(
+        tmp_path / "src/Both.svelte",
+        """<script module>
+  export function shared() { return 1; }
+</script>
+<script>
+  function local() { return 2; }
+</script>
+<p>hi</p>
+""",
+    )
+    result = extract_svelte(component)
+    assert result.get("parse_errors") is None
+    labels = _labels(result)
+    assert "shared()" in labels and "local()" in labels
+    assert labels["shared()"] == "L2"
+    assert labels["local()"] == "L5"
+
+
+def test_extract_svelte_lang_ts_parses_type_syntax(tmp_path):
+    """`<script lang="ts">` must be parsed with the TS grammar, not JS."""
+    component = _write(
+        tmp_path / "src/Typed.svelte",
+        """<script lang="ts">
+  interface Props { year: number }
+  let n = $state(1);
+  function bump(): void { n++; }
+</script>
+<button onclick={bump}>{n}</button>
+""",
+    )
+    result = extract_svelte(component)
+    assert result.get("parse_errors") is None
+    labels = _labels(result)
+    assert "Props" in labels
+    assert "bump()" in labels
+
+
+def test_extract_svelte_non_js_script_type_is_not_parsed_as_code(tmp_path):
+    """`<script type="application/ld+json">` is data, not statements."""
+    component = _write(
+        tmp_path / "src/Ld.svelte",
+        """<script type="application/ld+json">{ "@type": "Event", "name": "x" }</script>
+<script>
+  function go() { return 1; }
+</script>
+<p>hi</p>
+""",
+    )
+    result = extract_svelte(component)
+    assert result.get("parse_errors") is None
+    assert "go()" in _labels(result)
+
+
+def test_extract_svelte_static_import_still_resolves(tmp_path):
+    """Masking must not cost the imports the regex rescue already recovered."""
+    component = _write(
+        tmp_path / "src/Imports.svelte",
+        """<script>
+  import { helper } from "./helper";
+</script>
+<p>hi</p>
+""",
+    )
+    helper = _write(tmp_path / "src/helper.ts", "export function helper(){}\n")
+
+    result = extract_svelte(component)
+    assert _make_id(str(helper)) in _import_targets(result, relation="imports_from")
+
+
+def test_extract_svelte_dynamic_import_in_template(tmp_path):
+    """`{#await import('./X.svelte')}` lives in markup, so the regex pass owns it."""
+    component = _write(
+        tmp_path / "src/Lazy.svelte",
+        """<script>
+  let show = true;
+</script>
+{#await import('./Other.svelte') then Mod}
+  <Mod.default />
+{/await}
+""",
+    )
+    other = _write(tmp_path / "src/Other.svelte", "<p>o</p>\n")
+
+    result = extract_svelte(component)
+    assert _make_id(str(other)) in _import_targets(result, relation="dynamic_import
```

---

### Incident Patch 7: `8629f02f` (2026-10-01)
**Commit Message**: fix(php): stop language constructs binding to same-named methods (#3830)

empty(), isset(), eval() and die() parse as an ordinary
function_call_expression, so the call pass resolved them by bare name.
A reserved word has been a legal method name since PHP 7, so a class
that declares empty() collected every empty($x) in the corpus:
EXTRACTED from its sibling methods, INFERRED from every other file
through the case-insensitive fold.

Drop the callee for these constructs in the PHP branch, before the
in-file lookup and before raw_calls, the same way _GO_PREDECLARED_FUNCS
handles Go builtins. $bag->empty() is a member call and still resolves.

(cherry picked from commit 94574eb2398ce2a50fb1b6735947de6855a4cb3b)

**File**: `graphify/extractors/engine.py` (modified, +22/-0)
```diff
@@ -3886,6 +3886,23 @@ def _lua_is_require_call(node, source: bytes) -> bool:
 
 _PHP_ROUTING_VERBS = frozenset({"get", "post", "put", "patch", "delete", "options", "any", "match", "map"})
 
+# PHP language constructs that are written like functions. `empty($x)`,
+# `isset($a)`, `eval($s)` and `die($m)` parse as an ordinary
+# function_call_expression, so the bare-name lookup bound them to any method
+# that shares the name: since PHP 7 a reserved word is a legal method name
+# (`public function empty()`), while no function can ever be declared under
+# one. Every `empty($x)` in a corpus became an edge into that method, EXTRACTED
+# in the same file and INFERRED across files through the case-insensitive fold
+# (#3830).
+#
+# Same policy as _GO_PREDECLARED_FUNCS: language-local, bare calls only
+# (`$bag->empty()` is a member call and still resolves), and the manual's whole
+# list of call-shaped keywords rather than the subset the pinned grammar emits
+# as calls today (`unset`, `exit`, `list` and `array` get their own node types).
+_PHP_LANGUAGE_CONSTRUCTS = frozenset({
+    "array", "die", "empty", "eval", "exit", "isset", "list", "unset",
+})
+
 def _php_get_route_name(closure_node, src: bytes) -> str | None:
     """Walk up the AST to extract grouped routing prefixes (#3409)."""
     prefixes = []
@@ -6912,6 +6929,11 @@ def walk_calls(
                     func_node = node.child_by_field_name("function")
                     if func_node:
                         callee_name = _read_text(func_node, source)
+                        # PHP names are case-insensitive, so `EMPTY($x)` is the
+                        # same construct. Dropping the name here skips the
+                        # in-file bind and keeps it out of raw_calls.
+                        if callee_name.lower() in _PHP_LANGUAGE_CONSTRUCTS:
+                            callee_name = None
                 elif node.type == "scoped_call_expression":
                     # Static method call: Helper::format() → callee = "Helper"
                     scope_node = node.child_by_field_name("scope")
```

**File**: `tests/test_php_language_construct_calls.py` (added, +258/-0)
```diff
@@ -0,0 +1,258 @@
+"""PHP language constructs must not bind to same-named user methods (#3830).
+
+`empty($x)`, `isset($a)`, `eval($s)` and `die($m)` are keywords, but
+tree-sitter-php parses them as an ordinary `function_call_expression`, and the
+call pass resolves that callee by bare name. A reserved word is a legal method
+name since PHP 7, so a class declaring `public function empty()` absorbed every
+`empty(...)` in the corpus: an EXTRACTED edge from a sibling method in the same
+file, and an INFERRED one from every other file through the case-insensitive
+fold. On the Symfony corpus in #3830 one `ParseCollectionPaginator::empty()`
+collected ~200 of these from ~150 files.
+
+The filter (`_PHP_LANGUAGE_CONSTRUCTS`) is PHP-local and bare-call-only, the
+same shape as `_GO_PREDECLARED_FUNCS`. The boundary tests at the bottom are the
+reason: `$bag->empty()` is a genuine member call into that method and must still
+resolve, and the construct's arguments must still be walked for calls.
+"""
+from graphify.extract import extract
+
+
+def _nodes_by_file(result, suffix):
+    return [n for n in result["nodes"] if str(n.get("source_file", "")).endswith(suffix)]
+
+
+def _label(node):
+    return (node.get("label") or "").strip(".()")
+
+
+def _ids(result, suffix, name):
+    return {n["id"] for n in _nodes_by_file(result, suffix) if _label(n) == name}
+
+
+def _edges_between(result, source_ids, target_ids):
+    return [
+        e for e in result["edges"]
+        if e.get("source") in source_ids and e.get("target") in target_ids
+    ]
+
+
+def _extract_php(tmp_path):
+    return extract(sorted(tmp_path.glob("*.php")), cache_root=tmp_path, parallel=False)
+
+
+_BAG = (
+    "<?php\n"
+    "namespace App;\n"
+    "\n"
+    "class Bag\n"
+    "{\n"
+    "    private array $items = [];\n"
+    "\n"
+    "    public function empty(): bool\n"
+    "    {\n"
+    "        return $this->items === [];\n"
+    "    }\n"
+    "\n"
+    "    public function isset(string $k): bool\n"
+    "    {\n"
+    "        return array_key_exists($k, $this->items);\n"
+    "    }\n"
+    "}\n"
+)
+
+
+def test_construct_in_another_file_does_not_bind_to_user_method(tmp_path):
+    """The cross-file case: `empty($to)` in Mailer.php is not Bag::empty()."""
+    (tmp_path / "Bag.php").write_text(_BAG)
+    (tmp_path / "Mailer.php").write_text(
+        "<?php\n"
+        "namespace App;\n"
+        "\n"
+        "class Mailer\n"
+        "{\n"
+        "    public function send(array $to): void\n"
+        "    {\n"
+        "        if (empty($to) || !isset($to[0])) {\n"
+        "            return;\n"
+        "        }\n"
+        "    }\n"
+        "}\n"
+    )
+    result = _extract_php(tmp_path)
+    method_ids = _ids(result, "Bag.php", "empty") | _ids(result, "Bag.php", "isset")
+    send_ids = _ids(result, "Mailer.php", "send")
+    assert method_ids and send_ids, "the methods and the caller must still be extracted"
+
+    phantom = _edges_between(result, send_ids, method_ids)
+    assert phantom == [], f"a construct in Mailer.php bound to a Bag method: {phantom}"
+
+
+def test_user_method_node_survives_the_filter(tmp_path):
+    """Filtering call targets must not delete the same-named method itself."""
+    (tmp_path / "Bag.php").write_text(_BAG)
+    result = _extract_php(tmp_path)
+    labels = {_label(n) for n in _nodes_by_file(result, "Bag.php")}
+    assert {"empty", "isset"} <= labels, f"a Bag method disappeared; labels were {sorted(labels)}"
+
+
+def test_construct_does_not_bind_in_file(tmp_path):
+    """The same-file case, which was minted EXTRACTED.
+
+    The call pass resolves a bare callee against the file's own label index
+    before anything reaches raw_calls, so gating only the cross-file pass would
+    leave this edge behind.
+    """
+    (tmp_path / "Bag.php").write_text(
+        "<?php\n"
+        "namespace App;\n"
+        "\n"
+        "class Bag\n"
+        "{\n"
+        "    private array $items = [];\n"
+        "\n"
+        "    public function empty(): bool\n"
+        "    {\n"
+        "        return $this->items === [];\n"
+        "    }\n"
+        "\n"
+        "    public function isset(string $k): bool\n"
+        "    {\n"
+        "        return array_key_exists($k, $this->items);\n"
+        "    }\n"
+        "\n"
+        "    public function add(string $k, $v): void\n"
+        "    {\n"
+        "        if (empty($k) || isset($this->items[$k])) {\n"
+        "            return;\n"
+        "        }\n"
+        "        $this->items[$k] = $v;\n"
+        "    }\n"
+        "}\n"
+    )
+    result = _extract_php(tmp_path)
+    method_ids = _ids(result, "Bag.php", "empty") | _ids(result, "Bag.php", "isset")
+    add_ids = _ids(result, "Bag.php", "add")
+    assert method_ids and add_ids, "both methods and the caller must still be extracted"
+
+    phantom = _edges_between(result, add_ids, method_ids)
+    assert phantom == [], f"a construct in add() bound to a sibling met
```

---

### Incident Patch 8: `762cfd33` (2026-09-29)
**Commit Message**: fix(hooks): refuse a core.hooksPath that leaves the repository

hook install followed git's hooks path even when core.hooksPath resolved
outside the checkout, then created that directory and wrote post-commit
there. The bytes are Graphify's own hook, not repository-chosen code, but
the write still escapes the repo. Keep in-repo paths such as .husky, and
git's own hooks directory (including a linked worktree's shared .git/hooks).
Anything else falls back to that default.

Fixes #3869

Co-Authored-By: Grok 4.7 <[REDACTED_EMAIL]>
(cherry picked from commit ee35087aea428b12415aef2c5112078936d925c7)

**File**: `graphify/hooks.py` (modified, +73/-2)
```diff
@@ -576,6 +576,66 @@ def _reject_windows_path(value: str, source: str) -> None:
         )
 
 
+def _is_within(child: Path, parent: Path) -> bool:
+    """True if `child` is `parent` or a path underneath it."""
+    try:
+        child.resolve().relative_to(parent.resolve())
+    except (ValueError, OSError):
+        return False
+    return True
+
+
+def _rev_parse_path(root: Path, flag: str) -> Path | None:
+    """Resolve one ``git rev-parse`` path flag against ``root``.
+
+    ``-c core.hooksPath=`` is not used: an empty value makes ``--git-path hooks``
+    print ``./`` instead of the real hooks directory.
+    """
+    import subprocess as _sp
+    try:
+        res = _sp.run(
+            ["git", "-C", str(root), "rev-parse", flag],
+            capture_output=True, text=True,
+        )
+    except (OSError, FileNotFoundError):
+        return None
+    if res.returncode != 0:
+        return None
+    raw = res.stdout.strip()
+    if not raw or any(c in raw for c in ("\n", "\r", "\x00")):
+        return None
+    path = Path(raw)
+    if not path.is_absolute():
+        path = root / path
+    return path.resolve()
+
+
+def _builtin_hooks_dir(root: Path) -> Path | None:
+    """Git's own hooks directory, ignoring core.hooksPath.
+
+    ``--git-path hooks`` follows core.hooksPath, so the default is derived from
+    the common git dir. A linked worktree's hooks live in the main repo's
+    ``.git/hooks``, which is outside the worktree root.
+    """
+    for flag in ("--git-common-dir", "--git-dir"):
+        git_dir = _rev_parse_path(root, flag)
+        if git_dir is not None:
+            return (git_dir / "hooks").resolve()
+    return None
+
+
+def _hooks_path_allowed(root: Path, candidate: Path) -> bool:
+    """Allow in-repo hook dirs (Husky) and git's own hooks dir only.
+
+    A core.hooksPath that resolves anywhere else is repository-controlled
+    local config. Honoring it makes `hook install` write outside the repo (#3869).
+    """
+    if _is_within(candidate, root):
+        return True
+    builtin = _builtin_hooks_dir(root)
+    return builtin is not None and candidate.resolve() == builtin.resolve()
+
+
 def _hooks_dir(root: Path) -> Path:
     """Return the git hooks directory, respecting core.hooksPath if set (e.g. Husky).
 
@@ -616,8 +676,19 @@ def _hooks_dir(root: Path) -> Path:
             if raw and not any(c in raw for c in ("\n", "\r", "\x00")):
                 _reject_windows_path(raw, "git rev-parse --git-path hooks")
                 d = (root / raw).resolve()
-                d.mkdir(parents=True, exist_ok=True)
-                return d
+                if _hooks_path_allowed(root, d):
+                    d.mkdir(parents=True, exist_ok=True)
+                    return d
+                print(
+                    f"[graphify hooks] refusing hooks path {d}: it is outside "
+                    f"{root.resolve()}. Installing into the default git hooks "
+                    f"directory instead (#3869).",
+                    file=sys.stderr,
+                )
+                default = _builtin_hooks_dir(root)
+                if default is not None:
+                    default.mkdir(parents=True, exist_ok=True)
+                    return default
     except (OSError, FileNotFoundError):
         pass
     d = root / ".git" / "hooks"
```

**File**: `tests/test_hooks.py` (modified, +64/-0)
```diff
@@ -589,6 +589,70 @@ def test_posix_custom_hookspath_still_works(tmp_path):
     assert (repo / ".husky" / "post-commit").exists()
 
 
+def test_hookspath_outside_repo_falls_back_to_default(tmp_path, capsys):
+    """#3869: an absolute core.hooksPath outside the repo must not be created.
+
+    The setting lives in local git config (a zip of .git can carry it; a clone
+    does not). hook install used to mkdir that path and write post-commit there.
+    """
+    repo = _make_git_repo(tmp_path / "repo")
+    outside = tmp_path / "outside"
+    _set_hookspath(repo, str(outside))
+    msg = install(repo)
+    err = capsys.readouterr().err
+    assert "refusing hooks path" in err
+    assert not outside.exists()
+    assert (repo / ".git" / "hooks" / "post-commit").exists()
+    assert (repo / ".git" / "hooks" / "post-checkout").exists()
+    assert ".git" in msg and "hooks" in msg
+
+
+def test_hookspath_relative_escape_falls_back_to_default(tmp_path, capsys):
+    """#3869: a relative core.hooksPath that resolves outside the repo is refused."""
+    repo = _make_git_repo(tmp_path / "repo")
+    _set_hookspath(repo, "../escaped")
+    _hooks_dir(repo)
+    err = capsys.readouterr().err
+    assert "refusing hooks path" in err
+    assert not (tmp_path / "escaped").exists()
+    assert _hooks_dir(repo) == (repo / ".git" / "hooks").resolve()
+
+
+def test_linked_worktree_keeps_its_default_hooks_dir(tmp_path):
+    """A linked worktree's hooks live under the common git dir, outside the
+    worktree root. That default must still be used when core.hooksPath is unset."""
+    main = tmp_path / "main"
+    main.mkdir()
+    subprocess.run(["git", "init", str(main)], check=True, capture_output=True)
+    subprocess.run(["git", "-C", str(main), "config", "user.email", "t@example.com"],
+                   check=True, capture_output=True)
+    subprocess.run(["git", "-C", str(main), "config", "user.name", "t"],
+                   check=True, capture_output=True)
+    (main / "f").write_text("x\n", encoding="utf-8")
+    subprocess.run(["git", "-C", str(main), "add", "f"], check=True, capture_output=True)
+    subprocess.run(["git", "-C", str(main), "commit", "-m", "x"],
+                   check=True, capture_output=True)
+    wt = tmp_path / "wt"
+    subprocess.run(["git", "-C", str(main), "worktree", "add", "-q", str(wt), "-b", "wt"],
+                   check=True, capture_output=True)
+    expected = subprocess.run(
+        ["git", "-C", str(wt), "rev-parse", "--git-path", "hooks"],
+        check=True, capture_output=True, text=True,
+    ).stdout.strip()
+    got = _hooks_dir(wt)
+    assert got == (wt / expected).resolve()
+    assert _is_within_repo_git(got, main)
+    assert not (wt / ".git" / "hooks").exists()
+
+
+def _is_within_repo_git(hooks: Path, main: Path) -> bool:
+    try:
+        hooks.resolve().relative_to((main / ".git").resolve())
+    except ValueError:
+        return False
+    return True
+
+
 def test_default_hooks_dir_unaffected(tmp_path):
     """No core.hooksPath -> normal .git/hooks install, no rejection."""
     repo = _make_git_repo(tmp_path)
```

---

### Incident Patch 9: `bb20ef72` (2026-10-01)
**Commit Message**: fix(analyze): diversify suggested questions across signal types

Round-robin the existing question categories before truncating the result. Preserve within-category order, existing small-limit priority, candidate schema, and no-signal behavior. Fixes #3849.

Co-Authored-By: OpenAI Codex <[REDACTED_EMAIL]>
(cherry picked from commit 560b88d86fe82acb11b47698778cca44c1778c0d)

**File**: `ARCHITECTURE.md` (modified, +6/-0)
```diff
@@ -93,6 +93,12 @@ See `SECURITY.md` for the full threat model.
 
 ## Testing
 
+`analyze.suggest_questions()` interleaves candidates across question types before
+applying its result limit (seven by default). This keeps ambiguous relationships
+from hiding bridge, inferred-relationship, isolation, and low-cohesion signals.
+The existing candidate order within each type is preserved; if the limit is smaller
+than the number of available types, their generation order determines priority.
+
 One test file per module under `tests/`. Run with:
 
 ```bash
```

**File**: `graphify/analyze.py` (modified, +13/-1)
```diff
@@ -468,6 +468,9 @@ def suggest_questions(
     Generate questions the graph is uniquely positioned to answer.
     Based on: AMBIGUOUS edges, bridge nodes, underexplored god nodes, isolated nodes.
     Each question has a 'type', 'question', and 'why' field.
+    Interleave question types before applying top_n so an abundant early type
+    cannot crowd out later signals. Preserve the existing order within each type
+    and category generation order when the limit is smaller than the type count.
     """
     if community_labels:
         community_labels = {int(k) if isinstance(k, str) else k: v for k, v in community_labels.items()}
@@ -583,7 +586,16 @@ def suggest_questions(
             ),
         }]
 
-    return questions[:top_n]
+    from itertools import zip_longest
+
+    by_type: dict[str, list[dict]] = {}
+    for question in questions:
+        by_type.setdefault(question["type"], []).append(question)
+    diversified = [
+        question for row in zip_longest(*by_type.values())
+        for question in row if question is not None
+    ]
+    return diversified[:top_n]
 
 
 def graph_diff(G_old: nx.Graph, G_new: nx.Graph) -> dict:
```

**File**: `tests/test_analyze.py` (modified, +54/-0)
```diff
@@ -603,6 +603,60 @@ def test_god_nodes_filter_is_case_insensitive():
         assert variant not in labels, f"`{variant}` should be filtered as JSON-key noise"
 
 
+def _question_diversity_graph():
+    G = nx.Graph()
+    ambiguous = [f"uncertain_{i}" for i in range(10)]
+    inferred = ["inferred_a", "inferred_b"]
+    disconnected = [f"disconnected_{i}" for i in range(5)]
+    for node in ["hub", *ambiguous, *inferred, *disconnected]:
+        G.add_node(node, label=node, source_file="src/example.py", file_type="code")
+    for node in ambiguous:
+        G.add_edge("hub", node, confidence="AMBIGUOUS", relation="uses")
+    for node in inferred:
+        G.add_edge("hub", node, confidence="INFERRED", relation="uses")
+    communities = {0: ["hub"], 1: ambiguous + inferred, 2: disconnected}
+    return G, communities
+
+
+def test_suggest_questions_does_not_starve_later_categories():
+    """#3849: ten ambiguous edges must not hide all other question types."""
+    G, communities = _question_diversity_graph()
+    questions = suggest_questions(G, communities, {})
+    assert len(questions) == 7
+    assert [q["type"] for q in questions[:5]] == [
+        "ambiguous_edge", "bridge_node", "verify_inferred", "isolated_nodes", "low_cohesion",
+    ]
+    assert questions == suggest_questions(G, communities, {})
+
+
+@pytest.mark.parametrize("top_n", [1, 3, 7, 100])
+def test_suggest_questions_diversity_preserves_limit_and_candidates(top_n):
+    G, communities = _question_diversity_graph()
+    all_questions = suggest_questions(G, communities, {}, top_n=100)
+    limited = suggest_questions(G, communities, {}, top_n=top_n)
+    assert limited == all_questions[:top_n]
+    assert sum(q["type"] == "ambiguous_edge" for q in all_questions) == 10
+    assert all(set(q) == {"type", "question", "why"} for q in all_questions)
+
+
+def test_suggest_questions_single_category_uses_available_slots():
+    G = nx.complete_graph(5)
+    for node in G:
+        G.nodes[node].update(label=str(node), source_file="example.py", file_type="code")
+    for u, v in G.edges:
+        G.edges[u, v].update(confidence="AMBIGUOUS", relation="uses")
+    questions = suggest_questions(G, {0: list(G)}, {})
+    assert len(questions) == 7
+    assert all(q["type"] == "ambiguous_edge" for q in questions)
+
+
+def test_suggest_questions_empty_graph_keeps_no_signal():
+    questions = suggest_questions(nx.Graph(), {}, {})
+    assert len(questions) == 1
+    assert questions[0]["type"] == "no_signal"
+    assert questions[0]["question"] is None
+
+
 def test_suggest_questions_excludes_rationale_nodes_from_isolated_count():
     G = nx.Graph()
     G.add_node("service", label="Service", file_type="code", source_file="service.py")
```

---

### Incident Patch 10: `b8fcd29c` (2026-10-04)
**Commit Message**: fix: snap cross-repo resolver confidence scores to the INFERRED rubric (#4045)

Snap the off-rubric INFERRED confidence scores emitted by the cross-repo
call/type resolvers and interface dispatch (0.8 and 0.9) to the nearest
canonical rubric tier (0.85), so every INFERRED edge carries one of the
documented discrete scores. Label-only change: no edge flips
EXTRACTED<->INFERRED and no edge is produced or dropped. Replaces the
substring-matching guard test with an AST-based one that scans every
module for off-rubric scores.

Squashed from #4045 (authorship preserved).

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `graphify/cross_repo_calls.py` (modified, +1/-1)
```diff
@@ -235,7 +235,7 @@ def link_cross_repo_member_calls(merged: "nx.Graph") -> int:
                 relation="calls",
                 context="cross_repo",
                 confidence="INFERRED",
-                confidence_score=0.8,
+                confidence_score=0.85,
                 source_file=str(caller_data.get("source_file") or ""),
                 source_location=entry.get("line"),
                 weight=1.0,
```

**File**: `graphify/cross_repo_types.py` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ def link_shared_type_declarations(merged: "nx.Graph") -> int:
                     relation=SHARED_TYPE_RELATION,
                     context="cross_repo",
                     confidence="INFERRED",
-                    confidence_score=0.9,
+                    confidence_score=0.85,
                     source_file=str(merged.nodes[left].get("source_file") or ""),
                     weight=1.0,
                     _src=left,
```

**File**: `graphify/extract.py` (modified, +6/-6)
```diff
@@ -3945,7 +3945,7 @@ def _key(label: str) -> str:
             "relation": relation,
             "context": "call",
             "confidence": "EXTRACTED" if type_qualified else "INFERRED",
-            "confidence_score": 1.0 if type_qualified else 0.8,
+            "confidence_score": 1.0 if type_qualified else 0.85,
             "source_file": rc.get("source_file", ""),
             "source_location": rc.get("source_location"),
             "weight": 1.0,
@@ -4237,7 +4237,7 @@ def _key(label: str) -> str:
             "relation": "calls",
             "context": "call",
             "confidence": "EXTRACTED" if type_qualified else "INFERRED",
-            "confidence_score": 1.0 if type_qualified else 0.8,
+            "confidence_score": 1.0 if type_qualified else 0.85,
             "source_file": rc.get("source_file", ""),
             "source_location": rc.get("source_location"),
             "weight": 1.0,
@@ -4403,7 +4403,7 @@ def _key(label: str) -> str:
             "relation": relation,
             "context": "call",
             "confidence": "EXTRACTED" if type_qualified else "INFERRED",
-            "confidence_score": 1.0 if type_qualified else 0.8,
+            "confidence_score": 1.0 if type_qualified else 0.85,
             "source_file": src_file,
             "source_location": rc.get("source_location"),
             "weight": 1.0,
@@ -4625,7 +4625,7 @@ def _park_if_absent(type_name: str | None, caller_node: dict | None, rc: dict) -
             "relation": "calls",
             "context": "call",
             "confidence": "EXTRACTED" if type_qualified else "INFERRED",
-            "confidence_score": 1.0 if type_qualified else 0.8,
+            "confidence_score": 1.0 if type_qualified else 0.85,
             "source_file": src_file,
             "source_location": rc.get("source_location"),
             "weight": 1.0,
@@ -4835,7 +4835,7 @@ def _method_on_type_or_bases(type_nid: str, callee_key: str) -> str | None:
                 "relation": "calls",
                 "context": "call",
                 "confidence": "EXTRACTED" if exact else "INFERRED",
-                "confidence_score": 1.0 if exact else 0.8,
+                "confidence_score": 1.0 if exact else 0.85,
                 "source_file": raw_call.get("source_file", ""),
                 "source_location": raw_call.get("source_location"),
                 "weight": 1.0,
@@ -5026,7 +5026,7 @@ def _field_type_up_chain(cls, receiver):
             "relation": relation,
             "context": "call",
             "confidence": "EXTRACTED" if type_qualified else "INFERRED",
-            "confidence_score": 1.0 if type_qualified else 0.8,
+            "confidence_score": 1.0 if type_qualified else 0.85,
             "source_file": src_file,
             "source_location": rc.get("source_location"),
             "weight": 1.0,
```

**File**: `graphify/interface_dispatch.py` (modified, +1/-1)
```diff
@@ -150,7 +150,7 @@ def resolve_interface_dispatch(
                 "relation": DISPATCH_RELATION,
                 "context": "call",
                 "confidence": "INFERRED",
-                "confidence_score": 0.9,
+                "confidence_score": 0.85,
                 "source_file": str(impl_node.get("source_file", "")),
                 "source_location": impl_node.get("source_location"),
                 "weight": 1.0,
```

**File**: `tests/test_cross_repo_member_calls.py` (modified, +1/-0)
```diff
@@ -98,6 +98,7 @@ def test_a_parked_call_binds_to_the_one_declaration_in_another_repo():
     data = G.edges["a::app_run", "b::greeter_greet"]
     assert data["relation"] == "calls"
     assert data["confidence"] == "INFERRED"
+    assert data["confidence_score"] == 0.85
     assert data["context"] == "cross_repo"
     assert data["source_location"] == "L10"
 
```

**File**: `tests/test_cross_repo_shared_types.py` (modified, +1/-0)
```diff
@@ -67,6 +67,7 @@ def test_same_namespace_and_name_across_repos_are_linked(tmp_path):
     endpoints = {links[0]["source"], links[0]["target"]}
     assert endpoints == {"svc_a::evt", "svc_b::evt"}
     assert links[0]["confidence"] == "INFERRED"
+    assert links[0]["confidence_score"] == 0.85
 
 
 def test_same_name_in_different_namespaces_is_not_linked(tmp_path):
```

**File**: `tests/test_csharp_interface_dispatch.py` (modified, +4/-0)
```diff
@@ -76,6 +76,10 @@ def _reachable(r, start: str) -> set[str]:
 def test_single_implementer_links_the_interface_method(tmp_path):
     dispatch, r = _extract(tmp_path, _INJECTED)
     assert (_find(r, ".Build()", "ireport"), _find(r, ".Build()", "report_report")) in dispatch
+    for edge in r["edges"]:
+        if edge["relation"] == "dispatches_to":
+            assert edge["confidence"] == "INFERRED"
+            assert edge["confidence_score"] == 0.85
 
 
 def test_chain_through_an_injected_dependency_becomes_reachable(tmp_path):
```

**File**: `tests/test_inferred_confidence_rubric.py` (modified, +72/-12)
```diff
@@ -18,6 +18,7 @@
 what the extractor knows; snapping the scores onto the documented scale fixes
 the stated violation without making that call.
 """
+import ast
 from pathlib import Path
 
 import pytest
@@ -63,19 +64,78 @@ def test_extracted_and_ambiguous_defaults_are_unchanged():
 # No emission site ships an off-rubric literal
 # ---------------------------------------------------------------------------
 
-@pytest.mark.parametrize("rel_path", [
-    "extract.py",
-    "symbol_resolution.py",
-    "extractors/engine.py",
-    "extractors/resolution.py",
+def _literal_scores(expr):
+    """Read only emitted literals, including both branches of a ternary.
+
+    Calls and lookups are consumers of scores, not literal emission sites.
+    Parsing Python also avoids matching examples in strings or comments.
+    """
+    if isinstance(expr, ast.Constant) and type(expr.value) in (int, float):
+        yield expr.value
+    elif isinstance(expr, ast.IfExp):
+        yield from _literal_scores(expr.body)
+        yield from _literal_scores(expr.orelse)
+
+
+def _emitted_score_exprs(tree):
+    for node in ast.walk(tree):
+        if isinstance(node, ast.Dict):
+            for key, value in zip(node.keys, node.values):
+                if isinstance(key, ast.Constant) and key.value == "confidence_score":
+                    yield value
+        elif isinstance(node, ast.keyword) and node.arg == "confidence_score":
+            yield node.value
+        elif isinstance(node, ast.Assign) and any(
+            isinstance(target, ast.Name) and target.id == "confidence_score"
+            for target in node.targets
+        ):
+            yield node.value
+        elif isinstance(node, ast.AnnAssign) and (
+            isinstance(node.target, ast.Name) and node.target.id == "confidence_score"
+        ) and node.value is not None:
+            yield node.value
+
+
+def test_no_module_hardcodes_an_off_rubric_score():
+    """Cover every Python module and spelling, not a fixed list of resolvers.
+
+    EXTRACTED/1.0 and AMBIGUOUS/0.2 are valid too. Keep the separate
+    runtime checks below to verify that INFERRED edges use the INFERRED set.
+    """
+    allowed = RUBRIC | {1.0, 0.2}
+    violations = []
+    for path in sorted(SRC.rglob("*.py")):
+        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
+        for expr in _emitted_score_exprs(tree):
+            for score in _literal_scores(expr):
+                if score not in allowed:
+                    violations.append(f"{path.relative_to(SRC)}:{expr.lineno}: {score}")
+    assert not violations, "Off-rubric emitted scores:\n" + "\n".join(violations)
+
+
+@pytest.mark.parametrize("source", [
+    '{"confidence_score": 0.8}',
+    'emit(confidence_score=0.8)',
+    'confidence_score = 0.8',
+    'confidence_score: float = 0.8',
+    '{"confidence_score": 1.0 if exact else 0.8}',
 ])
-def test_no_module_hardcodes_an_off_rubric_inferred_score(rel_path):
-    """0.8 was the value in the tree and is not on the scale. Catch it and the
-    forbidden 0.5 as literals, so a future edit cannot reintroduce either."""
-    text = (SRC / rel_path).read_text(encoding="utf-8")
-    for forbidden in ('"confidence_score": 0.8,', '"confidence_score": 0.5,',
-                      "confidence_score = 0.8\n", "confidence_score = 0.5\n"):
-        assert forbidden not in text, f"{rel_path} still emits {forbidden.strip()}"
+def test_emission_guard_recognizes_all_literal_spellings(source):
+    scores = [
+        score
+        for expr in _emitted_score_exprs(ast.parse(source))
+        for score in _literal_scores(expr)
+    ]
+    assert 0.8 in scores
+
+
+def test_emission_guard_ignores_comments_strings_and_score_consumers():
+    tree = ast.parse(
+        '# "confidence_score": 0.8\n'
+        'example = \'{"confidence_score": 0.8}\'\n'
+        'score = edge.get("confidence_score", 0.5)\n'
+    )
+    assert list(_emitted_score_exprs(tree)) == []
 
 
 # ---------------------------------------------------------------------------
```

---

### Incident Patch 11: `7e7de7d0` (2026-10-04)
**Commit Message**: fix(dedup): keep unstamped document nodes apart across files

The exact pass joined equal labels without calling
_crossfile_fileanchored_blocked, so repeated headings collapsed
across source files. The fuzzy pass already had that block.

Fixes #3094

(cherry picked from commit 6a7409c06d05da5a7020a2b87d07b86542bfbb51)

**File**: `graphify/dedup.py` (modified, +39/-32)
```diff
@@ -678,6 +678,30 @@ def _union_with_prot(x: str, y: str) -> None:
         if prot is not None:
             prot_by_root[new_root] = prot
 
+    def _crossfile_union(left: dict, right: dict, *, with_prot: bool) -> None:
+        nonlocal exact_merges
+        if _crossfile_fileanchored_blocked(left, right):
+            return
+        left_id = left["id"]
+        right_id = right["id"]
+        if with_prot:
+            px = _get_prot(left_id)
+            py = _get_prot(right_id)
+            if px is not None and py is not None and px != py:
+                return
+        if uf.find(left_id) == uf.find(right_id):
+            return
+        if with_prot:
+            _union_with_prot(left_id, right_id)
+        else:
+            uf.union(left_id, right_id)
+        exact_merges += 1
+
+    def _crossfile_join(members: list[dict], *, with_prot: bool) -> None:
+        for index, left in enumerate(members):
+            for right in members[index + 1:]:
+                _crossfile_union(left, right, with_prot=with_prot)
+
     for key, group in norm_to_nodes.items():
         if len(group) <= 1:
             continue
@@ -726,20 +750,15 @@ def _union_with_prot(x: str, y: str) -> None:
         # it is provably safe (#2182). `concept` is the one file_type meant to
         # unify across files (#1284) — code is keyed by ID (#1205) and
         # image/paper labels are often shared basenames (logo.png), so both stay
-        # blocked. rationale/document join `concept` here ONLY when the node
-        # reads as an entity inside its file (#296): a file-anchored
-        # *file_type* does not make an individual node file-anchored. An entity
-        # extracted from a note — a person, a project — inherits `document` from
-        # the file's extension, not from anything about itself, so in note-heavy
-        # corpora almost no entity node is typed `concept` and this merge never
-        # got to run on them. A file's own node and its headings still never
-        # merge (#1284, #3094).
+        # blocked. A rationale or document node can still enter this list when
+        # it reads as an entity (#296). Each union calls
+        # `_crossfile_fileanchored_blocked`, so that node does not join a node
+        # from another file (#3094). Concept nodes still join across files.
+        # A file's own node and its headings never enter the list (#1284).
         # Provenance is required (#1178), and the entropy gate mirrors Pass 2 so
         # short generic labels ("API") stay distinct — both untouched here.
-        # Scoped to this exact-normalization pass: Pass 2's fuzzy
-        # `_crossfile_fileanchored_blocked` is unchanged, so #1284's
-        # near-identical boilerplate and heading siblings stay blocked.
-        # Sorting by id keeps the winner order-independent.
+        # Pass 2 still calls the same block, so near-identical boilerplate stays
+        # blocked (#1284). Sorting by id keeps the pair order stable.
         mergeable = sorted(
             (n for n in group
              if (n.get("file_type") == "concept"
@@ -758,30 +777,18 @@ def _union_with_prot(x: str, y: str) -> None:
                     # NEVER collapse them during incremental merge.
                     continue
                 if prot_members:
-                    # Mixed: pick AT MOST ONE protected survivor for incoming nodes to fold into.
-                    # Multiple protected nodes must remain separate independent entities.
+                    # Mixed: fold an incoming node into at most one protected
+                    # survivor. Protected nodes stay separate from each other.
+                    # Incoming nodes the block still allows are joined to each
+                    # other, so a blocked winner does not leave them apart.
                     canonical_winner = _pick_winner(prot_members)
                     for inc in inc_members:
-                        px = _get_prot(canonical_winner["id"])
-                        py = _get_prot(inc["id"])
-                        if px is not None and py is not None and px != py:
-                            continue
-                        if uf.find(canonical_winner["id"]) != uf.find(inc["id"]):
-                            _union_with_prot(canonical_winner["id"], inc["id"])
-                            exact_merges += 1
+                        _crossfile_union(canonical_winner, inc, with_prot=True)
+                    _crossfile_join(inc_members, with_prot=True)
                 else:
-                    # Incoming only: merge normally
-                    winner = _pick_winner(inc_members)
-                    for node in inc_members:
-                        if uf.find(winner["id"]) != uf.find(node["id"]):
-                            _union_with_prot(winner["id"], node["id"])
-                            exact_merges += 1
+                    _crossfile_join(inc_members, with_prot=True)
             else:
-                winner = _pick_winner(merg
```

**File**: `tests/test_dedup.py` (modified, +82/-14)
```diff
@@ -1346,32 +1346,30 @@ def test_reads_as_file_entity_helper():
 
 
 def test_dedup_merges_crossfile_document_entity_variants():
-    """The reported bug (#296): case/prefix variants of one entity, extracted
-    from three different notes and typed `document` by extension, must collapse
-    to a single node."""
+    """Unstamped document nodes that share a label stay one node per file.
+
+    The exact pass calls the same cross-file block as the fuzzy pass (#3094).
+    Three notes no longer collapse to one node.
+    """
     nodes = [
         {"id": "journal_2024_03_0%d_cyrilxbt" % i, "label": variant,
          "file_type": "document", "source_file": "journal/2024-03-0%d.md" % i}
         for i, variant in enumerate(_CYRIL_VARIANTS, start=1)
     ]
     result_nodes, _ = deduplicate_entities(nodes, [], communities={})
-    assert len(result_nodes) == 1, (
-        "cross-file `document` entity variants did not merge -- the #296 gate "
-        "widening is not reaching Pass 1's cross-file residue"
-    )
+    assert len(result_nodes) == 3
 
 
 def test_dedup_merges_crossfile_rationale_entity_variants():
-    """`rationale` rides the same gate as `document` (#296): entity nodes of
-    that type, provably not their files' own nodes, merge on an exact label."""
+    """Unstamped rationale nodes that share a label stay one node per file (#3094)."""
     nodes = [
         {"id": "svc_alpha_py_retention_window", "label": "Retention Window",
          "file_type": "rationale", "source_file": "svc/alpha.py"},
         {"id": "svc_beta_py_retention_window", "label": "retention window",
          "file_type": "rationale", "source_file": "svc/beta.py"},
     ]
     result_nodes, _ = deduplicate_entities(nodes, [], communities={})
-    assert len(result_nodes) == 1
+    assert len(result_nodes) == 2
 
 
 def test_dedup_never_merges_a_files_own_node_away():
@@ -1434,10 +1432,11 @@ def test_dedup_crossfile_entity_merge_keeps_the_provenance_gate():
 
 
 def test_dedup_crossfile_fuzzy_fileanchored_block_is_untouched():
-    """#296 widens only the exact-normalization pass. Pass 2's fuzzy
-    `_crossfile_fileanchored_blocked` is unchanged, so near-identical (not
-    identical) document labels in different files still stay distinct -- the
-    #1284 guard keeps doing its job on entity nodes too."""
+    """Pass 2 still refuses near-identical document labels in different files.
+
+    The exact pass now calls the same block (#3094). This pair is not an exact
+    label match, so only the fuzzy pass can see it, and the block keeps both nodes.
+    """
     nodes = [
         {"id": "docs_a_guide", "label": "Getting Started Installation Guide",
          "file_type": "document", "source_file": "docs/a.md"},
@@ -1448,6 +1447,75 @@ def test_dedup_crossfile_fuzzy_fileanchored_block_is_untouched():
     assert len(result_nodes) == 2
 
 
+def _doc(node_id, label, source_file, file_type="document"):
+    return {
+        "id": node_id,
+        "label": label,
+        "file_type": file_type,
+        "source_file": source_file,
+        "source_location": None,
+    }
+
+
+def test_exact_pass_keeps_unstamped_documents_across_files(tmp_path, capsys):
+    """The 0.9.66 script: five unstamped document nodes, three source files."""
+    from graphify.build import build_merge
+
+    extraction = {"nodes": [
+        _doc("a_decisions", "Decisions", "Sessions/session-A.md"),
+        _doc("b_decisions", "Decisions", "Sessions/session-B.md"),
+        _doc("c_decisions", "Decisions", "Sessions/session-C.md"),
+        _doc("a_open_items", "Open items", "Sessions/session-A.md"),
+        _doc("b_open_items", "Open items", "Sessions/session-B.md"),
+    ], "edges": [], "hyperedges": [], "input_tokens": 0, "output_tokens": 0}
+    graph = build_merge(
+        [extraction],
+        graph_path=tmp_path / "missing.json",
+        dedup=True,
+    )
+    files = {data.get("source_file") for _, data in graph.nodes(data=True)}
+    assert graph.number_of_nodes() == 5
+    assert files == {
+        "Sessions/session-A.md",
+        "Sessions/session-B.md",
+        "Sessions/session-C.md",
+    }
+    assert "Deduplicated" not in capsys.readouterr().out
+
+
+def test_exact_pass_still_merges_same_file_document_duplicate():
+    nodes = [
+        _doc("a1", "Decisions", "Sessions/session-A.md"),
+        _doc("a2", "Decisions", "Sessions/session-A.md"),
+    ]
+    result_nodes, _ = deduplicate_entities(nodes, [], communities={})
+    assert len(result_nodes) == 1
+
+
+def test_exact_pass_still_merges_crossfile_concepts():
+    nodes = [
+        _doc("c1", "Decisions", "Sessions/session-A.md", file_type="concept"),
+        _doc("c2", "Decisions", "Sessions/session-B.md", file_type="concept"),
+    ]
+    result_nodes, _ = deduplicate_entities(nodes, [], communities={})
+    assert len(result_nodes) == 1
+
+
+def test_exact_pass_merges_concepts_beside_a_blocked_document():
+    """A document winner must not leave the two concept nodes
```

---

### Incident Patch 12: `7e8ad53e` (2026-10-04)
**Commit Message**: fix(detect): also skip graphify's single-file installs

The skill-folder rule from the previous commit left the files graphify
writes whole into a project still indexed: the always-on rules, steering
and workflow files (.agents/rules/graphify.md, .agents/workflows/graphify.md,
.cursor/rules/graphify.mdc, .kiro/steering/graphify.md,
.windsurf/rules/graphify.md) and the opencode/kilo hook plugins
(.opencode/plugins/graphify.js, .kilo/plugins/graphify.js). With every
platform installed they still added 12 nodes on top of the user's code.

List them in detect.py as a hidden holder dir plus the exact relative
path, the same paths install.py writes, and never match a bare
graphify.md/graphify.js name. detect(), ignored_predicate() and
collect_files() all check the same helper.

Files graphify only adds a section or entry to (AGENTS.md, CLAUDE.md,
.claude/CLAUDE.md, GEMINI.md, CODEBUDDY.md, .github/copilot-instructions.md
and the merged settings/hooks/plugin JSON configs) are still left alone.

The new test runs every project install in install.py plus the kilo,
codebuddy and vscode installers, so a new platform that writes a new file
fails it.

Refs #4057

Co-Authored-By: Grok Bot <[REDA

**File**: `graphify/detect.py` (modified, +24/-1)
```diff
@@ -975,6 +975,27 @@ def _is_regular_file(path: Path) -> bool:
 # (install.py: pi -> .pi/agent/skills, kilo -> .config/kilo/skills).
 _NESTED_SKILL_HOLDERS = frozenset({(".pi", "agent"), (".config", "kilo")})
 
+# Single files `graphify install` writes whole into a project (#4057): the
+# always-on rules/steering/workflow files and the opencode/kilo hook plugins.
+# Matched on the hidden holder dir plus the exact relative path, never on the
+# bare file name, so e.g. docs/graphify.md or src/plugins/graphify.js stay.
+# Files graphify only adds a section or entry to (AGENTS.md, CLAUDE.md,
+# settings.json, ...) belong to the user and are not listed here.
+_GRAPHIFY_INSTALLED_FILES = frozenset({
+    (".agents", "rules", "graphify.md"),      # antigravity
+    (".agents", "workflows", "graphify.md"),  # antigravity
+    (".cursor", "rules", "graphify.mdc"),     # cursor
+    (".kilo", "plugins", "graphify.js"),      # kilo
+    (".kiro", "steering", "graphify.md"),     # kiro
+    (".opencode", "plugins", "graphify.js"),  # opencode
+    (".windsurf", "rules", "graphify.md"),    # devin
+})
+
+
+def _is_installed_graphify_file(path: "Path") -> bool:
+    """True for a single file `graphify install` wrote into the project (#4057)."""
+    return path.parts[-3:] in _GRAPHIFY_INSTALLED_FILES
+
 # Files a coverage tool writes into its own output dir. Any one of them is proof
 # the directory is generated: lcov (lcov.info), nyc/Istanbul (coverage-final.json,
 # clover.xml, the lcov-report/ subtree), coverage.py (coverage.xml, .coverage),
@@ -1790,7 +1811,7 @@ def _ignored(path: Path) -> bool:
             rel_parts = path.relative_to(root).parts
         except ValueError:
             return False  # outside the scan root: detect() never considered it
-        if path.name in _SKIP_FILES:
+        if path.name in _SKIP_FILES or _is_installed_graphify_file(path):
             return True
         # Noise-dir pruning: os.walk never descends these, so anything beneath
         # one is excluded from the corpus regardless of ignore patterns.
@@ -2033,6 +2054,8 @@ def _on_walk_error(err: OSError) -> None:
                 if fname in _SKIP_FILES:
                     continue
                 p = dp / fname
+                if _is_installed_graphify_file(p):
+                    continue
                 if p not in seen:
                     seen.add(p)
                     all_files.append(p)
```

**File**: `graphify/extract.py` (modified, +8/-3)
```diff
@@ -8996,7 +8996,12 @@ def collect_files(target: Path, *, follow_symlinks: bool = False, root: Path | N
     if target.is_file():
         return [target] if _resolves_under_root(target, containment_root) else []
     _EXTENSIONS = set(_DISPATCH.keys())
-    from graphify.detect import _is_ignored, _is_noise_dir, _load_graphifyignore
+    from graphify.detect import (
+        _is_ignored,
+        _is_installed_graphify_file,
+        _is_noise_dir,
+        _load_graphifyignore,
+    )
     ignore_root = root if root is not None else target
     patterns = _load_graphifyignore(ignore_root)
     # Shared across all _is_ignored calls in this scan so ancestor-directory
@@ -9026,7 +9031,7 @@ def _ignored(p: Path) -> bool:
             for fname in filenames:
                 p = dp / fname
                 suffix = p.suffix
-                if (suffix in _EXTENSIONS or suffix.lower() in _EXTENSIONS) and not _ignored(p) and _resolves_under_root(p, containment_root):
+                if (suffix in _EXTENSIONS or suffix.lower() in _EXTENSIONS) and not _ignored(p) and not _is_installed_graphify_file(p) and _resolves_under_root(p, containment_root):
                     results.append(p)
         return sorted(results)
     # Walk with symlink following + cycle detection
@@ -9047,7 +9052,7 @@ def _ignored(p: Path) -> bool:
         for fname in filenames:
             p = dp / fname
             suffix = p.suffix
-            if (suffix in _EXTENSIONS or suffix.lower() in _EXTENSIONS) and not _ignored(p) and _resolves_under_root(p, containment_root):
+            if (suffix in _EXTENSIONS or suffix.lower() in _EXTENSIONS) and not _ignored(p) and not _is_installed_graphify_file(p) and _resolves_under_root(p, containment_root):
                 results.append(p)
     return sorted(results)
 
```

**File**: `tests/test_detect.py` (modified, +79/-0)
```diff
@@ -2224,6 +2224,85 @@ def test_detect_keeps_skills_graphify_source_layouts(tmp_path):
         assert any(f.endswith("/" + rel) for f in found), rel
 
 
+# Files graphify only adds its own section or entry to. They belong to the
+# user, so they stay in the corpus (how to treat graphify's section in the
+# instruction files is an open question on #4057).
+_USER_FILES_GRAPHIFY_EDITS = {
+    "AGENTS.md", "CLAUDE.md", ".claude/CLAUDE.md", "GEMINI.md", "CODEBUDDY.md",
+    ".github/copilot-instructions.md",
+    ".claude/settings.json", ".codebuddy/settings.json", ".codex/hooks.json",
+    ".gemini/settings.json", ".kilo/kilo.json", ".opencode/opencode.json",
+}
+
+
+def test_detect_skips_every_file_graphify_install_writes(tmp_path, monkeypatch):
+    """Run every project install in install.py (plus the CLI installers that
+    write into the project directly) and check that nothing graphify wrote
+    whole is indexed: skill folders, always-on rules/steering/workflow files
+    and hook plugins. A new platform that writes a new file fails here (#4057)."""
+    from graphify import install as inst
+    from graphify.extract import collect_files
+
+    proj = tmp_path / "proj"  # HOME is sandboxed by conftest
+    proj.mkdir()
+    monkeypatch.chdir(proj)
+    (proj / "app.py").write_text("def main():\n    return 1\n")
+
+    for name in [*inst._PLATFORM_CONFIG, "gemini", "cursor"]:
+        inst._project_install(name, proj)
+    inst._kilo_install(proj)         # .kilo/plugins/graphify.js
+    inst.codebuddy_install(proj)     # CODEBUDDY.md, .codebuddy/settings.json
+    inst.vscode_install(proj)        # .github/copilot-instructions.md
+
+    found = {
+        Path(f).relative_to(proj).as_posix()
+        for files in detect(proj)["files"].values()
+        for f in files
+    }
+    assert "app.py" in found
+    assert found - {"app.py"} <= _USER_FILES_GRAPHIFY_EDITS, sorted(found)
+
+    ignored = detect_mod.ignored_predicate(proj)
+    for parts in detect_mod._GRAPHIFY_INSTALLED_FILES:
+        written = proj.joinpath(*parts)
+        assert written.is_file(), f"no installer writes {written} any more"
+        assert ignored(written), written
+    collected = {p.relative_to(proj).as_posix() for p in collect_files(proj)}
+    assert "app.py" in collected
+    assert collected - {"app.py"} <= _USER_FILES_GRAPHIFY_EDITS, sorted(collected)
+
+
+def test_detect_keeps_files_named_like_graphify_installs(tmp_path):
+    """The single-file rule matches the holder dir plus the exact path, never a
+    bare graphify.md/graphify.js, and leaves the user's other rules alone."""
+    keep = [
+        "docs/graphify.md",
+        "rules/graphify.md",
+        "steering/graphify.md",
+        "src/plugins/graphify.js",
+        "plugins/graphify.js",
+        ".github/rules/graphify.md",
+        ".opencode/plugins/team.js",
+        ".kiro/steering/product.md",
+        ".agents/rules/style.md",
+        ".windsurf/rules/graphify-notes.md",
+    ]
+    for rel in keep:
+        f = tmp_path / rel
+        f.parent.mkdir(parents=True, exist_ok=True)
+        f.write_text("export function f() { return 1 }\n" if rel.endswith(".js") else "# Title\n\nText.\n")
+
+    found = _all_detected(detect(tmp_path))
+    ignored = detect_mod.ignored_predicate(tmp_path)
+    for rel in keep:
+        assert any(f.endswith("/" + rel) for f in found), rel
+        assert not ignored(tmp_path / rel), rel
+
+    from graphify.extract import collect_files
+    collected = {p.relative_to(tmp_path).as_posix() for p in collect_files(tmp_path)}
+    assert {"src/plugins/graphify.js", "plugins/graphify.js", ".opencode/plugins/team.js"} <= collected
+
+
 def test_is_noise_dir_graphify_skill_needs_parent():
     """Without a parent the path shape cannot be verified, so keep the dir."""
     assert detect_mod._is_noise_dir("graphify") is False
```

---

### Incident Patch 13: `c75bc16d` (2026-10-04)
**Commit Message**: fix(detect): skip graphify's own installed skill folder when scanning

`graphify install --project` copies graphify's SKILL.md and its
references/ bundle into the project (.claude/skills/graphify/,
.agents/skills/graphify/, ...). detect() treated those files as project
documents, so a small repo's graph was mostly graphify's own docs: in the
#4057 repro, 66 of 69 nodes came from the installed skill and the
always-on files, and only 3 from the user's code.

Prune the folder in _is_noise_dir, next to the .claude/worktrees rule, by
its full path shape as install.py writes it: <hidden dir>/skills/graphify/,
plus .pi/agent/skills/graphify/, .config/kilo/skills/graphify/ and
.aider/graphify/. The bare names "skills" and "graphify" are not matched on
their own (#2479), so graphify's own source tree (graphify/skills/<host>/),
a top-level skills/graphify/ and the user's other skills stay indexed.
Because the rule lives in _is_noise_dir, detect(), ignored_predicate() and
collect_files() all agree on it.

AGENTS.md, CLAUDE.md and .claude/CLAUDE.md are left as they are; those are
the user's files and how to treat graphify's section in them is still an
open question on the issue.

Fixes #4057



**File**: `graphify/detect.py` (modified, +19/-0)
```diff
@@ -971,6 +971,10 @@ def _is_regular_file(path: Path) -> bool:
 # unconditionally pruned above; only the ambiguous bare name is gated here.
 _JS_SNAPSHOT_TEST_ROOTS = frozenset({"__tests__", "__test__"})
 
+# Platforms whose project-scope skills dir is one level below the hidden dir
+# (install.py: pi -> .pi/agent/skills, kilo -> .config/kilo/skills).
+_NESTED_SKILL_HOLDERS = frozenset({(".pi", "agent"), (".config", "kilo")})
+
 # Files a coverage tool writes into its own output dir. Any one of them is proof
 # the directory is generated: lcov (lcov.info), nyc/Istanbul (coverage-final.json,
 # clover.xml, the lcov-report/ subtree), coverage.py (coverage.xml, .coverage),
@@ -1128,6 +1132,21 @@ def _is_noise_dir(part: str, parent: "Path | None" = None) -> bool:
     # worktrees/ nested inside a dotted dir (e.g. .claude/worktrees/, .git/worktrees/)
     if part == "worktrees" and parent is not None and parent.name.startswith("."):
         return True
+    # graphify's own skill folder, as `graphify install --project` writes it
+    # (#4057): <hidden dir>/skills/graphify/ (.claude, .codex, .agents, ...),
+    # .pi/agent/skills/graphify/, .config/kilo/skills/graphify/ and
+    # .aider/graphify/. Matched on the whole path shape rather than the bare
+    # names "skills"/"graphify" (#2479), so graphify's own source tree
+    # (graphify/skills/<host>/), a top-level skills/graphify/ and the user's
+    # other skills under .claude/skills/ are still indexed.
+    if part == "graphify" and parent is not None:
+        if parent.name == ".aider":
+            return True
+        if parent.name == "skills":
+            holder = parent.parent
+            if holder.name.startswith(".") and holder.name != "..":
+                return True
+            return (holder.parent.name, holder.name) in _NESTED_SKILL_HOLDERS
     return False
 
 
```

**File**: `tests/test_detect.py` (modified, +82/-0)
```diff
@@ -2149,6 +2149,88 @@ def test_detect_skips_nested_worktrees_dir(tmp_path):
     assert not any("worktrees" in f for f in code)
 
 
+# Regression tests for #4057 - graphify's own installed skill folder is not project content
+
+def _all_detected(result) -> list[str]:
+    return as_posix_list(f for files in result["files"].values() for f in files)
+
+
+def test_detect_skips_installed_graphify_skill(tmp_path):
+    """The skill `graphify install --project --platform claude` writes (SKILL.md
+    plus references/) is never indexed; the user's code and their own skills
+    in the same .claude/skills/ dir still are (#4057)."""
+    from graphify.install import _copy_skill_file
+
+    (tmp_path / "auth.py").write_text("def login():\n    return 1\n")
+    skill = _copy_skill_file("claude", project=True, project_dir=tmp_path)
+    assert (skill.parent / "references").is_dir()  # the real packaged bundle
+    mine = tmp_path / ".claude" / "skills" / "deploy" / "SKILL.md"
+    mine.parent.mkdir(parents=True)
+    mine.write_text("# Deploy\n\nHow we ship this project.\n")
+
+    found = _all_detected(detect(tmp_path))
+    assert any(f.endswith("/auth.py") for f in found)
+    assert any(f.endswith("/.claude/skills/deploy/SKILL.md") for f in found)
+    assert not any("/skills/graphify/" in f for f in found), found
+
+    ignored = detect_mod.ignored_predicate(tmp_path)
+    assert ignored(skill)
+    assert not ignored(mine)
+
+
+def test_detect_skips_graphify_skill_for_every_project_platform(tmp_path):
+    """Every project-scope skill destination install.py knows about is pruned,
+    so a new platform with a new layout fails here instead of silently being
+    indexed (#4057)."""
+    from graphify.install import _PLATFORM_CONFIG, _platform_skill_destination
+
+    platforms = [*_PLATFORM_CONFIG, "gemini"]
+    for name in platforms:
+        dst = _platform_skill_destination(name, project=True, project_dir=tmp_path)
+        (dst.parent / "references").mkdir(parents=True, exist_ok=True)
+        dst.write_text("# graphify\n\nInstalled skill.\n")
+        (dst.parent / "references" / "query.md").write_text("# Query\n\nRef.\n")
+    (tmp_path / "app.py").write_text("x = 1\n")
+
+    found = _all_detected(detect(tmp_path))
+    assert any(f.endswith("/app.py") for f in found)
+    leaked = [f for f in found if "/graphify/" in f]
+    assert leaked == [], leaked
+
+
+def test_detect_keeps_skills_graphify_source_layouts(tmp_path):
+    """Only graphify's installed skill path shape is pruned, not the bare names
+    "skills" or "graphify" (#2479): graphify's own repo layout
+    (graphify/skills/<host>/references/), a top-level skills/graphify/ as
+    published by a skills repo, and similar names outside a hidden dir stay."""
+    keep = [
+        "graphify/skill.md",
+        "graphify/skills/claude/references/query.md",
+        "graphify/skills/codex/references/update.md",
+        "graphify/detect.py",
+        "skills/graphify/SKILL.md",
+        "src/skills/graphify/loader.py",
+        "docs/agent/skills/graphify/notes.md",
+        ".claude/skills/graphify-extras/SKILL.md",
+        ".claude/graphify/notes.md",
+    ]
+    for rel in keep:
+        f = tmp_path / rel
+        f.parent.mkdir(parents=True, exist_ok=True)
+        f.write_text("def f():\n    return 1\n" if rel.endswith(".py") else "# Title\n\nText.\n")
+
+    found = _all_detected(detect(tmp_path))
+    for rel in keep:
+        assert any(f.endswith("/" + rel) for f in found), rel
+
+
+def test_is_noise_dir_graphify_skill_needs_parent():
+    """Without a parent the path shape cannot be verified, so keep the dir."""
+    assert detect_mod._is_noise_dir("graphify") is False
+    assert detect_mod._is_noise_dir("skills") is False
+    assert detect_mod._is_noise_dir("graphify", Path("..") / "skills") is False
+
+
 def test_detect_extra_excludes_pattern(tmp_path):
     """extra_excludes patterns exclude matching files from detect() (#947)."""
     (tmp_path / "main.py").write_text("x = 1")
```

---

### Incident Patch 14: `ac6ab9f2` (2026-10-04)
**Commit Message**: fix(extract): keep an unresolved base off a class in another language

The unique-stub rewire copied a same-label class onto every edge, so a
Python base could inherit a TypeScript class. Refuse that write when the
language families differ. A same-language match still rewires.

Fixes #2207

(cherry picked from commit 48cdc8f4849dea88090052fa5140801b4ebbff7e)

**File**: `graphify/extract.py` (modified, +22/-5)
```diff
@@ -3348,9 +3348,9 @@ def _names_own_builtin_base(edge: dict, stub_id: str, remapped_id: str) -> bool:
         collects referrers from every language that names it, and the TypeScript
         referrers must still rewire onto the TypeScript class.
 
-        Deliberately narrower than a blanket family gate on the type path: a
-        corpus really can declare its own `BookStore` in one language and subclass
-        it from another (`test_extract_rewires_unique_inheritance_stub_to_real_definition`).
+        `_cross_language_candidate` is the same per-edge rule for every label
+        (#2207). A missing base stays on the stub instead of attaching to a
+        same-named type in another language.
         """
         if edge.get("relation") not in _SUPERTYPE_RELATIONS:
             return False
@@ -3367,6 +3367,21 @@ def _names_own_builtin_base(edge: dict, stub_id: str, remapped_id: str) -> bool:
             return False
         target_fam = _lang_family(by_id.get(remapped_id, {}).get("source_file"))
         return target_fam is not None and target_fam != edge_fam
+
+    def _cross_language_candidate(edge: dict, remapped_id: str) -> bool:
+        """Refuse a unique candidate whose language family differs from the edge.
+
+        Unknown families are left alone, matching the function-path guard.
+        One stub can still rewire a same-family referrer.
+        """
+        edge_fam = _lang_family(edge.get("source_file"))
+        cand_fam = _lang_family(by_id.get(remapped_id, {}).get("source_file"))
+        return (
+            edge_fam is not None
+            and cand_fam is not None
+            and edge_fam != cand_fam
+        )
+
     for edge in edges:
         is_csharp_scoped_edge = (
             str(edge.get("source_file", "")).endswith((".cs", ".razor", ".cshtml"))
@@ -3378,15 +3393,17 @@ def _names_own_builtin_base(edge: dict, stub_id: str, remapped_id: str) -> bool:
             if not (
                 is_csharp_scoped_edge
                 and str(by_id.get(remapped_source, {}).get("source_file", "")).endswith(".cs")
-            ):
+            ) and not _cross_language_candidate(edge, remapped_source):
                 edge["source"] = remapped_source
         target = edge.get("target")
         if target in remap:
             remapped_target = remap[str(target)]
             if not (
                 is_csharp_scoped_edge
                 and str(by_id.get(remapped_target, {}).get("source_file", "")).endswith(".cs")
-            ) and not _names_own_builtin_base(edge, str(target), remapped_target):
+            ) and not _names_own_builtin_base(
+                edge, str(target), remapped_target
+            ) and not _cross_language_candidate(edge, remapped_target):
                 edge["target"] = remapped_target
 
     referenced = {x for e in edges for x in (e.get("source"), e.get("target"))}
```

**File**: `tests/test_extract.py` (modified, +152/-11)
```diff
@@ -284,7 +284,12 @@ def test_extract_updates_raw_call_callers_after_duplicate_id_disambiguation(tmp_
             assert edge["target"] in node_ids
 
 
-def test_extract_rewires_unique_inheritance_stub_to_real_definition(tmp_path):
+def test_extract_keeps_inheritance_stub_when_the_only_class_is_another_language(tmp_path):
+    """C# `SqliteBookStore : BookStore` must not inherit the Python class.
+
+    This fixture used to require that rewire. It is the same bind as an
+    unresolved base landing on the only same-label class in another language (#2207).
+    """
     definition = tmp_path / "interfaces.py"
     implementation = tmp_path / "services/BookStore.cs"
     definition.write_text("class BookStore:\n    pass\n", encoding="utf-8")
@@ -293,22 +298,105 @@ def test_extract_rewires_unique_inheritance_stub_to_real_definition(tmp_path):
 
     result = extract([definition, implementation], cache_root=tmp_path)
     node_by_id = {node["id"]: node for node in result["nodes"]}
-    inherits_edges = [edge for edge in result["edges"] if edge["relation"] == "inherits"]
+    matching = [
+        edge for edge in result["edges"]
+        if edge["relation"] == "inherits"
+        and node_by_id[edge["source"]]["label"] == "SqliteBookStore"
+    ]
+
+    assert len(matching) == 1
+    target = node_by_id[matching[0]["target"]]
+    assert target["label"] == "BookStore"
+    assert not target.get("source_file")
+    assert any(
+        node["label"] == "BookStore" and node.get("source_file") == "interfaces.py"
+        for node in result["nodes"]
+    )
+
+
+def test_extract_does_not_rewire_unresolved_base_to_other_language_const(tmp_path):
+    """#2207: `class User(Base)` must not inherit a TS const named Base."""
+    models = tmp_path / "backend/models.py"
+    widget = tmp_path / "frontend/widget.test.tsx"
+    models.parent.mkdir(parents=True)
+    widget.parent.mkdir(parents=True)
+    models.write_text("class User(Base):\n    pass\n", encoding="utf-8")
+    widget.write_text('const Base = { id: 1, name: "test" };\n', encoding="utf-8")
+
+    result = extract([models, widget], cache_root=tmp_path)
+    node_by_id = {node["id"]: node for node in result["nodes"]}
+    matching = [
+        edge for edge in result["edges"]
+        if edge["relation"] == "inherits" and node_by_id[edge["source"]]["label"] == "User"
+    ]
+
+    assert len(matching) == 1
+    target = node_by_id[matching[0]["target"]]
+    assert target["label"] == "Base"
+    assert not target.get("source_file")
+
+
+def test_extract_does_not_rewire_unresolved_base_to_other_language_class(tmp_path):
+    """#2207: a real TS class is still the wrong language for `User(Base)`."""
+    models = tmp_path / "backend/models.py"
+    widget = tmp_path / "frontend/widget.tsx"
+    models.parent.mkdir(parents=True)
+    widget.parent.mkdir(parents=True)
+    models.write_text("class User(Base):\n    pass\n", encoding="utf-8")
+    widget.write_text("export class Base { id: number = 1; }\n", encoding="utf-8")
+
+    result = extract([models, widget], cache_root=tmp_path)
+    node_by_id = {node["id"]: node for node in result["nodes"]}
+    matching = [
+        edge for edge in result["edges"]
+        if edge["relation"] == "inherits" and node_by_id[edge["source"]]["label"] == "User"
+    ]
+
+    assert len(matching) == 1
+    target = node_by_id[matching[0]["target"]]
+    assert target["label"] == "Base"
+    assert not target.get("source_file")
+
+
+def test_extract_does_not_rewire_csharp_base_to_other_language_class(tmp_path):
+    """A C# base stub has no origin file. It still must not bind to a TS class."""
+    service = tmp_path / "services/User.cs"
+    widget = tmp_path / "frontend/widget.tsx"
+    service.parent.mkdir(parents=True)
+    widget.parent.mkdir(parents=True)
+    service.write_text("class User : Base { }\n", encoding="utf-8")
+    widget.write_text("export class Base { id: number = 1; }\n", encoding="utf-8")
+
+    result = extract([service, widget], cache_root=tmp_path)
+    node_by_id = {node["id"]: node for node in result["nodes"]}
+    matching = [
+        edge for edge in result["edges"]
+        if edge["relation"] == "inherits" and node_by_id[edge["source"]]["label"] == "User"
+    ]
+
+    assert len(matching) == 1
+    target = node_by_id[matching[0]["target"]]
+    assert target["label"] == "Base"
+    assert not target.get("source_file")
+
 
+def test_extract_still_rewires_unique_base_in_the_same_language(tmp_path):
+    definition = tmp_path / "a.py"
+    user = tmp_path / "b.py"
+    definition.write_text("class Widget:\n    pass\n", encoding="utf-8")
+    user.write_text("class User(Widget):\n    pass\n", encoding="utf-8")
+
+    result = extract([definition, user], cache_root=tmp_path)
+    node_by_id = {node["id"]: node for node in result["nodes"]}
     matching = [
-        edge for edge in inherits_edges
-        if node_by_id[edge["source"]]["label"] == "SqliteBookStore"
-        and node_by_id[edge["targe
```

---

### Incident Patch 15: `85664927` (2026-10-04)
**Commit Message**: fix(extract): stop walking JSON Schema files as config manifests (#2255)

`_is_config_json()` decides whether a `.json` file is worth AST-walking. It
matches by filename first, then falls back to a root-key probe. `$schema` was
in that probe's key set -- correctly, since configs legitimately carry it --
but it is also the *defining marker* of a JSON Schema, so every schema
document satisfied the probe and got walked in full. That re-opened the
keyword-node explosion #1224 closed for data JSON: one 160 KB contract
contributed 362 nodes labelled with bare schema keywords (`description` x113,
`type` x83, `$ref` x53, ...) plus ~12 schema-only communities, polluting
clustering, god-node analysis and GRAPH_REPORT.md.

Two changes, both ahead of the existing probe:

- Drop `$ref` from the probe keys. A root-level `$ref` is a schema construct
  and never a config signal.
- Return False when the root object carries `$schema` *plus* a
  schema-definition marker (`$defs`, `definitions`, or `$id`). This is what
  separates "this file IS a schema" from "this config POINTS AT a schema":
  the latter points `$schema` at its own tool's schema (biomejs.dev,
  docs.renovatebot.com) and never carries

**File**: `graphify/extractors/json_config.py` (modified, +45/-9)
```diff
@@ -18,44 +18,80 @@
 _CONFIG_JSON_KEYS = frozenset({
     "dependencies", "devDependencies", "peerDependencies",
     "optionalDependencies", "bundleDependencies", "bundledDependencies",
-    "extends", "$ref", "$schema", "compilerOptions",
+    "extends", "$schema", "compilerOptions",
 })
 
+# Root-level keys that only a JSON Schema *document* carries. A schema that
+# defines anything needs somewhere to put the definitions, and the spec's own
+# keywords for that are `$defs` (2020-12) and `definitions` (draft-07/04);
+# `$id` names the schema itself. Combined with `$schema` these separate "this
+# file IS a schema" from "this config POINTS AT a schema" -- the latter points
+# $schema at its own tool's schema (biomejs.dev, docs.renovatebot.com, ...),
+# never at the meta-schema, and never carries these markers.
+_SCHEMA_DEFINITION_KEYS = frozenset({"$defs", "definitions", "$id"})
+
+
 def _is_config_json(path: Path, obj_node, source: bytes) -> bool:
     """True if a .json file is a recognized config/manifest worth AST-extracting.
 
     Matches by filename first (cheap), then falls back to a top-level key probe
     so arbitrarily-named config files (e.g. ``api.tsconfig.json``,
     ``foo.eslintrc.json``) are still picked up. Returns False for data JSON so it
-    is skipped by the structural pass (#1224)."""
+    is skipped by the structural pass (#1224).
+
+    A JSON Schema is *not* a config manifest. `$schema` sits in the probe's key
+    set because configs legitimately carry it, but it is also the defining marker
+    of a schema -- so a schema document satisfied the probe and was walked in
+    full, re-opening the keyword-node explosion #1224 closed (#2255). One 160 KB
+    contract contributed 362 keyword nodes and ~12 schema-only communities. The
+    filename branches above run first, so `biome.json`/`renovate.json`/
+    `package.json` never depended on the probe; the probe only decides the fate
+    of arbitrarily-named files, which is why narrowing it is low-risk.
+
+    Documented boundary: a hand-written schema carrying `$schema` but no
+    `$defs`/`definitions`/`$id` is still walked. Catching it would need a
+    keyword-density heuristic, which would risk skipping a real config whose keys
+    happen to overlap schema vocabulary -- the worse error, since it drops
+    structure silently (#1224). Pinned by
+    ``tests/test_json_schema_config.py::test_minimal_schema_without_defs_or_id_is_still_walked``.
+    """
     name = path.name.casefold()
     if name in _CONFIG_JSON_NAMES:
         return True
     # Common compound config names: *.eslintrc.json, *.prettierrc.json, etc.
     if name.endswith((".eslintrc.json", ".prettierrc.json", ".babelrc.json",
                       "tsconfig.json", "jsconfig.json")):
         return True
-    # Top-level key probe: scan the root object's immediate keys (no deep walk).
+    # Collect the root object's immediate keys once (no deep walk), so the
+    # schema check below and the config probe agree on the same key set.
+    root_keys: set[str] = set()
     for top_key in obj_node.children:
         if top_key.type != "pair":
             continue
         key_node = top_key.child_by_field_name("key")
         if key_node is None:
             continue
         kc = key_node.child_by_field_name("string_content")
-        text = _read_text(kc, source) if kc else _read_text(key_node, source).strip('"\'')
-        if text in _CONFIG_JSON_KEYS:
-            return True
+        root_keys.add(_read_text(kc, source) if kc
+                      else _read_text(key_node, source).strip('"\''))
+    # A file that declares the meta-schema AND defines something IS a schema.
+    if "$schema" in root_keys and (root_keys & _SCHEMA_DEFINITION_KEYS):
+        return False
+    # Top-level key probe. `$ref` is deliberately absent: a root-level `$ref` is
+    # a schema construct and never a config signal (#2255).
+    if root_keys & _CONFIG_JSON_KEYS:
+        return True
     return False
 
 def extract_json(path: Path) -> dict:
     """Extract structure and dependency edges from a *config/manifest* .json file.
 
     Data-shaped JSON (eval fixtures, datasets, GeoJSON, API response dumps) is
     deliberately skipped — AST-walking it produced hundreds of orphan key-nodes
-    and duplicate communities that swamped real structure (#1224). Recognition
-    is by filename (package.json, tsconfig.json, …) or a top-level key probe
-    (dependencies / extends / $ref / $schema / compilerOptions)."""
+    and duplicate communities that swamped real structure (#1224). JSON Schema
+    documents are skipped for the same reason (#2255). Recognition is by filename
+    (package.json, tsconfig.json, …) or a top-level key probe (dependencies /
+    extends / $schema / compilerOptions)."""
     _JSON_MAX_BYTES = 1_048_576  # 1 MiB — skip large fixture dumps / GeoJSON blobs
 
     try:
```

**File**: `tests/test_json_schema_config.py` (added, +227/-0)
```diff
@@ -0,0 +1,227 @@
+"""JSON Schema files must not be mistaken for config manifests.
+
+`_is_config_json()` decides whether a `.json` file is worth AST-walking. It
+matches by filename first, then falls back to a root-key probe. But `$schema`
+was in that probe's key set, and `$schema` is the *defining marker* of a JSON
+Schema -- so every schema document satisfied the probe and got walked in full,
+re-opening the keyword-node explosion #1224 closed for data JSON.
+
+One 160 KB contract contributed 362 nodes whose labels were bare schema
+keywords (`description`, `type`, `$ref`, `required`, `properties`), plus ~12
+schema-only communities that polluted clustering, god-node analysis and
+`GRAPH_REPORT.md` -- 13% of a 2,725-node graph (#2255).
+
+These tests pin both directions, because the fix removes keys from the probe and
+the risk is over-correcting into skipping real configs:
+
+- a file that *is* a schema (`$schema` plus a schema-definition marker) is
+  skipped, not walked
+- a root-level `$ref`, which is a schema construct and never a config signal,
+  no longer implies config
+- every config shape that reaches the probe -- including configs that carry
+  `$schema` themselves -- is still extracted
+
+The filename branches run before the probe, so `biome.json`/`renovate.json`/
+`package.json` never depended on the probe at all; those are pinned explicitly
+anyway, because a fix here must not be able to change them.
+"""
+from pathlib import Path
+
+from graphify.extractors.json_config import extract_json
+
+# A JSON Schema as a contract file actually looks like: `$id` + `$defs`.
+SCHEMA_WITH_DEFS = '''\
+{
+  "$schema": "https://json-schema.org/draft/2020-12/schema",
+  "$id": "https://example.com/events-v1.json",
+  "title": "Event catalogue",
+  "$defs": {
+    "dataClassification": {
+      "description": "Handling class for the event payload.",
+      "type": "string",
+      "enum": ["Public", "Internal", "CUI"]
+    },
+    "event": {
+      "description": "One domain event.",
+      "type": "object",
+      "required": ["id", "kind"],
+      "properties": {
+        "id": {"description": "Stable id.", "type": "string"},
+        "kind": {"description": "Event kind.", "type": "string"},
+        "seq": {"description": "Sequence.", "type": "integer", "minimum": 0},
+        "tags": {"description": "Tags.", "type": "array",
+                 "items": {"type": "string"}},
+        "shape": {"description": "One shape.", "oneOf": [{"type": "string"}]}
+      },
+      "additionalProperties": false
+    }
+  },
+  "$ref": "#/$defs/event"
+}
+'''
+
+SCHEMA_WITH_LEGACY_DEFS = '''\
+{
+  "$schema": "http://json-schema.org/draft-07/schema#",
+  "definitions": {
+    "point": {"description": "A point.", "type": "object"}
+  },
+  "$ref": "#/definitions/point"
+}
+'''
+
+# A root-level $ref is a schema construct, never a config signal.
+SCHEMA_REF_ONLY = '{"$ref": "https://example.com/other.json"}'
+
+# Real configs that carry $schema themselves. These point at their OWN tool's
+# schema, not at the JSON Schema meta-schema -- which is exactly why $schema
+# cannot be read as "this file is a schema".
+BIOME = '''\
+{
+  "$schema": "https://biomejs.dev/schemas/1.7.0/schema.json",
+  "files": {"include": ["src"]},
+  "linter": {"enabled": true}
+}
+'''
+
+RENOVATE = '''\
+{
+  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
+  "extends": ["config:base"]
+}
+'''
+
+# Arbitrary filename -> only the root-key probe can catch these.
+PROBE_EXTENDS = '{"extends": "./base.json", "rules": {"eqeqeq": "error"}}'
+PROBE_COMPILER = '{"compilerOptions": {"strict": true, "target": "es2022"}}'
+SUFFIX_TSCONFIG = '{"compilerOptions": {"strict": true}}'
+
+
+def _write(tmp_path, name, body):
+    p = Path(tmp_path) / name
+    p.parent.mkdir(parents=True, exist_ok=True)
+    p.write_text(body)
+    return p
+
+
+def _labels(result):
+    return [n["label"] for n in result["nodes"]]
+
+
+def _is_skipped(result):
+    return result.get("skipped") == "data json (not a config/manifest)"
+
+
+# --- the schema side: these must stop being walked -------------------------
+
+def test_schema_with_defs_is_skipped_not_walked(tmp_path):
+    r = extract_json(_write(tmp_path, "events-v1.json", SCHEMA_WITH_DEFS))
+    assert _is_skipped(r), r
+    assert r["nodes"] == []
+    assert r["edges"] == []
+
+
+def test_schema_with_legacy_definitions_is_skipped(tmp_path):
+    # draft-07 schemas spell the same thing `definitions`.
+    r = extract_json(_write(tmp_path, "legacy.json", SCHEMA_WITH_LEGACY_DEFS))
+    assert _is_skipped(r), r
+    assert r["nodes"] == []
+
+
+def test_schema_with_defs_in_subdirectory_is_skipped(tmp_path):
+    # The reporter's file lived at contracts/events-v1.json, i.e. the filename
+    # branch could never have matched it -- only the probe could.
+    r = extract_json(_write(tmp_path, "contracts/events-v1.json", SCHEMA_WITH_DEFS))
+    assert _is_skipped(r), r
+
+
+def test_root_level_ref_alone_is_ski
```

#### Recent Merged Pull Requests:
- **PR #4103** (closed): test: assert FQ-strip and builtin-filter for Kotlin ::class annotation refs (@Jarvis-J-Jacob)
- **PR #4087** (closed): test(kotlin): assert FQ-strip and builtin filter for ::class refs (@Mpasha17)
- **PR #4069** (closed): chore(packaging): point the PyPI homepage at graphify.com (@SyedFahad7)
- **PR #4068** (closed): fix(extract): keep an unresolved base off a class in another language (@SrijanSriv)
- **PR #4065** (closed): fix(dedup): keep unstamped document nodes apart across files (@SrijanSriv)
- **PR #4062** (closed): fix(detect): skip graphify's own installed skill folders (#4057) (@Mpasha17)
- **PR #4058** (closed): fix(elixir): scope import/use to the declaring module, not the file (@Ayushraj06-bit)
- **PR #4056** (closed): fix(pascal): extract enumerated types and their values (@rajatnagda45)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
