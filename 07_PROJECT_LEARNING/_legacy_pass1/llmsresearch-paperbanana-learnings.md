# Forensic Learning Record (Deep Inspection): llmsresearch/paperbanana

> **Canonical Artifact**: `07_PROJECT_LEARNING/llmsresearch-paperbanana-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/llmsresearch/paperbanana](https://github.com/llmsresearch/paperbanana))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:47:02.845Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `llmsresearch/paperbanana`
- **Description**: Open source implementation and extension of Google Research’s PaperBanana for automated academic figures, diagrams, and research visuals, expanded to new domains like slide generation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2386 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `debug_pipeline_run.py`
```
import asyncio

from PIL import Image

from paperbanana.core.pipeline import PaperBananaPipeline
from paperbanana.core.types import DiagramType, GenerationInput


# -------- Fake VLM --------
class FakeVLM:
    name = "fake-vlm"
    model_name = "fake-model"

    async def generate(self, *args, **kwargs):
        return "fake response"


# -------- Fake Image Generator --------
class FakeImageGen:
    async def generate(self, prompt=None, output_path=None, iteration=None, seed=None, **kwargs):
        iteration = iteration or 1  # fallback to 1 if None
        img = Image.new("RGB", (256, 256), color=(iteration * 40 % 256, 100, 150))
        return img


async def main():
    pipeline = PaperBananaPipeline(vlm_client=FakeVLM(), image_gen_fn=FakeImageGen())

    inp = GenerationInput(
        source_context="A neural network with input, hidden and output layers.",
        communicative_intent="Explain feedforward architecture",
        diagram_type=DiagramType.METHODOLOGY,
        raw_data=None,
    )

    output = await pipeline.generate(inp)

    print("TIMING FOUND:")
    print(output.metadata["timing"])


asyncio.run(main())

```

### Core Architecture Module: `examples/generate_diagram.py`
```
"""Example: Generate a methodology diagram from text."""

import asyncio

from dotenv import load_dotenv

from paperbanana import DiagramType, GenerationInput, PaperBananaPipeline
from paperbanana.core.config import Settings

load_dotenv()


async def main():
    # Example methodology text
    source_context = """
    Our framework, PaperBanana, automates the generation of publication-quality
    academic illustrations through a multi-agent pipeline. The system takes as input
    a methodology section (S) and a figure caption (C).

    Phase 1 - Linear Planning:
    1. The Retriever agent selects the top-10 most relevant reference examples from
       a curated set of high-quality diagrams.
    2. The Planner agent uses in-context learning from these examples to generate
       a detailed textual description (P) of the target diagram.
    3. The Stylist agent refines the description to optimize visual aesthetics (P*).

    Phase 2 - Iterative Refinement:
    4. The Visualizer agent renders the description into an image using a
       text-to-image generation model.
    5. The Critic agent evaluates the image on faithfulness, conciseness,
       readability, and aesthetics, providing targeted revision feedback.
    6. Steps 4-5 repeat for up to 3 iterations until quality is satisfactory.
    """

    caption = (
        "Overview of the PaperBanana multi-agent framework for automated "
        "academic illustration generation."
    )

    settings = Settings(
        vlm_provider="gemini",
        vlm_model="gemini-2.0-flash",
        image_provider="google_imagen",
        image_model="gemini-3-pro-image-preview",
        refinement_iterations=2,
    )

    # Create pipeline and generate
    pipeline = PaperBananaPipeline(settings=settings)

    result = await pipeline.generate(
        GenerationInput(
            source_context=source_context,
            communicative_intent=caption,
            diagram_type=DiagramType.METHODOLOGY,
        )
    )

    print(f"Generated diagram: {result.image_path}")
    print(f"Total iterations: {len(result.iterations)}")
    print(f"Run ID: {result.metadata.get('run_id')}")


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/generate_plot.py`
```
"""Example: Generate a statistical plot from data."""

import asyncio

from dotenv import load_dotenv

from paperbanana import DiagramType, GenerationInput, PaperBananaPipeline
from paperbanana.core.config import Settings

load_dotenv()


async def main():
    # Example: model performance comparison
    source_context = """
    Table 1: Performance comparison of different models on three benchmarks.

    | Model     | MMLU  | HellaSwag | ARC-C |
    |-----------|-------|-----------|-------|
    | GPT-4o    | 88.7  | 95.3      | 96.4  |
    | Claude 3  | 86.8  | 93.7      | 93.5  |
    | Gemini    | 85.0  | 87.8      | 89.8  |
    | Llama 3   | 79.2  | 82.0      | 83.4  |
    | Mistral   | 75.3  | 81.4      | 78.6  |
    """

    raw_data = {
        "models": ["GPT-4o", "Claude 3", "Gemini", "Llama 3", "Mistral"],
        "MMLU": [88.7, 86.8, 85.0, 79.2, 75.3],
        "HellaSwag": [95.3, 93.7, 87.8, 82.0, 81.4],
        "ARC-C": [96.4, 93.5, 89.8, 83.4, 78.6],
    }

    caption = "Performance comparison of frontier LLMs across three benchmarks."

    settings = Settings(
        vlm_provider="gemini",
        refinement_iterations=2,
    )

    pipeline = PaperBananaPipeline(settings=settings)

    result = await pipeline.generate(
        GenerationInput(
            source_context=source_context,
            communicative_intent=caption,
            diagram_type=DiagramType.STATISTICAL_PLOT,
            raw_data=raw_data,
        )
    )

    print(f"Generated plot: {result.image_path}")


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/tikz_export.py`
```
"""End-to-end TikZ export example.

Demonstrates three usage patterns:

1. Generate a methodology diagram and export TikZ in a single pipeline run.
2. Export TikZ from an already-generated image (post-hoc, via the `tikz` CLI
   command or the TikZExporterAgent API directly).
3. Export PGFPlots from a generated statistical plot.

Run any section independently — each is guarded by a ``# --- `` comment.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

# ---------------------------------------------------------------------------
# Pattern 1: Generate + export TikZ in one pipeline run
# ---------------------------------------------------------------------------
# CLI equivalent:
#   paperbanana generate \
#     --input examples/sample_inputs/transformer_method.txt \
#     --caption "Overview of our Transformer encoder architecture" \
#     --export-tikz
#
# The pipeline saves:
#   outputs/<run_id>/final_output.png   ← raster image
#   outputs/<run_id>/final_output.tex   ← TikZ source (new)


async def generate_with_tikz_export(
    input_path: str = "examples/sample_inputs/transformer_method.txt",
    caption: str = "Overview of our Transformer encoder architecture",
) -> None:
    """Run the full pipeline and export TikZ alongside the PNG."""
    from dotenv import load_dotenv

    load_dotenv()

    from paperbanana.core.config import Settings
    from paperbanana.core.pipeline import PaperBananaPipeline
    from paperbanana.core.types import DiagramType, GenerationInput

    settings = Settings(export_tikz=True)

    gen_input = GenerationInput(
        source_context=Path(input_path).read_text(encoding="utf-8"),
        communicative_intent=caption,
        diagram_type=DiagramType.METHODOLOGY,
    )

    pipeline = PaperBananaPipeline(settings=settings)
    result = await pipeline.generate(gen_input)

    print(f"Image : {result.image_path}")
    print(f"TikZ  : {result.tikz_path}")


# ---------------------------------------------------------------------------
# Pattern 2: Post-hoc export from an existing image
# ---------------------------------------------------------------------------
# CLI equivalent:
#   paperbanana tikz \
#     --input outputs/my_run/final_output.png \
#     --source-context examples/sample_inputs/transformer_method.txt \
#     --caption "Overview of our Transformer encoder architecture"


async def export_existing_image(
    image_path: str,
    source_context_path: str = "",
    caption: str = "",
    output_tex: str = "",
) -> str:
    """Convert an existing generated image to TikZ source.

    Args:
        image_path: Path to the PNG/JPEG image to convert.
        source_context_path: Optional path to the methodology text file.
        caption: Optional figure caption for context.
        output_tex: Where to write the .tex file (defaults to same dir as image).

    Returns:
        Path to the saved .tex file.
    """
    from dotenv import load_dotenv

    load_dotenv()

    from paperbanana.agents.tikz_exporter import TikZExporterAgent
    from paperbanana.core.config import Settings
    from paperbanana.core.types import DiagramType
    from paperbanana.providers.registry import ProviderRegistry

    settings = Settings()
    vlm = ProviderRegistry.create_vlm(settings)
    agent = TikZExporterAgent(vlm)

    context_text = ""
    if source_context_path:
        context_text = Path(source_context_path).read_text(encoding="utf-8")

    tikz_source = await agent.run(
        image_path=image_path,
        source_context=context_text,
        caption=caption,
        diagram_type=DiagramType.METHODOLOGY,
        venue=settings.venue,
    )

    tex_path = Path(output_tex) if output_tex else Path(image_path).with_suffix(".tex")
    tex_path.write_text(tikz_source, encoding="utf-8")
    print(f"TikZ source saved to: {tex_path}")
    return str(tex_path)


# ---------------------------------------------------------------------------
# Pattern 3: Generate a statistical plot and export PGFPlots
# ---------------------------------------------------------------------------
# CLI equivalent:
#   paperbanana plot \
#     --data examples/sample_data/benchmark_slice.csv \
#     --intent "Accuracy vs. model size across four baselines" \
#     --export-pgfplots


async def generate_plot_with_pgfplots(
    data_path: str = "examples/sample_data/benchmark_slice.csv",
    intent: str = "Accuracy vs. model size across four baselines",
) -> None:
    """Run the plot pipeline and export PGFPlots markup alongside the PNG."""
    from dotenv import load_dotenv

    load_dotenv()

    from paperbanana.core.config import Settings
    from paperbanana.core.pipeline import PaperBananaPipeline
    from paperbanana.core.plot_data import load_statistical_plot_payload
    from paperbanana.core.types import DiagramType, GenerationInput

    source_context, raw_data = load_statistical_plot_payload(Path(data_path))

    settings = Settings(export_pgfplots=True)

    gen_input = GenerationInput(
        source_context=source_context,
        communicative_intent=intent,
        diagram_type=DiagramType.STATISTICAL_PLOT,
        raw_data={"data": raw_data},
    )

    pipeline = PaperBananaPipeline(settings=settings)
    result = await pipeline.generate(gen_input)

    print(f"Plot      : {result.image_path}")
    print(f"PGFPlots  : {result.tikz_path}")


# ---------------------------------------------------------------------------
# Main — run pattern 1 as a quick smoke-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    asyncio.run(generate_with_tikz_export())

```

### Core Architecture Module: `integrations/github-action/extract_section.py`
```
#!/usr/bin/env python3
"""Extract a LaTeX section body for PaperBanana.

Used by the PaperBanana GitHub Action to pull the methodology section out of a
paper's .tex source before figure generation. Stdlib only — runs standalone on
the Actions runner before paperbanana itself is needed.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

_SECTION_CMD = re.compile(r"\\section\*?\s*\{")
_END_DOCUMENT = re.compile(r"\\end\s*\{document\}")


def strip_comments(text: str) -> str:
    """Remove LaTeX comments (unescaped % to end of line), preserving \\%."""
    out_lines = []
    for line in text.splitlines():
        search_from = 0
        while True:
            idx = line.find("%", search_from)
            if idx == -1:
                out_lines.append(line)
                break
            backslashes = 0
            k = idx - 1
            while k >= 0 and line[k] == "\\":
                backslashes += 1
                k -= 1
            if backslashes % 2 == 0:
                out_lines.append(line[:idx])
                break
            search_from = idx + 1
    return "\n".join(out_lines)


def find_sections(text: str) -> list[dict]:
    """Locate every \\section{...} with brace-aware title parsing.

    Returns dicts with title, cmd_start (offset of the backslash) and
    body_start (offset just past the closing brace of the title).
    """
    sections = []
    for match in _SECTION_CMD.finditer(text):
        depth = 1
        i = match.end()
        while i < len(text) and depth > 0:
            char = text[i]
            if char == "\\":
                i += 2
                continue
            if char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
            i += 1
        title = text[match.end() : i - 1].strip()
        sections.append({"title": title, "cmd_start": match.start(), "body_start": i})
    return sections


def extract(text: str, section_name: str) -> str:
    """Return the body of the first section whose title contains section_name.

    Matching is case-insensitive. The body runs from the end of the section
    heading to the next \\section, \\end{document}, or end of file — whichever
    comes first — so subsections are included.
    """
    text = strip_comments(text)
    sections = find_sections(text)
    if not sections:
        raise LookupError("no \\section commands found in the file")

    needle = section_name.lower()
    chosen_idx = next(
        (i for i, s in enumerate(sections) if needle in s["title"].lower()),
        None,
    )
    if chosen_idx is None:
        available = ", ".join(repr(s["title"]) for s in sections)
        raise LookupError(f"no section matching {section_name!r}; available: {available}")

    chosen = sections[chosen_idx]
    if chosen_idx + 1 < len(sections):
        end = sections[chosen_idx + 1]["cmd_start"]
    else:
        end_doc = _END_DOCUMENT.search(text, chosen["body_start"])
        end = end_doc.start() if end_doc else len(text)

    body = text[chosen["body_start"] : end].strip()
    body = re.sub(r"\n{3,}", "\n\n", body)
    if not body:
        raise LookupError(f"section {chosen['title']!r} matched but its body is empty")
    return body


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tex", required=True, help="Path to the .tex source file")
    parser.add_argument(
        "--section",
        default="Method",
        help="Section title to extract (case-insensitive substring match)",
    )
    parser.add_argument("--out", required=True, help="Where to write the extracted text")
    args = parser.parse_args()

    tex_path = Path(args.tex)
    if not tex_path.is_file():
        print(f"error: tex file not found: {tex_path}", file=sys.stderr)
        return 1

    try:
        body = extract(tex_path.read_text(encoding="utf-8"), args.section)
    except LookupError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(body, encoding="utf-8")
    print(f"extracted {len(body)} chars from {tex_path} -> {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `mcp_server/server.py`
```
"""PaperBanana MCP Server.

Exposes PaperBanana's core functionality as MCP tools usable from
Claude Code, Cursor, or any MCP client.

Tools:
    generate_diagram    — Generate a methodology diagram from text
    continue_run        — Continue refinement for a prior diagram or plot run
    generate_plot       — Generate a statistical plot from JSON data
    continue_diagram    — Continue a prior methodology run (more refinement / feedback)
    continue_plot       — Continue a prior statistical-plot run
    evaluate_diagram    — Evaluate a generated diagram against a reference
    evaluate_plot       — Evaluate a generated plot against a reference
    download_references — Download the PaperBananaBench reference set (~298 examples)
    orchestrate_figures — Full-paper figure package (plan + optional generation)
    batch_diagrams      — Batch methodology diagrams from a YAML/JSON manifest
    batch_plots         — Batch statistical plots from a YAML/JSON manifest

Usage:
    paperbanana-mcp          # stdio transport (default)
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
from io import BytesIO
from pathlib import Path
from typing import Any

import structlog
from fastmcp import FastMCP
from fastmcp.utilities.types import Image
from PIL import Image as PILImage

from paperbanana.core.config import Settings
from paperbanana.core.pipeline import PaperBananaPipeline
from paperbanana.core.resume import load_resume_state
from paperbanana.core.types import DiagramType, GenerationInput
from paperbanana.core.utils import detect_image_mime_type, find_prompt_dir
from paperbanana.core.workflow_runner import (
    run_methodology_batch,
    run_orchestration_package,
    run_plot_batch,
)
from paperbanana.evaluation.judge import VLMJudge
from paperbanana.providers.registry import ProviderRegistry

logger = structlog.get_logger()

# Claude API enforces a 5 MB limit on base64-encoded images in tool results.
# Base64 inflates raw bytes by ~4/3, so we cap the raw file at 3.75 MB to
# stay safely under the wire.
_MAX_IMAGE_BYTES = int(os.environ.get("PAPERBANANA_MAX_IMAGE_BYTES", 3_750_000))


def _compress_for_api(image_path: str) -> tuple[str, str]:
    """Return *(effective_path, format)* for an image that fits the API limit.

    If the file at *image_path* already fits, returns it as-is.  Otherwise the
    image is re-saved as optimised JPEG (which is dramatically smaller for the
    photographic output typical of AI image generators) next to the original.

    Raises ``ValueError`` if the image cannot be compressed below the limit
    after all quality and resize attempts.
    """
    raw_size = Path(image_path).stat().st_size
    mime = detect_image_mime_type(image_path)
    fmt = mime.split("/")[1]  # e.g. "png", "jpeg"

    if raw_size <= _MAX_IMAGE_BYTES:
        # Ensure file extension matches actual image format to prevent
        # MIME type mismatch errors (e.g. JPEG data saved with .png extension).
        # The MCP Image class may infer MIME from the file extension, so a
        # mismatch causes the Anthropic API to reject the tool result.
        suffix = Path(image_path).suffix.lower()
        fmt_extensions = {
            "jpeg": {".jpg", ".jpeg"},
            "png": {".png"},
            "webp": {".webp"},
            "gif": {".gif"},
        }
        valid_exts = fmt_extensions.get(fmt, set())
        if valid_exts and suffix not in valid_exts:
            corrected_ext = ".jpg" if fmt == "jpeg" else f".{fmt}"
            corrected_path = str(Path(image_path).with_suffix(corrected_ext))
            shutil.copy2(image_path, corrected_path)
            logger.info(
                "Corrected file extension to match detected format",
                original=image_path,
                corrected=corrected_path,
                detected_format=fmt,
            )
            return corrected_path, fmt
        return image_path, fmt

    logger.info(
        "Image exceeds API size limit, compressing to JPEG",
        original_bytes=raw_size,
        limit=_MAX_IMAGE_BYTES,
    )

    img = PILImage.open(image_path)
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGB")

    compressed_path = str(Path(image_path).with_suffix(".mcp.jpg"))

    # Try quality 85 first; fall back to progressively lower quality.
    for quality in (85, 70, 50):
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=quality, optimize=True)
        if buf.tell() <= _MAX_IMAGE_BYTES:
            Path(compressed_path).write_bytes(buf.getvalue())
            logger.info(
                "Compressed image saved",
                quality=quality,
                compressed_bytes=buf.tell(),
            )
            return compressed_path, "jpeg"

    # Last resort: scale down.
    for scale in (0.75, 0.5, 0.25):
        resized = img.resize(
            (int(img.width * scale), int(img.height * scale)),
            PILImage.LANCZOS,
        )
        buf = BytesIO()
        resized.save(buf, format="JPEG", quality=70, optimize=True)
        if buf.tell() <= _MAX_IMAGE_BYTES:
            Path(compressed_path).write_bytes(buf.getvalue())
            logger.info(
                "Resized and compressed image saved",
                scale=scale,
                compressed_bytes=buf.tell(),
            )
            return compressed_path, "jpeg"

    raise ValueError(
        f"Image at {image_path} ({raw_size} bytes) could not be "
        f"compressed below the {_MAX_IMAGE_BYTES} byte API limit."
    )


def _embed_caption(image_path: str, caption: str) -> None:
    """Embed a caption into a PNG image's tEXt metadata chunk.

    This preserves the MCP return type (always ``Image``) while making
    the caption accessible to any client that reads PNG metadata.
    Non-PNG files or write errors are silently ignored.
    """
    try:
        from PIL.PngImagePlugin import PngInfo

        img = PILImage.open(image_path)
        if img.format != "PNG":
            return
        meta = PngInfo()
        # Carry over existing text chunks
        existing = img.info or {}
        for k, v in existing.items():
            if isinstance(v, str):
                meta.add_text(k, v)
        meta.add_text("Caption", caption)
        img.save(image_path, pnginfo=meta)
    except Exception:
        logger.debug("Failed to embed caption in image metadata")


mcp = FastMCP("PaperBanana")


def _validate_input_images(input_images: list[str] | None) -> list[str]:
    """Validate user-provided reference/sketch image paths before the pipeline starts.

    Each path must exist and be a PIL-openable raster image.

    Raises:
        ValueError: If a path is missing or not a valid raster image.
    """
    validated: list[str] = []
    for image_path in input_images or []:
        path = Path(image_path)
        if not path.is_file():
            raise ValueError(f"Image file not found: {image_path}")
        try:
            with PILImage.open(path) as im:
                im.verify()
        except Exception:
            raise ValueError(f"Not a valid raster image (e.g. PNG, JPEG, WebP): {image_path}")
        validated.append(str(path))
    return validated


@mcp.tool
async def generate_diagram(
    source_context: str,
    caption: str,
    iterations: int = 3,
    aspect_ratio: str | None = None,
    optimize: bool = False,
    auto_refine: bool = False,
    generate_caption: bool = False,
    input_images: list[str] | None = None,
) -> Image:
    """Generate a publication-quality methodology diagram from text.

    Args:
        source_context: Methodology section text or relevant paper excerpt.
        caption: Figure caption describing what the diagram should communicate.
        iterations: Number of refinement iterations (default 3, used when auto_refine=False).
        aspect_ratio: Target aspect ratio. Supported:
            1:1, 2:3, 3:2, 3:4, 4:3, 9:16, 16:9, 21:9. Default: landscape.
        optimize: Enric
```

### Core Architecture Module: `paperbanana/__init__.py`
```
"""PaperBanana: Agentic framework for automated academic illustration generation."""

import sys

if sys.platform == "win32":
    for _stream in (sys.stdout, sys.stderr):
        if hasattr(_stream, "reconfigure"):
            _stream.reconfigure(encoding="utf-8", errors="replace")

__version__ = "0.3.0"

from paperbanana.core.pipeline import PaperBananaPipeline
from paperbanana.core.types import DiagramType, GenerationInput, GenerationOutput

__all__ = [
    "PaperBananaPipeline",
    "DiagramType",
    "GenerationInput",
    "GenerationOutput",
]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #234** (2026-06-11): **[Bug]: 3 bench diagram entries skip import — Unicode filename normalization (NFD) mismatch**
  *Symptoms*: Found while verifying the dataset mirror (#233): ref_71, ref_284, ref_309 are skipped because their filenames contain U+2011/en-dash/U+200C; macOS zip extraction normalizes to NFD so the path_to_gt_image lookup misses. Fix: NFC-normalize both sides in _import_from_bench + regression test. Pre-existing, independent of the mirror.

- **Issue #227** (2026-06-11): **[CI]: test_full_bench_preserves_curated_entries hits live HuggingFace and flakes with 429**
  *Symptoms*: Observed on a docs-only PR (#226): `tests/test_data_manager.py::TestFullBenchMerge::test_full_bench_preserves_curated_entries` downloads `https://huggingface.co/datasets/dwzhu/PaperBananaBench/resolve/main/PaperBananaBench.zip` during CI and failed with `429 Too Many Requests` on windows-latest/3.10.  Tests that hit live network endpoints will flake under rate limiting and break unrelated PRs. Fix options, in preference order: 1. Mock the download (the sibling `TestDownloadCurated` tests already mock 404 handling — same pattern applies) 2. Mark it with a `network` pytest marker excluded by default in CI and run it on a schedule instead 3. At minimum, add retry-with-backoff on 429  Probably related to #200 (curated dataset download 404) — worth fixing both at the data-manager level together.

- **Issue #201** (2026-06-11): **[Bug]: Plot command requires image gen provider credentials even not used**
  *Symptoms*: ### What happened?  Plot only uses vlm provider. However, when triggering the command, it still validates if a GEMINI API Key exists for image gen.  ### Steps to reproduce  1. Do not set GOOGLE_API_KEY env. 2. Run the below command：`uv run paperbanana plot --data .\data.csv --intent "Model accuracy comparison"  --aspect-ratio 16:9  --vlm-provider openai`    ### Input used  ```bash uv run paperbanana plot --data .\data.csv --intent "Model accuracy comparison"  --aspect-ratio 16:9  --vlm-provider openai ```  ### Expected behavior  Should not validate if this api key exists and process the plot task  ### Actual output or error  ```text uv run paperbanana plot --data .\data.csv --intent "Model accuracy comparison"  --aspect-ratio 16:9  --vlm-provider openai                     ╭───────────────────────────────────────────╮ │ PaperBanana - Generating Statistical Plot │ │                                           │ │ Data: data.csv                            │ │ Intent: Model accuracy comparison         │ │ VLM: openai / gpt-5.5                     │ │ Iterations: 3                             │ ╰───────────────────────────────────────────╯ ╭────────────────────────────────────────── Traceback (most recent call last) ──────────────────────────────────────────╮ │ D:\test\cli.py:2039 in plot                                          │ │                                                                                                                       │ │   2036 │   │   pipeline = Pap
  **Post-Mortem & Fix Analysis**:
  > Thanks @xraywu. Confirmed — `paperbanana plot` should not require image-gen credentials since matplotlib handles the rendering.  PR #202 from you addresses this directly by introducing a `"none"` image provider that resolves to a `DummyImageGen` and skipping API-key validation for that branch. I've left review comments on the PR (mostly: please revert the unrelated README reformatting churn, and add tests for the new behaviour). Once those are addressed, it'll merge and close this.  Marking as `bug` confirmed; expect resolution via #202. 

- **Issue #200** (2026-06-11): **[Bug]: Curated dataset download returns 404**
  *Symptoms*: ### What happened?  It seemed that the curated dataset no longer exists from the original paperbanana repo.  ### Steps to reproduce  1.  Run `paperbanana data download --curated` 2. It will return 404   ### Input used  ```bash paperbanana data download --curated ```  ### Expected behavior  Curated dataset downloaded  ### Actual output or error  ```text PaperBanana — Downloading Curated Expansion                                                                                   2026-05-07 16:03:32 [info     ] Downloading curated expansion set...   ● Downloading curated expansion set...  Error: Failed to download curated expansion from https://huggingface.co/datasets/dwzhu/PaperBananaBench/resolve /main/CuratedExpansion.zip — the artifact may not be published yet. Original error: Client error '404 Not Found' for url      'https://huggingface.co/datasets/dwzhu/PaperBananaBench/resolv e/main/CuratedExpansion.zip' For more information check: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/404 ```  ### Operating system  Windows 11  ### Python version  3.12  ### PaperBanana version or commit hash  1d0ca44f90a8f2dfe6b22e55fd8d10d002e7e223
  **Post-Mortem & Fix Analysis**:
  > Thanks @xraywu. Acknowledging — this is a real regression. `paperbanana data download --curated` is hitting a 404, likely because the curated dataset URL we point at has moved or the upstream HuggingFace dataset path changed.  Will investigate the download source in `paperbanana/reference/` and either repoint to the current location or vendor a stable mirror. Tracking for the 0.2.0 release (#216).  In the meantime, the bundled reference set under `data/reference_sets/` ships with the library and is sufficient for the default workflow — the `--curated` expansion is opt-in extra references, so this 404 doesn't block normal usage. 
  > Root-caused. `CuratedExpansion.zip` was never published: the HF repo `dwzhu/PaperBananaBench` contains only `PaperBananaBench.zip` (alive, ~254 MB, verified today), and a walk of the repo's full commit history shows the expansion artifact never existed at any revision. The URL was added speculatively in #112 ('fetches and merges expansion when artifact is published') and the artifact never followed.  So this isn't a broken link to repoint — it's a hosting decision: publish `CuratedExpansion.zip` under a repo we control (an `llmsresearch` HF dataset or a GitHub release asset) and update `CURATED_EXPANSION_URL` in `paperbanana/data/manager.py`, or remove the `--curated` path until the artifact exists. Note `--auto-download-data` defaults to the curated path, so it 404s for every fresh cache today — it fails soft to the built-in reference set, which is why normal generation still works.  Keeping this open until the hosting call is made.

- **Issue #185** (2026-05-18): **[Bug]: Resume mode writes iteration images to the wrong run directory**
  *Symptoms*: ### What happened?  When resuming an existing run with `continue_run()`, new iteration images can be written into the wrong run directory.  `PaperBananaPipeline` creates `VisualizerAgent` during pipeline initialization and passes it the current run directory as `output_dir`. Later, `continue_run()` switches the pipeline to the resumed `run_id`, but the visualizer still keeps the old output directory it captured earlier. If the visualizer is called without an explicit `output_path`, it saves files into that stale directory instead of the resumed run folder.  This causes resumed artifacts to be split across different run directories.   ### Steps to reproduce  1. Run PaperBanana once and save outputs. 2. Create a new `PaperBananaPipeline` instance or use CLI resume mode. 3. Resume the previous run with `continue_run()`. 4. Let it generate at least one new iteration. 5. Check the saved `diagram_iter_*.png` or `plot_iter_*.png` path and compare it with the resumed run directory.   ### Input used  ```bash # Example CLI flow paperbanana generate --input paper.txt --caption "Architecture overview" paperbanana generate --continue-run <previous_run_id>    # Example Python flow pipeline = PaperBananaPipeline(settings=settings) result = await pipeline.continue_run(resume_state=state, additional_iterations=1) ```  ### Expected behavior  All new artifacts created during `continue_run()` should be saved inside the resumed run directory.  ### Actual output or error  ```text No exception is r

- **Issue #96** (2026-06-11): **[Bug]: OpenAI model not accepted**
  *Symptoms*: ### What happened?  I read PaperBanana supports multiple VLM and image generation providers, so I continued with my openai API keys. However, the script still reverts to gemini, and then errors.  Is OpenAI supported? Am I doing something wrong? Thanks much!  ### Steps to reproduce  See input used and output error  ### Input used  ```bash 1. installed using  `pip install paperbanana`  2. I setup .env: ` VLM_PROVIDER=openai IMAGE_PROVIDER=openai_imagen  OPENAI_API_KEY=the_real_API_key_not_shown_here OPENAI_BASE_URL=https://api.openai.com/v1 OPENAI_VLM_MODEL=gpt-5.4 OPENAI_IMAGE_MODEL=gpt-image-1.5 `  3. Next I run:   ` .\paperbanana generate --input method.txt --caption "Short version of the mechanism" ` ```  ### Expected behavior  _No response_  ### Actual output or error  ```text But I get:   ` ╭───────────────────────────────────────────────────╮ │ PaperBanana - Generating Methodology Diagram      │ │                                                   │ │ VLM: openai / gemini-2.0-flash                    │ │ Image: openai_imagen / gemini-3-pro-image-preview │ │ Iterations: 3                                     │ ╰───────────────────────────────────────────────────╯ 2026-03-12 13:59:55 [info     ] Creating VLM provider          model=gemini-2.0-flash provider=openai - Generating diagram...  [..]  ValueError: Unknown VLM provider: openai. Available: gemini, openrouter ` ```  ### Operating system  Windows 11  ### Python version  cpython-3.14-windows-x86_64-none  ### PaperBanana 
  **Post-Mortem & Fix Analysis**:
  > It works when I added a config.yaml as below.  So it is more a documentation error than a software bug.   vlm:   provider: openai           # openai, gemini, or openrouter   model: gpt-5.4  image:   provider: openai_imagen    # openai_imagen, google_imagen, or openrouter_imagen   model: gpt-image-1.5  pipeline:   num_retrieval_examples: 10   refinement_iterations: 3   # auto_refine: true        # Loop until critic is satisfied   # max_iterations: 30       # Safety cap for auto_refine mode   # optimize_inputs: true    # Preprocess inputs for better generation   output_resolution: "2k"  reference:   path: data/reference_sets  output:   dir: outputs   save_iterations: true   save_metadata: true  
  > This is fixed on main but hadn't shipped to PyPI, which is why `pip install paperbanana` (0.1.2, cut Feb 12) still rejected `openai` — OpenAI / Azure OpenAI provider support landed Feb 18 in 2ec154d, six days after the 0.1.2 release.  Verified on current main with your exact `.env` (`VLM_PROVIDER=openai`, `IMAGE_PROVIDER=openai_imagen`, `OPENAI_BASE_URL`, `OPENAI_VLM_MODEL`, `OPENAI_IMAGE_MODEL`): the registry routes to the OpenAI VLM with `gpt-5.4` and OpenAI image gen with `gpt-image-1.5`, and the startup banner shows the effective OpenAI models rather than the confusing `openai / gemini-2.0-flash` mix you saw.  Your `config.yaml` workaround is equivalent and fine to keep. Until 0.2.0 lands on PyPI you can install from source: `pip install git+https://github.com/llmsresearch/paperbanana`. Closing when 0.2.0 ships (imminent — tracked in #216).
  > v0.2.0 just shipped to PyPI with full OpenAI / Azure OpenAI support — `pip install -U paperbanana` and your original .env will work as-is. Verified against your exact configuration before release. Thanks for the report, and apologies this sat so long.

- **Issue #77** (2026-06-11): **[Bug]: UnicodeDecodeError: 'gbk' codec can't decode byte 0x9d in position 14655: illegal multibyte sequence**
  *Symptoms*: ### What happened?  After installed paperbanana using pip, error happend: UnicodeDecodeError: 'gbk' codec can't decode byte 0x9d in position 14655: illegal multibyte sequence.   ### Steps to reproduce  paperbanana generate --input examples/sample_inputs/transformer_method.txt  --caption "Overview of our encoder-decoder architecture with sparse routing"   ### Input used  ```bash examples/sample_inputs/transformer_method.txt ```  ### Expected behavior  _No response_  ### Actual output or error  ```text - Generating diagram... ╭───────────────────────────────────────── Traceback (most recent call last) ──────────────────────────────────────────╮ │ D:\Apps\WPy64-31241\python-3.12.4.amd64\Lib\site-packages\paperbanana\cli.py:108 in generate                         │ │                                                                                                                      │ │   105 │   │   console=console,                                                                                       │ │   106 │   ) as progress:                                                                                             │ │   107 │   │   progress.add_task("Generating diagram...", total=None)                                                 │ │ ❱ 108 │   │   result = asyncio.run(_run())                                                                           │ │   109 │                                                                                                              │ │ 
  **Post-Mortem & Fix Analysis**:
  > Hi @dippatel1994 @ouening I am going to work on this. Could you please assign this to me?
  > @ouening, please work on it, it's yours! Will wait for PR citing this issue!
  > Hi @dippatel1994 Can I try this issue?

- **Issue #58** (2026-06-11): **[Bug]: MCP `generate_diagram` returns JPEG data with `image/png` media type**
  *Symptoms*: ### What happened?  When calling the `generate_diagram` MCP tool, the tool result includes a base64-encoded image declared as `image/png`, but the actual image data is JPEG. This causes the Anthropic API to reject the tool result with a validation error:  ``` Error: messages.N.content.0.tool_result.content.1.image.source.base64: The image was specified using the image/png media type, but the image appears to be a image/jpeg image ```  This error halts the agent after the first diagram, preventing generation of multiple diagrams in a single session. The image files are saved to disk correctly, but the MCP tool response has the wrong media type.  ### Steps to reproduce  1. Configure PaperBanana as an MCP server (via Claude Code, OpenCode, or any MCP client that uses the Anthropic API) 2. Call the `generate_diagram` tool with any valid `source_context` and `caption` 3. Observe the API error about `image/png` vs `image/jpeg` mismatch  ### Input used  ```bash # MCP config {   "mcpServers": {     "paperbanana": {       "command": "uvx",       "args": ["--from", "paperbanana[mcp]", "paperbanana-mcp"],       "env": {         "GOOGLE_API_KEY": "<key>"       }     }   } }  # Tool call (via MCP client) paperbanana_generate_diagram {   "source_context": "FAB-SC method overview...",   "caption": "Overview of the FAB-SC methodology.",   "iterations": 3 } ```  ### Expected behavior  The media type declared in the MCP tool result should match the actual image format. If the image data is JPE
  **Post-Mortem & Fix Analysis**:
  > Thanks @genga6. Acknowledging — real bug. The MCP `generate_diagram` tool result advertises `image/png` in the media type while the underlying bytes are JPEG (likely because the pipeline saves PNG by default but the response builder is converting or the format setting drift between the file and the inline base64 payload).  Two ways to fix:  1. **Detect actual format from bytes** before constructing the tool result — `PIL.Image.open(BytesIO(bytes)).format` is authoritative; use it as the source of truth for the media type. 2. **Force a single format end-to-end** — ensure the pipeline's `output_format` flows through to the MCP response builder so PNG-in PNG-out, JPEG-in JPEG-out, no mismatch.  Option 1 is the safer fix because it can't drift even if a future refactor changes the save path. Will look at `mcp_server/` to see where the response payload is constructed.  Marking as bug. PR welcome from anyone who wants to take this — it's a contained ~10-20 line fix in the MCP response handle

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

### Incident Patch 1: `eb8d0422` (2026-06-11)
**Commit Message**: fix: Windows-safe path assertion; ship venue.yaml for built-in venues

- test_default_is_xdg_config_dir compared a /-joined string, failing on
  Windows separators; compare Path.parts instead
- icml/ieee/acl gain venue.yaml: two-column venues now default figures
  to 4:3 (column-friendly) with venue-typical font preferences, so the
  config layer carries real venue knowledge, not just the guides

**File**: `data/guidelines/acl/venue.yaml` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+display_name: "ACL"
+# ACL *ACL venues are two-column; compact figures read better.
+aspect_ratio: "4:3"
```

**File**: `data/guidelines/icml/venue.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+display_name: "ICML"
+# ICML is two-column; column-width figures favor compact ratios.
+aspect_ratio: "4:3"
+fonts: ["Helvetica", "Arial"]
```

**File**: `data/guidelines/ieee/venue.yaml` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+display_name: "IEEE"
+# Most IEEE transactions are two-column; design for column width.
+aspect_ratio: "4:3"
+fonts: ["Arial", "Helvetica"]
```

**File**: `tests/test_venue_packs.py` (modified, +16/-1)
```diff
@@ -82,7 +82,8 @@ def test_env_var_used_when_no_explicit_dir(self, tmp_path, monkeypatch):
 
     def test_default_is_xdg_config_dir(self, monkeypatch):
         monkeypatch.delenv("PAPERBANANA_VENUE_DIR", raising=False)
-        assert str(resolve_user_venue_dir()).endswith(".config/paperbanana/venues")
+        # Compare path components, not a string — separators differ on Windows.
+        assert resolve_user_venue_dir().parts[-3:] == (".config", "paperbanana", "venues")
 
 
 # ── Listing & resolution precedence ──────────────────────────────────
@@ -397,3 +398,17 @@ def test_generate_accepts_user_venue_name(self, user_dir):
         )
         out = _strip_ansi(result.output)
         assert "Unknown venue" not in out
+
+
+class TestBuiltinVenueConfigs:
+    """Built-in venues ship venue.yaml with column-aware defaults."""
+
+    def test_two_column_venues_default_to_4_3(self):
+        for name in ("icml", "ieee", "acl"):
+            pack = resolve_venue(name)
+            assert pack.source == "built-in"
+            assert pack.config.aspect_ratio == "4:3", f"{name} should default to 4:3"
+
+    def test_font_preferences_loaded(self):
+        assert resolve_venue("icml").config.fonts == ["Helvetica", "Arial"]
+        assert resolve_venue("ieee").config.fonts == ["Arial", "Helvetica"]
```

---

### Incident Patch 2: `c97fc3a8` (2026-06-11)
**Commit Message**: Merge pull request #243 from llmsresearch/fix/critic-loop-rollback

fix: roll back to previous best image when a refinement round fails

**File**: `paperbanana/core/pipeline.py` (modified, +143/-13)
```diff
@@ -407,6 +407,67 @@ def _build_final_output(
 
         return final_output_path
 
+    async def _visualize_with_rollback(
+        self,
+        *,
+        iteration: int,
+        rollback_to: Optional[int],
+        run_dir: Path,
+        **visualizer_kwargs: Any,
+    ) -> tuple[Optional[str], Optional[Dict[str, Any]]]:
+        """Run the visualizer for one refinement iteration, rolling back on failure.
+
+        When the visualizer fails after retries (or returns no image) and a
+        previous best image exists (``rollback_to`` is not ``None``), the
+        failure is logged and recorded, and ``(None, rollback_info)`` is
+        returned so the caller stops the loop and keeps the previous best
+        image as the final output.  Without a prior image (first round) the
+        exception propagates, preserving existing error behavior.
+        """
+        try:
+            image_path = await _call_with_retry(
+                "visualizer",
+                self.visualizer.run,
+                iteration=iteration,
+                **visualizer_kwargs,
+            )
+            if not image_path:
+                raise RuntimeError("Visualizer returned no image path")
+        except Exception as e:
+            if rollback_to is None:
+                raise
+            rollback_info: Dict[str, Any] = {
+                "rollback_occurred": True,
+                "failed_iteration": iteration,
+                "rolled_back_to_iteration": rollback_to,
+                "stage": "visualizer",
+                "error": str(e),
+            }
+            logger.warning(
+                "Visualizer failed after retries; rolling back to previous best image",
+                iteration=iteration,
+                rolled_back_to_iteration=rollback_to,
+                error=str(e),
+            )
+            self._emit_progress(
+                "visualizer_rollback",
+                iteration=iteration,
+                rolled_back_to_iteration=rollback_to,
+                error=str(e),
+            )
+            if self.settings.save_iterations:
+                save_json(
+                    {
+                        "failed": True,
+                        "stage": "visualizer",
+                        "error": str(e),
+                        "rolled_back_to_iteration": rollback_to,
+                    },
+                    ensure_dir(run_dir / f"iter_{iteration}") / "failure.json",
+                )
+            return None, rollback_info
+        return image_path, None
+
     def _effective_vector_export(self, input: GenerationInput) -> str:
         """Resolve vector export mode from input override or settings."""
         if input.vector_export is not None:
@@ -553,6 +614,7 @@ async def regenerate_from_ir(
         current_description = format_diagram_ir_for_regeneration(diagram_ir)
         iterations: list[IterationRecord] = []
         iteration_timings: list[dict[str, float | int]] = []
+        rollback_info: Optional[Dict[str, Any]] = None
         budget_exceeded = self._check_budget("before regenerate-from-ir iterations")
         vector_formats = ["svg", "pdf"] if self.settings.vector_export else None
         total_iters = (
@@ -595,18 +657,32 @@ async def regenerate_from_ir(
                 ),
             )
             visualizer_start = time.perf_counter()
-            image_path = await _call_with_retry(
-                "visualizer",
-                self.visualizer.run,
+            image_path, rollback_info = await self._visualize_with_rollback(
+                iteration=iter_index,
+                rollback_to=iterations[-1].iteration if iterations else None,
+                run_dir=self._run_dir,
                 description=current_description,
                 diagram_type=DiagramType.METHODOLOGY,
                 raw_data=None,
-                iteration=iter_index,
                 seed=self.settings.seed,
                 aspect_ratio=aspect_ratio,
                 
```

**File**: `tests/test_pipeline/test_rollback.py` (added, +270/-0)
```diff
@@ -0,0 +1,270 @@
+"""Tests for refinement-loop rollback to the previous best image (issue #238)."""
+
+from __future__ import annotations
+
+import json
+from unittest.mock import AsyncMock
+
+import pytest
+
+pytest.importorskip("PIL", reason="PIL/Pillow required for pipeline image mock")
+from pathlib import Path
+
+from PIL import Image
+
+from paperbanana.core import pipeline as pipeline_mod
+from paperbanana.core.config import Settings
+from paperbanana.core.pipeline import PaperBananaPipeline
+from paperbanana.core.resume import ResumeState
+from paperbanana.core.types import (
+    DiagramType,
+    GenerationInput,
+)
+
+# ── Shared mocks ─────────────────────────────────────────────────
+
+
+class _MockVLM:
+    name = "mock-vlm"
+    model_name = "mock-model"
+
+    def __init__(self, responses: list[str]):
+        self._responses = responses
+        self._idx = 0
+
+    async def generate(self, *args, **kwargs):
+        idx = min(self._idx, len(self._responses) - 1)
+        self._idx += 1
+        return self._responses[idx]
+
+
+class _MockImageGen:
+    name = "mock-image-gen"
+    model_name = "mock-image-model"
+
+    async def generate(self, *args, **kwargs):
+        return Image.new("RGB", (128, 128), color=(255, 255, 255))
+
+
+def _make_settings(tmp_path, **overrides):
+    defaults = dict(
+        output_dir=str(tmp_path / "outputs"),
+        reference_set_path=str(tmp_path / "empty_refs"),
+        refinement_iterations=3,
+        save_iterations=False,
+    )
+    defaults.update(overrides)
+    return Settings(**defaults)
+
+
+def _default_input():
+    return GenerationInput(
+        source_context="Test methodology text",
+        communicative_intent="Test caption",
+        diagram_type=DiagramType.METHODOLOGY,
+    )
+
+
+_REVISION_CRITIQUE = json.dumps(
+    {
+        "critic_suggestions": ["Increase label font size"],
+        "revised_description": "Revised description",
+    }
+)
+_ACCEPT_CRITIQUE = json.dumps({"critic_suggestions": [], "revised_description": None})
+
+
+def _fail_visualizer_at(pipeline, fail_iteration: int):
+    """Patch the visualizer to raise on a specific iteration, delegating otherwise."""
+    original_run = pipeline.visualizer.run
+
+    async def flaky_visualizer(**kwargs):
+        if kwargs.get("iteration") == fail_iteration:
+            raise RuntimeError("image gen exploded")
+        return await original_run(**kwargs)
+
+    pipeline.visualizer.run = flaky_visualizer
+
+
+# ── Fixture: fast retries (no waiting) ───────────────────────────
+
+
+@pytest.fixture(autouse=True)
+def _fast_retry(monkeypatch):
+    """Replace _call_with_retry with a zero-wait version for fast tests."""
+
+    async def _fast_call_with_retry(label, fn, *args, max_attempts=3, **kwargs):
+        last_exc = None
+        for attempt_num in range(1, max_attempts + 1):
+            try:
+                return await fn(*args, **kwargs)
+            except Exception as exc:
+                last_exc = exc
+                if attempt_num >= max_attempts:
+                    raise
+        raise last_exc  # unreachable but satisfies type checker
+
+    monkeypatch.setattr(pipeline_mod, "_call_with_retry", _fast_call_with_retry)
+
+
+# ── Test: round-2 visualizer failure rolls back to iteration 1 ───
+
+
+@pytest.mark.asyncio
+async def test_visualizer_failure_round2_rolls_back_to_previous_image(tmp_path):
+    """Iteration 2 visualizer failure keeps iteration 1's image as final output."""
+    settings = _make_settings(tmp_path, save_iterations=True)
+    # VLM responses: planner, stylist, critic iter 1 (requests revision)
+    vlm = _MockVLM(
+        responses=[
+            "Plan description",
+            "Styled description",
+            _REVISION_CRITIQUE,
+        ]
+    )
+    pipeline = PaperBananaPipeline(settings=settings, vlm_client=vlm, image_gen_fn=_MockImageGen())
+    _fail_visualizer_at(pipeline, fail_iteration=2)
+
+    result = await pipeline.generate(_default_in
```

---

### Incident Patch 3: `a1f36360` (2026-06-11)
**Commit Message**: Merge branch 'main' into fix/critic-loop-rollback

**File**: `paperbanana/cli.py` (modified, +58/-5)
```diff
@@ -3170,6 +3170,27 @@ def benchmark(
     ),
     auto: bool = typer.Option(False, "--auto", help="Loop until critic satisfied per entry"),
     optimize: bool = typer.Option(False, "--optimize", help="Preprocess inputs per entry"),
+    split: str = typer.Option(
+        "reference",
+        "--split",
+        help=(
+            "Entry source: 'reference' (curated pool) or 'test' "
+            "(official PaperBananaBench test split — comparable to the paper)"
+        ),
+    ),
+    task: str = typer.Option(
+        "diagram",
+        "--task",
+        help="Task for --split test: 'diagram' (292 entries) or 'plot' (240 entries)",
+    ),
+    mode: str = typer.Option(
+        "full",
+        "--mode",
+        help=(
+            "'full' runs the complete agentic pipeline; 'vanilla' is the no-pipeline "
+            "baseline (single direct visualizer call, no planning/critique)"
+        ),
+    ),
     category: Optional[str] = typer.Option(
         None, "--category", help="Only run entries in this category"
     ),
@@ -3206,6 +3227,15 @@ def benchmark(
     if concurrency < 1:
         console.print("[red]Error: --concurrency must be at least 1[/red]")
         raise typer.Exit(1)
+    if split not in ("reference", "test"):
+        console.print(f"[red]Error: --split must be 'reference' or 'test'. Got: {split}[/red]")
+        raise typer.Exit(1)
+    if task not in ("diagram", "plot"):
+        console.print(f"[red]Error: --task must be 'diagram' or 'plot'. Got: {task}[/red]")
+        raise typer.Exit(1)
+    if mode not in ("full", "vanilla"):
+        console.print(f"[red]Error: --mode must be 'full' or 'vanilla'. Got: {mode}[/red]")
+        raise typer.Exit(1)
 
     configure_logging(verbose=verbose)
 
@@ -3247,21 +3277,26 @@ def benchmark(
     # Load and filter entries
     id_list = [s.strip() for s in ids.split(",") if s.strip()] if ids else None
     try:
-        entries = runner.load_entries(category=category, ids=id_list, limit=limit)
-    except ValueError as e:
+        if split == "test":
+            entries = runner.load_test_entries(task, category=category, ids=id_list, limit=limit)
+        else:
+            entries = runner.load_entries(category=category, ids=id_list, limit=limit)
+    except (ValueError, RuntimeError) as e:
         console.print(f"[red]Error: {e}[/red]")
         raise typer.Exit(1)
 
     if not entries:
         console.print("[red]Error: No entries match the given filters.[/red]")
         raise typer.Exit(1)
 
-    mode = "eval-only" if eval_only else "generate + evaluate"
+    run_mode = "eval-only" if eval_only else f"{mode} (generate + evaluate)"
+    split_label = f"test ({task})" if split == "test" else "reference"
     console.print(
         Panel.fit(
             f"[bold]PaperBanana[/bold] — Benchmark\n\n"
             f"Entries: {len(entries)}\n"
-            f"Mode: {mode}\n"
+            f"Split: {split_label}\n"
+            f"Mode: {run_mode}\n"
             f"VLM: {settings.vlm_provider} / {settings.effective_vlm_model}\n"
             f"Image: {settings.image_provider} / {settings.effective_image_model}",
             border_style="magenta",
@@ -3272,7 +3307,14 @@ def benchmark(
     bench_output_dir = Path(output_dir) if output_dir else None
 
     async def _run():
-        return await runner.run(entries, output_dir=bench_output_dir, eval_only_dir=eval_only)
+        return await runner.run(
+            entries,
+            output_dir=bench_output_dir,
+            eval_only_dir=eval_only,
+            mode=mode,
+            split=split,
+            task=task if split == "test" else None,
+        )
 
     report = asyncio.run(_run())
     summary = report.summary
@@ -3317,6 +3359,17 @@ async def _run():
                 f"mean={stats['mean_score']:.1f}"
             )
 
+    # Per-difficulty breakdown (official plot test split)
+    diff_breakdown = summary.get("difficulty_breakdown", {})
+    if diff_breakdown:
+        console.print("\n
```

**File**: `paperbanana/core/types.py` (modified, +32/-0)
```diff
@@ -116,6 +116,38 @@ class ReferenceExample(BaseModel):
     structure_hints: Optional[dict[str, Any] | list[Any] | str] = None
 
 
+class TestCase(BaseModel):
+    """A single entry from the official PaperBananaBench test split.
+
+    Mirrors the upstream ``test.json`` schema (292 diagram / 240 plot entries)
+    so benchmark runs are comparable to the paper (arXiv:2601.23265).
+    """
+
+    id: str
+    task: Literal["diagram", "plot"] = Field(
+        default="diagram", description="Benchmark task this case belongs to"
+    )
+    category: str = ""
+    source_context: str = Field(
+        description="Methodology text (diagram) or JSON-encoded data table (plot)"
+    )
+    caption: str = Field(default="", description="Official visual_intent for the entry")
+    gt_image_path: str = Field(description="Path to the ground-truth (human-drawn) image")
+    aspect_ratio: Optional[str] = Field(
+        default=None,
+        description="Official rounded_ratio from additional_info (e.g. '16:9')",
+    )
+    raw_data: Optional[dict[str, Any]] = Field(
+        default=None, description="Raw data table for plot entries"
+    )
+    gt_code: Optional[str] = Field(
+        default=None, description="Ground-truth matplotlib code (plot entries only)"
+    )
+    difficulty: Optional[str] = Field(
+        default=None, description="Official difficulty label (plot entries only)"
+    )
+
+
 class CritiqueResult(BaseModel):
     """Output from the Critic agent."""
 
```

**File**: `paperbanana/data/manager.py` (modified, +177/-8)
```diff
@@ -2,12 +2,19 @@
 
 Cache layout:
     ~/.cache/paperbanana/              (or PAPERBANANA_CACHE_DIR)
-    └── reference_sets/
-        ├── index.json
-        ├── dataset_info.json          (version + revision tracking)
-        └── images/
-            ├── ref_001.jpg
-            └── ...
+    ├── reference_sets/
+    │   ├── index.json
+    │   ├── dataset_info.json          (version + revision tracking)
+    │   └── images/
+    │       ├── ref_001.jpg
+    │       └── ...
+    └── test_split/                    (official PaperBananaBench test split)
+        ├── diagram/
+        │   ├── test.json
+        │   └── images/
+        └── plot/
+            ├── test.json
+            └── images/
 """
 
 from __future__ import annotations
@@ -19,10 +26,13 @@
 import unicodedata
 import zipfile
 from pathlib import Path
-from typing import Callable, Optional
+from typing import TYPE_CHECKING, Callable, Optional
 
 import structlog
 
+if TYPE_CHECKING:
+    from paperbanana.core.types import TestCase
+
 logger = structlog.get_logger()
 
 # Project-controlled mirror of the upstream dataset
@@ -102,6 +112,19 @@ def info_path(self) -> Path:
         """Path to dataset version info."""
         return self.reference_dir / "dataset_info.json"
 
+    @property
+    def test_split_dir(self) -> Path:
+        """Directory containing the cached official test split."""
+        return self._cache_dir / "test_split"
+
+    def test_split_index_path(self, task: str) -> Path:
+        """Path to the cached, normalized test.json for a task."""
+        return self.test_split_dir / task / "test.json"
+
+    def is_test_split_downloaded(self, task: str) -> bool:
+        """Check if the official test split for *task* is cached."""
+        return self.test_split_index_path(task).exists()
+
     def is_downloaded(self) -> bool:
         """Check if an expanded reference set is available in cache.
 
@@ -216,18 +239,64 @@ def _log(msg: str):
             bench_examples = _import_from_bench(bench_dir, task, images_dir)
             count = _merge_index(self.index_path, bench_examples)
 
+            # Cache the official test split alongside the reference import
+            _log("Caching official test split...")
+            test_count = _import_test_split(bench_dir, task, self.test_split_dir)
+
             # Update dataset_info.json
             self._record_dataset(
                 "full_bench",
                 DATASET_VERSION,
                 DATASET_URL,
                 count,
-                extra={"revision": DATASET_RELEASE_TAG, "task": task},
+                extra={
+                    "revision": DATASET_RELEASE_TAG,
+                    "task": task,
+                    "test_cases": test_count,
+                },
             )
 
             _log(f"Cached {count} reference examples to {self.reference_dir}")
+            if test_count:
+                _log(f"Cached {test_count} official test cases to {self.test_split_dir}")
             return count
 
+    def load_test_split(self, task: str = "diagram") -> list[TestCase]:
+        """Load the official PaperBananaBench test split for a task.
+
+        Args:
+            task: Which split to load ('diagram' or 'plot').
+
+        Returns:
+            List of typed TestCase entries with absolute ground-truth image paths.
+
+        Raises:
+            ValueError: If *task* is not 'diagram' or 'plot'.
+            RuntimeError: If the test split has not been downloaded yet.
+        """
+        from paperbanana.core.types import TestCase
+
+        if task not in ("diagram", "plot"):
+            raise ValueError(f"task must be 'diagram' or 'plot', got: {task}")
+
+        index_path = self.test_split_index_path(task)
+        if not index_path.exists():
+            raise RuntimeError(
+                f"Official test split for task '{task}' not found at {index_path}. "
+                "Run 'paperbanana data download --force' to fetch and cache it."
+            )
+
+      
```

**File**: `paperbanana/evaluation/benchmark.py` (modified, +179/-19)
```diff
@@ -11,17 +11,19 @@
 import os
 import time
 from pathlib import Path
-from typing import Callable, Optional
+from typing import Callable, Optional, TypeVar, Union
 
 import structlog
 from pydantic import BaseModel, Field
 
+from paperbanana.agents.visualizer import VisualizerAgent
 from paperbanana.core.config import Settings
 from paperbanana.core.pipeline import PaperBananaPipeline
 from paperbanana.core.types import (
     DiagramType,
     GenerationInput,
     ReferenceExample,
+    TestCase,
 )
 from paperbanana.core.utils import ensure_dir, save_json
 from paperbanana.evaluation.judge import DIMENSIONS, VLMJudge
@@ -40,6 +42,8 @@ class BenchmarkEntryResult(BaseModel):
 
     id: str
     category: str = ""
+    task: str = "diagram"
+    difficulty: Optional[str] = None
     run_id: Optional[str] = None
     image_path: Optional[str] = None
     iteration_count: int = 0
@@ -53,6 +57,9 @@ class BenchmarkReport(BaseModel):
 
     created_at: str
     run_dir: Optional[str] = None  # Directory where report and partial results were written
+    split: str = "reference"  # Entry source: curated 'reference' pool or official 'test' split
+    task: Optional[str] = None  # 'diagram' or 'plot' for official test-split runs
+    mode: str = "full"  # 'full' pipeline or 'vanilla' (single direct visualizer call)
     settings_snapshot: dict = Field(default_factory=dict)
     total_entries: int = 0
     completed: int = 0
@@ -65,15 +72,18 @@ class BenchmarkReport(BaseModel):
 
 # ── Filtering ────────────────────────────────────────────────────
 
+BenchmarkEntry = Union[ReferenceExample, TestCase]
+EntryT = TypeVar("EntryT", ReferenceExample, TestCase)
+
 
 def filter_examples(
-    examples: list[ReferenceExample],
+    examples: list[EntryT],
     *,
     category: Optional[str] = None,
     ids: Optional[list[str]] = None,
     limit: Optional[int] = None,
-) -> list[ReferenceExample]:
-    """Filter benchmark examples by category, IDs, or subset size."""
+) -> list[EntryT]:
+    """Filter benchmark entries (reference or test split) by category, IDs, or subset size."""
     result = examples
 
     if ids:
@@ -137,10 +147,26 @@ def _score(e: BenchmarkEntryResult) -> float:
             "mean_score": round(sum(cat_scores) / n, 1) if n else 0.0,
         }
 
+    # Per-difficulty breakdown (official plot test split carries difficulty labels)
+    difficulty_breakdown: dict[str, dict] = {}
+    by_difficulty: dict[str, list[BenchmarkEntryResult]] = {}
+    for e in scored:
+        if e.difficulty:
+            by_difficulty.setdefault(e.difficulty, []).append(e)
+    for diff, diff_entries in sorted(by_difficulty.items()):
+        diff_scores = [_score(e) for e in diff_entries]
+        diff_model = sum(1 for e in diff_entries if _winner(e) == "Model")
+        n = len(diff_entries)
+        difficulty_breakdown[diff] = {
+            "count": n,
+            "model_win_rate": round(diff_model / n * 100, 1) if n else 0.0,
+            "mean_score": round(sum(diff_scores) / n, 1) if n else 0.0,
+        }
+
     gen_times = [e.generation_seconds for e in scored if e.generation_seconds > 0]
     mean_gen_time = round(sum(gen_times) / len(gen_times), 1) if gen_times else 0.0
 
-    return {
+    summary = {
         "evaluated": len(scored),
         "model_wins": model_wins,
         "human_wins": human_wins,
@@ -151,6 +177,9 @@ def _score(e: BenchmarkEntryResult) -> float:
         "category_breakdown": category_breakdown,
         "mean_generation_seconds": mean_gen_time,
     }
+    if difficulty_breakdown:
+        summary["difficulty_breakdown"] = difficulty_breakdown
+    return summary
 
 
 # ── Runner ───────────────────────────────────────────────────────
@@ -165,10 +194,13 @@ def __init__(
         *,
         pipeline_factory: Callable[[Settings], PaperBananaPipeline] = PaperBananaPipeline,
         judge_factory: Optional[Callable[[Settings], VLMJudge]] = None,
+        visualizer_factory: Optional[Callable[[Settings], 
```

**File**: `tests/test_data_manager.py` (modified, +81/-0)
```diff
@@ -409,3 +409,84 @@ def test_missing_image_returns_none(self, tmp_path):
         images = tmp_path / "images"
         images.mkdir()
         assert _resolve_image(images, "nope.jpg") is None
+
+
+class TestOfficialTestSplit:
+    """Import + load round-trip for the official test split (issue #235)."""
+
+    def _make_bench_dir(self, tmp_path):
+        import json
+
+        bench = tmp_path / "PaperBananaBench"
+        for task in ("diagram", "plot"):
+            (bench / task / "images").mkdir(parents=True)
+        (bench / "diagram" / "images" / "fig1.jpg").write_bytes(b"img1")
+        (bench / "diagram" / "test.json").write_text(
+            json.dumps(
+                [
+                    {
+                        "id": "d1",
+                        "category": "vision",
+                        "content": "methodology text",
+                        "visual_intent": "Overview figure",
+                        "path_to_gt_image": "fig1.jpg",
+                        "split": "test",
+                        "additional_info": {"rounded_ratio": "16:9", "width": 1600, "height": 900},
+                    }
+                ]
+            ),
+            encoding="utf-8",
+        )
+        (bench / "plot" / "images" / "p1.jpg").write_bytes(b"img2")
+        (bench / "plot" / "test.json").write_text(
+            json.dumps(
+                [
+                    {
+                        "id": "p1",
+                        "category": "bar",
+                        "content": {"x": [1, 2], "y": [3, 4]},
+                        "visual_intent": "Bar chart",
+                        "path_to_gt_image": "p1.jpg",
+                        "difficulty": "easy",
+                        "additional_info": {"rounded_ratio": "3:2", "gt_code": "plt.bar(x, y)"},
+                    }
+                ]
+            ),
+            encoding="utf-8",
+        )
+        return bench
+
+    def test_import_and_load_round_trip(self, tmp_path):
+        from paperbanana.data.manager import DatasetManager, _import_test_split
+
+        bench = self._make_bench_dir(tmp_path)
+        dm = DatasetManager(cache_dir=tmp_path / "cache")
+        count = _import_test_split(bench, "both", dm.test_split_dir)
+        assert count == 2
+
+        diagram_cases = dm.load_test_split("diagram")
+        assert len(diagram_cases) == 1
+        case = diagram_cases[0]
+        assert case.id == "d1"
+        assert case.aspect_ratio == "16:9"
+        assert case.task == "diagram"
+        assert Path(case.gt_image_path).exists()
+
+        plot_cases = dm.load_test_split("plot")
+        assert plot_cases[0].gt_code == "plt.bar(x, y)"
+        assert plot_cases[0].difficulty == "easy"
+        assert plot_cases[0].raw_data == {"x": [1, 2], "y": [3, 4]}
+
+    def test_load_missing_split_raises_with_hint(self, tmp_path):
+        from paperbanana.data.manager import DatasetManager
+
+        dm = DatasetManager(cache_dir=tmp_path / "cache")
+        with pytest.raises(RuntimeError, match="data download"):
+            dm.load_test_split("diagram")
+
+    def test_load_rejects_unknown_task(self, tmp_path):
+        from paperbanana.data.manager import DatasetManager
+
+        dm = DatasetManager(cache_dir=tmp_path / "cache")
+        with pytest.raises(ValueError, match="diagram"):
+            dm.load_test_split("poster")
```

---

### Incident Patch 4: `df340a1b` (2026-06-11)
**Commit Message**: fix: roll back to previous best image when a refinement round fails

When a visualizer call fails after retries (or returns no image) in a
refinement round beyond the first, the pipeline now keeps the previous
best image as the final output instead of failing the whole run. The
rollback is logged as a structured warning, recorded in run metadata
(rollback_occurred, failed_iteration, rolled_back_to_iteration), and a
failure note is saved under iter_N/ when save_iterations is enabled.
Applies to generate, continue_run (which can also roll back to the
resumed run's last image), and regenerate_from_ir. First-round failures
with no prior image keep the existing error behavior, and critic crashes
continue to accept the current best image.

Part of #238

**File**: `paperbanana/core/pipeline.py` (modified, +143/-13)
```diff
@@ -407,6 +407,67 @@ def _build_final_output(
 
         return final_output_path
 
+    async def _visualize_with_rollback(
+        self,
+        *,
+        iteration: int,
+        rollback_to: Optional[int],
+        run_dir: Path,
+        **visualizer_kwargs: Any,
+    ) -> tuple[Optional[str], Optional[Dict[str, Any]]]:
+        """Run the visualizer for one refinement iteration, rolling back on failure.
+
+        When the visualizer fails after retries (or returns no image) and a
+        previous best image exists (``rollback_to`` is not ``None``), the
+        failure is logged and recorded, and ``(None, rollback_info)`` is
+        returned so the caller stops the loop and keeps the previous best
+        image as the final output.  Without a prior image (first round) the
+        exception propagates, preserving existing error behavior.
+        """
+        try:
+            image_path = await _call_with_retry(
+                "visualizer",
+                self.visualizer.run,
+                iteration=iteration,
+                **visualizer_kwargs,
+            )
+            if not image_path:
+                raise RuntimeError("Visualizer returned no image path")
+        except Exception as e:
+            if rollback_to is None:
+                raise
+            rollback_info: Dict[str, Any] = {
+                "rollback_occurred": True,
+                "failed_iteration": iteration,
+                "rolled_back_to_iteration": rollback_to,
+                "stage": "visualizer",
+                "error": str(e),
+            }
+            logger.warning(
+                "Visualizer failed after retries; rolling back to previous best image",
+                iteration=iteration,
+                rolled_back_to_iteration=rollback_to,
+                error=str(e),
+            )
+            self._emit_progress(
+                "visualizer_rollback",
+                iteration=iteration,
+                rolled_back_to_iteration=rollback_to,
+                error=str(e),
+            )
+            if self.settings.save_iterations:
+                save_json(
+                    {
+                        "failed": True,
+                        "stage": "visualizer",
+                        "error": str(e),
+                        "rolled_back_to_iteration": rollback_to,
+                    },
+                    ensure_dir(run_dir / f"iter_{iteration}") / "failure.json",
+                )
+            return None, rollback_info
+        return image_path, None
+
     def _effective_vector_export(self, input: GenerationInput) -> str:
         """Resolve vector export mode from input override or settings."""
         if input.vector_export is not None:
@@ -553,6 +614,7 @@ async def regenerate_from_ir(
         current_description = format_diagram_ir_for_regeneration(diagram_ir)
         iterations: list[IterationRecord] = []
         iteration_timings: list[dict[str, float | int]] = []
+        rollback_info: Optional[Dict[str, Any]] = None
         budget_exceeded = self._check_budget("before regenerate-from-ir iterations")
         vector_formats = ["svg", "pdf"] if self.settings.vector_export else None
         total_iters = (
@@ -595,18 +657,32 @@ async def regenerate_from_ir(
                 ),
             )
             visualizer_start = time.perf_counter()
-            image_path = await _call_with_retry(
-                "visualizer",
-                self.visualizer.run,
+            image_path, rollback_info = await self._visualize_with_rollback(
+                iteration=iter_index,
+                rollback_to=iterations[-1].iteration if iterations else None,
+                run_dir=self._run_dir,
                 description=current_description,
                 diagram_type=DiagramType.METHODOLOGY,
                 raw_data=None,
-                iteration=iter_index,
                 seed=self.settings.seed,
                 aspect_ratio=aspect_ratio,
                 
```

**File**: `tests/test_pipeline/test_rollback.py` (added, +270/-0)
```diff
@@ -0,0 +1,270 @@
+"""Tests for refinement-loop rollback to the previous best image (issue #238)."""
+
+from __future__ import annotations
+
+import json
+from unittest.mock import AsyncMock
+
+import pytest
+
+pytest.importorskip("PIL", reason="PIL/Pillow required for pipeline image mock")
+from pathlib import Path
+
+from PIL import Image
+
+from paperbanana.core import pipeline as pipeline_mod
+from paperbanana.core.config import Settings
+from paperbanana.core.pipeline import PaperBananaPipeline
+from paperbanana.core.resume import ResumeState
+from paperbanana.core.types import (
+    DiagramType,
+    GenerationInput,
+)
+
+# ── Shared mocks ─────────────────────────────────────────────────
+
+
+class _MockVLM:
+    name = "mock-vlm"
+    model_name = "mock-model"
+
+    def __init__(self, responses: list[str]):
+        self._responses = responses
+        self._idx = 0
+
+    async def generate(self, *args, **kwargs):
+        idx = min(self._idx, len(self._responses) - 1)
+        self._idx += 1
+        return self._responses[idx]
+
+
+class _MockImageGen:
+    name = "mock-image-gen"
+    model_name = "mock-image-model"
+
+    async def generate(self, *args, **kwargs):
+        return Image.new("RGB", (128, 128), color=(255, 255, 255))
+
+
+def _make_settings(tmp_path, **overrides):
+    defaults = dict(
+        output_dir=str(tmp_path / "outputs"),
+        reference_set_path=str(tmp_path / "empty_refs"),
+        refinement_iterations=3,
+        save_iterations=False,
+    )
+    defaults.update(overrides)
+    return Settings(**defaults)
+
+
+def _default_input():
+    return GenerationInput(
+        source_context="Test methodology text",
+        communicative_intent="Test caption",
+        diagram_type=DiagramType.METHODOLOGY,
+    )
+
+
+_REVISION_CRITIQUE = json.dumps(
+    {
+        "critic_suggestions": ["Increase label font size"],
+        "revised_description": "Revised description",
+    }
+)
+_ACCEPT_CRITIQUE = json.dumps({"critic_suggestions": [], "revised_description": None})
+
+
+def _fail_visualizer_at(pipeline, fail_iteration: int):
+    """Patch the visualizer to raise on a specific iteration, delegating otherwise."""
+    original_run = pipeline.visualizer.run
+
+    async def flaky_visualizer(**kwargs):
+        if kwargs.get("iteration") == fail_iteration:
+            raise RuntimeError("image gen exploded")
+        return await original_run(**kwargs)
+
+    pipeline.visualizer.run = flaky_visualizer
+
+
+# ── Fixture: fast retries (no waiting) ───────────────────────────
+
+
+@pytest.fixture(autouse=True)
+def _fast_retry(monkeypatch):
+    """Replace _call_with_retry with a zero-wait version for fast tests."""
+
+    async def _fast_call_with_retry(label, fn, *args, max_attempts=3, **kwargs):
+        last_exc = None
+        for attempt_num in range(1, max_attempts + 1):
+            try:
+                return await fn(*args, **kwargs)
+            except Exception as exc:
+                last_exc = exc
+                if attempt_num >= max_attempts:
+                    raise
+        raise last_exc  # unreachable but satisfies type checker
+
+    monkeypatch.setattr(pipeline_mod, "_call_with_retry", _fast_call_with_retry)
+
+
+# ── Test: round-2 visualizer failure rolls back to iteration 1 ───
+
+
+@pytest.mark.asyncio
+async def test_visualizer_failure_round2_rolls_back_to_previous_image(tmp_path):
+    """Iteration 2 visualizer failure keeps iteration 1's image as final output."""
+    settings = _make_settings(tmp_path, save_iterations=True)
+    # VLM responses: planner, stylist, critic iter 1 (requests revision)
+    vlm = _MockVLM(
+        responses=[
+            "Plan description",
+            "Styled description",
+            _REVISION_CRITIQUE,
+        ]
+    )
+    pipeline = PaperBananaPipeline(settings=settings, vlm_client=vlm, image_gen_fn=_MockImageGen())
+    _fail_visualizer_at(pipeline, fail_iteration=2)
+
+    result = await pipeline.generate(_default_in
```

---

### Incident Patch 5: `74f1e6aa` (2026-06-11)
**Commit Message**: Merge pull request #240 from llmsresearch/fix/nfd-filename-import

fix: resolve bench image paths across Unicode normalization forms

**File**: `paperbanana/data/manager.py` (modified, +27/-5)
```diff
@@ -16,6 +16,7 @@
 import os
 import shutil
 import tempfile
+import unicodedata
 import zipfile
 from pathlib import Path
 from typing import Callable, Optional
@@ -351,6 +352,29 @@ def _merge_index(index_path: Path, new_examples: list[dict]) -> int:
     return len(merged)
 
 
+def _resolve_image(source_images_dir: Path, gt_image_rel: str) -> Optional[Path]:
+    """Resolve a dataset image path tolerantly across Unicode normalization forms.
+
+    macOS extracts zip entries with NFD-normalized filenames, so a byte-exact
+    lookup misses names containing characters like U+2011 (non-breaking hyphen)
+    or U+200C (zero-width non-joiner). When the exact paths miss, fall back to
+    an NFC-normalized filename comparison within the candidate directories.
+    """
+    candidates = [source_images_dir / gt_image_rel, source_images_dir.parent / gt_image_rel]
+    for candidate in candidates:
+        if candidate.exists():
+            return candidate
+    want = unicodedata.normalize("NFC", Path(gt_image_rel).name)
+    for candidate in candidates:
+        parent = candidate.parent
+        if not parent.is_dir():
+            continue
+        for f in parent.iterdir():
+            if unicodedata.normalize("NFC", f.name) == want:
+                return f
+    return None
+
+
 def _import_from_bench(
     bench_dir: Path,
     task: str,
@@ -412,11 +436,9 @@ def _import_from_bench(
             if not gt_image_rel:
                 continue
 
-            source_image = source_images_dir / gt_image_rel
-            if not source_image.exists():
-                source_image = source_images_dir.parent / gt_image_rel
-            if not source_image.exists():
-                logger.warning("Image not found, skipping", id=entry_id, path=str(source_image))
+            source_image = _resolve_image(source_images_dir, gt_image_rel)
+            if source_image is None:
+                logger.warning("Image not found, skipping", id=entry_id, path=gt_image_rel)
                 continue
 
             dest_filename = f"{entry_id}.jpg"
```

**File**: `tests/test_data_manager.py` (modified, +37/-0)
```diff
@@ -372,3 +372,40 @@ def test_clear_removes_cache(self, tmp_cache):
 
     def test_clear_noop_when_empty(self, tmp_cache):
         tmp_cache.clear()  # should not raise
+
+
+class TestResolveImageUnicode:
+    """NFD-extracted filenames must still resolve (issue #234)."""
+
+    def test_nfd_filename_resolves_via_nfc_comparison(self, tmp_path):
+        import unicodedata
+
+        from paperbanana.data.manager import _resolve_image
+
+        images = tmp_path / "images"
+        images.mkdir()
+        # Name with U+2011 (non-breaking hyphen), written in NFD form as
+        # macOS zip extraction produces.
+        name_nfc = "VTON‑VLLM Aligning Modéls_diagram.jpg"
+        nfd_name = unicodedata.normalize("NFD", name_nfc)
+        (images / nfd_name).write_bytes(b"fake")
+
+        resolved = _resolve_image(images, name_nfc)
+        assert resolved is not None
+        assert resolved.read_bytes() == b"fake"
+
+    def test_exact_match_still_preferred(self, tmp_path):
+        from paperbanana.data.manager import _resolve_image
+
+        images = tmp_path / "images"
+        images.mkdir()
+        (images / "plain.jpg").write_bytes(b"x")
+        resolved = _resolve_image(images, "plain.jpg")
+        assert resolved == images / "plain.jpg"
+
+    def test_missing_image_returns_none(self, tmp_path):
+        from paperbanana.data.manager import _resolve_image
+
+        images = tmp_path / "images"
+        images.mkdir()
+        assert _resolve_image(images, "nope.jpg") is None
```

---

### Incident Patch 6: `8c93abae` (2026-06-11)
**Commit Message**: fix: resolve bench image paths across Unicode normalization forms

macOS extracts zip entries with NFD-normalized filenames, so byte-exact
lookups missed the 3 dataset entries whose names contain U+2011, en dash,
or U+200C. _resolve_image now falls back to NFC-normalized filename
comparison; exact matches still take priority.

Fixes #234

**File**: `paperbanana/data/manager.py` (modified, +27/-5)
```diff
@@ -16,6 +16,7 @@
 import os
 import shutil
 import tempfile
+import unicodedata
 import zipfile
 from pathlib import Path
 from typing import Callable, Optional
@@ -351,6 +352,29 @@ def _merge_index(index_path: Path, new_examples: list[dict]) -> int:
     return len(merged)
 
 
+def _resolve_image(source_images_dir: Path, gt_image_rel: str) -> Optional[Path]:
+    """Resolve a dataset image path tolerantly across Unicode normalization forms.
+
+    macOS extracts zip entries with NFD-normalized filenames, so a byte-exact
+    lookup misses names containing characters like U+2011 (non-breaking hyphen)
+    or U+200C (zero-width non-joiner). When the exact paths miss, fall back to
+    an NFC-normalized filename comparison within the candidate directories.
+    """
+    candidates = [source_images_dir / gt_image_rel, source_images_dir.parent / gt_image_rel]
+    for candidate in candidates:
+        if candidate.exists():
+            return candidate
+    want = unicodedata.normalize("NFC", Path(gt_image_rel).name)
+    for candidate in candidates:
+        parent = candidate.parent
+        if not parent.is_dir():
+            continue
+        for f in parent.iterdir():
+            if unicodedata.normalize("NFC", f.name) == want:
+                return f
+    return None
+
+
 def _import_from_bench(
     bench_dir: Path,
     task: str,
@@ -412,11 +436,9 @@ def _import_from_bench(
             if not gt_image_rel:
                 continue
 
-            source_image = source_images_dir / gt_image_rel
-            if not source_image.exists():
-                source_image = source_images_dir.parent / gt_image_rel
-            if not source_image.exists():
-                logger.warning("Image not found, skipping", id=entry_id, path=str(source_image))
+            source_image = _resolve_image(source_images_dir, gt_image_rel)
+            if source_image is None:
+                logger.warning("Image not found, skipping", id=entry_id, path=gt_image_rel)
                 continue
 
             dest_filename = f"{entry_id}.jpg"
```

**File**: `tests/test_data_manager.py` (modified, +37/-0)
```diff
@@ -372,3 +372,40 @@ def test_clear_removes_cache(self, tmp_cache):
 
     def test_clear_noop_when_empty(self, tmp_cache):
         tmp_cache.clear()  # should not raise
+
+
+class TestResolveImageUnicode:
+    """NFD-extracted filenames must still resolve (issue #234)."""
+
+    def test_nfd_filename_resolves_via_nfc_comparison(self, tmp_path):
+        import unicodedata
+
+        from paperbanana.data.manager import _resolve_image
+
+        images = tmp_path / "images"
+        images.mkdir()
+        # Name with U+2011 (non-breaking hyphen), written in NFD form as
+        # macOS zip extraction produces.
+        name_nfc = "VTON‑VLLM Aligning Modéls_diagram.jpg"
+        nfd_name = unicodedata.normalize("NFD", name_nfc)
+        (images / nfd_name).write_bytes(b"fake")
+
+        resolved = _resolve_image(images, name_nfc)
+        assert resolved is not None
+        assert resolved.read_bytes() == b"fake"
+
+    def test_exact_match_still_preferred(self, tmp_path):
+        from paperbanana.data.manager import _resolve_image
+
+        images = tmp_path / "images"
+        images.mkdir()
+        (images / "plain.jpg").write_bytes(b"x")
+        resolved = _resolve_image(images, "plain.jpg")
+        assert resolved == images / "plain.jpg"
+
+    def test_missing_image_returns_none(self, tmp_path):
+        from paperbanana.data.manager import _resolve_image
+
+        images = tmp_path / "images"
+        images.mkdir()
+        assert _resolve_image(images, "nope.jpg") is None
```

---

### Incident Patch 7: `1631993b` (2026-06-11)
**Commit Message**: Merge pull request #232 from llmsresearch/fix/release-verify-no-grep

fix(release): verify wheel CLI via click introspection, not help-text grep

**File**: `.github/workflows/release.yml` (modified, +16/-1)
```diff
@@ -48,7 +48,22 @@ jobs:
           OUT=$(/tmp/verify-venv/bin/paperbanana --version)
           echo "$OUT"
           echo "$OUT" | grep -q "paperbanana ${GITHUB_REF_NAME#v}"
-          /tmp/verify-venv/bin/paperbanana generate --help | grep -q -- "--budget"
+          # Introspect the click command tree instead of grepping rendered
+          # help text — rich truncates flag names at narrow console widths.
+          /tmp/verify-venv/bin/python - <<'PY'
+          import typer.main
+
+          from paperbanana.cli import app
+
+          cmd = typer.main.get_command(app)
+          gen = cmd.commands["generate"]
+          flags = {opt for param in gen.params for opt in param.opts}
+          required = {"--budget", "--optimize", "--format", "--export-tikz"}
+          missing = required - flags
+          if missing:
+              raise SystemExit(f"wheel CLI is stale — missing flags: {sorted(missing)}")
+          print("CLI flags verified:", sorted(required))
+          PY
       - name: Publish to PyPI
         uses: pypa/gh-action-pypi-publish@release/v1
         with:
```

---

### Incident Patch 8: `903a1add` (2026-06-11)
**Commit Message**: fix(release): verify wheel CLI via click introspection, not help-text grep

The v0.2.0 release run failed at the verify gate because rich truncates
option names (--bud…) when it renders help at narrow console widths, so
grepping rendered help is width-dependent. Introspect the click command
tree from the installed wheel instead — deterministic in any terminal.

**File**: `.github/workflows/release.yml` (modified, +16/-1)
```diff
@@ -48,7 +48,22 @@ jobs:
           OUT=$(/tmp/verify-venv/bin/paperbanana --version)
           echo "$OUT"
           echo "$OUT" | grep -q "paperbanana ${GITHUB_REF_NAME#v}"
-          /tmp/verify-venv/bin/paperbanana generate --help | grep -q -- "--budget"
+          # Introspect the click command tree instead of grepping rendered
+          # help text — rich truncates flag names at narrow console widths.
+          /tmp/verify-venv/bin/python - <<'PY'
+          import typer.main
+
+          from paperbanana.cli import app
+
+          cmd = typer.main.get_command(app)
+          gen = cmd.commands["generate"]
+          flags = {opt for param in gen.params for opt in param.opts}
+          required = {"--budget", "--optimize", "--format", "--export-tikz"}
+          missing = required - flags
+          if missing:
+              raise SystemExit(f"wheel CLI is stale — missing flags: {sorted(missing)}")
+          print("CLI flags verified:", sorted(required))
+          PY
       - name: Publish to PyPI
         uses: pypa/gh-action-pypi-publish@release/v1
         with:
```

---

### Incident Patch 9: `28d664eb` (2026-06-11)
**Commit Message**: Merge pull request #231 from llmsresearch/fix/continue-run-and-critic

fix: continue-run honours custom output dirs; robust critic JSON parsing

**File**: `paperbanana/agents/critic.py` (modified, +5/-2)
```diff
@@ -9,7 +9,7 @@
 
 from paperbanana.agents.base import BaseAgent
 from paperbanana.core.types import CritiqueResult, DiagramType
-from paperbanana.core.utils import extract_json, load_image
+from paperbanana.core.utils import extract_json, load_image, truncate_text
 from paperbanana.providers.base import VLMProvider
 
 logger = structlog.get_logger()
@@ -118,5 +118,8 @@ def _parse_response(self, response: str | None) -> CritiqueResult:
                 )
             except (KeyError, TypeError) as e:
                 logger.warning("Failed to build CritiqueResult", error=str(e))
-        logger.warning("Failed to parse critic response as JSON")
+        logger.warning(
+            "Failed to parse critic response as JSON",
+            raw_response=truncate_text(response, 500),
+        )
         return CritiqueResult(critic_suggestions=[], revised_description=None)
```

**File**: `paperbanana/agents/retriever.py` (modified, +5/-2)
```diff
@@ -6,7 +6,7 @@
 
 from paperbanana.agents.base import BaseAgent
 from paperbanana.core.types import DiagramType, ReferenceExample
-from paperbanana.core.utils import extract_json
+from paperbanana.core.utils import extract_json, truncate_text
 from paperbanana.providers.base import VLMProvider
 
 logger = structlog.get_logger()
@@ -112,7 +112,10 @@ def _parse_response(
         """Parse VLM response to extract selected example IDs."""
         data = extract_json(response)
         if not isinstance(data, dict):
-            logger.warning("Failed to parse retriever response as JSON, using fallback")
+            logger.warning(
+                "Failed to parse retriever response as JSON, using fallback",
+                raw_response=truncate_text(response, 500),
+            )
             return candidates
         selected_ids = (
             data.get("selected_ids") or data.get("top_10_papers") or data.get("top_10_plots") or []
```

**File**: `paperbanana/cli.py` (modified, +31/-3)
```diff
@@ -4,6 +4,7 @@
 
 import asyncio
 import json as json_mod
+import os
 import time
 from pathlib import Path
 from typing import Optional
@@ -237,6 +238,14 @@ def generate(
         None, "--caption", "-c", help="Figure caption / communicative intent"
     ),
     output: Optional[str] = typer.Option(None, "--output", "-o", help="Output image path"),
+    output_dir: Optional[str] = typer.Option(
+        None,
+        "--output-dir",
+        help=(
+            "Directory for run outputs; also where --continue/--continue-run "
+            "look up the existing run"
+        ),
+    ),
     vlm_provider: Optional[str] = typer.Option(
         None, "--vlm-provider", help="VLM provider (gemini)"
     ),
@@ -473,6 +482,9 @@ def generate(
         overrides["save_prompts"] = save_prompts
     if output:
         overrides["output_dir"] = str(Path(output).parent)
+    if output_dir:
+        # Explicit --output-dir wins over the directory inferred from --output.
+        overrides["output_dir"] = output_dir
     overrides["output_format"] = format
     if vector:
         overrides["vector_export"] = True
@@ -534,20 +546,36 @@ def generate(
     if continue_run is not None or continue_last:
         from paperbanana.core.resume import find_latest_run, load_resume_state
 
+        resume_output_dir = settings.output_dir
         if continue_run:
-            run_id = continue_run
+            if "/" in continue_run or os.sep in continue_run:
+                # --continue-run was given as a path to the run directory itself.
+                run_path = Path(continue_run).expanduser()
+                if not run_path.is_dir():
+                    console.print(
+                        f"[red]Error: Run directory not found: {run_path.resolve()}[/red]"
+                    )
+                    raise typer.Exit(1)
+                resume_output_dir = str(run_path.parent)
+                run_id = run_path.name
+            else:
+                run_id = continue_run
         else:
             try:
-                run_id = find_latest_run(settings.output_dir)
+                run_id = find_latest_run(resume_output_dir)
                 console.print(f"  [dim]Using latest run:[/dim] [bold]{run_id}[/bold]")
             except FileNotFoundError as e:
                 console.print(f"[red]Error: {e}[/red]")
                 raise typer.Exit(1)
 
         try:
-            resume_state = load_resume_state(settings.output_dir, run_id)
+            resume_state = load_resume_state(resume_output_dir, run_id)
         except (FileNotFoundError, ValueError) as e:
             console.print(f"[red]Error: {e}[/red]")
+            console.print(
+                "[dim]Hint: if the run lives outside the default output directory, "
+                "pass --output-dir <dir> or --continue-run <path/to/run_dir>.[/dim]"
+            )
             raise typer.Exit(1)
 
         iter_label = "auto" if auto else str(iterations or settings.refinement_iterations)
```

**File**: `paperbanana/core/resume.py` (modified, +6/-3)
```diff
@@ -28,13 +28,13 @@ def find_latest_run(output_dir: str) -> str:
     """
     out = Path(output_dir)
     if not out.exists():
-        raise FileNotFoundError(f"Output directory not found: {output_dir}")
+        raise FileNotFoundError(f"Output directory not found: {out.resolve()}")
 
     runs = sorted(
         [d.name for d in out.iterdir() if d.is_dir() and d.name.startswith("run_")],
     )
     if not runs:
-        raise FileNotFoundError(f"No runs found in {output_dir}")
+        raise FileNotFoundError(f"No runs found in {out.resolve()}")
 
     return runs[-1]
 
@@ -70,7 +70,10 @@ def load_resume_state(output_dir: str, run_id: str) -> ResumeState:
     """
     run_dir = Path(output_dir) / run_id
     if not run_dir.exists():
-        raise FileNotFoundError(f"Run directory not found: {run_dir}")
+        raise FileNotFoundError(
+            f"Run directory not found: {run_dir.resolve()} "
+            f"(looked for run '{run_id}' under output dir '{Path(output_dir).resolve()}')"
+        )
 
     # Load original input
     input_path = run_dir / "run_input.json"
```

**File**: `paperbanana/core/utils.py` (modified, +3/-1)
```diff
@@ -218,7 +218,9 @@ def extract_json(text: str | None) -> dict | list | None:
     result = _try_parse_json(text)
     if result is not None:
         return result
-    for pattern in [r"```json\s*\n(.*?)```", r"```\s*\n(.*?)```"]:
+    # Code fences with or without a language tag; newline after the opening
+    # fence is optional (some models emit ```json{...}``` on one line).
+    for pattern in [r"```json\s*(.*?)\s*```", r"```\s*(.*?)\s*```"]:
         m = re.search(pattern, text, re.DOTALL)
         if m:
             result = _try_parse_json(m.group(1).strip())
```

---

### Incident Patch 10: `938a5193` (2026-06-11)
**Commit Message**: Merge branch 'main' into fix/continue-run-and-critic

**File**: `CONTRIBUTING.md` (modified, +10/-0)
```diff
@@ -96,6 +96,16 @@ ruff format paperbanana/ mcp_server/ tests/ scripts/
 4. Ensure `pytest` and `ruff check` pass
 5. Open a PR with a brief description of what changed and why
 
+### What we accept (and what we don't)
+
+To keep the review queue healthy, a few ground rules:
+
+- **CI must be green.** PRs with failing lint or tests won't be reviewed until they pass; `ruff check`, `ruff format --check`, and `pytest` locally before pushing saves everyone a round-trip.
+- **No personal or institution-specific content.** Your university's thesis style, your paper's figures, or `.docx`/example files specific to your own project belong in a fork. Generic, configurable mechanisms (e.g. a venue/style system anyone can use) are very welcome — see issue #89.
+- **New providers go through the generic routes first.** PaperBanana supports any OpenAI-compatible endpoint via `openai_local`, plus `litellm` for almost everything else. We only add first-class provider modules when there's a strong case (significant user demand or a sponsorship that funds its maintenance — see SPONSORS.md). A docs example showing your provider via `litellm` is the fastest way to get it supported.
+- **Don't change project-wide defaults** (models, styles, providers) in a feature PR. Defaults are a maintainer decision with cost/quality implications for every user; propose the change in an issue instead.
+- **Stale PRs may be finished by maintainers.** If a PR is approved-with-comments and the author doesn't respond within ~2 weeks, a maintainer may push the remaining fixes to the branch (with credit preserved) and merge it, so good work doesn't strand.
+
 ### Areas where code contributions are welcome
 
 - **Provider support**: Adding backends beyond OpenAI and Gemini (Anthropic, local models via Ollama)
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -577,7 +577,7 @@ PaperBanana includes an MCP server for use with Claude Code, Cursor, or any MCP-
 }
 ```
 
-MCP tools include `generate_diagram`, `continue_run` (resume a prior `run_*` with optional feedback), `generate_plot`, `evaluate_diagram`, and `evaluate_plot`.
+Eleven MCP tools are exposed: `generate_diagram`, `generate_plot`, `continue_run` (resume a prior `run_*` with optional feedback), `continue_diagram`, `continue_plot`, `evaluate_diagram`, `evaluate_plot`, `orchestrate_figures` (full-paper figure packages), `batch_diagrams`, `batch_plots`, and `download_references`.
 
 The repo also ships with 3 Claude Code skills:
 - `/generate-diagram <file> [caption]` - generate a methodology diagram from a text file
```

**File**: `paperbanana/agents/visualizer.py` (modified, +4/-2)
```diff
@@ -216,7 +216,7 @@ async def _generate_plot(
         # Save generated code for inspection / manual editing
         code_path = Path(output_path).with_suffix(".py")
         code_path.parent.mkdir(parents=True, exist_ok=True)
-        code_path.write_text(code)
+        code_path.write_text(code, encoding="utf-8")
         logger.info("Plot code saved", path=str(code_path))
 
         # Execute the code
@@ -308,7 +308,9 @@ def _execute_plot_code(
         # Ensure output directory exists
         Path(output_path).parent.mkdir(parents=True, exist_ok=True)
 
-        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
+        with tempfile.NamedTemporaryFile(
+            mode="w", suffix=".py", delete=False, encoding="utf-8"
+        ) as f:
             f.write(full_code)
             temp_path = f.name
 
```

**File**: `paperbanana/cli.py` (modified, +2/-2)
```diff
@@ -742,8 +742,8 @@ async def _run_continue():
                 "[bold]PaperBanana[/bold] - Dry Run\n\n"
                 f"Input: {input_path}{pdf_note}\n"
                 f"Caption: {caption}\n"
-                f"VLM: {settings.vlm_provider} / {settings.vlm_model}\n"
-                f"Image: {settings.image_provider} / {settings.image_model}\n"
+                f"VLM: {settings.vlm_provider} / {settings.effective_vlm_model}\n"
+                f"Image: {settings.image_provider} / {settings.effective_image_model}\n"
                 f"Iterations: {settings.refinement_iterations}\n"
                 f"Output: {expected_output}",
                 border_style="yellow",
```

**File**: `paperbanana/core/config.py` (modified, +1/-1)
```diff
@@ -283,7 +283,7 @@ def from_yaml(cls, config_path: str | Path, **overrides: Any) -> Settings:
         """Load settings from a YAML config file with optional overrides."""
         config_path = Path(config_path)
         if config_path.exists():
-            with open(config_path) as f:
+            with open(config_path, encoding="utf-8") as f:
                 yaml_config = yaml.safe_load(f) or {}
         else:
             yaml_config = {}
```

#### Recent Merged Pull Requests:
- **PR #265** (2026-09-17): Update README.md added Trendshift logos (@dippatel1994)
- **PR #264** (2026-09-09): Link free visual cards and restore Typer test compatibility (@dippatel1994)
- **PR #258** (closed): Add reference image guidance for diagram planning (@simplaj)
- **PR #251** (2026-06-12): chore: v0.3.0 release prep (@dippatel1994)
- **PR #250** (2026-06-12): docs: ground venue format facts in current official author instructions (@dippatel1994)
- **PR #249** (2026-06-11): feat: user-suppliable venue style packs (@dippatel1994)
- **PR #248** (2026-06-11): feat: user-provided reference/sketch images guide diagram generation (@dippatel1994)
- **PR #247** (2026-06-11): feat: polish mode — refine an existing figure with style-guided suggestions (@dippatel1994)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
