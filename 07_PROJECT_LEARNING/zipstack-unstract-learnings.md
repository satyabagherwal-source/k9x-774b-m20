# Forensic Learning Record (Deep Inspection): Zipstack/unstract

> **Canonical Artifact**: `07_PROJECT_LEARNING/zipstack-unstract-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Zipstack/unstract](https://github.com/Zipstack/unstract))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:42:48.073Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Zipstack/unstract`
- **Description**: LLM-Driven Extraction of Unstructured Data — Built for API Deployments & ETL Pipeline Workflows
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 7266 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/skills/adapter-ops/scripts/check_adapter_updates.py`
```
#!/usr/bin/env python3
"""Check for updates to existing LLM and Embedding adapters.

This script analyzes current adapter JSON schemas and compares them
against known LiteLLM features to identify potential updates.

Usage:
    python check_adapter_updates.py
    python check_adapter_updates.py --adapter llm
    python check_adapter_updates.py --adapter embedding
    python check_adapter_updates.py --provider openai
"""

import argparse
import json
import sys
from pathlib import Path

# Resolve paths
SCRIPT_DIR = Path(__file__).parent
SKILL_DIR = SCRIPT_DIR.parent
REPO_ROOT = SKILL_DIR.parent.parent.parent
SDK1_ADAPTERS = REPO_ROOT / "unstract" / "sdk1" / "src" / "unstract" / "sdk1" / "adapters"

# Known LiteLLM features by provider (update this periodically)
LITELLM_FEATURES = {
    "llm": {
        "openai": {
            "known_params": [
                "api_key",
                "api_base",
                "api_version",
                "model",
                "max_tokens",
                "max_retries",
                "timeout",
                "temperature",
                "top_p",
                "n",
                "enable_reasoning",
                "reasoning_effort",
                "seed",
                "response_format",
                "tools",
                "tool_choice",
                "parallel_tool_calls",
                "logprobs",
            ],
            "reasoning_models": ["o1-mini", "o1-preview", "o3-mini", "o3", "o4-mini"],
            "latest_models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-5"],
            "docs_url": "https://docs.litellm.ai/docs/providers/openai",
        },
        "anthropic": {
            "known_params": [
                "api_key",
                "model",
                "max_tokens",
                "max_retries",
                "timeout",
                "temperature",
                "enable_thinking",
                "budget_tokens",
                "thinking",
            ],
            "thinking_models": ["claude-3-7-sonnet", "claude-sonnet-4", "claude-opus-4"],
            "latest_models": ["claude-sonnet-4-5-20250929", "claude-opus-4-1-20250805"],
            "docs_url": "https://docs.litellm.ai/docs/providers/anthropic",
        },
        "azure": {
            "known_params": [
                "api_key",
                "api_base",
                "api_version",
                "deployment_name",
                "azure_endpoint",
                "model",
                "max_tokens",
                "max_retries",
                "timeout",
                "temperature",
                "enable_reasoning",
                "reasoning_effort",
            ],
            "reasoning_models": ["o1-mini", "o1-preview"],
            "docs_url": "https://docs.litellm.ai/docs/providers/azure",
        },
        "bedrock": {
            "known_params": [
                "aws_access_key_id",
                "aws_secret_access_key",
                "region_name",
                "aws_region_name",
                "aws_profile_name",
                "model_id",
                "model",
                "max_tokens",
                "max_retries",
                "timeout",
                "temperature",
                "enable_thinking",
                "budget_tokens",
                "thinking",
                "top_k",
            ],
            "thinking_models": ["anthropic.claude-3-7-sonnet"],
            "docs_url": "https://docs.litellm.ai/docs/providers/bedrock",
        },
        "vertex_ai": {
            "known_params": [
                "json_credentials",
                "vertex_credentials",
                "project",
                "vertex_project",
                "model",
                "max_tokens",
                "max_retries",
                "timeout",
                "temperature",
                "safety_settings",
                "enable_thinking",
                "budget_tokens",
                "thinking",
                "reasoning_effort",
                "tools",
                "googleSearch",
            ],
            "thinking_models": ["gemini-2.5-flash-preview", "gemini-2.5-pro"],
            "docs_url": "https://docs.litellm.ai/docs/providers/vertex",
        },
        "mistral": {
            "known_params": [
                "api_key",
                "model",
                "max_tokens",
                "max_retries",
                "timeout",
                "temperature",
                "enable_reasoning",
                "reasoning_effort",
                "tools",
            ],
            "reasoning_models": ["magistral-medium-2506", "magistral-small-2506"],
            "latest_models": ["mistral-large-latest", "mistral-small-latest"],
            "docs_url": "https://docs.litellm.ai/docs/providers/mistral",
        },
        "ollama": {
            "known_params": [
                "base_url",
                "api_base",
                "model",
                "max_tokens",
                "temperature",
                "context_window",
                "request_timeout",
                "json_mode",
                "response_format",
                "tools",
            ],
            "docs_url": "https://docs.litellm.ai/docs/providers/ollama",
        },
        "anyscale": {
            "known_params": [
                "api_key",
                "api_base",
                "model",
                "max_tokens",
                "max_retries",
                "timeout",
                "temperature",
                "additional_kwargs",
            ],
            "docs_url": "https://docs.litellm.ai/docs/providers/anyscale",
        },
    },
    "embedding": {
        "openai": {
            "known_params": [
                "api_key",
                "api_base",
                "model",
                "embed_batch_size",
                "timeout",
                "dimensions",
            ],
            "latest_models": ["text-embedding-3-small", "text-embedding-3-large"],
            "docs_url": "https://docs.litellm.ai/docs/embedding/supported_embedding",
        },
        "azure": {
            "known_params": [
                "api_key",
                "api_base",
                "api_version",
                "deployment_name",
                "azure_endpoint",
                "model",
                "embed_batch_size",
                "timeout",
                "dimensions",
            ],
            "docs_url": "https://docs.litellm.ai/docs/providers/azure",
        },
        "bedrock": {
            "known_params": [
                "aws_access_key_id",
                "aws_secret_access_key",
                "region_name",
                "aws_region_name",
                "model",
                "max_retries",
                "timeout",
            ],
            "docs_url": "https://docs.litellm.ai/docs/providers/bedrock_embedding",
        },
        "vertexai": {
            "known_params": [
                "json_credentials",
                "vertex_credentials",
                "project",
                "vertex_project",
                "model",
                "embed_batch_size",
                "embed_mode",
                "dimensions",
                "input_type",
            ],
            "docs_url": "https://docs.litellm.ai/docs/providers/vertex",
        },
        "ollama": {
            "known_params": [
                "base_url",
                "api_base",
                "model_name",
                "model",
                "embed_batch_size",
            ],
            "docs_url": "https://docs.litellm.ai/docs/providers/ollama",
        },
    },
}


def load_json_schema(adapter_type: str, provider: str) -> dict | None:
    """Load JSON schema for an adapter."""
    schema_dir = SDK1_ADAPTERS / f"{adapter_type}1" / "static"

    # Try common filename patterns
    for filename in [f"{provider}.json", f"{provider.replace('_', '')}.json"]:
        schema_path = schema_dir / filename

```

### Core Architecture Module: `.claude/skills/adapter-ops/scripts/init_embedding_adapter.py`
```
#!/usr/bin/env python3
"""Initialize a new Embedding adapter for unstract/sdk1.

Usage:
    python init_embedding_adapter.py --provider newprovider --name "New Provider" --description "Description"
    python init_embedding_adapter.py --provider newprovider --name "New Provider" --description "Description" --logo-url "https://example.com/logo.png"
    python init_embedding_adapter.py --provider newprovider --name "New Provider" --description "Description" --auto-logo

This script creates:
    1. Adapter Python file in embedding1/{provider}.py
    2. JSON schema in embedding1/static/{provider}.json
    3. Optionally adds parameter class stub to base1.py
    4. Optionally downloads and adds provider logo (from URL or auto-detected)
"""

import argparse
import json
import sys
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# Resolve paths
SCRIPT_DIR = Path(__file__).parent
SKILL_DIR = SCRIPT_DIR.parent
# Find the sdk1 adapters directory relative to the repo root
REPO_ROOT = SKILL_DIR.parent.parent.parent  # .claude/skills/adapter-ops -> repo root
SDK1_ADAPTERS = REPO_ROOT / "unstract" / "sdk1" / "src" / "unstract" / "sdk1" / "adapters"
ICONS_DIR = REPO_ROOT / "frontend" / "public" / "icons" / "adapter-icons"

EMBEDDING_ADAPTER_TEMPLATE = """from typing import Any

from unstract.sdk1.adapters.base1 import BaseAdapter, {param_class}
from unstract.sdk1.adapters.enums import AdapterTypes


class {class_name}({param_class}, BaseAdapter):
    @staticmethod
    def get_id() -> str:
        return "{provider}|{uuid}"

    @staticmethod
    def get_metadata() -> dict[str, Any]:
        return {{
            "name": "{display_name}",
            "version": "1.0.0",
            "adapter": {class_name},
            "description": "{description}",
            "is_active": True,
        }}

    @staticmethod
    def get_name() -> str:
        return "{display_name}"

    @staticmethod
    def get_description() -> str:
        return "{description}"

    @staticmethod
    def get_provider() -> str:
        return "{provider}"

    @staticmethod
    def get_icon() -> str:
        return "/icons/adapter-icons/{icon_name}.png"

    @staticmethod
    def get_adapter_type() -> AdapterTypes:
        return AdapterTypes.EMBEDDING
"""

EMBEDDING_SCHEMA_TEMPLATE = {
    "title": "{display_name} Embedding",
    "type": "object",
    "required": ["adapter_name", "api_key"],
    "properties": {
        "adapter_name": {
            "type": "string",
            "title": "Name",
            "default": "",
            "description": "Provide a unique name for this adapter instance. Example: {provider}-emb-1",
        },
        "model": {
            "type": "string",
            "title": "Model",
            "default": "",
            "description": "Provide the name of the embedding model.",
        },
        "api_key": {
            "type": "string",
            "title": "API Key",
            "default": "",
            "format": "password",
            "description": "Your {display_name} API key.",
        },
        "api_base": {
            "type": "string",
            "title": "API Base",
            "format": "uri",
            "default": "",
            "description": "API endpoint URL (if different from default).",
        },
        "embed_batch_size": {
            "type": "number",
            "minimum": 1,
            "multipleOf": 1,
            "title": "Embed Batch Size",
            "default": 10,
            "description": "Number of texts to embed in each batch.",
        },
        "timeout": {
            "type": "number",
            "minimum": 0,
            "multipleOf": 1,
            "title": "Timeout",
            "default": 240,
            "description": "Timeout in seconds",
        },
    },
}

PARAMETER_CLASS_TEMPLATE = '''
class {param_class}(BaseEmbeddingParameters):
    """See https://docs.litellm.ai/docs/providers/{provider}."""

    api_key: str
    api_base: str | None = None
    embed_batch_size: int | None = 10

    @staticmethod
    def validate(adapter_metadata: dict[str, "Any"]) -> dict[str, "Any"]:
        adapter_metadata["model"] = {param_class}.validate_model(adapter_metadata)
        return {param_class}(**adapter_metadata).model_dump()

    @staticmethod
    def validate_model(adapter_metadata: dict[str, "Any"]) -> str:
        model = adapter_metadata.get("model", "")
        return model

'''


def to_class_name(provider: str) -> str:
    """Convert provider name to class name format."""
    special_cases = {
        "openai": "OpenAI",
        "azure_openai": "AzureOpenAI",
        "azure_ai_foundry": "AzureAIFoundry",
        "azure_ai": "AzureAI",
        "vertexai": "VertexAI",
        "aws_bedrock": "AWSBedrock",
        "bedrock": "AWSBedrock",
    }
    if provider.lower() in special_cases:
        return special_cases[provider.lower()]

    return "".join(
        word.capitalize() for word in provider.replace("_", " ").replace("-", " ").split()
    )


def to_icon_name(display_name: str) -> str:
    """Convert display name to icon filename (without extension)."""
    return display_name.replace(" ", "")


def fetch_url(url: str, timeout: int = 10) -> bytes | None:
    """Fetch content from URL with error handling."""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        request = Request(url, headers=headers)
        with urlopen(request, timeout=timeout) as response:
            return response.read()
    except (URLError, HTTPError, TimeoutError):
        return None


def search_potential_logo_sources(provider: str, display_name: str) -> list[dict]:
    """Search for potential logo sources for the given provider.

    This function only SEARCHES for potential sources and returns them.
    It does NOT verify if the logos are correct - that's up to the user.

    Returns:
        List of dicts with 'url' and 'source' keys for potential logos found
    """
    found_sources = []
    provider_lower = provider.lower().replace("_", "").replace("-", "")
    name_lower = display_name.lower().replace(" ", "")

    # Try Clearbit Logo API with common domain patterns
    domains = [
        (f"{provider_lower}.com", "company domain"),
        (f"{provider_lower}.ai", "AI domain"),
        (f"{name_lower}.com", "name domain"),
        (f"{name_lower}.ai", "name AI domain"),
    ]

    for domain, source_type in domains:
        url = f"https://logo.clearbit.com/{domain}"
        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            request = Request(url, headers=headers, method="HEAD")
            with urlopen(request, timeout=5) as response:
                if response.status == 200:
                    found_sources.append(
                        {"url": url, "source": f"Clearbit ({source_type}: {domain})"}
                    )
        except (URLError, HTTPError, TimeoutError):
            continue

    # Try GitHub organization avatars
    github_names = [
        provider_lower,
        name_lower,
        provider.lower().replace("_", "-"),
    ]

    for name in github_names:
        url = f"https://github.com/{name}.png?size=512"
        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            request = Request(url, headers=headers, method="HEAD")
            with urlopen(request, timeout=5) as response:
                if response.status == 200:
                    content_type = response.headers.get("Content-Type", "")
                    if "image" in content_type:
                        found_sources.append(
                            {"url": url, "source": f"GitHub avatar (@{name})"}
                        )
        except (URLError, HTTPError, TimeoutError):
            continue

    return found_sources


def download_and_process_logo(
    url: str, output_path: Path, target_size: int = 512
) -> bool:
    """Download logo 
```

### Core Architecture Module: `.claude/skills/adapter-ops/scripts/init_llm_adapter.py`
```
#!/usr/bin/env python3
"""Initialize a new LLM adapter for unstract/sdk1.

Usage:
    python init_llm_adapter.py --provider newprovider --name "New Provider" --description "Description"
    python init_llm_adapter.py --provider newprovider --name "New Provider" --description "Description" --logo-url "https://example.com/logo.png"
    python init_llm_adapter.py --provider newprovider --name "New Provider" --description "Description" --auto-logo

This script creates:
    1. Adapter Python file in llm1/{provider}.py
    2. JSON schema in llm1/static/{provider}.json
    3. Optionally adds parameter class stub to base1.py
    4. Optionally downloads and adds provider logo (from URL or auto-detected)
"""

import argparse
import json
import sys
import urllib.parse
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# Resolve paths
SCRIPT_DIR = Path(__file__).parent
SKILL_DIR = SCRIPT_DIR.parent
# Find the sdk1 adapters directory relative to the repo root
REPO_ROOT = SKILL_DIR.parent.parent.parent  # .claude/skills/adapter-ops -> repo root
SDK1_ADAPTERS = REPO_ROOT / "unstract" / "sdk1" / "src" / "unstract" / "sdk1" / "adapters"
ICONS_DIR = REPO_ROOT / "frontend" / "public" / "icons" / "adapter-icons"

LLM_ADAPTER_TEMPLATE = """from typing import Any

from unstract.sdk1.adapters.base1 import BaseAdapter, {param_class}
from unstract.sdk1.adapters.enums import AdapterTypes


class {class_name}({param_class}, BaseAdapter):
    @staticmethod
    def get_id() -> str:
        return "{provider}|{uuid}"

    @staticmethod
    def get_metadata() -> dict[str, Any]:
        return {{
            "name": "{display_name}",
            "version": "1.0.0",
            "adapter": {class_name},
            "description": "{description}",
            "is_active": True,
        }}

    @staticmethod
    def get_name() -> str:
        return "{display_name}"

    @staticmethod
    def get_description() -> str:
        return "{description}"

    @staticmethod
    def get_provider() -> str:
        return "{provider}"

    @staticmethod
    def get_icon() -> str:
        return "/icons/adapter-icons/{icon_name}.png"

    @staticmethod
    def get_adapter_type() -> AdapterTypes:
        return AdapterTypes.LLM
"""

LLM_SCHEMA_TEMPLATE = {
    "title": "{display_name} LLM",
    "type": "object",
    "required": ["adapter_name", "api_key"],
    "properties": {
        "adapter_name": {
            "type": "string",
            "title": "Name",
            "default": "",
            "description": "Provide a unique name for this adapter instance. Example: {provider}-llm-1",
        },
        "api_key": {
            "type": "string",
            "title": "API Key",
            "format": "password",
            "description": "Your {display_name} API key.",
        },
        "model": {
            "type": "string",
            "title": "Model",
            "default": "",
            "description": "The model to use for the API request.",
        },
        "max_tokens": {
            "type": "number",
            "minimum": 0,
            "multipleOf": 1,
            "title": "Maximum Output Tokens",
            "description": "Maximum number of output tokens to limit LLM replies.",
        },
        "max_retries": {
            "type": "number",
            "minimum": 0,
            "multipleOf": 1,
            "title": "Max Retries",
            "default": 5,
            "description": "The maximum number of times to retry a request if it fails.",
        },
        "timeout": {
            "type": "number",
            "minimum": 0,
            "multipleOf": 1,
            "title": "Timeout",
            "default": 900,
            "description": "Timeout in seconds",
        },
    },
}

PARAMETER_CLASS_TEMPLATE = '''
class {param_class}(BaseChatCompletionParameters):
    """See https://docs.litellm.ai/docs/providers/{provider}."""

    api_key: str

    @staticmethod
    def validate(adapter_metadata: dict[str, "Any"]) -> dict[str, "Any"]:
        adapter_metadata["model"] = {param_class}.validate_model(adapter_metadata)
        return {param_class}(**adapter_metadata).model_dump()

    @staticmethod
    def validate_model(adapter_metadata: dict[str, "Any"]) -> str:
        model = adapter_metadata.get("model", "")
        # Only add {provider}/ prefix if the model doesn't already have it
        if model.startswith("{provider}/"):
            return model
        else:
            return f"{provider}/{{model}}"

'''


def to_class_name(provider: str) -> str:
    """Convert provider name to class name format."""
    # Handle special cases
    special_cases = {
        "openai": "OpenAI",
        "azure_openai": "AzureOpenAI",
        "azure_ai_foundry": "AzureAIFoundry",
        "azure_ai": "AzureAI",
        "vertexai": "VertexAI",
        "aws_bedrock": "AWSBedrock",
        "bedrock": "AWSBedrock",
    }
    if provider.lower() in special_cases:
        return special_cases[provider.lower()]

    # Default: capitalize each word
    return "".join(
        word.capitalize() for word in provider.replace("_", " ").replace("-", " ").split()
    )


def to_icon_name(display_name: str) -> str:
    """Convert display name to icon filename (without extension).

    Removes spaces and special characters for cleaner filenames.
    """
    return display_name.replace(" ", "")


def fetch_url(url: str, timeout: int = 10) -> bytes | None:
    """Fetch content from URL with error handling."""
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return None
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        request = Request(url, headers=headers)
        with urlopen(request, timeout=timeout) as response:
            return response.read()
    except (URLError, HTTPError, TimeoutError):
        return None


def search_potential_logo_sources(provider: str, display_name: str) -> list[dict]:
    """Search for potential logo sources for the given provider.

    This function only SEARCHES for potential sources and returns them.
    It does NOT verify if the logos are correct - that's up to the user.

    Returns:
        List of dicts with 'url' and 'source' keys for potential logos found
    """
    found_sources = []
    provider_lower = provider.lower().replace("_", "").replace("-", "")
    name_lower = display_name.lower().replace(" ", "")

    # Try Clearbit Logo API with common domain patterns
    domains = [
        (f"{provider_lower}.com", "company domain"),
        (f"{provider_lower}.ai", "AI domain"),
        (f"{name_lower}.com", "name domain"),
        (f"{name_lower}.ai", "name AI domain"),
    ]

    for domain, source_type in domains:
        url = f"https://logo.clearbit.com/{domain}"
        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            request = Request(url, headers=headers, method="HEAD")
            with urlopen(request, timeout=5) as response:
                if response.status == 200:
                    found_sources.append(
                        {"url": url, "source": f"Clearbit ({source_type}: {domain})"}
                    )
        except (URLError, HTTPError, TimeoutError):
            continue

    # Try GitHub organization avatars
    github_names = [
        provider_lower,
        name_lower,
        provider.lower().replace("_", "-"),
    ]

    for name in github_names:
        url = f"https://github.com/{name}.png?size=512"
        try:
            headers = {"User-Agent": "Mozilla/5.0"}
            request = Request(url, headers=headers, method="HEAD")
            with urlopen(request, timeout=5) as response:
                if response.status == 200:
                    content_type = response.headers.get("Content-Type", "")
                    if "image" in content_type:
                        found_sources.append(
        
```

### Core Architecture Module: `.claude/skills/adapter-ops/scripts/manage_models.py`
```
#!/usr/bin/env python3
"""Manage models in existing adapter JSON schemas.

Usage:
    # Add models to dropdown enum
    python manage_models.py --adapter llm --provider openai --action add-enum --models "gpt-4-turbo,gpt-4o"

    # Remove models from dropdown enum
    python manage_models.py --adapter llm --provider openai --action remove-enum --models "gpt-3.5-turbo"

    # Set default model
    python manage_models.py --adapter llm --provider openai --action set-default --models "gpt-4o"

    # Update model description
    python manage_models.py --adapter llm --provider openai --action update-description \
        --description "Available models: gpt-4o, gpt-4-turbo, gpt-3.5-turbo"

    # List current models
    python manage_models.py --adapter llm --provider openai --action list
"""

import argparse
import json
import sys
from pathlib import Path

# Resolve paths
SCRIPT_DIR = Path(__file__).parent
SKILL_DIR = SCRIPT_DIR.parent
REPO_ROOT = SKILL_DIR.parent.parent.parent
SDK1_ADAPTERS = REPO_ROOT / "unstract" / "sdk1" / "src" / "unstract" / "sdk1" / "adapters"


def get_schema_path(adapter_type: str, provider: str) -> Path:
    """Get the JSON schema path for an adapter."""
    adapter_dir = "llm1" if adapter_type == "llm" else "embedding1"
    return SDK1_ADAPTERS / adapter_dir / "static" / f"{provider.lower()}.json"


def load_schema(schema_path: Path) -> dict:
    """Load and parse a JSON schema file."""
    with open(schema_path) as f:
        return json.load(f)


def save_schema(schema_path: Path, schema: dict) -> None:
    """Save a JSON schema file with proper formatting."""
    with open(schema_path, "w") as f:
        json.dump(schema, f, indent=2)
        f.write("\n")


def list_models(schema: dict) -> dict:
    """Extract model information from schema."""
    model_prop = schema.get("properties", {}).get("model", {})
    return {
        "type": model_prop.get("type", "unknown"),
        "default": model_prop.get("default"),
        "enum": model_prop.get("enum"),
        "description": model_prop.get("description"),
    }


def add_enum_models(schema: dict, models: list[str]) -> dict:
    """Add models to the enum list (creates enum if doesn't exist)."""
    if "properties" not in schema:
        schema["properties"] = {}
    if "model" not in schema["properties"]:
        schema["properties"]["model"] = {"type": "string", "title": "Model"}

    model_prop = schema["properties"]["model"]

    # Get existing enum or create new one
    existing_enum = model_prop.get("enum", [])
    if not isinstance(existing_enum, list):
        existing_enum = []

    # Add new models (avoiding duplicates)
    for model in models:
        if model not in existing_enum:
            existing_enum.append(model)

    model_prop["enum"] = existing_enum

    # Set default if not set
    if "default" not in model_prop and existing_enum:
        model_prop["default"] = existing_enum[0]

    return schema


def remove_enum_models(schema: dict, models: list[str]) -> dict:
    """Remove models from the enum list."""
    model_prop = schema.get("properties", {}).get("model", {})
    existing_enum = model_prop.get("enum", [])

    if not existing_enum:
        return schema

    # Remove specified models
    updated_enum = [m for m in existing_enum if m not in models]
    model_prop["enum"] = updated_enum

    # Update default if it was removed
    if model_prop.get("default") in models and updated_enum:
        model_prop["default"] = updated_enum[0]
    elif not updated_enum:
        # Remove enum entirely if no models left
        if "enum" in model_prop:
            del model_prop["enum"]

    return schema


def set_default_model(schema: dict, model: str) -> dict:
    """Set the default model."""
    if "properties" not in schema:
        schema["properties"] = {}
    if "model" not in schema["properties"]:
        schema["properties"]["model"] = {"type": "string", "title": "Model"}

    schema["properties"]["model"]["default"] = model
    return schema


def update_description(schema: dict, description: str) -> dict:
    """Update the model field description."""
    if "properties" not in schema:
        schema["properties"] = {}
    if "model" not in schema["properties"]:
        schema["properties"]["model"] = {"type": "string", "title": "Model"}

    schema["properties"]["model"]["description"] = description
    return schema


def convert_to_enum(schema: dict) -> dict:
    """Convert free-text model field to enum dropdown."""
    model_prop = schema.get("properties", {}).get("model", {})

    if "enum" in model_prop:
        print("Model field already has enum defined")
        return schema

    # Get current default or prompt for models
    current_default = model_prop.get("default", "")

    print(f"Current default: {current_default}")
    print("To convert to enum, use --action add-enum with --models")

    return schema


def convert_to_freetext(schema: dict) -> dict:
    """Convert enum dropdown to free-text model field."""
    model_prop = schema.get("properties", {}).get("model", {})

    if "enum" in model_prop:
        # Preserve default if it exists
        default = model_prop.get(
            "default", model_prop["enum"][0] if model_prop["enum"] else ""
        )
        del model_prop["enum"]
        model_prop["default"] = default

    return schema


def main():
    parser = argparse.ArgumentParser(description="Manage models in adapter JSON schemas")
    parser.add_argument(
        "--adapter",
        required=True,
        choices=["llm", "embedding"],
        help="Adapter type (llm or embedding)",
    )
    parser.add_argument(
        "--provider", required=True, help="Provider name (e.g., 'openai', 'anthropic')"
    )
    parser.add_argument(
        "--action",
        required=True,
        choices=[
            "list",
            "add-enum",
            "remove-enum",
            "set-default",
            "update-description",
            "to-enum",
            "to-freetext",
        ],
        help="Action to perform",
    )
    parser.add_argument(
        "--models", help="Comma-separated list of models (for add/remove/set-default)"
    )
    parser.add_argument("--description", help="New description for model field")
    parser.add_argument(
        "--dry-run", action="store_true", help="Show changes without applying them"
    )

    args = parser.parse_args()

    # Get schema path
    schema_path = get_schema_path(args.adapter, args.provider)

    if not schema_path.exists():
        print(f"Error: Schema file not found: {schema_path}")
        return 1

    # Load schema
    schema = load_schema(schema_path)
    original_schema = json.dumps(schema, indent=2)

    # Perform action
    if args.action == "list":
        info = list_models(schema)
        print(f"Model configuration for {args.provider} {args.adapter}:")
        print(f"  Type: {info['type']}")
        print(f"  Default: {info['default']}")
        if info["enum"]:
            print(f"  Enum values: {', '.join(info['enum'])}")
        else:
            print("  Enum: (free text)")
        if info["description"]:
            print(f"  Description: {info['description']}")
        return 0

    elif args.action == "add-enum":
        if not args.models:
            print("Error: --models required for add-enum action")
            return 1
        models = [m.strip() for m in args.models.split(",")]
        schema = add_enum_models(schema, models)
        print(f"Added models: {', '.join(models)}")

    elif args.action == "remove-enum":
        if not args.models:
            print("Error: --models required for remove-enum action")
            return 1
        models = [m.strip() for m in args.models.split(",")]
        schema = remove_enum_models(schema, models)
        print(f"Removed models: {', '.join(models)}")

    elif args.action == "set-default":
        if not args.models:
            print("Error: --models required for set-default action (single m
```

### Core Architecture Module: `.claude/skills/connector-ops/scripts/fetch_logo.py`
```
#!/usr/bin/env python3
"""Fetch connector logo from various sources.

Usage:
    python fetch_logo.py "service_name" "output_path"

Example:
    python fetch_logo.py "PostgreSQL" "/path/to/frontend/public/icons/connector-icons/Postgresql.png"

Sources tried in order:
1. WorldVectorLogo (worldvectorlogo.com) - best for tech/software logos
2. SimpleIcons (simpleicons.org)
3. Devicon (devicon.dev)
4. Logo.dev API
5. Clearbit
6. Skip if not found
"""

import re
import sys
import urllib.error
import urllib.request
from pathlib import Path


def normalize_name(name: str) -> str:
    """Normalize service name for API lookups."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def fetch_worldvectorlogo(name: str, output_path: str) -> bool:
    """Try to fetch from WorldVectorLogo CDN - best source for tech logos."""
    # Try different name formats
    name_variants = [
        name.lower().replace(" ", "-"),  # "SharePoint" -> "sharepoint"
        f"microsoft-{name.lower().replace(' ', '-')}",  # "SharePoint" -> "microsoft-sharepoint"
        normalize_name(name),  # "SharePoint" -> "sharepoint"
    ]

    for variant in name_variants:
        url = f"https://cdn.worldvectorlogo.com/logos/{variant}.svg"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    content = response.read()
                    # Check if it's actually an SVG (not an error page)
                    if content.startswith(b"<svg") or b"<svg" in content[:500]:
                        svg_path = output_path.rsplit(".", 1)[0] + ".svg"
                        with open(svg_path, "wb") as f:
                            f.write(content)
                        print(f"[WorldVectorLogo] Logo saved to: {svg_path}")
                        return True
        except (urllib.error.URLError, urllib.error.HTTPError):
            continue

    print("[WorldVectorLogo] Not found")
    return False


def fetch_simple_icons(name: str, output_path: str) -> bool:
    """Try to fetch from SimpleIcons CDN."""
    normalized = normalize_name(name)

    # SimpleIcons provides SVGs, we'll save as-is
    url = f"https://cdn.simpleicons.org/{normalized}"

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as response:
            if response.status == 200:
                content = response.read()
                # Save as SVG if output expects PNG, note this
                svg_path = output_path.rsplit(".", 1)[0] + ".svg"
                with open(svg_path, "wb") as f:
                    f.write(content)
                print(f"[SimpleIcons] Logo saved to: {svg_path}")
                return True
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        print(f"[SimpleIcons] Not found: {e}")

    return False


def fetch_devicon(name: str, output_path: str) -> bool:
    """Try to fetch from Devicon CDN."""
    normalized = normalize_name(name)

    # Devicon URL patterns
    variants = [
        f"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/{normalized}/{normalized}-original.svg",
        f"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/{normalized}/{normalized}-plain.svg",
        f"https://cdn.jsdelivr.net/gh/devicons/devicon/icons/{normalized}/{normalized}-original-wordmark.svg",
    ]

    for url in variants:
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    content = response.read()
                    svg_path = output_path.rsplit(".", 1)[0] + ".svg"
                    with open(svg_path, "wb") as f:
                        f.write(content)
                    print(f"[Devicon] Logo saved to: {svg_path}")
                    return True
        except (urllib.error.URLError, urllib.error.HTTPError):
            continue

    print("[Devicon] Not found")
    return False


def fetch_logo_dev(name: str, output_path: str) -> bool:
    """Try to fetch from logo.dev API."""
    # logo.dev uses domain names
    domain_guesses = [
        f"{normalize_name(name)}.com",
        f"{normalize_name(name)}.io",
        f"{normalize_name(name)}.org",
    ]

    for domain in domain_guesses:
        url = f"https://img.logo.dev/{domain}?token=pk_anonymous"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    content = response.read()
                    # logo.dev returns PNG
                    with open(output_path, "wb") as f:
                        f.write(content)
                    print(f"[logo.dev] Logo saved to: {output_path}")
                    return True
        except (urllib.error.URLError, urllib.error.HTTPError):
            continue

    print("[logo.dev] Not found")
    return False


def fetch_clearbit(name: str, output_path: str) -> bool:
    """Try to fetch from Clearbit Logo API."""
    domain_guesses = [
        f"{normalize_name(name)}.com",
        f"{normalize_name(name)}.io",
        f"{normalize_name(name)}.org",
    ]

    for domain in domain_guesses:
        url = f"https://logo.clearbit.com/{domain}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    content = response.read()
                    with open(output_path, "wb") as f:
                        f.write(content)
                    print(f"[Clearbit] Logo saved to: {output_path}")
                    return True
        except (urllib.error.URLError, urllib.error.HTTPError):
            continue

    print("[Clearbit] Not found")
    return False


def main():
    if len(sys.argv) != 3:
        print("Usage: python fetch_logo.py <service_name> <output_path>")
        print("Example: python fetch_logo.py PostgreSQL ./Postgresql.png")
        sys.exit(1)

    service_name = sys.argv[1]
    output_path = sys.argv[2]

    # Ensure output directory exists
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    print(f"Fetching logo for: {service_name}")
    print(f"Output path: {output_path}")
    print("-" * 40)

    # Try sources in order
    sources = [
        ("WorldVectorLogo", fetch_worldvectorlogo),
        ("SimpleIcons", fetch_simple_icons),
        ("Devicon", fetch_devicon),
        ("logo.dev", fetch_logo_dev),
        ("Clearbit", fetch_clearbit),
    ]

    for source_name, fetch_func in sources:
        print(f"Trying {source_name}...")
        if fetch_func(service_name, output_path):
            print("-" * 40)
            print(f"SUCCESS: Logo fetched from {source_name}")
            sys.exit(0)

    print("-" * 40)
    print("WARNING: Could not fetch logo from any source.")
    print("Please manually add a logo to:")
    print(f"  {output_path}")
    print("\nSuggested sources:")
    print(f"  - Official {service_name} brand/press page")
    print("  - Wikipedia (check licensing)")
    print("  - Create a simple text-based placeholder")
    sys.exit(1)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.claude/skills/connector-ops/scripts/verify_connector.py`
```
#!/usr/bin/env python3
"""Verify a connector installation.

Usage:
    python verify_connector.py <connector_type> <connector_name>

Example:
    python verify_connector.py databases postgresql
    python verify_connector.py filesystems google_drive
    python verify_connector.py queues redis_queue

Checks:
1. Directory structure exists
2. Required files present
3. Metadata is valid
4. Connector can be imported
5. Connector is registered in Connectorkit
6. Syntax/compile check passes
7. Mock tests pass
"""

import importlib
import subprocess
import sys
from pathlib import Path


def check_directory_structure(
    base_path: Path, connector_type: str, connector_name: str
) -> list[str]:
    """Check required directory structure exists."""
    errors = []

    connector_dir = (
        base_path / "src/unstract/connectors" / connector_type / connector_name
    )

    if not connector_dir.exists():
        errors.append(f"Connector directory not found: {connector_dir}")
        return errors

    # Required files
    required_files = [
        "__init__.py",
        f"{connector_name}.py",
        "static/json_schema.json",
    ]

    for file in required_files:
        file_path = connector_dir / file
        if not file_path.exists():
            errors.append(f"Required file missing: {file_path}")

    return errors


def check_metadata(
    base_path: Path, connector_type: str, connector_name: str
) -> list[str]:
    """Check metadata is valid."""
    errors = []

    # Add to path for import
    src_path = base_path / "src"
    if str(src_path) not in sys.path:
        sys.path.insert(0, str(src_path))

    try:
        module_path = f"unstract.connectors.{connector_type}.{connector_name}"
        module = importlib.import_module(module_path)

        if not hasattr(module, "metadata"):
            errors.append("Module missing 'metadata' dict")
            return errors

        metadata = module.metadata

        # Required metadata fields
        required_fields = ["name", "version", "connector", "description", "is_active"]
        for field in required_fields:
            if field not in metadata:
                errors.append(f"Metadata missing required field: {field}")

        if metadata.get("is_active") is not True:
            errors.append(
                "Metadata 'is_active' is not True - connector won't be registered"
            )

    except ImportError as e:
        errors.append(f"Failed to import connector module: {e}")

    return errors


def check_connector_class(
    base_path: Path, connector_type: str, connector_name: str
) -> list[str]:
    """Check connector class is valid."""
    errors = []

    src_path = base_path / "src"
    if str(src_path) not in sys.path:
        sys.path.insert(0, str(src_path))

    try:
        module_path = f"unstract.connectors.{connector_type}.{connector_name}"
        module = importlib.import_module(module_path)

        connector_class = module.metadata.get("connector")
        if connector_class is None:
            errors.append("Connector class not found in metadata")
            return errors

        # Check required static methods
        required_methods = [
            "get_id",
            "get_name",
            "get_description",
            "get_icon",
            "get_json_schema",
            "can_write",
            "can_read",
            "requires_oauth",
            "get_connector_mode",
        ]

        for method in required_methods:
            if not hasattr(connector_class, method):
                errors.append(f"Connector missing required method: {method}")
            else:
                # Try calling static methods
                try:
                    getattr(connector_class, method)()
                except Exception as e:
                    errors.append(f"Error calling {method}(): {e}")

    except Exception as e:
        errors.append(f"Error checking connector class: {e}")

    return errors


def check_connectorkit_registration(
    base_path: Path, connector_type: str, connector_name: str
) -> list[str]:
    """Check connector is registered in Connectorkit."""
    errors = []

    src_path = base_path / "src"
    if str(src_path) not in sys.path:
        sys.path.insert(0, str(src_path))

    try:
        from unstract.connectors.connectorkit import Connectorkit

        kit = Connectorkit()
        connectors = kit.get_connectors_list()

        # Get connector ID from module
        module_path = f"unstract.connectors.{connector_type}.{connector_name}"
        module = importlib.import_module(module_path)
        connector_class = module.metadata.get("connector")
        connector_id = connector_class.get_id()

        # Check if registered
        registered_ids = [c.get("id") for c in connectors]
        if connector_id not in registered_ids:
            errors.append(f"Connector not registered in Connectorkit. ID: {connector_id}")
        else:
            print(f"  Connector registered with ID: {connector_id}")

    except Exception as e:
        errors.append(f"Error checking Connectorkit registration: {e}")

    return errors


def run_syntax_check(
    base_path: Path, connector_type: str, connector_name: str
) -> list[str]:
    """Run Python syntax/compile check."""
    errors = []

    connector_file = (
        base_path
        / "src/unstract/connectors"
        / connector_type
        / connector_name
        / f"{connector_name}.py"
    )

    result = subprocess.run(
        [sys.executable, "-m", "py_compile", str(connector_file)],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        errors.append(f"Syntax error: {result.stderr}")

    return errors


def run_mock_tests(
    base_path: Path, connector_type: str, connector_name: str
) -> list[str]:
    """Run mock-based tests."""
    errors = []

    test_file = base_path / "tests" / connector_type / f"test_{connector_name}.py"

    if not test_file.exists():
        errors.append(f"Mock test file not found: {test_file}")
        return errors

    result = subprocess.run(
        [sys.executable, "-m", "pytest", str(test_file), "-v", "--tb=short"],
        capture_output=True,
        text=True,
        cwd=str(base_path),
    )

    if result.returncode != 0:
        errors.append(f"Mock tests failed:\n{result.stdout}\n{result.stderr}")
    else:
        print(f"  Mock tests output:\n{result.stdout}")

    return errors


def main():
    if len(sys.argv) != 3:
        print("Usage: python verify_connector.py <connector_type> <connector_name>")
        print("Example: python verify_connector.py databases postgresql")
        sys.exit(1)

    connector_type = sys.argv[1]
    connector_name = sys.argv[2]

    # Validate connector type
    valid_types = ["databases", "filesystems", "queues"]
    if connector_type not in valid_types:
        print(f"Invalid connector type: {connector_type}")
        print(f"Must be one of: {valid_types}")
        sys.exit(1)

    # Find base path (unstract/connectors)
    script_dir = Path(__file__).parent
    base_path = script_dir.parent.parent.parent.parent / "unstract/connectors"

    if not base_path.exists():
        # Try relative to current working directory
        base_path = Path.cwd()
        if not (base_path / "src/unstract/connectors").exists():
            print("Could not find connectors base path")
            sys.exit(1)

    print(f"Verifying connector: {connector_type}/{connector_name}")
    print(f"Base path: {base_path}")
    print("=" * 60)

    all_errors = []

    # Run checks
    checks = [
        ("Directory Structure", check_directory_structure),
        ("Metadata Validation", check_metadata),
        ("Connector Class", check_connector_class),
        ("Connectorkit Registration", check_connectorkit_registration),
        ("Syntax Check", run_syntax_check),
        ("Mock Tests", run_mock_tests),
    ]

    for check_name, check_func in checks:
        print(f"\n[{check_nam
```

### Core Architecture Module: `.claude/skills/csp-check/scripts/extract_policy.py`
```
#!/usr/bin/env python3
"""Parse the Content-Security-Policy out of frontend/nginx.conf.

Usage:
    python3 extract_policy.py [path/to/nginx.conf]        # pretty-print per directive
    python3 extract_policy.py --json [path/to/nginx.conf] # machine-readable
"""

import json
import re
import sys
from pathlib import Path

HEADER_RE = re.compile(
    r'add_header\s+(Content-Security-Policy(?:-Report-Only)?)\s+"(?P<policy>[^"]*)"',
    re.IGNORECASE,
)
DEFAULT_CONF = Path(__file__).resolve().parents[4] / "frontend" / "nginx.conf"


def parse(conf_path: Path) -> tuple[str, dict[str, list[str]]]:
    """Return (header_name, {directive: [sources]}) for the conf's enforcing CSP header.

    Everything downstream trusts this as "what the browser sees", so it has to pick the
    same header the browser would: not a commented-out one, and not a -Report-Only
    header that happens to sit above the enforcing one (the usual shape while the next
    policy change is being trialled).
    """
    live = "\n".join(
        line
        for line in conf_path.read_text().splitlines()
        if not line.lstrip().startswith("#")
    )
    matches = HEADER_RE.findall(live)
    if not matches:
        raise SystemExit(f"No Content-Security-Policy add_header found in {conf_path}")
    enforcing = [m for m in matches if m[0].lower() == "content-security-policy"]
    chosen = enforcing or matches
    if len(chosen) > 1:
        names = ", ".join(name for name, _ in chosen)
        raise SystemExit(
            f"{conf_path} has {len(chosen)} CSP headers ({names}) -- ambiguous"
        )
    header, policy = chosen[0]
    directives: dict[str, list[str]] = {}
    for chunk in policy.split(";"):
        parts = chunk.split()
        if not parts:
            continue
        if parts[0] in directives:
            # The browser honours the first occurrence and ignores the rest, so keeping
            # the last would let the gate clear sources the browser never applies.
            print(
                f"warning: duplicate directive {parts[0]!r} in {conf_path}; "
                "the browser uses the first and ignores this one",
                file=sys.stderr,
            )
            continue
        directives[parts[0]] = parts[1:]
    return header, directives


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--json"]
    as_json = "--json" in sys.argv[1:]
    conf = Path(args[0]) if args else DEFAULT_CONF
    header, directives = parse(conf)
    if as_json:
        print(json.dumps({"header": header, "directives": directives}, indent=2))
        return
    print(f"{header}  ({conf})")
    for directive, sources in directives.items():
        print(f"\n  {directive}")
        for source in sources:
            print(f"      {source}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.claude/skills/csp-check/scripts/probe.js`
```
/**
 * Browser-side CSP probe.
 *
 * Paste the whole file as the `function` argument of the chrome-devtools MCP
 * `evaluate_script` tool while a page from the target deployment is selected, with the
 * output of `extract_policy.py --json` inlined as DIRECTIVES below.
 *
 * It loads one throwaway resource per (directive, host) pair and records what the live
 * policy reports, so it answers two questions the config file alone cannot:
 *   1. does the deployment actually serve the policy we think it does?
 *   2. is each host allowed on the directive that will really load it?
 * Four control probes must always be reported -- if they are not, CSP is not applied.
 *
 * Note: CSP evaluates redirect targets. A probe path that 404-redirects to another host
 * (https://hooks.stripe.com/ -> https://stripe.com) reports that target, not a real gap.
 */
async () => {
  const DIRECTIVES = {
    /* paste extract_policy.py --json "directives" here */
  };

  const KIND_BY_DIRECTIVE = {
    "script-src": "script",
    "style-src": "style",
    "img-src": "img",
    "font-src": "font",
    "connect-src": "connect",
    "frame-src": "frame",
    "media-src": "media",
    "worker-src": "worker",
  };

  const probes = [];
  for (const [directive, sources] of Object.entries(DIRECTIVES)) {
    const kind = KIND_BY_DIRECTIVE[directive];
    if (!kind) continue;
    for (const source of sources) {
      if (!source.startsWith("https://")) continue;
      // A wildcard source is not a hostname: https://*.example.com/__csp_probe never
      // parses, so the request dies before CSP sees it and the probe looks clean whether
      // or not the deployment serves the wildcard. Substituting a concrete label does
      // test it -- CSP is evaluated before DNS, which is why the csp-control.invalid
      // controls below get reported despite not resolving.
      const url = source.replace("://*.", "://csp-probe.").replace(/\/$/, "");
      probes.push([kind, url + "/__csp_probe", false]);
    }
  }
  for (const kind of ["img", "connect", "script"]) {
    probes.push([kind, "https://csp-control.invalid/__csp_probe", true]);
  }
  probes.push(["connect", "wss://csp-control.invalid/__csp_probe", true]);

  const hits = [];
  const onViolation = (e) =>
    hits.push({
      directive: e.effectiveDirective || e.violatedDirective,
      blocked: e.blockedURI,
    });
  document.addEventListener("securitypolicyviolation", onViolation);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const load = (kind, url) => {
    if (kind === "script") {
      const el = document.createElement("script");
      el.src = url;
      document.head.appendChild(el);
    } else if (kind === "style") {
      const el = document.createElement("link");
      el.rel = "stylesheet";
      el.href = url;
      document.head.appendChild(el);
    } else if (kind === "img") {
      new Image().src = url;
    } else if (kind === "font") {
      new FontFace("cspProbe", `url(${url})`).load().catch(() => {});
    } else if (kind === "connect") {
      if (url.startsWith("wss:")) new WebSocket(url);
      else fetch(url, { mode: "no-cors" }).catch(() => {});
    } else if (kind === "frame") {
      const el = document.createElement("iframe");
      el.src = url;
      el.style.display = "none";
      document.body.appendChild(el);
    } else if (kind === "media") {
      const el = document.createElement("video");
      el.src = url;
      document.body.appendChild(el);
      el.load();
    } else if (kind === "worker") {
      new Worker(url);
    }
  };

  const expected = [];
  for (const [kind, url, isControl] of probes) {
    try {
      load(kind, url);
    } catch (e) {
      /* cross-origin Worker/WebSocket constructors can throw; CSP still reports first */
    }
    if (isControl) expected.push(url);
    await wait(250);
  }
  await wait(3000);
  document.removeEventListener("securitypolicyviolation", onViolation);

  const reported = new Set(hits.map((h) => h.blocked));
  return {
    // Hosts the policy is supposed to allow but the deployment still blocks. A
    // csp-probe.* entry here means the deployment is not serving that wildcard source.
    unexpected: hits.filter((h) => !h.blocked.includes("csp-control.invalid")),
    // Empty means CSP is live and restrictive. Non-empty means it is not applied at all.
    controlsNotReported: expected.filter(
      (url) => !reported.has(url) && !reported.has(new URL(url).origin)
    ),
    probeCount: probes.length,
  };
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2014** (2026-07-14): **fix: [ISSUE] Bundled qdrant server (v1.8.3) incompatible with qdrant-client 1.16, vector db test connection fails with 404 error**
  *Symptoms*: ## Describe the bug On a fresh setup (`./run-platform.sh`), adding the bundled Qdrant as a vector database during onboarding fails. "Test Connection" returns: "Error testing '<vector-db-name>'. Unexpected Response: 404 (Not Found)..."  ## To reproduce 1. Run `./run-platform.sh` and log in. 2. Onboarding >> Connect a Vector Database >> Qdrant. 3. Add Name of vector DB, URL: `http://unstract-vector-db:6333`, no API key. 4. Click Test Connection.  ## Expected behavior It should connect without any problem.  ## Environment details - Version v0.173.0 of unstarct - OS: Ubuntu  ## Screenshots  <img width="1077" height="458" alt="Image" src="https://github.com/user-attachments/assets/4dfe81b0-94f0-4074-b0bb-883b91c855dd" /> 
  **Post-Mortem & Fix Analysis**:
  > Root Cause:  The Python client and the bundled server are far apart in version. Backend logs: qdrant.py:67: UserWarning: Qdrant client version 1.16.2 is incompatible with server version 1.8.3. Major versions should match and minor version difference must not exceed 1. ... Error occured while testing adapter Unexpected Response: 404 (Not Found)   Network connectivity is fine (curl to the container returns the version JSON). The 1.16 client calls an API path the 1.8.3 server does not have, so it gets a 404   The two pins have drifted:   - `docker/docker-compose-dev-essentials.yaml` pins `qdrant/qdrant:v1.8.3`, last touched in #185 (Mar 2024)   - `unstract/sdk1/pyproject.toml` pins `qdrant-client>=1.16.0,<1.17.0`, bumped in #1845 (Mar 2026)  
  > Suggested fix: Bump the Qdrant server image to a 1.16.x tag to match the client. `v1.16.1` lines up with the installed client version. 
  > @amanattrish apologies for getting to this late and thanks for taking the time to raise this issue and a PR for it.  This was fixed in `v0.174.0` by #2046   <img width="2252" height="714" alt="Image" src="https://github.com/user-attachments/assets/a72c47bf-398c-47ee-8bdd-94d6a4d0c5ed" />

- **Issue #1972** (2026-06-09): **LlamaParse adapter: `url` field in json_schema.json doesn't match `base_url` config key, breaking EU region support**
  *Symptoms*: ## Bug Description The LlamaParse x2text adapter has a mismatch between the UI schema field name  and the config key used in the adapter code, causing the base URL to always  fall back to the hardcoded US endpoint regardless of what the user enters.  ## Files affected - `unstract/sdk1/src/unstract/sdk1/adapters/x2text/llama_parse/src/static/json_schema.json`   — defines the UI field as `"url"` - `unstract/sdk1/src/unstract/sdk1/adapters/x2text/llama_parse/src/constants.py`   — defines `BASE_URL = "base_url"` - `unstract/sdk1/src/unstract/sdk1/adapters/x2text/llama_parse/src/llama_parse.py`   — reads `self.config.get(LlamaParseConfig.BASE_URL)` which maps to `"base_url"`  ## Impact Users with EU region LlamaCloud accounts cannot use LlamaParse — their API key  is sent to `https://api.cloud.llamaindex.ai` (US) instead of  `https://api.cloud.eu.llamaindex.ai` (EU), resulting in a 401 Unauthorized error.  ## Fix In `json_schema.json`, rename the field from `"url"` to `"url"` → `"base_url"`:  ## Version latest

- **Issue #1775** (2026-02-26): **UN-3136 [FIX] Skip thinking config for Vertex AI pro models when disabled**
  *Symptoms*: ## What  - Skip thinking config for Vertex AI pro models when disabled  ## Why  - This was causing an issue with exiting vertexai adapters with any `pro` models because the thinking feature cannot be turned off for `pro` models  ## How  - The parameter `thinking_budget` was sent to the `litellm.completion()` by default when thinking config was not present. - - enable_thinking is missing → defaults to False   - Model has "pro" → is_pro_model = True   - No thinking config sent → avoids the error    ## Can this PR break any existing features. If yes, please list possible items. If no, please explain why. (PS: Admins do not merge the PR without this section filled)  - No, this cannot break any exisiting features because this is just a sinple change with how the adapters are created.  ## Database Migrations  - N/A  ## Env Config  - N/A  ## Relevant Docs  - N/A  ## Related Issues or PRs  -   ## Dependencies Versions  - Updated tool versions  ## Notes on Testing  - Tested with existing pro model adapters once the fix was implemented.  ## Screenshots  ## Checklist  I have read and understood the [Contribution Guidelines](https://docs.unstract.com/unstract/contributing/unstract/). 
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  **Configuration used**: Organization UI  **Review profile**: CHILL  **Plan**: Pro  **Cache: Disabled due to Reviews > Disable Cache setting**  **Knowledge base: Disabled due to `Reviews -> Disable Knowledge Base` setting**  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 59a76adcc1086d1bbe1fe048b0e2c41526d826e6 and 7c8b8a4e413a48004a0d13e956e41caa27e26e31.  </details>  <details> <summary>📒 Files selected for processing (1)</summary>  * `backend/sample.env`  </details>  <details> <summary>🚧 Files skipped from review as they are similar to previous changes (1)</summary>  * backend/sample.env  </details>  </details>  ---   <!-- walkthrough_start -->  <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRab
  > ## [![Quality Gate Passed](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/checks/QualityGateBadge/qg-passed-20px.png 'Quality Gate Passed')](https://sonarcloud.io/dashboard?id=Zipstack_unstract&pullRequest=1775) **Quality Gate passed**   Issues   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 New issues](https://sonarcloud.io/project/issues?id=Zipstack_unstract&pullRequest=1775&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true)   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/accepted-16px.png '') [0 Accepted issues](https://sonarcloud.io/project/issues?id=Zipstack_unstract&pullRequest=1775&issueStatuses=ACCEPTED)  Measures   ![](https://sonarsource.github.io/sonarcloud-github-static-resources/v2/common/passed-16px.png '') [0 Security Hotspots](https://sonarcloud.io/project/security_hotspots?id=Zipstack_unstract&pullRequest=1775&issueStatuses=OPEN,CONFIRMED&sinceLeakPeriod=true) 
  > # Test Results  <details open> <summary><b>Summary</b></summary>  - ✅ **Runner Tests**: 11 passed, 0 failed (11 total) - ✅ **SDK1 Tests**: 63 passed, 0 failed (63 total)  </details>  ---  <details> <summary><b>Runner Tests - Full Report</b></summary>  |                     filepath                      |                  function                   | $$\textcolor{#23d18b}{\tt{passed}}$$ | SUBTOTAL | | ------------------------------------------------- | ------------------------------------------- | --------------------------------: | -------: | | $$\textcolor{#23d18b}{\tt{runner/src/unstract/runner/clients/test\\_docker.py}}$$ | $$\textcolor{#23d18b}{\tt{test\\_logs}}$$   |   $$\textcolor{#23d18b}{\tt{1}}$$ | $$\textcolor{#23d18b}{\tt{1}}$$ | | $$\textcolor{#23d18b}{\tt{runner/src/unstract/runner/clients/test\\_docker.py}}$$ | $$\textcolor{#23d18b}{\tt{test\\_cleanup}}$$ |   $$\textcolor{#23d18b}{\tt{1}}$$ | $$\textcolor{#23d18b}{\tt{1}}$$ | | $$\textcolor{#23d18b}{\tt{runner/src/unstrac

- **Issue #1654** (2025-11-12): **fix: [ISSUE]**
  *Symptoms*: ## Describe the bug Unable to access http://frontend.unstract.localhost/ after executing `./run-platform.sh`  ## To reproduce Installed Ubuntu 24.04 in a virtual machine and instaled Docker:  ``` Client: Docker Engine - Community  Version:           29.0.0  API version:       1.52  Go version:        go1.25.4  Git commit:        3d4129b  Built:             Mon Nov 10 21:46:31 2025  OS/Arch:           linux/amd64  Context:           default ```  Cloned the repository:  ``` cd ~ git clone https://github.com/Zipstack/unstract.git cd unstract ```  And executed the ./run-platform.sh script.  when I execute `docker logs unstract-proxy --tail 20` these errors appears:  ``` time="2025-11-11T20:23:12Z" level=error msg="Provider connection error Error response from daemon: client version 1.24 is too old. Minimum supported API version is 1.44, please upgrade your client to a newer version, retrying in 12.375369171s" providerName=docker time="2025-11-11T20:23:24Z" level=error msg="Failed to retrieve information of the docker client and server host: Error response from daemon: client version 1.24 is too old. Minimum supported API version is 1.44, please upgrade your client to a newer version" providerName=docker time="2025-11-11T20:23:24Z" level=error msg="Provider connection error Error response from daemon: client version 1.24 is too old. Minimum supported API version is 1.44, please upgrade your client to a newer version, retrying in 14.497073425s" providerName=docker ```  ## Expected 
  **Post-Mortem & Fix Analysis**:
  > It seems a proble with Traefik and Docker v29. With Docker v28.5.2 works fine.

- **Issue #1611** (2025-10-31): **fix: docker compose should specify project name**
  *Symptoms*: ## Describe the bug Without a specified compose project name docker compose uses the folder name which in this case is 'docker' and that can lead to compose collision.  ## To reproduce Run the compose file.
  **Post-Mortem & Fix Analysis**:
  > Hey @michaelcizmar  Thanks for pointing this out and raising a PR to fix it. Will close this issue once the PR is merged and released
  > Thanks for the fix @michaelcizmar, it has been released as part of [v0.139.1](https://github.com/Zipstack/unstract/releases/tag/v0.139.1)

- **Issue #1385** (2025-07-04): **fix: [ISSUE] Database migration fails**
  *Symptoms*: Describe the bug When performing a fresh installation of the unstract/backend:latest image with a postgres:15 backend, the initial database migration fails. The manage.py migrate command is unable to target the correct database schema, resulting in a ProgrammingError: no schema has been selected to create in. This critical bug prevents the application's 112 required database tables from being created, leaving the database uninitialized and rendering the entire backend non-functional.  To reproduce Steps to reproduce the behavior:  Set up a standard docker-compose.yml file to run unstract/backend:latest and postgres:15 services on a shared Docker network.  Start the services using docker-compose up -d. The containers start successfully.  Execute the database migration command:  docker exec unstract-backend /app/.venv/bin/python manage.py migrate  The command immediately fails with the psycopg2.errors.InvalidSchemaName: no schema has been selected to create in error.  Expected behavior The command docker exec unstract-backend /app/.venv/bin/python manage.py migrate should successfully run all 112 database migrations, creating the necessary tables for the application to function.  Environment details Host OS: Windows 11  Virtualization: Docker Desktop using WSL2 backend  Unstract Version: latest (Pulled on June 26, 2025)  Database Version: postgres:15  Additional context We have undertaken extensive troubleshooting to isolate this issue and can confirm it is not a standard confi
  **Post-Mortem & Fix Analysis**:
  > Additional Comment for Bug Report  Further investigation of the source code in the unstract/backend repository has revealed the definitive root cause of this bug.  In the file backend/backend/settings/base.py, the database engine is hardcoded to a custom wrapper:  Python  # DB Configuration DB_ENGINE = "backend.custom_db"  ...  DATABASES = {     "default": {         "ENGINE": DB_ENGINE,         # ...     } } This custom database engine at backend.custom_db appears to have a bug where it does not correctly handle or pass the search_path option for PostgreSQL connections. This is why all attempts to run manage.py migrate fail with the ProgrammingError: no schema has been selected to create in, regardless of environment variable settings or direct database alterations.  The use of this hardcoded custom engine prevents the application from being installed correctly. 

- **Issue #1365** (2025-06-20): **Celery workers file-processing and callback are in a restart loop on a clean install**
  *Symptoms*: Summary When following the standard installation instructions, the setup fails because two key containers, unstract-worker-file-processing and unstract-worker-file-processing-callback, are stuck in a restart loop. The logs for these containers consistently show a ModuleNotFoundError: No module named 'backend.workers', indicating a python path issue within the unstract/backend docker image. This issue was reproduced on two completely different environments, proving it is not a user environment configuration problem. Environments Where the Issue Was Reproduced Native Linux VM: OS: Ubuntu 24.04 LTS (Clean install) Virtualization: Hyper-V on Windows 11 Docker: Docker Engine v27.0.3 (installed via get.docker.com script) Windows + WSL 2: OS: Windows 11 Pro WSL: Ubuntu 24.04 LTS Docker: Docker Desktop v4.31.1 Steps to Reproduce The steps are the same as the official installation guide and were performed on a completely clean Ubuntu 24.04 VM. Install prerequisites: sudo apt update && sudo apt install git curl -y Install Docker Engine: curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh Add user to docker group and reboot: sudo usermod -aG docker $USER && sudo reboot Clone the repository: git clone https://github.com/Zipstack/unstract.git Navigate into the directory: cd unstract Run the installation script: ./run-platform.sh Expected Behavior All 26 containers should start and remain in an Up state. Actual Behavior The script finishes, but two containers immedi
  **Post-Mortem & Fix Analysis**:
  > Hello, thanks for trying the platform and reaching out. I was able to reproduce this issue in the latest `main` and after taking a look [at Dockerhub](https://hub.docker.com/r/unstract/backend/tags) I see that an image was wrongly tagged as `latest` which could be the cause of this. For the time being, please explicitly specify the version `v0.122.2` and run the platform  ``` ./run-platform.sh -v v0.122.2 ``` 
  > Made the release now. `v0.122.2` should be the latest now. 
  > With recent releases, this issue should not be noticed anymore. Please reopen if you notice it again

- **Issue #1281** (2025-05-02): **fix: [ISSUE] No authentication modules found.Application will start without authentication module**
  *Symptoms*: Hi everyone, this is my first ever "contribution" so please don't hate me if I do it wrong ## Describe the bug Im trying to run on my server unstract, but I cannot reach the frontend nor backend. I've followed the README steps, and I'm used to handle docker.  In the backend log I'm getting this:  WARNING : [2025-05-01 04:35:42,831]{module:authentication_plugin_registry process:20 thread:139983920900992 request_id:N/A} :- Metadata is not active for auth_sample authentication module.  WARNING : [2025-05-01 04:35:42,832]{module:authentication_plugin_registry process:20 thread:139983920900992 request_id:N/A} :- No authentication modules found.Application will start without authentication module  If you need further, please let me know  Thanks in advance!    ## To reproduce Steps to reproduce the behavior.  ## Expected behavior A clear and concise description of what you expected to happen.  ## Environment details  - Version: v0.117.0  ## Additional context Add any other context about the problem here.  ## Screenshots If applicable, add screenshots to help explain your problem. 
  **Post-Mortem & Fix Analysis**:
  > Nevermind, I think I made it work

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

### Incident Patch 1: `6c0a69de` (2026-09-30)
**Commit Message**: UN-4123 [FIX] A credential-free REDIS_URL no longer connects anonymously (#2299)

* UN-4123 [FIX] A credential-free REDIS_URL no longer connects anonymously

In URL mode the resolved password was never passed to the client: credentials
had to be embedded in the URL, and a {prefix}PASSWORD set beside a
credential-free URL was silently ignored. The client connected ANONYMOUSLY and
the endpoint answered NOAUTH on the first command, which reads as a broken
server rather than a dropped password.

This was not exercised by the live managed-Redis testing on UN-4123, because
both configurations tried there avoided it: the URL-mode run embedded the
password in the URL, and the discrete run had no URL at all. The gap sits in the
third combination, which is the one worth recommending.

WHY IT IS WORTH RECOMMENDING. A URL ends up in places a password should not:
the endpoint helper's error messages, ArgoCD's ComparisonError condition, and —
under ESO — the ExternalSecret's spec.target.template.data, which is not a
Secret and is not redacted. All three were raised in review of the chart-side
PR, and all three exist because the password is in a URL. Keeping it in its own
key closes the class rat

**File**: `backend/backend/settings/base.py` (modified, +145/-25)
```diff
@@ -22,13 +22,18 @@
 from utils.cors_origin import normalize_web_app_origin
 
 from unstract.core.cache.redis_client import (
+    apply_url_credentials,
     build_socketio_redis_url,
     ensure_tls_query_params,
     parse_db,
+    parse_port,
+    resolve_sentinel_master_check_hostname,
     resolve_ssl_cert_reqs,
     resolve_ssl_check_hostname,
+    resolve_ssl_enabled,
     set_url_db_path,
     url_db_path,
+    url_username_from_env,
 )
 
 # Django 5.0+ caps URLValidator at 2048 chars. S3 pre-signed URLs signed with
@@ -112,12 +117,20 @@ def get_required_setting(setting_key: str, default: str | None = None) -> str |
 REDIS_USER = os.environ.get("REDIS_USER", "default")
 REDIS_PASSWORD = os.environ.get("REDIS_PASSWORD", "")
 REDIS_HOST = os.environ.get("REDIS_HOST", "localhost")
-REDIS_PORT = os.environ.get("REDIS_PORT", "6379")
+# Through the shared parser, not a bare int() at the Sentinel call site below:
+# a blank REDIS_PORT= — this repo's "leave the default" spelling — raised
+# ValueError while Django settings were being imported, so the backend alone
+# failed to start while every worker came up healthy on 6379.
+REDIS_PORT = parse_port(os.environ.get("REDIS_PORT"), "REDIS_PORT", 6379)
 REDIS_DB = os.environ.get("REDIS_DB", "")
 # TLS to Redis (UN-4123). Off by default, so the in-cluster/local server is
 # untouched. `rediss://` is what actually selects TLS for both django-redis and
 # kombu; this flag only decides which scheme gets built.
-REDIS_SSL = os.environ.get("REDIS_SSL", "false").strip().lower() == "true"
+# Through the shared resolver, not a local `== "true"`: _TRUE_LITERALS accepts
+# 1, yes and on, so the bare comparison read REDIS_SSL=1 as FALSE — the workers
+# connected rediss:// while this cache built a redis:// LOCATION and skipped its
+# CONNECTION_POOL_KWARGS, i.e. one endpoint with two TLS policies in one process.
+REDIS_SSL = resolve_ssl_enabled()
 # Resolved by unstract.core, not re-read here: the raw value needs trimming,
 # lower-casing and validating, and a second copy of that logic is how this file
 # and create_redis_client came to hold two verification policies for one endpoint.
@@ -552,18 +565,67 @@ def filter(self, record):
 REDIS_SENTINEL_MASTER_NAME = os.environ.get("REDIS_SENTINEL_MASTER_NAME", "mymaster")
 
 if REDIS_SENTINEL_MODE:
+    # This branch used to hold four divergences from create_redis_client, all
+    # pre-existing. They are closed here because "the cache and the client reach
+    # the same place" is not a property that can stop at a mode boundary — an
+    # operator on Sentinel gets the same guarantee or the guarantee is a
+    # half-truth. TestSentinelModeAgreesWithCore covers each one.
+    #
+    # The username comes from the shared resolver, not the module-level
+    # REDIS_USER: that one defaults to "default", so this cache sent a
+    # two-argument ACL AUTH where core sends the one-argument form, and it read
+    # only REDIS_USER so the REDIS_USERNAME spelling platform-service ships was
+    # ignored entirely.
+    _sentinel_username = url_username_from_env()
+
+    # 26379 — the Sentinel port — matching core's
+    # _resolve_redis_env(default_port="26379"). The module-level REDIS_PORT
+    # defaults to 6379, which is the standalone port, so an unset REDIS_PORT
+    # pointed this cache at the wrong port while every other client found the
+    # sentinels. The chart always sets it, which is why this stayed hidden.
+    REDIS_PORT = parse_port(os.environ.get("REDIS_PORT"), "REDIS_PORT", 26379)
+
     _sentinel_kwargs = {}
     if REDIS_PASSWORD:
         _sentinel_kwargs["password"] = REDIS_PASSWORD
-    if REDIS_USER:
-        _sentinel_kwargs["username"] = REDIS_USER
+    if _sentinel_username:
+        _sentinel_kwargs["username"] = _sentinel_username
+
+    # TLS reached neither the discovery connections nor the master one, so a
+    # TLS-only Sentinel deployment got a plaintext cache while core encrypted
+    # both. Core builds them from one e
```

**File**: `backend/backend/tests/test_redis_settings_derivation.py` (modified, +545/-17)
```diff
@@ -19,12 +19,81 @@
 
 import logging
 import pathlib
+import re
+from urllib.parse import urlsplit
 
 import pytest
 
 _SETTINGS = pathlib.Path(__file__).resolve().parents[1] / "settings" / "base.py"
 
 
+def _slice_bounds(source: str) -> dict[str, tuple[int, int]]:
+    """Character ranges of base.py that _derive executes.
+
+    Factored out so the coverage guard below can assert on the SAME ranges the
+    harness runs, rather than a second description of them that could drift.
+    """
+    defs_start = source.index('REDIS_USER = os.environ.get("REDIS_USER"')
+    defs_end = (
+        source.index("\n", source.index('REDIS_URL = os.environ.get("REDIS_URL"')) + 1
+    )
+    imports_start = source.index("from unstract.core.cache.redis_client import (")
+    imports_end = source.index(")\n", imports_start) + 2
+    urllib_start = source.index("from urllib.parse import ")
+    urllib_end = source.index("\n", urllib_start) + 1
+    return {
+        "urllib": (urllib_start, urllib_end),
+        "imports": (imports_start, imports_end),
+        "defs": (defs_start, defs_end),
+        "block": (
+            source.index("REDIS_SENTINEL_MODE = ("),
+            source.index("SESSION_ENGINE ="),
+        ),
+    }
+
+
+def test_the_harness_covers_every_redis_line_in_the_settings_file():
+    """The splice must not silently stop covering the code it claims to test.
+
+    _derive executes two ranges out of base.py with a ~415-line gap between
+    them, and anything in that gap is invisible to every assertion in this
+    file. That is not theoretical: adding `REDIS_PASSWORD = ""` at base.py:251,
+    or appending a CACHES["default"]["LOCATION"] override after SESSION_ENGINE,
+    leaves all of these tests green while shipping a broken cache.
+
+    The file already concedes the gap once — test_no_database_var_is_parsed_with
+    _a_bare_int greps the source text because FILE_ACTIVE_CACHE_REDIS_DB sits
+    outside both slices. A grep only covers the one pattern someone thought of;
+    this covers the boundary itself, and fails naming the line that escaped.
+    """
+    source = _SETTINGS.read_text()
+    bounds = _slice_bounds(source)
+    covered = []
+    for start, end in bounds.values():
+        covered.append(range(start, end))
+
+    offenders = []
+    offset = 0
+    for line in source.splitlines(keepends=True):
+        if re.match(r"\s*(REDIS_|_redis|_cache|CACHES|SOCKET_IO)", line) and not any(
+            offset in span for span in covered
+        ):
+            offenders.append((source[:offset].count("\n") + 1, line.strip()[:70]))
+        offset += len(line)
+
+    # Known and deliberate: these are asserted by source-text inspection
+    # instead, because they are consumed far from the derivation block.
+    allowed = {"FILE_ACTIVE_CACHE_REDIS_DB", "REDIS_DB_PORTAL"}
+    offenders = [o for o in offenders if not any(a in o[1] for a in allowed)]
+
+    assert not offenders, (
+        "these Redis lines in base.py are OUTSIDE the ranges _derive executes, "
+        "so no test in this file can observe them:\n"
+        + "\n".join(f"  base.py:{n}: {text}" for n, text in offenders)
+        + "\nWiden the slice, or add the name to `allowed` with a reason."
+    )
+
+
 def _derive(**env: str) -> dict:
     """Execute the standalone Redis block with the given env."""
     source = _SETTINGS.read_text()
@@ -55,10 +124,17 @@ def _derive(**env: str) -> dict:
     # without it that branch raises NameError instead of logging, which is part of
     # why it went untested.
     ns: dict = {"__name__": "backend.settings.base"}
+    # The urllib import is spliced from source for the same reason as the
+    # unstract.core one: a hand-written copy must be remembered every time the
+    # settings module starts using another name from it, and the symptom is a
+    # NameError in every case rather than one clear failure.
+    urllib_start = source.index("from urllib.parse import ")
+    urllib_end = source.index("\n", ur
```

**File**: `backend/sample.env` (modified, +7/-1)
```diff
@@ -60,7 +60,13 @@ REDIS_SENTINEL_MASTER_NAME=mymaster
 #   1. Discrete vars (what the Helm chart and these samples use). Set REDIS_SSL=true
 #      alongside REDIS_HOST/REDIS_PORT. No URL-encoding to get wrong.
 #   2. REDIS_URL, where the SCHEME carries TLS and nothing else is needed:
-#        REDIS_URL=rediss://:<password>@<host>:6380/0?ssl_cert_reqs=required
+#        REDIS_URL=rediss://<host>:6380/0?ssl_cert_reqs=required
+#        REDIS_PASSWORD=<password>
+#        REDIS_USER=                        # blank — see below
+#        (The password is better kept OUT of the URL. A URL is printed into log
+#         lines, error messages and deployment tooling; a password in one travels
+#         with it. Credentials in the URL still work and still win, so an existing
+#         rediss://:<password>@host URL keeps behaving exactly as before.)
 #        (6380 is an EXAMPLE, not a default — the TLS port is provider-specific:
 #         Memorystore 6378, ElastiCache 6379, Azure Cache 6380. A wrong port
 #         hangs the connection rather than erroring, so read it off the instance.)
```

**File**: `runner/sample.env` (modified, +7/-1)
```diff
@@ -55,7 +55,13 @@ REDIS_SENTINEL_MASTER_NAME=mymaster
 #   1. Discrete vars (what the Helm chart and these samples use). Set REDIS_SSL=true
 #      alongside REDIS_HOST/REDIS_PORT. No URL-encoding to get wrong.
 #   2. REDIS_URL, where the SCHEME carries TLS and nothing else is needed:
-#        REDIS_URL=rediss://:<password>@<host>:6380/0?ssl_cert_reqs=required
+#        REDIS_URL=rediss://<host>:6380/0?ssl_cert_reqs=required
+#        REDIS_PASSWORD=<password>
+#        REDIS_USER=                        # blank — see below
+#        (The password is better kept OUT of the URL. A URL is printed into log
+#         lines, error messages and deployment tooling; a password in one travels
+#         with it. Credentials in the URL still work and still win, so an existing
+#         rediss://:<password>@host URL keeps behaving exactly as before.)
 #        (6380 is an EXAMPLE, not a default — the TLS port is provider-specific:
 #         Memorystore 6378, ElastiCache 6379, Azure Cache 6380. A wrong port
 #         hangs the connection rather than erroring, so read it off the instance.)
```

**File**: `unstract/core/src/unstract/core/cache/redis_client.py` (modified, +290/-28)
```diff
@@ -136,15 +136,17 @@ def url_db_path(url: str) -> int | None:
         return None
 
 
-def _parse_bool(raw: str, default: bool, name: str) -> bool:
+def _parse_bool(raw: str | None, default: bool, name: str) -> bool:
     """Parse a boolean env var; blank means UNSET, unknown warns and defaults.
 
     Blank-means-unset is this repo's own convention — `FOO=` in a sample.env
     means "leave the default", and every other variable in UN-4123 treats it that
     way. `os.getenv` does not: it reports an empty string as SET, so a bare
     `os.getenv(...) == "true"` turns `FOO=` into False.
+
+    Accepts None so callers can hand it env_chain's "nothing was set" directly.
     """
-    value = raw.strip().lower()
+    value = (raw or "").strip().lower()
     if not value:
         return default
     if value in _TRUE_LITERALS:
@@ -190,9 +192,7 @@ def resolve_ssl_cert_reqs(env_prefix: str = "REDIS_") -> str:
     endpoint, three verification policies. Case and stray whitespace had the same
     effect, since the "is verification off?" test is an equality check.
     """
-    raw = os.getenv(
-        f"{env_prefix}SSL_CERT_REQS", os.getenv("REDIS_SSL_CERT_REQS", "")
-    ).strip()
+    raw = (env_chain(f"{env_prefix}SSL_CERT_REQS", "REDIS_SSL_CERT_REQS") or "").strip()
     value = raw.lower()
     if not value:
         return _DEFAULT_CERT_REQS
@@ -208,6 +208,32 @@ def resolve_ssl_cert_reqs(env_prefix: str = "REDIS_") -> str:
     return value
 
 
+def resolve_sentinel_master_check_hostname(env_prefix: str = "REDIS_") -> bool:
+    """ssl_check_hostname for a Sentinel-managed MASTER connection.
+
+    The master plane answers by a DIFFERENT rule than the discovery plane, and
+    exporting it is what stops a consumer re-deriving it: a master connects to
+    whatever `SENTINEL get-master-addr-by-name` returns, and
+    SentinelManagedConnection assigns that address straight to ``self.host``,
+    which SSLConnection passes as ``server_hostname``. It is an IP, so
+    verification is checked against an address no DNS SAN covers — and pinning
+    an IP SAN is not a workable answer, because the address changes on failover.
+
+    So it is OFF unless the operator asked for it explicitly, matching
+    _tls_kwargs(sentinel_master=True). Off as well when verification itself is
+    off: the pinned redis-py (5.2.1) does NOT coerce that pair — it assigns
+    check_hostname verbatim — so CERT_NONE with checking on reaches Python's ssl
+    module, which rejects it.
+    """
+    raw, _ = env_chain_named(
+        f"{env_prefix}SSL_CHECK_HOSTNAME", "REDIS_SSL_CHECK_HOSTNAME"
+    )
+    explicit = (raw or "").strip().lower() in _TRUE_LITERALS | _FALSE_LITERALS
+    if not explicit or resolve_ssl_cert_reqs(env_prefix) == "none":
+        return False
+    return resolve_ssl_check_hostname(env_prefix)
+
+
 def resolve_ssl_check_hostname(env_prefix: str = "REDIS_", default: bool = True) -> bool:
     """{prefix}SSL_CHECK_HOSTNAME, falling back to REDIS_SSL_CHECK_HOSTNAME, then on.
 
@@ -216,13 +242,10 @@ def resolve_ssl_check_hostname(env_prefix: str = "REDIS_", default: bool = True)
     FALSE, silently downgrading the Django cache to an encrypted but
     unauthenticated connection.
     """
-    return _parse_bool(
-        os.getenv(
-            f"{env_prefix}SSL_CHECK_HOSTNAME", os.getenv("REDIS_SSL_CHECK_HOSTNAME", "")
-        ),
-        default,
-        f"{env_prefix}SSL_CHECK_HOSTNAME",
+    raw, name = env_chain_named(
+        f"{env_prefix}SSL_CHECK_HOSTNAME", "REDIS_SSL_CHECK_HOSTNAME"
     )
+    return _parse_bool(raw, default, name)
 
 
 def url_cert_reqs(url: str) -> str | None:
@@ -322,7 +345,8 @@ def ensure_tls_query_params(
     """Add the TLS settings a `rediss://` URL is missing, leaving present ones alone.
 
     Anything that hands a URL to a library that reads TLS out of the query string
-    needs this: kombu's KombuManager takes a URL and NOTHING else, and
+    needs this: kombu's KombuManager reads TLS from
```

---

### Incident Patch 2: `9b76d929` (2026-09-30)
**Commit Message**: [MISC] Fix flaky integration CI: rig Postgres lock limit and unmocked pg_barrier dispatch (#2308)

[MISC] Raise the rig Postgres lock limit and mock dispatch in pg_barrier enqueue tests

The integration tier fails intermittently for two unrelated reasons.

Backend: every xdist worker migrates its own test database in one
transaction, holding a lock per table and constraint. The rig's Postgres
runs with the default max_locks_per_transaction=64, so the shared lock
table overflows at random ("out of shared memory") and errors hundreds of
backend tests at setup. Start the container with 256.

Workers: five TestPgBarrierEnqueue tests never mocked
queue_backend.dispatch.dispatch. Since UN-4078 made the PG queue the only
transport, enqueue really dispatches the headers, opening a connection
from DB_* env (default host unstract-db) instead of the TEST_DB_* test
database. Wrap them in the same patch their neighbours use. Also drop a
duplicated _barrier_pg_decrement import.

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `tests/rig/runtime.py` (modified, +7/-1)
```diff
@@ -333,7 +333,13 @@ def up(self) -> PlatformEndpoints:
         # __post_init__ invariant (host without port) is self-cleaning;
         # otherwise a partial spec leaks the four containers we just started.
         try:
-            pg = PostgresContainer("pgvector/pgvector:pg15")
+            # Every xdist worker migrates its own test database in one
+            # transaction, each holding a lock per table and constraint. The
+            # default of 64 overflows the shared lock table intermittently
+            # ("out of shared memory") and errors the whole backend group.
+            pg = PostgresContainer("pgvector/pgvector:pg15").with_command(
+                "postgres -c max_locks_per_transaction=256"
+            )
             pg.start()
             self._stack.append(pg)
             redis = RedisContainer("redis:7.2.3").start()
```

**File**: `workers/tests/test_pg_barrier.py` (modified, +40/-36)
```diff
@@ -27,7 +27,6 @@
     _barrier_pg_decrement,
     _fire_barrier_callback,
     barrier_pg_abort,
-    _barrier_pg_decrement,
     claim_batch,
     run_batch_with_barrier,
     try_claim_orchestration,
@@ -850,13 +849,14 @@ def test_enqueue_sets_expires_cap_and_fresh_progress(self, barrier_db, monkeypat
         # expired nor stale. (UN-3661)
         monkeypatch.setenv("WORKER_BARRIER_KEY_TTL_SECONDS", "600")
         task, _ = _mock_header_task()
-        PgBarrier().enqueue(
-            [task],
-            callback_task_name="cb",
-            callback_kwargs={"execution_id": "exec-SD"},
-            callback_queue="general",
-            app_instance=None,
-        )
+        with patch("queue_backend.dispatch.dispatch"):
+            PgBarrier().enqueue(
+                [task],
+                callback_task_name="cb",
+                callback_kwargs={"execution_id": "exec-SD"},
+                callback_queue="general",
+                app_instance=None,
+            )
         assert 590 <= _expires_in_seconds(barrier_db, "exec-SD") <= 600  # ~ttl cap
         assert _last_progress_age_seconds(barrier_db, "exec-SD") < 5  # fresh
 
@@ -920,34 +920,37 @@ def test_upsert_overwrites_stale_state(self, barrier_db):
                 "        now() + interval '1h', now())"
             )
         task, _ = _mock_header_task()
-        PgBarrier().enqueue(
-            [task, _mock_header_task()[0]],
-            callback_task_name="cb",
-            callback_kwargs={"execution_id": "exec-R"},
-            callback_queue="general",
-            app_instance=None,
-        )
+        with patch("queue_backend.dispatch.dispatch"):
+            PgBarrier().enqueue(
+                [task, _mock_header_task()[0]],
+                callback_task_name="cb",
+                callback_kwargs={"execution_id": "exec-R"},
+                callback_queue="general",
+                app_instance=None,
+            )
         assert _row(barrier_db, "exec-R") == (2, [])
 
     def test_enqueue_stamps_organization_id(self, barrier_db):
         # The whole reason the org column + migration exist (reaper recovery).
-        PgBarrier().enqueue(
-            [_mock_header_task()[0]],
-            callback_task_name="cb",
-            callback_kwargs={"execution_id": "exec-ORG", "organization_id": "org-42"},
-            callback_queue="general",
-            app_instance=None,
-        )
+        with patch("queue_backend.dispatch.dispatch"):
+            PgBarrier().enqueue(
+                [_mock_header_task()[0]],
+                callback_task_name="cb",
+                callback_kwargs={"execution_id": "exec-ORG", "organization_id": "org-42"},
+                callback_queue="general",
+                app_instance=None,
+            )
         assert _org(barrier_db, "exec-ORG") == "org-42"
 
     def test_enqueue_defaults_org_to_empty_when_absent(self, barrier_db):
-        PgBarrier().enqueue(
-            [_mock_header_task()[0]],
-            callback_task_name="cb",
-            callback_kwargs={"execution_id": "exec-NOORG"},  # no organization_id
-            callback_queue="general",
-            app_instance=None,
-        )
+        with patch("queue_backend.dispatch.dispatch"):
+            PgBarrier().enqueue(
+                [_mock_header_task()[0]],
+                callback_task_name="cb",
+                callback_kwargs={"execution_id": "exec-NOORG"},  # no organization_id
+                callback_queue="general",
+                app_instance=None,
+            )
         assert _org(barrier_db, "exec-NOORG") == ""
 
     def test_upsert_refreshes_org_on_reenqueue(self, barrier_db):
@@ -960,13 +963,14 @@ def test_upsert_refreshes_org_on_reenqueue(self, barrier_db):
                 "VALUES ('exec-REORG', 'old-org', 1, '[]'::jsonb, now(), "
                 "        now() + interval '1h', now())"
             )
-        PgBarrier().enqueue(
-            [_mock_header_task()[0]],
-            callback_task_name="cb"
```

---

### Incident Patch 3: `d12e452d` (2026-09-29)
**Commit Message**: UN-2238 [FIX] Enforce the frontend CSP (out of report-only mode) (#2245)

* UN-2238 [FIX] CSP: allow third-party origins found in report-only sweep

Sweep of the report-only policy on a live deployment (browsing + per-directive
probes) turned up hosts the shipped bundle loads but no directive allows:

- style-src/font-src: cdn.jsdelivr.net (Monaco CSS + codicon)
- img-src: cdn.jsdelivr.net (emoji-datasource), ProductFruits, GTM, GA,
  reCAPTCHA assets, q.stripe.com
- media-src: cdn.productfruits.com (new directive; default-src had no blob:)
- connect-src: unpkg.com, api.productfruits.com, GA4 regional endpoints,
  reCAPTCHA api2, m.stripe.network
- frame-src: googletagmanager ns.html, m.stripe.network

ProductFruits' animations.css was the one violation observed in normal use; the
rest belong to code paths and flows that were not exercised.

Drops the bare `wss:` wildcard: socket.io connects to window.location.origin
(GetStaticData getBaseUrl) and 'self' covers same-origin ws/wss per CSP3,
verified with a ws:// probe against nginx serving this policy.

Adds .claude/skills/csp-check so the policy can be re-checked against a build or
a deployment when a frontend dependency changes.



**File**: `.claude/skills/csp-check/SKILL.md` (added, +182/-0)
```diff
@@ -0,0 +1,182 @@
+---
+name: csp-check
+description: >
+  Check the frontend Content-Security-Policy in frontend/nginx.conf against what the app
+  actually loads. The policy is enforced, so a host it does not list is blocked. Use when
+  adding or upgrading a third-party frontend dependency (CDN, analytics, payments,
+  widgets), when a feature loads assets from a new external host, when a CSP violation
+  shows up in the browser console, or when something works in `bun run dev` but breaks
+  behind nginx.
+---
+
+# CSP Check
+
+The frontend ships an enforcing `Content-Security-Policy` header from
+`frontend/nginx.conf`. A resource from an origin no directive lists is **blocked** — whatever needed it breaks, and the only trace is a
+console violation. So the policy has to be widened in the same change that adds the
+dependency, not after someone reports a broken page.
+
+There is no report collector: violations reach each user's browser console and nowhere
+else. These checks are the only way to see a gap before a user does. Note the header is
+only served by the production nginx image — `bun run dev` has no CSP at all, so "it worked
+locally" says nothing.
+
+Three checks, cheapest first. Run 1 on every change that touches a frontend dependency;
+run 2 and 3 before widening the policy or shipping a new third-party integration.
+
+## 1. Static: does the bundle reference a host the policy never allows?
+
+```bash
+cd .claude/skills/csp-check/scripts
+python3 extract_policy.py                                  # what the policy says today
+python3 scan_origins.py --url https://us-central.unstract.com
+python3 scan_origins.py --dist                             # after `bun run build`
+```
+
+Bare `--dist` resolves the repo's own `frontend/build`, from any directory. Give it a path
+only for a build somewhere else — and note the path is relative to your shell, not to the
+script. The script exits non-zero when `--dist` is missing or holds no `.js`, when a
+`--url` index names no bundle, and when a chunk `index.html` links fails to fetch; a 404
+on a path found only inside a bundle string is tolerated, since that is usually a worker
+path a chunk names but never loads. Check the file count on the first output line against
+what the build produced.
+
+`scan_origins.py` pulls every `/assets/*.js|css` chunk (following relative imports), plus
+`index.html` and the entrypoint-generated `/config/runtime-config.js`, extracts external
+`https://` URLs, and exits non-zero on any the policy would block. Hosts that only appear
+in doc links, XML namespaces and library error strings are listed in its `IGNORED` set —
+extend it rather than widening the policy for a host nothing fetches.
+
+Verdicts: `MISSING` (no fetch directive names the host — `form-action`, `base-uri` and
+`frame-ancestors` do not count, since nothing can be loaded on their strength), `PATH`
+(listed path-scoped and this URL falls outside it — `https://www.google.com/recaptcha/`
+grants that path only, so `https://www.google.com/g/collect` is still blocked) and `PORT`
+(a source with no port grants 443 only). `*.` sources match subdomains only, the way the
+browser reads them: `https://*.google-analytics.com` covers `region1.google-analytics.com`
+but not a bare `google-analytics.com`.
+
+This catches "a new dependency pulls from a new CDN". It cannot tell you *which*
+directive loads a host — a font from a script-src-only host still violates. That is check 2.
+
+What it still cannot see: a URL assembled at runtime, and a URL supplied by deployment
+config. `VITE_CUSTOM_LOGO_URL` / `VITE_FAVICON_PATH` are the live example — see
+"Operator-supplied URLs" below.
+
+## 2. Live: probe the deployed policy, directive by directive
+
+With the chrome-devtools MCP on a page of the target deployment:
+
+1. `python3 extract_policy.py --json` and paste `directives` into `DIRECTIVES` in
+   `scripts/probe.js`.
+2. Run the whole file as the `function` argument of `evaluate_script`.
+
+It
```

**File**: `.claude/skills/csp-check/scripts/extract_policy.py` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+#!/usr/bin/env python3
+"""Parse the Content-Security-Policy out of frontend/nginx.conf.
+
+Usage:
+    python3 extract_policy.py [path/to/nginx.conf]        # pretty-print per directive
+    python3 extract_policy.py --json [path/to/nginx.conf] # machine-readable
+"""
+
+import json
+import re
+import sys
+from pathlib import Path
+
+HEADER_RE = re.compile(
+    r'add_header\s+(Content-Security-Policy(?:-Report-Only)?)\s+"(?P<policy>[^"]*)"',
+    re.IGNORECASE,
+)
+DEFAULT_CONF = Path(__file__).resolve().parents[4] / "frontend" / "nginx.conf"
+
+
+def parse(conf_path: Path) -> tuple[str, dict[str, list[str]]]:
+    """Return (header_name, {directive: [sources]}) for the conf's enforcing CSP header.
+
+    Everything downstream trusts this as "what the browser sees", so it has to pick the
+    same header the browser would: not a commented-out one, and not a -Report-Only
+    header that happens to sit above the enforcing one (the usual shape while the next
+    policy change is being trialled).
+    """
+    live = "\n".join(
+        line
+        for line in conf_path.read_text().splitlines()
+        if not line.lstrip().startswith("#")
+    )
+    matches = HEADER_RE.findall(live)
+    if not matches:
+        raise SystemExit(f"No Content-Security-Policy add_header found in {conf_path}")
+    enforcing = [m for m in matches if m[0].lower() == "content-security-policy"]
+    chosen = enforcing or matches
+    if len(chosen) > 1:
+        names = ", ".join(name for name, _ in chosen)
+        raise SystemExit(
+            f"{conf_path} has {len(chosen)} CSP headers ({names}) -- ambiguous"
+        )
+    header, policy = chosen[0]
+    directives: dict[str, list[str]] = {}
+    for chunk in policy.split(";"):
+        parts = chunk.split()
+        if not parts:
+            continue
+        if parts[0] in directives:
+            # The browser honours the first occurrence and ignores the rest, so keeping
+            # the last would let the gate clear sources the browser never applies.
+            print(
+                f"warning: duplicate directive {parts[0]!r} in {conf_path}; "
+                "the browser uses the first and ignores this one",
+                file=sys.stderr,
+            )
+            continue
+        directives[parts[0]] = parts[1:]
+    return header, directives
+
+
+def main() -> None:
+    args = [a for a in sys.argv[1:] if a != "--json"]
+    as_json = "--json" in sys.argv[1:]
+    conf = Path(args[0]) if args else DEFAULT_CONF
+    header, directives = parse(conf)
+    if as_json:
+        print(json.dumps({"header": header, "directives": directives}, indent=2))
+        return
+    print(f"{header}  ({conf})")
+    for directive, sources in directives.items():
+        print(f"\n  {directive}")
+        for source in sources:
+            print(f"      {source}")
+
+
+if __name__ == "__main__":
+    main()
```

**File**: `.claude/skills/csp-check/scripts/probe.js` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+/**
+ * Browser-side CSP probe.
+ *
+ * Paste the whole file as the `function` argument of the chrome-devtools MCP
+ * `evaluate_script` tool while a page from the target deployment is selected, with the
+ * output of `extract_policy.py --json` inlined as DIRECTIVES below.
+ *
+ * It loads one throwaway resource per (directive, host) pair and records what the live
+ * policy reports, so it answers two questions the config file alone cannot:
+ *   1. does the deployment actually serve the policy we think it does?
+ *   2. is each host allowed on the directive that will really load it?
+ * Four control probes must always be reported -- if they are not, CSP is not applied.
+ *
+ * Note: CSP evaluates redirect targets. A probe path that 404-redirects to another host
+ * (https://hooks.stripe.com/ -> https://stripe.com) reports that target, not a real gap.
+ */
+async () => {
+  const DIRECTIVES = {
+    /* paste extract_policy.py --json "directives" here */
+  };
+
+  const KIND_BY_DIRECTIVE = {
+    "script-src": "script",
+    "style-src": "style",
+    "img-src": "img",
+    "font-src": "font",
+    "connect-src": "connect",
+    "frame-src": "frame",
+    "media-src": "media",
+    "worker-src": "worker",
+  };
+
+  const probes = [];
+  for (const [directive, sources] of Object.entries(DIRECTIVES)) {
+    const kind = KIND_BY_DIRECTIVE[directive];
+    if (!kind) continue;
+    for (const source of sources) {
+      if (!source.startsWith("https://")) continue;
+      // A wildcard source is not a hostname: https://*.example.com/__csp_probe never
+      // parses, so the request dies before CSP sees it and the probe looks clean whether
+      // or not the deployment serves the wildcard. Substituting a concrete label does
+      // test it -- CSP is evaluated before DNS, which is why the csp-control.invalid
+      // controls below get reported despite not resolving.
+      const url = source.replace("://*.", "://csp-probe.").replace(/\/$/, "");
+      probes.push([kind, url + "/__csp_probe", false]);
+    }
+  }
+  for (const kind of ["img", "connect", "script"]) {
+    probes.push([kind, "https://csp-control.invalid/__csp_probe", true]);
+  }
+  probes.push(["connect", "wss://csp-control.invalid/__csp_probe", true]);
+
+  const hits = [];
+  const onViolation = (e) =>
+    hits.push({
+      directive: e.effectiveDirective || e.violatedDirective,
+      blocked: e.blockedURI,
+    });
+  document.addEventListener("securitypolicyviolation", onViolation);
+  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
+
+  const load = (kind, url) => {
+    if (kind === "script") {
+      const el = document.createElement("script");
+      el.src = url;
+      document.head.appendChild(el);
+    } else if (kind === "style") {
+      const el = document.createElement("link");
+      el.rel = "stylesheet";
+      el.href = url;
+      document.head.appendChild(el);
+    } else if (kind === "img") {
+      new Image().src = url;
+    } else if (kind === "font") {
+      new FontFace("cspProbe", `url(${url})`).load().catch(() => {});
+    } else if (kind === "connect") {
+      if (url.startsWith("wss:")) new WebSocket(url);
+      else fetch(url, { mode: "no-cors" }).catch(() => {});
+    } else if (kind === "frame") {
+      const el = document.createElement("iframe");
+      el.src = url;
+      el.style.display = "none";
+      document.body.appendChild(el);
+    } else if (kind === "media") {
+      const el = document.createElement("video");
+      el.src = url;
+      document.body.appendChild(el);
+      el.load();
+    } else if (kind === "worker") {
+      new Worker(url);
+    }
+  };
+
+  const expected = [];
+  for (const [kind, url, isControl] of probes) {
+    try {
+      load(kind, url);
+    } catch (e) {
+      /* cross-origin Worker/WebSocket constructors can throw; CSP still reports first */
+    }
+    if (isControl) expected.push(url);
+    await wait(250);
+  }
+  await wait(3000);
+  doc
```

**File**: `.claude/skills/csp-check/scripts/scan_origins.py` (added, +291/-0)
```diff
@@ -0,0 +1,291 @@
+#!/usr/bin/env python3
+"""List external origins referenced by the frontend and flag ones the CSP never allows.
+
+Sources of truth:
+  * the policy in frontend/nginx.conf (see extract_policy.py)
+  * every external https:// host that appears in the built JS/CSS
+
+A host that no directive allows is a CSP violation waiting to happen the moment the
+code path that fetches it runs. A host that IS allowed somewhere may still violate on
+the specific directive that loads it (a style pulled from a script-src-only host, say)
+-- run the browser probe from SKILL.md to settle that.
+
+Bare --dist resolves this repo's frontend/build from any directory; pass a path only for
+a build elsewhere, and note it is relative to your shell, not to this script:
+
+    python3 scan_origins.py --dist                                 # after `bun run build`
+    python3 scan_origins.py --url https://us-central.unstract.com
+    python3 scan_origins.py --dist /tmp/other-build --conf /tmp/other-nginx.conf
+
+Exit non-zero on anything that means "this scan did not actually check the policy": a
+host in no fetch directive, a path or port outside what its sources allow, a --dist that
+is missing or holds no .js, a URL whose index names no bundle, or a failure fetching a
+chunk index.html links. A 404 on a path found only inside a bundle string is tolerated --
+that is usually a worker path a chunk names but never loads. A scan that inspected
+nothing must never look like a pass.
+"""
+
+import argparse
+import re
+import sys
+import time
+import urllib.error
+import urllib.request
+from pathlib import Path
+
+from extract_policy import DEFAULT_CONF, parse
+
+URL_RE = re.compile(
+    r"https://([a-zA-Z0-9][a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})(:\d+)?(/[^\s\"'`)\\<>]*)?"
+)
+
+# Directives that govern navigation or reporting rather than loading a subresource. A
+# host listed in one of them cannot be fetched on its strength, so letting it into the
+# allowed map would clear references the browser blocks.
+NON_FETCH_DIRECTIVES = {
+    "form-action",
+    "base-uri",
+    "frame-ancestors",
+    "report-uri",
+    "report-to",
+    "sandbox",
+}
+ASSET_RE = re.compile(r"/assets/[A-Za-z0-9_%.\-]+\.(?:js|css)")
+RELATIVE_ASSET_RE = re.compile(r"[\"'(](\./[A-Za-z0-9_%.\-]+\.(?:js|css))")
+
+# Hosts that only ever appear as documentation links, XML namespaces or library
+# error strings -- they are never fetched, so they need no CSP entry.
+IGNORED = {
+    "www.w3.org",
+    "json-schema.org",
+    "momentjs.com",
+    "github.com",
+    "raw.githubusercontent.com",
+    "reactjs.org",
+    "react.dev",
+    "redux.js.org",
+    "redux-toolkit.js.org",
+    "react-dnd.github.io",
+    "handlebarsjs.com",
+    "socket.io",
+    "npms.io",
+    "example.com",
+    "bit.ly",
+    "fb.me",
+    "yandex.com",
+    "sentry.io",
+    # posthog-js's built-in US defaults. Inert only because api_host is pinned to
+    # https://eu.i.posthog.com/ at frontend/src/index.jsx -- move that pin and these
+    # become live hosts the policy blocks, with this list keeping the gate quiet about it.
+    "posthog.com",
+    "app.posthog.com",
+    "us.posthog.com",
+    "us.i.posthog.com",
+    "us-assets.i.posthog.com",
+    "docs.unstract.com",
+    "join-slack.unstract.com",
+    "billing.stripe.com",
+    "checkout.stripe.com",
+    "fonts.google.com",
+}
+
+
+def read_dist(dist: Path) -> dict[str, str]:
+    # rglob on a missing directory yields nothing instead of raising, which would turn a
+    # mistyped --dist into a clean pass over zero files.
+    if not dist.is_dir():
+        raise SystemExit(f"--dist {dist} is not a directory (cwd: {Path.cwd()})")
+    files = {}
+    for pattern in ("*.js", "*.css", "*.html"):
+        for path in dist.rglob(pattern):
+            files[str(path.relative_to(dist))] = path.read_text(
+                encoding="utf-8", errors="ignore"
+            )
+    # index.html alone is not a build. Without this, an interrupted or wron
```

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -701,6 +701,7 @@ CLAUDE.md
 !.claude/skills/
 .claude/skills/*
 !.claude/skills/worktree/
+!.claude/skills/csp-check/
 CONTRIBUTION_GUIDE.md
 .mcp.json
 
```

---

### Incident Patch 4: `ff9eaddf` (2026-09-29)
**Commit Message**: UN-2646 [FIX] Skip the OSS-only vlm_utils contract in a merged cloud tree (#2304)

Cloud CI runs this suite against the OSS tree with the cloud plugins copied
in, so plugins/vlm_image_answer is importable and
test_cloud_package_absent_in_oss fails on every cloud run now that #2210 has
merged and unstract-cloud#1690 supplies the plugin.

Skip the class wholesale rather than that one test: once the hooks are real,
the remaining "returns None" / "does not raise" assertions stop describing
no-ops and pass for reasons they never meant to check. Delegation in that
tree is already covered by the cloud_hooks tests.

Verified both ways: OSS-only tree 10 passed; with plugins/vlm_image_answer
copied in, 5 passed and 5 skipped.

Co-authored-by: Claude Opus 5 (1M context) <noreply@anthropic.com>

**File**: `backend/prompt_studio/tests/test_vlm_utils.py` (modified, +17/-0)
```diff
@@ -15,7 +15,24 @@
 from prompt_studio import vlm_utils
 
 
+@pytest.mark.skipif(
+    vlm_utils.VLM_IMAGE_ANSWER_AVAILABLE,
+    reason=(
+        "cloud plugin merged into the tree (cloud CI runs this suite against "
+        "the OSS tree with plugins/vlm_image_answer copied in) — the "
+        "package-absent contract below only holds in an OSS-only tree"
+    ),
+)
 class TestOssNoOps:
+    """The OSS-only state: no cloud package, so every helper is a no-op.
+
+    Skipped wholesale rather than per-test in a merged cloud tree: once the
+    hooks are real, "returns None" and "does not raise" stop being no-op
+    assertions and start depending on what the cloud hook does with the
+    dummy arguments below — passing for reasons these tests never meant to
+    check. Delegation in that tree is covered by the cloud_hooks tests.
+    """
+
     def test_cloud_package_absent_in_oss(self) -> None:
         assert vlm_utils.VLM_IMAGE_ANSWER_AVAILABLE is False
 
```

---

### Incident Patch 5: `f9dc6656` (2026-09-29)
**Commit Message**: UN-4136 [FIX] Report PG worker pods ready only after every consumer child has loaded (#2301)

UN-4136 Serve /ready from the PG consumer so a startupProbe can wait for every child to load

A prefork PG consumer pod went Ready ~20s after start while its N children
were still running their own `import worker` bootstrap in parallel (3-8
cores for 1-2 minutes). Kubernetes' HPA only discards CPU sampled before a
pod turns Ready, so it read that burst as load: on integration it drove
api-file-processing 2 -> 30 pods in ~75s, and CAST AI's HPA calibration
raised the CPU request to 1.1-1.4 cores from it.

/health cannot express "still loading": the heartbeats are seeded fresh so
liveness does not trip during a slow import. Add a separate /ready:

- LivenessServer takes an optional ready_fn and serves /ready (/readyz):
  200 when it returns True, 503 "starting" otherwise or if it raises. With
  no ready_fn the path stays a 404, so a probe aimed at the reaper fails.
- The supervisor keeps a shared per-child "loaded" flag. A child sets its
  slot after `import worker` and building its consumer; reap() clears it.
  /ready is 200 only when every slot is set, and the JSON reports
  loaded_childre

**File**: `workers/pg_queue_consumer/supervisor.py` (modified, +54/-8)
```diff
@@ -23,6 +23,14 @@
 a row, never reaching a real poll) forces the probe to 503 so k8s restarts the
 pod rather than the supervisor masking a wedged fleet with fresh-looking re-forks.
 
+**Readiness** (UN-4136): the same port serves ``/ready``, which answers 200 only
+once EVERY child has finished its ``import worker`` bootstrap and built its
+consumer. ``/health`` cannot say this — the heartbeats are seeded fresh at
+construction so liveness does not trip during a slow import — which is why a pod
+used to go Ready ~20s after start while its N children were still importing, and
+the HPA counted that multi-core start-up burst as load. A k8s ``startupProbe`` on
+``/ready`` keeps the pod NotReady until the burst is over.
+
 **Fork safety**: the initial fleet is forked while the parent is single-threaded.
 Re-forks happen after the liveness daemon thread exists; the only other thread is
 that probe (idle in ``select`` between requests, and CPython 3.12 re-inits the
@@ -152,6 +160,11 @@ def __init__(self, concurrency: int) -> None:
         now = time.time()
         for i in range(concurrency):
             self._heartbeats[i] = now
+        # Shared, fork-inherited "finished loading" flags (one per child), read by
+        # /ready. Same write discipline as the heartbeats: the owning child sets
+        # its slot once bootstrapped; the parent clears it in reap(), when no child
+        # owns the slot. Zero-initialised, so a fresh fleet starts not-ready.
+        self._loaded = multiprocessing.Array("b", concurrency, lock=False)
         self._pids: dict[int, int] = {}
         self._last_fork: dict[int, float] = {}
         self._consecutive_crashes: dict[int, int] = {}
@@ -168,6 +181,13 @@ def heartbeats(self):  # noqa: ANN201
         """
         return self._heartbeats
 
+    @property
+    def loaded(self):  # noqa: ANN201
+        """The shared loaded-flag array (a ctypes array, passed to forked children,
+        which set their own slot once bootstrapped).
+        """
+        return self._loaded
+
     def _validate(self, slot: int) -> None:
         if not 0 <= slot < self._n:
             raise IndexError(f"slot {slot} out of range [0, {self._n})")
@@ -184,9 +204,14 @@ def record_fork(self, slot: int, pid: int) -> None:
         self._restart_due.pop(slot, None)
 
     def reap(self, slot: int) -> float:
-        """Drop the slot's pid + last-fork together; return the child's uptime (s)."""
+        """Drop the slot's pid + last-fork together; return the child's uptime (s).
+
+        Also clears the slot's loaded flag: its replacement must finish its own
+        bootstrap before the fleet counts as loaded again.
+        """
         forked_at = self._last_fork.pop(slot, time.monotonic())
         self._pids.pop(slot, None)
+        self._loaded[slot] = 0
         return time.monotonic() - forked_at
 
     def schedule_restart(self, slot: int, uptime: float) -> int:
@@ -231,6 +256,14 @@ def is_crash_looping(self) -> bool:
             n >= _CRASH_LOOP_THRESHOLD for n in tuple(self._consecutive_crashes.values())
         )
 
+    def loaded_count(self) -> int:
+        """Children that have finished their bootstrap (``import worker`` + build)."""
+        return sum(self._loaded)
+
+    def all_loaded(self) -> bool:
+        """Readiness verdict source: True once every slot's child has loaded."""
+        return self.loaded_count() == self._n
+
     def oldest_age(self) -> float:
         now = time.time()
         return max((now - hb for hb in self._heartbeats), default=0.0)
@@ -244,14 +277,16 @@ def freshness(self) -> float:
         return float("inf") if self.is_crash_looping() else self.oldest_age()
 
 
-def _run_child(slot: int, heartbeats) -> None:  # noqa: ANN001 (ctypes array)
+def _run_child(slot: int, heartbeats, loaded) -> None:  # noqa: ANN001 (ctypes arrays)
     """Build one consumer and run it forever, publishing its heartbeat.
 
     The worker import (and any connections it opens) happens HERE, in
```

**File**: `workers/queue_backend/pg_queue/README.md` (modified, +8/-0)
```diff
@@ -113,6 +113,14 @@ deadline**, then SIGKILLs stragglers. Must be ≤ the pod's
 the supervisor reports the *oldest* child's staleness on `/health`. Frozen during a
 long task, so a wedged child goes stale and trips the probe.
 
+**Readiness** — `/ready` on the same port answers 200 only once **every** child has
+finished its `import worker` bootstrap and built its consumer (503 `starting` until
+then; the JSON carries `loaded_children`). It is for a k8s `startupProbe`: the N
+children import in parallel for a minute or two at multiple cores, and a pod that is
+not yet Ready has that CPU ignored by the HPA instead of read as load. Single-process
+consumers (`CONCURRENCY = 1`) answer 200 as soon as the port is up, since they bind it
+only after loading. The reaper serves no `/ready` (404).
+
 **Reaper** — a singleton (leader-elected) sweeper that recovers **stranded** work:
 fast-fails a barrier whose `last_progress_at` stalled, cascades a terminal
 execution to its files, and sweeps expired retention rows.
```

**File**: `workers/queue_backend/pg_queue/consumer.py` (modified, +6/-0)
```diff
@@ -1212,6 +1212,11 @@ class LivenessServer(_BaseLivenessServer):
     consumer's heartbeat (``seconds_since_last_poll``). Same wire shape as before
     (``/health`` → 200 fresh / 503 stale, ``check="pg_queue_poll"``), plus
     ``/metrics`` exporting that heartbeat as a scrapeable gauge.
+
+    ``/ready`` is always 200 here: it takes an already-built consumer, and
+    ``main()`` only starts it after ``import worker`` and the build, so a probe
+    that can reach it is talking to a loaded process. The same ``startupProbe``
+    therefore works for single-process and prefork pools alike.
     """
 
     def __init__(
@@ -1227,6 +1232,7 @@ def __init__(
             check_name="pg_queue_poll",
             age_key="seconds_since_last_poll",
             metrics_fn=metrics.render,
+            ready_fn=lambda: True,
             thread_name="pg-consumer-liveness",
             log_label="pg-queue consumer",
         )
```

**File**: `workers/queue_backend/pg_queue/liveness.py` (modified, +47/-10)
```diff
@@ -17,6 +17,12 @@
 container/k8s probe reaches it from outside the process) in a daemon thread.
 Bind ``port=0`` to let the OS pick a free port (read back via :attr:`bound_port`)
 — used in tests. Start once; :meth:`stop` returns it to the inert state.
+
+Optionally also serves ``/ready`` (also ``/readyz``): "has this process finished
+loading?", answered by a ``ready_fn`` callable. It is a separate question from
+liveness — a process can be alive while it is still importing — and exists for a
+k8s ``startupProbe`` (UN-4136): a pod that is not yet Ready has its start-up CPU
+ignored by the HPA, so the import burst cannot trigger a scale-out.
 """
 
 from __future__ import annotations
@@ -46,9 +52,15 @@ class LivenessServer:
     module stays free of the prometheus dependency; the metric definitions live
     in :mod:`queue_backend.pg_queue.metrics`. A ``metrics_fn`` failure returns
     500 on ``/metrics`` only — it can never affect the ``/health`` verdict.
+
+    ``ready_fn`` (optional) additionally serves ``/ready``: 200 once it returns
+    True, else 503. Without it ``/ready`` is a 404, so a probe pointed at a
+    process that has no readiness notion fails loudly instead of passing. A
+    ``ready_fn`` that raises answers 503 — never a false "ready".
     """
 
     _PATHS = frozenset({"/health", "/healthz", "/livez"})
+    _READY_PATHS = frozenset({"/ready", "/readyz"})
     _METRICS_PATH = "/metrics"
     # Prometheus text exposition format (metrics.METRICS_CONTENT_TYPE — inlined
     # so this module keeps zero imports from the metrics side).
@@ -64,6 +76,7 @@ def __init__(
         age_key: str,
         extra_status_fn: Callable[[], dict[str, Any]] | None = None,
         metrics_fn: Callable[[], bytes] | None = None,
+        ready_fn: Callable[[], bool] | None = None,
         thread_name: str = "pg-queue-liveness",
         log_label: str = "pg-queue",
     ) -> None:
@@ -79,6 +92,7 @@ def __init__(
         self._age_key = age_key
         self._extra_status_fn = extra_status_fn
         self._metrics_fn = metrics_fn
+        self._ready_fn = ready_fn
         self._thread_name = thread_name
         # Prefixes the (now-shared) log messages so they stay attributable to the
         # source process after the consumer/reaper extraction (e.g. "pg-queue
@@ -99,9 +113,11 @@ def start(self) -> None:
         freshness_fn = self._freshness_fn
         stale_after = self._stale_after
         paths = self._PATHS
+        ready_paths = self._READY_PATHS
         metrics_path = self._METRICS_PATH
         metrics_content_type = self._METRICS_CONTENT_TYPE
         metrics_fn = self._metrics_fn
+        ready_fn = self._ready_fn
         check_name = self._check_name
         age_key = self._age_key
         extra_status_fn = self._extra_status_fn
@@ -114,6 +130,9 @@ def do_GET(self) -> None:
                 if metrics_fn is not None and path == metrics_path:
                     self._serve_metrics()
                     return
+                if ready_fn is not None and path in ready_paths:
+                    self._serve_ready()
+                    return
                 if path not in paths:
                     self.send_response(404)
                     self.end_headers()
@@ -123,26 +142,44 @@ def do_GET(self) -> None:
                 # fields are informational and never flip it.
                 age = freshness_fn()
                 stale = age > stale_after
-                # Extra fields first, then overlay the core fields — so a caller's
-                # extra_status_fn can NEVER clobber status/check/age_key/
-                # stale_after_seconds (which a monitor reads): core always wins.
-                payload: dict[str, Any] = {}
-                if extra_status_fn is not None:
-                    payload.update(extra_status_fn())
-                payload.update(
+                self._send_json(
+                    503 if stale else 200,
                     {
                         "status": "
```

**File**: `workers/tests/test_pg_consumer_supervisor.py` (modified, +126/-5)
```diff
@@ -24,6 +24,7 @@
     _join_children,
     _reap_dead,
     _restart_due_children,
+    _run_child,
     _try_fork_child,
     _wait_for_exit,
     concurrency_from_env,
@@ -184,6 +185,34 @@ def test_due_restarts_respects_backoff(self, monkeypatch):
         clock[0] += 100.0  # well past any backoff
         assert f.due_restarts() == [0]
 
+    # --- readiness (UN-4136) ---------------------------------------------------
+
+    def test_fresh_fleet_is_not_loaded(self):
+        # Unlike the heartbeats (seeded fresh), nothing is loaded at construction:
+        # a pod must not go Ready before its children have imported.
+        f = _Fleet(3)
+        assert f.loaded_count() == 0
+        assert f.all_loaded() is False
+
+    def test_all_loaded_only_when_every_slot_has_loaded(self):
+        f = _Fleet(3)
+        f.loaded[0] = 1
+        f.loaded[2] = 1
+        assert f.loaded_count() == 2
+        assert f.all_loaded() is False  # slot 1 still importing
+        f.loaded[1] = 1
+        assert f.all_loaded() is True
+
+    def test_reap_clears_the_slot_loaded_flag(self):
+        # A dead child's replacement must bootstrap again before the fleet counts
+        # as loaded; the stale flag must not carry over.
+        f = _Fleet(2)
+        f.loaded[0] = f.loaded[1] = 1
+        f.record_fork(1, 111)
+        f.reap(1)
+        assert list(f.loaded) == [1, 0]
+        assert f.all_loaded() is False
+
 
 class TestReapDead:
     def test_dead_child_reaped_and_rescheduled(self):
@@ -258,19 +287,32 @@ def test_parent_records_child(self):
             assert _try_fork_child(f, 0) is True
         assert f.alive_items() == [(0, 222)]
 
+    def test_child_is_handed_the_shared_heartbeat_and_loaded_arrays(self):
+        # The child writes its own slot in BOTH arrays; handing it a copy (or not
+        # handing over `loaded` at all) would leave /ready stuck at 503.
+        f = _Fleet(1)
+        with (
+            patch(f"{_MOD}.os.fork", return_value=0),  # we are the child
+            patch(f"{_MOD}._child_after_fork", side_effect=SystemExit) as child,
+        ):
+            with pytest.raises(SystemExit):
+                _try_fork_child(f, 0)
+        child.assert_called_once_with(0, f.heartbeats, f.loaded)
+
 
 class TestChildAfterFork:
     def test_resets_signals_and_exits_zero_on_clean_run(self):
         with (
             patch(f"{_MOD}.signal.signal") as sig,
-            patch(f"{_MOD}._run_child"),
+            patch(f"{_MOD}._run_child") as run,
             patch(f"{_MOD}.os._exit", side_effect=SystemExit) as exit_,
         ):
-            queue = MagicMock()
+            heartbeats, loaded = MagicMock(), MagicMock()
             with pytest.raises(SystemExit):
-                _child_after_fork(0, queue)
+                _child_after_fork(0, heartbeats, loaded)
         # SIGTERM + SIGINT reset to default before running.
         assert sig.call_count == 2
+        run.assert_called_once_with(0, heartbeats, loaded)
         exit_.assert_called_once_with(0)
 
     def test_hard_exits_one_when_run_raises(self):
@@ -279,12 +321,51 @@ def test_hard_exits_one_when_run_raises(self):
             patch(f"{_MOD}._run_child", side_effect=RuntimeError("boom")),
             patch(f"{_MOD}.os._exit", side_effect=SystemExit) as exit_,
         ):
-            queue = MagicMock()
             with pytest.raises(SystemExit):
-                _child_after_fork(0, queue)
+                _child_after_fork(0, MagicMock(), MagicMock())
         exit_.assert_called_once_with(1)
 
 
+class TestRunChildLoaded:
+    """The child marks itself loaded only after the bootstrap, and before it
+    starts polling (UN-4136).
+    """
+
+    @staticmethod
+    def _run_slot_1(fleet: _Fleet, build) -> None:  # noqa: ANN001
+        # No real `import worker` bootstrap and no real heartbeat thread.
+        with (
+            patch.dict("sys.modules", {"worker": MagicMock()}),
+            patch("pg_queue_consumer._bootstrap.select_so
```

---

### Incident Patch 6: `c19081c6` (2026-09-25)
**Commit Message**: [FIX] Pull MinIO from unstract/* Chainguard mirrors now that quay.io requires auth (#2300)

quay.io/minio/minio and quay.io/minio/mc started returning 'unauthorized',
breaking the integration (testcontainers) and e2e (compose) CI tiers.
Mirror cgr.dev/chainguard/minio and minio-client:latest-dev to Docker Hub
under unstract/* and pin by digest. Run minio as root so existing
root-owned minio_data volumes stay writable under Chainguard's uid 65532.

**File**: `docker/docker-compose-dev-essentials.yaml` (modified, +7/-4)
```diff
@@ -29,9 +29,11 @@ services:
       - traefik.enable=false
 
   minio:
-    # Docker Hub minio/* images were removed upstream; quay.io is MinIO's own registry
-    # but frozen (RELEASE.2025-09-07) - pinned by digest so a tag deletion can't break us
-    image: "quay.io/minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e"
+    # Mirror of cgr.dev/chainguard/minio (upstream minio/* images are gone from Docker Hub
+    # and quay.io now requires auth) - pinned by digest so a tag change can't break us
+    image: "unstract/minio:RELEASE.2026-09-22T19-25-18Z@sha256:bd014394a80898e68c149f2311fdf8d5a2c2f3bb2c33b9327ae6d02b4b065ae1"
+    # Chainguard runs as uid 65532; keep root so existing root-owned minio_data volumes stay writable
+    user: root
     container_name: unstract-minio
     hostname: minio
     restart: unless-stopped
@@ -49,7 +51,8 @@ services:
       - traefik.http.services.minio.loadbalancer.server.port=9001
 
   minio-bootstrap:
-    image: "quay.io/minio/mc@sha256:a7fe349ef4bd8521fb8497f55c6042871b2ae640607cf99d9bede5e9bdf11727"
+    # Mirror of cgr.dev/chainguard/minio-client:latest-dev (-dev variant ships /bin/sh for the entrypoint)
+    image: "unstract/minio-client:2026-09-24-dev@sha256:f0dd93b48af1f8a641edcd3c64661c8dbe05189bd2ef2f8cea216eb18af10bf8"
     depends_on:
       - minio
     entrypoint: >
```

**File**: `tests/rig/runtime.py` (modified, +1/-1)
```diff
@@ -341,7 +341,7 @@ def up(self) -> PlatformEndpoints:
             rabbit = RabbitMqContainer("rabbitmq:3.13-management").start()
             self._stack.append(rabbit)
             minio = MinioContainer(
-                "quay.io/minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e"
+                "unstract/minio:RELEASE.2026-09-22T19-25-18Z@sha256:bd014394a80898e68c149f2311fdf8d5a2c2f3bb2c33b9327ae6d02b4b065ae1"
             ).start()
             self._stack.append(minio)
 
```

---

### Incident Patch 7: `79a96b9c` (2026-09-24)
**Commit Message**: UN-4136 [FIX] Stop the file_processing worker booting the executor stack on each child's first task (#2293)

* fix: stop the file_processing worker booting the executor stack

Each pg_queue_consumer child paid ~9s of lazy initialisation on its first
task. The supervisor preforks 20 children per pod, so that is ~170
CPU-seconds per pod spent during serving rather than at startup, which
spikes fleet CPU at load onset and inflates CAST AI's WOOP p99 to 792m
against a 200m request -- putting the HPA signal's ceiling below its own
target so the fleet collapses to minReplicas under backlog.

structure_tool_task.py imports two string constants and a StreamMixin shim
from the executor package. None needs the executor registry, but every
import under `executor` booted the whole thing: executor/__init__.py
imported .worker, which imported executor.executors, which imported
LegacyExecutor and ran entry-point discovery. Measured at 9.98s cold.

Resolve celery_app lazily (PEP 562) and replace the executors package's
import-side-effect registration with an explicit, idempotent register_all().
The two entrypoints that need a populated registry -- executor/worker.py and
executor/tasks.py -- call i

**File**: `workers/executor/__init__.py` (modified, +24/-1)
```diff
@@ -3,10 +3,33 @@
 Celery worker for running extraction executors.
 Dispatches ExecutionContext to registered executors and returns
 ExecutionResult via the Celery result backend.
+
+``celery_app`` resolves lazily (PEP 562). Importing it eagerly made *every*
+consumer of this package pay the executor worker's full bootstrap: ``.worker``
+built the Celery app, and registration then imported ``LegacyExecutor`` and the
+adapter stack behind it. That was ~9s of work the file_processing worker never
+needed — it imports ``ExecutorToolShim`` and some string constants from this
+package and dispatches everything else over the PG queue (UN-4136). Attribute
+access is unchanged, so ``from executor import celery_app`` still works for
+callers that genuinely want the app.
 """
 
-from .worker import app as celery_app
+from typing import TYPE_CHECKING
+
+if TYPE_CHECKING:
+    from celery import Celery
+
+    celery_app: Celery
 
 __all__ = [
     "celery_app",
 ]
+
+
+def __getattr__(name: str) -> object:
+    """Resolve ``celery_app`` on first access instead of at import time."""
+    if name == "celery_app":
+        from .worker import app
+
+        return app
+    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
```

**File**: `workers/executor/executors/__init__.py` (modified, +127/-10)
```diff
@@ -1,16 +1,133 @@
 """Executor implementations package.
 
-Importing this module triggers ``@ExecutorRegistry.register`` for all
-bundled executors and discovers cloud executors via entry points.
+Registration is **explicit**: call :func:`register_all`. It used to run as a
+side effect of importing this package, which meant that importing *any*
+submodule — including ``executor.executors.constants``, which itself imports
+nothing but ``enum`` — dragged in ``LegacyExecutor`` and the entire adapter
+stack behind it. That cost ~9s, and the file_processing worker paid it once per
+forked child just to read a few string constants (UN-4136).
+
+``executor/tasks.py`` is the only *production* caller: ``workers/worker.py``
+exec-loads that file by path for both the Celery and PG executor roles.
+``executor/worker.py`` reaches it transitively, by importing ``executor.tasks``
+— that import binds the task definitions to its app and populates the registry,
+so it is load-bearing despite its ``noqa: F401``. The app it builds is not on
+any deployed path; today only the tests use it. The test suite calls
+:func:`register_all` directly.
 """
 
-from executor.executors.legacy_executor import LegacyExecutor
-from executor.executors.plugins.loader import ExecutorPluginLoader
+from typing import TYPE_CHECKING
+
+if TYPE_CHECKING:
+    from executor.executors.legacy_executor import LegacyExecutor  # noqa: TCH004
+
+#: Cloud entry point names; None when discovery has not run, or ran and
+#: raised. Doubles as the re-entrancy latch — see :func:`register_all`.
+_cloud_executors: list[str] | None = None
+
+
+def register_all() -> list[str]:
+    """Import the executor modules once per process, registering each of them.
+
+    ``LegacyExecutor`` and every cloud executor carry
+    ``@ExecutorRegistry.register``, which fires when their module is first
+    imported. That is the whole mechanism, and it bounds the guarantee: this
+    populates ``ExecutorRegistry`` **in a fresh process**, and cannot repopulate
+    it if something empties it afterwards, because the second import is a
+    ``sys.modules`` hit and the decorator does not run again. Production never
+    clears the registry. Several test modules do, and most of them do not put it
+    back; ``tests/test_legacy_executor_scaffold.py`` restores what it cleared.
+    A module that re-registers must not call ``ExecutorRegistry.register`` while
+    the name is already present — either clear immediately before, or guard on
+    ``"legacy" not in ExecutorRegistry.list_executors()``. That rule is hand-copied
+    across the test modules in several spellings; folding it into a shared test
+    helper is deliberately left out of this change.
+
+    Idempotent, and safe to re-enter: a cloud plugin whose own import graph
+    reaches this function during ``ep.load()`` will not restart discovery.
+
+    Returns:
+        The cloud executor entry point names, as a fresh copy each time so a
+        caller cannot mutate the latched state.
+
+        The list can under-report the registry at any length, including zero.
+        An empty one does not distinguish its causes: no cloud plugins are
+        installed (the OSS case); every one of them failed to import, because
+        ``ExecutorPluginLoader.discover_executors`` catches per-entry-point
+        failures and only logs a warning, so a broken plugin wheel boots clean
+        (a follow-up to make that aggregate loud is recorded on UN-4136); the
+        caller is *inside* discovery, having re-entered while the latch is still
+        the empty placeholder; or a failed discovery was re-run and the plugin
+        that raised is live in ``ExecutorRegistry`` but absent here — see the
+        handler below.
+    """
+    global _cloud_executors
+
+    from executor.executors.legacy_executor import LegacyExecutor  # noqa: F401
+
+    if _cloud_executors is None:
+        from executor.executors.plugins.loader import ExecutorPluginLoader
+
+        # La
```

**File**: `workers/executor/executors/plugins/loader.py` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 - ``unstract.executor.executors``
     Executor classes that self-register via ``@ExecutorRegistry.register``.
-    Loaded eagerly at worker startup from ``executors/__init__.py``.
+    Loaded when ``executor.executors.register_all()`` runs at worker startup.
 """
 
 import logging
```

**File**: `workers/executor/tasks.py` (modified, +25/-10)
```diff
@@ -5,16 +5,9 @@
 ExecutionOrchestrator, and returns an ExecutionResult dict.
 """
 
-# Import the executor implementations so their ``@ExecutorRegistry.register``
-# decorators run before ``execute_extraction`` can be invoked. Coupling this to
-# the task module (not only the Celery ``executor/worker.py`` entrypoint) ensures
-# the registry is populated wherever the task is registered — in particular the PG
-# executor consumer, which bootstraps via the root-worker import that loads
-# ``executor/tasks.py`` (this module) but NOT ``executor/worker.py`` where this
-# import historically lived; without it the consumer hits "No executor
-# registered". Import is idempotent (module cached), so the Celery entrypoint
-# importing it again is harmless.
-import executor.executors  # noqa: E402, F401
+import logging
+
+from executor.executors import register_all
 from queue_backend import worker_task
 from shared.clients import UsageAPIClient
 from shared.enums.task_enums import TaskName
@@ -25,8 +18,30 @@
 from unstract.sdk1.execution.orchestrator import ExecutionOrchestrator
 from unstract.sdk1.execution.result import ExecutionResult
 
+# Suppress Celery trace logging of task return values.
+# The trace logger prints the full result dict on task success, which can
+# contain sensitive customer data (extracted text, summaries, etc.).
+#
+# This lives here, not in ``executor/worker.py``, because that module is not on
+# any deployed path: ``workers/worker.py`` exec-loads THIS file by path for both
+# the Celery and PG executor roles, and no launcher runs ``celery -A executor``.
+# It used to be reached only because ``executor/__init__.py`` eagerly imported
+# ``.worker``; making that lazy (UN-4136) would otherwise have silently
+# re-enabled result logging on every extraction.
+logging.getLogger("celery.app.trace").setLevel(logging.WARNING)
+
 logger = WorkerLogger.get_logger(__name__)
 
+# Populate ``ExecutorRegistry`` so the executor implementations are registered
+# before ``execute_extraction`` can be invoked. Coupling this to the task module
+# (not only the Celery ``executor/worker.py`` entrypoint) ensures the registry is
+# populated wherever the task is registered — in particular the PG executor
+# consumer, which bootstraps via the root-worker import that loads
+# ``executor/tasks.py`` (this module) but NOT ``executor/worker.py``; without it
+# the consumer hits "No executor registered". This is the only call site;
+# ``executor/worker.py`` reaches it by importing this module.
+register_all()
+
 _LLM_BEARING_OPS = frozenset(
     {
         "answer_prompt",
```

**File**: `workers/executor/worker.py` (modified, +4/-9)
```diff
@@ -4,7 +4,6 @@
 Routes execute_extraction tasks to registered executors.
 """
 
-import logging
 import os
 
 from queue_backend import worker_task
@@ -17,11 +16,6 @@
 logger = WorkerLogger.setup(WorkerType.EXECUTOR)
 app, config = WorkerBuilder.build_celery_app(WorkerType.EXECUTOR)
 
-# Suppress Celery trace logging of task return values.
-# The trace logger prints the full result dict on task success, which
-# can contain sensitive customer data (extracted text, summaries, etc.).
-logging.getLogger("celery.app.trace").setLevel(logging.WARNING)
-
 
 def check_executor_health():
     """Custom health check for executor worker."""
@@ -79,7 +73,8 @@ def healthcheck(self):
     }
 
 
-# Import tasks so shared_task definitions bind to this app.
-# Import executors to trigger @ExecutorRegistry.register at import time.
-import executor.executors  # noqa: E402, F401
+# Import tasks so shared_task definitions bind to this app. This also populates
+# ExecutorRegistry: executor/tasks.py calls register_all() at module scope, and
+# it is the site that does the work on every deployed path — workers/worker.py
+# exec-loads that file by path, and nothing launches `celery -A executor`.
 import executor.tasks  # noqa: E402, F401
```

---

### Incident Patch 8: `89a44344` (2026-09-24)
**Commit Message**: UN-3487 [FIX] Restrict the S3/MinIO connector to one bucket (#2295)

* UN-3487 [FIX] Require and enforce a bucket on the S3/MinIO connector

The S3/MinIO connector had no bucket field, so its reach was bounded only
by whatever the underlying credential (often a shared IAM role) could see
account-wide. Any connector could browse into any bucket that role had
access to, including other teams' data.

- `bucket` is now a required field on the connector schema, matching
  Azure's existing (but unenforced) precedent — this one is actually
  enforced.
- `MinioFS.get_fsspec_fs()` wraps the filesystem in fsspec's own
  `DirFileSystem` when a bucket is set, confining every list/read/write
  (and `test_credentials`) to that one bucket regardless of what the
  credential could otherwise reach. UCS opts out via `_REQUIRES_BUCKET`,
  since it restricts access through its own `path` setting instead.
- Fixed a related IDOR in `file_management`: `list`/`download`/`upload`
  resolved a connector by a bare `ConnectorInstance.objects.get(pk=id)`
  with no ownership/group check, org-scoped only. Any org member holding
  a connector's id could browse/read/write through it regardless of
  sharing. Now sc

**File**: `backend/connector_v2/tests/test_connector_register.py` (modified, +17/-0)
```diff
@@ -24,6 +24,7 @@
 from connector_v2.models import ConnectorInstance
 
 MINIO_CONNECTOR_ID = "minio|c799f6e3-2b57-434e-aaac-b5daa415da19"
+_BUCKET = "connector-register-test"
 
 pytestmark = pytest.mark.skipif(
     not all(
@@ -45,12 +46,28 @@ def _credentials(secret: str | None = None) -> dict:
         "secret": secret or os.environ["MINIO_SECRET_ACCESS_KEY"],
         "endpoint_url": os.environ["MINIO_ENDPOINT_URL"],
         "region_name": "",
+        "bucket": _BUCKET,
         "path": "/",
     }
 
 
+def _ensure_bucket_exists() -> None:
+    # UN-3487: MinioFS now requires a bucket, and `test_credentials` probes
+    # it directly — it must actually exist in the rig's MinIO.
+    from s3fs.core import S3FileSystem
+
+    fs = S3FileSystem(
+        key=os.environ["MINIO_ACCESS_KEY_ID"],
+        secret=os.environ["MINIO_SECRET_ACCESS_KEY"],
+        client_kwargs={"endpoint_url": os.environ["MINIO_ENDPOINT_URL"]},
+    )
+    if not fs.exists(_BUCKET):
+        fs.mkdir(_BUCKET)
+
+
 class ConnectorRegisterTest(TestCase):
     def setUp(self) -> None:
+        _ensure_bucket_exists()
         self.org = Organization.objects.create(
             name="org-conn", display_name="Org Conn", organization_id="org-conn"
         )
```

**File**: `backend/file_management/file_management_helper.py` (modified, +25/-14)
```diff
@@ -11,6 +11,7 @@
 from django.conf import settings
 from django.http import StreamingHttpResponse
 from fsspec import AbstractFileSystem
+from fsspec.implementations.dirfs import DirFileSystem
 from pydrive2.files import ApiRequestError
 
 from file_management.exceptions import (
@@ -31,6 +32,27 @@
 logger = logging.getLogger(__name__)
 
 
+def _default_root_path(
+    file_system: UnstractFileSystem, fs: AbstractFileSystem, path: str
+) -> str | None:
+    """Some connectors restrict browsing to their own default root (e.g. a
+    configured `path`) when the caller didn't ask for a specific one.
+
+    `DirFileSystem.path` (used by a bucket-scoped MinioFS) is excluded: it's
+    the wrapped bucket prefix, not a default root, and every operation
+    already resolves relative to it — applying it again here would
+    double-prefix the path (UN-3487).
+    """
+    if not path or path == "/":
+        try:
+            if file_system.path:
+                return file_system.path
+        except AttributeError:
+            if hasattr(fs, "path") and fs.path and not isinstance(fs, DirFileSystem):
+                return fs.path
+    return None
+
+
 class FileManagerHelper:
     @staticmethod
     def get_file_system(connector: ConnectorInstance) -> UnstractFileSystem:
@@ -47,14 +69,8 @@ def get_file_system(connector: ConnectorInstance) -> UnstractFileSystem:
     @staticmethod
     def list_files(file_system: UnstractFileSystem, path: str) -> list[FileInformation]:
         fs = file_system.get_fsspec_fs()
-        file_path = f"{path}"
-        # TODO: Add below logic by checking each connector?
         try:
-            if file_system.path and (not path or path == "/"):
-                file_path = file_system.path
-        except AttributeError:
-            if hasattr(fs, "path") and fs.path and (not path or path == "/"):
-                file_path = fs.path
+            file_path = _default_root_path(file_system, fs, path) or path
         except Exception:
             logger.error(f"Missing path Atribute in {fs}")
             raise MissingConnectorParams()
@@ -135,13 +151,8 @@ def upload_file(
     ) -> None:
         fs = file_system.get_fsspec_fs()
 
-        file_path = f"{path}"
-        try:
-            if file_system.path and (not path or path == "/"):
-                file_path = f"{file_system.path}/"
-        except AttributeError:
-            if fs.path and (not path or path == "/"):
-                file_path = f"{fs.path}/"
+        root = _default_root_path(file_system, fs, path)
+        file_path = f"{root}/" if root else path
 
         file_path = file_path + "/" if not file_path.endswith("/") else file_path
 
```

**File**: `backend/file_management/tests.py` (modified, +101/-1)
```diff
@@ -1 +1,101 @@
-# Create your tests here.
+"""UN-3487: `file/`, `file/download` and `file/upload` are scoped to the
+caller, not just the org.
+
+Before this fix, `FileManagementViewSet` resolved a connector by a raw
+`ConnectorInstance.objects.get(pk=id)` — any authenticated org member who
+knew (or guessed) another user's connector id could browse, download from,
+or upload to it, sharing settings aside. These drive the real views through
+DRF's request factory, so a gate that exists only in the queryset — and
+never reaches the route — is still caught.
+"""
+
+import unittest
+from unittest.mock import mock_open, patch
+
+from connector_v2.models import ConnectorInstance
+from django.test import TestCase
+from permissions.roles import ResourceRole
+from permissions.tests.base import CoOwnerOrgTestMixin
+from rest_framework import status
+from rest_framework.response import Response
+from rest_framework.test import APIRequestFactory, force_authenticate
+
+from file_management.file_management_helper import FileManagerHelper
+from file_management.views import FileManagementViewSet
+from unstract.connectors.filesystems.minio.minio import MinioFS
+
+
+class FileManagementAccessScopeTest(CoOwnerOrgTestMixin, TestCase):
+    def setUp(self) -> None:
+        self._seed_org()
+        self.connector = ConnectorInstance.objects.create(
+            connector_name="team-a-s3",
+            connector_id="minio|c799f6e3-2b57-434e-aaac-b5daa415da19",
+            connector_metadata={"bucket": "team-a-data"},
+            organization=self.org,
+            created_by=self.owner,
+        )
+        # `created_by` is audit-only — access runs through the membership
+        # table, same as every other shareable resource in this codebase.
+        self.connector.memberships.create(user=self.owner, role=ResourceRole.OWNER)
+        self.connector.memberships.create(user=self.viewer, role=ResourceRole.VIEWER)
+        self.factory = APIRequestFactory()
+
+    def _list(self, actor) -> Response:
+        view = FileManagementViewSet.as_view({"get": "list"})
+        request = self.factory.get(
+            "/file", {"connector_id": str(self.connector.pk), "path": "/"}
+        )
+        force_authenticate(request, user=actor)
+        with (
+            patch(
+                "file_management.views.FileManagerHelper.get_file_system",
+                return_value=None,
+            ),
+            patch("file_management.views.FileManagerHelper.list_files", return_value=[]),
+        ):
+            return view(request)
+
+    def test_owner_can_list_their_own_connector(self) -> None:
+        self.assertEqual(self._list(self.owner).status_code, status.HTTP_200_OK)
+
+    def test_org_admin_can_list_any_connector(self) -> None:
+        self.assertEqual(self._list(self.admin).status_code, status.HTTP_200_OK)
+
+    def test_shared_viewer_can_list_the_connector(self) -> None:
+        self.assertEqual(self._list(self.viewer).status_code, status.HTTP_200_OK)
+
+    def test_outsider_org_member_cannot_list_an_unshared_connector(self) -> None:
+        # In scope (org member), but the connector was never shared with them.
+        self.assertEqual(self._list(self.outsider).status_code, status.HTTP_404_NOT_FOUND)
+
+    def test_non_org_member_cannot_list_the_connector(self) -> None:
+        self.assertEqual(self._list(self.stranger).status_code, status.HTTP_404_NOT_FOUND)
+
+
+class BucketScopedRootPathTest(unittest.TestCase):
+    """Regression for a Greptile finding on this PR: a bucket-scoped
+    connector's own `DirFileSystem.path` is its wrapped bucket prefix, not a
+    connector-level default root. Treating it as one double-prefixes every
+    root-level operation (`<bucket>/<bucket>/...`) instead of resolving
+    within the bucket.
+    """
+
+    def _minio_fs(self) -> MinioFS:
+        return MinioFS({"bucket": "team-a-data", "key": "k", "secret": "s"})
+
+    def test_list_files_at_root_is_not_double_prefixed(self) -> None:
+   
```

**File**: `backend/file_management/views.py` (modified, +20/-7)
```diff
@@ -2,6 +2,7 @@
 from typing import Any
 
 from connector_v2.models import ConnectorInstance
+from django.db.models import QuerySet
 from django.http import HttpRequest
 from oauth2client.client import HttpAccessTokenRefreshError
 from rest_framework import serializers, viewsets
@@ -30,8 +31,22 @@ class FileManagementViewSet(viewsets.ModelViewSet):
 
     versioning_class = URLPathVersioning
 
-    def get_queryset(self):
-        return ConnectorInstance.objects.all()
+    def get_queryset(self) -> QuerySet[ConnectorInstance]:
+        # Org-scoped alone isn't enough: this must also respect ownership /
+        # sharing, or any org member could browse another user's connector
+        # by guessing its id.
+        return ConnectorInstance.objects.for_user(self.request.user)
+
+    def _get_connector_or_404(self, id: str) -> ConnectorInstance:
+        """Resolve a connector within the caller's own access scope.
+
+        Raises the same not-found error whether the id is unknown or simply
+        outside `get_queryset()` — the caller can't tell those apart.
+        """
+        try:
+            return self.get_queryset().get(pk=id)
+        except ConnectorInstance.DoesNotExist:
+            raise ConnectorInstanceNotFound()
 
     def get_serializer_class(self) -> serializers.Serializer:
         if self.action == "upload":
@@ -50,13 +65,11 @@ def list(self, request: HttpRequest) -> Response:
         id: str = serializer.validated_data.get("connector_id")
         path: str = serializer.validated_data.get("path")
         try:
-            connector_instance: ConnectorInstance = ConnectorInstance.objects.get(pk=id)
+            connector_instance = self._get_connector_or_404(id)
             file_system = FileManagerHelper.get_file_system(connector_instance)
             files = FileManagerHelper.list_files(file_system, path)
             serializer = FileInfoSerializer(files, many=True)
             return Response(serializer.data)
-        except ConnectorInstance.DoesNotExist:
-            raise ConnectorInstanceNotFound()
         except HttpAccessTokenRefreshError as error:
             logger.error(
                 f"HttpAccessTokenRefreshError thrown from file list, error {error}"
@@ -72,7 +85,7 @@ def download(self, request: HttpRequest) -> Response:
         serializer.is_valid(raise_exception=True)
         id: str = serializer.validated_data.get("connector_id")
         path: str = serializer.validated_data.get("path")
-        connector_instance: ConnectorInstance = ConnectorInstance.objects.get(pk=id)
+        connector_instance = self._get_connector_or_404(id)
         file_system = FileManagerHelper.get_file_system(connector_instance)
         return FileManagerHelper.download_file(file_system, path)
 
@@ -84,7 +97,7 @@ def upload(self, request: HttpRequest) -> Response:
 
         path: str = serializer.validated_data.get("path")
         uploaded_files: Any = serializer.validated_data.get("file")
-        connector_instance: ConnectorInstance = ConnectorInstance.objects.get(pk=id)
+        connector_instance = self._get_connector_or_404(id)
         file_system = FileManagerHelper.get_file_system(connector_instance)
 
         for uploaded_file in uploaded_files:
```

**File**: `frontend/src/components/helpers/custom-markdown/CustomMarkdown.jsx` (modified, +9/-1)
```diff
@@ -37,7 +37,15 @@ const CustomMarkdown = ({
       case "tripleCode":
         return (
           <Paragraph style={{ margin: 0 }}>
-            <pre style={{ margin: 0 }}>{content}</pre>
+            <pre
+              style={{
+                margin: 0,
+                whiteSpace: "pre-wrap",
+                overflowWrap: "anywhere",
+              }}
+            >
+              {content}
+            </pre>
           </Paragraph>
         );
       case "inlineCode":
```

---

### Incident Patch 9: `05e00a5c` (2026-09-24)
**Commit Message**: [FIX] Stop tox 4.64's .venv redirect from breaking every CI run (#2297)

* [FIX] Stop tox 4.64's .venv redirect from breaking every CI run

CI went red on every branch at once on 2026-09-24, with no commit to blame:
a branch that passed on 09-23 failed on 09-24 with byte-identical errors.

`uv tool install tox --with tox-uv` is unpinned and resolves at job time, so
tox 4.63.0 -> 4.64.1 landed in CI on its release day. tox 4.64.0 ships a PEP
832 `.venv` redirect: after each run it writes a *file* named `.venv` at the
project root, holding the path of a tox env, so editors can find an
interpreter. It skips this when a real `.venv` directory already exists, which
is why no local checkout noticed and only CI, which starts clean, broke.

The repo root is also a uv workspace. uv reads `.venv` as the project
environment and refuses a file:

  error: Project virtual environment directory `.../.venv` cannot be used
  because expected directory but found a file

That is exactly the three root-workdir invocations: the unit-rig group, the
e2e-smoke group (whose failure then SKIPs the other seven e2e groups), and the
final `uv run --with coverage[toml] coverage combine`. Both tiers exit 2 and
r

**File**: `.github/workflows/ci-test.yaml` (modified, +21/-3)
```diff
@@ -94,7 +94,13 @@ jobs:
             ${{ runner.os }}-tox-uv-
 
       - name: Install tox with UV
-        run: uv tool install tox --with tox-uv
+        # Pinned: this resolves at job time, so a tox release lands in CI with no
+        # commit of ours. tox 4.64.0 shipped the PEP 832 `.venv` redirect and
+        # broke every branch at once; bump deliberately, not by drift.
+        # --no-build: wheels only, so no sdist setup script runs at install
+        # time. The whole tree (tox, tox-uv, uv, virtualenv, ...) ships wheels,
+        # so this constrains nothing and resolves identically.
+        run: uv tool install tox==4.64.1 --with tox-uv==1.36.0 --no-build
 
       - name: Validate test manifests
         # Cheap pre-flight: catches manifest schema errors before tier runs.
@@ -172,7 +178,13 @@ jobs:
             ${{ runner.os }}-tox-uv-
 
       - name: Install tox with UV
-        run: uv tool install tox --with tox-uv
+        # Pinned: this resolves at job time, so a tox release lands in CI with no
+        # commit of ours. tox 4.64.0 shipped the PEP 832 `.venv` redirect and
+        # broke every branch at once; bump deliberately, not by drift.
+        # --no-build: wheels only, so no sdist setup script runs at install
+        # time. The whole tree (tox, tox-uv, uv, virtualenv, ...) ships wheels,
+        # so this constrains nothing and resolves identically.
+        run: uv tool install tox==4.64.1 --with tox-uv==1.36.0 --no-build
 
       - name: Validate test manifests
         # Cheap pre-flight before the multi-minute image build.
@@ -267,7 +279,13 @@ jobs:
             ${{ runner.os }}-tox-uv-
 
       - name: Install tox with UV
-        run: uv tool install tox --with tox-uv
+        # Pinned: this resolves at job time, so a tox release lands in CI with no
+        # commit of ours. tox 4.64.0 shipped the PEP 832 `.venv` redirect and
+        # broke every branch at once; bump deliberately, not by drift.
+        # --no-build: wheels only, so no sdist setup script runs at install
+        # time. The whole tree (tox, tox-uv, uv, virtualenv, ...) ships wheels,
+        # so this constrains nothing and resolves identically.
+        run: uv tool install tox==4.64.1 --with tox-uv==1.36.0 --no-build
 
       - name: Restore main-branch test baseline (for regression detection)
         # One unified baseline across all tiers; this job is its sole
```

**File**: `tox.ini` (modified, +10/-0)
```diff
@@ -14,6 +14,16 @@
 env_list = unit, integration, e2e
 requires = tox-uv>=0.2.0
 isolated_build = True
+# tox >=4.64 writes a PEP 832 `.venv` redirect file at the repo root pointing at
+# a tox env, so editors can find an interpreter. That root is also a uv
+# workspace, and the rig runs `uv run` there (unit-rig, e2e-smoke, and the
+# coverage combine). uv reads `.venv` as the project environment and rejects a
+# file, so every root-workdir invocation dies with "expected directory but found
+# a file". Following the redirect would be worse than rejecting it: it aims at
+# .tox/<env> (~97 packages: pytest, testcontainers, coverage), not the ~269
+# package workspace env those groups need. Nothing here wants the redirect --
+# a local checkout already has a real .venv directory, which tox leaves alone.
+venv_redirect = false
 
 [testenv]
 # Shared base: install the rig itself + its python deps. Each tier env reuses
```

---

### Incident Patch 10: `0a2c3e31` (2026-09-21)
**Commit Message**: UN-4137 [FIX] Stream LLM completions under the hood so long generations complete instead of timing out (#2294)

* UN-4137 [FIX] Stream LLM completions under the hood so long generations complete instead of timing out and being replayed

A non-streaming completion keeps the socket silent until the last token.
On Anthropic, generations the console finishes in ~16 minutes never
arrived: litellm.Timeout after 900 s (staging) and after 1800 s
(production), then replayed up to 4x by the retry helper because Timeout
is retryable, until the Celery time limit killed the task.

- LLM.complete() streams (stream=True), collects the chunks and rebuilds
  the full response with litellm.stream_chunk_builder; callers unchanged.
- collect_with_retry: retry only before the first content chunk; a drop
  after content started is raised immediately so a long generation is
  never replayed, and chunks from a failed attempt are discarded.
- "Enable Streaming" checkbox on all LLM adapter forms, default on;
  adapters without a stored value stream too. Opt-out for endpoints that
  cannot stream. Read from raw adapter metadata, never sent to litellm.
- Anthropic Timeout description now reflects per-chunk se

**File**: `unstract/sdk1/src/unstract/sdk1/adapters/llm1/static/anthropic.json` (modified, +7/-1)
```diff
@@ -45,7 +45,13 @@
       "multipleOf": 1,
       "title": "Timeout",
       "default": 900,
-      "description": "Timeout in seconds"
+      "description": "Timeout in seconds. Replies are streamed, so this bounds the wait for the first token and any silence between chunks, not the length of the whole reply."
+    },
+    "enable_streaming": {
+      "type": "boolean",
+      "title": "Enable Streaming",
+      "default": true,
+      "description": "Stream the model's reply and assemble it in the platform. Keeps the connection alive on long replies so a provider read timeout is not hit. Turn it off only for an endpoint that cannot stream."
     },
     "enable_thinking": {
       "type": "boolean",
```

**File**: `unstract/sdk1/src/unstract/sdk1/adapters/llm1/static/anyscale.json` (modified, +6/-0)
```diff
@@ -49,6 +49,12 @@
       "title": "Max Retries",
       "default": 5,
       "description": "Maximum number of retries to attempt when a request fails."
+    },
+    "enable_streaming": {
+      "type": "boolean",
+      "title": "Enable Streaming",
+      "default": true,
+      "description": "Stream the model's reply and assemble it in the platform. Keeps the connection alive on long replies so a provider read timeout is not hit. Turn it off only for an endpoint that cannot stream."
     }
   }
 }
```

**File**: `unstract/sdk1/src/unstract/sdk1/adapters/llm1/static/azure.json` (modified, +6/-0)
```diff
@@ -69,6 +69,12 @@
       "default": 900,
       "description": "Timeout in seconds"
     },
+    "enable_streaming": {
+      "type": "boolean",
+      "title": "Enable Streaming",
+      "default": true,
+      "description": "Stream the model's reply and assemble it in the platform. Keeps the connection alive on long replies so a provider read timeout is not hit. Turn it off only for an endpoint that cannot stream."
+    },
     "enable_reasoning": {
       "type": "boolean",
       "title": "Enable Reasoning",
```

**File**: `unstract/sdk1/src/unstract/sdk1/adapters/llm1/static/azure_ai.json` (modified, +6/-0)
```diff
@@ -54,6 +54,12 @@
       "title": "Timeout",
       "default": 900,
       "description": "Request timeout in seconds."
+    },
+    "enable_streaming": {
+      "type": "boolean",
+      "title": "Enable Streaming",
+      "default": true,
+      "description": "Stream the model's reply and assemble it in the platform. Keeps the connection alive on long replies so a provider read timeout is not hit. Turn it off only for an endpoint that cannot stream."
     }
   }
 }
```

**File**: `unstract/sdk1/src/unstract/sdk1/adapters/llm1/static/bedrock.json` (modified, +6/-0)
```diff
@@ -111,6 +111,12 @@
       "title": "Timeout",
       "default": 900,
       "description": "Timeout in seconds"
+    },
+    "enable_streaming": {
+      "type": "boolean",
+      "title": "Enable Streaming",
+      "default": true,
+      "description": "Stream the model's reply and assemble it in the platform. Keeps the connection alive on long replies so a provider read timeout is not hit. Turn it off only for an endpoint that cannot stream."
     }
   },
   "dependencies": {
```

#### Recent Merged Pull Requests:
- **PR #2308** (2026-09-30): [MISC] Fix flaky integration CI: rig Postgres lock limit and unmocked pg_barrier dispatch (@johnyrahul)
- **PR #2305** (2026-09-29): UN-4185 [DEPS] Declare implicit frontend dependencies and remove unused ones (@jaseemjaskp)
- **PR #2304** (2026-09-29): UN-2646 [FIX] Skip the OSS-only vlm_utils contract in a merged cloud tree (@praveen-formido)
- **PR #2303** (2026-09-29): UN-4184 [MISC] Enable Biome recommended, a11y and hooks lint rules and remove dead eslint-disable comments (@jaseemjaskp)
- **PR #2302** (2026-09-29): UN-4183 [MISC] Run frontend typecheck and tests in CI and make the frontend test group required (@jaseemjaskp)
- **PR #2301** (2026-09-29): UN-4136 [FIX] Report PG worker pods ready only after every consumer child has loaded (@johnyrahul)
- **PR #2300** (2026-09-25): [FIX] Pull MinIO from unstract/* Chainguard mirrors now that quay.io requires auth (@jaseemjaskp)
- **PR #2299** (2026-09-30): UN-4123 [FIX] A credential-free REDIS_URL no longer connects anonymously (@muhammad-ali-e)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
