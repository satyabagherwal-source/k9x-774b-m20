# Forensic Learning Record (Deep Inspection): foryourhealth111-pixel/Vibe-Skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/foryourhealth111-pixel-vibe-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/foryourhealth111-pixel/Vibe-Skills](https://github.com/foryourhealth111-pixel/Vibe-Skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:04:45.872Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `foryourhealth111-pixel/Vibe-Skills`
- **Description**: Intelligent Skill routing and workflow orchestration for AI agents — +21.12 pp reward, −29.6% tokens on SkillsBench with DeepSeekV4Flash-VE.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3573 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/vgo-cli/src/vgo_cli/core_bridge.py`
```
from __future__ import annotations

from pathlib import Path
import subprocess
from typing import Sequence

from .process import invoke_python_core
from .workspace import extend_workspace_package_path


def run_installer_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_installer.install_runtime import main as installer_main

    return invoke_python_core(installer_main, list(argv))


def run_uninstaller_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_installer.uninstall_runtime import main as uninstaller_main

    return invoke_python_core(uninstaller_main, list(argv))


def run_router_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_runtime.runtime_bridge import main as router_main

    return invoke_python_core(router_main, list(argv))


def run_canonical_entry_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_runtime.canonical_entry import main as canonical_entry_main

    return invoke_python_core(canonical_entry_main, list(argv))


def run_skill_index_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_runtime.kernel.skill_index import main as skill_index_main

    return invoke_python_core(skill_index_main, list(argv))


def run_local_kernel_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_runtime.kernel.loop import main as local_kernel_main

    return invoke_python_core(local_kernel_main, list(argv))


def run_inspect_run_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_runtime.kernel.loop import inspect_main as inspect_run_main

    return invoke_python_core(inspect_run_main, list(argv))


def run_entry_locator_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_runtime.entry_locator import main as entry_locator_main

    return invoke_python_core(entry_locator_main, list(argv))


def run_compatibility_exit_core(repo_root: Path, argv: Sequence[str]) -> subprocess.CompletedProcess[str]:
    extend_workspace_package_path(repo_root)
    from vgo_runtime.compatibility_exit import main as compatibility_exit_main

    return invoke_python_core(compatibility_exit_main, list(argv))

```

### Core Architecture Module: `apps/vgo-cli/src/vgo_cli/upgrade_state.py`
```
from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
from typing import Any


UPGRADE_STATUS_RELPATH = Path('.vibeskills') / 'upgrade-status.json'
UPSTREAM_CACHE_TTL = timedelta(hours=24)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _to_utc_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).replace(microsecond=0).strftime('%Y-%m-%dT%H:%M:%SZ')


def _parse_timestamp(raw: object) -> datetime | None:
    text = str(raw or '').strip()
    if not text:
        return None
    if text.endswith('Z'):
        text = text[:-1] + '+00:00'
    return datetime.fromisoformat(text).astimezone(timezone.utc)


def upgrade_status_path(target_root: Path) -> Path:
    return target_root / UPGRADE_STATUS_RELPATH


def load_upgrade_status(target_root: Path) -> dict[str, Any]:
    path = upgrade_status_path(target_root)
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding='utf-8-sig'))


def save_upgrade_status(target_root: Path, payload: dict[str, Any]) -> Path:
    path = upgrade_status_path(target_root)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return path


def is_upstream_cache_stale(status: dict[str, Any] | None, *, now: datetime | None = None) -> bool:
    effective_now = (now or _utc_now()).astimezone(timezone.utc)
    checked_at = _parse_timestamp((status or {}).get('remote_latest_checked_at'))
    if checked_at is None:
        return True
    return effective_now - checked_at > UPSTREAM_CACHE_TTL


def merge_upgrade_status(
    existing: dict[str, Any] | None = None,
    *,
    installed: dict[str, Any] | None = None,
    remote: dict[str, Any] | None = None,
) -> dict[str, Any]:
    merged: dict[str, Any] = dict(existing or {})

    if installed:
        recorded_at = installed.get('installed_recorded_at')
        if isinstance(recorded_at, datetime):
            recorded_at_text = _to_utc_timestamp(recorded_at)
        else:
            recorded_at_text = _to_utc_timestamp(_parse_timestamp(recorded_at) or _utc_now())
        merged.update(
            {
                'host_id': str(installed.get('host_id') or merged.get('host_id') or '').strip(),
                'target_root': str(Path(installed.get('target_root') or merged.get('target_root') or '.').resolve()),
                'repo_remote': str(installed.get('repo_remote') or merged.get('repo_remote') or '').strip(),
                'repo_default_branch': str(installed.get('repo_default_branch') or merged.get('repo_default_branch') or '').strip(),
                'installed_version': str(installed.get('installed_version') or '').strip(),
                'installed_commit': str(installed.get('installed_commit') or '').strip(),
                'installed_recorded_at': recorded_at_text,
            }
        )

    if remote:
        checked_at = remote.get('remote_latest_checked_at')
        if isinstance(checked_at, datetime):
            checked_at_text = _to_utc_timestamp(checked_at)
        else:
            checked_at_text = _to_utc_timestamp(_parse_timestamp(checked_at) or _utc_now())
        merged.update(
            {
                'remote_latest_commit': str(remote.get('remote_latest_commit') or '').strip(),
                'remote_latest_version': str(remote.get('remote_latest_version') or '').strip(),
                'remote_latest_checked_at': checked_at_text,
            }
        )

    installed_commit = str(merged.get('installed_commit') or '').strip()
    remote_commit = str(merged.get('remote_latest_commit') or '').strip()
    installed_version = str(merged.get('installed_version') or '').strip()
    remote_version = str(merged.get('remote_latest_version') or '').strip()
    merged['update_available'] = bool(
        (remote_commit and installed_commit and remote_commit != installed_commit)
        or (remote_version and installed_version and remote_version != installed_version)
    )
    return merged

```

### Core Architecture Module: `bundled/skills/.system/skill-installer/scripts/github_utils.py`
```
#!/usr/bin/env python3
"""Shared GitHub helpers for skill install scripts."""

from __future__ import annotations

import os
import urllib.request


def github_request(url: str, user_agent: str) -> bytes:
    headers = {"User-Agent": user_agent}
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        headers["Authorization"] = f"token {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return resp.read()


def github_api_contents_url(repo: str, path: str, ref: str) -> str:
    return f"https://api.github.com/repos/{repo}/contents/{path}?ref={ref}"

```

### Core Architecture Module: `bundled/skills/doc/scripts/render_docx.py`
```
import argparse
import os
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from os import makedirs, replace
from os.path import abspath, basename, exists, expanduser, join, splitext
from shutil import which
import sys
from typing import Sequence, cast
from zipfile import ZipFile

from pdf2image import convert_from_path, pdfinfo_from_path

TWIPS_PER_INCH: int = 1440


def ensure_system_tools() -> None:
    missing: list[str] = []
    for tool in ("soffice", "pdftoppm"):
        if which(tool) is None:
            missing.append(tool)
    if missing:
        tools = ", ".join(missing)
        raise RuntimeError(
            f"Missing required system tool(s): {tools}. Install LibreOffice and Poppler, then retry."
        )


def calc_dpi_via_ooxml_docx(input_path: str, max_w_px: int, max_h_px: int) -> int:
    """Calculate DPI from OOXML `word/document.xml` page size (w:pgSz in twips).

    DOCX stores page dimensions in section properties as twips (1/1440 inch).
    We read the first encountered section's page size and compute an isotropic DPI
    that fits within the target max pixel dimensions.
    """
    with ZipFile(input_path, "r") as zf:
        xml = zf.read("word/document.xml")
    root = ET.fromstring(xml)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}

    # Common placements: w:body/w:sectPr or w:body/w:p/w:pPr/w:sectPr
    sect_pr = root.find(".//w:sectPr", ns)
    if sect_pr is None:
        raise RuntimeError("Section properties not found in document.xml")
    pg_sz = sect_pr.find("w:pgSz", ns)
    if pg_sz is None:
        raise RuntimeError("Page size not found in section properties")

    # Values are in twips
    w_twips_str = pg_sz.get(
        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}w"
    ) or pg_sz.get("w")
    h_twips_str = pg_sz.get(
        "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}h"
    ) or pg_sz.get("h")

    if not w_twips_str or not h_twips_str:
        raise RuntimeError("Page size attributes missing in pgSz")

    width_in = int(w_twips_str) / TWIPS_PER_INCH
    height_in = int(h_twips_str) / TWIPS_PER_INCH
    if width_in <= 0 or height_in <= 0:
        raise RuntimeError("Invalid page size values in document.xml")
    return round(min(max_w_px / width_in, max_h_px / height_in))


def calc_dpi_via_pdf(input_path: str, max_w_px: int, max_h_px: int) -> int:
    """Convert input to PDF and compute DPI from its page size."""
    with tempfile.TemporaryDirectory(prefix="soffice_profile_") as user_profile:
        with tempfile.TemporaryDirectory(prefix="soffice_convert_") as convert_tmp_dir:
            stem = splitext(basename(input_path))[0]
            pdf_path = convert_to_pdf(input_path, user_profile, convert_tmp_dir, stem)
            if not (pdf_path and exists(pdf_path)):
                raise RuntimeError("Failed to convert input to PDF for DPI computation.")

            info = pdfinfo_from_path(pdf_path)
            size_val = info.get("Page size")
            if not size_val:
                for k, v in info.items():
                    if isinstance(v, str) and "size" in k.lower() and "pts" in v:
                        size_val = v
                        break
            if not isinstance(size_val, str):
                raise RuntimeError("Failed to read PDF page size for DPI computation.")

            m = re.search(r"(\d+)\s*x\s*(\d+)\s*pts", size_val)
            if not m:
                raise RuntimeError("Unrecognized PDF page size format.")
            width_pts = int(m.group(1))
            height_pts = int(m.group(2))
            width_in = width_pts / 72.0
            height_in = height_pts / 72.0
            if width_in <= 0 or height_in <= 0:
                raise RuntimeError("Invalid PDF page size values.")
            return round(min(max_w_px / width_in, max_h_px / height_in))


def run_cmd_no_check(cmd: list[str]) -> None:
    subprocess.run(
        cmd,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        env=os.environ.copy(),
    )


def convert_to_pdf(
    doc_path: str,
    user_profile: str,
    convert_tmp_dir: str,
    stem: str,
) -> str:
    # Try direct DOC(X) -> PDF
    cmd_pdf = [
        "soffice",
        "-env:UserInstallation=file://" + user_profile,
        "--invisible",
        "--headless",
        "--norestore",
        "--convert-to",
        "pdf",
        "--outdir",
        convert_tmp_dir,
        doc_path,
    ]
    run_cmd_no_check(cmd_pdf)

    pdf_path = join(convert_tmp_dir, f"{stem}.pdf")
    if exists(pdf_path):
        return pdf_path

    # Fallback: DOCX -> ODT, then ODT -> PDF
    cmd_odt = [
        "soffice",
        "-env:UserInstallation=file://" + user_profile,
        "--invisible",
        "--headless",
        "--norestore",
        "--convert-to",
        "odt",
        "--outdir",
        convert_tmp_dir,
        doc_path,
    ]
    run_cmd_no_check(cmd_odt)

    odt_path = join(convert_tmp_dir, f"{stem}.odt")

    if exists(odt_path):
        cmd_odt_pdf = [
            "soffice",
            "-env:UserInstallation=file://" + user_profile,
            "--invisible",
            "--headless",
            "--norestore",
            "--convert-to",
            "pdf",
            "--outdir",
            convert_tmp_dir,
            odt_path,
        ]
        run_cmd_no_check(cmd_odt_pdf)
        if exists(pdf_path):
            return pdf_path

    return ""


def rasterize(
    doc_path: str,
    out_dir: str,
    dpi: int,
) -> Sequence[str]:
    """Rasterise DOCX (or similar) to images placed in out_dir and return their paths.

    Images are named as page-<N>.<ext> with pages starting at 1.
    """
    makedirs(out_dir, exist_ok=True)
    doc_path = abspath(doc_path)
    stem = splitext(basename(doc_path))[0]

    # Use a unique user profile to avoid LibreOffice profile lock when running concurrently
    with tempfile.TemporaryDirectory(prefix="soffice_profile_") as user_profile:
        # Write conversion outputs into a temp directory to avoid any IO oddities
        with tempfile.TemporaryDirectory(prefix="soffice_convert_") as convert_tmp_dir:
            pdf_path = convert_to_pdf(
                doc_path,
                user_profile,
                convert_tmp_dir,
                stem,
            )

            if not pdf_path or not exists(pdf_path):
                raise RuntimeError(
                    "Failed to produce PDF for rasterization (direct and ODT fallback)."
                )
            paths_raw = cast(
                list[str],
                convert_from_path(
                    pdf_path,
                    dpi=dpi,
                    fmt="png",
                    thread_count=8,
                    output_folder=out_dir,
                    paths_only=True,
                    output_file="page",
                ),
            )

    # Rename convert_from_path's output format f'page{thread_id:04d}-{page_num:02d}.<ext>' to 'page-<num>.<ext>'
    pages: list[tuple[int, str]] = []
    for src_path in paths_raw:
        base = splitext(basename(src_path))[0]
        page_num_str = base.split("-")[-1]
        page_num = int(page_num_str)
        dst_path = join(out_dir, f"page-{page_num}.png")
        replace(src_path, dst_path)
        pages.append((page_num, dst_path))
    pages.sort(key=lambda t: t[0])
    final_paths = [path for _, path in pages]
    return final_paths


def main() -> None:
    parser = argparse.ArgumentParser(description="Render DOCX-like file to PNG images.")
    parser.add_argument(
        "input_path",
        type=str,
        help="Path to the input DOCX file (or compatible).",
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        default=None,
        help=(
            "Output directory for the rendered images. "
            "Defaults to a folder next to the input named after the input file (without extension)."
        ),
    )
    parser.add_argument(
        "--width",
        type=int,
        default=1600,
        help=(
            "Approximate maximum width in pixels after isotropic scaling (default 1600). "
            "The actual value may exceed slightly."
        ),
    )
    parser.add_argument(
        "--height",
        type=int,
        default=2000,
        help=(
            "Approximate maximum height in pixels after isotropic scaling (default 2000). "
            "The actual value may exceed slightly."
        ),
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=None,
        help=("Override computed DPI. If provided, skips DOCX/PDF-based DPI calculation."),
    )
    args = parser.parse_args()

    try:
        ensure_system_tools()

        input_path = abspath(expanduser(args.input_path))
        out_dir = (
            abspath(expanduser(args.output_dir)) if args.output_dir else splitext(input_path)[0]
        )

        if args.dpi is not None:
            dpi = int(args.dpi)
        else:
            try:
                if input_path.lower().endswith((".docx", ".docm", ".dotx", ".dotm")):
                    dpi = calc_dpi_via_ooxml_docx(input_path, args.width, args.height)
                else:
                    raise RuntimeError("Skip OOXML DPI; not a DOCX container")
            except Exception:
                dpi = calc_dpi_via_pdf(input_path, args.width, args.height)

        rasterize(input_path, out_dir, dpi)
        print("Pages rendered to " + out_dir)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `bundled/skills/document-skills/docx/scripts/utilities.py`
```
#!/usr/bin/env python3
"""
Utilities for editing OOXML documents.

This module provides XMLEditor, a tool for manipulating XML files with support for
line-number-based node finding and DOM manipulation. Each element is automatically
annotated with its original line and column position during parsing.

Example usage:
    editor = XMLEditor("document.xml")

    # Find node by line number or range
    elem = editor.get_node(tag="w:r", line_number=519)
    elem = editor.get_node(tag="w:p", line_number=range(100, 200))

    # Find node by text content
    elem = editor.get_node(tag="w:p", contains="specific text")

    # Find node by attributes
    elem = editor.get_node(tag="w:r", attrs={"w:id": "target"})

    # Combine filters
    elem = editor.get_node(tag="w:p", line_number=range(1, 50), contains="text")

    # Replace, insert, or manipulate
    new_elem = editor.replace_node(elem, "<w:r><w:t>new text</w:t></w:r>")
    editor.insert_after(new_elem, "<w:r><w:t>more</w:t></w:r>")

    # Save changes
    editor.save()
"""

import html
from pathlib import Path
from typing import Optional, Union

import defusedxml.minidom
import defusedxml.sax


class XMLEditor:
    """
    Editor for manipulating OOXML XML files with line-number-based node finding.

    This class parses XML files and tracks the original line and column position
    of each element. This enables finding nodes by their line number in the original
    file, which is useful when working with Read tool output.

    Attributes:
        xml_path: Path to the XML file being edited
        encoding: Detected encoding of the XML file ('ascii' or 'utf-8')
        dom: Parsed DOM tree with parse_position attributes on elements
    """

    def __init__(self, xml_path):
        """
        Initialize with path to XML file and parse with line number tracking.

        Args:
            xml_path: Path to XML file to edit (str or Path)

        Raises:
            ValueError: If the XML file does not exist
        """
        self.xml_path = Path(xml_path)
        if not self.xml_path.exists():
            raise ValueError(f"XML file not found: {xml_path}")

        with open(self.xml_path, "rb") as f:
            header = f.read(200).decode("utf-8", errors="ignore")
        self.encoding = "ascii" if 'encoding="ascii"' in header else "utf-8"

        parser = _create_line_tracking_parser()
        self.dom = defusedxml.minidom.parse(str(self.xml_path), parser)

    def get_node(
        self,
        tag: str,
        attrs: Optional[dict[str, str]] = None,
        line_number: Optional[Union[int, range]] = None,
        contains: Optional[str] = None,
    ):
        """
        Get a DOM element by tag and identifier.

        Finds an element by either its line number in the original file or by
        matching attribute values. Exactly one match must be found.

        Args:
            tag: The XML tag name (e.g., "w:del", "w:ins", "w:r")
            attrs: Dictionary of attribute name-value pairs to match (e.g., {"w:id": "1"})
            line_number: Line number (int) or line range (range) in original XML file (1-indexed)
            contains: Text string that must appear in any text node within the element.
                      Supports both entity notation (&#8220;) and Unicode characters (\u201c).

        Returns:
            defusedxml.minidom.Element: The matching DOM element

        Raises:
            ValueError: If node not found or multiple matches found

        Example:
            elem = editor.get_node(tag="w:r", line_number=519)
            elem = editor.get_node(tag="w:r", line_number=range(100, 200))
            elem = editor.get_node(tag="w:del", attrs={"w:id": "1"})
            elem = editor.get_node(tag="w:p", attrs={"w14:paraId": "12345678"})
            elem = editor.get_node(tag="w:commentRangeStart", attrs={"w:id": "0"})
            elem = editor.get_node(tag="w:p", contains="specific text")
            elem = editor.get_node(tag="w:t", contains="&#8220;Agreement")  # Entity notation
            elem = editor.get_node(tag="w:t", contains="\u201cAgreement")   # Unicode character
        """
        matches = []
        for elem in self.dom.getElementsByTagName(tag):
            # Check line_number filter
            if line_number is not None:
                parse_pos = getattr(elem, "parse_position", (None,))
                elem_line = parse_pos[0]

                # Handle both single line number and range
                if isinstance(line_number, range):
                    if elem_line not in line_number:
                        continue
                else:
                    if elem_line != line_number:
                        continue

            # Check attrs filter
            if attrs is not None:
                if not all(
                    elem.getAttribute(attr_name) == attr_value
                    for attr_name, attr_value in attrs.items()
                ):
                    continue

            # Check contains filter
            if contains is not None:
                elem_text = self._get_element_text(elem)
                # Normalize the search string: convert HTML entities to Unicode characters
                # This allows searching for both "&#8220;Rowan" and ""Rowan"
                normalized_contains = html.unescape(contains)
                if normalized_contains not in elem_text:
                    continue

            # If all applicable filters passed, this is a match
            matches.append(elem)

        if not matches:
            # Build descriptive error message
            filters = []
            if line_number is not None:
                line_str = (
                    f"lines {line_number.start}-{line_number.stop - 1}"
                    if isinstance(line_number, range)
                    else f"line {line_number}"
                )
                filters.append(f"at {line_str}")
            if attrs is not None:
                filters.append(f"with attributes {attrs}")
            if contains is not None:
                filters.append(f"containing '{contains}'")

            filter_desc = " ".join(filters) if filters else ""
            base_msg = f"Node not found: <{tag}> {filter_desc}".strip()

            # Add helpful hint based on filters used
            if contains:
                hint = "Text may be split across elements or use different wording."
            elif line_number:
                hint = "Line numbers may have changed if document was modified."
            elif attrs:
                hint = "Verify attribute values are correct."
            else:
                hint = "Try adding filters (attrs, line_number, or contains)."

            raise ValueError(f"{base_msg}. {hint}")
        if len(matches) > 1:
            raise ValueError(
                f"Multiple nodes found: <{tag}>. "
                f"Add more filters (attrs, line_number, or contains) to narrow the search."
            )
        return matches[0]

    def _get_element_text(self, elem):
        """
        Recursively extract all text content from an element.

        Skips text nodes that contain only whitespace (spaces, tabs, newlines),
        which typically represent XML formatting rather than document content.

        Args:
            elem: defusedxml.minidom.Element to extract text from

        Returns:
            str: Concatenated text from all non-whitespace text nodes within the element
        """
        text_parts = []
        for node in elem.childNodes:
            if node.nodeType == node.TEXT_NODE:
                # Skip whitespace-only text nodes (XML formatting)
                if node.data.strip():
                    text_parts.append(node.data)
            elif node.nodeType == node.ELEMENT_NODE:
                text_parts.append(self._get_element_text(node))
        return "".join(text_parts)

    def replace_node(self, elem, new_content):
        """
        Replace a DOM element with new XML content.

        Args:
            elem: defusedxml.minidom.Element to replace
            new_content: String containing XML to replace the node with

        Returns:
            List[defusedxml.minidom.Node]: All inserted nodes

        Example:
            new_nodes = editor.replace_node(old_elem, "<w:r><w:t>text</w:t></w:r>")
        """
        parent = elem.parentNode
        nodes = self._parse_fragment(new_content)
        for node in nodes:
            parent.insertBefore(node, elem)
        parent.removeChild(elem)
        return nodes

    def insert_after(self, elem, xml_content):
        """
        Insert XML content after a DOM element.

        Args:
            elem: defusedxml.minidom.Element to insert after
            xml_content: String containing XML to insert

        Returns:
            List[defusedxml.minidom.Node]: All inserted nodes

        Example:
            new_nodes = editor.insert_after(elem, "<w:r><w:t>text</w:t></w:r>")
        """
        parent = elem.parentNode
        next_sibling = elem.nextSibling
        nodes = self._parse_fragment(xml_content)
        for node in nodes:
            if next_sibling:
                parent.insertBefore(node, next_sibling)
            else:
                parent.appendChild(node)
        return nodes

    def insert_before(self, elem, xml_content):
        """
        Insert XML content before a DOM element.

        Args:
            elem: defusedxml.minidom.Element to insert before
            xml_content: String containing XML to insert

        Returns:
            List[defusedxml.minidom.Node]: All inserted nodes

        Example:
            new_nodes = editor.insert_before(elem, "<w:r><w:t>text</w:t></w:r>")
        """
        parent = elem.parentNode
        nodes = self._parse_fragment(xml_content)
        for node in nodes:
            parent.insertBefore(node, elem)
        return nodes

    def append_to(self, elem, xml_content):
        """
        Append XML content as
```

### Core Architecture Module: `bundled/skills/docx/scripts/utilities.py`
```
#!/usr/bin/env python3
"""
Utilities for editing OOXML documents.

This module provides XMLEditor, a tool for manipulating XML files with support for
line-number-based node finding and DOM manipulation. Each element is automatically
annotated with its original line and column position during parsing.

Example usage:
    editor = XMLEditor("document.xml")

    # Find node by line number or range
    elem = editor.get_node(tag="w:r", line_number=519)
    elem = editor.get_node(tag="w:p", line_number=range(100, 200))

    # Find node by text content
    elem = editor.get_node(tag="w:p", contains="specific text")

    # Find node by attributes
    elem = editor.get_node(tag="w:r", attrs={"w:id": "target"})

    # Combine filters
    elem = editor.get_node(tag="w:p", line_number=range(1, 50), contains="text")

    # Replace, insert, or manipulate
    new_elem = editor.replace_node(elem, "<w:r><w:t>new text</w:t></w:r>")
    editor.insert_after(new_elem, "<w:r><w:t>more</w:t></w:r>")

    # Save changes
    editor.save()
"""

import html
from pathlib import Path
from typing import Optional, Union

import defusedxml.minidom
import defusedxml.sax


class XMLEditor:
    """
    Editor for manipulating OOXML XML files with line-number-based node finding.

    This class parses XML files and tracks the original line and column position
    of each element. This enables finding nodes by their line number in the original
    file, which is useful when working with Read tool output.

    Attributes:
        xml_path: Path to the XML file being edited
        encoding: Detected encoding of the XML file ('ascii' or 'utf-8')
        dom: Parsed DOM tree with parse_position attributes on elements
    """

    def __init__(self, xml_path):
        """
        Initialize with path to XML file and parse with line number tracking.

        Args:
            xml_path: Path to XML file to edit (str or Path)

        Raises:
            ValueError: If the XML file does not exist
        """
        self.xml_path = Path(xml_path)
        if not self.xml_path.exists():
            raise ValueError(f"XML file not found: {xml_path}")

        with open(self.xml_path, "rb") as f:
            header = f.read(200).decode("utf-8", errors="ignore")
        self.encoding = "ascii" if 'encoding="ascii"' in header else "utf-8"

        parser = _create_line_tracking_parser()
        self.dom = defusedxml.minidom.parse(str(self.xml_path), parser)

    def get_node(
        self,
        tag: str,
        attrs: Optional[dict[str, str]] = None,
        line_number: Optional[Union[int, range]] = None,
        contains: Optional[str] = None,
    ):
        """
        Get a DOM element by tag and identifier.

        Finds an element by either its line number in the original file or by
        matching attribute values. Exactly one match must be found.

        Args:
            tag: The XML tag name (e.g., "w:del", "w:ins", "w:r")
            attrs: Dictionary of attribute name-value pairs to match (e.g., {"w:id": "1"})
            line_number: Line number (int) or line range (range) in original XML file (1-indexed)
            contains: Text string that must appear in any text node within the element.
                      Supports both entity notation (&#8220;) and Unicode characters (\u201c).

        Returns:
            defusedxml.minidom.Element: The matching DOM element

        Raises:
            ValueError: If node not found or multiple matches found

        Example:
            elem = editor.get_node(tag="w:r", line_number=519)
            elem = editor.get_node(tag="w:r", line_number=range(100, 200))
            elem = editor.get_node(tag="w:del", attrs={"w:id": "1"})
            elem = editor.get_node(tag="w:p", attrs={"w14:paraId": "12345678"})
            elem = editor.get_node(tag="w:commentRangeStart", attrs={"w:id": "0"})
            elem = editor.get_node(tag="w:p", contains="specific text")
            elem = editor.get_node(tag="w:t", contains="&#8220;Agreement")  # Entity notation
            elem = editor.get_node(tag="w:t", contains="\u201cAgreement")   # Unicode character
        """
        matches = []
        for elem in self.dom.getElementsByTagName(tag):
            # Check line_number filter
            if line_number is not None:
                parse_pos = getattr(elem, "parse_position", (None,))
                elem_line = parse_pos[0]

                # Handle both single line number and range
                if isinstance(line_number, range):
                    if elem_line not in line_number:
                        continue
                else:
                    if elem_line != line_number:
                        continue

            # Check attrs filter
            if attrs is not None:
                if not all(
                    elem.getAttribute(attr_name) == attr_value
                    for attr_name, attr_value in attrs.items()
                ):
                    continue

            # Check contains filter
            if contains is not None:
                elem_text = self._get_element_text(elem)
                # Normalize the search string: convert HTML entities to Unicode characters
                # This allows searching for both "&#8220;Rowan" and ""Rowan"
                normalized_contains = html.unescape(contains)
                if normalized_contains not in elem_text:
                    continue

            # If all applicable filters passed, this is a match
            matches.append(elem)

        if not matches:
            # Build descriptive error message
            filters = []
            if line_number is not None:
                line_str = (
                    f"lines {line_number.start}-{line_number.stop - 1}"
                    if isinstance(line_number, range)
                    else f"line {line_number}"
                )
                filters.append(f"at {line_str}")
            if attrs is not None:
                filters.append(f"with attributes {attrs}")
            if contains is not None:
                filters.append(f"containing '{contains}'")

            filter_desc = " ".join(filters) if filters else ""
            base_msg = f"Node not found: <{tag}> {filter_desc}".strip()

            # Add helpful hint based on filters used
            if contains:
                hint = "Text may be split across elements or use different wording."
            elif line_number:
                hint = "Line numbers may have changed if document was modified."
            elif attrs:
                hint = "Verify attribute values are correct."
            else:
                hint = "Try adding filters (attrs, line_number, or contains)."

            raise ValueError(f"{base_msg}. {hint}")
        if len(matches) > 1:
            raise ValueError(
                f"Multiple nodes found: <{tag}>. "
                f"Add more filters (attrs, line_number, or contains) to narrow the search."
            )
        return matches[0]

    def _get_element_text(self, elem):
        """
        Recursively extract all text content from an element.

        Skips text nodes that contain only whitespace (spaces, tabs, newlines),
        which typically represent XML formatting rather than document content.

        Args:
            elem: defusedxml.minidom.Element to extract text from

        Returns:
            str: Concatenated text from all non-whitespace text nodes within the element
        """
        text_parts = []
        for node in elem.childNodes:
            if node.nodeType == node.TEXT_NODE:
                # Skip whitespace-only text nodes (XML formatting)
                if node.data.strip():
                    text_parts.append(node.data)
            elif node.nodeType == node.ELEMENT_NODE:
                text_parts.append(self._get_element_text(node))
        return "".join(text_parts)

    def replace_node(self, elem, new_content):
        """
        Replace a DOM element with new XML content.

        Args:
            elem: defusedxml.minidom.Element to replace
            new_content: String containing XML to replace the node with

        Returns:
            List[defusedxml.minidom.Node]: All inserted nodes

        Example:
            new_nodes = editor.replace_node(old_elem, "<w:r><w:t>text</w:t></w:r>")
        """
        parent = elem.parentNode
        nodes = self._parse_fragment(new_content)
        for node in nodes:
            parent.insertBefore(node, elem)
        parent.removeChild(elem)
        return nodes

    def insert_after(self, elem, xml_content):
        """
        Insert XML content after a DOM element.

        Args:
            elem: defusedxml.minidom.Element to insert after
            xml_content: String containing XML to insert

        Returns:
            List[defusedxml.minidom.Node]: All inserted nodes

        Example:
            new_nodes = editor.insert_after(elem, "<w:r><w:t>text</w:t></w:r>")
        """
        parent = elem.parentNode
        next_sibling = elem.nextSibling
        nodes = self._parse_fragment(xml_content)
        for node in nodes:
            if next_sibling:
                parent.insertBefore(node, next_sibling)
            else:
                parent.appendChild(node)
        return nodes

    def insert_before(self, elem, xml_content):
        """
        Insert XML content before a DOM element.

        Args:
            elem: defusedxml.minidom.Element to insert before
            xml_content: String containing XML to insert

        Returns:
            List[defusedxml.minidom.Node]: All inserted nodes

        Example:
            new_nodes = editor.insert_before(elem, "<w:r><w:t>text</w:t></w:r>")
        """
        parent = elem.parentNode
        nodes = self._parse_fragment(xml_content)
        for node in nodes:
            parent.insertBefore(node, elem)
        return nodes

    def append_to(self, elem, xml_content):
        """
        Append XML content as
```

### Core Architecture Module: `bundled/skills/scholar-evaluation/scripts/calculate_scores.py`
```
#!/usr/bin/env python3
"""
ScholarEval Score Calculator

Calculate aggregate evaluation scores from dimension-level ratings.
Supports weighted averaging, threshold analysis, and score visualization.

Usage:
    python calculate_scores.py --scores <dimension_scores.json> --output <report.txt>
    python calculate_scores.py --scores <dimension_scores.json> --weights <weights.json>
    python calculate_scores.py --interactive

Author: ScholarEval Framework
License: MIT
"""

import json
import argparse
import sys
from typing import Dict, List, Optional
from pathlib import Path


# Default dimension weights (total = 100%)
DEFAULT_WEIGHTS = {
    "problem_formulation": 0.15,
    "literature_review": 0.15,
    "methodology": 0.20,
    "data_collection": 0.10,
    "analysis": 0.15,
    "results": 0.10,
    "writing": 0.10,
    "citations": 0.05
}

# Quality level definitions
QUALITY_LEVELS = {
    (4.5, 5.0): ("Exceptional", "Ready for top-tier publication"),
    (4.0, 4.4): ("Strong", "Publication-ready with minor revisions"),
    (3.5, 3.9): ("Good", "Major revisions required, promising work"),
    (3.0, 3.4): ("Acceptable", "Significant revisions needed"),
    (2.0, 2.9): ("Weak", "Fundamental issues, major rework required"),
    (0.0, 1.9): ("Poor", "Not suitable without complete revision")
}


def load_scores(filepath: Path) -> Dict[str, float]:
    """Load dimension scores from JSON file."""
    try:
        with open(filepath, 'r') as f:
            scores = json.load(f)

        # Validate scores
        for dim, score in scores.items():
            if not 1 <= score <= 5:
                raise ValueError(f"Score for {dim} must be between 1 and 5, got {score}")

        return scores
    except FileNotFoundError:
        print(f"Error: File not found: {filepath}")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in {filepath}")
        sys.exit(1)
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)


def load_weights(filepath: Optional[Path] = None) -> Dict[str, float]:
    """Load dimension weights from JSON file or return defaults."""
    if filepath is None:
        return DEFAULT_WEIGHTS

    try:
        with open(filepath, 'r') as f:
            weights = json.load(f)

        # Validate weights sum to 1.0
        total = sum(weights.values())
        if not 0.99 <= total <= 1.01:  # Allow small floating point errors
            raise ValueError(f"Weights must sum to 1.0, got {total}")

        return weights
    except FileNotFoundError:
        print(f"Error: File not found: {filepath}")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in {filepath}")
        sys.exit(1)
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)


def calculate_weighted_average(scores: Dict[str, float], weights: Dict[str, float]) -> float:
    """Calculate weighted average score."""
    total_score = 0.0
    total_weight = 0.0

    for dimension, score in scores.items():
        # Handle dimension name variations (e.g., "problem_formulation" vs "problem-formulation")
        dim_key = dimension.replace('-', '_').lower()
        weight = weights.get(dim_key, 0.0)

        total_score += score * weight
        total_weight += weight

    # Normalize if not all dimensions were scored
    if total_weight > 0:
        return total_score / total_weight * (sum(weights.values()) / total_weight)
    return 0.0


def get_quality_level(score: float) -> tuple:
    """Get quality level description for a given score."""
    for (low, high), (level, description) in QUALITY_LEVELS.items():
        if low <= score <= high:
            return level, description
    return "Unknown", "Score out of expected range"


def generate_bar_chart(scores: Dict[str, float], max_width: int = 50) -> str:
    """Generate ASCII bar chart of dimension scores."""
    lines = []
    max_name_len = max(len(name) for name in scores.keys())

    for dimension, score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
        bar_length = int((score / 5.0) * max_width)
        bar = '█' * bar_length
        padding = ' ' * (max_name_len - len(dimension))
        lines.append(f"  {dimension}{padding} │ {bar} {score:.2f}")

    return '\n'.join(lines)


def identify_strengths_weaknesses(scores: Dict[str, float]) -> tuple:
    """Identify top strengths and areas for improvement."""
    sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    strengths = [dim for dim, score in sorted_scores[:3] if score >= 4.0]
    weaknesses = [dim for dim, score in sorted_scores[-3:] if score < 3.5]

    return strengths, weaknesses


def generate_report(scores: Dict[str, float], weights: Dict[str, float],
                   output_file: Optional[Path] = None) -> str:
    """Generate comprehensive evaluation report."""
    overall_score = calculate_weighted_average(scores, weights)
    quality_level, quality_desc = get_quality_level(overall_score)
    strengths, weaknesses = identify_strengths_weaknesses(scores)

    report_lines = [
        "="*70,
        "SCHOLAREVAL SCORE REPORT",
        "="*70,
        "",
        f"Overall Score: {overall_score:.2f} / 5.00",
        f"Quality Level: {quality_level}",
        f"Assessment: {quality_desc}",
        "",
        "="*70,
        "DIMENSION SCORES",
        "="*70,
        "",
        generate_bar_chart(scores),
        "",
        "="*70,
        "DETAILED BREAKDOWN",
        "="*70,
        ""
    ]

    # Add detailed scores with weights
    for dimension, score in sorted(scores.items()):
        dim_key = dimension.replace('-', '_').lower()
        weight = weights.get(dim_key, 0.0)
        weighted_contribution = score * weight
        percentage = weight * 100

        report_lines.append(
            f"  {dimension:25s} {score:.2f}/5.00  "
            f"(weight: {percentage:4.1f}%, contribution: {weighted_contribution:.3f})"
        )

    report_lines.extend([
        "",
        "="*70,
        "ASSESSMENT SUMMARY",
        "="*70,
        ""
    ])

    if strengths:
        report_lines.append("Top Strengths:")
        for dim in strengths:
            report_lines.append(f"  • {dim}: {scores[dim]:.2f}/5.00")
        report_lines.append("")

    if weaknesses:
        report_lines.append("Areas for Improvement:")
        for dim in weaknesses:
            report_lines.append(f"  • {dim}: {scores[dim]:.2f}/5.00")
        report_lines.append("")

    # Add recommendations based on score
    report_lines.extend([
        "="*70,
        "RECOMMENDATIONS",
        "="*70,
        ""
    ])

    if overall_score >= 4.5:
        report_lines.append("  Excellent work! Ready for submission to top-tier venues.")
    elif overall_score >= 4.0:
        report_lines.append("  Strong work. Address minor issues identified in weaknesses.")
    elif overall_score >= 3.5:
        report_lines.append("  Good foundation. Focus on major revisions in weak dimensions.")
    elif overall_score >= 3.0:
        report_lines.append("  Significant revisions needed. Prioritize weakest dimensions.")
    elif overall_score >= 2.0:
        report_lines.append("  Major rework required. Consider restructuring approach.")
    else:
        report_lines.append("  Fundamental revision needed across multiple dimensions.")

    report_lines.append("")
    report_lines.append("="*70)

    report = '\n'.join(report_lines)

    # Write to file if specified
    if output_file:
        try:
            with open(output_file, 'w') as f:
                f.write(report)
            print(f"\nReport saved to: {output_file}")
        except IOError as e:
            print(f"Error writing to {output_file}: {e}")

    return report


def interactive_mode():
    """Run interactive score entry mode."""
    print("ScholarEval Interactive Score Calculator")
    print("="*50)
    print("\nEnter scores for each dimension (1-5):")
    print("(Press Enter to skip a dimension)\n")

    scores = {}
    dimensions = [
        "problem_formulation",
        "literature_review",
        "methodology",
        "data_collection",
        "analysis",
        "results",
        "writing",
        "citations"
    ]

    for dim in dimensions:
        while True:
            dim_display = dim.replace('_', ' ').title()
            user_input = input(f"{dim_display}: ").strip()

            if not user_input:
                break

            try:
                score = float(user_input)
                if 1 <= score <= 5:
                    scores[dim] = score
                    break
                else:
                    print("  Score must be between 1 and 5")
            except ValueError:
                print("  Invalid input. Please enter a number between 1 and 5")

    if not scores:
        print("\nNo scores entered. Exiting.")
        return

    print("\n" + "="*50)
    print("SCORES ENTERED:")
    for dim, score in scores.items():
        print(f"  {dim.replace('_', ' ').title()}: {score}")

    print("\nCalculating overall assessment...\n")

    report = generate_report(scores, DEFAULT_WEIGHTS)
    print(report)

    # Ask if user wants to save
    save = input("\nSave report to file? (y/n): ").strip().lower()
    if save == 'y':
        filename = input("Enter filename [scholareval_report.txt]: ").strip()
        if not filename:
            filename = "scholareval_report.txt"
        generate_report(scores, DEFAULT_WEIGHTS, Path(filename))


def main():
    parser = argparse.ArgumentParser(
        description="Calculate aggregate ScholarEval scores from dimension ratings",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Calculate from JSON file
  python calculate_scores.py --scores my_scores.json

  # Calculate with custom weights
  python calculate_scores.py --scores my_scores.json --weights custom_weights.json

  # Save report to file
  python calculate_scores.p
```

### Core Architecture Module: `bundled/skills/senior-data-scientist/scripts/feature_engineering_pipeline.py`
```
#!/usr/bin/env python3
"""
Feature Engineering Pipeline
Production-grade tool for senior data scientist
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class FeatureEngineeringPipeline:
    """Production-grade feature engineering pipeline"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.results = {
            'status': 'initialized',
            'start_time': datetime.now().isoformat(),
            'processed_items': 0
        }
        logger.info(f"Initialized {self.__class__.__name__}")
    
    def validate_config(self) -> bool:
        """Validate configuration"""
        logger.info("Validating configuration...")
        # Add validation logic
        logger.info("Configuration validated")
        return True
    
    def process(self) -> Dict:
        """Main processing logic"""
        logger.info("Starting processing...")
        
        try:
            self.validate_config()
            
            # Main processing
            result = self._execute()
            
            self.results['status'] = 'completed'
            self.results['end_time'] = datetime.now().isoformat()
            
            logger.info("Processing completed successfully")
            return self.results
            
        except Exception as e:
            self.results['status'] = 'failed'
            self.results['error'] = str(e)
            logger.error(f"Processing failed: {e}")
            raise
    
    def _execute(self) -> Dict:
        """Execute main logic"""
        # Implementation here
        return {'success': True}

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Feature Engineering Pipeline"
    )
    parser.add_argument('--input', '-i', required=True, help='Input path')
    parser.add_argument('--output', '-o', required=True, help='Output path')
    parser.add_argument('--config', '-c', help='Configuration file')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        config = {
            'input': args.input,
            'output': args.output
        }
        
        processor = FeatureEngineeringPipeline(config)
        results = processor.process()
        
        print(json.dumps(results, indent=2))
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

```

### Core Architecture Module: `bundled/skills/senior-ml-engineer/scripts/ml_monitoring_suite.py`
```
#!/usr/bin/env python3
"""
Ml Monitoring Suite
Production-grade tool for senior ml/ai engineer
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class MlMonitoringSuite:
    """Production-grade ml monitoring suite"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.results = {
            'status': 'initialized',
            'start_time': datetime.now().isoformat(),
            'processed_items': 0
        }
        logger.info(f"Initialized {self.__class__.__name__}")
    
    def validate_config(self) -> bool:
        """Validate configuration"""
        logger.info("Validating configuration...")
        # Add validation logic
        logger.info("Configuration validated")
        return True
    
    def process(self) -> Dict:
        """Main processing logic"""
        logger.info("Starting processing...")
        
        try:
            self.validate_config()
            
            # Main processing
            result = self._execute()
            
            self.results['status'] = 'completed'
            self.results['end_time'] = datetime.now().isoformat()
            
            logger.info("Processing completed successfully")
            return self.results
            
        except Exception as e:
            self.results['status'] = 'failed'
            self.results['error'] = str(e)
            logger.error(f"Processing failed: {e}")
            raise
    
    def _execute(self) -> Dict:
        """Execute main logic"""
        # Implementation here
        return {'success': True}

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Ml Monitoring Suite"
    )
    parser.add_argument('--input', '-i', required=True, help='Input path')
    parser.add_argument('--output', '-o', required=True, help='Output path')
    parser.add_argument('--config', '-c', help='Configuration file')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        config = {
            'input': args.input,
            'output': args.output
        }
        
        processor = MlMonitoringSuite(config)
        results = processor.process()
        
        print(json.dumps(results, indent=2))
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

```

### Core Architecture Module: `bundled/skills/senior-ml-engineer/scripts/model_deployment_pipeline.py`
```
#!/usr/bin/env python3
"""
Model Deployment Pipeline
Production-grade tool for senior ml/ai engineer
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ModelDeploymentPipeline:
    """Production-grade model deployment pipeline"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.results = {
            'status': 'initialized',
            'start_time': datetime.now().isoformat(),
            'processed_items': 0
        }
        logger.info(f"Initialized {self.__class__.__name__}")
    
    def validate_config(self) -> bool:
        """Validate configuration"""
        logger.info("Validating configuration...")
        # Add validation logic
        logger.info("Configuration validated")
        return True
    
    def process(self) -> Dict:
        """Main processing logic"""
        logger.info("Starting processing...")
        
        try:
            self.validate_config()
            
            # Main processing
            result = self._execute()
            
            self.results['status'] = 'completed'
            self.results['end_time'] = datetime.now().isoformat()
            
            logger.info("Processing completed successfully")
            return self.results
            
        except Exception as e:
            self.results['status'] = 'failed'
            self.results['error'] = str(e)
            logger.error(f"Processing failed: {e}")
            raise
    
    def _execute(self) -> Dict:
        """Execute main logic"""
        # Implementation here
        return {'success': True}

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Model Deployment Pipeline"
    )
    parser.add_argument('--input', '-i', required=True, help='Input path')
    parser.add_argument('--output', '-o', required=True, help='Output path')
    parser.add_argument('--config', '-c', help='Configuration file')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        config = {
            'input': args.input,
            'output': args.output
        }
        
        processor = ModelDeploymentPipeline(config)
        results = processor.process()
        
        print(json.dumps(results, indent=2))
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

```

### Core Architecture Module: `bundled/skills/senior-prompt-engineer/scripts/agent_orchestrator.py`
```
#!/usr/bin/env python3
"""
Agent Orchestrator
Production-grade tool for senior prompt engineer
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AgentOrchestrator:
    """Production-grade agent orchestrator"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.results = {
            'status': 'initialized',
            'start_time': datetime.now().isoformat(),
            'processed_items': 0
        }
        logger.info(f"Initialized {self.__class__.__name__}")
    
    def validate_config(self) -> bool:
        """Validate configuration"""
        logger.info("Validating configuration...")
        # Add validation logic
        logger.info("Configuration validated")
        return True
    
    def process(self) -> Dict:
        """Main processing logic"""
        logger.info("Starting processing...")
        
        try:
            self.validate_config()
            
            # Main processing
            result = self._execute()
            
            self.results['status'] = 'completed'
            self.results['end_time'] = datetime.now().isoformat()
            
            logger.info("Processing completed successfully")
            return self.results
            
        except Exception as e:
            self.results['status'] = 'failed'
            self.results['error'] = str(e)
            logger.error(f"Processing failed: {e}")
            raise
    
    def _execute(self) -> Dict:
        """Execute main logic"""
        # Implementation here
        return {'success': True}

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Agent Orchestrator"
    )
    parser.add_argument('--input', '-i', required=True, help='Input path')
    parser.add_argument('--output', '-o', required=True, help='Output path')
    parser.add_argument('--config', '-c', help='Configuration file')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        config = {
            'input': args.input,
            'output': args.output
        }
        
        processor = AgentOrchestrator(config)
        results = processor.process()
        
        print(json.dumps(results, indent=2))
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

```

### Core Architecture Module: `bundled/skills/senior-prompt-engineer/scripts/prompt_optimizer.py`
```
#!/usr/bin/env python3
"""
Prompt Optimizer
Production-grade tool for senior prompt engineer
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class PromptOptimizer:
    """Production-grade prompt optimizer"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.results = {
            'status': 'initialized',
            'start_time': datetime.now().isoformat(),
            'processed_items': 0
        }
        logger.info(f"Initialized {self.__class__.__name__}")
    
    def validate_config(self) -> bool:
        """Validate configuration"""
        logger.info("Validating configuration...")
        # Add validation logic
        logger.info("Configuration validated")
        return True
    
    def process(self) -> Dict:
        """Main processing logic"""
        logger.info("Starting processing...")
        
        try:
            self.validate_config()
            
            # Main processing
            result = self._execute()
            
            self.results['status'] = 'completed'
            self.results['end_time'] = datetime.now().isoformat()
            
            logger.info("Processing completed successfully")
            return self.results
            
        except Exception as e:
            self.results['status'] = 'failed'
            self.results['error'] = str(e)
            logger.error(f"Processing failed: {e}")
            raise
    
    def _execute(self) -> Dict:
        """Execute main logic"""
        # Implementation here
        return {'success': True}

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Prompt Optimizer"
    )
    parser.add_argument('--input', '-i', required=True, help='Input path')
    parser.add_argument('--output', '-o', required=True, help='Output path')
    parser.add_argument('--config', '-c', help='Configuration file')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        config = {
            'input': args.input,
            'output': args.output
        }
        
        processor = PromptOptimizer(config)
        results = processor.process()
        
        print(json.dumps(results, indent=2))
        sys.exit(0)
        
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #307** (2026-08-31): **installer: recover partial uninstalls and type CLI exits**
  *Symptoms*: ## Summary  - preserve receipt-backed ownership across partial uninstall failures and process termination - recover interrupted install/update transactions with a persistent journal and bounded cross-process lock - validate receipt, manifest, metadata, symlink, junction, hardlink, and Windows path-alias boundaries - hash managed files through no-follow handles and report leaf links as drift while safely unlinking them during uninstall - expose stable typed CLI exit codes for state, missing-resource, permission, timeout/unavailable, and I/O failures - retain detailed failed, permission-denied, and unavailable file/directory results for retry  ## Surfaces touched  - `packages/installer-core/src/vgo_installer/simple_skill_installer.py` - `apps/vgo-cli/src/vgo_cli/{commands,errors,hosts,main,process}.py` - focused installer, CLI, infrastructure, integration, and runtime-neutral tests  No Z0, mirror, vendor, or generated output surfaces are changed.  ## Proof  - Command: `py -3 -m pytest tests/unit/test_simple_skill_installer.py tests/unit/test_vgo_cli_commands.py tests/unit/test_vgo_cli_infra_split.py -q`   - Output: `125 passed, 7 skipped in 60.39s`   - Claim: focused recovery, path-boundary, exit-code, host, and process behavior passes on Windows. - Command: targeted 17-file CLI, installer, wrapper, integration, and runtime-neutral suite   - Output: `203 passed, 7 skipped in 74.87s`   - Claim: the related lifecycle and compatibility matrix passes on Windows. - Command: `wsl.exe
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/foryourhealth111-pixel/Vibe-Skills/pull/307)  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `1752579c-e05d-423d-b880-3ed8acce469a`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between d583d27ed8a963beb8a8bda486c2ded8efe2364b and 8ca4e2d435175b1703bb124cc3934d2199cd31ab.  </details>  <details> <summary>📒 Files selected for processing (1)</summary>  * `tests/unit/test_simple_skill_installer.py` 

- **Issue #305** (2026-08-31): **`CliError` has no exit-code contract, so every failure exits 1 undifferentiated**
  *Symptoms*: Small but it bites scripting. `apps/vgo-cli/src/vgo_cli/errors.py` is the entire error surface:  ```python class CliError(RuntimeError):     pass ```  No code field, no subclasses. Meanwhile `main.py` already has a `compatibility_exit_command` in its import list (`main.py:6`), which implies the CLI *does* care about distinguishing exit conditions somewhere.  Consequence: a CI wrapper cannot tell "unknown host" from "python too old" from "install target not writable" without string-matching the message. Adding `class CliError(RuntimeError): exit_code = 1` and letting subclasses override is a ~10 line change that makes the CLI scriptable.
  **Post-Mortem & Fix Analysis**:
  > Thank you for your report. We are investigating.

- **Issue #304** (2026-08-31): **Failed `uninstall_vibe_skill` bricks the install: the receipt is deleted first, and reinstall then refuses to proceed**
  *Symptoms*: Order of operations in the simple installer's uninstall:  ```python # packages/installer-core/src/vgo_installer/simple_skill_installer.py:350     for entry in receipt.get("files") or []:         ...         if file_path.is_file():             file_path.unlink()             removed_files.append(relpath)      receipt_path.unlink() ```  Now the reinstall guard:  ```python # packages/installer-core/src/vgo_installer/simple_skill_installer.py:220     if install_root.exists() and not receipt_path.is_file():         raise RuntimeError(f"Install root already exists without a Vibe install receipt: {install_root}") ```  Trigger: uninstall hits `PermissionError` on one file (open handle on Windows, root-owned file, read-only mount) after unlinking a few hundred others. Or the process is killed mid-loop.  Observed: some files removed, receipt gone or about to be. Re-running uninstall → `RuntimeError: Vibe install receipt is missing` (`simple_skill_installer.py:345`). Running install → `RuntimeError: Install root already exists without a Vibe install receipt`. Both doors locked; the user's only recourse is `rm -rf` by hand, which is precisely the operation the receipt system exists to avoid.  Expected: (1) delete the receipt *last*, and only after all owned files are gone; (2) tolerate per-file failures by collecting them into a returned `failed_files` list rather than aborting; (3) give install an escape hatch — `--adopt`/`--force` that re-derives ownership — so a partially-uninstalled t
  **Post-Mortem & Fix Analysis**:
  > Thank you for your report. We are investigating.

- **Issue #303** (2026-08-29): **Readme**
  *Symptoms*:   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Removed the Star History chart and related section from the English README.   * Removed the corresponding Star History content from the Chinese README.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/foryourhealth111-pixel/Vibe-Skills/pull/303)  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: failure by coderabbit.ai -->  > [!CAUTION] > ## Review failed >  > The pull request is closed.  <!-- end of auto-generated comment: failure by coderabbit.ai -->  <!-- recent_review_start -->  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Pro Plus  **Run ID**: `aabfbf94-304f-4794-b876-49d3b70827f6`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between be2b48fef5f5ed56ae772ad2508ef8609f83bd19 and 48db377e9d082d0ba3249cf2dd3be6

- **Issue #302** (2026-08-29): **Readme fix**
  *Symptoms*:   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Documentation**   * Added benchmark analysis explaining how clearer objectives, task decomposition, selective skill usage, dependency-aware execution, planning, and pre-delivery checks improve task performance.   * Documented reductions in ineffective tool loops, repeated context reading, rework, token usage, and tool calls.   * Added corresponding performance insights to the Chinese documentation.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/foryourhealth111-pixel/Vibe-Skills/pull/302)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The README files add English and Chinese benchmark analysis. The text attributes improved performance to task planning, decomposition, selective Skill use, dependency-ordered execution, and pre-delivery checks.  ### Changes  **Benchmark analysis documentation**  |Layer / File(s)|Summary| |---|---| |**Document benchmark workflow analysis** <br> `README.md`, `README.zh.md`|The README files describe the workflow factors associated with benchmark performance and reduced ineffective tool calls, repeated context processing, token usage, and rework.|  **Estimated code revi

- **Issue #301** (2026-08-29): **feat(runtime): carry Skill guidance through planning and delivery**
  *Symptoms*: ## Summary  - Extend the existing production Skill Card pipeline to retain or derive `inputs`, `outputs`, `plan_hints`, and `verify_hints`. - Carry user-confirmed Skill guidance into WorkPlan and bound ModuleAssignments while removing automatic candidate guidance before confirmation or after an agent-direct choice. - Validate explicit module dependencies, apply a stable topological order, and preserve dependency links in delivery artifacts. - Add a concise WorkDossier delivery summary that reports verified results, locations, checks, and genuine blockers while excluding scaffolds. - Harden Markdown guidance parsing for matching long or nested code fences, and invalidate completed work when dependencies, verification, or accepted Skill guidance changes. - Bind resumed work to content identity: persist the selected Skill's SHA-256 and each completed artifact's SHA-256, rerun legacy records without hashes, and send post-completion artifact changes back for rework. - Release the integrated runtime as `4.1.0`, synchronized across version governance, all Python packages, bilingual README/install surfaces, and generated distribution manifests. - Make `release-cut.ps1` honor `legacy_write_mode=disabled`, keeping retired Markdown release surfaces externalized while updating the version authority, ledger, Skill marker, and distribution manifests. - Surface the public SkillsBench evidence near the top of both READMEs, with high-resolution task-outcome and resource-use figures, concise m
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/foryourhealth111-pixel/Vibe-Skills/pull/301)  <!-- review_stack_entry_end --> <!-- This is an auto-generated comment: review paused by coderabbit.ai -->  > [!NOTE] > ## Reviews paused >  > It looks like this branch is under active development. To avoid overwhelming you with review comments due to an influx of new commits, CodeRabbit has automatically paused this review. You can configure this behavior by changing the `reviews.auto_review.auto_pause_after_reviewed_commits` setting. >  > Use the following commands to manage reviews: > - `@coderabbitai resume` to resume automatic reviews. > - `@coderabbitai review` to trigger a single review. >  > Use the checkboxes below for quick actions: > - [ ] <!-- {"checkboxId":"7f6cc2e2-2e4e-
  > CodeRabbit follow-up:  - Fixed the stale-resume finding in `50f6749`: `_can_reuse_previous_work` now compares `depends_on`, `verification`, `task_verification`, `plan_hints`, and `verify_hints` in addition to the existing Skill and acceptance fields. Regression tests cover dependency, verification, and Skill-guidance changes. - The dependent-unit observation was reviewed against the current kernel contract. `execute_work_unit` only writes `needs_execution` scaffolds (`artifact_kind=scaffold`, `proof_ready=false`, `used_skill=None`); it does not perform domain execution or mark a prerequisite completed. Creating the complete scaffold set is intentional so the Agent can execute the dependency-ordered plan. The existing Agent contract controls real progression by dependency readiness, and the verifier rejects scaffold-only results. No runtime change was made for this point. - Focused verification after both fixes: `61 passed, 3 skipped`. Canonical validation: `165 passed`.
  > Follow-up hardening is now included in this PR:  - `6e08f10` persists the selected Skill content SHA-256 and completed artifact SHA-256 values, invalidates legacy or changed resume records, and makes the verifier return changed artifacts for rework. - `686bb4b` appends the final `4.1.0` release-ledger record bound to that runtime fix.  Focused behavior now passes with 74 tests and 3 skips. Canonical Python validation passes with 165 tests. The final release-ledger/release-cut set passes with 29 tests, and both version gates pass 9/9 after the ledger update. 

- **Issue #287** (2026-08-11): **governance: collapse the live documentation control plane**
  *Symptoms*: ## Summary  This PR implements the direct runtime and governance cleanup requested for #264.  - Route generated requirements, plans, status, proof, and manifests through the canonical `.vibeskills/runs/<run_id>` sink. - Disable default legacy documentation writes in the live contract. - Add a tracked-Markdown census with migration and strict modes. - Reduce the governed live-document registry to 28 registered documents plus 1 explicit legal exclusion, with zero unregistered documents. - Remove dated governance, plan, status, proof, archive, and superseded control-plane records from the main tree. - Update gates, runtime-neutral contracts, integration tests, and navigation to use executable contracts and current entrypoints. - Keep `bundled/skills` unchanged.  ## Verification  - Strict live-document census: PASS (`registered=28`, `excluded=1`, `unregistered=0`) - Live contract and document gate tests: 73 passed - Runtime artifact and local-kernel tests: 75 passed, 3 skipped - Runtime-neutral issue-scope tests: 49 passed - Version consistency gate: 9/9 PASS - Release truth consistency gate: PASS - `git diff --check`: PASS  The full local pytest invocation exceeded the 20-minute execution limit; the focused suites above and the completed integration/unit baselines cover the changed contracts.  ## Scope  - Version remains `4.0.0`. - No GitHub Release, tag, or publication workflow is included. - No new financial content is introduced.  Refs #264
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- This is an auto-generated comment: rate limited by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Too many files! >  > This PR contains 729 files, which is 429 over the limit of 300. >  > To get a review, reduce the PR to 300 files or fewer by splitting it into smaller PRs or changing its base branch. >  > Usage-priced reviews support at most 300 files. >  > <details> > <summary>⚙️ Run configuration</summary> >  > **Configuration used**: defaults >  > **Review profile**: CHILL >  > **Plan**: Pro Plus >  > **Run ID**: `eadd46e2-b92a-4b7a-ada1-2e94748abd78` >  > </details> >  > <details> > <summary>📥 Commits</summary> >  > Reviewing files that changed from the base of the PR and between ef32a8a9c17721e66825beb8f03815f6b60d6d48 and 204753e077c06fed320a34e57a2c2f8ee3cb759b. >  > </details> >  > <details> > <summary>📒 Files selected for processing (729)</summary> >  > * `CONTRIBUTING.md` > * `README.md

- **Issue #286** (2026-08-11): **contracts: make governance artifact resolution fail closed**
  *Symptoms*: ## Summary  - Load and validate `config/live-document-contract.json` strictly in Python and PowerShell. - Reject missing or malformed contracts and reject historical documentation roots, including descendants, as artifact workspaces or primary destinations. - Derive canonical run, session receipt, re-entry, and child-stage paths from the executable contract. - Record compatibility destinations, mode, and removal release in manifests and receipts. - Make session ownership, retention, source, and destination boundaries explicit and behavior-tested.  ## Guarded surfaces  - `scripts/runtime/**` - `scripts/verify/vibe-no-duplicate-canonical-surface-gate.ps1` - `config/live-document-contract.json`  ## Proof bundle  | Command | Output | Claim | | --- | --- | --- | | `py -3 -m pytest tests/unit/test_canonical_vibe_entry_launcher.py tests/unit/test_local_kernel_execution.py tests/unit/test_live_governance_contract.py tests/integration/test_shared_run_artifact_contract.py -q` | `210 passed, 3 skipped` | Cross-language resolution, fail-closed validation, compatibility reporting, and canonical launch behavior pass. | | `py -3 -m pytest tests/integration -q` | `253 passed` | The complete integration layer, including PowerShell interoperability, passes. | | Changed runtime-neutral suite | `54 passed, 4 skipped` | Cross-host memory, installed runtime, session ownership, and root-child behavior remain compatible. | | `py -3 -m pytest tests/unit -q` | `622 passed, 3 skipped` | The complete un
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/foryourhealth111-pixel/Vibe-Skills/pull/286?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  The runtime now uses `config/live-document-contract.json` as the executable artifact authority. Python and PowerShell validate the same contract, resolve session and artifact roots, record compatibility writes, synchronize receipts, and enforce canonical paths for root and child runs.  ### Changes  **Runtime artifact governance**  |Layer / File(s)|Summary| |---|---| |**Contract model and executable governance** <br> `config/live-document-contract.json`, `docs/governance/...`, `packages/contrac

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

### Incident Patch 1: `ddcaa2af` (2026-08-31)
**Commit Message**: Merge pull request #307 from foryourhealth111-pixel/codex/issues-304-305-fix

installer: recover partial uninstalls and type CLI exits

**File**: `apps/vgo-cli/src/vgo_cli/commands.py` (modified, +109/-26)
```diff
@@ -8,7 +8,14 @@
 import sys
 
 from .core_bridge import run_canonical_entry_core, run_compatibility_exit_core, run_entry_locator_core, run_inspect_run_core, run_local_kernel_core, run_router_core, run_skill_index_core
-from .errors import CliError
+from .errors import (
+    CliError,
+    CliIoError,
+    CliMissingResourceError,
+    CliPermissionError,
+    CliStateError,
+    CliUnavailableError,
+)
 from .output import print_json_payload
 from .process import print_process_output, run_powershell_file, run_subprocess
 from .repo import get_installed_runtime_config, get_local_release_metadata
@@ -18,6 +25,18 @@
 PROJECT_URL = "https://github.com/foryourhealth111-pixel/Vibe-Skills"
 
 
+def _installer_cli_error(exc: RuntimeError | OSError | ValueError) -> CliError:
+    if isinstance(exc, PermissionError):
+        return CliPermissionError(str(exc))
+    if isinstance(exc, FileNotFoundError):
+        return CliMissingResourceError(str(exc))
+    if isinstance(exc, TimeoutError):
+        return CliUnavailableError(str(exc))
+    if isinstance(exc, OSError):
+        return CliIoError(str(exc))
+    return CliStateError(str(exc))
+
+
 def _resolve_skills_dir(raw_value: str) -> Path:
     if str(raw_value or '').strip():
         return Path(raw_value).expanduser().resolve()
@@ -50,12 +69,37 @@ def _load_public_release_bundle(source_root: Path) -> dict[str, object] | None:
     bundle_path = source_root / "release-bundle.json"
     if not bundle_path.is_file():
         return None
-    payload = json.loads(bundle_path.read_text(encoding="utf-8"))
+    try:
+        payload = json.loads(bundle_path.read_text(encoding="utf-8"))
+    except ValueError as exc:
+        raise CliStateError(f"Unreadable public release bundle: {bundle_path}") from exc
     if not isinstance(payload, dict):
-        raise CliError(f"Expected JSON object: {bundle_path}")
+        raise CliStateError(f"Expected JSON object: {bundle_path}")
     return payload
 
 
+def _bundle_mapping(
+    bundle: dict[str, object],
+    field_name: str,
+    bundle_path: Path,
+) -> dict[str, object]:
+    value = bundle.get(field_name)
+    if not isinstance(value, dict):
+        raise CliStateError(f"Public release bundle field '{field_name}' must be an object: {bundle_path}")
+    return value
+
+
+def _bundle_required_text(
+    mapping: dict[str, object],
+    field_name: str,
+    bundle_path: Path,
+) -> str:
+    value = mapping.get(field_name)
+    if not isinstance(value, str) or not value.strip():
+        raise CliStateError(f"Public release bundle field '{field_name}' must be non-empty text: {bundle_path}")
+    return value.strip()
+
+
 def _local_release_version(source_root: Path) -> str:
     try:
         return str(get_local_release_metadata(source_root).get("version") or "").strip()
@@ -66,15 +110,34 @@ def _local_release_version(source_root: Path) -> str:
 def _install_source_kwargs(source_root: Path) -> dict[str, object]:
     bundle = _load_public_release_bundle(source_root)
     if bundle is not None:
-        public_install = bundle.get("public_install") or {}
-        if str(public_install.get("source_kind") or "").strip() == "public_release":
-            release = bundle.get("release") or {}
-            asset = bundle.get("asset") or {}
-            version = str(release.get("version") or "").strip()
-            asset_name = str(asset.get("file_name") or "").strip()
-            if not version or not asset_name:
-                raise CliError("Public release bundle is missing release version or asset name.")
-            digest = str(asset.get("payload_digest_sha256") or "").strip()
+        public_install_value = bundle.get("public_install")
+        if public_install_value is None:
+            public_install: dict[str, object] = {}
+        elif isinstance(public_install_value, dict):
+            public_install = public_install_value
+        else:
+            raise CliStateError(
+                f"Public release bundle field 'public_install' must be an object: "
+                f"{source_root / 'release-bundle.json'}"
+            )
+        source_kind = public_install.get("source_kind")
+        if source_kind is not None and not isinstance(source_kind, str):
+            raise CliStateError(
+                f"Public release bundle field 'source_kind' must be text: "
+                f"{source_root / 'release-bundle.json'}"
+            )
+        if str(source_kind or "").strip() == "public_release":
+            bundle_path = source_root / "release-bundle.json"
+            release = _bundle_mapping(bundle, "release", bundle_path)
+            asset = _bundle_mapping(bundle, "asset", bundle_path)
+            version = _bundle_required_text(release, "version", bundle_path)
+            asset_name = _bundle_required_text(asset, "file_name", bundle_path)
+            digest_value = asset.get("payload_digest_sha256")
+            if digest_value is not None and not isinstance(digest_value, str):
+        
```

**File**: `apps/vgo-cli/src/vgo_cli/errors.py` (modified, +33/-1)
```diff
@@ -1,5 +1,37 @@
 from __future__ import annotations
 
+from enum import IntEnum
+
+
+class CliExitCode(IntEnum):
+    FAILURE = 1
+    USAGE = 2
+    INVALID_STATE = 3
+    MISSING_RESOURCE = 4
+    PERMISSION_DENIED = 5
+    UNAVAILABLE = 6
+    IO_ERROR = 7
+
 
 class CliError(RuntimeError):
-    pass
+    exit_code = CliExitCode.FAILURE
+
+
+class CliStateError(CliError):
+    exit_code = CliExitCode.INVALID_STATE
+
+
+class CliMissingResourceError(CliError):
+    exit_code = CliExitCode.MISSING_RESOURCE
+
+
+class CliPermissionError(CliError):
+    exit_code = CliExitCode.PERMISSION_DENIED
+
+
+class CliUnavailableError(CliError):
+    exit_code = CliExitCode.UNAVAILABLE
+
+
+class CliIoError(CliError):
+    exit_code = CliExitCode.IO_ERROR
```

**File**: `apps/vgo-cli/src/vgo_cli/hosts.py` (modified, +4/-2)
```diff
@@ -5,7 +5,7 @@
 from pathlib import Path
 from types import ModuleType
 
-from .errors import CliError
+from .errors import CliError, CliUnavailableError
 from .workspace import extend_workspace_package_path
 
 
@@ -59,7 +59,9 @@ def _resolve_host_entry(host_id: str | None) -> tuple[str, dict[str, object]]:
         try:
             entry = dict(registry_module.resolve_adapter_entry(registry, normalized))
         except ValueError as exc:
-            raise CliError(f'Unable to resolve host registry entry for: {host_id}') from exc
+            raise CliUnavailableError(
+                f'Unable to resolve host registry entry for: {host_id}'
+            ) from exc
     return normalized, entry
 
 
```

**File**: `apps/vgo-cli/src/vgo_cli/main.py` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ def main(argv: list[str] | None = None) -> int:
         if message:
             for line in message.splitlines():
                 print(f'[FAIL] {line}', file=sys.stderr)
-        return 1
+        return int(exc.exit_code)
 
 
 if __name__ == '__main__':
```

**File**: `apps/vgo-cli/src/vgo_cli/process.py` (modified, +2/-2)
```diff
@@ -11,7 +11,7 @@
 from typing import Any, Callable, Sequence
 import warnings
 
-from .errors import CliError
+from .errors import CliUnavailableError
 
 
 REPO_ROOT = Path(__file__).resolve().parents[4]
@@ -259,7 +259,7 @@ def run_powershell_file(script_path: Path, *args: str) -> subprocess.CompletedPr
         if checked:
             detail_parts.append(f"candidates checked: {', '.join(checked)}")
         detail = f"; {'; '.join(detail_parts)}" if detail_parts else ""
-        raise CliError(f"PowerShell is required to run: {script_path}{detail}")
+        raise CliUnavailableError(f"PowerShell is required to run: {script_path}{detail}")
     shell_path = str(resolution["host_path"])
     leaf = Path(shell_path).name.lower()
     command = [shell_path, '-NoProfile']
```

**File**: `packages/installer-core/src/vgo_installer/simple_skill_installer.py` (modified, +2393/-109)
```diff
@@ -1,9 +1,20 @@
 from __future__ import annotations
 
+from contextlib import contextmanager
+import errno
+from functools import wraps
 import hashlib
 import json
-from pathlib import Path
+import os
+import secrets
+from dataclasses import dataclass
+from pathlib import Path, PurePosixPath, PureWindowsPath
 import shutil
+import stat
+import tempfile
+import threading
+import time
+from typing import Callable, Iterator, NoReturn, ParamSpec, TypeVar, cast
 
 from ._bootstrap import ensure_contracts_src_on_path
 
@@ -40,19 +51,283 @@
     "packages/verification-core/src/vgo_verify/test_baseline_audit.py",
 }
 RECEIPT_RELPATH = ".vibeskills/install-receipt.json"
+OPERATION_LOCK_RELPATH = ".vibeskills/vibe-operation.lock"
+OPERATION_LOCK_TIMEOUT_SECONDS = 30.0
+INSTALL_STATE_RELPATH = ".vibeskills/vibe-install-state.json"
+INSTALL_STATE_KIND = "vibe-skill-install-transaction"
+INSTALL_STATE_PREPARING = "preparing"
+INSTALL_STATE_PREPARED = "prepared"
+INSTALL_RECOVERY_COMMITTED = "committed"
+INSTALL_RECOVERY_ROLLED_BACK = "rolled_back"
+UNINSTALL_STATE_RELPATH = ".vibeskills/vibe-uninstall-state.json"
+UNINSTALL_STATE_KIND = "vibe-skill-uninstall-state"
+UNINSTALL_STATE_MANAGED_FILES_REMOVED = "managed_files_removed"
+UNINSTALL_COMPLETE_RELPATH = ".vibeskills/vibe-uninstall-complete.json"
+UNINSTALL_COMPLETE_KIND = "vibe-skill-uninstall-completion"
+UNINSTALL_COMPLETE_STATUS = "completed"
+
+
+@dataclass
+class _InstallFileChange:
+    relpath: str
+    destination: Path
+    staged_path: Path | None
+    backup_path: Path | None = None
+    destination_existed: bool = False
+    old_sha256: str = ""
+    new_sha256: str = ""
+
+
+@dataclass(frozen=True)
+class _InstallRecovery:
+    disposition: str
+    receipt_existed: bool
+
+
+@dataclass(frozen=True)
+class _InstallOperationFailure:
+    detail: str
+    error: Exception
+
+
+@dataclass(frozen=True)
+class _InstallTreeEntry:
+    path: Path
+    is_directory: bool
+    is_link: bool
+
+
+@dataclass(frozen=True)
+class _UninstallCompletionCommitFailure:
+    relpath: str
+    error: OSError
+
+
+class _FileChangedDuringReadError(RuntimeError):
+    pass
+
+
+_P = ParamSpec("_P")
+_R = TypeVar("_R")
+_PROCESS_OPERATION_LOCK = threading.RLock()
+_PROCESS_OPERATION_LOCK_DEPTH = 0
+_PROCESS_OPERATION_LOCK_PATH: Path | None = None
+
+
+def _open_windows_file_no_follow(path: Path) -> int:
+    import ctypes
+    from ctypes import wintypes
+    import msvcrt
+
+    class _FileAttributeTagInfo(ctypes.Structure):
+        _fields_ = [
+            ("file_attributes", wintypes.DWORD),
+            ("reparse_tag", wintypes.DWORD),
+        ]
+
+    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
+    create_file = kernel32.CreateFileW
+    create_file.argtypes = [
+        wintypes.LPCWSTR,
+        wintypes.DWORD,
+        wintypes.DWORD,
+        wintypes.LPVOID,
+        wintypes.DWORD,
+        wintypes.DWORD,
+        wintypes.HANDLE,
+    ]
+    create_file.restype = wintypes.HANDLE
+    get_file_information = kernel32.GetFileInformationByHandleEx
+    get_file_information.argtypes = [
+        wintypes.HANDLE,
+        ctypes.c_int,
+        wintypes.LPVOID,
+        wintypes.DWORD,
+    ]
+    get_file_information.restype = wintypes.BOOL
+    close_handle = kernel32.CloseHandle
+    close_handle.argtypes = [wintypes.HANDLE]
+    close_handle.restype = wintypes.BOOL
+
+    generic_read = 0x80000000
+    share_read_write_delete = 0x00000001 | 0x00000002 | 0x00000004
+    open_existing = 3
+    file_attribute_normal = 0x00000080
+    file_attribute_directory = 0x00000010
+    file_attribute_reparse_point = 0x00000400
+    file_flag_backup_semantics = 0x02000000
+    file_flag_open_reparse_point = 0x00200000
+    file_attribute_tag_info = 9
+    invalid_handle = ctypes.c_void_p(-1).value
+
+    handle = create_file(
+        str(path),
+        generic_read,
+        share_read_write_delete,
+        None,
+        open_existing,
+        file_attribute_normal | file_flag_backup_semantics | file_flag_open_reparse_point,
+        None,
+    )
+    if handle == invalid_handle:
+        raise ctypes.WinError(ctypes.get_last_error())
+
+    try:
+        file_info = _FileAttributeTagInfo()
+        if not get_file_information(
+            handle,
+            file_attribute_tag_info,
+            ctypes.byref(file_info),
+            ctypes.sizeof(file_info),
+        ):
+            raise ctypes.WinError(ctypes.get_last_error())
+        if file_info.file_attributes & (
+            file_attribute_directory | file_attribute_reparse_point
+        ):
+            raise _FileChangedDuringReadError(
+                f"File changed to a link, junction, or non-file before hashing: {path}"
+            )
+        file_descriptor = msvcrt.open_osfhandle(
+            int(handle),
+            os.O_RDONLY | os.O_BINARY,
+        )
+    except BaseException:
+        close_handle(handle)
+        raise
+    return file_descriptor
+
+
+def _open_file_no_follow
```

**File**: `tests/unit/test_simple_skill_installer.py` (modified, +2008/-85)
```diff
@@ -1,8 +1,16 @@
 from __future__ import annotations
 
+import errno
 import json
+import os
 from pathlib import Path
+import re
+import subprocess
 import sys
+import textwrap
+import time
+
+import pytest
 
 
 ROOT = Path(__file__).resolve().parents[2]
@@ -18,13 +26,195 @@
     uninstall_vibe_skill,
     update_vibe_skill,
 )
+import vgo_installer.simple_skill_installer as simple_skill_installer
 
 
 def _write(path: Path, text: str = "x\n") -> None:
     path.parent.mkdir(parents=True, exist_ok=True)
     path.write_text(text, encoding="utf-8")
 
 
+def _symlink_or_skip(link: Path, target: Path) -> None:
+    link.parent.mkdir(parents=True, exist_ok=True)
+    try:
+        link.symlink_to(target, target_is_directory=target.is_dir())
+    except (NotImplementedError, OSError) as exc:
+        pytest.skip(f"symbolic links are unavailable: {exc}")
+
+
+def _junction_or_skip(link: Path, target: Path) -> None:
+    if os.name != "nt":
+        pytest.skip("directory junctions are Windows-only")
+    target.mkdir(parents=True, exist_ok=True)
+    result = subprocess.run(
+        ["cmd.exe", "/d", "/c", "mklink", "/J", str(link), str(target)],
+        capture_output=True,
+        text=True,
+        check=False,
+    )
+    if result.returncode != 0:
+        pytest.skip(f"directory junctions are unavailable: {result.stderr.strip()}")
+
+
+def _file_snapshot(root: Path) -> dict[str, bytes]:
+    return {
+        path.relative_to(root).as_posix(): path.read_bytes()
+        for path in root.rglob("*")
+        if path.is_file()
+    }
+
+
+def _run_install_until_process_exit(
+    *,
+    repo_root: Path,
+    skills_dir: Path,
+    exit_after_destination: Path,
+) -> None:
+    script = textwrap.dedent(
+        """
+        import os
+        from pathlib import Path
+        import sys
+
+        import vgo_installer.simple_skill_installer as installer
+
+        repo_root = Path(sys.argv[1])
+        skills_dir = Path(sys.argv[2])
+        exit_after_destination = Path(sys.argv[3]).resolve(strict=False)
+        original_replace = installer.os.replace
+
+        def replace_then_exit(source, destination):
+            original_replace(source, destination)
+            if Path(destination).resolve(strict=False) == exit_after_destination:
+                os._exit(91)
+
+        installer.os.replace = replace_then_exit
+        installer.install_vibe_skill(
+            repo_root=repo_root,
+            skills_dir=skills_dir,
+            installed_at_utc="2026-07-02T09:00:00Z",
+        )
+        """
+    )
+    environment = os.environ.copy()
+    environment["PYTHONPATH"] = os.pathsep.join(
+        path
+        for path in (
+            str(CONTRACTS_SRC),
+            str(INSTALLER_SRC),
+            environment.get("PYTHONPATH", ""),
+        )
+        if path
+    )
+    result = subprocess.run(
+        [
+            sys.executable,
+            "-c",
+            script,
+            str(repo_root),
+            str(skills_dir),
+            str(exit_after_destination),
+        ],
+        capture_output=True,
+        text=True,
+        env=environment,
+        check=False,
+        timeout=10,
+    )
+    assert result.returncode == 91, result.stderr
+
+
+def _run_install_until_staging_exit(*, repo_root: Path, skills_dir: Path) -> None:
+    script = textwrap.dedent(
+        """
+        import os
+        from pathlib import Path
+        import sys
+
+        import vgo_installer.simple_skill_installer as installer
+
+        repo_root = Path(sys.argv[1])
+        skills_dir = Path(sys.argv[2])
+        original_copy = installer.shutil.copy2
+
+        def copy_then_exit(source, destination):
+            result = original_copy(source, destination)
+            if Path(source).name == "SKILL.md":
+                os._exit(92)
+            return result
+
+        installer.shutil.copy2 = copy_then_exit
+        installer.install_vibe_skill(
+            repo_root=repo_root,
+            skills_dir=skills_dir,
+            installed_at_utc="2026-07-02T09:00:00Z",
+        )
+        """
+    )
+    environment = os.environ.copy()
+    environment["PYTHONPATH"] = os.pathsep.join(
+        path
+        for path in (
+            str(CONTRACTS_SRC),
+            str(INSTALLER_SRC),
+            environment.get("PYTHONPATH", ""),
+        )
+        if path
+    )
+    result = subprocess.run(
+        [sys.executable, "-c", script, str(repo_root), str(skills_dir)],
+        capture_output=True,
+        text=True,
+        env=environment,
+        check=False,
+        timeout=10,
+    )
+    assert result.returncode == 92, result.stderr
+
+
+def _run_uninstall_until_state_delete_exit(*, skills_dir: Path) -> None:
+    script = textwrap.dedent(
+        """
+        import os
+        from pathlib import Path
+        import sys
+
+        import vgo_installer.simple_skill_installer as installer
+
+        skills_dir = Path(sys.argv[1])
+        state_path = skills_dir / ".vibeskills"
```

**File**: `tests/unit/test_vgo_cli_commands.py` (modified, +296/-1)
```diff
@@ -2,6 +2,7 @@
 
 import argparse
 import json
+import os
 from pathlib import Path
 import subprocess
 import sys
@@ -15,7 +16,16 @@
     sys.path.insert(0, str(CLI_SRC))
 
 from vgo_cli.commands import canonical_entry_command, check_command, compatibility_exit_command, index_command, inspect_run_command, install_command, locate_entry_command, route_command, run_command, runtime_command, uninstall_command, update_command, upgrade_command, verify_command
-from vgo_cli.errors import CliError
+from vgo_cli.errors import (
+    CliError,
+    CliExitCode,
+    CliIoError,
+    CliMissingResourceError,
+    CliPermissionError,
+    CliStateError,
+    CliUnavailableError,
+)
+import vgo_cli.main as cli_main
 from vgo_cli.main import build_parser
 from vgo_cli.output import parse_json_output, print_json_payload
 
@@ -33,6 +43,194 @@ def test_parse_json_output_rejects_invalid_json() -> None:
         parse_json_output(result)
 
 
+def test_main_returns_the_specific_cli_error_exit_code(
+    monkeypatch: pytest.MonkeyPatch,
+    capsys: pytest.CaptureFixture[str],
+) -> None:
+    class CannotCreateError(CliError):
+        exit_code = 73
+
+    class FailingParser:
+        @staticmethod
+        def parse_args(argv: list[str] | None) -> argparse.Namespace:
+            def fail(args: argparse.Namespace) -> int:
+                raise CannotCreateError("target cannot be created")
+
+            return argparse.Namespace(handler=fail)
+
+    monkeypatch.setattr(cli_main, "build_parser", FailingParser)
+
+    assert cli_main.main([]) == 73
+    assert capsys.readouterr().err == "[FAIL] target cannot be created\n"
+
+
+def test_cli_exit_code_values_are_stable() -> None:
+    assert {member.name: int(member) for member in CliExitCode} == {
+        "FAILURE": 1,
+        "USAGE": 2,
+        "INVALID_STATE": 3,
+        "MISSING_RESOURCE": 4,
+        "PERMISSION_DENIED": 5,
+        "UNAVAILABLE": 6,
+        "IO_ERROR": 7,
+    }
+
+
+@pytest.mark.parametrize(
+    ("error_type", "expected_exit_code"),
+    [
+        (CliError, 1),
+        (CliStateError, 3),
+        (CliMissingResourceError, 4),
+        (CliPermissionError, 5),
+        (CliUnavailableError, 6),
+        (CliIoError, 7),
+    ],
+)
+def test_cli_error_types_have_stable_exit_codes(
+    error_type: type[CliError],
+    expected_exit_code: int,
+) -> None:
+    assert int(error_type.exit_code) == expected_exit_code
+
+
+@pytest.mark.parametrize(
+    ("error", "expected_type"),
+    [
+        (PermissionError("denied"), CliPermissionError),
+        (FileNotFoundError("missing"), CliMissingResourceError),
+        (TimeoutError("busy"), CliUnavailableError),
+        (OSError("failed"), CliIoError),
+        (RuntimeError("invalid"), CliStateError),
+    ],
+)
+def test_installer_errors_map_to_specific_cli_error_types(
+    error: RuntimeError | OSError,
+    expected_type: type[CliError],
+) -> None:
+    import vgo_cli.commands as cli_commands
+
+    assert isinstance(cli_commands._installer_cli_error(error), expected_type)
+
+
+def test_uninstall_missing_receipt_uses_state_exit_code_without_traceback(tmp_path: Path) -> None:
+    env = os.environ.copy()
+    existing_pythonpath = env.get("PYTHONPATH", "")
+    env["PYTHONPATH"] = os.pathsep.join(
+        value for value in (str(CLI_SRC), existing_pythonpath) if value
+    )
+    result = subprocess.run(
+        [
+            sys.executable,
+            "-m",
+            "vgo_cli.main",
+            "uninstall",
+            "--repo-root",
+            str(REPO_ROOT),
+            "--skills-dir",
+            str(tmp_path / "missing-skills"),
+        ],
+        cwd=REPO_ROOT,
+        env=env,
+        text=True,
+        capture_output=True,
+        check=False,
+    )
+
+    assert result.returncode == 3
+    assert "[FAIL] Vibe install receipt is missing" in result.stderr
+    assert "Traceback" not in result.stderr
+
+
+def test_uninstall_malformed_recovery_state_uses_state_exit_code_without_traceback(tmp_path: Path) -> None:
+    skills_dir = tmp_path / "skills"
+    recovery_path = skills_dir / ".vibeskills" / "vibe-uninstall-state.json"
+    recovery_path.parent.mkdir(parents=True)
+    recovery_path.write_text("{\n", encoding="utf-8")
+    env = os.environ.copy()
+    existing_pythonpath = env.get("PYTHONPATH", "")
+    env["PYTHONPATH"] = os.pathsep.join(
+        value for value in (str(CLI_SRC), existing_pythonpath) if value
+    )
+    result = subprocess.run(
+        [
+            sys.executable,
+            "-m",
+            "vgo_cli.main",
+            "uninstall",
+            "--repo-root",
+            str(REPO_ROOT),
+            "--skills-dir",
+            str(skills_dir),
+        ],
+        cwd=REPO_ROOT,
+        env=env,
+        text=True,
+        capture_output=True,
+        check=False,
+    )
+
+    assert result.returncode == 3
+    assert "[FAIL] Unreadable Vibe uninstall state" in result.stderr
+    assert "Traceback" not in result.stderr
+
+
+@
```

---

### Incident Patch 2: `686bb4bc` (2026-08-29)
**Commit Message**: chore(release): bind 4.1.0 to content-hash fix

**File**: `references/release-ledger.jsonl` (modified, +1/-0)
```diff
@@ -38,3 +38,4 @@
 {"recorded_at":"2026-07-08T15:35:12","version":"3.2.0","updated":"2026-07-08","git_head":"7c6ac63","actor":"羽裳"}
 {"recorded_at":"2026-07-17T09:42:23","version":"4.0.0","updated":"2026-07-17","git_head":"c1665ba7","actor":"羽裳"}
 {"recorded_at":"2026-08-29T16:51:04","version":"4.1.0","updated":"2026-08-29","git_head":"50f6749","actor":"羽裳"}
+{"recorded_at":"2026-08-29T18:45:46","version":"4.1.0","updated":"2026-08-29","git_head":"6e08f10","actor":"羽裳"}
```

---

### Incident Patch 3: `6e08f100` (2026-08-29)
**Commit Message**: fix(runtime): bind resumed work to content hashes

**File**: `SKILL.md` (modified, +1/-0)
```diff
@@ -250,6 +250,7 @@ Never claim success without evidence. Minimum invariants:
 - Expose failures, fallback, degraded status, or blocked state explicitly.
 - Do not add mock success paths, swallowed errors, or template-only pass results.
 - Treat scaffold or draft artifacts as `needs_execution` with `proof_ready = false`; do not call them completed work.
+- Reuse completed work only while its selected Skill content and delivered artifact hashes remain unchanged; rerun changed units before verification.
 - Do not use fallback or boundary behavior to bypass real execution,
   verification, or root-cause repair.
 - When a check fails within the confirmed scope, make at most one targeted
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/executor.py` (modified, +35/-1)
```diff
@@ -1,6 +1,7 @@
 from __future__ import annotations
 
-from dataclasses import asdict, dataclass
+from dataclasses import asdict, dataclass, replace
+import hashlib
 import json
 from pathlib import Path
 import re
@@ -26,6 +27,7 @@ class WorkUnitResult:
     failure_reason: str | None = None
     artifact_kind: str = "scaffold"
     proof_ready: bool = False
+    artifact_sha256: tuple[str, ...] = ()
 
     def model_dump(self) -> dict[str, object]:
         return asdict(self)
@@ -34,6 +36,38 @@ def artifact_evidence_paths(self) -> tuple[str, ...]:
         return tuple(path for path in (*self.artifact_paths, *self.proof_artifact_paths) if str(path).strip())
 
 
+def artifact_sha256_for_paths(artifact_paths: tuple[str, ...]) -> tuple[str, ...]:
+    digests: list[str] = []
+    for raw_path in artifact_paths:
+        path = Path(raw_path)
+        try:
+            is_file = path.is_file()
+        except OSError:
+            is_file = False
+        if not is_file:
+            digests.append("")
+            continue
+        digest = hashlib.sha256()
+        try:
+            with path.open("rb") as stream:
+                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
+                    digest.update(chunk)
+        except OSError:
+            digests.append("")
+            continue
+        digests.append(digest.hexdigest())
+    return tuple(digests)
+
+
+def capture_completed_artifact_sha256(result: WorkUnitResult) -> WorkUnitResult:
+    if result.status != "completed":
+        return result
+    return replace(
+        result,
+        artifact_sha256=artifact_sha256_for_paths(result.artifact_paths),
+    )
+
+
 SLUG_PATTERN = re.compile(r"[^a-z0-9]+")
 
 
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/finder.py` (modified, +2/-0)
```diff
@@ -25,6 +25,7 @@ class SkillCandidate:
     resolved_skill_file: str
     path_contract: str
     path_base: str
+    content_sha256: str = ""
     warnings: tuple[str, ...] = ()
     inputs: tuple[str, ...] = ()
     outputs: tuple[str, ...] = ()
@@ -141,6 +142,7 @@ def find_skill_candidates(task_card: TaskCard, index_payload: dict[str, object],
                 resolved_skill_file=str(source_metadata["resolved_skill_file"]),
                 path_contract=str(source_metadata["path_contract"]),
                 path_base=str(source_metadata["path_base"]),
+                content_sha256=str(raw_entry.get("content_sha256") or "").strip().lower(),
             )
         )
     ranked = sorted(
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/loop.py` (modified, +47/-16)
```diff
@@ -5,7 +5,12 @@
 from dataclasses import replace
 from pathlib import Path
 
-from .executor import WorkUnitResult, execute_work_unit
+from .executor import (
+    WorkUnitResult,
+    artifact_sha256_for_paths,
+    capture_completed_artifact_sha256,
+    execute_work_unit,
+)
 from .finder import find_skill_candidates
 from .host_skill_roots import resolve_host_skill_roots
 from .planner import build_work_plan
@@ -72,6 +77,7 @@ def _skill_provenance(candidate: object) -> SkillProvenance:
         source_order=int(getattr(candidate, "source_order")),
         path_contract=str(getattr(candidate, "path_contract")),
         path_base=str(getattr(candidate, "path_base")),
+        content_sha256=str(getattr(candidate, "content_sha256", "")),
     )
 
 
@@ -386,6 +392,7 @@ def _coerce_work_result(payload: dict[str, object]) -> WorkUnitResult:
             else None
         ),
         failure_reason=(str(payload["failure_reason"]) if payload.get("failure_reason") is not None else None),
+        artifact_sha256=tuple(str(value) for value in payload.get("artifact_sha256", [])),
     )
 
 
@@ -402,6 +409,7 @@ def _coerce_skill_provenance(payload: object) -> SkillProvenance | None:
         source_order=int(payload["source_order"]),
         path_contract=str(payload["path_contract"]),
         path_base=str(payload["path_base"]),
+        content_sha256=str(payload.get("content_sha256") or ""),
     )
 
 
@@ -476,6 +484,11 @@ def _unique_non_empty(values: list[str]) -> list[str]:
 def _can_reuse_previous_work(*, previous_work_unit: WorkUnit | None, current_work_unit: WorkUnit) -> bool:
     if previous_work_unit is None:
         return False
+    if current_work_unit.preferred_skill is not None:
+        provenance = current_work_unit.selected_skill_provenance
+        content_sha256 = provenance.content_sha256 if provenance is not None else ""
+        if len(content_sha256) != 64 or any(character not in "0123456789abcdef" for character in content_sha256):
+            return False
     return (
         previous_work_unit.preferred_skill == current_work_unit.preferred_skill
         and previous_work_unit.selected_skill_provenance == current_work_unit.selected_skill_provenance
@@ -488,6 +501,17 @@ def _can_reuse_previous_work(*, previous_work_unit: WorkUnit | None, current_wor
     )
 
 
+def _completed_result_artifacts_are_current(result: WorkUnitResult) -> bool:
+    if result.status != "completed" or not result.artifact_paths:
+        return False
+    if len(result.artifact_paths) != len(result.artifacts):
+        return False
+    recorded = result.artifact_sha256
+    if len(recorded) != len(result.artifact_paths) or any(not digest for digest in recorded):
+        return False
+    return recorded == artifact_sha256_for_paths(result.artifact_paths)
+
+
 def _inspect_host_context(
     *,
     agent_root: Path,
@@ -850,16 +874,12 @@ def _render_work_dossier_markdown(work_dossier: dict[str, object]) -> str:
     closure_payload = closure if isinstance(closure, dict) else {}
     task_card_payload = work_dossier.get("task_card")
     task_card = task_card_payload if isinstance(task_card_payload, dict) else {}
-    work_plan_payload = work_dossier.get("work_plan")
-    work_plan = work_plan_payload if isinstance(work_plan_payload, dict) else {}
     module_assignments_payload = work_dossier.get("module_assignments")
     module_assignments = module_assignments_payload if isinstance(module_assignments_payload, dict) else {}
     work_results_payload = work_dossier.get("work_results")
     work_results = work_results_payload if isinstance(work_results_payload, dict) else {}
     work_payload = closure_payload.get("work")
     work_section = work_payload if isinstance(work_payload, dict) else {}
-    skills_payload = closure_payload.get("skills")
-    skills_section = skills_payload if isinstance(skills_payload, dict) else {}
     outputs_payload = closure_payload.get("outputs")
     outputs_section = outputs_payload if isinstance(outputs_payload, dict) else {}
     proof_payload = closure_payload.get("proof")
@@ -1144,9 +1164,13 @@ def run_local_kernel(
     for work_unit in plan.work_units:
         reused_result = previous_results_by_artifacts.get(work_unit.expected_artifacts)
         previous_work_unit = previous_work_units_by_artifacts.get(work_unit.expected_artifacts)
-        if reused_result is None or not _can_reuse_previous_work(
-            previous_work_unit=previous_work_unit,
-            current_work_unit=work_unit,
+        if (
+            reused_result is None
+            or not _can_reuse_previous_work(
+                previous_work_unit=previous_work_unit,
+                current_work_unit=work_unit,
+            )
+            or not _completed_result_artifacts_are_current(reused_result)
         ):
             planned_work_units.append(work_unit)
             continue
@@ -1226,9 +1250,13 @@ def run_local_kernel(
     for work_unit in (plan.work_units if should_execute else ()
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/module_assignments.py` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@ def model_dump(self) -> dict[str, object]:
             payload["skill_source_order"] = provenance["source_order"]
             payload["skill_path_contract"] = provenance["path_contract"]
             payload["skill_path_base"] = provenance["path_base"]
+            payload["skill_content_sha256"] = provenance["content_sha256"]
         return payload
 
 
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/planner.py` (modified, +1/-0)
```diff
@@ -212,6 +212,7 @@ def _selected_skill_provenance(candidate: SkillCandidate | None) -> SkillProvena
         source_order=candidate.source_order,
         path_contract=candidate.path_contract,
         path_base=candidate.path_base,
+        content_sha256=candidate.content_sha256,
     )
 
 
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/verifier.py` (modified, +6/-0)
```diff
@@ -4,6 +4,7 @@
 from pathlib import Path
 from typing import Any
 
+from .executor import artifact_sha256_for_paths
 from .task_card import TaskCard
 from .work_plan import WorkPlan
 
@@ -83,6 +84,7 @@ def verify_run(task_card: TaskCard, plan: WorkPlan, work_results: tuple[Any, ...
             continue
         used_skill = _result_attr(work_result, "used_skill", None)
         artifact_paths = tuple(str(value) for value in _result_attr(work_result, "artifact_paths", ()))
+        artifact_sha256 = tuple(str(value) for value in _result_attr(work_result, "artifact_sha256", ()))
         checked_targets = tuple(str(value) for value in _result_attr(work_result, "checked_targets", ()))
         execution_receipt_path = _result_attr(work_result, "execution_receipt_path", None)
         proof_text = " | ".join(proof)
@@ -93,6 +95,10 @@ def verify_run(task_card: TaskCard, plan: WorkPlan, work_results: tuple[Any, ...
                 weak_proof.append(f"{work_unit.id}: missing artifact reference {artifact}")
         if len(artifact_paths) != len(work_unit.expected_artifacts):
             weak_proof.append(f"{work_unit.id}: artifact_paths count does not match expected artifacts")
+        if len(artifact_sha256) != len(artifact_paths) or any(not digest for digest in artifact_sha256):
+            weak_proof.append(f"{work_unit.id}: artifact SHA-256 evidence is incomplete")
+        elif artifact_sha256 != artifact_sha256_for_paths(artifact_paths):
+            weak_proof.append(f"{work_unit.id}: artifact content changed after completion")
         for artifact_path in artifact_paths:
             if not Path(artifact_path).is_file():
                 weak_proof.append(f"{work_unit.id}: artifact file missing {artifact_path}")
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/work_plan.py` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ class SkillProvenance:
     source_order: int
     path_contract: str
     path_base: str
+    content_sha256: str = ""
 
     def model_dump(self) -> dict[str, object]:
         return asdict(self)
```

---

### Incident Patch 4: `50f67499` (2026-08-29)
**Commit Message**: fix(runtime): invalidate stale Skill guidance on resume

**File**: `packages/runtime-core/src/vgo_runtime/kernel/loop.py` (modified, +5/-0)
```diff
@@ -480,6 +480,11 @@ def _can_reuse_previous_work(*, previous_work_unit: WorkUnit | None, current_wor
         previous_work_unit.preferred_skill == current_work_unit.preferred_skill
         and previous_work_unit.selected_skill_provenance == current_work_unit.selected_skill_provenance
         and previous_work_unit.acceptance_criteria == current_work_unit.acceptance_criteria
+        and previous_work_unit.depends_on == current_work_unit.depends_on
+        and previous_work_unit.verification == current_work_unit.verification
+        and previous_work_unit.task_verification == current_work_unit.task_verification
+        and previous_work_unit.plan_hints == current_work_unit.plan_hints
+        and previous_work_unit.verify_hints == current_work_unit.verify_hints
     )
 
 
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/skill_manifest.py` (modified, +12/-4)
```diff
@@ -277,13 +277,21 @@ def _extract_body_guidance(body_lines: list[str], *, limit_per_section: int = 12
         "verify_hints": [],
     }
     active_section = ""
-    in_code_fence = False
+    code_fence: str | None = None
     for line in body_lines:
         stripped = line.strip()
-        if stripped.startswith("```") or stripped.startswith("~~~"):
-            in_code_fence = not in_code_fence
+        fence_match = re.match(r"^(`{3,}|~{3,})", stripped)
+        if code_fence is None and fence_match is not None:
+            code_fence = fence_match.group(1)
             continue
-        if in_code_fence:
+        if code_fence is not None:
+            if (
+                fence_match is not None
+                and fence_match.group(1)[0] == code_fence[0]
+                and len(fence_match.group(1)) >= len(code_fence)
+                and len(fence_match.group(1)) == len(stripped)
+            ):
+                code_fence = None
             continue
         section = _body_guidance_section(stripped)
         if section is not None:
```

**File**: `packages/runtime-core/src/vgo_runtime/test_skill_cache_routing.py` (modified, +41/-0)
```diff
@@ -202,6 +202,47 @@ def test_skill_card_derives_execution_guidance_from_standard_sections(tmp_path:
     assert entry["verify_hints"] == ["confirm every artifact exists at its reported location"]
 
 
+def test_skill_card_ignores_guidance_inside_long_code_fence(tmp_path: Path) -> None:
+    agent_root = tmp_path / ".agents"
+    skills_root = agent_root / "skills"
+    skills_root.mkdir(parents=True)
+
+    _write_skill(
+        skills_root,
+        "fenced-guidance",
+        """
+name: Fenced Guidance
+description: Keep examples separate from executable guidance.
+""",
+        """
+## Workflow
+
+- Follow the real workflow step.
+
+````markdown
+## Verification
+
+- ignore the fenced verification example
+```
+## Outputs
+
+- ignore the fenced output example
+````
+
+## Verification
+
+- run the real verification check
+""",
+    )
+
+    result = build_skill_index(agent_root, host_roots=(skills_root,))
+    entry = next(row for row in result["skills"] if row["skill_id"] == "fenced-guidance")
+
+    assert entry["outputs"] == []
+    assert entry["plan_hints"] == ["Follow the real workflow step."]
+    assert entry["verify_hints"] == ["run the real verification check"]
+
+
 def test_route_uses_weak_text_capability_evidence_for_existing_skills_without_capability_fields(tmp_path: Path) -> None:
     agent_root = tmp_path / ".agents"
     skills_root = agent_root / "skills"
```

**File**: `tests/unit/test_local_kernel_execution.py` (modified, +25/-2)
```diff
@@ -1,8 +1,9 @@
 from __future__ import annotations
 
+from dataclasses import replace
 import json
-import shutil
 from pathlib import Path
+import shutil
 import sys
 import uuid
 
@@ -17,7 +18,7 @@
 from vgo_runtime.artifact_contract import _copy_run_tree
 from vgo_runtime.kernel.executor import WorkUnitResult, execute_work_unit
 from vgo_runtime.kernel.finder import find_skill_candidates
-from vgo_runtime.kernel.loop import inspect_local_run, inspect_main, run_local_kernel
+from vgo_runtime.kernel.loop import _can_reuse_previous_work, inspect_local_run, inspect_main, run_local_kernel
 from vgo_runtime.kernel.planner import build_work_plan
 from vgo_runtime.kernel.run_state import load_run_state, write_run_state
 from vgo_runtime.kernel.task_card import build_task_card
@@ -226,6 +227,28 @@ def test_verify_run_reports_needs_execution_for_scaffold_only_result() -> None:
     assert any("requires real execution evidence" in note for note in verification.notes)
 
 
+@pytest.mark.parametrize(
+    ("field_name", "changed_value"),
+    [
+        ("depends_on", ("wu-prerequisite",)),
+        ("verification", ("updated verification",)),
+        ("task_verification", ("updated task verification",)),
+        ("plan_hints", ("updated plan guidance",)),
+        ("verify_hints", ("updated verification guidance",)),
+    ],
+)
+def test_previous_work_is_not_reused_after_guidance_or_dependency_changes(
+    field_name: str,
+    changed_value: tuple[str, ...],
+) -> None:
+    task_card = build_task_card(prompt="Review the runtime change.")
+    previous = build_work_plan(task_card, find_skill_candidates(task_card, _index_payload())).work_units[0]
+    current = replace(previous, **{field_name: changed_value})
+
+    assert _can_reuse_previous_work(previous_work_unit=previous, current_work_unit=previous)
+    assert not _can_reuse_previous_work(previous_work_unit=previous, current_work_unit=current)
+
+
 def test_run_state_round_trip_persists_json(tmp_path: Path) -> None:
     state_path = tmp_path / "run-state.json"
     run_state = write_run_state(
```

---

### Incident Patch 5: `afca19c0` (2026-08-29)
**Commit Message**: feat(runtime): carry Skill guidance through planning and delivery

**File**: `SKILL.md` (modified, +41/-1)
```diff
@@ -80,6 +80,20 @@ Proof of canonical launch is post-launch and requires: `host-launch-receipt.json
 `local-agent-kernel` follows the same proof rule. If it cannot produce those truth artifacts, it may produce local work scaffolds, but it must not be treated as `canonical verified`.
 If canonical launch fails, report `blocked` with the concrete failure reason instead of simulating the missing stages or proof artifacts.
 
+## Consensus And Task Evolution
+
+Use `deep_interview` as a real conversation. Continue until the user and Agent
+share a concrete understanding of the goal, scope, constraints, deliverables,
+unknowns that affect the work, and completion criteria. A first clarification
+response is input to that conversation; freeze the requirement only when the
+user has confirmed the resulting task-specific summary.
+
+Keep that agreement in the existing TaskCard. When the user changes the work,
+append an accepted revision, update the affected work units and checks, and
+reuse completed work whose inputs and acceptance criteria remain valid. Surface
+a new decision only when it changes the agreed outcome, scope, risk, or required
+human judgment.
+
 ## Hard Stop And Re-entry
 
 `vibe` uses progressive governed stops:
@@ -118,7 +132,7 @@ cat > "$DECISION_JSON" <<'JSON'
   "approval_decision": "approve",
   "agent_skill_organization": {
     "schema_version": "agent_skill_organization_v1", "derived_by": "agent", "workflow_level": "L",
-    "modules": [{"module_id": "module-a", "goal": "...", "candidate_skill_ids": ["skill-a"], "execution_mode": "skill_assigned", "acceptance_criteria": [{"criterion_id": "module-a-result", "description": "The module result satisfies the frozen requirement.", "verification_mode": "automated"}]}],
+    "modules": [{"module_id": "module-a", "goal": "...", "candidate_skill_ids": ["skill-a"], "depends_on": [], "execution_mode": "skill_assigned", "acceptance_criteria": [{"criterion_id": "module-a-result", "description": "The module result satisfies the frozen requirement.", "verification_mode": "automated"}]}],
     "selected_skills": [{"skill_id": "skill-a", "module_ids": ["module-a"], "responsibility": "...", "reason": "..."}],
     "uncovered_modules": [],
     "workflow_level_contract": {"L": "smallest complete organization", "XL": "bounded multi-lane organization"}
@@ -162,6 +176,11 @@ Use the directory name that directly contains the retained `SKILL.md` as the exa
 Module acceptance criteria must be satisfiable before canonical module-result re-entry. They must not require cleanup receipts, delivery acceptance, or completion-language permission, because canonical `phase_cleanup` creates those only after `module-execution.json` is accepted. Verify ordinary modules from their actual deliverables and normal command or test output. Do not invent task-specific hashes, receipts, ledgers, matrices, scans, or proof files solely to prove execution order, Skill use, or file scope. Only require an extra evidence artifact when the user or domain contract needs that artifact.
 After plan approval, reuse the frozen `agent_skill_organization` for `plan_execute` and cleanup, and do not rerun procedural skill selection, silently add skills, or replace declared gaps unless the user revises the frozen requirement or plan. `stage_order` records dependency depth, not permission to run in parallel; L still emits one-unit sequential waves even when independent units share a dependency stage. XL may place at most two dependency-ready units in one wave, and nested or overlapping write scopes must remain serial.
 
+After the required plan confirmation, continue through dependency-ready work
+without asking for routine permission between units. Give concise progress
+updates at meaningful boundaries. If the user revises the agreed task, record
+the revision and replan only the affected work before continuing.
+
 ## Unified Runtime Contract
 
 Canonical `vibe` owns one runtime authority and one visible requirement/plan
@@ -196,6 +215,15 @@ the host-visible skill surface.
 The frozen `agent_skill_organization` is the only task-skill truth. Before plan
 approval, disclose modules, candidates, selected skills and reasons, gaps, and the L / XL difference.
 
+Organize each confirmed module as a verifiable work unit. Use declared Skill
+outputs to identify ownership, `plan_hints` to shape the work steps, and
+`verify_hints` to extend the module checks. Preserve explicit module
+dependencies and keep `agent_direct` as the visible fallback for a module with
+no suitable Skill. Every work unit must retain its intended outputs, checks,
+binding reason, and dependency links in the existing WorkPlan. Each bound
+assignment must project those fields and the selected Skill guidance into the
+existing ModuleAssignments artifact.
+
 Only selected skills become module-bound execution units. The host must not
 invent skills, promote route candidates, hide skill sessions, or open another
 requirement/plan/runtime surf
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/finder.py` (modified, +19/-0)
```diff
@@ -26,6 +26,10 @@ class SkillCandidate:
     path_contract: str
     path_base: str
     warnings: tuple[str, ...] = ()
+    inputs: tuple[str, ...] = ()
+    outputs: tuple[str, ...] = ()
+    plan_hints: tuple[str, ...] = ()
+    verify_hints: tuple[str, ...] = ()
 
     def model_dump(self) -> dict[str, object]:
         return asdict(self)
@@ -47,6 +51,13 @@ def _required_int(raw_entry: dict[str, object], field_name: str) -> int:
     return value
 
 
+def _optional_strings(raw_entry: dict[str, object], field_name: str) -> tuple[str, ...]:
+    values = raw_entry.get(field_name)
+    if not isinstance(values, (list, tuple)):
+        return ()
+    return tuple(value for item in values if (value := str(item).strip()))
+
+
 def _validated_source_metadata(raw_entry: dict[str, object]) -> dict[str, object]:
     return {
         "source_kind": _required_str(raw_entry, "source_kind"),
@@ -91,6 +102,10 @@ def find_skill_candidates(task_card: TaskCard, index_payload: dict[str, object],
         search_tokens.update(tokens_from_values(raw_entry.get("when_to_use"), stem=True, stopwords=SKILL_MATCH_STOPWORDS))
         search_tokens.update(tokens_from_values(raw_entry.get("tags"), stem=True, stopwords=SKILL_MATCH_STOPWORDS))
         owner_tokens = tokens_from_values(raw_entry.get("outputs"), stem=True, stopwords=SKILL_MATCH_STOPWORDS)
+        inputs = _optional_strings(raw_entry, "inputs")
+        outputs = _optional_strings(raw_entry, "outputs")
+        plan_hints = _optional_strings(raw_entry, "plan_hints")
+        verify_hints = _optional_strings(raw_entry, "verify_hints")
         support_tokens = set(search_tokens)
         support_tokens.update(owner_tokens)
         blocked_tokens = tokens_from_values(raw_entry.get("not_for"), stem=True, stopwords=SKILL_MATCH_STOPWORDS)
@@ -108,6 +123,10 @@ def find_skill_candidates(task_card: TaskCard, index_payload: dict[str, object],
                 score=score,
                 matched_tokens=tuple(matched),
                 search_tokens=tuple(sorted(search_tokens)),
+                inputs=inputs,
+                outputs=outputs,
+                plan_hints=plan_hints,
+                verify_hints=verify_hints,
                 owner_tokens=tuple(sorted(owner_tokens)),
                 support_tokens=tuple(sorted(support_tokens)),
                 blocked_tokens=tuple(sorted(blocked_tokens)),
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/loop.py` (modified, +149/-3)
```diff
@@ -84,6 +84,9 @@ def _unbound_plan_for_agent(plan: WorkPlan) -> WorkPlan:
                 preferred_skill=None,
                 binding_profile="agent_selection_required",
                 binding_reason="Agent skill organization is required before this work unit can be bound.",
+                verification=unit.task_verification or unit.verification,
+                plan_hints=(),
+                verify_hints=(),
                 fallback_skills=tuple(
                     dict.fromkeys(
                         [
@@ -154,6 +157,38 @@ def _apply_agent_skill_organization(
     if set(modules) != work_unit_ids:
         raise ValueError("agent_skill_organization module ids must match the local kernel work units")
 
+    original_dependencies = {unit.id: unit.depends_on for unit in plan.work_units}
+    dependencies_by_module: dict[str, tuple[str, ...]] = {}
+    for module_id, module in modules.items():
+        if "depends_on" not in module:
+            dependencies_by_module[module_id] = original_dependencies[module_id]
+            continue
+        raw_dependencies = module["depends_on"]
+        if not isinstance(raw_dependencies, list):
+            raise ValueError(
+                f"agent_skill_organization module {module_id} depends_on must be a list"
+            )
+        dependencies = tuple(str(value).strip() for value in raw_dependencies)
+        if any(not dependency for dependency in dependencies):
+            raise ValueError(
+                f"agent_skill_organization module {module_id} depends_on must contain non-empty module ids"
+            )
+        if len(set(dependencies)) != len(dependencies):
+            raise ValueError(
+                f"agent_skill_organization module {module_id} depends_on contains duplicates"
+            )
+        if module_id in dependencies:
+            raise ValueError(
+                f"agent_skill_organization module {module_id} cannot depend on itself"
+            )
+        unknown_dependencies = [dependency for dependency in dependencies if dependency not in modules]
+        if unknown_dependencies:
+            raise ValueError(
+                f"agent_skill_organization module {module_id} depends on unknown module "
+                + ", ".join(unknown_dependencies)
+            )
+        dependencies_by_module[module_id] = dependencies
+
     candidate_by_id = {str(getattr(candidate, "skill_id")): candidate for candidate in candidates}
     selected_by_module: dict[str, dict[str, object]] = {}
     for row in raw_selected:
@@ -191,6 +226,7 @@ def _apply_agent_skill_organization(
         selected = selected_by_module.get(unit.id)
         uncovered = uncovered_by_module.get(unit.id)
         execution_mode = str(modules[unit.id].get("execution_mode") or "").strip()
+        task_verification = unit.task_verification or unit.verification
         acceptance_criteria = tuple(
             AcceptanceCriterion(
                 criterion_id=str(criterion["criterion_id"]).strip(),
@@ -213,9 +249,13 @@ def _apply_agent_skill_organization(
             organized_units.append(
                 replace(
                     unit,
+                    depends_on=dependencies_by_module[unit.id],
                     preferred_skill=None,
                     binding_profile="agent_direct",
                     binding_reason="The current Agent directly owns this approved module.",
+                    verification=task_verification,
+                    plan_hints=(),
+                    verify_hints=(),
                     acceptance_criteria=acceptance_criteria,
                     selected_skill_provenance=None,
                 )
@@ -225,16 +265,23 @@ def _apply_agent_skill_organization(
             organized_units.append(
                 replace(
                     unit,
+                    depends_on=dependencies_by_module[unit.id],
                     preferred_skill=None,
                     binding_profile="uncovered_by_agent",
                     binding_reason=str(uncovered.get("reason") or "The Agent left this module uncovered."),
+                    verification=task_verification,
+                    plan_hints=(),
+                    verify_hints=(),
                     acceptance_criteria=acceptance_criteria,
                     selected_skill_provenance=None,
                 )
             )
             continue
 
         skill_id = str(selected["skill_id"])
+        selected_candidate = candidate_by_id[skill_id]
+        plan_hints = tuple(str(value) for value in getattr(selected_candidate, "plan_hints", ()))
+        verify_hints = tuple(str(value) for value in getattr(selected_candidate, "verify_hints", ()))
         module_candidates = tuple(
             value
             for value in (str(item).strip() for item in modules[unit.id].get("candidate_skill_ids", []))
@@ -243,18 +290,38 @@ def _apply_agent_skill_organization(
         organized_units.append(
             replace(
                 unit,
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/module_assignments.py` (modified, +6/-0)
```diff
@@ -15,6 +15,9 @@ class ModuleAssignmentsUnit:
     expected_artifacts: tuple[str, ...]
     verification: tuple[str, ...]
     provenance: SkillProvenance | None = None
+    depends_on: tuple[str, ...] = ()
+    plan_hints: tuple[str, ...] = ()
+    verify_hints: tuple[str, ...] = ()
 
     def model_dump(self) -> dict[str, object]:
         payload = asdict(self)
@@ -48,12 +51,15 @@ def build_module_assignments(plan: WorkPlan) -> ModuleAssignments:
         units=tuple(
             ModuleAssignmentsUnit(
                 work_unit_id=work_unit.id,
+                depends_on=work_unit.depends_on,
                 bound_skill=work_unit.preferred_skill,
                 binding_profile=work_unit.binding_profile,
                 binding_reason=work_unit.binding_reason,
                 alternative_skills=work_unit.fallback_skills,
                 expected_artifacts=work_unit.expected_artifacts,
                 verification=work_unit.verification,
+                plan_hints=work_unit.plan_hints,
+                verify_hints=work_unit.verify_hints,
                 provenance=work_unit.selected_skill_provenance,
             )
             for work_unit in plan.work_units
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/planner.py` (modified, +18/-1)
```diff
@@ -282,7 +282,21 @@ def build_work_plan(task_card: TaskCard, candidates: tuple[SkillCandidate, ...])
             deliverable,
             candidates,
         )
-        verification = _verification_for_deliverable(task_card, deliverable) or ("confirm work is complete",)
+        selected_candidate = next(
+            (candidate for candidate in candidates if candidate.skill_id == preferred_skill),
+            None,
+        )
+        plan_hints = selected_candidate.plan_hints if selected_candidate is not None else ()
+        verify_hints = selected_candidate.verify_hints if selected_candidate is not None else ()
+        task_verification = _verification_for_deliverable(task_card, deliverable) or ("confirm work is complete",)
+        verification = tuple(
+            dict.fromkeys(
+                (
+                    *task_verification,
+                    *verify_hints,
+                )
+            )
+        )
         work_unit = WorkUnit(
             id=unit_id,
             goal=f"Produce {deliverable}",
@@ -293,6 +307,9 @@ def build_work_plan(task_card: TaskCard, candidates: tuple[SkillCandidate, ...])
             fallback_skills=fallback_skills,
             expected_artifacts=(deliverable,),
             verification=verification,
+            task_verification=task_verification,
+            plan_hints=plan_hints,
+            verify_hints=verify_hints,
             selected_skill_provenance=selected_skill_provenance,
         )
         work_units.append(work_unit)
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/skill_index.py` (modified, +8/-1)
```diff
@@ -206,7 +206,10 @@ def _build_entry(*, skill_dir: Path, skill_file: Path, source_spec: dict[str, ob
         "route_evidence_chunks": route_evidence_chunks,
         "when_to_use": list(manifest.headings),
         "not_for": not_for,
-        "outputs": [],
+        "inputs": list(manifest.inputs),
+        "outputs": list(manifest.outputs),
+        "plan_hints": list(manifest.plan_hints),
+        "verify_hints": list(manifest.verify_hints),
         "tags": list(manifest.tags),
         "enabled": True,
         "priority": 50,
@@ -582,6 +585,10 @@ def _skill_card_payload(entry: dict[str, object]) -> dict[str, object]:
         "capability_evidence": list(entry.get("capability_evidence") or []),
         "route_evidence_chunks": list(entry.get("route_evidence_chunks") or []),
         "not_for": list(entry.get("not_for") or []),
+        "inputs": list(entry.get("inputs") or []),
+        "outputs": list(entry.get("outputs") or []),
+        "plan_hints": list(entry.get("plan_hints") or []),
+        "verify_hints": list(entry.get("verify_hints") or []),
         "tags": list(entry.get("tags") or []),
         "headings": list(entry.get("when_to_use") or []),
         "source_kind": entry["source_kind"],
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/skill_manifest.py` (modified, +75/-0)
```diff
@@ -16,6 +16,26 @@
     + ("enabled", "priority")
 )
 INTEGER_PATTERN = re.compile(r"^-?\d+$")
+BODY_HEADING_PATTERN = re.compile(r"^#{1,6}\s+(.+?)\s*$")
+BODY_GUIDANCE_ITEM_PATTERN = re.compile(r"^(?:[-*+]\s+|\d+[.)]\s+)(.+)$")
+BODY_GUIDANCE_SECTIONS: tuple[tuple[re.Pattern[str], str], ...] = (
+    (re.compile(r"^(?:inputs?|prerequisites?|输入|前置条件)$", re.IGNORECASE), "inputs"),
+    (re.compile(r"^(?:outputs?|deliverables?|输出|交付物)$", re.IGNORECASE), "outputs"),
+    (
+        re.compile(
+            r"^(?:workflow(?:\s*\([^)]*\))?|process|work steps?|steps?|plan|implementation plan|工作流|流程|步骤|计划)$",
+            re.IGNORECASE,
+        ),
+        "plan_hints",
+    ),
+    (
+        re.compile(
+            r"^(?:verification|validation|checks?|exit criteria|acceptance criteria|验证|检查|验收标准)$",
+            re.IGNORECASE,
+        ),
+        "verify_hints",
+    ),
+)
 
 
 @dataclass(frozen=True, slots=True)
@@ -51,6 +71,10 @@ class InstalledSkillManifest:
     root_dir: str = ""
     skill_file: str = ""
     content_sha256: str = ""
+    inputs: tuple[str, ...] = ()
+    outputs: tuple[str, ...] = ()
+    plan_hints: tuple[str, ...] = ()
+    verify_hints: tuple[str, ...] = ()
 
     def model_dump(self) -> dict[str, object]:
         return asdict(self)
@@ -234,6 +258,48 @@ def _dedupe_non_empty(values: tuple[str, ...]) -> tuple[str, ...]:
     return tuple(deduped)
 
 
+def _body_guidance_section(line: str) -> str | None:
+    heading_match = BODY_HEADING_PATTERN.match(line.strip())
+    if heading_match is None:
+        return None
+    heading = heading_match.group(1).strip()
+    for pattern, section in BODY_GUIDANCE_SECTIONS:
+        if pattern.fullmatch(heading):
+            return section
+    return ""
+
+
+def _extract_body_guidance(body_lines: list[str], *, limit_per_section: int = 12) -> dict[str, tuple[str, ...]]:
+    values: dict[str, list[str]] = {
+        "inputs": [],
+        "outputs": [],
+        "plan_hints": [],
+        "verify_hints": [],
+    }
+    active_section = ""
+    in_code_fence = False
+    for line in body_lines:
+        stripped = line.strip()
+        if stripped.startswith("```") or stripped.startswith("~~~"):
+            in_code_fence = not in_code_fence
+            continue
+        if in_code_fence:
+            continue
+        section = _body_guidance_section(stripped)
+        if section is not None:
+            active_section = section
+            continue
+        if not active_section or len(values[active_section]) >= limit_per_section:
+            continue
+        item_match = BODY_GUIDANCE_ITEM_PATTERN.match(stripped)
+        if item_match is None:
+            continue
+        item = item_match.group(1).strip()
+        if item:
+            values[active_section].append(item)
+    return {key: _dedupe_non_empty(tuple(items)) for key, items in values.items()}
+
+
 def _extract_body_not_for_lines(body_lines: list[str]) -> tuple[str, ...]:
     items: list[str] = []
     in_not_for_section = False
@@ -326,12 +392,21 @@ def parse_installed_skill_manifest(skill_file: Path, *, skill_id: str | None = N
     not_for = _dedupe_non_empty(
         _coerce_string_list(frontmatter.get("not_for")) + _extract_body_not_for_lines(body_lines)
     )
+    body_guidance = _extract_body_guidance(body_lines)
     return InstalledSkillManifest(
         skill_id=resolved_skill_id,
         name=name,
         description=description,
         capabilities=_coerce_string_list(frontmatter.get("capabilities")),
         not_for=not_for,
+        inputs=_dedupe_non_empty(_coerce_string_list(frontmatter.get("inputs")) + body_guidance["inputs"]),
+        outputs=_dedupe_non_empty(_coerce_string_list(frontmatter.get("outputs")) + body_guidance["outputs"]),
+        plan_hints=_dedupe_non_empty(
+            _coerce_string_list(frontmatter.get("plan_hints")) + body_guidance["plan_hints"]
+        ),
+        verify_hints=_dedupe_non_empty(
+            _coerce_string_list(frontmatter.get("verify_hints")) + body_guidance["verify_hints"]
+        ),
         tags=_coerce_string_list(frontmatter.get("tags")),
         headings=_extract_heading_lines(body_lines),
         root_dir=str(resolved_file.parent),
```

**File**: `packages/runtime-core/src/vgo_runtime/kernel/work_plan.py` (modified, +3/-0)
```diff
@@ -43,6 +43,9 @@ class WorkUnit:
     status: str = "pending"
     lifecycle_state: str = "active"
     reused_from_work_unit_id: str | None = None
+    task_verification: tuple[str, ...] = ()
+    plan_hints: tuple[str, ...] = ()
+    verify_hints: tuple[str, ...] = ()
 
     def model_dump(self) -> dict[str, object]:
         payload = asdict(self)
```

---

### Incident Patch 6: `d5ae5604` (2026-08-11)
**Commit Message**: Merge pull request #287 from foryourhealth111-pixel/codex/issue-264-direct-fix

governance: collapse the live documentation control plane

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ contributor zone table to recognize a new file category.
 Always read:
 
 - [`docs/developer-change-governance.md`](docs/developer-change-governance.md)
-- [`docs/distribution-governance.md`](docs/distribution-governance.md)
+- [`docs/governance/distribution-governance.md`](docs/governance/distribution-governance.md)
 - [`docs/repo-cleanliness-governance.md`](docs/repo-cleanliness-governance.md)
 
 ### Mirror, Fixture, Provenance, or Compliance
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -408,7 +408,7 @@ completion.
 | `delivery-acceptance-report.json` or `.md` | Stores the final check and shows which items passed |
 
 Maintainers can use the
-[pre-release checklist](docs/status/non-regression-proof-bundle.md). Start with
+[pre-release checks](https://github.com/foryourhealth111-pixel/Vibe-Skills/actions/workflows/vco-gates.yml). Start with
 the checks in that list and run wider audits only when there is a reason.
 
 </details>
@@ -451,7 +451,7 @@ not mean the final result passed its checks.
     <tr><td align="center">See a complete real run</td><td align="center"><strong><a href="./docs/cases/ml-experiment/README.md">Machine-learning experiment case</a></strong></td></tr>
     <tr><td align="center">Install, update, uninstall</td><td align="center"><strong><a href="./docs/install/README.en.md">Simple install</a></strong></td></tr>
     <tr><td align="center">First use</td><td align="center"><strong><a href="./docs/quick-start.en.md">Quick start</a></strong></td></tr>
-    <tr><td align="center">Current release</td><td align="center"><strong><a href="./docs/releases/v4.0.0.md">v4.0.0 notes</a></strong></td></tr>
+    <tr><td align="center">Current release</td><td align="center"><strong><a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/latest">GitHub release metadata</a></strong></td></tr>
     <tr><td align="center">How it works</td><td align="center"><strong><a href="./docs/README.md">Documentation index</a></strong></td></tr>
     <tr><td align="center">Troubleshooting</td><td align="center"><strong><a href="./docs/troubleshooting.md">Troubleshooting guide</a></strong></td></tr>
     <tr><td align="center">Contributing</td><td align="center"><strong><a href="./CONTRIBUTING.md">Contribution guide</a></strong></td></tr>
```

**File**: `README.zh.md` (modified, +2/-2)
```diff
@@ -390,7 +390,7 @@ VibeSkills 会把确认过的需求、计划、执行进度和最终检查保存
 | `module-execution.json` | 保存各部分实际完成的结果，以及完成、失败或被卡住的状态 |
 | `delivery-acceptance-report.json` 或 `.md` | 保存最终检查结果，说明哪些项目已经通过 |
 
-维护项目时，可以使用这份[提交前检查清单](docs/status/non-regression-proof-bundle.md)。
+维护项目时，可以查看 [CI 检查结果](https://github.com/foryourhealth111-pixel/Vibe-Skills/actions/workflows/vco-gates.yml) 和本地 `check.ps1` 输出。
 一般先完成清单里的基础检查；只有发现风险时，再扩大检查范围。
 
 </details>
@@ -433,7 +433,7 @@ VibeSkills 会把确认过的需求、计划、执行进度和最终检查保存
     <tr><td align="center">查看一次完整的真实运行</td><td align="center"><strong><a href="./docs/cases/ml-experiment/README.zh.md">机器学习实验案例</a></strong></td></tr>
     <tr><td align="center">安装、更新、卸载</td><td align="center"><strong><a href="./docs/install/README.md">简明安装指南</a></strong></td></tr>
     <tr><td align="center">第一次使用</td><td align="center"><strong><a href="./docs/quick-start.md">快速开始</a></strong></td></tr>
-    <tr><td align="center">当前发布版本</td><td align="center"><strong><a href="./docs/releases/v4.0.0.md">v4.0.0 发布说明</a></strong></td></tr>
+    <tr><td align="center">当前发布版本</td><td align="center"><strong><a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/latest">GitHub Release 元数据</a></strong></td></tr>
     <tr><td align="center">了解它怎么工作</td><td align="center"><strong><a href="./docs/README.md">文档索引</a></strong></td></tr>
     <tr><td align="center">排查问题</td><td align="center"><strong><a href="./docs/troubleshooting.md">故障排查</a></strong></td></tr>
     <tr><td align="center">参与贡献</td><td align="center"><strong><a href="./CONTRIBUTING.md">贡献指南</a></strong></td></tr>
```

**File**: `THIRD_PARTY_LICENSES.md` (modified, +2/-2)
```diff
@@ -62,9 +62,9 @@ It does not relicense upstream code, prompts, datasets, or services.
 ## Operational References
 
 - Distribution governance policy:
-  [docs/distribution-governance.md](docs/distribution-governance.md)
+  [docs/governance/distribution-governance.md](docs/governance/distribution-governance.md)
 - Upstream governance policy:
-  [docs/governance/upstream-distribution-governance.md](docs/governance/upstream-distribution-governance.md)
+  [docs/governance/distribution-governance.md](docs/governance/distribution-governance.md)
 - Provenance policy:
   [docs/governance/origin-provenance-policy.md](docs/governance/origin-provenance-policy.md)
 - Canonical upstream registry:
```

**File**: `config/current-routing-debt-erasure.json` (modified, +0/-3)
```diff
@@ -81,8 +81,6 @@
       "config",
       "docs/README.md",
       "docs/governance/README.md",
-      "docs/status/README.md",
-      "docs/releases/README.md",
       "docs/governance/vibe-governed-project-delivery-acceptance-governance.md",
       "scripts/router/resolve-pack-route.ps1",
       "scripts/router",
@@ -96,7 +94,6 @@
       "docs/governance/current-routing-contract.md",
       "docs/governance/current-runtime-field-contract.md",
       "docs/install",
-      "docs/status",
       "protocols"
     ],
     "legacy_allowed_paths": [
```

**File**: `config/governance-family-index.json` (modified, +2/-1)
```diff
@@ -9,7 +9,8 @@
   "human_entry_order": [
     "README.md",
     "docs/README.md",
-    "docs/status/non-regression-proof-bundle.md",
+    "config/live-document-contract.json",
+    "references/index.md",
     "scripts/verify/gate-family-index.md"
   ],
   "config_families": [
```

**File**: `config/index.md` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@
 1. 先看 [`version-governance.json`](version-governance.json)、[`repo-cleanliness-policy.json`](repo-cleanliness-policy.json)、[`outputs-boundary-policy.json`](outputs-boundary-policy.json)。
 2. 再看 [`runtime-contract.json`](runtime-contract.json)、[`router-thresholds.json`](router-thresholds.json)、[`skill-alias-map.json`](skill-alias-map.json)。
 3. 需要 rollout / admission 时再进入 boards。
-4. 历史 wave boards / scorecards / archived governance-board snapshots 进入 [`../docs/archive/config/README.md`](../docs/archive/config/README.md)。
+4. 历史 wave boards、scorecards 和治理快照通过 Git 历史或 CI 工件检索。
 
 ## Rules
 
```

**File**: `config/live-document-contract.json` (modified, +79/-1)
```diff
@@ -102,6 +102,84 @@
       "path": "references/developer-entry-contract.md",
       "owner": "contributor-experience",
       "lifecycle": "live"
+    },
+    {
+      "id": "primary-skill-contract",
+      "path": "SKILL.md",
+      "owner": "runtime-entry",
+      "lifecycle": "live"
+    },
+    {
+      "id": "install-guide-zh",
+      "path": "docs/install/README.md",
+      "owner": "installer",
+      "lifecycle": "live"
+    },
+    {
+      "id": "install-guide-en",
+      "path": "docs/install/README.en.md",
+      "owner": "installer",
+      "lifecycle": "live"
+    },
+    {
+      "id": "troubleshooting-guide",
+      "path": "docs/troubleshooting.md",
+      "owner": "operator-experience",
+      "lifecycle": "live"
+    },
+    {
+      "id": "architecture-entry",
+      "path": "docs/architecture.md",
+      "owner": "runtime-architecture",
+      "lifecycle": "live"
+    },
+    {
+      "id": "documentation-architecture",
+      "path": "docs/docs-information-architecture.md",
+      "owner": "governance",
+      "lifecycle": "live"
+    },
+    {
+      "id": "repository-cleanliness-contract",
+      "path": "docs/repo-cleanliness-governance.md",
+      "owner": "verification",
+      "lifecycle": "live"
+    },
+    {
+      "id": "distribution-contract",
+      "path": "docs/governance/distribution-governance.md",
+      "owner": "distribution",
+      "lifecycle": "live"
+    },
+    {
+      "id": "source-neutral-link-contract",
+      "path": "docs/governance/source-neutral-link-governance.md",
+      "owner": "governance",
+      "lifecycle": "live"
+    },
+    {
+      "id": "observability-contract",
+      "path": "docs/governance/observability-consistency-governance.md",
+      "owner": "verification",
+      "lifecycle": "live"
+    },
+    {
+      "id": "delivery-acceptance-contract",
+      "path": "docs/governance/vibe-governed-project-delivery-acceptance-governance.md",
+      "owner": "runtime-contracts",
+      "lifecycle": "live"
+    },
+    {
+      "id": "origin-provenance-contract",
+      "path": "docs/governance/origin-provenance-policy.md",
+      "owner": "provenance",
+      "lifecycle": "retained"
+    },
+    {
+      "id": "references-entry",
+      "path": "references/index.md",
+      "owner": "contributor-experience",
+      "lifecycle": "live"
     }
   ],
   "stable_entry_links": [
@@ -180,6 +258,6 @@
       "docs/plans"
     ],
     "legacy_removal_release": "4.1.0",
-    "legacy_write_mode": "dual_write"
+    "legacy_write_mode": "disabled"
   }
 }
```

---

### Incident Patch 7: `97d07579` (2026-07-19)
**Commit Message**: Merge pull request #257 from foryourhealth111-pixel/codex/simplify-vibe-removal-guidance

docs: simplify VibeSkills removal guidance

**File**: `docs/README.md` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@
 
 ## 按需再看
 
-- [`cold-start-install-paths.md`](./cold-start-install-paths.md)：其他环境与旧宿主说明；当前安装仍以 install README 为准
+- [`cold-start-install-paths.md`](./cold-start-install-paths.md)：选择 SkillsDir 的简短说明
 
 ## Current Runtime
 
@@ -56,7 +56,7 @@
 ## Rules
 
 - 根目录 `docs/*.md` 只放长期文档，不把 dated plans 或 batch reports 升格为长期合同。
-- 安装口径以 [`install/README.md`](./install/README.md) 为主；[`cold-start-install-paths.md`](./cold-start-install-paths.md) 只保留其他环境和旧宿主说明，不再充当当前安装主入口。
+- 安装说明以 [`install/README.md`](./install/README.md) 为主。
 - specialized governance、design、external-tooling 叶子页优先放入对应 family 目录，而不是继续堆回 `docs/*.md` 根层。
 - 当前状态以 [`status/current-state.md`](./status/current-state.md) 和 `outputs/verify/**` 为准，不在索引页手工维护状态表。
 - 更低层的脚本 operator surface 仍在 [`../scripts/README.md`](../scripts/README.md)，但它不是 `docs/` 根索引的公开第一跳入口。
```

**File**: `docs/cold-start-install-paths.en.md` (modified, +0/-2)
```diff
@@ -1,7 +1,5 @@
 # Choose A Skills Directory
 
-This page used to describe the old multi-host one-shot bootstrap path. That path is retired.
-
 The current install contract has one interface for every AI application:
 
 ```text
```

**File**: `docs/cold-start-install-paths.md` (modified, +0/-2)
```diff
@@ -1,7 +1,5 @@
 # 选择 Skills 目录
 
-这页过去描述旧的多宿主 one-shot bootstrap 路径。那条路径已经退役。
-
 当前安装契约对所有 AI 应用都只有一个接口：
 
 ```text
```

**File**: `docs/install/README.en.md` (modified, +5/-19)
```diff
@@ -54,27 +54,13 @@ bash ./check.sh --skills-dir "$HOME/.agents/skills"
 
 Do not extract the new release inside the managed `<SkillsDir>/vibe` directory. `update` refuses to overwrite receipt-owned files when drift is detected.
 
-## Uninstall
+## Remove
 
-Uninstall is not part of the install or update sequence. Run it only when you intend to remove VibeSkills:
+To remove VibeSkills, delete `<SkillsDir>/vibe` from the installation location.
 
-```powershell
-pwsh -NoProfile -File .\uninstall.ps1 -SkillsDir "$HOME\.agents\skills"
-```
-
-```bash
-bash ./uninstall.sh --skills-dir "$HOME/.agents/skills"
-```
-
-`uninstall` removes only files recorded in the receipt and keeps user-added files.
-
-## Upgrading From v3 To v4
+## Replace An Older Version
 
-1. Record the `SkillsDir` used by the current install.
-2. Download and extract `vibe-skills-4.0.0-public.zip`.
-3. Run the v4 `update` wrapper against the existing `SkillsDir`.
-4. Run `check` and confirm that receipt-owned missing and drifted file counts are both `0`.
-5. Use `vibe` for subsequent governed runs. Retired legacy entry names are not part of the v4 public runtime.
+Delete the old `<SkillsDir>/vibe` folder, then install the current release with the commands above.
 
 v4 does not automatically install or recommend the `chrome`, `chrome-devtools`, `playwright`, `context7`, or `claude-flow` MCPs. The installer also does not modify their host configuration.
 
@@ -83,4 +69,4 @@ The installer does not edit Codex, Claude, or Agents settings. It also does not
 - User level: `~/.vibeskills/skill-roots.json`
 - Workspace level: `<workspace>/.vibeskills/skill-roots.json`
 
-Repo checkout install is a developer/internal path now. The old multi-host install guides were moved to `docs/archive/install-legacy/2026-07-02/`.
+Repository checkout installation is for development only.
```

**File**: `docs/install/README.md` (modified, +5/-19)
```diff
@@ -52,27 +52,13 @@ bash ./check.sh --skills-dir "$HOME/.agents/skills"
 
 不要把新版本解压到受管目录 `<SkillsDir>/vibe` 里面。`update` 发现收据登记文件被修改时会拒绝覆盖。
 
-## 卸载
+## 移除
 
-卸载不属于安装或更新步骤。只在你确实要移除 VibeSkills 时运行：
+要移除 VibeSkills，直接删除安装位置中的 `<SkillsDir>/vibe` 文件夹。
 
-```powershell
-pwsh -NoProfile -File .\uninstall.ps1 -SkillsDir "$HOME\.agents\skills"
-```
-
-```bash
-bash ./uninstall.sh --skills-dir "$HOME/.agents/skills"
-```
-
-`uninstall` 只删除收据登记的文件，保留用户额外添加的文件。
-
-## 从 v3 升级到 v4
+## 替换旧版本
 
-1. 记录当前安装使用的 `SkillsDir`。
-2. 下载并解压 `vibe-skills-4.0.0-public.zip`。
-3. 从 v4 解压目录对原来的 `SkillsDir` 运行 `update`。
-4. 运行 `check`，确认收据登记文件缺失为 `0`、漂移为 `0`。
-5. 后续统一调用 `vibe`。已退役的旧入口不再属于 v4 公开运行时。
+删除原来的 `<SkillsDir>/vibe` 文件夹，再按上面的安装命令安装当前版本。
 
 v4 不会自动安装或推荐 `chrome`、`chrome-devtools`、`playwright`、`context7` 或 `claude-flow` MCP。安装器也不会替用户修改这些 MCP 的主机配置。
 
@@ -81,4 +67,4 @@ v4 不会自动安装或推荐 `chrome`、`chrome-devtools`、`playwright`、`co
 - 用户级：`~/.vibeskills/skill-roots.json`
 - 项目级：`<workspace>/.vibeskills/skill-roots.json`
 
-仓库 checkout 安装现在只属于 developer/internal 路径。旧的多宿主安装说明已经移到 `docs/archive/install-legacy/2026-07-02/`。
+仓库 checkout 安装只用于开发。
```

**File**: `docs/quick-start.en.md` (modified, +3/-2)
```diff
@@ -35,8 +35,9 @@ Open the installation guide:
 - [`install/README.en.md`](./install/README.en.md)
 
 The simplest path starts from the published release zip, not a repository
-checkout. If VibeSkills is already installed, download the newer zip and run
-`update` against the same Skills folder.
+checkout. For a normal update, download the newer zip and run `update` against
+the same Skills folder. For a clean reinstall, delete `<SkillsDir>/vibe` and
+install the current release.
 
 After installation, start VibeSkills from the Skills entry in your current AI
 application. Its host-neutral core works with any application that supports
```

**File**: `docs/quick-start.md` (modified, +3/-2)
```diff
@@ -35,8 +35,9 @@ VibeSkills 重点解决五件事：
 
 - [`install/README.md`](./install/README.md)
 
-最省事的做法是从发布版本 zip 开始，不要直接从仓库源码安装。已经安装过
-VibeSkills 时，先下载新版本的 zip，再对原来的 Skills 文件夹运行 `update`。
+最省事的做法是从发布版本 zip 开始，不要直接从仓库源码安装。正常更新时，
+下载新版本的 zip，再对原来的 Skills 文件夹运行 `update`。要重新安装时，
+直接删除原来的 `<SkillsDir>/vibe`，再安装当前版本。
 
 安装完成后，从当前 AI 应用的 Skills 入口启动。VibeSkills 的核心不绑定任何
 单一工具，凡是支持本地 Skills 的 AI 应用都可以使用；具体可输入 `$vibe`、
```

**File**: `docs/releases/v4.0.0.md` (modified, +2/-2)
```diff
@@ -15,14 +15,14 @@
 
 ## Why This Is A Major Release
 
-v4 changes the public execution and migration boundary. It removes legacy entry names and internal execution owners, then makes the Agent handoff plus canonical module-result re-entry the only supported completion path. Existing v3 installations can update in place, but callers that relied on retired wrapper names or native specialist execution must migrate.
+v4 changes the public execution and migration boundary. It removes legacy entry names and internal execution owners, then makes the Agent handoff plus canonical module-result re-entry the only supported completion path. Replace an existing v3 installation with a fresh v4 install.
 
 ## Installation And Upgrade
 
 - Download `vibe-skills-4.0.0-public.zip` from the [GitHub Releases page](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases).
 - For a shared user-level install, run `install` or `update` against `~/.agents/skills`.
 - For a Codex-only install, target `~/.codex/skills` explicitly.
-- Upgrade an existing v3 install by running the v4 `update` wrapper against the same `SkillsDir`, then run `check`.
+- Replace an existing v3 install by deleting its `vibe` folder, then install v4.
 - The installer owns only receipt-listed files under `<SkillsDir>/vibe`; it preserves user-added files and refuses unowned path conflicts.
 - A repository checkout remains a developer/internal source. Public users should install from the published release zip.
 
```

---

### Incident Patch 8: `8f4d38f4` (2026-07-19)
**Commit Message**: docs: simplify VibeSkills removal guidance

**File**: `docs/README.md` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@
 
 ## 按需再看
 
-- [`cold-start-install-paths.md`](./cold-start-install-paths.md)：其他环境与旧宿主说明；当前安装仍以 install README 为准
+- [`cold-start-install-paths.md`](./cold-start-install-paths.md)：选择 SkillsDir 的简短说明
 
 ## Current Runtime
 
@@ -56,7 +56,7 @@
 ## Rules
 
 - 根目录 `docs/*.md` 只放长期文档，不把 dated plans 或 batch reports 升格为长期合同。
-- 安装口径以 [`install/README.md`](./install/README.md) 为主；[`cold-start-install-paths.md`](./cold-start-install-paths.md) 只保留其他环境和旧宿主说明，不再充当当前安装主入口。
+- 安装说明以 [`install/README.md`](./install/README.md) 为主。
 - specialized governance、design、external-tooling 叶子页优先放入对应 family 目录，而不是继续堆回 `docs/*.md` 根层。
 - 当前状态以 [`status/current-state.md`](./status/current-state.md) 和 `outputs/verify/**` 为准，不在索引页手工维护状态表。
 - 更低层的脚本 operator surface 仍在 [`../scripts/README.md`](../scripts/README.md)，但它不是 `docs/` 根索引的公开第一跳入口。
```

**File**: `docs/cold-start-install-paths.en.md` (modified, +0/-2)
```diff
@@ -1,7 +1,5 @@
 # Choose A Skills Directory
 
-This page used to describe the old multi-host one-shot bootstrap path. That path is retired.
-
 The current install contract has one interface for every AI application:
 
 ```text
```

**File**: `docs/cold-start-install-paths.md` (modified, +0/-2)
```diff
@@ -1,7 +1,5 @@
 # 选择 Skills 目录
 
-这页过去描述旧的多宿主 one-shot bootstrap 路径。那条路径已经退役。
-
 当前安装契约对所有 AI 应用都只有一个接口：
 
 ```text
```

**File**: `docs/install/README.en.md` (modified, +5/-19)
```diff
@@ -54,27 +54,13 @@ bash ./check.sh --skills-dir "$HOME/.agents/skills"
 
 Do not extract the new release inside the managed `<SkillsDir>/vibe` directory. `update` refuses to overwrite receipt-owned files when drift is detected.
 
-## Uninstall
+## Remove
 
-Uninstall is not part of the install or update sequence. Run it only when you intend to remove VibeSkills:
+To remove VibeSkills, delete `<SkillsDir>/vibe` from the installation location.
 
-```powershell
-pwsh -NoProfile -File .\uninstall.ps1 -SkillsDir "$HOME\.agents\skills"
-```
-
-```bash
-bash ./uninstall.sh --skills-dir "$HOME/.agents/skills"
-```
-
-`uninstall` removes only files recorded in the receipt and keeps user-added files.
-
-## Upgrading From v3 To v4
+## Replace An Older Version
 
-1. Record the `SkillsDir` used by the current install.
-2. Download and extract `vibe-skills-4.0.0-public.zip`.
-3. Run the v4 `update` wrapper against the existing `SkillsDir`.
-4. Run `check` and confirm that receipt-owned missing and drifted file counts are both `0`.
-5. Use `vibe` for subsequent governed runs. Retired legacy entry names are not part of the v4 public runtime.
+Delete the old `<SkillsDir>/vibe` folder, then install the current release with the commands above.
 
 v4 does not automatically install or recommend the `chrome`, `chrome-devtools`, `playwright`, `context7`, or `claude-flow` MCPs. The installer also does not modify their host configuration.
 
@@ -83,4 +69,4 @@ The installer does not edit Codex, Claude, or Agents settings. It also does not
 - User level: `~/.vibeskills/skill-roots.json`
 - Workspace level: `<workspace>/.vibeskills/skill-roots.json`
 
-Repo checkout install is a developer/internal path now. The old multi-host install guides were moved to `docs/archive/install-legacy/2026-07-02/`.
+Repository checkout installation is for development only.
```

**File**: `docs/install/README.md` (modified, +5/-19)
```diff
@@ -52,27 +52,13 @@ bash ./check.sh --skills-dir "$HOME/.agents/skills"
 
 不要把新版本解压到受管目录 `<SkillsDir>/vibe` 里面。`update` 发现收据登记文件被修改时会拒绝覆盖。
 
-## 卸载
+## 移除
 
-卸载不属于安装或更新步骤。只在你确实要移除 VibeSkills 时运行：
+要移除 VibeSkills，直接删除安装位置中的 `<SkillsDir>/vibe` 文件夹。
 
-```powershell
-pwsh -NoProfile -File .\uninstall.ps1 -SkillsDir "$HOME\.agents\skills"
-```
-
-```bash
-bash ./uninstall.sh --skills-dir "$HOME/.agents/skills"
-```
-
-`uninstall` 只删除收据登记的文件，保留用户额外添加的文件。
-
-## 从 v3 升级到 v4
+## 替换旧版本
 
-1. 记录当前安装使用的 `SkillsDir`。
-2. 下载并解压 `vibe-skills-4.0.0-public.zip`。
-3. 从 v4 解压目录对原来的 `SkillsDir` 运行 `update`。
-4. 运行 `check`，确认收据登记文件缺失为 `0`、漂移为 `0`。
-5. 后续统一调用 `vibe`。已退役的旧入口不再属于 v4 公开运行时。
+删除原来的 `<SkillsDir>/vibe` 文件夹，再按上面的安装命令安装当前版本。
 
 v4 不会自动安装或推荐 `chrome`、`chrome-devtools`、`playwright`、`context7` 或 `claude-flow` MCP。安装器也不会替用户修改这些 MCP 的主机配置。
 
@@ -81,4 +67,4 @@ v4 不会自动安装或推荐 `chrome`、`chrome-devtools`、`playwright`、`co
 - 用户级：`~/.vibeskills/skill-roots.json`
 - 项目级：`<workspace>/.vibeskills/skill-roots.json`
 
-仓库 checkout 安装现在只属于 developer/internal 路径。旧的多宿主安装说明已经移到 `docs/archive/install-legacy/2026-07-02/`。
+仓库 checkout 安装只用于开发。
```

**File**: `docs/quick-start.en.md` (modified, +3/-2)
```diff
@@ -35,8 +35,9 @@ Open the installation guide:
 - [`install/README.en.md`](./install/README.en.md)
 
 The simplest path starts from the published release zip, not a repository
-checkout. If VibeSkills is already installed, download the newer zip and run
-`update` against the same Skills folder.
+checkout. For a normal update, download the newer zip and run `update` against
+the same Skills folder. For a clean reinstall, delete `<SkillsDir>/vibe` and
+install the current release.
 
 After installation, start VibeSkills from the Skills entry in your current AI
 application. Its host-neutral core works with any application that supports
```

**File**: `docs/quick-start.md` (modified, +3/-2)
```diff
@@ -35,8 +35,9 @@ VibeSkills 重点解决五件事：
 
 - [`install/README.md`](./install/README.md)
 
-最省事的做法是从发布版本 zip 开始，不要直接从仓库源码安装。已经安装过
-VibeSkills 时，先下载新版本的 zip，再对原来的 Skills 文件夹运行 `update`。
+最省事的做法是从发布版本 zip 开始，不要直接从仓库源码安装。正常更新时，
+下载新版本的 zip，再对原来的 Skills 文件夹运行 `update`。要重新安装时，
+直接删除原来的 `<SkillsDir>/vibe`，再安装当前版本。
 
 安装完成后，从当前 AI 应用的 Skills 入口启动。VibeSkills 的核心不绑定任何
 单一工具，凡是支持本地 Skills 的 AI 应用都可以使用；具体可输入 `$vibe`、
```

**File**: `docs/releases/v4.0.0.md` (modified, +2/-2)
```diff
@@ -15,14 +15,14 @@
 
 ## Why This Is A Major Release
 
-v4 changes the public execution and migration boundary. It removes legacy entry names and internal execution owners, then makes the Agent handoff plus canonical module-result re-entry the only supported completion path. Existing v3 installations can update in place, but callers that relied on retired wrapper names or native specialist execution must migrate.
+v4 changes the public execution and migration boundary. It removes legacy entry names and internal execution owners, then makes the Agent handoff plus canonical module-result re-entry the only supported completion path. Replace an existing v3 installation with a fresh v4 install.
 
 ## Installation And Upgrade
 
 - Download `vibe-skills-4.0.0-public.zip` from the [GitHub Releases page](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases).
 - For a shared user-level install, run `install` or `update` against `~/.agents/skills`.
 - For a Codex-only install, target `~/.codex/skills` explicitly.
-- Upgrade an existing v3 install by running the v4 `update` wrapper against the same `SkillsDir`, then run `check`.
+- Replace an existing v3 install by deleting its `vibe` folder, then install v4.
 - The installer owns only receipt-listed files under `<SkillsDir>/vibe`; it preserves user-added files and refuses unowned path conflicts.
 - A repository checkout remains a developer/internal source. Public users should install from the published release zip.
 
```

---

### Incident Patch 9: `0cf73bcc` (2026-07-18)
**Commit Message**: Merge pull request #252 from foryourhealth111-pixel/codex/restore-linux-do-acknowledgement

docs: restore community credits and refine README visuals

**File**: `README.md` (modified, +299/-115)
```diff
@@ -8,11 +8,13 @@
 
 <h1>VibeSkills</h1>
 
-<h3>Make local Skills work as a system.</h3>
+<h3>Organize the right local Skills and carry complex tasks through to delivery.</h3>
 
-<p><strong>Complex tasks often trigger only the most obvious Skills.</strong><br>
-VibeSkills maps the whole task first, then organizes relevant local Skills around each module,<br>
-so more of the capability you already installed can contribute where it actually helps.</p>
+<p>Skills preserve valuable, proven ways of working. As a task grows more complex, an agent often falls back on the few Skills that are easiest to trigger. The rest rarely make it into the plan, and when several Skills are involved, responsibilities and outputs can fail to connect.<br>
+VibeSkills aims to organize those existing local capabilities through a complete harness.<br>
+It draws on the engineering discipline of Superpowers and the phased planning approach of GSD-Lite. A fixed state machine connects requirement confirmation, execution planning, Skill organization, state-driven execution, testing and evaluation, and final acceptance.<br>
+This gives users an end-to-end delivery experience from the initial request to final acceptance, while lowering the cognitive overhead and barrier to entry of working with AI agents.<br>
+The Skill library can keep growing. Skills that are not needed today can stay available until the right task arrives, while the workflow selects and assigns what each task needs.</p>
 
 <a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/latest">
   <img src="https://img.shields.io/github/v/release/foryourhealth111-pixel/Vibe-Skills?display_name=tag&sort=semver&style=for-the-badge&color=14515B" alt="Latest release">
@@ -35,124 +37,297 @@ so more of the capability you already installed can contribute where it actually
 
 ---
 
-## Why VibeSkills exists
+## A real run: completing a machine-learning experiment
 
-> [!IMPORTANT]
-> A complex task often contains several kinds of work. If it has four parts, the
-> AI may think to use a Skill for only two of them and handle the rest on the
-> spot, even when better local Skills are already installed. VibeSkills looks at
-> the whole task before deciding where a Skill can help.
+> **Task**
+>
+> Use public data to complete a reproducible classification experiment and
+> deliver a data audit, statistical review, 4 result figures, a scientific
+> report, and a 7-slide group-meeting deck.
 
-| Passive Skill triggering | With VibeSkills |
-|:---|:---|
-| The AI reacts to a few obvious words | It splits the whole task first |
-| The same familiar Skills are used repeatedly | Each part is checked for a better-fitting Skill |
-| Unmatched work is handled on the spot | A useful Skill is assigned to specific work with a stated result |
-| Separate calls are left disconnected | All results are brought together and checked at the end |
+The diagram shows what happened after the requirement and plan were approved:
+how the task was executed, what it produced, and how the result was checked.
 
-VibeSkills first makes the task clear, then lets the right Skills help with the
-right parts. It selects only the Skills that are useful for the task. Work that
-does not need a dedicated Skill stays with the current AI.
+The task used the `L` workflow and proceeded in order. During publication
+preparation, the configured folders on the same host contained more than 100
+Skills. VibeSkills reviewed the candidates and their `SKILL.md` files, selected
+7 for this task, and arranged the work into 5 groups and 10 work units. Those
+units covered environment setup, data audit, modeling, statistical review,
+figures, the report, and the slide deck.
 
-## Decompose first, then organize Skills
+After the work finished, VibeSkills ran 17 checks across the data, experiment
+results, figures, report, and slides. The task passed final acceptance after the
+required files, cross-deliverable consistency, and core reproduction all passed.
 
 ```mermaid
-flowchart TB
-    task["One complex task"] --> map["VibeSkills splits the task first"]
-    map --> m1["01 · Scope / research"]
-    map --> m2["02 · Build / change"]
-    map --> m3["03 · Test / review"]
-    map --> m4["04 · Document / deliver"]
-
-    pool["Your installed local Skills"] --> match["Read each Skill description and choose by need"]
-    match --> m1
-    match --> m2
-    match --> m3
-    match --> m4
-
-    m1 --> integrate["Bring the results together"]
-    m2 --> integrate
-    m3 --> integrate
-    m4 --> integrate
-    integrate --> proof["Check the result and save the progress"]
-
-    classDef task fill:#0F3D3E,stroke:#0F3D3E,color:#FFFFFF,stroke-width:2px
-    classDef map fill:#EDE9FE,stroke:#7C3AED,color:#2E1065,stroke-width:2px
-    classDef pool fill:#FFF7ED,stroke:#EA580C,color:#7C2D12,stroke-width:2px
-    classDef match fill:#FEF3C7,stroke:#CA8A04,color:#713F12,stroke-width:2px
-    classDef blue fill:#E0F2FE,stroke:#0284C7,col
```

**File**: `README.zh.md` (modified, +271/-102)
```diff
@@ -8,11 +8,13 @@
 
 <h1>VibeSkills</h1>
 
-<h3>让本地 Skills 成体系地工作起来。</h3>
+<h3>组织合适的本地 Skills，把复杂任务做完整。</h3>
 
-<p><strong>复杂任务经常只触发最显眼的那几个 Skills。</strong><br>
-VibeSkills 先把整个任务拆开，再逐模块组织相关的本地 Skills，<br>
-让你已经安装的能力真正参与到适合它的工作里。</p>
+<p>Skills 是优秀的实践资产。任务一复杂，Agent 往往反复调用最容易触发的几个，其余 Skills 很少被安排进计划；多个 Skills 一起参与时，分工和结果也容易接不上。<br>
+VibeSkills 想做的，就是用一套完整的 harness，把这些已经存在于本地的能力组织起来。<br>
+它参考了 Superpowers 的工程纪律和 GSD-Lite 的分阶段规划方式，通过固定状态机，把需求确认、执行规划、Skills 组织、按状态推进、测试评估和最终验收连接起来。<br>
+这让一项任务可以沿着同一套流程，从需求确认一直走到最终验收，也降低了使用 AI Agent 时的认知负担和上手门槛。<br>
+Skill 库可以继续扩充。暂时用不到的 Skills 留在库里，合适的任务出现时再参与；每次任务需要哪些 Skills，由流程重新选择和安排。</p>
 
 <a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/latest">
   <img src="https://img.shields.io/github/v/release/foryourhealth111-pixel/Vibe-Skills?display_name=tag&sort=semver&style=for-the-badge&color=14515B" alt="最新版本">
@@ -35,131 +37,289 @@ VibeSkills 先把整个任务拆开，再逐模块组织相关的本地 Skills
 
 ---
 
-## 为什么需要 VibeSkills
+## 一次真实运行：完成一项机器学习实验
 
-> [!IMPORTANT]
-> 一个复杂任务通常不止一件事。如果任务有四部分，AI 可能只在其中两部分想到
-> 使用 Skill，剩下两部分仍然临场处理，即使你已经装了更合适的 Skill。
-> VibeSkills 会先看完整任务，再决定每一部分需要什么帮助。
+> **任务**
+>
+> 使用公开数据完成一个可复现的分类实验，并交付数据审计、统计复核、4 张结果图、
+> 科学报告和 7 页组会 Slides。
 
-| 只靠被动触发 | 使用 VibeSkills |
-|:---|:---|
-| AI 临时根据几个关键词决定用什么 | 先把整个任务完整拆开 |
-| 容易反复使用最熟悉的一两个 Skills | 每一部分都看看有没有更合适的 Skill |
-| 没匹配到的部分继续临场处理 | 把合适的 Skill 安排到具体工作上，并写清要做出什么 |
-| 各次调用互不衔接 | 最后把所有结果汇总起来一起检查 |
+这张图展示的是需求和计划确认之后，这次任务怎样实际执行并完成检查。
 
-VibeSkills 做的事情很直接：**先把任务拆清楚，再让合适的 Skills 去帮助合适的
-部分**。它不会为了显得热闹而把所有 Skills 都叫一遍。某一部分不需要专门的
-Skill，就由当前 AI 继续完成；需要时，则不会因为被动触发没碰上而错过。
+这次任务按 `L` 级计划顺序推进。发布准备时，同一台主机的已配置
+目录中统计到 100 多个 Skills；VibeSkills 查看候选并读取相关的 `SKILL.md`，最后
+选出适合这次任务的 7 个 Skills，再把工作安排成 5 个工作组和 10 个工作单元。
+这些工作依次完成环境准备、数据审计、建模、统计复核、图表、报告和 Slides。
 
-## 先拆任务，再组织 Skills
+所有工作完成后，VibeSkills 对数据、实验结果、图表、报告和 Slides 做了 17 项检查。
+文件齐全、内容一致、核心实验可以复现后，这次任务通过最终验收。
 
 ```mermaid
-flowchart TB
-    task["一个复杂任务"] --> map["VibeSkills 先把任务拆开"]
-    map --> m1["01 · 范围 / 调研"]
-    map --> m2["02 · 实现 / 修改"]
-    map --> m3["03 · 测试 / 审查"]
-    map --> m4["04 · 文档 / 交付"]
-
-    pool["你已经安装的本地 Skills"] --> match["查看每个 Skill 的说明，按工作需要选择"]
-    match --> m1
-    match --> m2
-    match --> m3
-    match --> m4
-
-    m1 --> integrate["汇总各部分结果"]
-    m2 --> integrate
-    m3 --> integrate
-    m4 --> integrate
-    integrate --> proof["检查结果，并记住做到哪里"]
-
-    classDef task fill:#0F3D3E,stroke:#0F3D3E,color:#FFFFFF,stroke-width:2px
-    classDef map fill:#EDE9FE,stroke:#7C3AED,color:#2E1065,stroke-width:2px
-    classDef pool fill:#FFF7ED,stroke:#EA580C,color:#7C2D12,stroke-width:2px
-    classDef match fill:#FEF3C7,stroke:#CA8A04,color:#713F12,stroke-width:2px
-    classDef blue fill:#E0F2FE,stroke:#0284C7,color:#0C4A6E
-    classDef coral fill:#FFE4E6,stroke:#E11D48,color:#881337
-    classDef green fill:#DCFCE7,stroke:#16A34A,color:#14532D
-    classDef violet fill:#F3E8FF,stroke:#9333EA,color:#581C87
-    classDef finish fill:#ECFDF5,stroke:#059669,color:#064E3B,stroke-width:2px
-
-    class task task
-    class map map
-    class pool pool
-    class match match
-    class m1 blue
-    class m2 coral
-    class m3 green
-    class m4 violet
-    class integrate,proof finish
+%%{init: {"flowchart": {"curve": "linear", "nodeSpacing": 18, "rankSpacing": 36}}}%%
+flowchart LR
+    subgraph DISC["Skill 发现"]
+        direction TB
+        A["本地 Skill 目录<br/>100+ Skills"]
+        B["筛选候选<br/>读取 SKILL.md"]
+        SEL["Skill 选择<br/>7 个 Skills 已分配"]
+        A --> B
+        B --> SEL
+    end
+
+    subgraph EXEC["执行 · 5 个工作组 · 10 个工作单元"]
+        direction TB
+
+        subgraph G1["G1 · 01 环境与数据"]
+            direction LR
+            u01["U01<br/>环境准备"]
+            u02["U02<br/>数据审计"]
+            u01 --> u02
+        end
+
+        subgraph G2["G2 · 02 建模与复现"]
+            direction LR
+            u03["U03<br/>基线实验"]
+        end
+
+        subgraph G3["G3 · 03 统计与科学复核"]
+            direction LR
+            u04["U04<br/>统计分析"]
+            u05["U05<br/>科学复核"]
+            u04 --> u05
+        end
+
+        subgraph G4["G4 · 04 图表与报告"]
+            direction LR
+            u06["U06<br/>结果图"]
+            u07["U07<br/>报告初稿"]
+            u08["U08<br/>报告复核"]
+            u06 --> u07
+            u07 --> u08
+        end
+
+        subgraph G5["G5 · 05 Slides 与验收"]
+            direction LR
+            u09["U09<br/>组会 Slides"]
+            u10["U10<br/>案例打包与一致性检查"]
+            u09 --> u10
+        end
+
+        G1 --> G2
+        G2 --> G3
+        G3 --> G4
+        G4 --> G5
+    end
+
+    subgraph MID["运行与产物"]
+        direction TB
+        S(["运行状态<br/>10 / 10 完成<br/>0 失败 · 0 阻塞"])
+        D["实际产物<br/>4 张图 · 科学报告<br/>7 页 Slides"]
+        S --> D
+    end
+
+    subgraph VERIFY["验证 · 17 项检查"]
+        direction TB
+
+        subgraph V1["V1 · 基础与计划"]
+            direction LR
+            t01["T01<br/>必需文件"]
+            t02["T02<br/>模块输出匹配"]
+            t03["T03<br/>运行与计划绑定"]
+            t04["T04<br/>环境合同"]
+           
```

**File**: `docs/assets/vibeskills-octopus-mark.svg` (removed, +0/-50)
```diff
@@ -1,50 +0,0 @@
-<svg width="320" height="320" viewBox="0 0 320 320" fill="none" xmlns="http://www.w3.org/2000/svg">
-  <defs>
-    <linearGradient id="bgGlow" x1="54" y1="38" x2="261" y2="274" gradientUnits="userSpaceOnUse">
-      <stop stop-color="#D9F6F1"/>
-      <stop offset="1" stop-color="#F8F4EB"/>
-    </linearGradient>
-    <linearGradient id="bodyFill" x1="114" y1="74" x2="213" y2="219" gradientUnits="userSpaceOnUse">
-      <stop stop-color="#1E7B7A"/>
-      <stop offset="1" stop-color="#104B56"/>
-    </linearGradient>
-    <linearGradient id="tentacleFill" x1="95" y1="174" x2="225" y2="258" gradientUnits="userSpaceOnUse">
-      <stop stop-color="#2A8F8E"/>
-      <stop offset="1" stop-color="#16535C"/>
-    </linearGradient>
-    <filter id="shadow" x="54" y="44" width="212" height="224" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
-      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0F4550" flood-opacity="0.18"/>
-    </filter>
-  </defs>
-
-  <circle cx="160" cy="160" r="122" fill="url(#bgGlow)"/>
-  <circle cx="238" cy="82" r="17" fill="#F47D6B" fill-opacity="0.18"/>
-  <circle cx="82" cy="232" r="14" fill="#1E7B7A" fill-opacity="0.10"/>
-  <circle cx="160" cy="60" r="28" stroke="#1E7B7A" stroke-opacity="0.18" stroke-width="2"/>
-
-  <g filter="url(#shadow)">
-    <path d="M113 175C99 188 90 204 90 221C90 238 99 249 114 249C130 249 140 238 140 223V196H113V175Z" fill="url(#tentacleFill)"/>
-    <path d="M133 185C121 197 113 211 113 226C113 242 122 252 136 252C149 252 159 242 159 228V200H133V185Z" fill="url(#tentacleFill)"/>
-    <path d="M160 188C148 198 141 211 141 226C141 241 150 251 163 251C177 251 186 241 186 226V202H160V188Z" fill="url(#tentacleFill)"/>
-    <path d="M186 184C175 196 168 210 168 226C168 241 177 251 190 251C203 251 213 241 213 225V199H186V184Z" fill="url(#tentacleFill)"/>
-    <path d="M208 174C194 187 186 203 186 220C186 238 197 249 212 249C227 249 238 237 238 221C238 204 229 188 215 175L208 174Z" fill="url(#tentacleFill)"/>
-
-    <path d="M95 145C95 100 124 70 160 70C196 70 225 100 225 145C225 173 205 194 160 194C115 194 95 173 95 145Z" fill="url(#bodyFill)"/>
-    <path d="M120 111C129 95 143 85 160 85C177 85 191 95 200 111" stroke="#B7FFF3" stroke-opacity="0.34" stroke-width="6" stroke-linecap="round"/>
-
-    <ellipse cx="136" cy="141" rx="15" ry="17" fill="#F8F4EB"/>
-    <ellipse cx="184" cy="141" rx="15" ry="17" fill="#F8F4EB"/>
-    <circle cx="140" cy="144" r="6" fill="#0F4550"/>
-    <circle cx="180" cy="144" r="6" fill="#0F4550"/>
-    <circle cx="143" cy="141" r="2" fill="#F8F4EB"/>
-    <circle cx="183" cy="141" r="2" fill="#F8F4EB"/>
-
-    <circle cx="119" cy="157" r="7" fill="#F47D6B" fill-opacity="0.55"/>
-    <circle cx="201" cy="157" r="7" fill="#F47D6B" fill-opacity="0.55"/>
-    <path d="M147 165C151 170 156 172 160 172C164 172 169 170 173 165" stroke="#F8F4EB" stroke-width="4.5" stroke-linecap="round"/>
-  </g>
-
-  <circle cx="248" cy="124" r="5" fill="#1E7B7A"/>
-  <circle cx="260" cy="124" r="5" fill="#1E7B7A" fill-opacity="0.55"/>
-  <circle cx="272" cy="124" r="5" fill="#1E7B7A" fill-opacity="0.25"/>
-</svg>
```

**File**: `docs/cases/ml-experiment/PUBLICATION-NOTES.md` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+# Publication notes
+
+This directory is a public snapshot of the accepted local case run
+`20260718T041559Z-51996499`.
+
+The accepted source artifacts remain unchanged in the local case workspace.
+Evidence text, JSON, and SVG copies normalize machine-specific paths and remove
+non-semantic trailing spaces:
+
+- The accepted case directory becomes `<case-root>`.
+- Its surrounding workspace becomes `<case-workspace>`.
+- The repository checkout becomes `<repository>`.
+- The local user home becomes `<user-home>`.
+
+Metrics, model settings, module status, verification results, run IDs, and
+delivery-acceptance results are not changed. The Skill inventory snapshot was
+captured during publication preparation on the same host after the accepted
+run; it is identified as a publication-time snapshot rather than a
+runtime-emitted artifact.
+
+The public reproduction wrapper rebuilds the accepted deliverable directory
+shape under `reproduce/generated/`; the four computational Python scripts, the
+dependency lock, raster figures, slide montage, and PPTX remain byte-identical
+accepted copies. The SVG copies differ only by removed trailing spaces. Links
+inside the public report point to this directory's copied figures.
+`case-manifest.json` remains the accepted run snapshot, so its file hashes
+describe the original case package.
```

**File**: `docs/cases/ml-experiment/README.md` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+<div align="right">
+  <strong>English</strong> | <a href="./README.zh.md">中文</a>
+</div>
+
+# Real case: completing a machine-learning experiment
+
+This directory preserves one public VibeSkills case that passed final delivery
+acceptance. The task used scikit-learn's bundled Wisconsin Breast Cancer dataset
+and delivered a data audit, baseline model, statistical review, result figures,
+scientific report, and group-meeting slides. The run ID is
+`20260718T041559Z-51996499`.
+
+This is a software-reproducibility case. It is not clinical validation and must
+not be used for diagnosis or patient decisions.
+
+## Case execution
+
+After requirement approval, this task used the `L` workflow and proceeded in
+order. VibeSkills shortlisted relevant capabilities from the configured local
+Skill folders, arranged the work into 9 modules and 10 work units, and the
+current Agent completed and recorded the plan.
+
+| Item | Result |
+|:---|:---|
+| Local Skill scope | More than 100 available Skills were counted in the configured folders during publication preparation |
+| Selected for this run | 7 Skills |
+| Work plan | 9 modules completed as 10 serial work units |
+| Execution | 10 completed, 0 failed, 0 blocked |
+| Module acceptance | 18 criteria passed |
+| Cross-artifact checks | 17 / 17 passed |
+| Final acceptance | `PASS`, with readiness `fully_ready` |
+
+The root README groups the 9 modules into 5 work groups for a quicker overview.
+The original plan and execution records retain every module and work unit.
+
+### How the Skills took part
+
+VibeSkills searched the configured local Skill folders, read the shortlisted
+candidates' `SKILL.md` files, and checked their purposes and limits. The case
+then used these 7 Skills.
+
+| Skill | Assigned work |
+|:---|:---|
+| `exploratory-data-analysis` | Materialize the public data and audit structure, quality, class balance, duplicates, and leakage risk |
+| `scikit-learn` | Build the frozen comparator and logistic-regression baseline, then verify exact replay |
+| `statistical-analysis` | Calculate variability and uncertainty intervals and state their assumptions |
+| `scientific-critical-thinking` | Review bias, leakage, generalization limits, and unsupported claims |
+| `scientific-visualization` | Produce 4 source-mapped PNG figures and matching SVG files |
+| `sciwrite` | Review the scientific report in 5 passes without changing the approved scientific content |
+| `presentations` | Build the 7-slide deck, render every slide, and inspect layout and data |
+
+The complete selection record is in
+[`selected-skills.json`](./evidence/selected-skills.json). The local Skill count
+comes from [`skill-inventory-snapshot.json`](./evidence/skill-inventory-snapshot.json),
+captured on the same host while preparing this public case. It is not a count
+emitted by the accepted runtime.
+
+### Execution and checks
+
+All 10 work units completed with no failure or blocked state. The case then ran
+17 consistency checks across module outputs, plan binding, data and model
+contracts, statistics, figures, the report, slides, and publication boundaries.
+All 17 passed.
+
+## Final delivery
+
+The final delivery contains 4 result figures, a scientific report, and a
+7-slide group-meeting deck. Every item comes from the same accepted execution
+record.
+
+| Data and model results | Delivery checks |
+|:---:|:---:|
+| ![Class balance](./assets/class-balance.png) | ![Confusion matrices](./assets/confusion-matrix.png) |
+| ![ROC and precision-recall curves](./assets/roc-and-pr-curves.png) | ![Cross-validation distributions](./assets/cv-performance-distribution.png) |
+
+All 4 figures also have [SVG versions](./assets/vector/). The final written
+report is [`scientific-report.md`](./outputs/scientific-report.md). The 7-slide
+group-meeting deck is available as a [`PPTX`](./outputs/group-meeting-slides.pptx),
+with the rendered montage below.
+
+![Rendered overview of the seven-slide deck](./assets/slides-montage.png)
+
+Final acceptance is `PASS` with readiness `fully_ready`. See the detailed result
+in [`delivery-acceptance-report.md`](./evidence/delivery-acceptance-report.md).
+
+## Execution records and reproduction materials
+
+These files preserve the path from the original request to final acceptance.
+Every number used on the root README can be traced to one of them.
+
+| Stage | Material |
+|:---|:---|
+| Original task | [`original-task.md`](./evidence/original-task.md) |
+| Confirmed requirement | [`requirement.md`](./evidence/requirement.md) |
+| Execution plan | [`execution-plan.md`](./evidence/execution-plan.md) · [`module-work-plan.json`](./evidence/module-work-plan.json) |
+| Skill selection | [`selected-skills.json`](./evidence/selected-skills.json) · [`skill-inventory-snapshot.json`](./evidence/skill-inventory-snapshot.json) |
+| Actual execution | [`module-execution.json`](./evidence/module-execution.json) |
+| Artifact consistency | [`consistency-
```

**File**: `docs/cases/ml-experiment/README.zh.md` (added, +111/-0)
```diff
@@ -0,0 +1,111 @@
+<div align="right">
+  <a href="./README.md">English</a> | <strong>中文</strong>
+</div>
+
+# 实际案例：完成一项机器学习实验
+
+这个目录保存了 VibeSkills 一次已经通过最终验收的公开案例。任务使用
+scikit-learn 自带的 Wisconsin Breast Cancer 数据集，完成数据审计、基线建模、
+统计复核、结果图、科学报告和组会 Slides。运行编号为
+`20260718T041559Z-51996499`。
+
+这是一个软件复现案例，不是临床验证，也不用于诊断或患者决策。
+
+## 案例执行过程
+
+需求确认后，这次任务按 `L` 级顺序推进。VibeSkills 从本地配置的 Skill 目录中
+筛选适合的能力，把工作安排成 9 个模块和 10 个工作单元，再由当前 Agent 按计划
+完成并记录结果。
+
+| 项目 | 结果 |
+|:---|:---|
+| 本地 Skill 范围 | 发布准备时，在本机已配置目录中统计到 100 多个可用 Skills |
+| 本次实际选择 | 7 个 Skills |
+| 任务安排 | 9 个模块，按 10 个工作单元顺序完成 |
+| 执行结果 | 10 个完成，0 个失败，0 个阻塞 |
+| 模块验收 | 18 项通过 |
+| 跨产物检查 | 17 / 17 通过 |
+| 最终验收 | `PASS`，状态为 `fully_ready` |
+
+首页把 9 个模块归成了 5 组，方便快速阅读；原始计划和执行记录仍保留完整的
+模块与工作单元。
+
+### Skills 怎样参与
+
+VibeSkills 先从已配置的本地 Skill 目录查找候选，再读取筛选后的候选 `SKILL.md`，
+核对用途和限制。这个案例最后使用了下面 7 个 Skills。
+
+| Skill | 负责的工作 |
+|:---|:---|
+| `exploratory-data-analysis` | 整理公开数据并检查结构、质量、类别分布、重复和泄漏风险 |
+| `scikit-learn` | 建立固定的对照模型与逻辑回归基线，并检查能否精确复跑 |
+| `statistical-analysis` | 计算变异性和不确定区间，并写清方法假设 |
+| `scientific-critical-thinking` | 复核偏倚、泄漏、泛化范围和不能下的结论 |
+| `scientific-visualization` | 生成 4 张可追溯到源数据的 PNG 图和对应 SVG |
+| `sciwrite` | 分 5 轮检查科学报告，不改动已经确认的科学内容 |
+| `presentations` | 制作 7 页 Slides，逐页渲染并检查版面和数据 |
+
+完整选择记录见 [`selected-skills.json`](./evidence/selected-skills.json)。本机 Skill
+数量来自同一台主机在案例发布准备阶段保存的
+[`skill-inventory-snapshot.json`](./evidence/skill-inventory-snapshot.json)，不是运行时
+自动写出的计数。
+
+### 执行与检查
+
+10 个工作单元全部完成，没有失败或阻塞。工作结束后，案例对模块输出、运行与计划
+绑定、数据和模型、统计结果、图表、报告、Slides 和公开边界做了 17 项一致性检查，
+17 项全部通过。
+
+## 最终交付结果
+
+最终交付包含 4 张结果图、科学报告和 7 页组会 Slides。所有材料都来自同一次已经
+通过验收的执行记录。
+
+| 数据与模型结果 | 交付检查 |
+|:---:|:---:|
+| ![类别分布图](./assets/class-balance.png) | ![混淆矩阵](./assets/confusion-matrix.png) |
+| ![ROC 和精确率召回率曲线](./assets/roc-and-pr-curves.png) | ![交叉验证结果分布](./assets/cv-performance-distribution.png) |
+
+4 张图同时提供了 [SVG 版本](./assets/vector/)。最终文字报告见
+[`scientific-report.md`](./outputs/scientific-report.md)。7 页组会 Slides 可以直接查看
+[`PPTX`](./outputs/group-meeting-slides.pptx)，下面是逐页渲染后的总览。
+
+![7 页组会 Slides 总览](./assets/slides-montage.png)
+
+最终验收结果为 `PASS`，状态为 `fully_ready`。详细检查结论见
+[`delivery-acceptance-report.md`](./evidence/delivery-acceptance-report.md)。
+
+## 执行记录与复现材料
+
+这些文件按任务从提出到验收的顺序保留，首页上的数字都可以在这里找到对应记录。
+
+| 阶段 | 材料 |
+|:---|:---|
+| 原始任务 | [`original-task.md`](./evidence/original-task.md) |
+| 需求确认 | [`requirement.md`](./evidence/requirement.md) |
+| 执行计划 | [`execution-plan.md`](./evidence/execution-plan.md) · [`module-work-plan.json`](./evidence/module-work-plan.json) |
+| Skill 选择 | [`selected-skills.json`](./evidence/selected-skills.json) · [`skill-inventory-snapshot.json`](./evidence/skill-inventory-snapshot.json) |
+| 实际执行 | [`module-execution.json`](./evidence/module-execution.json) |
+| 产物一致性 | [`consistency-check.json`](./evidence/consistency-check.json) |
+| 最终验收 | [`delivery-acceptance-report.md`](./evidence/delivery-acceptance-report.md) · [`JSON`](./evidence/delivery-acceptance-report.json) |
+| 公开副本说明 | [`PUBLICATION-NOTES.md`](./PUBLICATION-NOTES.md) |
+
+[`case-manifest.json`](./evidence/case-manifest.json) 和
+[`consistency-check.json`](./evidence/consistency-check.json) 是最终验收前生成的过程
+快照，因此其中保留了当时的待验收状态。最终状态以随后生成的
+`module-execution.json` 和 `delivery-acceptance-report.*` 为准。
+
+## 复现实验核心
+
+公开包保留了数据整理、基线实验、不确定性计算和制图脚本。先确认当前 `python`
+指向 Python 3.12.12，再在仓库根目录运行：
+
+```powershell
+python --version
+python -m venv .\docs\cases\ml-experiment\reproduce\.venv
+.\docs\cases\ml-experiment\reproduce\.venv\Scripts\python.exe -m pip install -r .\docs\cases\ml-experiment\reproduce\requirements.lock
+pwsh .\docs\cases\ml-experiment\reproduce\reproduce.ps1
+```
+
+脚本会把结果写到 `reproduce/generated/`，连续运行两次固定基线，并核对生成的
+`metrics.json` 是否与已验收结果完全一致。生成目录和虚拟环境不会提交到 Git。
```

**File**: `docs/cases/ml-experiment/assets/vector/class-balance.svg` (added, +1824/-0)
```diff
@@ -0,0 +1,1824 @@
+<?xml version="1.0" encoding="utf-8" standalone="no"?>
+<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"
+  "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
+<svg xmlns:xlink="http://www.w3.org/1999/xlink" width="450.256992pt" height="290.310433pt" viewBox="0 0 450.256992 290.310433" xmlns="http://www.w3.org/2000/svg" version="1.1">
+ <metadata>
+  <rdf:RDF xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
+   <cc:Work>
+    <dc:type rdf:resource="http://purl.org/dc/dcmitype/StillImage"/>
+    <dc:date>2026-07-18T12:36:18.264482</dc:date>
+    <dc:format>image/svg+xml</dc:format>
+    <dc:creator>
+     <cc:Agent>
+      <dc:title>Matplotlib v3.11.1, https://matplotlib.org/</dc:title>
+     </cc:Agent>
+    </dc:creator>
+   </cc:Work>
+  </rdf:RDF>
+ </metadata>
+ <defs>
+  <style type="text/css">*{stroke-linejoin: round; stroke-linecap: butt}</style>
+ </defs>
+ <g id="figure_1">
+  <g id="patch_1">
+   <path d="M 0 290.310433
+L 450.256992 290.310433
+L 450.256992 0
+L 0 0
+z
+" style="fill: #ffffff"/>
+  </g>
+  <g id="axes_1">
+   <g id="patch_2">
+    <path d="M 41.159492 242.48736
+L 444.496992 242.48736
+L 444.496992 20.496328
+L 41.159492 20.496328
+z
+" style="fill: #ffffff"/>
+   </g>
+   <g id="patch_3">
+    <path d="M 59.493015 242.48736
+L 199.823683 242.48736
+L 199.823683 60.527498
+L 59.493015 60.527498
+z
+" clip-path="url(#p9f26ce0d30)" style="fill: #999999; stroke: #222222; stroke-width: 0.8; stroke-linejoin: miter"/>
+   </g>
+   <g id="patch_4">
+    <path d="M 285.832802 242.48736
+L 426.163469 242.48736
+L 426.163469 134.432764
+L 285.832802 134.432764
+z
+" clip-path="url(#p9f26ce0d30)" style="fill: #d55e00; stroke: #222222; stroke-width: 0.8; stroke-linejoin: miter"/>
+   </g>
+   <g id="matplotlib.axis_1">
+    <g id="xtick_1">
+     <g id="line2d_1">
+      <defs>
+       <path id="m12e2f6b7bb" d="M 0 0
+L 0 3.5
+" style="stroke: #000000; stroke-width: 0.8"/>
+      </defs>
+      <g>
+       <use xlink:href="#m12e2f6b7bb" x="129.658349" y="242.48736" style="stroke: #000000; stroke-width: 0.8"/>
+      </g>
+     </g>
+     <g id="text_1">
+      <!-- Benign -->
+      <g transform="translate(115.647177 256.039606) scale(0.09 -0.09)">
+       <defs>
+        <path id="ArialMT-25" d="M 469 0
+L 469 4581
+L 2188 4581
+Q 2713 4581 3030 4442
+Q 3347 4303 3526 4014
+Q 3706 3725 3706 3409
+Q 3706 3116 3547 2856
+Q 3388 2597 3066 2438
+Q 3481 2316 3704 2022
+Q 3928 1728 3928 1328
+Q 3928 1006 3792 729
+Q 3656 453 3456 303
+Q 3256 153 2954 76
+Q 2653 0 2216 0
+L 469 0
+z
+M 1075 2656
+L 2066 2656
+Q 2469 2656 2644 2709
+Q 2875 2778 2992 2937
+Q 3109 3097 3109 3338
+Q 3109 3566 3000 3739
+Q 2891 3913 2687 3977
+Q 2484 4041 1991 4041
+L 1075 4041
+L 1075 2656
+z
+M 1075 541
+L 2216 541
+Q 2509 541 2628 563
+Q 2838 600 2978 687
+Q 3119 775 3209 942
+Q 3300 1109 3300 1328
+Q 3300 1584 3169 1773
+Q 3038 1963 2805 2039
+Q 2572 2116 2134 2116
+L 1075 2116
+L 1075 541
+z
+" transform="scale(0.015625)"/>
+        <path id="ArialMT-48" d="M 2694 1069
+L 3275 997
+Q 3138 488 2766 206
+Q 2394 -75 1816 -75
+Q 1088 -75 661 373
+Q 234 822 234 1631
+Q 234 2469 665 2931
+Q 1097 3394 1784 3394
+Q 2450 3394 2872 2941
+Q 3294 2488 3294 1666
+Q 3294 1616 3291 1516
+L 816 1516
+Q 847 969 1125 678
+Q 1403 388 1819 388
+Q 2128 388 2347 550
+Q 2566 713 2694 1069
+z
+M 847 1978
+L 2700 1978
+Q 2663 2397 2488 2606
+Q 2219 2931 1791 2931
+Q 1403 2931 1139 2672
+Q 875 2413 847 1978
+z
+" transform="scale(0.015625)"/>
+        <path id="ArialMT-51" d="M 422 0
+L 422 3319
+L 928 3319
+L 928 2847
+Q 1294 3394 1984 3394
+Q 2284 3394 2536 3286
+Q 2788 3178 2913 3003
+Q 3038 2828 3088 2588
+Q 3119 2431 3119 2041
+L 3119 0
+L 2556 0
+L 2556 2019
+Q 2556 2363 2490 2533
+Q 2425 2703 2258 2804
+Q 2091 2906 1866 2906
+Q 1506 2906 1245 2678
+Q 984 2450 984 1813
+L 984 0
+L 422 0
+z
+" transform="scale(0.015625)"/>
+        <path id="ArialMT-4c" d="M 425 3934
+L 425 4581
+L 988 4581
+L 988 3934
+L 425 3934
+z
+M 425 0
+L 425 3319
+L 988 3319
+L 988 0
+L 425 0
+z
+" transform="scale(0.015625)"/>
+        <path id="ArialMT-4a" d="M 319 -275
+L 866 -356
+Q 900 -609 1056 -725
+Q 1266 -881 1628 -881
+Q 2019 -881 2231 -725
+Q 2444 -569 2519 -288
+Q 2563 -116 2559 434
+Q 2191 0 1641 0
+Q 956 0 581 494
+Q 206 988 206 1678
+Q 206 2153 378 2554
+Q 550 2956 876 3175
+Q 1203 3394 1644 3394
+Q 2231 3394 2613 2919
+L 2613 3319
+L 3131 3319
+L 3131 450
+Q 3131 -325 2973 -648
+Q 2816 -972 2473 -1159
+Q 2131 -1347 1631 -1347
+Q 1038 -1347 672 -1080
+Q 306 -813 319 -275
+z
+M 784 1719
+Q 784 1066 1043 766
+Q 1303 466 1694 466
+Q 2081 466 2343 764
+Q 2606 1063 2606 1700
+Q 2606 2309 2336 2618
+Q 2066 2928 1684 2928
+Q 1309 2928 1046 2623
+Q 784 2319 784 1719
+z
+" transform="scale(0.015625)"/>
+       </defs>
+       <use xlink:href="#ArialMT-25"/>
+       <use xlink:href="#ArialMT-48" transform="translate(66.703125 0)"/>
+       <use
```

**File**: `docs/cases/ml-experiment/assets/vector/confusion-matrix.svg` (added, +2390/-0)
```diff
@@ -0,0 +1,2390 @@
+<?xml version="1.0" encoding="utf-8" standalone="no"?>
+<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN"
+  "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
+<svg xmlns:xlink="http://www.w3.org/1999/xlink" width="748.03721pt" height="331.576687pt" viewBox="0 0 748.03721 331.576687" xmlns="http://www.w3.org/2000/svg" version="1.1">
+ <metadata>
+  <rdf:RDF xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
+   <cc:Work>
+    <dc:type rdf:resource="http://purl.org/dc/dcmitype/StillImage"/>
+    <dc:date>2026-07-18T12:36:19.760748</dc:date>
+    <dc:format>image/svg+xml</dc:format>
+    <dc:creator>
+     <cc:Agent>
+      <dc:title>Matplotlib v3.11.1, https://matplotlib.org/</dc:title>
+     </cc:Agent>
+    </dc:creator>
+   </cc:Work>
+  </rdf:RDF>
+ </metadata>
+ <defs>
+  <style type="text/css">*{stroke-linejoin: round; stroke-linecap: butt}</style>
+ </defs>
+ <g id="figure_1">
+  <g id="patch_1">
+   <path d="M 0 331.576687
+L 748.03721 331.576687
+L 748.03721 0
+L 0 0
+z
+" style="fill: #ffffff"/>
+  </g>
+  <g id="axes_1">
+   <g id="patch_2">
+    <path d="M 65.165391 278.784
+L 275.981391 278.784
+L 275.981391 67.968
+L 65.165391 67.968
+z
+" style="fill: #ffffff"/>
+   </g>
+   <g clip-path="url(#pe10f2577e7)">
+    <image xlink:href="data:image/png;base64,
+iVBORw0KGgoAAAANSUhEUgAAA24AAANuCAYAAABuUVpnAAATi0lEQVR4nO3ZQQ2DABAAQdqSYKIqkFN7PLHSDxr6qAwwQcKGzCi43Oeyuce6/fcBAG5kej2vHgEATuWyAQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgbl+/v6hkA4FSf+W2jANyKjxsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOEGAAAQJ9wAAADihBsAAECccAMAAIgTbgAAAHHCDQAAIE64AQAAxAk3AACAOOE
```

---

### Incident Patch 10: `e774311e` (2026-07-17)
**Commit Message**: docs: restore LINUX DO community thanks

**File**: `README.md` (modified, +8/-0)
```diff
@@ -242,6 +242,14 @@ including Superpowers, Get Shit Done, OpenSpec, spec-kit, mem0, Scrapling, and
 Serena; attribution details live in [NOTICE](./NOTICE) and
 [third-party licenses](./THIRD_PARTY_LICENSES.md).
 
+VibeSkills discussions and community practice can also continue on
+[LINUX DO](https://linux.do/). It is a place to exchange technical questions,
+AI practice, and experience. Thank you to the LINUX DO community for supporting
+this project.
+
+The [VibeSkills 3.1.0 community practice cases](https://linux.do/t/topic/2061161)
+collect several examples that were shared with the community.
+
 Community contributors include
 [xiaozhongyaonvli](https://github.com/xiaozhongyaonvli) and
 [ruirui2345](https://github.com/ruirui2345).
```

**File**: `README.zh.md` (modified, +7/-0)
```diff
@@ -227,6 +227,13 @@ VibeSkills 会把安装情况、任务过程和最终检查分别保存下来。
 spec-kit、mem0、Scrapling、Serena 等开源项目的思路；归属说明见
 [NOTICE](./NOTICE) 与 [第三方许可证](./THIRD_PARTY_LICENSES.md)。
 
+VibeSkills 的使用讨论和社区实践也可以在 [LINUX DO](https://linux.do/) 继续交流。
+那里有技术讨论、AI 实践和使用经验分享。感谢 LINUX DO 社区一直以来对这个项目
+的支持。
+
+想看已经公开分享过的实践，可以从
+[VibeSkills 3.1.0 社区实践案例](https://linux.do/t/topic/2061161) 开始。
+
 社区贡献者包括
 [xiaozhongyaonvli](https://github.com/xiaozhongyaonvli) 和
 [ruirui2345](https://github.com/ruirui2345)。
```

---

### Incident Patch 11: `2a79590d` (2026-07-17)
**Commit Message**: docs: simplify readme support guidance

**File**: `README.md` (modified, +3/-33)
```diff
@@ -18,21 +18,19 @@ so more of the capability you already installed can contribute where it actually
   <img src="https://img.shields.io/github/v/release/foryourhealth111-pixel/Vibe-Skills?display_name=tag&sort=semver&style=for-the-badge&color=14515B" alt="Latest release">
 </a>
 
-<br><br>
+<br>
 
 <a href="./docs/install/README.en.md">
   <img src="./docs/assets/install-cta-en.svg" width="327" height="56" alt="Install VibeSkills">
 </a>
 
-<br><br>
+<br>
 
 <a href="./docs/quick-start.en.md">Quick start</a> ·
 <a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/tag/v4.0.0">v4.0.0 release</a> ·
 <a href="./docs/README.md">Documentation</a> ·
 <a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/stargazers">Star the project</a>
 
-<br><br>
-
 </div>
 
 ---
@@ -194,35 +192,6 @@ Install, update, check, uninstall, and migration commands are kept in one guide:
 Current asset:
 [vibe-skills-4.0.0-public.zip](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/download/v4.0.0/vibe-skills-4.0.0-public.zip)
 
-## Use it with different AI tools
-
-VibeSkills does not depend on the interface or command format of Codex, Claude
-Code, or Cursor. A tool needs a way to find local Skills, start `vibe`, wait for
-user confirmation, and save the run result.
-
-| What | Requirement |
-|:---|:---|
-| Local Skill | Any local Skill can participate when it is in a configured folder, has a readable and valid `SKILL.md`, has a unique name, and fits the work. |
-| AI tool | The tool needs to know where to find Skills, how to start `vibe`, when to wait for confirmation, and where to save the result. |
-| Current support | A tool may be able to connect before every workflow has been fully tested. The project reports the tested status of each tool separately. |
-
-<details>
-<summary><strong>Tools tested so far</strong></summary>
-
-The repository includes the files needed to use VibeSkills with Codex, Claude
-Code, Cursor, Windsurf, OpenClaw, and OpenCode. Codex and Claude Code have been
-tested through the main workflow with some conditions. The other tools are in
-an earlier stage. Tools outside this list have general integration guidance,
-but are not described as fully supported before they are tested.
-
-See the [support status](./docs/universalization/host-capability-matrix.md) for
-the current details.
-
-</details>
-
-The start command can differ by tool. Codex can use `$vibe`, while Claude Code
-can use `/vibe`. The project records how far each tool has been tested.
-
 ## What installation changes
 
 - You only need to remember one entry: `vibe`.
@@ -249,6 +218,7 @@ the [architecture guide](./docs/architecture/local-agent-kernel-v2.md).
 | Install, update, uninstall | [Simple install](./docs/install/README.en.md) |
 | First use | [Quick start](./docs/quick-start.en.md) |
 | Current release | [v4.0.0 notes](./docs/releases/v4.0.0.md) |
+| See which AI tools have been tested | [Support status](./docs/universalization/host-capability-matrix.md) |
 | How it works | [Documentation index](./docs/README.md) |
 | Troubleshooting | [Troubleshooting guide](./docs/troubleshooting.md) |
 | Contributing | [Contribution guide](./CONTRIBUTING.md) |
```

**File**: `README.zh.md` (modified, +3/-31)
```diff
@@ -18,21 +18,19 @@ VibeSkills 先把整个任务拆开，再逐模块组织相关的本地 Skills
   <img src="https://img.shields.io/github/v/release/foryourhealth111-pixel/Vibe-Skills?display_name=tag&sort=semver&style=for-the-badge&color=14515B" alt="最新版本">
 </a>
 
-<br><br>
+<br>
 
 <a href="./docs/install/README.md">
   <img src="./docs/assets/install-cta-cn.svg" width="327" height="56" alt="安装 VibeSkills">
 </a>
 
-<br><br>
+<br>
 
 <a href="./docs/quick-start.md">快速开始</a> ·
 <a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/tag/v4.0.0">v4.0.0 发布页</a> ·
 <a href="./docs/README.md">文档索引</a> ·
 <a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/stargazers">Star 项目</a>
 
-<br><br>
-
 </div>
 
 ---
@@ -184,33 +182,6 @@ VibeSkills 会把安装情况、任务过程和最终检查分别保存下来。
 当前版本下载：
 [vibe-skills-4.0.0-public.zip](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/download/v4.0.0/vibe-skills-4.0.0-public.zip)
 
-## 可以配合不同的 AI 工具使用
-
-VibeSkills 的主要工作方式不依赖 Codex、Claude Code 或 Cursor 的界面和命令
-格式。不同工具只需要提供查找本地 Skills、启动 `vibe`、等待用户确认和保存运行
-结果的方式。
-
-| 想接入的内容 | 需要满足什么 |
-|:---|:---|
-| 本地 Skill | 任意本地 Skill 只要放在指定文件夹里，有有效且可读取的 `SKILL.md`，名称不重复，并且适合当前工作，就可以参与。 |
-| AI 工具 | 需要知道去哪里找 Skills、怎样启动 `vibe`、什么时候等待确认，以及把运行结果存到哪里。 |
-| 实际支持情况 | 能接入，不等于已经在每种工具上完整测试过。项目会分别说明各个工具目前测试到了什么程度。 |
-
-<details>
-<summary><strong>目前在哪些工具上测试过</strong></summary>
-
-仓库里已经有 Codex、Claude Code、Cursor、Windsurf、OpenClaw 和 OpenCode
-使用 VibeSkills 所需的文件。Codex 和 Claude Code 已经跑过主要流程，但仍有一些
-使用条件；其他几个工具还在早期支持阶段。对于名单之外的工具，项目提供通用说明，
-但在实际测试之前不会写成“已经完整支持”。
-
-各工具目前支持到什么程度，见[支持情况说明](./docs/universalization/host-capability-matrix.md)。
-
-</details>
-
-不同工具的启动写法可能不一样。Codex 里可以是 `$vibe`，Claude Code 里可以是
-`/vibe`。项目会分别记录这些工具目前测试到了什么程度。
-
 ## 安装后会发生什么
 
 - 你只需要记住一个入口：`vibe`。
@@ -235,6 +206,7 @@ VibeSkills 的主要工作方式不依赖 Codex、Claude Code 或 Cursor 的界
 | 安装、更新、卸载 | [简明安装指南](./docs/install/README.md) |
 | 第一次使用 | [快速开始](./docs/quick-start.md) |
 | 当前发布版本 | [v4.0.0 发布说明](./docs/releases/v4.0.0.md) |
+| 查看哪些 AI 工具已经测试过 | [支持情况说明](./docs/universalization/host-capability-matrix.md) |
 | 了解它怎么工作 | [文档索引](./docs/README.md) |
 | 排查问题 | [故障排查](./docs/troubleshooting.md) |
 | 参与贡献 | [贡献指南](./CONTRIBUTING.md) |
```

**File**: `tests/runtime_neutral/test_documentation_surface_alignment.py` (modified, +9/-12)
```diff
@@ -40,8 +40,10 @@ def test_readmes_describe_only_public_vibe_entry_surface() -> None:
 def test_readme_heroes_keep_one_release_badge_and_consistent_install_buttons() -> None:
     for path in ("README.md", "README.zh.md"):
         content = _read(path)
+        hero = content[content.index('<div align="center">') : content.index("</div>", content.index('<div align="center">'))]
         assert content.count("img.shields.io") == 1
         assert "<kbd>" not in content
+        assert "<br><br>" not in hero
         assert "One_Entry" not in content
         assert "Skill_Model" not in content
         assert "Host_Neutral" not in content
@@ -281,21 +283,16 @@ def test_readmes_describe_local_installed_skill_story_without_repromoting_a_cent
     assert "本地 + starter Skills 仍然是默认产品面。" not in chinese
 
 
-def test_public_readmes_separate_open_integration_from_verified_tool_support() -> None:
+def test_root_readmes_route_tool_support_details_to_the_support_status_doc() -> None:
     english = _read("README.md")
     chinese = _read("README.zh.md")
 
-    assert "does not depend on the interface or command format" in english
-    assert "Any local Skill can participate" in english
-    assert "has a unique name" in english
-    assert "before every workflow has been fully tested" in english
-    assert "not described as fully supported before they are tested" in english
-
-    assert "主要工作方式不依赖 Codex、Claude Code 或 Cursor" in chinese
-    assert "任意本地 Skill" in chinese
-    assert "名称不重复" in chinese
-    assert "能接入，不等于已经在每种工具上完整测试过" in chinese
-    assert "在实际测试之前不会写成“已经完整支持”" in chinese
+    assert "Use it with different AI tools" not in english
+    assert "可以配合不同的 AI 工具使用" not in chinese
+    assert "| Current support |" not in english
+    assert "| 实际支持情况 |" not in chinese
+    assert "[Support status](./docs/universalization/host-capability-matrix.md)" in english
+    assert "[支持情况说明](./docs/universalization/host-capability-matrix.md)" in chinese
 
 
 def test_public_readmes_describe_the_supporting_task_features() -> None:
```

---

### Incident Patch 12: `8a40e42b` (2026-07-17)
**Commit Message**: docs: rebuild v4 product homepage

**File**: `README.md` (modified, +173/-618)
```diff
@@ -1,690 +1,245 @@
 <div align="right">
-  <b>🇬🇧 English</b> &nbsp;|&nbsp; <a href="./README.zh.md">🇨🇳 中文</a>
+  <strong>English</strong> | <a href="./README.zh.md">中文</a>
 </div>
 
-<br/>
+<p align="center">
+  <img src="./docs/assets/vibeskills-octopus-mark.svg" width="112" alt="VibeSkills mark">
+</p>
 
-<div align="center">
+# VibeSkills
 
-<a href="https://github.com/foryourhealth111-pixel/Vibe-Skills">
-  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=45&pause=1000&color=7B61FF&center=true&vCenter=true&width=700&height=100&lines=Vibe+Skills;Coordinate+Local+Skills;For+Composite+Tasks" alt="VibeSkills Typing Logo" />
-</a>
+**A governed workflow for complex AI work.**
 
-<br/>
+VibeSkills turns one difficult request into confirmed scope, bounded work,
+local-skill assistance, verification evidence, and context that can be resumed.
+You start with one public entry, `vibe`; the runtime provides the work rhythm
+around the AI agent instead of leaving every next step to the user.
 
-<img src="./logo.png" width="260px" alt="VibeSkills Logo"/>
+[Install](#install) · [Quick start](./docs/quick-start.en.md) ·
+[v4.0.0 release](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/tag/v4.0.0) ·
+[Documentation](./docs/README.md)
 
-<br/><br/>
+[![Release](https://img.shields.io/github/v/release/foryourhealth111-pixel/Vibe-Skills?display_name=tag&sort=semver)](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/latest)
+[![License](https://img.shields.io/github/license/foryourhealth111-pixel/Vibe-Skills)](./LICENSE)
+[![Stars](https://img.shields.io/github/stars/foryourhealth111-pixel/Vibe-Skills?style=flat)](https://github.com/foryourhealth111-pixel/Vibe-Skills/stargazers)
 
-### Coordinate local Skills for composite agent work
+## What It Changes
 
-VibeSkills is a workflow runtime for AI agents. It takes one request, splits it into bounded parts, and lets the right local Skills handle planning, implementation, testing, docs, research, or review inside the same run.
+Complex agent work usually breaks down in predictable places: the request is
+still vague when execution begins, the plan grows without clear ownership,
+specialist tools are chosen too early, or completion is claimed without proof.
+VibeSkills puts those decisions into one inspectable workflow.
 
-<div align="center">
-
-| Core function | Best at | Works with |
-|:---|:---|:---|
-| Organize multiple local Skills in one task | Composite work such as code changes plus tests plus docs plus review, or research plus writing plus delivery | Codex, Claude Code, Windsurf, Cursor, OpenCode, OpenClaw, and other Skills-compatible hosts |
-
-</div>
-
-Start with `vibe`. The runtime handles scoping, task breakdown, skill coordination, and verification so the agent can finish multi-step work with less manual steering.
-
-<details>
-<summary><b>Runtime notes for advanced readers</b></summary>
-
-Installed local skills are the only specialist reference surface in the public runtime story. Host-declared extra local roots extend that same local surface without a new central catalog. This is not a claim that the final architecture is complete.
-
-A skill counts as actually used only when the Agent returns its work in `module-execution.json` and canonical acceptance passes. `module_assignments` records the approved binding, not proof that the work ran.
-
-For this runtime boundary, Python owns canonical validation, task semantics, `module_assignments`, and the truth chain from `agent_skill_organization` through `module-work-plan.json`, `agent-execution-handoff.json`, and `module-execution.json`. PowerShell performs stage orchestration, environment setup, script bridging, host receipts, and shell-native checks. The current Agent performs the approved module work. Do not add new task semantics or task execution to PowerShell; existing PowerShell stage scripts are transitional orchestration surfaces. A future full-Python runtime is optional, not required for this version.
-
-</details>
-
-<br/>
-
-<a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/stargazers">
-  <img src="https://img.shields.io/github/stars/foryourhealth111-pixel/Vibe-Skills?style=for-the-badge&logo=github&color=7B61FF&label=STARS" alt="stars">
-</a>
-<a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/network/members">
-  <img src="https://img.shields.io/github/forks/foryourhealth111-pixel/Vibe-Skills?style=for-the-badge&logo=git&color=45a1ff&label=FORKS" alt="forks">
-</a>
-<a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/pulse">
-  <img src="https://img.shields.io/github/last-commit/foryourhealth111-pixel/Vibe-Skills?style=for-the-badge&logo=git-lfs&color=32CD32&label=MOMENTUM" alt="last commit">
-</a>
-<img src="https://komarev.com/ghpvc/?username=vibe-skills-foryourhealth&label=NODES+ACTIVE&color=0078d7&style=for-the-badge" alt="Visitors">
-&nbsp;
-<img src="https://img.shields.io/badge/Architecture-VCO_
```

**File**: `README.zh.md` (modified, +145/-605)
```diff
@@ -1,688 +1,228 @@
 <div align="right">
-  <a href="./README.md">🇬🇧 English</a> &nbsp;|&nbsp; <b>🇨🇳 中文</b>
+  <a href="./README.md">English</a> | <strong>中文</strong>
 </div>
 
-<br/>
+<p align="center">
+  <img src="./docs/assets/vibeskills-octopus-mark.svg" width="112" alt="VibeSkills 标志">
+</p>
 
-<div align="center">
+# VibeSkills
 
-<a href="https://github.com/foryourhealth111-pixel/Vibe-Skills">
-  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=45&pause=1000&color=7B61FF&center=true&vCenter=true&width=700&height=100&lines=Vibe+Skills;Coordinate+Local+Skills;For+Composite+Tasks" alt="VibeSkills Typing Logo" />
-</a>
+**面向复杂 AI 工作的受控工作流。**
 
-<br/>
+VibeSkills 把一个难以直接完成的请求，整理成可确认的范围、有边界的
+工作计划、按需使用的本地 Skills、可核对的交付证据，以及下次还能接上的
+上下文。用户只需要从公开入口 `vibe` 开始，不必自己反复充当调度员。
 
-<img src="./logo.png" width="260px" alt="VibeSkills Logo"/>
+[安装](#安装) · [快速开始](./docs/quick-start.md) ·
+[v4.0.0 发布页](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/tag/v4.0.0) ·
+[文档索引](./docs/README.md)
 
-<br/><br/>
+[![Release](https://img.shields.io/github/v/release/foryourhealth111-pixel/Vibe-Skills?display_name=tag&sort=semver)](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/latest)
+[![License](https://img.shields.io/github/license/foryourhealth111-pixel/Vibe-Skills)](./LICENSE)
+[![Stars](https://img.shields.io/github/stars/foryourhealth111-pixel/Vibe-Skills?style=flat)](https://github.com/foryourhealth111-pixel/Vibe-Skills/stargazers)
 
-### 组织本地 Skills 协作，处理复合任务
+## 它解决什么问题
 
-VibeSkills 是一个给 AI Agent 用的工作流运行时。它会把一条任务拆成多个有边界的部分，再让合适的本地 Skills 分别负责规划、实现、测试、文档、研究或评审。
+复杂任务出问题，通常不是因为模型一句话都不会写，而是因为执行开始得太早：
+需求还没确认，计划没有明确边界，Skills 选得过早，最后又缺少能支撑“完成”
+的证据。VibeSkills 把这些关键决定放进同一条可检查的工作流里。
 
-<div align="center">
-
-| 核心功能 | 最擅长 | 适配环境 |
-|:---|:---|:---|
-| 在同一次任务里组织多个本地 Skills 协作 | 代码改动加测试加文档加 review，或研究加写作加交付这类复合任务 | Codex、Claude Code、Windsurf、Cursor、OpenCode、OpenClaw，以及其他支持 Skills 的环境 |
-
-</div>
-
-从 `vibe` 开始。运行时会处理范围澄清、任务拆分、Skill 协作和验证，让 Agent 更适合完成多步骤工作。
-
-<details>
-<summary><b>给进阶用户的运行时说明</b></summary>
-
-在公开叙事里，已安装的本地 skill 根目录仍然是唯一专家来源。宿主声明的额外本地根目录，是沿着同一条本地扩展面继续扩展，不长出新的中心目录。这不是在宣称最终架构已经完成。
-
-一个 skill 只有在当前 Agent 把工作结果写入 `module-execution.json`，并通过 canonical 验收后，才会被算作实际使用。`module_assignments` 只记录批准后的绑定关系，不证明工作已经执行。
-
-在当前运行时边界里，Python 负责 canonical validation、任务语义、`module_assignments`，以及从 `agent_skill_organization` 到 `module-work-plan.json`、`agent-execution-handoff.json`、`module-execution.json` 的真相链。PowerShell 负责阶段编排、环境准备、脚本桥接、宿主收据和 shell 原生检查；批准后的模块工作由当前 Agent 真正完成。不要再把新的任务语义或任务执行加到 PowerShell；现有 PowerShell 阶段脚本只是迁移期编排面。
-
-</details>
-
-<br/>
-
-<a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/stargazers">
-  <img src="https://img.shields.io/github/stars/foryourhealth111-pixel/Vibe-Skills?style=for-the-badge&logo=github&color=7B61FF&label=STARS" alt="stars">
-</a>
-<a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/network/members">
-  <img src="https://img.shields.io/github/forks/foryourhealth111-pixel/Vibe-Skills?style=for-the-badge&logo=git&color=45a1ff&label=FORKS" alt="forks">
-</a>
-<a href="https://github.com/foryourhealth111-pixel/Vibe-Skills/pulse">
-  <img src="https://img.shields.io/github/last-commit/foryourhealth111-pixel/Vibe-Skills?style=for-the-badge&logo=git-lfs&color=32CD32&label=MOMENTUM" alt="last commit">
-</a>
-<img src="https://komarev.com/ghpvc/?username=vibe-skills-foryourhealth&label=NODES+ACTIVE&color=0078d7&style=for-the-badge" alt="Visitors">
-&nbsp;
-<img src="https://img.shields.io/badge/Architecture-VCO_Runtime-orange?style=for-the-badge" alt="Arch">
-&nbsp;
-<img src="https://img.shields.io/badge/Design-One_Public_Entry-blueviolet?style=for-the-badge" alt="One Public Entry">
-&nbsp;
-<img src="https://img.shields.io/badge/Harness-Bounded_Work_Loop-32CD32?style=for-the-badge" alt="Bounded Work Loop">
-&nbsp;
-<img src="https://img.shields.io/badge/Package-Vibe_Runtime_Entry-45a1ff?style=for-the-badge" alt="Vibe Runtime Entry">
-&nbsp;
-<img src="https://img.shields.io/badge/Extensible-User_Owned_Skills-ff5f87?style=for-the-badge" alt="User Owned Skills">
-
-<br/><br/>
-
-🧠 规划 · 🛠️ 工程 · 🤖 AI · 🔬 科研 · 🎨 创作
-
-<br/><br/>
-
-<a href="docs/install/README.md">
-  <img src="docs/assets/install-cta-cn.svg" width="214" height="56" alt="点击立即安装">
-</a>
-
-<br/><br/>
-
-<a href="docs/quick-start.md">
-  <img src="https://img.shields.io/badge/📖_快速上手-2d3748?style=for-the-badge" alt="文档">
-</a>
-&nbsp;
-<a href="./README.md">
-  <img src="https://img.shields.io/badge/🇬🇧_English-45a1ff?style=for-the-badge" alt="English">
-</a>
-
-<br/><br/>
-
-<kbd>安装</kbd> &nbsp;→&nbsp;
-<kbd>vibe | update</kbd> &nbsp;→&nbsp;
-<kbd>结构化流程</kbd> &nbsp;→&nbsp;
-<kbd>本地 Skill 绑定</kbd> &nbsp;→&nbsp;
-<kbd>TDD / 验证</kbd> &nbsp;→&nbsp;
-<kbd>持续上下文</kbd>
-
-</div>
-
-## 📋 目录
-
-- [运行时一眼看懂](#-运行时一眼看懂)
-- [实践演示](#-实践演示看得见的真实任务)
-- [一个公开面更小的运行时入口](#-一个公开面更小的运行时入口)
-- [为什么与众不同](#-为什么它与众不同)
-- [适合你吗](#-适用人群)
-- [工作组织](#-工作组织skills-如何变
```

**File**: `docs/assets/readme-poster-hero-cn.svg` (removed, +0/-83)
```diff
@@ -1,83 +0,0 @@
-<svg width="1600" height="620" viewBox="0 0 1600 620" fill="none" xmlns="http://www.w3.org/2000/svg">
-  <defs>
-    <linearGradient id="heroBg" x1="38" y1="24" x2="1495" y2="620" gradientUnits="userSpaceOnUse">
-      <stop stop-color="#F7F3EA"/>
-      <stop offset="0.56" stop-color="#E8F4F0"/>
-      <stop offset="1" stop-color="#D7EBEA"/>
-    </linearGradient>
-    <linearGradient id="inkBar" x1="1061" y1="83" x2="1450" y2="458" gradientUnits="userSpaceOnUse">
-      <stop stop-color="#14515B"/>
-      <stop offset="1" stop-color="#0A2F39"/>
-    </linearGradient>
-    <linearGradient id="panelFill" x1="102" y1="336" x2="645" y2="520" gradientUnits="userSpaceOnUse">
-      <stop stop-color="#FFFFFF" stop-opacity="0.88"/>
-      <stop offset="1" stop-color="#F1F7F5" stop-opacity="0.96"/>
-    </linearGradient>
-    <filter id="softShadow" x="68" y="38" width="1464" height="558" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
-      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#0A3942" flood-opacity="0.10"/>
-    </filter>
-  </defs>
-
-  <g filter="url(#softShadow)">
-    <rect x="52" y="42" width="1496" height="536" rx="36" fill="url(#heroBg)"/>
-  </g>
-
-  <rect x="1007" y="78" width="443" height="462" rx="34" fill="url(#inkBar)"/>
-  <path d="M1410 78H1450V540H1326C1372 478 1400 400 1400 314C1400 225 1369 145 1410 78Z" fill="#0E3E47" fill-opacity="0.65"/>
-
-  <g opacity="0.42">
-    <path d="M140 124H882" stroke="#1E7B7A" stroke-opacity="0.18" stroke-width="2"/>
-    <path d="M140 186H882" stroke="#1E7B7A" stroke-opacity="0.12" stroke-width="2"/>
-    <path d="M140 248H882" stroke="#1E7B7A" stroke-opacity="0.12" stroke-width="2"/>
-    <path d="M140 310H882" stroke="#1E7B7A" stroke-opacity="0.12" stroke-width="2"/>
-    <path d="M170 100V520" stroke="#1E7B7A" stroke-opacity="0.10" stroke-width="2"/>
-    <path d="M332 100V520" stroke="#1E7B7A" stroke-opacity="0.08" stroke-width="2"/>
-    <path d="M494 100V520" stroke="#1E7B7A" stroke-opacity="0.08" stroke-width="2"/>
-    <path d="M656 100V520" stroke="#1E7B7A" stroke-opacity="0.08" stroke-width="2"/>
-    <path d="M818 100V520" stroke="#1E7B7A" stroke-opacity="0.08" stroke-width="2"/>
-  </g>
-
-  <circle cx="897" cy="121" r="32" fill="#F47D6B" fill-opacity="0.18"/>
-  <circle cx="970" cy="182" r="12" fill="#14515B" fill-opacity="0.10"/>
-  <circle cx="1237" cy="129" r="18" fill="#D9F6F1" fill-opacity="0.28"/>
-
-  <text x="132" y="132" fill="#14515B" font-size="22" font-family="Segoe UI, PingFang SC, Noto Sans SC, sans-serif" letter-spacing="0.28em">AI AGENT SYSTEM / GOVERNED RUNTIME</text>
-  <text x="132" y="220" fill="#0F2F38" font-size="78" font-weight="700" font-family="Segoe UI, PingFang SC, Noto Sans SC, sans-serif">VibeSkills</text>
-  <text x="132" y="282" fill="#0F2F38" font-size="28" font-family="Segoe UI, PingFang SC, Noto Sans SC, sans-serif">不是另一个 skills 仓库，而是一套把调用、治理、验证与留痕压进同一平面的 AI system。</text>
-  <text x="132" y="332" fill="#33545A" font-size="24" font-family="Segoe UI, PingFang SC, Noto Sans SC, sans-serif">主视觉可爱，运行时严格。品牌识别交给小章鱼，执行秩序交给 VCO。</text>
-
-  <rect x="132" y="376" width="238" height="118" rx="24" fill="url(#panelFill)" stroke="#14515B" stroke-opacity="0.10"/>
-  <rect x="388" y="376" width="238" height="118" rx="24" fill="url(#panelFill)" stroke="#14515B" stroke-opacity="0.10"/>
-  <rect x="644" y="376" width="238" height="118" rx="24" fill="url(#panelFill)" stroke="#14515B" stroke-opacity="0.10"/>
-
-  <text x="160" y="425" fill="#14515B" font-size="19" font-family="Segoe UI, PingFang SC, Noto Sans SC, sans-serif">Bundled Skills</text>
-  <text x="160" y="470" fill="#0F2F38" font-size="46" font-weight="700" font-family="Segoe UI, PingFang SC, Noto Sans SC, sans-serif">340</text>
-  <text x="160" y="500" fill="#47666B" font-size="17" font-family="Segoe UI, PingFang SC, Noto Sans SC, sans-serif">规模感，不只是目录感</text>
-
-  <text x="416" y="425" fill="#14515B" font-size="19" font-family="Segoe UI, PingFang SC, Noto Sans SC, sans-serif">Upstream Sources</text>
-  <text x="416" y="470" fill="#0F2F38" font-size="46" font-weight="700" font-family="Segoe UI, PingFang SC, Noto Sans SC, sans-serif">19</text>
-  <text x="416" y="500" fill="#47666B" font-size="17" font-family="Segoe UI, PingFang SC, Noto Sans SC, sans-serif">整合，而不是简单堆叠</text>
-
-  <text x="672" y="425" fill="#14515B" font-size="19" font-family="Segoe UI, PingFang SC, Noto Sans SC, sans-serif">Policies / Contracts</text>
-  <text x="672" y="470" fill="#0F2F38" font-size="46" font-weight="700" font-family="Segoe UI, PingFang SC, Noto Sans SC, sans-serif">129</text>
-  <text x="672" y="500" fill="#47666B" font-size="17" font-family="Segoe UI, PingFang SC, Noto Sans SC, sans-serif">治理密度已经可见</text>
-
-  <path d="M1128 212C1128 156 1164 118 1210 118C1256 118 1292 156 1292 212C1292 248 1267 275 1210 275C1153 275 1128 248 1128 212Z" fill="#1F7D7C"/>
-  <path d="M1157 170C1168 149 1187 135 1210 135C1233 135 1252 149 1263 170
```

**File**: `docs/assets/readme-poster-hero-en.svg` (removed, +0/-83)
```diff
@@ -1,83 +0,0 @@
-<svg width="1600" height="620" viewBox="0 0 1600 620" fill="none" xmlns="http://www.w3.org/2000/svg">
-  <defs>
-    <linearGradient id="heroBg" x1="38" y1="24" x2="1495" y2="620" gradientUnits="userSpaceOnUse">
-      <stop stop-color="#F7F3EA"/>
-      <stop offset="0.56" stop-color="#E8F4F0"/>
-      <stop offset="1" stop-color="#D7EBEA"/>
-    </linearGradient>
-    <linearGradient id="inkBar" x1="1061" y1="83" x2="1450" y2="458" gradientUnits="userSpaceOnUse">
-      <stop stop-color="#14515B"/>
-      <stop offset="1" stop-color="#0A2F39"/>
-    </linearGradient>
-    <linearGradient id="panelFill" x1="102" y1="336" x2="645" y2="520" gradientUnits="userSpaceOnUse">
-      <stop stop-color="#FFFFFF" stop-opacity="0.88"/>
-      <stop offset="1" stop-color="#F1F7F5" stop-opacity="0.96"/>
-    </linearGradient>
-    <filter id="softShadow" x="68" y="38" width="1464" height="558" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
-      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#0A3942" flood-opacity="0.10"/>
-    </filter>
-  </defs>
-
-  <g filter="url(#softShadow)">
-    <rect x="52" y="42" width="1496" height="536" rx="36" fill="url(#heroBg)"/>
-  </g>
-
-  <rect x="1007" y="78" width="443" height="462" rx="34" fill="url(#inkBar)"/>
-  <path d="M1410 78H1450V540H1326C1372 478 1400 400 1400 314C1400 225 1369 145 1410 78Z" fill="#0E3E47" fill-opacity="0.65"/>
-
-  <g opacity="0.42">
-    <path d="M140 124H882" stroke="#1E7B7A" stroke-opacity="0.18" stroke-width="2"/>
-    <path d="M140 186H882" stroke="#1E7B7A" stroke-opacity="0.12" stroke-width="2"/>
-    <path d="M140 248H882" stroke="#1E7B7A" stroke-opacity="0.12" stroke-width="2"/>
-    <path d="M140 310H882" stroke="#1E7B7A" stroke-opacity="0.12" stroke-width="2"/>
-    <path d="M170 100V520" stroke="#1E7B7A" stroke-opacity="0.10" stroke-width="2"/>
-    <path d="M332 100V520" stroke="#1E7B7A" stroke-opacity="0.08" stroke-width="2"/>
-    <path d="M494 100V520" stroke="#1E7B7A" stroke-opacity="0.08" stroke-width="2"/>
-    <path d="M656 100V520" stroke="#1E7B7A" stroke-opacity="0.08" stroke-width="2"/>
-    <path d="M818 100V520" stroke="#1E7B7A" stroke-opacity="0.08" stroke-width="2"/>
-  </g>
-
-  <circle cx="897" cy="121" r="32" fill="#F47D6B" fill-opacity="0.18"/>
-  <circle cx="970" cy="182" r="12" fill="#14515B" fill-opacity="0.10"/>
-  <circle cx="1237" cy="129" r="18" fill="#D9F6F1" fill-opacity="0.28"/>
-
-  <text x="132" y="132" fill="#14515B" font-size="22" font-family="Segoe UI, Inter, Noto Sans, sans-serif" letter-spacing="0.28em">AI AGENT SYSTEM / GOVERNED RUNTIME</text>
-  <text x="132" y="220" fill="#0F2F38" font-size="78" font-weight="700" font-family="Segoe UI, Inter, Noto Sans, sans-serif">VibeSkills</text>
-  <text x="132" y="282" fill="#0F2F38" font-size="28" font-family="Segoe UI, Inter, Noto Sans, sans-serif">Not another skills repository. A governed AI system where calling, verification, and traceability stay on the same surface.</text>
-  <text x="132" y="332" fill="#33545A" font-size="24" font-family="Segoe UI, Inter, Noto Sans, sans-serif">The octopus carries the identity layer. VCO carries the execution order.</text>
-
-  <rect x="132" y="376" width="238" height="118" rx="24" fill="url(#panelFill)" stroke="#14515B" stroke-opacity="0.10"/>
-  <rect x="388" y="376" width="238" height="118" rx="24" fill="url(#panelFill)" stroke="#14515B" stroke-opacity="0.10"/>
-  <rect x="644" y="376" width="238" height="118" rx="24" fill="url(#panelFill)" stroke="#14515B" stroke-opacity="0.10"/>
-
-  <text x="160" y="425" fill="#14515B" font-size="19" font-family="Segoe UI, Inter, Noto Sans, sans-serif">Bundled Skills</text>
-  <text x="160" y="470" fill="#0F2F38" font-size="46" font-weight="700" font-family="Segoe UI, Inter, Noto Sans, sans-serif">340</text>
-  <text x="160" y="500" fill="#47666B" font-size="17" font-family="Segoe UI, Inter, Noto Sans, sans-serif">Scale with operational shape</text>
-
-  <text x="416" y="425" fill="#14515B" font-size="19" font-family="Segoe UI, Inter, Noto Sans, sans-serif">Upstream Sources</text>
-  <text x="416" y="470" fill="#0F2F38" font-size="46" font-weight="700" font-family="Segoe UI, Inter, Noto Sans, sans-serif">19</text>
-  <text x="416" y="500" fill="#47666B" font-size="17" font-family="Segoe UI, Inter, Noto Sans, sans-serif">Integrated, not merely stacked</text>
-
-  <text x="672" y="425" fill="#14515B" font-size="19" font-family="Segoe UI, Inter, Noto Sans, sans-serif">Policies / Contracts</text>
-  <text x="672" y="470" fill="#0F2F38" font-size="46" font-weight="700" font-family="Segoe UI, Inter, Noto Sans, sans-serif">129</text>
-  <text x="672" y="500" fill="#47666B" font-size="17" font-family="Segoe UI, Inter, Noto Sans, sans-serif">Governance density is visible</text>
-
-  <path d="M1128 212C1128 156 1164 118 1210 118C1256 118 1292 156 1292 212C1292 248 1267 275 1210 275C1153 275 1128 248 1128 212Z" fill="#1F7D7C"/>
-  <path d="M1157 170
```

**File**: `docs/brand/github-branding-copy.md` (modified, +41/-92)
```diff
@@ -1,128 +1,77 @@
 # GitHub Branding Copy
 
-This document collects settings-ready copy for the public GitHub surface of `Vibe-Skills`.
+Settings-ready language for the public GitHub surface of `Vibe-Skills`.
 
-## Recommended Direction
+## Positioning
 
-Use an ability-first positioning first.
+Lead with the workflow users receive, not with counts of Skills, policies, or
+upstream projects.
 
-Lead with what the repository already integrates: skills, MCP, agent workflows, and governed execution.
-After that, let the governance philosophy explain why the system is more stable than a loose skill collection.
+> VibeSkills turns complex AI requests into confirmed scope, bounded work,
+> local-skill assistance, verification evidence, and resumable context.
 
-## About
+The public product story is one governed runtime entry, `vibe`. Additional
+capability comes from installed local Skills with readable `SKILL.md` files;
+the v4 release does not publish a large built-in Skill catalog.
 
-GitHub's repository description is short. These versions are written to fit that constraint.
+## About
 
 ### Primary
 
-An integrated AI capability stack with 340 skills, MCP entry points, agent workflows, and governed execution for planning, coding, research, and automation.
-
-### Alternative A
-
-A governed AI capability stack that integrates 340 skills, MCP, and agent workflows into one runtime for engineering, research, and automation.
-
-### Alternative B
-
-Integrated skills, MCP, and agent workflows with governed execution for planning, coding, research, and long-running AI work.
-
-### Short Version
-
-340 skills, MCP, and agent workflows in one governed AI runtime.
-
-## Pinned Repo Blurb
+Governed workflow runtime for AI agents: scope complex requests, coordinate
+local Skills, verify delivery, and preserve resumable context.
 
-If you want a slightly longer one-liner for a pinned repository section, profile note, or showcase page, use one of these.
+### Short
 
-### Primary
-
-`VibeSkills` is an integrated AI capability stack that combines hundreds of skills, MCP entry points, and governed agent workflows into one runtime for planning, engineering, research, and automation.
+A governed workflow for complex AI work.
 
-### Alternative A
+### Alternative
 
-Not just a skills list: `VibeSkills` turns skills, MCP, plugins, and agent workflows into a governed execution system that is easier to activate, verify, and maintain.
+Turn complex AI requests into bounded work, verified delivery, and context
+that can be resumed.
 
-### Alternative B
+## Pinned Repository Blurb
 
-A capability-first AI runtime for people who want more than isolated prompts: integrated skills, MCP surfaces, agent workflows, and standardized execution.
+`VibeSkills` gives Skills-capable AI agents one governed path from request to
+delivery: confirm the scope, approve the plan, perform bounded work, verify the
+result, and preserve enough context to continue later.
 
 ## Topics
 
-GitHub topics work best when they are short, searchable, and familiar. The list below favors discoverability over novelty.
-
-### Recommended Set
-
 - `ai-agents`
 - `agentic-ai`
 - `ai-workflow`
 - `agent-orchestration`
-- `mcp`
-- `model-context-protocol`
 - `skills`
 - `developer-tools`
-- `automation`
-- `prompt-engineering`
+- `workflow-engine`
+- `reproducible-workflows`
 - `codex`
-- `ai-engineering`
-- `machine-learning`
-- `research-tools`
-- `bioinformatics`
-- `governed-runtime`
+- `claude-code`
+- `python`
+- `powershell`
 
-### Conservative Set
+## Social Preview
 
-Use this if you want fewer, broader topics.
+### Title
 
-- `ai-agents`
-- `agentic-ai`
-- `ai-workflow`
-- `mcp`
-- `model-context-protocol`
-- `skills`
-- `developer-tools`
-- `automation`
-- `codex`
-- `prompt-engineering`
-
-## Social Preview Copy
-
-GitHub social preview is primarily visual, but the text below is useful for any preview image, repo card, launch post, or banner that needs a short positioning line.
-
-### Primary Title
-
-340 Skills. One Governed Runtime.
-
-### Primary Subtitle
-
-Integrated skills, MCP, and agent workflows for planning, coding, research, and automation.
-
-### Alternative Title A
-
-An AI Capability Stack, Not Just a Skills List
+VibeSkills
 
-### Alternative Subtitle A
+### Subtitle
 
-Bringing hundreds of skills, MCP entry points, and governed execution into one runtime.
-
-### Alternative Title B
-
-Integrated Skills. MCP. Agent Workflows.
-
-### Alternative Subtitle B
-
-A capability-first runtime designed to make AI work easier to activate, verify, and maintain.
-
-## Social Banner Copy
-
-Use these when you need slightly longer launch or preview text.
-
-### Primary
+A governed workflow for complex AI work.
 
-`VibeSkills` integrates 340 skills, MCP entry points, and governed agent workflows into one runtime so AI work can move from request to delivery with more structure and less drift.
+### Supporting Line
 
-### Alternative A
+Scope the request. Bound 
```

**File**: `docs/install/README.en.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Simple Install
 
-The public install path starts from a published release, not a repository checkout. Download the current [vibe-skills-4.0.0-public.zip](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/download/v4.0.0/vibe-skills-4.0.0-public.zip), extract it outside the managed Skills directory, and run the wrappers from the extracted folder.
+The public install path starts from a published release zip, not a repository checkout. Download the current [vibe-skills-4.0.0-public.zip](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/download/v4.0.0/vibe-skills-4.0.0-public.zip), extract it outside the managed Skills directory, and run the wrappers from the extracted folder.
 
 The published ZIP SHA-256 is `0b16a5f615a485b8d082407d458cc5c4ffe2cee443c6211fc941cd6678987dc9`.
 
```

**File**: `docs/install/README.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # 简化安装
 
-公开安装应从已发布的 Release 开始，不要直接从仓库 checkout 安装。下载当前的 [vibe-skills-4.0.0-public.zip](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/download/v4.0.0/vibe-skills-4.0.0-public.zip)，解压到受管 Skills 目录之外，然后从解压目录运行脚本。
+公开安装应从发布版本 zip 开始，不要直接从仓库 checkout 安装。下载当前的 [vibe-skills-4.0.0-public.zip](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/download/v4.0.0/vibe-skills-4.0.0-public.zip)，解压到受管 Skills 目录之外，然后从解压目录运行脚本。
 
 已发布 ZIP 的 SHA-256 是 `0b16a5f615a485b8d082407d458cc5c4ffe2cee443c6211fc941cd6678987dc9`。
 
```

**File**: `docs/status/test-governance-classification-matrix.md` (modified, +1/-1)
```diff
@@ -129,7 +129,7 @@ The default regression set is capability-based, not directory-based. Keep the al
 | `tests/runtime_neutral/test_release_cut_operator.py` | `packaging_release` | `downgrade_audit` | `black_box` | governance or release signal gets noisy outside the default regression lane | Useful signal, but it belongs in an audit lane because it does not define the three-capability default regression set. | one focused release-manifest audit | scripts/common/vibe-governance-helpers.ps1<br>scripts/governance/release-cut.ps1<br>scripts/build/sync_dist_release_manifests.py |
 | `tests/runtime_neutral/test_release_notes_quality.py` | `packaging_release` | `downgrade_audit` | `static_contract` | governance or release signal gets noisy outside the default regression lane | Useful signal, but it belongs in an audit lane because it does not define the three-capability default regression set. | one focused release-manifest audit | - |
 | `tests/runtime_neutral/test_release_truth_gate.py` | `packaging_release` | `downgrade_audit` | `static_contract` | governance or release signal gets noisy outside the default regression lane | Useful signal, but it belongs in an audit lane because it does not define the three-capability default regression set. | one focused release-manifest audit | - |
-| `tests/runtime_neutral/test_release_v3_2_0_surface.py` | `packaging_release` | `downgrade_audit` | `static_contract` | governance or release signal gets noisy outside the default regression lane | Useful signal, but it belongs in an audit lane because it does not define the three-capability default regression set. | one focused release-manifest audit | config/version-governance.json<br>references/changelog.md<br>docs/releases/README.md |
+| `tests/runtime_neutral/test_release_v4_0_0_surface.py` | `packaging_release` | `downgrade_audit` | `static_contract` | governance or release signal gets noisy outside the default regression lane | Useful signal, but it belongs in an audit lane because it does not define the three-capability default regression set. | one focused release-manifest audit | config/version-governance.json<br>references/changelog.md<br>docs/releases/README.md |
 | `tests/runtime_neutral/test_repo_cleanliness_policy.py` | `docs_governance_audit` | `downgrade_audit` | `audit_only` | governance or release signal gets noisy outside the default regression lane | Useful signal, but it belongs in an audit lane because it does not define the three-capability default regression set. | manual or scheduled governance audit only | uninstall.ps1<br>uninstall.sh |
 | `tests/runtime_neutral/test_repo_config_contract.py` | `runtime_entry_truth` | `rewrite` | `static_contract` | entry truth drifts without a clean behavior smoke | Protects the canonical runtime truth seam, but mostly through structure or cutover assertions instead of the user-facing outcome. | rewrite as a canonical-entry or runtime-packet acceptance path | - |
 | `tests/runtime_neutral/test_root_child_hierarchy_bridge.py` | `runtime_entry_truth` | `keep_default` | `black_box` | canonical runtime receipts drift from the bounded session truth | Direct behavioral coverage of the current canonical runtime truth seam; worth keeping in the always-on lane. | `tests/runtime_neutral/test_agent_skill_organization_contract.py`, `tests/unit/test_canonical_vibe_entry_launcher.py`, and `tests/runtime_neutral/test_runtime_delivery_acceptance.py` | - |
```

---

### Incident Patch 13: `63739260` (2026-07-17)
**Commit Message**: Merge pull request #250 from ruirui2345/codex/v4-install-doc-polish

docs: clarify v4 install and update steps

**File**: `README.md` (modified, +12/-10)
```diff
@@ -499,31 +499,33 @@ The runtime core behind **VibeSkills** is **VCO**. It keeps workflow control in
 
 ## ⚙️ Installation & Skills Management
 
-Public installation starts from the [GitHub Releases page](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases). Download the release zip, extract it, and run the wrappers from that extracted directory.
+Public installation starts from a published release, not a repository checkout. Download the current [vibe-skills-4.0.0-public.zip](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/download/v4.0.0/vibe-skills-4.0.0-public.zip), extract it outside the managed Skills directory, and open a terminal in the extracted folder.
 
 The v4 public asset is the host-neutral, SkillsDir-centered bundle `vibe-skills-4.0.0-public.zip`. The installer writes Vibe-owned files under `<SkillsDir>/vibe`. The public release installs the `vibe` runtime itself. It does not add a separate built-in skill catalog. After install, the only public runtime entry is `vibe`, and additional Skills are discovered separately from that shared skills directory and any configured local skill roots.
 
-The default target is `~/.agents/skills`, so the shortest Windows install from a published release zip is:
+The default target is `~/.agents/skills`. Install and verify it with:
 
 ```powershell
-.\install.ps1
-.\check.ps1
+pwsh -NoProfile -File .\install.ps1 -SkillsDir "$HOME\.agents\skills"
+pwsh -NoProfile -File .\check.ps1 -SkillsDir "$HOME\.agents\skills"
 ```
 
-To install into a specific skills directory, pass it directly from the extracted release copy:
+For a Codex-only install, use Codex's Skills directory instead:
 
 ```powershell
-.\install.ps1 -SkillsDir C:\Users\you\.agents\skills
-.\check.ps1 -SkillsDir C:\Users\you\.agents\skills
+pwsh -NoProfile -File .\install.ps1 -SkillsDir "$HOME\.codex\skills"
+pwsh -NoProfile -File .\check.ps1 -SkillsDir "$HOME\.codex\skills"
 ```
 
-Update and uninstall use the same boundary. For updates, download the newer published release zip first, extract it, and then run `update` from that newer release copy against the same `SkillsDir`:
+To update, download and extract the newer release, then run `update` and `check` from that newer copy against the same `SkillsDir`:
 
 ```powershell
-.\update.ps1 -SkillsDir C:\Users\you\.agents\skills
-.\uninstall.ps1 -SkillsDir C:\Users\you\.agents\skills
+pwsh -NoProfile -File .\update.ps1 -SkillsDir "$HOME\.agents\skills"
+pwsh -NoProfile -File .\check.ps1 -SkillsDir "$HOME\.agents\skills"
 ```
 
+Uninstall is a separate operation: `pwsh -NoProfile -File .\uninstall.ps1 -SkillsDir "$HOME\.agents\skills"`.
+
 When upgrading from v3 to v4, keep the same `SkillsDir`, run the v4 `update` wrapper, then run `check`. Retired legacy entry names are not part of the v4 public runtime; use `vibe` for governed work.
 
 The installer writes only Vibe-owned files under `<SkillsDir>/vibe`. It does not edit Codex, Claude, Agents, host settings, command wrappers, or global prompt files. Re-running install or update preserves user-added files and refuses unowned path conflicts instead of deleting the directory.
```

**File**: `README.zh.md` (modified, +16/-7)
```diff
@@ -496,15 +496,15 @@ _这一节用来帮助你快速判断：`vibe` 适合组织哪些类型的任务
 
 ## ⚙️ 安装与 Skills 管理
 
-公开安装从 [GitHub Releases 页面](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases) 开始。下载公开 release 里的 zip，解压后再从这个目录运行安装脚本。
+公开安装应从已发布的 Release 开始，不要直接从仓库 checkout 安装。下载当前的 [vibe-skills-4.0.0-public.zip](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/download/v4.0.0/vibe-skills-4.0.0-public.zip)，解压到受管 Skills 目录之外，然后在解压目录中打开终端。
 
 默认目录是 `~/.agents/skills`。如果某个宿主或你自己的工作流需要别的 skills 目录，就显式传入那个路径。
 
 PowerShell：
 
 ```powershell
-.\install.ps1 -SkillsDir C:\Users\you\.agents\skills
-.\check.ps1 -SkillsDir C:\Users\you\.agents\skills
+pwsh -NoProfile -File .\install.ps1 -SkillsDir "$HOME\.agents\skills"
+pwsh -NoProfile -File .\check.ps1 -SkillsDir "$HOME\.agents\skills"
 ```
 
 Shell：
@@ -514,18 +514,27 @@ bash ./install.sh --skills-dir "$HOME/.agents/skills"
 bash ./check.sh --skills-dir "$HOME/.agents/skills"
 ```
 
-更新和卸载使用同一个边界：
+如果只给 Codex 安装，则显式使用 Codex 的 Skills 目录：
 
 ```powershell
-.\update.ps1 -SkillsDir C:\Users\you\.agents\skills
-.\uninstall.ps1 -SkillsDir C:\Users\you\.agents\skills
+pwsh -NoProfile -File .\install.ps1 -SkillsDir "$HOME\.codex\skills"
+pwsh -NoProfile -File .\check.ps1 -SkillsDir "$HOME\.codex\skills"
+```
+
+更新时，先下载并解压新版 Release，再从新的解压目录对原来的 `SkillsDir` 运行 `update` 和 `check`：
+
+```powershell
+pwsh -NoProfile -File .\update.ps1 -SkillsDir "$HOME\.agents\skills"
+pwsh -NoProfile -File .\check.ps1 -SkillsDir "$HOME\.agents\skills"
 ```
 
 ```bash
 bash ./update.sh --skills-dir "$HOME/.agents/skills"
-bash ./uninstall.sh --skills-dir "$HOME/.agents/skills"
+bash ./check.sh --skills-dir "$HOME/.agents/skills"
 ```
 
+卸载是单独操作：`pwsh -NoProfile -File .\uninstall.ps1 -SkillsDir "$HOME\.agents\skills"`。
+
 v4 公开发布物是 host-neutral、以 SkillsDir 为中心的 `vibe-skills-4.0.0-public.zip`。安装器只把 Vibe 自己拥有的文件写到 `<SkillsDir>/vibe`。公开发布包安装的是 `vibe` 运行时本体，不会额外安装一套内置 skill 目录。安装完成后，唯一公开运行时入口是 `vibe`；额外 Skills 则由共享 skills 目录和额外声明的本地根目录提供。
 
 安装器只写 `<SkillsDir>/vibe` 下属于 Vibe 的文件，收据在 `<SkillsDir>/vibe/.vibeskills/install-receipt.json`。它不会改 Codex、Claude、Agents 的设置，不会写入系统提示词，也不会生成多宿主 wrapper。重复安装或更新会保留用户自己加的文件；如果未来包内文件会覆盖一个不属于收据的路径，安装器会失败，而不是删除目录。
```

**File**: `docs/install/README.en.md` (modified, +35/-7)
```diff
@@ -1,14 +1,16 @@
 # Simple Install
 
-The public install path starts from the [GitHub Releases page](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases). The v4.0.0 asset is named `vibe-skills-4.0.0-public.zip`. Download and extract it, then run the wrappers from that release directory. The installer does one thing: it installs `vibe` into a skills directory.
+The public install path starts from a published release, not a repository checkout. Download the current [vibe-skills-4.0.0-public.zip](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/download/v4.0.0/vibe-skills-4.0.0-public.zip), extract it outside the managed Skills directory, and run the wrappers from the extracted folder.
+
+The published ZIP SHA-256 is `0b16a5f615a485b8d082407d458cc5c4ffe2cee443c6211fc941cd6678987dc9`.
 
 The default directory is `~/.agents/skills`. If a host or your own workflow needs a different skills directory, pass it explicitly, for example `~/.codex/skills` or `~/.claude/skills`.
 
+## Install
+
 ```powershell
 pwsh -NoProfile -File .\install.ps1 -SkillsDir "$HOME\.agents\skills"
 pwsh -NoProfile -File .\check.ps1 -SkillsDir "$HOME\.agents\skills"
-pwsh -NoProfile -File .\update.ps1 -SkillsDir "$HOME\.agents\skills"
-pwsh -NoProfile -File .\uninstall.ps1 -SkillsDir "$HOME\.agents\skills"
 ```
 
 For a Codex-only install, target the Codex skills directory explicitly:
@@ -21,16 +23,42 @@ pwsh -NoProfile -File .\check.ps1 -SkillsDir "$HOME\.codex\skills"
 ```bash
 bash ./install.sh --skills-dir "$HOME/.agents/skills"
 bash ./check.sh --skills-dir "$HOME/.agents/skills"
-bash ./update.sh --skills-dir "$HOME/.agents/skills"
-bash ./uninstall.sh --skills-dir "$HOME/.agents/skills"
 ```
 
 After installation, the managed directory is `<SkillsDir>/vibe`. The install receipt lives at `<SkillsDir>/vibe/.vibeskills/install-receipt.json`.
 
-`check` verifies the files recorded in the receipt. `update` refuses to overwrite user edits when drift is detected. `uninstall` removes only files recorded in the receipt and keeps user-added files.
+`check` verifies the files recorded in the receipt.
 `check` proves `installed locally`. It does not prove `runtime coherent` or `delivery accepted`.
 
-To update, download the newer published release zip first, extract it, run `update` from that newer release copy against the same `SkillsDir`, and then run `check`. Do not extract the new release inside the managed `<SkillsDir>/vibe` directory.
+## Update An Existing Install
+
+Download the newer published release ZIP first, extract it, and run these commands from that newer release copy against the same `SkillsDir`:
+
+```powershell
+pwsh -NoProfile -File .\update.ps1 -SkillsDir "$HOME\.agents\skills"
+pwsh -NoProfile -File .\check.ps1 -SkillsDir "$HOME\.agents\skills"
+```
+
+```bash
+bash ./update.sh --skills-dir "$HOME/.agents/skills"
+bash ./check.sh --skills-dir "$HOME/.agents/skills"
+```
+
+Do not extract the new release inside the managed `<SkillsDir>/vibe` directory. `update` refuses to overwrite receipt-owned files when drift is detected.
+
+## Uninstall
+
+Uninstall is not part of the install or update sequence. Run it only when you intend to remove VibeSkills:
+
+```powershell
+pwsh -NoProfile -File .\uninstall.ps1 -SkillsDir "$HOME\.agents\skills"
+```
+
+```bash
+bash ./uninstall.sh --skills-dir "$HOME/.agents/skills"
+```
+
+`uninstall` removes only files recorded in the receipt and keeps user-added files.
 
 ## Upgrading From v3 To v4
 
```

**File**: `docs/install/README.md` (modified, +35/-7)
```diff
@@ -1,14 +1,16 @@
 # 简化安装
 
-公开安装从 [GitHub Releases 页面](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases) 开始。v4.0.0 的发布文件名是 `vibe-skills-4.0.0-public.zip`。下载并解压后，在这个发布目录里运行脚本。安装器随后只做一件事：把 `vibe` 安装到一个 skills 目录下。
+公开安装应从已发布的 Release 开始，不要直接从仓库 checkout 安装。下载当前的 [vibe-skills-4.0.0-public.zip](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases/download/v4.0.0/vibe-skills-4.0.0-public.zip)，解压到受管 Skills 目录之外，然后从解压目录运行脚本。
+
+已发布 ZIP 的 SHA-256 是 `0b16a5f615a485b8d082407d458cc5c4ffe2cee443c6211fc941cd6678987dc9`。
 
 默认目录是 `~/.agents/skills`。如果某个宿主或你自己的工作流需要别的 skills 目录，也可以显式传入，例如 `~/.codex/skills` 或 `~/.claude/skills`。
 
+## 安装
+
 ```powershell
 pwsh -NoProfile -File .\install.ps1 -SkillsDir "$HOME\.agents\skills"
 pwsh -NoProfile -File .\check.ps1 -SkillsDir "$HOME\.agents\skills"
-pwsh -NoProfile -File .\update.ps1 -SkillsDir "$HOME\.agents\skills"
-pwsh -NoProfile -File .\uninstall.ps1 -SkillsDir "$HOME\.agents\skills"
 ```
 
 只在 Codex 中使用时，可以显式安装到 Codex 的 skills 目录：
@@ -21,16 +23,42 @@ pwsh -NoProfile -File .\check.ps1 -SkillsDir "$HOME\.codex\skills"
 ```bash
 bash ./install.sh --skills-dir "$HOME/.agents/skills"
 bash ./check.sh --skills-dir "$HOME/.agents/skills"
-bash ./update.sh --skills-dir "$HOME/.agents/skills"
-bash ./uninstall.sh --skills-dir "$HOME/.agents/skills"
 ```
 
 安装后，受管目录是 `<SkillsDir>/vibe`。安装收据位于 `<SkillsDir>/vibe/.vibeskills/install-receipt.json`。
 
-`check` 只检查收据登记的文件是否仍然完整。`update` 会在发现用户改动时拒绝覆盖。`uninstall` 只删除收据登记的文件，保留用户额外添加的文件。
+`check` 只检查收据登记的文件是否仍然完整。
 `check` 证明的是 `installed locally`。它不证明 `runtime coherent`，也不证明 `delivery accepted`。
 
-如果要更新，先下载更新版本的发布版本 zip，再解压，然后在新的发布目录里对同一个 `SkillsDir` 运行 `update`，最后运行 `check`。不要把新版本解压到受管目录 `<SkillsDir>/vibe` 里面。
+## 更新已安装版本
+
+先下载更新的已发布 ZIP，解压后，从新的发布目录对同一个 `SkillsDir` 运行：
+
+```powershell
+pwsh -NoProfile -File .\update.ps1 -SkillsDir "$HOME\.agents\skills"
+pwsh -NoProfile -File .\check.ps1 -SkillsDir "$HOME\.agents\skills"
+```
+
+```bash
+bash ./update.sh --skills-dir "$HOME/.agents/skills"
+bash ./check.sh --skills-dir "$HOME/.agents/skills"
+```
+
+不要把新版本解压到受管目录 `<SkillsDir>/vibe` 里面。`update` 发现收据登记文件被修改时会拒绝覆盖。
+
+## 卸载
+
+卸载不属于安装或更新步骤。只在你确实要移除 VibeSkills 时运行：
+
+```powershell
+pwsh -NoProfile -File .\uninstall.ps1 -SkillsDir "$HOME\.agents\skills"
+```
+
+```bash
+bash ./uninstall.sh --skills-dir "$HOME/.agents/skills"
+```
+
+`uninstall` 只删除收据登记的文件，保留用户额外添加的文件。
 
 ## 从 v3 升级到 v4
 
```

---

### Incident Patch 14: `c10463ac` (2026-07-17)
**Commit Message**: Merge pull request #249 from ruirui2345/codex/v4-release-doc-closure

docs: close v4 release publication gaps

**File**: `README.md` (modified, +1/-1)
```diff
@@ -524,7 +524,7 @@ Update and uninstall use the same boundary. For updates, download the newer publ
 .\uninstall.ps1 -SkillsDir C:\Users\you\.agents\skills
 ```
 
-When upgrading from v3 to v4, keep the same `SkillsDir`, run the v4 `update` wrapper, then run `check`. Legacy `vibe-what-do-i-want`, `vibe-how-do-we-do`, `vibe-do-it`, and `vibe-upgrade` entry names are retired; use `vibe` for the governed runtime.
+When upgrading from v3 to v4, keep the same `SkillsDir`, run the v4 `update` wrapper, then run `check`. Retired legacy entry names are not part of the v4 public runtime; use `vibe` for governed work.
 
 The installer writes only Vibe-owned files under `<SkillsDir>/vibe`. It does not edit Codex, Claude, Agents, host settings, command wrappers, or global prompt files. Re-running install or update preserves user-added files and refuses unowned path conflicts instead of deleting the directory.
 
```

**File**: `README.zh.md` (modified, +1/-1)
```diff
@@ -538,7 +538,7 @@ v4 公开发布物是 host-neutral、以 SkillsDir 为中心的 `vibe-skills-4.0
 - 卸载入口：`uninstall.ps1 -SkillsDir <skills-dir>`
 - 详细说明：[`docs/install/README.md`](docs/install/README.md)
 
-从 v3 升级到 v4 时，继续使用原来的 `SkillsDir`，运行 v4 发布包里的 `update`，再运行 `check`。旧的 `vibe-what-do-i-want`、`vibe-how-do-we-do`、`vibe-do-it` 和 `vibe-upgrade` 入口已经退役，统一使用 `vibe`。
+从 v3 升级到 v4 时，继续使用原来的 `SkillsDir`，运行 v4 发布包里的 `update`，再运行 `check`。已退役的旧入口不再属于 v4 的公开运行时，后续统一使用 `vibe`。
 
 ### 需要时再展开更多文档
 
```

**File**: `docs/install/README.en.md` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ To update, download the newer published release zip first, extract it, run `upda
 2. Download and extract `vibe-skills-4.0.0-public.zip`.
 3. Run the v4 `update` wrapper against the existing `SkillsDir`.
 4. Run `check` and confirm that receipt-owned missing and drifted file counts are both `0`.
-5. Use `vibe` for subsequent governed runs. The legacy `vibe-what-do-i-want`, `vibe-how-do-we-do`, `vibe-do-it`, and `vibe-upgrade` entry names are not part of the v4 public runtime.
+5. Use `vibe` for subsequent governed runs. Retired legacy entry names are not part of the v4 public runtime.
 
 v4 does not automatically install or recommend the `chrome`, `chrome-devtools`, `playwright`, `context7`, or `claude-flow` MCPs. The installer also does not modify their host configuration.
 
```

**File**: `docs/install/README.md` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ bash ./uninstall.sh --skills-dir "$HOME/.agents/skills"
 2. 下载并解压 `vibe-skills-4.0.0-public.zip`。
 3. 从 v4 解压目录对原来的 `SkillsDir` 运行 `update`。
 4. 运行 `check`，确认收据登记文件缺失为 `0`、漂移为 `0`。
-5. 后续统一调用 `vibe`。旧的 `vibe-what-do-i-want`、`vibe-how-do-we-do`、`vibe-do-it` 和 `vibe-upgrade` 入口不再属于 v4 公开运行时。
+5. 后续统一调用 `vibe`。已退役的旧入口不再属于 v4 公开运行时。
 
 v4 不会自动安装或推荐 `chrome`、`chrome-devtools`、`playwright`、`context7` 或 `claude-flow` MCP。安装器也不会替用户修改这些 MCP 的主机配置。
 
```

**File**: `docs/releases/v4.0.0.md` (modified, +3/-2)
```diff
@@ -2,6 +2,7 @@
 
 - Date: 2026-07-17
 - Commit(base): c1665ba7
+- Published tag: `v4.0.0` at `9cf0dcbf7c6e377806c00b2e0d2ffe75cb612d35`
 
 ## Highlights
 
@@ -18,7 +19,7 @@ v4 changes the public execution and migration boundary. It removes legacy entry
 
 ## Installation And Upgrade
 
-- Download `vibe-skills-4.0.0-public.zip` from the [GitHub Releases page](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases) after the release is published.
+- Download `vibe-skills-4.0.0-public.zip` from the [GitHub Releases page](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases).
 - For a shared user-level install, run `install` or `update` against `~/.agents/skills`.
 - For a Codex-only install, target `~/.codex/skills` explicitly.
 - Upgrade an existing v3 install by running the v4 `update` wrapper against the same `SkillsDir`, then run `check`.
@@ -41,4 +42,4 @@ v4 changes the public execution and migration boundary. It removes legacy entry
 - Do not expect Vibe to execute a hidden native specialist lane after planning. The Agent named in the handoff owns the module work and must return the declared module result.
 - Do not infer success from artifact presence alone. Required failed, blocked, or incomplete modules keep delivery acceptance closed.
 - Keep additional domain Skills in the shared skills directory or configured local skill roots; the public v4 package installs the runtime, not a separate bundled skill catalog.
-- The release note prepares the governed `v4.0.0` surface. The GitHub tag, release object, and downloadable asset are separate publication steps after PR merge.
+- The governed `v4.0.0` surface is published: the GitHub tag, release object, and downloadable asset all point to the release commit above.
```

---

### Incident Patch 15: `9cf0dcbf` (2026-07-17)
**Commit Message**: Merge pull request #248 from ruirui2345/codex/vibe-agent-execution-handoff-release-ruirui

release: prepare VibeSkills v4.0.0 and agent execution handoff

**File**: `CONTEXT.md` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+# Vibe-Skills Verification
+
+This context defines the testing and verification language for the Vibe-Skills repository. It exists so contributors can talk about proof, audits, and regression scope with the same meaning.
+
+## Language
+
+**Default Regression Set**:
+The small always-run verification set that protects the repository's real runtime abilities and public contracts.
+_Avoid_: Full sweep, everything gate, all checks
+
+**Optional Audit**:
+A non-default check that is only run when a change touches the surface that the audit exists to inspect.
+_Avoid_: Default regression, mandatory gate, always-on proof
+
+**Behavior Contract Test**:
+A test that proves externally visible behavior, artifact shape, or command contract rather than internal wording or implementation layout.
+_Avoid_: Wording test, implementation-style test, history-preservation test
+
+**Capability-Based Verification**:
+A way of organizing proof around the user-facing ability being protected, such as install, runtime entry, routing, or truth artifacts.
+_Avoid_: Directory-based verification, filename-based verification, suite-sprawl
+
+**Core Capability**:
+A user-visible ability that must keep working for the repository to remain trustworthy, such as install, runtime entry, routing, or truth-artifact generation.
+_Avoid_: Historical cleanup topic, wording concern, archive housekeeping
+
+**Touched-Surface Proof**:
+Verification that only becomes necessary when a change actually modifies the surface being protected, such as packaging, release, or mirror hygiene.
+_Avoid_: Always-on regression, default closure, universal gate
+
+**Delivery Hygiene**:
+Checks that keep a change clean to review and ship, such as patch formatting or repo cleanliness, without proving a product ability by themselves.
+_Avoid_: Core capability proof, runtime contract proof, behavior guarantee
+
+**Failure-First Test**:
+A test written from the expected user-visible failure or contract breakage, so it can fail for a meaningful reason before the implementation is corrected.
+_Avoid_: Snapshot of current wording, implementation freeze, repository grep
+
+**TDD Test Intent**:
+The discipline that a test should state the capability promise first, then drive the implementation toward satisfying that promise with the smallest necessary proof.
+_Avoid_: After-the-fact assertion pile, historical cleanup lock, style policing by test
```

**File**: `README.md` (modified, +15/-13)
```diff
@@ -35,9 +35,9 @@ Start with `vibe`. The runtime handles scoping, task breakdown, skill coordinati
 
 Installed local skills are the only specialist reference surface in the public runtime story. Host-declared extra local roots extend that same local surface without a new central catalog. This is not a claim that the final architecture is complete.
 
-A skill counts as actually used only when execution evidence supports it, and `work_binding` records what was actually bound in the run.
+A skill counts as actually used only when the Agent returns its work in `module-execution.json` and canonical acceptance passes. `module_assignments` records the approved binding, not proof that the work ran.
 
-For this runtime boundary, Python owns final truth artifacts, canonical validation, task semantics, `work_binding`, specialist decision truth, and structured runtime result data. PowerShell still performs stage orchestration, environment setup, script bridging, host receipts, shell-native checks, and leaf execution. Do not add new task semantics to PowerShell; existing PowerShell stage scripts are transitional orchestration surfaces. A future full-Python runtime is optional, not required for this version.
+For this runtime boundary, Python owns canonical validation, task semantics, `module_assignments`, and the truth chain from `agent_skill_organization` through `module-work-plan.json`, `agent-execution-handoff.json`, and `module-execution.json`. PowerShell performs stage orchestration, environment setup, script bridging, host receipts, and shell-native checks. The current Agent performs the approved module work. Do not add new task semantics or task execution to PowerShell; existing PowerShell stage scripts are transitional orchestration surfaces. A future full-Python runtime is optional, not required for this version.
 
 </details>
 
@@ -123,7 +123,7 @@ For this runtime boundary, Python owns final truth artifacts, canonical validati
 | **Local skill roots** | The runtime reads declared local skill roots as the only source for additional Skills. A skill must have a readable `SKILL.md` before it can be selected. |
 | **TDD / verified delivery** | Work should be backed by tests, checks, artifacts, or explicit manual-review notes before completion is claimed. |
 | **Workspace memory** | Structured project information, decisions, and evidence are stored so later sessions can continue without starting over. |
-| **Actual binding record** | The final record of what skill was actually bound lives in `work_binding`, not in a discovery cache or a broad product claim. |
+| **Actual binding record** | The final record of what skill was actually bound lives in `module_assignments`, not in a discovery cache or a broad product claim. |
 
 </details>
 
@@ -132,9 +132,9 @@ For this runtime boundary, Python owns final truth artifacts, canonical validati
 >
 > VibeSkills is built for agents that need more than a tool list.
 >
-> The runtime clarifies the request, plans the work, binds local Skills where they fit, records the actual binding in `work_binding`, and keeps the proof needed for review or continuation.
+> The runtime clarifies the request, plans the work, binds local Skills where they fit, records the actual binding in `module_assignments`, and keeps the proof needed for review or continuation.
 >
-> In the current release, the public entry stays narrow: `vibe` is the public entry, additional Skills are discovered only from declared local skill roots, duplicate skill ids follow host root priority, and `work_binding` is the runtime record of what was actually bound.
+> In the current release, the public entry stays narrow: `vibe` is the public entry, additional Skills are discovered only from declared local skill roots, duplicate skill ids follow host root priority, and `module_assignments` is the runtime record of what was actually bound.
 
 <br/>
 
@@ -185,7 +185,7 @@ flowchart LR
 | `one entry` | Start with `vibe`; use `update` to refresh the same installed skills directory. |
 | `late skill binding` | Skills are attached after the work shape is clear, not used as the control plane. |
 | `local skill roots` | The runtime checks declared local skill roots and only considers entries with a readable `SKILL.md`. Duplicate skill ids keep the highest-priority root active. |
-| `actual binding record` | The runtime truth for selected skill provenance lives in `work_binding`, even when discovery or benchmark artifacts are also written. |
+| `actual binding record` | The Agent freezes `agent_skill_organization`; `module_assignments` is its validated execution projection. Discovery and benchmark artifacts remain audit evidence only. |
 | `proof trail` | Tests, checks, artifacts, or manual-review state support delivery claims. |
 | `memory plane` | Requirements, plans, decisions, and evidence survive the chat window. |
 
@@ -351,7 +351,7 @@ The discovery rules stay narrow:
 
 - additional Skills are discovered only from declared loc
```

**File**: `README.zh.md` (modified, +14/-12)
```diff
@@ -35,9 +35,9 @@ VibeSkills 是一个给 AI Agent 用的工作流运行时。它会把一条任
 
 在公开叙事里，已安装的本地 skill 根目录仍然是唯一专家来源。宿主声明的额外本地根目录，是沿着同一条本地扩展面继续扩展，不长出新的中心目录。这不是在宣称最终架构已经完成。
 
-一个 skill 只有在真实执行证据支持时，才会被算作实际使用，`work_binding` 记录的是本次运行里真正绑定了什么。
+一个 skill 只有在当前 Agent 把工作结果写入 `module-execution.json`，并通过 canonical 验收后，才会被算作实际使用。`module_assignments` 只记录批准后的绑定关系，不证明工作已经执行。
 
-在当前运行时边界里，Python 负责最终 truth artifacts、canonical validation、任务语义、`work_binding`、专家决策真相和结构化运行结果。PowerShell 仍然承担阶段编排、环境准备、脚本桥接、宿主收据、shell 原生检查和叶子执行。不要把新的任务语义继续加到 PowerShell；现有 PowerShell 阶段脚本只是迁移期编排面。
+在当前运行时边界里，Python 负责 canonical validation、任务语义、`module_assignments`，以及从 `agent_skill_organization` 到 `module-work-plan.json`、`agent-execution-handoff.json`、`module-execution.json` 的真相链。PowerShell 负责阶段编排、环境准备、脚本桥接、宿主收据和 shell 原生检查；批准后的模块工作由当前 Agent 真正完成。不要再把新的任务语义或任务执行加到 PowerShell；现有 PowerShell 阶段脚本只是迁移期编排面。
 
 </details>
 
@@ -123,7 +123,7 @@ VibeSkills 是一个给 AI Agent 用的工作流运行时。它会把一条任
 | **本地 skill 根目录** | 运行时只从声明的本地 skill 根目录里发现额外 Skills；一个 skill 必须有可读取的 `SKILL.md`，才可能被选中。 |
 | **TDD / 验证交付** | 完成不能只靠模型一句“做好了”，而要有测试、检查、产物证据，或明确的人工复核状态。 |
 | **工作区记忆** | 结构化保存需求、计划、决策和证据，让后续会话不用从零开始。 |
-| **实际绑定记录** | 最终到底绑定了哪个 skill，要以 `work_binding` 为准。发现缓存或宽泛产品说法都不能替代这份记录。 |
+| **实际绑定记录** | 最终到底绑定了哪个 skill，要以 `module_assignments` 为准。发现缓存或宽泛产品说法都不能替代这份记录。 |
 
 </details>
 
@@ -134,7 +134,7 @@ VibeSkills 是一个给 AI Agent 用的工作流运行时。它会把一条任
 >
 > 运行时会先澄清请求、规划工作、在合适的位置绑定本地 Skills，并保留评审或继续工作需要的证据。
 >
-> 在当前版本里，公开入口保持收敛：`vibe` 是公开入口，额外 Skills 只会从声明的本地 skill 根目录里发现，重复 skill id 按根目录优先级处理，`work_binding` 记录本次运行实际绑定了什么。
+> 在当前版本里，公开入口保持收敛：`vibe` 是公开入口，额外 Skills 只会从声明的本地 skill 根目录里发现，重复 skill id 按根目录优先级处理，`module_assignments` 记录本次运行实际绑定了什么。
 
 <br/>
 
@@ -184,7 +184,7 @@ flowchart LR
 | `one entry` | 从 `vibe` 开始，用 `update` 刷新同一个已安装 skills 目录。 |
 | `late skill binding` | 先把工作边界说清楚，再在合适步骤绑定合适 Skills。 |
 | `local skill roots` | 运行时只从声明的本地 skill 根目录里发现额外 Skills；如果有重复项，按扫描顺序保留第一个可用入口。 |
-| `actual binding record` | 选中 skill 的来源和最终绑定结果，运行时以 `work_binding` 为准，即使同时也会写 discovery 或 benchmark 产物。 |
+| `actual binding record` | Agent 先冻结 `agent_skill_organization`，`module_assignments` 是它经过校验后的执行投影；discovery 和 benchmark 产物只保留审计价值。 |
 | `proof trail` | 测试、检查、产物证据或人工复核状态支撑交付声明。 |
 | `memory plane` | 需求、计划、决策和证据不会随着聊天窗口消失。 |
 
@@ -348,7 +348,7 @@ VibeSkills 适合希望 AI Agent 更容易上手、更泛用、更少手动控
 
 - 额外 Skills 只会从声明的本地 skill 根目录里发现
 - 一个 skill 必须有可读取的 `SKILL.md`，才可能被选中或锁定
-- 运行时第一真相面仍然是 `work_binding`，它记录了实际绑定了什么
+- 运行时第一真相面仍然是 `module_assignments`，它记录了实际绑定了什么
 
 <div align="center">
 
@@ -369,7 +369,7 @@ VibeSkills 适合希望 AI Agent 更容易上手、更泛用、更少手动控
 - **按工作单元绑定 Skills**：需求、规划、实现、测试、评审、清理，可以各自绑定不同 Skills。
 - **结果必须落到证据**：TDD、定向检查、产物审阅和交付验收共同约束完成声明。
 - **上下文要能延续**：运行时保存足够结构，方便下一个会话或下一个代理继续工作。
-- **实际绑定要可回看**：`work_binding` 会记录每个工作单元最终绑定了哪个 skill，以及可审计的来源信息。
+- **实际绑定要可回看**：`module_assignments` 会记录每个工作单元最终绑定了哪个 skill，以及可审计的来源信息。
 
 ---
 
@@ -408,10 +408,10 @@ VibeSkills 适合希望 AI Agent 更容易上手、更泛用、更少手动控
 - 公开可发现的工作入口只有 `vibe`。
 - `vibe` 是渐进式入口：先在 `requirement_doc` 停止，再在 `xl_plan` 停止，只有在每个边界都得到明确 re-entry 批准后才进入 `phase_cleanup`。
 - 已安装副本的升级保留在命令路径上：对同一个 `--skills-dir` 使用 `update`。
-- `vibe-what-do-i-want`、`vibe-how-do-we-do`、`vibe-do-it` 这类阶段 ID 已禁用为公开宿主入口。它们可以作为运行时连续性元数据保留，但安装器不应把它们物化成宿主可见的 command 或 skill wrapper。
+- 旧阶段别名不再作为公开入口，也不会被安装成宿主可见的 command 或 skill wrapper。
 - 公开允许的轻量级别覆盖只有 `--l` 和 `--xl`。像 `vibe-l`、`vibe-xl` 或阶段入口叠加级别的组合别名是故意不支持的。
 - 当内部调用 `tdd-guide`、`code-review` 这类专项技能时，它们只负责当前阶段或当前任务单元，不会接管全局协调。
-- 在 XL 多代理流程里，子代理可以提出候选 skill，但最终由协调者确认选中项。
+- 进入 `xl_plan` 前，Agent 会搜索声明的本地 skill 根目录、阅读候选 `SKILL.md`，并冻结 `agent_skill_organization`；XL 子代理只继承这份选择，不会重新选 skill。
 
 </details>
 
@@ -496,7 +496,7 @@ _这一节用来帮助你快速判断：`vibe` 适合组织哪些类型的任务
 
 ## ⚙️ 安装与 Skills 管理
 
-公开安装从发布版本 zip 开始。先下载公开 release 里的 zip，解压后再从这个目录运行安装脚本。
+公开安装从 [GitHub Releases 页面](https://github.com/foryourhealth111-pixel/Vibe-Skills/releases) 开始。下载公开 release 里的 zip，解压后再从这个目录运行安装脚本。
 
 默认目录是 `~/.agents/skills`。如果某个宿主或你自己的工作流需要别的 skills 目录，就显式传入那个路径。
 
@@ -526,7 +526,7 @@ bash ./update.sh --skills-dir "$HOME/.agents/skills"
 bash ./uninstall.sh --skills-dir "$HOME/.agents/skills"
 ```
 
-公开发布物是 host-neutral、以 SkillsDir 为中心的包，例如 `vibe-skills-3.2.0-public.zip`。安装器只把 Vibe 自己拥有的文件写到 `<SkillsDir>/vibe`。公开发布包安装的是 `vibe` 运行时本体，不会额外安装一套内置 skill 目录。安装完成后，公开入口是 `vibe`；额外 Skills 则由共享 skills 目录和额外声明的本地根目录提供。
+v4 公开发布物是 host-neutral、以 SkillsDir 为中心的 `vibe-skills-4.0.0-public.zip`。安装器只把 Vibe 自己拥有的文件写到 `<SkillsDir>/vibe`。公开发布包安装的是 `vibe` 运行时本体，不会额外安装一套内置 skill 目录。安装完成后，唯一公开运行时入口是 `vibe`；额外 Skills 则由共享 skills 目录和额外声明的本地根目录提供。
 
 安装器只写 `<SkillsDir>/vibe` 下属于 Vibe 的文件，收据在 `<SkillsDir>/vibe/.vibeskills/install-receipt.json`。它不会改 Codex、Claude、Agents 的设置，不会写入系统提示词，也不会生成多宿主 wrapper。重复安装或更新会保留用户自己加的文件；如果未来包内文件会覆盖一个不属于收据的路径，安装器会失败，而不是删除目录。
 
@@ -538,6 +538,8 @@ bash ./uninstall.sh --skills-dir "$HOME/.agents/skills"
 - 卸载入口：`uninstall.ps1 -SkillsDir <skills-dir>`
 - 详细说明：[`docs/install/README.md`](docs/install/README.md)
 
+从 v3 升级到 v4 时，继续使用原来的 `SkillsDir`，运行 v4 发布包里的 `update`，再运行 `check`。旧的 `vibe-w
```

**File**: `SKILL.md` (modified, +52/-52)
```diff
@@ -5,52 +5,46 @@ description: Vibe Code Orchestrator (VCO) is a governed runtime entry that freez
 
 # Vibe Governed Runtime Entry
 
-This file is the host-facing SOP for entering canonical `vibe`. Keep it small:
-runtime details belong in `protocols/runtime.md`, execution discipline belongs in `protocols/do.md`, and host wrapper recipes belong in installer-generated wrapper docs.
+This file is the host-facing SOP for entering canonical `vibe`. Keep it small: runtime details belong in `protocols/runtime.md`, execution discipline belongs in `protocols/do.md`, and host wrapper recipes belong in installer-generated wrapper docs.
 
 ## Trigger Contract
 
-Enter canonical `vibe` before ordinary execution when the user explicitly invokes
-`$vibe`, `/vibe`, or the `vibe` skill, or when the host intentionally chooses
-governed requirement/plan/execution closure for a complex task.
+Enter canonical `vibe` before ordinary execution when the user explicitly invokes `$vibe`, `/vibe`, or the `vibe` skill, or when the host intentionally chooses governed requirement/plan/execution closure for a complex task.
 
 Do not route every loosely related task into `vibe`. Lightweight questions,
 single-command checks, or tasks better served by another explicitly requested
 skill may proceed outside `vibe` unless the user explicitly invoked this entry.
 
 Installed-copy upgrades stay on the command path. Use the repo's `update`
 entry with `--skills-dir` for the same managed skills directory instead of
-introducing a second public runtime skill.
+starting a separate skill flow.
 
 User instructions remain highest priority. If CLAUDE.md, GEMINI.md, AGENTS.md,
 or the direct user request narrows or forbids a workflow such as TDD, follow the
 user's instruction while preserving canonical launch and proof rules.
 
 ## Canonical Bootstrap
 
-`vibe` is a host-syntax-neutral skill contract.
+`vibe` is a host-syntax-neutral skill contract. Before canonical launch, do only the minimum needed to launch:
 
-Before canonical launch, do only the minimum needed to launch:
-
-- Resolve `skill_root`, `workspace_root`, and `host_id`.
-- Extract core intent as keyword text. Do not pass the raw prompt, full chat history, or mixed-language filler to the router.
+- Resolve `skill_root` and `workspace_root`.
+- Pass the current user task verbatim as the task specification; unrelated chat history may be excluded. Do not summarize, rewrite, or reduce it to keywords. Preserve exact input paths, input immutability constraints, exact output roots, synthetic-data evidence boundaries, module dependencies and safe parallel boundaries, and acceptance criteria.
 
 Do not search the current workspace, repository, or install root for canonical proof files before launch.
 Do not inspect the repo, protocol docs, or prior run outputs before canonical launch returns.
 Do not simulate stages, claim canonical entry from reading this file or wrapper text, or treat wrapper or AGENTS text as proof.
 Do not manually create `outputs/runtime/vibe-sessions/<run-id>/`.
 Do not use the Vibe installation root as the governed artifact root.
 
-Local installed specialist recommender: semantic owner `packages/runtime-core/src/vgo_runtime/router_contract_runtime.py`; compatibility bridge `scripts/router/resolve-pack-route.ps1`
+Local skill candidate audit: semantic owner `packages/runtime-core/src/vgo_runtime/router_contract_runtime.py`; compatibility bridge `scripts/router/resolve-pack-route.ps1`
 
 Specialist recommender input rules:
 
-This recommender runs inside canonical `vibe`; it may suggest specialist skills, but it does not decide whether `$vibe` is the public runtime entry.
+This audit runs inside canonical `vibe`; it may expose candidates for inspection, but it does not choose task skills, bind execution, or control stage progression.
 
 - Include work type, domain/technology, deliverable, and explicit constraints.
 - Reuse verified frozen requirement/plan facts when continuing a run.
-- If the router returns `confirm_required`, surface the machine-readable route contract and convert the user's natural-language reply into a structured route decision.
-- If the router fails, report `blocked` with the concrete failure reason.
+- Treat its output as compatibility evidence only; never relabel a routed candidate as an Agent choice.
 
 Canonical entry command shape:
 
@@ -59,9 +53,7 @@ $env:PYTHONPATH = "<skill_root>/apps/vgo-cli/src"
 py -3 -m vgo_cli.main canonical-entry `
   --repo-root "<skill_root>" `
   --artifact-root "<workspace_root>" `
-  --host-id "<host_id>" `
-  --entry-id "vibe" `
-  --prompt "<extracted keyword intent text>"
+  --prompt "<current user task, verbatim>"
 ```
 
 For PowerShell, do not place `$env:PYTHONPATH=...` inside a double-quoted `-Command` string; host interpolation may corrupt it to `:PYTHONPATH`.
@@ -75,16 +67,18 @@ WORKSPACE_ROOT="${WORKSPACE_ROOT:-$PWD}"
 PYTHONPATH="$REPO_ROOT/apps/vgo-cli/src" python -m vgo_cli.main canonical-entry \
   
```

**File**: `adapters/opencode/host-profile.json` (modified, +0/-1)
```diff
@@ -7,7 +7,6 @@
     "config/opencode/commands/vibe.md",
     "config/opencode/agents/vibe-plan.md",
     "config/opencode/opencode.json.example",
-    "docs/install/opencode-path.en.md",
     "adapters/opencode/closure.json",
     "install.ps1",
     "check.ps1"
```

**File**: `apps/vgo-cli/pyproject.toml` (modified, +1/-1)
```diff
@@ -4,6 +4,6 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "vgo-cli"
-version = "3.2.0"
+version = "4.0.0"
 description = "Thin CLI launcher for Vibe-Skills clean architecture"
 requires-python = ">=3.10"
```

**File**: `apps/vgo-cli/src/vgo_cli/commands.py` (modified, +8/-4)
```diff
@@ -9,7 +9,6 @@
 
 from .core_bridge import run_canonical_entry_core, run_compatibility_exit_core, run_entry_locator_core, run_inspect_run_core, run_local_kernel_core, run_router_core, run_skill_index_core
 from .errors import CliError
-from .hosts import normalize_host_id
 from .output import print_json_payload
 from .process import print_process_output, run_powershell_file, run_subprocess
 from .repo import get_installed_runtime_config, get_local_release_metadata
@@ -277,19 +276,22 @@ def route_command(args: argparse.Namespace) -> int:
 
 def canonical_entry_command(args: argparse.Namespace) -> int:
     repo_root = Path(args.repo_root).resolve()
-    host_id = normalize_host_id(args.host_id)
     command = [
         '--repo-root', str(repo_root),
-        '--host-id', host_id,
-        '--entry-id', args.entry_id,
         '--prompt', args.prompt,
     ]
+    if getattr(args, 'host_id', None):
+        command.extend(['--host-id', args.host_id])
+    if getattr(args, 'entry_id', None):
+        command.extend(['--entry-id', args.entry_id])
     if args.requested_stage_stop:
         command.extend(['--requested-stage-stop', args.requested_stage_stop])
     if args.requested_grade_floor:
         command.extend(['--requested-grade-floor', args.requested_grade_floor])
     if args.run_id:
         command.extend(['--run-id', args.run_id])
+    if getattr(args, 'workspace_root', None):
+        command.extend(['--workspace-root', args.workspace_root])
     if args.artifact_root:
         command.extend(['--artifact-root', args.artifact_root])
     if getattr(args, 'local_agent_root', None):
@@ -298,6 +300,8 @@ def canonical_entry_command(args: argparse.Namespace) -> int:
         command.extend(['--continue-from-run-id', args.continue_from_run_id])
     if getattr(args, 'bounded_reentry_token', None):
         command.extend(['--bounded-reentry-token', args.bounded_reentry_token])
+    if getattr(args, 'module_execution_json_file', None):
+        command.extend(['--module-execution-json-file', args.module_execution_json_file])
     if getattr(args, 'host_decision_json', None):
         command.extend(['--host-decision-json', args.host_decision_json])
     if getattr(args, 'host_decision_json_file', None):
```

**File**: `apps/vgo-cli/src/vgo_cli/hosts.py` (modified, +42/-63)
```diff
@@ -16,9 +16,8 @@ def _resolve_workspace_repo_root() -> Path:
         current = current.parent
 
     while True:
-        installer_core_src = current / 'packages' / 'installer-core' / 'src'
         registry_exists = (current / 'adapters' / 'index.json').exists() or (current / 'config' / 'adapter-registry.json').exists()
-        if installer_core_src.is_dir() and registry_exists:
+        if registry_exists:
             return current
         if current.parent == current:
             break
@@ -28,43 +27,51 @@ def _resolve_workspace_repo_root() -> Path:
 
 
 @lru_cache(maxsize=1)
-def _installer_registry_module() -> tuple[Path, ModuleType]:
+def _contract_modules() -> tuple[Path, ModuleType, ModuleType]:
     repo_root = _resolve_workspace_repo_root()
     extend_workspace_package_path(repo_root)
-    from vgo_installer import adapter_registry as module
+    from vgo_contracts import adapter_registry_support as registry_module
+    from vgo_contracts import target_root_contract as target_root_module
 
-    return repo_root, module
+    return repo_root, registry_module, target_root_module
 
 
-def _raise_host_error(host_id: str | None, exc: SystemExit) -> None:
-    message = str(exc).strip()
-    if message.startswith('Unsupported VGO host id:'):
-        raise CliError(f'Unsupported host id: {host_id}') from None
-    raise CliError(message) from None
+def _load_registry() -> tuple[Path, dict[str, object], ModuleType, ModuleType]:
+    repo_root, registry_module, target_root_module = _contract_modules()
+    registry = dict(registry_module.load_adapter_registry(repo_root))
+    return repo_root, registry, registry_module, target_root_module
+
+
+def _default_host_id(registry: dict[str, object]) -> str:
+    return str(registry.get('default_adapter_id') or 'codex').strip().lower() or 'codex'
 
 
 def _resolve_host_entry(host_id: str | None) -> tuple[str, dict[str, object]]:
-    repo_root, module = _installer_registry_module()
+    _repo_root, registry, registry_module, _target_root_module = _load_registry()
     requested_host = str(host_id or os.environ.get('VCO_HOST_ID') or '').strip()
-    try:
-        entry = dict(module.resolve_adapter(repo_root, requested_host))
-    except SystemExit as exc:
-        _raise_host_error(host_id, exc)
-
-    normalized = str(entry.get('id') or '').strip().lower()
+    normalized = str(registry_module.normalize_adapter_host_id(requested_host, registry)).strip().lower()
     if not normalized:
-        raise CliError(f'Unsupported host id: {host_id}')
+        normalized = _default_host_id(registry)
+    try:
+        entry = dict(registry_module.resolve_adapter_entry(registry, normalized))
+    except ValueError:
+        normalized = _default_host_id(registry)
+        try:
+            entry = dict(registry_module.resolve_adapter_entry(registry, normalized))
+        except ValueError as exc:
+            raise CliError(f'Unable to resolve host registry entry for: {host_id}') from exc
     return normalized, entry
 
 
 def _target_root_spec(host_id: str | None) -> tuple[str, dict[str, str]]:
-    repo_root, module = _installer_registry_module()
-    requested_host = str(host_id or os.environ.get('VCO_HOST_ID') or '').strip()
-    try:
-        normalized, spec = module.resolve_target_root_spec(repo_root, requested_host)
-    except SystemExit as exc:
-        _raise_host_error(host_id, exc)
-    return str(normalized), dict(spec)
+    normalized, entry = _resolve_host_entry(host_id)
+    target = dict(entry.get('default_target_root') or {})
+    return normalized, {
+        'env': str(target.get('env') or '').strip(),
+        'rel': str(target.get('rel') or '').strip(),
+        'kind': str(target.get('kind') or '').strip(),
+        'install_mode': str(entry.get('install_mode') or '').strip(),
+    }
 
 
 def normalize_host_id(host_id: str | None) -> str:
@@ -73,18 +80,16 @@ def normalize_host_id(host_id: str | None) -> str:
 
 
 def resolve_default_target_root(host_id: str) -> Path:
-    repo_root, module = _installer_registry_module()
-    requested_host = str(host_id or os.environ.get('VCO_HOST_ID') or '').strip()
-    try:
-        target_root_text = module.resolve_default_target_root_text(
-            repo_root,
-            requested_host,
-            env=dict(os.environ),
-            home=str(Path.home()),
-        )
-        return Path(str(target_root_text)).expanduser()
-    except SystemExit as exc:
-        _raise_host_error(host_id, exc)
+    normalized, spec = _target_root_spec(host_id)
+    _repo_root, _registry, _registry_module, target_root_module = _load_registry()
+    target_root_text = target_root_module.resolve_target_root_text(
+        default_target_root=spec['rel'],
+        default_target_root_env=spec['env'],
+        env=dict(os.environ),
+        home=str(Path.home()),
+        descriptor_id=normalized,
+    )
+    return Path(str(target_root_text)).expanduser().resolve()
 
 
 def resolve_target_root(host_id: str, target_roo
```

#### Recent Merged Pull Requests:
- **PR #307** (2026-08-31): installer: recover partial uninstalls and type CLI exits (@foryourhealth111-pixel)
- **PR #303** (2026-08-29): Readme (@foryourhealth111-pixel)
- **PR #302** (2026-08-29): Readme fix (@foryourhealth111-pixel)
- **PR #301** (2026-08-29): feat(runtime): carry Skill guidance through planning and delivery (@foryourhealth111-pixel)
- **PR #287** (2026-08-11): governance: collapse the live documentation control plane (@foryourhealth111-pixel)
- **PR #286** (2026-08-11): contracts: make governance artifact resolution fail closed (@foryourhealth111-pixel)
- **PR #273** (2026-08-03): governance: switch live verification and proof contracts (@foryourhealth111-pixel)
- **PR #272** (2026-08-01): runtime: unify Python and PowerShell run artifacts (@foryourhealth111-pixel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
