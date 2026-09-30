# Forensic Learning Record (Deep Inspection): StarTrail-org/LEANN

> **Canonical Artifact**: `07_PROJECT_LEARNING/startrail-org-leann-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/StarTrail-org/LEANN](https://github.com/StarTrail-org/LEANN))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:40:46.530Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `StarTrail-org/LEANN`
- **Description**: [MLsys2026 Best Paper]: https://arxiv.org/abs/2506.08276. RAG on Everything with LEANN. Enjoy 97% storage savings while running a fast, accurate, and 100% private RAG application on your personal device.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 12994 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/base_rag_example.py`
```
"""
Base class for unified RAG examples interface.
Provides common parameters and functionality for all RAG examples.
"""

import argparse
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

import dotenv
from leann.api import LeannBuilder, LeannChat

# Optional import: older PyPI builds may not include interactive_utils
try:
    from leann.interactive_utils import create_rag_session
except ImportError:

    def create_rag_session(app_name: str, data_description: str):
        class _SimpleSession:
            def run_interactive_loop(self, handler):
                print(f"Interactive session for {app_name}: {data_description}")
                print("Interactive mode not available in this build")

        return _SimpleSession()


from leann.registry import register_project_directory

# Optional import: older PyPI builds may not include settings
try:
    from leann.settings import (
        resolve_atlascloud_api_key,
        resolve_atlascloud_base_url,
        resolve_litellm_api_key,
        resolve_litellm_base_url,
        resolve_ollama_host,
        resolve_openai_api_key,
        resolve_openai_base_url,
    )
except ImportError:
    # Minimal fallbacks if settings helpers are unavailable
    import os

    def resolve_litellm_api_key(value: str | None) -> str | None:
        return value or os.getenv("LITELLM_API_KEY") or os.getenv("LEANN_LITELLM_API_KEY")

    def resolve_litellm_base_url(value: str | None) -> str | None:
        return value or os.getenv("LITELLM_BASE_URL") or os.getenv("LITELLM_API_BASE")

    def resolve_ollama_host(value: str | None) -> str | None:
        return value or os.getenv("LEANN_OLLAMA_HOST") or os.getenv("OLLAMA_HOST")

    def resolve_openai_api_key(value: str | None) -> str | None:
        return value or os.getenv("OPENAI_API_KEY")

    def resolve_openai_base_url(value: str | None) -> str | None:
        return value or os.getenv("OPENAI_BASE_URL")

    def resolve_atlascloud_api_key(value: str | None) -> str | None:
        return value or os.getenv("ATLASCLOUD_API_KEY") or os.getenv("ATLAS_CLOUD_API_KEY")

    def resolve_atlascloud_base_url(value: str | None) -> str | None:
        return (
            value
            or os.getenv("ATLASCLOUD_BASE_URL")
            or os.getenv("ATLAS_CLOUD_BASE_URL")
            or "https://api.atlascloud.ai/v1"
        )


dotenv.load_dotenv()


class BaseRAGExample(ABC):
    """Base class for all RAG examples with unified interface."""

    def __init__(
        self,
        name: str,
        description: str,
        default_index_name: str,
    ):
        self.name = name
        self.description = description
        self.default_index_name = default_index_name
        self.parser = self._create_parser()

    def _create_parser(self) -> argparse.ArgumentParser:
        """Create argument parser with common parameters."""
        parser = argparse.ArgumentParser(
            description=self.description, formatter_class=argparse.RawDescriptionHelpFormatter
        )

        # Core parameters (all examples share these)
        core_group = parser.add_argument_group("Core Parameters")
        core_group.add_argument(
            "--index-dir",
            type=str,
            default=f"./{self.default_index_name}",
            help=f"Directory to store the index (default: ./{self.default_index_name})",
        )
        core_group.add_argument(
            "--query",
            type=str,
            default=None,
            help="Query to run (if not provided, will run in interactive mode)",
        )
        # Allow subclasses to override default max_items
        max_items_default = getattr(self, "max_items_default", -1)
        core_group.add_argument(
            "--max-items",
            type=int,
            default=max_items_default,
            help="Maximum number of items to process  -1 for all, means index all documents, and you should set it to a reasonable number if you have a large dataset and try at the first time)",
        )
        core_group.add_argument(
            "--force-rebuild", action="store_true", help="Force rebuild index even if it exists"
        )

        # Embedding parameters
        embedding_group = parser.add_argument_group("Embedding Parameters")
        # Allow subclasses to override default embedding_model
        embedding_model_default = getattr(self, "embedding_model_default", "facebook/contriever")
        embedding_group.add_argument(
            "--embedding-model",
            type=str,
            default=embedding_model_default,
            help=f"Embedding model to use (default: {embedding_model_default}), we provide facebook/contriever, text-embedding-3-small,mlx-community/Qwen3-Embedding-0.6B-8bit or nomic-embed-text",
        )
        embedding_group.add_argument(
            "--embedding-mode",
            type=str,
            default="sentence-transformers",
            choices=["sentence-transformers", "openai", "mlx", "ollama"],
            help="Embedding backend mode (default: sentence-transformers), we provide sentence-transformers, openai, mlx, or ollama",
        )
        embedding_group.add_argument(
            "--embedding-host",
            type=str,
            default=None,
            help="Override Ollama-compatible embedding host",
        )
        embedding_group.add_argument(
            "--embedding-api-base",
            type=str,
            default=None,
            help="Base URL for OpenAI-compatible embedding services",
        )
        embedding_group.add_argument(
            "--embedding-api-key",
            type=str,
            default=None,
            help="API key for embedding service (defaults to OPENAI_API_KEY)",
        )

        # LLM parameters
        llm_group = parser.add_argument_group("LLM Parameters")
        llm_group.add_argument(
            "--llm",
            type=str,
            default="openai",
            choices=[
                "openai",
                "ollama",
                "hf",
                "litellm",
                "simulated",
                "atlascloud",
                "atlas-cloud",
                "atlas",
            ],
            help="LLM backend: openai, ollama, hf, litellm, atlascloud, or simulated (default: openai)",
        )
        llm_group.add_argument(
            "--llm-model",
            type=str,
            default=None,
            help="Model name (default: gpt-4o) e.g., gpt-4o-mini, llama3.2:1b, Qwen/Qwen2.5-1.5B-Instruct",
        )
        llm_group.add_argument(
            "--llm-host",
            type=str,
            default=None,
            help="Host for Ollama-compatible APIs (defaults to LEANN_OLLAMA_HOST/OLLAMA_HOST)",
        )
        llm_group.add_argument(
            "--thinking-budget",
            type=str,
            choices=["low", "medium", "high"],
            default=None,
            help="Thinking budget for reasoning models (low/medium/high). Supported by GPT-Oss:20b and other reasoning models.",
        )
        llm_group.add_argument(
            "--llm-api-base",
            type=str,
            default=None,
            help="Base URL for OpenAI-compatible APIs",
        )
        llm_group.add_argument(
            "--llm-api-key",
            type=str,
            default=None,
            help="API key for OpenAI-compatible APIs (defaults to OPENAI_API_KEY)",
        )

        # AST Chunking parameters
        ast_group = parser.add_argument_group("AST Chunking Parameters")
        ast_group.add_argument(
            "--use-ast-chunking",
            action="store_true",
            help="Enable AST-aware chunking for code files (requires astchunk)",
        )
        ast_group.add_argument(
            "--ast-chunk-size",
            type=int,
            default=300,
            help="Maximum CHARACTERS per AST chunk (default: 300). Final chunks may be larger due to overlap. For 512 token models: recommended 300 chars",
  
```

### Core Architecture Module: `apps/browser_rag.py`
```
"""
Browser History RAG example using the unified interface.
Supports Chrome browser history.
"""

import os
import sys
from pathlib import Path
from typing import Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from base_rag_example import BaseRAGExample
from chunking import create_text_chunks

from .history_data.history import ChromeHistoryReader


class BrowserRAG(BaseRAGExample):
    """RAG example for Chrome browser history."""

    def __init__(self):
        # Set default values BEFORE calling super().__init__
        self.embedding_model_default = (
            "sentence-transformers/all-MiniLM-L6-v2"  # Fast 384-dim model
        )

        super().__init__(
            name="Browser History",
            description="Process and query Chrome browser history with LEANN",
            default_index_name="google_history_index",
        )

    def _add_specific_arguments(self, parser):
        """Add browser-specific arguments."""
        browser_group = parser.add_argument_group("Browser Parameters")
        browser_group.add_argument(
            "--chrome-profile",
            type=str,
            default=None,
            help="Path to Chrome profile directory (auto-detected if not specified)",
        )
        browser_group.add_argument(
            "--auto-find-profiles",
            action="store_true",
            default=True,
            help="Automatically find all Chrome profiles (default: True)",
        )
        browser_group.add_argument(
            "--chunk-size", type=int, default=256, help="Text chunk size (default: 256)"
        )
        browser_group.add_argument(
            "--chunk-overlap", type=int, default=128, help="Text chunk overlap (default: 128)"
        )

    def _get_chrome_base_path(self) -> Path:
        """Get the base Chrome profile path based on OS."""
        if sys.platform == "darwin":
            return Path.home() / "Library" / "Application Support" / "Google" / "Chrome"
        elif sys.platform.startswith("linux"):
            return Path.home() / ".config" / "google-chrome"
        elif sys.platform == "win32":
            return Path(os.environ["LOCALAPPDATA"]) / "Google" / "Chrome" / "User Data"
        else:
            raise ValueError(f"Unsupported platform: {sys.platform}")

    def _find_chrome_profiles(self) -> list[Path]:
        """Auto-detect all Chrome profiles."""
        base_path = self._get_chrome_base_path()
        if not base_path.exists():
            return []

        profiles = []

        # Check Default profile
        default_profile = base_path / "Default"
        if default_profile.exists() and (default_profile / "History").exists():
            profiles.append(default_profile)

        # Check numbered profiles
        for item in base_path.iterdir():
            if item.is_dir() and item.name.startswith("Profile "):
                if (item / "History").exists():
                    profiles.append(item)

        return profiles

    async def load_data(self, args) -> list[dict[str, Any]]:
        """Load browser history and convert to text chunks."""
        # Determine Chrome profiles
        if args.chrome_profile:
            profile_dirs = [Path(args.chrome_profile)]
        else:
            print("Auto-detecting Chrome profiles...")
            profile_dirs = self._find_chrome_profiles()

        if not profile_dirs:
            print("No Chrome profiles found!")
            print("Please specify --chrome-profile manually")
            return []

        print(f"Found {len(profile_dirs)} Chrome profiles")

        # Create reader
        reader = ChromeHistoryReader()

        # Process each profile
        all_documents = []
        total_processed = 0

        for i, profile_dir in enumerate(profile_dirs):
            print(f"\nProcessing profile {i + 1}/{len(profile_dirs)}: {profile_dir.name}")

            try:
                # Apply max_items limit per profile
                max_per_profile = -1
                if args.max_items > 0:
                    remaining = args.max_items - total_processed
                    if remaining <= 0:
                        break
                    max_per_profile = remaining

                # Load history
                documents = reader.load_data(
                    chrome_profile_path=str(profile_dir),
                    max_count=max_per_profile,
                )

                if documents:
                    all_documents.extend(documents)
                    total_processed += len(documents)
                    print(f"Processed {len(documents)} history entries from this profile")

            except Exception as e:
                print(f"Error processing {profile_dir}: {e}")
                continue

        if not all_documents:
            print("No browser history found to process!")
            return []

        print(f"\nTotal history entries processed: {len(all_documents)}")

        # Convert to text chunks
        all_texts = create_text_chunks(
            all_documents, chunk_size=args.chunk_size, chunk_overlap=args.chunk_overlap
        )

        return all_texts


if __name__ == "__main__":
    import asyncio

    # Example queries for browser history RAG
    print("\n🌐 Browser History RAG Example")
    print("=" * 50)
    print("\nExample queries you can try:")
    print("- 'What websites did I visit about machine learning?'")
    print("- 'Find my search history about programming'")
    print("- 'What YouTube videos did I watch recently?'")
    print("- 'Show me websites about travel planning'")
    print("\nNote: Make sure Chrome is closed before running\n")

    rag = BrowserRAG()
    asyncio.run(rag.run())

```

### Core Architecture Module: `apps/chatgpt_data/chatgpt_reader.py`
```
"""
ChatGPT export data reader.

Reads and processes ChatGPT export data from chat.html files.
"""

import re
from pathlib import Path
from typing import Any
from zipfile import ZipFile

from bs4 import BeautifulSoup
from llama_index.core import Document
from llama_index.core.readers.base import BaseReader


class ChatGPTReader(BaseReader):
    """
    ChatGPT export data reader.

    Reads ChatGPT conversation data from exported chat.html files or zip archives.
    Processes conversations into structured documents with metadata.
    """

    def __init__(self, concatenate_conversations: bool = True) -> None:
        """
        Initialize.

        Args:
            concatenate_conversations: Whether to concatenate messages within conversations for better context
        """
        try:
            from bs4 import BeautifulSoup  # noqa
        except ImportError:
            raise ImportError("`beautifulsoup4` package not found: `pip install beautifulsoup4`")

        self.concatenate_conversations = concatenate_conversations

    def _extract_html_from_zip(self, zip_path: Path) -> str | None:
        """
        Extract chat.html from ChatGPT export zip file.

        Args:
            zip_path: Path to the ChatGPT export zip file

        Returns:
            HTML content as string, or None if not found
        """
        try:
            with ZipFile(zip_path, "r") as zip_file:
                # Look for chat.html or conversations.html
                html_files = [
                    f
                    for f in zip_file.namelist()
                    if f.endswith(".html") and ("chat" in f.lower() or "conversation" in f.lower())
                ]

                if not html_files:
                    print(f"No HTML chat file found in {zip_path}")
                    return None

                # Use the first HTML file found
                html_file = html_files[0]
                print(f"Found HTML file: {html_file}")

                with zip_file.open(html_file) as f:
                    return f.read().decode("utf-8", errors="ignore")

        except Exception as e:
            print(f"Error extracting HTML from zip {zip_path}: {e}")
            return None

    def _parse_chatgpt_html(self, html_content: str) -> list[dict]:
        """
        Parse ChatGPT HTML export to extract conversations.

        Args:
            html_content: HTML content from ChatGPT export

        Returns:
            List of conversation dictionaries
        """
        soup = BeautifulSoup(html_content, "html.parser")
        conversations = []

        # Try different possible structures for ChatGPT exports
        # Structure 1: Look for conversation containers
        conversation_containers = soup.find_all(
            ["div", "section"], class_=re.compile(r"conversation|chat", re.I)
        )

        if not conversation_containers:
            # Structure 2: Look for message containers directly
            conversation_containers = [soup]  # Use the entire document as one conversation

        for container in conversation_containers:
            conversation = self._extract_conversation_from_container(container)
            if conversation and conversation.get("messages"):
                conversations.append(conversation)

        # If no structured conversations found, try to extract all text as one conversation
        if not conversations:
            all_text = soup.get_text(separator="\n", strip=True)
            if all_text:
                conversations.append(
                    {
                        "title": "ChatGPT Conversation",
                        "messages": [{"role": "mixed", "content": all_text, "timestamp": None}],
                        "timestamp": None,
                    }
                )

        return conversations

    def _extract_conversation_from_container(self, container) -> dict | None:
        """
        Extract conversation data from a container element.

        Args:
            container: BeautifulSoup element containing conversation

        Returns:
            Dictionary with conversation data or None
        """
        messages = []

        # Look for message elements with various possible structures
        message_selectors = ['[class*="message"]', '[class*="chat"]', "[data-message]", "p", "div"]

        for selector in message_selectors:
            message_elements = container.select(selector)
            if message_elements:
                break
        else:
            message_elements = []

        # If no structured messages found, treat the entire container as one message
        if not message_elements:
            text_content = container.get_text(separator="\n", strip=True)
            if text_content:
                messages.append({"role": "mixed", "content": text_content, "timestamp": None})
        else:
            for element in message_elements:
                message = self._extract_message_from_element(element)
                if message:
                    messages.append(message)

        if not messages:
            return None

        # Try to extract conversation title
        title_element = container.find(["h1", "h2", "h3", "title"])
        title = title_element.get_text(strip=True) if title_element else "ChatGPT Conversation"

        # Try to extract timestamp from various possible locations
        timestamp = self._extract_timestamp_from_container(container)

        return {"title": title, "messages": messages, "timestamp": timestamp}

    def _extract_message_from_element(self, element) -> dict | None:
        """
        Extract message data from an element.

        Args:
            element: BeautifulSoup element containing message

        Returns:
            Dictionary with message data or None
        """
        text_content = element.get_text(separator=" ", strip=True)

        # Skip empty or very short messages
        if not text_content or len(text_content.strip()) < 3:
            return None

        # Try to determine role (user/assistant) from class names or content
        role = "mixed"  # Default role

        class_names = " ".join(element.get("class", [])).lower()
        if "user" in class_names or "human" in class_names:
            role = "user"
        elif "assistant" in class_names or "ai" in class_names or "gpt" in class_names:
            role = "assistant"
        elif text_content.lower().startswith(("you:", "user:", "me:")):
            role = "user"
            text_content = re.sub(r"^(you|user|me):\s*", "", text_content, flags=re.IGNORECASE)
        elif text_content.lower().startswith(("chatgpt:", "assistant:", "ai:")):
            role = "assistant"
            text_content = re.sub(
                r"^(chatgpt|assistant|ai):\s*", "", text_content, flags=re.IGNORECASE
            )

        # Try to extract timestamp
        timestamp = self._extract_timestamp_from_element(element)

        return {"role": role, "content": text_content, "timestamp": timestamp}

    def _extract_timestamp_from_element(self, element) -> str | None:
        """Extract timestamp from element."""
        # Look for timestamp in various attributes and child elements
        timestamp_attrs = ["data-timestamp", "timestamp", "datetime"]
        for attr in timestamp_attrs:
            if element.get(attr):
                return element.get(attr)

        # Look for time elements
        time_element = element.find("time")
        if time_element:
            return time_element.get("datetime") or time_element.get_text(strip=True)

        # Look for date-like text patterns
        text = element.get_text()
        date_patterns = [r"\d{4}-\d{2}-\d{2}", r"\d{1,2}/\d{1,2}/\d{4}", r"\w+ \d{1,2}, \d{4}"]

        for pattern in date_patterns:
            match = re.search(pattern, text)
            if match:
                return match.group()

        return None

    def _extract_timestamp_from_container(self, container) -> str | No
```

### Core Architecture Module: `apps/chatgpt_rag.py`
```
"""
ChatGPT RAG example using the unified interface.
Supports ChatGPT export data from chat.html files.
"""

import sys
from pathlib import Path
from typing import Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from base_rag_example import BaseRAGExample
from chunking import create_text_chunks

from .chatgpt_data.chatgpt_reader import ChatGPTReader


class ChatGPTRAG(BaseRAGExample):
    """RAG example for ChatGPT conversation data."""

    def __init__(self):
        # Set default values BEFORE calling super().__init__
        self.max_items_default = -1  # Process all conversations by default
        self.embedding_model_default = (
            "sentence-transformers/all-MiniLM-L6-v2"  # Fast 384-dim model
        )

        super().__init__(
            name="ChatGPT",
            description="Process and query ChatGPT conversation exports with LEANN",
            default_index_name="chatgpt_conversations_index",
        )

    def _add_specific_arguments(self, parser):
        """Add ChatGPT-specific arguments."""
        chatgpt_group = parser.add_argument_group("ChatGPT Parameters")
        chatgpt_group.add_argument(
            "--export-path",
            type=str,
            default="./chatgpt_export",
            help="Path to ChatGPT export file (.zip or .html) or directory containing exports (default: ./chatgpt_export)",
        )
        chatgpt_group.add_argument(
            "--concatenate-conversations",
            action="store_true",
            default=True,
            help="Concatenate messages within conversations for better context (default: True)",
        )
        chatgpt_group.add_argument(
            "--separate-messages",
            action="store_true",
            help="Process each message as a separate document (overrides --concatenate-conversations)",
        )
        chatgpt_group.add_argument(
            "--chunk-size", type=int, default=512, help="Text chunk size (default: 512)"
        )
        chatgpt_group.add_argument(
            "--chunk-overlap", type=int, default=128, help="Text chunk overlap (default: 128)"
        )

    def _find_chatgpt_exports(self, export_path: Path) -> list[Path]:
        """
        Find ChatGPT export files in the given path.

        Args:
            export_path: Path to search for exports

        Returns:
            List of paths to ChatGPT export files
        """
        export_files = []

        if export_path.is_file():
            if export_path.suffix.lower() in [".zip", ".html"]:
                export_files.append(export_path)
        elif export_path.is_dir():
            # Look for zip and html files
            export_files.extend(export_path.glob("*.zip"))
            export_files.extend(export_path.glob("*.html"))

        return export_files

    async def load_data(self, args) -> list[dict[str, Any]]:
        """Load ChatGPT export data and convert to text chunks."""
        export_path = Path(args.export_path)

        if not export_path.exists():
            print(f"ChatGPT export path not found: {export_path}")
            print(
                "Please ensure you have exported your ChatGPT data and placed it in the correct location."
            )
            print("\nTo export your ChatGPT data:")
            print("1. Sign in to ChatGPT")
            print("2. Click on your profile icon → Settings → Data Controls")
            print("3. Click 'Export' under Export Data")
            print("4. Download the zip file from the email link")
            print("5. Extract or place the file/directory at the specified path")
            return []

        # Find export files
        export_files = self._find_chatgpt_exports(export_path)

        if not export_files:
            print(f"No ChatGPT export files (.zip or .html) found in: {export_path}")
            return []

        print(f"Found {len(export_files)} ChatGPT export files")

        # Create reader with appropriate settings
        concatenate = args.concatenate_conversations and not args.separate_messages
        reader = ChatGPTReader(concatenate_conversations=concatenate)

        # Process each export file
        all_documents = []
        total_processed = 0

        for i, export_file in enumerate(export_files):
            print(f"\nProcessing export file {i + 1}/{len(export_files)}: {export_file.name}")

            try:
                # Apply max_items limit per file
                max_per_file = -1
                if args.max_items > 0:
                    remaining = args.max_items - total_processed
                    if remaining <= 0:
                        break
                    max_per_file = remaining

                # Load conversations
                documents = reader.load_data(
                    chatgpt_export_path=str(export_file),
                    max_count=max_per_file,
                    include_metadata=True,
                )

                if documents:
                    all_documents.extend(documents)
                    total_processed += len(documents)
                    print(f"Processed {len(documents)} conversations from this file")
                else:
                    print(f"No conversations loaded from {export_file}")

            except Exception as e:
                print(f"Error processing {export_file}: {e}")
                continue

        if not all_documents:
            print("No conversations found to process!")
            print("\nTroubleshooting:")
            print("- Ensure the export file is a valid ChatGPT export")
            print("- Check that the HTML file contains conversation data")
            print("- Try extracting the zip file and pointing to the HTML file directly")
            return []

        print(f"\nTotal conversations processed: {len(all_documents)}")
        print("Now starting to split into text chunks... this may take some time")

        # Convert to text chunks
        all_texts = create_text_chunks(
            all_documents, chunk_size=args.chunk_size, chunk_overlap=args.chunk_overlap
        )

        print(f"Created {len(all_texts)} text chunks from {len(all_documents)} conversations")
        return all_texts


if __name__ == "__main__":
    import asyncio

    # Example queries for ChatGPT RAG
    print("\n🤖 ChatGPT RAG Example")
    print("=" * 50)
    print("\nExample queries you can try:")
    print("- 'What did I ask about Python programming?'")
    print("- 'Show me conversations about machine learning'")
    print("- 'Find discussions about travel planning'")
    print("- 'What advice did ChatGPT give me about career development?'")
    print("- 'Search for conversations about cooking recipes'")
    print("\nTo get started:")
    print("1. Export your ChatGPT data from Settings → Data Controls → Export")
    print("2. Place the downloaded zip file or extracted HTML in ./chatgpt_export/")
    print("3. Run this script to build your personal ChatGPT knowledge base!")
    print("\nOr run without --query for interactive mode\n")

    rag = ChatGPTRAG()
    asyncio.run(rag.run())

```

### Core Architecture Module: `apps/chunking/__init__.py`
```
"""Unified chunking utilities facade.

This module re-exports the packaged utilities from `leann.chunking_utils` so
that both repo apps (importing `chunking`) and installed wheels share one
single implementation. When running from the repo without installation, it
adds the `packages/leann-core/src` directory to `sys.path` as a fallback.
"""

import sys
from pathlib import Path

try:
    from leann.chunking_utils import (
        CODE_EXTENSIONS,
        _traditional_chunks_as_dicts,
        create_ast_chunks,
        create_text_chunks,
        create_traditional_chunks,
        detect_code_files,
        get_language_from_extension,
    )
except Exception:  # pragma: no cover - best-effort fallback for dev environment
    repo_root = Path(__file__).resolve().parents[2]
    leann_src = repo_root / "packages" / "leann-core" / "src"
    if leann_src.exists():
        sys.path.insert(0, str(leann_src))
        from leann.chunking_utils import (
            CODE_EXTENSIONS,
            _traditional_chunks_as_dicts,
            create_ast_chunks,
            create_text_chunks,
            create_traditional_chunks,
            detect_code_files,
            get_language_from_extension,
        )
    else:
        raise

__all__ = [
    "CODE_EXTENSIONS",
    "_traditional_chunks_as_dicts",
    "create_ast_chunks",
    "create_text_chunks",
    "create_traditional_chunks",
    "detect_code_files",
    "get_language_from_extension",
]

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

Co-authored-by: dafyy321-pixel <232224406+dafyy321-pixel@users.noreply.github.com>
Co-authored-by: Aakash Suresh <aakashsuresh2006@gmail.com>

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

Co-authored-by: dafyy321-pixel <232224406+dafyy321-pixel@users.noreply.github.com>
Co-authored-by: Aakash Suresh <aakashsuresh2006@gmail.com>

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

Co-authored-by: Aakash Suresh <aakashsuresh2006@gmail.com>

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
-  
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
+        
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

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

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

#### Recent Merged Pull Requests:
- **PR #427** (2026-09-29): fix(core): honour an explicit passage ID of 0 and key the offset map by string (@Lesereingrape)
- **PR #425** (2026-09-26): fix(ci): clear the ty diagnostics blocking every open PR (@ASuresh0524)
- **PR #422** (2026-09-26): fix: align custom IDs in array-built indexes (@dafyy321-pixel)
- **PR #421** (2026-09-26): fix(mcp): honor --base-dir across tools (@dafyy321-pixel)
- **PR #420** (2026-09-26): fix(core): judge an explicitly named file by its own name, not its ancestors (@serhiizghama)
- **PR #419** (2026-09-22): fix: include live Chrome history in SQLite snapshots (@Iams4kura)
- **PR #416** (2026-09-19): fix: remove conflicting index command registrations (@emecii)
- **PR #415** (2026-09-26): fix: preserve mixed-script token boundaries in BM25 search (@emecii)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
