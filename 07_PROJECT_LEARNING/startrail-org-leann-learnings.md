# Forensic Learning Record (Deep Inspection): StarTrail-org/LEANN

> **Canonical Artifact**: `07_PROJECT_LEARNING/startrail-org-leann-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/StarTrail-org/LEANN](https://github.com/StarTrail-org/LEANN))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:25:07.951Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarTrail-org/LEANN`
- **Description**: [MLsys2026 Best Paper]: https://arxiv.org/abs/2506.08276. RAG on Everything with LEANN. Enjoy 97% storage savings while running a fast, accurate, and 100% private RAG application on your personal device.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 13009 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/llm_utils.py`
```
"""
LLM utils for RAG benchmarks with Qwen3-8B and Qwen2.5-VL (multimodal)
"""

import time

try:
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    HF_AVAILABLE = True
except ImportError:
    HF_AVAILABLE = False

try:
    from vllm import LLM, SamplingParams

    VLLM_AVAILABLE = True
except ImportError:
    VLLM_AVAILABLE = False


def is_qwen3_model(model_name):
    """Check if model is Qwen3"""
    return "Qwen3" in model_name or "qwen3" in model_name.lower()


def is_qwen_vl_model(model_name):
    """Check if model is Qwen2.5-VL"""
    return "Qwen2.5-VL" in model_name or "qwen2.5-vl" in model_name.lower()


def apply_qwen3_chat_template(tokenizer, prompt):
    """Apply Qwen3 chat template with thinking enabled"""
    messages = [{"role": "user", "content": prompt}]
    return tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
        enable_thinking=True,
    )


def extract_thinking_answer(response):
    """Extract final answer from Qwen3 thinking model response"""
    if "<think>" in response and "</think>" in response:
        try:
            think_end = response.index("</think>") + len("</think>")
            final_answer = response[think_end:].strip()
            return final_answer
        except (ValueError, IndexError):
            pass

    return response.strip()


def load_hf_model(model_name="Qwen/Qwen3-8B", trust_remote_code=False):
    """Load HuggingFace model

    Args:
        model_name (str): Name of the model to load
        trust_remote_code (bool): Whether to allow execution of code from the model repository.
            Defaults to False for security. Only enable for trusted models.
    """
    if not HF_AVAILABLE:
        raise ImportError("transformers not available")

    if trust_remote_code:
        print(
            "⚠️  WARNING: Loading model with trust_remote_code=True. This can execute arbitrary code."
        )

    print(f"Loading HF: {model_name}")
    tokenizer = AutoTokenizer.from_pretrained(model_name, trust_remote_code=trust_remote_code)
    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        device_map="auto",
        trust_remote_code=trust_remote_code,
    )
    return tokenizer, model


def load_vllm_model(model_name="Qwen/Qwen3-8B", trust_remote_code=False):
    """Load vLLM model

    Args:
        model_name (str): Name of the model to load
        trust_remote_code (bool): Whether to allow execution of code from the model repository.
            Defaults to False for security. Only enable for trusted models.
    """
    if not VLLM_AVAILABLE:
        raise ImportError("vllm not available")

    if trust_remote_code:
        print(
            "⚠️  WARNING: Loading model with trust_remote_code=True. This can execute arbitrary code."
        )

    print(f"Loading vLLM: {model_name}")
    llm = LLM(model=model_name, trust_remote_code=trust_remote_code)

    # Qwen3 specific config
    if is_qwen3_model(model_name):
        stop_tokens = ["<|im_end|>", "<|end_of_text|>"]
        max_tokens = 2048
    else:
        stop_tokens = None
        max_tokens = 1024

    sampling_params = SamplingParams(temperature=0.7, max_tokens=max_tokens, stop=stop_tokens)
    return llm, sampling_params


def generate_hf(tokenizer, model, prompt, max_tokens=None):
    """Generate with HF - supports Qwen3 thinking models"""
    model_name = getattr(model, "name_or_path", "unknown")
    is_qwen3 = is_qwen3_model(model_name)

    # Apply chat template for Qwen3
    if is_qwen3:
        prompt = apply_qwen3_chat_template(tokenizer, prompt)
        max_tokens = max_tokens or 2048
    else:
        max_tokens = max_tokens or 1024

    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_new_tokens=max_tokens,
            temperature=0.7,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
        )
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    response = response[len(prompt) :].strip()

    # Extract final answer for thinking models
    if is_qwen3:
        return extract_thinking_answer(response)
    return response


def generate_vllm(llm, sampling_params, prompt):
    """Generate with vLLM - supports Qwen3 thinking models"""
    outputs = llm.generate([prompt], sampling_params)
    response = outputs[0].outputs[0].text.strip()

    # Extract final answer for Qwen3 thinking models
    model_name = str(llm.llm_engine.model_config.model)
    if is_qwen3_model(model_name):
        return extract_thinking_answer(response)
    return response


def create_prompt(context, query, domain="default"):
    """Create RAG prompt"""
    if domain == "emails":
        return f"Email content:\n{context}\n\nQuestion: {query}\n\nAnswer:"
    elif domain == "finance":
        return f"Financial content:\n{context}\n\nQuestion: {query}\n\nAnswer:"
    elif domain == "multimodal":
        return f"Image context:\n{context}\n\nQuestion: {query}\n\nAnswer:"
    else:
        return f"Context: {context}\n\nQuestion: {query}\n\nAnswer:"


def evaluate_rag(searcher, llm_func, queries, domain="default", top_k=3, complexity=64):
    """Simple RAG evaluation with timing"""
    search_times = []
    gen_times = []
    results = []

    for i, query in enumerate(queries):
        # Search
        start = time.time()
        docs = searcher.search(query, top_k=top_k, complexity=complexity)
        search_time = time.time() - start

        # Generate
        context = "\n\n".join([doc.text for doc in docs])
        prompt = create_prompt(context, query, domain)

        start = time.time()
        response = llm_func(prompt)
        gen_time = time.time() - start

        search_times.append(search_time)
        gen_times.append(gen_time)
        results.append(response)

        if i < 3:
            print(f"Q{i + 1}: Search={search_time:.3f}s, Gen={gen_time:.3f}s")

    return {
        "avg_search_time": sum(search_times) / len(search_times),
        "avg_generation_time": sum(gen_times) / len(gen_times),
        "results": results,
    }


def load_qwen_vl_model(model_name="Qwen/Qwen2.5-VL-7B-Instruct", trust_remote_code=False):
    """Load Qwen2.5-VL multimodal model

    Args:
        model_name (str): Name of the model to load
        trust_remote_code (bool): Whether to allow execution of code from the model repository.
            Defaults to False for security. Only enable for trusted models.
    """
    if not HF_AVAILABLE:
        raise ImportError("transformers not available")

    if trust_remote_code:
        print(
            "⚠️  WARNING: Loading model with trust_remote_code=True. This can execute arbitrary code."
        )

    print(f"Loading Qwen2.5-VL: {model_name}")

    try:
        from transformers import AutoModelForVision2Seq, AutoProcessor

        processor = AutoProcessor.from_pretrained(model_name, trust_remote_code=trust_remote_code)
        model = AutoModelForVision2Seq.from_pretrained(
            model_name,
            torch_dtype=torch.bfloat16,
            device_map="auto",
            trust_remote_code=trust_remote_code,
        )

        return processor, model

    except Exception as e:
        print(f"Failed to load with AutoModelForVision2Seq, trying specific class: {e}")

        # Fallback to specific class
        try:
            from transformers import AutoProcessor, Qwen2VLForConditionalGeneration

            processor = AutoProcessor.from_pretrained(
                model_name, trust_remote_code=trust_remote_code
            )
            model = Qwen2VLForConditionalGeneration.from_pretrained(
                model_name,
                torch_dtype=torch.bfloat16,
                device_map="auto",
                trust_remote_code=trust_remote_code,
            )

            return processor, model

        except Exception as e2:
            raise ImportError(f"Failed to load Qwen2.5-VL model: {e2}")


def generate_qwen_vl(processor, model, prompt, image_path=None, max_tokens=512):
    """Generate with Qwen2.5-VL multimodal model"""
    from PIL import Image

    # Prepare inputs
    if image_path:
        image = Image.open(image_path)
        inputs = processor(text=prompt, images=image, return_tensors="pt").to(model.device)
    else:
        inputs = processor(text=prompt, return_tensors="pt").to(model.device)

    # Generate
    with torch.no_grad():
        generated_ids = model.generate(
            **inputs, max_new_tokens=max_tokens, do_sample=False, temperature=0.1
        )

    # Decode response
    generated_ids = generated_ids[:, inputs["input_ids"].shape[1] :]
    response = processor.decode(generated_ids[0], skip_special_tokens=True)

    return response


def create_multimodal_prompt(context, query, image_descriptions, task_type="images"):
    """Create prompt for multimodal RAG"""
    if task_type == "images":
        return f"""Based on the retrieved images and their descriptions, answer the following question.

Retrieved Image Descriptions:
{context}

Question: {query}

Provide a detailed answer based on the visual content described above."""

    return f"Context: {context}\nQuestion: {query}\nAnswer:"


def evaluate_multimodal_rag(searcher, queries, processor=None, model=None, complexity=64):
    """Evaluate multimodal RAG with Qwen2.5-VL"""
    search_times = []
    gen_times = []
    results = []

    for i, query_item in enumerate(queries):
        # Handle both string and dict formats for queries
        if isinstance(query_item, dict):
            query = query_item.get("query", "")
            image_path = query_item.get("image_path")  # Optional reference image
        else:
            query = str(query_item)
            image_path = None

        # Search
        star
```

### Core Architecture Module: `packages/leann-core/src/leann/__init__.py`
```
# packages/leann-core/src/leann/__init__.py
import os
import platform

# ruff: noqa: E402  (env vars must be set before importing the rest of the package)

# Fix OpenMP/FAISS threading defaults for common platforms
system = platform.system()

if system == "Darwin":
    # macOS ARM64: prevent runaway threading and duplicate lib issues
    os.environ["OMP_NUM_THREADS"] = "1"
    os.environ["MKL_NUM_THREADS"] = "1"
    os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
    os.environ["KMP_BLOCKTIME"] = "0"
    # Additional fixes for PyTorch/sentence-transformers on macOS ARM64 only in CI
    if os.environ.get("CI") == "true":
        os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "0"
        os.environ["TOKENIZERS_PARALLELISM"] = "false"
elif system == "Linux":
    # Linux CPU-only: default to single-thread to avoid FAISS/ZMQ hangs (issue #208)
    os.environ.setdefault("OMP_NUM_THREADS", "1")
    os.environ.setdefault("MKL_NUM_THREADS", "1")
    os.environ.setdefault("FAISS_NUM_THREADS", "1")
    os.environ.setdefault("OMP_WAIT_POLICY", "PASSIVE")

from .api import LeannBuilder, LeannChat, LeannSearcher
from .react_agent import ReActAgent, create_react_agent
from .registry import BACKEND_REGISTRY, autodiscover_backends

autodiscover_backends()

__all__ = [
    "BACKEND_REGISTRY",
    "LeannBuilder",
    "LeannChat",
    "LeannSearcher",
    "ReActAgent",
    "create_react_agent",
]

```

### Core Architecture Module: `packages/leann-core/src/leann/__main__.py`
```
from leann.cli import main

main()

```

### Core Architecture Module: `packages/leann-core/src/leann/api.py`
```
"""
This file contains the core API for the LEANN project, now definitively updated
with the correct, original embedding logic from the user's reference code.
"""

import json
import logging
import os
import pickle
import re
import subprocess
import time
import warnings
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal, Optional, Union

import numpy as np

from leann.interactive_utils import create_api_session
from leann.interface import LeannBackendSearcherInterface

from .chat import get_llm
from .embedding_server_manager import EmbeddingServerManager
from .interface import LeannBackendFactoryInterface
from .metadata_filter import MetadataFilterEngine
from .registry import BACKEND_REGISTRY

logger = logging.getLogger(__name__)

# Passage ID schemes recorded in <index>.meta.json["passage_id_scheme"].
# - "sequential": today's default; IDs are str(insertion_index) (api.py:add_text).
# - "content-hash": planned in #329; IDs are sha256(text)[:16], stable across
#   file moves and reorderings.
# Older indexes have no passage_id_scheme field — readers must default to
# "sequential" when the key is absent. See #329 for the rollout plan.
PASSAGE_ID_SCHEME_SEQUENTIAL = "sequential"
PASSAGE_ID_SCHEME_CONTENT_HASH = "content-hash"

_CJK_CHARACTERS = "\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af"
_CJK_RUN = re.compile(f"[{_CJK_CHARACTERS}]+")


def _fts5_cjk_ngrams(match: re.Match[str]) -> str:
    """Expand a CJK run into unigram and bigram tokens for SQLite FTS5."""
    text = match.group()
    tokens = " ".join([*text, *(text[i : i + 2] for i in range(len(text) - 1))])
    # Keep adjacent non-CJK words separate from the first and last n-grams.
    return f" {tokens} "


def _fts5_cjk_query(query: str) -> str:
    """Build a safe FTS5 query that requires every CJK bigram in each term."""
    # Unicode \w includes CJK, so exclude it from the non-CJK alternative.
    tokens = re.findall(rf"[{_CJK_CHARACTERS}]+|[^\W{_CJK_CHARACTERS}]+", query.lower())
    terms = []
    for token in tokens:
        if _CJK_RUN.fullmatch(token):
            ngrams = (
                [token] if len(token) == 1 else [token[i : i + 2] for i in range(len(token) - 1)]
            )
            terms.append("(" + " AND ".join(f'"{ngram}"' for ngram in ngrams) + ")")
        else:
            terms.append(f'"{token}"')
    return " OR ".join(terms)


def get_registered_backends() -> list[str]:
    """Get list of registered backend names."""
    return list(BACKEND_REGISTRY.keys())


def compute_embeddings(
    chunks: list[str],
    model_name: str,
    mode: str = "sentence-transformers",
    use_server: bool = True,
    port: Optional[int] = None,
    is_build=False,
    provider_options: Optional[dict[str, Any]] = None,
) -> np.ndarray:
    """
    Computes embeddings using different backends.

    Args:
        chunks: List of text chunks to embed
        model_name: Name of the embedding model
        mode: Embedding backend mode. Options:
            - "sentence-transformers": Use sentence-transformers library (default)
            - "mlx": Use MLX backend for Apple Silicon
            - "openai": Use OpenAI embedding API
            - "gemini": Use Google Gemini embedding API
        use_server: Whether to use embedding server (True for search, False for build)

    Returns:
        numpy array of embeddings
    """
    if use_server:
        # Use embedding server (for search/query)
        if port is None:
            raise ValueError("port is required when use_server is True")
        return compute_embeddings_via_server(chunks, model_name, port=port)
    else:
        # Use direct computation (for build_index)
        from .embedding_compute import (
            compute_embeddings as compute_embeddings_direct,
        )

        return compute_embeddings_direct(
            chunks,
            model_name,
            mode=mode,
            is_build=is_build,
            provider_options=provider_options,
        )


def compute_embeddings_via_server(chunks: list[str], model_name: str, port: int) -> np.ndarray:
    """Computes embeddings using sentence-transformers.

    Args:
        chunks: List of text chunks to embed
        model_name: Name of the sentence transformer model
    """
    logger.info(
        f"Computing embeddings for {len(chunks)} chunks using SentenceTransformer model '{model_name}' (via embedding server)..."
    )
    import msgpack
    import numpy as np
    import zmq

    # Connect to embedding server
    context = zmq.Context()
    socket = context.socket(zmq.REQ)
    socket.connect(f"tcp://localhost:{port}")

    # Send chunks to server for embedding computation
    request = chunks
    socket.send(msgpack.packb(request))

    # Receive embeddings from server
    response = socket.recv()
    embeddings_list = msgpack.unpackb(response)

    # Convert back to numpy array
    embeddings = np.array(embeddings_list, dtype=np.float32)

    socket.close()
    context.term()

    return embeddings


@dataclass
class SearchResult:
    id: str
    score: float
    text: str
    metadata: dict[str, Any] = field(default_factory=dict)


class PassageManager:
    def __init__(
        self, passage_sources: list[dict[str, Any]], metadata_file_path: Optional[str] = None
    ):
        self.offset_maps: dict[str, dict[str, int]] = {}
        self.passage_files: dict[str, str] = {}
        # Avoid materializing a single gigantic global map to reduce memory
        # footprint on very large corpora (e.g., 60M+ passages). Instead, keep
        # per-shard maps and do a lightweight per-shard lookup on demand.
        self._total_count: int = 0
        self.filter_engine = MetadataFilterEngine()  # Initialize filter engine

        # Derive index base name for standard sibling fallbacks, e.g., <index_name>.passages.*
        index_name_base = None
        if metadata_file_path:
            meta_name = Path(metadata_file_path).name
            if meta_name.endswith(".meta.json"):
                index_name_base = meta_name[: -len(".meta.json")]

        for source in passage_sources:
            assert source["type"] == "jsonl", "only jsonl is supported"
            passage_file = source.get("path", "")
            index_file = source.get("index_path", "")  # .idx file

            # Fix path resolution - relative paths should be relative to metadata file directory
            def _resolve_candidates(
                primary: str,
                relative_key: str,
                default_name: Optional[str],
                source_dict: dict[str, Any],
            ) -> list[Path]:
                """
                Build an ordered list of candidate paths. For relative paths specified in
                metadata, prefer resolution relative to the metadata file directory first,
                then fall back to CWD-based resolution, and finally to conventional
                sibling defaults (e.g., <index_base>.passages.idx / .jsonl).
                """
                candidates: list[Path] = []
                # 1) Primary path
                if primary:
                    p = Path(primary)
                    if p.is_absolute():
                        candidates.append(p)
                    else:
                        # Prefer metadata-relative resolution for relative paths
                        if metadata_file_path:
                            candidates.append(Path(metadata_file_path).parent / p)
                        # Also consider CWD-relative as a fallback for legacy layouts
                        candidates.append(Path.cwd() / p)
                # 2) metadata-relative explicit relative key (if present)
                if metadata_file_path and source_dict.get(relative_key):
                    candidates.append(Path(metadata_file_path).parent / source_dict[relative_key])
                # 3) metadata-relative standard sibling filename
                if metadata_file_path and default_name:
                    candidates.append(Path(metadata_file_path).parent / default_name)
                return candidates

            # Build candidate lists and pick first existing; otherwise keep last candidate for error message
            idx_default = f"{index_name_base}.passages.idx" if index_name_base else None
            idx_candidates = _resolve_candidates(
                index_file, "index_path_relative", idx_default, source
            )
            pas_default = f"{index_name_base}.passages.jsonl" if index_name_base else None
            pas_candidates = _resolve_candidates(passage_file, "path_relative", pas_default, source)

            def _pick_existing(cands: list[Path]) -> str:
                for c in cands:
                    if c.exists():
                        return str(c.resolve())
                # Fallback to last candidate (best guess) even if not exists; will error below
                return str(cands[-1].resolve()) if cands else ""

            index_file = _pick_existing(idx_candidates)
            passage_file = _pick_existing(pas_candidates)

            if not Path(index_file).exists():
                raise FileNotFoundError(f"Passage index file not found: {index_file}")

            with open(index_file, "rb") as f:
                offset_map: dict[str, int] = pickle.load(f)
                self.offset_maps[passage_file] = offset_map
                self.passage_files[passage_file] = passage_file
                self._total_count += len(offset_map)

    def get_passage(self, passage_id: str) -> dict[str, Any]:
        # Fast path: check each shard map (there are typically few shards).
        # This avoids building a massive combined dict while keeping lookups
        # bounded by the number of shards.
        for passage_file, offset_map in self.offset_maps.items():
            try:
                offset = offset_map[passage_id]
                with open(passage_file, encod
```

### Core Architecture Module: `packages/leann-core/src/leann/chat.py`
```
#!/usr/bin/env python3
"""
This file contains the chat generation logic for the LEANN project,
supporting different backends like Ollama, Hugging Face Transformers, and a simulation mode.
"""

import difflib
import logging
import os
from abc import ABC, abstractmethod
from typing import Any, Optional, cast

from .settings import (
    resolve_anthropic_api_key,
    resolve_anthropic_base_url,
    resolve_atlascloud_api_key,
    resolve_atlascloud_base_url,
    resolve_litellm_api_key,
    resolve_litellm_base_url,
    resolve_minimax_api_key,
    resolve_minimax_base_url,
    resolve_novita_api_key,
    resolve_novita_base_url,
    resolve_ollama_host,
    resolve_openai_api_key,
    resolve_openai_base_url,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def check_ollama_models(host: str) -> list[str]:
    """Check available Ollama models and return a list"""
    try:
        import requests

        response = requests.get(f"{host}/api/tags", timeout=5)
        if response.status_code == 200:
            data = response.json()
            return [model["name"] for model in data.get("models", [])]
        return []
    except Exception:
        return []


def check_ollama_model_exists_remotely(model_name: str) -> tuple[bool, list[str]]:
    """Check if a model exists in Ollama's remote library and return available tags

    Returns:
        (model_exists, available_tags): bool and list of matching tags
    """
    try:
        import re

        import requests

        # Split model name and tag
        if ":" in model_name:
            base_model, requested_tag = model_name.split(":", 1)
        else:
            base_model, requested_tag = model_name, None

        # First check if base model exists in library
        library_response = requests.get("https://ollama.com/library", timeout=8)
        if library_response.status_code != 200:
            return True, []  # Assume exists if can't check

        # Extract model names from library page
        models_in_library = re.findall(r'href="/library/([^"]+)"', library_response.text)

        if base_model not in models_in_library:
            return False, []  # Base model doesn't exist

        # If base model exists, get available tags
        tags_response = requests.get(f"https://ollama.com/library/{base_model}/tags", timeout=8)
        if tags_response.status_code != 200:
            return True, []  # Base model exists but can't get tags

        # Extract tags for this model - be more specific to avoid HTML artifacts
        tag_pattern = rf"{re.escape(base_model)}:[a-zA-Z0-9\.\-_]+"
        raw_tags = re.findall(tag_pattern, tags_response.text)

        # Clean up tags - remove HTML artifacts and duplicates
        available_tags = []
        seen = set()
        for tag in raw_tags:
            # Skip if it looks like HTML (contains < or >)
            if "<" in tag or ">" in tag:
                continue
            if tag not in seen:
                seen.add(tag)
                available_tags.append(tag)

        # Check if exact model exists
        if requested_tag is None:
            # User just requested base model, suggest tags
            return True, available_tags[:10]  # Return up to 10 tags
        else:
            exact_match = model_name in available_tags
            return exact_match, available_tags[:10]

    except Exception:
        pass

    # If scraping fails, assume model might exist (don't block user)
    return True, []


def search_ollama_models_fuzzy(query: str, available_models: list[str]) -> list[str]:
    """Use intelligent fuzzy search for Ollama models"""
    if not available_models:
        return []

    query_lower = query.lower()
    suggestions = []

    # 1. Exact matches first
    exact_matches = [m for m in available_models if query_lower == m.lower()]
    suggestions.extend(exact_matches)

    # 2. Starts with query
    starts_with = [
        m for m in available_models if m.lower().startswith(query_lower) and m not in suggestions
    ]
    suggestions.extend(starts_with)

    # 3. Contains query
    contains = [m for m in available_models if query_lower in m.lower() and m not in suggestions]
    suggestions.extend(contains)

    # 4. Base model name matching (remove version numbers)
    def get_base_name(model_name: str) -> str:
        """Extract base name without version (e.g., 'llama3:8b' -> 'llama3')"""
        return model_name.split(":")[0].split("-")[0]

    query_base = get_base_name(query_lower)
    base_matches = [
        m
        for m in available_models
        if get_base_name(m.lower()) == query_base and m not in suggestions
    ]
    suggestions.extend(base_matches)

    # 5. Family/variant matching
    model_families = {
        "llama": ["llama2", "llama3", "alpaca", "vicuna", "codellama"],
        "qwen": ["qwen", "qwen2", "qwen3"],
        "gemma": ["gemma", "gemma2"],
        "phi": ["phi", "phi2", "phi3"],
        "mistral": ["mistral", "mixtral", "openhermes"],
        "dolphin": ["dolphin", "openchat"],
        "deepseek": ["deepseek", "deepseek-coder"],
    }

    query_family = None
    for family, variants in model_families.items():
        if any(variant in query_lower for variant in variants):
            query_family = family
            break

    if query_family:
        family_variants = model_families[query_family]
        family_matches = [
            m
            for m in available_models
            if any(variant in m.lower() for variant in family_variants) and m not in suggestions
        ]
        suggestions.extend(family_matches)

    # 6. Use difflib for remaining fuzzy matches
    remaining_models = [m for m in available_models if m not in suggestions]
    difflib_matches = difflib.get_close_matches(query_lower, remaining_models, n=3, cutoff=0.4)
    suggestions.extend(difflib_matches)

    return suggestions[:8]  # Return top 8 suggestions


# Remove this function entirely - we don't need external API calls for Ollama


# Remove this too - no need for fallback


def suggest_similar_models(invalid_model: str, available_models: list[str]) -> list[str]:
    """Use difflib to find similar model names"""
    if not available_models:
        return []

    # Get close matches using fuzzy matching
    suggestions = difflib.get_close_matches(invalid_model, available_models, n=3, cutoff=0.3)
    return suggestions


def check_hf_model_exists(model_name: str) -> bool:
    """Quick check if HuggingFace model exists without downloading"""
    try:
        from huggingface_hub import model_info

        model_info(model_name)
        return True
    except Exception:
        return False


def get_popular_hf_models() -> list[str]:
    """Return a list of popular HuggingFace models for suggestions"""
    try:
        from huggingface_hub import list_models

        # Get popular text-generation models, sorted by downloads
        models = list_models(
            filter="text-generation",
            sort="downloads",
            direction=-1,
            limit=20,  # Get top 20 most downloaded
        )

        # Extract model names and filter for chat/conversation models
        model_names = []
        chat_keywords = ["chat", "instruct", "dialog", "conversation", "assistant"]

        for model in models:
            model_name = model.id if hasattr(model, "id") else str(model)
            # Prioritize models with chat-related keywords
            if any(keyword in model_name.lower() for keyword in chat_keywords):
                model_names.append(model_name)
            elif len(model_names) < 10:  # Fill up with other popular models
                model_names.append(model_name)

        return model_names[:10] if model_names else _get_fallback_hf_models()

    except Exception:
        # Fallback to static list if API call fails
        return _get_fallback_hf_models()


def _get_fallback_hf_models() -> list[str]:
    """Fallback list of popular HuggingFace models"""
    return [
        "microsoft/DialoGPT-medium",
        "microsoft/DialoGPT-large",
        "facebook/blenderbot-400M-distill",
        "microsoft/phi-2",
        "deepseek-ai/deepseek-llm-7b-chat",
        "microsoft/DialoGPT-small",
        "facebook/blenderbot_small-90M",
        "microsoft/phi-1_5",
        "facebook/opt-350m",
        "EleutherAI/gpt-neo-1.3B",
    ]


def search_hf_models_fuzzy(query: str, limit: int = 10) -> list[str]:
    """Use HuggingFace Hub's native fuzzy search for model suggestions"""
    try:
        from huggingface_hub import list_models

        # HF Hub's search is already fuzzy! It handles typos and partial matches
        models = list_models(
            search=query,
            filter="text-generation",
            sort="downloads",
            direction=-1,
            limit=limit,
        )

        model_names = [model.id if hasattr(model, "id") else str(model) for model in models]

        # If direct search doesn't return enough results, try some variations
        if len(model_names) < 3:
            # Try searching for partial matches or common variations
            variations = []

            # Extract base name (e.g., "gpt3" from "gpt-3.5")
            base_query = query.lower().replace("-", "").replace(".", "").replace("_", "")
            if base_query != query.lower():
                variations.append(base_query)

            # Try common model name patterns
            if "gpt" in query.lower():
                variations.extend(["gpt2", "gpt-neo", "gpt-j", "dialoGPT"])
            elif "llama" in query.lower():
                variations.extend(["llama2", "alpaca", "vicuna"])
            elif "bert" in query.lower():
                variations.extend(["roberta", "distilbert", "albert"])

            # Search with variations
            for var in variations[:2]:  # Limit to 2 variations to avoid too many API calls
                try:
                    var_models = list_models(
   
```

### Core Architecture Module: `packages/leann-core/src/leann/chunking_utils.py`
```
"""
Enhanced chunking utilities with AST-aware code chunking support.
Packaged within leann-core so installed wheels can import it reliably.
"""

import logging
from pathlib import Path
from typing import Any, Optional

from llama_index.core.node_parser import SentenceSplitter

logger = logging.getLogger(__name__)

# Flag to ensure AST token warning only shown once per session
_ast_token_warning_shown = False


def estimate_token_count(text: str) -> int:
    """
    Estimate token count for a text string.
    Uses conservative estimation: ~4 characters per token for natural text,
    ~1.2 tokens per character for code (worse tokenization).

    Args:
        text: Input text to estimate tokens for

    Returns:
        Estimated token count
    """
    try:
        import tiktoken

        encoder = tiktoken.get_encoding("cl100k_base")
        return len(encoder.encode(text))
    except ImportError:
        # Fallback: Conservative character-based estimation
        # Assume worst case for code: 1.2 tokens per character
        return int(len(text) * 1.2)


def calculate_safe_chunk_size(
    model_token_limit: int,
    overlap_size: int,
    chunking_mode: str = "traditional",
    safety_factor: float = 0.9,
) -> int:
    """
    Calculate safe chunk size accounting for overlap and safety margin.

    Args:
        model_token_limit: Maximum tokens supported by embedding model
        overlap_size: Overlap units (tokens for traditional, chars for AST)
        chunking_mode: "traditional" (tokens) or "ast" (characters)
        safety_factor: Safety margin (0.9 = 10% safety margin)

    Returns:
        Safe chunk size: tokens for traditional, characters for AST
    """
    safe_limit = int(model_token_limit * safety_factor)

    if chunking_mode == "traditional":
        # Traditional chunking uses tokens
        # Max chunk = chunk_size + overlap, so chunk_size = limit - overlap
        return max(1, safe_limit - overlap_size)
    else:  # AST chunking
        # AST uses characters, need to convert
        # Conservative estimate: 1.2 tokens per char for code
        overlap_chars = int(overlap_size * 3)  # ~3 chars per token for code
        safe_chars = int(safe_limit / 1.2)
        return max(1, safe_chars - overlap_chars)


def validate_chunk_token_limits(chunks: list[str], max_tokens: int = 512) -> tuple[list[str], int]:
    """
    Validate that chunks don't exceed token limits and truncate if necessary.

    Args:
        chunks: List of text chunks to validate
        max_tokens: Maximum tokens allowed per chunk

    Returns:
        Tuple of (validated_chunks, num_truncated)
    """
    validated_chunks = []
    num_truncated = 0

    for i, chunk in enumerate(chunks):
        estimated_tokens = estimate_token_count(chunk)

        if estimated_tokens > max_tokens:
            # Truncate chunk to fit token limit
            try:
                import tiktoken

                encoder = tiktoken.get_encoding("cl100k_base")
                tokens = encoder.encode(chunk)
                if len(tokens) > max_tokens:
                    truncated_tokens = tokens[:max_tokens]
                    truncated_chunk = encoder.decode(truncated_tokens)
                    validated_chunks.append(truncated_chunk)
                    num_truncated += 1
                    logger.warning(
                        f"Truncated chunk {i} from {len(tokens)} to {max_tokens} tokens "
                        f"(from {len(chunk)} to {len(truncated_chunk)} characters)"
                    )
                else:
                    validated_chunks.append(chunk)
            except ImportError:
                # Fallback: Conservative character truncation
                char_limit = int(max_tokens / 1.2)  # Conservative for code
                if len(chunk) > char_limit:
                    truncated_chunk = chunk[:char_limit]
                    validated_chunks.append(truncated_chunk)
                    num_truncated += 1
                    logger.warning(
                        f"Truncated chunk {i} from {len(chunk)} to {char_limit} characters "
                        f"(conservative estimate for {max_tokens} tokens)"
                    )
                else:
                    validated_chunks.append(chunk)
        else:
            validated_chunks.append(chunk)

    if num_truncated > 0:
        logger.warning(f"Truncated {num_truncated}/{len(chunks)} chunks to fit token limits")

    return validated_chunks, num_truncated


# Code file extensions supported by astchunk
CODE_EXTENSIONS = {
    ".py": "python",
    ".java": "java",
    ".cs": "csharp",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "typescript",
    ".jsx": "typescript",
}


def detect_code_files(documents, code_extensions=None) -> tuple[list, list]:
    """Separate documents into code files and regular text files."""
    if code_extensions is None:
        code_extensions = CODE_EXTENSIONS

    code_docs = []
    text_docs = []

    for doc in documents:
        file_path = doc.metadata.get("file_path", "") or doc.metadata.get("file_name", "")
        if file_path:
            file_ext = Path(file_path).suffix.lower()
            if file_ext in code_extensions:
                doc.metadata["language"] = code_extensions[file_ext]
                doc.metadata["is_code"] = True
                code_docs.append(doc)
            else:
                doc.metadata["is_code"] = False
                text_docs.append(doc)
        else:
            doc.metadata["is_code"] = False
            text_docs.append(doc)

    logger.info(f"Detected {len(code_docs)} code files and {len(text_docs)} text files")
    return code_docs, text_docs


def get_language_from_extension(file_path: str) -> Optional[str]:
    """Return language string from a filename/extension using CODE_EXTENSIONS."""
    ext = Path(file_path).suffix.lower()
    return CODE_EXTENSIONS.get(ext)


def _parse_ast_chunk_output(chunk: Any) -> tuple[str | None, dict[str, Any]]:
    """Normalize the various chunk output formats from ASTChunkBuilder.

    astchunk can return objects (with a ``.text`` attr), plain strings, or
    dicts (``{"content": ..., "metadata": ...}``).  This helper returns a
    uniform ``(text, metadata)`` pair regardless of the input shape.
    """
    if hasattr(chunk, "text"):
        return (str(chunk.text) if chunk.text else None, {})
    if isinstance(chunk, str):
        return (chunk, {})
    if isinstance(chunk, dict):
        meta = chunk.get("metadata", {})
        if "content" in chunk:
            return (chunk["content"], meta)
        if "text" in chunk:
            return (chunk["text"], meta)
        return (str(chunk), {})
    return (str(chunk), {})


def create_ast_chunks(
    documents,
    max_chunk_size: int = 512,
    chunk_overlap: int = 64,
    metadata_template: str = "default",
) -> list[dict[str, Any]]:
    """Create AST-aware chunks from code documents using astchunk.

    Falls back to traditional chunking if astchunk is unavailable.

    Returns:
        List of dicts with {"text": str, "metadata": dict}
    """
    try:
        from astchunk import ASTChunkBuilder  # optional dependency
    except ImportError as e:
        logger.error(f"astchunk not available: {e}")
        logger.info("Falling back to traditional chunking for code files")
        return create_traditional_chunks(documents, max_chunk_size, chunk_overlap)

    all_chunks = []
    for doc in documents:
        language = doc.metadata.get("language")
        if not language:
            logger.warning("No language detected; falling back to traditional chunking")
            all_chunks.extend(create_traditional_chunks([doc], max_chunk_size, chunk_overlap))
            continue

        try:
            # Warn once if AST chunk size + overlap might exceed common token limits
            # Note: Actual truncation happens at embedding time with dynamic model limits
            global _ast_token_warning_shown
            estimated_max_tokens = int(
                (max_chunk_size + chunk_overlap) * 1.2
            )  # Conservative estimate
            if estimated_max_tokens > 512 and not _ast_token_warning_shown:
                logger.warning(
                    f"AST chunk size ({max_chunk_size}) + overlap ({chunk_overlap}) = {max_chunk_size + chunk_overlap} chars "
                    f"may exceed 512 token limit (~{estimated_max_tokens} tokens estimated). "
                    f"Consider reducing --ast-chunk-size to {int(400 / 1.2)} or --ast-chunk-overlap to {int(50 / 1.2)}. "
                    f"Note: Chunks will be auto-truncated at embedding time based on your model's actual token limit."
                )
                _ast_token_warning_shown = True

            configs = {
                "max_chunk_size": max_chunk_size,
                "language": language,
                "metadata_template": metadata_template,
                "chunk_overlap": chunk_overlap if chunk_overlap > 0 else 0,
            }

            repo_metadata = {
                "file_path": doc.metadata.get("file_path", ""),
                "file_name": doc.metadata.get("file_name", ""),
                "source": doc.metadata.get("source", ""),
                "creation_date": doc.metadata.get("creation_date", ""),
                "last_modified_date": doc.metadata.get("last_modified_date", ""),
            }
            configs["repo_level_metadata"] = repo_metadata

            chunk_builder = ASTChunkBuilder(**configs)
            code_content = doc.get_content()
            if not code_content or not code_content.strip():
                logger.warning("Empty code content, skipping")
                continue

            chunks = chunk_builder.chunkify(code_content)
            for chunk in chunks:
                chunk_text, astchunk_metadata = _parse_ast_chunk_output(chunk)

                if chunk_text and chunk_text.strip():
                    # Extract document-level meta
```

### Core Architecture Module: `packages/leann-core/src/leann/cli.py`
```
import argparse
import asyncio
import contextlib
import hashlib
import io
import json
import os
import pickle
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Optional, Union

from llama_index.core import SimpleDirectoryReader
from llama_index.core.node_parser import SentenceSplitter
from tqdm import tqdm

from .api import Fts5BM25Index, LeannBuilder, LeannChat, LeannSearcher
from .embedding_server_manager import EmbeddingServerManager
from .interactive_utils import create_cli_session
from .registry import DEFAULT_INDEX_SCAN_DEPTH, iter_index_meta_files, register_project_directory
from .settings import (
    resolve_anthropic_base_url,
    resolve_atlascloud_api_key,
    resolve_atlascloud_base_url,
    resolve_litellm_api_key,
    resolve_litellm_base_url,
    resolve_minimax_api_key,
    resolve_minimax_base_url,
    resolve_ollama_host,
    resolve_openai_api_key,
    resolve_openai_base_url,
)
from .sync import DEFAULT_INDEX_EXTENSIONS, FileSynchronizer, parse_include_extensions


def _non_negative_int(value: str) -> int:
    parsed_value = int(value)
    if parsed_value < 0:
        raise argparse.ArgumentTypeError("must be non-negative")
    return parsed_value


def _default_embedding_model() -> str:
    """Pick a sensible default embedding model based on platform.

    | Platform   | Default model                                  |
    |------------|------------------------------------------------|
    | NVIDIA GPU | BAAI/bge-base-en-v1.5                          |
    | macOS      | sentence-transformers/all-MiniLM-L6-v2         |
    | Other/CPU  | sentence-transformers/all-MiniLM-L6-v2         |
    """

    try:
        import torch

        if torch.cuda.is_available():
            return "BAAI/bge-base-en-v1.5"
    except ImportError:
        pass

    # macOS (MPS or CPU) and all other platforms: lightweight model
    return "sentence-transformers/all-MiniLM-L6-v2"


def _normalize_path(path: str) -> str:
    """Return absolute path string for consistent keys."""
    if not path:
        return path
    return str(Path(path).resolve())


def _cleanup_path(path: Path) -> None:
    if path.is_dir():
        import shutil

        shutil.rmtree(path)
    elif path.exists():
        path.unlink()


def _existing_index_artifacts(index_dir: Path) -> bool:
    return (
        (index_dir / "documents.leann.meta.json").exists()
        and (index_dir / "documents.leann.passages.jsonl").exists()
        and (index_dir / "documents.leann.passages.idx").exists()
    )


def _publish_rebuilt_index(staging_dir: Path, index_dir: Path) -> None:
    """Publish a staged full rebuild, restoring the previous directory if publish fails."""
    backup_dir = index_dir.with_name(f".{index_dir.name}.backup-{uuid.uuid4().hex}")
    live_moved = False
    published = False
    try:
        if index_dir.exists():
            os.replace(index_dir, backup_dir)
            live_moved = True
        os.replace(staging_dir, index_dir)
        published = True
    except Exception:
        if published:
            _cleanup_path(index_dir)
        if live_moved and backup_dir.exists():
            os.replace(backup_dir, index_dir)
        raise
    else:
        if backup_dir.exists():
            _cleanup_path(backup_dir)


@contextlib.contextmanager
def suppress_cpp_output(suppress: bool = True):
    """Context manager to suppress C++ stdout/stderr output from FAISS/HNSW
    while preserving Python print() output.

    C++ native code writes directly to OS file descriptors (fd 1 / fd 2).
    Python print() goes through sys.stdout / sys.stderr, which are Python
    file objects.  We redirect the OS fds to /dev/null (silencing C++) but
    point sys.stdout / sys.stderr at copies of the *original* fds so that
    Python output still reaches the terminal.
    """
    if not suppress:
        yield
        return

    # 1. Duplicate the original OS file descriptors.
    #    May fail in no-console environments (e.g. pythonw, Windows GUI apps)
    #    where fd 1/2 are not valid — in that case, skip suppression.
    try:
        saved_stdout_fd = os.dup(1)
        saved_stderr_fd = os.dup(2)
    except OSError:
        yield
        return

    # 2. Build Python file objects that write to the saved (real) fds.
    #    closefd=False so closing these wrappers won't close the duped fds.
    py_stdout = io.TextIOWrapper(
        io.FileIO(saved_stdout_fd, mode="w", closefd=False), encoding=sys.stdout.encoding or "utf-8"
    )
    py_stderr = io.TextIOWrapper(
        io.FileIO(saved_stderr_fd, mode="w", closefd=False), encoding=sys.stderr.encoding or "utf-8"
    )

    old_sys_stdout = sys.stdout
    old_sys_stderr = sys.stderr

    try:
        # 3. Redirect OS-level fds to /dev/null → silences C++ output
        devnull = os.open(os.devnull, os.O_WRONLY)
        os.dup2(devnull, 1)
        os.dup2(devnull, 2)
        os.close(devnull)

        # 4. Point Python's sys.stdout/stderr at the real terminal
        sys.stdout = py_stdout
        sys.stderr = py_stderr

        yield
    finally:
        # 5. Restore everything
        #    Flush wrappers first (they still need the saved fds to be open)
        py_stdout.flush()
        py_stderr.flush()

        sys.stdout = old_sys_stdout
        sys.stderr = old_sys_stderr

        os.dup2(saved_stdout_fd, 1)
        os.dup2(saved_stderr_fd, 2)
        os.close(saved_stdout_fd)
        os.close(saved_stderr_fd)


def extract_pdf_text_with_pymupdf(file_path: str) -> str | None:
    """Extract text from PDF using PyMuPDF for better quality."""
    try:
        if os.path.getsize(file_path) == 0:
            # Empty file: nothing to extract, skip instead of letting
            # fitz.EmptyFileError abort the whole build.
            return ""

        import fitz  # PyMuPDF

        doc = fitz.open(file_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text
    except ImportError:
        # Fallback to default reader
        return None
    except Exception:
        # Skip corrupted PDFs instead of aborting the whole build
        return ""


def extract_pdf_text_with_pdfplumber(file_path: str) -> str | None:
    """Extract text from PDF using pdfplumber for better quality."""
    try:
        if os.path.getsize(file_path) == 0:
            # Empty file: nothing to extract, skip instead of aborting the build.
            return ""

        import pdfplumber

        text = ""
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""
        return text
    except ImportError:
        # Fallback to default reader
        return None
    except Exception:
        # Skip corrupted PDFs instead of aborting the whole build
        return ""


class LeannCLI:
    def __init__(self):
        # Always use project-local .leann directory (like .git)
        self.indexes_dir = Path.cwd() / ".leann" / "indexes"
        self.indexes_dir.mkdir(parents=True, exist_ok=True)

        # Default parser for documents
        self.node_parser = SentenceSplitter(
            chunk_size=256, chunk_overlap=128, separator=" ", paragraph_separator="\n\n"
        )

        # Code-optimized parser
        self.code_parser = SentenceSplitter(
            chunk_size=512,  # Larger chunks for code context
            chunk_overlap=50,  # Less overlap to preserve function boundaries
            separator="\n",  # Split by lines for code
            paragraph_separator="\n\n",  # Preserve logical code blocks
        )

    def get_index_path(self, index_name: str) -> str:
        index_dir = self.indexes_dir / index_name
        return str(index_dir / "documents.leann")

    def index_exists(self, index_name: str) -> bool:
        index_dir = self.indexes_dir / index_name
        meta_file = index_dir / "documents.leann.meta.json"
        return meta_file.exists()

    def create_parser(self) -> argparse.ArgumentParser:
        parser = argparse.ArgumentParser(
            prog="leann",
            description="The smallest vector index in the world. RAG Everything with LEANN!",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
Examples:
  leann build my-docs --docs ./documents                                  # Build index from directory
  leann build my-code --docs ./src ./tests ./config                      # Build index from multiple directories
  leann build my-files --docs ./file1.py ./file2.txt ./docs/             # Build index from files and directories
  leann build my-mixed --docs ./readme.md ./src/ ./config.json           # Build index from mixed files/dirs
  leann build my-ppts --docs ./ --file-types .pptx,.pdf                  # Index only PowerPoint and PDF files
  leann search my-docs "query"                                           # Search in my-docs index
  leann ask my-docs "question"                                           # Ask my-docs index
  leann react my-docs "complex question"                                 # Use ReAct agent for multiturn retrieval
  leann index-browser chrome                                             # Index Chrome browser history
  leann index-email                                                      # Index Apple Mail
  leann index-imessage                                                   # Index iMessage conversations
  leann index-chatgpt --export-path ~/chatgpt-export.zip                 # Index ChatGPT export
  leann list                                                             # List all stored indexes
  leann remove my-docs                                                   # Remove an index (local first, then global)
            """,
        )

        # Global verbosity options
        verbosity_group = parser.add_mutually_exclusive_group()
        verbosity_group.add_argument(
            "-v",
            "--verbose",
            action="st
```

### Core Architecture Module: `packages/leann-core/src/leann/embedding_compute.py`
```
"""
Unified embedding computation module
Consolidates all embedding computation logic using SentenceTransformer
Preserves all optimization parameters to ensure performance
"""

import json
import logging
import os
import subprocess
import time
from typing import Any, Optional, Protocol, cast

import numpy as np

from .settings import resolve_ollama_host, resolve_openai_api_key, resolve_openai_base_url

# torch and tiktoken are imported lazily inside the functions that use them, so
# `import leann` (e.g. for MCP search over an existing index, BM25-only flows,
# or non-embedding utilities) doesn't pull torch's ~1 GB of state into memory.

# Set up logger with proper level
logger = logging.getLogger(__name__)
LOG_LEVEL = os.getenv("LEANN_LOG_LEVEL", "WARNING").upper()
log_level = getattr(logging, LOG_LEVEL, logging.WARNING)
logger.setLevel(log_level)


class _SentenceTransformerLike(Protocol):
    def eval(self) -> Any: ...
    def parameters(self) -> Any: ...
    def encode(self, *args: Any, **kwargs: Any) -> Any: ...
    def half(self) -> Any: ...


# Token limit registry for embedding models
# Used as fallback when dynamic discovery fails (e.g., LM Studio, OpenAI)
# Ollama models use dynamic discovery via /api/show
EMBEDDING_MODEL_LIMITS = {
    # Nomic models (common across servers)
    "nomic-embed-text": 2048,  # Corrected from 512 - verified via /api/show
    "nomic-embed-text-v1.5": 2048,
    "nomic-embed-text-v2": 512,
    # Other embedding models
    "mxbai-embed-large": 512,
    "all-minilm": 512,
    "bge-m3": 8192,
    "snowflake-arctic-embed": 512,
    # OpenAI models
    "text-embedding-3-small": 8192,
    "text-embedding-3-large": 8192,
    "text-embedding-ada-002": 8192,
}

# Runtime cache for dynamically discovered token limits
# Key: (model_name, base_url), Value: token_limit
# Prevents repeated SDK/API calls for the same model
_token_limit_cache: dict[tuple[str, str], int] = {}


def get_model_token_limit(
    model_name: str,
    base_url: Optional[str] = None,
    default: int = 2048,
) -> int:
    """
    Get token limit for a given embedding model.
    Uses hybrid approach: dynamic discovery for Ollama, registry fallback for others.
    Caches discovered limits to prevent repeated API/SDK calls.

    Args:
        model_name: Name of the embedding model
        base_url: Base URL of the embedding server (for dynamic discovery)
        default: Default token limit if model not found

    Returns:
        Token limit for the model in tokens
    """
    # Check cache first to avoid repeated SDK/API calls
    cache_key = (model_name, base_url or "")
    if cache_key in _token_limit_cache:
        cached_limit = _token_limit_cache[cache_key]
        logger.debug(f"Using cached token limit for {model_name}: {cached_limit}")
        return cached_limit

    # Try Ollama dynamic discovery if base_url provided
    if base_url:
        # Detect Ollama servers by port or "ollama" in URL
        if "11434" in base_url or "ollama" in base_url.lower():
            limit = _query_ollama_context_limit(model_name, base_url)
            if limit:
                _token_limit_cache[cache_key] = limit
                return limit

        # Try LM Studio SDK discovery
        if "1234" in base_url or "lmstudio" in base_url.lower() or "lm.studio" in base_url.lower():
            # Convert HTTP to WebSocket URL
            ws_url = base_url.replace("https://", "wss://").replace("http://", "ws://")
            # Remove /v1 suffix if present
            if ws_url.endswith("/v1"):
                ws_url = ws_url[:-3]

            limit = _query_lmstudio_context_limit(model_name, ws_url)
            if limit:
                _token_limit_cache[cache_key] = limit
                return limit

    # Fallback to known model registry with version handling (from PR #154)
    # Handle versioned model names (e.g., "nomic-embed-text:latest" -> "nomic-embed-text")
    base_model_name = model_name.split(":")[0]

    # Check exact match first
    if model_name in EMBEDDING_MODEL_LIMITS:
        limit = EMBEDDING_MODEL_LIMITS[model_name]
        _token_limit_cache[cache_key] = limit
        return limit

    # Check base name match
    if base_model_name in EMBEDDING_MODEL_LIMITS:
        limit = EMBEDDING_MODEL_LIMITS[base_model_name]
        _token_limit_cache[cache_key] = limit
        return limit

    # Check partial matches for common patterns
    for known_model, registry_limit in EMBEDDING_MODEL_LIMITS.items():
        if known_model in base_model_name or base_model_name in known_model:
            _token_limit_cache[cache_key] = registry_limit
            return registry_limit

    # Default fallback
    logger.warning(f"Unknown model '{model_name}', using default {default} token limit")
    _token_limit_cache[cache_key] = default
    return default


def truncate_to_token_limit(texts: list[str], token_limit: int) -> list[str]:
    """
    Truncate texts to fit within token limit using tiktoken.

    Args:
        texts: List of text strings to truncate
        token_limit: Maximum number of tokens allowed

    Returns:
        List of truncated texts (same length as input)
    """
    if not texts:
        return []

    import tiktoken

    # Use tiktoken with cl100k_base encoding
    enc = tiktoken.get_encoding("cl100k_base")

    truncated_texts = []
    truncation_count = 0
    total_tokens_removed = 0
    max_original_length = 0

    for i, text in enumerate(texts):
        tokens = enc.encode(text)
        original_length = len(tokens)

        if original_length <= token_limit:
            # Text is within limit, keep as is
            truncated_texts.append(text)
        else:
            # Truncate to token_limit
            truncated_tokens = tokens[:token_limit]
            truncated_text = enc.decode(truncated_tokens)
            truncated_texts.append(truncated_text)

            # Track truncation statistics
            truncation_count += 1
            tokens_removed = original_length - token_limit
            total_tokens_removed += tokens_removed
            max_original_length = max(max_original_length, original_length)

            # Log individual truncation at WARNING level (first few only)
            if truncation_count <= 3:
                logger.warning(
                    f"Text {i + 1} truncated: {original_length} → {token_limit} tokens "
                    f"({tokens_removed} tokens removed)"
                )
            elif truncation_count == 4:
                logger.warning("Further truncation warnings suppressed...")

    # Log summary at INFO level
    if truncation_count > 0:
        logger.warning(
            f"Truncation summary: {truncation_count}/{len(texts)} texts truncated "
            f"(removed {total_tokens_removed} tokens total, longest was {max_original_length} tokens)"
        )
    else:
        logger.debug(
            f"No truncation needed - all {len(texts)} texts within {token_limit} token limit"
        )

    return truncated_texts


def _query_ollama_context_limit(model_name: str, base_url: str) -> Optional[int]:
    """
    Query Ollama /api/show for model context limit.

    Args:
        model_name: Name of the Ollama model
        base_url: Base URL of the Ollama server

    Returns:
        Context limit in tokens if found, None otherwise
    """
    try:
        import requests

        response = requests.post(
            f"{base_url}/api/show",
            json={"name": model_name},
            timeout=5,
        )
        if response.status_code == 200:
            data = response.json()
            if "model_info" in data:
                # Look for *.context_length in model_info
                for key, value in data["model_info"].items():
                    if "context_length" in key and isinstance(value, int):
                        logger.info(f"Detected {model_name} context limit: {value} tokens")
                        return value
    except Exception as e:
        logger.debug(f"Failed to query Ollama context limit: {e}")

    return None


def _query_lmstudio_context_limit(model_name: str, base_url: str) -> Optional[int]:
    """
    Query LM Studio SDK for model context length via Node.js subprocess.

    Args:
        model_name: Name of the LM Studio model
        base_url: Base URL of the LM Studio server (WebSocket format, e.g., "ws://localhost:1234")

    Returns:
        Context limit in tokens if found, None otherwise
    """
    # Inline JavaScript using @lmstudio/sdk
    # Note: Load model temporarily for metadata, then unload to respect JIT auto-evict
    js_code = f"""
    const {{ LMStudioClient }} = require('@lmstudio/sdk');
    (async () => {{
        try {{
            const client = new LMStudioClient({{ baseUrl: '{base_url}' }});
            const model = await client.embedding.load('{model_name}', {{ verbose: false }});
            const contextLength = await model.getContextLength();
            await model.unload();  // Unload immediately to respect JIT auto-evict settings
            console.log(JSON.stringify({{ contextLength, identifier: '{model_name}' }}));
        }} catch (error) {{
            console.error(JSON.stringify({{ error: error.message }}));
            process.exit(1);
        }}
    }})();
    """

    try:
        # Set NODE_PATH to include global modules for @lmstudio/sdk resolution
        env = os.environ.copy()

        # Try to get npm global root (works with nvm, brew node, etc.)
        try:
            npm_root = subprocess.run(
                ["npm", "root", "-g"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if npm_root.returncode == 0:
                global_modules = npm_root.stdout.strip()
                # Append to existing NODE_PATH if present
                existing_node_path = env.get("NODE_PATH", "")
                env["NODE_PATH"] = (
                    f"{global_modules}:{existing_node_path}"
   
```

### Core Architecture Module: `packages/leann-core/src/leann/embedding_server_manager.py`
```
import atexit
import contextlib
import hashlib
import json
import logging
import os
import socket
import subprocess
import sys
import threading
import time
from pathlib import Path
from typing import Any, Optional

from .settings import encode_provider_options

# Lightweight, self-contained server manager with no cross-process inspection

# Set up logging based on environment variable
LOG_LEVEL = os.getenv("LEANN_LOG_LEVEL", "WARNING").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(levelname)s - %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)
_LOCK_STALE_SECONDS = 600
_FLOCK_TIMEOUT_SECONDS = 300
_REGISTRY_LOCKS_GUARD = threading.Lock()
_REGISTRY_LOCKS: dict[str, threading.Lock] = {}


def _flock_acquire(lock_file) -> None:
    """Acquire an exclusive file lock for cross-process synchronisation.

    Uses ``fcntl.flock`` on POSIX and ``msvcrt.locking`` on Windows.  Both are
    auto-released when the file descriptor is closed or the owning process
    exits, so a holder crash does not permanently block other waiters.
    """
    try:
        import fcntl

        fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        return
    except ImportError:
        pass
    except OSError:
        return

    if sys.platform != "win32":
        return
    import msvcrt

    # msvcrt.locking operates on byte ranges; ensure the file has content.
    lock_file.seek(0, 2)
    if lock_file.tell() == 0:
        lock_file.write("\n")
        lock_file.flush()
    lock_file.seek(0)

    deadline = time.monotonic() + _FLOCK_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        try:
            msvcrt.locking(lock_file.fileno(), msvcrt.LK_NBLCK, 1)
            return
        except OSError:
            time.sleep(0.5)
    logger.warning(
        "Cross-process file lock timed out after %ds; proceeding without lock",
        _FLOCK_TIMEOUT_SECONDS,
    )


def _flock_release(lock_file) -> None:
    """Release the file lock acquired by :func:`_flock_acquire`."""
    try:
        import fcntl

        fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        return
    except ImportError:
        pass
    except OSError:
        return

    if sys.platform != "win32":
        return
    try:
        import msvcrt

        lock_file.seek(0)
        msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
    except (ImportError, OSError):
        pass


def _is_colab_environment() -> bool:
    """Check if we're running in Google Colab environment."""
    return "COLAB_GPU" in os.environ or "COLAB_TPU" in os.environ


def _get_available_port(start_port: int = 5557) -> int:
    """Get an available port starting from start_port."""
    port = start_port
    while port < start_port + 100:  # Try up to 100 ports
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("localhost", port))
                return port
        except OSError:
            port += 1
    raise RuntimeError(f"No available ports found in range {start_port}-{start_port + 100}")


def _check_port(port: int) -> bool:
    """Check if a port is in use"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("localhost", port)) == 0


def _pid_is_alive(pid: int) -> bool:
    """Best-effort liveness check for a process id."""
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


# Note: All cross-process scanning helpers removed for simplicity


def _safe_resolve(path: Path) -> str:
    """Resolve paths safely even if the target does not yet exist."""
    try:
        return str(path.resolve(strict=False))
    except Exception:
        return str(path)


def _safe_stat_signature(path: Path) -> dict:
    """Return a lightweight signature describing the current state of a path."""
    signature: dict[str, object] = {"path": _safe_resolve(path)}
    try:
        stat = path.stat()
    except FileNotFoundError:
        signature["missing"] = True
    except Exception as exc:  # pragma: no cover - unexpected filesystem errors
        signature["error"] = str(exc)
    else:
        signature["mtime_ns"] = stat.st_mtime_ns
        signature["size"] = stat.st_size
    return signature


def _build_passages_signature(passages_file: Optional[str]) -> Optional[dict]:
    """Collect modification signatures for metadata and referenced passage files."""
    if not passages_file:
        return None

    meta_path = Path(passages_file)
    signature: dict[str, object] = {"meta": _safe_stat_signature(meta_path)}

    try:
        with meta_path.open(encoding="utf-8") as fh:
            meta = json.load(fh)
    except FileNotFoundError:
        signature["meta_missing"] = True
        signature["sources"] = []
        return signature
    except json.JSONDecodeError as exc:
        signature["meta_error"] = f"json_error:{exc}"
        signature["sources"] = []
        return signature
    except Exception as exc:  # pragma: no cover - unexpected errors
        signature["meta_error"] = str(exc)
        signature["sources"] = []
        return signature

    base_dir = meta_path.parent
    seen_paths: set[str] = set()
    source_signatures: list[dict[str, object]] = []

    for source in meta.get("passage_sources", []):
        for key, kind in (
            ("path", "passages"),
            ("path_relative", "passages"),
            ("index_path", "index"),
            ("index_path_relative", "index"),
        ):
            raw_path = source.get(key)
            if not raw_path:
                continue
            candidate = Path(raw_path)
            if not candidate.is_absolute():
                candidate = base_dir / candidate
            resolved = _safe_resolve(candidate)
            if resolved in seen_paths:
                continue
            seen_paths.add(resolved)
            sig = _safe_stat_signature(candidate)
            sig["kind"] = kind
            source_signatures.append(sig)

    signature["sources"] = source_signatures
    return signature


# Note: All cross-process scanning helpers removed for simplicity


class EmbeddingServerManager:
    """
    A simplified manager for embedding server processes that avoids complex update mechanisms.
    """

    def __init__(self, backend_module_name: str):
        """
        Initializes the manager for a specific backend.

        Args:
            backend_module_name (str): The full module name of the backend's server script.
                                       e.g., "leann_backend_diskann.embedding_server"
        """
        self.backend_module_name = backend_module_name
        self.server_process: Optional[subprocess.Popen] = None
        self.server_port: Optional[int] = None
        # Track last-started config for in-process reuse only
        self._server_config: Optional[dict] = None
        self._daemon_mode = False
        self._registry_path: Optional[Path] = None
        self._atexit_registered = False
        # Also register a weakref finalizer to ensure cleanup when manager is GC'ed
        try:
            import weakref

            self._finalizer = weakref.finalize(self, self._finalize_process)
        except Exception:
            self._finalizer = None

    def start_server(
        self,
        port: int,
        model_name: str,
        embedding_mode: str = "sentence-transformers",
        **kwargs,
    ) -> tuple[bool, int]:
        """Start the embedding server."""
        # passages_file may be present in kwargs for server CLI, but we don't need it here
        provider_options = kwargs.pop("provider_options", None)
        passages_file = kwargs.get("passages_file", "")
        distance_metric = kwargs.get("distance_metric", "")
        use_daemon = bool(kwargs.get("use_daemon", True))
        daemon_ttl_seconds = int(kwargs.get("daemon_ttl_seconds", 900))

        config_signature = self._build_config_signature(
            model_name=model_name,
            embedding_mode=embedding_mode,
            provider_options=provider_options,
            passages_file=passages_file,
            distance_metric=distance_metric,
        )

        # If this manager already has a live server, just reuse it
        if (
            self.server_process
            and self.server_process.poll() is None
            and self.server_port
            and self._server_config == config_signature
        ):
            logger.info("Reusing in-process server")
            return True, self.server_port

        # Configuration changed, stop existing ephemeral server before starting a new one
        if self.server_process and self.server_process.poll() is None and not self._daemon_mode:
            logger.info("Existing server configuration differs; restarting embedding server")
            self.stop_server()

        # Reuse an already-running daemon from registry if possible.
        if use_daemon and not _is_colab_environment():
            with self._registry_lock(config_signature):
                adopted = self._adopt_registered_server(config_signature)
                if adopted is not None:
                    self.server_process = None
                    self.server_port = adopted
                    self._server_config = config_signature
                    self._daemon_mode = True
                    return True, adopted

        # For Colab environment, use a different strategy
        if _is_colab_environment():
            logger.info("Detected Colab environment, using alternative startup strategy")
            return self._start_server_colab(
                port,
                model_name,
                embedding_mode,
                config_signature=config_signature,
                provider_options=provider_options,
                **kwargs,
            )

        # Always pick a fresh available port
        try:
            actual_port = _get_avai
```

### Core Architecture Module: `packages/leann-core/src/leann/integrations/__init__.py`
```
from .llamaindex import LeannHybridRetriever, LeannRetriever

__all__ = ["LeannHybridRetriever", "LeannRetriever"]

```

### Core Architecture Module: `packages/leann-core/src/leann/integrations/llamaindex.py`
```
from typing import Any

from llama_index.core.retrievers import BaseRetriever
from llama_index.core.schema import NodeWithScore, QueryBundle, TextNode

from leann.api import LeannSearcher


def _results_to_nodes(results: list) -> list[NodeWithScore]:
    nodes = []

    for r in results:
        metadata = getattr(r, "metadata", {})
        if not isinstance(metadata, dict):
            metadata = {}

        node = TextNode(text=r.text, id_=r.id, metadata=metadata)

        nodes.append(NodeWithScore(node=node, score=r.score))

    return nodes


class LeannRetriever(BaseRetriever):
    """LlamaIndex Retriever for LEANN"""

    def __init__(
        self,
        index_path: str,
        top_k: int = 10,
        complexity: int = 64,
        recompute_embeddings: bool = True,
        **searcher_kwargs: Any,
    ):
        super().__init__()
        self._top_k = top_k
        self._complexity = complexity
        self._recompute_embeddings = recompute_embeddings
        self._searcher = LeannSearcher(index_path, **searcher_kwargs)

    def _retrieve(self, query_bundle: QueryBundle) -> list[NodeWithScore]:
        """Retrieve nodes from LEANN index using pure vector search"""
        results = self._searcher.search(
            query=query_bundle.query_str,
            top_k=self._top_k,
            complexity=self._complexity,
            recompute_embeddings=self._recompute_embeddings,
        )

        return _results_to_nodes(results)

    async def _aretrieve(self, query_bundle: QueryBundle) -> list[NodeWithScore]:
        """Async retrieve"""

        return self._retrieve(query_bundle)


class LeannHybridRetriever(BaseRetriever):
    """LlamaIndex retriever with hybrid search (vector + BM25).
    Parameters
    ----------
    index_path : str
        Path to LEANN index file (*.leann)
    top_k : int
        Number of results to return (default 10)
    bm25_weight : float
        Weight for BM25 (keyword) search, range [0, 1] (default 0.3)
        - 0.0 = pure vector search (no keywords)
        - 0.3 = 70% vector, 30% keywords (recommended)
        - 0.5 = balanced hybrid search
        - 1.0 = pure keyword search (no vectors)
    Notes
    -----
    Internally converts `bm25_weight` to LEANN's `gemma` parameter:
        gemma = 1.0 - bm25_weight
    """

    def __init__(
        self,
        index_path: str,
        top_k: int = 10,
        bm25_weight: float = 0.3,
        complexity: int = 64,
        recompute_embeddings: bool = True,
        **searcher_kwargs: Any,
    ):
        super().__init__()

        self._bm25_weight = max(0.0, min(1.0, bm25_weight))
        self._gemma = 1.0 - self._bm25_weight
        self._top_k = top_k
        self._complexity = complexity
        self._recompute = recompute_embeddings
        self._searcher = LeannSearcher(index_path, **searcher_kwargs)

    def _retrieve(self, query_bundle: QueryBundle) -> list[NodeWithScore]:
        """Retrieve nodes from LEANN index using hybrid search"""

        results = self._searcher.search(
            query=query_bundle.query_str,
            top_k=self._top_k,
            complexity=self._complexity,
            recompute_embeddings=self._recompute,
            gemma=self._gemma,
        )

        return _results_to_nodes(results)

    async def _aretrieve(self, query_bundle: QueryBundle) -> list[NodeWithScore]:
        """Async retrieve"""

        return self._retrieve(query_bundle)

```

### Core Architecture Module: `packages/leann-core/src/leann/interactive_utils.py`
```
"""
Interactive session utilities for LEANN applications.

Provides shared readline functionality and command handling across
CLI, API, and RAG example interactive modes.
"""

import atexit
import os
from pathlib import Path
from types import ModuleType
from typing import Callable, Optional

# Try to import readline with fallback for Windows
HAS_READLINE = False
readline: ModuleType | None = None
try:
    import readline

    HAS_READLINE = True
except ImportError:
    # Windows doesn't have readline by default
    pass


class InteractiveSession:
    """Manages interactive session with optional readline support and common commands."""

    def __init__(
        self,
        history_name: str,
        prompt: str = "You: ",
        welcome_message: str = "",
    ):
        """
        Initialize interactive session with optional readline support.

        Args:
            history_name: Name for history file (e.g., "cli", "api_chat")
                         (ignored if readline not available)
            prompt: Input prompt to display
            welcome_message: Message to show when starting session

        Note:
            On systems without readline (e.g., Windows), falls back to basic input()
            with limited functionality (no history, no line editing).
        """
        self.history_name = history_name
        self.prompt = prompt
        self.welcome_message = welcome_message
        self._setup_complete = False

    def setup_readline(self):
        """Setup readline with history support (if available)."""
        if self._setup_complete:
            return

        if not HAS_READLINE:
            # Readline not available (likely Windows), skip setup
            self._setup_complete = True
            return
        rl = readline
        if rl is None:
            self._setup_complete = True
            return

        # History file setup
        history_dir = Path.home() / ".leann" / "history"
        history_dir.mkdir(parents=True, exist_ok=True)
        history_file = history_dir / f"{self.history_name}.history"

        # Load history if exists
        try:
            rl.read_history_file(str(history_file))
            rl.set_history_length(1000)
        except (FileNotFoundError, FileExistsError, OSError):
            pass

        # Save history on exit
        atexit.register(rl.write_history_file, str(history_file))

        # Optional: Enable vi editing mode (commented out by default)
        # readline.parse_and_bind("set editing-mode vi")

        self._setup_complete = True

    def _show_help(self):
        """Show available commands."""
        print("Commands:")
        print("  quit/exit/q - Exit the chat")
        print("  help - Show this help message")
        print("  clear - Clear screen")
        print("  history - Show command history")

    def _show_history(self):
        """Show command history."""
        if not HAS_READLINE:
            print("  History not available (readline not supported on this system)")
            return
        rl = readline
        if rl is None:
            print("  History not available (readline not supported on this system)")
            return

        history_length = rl.get_current_history_length()
        if history_length == 0:
            print("  No history available")
            return

        for i in range(history_length):
            item = rl.get_history_item(i + 1)
            if item:
                print(f"  {i + 1}: {item}")

    def get_user_input(self) -> Optional[str]:
        """
        Get user input with readline support.

        Returns:
            User input string, or None if EOF (Ctrl+D)
        """
        try:
            return input(self.prompt).strip()
        except KeyboardInterrupt:
            print("\n(Use 'quit' to exit)")
            return ""  # Return empty string to continue
        except EOFError:
            print("\nGoodbye!")
            return None

    def run_interactive_loop(self, handler_func: Callable[[str], None]):
        """
        Run the interactive loop with a custom handler function.

        Args:
            handler_func: Function to handle user input that's not a built-in command
                         Should accept a string and handle the user's query
        """
        self.setup_readline()

        if self.welcome_message:
            print(self.welcome_message)

        while True:
            user_input = self.get_user_input()

            if user_input is None:  # EOF (Ctrl+D)
                break

            if not user_input:  # Empty input or KeyboardInterrupt
                continue

            # Handle built-in commands
            command = user_input.lower()
            if command in ["quit", "exit", "q"]:
                print("Goodbye!")
                break
            elif command == "help":
                self._show_help()
            elif command == "clear":
                os.system("clear" if os.name != "nt" else "cls")
            elif command == "history":
                self._show_history()
            else:
                # Regular user input - pass to handler
                try:
                    handler_func(user_input)
                except Exception as e:
                    print(f"Error: {e}")


def create_cli_session(index_name: str) -> InteractiveSession:
    """Create an interactive session for CLI usage."""
    return InteractiveSession(
        history_name=index_name,
        prompt="\nYou: ",
        welcome_message="LEANN Assistant ready! Type 'quit' to exit, 'help' for commands\n"
        + "=" * 40,
    )


def create_api_session() -> InteractiveSession:
    """Create an interactive session for API chat."""
    return InteractiveSession(
        history_name="api_chat",
        prompt="You: ",
        welcome_message="Leann Chat started (type 'quit' to exit, 'help' for commands)\n"
        + "=" * 40,
    )


def create_rag_session(app_name: str, data_description: str) -> InteractiveSession:
    """Create an interactive session for RAG examples."""
    return InteractiveSession(
        history_name=f"{app_name}_rag",
        prompt="You: ",
        welcome_message=f"[Interactive Mode] Chat with your {data_description} data!\nType 'quit' or 'exit' to stop, 'help' for commands.\n"
        + "=" * 40,
    )

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #424** (2026-09-26): **build_index_from_arrays loses passages when custom IDs follow add_text**
  *Symptoms*: ### What happened?  `build_index_from_arrays()` accepts document IDs with precomputed embeddings. When the same builder has already received real passages through `add_text()`, the build completes but searches cannot return those passages if the supplied IDs differ from the IDs generated by `add_text()`. This affects a common use of the array API: keeping stable IDs from another data source while reusing embeddings computed elsewhere.  The passage JSONL and offset map are written from each chunk's generated ID (`0`, `1`, ...). The vector backend and ID map are built from the explicit `ids` argument (`doc-a`, `doc-b`, ...). Search receives the vector IDs, cannot find matching passages, and skips those hits. Existing array-build examples use `range(n)`, so both sets of IDs happen to match.  Expected: each supplied ID identifies both its embedding and its passage. Actual: the index builds, but the corresponding text is absent from search results. #422 aligns the stored IDs and adds a regression test for this path.  ### How to reproduce  Using a consistent embedding model, add text first and then build from vectors with non-sequential IDs:  ```python from leann.api import LeannBuilder, LeannSearcher, compute_embeddings  texts = ["Alpha document", "Beta document"] model = "facebook/contriever" embeddings = compute_embeddings(     texts, model_name=model, mode="sentence-transformers",     use_server=False, is_build=True, ) builder = LeannBuilder(     backend_name="hnsw", embedding_

- **Issue #423** (2026-09-26): **MCP --base-dir is ignored when launched outside the index project**
  *Symptoms*: ### What happened?  `leann_mcp --base-dir <project>` accepts a project directory, but the MCP tools still resolve indexes against the directory where the server was launched. A project-local index therefore appears to be missing when an editor or MCP host starts the server elsewhere. `leann_status` looks under the launch directory, and search, list, and build spawn the CLI there as well. The existing-index metadata lookup used by `leann_build` follows the same incorrect path.  The option was added in #339 to address this working-directory problem. Later MCP changes introduced a shared `_run_leann()` helper without carrying over its `cwd` argument, while `handle_status()` and `handle_build()` kept using `Path.cwd()`. This is a regression of that behavior, rather than the Windows executable lookup reported in #320.  Expected: every MCP tool uses the directory supplied through `--base-dir` for both CLI calls and local index files. Actual: the option is parsed, but the tools use the launch directory. A focused fix and cross-directory regression test are in #421.  ### How to reproduce  1. From a project directory, build an index named `docs` so `<project>/.leann/indexes/docs/documents.leann.meta.json` exists. 2. Change to a different directory and start `leann_mcp --base-dir <project>`. 3. Send this MCP request on stdin:  ```json {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"leann_status","arguments":{"index_name":"docs"}}} ```  The response says `Index 'docs' no

- **Issue #385** (2026-07-29): **leann-backend-hnsw 0.3.7: Python 3.14 wheels published for Windows only; macOS/Linux installs fail with a misleading error**
  *Symptoms*: ### What happened?  Hey guys first issue I post here let me know if I crossed any guideline, Love the product congratulations!!   ## Summary  On Python 3.14, `pip`/`uv install leann` fails on macOS (arm64 & x86_64) and Linux because **`leann-backend-hnsw==0.3.7` only ships a `cp314` wheel for `win_amd64`** — no macOS or Linux `cp314` wheels exist. All other platforms stop at `cp313`.  Two things combine to make this a bad experience:  1. **The `cp314` build matrix is incomplete** — only Windows got a 3.14 wheel. 2. **The package declares no `requires-python`**, so resolvers happily select `0.3.7` for a 3.14 interpreter and *then* fail to find a compatible wheel, producing a confusing "only has wheels for `win_amd64`" message instead of a clean "requires Python < 3.14".  ## Environment  - OS: macOS (Apple Silicon, `macosx_26_0_arm64`); also reproduces on Intel macOS and Linux - Python: 3.14 - Installer: `uv` (also reproduces with `pip`) - Package: `leann` → `leann-backend-hnsw==0.3.7`  ## Steps to reproduce  ```bash uv venv --python 3.14 .venv uv pip install leann --python .venv/bin/python # or:  uv add leann-backend-hnsw ```  ## Actual result  ``` error: Distribution `leann-backend-hnsw==0.3.7 @ registry+https://pypi.org/simple` can't be installed because it doesn't have a source distribution or wheel for the current platform  hint: You're on macOS (`macosx_26_0_arm64`), but `leann-backend-hnsw` (v0.3.7) only has wheels for the following platform: `win_amd64`; ... ```  ## Exp

- **Issue #381** (2026-06-26): **ReActAgent.run aborts the investigation on the first zero-result tool return at iteration >= 2 — single transient web failure or one narrow query produces an ungrounded answer**
  *Symptoms*: ### What happened?  `ReActAgent.run` at [`packages/leann-core/src/leann/react_agent.py#L286-L298`](https://github.com/StarTrail-org/LEANN/blob/55ff236dc4b5/packages/leann-core/src/leann/react_agent.py#L286-L298) terminates the entire investigation the first time any tool returns 0 results on iteration 2 or later, and falls through to "ask the LLM for its best answer based on what it knows" — i.e. an ungrounded answer with no source citation. The guard does not require N consecutive zeros and does not distinguish transient failures (web search 502, rate-limit, network blip) from legitimately empty results.  ```python # react_agent.py:286-298 — buggy early-exit if results_count == 0 and iteration >= 2:     logger.warning("No results found, asking LLM for final answer...")     final_prompt = f"""Based on the previous searches, provide your best answer to the question.  Question: {question}  Previous searches and results: {chr(10).join(all_context)}  Since no new results were found, provide your final answer based on what you know. """     final_answer = self.llm.ask(final_prompt)     return final_answer.strip() ```  `results_count == 0` is set in three different places, all of which trigger this premature exit:  - legitimately empty local results from `self.search(...)` at line 264 (a too-narrow first query that the model would naturally rephrase on the next iteration); - Serper API structured error at lines 233-239 (`results_count = 0` after the error string is folded into the 

- **Issue #320** (2026-05-23): **WinError 2 / File Not Found on MCP leann_mcp windows binary**
  *Symptoms*: ### What happened?  Problem Description: I am attempting to query a local LEANN vector database via MCP inside a RikkaHub assistant (Windows 10/11 host). Despite the transport/SSE connection being verified and stable, every call to the leann_search tool returns [WinError 2] The system cannot find the file specified.  Observed Behavior:      SSE handshake and connectivity on port 9090 are successful.     The MCP Proxy correctly identifies the index.     However, when the query reaches the leann_mcp binary, it fails to resolve the index file paths.     I have verified the folder C:\TOD\tod-index exists and contains valid documents.* files.  Troubleshooting Already Performed:      Verified C:\TOD\tod-index physical existence and content.     Executed process in Administrator mode to rule out file-handle permission locks.     Verified WinError 2 persists even when the process has full read access to the directory.     MCP Proxy is confirmed stable (no connectivity timeout issues).     Command ran via: leann_mcp.exe --base-dir "C:\TOD"  Question: Does leann_mcp.exe have a hard-coded internal path dependency, or are there known Windows VENV path-resolution issues when being accessed via the mcp-proxy bridge? How can I force the binary to explicitly resolve the documents index without throwing WinError 2?  Host Environment:      Windows 10/11     Python 3.11.9     LEANN-core: 0.3.7 (suggested)   ### How to reproduce        Environment: Windows 10/11 host, Python 3.11+.     Setup: Pl

- **Issue #293** (2026-04-03): **Leann serve error on MacOS when leann works per examples otherwise**
  *Symptoms*: ### What happened?  Wanting to run leann with AnythingLLM it is necessary to expose leann with an http-enabled API.  Not wanting to create an API envelope from scratch I tried to evaluate "leann serve".  After following the instructions for making a virtual environment with uv, leann works as expected per the examples and README.  But attempts to use "leann serve" results in the following error and failure of leann serve to start:  leann serve                         $HOME/.local/share/uv/python/cpython-3.11.15-macos-aarch64-none/lib/python3.11/asyncio/runners.py:77: RuntimeWarning: coroutine 'Loop.shutdown_asyncgens' was never awaited   loop.close() ❌ Error starting server: Cannot run the event loop while another loop is running sys:1: RuntimeWarning: coroutine 'Server.serve' was never awaited RuntimeWarning: Enable tracemalloc to get the object allocation traceback  ### How to reproduce  Installed per README on MacOS 26.3.1 with M3 chip.   "leanne serve"  ### Error message  ```shell $HOME/.local/share/uv/python/cpython-3.11.15-macos-aarch64-none/lib/python3.11/asyncio/runners.py:77: RuntimeWarning: coroutine 'Loop.shutdown_asyncgens' was never awaited   loop.close() ❌ Error starting server: Cannot run the event loop while another loop is running sys:1: RuntimeWarning: coroutine 'Server.serve' was never awaited RuntimeWarning: Enable tracemalloc to get the object allocation traceback  -> $HOME my edit ```  ### LEANN Version  latest  ### Operating System  macOS

- **Issue #292** (2026-04-17): **IVF is not available?**
  *Symptoms*: ### What happened?  I asked in the slack chat if IVF is available and was told to just reference it in the builder as a backend, but I'm running into issues. I also noticed there is no backend ivf folder available in my .venv folder after I add using `uv`? Picture attached:  <img width="250" height="159" alt="Image" src="https://github.com/user-attachments/assets/b6be56ee-ccc2-4a21-bf30-61b4c2802798" />  And here is from my `uv.lock` file:  ``` [[package]] name = "leann" version = "0.3.7" source = { registry = "https://pypi.org/simple" } dependencies = [     { name = "leann-backend-diskann" },     { name = "leann-backend-hnsw" },     { name = "leann-core" }, ] sdist = { url = "https://files.pythonhosted.org/packages/d3/97/b3bc416dc2e5d83b3b0c73dd3a04aa7ee792e169818a496a057678187545/leann-0.3.7.tar.gz", hash = "sha256:85da2069124b034b40f303c3ee90c3f502fa90a6184f991d0e1b80502d2d493f", size = 2238, upload-time = "2026-03-08T21:37:17.815Z" } wheels = [     { url = "https://files.pythonhosted.org/packages/b4/1a/644602dd998ae2886f5750d6600296006c1d1a7e26c68f5844a577d32a2d/leann-0.3.7-py3-none-any.whl", hash = "sha256:47ccf739be13fc97945ffde859247e9b2211b8e45807e03d25a592f5d0ef83a1", size = 2060, upload-time = "2026-03-08T21:35:30.412Z" }, ] ```  ### How to reproduce  1. `uv add leann` 2.  ``` from leann import LeannBuilder      builder = LeannBuilder(         backend_name="ivf",         embedding_model="nomic-embed-text",         embedding_mode="ollama",     ) ```  ### Error messag

- **Issue #290** (2026-04-10): **The index is not being built without using --force**
  *Symptoms*: ### What happened?  Thank you for a great piece of software!  When I try to build a new index leann only creates the index folder, but then it stops and does not create the index files. Running in ubuntu 24.04, with self-hosted embedding model.  If I add the --force parameter the index builds successfully.  This is troubling since I wish to be able to add documents to the index in the future without rebuilding the whole index.   ### How to reproduce  Build command: `leann build MPAL --docs /mnt/RAG/sources/MPAL --embedding-mode openai --embedding-model [EMBEDDING MODEL NAME] --embedding-api-base http://192.168.2.11:7072/v1 --embedding-api-key monster --backend-name hnsw --graph-degree 64 --complexity 128 --doc-chunk-size 128 --doc-chunk-overlap 32`  Output:  ```bash 📂 Indexing 1 path:   📁 Directories (1):     1. /mnt/RAG/sources/MPAL Index up to date. ```  The `.leann/indexes/MPAL` folder will be created, but empty.   ### Error message  ```shell  ```  ### LEANN Version  Latest  ### Operating System  Linux
  **Post-Mortem & Fix Analysis**:
  > Sure, let me take a look and back soon

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

### Incident Patch 1: `37c5ae3b` (2026-09-29)
**Commit Message**: fix(core): honour an explicit passage ID of 0 and key the offset map by string (#427)

add_text() picked the passage ID with `metadata.get("id") or
_generate_passage_id(text)`, so an integer ID of 0 fell through to the
generated one and collided with the passage that already owned it, and a
non-string ID keyed `.passages.idx` as an int while the backend advertises
it through `.ids.txt` as a string. Both made a built passage unreachable at
search time, where the KeyError branch silently dropped the hit.

**File**: `packages/leann-core/src/leann/api.py` (modified, +8/-1)
```diff
@@ -556,7 +556,14 @@ def _generate_passage_id(self, text: str) -> str:
     def add_text(self, text: str, metadata: Optional[dict[str, Any]] = None):
         if metadata is None:
             metadata = {}
-        passage_id = metadata.get("id") or self._generate_passage_id(text)
+        # An explicit ID is honoured even when it is falsy -- integer dataset IDs start
+        # at 0 -- and is stored as a string, because PassageManager keys offsets by the
+        # same string the backend hands back for a label.
+        explicit_id = metadata.get("id")
+        if explicit_id is None or str(explicit_id) == "":
+            passage_id = self._generate_passage_id(text)
+        else:
+            passage_id = str(explicit_id)
         chunk_data = {"id": passage_id, "text": text, "metadata": metadata}
         self.chunks.append(chunk_data)
 
```

**File**: `tests/test_explicit_passage_id.py` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+"""Explicit passage IDs must survive the build and stay reachable after it.
+
+Datasets hand LEANN integer IDs (a row id, a dataframe index), so ``0`` is a valid ID
+and ``.passages.idx`` has to be keyed by the same string the backend returns for a
+label. ``build_index_from_arrays()`` already stringifies the IDs it is given; this is
+the same contract for the text-building path.
+"""
+
+import json
+import pickle
+from unittest.mock import Mock, patch
+
+import leann.api as api
+import numpy as np
+from leann.api import LeannBuilder, LeannSearcher
+
+
+def _build(tmp_path, monkeypatch, texts_and_metadata):
+    backend = Mock()
+    monkeypatch.setitem(api.BACKEND_REGISTRY, "id-test", backend)
+    vectors = np.array([[1.0, 0.0], [0.0, 1.0]], dtype=np.float32)
+
+    builder = LeannBuilder(backend_name="id-test", dimensions=2)
+    for text, metadata in texts_and_metadata:
+        builder.add_text(text, metadata=metadata)
+    with patch.object(api, "compute_embeddings", return_value=vectors):
+        builder.build_index(str(tmp_path / "docs.leann"))
+    return backend, vectors
+
+
+def _read_offsets(tmp_path):
+    with open(tmp_path / "docs.leann.passages.idx", "rb") as f:
+        return pickle.load(f)
+
+
+def test_integer_metadata_id_keys_the_offset_map_as_a_string(tmp_path, monkeypatch):
+    """An int ID reaches ``.ids.txt`` as a string, so an int-keyed offset map misses it."""
+    _build(tmp_path, monkeypatch, [("alpha", {"id": 7}), ("beta", {})])
+
+    with open(tmp_path / "docs.ids.txt", encoding="utf-8") as f:
+        advertised = f.read().split()
+
+    offsets = _read_offsets(tmp_path)
+    assert advertised == ["7", "1"]
+    assert set(offsets) == {"7", "1"}
+
+
+def test_zero_metadata_id_keeps_its_own_passage_searchable(tmp_path, monkeypatch):
+    """``id=0`` is a real ID. Reusing the insertion position instead of it made the two
+    passages share one ID, and the searcher dropped the hit whose ID was not in the map.
+    """
+    backend, vectors = _build(tmp_path, monkeypatch, [("alpha", {"id": "1"}), ("beta", {"id": 0})])
+
+    with open(tmp_path / "docs.leann.passages.jsonl", encoding="utf-8") as f:
+        written = [json.loads(line)["id"] for line in f]
+
+    assert written == ["1", "0"]
+    assert set(_read_offsets(tmp_path)) == {"1", "0"}
+
+    # The mock stands in for a backend that resolves its own labels through ``.ids.txt``,
+    # which is where a passage ID that was overwritten upstream stops matching.
+    backend.searcher.return_value.compute_query_embedding.return_value = vectors[0]
+    backend.searcher.return_value.search.return_value = {
+        "labels": [written],
+        "distances": [[0.9, 0.8]],
+    }
+    with LeannSearcher(
+        str(tmp_path / "docs.leann"), enable_warmup=False, recompute_embeddings=False
+    ) as searcher:
+        results = searcher.search("doc", top_k=2)
+
+    assert [(result.id, result.text) for result in results] == [("1", "alpha"), ("0", "beta")]
```

---

### Incident Patch 2: `7c268aad` (2026-09-26)
**Commit Message**: fix: align precomputed embedding IDs with passages (#422)

Co-authored-by: dafyy321-pixel <[REDACTED_EMAIL]>
Co-authored-by: Aakash Suresh <[REDACTED_EMAIL]>

**File**: `packages/leann-core/src/leann/api.py` (modified, +12/-5)
```diff
@@ -706,16 +706,21 @@ def build_index_from_arrays(self, index_path: str, ids: list, embeddings: np.nda
 
         Args:
             index_path: Path where the index will be saved
-            ids: List of document IDs (will be converted to strings)
+            ids: Document IDs in embedding order. Converted to strings and used as
+                passage IDs even when add_text() assigned different IDs; chunk metadata
+                is preserved.
             embeddings: numpy array of shape (n_documents, embedding_dim)
 
         Raises:
-            ValueError: If ids and embeddings counts don't match, or dimension mismatch
+            ValueError: If IDs are duplicated, counts don't match, or dimensions differ
         """
         if len(ids) != embeddings.shape[0]:
             raise ValueError(
                 f"Mismatch between number of IDs ({len(ids)}) and embeddings ({embeddings.shape[0]})"
             )
+        string_ids = [str(id_val) for id_val in ids]
+        if len(string_ids) != len(set(string_ids)):
+            raise ValueError("Document IDs must be unique after conversion to strings")
 
         # Validate/set dimensions
         embedding_dim = embeddings.shape[1]
@@ -733,16 +738,19 @@ def build_index_from_arrays(self, index_path: str, ids: list, embeddings: np.nda
             # If no text chunks provided, create placeholder text entries
             if not self.chunks:
                 logger.info("No text chunks provided, creating placeholder entries...")
-                for id_val in ids:
+                for id_val in string_ids:
                     self.add_text(
                         f"Document {id_val}",
-                        metadata={"id": str(id_val), "from_embeddings": True},
+                        metadata={"id": id_val, "from_embeddings": True},
                     )
             else:
                 raise ValueError(
                     f"Number of text chunks ({len(self.chunks)}) doesn't match number of embeddings ({len(ids)})"
                 )
 
+        for chunk, string_id in zip(self.chunks, string_ids):
+            chunk["id"] = string_id
+
         # Build file structure
         path = Path(index_path)
         index_dir = path.parent
@@ -772,7 +780,6 @@ def build_index_from_arrays(self, index_path: str, ids: list, embeddings: np.nda
             pickle.dump(offset_map, f)
 
         # Build the vector index using precomputed embeddings
-        string_ids = [str(id_val) for id_val in ids]
         # Persist ID map (order == embeddings order)
         try:
             idmap_file = (
```

**File**: `tests/test_build_from_arrays.py` (modified, +51/-0)
```diff
@@ -3,15 +3,66 @@
 build_index_from_embeddings (pickle-based path).
 """
 
+import json
 import os
 import pickle
 import tempfile
 from pathlib import Path
+from unittest.mock import Mock
 
 import numpy as np
 import pytest
 
 
+def test_build_from_arrays_custom_ids_are_searchable(tmp_path, monkeypatch):
+    """Search resolves supplied IDs to the text added before the array build."""
+    from leann.api import BACKEND_REGISTRY, LeannBuilder, LeannSearcher
+
+    backend = Mock()
+    monkeypatch.setitem(BACKEND_REGISTRY, "array-test", backend)
+    index_path = str(tmp_path / "custom-ids.leann")
+    ids = ["doc-a", "doc-b"]
+    embeddings = np.array([[1, 0], [0, 1]], dtype=np.float32)
+
+    builder = LeannBuilder(backend_name="array-test", dimensions=2)
+    builder.add_text("Alpha document", metadata={"id": "original-a", "source": "alpha"})
+    builder.add_text("Beta document", metadata={"source": "beta"})
+    builder.build_index_from_arrays(index_path, ids, embeddings)
+
+    assert backend.builder.return_value.build.call_args.args[1] == ids
+    with open(f"{index_path}.passages.jsonl", encoding="utf-8") as f:
+        assert [json.loads(line)["id"] for line in f] == ids
+    with open(f"{index_path}.passages.idx", "rb") as f:
+        assert set(pickle.load(f)) == set(ids)
+
+    backend.searcher.return_value.compute_query_embedding.return_value = embeddings[0]
+    backend.searcher.return_value.search.return_value = {
+        "labels": [ids],
+        "distances": [[0.9, 0.8]],
+    }
+    with LeannSearcher(index_path, enable_warmup=False, recompute_embeddings=False) as searcher:
+        results = searcher.search("document", top_k=2)
+
+    assert [(result.id, result.text, result.metadata["source"]) for result in results] == [
+        ("doc-a", "Alpha document", "alpha"),
+        ("doc-b", "Beta document", "beta"),
+    ]
+    assert results[0].metadata["id"] == "original-a"
+
+
+def test_build_from_arrays_rejects_colliding_ids(tmp_path, monkeypatch):
+    """Numeric and text IDs that become identical strings cannot share a passage."""
+    from leann.api import BACKEND_REGISTRY, LeannBuilder
+
+    monkeypatch.setitem(BACKEND_REGISTRY, "array-test", Mock())
+    builder = LeannBuilder(backend_name="array-test", dimensions=2)
+    with pytest.raises(ValueError, match="IDs must be unique"):
+        builder.build_index_from_arrays(
+            str(tmp_path / "colliding-ids.leann"), [1, "1"], np.zeros((2, 2), dtype=np.float32)
+        )
+    assert not (tmp_path / "colliding-ids.leann.passages.jsonl").exists()
+
+
 @pytest.mark.skipif(
     os.environ.get("CI") == "true", reason="Skip model tests in CI to avoid MPS memory issues"
 )
```

---

### Incident Patch 3: `6f8e6415` (2026-09-26)
**Commit Message**: fix(mcp): honor --base-dir across tools (#421)

* fix: honor MCP base directory for all tools

* test: satisfy ty in MCP base directory regression

---------

Co-authored-by: dafyy321-pixel <[REDACTED_EMAIL]>
Co-authored-by: Aakash Suresh <[REDACTED_EMAIL]>

**File**: `packages/leann-core/src/leann/mcp.py` (modified, +8/-5)
```diff
@@ -4,10 +4,15 @@
 import json
 import subprocess
 import sys
+from pathlib import Path
 
 _base_dir: str | None = None
 
 
+def _working_dir() -> Path:
+    return Path(_base_dir) if _base_dir else Path.cwd()
+
+
 def _leann_cmd() -> list[str]:
     """Build the base command for invoking ``leann`` CLI.
 
@@ -30,6 +35,7 @@ def _run_leann(*args, timeout=120):
         encoding="utf-8",
         errors="replace",
         timeout=timeout,
+        cwd=_working_dir(),
     )
     return result.returncode, result.stdout, result.stderr
 
@@ -230,9 +236,8 @@ def handle_build(request_id, args):
     # updates use the same model (avoids mismatch with CLI default).
     if index_name:
         import json as _json
-        from pathlib import Path
 
-        meta_path = Path.cwd() / ".leann" / "indexes" / index_name / "documents.leann.meta.json"
+        meta_path = _working_dir() / ".leann" / "indexes" / index_name / "documents.leann.meta.json"
         if meta_path.exists():
             try:
                 with open(meta_path, encoding="utf-8") as f:
@@ -259,10 +264,8 @@ def handle_status(request_id, args):
     if not index_name:
         return _make_result(request_id, "Error: index_name is required.")
 
-    from pathlib import Path
-
     # Check standard location
-    leann_dir = Path.cwd() / ".leann" / "indexes" / index_name
+    leann_dir = _working_dir() / ".leann" / "indexes" / index_name
     meta_path = leann_dir / "documents.leann.meta.json"
     passages_path = leann_dir / "documents.leann.passages.jsonl"
 
```

**File**: `tests/test_mcp_base_dir.py` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+"""MCP tools should use the directory selected at server startup."""
+
+import json
+from importlib.machinery import SourceFileLoader
+from pathlib import Path
+from types import ModuleType, SimpleNamespace
+
+import pytest
+
+module_path = Path(__file__).resolve().parents[1] / "packages/leann-core/src/leann/mcp.py"
+mcp = ModuleType("leann_mcp_base_dir_test")
+SourceFileLoader(mcp.__name__, str(module_path)).exec_module(mcp)
+
+
+@pytest.mark.parametrize("relative_base_dir", [False, True])
+def test_base_dir_applies_to_cli_and_local_index_reads(tmp_path, monkeypatch, relative_base_dir):
+    project_dir = tmp_path / "project"
+    launch_dir = tmp_path / "launcher"
+    index_dir = project_dir / ".leann" / "indexes" / "docs"
+    index_dir.mkdir(parents=True)
+    launch_dir.mkdir()
+    (index_dir / "documents.leann.meta.json").write_text(
+        json.dumps(
+            {"backend_name": "ivf", "embedding_model": "existing-model", "embedding_mode": "local"}
+        ),
+        encoding="utf-8",
+    )
+    monkeypatch.chdir(launch_dir)
+    base_dir = Path("..") / "project" if relative_base_dir else project_dir
+    monkeypatch.setattr(mcp, "_base_dir", str(base_dir))
+
+    calls = []
+
+    def fake_run(command, **kwargs):
+        calls.append((command, kwargs))
+        output = "[]" if command[3] == "search" else "ok"
+        return SimpleNamespace(returncode=0, stdout=output, stderr="")
+
+    monkeypatch.setattr(mcp.subprocess, "run", fake_run)
+
+    status = mcp.handle_status(1, {"index_name": "docs"})
+    expected_index_dir = base_dir / ".leann" / "indexes" / "docs"
+    assert f"Location: {expected_index_dir}" in status["result"]["content"][0]["text"]
+
+    mcp.handle_build(2, {"index_name": "docs", "docs": ["source.txt"]})
+    mcp.handle_list(3)
+    mcp.handle_search(4, {"index_name": "docs", "query": "example"})
+
+    assert all(kwargs["cwd"] == base_dir for _, kwargs in calls)
+    assert "--embedding-model=existing-model" in calls[0][0]
+    assert "--embedding-mode=local" in calls[0][0]
```

---

### Incident Patch 4: `8110c68a` (2026-09-26)
**Commit Message**: fix(core): judge an explicitly named file by its own name, not its ancestors (#420)

* fix(core): judge an explicitly named file by its own name, not its ancestors

* test: cover explicit files under hidden directories in build and sync

---------

Co-authored-by: Aakash Suresh <[REDACTED_EMAIL]>

**File**: `packages/leann-core/src/leann/cli.py` (modified, +4/-1)
```diff
@@ -1673,7 +1673,10 @@ def _path_has_hidden_segment(p: Path) -> bool:
                 files_by_dir = defaultdict(list)
                 for file_path in files:
                     file_path_obj = Path(file_path)
-                    if not include_hidden and _path_has_hidden_segment(file_path_obj):
+                    # Judge an explicitly named file by its own name: testing every
+                    # ancestor made the result depend on whether the user typed a
+                    # relative or an absolute path.
+                    if not include_hidden and file_path_obj.name.startswith("."):
                         print(f"  ⚠️  Skipping hidden file: {file_path}")
                         continue
                     parent_dir = str(file_path_obj.parent)
```

**File**: `packages/leann-core/src/leann/sync.py` (modified, +3/-1)
```diff
@@ -218,7 +218,9 @@ def _collect_paths(self) -> list[str]:
             path = Path(file_path).resolve()
             if not path.is_file():
                 continue
-            if not self.include_hidden and _path_has_hidden_segment(path):
+            # A file named on its own is judged by its own name, not by its
+            # ancestors: pointing at a directory already overrides their hidden-ness.
+            if not self.include_hidden and path.name.startswith("."):
                 continue
             if not _extension_allowed(path, self.include_extensions):
                 continue
```

**File**: `tests/test_explicit_file_hidden_scope.py` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+"""A file named explicitly on --docs is judged by its own name, not by its ancestors.
+
+Pointing `--docs` at a hidden directory already indexes what is inside it (#52/#56).
+Naming one file inside that directory used to behave differently in two ways: the
+build skipped it whenever the path spelled out the hidden ancestor, and the sync
+snapshot never tracked it at all, because it resolves every path to absolute first.
+"""
+
+from leann.cli import LeannCLI
+from leann.sync import FileSynchronizer
+
+
+def _hidden_dir_with_note(tmp_path):
+    hidden = tmp_path / ".vault"
+    hidden.mkdir()
+    note = hidden / "notes.md"
+    note.write_text("# hello", encoding="utf-8")
+    return hidden, note
+
+
+def _cli_load(path, include_hidden=False):
+    return LeannCLI().load_documents([str(path.resolve())], include_hidden=include_hidden)
+
+
+def test_explicit_file_under_hidden_dir_is_synced(tmp_path):
+    _, note = _hidden_dir_with_note(tmp_path)
+
+    fs = FileSynchronizer(
+        explicit_files=[str(note.resolve())],
+        include_extensions=[".md"],
+        snapshot_path=str(tmp_path / "sync.pickle"),
+        auto_load=False,
+    )
+
+    assert str(note.resolve()) in fs.generate_file_hashes()
+
+
+def test_explicit_dotfile_still_needs_include_hidden(tmp_path):
+    dotfile = tmp_path / ".secrets.md"
+    dotfile.write_text("shh", encoding="utf-8")
+
+    def sync(include_hidden):
+        return FileSynchronizer(
+            explicit_files=[str(dotfile.resolve())],
+            include_extensions=[".md"],
+            include_hidden=include_hidden,
+            snapshot_path=str(tmp_path / f"sync_{include_hidden}.pickle"),
+            auto_load=False,
+        ).generate_file_hashes()
+
+    assert sync(include_hidden=False) == {}
+    assert str(dotfile.resolve()) in sync(include_hidden=True)
+
+
+def test_build_loads_explicit_file_under_hidden_dir(tmp_path, monkeypatch):
+    hidden, note = _hidden_dir_with_note(tmp_path)
+    cli = LeannCLI()
+
+    from_absolute = cli.load_documents([str(note.resolve())])
+
+    monkeypatch.chdir(hidden)
+    from_relative = cli.load_documents(["notes.md"])
+
+    assert len(from_absolute) == len(from_relative) == 1
+
+
+def test_build_skips_explicit_dotfile(tmp_path):
+    dotfile = tmp_path / ".secrets.md"
+    dotfile.write_text("shh", encoding="utf-8")
+
+    assert _cli_load(dotfile) == []
+    assert len(_cli_load(dotfile, include_hidden=True)) == 1
```

---

### Incident Patch 5: `cae99bf2` (2026-09-26)
**Commit Message**: fix(ci): clear the ty diagnostics blocking every open PR (#425)

`Type Check with ty` fails on main itself, so every PR opened against it
inherits a red check for code it never touched. #420, #421 and #422 are each
blocked this way, on files none of them modify.

Reproduced with CI's exact invocation (`ty check packages/leann-core/src apps
tests`, ty pinned to 0.0.17) against a pristine checkout: 5 diagnostics, the
same 5 CI reports.

- Three `# type: ignore[...]` comments use mypy codes ty does not recognise, so
  it treats them as blanket suppressions, finds nothing suppressed, and reports
  them unused. Removed, which is ty's own suggested fix.
- `tests/test_chrome_history_reader.py` assigns attributes onto bare
  `types.ModuleType` stubs when llama_index is absent. Those are genuine
  `unresolved-attribute` errors. The stubs now come from a helper returning
  `Any`. A suppression comment would not do: CI type-checks with no project
  dependencies installed while a developer machine has llama_index, so an
  ignore would be needed in one environment and flagged unused in the other.
  Annotating the variables as `Any` is also insufficient -- the assignment
  narrows the type strai

**File**: `packages/leann-core/src/leann/embedding_server_manager.py` (modified, +2/-2)
```diff
@@ -29,7 +29,7 @@
 _REGISTRY_LOCKS: dict[str, threading.Lock] = {}
 
 
-def _flock_acquire(lock_file) -> None:  # type: ignore[type-arg]
+def _flock_acquire(lock_file) -> None:
     """Acquire an exclusive file lock for cross-process synchronisation.
 
     Uses ``fcntl.flock`` on POSIX and ``msvcrt.locking`` on Windows.  Both are
@@ -70,7 +70,7 @@ def _flock_acquire(lock_file) -> None:  # type: ignore[type-arg]
     )
 
 
-def _flock_release(lock_file) -> None:  # type: ignore[type-arg]
+def _flock_release(lock_file) -> None:
     """Release the file lock acquired by :func:`_flock_acquire`."""
     try:
         import fcntl
```

**File**: `tests/test_chrome_history_reader.py` (modified, +11/-4)
```diff
@@ -4,14 +4,21 @@
 import sys
 import types
 from pathlib import Path
+from typing import Any
+
+
+def _stub_module(name: str) -> Any:
+    """A stand-in module object whose attributes are set dynamically below."""
+    return types.ModuleType(name)
+
 
 try:
     from llama_index.core import Document as _Document
 except ModuleNotFoundError:
-    llama_index = types.ModuleType("llama_index")
-    llama_index_core = types.ModuleType("llama_index.core")
-    llama_index_readers = types.ModuleType("llama_index.core.readers")
-    llama_index_base = types.ModuleType("llama_index.core.readers.base")
+    llama_index = _stub_module("llama_index")
+    llama_index_core = _stub_module("llama_index.core")
+    llama_index_readers = _stub_module("llama_index.core.readers")
+    llama_index_base = _stub_module("llama_index.core.readers.base")
 
     class _Document:
         def __init__(self, text, metadata):
```

**File**: `tests/test_embedding_server_manager.py` (modified, +1/-1)
```diff
@@ -405,7 +405,7 @@ def fail_terminate():
         called["terminate"] += 1
         raise AssertionError("terminate should not be called in daemon detach path")
 
-    manager.server_process.terminate = fail_terminate  # type: ignore[method-assign]
+    manager.server_process.terminate = fail_terminate
 
     manager.stop_server()
     assert called["terminate"] == 0
```

---

### Incident Patch 6: `0c20c50b` (2026-09-26)
**Commit Message**: fix(search): preserve mixed-script boundaries in FTS5 BM25 (#415)

**File**: `docs/CHANGELOG.md` (modified, +5/-0)
```diff
@@ -71,3 +71,8 @@ fixes). Newest entries at the bottom.
 
 - Remove the seven duplicate index command parsers and handlers introduced by #269 after #285 had already supplied them. This fixes `argparse.ArgumentError: conflicting subparser: index-browser`, which prevented every CLI command, including help, from running.
 - Retain the #285 command interface (`--max-count`, `--index-name`, `--no-recompute`), application readers, and shared builder; native indexing and standalone wheel reader packaging are unchanged.
+
+## 2026-09-06: Preserve mixed-script words in BM25 search
+
+- Keep Latin words and numbers separate from adjacent Chinese, Japanese, and Korean n-grams when building SQLite FTS5 indexes and parsing keyword queries. For example, `Python数据库SQL` can be retrieved by `Python`, `SQL`, or a mixed-script query.
+- Existing BM25 artifacts remain readable. Rebuild indexes containing mixed-script text to regenerate tokens that were previously joined at script boundaries.
```

**File**: `packages/leann-core/src/leann/api.py` (modified, +5/-2)
```diff
@@ -45,12 +45,15 @@
 def _fts5_cjk_ngrams(match: re.Match[str]) -> str:
     """Expand a CJK run into unigram and bigram tokens for SQLite FTS5."""
     text = match.group()
-    return " ".join([*text, *(text[i : i + 2] for i in range(len(text) - 1))])
+    tokens = " ".join([*text, *(text[i : i + 2] for i in range(len(text) - 1))])
+    # Keep adjacent non-CJK words separate from the first and last n-grams.
+    return f" {tokens} "
 
 
 def _fts5_cjk_query(query: str) -> str:
     """Build a safe FTS5 query that requires every CJK bigram in each term."""
-    tokens = re.findall(rf"[{_CJK_CHARACTERS}]+|\w+", query.lower())
+    # Unicode \w includes CJK, so exclude it from the non-CJK alternative.
+    tokens = re.findall(rf"[{_CJK_CHARACTERS}]+|[^\W{_CJK_CHARACTERS}]+", query.lower())
     terms = []
     for token in tokens:
         if _CJK_RUN.fullmatch(token):
```

**File**: `tests/test_fts5_bm25.py` (modified, +43/-0)
```diff
@@ -1,3 +1,4 @@
+import pytest
 from leann.api import Fts5BM25Index
 
 
@@ -30,3 +31,45 @@ def test_fts5_bm25_keeps_legacy_database_query_format(tmp_path):
         assert [result.id for result in reopened.search("database")] == ["database"]
     finally:
         reopened.close()
+
+
+@pytest.mark.parametrize("cjk_text", ["数据库", "データベース", "데이터베이스"])
+@pytest.mark.parametrize("query", ["Python", "SQL"])
+def test_fts5_bm25_preserves_words_adjacent_to_cjk(tmp_path, cjk_text, query):
+    db_path = tmp_path / "mixed.sqlite"
+    index = Fts5BM25Index(str(db_path))
+    index.fit(
+        [
+            {"id": "mixed", "text": f"Python{cjk_text}SQL"},
+            {"id": "unrelated", "text": "unrelated document"},
+        ]
+    )
+    index.close()
+
+    reopened = Fts5BM25Index(str(db_path))
+    try:
+        assert [result.id for result in reopened.search(query)] == ["mixed"]
+    finally:
+        reopened.close()
+
+
+@pytest.mark.parametrize("query", ["Python数据库", "数据库Python", "Python数据库SQL", "2026数据库"])
+def test_fts5_bm25_splits_mixed_script_query_terms(tmp_path, query):
+    db_path = tmp_path / "queries.sqlite"
+    index = Fts5BM25Index(str(db_path))
+    index.fit(
+        [
+            {"id": "database", "text": "数据库检索系统"},
+            {"id": "partial", "text": "数据分析"},
+            {"id": "unrelated", "text": "image classification"},
+        ]
+    )
+    index.close()
+
+    reopened = Fts5BM25Index(str(db_path))
+    try:
+        # Match the CJK term independently of the Latin/number terms, while
+        # still requiring all its bigrams (the partial match must be excluded).
+        assert [result.id for result in reopened.search(query)] == ["database"]
+    finally:
+        reopened.close()
```

---

### Incident Patch 7: `f84dec41` (2026-09-22)
**Commit Message**: fix: include live Chrome history in SQLite snapshots (#419)

**File**: `packages/leann-core/src/leann/readers.py` (modified, +13/-11)
```diff
@@ -32,17 +32,20 @@ def load_data(
             )
 
         history_db_path = os.path.join(chrome_profile_path, "History")
-        temp_db_path = "/tmp/leann_history_index_copy"
 
         if not os.path.exists(history_db_path):
             print(f"⚠️ Browser history database not found at: {history_db_path}")
             return docs
 
+        source_conn = None
+        conn = None
         try:
-            # Create a temporary copy to avoid "database is locked"
-            shutil.copy2(history_db_path, temp_db_path)
-
-            conn = sqlite3.connect(temp_db_path)
+            # SQLite's backup API captures committed rows from the main database and its WAL
+            # while keeping the live browser database untouched.
+            source_uri = f"{Path(history_db_path).resolve().as_uri()}?mode=ro"
+            source_conn = sqlite3.connect(source_uri, uri=True)
+            conn = sqlite3.connect(":memory:")
+            source_conn.backup(conn)
             cursor = conn.cursor()
 
             query = """
@@ -77,15 +80,14 @@ def load_data(
                 doc = Document(text=doc_content, metadata={"title": title[0:150], "url": url})
                 docs.append(doc)
 
-            conn.close()
-            if os.path.exists(temp_db_path):
-                os.remove(temp_db_path)
-
         except Exception as e:
             print(f"❌ Error reading browser history: {e}")
-            if os.path.exists(temp_db_path):
-                os.remove(temp_db_path)
             return docs
+        finally:
+            if conn is not None:
+                conn.close()
+            if source_conn is not None:
+                source_conn.close()
 
         return docs
 
```

**File**: `tests/test_chrome_history_reader.py` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+import importlib.util
+import os
+import sqlite3
+import sys
+import types
+from pathlib import Path
+
+try:
+    from llama_index.core import Document as _Document
+except ModuleNotFoundError:
+    llama_index = types.ModuleType("llama_index")
+    llama_index_core = types.ModuleType("llama_index.core")
+    llama_index_readers = types.ModuleType("llama_index.core.readers")
+    llama_index_base = types.ModuleType("llama_index.core.readers.base")
+
+    class _Document:
+        def __init__(self, text, metadata):
+            self.text = text
+            self.metadata = metadata
+
+    class _BaseReader:
+        pass
+
+    llama_index_core.Document = _Document
+    llama_index_base.BaseReader = _BaseReader
+    sys.modules["llama_index"] = llama_index
+    sys.modules["llama_index.core"] = llama_index_core
+    sys.modules["llama_index.core.readers"] = llama_index_readers
+    sys.modules["llama_index.core.readers.base"] = llama_index_base
+
+readers_path = Path(__file__).parents[1] / "packages/leann-core/src/leann/readers.py"
+readers_spec = importlib.util.spec_from_file_location("leann_readers", readers_path)
+assert readers_spec is not None and readers_spec.loader is not None
+readers = importlib.util.module_from_spec(readers_spec)
+readers_spec.loader.exec_module(readers)
+ChromeHistoryReader = readers.ChromeHistoryReader
+
+
+def test_chrome_history_reader_includes_rows_still_in_wal(tmp_path, monkeypatch):
+    profile_dir = tmp_path / "profile"
+    profile_dir.mkdir()
+    history_path = profile_dir / "History"
+
+    source = sqlite3.connect(history_path)
+    assert source.execute("PRAGMA journal_mode=WAL").fetchone() == ("wal",)
+    source.execute(
+        """
+        CREATE TABLE urls (
+            last_visit_time INTEGER,
+            url TEXT,
+            title TEXT,
+            visit_count INTEGER,
+            typed_count INTEGER,
+            hidden INTEGER
+        )
+        """
+    )
+    source.commit()
+    source.execute("PRAGMA wal_checkpoint(TRUNCATE)")
+    source.execute(
+        "INSERT INTO urls VALUES (?, ?, ?, ?, ?, ?)",
+        (13300000000000000, "https://example.com/recent", "Recent page", 1, 0, 0),
+    )
+    source.commit()
+
+    isolated_copy = tmp_path / "main-database-only"
+    legacy_temp_path = "/tmp/leann_history_index_copy"
+    real_connect = sqlite3.connect
+    real_copy2 = readers.shutil.copy2
+    real_exists = os.path.exists
+
+    def redirected_connect(database, *args, **kwargs):
+        if os.fspath(database) == legacy_temp_path:
+            database = isolated_copy
+        return real_connect(database, *args, **kwargs)
+
+    def redirected_copy(source_path, _destination, *args, **kwargs):
+        return real_copy2(source_path, isolated_copy, *args, **kwargs)
+
+    def redirected_exists(path):
+        if os.fspath(path) == legacy_temp_path:
+            return False
+        return real_exists(path)
+
+    monkeypatch.setattr(readers.sqlite3, "connect", redirected_connect)
+    monkeypatch.setattr(readers.shutil, "copy2", redirected_copy)
+    monkeypatch.setattr(readers.os.path, "exists", redirected_exists)
+
+    documents = ChromeHistoryReader().load_data(str(profile_dir))
+    source.close()
+
+    assert [document.metadata["url"] for document in documents] == ["https://example.com/recent"]
```

---

### Incident Patch 8: `abac77db` (2026-09-19)
**Commit Message**: fix: remove conflicting index command registrations (#416)

* fix: remove conflicting index command registrations

* test: type dynamic CLI reader fixtures explicitly

**File**: `docs/CHANGELOG.md` (modified, +5/-0)
```diff
@@ -66,3 +66,8 @@ fixes). Newest entries at the bottom.
   already-working Windows `cp314` installs. Completing the wheel matrix is the
   correct fix; the next 0.3.8 patch release will carry full `cp314` coverage
   once CI confirms the new platforms build cleanly.
+
+## 2026-09-06: Restore CLI parsing after duplicate index command registration
+
+- Remove the seven duplicate index command parsers and handlers introduced by #269 after #285 had already supplied them. This fixes `argparse.ArgumentError: conflicting subparser: index-browser`, which prevented every CLI command, including help, from running.
+- Retain the #285 command interface (`--max-count`, `--index-name`, `--no-recompute`), application readers, and shared builder; native indexing and standalone wheel reader packaging are unchanged.
```

**File**: `docs/user-scripts-tr.md` (modified, +1/-1)
```diff
@@ -179,7 +179,7 @@ ollama list
 
 C: Daha küçük bir dataset ile test edin:
 ```bash
---max-items 1000
+--max-count 1000
 ```
 
 ## İleri Düzey Kullanım
```

**File**: `docs/user-scripts.md` (modified, +1/-1)
```diff
@@ -177,7 +177,7 @@ ollama list
 
 Try with a smaller dataset:
 ```bash
---max-items 1000
+--max-count 1000
 ```
 
 ## Advanced Usage
```

**File**: `packages/leann-core/src/leann/cli.py` (modified, +0/-399)
```diff
@@ -486,79 +486,6 @@ def add_embedding_args(target_parser: argparse.ArgumentParser) -> None:
             ),
         )
 
-        # Browser Index Command
-        browser_parser = subparsers.add_parser("index-browser", help="Index browser history")
-        browser_parser.add_argument(
-            "browser_type", choices=["chrome", "brave"], help="Type of browser"
-        )
-        browser_parser.add_argument(
-            "--profile", type=str, default="Default", help="Profile name (default: Default)"
-        )
-        browser_parser.add_argument(
-            "--index-name", type=str, default=None, help="Custom index name"
-        )
-        browser_parser.add_argument(
-            "--max-items", type=int, default=1000, help="Max history items to index"
-        )
-        add_embedding_args(browser_parser)
-
-        # Email indexing command
-        email_parser = subparsers.add_parser("index-email", help="Index Apple Mail emails")
-        email_parser.add_argument(
-            "index_name", nargs="?", default="apple-mail", help="Index name (default: apple-mail)"
-        )
-        email_parser.add_argument(
-            "--max-items", type=int, default=2000, help="Max emails to index (default: 2000)"
-        )
-        add_embedding_args(email_parser)
-
-        # Calendar indexing command
-        calendar_parser = subparsers.add_parser(
-            "index-calendar", help="Index Apple Calendar events"
-        )
-        calendar_parser.add_argument(
-            "index_name",
-            nargs="?",
-            default="apple-calendar",
-            help="Index name (default: apple-calendar)",
-        )
-        calendar_parser.add_argument(
-            "--max-items", type=int, default=1000, help="Max events to index (default: 1000)"
-        )
-        add_embedding_args(calendar_parser)
-
-        # WeChat indexing command
-        wechat_parser = subparsers.add_parser("index-wechat", help="Index WeChat chat history")
-        wechat_parser.add_argument(
-            "index_name", nargs="?", default="wechat", help="Index name (default: wechat)"
-        )
-        wechat_parser.add_argument(
-            "--export-dir",
-            type=str,
-            default="./wechat_export",
-            help="Directory containing exported WeChat data (default: ./wechat_export)",
-        )
-        wechat_parser.add_argument(
-            "--max-items", type=int, default=1000, help="Max messages to index (default: 1000)"
-        )
-        add_embedding_args(wechat_parser)
-
-        # iMessage indexing command
-        imessage_parser = subparsers.add_parser("index-imessage", help="Index iMessage history")
-        imessage_parser.add_argument(
-            "index_name", nargs="?", default="imessage", help="Index name (default: imessage)"
-        )
-        imessage_parser.add_argument(
-            "--db-path",
-            type=str,
-            default=None,
-            help="Path to chat.db (default: ~/Library/Messages/chat.db)",
-        )
-        imessage_parser.add_argument(
-            "--max-items", type=int, default=1000, help="Max messages to index (default: 1000)"
-        )
-        add_embedding_args(imessage_parser)
-
         # Slack indexing command
         slack_parser = subparsers.add_parser("index-slack", help="Index Slack workspace via MCP")
         slack_parser.add_argument(
@@ -580,38 +507,6 @@ def add_embedding_args(target_parser: argparse.ArgumentParser) -> None:
         )
         add_embedding_args(slack_parser)
 
-        # ChatGPT indexing command
-        chatgpt_parser = subparsers.add_parser("index-chatgpt", help="Index ChatGPT export")
-        chatgpt_parser.add_argument(
-            "index_name", nargs="?", default="chatgpt", help="Index name (default: chatgpt)"
-        )
-        chatgpt_parser.add_argument(
-            "--export-path",
-            type=str,
-            required=True,
-            help="Path to ChatGPT export file (.html/.zip) or directory",
-        )
-        chatgpt_parser.add_argument(
-            "--max-items", type=int, default=1000, help="Max items to index (default: 1000)"
-        )
-        add_embedding_args(chatgpt_parser)
-
-        # Claude indexing command
-        claude_parser = subparsers.add_parser("index-claude", help="Index Claude export")
-        claude_parser.add_argument(
-            "index_name", nargs="?", default="claude", help="Index name (default: claude)"
-        )
-        claude_parser.add_argument(
-            "--export-path",
-            type=str,
-            required=True,
-            help="Path to Claude export file (.json/.zip) or directory",
-        )
-        claude_parser.add_argument(
-            "--max-items", type=int, default=1000, help="Max items to index (default: 1000)"
-        )
-        add_embedding_args(claude_parser)
-
         # Watch command
         watch_parser = subparsers.add_parser(
             "watch",
@@ -2615,220 +2510,6 @@ def _load_chunk_ids_by_file(

```

**File**: `tests/test_cli_index_commands.py` (added, +199/-0)
```diff
@@ -0,0 +1,199 @@
+"""Exercise index command parsing and dispatch without accessing personal data."""
+
+import asyncio
+import os
+import shutil
+import sqlite3
+import sys
+from pathlib import Path
+from types import ModuleType
+from unittest.mock import Mock, call
+
+import pytest
+from leann import cli as cli_module
+from leann.cli import LeannCLI
+from llama_index.core import Document
+
+SOURCES = {
+    "browser": ("apps.history_data.history", "ChromeHistoryReader", "browser_history"),
+    "email": ("apps.email_data.LEANN_email_reader", "EmlxReader", "email"),
+    "calendar": (None, None, "calendar"),
+    "imessage": ("apps.imessage_data.imessage_reader", "IMessageReader", "imessage"),
+    "wechat": ("apps.history_data.wechat_history", "WeChatHistoryReader", "wechat"),
+    "chatgpt": ("apps.chatgpt_data.chatgpt_reader", "ChatGPTReader", "chatgpt"),
+    "claude": ("apps.claude_data.claude_reader", "ClaudeReader", "claude"),
+}
+
+
+@pytest.fixture
+def cli(tmp_path, monkeypatch):
+    monkeypatch.chdir(tmp_path)
+    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
+    monkeypatch.setattr(
+        os.path,
+        "expanduser",
+        lambda path: str(tmp_path / path[2:]) if path.startswith("~/") else path,
+    )
+    return LeannCLI()
+
+
+def command_args(source, tmp_path):
+    argv = [f"index-{source}"]
+    if source == "browser":
+        argv.append("brave")
+    elif source == "wechat":
+        argv.extend(["--export-dir", str(tmp_path / "export")])
+    elif source in {"chatgpt", "claude"}:
+        argv.extend(["--export-path", str(tmp_path / "export.json")])
+    return argv
+
+
+@pytest.mark.parametrize("source", SOURCES)
+def test_index_command_defaults(cli, source, tmp_path):
+    args = cli.create_parser().parse_args(command_args(source, tmp_path))
+    assert args.index_name == SOURCES[source][2]
+    assert args.max_count == 1000
+    assert not args.no_recompute
+
+
+@pytest.mark.parametrize("source", SOURCES)
+@pytest.mark.parametrize("empty", [False, True], ids=["documents", "empty"])
+@pytest.mark.parametrize("no_recompute", [False, True], ids=["recompute", "stored"])
+def test_index_command_dispatch(cli, source, empty, no_recompute, tmp_path, monkeypatch):
+    # Install fake modules before dispatch: no application reader is imported or run.
+    documents = [] if empty else [Document(text="Synthetic text", metadata={"source": source})]
+    module_name, reader_name, _ = SOURCES[source]
+    reader_class = Mock()
+    reader_class.return_value.load_data.return_value = documents
+    if module_name:
+        assert reader_name is not None
+        parts = module_name.split(".")
+        for end in range(1, len(parts) + 1):
+            name = ".".join(parts[:end])
+            module = ModuleType(name)
+            module.__path__ = []
+            monkeypatch.setitem(sys.modules, name, module)
+        module = sys.modules[module_name]
+        setattr(module, reader_name, reader_class)
+        if source == "email":
+            monkeypatch.setattr(
+                module,
+                "find_all_messages_directories",
+                Mock(return_value=[tmp_path / "mail"]),
+                raising=False,
+            )
+    else:
+        # The legacy calendar handler embeds its reader. Exercise its actual SQL
+        # against a synthetic database, redirecting its fixed scratch path.
+        calendar_cache = tmp_path / "Library" / "Calendars" / "Calendar Cache"
+        calendar_cache.parent.mkdir(parents=True)
+        connection = sqlite3.connect(calendar_cache)
+        connection.execute(
+            "CREATE TABLE CI_EVENT (summary, description, location, start_date, end_date)"
+        )
+        if not empty:
+            connection.executemany(
+                "INSERT INTO CI_EVENT VALUES (?, ?, ?, ?, ?)",
+                [(f"Synthetic event {i}", "Details", "Room", i, i + 1) for i in range(3)],
+            )
+        connection.commit()
+        monkeypatch.setattr(shutil, "copy2", Mock())
+        monkeypatch.setattr(sqlite3, "connect", Mock(return_value=connection))
+        original_exists = os.path.exists
+        monkeypatch.setattr(
+            os.path,
+            "exists",
+            lambda path: False
+            if path == "/tmp/leann_calendar_index_copy"
+            else original_exists(path),
+        )
+
+    builder_class = Mock()
+    register = Mock()
+    monkeypatch.setattr(cli_module, "LeannBuilder", builder_class)
+    monkeypatch.setattr(cli, "register_project_dir", register)
+    argv = [
+        *command_args(source, tmp_path),
+        "--index-name",
+        "synthetic-index",
+        "--max-count",
+        "2",
+        "--embedding-model",
+        "synthetic-model",
+        "--embedding-mode",
+        "ollama",
+        "--embedding-host",
+        "http://127.0.0.1:9999",
+    ]
+    if no_recompute:
+        argv.append("--no-recompute")
+    args = cli.create_parser().parse_args(argv)
```

---

### Incident Patch 9: `f4a30319` (2026-09-05)
**Commit Message**: docs: add SECURITY.md with a private reporting path (#413)

Closes #407. The reporter of #404 looked for a confidential channel before
filing a network-exposure finding, found none — no SECURITY.md, private
vulnerability reporting disabled — and filed publicly because the severity
happened to be low. The next finding may not be.

Points at GitHub's private advisory flow, which needs no infrastructure on
either side, and states scope concretely rather than generically: the
unauthenticated ZMQ embedding servers, the MCP stdio transport, the document
readers that handle untrusted input by design, on-disk index metadata, and
third-party credentials.

Note: the advisory link only works once **Settings → Security → Private
vulnerability reporting** is enabled. That toggle is a repository setting, not
something a PR can change.

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `SECURITY.md` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+# Security Policy
+
+## Reporting a vulnerability
+
+**Please do not open a public issue for a security problem.**
+
+Report it privately through GitHub:
+[**Report a vulnerability**](https://github.com/StarTrail-org/LEANN/security/advisories/new)
+(repository → **Security** → **Advisories** → *Report a vulnerability*).
+
+That opens a private advisory visible only to you and the maintainers. It needs
+no infrastructure on either side, and it gives us a place to discuss a fix and
+issue a CVE if one is warranted.
+
+If the advisory form is unavailable to you, open a public issue containing only
+that you have a security report and how to reach you — no details — and a
+maintainer will arrange a private channel.
+
+## What to include
+
+The more of this you can provide, the faster a fix lands:
+
+- what an attacker can achieve, and what access they need to start
+- affected versions, and the platform and Python version you saw it on
+- a reproduction — a script, or the commands you ran
+- anything you already know about the cause or a possible fix
+
+## Scope
+
+LEANN runs locally and is usually pointed at a user's own data, so the
+interesting boundaries are the ones where it stops being local:
+
+- the backend embedding servers, which speak an **unauthenticated ZMQ REP
+  protocol** — they bind `127.0.0.1` by default, and anything that can reach
+  the port can request embeddings (see
+  [Embedding Server Bind Address](docs/configuration-guide.md))
+- the MCP server and its stdio transport
+- document readers and parsers, which handle untrusted input by design
+- index and metadata files written to disk, and anything that reads a path out
+  of them
+- credentials for third-party providers — API keys, endpoints, tokens
+
+Out of scope: findings against a deployment you have deliberately exposed to a
+network (for example `LEANN_EMBEDDING_SERVER_HOST=0.0.0.0` reachable from the
+internet), and vulnerabilities in third-party dependencies that are already
+public — please report those upstream, though we do want to know if LEANN
+pins an affected version.
+
+## Supported versions
+
+Fixes land on `main` and ship in the next release. If you are on an older
+release, please confirm the issue reproduces on current `main` where you can.
+
+## Disclosure
+
+We will confirm receipt, keep you updated as we investigate, and credit you in
+the advisory unless you would rather stay anonymous. Please give us a
+reasonable window to ship a fix before disclosing publicly.
```

---

### Incident Patch 10: `3958b51c` (2026-09-05)
**Commit Message**: fix: bind ZMQ embedding servers to loopback by default (#404)

The HNSW and DiskANN embedding servers bound their REP sockets to
tcp://* - all interfaces, unauthenticated. While a server is alive
(build/search), any host that can reach the port can request embedding
computation and passage lookups of the indexed content. All in-repo
clients connect to tcp://localhost, and the DiskANN C++ REQ client
receives only the port, so a loopback bind is fully compatible.

Default to 127.0.0.1 and honor LEANN_EMBEDDING_SERVER_HOST for
deliberate cross-host setups - the same pattern LEANN_SERVER_HOST
established for the HTTP server in #303. Completes the network-exposure
cleanup started there; the ZMQ half was previously noted as M-13 in the
audit of #267.

**File**: `packages/leann-backend-diskann/leann_backend_diskann/diskann_embedding_server.py` (modified, +10/-4)
```diff
@@ -123,8 +123,11 @@ def zmq_server_thread():
         socket = context.socket(
             zmq.REP
         )  # REP socket for both BaseSearcher and DiskANN C++ REQ clients
-        socket.bind(f"tcp://*:{zmq_port}")
-        logger.info(f"DiskANN ZMQ REP server listening on port {zmq_port}")
+        zmq_host = os.getenv("LEANN_EMBEDDING_SERVER_HOST", "127.0.0.1")
+        if ":" in zmq_host and not zmq_host.startswith("["):
+            zmq_host = f"[{zmq_host}]"  # literal IPv6 needs brackets in ZMQ endpoints
+        socket.bind(f"tcp://{zmq_host}:{zmq_port}")
+        logger.info(f"DiskANN ZMQ REP server listening on {zmq_host}:{zmq_port}")
 
         socket.setsockopt(zmq.RCVTIMEO, 1000)
         socket.setsockopt(zmq.SNDTIMEO, 1000)
@@ -260,8 +263,11 @@ def zmq_server_thread_with_shutdown(shutdown_event):
 
         context = zmq.Context()
         rep_socket = context.socket(zmq.REP)
-        rep_socket.bind(f"tcp://*:{zmq_port}")
-        logger.info(f"DiskANN ZMQ REP server listening on port {zmq_port}")
+        zmq_host = os.getenv("LEANN_EMBEDDING_SERVER_HOST", "127.0.0.1")
+        if ":" in zmq_host and not zmq_host.startswith("["):
+            zmq_host = f"[{zmq_host}]"  # literal IPv6 needs brackets in ZMQ endpoints
+        rep_socket.bind(f"tcp://{zmq_host}:{zmq_port}")
+        logger.info(f"DiskANN ZMQ REP server listening on {zmq_host}:{zmq_port}")
 
         # Set receive timeout so we can check shutdown_event periodically
         rep_socket.setsockopt(zmq.RCVTIMEO, 1000)  # 1 second timeout
```

**File**: `packages/leann-backend-hnsw/leann_backend_hnsw/hnsw_embedding_server.py` (modified, +5/-2)
```diff
@@ -168,8 +168,11 @@ def zmq_server_thread_with_shutdown(shutdown_event):
 
         context = zmq.Context()
         rep_socket = context.socket(zmq.REP)
-        rep_socket.bind(f"tcp://*:{zmq_port}")
-        logger.info(f"HNSW ZMQ REP server listening on port {zmq_port}")
+        zmq_host = os.getenv("LEANN_EMBEDDING_SERVER_HOST", "127.0.0.1")
+        if ":" in zmq_host and not zmq_host.startswith("["):
+            zmq_host = f"[{zmq_host}]"  # literal IPv6 needs brackets in ZMQ endpoints
+        rep_socket.bind(f"tcp://{zmq_host}:{zmq_port}")
+        logger.info(f"HNSW ZMQ REP server listening on {zmq_host}:{zmq_port}")
         rep_socket.setsockopt(zmq.RCVTIMEO, 1000)
         rep_socket.setsockopt(zmq.SNDTIMEO, 1000)
         rep_socket.setsockopt(zmq.LINGER, 0)
```

---

### Incident Patch 11: `9cbe7c2a` (2026-09-05)
**Commit Message**: fix: force fp32 embeddings when the resolved device is CPU (#405)

compute_embeddings_sentence_transformers loads the model with
torch_dtype=float16 whenever use_fp16 is true (the default), regardless
of the resolved device. CPU torch has no fp16 kernels for several ops,
so on CPU-only machines every build/search crashes with

    RuntimeError: "LayerNormKernelImpl" not implemented for 'Half'

and no flag or env var reaches use_fp16 to work around it. Disable fp16
when the device resolves to cpu; cuda and mps keep the fp16 default.

Reproduced on Linux x86_64, torch 2.2.2+cpu, Python 3.12, model
sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2; verified
fixed with this exact guard on the same setup (full 39k-chunk build).

**File**: `packages/leann-core/src/leann/embedding_compute.py` (modified, +6/-0)
```diff
@@ -546,6 +546,12 @@ def compute_embeddings_sentence_transformers(
         else:
             device = "cpu"
 
+    # CPU torch ships no fp16 kernels for several ops (LayerNorm raises
+    # "LayerNormKernelImpl" not implemented for 'Half') - force fp32 on CPU.
+    if device == "cpu" and use_fp16:
+        use_fp16 = False
+        logger.info("CPU device detected: disabling fp16 (no fp16 CPU kernels)")
+
     # Apply optimizations based on benchmark results
     if adaptive_optimization:
         batch_size = _resolve_adaptive_batch_size(device, model_name)
```

---

### Incident Patch 12: `9c612583` (2026-09-05)
**Commit Message**: fix(mcp): answer `ping` with an empty result, not -32601 (#411)

#384 stopped unknown requests being answered with silence, which was the cause
of the respawn loops in #403 — a client whose liveness probe got no reply read
the transport as dead and killed the subprocess.

`ping` is still wrong, though, just less visibly. It is not an unknown method:
MCP requires a ping request to be answered with an empty result. Falling
through to the -32601 branch tells the client its keepalive is unsupported,
which is a different wrong answer from silence.

Handle it explicitly. Tests cover the ping response and pin the two behaviours
around it that must not regress: an unknown *request* still gets -32601, and a
notification (no id) still gets no reply at all.

Note for #403: the reporter was on leann-core 0.3.7, which predates #384, so
the silent-hang half of that report is already fixed on main. This closes the
remaining half.

Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>

**File**: `packages/leann-core/src/leann/mcp.py` (modified, +12/-0)
```diff
@@ -340,6 +340,18 @@ def handle_request(request):
     if method == "notifications/initialized":
         return None
 
+    if method == "ping":
+        # MCP requires a ping request to be answered with an empty result.
+        # Without this it falls through to the -32601 branch below, which tells
+        # a client its liveness probe is unsupported — a different wrong answer
+        # from the silence #384 fixed, but still one that breaks keepalives
+        # (issue #403).
+        return {
+            "jsonrpc": "2.0",
+            "id": request_id,
+            "result": {},
+        }
+
     if method == "tools/list":
         return {
             "jsonrpc": "2.0",
```

**File**: `tests/test_mcp_dispatch.py` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+"""JSON-RPC dispatch rules for the MCP server (see issue #403).
+
+#384 stopped unknown *requests* from being answered with silence, which was
+the cause of the client respawn loops. `ping` is not an unknown method though:
+it is a required MCP utility, and the spec says a ping request is answered with
+an empty result. Answering it with -32601 tells a client its liveness probe is
+unsupported, which is a different wrong answer from the original silence.
+"""
+
+from leann.mcp import handle_request
+
+
+def test_ping_returns_an_empty_result():
+    response = handle_request({"jsonrpc": "2.0", "id": 3, "method": "ping"})
+
+    assert response is not None, "silence is what caused the respawn loops"
+    assert response["id"] == 3
+    assert response["result"] == {}
+    assert "error" not in response
+
+
+def test_ping_with_params_is_still_a_ping():
+    response = handle_request({"jsonrpc": "2.0", "id": 4, "method": "ping", "params": {}})
+
+    assert response["result"] == {}
+
+
+def test_unknown_request_still_gets_method_not_found():
+    """#384's behaviour must survive: an unknown request is an error, not silence."""
+    response = handle_request({"jsonrpc": "2.0", "id": 9, "method": "server/discover"})
+
+    assert response["error"]["code"] == -32601
+
+
+def test_notifications_get_no_response():
+    """JSON-RPC 2.0: a notification has no id and must never be answered."""
+    assert handle_request({"jsonrpc": "2.0", "method": "notifications/initialized"}) is None
+    assert handle_request({"jsonrpc": "2.0", "method": "some/unknown/notification"}) is None
```

---

### Incident Patch 13: `7d1eb7be` (2026-09-05)
**Commit Message**: fix: recover from corrupt sync snapshots (#410)

**File**: `packages/leann-core/src/leann/sync.py` (modified, +10/-0)
```diff
@@ -299,3 +299,13 @@ def load_snapshot(self):
                 self.tree = pickle.load(f)
         except FileNotFoundError:
             self.tree = None
+        except (
+            OSError,
+            EOFError,
+            pickle.UnpicklingError,
+            AttributeError,
+            ImportError,
+            IndexError,
+        ) as exc:
+            logger.warning("Cannot load sync snapshot %s: %s", self.snapshot_path, exc)
+            self.tree = None
```

**File**: `tests/test_sync.py` (modified, +18/-0)
```diff
@@ -56,6 +56,24 @@ def test_added_removed_modified(self):
 
 
 class TestFileSynchronizer(unittest.TestCase):
+    def test_corrupt_snapshot_is_rebuilt(self):
+        with tempfile.TemporaryDirectory() as temp_dir:
+            root = Path(temp_dir)
+            document = root / "file.txt"
+            document.write_text("hello world", encoding="utf-8")
+            snapshot = root / "sync.pickle"
+            snapshot.write_bytes(b"truncated pickle")
+
+            synchronizer = FileSynchronizer(
+                root_dir=temp_dir,
+                snapshot_path=str(snapshot),
+            )
+
+            added, removed, modified = synchronizer.detect_changes()
+            assert added == [str(document.resolve())]
+            assert removed == []
+            assert modified == []
+
     def test_generate_file_hashes(self):
         with tempfile.TemporaryDirectory() as temp_dir:
             file_path = Path(temp_dir) / "file.txt"
```

---

### Incident Patch 14: `00ac7cd5` (2026-09-05)
**Commit Message**: fix(core): import the hnsw backend lazily in leann-core (#409)

`packages/leann-core/src/leann/api.py` imported
`leann_backend_hnsw.convert_to_csr` at module scope, but `leann-core`
declares no `leann-backend-*` dependency -- it is the plugin host and
discovers backends at runtime via `registry.autodiscover_backends()`.

Because `leann/__init__.py` re-exports from `.api`, that import made
`import leann` raise `ModuleNotFoundError` on any install without
`leann-backend-hnsw`, taking the `leann` and `leann_mcp` console scripts
with it. It affects `leann-core` paired with a non-HNSW backend and the
`pip install "leann-core[litellm]"` path in the configuration guide; the
umbrella `leann` package pulls HNSW in, which hid the problem.

The symbol has one call site, in the HNSW branch of `update_index`,
after a lazy `from leann_backend_hnsw import faiss` has already
established the backend is present. Move the import there, matching the
function-local pattern used by every other backend reference in the
file.

Adds a regression test in `tests/test_cpu_only_install.py` that
AST-parses `leann-core` and asserts no module-scope import names a
`leann_backend_*` module.

**File**: `packages/leann-core/src/leann/api.py` (modified, +2/-1)
```diff
@@ -17,7 +17,6 @@
 from typing import Any, Literal, Optional, Union
 
 import numpy as np
-from leann_backend_hnsw.convert_to_csr import prune_hnsw_embeddings_inplace
 
 from leann.interactive_utils import create_api_session
 from leann.interface import LeannBackendSearcherInterface
@@ -1189,6 +1188,8 @@ def update_index(self, index_path: str, remove_passage_ids: Optional[list[str]]
         self.chunks.clear()
 
         if needs_recompute:
+            from leann_backend_hnsw.convert_to_csr import prune_hnsw_embeddings_inplace
+
             prune_hnsw_embeddings_inplace(str(index_file))
 
 
```

**File**: `tests/test_cpu_only_install.py` (modified, +39/-0)
```diff
@@ -1,5 +1,6 @@
 """Packaging metadata checks for CPU-only installs."""
 
+import ast
 from pathlib import Path
 
 import pytest
@@ -15,6 +16,21 @@ def _load_leann_pyproject():
     return tomllib.loads(pyproject_path.read_text())
 
 
+def _leann_core_source_files():
+    package_root = Path(__file__).resolve().parents[1] / "packages" / "leann-core" / "src" / "leann"
+    return sorted(package_root.rglob("*.py"))
+
+
+def _module_scope_imports(source: str):
+    """Yield (lineno, module) for every import executed at module scope."""
+    for node in ast.parse(source).body:
+        if isinstance(node, ast.Import):
+            for alias in node.names:
+                yield node.lineno, alias.name
+        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
+            yield node.lineno, node.module
+
+
 def _load_leann_core_pyproject():
     pyproject_path = (
         Path(__file__).resolve().parents[1] / "packages" / "leann-core" / "pyproject.toml"
@@ -59,3 +75,26 @@ def test_leann_cpu_extra_defined():
 
     assert "cpu" in extras
     assert "leann-core[cpu]>=0.1.0" in extras["cpu"]
+
+
+def test_leann_core_does_not_import_a_backend_at_module_scope():
+    """leann-core declares no leann-backend-* dependency, so importing one eagerly
+    turns `import leann` into a ModuleNotFoundError for anyone who installed
+    leann-core on its own or paired it with a non-HNSW backend."""
+    data = _load_leann_core_pyproject()
+    deps = data["project"].get("dependencies", [])
+    assert not any(dep.startswith("leann-backend") for dep in deps), (
+        "leann-core now depends on a backend; this test needs revisiting"
+    )
+
+    offenders = [
+        f"{path.name}:{lineno} imports {module}"
+        for path in _leann_core_source_files()
+        for lineno, module in _module_scope_imports(path.read_text(encoding="utf-8"))
+        if module.split(".")[0].startswith("leann_backend")
+    ]
+
+    assert not offenders, (
+        "leann-core must import backends lazily inside the functions that use them: "
+        + "; ".join(offenders)
+    )
```

---

### Incident Patch 15: `794092ff` (2026-08-25)
**Commit Message**: fix(search): support CJK terms in FTS5 BM25 (#401)

**File**: `packages/leann-core/src/leann/api.py` (modified, +49/-8)
```diff
@@ -39,6 +39,30 @@
 PASSAGE_ID_SCHEME_SEQUENTIAL = "sequential"
 PASSAGE_ID_SCHEME_CONTENT_HASH = "content-hash"
 
+_CJK_CHARACTERS = "\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af"
+_CJK_RUN = re.compile(f"[{_CJK_CHARACTERS}]+")
+
+
+def _fts5_cjk_ngrams(match: re.Match[str]) -> str:
+    """Expand a CJK run into unigram and bigram tokens for SQLite FTS5."""
+    text = match.group()
+    return " ".join([*text, *(text[i : i + 2] for i in range(len(text) - 1))])
+
+
+def _fts5_cjk_query(query: str) -> str:
+    """Build a safe FTS5 query that requires every CJK bigram in each term."""
+    tokens = re.findall(rf"[{_CJK_CHARACTERS}]+|\w+", query.lower())
+    terms = []
+    for token in tokens:
+        if _CJK_RUN.fullmatch(token):
+            ngrams = (
+                [token] if len(token) == 1 else [token[i : i + 2] for i in range(len(token) - 1)]
+            )
+            terms.append("(" + " AND ".join(f'"{ngram}"' for ngram in ngrams) + ")")
+        else:
+            terms.append(f'"{token}"')
+    return " OR ".join(terms)
+
 
 def get_registered_backends() -> list[str]:
     """Get list of registered backend names."""
@@ -322,15 +346,18 @@ class Fts5BM25Index(BM25Index):
         ")"
     )
 
-    def __init__(self, db_path: str):
+    def __init__(self, db_path: str, cjk_ngrams: Optional[bool] = None):
         self._db_path = db_path
         self._conn: Optional[Any] = None
+        self._cjk_ngrams = cjk_ngrams
 
     def _connect(self):
         import sqlite3
 
         if self._conn is None:
             self._conn = sqlite3.connect(self._db_path)
+            if self._cjk_ngrams is None:
+                self._cjk_ngrams = bool(self._conn.execute("PRAGMA user_version").fetchone()[0])
         return self._conn
 
     def fit(self, documents: list[dict[str, Any]]) -> None:
@@ -339,25 +366,39 @@ def fit(self, documents: list[dict[str, Any]]) -> None:
         # Fresh DB every fit — fit() is a one-shot bulk-load.
         if os.path.exists(self._db_path):
             os.unlink(self._db_path)
+        if self._cjk_ngrams is None:
+            self._cjk_ngrams = True
         conn = sqlite3.connect(self._db_path)
         try:
             conn.execute(self._SCHEMA)
+            conn.execute(f"PRAGMA user_version = {int(self._cjk_ngrams)}")
             conn.executemany(
                 "INSERT INTO bm25_passages(id, text) VALUES (?, ?)",
-                ((d["id"], d.get("text", "")) for d in documents),
+                (
+                    (
+                        d["id"],
+                        _CJK_RUN.sub(_fts5_cjk_ngrams, d.get("text", ""))
+                        if self._cjk_ngrams
+                        else d.get("text", ""),
+                    )
+                    for d in documents
+                ),
             )
             conn.commit()
         finally:
             conn.close()
 
     def search(self, query: str, top_k: int = 5) -> list["SearchResult"]:
-        # Strip punctuation, lowercase, OR the terms together. Avoids FTS5
-        # query syntax surprises (`:`, `*`, etc.) for natural-language queries.
-        terms = re.sub(r"[^\w\s]", "", query).lower().split()
-        if not terms:
-            return []
-        fts5_query = " OR ".join(terms)
+        # Expand CJK terms to the same n-grams used at index time. Older
+        # databases retain their legacy query behaviour via PRAGMA user_version.
         conn = self._connect()
+        if self._cjk_ngrams:
+            fts5_query = _fts5_cjk_query(query)
+        else:
+            terms = re.sub(r"[^\w\s]", "", query).lower().split()
+            fts5_query = " OR ".join(terms)
+        if not fts5_query:
+            return []
         rows = conn.execute(
             "SELECT id, -bm25(bm25_passages) AS score "
             "FROM bm25_passages WHERE bm25_passages MATCH ? "
```

**File**: `tests/test_fts5_bm25.py` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+from leann.api import Fts5BM25Index
+
+
+def test_fts5_bm25_matches_chinese_substrings_after_reopen(tmp_path):
+    db_path = tmp_path / "passages.sqlite"
+    index = Fts5BM25Index(str(db_path))
+    index.fit(
+        [
+            {"id": "database", "text": "数据库检索系统"},
+            {"id": "image", "text": "图像分类系统"},
+        ]
+    )
+    index.close()
+
+    reopened = Fts5BM25Index(str(db_path))
+    try:
+        assert [result.id for result in reopened.search("数据库")] == ["database"]
+    finally:
+        reopened.close()
+
+
+def test_fts5_bm25_keeps_legacy_database_query_format(tmp_path):
+    db_path = tmp_path / "legacy.sqlite"
+    index = Fts5BM25Index(str(db_path), cjk_ngrams=False)
+    index.fit([{"id": "database", "text": "database retrieval"}])
+    index.close()
+
+    reopened = Fts5BM25Index(str(db_path))
+    try:
+        assert [result.id for result in reopened.search("database")] == ["database"]
+    finally:
+        reopened.close()
```

#### Recent Merged Pull Requests:
- **PR #431** (closed): feat: add Cheaper Inference LLM provider (@aiapienthusiast)
- **PR #427** (2026-09-29): fix(core): honour an explicit passage ID of 0 and key the offset map by string (@Lesereingrape)
- **PR #425** (2026-09-26): fix(ci): clear the ty diagnostics blocking every open PR (@ASuresh0524)
- **PR #422** (2026-09-26): fix: align custom IDs in array-built indexes (@dafyy321-pixel)
- **PR #421** (2026-09-26): fix(mcp): honor --base-dir across tools (@dafyy321-pixel)
- **PR #420** (2026-09-26): fix(core): judge an explicitly named file by its own name, not its ancestors (@serhiizghama)
- **PR #419** (2026-09-22): fix: include live Chrome history in SQLite snapshots (@Iams4kura)
- **PR #416** (2026-09-19): fix: remove conflicting index command registrations (@emecii)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
