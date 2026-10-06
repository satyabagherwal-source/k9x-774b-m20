# Forensic Learning Record (Deep Inspection): feyninc/chonkie

> **Canonical Artifact**: `07_PROJECT_LEARNING/feyninc-chonkie-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/feyninc/chonkie](https://github.com/feyninc/chonkie))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:10:56.086Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `feyninc/chonkie`
- **Description**: 🦛 CHONK docs with Chonkie ✨ — The lightweight ingestion library for fast, efficient and robust RAG pipelines
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 4783 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/chonkie/api/utils.py`
```
"""Utility helpers for the Chonkie OSS API.

Provides a simple Timer for performance logging and re-exports the Chonkie
logger for consistent logging across the entire package.
"""

import time

from chonkie.logger import get_logger

__all__ = ["get_logger", "Timer", "fix_escaped_text", "sanitize_text_encoding"]


class Timer:
    """Lightweight wall-clock timer with named sub-timers.

    Usage::

        timer = Timer()
        timer.start()           # start the global timer

        timer.start("init")     # start a named timer
        ...
        ms = timer.end("init")  # stop and return elapsed ms

        total_ms = timer.end()  # stop global timer
    """

    def __init__(self) -> None:
        """Initialize Timer with empty start times."""
        self._starts: dict[str, float] = {}

    def start(self, name: str = "_global") -> None:
        """Start (or restart) a named timer.

        Args:
            name: Timer name.  Defaults to the global timer.

        """
        self._starts[name] = time.perf_counter()

    def end(self, name: str = "_global") -> float:
        """Stop a named timer and return elapsed milliseconds.

        Args:
            name: Timer name.  Defaults to the global timer.

        Returns:
            Elapsed time in milliseconds, or ``0.0`` if the timer was never
            started.

        """
        start = self._starts.pop(name, None)
        if start is None:
            return 0.0
        return (time.perf_counter() - start) * 1000.0

    def elapsed(self, name: str = "_global") -> float:
        """Return elapsed milliseconds without stopping the timer.

        Args:
            name: Timer name.

        Returns:
            Elapsed time in milliseconds, or ``0.0`` if not started.

        """
        start = self._starts.get(name)
        if start is None:
            return 0.0
        return (time.perf_counter() - start) * 1000.0


def fix_escaped_text(text: str | list[str]) -> str | list[str]:
    """Unescape common escape sequences that arrive double-escaped over JSON.

    Args:
        text: A string or list of strings to fix.

    Returns:
        The fixed string or list of strings.

    """
    if isinstance(text, list):
        return [_fix_single(t) for t in text]
    return _fix_single(text)


def _fix_single(text: str) -> str:
    replacements = [
        ("\\n", "\n"),
        ("\\t", "\t"),
        ("\\r", "\r"),
    ]
    for escaped, real in replacements:
        if escaped in text:
            text = text.replace(escaped, real)
    return text


def sanitize_text_encoding(text: str) -> str:
    """Replace invalid UTF-8 byte sequences with the replacement character.

    Args:
        text: Input string.

    Returns:
        Sanitized string safe for processing.

    """
    return text.encode("utf-8", errors="replace").decode("utf-8", errors="replace")

```

### Core Architecture Module: `src/chonkie/cli/cli_utils.py`
```
"""CLI utilities for Chonkie using Typer."""

import os
from typing import Any, Optional

import typer

from chonkie import Pipeline, Visualizer
from chonkie.pipeline import ComponentRegistry, ComponentType
from chonkie.types.document import Document

# from chonkie.utils import login as login_function

# @app.command()
# def login(
#     api_key: str = typer.Option(
#         ...,
#         prompt=True,
#         hide_input=True,
#         help="Your API key for authentication",
#     ),
# ) -> None:
#     """Login to Chonkie CLI with your API key."""
#     login_function(api_key)


app = typer.Typer(
    name="chonkie",
    help=">🦛 CHONK your texts with Chonkie",
    add_completion=True,
)

CHUNKERS = sorted(
    c.alias for c in ComponentRegistry.list_components(component_type=ComponentType.CHUNKER)
)
HANDSHAKES = sorted(
    c.alias for c in ComponentRegistry.list_components(component_type=ComponentType.HANDSHAKE)
)


def parse_params(param_list: list[str] | None) -> dict[str, Any]:
    """Parse a list of key=value strings into a dictionary.

    Args:
        param_list: List of strings in format "key=value" or just "key" (for boolean flags)

    Returns:
        Dictionary of parsed parameters with type conversion

    Examples:
        >>> parse_params(["chunk_size=512", "threshold=0.8", "verbose"])
        {'chunk_size': 512, 'threshold': 0.8, 'verbose': True}

    """
    if not param_list:
        return {}

    params: dict[str, Any] = {}
    for param in param_list:
        if "=" not in param:
            # Boolean flag (no =value)
            params[param.strip()] = True
            continue

        key, _, value = param.partition("=")
        key = key.strip()
        value = value.strip()

        # Try to convert to appropriate type
        lower_caps_value = value.lower()
        if lower_caps_value == "true":
            params[key] = True
        elif lower_caps_value == "false":
            params[key] = False
        elif lower_caps_value == "none" or lower_caps_value == "null":
            params[key] = None
        else:
            # Try float first, then convert to int if appropriate, or keep as string
            try:
                # Try float first (handles both floats and ints in scientific notation)
                float_val = float(value)
                # If it's a whole number and no decimal point in original, keep as int
                if "." not in value and "e" not in lower_caps_value and float_val.is_integer():
                    params[key] = int(float_val)
                else:
                    params[key] = float_val
            except ValueError:
                # Keep as string
                params[key] = value

    return params


def merge_params(explicit_params: dict[str, Any], parsed_params: dict[str, Any]) -> dict[str, Any]:
    """Merge explicit parameters with parsed parameters, with explicit taking precedence.

    Args:
        explicit_params: Parameters from explicit CLI options
        parsed_params: Parameters from parsed key=value strings

    Returns:
        Merged dictionary

    """
    return dict(
        parsed_params,
        **{key: value for key, value in explicit_params.items() if value is not None},
    )


@app.command()
def chunk(
    text: str = typer.Argument(..., help="Text to chunk or path to file"),
    chunker: str = typer.Option(
        "semantic",
        help=f"Chunking method to use. Options: {', '.join(CHUNKERS)}",
    ),
    chunk_size: Optional[int] = typer.Option(
        None,
        help="Maximum number of tokens per chunk",
    ),
    chunk_overlap: Optional[int] = typer.Option(
        None,
        help="Number of tokens to overlap between chunks",
    ),
    threshold: Optional[float] = typer.Option(
        None,
        help="Threshold for semantic similarity (0-1)",
    ),
    chunker_params: Optional[list[str]] = typer.Option(
        None,
        help="Additional parameters for the chunker as key=value pairs (e.g., --chunker-params tokenizer=gpt2 min_characters_per_chunk=50)",
    ),
    handshaker: Optional[str] = typer.Option(
        None,
        help=f"Where to store the chunks. Options: {', '.join(HANDSHAKES)}",
    ),
) -> None:
    """Chunk text using a specified chunker and optionally store it."""
    typer.echo(f"Chunking with {chunker}...")

    try:
        chunker_class = ComponentRegistry.get_chunker(chunker).component_class
    except ValueError:
        typer.echo(f"Error: Unknown chunker '{chunker}'. Available: {', '.join(CHUNKERS)}")
        raise typer.Exit(code=1) from None

    # Parse and merge parameters
    explicit_params = {
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
        "threshold": threshold,
    }
    parsed_params = parse_params(chunker_params)
    chunker_kwargs = merge_params(explicit_params, parsed_params)

    # Create chunker instance with parameters
    try:
        chunking_maker = chunker_class(**chunker_kwargs)
    except Exception as e:
        typer.echo(f"Error initializing chunker with parameters: {e}")
        raise typer.Exit(code=1) from None

    viz = Visualizer()
    # Get text content
    content = text
    if os.path.isfile(text):
        try:
            with open(text, "r", encoding="utf-8") as f:
                content = f.read()
        except Exception as e:
            typer.echo(f"Error reading file {text}: {e}")
            raise typer.Exit(code=1) from None

    # Chunk the text
    chunks = chunking_maker.chunk(content)

    # Handle output
    if handshaker is None:
        try:
            viz(chunks)
        except (UnicodeEncodeError, UnicodeDecodeError, BrokenPipeError) as e:
            # Fallback for Windows console encoding issues
            try:
                if chunks:
                    typer.echo(f"Chunked into {len(chunks)} chunks:")
                    for i, chunk in enumerate(chunks, 1):
                        chunk_text = (
                            getattr(chunk, "text", "")[:200] if hasattr(chunk, "text") else ""
                        )
                        token_count = (
                            getattr(chunk, "token_count", 0)
                            if hasattr(chunk, "token_count")
                            else 0
                        )
                        typer.echo(f"\n--- Chunk {i} ({token_count} tokens) ---")
                        # Truncate and escape problematic characters for display
                        preview = chunk_text.encode("ascii", errors="replace").decode("ascii")
                        typer.echo(preview + ("..." if len(chunk_text) > 200 else ""))
                else:
                    typer.echo("No chunks to display (encoding error occurred)")
            except Exception as fallback_error:
                # If fallback also fails, show minimal error info without masking original
                typer.echo(
                    f"Encoding error ({type(e).__name__}) occurred, and fallback display also failed ({type(fallback_error).__name__})"
                )
                typer.echo(f"Original error: {e}")
                typer.echo(f"Fallback error: {fallback_error}")
        except Exception as e:
            # Catch any other visualization errors and provide basic output
            try:
                if chunks:
                    typer.echo(
                        f"Chunked into {len(chunks)} chunks (visualization error: {type(e).__name__})"
                    )
                    for i, chunk in enumerate(chunks, 1):
                        chunk_text = (
                            getattr(chunk, "text", "")[:200] if hasattr(chunk, "text") else ""
                        )
                        token_count = (
                            getattr(chunk, "token_count", 0)
                            if hasattr(chunk, "token_count")
                            else 0
                        )
                        typer.echo(f"\n--- Chunk {i} ({token_count} tokens) ---")
                        preview = chunk_text.encode("ascii", errors="replace").decode("ascii")
                        typer.echo(preview + ("..." if len(chunk_text) > 200 else ""))
                else:
                    typer.echo(f"Visualization error ({type(e).__name__}): {e}")
            except Exception as fallback_error:
                # If fallback also fails, show minimal error info without masking original
                typer.echo(
                    f"Visualization error ({type(e).__name__}) occurred, and fallback display also failed ({type(fallback_error).__name__})"
                )
                typer.echo(f"Original error: {e}")
                typer.echo(f"Fallback error: {fallback_error}")
    else:
        try:
            handshake_class = ComponentRegistry.get_handshake(handshaker).component_class
        except ValueError:
            typer.echo(
                f"Error: Unknown handshaker '{handshaker}'. Available: {', '.join(HANDSHAKES)}"
            )
            raise typer.Exit(code=1) from None

        typer.echo(f"Storing chunks in {handshaker}...")
        try:
            handshake_instance = handshake_class()
            handshake_instance.write(chunks)
            typer.echo("Chunks stored successfully.")
        except Exception as e:
            typer.echo(f"Error storing chunks: {e}")
            raise typer.Exit(code=1) from None


@app.command()
def pipeline(
    text: Optional[str] = typer.Argument(None, help="Text to process or path to file"),
    fetcher: str = typer.Option(
        "file",
        help="Fetcher method to use (e.g., file)",
    ),
    d: Optional[str] = typer.Option(
        None,
        help="directory to process, if text is not a file",
    ),
    ext: Optional[list[str]] = typer.Option(
        None,
        help="file extensions to process, if d is specified, example ['.md', '.txt']",
    ),
    chef: Optional[str] = typer.Option(
        None,
        help="Chef method to u
```

### Core Architecture Module: `src/chonkie/handshakes/utils.py`
```
"""Utility functions for Chonkie's Handshakes."""

import random

ADJECTIVES = [
    "happy",
    "chonky",
    "splashy",
    "munchy",
    "muddy",
    "groovy",
    "bubbly",
    "swift",
    "lazy",
    "hungry",
    "glowing",
    "radiant",
    "mighty",
    "gentle",
    "whimsical",
    "snug",
    "plump",
    "jovial",
    "sleepy",
    "sunny",
    "peppy",
    "breezy",
    "sneaky",
    "clever",
    "peaceful",
    "dreamy",
]

VERBS = [
    "chomping",
    "splashing",
    "munching",
    "wading",
    "floating",
    "drifting",
    "chunking",
    "slicing",
    "dancing",
    "wandering",
    "sleeping",
    "dreaming",
    "gliding",
    "swimming",
    "bubbling",
    "giggling",
    "jumping",
    "diving",
    "hopping",
    "skipping",
    "trotting",
    "sneaking",
    "exploring",
    "nibbling",
    "resting",
]

NOUNS = [
    "hippo",
    "river",
    "chunk",
    "lilypad",
    "mudbath",
    "stream",
    "pod",
    "chomp",
    "byte",
    "fragment",
    "slice",
    "splash",
    "nugget",
    "lagoon",
    "marsh",
    "pebble",
    "ripple",
    "cluster",
    "patch",
    "parcel",
    "meadow",
    "glade",
    "puddle",
    "nook",
    "bite",
    "whisper",
    "journey",
    "haven",
    "buddy",
    "pal",
    "snack",
    "secret",
]


def generate_random_collection_name(sep: str = "-") -> str:
    """Generate a random, fun, 3-part Chonkie-themed name (Adj-Verb-Noun).

    Combines one random adjective, one random verb, and one random noun from
    predefined lists, joined by a separator.

    Args:
        sep: The separator to use between the words. Defaults to "-".

    Returns:
        A randomly generated collection name string (e.g., "happy-splashes-hippo").

    """
    adjective = random.choice(ADJECTIVES)
    verb = random.choice(VERBS)
    noun = random.choice(NOUNS)
    return f"{adjective}{sep}{verb}{sep}{noun}"

```

### Core Architecture Module: `src/chonkie/utils/__init__.py`
```
"""Module for utility functions."""

# from ._api import load_token, login
from .component import Component, ComponentType
from .hub import Hubbie
from .registry import (
    ComponentRegistry,
    _ComponentRegistry,
    chef,
    chunker,
    fetcher,
    handshake,
    pipeline_component,
    porter,
    refinery,
    vision,
)
from .table_converter import html_table_to_json, markdown_table_to_json
from .viz import Visualizer

__all__ = [
    "Component",
    "ComponentRegistry",
    "ComponentType",
    "Hubbie",
    "Visualizer",
    "_ComponentRegistry",
    "chef",
    "chunker",
    "fetcher",
    "handshake",
    "html_table_to_json",
    "markdown_table_to_json",
    "pipeline_component",
    "porter",
    "refinery",
    "vision",
    # "login",
    # "load_token",
]

```

### Core Architecture Module: `src/chonkie/utils/_api.py`
```
import json
import os
from typing import Union


def get_config_path() -> str:
    """Get the path to the configuration file."""
    home_dir = os.path.expanduser("~")
    config_dir = os.path.join(home_dir, ".chonkie")
    if not os.path.exists(config_dir):
        os.makedirs(config_dir)
    return os.path.join(config_dir, "config.json")


def login(api_key: str) -> None:
    """Set the API token in the configuration file."""
    config_path = get_config_path()
    config = {}
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            # Config file is empty, malformed, or was deleted after check.
            # It will be overwritten.
            pass
    config["api_key"] = api_key
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f)
        print(f"token saved successfully in {config_path}")


def load_token() -> Union[str, None]:
    """Load the API token from a given key or environment variable."""
    api_key = os.getenv("CHONKIE_API_KEY", None)
    if api_key is not None:
        return api_key
    else:
        # TODO: load token from colab secrets if colab [WIP]

        # load token from local config file
        config_path = get_config_path()
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
                api_key = config.get("api_key", None)
                if api_key:
                    return api_key
                else:
                    raise ValueError("API key not found in config file, consider logging in.")
        else:
            raise ValueError("config file not found, consider logging in.")

```

### Core Architecture Module: `src/chonkie/utils/component.py`
```
"""Component for pipeline."""

from dataclasses import dataclass
from enum import Enum
from typing import Any


class ComponentType(Enum):
    """Types of pipeline components.

    These represent the stages in the CHOMP pipeline:
    - FETCHER: Retrieves raw data from sources
    - VISION: Extracts text from visual documents (images, PDFs) via OCR
    - CHEF: Preprocesses and transforms data
    - CHUNKER: Splits text into chunks
    - REFINERY: Post-processes chunks (e.g., add embeddings, merge)
    - PORTER: Exports chunks to storage formats
    - HANDSHAKE: Ingests chunks into vector databases
    """

    FETCHER = "fetcher"
    VISION = "vision"
    CHEF = "chef"
    CHUNKER = "chunker"
    REFINERY = "refinery"
    PORTER = "porter"
    HANDSHAKE = "handshake"


@dataclass
class Component:
    """Minimal metadata about a pipeline component.

    This class stores the essential information needed to identify
    and instantiate components in a Chonkie pipeline.

    Attributes:
        name: Full class name (e.g., "RecursiveChunker")
        alias: Short alias for string-based configs (e.g., "recursive")
        component_class: The actual class to instantiate
        component_type: Which CHOMP stage this component belongs to

    """

    name: str
    alias: str
    component_class: type[Any]
    component_type: ComponentType

    def __post_init__(self) -> None:
        """Validate component after creation."""
        if not self.name:
            raise ValueError("Component name cannot be empty")
        if not self.alias:
            raise ValueError("Component alias cannot be empty")
        if not self.component_class:
            raise ValueError("Component class cannot be None")

```

### Core Architecture Module: `src/chonkie/utils/hub.py`
```
"""Module for managing access to the Chonkie hub."""

import json
import os
from functools import cache
from pathlib import Path
from typing import Optional


@cache
def _get_recipe_schema(version: str) -> dict:
    # This is memoized to avoid multiple downloads of the same schema;
    # we wouldn't expect a version to change during the runtime of a process.

    from huggingface_hub import hf_hub_download

    path = hf_hub_download(
        repo_id="chonkie-ai/recipes",
        repo_type="dataset",
        filename=f"{version}.schema.json",
    )
    return dict(json.loads(Path(path).read_bytes()))


class Hubbie:
    """Hubbie is a Huggingface hub manager for Chonkie.

    Methods:
        get_recipe(recipe_name: str, lang: Optional[str] = 'en') -> Optional[Dict]:
            Get a recipe from the hub.
        get_recipe_schema() -> Dict:
            Get the current recipe schema from the hub.

    """

    SCHEMA_VERSION = "v1"

    def __init__(self) -> None:
        """Initialize Hubbie."""
        # Lazy import the dependencies (huggingface_hub)

        # define the path to the recipes
        self.get_recipe_config = {
            "repo": "chonkie-ai/recipes",
            "subfolder": "recipes",
            "repo_type": "dataset",
        }

        # define the path to the pipeline recipes
        self.get_pipeline_recipe_config = {
            "repo": "chonkie-ai/recipes",
            "subfolder": "pipelines",
            "repo_type": "dataset",
        }

    @property
    def recipe_schema(self) -> dict:
        """The current recipe schema, from the hub."""
        return _get_recipe_schema(self.SCHEMA_VERSION).copy()

    def get_recipe_schema(self) -> dict:
        """Get the current recipe schema from the hub."""
        return self.recipe_schema

    def _validate_recipe(self, recipe: dict) -> Optional[bool]:
        """Validate a recipe against the current schema."""
        import jsonschema

        try:
            jsonschema.validate(recipe, self.recipe_schema)
            return True
        except jsonschema.ValidationError as error:
            raise ValueError(
                f"Recipe is invalid. Please check the recipe and try again. Error: {error}",
            ) from error

    def get_recipe(
        self,
        name: Optional[str] = "default",
        lang: Optional[str] = "en",
        path: str | os.PathLike | None = None,
    ) -> dict:
        """Get a recipe from the hub.

        Args:
            name (Optional[str]): The name of the recipe to get.
            lang (Optional[str]): The language of the recipe to get.
            path (Optional[str]): Optionally, provide the path to the recipe.

        Returns:
            Optional[Dict]: The recipe.

        Raises:
            ValueError: If the recipe is not found.
            ValueError: If neither (name, lang) nor path are provided.
            ValueError: If the recipe is invalid.

        """
        # Check if either (name & lang) or path is provided
        if (name is None or lang is None) and path is None:
            raise ValueError("Either (name & lang) or path must be provided.")

        from huggingface_hub import hf_hub_download

        # If path is not provided, download the recipe from the hub
        if path is None and (name is not None and lang is not None):
            try:
                path = hf_hub_download(
                    repo_id=self.get_recipe_config["repo"],
                    repo_type=self.get_recipe_config["repo_type"],
                    subfolder=self.get_recipe_config["subfolder"],
                    filename=f"{name}_{lang}.json",
                )
            except Exception as error:
                raise ValueError(
                    f"Could not download recipe '{name}_{lang}'. Ensure name and lang are correct or provide a valid path. Error: {error}",
                ) from error

        # If we couldn't get the path or download the recipe, raise error
        if path is None:
            raise ValueError(
                f"Could not determine path for recipe '{name}_{lang}'. Ensure name and lang are correct or provide a valid path.",
            )

        # using Pathlib to check if the file exists
        path_obj = Path(path)
        if not path_obj.exists():
            raise ValueError(
                f"Failed to get the file {path} —— please check if this file exists and if the path is correct.",
            )

        # Path exists, now open it and load the recipe
        try:
            with path_obj.open("r") as f:
                recipe = dict(json.loads(f.read()))
        except Exception as error:
            raise ValueError(
                f"Failed to read the file {path} —— please check if the file is valid JSON and if the path is correct. Error: {error}",
            ) from error

        # Validate the recipe with jsonschema
        assert self._validate_recipe(recipe), (
            "Recipe is invalid. Please check the recipe and try again."
        )

        # Return the recipe
        return recipe

    def get_pipeline_recipe(self, name: str, path: str | os.PathLike | None = None) -> dict:
        """Get a pipeline recipe from the hub.

        Args:
            name: The name of the pipeline recipe to get.
            path: Optionally, provide the path to the recipe file.

        Returns:
            Dict: The pipeline recipe with 'steps' key.

        Raises:
            ValueError: If the recipe is not found or invalid.

        """
        # If path is not provided, download the recipe from the hub
        if path is None:
            from huggingface_hub import hf_hub_download

            try:
                path = hf_hub_download(
                    repo_id=self.get_pipeline_recipe_config["repo"],
                    repo_type=self.get_pipeline_recipe_config["repo_type"],
                    subfolder=self.get_pipeline_recipe_config["subfolder"],
                    filename=f"{name}.json",
                )
            except Exception as error:
                raise ValueError(
                    f"Could not download pipeline recipe '{name}'. "
                    f"Ensure name is correct or provide a valid path. Error: {error}",
                ) from error

        # If we couldn't get the path, raise error
        if path is None:
            raise ValueError(
                f"Could not determine path for pipeline recipe '{name}'. "
                f"Ensure name is correct or provide a valid path.",
            )

        # Check if file exists
        path_obj = Path(path)
        if not path_obj.exists():
            raise ValueError(
                f"Failed to get the file {path} — please check if this file exists "
                f"and if the path is correct.",
            )

        # Load the recipe
        try:
            with path_obj.open("r") as f:
                recipe = dict(json.loads(f.read()))
        except Exception as error:
            raise ValueError(
                f"Failed to read the file {path} — please check if the file is valid JSON. "
                f"Error: {error}",
            ) from error

        # Validate it has required fields
        if "steps" not in recipe:
            raise ValueError(f"Pipeline recipe '{name}' is missing 'steps' field.")

        # Optionally validate schema version
        if "schema" in recipe and recipe["schema"] != self.SCHEMA_VERSION:
            raise ValueError(
                f"Pipeline recipe '{name}' has schema version '{recipe['schema']}', "
                f"but expected '{self.SCHEMA_VERSION}'.",
            )

        return recipe

```

### Core Architecture Module: `src/chonkie/utils/registry.py`
```
"""Component registry for pipeline components."""

from typing import Any, Callable, Optional, Type, TypeVar

from .component import Component, ComponentType

ComponentT = TypeVar("ComponentT", bound=Type[Any])


class _ComponentRegistry:
    """Internal component registry class."""

    def __init__(self) -> None:
        """Initialize the component registry."""
        self._components: dict[str, Component] = {}
        # Scoped aliases: (component_type, alias) -> name mapping
        self._aliases: dict[tuple[ComponentType, str], str] = {}
        self._component_types: dict[ComponentType, list[str]] = {ct: [] for ct in ComponentType}

    def register(
        self,
        name: str,
        alias: str,
        component_class: ComponentT,
        component_type: ComponentType,
    ) -> None:
        """Register a component in the registry.

        Args:
            name: Full name of the component (usually class name)
            alias: Short alias for the component (used in string pipelines)
            component_class: The actual component class
            component_type: Type of component (fetcher, chunker, etc.)

        Raises:
            ValueError: If component name/alias conflicts exist

        """
        # Check for name conflicts
        if name in self._components:
            existing = self._components[name]
            if existing.component_class is component_class:
                # Same class, same registration - this is fine (idempotent)
                return
            else:
                raise ValueError(
                    f"Component name '{name}' already registered with different class",
                )

        # Check for alias conflicts within the same component type
        alias_key = (component_type, alias)
        if alias_key in self._aliases:
            existing_name = self._aliases[alias_key]
            if existing_name != name:
                raise ValueError(
                    f"Alias '{alias}' already used by {component_type.value} component '{existing_name}'",
                )

        # Create component info
        info = Component(
            name=name,
            alias=alias,
            component_class=component_class,
            component_type=component_type,
        )

        # Register the component
        self._components[name] = info
        self._aliases[alias_key] = name
        self._component_types[component_type].append(name)

    def get_component(
        self,
        name_or_alias: str,
        component_type: Optional[ComponentType] = None,
    ) -> Component:
        """Get component info by name or alias.

        Args:
            name_or_alias: Component name or alias
            component_type: Optional component type to scope alias lookup

        Returns:
            Component for the requested component

        Raises:
            ValueError: If component is not found

        """
        # If component_type provided, try scoped alias lookup first
        if component_type:
            alias_key = (component_type, name_or_alias)
            if alias_key in self._aliases:
                name = self._aliases[alias_key]
                return self._components[name]

        # Try unscoped: check if it's a direct name match
        if name_or_alias in self._components:
            comp = self._components[name_or_alias]
            # If type specified, verify it matches
            if component_type and comp.component_type != component_type:
                raise ValueError(
                    f"Component '{name_or_alias}' is a {comp.component_type.value}, "
                    f"not a {component_type.value}",
                )
            return comp

        # Try to find by alias across all types (ambiguous lookup)
        matches = []
        for (ctype, alias), name in self._aliases.items():
            if alias == name_or_alias:
                matches.append((ctype, name))

        if len(matches) == 1:
            return self._components[matches[0][1]]
        elif len(matches) > 1:
            types = [m[0].value for m in matches]
            raise ValueError(
                f"Ambiguous alias '{name_or_alias}' found in multiple types: {types}. "
                f"Specify component_type to disambiguate.",
            )

        # Not found
        available = [f"{ct.value}:{alias}" for (ct, alias) in self._aliases.keys()]
        raise ValueError(
            f"Unknown component: '{name_or_alias}'. Available: {sorted(available)[:10]}...",
        )

    def list_components(self, component_type: Optional[ComponentType] = None) -> list[Component]:
        """List all registered components, optionally filtered by type.

        Args:
            component_type: Optional filter by component type

        Returns:
            List of Component objects

        """
        if component_type:
            names = self._component_types[component_type]
            return [self._components[name] for name in names]
        return list(self._components.values())

    def get_aliases(self, component_type: Optional[ComponentType] = None) -> list[str]:
        """Get all available aliases, optionally filtered by type.

        Args:
            component_type: Optional filter by component type

        Returns:
            List of component aliases

        """
        if component_type:
            return [alias for (ctype, alias) in self._aliases.keys() if ctype == component_type]
        return [alias for (_, alias) in self._aliases.keys()]

    def get_fetcher(self, alias: str) -> Component:
        """Get a fetcher component by alias.

        Args:
            alias: Fetcher alias

        Returns:
            Component info for the fetcher

        Raises:
            ValueError: If fetcher not found

        """
        return self.get_component(alias, ComponentType.FETCHER)

    def get_vision(self, alias: str) -> Component:
        """Get a vision component by alias.

        Args:
            alias: Vision component alias

        Returns:
            Component info for the vision component

        Raises:
            ValueError: If vision component not found

        """
        return self.get_component(alias, ComponentType.VISION)

    def get_chef(self, alias: str) -> Component:
        """Get a chef component by alias.

        Args:
            alias: Chef alias

        Returns:
            Component info for the chef

        Raises:
            ValueError: If chef not found

        """
        return self.get_component(alias, ComponentType.CHEF)

    def get_chunker(self, alias: str) -> Component:
        """Get a chunker component by alias.

        Args:
            alias: Chunker alias

        Returns:
            Component info for the chunker

        Raises:
            ValueError: If chunker not found

        """
        return self.get_component(alias, ComponentType.CHUNKER)

    def get_refinery(self, alias: str) -> Component:
        """Get a refinery component by alias.

        Args:
            alias: Refinery alias

        Returns:
            Component info for the refinery

        Raises:
            ValueError: If refinery not found

        """
        return self.get_component(alias, ComponentType.REFINERY)

    def get_porter(self, alias: str) -> Component:
        """Get a porter component by alias.

        Args:
            alias: Porter alias

        Returns:
            Component info for the porter

        Raises:
            ValueError: If porter not found

        """
        return self.get_component(alias, ComponentType.PORTER)

    def get_handshake(self, alias: str) -> Component:
        """Get a handshake component by alias.

        Args:
            alias: Handshake alias

        Returns:
            Component info for the handshake

        Raises:
            ValueError: If handshake not found

        """
        return self.get_component(alias, ComponentType.HANDSHAKE)

    def is_registered(self, name_or_alias: str) -> bool:
        """Check if a component is registered.

        Args:
            name_or_alias: Component name or alias

        Returns:
            True if component is registered, False otherwise

        """
        # Check if exists in components dict or in any alias tuple
        if name_or_alias in self._components:
            return True
        # Check aliases - need to check if name_or_alias matches any alias value
        for _, alias in self._aliases.keys():
            if alias == name_or_alias:
                return True
        return False

    def unregister(
        self,
        name_or_alias: str,
        component_type: Optional[ComponentType] = None,
    ) -> None:
        """Unregister a component (mainly for testing).

        Args:
            name_or_alias: Component name or alias to unregister
            component_type: Optional component type for scoped alias lookup

        """
        # Try to find the component
        comp = None
        try:
            comp = self.get_component(name_or_alias, component_type)
        except ValueError:
            return  # Component not registered

        name = comp.name
        alias = comp.alias
        ctype = comp.component_type

        # Remove from all tracking structures
        del self._components[name]
        alias_key = (ctype, alias)
        if alias_key in self._aliases:
            del self._aliases[alias_key]
        self._component_types[ctype].remove(name)

    def clear(self) -> None:
        """Clear all registered components (mainly for testing)."""
        self._components.clear()
        self._aliases.clear()
        for component_list in self._component_types.values():
            component_list.clear()


def pipeline_component(
    alias: str,
    component_type: ComponentType,
) -> Callable[[ComponentT], ComponentT]:
    """Register a class as a pipeline component.

    Args:
        alias: Short name for the component (used in string pipelines)
 
```

### Core Architecture Module: `src/chonkie/utils/table_converter.py`
```
"""Table converter utilities for transforming tables to different formats."""

import math
from io import StringIO


def _read_markdown_table(table_content: str):
    """Read markdown table into DataFrame."""
    try:
        import pandas as pd
    except ImportError as e:
        raise ImportError(
            "Pandas is required to use the table converter. Please install it with `pip install chonkie[table]`.",
        ) from e

    lines = [line.strip("|").strip() for line in table_content.split("\n") if line.strip()]
    if len(lines) < 2:
        return pd.DataFrame()

    csv_content = "\n".join([lines[0]] + lines[2:])
    df = pd.read_csv(StringIO(csv_content), sep="|", skipinitialspace=True)
    df.columns = df.columns.str.strip()
    df = df.apply(lambda x: x.str.strip() if x.dtype == "object" else x)
    return df


def _read_html_table(table_content: str):
    """Read HTML table into DataFrame."""
    try:
        import pandas as pd
    except ImportError as e:
        raise ImportError(
            "Pandas is required to use the table converter. Please install it with `pip install chonkie[table]`.",
        ) from e

    try:
        tables = pd.read_html(StringIO(table_content))
        if not tables:
            return None
        df = tables[0]
        if df.columns[0] == 0 and len(df.columns) == 1:
            return None
        return df
    except Exception:
        return None


def _clean_for_json(value):
    """Convert pandas values to JSON-serializable types."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if isinstance(value, float) and value.is_integer():
        return int(value)
    return value


def markdown_table_to_json(table_content: str) -> list[dict]:
    """Convert a markdown table to a JSON-serializable list of dictionaries.

    Each row becomes a dictionary with column names as keys.
    Numeric values are automatically converted to int/float.

    Args:
        table_content: The markdown table content as a string.

    Returns:
        A list of dictionaries, one per data row.

    Example:
        >>> table = '''
        ... | Name | Score |
        ... |------|-------|
        ... | Alice | 100 |
        ... | Bob | 95 |
        ... '''
        >>> markdown_table_to_json(table)
        [{'Name': 'Alice', 'Score': 100}, {'Name': 'Bob', 'Score': 95}]

    """
    df = _read_markdown_table(table_content)
    if df.empty:
        return []
    records = df.to_dict(orient="records")
    return [
        {
            k.strip(): _clean_for_json(v.strip() if isinstance(v, str) else v)
            for k, v in record.items()
        }
        for record in records
    ]


def html_table_to_json(table_content: str) -> list[dict] | None:
    """Convert an HTML table to a JSON-serializable list of dictionaries.

    Each row becomes a dictionary with column names as keys.
    Numeric values are automatically converted to int/float.

    Args:
        table_content: The HTML table content as a string.

    Returns:
        A list of dictionaries, one per data row, or None if no valid table found.

    Example:
        >>> html = '<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr></tbody></table>'
        >>> html_table_to_json(html)
        [{'Name': 'Alice', 'Age': 30}]

    """
    df = _read_html_table(table_content)
    if df is None or df.empty:
        return None
    records = df.to_dict(orient="records")
    return [
        {
            k.strip(): _clean_for_json(v.strip() if isinstance(v, str) else v)
            for k, v in record.items()
        }
        for record in records
    ]

```

### Core Architecture Module: `src/chonkie/utils/viz.py`
```
"""Module for visualizing Chonkie."""

import base64
import html
import os
from typing import Optional, Sequence, Union

from chonkie.logger import get_logger
from chonkie.types import Chunk

logger = get_logger(__name__)

# light themes
LIGHT_THEMES = {
    # Pastel colored rainbow theme
    "pastel": [
        "#FFADAD",
        "#FFD6A5",
        "#FDFFB6",
        "#CAFFBF",
        "#9BF6FF",
        "#A0C4FF",
        "#BDB2FF",
        "#FFC6FF",
    ],
    # Tiktokenizer theme: [ “#bae6fc”, “#fde68a”, “#bbf7d0”, “#fed7aa”, “#a5f3fc”, “#e5e7eb”, “#eee2fd”, “#e4f9c0”, “#fecdd3”]
    "tiktokenizer": [
        "#bae6fc",
        "#fde68a",
        "#bbf7d0",
        "#fed7aa",
        "#a5f3fc",
        "#e5e7eb",
        "#eee2fd",
        "#e4f9c0",
        "#fecdd3",
    ],
    # New example light theme
    "ocean_breeze": [
        "#E0FFFF",  # Light Cyan
        "#B0E0E6",  # Powder Blue
        "#ADD8E6",  # Light Blue
        "#87CEEB",  # Sky Blue
        "#4682B4",  # Steel Blue
    ],
}

# dark themes
DARK_THEMES = {
    # Tiktokenizer but with darker colors
    "tiktokenizer_dark": [
        "#2A4E66",
        "#80662A",
        "#2A6648",
        "#66422A",
        "#2A4A66",
        "#3A3D40",
        "#55386E",
        "#3A6640",
        "#66353B",
    ],
    # Pastel but with darker colors
    "pastel_dark": [
        "#5C2E2E",
        "#5C492E",
        "#4F5C2E",
        "#2E5C4F",
        "#2E3F5C",
        "#3A3A3A",
        "#4F2E5C",
        "#2E5C3F",
    ],
    # New example dark theme
    "midnight": [
        "#00008B",  # DarkBlue
        "#483D8B",  # DarkSlateBlue
        "#2F4F4F",  # DarkSlateGray
        "#191970",  # MidnightBlue
    ],
}

# light mode colors
BODY_BACKGROUND_COLOR_LIGHT = "#F0F2F5"
CONTENT_BACKGROUND_COLOR_LIGHT = "#FFFFFF"
TEXT_COLOR_LIGHT = "#333333"
# dark mode colors
BODY_BACKGROUND_COLOR_DARK = "#121212"
CONTENT_BACKGROUND_COLOR_DARK = "#1E1E1E"
TEXT_COLOR_DARK = "#FFFFFF"

# Add all the HTML template content here
# TODO: Make this prettier in the future — I'm not a fan of the current design
# But to keep it simple and minimal, I'm keeping it like this for now
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    {favicon_link_tag}
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"; line-height: 1.6; padding: 0; margin: 0; background-color: {body_bg_color}; color: {text_color}; display: flex; flex-direction: column; min-height: 100vh; }}
        .content-box {{ max-width: 900px; width: 100%; margin: 30px auto; padding: 30px 20px 20px 20px; background-color: {content_bg_color}; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); box-sizing: border-box; }}
        .text-display {{ white-space: pre-wrap; word-wrap: break-word; font-family: "Consolas", "Monaco", "Courier New", monospace; font-size: 0.95em; padding: 0; }}
        .text-display span[style*="background-color"] {{ border-radius: 3px; padding: 0.1em 0; cursor: help; }}
        .text-display br {{ display: block; content: ""; margin-top: 0.6em; }}
        footer {{ text-align: center; margin-top: auto; padding: 15px 0; font-size: 0.8em; color: #888; border-top: 1px solid #eee; background-color: #f0f2f5; width: 100%; }}
        footer a {{ color: #666; text-decoration: none; }}
        footer a:hover {{ text-decoration: underline; }}
        footer .heart {{ color: #d63384; display: inline-block; }}
    </style>
</head>
<body>
    {main_content}
    {footer_content}
</body>
</html>
"""

MAIN_TEMPLATE = """
<div class="content-box">
    <div class="text-display">{html_parts}</div>
</div>
"""

FOOTER_TEMPLATE = """
<footer>
    Made with <span class="heart">🤎</span> by <a href="https://github.com/chonkie-inc/chonkie" target="_blank" rel="noopener noreferrer">🦛 Chonkie</a>
</footer>
"""


class Visualizer:
    """Visualizer class for Chonkie.

    This class can take in Chonkie Chunks and visualize them on the terminal
    or save them as a standalone HTML file.

    Attributes:
        theme (str): The theme to use for the visualizer (default is "pastel")

    Methods:
        print(chunks: list[Chunk], full_text: Optional[str] = None) -> None:
            Print the chunks to the terminal, with rich highlights!
        save(filename: str, chunks: list[Chunk], full_text: Optional[str] = None, title: str = "Chunk Visualization") -> None:
            Save the chunks as a standalone HTML file, always embedding a hippo emoji SVG favicon.

    """

    # Store the hippo SVG content as a class attribute
    HIPPO_SVG_CONTENT = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><text x="50" y="55" font-size="90" text-anchor="middle" dominant-baseline="middle">🦛</text></svg>"""

    def __init__(self, theme: Union[str, list[str]] = "pastel") -> None:
        """Initialize the Visualizer.

        Args:
            theme (Union[str, list[str]]): The theme to use for the visualizer (default is PASTEL_THEME)

        """
        try:
            from rich.console import Console
        except ImportError as e:
            raise ImportError(
                f"Could not import dependencies with error: {e}. Please install the dependencies with `pip install chonkie[viz]`",
            ) from e

        # Initialize the console
        self.console = Console()

        # We want the editor's text color to apply by default for custom themes
        # If the theme is a string, get the theme
        if isinstance(theme, str):
            self.theme, self.text_color = self._get_theme(theme)
            self.theme_name = theme
        else:
            self.text_color = ""
            self.theme = theme
            self.theme_name = "custom"

    # NOTE: This is a helper function to manage the theme
    def _get_theme(self, theme: str) -> tuple[list[str], str]:
        """Get the theme from the theme name."""
        if theme in DARK_THEMES:
            return DARK_THEMES[theme], TEXT_COLOR_DARK
        elif theme in LIGHT_THEMES:
            return LIGHT_THEMES[theme], TEXT_COLOR_LIGHT
        else:
            raise ValueError(f"Invalid theme: {theme}")

    def _get_color(self, index: int) -> str:
        """Cycles through the appropriate color list."""
        return self.theme[index % len(self.theme)]

    def _preprocess_chunks(
        self, chunks: Sequence[Union[Chunk, str]], full_text: Optional[str] = None
    ) -> tuple[list[Chunk], Optional[str]]:
        """Convert a mixed list of Chunk/str into a uniform list of Chunks.

        When all items are strings and full_text is not provided, full_text is
        auto-constructed by joining the strings. String items are converted to
        Chunk objects with indices derived from full_text (if available) or by
        assuming contiguous layout.

        Args:
            chunks: Input sequence of Chunk objects and/or plain strings.
            full_text: Optional explicit full text. Preserved when provided.

        Returns:
            A tuple of (processed_chunks, full_text).

        """
        if full_text is None and all(isinstance(chunk, str) for chunk in chunks):
            full_text = "".join(chunk for chunk in chunks if isinstance(chunk, str))

        processed_chunks: list[Chunk] = []
        current_pos = 0
        for chunk in chunks:
            if isinstance(chunk, str):
                if full_text is not None:
                    try:
                        start_idx = full_text.index(chunk, current_pos)
                    except ValueError:
                        start_idx = current_pos
                else:
                    start_idx = current_pos
                end_idx = start_idx + len(chunk)
                processed_chunks.append(
                    Chunk(text=chunk, start_index=start_idx, end_index=end_idx)
                )
                current_pos = end_idx
            else:
                processed_chunks.append(chunk)
                if hasattr(chunk, "end_index") and isinstance(chunk.end_index, (int, float)):
                    current_pos = int(chunk.end_index)

        return processed_chunks, full_text

    def _reconstruct_text_from_chunks(self, chunks: Sequence[Chunk]) -> str:
        """Reconstruct the full text from a list of chunks, handling overlaps."""
        # Sort chunks by start_index to handle overlaps correctly
        sorted_chunks = sorted(chunks, key=lambda x: x.start_index)

        # Check if chunks have the required attributes
        for chunk in sorted_chunks:
            if (
                not hasattr(chunk, "text")
                or not hasattr(chunk, "start_index")
                or not hasattr(chunk, "end_index")
            ):
                raise AttributeError(
                    "Chunks must have 'text', 'start_index', and 'end_index' attributes for automatic text reconstruction.",
                )

        # Reconstruct full text by merging chunks
        reconstructed_text = ""
        last_end = 0

        for chunk in sorted_chunks:
            start_idx = chunk.start_index

            if start_idx >= last_end:
                # No overlap, append chunk text directly
                reconstructed_text += chunk.text
                last_end = len(reconstructed_text)  # fix for overlapped chunks
            else:
                # Handle overlap by taking only the non-overlapping part
                overlap_offset = last_end - start_idx
                if overlap_offset < len(chunk.text):
                    reconstructed_text += chunk.text[overlap_offset:]
                    last_end = len(reconstructed_text)  # fix for overlapped chunks

        return reconstructed_text

    # NOTE: This is a helper function to manage overlapping chunk visualizations
    #
```

### Core Architecture Module: `src/chonkie/__init__.py`
```
"""Main package for Chonkie."""

from .chef import BaseChef, LiteParse, MarkdownChef, MistralOCR, TableChef, TextChef
from .chunker import (
    BaseChunker,
    CodeChunker,
    FastChunker,
    LateChunker,
    NeuralChunker,
    RecursiveChunker,
    SemanticChunker,
    SentenceChunker,
    SlumberChunker,
    TableChunker,
    TeraflopAIChunker,
    TokenChunker,
)
from .cloud import chunker, refineries
from .embeddings import (
    AutoEmbeddings,
    AzureOpenAIEmbeddings,
    BaseEmbeddings,
    CohereEmbeddings,
    GeminiEmbeddings,
    JinaEmbeddings,
    LiteLLMEmbeddings,
    Model2VecEmbeddings,
    OpenAIEmbeddings,
    SentenceTransformerEmbeddings,
    VoyageAIEmbeddings,
)
from .fetcher import BaseFetcher, FileFetcher
from .genie import AzureOpenAIGenie, BaseGenie, CerebrasGenie, GeminiGenie, GroqGenie, OpenAIGenie
from .handshakes import (
    BaseHandshake,
    ChromaHandshake,
    ElasticHandshake,
    LanceDBHandshake,
    MilvusHandshake,
    MongoDBHandshake,
    PgvectorHandshake,
    PineconeHandshake,
    QdrantHandshake,
    TurbopufferHandshake,
    WeaviateHandshake,
)
from .pipeline import Pipeline
from .porters import BasePorter, DatasetsPorter, JSONPorter
from .refinery import BaseRefinery, EmbeddingsRefinery, OverlapRefinery
from .tokenizer import (
    AutoTokenizer,
    ByteTokenizer,
    CharacterTokenizer,
    RowTokenizer,
    Tokenizer,
    TokenizerProtocol,
    WordTokenizer,
)
from .types import (
    Chunk,
    Document,
    LanguageConfig,
    MarkdownCode,
    MarkdownDocument,
    MarkdownImage,
    MarkdownTable,
    MergeRule,
    RecursiveLevel,
    RecursiveRules,
    Sentence,
    SplitRule,
)
from .utils import Hubbie, Visualizer
from .utils.table_converter import html_table_to_json, markdown_table_to_json

__all__ = (
    # chef
    "BaseChef",
    "LiteParse",
    "MarkdownChef",
    "MistralOCR",
    "TableChef",
    "TextChef",
    # chunker
    "BaseChunker",
    "CodeChunker",
    "FastChunker",
    "LateChunker",
    "NeuralChunker",
    "RecursiveChunker",
    "SemanticChunker",
    "SentenceChunker",
    "SlumberChunker",
    "TableChunker",
    "TeraflopAIChunker",
    "TokenChunker",
    # cloud
    "chunker",
    "refineries",
    # embeddings
    "AutoEmbeddings",
    "AzureOpenAIEmbeddings",
    "BaseEmbeddings",
    "CohereEmbeddings",
    "GeminiEmbeddings",
    "JinaEmbeddings",
    "LiteLLMEmbeddings",
    "Model2VecEmbeddings",
    "OpenAIEmbeddings",
    "SentenceTransformerEmbeddings",
    "VoyageAIEmbeddings",
    # fetcher
    "BaseFetcher",
    "FileFetcher",
    # genie
    "AzureOpenAIGenie",
    "BaseGenie",
    "CerebrasGenie",
    "GeminiGenie",
    "GroqGenie",
    "OpenAIGenie",
    # handshakes
    "BaseHandshake",
    "ChromaHandshake",
    "ElasticHandshake",
    "LanceDBHandshake",
    "MilvusHandshake",
    "MongoDBHandshake",
    "PgvectorHandshake",
    "PineconeHandshake",
    "QdrantHandshake",
    "TurbopufferHandshake",
    "WeaviateHandshake",
    # pipeline
    "Pipeline",
    # porters
    "BasePorter",
    "DatasetsPorter",
    "JSONPorter",
    # refinery
    "BaseRefinery",
    "EmbeddingsRefinery",
    "OverlapRefinery",
    # tokenizer
    "AutoTokenizer",
    "ByteTokenizer",
    "CharacterTokenizer",
    "RowTokenizer",
    "Tokenizer",
    "TokenizerProtocol",
    "WordTokenizer",
    # types
    "Chunk",
    "Document",
    "LanguageConfig",
    "MarkdownCode",
    "MarkdownDocument",
    "MarkdownImage",
    "MarkdownTable",
    "MergeRule",
    "RecursiveLevel",
    "RecursiveRules",
    "Sentence",
    "SplitRule",
    # utils
    "Hubbie",
    "Visualizer",
    "html_table_to_json",
    "markdown_table_to_json",
)

# This hippo grows with every release 🦛✨~
__version__ = "1.7.0"
__name__ = "chonkie"
__author__ = "🦛 Chonkie Inc"

```

### Core Architecture Module: `src/chonkie/api/__init__.py`
```
"""Chonkie OSS API - A lightweight FastAPI server for the Chonkie chunking library."""

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #583** (2026-05-21): **Bug: `CodeChunker` fails with `tree-sitter-language-pack` >= 1.8.0: cannot import `SupportedLanguage`**
  *Symptoms*: **Describe the bug** `CodeChunker` fails to construct when installed alongside `tree-sitter-language-pack >= 1.8.0` because `SupportedLanguage` was removed from the package their v1 rewrite here: https://github.com/kreuzberg-dev/tree-sitter-language-pack/commit/5a822c0.  **To Reproduce**  ``` pip install "chonkie[code]" "tree-sitter-language-pack>=1.8.0" python -c "from chonkie import CodeChunker; CodeChunker(language='python')" ```  Results in: `ImportError: cannot import name 'SupportedLanguage' from 'tree_sitter_language_pack'`  **Root cause**  In `src/chonkie/chunker/code.py`:   - [Line 80](https://github.com/chonkie-inc/chonkie/blob/main/src/chonkie/chunker/code.py#L80): `from tree_sitter_language_pack import SupportedLanguage, get_parser`   - Same import here: https://github.com/chonkie-inc/chonkie/blob/main/src/chonkie/chunker/code.py#L374  **Environment**   - chonkie: v1.6.5 (latest released): `main` has the same import   - tree-sitter-language-pack: 1.8.0   - Python: 3.12
  **Post-Mortem & Fix Analysis**:
  > I am a maintainer from [Agno](https://www.agno.com/). Just flagging the impact on our side because this is breaking our CI on main with the latest versions. Failing run in our sdk: https://github.com/agno-agi/agno/actions/runs/25633948991/job/75242444274.   As a temporary fix I have shipped a PR: https://github.com/agno-agi/agno/pull/7869 with pinned tree-sitter-language-pack dependency to unblock the feature, but would love to drop it once chonkie ships a fix. Thanks!
  > Hi @sannya-singal  Thanks a lot for bringing this to my attention. I have fixed this in #587 and deployed a patch release in [1.6.6](https://github.com/chonkie-inc/chonkie/releases/tag/v1.6.6) .
  > Awesome @chonk-lain 🙌  Thanks for the quick turnaround. Thanks a lot for creating the [PR](https://github.com/agno-agi/agno/pull/7904) to lift the temporary pin in agno 🎉 Will merge the PR today!

- **Issue #529** (2026-03-23): **Bug:gemini embedding-004 not supported**
  *Symptoms*: embedding-004: API error: { "error": { "code": 404, "message": "models/text-embedding-004 is not found for API version v1beta, or is not supported for embedContent. Call ListModels to see the list of available models and their supported methods.", "status": "NOT_FOUND" } }
  **Post-Mortem & Fix Analysis**:
  > Pretty sure that model is deprecated
  > Hey @xiaoslinxl-dev!   That model has been deprecated since Jan, 2026. I'd suggest using the `gemini-embedding-2` model they recently released!  Closing this issue; please re-open if you face further issues!  Thanks 

- **Issue #517** (2026-03-17): **Bug: `chonkie.cloud` is always imported on `import chonkie`, forcing `httpx` as an undeclared dependency**
  *Symptoms*: **Describe the bug**  `chonkie/__init__.py` unconditionally imports the `cloud` subpackage:  ```python from .cloud import chunker, refineries ```  **To Reproduce and Environment**  ```python import chonkie ``` .. when installed into a fresh env with no other deps. yet installed.   Every module under `cloud/` (chunker, refineries, pipeline, file) has a bare `import httpx` at the top level, so `httpx` is required just to `import chonkie` — even for users who only use local chunking and never touch the cloud API.  `httpx` is listed only under the `[all]` extra and is not a declared core dependency, so a clean install (`pip install chonkie`) can fail at import time on environments that don't already have `httpx`.  ## Proposed fix  I expect you wouldn't want to add `httpx` to the core dependencies - as this is unnecessary for users not using the cloud API (but this would fix).   **Would it be helpful if I submitted a PR so that `[cloud]` was an optional extra?**  Add a `[cloud]` extra with `httpx`, and lazy-load the cloud subpackage in `__init__.py` (e.g. via `__getattr__`), raising a helpful `ImportError` if `httpx` is absent:  ```python   def __getattr__(name):       if name in ("chunker", "refineries"):           try:               from . import cloud as _cloud               return getattr(_cloud, name)           except ImportError:               raise ImportError(                   f"chonkie.{name} requires the cloud extra: "                   f"pip install 'chonkie[cloud]'"  

- **Issue #480** (2026-02-04): **Bug: Version 1.5.4 breaks if openai is not installed**
  *Symptoms*: **Describe the bug**  openai is not identified as a dependency when installing chonkie[st], but is required.   **To Reproduce** Please provide a code snippet that reproduces the bug. ``` > uv init > uv add chonkie[st] > uv sync (installs 1.5.4)  ------------- pyproject.toml  [project] name = "chonkie-error" version = "0.1.0" description = "Add your description here" readme = "README.md" requires-python = ">=3.11" dependencies = [     "chonkie[st]>=1.5.4", ] ```  ------------- ``` from chonkie import LateChunker, SentenceTransformerEmbeddings        def main():           chunker = LateChunker(SentenceTransformerEmbeddings(model="sentence-transformers/nli-mpnet-base-v2"))           chunker.chunk("This is a test sentence for chunking.")           for chunk in chunker:               print(chunk)              if __name__ == "__main__":           main() ``` -------------  ```   File "~/chonkie-test/main.py", line 1, in <module>     from chonkie import LateChunker, SentenceTransformerEmbeddings   File "~/chonkie-test/.venv/lib/python3.11/site-packages/chonkie/__init__.py", line 4, in <module>     from .chunker import (   File "~/chonkie-test/.venv/lib/python3.11/site-packages/chonkie/chunker/__init__.py", line 6, in <module>     from .late import LateChunker   File "~/chonkie-test/.venv/lib/python3.11/site-packages/chonkie/chunker/late.py", line 9, in <module>     from chonkie.embeddings.sentence_transformer import SentenceTransformerEmbeddings   File "~/chonkie-test/.venv/lib/pytho
  **Post-Mortem & Fix Analysis**:
  > This commit: https://github.com/chonkie-inc/chonkie/commit/87c78912476cb0e479aafe74d350e83a974d6fa0  Appears to have added:  `from openai import APIError, RateLimitError, Timeout`  so the registry attempts to load the openai library when scanning for embeddings
  > nice catch, thanks for reporting this

- **Issue #460** (2026-02-16): **Pipeline.run() crashes with empty text list**
  *Symptoms*: **Describe the bug** When calling Pipeline.run() with an empty list of texts, it crashes with IndexError instead of gracefully handling the edge case.  **To Reproduce** from chonkie import Pipeline pipe = Pipeline().chunk_with('recursive') result = pipe.run(texts=[])  **Expected behavior** Should return empty Document or raise informative ValueError about empty input.  **Environment** - Python 3.9+ - chonkie v1.5.2

- **Issue #459** (2026-04-21): **SemanticChunker throws exception when embedding_model is None**
  *Symptoms*: **Describe the bug** SemanticChunker initialization fails with TypeError when embedding_model parameter is not provided or is explicitly set to None.  **To Reproduce** from chonkie import SemanticChunker chunker = SemanticChunker() chunks = chunker("Test text")  **Expected behavior** Should use default embedding model or raise a more informative error message.  **Environment** - Python 3.10+ - chonkie v1.5.2
  **Post-Mortem & Fix Analysis**:
  > this worked on my end, could you try running `pip show chonkie` in your terminal and check which version you're using  <img width="748" height="191" alt="Image" src="https://github.com/user-attachments/assets/b335b9af-05cd-45bf-b289-99a6237982ce" />  else if you have some weird security issues related to proxy try running the following snippet, and if it fails then it's def related to security issues ```py from model2vec import StaticModel  model = StaticModel.from_pretrained("minishlab/potion-base-32M") ```
  > Hey @swamy18! 👋  We're unable to reproduce this in recent versions — `SemanticChunker()` with no arguments defaults to `"minishlab/potion-base-32M"` and works fine.  If you're explicitly passing `embedding_model=None`, that's expected behaviour — the `SemanticChunker` requires an embedding model to function, so passing `None` will raise an error.  Could you try upgrading to the latest version and see if the issue persists?  Thanks 😊

- **Issue #458** (2026-02-28): **RecursiveChunker fails with None overlap_mode parameter**
  *Symptoms*: **Describe the bug** When passing overlap_mode=None to RecursiveChunker, it raises an AttributeError instead of using the default mode.  **To Reproduce** from chonkie import RecursiveChunker chunker = RecursiveChunker(overlap_mode=None) chunks = chunker("Sample text for chunking")  **Environment** - Python 3.10 - chonkie v1.5.2
  **Post-Mortem & Fix Analysis**:
  > Hi swamy, l think this issue had fixed in the newest version(1.5.6), you can try the newest in your environment; Also, Happy Lunar New Year!  <img width="1394" height="595" alt="Image" src="https://github.com/user-attachments/assets/36b07ada-1eb7-4300-9a41-49dd7c1be274" />
  > we don't have an attribute `overlap_mode` in `RecursiveChunker`  <img width="853" height="652" alt="Image" src="https://github.com/user-attachments/assets/5dd5f50b-7fb4-45ce-9cb1-5ce714575621" />

- **Issue #438** (2026-01-12): **Bug: Sentence Chunker doesn't work on chonkie 1.5.2**
  *Symptoms*: **Describe the bug** It appears the sentence chunker doesn't properly split into sentences  **To Reproduce**  Colab: https://colab.research.google.com/drive/1mQU4Fx9bH6W1b-CJ8FVYgWa_QM5prMts#scrollTo=lRjJUbAxe06O   **Environment** chonkie version 1.5.2 running in Google Colab
  **Post-Mortem & Fix Analysis**:
  > I'm closing this was a misunderstanding of the chunk size param.

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

### Incident Patch 1: `664454b6` (2026-08-26)
**Commit Message**: Merge pull request #655 from eeshsaxena/fix/token-chunker-float-overlap

Validate the resolved chunk_overlap for float values in TokenChunker

**File**: `src/chonkie/chunker/token.py` (modified, +7/-4)
```diff
@@ -48,14 +48,17 @@ def __init__(
         super().__init__(tokenizer)
         if chunk_size <= 0:
             raise ValueError("chunk_size must be positive")
-        if isinstance(chunk_overlap, int) and chunk_overlap >= chunk_size:
+        if chunk_overlap < 0:
+            raise ValueError("chunk_overlap must be non-negative")
+        chunk_overlap = (
+            chunk_overlap if isinstance(chunk_overlap, int) else int(chunk_overlap * chunk_size)
+        )
+        if chunk_overlap >= chunk_size:
             raise ValueError("chunk_overlap must be less than chunk_size")
 
         # Assign the values if they make sense
         self.chunk_size = chunk_size
-        self.chunk_overlap = (
-            chunk_overlap if isinstance(chunk_overlap, int) else int(chunk_overlap * chunk_size)
-        )
+        self.chunk_overlap = chunk_overlap
 
         self._use_multiprocessing = False
 
```

**File**: `tests/chunkers/test_token_chunker.py` (modified, +33/-0)
```diff
@@ -309,3 +309,36 @@ def test_token_chunker_return_type(tiktokenizer: Encoding, sample_text: str) ->
     chunks = chunker.chunk(sample_text)
     assert all([type(chunk) is Chunk for chunk in chunks])
     assert all([len(tiktokenizer.encode(chunk.text)) <= 512 for chunk in chunks])
+
+
+def test_token_chunker_float_overlap_out_of_range() -> None:
+    """A float chunk_overlap that resolves to >= chunk_size must be rejected.
+
+    A float is treated as a fraction of chunk_size, so chunk_overlap=1.0 with
+    chunk_size=100 resolves to an overlap of 100. That used to construct fine
+    and then either crash chunk() with "range() arg 3 must not be zero" (step
+    of zero) or silently drop the text (negative step). It should raise the
+    same ValueError the int path already raises.
+    """
+    with pytest.raises(ValueError):
+        TokenChunker(tokenizer="character", chunk_size=100, chunk_overlap=1.0)
+    with pytest.raises(ValueError):
+        TokenChunker(tokenizer="character", chunk_size=100, chunk_overlap=1.5)
+
+
+def test_token_chunker_negative_overlap() -> None:
+    """A negative chunk_overlap must be rejected instead of skipping tokens."""
+    with pytest.raises(ValueError):
+        TokenChunker(tokenizer="character", chunk_size=100, chunk_overlap=-0.5)
+    # A small negative fraction resolves to int() == 0, so it must be rejected
+    # on the input sign rather than the resolved token count.
+    with pytest.raises(ValueError):
+        TokenChunker(tokenizer="character", chunk_size=100, chunk_overlap=-0.001)
+
+
+def test_token_chunker_float_overlap_valid() -> None:
+    """A valid fractional overlap still resolves to a token count and chunks."""
+    chunker = TokenChunker(tokenizer="character", chunk_size=100, chunk_overlap=0.2)
+    assert chunker.chunk_overlap == 20
+    chunks = chunker.chunk("hello world " * 50)
+    assert len(chunks) > 0
```

---

### Incident Patch 2: `0aae0e10` (2026-08-26)
**Commit Message**: Merge branch 'main' into fix/token-chunker-float-overlap

**File**: `.github/workflows/docs.yml` (removed, +0/-59)
```diff
@@ -1,59 +0,0 @@
-name: Deploy Docs
-
-on:
-  push:
-    branches: [main]
-    paths:
-      - 'docs/**'
-      - '.github/workflows/docs.yml'
-  workflow_dispatch:
-
-permissions:
-  contents: read
-  pages: write
-  id-token: write
-
-concurrency:
-  group: pages
-  cancel-in-progress: true
-
-jobs:
-  build:
-    runs-on: ubuntu-latest
-    defaults:
-      run:
-        working-directory: docs
-    steps:
-      - uses: actions/checkout@v4
-
-      - uses: pnpm/action-setup@v4
-        with:
-          version: 10
-
-      - uses: actions/setup-node@v4
-        with:
-          node-version: 22
-          cache: pnpm
-          cache-dependency-path: docs/pnpm-lock.yaml
-
-      - run: pnpm install --frozen-lockfile
-
-      - run: pnpm build
-        env:
-          BASE_PATH: /chonkie
-          NEXT_PUBLIC_DOCS_SITE_URL: https://docs.chonkie.ai
-          NEXT_PUBLIC_CHONKIEJS_DOCS_URL: https://js.docs.chonkie.ai
-
-      - uses: actions/upload-pages-artifact@v3
-        with:
-          path: docs/out
-
-  deploy:
-    needs: build
-    runs-on: ubuntu-latest
-    environment:
-      name: github-pages
-      url: ${{ steps.deployment.outputs.page_url }}
-    steps:
-      - id: deployment
-        uses: actions/deploy-pages@v4
```

**File**: `.github/workflows/freeze-prs.yml` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+name: Freeze PRs
+
+on:
+  pull_request_target:
+    types: [opened]
+
+permissions:
+  pull-requests: write
+
+jobs:
+  close:
+    runs-on: ubuntu-latest
+    steps:
+      - name: Close pull request
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        run: |
+          gh pr close "${{ github.event.pull_request.number }}" \
+            --repo "${{ github.repository }}" \
+            --comment "$(cat <<'EOF'
+          We're freezing PRs on main while we build Chonkie v2.
+
+          v1.7 is the last 1.x release. Fixes and new work go into 2.0.
+
+          Please hold PRs until v2 is stable, we'll turn this off when we're ready. Thanks for bearing with us.
+          EOF
+          )"
```

**File**: `CONTRIBUTING.md` (modified, +3/-1)
```diff
@@ -1,5 +1,7 @@
 # 🦛 Contributing to Chonkie
 
+> **PRs are frozen.** We're building Chonkie v2. v1.7 is the last 1.x release; fixes go into 2.0. New pull requests on `main` will be closed automatically until v2 is stable. Please bear with us.
+
 > "I like them big, I like them CONTRIBUTING" ~ Moto Moto, probably
 
 Welcome fellow CHONKer! We're thrilled you want to contribute to Chonkie. Every contribution—whether fixing bugs, adding features, or improving documentation—makes Chonkie better for everyone.
@@ -9,7 +11,7 @@ Welcome fellow CHONKer! We're thrilled you want to contribute to Chonkie. Every
 ### Before You Dive In
 
 1. **Check existing issues** or open a new one to start a discussion
-2. **Read [Chonkie's documentation](https://docs.chonkie.ai)** and core [concepts](https://docs.chonkie.ai/getting-started/concepts)
+2. **Read [Chonkie's documentation](https://docs.chonkie.ai)** and core [concepts](https://docs.chonkie.ai/common/concepts)
 3. **Set up your development environment** using the guide below
 
 ### Development Setup
```

**File**: `docs/.env.example` (removed, +0/-4)
```diff
@@ -1,4 +0,0 @@
-NEXT_PUBLIC_DOCS_SITE_URL=https://docs.chonkie.ai
-NEXT_PUBLIC_CHONKIEJS_DOCS_URL=https://js.docs.chonkie.ai
-# Set when building for GitHub Pages project sites (e.g. feyninc.github.io/chonkie)
-BASE_PATH=
```

**File**: `docs/.gitignore` (removed, +0/-149)
```diff
@@ -1,149 +0,0 @@
-# Logs
-logs
-*.log
-npm-debug.log*
-yarn-debug.log*
-yarn-error.log*
-lerna-debug.log*
-
-# Diagnostic reports (https://nodejs.org/api/report.html)
-report.[0-9]*.[0-9]*.[0-9]*.[0-9]*.json
-
-# Runtime data
-pids
-*.pid
-*.seed
-*.pid.lock
-
-# Directory for instrumented libs generated by jscoverage/JSCover
-lib-cov
-
-# Coverage directory used by tools like istanbul
-coverage
-*.lcov
-
-# nyc test coverage
-.nyc_output
-
-# Grunt intermediate storage (https://gruntjs.com/creating-plugins#storing-task-files)
-.grunt
-
-# Bower dependency directory (https://bower.io/)
-bower_components
-
-# node-waf configuration
-.lock-wscript
-
-# Compiled binary addons (https://nodejs.org/api/addons.html)
-build/Release
-
-# Dependency directories
-node_modules/
-jspm_packages/
-
-# Snowpack dependency directory (https://snowpack.dev/)
-web_modules/
-
-# TypeScript cache
-*.tsbuildinfo
-
-# Optional npm cache directory
-.npm
-
-# Optional eslint cache
-.eslintcache
-
-# Optional stylelint cache
-.stylelintcache
-
-# Optional REPL history
-.node_repl_history
-
-# Output of 'npm pack'
-*.tgz
-
-# Yarn Integrity file
-.yarn-integrity
-
-# dotenv environment variable files
-.env
-.env.*
-!.env.example
-
-# parcel-bundler cache (https://parceljs.org/)
-.cache
-.parcel-cache
-
-# Next.js build output
-.next
-out
-next-env.d.ts
-
-# Nuxt.js build / generate output
-.nuxt
-dist
-.output
-
-# Gatsby files
-.cache/
-# Comment in the public line in if your project uses Gatsby and not Next.js
-# https://nextjs.org/blog/next-9-1#public-directory-support
-# public
-
-# vuepress build output
-.vuepress/dist
-
-# vuepress v2.x temp directory
-.temp
-
-# Sveltekit cache directory
-.svelte-kit/
-
-# vitepress build output
-**/.vitepress/dist
-
-# vitepress cache directory
-**/.vitepress/cache
-
-# Docusaurus cache and generated files
-.docusaurus
-
-# Serverless directories
-.serverless/
-
-# FuseBox cache
-.fusebox/
-
-# DynamoDB Local files
-.dynamodb/
-
-# Firebase cache directory
-.firebase/
-
-# TernJS port file
-.tern-port
-
-# Stores VSCode versions used for testing VSCode extensions
-.vscode-test
-
-# pnpm
-.pnpm-store
-
-# yarn v3
-.pnp.*
-.yarn/*
-!.yarn/patches
-!.yarn/plugins
-!.yarn/releases
-!.yarn/sdks
-!.yarn/versions
-
-# Vite files
-vite.config.js.timestamp-*
-vite.config.ts.timestamp-*
-.vite/
-
-# Fumadocs generated source
-.source
-.playwright-mcp
-.env*
```

**File**: `docs/README.md` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+<div align="center">
+
+![Chonkie Docs Logo](./logo/chonkie_docs_logo_tans_bg.png)
+
+# 🦛 Chonkie Docs ✨
+
+</div>
+
+> chonkie was just fine with a single DOCS.md! do we have to do this? UGH
+
+Chonkie was built with the principle of being so simple that the documentation would be minimal. However, as we grow, we need to add more documentation to help users understand the different chunking strategies available to them. So here we are!
+
+## Incorrect Documentation?
+
+If you find any incorrect documentation, please open an issue or submit a PR to fix it. You can:
+
+1. [Open an issue](https://github.com/chonkie-inc/chonkie/issues/new) describing the problem
+2. [Edit the docs directly](https://github.com/chonkie-inc/chonkie/tree/main/docs) and submit a pull request
+3. Use the "Suggest an edit" button at the bottom of any documentation page
+
+For pull requests, please:
+
+- Clearly describe what you're fixing
+- Reference any related issues
+- Follow the existing documentation style
+- Test any code examples you modify
+
+We appreciate your help in keeping our documentation accurate and up-to-date!
\ No newline at end of file
```

**File**: `docs/app/(docs)/[[...slug]]/page.tsx` (removed, +0/-68)
```diff
@@ -1,68 +0,0 @@
-import { source } from "@/lib/source";
-import {
-  DocsPage,
-  DocsBody,
-  DocsTitle,
-  DocsDescription,
-} from "fumadocs-ui/page";
-import { redirect } from "next/navigation";
-import { getMDXComponents } from "@/components/mdx";
-import { CHONKIE_QUICK_START } from "@/lib/constants";
-
-export default async function Page(props: {
-  params: Promise<{ slug?: string[] }>;
-}) {
-  const params = await props.params;
-
-  if (!params.slug || params.slug.length === 0) {
-    redirect(CHONKIE_QUICK_START);
-  }
-
-  const slug = params.slug.join("/");
-
-  if (slug === "python" || slug === "chonkie") redirect(CHONKIE_QUICK_START);
-
-  const page = source.getPage(params.slug);
-  if (!page) redirect(CHONKIE_QUICK_START);
-
-  const MDX = page.data.body;
-
-  return (
-    <DocsPage
-      toc={page.data.toc}
-      className="!max-w-none w-full md:!px-5 xl:!px-6"
-    >
-      <DocsTitle>{page.data.title}</DocsTitle>
-      <DocsDescription>{page.data.description}</DocsDescription>
-      <DocsBody>
-        <MDX components={getMDXComponents()} />
-      </DocsBody>
-    </DocsPage>
-  );
-}
-
-export function generateStaticParams() {
-  return [{ slug: [] }, { slug: ["chonkie"] }, ...source.generateParams()];
-}
-
-export async function generateMetadata(props: {
-  params: Promise<{ slug?: string[] }>;
-}) {
-  const params = await props.params;
-  if (!params.slug || params.slug.length === 0) {
-    return { title: "Documentation", description: "Chonkie Documentation" };
-  }
-
-  const page = source.getPage(params.slug);
-  if (!page) redirect(CHONKIE_QUICK_START);
-
-  return {
-    title: page.data.title,
-    description: page.data.description,
-    openGraph: {
-      title: page.data.title,
-      description: page.data.description,
-      siteName: "Chonkie",
-    },
-  };
-}
```

**File**: `docs/app/(docs)/layout.tsx` (removed, +0/-12)
```diff
@@ -1,12 +0,0 @@
-import type { ReactNode } from "react";
-import { DocsLayoutClient } from "@/components/docs-layout-client";
-import { source } from "@/lib/source";
-import { baseOptions } from "@/lib/layout.shared";
-
-export default function Layout({ children }: { children: ReactNode }) {
-  return (
-    <DocsLayoutClient tree={source.pageTree} {...baseOptions}>
-      {children}
-    </DocsLayoutClient>
-  );
-}
```

---

### Incident Patch 3: `7f5df46b` (2026-08-21)
**Commit Message**: Add the Chonkie v2 RFC and freeze PRs on main while we build it.

**File**: `.github/workflows/freeze-prs.yml` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+name: Freeze PRs
+
+on:
+  pull_request_target:
+    types: [opened, reopened, ready_for_review]
+
+permissions:
+  pull-requests: write
+
+jobs:
+  close:
+    runs-on: ubuntu-latest
+    steps:
+      - name: Close pull request
+        env:
+          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
+        run: |
+          gh pr close "${{ github.event.pull_request.number }}" \
+            --repo "${{ github.repository }}" \
+            --comment "$(cat <<'EOF'
+          We're freezing PRs on main while we build Chonkie v2.
+
+          v1.7 is the last 1.x release. Fixes and new work go into 2.0.
+
+          Please hold PRs until v2 is stable — we'll turn this off when we're ready. Thanks for bearing with us.
+          EOF
+          )"
```

**File**: `CONTRIBUTING.md` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 # 🦛 Contributing to Chonkie
 
+> **PRs are frozen.** We're building Chonkie v2. v1.7 is the last 1.x release; fixes go into 2.0. New pull requests on `main` will be closed automatically until v2 is stable. Please bear with us.
+
 > "I like them big, I like them CONTRIBUTING" ~ Moto Moto, probably
 
 Welcome fellow CHONKer! We're thrilled you want to contribute to Chonkie. Every contribution—whether fixing bugs, adding features, or improving documentation—makes Chonkie better for everyone.
```

**File**: `docs/docs.json` (modified, +2/-1)
```diff
@@ -39,7 +39,8 @@
               "oss/quick-start",
               "oss/installation",
               "oss/pipelines",
-              "oss/troubleshooting"
+              "oss/troubleshooting",
+              "oss/rfc-chonkie-v2"
             ]
           },
           {
```

**File**: `docs/oss/rfc-chonkie-v2.mdx` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+---
+title: "[RFC] Chonkie v2"
+description: Course correction for Chonkie v2
+---
+
+over the course of last year, chonkie has received a lot of love from all of its userbase. We started the year with just about 1M+ downloads and <10k daily downloads at peak. Now chonkie has 1.3M downloads a month, 8M life time downloads and 45k daily average downloads. we're blessed and grateful.
+
+in the process, over the last year we shipped a lot to chonkie. we made a new port of chonkie to js with multiple pluggable packages to manage dependencies (especially around `tokenizers` and `tree-sitter`; they were a pain to deal with), wrote a bunch of new integrations with other services, created [the fastest chunker](memchunk) ever, added pipelines and more.
+
+somewhere along the line, we slowly started becoming a framework for search applications and we didn't stop it. we should have.
+
+chonkie gave a promise of being a bloat-free, chunking library that ensures correctness and gives the primitives necessary to write good search systems. that was our day 1, and somehow, chonkie now feels quite bloated.
+
+chonkie has 23k lines of code and 24k lines of tests. we have even more lines of documentation (which to someone who has been here since day 1, knows i hate having more lines of documentation > lines of code; code should be obvious to use and human in it's structure). thankfully we use lazy loading and optional installs so our default install size is still small, but that adds so much complexity in figuring out install conditions. complexity is the biggest killer for adoption.
+
+we have 12 chunkers in the library today, which further adds complexity that is somewhat uneeded. we ran 100s of tests on our MTCB benchmark with various embedding services, chunk sizes, overlaps and refinements, and we noticed a pattern. generally, semantic chunker, neural chunker and slumber chunker (agentic chunker) were always either worse than recursive chunker by a lot or within 2-3% margin of recursive chunker. especially with new age embedding models, quality loss from chunking matters less than with old `text-embedding-ada` style embedders where chunking gave boosts over 10% in recall back in 2023-2024.
+
+furthermore, upon inspecting 100 of our top users, we realized non of the integrations, handshakes, chefs and more ever mattered. chonkie was being used for it's inteded purpose of a really good chunking service.
+
+with AI being much more useful since December of 2025, most integrations and plumbing gets written in pure python without needing a lot of abstraction from frameworks. what's still needed is a good set of primitives that guarentee correctness of functions. while AI can write you a tokenizer, using Huggingface Tokenizers is always going to be prefered. that's what we want for chonkie.
+
+chonkie v2 is a course correction.
+
+## goals
+
+ours goals for chonkie v2 is:
+
+1. a small core with readable 1-2k lines of rust code
+
+- keeping the core chunkers like token, sentence, recursive and code and some small functionality and removing the non essential.
+- fast chunker (and our `chunk` crate) will become the foundation for the new re-written chunkers in rust. the crate stays independent.
+- removing all SDK plumbing that connects to other tools (easy to write now; non-essential)
+- tokie becomes the default tokenizer for chonkie.
+
+2. same chonkie correctness guarenttees: reconstructable text, reproducibility, correct token counting and edge cases handled.
+3. less than 1MB of total binary size
+4. bindings to python and js/ts (with extensibility for more in the future)
+5. a small cli + server set-up for high performance chunking
+6. a small docker container to ship with it
+
+remove stale cloud chunkers code. server api will have good documentation and clients can be made in app.
+
+## benefits
+
+- small footprint
+- well tested (since smaller scope)
+- less lines of documentation to cover the surface
+- focused efforts to improve core functionality like code chunker
+- high performance server setup
+- easier to maintain (for us) -- faster patching, fixing issues and prs in the future.
+
+## p.s. some important points to note
+
+- chonkie v1.7 will be the last v1.x release. all fixes and patches will go towards v2.0. please bear with us.
+- chonkiejs will stop having updates meanwhile. chonkie v2.0 js/ts bindings will become the new chonkiejs.
+- in the process, we will freeze the main for prs for now. please bear with us
+- we will release a migration guide from 1.x -> 2.0 for our users.
+- we will create a skill for AI to use to migrate users to chonkie; for ease.
```

---

### Incident Patch 4: `e7a7acf8` (2026-08-13)
**Commit Message**: fix(token): reject negative fractional chunk_overlap before conversion

**File**: `src/chonkie/chunker/token.py` (modified, +10/-7)
```diff
@@ -48,17 +48,20 @@ def __init__(
         super().__init__(tokenizer)
         if chunk_size <= 0:
             raise ValueError("chunk_size must be positive")
+        # Reject a negative overlap up front, before the float-to-token
+        # conversion. A small negative fraction such as -0.001 would otherwise
+        # truncate to 0 via int() and slip past the check below.
+        if chunk_overlap < 0:
+            raise ValueError("chunk_overlap must be non-negative")
         # A float chunk_overlap is treated as a fraction of chunk_size, so
-        # resolve it to a token count before validating. Validating only the
-        # int case let a float such as 1.0 slip through, which makes the
-        # overlap equal to chunk_size and later crashes the chunk() step
-        # calculation with a range() step of zero, or silently drops text when
-        # the step goes negative.
+        # resolve it to a token count before validating the upper bound.
+        # Validating only the int case let a float such as 1.0 slip through,
+        # which makes the overlap equal to chunk_size and later crashes the
+        # chunk() step calculation with a range() step of zero, or silently
+        # drops text when the step goes negative.
         resolved_overlap = (
             chunk_overlap if isinstance(chunk_overlap, int) else int(chunk_overlap * chunk_size)
         )
-        if resolved_overlap < 0:
-            raise ValueError("chunk_overlap must be non-negative")
         if resolved_overlap >= chunk_size:
             raise ValueError("chunk_overlap must be less than chunk_size")
 
```

---

### Incident Patch 5: `586e2b62` (2026-07-01)
**Commit Message**: fix url

**File**: `docs/content/docs/chonkie/utils/visualizer.mdx` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@ description: "Visualize your chunks and embeddings"
 
 The `Visualizer` helps you visualize your chunks properly and compare different chunkers and settings with ease, either on the terminal or via HTML.
 
-![Visualizer Example](https://raw.githubusercontent.com/feyninc/chonkie/main/docs/assets/viz/viz-terminal.png)
+![Visualizer Example](https://raw.githubusercontent.com/feyninc/chonkie/main/docs/public/assets/viz/viz-terminal.png)
 
 ## Installation
 
@@ -47,4 +47,4 @@ The `save` method will save the chunks to a HTML file. Like `print`, it accepts
 viz.save("chonkie.html", chunks)
 ```
 
-![Visualizer Example](https://raw.githubusercontent.com/feyninc/chonkie/main/docs/assets/viz/viz-html.png)
+![Visualizer Example](https://raw.githubusercontent.com/feyninc/chonkie/main/docs/public/assets/viz/viz-html.png)
```

---

### Incident Patch 6: `b8bd4921` (2026-07-01)
**Commit Message**: fix

**File**: `docs/content/docs/chonkie/utils/visualizer.mdx` (modified, +2/-2)
```diff
@@ -5,7 +5,7 @@ description: "Visualize your chunks and embeddings"
 
 The `Visualizer` helps you visualize your chunks properly and compare different chunkers and settings with ease, either on the terminal or via HTML.
 
-![Visualizer Example](https://raw.githubusercontent.com/chonkie-inc/chonkie/main/docs/assets/viz/viz-terminal.png)
+![Visualizer Example](https://raw.githubusercontent.com/feyninc/chonkie/main/docs/assets/viz/viz-terminal.png)
 
 ## Installation
 
@@ -47,4 +47,4 @@ The `save` method will save the chunks to a HTML file. Like `print`, it accepts
 viz.save("chonkie.html", chunks)
 ```
 
-![Visualizer Example](https://raw.githubusercontent.com/chonkie-inc/chonkie/main/docs/assets/viz/viz-html.png)
+![Visualizer Example](https://raw.githubusercontent.com/feyninc/chonkie/main/docs/assets/viz/viz-html.png)
```

---

### Incident Patch 7: `864fe5c8` (2026-07-01)
**Commit Message**: fix

**File**: `docs/app/api/cron/route.ts` (modified, +2/-1)
```diff
@@ -2,7 +2,8 @@ import { NextResponse } from "next/server";
 
 export async function GET(request: Request) {
   const authHeader = request.headers.get("authorization");
-  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
+  const cronSecret = process.env.CRON_SECRET;
+  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }
 
```

**File**: `docs/components/github-releases.tsx` (modified, +26/-2)
```diff
@@ -30,7 +30,31 @@ export function GithubReleases({ src = "/data/releases.json" }: { src?: string }
       .catch(() => {
         setLoading(false);
       });
-  }, []);
+  }, [src]);
+
+  useEffect(() => {
+    const container = containerRef.current;
+    if (!container) return;
+
+    const handleCopy = (e: MouseEvent) => {
+      const target = e.target as HTMLElement;
+      if (!target.classList.contains("release-copy-btn")) return;
+
+      const codeEl = target.parentElement?.querySelector("code");
+      if (codeEl && navigator.clipboard) {
+        navigator.clipboard.writeText(codeEl.textContent || "").then(() => {
+          const originalText = target.textContent;
+          target.textContent = "Copied!";
+          setTimeout(() => {
+            target.textContent = originalText;
+          }, 1500);
+        });
+      }
+    };
+
+    container.addEventListener("click", handleCopy);
+    return () => container.removeEventListener("click", handleCopy);
+  }, [releases]);
 
   useEffect(() => {
     if (!containerRef.current || releases.length === 0) return;
@@ -200,7 +224,7 @@ function formatBody(body: string): string {
       const idx = codeBlocks.length;
       const cleaned = code.trim().replace(/\n{3,}/g, "\n\n");
       const escaped = escapeHtml(cleaned);
-      codeBlocks.push(`<div class="release-code-wrapper"><pre class="release-code" data-lang="${lang}"><code>${escaped}</code></pre><button class="release-copy-btn" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>{this.textContent='Copy'},1500)})">Copy</button></div>`);
+      codeBlocks.push(`<div class="release-code-wrapper"><pre class="release-code" data-lang="${lang}"><code>${escaped}</code></pre><button class="release-copy-btn">Copy</button></div>`);
       return `\n%%CODEBLOCK_${idx}%%\n`;
     }
   );
```

**File**: `docs/components/param-field.tsx` (modified, +21/-3)
```diff
@@ -1,17 +1,35 @@
 import type { ReactNode } from "react";
 
 interface ParamFieldProps {
-  path: string;
+  path?: string;
+  body?: string;
+  query?: string;
   type?: string;
   default?: string;
+  required?: boolean;
   children?: ReactNode;
 }
 
-export function ParamField({ path, type, default: defaultValue, children }: ParamFieldProps) {
+export function ParamField({
+  path,
+  body,
+  query,
+  type,
+  default: defaultValue,
+  required,
+  children,
+}: ParamFieldProps) {
+  const name = path || body || query;
+
   return (
     <div className="my-4 rounded-lg border border-fd-border bg-fd-card p-4">
       <div className="flex flex-wrap items-center gap-2 mb-2">
-        <code className="text-sm font-semibold text-fd-primary">{path}</code>
+        <code className="text-sm font-semibold text-fd-primary">{name}</code>
+        {required && (
+          <span className="text-xs font-medium text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
+            Required
+          </span>
+        )}
         {type && (
           <span className="text-xs text-fd-muted-foreground bg-fd-muted px-2 py-0.5 rounded">
             {type}
```

**File**: `docs/scripts/fetch-releases.mjs` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ async function fetchReleases(repo, outFile) {
   const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=50`, {
     headers: {
       'Accept': 'application/vnd.github.v3+json',
+      'User-Agent': 'chonkie-docs',
       ...(process.env.GITHUB_TOKEN && { 'Authorization': `token ${process.env.GITHUB_TOKEN}` }),
     },
   });
```

**File**: `docs/scripts/sync-external-docs.mjs` (modified, +19/-3)
```diff
@@ -8,8 +8,21 @@ if (existsSync(envPath)) {
   const envContent = await readFile(envPath, "utf-8");
   for (const line of envContent.split("\n")) {
     const match = line.match(/^([^#=]+)=(.*)$/);
-    if (match && !process.env[match[1].trim()]) {
-      process.env[match[1].trim()] = match[2].trim();
+    if (match) {
+      const key = match[1].trim();
+      let value = match[2].trim();
+      if (value.includes("#")) {
+        value = value.split("#")[0].trim();
+      }
+      if (
+        (value.startsWith('"') && value.endsWith('"')) ||
+        (value.startsWith("'") && value.endsWith("'"))
+      ) {
+        value = value.slice(1, -1).trim();
+      }
+      if (!process.env[key]) {
+        process.env[key] = value;
+      }
     }
   }
 }
@@ -69,4 +82,7 @@ async function syncAll() {
   }
 }
 
-syncAll();
+syncAll().catch((err) => {
+  console.error("[Sync] Error:", err.message);
+  process.exit(1);
+});
```

---

### Incident Patch 8: `33b50841` (2026-06-29)
**Commit Message**: fix: forward kwargs in BasePorter.__call__ and use points attr in qdrant search

- BasePorter.__call__ now forwards **kwargs to self.export() instead of dropping them
- QdrantHandshake.search() accesses results.points directly instead of model_dump()
  for better compatibility across qdrant-client versions

Co-Authored-By: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL]>

**File**: `src/chonkie/handshakes/qdrant.py` (modified, +2/-2)
```diff
@@ -210,8 +210,8 @@ def search(
             with_payload=True,
         )
         matches = [
-            {"id": result["id"], "score": result["score"], **result["payload"]}
-            for result in results.model_dump()["points"]
+            {"id": point.id, "score": point.score, **(point.payload or {})}
+            for point in results.points
         ]
         logger.info(f"Search complete: found {len(matches)} matching chunks")
         return matches
```

**File**: `src/chonkie/porters/base.py` (modified, +1/-1)
```diff
@@ -44,4 +44,4 @@ async def aexport(self, chunks: list[Chunk], **kwargs: Any) -> Any:
 
     def __call__(self, chunks: list[Chunk], **kwargs: Any) -> Any:
         """Export the chunks to the desired format."""
-        return self.export(chunks)
+        return self.export(chunks, **kwargs)
```

---

### Incident Patch 9: `1259a4dd` (2026-06-26)
**Commit Message**: Revert "ty"

This reverts commit f0fd242605b61e8bde1cb13adc53df0cc79785ac.

**File**: `pyproject.toml` (modified, +0/-12)
```diff
@@ -285,18 +285,6 @@ omit = ["*/chonkie/api/migrations/*"]
 [tool.coverage.report]
 omit = ["*/chonkie/api/migrations/*"]
 
-[tool.uv]
-constraint-dependencies = [
-    "onnxruntime<1.24; python_version < '3.11'",
-]
-
-[tool.ty.rules]
-invalid-method-override = "ignore"
-invalid-argument-type = "ignore"
-unresolved-import = "ignore"
-no-matching-overload = "ignore"
-deprecated = "ignore"
-
 [tool.mypy]
 disallow_untyped_defs = true
 ignore_missing_imports = true
```

**File**: `src/chonkie/api/routes/pipelines.py` (modified, +3/-3)
```diff
@@ -211,13 +211,13 @@ async def update_pipeline(
                 status_code=400,
                 detail=f"Pipeline name '{request.name}' already exists",
             )
-        pipeline.name = request.name  # ty: ignore[invalid-assignment]
+        pipeline.name = request.name
 
     if request.description is not None:
-        pipeline.description = request.description  # ty: ignore[invalid-assignment]
+        pipeline.description = request.description
 
     if request.steps is not None:
-        pipeline.config = {"steps": [step.model_dump() for step in request.steps]}  # ty: ignore[invalid-assignment]
+        pipeline.config = {"steps": [step.model_dump() for step in request.steps]}
 
     await db.commit()
     await db.refresh(pipeline)
```

**File**: `src/chonkie/chunker/code.py` (modified, +2/-2)
```diff
@@ -38,7 +38,7 @@ def _detect_language_by_parsing(text: str) -> str | None:
     for lang in languages:
         try:
             config = ProcessConfig(language=lang, structure=True, imports=True)
-            result = process(text, config)
+            result = process(text, config)  # ty: ignore[invalid-argument-type]
             structure_score = len(result.structure) + len(result.imports)
             results.append((
                 lang,
@@ -168,7 +168,7 @@ def _process_code(self, text: str, language: str) -> list["CodeChunk"]:
 
         chunk_max_bytes = self._estimate_chunk_max_bytes(text)
         config = ProcessConfig(language=language, chunk_max_size=chunk_max_bytes)
-        result = process(text, config)
+        result = process(text, config)  # ty: ignore[invalid-argument-type]
         return result.chunks  # ty: ignore[invalid-return-type]
 
     def _create_chunks_from_code_chunks(
```

**File**: `src/chonkie/embeddings/model2vec.py` (modified, +1/-2)
```diff
@@ -60,8 +60,7 @@ def embed(self, text: str) -> np.ndarray:
 
     def embed_batch(self, texts: list[str]) -> list[np.ndarray]:
         """Embed multiple texts using the model2vec model."""
-        embeddings = self.model.encode(texts, convert_to_numpy=True)
-        return list(embeddings)  # type: ignore[return-value]
+        return self.model.encode(texts, convert_to_numpy=True)  # type: ignore[return-value]
 
     def similarity(self, u: np.ndarray, v: np.ndarray) -> np.float32:
         """Compute cosine similarity of two embeddings."""
```

**File**: `src/chonkie/embeddings/registry.py` (modified, +2/-2)
```diff
@@ -157,12 +157,12 @@ def wrap(cls, object: Any, **kwargs: Any) -> BaseEmbeddings:
             embeddings_cls = cls.match(object)
             if embeddings_cls is None:
                 raise ValueError(f"No matching embeddings implementation found for: {object}")
-            return embeddings_cls(object, **kwargs)  # ty: ignore[too-many-positional-arguments]
+            return embeddings_cls(object, **kwargs)  # type: ignore[call-arg]
         else:
             # Loop through all the registered embeddings and check if the object is an instance of any of them
             for type_alias, embeddings_cls in cls.type_registry.items():
                 if type_alias in str(type(object)):
-                    return embeddings_cls(object, **kwargs)  # ty: ignore[too-many-positional-arguments]
+                    return embeddings_cls(object, **kwargs)  # type: ignore[call-arg]
         raise ValueError(f"Unsupported object type for embeddings: {object}")
 
 
```

**File**: `src/chonkie/embeddings/sentence_transformer.py` (modified, +5/-5)
```diff
@@ -59,7 +59,7 @@ def __init__(
         else:
             raise ValueError("model must be a string or SentenceTransformer instance")
 
-        self._dimension: int = self.model.get_sentence_embedding_dimension()  # ty: ignore[invalid-assignment]
+        self._dimension = self.model.get_sentence_embedding_dimension()
 
     def embed(self, text: str) -> np.ndarray:
         """Embed a single text using the sentence-transformers model."""
@@ -114,7 +114,7 @@ def embed_as_tokens(self, text: str) -> np.ndarray:
         if isinstance(token_embeddings_raw, list):
             for emb in token_embeddings_raw:
                 if hasattr(emb, "cpu"):
-                    token_embeddings.append(emb.cpu().numpy())
+                    token_embeddings.append(emb.cpu().numpy())  # ty:ignore[call-non-callable]
                 else:
                     token_embeddings.append(np.array(emb))
         else:
@@ -138,9 +138,9 @@ def count_tokens_batch(self, texts: list[str]) -> list[int]:
         encodings = self.model.tokenizer(texts)
         return [len(enc) for enc in encodings["input_ids"]]
 
-    def similarity(self, u: np.ndarray, v: np.ndarray) -> float:
+    def similarity(self, u: np.ndarray, v: np.ndarray) -> np.float32:
         """Compute cosine similarity between two embeddings."""
-        return float(self.model.similarity(u, v).item())
+        return float(self.model.similarity(u, v).item())  # type: ignore[return-value]
 
     def get_tokenizer(self) -> "Tokenizer":
         """Return the tokenizer or token counter object."""
@@ -149,7 +149,7 @@ def get_tokenizer(self) -> "Tokenizer":
     @property
     def dimension(self) -> int:
         """Return the embedding dimension."""
-        return self._dimension
+        return self._dimension  # type: ignore
 
     @property
     def max_seq_length(self) -> int:
```

**File**: `src/chonkie/genie/openai.py` (modified, +2/-2)
```diff
@@ -19,8 +19,8 @@ class APITimeoutError(Exception):
     class RateLimitError(Exception):
         """Rate limit error."""
 
-    OpenAI: Any = None
-    AsyncOpenAI: Any = None
+    OpenAI = None  # type: ignore
+    AsyncOpenAI = None  # type: ignore
 
 
 from .base import BaseGenie
```

**File**: `src/chonkie/handshakes/chroma.py` (modified, +1/-1)
```diff
@@ -229,7 +229,7 @@ def search(
 
         # Perform the query
         results = self.collection.query(
-            query_embeddings=query_embeddings,
+            query_embeddings=query_embeddings,  # ty:ignore[invalid-argument-type]
             n_results=limit,
             include=["metadatas", "documents", "distances"],
         )
```

---

### Incident Patch 10: `cbb65147` (2026-06-08)
**Commit Message**: Potential fix for pull request finding

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `docs/oss/chefs/liteparse.mdx` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ chef = LiteParse(
   Specific pages to parse (e.g., `"1-5,10"`).
 </ParamField>
 
-<ParamField path="dpi" type="int" default="150">
+<ParamField path="dpi" type="Optional[float]" default="None">
   Rendering resolution for PDF pages.
 </ParamField>
 
```

---

### Incident Patch 11: `ab7e2806` (2026-06-08)
**Commit Message**: Potential fix for pull request finding

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `docs/oss/chefs/liteparse.mdx` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ chef = LiteParse(
   Optional HTTP OCR server URL (e.g., EasyOCR or PaddleOCR server).
 </ParamField>
 
-<ParamField path="max_pages" type="int" default="10000">
+<ParamField path="max_pages" type="Optional[int]" default="None">
   Maximum number of pages to parse.
 </ParamField>
 
```

---

### Incident Patch 12: `80e45ae7` (2026-06-08)
**Commit Message**: Potential fix for pull request finding

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `docs/oss/chefs/liteparse.mdx` (modified, +4/-4)
```diff
@@ -39,12 +39,12 @@ chef = LiteParse(
 
 ### Parameters
 
-<ParamField path="ocr_enabled" type="bool" default="True">
-  Whether to enable OCR for scanned/image text.
+<ParamField path="ocr_enabled" type="Optional[bool]" default="None">
+  Whether to enable OCR for scanned/image text (defaults to LiteParse's behavior when `None`).
 </ParamField>
 
-<ParamField path="ocr_language" type="str" default="en">
-  Language code for OCR (e.g., `"en"`, `"fr"`, `"de"`).
+<ParamField path="ocr_language" type="Optional[str]" default="None">
+  Language code for OCR (e.g., `"eng"`, `"fra"`, `"deu"`).
 </ParamField>
 
 <ParamField path="ocr_server_url" type="Optional[str]" default="None">
```

---

### Incident Patch 13: `b5ef7c2b` (2026-06-08)
**Commit Message**: Potential fix for pull request finding

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `docs/oss/chefs/liteparse.mdx` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ chef = LiteParse()
 # Custom configuration
 chef = LiteParse(
     ocr_enabled=True,
-    ocr_language="en",
+    ocr_language="eng",
     dpi=300,
     max_pages=100,
     target_pages="1-10",
```

---

### Incident Patch 14: `86b70c63` (2026-06-05)
**Commit Message**: fix init signature

**File**: `src/chonkie/chef/liteparse.py` (modified, +36/-10)
```diff
@@ -63,6 +63,11 @@ def __init__(
         dpi: int = 150,
         num_workers: Optional[int] = None,
         password: Optional[str] = None,
+        precise_bounding_box: bool = True,
+        preserve_very_small_text: bool = False,
+        cli_path: Optional[str] = None,
+        install_if_not_available: bool = True,
+        timeout: Optional[float] = None,
     ):
         """Initialize the LiteParse chef.
 
@@ -75,6 +80,11 @@ def __init__(
             dpi: Rendering resolution for PDF pages.
             num_workers: Number of pages to OCR in parallel.
             password: Password for protected PDFs.
+            precise_bounding_box: Whether to compute precise bounding boxes.
+            preserve_very_small_text: Whether to preserve very small text.
+            cli_path: Custom path to the liteparse CLI.
+            install_if_not_available: Install the CLI from NPM if not found.
+            timeout: Timeout in seconds for parsing.
 
         """
         try:
@@ -88,18 +98,21 @@ def __init__(
         if ocr_enabled and not os.environ.get("TESSDATA_PREFIX"):
             self._auto_detect_tessdata()
 
-        self.parser = _LiteParse(  # type: ignore[call-arg]
-            ocr_enabled=ocr_enabled,
-            ocr_language=ocr_language,
-            ocr_server_url=ocr_server_url,
-            max_pages=max_pages,
-            target_pages=target_pages,
-            dpi=dpi,
-            num_workers=num_workers,
-            password=password,
+        self.parser = _LiteParse(
+            cli_path=cli_path,
+            install_if_not_available=install_if_not_available,
         )
         self.ocr_enabled = ocr_enabled
         self.ocr_language = ocr_language
+        self.ocr_server_url = ocr_server_url
+        self.max_pages = max_pages
+        self.target_pages = target_pages
+        self.dpi = dpi
+        self.num_workers = num_workers
+        self.password = password
+        self.precise_bounding_box = precise_bounding_box
+        self.preserve_very_small_text = preserve_very_small_text
+        self.timeout = timeout
 
     @staticmethod
     def _auto_detect_tessdata() -> None:
@@ -140,7 +153,20 @@ def process(self, path: str | os.PathLike) -> Document:
             )
 
         logger.debug(f"Processing file with LiteParse: {path}")
-        result = self.parser.parse(str(p))
+        result = self.parser.parse(
+            str(p),
+            ocr_enabled=self.ocr_enabled,
+            ocr_language=self.ocr_language,
+            ocr_server_url=self.ocr_server_url,
+            max_pages=self.max_pages,
+            target_pages=self.target_pages,
+            dpi=self.dpi,
+            num_workers=self.num_workers,
+            password=self.password,
+            precise_bounding_box=self.precise_bounding_box,
+            preserve_very_small_text=self.preserve_very_small_text,
+            timeout=self.timeout,
+        )
         content = result.text
 
         logger.info(
```

**File**: `tests/chef/test_liteparse.py` (modified, +30/-21)
```diff
@@ -75,14 +75,8 @@ def test_defaults(self, mock_liteparse) -> None:
         assert chef.ocr_enabled is True
         assert chef.ocr_language == "en"
         mock_module.LiteParse.assert_called_once_with(
-            ocr_enabled=True,
-            ocr_language="en",
-            ocr_server_url=None,
-            max_pages=10000,
-            target_pages=None,
-            dpi=150,
-            num_workers=None,
-            password=None,
+            cli_path=None,
+            install_if_not_available=True,
         )
 
     def test_custom_options(self, mock_liteparse) -> None:
@@ -96,19 +90,14 @@ def test_custom_options(self, mock_liteparse) -> None:
             target_pages="1-5,10",
             num_workers=8,
             password="secret",
+            cli_path="/usr/bin/liteparse",
         )
 
         assert chef.ocr_enabled is False
         assert chef.ocr_language == "fr"
         mock_module.LiteParse.assert_called_once_with(
-            ocr_enabled=False,
-            ocr_language="fr",
-            ocr_server_url="http://ocr:8080",
-            max_pages=50,
-            target_pages="1-5,10",
-            dpi=300,
-            num_workers=8,
-            password="secret",
+            cli_path="/usr/bin/liteparse",
+            install_if_not_available=True,
         )
 
 
@@ -128,7 +117,20 @@ def test_process_pdf(self, tmp_path: Path, mock_liteparse) -> None:
         assert isinstance(result, Document)
         assert result.content == "Extracted PDF content"
         assert result.metadata["filename"] == "test.pdf"
-        mock_parser.parse.assert_called_once_with(str(pdf_file))
+        mock_parser.parse.assert_called_once_with(
+            str(pdf_file),
+            ocr_enabled=True,
+            ocr_language="en",
+            ocr_server_url=None,
+            max_pages=10000,
+            target_pages=None,
+            dpi=150,
+            num_workers=None,
+            password=None,
+            precise_bounding_box=True,
+            preserve_very_small_text=False,
+            timeout=None,
+        )
 
     def test_process_image(self, tmp_path: Path, mock_liteparse) -> None:
         _, mock_parser = mock_liteparse
@@ -158,7 +160,7 @@ def test_process_docx(self, tmp_path: Path, mock_liteparse) -> None:
         assert result.content == "Word document content"
         assert result.metadata["filename"] == "report.docx"
 
-    def test_process_passes_options_to_init(self, tmp_path: Path, mock_liteparse) -> None:
+    def test_process_passes_options_to_parse(self, tmp_path: Path, mock_liteparse) -> None:
         mock_module, mock_parser = mock_liteparse
         mock_parser.parse.return_value = Mock(text="content")
 
@@ -176,8 +178,14 @@ def test_process_passes_options_to_init(self, tmp_path: Path, mock_liteparse) ->
         )
         chef.process(pdf_file)
 
-        # Options go to LiteParse constructor, not parse()
+        # Constructor only receives cli_path and install_if_not_available
         mock_module.LiteParse.assert_called_once_with(
+            cli_path=None,
+            install_if_not_available=True,
+        )
+        # Options go to parse()
+        mock_parser.parse.assert_called_once_with(
+            str(pdf_file),
             ocr_enabled=False,
             ocr_language="de",
             ocr_server_url=None,
@@ -186,9 +194,10 @@ def test_process_passes_options_to_init(self, tmp_path: Path, mock_liteparse) ->
             dpi=300,
             num_workers=4,
             password="pw",
+            precise_bounding_box=True,
+            preserve_very_small_text=False,
+            timeout=None,
         )
-        # parse() only receives the file path
-        mock_parser.parse.assert_called_once_with(str(pdf_file))
 
     def test_process_file_not_found(self, mock_liteparse) -> None:  # noqa: ARG002
         chef = LiteParse()
```

---

### Incident Patch 15: `6ed79d09` (2026-05-31)
**Commit Message**: Merge pull request #596 from zzhdbw/fix/json-unicode-export

fix: write non-ASCII text as-is in JSON export instead of \uXXXX escapes

**File**: `src/chonkie/porters/json.py` (modified, +6/-4)
```diff
@@ -30,16 +30,18 @@ def __init__(self, lines: bool = True):
     def _export_lines(self, chunks: list[Chunk], file: str | os.PathLike = "chunks.jsonl") -> None:
         """Export the Chunks as a JSONL file."""
         logger.debug(f"Exporting {len(chunks)} chunks to JSONL file: {file}")
-        with open(file, "w") as f:
+        with open(file, "w", encoding="utf-8") as f:
             for chunk in chunks:
-                f.write(json.dumps(chunk.to_dict()) + "\n")
+                f.write(json.dumps(chunk.to_dict(), ensure_ascii=False) + "\n")
         logger.info(f"Successfully exported {len(chunks)} chunks to JSONL: {file}")
 
     def _export_json(self, chunks: list[Chunk], file: str | os.PathLike = "chunks.json") -> None:
         """Export the Chunks into a JSON string."""
         logger.debug(f"Exporting {len(chunks)} chunks to JSON file: {file}")
-        with open(file, "w") as f:
-            json.dump([chunk.to_dict() for chunk in chunks], f, indent=self.indent)
+        with open(file, "w", encoding="utf-8") as f:
+            json.dump(
+                [chunk.to_dict() for chunk in chunks], f, indent=self.indent, ensure_ascii=False
+            )
         logger.info(f"Successfully exported {len(chunks)} chunks to JSON: {file}")
 
     def export(self, chunks: list[Chunk], file: str | os.PathLike = "chunks.jsonl") -> None:  # type: ignore[override]
```

**File**: `tests/porters/test_json_porter.py` (modified, +42/-0)
```diff
@@ -295,6 +295,48 @@ def test_json_porter_unicode_content(tmp_path: Path) -> None:
     assert data[1]["text"] == "Café, naïve, résumé, 北京"
 
 
+def test_json_porter_non_ascii_written_as_is_json(tmp_path: Path) -> None:
+    r"""Test that non-ASCII characters are written as-is, not as \uXXXX escapes, in JSON format."""
+    chunk = Chunk(
+        text="Hello 世界! The quick brown fox 跳过了那只懒惰的狗。",
+        start_index=0,
+        end_index=80,
+        token_count=12,
+    )
+
+    porter = JSONPorter(lines=False)
+    output_file = tmp_path / "non_ascii.json"
+    porter.export([chunk], str(output_file))
+
+    raw_content = output_file.read_text(encoding="utf-8")
+
+    # Verify the raw file contains the original characters, not escapes
+    assert "世界" in raw_content
+    assert "跳过了那只懒惰的狗" in raw_content
+    assert "\\u" not in raw_content
+
+
+def test_json_porter_non_ascii_written_as_is_jsonl(tmp_path: Path) -> None:
+    r"""Test that non-ASCII characters are written as-is, not as \uXXXX escapes, in JSONL format."""
+    chunk = Chunk(
+        text="Hello 世界! The quick brown fox 跳过了那只懒惰的狗。",
+        start_index=0,
+        end_index=80,
+        token_count=12,
+    )
+
+    porter = JSONPorter(lines=True)
+    output_file = tmp_path / "non_ascii.jsonl"
+    porter.export([chunk], str(output_file))
+
+    raw_content = output_file.read_text(encoding="utf-8")
+
+    # Verify the raw file contains the original characters, not escapes
+    assert "世界" in raw_content
+    assert "跳过了那只懒惰的狗" in raw_content
+    assert "\\u" not in raw_content
+
+
 def test_json_porter_chunk_serialization_completeness(
     sample_chunks: list[Chunk],
     tmp_path: Path,
```

#### Recent Merged Pull Requests:
- **PR #672** (closed): chore(deps): bump datasets from 5.0.0 to 5.0.1 (@dependabot[bot])
- **PR #671** (closed): chore(deps-dev): bump jupyterlab from 4.6.1 to 4.6.4 (@dependabot[bot])
- **PR #670** (closed): chore(deps-dev): bump notebook from 7.6.0 to 7.6.3 (@dependabot[bot])
- **PR #669** (closed): chore(deps): bump urllib3 from 2.7.0 to 2.8.0 (@dependabot[bot])
- **PR #668** (closed): chore(deps): bump tornado from 6.5.7 to 6.5.9 (@dependabot[bot])
- **PR #667** (closed): chore(deps): bump pyjwt from 2.13.0 to 2.15.0 (@dependabot[bot])
- **PR #666** (closed): chore(deps): bump litellm from 1.91.0 to 1.91.5 (@dependabot[bot])
- **PR #664** (closed): chore(deps): bump anyio from 4.14.1 to 4.14.2 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
