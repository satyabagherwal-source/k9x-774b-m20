# Forensic Learning Record (Deep Inspection): haris-musa/excel-mcp-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/haris-musa-excel-mcp-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/haris-musa/excel-mcp-server](https://github.com/haris-musa/excel-mcp-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:28:38.068Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `haris-musa/excel-mcp-server`
- **Description**: A Model Context Protocol server for Excel file manipulation
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 4207 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/generate_tools_doc.py`
```
"""Generate TOOLS.md from the tool schemas the server publishes.

Run with ``uv run python scripts/generate_tools_doc.py``; a test fails if TOOLS.md is stale.
"""

import asyncio
from pathlib import Path
from typing import Any

from mcp import Client
from mcp.types import Tool

from excel_mcp.config import Settings
from excel_mcp.server import create_server

TOOLS_DOC = Path(__file__).resolve().parent.parent / "TOOLS.md"

HEADER = """# Tools

This file is generated from the server's tool schemas by
`scripts/generate_tools_doc.py`. Do not edit it by hand.

Every tool that takes a `path` accepts `.xlsx`, `.xlsm`, `.xltx` and `.xltm` files.
Cells use A1 notation and row and column numbers are 1-based.
"""


async def list_tools() -> list[Tool]:
    async with Client(create_server(Settings())) as client:
        return (await client.list_tools()).tools


def render(tools: list[Tool]) -> str:
    lines = [HEADER, "| Tool | Summary |", "| --- | --- |"]
    for tool in tools:
        first_paragraph = (tool.description or "").split("\n\n")[0]
        summary = " ".join(first_paragraph.split())
        lines.append(f"| [`{tool.name}`](#{tool.name}) | {summary} |")
    for tool in tools:
        lines += ["", *_render_tool(tool)]
    return "\n".join(lines) + "\n"


def _render_tool(tool: Tool) -> list[str]:
    hints = tool.annotations
    kind = "read-only" if hints and hints.read_only_hint else "modifies files"
    if hints and hints.destructive_hint:
        kind = "modifies files, may overwrite data"
    lines = [f"## {tool.name}", "", f"**{tool.title}** ({kind})", "", tool.description or ""]
    schema = tool.input_schema
    lines += ["", *_parameter_table(schema, schema.get("$defs", {}))]
    return lines


def _parameter_table(schema: dict[str, Any], defs: dict[str, Any]) -> list[str]:
    required = set(schema.get("required", []))
    rows = ["| Parameter | Type | Required | Description |", "| --- | --- | --- | --- |"]
    nested: list[str] = []
    for name, prop in schema["properties"].items():
        model = _referenced_model(prop, defs)
        description = prop.get("description") or (model or {}).get("description", "")
        if "default" in prop and prop["default"] is not None:
            description += f" Default: `{prop['default']}`."
        rows.append(
            f"| `{name}` | {_type_name(prop, defs)} | {'yes' if name in required else 'no'} "
            f"| {description.strip()} |"
        )
        if model:
            nested += ["", f"`{name}` fields:", "", *_parameter_table(model, defs)]
    return rows + nested


def _referenced_model(prop: dict[str, Any], defs: dict[str, Any]) -> dict[str, Any] | None:
    for option in [prop, *prop.get("anyOf", [])]:
        if "$ref" in option:
            return defs[option["$ref"].rsplit("/", 1)[-1]]
    return None


def _type_name(prop: dict[str, Any], defs: dict[str, Any]) -> str:
    if "$ref" in prop:
        return "object"
    if "enum" in prop:
        return " \\| ".join(f"`{value}`" for value in prop["enum"])
    if "anyOf" in prop:
        options = [_type_name(option, defs) for option in prop["anyOf"]]
        return " \\| ".join(option for option in options if option != "null") or "null"
    if prop.get("type") == "array":
        return f"array of {_type_name(prop['items'], defs)}"
    return prop.get("type", "any")


def main() -> None:
    TOOLS_DOC.write_text(render(asyncio.run(list_tools())), encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `src/excel_mcp/__init__.py`
```
"""MCP server for Excel workbooks."""

from importlib.metadata import version

__version__ = version("excel-mcp-server")

```

### Core Architecture Module: `src/excel_mcp/__main__.py`
```
from excel_mcp.cli import main

main()

```

### Core Architecture Module: `src/excel_mcp/cli.py`
```
"""Command line entry point: ``excel-mcp-server stdio`` or ``excel-mcp-server streamable-http``."""

import argparse
import os
import sys
from pathlib import Path

from excel_mcp import __version__
from excel_mcp.config import Limits, Settings
from excel_mcp.server import create_server
from excel_mcp.server.http import is_loopback, serve

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8017
DEFAULT_HTTP_DIRECTORY = "./excel_files"


def main(argv: list[str] | None = None) -> None:
    args = _parser().parse_args(argv)
    settings = _settings(args)
    server = create_server(settings)

    if args.transport == "stdio":
        if not settings.allowed_dirs:
            print(
                "excel-mcp-server: any Excel file on this computer can be opened. "
                "Pass --allow-dir DIR to limit access to one folder.",
                file=sys.stderr,
            )
        server.run()
        return

    token = os.environ.get("EXCEL_MCP_AUTH_TOKEN") or None
    if not is_loopback(args.host) and token is None and not args.allow_unauthenticated:
        sys.exit(
            f"Refusing to listen on {args.host} without authentication. Set "
            "EXCEL_MCP_AUTH_TOKEN, or pass --allow-unauthenticated if a proxy handles it."
        )
    for directory in settings.allowed_dirs:
        directory.mkdir(parents=True, exist_ok=True)
    serve(server, args.host, args.port, token)


def _settings(args: argparse.Namespace) -> Settings:
    directories = list(args.allow_dir)
    if env_value := os.environ.get("EXCEL_FILES_PATH"):
        directories += [entry for entry in env_value.split(os.pathsep) if entry.strip()]
    if args.transport == "streamable-http" and not directories:
        directories = [DEFAULT_HTTP_DIRECTORY]
    return Settings(
        allowed_dirs=[Path(directory).expanduser() for directory in directories],
        read_only=args.read_only or os.environ.get("EXCEL_MCP_READ_ONLY") == "1",
        limits=Limits(max_file_bytes=args.max_file_mb * 1024 * 1024),
        log_level=args.log_level,
    )


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="excel-mcp-server", description="MCP server for Excel workbooks."
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--allow-dir",
        action="append",
        default=[],
        metavar="DIR",
        help="Only allow workbooks inside DIR (repeatable). Relative paths start in the "
        "first DIR. Also read from EXCEL_FILES_PATH.",
    )
    common.add_argument(
        "--read-only",
        action="store_true",
        help="Only register tools that do not change files. Also EXCEL_MCP_READ_ONLY=1.",
    )
    common.add_argument(
        "--max-file-mb", type=int, default=100, help="Largest workbook to open (default 100)."
    )
    common.add_argument(
        "--log-level",
        default="WARNING",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Log level for messages on stderr (default WARNING).",
    )

    transports = parser.add_subparsers(dest="transport", required=True)
    transports.add_parser("stdio", parents=[common], help="Serve over stdin/stdout (local).")
    http = transports.add_parser(
        "streamable-http", parents=[common], help="Serve over Streamable HTTP (remote)."
    )
    http.add_argument("--host", default=os.environ.get("EXCEL_MCP_HOST", DEFAULT_HOST))
    http.add_argument(
        "--port", type=int, default=int(os.environ.get("EXCEL_MCP_PORT", DEFAULT_PORT))
    )
    http.add_argument(
        "--allow-unauthenticated",
        action="store_true",
        help="Allow a non-local --host without EXCEL_MCP_AUTH_TOKEN.",
    )
    return parser

```

### Core Architecture Module: `src/excel_mcp/config.py`
```
"""Server settings."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]


@dataclass(frozen=True)
class Limits:
    max_file_bytes: int = 100 * 1024 * 1024
    max_read_cells: int = 10_000
    max_cells: int = 100_000


@dataclass(frozen=True)
class Settings:
    allowed_dirs: list[Path] = field(default_factory=list)
    read_only: bool = False
    limits: Limits = field(default_factory=Limits)
    log_level: LogLevel = "WARNING"

```

### Core Architecture Module: `src/excel_mcp/errors.py`
```
"""Errors raised by the domain layer.

The server turns every `ExcelMCPError` into an MCP tool error, and its message
is shown to the model, so messages should say what went wrong and how to fix it.
"""


class ExcelMCPError(Exception):
    """Base class for expected, user-facing errors."""


class InvalidArgumentError(ExcelMCPError):
    """A tool argument is malformed."""


class PathNotAllowedError(ExcelMCPError):
    """A path is outside the allowed directories or has a disallowed type."""


class WorkbookNotFoundError(ExcelMCPError):
    """The workbook file does not exist."""


class WorkbookExistsError(ExcelMCPError):
    """The workbook file already exists."""


class WorkbookError(ExcelMCPError):
    """The workbook could not be opened or saved."""


class SheetNotFoundError(ExcelMCPError):
    """The worksheet does not exist."""

    def __init__(self, sheet: str, available: list[str]) -> None:
        names = ", ".join(repr(name) for name in available)
        super().__init__(f"Sheet {sheet!r} not found. Available sheets: {names}.")


class UnsafeFormulaError(ExcelMCPError):
    """A formula was rejected by the formula safety policy."""


class LimitExceededError(ExcelMCPError):
    """A request exceeds a configured size limit."""

```

### Core Architecture Module: `src/excel_mcp/formulas.py`
```
"""Formula safety policy.

Every formula the server writes (cell values, conditional formats, data
validation rules) passes through `check_formula`. Formulas are tokenized with
openpyxl's Excel tokenizer rather than matched with regular expressions, and
anything that cannot be tokenized is rejected.

Blocked are functions that reach the network or other programs, leak
information about the host, or build references at runtime, plus references to
external workbooks and DDE links.
"""

from openpyxl.formula import Tokenizer
from openpyxl.formula.tokenizer import Token, TokenizerError

from excel_mcp.errors import UnsafeFormulaError

BLOCKED_FUNCTIONS = frozenset(
    {
        # Network access
        "WEBSERVICE",
        "FILTERXML",
        "IMAGE",
        "HYPERLINK",
        "STOCKHISTORY",
        "TRANSLATE",
        "DETECTLANGUAGE",
        "COPILOT",
        "PY",
        # Google Sheets network functions, for files opened there
        "IMPORTDATA",
        "IMPORTFEED",
        "IMPORTHTML",
        "IMPORTRANGE",
        "IMPORTXML",
        # External programs and data connections
        "RTD",
        "DDE",
        "CALL",
        "REGISTER",
        "REGISTER.ID",
        "SQL.REQUEST",
        "CUBEKPIMEMBER",
        "CUBEMEMBER",
        "CUBEMEMBERPROPERTY",
        "CUBERANKEDMEMBER",
        "CUBESET",
        "CUBESETCOUNT",
        "CUBEVALUE",
        # Excel 4.0 macro functions
        "EXEC",
        "EXECUTE",
        "EVALUATE",
        "FOPEN",
        "FWRITE",
        "FWRITELN",
        "FREAD",
        "FREADLN",
        "FCLOSE",
        "GET.WORKSPACE",
        "GET.DOCUMENT",
        "GET.CELL",
        # Host information and runtime references
        "INFO",
        "CELL",
        "INDIRECT",
    }
)

_FUNCTION_PREFIXES = ("_XLFN.", "_XLWS.", "_XLUDF.", "_XLETA.")


def normalize_function_name(token_value: str) -> str:
    """Reduce a function or name token to the bare function name Excel would call.

    ``@_xlfn._xlfn.webservice(``, ``_xleta.WEBSERVICE`` (a function passed by
    name to MAP or BYROW) and ``Sheet1!WEBSERVICE`` all become ``WEBSERVICE``.
    """
    name = token_value.removesuffix("(").strip().upper().lstrip("@")
    name = name.rpartition("!")[2]
    while name.startswith(_FUNCTION_PREFIXES):
        name = name.split(".", 1)[1]
    return name


def check_formula(formula: str) -> None:
    """Raise `UnsafeFormulaError` unless ``formula`` (starting with ``=``) is allowed."""
    if not formula.startswith("="):
        raise UnsafeFormulaError(f"Formula must start with '=': {formula!r}.")
    try:
        tokens = Tokenizer(formula).items
    except TokenizerError as error:
        raise UnsafeFormulaError(f"Formula could not be parsed: {error}.") from None

    for token in tokens:
        _check_token(token)


def _check_token(token: Token) -> None:
    if "|" in token.value and token.subtype != Token.TEXT:
        raise UnsafeFormulaError("DDE links ('|') are not allowed in formulas.")
    # A blocked name is rejected even without its "(": the tokenizer reads
    # "=WEBSERVICE (A1)" as a name followed by a parenthesis.
    is_function = token.type == Token.FUNC and token.subtype == Token.OPEN
    if is_function or token.subtype == Token.RANGE:
        name = normalize_function_name(token.value)
        if name in BLOCKED_FUNCTIONS:
            raise UnsafeFormulaError(
                f"Function {name} is not allowed because it can access the network, "
                "other programs or host information."
            )
    if token.subtype == Token.RANGE and _is_external_reference(token.value):
        raise UnsafeFormulaError(f"References to other workbooks are not allowed: {token.value!r}.")


def _is_external_reference(reference: str) -> bool:
    # External references put the workbook in brackets before the sheet, as in
    # "[1]Sheet1!A1" or "'C:\dir\[book.xlsx]Sheet1'!A1". Table references such
    # as "Table1[Sales]" also use brackets but have no sheet part.
    sheet_part, separator, _ = reference.rpartition("!")
    return bool(separator) and "[" in sheet_part

```

### Core Architecture Module: `src/excel_mcp/operations/__init__.py`
```
"""Workbook operations, independent of MCP."""

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #171** (2026-09-28): **chore: release 1.1.1**
  *Symptoms*: Release PR for 1.1.1: bumps the version in `pyproject.toml`, `manifest.json` and `server.json` and moves the `read_vba` attribute fix from Unreleased to 1.1.1 in the changelog.

- **Issue #170** (2026-09-28): **fix: hide procedure attribute lines in read_vba output**
  *Symptoms*: `read_vba` removed module attributes (`Attribute VB_Name ...`) but kept procedure attributes such as `Attribute Macro1.VB_ProcData.VB_Invoke_Func`, which the VBA editor also hides. Found by running the published 1.1.0 package against the macro01.xlsm fixture. The test now asserts that no `Attribute ` line remains; it fails without the fix.

- **Issue #169** (2026-09-28): **chore: release 1.1.0**
  *Symptoms*: Release PR for 1.1.0: bumps the version in `pyproject.toml`, `manifest.json` and `server.json`, moves the `read_vba` entry from Unreleased to 1.1.0 in the changelog, and updates the license line to `Copyright (c) 2025-2026 Haris Musa`.

- **Issue #168** (2026-09-28): **feat: read_vba for inspecting VBA macros**
  *Symptoms*: ## Summary  Adds read-only VBA inspection for 1.1:  - **`read_vba`** returns each module in an `.xlsm`/`.xltm` workbook with its kind (`standard`, `class`, `document`, `form`), line count and code as the VBA editor shows it (hidden `Attribute VB_` lines removed). It takes an optional `module` and a `max_chars` budget, and is registered as read-only, so it is available in `--read-only` mode. - **`describe_workbook`** now reports `has_vba`. - The code is only parsed as text, never run, and the tool description tells the model to treat it as untrusted data.  ## Design  A small [MS-OVBA] reader (`src/excel_mcp/ovba.py`) on top of `olefile`, the one new dependency (BSD, no dependencies of its own). `oletools` was considered, but it pulls in a GUI library, `cryptography` and more, and hasn't had a release since 2024.  The input is untrusted binary data, so the reader:  - validates the OLE sector sizes before `olefile` parses the header, because `olefile` computes `2**shift` unbounded; - checks record sizes and code pages; - caps decompressed output at 16 MB; - rejects truncated or corrupt compression tokens; - reports every failure as a clear `WorkbookError`.  Writing VBA stays out of scope; AGENTS.md now says it needs a separate opt-in design.  ## Testing  - 184 tests, including a real Excel-made VBA project and workbook from XlsxWriter (BSD-2-Clause, attributed in `tests/fixtures/README.md`) and decompressor edge cases. - 23,000 fuzzed corruptions of the real project raised only 

- **Issue #167** (2026-09-28): **v1.0.0: rewrite for MCP SDK 2 and spec 2026-07-28**
  *Symptoms*: ## Summary  A ground-up rewrite for v1.0.0 on the MCP Python SDK 2 and the MCP specification 2026-07-28, with a redesigned tool set and a security hardening pass. [CHANGELOG.md](CHANGELOG.md) has the details and the mapping from every 0.x tool to its 1.0 replacement.  - **Protocol**: `MCPServer` from SDK 2 (stateless 2026-07-28 spec, `server/discover`), stdio and Streamable HTTP; the deprecated SSE transport is removed. - **Tools**: 25 redesigned tools with typed and documented parameters, structured output, accurate annotations and real MCP tool errors (`isError`). `TOOLS.md` is generated from the live schemas. - **Security**: fixes the reports in the eight advisories in triage, #119, #134, #145 and #149. Path confinement with `--allow-dir`, Excel-only extensions, no silent overwrites, a tokenizer-based formula check on every write path, localhost-only HTTP with DNS rebinding protection and an optional bearer token, per-call cell limits, atomic saves and serialized edits. - **Project**: CI on Linux, macOS and Windows for Python 3.11-3.14, lint, types, dependency and workflow audits, a Docker build check, a release workflow for PyPI, the MCPB bundle and the MCP Registry, Dependabot, `AGENTS.md`, `SECURITY.md` and `CONTRIBUTING.md`.  ## Breaking changes  Tools are renamed and redesigned, SSE is removed, `FASTMCP_HOST`/`FASTMCP_PORT` are replaced by `--host`/`--port` (or `EXCEL_MCP_HOST`/`EXCEL_MCP_PORT`), HTTP binds to `127.0.0.1` by default, and Python 3.11+ is required.  ## 

- **Issue #166** (2026-09-28): **fix: default create_pivot_table agg_func to "sum"**
  *Symptoms*: The `create_pivot_table` tool defaults `agg_func` to `"mean"`, but `pivot.create_pivot_table` only accepts `sum`, `average`, `count`, `min` and `max`. So any call that omits `agg_func` fails.  **Repro** (4-row sheet with headers `Region`, `Sales`; calling the tool function directly):  ``` create_pivot_table(path, "Data", "A1:B4", ["Region"], ["Sales"]) main:        Error: Invalid aggregation function. Must be one of: sum, average, count, min, max this branch: Summary table created successfully ```  This changes the default to `"sum"`, which matches the default in `pivot.py`. `pytest tests` passes (5/5). (Found while documenting parameters for #158.)  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > Thank you for this contribution. v1.0.0 is a full rewrite (MCP Python SDK 2, redesigned tools), so this can't be merged as it is, but a valid default aggregation for summary tables is part of [v1.0.0](https://github.com/haris-musa/excel-mcp-server/releases/tag/v1.0.0) and you are credited in the changelog. Closing as superseded, and thanks again.

- **Issue #165** (2026-09-28): **docs: add Args sections to 23 tool docstrings**
  *Symptoms*: Closes #158.  MCP clients receive these docstrings as tool descriptions. Right now 23 of 25 tools show only the parameter name and type, so an agent has to guess formats like `cell`, `data_range` or `shift_direction`. This adds an `Args:` section to each one, in the same style as `read_data_from_excel` and `get_data_validation_info`.  The values come from the implementation, not `TOOLS.md` (which has drifted, e.g. it lists a `target_cell` for pivot tables that doesn't exist). Things an agent would otherwise get wrong: - `filepath` must be absolute in stdio mode but relative to `EXCEL_FILES_PATH` in SSE/streamable HTTP (`get_excel_path`) - `create_workbook` overwrites an existing file at that path - `create_pivot_table` writes to `<sheet_name>_pivot`, replacing that sheet if it exists - Accepted values: chart types, aggregation functions, `shift_direction`, conditional-format types - Row/column numbers are 1-based; colors are hex without `#`  **Checked:** the diff touches only docstrings; `pytest tests` passes (5/5); `mcp.list_tools()` shows an `Args:` section on all 25 tools.  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > Thank you for this contribution. v1.0.0 is a full rewrite (MCP Python SDK 2, redesigned tools), so this can't be merged as it is, but parameter documentation for every tool is part of [v1.0.0](https://github.com/haris-musa/excel-mcp-server/releases/tag/v1.0.0) and you are credited in the changelog. Closing as superseded, and thanks again.

- **Issue #164** (2026-09-22): **fix: close high-severity review findings for allowlist, COM, and contracts**
  *Symptoms*: ## Summary - Collapse `.` / `..` (including `%2e%2e`) in cloud workbook URLs so allowlist prefixes cannot be escaped to a sibling path. - Treat duplicate Excel FullName matches as open so `transport=auto` routes to COM instead of writing through openpyxl while Excel still holds the book. - Align file/COM tool contracts: empty metadata reads stay JSON, missing-sheet errors use the `Error:` envelope, and `create_workbook(open_in_excel=True)` reports a failed open as an error. - Fix COM read-only handling (reads and close-without-save work; writes still fail closed), close orphan workbooks when SaveAs fails, and keep stdio lifecycle logs off stdout. - Correct chart data-sheet/anchor placement, cell-range delete shift, numeric pivot filters, start-cell reads, and Excel-limit range validation.  ## Test plan - [ ] `python -m pytest -q` (312 passed locally, 1 skipped) - [ ] Confirm `get_excel_path` rejects `.../Allowed/../Secret/book.xlsx` and `%2e%2e` when the prefix is `.../sites/Allowed/` - [ ] Confirm `read_data_from_excel` empty/out-of-bounds file results are JSON with `cells: []`, and a missing sheet returns `Error:` - [ ] Confirm `create_workbook(..., open_in_excel=True)` returns a string starting with `Error:` if open fails - [ ] On Windows with Excel: a read-only open workbook can be read and closed without save; writes still error; duplicate open copies fail closed via COM  Made with [Cursor](https://cursor.com)
  **Post-Mortem & Fix Analysis**:
  > Opened against the upstream parent by mistake. Recreating on benvdbergh/excel-mcp-server.

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

### Incident Patch 1: `058286b3` (2026-09-28)
**Commit Message**: fix: hide procedure attribute lines in read_vba output

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -6,6 +6,11 @@ All notable changes to this project are documented here. The format follows
 
 ## [Unreleased]
 
+### Fixed
+
+- `read_vba` hides procedure attributes such as `Attribute Macro1.VB_ProcData...`, as the
+  VBA editor does.
+
 ## [1.1.0] - 2026-09-28
 
 ### Added
```

**File**: `src/excel_mcp/operations/vba.py` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ def read_vba(path: Path, module: str | None, max_chars: int) -> VbaProject:
 def editor_text(source: str) -> str:
     """The code as the VBA editor shows it: without hidden attributes, with \\n line ends."""
     lines = source.replace("\r\n", "\n").split("\n")
-    return "\n".join(line for line in lines if not line.startswith("Attribute VB_")).strip("\n")
+    return "\n".join(line for line in lines if not line.startswith("Attribute ")).strip("\n")
 
 
 def _project_bytes(path: Path) -> bytes:
```

**File**: `tests/test_vba.py` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ async def test_read_vba_lists_modules_with_code(call: ToolCall, macro_workbook:
     ]
     module1 = project["modules"][0]
     assert module1["code"].startswith("Sub ")
-    assert "Attribute VB_" not in module1["code"]
+    assert "Attribute " not in module1["code"]
     assert module1["line_count"] == len(module1["code"].splitlines())
     assert project["truncated"] is False
 
```

---

### Incident Patch 2: `f0c0ecdc` (2025-08-06)
**Commit Message**: Fix host and port configuration issues - closes #83, closes #84 (#85)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ uvx excel-mcp-server streamable-http
 When running the server with the **SSE or Streamable HTTP protocols**, you **must set the `EXCEL_FILES_PATH` environment variable on the server side**. This variable tells the server where to read and write Excel files.
 - If not set, it defaults to `./excel_files`.
 
-You can also set the `FASTMCP_PORT` environment variable to control the port the server listens on (default is `8000` if not set).
+You can also set the `FASTMCP_PORT` environment variable to control the port the server listens on (default is `8017` if not set).
 - Example (Windows PowerShell):
   ```powershell
   $env:EXCEL_FILES_PATH="E:\MyExcelFiles"
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "excel-mcp-server"
-version = "0.1.6"
+version = "0.1.7"
 description = "Excel MCP Server for manipulating Excel files"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `src/excel_mcp/__main__.py` (modified, +2/-12)
```diff
@@ -1,4 +1,3 @@
-import asyncio
 import typer
 
 from .server import run_sse, run_stdio, run_streamable_http
@@ -8,11 +7,8 @@
 @app.command()
 def sse():
     """Start Excel MCP Server in SSE mode"""
-    print("Excel MCP Server - SSE mode")
-    print("----------------------")
-    print("Press Ctrl+C to exit")
     try:
-        asyncio.run(run_sse())
+        run_sse()
     except KeyboardInterrupt:
         print("\nShutting down server...")
     except Exception as e:
@@ -25,11 +21,8 @@ def sse():
 @app.command()
 def streamable_http():
     """Start Excel MCP Server in streamable HTTP mode"""
-    print("Excel MCP Server - Streamable HTTP mode")
-    print("---------------------------------------")
-    print("Press Ctrl+C to exit")
     try:
-        asyncio.run(run_streamable_http())
+        run_streamable_http()
     except KeyboardInterrupt:
         print("\nShutting down server...")
     except Exception as e:
@@ -42,9 +35,6 @@ def streamable_http():
 @app.command()
 def stdio():
     """Start Excel MCP Server in stdio mode"""
-    print("Excel MCP Server - Stdio mode")
-    print("-----------------------------")
-    print("Press Ctrl+C to exit")
     try:
         run_stdio()
     except KeyboardInterrupt:
```

**File**: `src/excel_mcp/server.py` (modified, +6/-4)
```diff
@@ -66,6 +66,8 @@
 # Initialize FastMCP server
 mcp = FastMCP(
     "excel-mcp",
+    host=os.environ.get("FASTMCP_HOST", "0.0.0.0"),
+    port=int(os.environ.get("FASTMCP_PORT", "8017")),
     instructions="Excel MCP Server for manipulating Excel files"
 )
 
@@ -666,7 +668,7 @@ def delete_sheet_columns(
         logger.error(f"Error deleting columns: {e}")
         raise
 
-async def run_sse():
+def run_sse():
     """Run Excel MCP server in SSE mode."""
     # Assign value to EXCEL_FILES_PATH in SSE mode
     global EXCEL_FILES_PATH
@@ -676,7 +678,7 @@ async def run_sse():
     
     try:
         logger.info(f"Starting Excel MCP server with SSE transport (files directory: {EXCEL_FILES_PATH})")
-        await mcp.run_sse_async()
+        mcp.run(transport="sse")
     except KeyboardInterrupt:
         logger.info("Server stopped by user")
     except Exception as e:
@@ -685,7 +687,7 @@ async def run_sse():
     finally:
         logger.info("Server shutdown complete")
 
-async def run_streamable_http():
+def run_streamable_http():
     """Run Excel MCP server in streamable HTTP mode."""
     # Assign value to EXCEL_FILES_PATH in streamable HTTP mode
     global EXCEL_FILES_PATH
@@ -695,7 +697,7 @@ async def run_streamable_http():
     
     try:
         logger.info(f"Starting Excel MCP server with streamable HTTP transport (files directory: {EXCEL_FILES_PATH})")
-        await mcp.run_streamable_http_async()
+        mcp.run(transport="streamable-http")
     except KeyboardInterrupt:
         logger.info("Server stopped by user")
     except Exception as e:
```

---

### Incident Patch 3: `89302b8d` (2025-08-01)
**Commit Message**: Fix FastMCP compatibility issue and update dependencies (#77)

The excel-mcp-server was using outdated FastMCP API parameters (version, description, dependencies, env_vars) that are no longer supported in the current FastMCP version. Updated the initialization to use only the supported parameters (name and instructions) to resolve the TypeError.

Also added explicit dependency on fastmcp>=2.0.0,<3.0.0 to ensure compatibility with FastMCP 2.x API and prevent future breaking changes from major version updates.

This fixes the "TypeError: FastMCP.__init__() got an unexpected keyword argument 'version'" error when running excel-mcp-server.

Fixes #76

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ readme = "README.md"
 requires-python = ">=3.10"
 dependencies = [
     "mcp[cli]>=1.10.1",
+    "fastmcp>=2.0.0,<3.0.0",
     "openpyxl>=3.1.5",
     "typer>=0.16.0"
 ]
```

**File**: `src/excel_mcp/server.py` (modified, +1/-10)
```diff
@@ -66,16 +66,7 @@
 # Initialize FastMCP server
 mcp = FastMCP(
     "excel-mcp",
-    version="0.1.5",
-    description="Excel MCP Server for manipulating Excel files",
-    dependencies=["openpyxl>=3.1.5"],
-    env_vars={
-        "EXCEL_FILES_PATH": {
-            "description": "Path to Excel files directory",
-            "required": False,
-            "default": EXCEL_FILES_PATH
-        }
-    }
+    instructions="Excel MCP Server for manipulating Excel files"
 )
 
 def get_excel_path(filename: str) -> str:
```

---

### Incident Patch 4: `81d786b7` (2025-07-05)
**Commit Message**: feat: Update version to 0.1.5, enhance server functionality with streamable HTTP mode, and improve type hints across the codebase (#63) fixes #57

**File**: `.gitignore` (modified, +4/-34)
```diff
@@ -1,36 +1,6 @@
-# Build and Distribution
-__pycache__/
-*.py[cod]
-build/
-dist/
-src/*.egg-info/
-
-# Development Environment
 .venv/
-.env
-
-# IDE
-.vscode/
-.idea/
-.cursor/
-.cursorignore
-.cursorrules
-.specstory
-
-# Testing and Linting
-.coverage
-.pytest_cache/
-.ruff_cache/
-.mypy_cache/
-htmlcov/
-tests/
-
-# Project Files
-extras/
+dist/
+excel_files/
+__pycache__/
 .notes/
-logs/
-output/
-*.xlsx
-*.xls
-*.log 
-excel_files/
\ No newline at end of file
+*.log
\ No newline at end of file
```

**File**: `README.md` (modified, +44/-43)
```diff
@@ -3,97 +3,98 @@
 </p>
 
 [![PyPI version](https://img.shields.io/pypi/v/excel-mcp-server.svg)](https://pypi.org/project/excel-mcp-server/)
-[![PyPI downloads](https://img.shields.io/pypi/dm/excel-mcp-server.svg)](https://pypi.org/project/excel-mcp-server/)
+[![Total Downloads](https://static.pepy.tech/badge/excel-mcp-server)](https://pepy.tech/project/excel-mcp-server)
 [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
+[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=excel-mcp-server&config=eyJjb21tYW5kIjoidXZ4IGV4Y2VsLW1jcC1zZXJ2ZXIgc3RkaW8ifQ%3D%3D)
 
 A Model Context Protocol (MCP) server that lets you manipulate Excel files without needing Microsoft Excel installed. Create, read, and modify Excel workbooks with your AI agent.
 
 ## Features
 
-- 📊 Create and modify Excel workbooks
-- 📝 Read and write data
-- 🎨 Apply formatting and styles
-- 📈 Create charts and visualizations
-- 📊 Generate pivot tables
-- 🔄 Manage worksheets and ranges
-- 🔌 Dual transport support: stdio and SSE
-
-## Quick Start
-
-### Prerequisites
-
-- Python 3.10 or higher
+- 📊 **Excel Operations**: Create, read, update workbooks and worksheets
+- 📈 **Data Manipulation**: Formulas, formatting, charts, pivot tables, and Excel tables
+- 🔍 **Data Validation**: Built-in validation for ranges, formulas, and data integrity
+- 🎨 **Formatting**: Font styling, colors, borders, alignment, and conditional formatting
+- 📋 **Table Operations**: Create and manage Excel tables with custom styling
+- 📊 **Chart Creation**: Generate various chart types (line, bar, pie, scatter, etc.)
+- 🔄 **Pivot Tables**: Create dynamic pivot tables for data analysis
+- 🔧 **Sheet Management**: Copy, rename, delete worksheets with ease
+- 🔌 **Triple transport support**: stdio, SSE (deprecated), and streamable HTTP
+- 🌐 **Remote & Local**: Works both locally and as a remote service
 
-### Running the Server
+## Usage
 
-The server supports two transport modes: stdio and SSE.
+The server supports three transport methods:
 
-#### Using stdio transport
-
-Stdio transport is ideal for direct integration with tools like Cursor Desktop or local development, which can manipulate local files:
+### 1. Stdio Transport (for local use)
 
 ```bash
 uvx excel-mcp-server stdio
 ```
 
-#### Using SSE transport
+```json
+{
+   "mcpServers": {
+      "excel": {
+         "command": "uvx",
+         "args": ["excel-mcp-server", "stdio"]
+      }
+   }
+}
+```
 
-SSE transport is perfect for remote connections, which manipulate remote files:
+### 2. SSE Transport (Server-Sent Events - Deprecated)
 
 ```bash
 uvx excel-mcp-server sse
 ```
 
-### Add to Cursor
-
-[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=excel-mcp-server&config=eyJjb21tYW5kIjoidXZ4IGV4Y2VsLW1jcC1zZXJ2ZXIgc3RkaW8ifQ%3D%3D)
-
-## Using with AI Tools
-
-1. Add this configuration to your client, choosing the appropriate transport method for your needs:
-
-**Stdio transport connection** (for local integration):
+**SSE transport connection**:
 ```json
 {
    "mcpServers": {
-      "excel-stdio": {
-         "command": "uvx",
-         "args": ["excel-mcp-server", "stdio"]
+      "excel": {
+         "url": "http://localhost:8000/sse",
       }
    }
 }
 ```
 
-**SSE transport connection**:
+### 3. Streamable HTTP Transport (Recommended for remote connections)
+
+```bash
+uvx excel-mcp-server streamable-http
+```
+
+**Streamable HTTP transport connection**:
 ```json
 {
    "mcpServers": {
       "excel": {
-         "url": "http://localhost:8000/sse",
+         "url": "http://localhost:8000/mcp",
+         "transport": "streamable-http"
       }
    }
 }
 ```
 
-2. The Excel tools will be available through your AI assistant.
-
 ## Environment Variables & File Path Handling
 
-### SSE Transport
+### SSE and Streamable HTTP Transports
 
-When running
```

**File**: `assets/logo.svg` (modified, +4/-4)
```diff
@@ -1,8 +1,8 @@
 <svg width="400" height="100" viewBox="0 0 800 200" xmlns="http://www.w3.org/2000/svg" fill="none">
   <rect width="800" height="200" fill="#0F172A" rx="20"/>
-  <g font-family="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" font-weight="bold" fill="#F8FAFC">
-    <text x="130" y="110" font-size="60" fill="#38BDF8">Excel</text>
-    <text x="310" y="110" font-size="60" fill="#FACC15">MCP</text>
-    <text x="470" y="110" font-size="60" fill="#4ADE80">Server</text>
+  <g font-family="Arial, Helvetica, sans-serif" font-weight="bold" text-anchor="start" dominant-baseline="text-before-edge">
+    <text x="130" y="125" font-size="60" fill="#38BDF8">Excel</text>
+    <text x="310" y="125" font-size="60" fill="#FACC15">MCP</text>
+    <text x="470" y="125" font-size="60" fill="#4ADE80">Server</text>
   </g>
 </svg> 
\ No newline at end of file
```

**File**: `pyproject.toml` (modified, +4/-4)
```diff
@@ -1,13 +1,13 @@
 [project]
 name = "excel-mcp-server"
-version = "0.1.4"
+version = "0.1.5"
 description = "Excel MCP Server for manipulating Excel files"
 readme = "README.md"
 requires-python = ">=3.10"
 dependencies = [
-    "mcp[cli]>=1.6.0",
-    "openpyxl>=3.1.2",
-    "typer>=0.15.1"
+    "mcp[cli]>=1.10.1",
+    "openpyxl>=3.1.5",
+    "typer>=0.16.0"
 ]
 [[project.authors]]
 name = "haris"
```

**File**: `src/excel_mcp/__main__.py` (modified, +21/-1)
```diff
@@ -1,7 +1,7 @@
 import asyncio
 import typer
 
-from .server import run_sse, run_stdio
+from .server import run_sse, run_stdio, run_streamable_http
 
 app = typer.Typer(help="Excel MCP Server")
 
@@ -22,9 +22,29 @@ def sse():
     finally:
         print("Service stopped.")
 
+@app.command()
+def streamable_http():
+    """Start Excel MCP Server in streamable HTTP mode"""
+    print("Excel MCP Server - Streamable HTTP mode")
+    print("---------------------------------------")
+    print("Press Ctrl+C to exit")
+    try:
+        asyncio.run(run_streamable_http())
+    except KeyboardInterrupt:
+        print("\nShutting down server...")
+    except Exception as e:
+        print(f"\nError: {e}")
+        import traceback
+        traceback.print_exc()
+    finally:
+        print("Service stopped.")
+
 @app.command()
 def stdio():
     """Start Excel MCP Server in stdio mode"""
+    print("Excel MCP Server - Stdio mode")
+    print("-----------------------------")
+    print("Press Ctrl+C to exit")
     try:
         run_stdio()
     except KeyboardInterrupt:
```

---

### Incident Patch 5: `89a61071` (2025-06-10)
**Commit Message**: fix(docs): add CNAME file for custom domain (#49)

**File**: `docs/CNAME` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+excelmcpserver.com 
\ No newline at end of file
```

---

### Incident Patch 6: `257ee409` (2025-06-10)
**Commit Message**: Merge pull request #45 from haris-musa/fix/issue-40-read-range

Fix: Correctly read data when not starting at A1. Fixes #40

**File**: `src/excel_mcp/data.py` (modified, +34/-108)
```diff
@@ -51,21 +51,25 @@ def read_excel_range(
             except ValueError as e:
                 raise DataError(f"Invalid end cell format: {str(e)}")
         else:
-            # Dynamically expand range until all values are empty
-            end_row, end_col = start_row, start_col
-            while end_row <= ws.max_row and any(ws.cell(row=end_row, column=c).value is not None for c in range(start_col, ws.max_column + 1)):
-                end_row += 1
-            while end_col <= ws.max_column and any(ws.cell(row=r, column=end_col).value is not None for r in range(start_row, ws.max_row + 1)):
-                end_col += 1
-            end_row -= 1  # Adjust back to last non-empty row
-            end_col -= 1  # Adjust back to last non-empty column
+            # If no end_cell, use the full data range of the sheet
+            if ws.max_row == 1 and ws.max_column == 1 and ws.cell(1, 1).value is None:
+                # Handle empty sheet
+                end_row, end_col = start_row, start_col
+            else:
+                # Use the sheet's own boundaries
+                start_row, start_col = ws.min_row, ws.min_column
+                end_row, end_col = ws.max_row, ws.max_column
 
         # Validate range bounds
         if start_row > ws.max_row or start_col > ws.max_column:
-            raise DataError(
-                f"Start cell out of bounds. Sheet dimensions are "
-                f"A1:{get_column_letter(ws.max_column)}{ws.max_row}"
+            # This case can happen if start_cell is outside the used area on a sheet with data
+            # or on a completely empty sheet.
+            logger.warning(
+                f"Start cell {start_cell} is outside the sheet's data boundary "
+                f"({get_column_letter(ws.min_column)}{ws.min_row}:{get_column_letter(ws.max_column)}{ws.max_row}). "
+                f"No data will be read."
             )
+            return []
 
         data = []
         for row in range(start_row, end_row + 1):
@@ -131,91 +135,6 @@ def write_data(
         logger.error(f"Failed to write data: {e}")
         raise DataError(str(e))
 
-def _looks_like_headers(row_dict):
-    """Check if a data row appears to be headers (keys match values)."""
-    return all(
-        isinstance(value, str) and str(value).strip() == str(key).strip()
-        for key, value in row_dict.items()
-    )
-    
-def _check_for_headers_above(worksheet, start_row, start_col, headers):
-    """Check if cells above start position contain headers."""
-    if start_row <= 1:
-        return False  # Nothing above row 1
-        
-    # Look for header-like content above
-    for check_row in range(max(1, start_row - 5), start_row):
-        # Count matches for this row
-        header_count = 0
-        cell_count = 0
-        
-        for i, header in enumerate(headers):
-            if i >= 10:  # Limit check to first 10 columns for performance
-                break
-                
-            cell = worksheet.cell(row=check_row, column=start_col + i)
-            cell_count += 1
-            
-            # Check if cell is formatted like a header (bold)
-            is_formatted = cell.font.bold if hasattr(cell.font, 'bold') else False
-            
-            # Check for any content that could be a header
-            if cell.value is not None:
-                # Case 1: Direct match with expected header
-                if str(cell.value).strip().lower() == str(header).strip().lower():
-                    header_count += 2  # Give higher weight to exact matches
-                # Case 2: Any formatted cell with content
-                elif is_formatted and cell.value:
-                    header_count += 1
-                # Case 3: Any cell with content in the first row we check
-                elif check_row == max(1, start_row - 5):
-                    header_count += 0.5
-        
-        # If we have a significant number of matching cells, consider it a header row
-        if 
```

---

### Incident Patch 7: `de38958e` (2025-06-10)
**Commit Message**: Fix: Correctly read data when not starting at A1. Fixes #40

**File**: `src/excel_mcp/data.py` (modified, +34/-23)
```diff
@@ -51,21 +51,25 @@ def read_excel_range(
             except ValueError as e:
                 raise DataError(f"Invalid end cell format: {str(e)}")
         else:
-            # Dynamically expand range until all values are empty
-            end_row, end_col = start_row, start_col
-            while end_row <= ws.max_row and any(ws.cell(row=end_row, column=c).value is not None for c in range(start_col, ws.max_column + 1)):
-                end_row += 1
-            while end_col <= ws.max_column and any(ws.cell(row=r, column=end_col).value is not None for r in range(start_row, ws.max_row + 1)):
-                end_col += 1
-            end_row -= 1  # Adjust back to last non-empty row
-            end_col -= 1  # Adjust back to last non-empty column
+            # If no end_cell, use the full data range of the sheet
+            if ws.max_row == 1 and ws.max_column == 1 and ws.cell(1, 1).value is None:
+                # Handle empty sheet
+                end_row, end_col = start_row, start_col
+            else:
+                # Use the sheet's own boundaries
+                start_row, start_col = ws.min_row, ws.min_column
+                end_row, end_col = ws.max_row, ws.max_column
 
         # Validate range bounds
         if start_row > ws.max_row or start_col > ws.max_column:
-            raise DataError(
-                f"Start cell out of bounds. Sheet dimensions are "
-                f"A1:{get_column_letter(ws.max_column)}{ws.max_row}"
+            # This case can happen if start_cell is outside the used area on a sheet with data
+            # or on a completely empty sheet.
+            logger.warning(
+                f"Start cell {start_cell} is outside the sheet's data boundary "
+                f"({get_column_letter(ws.min_column)}{ws.min_row}:{get_column_letter(ws.max_column)}{ws.max_row}). "
+                f"No data will be read."
             )
+            return []
 
         data = []
         for row in range(start_row, end_row + 1):
@@ -295,25 +299,32 @@ def read_excel_range_with_metadata(
             except ValueError as e:
                 raise DataError(f"Invalid end cell format: {str(e)}")
         else:
-            # Dynamically expand range until all values are empty
-            end_row, end_col = start_row, start_col
-            while end_row <= ws.max_row and any(ws.cell(row=end_row, column=c).value is not None for c in range(start_col, ws.max_column + 1)):
-                end_row += 1
-            while end_col <= ws.max_column and any(ws.cell(row=r, column=end_col).value is not None for r in range(start_row, ws.max_row + 1)):
-                end_col += 1
-            end_row -= 1  # Adjust back to last non-empty row
-            end_col -= 1  # Adjust back to last non-empty column
+            # If no end_cell, use the full data range of the sheet
+            if ws.max_row == 1 and ws.max_column == 1 and ws.cell(1, 1).value is None:
+                # Handle empty sheet
+                end_row, end_col = start_row, start_col
+            else:
+                # Use the sheet's own boundaries, but respect the provided start_cell
+                end_row, end_col = ws.max_row, ws.max_column
+                # If start_cell is 'A1' (default), we should find the true start
+                if start_cell == 'A1':
+                    start_row, start_col = ws.min_row, ws.min_column
 
         # Validate range bounds
         if start_row > ws.max_row or start_col > ws.max_column:
-            raise DataError(
-                f"Start cell out of bounds. Sheet dimensions are "
-                f"A1:{get_column_letter(ws.max_column)}{ws.max_row}"
+            # This case can happen if start_cell is outside the used area on a sheet with data
+            # or on a completely empty sheet.
+            logger.warning(
+                f"Start cell {start_cell} is outside the sheet's data boundary "
+                f"({get_column_letter(ws.min_column)}{ws.min_row}:{get_column_lett
```

---

### Incident Patch 8: `425095d6` (2025-06-10)
**Commit Message**: Fix: Handle list of lists in create_pivot_table. Fixes #43 (#44)

**File**: `src/excel_mcp/pivot.py` (modified, +23/-24)
```diff
@@ -58,13 +58,28 @@ def create_pivot_table(
         # Create range string
         data_range_str = f"{get_column_letter(start_col)}{start_row}:{get_column_letter(end_col)}{end_row}"
         
-        # Read source data
+        # Clean up field names by removing aggregation suffixes
+        def clean_field_name(field: str) -> str:
+            field = str(field).strip()
+            for suffix in [" (sum)", " (average)", " (count)", " (min)", " (max)"]:
+                if field.lower().endswith(suffix):
+                    return field[:-len(suffix)]
+            return field
+
+        # Read source data and convert to list of dicts
         try:
-            data = read_excel_range(filepath, sheet_name, start_cell, end_cell)
+            data_as_list = read_excel_range(filepath, sheet_name, start_cell, end_cell)
+            if not data_as_list or len(data_as_list) < 2:
+                raise PivotError("Source data must have a header row and at least one data row.")
+            
+            headers = [str(h) for h in data_as_list[0]]
+            data = [dict(zip(headers, row)) for row in data_as_list[1:]]
+
             if not data:
-                raise PivotError("No data found in range")
+                raise PivotError("No data rows found after header.")
+
         except Exception as e:
-            raise PivotError(f"Failed to read source data: {str(e)}")
+            raise PivotError(f"Failed to read or process source data: {str(e)}")
 
         # Validate aggregation function
         valid_agg_funcs = ["sum", "average", "count", "min", "max"]
@@ -73,43 +88,27 @@ def create_pivot_table(
                 f"Invalid aggregation function. Must be one of: {', '.join(valid_agg_funcs)}"
             )
 
-        # Clean up field names by removing aggregation suffixes
-        def clean_field_name(field: str) -> str:
-            field = str(field).strip()
-            for suffix in [" (sum)", " (average)", " (count)", " (min)", " (max)"]:
-                if field.lower().endswith(suffix):
-                    return field[:-len(suffix)]
-            return field
-
         # Validate field names exist in data
         if data:
-            first_row = data[0]
-            available_fields = {clean_field_name(str(header)).lower() for header in first_row.keys()}
+            available_fields_raw = data[0].keys()
+            available_fields = {clean_field_name(str(header)).lower() for header in available_fields_raw}
             
             for field_list, field_type in [(rows, "row"), (values, "value")]:
                 for field in field_list:
                     if clean_field_name(str(field)).lower() not in available_fields:
                         raise ValidationError(
                             f"Invalid {field_type} field '{field}'. "
-                            f"Available fields: {', '.join(sorted(available_fields))}"
+                            f"Available fields: {', '.join(sorted(available_fields_raw))}"
                         )
 
             if columns:
                 for field in columns:
                     if clean_field_name(str(field)).lower() not in available_fields:
                         raise ValidationError(
                             f"Invalid column field '{field}'. "
-                            f"Available fields: {', '.join(sorted(available_fields))}"
+                            f"Available fields: {', '.join(sorted(available_fields_raw))}"
                         )
 
-            # Skip header row if it matches our fields
-            if all(
-                any(clean_field_name(str(header)).lower() == clean_field_name(str(field)).lower() 
-                    for field in rows + values)
-                for header in first_row.keys()
-            ):
-                data = data[1:]
-
         # Clean up row and value field names
         cleaned_rows = [clean_field_name(field) for field in rows]
         cleaned_values = [clean_field_name(field) for field in v
```

---

### Incident Patch 9: `44ef963c` (2025-04-04)
**Commit Message**: Fix/version sync (#9)

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "excel-mcp-server"
-version = "0.1.0"
+version = "0.1.1"
 description = "MCP server for Excel file manipulation"
 readme = "README.md"
 requires-python = ">=3.10"
```

#### Recent Merged Pull Requests:
- **PR #171** (2026-09-28): chore: release 1.1.1 (@haris-musa)
- **PR #170** (2026-09-28): fix: hide procedure attribute lines in read_vba output (@haris-musa)
- **PR #169** (2026-09-28): chore: release 1.1.0 (@haris-musa)
- **PR #168** (2026-09-28): feat: read_vba for inspecting VBA macros (@haris-musa)
- **PR #167** (2026-09-28): v1.0.0: rewrite for MCP SDK 2 and spec 2026-07-28 (@haris-musa)
- **PR #166** (closed): fix: default create_pivot_table agg_func to "sum" (@vishalhabib99)
- **PR #165** (closed): docs: add Args sections to 23 tool docstrings (@vishalhabib99)
- **PR #164** (closed): fix: close high-severity review findings for allowlist, COM, and contracts (@benvdbergh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
