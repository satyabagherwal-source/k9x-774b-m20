# Forensic Learning Record (Deep Inspection): yifanfeng97/Hyper-Extract

> **Canonical Artifact**: `07_PROJECT_LEARNING/yifanfeng97-hyper-extract-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yifanfeng97/Hyper-Extract](https://github.com/yifanfeng97/Hyper-Extract))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:12:56.833Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yifanfeng97/Hyper-Extract`
- **Description**: Hypergraph is more powerful. Transform unstructured text into structured knowledge with LLMs. Graphs, hypergraphs, and spatio-temporal extractions — with one command.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4060 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `hyperextract/cli/utils.py`
```
"""Common utilities for Hyper-Extract CLI."""

import sys
from pathlib import Path

import typer
from rich.console import Console

from hyperextract.utils.readers import (
    INGESTABLE_SUFFIXES,
    TEXT_SUFFIXES,
    markitdown_available,
    read_document,
)

from .config import ConfigManager

console = Console()

_SKIPPED_FILE_PREVIEW_LIMIT = 10
_DS_STORE = ".DS_Store"

LOGO = r"""
                                                                                     
▄▄▄   ▄▄▄                                ▄▄▄▄▄▄▄                                     
███   ███                               ███▀▀▀▀▀        ██                      ██   
█████████ ██ ██ ████▄ ▄█▀█▄ ████▄       ███▄▄    ██ ██ ▀██▀▀ ████▄  ▀▀█▄ ▄████ ▀██▀▀ 
███▀▀▀███ ██▄██ ██ ██ ██▄█▀ ██ ▀▀ ▀▀▀▀▀ ███       ███   ██   ██ ▀▀ ▄█▀██ ██     ██   
███   ███  ▀██▀ ████▀ ▀█▄▄▄ ██          ▀███████ ██ ██  ██   ██    ▀█▄██ ▀████  ██   
            ██  ██                                                                   
          ▀▀▀   ▀▀                                                                   
"""


def _is_supported_text_suffix(path: Path) -> bool:
    """Return True when the CLI can read this file in the current environment.

    Plain text (``.txt``/``.md``) is always supported; document formats are
    supported when the optional markitdown backend is installed.
    """
    suffix = path.suffix.lower()
    if suffix in TEXT_SUFFIXES:
        return True
    return suffix in INGESTABLE_SUFFIXES and markitdown_available()


def require_supported_text_input(input_path: str) -> None:
    """Reject a single-file input the CLI cannot read.

    Stdin (``-``) is not suffix-checked. Directories are left to
    :func:`collect_directory_text_inputs`.
    """
    if input_path == "-":
        return
    path = Path(input_path)
    if path.is_dir():
        return
    if _is_supported_text_suffix(path):
        return
    suffix = path.suffix.lower()
    console.print(
        f"[red]Error:[/red] Unsupported input type: {path.name or input_path}"
    )
    if suffix in INGESTABLE_SUFFIXES:
        console.print(
            f"{INGESTABLE_SUFFIXES[suffix]} input is supported with the "
            "optional ingest extra: "
            'pip install "hyperextract\\[ingest]"'
        )
    else:
        console.print(
            "Supported inputs: .txt/.md always; PDF/DOCX/PPTX/XLSX/HTML and "
            'more via pip install "hyperextract\\[ingest]".'
        )
    raise typer.Exit(1)


def collect_directory_text_inputs(directory: Path) -> list[Path]:
    """Return non-recursive readable files in ``directory``.

    Raises:
        typer.Exit: If the directory contains no readable files.

    Other regular files at the same level produce a warning (up to 10 names
    plus a remaining count) and are skipped. ``.DS_Store`` is ignored.
    """
    text_files = sorted(
        (
            path
            for path in directory.glob("*")
            if path.is_file() and _is_supported_text_suffix(path)
        ),
        key=lambda path: path.name.lower(),
    )
    if not text_files:
        skipped_ingestable = [
            path
            for path in directory.iterdir()
            if path.is_file()
            and path.suffix.lower() in INGESTABLE_SUFFIXES
            and not markitdown_available()
        ]
        if skipped_ingestable:
            console.print(
                "[red]Error:[/red] No readable files found in "
                f"{directory}. Document files (e.g. "
                f"{skipped_ingestable[0].name}) need the ingest extra: "
                'pip install "hyperextract\\[ingest]"'
            )
        else:
            console.print(
                f"[red]Error:[/red] No .txt or .md files found in {directory}"
            )
        raise typer.Exit(1)

    skipped = sorted(
        (
            path
            for path in directory.iterdir()
            if path.is_file()
            and path.name != _DS_STORE
            and not _is_supported_text_suffix(path)
        ),
        key=lambda path: path.name.lower(),
    )
    if skipped:
        preview = skipped[:_SKIPPED_FILE_PREVIEW_LIMIT]
        listed = ", ".join(path.name for path in preview)
        remaining = len(skipped) - len(preview)
        extra = f" (+{remaining} more)" if remaining else ""
        hint = (
            " Install the ingest extra for documents: "
            'pip install "hyperextract\\[ingest]"'
            if any(p.suffix.lower() in INGESTABLE_SUFFIXES for p in skipped)
            and not markitdown_available()
            else ""
        )
        console.print(
            f"[yellow]Warning:[/yellow] skipped unsupported file(s): "
            f"{listed}{extra}.{hint}"
        )

    return text_files


def read_input(input_path: str) -> str:
    """Read input from file or stdin (document formats converted to text)."""
    if input_path == "-":
        return sys.stdin.read()
    path = Path(input_path)
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")
    from hyperextract.utils.readers import ReaderError

    try:
        return read_document(path)
    except ReaderError as e:
        console.print(f"[red]Error:[/red] {e}")
        raise typer.Exit(1)


def validate_ka_path(ka_path: str) -> Path:
    """Validate Knowledge Abstract path.

    Args:
        ka_path: Knowledge Abstract directory path

    Returns:
        Path object

    Raises:
        typer.Exit: If path is invalid
    """
    path = Path(ka_path)

    if not path.exists():
        console.print(f"[red]Error:[/red] Knowledge Abstract not found: {ka_path}")
        raise typer.Exit(1)

    if not path.is_dir():
        console.print(f"[red]Error:[/red] Not a directory: {ka_path}")
        raise typer.Exit(1)

    return path


def validate_ka_with_data(ka_path: str) -> Path:
    """Validate Knowledge Abstract path with data.json.

    Args:
        ka_path: Knowledge Abstract directory path

    Returns:
        Path object

    Raises:
        typer.Exit: If path is invalid or missing data.json
    """
    path = validate_ka_path(ka_path)

    data_file = path / "data.json"
    if not data_file.exists():
        console.print(
            f"[red]Error:[/red] Not a valid Knowledge Abstract: {ka_path} (no data.json)"
        )
        raise typer.Exit(1)

    return path


def validate_ka_with_index(ka_path: str) -> Path:
    """Validate Knowledge Abstract path with index.

    Args:
        ka_path: Knowledge Abstract directory path

    Returns:
        Path object

    Raises:
        typer.Exit: If path is invalid or missing index
    """
    path = validate_ka_path(ka_path)

    index_dir = path / "index"
    if not index_dir.exists() or not any(index_dir.iterdir()):
        console.print(
            f"[red]Error:[/red] Index not found. Please run 'he build-index {ka_path}' first."
        )
        raise typer.Exit(1)

    return path


def get_template_from_ka(ka_path: Path) -> tuple[str, str]:
    """Get template path for Knowledge Abstract.

    Load priority:
    1. If template is a registered method (e.g., "method/chunk_rag") -> use it
    2. If template is in presets (e.g., "general/graph") -> use preset name
    3. If template not in presets -> try to find {template}.yaml in KA directory

    Raises:
        ValueError: If template not found and no local yaml file exists
    """
    from hyperextract.utils.template_engine import Gallery

    from .config import load_ka_metadata

    metadata = load_ka_metadata(ka_path)
    if metadata is None:
        raise ValueError(f"No metadata.json found in Knowledge Abstract: {ka_path}")

    template = metadata.get("template")
    lang = metadata.get("lang")

    if template:
        if template.startswith("method/"):
            # Method templates are code-registered, not gallery YAML files.
            from hyperextract.methods.registry import get_method

            method = template[len("method/") :]
            if get_method(method) is not None:
                return template, lang
            raise ValueError(
                f"Template '{template}' names an extraction method that is not "
                f"registered ('{method}'). Run `he list` to see the available "
                "methods."
            )
        elif Gallery.get(template) is not None:
            return template, lang
        else:
            local_yaml = ka_path / f"{template}.yaml"
            if local_yaml.exists():
                return str(local_yaml), lang
            raise ValueError(
                f"Template '{template}' not found in presets and local file "
                f"'{local_yaml}' does not exist."
            )

    raise ValueError("No template specified in metadata.json")


def validate_config() -> "ConfigManager":
    """Validate configuration.

    Returns:
        ConfigManager instance

    Raises:
        typer.Exit: If configuration is invalid
    """

    config = ConfigManager()
    valid, msg = config.validate()

    if not valid:
        console.print(f"[red]Error:[/red] {msg}")
        raise typer.Exit(1)

    return config

```

### Core Architecture Module: `hyperextract/utils/__init__.py`
```
"""Hyperextract utilities module."""

from .client import get_client
from .logging import configure_logging, get_logger, set_log_level
from .obsidian import export_to_obsidian, sanitize_filename

__all__ = [
    "configure_logging",
    "export_to_obsidian",
    "get_client",
    "get_logger",
    "sanitize_filename",
    "set_log_level",
]

```

### Core Architecture Module: `hyperextract/utils/client.py`
```
"""Client Factory - Create OpenAI LLM and Embedder clients from config.

Provides three levels of API:
    - create_client(): Unified creation for both LLM and Embedder
    - create_llm() / create_embedder(): Separate creation for advanced use
    - get_client(): Read from config.toml (backward compatible)

String shorthand format: provider:model@url
    - "bailian"              → provider only, use preset defaults
    - "bailian:qwen-plus"    → provider + model, use preset URL
    - "vllm:Qwen3.5-9B@http://localhost:8000/v1" → full specification
"""

import logging
import os
from pathlib import Path
from typing import Any

from langchain_core.embeddings import Embeddings
from langchain_core.language_models.chat_models import BaseChatModel

logger = logging.getLogger(__name__)

DEFAULT_CONFIG_DIR = Path.home() / ".he"
DEFAULT_CONFIG_FILE = DEFAULT_CONFIG_DIR / "config.toml"

# Official OpenAI API base URL — only this endpoint accepts pre-tokenized input
OPENAI_API_URL = "https://api.openai.com/v1"

# Provider presets: base_url and default models for each provider
PROVIDER_PRESETS: dict[str, dict[str, str | None]] = {
    "openai": {
        "base_url": "https://api.openai.com/v1",
        "default_llm": "gpt-4o-mini",
        "default_embedder": "text-embedding-3-small",
    },
    "bailian": {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "default_llm": "qwen3.6-plus",
        "default_embedder": "text-embedding-v4",
    },
    "vllm": {
        "base_url": None,
        "default_llm": None,
        "default_embedder": None,
    },
    # DeepSeek. OpenAI-compatible endpoint. Current models are deepseek-v4-flash
    # and deepseek-v4-pro; both default to "thinking" mode, which rejects the
    # tool_choice that method="function_calling" relies on, so create_llm()
    # disables thinking for this provider by default (override via extra_body).
    # DeepSeek has no embeddings API — pair it with an OpenAI-compatible embedder.
    "deepseek": {
        "base_url": "https://api.deepseek.com",
        "default_llm": "deepseek-v4-flash",
        "default_embedder": None,
    },
    # OrcaRouter. OpenAI-compatible model routing gateway exposing 150+ models
    # from OpenAI, Anthropic, Google, DeepSeek, Qwen, MiniMax, xAI and others
    # behind a single endpoint and API key. Namespaced model ids such as
    # "orcarouter/auto" route to a matching upstream.
    "orcarouter": {
        "base_url": "https://api.orcarouter.ai/v1",
        "default_llm": "orcarouter/auto",
        "default_embedder": "openai/text-embedding-3-small",
    },
    # Anthropic (Claude). Uses the native ChatAnthropic client, so base_url is
    # left empty (the SDK targets api.anthropic.com by default). Anthropic has
    # no embeddings API, hence default_embedder is None — pair it with an
    # OpenAI-compatible embedder.
    "anthropic": {
        "base_url": "",
        "default_llm": "claude-opus-4-8",
        "default_embedder": None,
    },
    "claude": {
        "base_url": "",
        "default_llm": "claude-opus-4-8",
        "default_embedder": None,
    },
    # Google Gemini. Uses the native ChatGoogleGenerativeAI client
    # (langchain-google-genai), so base_url is empty. Gemini Developer API
    # has no mature embedder path in this repo — pair with an OpenAI-compatible
    # embedder. Default model is the current documented stable Flash id
    # (Gemini API models page, 2026-09-04): gemini-3.8-flash.
    "google": {
        "base_url": "",
        "default_llm": "gemini-3.8-flash",
        "default_embedder": None,
    },
    "gemini": {
        "base_url": "",
        "default_llm": "gemini-3.8-flash",
        "default_embedder": None,
    },
}

# Providers handled by the native langchain-anthropic client rather than the
# OpenAI-compatible path.
ANTHROPIC_PROVIDERS = ("anthropic", "claude")

# Providers handled by the native langchain-google-genai client.
GOOGLE_PROVIDERS = ("google", "gemini")

# Native (non-OpenAI-compatible) LLM providers — do not fall back to
# OPENAI_API_KEY when their own env vars are unset.
_NATIVE_LLM_PROVIDERS = ANTHROPIC_PROVIDERS + GOOGLE_PROVIDERS

# Environment variables checked (in order) for each provider's API key.
PROVIDER_API_KEY_ENV: dict[str, tuple[str, ...]] = {
    "anthropic": ("ANTHROPIC_API_KEY", "CLAUDE_API_KEY"),
    "claude": ("ANTHROPIC_API_KEY", "CLAUDE_API_KEY"),
    "google": ("GOOGLE_API_KEY", "GEMINI_API_KEY"),
    "gemini": ("GOOGLE_API_KEY", "GEMINI_API_KEY"),
    "deepseek": ("DEEPSEEK_API_KEY",),
    "orcarouter": ("ORCAROUTER_API_KEY",),
}


def _env_api_key(provider: str) -> str:
    """Return the first non-empty API key from the provider's env vars.

    Falls back to OPENAI_API_KEY for OpenAI-compatible providers.
    """
    for var in PROVIDER_API_KEY_ENV.get(provider, ()):
        value = os.environ.get(var, "")
        if value:
            return value
    if provider not in _NATIVE_LLM_PROVIDERS:
        return os.environ.get("OPENAI_API_KEY", "")
    return ""


class CompatibleEmbeddings(Embeddings):
    """Embeddings for OpenAI-compatible providers that only accept string input.

    langchain_openai's OpenAIEmbeddings with tiktoken_enabled=True sends
    pre-tokenized integer lists to the API, which OpenAI supports but most
    OpenAI-compatible providers (Ollama, LiteLLM, etc.) do not. This class
    works around that by always sending strings, using tiktoken for chunking
    with a fallback encoding when the model name isn't tiktoken-compatible.
    """

    def __init__(
        self,
        model: str = "text-embedding-ada-002",
        api_key: str | None = None,
        base_url: str | None = None,
        max_batch_size: int = 10,
        chunk_size: int | None = None,
        max_retries: int = 2,
        **kwargs: Any,
    ):
        from openai import OpenAI

        self._client = OpenAI(
            api_key=api_key or os.environ.get("OPENAI_API_KEY", ""),
            base_url=base_url,
            max_retries=max_retries,
        )
        self._model = model

        # max_batch_size caps how many inputs are sent per embeddings request.
        # Many OpenAI-compatible providers reject large batches (e.g. Bailian /
        # DashScope caps at 10), so the default is intentionally conservative.
        # `chunk_size` is the legacy name for this knob and is kept as an alias.
        self._max_batch_size = chunk_size if chunk_size is not None else max_batch_size

        # Determine the tiktoken encoding to use for chunking
        import tiktoken

        try:
            self._encoding = tiktoken.encoding_for_model(model)
        except KeyError:
            # Model not recognized by tiktoken; use cl100k_base (used by
            # text-embedding-ada-002, text-embedding-3-small, etc.)
            logger.debug(
                "Model '%s' not recognized by tiktoken, using cl100k_base encoding",
                model,
            )
            self._encoding = tiktoken.get_encoding("cl100k_base")

        # Max tokens per request (8191 is the limit for most OpenAI embedders)
        self._max_tokens = kwargs.get("embedding_ctx_length", 8191)

    def _split_texts(self, texts: list[str]) -> list[tuple[str, int]]:
        """Split texts into chunks that fit within token limits.

        Returns list of (text_chunk, original_index) tuples.
        """
        chunks: list[tuple[str, int]] = []
        for i, text in enumerate(texts):
            tokens = self._encoding.encode(text)
            if len(tokens) <= self._max_tokens:
                chunks.append((text, i))
            else:
                # Split into chunks
                for j in range(0, len(tokens), self._max_tokens):
                    chunk_tokens = tokens[j : j + self._max_tokens]
                    chunk_text = self._encoding.decode(chunk_tokens)
                    chunks.append((chunk_text, i))
        return chunks

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []

        chunks = self._split_texts(texts)
        if not chunks:
            return []

        # Group chunks into batches no larger than max_batch_size
        all_embeddings: list[list[float] | None] = [None] * len(texts)
        batch: list[tuple[str, int]] = []

        # Accumulate a running sum and count per text so multi-chunk texts get a
        # true mean. A pairwise (prev + curr) / 2 only yields the mean for two
        # chunks; for three or more it biases toward later chunks.
        sums: dict[int, list[float]] = {}
        counts: dict[int, int] = {}

        def _embed_batch(b: list[tuple[str, int]]) -> None:
            # Skip blank chunks: many OpenAI-compatible providers (e.g. Bailian /
            # DashScope) reject empty-string input with a 400. Blank texts are
            # backfilled with a zero vector after all batches complete.
            non_blank = [(text, idx) for text, idx in b if text.strip()]
            if not non_blank:
                return
            response = self._client.embeddings.create(
                input=[text for text, _ in non_blank],
                model=self._model,
            )
            for (text, orig_idx), emb_data in zip(
                non_blank, response.data, strict=False
            ):
                emb = emb_data.embedding
                if orig_idx not in sums:
                    sums[orig_idx] = list(emb)
                    counts[orig_idx] = 1
                else:
                    running = sums[orig_idx]
                    sums[orig_idx] = [a + b for a, b in zip(running, emb, strict=False)]
                    counts[orig_idx] += 1

        for chunk in chunks:
            batch.append(chunk)
            if len(batch) >= self._max_batch_size:
                _embed_batch(batch)
                batch = []

        if batch:
            _embed_batch(batch)

        # Divide each running sum by its chunk count to get the mean embedding.
```

### Core Architecture Module: `hyperextract/utils/document_store.py`
```
"""Archive source documents inside the KA directory (``documents/``).

Files are named deterministically from the ``source_id`` so they can be
located later without a metadata lookup:

    documents/<sha256(source_id)[:12]>-<original basename>

This keeps one *current* copy per source: re-feeding the same source_id
overwrites the archived file, mirroring the ledger's bounded
"current version per source" policy.
"""

import hashlib
import shutil
from pathlib import Path

DOCUMENTS_DIR = "documents"
_HASH_LEN = 12


def source_hash(source_id: str) -> str:
    """Stable short hash used as the archived filename prefix."""
    return hashlib.sha256(source_id.encode("utf-8")).hexdigest()[:_HASH_LEN]


class SourceDocumentStore:
    """Filesystem archive of raw source documents for one KA."""

    def __init__(self, ka_root: Path):
        self.root = Path(ka_root) / DOCUMENTS_DIR

    def path_for(self, source_id: str, original_name: str) -> Path:
        """Deterministic archive path for a source (original name kept for humans)."""
        safe_name = Path(original_name).name or "document.txt"
        return self.root / f"{source_hash(source_id)}-{safe_name}"

    def store_text(
        self, source_id: str, text: str, original_name: str = "document.txt"
    ) -> Path:
        """Archive text content (used for stdin feeds)."""
        self.root.mkdir(parents=True, exist_ok=True)
        # Keep one current copy per source: drop prior archives whose filename
        # differs (the original basename is part of the name), so re-feeding the
        # same source_id overwrites rather than accumulating stale copies.
        self.purge(source_id)
        path = self.path_for(source_id, original_name)
        path.write_text(text, encoding="utf-8")
        return path

    def store_file(self, source_id: str, input_path: str | Path) -> Path:
        """Archive an original file (raw bytes preserved)."""
        src = Path(input_path)
        self.root.mkdir(parents=True, exist_ok=True)
        self.purge(source_id)
        dst = self.path_for(source_id, src.name)
        shutil.copy2(src, dst)
        return dst

    def find(self, source_id: str) -> list[Path]:
        """All archived files for a source (usually one)."""
        if not self.root.exists():
            return []
        return sorted(self.root.glob(f"{source_hash(source_id)}-*"))

    def purge(self, source_id: str) -> list[Path]:
        """Delete archived files for a source. Returns the removed paths."""
        removed = []
        for path in self.find(source_id):
            path.unlink()
            removed.append(path)
        return removed

```

### Core Architecture Module: `hyperextract/utils/exporters/__init__.py`
```
"""Read-only graph exporters (GraphML, CSV, JSON-LD, Cypher).

These are pure functions over node/edge models, matching
:func:`hyperextract.utils.obsidian.export_to_obsidian`. They are not methods
on AutoType classes.

Example::

    from hyperextract.utils.exporters import export_to_graphml, export_to_csv

    export_to_graphml(
        ka.nodes,
        ka.edges,
        node_id_extractor=ka.node_key_extractor,
        incident_nodes_extractor=ka.nodes_in_edge_extractor,
        file_path="graph.graphml",
    )
"""

from .common import HYPEREDGE_MEMBER_SEP
from .csv_export import export_to_csv
from .cypher import export_to_cypher
from .graphml import GraphMLHypergraphError, export_to_graphml
from .jsonld import export_to_jsonld

__all__ = [
    "HYPEREDGE_MEMBER_SEP",
    "GraphMLHypergraphError",
    "export_to_csv",
    "export_to_cypher",
    "export_to_graphml",
    "export_to_jsonld",
]

```

### Core Architecture Module: `hyperextract/utils/exporters/common.py`
```
"""Shared helpers for GraphML and CSV exporters.

These functions operate on plain Pydantic models plus extractor callables,
matching :func:`hyperextract.utils.obsidian.export_to_obsidian`. They do not
import AutoType classes.
"""

from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from hyperextract.utils.logging import get_logger

logger = get_logger(__name__)

# Stable delimiter for hyperedge membership in ``hyperedges.csv``.
# Binary CSV never sorts endpoints; hyperedge members *are* sorted
# lexicographically so the file is deterministic.
HYPEREDGE_MEMBER_SEP = "|"

_XML_ESCAPE = (
    ("&", "&amp;"),
    ("<", "&lt;"),
    (">", "&gt;"),
    ('"', "&quot;"),
    ("'", "&apos;"),
)


def xml_escape(value: Any) -> str:
    """Escape XML special characters ``& < > " '`` in document order."""
    text = str(value)
    for src, dst in _XML_ESCAPE:
        text = text.replace(src, dst)
    return text


def scalar_fields(model: BaseModel) -> dict[str, str | int | float | bool]:
    """Return exportable fields from ``model.model_dump()``.

    ``str`` / ``int`` / ``float`` / ``bool`` are kept as-is; ``None`` is
    omitted; every other value is coerced with ``str()``.
    """
    dumped = model.model_dump()
    fields: dict[str, str | int | float | bool] = {}
    for key, value in dumped.items():
        if value is None:
            continue
        if value == [] or value == {}:
            continue
        if isinstance(value, (bool, int, float, str)):
            fields[key] = value
        else:
            fields[key] = str(value)
    return fields


def graphml_attr_type(value: str | float | bool) -> str:
    """Map a Python scalar to a GraphML ``attr.type``."""
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "long"
    if isinstance(value, float):
        return "double"
    return "string"


def graphml_attr_value(value: str | float | bool) -> str:
    """Serialize a scalar for a GraphML ``<data>`` element."""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def merge_graphml_type(existing: str | None, incoming: str) -> str:
    """Promote mixed attribute types to ``string``."""
    if existing is None or existing == incoming:
        return incoming
    return "string"


def resolve_nodes(
    nodes: Sequence[BaseModel],
    node_id_extractor: Callable[[Any], str],
) -> dict[str, BaseModel]:
    """Map node id -> model, keeping the first occurrence of each id."""
    by_id: dict[str, BaseModel] = {}
    for node in nodes:
        try:
            node_id = str(node_id_extractor(node))
        except Exception as exc:
            logger.debug("export: node_id_extractor raised %s; skipping node", exc)
            continue
        if node_id in by_id:
            logger.debug("export: duplicate node id %r; keeping first", node_id)
            continue
        by_id[node_id] = node
    return by_id


def incident_ids(
    edge: Any, incident_nodes_extractor: Callable[[Any], Sequence[str]]
) -> list[str] | None:
    """Normalize an edge's incident node keys.

    Returns ``None`` when the extractor fails (caller should skip the edge).
    """
    try:
        raw = incident_nodes_extractor(edge)
    except Exception as exc:
        logger.debug("export: incident_nodes_extractor raised %s; skipping edge", exc)
        return None
    if raw is None:
        return []
    if isinstance(raw, (str, bytes)):
        return [str(raw)]
    if isinstance(raw, (list, tuple, set)):
        return [str(item) for item in raw if item is not None]
    return [str(raw)]


def default_edge_id(
    edge: Any, index: int, extractor: Callable[[Any], str] | None
) -> str:
    """Return an edge id from ``extractor``, falling back to ``e{index}``."""
    if extractor is None:
        return f"e{index}"
    try:
        value = extractor(edge)
    except Exception as exc:
        logger.debug("export: edge_id_extractor raised %s", exc)
        return f"e{index}"
    if value in (None, ""):
        return f"e{index}"
    return str(value)


def resolve_export_file(path: str | Path, *, overwrite: bool = False) -> Path:
    """Resolve a file-export destination, optionally refusing overwrite.

    GraphML CLI ``--force`` and MCP ``overwrite`` map onto this flag.
    JSON-LD / Cypher can reuse the same helper after those PRs land.
    """
    dest = Path(path)
    if dest.exists() and dest.is_dir():
        raise IsADirectoryError(
            f"Destination '{dest}' is a directory; pass a file path."
        )
    existing_nonempty = dest.exists() and dest.is_file() and dest.stat().st_size > 0
    if existing_nonempty and not overwrite:
        raise FileExistsError(
            f"Destination '{dest}' already exists. Pass overwrite=True to overwrite it."
        )
    dest.parent.mkdir(parents=True, exist_ok=True)
    return dest

```

### Core Architecture Module: `hyperextract/utils/exporters/csv_export.py`
```
"""CSV exporters for pairwise graphs and hypergraphs.

Writes spreadsheet-friendly tables using the stdlib :mod:`csv` module
(correct quoting for commas, quotes, and newlines).

This module is named ``csv_export`` so it does not shadow the stdlib
:mod:`csv` package. Import from :mod:`hyperextract.utils.exporters`.

Pairwise graphs
    ``nodes.csv`` (``id`` + schema scalars) and ``edges.csv``
    (``source``, ``target`` + edge scalars). Endpoint order is preserved;
    endpoints are never sorted.

Hypergraphs
    ``nodes.csv`` and ``hyperedges.csv``. ``hyperedges.csv`` has an ``id``
    column plus a ``members`` column. Members are joined with
    :data:`HYPEREDGE_MEMBER_SEP` (``|``) and **sorted lexicographically** so
    the file is deterministic. This is the opposite of binary CSV, which
    must not sort endpoints.
"""

import csv
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from hyperextract.utils.logging import get_logger

from .common import (
    HYPEREDGE_MEMBER_SEP,
    default_edge_id,
    incident_ids,
    resolve_nodes,
    scalar_fields,
)

logger = get_logger(__name__)


def export_to_csv(
    nodes: Sequence[BaseModel],
    edges: Sequence[BaseModel],
    *,
    node_id_extractor: Callable[[Any], str],
    incident_nodes_extractor: Callable[[Any], Sequence[str]],
    folder_path: str | Path,
    edge_id_extractor: Callable[[Any], str] | None = None,
    hypergraph: bool = False,
    overwrite: bool = False,
) -> Path:
    """Export nodes and edges to CSV files in ``folder_path``.

    Args:
        nodes: Node/entity models to export.
        edges: Edge/hyperedge models to export.
        node_id_extractor: Maps a node to its unique key.
        incident_nodes_extractor: Maps an edge to incident node keys
            (a 2-tuple for pairwise graphs, an N-tuple for hypergraphs).
        folder_path: Destination directory.
        edge_id_extractor: Optional edge -> id (used for ``hyperedges.csv``
            and ignored for pairwise ``edges.csv``). Defaults to ``e0``,
            ``e1``, ...
        hypergraph: If True, write ``hyperedges.csv`` instead of
            ``edges.csv``. Hyperedge members are sorted; binary endpoints
            are not.
        overwrite: Allow writing into an existing, non-empty directory.

    Returns:
        The output directory :class:`~pathlib.Path`.

    Raises:
        FileExistsError: If ``folder_path`` exists, is non-empty, and
            ``overwrite`` is False.
        NotADirectoryError: If ``folder_path`` exists and is a file.
    """
    root = Path(folder_path)
    if root.exists() and root.is_file():
        raise NotADirectoryError(
            f"Destination '{root}' is a file; pass a directory for CSV export."
        )
    if root.exists() and root.is_dir() and any(root.iterdir()) and not overwrite:
        raise FileExistsError(
            f"Destination '{root}' already exists and is not empty. "
            f"Pass overwrite=True to write into it."
        )
    root.mkdir(parents=True, exist_ok=True)

    by_id = resolve_nodes(nodes, node_id_extractor)
    node_rows = _node_rows(by_id)
    _write_csv(root / "nodes.csv", ["id"], node_rows)

    if hypergraph:
        edge_rows, skipped = _hyperedge_rows(
            edges, incident_nodes_extractor, by_id, edge_id_extractor
        )
        _write_csv(root / "hyperedges.csv", ["id", "members"], edge_rows)
        edge_count = len(edge_rows)
        kind = "hypergraph"
    else:
        edge_rows, skipped = _pairwise_edge_rows(edges, incident_nodes_extractor, by_id)
        _write_csv(root / "edges.csv", ["source", "target"], edge_rows)
        edge_count = len(edge_rows)
        kind = "graph"

    logger.info(
        "csv: exported kind=%s nodes=%d edges=%d skipped_edges=%d path=%s",
        kind,
        len(node_rows),
        edge_count,
        skipped,
        root,
    )
    return root


def _node_rows(by_id: dict[str, BaseModel]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for node_id, node in by_id.items():
        row: dict[str, Any] = {"id": node_id}
        for key, value in scalar_fields(node).items():
            if key == "id":
                continue
            row[key] = value
        rows.append(row)
    return rows


def _pairwise_edge_rows(
    edges: Sequence[BaseModel],
    incident_nodes_extractor: Callable[[Any], Sequence[str]],
    by_id: dict[str, BaseModel],
) -> tuple[list[dict[str, Any]], int]:
    rows: list[dict[str, Any]] = []
    skipped = 0
    for edge in edges:
        members = incident_ids(edge, incident_nodes_extractor)
        if members is None or len(members) != 2:
            skipped += 1
            if members is not None and len(members) > 2:
                logger.warning(
                    "export.csv: skipping non-pairwise edge members=%s "
                    "(pass hypergraph=True for N-ary edges)",
                    members,
                )
            continue
        source, target = members[0], members[1]
        if source not in by_id or target not in by_id:
            skipped += 1
            logger.warning(
                "export.csv: skipping edge with missing endpoint source=%s target=%s",
                source,
                target,
            )
            continue
        row: dict[str, Any] = {"source": source, "target": target}
        for key, value in scalar_fields(edge).items():
            if key in {"source", "target"}:
                continue
            row[key] = value
        rows.append(row)
    return rows, skipped


def _hyperedge_rows(
    edges: Sequence[BaseModel],
    incident_nodes_extractor: Callable[[Any], Sequence[str]],
    by_id: dict[str, BaseModel],
    edge_id_extractor: Callable[[Any], str] | None,
) -> tuple[list[dict[str, Any]], int]:
    rows: list[dict[str, Any]] = []
    skipped = 0
    for index, edge in enumerate(edges):
        members = incident_ids(edge, incident_nodes_extractor)
        if members is None:
            skipped += 1
            continue
        known = [mid for mid in members if mid in by_id]
        missing = [mid for mid in members if mid not in by_id]
        if missing:
            skipped += 1
            logger.warning(
                "export.csv: skipping hyperedge with missing members %s",
                missing,
            )
            continue
        if not known:
            skipped += 1
            continue
        edge_id = default_edge_id(edge, index, edge_id_extractor)
        # Sorted for stable output; binary CSV must not sort endpoints.
        members_cell = HYPEREDGE_MEMBER_SEP.join(sorted(known))
        row: dict[str, Any] = {"id": edge_id, "members": members_cell}
        dumped = edge.model_dump()
        for key, value in scalar_fields(edge).items():
            if key in {"id", "members"}:
                continue
            # Membership lists are represented by the members column.
            if isinstance(dumped.get(key), (list, tuple, set, dict)):
                continue
            row[key] = value
        rows.append(row)
    return rows, skipped


def _write_csv(path: Path, primary: Sequence[str], rows: list[dict[str, Any]]) -> None:
    fieldnames = _fieldnames(primary, rows)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=fieldnames,
            quoting=csv.QUOTE_MINIMAL,
            extrasaction="ignore",
        )
        writer.writeheader()
        for row in rows:
            writer.writerow({key: row.get(key, "") for key in fieldnames})


def _fieldnames(primary: Sequence[str], rows: list[dict[str, Any]]) -> list[str]:
    names = list(primary)
    seen = set(primary)
    for row in rows:
        for key in row:
            if key not in seen:
                names.append(key)
                seen.add(key)
    return names

```

### Core Architecture Module: `hyperextract/utils/exporters/cypher.py`
```
"""Cypher exporter for Neo4j-compatible MERGE scripts.

Pairwise edges become relationships. N-ary edges become ``(:Hyperedge)``
nodes with ``-[:IN]->`` membership — never exploded into a pairwise clique.
Endpoint order is preserved. Stdlib only; no neo4j driver.
"""

import re
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from hyperextract.utils.logging import get_logger

from .common import incident_ids, resolve_nodes, scalar_fields

logger = get_logger(__name__)

_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
# Unquoted relationship types that would parse as Cypher keywords.
_RESERVED = frozenset(
    {
        "AND",
        "AS",
        "CONTAINS",
        "CREATE",
        "DELETE",
        "DETACH",
        "FALSE",
        "IN",
        "IS",
        "MATCH",
        "MERGE",
        "NOT",
        "NULL",
        "OR",
        "REMOVE",
        "RETURN",
        "SET",
        "TRUE",
        "WHERE",
        "WITH",
        "XOR",
    }
)


def export_to_cypher(
    nodes: Sequence[BaseModel],
    edges: Sequence[BaseModel],
    *,
    node_id_extractor: Callable[[Any], str],
    incident_nodes_extractor: Callable[[Any], Sequence[str]],
    file_path: str | Path,
    edge_id_extractor: Callable[[Any], str] | None = None,
) -> Path:
    """Export a graph to a Cypher MERGE script.

    Args:
        nodes: Node/entity models to export.
        edges: Edge models to export (pairwise or N-ary).
        node_id_extractor: Maps a node to its unique key (matches edge endpoints).
        incident_nodes_extractor: Maps an edge to incident node keys in order.
            Two endpoints become a relationship; three or more become a
            ``Hyperedge`` node plus ``IN`` membership.
        file_path: Destination ``.cypher`` file.
        edge_id_extractor: Optional edge -> Cypher id. Defaults to
            ``e0``, ``e1``, ...

    Returns:
        The written file :class:`~pathlib.Path`.

    Raises:
        IsADirectoryError: If ``file_path`` exists and is a directory.
    """
    dest = Path(file_path)
    if dest.exists() and dest.is_dir():
        raise IsADirectoryError(
            f"Destination '{dest}' is a directory; pass a Cypher file path."
        )
    dest.parent.mkdir(parents=True, exist_ok=True)

    by_id = resolve_nodes(nodes, node_id_extractor)
    # One ``;``-terminated statement per node / edge: cypher-shell splits on
    # ``;`` and Cypher refuses to re-declare a variable within one statement.
    statements: list[str] = []
    for node_id, node in by_id.items():
        clauses = [f"MERGE (n:Node {{id: {_cypher_str(node_id)}}})"]
        assignments = _set_assignments("n", scalar_fields(node))
        if assignments:
            clauses.append(f"SET {assignments}")
        statements.append(_statement(clauses))

    skipped = 0
    pairwise = 0
    hyper = 0
    for index, edge in enumerate(edges):
        members = incident_ids(edge, incident_nodes_extractor)
        if members is None:
            skipped += 1
            continue
        if len(members) <= 1:
            skipped += 1
            logger.warning(
                "export.cypher: skipping edge with %d endpoint(s) members=%s",
                len(members),
                members,
            )
            continue
        missing = [member for member in members if member not in by_id]
        if missing:
            skipped += 1
            logger.warning(
                "export.cypher: skipping edge with missing endpoint(s) %s",
                missing,
            )
            continue
        edge_id = _edge_id(edge, index, edge_id_extractor)
        fields = scalar_fields(edge)
        if len(members) == 2:
            rel_type = _relationship_type(fields)
            source, target = members[0], members[1]
            clauses = [
                f"MERGE (a:Node {{id: {_cypher_str(source)}}})",
                f"MERGE (b:Node {{id: {_cypher_str(target)}}})",
                f"MERGE (a)-[r:{rel_type} {{id: {_cypher_str(edge_id)}}}]->(b)",
            ]
            assignments = _set_assignments("r", fields)
            if assignments:
                clauses.append(f"SET {assignments}")
            statements.append(_statement(clauses))
            pairwise += 1
            continue
        clauses = [f"MERGE (h:Hyperedge {{id: {_cypher_str(edge_id)}}})"]
        assignments = _set_assignments("h", fields)
        if assignments:
            clauses.append(f"SET {assignments}")
        for position, member in enumerate(members):
            clauses.append(f"MERGE (n{position}:Node {{id: {_cypher_str(member)}}})")
            clauses.append(f"MERGE (n{position})-[:IN]->(h)")
        statements.append(_statement(clauses))
        hyper += 1

    dest.write_text(
        "\n".join(statements) + ("\n" if statements else ""), encoding="utf-8"
    )
    logger.info(
        "cypher: exported nodes=%d edges=%d hyperedges=%d skipped_edges=%d path=%s",
        len(by_id),
        pairwise,
        hyper,
        skipped,
        dest,
    )
    return dest


def _statement(clauses: list[str]) -> str:
    return "\n".join(clauses) + ";"


def _cypher_str(value: Any) -> str:
    text = str(value).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{text}"'


def _cypher_literal(value: str | float | bool) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return _cypher_str(value)


def _set_assignments(alias: str, fields: dict[str, str | int | float | bool]) -> str:
    parts = []
    for key, value in fields.items():
        if key == "id":
            continue
        parts.append(f"{alias}.{key} = {_cypher_literal(value)}")
    return ", ".join(parts)


def _relationship_type(fields: dict[str, str | int | float | bool]) -> str:
    for key in ("type", "label"):
        raw = fields.get(key)
        if isinstance(raw, str) and _is_legal_ident(raw):
            return raw
    return "REL"


def _is_legal_ident(name: str) -> bool:
    return bool(_IDENT.match(name)) and name.upper() not in _RESERVED


def _edge_id(edge: Any, index: int, extractor: Callable[[Any], str] | None) -> str:
    if extractor is None:
        return f"e{index}"
    try:
        value = extractor(edge)
    except Exception as exc:
        logger.debug("export.cypher: edge_id_extractor raised %s", exc)
        return f"e{index}"
    if value in (None, ""):
        return f"e{index}"
    return str(value)

```

### Core Architecture Module: `hyperextract/utils/exporters/graphml.py`
```
"""GraphML exporter for pairwise graphs and GraphML 1.0 hyperedges.

Produces a GraphML 1.0 document that Gephi, yEd, and other desktop tools
can open. Binary edges are written as ``<edge source target>``. Edges with
three or more endpoints are written as ``<hyperedge>`` with
``<endpoint node="..."/>`` children, in ``incident_nodes_extractor`` order.

Endpoint order is preserved: for pairwise edges, ``source`` is the first
incident node and ``target`` is the second. Endpoints are never sorted.
"""

from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from hyperextract.utils.logging import get_logger

from .common import (
    default_edge_id,
    graphml_attr_type,
    graphml_attr_value,
    incident_ids,
    merge_graphml_type,
    resolve_nodes,
    scalar_fields,
    xml_escape,
)

logger = get_logger(__name__)

GRAPHML_NS = "http://graphml.graphdrawing.org/xmlns"

_ScalarFields = dict[str, str | int | float | bool]
_PairwiseRow = tuple[str, str, str, _ScalarFields]
_HyperedgeRow = tuple[str, list[str], _ScalarFields]


class GraphMLHypergraphError(ValueError):
    """Raised when GraphML export cannot encode an edge.

    N-ary edges are encoded as GraphML 1.0 ``<hyperedge>`` elements; this
    exception is kept for callers that still catch it.
    """


def export_to_graphml(
    nodes: Sequence[BaseModel],
    edges: Sequence[BaseModel],
    *,
    node_id_extractor: Callable[[Any], str],
    incident_nodes_extractor: Callable[[Any], Sequence[str]],
    file_path: str | Path,
    edge_id_extractor: Callable[[Any], str] | None = None,
) -> Path:
    """Export a graph to a GraphML file.

    Args:
        nodes: Node/entity models to export.
        edges: Edge models to export (pairwise or N-ary).
        node_id_extractor: Maps a node to its unique key (matches edge endpoints).
        incident_nodes_extractor: Maps an edge to incident node keys in order.
            Two endpoints become ``<edge source target>``; three or more
            become ``<hyperedge>`` with ``<endpoint>`` children.
        file_path: Destination ``.graphml`` file.
        edge_id_extractor: Optional edge -> GraphML id. Defaults to
            ``e0``, ``e1``, ...

    Returns:
        The written file :class:`~pathlib.Path`.

    Raises:
        IsADirectoryError: If ``file_path`` exists and is a directory.
    """
    dest = Path(file_path)
    if dest.exists() and dest.is_dir():
        raise IsADirectoryError(
            f"Destination '{dest}' is a directory; pass a GraphML file path."
        )
    dest.parent.mkdir(parents=True, exist_ok=True)

    by_id = resolve_nodes(nodes, node_id_extractor)

    node_keys: dict[str, str] = {}
    node_rows: list[tuple[str, _ScalarFields]] = []
    for node_id, node in by_id.items():
        fields = scalar_fields(node)
        for name, value in fields.items():
            node_keys[name] = merge_graphml_type(
                node_keys.get(name), graphml_attr_type(value)
            )
        node_rows.append((node_id, fields))

    pairwise: list[_PairwiseRow] = []
    hyperedges: list[_HyperedgeRow] = []
    edge_keys: dict[str, str] = {}
    hyperedge_keys: dict[str, str] = {}
    skipped = 0
    for index, edge in enumerate(edges):
        members = incident_ids(edge, incident_nodes_extractor)
        if members is None:
            skipped += 1
            continue
        if len(members) == 2:
            source, target = members[0], members[1]
            if source not in by_id or target not in by_id:
                skipped += 1
                logger.warning(
                    "export.graphml: skipping edge with missing endpoint "
                    "source=%s target=%s",
                    source,
                    target,
                )
                continue
            edge_id = default_edge_id(edge, index, edge_id_extractor)
            fields = scalar_fields(edge)
            for name, value in fields.items():
                edge_keys[name] = merge_graphml_type(
                    edge_keys.get(name), graphml_attr_type(value)
                )
            pairwise.append((edge_id, source, target, fields))
            continue
        if len(members) >= 3:
            missing = [member for member in members if member not in by_id]
            if missing:
                skipped += 1
                logger.warning(
                    "export.graphml: skipping hyperedge with missing endpoint(s) %s",
                    missing,
                )
                continue
            edge_id = default_edge_id(edge, index, edge_id_extractor)
            fields = scalar_fields(edge)
            for name, value in fields.items():
                hyperedge_keys[name] = merge_graphml_type(
                    hyperedge_keys.get(name), graphml_attr_type(value)
                )
            hyperedges.append((edge_id, members, fields))
            continue
        skipped += 1
        logger.warning(
            "export.graphml: skipping non-pairwise edge members=%s",
            members,
        )

    xml = _render_graphml(
        node_keys, edge_keys, hyperedge_keys, node_rows, pairwise, hyperedges
    )
    dest.write_text(xml, encoding="utf-8")

    logger.info(
        "graphml: exported nodes=%d edges=%d hyperedges=%d skipped_edges=%d path=%s",
        len(node_rows),
        len(pairwise),
        len(hyperedges),
        skipped,
        dest,
    )
    return dest


def _key_id(prefix: str, name: str) -> str:
    safe = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in name)
    if not safe or safe[0].isdigit():
        safe = f"_{safe}"
    return f"{prefix}_{safe}"


def _render_graphml(
    node_keys: dict[str, str],
    edge_keys: dict[str, str],
    hyperedge_keys: dict[str, str],
    node_rows: list[tuple[str, _ScalarFields]],
    edges: list[_PairwiseRow],
    hyperedges: list[_HyperedgeRow],
) -> str:
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<graphml xmlns="{GRAPHML_NS}">',
    ]
    node_key_ids: dict[str, str] = {}
    for name, attr_type in node_keys.items():
        kid = _key_id("n", name)
        node_key_ids[name] = kid
        lines.append(
            f'  <key id="{xml_escape(kid)}" for="node" '
            f'attr.name="{xml_escape(name)}" attr.type="{attr_type}"/>'
        )
    edge_key_ids: dict[str, str] = {}
    for name, attr_type in edge_keys.items():
        kid = _key_id("e", name)
        edge_key_ids[name] = kid
        lines.append(
            f'  <key id="{xml_escape(kid)}" for="edge" '
            f'attr.name="{xml_escape(name)}" attr.type="{attr_type}"/>'
        )
    hyperedge_key_ids: dict[str, str] = {}
    for name, attr_type in hyperedge_keys.items():
        kid = _key_id("h", name)
        hyperedge_key_ids[name] = kid
        lines.append(
            f'  <key id="{xml_escape(kid)}" for="hyperedge" '
            f'attr.name="{xml_escape(name)}" attr.type="{attr_type}"/>'
        )

    lines.append('  <graph id="G" edgedefault="directed">')
    for node_id, fields in node_rows:
        if fields:
            lines.append(f'    <node id="{xml_escape(node_id)}">')
            for name, value in fields.items():
                kid = node_key_ids[name]
                lines.append(
                    f'      <data key="{xml_escape(kid)}">'
                    f"{xml_escape(graphml_attr_value(value))}</data>"
                )
            lines.append("    </node>")
        else:
            lines.append(f'    <node id="{xml_escape(node_id)}"/>')

    for edge_id, source, target, fields in edges:
        attrs = (
            f'id="{xml_escape(edge_id)}" '
            f'source="{xml_escape(source)}" '
            f'target="{xml_escape(target)}"'
        )
        if fields:
            lines.append(f"    <edge {attrs}>")
            for name, value in fields.items():
                kid = edge_key_ids[name]
                lines.append(
                    f'      <data key="{xml_escape(kid)}">'
                    f"{xml_escape(graphml_attr_value(value))}</data>"
                )
            lines.append("    </edge>")
        else:
            lines.append(f"    <edge {attrs}/>")

    for edge_id, members, fields in hyperedges:
        lines.append(f'    <hyperedge id="{xml_escape(edge_id)}">')
        for member in members:
            lines.append(f'      <endpoint node="{xml_escape(member)}"/>')
        for name, value in fields.items():
            kid = hyperedge_key_ids[name]
            lines.append(
                f'      <data key="{xml_escape(kid)}">'
                f"{xml_escape(graphml_attr_value(value))}</data>"
            )
        lines.append("    </hyperedge>")

    lines.append("  </graph>")
    lines.append("</graphml>")
    lines.append("")
    return "\n".join(lines)

```

### Core Architecture Module: `hyperextract/utils/exporters/jsonld.py`
```
"""JSON-LD exporter for pairwise edges and GraphML-style hyperedges.

Produces a JSON-LD 1.1 document (stdlib ``json``, no RDFLib). Binary edges
are ``@type: Edge`` with ``source`` / ``target``. Edges with three or more
endpoints are ``@type: Hyperedge`` with an ``endpoint`` list in
``incident_nodes_extractor`` order. Endpoints are never sorted.
"""

import json
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from hyperextract.utils.logging import get_logger

from .common import incident_ids, resolve_nodes, scalar_fields

logger = get_logger(__name__)

# Inline context: only the keys the CLI / interop contract documents.
JSONLD_CONTEXT: dict[str, Any] = {
    "Node": "Node",
    "Edge": "Edge",
    "Hyperedge": "Hyperedge",
    "source": {"@type": "@id"},
    "target": {"@type": "@id"},
    "endpoint": {"@container": "@list"},
}

_RESERVED_KEYS = frozenset({"@id", "@type", "source", "target", "endpoint"})


def export_to_jsonld(
    nodes: Sequence[BaseModel],
    edges: Sequence[BaseModel],
    *,
    node_id_extractor: Callable[[Any], str],
    incident_nodes_extractor: Callable[[Any], Sequence[str]],
    file_path: str | Path,
    edge_id_extractor: Callable[[Any], str] | None = None,
) -> Path:
    """Export a graph to a JSON-LD file.

    Args:
        nodes: Node/entity models to export.
        edges: Edge models to export (pairwise or N-ary).
        node_id_extractor: Maps a node to its unique key (matches edge endpoints).
        incident_nodes_extractor: Maps an edge to incident node keys in order.
            Two endpoints become ``Edge``; three or more become ``Hyperedge``.
        file_path: Destination ``.jsonld`` file.
        edge_id_extractor: Optional edge -> ``@id``. Defaults to ``e0``, ``e1``, ...

    Returns:
        The written file :class:`~pathlib.Path`.

    Raises:
        IsADirectoryError: If ``file_path`` exists and is a directory.
    """
    dest = Path(file_path)
    if dest.exists() and dest.is_dir():
        raise IsADirectoryError(
            f"Destination '{dest}' is a directory; pass a JSON-LD file path."
        )
    dest.parent.mkdir(parents=True, exist_ok=True)

    by_id = resolve_nodes(nodes, node_id_extractor)
    graph: list[dict[str, Any]] = []
    for node_id, node in by_id.items():
        item: dict[str, Any] = {"@id": node_id, "@type": "Node"}
        item.update(_public_fields(node))
        graph.append(item)

    skipped = 0
    for index, edge in enumerate(edges):
        members = incident_ids(edge, incident_nodes_extractor)
        if members is None:
            skipped += 1
            continue
        if len(members) <= 1:
            skipped += 1
            logger.warning(
                "export.jsonld: skipping edge with %d endpoint(s) members=%s",
                len(members),
                members,
            )
            continue
        missing = [member for member in members if member not in by_id]
        if missing:
            skipped += 1
            logger.warning(
                "export.jsonld: skipping edge with missing endpoint(s) %s",
                missing,
            )
            continue
        edge_id = _edge_id(edge, index, edge_id_extractor)
        fields = _public_fields(edge)
        if len(members) == 2:
            item = {
                "@id": edge_id,
                "@type": "Edge",
                "source": members[0],
                "target": members[1],
            }
            item.update(fields)
            graph.append(item)
            continue
        item = {
            "@id": edge_id,
            "@type": "Hyperedge",
            "endpoint": list(members),
        }
        item.update(fields)
        graph.append(item)

    document = {"@context": JSONLD_CONTEXT, "@graph": graph}
    dest.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    edge_count = sum(1 for item in graph if item.get("@type") == "Edge")
    hyper_count = sum(1 for item in graph if item.get("@type") == "Hyperedge")
    logger.info(
        "jsonld: exported nodes=%d edges=%d hyperedges=%d skipped_edges=%d path=%s",
        len(by_id),
        edge_count,
        hyper_count,
        skipped,
        dest,
    )
    return dest


def _public_fields(model: BaseModel) -> dict[str, str | int | float | bool]:
    return {
        key: value
        for key, value in scalar_fields(model).items()
        if key not in _RESERVED_KEYS
    }


def _edge_id(edge: Any, index: int, extractor: Callable[[Any], str] | None) -> str:
    if extractor is None:
        return f"e{index}"
    try:
        value = extractor(edge)
    except Exception as exc:
        logger.debug("export.jsonld: edge_id_extractor raised %s", exc)
        return f"e{index}"
    if value in (None, ""):
        return f"e{index}"
    return str(value)

```

### Core Architecture Module: `hyperextract/utils/exporters/ka.py`
```
"""KA-level adapters for GraphML, CSV, JSON-LD, and Cypher export.

CLI ``he export graphml/csv/jsonld/cypher`` and MCP ``export_graphml`` /
``export_csv`` / ``export_jsonld`` / ``export_cypher`` call these functions
so extractor
wiring and the graph-type check live in one place. Encoders stay pure
functions over node/edge models.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .common import resolve_export_file
from .csv_export import export_to_csv
from .cypher import export_to_cypher
from .graphml import export_to_graphml
from .jsonld import export_to_jsonld

GRAPH_TYPE_ERROR = (
    "Graph export (GraphML/CSV/JSON-LD/Cypher) is only supported for graph-type "
    "knowledge abstracts (graph, hypergraph, temporal/spatial graphs)."
)


class GraphTypeError(ValueError):
    """Raised when a non-graph KA is passed to a graph exporter."""


def is_hypergraph_ka(ka: Any) -> bool:
    """True for AutoHypergraph; temporal/spatial graphs are pairwise."""
    if type(ka).__name__ == "AutoHypergraph":
        return True
    meta = getattr(ka, "metadata", None)
    return isinstance(meta, dict) and meta.get("type") == "hypergraph"


def require_graph_ka(ka: Any) -> None:
    if hasattr(ka, "export_obsidian"):
        return
    raise GraphTypeError(GRAPH_TYPE_ERROR)


def export_ka_graphml(ka: Any, dest: str | Path, *, overwrite: bool = False) -> Path:
    """Export a loaded graph-family KA to GraphML."""
    require_graph_ka(ka)
    dest = resolve_export_file(dest, overwrite=overwrite)
    return export_to_graphml(
        ka.nodes,
        ka.edges,
        node_id_extractor=ka.node_key_extractor,
        incident_nodes_extractor=ka.nodes_in_edge_extractor,
        file_path=dest,
        edge_id_extractor=getattr(ka, "edge_key_extractor", None),
    )


def export_ka_csv(ka: Any, dest: str | Path, *, overwrite: bool = False) -> Path:
    """Export a loaded graph-family KA to CSV tables."""
    require_graph_ka(ka)
    return export_to_csv(
        ka.nodes,
        ka.edges,
        node_id_extractor=ka.node_key_extractor,
        incident_nodes_extractor=ka.nodes_in_edge_extractor,
        folder_path=dest,
        edge_id_extractor=getattr(ka, "edge_key_extractor", None),
        hypergraph=is_hypergraph_ka(ka),
        overwrite=overwrite,
    )


def export_ka_cypher(ka: Any, dest: str | Path, *, overwrite: bool = False) -> Path:
    """Export a loaded graph-family KA to a Cypher MERGE script."""
    require_graph_ka(ka)
    dest = resolve_export_file(dest, overwrite=overwrite)
    return export_to_cypher(
        ka.nodes,
        ka.edges,
        node_id_extractor=ka.node_key_extractor,
        incident_nodes_extractor=ka.nodes_in_edge_extractor,
        file_path=dest,
        edge_id_extractor=getattr(ka, "edge_key_extractor", None),
    )


def export_ka_jsonld(ka: Any, dest: str | Path, *, overwrite: bool = False) -> Path:
    """Export a loaded graph-family KA to JSON-LD."""
    require_graph_ka(ka)
    dest = resolve_export_file(dest, overwrite=overwrite)
    return export_to_jsonld(
        ka.nodes,
        ka.edges,
        node_id_extractor=ka.node_key_extractor,
        incident_nodes_extractor=ka.nodes_in_edge_extractor,
        file_path=dest,
        edge_id_extractor=getattr(ka, "edge_key_extractor", None),
    )

```

### Core Architecture Module: `hyperextract/utils/json_index.py`
```
"""JSON-backed FAISS index persistence (no pickle deserialization).

Legacy ``FAISS.save_local`` writes ``index.faiss`` + ``index.pkl``; loading
the pickle executes code inside it, so a KA directory is only as safe as
its source. This module stores the raw vectors and documents as plain JSON
and rebuilds the flat index in memory on load — same search behavior, zero
code execution.

Layout (``index.json``)::

    {
      "version": 1,
      "metric": 1,              # faiss metric_type of the saved index
      "dimension": 768,
      "vectors": [[...], ...],  # one vector per item, index order
      "texts": [...],           # page_content per item
      "metadatas": [...],       # metadata per item
      "ids": [...]              # docstore ids per item
    }

Only flat indexes (as built by ``FAISS.from_documents`` with default
settings) are supported — that is what AutoModel/AutoList build.
"""

import json
from pathlib import Path
from typing import Any

import numpy as np
from langchain_community.vectorstores import FAISS

from hyperextract.utils.logging import get_logger

logger = get_logger(__name__)

INDEX_JSON_NAME = "index.json"
LEGACY_INDEX_NAME = "index.faiss"
LEGACY_PICKLE_NAME = "index.pkl"


def has_json_index(folder: str | Path) -> bool:
    """True when the folder contains a JSON index."""
    return (Path(folder) / INDEX_JSON_NAME).is_file()


def has_legacy_index(folder: str | Path) -> bool:
    """True when the folder contains a legacy pickle-based FAISS index."""
    folder = Path(folder)
    return (folder / LEGACY_INDEX_NAME).is_file() and (
        folder / LEGACY_PICKLE_NAME
    ).is_file()


def dump_index_json(index: FAISS, folder: str | Path) -> Path:
    """Persist a FAISS vector index as JSON (vectors + documents, no pickle).

    Returns the written ``index.json`` path. Legacy ``index.faiss`` /
    ``index.pkl`` files in the folder are removed after a successful write
    so a stale pickle index can never shadow the JSON one.
    """
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)

    ntotal = int(index.index.ntotal)
    vectors = (
        index.index.reconstruct_n(0, ntotal)
        if ntotal
        else np.zeros((0, int(index.index.d)), dtype="float32")
    )

    items = []
    for i in range(ntotal):
        doc_id = index.index_to_docstore_id[i]
        doc = index.docstore.search(doc_id)
        items.append(
            {
                "id": doc_id,
                "text": doc.page_content,
                "metadata": doc.metadata,
            }
        )

    payload = {
        "version": 1,
        "metric": int(index.index.metric_type),
        "dimension": int(index.index.d),
        "vectors": np.asarray(vectors, dtype="float32").tolist(),
        "texts": [item["text"] for item in items],
        "metadatas": [item["metadata"] for item in items],
        "ids": [item["id"] for item in items],
    }
    path = folder / INDEX_JSON_NAME
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    logger.info("json_index_dumped", path=str(path), items=ntotal)

    for legacy in (LEGACY_INDEX_NAME, LEGACY_PICKLE_NAME):
        stale = folder / legacy
        if stale.exists():
            stale.unlink()
            logger.info("legacy_index_removed", path=str(stale))
    return path


def load_index_json(folder: str | Path, embedder: Any) -> FAISS | None:
    """Load a JSON index and rebuild the FAISS flat index in memory.

    Returns ``None`` when the folder has no ``index.json``. Vectors are
    restored exactly as saved — no re-embedding happens.
    """
    path = Path(folder) / INDEX_JSON_NAME
    if not path.is_file():
        return None

    payload = json.loads(path.read_text(encoding="utf-8"))
    vectors = payload.get("vectors", [])
    texts = payload.get("texts", [])
    metadatas = payload.get("metadatas", [])
    ids = payload.get("ids", [])
    if not (len(vectors) == len(texts) == len(metadatas) == len(ids)):
        raise ValueError(f"Corrupt index.json: field lengths differ in {path}")
    if not vectors:
        raise ValueError(f"Corrupt index.json: no entries in {path}")

    metric = int(payload.get("metric", 0))
    if metric:  # only flat L2 indexes are written today
        saved = metric
        restored = 1  # faiss.METRIC_L2
        if saved != restored:
            logger.warning("json_index_metric_mismatch saved=%s rebuilt=L2", saved)

    index = FAISS.from_embeddings(
        list(zip(texts, vectors)), embedder, metadatas=metadatas, ids=ids
    )
    logger.info("json_index_loaded", path=str(path), items=len(ids))
    return index

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #17** (2026-04-11): **CLI metadata loader typo causes ImportError in show/search/talk/build-index**
  *Symptoms*: I hit this while testing the CLI on an unmodified upstream checkout.  get_template_from_ka() in hyperextract/cli/utils.py imports load_kb_metadata, but hyperextract/cli/config.py only defines load_ka_metadata.  So when that helper is invoked it fails with:  ImportError: cannot import name 'load_kb_metadata' from 'hyperextract.cli.config'  This affects normal KA workflows that use get_template_from_ka(), including:  he show he search he talk he build-index  The fix looks like changing the import/call from load_kb_metadata to load_ka_metadata.  I observed this against commit: e749c3018236e1c9f431cc628602af1271eb17fe
  **Post-Mortem & Fix Analysis**:
  > Hi there,  Thank you so much for reporting this issue in such detail! 🙏  You are absolutely right — this was an oversight during refactoring where the function name wasn't updated consistently. `load_kb_metadata` should indeed be `load_ka_metadata`. I apologize for the confusion this has caused.  I'll **fix this immediately** by correcting the import and function call in `hyperextract/cli/utils.py`.  I'll update this issue once the fix is committed. Thanks again for catching this and for the clear bug report!
  > Hi there,  Thanks for reporting this issue!   This has been fixed in commit [61440b8](https://github.com/yifanfeng97/Hyper-Extract/commit/61440b8bfa68bd96faca49ad47ff9d2735c371a0) by correcting the import from `load_kb_metadata` to `load_ka_metadata` in `hyperextract/cli/utils.py`.  The fix is now available in **[v0.1.2](https://github.com/yifanfeng97/Hyper-Extract/releases/tag/v0.1.2)**.  Please upgrade to the latest version: ```bash uv pip install --upgrade hyperextract ``` 

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

### Incident Patch 1: `c9b8c056` (2026-09-28)
**Commit Message**: Merge pull request #183 from dex0shubham/fix/list-template-filters-methods

fix: apply --query and --autotype to method rows in he list template

**File**: `hyperextract/cli/commands/list.py` (modified, +13/-2)
```diff
@@ -72,8 +72,19 @@ def template(
     if include_methods:
         from hyperextract.methods import list_method_cfgs
 
-        method_templates = list_method_cfgs()
-        for name, cfg in method_templates.items():
+        # --query/--autotype apply to method rows too, with the same matching
+        # rules Gallery.list uses for presets.
+        query_lower = query.lower() if query else None
+        for name, cfg in list_method_cfgs().items():
+            description = cfg.description or ""
+            if autotype and cfg.type != autotype:
+                continue
+            if (
+                query_lower
+                and query_lower not in name.lower()
+                and query_lower not in description.lower()
+            ):
+                continue
             templates.append((name, cfg.type, cfg.description))
 
     if not templates:
```

**File**: `tests/cli/test_list_template.py` (modified, +21/-0)
```diff
@@ -19,3 +19,24 @@ def test_list_template_lang_zh_no_methods_hides_methods():
     assert result.exit_code == 0, result.output
     assert "method/" not in result.output
     assert "chunk_rag" not in result.output
+
+
+def test_query_filters_method_rows():
+    """--query must narrow method rows, not just presets."""
+    result = runner.invoke(app, ["list", "template", "--query", "biography"])
+    assert result.exit_code == 0, result.output
+    assert "biography" in result.output
+    assert "method/" not in result.output
+
+
+def test_autotype_filters_method_rows():
+    """--autotype must exclude methods of other types."""
+    result = runner.invoke(app, ["list", "template", "--autotype", "list"])
+    assert result.exit_code == 0, result.output
+    assert "graph_rag" not in result.output
+
+
+def test_query_keeps_matching_method_rows():
+    result = runner.invoke(app, ["list", "template", "--query", "chunk_rag"])
+    assert result.exit_code == 0, result.output
+    assert "chunk_rag" in result.output
```

---

### Incident Patch 2: `c5d700ac` (2026-09-27)
**Commit Message**: fix: apply --query and --autotype to method rows in he list template

**File**: `hyperextract/cli/commands/list.py` (modified, +13/-2)
```diff
@@ -72,8 +72,19 @@ def template(
     if include_methods:
         from hyperextract.methods import list_method_cfgs
 
-        method_templates = list_method_cfgs()
-        for name, cfg in method_templates.items():
+        # --query/--autotype apply to method rows too, with the same matching
+        # rules Gallery.list uses for presets.
+        query_lower = query.lower() if query else None
+        for name, cfg in list_method_cfgs().items():
+            description = cfg.description or ""
+            if autotype and cfg.type != autotype:
+                continue
+            if (
+                query_lower
+                and query_lower not in name.lower()
+                and query_lower not in description.lower()
+            ):
+                continue
             templates.append((name, cfg.type, cfg.description))
 
     if not templates:
```

---

### Incident Patch 3: `85d4e05b` (2026-09-26)
**Commit Message**: Merge pull request #180 from dex0shubham/fix/unknown-method-template-error

fix: report unregistered method templates accurately

**File**: `hyperextract/cli/utils.py` (modified, +7/-1)
```diff
@@ -259,8 +259,14 @@ def get_template_from_ka(ka_path: Path) -> tuple[str, str]:
             # Method templates are code-registered, not gallery YAML files.
             from hyperextract.methods.registry import get_method
 
-            if get_method(template[len("method/") :]) is not None:
+            method = template[len("method/") :]
+            if get_method(method) is not None:
                 return template, lang
+            raise ValueError(
+                f"Template '{template}' names an extraction method that is not "
+                f"registered ('{method}'). Run `he list` to see the available "
+                "methods."
+            )
         elif Gallery.get(template) is not None:
             return template, lang
         else:
```

**File**: `tests/methods/test_chunk_rag.py` (modified, +19/-0)
```diff
@@ -89,6 +89,25 @@ def test_get_template_from_ka_resolves_method(self, ka_dir):
         assert template == "method/chunk_rag"
         assert lang == "en"
 
+    def test_unknown_method_template_names_the_method(self, ka_dir):
+        """An unregistered method must not be reported as a missing template."""
+        import json
+
+        from hyperextract.cli.utils import get_template_from_ka
+
+        meta_path = ka_dir / "metadata.json"
+        meta = json.loads(meta_path.read_text(encoding="utf-8"))
+        meta["template"] = "method/no_such_method"
+        meta_path.write_text(json.dumps(meta), encoding="utf-8")
+
+        with pytest.raises(ValueError) as excinfo:
+            get_template_from_ka(ka_dir)
+
+        message = str(excinfo.value)
+        assert "no_such_method" in message
+        assert "not specified" not in message
+        assert "No template specified" not in message
+
     def test_search_command_prints_chunks(self, ka_dir, llm_client, embedder):
         with (
             patch("hyperextract.cli.cli.validate_config"),
```

---

### Incident Patch 4: `40049b51` (2026-09-26)
**Commit Message**: Merge pull request #181 from dex0shubham/fix/feed-warns-dropped-chunks

fix: warn about dropped chunks in he feed

**File**: `hyperextract/cli/cli.py` (modified, +6/-0)
```diff
@@ -1368,6 +1368,12 @@ def _feed_one_document(
 
     logger.debug("stage=feed_text_invoked")
     ka.feed_text(text, source_id=source, content_hash=text_hash_to_record)
+    failures = getattr(ka, "extraction_failures", [])
+    if failures:
+        console.print(
+            f"[yellow]Warning:[/yellow] {len(failures)} chunk(s) failed "
+            "extraction and were skipped."
+        )
     logger.info("stage=knowledge_appended chars=%d source=%s", len(text), source)
     return True
 
```

**File**: `tests/types/test_extraction_failures.py` (modified, +32/-0)
```diff
@@ -90,6 +90,38 @@ def test_second_feed_search_finds_new_content(self, llm_client, embedder):
         assert hits  # incremental feed is searchable
 
 
+class TestFeedCliWarning:
+    """``he feed`` must report dropped chunks, as ``he parse`` and the docs do."""
+
+    def test_feed_warns_when_chunks_fail(self, llm_client, embedder, tmp_path):
+        from typer.testing import CliRunner
+
+        import hyperextract.cli.cli as climod
+        from hyperextract.cli.cli import app
+
+        ka = _list_ka(llm_client, embedder)
+        ka.metadata["template"] = "general/list"
+        ka.metadata["lang"] = "en"
+        ka_dir = tmp_path / "ka"
+        ka.dump(ka_dir)
+        ka.data_extractor = _FlakyExtractor(ka.data_extractor, fail_indexes={1})
+        doc = tmp_path / "doc.md"
+        doc.write_text("chunk boundary filler. " * 300, encoding="utf-8")
+
+        import unittest.mock as mock
+
+        with (
+            mock.patch.object(
+                climod.Template, "create", staticmethod(lambda *a, **k: ka)
+            ),
+            mock.patch.object(climod, "validate_config", lambda: None),
+        ):
+            result = CliRunner().invoke(app, ["feed", str(ka_dir), str(doc)])
+
+        assert result.exit_code == 0, result.output
+        assert "chunk(s) failed" in result.output
+
+
 class TestExtractionFailures:
     def test_failures_collected_by_default(self, llm_client, embedder):
         ka = _list_ka(llm_client, embedder)
```

---

### Incident Patch 5: `e80eb8ac` (2026-09-25)
**Commit Message**: fix: warn about dropped chunks in he feed

**File**: `hyperextract/cli/cli.py` (modified, +6/-0)
```diff
@@ -1368,6 +1368,12 @@ def _feed_one_document(
 
     logger.debug("stage=feed_text_invoked")
     ka.feed_text(text, source_id=source, content_hash=text_hash_to_record)
+    failures = getattr(ka, "extraction_failures", [])
+    if failures:
+        console.print(
+            f"[yellow]Warning:[/yellow] {len(failures)} chunk(s) failed "
+            "extraction and were skipped."
+        )
     logger.info("stage=knowledge_appended chars=%d source=%s", len(text), source)
     return True
 
```

---

### Incident Patch 6: `a429364d` (2026-09-25)
**Commit Message**: fix: report unregistered method templates accurately

**File**: `hyperextract/cli/utils.py` (modified, +7/-1)
```diff
@@ -259,8 +259,14 @@ def get_template_from_ka(ka_path: Path) -> tuple[str, str]:
             # Method templates are code-registered, not gallery YAML files.
             from hyperextract.methods.registry import get_method
 
-            if get_method(template[len("method/") :]) is not None:
+            method = template[len("method/") :]
+            if get_method(method) is not None:
                 return template, lang
+            raise ValueError(
+                f"Template '{template}' names an extraction method that is not "
+                f"registered ('{method}'). Run `he list` to see the available "
+                "methods."
+            )
         elif Gallery.get(template) is not None:
             return template, lang
         else:
```

---

### Incident Patch 7: `611930e0` (2026-09-25)
**Commit Message**: fix: hypergraph incremental feed crash; visible chunk failures + on_error (#users)

- AutoHypergraph._update_data_state referenced the nonexistent
  self.key_extractor (only node_key_extractor/edge_key_extractor exist),
  so the second incremental feed into any hypergraph KA raised
  AttributeError. Now uses the per-side extractors.
- Chunk extraction failures are recorded per run:
  ka.extraction_failures exposes [{chunk_index, stage, error}]; he feed /
  he parse print a warning when chunks were dropped.
- New BaseAutoType constructor option on_error="skip" (default, current
  behavior) or "raise" (abort the feed on first failing chunk), plumbed
  through all AutoTypes.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -354,7 +354,7 @@ identifiers:
 
 ## 📰 What's New
 
-**v0.10.3** — 🐛 Cypher export fixed: proper `;`-terminated statements and unique MERGE variables — Neo4j/Memgraph imports now actually work.
+**v0.10.4** — 👁️ Chunk extraction failures are now visible (`ka.extraction_failures`, optional `on_error="raise"`) · 🐛 Hypergraph incremental feed no longer crashes.
 
 📰 **[Full release notes](https://yifanfeng97.github.io/Hyper-Extract/latest/news/)** · [All releases](https://github.com/yifanfeng97/hyper-extract/releases)
 
```

**File**: `README_ZH.md` (modified, +1/-1)
```diff
@@ -354,7 +354,7 @@ identifiers:
 
 ## 📰 最新动态
 
-**v0.10.3** — 🐛 Cypher 导出修复：正确的 `;` 语句终结与唯一 MERGE 变量——Neo4j/Memgraph 导入真正可用了。
+**v0.10.4** — 👁️ Chunk 抽取失败可见化（`ka.extraction_failures`，可选 `on_error="raise"`）· 🐛 超图增量喂入不再崩溃。
 
 📰 **[完整版本说明](https://yifanfeng97.github.io/Hyper-Extract/latest/zh/news/)** · [全部 Releases](https://github.com/yifanfeng97/hyper-extract/releases)
 
```

**File**: `docs/en/news.md` (modified, +8/-0)
```diff
@@ -4,6 +4,14 @@ Release notes and highlights. For a complete changelog, see the [GitHub releases
 
 ---
 
+## v0.10.4 — Visible Chunk Failures & Hypergraph Incremental Feed
+
+- **🐛 Hypergraph incremental feed fixed** — feeding a second document into an existing hypergraph KA crashed with `AttributeError: 'key_extractor'` (`_update_data_state` referenced a nonexistent attribute). Now uses `node_key_extractor`/`edge_key_extractor`.
+- **👁️ Chunk extraction failures are visible** — failed chunks were silently skipped with only a log line. Every `feed_text()`/`parse()` run now records them: read `ka.extraction_failures` (chunk index, stage, error). `he feed`/`he parse` print a warning when chunks were dropped.
+- **⚙️ `on_error` strategy** — new constructor option: `"skip"` (default, current behavior) or `"raise"` to abort a feed on the first failing chunk. Available on all AutoTypes.
+
+---
+
 ## v0.10.3 — Working Cypher Export
 
 - **🐛 Cypher export fixed** — `he export cypher` output could not be imported by Neo4j/Memgraph: statements lacked `;` terminators (cypher-shell read the whole file as one query) and variables were re-declared within a single statement (`Variable 'n' already declared` from the second node on). Each node/edge/hyperedge is now its own `;`-terminated statement, and hyperedge members use positional aliases (`n0`, `n1`, …). *(#174)*
```

**File**: `docs/zh/news.md` (modified, +8/-0)
```diff
@@ -4,6 +4,14 @@
 
 ---
 
+## v0.10.4 — Chunk 失败可见化与超图增量喂入修复
+
+- **🐛 超图增量喂入修复** — 向已有超图 KA 喂第二个文档时崩溃（`_update_data_state` 引用了不存在的 `key_extractor` 属性）。现改用 `node_key_extractor`/`edge_key_extractor`。
+- **👁️ Chunk 抽取失败可见** — 失败的 chunk 此前只留一行日志即被静默跳过。现在每次 `feed_text()`/`parse()` 都会记录失败明细：读取 `ka.extraction_failures`（chunk 序号、阶段、错误）。`he feed`/`he parse` 会在丢弃 chunk 时打印警告。
+- **⚙️ `on_error` 策略** — 新增构造参数：`"skip"`（默认，保持现有行为）或 `"raise"`（首个失败 chunk 即中止整个喂入）。所有 AutoType 均可用。
+
+---
+
 ## v0.10.3 — Cypher 导出可用了
 
 - **🐛 Cypher 导出修复** — `he export cypher` 的输出此前无法导入 Neo4j/Memgraph：语句缺少 `;` 结束符（cypher-shell 会把整个文件当成一条查询），且单条语句内变量重复声明（第二个节点起报 `Variable 'n' already declared`）。现在每个节点/边/超边都是独立的 `;` 结尾语句，超边成员使用位置别名（`n0`、`n1`…）。*(#174)*
```

**File**: `hyperextract/cli/cli.py` (modified, +13/-0)
```diff
@@ -370,8 +370,15 @@ def parse(
 
             progress.update(task, description="Extracting knowledge...")
             logger.debug("stage=feed_text_invoked")
+            failed_chunks = 0
             for file_path, file_source, text in zip(text_files, file_sources, all_text):
                 ka.feed_text(text, source_id=file_source)
+                failed_chunks += len(getattr(ka, "extraction_failures", []))
+            if failed_chunks:
+                console.print(
+                    f"[yellow]Warning:[/yellow] {failed_chunks} chunk(s) failed "
+                    "extraction and were skipped."
+                )
             logger.info("stage=knowledge_extracted files=%d", len(text_files))
         else:
             progress.update(task, description="Reading input...")
@@ -386,6 +393,12 @@ def parse(
 
                 SourceDocumentStore(output_path).store_file(source, input)
             ka.feed_text(text, source_id=source)
+            failures = getattr(ka, "extraction_failures", [])
+            if failures:
+                console.print(
+                    f"[yellow]Warning:[/yellow] {len(failures)} chunk(s) failed "
+                    "extraction and were skipped."
+                )
             logger.info("stage=knowledge_extracted chars=%d", len(text))
 
         progress.update(task, description="Saving data...")
```

**File**: `hyperextract/types/base.py` (modified, +33/-1)
```diff
@@ -51,6 +51,7 @@ def __init__(
         chunk_overlap: int = 256,
         max_workers: int = 10,
         verbose: bool = False,
+        on_error: str = "skip",
     ):
         """Initialize the knowledge object with schema and processing configuration.
 
@@ -63,6 +64,9 @@ def __init__(
             chunk_overlap: Number of overlapping characters between chunks.
             max_workers: Maximum number of concurrent extraction tasks.
             verbose: Whether to display detailed execution logs and progress information.
+            on_error: Per-chunk extraction failure strategy: ``"skip"`` (default)
+                records the failure in ``extraction_failures`` and continues with
+                the surviving chunks; ``"raise"`` aborts the whole feed/parse.
         """
         self._data_schema = data_schema
         self.llm_client = llm_client
@@ -72,6 +76,9 @@ def __init__(
         self.chunk_overlap = chunk_overlap
         self.max_workers = max_workers
         self.verbose = verbose
+        if on_error not in ("skip", "raise"):
+            raise ValueError(f"on_error must be 'skip' or 'raise' (got {on_error!r})")
+        self.on_error = on_error
 
         # Initialize template
         self.prompt_template = ChatPromptTemplate.from_template(self.prompt)
@@ -100,6 +107,9 @@ def __init__(
         # Set by parse()/feed_text() while extraction runs; graph-family
         # subclasses record raw extraction results under it (provenance).
         self._pending_source_id: str | None = None
+        # Per-run chunk extraction failures: [{"chunk_index", "stage", "error"}].
+        # Reset at the start of each feed_text()/parse() run.
+        self._last_extraction_failures: list[dict[str, Any]] = []
 
     def _create_empty_instance(self) -> "BaseAutoType[T]":
         """Creates a new empty instance with the same configuration as this one.
@@ -129,6 +139,17 @@ def _default_prompt(self) -> str:
 
     # ==================== Data Access Interface ====================
 
+    @property
+    def extraction_failures(self) -> list[dict[str, Any]]:
+        """Chunk extraction failures of the last feed_text()/parse() run.
+
+        One entry per failed chunk: ``{"chunk_index": int, "stage": str,
+        "error": str}``. Empty when every chunk succeeded (or nothing was
+        fed yet). Always populated — even with the default ``on_error="skip"``
+        strategy — so callers can detect silently dropped chunks.
+        """
+        return list(self._last_extraction_failures)
+
     @property
     def data_schema(self) -> type[T]:
         """Returns the Pydantic schema class used by this knowledge instance.
@@ -356,7 +377,11 @@ def _invoke_safe(self, extractor, input: dict, *, stage: str):
             return extractor.invoke(input)
         except Exception as e:
             logger.warning("stage=%s_single_extract_failed error=%s", stage, e)
-            return None
+            self._last_extraction_failures.append(
+                {"chunk_index": 0, "stage": stage, "error": str(e)}
+            )
+            if self.on_error == "raise":
+                raise
 
     def _batch_safe(self, extractor, inputs: list[dict], *, stage: str) -> list:
         """batch() with return_exceptions=True; per-chunk failures logged and nulled.
@@ -380,6 +405,11 @@ def _batch_safe(self, extractor, inputs: list[dict], *, stage: str) -> list:
                 logger.warning(
                     "stage=%s_chunk_extract_failed chunk_index=%d error=%s", stage, i, r
                 )
+                self._last_extraction_failures.append(
+                    {"chunk_index": i, "stage": stage, "error": str(r)}
+                )
+                if self.on_error == "raise":
+                    raise r
                 results.append(None)
             else:
                 results.append(r)
@@ -436,6 +466,7 @@ def parse(self, text: str, *, source_id: str | None = None) -> "BaseAutoType[T]"
             A new knowledge instance containing only the parsed data.
         """
         self._pending_source_id = source_id
+        self._last_extraction_failures = []
         try:
             parsed_data = self._extract_data(text)
         finally:
@@ -479,6 +510,7 @@ def feed_text(
         logger.debug("stage=feed_text_start input_chars=%d", len(text))
         self._pending_source_id = source_id
         self._pending_content_hash = content_hash
+        self._last_extraction_failures = []
         try:
             extracted_data = self._extract_data(text)
             logger.debug("stage=extract_done")
```

**File**: `hyperextract/types/document.py` (modified, +2/-0)
```diff
@@ -71,6 +71,7 @@ def __init__(
         chunk_size: int = 2048,
         chunk_overlap: int = 256,
         verbose: bool = False,
+        on_error: str = "skip",
         **kwargs,
     ):
         """Initialize the document corpus.
@@ -93,6 +94,7 @@ def __init__(
             chunk_size=chunk_size,
             chunk_overlap=chunk_overlap,
             verbose=verbose,
+            on_error=on_error,
         )
 
     def _create_empty_instance(self) -> "AutoDocument":
```

**File**: `hyperextract/types/graph.py` (modified, +2/-0)
```diff
@@ -692,6 +692,7 @@ def __init__(
         chunk_overlap: int = 256,
         max_workers: int = 10,
         verbose: bool = False,
+        on_error: str = "skip",
         node_fields_for_index: list[str] | None = None,
         edge_fields_for_index: list[str] | None = None,
         **kwargs: Any,
@@ -826,6 +827,7 @@ def __init__(
             chunk_overlap=chunk_overlap,
             max_workers=max_workers,
             verbose=verbose,
+            on_error=on_error,
         )
 
         # Initialize prompts (use custom if provided, otherwise use defaults)
```

---

### Incident Patch 8: `c325ba12` (2026-09-25)
**Commit Message**: Merge pull request #176 from 1816586742-stack/docs/fix-readme-relative-links

docs: fix relative links that do not resolve from their own directory

**File**: `docs/zh/templates/index.md` (modified, +1/-1)
```diff
@@ -147,4 +147,4 @@ result = ka.parse(text)
 
 需要特定功能？学习创建自己的模板：
 
-→ [自定义模板指南](../../python/guides/custom-templates.md)
+→ [自定义模板指南](../python/guides/custom-templates.md)
```

**File**: `hyperextract-skills/graph-designer/references/dimensions.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Dimension Design Reference
 
-Time and space dimension patterns. See [SKILL.md](SKILL.md) for workflow.
+Time and space dimension patterns. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/graph-designer/references/entity.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Entity Design Reference
 
-Entity design patterns for graph types. See [SKILL.md](SKILL.md) for workflow.
+Entity design patterns for graph types. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/graph-designer/references/hypergraph.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Hypergraph Design Reference
 
-Hypergraph design patterns for graph types. See [SKILL.md](SKILL.md) for workflow.
+Hypergraph design patterns for graph types. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/graph-designer/references/relation.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Relation Design Reference
 
-Relation design patterns for graph types. See [SKILL.md](SKILL.md) for workflow.
+Relation design patterns for graph types. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/record-designer/references/field.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Field Design Reference
 
-Field design patterns for record types. See [SKILL.md](SKILL.md) for workflow.
+Field design patterns for record types. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/record-designer/references/identifier.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Identifier Design Reference
 
-Identifier configuration for record types. See [SKILL.md](SKILL.md) for workflow.
+Identifier configuration for record types. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/yaml-validator/references/rules-errors.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Common Error Patterns
 
-Common YAML configuration errors and fixes. See [SKILL.md](SKILL.md) for workflow.
+Common YAML configuration errors and fixes. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

---

### Incident Patch 9: `1f10213f` (2026-09-25)
**Commit Message**: Merge pull request #179 from dex0shubham/fix/mcp-export-dir-destination

fix: return a message when an MCP export destination is a directory

**File**: `hyperextract/mcp_server.py` (modified, +6/-0)
```diff
@@ -321,6 +321,8 @@ def export_graphml(ka_path: str, output: str, overwrite: bool = False) -> str:
         return str(e)
     except FileExistsError as e:
         return f"{e} Pass overwrite=true to overwrite it."
+    except IsADirectoryError as e:
+        return str(e)
     return f"Wrote GraphML to {dest}"
 
 
@@ -377,6 +379,8 @@ def export_jsonld(ka_path: str, output: str, overwrite: bool = False) -> str:
         return str(e)
     except FileExistsError as e:
         return f"{e} Pass overwrite=true to overwrite it."
+    except IsADirectoryError as e:
+        return str(e)
     return f"Wrote JSON-LD to {dest}"
 
 
@@ -402,6 +406,8 @@ def export_cypher(ka_path: str, output: str, overwrite: bool = False) -> str:
         return str(e)
     except FileExistsError as e:
         return f"{e} Pass overwrite=true to overwrite it."
+    except IsADirectoryError as e:
+        return str(e)
     return f"Wrote Cypher to {dest}"
 
 
```

**File**: `tests/test_mcp_server.py` (modified, +17/-0)
```diff
@@ -360,6 +360,23 @@ class _ListKA:
     assert "graph-type knowledge abstracts" in graphml
 
 
+@pytest.mark.parametrize(
+    "tool", ["export_graphml", "export_jsonld", "export_cypher"]
+)
+def test_export_to_directory_returns_message(monkeypatch, tmp_path, tool):
+    """A directory destination is a tool string here, as in `he export` — MCP
+    tools never raise."""
+    g = _graph_with_index()
+    monkeypatch.setattr(mcp_server, "_load_ka", lambda p: g)
+    dest = tmp_path / "out"
+    dest.mkdir()
+
+    out = getattr(mcp_server, tool)("x", str(dest))
+
+    assert "is a directory" in out
+    assert "file path" in out
+
+
 def test_export_cypher(monkeypatch, tmp_path):
     g = _graph_with_index()
     monkeypatch.setattr(mcp_server, "_load_ka", lambda p: g)
```

---

### Incident Patch 10: `0bb61958` (2026-09-25)
**Commit Message**: Merge pull request #177 from dex0shubham/fix/info-count-items

fix: count items for list/set KAs in he info and MCP info

**File**: `hyperextract/cli/cli.py` (modified, +2/-1)
```diff
@@ -860,7 +860,8 @@ def info(
         data = json.load(f)
 
     if isinstance(data, dict):
-        node_count = len(data.get("nodes", data.get("entities", [])))
+        # list/set KAs store "items"; docs define Nodes as entities/items
+        node_count = len(data.get("nodes", data.get("entities", data.get("items", []))))
         edge_count = len(data.get("edges", data.get("relations", [])))
         chunk_count = len(data.get("chunks", []))
     elif isinstance(data, list):
```

**File**: `hyperextract/mcp_server.py` (modified, +2/-1)
```diff
@@ -139,7 +139,8 @@ def info(ka_path: str, include_sources: bool = False) -> str:
     data = json.loads(data_file.read_text(encoding="utf-8"))
     chunks = 0
     if isinstance(data, dict):
-        nodes = len(data.get("nodes", data.get("entities", [])))
+        # list/set KAs store "items"; docs define Nodes as entities/items
+        nodes = len(data.get("nodes", data.get("entities", data.get("items", []))))
         edges = len(data.get("edges", data.get("relations", [])))
         chunks = len(data.get("chunks", []))
     elif isinstance(data, list):
```

**File**: `tests/cli/test_info.py` (modified, +21/-0)
```diff
@@ -63,3 +63,24 @@ def test_sources_without_ledger_prints_hint(self, tmp_path):
 
         assert result.exit_code == 0, result.output
         assert "No source ledger" in result.output
+
+
+class TestInfoItemCounts:
+    def test_list_ka_counts_items_as_nodes(self, tmp_path):
+        """List/Set KAs store ``items``; ``Nodes`` is documented as entities/items."""
+        ka = tmp_path / "ka"
+        ka.mkdir()
+        (ka / "data.json").write_text(
+            json.dumps({"items": [{"name": "a"}, {"name": "b"}, {"name": "c"}]}),
+            encoding="utf-8",
+        )
+        (ka / "metadata.json").write_text(
+            json.dumps({"template": "general/base_list", "lang": "en"}),
+            encoding="utf-8",
+        )
+        result = runner.invoke(app, ["info", str(ka)])
+        assert result.exit_code == 0, result.output
+        nodes_line = next(
+            line for line in result.output.splitlines() if line.strip().startswith("Nodes")
+        )
+        assert nodes_line.split()[-1] == "3"
```

**File**: `tests/test_mcp_server.py` (modified, +17/-0)
```diff
@@ -92,6 +92,23 @@ def test_info_reports_counts(tmp_path):
     assert "sources" not in out
 
 
+def test_info_counts_items_for_list_and_set_kas(tmp_path):
+    """List/Set KAs store ``items`` rather than ``nodes``/``edges``."""
+    ka = tmp_path / "ka"
+    ka.mkdir()
+    (ka / "data.json").write_text(
+        json.dumps({"items": [{"name": "a"}, {"name": "b"}, {"name": "c"}]}),
+        encoding="utf-8",
+    )
+    (ka / "metadata.json").write_text(
+        json.dumps({"template": "general/base_list", "lang": "en"}), encoding="utf-8"
+    )
+
+    out = json.loads(mcp_server.info(str(ka)))
+    assert out["nodes"] == 3
+    assert out["edges"] == 0
+
+
 def test_info_includes_chunks_and_optional_sources(tmp_path):
     ka = tmp_path / "doc_ka"
     ka.mkdir()
```

---

### Incident Patch 11: `8ed862e6` (2026-09-25)
**Commit Message**: Merge pull request #178 from dex0shubham/fix/remove-purge-respects-dry-run

fix: never purge archived documents on he remove --dry-run

**File**: `hyperextract/cli/cli.py` (modified, +8/-7)
```diff
@@ -1752,13 +1752,6 @@ def remove_items(
 
     console.print()
     if document:
-        if purge_documents:
-            from hyperextract.utils.document_store import SourceDocumentStore
-
-            removed_files = SourceDocumentStore(path).purge(document)
-            for f in removed_files:
-                console.print(f"[dim]Archived document deleted: {f}[/dim]")
-
         table = Table(title=f"Document Rollback Report — {document}")
         table.add_column("Field")
         table.add_column("Items")
@@ -1832,6 +1825,14 @@ def remove_items(
 
     ka.dump(path)
 
+    # Only after the dry-run gate: purging is destructive and must never run
+    # on a preview.
+    if document and purge_documents:
+        from hyperextract.utils.document_store import SourceDocumentStore
+
+        for f in SourceDocumentStore(path).purge(document):
+            console.print(f"[dim]Archived document deleted: {f}[/dim]")
+
     if report.get("index_patched", False):
         # The vector index was patched in place and persisted by dump() —
         # search stays usable without a rebuild.
```

**File**: `tests/cli/test_remove.py` (modified, +42/-0)
```diff
@@ -246,6 +246,48 @@ def test_document_without_contributions_reports_nothing(
         assert "Nothing matched" in result.output
 
 
+class TestPurgeDocuments:
+    @staticmethod
+    def _ka_with_archive(tmp_path, monkeypatch):
+        from hyperextract.utils.document_store import SourceDocumentStore
+
+        g = _real_ka()
+        g.metadata["template"] = "general/graph"
+        g.metadata["lang"] = "en"
+        g._node_memory.add([E(name="Apple")])
+        g.feed_text("Apple partners with DeepMind on AI research.", source_id="doc-1")
+        ka = tmp_path / "ka"
+        g.dump(ka)
+        archived = SourceDocumentStore(ka).store_text(
+            "doc-1", "Apple partners with DeepMind on AI research.", "doc1.md"
+        )
+        monkeypatch.setattr(climod.Template, "create", staticmethod(lambda *a, **k: g))
+        return ka, archived
+
+    def test_dry_run_does_not_purge_archived_document(self, tmp_path, monkeypatch):
+        ka, archived = self._ka_with_archive(tmp_path, monkeypatch)
+
+        result = runner.invoke(
+            app,
+            ["remove", str(ka), "--document", "doc-1", "--purge-documents", "--dry-run", "-y"],
+        )
+
+        assert result.exit_code == 0, result.output
+        assert "Dry run" in result.output
+        assert archived.exists()
+
+    def test_purge_deletes_archived_document_on_apply(self, tmp_path, monkeypatch):
+        ka, archived = self._ka_with_archive(tmp_path, monkeypatch)
+
+        result = runner.invoke(
+            app, ["remove", str(ka), "--document", "doc-1", "--purge-documents", "-y"]
+        )
+
+        assert result.exit_code == 0, result.output
+        assert "Archived document deleted" in result.output
+        assert not archived.exists()
+
+
 class TestDocumentRollbackStrategies:
     @staticmethod
     def _strategy_ka(tmp_path, monkeypatch):
```

---

### Incident Patch 12: `40781ebb` (2026-09-24)
**Commit Message**: fix: return a message when an MCP export destination is a directory

**File**: `hyperextract/mcp_server.py` (modified, +6/-0)
```diff
@@ -320,6 +320,8 @@ def export_graphml(ka_path: str, output: str, overwrite: bool = False) -> str:
         return str(e)
     except FileExistsError as e:
         return f"{e} Pass overwrite=true to overwrite it."
+    except IsADirectoryError as e:
+        return str(e)
     return f"Wrote GraphML to {dest}"
 
 
@@ -376,6 +378,8 @@ def export_jsonld(ka_path: str, output: str, overwrite: bool = False) -> str:
         return str(e)
     except FileExistsError as e:
         return f"{e} Pass overwrite=true to overwrite it."
+    except IsADirectoryError as e:
+        return str(e)
     return f"Wrote JSON-LD to {dest}"
 
 
@@ -401,6 +405,8 @@ def export_cypher(ka_path: str, output: str, overwrite: bool = False) -> str:
         return str(e)
     except FileExistsError as e:
         return f"{e} Pass overwrite=true to overwrite it."
+    except IsADirectoryError as e:
+        return str(e)
     return f"Wrote Cypher to {dest}"
 
 
```

---

### Incident Patch 13: `b19643ec` (2026-09-20)
**Commit Message**: fix: never purge archived documents on he remove --dry-run

**File**: `hyperextract/cli/cli.py` (modified, +8/-7)
```diff
@@ -1752,13 +1752,6 @@ def remove_items(
 
     console.print()
     if document:
-        if purge_documents:
-            from hyperextract.utils.document_store import SourceDocumentStore
-
-            removed_files = SourceDocumentStore(path).purge(document)
-            for f in removed_files:
-                console.print(f"[dim]Archived document deleted: {f}[/dim]")
-
         table = Table(title=f"Document Rollback Report — {document}")
         table.add_column("Field")
         table.add_column("Items")
@@ -1832,6 +1825,14 @@ def remove_items(
 
     ka.dump(path)
 
+    # Only after the dry-run gate: purging is destructive and must never run
+    # on a preview.
+    if document and purge_documents:
+        from hyperextract.utils.document_store import SourceDocumentStore
+
+        for f in SourceDocumentStore(path).purge(document):
+            console.print(f"[dim]Archived document deleted: {f}[/dim]")
+
     if report.get("index_patched", False):
         # The vector index was patched in place and persisted by dump() —
         # search stays usable without a rebuild.
```

---

### Incident Patch 14: `bd794804` (2026-09-20)
**Commit Message**: fix: count items for list/set KAs in he info and MCP info

**File**: `hyperextract/cli/cli.py` (modified, +2/-1)
```diff
@@ -860,7 +860,8 @@ def info(
         data = json.load(f)
 
     if isinstance(data, dict):
-        node_count = len(data.get("nodes", data.get("entities", [])))
+        # list/set KAs store "items"; docs define Nodes as entities/items
+        node_count = len(data.get("nodes", data.get("entities", data.get("items", []))))
         edge_count = len(data.get("edges", data.get("relations", [])))
         chunk_count = len(data.get("chunks", []))
     elif isinstance(data, list):
```

**File**: `hyperextract/mcp_server.py` (modified, +2/-1)
```diff
@@ -139,7 +139,8 @@ def info(ka_path: str, include_sources: bool = False) -> str:
     data = json.loads(data_file.read_text(encoding="utf-8"))
     chunks = 0
     if isinstance(data, dict):
-        nodes = len(data.get("nodes", data.get("entities", [])))
+        # list/set KAs store "items"; docs define Nodes as entities/items
+        nodes = len(data.get("nodes", data.get("entities", data.get("items", []))))
         edges = len(data.get("edges", data.get("relations", [])))
         chunks = len(data.get("chunks", []))
     elif isinstance(data, list):
```

---

### Incident Patch 15: `23188696` (2026-09-20)
**Commit Message**: docs: fix relative links that do not resolve from their own directory

Three groups were off by one level: the CLI READMEs under
hyperextract/cli/ (README.md and examples/ live at the root, not one
level up), the SKILL.md references inside each skill's references/
directory (SKILL.md is one level up), and docs/zh/templates/index.md,
which needed one ../ rather than two for the Chinese guide.

../templates/ in the CLI READMEs is correct and was left unchanged.

**File**: `docs/zh/templates/index.md` (modified, +1/-1)
```diff
@@ -147,4 +147,4 @@ result = ka.parse(text)
 
 需要特定功能？学习创建自己的模板：
 
-→ [自定义模板指南](../../python/guides/custom-templates.md)
+→ [自定义模板指南](../python/guides/custom-templates.md)
```

**File**: `hyperextract-skills/graph-designer/references/dimensions.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Dimension Design Reference
 
-Time and space dimension patterns. See [SKILL.md](SKILL.md) for workflow.
+Time and space dimension patterns. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/graph-designer/references/entity.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Entity Design Reference
 
-Entity design patterns for graph types. See [SKILL.md](SKILL.md) for workflow.
+Entity design patterns for graph types. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/graph-designer/references/hypergraph.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Hypergraph Design Reference
 
-Hypergraph design patterns for graph types. See [SKILL.md](SKILL.md) for workflow.
+Hypergraph design patterns for graph types. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/graph-designer/references/relation.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Relation Design Reference
 
-Relation design patterns for graph types. See [SKILL.md](SKILL.md) for workflow.
+Relation design patterns for graph types. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/record-designer/references/field.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Field Design Reference
 
-Field design patterns for record types. See [SKILL.md](SKILL.md) for workflow.
+Field design patterns for record types. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/record-designer/references/identifier.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Identifier Design Reference
 
-Identifier configuration for record types. See [SKILL.md](SKILL.md) for workflow.
+Identifier configuration for record types. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

**File**: `hyperextract-skills/yaml-validator/references/rules-errors.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Common Error Patterns
 
-Common YAML configuration errors and fixes. See [SKILL.md](SKILL.md) for workflow.
+Common YAML configuration errors and fixes. See [SKILL.md](../SKILL.md) for workflow.
 
 ---
 
```

#### Recent Merged Pull Requests:
- **PR #183** (2026-09-28): fix: apply --query and --autotype to method rows in he list template (@dex0shubham)
- **PR #182** (closed): fix: record empty extractor results as chunk failures; keep content out of logs (@mrbranan)
- **PR #181** (2026-09-26): fix: warn about dropped chunks in he feed (@dex0shubham)
- **PR #180** (2026-09-26): fix: report unregistered method templates accurately (@dex0shubham)
- **PR #179** (2026-09-25): fix: return a message when an MCP export destination is a directory (@dex0shubham)
- **PR #178** (2026-09-25): fix: never purge archived documents on he remove --dry-run (@dex0shubham)
- **PR #177** (2026-09-25): fix: count items for list/set KAs in he info and MCP info (@dex0shubham)
- **PR #176** (2026-09-25): docs: fix relative links that do not resolve from their own directory (@1816586742-stack)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
