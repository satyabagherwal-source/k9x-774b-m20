# Forensic Learning Record (Deep Inspection): microsoft/agent-framework

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-agent-framework-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/agent-framework](https://github.com/microsoft/agent-framework))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:54:42.686Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/agent-framework`
- **Description**: A framework for building, orchestrating and deploying AI agents and multi-agent workflows with support for Python and .NET.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 13881 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `dotnet/samples/02-agents/AgentSkills/Agent_Step01_FileBasedSkills/skills/unit-converter/scripts/convert.py`
```
# Unit conversion script
# Converts a value using a multiplication factor: result = value × factor
#
# Usage:
#   python scripts/convert.py --value 26.2 --factor 1.60934
#   python scripts/convert.py --value 75 --factor 2.20462

import argparse
import json


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert a value using a multiplication factor.",
        epilog="Examples:\n"
        "  python scripts/convert.py --value 26.2 --factor 1.60934\n"
        "  python scripts/convert.py --value 75 --factor 2.20462",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--value", type=float, required=True, help="The numeric value to convert.")
    parser.add_argument("--factor", type=float, required=True, help="The conversion factor from the table.")
    args = parser.parse_args()

    result = round(args.value * args.factor, 4)
    print(json.dumps({"value": args.value, "factor": args.factor, "result": result}))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `dotnet/samples/02-agents/AgentSkills/Agent_Step04_MixedSkills/skills/unit-converter/scripts/convert-units.py`
```
# Unit conversion script
# Converts a value using a multiplication factor: result = value × factor
#
# Usage:
#   python scripts/convert-units.py --value 26.2 --factor 1.60934
#   python scripts/convert-units.py --value 75 --factor 2.20462

import argparse
import json


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert a value using a multiplication factor.",
        epilog="Examples:\n"
        "  python scripts/convert-units.py --value 26.2 --factor 1.60934\n"
        "  python scripts/convert-units.py --value 75 --factor 2.20462",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--value", type=float, required=True, help="The numeric value to convert.")
    parser.add_argument("--factor", type=float, required=True, help="The conversion factor from the table.")
    args = parser.parse_args()

    result = round(args.value * args.factor, 4)
    print(json.dumps({"value": args.value, "factor": args.factor, "result": result}))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `dotnet/samples/02-agents/AgentSkills/Agent_Step07_SkillsAutoApproval/skills/unit-converter/scripts/convert.py`
```
# Unit conversion script
# Converts a value using a multiplication factor: result = value × factor
#
# Usage:
#   python scripts/convert.py --value 26.2 --factor 1.60934
#   python scripts/convert.py --value 75 --factor 2.20462

import argparse
import json


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert a value using a multiplication factor.",
        epilog="Examples:\n"
        "  python scripts/convert.py --value 26.2 --factor 1.60934\n"
        "  python scripts/convert.py --value 75 --factor 2.20462",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--value", type=float, required=True, help="The numeric value to convert.")
    parser.add_argument("--factor", type=float, required=True, help="The conversion factor from the table.")
    args = parser.parse_args()

    result = round(args.value * args.factor, 4)
    print(json.dumps({"value": args.value, "factor": args.factor, "result": result}))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `dotnet/samples/05-end-to-end/AGUIWebChat/Client/Components/Pages/Chat/ChatInput.razor.js`
```
export function init(elem) {
    elem.focus();

    // Auto-resize whenever the user types or if the value is set programmatically
    elem.addEventListener('input', () => resizeToFit(elem));
    afterPropertyWritten(elem, 'value', () => resizeToFit(elem));

    // Auto-submit the form on 'enter' keypress
    elem.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            elem.dispatchEvent(new CustomEvent('change', { bubbles: true }));
            elem.closest('form').dispatchEvent(new CustomEvent('submit', { bubbles: true, cancelable: true }));
        }
    });
}

function resizeToFit(elem) {
    const lineHeight = parseFloat(getComputedStyle(elem).lineHeight);

    elem.rows = 1;
    const numLines = Math.ceil(elem.scrollHeight / lineHeight);
    elem.rows = Math.min(5, Math.max(1, numLines));
}

function afterPropertyWritten(target, propName, callback) {
    const descriptor = getPropertyDescriptor(target, propName);
    Object.defineProperty(target, propName, {
        get: function () {
            return descriptor.get.apply(this, arguments);
        },
        set: function () {
            const result = descriptor.set.apply(this, arguments);
            callback();
            return result;
        }
    });
}

function getPropertyDescriptor(target, propertyName) {
    return Object.getOwnPropertyDescriptor(target, propertyName)
        || getPropertyDescriptor(Object.getPrototypeOf(target), propertyName);
}

```

### Core Architecture Module: `dotnet/samples/05-end-to-end/AGUIWebChat/Client/Components/Pages/Chat/ChatMessageList.razor.js`
```
// The following logic provides auto-scroll behavior for the chat messages list.
// If you don't want that behavior, you can simply not load this module.

window.customElements.define('chat-messages', class ChatMessages extends HTMLElement {
    static _isFirstAutoScroll = true;

    connectedCallback() {
        this._observer = new MutationObserver(mutations => this._scheduleAutoScroll(mutations));
        this._observer.observe(this, { childList: true, attributes: true });
    }

    disconnectedCallback() {
        this._observer.disconnect();
    }

    _scheduleAutoScroll(mutations) {
        // Debounce the calls in case multiple DOM updates occur together
        cancelAnimationFrame(this._nextAutoScroll);
        this._nextAutoScroll = requestAnimationFrame(() => {
            const addedUserMessage = mutations.some(m => Array.from(m.addedNodes).some(n => n.parentElement === this && n.classList?.contains('user-message')));
            const elem = this.lastElementChild;
            if (ChatMessages._isFirstAutoScroll || addedUserMessage || this._elemIsNearScrollBoundary(elem, 300)) {
                elem.scrollIntoView({ behavior: ChatMessages._isFirstAutoScroll ? 'instant' : 'smooth' });
                ChatMessages._isFirstAutoScroll = false;
            }
        });
    }

    _elemIsNearScrollBoundary(elem, threshold) {
        const maxScrollPos = document.body.scrollHeight - window.innerHeight;
        const remainingScrollDistance = maxScrollPos - window.scrollY;
        return remainingScrollDistance < elem.offsetHeight + threshold;
    }
});

```

### Core Architecture Module: `dotnet/src/Microsoft.Agents.AI.LocalCodeAct/Resources/runner.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""Child-process runner for local CodeAct subprocess mode."""

from __future__ import annotations

import ast
import asyncio
import contextlib
import io
import json
import keyword
import sys
import traceback
from collections.abc import Mapping, Sequence
from typing import Any, TextIO, cast


class _CappedTextIO(io.TextIOBase):
    def __init__(self, limit: int) -> None:
        super().__init__()
        self._limit = max(0, limit)
        self._buffer = io.StringIO()
        self.truncated = False

    def writable(self) -> bool:
        return True

    def write(self, value: str) -> int:
        text = str(value)
        current = self._buffer.tell()
        remaining = max(0, self._limit - current)
        if remaining:
            self._buffer.write(text[:remaining])
        if len(text) > remaining:
            self.truncated = True
        return len(text)

    def getvalue(self) -> str:
        return self._buffer.getvalue()


def _json_safe_mapping(value: Mapping[Any, Any]) -> dict[str, object]:
    return {str(key): _json_safe(item) for key, item in value.items()}


def _json_safe_sequence(value: Sequence[Any]) -> list[object]:
    return [_json_safe(item) for item in value]


def _json_safe(value: object) -> object:
    try:
        json.dumps(value)
    except (TypeError, ValueError):
        if isinstance(value, Mapping):
            return _json_safe_mapping(cast("Mapping[Any, Any]", value))  # type: ignore[redundant-cast]
        if isinstance(value, (list, tuple)):
            return _json_safe_sequence(cast("Sequence[Any]", value))
        return repr(value)
    return value


def _compile_main(code: str) -> tuple[Any, bool]:
    module = ast.parse(code, mode="exec")
    body = list(module.body)
    output_present = bool(body and isinstance(body[-1], ast.Expr))
    if output_present:
        last_expr = body[-1]
        if isinstance(last_expr, ast.Expr):
            body[-1] = ast.Return(value=last_expr.value)
    else:
        body.append(ast.Return(value=ast.Constant(value=None)))

    async_function_def = cast(Any, ast.AsyncFunctionDef)
    function = async_function_def(
        name="__local_codeact_main__",
        args=ast.arguments(
            posonlyargs=[],
            args=[],
            kwonlyargs=[],
            kw_defaults=[],
            defaults=[],
        ),
        body=body,
        decorator_list=[],
        returns=None,
        type_comment=None,
    )
    wrapped = ast.Module(body=[function], type_ignores=[])
    ast.fix_missing_locations(wrapped)
    return compile(wrapped, "<local-codeact>", "exec"), output_present


def _send(control: TextIO, payload: Mapping[str, Any]) -> None:
    control.write(json.dumps(payload, separators=(",", ":")) + "\n")
    control.flush()


async def _read_response(call_id: int) -> dict[str, Any]:
    line = await asyncio.to_thread(sys.stdin.readline)
    if not line:
        raise RuntimeError("Parent process closed the tool bridge.")
    response_value: Any = json.loads(line)
    if not isinstance(response_value, dict):
        raise RuntimeError("Received an invalid tool bridge response.")
    response = cast("dict[str, Any]", response_value)
    if response.get("call_id") != call_id:
        raise RuntimeError("Received an invalid tool bridge response.")
    if not response.get("ok"):
        exc_type = str(response.get("exc_type") or "RuntimeError")
        message = str(response.get("message") or "Tool call failed.")
        raise RuntimeError(f"{exc_type}: {message}")
    return response


def _make_tool(name: str, *, control: TextIO, bridge_lock: asyncio.Lock) -> Any:
    async def _tool(**kwargs: Any) -> Any:
        return await _call_tool(name, control=control, bridge_lock=bridge_lock, kwargs=kwargs)

    _tool.__name__ = name
    return _tool


async def _call_tool(
    name: str,
    *,
    control: TextIO,
    bridge_lock: asyncio.Lock,
    kwargs: Mapping[str, Any],
) -> Any:
    call_id = id(kwargs)
    async with bridge_lock:
        _send(
            control,
            {
                "type": "tool_call",
                "call_id": call_id,
                "name": name,
                "kwargs": _json_safe(dict(kwargs)),
            },
        )
        response = await _read_response(call_id)
    return response.get("result")


async def _execute(request: Mapping[str, Any], control: TextIO) -> dict[str, Any]:
    code = str(request.get("code") or "")
    stdout = _CappedTextIO(int(request.get("max_stdout_bytes") or 0))
    stderr = _CappedTextIO(int(request.get("max_stderr_bytes") or 0))
    tool_names_value = request.get("tool_names")
    tool_names = (
        [str(name) for name in cast("Sequence[Any]", tool_names_value)] if isinstance(tool_names_value, list) else []
    )
    bridge_lock = asyncio.Lock()

    async def call_tool(name: str, **kwargs: Any) -> Any:
        return await _call_tool(name, control=control, bridge_lock=bridge_lock, kwargs=kwargs)

    globals_dict: dict[str, Any] = {
        "__builtins__": __builtins__,
        "asyncio": asyncio,
        "call_tool": call_tool,
    }
    for tool_name in tool_names:
        if tool_name.isidentifier() and not keyword.iskeyword(tool_name):
            globals_dict[tool_name] = _make_tool(tool_name, control=control, bridge_lock=bridge_lock)

    compiled, output_present = _compile_main(code)
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        exec(compiled, globals_dict, globals_dict)  # noqa: S102  # nosec B102 - this runner exists to execute generated code.
        output = await globals_dict["__local_codeact_main__"]()

    return {
        "stdout": stdout.getvalue(),
        "stderr": stderr.getvalue(),
        "stdout_truncated": stdout.truncated,
        "stderr_truncated": stderr.truncated,
        "output_present": output_present,
        "output": _json_safe(output),
    }


async def _main() -> int:
    control = sys.stdout
    line = await asyncio.to_thread(sys.stdin.readline)
    if not line:
        return 1
    try:
        request_value: Any = json.loads(line)
        if not isinstance(request_value, dict):
            raise ValueError("Expected a JSON object request.")
        request = cast("dict[str, Any]", request_value)
        result = await _execute(request, control)
        _send(control, {"type": "complete", "result": result})
        return 0
    except BaseException as exc:
        _send(
            control,
            {
                "type": "error",
                "exc_type": type(exc).__name__,
                "message": str(exc),
                "traceback": traceback.format_exc(limit=20),
            },
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_main()))

```

### Core Architecture Module: `dotnet/src/Microsoft.Agents.AI.LocalCodeAct/Resources/validator.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""AST validation for generated Python code."""

from __future__ import annotations

import ast
import builtins as _builtins
from typing import Any

_PYTHON_BUILTIN_NAMES: frozenset[str] = frozenset(dir(_builtins))

# Allowed imports that generated code may use.
ALLOWED_IMPORTS: set[str] = {
    "asyncio",
    "pathlib",
    "json",
    "math",
    "datetime",
    "time",
    "itertools",
    "functools",
    "collections",
    "typing",
    "dataclasses",
    "decimal",
    "fractions",
    "re",
    "base64",
    "hashlib",
    "uuid",
    "random",
    "os",  # Limited to explicit os.environ and lexical os.path chains
}

# Blocked imports that expose dangerous capabilities.
BLOCKED_IMPORTS: set[str] = {
    "sys",
    "subprocess",
    "socket",
    "urllib",
    "requests",
    "http",
    "ftplib",
    "smtplib",
    "telnetlib",
    "multiprocessing",
    "threading",
    "ctypes",
    "shutil",
    "tempfile",
    "importlib",
    "builtins",
    "__builtin__",
}

# Allowed top-level `os` attribute names. Descendants are validated separately
# against complete-chain allow-lists.
ALLOWED_OS_ATTRS: set[str] = {"environ", "path"}

# Lexical path helpers that do not query or mutate the filesystem.
ALLOWED_OS_PATH_ATTRS: set[str] = {
    "abspath",
    "basename",
    "commonpath",
    "commonprefix",
    "dirname",
    "expandvars",
    "isabs",
    "join",
    "normcase",
    "normpath",
    "relpath",
    "split",
    "splitdrive",
    "splitext",
    "splitroot",
}

# Read-only mapping helpers for the scrubbed child-process environment.
ALLOWED_OS_ENVIRON_ATTRS: set[str] = {
    "copy",
    "get",
}

# Builtins that consume an OS-derived value without retaining it.
_OS_VALUE_CONSUMER_BUILTINS: frozenset[str] = frozenset({"bool", "len", "print", "repr", "str"})

# Collection operations are safe only for os.environ, whose values are strings.
_OS_ENVIRON_COPY_BUILTINS: frozenset[str] = frozenset(
    {"dict", "enumerate", "frozenset", "iter", "list", "reversed", "set", "sorted", "tuple"}
)

_OS_VALUE_BUILTINS: frozenset[str] = _OS_VALUE_CONSUMER_BUILTINS | _OS_ENVIRON_COPY_BUILTINS

_SAFE_DUNDER_ATTRS: frozenset[str] = frozenset(
    {
        "__aenter__",
        "__aexit__",
        "__doc__",
        "__enter__",
        "__eq__",
        "__exit__",
        "__file__",
        "__hash__",
        "__init__",
        "__iter__",
        "__len__",
        "__module__",
        "__name__",
        "__next__",
        "__repr__",
        "__str__",
    }
)

_BLOCKED_CAPABILITY_ATTRS: frozenset[str] = frozenset(
    {
        "__builtins__",
        "_sys",
        "builtins",
        "connect_accepted_socket",
        "create_connection",
        "create_server",
        "create_subprocess_exec",
        "create_subprocess_shell",
        "create_unix_connection",
        "create_unix_server",
        "getaddrinfo",
        "getnameinfo",
        "importlib",
        "open_connection",
        "open_unix_connection",
        "socket",
        "sock_accept",
        "sock_connect",
        "sock_recv",
        "sock_recv_into",
        "sock_recvfrom",
        "sock_recvfrom_into",
        "sock_sendall",
        "sock_sendfile",
        "sock_sendto",
        "start_server",
        "start_unix_server",
        "subprocess",
        "subprocess_exec",
        "subprocess_shell",
        "sys",
    }
)

_OS_ROOT_CHAIN: tuple[str, ...] = ("os",)
_OS_PATH_CHAIN: tuple[str, ...] = ("os", "path")
_OS_ENVIRON_CHAIN: tuple[str, ...] = ("os", "environ")

# Allowed builtin function names that generated code may call.
# Note: getattr/setattr/hasattr/delattr are NOT included because they can bypass
# AST attribute restrictions (e.g., getattr(os, 'system')('...') avoids os.system check).
# User-defined functions and registered tools are allowed at runtime.
ALLOWED_BUILTINS: set[str] = {
    "print",
    "len",
    "str",
    "int",
    "float",
    "bool",
    "list",
    "dict",
    "tuple",
    "set",
    "frozenset",
    "range",
    "enumerate",
    "zip",
    "map",
    "filter",
    "sorted",
    "reversed",
    "sum",
    "min",
    "max",
    "abs",
    "round",
    "pow",
    "divmod",
    "all",
    "any",
    "chr",
    "ord",
    "hex",
    "oct",
    "bin",
    "format",
    "repr",
    "ascii",
    "bytes",
    "bytearray",
    "memoryview",
    "isinstance",
    "issubclass",
    "callable",
    "type",
    "id",
    "hash",
    "next",
    "iter",
    "slice",
}

# Blocked builtin function names that expose dangerous capabilities.
BLOCKED_BUILTINS: set[str] = {
    "__builtins__",
    "eval",
    "exec",
    "compile",
    "__import__",
    "globals",
    "locals",
    "vars",
    "dir",
    "open",  # File I/O must go through pathlib with explicit mounts
    "input",
    "help",
    "breakpoint",
    "exit",
    "quit",
    "copyright",
    "credits",
    "license",
    "delattr",
    "getattr",  # Can bypass AST attribute checks: getattr(os, 'system')
    "setattr",  # Can bypass AST attribute checks
    "hasattr",  # Can probe for dangerous attributes
}

# Allowed AST node types for code structure and operations.
ALLOWED_AST_NODES: set[type[ast.AST]] = {
    ast.Module,
    ast.Expr,
    ast.Assign,
    ast.AugAssign,
    ast.AnnAssign,
    ast.For,
    ast.AsyncFor,
    ast.While,
    ast.If,
    ast.With,
    ast.AsyncWith,
    ast.Try,
    ast.ExceptHandler,
    ast.Pass,
    ast.Break,
    ast.Continue,
    ast.Return,
    ast.Await,
    # Comparisons and boolean operations
    ast.Compare,
    ast.BoolOp,
    ast.UnaryOp,
    ast.And,
    ast.Or,
    ast.Not,
    ast.Eq,
    ast.NotEq,
    ast.Lt,
    ast.LtE,
    ast.Gt,
    ast.GtE,
    ast.In,
    ast.NotIn,
    ast.Is,
    ast.IsNot,
    ast.UAdd,
    ast.USub,
    ast.Invert,
    # Data access
    ast.Name,
    ast.Load,
    ast.Store,
    ast.Del,
    ast.Attribute,
    ast.Subscript,
    ast.Slice,
    # Literals
    ast.Constant,
    ast.List,
    ast.Tuple,
    ast.Set,
    ast.Dict,
    # Arithmetic and bitwise operations
    ast.BinOp,
    ast.Add,
    ast.Sub,
    ast.Mult,
    ast.Div,
    ast.Mod,
    ast.FloorDiv,
    ast.Pow,
    ast.LShift,
    ast.RShift,
    ast.BitOr,
    ast.BitXor,
    ast.BitAnd,
    # Function calls and comprehensions
    ast.Call,
    ast.keyword,
    ast.ListComp,
    ast.SetComp,
    ast.DictComp,
    ast.GeneratorExp,
    ast.comprehension,
    # Control flow helpers
    ast.IfExp,
    ast.JoinedStr,
    ast.FormattedValue,
    # Imports (validated separately)
    ast.Import,
    ast.ImportFrom,
    ast.alias,
    # Function definitions (for local helpers)
    ast.FunctionDef,
    ast.AsyncFunctionDef,
    ast.arguments,
    ast.arg,
    # Lambda expressions
    ast.Lambda,
    # Match statements (Python 3.10+)
    ast.Match,
    ast.match_case,
    ast.MatchValue,
    ast.MatchSingleton,
    ast.MatchSequence,
    ast.MatchMapping,
    ast.MatchClass,
    ast.MatchStar,
    ast.MatchAs,
    ast.MatchOr,
    # Starred expressions
    ast.Starred,
}


class CodeValidationError(ValueError):
    """Raised when generated code violates the allow-list policy."""

    pass


class _CodeValidator(ast.NodeVisitor):
    """AST visitor that validates generated code against allow-lists."""

    def __init__(
        self,
        *,
        allowed_imports: set[str] | None = None,
        blocked_imports: set[str] | None = None,
        allowed_builtins: set[str] | None = None,
        blocked_builtins: set[str] | None = None,
        allowed_os_attrs: set[str] | None = None,
    ) -> None:
        super().__init__()
        self._errors: list[str] = []
        self._allowed_imports = allowed_imports if allowed_imports is not None else ALLOWED_IMPORTS
        self._blocked_imports = blocked_imports if blocked_imports is not None else BLOCKED_IMPORTS
        self._allowed_builtins = allowed_builtins if allowed_builtins is not None else ALLOWED_BUILTINS
        self._blocked_builtins = blocked_builtins 
```

### Core Architecture Module: `python/agent_framework_meta/__init__.py`
```
# Copyright (c) Microsoft. All rights reserved.

from importlib import metadata as _metadata
from pathlib import Path as _Path
from typing import Any, cast

try:
    import tomllib as _toml  # type: ignore # Python 3.11+
except ModuleNotFoundError:  # Python 3.10
    import tomli as _toml  # type: ignore


def _load_pyproject() -> dict[str, Any]:
    pyproject = (_Path(__file__).resolve().parents[1] / "pyproject.toml").read_text("utf-8")
    return cast(dict[str, Any], _toml.loads(pyproject))  # type: ignore


def _version() -> str:
    try:
        return _metadata.version("agent-framework")
    except _metadata.PackageNotFoundError as ex:
        data = _load_pyproject()
        project = cast(dict[str, Any], data.get("project", {}))
        version = project.get("version")
        if isinstance(version, str):
            return version
        raise RuntimeError("pyproject.toml missing project.version") from ex


__version__ = _version()
__all__ = ["__version__"]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8386** (2026-09-16): **Python: Fix ambiguous MCP configuration name matching**
  *Symptoms*: ### Motivation & Context  <!-- Thank you for your contribution to the Agent Framework repo! Please help reviewers and future users, providing the following information:   1. Why is this change required?   2. What problem does it solve?   3. What scenario does it contribute to?   4. If it fixes an open issue, please link to the issue below. -->  Fix MCP allowlist and approval name matching so each configured name identifies at most one raw remote tool. Preserve existing support for unambiguous prefixed names and keep discovery updates consistent across pagination and refresh.  ### Description & Review Guide  <!-- Describe your changes, the overall approach, the underlying design.      Highlight what you want the reviewers to focus on.      These notes will help understanding how your code works. Thanks! -->  - **What are the major changes?** Add shared validation for configured allowlist and approval names. Stage tool and prompt discovery across all pages before publishing new functions. Revalidate configuration when exposing functions, including progressive discovery. Add regression coverage for ordering, pagination, refresh, approval modes, and compatibility. - **What is the impact of these changes?** Configuration names that match multiple raw remote names now raise `ToolExecutionException`. Applications using those names must select an unambiguous name or a different `tool_name_prefix`. Raw names, unambiguous prefixed aliases, normalized-only approval nonmatching, and empt

- **Issue #8057** (2026-09-07): **Python: [Bug]: lab lightning tests hard-fail on fastapi 0.141 (litellm proxy imports removed get_flat_dependant)**
  *Symptoms*: ### Description  `Python - Lab Tests` fails on every PR since fastapi was raised to 0.141. The failing step is `Run resource-intensive lab tests`:  ``` cd packages/lab && uv run pytest -m "resource_intensive and not integration" ```  ``` FAILED lightning/tests/test_lightning.py::test_observability - ImportError: cannot import name 'get_flat_dependant' from 'fastapi.dependencies.utils' ```  This is not specific to any one PR — it reproduces on the merge-queue run for an unrelated ag-ui change and on other open PRs.  **Two things combine to produce the failure.**  **1. fastapi 0.141 no longer exposes `get_flat_dependant`, and litellm's proxy imports it.** The import chain from the test is:  ``` pytest.importorskip("agentlightning")   -> agentlightning/__init__.py:13   from .llm_proxy import *   -> agentlightning/llm_proxy.py:41  from litellm.proxy.proxy_server import app, save_worker_config   -> litellm/proxy/proxy_server.py:397   -> litellm/proxy/management_endpoints/management_v1/common.py:6        from fastapi.dependencies.utils import get_flat_dependant   # ImportError ```  Resolved versions in `python/uv.lock`: fastapi `0.141.1`, litellm `1.95.0`, agentlightning `0.3.0`.  #8052 raised the bound to `fastapi>=0.121.0,<0.142.0`, which allows 0.141. That was the right fix for #8042 (the previous `<0.140.0` cap excluded every current release); the lab package's transitive `litellm[proxy]` just is not compatible with 0.141 yet.  **2. The `importorskip` guard no longer skips, so 
  **Post-Mortem & Fix Analysis**:
  > I checked the current `lightning` observability test and confirmed that its optional `agentlightning` import can propagate nested `ImportError` exceptions from the LiteLLM/FastAPI proxy dependency chain. I’m going to make the guard skip on `ImportError` (not only `ModuleNotFoundError`), preserving the test’s optional nature while keeping the existing observability assertions unchanged, and will add focused verification for the guard behavior.

- **Issue #7403** (2026-08-11): **Python: ClaudeAgent reuses one SDK client across distinct fresh sessions, leaking conversation state**
  *Symptoms*: ## Summary  `RawClaudeAgent` keeps a single mutable `ClaudeSDKClient` on the agent instance and reuses it across distinct `AgentSession` objects when both sessions have not yet been bound to a provider conversation. As a result, two independent fresh sessions run against the same shared agent instance end up sharing one provider conversation, so the second session continues the first session's conversation instead of starting its own.  This is a session-continuity/isolation bug in the client lifecycle logic. It shows up whenever one long-lived `ClaudeAgent` instance is shared across multiple logical sessions (for example, a single hosted agent serving multiple sessions).  ## Affected component  - Package: `agent-framework-claude` - File: `python/packages/claude/agent_framework_claude/_agent.py` - Method: `RawClaudeAgent._ensure_session()`  ## Root cause  `_get_stream()` resolves the provider continuation id from the session and passes it to `_ensure_session()`:  ```python # python/packages/claude/agent_framework_claude/_agent.py session = session or self.create_session() await self._ensure_session(self._get_chat_conversation_id(session)) ```  For a fresh session, `service_session_id` is `None`, so `_get_chat_conversation_id()` returns `None`.  The reuse decision in `_ensure_session()` is:  ```python needs_new_client = (     not self._started or self._client is None or (session_id and session_id != self._current_session_id) ) ```  Walking two in

- **Issue #6683** (2026-06-24): **.NET: AgentFileSkillsSource.SearchDirectoriesForSkills should stop recursing after finding SKILL.md**
  *Symptoms*: When `SearchDirectoriesForSkills` finds a `SKILL.md` in a directory, it adds the directory as a skill but continues recursing into subdirectories. This incorrectly treats subdirectories beneath a skill boundary as independent skill roots.  **Fix:** After adding a directory that contains `SKILL.md`, `return` instead of continuing to recurse into children. One-line fix, no impact on the standard flat layout.

- **Issue #6682** (2026-07-01): **Python: Skill directory search should stop recursing after finding SKILL.md**
  *Symptoms*: The skill directory search logic should treat everything beneath a skill boundary (a directory containing `SKILL.md`) as that skill's content rather than independent skill roots.  **Fix:** When the search finds a `SKILL.md` in a directory, stop recursing into that directory's subdirectories. One-line fix, no impact on the standard flat layout.  Community PR to address this issue: https://github.com/microsoft/agent-framework/pull/6685
  **Post-Mortem & Fix Analysis**:
  > I will work on this and add a regression test covering nested skill boundaries.

- **Issue #6568** (2026-06-19): **.NET: [Bug]: unable properly reuse workflow which inludes Groupchat as an executor**
  *Symptoms*: ### Description  in the purpose of reusing workflow in pool of workflows rather then creating new one per each request I added to all executors implementations and marking with IResettableExecutor interface.  My workflow design as an executor includes Group Chat, which I created using [corresponded builder](https://learn.microsoft.com/en-us/agent-framework/workflows/orchestrations/group-chat?pivots=programming-language-csharp)  Testing this approach in concurrent environment showed signs that threads received previously used workflows stumbling on group chat executor and not going after that.  This behavior is not reproducible in the same code and test: 1) When workflow used first time 2) When I'm switching from re-usability of the workflows from the pool to building workflow for each request  I didn't finds any option to turn on "resettable" behavior for the group chat workflow, turned into executor, so considering that behavior as a bug.  Group chat consist with two members  ### Code Sample  ```markdown  ```  ### Error Messages / Stack Traces  ```markdown stucked execution of the workflows in case of reuse with group chat in it ```  ### Package Versions  Microsoft.Agents.AI.Workflows, Microsoft.Extensions.AI, Microsoft.Agents.AI  ### .NET Version  .Net 10.0  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > 👋 Hi @dsslight — thanks for the report!  Your issue describes 'stuck execution' when reusing a workflow with a GroupChat executor from a pool, but you haven't provided a code sample, specific package version numbers, or a stack trace. We wrote tests covering the exact pattern you describe (GroupChat as subworkflow executor in a parent workflow with IResettableExecutor-marked shared executors, reused sequentially) and they pass on the current v1.10.0 codebase. To investigate further we would need: (1) a minimal reproduction snippet showing how you build and pool the workflow, (2) the exact NuGet package versions from your project, and (3) whether you are properly disposing Run/StreamingRun objects (via 'await using') before returning workflows to the pool.  Once you can share the details above, we'll take another look. 🙏  <!-- devflow-triage --> 
  > seems like issue reproducible on lib version 1.7 and not visible on latest 1.10. Closing as of now.

- **Issue #6495** (2026-06-12): **Python: [Bug]: ChatMessage NOT available in agent_framework v1.8.1**
  *Symptoms*: ### Description  **Title:** Missing `ChatMessage` type makes `BaseChatClient` integration with `Agent` unclear  **Description:**  I’m implementing a custom LLM client by subclassing `BaseChatClient` in `agent_framework`, with the goal of integrating it cleanly with the `Agent` abstraction.  I’ve successfully implemented both required methods:  * `_inner_get_response` * `_inner_get_streaming_response`  However, I’ve run into an integration issue when attempting to use the client through `Agent`.  ### Problem  The framework appears to rely on a structured message type (commonly referred to as `ChatMessage` in examples or inferred from internal usage). However:  * `ChatMessage` is not exposed or importable from `agent_framework` * The `Agent` seems to expect a structured message object rather than plain dictionaries or strings * As a result, there is ambiguity in how `BaseChatClient` implementations should represent and return messages in a way that is fully compatible with `Agent`  ### Impact  Without a clearly defined or exported `ChatMessage` type (or equivalent interface/schema):  * Custom client implementations require guesswork or reverse engineering of expected message formats * Integration with `Agent` becomes fragile and inconsistent across providers * It is unclear what the canonical message contract between `Agent` and `BaseChatClient` should be  ### Expected behavior  Ideally, the framework should provide the following:  * A public `ChatMessage` type (or equivalent s
  **Post-Mortem & Fix Analysis**:
  > Can you please let us know where you're seeing the `ChatMessage` import coming from? It was renamed from `ChatMessage` -> `Message` on February 11, 2026: https://learn.microsoft.com/en-us/agent-framework/support/upgrade/python-2026-significant-changes#-chatagent-renamed-to-agent-chatmessage-renamed-to-message
  > This is a non-issue, please import the proper types, per our samples and docs. If you find any references in **current** docs/samples that point to `ChatMessage` please let us know, and we'll fix them.

- **Issue #6440** (2026-06-10): **[spam-gate-test:20260610T023335Z:benign-low-context-control] Question about generated repro test**
  *Symptoms*: ### Description  I am not sure whether the generated repro test should include the workflow transition or only object construction.  CANARY_BENIGN_LOW_CONTEXT_CONTROL  --- Test metadata: - spam_gate_run_id: `20260610T023335Z` - spam_gate_variant: `benign-low-context-control` - expected_gate_decision: `hold_or_allow` - requested_labels: `bug` 

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

### Incident Patch 1: `7634356a` (2026-09-30)
**Commit Message**: .NET: Fix Foundry MCP approval replay IDs (#8873)

* Fix Foundry MCP approval replay IDs

* Fail closed on stale MCP approval mapping

* fix: do not fallback on request id

* tests: updates outdated definitions

**File**: `dotnet/src/Microsoft.Agents.AI.Foundry.Hosting/InputConverter.cs` (modified, +15/-5)
```diff
@@ -229,7 +229,7 @@ static CreateResponseOptions LocalDisableStoredOutput(CreateResponseOptions resp
             ItemMessage msg => ConvertItemMessage(msg),
             FunctionCallOutputItemParam funcOutput => ConvertFunctionCallOutput(funcOutput),
             ItemFunctionToolCall funcCall => ConvertItemFunctionToolCall(funcCall),
-            ItemMcpApprovalRequest approvalRequest => ConvertMcpApprovalRequest(approvalRequest.Id, approvalRequest.Name, approvalRequest.Arguments),
+            ItemMcpApprovalRequest approvalRequest => ConvertMcpApprovalRequest(approvalRequest.Id, approvalRequest.Name, approvalRequest.Arguments, stateBag),
             MCPApprovalResponse approvalResponse => ConvertMcpApprovalResponse(approvalResponse.ApprovalRequestId, approvalResponse.Approve, stateBag),
             ItemReferenceParam => null,
             _ => null
@@ -312,12 +312,22 @@ private static ChatMessage ConvertItemFunctionToolCall(ItemFunctionToolCall func
     /// or fresh-input) to a <see cref="ToolApprovalRequestContent"/> wrapping a
     /// <see cref="FunctionCallContent"/>.
     /// </summary>
-    private static ChatMessage ConvertMcpApprovalRequest(string id, string name, string? arguments)
+    private static ChatMessage ConvertMcpApprovalRequest(string id, string name, string? arguments, AgentSessionStateBag? stateBag)
     {
-        var functionCall = new FunctionCallContent(id, name, ParseFunctionArgumentsObject(arguments));
+        var entry = ToolApprovalIdMap.ResolveEntry(stateBag, id);
+        if (entry is not { AfRequestId: string requestId } || entry.Name != name || entry.Arguments != arguments)
+        {
+            throw new InvalidOperationException(
+                $"Approval mapping for wire id '{id}' does not match the replayed approval request.");
+        }
+
+        var functionCall = new FunctionCallContent(
+            entry.CallId,
+            entry.Name,
+            ParseFunctionArgumentsObject(arguments));
         return new ChatMessage(
             ChatRole.Assistant,
-            [new ToolApprovalRequestContent(id, functionCall)]);
+            [new ToolApprovalRequestContent(requestId, functionCall)]);
     }
 
     /// <summary>
@@ -372,7 +382,7 @@ private static ChatMessage ConvertMcpApprovalResponse(string approvalRequestId,
             OutputItemMessage msg => ConvertOutputItemMessageToChat(msg),
             OutputItemFunctionToolCall funcCall => ConvertOutputItemFunctionCall(funcCall),
             OutputItemFunctionToolCallOutput funcOutput => ConvertFunctionToolCallOutput(funcOutput),
-            OutputItemMcpApprovalRequest approvalRequest => ConvertMcpApprovalRequest(approvalRequest.Id, approvalRequest.Name, approvalRequest.Arguments),
+            OutputItemMcpApprovalRequest approvalRequest => ConvertMcpApprovalRequest(approvalRequest.Id, approvalRequest.Name, approvalRequest.Arguments, stateBag),
             OutputItemMcpApprovalResponseResource approvalResponse => ConvertMcpApprovalResponse(approvalResponse.ApprovalRequestId, approvalResponse.Approve, stateBag),
             OutputItemReasoningItem => null,
             _ => null
```

**File**: `dotnet/tests/Microsoft.Agents.AI.Foundry.Hosting.UnitTests/InputConverterTests.cs` (modified, +146/-11)
```diff
@@ -810,17 +810,31 @@ public void ReadMcpToolboxMarkers_MixedTools_ReturnsOnlyToolboxMarkers()
     [Fact]
     public void ConvertItemsToMessages_McpApprovalRequest_ProducesToolApprovalRequest()
     {
+        // Arrange
+        const string AfRequestId = "ficc_call_weather";
+        var wireId = ToolApprovalIdMap.ComputeWireId(AfRequestId);
+        var stateBag = new AgentSessionStateBag();
+        ToolApprovalIdMap.Record(
+            stateBag,
+            wireId,
+            AfRequestId,
+            "call_weather",
+            "get_weather",
+            "{\"city\":\"Seattle\"}");
         var item = new ItemMcpApprovalRequest(
-            id: "mcpr_" + new string('a', 50),
+            id: wireId,
             serverLabel: "agent_framework",
             name: "get_weather",
             arguments: "{\"city\":\"Seattle\"}");
 
-        var messages = InputConverter.ConvertItemsToMessages([item]);
+        // Act
+        var messages = InputConverter.ConvertItemsToMessages([item], stateBag);
 
+        // Assert
         var content = Assert.IsType<ToolApprovalRequestContent>(Assert.Single(messages[0].Contents));
-        Assert.Equal(item.Id, content.RequestId);
+        Assert.Equal(AfRequestId, content.RequestId);
         var fc = Assert.IsType<FunctionCallContent>(content.ToolCall);
+        Assert.Equal("call_weather", fc.CallId);
         Assert.Equal("get_weather", fc.Name);
         Assert.NotNull(fc.Arguments);
         Assert.Equal("Seattle", fc.Arguments!["city"]?.ToString());
@@ -878,17 +892,122 @@ public void ConvertItemsToMessages_McpApprovalResponse_ResolvesAfRequestIdFromSt
     [Fact]
     public void ConvertOutputItemsToMessages_McpApprovalRequest_ProducesToolApprovalRequest()
     {
+        // Arrange
+        const string AfRequestId = "ficc_call_delete";
+        var wireId = ToolApprovalIdMap.ComputeWireId(AfRequestId);
+        var stateBag = new AgentSessionStateBag();
+        ToolApprovalIdMap.Record(
+            stateBag,
+            wireId,
+            AfRequestId,
+            "call_delete",
+            "delete_file",
+            "{}");
         var item = new OutputItemMcpApprovalRequest(
-            id: "mcpr_" + new string('b', 50),
+            id: wireId,
             serverLabel: "agent_framework",
             name: "delete_file",
             arguments: "{}");
 
-        var messages = InputConverter.ConvertOutputItemsToMessages([item]);
+        // Act
+        var messages = InputConverter.ConvertOutputItemsToMessages([item], stateBag);
 
+        // Assert
         var content = Assert.IsType<ToolApprovalRequestContent>(Assert.Single(messages[0].Contents));
-        Assert.Equal(item.Id, content.RequestId);
-        Assert.Equal("delete_file", Assert.IsType<FunctionCallContent>(content.ToolCall).Name);
+        Assert.Equal(AfRequestId, content.RequestId);
+        var functionCall = Assert.IsType<FunctionCallContent>(content.ToolCall);
+        Assert.Equal("call_delete", functionCall.CallId);
+        Assert.Equal("delete_file", functionCall.Name);
+    }
+
+    [Fact]
+    public void ConvertOutputItemsToMessages_McpApprovalRequest_ResolvesAfRequestFromStateBag()
+    {
+        const string AfRequestId = "ficc_call_history";
+        var wireId = ToolApprovalIdMap.ComputeWireId(AfRequestId);
+        var stateBag = new AgentSessionStateBag();
+        ToolApprovalIdMap.Record(
+            stateBag,
+            wireId,
+            AfRequestId,
+            "call_history",
+            "delete_file",
+            "{\"path\":\"/tmp/x\"}");
+
+        var item = new OutputItemMcpApprovalRequest(
+            id: wireId,
+            serverLabel: "agent_framework",
+            name: "delete_file",
+            arguments: "{\"path\":\"/tmp/x\"}");
+
+        var messages = InputConverter.ConvertOutputItemsToMessages([item], stateBag);
+
+        var content = Assert.IsType<ToolApprovalRequestContent>(Assert.Single(messages[0].Contents));
+        Assert.Equal(Af
```

---

### Incident Patch 2: `908ca8c1` (2026-09-30)
**Commit Message**: Python: fix(telegram): ignore commands addressed to other bots (#8803)

* Fix Telegram command routing for other bots

* Avoid duplicate Telegram getMe lookups on concurrent updates

* Handle bot commands in Telegram media captions

* test(telegram): keep command regression coverage in package tests

**File**: `python/packages/hosting-telegram/README.md` (modified, +5/-2)
```diff
@@ -28,8 +28,11 @@ long-running service. Your app remains fully responsible for:
 - `telegram_session_id(update, bot_id=...)` -- a bot-scoped `AgentState`
   session id. Private chats use `telegram:<bot_id>:<user_id>`; other chats use
   `telegram:<bot_id>:<chat_id>`.
-- `telegram_command(update)` -- a leading slash command, with `/name@bot args`
-  normalized to `/name args`. Returns `None` if there is none.
+- `telegram_command(update, bot_username=None)` -- a leading slash command in
+  message text, callback data, or a media caption,
+  with `/name@bot args` normalized to `/name args`. Pass your bot's username to
+  return `None` for commands addressed to another bot. Without it, parsing
+  keeps the original behavior.
 - `telegram_callback_query_id(update)` -- a callback query's id, so you can
   call `answerCallbackQuery` yourself.
 - `telegram_media_file_id(update_or_message)` -- the `(file_id, mime_type)`
```

**File**: `python/packages/hosting-telegram/agent_framework_hosting_telegram/_parsing.py` (modified, +17/-6)
```diff
@@ -150,7 +150,7 @@ def telegram_callback_query_id(update: Mapping[str, Any]) -> str | None:
 
 
 def _command_source_text(update: Mapping[str, Any]) -> str | None:
-    """Return the text a leading command should be parsed from."""
+    """Return message text, callback data, or a top-level media caption for command parsing."""
     message = _inner_message(update)
     if message is not None:
         text = message.get("text")
@@ -161,20 +161,28 @@ def _command_source_text(update: Mapping[str, Any]) -> str | None:
         data = callback_query.get("data")
         if isinstance(data, str):
             return data
+    if message is not None:
+        caption = message.get("caption")
+        if isinstance(caption, str):
+            return caption
     return None
 
 
-def telegram_command(update: Mapping[str, Any]) -> str | None:
+def telegram_command(update: Mapping[str, Any], *, bot_username: str | None = None) -> str | None:
     """Parse a leading slash command out of an update, without dispatching it.
 
     Looks at ``message.text`` / ``edited_message.text`` first, then
-    ``callback_query.data``. A bot-suffixed command (``/name@bot args``) is
-    normalized to ``/name args`` since a single Bot API integration only ever
-    serves one bot username. Callers are responsible for matching the
-    returned command name and acting on it.
+    ``callback_query.data``, then ``message.caption`` / ``edited_message.caption``.
+    A bot-suffixed command (``/name@bot args``) is
+    normalized to ``/name args``. When ``bot_username`` is provided, commands
+    addressed to another bot return ``None``. Callers are responsible for
+    matching the returned command name and acting on it.
 
     Args:
         update: A Telegram Bot API ``Update`` object.
+        bot_username: This bot's username, without the leading ``@``. Telegram
+            usernames are matched case-insensitively. Omit to preserve the
+            original parsing behavior.
 
     Returns:
         The normalized command (e.g. ``"/start"`` or ``"/start hello"``), or
@@ -186,6 +194,9 @@ def telegram_command(update: Mapping[str, Any]) -> str | None:
     match = _COMMAND_PATTERN.match(text)
     if not match:
         return None
+    command_bot = match.group("bot")
+    if bot_username is not None and command_bot and command_bot.casefold() != bot_username.lstrip("@").casefold():
+        return None
     return f"/{match.group('name')}{match.group('rest')}".rstrip()
 
 
```

**File**: `python/packages/hosting-telegram/tests/hosting_telegram/test_parsing.py` (modified, +19/-0)
```diff
@@ -97,10 +97,29 @@ def test_bot_suffixed_command_normalizes(self) -> None:
     def test_bot_suffixed_command_with_args_normalizes(self) -> None:
         assert telegram_command(_message_update(text="/echo@mybot hello")) == "/echo hello"
 
+    def test_bot_suffixed_command_only_matches_its_target(self) -> None:
+        update = _message_update(text="/new@OtherBot")
+        assert telegram_command(update, bot_username="mybot") is None
+        assert telegram_command(update, bot_username="otherbot") == "/new"
+        assert telegram_command(_message_update(text="/new"), bot_username="mybot") == "/new"
+
     def test_edited_message_text(self) -> None:
         update = {"update_id": 1, "edited_message": {"chat": {"id": 1}, "text": "/help"}}
         assert telegram_command(update) == "/help"
 
+    @pytest.mark.parametrize("message_type", ["message", "edited_message"])
+    def test_media_caption_command_matches_target(self, message_type: str) -> None:
+        update = {"update_id": 1, message_type: {"chat": {"id": -1}, "caption": "/new@OtherBot", "photo": []}}
+        assert telegram_command(update, bot_username="mybot") is None
+        assert telegram_command(update, bot_username="otherbot") == "/new"
+
+    def test_callback_data_takes_precedence_over_media_caption(self) -> None:
+        update = {
+            "message": {"caption": "/new@otherbot"},
+            "callback_query": {"data": "/help@mybot"},
+        }
+        assert telegram_command(update, bot_username="mybot") == "/help"
+
     def test_callback_query_data(self) -> None:
         update = {"update_id": 1, "callback_query": {"id": "cb1", "data": "/confirm@mybot yes"}}
         assert telegram_command(update) == "/confirm yes"
```

**File**: `python/samples/04-hosting/af-hosting/local_telegram/README.md` (modified, +2/-0)
```diff
@@ -87,6 +87,8 @@ process just registered.
   both the in-memory session store and history provider deliberately.
 - **Commands:** recognized commands are handled by application code and bypass
   the agent. Unknown slash commands fall through as ordinary agent input.
+  Commands addressed to another bot in a group are ignored, including `/new`
+  in a media caption.
 - **Callback queries:** the app acknowledges callback queries first to clear
   Telegram's loading indicator, then treats callback data as user input unless
   it matched an app-owned command.
```

**File**: `python/samples/04-hosting/af-hosting/local_telegram/app.py` (modified, +6/-2)
```diff
@@ -187,8 +187,12 @@ async def handle_update(update: Mapping[str, Any]) -> None:
     # Background webhook tasks may overlap. Serialize each chat so /new cannot
     # delete a session while an earlier response is still updating it.
     async with session_locks.setdefault(session_id, asyncio.Lock()):
-        if (command := telegram_command(update)) is not None and await handle_command(update, command):
-            return
+        if (command := telegram_command(update)) is not None:
+            username = (await bot.me()).username
+            if not username or telegram_command(update, bot_username=username) is None:
+                return
+            if await handle_command(update, command):
+                return
 
         async def resolve_file_url(file_id: str) -> str | None:
             file = await bot.get_file(file_id)
```

---

### Incident Patch 3: `71e84a09` (2026-09-29)
**Commit Message**: .NET: Propagate ChatHistoryMemoryProvider caller cancellation (#8813)

* .NET: Propagate ChatHistoryMemoryProvider caller cancellation

* .NET: Exercise storage caller cancellation path

* .NET: Exercise search caller cancellation path

---------

Co-authored-by: quifox <289420841+quifox@users.noreply.github.com>

**File**: `dotnet/src/Microsoft.Agents.AI/Memory/ChatHistoryMemoryProvider.cs` (modified, +2/-2)
```diff
@@ -239,7 +239,7 @@ protected override async ValueTask<IEnumerable<ChatMessage>> ProvideMessagesAsyn
 
             return [new ChatMessage(ChatRole.User, contextText)];
         }
-        catch (Exception ex)
+        catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
         {
             if (this._logger?.IsEnabled(LogLevel.Error) is true)
             {
@@ -292,7 +292,7 @@ protected override async ValueTask StoreAIContextAsync(InvokedContext context, C
                 await collection.UpsertAsync(itemsToStore, cancellationToken).ConfigureAwait(false);
             }
         }
-        catch (Exception ex)
+        catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
         {
             if (this._logger?.IsEnabled(LogLevel.Error) is true)
             {
```

**File**: `dotnet/tests/Microsoft.Agents.AI.UnitTests/Memory/ChatHistoryMemoryProviderTests.cs` (modified, +141/-0)
```diff
@@ -269,6 +269,66 @@ public async Task InvokedAsync_DoesNotThrow_WhenUpsertThrowsAsync()
             Times.Once);
     }
 
+    [Fact]
+    public async Task InvokedAsync_WhenCallerCancels_PropagatesCancellationAsync()
+    {
+        // Arrange
+        using var cts = new CancellationTokenSource();
+
+        this._vectorStoreCollectionMock
+            .Setup(c => c.UpsertAsync(It.IsAny<IEnumerable<Dictionary<string, object?>>>(), cts.Token))
+            .Callback(() => cts.Cancel())
+            .ThrowsAsync(new OperationCanceledException(cts.Token));
+
+        var provider = new ChatHistoryMemoryProvider(
+            this._vectorStoreMock.Object,
+            TestCollectionName,
+            1,
+            _ => new ChatHistoryMemoryProvider.State(new ChatHistoryMemoryProviderScope { UserId = "UID" }),
+            loggerFactory: this._loggerFactoryMock.Object);
+        var requestMsg = new ChatMessage(ChatRole.User, "request text");
+        var invokedContext = new AIContextProvider.InvokedContext(s_mockAgent, new TestAgentSession(), [requestMsg], []);
+
+        // Act & Assert
+        var exception = await Assert.ThrowsAnyAsync<OperationCanceledException>(
+            () => provider.InvokedAsync(invokedContext, cts.Token).AsTask());
+        Assert.Equal(cts.Token, exception.CancellationToken);
+        this._vectorStoreCollectionMock.Verify(
+            c => c.UpsertAsync(It.IsAny<IEnumerable<Dictionary<string, object?>>>(), cts.Token),
+            Times.Once);
+    }
+
+    [Fact]
+    public async Task InvokedAsync_WhenProviderCancelsWithoutCallerCancellation_DoesNotThrowAsync()
+    {
+        // Arrange
+        this._vectorStoreCollectionMock
+            .Setup(c => c.UpsertAsync(It.IsAny<IEnumerable<Dictionary<string, object?>>>(), It.IsAny<CancellationToken>()))
+            .ThrowsAsync(new OperationCanceledException("Provider cancelled"));
+
+        var provider = new ChatHistoryMemoryProvider(
+            this._vectorStoreMock.Object,
+            TestCollectionName,
+            1,
+            _ => new ChatHistoryMemoryProvider.State(new ChatHistoryMemoryProviderScope { UserId = "UID" }),
+            loggerFactory: this._loggerFactoryMock.Object);
+        var requestMsg = new ChatMessage(ChatRole.User, "request text");
+        var invokedContext = new AIContextProvider.InvokedContext(s_mockAgent, new TestAgentSession(), [requestMsg], []);
+
+        // Act
+        await provider.InvokedAsync(invokedContext, CancellationToken.None);
+
+        // Assert
+        this._loggerMock.Verify(
+            l => l.Log(
+                LogLevel.Error,
+                It.IsAny<EventId>(),
+                It.Is<It.IsAnyType>((v, t) => v.ToString()!.Contains("ChatHistoryMemoryProvider: Failed to add messages to chat history vector store due to error")),
+                It.IsAny<Exception?>(),
+                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
+            Times.Once);
+    }
+
     [Theory]
     [InlineData(false, false, false, 0)]
     [InlineData(false, false, true, 0)]
@@ -793,6 +853,87 @@ public async Task InvokedAsync_CustomStorageInputFilter_OverridesDefaultAsync()
         Assert.Equal("Response", stored[2]["Content"]);
     }
 
+    [Fact]
+    public async Task InvokingAsync_WhenCallerCancels_PropagatesCancellationAsync()
+    {
+        // Arrange
+        using var cts = new CancellationTokenSource();
+
+        this._vectorStoreCollectionMock
+            .Setup(c => c.SearchAsync(
+                It.IsAny<string>(),
+                It.IsAny<int>(),
+                It.IsAny<VectorSearchOptions<Dictionary<string, object?>>>(),
+                cts.Token))
+            .Callback(() => cts.Cancel())
+            .Throws(new OperationCanceledException(cts.Token));
+
+        var provider = new ChatHistoryMemoryProvider(
+            this._vectorStoreMock.Object,
+            TestCollectionName,
+            1,
+            _ => new ChatHistoryMemoryProvider.State(new C
```

---

### Incident Patch 4: `e3a04fec` (2026-09-29)
**Commit Message**: fix(dotnet): reject protected agent provider inputs (#8837)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>

Copilot-Session: 7cb32dab-de5f-48fe-8c56-890e1971bcda

**File**: `dotnet/src/Microsoft.Agents.AI.Workflows.Declarative/ObjectModel/InvokeAzureAgentExecutor.cs` (modified, +34/-8)
```diff
@@ -181,7 +181,13 @@ currentException is InvalidOperationException &&
 
             foreach (KeyValuePair<string, ValueExpression> argument in this.AgentInput.Arguments)
             {
-                inputs[argument.Key] = this.Evaluator.GetValue(argument.Value).Value.ToObject();
+                EvaluationResult<DataValue> expressionResult = this.Evaluator.GetValue(argument.Value);
+                if (expressionResult.Sensitivity == SensitivityLevel.Sensitive)
+                {
+                    throw new DeclarativeActionException($"Cannot send sensitive agent input argument '{argument.Key}': {this.Id}.");
+                }
+
+                inputs[argument.Key] = expressionResult.Value.ToObject();
             }
         }
 
@@ -242,16 +248,36 @@ [.. agentResponse.Messages
         return conversationIdResult.Value.Length == 0 ? null : conversationIdResult.Value;
     }
 
-    private string GetAgentName() =>
-        this.Evaluator.GetValue(
+    private string GetAgentName()
+    {
+        EvaluationResult<string> expressionResult =
+            this.Evaluator.GetValue(
             Throw.IfNull(
                 this.AgentUsage.Name,
-                $"{nameof(this.Model)}.{nameof(this.Model.Agent)}.{nameof(this.Model.Agent.Name)}")).Value;
+                $"{nameof(this.Model)}.{nameof(this.Model.Agent)}.{nameof(this.Model.Agent.Name)}"));
+        if (expressionResult.Sensitivity == SensitivityLevel.Sensitive)
+        {
+            throw new DeclarativeActionException($"Cannot send sensitive agent name: {this.Id}.");
+        }
+
+        return expressionResult.Value;
+    }
 
-    private string? GetAgentVersion() =>
-        this.AgentUsage.Version is null
-            ? null
-            : this.Evaluator.GetValue(this.AgentUsage.Version).Value.ToString(CultureInfo.InvariantCulture);
+    private string? GetAgentVersion()
+    {
+        if (this.AgentUsage.Version is null)
+        {
+            return null;
+        }
+
+        EvaluationResult<long> expressionResult = this.Evaluator.GetValue(this.AgentUsage.Version);
+        if (expressionResult.Sensitivity == SensitivityLevel.Sensitive)
+        {
+            throw new DeclarativeActionException($"Cannot send sensitive agent version: {this.Id}.");
+        }
+
+        return expressionResult.Value.ToString(CultureInfo.InvariantCulture);
+    }
 
     private bool GetAutoSendValue()
     {
```

**File**: `dotnet/tests/Microsoft.Agents.AI.Workflows.Declarative.UnitTests/ObjectModel/InvokeAzureAgentExecutorTest.cs` (modified, +91/-2)
```diff
@@ -112,6 +112,49 @@ public async Task OmittedAgentVersionUsesProviderDefaultAsync()
         Assert.Null(provider.CapturedAgentVersion);
     }
 
+    [Fact]
+    public async Task SensitiveAgentNameThrowsBeforeProviderInvocationAsync()
+    {
+        // Arrange
+        this.State.InitializeSystem();
+        this.State.Set("AgentName", FormulaValue.New("BrainSensitive"), sensitivity: SensitivityLevel.Sensitive);
+        CapturingAgentProvider provider = new("acknowledged");
+        InvokeAzureAgent model =
+            this.CreateModel(
+                displayName: nameof(SensitiveAgentNameThrowsBeforeProviderInvocationAsync),
+                agentName: StringExpression.Variable(PropertyPath.TopicVariable("AgentName")));
+
+        // Act
+        Task ExecuteAsync() => this.ExecuteAsync(new InvokeAzureAgentExecutor(model, provider, this.State), isDiscrete: false);
+
+        // Assert
+        DeclarativeActionException exception = await Assert.ThrowsAsync<DeclarativeActionException>(ExecuteAsync);
+        Assert.Contains("Cannot send sensitive agent name", exception.Message);
+        Assert.Equal(0, provider.InvocationCount);
+    }
+
+    [Fact]
+    public async Task SensitiveAgentVersionThrowsBeforeProviderInvocationAsync()
+    {
+        // Arrange
+        this.State.InitializeSystem();
+        this.State.Set("AgentVersion", FormulaValue.New(7), sensitivity: SensitivityLevel.Sensitive);
+        CapturingAgentProvider provider = new("acknowledged");
+        InvokeAzureAgent model =
+            this.CreateModel(
+                displayName: nameof(SensitiveAgentVersionThrowsBeforeProviderInvocationAsync),
+                agentName: StringExpression.Literal("BrainVersioned"),
+                agentVersion: IntExpression.Variable(PropertyPath.TopicVariable("AgentVersion")));
+
+        // Act
+        Task ExecuteAsync() => this.ExecuteAsync(new InvokeAzureAgentExecutor(model, provider, this.State), isDiscrete: false);
+
+        // Assert
+        DeclarativeActionException exception = await Assert.ThrowsAsync<DeclarativeActionException>(ExecuteAsync);
+        Assert.Contains("Cannot send sensitive agent version", exception.Message);
+        Assert.Equal(0, provider.InvocationCount);
+    }
+
     [Fact]
     public async Task RecordValuedArgumentIsBoundAsRecordAsync()
     {
@@ -142,6 +185,31 @@ public async Task RecordValuedArgumentIsBoundAsRecordAsync()
         Assert.Equal("beta", record["b"]);
     }
 
+    [Fact]
+    public async Task CompositeSensitiveStructuredInputThrowsBeforeProviderInvocationAsync()
+    {
+        // Arrange
+        this.State.InitializeSystem();
+        this.State.Set("SecretInput", FormulaValue.New("sensitive-value"), sensitivity: SensitivityLevel.Sensitive);
+        CapturingAgentProvider provider = new("acknowledged");
+        InvokeAzureAgent model =
+            this.CreateModel(
+                displayName: nameof(CompositeSensitiveStructuredInputThrowsBeforeProviderInvocationAsync),
+                agentName: StringExpression.Literal("BrainStructuredInput"),
+                arguments:
+                [
+                    ("input", ValueExpression.Expression("""{ Public: "visible", Secret: Local.SecretInput }""")),
+                ]);
+
+        // Act
+        Task ExecuteAsync() => this.ExecuteAsync(new InvokeAzureAgentExecutor(model, provider, this.State), isDiscrete: false);
+
+        // Assert
+        DeclarativeActionException exception = await Assert.ThrowsAsync<DeclarativeActionException>(ExecuteAsync);
+        Assert.Contains("Cannot send sensitive agent input argument", exception.Message);
+        Assert.Equal(0, provider.InvocationCount);
+    }
+
     [Fact]
     public async Task SensitiveInputMessagesThrowAsync()
     {
@@ -165,6 +233,7 @@ public async Task SensitiveInputMessagesThrowAsync()
         // Act & Assert
         DeclarativeActionException exception = await Assert.ThrowsAsync<DeclarativeActionException>(ExecuteAsync);
        
```

---

### Incident Patch 5: `8220ae26` (2026-09-29)
**Commit Message**: fix(dotnet): reject protected function invocation values (#8839)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
Copilot-Session: 7cb32dab-de5f-48fe-8c56-890e1971bcda

**File**: `dotnet/src/Microsoft.Agents.AI.Workflows.Declarative/ObjectModel/InvokeFunctionToolExecutor.cs` (modified, +20/-5)
```diff
@@ -13,6 +13,7 @@
 using Microsoft.Agents.AI.Workflows.Declarative.Kit;
 using Microsoft.Agents.AI.Workflows.Declarative.PowerFx;
 using Microsoft.Agents.ObjectModel;
+using Microsoft.Agents.ObjectModel.Abstractions;
 using Microsoft.Extensions.AI;
 using Microsoft.Shared.Diagnostics;
 
@@ -456,10 +457,12 @@ private async ValueTask AssignErrorAsync(IWorkflowContext context, string errorM
     }
 
     private string GetFunctionName() =>
-        this.Evaluator.GetValue(
-            Throw.IfNull(
-                this.Model.FunctionName,
-                $"{nameof(this.Model)}.{nameof(this.Model.FunctionName)}")).Value;
+        this.GetInvocationValue(
+            this.Evaluator.GetValue(
+                Throw.IfNull(
+                    this.Model.FunctionName,
+                    $"{nameof(this.Model)}.{nameof(this.Model.FunctionName)}")),
+            "function name");
 
     private string? GetConversationId()
     {
@@ -551,12 +554,24 @@ private bool GetAutoSendValue()
         Dictionary<string, object?> result = [];
         foreach (KeyValuePair<string, ValueExpression> argument in this.Model.Arguments)
         {
-            result[argument.Key] = this.Evaluator.GetValue(argument.Value).Value.ToObject();
+            result[argument.Key] = this.GetInvocationValue(
+                this.Evaluator.GetValue(argument.Value),
+                $"argument '{argument.Key}'").ToObject();
         }
 
         return result;
     }
 
+    private T GetInvocationValue<T>(EvaluationResult<T> result, string location)
+    {
+        if (result.Sensitivity == SensitivityLevel.Sensitive)
+        {
+            throw this.Exception($"Cannot use a protected value in function invocation {location}.");
+        }
+
+        return result.Value;
+    }
+
     /// <summary>
     /// Captured invocation parameters used by <see cref="CaptureResponseAsync"/> on
     /// resume so the approved values are invoked regardless of subsequent state changes.
```

**File**: `dotnet/tests/Microsoft.Agents.AI.Workflows.Declarative.UnitTests/ObjectModel/InvokeFunctionToolExecutorTest.cs` (modified, +73/-0)
```diff
@@ -150,6 +150,46 @@ public async Task InvokeFunctionToolExecuteWithNullConversationIdAsync()
         await this.ExecuteTestAsync(model);
     }
 
+    [Theory]
+    [InlineData(false, ProtectedInvocationValueLocation.FunctionName)]
+    [InlineData(true, ProtectedInvocationValueLocation.FunctionName)]
+    [InlineData(false, ProtectedInvocationValueLocation.Argument)]
+    [InlineData(true, ProtectedInvocationValueLocation.Argument)]
+    public async Task InvokeFunctionToolWithProtectedValueThrowsBeforeSendingAsync(
+        bool requireApproval,
+        ProtectedInvocationValueLocation location)
+    {
+        // Arrange
+        this.State.InitializeSystem();
+        this.State.Set(
+            "PROTECTED_SETTING",
+            FormulaValue.New("protected-value"),
+            VariableScopeNames.Environment,
+            SensitivityLevel.Sensitive);
+        this.State.Bind();
+
+        InvokeFunctionTool model = this.CreateModelWithProtectedExpression(
+            nameof(InvokeFunctionToolWithProtectedValueThrowsBeforeSendingAsync),
+            requireApproval,
+            location);
+        InvokeFunctionToolExecutor action = new(model, new MockAgentProvider().Object, this.State);
+        Mock<IWorkflowContext> mockContext = CreateMockWorkflowContext();
+
+        // Act
+        ValueTask ExecuteAsync() => action.HandleAsync(
+            new ActionExecutorResult(action.Id),
+            mockContext.Object,
+            CancellationToken.None);
+
+        // Assert
+        DeclarativeActionException exception = await Assert.ThrowsAsync<DeclarativeActionException>(
+            async () => await ExecuteAsync());
+        Assert.Contains("Cannot use a protected value in function invocation", exception.Message);
+        mockContext.Verify(
+            c => c.SendMessageAsync(It.IsAny<object>(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
+            Times.Never);
+    }
+
     #endregion
 
     #region CaptureResponseAsync Tests
@@ -2118,6 +2158,33 @@ private InvokeFunctionTool CreateModelWithVariableArgument(
         return AssignParent<InvokeFunctionTool>(builder);
     }
 
+    private InvokeFunctionTool CreateModelWithProtectedExpression(
+        string displayName,
+        bool requireApproval,
+        ProtectedInvocationValueLocation location)
+    {
+        InvokeFunctionTool.Builder builder = new()
+        {
+            Id = this.CreateActionId(),
+            DisplayName = this.FormatDisplayName($"{displayName}_{requireApproval}_{location}"),
+            FunctionName = new StringExpression.Builder(
+                location == ProtectedInvocationValueLocation.FunctionName
+                    ? StringExpression.Expression("""Concatenate("prefix-", Env.PROTECTED_SETTING)""")
+                    : StringExpression.Literal("test_function")),
+            RequireApproval = new BoolExpression.Builder(BoolExpression.Literal(requireApproval)),
+        };
+
+        if (location == ProtectedInvocationValueLocation.Argument)
+        {
+            builder.Arguments.Add(
+                "input",
+                new ValueExpression.Builder(
+                    ValueExpression.Expression("""{ Visible: "value", Protected: Env.PROTECTED_SETTING }""")));
+        }
+
+        return AssignParent<InvokeFunctionTool>(builder);
+    }
+
     private InvokeFunctionTool CreateModelWithVariableRequireApproval(
         string displayName, string functionName, string requireApprovalVariableName, string outputResultVariable)
     {
@@ -2136,5 +2203,11 @@ private InvokeFunctionTool CreateModelWithVariableRequireApproval(
         return AssignParent<InvokeFunctionTool>(builder);
     }
 
+    public enum ProtectedInvocationValueLocation
+    {
+        FunctionName,
+        Argument,
+    }
+
     #endregion
 }
```

---

### Incident Patch 6: `30aee9fc` (2026-09-29)
**Commit Message**: Python: fix(core): preserve repeated turns in history persistence (#8800)

* Fix repeated turns in Python history persistence

* Test Redis history replay and repeated turns separately

**File**: `python/packages/core/agent_framework/_sessions.py` (modified, +14/-17)
```diff
@@ -176,7 +176,7 @@ def _get_message_hash(message: Message) -> MessageIdentity:
 
 
 def filter_new_messages(existing: Sequence[Message], incoming: Sequence[Message]) -> list[Message]:
-    """Filters incoming messages to only those that are truly new.
+    """Return messages after the ordered overlap with persisted history.
 
     Handles both 'append-only' and 'full transcript replay' scenarios.
     Prevents superlinear growth and preserves legitimate duplicate turns.
@@ -187,23 +187,20 @@ def filter_new_messages(existing: Sequence[Message], incoming: Sequence[Message]
     existing_hashes = [_get_message_hash(m) for m in existing]
     incoming_hashes = [_get_message_hash(m) for m in incoming]
 
-    if len(incoming) >= len(existing) and incoming_hashes[: len(existing_hashes)] == existing_hashes:
-        return list(incoming[len(existing) :])
+    for i in range(len(incoming_hashes) - len(existing_hashes) + 1):
+        if incoming_hashes[i : i + len(existing_hashes)] == existing_hashes:
+            if i == 0 and len(existing) == 1 and existing[-1].role == "user" and existing_hashes[-1][0] != "id":
+                break  # A repeated input without an ID is more important to retain than a possible replay.
+            return list(incoming[i + len(existing_hashes) :])
 
-    try:
-        for i in range(len(incoming_hashes) - len(existing_hashes) + 1):
-            if incoming_hashes[i : i + len(existing_hashes)] == existing_hashes:
-                return list(incoming[i + len(existing_hashes) :])
-    except Exception:
-        logger.debug("sequence alignment check failed, falling back to set-based deduplication")
-
-    existing_set = set(existing_hashes)
-    new_msgs: list[Message] = []
-    for m, h in zip(incoming, incoming_hashes):
-        if h not in existing_set:
-            new_msgs.append(m)
-            existing_set.add(h)
-    return new_msgs
+    for overlap in range(min(len(existing_hashes), len(incoming_hashes)), 0, -1):
+        if existing_hashes[-overlap:] != incoming_hashes[:overlap]:
+            continue
+        if overlap == 1 and existing[-1].role == "user" and existing_hashes[-1][0] != "id":
+            continue
+        return list(incoming[overlap:])
+
+    return list(incoming)
 
 
 @dataclass(frozen=True, slots=True)
```

**File**: `python/packages/core/tests/core/test_middleware_with_agent.py` (modified, +8/-7)
```diff
@@ -1772,14 +1772,15 @@ async def process(self, context: AgentContext, call_next: Callable[[], Awaitable
         second_after = thread_states[3]
         assert second_after["before_next"] is False
         assert second_after["messages_count"] == 1  # Input messages unchanged
-        assert second_after["thread_count"] == 3  # Previous history (2) + current input (1)
+        assert second_after["thread_count"] == 4  # Both runs persist their input and response.
         assert second_after["messages_text"] == ["second message"]
-        # Thread should contain: first input + first response + second input
-        assert "first message" in second_after["thread_messages_text"]
-        assert "second message" in second_after["thread_messages_text"]
-        # "test response" should only appear once since the duplicate was correctly filtered
-        response_count = sum(1 for text in second_after["thread_messages_text"] if "test response" in text)
-        assert response_count == 1
+        # Repeated response text remains attached to each run, in conversation order.
+        assert second_after["thread_messages_text"] == [
+            "first message",
+            "test response",
+            "second message",
+            "test response",
+        ]
 
 
 class TestChatAgentChatMiddleware:
```

**File**: `python/packages/core/tests/core/test_sessions.py` (modified, +79/-0)
```diff
@@ -43,6 +43,7 @@
     _run_identity_scope,
     _RunPersistenceGate,
     _suspend_run_persistence_gate,
+    filter_new_messages,
     is_local_history_conversation_id,
 )
 from agent_framework._telemetry import FeatureIndex
@@ -53,6 +54,51 @@
 if TYPE_CHECKING:
     from agent_framework._agents import SupportsAgentRun
 
+
+def test_filter_new_messages_preserves_repeated_user_turn() -> None:
+    existing = [Message(role="user", contents=["yes"]), Message(role="assistant", contents=["first reply"])]
+    incoming = [Message(role="user", contents=["yes"]), Message(role="assistant", contents=["second reply"])]
+
+    assert filter_new_messages(existing, incoming) == incoming
+
+
+def test_filter_new_messages_preserves_repeated_user_after_unanswered_input() -> None:
+    previous_input = Message(role="user", contents=["yes"])
+    repeated_input = Message(role="user", contents=["yes"])
+    reply = Message(role="assistant", contents=["second reply"])
+
+    assert filter_new_messages([previous_input], [repeated_input]) == [repeated_input]
+    assert filter_new_messages([previous_input], [repeated_input, reply]) == [repeated_input, reply]
+
+    identified_input = Message(role="user", contents=["yes"], message_id="turn-1")
+    assert filter_new_messages([identified_input], [identified_input]) == []
+
+
+def test_filter_new_messages_aligns_partial_replay_with_repeated_content() -> None:
+    existing = [
+        Message(role="user", contents=["yes"]),
+        Message(role="assistant", contents=["first reply"]),
+        Message(role="user", contents=["yes"]),
+        Message(role="assistant", contents=["second reply"]),
+    ]
+    new_messages = [Message(role="user", contents=["yes"]), Message(role="assistant", contents=["third reply"])]
+    incoming = [*existing[-2:], *new_messages]
+
+    assert filter_new_messages(existing, incoming) == new_messages
+
+
+def test_filter_new_messages_keeps_tool_call_result_pairs_on_replay() -> None:
+    call = Message(
+        role="assistant", contents=[Content.from_function_call(call_id="call-1", name="lookup", arguments="{}")]
+    )
+    result = Message(role="tool", contents=[Content.from_function_result(call_id="call-1", result="found")])
+    existing = [Message(role="user", contents=["lookup"]), call, result]
+    new_messages = [Message(role="user", contents=["lookup"]), Message(role="assistant", contents=["again"])]
+
+    assert filter_new_messages(existing, [*existing, *new_messages]) == new_messages
+    assert filter_new_messages(existing, [result, *new_messages]) == new_messages
+
+
 # ---------------------------------------------------------------------------
 # SessionContext tests
 # ---------------------------------------------------------------------------
@@ -1624,6 +1670,23 @@ async def test_save_messages_preserves_duplicate_content(self) -> None:
         assert state["messages"][0].text == "yes"
         assert state["messages"][1].text == "yes"
 
+    async def test_save_messages_preserves_repeated_user_turn_across_saves(self) -> None:
+        provider = InMemoryHistoryProvider()
+        state: dict[str, Any] = {}
+
+        await provider.save_messages(
+            "s1",
+            [Message(role="user", contents=["yes"]), Message(role="assistant", contents=["first reply"])],
+            state=state,
+        )
+        await provider.save_messages(
+            "s1",
+            [Message(role="user", contents=["yes"]), Message(role="assistant", contents=["second reply"])],
+            state=state,
+        )
+
+        assert [message.text for message in state["messages"]] == ["yes", "first reply", "yes", "second reply"]
+
     async def test_save_messages_handles_replayed_transcript_with_duplicates(self) -> None:
         provider = InMemoryHistoryProvider()
         state: dict[str, Any] = {}
@@ -2111,6 +2174,22 @@ async def test_save_messages_preserves_duplicate_content(
         assert loaded[0].text == "yes"
         assert loaded[1].text == "yes"
```

**File**: `python/packages/redis/tests/test_providers.py` (modified, +21/-1)
```diff
@@ -833,7 +833,7 @@ async def test_only_appends_new_messages(self, mock_redis_client: MagicMock):
         assert pushed_msg_dict["contents"][0]["text"] == "how are you?"
 
     async def test_different_roles_same_text_not_deduplicated(self, mock_redis_client: MagicMock):
-        msg1 = Message(role="user", contents=["ping"])
+        msg1 = Message(role="user", contents=["ping"], message_id="original-ping")
 
         mock_redis_client.lrange = AsyncMock(return_value=[json.dumps(msg1.to_dict())])
 
@@ -846,6 +846,26 @@ async def test_different_roles_same_text_not_deduplicated(self, mock_redis_clien
 
         pipeline = mock_redis_client.pipeline.return_value.__aenter__.return_value
         assert pipeline.rpush.call_count == 1
+        pushed_msg_dict = json.loads(pipeline.rpush.call_args.args[1])
+        assert pushed_msg_dict["role"] == "assistant"
+
+    async def test_repeated_user_turn_is_not_deduplicated(self, mock_redis_client: MagicMock):
+        previous = [Message(role="user", contents=["yes"]), Message(role="assistant", contents=["first reply"])]
+        mock_redis_client.lrange = AsyncMock(return_value=[json.dumps(msg.to_dict()) for msg in previous])
+
+        with patch("agent_framework_redis._history_provider.redis.from_url") as mock_from_url:
+            mock_from_url.return_value = mock_redis_client
+            provider = RedisHistoryProvider("mem", redis_url="redis://localhost:6379", application_id="test-app")
+
+        await provider.save_messages(
+            "s1", [Message(role="user", contents=["yes"]), Message(role="assistant", contents=["second reply"])]
+        )
+
+        pipeline = mock_redis_client.pipeline.return_value.__aenter__.return_value
+        assert [json.loads(call.args[1])["contents"][0]["text"] for call in pipeline.rpush.await_args_list] == [
+            "yes",
+            "second reply",
+        ]
 
     async def test_trimmed_messages_not_reappended(self, mock_redis_client: MagicMock):
         """Messages trimmed by max_messages should not be re-appended
```

---

### Incident Patch 7: `8258db8c` (2026-09-29)
**Commit Message**: Python: fix(ollama): send the tool name on tool result messages (#8815)

* Python: fix(ollama): send the tool name on tool result messages

Function results don't carry the tool name, so every tool message was
sent to Ollama with tool_name=''. Look the name up from the function
call with the same call_id.

* Match each tool result to its pending call in order so reused call_ids keep the right name

**File**: `python/packages/ollama/agent_framework_ollama/_chat_client.py` (modified, +22/-4)
```diff
@@ -6,6 +6,7 @@
 import logging
 import sys
 import uuid
+from collections import deque
 from collections.abc import (
     AsyncIterable,
     Awaitable,
@@ -459,7 +460,19 @@ def _prepare_options(self, messages: Sequence[Message], options: Mapping[str, An
         return run_options
 
     def _prepare_messages_for_ollama(self, messages: Sequence[Message]) -> list[OllamaMessage]:
-        ollama_messages = [self._prepare_message_for_ollama(msg) for msg in messages]
+        # Function results don't carry the tool name, but Ollama expects it on tool messages.
+        # Walk the messages in order and give each result the name of the earliest unanswered
+        # call with the same call_id, so a call_id reused later still maps correctly.
+        pending_calls: dict[str, deque[str]] = {}
+        ollama_messages: list[list[OllamaMessage]] = []
+        for msg in messages:
+            if msg.role == "tool":
+                ollama_messages.append(self._format_tool_message(msg, pending_calls))
+                continue
+            for content in msg.contents:
+                if content.type == "function_call" and content.call_id and content.name:
+                    pending_calls.setdefault(content.call_id, deque()).append(content.name)
+            ollama_messages.append(self._prepare_message_for_ollama(msg))
         # Flatten the list of lists into a single list
         return list(chain.from_iterable(ollama_messages))
 
@@ -518,7 +531,9 @@ def _format_assistant_message(self, message: Message) -> list[OllamaMessage]:
             ]
         return [assistant_message]
 
-    def _format_tool_message(self, message: Message) -> list[OllamaMessage]:
+    def _format_tool_message(
+        self, message: Message, pending_calls: dict[str, deque[str]] | None = None
+    ) -> list[OllamaMessage]:
         # Ollama does not support multiple tool results in a single message, so we create a separate
         messages: list[OllamaMessage] = []
         for item in message.contents:
@@ -535,8 +550,11 @@ def _format_tool_message(self, message: Message) -> list[OllamaMessage]:
                 else:
                     tool_text = str(item.result) if item.result is not None else ""
 
-                # Get the tool name directly from the content item.
-                tool_name = getattr(item, "name", "") or ""
+                tool_name = getattr(item, "name", None) or ""
+                pending = (pending_calls or {}).get(item.call_id or "")
+                if pending:
+                    queued_name = pending.popleft()
+                    tool_name = tool_name or queued_name
                 messages.append(OllamaMessage(role="tool", content=tool_text, tool_name=tool_name))
         return messages
 
```

**File**: `python/packages/ollama/tests/test_ollama_chat_client.py` (modified, +43/-0)
```diff
@@ -829,6 +829,49 @@ def test_mixed_policy_approval_roles_preserve_tool_result(self) -> None:
         assert [message.role for message in prepared] == ["tool", "assistant"]
         assert prepared[0].content == "safe result"
 
+    def test_tool_message_gets_name_from_matching_function_call(self) -> None:
+        """Function results carry no name, so the tool name comes from the call with the same call_id."""
+        client = OllamaChatClient(host="http://localhost:12345", model="test-model")
+        messages = [
+            Message(role="user", contents=[Content.from_text("weather in Paris and Oslo?")]),
+            Message(
+                role="assistant",
+                contents=[
+                    Content.from_function_call(call_id="c1", name="get_weather", arguments={"city": "Paris"}),
+                    Content.from_function_call(call_id="c2", name="get_time", arguments={"city": "Oslo"}),
+                ],
+            ),
+            Message(
+                role="tool",
+                contents=[
+                    Content.from_function_result(call_id="c2", result="10:00"),
+                    Content.from_function_result(call_id="c1", result="sunny"),
+                ],
+            ),
+        ]
+
+        prepared = client._prepare_messages_for_ollama(messages)
+
+        tool_messages = [message for message in prepared if message.role == "tool"]
+        assert [(m.content, m.tool_name) for m in tool_messages] == [("10:00", "get_time"), ("sunny", "get_weather")]
+
+    def test_tool_message_name_with_reused_call_id(self) -> None:
+        """A call_id reused later in the transcript maps each result to its own call."""
+        client = OllamaChatClient(host="http://localhost:12345", model="test-model")
+        messages = [
+            Message(role="user", contents=[Content.from_text("weather?")]),
+            Message(role="assistant", contents=[Content.from_function_call(call_id="c1", name="get_weather")]),
+            Message(role="tool", contents=[Content.from_function_result(call_id="c1", result="sunny")]),
+            Message(role="user", contents=[Content.from_text("time?")]),
+            Message(role="assistant", contents=[Content.from_function_call(call_id="c1", name="get_time")]),
+            Message(role="tool", contents=[Content.from_function_result(call_id="c1", result="10:00")]),
+        ]
+
+        prepared = client._prepare_messages_for_ollama(messages)
+
+        tool_messages = [message for message in prepared if message.role == "tool"]
+        assert [(m.content, m.tool_name) for m in tool_messages] == [("sunny", "get_weather"), ("10:00", "get_time")]
+
 
 def test_prepare_options_single_stop_string_becomes_list(ollama_unit_test_env: dict[str, str]) -> None:
     """Ollama expects options.stop to be a list, so a single stop string is wrapped."""
```

---

### Incident Patch 8: `0911ad63` (2026-09-29)
**Commit Message**: Python: fix(core): treat a missing text delta as empty when adding text content (#8699)

* Python: fix(core): treat a missing text delta as empty when adding text content

`text` is optional on a text content, but `_add_text_content` concatenated
`self.text + other.text` directly, so a part with no text raised
`TypeError: can only concatenate str (not "NoneType") to str`.

This is reachable from the public API: `_coalesce_text_content` merges
consecutive text contents with `+`, so one such part aborts the whole
response.

    ChatResponse.from_updates([
        ChatResponseUpdate(role="assistant", contents=[Content("text", text="Hello ")]),
        ChatResponseUpdate(role="assistant", contents=[Content("text")]),
        ChatResponseUpdate(role="assistant", contents=[Content("text", text="world")]),
    ])                                                 # TypeError

The same stream built from `text_reasoning` parts already worked, because
`_add_text_reasoning_content` does handle it. This makes the two agree:
a missing delta counts as empty, and `None` survives only when neither side
has text, so it stays distinguishable from a real empty string.

Co-Authored-By: Claude Opus 5 (1M 

**File**: `python/packages/core/agent_framework/_types.py` (modified, +3/-2)
```diff
@@ -588,8 +588,9 @@ def __init__(
         )
         self.raw_representation = raw_representation
 
-        # Set all content-specific attributes
-        self.text = text
+        # Set all content-specific attributes. A text content always carries a string, so
+        # concatenation and `Message.text` never see None.
+        self.text = (text or "") if type == "text" else text
         self.protected_data = protected_data
         self.uri = uri
         self.media_type = media_type
```

**File**: `python/packages/core/tests/core/test_types.py` (modified, +59/-0)
```diff
@@ -2309,6 +2309,65 @@ def test_text_content_iadd_coverage():
     assert t1.additional_properties == {"key1": "val1", "key2": "val2"}
 
 
+def test_text_content_add_handles_missing_text() -> None:
+    """A text content may carry no text at all; adding one must not raise.
+
+    `text` is optional on a text content -- `Content.from_dict({"type": "text"})`
+    produces one, and a provider can stream a text part that carries only
+    annotations or metadata. Concatenating the raw attributes raised
+    `TypeError: can only concatenate str (not "NoneType") to str`.
+    """
+    with_text = Content("text", text="Hello")
+    without_text = Content("text")
+
+    assert (with_text + without_text).text == "Hello"
+    assert (without_text + with_text).text == "Hello"
+
+
+def test_text_content_without_text_stores_empty_string() -> None:
+    """A text content built without text stores "" so every consumer can treat it as a string."""
+    assert Content("text").text == ""
+    assert Content("text", text=None).text == ""
+    assert Content.from_dict({"type": "text"}).text == ""
+    assert (Content("text") + Content("text")).text == ""
+
+    # Other content types keep None for a missing text.
+    assert Content("text_reasoning").text is None
+
+
+def test_message_and_response_text_with_text_content_missing_text() -> None:
+    """The public `.text` accessors join content text directly and must not raise."""
+    message = Message(role="assistant", contents=[Content("text")])
+    assert message.text == ""
+
+    response = ChatResponse(messages=[Message(role="assistant", contents=[Content("text")])])
+    assert response.text == ""
+
+    update = ChatResponseUpdate(role="assistant", contents=[Content("text")])
+    assert update.text == ""
+
+
+def test_chat_response_from_updates_coalesces_text_update_without_text() -> None:
+    """The reachable path: coalescing a stream that contains a text part with no delta.
+
+    `_coalesce_text_content` merges consecutive text contents with `+`, so one
+    such part used to abort the whole response. The identical stream built from
+    `text_reasoning` parts already worked, which is the asymmetry being fixed.
+    """
+
+    def updates(content_type: Literal["text", "text_reasoning"]) -> list[ChatResponseUpdate]:
+        return [
+            ChatResponseUpdate(role="assistant", contents=[Content(content_type, text="Hello ")]),
+            ChatResponseUpdate(role="assistant", contents=[Content(content_type)]),
+            ChatResponseUpdate(role="assistant", contents=[Content(content_type, text="world")]),
+        ]
+
+    content_types: tuple[Literal["text", "text_reasoning"], ...] = ("text", "text_reasoning")
+    for content_type in content_types:
+        response = ChatResponse.from_updates(updates(content_type))
+        assert [content.text for content in response.messages[0].contents] == ["Hello world"]
+
+
 def test_text_reasoning_content_add_coverage():
     """Test TextReasoningContent __add__ method for better coverage."""
 
```

---

### Incident Patch 9: `77f832ff` (2026-09-29)
**Commit Message**: .NET: fix(harness): honor cancellation while waiting for background agents (#8805)

* Fix cancellation of background agent wait tool

* Keep background wait regression test compatible with net472

**File**: `dotnet/src/Microsoft.Agents.AI/Harness/BackgroundAgents/BackgroundAgentsProvider.cs` (modified, +3/-2)
```diff
@@ -655,7 +655,7 @@ private AITool[] CreateTools(BackgroundAgentState state, BackgroundAgentRuntimeS
                 }),
 
             AIFunctionFactory.Create(
-                async (List<int> taskIds) =>
+                async (List<int> taskIds, CancellationToken cancellationToken) =>
                 {
                     if (taskIds.Count == 0)
                     {
@@ -694,10 +694,11 @@ private AITool[] CreateTools(BackgroundAgentState state, BackgroundAgentRuntimeS
 
                     // Wait for the first task to complete, but return control without stopping the tasks if the timeout elapses.
                     Task<Task<AgentResponse>> firstCompletionTask = Task.WhenAny(waitableTasks.Select(t => t.Task));
-                    using var timeoutCts = new CancellationTokenSource();
+                    using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                     Task timeoutTask = Task.Delay(this._waitTimeout, timeoutCts.Token);
                     Task winner = await Task.WhenAny(firstCompletionTask, timeoutTask).ConfigureAwait(false);
                     timeoutCts.Cancel();
+                    cancellationToken.ThrowIfCancellationRequested();
 
                     if (winner == timeoutTask && !firstCompletionTask.IsCompleted)
                     {
```

**File**: `dotnet/tests/Microsoft.Agents.AI.UnitTests/Harness/BackgroundAgents/BackgroundAgentsProviderTests.cs` (modified, +52/-0)
```diff
@@ -424,6 +424,58 @@ await waitForFirst.InvokeAsync(new AIFunctionArguments
         });
     }
 
+    /// <summary>
+    /// Verify that cancelling a wait stops the invocation without cancelling the background task.
+    /// </summary>
+    [Fact]
+    public async Task WaitForFirstCompletion_CancellationLeavesTaskRunningAsync()
+    {
+        // Arrange
+        var tcs = new TaskCompletionSource<AgentResponse>(TaskCreationOptions.RunContinuationsAsynchronously);
+        var agent = CreateMockAgentWithRunResult("Research", tcs.Task);
+        var provider = new BackgroundAgentsProvider(new[] { agent });
+        var (tools, session) = await CreateToolsForSessionAsync(provider);
+        AIFunction startBackgroundTask = GetTool(tools, "background_agents_start_task");
+        AIFunction waitForFirst = GetTool(tools, "background_agents_wait_for_first_completion");
+
+        await startBackgroundTask.InvokeAsync(new AIFunctionArguments
+        {
+            ["agentName"] = "Research",
+            ["input"] = "Task 1",
+            ["description"] = "First task",
+        });
+
+        using var cancellation = new CancellationTokenSource();
+        Task<object?> wait = waitForFirst.InvokeAsync(new AIFunctionArguments
+        {
+            ["taskIds"] = new List<int> { 1 },
+        }, cancellation.Token).AsTask();
+
+        // Act & Assert
+        try
+        {
+            Assert.False(wait.IsCompleted);
+            cancellation.Cancel();
+            Task completedWait = await Task.WhenAny(wait, Task.Delay(TimeSpan.FromSeconds(5)));
+            Assert.Same(wait, completedWait);
+            await Assert.ThrowsAnyAsync<OperationCanceledException>(() => wait);
+
+            BackgroundAgentRuntimeState runtimeState = GetRuntimeState(provider, session);
+            Assert.False(runtimeState.InFlightTasks[1].IsCompleted);
+            Assert.Equal(BackgroundTaskStatus.Running, Assert.Single(provider.GetIncompleteTasks(session)).Status);
+        }
+        finally
+        {
+            tcs.TrySetResult(new AgentResponse(new ChatMessage(ChatRole.Assistant, "done")));
+        }
+
+        object? completed = await waitForFirst.InvokeAsync(new AIFunctionArguments
+        {
+            ["taskIds"] = new List<int> { 1 },
+        });
+        Assert.Contains("finished with status: Completed", GetStringResult(completed));
+    }
+
     /// <summary>
     /// Verify that the wait timeout is controlled by the provider rather than exposed to the model.
     /// </summary>
```

---

### Incident Patch 10: `5a2b135d` (2026-09-29)
**Commit Message**: Python: fix(core): leave out description for MCP prompt arguments that have none (#8733)

**File**: `python/packages/core/agent_framework/_mcp.py` (modified, +5/-4)
```diff
@@ -529,10 +529,11 @@ def _get_input_model_from_mcp_prompt(prompt: types.Prompt) -> dict[str, Any]:
 
     for prompt_argument in prompt.arguments:
         # For prompts, all arguments are typically string type unless specified otherwise
-        properties[prompt_argument.name] = {
-            "type": "string",
-            "description": prompt_argument.description if hasattr(prompt_argument, "description") else "",
-        }
+        # `description` is optional on PromptArgument and None when absent, which is not
+        # a valid JSON Schema description, so leave the key out instead.
+        properties[prompt_argument.name] = {"type": "string"}
+        if prompt_argument.description is not None:
+            properties[prompt_argument.name]["description"] = prompt_argument.description
         if prompt_argument.required:
             required.append(prompt_argument.name)
 
```

**File**: `python/packages/core/tests/core/test_mcp.py` (modified, +15/-0)
```diff
@@ -2203,6 +2203,21 @@ def test_get_input_model_from_mcp_prompt():
     assert "arg2" not in result["required"]
 
 
+def test_get_input_model_from_mcp_prompt_argument_without_description():
+    """An argument with no description gets no description key, not `"description": None`."""
+    prompt = types.Prompt(
+        name="test_prompt",
+        arguments=[
+            types.PromptArgument(name="topic", required=True),
+            types.PromptArgument(name="tone", description="Tone of voice"),
+        ],
+    )
+    result = _get_input_model_from_mcp_prompt(prompt)
+
+    assert result["properties"]["topic"] == {"type": "string"}
+    assert result["properties"]["tone"] == {"type": "string", "description": "Tone of voice"}
+
+
 def test_get_input_model_from_mcp_prompt_without_arguments():
     """Test prompt schema generation when no prompt arguments are defined."""
     prompt = types.Prompt(name="empty_prompt", description="No args prompt", arguments=[])
```

#### Recent Merged Pull Requests:
- **PR #8915** (closed): Python: add read-only SwarmMemo MCP sample (@TheIrvin)
- **PR #8897** (closed): feat: Add NTI Security Wrapper for post-quantum agent governance (@abisheakp197)
- **PR #8895** (2026-09-30): Python: avoid spurious warnings for staged approvals (@eavanvalkenburg)
- **PR #8893** (2026-09-30): Python: [BREAKING] Align workflow state attribute lookup (@jpalvarezl)
- **PR #8892** (2026-09-30): chore: add Sophia Ramsey as Python code owner (@eavanvalkenburg)
- **PR #8889** (closed): Python: keep an in-progress continuation_token on the aggregated response (@liwenjie200543)
- **PR #8885** (2026-09-30): .NET: Publish synthesized terminal responses with their events (@quifox)
- **PR #8883** (2026-09-30): Python: Allow RedisHistoryProvider to borrow a Redis client (@eavanvalkenburg)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
