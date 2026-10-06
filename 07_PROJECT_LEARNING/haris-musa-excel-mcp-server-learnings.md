# Forensic Learning Record (Deep Inspection): haris-musa/excel-mcp-server

> **Canonical Artifact**: `07_PROJECT_LEARNING/haris-musa-excel-mcp-server-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/haris-musa/excel-mcp-server](https://github.com/haris-musa/excel-mcp-server))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:59:45.984Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `haris-musa/excel-mcp-server`
- **Description**: A Model Context Protocol server for Excel file manipulation
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 4211 stars

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

### Core Architecture Module: `src/excel_mcp/operations/cells.py`
```
"""Reading, writing, clearing, copying and searching cell contents."""

from collections.abc import Iterator
from copy import copy

from openpyxl.cell.cell import Cell, MergedCell
from openpyxl.formula.translate import Translator
from openpyxl.worksheet.formula import ArrayFormula
from openpyxl.worksheet.worksheet import Worksheet
from pydantic import BaseModel

from excel_mcp.errors import InvalidArgumentError, LimitExceededError
from excel_mcp.formulas import check_formula
from excel_mcp.refs import MAX_COLUMN, MAX_ROW, CellRange, cell_name, parse_cell, parse_range
from excel_mcp.values import CellValue, date_number_format, to_cell, to_json


class RangeData(BaseModel):
    sheet: str
    range: str
    values: list[list[CellValue]]
    truncated: bool
    next_range: str | None = None


class WriteResult(BaseModel):
    sheet: str
    range: str
    cells_written: int


class CellMatch(BaseModel):
    sheet: str
    cell: str
    value: CellValue


class FindResult(BaseModel):
    matches: list[CellMatch]
    truncated: bool


def stored_cells(sheet: Worksheet) -> Iterator[Cell]:
    """Cells that hold a value, row by row.

    Iterating the stored cells directly avoids creating empty cells for every
    position up to max_row x max_column, as iter_rows() would.
    """
    for _, cell in sorted(sheet._cells.items()):
        if cell.value is not None:
            yield cell


def used_range(sheet: Worksheet) -> CellRange:
    """The smallest range containing every cell that has a value.

    Worksheet.max_row/max_column also count cells that only carry formatting.
    """
    cells = list(stored_cells(sheet))
    if not cells:
        return CellRange(1, 1, 1, 1)
    rows = [cell.row for cell in cells]
    cols = [cell.column for cell in cells]
    return CellRange(min(rows), min(cols), max(rows), max(cols))


def writable_cell(sheet: Worksheet, row: int, col: int) -> Cell:
    if row > MAX_ROW or col > MAX_COLUMN:
        raise InvalidArgumentError(f"{cell_name(row, col)} is outside the worksheet limits.")
    cell = sheet.cell(row, col)
    if isinstance(cell, MergedCell):
        raise InvalidArgumentError(
            f"{cell.coordinate} is inside a merged range; write to its top-left cell."
        )
    return cell


def store_value(cell: Cell, value: CellValue) -> None:
    """Store a computed value, keeping text as text even if it starts with '='."""
    cell.value = value
    if isinstance(value, str):
        cell.data_type = "s"


def read_range(sheet: Worksheet, ref: str | None, max_cells: int) -> RangeData:
    target = parse_range(ref) if ref else used_range(sheet)
    if target.cols > max_cells:
        raise LimitExceededError(
            f"Range {target} has {target.cols} columns; at most {max_cells} cells can be "
            "read per call. Read fewer columns."
        )
    last_row = min(target.max_row, target.min_row + max_cells // target.cols - 1)
    rows = sheet.iter_rows(
        min_row=target.min_row,
        max_row=last_row,
        min_col=target.min_col,
        max_col=target.max_col,
        values_only=True,
    )
    read = CellRange(target.min_row, target.min_col, last_row, target.max_col)
    truncated = last_row < target.max_row
    remaining = CellRange(last_row + 1, target.min_col, target.max_row, target.max_col)
    return RangeData(
        sheet=sheet.title,
        range=str(read),
        values=[[to_json(value) for value in row] for row in rows],
        truncated=truncated,
        next_range=str(remaining) if truncated else None,
    )


def write_range(
    sheet: Worksheet, start_cell: str, rows: list[list[CellValue]], max_cells: int
) -> WriteResult:
    start_row, start_col = parse_cell(start_cell)
    if not any(rows):
        raise InvalidArgumentError("rows must contain at least one value.")
    count = sum(len(row) for row in rows)
    if count > max_cells:
        raise LimitExceededError(f"{count:,} cells exceeds the limit of {max_cells:,} per call.")
    width = max(len(row) for row in rows)
    written = CellRange(start_row, start_col, start_row + len(rows) - 1, start_col + width - 1)
    if written.max_row > MAX_ROW or written.max_col > MAX_COLUMN:
        raise InvalidArgumentError(f"Writing {written} would go past the worksheet limits.")

    converted = [[to_cell(value) for value in row] for row in rows]
    for row_offset, row in enumerate(converted):
        for col_offset, value in enumerate(row):
            cell = writable_cell(sheet, start_row + row_offset, start_col + col_offset)
            cell.value = value
            if number_format := date_number_format(value):
                cell.number_format = number_format
    return WriteResult(sheet=sheet.title, range=str(written), cells_written=count)


def clear_range(sheet: Worksheet, ref: str, contents: bool, formats: bool, max_cells: int) -> str:
    target = parse_range(ref).within(max_cells)
    for row in sheet.iter_rows(
        min_row=target.min_row,
        max_row=target.max_row,
        min_col=target.min_col,
        max_col=target.max_col,
    ):
        for cell in row:
            if isinstance(cell, MergedCell):
                continue
            if contents:
                cell.value = None
            if formats:
                cell.style = "Normal"
    return str(target)


def copy_range(
    source: Worksheet, ref: str, target: Worksheet, target_cell: str, max_cells: int
) -> str:
    """Copy values and styles; relative references in formulas shift the way Excel shifts them."""
    area = parse_range(ref).within(max_cells)
    target_row, target_col = parse_cell(target_cell)
    destination_area = CellRange(
        target_row, target_col, target_row + area.rows - 1, target_col + area.cols - 1
    )
    snapshot = [
        [(cell.value, cell.data_type, copy(cell._style), cell.coordinate) for cell in row]
        for row in source.iter_rows(
            min_row=area.min_row,
            max_row=area.max_row,
            min_col=area.min_col,
            max_col=area.max_col,
        )
    ]
    for row_offset, row in enumerate(snapshot):
        for col_offset, (value, data_type, style, origin) in enumerate(row):
            destination = writable_cell(target, target_row + row_offset, target_col + col_offset)
            if isinstance(value, ArrayFormula):
                raise InvalidArgumentError(
                    f"{origin} holds an array formula, which cannot be copied."
                )
            if data_type == "f":
                formula = Translator(str(value), origin=origin).translate_formula(
                    destination.coordinate
                )
                check_formula(formula)
                destination.value = formula
            else:
                destination.value = value
                destination.data_type = data_type
            destination._style = style
    return str(destination_area)


def find_cells(
    sheets: list[Worksheet],
    query: str,
    exact: bool,
    case_sensitive: bool,
    max_results: int,
) -> FindResult:
    def normalize(text: str) -> str:
        return text if case_sensitive else text.casefold()

    needle = normalize(query)
    matches: list[CellMatch] = []
    for sheet in sheets:
        for cell in stored_cells(sheet):
            text = normalize(str(cell.value))
            found = text == needle if exact else needle in text
            if not found:
                continue
            if len(matches) == max_results:
                return FindResult(matches=matches, truncated=True)
            matches.append(
                CellMatch(sheet=sheet.title, cell=cell.coordinate, value=to_json(cell.value))
            )
    return FindResult(matches=matches, truncated=False)

```

### Core Architecture Module: `src/excel_mcp/operations/charts.py`
```
"""Charts built from a block of data on a sheet."""

from typing import Literal

from openpyxl.chart import AreaChart, BarChart, LineChart, PieChart, Reference, ScatterChart
from openpyxl.chart.series_factory import SeriesFactory
from openpyxl.worksheet.worksheet import Worksheet
from pydantic import BaseModel, Field

from excel_mcp.errors import InvalidArgumentError
from excel_mcp.refs import CellRange, cell_name, parse_cell, parse_range

ChartType = Literal["column", "bar", "line", "area", "pie", "scatter"]


class ChartOptions(BaseModel):
    """Chart titles, size and legend."""

    title: str | None = Field(default=None, description="Chart title.")
    x_axis_title: str | None = Field(default=None, description="Horizontal axis title.")
    y_axis_title: str | None = Field(default=None, description="Vertical axis title.")
    width_cm: float = Field(default=15, gt=0, le=100, description="Chart width in cm.")
    height_cm: float = Field(default=7.5, gt=0, le=100, description="Chart height in cm.")
    show_legend: bool = Field(default=True, description="Show the series legend.")


def create_chart(
    sheet: Worksheet,
    data_sheet: Worksheet,
    data_ref: str,
    chart_type: ChartType,
    anchor_cell: str,
    options: ChartOptions,
) -> str:
    area = parse_range(data_ref)
    if area.rows < 2 or area.cols < 2:
        raise InvalidArgumentError(
            "Chart data needs a header row and a label column plus at least one series, "
            "e.g. 'A1:C10' with labels in A and series in B and C."
        )
    anchor = cell_name(*parse_cell(anchor_cell))

    if chart_type == "scatter":
        chart = _scatter(data_sheet, area)
    else:
        chart = _categorical(data_sheet, area, chart_type)
    chart.title = options.title
    chart.width = options.width_cm  # pyright: ignore[reportAttributeAccessIssue]
    chart.height = options.height_cm  # pyright: ignore[reportAttributeAccessIssue]
    if not options.show_legend:
        chart.legend = None
    if chart_type != "pie":
        chart.x_axis.title = options.x_axis_title
        chart.y_axis.title = options.y_axis_title
        # openpyxl marks axes as deleted by default, which hides them in current Excel.
        chart.x_axis.delete = False
        chart.y_axis.delete = False

    sheet.add_chart(chart, anchor)
    return str(area)


def _categorical(sheet: Worksheet, area: CellRange, chart_type: ChartType):
    chart = {
        "column": BarChart,
        "bar": BarChart,
        "line": LineChart,
        "area": AreaChart,
        "pie": PieChart,
    }[chart_type]()
    if chart_type == "bar":
        chart.type = "bar"
    series = Reference(
        sheet,
        min_col=area.min_col + 1,
        max_col=area.max_col,
        min_row=area.min_row,
        max_row=area.max_row,
    )
    labels = Reference(sheet, min_col=area.min_col, min_row=area.min_row + 1, max_row=area.max_row)
    chart.add_data(series, titles_from_data=True)
    chart.set_categories(labels)
    return chart


def _scatter(sheet: Worksheet, area: CellRange) -> ScatterChart:
    chart = ScatterChart()
    x_values = Reference(
        sheet, min_col=area.min_col, min_row=area.min_row + 1, max_row=area.max_row
    )
    for col in range(area.min_col + 1, area.max_col + 1):
        y_values = Reference(sheet, min_col=col, min_row=area.min_row, max_row=area.max_row)
        chart.series.append(SeriesFactory(y_values, x_values, title_from_data=True))
    return chart

```

### Core Architecture Module: `src/excel_mcp/operations/files.py`
```
"""Moving whole workbook files in and out of the server as base64."""

import base64
import binascii
import io
import zipfile
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.worksheet.formula import ArrayFormula

from excel_mcp.errors import InvalidArgumentError, LimitExceededError, UnsafeFormulaError
from excel_mcp.formulas import check_formula
from excel_mcp.workspace import close_workbook, worksheets


def encode_file(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode("ascii")


def decode_workbook(content_base64: str, max_bytes: int) -> bytes:
    """Decode an uploaded workbook and check it the way the server checks its own writes."""
    try:
        content = base64.b64decode(content_base64, validate=True)
    except binascii.Error:
        raise InvalidArgumentError("content_base64 is not valid base64.") from None
    if len(content) > max_bytes:
        raise LimitExceededError(f"File is {len(content):,} bytes; the limit is {max_bytes:,}.")
    if not zipfile.is_zipfile(io.BytesIO(content)):
        raise InvalidArgumentError("The uploaded content is not an .xlsx/.xlsm workbook.")
    _check_formulas(content)
    return content


def _check_formulas(content: bytes) -> None:
    try:
        workbook = load_workbook(io.BytesIO(content))
    except Exception as error:
        # openpyxl raises many different exception types for damaged files.
        raise InvalidArgumentError(f"The uploaded workbook could not be read ({error}).") from None
    try:
        if workbook._external_links:  # pyright: ignore[reportAttributeAccessIssue]
            raise UnsafeFormulaError("Workbooks that link to other workbooks cannot be uploaded.")
        for sheet in worksheets(workbook):
            for cell in sheet._cells.values():
                if cell.data_type == "f":
                    formula = (
                        cell.value.text if isinstance(cell.value, ArrayFormula) else cell.value
                    )
                    check_formula(str(formula))
    finally:
        close_workbook(workbook)

```

### Core Architecture Module: `src/excel_mcp/operations/formatting.py`
```
"""Cell formatting and merging."""

import re
from copy import copy
from typing import Literal

from openpyxl.styles import Alignment, Border, PatternFill, Side
from openpyxl.worksheet.worksheet import Worksheet
from pydantic import BaseModel, Field

from excel_mcp.errors import InvalidArgumentError
from excel_mcp.refs import parse_range

HorizontalAlignment = Literal["general", "left", "center", "right", "fill", "justify"]
VerticalAlignment = Literal["top", "center", "bottom", "justify"]
BorderStyle = Literal["none", "thin", "medium", "thick", "double", "dashed", "dotted"]

_HEX_COLOR = re.compile(r"#?([0-9A-Fa-f]{6})")


class CellFormat(BaseModel):
    """Formatting to apply. Fields left as null keep the cell's current setting."""

    bold: bool | None = Field(default=None, description="Bold text.")
    italic: bool | None = Field(default=None, description="Italic text.")
    underline: bool | None = Field(default=None, description="Single underline.")
    strikethrough: bool | None = Field(default=None, description="Strike through text.")
    font_name: str | None = Field(default=None, description="Font family, e.g. 'Calibri'.")
    font_size: float | None = Field(default=None, gt=0, le=409, description="Size in points.")
    font_color: str | None = Field(default=None, description="Hex color, e.g. '#1F4E78'.")
    fill_color: str | None = Field(default=None, description="Background hex color.")
    number_format: str | None = Field(
        default=None, description="Excel number format, e.g. '#,##0.00', '0%', '@'."
    )
    horizontal_alignment: HorizontalAlignment | None = Field(
        default=None, description="Horizontal text alignment."
    )
    vertical_alignment: VerticalAlignment | None = Field(
        default=None, description="Vertical text alignment."
    )
    wrap_text: bool | None = Field(default=None, description="Wrap long text onto new lines.")
    border_style: BorderStyle | None = Field(
        default=None, description="Border on all four sides of every cell; 'none' removes it."
    )
    border_color: str | None = Field(default=None, description="Border hex color (default black).")


def parse_color(value: str) -> str:
    """Accept ``RRGGBB`` or ``#RRGGBB`` and return openpyxl's ``FFRRGGBB``."""
    match = _HEX_COLOR.fullmatch(value.strip())
    if not match:
        raise InvalidArgumentError(f"Invalid color {value!r}. Use a hex color like '#1F4E78'.")
    return f"FF{match.group(1).upper()}"


def format_range(sheet: Worksheet, ref: str, style: CellFormat, max_cells: int) -> str:
    target = parse_range(ref).within(max_cells)
    fill = _fill(style)
    border = _border(style)
    for row in sheet.iter_rows(
        min_row=target.min_row,
        max_row=target.max_row,
        min_col=target.min_col,
        max_col=target.max_col,
    ):
        for cell in row:
            cell.font = _font(cell.font, style)
            cell.alignment = _alignment(cell.alignment, style)
            if fill:
                cell.fill = fill
            if border:
                cell.border = border
            if style.number_format is not None:
                cell.number_format = style.number_format
    return str(target)


def _font(current, style: CellFormat):
    font = copy(current)
    if style.bold is not None:
        font.bold = style.bold
    if style.italic is not None:
        font.italic = style.italic
    if style.underline is not None:
        font.underline = "single" if style.underline else None
    if style.strikethrough is not None:
        font.strike = style.strikethrough
    if style.font_name is not None:
        font.name = style.font_name
    if style.font_size is not None:
        font.size = style.font_size
    if style.font_color is not None:
        font.color = parse_color(style.font_color)
    return font


def _alignment(current, style: CellFormat) -> Alignment:
    alignment = copy(current)
    if style.horizontal_alignment is not None:
        alignment.horizontal = style.horizontal_alignment
    if style.vertical_alignment is not None:
        alignment.vertical = style.vertical_alignment
    if style.wrap_text is not None:
        alignment.wrap_text = style.wrap_text
    return alignment


def _fill(style: CellFormat) -> PatternFill | None:
    if style.fill_color is None:
        return None
    color = parse_color(style.fill_color)
    return PatternFill(fill_type="solid", start_color=color, end_color=color)


def _border(style: CellFormat) -> Border | None:
    if style.border_style is None:
        return None
    if style.border_style == "none":
        return Border()
    color = parse_color(style.border_color or "000000")
    side = Side(style=style.border_style, color=color)
    return Border(left=side, right=side, top=side, bottom=side)


def merge_cells(sheet: Worksheet, ref: str, max_cells: int) -> str:
    target = parse_range(ref).within(max_cells)
    if target.size == 1:
        raise InvalidArgumentError("Merging needs a range of at least two cells.")
    for merged in sheet.merged_cells.ranges:
        if target.overlaps(parse_range(merged.coord)):
            raise InvalidArgumentError(f"{target} overlaps the merged range {merged.coord}.")
    sheet.merge_cells(str(target))
    return str(target)


def unmerge_cells(sheet: Worksheet, ref: str, max_cells: int) -> str:
    target = parse_range(ref).within(max_cells)
    if str(target) not in {str(merged) for merged in sheet.merged_cells.ranges}:
        raise InvalidArgumentError(f"{target} is not a merged range.")
    sheet.unmerge_cells(str(target))
    return str(target)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #172** (2026-10-02): **Actual Pivot Tables**
  *Symptoms*: ### What you want to do  In version v0.1.8 there still was the possibility to create actual dynamic Excel-PivotTables, which has now been replaced by *create_summary_table*.  Any reason why that change was made? Are there any plans to bring this feature back? We do a lot of work with complex pivot tables.  Every response is appreciated. Thank you   ### Suggested change  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for asking! Nothing was lost here: `create_summary_table` does the same thing the old tool did, and more.  In 0.1.8, `create_pivot_table` didn't create a real, refreshable Excel PivotTable. It calculated the totals in Python and wrote them as plain values on a new sheet, formatted as an Excel table named `PivotTable_…`, which is why it looked like a pivot. In 1.0 we kept that behavior and renamed the tool so the name matches what it does.  What's better in `create_summary_table`:  - **Choose where the result goes** with `target_sheet` and `target_cell`. The old tool always wrote to a new `<sheet>_pivot` sheet and replaced any existing sheet with that name. - **A different aggregation per column**, e.g. sum of `Units` and average of `Price` in one table. The old tool used a single function for every column. - **Only real groups are listed.** The old tool listed every combination of values, including empty ones. - **Clear errors**, e.g. an unknown field name tells you which fields
  > I just noticed that there is no more parameter for columns, which was present before and is in Excel Pivot Tables.  I myself do not work with Excel at all, I just develop an agent harness for the users, so communication of missing features always takes a while. I will use this ticket to give further feedback once the users have tested it.  Thank you

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
 
-When running the server with the **SSE protocol**, you **must set the `EXCEL_FILES_PATH` environment variable on the server side**. This variable tells the server where to read and write Excel files.
+When running the server with the **SSE or Streamable HTTP protocols**, you **must set the `EXCEL_FILES_PATH` environment variable on the server side**. This variable tells the server where to read and write Excel files.
 - If not set, it defaults to `./excel_files`.
 
 You can also set the `FASTMCP_PORT` environment variable to control the port the server listens on (default is `8000` if not set).
 - Example (Windows PowerShell):
   ```powershell
   $env:EXCEL_FILES_PATH="E:\MyExcelFiles"
-  $env:FASTMCP_PORT="8080"
-  uvx excel-mcp-server sse
+  $env:FASTMCP_PORT="8007"
+  uvx excel-mcp-server streamable-http
   ```
 - Example (Linux/macOS):
   ```bash
-  EXCEL_FILES_PATH=/path/to/excel_files FASTMCP_PORT=8080 uvx excel-mcp-server sse
+  EXCEL_FILES_PATH=/path/to/excel_files FASTMCP_PORT=8007 uvx ex
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

**File**: `src/excel_mcp/data.py` (modified, +12/-9)
```diff
@@ -1,5 +1,5 @@
 from pathlib import Path
-from typing import Any, Dict
+from typing import Any, Dict, List, Optional
 import logging
 
 from openpyxl import load_workbook
@@ -16,9 +16,9 @@ def read_excel_range(
     filepath: Path | str,
     sheet_name: str,
     start_cell: str = "A1",
-    end_cell: str | None = None,
+    end_cell: Optional[str] = None,
     preview_only: bool = False
-) -> list[dict[str, Any]]:
+) -> List[Dict[str, Any]]:
     """Read data from Excel range with optional preview mode"""
     try:
         wb = load_workbook(filepath, read_only=False)
@@ -91,10 +91,10 @@ def read_excel_range(
 
 def write_data(
     filepath: str,
-    sheet_name: str | None,
-    data: list[list] | None,
+    sheet_name: Optional[str],
+    data: Optional[List[List]],
     start_cell: str = "A1",
-) -> dict[str, str]:
+) -> Dict[str, str]:
     """Write data to Excel sheet with workbook handling
     
     Headers are handled intelligently based on context.
@@ -107,7 +107,10 @@ def write_data(
 
         # If no sheet specified, use active sheet
         if not sheet_name:
-            sheet_name = wb.active.title
+            active_sheet = wb.active
+            if active_sheet is None:
+                raise DataError("No active sheet found in workbook")
+            sheet_name = active_sheet.title
         elif sheet_name not in wb.sheetnames:
             wb.create_sheet(sheet_name)
 
@@ -137,7 +140,7 @@ def write_data(
 
 def _write_data_to_worksheet(
     worksheet: Worksheet, 
-    data: list[list], 
+    data: List[List], 
     start_cell: str = "A1",
 ) -> None:
     """Write data to worksheet with intelligent header handling"""
@@ -168,7 +171,7 @@ def read_excel_range_with_metadata(
     filepath: Path | str,
     sheet_name: str,
     start_cell: str = "A1",
-    end_cell: str | None = None,
+    end_cell: Optional[str] = None,
     include_validation: bool = True
 ) -> Dict[str, Any]:
     """Read data from Excel range with cell metadata including validation rules.
```

**File**: `src/excel_mcp/formatting.py` (modified, +11/-11)
```diff
@@ -1,5 +1,5 @@
 import logging
-from typing import Any, Dict
+from typing import Any, Dict, Optional
 
 from openpyxl.styles import (
     PatternFill, Border, Side, Alignment, Protection, Font,
@@ -20,21 +20,21 @@ def format_range(
     filepath: str,
     sheet_name: str,
     start_cell: str,
-    end_cell: str = None,
+    end_cell: Optional[str] = None,
     bold: bool = False,
     italic: bool = False,
     underline: bool = False,
-    font_size: int = None,
-    font_color: str = None,
-    bg_color: str = None,
-    border_style: str = None,
-    border_color: str = None,
-    number_format: str = None,
-    alignment: str = None,
+    font_size: Optional[int] = None,
+    font_color: Optional[str] = None,
+    bg_color: Optional[str] = None,
+    border_style: Optional[str] = None,
+    border_color: Optional[str] = None,
+    number_format: Optional[str] = None,
+    alignment: Optional[str] = None,
     wrap_text: bool = False,
     merge_cells: bool = False,
-    protection: Dict[str, Any] = None,
-    conditional_format: Dict[str, Any] = None
+    protection: Optional[Dict[str, Any]] = None,
+    conditional_format: Optional[Dict[str, Any]] = None
 ) -> Dict[str, Any]:
     """Apply formatting to a range of cells.
     
```

**File**: `src/excel_mcp/server.py` (modified, +49/-30)
```diff
@@ -1,6 +1,6 @@
 import logging
 import os
-from typing import Any, List, Dict
+from typing import Any, List, Dict, Optional
 
 from mcp.server.fastmcp import FastMCP
 
@@ -61,9 +61,9 @@
 # Initialize FastMCP server
 mcp = FastMCP(
     "excel-mcp",
-    version="0.1.4",
+    version="0.1.5",
     description="Excel MCP Server for manipulating Excel files",
-    dependencies=["openpyxl>=3.1.2"],
+    dependencies=["openpyxl>=3.1.5"],
     env_vars={
         "EXCEL_FILES_PATH": {
             "description": "Path to Excel files directory",
@@ -145,46 +145,47 @@ def format_range(
     filepath: str,
     sheet_name: str,
     start_cell: str,
-    end_cell: str = None,
+    end_cell: Optional[str] = None,
     bold: bool = False,
     italic: bool = False,
     underline: bool = False,
-    font_size: int = None,
-    font_color: str = None,
-    bg_color: str = None,
-    border_style: str = None,
-    border_color: str = None,
-    number_format: str = None,
-    alignment: str = None,
+    font_size: Optional[int] = None,
+    font_color: Optional[str] = None,
+    bg_color: Optional[str] = None,
+    border_style: Optional[str] = None,
+    border_color: Optional[str] = None,
+    number_format: Optional[str] = None,
+    alignment: Optional[str] = None,
     wrap_text: bool = False,
     merge_cells: bool = False,
-    protection: Dict[str, Any] = None,
-    conditional_format: Dict[str, Any] = None
+    protection: Optional[Dict[str, Any]] = None,
+    conditional_format: Optional[Dict[str, Any]] = None
 ) -> str:
     """Apply formatting to a range of cells."""
     try:
         full_path = get_excel_path(filepath)
         from excel_mcp.formatting import format_range as format_range_func
         
+        # Convert None values to appropriate defaults for the underlying function
         format_range_func(
             filepath=full_path,
             sheet_name=sheet_name,
             start_cell=start_cell,
-            end_cell=end_cell,
+            end_cell=end_cell,  # This can be None
             bold=bold,
             italic=italic,
             underline=underline,
-            font_size=font_size,
-            font_color=font_color,
-            bg_color=bg_color,
-            border_style=border_style,
-            border_color=border_color,
-            number_format=number_format,
-            alignment=alignment,
+            font_size=font_size,  # This can be None
+            font_color=font_color,  # This can be None
+            bg_color=bg_color,  # This can be None
+            border_style=border_style,  # This can be None
+            border_color=border_color,  # This can be None
+            number_format=number_format,  # This can be None
+            alignment=alignment,  # This can be None
             wrap_text=wrap_text,
             merge_cells=merge_cells,
-            protection=protection,
-            conditional_format=conditional_format
+            protection=protection,  # This can be None
+            conditional_format=conditional_format  # This can be None
         )
         return "Range formatted successfully"
     except (ValidationError, FormattingError) as e:
@@ -198,7 +199,7 @@ def read_data_from_excel(
     filepath: str,
     sheet_name: str,
     start_cell: str = "A1",
-    end_cell: str = None,
+    end_cell: Optional[str] = None,
     preview_only: bool = False
 ) -> str:
     """
@@ -329,7 +330,7 @@ def create_pivot_table(
     data_range: str,
     rows: List[str],
     values: List[str],
-    columns: List[str] = None,
+    columns: Optional[List[str]] = None,
     agg_func: str = "mean"
 ) -> str:
     """Create pivot table in worksheet."""
@@ -356,7 +357,7 @@ def create_table(
     filepath: str,
     sheet_name: str,
     data_range: str,
-    table_name: str = None,
+    table_name: Optional[str] = None,
     table_style: str = "TableStyleMedium9"
 ) -> str:
     """Creates a native Excel table from a specified range of data."""
@@ -475,7 +476,7 @@ def copy_range(
     source_start: str,
     source_end: str,
     target_start: str,
-    target_sheet: str = None
+    target_sheet: Optional[str] = None
 ) -> str:
     """Copy a range of cells to another location."""
     try:
@@ -487,7 +488,7 @@ def copy_range(
             source_start,
             source_end,
             target_start,
-            target_sheet
+            target_sheet or sheet_name  # Use source sheet if target_sheet is None
         )
         return result["message"]
     except (ValidationError, SheetError) as e:
@@ -527,7 +528,7 @@ def validate_excel_range(
     filepath: str,
     sheet_name: str,
     start_cell: str,
-    end_cell: str = None
+    end_cell: Optional[str] = None
 ) -> str:
     """Validate if a range exists and is properly formatted."""
     try:
@@ -598,7 +599,25 @@ async def run_sse():
         await mcp.run_sse_async()
     except KeyboardInterrupt:
         logger.info("Server stopped by user")
-        await mcp.shutdown()
+    except Ex
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
-        if cell_count > 0 and header_count >= cell_count * 0.5:
-            return True
-            
-    # No headers found above
-    return False
-
-def _determine_header_behavior(worksheet, start_row, start_col, data):
-    """Determine if headers should be written based on context."""
-    if not data:
-        return False  # No data means no headers
-        
-    # Check if we're in the title area (rows 1-4)
-    if start_row <= 4:
-        return False  # Don't add headers in title area
-    
-    # If we already have data in the sheet, be cautious about adding headers
-    if worksheet.max_row > 1:
-        # Check if the target row already has content
-        has_content = any(
-            worksheet.cell(row=start_row, column=start_col + i).value is not None
-            for i in range(min(5, len(data[0].keys())))
-        )
-        
-        if has_content:
-            return False  # Don't overwrite existing content with headers
-        
-        # Check if first row appears t
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
+                f"({get_column_letter(ws.min_column)}{ws.min_row}:{get_column_letter(ws.max_column)}{ws.max_row}). "
+                f"No data will be read."
             )
+            return {"range": f"{start_cell}:", "sheet_name": sheet_name, "cells": []}
 
         # Build structured cell data
+        range_str = f"{get_column_letter(start_col)}{start_row}:{get_column_letter(end_col)}{end_row}"
         range_data = {
-            "range": f"{start_cell}:{get_column_letter(end_col)}{end_row}" if end_cell else start_cell,
+            "range": range_str,
             "sheet_name": sheet_name,
             "cells": []
         }
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
         cleaned_values = [clean_field_name(field) for field in values]
```

---

### Incident Patch 9: `7f8c2be2` (2025-05-20)
**Commit Message**: chore: update Python version to 3.10 and bump package version to 0.1.3 in pyproject.toml and server.py; modify GitHub Actions workflow to use hatch for building (#29)

**File**: `.github/workflows/publish.yml` (modified, +3/-3)
```diff
@@ -22,13 +22,13 @@ jobs:
         with:
           python-version: "3.x"
 
-      - name: Install build dependencies
+      - name: Install hatch dependencies
         run: |
           python -m pip install --upgrade pip
-          pip install build
+          pip install hatch
 
       - name: Build package
-        run: python -m build
+        run: hatch build
 
       - name: Publish to PyPI
         uses: pypa/gh-action-pypi-publish@release/v1
```

**File**: `.python-version` (modified, +1/-1)
```diff
@@ -1 +1 @@
-3.12
\ No newline at end of file
+3.10
\ No newline at end of file
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "excel-mcp-server"
-version = "0.1.2"
+version = "0.1.3"
 description = "Excel MCP Server for manipulating Excel files"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `src/excel_mcp/__main__.py` (modified, +0/-1)
```diff
@@ -1,6 +1,5 @@
 import asyncio
 import typer
-from typing import Optional
 
 from .server import run_sse, run_stdio
 
```

**File**: `src/excel_mcp/server.py` (modified, +1/-3)
```diff
@@ -1,5 +1,4 @@
 import logging
-import sys
 import os
 from typing import Any, List, Dict
 
@@ -44,7 +43,6 @@
 ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
 LOG_FILE = os.path.join(ROOT_DIR, "excel-mcp.log")
 
-
 # Initialize EXCEL_FILES_PATH variable without assigning a value
 EXCEL_FILES_PATH = None
 
@@ -62,7 +60,7 @@
 # Initialize FastMCP server
 mcp = FastMCP(
     "excel-mcp",
-    version="0.1.2",
+    version="0.1.3",
     description="Excel MCP Server for manipulating Excel files",
     dependencies=["openpyxl>=3.1.2"],
     env_vars={
```

---

### Incident Patch 10: `44ef963c` (2025-04-04)
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
