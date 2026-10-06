# Forensic Learning Record (Deep Inspection): llmsresearch/paperbanana

> **Canonical Artifact**: `07_PROJECT_LEARNING/llmsresearch-paperbanana-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/llmsresearch/paperbanana](https://github.com/llmsresearch/paperbanana))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:10:48.542Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `llmsresearch/paperbanana`
- **Description**: Open source implementation and extension of Google Research’s PaperBanana for automated academic figures, diagrams, and research visuals, expanded to new domains like slide generation.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2383 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `paperbanana/core/batch.py`
```
"""Batch generation: manifest loading, batch run id, and report generation."""

from __future__ import annotations

import datetime
import json
import os
import uuid
from pathlib import Path
from typing import Any, Literal

import structlog

logger = structlog.get_logger()

REPORT_FILENAME = "batch_report.json"
CHECKPOINT_FILENAME = "batch_checkpoint.json"


def generate_batch_id() -> str:
    """Generate a unique batch run ID."""
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    short_uuid = uuid.uuid4().hex[:6]
    return f"batch_{ts}_{short_uuid}"


def _parse_manifest_raw(manifest_path: Path) -> tuple[list, dict[str, Any] | None]:
    """Parse a manifest file and return (items_list, full_data_dict_or_None).

    The full data dict is returned when the manifest is an object (not a bare list)
    so callers can inspect extra keys like 'composite'.
    """
    manifest_path = Path(manifest_path).resolve()
    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")
    raw = manifest_path.read_text(encoding="utf-8")
    suffix = manifest_path.suffix.lower()
    if suffix in (".yaml", ".yml"):
        try:
            import yaml

            data = yaml.safe_load(raw)
        except ImportError:
            raise RuntimeError(
                "PyYAML is required for YAML manifests. Install with: pip install pyyaml"
            )
    elif suffix == ".json":
        data = json.loads(raw)
    else:
        raise ValueError(f"Manifest must be .yaml, .yml, or .json. Got: {manifest_path.suffix}")

    if data is None:
        raise ValueError("Manifest is empty")
    if isinstance(data, list):
        return data, None
    if isinstance(data, dict) and "items" in data:
        return data["items"], data
    raise ValueError("Manifest must be a list of items or an object with an 'items' list")


def load_batch_manifest(
    manifest_path: Path,
) -> list[dict[str, Any]]:
    """Load a batch manifest (YAML or JSON) and return a list of items.

    Each item is a dict with:
      - input: path to methodology text or PDF file (resolved relative to manifest parent)
      - caption: figure caption / communicative intent
      - id: optional string identifier for the item (default: index-based)
      - pdf_pages: optional 1-based page selection for PDF inputs (e.g. "1-5" or "2,4,6-8")

    Paths in the manifest are resolved relative to the manifest file's directory.
    """
    manifest_path = Path(manifest_path).resolve()
    parent = manifest_path.parent
    items, _ = _parse_manifest_raw(manifest_path)

    result = []
    for i, entry in enumerate(items):
        if not isinstance(entry, dict):
            raise ValueError(f"Manifest item {i} must be an object, got {type(entry).__name__}")
        inp = entry.get("input")
        caption = entry.get("caption")
        if not inp or not caption:
            raise ValueError(f"Manifest item {i}: 'input' and 'caption' are required")
        input_path = Path(inp)
        if not input_path.is_absolute():
            input_path = (parent / input_path).resolve()
        pdf_pages = entry.get("pdf_pages")
        if pdf_pages is not None and not isinstance(pdf_pages, str):
            raise ValueError(f"Manifest item {i}: 'pdf_pages' must be a string when set")
        result.append(
            {
                "input": str(input_path),
                "caption": str(caption),
                "id": entry.get("id", f"item_{i + 1}"),
                "pdf_pages": pdf_pages,
            }
        )
    return result


def load_batch_manifest_with_composite(
    manifest_path: Path,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    """Load a batch manifest and return (items, composite_config).

    composite_config is None when the manifest has no ``composite`` section.
    """
    from paperbanana.core.composite import parse_composite_config

    manifest_path = Path(manifest_path).resolve()
    items = load_batch_manifest(manifest_path)
    _, full_data = _parse_manifest_raw(manifest_path)
    composite_config = None
    if full_data is not None:
        composite_config = parse_composite_config(full_data)
    return items, composite_config


def load_plot_batch_manifest(manifest_path: Path) -> list[dict[str, Any]]:
    """Load a plot batch manifest (YAML or JSON): multiple statistical plots in one run.

    Each item must include:
      - data: path to CSV or JSON (resolved relative to manifest parent)
      - intent: communicative intent for the plot (like ``paperbanana plot --intent``)
      - id: optional string identifier (default: index-based)

    Optional per-item fields (override CLI defaults when set):
      - aspect_ratio: e.g. \"16:9\"
    """
    manifest_path = Path(manifest_path).resolve()
    if not manifest_path.exists():
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")
    parent = manifest_path.parent
    raw = manifest_path.read_text(encoding="utf-8")
    suffix = manifest_path.suffix.lower()
    if suffix in (".yaml", ".yml"):
        try:
            import yaml

            data = yaml.safe_load(raw)
        except ImportError:
            raise RuntimeError(
                "PyYAML is required for YAML manifests. Install with: pip install pyyaml"
            )
    elif suffix == ".json":
        data = json.loads(raw)
    else:
        raise ValueError(f"Manifest must be .yaml, .yml, or .json. Got: {manifest_path.suffix}")

    if data is None:
        raise ValueError("Manifest is empty")
    if isinstance(data, list):
        items = data
    elif isinstance(data, dict) and "items" in data:
        items = data["items"]
    else:
        raise ValueError("Manifest must be a list of items or an object with an 'items' list")

    result = []
    for i, entry in enumerate(items):
        if not isinstance(entry, dict):
            raise ValueError(f"Manifest item {i} must be an object, got {type(entry).__name__}")
        data_key = entry.get("data")
        intent = entry.get("intent")
        if not data_key or not intent:
            raise ValueError(f"Manifest item {i}: 'data' and 'intent' are required")
        data_path = Path(data_key)
        if not data_path.is_absolute():
            data_path = (parent / data_path).resolve()
        suffix_d = data_path.suffix.lower()
        if suffix_d not in (".csv", ".json"):
            raise ValueError(
                f"Manifest item {i}: 'data' must be a .csv or .json file, got {data_path.suffix!r}"
            )
        aspect_ratio = entry.get("aspect_ratio")
        if aspect_ratio is not None and not isinstance(aspect_ratio, str):
            raise ValueError(f"Manifest item {i}: 'aspect_ratio' must be a string when set")
        result.append(
            {
                "data": str(data_path),
                "intent": str(intent),
                "id": entry.get("id", f"plot_{i + 1}"),
                "aspect_ratio": aspect_ratio,
            }
        )
    return result


_BATCH_KNOWN_KEYS = {"input", "caption", "id", "pdf_pages"}
_PLOT_BATCH_KNOWN_KEYS = {"data", "intent", "id", "aspect_ratio"}

_PDF_PAGES_RE_PATTERN = r"^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$"


def validate_manifest(
    manifest_path: Path,
    manifest_type: Literal["batch", "plot", "auto"] = "auto",
) -> list[str]:
    """Validate a batch or plot-batch manifest and return a list of all violations.

    Returns an empty list when the manifest is valid.
    """
    import re

    from paperbanana.core.types import SUPPORTED_ASPECT_RATIOS

    errors: list[str] = []
    manifest_path = Path(manifest_path).resolve()

    # Parse inline (keeps the validator self-contained and lets us collect
    # multiple violations instead of stopping at the first raise).
    if not manifest_path.exists():
        return [f"Manifest not found: {manifest_path}"]

    suffix = manifest_path.suffix.lower()
    if suffix not in (".yaml", ".yml", ".json"):
        return [f"Manifest must be .yaml, .yml, or .json. Got: {manifest_path.suffix}"]

    try:
        raw = manifest_path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"Failed to read manifest: {exc}"]

    if suffix in (".yaml", ".yml"):
        try:
            import yaml
        except ImportError:
            return ["PyYAML is required for YAML manifests. Install with: pip install pyyaml"]
        try:
            data = yaml.safe_load(raw)
        except yaml.YAMLError as exc:
            return [f"Failed to parse YAML manifest: {exc}"]
    else:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            return [f"Failed to parse JSON manifest: {exc}"]

    if data is None:
        return ["Manifest is empty"]

    full_data: dict[str, Any] | None = None
    if isinstance(data, list):
        items_raw = data
    elif isinstance(data, dict) and "items" in data:
        items_raw = data["items"]
        full_data = data
    else:
        return ["Manifest must be a list of items or an object with an 'items' list"]

    if not items_raw:
        return ["Manifest contains no items"]

    # --- auto-detect type ---
    detected: Literal["batch", "plot"] | None = None
    if manifest_type == "auto":
        first = items_raw[0] if items_raw else {}
        if isinstance(first, dict):
            if "data" in first and "intent" in first:
                detected = "plot"
            elif "input" in first and "caption" in first:
                detected = "batch"
        if detected is None:
            return [
                "Cannot auto-detect manifest type from first item. Use --type batch or --type plot."
            ]
    else:
        detected = manifest_type  # type: ignore[assignment]

    parent = manifest_path.parent

    if detected == "batch":
        required = {"input", "caption"}
        known = _BATCH_KNOWN_KEYS
    else:
        required = {"data", "intent"}
        known = _PLOT_BATCH_KNOWN_KEYS

    seen_ids: 
```

### Core Architecture Module: `paperbanana/core/composite.py`
```
"""Composite figure generation: stitch multiple images into a labeled grid."""

from __future__ import annotations

import string
from pathlib import Path
from typing import Any, Literal, Optional

import structlog
from PIL import Image, ImageDraw, ImageFont

logger = structlog.get_logger()

# Default settings
DEFAULT_SPACING = 20
DEFAULT_LABEL_FONT_SIZE = 32
DEFAULT_BG_COLOR = (255, 255, 255)
DEFAULT_LABEL_COLOR = (0, 0, 0)


def _auto_labels(count: int) -> list[str]:
    """Generate (a), (b), (c), ... labels."""
    return [f"({c})" for c in string.ascii_lowercase[:count]]


def _parse_layout(layout: str, image_count: int) -> tuple[int, int]:
    """Parse a layout string like '2x3' into (rows, cols).

    Also accepts 'auto' which picks a reasonable grid for the image count.
    """
    if layout.lower() == "auto":
        if image_count <= 3:
            return 1, image_count
        if image_count <= 4:
            return 2, 2
        if image_count <= 6:
            return 2, 3
        if image_count <= 9:
            return 3, 3
        cols = 4
        rows = (image_count + cols - 1) // cols
        return rows, cols

    parts = layout.lower().split("x")
    if len(parts) != 2:
        raise ValueError(f"Layout must be 'RxC' (e.g. '2x3') or 'auto'. Got: {layout!r}")
    try:
        rows, cols = int(parts[0]), int(parts[1])
    except ValueError:
        raise ValueError(f"Layout must be 'RxC' with integers. Got: {layout!r}")
    if rows < 1 or cols < 1:
        raise ValueError(f"Layout rows and cols must be >= 1. Got: {rows}x{cols}")
    if rows * cols < image_count:
        raise ValueError(
            f"Layout {rows}x{cols} ({rows * cols} cells) cannot fit {image_count} images"
        )
    return rows, cols


def _get_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Try to load a TrueType font, fall back to default."""
    try:
        return ImageFont.truetype("DejaVuSans-Bold.ttf", size)
    except (OSError, IOError):
        try:
            return ImageFont.truetype("Arial Bold.ttf", size)
        except (OSError, IOError):
            return ImageFont.load_default()


def compose_images(
    image_paths: list[str | Path],
    *,
    layout: str = "auto",
    labels: Optional[list[str]] = None,
    auto_label: bool = True,
    spacing: int = DEFAULT_SPACING,
    label_position: Literal["top", "bottom"] = "bottom",
    label_font_size: int = DEFAULT_LABEL_FONT_SIZE,
    bg_color: tuple[int, int, int] = DEFAULT_BG_COLOR,
    label_color: tuple[int, int, int] = DEFAULT_LABEL_COLOR,
    output_path: Optional[str | Path] = None,
) -> Image.Image:
    """Compose multiple images into a single labeled grid.

    Args:
        image_paths: Paths to input images.
        layout: Grid layout as 'RxC' (e.g. '1x3', '2x2') or 'auto'.
        labels: Explicit labels per panel. Overrides auto_label.
        auto_label: If True and labels is None, generate (a), (b), (c), ...
        spacing: Pixel spacing between panels and around edges.
        label_position: Place labels 'top' or 'bottom' of each panel.
        label_font_size: Font size for labels.
        bg_color: Background color (RGB).
        label_color: Label text color (RGB).
        output_path: If provided, save the composite image to this path.

    Returns:
        The composite PIL Image.
    """
    if not image_paths:
        raise ValueError("At least one image path is required")

    # Load images
    images: list[Image.Image] = []
    for p in image_paths:
        img = Image.open(p).convert("RGB")
        images.append(img)

    count = len(images)
    rows, cols = _parse_layout(layout, count)

    # Resolve labels
    panel_labels: list[str] | None = None
    if labels is not None:
        if len(labels) != count:
            raise ValueError(f"Expected {count} labels, got {len(labels)}")
        panel_labels = labels
    elif auto_label:
        panel_labels = _auto_labels(count)

    # Calculate label height
    label_height = 0
    font = _get_font(label_font_size)
    if panel_labels:
        label_height = label_font_size + 8  # text height + padding

    # Resize panels: equal height per row, preserving aspect ratio
    # First pass: determine target cell size
    # Scale all images to have the same height, then figure out column widths
    target_row_height = min(img.size[1] for img in images)
    # Cap at a reasonable maximum
    target_row_height = min(target_row_height, 1200)

    scaled: list[Image.Image] = []
    for img in images:
        w, h = img.size
        if h != target_row_height:
            scale = target_row_height / h
            new_w = max(1, round(w * scale))
            img = img.resize((new_w, target_row_height), Image.LANCZOS)
        scaled.append(img)

    # Determine column widths: max width in each column
    col_widths = [0] * cols
    for i, img in enumerate(scaled):
        col = i % cols
        col_widths[col] = max(col_widths[col], img.size[0])

    # Build the composite
    cell_height = target_row_height + label_height
    total_width = sum(col_widths) + spacing * (cols + 1)
    total_height = cell_height * rows + spacing * (rows + 1)

    composite = Image.new("RGB", (total_width, total_height), bg_color)
    draw = ImageDraw.Draw(composite)

    for i, img in enumerate(scaled):
        row = i // cols
        col = i % cols

        # Calculate position: center image within its cell column
        x_offset = spacing + sum(col_widths[:col]) + spacing * col
        x_center_offset = (col_widths[col] - img.size[0]) // 2
        y_offset = spacing + row * (cell_height + spacing)

        if label_position == "top" and panel_labels:
            img_y = y_offset + label_height
        else:
            img_y = y_offset

        composite.paste(img, (x_offset + x_center_offset, img_y))

        # Draw label
        if panel_labels and i < len(panel_labels):
            label_text = panel_labels[i]
            bbox = draw.textbbox((0, 0), label_text, font=font)
            text_w = bbox[2] - bbox[0]
            label_x = x_offset + (col_widths[col] - text_w) // 2

            if label_position == "top":
                label_y = y_offset + 2
            else:
                label_y = img_y + img.size[1] + 2

            draw.text((label_x, label_y), label_text, fill=label_color, font=font)

    if output_path is not None:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        composite.save(str(output_path))
        logger.info("Composite image saved", path=str(output_path), panels=count, layout=layout)

    return composite


def parse_composite_config(manifest_data: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Extract and validate the optional 'composite' section from a batch manifest.

    Returns None if no composite section is present.
    """
    composite = manifest_data.get("composite")
    if composite is None:
        return None
    if not isinstance(composite, dict):
        raise ValueError("'composite' must be a mapping")

    config: dict[str, Any] = {}

    layout = composite.get("layout", "auto")
    if not isinstance(layout, str):
        raise ValueError("composite.layout must be a string (e.g. '2x3' or 'auto')")
    config["layout"] = layout

    labels = composite.get("labels", "auto")
    if isinstance(labels, str) and labels.lower() == "auto":
        config["auto_label"] = True
        config["labels"] = None
    elif isinstance(labels, list):
        config["auto_label"] = False
        config["labels"] = [str(item) for item in labels]
    elif labels is None or labels is False:
        config["auto_label"] = False
        config["labels"] = None
    else:
        raise ValueError("composite.labels must be 'auto', a list of strings, or null")

    spacing = composite.get("spacing", DEFAULT_SPACING)
    if not isinstance(spacing, int) or spacing < 0:
        raise ValueError("composite.spacing must be a non-negative integer")
    config["spacing"] = spacing

    label_position = composite.get("label_position", "bottom")
    if label_position not in ("top", "bottom"):
        raise ValueError("composite.label_position must be 'top' or 'bottom'")
    config["label_position"] = label_position

    config["output"] = composite.get("output")

    return config

```

### Core Architecture Module: `paperbanana/core/config.py`
```
"""Configuration management for PaperBanana."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Literal, Optional

import yaml
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings

OutputFormat = Literal["png", "jpeg", "webp"]
ImageQuality = Literal["low", "medium", "high", "auto"]
ExemplarRetrievalMode = Literal["external_only", "external_then_rerank"]
# Venue is an open name resolved against built-in and user style packs at
# pipeline startup (see paperbanana.guidelines.venues). Kept as an alias for
# backward compatibility with earlier Literal-based typing.
Venue = str
VectorExportMode = Literal["none", "svg", "pdf", "both"]


class VLMConfig(BaseSettings):
    """VLM provider configuration."""

    provider: str = "gemini"
    model: str = "gemini-2.5-flash"


class ImageConfig(BaseSettings):
    """Image generation provider configuration."""

    provider: str = "google_imagen"
    model: str = "gemini-3-pro-image-preview"


class PipelineConfig(BaseSettings):
    """Pipeline execution configuration."""

    num_retrieval_examples: int = 10
    refinement_iterations: int = 3
    output_resolution: str = "2k"
    diagram_type: str = "methodology"


class ReferenceConfig(BaseSettings):
    """Reference set configuration."""

    path: str = "data/reference_sets"
    guidelines_path: str = "data/guidelines"


class OutputConfig(BaseSettings):
    """Output configuration."""

    dir: str = "outputs"
    format: str = "png"
    save_iterations: bool = True
    save_prompts: bool = True
    save_metadata: bool = True


class Settings(BaseSettings):
    """Main PaperBanana settings, loaded from env vars and config files."""

    # Provider settings
    vlm_provider: str = Field(default="gemini", alias="VLM_PROVIDER")
    vlm_model: str = Field(default="gemini-2.5-flash", alias="VLM_MODEL")
    image_provider: str = Field(default="google_imagen", alias="IMAGE_PROVIDER")
    image_model: str = Field(default="gemini-3-pro-image-preview", alias="IMAGE_MODEL")

    # Pipeline settings
    num_retrieval_examples: int = 10
    refinement_iterations: int = 3
    auto_refine: bool = False
    max_iterations: int = 30
    optimize_inputs: bool = False
    output_resolution: str = Field(default="2k", alias="OUTPUT_RESOLUTION")
    image_quality: ImageQuality = Field(default="auto", alias="IMAGE_QUALITY")
    seed: Optional[int] = None
    exemplar_retrieval_enabled: bool = False
    exemplar_retrieval_endpoint: Optional[str] = None
    exemplar_retrieval_mode: ExemplarRetrievalMode = "external_then_rerank"
    exemplar_retrieval_top_k: int = 10
    exemplar_retrieval_timeout_seconds: float = 20.0
    exemplar_retrieval_max_retries: int = 2
    venue: Venue = "neurips"
    venue_dir: Optional[str] = Field(
        default=None,
        alias="PAPERBANANA_VENUE_DIR",
        description="User venue style pack directory (default: ~/.config/paperbanana/venues)",
    )
    vector_export: VectorExportMode = "none"
    num_candidates: int = Field(
        default=1,
        ge=1,
        le=8,
        description="Number of parallel Phase-2 candidate branches (1-8)",
    )

    # Reference settings
    reference_set_path: str = "data/reference_sets"
    reference_category: Optional[list[str]] = None
    guidelines_path: str = "data/guidelines"

    # Cache settings
    cache_dir: Optional[str] = Field(default=None, alias="PAPERBANANA_CACHE_DIR")

    # Cost tracking
    budget_usd: Optional[float] = Field(
        default=None, gt=0, description="Budget cap in USD; pipeline aborts if exceeded"
    )

    # Output settings
    output_dir: str = "outputs"
    output_format: OutputFormat = "png"
    save_iterations: bool = True
    save_prompts: bool = True
    export_tikz: bool = False
    export_pgfplots: bool = False

    # Prompt settings
    prompt_dir: Optional[str] = None

    # Caption generation
    generate_caption: bool = False

    # Benchmark settings
    benchmark_concurrency: int = 1

    # API Keys (loaded from environment)
    google_api_key: Optional[str] = Field(default=None, alias="GOOGLE_API_KEY")
    openrouter_api_key: Optional[str] = Field(default=None, alias="OPENROUTER_API_KEY")
    openai_api_key: Optional[str] = Field(default=None, alias="OPENAI_API_KEY")
    atlascloud_api_key: Optional[str] = Field(default=None, alias="ATLASCLOUD_API_KEY")
    anthropic_api_key: Optional[str] = Field(default=None, alias="ANTHROPIC_API_KEY")
    google_base_url: Optional[str] = Field(default=None, alias="GOOGLE_BASE_URL")
    google_vlm_model: Optional[str] = Field(default=None, alias="GOOGLE_VLM_MODEL")
    google_image_model: Optional[str] = Field(default=None, alias="GOOGLE_IMAGE_MODEL")
    openai_base_url: str = Field(default="https://api.openai.com/v1", alias="OPENAI_BASE_URL")
    openai_vlm_model: Optional[str] = Field(default=None, alias="OPENAI_VLM_MODEL")
    openai_image_model: Optional[str] = Field(default=None, alias="OPENAI_IMAGE_MODEL")
    atlascloud_base_url: str = Field(
        default="https://api.atlascloud.ai/v1",
        alias="ATLASCLOUD_BASE_URL",
    )
    atlascloud_vlm_model: Optional[str] = Field(default=None, alias="ATLASCLOUD_VLM_MODEL")
    atlascloud_image_base_url: str = Field(
        default="https://api.atlascloud.ai/api/v1",
        alias="ATLASCLOUD_IMAGE_BASE_URL",
    )
    atlascloud_image_model: Optional[str] = Field(default=None, alias="ATLASCLOUD_IMAGE_MODEL")

    ollama_base_url: str = Field(default="http://localhost:11434/v1", alias="OLLAMA_BASE_URL")
    ollama_model: Optional[str] = Field(default=None, alias="OLLAMA_MODEL")
    ollama_json_mode: bool = Field(default=False, alias="OLLAMA_JSON_MODE")
    openai_local_base_url: str = Field(
        default="http://localhost:8000/v1",
        alias="OPENAI_LOCAL_BASE_URL",
    )
    openai_local_json_mode: bool = Field(default=False, alias="OPENAI_LOCAL_JSON_MODE")

    # LiteLLM settings
    litellm_model: Optional[str] = Field(default=None, alias="LITELLM_MODEL")
    litellm_api_key: Optional[str] = Field(default=None, alias="LITELLM_API_KEY")
    litellm_api_base: Optional[str] = Field(default=None, alias="LITELLM_API_BASE")

    # AWS Bedrock settings
    aws_region: str = Field(default="us-east-1", alias="AWS_REGION")
    aws_profile: Optional[str] = Field(default=None, alias="AWS_PROFILE")
    bedrock_vlm_model: Optional[str] = Field(default=None, alias="BEDROCK_VLM_MODEL")
    bedrock_image_model: Optional[str] = Field(default=None, alias="BEDROCK_IMAGE_MODEL")

    @property
    def effective_vlm_model(self) -> str:
        """Return the VLM model for the active provider."""
        if self.vlm_provider == "gemini" and self.google_vlm_model:
            return self.google_vlm_model
        if self.vlm_provider == "openai" and self.openai_vlm_model:
            return self.openai_vlm_model
        if self.vlm_provider == "atlas" and self.atlascloud_vlm_model:
            return self.atlascloud_vlm_model
        if self.vlm_provider == "bedrock" and self.bedrock_vlm_model:
            return self.bedrock_vlm_model
        return self.vlm_model

    @property
    def effective_image_model(self) -> str:
        """Return the image model for the active provider."""
        if self.image_provider == "google_imagen" and self.google_image_model:
            return self.google_image_model
        if self.image_provider == "openai_imagen" and self.openai_image_model:
            return self.openai_image_model
        if self.image_provider == "atlas_imagen" and self.atlascloud_image_model:
            return self.atlascloud_image_model
        if self.image_provider == "bedrock_imagen" and self.bedrock_image_model:
            return self.bedrock_image_model
        return self.image_model

    # SSL
    skip_ssl_verification: bool = Field(default=False, alias="SKIP_SSL_VERIFICATION")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
        "populate_by_name": True,
    }

    @field_validator("output_format", mode="before")
    @classmethod
    def validate_output_format(cls, v: Any) -> str:
        """Validate output_format is png, jpeg, or webp (case-insensitive)."""
        if v is None:
            return "png"
        v = str(v).lower()
        if v not in ("png", "jpeg", "webp"):
            raise ValueError(f"output_format must be png, jpeg, or webp. Got: {v}")
        return v

    @field_validator("output_resolution", mode="before")
    @classmethod
    def validate_output_resolution(cls, v: Any) -> str:
        """Validate output_resolution is 1k, 2k, or 4k."""
        if v is None:
            return "2k"
        v = str(v).lower()
        if v not in ("1k", "2k", "4k"):
            raise ValueError(f"output_resolution must be 1k, 2k, or 4k. Got: {v}")
        return v

    @field_validator("image_quality", mode="before")
    @classmethod
    def validate_image_quality(cls, v: Any) -> str:
        """Validate image_quality is low, medium, high, or auto."""
        if v is None:
            return "auto"
        v = str(v).lower()
        if v not in ("low", "medium", "high", "auto"):
            raise ValueError(f"image_quality must be low, medium, high, or auto. Got: {v}")
        return v

    @field_validator("exemplar_retrieval_top_k")
    @classmethod
    def validate_exemplar_retrieval_top_k(cls, v: int) -> int:
        """Validate exemplar_retrieval_top_k is positive."""
        if v < 1:
            raise ValueError("exemplar_retrieval_top_k must be >= 1")
        return v

    @field_validator("exemplar_retrieval_timeout_seconds")
    @classmethod
    def validate_exemplar_retrieval_timeout(cls, v: float) -> float:
        """Validate exemplar_retrieval_timeout_seconds is positive."""
        if v <= 0:
            raise ValueError("exemplar_retrieval_timeout_seconds must be > 0")
        return v

    @field_validator("exemplar_retrieval_max_retries")
    @classmethod
```

### Core Architecture Module: `paperbanana/core/cost_estimator.py`
```
"""Dry-run cost estimation for PaperBanana pipeline runs."""

from __future__ import annotations

from paperbanana.core.config import Settings
from paperbanana.core.pricing import lookup_image_price, lookup_vlm_price
from paperbanana.core.types import DiagramType

# Average token counts per agent call (empirical estimates).
_AVG_TOKENS: dict[str, tuple[int, int]] = {
    # (input_tokens, output_tokens)
    "optimizer": (2000, 2000),
    "retriever": (3000, 500),
    "planner": (6000, 2000),
    "stylist": (3000, 2000),
    "structurer": (4000, 2000),
    "visualizer_vlm": (2000, 2000),  # for statistical plots (matplotlib code gen)
    "critic": (4000, 1500),
}


def estimate_cost(
    settings: Settings,
    diagram_type: DiagramType = DiagramType.METHODOLOGY,
) -> dict:
    """Estimate the cost of a pipeline run without making API calls.

    Returns a dict with estimated_total_usd, vlm_calls, image_calls,
    breakdown_by_agent, and pricing_note.
    """
    vlm_provider = settings.vlm_provider
    vlm_model = settings.effective_vlm_model
    image_provider = settings.image_provider
    image_model = settings.effective_image_model

    vlm_pricing = lookup_vlm_price(vlm_provider, vlm_model)
    image_pricing = lookup_image_price(image_provider, image_model)

    if settings.auto_refine:
        iterations = settings.max_iterations
    else:
        iterations = settings.refinement_iterations

    num_candidates = max(1, getattr(settings, "num_candidates", 1))

    # Count expected API calls
    vlm_calls = 0
    image_calls = 0
    breakdown: dict[str, float] = {}
    notes: list[str] = []

    def _vlm_cost(agent: str) -> float:
        nonlocal vlm_calls
        vlm_calls += 1
        if vlm_pricing is None:
            return 0.0
        inp, out = _AVG_TOKENS.get(agent, (3000, 1500))
        return inp * vlm_pricing["input_per_1k"] / 1000 + out * vlm_pricing["output_per_1k"] / 1000

    def _image_cost() -> float:
        nonlocal image_calls
        image_calls += 1
        if image_pricing is None:
            return 0.0
        return image_pricing

    # Phase 0: Optimizer (optional)
    if settings.optimize_inputs:
        breakdown["optimizer"] = _vlm_cost("optimizer")

    # Phase 1: Linear planning
    breakdown["retriever"] = _vlm_cost("retriever")
    breakdown["planner"] = _vlm_cost("planner")
    breakdown["stylist"] = _vlm_cost("stylist")

    ve = getattr(settings, "vector_export", "none")
    if diagram_type == DiagramType.METHODOLOGY and ve != "none":
        breakdown["structurer"] = _vlm_cost("structurer")

    # Phase 2: Iterative refinement. Multi-candidate fan-out runs Phase 2
    # once per candidate (Phase 1 planning is shared), so visualizer and
    # critic costs scale by num_candidates.
    vis_total = 0.0
    critic_total = 0.0
    for _ in range(iterations * num_candidates):
        if diagram_type == DiagramType.STATISTICAL_PLOT:
            vis_total += _vlm_cost("visualizer_vlm")
        else:
            vis_total += _image_cost()
        critic_total += _vlm_cost("critic")
    breakdown["visualizer"] = vis_total
    breakdown["critic"] = critic_total

    total = sum(breakdown.values())

    if vlm_pricing is None:
        notes.append(f"VLM pricing unknown for {vlm_provider}/{vlm_model}")
    if image_pricing is None:
        notes.append(f"Image pricing unknown for {image_provider}/{image_model}")
    if settings.auto_refine:
        notes.append(
            f"Auto-refine: estimated for max {iterations} iterations; "
            "actual cost may be lower if critic is satisfied early"
        )
    if num_candidates > 1:
        notes.append(
            f"Multi-candidate: visualizer/critic costs scaled by "
            f"{num_candidates} parallel candidates"
        )

    return {
        "estimated_total_usd": round(total, 6),
        "vlm_calls": vlm_calls,
        "image_calls": image_calls,
        "num_candidates": num_candidates,
        "breakdown_by_agent": {k: round(v, 6) for k, v in breakdown.items()},
        "pricing_note": "; ".join(notes) if notes else None,
    }

```

### Core Architecture Module: `paperbanana/core/cost_tracker.py`
```
"""Cost tracking and budget guard for PaperBanana pipeline runs."""

from __future__ import annotations

from dataclasses import dataclass, field

import structlog

from paperbanana.core.pricing import lookup_image_price, lookup_vlm_price

logger = structlog.get_logger()


@dataclass
class CostEntry:
    """A single API call's cost record."""

    provider: str
    model: str
    call_type: str  # "vlm" or "image_gen"
    agent: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    cost_usd: float = 0.0
    pricing_known: bool = True


@dataclass
class CostTracker:
    """Accumulates API call costs and enforces an optional budget cap.

    Injected into providers via their ``cost_tracker`` attribute.
    Providers call ``record_vlm_call`` / ``record_image_call`` after each API
    invocation; the tracker prices the call and checks the budget.
    """

    budget: float | None = None
    _entries: list[CostEntry] = field(default_factory=list)
    _current_agent: str = ""

    def set_agent(self, agent: str) -> None:
        """Set the current agent name for subsequent API call records."""
        self._current_agent = agent

    def record_vlm_call(
        self,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        agent: str = "",
    ) -> None:
        """Record a VLM API call and check budget."""
        agent = agent or self._current_agent
        pricing = lookup_vlm_price(provider, model)
        if pricing is not None:
            cost = (
                input_tokens * pricing["input_per_1k"] / 1000
                + output_tokens * pricing["output_per_1k"] / 1000
            )
            known = True
        else:
            cost = 0.0
            known = False

        entry = CostEntry(
            provider=provider,
            model=model,
            call_type="vlm",
            agent=agent,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost,
            pricing_known=known,
        )
        self._entries.append(entry)
        logger.debug(
            "Cost tracked (VLM)",
            agent=agent,
            cost=f"${cost:.6f}",
            total=f"${self.total_cost:.6f}",
        )
        if self.is_over_budget:
            logger.warning(
                "Budget exceeded during VLM call",
                agent=agent,
                budget=self.budget,
                spent=f"${self.total_cost:.6f}",
            )

    def record_image_call(
        self,
        provider: str,
        model: str,
        agent: str = "",
        count: int = 1,
    ) -> None:
        """Record an image generation API call and check budget."""
        agent = agent or self._current_agent
        price = lookup_image_price(provider, model)
        if price is not None:
            cost = price * count
            known = True
        else:
            cost = 0.0
            known = False

        entry = CostEntry(
            provider=provider,
            model=model,
            call_type="image_gen",
            agent=agent,
            cost_usd=cost,
            pricing_known=known,
        )
        self._entries.append(entry)
        logger.debug(
            "Cost tracked (image)",
            agent=agent,
            cost=f"${cost:.6f}",
            total=f"${self.total_cost:.6f}",
        )
        if self.is_over_budget:
            logger.warning(
                "Budget exceeded during image call",
                agent=agent,
                budget=self.budget,
                spent=f"${self.total_cost:.6f}",
            )

    @property
    def is_over_budget(self) -> bool:
        """Return True if cumulative cost exceeds the budget cap."""
        return self.budget is not None and self.total_cost > self.budget

    @property
    def total_cost(self) -> float:
        return sum(e.cost_usd for e in self._entries)

    @property
    def vlm_cost(self) -> float:
        return sum(e.cost_usd for e in self._entries if e.call_type == "vlm")

    @property
    def image_cost(self) -> float:
        return sum(e.cost_usd for e in self._entries if e.call_type == "image_gen")

    @property
    def pricing_complete(self) -> bool:
        return all(e.pricing_known for e in self._entries)

    @property
    def entries(self) -> list[CostEntry]:
        return list(self._entries)

    def summary(self) -> dict:
        """Return a dict suitable for metadata.json and terminal display."""
        by_agent: dict[str, float] = {}
        for e in self._entries:
            by_agent[e.agent] = by_agent.get(e.agent, 0.0) + e.cost_usd

        return {
            "total_usd": round(self.total_cost, 6),
            "vlm_usd": round(self.vlm_cost, 6),
            "image_usd": round(self.image_cost, 6),
            "pricing_complete": self.pricing_complete,
            "num_vlm_calls": sum(1 for e in self._entries if e.call_type == "vlm"),
            "num_image_calls": sum(1 for e in self._entries if e.call_type == "image_gen"),
            "by_agent": {k: round(v, 6) for k, v in by_agent.items()},
        }

```

### Core Architecture Module: `paperbanana/core/diagram_ir.py`
```
"""Diagram IR extraction and SVG export helpers."""

from __future__ import annotations

import base64
import html
import re
from pathlib import Path

from paperbanana.core.types import DiagramIR, DiagramIREdge, DiagramIRNode


def _select_ports(
    src_xy: tuple[int, int],
    dst_xy: tuple[int, int],
    node_w: int,
    node_h: int,
    same_lane: bool,
) -> tuple[tuple[int, int], tuple[int, int]]:
    """Select source/target connection ports (left/right/top/bottom)."""
    sx, sy = src_xy
    dx, dy = dst_xy
    src_cx = sx + node_w // 2
    src_cy = sy + node_h // 2
    dst_cx = dx + node_w // 2
    dst_cy = dy + node_h // 2
    dx_c = dst_cx - src_cx
    dy_c = dst_cy - src_cy

    if same_lane:
        if dx_c >= 0:
            return (sx + node_w, src_cy), (dx, dst_cy)
        return (sx, src_cy), (dx + node_w, dst_cy)

    # Cross-lane: prefer vertical ports if primarily vertical relation,
    # else horizontal ports when the nodes are strongly side-separated.
    if abs(dy_c) > abs(dx_c):
        if dy_c >= 0:
            return (src_cx, sy + node_h), (dst_cx, dy)
        return (src_cx, sy), (dst_cx, dy + node_h)

    if dx_c >= 0:
        return (sx + node_w, src_cy), (dx, dst_cy)
    return (sx, src_cy), (dx + node_w, dst_cy)


def _port_side(node_xy: tuple[int, int], port_xy: tuple[int, int], node_w: int, node_h: int) -> str:
    """Return side name for a selected port relative to node rect."""
    x, y = node_xy
    px, py = port_xy
    if px == x:
        return "left"
    if px == x + node_w:
        return "right"
    if py == y:
        return "top"
    if py == y + node_h:
        return "bottom"
    return "right"


def _balanced_port(
    node_xy: tuple[int, int],
    side: str,
    node_w: int,
    node_h: int,
    slot_idx: int,
    slot_count: int,
) -> tuple[int, int]:
    """Compute a balanced anchor point on a node side."""
    x, y = node_xy
    # Keep anchors away from corners.
    if slot_count < 1:
        slot_count = 1
    frac = (slot_idx + 1) / (slot_count + 1)
    if side == "left":
        return (x, y + int(node_h * frac))
    if side == "right":
        return (x + node_w, y + int(node_h * frac))
    if side == "top":
        return (x + int(node_w * frac), y)
    if side == "bottom":
        return (x + int(node_w * frac), y + node_h)
    return (x + node_w, y + node_h // 2)


def extract_diagram_ir(description: str, title: str = "PaperBanana Diagram") -> DiagramIR:
    """Build a simple ordered IR from a textual diagram description.

    This heuristic parser favors predictable editability over perfect semantic parsing:
    - numbered lines / bullets become nodes
    - edges connect nodes in order
    """
    lines = [ln.strip() for ln in description.splitlines()]
    candidates: list[str] = []
    for ln in lines:
        if not ln:
            continue
        cleaned = re.sub(r"^(\d+[\).\s-]+|[-*]\s+)", "", ln).strip()
        if len(cleaned) < 3:
            continue
        if cleaned.lower().startswith(("note:", "legend:", "style:", "color:")):
            continue
        candidates.append(cleaned)

    # De-duplicate while preserving order.
    seen: set[str] = set()
    labels: list[str] = []
    for c in candidates:
        key = c.lower()
        if key in seen:
            continue
        seen.add(key)
        labels.append(c)
        if len(labels) >= 12:
            break

    if not labels:
        labels = ["Input", "Core method", "Output"]

    nodes = [
        DiagramIRNode(
            id=f"n{i + 1}",
            label=(label if len(label) <= 72 else (label[:69] + "...")),
        )
        for i, label in enumerate(labels)
    ]
    edges = [
        DiagramIREdge(source=nodes[i].id, target=nodes[i + 1].id)
        for i in range(max(0, len(nodes) - 1))
    ]
    return DiagramIR(title=title, nodes=nodes, edges=edges)


def format_diagram_ir_for_regeneration(diagram_ir: DiagramIR) -> str:
    """Create a lock-aware textual description from DiagramIR."""
    locked_nodes = set(diagram_ir.locks.locked_node_ids)
    locked_edges = set(diagram_ir.locks.locked_edge_refs)
    locked_groups = set(diagram_ir.locks.locked_group_ids)

    lines: list[str] = [f"Figure title: {diagram_ir.title}", "", "Nodes:"]
    for node in diagram_ir.nodes:
        lane = f" [lane={node.lane}]" if node.lane else ""
        lock = " [LOCKED]" if node.id in locked_nodes else ""
        lines.append(f"- {node.id}: {node.label}{lane}{lock}")

    if diagram_ir.groups:
        lines.extend(["", "Groups:"])
        for group in diagram_ir.groups:
            node_ids = ", ".join(group.node_ids)
            lock = " [LOCKED]" if group.id in locked_groups else ""
            lines.append(f"- {group.id}: {group.label} -> ({node_ids}){lock}")

    lines.extend(["", "Edges:"])
    for edge in diagram_ir.edges:
        edge_ref = edge.id or f"{edge.source}->{edge.target}"
        lock = " [LOCKED]" if edge_ref in locked_edges else ""
        label = f" ({edge.label})" if edge.label else ""
        lines.append(f"- {edge.source} -> {edge.target}{label} [ref={edge_ref}]{lock}")

    if locked_nodes or locked_edges or locked_groups:
        lines.extend(
            [
                "",
                "Hard constraints:",
                "- Preserve every element marked [LOCKED] exactly (ID, text, and connections).",
                "- You may improve only unlocked elements for clarity and aesthetics.",
                "- Do not remove or rename locked IDs.",
            ]
        )

    return "\n".join(lines).strip()


def save_svg_from_ir(diagram_ir: DiagramIR, output_path: str | Path) -> Path:
    """Render an editable SVG from DiagramIR."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    width = 1600
    height = 900
    margin_x = 80
    margin_y = 120
    node_w = 240
    node_h = 90
    lane_gap = 28
    lane_h = 140
    top_y = margin_y + 56
    left_gutter = 170
    canvas_w = width - margin_x - left_gutter - 40

    parts: list[str] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
        f'viewBox="0 0 {width} {height}">',
        "<defs>",
        '<marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">',
        '<path d="M0,0 L0,6 L9,3 z" fill="#4b5563" />',
        "</marker>",
        "</defs>",
        '<rect width="100%" height="100%" fill="#ffffff"/>',
        f'<text x="{margin_x}" y="70" font-family="Arial, sans-serif" font-size="34" '
        'font-weight="700" fill="#111827">'
        f"{html.escape(diagram_ir.title)}</text>",
    ]

    # Determine lane order from groups, then node lane labels, then fallback.
    lane_order: list[str] = []
    for g in diagram_ir.groups:
        if g.label not in lane_order:
            lane_order.append(g.label)
    for n in diagram_ir.nodes:
        ln = (n.lane or "").strip()
        if ln and ln not in lane_order:
            lane_order.append(ln)
    if not lane_order:
        lane_order = ["Main"]

    lane_colors = [
        "#eff6ff",
        "#f5f3ff",
        "#ecfeff",
        "#f0fdf4",
        "#fff7ed",
    ]
    lane_y: dict[str, int] = {}
    for i, lane in enumerate(lane_order):
        y = top_y + i * (lane_h + lane_gap)
        lane_y[lane] = y
        bg = lane_colors[i % len(lane_colors)]
        parts.append(
            f'<rect x="{margin_x}" y="{y}" width="{width - 2 * margin_x}" '
            f'height="{lane_h}" rx="14" '
            f'fill="{bg}" stroke="#cbd5e1" stroke-width="1.5"/>'
        )
        parts.append(
            f'<text x="{margin_x + 16}" y="{y + 34}" '
            'font-family="Arial, sans-serif" font-size="20" '
            'font-weight="700" fill="#334155">'
            f"{html.escape(lane)}</text>"
        )

    # Place nodes in columns within each lane.
    lane_nodes: dict[str, list[DiagramIRNode]] = {k: [] for k in lane_order}
    locked_nodes = set(diagram_ir.locks.locked_node_ids)
    for node in diagram_ir.nodes:
        lane = (node.lane or "").strip() or lane_order[0]
        if lane not in lane_nodes:
            lane_nodes[lane] = []
            lane_y[lane] = top_y + len(lane_y) * (lane_h + lane_gap)
        lane_nodes[lane].append(node)

    node_pos: dict[str, tuple[int, int]] = {}
    max_cols = max((len(v) for v in lane_nodes.values()), default=1)
    step_x = max(260, (canvas_w - node_w) // max(1, max_cols - 1))
    for lane in lane_order:
        y = lane_y[lane] + 38
        for i, node in enumerate(lane_nodes.get(lane, [])):
            x = margin_x + left_gutter + i * step_x
            node_pos[node.id] = (x, y)
            is_locked = node.id in locked_nodes
            stroke_color = "#2563eb" if is_locked else "#94a3b8"
            parts.append(
                f'<rect x="{x}" y="{y}" width="{node_w}" height="{node_h}" rx="12" '
                f'fill="#f8fafc" stroke="{stroke_color}" stroke-width="2"/>'
            )
            parts.append(
                f'<text x="{x + 16}" y="{y + 34}" font-family="Arial, sans-serif" font-size="18" '
                'fill="#111827">'
                f"{html.escape(node.label)}</text>"
            )
            if is_locked:
                parts.append(
                    f'<text x="{x + node_w - 50}" y="{y + 24}" '
                    'font-family="Arial, sans-serif" font-size="12" '
                    'font-weight="700" fill="#1d4ed8">LOCK</text>'
                )

    edge_label_offsets: dict[tuple[int, int], int] = {}
    route_channel_counts: dict[tuple[int, int], int] = {}
    lane_index = {lane: i for i, lane in enumerate(lane_order)}
    lane_channel_y = {
        lane: lane_y[lane] + 22 for lane in lane_order
    }  # header band, clear of node boxes
    bus_base_x = margin_x + left_gutter - 56
    bus_step = 18
    lane_pair_bus: dict[tuple[str, str], int] = {}

    # Pre-compute occupancy counts for each node side.
    node_lookup 
```

### Core Architecture Module: `paperbanana/core/logging.py`
```
"""Logging configuration for PaperBanana."""

from __future__ import annotations

import logging

import structlog


def configure_logging(*, verbose: bool = False) -> None:
    """Configure structlog output level.

    Args:
        verbose: If True, show detailed agent progress and timing at DEBUG level.
                 If False (default), suppress logs below WARNING for clean output.
    """
    level = logging.DEBUG if verbose else logging.WARNING

    structlog.configure(
        wrapper_class=structlog.make_filtering_bound_logger(level),
    )

```

### Core Architecture Module: `paperbanana/core/orchestrate.py`
```
"""Paper-level figure orchestration utilities."""

from __future__ import annotations

import asyncio
import datetime
import json
import os
import re
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Callable

from paperbanana.core.config import Settings
from paperbanana.core.plot_data import load_statistical_plot_payload
from paperbanana.core.source_loader import load_methodology_source
from paperbanana.core.types import DiagramType, GenerationInput

_HEADING_NUMBERED_RE = re.compile(r"^\s*(\d+(?:\.\d+)*)\s+(.+?)\s*$")
_HEADING_SIMPLE_RE = re.compile(r"^\s*([A-Z][A-Za-z0-9 ,:/()\-]{3,100})\s*$")
_PAGE_NUMBER_RE = re.compile(r"^\s*(?:page\s+)?\d+(?:\s*/\s*\d+)?\s*$", re.IGNORECASE)

_METHOD_FIGURE_HINTS: list[tuple[str, str]] = [
    ("overview", "System overview and major processing blocks"),
    ("architecture", "Detailed architecture with key module boundaries"),
    ("method", "Method flow from inputs to outputs"),
    ("pipeline", "Training and inference pipeline with stage dependencies"),
    ("training", "Training procedure and optimization workflow"),
    ("inference", "Inference workflow and serving path"),
    ("experiment", "Experimental setup and evaluation pipeline"),
    ("ablation", "Ablation design and comparison setup"),
]

_PLOT_INTENT_HINTS: list[tuple[str, str]] = [
    ("ablation", "Bar chart comparing ablation variants and performance"),
    ("benchmark", "Grouped bar chart comparing benchmark performance across models"),
    ("leaderboard", "Ranked bar chart showing model leaderboard results"),
    ("result", "Comparative chart summarizing key experiment results"),
    ("latency", "Scatter plot of latency versus quality across variants"),
    ("speed", "Line chart showing runtime trend across settings"),
    ("cost", "Bar chart comparing cost and quality trade-offs"),
]

ORCHESTRATION_CHECKPOINT_FILENAME = "orchestration_checkpoint.json"
ORCHESTRATION_REPORT_FILENAME = "figure_package.json"


def generate_orchestration_id() -> str:
    """Generate a unique orchestration run identifier."""
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    suffix = uuid.uuid4().hex[:6]
    return f"orchestrate_{ts}_{suffix}"


def load_paper_text(paper_path: Path, *, pdf_pages: str | None = None) -> str:
    """Load paper text from a file path (txt/md/pdf)."""
    return load_methodology_source(Path(paper_path), pdf_pages=pdf_pages)


def extract_paper_title(paper_text: str, fallback_path: Path) -> str:
    """Infer a display title from the paper text."""
    for raw in paper_text.splitlines()[:40]:
        line = raw.strip()
        if not line:
            continue
        if len(line) < 8:
            continue
        if len(line) > 140:
            continue
        if line.lower().startswith(("arxiv", "http://", "https://", "doi:")):
            continue
        return line
    return fallback_path.stem.replace("_", " ").strip() or "Untitled Paper"


def _looks_like_heading(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if stripped.endswith("."):
        return False
    if len(stripped) < 4 or len(stripped) > 110:
        return False
    if _HEADING_NUMBERED_RE.match(stripped):
        return True
    if _HEADING_SIMPLE_RE.match(stripped):
        words = stripped.split()
        if len(words) > 16:
            return False
        if stripped.lower() in {"abstract", "introduction", "conclusion", "references"}:
            return True
        # Allow title-case / uppercase section-like headings.
        uppercase_ratio = sum(1 for c in stripped if c.isupper()) / max(len(stripped), 1)
        if uppercase_ratio > 0.25:
            return True
        if all(w[:1].isupper() for w in words if w and w[0].isalpha()):
            return True
    return False


def _is_pdf_noise_line(line: str, repeated_count: int) -> bool:
    """Filter common PDF extraction noise like page numbers and running headers."""
    stripped = line.strip()
    if not stripped:
        return True
    if _PAGE_NUMBER_RE.match(stripped):
        return True
    if stripped.lower().startswith("page ") and any(ch.isdigit() for ch in stripped):
        return True
    if repeated_count > 1 and not _HEADING_NUMBERED_RE.match(stripped):
        lowered = stripped.lower()
        if lowered not in {"abstract", "introduction", "conclusion", "references"}:
            return True
    return False


def split_paper_sections(paper_text: str) -> list[dict[str, str]]:
    """Split paper text into section chunks by heading heuristics."""
    lines = paper_text.splitlines()
    counts: dict[str, int] = {}
    for line in lines:
        stripped = line.strip()
        if stripped:
            counts[stripped] = counts.get(stripped, 0) + 1

    headings: list[tuple[int, str]] = []
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if _is_pdf_noise_line(stripped, counts.get(stripped, 0)):
            continue
        if _looks_like_heading(line):
            heading = stripped
            if headings and headings[-1][1] == heading:
                continue
            headings.append((idx, heading))

    if not headings:
        text = paper_text.strip()
        if not text:
            return []
        return [{"heading": "Paper Content", "content": text}]

    sections: list[dict[str, str]] = []
    for i, (start, heading) in enumerate(headings):
        end = headings[i + 1][0] if i + 1 < len(headings) else len(lines)
        content_lines = []
        for raw in lines[start + 1 : end]:
            stripped = raw.strip()
            if _is_pdf_noise_line(stripped, counts.get(stripped, 0)):
                continue
            content_lines.append(raw)
        content = "\n".join(content_lines).strip()
        if not content:
            continue
        sections.append({"heading": heading, "content": content})

    if not sections:
        return [{"heading": "Paper Content", "content": paper_text.strip()}]
    return sections


def _trim_text(text: str, max_chars: int = 3500) -> str:
    s = (text or "").strip()
    if len(s) <= max_chars:
        return s
    return s[:max_chars].rstrip() + "\n\n[truncated]"


def _best_method_hint(heading: str, content: str) -> str:
    source = f"{heading}\n{content}".lower()
    for key, hint in _METHOD_FIGURE_HINTS:
        if key in source:
            return hint
    return "Method component interaction and information flow"


def _build_method_caption(index: int, heading: str, content: str) -> str:
    hint = _best_method_hint(heading, content)
    title = heading.strip() or f"Method Figure {index}"
    return f"{title}: {hint}."


def plan_methodology_figures(
    *,
    paper_text: str,
    max_figures: int,
) -> list[dict[str, str]]:
    """Plan methodology figure items from paper sections."""
    sections = split_paper_sections(paper_text)
    if not sections:
        return []

    selected: list[dict[str, str]] = []
    for section in sections:
        if len(selected) >= max_figures:
            break
        heading = section["heading"]
        content = section["content"]
        caption = _build_method_caption(len(selected) + 1, heading, content)
        context = f"Section: {heading}\n\n{_trim_text(content)}"
        selected.append(
            {
                "id": f"method_{len(selected) + 1:02d}",
                "heading": heading,
                "caption": caption,
                "context": context,
                "label": f"fig:method_{len(selected) + 1:02d}",
            }
        )

    return selected


def _guess_plot_intent(path: Path) -> str:
    name = path.stem.replace("_", " ").replace("-", " ").strip().lower()
    for key, intent in _PLOT_INTENT_HINTS:
        if key in name:
            return f"{intent} from {path.stem}."
    return f"Comparative chart highlighting key metrics from {path.stem}."


def discover_plot_data_files(data_dir: Path) -> list[Path]:
    """Find candidate CSV/JSON files for plot generation."""
    root = Path(data_dir)
    if not root.exists() or not root.is_dir():
        return []
    discovered: list[Path] = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in (".csv", ".json"):
            continue
        # Avoid loading generated report/checkpoint files.
        if path.name in {"batch_report.json", "batch_checkpoint.json", "metadata.json"}:
            continue
        discovered.append(path.resolve())
    discovered.sort(key=lambda p: str(p))
    return discovered


def plan_plot_figures(*, data_dir: Path | None, max_figures: int) -> list[dict[str, str]]:
    """Plan plot figure items from discovered data files."""
    if data_dir is None:
        return []
    files = discover_plot_data_files(data_dir)
    if not files:
        return []
    selected = files[:max_figures]
    items: list[dict[str, str]] = []
    for idx, path in enumerate(selected, start=1):
        items.append(
            {
                "id": f"plot_{idx:02d}",
                "data": str(path),
                "intent": _guess_plot_intent(path),
                "label": f"fig:plot_{idx:02d}",
            }
        )
    return items


def build_orchestration_plan(
    *,
    paper_path: Path,
    paper_text: str,
    data_dir: Path | None,
    max_method_figures: int,
    max_plot_figures: int,
) -> dict[str, Any]:
    """Build a complete figure-package plan for orchestration."""
    title = extract_paper_title(paper_text, paper_path)
    method_items = plan_methodology_figures(paper_text=paper_text, max_figures=max_method_figures)
    plot_items = plan_plot_figures(data_dir=data_dir, max_figures=max_plot_figures)
    return {
        "paper_title": title,
        "paper_path": str(Path(paper_path).resolve()),
        "methodology_items": method_items,
        "plot_items": plot_items,
    }


def prepare_orchestration_plan(
    *,
    paper: str | None,
    resume_or
```

### Core Architecture Module: `paperbanana/core/pdf_text.py`
```
"""Extract plain text from PDF files (optional pymupdf dependency)."""

from __future__ import annotations

from pathlib import Path

_PDF_INSTALL_HINT = "Install PyMuPDF: pip install 'paperbanana[pdf]' or pip install pymupdf"


def parse_pdf_pages_spec(spec: str | None, page_count: int) -> list[int]:
    """Resolve a 1-based page selection into a sorted unique list of page numbers.

    *spec* is ``None``, empty, or whitespace only: all pages ``1 .. page_count``.
    Otherwise comma-separated tokens: single pages (``3``) or inclusive ranges (``2-5``).
    """
    if page_count < 1:
        raise ValueError("PDF has no pages")

    if spec is None or not str(spec).strip():
        return list(range(1, page_count + 1))

    seen: set[int] = set()
    for raw in str(spec).split(","):
        part = raw.strip()
        if not part:
            continue
        if "-" in part:
            left, right = part.split("-", 1)
            start = int(left.strip())
            end = int(right.strip())
        else:
            start = end = int(part)
        if start > end:
            start, end = end, start
        for p in range(start, end + 1):
            if p < 1 or p > page_count:
                raise ValueError(f"Page {p} is out of range for this PDF (1–{page_count})")
            seen.add(p)

    if not seen:
        return list(range(1, page_count + 1))

    return sorted(seen)


def extract_text_from_pdf(path: Path, pages_spec: str | None = None) -> str:
    """Open *path* and extract text from the selected pages (1-based *pages_spec*, see
    :func:`parse_pdf_pages_spec`). Pages are concatenated with clear separators.
    """
    try:
        import fitz  # PyMuPDF
    except ImportError as e:
        raise ImportError(f"PDF input requires PyMuPDF. {_PDF_INSTALL_HINT}") from e

    path = Path(path)
    doc = fitz.open(path)
    try:
        total = doc.page_count
        pages = parse_pdf_pages_spec(pages_spec, total)
        blocks: list[str] = []
        for p1 in pages:
            page = doc.load_page(p1 - 1)
            raw = page.get_text()
            text = raw.strip()
            if not text:
                text = "[no extractable text on this page]"
            blocks.append(f"--- Page {p1} ---\n\n{text}")
        return "\n\n".join(blocks)
    finally:
        doc.close()


def is_pdf_path(path: Path) -> bool:
    return path.suffix.lower() == ".pdf"

```

### Core Architecture Module: `paperbanana/core/pipeline.py`
```
"""Main PaperBanana pipeline orchestration."""

from __future__ import annotations

import asyncio
import datetime
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional

import structlog
from tenacity import AsyncRetrying, stop_after_attempt, wait_exponential

from paperbanana.agents.caption import CaptionAgent
from paperbanana.agents.critic import CriticAgent
from paperbanana.agents.ir_planner import IRPlannerAgent
from paperbanana.agents.optimizer import InputOptimizerAgent
from paperbanana.agents.planner import PlannerAgent
from paperbanana.agents.retriever import RetrieverAgent
from paperbanana.agents.structurer import StructurerAgent
from paperbanana.agents.stylist import StylistAgent
from paperbanana.agents.tikz_exporter import TikZExporterAgent
from paperbanana.agents.visualizer import VisualizerAgent
from paperbanana.core.config import Settings
from paperbanana.core.cost_tracker import CostTracker
from paperbanana.core.diagram_ir import (
    extract_diagram_ir,
    format_diagram_ir_for_regeneration,
    save_raster_wrapped_svg,
    save_svg_from_ir,
)
from paperbanana.core.prompt_recorder import PromptRecorder
from paperbanana.core.types import (
    CritiqueResult,
    DiagramIR,
    DiagramType,
    GenerationInput,
    GenerationOutput,
    IterationRecord,
    PipelineProgressEvent,
    PipelineProgressStage,
    ReferenceExample,
    RunMetadata,
)
from paperbanana.core.utils import (
    ensure_dir,
    find_prompt_dir,
    generate_run_id,
    load_image,
    save_image,
    save_json,
)
from paperbanana.guidelines.methodology import load_methodology_guidelines
from paperbanana.guidelines.plots import load_plot_guidelines
from paperbanana.guidelines.venues import VenuePack, resolve_venue, select_aspect_ratio
from paperbanana.providers.registry import ProviderRegistry
from paperbanana.reference.exemplar_retrieval import (
    ExemplarRetrievalError,
    ExternalExemplarRetriever,
    map_external_hits_to_examples,
)
from paperbanana.reference.store import ReferenceStore
from paperbanana.vector.graphviz_render import (
    diagram_ir_to_dot,
    find_dot_executable,
    render_dot_to_file,
)

logger = structlog.get_logger()

_ssl_skip_applied = False


def _get_version() -> str:
    """Return the installed PaperBanana version, or 'unknown' if unavailable."""
    try:
        from importlib.metadata import version

        return version("paperbanana")
    except Exception:
        return "unknown"


def _emit_progress(
    callback: Optional[Callable[[PipelineProgressEvent], None]],
    event: PipelineProgressEvent,
) -> None:
    """Invoke progress callback if set; swallow errors so pipeline is not affected."""
    if callback is None:
        return
    try:
        callback(event)
    except Exception:
        logger.warning("Progress callback failed", stage=event.stage, exc_info=True)


async def _call_with_retry(label, fn, *args, max_attempts=3, **kwargs):
    """Retry an async agent call with exponential backoff.

    Complements provider-level retries by catching agent-level failures
    (e.g. response parsing errors, unexpected formats) that survive
    the lower-level HTTP retry layer.
    """
    async for attempt in AsyncRetrying(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(min=2, max=30),
        reraise=True,
    ):
        with attempt:
            attempt_num = attempt.retry_state.attempt_number
            if attempt_num > 1:
                logger.warning(
                    f"Retrying {label}",
                    attempt=attempt_num,
                    max_attempts=max_attempts,
                )
            return await fn(*args, **kwargs)


def _apply_ssl_skip():
    """Disable SSL verification globally for corporate proxy environments."""
    global _ssl_skip_applied
    if _ssl_skip_applied:
        return
    _ssl_skip_applied = True

    import ssl

    logger.warning("SSL verification disabled via SKIP_SSL_VERIFICATION=true")

    # Handle stdlib ssl (urllib, http.client)
    ssl._create_default_https_context = ssl._create_unverified_context

    # Handle httpx
    try:
        import httpx

        _orig_client_init = httpx.Client.__init__
        _orig_async_init = httpx.AsyncClient.__init__

        def _patched_client_init(self, *args, **kwargs):
            kwargs["verify"] = False
            _orig_client_init(self, *args, **kwargs)

        def _patched_async_init(self, *args, **kwargs):
            kwargs["verify"] = False
            _orig_async_init(self, *args, **kwargs)

        httpx.Client.__init__ = _patched_client_init
        httpx.AsyncClient.__init__ = _patched_async_init
    except ImportError:
        pass

    # Suppress urllib3 InsecureRequestWarning
    try:
        import urllib3

        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    except ImportError:
        pass


class PaperBananaPipeline:
    """Main orchestration pipeline for academic illustration generation.

    Implements the two-phase process:
    1. Linear Planning: Retriever -> Planner -> Stylist
    2. Iterative Refinement: Visualizer <-> Critic (up to N iterations)
    """

    def __init__(
        self,
        settings: Optional[Settings] = None,
        vlm_client=None,
        image_gen_fn=None,
        progress_callback: Optional[Callable[[str, Dict[str, Any]], None]] = None,
    ):
        """Initialize the pipeline.

        Args:
            settings: Configuration settings. If None, loads from env/defaults.
            vlm_client: Optional pre-configured VLM client (for HF Spaces demo).
            image_gen_fn: Optional image generation function (for HF Spaces demo).
        """
        self.settings = settings or Settings()
        self.run_id = generate_run_id()
        self._progress_callback = progress_callback

        if self.settings.skip_ssl_verification:
            _apply_ssl_skip()

        # Prompt recorder (writes formatted prompts to outputs/<run_id>/prompts/)
        self._prompt_recorder = None
        if self.settings.save_prompts:
            self._prompt_recorder = PromptRecorder(run_dir_provider=lambda: self._run_dir)

        # Initialize providers
        if vlm_client is not None:
            # Demo mode: use provided clients
            self._vlm = vlm_client
            self._image_gen = image_gen_fn
            self._demo_mode = True
        else:
            self._vlm = ProviderRegistry.create_vlm(self.settings)
            self._image_gen = ProviderRegistry.create_image_gen(self.settings)
            self._demo_mode = False

        # Cost tracking (optional — active when budget is set or always for reporting)
        self._cost_tracker: CostTracker | None = None
        if not self._demo_mode:
            self._cost_tracker = CostTracker(budget=self.settings.budget_usd)
            if hasattr(self._vlm, "cost_tracker"):
                self._vlm.cost_tracker = self._cost_tracker
            if hasattr(self._image_gen, "cost_tracker"):
                self._image_gen.cost_tracker = self._cost_tracker

        # Load reference store (resolves cache → built-in fallback)
        self.reference_store = ReferenceStore.from_settings(self.settings)
        self._external_exemplar_retriever: ExternalExemplarRetriever | None = None
        if self.settings.exemplar_retrieval_enabled and self.settings.exemplar_retrieval_endpoint:
            self._external_exemplar_retriever = ExternalExemplarRetriever(
                endpoint=self.settings.exemplar_retrieval_endpoint,
                timeout_seconds=self.settings.exemplar_retrieval_timeout_seconds,
                max_retries=self.settings.exemplar_retrieval_max_retries,
            )

        # Load guidelines (venue-aware resolution: built-in packs, then user packs)
        guidelines_path = self.settings.guidelines_path
        venue = self.settings.venue
        venue_dir = self.settings.venue_dir
        self._venue_pack: VenuePack | None = None
        if venue and venue != "custom":
            self._venue_pack = resolve_venue(
                venue, builtin_dir=guidelines_path, extra_dir=venue_dir
            )
        self._methodology_guidelines = load_methodology_guidelines(
            guidelines_path, venue=venue, venue_dir=venue_dir
        )
        self._plot_guidelines = load_plot_guidelines(
            guidelines_path, venue=venue, venue_dir=venue_dir
        )
        if self._venue_pack and self._venue_pack.config.fonts:
            font_note = (
                "\n\n## Venue Font Preferences\n\n"
                f"Preferred font families for this venue: "
                f"{', '.join(self._venue_pack.config.fonts)}.\n"
            )
            self._methodology_guidelines += font_note
            self._plot_guidelines += font_note

        # Initialize agents
        prompt_dir = self._find_prompt_dir()
        self._prompt_dir = prompt_dir
        self.optimizer = InputOptimizerAgent(
            self._vlm, prompt_dir=prompt_dir, prompt_recorder=self._prompt_recorder
        )
        self.retriever = RetrieverAgent(
            self._vlm, prompt_dir=prompt_dir, prompt_recorder=self._prompt_recorder
        )
        self.planner = PlannerAgent(
            self._vlm, prompt_dir=prompt_dir, prompt_recorder=self._prompt_recorder
        )
        self.ir_planner = IRPlannerAgent(
            self._vlm, prompt_dir=prompt_dir, prompt_recorder=self._prompt_recorder
        )
        self.stylist = StylistAgent(
            self._vlm,
            guidelines=self._methodology_guidelines,
            prompt_dir=prompt_dir,
            prompt_recorder=self._prompt_recorder,
        )
        self.structurer = StructurerAgent(
            self._vlm, prompt_dir=prompt_dir, prompt_recorder=self._prompt_recorder
        )
        self.visualizer = VisualizerAgent(
            self._image_gen,
            self._vlm,
            prompt_dir=prompt_dir,
            output_dir=str(self._run_dir),
    
```

### Core Architecture Module: `paperbanana/core/plot_data.py`
```
"""Load CSV/JSON files for the statistical plot pipeline."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def _normalize_json_plot_payload(loaded: Any) -> Any:
    """Match legacy Studio/plot behavior for JSON files.

    - Top-level JSON array → used as-is (rows for the plot).
    - Top-level object with a ``data`` key → unwrap so ``raw_data={"data": payload}``
      is not double-nested; same as ``raw if isinstance(raw, list) else raw.get("data", raw)``.
    - Other top-level values (e.g. a single object without ``data``) → used as-is.
    """
    if isinstance(loaded, list):
        return loaded
    if isinstance(loaded, dict):
        return loaded.get("data", loaded)
    return loaded


def load_statistical_plot_payload(data_path: Path) -> tuple[str, Any]:
    """Read a data file and return (source_context, payload) for GenerationInput.

    ``payload`` is passed as ``raw_data={"data": payload}`` (CSV yields a list of rows).
    """
    data_path = Path(data_path).resolve()
    if not data_path.is_file():
        raise FileNotFoundError(f"Data file not found: {data_path}")
    suffix = data_path.suffix.lower()
    if suffix == ".csv":
        import pandas as pd

        df = pd.read_csv(data_path)
        raw_data = df.to_dict(orient="records")
        source_context = (
            f"CSV data with columns: {list(df.columns)}\n"
            f"Rows: {len(df)}\nSample:\n{df.head().to_string()}"
        )
        return source_context, raw_data
    if suffix == ".json":
        loaded = json.loads(data_path.read_text(encoding="utf-8"))
        payload = _normalize_json_plot_payload(loaded)
        source_context = f"JSON data:\n{json.dumps(payload, indent=2)[:2000]}"
        return source_context, payload
    raise ValueError(f"Plot data must be .csv or .json, got: {data_path.suffix}")

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

### Incident Patch 2: `cc7d43c3` (2026-06-11)
**Commit Message**: feat: user-provided reference/sketch images guide diagram generation

Allow passing existing images (hand-drawn sketch, whiteboard photo,
prior figure version) as guidance alongside the methodology text:

- GenerationInput gains input_images: list[str] (paths)
- Repeatable --image PATH on `paperbanana generate`; files are
  validated (existence + PIL-openable raster) before the pipeline
  starts, and rejected when combined with --continue/--continue-run
- Planner attaches the images as additional image parts after the
  retrieved exemplar images, labeled as user-provided reference/sketch
  in the prompt (exemplar "reference image N" indexing is preserved)
- Visualizer diagram prompt gets a one-line note that a user sketch
  guided the plan (carried via a sketch_guided flag so the note never
  leaks into the description the Critic reviews)
- The Critic never sees the sketch: it keeps judging against the
  source text only
- input_images survives the --optimize input rebuild and is recorded
  in run_input.json for reproducibility
- MCP: generate_diagram gains optional input_images (validated paths)

Fixes #223

**File**: `README.md` (modified, +7/-0)
```diff
@@ -255,12 +255,19 @@ paperbanana generate \
   --input paper.pdf \
   --caption "Overview of our method" \
   --pdf-pages "3-8"
+
+# Guide generation with a reference/sketch image (repeatable)
+paperbanana generate \
+  --input method.txt \
+  --caption "Overview of our framework" \
+  --image sketch.png --image prior_figure.png
 ```
 
 | Flag | Short | Description |
 |------|-------|-------------|
 | `--input` | `-i` | Path to methodology text file or PDF (required for new runs) |
 | `--caption` | `-c` | Figure caption / communicative intent (required for new runs) |
+| `--image` | | Reference/sketch image (hand-drawn sketch, whiteboard photo, prior figure) that guides the Planner. Repeatable for multiple images |
 | `--output` | `-o` | Output image path (default: auto-generated in `outputs/`) |
 | `--iterations` | `-n` | Number of Visualizer-Critic refinement rounds (default: 3) |
 | `--num-candidates` | `-k` | Generate N candidate images in parallel, 1-8 (default: 1). Planning runs once; refinement fans out per candidate with seed offsets. Outputs land in `candidates/cand_<i>/`; the run-root `final_output` is candidate 1. Cost estimates and `--budget` account for the fan-out |
```

**File**: `mcp_server/server.py` (modified, +29/-0)
```diff
@@ -172,6 +172,28 @@ def _embed_caption(image_path: str, caption: str) -> None:
 mcp = FastMCP("PaperBanana")
 
 
+def _validate_input_images(input_images: list[str] | None) -> list[str]:
+    """Validate user-provided reference/sketch image paths before the pipeline starts.
+
+    Each path must exist and be a PIL-openable raster image.
+
+    Raises:
+        ValueError: If a path is missing or not a valid raster image.
+    """
+    validated: list[str] = []
+    for image_path in input_images or []:
+        path = Path(image_path)
+        if not path.is_file():
+            raise ValueError(f"Image file not found: {image_path}")
+        try:
+            with PILImage.open(path) as im:
+                im.verify()
+        except Exception:
+            raise ValueError(f"Not a valid raster image (e.g. PNG, JPEG, WebP): {image_path}")
+        validated.append(str(path))
+    return validated
+
+
 @mcp.tool
 async def generate_diagram(
     source_context: str,
@@ -181,6 +203,7 @@ async def generate_diagram(
     optimize: bool = False,
     auto_refine: bool = False,
     generate_caption: bool = False,
+    input_images: list[str] | None = None,
 ) -> Image:
     """Generate a publication-quality methodology diagram from text.
 
@@ -197,10 +220,15 @@ async def generate_diagram(
         generate_caption: Auto-generate a publication-ready figure caption
             after generation. When True, the caption is embedded in the
             image metadata (PNG tEXt chunk, key "Caption") and logged.
+        input_images: Optional file paths to user-provided reference/sketch
+            images (hand-drawn sketch, whiteboard photo, prior figure) that
+            guide the layout and content of the generated diagram.
 
     Returns:
         The generated diagram as a PNG image.
     """
+    validated_images = _validate_input_images(input_images)
+
     settings = Settings(
         refinement_iterations=iterations,
         optimize_inputs=optimize,
@@ -223,6 +251,7 @@ def _on_progress(event: str, payload: dict) -> None:
         communicative_intent=caption,
         diagram_type=DiagramType.METHODOLOGY,
         aspect_ratio=aspect_ratio,
+        input_images=validated_images,
     )
 
     result = await pipeline.generate(gen_input)
```

**File**: `paperbanana/agents/planner.py` (modified, +46/-1)
```diff
@@ -46,6 +46,7 @@ async def run(
         examples: list[ReferenceExample],
         diagram_type: DiagramType = DiagramType.METHODOLOGY,
         supported_ratios: list[str] | None = None,
+        input_images: list[str] | None = None,
     ) -> tuple[str, str | None]:
         """Generate a detailed textual description of the target diagram.
 
@@ -55,6 +56,8 @@ async def run(
             examples: Retrieved reference examples for in-context learning.
             diagram_type: Type of diagram being generated.
             supported_ratios: Aspect ratios the image provider supports.
+            input_images: Paths to user-provided reference/sketch images that
+                guide the plan alongside the retrieved exemplars.
 
         Returns:
             Tuple of (description, recommended_ratio).
@@ -66,8 +69,18 @@ async def run(
         # Load reference images for visual in-context learning
         example_images = await asyncio.to_thread(self._load_example_images, examples)
 
+        # Load user-provided reference/sketch images (attached after the
+        # exemplar images so "reference image N" indexing stays valid).
+        user_images: list = []
+        if input_images:
+            user_images = await asyncio.to_thread(self._load_input_images, input_images)
+
         prompt_type = "diagram" if diagram_type == DiagramType.METHODOLOGY else "plot"
         template = self.load_prompt(prompt_type)
+        if user_images:
+            # Appended pre-format so the prompt recorder captures it; the note
+            # is brace-free, keeping str.format() on the template intact.
+            template += "\n\n" + self._format_user_image_note(len(user_images))
         # Inject supported ratios into the prompt template
         ratios_str = ", ".join(supported_ratios) if supported_ratios else "1:1, 16:9"
         prompt = self.format_prompt(
@@ -83,12 +96,14 @@ async def run(
             "Running planner agent",
             num_examples=len(examples),
             num_images=len(example_images),
+            num_user_images=len(user_images),
             context_length=len(source_context),
         )
 
+        all_images = example_images + user_images
         raw_output = await self.vlm.generate(
             prompt=prompt,
-            images=example_images if example_images else None,
+            images=all_images if all_images else None,
             temperature=0.7,
             max_tokens=4096,
         )
@@ -242,6 +257,36 @@ def _load_example_images(self, examples: list[ReferenceExample]) -> list:
                 )
         return images
 
+    @staticmethod
+    def _format_user_image_note(count: int) -> str:
+        """Label for user-provided reference/sketch images attached to the prompt."""
+        return (
+            "## User-Provided Reference/Sketch\n"
+            f"The final {count} attached image(s), after the reference example images, "
+            "are user-provided reference/sketch images (e.g. a hand-drawn sketch, "
+            "whiteboard photo, or a prior version of the figure). Use them as guidance "
+            "for the layout and content of the target diagram while staying faithful "
+            "to the source text."
+        )
+
+    def _load_input_images(self, paths: list[str]) -> list:
+        """Load user-provided reference/sketch images from local paths.
+
+        Returns PIL Image objects; unreadable files are skipped with a warning
+        (the CLI/MCP entry points validate them before the pipeline starts).
+        """
+        images = []
+        for path in paths:
+            try:
+                images.append(load_image(path))
+            except Exception as e:
+                logger.warning(
+                    "Failed to load user-provided reference image",
+                    image_path=path,
+                    error=str(e),
+                )
+        return images
+
     _VALID_RATIOS = {"1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"}
 
     @classmethod
```

**File**: `paperbanana/agents/visualizer.py` (modified, +12/-0)
```diff
@@ -61,6 +61,7 @@ async def run(
         seed: Optional[int] = None,
         aspect_ratio: Optional[str] = None,
         vector_formats: Optional[list[str]] = None,
+        sketch_guided: bool = False,
     ) -> str:
         """Generate an image from a description.
 
@@ -74,6 +75,8 @@ async def run(
             aspect_ratio: Target aspect ratio (e.g., '16:9', '1:1').
             vector_formats: Vector formats to export alongside raster (e.g., ['svg', 'pdf']).
                 Only applies to statistical plots; ignored for methodology diagrams.
+            sketch_guided: When True, the diagram prompt notes that a
+                user-provided reference sketch guided the plan.
 
         Returns:
             Path to the generated raster image.
@@ -90,18 +93,27 @@ async def run(
                 iteration,
                 seed,
                 aspect_ratio,
+                sketch_guided=sketch_guided,
             )
 
+    _SKETCH_GUIDED_NOTE = (
+        "Note: this plan was guided by a user-provided reference sketch; "
+        "follow the description above faithfully."
+    )
+
     async def _generate_diagram(
         self,
         description: str,
         output_path: Optional[str],
         iteration: int,
         seed: Optional[int],
         aspect_ratio: Optional[str] = None,
+        sketch_guided: bool = False,
     ) -> str:
         """Generate a methodology diagram using the image generation model."""
         template = self.load_prompt("diagram")
+        if sketch_guided:
+            template += "\n\n" + self._SKETCH_GUIDED_NOTE
         prompt = self.format_prompt(
             template,
             prompt_label=f"visualizer_diagram_iter_{iteration}",
```

**File**: `paperbanana/cli.py` (modified, +36/-0)
```diff
@@ -245,6 +245,14 @@ def generate(
     caption: Optional[str] = typer.Option(
         None, "--caption", "-c", help="Figure caption / communicative intent"
     ),
+    image: Optional[list[str]] = typer.Option(
+        None,
+        "--image",
+        help=(
+            "Path to a reference/sketch image (hand-drawn sketch, whiteboard photo, "
+            "prior figure) that guides generation. Repeatable for multiple images."
+        ),
+    ),
     output: Optional[str] = typer.Option(None, "--output", "-o", help="Output image path"),
     output_dir: Optional[str] = typer.Option(
         None,
@@ -455,6 +463,31 @@ def generate(
             "[red]Error: --pdf-pages cannot be used with --continue or --continue-run[/red]"
         )
         raise typer.Exit(1)
+    if image and (continue_last or continue_run):
+        console.print("[red]Error: --image cannot be used with --continue or --continue-run[/red]")
+        raise typer.Exit(1)
+
+    # Validate reference/sketch images before any pipeline work starts.
+    input_images: list[str] = []
+    if image:
+        from PIL import Image as PILImage
+        from PIL import UnidentifiedImageError
+
+        for image_path in image:
+            img_file = Path(image_path)
+            if not img_file.is_file():
+                console.print(f"[red]Error: Image file not found: {image_path}[/red]")
+                raise typer.Exit(1)
+            try:
+                with PILImage.open(img_file) as im:
+                    im.verify()
+            except (UnidentifiedImageError, OSError, ValueError):
+                console.print(
+                    f"[red]Error: Not a valid raster image (e.g. PNG, JPEG, WebP): "
+                    f"{image_path}[/red]"
+                )
+                raise typer.Exit(1)
+            input_images.append(str(img_file))
 
     _valid_categories = {
         "agent_reasoning",
@@ -721,6 +754,7 @@ async def _run_continue():
         diagram_type=DiagramType.METHODOLOGY,
         aspect_ratio=aspect_ratio,
         reference_ids=ref_id_list,
+        input_images=input_images,
     )
 
     # Determine expected output file extension based on settings.output_format
@@ -764,6 +798,8 @@ async def _run_continue():
         pdf_note = ""
         if input_path.suffix.lower() == ".pdf":
             pdf_note = f"\nPDF pages: {pdf_pages.strip() if pdf_pages else 'all'}"
+        if input_images:
+            pdf_note += f"\nReference images: {', '.join(input_images)}"
         console.print(
             Panel.fit(
                 "[bold]PaperBanana[/bold] - Dry Run\n\n"
```

**File**: `paperbanana/core/pipeline.py` (modified, +4/-0)
```diff
@@ -560,6 +560,7 @@ def _extra(**payload: Any) -> Dict[str, Any]:
                 seed=seed,
                 aspect_ratio=effective_ratio,
                 vector_formats=vector_formats,
+                sketch_guided=bool(input.input_images),
             )
             visualizer_seconds = time.perf_counter() - visualizer_start
             if image_path is None:
@@ -1267,6 +1268,7 @@ async def generate(
                     "raw_data": input.raw_data,
                     "aspect_ratio": input.aspect_ratio,
                     "vector_export": self._effective_vector_export(input),
+                    "input_images": input.input_images,
                 },
                 self._run_dir / "run_input.json",
             )
@@ -1342,6 +1344,7 @@ async def generate(
                     diagram_type=input.diagram_type,
                     raw_data=input.raw_data,
                     aspect_ratio=input.aspect_ratio,
+                    input_images=input.input_images,
                 )
             except Exception:
                 optimize_seconds = time.perf_counter() - optimize_start
@@ -1471,6 +1474,7 @@ async def generate(
             examples=examples,
             diagram_type=input.diagram_type,
             supported_ratios=getattr(self.visualizer.image_gen, "supported_ratios", None),
+            input_images=input.input_images,
         )
         planning_seconds = time.perf_counter() - planning_start
         _emit_progress(
```

**File**: `paperbanana/core/types.py` (modified, +8/-0)
```diff
@@ -91,6 +91,14 @@ class GenerationInput(BaseModel):
         default=None,
         description="Optional vector export (svg/pdf/both); None uses Settings.vector_export",
     )
+    input_images: list[str] = Field(
+        default_factory=list,
+        description=(
+            "Paths to user-provided reference/sketch images (e.g. a hand-drawn "
+            "sketch, whiteboard photo, or prior figure version) that guide the "
+            "Planner alongside retrieved exemplars."
+        ),
+    )
 
     @field_validator("aspect_ratio")
     @classmethod
```

**File**: `tests/test_agents/test_planner.py` (modified, +76/-0)
```diff
@@ -8,6 +8,7 @@
 
 from paperbanana.agents.planner import PlannerAgent
 from paperbanana.core.types import ReferenceExample
+from paperbanana.core.utils import find_prompt_dir
 
 
 class _MockVLM:
@@ -18,6 +19,21 @@ async def generate(self, *args, **kwargs):
         return "ok"
 
 
+class _CapturingVLM:
+    """Mock VLM that records the prompt and image parts it receives."""
+
+    name = "mock-vlm"
+    model_name = "mock-model"
+
+    def __init__(self):
+        self.captured: dict = {}
+
+    async def generate(self, prompt, images=None, **kwargs):
+        self.captured["prompt"] = prompt
+        self.captured["images"] = images
+        return "a detailed description\nRECOMMENDED_RATIO: 16:9"
+
+
 def test_format_examples_includes_structure_hints():
     agent = PlannerAgent(_MockVLM())
     text = agent._format_examples(
@@ -74,6 +90,66 @@ def test_has_valid_image_rejects_insecure_or_local_urls():
     assert agent._has_valid_image(private_ip) is False
 
 
+async def test_planner_attaches_user_sketch_images_after_exemplars(tmp_path):
+    """User sketch images are attached after exemplar images and labeled in the prompt."""
+    ref_img = tmp_path / "ref.png"
+    Image.new("RGB", (2, 2), color=(255, 0, 0)).save(ref_img)
+    sketch = tmp_path / "sketch.png"
+    Image.new("RGB", (4, 4), color=(0, 0, 255)).save(sketch)
+
+    vlm = _CapturingVLM()
+    agent = PlannerAgent(vlm, prompt_dir=find_prompt_dir())
+
+    description, ratio = await agent.run(
+        source_context="methodology text",
+        caption="figure caption",
+        examples=[
+            ReferenceExample(
+                id="ref_001",
+                source_context="ctx",
+                caption="cap",
+                image_path=str(ref_img),
+            )
+        ],
+        input_images=[str(sketch)],
+    )
+
+    assert description == "a detailed description"
+    assert ratio == "16:9"
+    # Exemplar image first, user sketch attached last.
+    images = vlm.captured["images"]
+    assert len(images) == 2
+    assert images[0].size == (2, 2)
+    assert images[-1].size == (4, 4)
+    # The prompt labels the trailing image parts as user-provided.
+    assert "User-Provided Reference/Sketch" in vlm.captured["prompt"]
+
+
+async def test_planner_without_user_images_keeps_prompt_unchanged(tmp_path):
+    """No sketch label or extra image parts appear when input_images is absent."""
+    ref_img = tmp_path / "ref.png"
+    Image.new("RGB", (2, 2), color=(255, 0, 0)).save(ref_img)
+
+    vlm = _CapturingVLM()
+    agent = PlannerAgent(vlm, prompt_dir=find_prompt_dir())
+
+    await agent.run(
+        source_context="methodology text",
+        caption="figure caption",
+        examples=[
+            ReferenceExample(
+                id="ref_001",
+                source_context="ctx",
+                caption="cap",
+                image_path=str(ref_img),
+            )
+        ],
+    )
+
+    assert len(vlm.captured["images"]) == 1
+    assert "User-Provided Reference/Sketch" not in vlm.captured["prompt"]
+
+
 def test_load_example_images_loads_from_url(monkeypatch):
     """_load_example_images fetches and loads images from http(s) URLs."""
     agent = PlannerAgent(_MockVLM())
```

---

### Incident Patch 3: `ad555e56` (2026-06-11)
**Commit Message**: feat: polish mode — refine an existing figure with style-guided suggestions

Adds `paperbanana polish --input figure.png`: a two-step flow where a VLM
audits the user-supplied figure against the venue style guide (--venue,
neurips default) and produces up to 10 concrete, actionable suggestions,
which are then applied to the original figure as a guided image edit
(the figure and the numbered suggestions both go to the image provider).

- PolishAgent (paperbanana/agents/polish.py): suggest() VLM step with
  robust list parsing (numbered/bulleted/fenced, NO_SUGGESTIONS sentinel,
  capped at 10) and apply() guided-edit step; prompts in prompts/polish/.
- Guided edits: GoogleImagenGen.generate gains an optional images kwarg
  (image-conditioned generation); callers detect support by signature.
  Providers without it are rejected with a clear error.
- CLI: --input (validated as a readable image), --venue, --output,
  --iterations (repeat suggest→apply on the result), --aspect-ratio,
  provider/model/budget/seed flags consistent with generate; suggestions
  printed to the console; cost tracked and reported with budget guard.
- Multi-candidate: --num-candidates fans the apply step out in p

**File**: `README.md` (modified, +22/-0)
```diff
@@ -508,6 +508,28 @@ Scores on 4 dimensions (hierarchical aggregation per the paper):
 - **Primary**: Faithfulness, Readability
 - **Secondary**: Conciseness, Aesthetics
 
+### `paperbanana polish` -- Refine an Existing Figure
+
+Bring your own figure: a VLM audits it against the venue style guide and proposes up to 10 concrete, actionable improvements, then an image-edit capable provider applies them to the original figure (guided edit). Suggestions are printed to the console so you can see exactly what changed.
+
+```bash
+paperbanana polish --input figure.png
+paperbanana polish --input figure.png --venue icml --iterations 2 --output polished.png
+```
+
+| Flag | Short | Description |
+|------|-------|-------------|
+| `--input` | `-i` | Path to the existing figure image (required) |
+| `--output` | `-o` | Output path (default: `outputs/polish_<timestamp>/final_output.png`) |
+| `--venue` | | Venue style guide: `neurips` (default), `icml`, `acl`, `ieee`, `custom` |
+| `--iterations` | `-n` | Polish rounds; each round suggests and applies improvements on the previous result (default: 1) |
+| `--aspect-ratio` | `-ar` | Target aspect ratio (default: preserve the input figure's ratio) |
+| `--num-candidates` | `-k` | Apply each round's suggestions N times in parallel (1-8) |
+| `--budget` | | Budget cap in USD; polishing stops gracefully when exceeded |
+| `--seed` | | Random seed for reproducible edits |
+
+Requires an image provider that supports guided image edits (Google Gemini image models). If the figure already conforms to the style guide, polish exits without making changes.
+
 ### `paperbanana studio` -- Local web UI
 
 Requires `pip install 'paperbanana[studio]'` (Gradio).
```

**File**: `paperbanana/agents/polish.py` (added, +218/-0)
```diff
@@ -0,0 +1,218 @@
+"""Polish Agent: improves an existing user-supplied figure via style-guided suggestions."""
+
+from __future__ import annotations
+
+import inspect
+import re
+from pathlib import Path
+from typing import Optional
+
+import structlog
+from PIL import Image
+
+from paperbanana.agents.base import BaseAgent
+from paperbanana.core.utils import load_image, save_image, truncate_text
+from paperbanana.providers.base import ImageGenProvider, VLMProvider
+
+logger = structlog.get_logger()
+
+MAX_SUGGESTIONS = 10
+
+# Matches "1. text", "2) text", "- text", "* text", "• text"
+_LIST_ITEM_RE = re.compile(r"^\s*(?:\d+[.)]\s+|[-*•]\s+)(.+?)\s*$")
+_FENCE_RE = re.compile(r"^\s*```[a-zA-Z0-9_-]*\s*$")
+
+
+class PolishAgent(BaseAgent):
+    """Refines an existing figure in two steps.
+
+    1. ``suggest``: a VLM audits the figure against the venue style guide and
+       returns at most :data:`MAX_SUGGESTIONS` concrete, actionable
+       presentation improvements.
+    2. ``apply``: the suggestions and the original figure are sent to an
+       image-edit capable provider (guided edit) which renders the polished
+       version while preserving the figure's content.
+
+    Prompt templates live in ``prompts/polish/{suggest,apply}.txt``.
+    """
+
+    def __init__(
+        self,
+        image_gen: ImageGenProvider,
+        vlm_provider: VLMProvider,
+        prompt_dir: str = "prompts",
+        output_dir: str = "outputs",
+        prompt_recorder=None,
+        image_quality: str = "auto",
+    ):
+        super().__init__(vlm_provider, prompt_dir, prompt_recorder=prompt_recorder)
+        self.image_gen = image_gen
+        self.output_dir = Path(output_dir)
+        self.image_quality = image_quality
+
+    @property
+    def agent_name(self) -> str:
+        return "polish"
+
+    @staticmethod
+    def supports_guided_edit(image_gen: ImageGenProvider) -> bool:
+        """Whether the provider accepts input images for guided editing.
+
+        Image-edit capable providers declare an ``images`` keyword on
+        ``generate`` (see ``GoogleImagenGen``); the base text-to-image
+        contract does not.
+        """
+        try:
+            return "images" in inspect.signature(image_gen.generate).parameters
+        except (TypeError, ValueError):
+            return False
+
+    def _load_polish_prompt(self, step: str) -> str:
+        """Load a polish prompt template (``suggest`` or ``apply``)."""
+        path = self.prompt_dir / "polish" / f"{step}.txt"
+        if not path.exists():
+            raise FileNotFoundError(f"Prompt template not found: {path}")
+        return path.read_text(encoding="utf-8")
+
+    async def suggest(
+        self,
+        image: Image.Image,
+        style_guide: str,
+        max_suggestions: int = MAX_SUGGESTIONS,
+        iteration: int = 1,
+    ) -> list[str]:
+        """Audit *image* against *style_guide* and return actionable suggestions.
+
+        Returns an empty list when the figure already conforms (the VLM
+        answers ``NO_SUGGESTIONS``) or when no list items can be parsed.
+        """
+        template = self._load_polish_prompt("suggest")
+        prompt = self.format_prompt(
+            template,
+            prompt_label=f"polish_suggest_iter_{iteration}",
+            style_guide=style_guide,
+            max_suggestions=max_suggestions,
+        )
+
+        logger.info("Running polish suggest step", iteration=iteration)
+        response = await self.vlm.generate(
+            prompt=prompt,
+            images=[image],
+            temperature=0.3,
+            max_tokens=2048,
+        )
+        suggestions = self._parse_suggestions(response, max_suggestions=max_suggestions)
+        logger.info("Polish suggestions ready", count=len(suggestions), iteration=iteration)
+        return suggestions
+
+    async def apply(
+        self,
+        image: Image.Image,
+        suggestions: list[str],
+        output_path: str,
+        iteration: int = 1,
+        aspect_ratio: Optional[str] = None,
+        seed: Optional[int] = None,
+    ) -> str:
+        """Apply *suggestions* to *image* via a guided edit and save the result.
+
+        The original figure and the numbered suggestions both go to the image
+        provider, so the model edits the existing figure instead of
+        regenerating from scratch.
+        """
+        if not self.supports_guided_edit(self.image_gen):
+            raise RuntimeError(
+                f"Image provider '{getattr(self.image_gen, 'name', 'unknown')}' does not "
+                "support guided image editing (no 'images' parameter on generate()). "
+                "Polish mode requires an image-edit capable provider such as 'google'."
+            )
+
+        template = self._load_polish_prompt("apply")
+        numbered = "\n".join(f"{i}. {s}" for i, s in enumerate(suggestions, start=1))
+        prompt = self.format_prompt(
+            template,
+            prompt_label=f"polish_ap
```

**File**: `paperbanana/cli.py` (modified, +269/-0)
```diff
@@ -2636,6 +2636,275 @@ async def _run():
     console.print(f"\n[green]Done![/green] LaTeX source saved to: [bold]{tex_path}[/bold]")
 
 
+@app.command()
+def polish(
+    input: str = typer.Option(
+        ..., "--input", "-i", help="Path to the existing figure image to polish"
+    ),
+    output: Optional[str] = typer.Option(
+        None,
+        "--output",
+        "-o",
+        help="Output image path (default: outputs/polish_<timestamp>/final_output.png)",
+    ),
+    venue: Optional[str] = typer.Option(
+        None,
+        "--venue",
+        help="Target venue style (neurips, icml, acl, ieee, custom)",
+    ),
+    iterations: int = typer.Option(
+        1,
+        "--iterations",
+        "-n",
+        min=1,
+        help="Polish rounds: each round suggests improvements and applies them to the result",
+    ),
+    aspect_ratio: Optional[str] = typer.Option(
+        None,
+        "--aspect-ratio",
+        "-ar",
+        help="Target aspect ratio: 1:1, 2:3, 3:2, 3:4, 4:3, 9:16, 16:9, 21:9 "
+        "(default: preserve the input figure's ratio)",
+    ),
+    vlm_provider: Optional[str] = typer.Option(
+        None, "--vlm-provider", help="VLM provider (gemini)"
+    ),
+    vlm_model: Optional[str] = typer.Option(None, "--vlm-model", help="VLM model name"),
+    image_provider: Optional[str] = typer.Option(
+        None, "--image-provider", help="Image gen provider (must support guided image edits)"
+    ),
+    image_model: Optional[str] = typer.Option(None, "--image-model", help="Image gen model name"),
+    budget: Optional[float] = typer.Option(
+        None,
+        "--budget",
+        help="Budget cap in USD; polishing stops gracefully when exceeded",
+    ),
+    num_candidates: Optional[int] = typer.Option(
+        None,
+        "--num-candidates",
+        "-k",
+        min=1,
+        max=8,
+        help=(
+            "Apply each round's suggestions N times in parallel (1-8); the first "
+            "successful candidate is kept as the primary result"
+        ),
+    ),
+    seed: Optional[int] = typer.Option(
+        None, "--seed", help="Random seed for reproducible image generation"
+    ),
+    config: Optional[str] = typer.Option(None, "--config", help="Path to config YAML file"),
+    verbose: bool = typer.Option(
+        False, "--verbose", "-v", help="Show detailed agent progress and timing"
+    ),
+):
+    """Polish an existing figure: style-guided suggestions applied as a guided image edit."""
+    configure_logging(verbose=verbose)
+
+    if venue and venue.lower() not in ("neurips", "icml", "acl", "ieee", "custom"):
+        console.print(
+            f"[red]Error: --venue must be neurips, icml, acl, ieee, or custom. Got: {venue}[/red]"
+        )
+        raise typer.Exit(1)
+
+    input_path = Path(input)
+    if not input_path.exists():
+        console.print(f"[red]Error: Input image not found: {input}[/red]")
+        raise typer.Exit(1)
+
+    from PIL import Image as PILImage
+    from PIL import UnidentifiedImageError
+
+    try:
+        with PILImage.open(input_path) as probe:
+            probe.verify()
+    except (UnidentifiedImageError, OSError, ValueError) as e:
+        console.print(f"[red]Error: Input is not a readable image: {input} ({e})[/red]")
+        raise typer.Exit(1)
+
+    # Build settings — only override values explicitly passed via CLI
+    overrides = {}
+    if vlm_provider:
+        overrides["vlm_provider"] = vlm_provider
+    if vlm_model:
+        overrides["vlm_model"] = vlm_model
+    if image_provider:
+        overrides["image_provider"] = image_provider
+    if image_model:
+        overrides["image_model"] = image_model
+    if budget is not None:
+        overrides["budget_usd"] = budget
+    if num_candidates is not None:
+        overrides["num_candidates"] = num_candidates
+    if seed is not None:
+        overrides["seed"] = seed
+    if venue:
+        overrides["venue"] = venue
+
+    if config:
+        settings = Settings.from_yaml(config, **overrides)
+    else:
+        from dotenv import load_dotenv
+
+        load_dotenv()
+        settings = Settings(**overrides)
+
+    import datetime
+
+    from paperbanana.agents.polish import PolishAgent
+    from paperbanana.core.cost_tracker import CostTracker
+    from paperbanana.core.utils import find_prompt_dir, load_image, save_image
+    from paperbanana.guidelines.methodology import load_methodology_guidelines
+    from paperbanana.providers.registry import ProviderRegistry
+
+    if output:
+        final_path = Path(output)
+        run_dir = ensure_dir(final_path.parent)
+    else:
+        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
+        run_dir = ensure_dir(Path(settings.output_dir) / f"polish_{ts}")
+        final_path = run_dir / "final_output.png"
+
+    vlm = ProviderRegistry.create_vlm(settings)
+    image_gen = ProviderRegistry.create_image_gen(settings)
+
+    if not PolishAgent.supports_guided_edit(image_gen):
+
```

**File**: `paperbanana/providers/base.py` (modified, +6/-0)
```diff
@@ -72,6 +72,12 @@ class ImageGenProvider(ABC):
 
     Used by the Visualizer agent to generate methodology diagrams
     and other academic illustrations.
+
+    Guided edits (image-conditioned generation): providers that can edit an
+    existing image declare an additional ``images: Optional[list[Image.Image]]``
+    keyword on ``generate`` (see ``GoogleImagenGen``). Callers detect support
+    by inspecting the provider's ``generate`` signature — the base contract
+    below is text-to-image only.
     """
 
     cost_tracker: CostTracker | None = None
```

**File**: `paperbanana/providers/image_gen/google_imagen.py` (modified, +11/-1)
```diff
@@ -104,7 +104,16 @@ async def generate(
         seed: Optional[int] = None,
         aspect_ratio: Optional[str] = None,
         quality: Optional[str] = None,
+        images: Optional[list[Image.Image]] = None,
     ) -> Image.Image:
+        """Generate an image; when ``images`` is given, perform a guided edit.
+
+        Args:
+            images: Optional input images used as the edit base. The model
+                receives them alongside the prompt (image-conditioned
+                generation), which is how polish mode applies suggestions
+                to an existing figure.
+        """
         from google.genai import types
 
         self._get_client()
@@ -120,9 +129,10 @@ async def generate(
             ),
         )
 
+        contents = [*images, prompt] if images else prompt
         response = self._client.models.generate_content(
             model=self._model,
-            contents=prompt,
+            contents=contents,
             config=config,
         )
 
```

**File**: `prompts/polish/apply.txt` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+You are an expert scientific figure editor. The provided image is an existing academic figure. Produce an improved version of this exact figure by applying ONLY the numbered improvements listed below.
+
+CRITICAL CONSTRAINTS:
+- Preserve the figure's content, structure, layout, and meaning: every component, connection, label, and data element of the original must remain present and unchanged unless an improvement explicitly targets it.
+- All text must stay in clear, readable English with the EXACT same wording as the original. Do not generate garbled, misspelled, or non-English text.
+- Do not add new content, captions, titles, watermarks, or decorative elements.
+- Apply every listed improvement; make no other changes.
+
+## IMPROVEMENTS TO APPLY
+
+{suggestions}
```

**File**: `prompts/polish/suggest.txt` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+## ROLE
+
+You are a Lead Visual Designer for top-tier AI conferences (e.g., NeurIPS 2025).
+
+## TASK
+
+You are given an existing academic figure (provided as an image) and the target venue's style guide. Audit the figure against the style guide and produce a short list of concrete, actionable presentation improvements that an image editing model can apply directly.
+
+## RULES
+
+1. Return at most {max_suggestions} suggestions.
+2. Each suggestion must be specific and directly executable by an image editing model (e.g., "Replace the saturated red module backgrounds with a pale blue fill at ~10% opacity", not "improve the colors").
+3. Only suggest presentation changes: color palette, typography, line and arrow styles, alignment, spacing, grouping containers, legends, iconography.
+4. Never suggest adding, removing, or rewording the figure's content, labels, data, or meaning. The figure must stay factually identical.
+5. Order suggestions by visual impact, most impactful first.
+
+## STYLE GUIDE
+
+{style_guide}
+
+## OUTPUT
+
+Return ONLY a numbered list with one suggestion per line:
+1. <first suggestion>
+2. <second suggestion>
+
+If the figure already conforms to the style guide and needs no changes, return exactly:
+NO_SUGGESTIONS
```

**File**: `tests/test_agents/test_polish.py` (added, +267/-0)
```diff
@@ -0,0 +1,267 @@
+"""Tests for PolishAgent: suggestion parsing, suggest/apply flow, guided-edit gating."""
+
+from __future__ import annotations
+
+import pytest
+from PIL import Image
+
+from paperbanana.agents.polish import MAX_SUGGESTIONS, PolishAgent
+
+
+class _FakeVLM:
+    """VLM stub that records calls and returns a canned response."""
+
+    def __init__(self, response: str):
+        self.response = response
+        self.calls: list[dict] = []
+
+    async def generate(self, prompt, images=None, **kwargs):
+        self.calls.append({"prompt": prompt, "images": images, **kwargs})
+        return self.response
+
+
+class _FakeEditImageGen:
+    """Image gen stub that supports guided edits (declares an images kwarg)."""
+
+    name = "fake_edit"
+    model_name = "fake-edit-model"
+
+    def __init__(self):
+        self.calls: list[dict] = []
+
+    async def generate(
+        self,
+        prompt,
+        negative_prompt=None,
+        width=1024,
+        height=1024,
+        seed=None,
+        aspect_ratio=None,
+        quality=None,
+        images=None,
+    ):
+        self.calls.append(
+            {
+                "prompt": prompt,
+                "images": images,
+                "width": width,
+                "height": height,
+                "seed": seed,
+                "aspect_ratio": aspect_ratio,
+            }
+        )
+        return Image.new("RGB", (64, 48), color=(240, 240, 240))
+
+
+class _TextOnlyImageGen:
+    """Image gen stub matching the base text-to-image contract (no images kwarg)."""
+
+    name = "text_only"
+    model_name = "text-only-model"
+
+    async def generate(
+        self,
+        prompt,
+        negative_prompt=None,
+        width=1024,
+        height=1024,
+        seed=None,
+        aspect_ratio=None,
+        quality=None,
+    ):
+        return Image.new("RGB", (8, 8))
+
+
+@pytest.fixture
+def prompt_dir(tmp_path):
+    polish_dir = tmp_path / "prompts" / "polish"
+    polish_dir.mkdir(parents=True)
+    (polish_dir / "suggest.txt").write_text(
+        "STYLE GUIDE:\n{style_guide}\nMax: {max_suggestions}", encoding="utf-8"
+    )
+    (polish_dir / "apply.txt").write_text(
+        "Apply these improvements:\n{suggestions}", encoding="utf-8"
+    )
+    return str(tmp_path / "prompts")
+
+
+@pytest.fixture
+def figure(tmp_path):
+    path = tmp_path / "figure.png"
+    Image.new("RGB", (64, 48), color=(255, 255, 255)).save(path)
+    return path
+
+
+def _make_agent(prompt_dir, tmp_path, vlm_response="NO_SUGGESTIONS", image_gen=None):
+    return PolishAgent(
+        image_gen=image_gen if image_gen is not None else _FakeEditImageGen(),
+        vlm_provider=_FakeVLM(vlm_response),
+        prompt_dir=prompt_dir,
+        output_dir=str(tmp_path / "out"),
+    )
+
+
+# ── Suggestion parsing ────────────────────────────────────────────────────────
+
+
+def test_parse_suggestions_numbered_list():
+    response = "1. Use pastel fills for module backgrounds\n2) Align arrows to a grid"
+    assert PolishAgent._parse_suggestions(response) == [
+        "Use pastel fills for module backgrounds",
+        "Align arrows to a grid",
+    ]
+
+
+def test_parse_suggestions_bulleted_list():
+    response = "- Soften the box corners\n* Use sans-serif labels\n• Reserve red for the loss"
+    assert PolishAgent._parse_suggestions(response) == [
+        "Soften the box corners",
+        "Use sans-serif labels",
+        "Reserve red for the loss",
+    ]
+
+
+def test_parse_suggestions_fenced_output():
+    response = "```\n1. Use a single accent color\n2. Increase label font size\n```"
+    assert PolishAgent._parse_suggestions(response) == [
+        "Use a single accent color",
+        "Increase label font size",
+    ]
+
+
+def test_parse_suggestions_ignores_preamble_prose():
+    response = "Here are my suggestions for the figure:\n1. Use thinner arrows"
+    assert PolishAgent._parse_suggestions(response) == ["Use thinner arrows"]
+
+
+def test_parse_suggestions_strips_bold_markers():
+    response = "1. **Colors**: replace saturated red with pale blue"
+    assert PolishAgent._parse_suggestions(response) == [
+        "Colors: replace saturated red with pale blue"
+    ]
+
+
+def test_parse_suggestions_no_suggestions_sentinel():
+    assert PolishAgent._parse_suggestions("NO_SUGGESTIONS") == []
+
+
+def test_parse_suggestions_empty_and_none():
+    assert PolishAgent._parse_suggestions("") == []
+    assert PolishAgent._parse_suggestions(None) == []
+
+
+def test_parse_suggestions_caps_at_max():
+    response = "\n".join(f"{i}. Suggestion {i}" for i in range(1, 15))
+    parsed = PolishAgent._parse_suggestions(response)
+    assert len(parsed) == MAX_SUGGESTIONS
+    assert parsed[0] == "Suggestion 1"
+    assert parsed[-1] == f"Suggestion {MAX_SUGGESTIONS}"
+
+
+def test_parse_suggestions_unparseable_prose_returns_empty():
+    assert PolishAgent._parse_suggestions("The figure looks somewhat busy overall.") == []
+
+
+# ── Sugges
```

---

### Incident Patch 4: `d104b095` (2026-06-11)
**Commit Message**: Merge pull request #244 from llmsresearch/feat/style-guide-synthesis

feat: corpus-grounded style-guide synthesis (paperbanana guidelines synthesize)

**File**: `paperbanana/cli.py` (modified, +201/-0)
```diff
@@ -88,6 +88,14 @@ def _main(
 )
 app.add_typer(runs_app, name="runs")
 
+# ── Guidelines subcommand group ───────────────────────────────────
+guidelines_app = typer.Typer(
+    name="guidelines",
+    help="Manage style guides (synthesize from reference corpus).",
+    no_args_is_help=True,
+)
+app.add_typer(guidelines_app, name="guidelines")
+
 
 def _require_pdf_dep() -> None:
     """Raise a clean error if PyMuPDF is not installed."""
@@ -3873,6 +3881,199 @@ def references_categories(
     console.print(table)
 
 
+# ── Guidelines subcommands ────────────────────────────────────────
+
+
+@guidelines_app.command(name="synthesize")
+def guidelines_synthesize(
+    guide_type: str = typer.Option(
+        "methodology",
+        "--type",
+        help="Guide type to synthesize: methodology or plot",
+    ),
+    venue: Optional[str] = typer.Option(
+        None,
+        "--venue",
+        help=(
+            "Write the guide into the guidelines layout: "
+            "data/guidelines/<venue>/{methodology|plot}_style_guide.md"
+        ),
+    ),
+    output: Optional[str] = typer.Option(
+        None,
+        "--output",
+        "-o",
+        help="Explicit output path for the synthesized guide (e.g. ./style_guide.md)",
+    ),
+    force: bool = typer.Option(
+        False,
+        "--force",
+        help="Overwrite the target guide file if it already exists",
+    ),
+    reference_set: Optional[str] = typer.Option(
+        None,
+        "--reference-set",
+        help="Path to a reference set directory (defaults to the configured/cached set)",
+    ),
+    sample_size: int = typer.Option(
+        50,
+        "--sample-size",
+        help="Maximum number of reference figures to analyze",
+    ),
+    batch_size: int = typer.Option(
+        20,
+        "--batch-size",
+        help="Number of figures per VLM analysis call",
+    ),
+    seed: Optional[int] = typer.Option(
+        None,
+        "--seed",
+        help="Sampling seed for a reproducible corpus subset",
+    ),
+    vlm_provider: Optional[str] = typer.Option(None, "--vlm-provider", help="VLM provider"),
+    vlm_model: Optional[str] = typer.Option(None, "--vlm-model", help="VLM model name"),
+    budget: Optional[float] = typer.Option(
+        None,
+        "--budget",
+        help="Budget cap in USD; synthesis aborts gracefully when exceeded",
+    ),
+    verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed progress"),
+    config: Optional[str] = typer.Option(None, "--config", help="Path to config YAML file"),
+):
+    """Synthesize a corpus-grounded style guide from reference figures.
+
+    Samples up to --sample-size reference figures, VLM-analyzes them in
+    batches of --batch-size (palettes, layout, line/shape semantics,
+    typography), then merges the analyses into one markdown style guide
+    that preserves multiple accepted options and domain-conditional rules.
+    """
+    from paperbanana.guidelines.synthesis import GUIDE_TYPES, synthesize_style_guide
+
+    if guide_type not in GUIDE_TYPES:
+        console.print(
+            f"[red]Error: --type must be 'methodology' or 'plot'. Got: {guide_type}[/red]"
+        )
+        raise typer.Exit(1)
+    if venue is None and output is None:
+        console.print(
+            "[red]Error: Pass --venue NAME (write into the guidelines layout) "
+            "or --output PATH (e.g. --output ./style_guide.md).[/red]\n"
+            "Built-in guides are never overwritten implicitly."
+        )
+        raise typer.Exit(1)
+    if venue is not None and output is not None:
+        console.print("[red]Error: --venue and --output are mutually exclusive.[/red]")
+        raise typer.Exit(1)
+    if venue is not None and venue.lower() not in ("neurips", "icml", "acl", "ieee"):
+        console.print(
+            f"[red]Error: --venue must be neurips, icml, acl, or ieee. Got: {venue}[/red]\n"
+            "For a custom guide location, use --output PATH and point "
+            "GUIDELINES_PATH (or reference.guidelines_path) at its directory."
+        )
+        raise typer.Exit(1)
+
+    configure_logging(verbose=verbose)
+
+    overrides: dict = {}
+    if vlm_provider:
+        overrides["vlm_provider"] = vlm_provider
+    if vlm_model:
+        overrides["vlm_model"] = vlm_model
+    if reference_set:
+        overrides["reference_set_path"] = reference_set
+
+    if config:
+        settings = Settings.from_yaml(config, **overrides)
+    else:
+        from dotenv import load_dotenv
+
+        load_dotenv()
+        settings = Settings(**overrides)
+
+    if venue is not None:
+        target = Path(settings.guidelines_path) / venue.lower() / f"{guide_type}_style_guide.md"
+    else:
+        target = Path(output)  # type: ignore[arg-type]
+    if target.exists() and not force:
+        console.print(
+            f"[red]Error: {target} already exists.[/red] "
+            "Pass --force to overwrite it, or choose another --output path.
```

**File**: `paperbanana/guidelines/synthesis.py` (added, +222/-0)
```diff
@@ -0,0 +1,222 @@
+"""Corpus-grounded style-guide synthesis via VLM map-reduce.
+
+Ports the upstream ``generate_category_style_guide`` pattern: sample up to
+``sample_size`` reference figures, VLM-analyze them in batches of
+``batch_size`` (map step), then merge the batch analyses into a single
+markdown style guide (reduce step). The resulting guide preserves multiple
+accepted design options and domain-conditional styling (hex palettes,
+line/arrow semantics, shape semantics) rather than averaging everything
+into one style.
+"""
+
+from __future__ import annotations
+
+import random
+from collections.abc import Callable, Sequence
+from pathlib import Path
+
+import structlog
+
+from paperbanana.core.types import ReferenceExample
+from paperbanana.core.utils import find_prompt_dir, load_image
+from paperbanana.providers.base import VLMProvider
+
+logger = structlog.get_logger()
+
+GUIDE_TYPES = ("methodology", "plot")
+
+_GUIDE_TYPE_LABELS = {
+    "methodology": "methodology / architecture diagrams",
+    "plot": "statistical plots and charts",
+}
+
+
+class StyleGuideSynthesisError(RuntimeError):
+    """Raised when style-guide synthesis cannot proceed (no images, over budget)."""
+
+
+def _check_budget(vlm: VLMProvider, stage: str) -> None:
+    """Abort synthesis if the provider's cost tracker reports budget exhaustion."""
+    tracker = getattr(vlm, "cost_tracker", None)
+    if tracker is not None and tracker.is_over_budget:
+        raise StyleGuideSynthesisError(
+            f"Budget exceeded {stage} "
+            f"(spent ${tracker.total_cost:.4f} of ${tracker.budget:.4f}). "
+            "Increase --budget or reduce --sample-size."
+        )
+
+
+def _load_template(name: str, prompt_dir: str | None) -> str:
+    """Load a prompt template from ``{prompt_dir}/guidelines/{name}.txt``."""
+    base = Path(prompt_dir) if prompt_dir else Path(find_prompt_dir())
+    path = base / "guidelines" / f"{name}.txt"
+    if not path.exists():
+        raise FileNotFoundError(f"Prompt template not found: {path}")
+    return path.read_text(encoding="utf-8")
+
+
+def _fill(template: str, **values: str) -> str:
+    """Substitute ``{placeholder}`` tokens without str.format brace pitfalls.
+
+    Batch analyses and captions routinely contain literal braces (LaTeX,
+    JSON snippets), so ``str.format`` would raise. Plain replacement keeps
+    the established ``{placeholder}`` template convention while staying
+    robust to arbitrary corpus text.
+    """
+    for key, value in values.items():
+        template = template.replace("{" + key + "}", value)
+    return template
+
+
+def sample_examples(
+    examples: Sequence[ReferenceExample],
+    sample_size: int,
+    seed: int | None = None,
+) -> list[ReferenceExample]:
+    """Deterministically sample up to ``sample_size`` examples with existing images.
+
+    Args:
+        examples: Candidate reference examples.
+        sample_size: Maximum number of examples to keep.
+        seed: Seed for ``random.Random`` — same seed and corpus yield the
+            same sample.
+
+    Returns:
+        Sampled examples in stable (corpus) order.
+    """
+    eligible = [e for e in examples if e.image_path and Path(e.image_path).exists()]
+    if len(eligible) <= sample_size:
+        return eligible
+    rng = random.Random(seed)
+    sampled = rng.sample(eligible, sample_size)
+    # Preserve corpus order so batches are stable and reviewable.
+    order = {id(e): i for i, e in enumerate(eligible)}
+    sampled.sort(key=lambda e: order[id(e)])
+    return sampled
+
+
+def _figure_listing(batch: Sequence[ReferenceExample]) -> str:
+    """Describe the images attached to a batch call, in attachment order."""
+    lines = []
+    for i, example in enumerate(batch, start=1):
+        caption = example.caption.strip().replace("\n", " ")
+        if len(caption) > 200:
+            caption = caption[:197] + "..."
+        category = example.category or "uncategorized"
+        lines.append(f"{i}. [{example.id}] category: {category} — {caption}")
+    return "\n".join(lines)
+
+
+async def synthesize_style_guide(
+    vlm: VLMProvider,
+    examples: Sequence[ReferenceExample],
+    *,
+    guide_type: str = "methodology",
+    batch_size: int = 20,
+    sample_size: int = 50,
+    seed: int | None = None,
+    prompt_dir: str | None = None,
+    progress_callback: Callable[[str], None] | None = None,
+) -> str:
+    """Synthesize a markdown style guide from a reference figure corpus.
+
+    Map-reduce over the corpus: each batch of figures is analyzed by the VLM
+    (palettes, layout, line/shape semantics, typography, per-category
+    observations), then a single reduce call merges the batch analyses into
+    one guide that preserves multiple accepted options and
+    domain-conditional rules.
+
+    Args:
+        vlm: VLM provider used for both map and reduce calls.
+        examples: Candidate reference examples (only ones whose image file
+            exists ar
```

**File**: `prompts/guidelines/batch_analysis.txt` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+You are a Lead Visual Designer auditing figures from top-tier AI conference papers (NeurIPS, ICML, ICLR, CVPR, ACL). You are building a corpus-grounded style guide for {guide_type_label}.
+
+You are given {figure_count} published reference figures (attached as images, in order). For each visual dimension below, record the CONCRETE design decisions you observe across the batch. Report what the corpus actually does — including when different figures make different, equally valid choices. Do NOT average distinct styles into one; enumerate each accepted variant and roughly how common it is in this batch (e.g., "dominant", "~1/3 of figures", "rare").
+
+## Figures in this batch
+{figure_listing}
+
+## Dimensions to analyze
+
+1. **Color palettes**: Exact or closely estimated hex codes for backgrounds, fills, borders, accents (e.g., #E8F0FE pale blue fill with #4285F4 border). Group recurring palettes. Note saturation/opacity conventions and which colors carry meaning (e.g., warm = trainable, cool = frozen, red = loss/error).
+2. **Layout & composition**: Flow direction, grid alignment, grouping/zoning strategies, macro-micro patterns, whitespace usage, multi-panel arrangements, aspect-ratio tendencies.
+3. **Line & arrow semantics**: What solid vs dashed vs dotted lines mean; arrowhead styles; straight vs orthogonal/elbow vs curved routing and when each is used; line colors/weights; operators or labels placed on lines.
+4. **Shape semantics**: Which shapes encode which concepts (rounded rectangles for processes, cylinders for storage, 3D stacks for tensors, circles for operations, etc.); border styles (solid vs dashed) and what they signal; container/grouping shapes.
+5. **Typography & icons**: Font families (serif vs sans-serif), where bold/italics are used, label sizing hierarchy, math notation styling, icon vocabulary and conventional meanings (e.g., snowflake = frozen, flame = trainable).
+6. **Per-category observations**: Using the category labels in the figure listing, note styling that is conditional on the paper domain (e.g., agent/LLM figures use cartoon icons and chat bubbles; vision figures use frustums and RGB coding; theory figures stay minimalist/grayscale).
+
+## Output format
+
+Markdown notes with one `##` section per dimension above (1-6). Under each section, use bullet points with concrete values (hex codes, shape names, line styles) and prevalence estimates. Reference figures by their listing number where helpful. Do not include any conversational preamble.
```

**File**: `prompts/guidelines/synthesize.txt` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+You are a Lead Visual Designer writing the definitive style guide for {guide_type_label} at top-tier AI conferences. Below are {batch_count} batch analyses produced by auditing {total_figures} published reference figures.
+
+Merge these analyses into ONE complete, self-contained markdown style guide that a designer (or an AI illustration agent) can follow without seeing the original figures.
+
+## Critical requirements
+
+1. **Preserve plurality**: The corpus contains MULTIPLE accepted styles, not one. When the batch analyses report distinct valid options (e.g., three different background palette families, or both orthogonal and curved arrow routing), the guide MUST present each as a named option with guidance on when to choose it. NEVER average competing styles into a single bland compromise.
+2. **Keep it concrete**: Carry forward exact hex codes, named palettes, shape names, line styles, and font conventions from the analyses. Replace vague advice ("use pleasant colors") with corpus-grounded specifics ("pale blue #E8F0FE fill with #4285F4 border, ~15% opacity zones").
+3. **Preserve semantics**: Document what visual choices MEAN, not just how they look — line semantics (solid = data flow, dashed = gradients/auxiliary), shape semantics (cylinder = storage, rounded rectangle = process), color semantics (warm = trainable, cool = frozen), and icon vocabulary.
+4. **Domain-conditional rules**: Include a dedicated section of per-domain styling rules derived from the per-category observations (e.g., "AGENT/LLM papers: illustrative, cartoony, chat bubbles" vs "THEORY papers: minimalist, grayscale plus one accent"). These rules must stay conditional on the paper's domain — do not promote one domain's style to a universal rule.
+5. **Resolve conflicts honestly**: Where batch analyses disagree, prefer the option reported as more prevalent, but keep genuinely common minority variants as alternatives. Drop one-off outliers.
+6. **Note pitfalls**: Include a short "Common Pitfalls" section for anti-patterns implied by the corpus (e.g., harsh saturated backgrounds, mixed font families, ambiguous arrow styles).
+
+## Output structure
+
+A markdown document with: a title; a short overview of the prevailing look; detailed sections for Color Palettes, Layout & Composition, Lines & Arrows, Shapes & Containers, Typography & Icons (each listing the accepted options); a Domain-Specific Styles section; and a Common Pitfalls section. Output ONLY the markdown guide — no conversational preamble or commentary about the synthesis process.
+
+## Batch analyses
+
+{batch_analyses}
```

**File**: `tests/test_guidelines_synthesis.py` (added, +234/-0)
```diff
@@ -0,0 +1,234 @@
+"""Tests for corpus-grounded style-guide synthesis."""
+
+from __future__ import annotations
+
+from pathlib import Path
+
+import pytest
+from PIL import Image
+from typer.testing import CliRunner
+
+from paperbanana.cli import app
+from paperbanana.core.types import ReferenceExample
+from paperbanana.guidelines.synthesis import (
+    StyleGuideSynthesisError,
+    sample_examples,
+    synthesize_style_guide,
+)
+
+runner = CliRunner()
+
+
+class RecordingVLM:
+    """Mock VLM that records every generate() call."""
+
+    name = "mock"
+    model_name = "mock-model"
+    cost_tracker = None
+
+    def __init__(self, batch_response: str = "BATCH ANALYSIS", reduce_response: str = "# GUIDE"):
+        self.calls: list[dict] = []
+        self._batch_response = batch_response
+        self._reduce_response = reduce_response
+
+    async def generate(
+        self,
+        prompt,
+        images=None,
+        system_prompt=None,
+        temperature=1.0,
+        max_tokens=4096,
+        response_format=None,
+    ):
+        self.calls.append({"prompt": prompt, "images": images})
+        if images:
+            return f"{self._batch_response} {len(self.calls)}"
+        return self._reduce_response
+
+    def is_available(self):
+        return True
+
+
+def _make_examples(tmp_path: Path, n: int, with_images: bool = True) -> list[ReferenceExample]:
+    examples = []
+    for i in range(n):
+        image_path = tmp_path / f"ref_{i:03d}.png"
+        if with_images:
+            Image.new("RGB", (4, 4), color=(200, 220, 240)).save(image_path)
+        examples.append(
+            ReferenceExample(
+                id=f"ref_{i:03d}",
+                source_context=f"Context {i}",
+                caption=f"Caption {i}",
+                image_path=str(image_path),
+                category="agents_llm" if i % 2 == 0 else "vision_perception",
+            )
+        )
+    return examples
+
+
+# ── Sampling ──────────────────────────────────────────────────────
+
+
+def test_sampling_is_deterministic_with_seed(tmp_path):
+    examples = _make_examples(tmp_path, 60)
+    first = sample_examples(examples, sample_size=50, seed=42)
+    second = sample_examples(examples, sample_size=50, seed=42)
+    assert [e.id for e in first] == [e.id for e in second]
+    assert len(first) == 50
+
+
+def test_sampling_returns_all_when_corpus_small(tmp_path):
+    examples = _make_examples(tmp_path, 10)
+    sampled = sample_examples(examples, sample_size=50, seed=1)
+    assert [e.id for e in sampled] == [e.id for e in examples]
+
+
+def test_sampling_excludes_missing_images(tmp_path):
+    examples = _make_examples(tmp_path, 5)
+    missing = _make_examples(tmp_path / "nowhere", 3, with_images=False)
+    sampled = sample_examples(examples + missing, sample_size=50, seed=1)
+    assert len(sampled) == 5
+    assert all(Path(e.image_path).exists() for e in sampled)
+
+
+# ── Map-reduce synthesis ─────────────────────────────────────────
+
+
+async def test_batching_math_and_reduce_output(tmp_path):
+    """45 examples with batch_size 20 -> 3 map calls + 1 reduce call."""
+    examples = _make_examples(tmp_path, 45)
+    vlm = RecordingVLM(reduce_response="# Final Style Guide")
+
+    result = await synthesize_style_guide(
+        vlm,
+        examples,
+        guide_type="methodology",
+        batch_size=20,
+        sample_size=50,
+        seed=7,
+    )
+
+    assert len(vlm.calls) == 4
+    map_calls, reduce_call = vlm.calls[:3], vlm.calls[3]
+    assert [len(c["images"]) for c in map_calls] == [20, 20, 5]
+    assert reduce_call["images"] is None
+    # The final output is the reduce result, not a map result.
+    assert result == "# Final Style Guide\n"
+    # The reduce prompt embeds every batch analysis.
+    for i in range(1, 4):
+        assert f"BATCH ANALYSIS {i}" in reduce_call["prompt"]
+    assert "45" in reduce_call["prompt"]  # total figures
+
+
+async def test_map_prompt_lists_figures_and_categories(tmp_path):
+    examples = _make_examples(tmp_path, 3)
+    vlm = RecordingVLM()
+
+    await synthesize_style_guide(vlm, examples, guide_type="plot", batch_size=20)
+
+    map_prompt = vlm.calls[0]["prompt"]
+    assert "ref_000" in map_prompt
+    assert "agents_llm" in map_prompt
+    assert "statistical plots" in map_prompt
+    assert "{figure_listing}" not in map_prompt  # placeholder substituted
+
+
+async def test_sample_size_caps_figures_analyzed(tmp_path):
+    examples = _make_examples(tmp_path, 30)
+    vlm = RecordingVLM()
+
+    await synthesize_style_guide(vlm, examples, batch_size=20, sample_size=10, seed=3)
+
+    assert len(vlm.calls) == 2  # one map batch of 10 + one reduce
+    assert len(vlm.calls[0]["images"]) == 10
+
+
+async def test_no_examples_with_images_raises(tmp_path):
+    missing = _make_examples(tmp_path / "nowhere", 3, with_images=False)
+    vlm = RecordingVLM()
+
+    with pytest.raises(StyleGuideSynthesisError, match="No reference examples"):
+   
```

---

### Incident Patch 5: `c9c4142e` (2026-06-11)
**Commit Message**: Merge branch 'main' into feat/style-guide-synthesis

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
                 vector_formats=vector_formats,
             )
             visualizer_seconds = time.perf_counter() - visualizer_start
+            if image_path is None:
+                _emit_progress(
+                    progress_callback,
+                    PipelineProgressEvent(
+                        stage=PipelineProgressStage.VISUALIZER_END,
+                        message=(
+                            f"Visualizer iteration {iter_index} failed; keeping previous best image"
+                        ),
+                        seconds=visualizer_seconds,
+                        iteration=iter_index,
+                        extra={"rollback": True, "error": rollback_info["error"]},
+                    ),
+                )
+                break
             _emit_progress(
                 progress_callback,
                 PipelineProgressEvent(
@@ -758,6 +834,8 @@ async def regenerate_from_ir(
             "locked_edges": len(diagram_ir.locks.locked_edge_refs),
             "locked
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
+    result = await pipeline.generate(_default_input())
+
+    # Final output exists and comes from iteration 1
+    assert result.image_path
+    assert Path(result.image_path).exists()
+    assert len(result.iterations) == 1
+    assert result.iterations[0].iteration == 1
+
+    # Metadata flags the rollback
+    rollback = result.metadata["rollback"]
+    assert rollback["rollback_occurred"] is True
+    assert rollback["failed_iteration"] == 2
+    assert rollback["rolled_back_to_iteration"] == 1
+    assert rollback["stage"] == "visualizer"
+    assert "image gen exploded" in rollback["error"]
+
+    # Failure note is persisted alongside iteration artifacts
+    run_dir = Path(settings.output_dir) / pipeline.run_id
+    failure_note = json.loads((run_dir / "iter_2" / "failure.json").read_text())
+    assert failure_note["failed"] is True
+    assert failure_note["rolled_back_to_iteration"] == 1
+
+    # Metadata on disk matches
+    metadata = json.loads((run_dir / "metadata.json").read_text())
+    assert metadata["rollback"]["
```

---

### Incident Patch 6: `38c40ef3` (2026-06-11)
**Commit Message**: feat: corpus-grounded style-guide synthesis (paperbanana guidelines synthesize)

Port the upstream generate_category_style_guide pattern: sample up to
--sample-size reference figures (deterministic with --seed), VLM-analyze
them in batches of --batch-size extracting hex palettes, layout patterns,
line/arrow semantics, shape semantics, typography, and per-category
observations, then merge the batch analyses into one markdown guide that
preserves multiple accepted design options and domain-conditional rules.

- paperbanana/guidelines/synthesis.py: async synthesize_style_guide()
  map-reduce with budget guard via the provider's CostTracker
- prompts/guidelines/{batch_analysis,synthesize}.txt: map/reduce templates
- CLI: new 'guidelines' sub-app with 'synthesize' command (--type, --venue,
  --output, --force, --reference-set, --sample-size, --batch-size, --seed,
  --vlm-provider, --vlm-model, --budget); never overwrites an existing
  guide without --force and requires explicit --venue or --output
- tests: batching math (45/20 -> 3 map + 1 reduce), seed determinism,
  missing-image filtering, CLI validation, all network-free

Fixes #236

**File**: `paperbanana/cli.py` (modified, +201/-0)
```diff
@@ -88,6 +88,14 @@ def _main(
 )
 app.add_typer(runs_app, name="runs")
 
+# ── Guidelines subcommand group ───────────────────────────────────
+guidelines_app = typer.Typer(
+    name="guidelines",
+    help="Manage style guides (synthesize from reference corpus).",
+    no_args_is_help=True,
+)
+app.add_typer(guidelines_app, name="guidelines")
+
 
 def _require_pdf_dep() -> None:
     """Raise a clean error if PyMuPDF is not installed."""
@@ -3873,6 +3881,199 @@ def references_categories(
     console.print(table)
 
 
+# ── Guidelines subcommands ────────────────────────────────────────
+
+
+@guidelines_app.command(name="synthesize")
+def guidelines_synthesize(
+    guide_type: str = typer.Option(
+        "methodology",
+        "--type",
+        help="Guide type to synthesize: methodology or plot",
+    ),
+    venue: Optional[str] = typer.Option(
+        None,
+        "--venue",
+        help=(
+            "Write the guide into the guidelines layout: "
+            "data/guidelines/<venue>/{methodology|plot}_style_guide.md"
+        ),
+    ),
+    output: Optional[str] = typer.Option(
+        None,
+        "--output",
+        "-o",
+        help="Explicit output path for the synthesized guide (e.g. ./style_guide.md)",
+    ),
+    force: bool = typer.Option(
+        False,
+        "--force",
+        help="Overwrite the target guide file if it already exists",
+    ),
+    reference_set: Optional[str] = typer.Option(
+        None,
+        "--reference-set",
+        help="Path to a reference set directory (defaults to the configured/cached set)",
+    ),
+    sample_size: int = typer.Option(
+        50,
+        "--sample-size",
+        help="Maximum number of reference figures to analyze",
+    ),
+    batch_size: int = typer.Option(
+        20,
+        "--batch-size",
+        help="Number of figures per VLM analysis call",
+    ),
+    seed: Optional[int] = typer.Option(
+        None,
+        "--seed",
+        help="Sampling seed for a reproducible corpus subset",
+    ),
+    vlm_provider: Optional[str] = typer.Option(None, "--vlm-provider", help="VLM provider"),
+    vlm_model: Optional[str] = typer.Option(None, "--vlm-model", help="VLM model name"),
+    budget: Optional[float] = typer.Option(
+        None,
+        "--budget",
+        help="Budget cap in USD; synthesis aborts gracefully when exceeded",
+    ),
+    verbose: bool = typer.Option(False, "--verbose", "-v", help="Show detailed progress"),
+    config: Optional[str] = typer.Option(None, "--config", help="Path to config YAML file"),
+):
+    """Synthesize a corpus-grounded style guide from reference figures.
+
+    Samples up to --sample-size reference figures, VLM-analyzes them in
+    batches of --batch-size (palettes, layout, line/shape semantics,
+    typography), then merges the analyses into one markdown style guide
+    that preserves multiple accepted options and domain-conditional rules.
+    """
+    from paperbanana.guidelines.synthesis import GUIDE_TYPES, synthesize_style_guide
+
+    if guide_type not in GUIDE_TYPES:
+        console.print(
+            f"[red]Error: --type must be 'methodology' or 'plot'. Got: {guide_type}[/red]"
+        )
+        raise typer.Exit(1)
+    if venue is None and output is None:
+        console.print(
+            "[red]Error: Pass --venue NAME (write into the guidelines layout) "
+            "or --output PATH (e.g. --output ./style_guide.md).[/red]\n"
+            "Built-in guides are never overwritten implicitly."
+        )
+        raise typer.Exit(1)
+    if venue is not None and output is not None:
+        console.print("[red]Error: --venue and --output are mutually exclusive.[/red]")
+        raise typer.Exit(1)
+    if venue is not None and venue.lower() not in ("neurips", "icml", "acl", "ieee"):
+        console.print(
+            f"[red]Error: --venue must be neurips, icml, acl, or ieee. Got: {venue}[/red]\n"
+            "For a custom guide location, use --output PATH and point "
+            "GUIDELINES_PATH (or reference.guidelines_path) at its directory."
+        )
+        raise typer.Exit(1)
+
+    configure_logging(verbose=verbose)
+
+    overrides: dict = {}
+    if vlm_provider:
+        overrides["vlm_provider"] = vlm_provider
+    if vlm_model:
+        overrides["vlm_model"] = vlm_model
+    if reference_set:
+        overrides["reference_set_path"] = reference_set
+
+    if config:
+        settings = Settings.from_yaml(config, **overrides)
+    else:
+        from dotenv import load_dotenv
+
+        load_dotenv()
+        settings = Settings(**overrides)
+
+    if venue is not None:
+        target = Path(settings.guidelines_path) / venue.lower() / f"{guide_type}_style_guide.md"
+    else:
+        target = Path(output)  # type: ignore[arg-type]
+    if target.exists() and not force:
+        console.print(
+            f"[red]Error: {target} already exists.[/red] "
+            "Pass --force to overwrite it, or choose another --output path.
```

**File**: `paperbanana/guidelines/synthesis.py` (added, +222/-0)
```diff
@@ -0,0 +1,222 @@
+"""Corpus-grounded style-guide synthesis via VLM map-reduce.
+
+Ports the upstream ``generate_category_style_guide`` pattern: sample up to
+``sample_size`` reference figures, VLM-analyze them in batches of
+``batch_size`` (map step), then merge the batch analyses into a single
+markdown style guide (reduce step). The resulting guide preserves multiple
+accepted design options and domain-conditional styling (hex palettes,
+line/arrow semantics, shape semantics) rather than averaging everything
+into one style.
+"""
+
+from __future__ import annotations
+
+import random
+from collections.abc import Callable, Sequence
+from pathlib import Path
+
+import structlog
+
+from paperbanana.core.types import ReferenceExample
+from paperbanana.core.utils import find_prompt_dir, load_image
+from paperbanana.providers.base import VLMProvider
+
+logger = structlog.get_logger()
+
+GUIDE_TYPES = ("methodology", "plot")
+
+_GUIDE_TYPE_LABELS = {
+    "methodology": "methodology / architecture diagrams",
+    "plot": "statistical plots and charts",
+}
+
+
+class StyleGuideSynthesisError(RuntimeError):
+    """Raised when style-guide synthesis cannot proceed (no images, over budget)."""
+
+
+def _check_budget(vlm: VLMProvider, stage: str) -> None:
+    """Abort synthesis if the provider's cost tracker reports budget exhaustion."""
+    tracker = getattr(vlm, "cost_tracker", None)
+    if tracker is not None and tracker.is_over_budget:
+        raise StyleGuideSynthesisError(
+            f"Budget exceeded {stage} "
+            f"(spent ${tracker.total_cost:.4f} of ${tracker.budget:.4f}). "
+            "Increase --budget or reduce --sample-size."
+        )
+
+
+def _load_template(name: str, prompt_dir: str | None) -> str:
+    """Load a prompt template from ``{prompt_dir}/guidelines/{name}.txt``."""
+    base = Path(prompt_dir) if prompt_dir else Path(find_prompt_dir())
+    path = base / "guidelines" / f"{name}.txt"
+    if not path.exists():
+        raise FileNotFoundError(f"Prompt template not found: {path}")
+    return path.read_text(encoding="utf-8")
+
+
+def _fill(template: str, **values: str) -> str:
+    """Substitute ``{placeholder}`` tokens without str.format brace pitfalls.
+
+    Batch analyses and captions routinely contain literal braces (LaTeX,
+    JSON snippets), so ``str.format`` would raise. Plain replacement keeps
+    the established ``{placeholder}`` template convention while staying
+    robust to arbitrary corpus text.
+    """
+    for key, value in values.items():
+        template = template.replace("{" + key + "}", value)
+    return template
+
+
+def sample_examples(
+    examples: Sequence[ReferenceExample],
+    sample_size: int,
+    seed: int | None = None,
+) -> list[ReferenceExample]:
+    """Deterministically sample up to ``sample_size`` examples with existing images.
+
+    Args:
+        examples: Candidate reference examples.
+        sample_size: Maximum number of examples to keep.
+        seed: Seed for ``random.Random`` — same seed and corpus yield the
+            same sample.
+
+    Returns:
+        Sampled examples in stable (corpus) order.
+    """
+    eligible = [e for e in examples if e.image_path and Path(e.image_path).exists()]
+    if len(eligible) <= sample_size:
+        return eligible
+    rng = random.Random(seed)
+    sampled = rng.sample(eligible, sample_size)
+    # Preserve corpus order so batches are stable and reviewable.
+    order = {id(e): i for i, e in enumerate(eligible)}
+    sampled.sort(key=lambda e: order[id(e)])
+    return sampled
+
+
+def _figure_listing(batch: Sequence[ReferenceExample]) -> str:
+    """Describe the images attached to a batch call, in attachment order."""
+    lines = []
+    for i, example in enumerate(batch, start=1):
+        caption = example.caption.strip().replace("\n", " ")
+        if len(caption) > 200:
+            caption = caption[:197] + "..."
+        category = example.category or "uncategorized"
+        lines.append(f"{i}. [{example.id}] category: {category} — {caption}")
+    return "\n".join(lines)
+
+
+async def synthesize_style_guide(
+    vlm: VLMProvider,
+    examples: Sequence[ReferenceExample],
+    *,
+    guide_type: str = "methodology",
+    batch_size: int = 20,
+    sample_size: int = 50,
+    seed: int | None = None,
+    prompt_dir: str | None = None,
+    progress_callback: Callable[[str], None] | None = None,
+) -> str:
+    """Synthesize a markdown style guide from a reference figure corpus.
+
+    Map-reduce over the corpus: each batch of figures is analyzed by the VLM
+    (palettes, layout, line/shape semantics, typography, per-category
+    observations), then a single reduce call merges the batch analyses into
+    one guide that preserves multiple accepted options and
+    domain-conditional rules.
+
+    Args:
+        vlm: VLM provider used for both map and reduce calls.
+        examples: Candidate reference examples (only ones whose image file
+            exists ar
```

**File**: `prompts/guidelines/batch_analysis.txt` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+You are a Lead Visual Designer auditing figures from top-tier AI conference papers (NeurIPS, ICML, ICLR, CVPR, ACL). You are building a corpus-grounded style guide for {guide_type_label}.
+
+You are given {figure_count} published reference figures (attached as images, in order). For each visual dimension below, record the CONCRETE design decisions you observe across the batch. Report what the corpus actually does — including when different figures make different, equally valid choices. Do NOT average distinct styles into one; enumerate each accepted variant and roughly how common it is in this batch (e.g., "dominant", "~1/3 of figures", "rare").
+
+## Figures in this batch
+{figure_listing}
+
+## Dimensions to analyze
+
+1. **Color palettes**: Exact or closely estimated hex codes for backgrounds, fills, borders, accents (e.g., #E8F0FE pale blue fill with #4285F4 border). Group recurring palettes. Note saturation/opacity conventions and which colors carry meaning (e.g., warm = trainable, cool = frozen, red = loss/error).
+2. **Layout & composition**: Flow direction, grid alignment, grouping/zoning strategies, macro-micro patterns, whitespace usage, multi-panel arrangements, aspect-ratio tendencies.
+3. **Line & arrow semantics**: What solid vs dashed vs dotted lines mean; arrowhead styles; straight vs orthogonal/elbow vs curved routing and when each is used; line colors/weights; operators or labels placed on lines.
+4. **Shape semantics**: Which shapes encode which concepts (rounded rectangles for processes, cylinders for storage, 3D stacks for tensors, circles for operations, etc.); border styles (solid vs dashed) and what they signal; container/grouping shapes.
+5. **Typography & icons**: Font families (serif vs sans-serif), where bold/italics are used, label sizing hierarchy, math notation styling, icon vocabulary and conventional meanings (e.g., snowflake = frozen, flame = trainable).
+6. **Per-category observations**: Using the category labels in the figure listing, note styling that is conditional on the paper domain (e.g., agent/LLM figures use cartoon icons and chat bubbles; vision figures use frustums and RGB coding; theory figures stay minimalist/grayscale).
+
+## Output format
+
+Markdown notes with one `##` section per dimension above (1-6). Under each section, use bullet points with concrete values (hex codes, shape names, line styles) and prevalence estimates. Reference figures by their listing number where helpful. Do not include any conversational preamble.
```

**File**: `prompts/guidelines/synthesize.txt` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+You are a Lead Visual Designer writing the definitive style guide for {guide_type_label} at top-tier AI conferences. Below are {batch_count} batch analyses produced by auditing {total_figures} published reference figures.
+
+Merge these analyses into ONE complete, self-contained markdown style guide that a designer (or an AI illustration agent) can follow without seeing the original figures.
+
+## Critical requirements
+
+1. **Preserve plurality**: The corpus contains MULTIPLE accepted styles, not one. When the batch analyses report distinct valid options (e.g., three different background palette families, or both orthogonal and curved arrow routing), the guide MUST present each as a named option with guidance on when to choose it. NEVER average competing styles into a single bland compromise.
+2. **Keep it concrete**: Carry forward exact hex codes, named palettes, shape names, line styles, and font conventions from the analyses. Replace vague advice ("use pleasant colors") with corpus-grounded specifics ("pale blue #E8F0FE fill with #4285F4 border, ~15% opacity zones").
+3. **Preserve semantics**: Document what visual choices MEAN, not just how they look — line semantics (solid = data flow, dashed = gradients/auxiliary), shape semantics (cylinder = storage, rounded rectangle = process), color semantics (warm = trainable, cool = frozen), and icon vocabulary.
+4. **Domain-conditional rules**: Include a dedicated section of per-domain styling rules derived from the per-category observations (e.g., "AGENT/LLM papers: illustrative, cartoony, chat bubbles" vs "THEORY papers: minimalist, grayscale plus one accent"). These rules must stay conditional on the paper's domain — do not promote one domain's style to a universal rule.
+5. **Resolve conflicts honestly**: Where batch analyses disagree, prefer the option reported as more prevalent, but keep genuinely common minority variants as alternatives. Drop one-off outliers.
+6. **Note pitfalls**: Include a short "Common Pitfalls" section for anti-patterns implied by the corpus (e.g., harsh saturated backgrounds, mixed font families, ambiguous arrow styles).
+
+## Output structure
+
+A markdown document with: a title; a short overview of the prevailing look; detailed sections for Color Palettes, Layout & Composition, Lines & Arrows, Shapes & Containers, Typography & Icons (each listing the accepted options); a Domain-Specific Styles section; and a Common Pitfalls section. Output ONLY the markdown guide — no conversational preamble or commentary about the synthesis process.
+
+## Batch analyses
+
+{batch_analyses}
```

**File**: `tests/test_guidelines_synthesis.py` (added, +234/-0)
```diff
@@ -0,0 +1,234 @@
+"""Tests for corpus-grounded style-guide synthesis."""
+
+from __future__ import annotations
+
+from pathlib import Path
+
+import pytest
+from PIL import Image
+from typer.testing import CliRunner
+
+from paperbanana.cli import app
+from paperbanana.core.types import ReferenceExample
+from paperbanana.guidelines.synthesis import (
+    StyleGuideSynthesisError,
+    sample_examples,
+    synthesize_style_guide,
+)
+
+runner = CliRunner()
+
+
+class RecordingVLM:
+    """Mock VLM that records every generate() call."""
+
+    name = "mock"
+    model_name = "mock-model"
+    cost_tracker = None
+
+    def __init__(self, batch_response: str = "BATCH ANALYSIS", reduce_response: str = "# GUIDE"):
+        self.calls: list[dict] = []
+        self._batch_response = batch_response
+        self._reduce_response = reduce_response
+
+    async def generate(
+        self,
+        prompt,
+        images=None,
+        system_prompt=None,
+        temperature=1.0,
+        max_tokens=4096,
+        response_format=None,
+    ):
+        self.calls.append({"prompt": prompt, "images": images})
+        if images:
+            return f"{self._batch_response} {len(self.calls)}"
+        return self._reduce_response
+
+    def is_available(self):
+        return True
+
+
+def _make_examples(tmp_path: Path, n: int, with_images: bool = True) -> list[ReferenceExample]:
+    examples = []
+    for i in range(n):
+        image_path = tmp_path / f"ref_{i:03d}.png"
+        if with_images:
+            Image.new("RGB", (4, 4), color=(200, 220, 240)).save(image_path)
+        examples.append(
+            ReferenceExample(
+                id=f"ref_{i:03d}",
+                source_context=f"Context {i}",
+                caption=f"Caption {i}",
+                image_path=str(image_path),
+                category="agents_llm" if i % 2 == 0 else "vision_perception",
+            )
+        )
+    return examples
+
+
+# ── Sampling ──────────────────────────────────────────────────────
+
+
+def test_sampling_is_deterministic_with_seed(tmp_path):
+    examples = _make_examples(tmp_path, 60)
+    first = sample_examples(examples, sample_size=50, seed=42)
+    second = sample_examples(examples, sample_size=50, seed=42)
+    assert [e.id for e in first] == [e.id for e in second]
+    assert len(first) == 50
+
+
+def test_sampling_returns_all_when_corpus_small(tmp_path):
+    examples = _make_examples(tmp_path, 10)
+    sampled = sample_examples(examples, sample_size=50, seed=1)
+    assert [e.id for e in sampled] == [e.id for e in examples]
+
+
+def test_sampling_excludes_missing_images(tmp_path):
+    examples = _make_examples(tmp_path, 5)
+    missing = _make_examples(tmp_path / "nowhere", 3, with_images=False)
+    sampled = sample_examples(examples + missing, sample_size=50, seed=1)
+    assert len(sampled) == 5
+    assert all(Path(e.image_path).exists() for e in sampled)
+
+
+# ── Map-reduce synthesis ─────────────────────────────────────────
+
+
+async def test_batching_math_and_reduce_output(tmp_path):
+    """45 examples with batch_size 20 -> 3 map calls + 1 reduce call."""
+    examples = _make_examples(tmp_path, 45)
+    vlm = RecordingVLM(reduce_response="# Final Style Guide")
+
+    result = await synthesize_style_guide(
+        vlm,
+        examples,
+        guide_type="methodology",
+        batch_size=20,
+        sample_size=50,
+        seed=7,
+    )
+
+    assert len(vlm.calls) == 4
+    map_calls, reduce_call = vlm.calls[:3], vlm.calls[3]
+    assert [len(c["images"]) for c in map_calls] == [20, 20, 5]
+    assert reduce_call["images"] is None
+    # The final output is the reduce result, not a map result.
+    assert result == "# Final Style Guide\n"
+    # The reduce prompt embeds every batch analysis.
+    for i in range(1, 4):
+        assert f"BATCH ANALYSIS {i}" in reduce_call["prompt"]
+    assert "45" in reduce_call["prompt"]  # total figures
+
+
+async def test_map_prompt_lists_figures_and_categories(tmp_path):
+    examples = _make_examples(tmp_path, 3)
+    vlm = RecordingVLM()
+
+    await synthesize_style_guide(vlm, examples, guide_type="plot", batch_size=20)
+
+    map_prompt = vlm.calls[0]["prompt"]
+    assert "ref_000" in map_prompt
+    assert "agents_llm" in map_prompt
+    assert "statistical plots" in map_prompt
+    assert "{figure_listing}" not in map_prompt  # placeholder substituted
+
+
+async def test_sample_size_caps_figures_analyzed(tmp_path):
+    examples = _make_examples(tmp_path, 30)
+    vlm = RecordingVLM()
+
+    await synthesize_style_guide(vlm, examples, batch_size=20, sample_size=10, seed=3)
+
+    assert len(vlm.calls) == 2  # one map batch of 10 + one reduce
+    assert len(vlm.calls[0]["images"]) == 10
+
+
+async def test_no_examples_with_images_raises(tmp_path):
+    missing = _make_examples(tmp_path / "nowhere", 3, with_images=False)
+    vlm = RecordingVLM()
+
+    with pytest.raises(StyleGuideSynthesisError, match="No reference examples"):
+   
```

---

### Incident Patch 7: `c97fc3a8` (2026-06-11)
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
                 vector_formats=vector_formats,
             )
             visualizer_seconds = time.perf_counter() - visualizer_start
+            if image_path is None:
+                _emit_progress(
+                    progress_callback,
+                    PipelineProgressEvent(
+                        stage=PipelineProgressStage.VISUALIZER_END,
+                        message=(
+                            f"Visualizer iteration {iter_index} failed; keeping previous best image"
+                        ),
+                        seconds=visualizer_seconds,
+                        iteration=iter_index,
+                        extra={"rollback": True, "error": rollback_info["error"]},
+                    ),
+                )
+                break
             _emit_progress(
                 progress_callback,
                 PipelineProgressEvent(
@@ -758,6 +834,8 @@ async def regenerate_from_ir(
             "locked_edges": len(diagram_ir.locks.locked_edge_refs),
             "locked
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
+    result = await pipeline.generate(_default_input())
+
+    # Final output exists and comes from iteration 1
+    assert result.image_path
+    assert Path(result.image_path).exists()
+    assert len(result.iterations) == 1
+    assert result.iterations[0].iteration == 1
+
+    # Metadata flags the rollback
+    rollback = result.metadata["rollback"]
+    assert rollback["rollback_occurred"] is True
+    assert rollback["failed_iteration"] == 2
+    assert rollback["rolled_back_to_iteration"] == 1
+    assert rollback["stage"] == "visualizer"
+    assert "image gen exploded" in rollback["error"]
+
+    # Failure note is persisted alongside iteration artifacts
+    run_dir = Path(settings.output_dir) / pipeline.run_id
+    failure_note = json.loads((run_dir / "iter_2" / "failure.json").read_text())
+    assert failure_note["failed"] is True
+    assert failure_note["rolled_back_to_iteration"] == 1
+
+    # Metadata on disk matches
+    metadata = json.loads((run_dir / "metadata.json").read_text())
+    assert metadata["rollback"]["
```

---

### Incident Patch 8: `a1f36360` (2026-06-11)
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
+        console.print("\n[bold]Per-difficulty breakdown:[/bold]")
+        for diff, stats in diff_breakdown.items():
+            console.print(
+                f"  {diff:30s} n={stats['count']:3d}  "
+                f"win_rate={stats['model_win_rate']:5.1f}%  "
+                f"mean={stats['mean_score']:.1f}"
+            )
+
     if report.run_dir:
         report_path = Path(report.run_dir)
     else:
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
+        with open(index_path, encoding="utf-8") as f:
+            data = json.load(f)
+
+        task_dir = index_path.parent
+        cases: list[TestCase] = []
+        for raw in data.get("cases", []):
+            raw = dict(raw)
+            raw["gt_image_path"] = str(task_dir / raw.get("gt_image_path", ""))
+            cases.append(TestCase(**raw))
+        return cases
+
     def _record_dataset(
         self,
         dataset: str,
@@ -270,6 +339,9 @@ def clear(self) -> None:
         if self.reference_dir.exists():
             shutil.rmtree(self.reference_dir)
             logger.info("Cleared cached dataset", path=str(self.reference_dir))
+        if self.test_split_dir.exists():
+            shutil.rmtree(self.test_split_dir)
+            logger.info("Cleared cached test split", path=str(self.test_split_dir))
 
 
 def _download_file(url: str, dest: Path) -> None:
@@ -467,6 +539,103 @@ def _import_from_bench(
     return all_examples
 
 
+def _import_test_split(
+    bench_dir:
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
+        visualizer_factory: Optional[Callable[[Settings], VisualizerAgent]] = None,
     ):
         self.settings = settings
         self.pipeline_factory = pipeline_factory
         self.judge_factory = judge_factory or self._default_judge_factory
+        # Used only in vanilla mode: a single direct Visualizer call per entry.
+        self.visualizer_factory = visualizer_factory or self._default_visualizer_factory
         # Concurrency for processing benchmark entries (generation + evaluation).
         # Defaults to 1 to preserve existing sequential behaviour unless
         # explicitly overridden by the caller.
@@ -180,6 +212,42 @@ def _default_judge_factory(self, settings: Settings) -> VLMJudge:
         vlm = ProviderRegistry.create_vlm(settings)
         return VLMJudge(vlm, prompt_dir=find_prompt_dir())
 
+    def _default_visualizer_factory(self, settings: Settings) -> VisualizerAgent:
+        from paperbanana.core.utils import find_prompt_dir
+
+        vlm = ProviderRegistry.create_vlm(settings)
+        image_gen = ProviderRe
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

**File**: `tests/test_evaluation/test_benchmark.py` (modified, +110/-0)
```diff
@@ -434,3 +434,113 @@ async def test_benchmark_runner_eval_only_rejects_path_traversal(tmp_path):
     assert report.completed == 0
     assert report.entries[0].error is not None
     assert "invalid entry id" in report.entries[0].error.lower()
+
+
+# ── Official test split (issue #235) ─────────────────────────────
+
+
+def _make_test_cases() -> list:
+    from paperbanana.core.types import TestCase
+
+    return [
+        TestCase(
+            id="t1",
+            task="diagram",
+            category="vision",
+            source_context="methodology text",
+            caption="Overview of the framework",
+            gt_image_path="/gt/t1.jpg",
+            aspect_ratio="16:9",
+        ),
+        TestCase(
+            id="t2",
+            task="plot",
+            source_context='{"x": [1, 2]}',
+            caption="Bar chart",
+            gt_image_path="/gt/t2.jpg",
+            aspect_ratio="3:2",
+            raw_data={"x": [1, 2]},
+            gt_code="plt.bar([1], [2])",
+            difficulty="easy",
+        ),
+    ]
+
+
+def test_testcase_filtering_works_like_reference():
+    cases = _make_test_cases()
+    assert len(filter_examples(cases, category="vision")) == 1
+    assert filter_examples(cases, ids=["t2"])[0].id == "t2"
+    assert len(filter_examples(cases, limit=1)) == 1
+
+
+def test_run_rejects_unknown_mode():
+    import asyncio
+
+    runner = BenchmarkRunner(Settings(), judge_factory=lambda s: object())
+    with pytest.raises(ValueError, match="mode must be"):
+        asyncio.run(runner.run([], mode="bogus"))
+
+
+class _MockVisualizer:
+    """Captures vanilla-mode calls and writes a fake output image."""
+
+    def __init__(self):
+        self.calls = []
+
+    def set_output_dir(self, path):
+        self.out_dir = path
+
+    async def run(self, **kwargs):
+        self.calls.append(kwargs)
+        from pathlib import Path
+
+        out = Path(kwargs["output_path"])
+        out.parent.mkdir(parents=True, exist_ok=True)
+        out.write_bytes(b"img")
+        return str(out)
+
+
+class _MockJudge:
+    async def evaluate(self, **kwargs):
+        dim = DimensionResult(score=8, rationale="ok", winner="Both are good")
+        return EvaluationScore(
+            faithfulness=dim,
+            conciseness=dim,
+            readability=dim,
+            aesthetics=dim,
+            overall_winner="Both are good",
+            overall_score=8.0,
+        )
+
+
+async def test_vanilla_mode_single_visualizer_call(tmp_path):
+    """Vanilla mode makes exactly one direct visualizer call per entry,
+
+    threading the official aspect ratio, and never builds the pipeline."""
+    visualizer = _MockVisualizer()
+
+    def _fail_pipeline(settings):
+        raise AssertionError("pipeline must not be constructed in vanilla mode")
+
+    runner = BenchmarkRunner(
+        Settings(output_dir=str(tmp_path)),
+        pipeline_factory=_fail_pipeline,
+        judge_factory=lambda s: _MockJudge(),
+        visualizer_factory=lambda s: visualizer,
+    )
+    gt = tmp_path / "gt.jpg"
+    gt.write_bytes(b"gt-image")
+    diagram_case = _make_test_cases()[0].model_copy(update={"gt_image_path": str(gt)})
+    report = await runner.run(
+        [diagram_case], output_dir=tmp_path / "run", mode="vanilla", split="test", task="diagram"
+    )
+
+    assert len(visualizer.calls) == 1
+    call = visualizer.calls[0]
+    assert call["aspect_ratio"] == "16:9"
+    assert call["iteration"] == 1
+    entry_result = report.entries[0]
+    assert entry_result.error is None
+    assert entry_result.iteration_count == 1
+    assert report.mode == "vanilla"
+    assert report.split == "test"
```

---

### Incident Patch 9: `df340a1b` (2026-06-11)
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
                 vector_formats=vector_formats,
             )
             visualizer_seconds = time.perf_counter() - visualizer_start
+            if image_path is None:
+                _emit_progress(
+                    progress_callback,
+                    PipelineProgressEvent(
+                        stage=PipelineProgressStage.VISUALIZER_END,
+                        message=(
+                            f"Visualizer iteration {iter_index} failed; keeping previous best image"
+                        ),
+                        seconds=visualizer_seconds,
+                        iteration=iter_index,
+                        extra={"rollback": True, "error": rollback_info["error"]},
+                    ),
+                )
+                break
             _emit_progress(
                 progress_callback,
                 PipelineProgressEvent(
@@ -758,6 +834,8 @@ async def regenerate_from_ir(
             "locked_edges": len(diagram_ir.locks.locked_edge_refs),
             "locked
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
+    result = await pipeline.generate(_default_input())
+
+    # Final output exists and comes from iteration 1
+    assert result.image_path
+    assert Path(result.image_path).exists()
+    assert len(result.iterations) == 1
+    assert result.iterations[0].iteration == 1
+
+    # Metadata flags the rollback
+    rollback = result.metadata["rollback"]
+    assert rollback["rollback_occurred"] is True
+    assert rollback["failed_iteration"] == 2
+    assert rollback["rolled_back_to_iteration"] == 1
+    assert rollback["stage"] == "visualizer"
+    assert "image gen exploded" in rollback["error"]
+
+    # Failure note is persisted alongside iteration artifacts
+    run_dir = Path(settings.output_dir) / pipeline.run_id
+    failure_note = json.loads((run_dir / "iter_2" / "failure.json").read_text())
+    assert failure_note["failed"] is True
+    assert failure_note["rolled_back_to_iteration"] == 1
+
+    # Metadata on disk matches
+    metadata = json.loads((run_dir / "metadata.json").read_text())
+    assert metadata["rollback"]["
```

---

### Incident Patch 10: `fbabba68` (2026-06-11)
**Commit Message**: feat: add Colab quickstart notebook and Dockerfile

Lower the try-it barrier with two zero-setup entry points:

- notebooks/PaperBanana_Colab_Quickstart.ipynb: end-to-end Colab demo
  (pip install from PyPI with the google extra, free-tier Gemini key via
  getpass, inline methodology example, 1-iteration generation with a
  budget cap, inline image display, optional plot / reference-set
  download / evaluation cells)
- Dockerfile: python:3.11-slim, installs .[google,openai,pdf] from the
  build context, non-root user, /work runtime dir for volume mounts,
  ENTRYPOINT paperbanana; plus .dockerignore to keep the context small
  and exclude .env
- README: Open in Colab badge, Colab callout in Quick Start, and a
  Docker section under installation

Fixes #239

**File**: `.dockerignore` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+# VCS / CI
+.git
+.github
+.claude
+
+# Virtual environments
+.venv
+venv
+
+# Build artifacts and caches
+dist
+build
+*.egg-info
+__pycache__
+*.pyc
+.pytest_cache
+.ruff_cache
+.mypy_cache
+
+# Local state and secrets
+.env
+outputs
+wiki-temp
+
+# Not needed inside the image (Dockerfile copies explicit paths anyway;
+# these just keep the build context small)
+tests
+docs
+assets
+examples
+notebooks
+integrations
+scripts
```

**File**: `Dockerfile` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+# PaperBanana — publication-quality academic diagrams from text descriptions.
+#
+# Build:
+#   docker build -t paperbanana .
+#
+# Run (Gemini, free tier — get a key at https://aistudio.google.com/app/apikey):
+#   docker run --rm -e GOOGLE_API_KEY paperbanana generate --help
+#
+# Generate a diagram, persisting outputs to the host:
+#   docker run --rm -e GOOGLE_API_KEY \
+#     -v "$(pwd)/method.txt:/work/method.txt:ro" \
+#     -v "$(pwd)/outputs:/work/outputs" \
+#     paperbanana generate --input method.txt --caption "Overview of our framework"
+
+FROM python:3.11-slim
+
+ENV PYTHONUNBUFFERED=1 \
+    PIP_NO_CACHE_DIR=1 \
+    PIP_DISABLE_PIP_VERSION_CHECK=1
+
+WORKDIR /build
+
+# Everything the hatchling wheel build needs:
+#  - pyproject.toml (build config), README.md (project.readme), LICENSE (SPDX license file)
+#  - paperbanana/ and mcp_server/ (wheel packages)
+#  - prompts/, data/, configs/ (force-included package data, resolved at runtime
+#    relative to the installed package)
+COPY pyproject.toml README.md LICENSE ./
+COPY paperbanana/ paperbanana/
+COPY mcp_server/ mcp_server/
+COPY prompts/ prompts/
+COPY data/ data/
+COPY configs/ configs/
+
+# Install the package (the wheel embeds prompts/, data/, configs/), then drop
+# the build context — it is fully duplicated inside site-packages.
+RUN pip install ".[google,openai,pdf]" && cd / && rm -rf /build
+
+# Non-root runtime user; /work is the writable working directory where the CLI
+# reads inputs and writes the outputs/ folder (mount volumes here).
+RUN useradd --create-home --uid 1000 paperbanana \
+    && mkdir /work \
+    && chown paperbanana:paperbanana /work
+
+USER paperbanana
+WORKDIR /work
+
+ENTRYPOINT ["paperbanana"]
+CMD ["--help"]
```

**File**: `README.md` (modified, +23/-0)
```diff
@@ -11,6 +11,7 @@
         <a href="https://github.com/llmsresearch/paperbanana/actions/workflows/ci.yml"><img src="https://github.com/llmsresearch/paperbanana/actions/workflows/ci.yml/badge.svg" alt="CI"/></a>
         <a href="https://pypi.org/project/paperbanana/"><img src="https://img.shields.io/pypi/dm/paperbanana?label=PyPI%20downloads&logo=pypi&logoColor=white" alt="PyPI Downloads"/></a>
         <a href="https://huggingface.co/spaces/llmsresearch/paperbanana"><img src="https://img.shields.io/badge/Demo-HuggingFace-yellow?logo=huggingface&logoColor=white" alt="Demo"/></a>
+        <a href="https://colab.research.google.com/github/llmsresearch/paperbanana/blob/main/notebooks/PaperBanana_Colab_Quickstart.ipynb"><img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open in Colab"/></a>
         <br/>
         <a href="https://www.python.org/downloads/"><img src="https://img.shields.io/badge/python-3.10%2B-blue?logo=python&logoColor=white" alt="Python 3.10+"/></a>
         <a href="https://arxiv.org/abs/2601.23265"><img src="https://img.shields.io/badge/arXiv-2601.23265-b31b1b?logo=arxiv&logoColor=white" alt="arXiv"/></a>
@@ -64,6 +65,10 @@ Check out Atlas Cloud's new coding plan promotion for more budget-friendly API a
 
 ## Quick Start
 
+> **Try it in your browser:** the
+> [Colab quickstart notebook](https://colab.research.google.com/github/llmsresearch/paperbanana/blob/main/notebooks/PaperBanana_Colab_Quickstart.ipynb)
+> walks through install → API key → diagram generation end-to-end, no local setup required.
+
 ### Prerequisites
 
 - Python 3.10+
@@ -84,6 +89,24 @@ cd paperbanana
 pip install -e ".[dev,openai,google]"
 ```
 
+#### Docker
+
+Build the image from a clone of the repo and pass your API key at runtime:
+
+```bash
+docker build -t paperbanana .
+docker run --rm -e GOOGLE_API_KEY paperbanana generate --help
+```
+
+To generate a diagram, mount your input and an outputs folder into `/work`:
+
+```bash
+docker run --rm -e GOOGLE_API_KEY \
+  -v "$(pwd)/method.txt:/work/method.txt:ro" \
+  -v "$(pwd)/outputs:/work/outputs" \
+  paperbanana generate --input method.txt --caption "Overview of our framework"
+```
+
 ### Step 2: Get Your API Key
 
 ```bash
```

**File**: `notebooks/PaperBanana_Colab_Quickstart.ipynb` (added, +320/-0)
```diff
@@ -0,0 +1,320 @@
+{
+ "nbformat": 4,
+ "nbformat_minor": 5,
+ "metadata": {
+  "colab": {
+   "name": "PaperBanana_Colab_Quickstart.ipynb",
+   "provenance": []
+  },
+  "kernelspec": {
+   "display_name": "Python 3",
+   "language": "python",
+   "name": "python3"
+  },
+  "language_info": {
+   "name": "python"
+  }
+ },
+ "cells": [
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "# PaperBanana — Colab Quickstart\n",
+    "\n",
+    "[![Open in Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/llmsresearch/paperbanana/blob/main/notebooks/PaperBanana_Colab_Quickstart.ipynb)\n",
+    "\n",
+    "[PaperBanana](https://github.com/llmsresearch/paperbanana) generates publication-quality\n",
+    "methodology diagrams and statistical plots from plain-text descriptions, using a\n",
+    "multi-agent pipeline (Retriever → Planner → Stylist → Visualizer ⇄ Critic).\n",
+    "\n",
+    "This notebook runs end-to-end in about 5 minutes:\n",
+    "\n",
+    "1. Install PaperBanana from PyPI\n",
+    "2. Set a **Google Gemini API key** (free tier available)\n",
+    "3. Generate a methodology diagram from a tiny inline example\n",
+    "4. *(Optional)* Generate a statistical plot from inline CSV data\n",
+    "5. *(Optional)* Download the full reference set and run an evaluation\n",
+    "\n",
+    "**What you need:** a free Gemini API key from\n",
+    "[Google AI Studio](https://aistudio.google.com/app/apikey).\n",
+    "PaperBanana also supports OpenAI, Azure OpenAI, Atlas Cloud, and OpenRouter —\n",
+    "see the [README](https://github.com/llmsresearch/paperbanana#providers) — but Gemini\n",
+    "is the default and has a free tier, so that is what this notebook uses."
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "## 1. Install\n",
+    "\n",
+    "Install PaperBanana from PyPI with the Google Gemini provider extra."
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": null,
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "%pip install -q \"paperbanana[google]\""
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "## 2. Set your API key\n",
+    "\n",
+    "Get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey) and paste it\n",
+    "below (the prompt hides your input; nothing is stored in the notebook).\n",
+    "\n",
+    "> **Using OpenAI instead?** Set `os.environ[\"OPENAI_API_KEY\"]` here and add\n",
+    "> `--vlm-provider openai --image-provider openai_imagen` to the commands below."
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": null,
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "import os\n",
+    "from getpass import getpass\n",
+    "\n",
+    "os.environ[\"GOOGLE_API_KEY\"] = getpass(\"Paste your Gemini API key: \")"
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "## 3. Write a tiny methodology example\n",
+    "\n",
+    "PaperBanana takes a plain-text description of your method as input. We write a small\n",
+    "example inline so the notebook has no external dependencies — replace it with your\n",
+    "own methodology text later."
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": null,
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "methodology = \"\"\"\\\n",
+    "Our model builds on the Transformer architecture with several key modifications.\n",
+    "\n",
+    "Input tokens are embedded through a learned embedding layer and combined with\n",
+    "sinusoidal positional encodings. The result passes through a stack of N=12 encoder\n",
+    "layers, each consisting of multi-head self-attention (8 heads) followed by a\n",
+    "position-wise feed-forward network with GELU activation. Layer normalization is\n",
+    "applied before each sub-layer (Pre-LN), with residual connections around each.\n",
+    "\n",
+    "The decoder mirrors this structure but adds a cross-attention layer between the\n",
+    "self-attention and feed-forward sub-layers, attending to the encoder output.\n",
+    "Causal masking prevents the decoder from attending to future positions.\n",
+    "\n",
+    "We introduce a sparse attention pattern in the encoder that reduces quadratic\n",
+    "complexity to O(n sqrt(n)): a learned router predicts attention scores for all\n",
+    "positions and selects the top-k positions for each query.\n",
+    "\n",
+    "The final decoder output is projected through a linear layer followed by softmax\n",
+    "to produce output token probabilities.\n",
+    "\"\"\"\n",
+    "\n",
+    "with open(\"method.txt\", \"w\") as f:\n",
+    "    f.write(methodology)\n",
+    "\n",
+    "print(f\"Wrote method.txt ({len(methodology)} chars)\")"
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "## 4. Generate the diagram\n",
+    "\n",
+    "We run a singl
```

---

### Incident Patch 11: `74f1e6aa` (2026-06-11)
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

### Incident Patch 12: `8c93abae` (2026-06-11)
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

### Incident Patch 13: `1631993b` (2026-06-11)
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

### Incident Patch 14: `903a1add` (2026-06-11)
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

### Incident Patch 15: `28d664eb` (2026-06-11)
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

**File**: `paperbanana/evaluation/judge.py` (modified, +6/-2)
```diff
@@ -14,7 +14,7 @@
     DimensionResult,
     EvaluationScore,
 )
-from paperbanana.core.utils import extract_json, load_image
+from paperbanana.core.utils import extract_json, load_image, truncate_text
 from paperbanana.providers.base import VLMProvider
 
 logger = structlog.get_logger()
@@ -164,7 +164,11 @@ def _parse_result(self, response: str, dimension: str) -> DimensionResult:
                 score=score,
                 reasoning=reasoning,
             )
-        logger.warning("Failed to parse evaluation response", dimension=dimension)
+        logger.warning(
+            "Failed to parse evaluation response",
+            dimension=dimension,
+            raw_response=truncate_text(response, 500),
+        )
         return DimensionResult(
             winner="Both are good",
             score=50.0,
```

**File**: `tests/test_agents/test_critic_parse.py` (modified, +58/-0)
```diff
@@ -32,6 +32,41 @@ def test_truncated_json_returns_none(self):
         assert extract_json('{"key": "val') is None
 
 
+class TestExtractJsonRobustness:
+    """extract_json should recover JSON wrapped in fences or prose."""
+
+    def test_json_fence(self):
+        text = '```json\n{"key": "value"}\n```'
+        assert extract_json(text) == {"key": "value"}
+
+    def test_plain_fence(self):
+        text = '```\n{"key": "value"}\n```'
+        assert extract_json(text) == {"key": "value"}
+
+    def test_inline_fence_without_newline(self):
+        text = '```json{"key": "value"}```'
+        assert extract_json(text) == {"key": "value"}
+
+    def test_leading_prose(self):
+        text = 'Here is my evaluation of the image:\n{"key": "value"}'
+        assert extract_json(text) == {"key": "value"}
+
+    def test_trailing_commentary(self):
+        text = '{"key": "value"}\nLet me know if you need anything else.'
+        assert extract_json(text) == {"key": "value"}
+
+    def test_prose_around_fenced_json(self):
+        text = 'Sure! Here it is:\n```json\n{"key": "value"}\n```\nHope that helps.'
+        assert extract_json(text) == {"key": "value"}
+
+    def test_nested_braces_in_strings(self):
+        text = 'Result: {"summary": "use {curly} braces", "n": 1} done'
+        assert extract_json(text) == {"summary": "use {curly} braces", "n": 1}
+
+    def test_genuinely_invalid_returns_none(self):
+        assert extract_json("I could not evaluate the image, sorry.") is None
+
+
 class TestCriticParseResponse:
     """CriticAgent._parse_response should not crash on malformed input."""
 
@@ -66,3 +101,26 @@ def test_no_suggestions_means_no_revision(self, critic):
     def test_truncated_json_returns_empty_critique(self, critic):
         result = critic._parse_response('{"critic_suggestions": ["fix')
         assert result.needs_revision is False
+
+    def test_fenced_json_parsed(self, critic):
+        data = {"critic_suggestions": ["fix arrow"], "revised_description": "v2"}
+        result = critic._parse_response(f"```json\n{json.dumps(data)}\n```")
+        assert result.needs_revision is True
+        assert result.critic_suggestions == ["fix arrow"]
+        assert result.revised_description == "v2"
+
+    def test_json_with_leading_prose_parsed(self, critic):
+        data = {"critic_suggestions": ["align labels"], "revised_description": None}
+        result = critic._parse_response(f"Here is the critique:\n{json.dumps(data)}")
+        assert result.critic_suggestions == ["align labels"]
+
+    def test_json_with_trailing_commentary_parsed(self, critic):
+        data = {"critic_suggestions": [], "revised_description": None}
+        result = critic._parse_response(f"{json.dumps(data)}\nOverall the figure looks good.")
+        assert result.needs_revision is False
+
+    def test_invalid_response_returns_empty_critique_without_raising(self, critic):
+        result = critic._parse_response("The model refused to answer in JSON format.")
+        assert result.needs_revision is False
+        assert result.critic_suggestions == []
+        assert result.revised_description is None
```

**File**: `tests/test_cli.py` (modified, +163/-0)
```diff
@@ -1242,3 +1242,166 @@ def test_references_categories_json(tmp_path, monkeypatch):
     data = json.loads(result.output)
     assert data["nlp_language"] == 2
     assert data["vision_perception"] == 1
+
+
+# ── generate --continue-run output dir resolution (issue #217) ──────
+
+
+def _make_run_dir(base: Path, run_id: str = "run_20260518_190654_814b57") -> Path:
+    """Create a minimal resumable run directory under *base*."""
+    run_dir = base / run_id
+    run_dir.mkdir(parents=True)
+    (run_dir / "run_input.json").write_text(
+        json.dumps(
+            {
+                "source_context": "Method text",
+                "communicative_intent": "Overview figure",
+                "diagram_type": "methodology",
+            }
+        ),
+        encoding="utf-8",
+    )
+    (run_dir / "planning.json").write_text(
+        json.dumps({"optimized_description": "A described diagram"}),
+        encoding="utf-8",
+    )
+    return run_dir
+
+
+def _fake_continue_pipeline(tmp_path: Path, captured: dict):
+    from paperbanana.core.types import GenerationOutput
+
+    class _FakePipeline:
+        def __init__(self, settings=None, **kwargs):
+            captured["settings"] = settings
+
+        async def continue_run(
+            self,
+            resume_state,
+            additional_iterations=None,
+            user_feedback=None,
+            progress_callback=None,
+        ):
+            captured["resume_state"] = resume_state
+            captured["user_feedback"] = user_feedback
+            out_path = tmp_path / "continued.png"
+            out_path.write_bytes(b"fake")
+            return GenerationOutput(
+                image_path=str(out_path),
+                description="continued",
+                iterations=[],
+                metadata={"run_id": resume_state.run_id},
+            )
+
+    return _FakePipeline
+
+
+def test_continue_run_with_custom_output_dir(tmp_path, monkeypatch):
+    """--continue-run finds the run under --output-dir, not just settings.output_dir."""
+    custom_out = tmp_path / "custom_out"
+    run_dir = _make_run_dir(custom_out)
+    captured: dict = {}
+    monkeypatch.setattr(
+        "paperbanana.core.pipeline.PaperBananaPipeline",
+        _fake_continue_pipeline(tmp_path, captured),
+    )
+
+    result = runner.invoke(
+        app,
+        [
+            "generate",
+            "--continue-run",
+            run_dir.name,
+            "--output-dir",
+            str(custom_out),
+            "--feedback",
+            "tweak the colours",
+        ],
+        terminal_width=HELP_TERMINAL_WIDTH,
+    )
+
+    assert result.exit_code == 0, result.output
+    assert "Done!" in result.output
+    assert captured["resume_state"].run_id == run_dir.name
+    assert Path(captured["resume_state"].run_dir) == run_dir
+    assert captured["user_feedback"] == "tweak the colours"
+
+
+def test_continue_run_accepts_run_dir_path(tmp_path, monkeypatch):
+    """--continue-run accepts an absolute path to the run directory itself."""
+    run_dir = _make_run_dir(tmp_path / "elsewhere")
+    captured: dict = {}
+    monkeypatch.setattr(
+        "paperbanana.core.pipeline.PaperBananaPipeline",
+        _fake_continue_pipeline(tmp_path, captured),
+    )
+
+    result = runner.invoke(
+        app,
+        ["generate", "--continue-run", str(run_dir)],
+        terminal_width=HELP_TERMINAL_WIDTH,
+    )
+
+    assert result.exit_code == 0, result.output
+    assert captured["resume_state"].run_id == run_dir.name
+    assert Path(captured["resume_state"].run_dir) == run_dir
+
+
+def test_continue_latest_uses_custom_output_dir(tmp_path, monkeypatch):
+    """--continue (latest) resolves the run under --output-dir."""
+    custom_out = tmp_path / "custom_out"
+    run_dir = _make_run_dir(custom_out)
+    captured: dict = {}
+    monkeypatch.setattr(
+        "paperbanana.core.pipeline.PaperBananaPipeline",
+        _fake_continue_pipeline(tmp_path, captured),
+    )
+
+    result = runner.invoke(
+        app,
+        ["generate", "--continue", "--output-dir", str(custom_out)],
+        terminal_width=HELP_TERMINAL_WIDTH,
+    )
+
+    assert result.exit_code == 0, result.output
+    assert captured["resume_state"].run_id == run_dir.name
+
+
+def test_continue_run_missing_reports_searched_path(tmp_path):
+    """Missing run errors clearly with the directory that was searched."""
+    empty_out = tmp_path / "empty_out"
+    empty_out.mkdir()
+
+    result = runner.invoke(
+        app,
+        [
+            "generate",
+            "--continue-run",
+            "run_missing",
+            "--output-dir",
+            str(empty_out),
+        ],
+        terminal_width=HELP_TERMINAL_WIDTH,
+    )
+
+    flat = result.output.replace("\n", "")
+    assert result.exit_code == 1
+    assert "Run directory not found" in flat
+    assert "run_missing" in flat
+    assert str(empty_out.resolve()) in flat
+
+
+def test_continue_run_missing_path_reports_resolved_pat
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
