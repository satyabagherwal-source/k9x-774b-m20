# Forensic Learning Record (Deep Inspection): ningzimu/image-to-editable-ppt-skill

> **Canonical Artifact**: `07_PROJECT_LEARNING/ningzimu-image-to-editable-ppt-skill-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ningzimu/image-to-editable-ppt-skill](https://github.com/ningzimu/image-to-editable-ppt-skill))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:17:27.366Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ningzimu/image-to-editable-ppt-skill`
- **Description**: Codex skill for converting slide images, PDFs, and image-based PPTX files into editable PowerPoint decks.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2748 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/__init__.py`
```
__version__ = "0.1.0"


```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/cli.py`
```
from __future__ import annotations

import os
import runpy
import sys
from pathlib import Path


def main() -> None:
    command_name = Path(sys.argv[0]).name or "editppt"
    if command_name in {"cli.py", "__main__.py"}:
        command_name = "editppt"
    runtime_dir = Path(__file__).resolve().parent / "runtime"
    script = runtime_dir / "main.py"
    if not script.exists():
        raise RuntimeError(f"runtime entrypoint not found: {script}")

    os.environ.setdefault("IMAGE_TO_EDITABLE_PPT_CLI_PROG", command_name)
    sys.path.insert(0, str(runtime_dir))
    sys.argv = [command_name, *sys.argv[1:]]
    runpy.run_path(str(script), run_name="__main__")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/__init__.py`
```
"""Deterministic runtime modules behind the public editppt CLI."""

```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/_input_normalization.py`
```
import hashlib
import io
import json
import posixpath
import shutil
import subprocess
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image


IMG_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".tif", ".tiff"}
PPT_EXTS = {".ppt", ".pptx"}
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": REL_NS,
}


def sha256_text(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def collect_paragraph_text(root):
    paragraphs = []
    for paragraph in root.findall(".//a:p", NS):
        text = "".join(node.text or "" for node in paragraph.findall(".//a:t", NS))
        if text:
            paragraphs.append(text)
    return "\n".join(paragraphs)


def copy_input(src, input_dir):
    src = Path(src).resolve()
    dest = input_dir / src.name
    counter = 2
    while dest.exists() and dest.resolve() != src:
        dest = input_dir / f"{src.stem}-{counter}{src.suffix}"
        counter += 1
    if src != dest:
        shutil.copy2(src, dest)
    return dest


def save_image_page(src, page_dir):
    page_dir.mkdir(parents=True, exist_ok=True)
    out = page_dir / "source.png"
    with Image.open(src) as image:
        image.convert("RGB").save(out)
    return out


def render_pdf_pages(pdf_path, pages_dir, dpi):
    import fitz

    doc = fitz.open(pdf_path)
    outputs = []
    matrix = fitz.Matrix(dpi / 72, dpi / 72)
    for index, page in enumerate(doc, start=1):
        page_dir = pages_dir / f"page_{index:03d}"
        page_dir.mkdir(parents=True, exist_ok=True)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        out = page_dir / "source.png"
        pix.save(out)
        outputs.append(out)
    return outputs


def rel_source_part(rels_name):
    directory = posixpath.dirname(rels_name)
    if directory.endswith("/_rels"):
        directory = posixpath.dirname(directory)
    source = posixpath.basename(rels_name)[:-5]
    return posixpath.normpath(posixpath.join(directory, source))


def resolve_target(rels_name, target):
    source = rel_source_part(rels_name)
    return posixpath.normpath(posixpath.join(posixpath.dirname(source), target))


def collect_notes_from_pptx(pptx_path, notes_dir=None):
    notes = []
    if notes_dir:
        notes_dir = Path(notes_dir)
    with zipfile.ZipFile(pptx_path) as z:
        names = set(z.namelist())
        if "ppt/presentation.xml" not in names or "ppt/_rels/presentation.xml.rels" not in names:
            return notes
        pres = ET.fromstring(z.read("ppt/presentation.xml"))
        pres_rels = ET.fromstring(z.read("ppt/_rels/presentation.xml.rels"))
        rels_by_id = {rel.attrib.get("Id"): rel.attrib.get("Target") for rel in pres_rels.findall("rel:Relationship", NS)}
        slide_parts = []
        for sld_id in pres.findall(".//p:sldId", NS):
            rel_id = sld_id.attrib.get(f"{{{NS['r']}}}id")
            target = rels_by_id.get(rel_id)
            if target:
                slide_parts.append(posixpath.normpath(posixpath.join("ppt", target)))
        for page_index, slide_part in enumerate(slide_parts, start=1):
            rels_name = f"{posixpath.dirname(slide_part)}/_rels/{posixpath.basename(slide_part)}.rels"
            note = {"page_index": page_index, "text": "", "text_sha256": sha256_text(""), "source_slide": slide_part}
            if rels_name in names:
                root = ET.fromstring(z.read(rels_name))
                for rel in root.findall("rel:Relationship", NS):
                    if rel.attrib.get("Type", "").endswith("/notesSlide"):
                        notes_part = resolve_target(rels_name, rel.attrib.get("Target", ""))
                        if notes_part in names:
                            notes_bytes = z.read(notes_part)
                            notes_root = ET.fromstring(notes_bytes)
                            text = collect_paragraph_text(notes_root)
                            update = {
                                "text": text,
                                "text_sha256": sha256_text(text),
                                "source_notes_part": notes_part,
                            }
                            if notes_dir:
                                out_dir = notes_dir / f"page_{page_index:03d}"
                                out_dir.mkdir(parents=True, exist_ok=True)
                                notes_xml = out_dir / "notesSlide.xml"
                                notes_xml.write_bytes(notes_bytes)
                                update["notes_xml"] = str(notes_xml)
                            note.update(update)
            if note["text"]:
                notes.append(note)
    return notes


def slide_parts_from_pptx(zip_file):
    names = set(zip_file.namelist())
    if "ppt/presentation.xml" not in names or "ppt/_rels/presentation.xml.rels" not in names:
        raise ValueError("PPTX is missing presentation relationships.")
    pres = ET.fromstring(zip_file.read("ppt/presentation.xml"))
    pres_rels = ET.fromstring(zip_file.read("ppt/_rels/presentation.xml.rels"))
    rels_by_id = {rel.attrib.get("Id"): rel.attrib.get("Target") for rel in pres_rels.findall("rel:Relationship", NS)}
    slide_parts = []
    for sld_id in pres.findall(".//p:sldId", NS):
        rel_id = sld_id.attrib.get(f"{{{NS['r']}}}id")
        target = rels_by_id.get(rel_id)
        if target:
            slide_parts.append(posixpath.normpath(posixpath.join("ppt", target)))
    if not slide_parts:
        raise ValueError("PPTX has no slides.")
    return slide_parts


def slide_size_from_pptx(zip_file):
    pres = ET.fromstring(zip_file.read("ppt/presentation.xml"))
    size = pres.find(".//p:sldSz", NS)
    if size is None:
        raise ValueError("PPTX is missing slide size.")
    return int(size.attrib["cx"]), int(size.attrib["cy"])


def slide_relationships(zip_file, slide_part):
    rels_name = f"{posixpath.dirname(slide_part)}/_rels/{posixpath.basename(slide_part)}.rels"
    if rels_name not in zip_file.namelist():
        return {}
    root = ET.fromstring(zip_file.read(rels_name))
    return {rel.attrib.get("Id"): rel for rel in root.findall("rel:Relationship", NS)}


def full_slide_picture_target(zip_file, slide_part, slide_cx, slide_cy):
    slide_root = ET.fromstring(zip_file.read(slide_part))
    if collect_paragraph_text(slide_root):
        raise ValueError(f"{slide_part} contains native text and is not an image-based slide.")
    pictures = slide_root.findall(".//p:pic", NS)
    if len(pictures) != 1:
        raise ValueError(f"{slide_part} must contain exactly one full-slide picture; found {len(pictures)}.")
    picture = pictures[0]
    blip = picture.find(".//a:blip", NS)
    if blip is None:
        raise ValueError(f"{slide_part} picture has no embedded image.")
    rel_id = blip.attrib.get(f"{{{NS['r']}}}embed")
    relationships = slide_relationships(zip_file, slide_part)
    rel = relationships.get(rel_id)
    if rel is None or not rel.attrib.get("Type", "").endswith("/image"):
        raise ValueError(f"{slide_part} picture relationship is not an embedded image.")

    off = picture.find(".//a:xfrm/a:off", NS)
    ext = picture.find(".//a:xfrm/a:ext", NS)
    if off is None or ext is None:
        raise ValueError(f"{slide_part} picture has no placement transform.")
    x, y = int(off.attrib.get("x", 0)), int(off.attrib.get("y", 0))
    cx, cy = int(ext.attrib.get("cx", 0)), int(ext.attrib.get("cy", 0))
    tolerance = 2
    if abs(x) > tolerance or abs(y) > tolerance or abs(cx - slide_cx) > tolerance or abs(cy - slide_cy) > tolerance:
        raise ValueError(f"{slide_part} picture is not full-slide.")

    return resolve_target(f"{posixpath.dirname(
```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/_page_artifacts.py`
```
import json
import shutil
import subprocess
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent


def run(command):
    print("+ " + " ".join(str(part) for part in command), flush=True)
    subprocess.run([str(part) for part in command], check=True)


def resolve_under_page(page_dir, value):
    path = Path(value).expanduser()
    if path.is_absolute():
        return path
    return page_dir / path


def imagegen_chroma_helper():
    helper = SCRIPT_DIR / "remove_chroma_key.py"
    if not helper.exists():
        raise SystemExit(f"Missing chroma helper: {helper}")
    return helper


def process_asset_sheet(args, page_dir):
    chroma = resolve_under_page(page_dir, args.chroma)
    alpha = resolve_under_page(page_dir, args.alpha)
    if not args.asset_sheet_source and not chroma.exists() and not alpha.exists():
        return

    from PIL import Image

    source = resolve_under_page(page_dir, args.asset_sheet_source) if args.asset_sheet_source else (
        alpha if args.skip_chroma else chroma
    )
    if not source.exists():
        raise SystemExit(f"Asset sheet source does not exist: {source}")
    with Image.open(source) as image:
        extrema = image.convert("RGBA").getchannel("A").getextrema()
    has_alpha = extrema[0] == 0 and extrema[1] > 0
    if extrema[1] == 0:
        raise SystemExit("Asset sheet is fully transparent and contains no foreground")
    if args.skip_chroma and not has_alpha:
        raise SystemExit("--skip-chroma requires real transparent background and nonempty foreground")

    same_alpha = source.resolve() == alpha.resolve()
    if alpha.exists() and not args.force_chroma and not (same_alpha and args.skip_chroma):
        raise SystemExit(f"Output already exists: {alpha} (use --force-chroma to overwrite)")

    if has_alpha:
        alpha.parent.mkdir(parents=True, exist_ok=True)
        if not same_alpha:
            shutil.copy2(source, alpha)
        print(f"Using original alpha: {alpha}")
    else:
        if source.resolve() != chroma.resolve():
            chroma.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, chroma)
        command = [
            sys.executable, imagegen_chroma_helper(), "--input", chroma,
            "--out", alpha, "--auto-key", "border", "--soft-matte",
            "--transparent-threshold", args.transparent_threshold,
            "--opaque-threshold", args.opaque_threshold,
        ]
        if args.despill:
            command.append("--despill")
        if args.force_chroma:
            command.append("--force")
        run(command)

    if args.skip_split:
        return
    if not alpha.exists():
        raise SystemExit(f"Alpha sheet does not exist: {alpha}")

    command = [
        sys.executable,
        SCRIPT_DIR / "split_alpha_components.py",
        "--input",
        alpha,
        "--out-dir",
        resolve_under_page(page_dir, args.assets_dir),
        "--sort",
        args.split_sort,
        "--min-area",
        args.split_min_area,
        "--merge-gap",
        args.split_merge_gap,
        "--merge-union-growth",
        args.split_merge_union_growth,
        "--manifest",
        resolve_under_page(page_dir, args.split_manifest),
    ]
    if getattr(args, "regions", None):
        command.extend(["--regions", resolve_under_page(page_dir, args.regions)])
    if args.square_assets:
        command.append("--square")
    if args.asset_names:
        command.extend(["--names", args.asset_names])
    run(command)


def fit_image(image, size):
    if image.size == size:
        return image
    return image.resize(size)


def write_pair(source_path, preview_path, out_path):
    from PIL import Image, ImageDraw

    source = Image.open(source_path).convert("RGB")
    rebuilt = Image.open(preview_path).convert("RGB")
    source = fit_image(source, rebuilt.size)

    label_h = 32
    gap = 18
    width, height = rebuilt.size
    canvas = Image.new("RGB", (width * 2 + gap, height + label_h), "#f5f7fb")
    canvas.paste(source, (0, label_h))
    canvas.paste(rebuilt, (width + gap, label_h))
    draw = ImageDraw.Draw(canvas)
    draw.text((10, 9), "origin", fill="black")
    draw.text((width + gap + 10, 9), "preview", fill="black")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out_path)
    print(f"Wrote {out_path}")

```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/configure_image_backend.py`
```
#!/usr/bin/env python3
import argparse
import json

from deck_run_state import load_deck, load_jobs, read_json, run_dir_from_target, save_deck, write_json


def backend_contract(args):
    is_builtin = args.backend_id == "builtin-imagegen"
    requires_api_key = args.backend_id == "openai-compatible-api"
    contract = {
        "backend_id": args.backend_id,
        "tool_name": args.tool_name,
        "tool_call": args.tool_call,
        "fallback_command": args.fallback_command,
        "runtime_home": args.runtime_home,
        "model": None if is_builtin else args.model,
        "requires_openai_api_key": requires_api_key,
        "mode_policy": "generate-or-edit-per-asset",
        "chroma_key_helper": "editppt image process-sheet",
        "input_context_policy": args.input_context_policy,
        "save_path_policy": (
            "accept only an explicit output_hint or local path returned by image_gen.imagegen, verify it exists, "
            "import the selected output, and never scan for the newest file"
            if is_builtin
            else "write outputs directly to page dir or copy selected outputs before manifest references them"
        ),
        "handoff_rule": (
            "call image_gen.imagegen serially, then import the selected local output; "
            "use editppt image generate/edit only when the built-in tool fallback policy applies"
            if is_builtin
            else "call editppt image generate/edit serially; the CLI selects Codex OAuth first and OpenAI-compatible API fallback second"
        ),
    }
    if is_builtin:
        contract.update(
            {
                "fallback_order": ["codex-oauth", "openai-compatible-api"],
                "required_parameters": {
                    "generate": ["prompt"],
                    "edit": ["prompt", "referenced_image_paths"],
                },
                "fallback_policy": {
                    "on": [
                        "tool-unavailable",
                        "tool-error",
                        "input-unreadable",
                        "no-valid-local-output",
                    ],
                    "missing_optional_parameters": False,
                },
            }
        )
    return contract


def main():
    parser = argparse.ArgumentParser(description="Record the run-level image backend contract.")
    parser.add_argument("run")
    parser.add_argument(
        "--backend-id",
        default="editppt-image-cli",
        choices=["builtin-imagegen", "editppt-image-cli", "openai-compatible-api"],
    )
    parser.add_argument("--tool-name")
    parser.add_argument("--tool-call")
    parser.add_argument("--model", default="gpt-image-2")
    parser.add_argument("--fallback-command")
    parser.add_argument("--runtime-home", default="~/.editppt")
    parser.add_argument("--input-context-policy")
    args = parser.parse_args()

    if args.backend_id == "builtin-imagegen":
        fixed_field_overrides = [
            flag
            for flag, value in (
                ("--tool-name", args.tool_name),
                ("--tool-call", args.tool_call),
                ("--fallback-command", args.fallback_command),
                ("--input-context-policy", args.input_context_policy),
            )
            if value is not None
        ]
        if fixed_field_overrides:
            parser.error(
                f"{', '.join(fixed_field_overrides)} cannot override the fixed builtin-imagegen contract"
            )
        args.tool_name = "image_gen.imagegen"
        args.tool_call = "image_gen.imagegen"
        args.fallback_command = "editppt image generate/edit"
        args.input_context_policy = (
            "generation needs prompt; for editing inspect every local input with view_image first, then pass "
            "prompt plus absolute local paths in referenced_image_paths"
        )
    else:
        if args.tool_name is None:
            args.tool_name = "editppt image"
        if args.tool_call is None:
            args.tool_call = "editppt image generate/edit"
        if args.fallback_command is None:
            args.fallback_command = "editppt image"
        if args.input_context_policy is None:
            args.input_context_policy = "pass edit targets and strict visual references via editppt image edit --image"

    run_dir = run_dir_from_target(args.run)
    deck = load_deck(run_dir)
    contract = backend_contract(args)
    deck["image_backend"] = contract
    save_deck(run_dir, deck)

    jobs = load_jobs(run_dir)
    for page in jobs.get("pages", []):
        request_path = run_dir / page["page_request"]
        request = read_json(request_path)
        request["image_backend"] = contract
        write_json(request_path, request)
    print(json.dumps({"image_backend": contract}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/deck_run_state.py`
```
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


ACTIVE_PAGE_STATUSES = {"dispatched"}
DISPATCHABLE_PAGE_STATUSES = {"pending"}
DEFAULT_MAX_CONCURRENT_PAGES = 6


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def read_json(path, default=None):
    path = Path(path)
    if not path.exists():
        if default is not None:
            return default
        raise FileNotFoundError(path)
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(value):
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()


def run_dir_from_target(target):
    path = Path(target).expanduser().resolve()
    if path.is_dir():
        return path
    if path.name == "deck_manifest.json":
        return path.parent
    raise ValueError(f"Expected run directory or deck_manifest.json: {target}")


def deck_manifest_path(run_dir):
    return Path(run_dir) / "deck_manifest.json"


def page_jobs_path(run_dir):
    return Path(run_dir) / "page_jobs.json"


def run_state_path(run_dir):
    return Path(run_dir) / "run_state.json"


def load_deck(run_dir):
    return read_json(deck_manifest_path(run_dir))


def save_deck(run_dir, deck):
    write_json(deck_manifest_path(run_dir), deck)


def load_jobs(run_dir):
    return read_json(page_jobs_path(run_dir))


def save_jobs(run_dir, jobs):
    write_json(page_jobs_path(run_dir), jobs)


def load_run_state(run_dir):
    return read_json(run_state_path(run_dir), default={"status": "created", "history": []})


def save_run_state(run_dir, state):
    write_json(run_state_path(run_dir), state)


def set_run_status(run_dir, status, note=None):
    state = load_run_state(run_dir)
    if state.get("status") != status:
        state.setdefault("history", []).append(
            {"from": state.get("status"), "to": status, "at": now_iso(), "note": note}
        )
    state["status"] = status
    state["updated_at"] = now_iso()
    save_run_state(run_dir, state)
    return state


def normalize_page_id(value):
    text = str(value).strip()
    if text.startswith("page_"):
        return text
    if text.isdigit():
        return f"page_{int(text):03d}"
    raise ValueError(f"Invalid page id: {value}")


def find_page(jobs, page):
    page_id = normalize_page_id(page)
    for entry in jobs.get("pages", []):
        if entry.get("page_id") == page_id or entry.get("id") == page_id:
            return entry
    raise KeyError(f"Page not found in page_jobs.json: {page_id}")


def resolve_run_path(run_dir, value):
    path = Path(value)
    if path.is_absolute():
        return path.resolve()
    return (Path(run_dir) / path).resolve()


def rel_to_run(run_dir, value):
    path = Path(value).resolve()
    return path.relative_to(Path(run_dir).resolve()).as_posix()


def resolve_inside(base_dir, value):
    base = Path(base_dir).resolve()
    path = Path(value)
    if not path.is_absolute():
        path = base / path
    path = path.resolve()
    try:
        path.relative_to(base)
    except ValueError as exc:
        raise ValueError(f"Path is outside allowed directory: {path}") from exc
    return path


def all_pages_have_status(jobs, statuses):
    allowed = set(statuses)
    return all(page.get("status") in allowed for page in jobs.get("pages", []))


def max_concurrent_pages(jobs):
    value = jobs.get("max_concurrent_pages", DEFAULT_MAX_CONCURRENT_PAGES)
    try:
        value = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid max_concurrent_pages: {value}") from exc
    if value < 1:
        raise ValueError("max_concurrent_pages must be >= 1")
    return value


def active_pages(jobs):
    return [page for page in jobs.get("pages", []) if page.get("status") in ACTIVE_PAGE_STATUSES]


def dispatchable_pages(jobs):
    return [
        page
        for page in jobs.get("pages", [])
        if page.get("status") in DISPATCHABLE_PAGE_STATUSES
    ]


def dispatch_slots_available(jobs):
    return max(0, max_concurrent_pages(jobs) - len(active_pages(jobs)))


def update_jobs_run_status(jobs):
    pages = jobs.get("pages", [])
    if pages and all(page.get("status") in {"dispatched", "recorded", "accepted"} for page in pages):
        jobs["run_status"] = "pages_dispatched"
    if pages and all(page.get("status") in {"recorded", "accepted"} for page in pages):
        jobs["run_status"] = "pages_recorded"
    if pages and all(page.get("status") == "accepted" for page in pages):
        jobs["run_status"] = "complete"
    jobs["updated_at"] = now_iso()


def inside_or_missing(page_dir, value):
    path = resolve_inside(page_dir, value)
    if not path.exists():
        raise FileNotFoundError(path)
    return path


def safe_agent_label(agent_id, nickname=None):
    label = str(agent_id).strip()
    if nickname:
        label += f" ({nickname})"
    return label


def page_dir_for(run_dir, page):
    return resolve_run_path(run_dir, page["page_dir"])


def ensure_file(path, label):
    path = Path(path)
    if not path.exists() or not path.is_file():
        raise FileNotFoundError(f"Missing {label}: {path}")
    return path


def ensure_dir(path, label):
    path = Path(path)
    if not path.exists() or not path.is_dir():
        raise FileNotFoundError(f"Missing {label}: {path}")
    return path

```

### Core Architecture Module: `skills/image-to-editable-ppt/cli/editppt/runtime/deck_text_hints.py`
```
#!/usr/bin/env python3
"""Generate text hints for every page of a prepared run.

Runs as part of `editppt prepare`, after page directories exist: each
`pages/page_NNN/` receives canonical `text_hints.json` and `text_hints.png`
files so page workers find their text measurements already in place.

Backend selection per run:
- With a PaddleOCR token (PADDLE_OCR_TOKEN env var, or PADDLE_OCR_TOKEN in
  ~/.editppt/config.yaml): PDF inputs are submitted to the OCR service as ONE
  job covering all pages; image/PPTX inputs submit each page's source.png.
  OCR coordinates are rescaled to each page's actual source.png resolution
  and re-measured locally with the ink metrics.
- Without a token, or when the service fails: the built-in offline detector
  (`text_hints.py`) runs per page, so every page still gets hints.

Hint generation is best-effort: a page that fails is reported and skipped,
and the page worker can regenerate with `editppt page hints <page_dir>`.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from PIL import Image

from deck_run_state import load_deck, load_jobs, page_dir_for, run_dir_from_target
from text_hints import draw_overlay, page_text_hints

HINTS_JSON = "text_hints.json"
HINTS_PNG = "text_hints.png"


def paddle_token() -> str:
    token = os.environ.get("PADDLE_OCR_TOKEN", "").strip()
    if token:
        return token
    try:
        from runtime_env import config_path, read_config_file

        return str(read_config_file(config_path()).get("PADDLE_OCR_TOKEN", "")).strip()
    except Exception:
        return ""


def write_hints(page_dir: Path, hints: dict, overlay: bool) -> None:
    (page_dir / HINTS_JSON).write_text(json.dumps(hints, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if overlay:
        draw_overlay(Image.open(page_dir / "source.png"), hints["lines"], page_dir / HINTS_PNG)


def builtin_page(page_dir: Path) -> dict:
    hints = page_text_hints(page_dir)
    hints["backend"] = "builtin-ink"
    return hints


def synthesize_pdf(page_dirs: list[Path], out_path: Path) -> None:
    """Bundle the per-page source images into one PDF (one page per image).

    Lets every input type — single image, multiple images, image-based PPTX —
    reach the OCR service as a single batch job instead of one job per page.
    Page size is the image's pixel size in points; build_page_hints rescales
    the OCR coordinates back to each source.png regardless of the resolution
    the service rendered at.
    """
    import fitz

    document = fitz.open()
    for page_dir in page_dirs:
        with Image.open(page_dir / "source.png") as image:
            width, height = image.size
        page = document.new_page(width=width, height=height)
        page.insert_image(fitz.Rect(0, 0, width, height), filename=str(page_dir / "source.png"))
    document.save(out_path)
    document.close()


def paddle_pages(run_dir: Path, deck: dict, page_dirs: list[Path], token: str, timeout: int) -> dict[Path, dict]:
    """Fetch OCR results for all pages in ONE job; returns {page_dir: hints}."""
    import tempfile

    from paddle_text_hints import DEFAULT_MODEL, build_page_hints, submit_and_fetch

    original = None
    if str(deck.get("input_type", "")) == "pdf":
        input_dir = run_dir / "input"
        candidates = sorted(input_dir.glob("*.pdf")) if input_dir.exists() else []
        original = candidates[0] if candidates else None

    synthesized = None
    try:
        if original is None:
            handle = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
            handle.close()
            synthesized = Path(handle.name)
            synthesize_pdf(page_dirs, synthesized)
            original = synthesized
        pages = submit_and_fetch(original, token, DEFAULT_MODEL, timeout)
    finally:
        if synthesized is not None:
            synthesized.unlink(missing_ok=True)
    if len(pages) != len(page_dirs):
        raise RuntimeError(f"OCR returned {len(pages)} pages for {len(page_dirs)} page dirs")
    return {page_dir: build_page_hints(page_dir, pruned) for page_dir, pruned in zip(page_dirs, pages)}


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate per-page text hints for a prepared run.")
    parser.add_argument("run", help="Run directory or deck_manifest.json path.")
    parser.add_argument("--timeout", type=int, default=300, help="OCR job timeout in seconds.")
    parser.add_argument("--no-overlay", action="store_true", help="Skip the labeled overlay images.")
    args = parser.parse_args()

    run_dir = run_dir_from_target(args.run)
    deck = load_deck(run_dir)
    jobs = load_jobs(run_dir)
    page_dirs = [page_dir_for(run_dir, page) for page in jobs.get("pages", [])]
    page_dirs = [d for d in page_dirs if (d / "source.png").exists()]
    if not page_dirs:
        print("text-hints: no pages with source.png; skipped", file=sys.stderr)
        return 0

    token = paddle_token()
    results: dict[Path, dict] = {}
    backend = "builtin-ink"
    if not token:
        print(
            "text-hints: no PaddleOCR token configured; falling back to the built-in offline "
            "detector (geometry only — it measures where text is and how large, but cannot read "
            "it). A free PaddleOCR-VL token adds recognized text content and cleaner block "
            "boundaries, noticeably improving text fidelity in the final PPT. The free personal quota "
            "is currently more than enough for this skill, so applying is risk-free with no extra "
            "cost. ASK THE USER once "
            "before reconstructing pages: configure a token now (apply at "
            "https://aistudio.baidu.com/account/accessToken, then `editppt config "
            "--paddle-ocr-token <token>` and `editppt run hints <run>` to regenerate this run's "
            "hints), or continue with the offline result. Respect their choice and do not ask again.",
            file=sys.stderr,
        )
    if token:
        try:
            results = paddle_pages(run_dir, deck, page_dirs, token, args.timeout)
            backend = "paddleocr-vl"
        except Exception as exc:
            print(f"text-hints: PaddleOCR failed ({exc}); falling back to built-in detector", file=sys.stderr)
            results = {}

    written = 0
    for page_dir in page_dirs:
        try:
            hints = results.get(page_dir) or builtin_page(page_dir)
            # Dense diagrams can defeat the OCR layout model entirely (the
            # whole figure is classified as an image and only a headline
            # survives). When OCR found almost nothing but the offline
            # detector finds plenty, the geometric hints are more useful.
            if hints.get("backend") == "paddleocr-vl" and len(hints["lines"]) <= 2:
                offline = builtin_page(page_dir)
                if len(offline["lines"]) >= 6:
                    print(
                        f"text-hints: {page_dir.name}: OCR found {len(hints['lines'])} text lines but the "
                        f"offline detector found {len(offline['lines'])}; using the offline result for this page",
                        file=sys.stderr,
                    )
                    hints = offline
            write_hints(page_dir, hints, overlay=not args.no_overlay)
            written += 1
        except Exception as exc:
            print(f"text-hints: {page_dir.name} failed ({exc}); worker can run `editppt page hints` itself", file=sys.stderr)
    print(f"text-hints: wrote {written}/{len(page_dirs)} pages (backend={backend})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #46** (2026-09-16): **docs: use official e-iceblue sponsor logo**
  *Symptoms*: ## Summary  Replace the orange Spire.Presentation icon with the official e-iceblue logo supplied by the sponsor. All six multilingual README and documentation placements share this asset, so they update together.  ## User-visible changes  - Show the official blue e-iceblue logo in the existing sponsor card. - Preserve the card text, dimensions, placement, and product affiliate links.  ## Changelog  - [x] Updated `CHANGELOG.md` - [ ] Not needed: internal-only change  ## Verification  - Verified the replacement PNG matches the sponsor's attachment byte for byte. - Verified all six pages reference this asset and retain the product URL with affiliate ID 420. - `git diff --check` passed. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-16T06:42:36.351830Z">2026-09-16T06:42:36.351830Z</relative-time> | `5a3ba82` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #45** (2026-09-16): **docs: use product page for Spire affiliate links**
  *Symptoms*: ## Summary  Spire.Presentation sponsor links currently land on the e-iceblue homepage. Point all six calls to action to the product page requested by e-iceblue, preserving affiliate ID 420.  ## User-visible changes  - Update the Chinese, English, and Korean READMEs and documentation homepages to use https://www.e-iceblue.com/Introduce/presentation-for-python.html?aff_id=420.  ## Changelog  - [x] Updated `CHANGELOG.md` - [ ] Not needed: internal-only change  ## Verification  - Verified each of the six files contains exactly one new product affiliate URL and no previous homepage affiliate URL. - `git diff --check` passed. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-16T06:06:40.514513Z">2026-09-16T06:06:40.514513Z</relative-time> | `1a62a2b` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #44** (2026-09-16): **docs: add Spire.Presentation sponsor cards**
  *Symptoms*: ## Summary  Add Spire.Presentation for Python to the sponsor section below Codia NoteSlide, using the supplied logo and copy.  ## User-visible changes  - Add matching sponsor cards to the Chinese, English, and Korean READMEs and documentation homepages. - Link each call to action to the e-iceblue affiliate URL with `aff_id=420`.  ## Changelog  - [x] Updated `CHANGELOG.md` - [ ] Not needed: internal-only change  ## Verification  - `git diff --check` passed. - Verified all six sponsor tables preserve existing content and contain one correctly placed Spire.Presentation row and the expected affiliate link. - Verified the supplied logo is present and all image references use the existing README/docs conventions. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-16T04:37:46.182615Z">2026-09-16T04:37:46.182615Z</relative-time> | `a771e22` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #42** (2026-09-15): **docs: embed demo video across multilingual documentation**
  *Symptoms*: ## Summary  Embed the project demo video immediately below the title, language navigation, and badges in all three READMEs, matching the Codex Celebrate layout. Add the same playable video to the Chinese, English, and Korean documentation home pages.  ## User-visible changes  - GitHub-hosted MP4 uploaded through the README editor, named `image-to-editable-ppt-promo.mp4`. - Native GitHub video playback in the READMEs and a controlled, non-autoplay player with a poster in Docsify. - Existing overview images and documentation remain intact.  ## Changelog  - [x] Updated `CHANGELOG.md` - [ ] Not needed: internal-only change  ## Verification  - `git diff --check`. - Reviewed all six language pages for matching placement and video URL. - GitHub README preview renders the video below the badge row. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-15T16:33:50.736725Z">2026-09-15T16:33:50.736725Z</relative-time> | `a92b83f` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #41** (2026-09-16): **额度平衡**
  *Symptoms*: 我有一个30页ppt，单张转换token消耗低还是整体交进去消耗低？
  **Post-Mortem & Fix Analysis**:
  > 整体低，但是30页还是需要不少token的，建议pro 20x用，plus肯定不够

- **Issue #40** (2026-09-13): **docs: revert WeChat community QR restoration**
  *Symptoms*: ## Summary  - revert PR #39 - remove the restored WeChat community QR code from all README language versions - remove the matching unreleased changelog entry and QR asset  ## Verification  - `git diff --cached --check` - verified the revert touches only the five files introduced by PR #39  ## Notes  - This preserves the Telegram and issue support links.
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ⚠️ **Failed** <relative-time datetime="2026-09-13T05:24:27.606082Z">2026-09-13T05:24:27.606082Z</relative-time> | `a8d4aa1` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #39** (2026-09-13): **docs: restore WeChat community QR code**
  *Symptoms*: ## Summary  - restore the WeChat community QR code in the existing support section - keep Chinese, English, and Korean READMEs synchronized - document the restoration in the unreleased changelog  ## Verification  - `git diff --check` - verified the restored PNG matches the historical Git blob  ## Notes  - The QR image is restored byte-for-byte from commit `a62dc8e`; its current WeChat invitation validity requires an actual scan.
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-13T04:31:19.693357Z">2026-09-13T04:31:19.693357Z</relative-time> | `03c144f` | PR opened |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

- **Issue #38** (2026-09-12): **feat: release v0.4.0 editable tables and page recovery**
  *Symptoms*: ## 摘要  - 发布 v0.4.0：适配 GPT Image 2.5、完整对象区域切分和原生可编辑 PowerPoint 表格。 - 支持页面局部恢复和合格素材复用，修复来源误判与合并前文件变动检测。 - 精简技能提示词和参考文档读取流程；保留 OCR 配置或受阻时的用户交互，同步中英韩说明。  ## 验证  - 本地完整回归：128 项测试、101 个子场景通过。 - README 四张示例的已有素材重新切分，48 个对象与原裁切逐像素一致。 - git diff --check 通过。  ## 说明  - 四张 README 原图的新一轮完整转换仍在独立任务运行，不计为本 PR 已完成的端到端验证。 - 发布标签将在合并后指向 main 合并提交，发布包只包含可安装技能目录。 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-12T07:09:04.001643Z">2026-09-12T07:09:04.001643Z</relative-time> | `9e54499` | Draft marked ready |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Codex reacts with 👀 while any review is running, comments if it has suggestions, and reacts with 👍 once all reviews finish with no findings.  </details>

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

### Incident Patch 1: `66066030` (2026-09-13)
**Commit Message**: Merge pull request #40 from ningzimu/feature/revert-community-qr

docs: revert WeChat community QR restoration

**File**: `CHANGELOG.md` (modified, +0/-4)
```diff
@@ -4,10 +4,6 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
-### Documentation
-
-- Restore the WeChat community QR code to the support section across all README language versions. (#39)
-
 ## 0.4.0
 
 ### Features
```

**File**: `README.md` (modified, +0/-4)
```diff
@@ -249,10 +249,6 @@ output/image-to-editable-ppt/{job-id}/        # 单次转换任务目录
 
 遇到问题？请查看[使用文档](https://ningzimu.github.io/image-to-editable-ppt-skill/#/)，加入 [CodexPPT](https://t.me/CodexPPT)，或[提交 Issue](https://github.com/ningzimu/image-to-editable-ppt-skill/issues/new)。
 
-扫描二维码加入微信交流群，分享使用经验、反馈问题，并获取更新通知。
-
-<img src="assets/image-to-editable-ppt-community-qr.png" alt="Image to Editable PPT 微信交流群二维码" width="220">
-
 ## 许可证
 
 MIT
```

**File**: `README_en.md` (modified, +0/-4)
```diff
@@ -249,10 +249,6 @@ output/image-to-editable-ppt/{job-id}/        # One conversion job folder
 
 Having trouble? Check the [usage documentation](https://ningzimu.github.io/image-to-editable-ppt-skill/#/en/), join [CodexPPT](https://t.me/CodexPPT), or [open an issue](https://github.com/ningzimu/image-to-editable-ppt-skill/issues/new).
 
-Scan the QR code to join the WeChat community group, share your experience, report issues, and receive update notifications.
-
-<img src="assets/image-to-editable-ppt-community-qr.png" alt="Image to Editable PPT WeChat community group QR code" width="220">
-
 ## License
 
 MIT
```

**File**: `README_ko.md` (modified, +0/-4)
```diff
@@ -249,10 +249,6 @@ output/image-to-editable-ppt/{job-id}/        # 단일 변환 작업 디렉터
 
 문제가 있나요? [사용 설명서](https://ningzimu.github.io/image-to-editable-ppt-skill/#/ko/)를 확인하고, [CodexPPT](https://t.me/CodexPPT)에 참여하거나, [Issue를 등록하세요](https://github.com/ningzimu/image-to-editable-ppt-skill/issues/new).
 
-QR 코드를 스캔하여 WeChat 커뮤니티 그룹에 참여하고, 사용 경험을 공유하고, 문제를 제보하고, 업데이트 알림을 받아보세요.
-
-<img src="assets/image-to-editable-ppt-community-qr.png" alt="Image to Editable PPT WeChat 커뮤니티 그룹 QR 코드" width="220">
-
 ## 라이선스
 
 MIT
```

---

### Incident Patch 2: `a8d4aa18` (2026-09-13)
**Commit Message**: docs: revert WeChat community QR restoration

**File**: `CHANGELOG.md` (modified, +0/-4)
```diff
@@ -4,10 +4,6 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
-### Documentation
-
-- Restore the WeChat community QR code to the support section across all README language versions. (#39)
-
 ## 0.4.0
 
 ### Features
```

**File**: `README.md` (modified, +0/-4)
```diff
@@ -249,10 +249,6 @@ output/image-to-editable-ppt/{job-id}/        # 单次转换任务目录
 
 遇到问题？请查看[使用文档](https://ningzimu.github.io/image-to-editable-ppt-skill/#/)，加入 [CodexPPT](https://t.me/CodexPPT)，或[提交 Issue](https://github.com/ningzimu/image-to-editable-ppt-skill/issues/new)。
 
-扫描二维码加入微信交流群，分享使用经验、反馈问题，并获取更新通知。
-
-<img src="assets/image-to-editable-ppt-community-qr.png" alt="Image to Editable PPT 微信交流群二维码" width="220">
-
 ## 许可证
 
 MIT
```

**File**: `README_en.md` (modified, +0/-4)
```diff
@@ -249,10 +249,6 @@ output/image-to-editable-ppt/{job-id}/        # One conversion job folder
 
 Having trouble? Check the [usage documentation](https://ningzimu.github.io/image-to-editable-ppt-skill/#/en/), join [CodexPPT](https://t.me/CodexPPT), or [open an issue](https://github.com/ningzimu/image-to-editable-ppt-skill/issues/new).
 
-Scan the QR code to join the WeChat community group, share your experience, report issues, and receive update notifications.
-
-<img src="assets/image-to-editable-ppt-community-qr.png" alt="Image to Editable PPT WeChat community group QR code" width="220">
-
 ## License
 
 MIT
```

**File**: `README_ko.md` (modified, +0/-4)
```diff
@@ -249,10 +249,6 @@ output/image-to-editable-ppt/{job-id}/        # 단일 변환 작업 디렉터
 
 문제가 있나요? [사용 설명서](https://ningzimu.github.io/image-to-editable-ppt-skill/#/ko/)를 확인하고, [CodexPPT](https://t.me/CodexPPT)에 참여하거나, [Issue를 등록하세요](https://github.com/ningzimu/image-to-editable-ppt-skill/issues/new).
 
-QR 코드를 스캔하여 WeChat 커뮤니티 그룹에 참여하고, 사용 경험을 공유하고, 문제를 제보하고, 업데이트 알림을 받아보세요.
-
-<img src="assets/image-to-editable-ppt-community-qr.png" alt="Image to Editable PPT WeChat 커뮤니티 그룹 QR 코드" width="220">
-
 ## 라이선스
 
 MIT
```

---

### Incident Patch 3: `7e86fb34` (2026-09-12)
**Commit Message**: fix: streamline page recovery and validation

**File**: `AGENTS.md` (modified, +2/-2)
```diff
@@ -24,7 +24,7 @@ The skill documentation under `skills/image-to-editable-ppt/` follows a strict o
 
 - **One authoritative home per rule.** Every requirement lives in exactly one file. Other files may carry at most a one-line pointer ("see `page-decision-tree.md` section 3.1") — never a restated list, enumeration, or procedure. Duplicated statements drift apart and inflate the token cost of every run.
 - **Reader-role split.** `SKILL.md` is read by the parent/orchestrator agent; the references and the worker prompt are read by page workers. Parent-level rules (orchestration, dispatch, state machine, user interaction) belong in `SKILL.md`; page-level rules (object decisions, field contracts, QA) belong in the references. Do not let worker-level detail leak back into `SKILL.md`.
-- **Every rule is a recorded failure.** Each requirement in these documents encodes a real past failure mode. Never delete a requirement during refactoring; when condensing or moving text, map every criterion to its new home first and verify nothing is lost. Tightening wording is welcome; dropping constraints is not.
+- **Every rule is a recorded failure.** Each requirement in these documents encodes a real past failure mode. When condensing or moving text, map every criterion to its authoritative home and verify the failure protection remains. Retire a redundant or counterproductive requirement only with evidence and an equivalent regression check that preserves the intended protection.
 - **Explain why, not bare musts.** Where a rule has a rationale (over-rounding is a common visible failure; nativizing text first locks in wrong object-source choices), state it briefly. Agents follow rules better when the failure they prevent is named.
 - **Reminders, not replacements.** The worker prompt may carry a short hard-rules block (about five lines) restating the highest-risk red lines, each ending with a pointer to its authoritative home. This is the only sanctioned form of duplication.
 - **Docs and CLI move together.** All run/page state transitions go through `editppt` commands. If a documented flow changes (for example: every page, including single-page input, is dispatched to a worker), the CLI behavior in `cli/` and the tests in `tests/` must change in the same PR. Docs must never describe a flow the CLI does not enforce.
@@ -36,7 +36,7 @@ The skill documentation under `skills/image-to-editable-ppt/` follows a strict o
 | Path | Owns | Must not contain |
 | --- | --- | --- |
 | `SKILL.md` | Trigger description; parent-level Entry Contract; the four-phase workflow (prepare → dispatch → record → finalize); state principles; delivery principles; deck-level structural QA; PaddleOCR token user-interaction policy | Worker-level decision rules, field definitions, hints usage details, command syntax beyond the phase commands |
-| `prompts/page-worker.md` | The worker execution template: page ownership boundary, mandatory-read enforcement for the three references, the short hard-rules block, execution order, required output list, return format | Restated decision-tree content, field contracts, or QA criteria — point to the references instead |
+| `prompts/page-worker.md` | The worker execution template: page ownership boundary, contextual reference-reading route, the short hard-rules block, execution order, required output list, return format | Restated decision-tree content, field contracts, or QA criteria — point to the references instead |
 | `references/page-decision-tree.md` | Single source of truth for object-source decisions: the three-step process (background → foreground assets → native elements), all object classification lists, text-hints usage, the Final Self-Check, and the Fix versus Warning split | JSON field contracts, command syntax |
 | `references/manifest-schema.md` | Single home for JSON field contracts of every run/page artifact: `deck_manifest.json`, `page_jobs.json`, `page_request.json`, `page_result.json`, `validation.json`, `manifest.j
```

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -10,10 +10,17 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ### Improvements
 
+- Reuse verified page assets during local recovery and load worker references by task instead of requiring every reference in full. Preserve OCR setup and blocked-OCR user interaction.
+
 - Add whole-object region splitting that retains disconnected details after chroma-key removal; keep flat-color asset generation as the default and fix processing of already-transparent supplied sheets.
 
 - Default CLI image requests to GPT Image 2.5 Sunburst, support Flare and model-specific `xhigh`/`max` quality, and retain `auto` quality and built-in-first routing.
 
+### Fixes
+
+- Validate structured foreground provenance without treating incidental words or negated descriptions as forbidden sources.
+- Reject changed recorded outputs and image assets before finalization, and report bounded faint isolated region residue as a warning while retaining boundary-cut failures.
+
 ### Documentation
 
 - Add Codia NoteSlide sponsor cards and links across Chinese, English, and Korean READMEs and documentation homepages. (#37)
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -31,7 +31,7 @@
 > ![Codex 完全访问权限设置示意](assets/codex-full-access-permission.png)
 
 > [!WARNING]
-> 目前该skill 采用了多智能体协作复原流程，有着复杂的流程控制，不是轻量转换器。AI 会执行“**重建 → 自我检查 → 页面内修正**”的循环，并可能进行多轮迭代，直到它认为结果足够接近原图。在这个过程中，page worker 可能会对页面做很**多轮尝试**，因此整体上比较费 token。
+> 页面验证失败时优先局部修复并复用已核验的素材；当前输出通过检查后即完成，不因可接受的小毛边重复生成。常规步骤自主执行；缺少 OCR Token 或 OCR 受阻时仍会询问用户。复杂页面仍可能消耗较多 token。
 >
 > **推荐 ChatGPT Pro 用户使用；Plus 用户请谨慎使用。**
 >
@@ -221,7 +221,7 @@ output/image-to-editable-ppt/{job-id}/        # 单次转换任务目录
 - 单页/单图输入可由主 agent 本地重建；多页输入通过 page worker/subagent 并行重建。
 - 复杂视觉资产需要可用的内置图片工具或 CLI fallback；如果两者都无法生成合规资产，对应页面会校验失败，不会用近似图形替代。
 - 对照片、插画、纹理、手绘装饰等复杂视觉元素，通常只能作为独立图片资产移动，不能保证内部对象可编辑。
-- 原生表格暂不支持斜线表头和单元格内嵌图片；文字、行列或合并关系不清楚时需确认，不猜测内容或结构。图表、流程图仍按可编辑结构重建。
+- 原生表格暂不支持斜线表头和单元格内嵌图片；文字、行列或合并关系不清楚时先复查源图与 OCR，仍无法辨认则报告具体缺失，不猜测内容或结构。图表、流程图仍按可编辑结构重建。
 - 视觉相似不等于可编辑。最终判断应同时看 PPTX 结构、文本覆盖、资产来源和预览/diff。
 
 ## 仓库结构
```

**File**: `README_en.md` (modified, +2/-2)
```diff
@@ -31,7 +31,7 @@ It is useful when screenshot-like or image-based slides need to become easier to
 > ![Codex Full Access permission setting](assets/codex-full-access-permission.png)
 
 > [!WARNING]
-> This skill currently uses a multi-agent collaborative reconstruction workflow with complex flow control. It is not a lightweight converter. The AI runs a "**rebuild -> self-check -> page-local correction**" loop and may iterate multiple times until it judges the result close enough to the source. During this process, page workers may make **many attempts** per page, so the workflow can consume a large number of tokens.
+> Failed page validation leads to local repairs that reuse verified assets. Work stops when the current outputs pass checks; acceptable minor fringes do not trigger regeneration. Routine steps run autonomously; missing OCR tokens or blocked OCR still require user input. Complex pages can still consume substantial tokens.
 >
 > **GPT Pro is recommended. Plus users should use this skill cautiously.**
 >
@@ -221,7 +221,7 @@ output/image-to-editable-ppt/{job-id}/        # One conversion job folder
 - Single-page or single-image input can be rebuilt locally by the main agent; multi-page input is rebuilt in parallel through page workers/subagents.
 - Complex visual assets need either the built-in image tool or the CLI fallback. If neither can produce a compliant asset, the page fails validation instead of substituting approximate shapes.
 - Complex photos, illustrations, textures, and hand-drawn decorations are usually movable image assets, not internally editable PowerPoint objects.
-- Native tables do not yet support diagonal headers or images embedded in cells. Unclear text, rows, columns, or merges require clarification rather than guessed content or structure. Charts and flowcharts continue to use editable structural objects.
+- Native tables do not yet support diagonal headers or images embedded in cells. Unclear text, rows, columns, or merges are checked against the source and OCR first; unresolved details are reported without guessing content or structure. Charts and flowcharts continue to use editable structural objects.
 - Visual similarity is not enough. Acceptance should check package structure, editable text coverage, asset provenance, preview, and diff.
 
 ## Repository Layout
```

**File**: `README_ko.md` (modified, +2/-2)
```diff
@@ -31,7 +31,7 @@
 > ![Codex 전체 액세스 권한 설정 예시](assets/codex-full-access-permission.png)
 
 > [!WARNING]
-> 현재 이 skill은 멀티 agent 협업 복원 흐름과 복잡한 프로세스 제어를 사용하므로 가벼운 변환기가 아닙니다. AI는 “**재구성 → 자체 점검 → 페이지 내부 수정**” 사이클을 수행하며, 결과가 원본에 충분히 가깝다고 판단할 때까지 여러 번 반복할 수 있습니다. 이 과정에서 page worker가 한 페이지를 **여러 차례 시도**할 수 있어 전체 token 사용량이 큽니다.
+> 페이지 검증 실패 시 검증된 소재를 재사용하며 필요한 부분을 수정합니다. 현재 출력이 검사를 통과하면 완료하며, 허용 가능한 작은 가장자리 흔적만으로 다시 생성하지 않습니다. 일반 단계는 자율적으로 실행하지만 OCR Token이 없거나 OCR이 차단되면 사용자에게 문의합니다. 복잡한 페이지는 여전히 많은 token을 사용할 수 있습니다.
 >
 > **ChatGPT Pro 사용자에게 권장하며, Plus 사용자는 신중하게 사용하세요.**
 >
@@ -221,7 +221,7 @@ output/image-to-editable-ppt/{job-id}/        # 단일 변환 작업 디렉터
 - 단일 페이지/이미지 입력은 메인 agent가 로컬에서 재구성할 수 있고, 다중 페이지 입력은 page worker/subagent가 병렬로 재구성합니다.
 - 복잡한 시각 에셋에는 사용할 수 있는 내장 이미지 도구 또는 CLI 폴백이 필요합니다. 둘 다 규격에 맞는 에셋을 생성할 수 없으면 해당 페이지는 검증에 실패하며 근사 도형으로 대체하지 않습니다.
 - 사진, 일러스트, 질감, 손그림 장식 등의 복잡한 시각 요소는 일반적으로 독립 이미지 에셋으로 이동할 수 있을 뿐, 내부 객체의 편집 가능성을 보장하지 않습니다.
-- 네이티브 표는 아직 대각선 머리글과 셀 내부 이미지를 지원하지 않습니다. 텍스트, 행·열 또는 병합 관계가 불분명하면 확인이 필요하며 내용이나 구조를 추측하지 않습니다. 차트와 순서도는 계속 편집 가능한 구조 객체로 재구성합니다.
+- 네이티브 표는 아직 대각선 머리글과 셀 내부 이미지를 지원하지 않습니다. 텍스트, 행·열 또는 병합 관계가 불분명하면 원본과 OCR을 먼저 다시 확인하고, 해결되지 않은 내용을 구체적으로 보고하며 내용이나 구조를 추측하지 않습니다. 차트와 순서도는 계속 편집 가능한 구조 객체로 재구성합니다.
 - 시각적으로 비슷하다는 것이 편집 가능하다는 뜻은 아닙니다. 최종 판단 시 PPTX 구조, 텍스트 커버리지, 에셋 출처, 미리보기/diff를 함께 확인해야 합니다.
 
 ## 저장소 구조
```

---

### Incident Patch 4: `9e55ef77` (2026-09-10)
**Commit Message**: fix: preserve editable curves and PowerPoint compatibility

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -4,8 +4,18 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
+### Features
+
+- Build native editable Bézier paths with dash styles and endpoint arrows, keeping each continuous curve in one PowerPoint object.
+
+### Fixes
+
+- Emit valid slide-size metadata and complete theme style lists to avoid PowerPoint repair prompts.
+- Render diagonal and curved dashed strokes in previews and validate path contracts, stroke styles, and declared logical-line uniqueness.
+
 ### Documentation
 
+- Specify structural curve granularity, document curve editing, and distinguish editable paths from data-linked charts.
 - Add complete Korean README and English and Korean versions of the Docsify usage documentation, with synchronized language navigation, search, and pagination. (#26)
 - Align all usage guides with the built-in-first image backend policy and block delivery when compliant image assets cannot be produced. (#26)
 - Add compact documentation, Telegram, and issue support links to all README language versions, and remove the obsolete community QR code. (#28, #29)
```

**File**: `README.md` (modified, +1/-0)
```diff
@@ -75,6 +75,7 @@
 - `.pptx` 输入的页面备注会复制到输出对应页，备注内容不改动。
 - 根据具体页面情况决定是否通过已确认 image backend 做图片分层抽取；需要时用稀疏 asset sheet 合并前景素材，优先把图标放在一个素材板上，并保留充足间隙便于后续分离。
 - 支持复杂视觉页的混合策略：可编辑文字 + 简单形状 + 独立图片资产。
+- 支持完整的原生曲线路径、虚线样式和端点箭头，可整体调整线条形状与样式；曲线路径不等同于数据驱动图表。 在 PowerPoint 中，右键曲线选择“编辑顶点”，再点端点或顶点，拖动出现的白色控制手柄即可调整曲度。
 
 ## 适用场景
 
```

**File**: `README_en.md` (modified, +1/-0)
```diff
@@ -75,6 +75,7 @@ It is useful when screenshot-like or image-based slides need to become easier to
 - Preserve `.pptx` speaker notes on matching output slides without modifying note text.
 - Decides page by page whether to use the confirmed image backend for visual-layer extraction; when needed, sparse asset sheets group foreground assets, prefer placing icons on one sheet, and keep generous gaps for later splitting.
 - Supports hybrid reconstruction: editable text, simple native shapes, and independent image assets.
+- Supports complete native curve paths, dash styles, and endpoint arrows for editing a whole line’s shape and style; curve paths are not data-linked charts. In PowerPoint, right-click a curve, choose **Edit Points**, select an endpoint or vertex, and drag its white control handle to adjust curvature.
 
 ## Use Cases
 
```

**File**: `README_ko.md` (modified, +1/-0)
```diff
@@ -75,6 +75,7 @@
 - `.pptx` 입력의 페이지 노트는 내용 변경 없이 출력의 해당 페이지로 복사됩니다.
 - 페이지 상황에 따라 확인된 image backend로 이미지 레이어를 분리할지 결정합니다. 필요한 경우 희소 asset sheet로 전경 소재를 모으며, 아이콘은 충분한 간격을 둔 하나의 소재 보드에 우선 배치해 후속 분리를 쉽게 합니다.
 - 편집 가능한 텍스트 + 단순 도형 + 독립 이미지 에셋을 결합하는 복잡한 시각 페이지용 혼합 전략을 지원합니다.
+- 완전한 네이티브 곡선 경로, 점선 스타일, 끝점 화살표를 지원해 선 전체의 모양과 스타일을 조정할 수 있습니다. 곡선 경로는 데이터 연동 차트와 다릅니다. PowerPoint에서 곡선을 마우스 오른쪽 버튼으로 클릭해 **점 편집**을 선택한 뒤, 끝점이나 꼭짓점을 클릭하고 흰색 조절 핸들을 드래그하면 곡률을 바꿀 수 있습니다.
 
 ## 사용 사례
 
```

**File**: `docs/README.md` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ Image to Editable PPT 是一个把图片、PDF、图片版 PPT 转成**对象级
 
 - 支持多种输入：单张图片、多张图片、多页 PDF、图片版 PPT，统一输出可编辑 `.pptx`。
 - 对象级重建：文字恢复为原生文本框，简单几何恢复为 PowerPoint 形状，复杂视觉元素保留为独立图片资产，三类对象可以分开调整。
+- 支持完整的原生曲线路径、虚线样式和端点箭头，可整体调整线条形状与样式；曲线路径不等同于数据驱动图表。 在 PowerPoint 中，右键曲线选择“编辑顶点”，再点端点或顶点，拖动出现的白色控制手柄即可调整曲度。
 - 测量驱动的文字还原：通过 OCR 为每页生成文字标注（框坐标 + 字号 + 字号分组），模型按测量值还原文字，同级文字字号自动保持一致，参见[安装与配置](installation.md)的 OCR Token 一节。
 - 多页并行重建：多页输入由主 agent 分派给 page worker/subagent 并行处理；单页输入由主 agent 本地执行同一重建流程。
 - 图片生成和编辑优先调用当前 agent 的内置 `image_gen.imagegen`；只有满足约定的降级条件时才调用 `editppt image`，由 CLI 在 Codex OAuth 和 OpenAI-compatible API 之间选择后端。
```

---

### Incident Patch 5: `35df4561` (2026-07-11)
**Commit Message**: fix: correct PowerPoint text alignment (#17)

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -4,6 +4,10 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
+### Fixes
+
+- Translate manifest text alignment values to valid DrawingML enums, center preview text within its box, and reject unsupported alignment values during page validation. (#17)
+
 ## 0.3.1
 
 ### Improvements
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/build_pptx_from_manifest.py` (modified, +86/-18)
```diff
@@ -19,6 +19,23 @@
 DEFAULT_TEXT_FIT_SAFETY = 0.9
 DEFAULT_TEXT_LINE_HEIGHT = 1.22
 DEFAULT_MIN_FONT_SIZE = 4.0
+TEXT_ALIGNMENTS = {
+    "left": ("l", "left"),
+    "center": ("ctr", "center"),
+    "right": ("r", "right"),
+    "l": ("l", "left"),
+    "ctr": ("ctr", "center"),
+    "r": ("r", "right"),
+}
+TEXT_VERTICAL_ALIGNMENTS = {
+    "top": ("t", "top"),
+    "middle": ("ctr", "middle"),
+    "center": ("ctr", "middle"),
+    "bottom": ("b", "bottom"),
+    "t": ("t", "top"),
+    "ctr": ("ctr", "middle"),
+    "b": ("b", "bottom"),
+}
 
 
 def emu(value):
@@ -53,6 +70,20 @@ def xml_text(value):
     return html.escape(str(value), quote=True)
 
 
+def text_alignment(value="left"):
+    key = str(value or "left").strip().lower()
+    if key not in TEXT_ALIGNMENTS:
+        raise ValueError(f"Unsupported text align value: {value}")
+    return TEXT_ALIGNMENTS[key]
+
+
+def text_vertical_alignment(value="top"):
+    key = str(value or "top").strip().lower()
+    if key not in TEXT_VERTICAL_ALIGNMENTS:
+        raise ValueError(f"Unsupported text valign value: {value}")
+    return TEXT_VERTICAL_ALIGNMENTS[key]
+
+
 def source_size_px(manifest):
     source = manifest.get("source", {})
     width = source.get("width_px")
@@ -318,8 +349,8 @@ def text_box_xml(idx, item):
     rotation_attr = f' rot="{int(float(rotation) * 60000)}"' if rotation not in (None, "") else ""
     font_size = int(float(item.get("font_size", 18)) * 100)
     font = xml_text(item.get("font", "PingFang SC"))
-    align = item.get("align", "left")
-    anchor = item.get("valign", "top")
+    align = text_alignment(item.get("align", "left"))[0]
+    anchor = text_vertical_alignment(item.get("valign", "top"))[0]
     wrap = item.get("wrap", "none")
     autofit = item.get("autofit", "none")
     autofit_xml = "<a:spAutoFit/>" if autofit == "shape" else "<a:noAutofit/>"
@@ -823,12 +854,34 @@ def render_text(item):
         else:
             preview_text = item.get("text", "")
         fill = preview_color(item.get("color", "#111111"))
-        align = item.get("align", "left") if item.get("align", "left") in ("left", "center", "right") else "left"
-        x = int(item.get("left", 0) * scale)
-        y = int(item.get("top", 0) * scale)
+        align = text_alignment(item.get("align", "left"))[1]
+        valign = text_vertical_alignment(item.get("valign", "top"))[1]
+        box_x = int(item.get("left", 0) * scale)
+        box_y = int(item.get("top", 0) * scale)
+        box_width = max(1, int(item.get("width", 1) * scale))
+        box_height = max(1, int(item.get("height", 0.4) * scale))
         rotation = float(item.get("rotation", 0) or 0)
-        if item.get("runs") and not rotation:
-            cursor_x = x
+
+        def aligned_origin(bounds, origin_x, origin_y):
+            text_width = bounds[2] - bounds[0]
+            text_height = bounds[3] - bounds[1]
+            if align == "center":
+                text_x = origin_x + (box_width - text_width) // 2 - bounds[0]
+            elif align == "right":
+                text_x = origin_x + box_width - text_width - bounds[0]
+            else:
+                text_x = origin_x
+            if valign == "middle":
+                text_y = origin_y + (box_height - text_height) // 2 - bounds[1]
+            elif valign == "bottom":
+                text_y = origin_y + box_height - text_height - bounds[1]
+            else:
+                text_y = origin_y
+            return text_x, text_y
+
+        run_specs = []
+        if item.get("runs"):
+            cursor_x = 0
             base_size = size
             for run in item["runs"]:
                 run_size = max(1, int(float(run.get("font_size", item.get("font_size", 18))) * scale / 72 * preview_font_scale))
@@ -839,21 +892,36 @@ def render_text(item):
                     run_font = font
                 run_fill = preview_color(run.get("color", item.get("color", "#111111")))
                 baseline = float(run.get("baseline", 0)
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/validate_pptx.py` (modified, +19/-1)
```diff
@@ -8,7 +8,7 @@
 from pathlib import Path
 from xml.etree import ElementTree as ET
 
-from build_pptx_from_manifest import normalize_manifest
+from build_pptx_from_manifest import TEXT_ALIGNMENTS, TEXT_VERTICAL_ALIGNMENTS, normalize_manifest
 
 
 NS = {
@@ -322,6 +322,24 @@ def quality_contract_violations(manifest):
                     }
                 )
 
+    for index, text_box in enumerate(manifest.get("text_boxes", [])):
+        align = str(text_box.get("align", "left") or "left").strip().lower()
+        if align not in TEXT_ALIGNMENTS:
+            violations.append(
+                {
+                    "field": f"text_boxes[{index}].align",
+                    "reason": "text align must be left, center, right, or the equivalent DrawingML token l, ctr, r",
+                }
+            )
+        valign = str(text_box.get("valign", "top") or "top").strip().lower()
+        if valign not in TEXT_VERTICAL_ALIGNMENTS:
+            violations.append(
+                {
+                    "field": f"text_boxes[{index}].valign",
+                    "reason": "text valign must be top, middle, bottom, or the equivalent DrawingML token t, ctr, b",
+                }
+            )
+
     violations.extend(foreground_asset_contract_violations(manifest))
     return violations
 
```

**File**: `skills/image-to-editable-ppt/references/manifest-schema.md` (modified, +17/-0)
```diff
@@ -2,6 +2,17 @@
 
 This document describes the responsibilities, owners, and current field contracts for `editppt` run/page JSON files. All key state is advanced by `editppt` commands; page reconstructors write only page-local files.
 
+## Contents
+
+- `deck_manifest.json`
+- `page_jobs.json`
+- `page_request.json`
+- `page_result.json`
+- `pages/page_NNN/validation.json`
+- `pages/page_NNN/manifest.json`
+- `pages/page_NNN/imagegen-jobs.json`
+- `notes_manifest.json`
+
 ## `deck_manifest.json`
 
 Owner: created by `editppt prepare`; `editppt run backend` may update the image backend; `editppt run finalize` reads it and writes completion time.
@@ -187,6 +198,12 @@ Text-size fitting:
 - `text_boxes[].box_px` should describe the source text bounds plus modest padding. Do not use an entire card, chart, table cell group, or unrelated container as the text box, because the fitter can only infer size from the box it receives.
 - Optional tuning fields are `min_font_size`, `max_font_size`, `text_fit_safety`, and `line_height`.
 
+Text alignment:
+
+- `text_boxes[].align` accepts `left`, `center`, or `right` (default `left`). The equivalent DrawingML tokens `l`, `ctr`, and `r` are also accepted.
+- `text_boxes[].valign` accepts `top`, `middle`, or `bottom` (default `top`); `center` is an alias for `middle`. The equivalent DrawingML tokens `t`, `ctr`, and `b` are also accepted.
+- The deterministic builder translates these manifest values to valid DrawingML enum tokens. Unsupported values are page-contract violations instead of silently falling back to an application default.
+
 `text_inventory` may be a list of strings or a list of structured objects. In structured objects, the fields used for exact text validation are `text`, `required_text`, `items`, or `texts`; fields such as `id`, `decision`, `description`, and `note` are only records and are not used for exact text matching. Example:
 
 ```json
```

**File**: `skills/image-to-editable-ppt/references/page-decision-tree.md` (modified, +3/-0)
```diff
@@ -223,6 +223,8 @@ A readable character stroke belongs only to its native text box — never draw t
 
 Preserve grouping relationships (icon + circular base, badge + number, speech bubble + text, hand-drawn arrow + annotation, card background + title + chart + labels).
 
+For native text centered inside a badge or circular base, reuse the base shape's exact `box_px` for the text box and use the centered horizontal and vertical alignment defined in `manifest-schema.md` under "Text alignment." A separate tight ink box drifts as font metrics change and is not a stable grouping relationship.
+
 Recommended z-index:
 
 - clean background/base: 0
@@ -267,6 +269,7 @@ Shapes and layers:
 - Corners follow 3.4; large container corners, table borders, and card borders align with the source. Corner misclassification is a current-page fix, not a low-risk warning.
 - No text stroke is redrawn as a decorative shape (3.5).
 - Dashboards, tables, cards, and charts are decomposed per 1.4, never screenshotted wholesale.
+- Badge and circular-number groups follow the shared-box centering rule in 3.6.
 - z-index follows 3.6; no text or key object is covered.
 
 ## Fix versus Warning
```

---

### Incident Patch 6: `7fb4f30b` (2026-06-26)
**Commit Message**: fix: align Codex OAuth image requests

**File**: `CHANGELOG.md` (modified, +7/-1)
```diff
@@ -4,9 +4,15 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
+## 0.3.1
+
+### Improvements
+
+- Align Codex OAuth image requests with Codex built-in image generation by setting `background=auto` and retrying transport or 5xx failures with Codex-style backoff while leaving rate limits non-retried. (#15)
+
 ### Documentation
 
-- Fix README rendering for the Codex Full Access recommendation callout.
+- Fix README rendering for the Codex Full Access recommendation callout. (#15)
 
 ## 0.3.0
 
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/image_gen.py` (modified, +62/-17)
```diff
@@ -14,7 +14,9 @@
 import mimetypes
 import os
 from pathlib import Path
+import random
 import re
+import socket
 import sys
 import time
 from typing import Any, Dict, Iterable, List, Optional, Tuple
@@ -23,9 +25,12 @@
 DEFAULT_MODEL = "gpt-image-2"
 DEFAULT_SIZE = "auto"
 DEFAULT_QUALITY = "auto"
+DEFAULT_BACKGROUND = "auto"
 DEFAULT_OUTPUT_EXTENSION = "png"
 DEFAULT_OUTPUT_PATH = "output/imagegen/output.png"
 DEFAULT_TIMEOUT = 600
+DEFAULT_CODEX_MAX_RETRIES = 4
+DEFAULT_CODEX_RETRY_BASE_DELAY_SECONDS = 0.2
 GPT_IMAGE_MODEL_PREFIX = "gpt-image-"
 
 ALLOWED_LEGACY_SIZES = {"1024x1024", "1536x1024", "1024x1536", "auto"}
@@ -63,9 +68,10 @@
   edit passes each --image as an edit target, visual reference, or supporting input.
 
 Parameter surface:
-  Backend requests pass only model, prompt, size, and quality. Edit requests
-  also pass the input images and optional mask. Local controls such as --out,
-  --force, --dry-run, and --timeout are not image API parameters.
+  Public image parameters are model, prompt, size, and quality. Codex OAuth
+  requests also set background=auto to match Codex built-in image generation.
+  Edit requests also pass the input images and optional mask. Local controls
+  such as --out, --force, --dry-run, and --timeout are not image API parameters.
 
 Slide reconstruction patterns:
   Clean base: use edit --image <source.png>; preserve source composition,
@@ -288,6 +294,7 @@ def _codex_image_body(
         "model": model,
         "size": size,
         "quality": quality,
+        "background": DEFAULT_BACKGROUND,
     }
     if image_paths:
         body["images"] = [_codex_image_reference(path) for path in image_paths]
@@ -296,6 +303,22 @@ def _codex_image_body(
     return body
 
 
+def _codex_retry_delay(attempt: int) -> float:
+    exp = 2 ** max(attempt - 1, 0)
+    jitter = random.uniform(0.9, 1.1)
+    return DEFAULT_CODEX_RETRY_BASE_DELAY_SECONDS * exp * jitter
+
+
+def _should_retry_codex_http(status: int) -> bool:
+    return 500 <= status <= 599
+
+
+def _format_attempts(attempts: int) -> str:
+    if attempts <= 1:
+        return ""
+    return f" after {attempts} attempts"
+
+
 def _post_codex_image_json(url: str, body: Dict[str, Any], timeout: int) -> Dict[str, Any]:
     auth = _load_codex_auth()
     if not auth:
@@ -310,20 +333,41 @@ def _post_codex_image_json(url: str, body: Dict[str, Any], timeout: int) -> Dict
     }
     if account_id:
         headers["ChatGPT-Account-ID"] = account_id
-    req = request.Request(
-        url,
-        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
-        method="POST",
-        headers=headers,
-    )
-    try:
-        with request.urlopen(req, timeout=timeout) as resp:
-            text = resp.read(MAX_CODEX_RESPONSE_BYTES).decode("utf-8", errors="replace")
-    except error.HTTPError as exc:
-        detail = exc.read(4096).decode("utf-8", errors="replace")
-        raise RuntimeError(f"Codex Images request failed (HTTP {exc.code}): {detail}") from exc
-    except error.URLError as exc:
-        raise RuntimeError(f"Codex Images request failed: {exc.reason}") from exc
+    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
+
+    for attempt in range(DEFAULT_CODEX_MAX_RETRIES + 1):
+        req = request.Request(
+            url,
+            data=data,
+            method="POST",
+            headers=headers,
+        )
+        try:
+            with request.urlopen(req, timeout=timeout) as resp:
+                text = resp.read(MAX_CODEX_RESPONSE_BYTES).decode("utf-8", errors="replace")
+            break
+        except error.HTTPError as exc:
+            detail = exc.read(4096).decode("utf-8", errors="replace")
+            if attempt < DEFAULT_CODEX_MAX_RETRIES and _should_retry_codex_http(exc.code):
+                time.sleep(_codex_retry_delay(attempt + 1))
+                continue
+            attempts = attempt + 1
+            raise RuntimeError(
+                f"Codex Images request failed{_format
```

**File**: `tests/test_multi_agent_backend.py` (modified, +83/-2)
```diff
@@ -1,9 +1,12 @@
+import io
 import json
 import os
 import subprocess
 import sys
 import tempfile
 import unittest
+from unittest import mock
+from urllib import error
 import zipfile
 from pathlib import Path
 
@@ -24,6 +27,9 @@
 )
 os.environ["PYTHONPATH"] = CLI_ENV["PYTHONPATH"]
 
+from editppt.runtime import image_gen
+
+
 def write_json(path, data):
     path.parent.mkdir(parents=True, exist_ok=True)
     path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
@@ -420,7 +426,8 @@ def test_image_edit_dry_run_prefers_codex_oauth_when_auth_exists(self):
             self.assertEqual([str(source)], payload["input_images"])
             self.assertEqual("auto", payload["size"])
             self.assertEqual("auto", payload["quality"])
-            for removed in ("background", "moderation", "output_format", "output_compression", "n"):
+            self.assertEqual("auto", payload["background"])
+            for removed in ("moderation", "output_format", "output_compression", "n"):
                 self.assertNotIn(removed, payload)
 
     def test_image_generate_dry_run_prefers_codex_images_endpoint_when_auth_exists(self):
@@ -456,9 +463,83 @@ def test_image_generate_dry_run_prefers_codex_images_endpoint_when_auth_exists(s
             self.assertEqual([], payload["input_images"])
             self.assertEqual("auto", payload["size"])
             self.assertEqual("auto", payload["quality"])
-            for removed in ("background", "moderation", "output_format", "output_compression", "n"):
+            self.assertEqual("auto", payload["background"])
+            for removed in ("moderation", "output_format", "output_compression", "n"):
                 self.assertNotIn(removed, payload)
 
+    def test_codex_oauth_retries_transport_and_5xx_only(self):
+        with tempfile.TemporaryDirectory() as tmp:
+            auth = Path(tmp) / "auth.json"
+            write_json(auth, {"tokens": {"access_token": "test-token"}})
+
+            class FakeResponse:
+                def __enter__(self):
+                    return self
+
+                def __exit__(self, exc_type, exc, tb):
+                    return False
+
+                def read(self, _limit):
+                    return b'{"data":[{"b64_json":"aW1hZ2U="}]}'
+
+            http_500 = error.HTTPError(
+                "https://example.test",
+                500,
+                "server error",
+                hdrs=None,
+                fp=io.BytesIO(b"temporary"),
+            )
+            env = os.environ.copy()
+            env["CODEX_AUTH_FILE"] = str(auth)
+            with mock.patch.dict(os.environ, env, clear=False), mock.patch(
+                "editppt.runtime.image_gen.request.urlopen",
+                side_effect=[http_500, FakeResponse()],
+            ) as urlopen, mock.patch("editppt.runtime.image_gen.time.sleep") as sleep:
+                response = image_gen._post_codex_image_json(
+                    "https://example.test/images/generations",
+                    {"model": "gpt-image-2", "prompt": "test"},
+                    10,
+                )
+
+            self.assertEqual(["aW1hZ2U="], [item["b64_json"] for item in response["data"]])
+            self.assertEqual(2, urlopen.call_count)
+            sleep.assert_called_once()
+
+            with mock.patch.dict(os.environ, env, clear=False), mock.patch(
+                "editppt.runtime.image_gen.request.urlopen",
+                side_effect=[error.URLError("temporary network failure"), FakeResponse()],
+            ) as urlopen, mock.patch("editppt.runtime.image_gen.time.sleep") as sleep:
+                response = image_gen._post_codex_image_json(
+                    "https://example.test/images/generations",
+                    {"model": "gpt-image-2", "prompt": "test"},
+                    10,
+                )
+
+            self.assertEqual(["aW1hZ2U="], [item["b64_json"] for item in response["data"]])
+            self.assertEqual(2, 
```

---

### Incident Patch 7: `083d6828` (2026-06-22)
**Commit Message**: docs: fix full access callout rendering

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -4,6 +4,10 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
+### Documentation
+
+- Fix README rendering for the Codex Full Access recommendation callout.
+
 ## 0.3.0
 
 ### Features
```

**File**: `README.md` (modified, +3/-1)
```diff
@@ -9,7 +9,9 @@
 它适合把截图式或图片式幻灯片变成更容易二次编辑的 PPT，让文字、简单形状和视觉素材尽量分开调整。
 
 > [!IMPORTANT]
-> **建议在 Codex 中使用“完全访问权限”执行本 skill。**本 skill 运行时间较长，并且会自动执行 OCR、图片生成/编辑、文件读写、子 agent 分派和长时间轮询等步骤。“请求批准”模式会频繁打断执行，可能阻塞部分步骤，尤其是在子 agent 环境里。
+> **建议在 Codex 中使用“完全访问权限”执行本 skill。**
+>
+> 本 skill 运行时间较长，并且会自动执行 OCR、图片生成/编辑、文件读写、子 agent 分派和长时间轮询等步骤。“请求批准”模式会频繁打断执行，可能阻塞部分步骤，尤其是在子 agent 环境里。
 >
 > “替我审批”模式已知仍可能在 OCR 阶段、ChatGPT 图片生成/编辑阶段或第三方 API 调用阶段拦截请求，要求你手动审批；如果你不在电脑旁，转换流程会停住。
 >
```

**File**: `README_en.md` (modified, +3/-1)
```diff
@@ -9,7 +9,9 @@ A skill for converting images, PDFs, and image-based PPT files into editable Pow
 It is useful when screenshot-like or image-based slides need to become easier to edit again, with text, simple shapes, and visual assets separated where practical.
 
 > [!IMPORTANT]
-> **Run this skill in Codex with Full Access whenever possible.** This skill can run for a long time and automatically performs OCR, image generation/editing, file writes, subagent dispatch, and long polling. "Request approval" mode can interrupt the workflow repeatedly and may block required steps, especially inside subagent execution.
+> **Run this skill in Codex with Full Access whenever possible.**
+>
+> This skill can run for a long time and automatically performs OCR, image generation/editing, file writes, subagent dispatch, and long polling. "Request approval" mode can interrupt the workflow repeatedly and may block required steps, especially inside subagent execution.
 >
 > "Approve for me" mode is also known to still block some OCR requests, ChatGPT image generation/editing requests, or third-party API calls until you manually approve them. If you are away from the computer, the conversion may stall.
 >
```

---

### Incident Patch 8: `b0724592` (2026-06-21)
**Commit Message**: fix: document network approval for image backends

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ Release notes are generated from this file. Keep changelog entries in English.
 - Align `editppt image` with the Codex GPT Image workflow: default model, automatic size and quality, a longer Codex OAuth timeout, and a narrow backend request payload that passes only the retained image parameters.
 - Remove the `editppt image batch` interface so page-local image jobs run serially, and document that foreground icons should be grouped into one sparse asset sheet with generous gaps unless one sheet cannot fit them.
 - Clarify that user-requested conversions authorize necessary OCR and image-backend calls while limiting uploads to task-local page images, prompts, masks, and references.
+- Document upfront network approval handling for PaddleOCR, Codex OAuth image calls, and configured OpenAI-compatible image APIs in restricted agent environments.
 - Guard `editppt run reset` for dispatched pages with `--confirm-lost` and a matching `--agent-id`, and document that slow active page workers must not be reset or replaced.
 - Support single-page local reconstruction by returning `rebuild_page_locally`, recording `editppt run dispatch --local`, and keeping the same page artifact and record/finalize path as worker-dispatched pages.
 
```

**File**: `skills/image-to-editable-ppt/SKILL.md` (modified, +3/-0)
```diff
@@ -31,6 +31,7 @@ These parent-level rules are stated once here; page-level rules live in the refe
 - All image generation, image editing, background repair, transparent bitmap assets, and asset sheets go through serial `editppt image generate/edit` calls.
 - A user request to convert visual slides into editable PPT authorizes the required OCR and image-backend calls for that conversion, unless the user explicitly requests local-only processing or marks the input as confidential/no-external-processing. Do not refuse solely because the workflow calls PaddleOCR, Codex OAuth/ChatGPT image endpoints, or a user-configured OpenAI-compatible API; those calls are necessary to the skill.
 - Only send task-local page images, prompts, masks, and reference images required for the current conversion. Never send unrelated local files, API keys, auth tokens, credentials, or generated artifacts that are not needed by the current OCR/image operation. Third-party API endpoints are allowed only when already configured by the user or explicitly specified for this run.
+- In network-restricted environments, request network approval before commands that need these backends: `editppt prepare` or `editppt run hints` when `PADDLE_OCR_TOKEN` is set, and every required `editppt image generate/edit` call. The approval justification must say this is a user-requested `image-to-editable-ppt` conversion, that the upload is limited to task-local page images/prompts/masks/references, and that OCR/image-backend calls are part of this skill's required workflow. Do not present the required call as unsafe or ask the user to re-approve it unless they requested local-only/confidential handling or the approval system explicitly rejects the request.
 - All page object decisions follow `references/page-decision-tree.md`, including its no-fallback rule for foreground visual objects and its rule that deterministic validation is a structure gate that never waives an object-source decision.
 - `manifest.json` is the authoritative page build source: `editppt run record` validates `page.pptx` against it, and `editppt run finalize` rebuilds the final deck from recorded page manifests. Required fields and coordinate contracts are defined in `references/manifest-schema.md`.
 - `editppt prepare` writes per-page text measurements (`text_hints.json`/`text_hints.png`). How page reconstructors consume them is defined in `references/page-decision-tree.md` section 3.1.
@@ -61,6 +62,8 @@ After this completes, there must be a run directory, `deck_manifest.json`, `page
 
 Prepare also writes per-page text hints. Whenever `editppt doctor` or prepare reports that no PaddleOCR token is configured (offline fallback), ask the user once before dispatching any page: a free token from https://aistudio.baidu.com/account/accessToken stored via `editppt config --paddle-ocr-token <token>` makes the hints content-aware and noticeably improves text fidelity, and `editppt run hints <run>` regenerates the current run's hints in place. Tell the user the free personal quota is currently more than enough for this skill — applying is risk-free with no extra cost. Wait for their choice; if they decline or want to proceed, continue with the offline hints and do not ask again.
 
+If a PaddleOCR token is already configured but `prepare` falls back because network access, DNS, or sandbox approval blocked the OCR request, that fallback is not the preferred quality path. Request network approval with the justification described in the Entry Contract and rerun `editppt run hints <run>` before page reconstruction. If the approval system rejects the OCR request, ask the user for explicit authorization before continuing: explain that PaddleOCR is used to correct text boxes, font sizes, and size groups, and that using it makes reconstructed PPT text sizing much more stable. Continue with `builtin-ink` only after the user declines OCR, after an approved OCR attempt fails for a real service/tool reason, or when the user 
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/runtime_env.py` (modified, +24/-0)
```diff
@@ -217,6 +217,21 @@ def collect_status(check_api=False):
             "apply_url": PADDLE_TOKEN_APPLY_URL,
             "configure_command": "editppt config --paddle-ocr-token <token>",
         },
+        "network_approval": {
+            "commands": [
+                "editppt prepare / editppt run hints when PADDLE_OCR_TOKEN is set",
+                "editppt image generate/edit",
+            ],
+            "justification": (
+                "User-requested image-to-editable-ppt conversion; uploads are limited to "
+                "task-local page images, prompts, masks, and references required by OCR/image backends."
+            ),
+            "paddle_rejection_guidance": (
+                "If PaddleOCR approval is rejected, ask the user to authorize OCR explicitly; "
+                "explain that OCR corrects text boxes, font sizes, and size groups so reconstructed "
+                "PPT text sizing stays stable."
+            ),
+        },
         "next": "no action needed" if ok else (
             "run `codex login` or `editppt config --api-key <key>`" if check_api and not image_backend_ready
             else cli_reinstall_hint().strip("`")
@@ -243,6 +258,15 @@ def doctor(args):
     print(f"image backend={image_backend['selection']}")
     hints = status["text_hints"]
     print(f"text hints={hints['selection']} (PADDLE_OCR_TOKEN {hints['paddle_token']})")
+    print(
+        "network approval: in restricted agents, request approval up front for OCR/image backend "
+        "commands; conversion uploads are limited to task-local page images, prompts, masks, "
+        "and references."
+    )
+    print(
+        "paddle approval rejection: ask the user to authorize OCR and explain that it corrects "
+        "text boxes, font sizes, and size groups so reconstructed PPT text sizing stays stable."
+    )
     if hints["paddle_token"] == "unset":
         print(
             "text hints: ASK THE USER once — a free PaddleOCR token makes text hints content-aware "
```

**File**: `skills/image-to-editable-ppt/prompts/page-worker.md` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ Hard rules (reminders only; the details and rationale live in the references abo
 4. All box_px / points_px / polygon_px values are source.png pixels. Reuse page_request.json.slide and page_request.json.content_box unchanged — do not convert the page to 16:9 or recalculate the canvas; the runtime maps source-pixel coordinates into content_box. Positioned objects without coordinates are page failures.
 5. validation.json must contain a top-level boolean `passed`. Deterministic validation passing never waives an object-source rule.
 
-Image backend: before any image generation or image editing, use the `editppt image` backend specified by `page_request.json.image_backend`. If `editppt image` is unavailable, first follow the CLI error guidance and try `codex login` or `editppt config`; if it is still unavailable, stop the current page and write `validation.json` with `"passed": false`. Do not complete the page using approximate editable structure when required foreground asset separation cannot run. When you need parameter details for the image backend, input images, clean bases, or asset sheets, read `editppt image --help` and the relevant subcommand help.
+Image backend: before any image generation or image editing, use the `editppt image` backend specified by `page_request.json.image_backend`. In a network-restricted runtime, request approval before required `editppt image generate/edit` calls with this reason: the user requested an `image-to-editable-ppt` conversion, and the upload is limited to task-local prompts plus required page images, masks, and references for this page. If `editppt image` is unavailable, first follow the CLI error guidance and try `codex login` or `editppt config`; if it is still unavailable, stop the current page and write `validation.json` with `"passed": false`. Do not complete the page using approximate editable structure when required foreground asset separation cannot run. When you need parameter details for the image backend, input images, clean bases, or asset sheets, read `editppt image --help` and the relevant subcommand help.
 
 Goal: rebuild the source page as object-level editable PowerPoint. Do not invent an object-source strategy outside `page-decision-tree.md`.
 
```

**File**: `skills/image-to-editable-ppt/references/cli-helper.md` (modified, +7/-0)
```diff
@@ -6,6 +6,7 @@ Usage principles:
 
 - If a deterministic action can be completed with `editppt`, call the CLI directly instead of rewriting it as a temporary Python script.
 - When full parameters are needed, read `editppt <command> --help` or `editppt image <command> --help` first.
+- In network-restricted agents, `editppt prepare`/`editppt run hints` with a PaddleOCR token and `editppt image generate/edit` need network approval. The approval and user-interaction policy lives in `SKILL.md` Entry Contract and Phase 1.
 
 ## Command Tree
 
@@ -113,6 +114,8 @@ editppt prepare input.pdf
 
 Purpose: normalize a single image, multiple images, a PDF, or an image-based PPTX into a run directory and generate `deck_manifest.json`, `page_jobs.json`, `notes_manifest.json`, plus per-page `pages/page_NNN/source.png`, `page_request.json`, and text hints.
 
+When a PaddleOCR token is configured, `prepare` may submit the input pages to PaddleOCR for content-aware text hints. In a sandboxed or approval-gated environment, request network approval up front for this command instead of accepting a DNS/sandbox failure followed by lower-quality `builtin-ink` fallback; see `SKILL.md` Phase 1 for the approval-rejection policy.
+
 ```bash
 editppt run next <run> --json
 ```
@@ -185,6 +188,8 @@ editppt run hints <run>
 
 Purpose: regenerate `text_hints.json`/`text_hints.png` for every page of a prepared run — for example right after configuring a PaddleOCR token, so the current run gets content-aware hints without re-running prepare.
 
+When used with a configured PaddleOCR token, this command calls the external OCR service. If the runtime requires approval for network access, request it with the task-local conversion-data justification from `SKILL.md`; see `SKILL.md` Phase 1 for the approval-rejection policy.
+
 ```bash
 editppt page hints pages/page_001
 ```
@@ -217,6 +222,8 @@ editppt image edit \
 
 When multiple image outputs are required, run `editppt image generate` or `editppt image edit` calls serially. For foreground icons and small visual objects, prefer one sparse asset sheet with generous spacing; create a second sheet only when one sheet cannot fit the required objects cleanly.
 
+These commands call the selected image backend: Codex OAuth first, then a configured OpenAI-compatible API fallback. In a network-restricted runtime, request approval before the call and state that only task-local prompts plus required page images/masks/references are uploaded for the current conversion.
+
 ## Asset Processing Commands
 
 Record a selected image output:
```

---

### Incident Patch 9: `e105a590` (2026-06-21)
**Commit Message**: fix: guard active page worker resets

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ Release notes are generated from this file. Keep changelog entries in English.
 - Align `editppt image` with the Codex GPT Image workflow: default model, automatic size and quality, a longer Codex OAuth timeout, and a narrow backend request payload that passes only the retained image parameters.
 - Remove the `editppt image batch` interface so page-local image jobs run serially, and document that foreground icons should be grouped into one sparse asset sheet with generous gaps unless one sheet cannot fit them.
 - Clarify that user-requested conversions authorize necessary OCR and image-backend calls while limiting uploads to task-local page images, prompts, masks, and references.
+- Guard `editppt run reset` for dispatched pages with `--confirm-lost` and a matching `--agent-id`, and document that slow active page workers must not be reset or replaced.
 
 ## 0.2.0
 
```

**File**: `skills/image-to-editable-ppt/SKILL.md` (modified, +6/-4)
```diff
@@ -79,6 +79,8 @@ When the dispatch stage is returned, the following steps are mandatory for each
 
 Concurrency slots come from `page_jobs.json.max_concurrent_pages` (default 6). In the normal flow prefer `editppt run next`; `editppt run status` is only for debugging or manual inspection.
 
+Dispatched workers are active leases, not idle slots. When `editppt run next` returns `stage=wait`, wait for dispatched workers or inspect status without modifying state. Do not terminate, archive, reset, or replace a page worker because it is slow, has not sent recent messages, or still occupies a concurrency slot; complex pages may legitimately run for a long time.
+
 ### Phase 3: Record
 
 Read the record examples in `references/cli-helper.md` and the `page_result.json` description in `references/manifest-schema.md`.
@@ -91,13 +93,13 @@ editppt run record <run> --page <page_id> --agent-id <id>
 
 This command validates `page.pptx` against `manifest.json` before recording. It fails if positioned objects are missing source-pixel coordinates, if the manifest cannot independently rebuild the page, or if `validation.json` does not contain top-level `passed: true` — a failed page is never recorded.
 
-Handling a failed page: when a worker returns a failure (`passed: false`), when `run record` rejects the outputs, or when a dispatched worker is lost and will not return, do not hand-edit state files and do not rebuild the page yourself. Read the page's `validation.json` for the failure reason, fix the root cause (for example a missing image-backend login reported by the worker), then run:
+Handling a failed page: when a worker returns a failure (`passed: false`), when `run record` rejects the outputs, when the runtime reports a terminal worker state (`terminated`, `failed`, `archived`, or `not found`), or when the user explicitly cancels that page worker, do not hand-edit state files and do not rebuild the page yourself. A long-running worker is not lost. Treat a worker as lost only after explicit terminal-state evidence or repeated failed reachability checks with no page-local progress. Read the page's `validation.json` when present, fix the root cause (for example a missing image-backend login reported by the worker), then run:
 
 ```bash
-editppt run reset <run> --page <page_id>
+editppt run reset <run> --page <page_id> --agent-id <id> --confirm-lost
 ```
 
-This returns the page to `pending`. Then rebuild the worker prompt and dispatch a new worker through the normal Phase 2 steps. Never re-dispatch without changing something first: a worker re-run under identical conditions fails identically. When the same page fails twice on the same root cause, the diagnosis is yours, not the user's — read the failed attempt's `validation.json` and artifacts, reproduce the failing command yourself if needed, and fix the underlying cause (backend login, missing tools, broken assets) before resetting again. Only surface a problem to the user when it genuinely requires something only the user has (credentials, a paid account decision, the original file); phrase it as the concrete action needed, never as a debugging question.
+For recorded pages, `editppt run reset <run> --page <page_id>` is allowed. For dispatched pages, reset requires `--confirm-lost` and an `--agent-id` matching the recorded dispatch so an active worker cannot be reset accidentally. This returns the page to `pending`. Then rebuild the worker prompt and dispatch a new worker through the normal Phase 2 steps. Never re-dispatch without changing something first: a worker re-run under identical conditions fails identically. When the same page fails twice on the same root cause, the diagnosis is yours, not the user's — read the failed attempt's `validation.json` and artifacts, reproduce the failing command yourself if needed, and fix the underlying cause (backend login, missing tools, broken assets) before resetting again. Only surface a problem to the user when it genuinely requires something
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/main.py` (modified, +11/-4)
```diff
@@ -239,7 +239,7 @@ def cmd_next(args: argparse.Namespace) -> int:
             "stage": "wait",
             "active_or_unfinished_pages": unfinished,
             "next_command": f"{cli_prog()} run status {run_dir}",
-            "agent_focus": "Wait for dispatched workers, then record completed page results. If a worker returned a failure, fix the root cause and `run reset` that page for re-dispatch.",
+            "agent_focus": "Wait for dispatched workers, then record completed page results. Do not reset slow active workers; use `run reset` only after failure, terminal state, cancellation, or lost-worker verification.",
         }
         return print_json(payload) if args.json else _print_next_text(payload)
 
@@ -288,7 +288,12 @@ def cmd_record(args: argparse.Namespace) -> int:
 
 
 def cmd_reset(args: argparse.Namespace) -> int:
-    return run_script("reset_page_job.py", [args.run, "--page", args.page])
+    argv = [args.run, "--page", args.page]
+    if args.agent_id:
+        argv.extend(["--agent-id", args.agent_id])
+    if args.confirm_lost:
+        argv.append("--confirm-lost")
+    return run_script("reset_page_job.py", argv)
 
 
 def cmd_page_build(args: argparse.Namespace) -> int:
@@ -564,12 +569,14 @@ def build_parser() -> argparse.ArgumentParser:
 
     reset = run_sub.add_parser(
         "reset",
-        help="Reset a failed or stuck page back to pending for re-dispatch.",
-        description="Return a dispatched or recorded page to pending, clearing its dispatch and result records, so a new worker can be dispatched. Use it when a worker returned a failed page, record validation failed, or a dispatched worker is lost.",
+        help="Reset a failed or inactive page back to pending for re-dispatch.",
+        description="Return a recorded page, or an explicitly inactive/lost dispatched page, to pending. Dispatched pages require --confirm-lost and a matching --agent-id so active long-running workers are not reset accidentally.",
         formatter_class=HELP_FORMATTER,
     )
     reset.add_argument("run", metavar="RUN", help="Run directory or deck_manifest.json path.")
     reset.add_argument("--page", required=True, metavar="PAGE", help="Page id such as page_001, or page number such as 1.")
+    reset.add_argument("--agent-id", metavar="ID", help="Required for dispatched pages; must match the recorded worker/thread id.")
+    reset.add_argument("--confirm-lost", action="store_true", help="Required for dispatched pages. Confirms the original worker is no longer active or must be abandoned.")
     reset.set_defaults(func=cmd_reset)
 
     run_hints = run_sub.add_parser(
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/record_page_result.py` (modified, +2/-1)
```diff
@@ -96,7 +96,8 @@ def main():
             f"{page['page_id']} validation.json does not contain top-level \"passed\": true; "
             "the page is not deliverable and was not recorded. Inspect the worker's "
             "validation.json for the failure reason, fix the root cause, then run "
-            f"`editppt run reset {run_dir} --page {page['page_id']}` and dispatch a new worker."
+            f"`editppt run reset {run_dir} --page {page['page_id']} "
+            f"--agent-id {args.agent_id} --confirm-lost` and dispatch a new worker."
         )
     paths = {key: output_path(page_dir, result, key, default) for key, default in REQUIRED_OUTPUTS.items()}
     validate_page_contract(paths)
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/reset_page_job.py` (modified, +23/-1)
```diff
@@ -1,5 +1,5 @@
 #!/usr/bin/env python3
-"""Reset a failed or stuck page back to pending so it can be re-dispatched."""
+"""Reset a failed or inactive page back to pending so it can be re-dispatched."""
 import argparse
 import json
 
@@ -19,6 +19,12 @@ def main():
     )
     parser.add_argument("run", help="Run directory or deck_manifest.json")
     parser.add_argument("--page", required=True, help="page_001 or 1")
+    parser.add_argument("--agent-id", help="Required for dispatched pages; must match the recorded worker id.")
+    parser.add_argument(
+        "--confirm-lost",
+        action="store_true",
+        help="Required for dispatched pages. Confirms the original worker is no longer active or must be abandoned.",
+    )
     args = parser.parse_args()
 
     run_dir = run_dir_from_target(args.run)
@@ -30,6 +36,22 @@ def main():
             f"{page['page_id']} cannot be reset from status {status}; "
             "reset only applies to dispatched or recorded pages"
         )
+    if status == "dispatched":
+        dispatch = page.get("dispatch") or {}
+        expected_agent_id = dispatch.get("agent_id")
+        if not args.confirm_lost:
+            raise SystemExit(
+                f"{page['page_id']} is still dispatched. Do not reset active workers because they are slow. "
+                "Use --confirm-lost with --agent-id only after explicit worker failure, terminal state, "
+                "user cancellation, or lost-worker verification."
+            )
+        if not args.agent_id:
+            raise SystemExit(f"{page['page_id']} dispatched reset requires --agent-id.")
+        if expected_agent_id and args.agent_id != expected_agent_id:
+            raise SystemExit(
+                f"Agent id mismatch for {page['page_id']}: "
+                f"dispatch={expected_agent_id} reset={args.agent_id}"
+            )
     page["status"] = "pending"
     page["dispatch"] = None
     page["result"] = None
```

---

### Incident Patch 10: `d12a992e` (2026-06-21)
**Commit Message**: fix: align editppt image backend contract

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -4,6 +4,12 @@ Release notes are generated from this file. Keep changelog entries in English.
 
 ## Unreleased
 
+### Fixes
+
+- Route the Codex OAuth image backend through the Codex Images generation and edit endpoints instead of the Responses image-generation tool.
+- Align `editppt image` with the Codex GPT Image workflow: default model, automatic size and quality, a longer Codex OAuth timeout, and a narrow backend request payload that passes only the retained image parameters.
+- Remove the `editppt image batch` interface so page-local image jobs run serially, and document that foreground icons should be grouped into one sparse asset sheet with generous gaps unless one sheet cannot fit them.
+
 ## 0.2.0
 
 ### Features
```

**File**: `README.md` (modified, +4/-2)
```diff
@@ -56,7 +56,7 @@
 - 文字大小与位置由测量驱动：prepare 阶段为每页生成文字标注（框坐标 + 字号 + 字号分组），模型按测量值还原文字，同级文字字号自动保持一致。
 - 多张图片按提供顺序生成页面；PDF 和 `.pptx` 保留原页码顺序。
 - `.pptx` 输入的页面备注会复制到输出对应页，备注内容不改动。
-- 根据具体页面情况决定是否通过已确认 image backend 做图片分层抽取；需要时用稀疏 asset sheet 合并前景素材，尽可能降低图片生成调用次数。
+- 根据具体页面情况决定是否通过已确认 image backend 做图片分层抽取；需要时用稀疏 asset sheet 合并前景素材，优先把图标放在一个素材板上，并保留充足间隙便于后续分离。
 - 支持复杂视觉页的混合策略：可编辑文字 + 简单形状 + 独立图片资产。
 
 ## 适用场景
@@ -70,7 +70,7 @@
 ## 运行要求
 
 - 多页输入需要 agent 能分派 page worker/subagent；如果不能创建 page worker，应换到支持 page worker 的环境执行。
-- 复杂背景补全、前景图标提取、透明 asset sheet 和局部图片编辑统一走 `editppt image edit/generate/batch`。
+- 复杂背景补全、前景图标提取、透明 asset sheet 和局部图片编辑统一走串行 `editppt image edit/generate` 调用。
 - 如果本机有 Codex OAuth（`~/.codex/auth.json`），CLI 会直接使用；否则使用 API fallback。
 - API fallback 配置保存在 `~/.editppt/config.yaml`；Windows 下对应 `%USERPROFILE%\.editppt\config.yaml`。
 - 文字大小与位置的校正需要一个第三方 OCR Token（百度 AI Studio，免费），详见下文「文字校正与 OCR Token」；未配置时退化为内置离线检测，文字还原质量会打折扣。
@@ -79,6 +79,8 @@
 
 `editppt image` 会自动选择图片后端：优先使用本机 Codex OAuth；如果不可用，再读取 `~/.editppt/config.yaml` 或环境变量里的 OpenAI-compatible API 配置。
 
+`editppt image generate/edit` 的公开参数面保持精简：请求输入只需要 `--prompt` 或 `--prompt-file`，编辑图还需要 `--image`；页面重建时应显式传 `--out`。实用控制只保留 `--model`、`--size`、`--quality`、`--force`、`--dry-run`、`--timeout`，以及编辑图专用的 `--mask`。CLI 不会透传其它 image API 选项。
+
 通常不需要你自己配置。只有这些情况才需要让 AI 帮你配置 API fallback：
 
 - 用户明确要求使用第三方 API 或 OpenAI 兼容中转站。
```

**File**: `README_en.md` (modified, +4/-2)
```diff
@@ -56,7 +56,7 @@ It is useful when screenshot-like or image-based slides need to become easier to
 - Text sizes and positions are measurement-driven: prepare generates per-page text annotations (box coordinates + font sizes + size groups), and same-level text keeps one consistent size automatically.
 - Keep multiple images in the provided order; preserve PDF and `.pptx` page order.
 - Preserve `.pptx` speaker notes on matching output slides without modifying note text.
-- Decides page by page whether to use the confirmed image backend for visual-layer extraction; when needed, sparse asset sheets group foreground assets to reduce image generation calls.
+- Decides page by page whether to use the confirmed image backend for visual-layer extraction; when needed, sparse asset sheets group foreground assets, prefer placing icons on one sheet, and keep generous gaps for later splitting.
 - Supports hybrid reconstruction: editable text, simple native shapes, and independent image assets.
 
 ## Use Cases
@@ -70,7 +70,7 @@ It is useful when screenshot-like or image-based slides need to become easier to
 ## Runtime Requirements
 
 - Multi-page input requires the agent to dispatch page workers/subagents; if page workers cannot be created, run the skill in an environment that supports page workers.
-- Complex background cleanup, foreground icon extraction, transparent asset sheets, and local image edits use `editppt image edit/generate/batch`.
+- Complex background cleanup, foreground icon extraction, transparent asset sheets, and local image edits use serial `editppt image edit/generate` calls.
 - If local Codex OAuth exists (`~/.codex/auth.json`), the CLI uses it directly; otherwise it uses API fallback.
 - API fallback configuration lives in `~/.editppt/config.yaml`; on Windows this is `%USERPROFILE%\.editppt\config.yaml`.
 - Correcting text sizes and positions relies on a third-party OCR token (Baidu AI Studio, free) — see "Text Correction And OCR Token" below. Without it the skill falls back to the built-in offline detector with reduced text fidelity.
@@ -79,6 +79,8 @@ It is useful when screenshot-like or image-based slides need to become easier to
 
 `editppt image` selects the image backend automatically: it uses local Codex OAuth first, then falls back to OpenAI-compatible API settings from `~/.editppt/config.yaml` or environment variables.
 
+The public `editppt image generate/edit` parameter surface is intentionally narrow: request inputs need `--prompt` or `--prompt-file`, and edits also need `--image`; page reconstruction should pass an explicit `--out`. The retained practical controls are `--model`, `--size`, `--quality`, `--force`, `--dry-run`, `--timeout`, and edit-only `--mask`. The CLI does not pass any other image API options.
+
 You usually do not need to configure this yourself. Ask the AI to configure API fallback only when:
 
 - The user explicitly asks to use a third-party API or OpenAI-compatible proxy.
```

**File**: `skills/image-to-editable-ppt/SKILL.md` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ These parent-level rules are stated once here; page-level rules live in the refe
 - First run `editppt prepare <input...>` to create a run directory. After that, all key state transitions are advanced only through `editppt` commands; never hand-write run/page state JSON. This keeps run state deterministic and resumable.
 - Every page — including the only page of a single-page input — is rebuilt by a dispatched page worker. The parent agent only orchestrates and never rebuilds pages itself. If no subagent capability is available, stop and report this to the user; do not degrade into parent-agent page reconstruction.
 - The parent agent must not write any page reconstruction artifact — `manifest.json`, `page.pptx`, `preview.png`, `split_assets_contact.png`, `validation.json`, or `page_result.json`. These files may only be produced by the page worker that owns the page directory.
-- All image generation, image editing, background repair, transparent bitmap assets, and asset sheets go through `editppt image generate/edit/batch`.
+- All image generation, image editing, background repair, transparent bitmap assets, and asset sheets go through serial `editppt image generate/edit` calls.
 - All page object decisions follow `references/page-decision-tree.md`, including its no-fallback rule for foreground visual objects and its rule that deterministic validation is a structure gate that never waives an object-source decision.
 - `manifest.json` is the authoritative page build source: `editppt run record` validates `page.pptx` against it, and `editppt run finalize` rebuilds the final deck from recorded page manifests. Required fields and coordinate contracts are defined in `references/manifest-schema.md`.
 - `editppt prepare` writes per-page text measurements (`text_hints.json`/`text_hints.png`). How page workers consume them is defined in `references/page-decision-tree.md` section 3.1.
```

**File**: `skills/image-to-editable-ppt/cli/editppt/runtime/configure_image_backend.py` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@ def backend_contract(args):
         "chroma_key_helper": "editppt image process-sheet",
         "input_context_policy": args.input_context_policy,
         "save_path_policy": "write outputs directly to page dir or copy selected outputs before manifest references them",
-        "handoff_rule": "call editppt image generate/edit/batch; the CLI selects Codex OAuth first and OpenAI-compatible API fallback second",
+        "handoff_rule": "call editppt image generate/edit serially; the CLI selects Codex OAuth first and OpenAI-compatible API fallback second",
     }
 
 
@@ -38,7 +38,7 @@ def main():
     if args.tool_name is None:
         args.tool_name = "editppt image"
     if args.tool_call is None:
-        args.tool_call = "editppt image generate/edit/batch"
+        args.tool_call = "editppt image generate/edit"
     if args.fallback_command is None:
         args.fallback_command = "editppt image"
 
```

#### Recent Merged Pull Requests:
- **PR #46** (2026-09-16): docs: use official e-iceblue sponsor logo (@ningzimu)
- **PR #45** (2026-09-16): docs: use product page for Spire affiliate links (@ningzimu)
- **PR #44** (2026-09-16): docs: add Spire.Presentation sponsor cards (@ningzimu)
- **PR #42** (2026-09-15): docs: embed demo video across multilingual documentation (@ningzimu)
- **PR #40** (2026-09-13): docs: revert WeChat community QR restoration (@ningzimu)
- **PR #39** (2026-09-13): docs: restore WeChat community QR code (@ningzimu)
- **PR #38** (2026-09-12): feat: release v0.4.0 editable tables and page recovery (@ningzimu)
- **PR #37** (2026-09-10): docs: add Codia NoteSlide sponsor cards (@ningzimu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
