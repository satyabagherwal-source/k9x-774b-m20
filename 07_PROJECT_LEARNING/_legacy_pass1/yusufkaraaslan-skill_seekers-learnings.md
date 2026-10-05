# Forensic Learning Record (Deep Inspection): yusufkaraaslan/Skill_Seekers

> **Canonical Artifact**: `07_PROJECT_LEARNING/yusufkaraaslan-skill_seekers-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yusufkaraaslan/Skill_Seekers](https://github.com/yusufkaraaslan/Skill_Seekers))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:33:16.929Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yusufkaraaslan/Skill_Seekers`
- **Description**: Convert documentation websites, GitHub repositories, and PDFs into Claude AI skills with automatic conflict detection
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 15059 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api/__init__.py`
```
"""
Skill Seekers Config API
FastAPI backend for discovering and downloading config files
"""

__version__ = "1.0.0"

```

### Core Architecture Module: `api/config_analyzer.py`
```
#!/usr/bin/env python3
"""
Config Analyzer - Extract metadata from Skill Seekers config files
"""

import json
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any


class ConfigAnalyzer:
    """Analyzes Skill Seekers config files and extracts metadata"""

    # Category mapping based on config content
    CATEGORY_MAPPING = {
        "web-frameworks": ["react", "vue", "django", "fastapi", "laravel", "astro", "hono"],
        "game-engines": ["godot", "unity", "unreal"],
        "devops": ["kubernetes", "ansible", "docker", "terraform"],
        "css-frameworks": ["tailwind", "bootstrap", "bulma"],
        "development-tools": ["claude-code", "vscode", "git"],
        "gaming": ["steam"],
        "testing": ["pytest", "jest", "test"],
    }

    # Tag extraction keywords
    TAG_KEYWORDS = {
        "javascript": ["react", "vue", "astro", "hono", "javascript", "js", "node"],
        "python": ["django", "fastapi", "ansible", "python", "flask"],
        "php": ["laravel", "php"],
        "frontend": ["react", "vue", "astro", "tailwind", "frontend", "ui"],
        "backend": ["django", "fastapi", "laravel", "backend", "server", "api"],
        "css": ["tailwind", "css", "styling"],
        "game-development": ["godot", "unity", "unreal", "game"],
        "devops": ["kubernetes", "ansible", "docker", "k8s", "devops"],
        "documentation": ["docs", "documentation"],
        "testing": ["test", "testing", "pytest", "jest"],
    }

    def __init__(self, config_dir: Path, base_url: str = "https://api.skillseekersweb.com"):
        """
        Initialize config analyzer

        Args:
            config_dir: Path to configs directory
            base_url: Base URL for download links
        """
        self.config_dir = Path(config_dir)
        self.base_url = base_url

        if not self.config_dir.exists():
            raise ValueError(f"Config directory not found: {self.config_dir}")

    def analyze_all_configs(self) -> list[dict[str, Any]]:
        """
        Analyze all config files and extract metadata

        Returns:
            List of config metadata dicts
        """
        configs = []

        # Find all JSON files recursively in configs directory and subdirectories
        for config_file in sorted(self.config_dir.rglob("*.json")):
            # Skip test/example configs in test-examples directory
            if "test-examples" in config_file.parts:
                continue

            try:
                metadata = self.analyze_config(config_file)
                if metadata:  # Skip invalid configs
                    configs.append(metadata)
            except Exception as e:
                print(f"Warning: Failed to analyze {config_file.name}: {e}")
                continue

        return configs

    def analyze_config(self, config_path: Path) -> dict[str, Any] | None:
        """
        Analyze a single config file and extract metadata

        Args:
            config_path: Path to config JSON file

        Returns:
            Config metadata dict or None if invalid
        """
        try:
            # Read config file
            with open(config_path) as f:
                config_data = json.load(f)

            # Skip if no name field
            if "name" not in config_data:
                return None

            name = config_data["name"]
            description = config_data.get("description", "")

            # Determine config type
            config_type = self._determine_type(config_data)

            # Get primary source (base_url or repo)
            primary_source = self._get_primary_source(config_data, config_type)

            # Use directory name as category (official/{category}/{name}.json)
            # Fall back to keyword-based categorization if not in a named subdirectory
            category = self._categorize_config(name, description, config_data, config_path)

            # Extract tags
            tags = self._extract_tags(name, description, config_data)

            # Get file metadata
            file_size = config_path.stat().st_size
            last_updated = self._get_last_updated(config_path)

            # Generate download URL
            download_url = f"{self.base_url}/api/download/{config_path.name}"

            # Get max_pages (for estimation)
            max_pages = self._get_max_pages(config_data)

            return {
                "name": name,
                "description": description,
                "type": config_type,
                "category": category,
                "tags": tags,
                "primary_source": primary_source,
                "max_pages": max_pages,
                "file_size": file_size,
                "last_updated": last_updated,
                "download_url": download_url,
                "config_file": config_path.name,
            }

        except json.JSONDecodeError as e:
            print(f"Invalid JSON in {config_path.name}: {e}")
            return None
        except Exception as e:
            print(f"Error analyzing {config_path.name}: {e}")
            return None

    def get_config_by_name(self, name: str) -> dict[str, Any] | None:
        """
        Get config metadata by name

        Args:
            name: Config name (e.g., "react", "django")

        Returns:
            Config metadata or None if not found
        """
        configs = self.analyze_all_configs()
        for config in configs:
            if config["name"] == name:
                return config
        return None

    def _determine_type(self, config_data: dict[str, Any]) -> str:
        """
        Determine if config is single-source or unified

        Args:
            config_data: Config JSON data

        Returns:
            "single-source" or "unified"
        """
        # Unified configs have "sources" array
        if "sources" in config_data:
            return "unified"

        # Check for merge_mode (another indicator of unified configs)
        if "merge_mode" in config_data:
            return "unified"

        return "single-source"

    def _get_primary_source(self, config_data: dict[str, Any], config_type: str) -> str:
        """
        Get primary source URL/repo

        Args:
            config_data: Config JSON data
            config_type: "single-source" or "unified"

        Returns:
            Primary source URL or repo name
        """
        if config_type == "unified":
            # Get first source
            sources = config_data.get("sources", [])
            if sources:
                first_source = sources[0]
                if first_source.get("type") == "documentation":
                    return first_source.get("base_url", "")
                elif first_source.get("type") == "github":
                    return f"github.com/{first_source.get('repo', '')}"
                elif first_source.get("type") == "pdf":
                    return first_source.get("pdf_url", "PDF file")
            return "Multiple sources"

        # Single-source configs
        if "base_url" in config_data:
            return config_data["base_url"]
        elif "repo" in config_data:
            return f"github.com/{config_data['repo']}"
        elif "pdf_url" in config_data or "pdf" in config_data:
            return "PDF file"

        return "Unknown"

    def _categorize_config(
        self,
        name: str,
        description: str,
        config_data: dict[str, Any],
        config_path: Path | None = None,
    ) -> str:
        """
        Categorize config using directory structure first, then keyword fallback.

        The configs_repo organizes files as official/{category}/{name}.json so the
        parent directory name is the authoritative category.

        Args:
            name: Config name
            description: Config description
            config_data: Full config data
            config_path: Path to config file (used to read directory-based category)

      
```

### Core Architecture Module: `api/main.py`
```
#!/usr/bin/env python3
"""
Skill Seekers Config API
FastAPI backend for listing available skill configs
"""

import os
from pathlib import Path
from typing import Any

from config_analyzer import ConfigAnalyzer
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

app = FastAPI(
    title="Skill Seekers Config API",
    description="API for discovering and downloading Skill Seekers configuration files",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware - configure allowed origins via CORS_ORIGINS env var.
# Use comma-separated list for specific origins, or "*" for public access.
# Example: CORS_ORIGINS=https://skillseekersweb.com,https://app.skillseekers.dev
# Note: browsers reject allow_credentials=True with allow_origins=["*"].
_cors_origins_raw = os.environ.get("CORS_ORIGINS", "*")
_cors_origins = [o.strip() for o in _cors_origins_raw.split(",") if o.strip()]
if not _cors_origins or "*" in _cors_origins:
    # Public access: a wildcard (even mixed into a list) forces credentials off,
    # because browsers reject allow_credentials=True with allow_origins=["*"].
    _cors_origins = ["*"]
    _cors_credentials = False
else:
    _cors_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize config analyzer
# Try configs_repo first (production), fallback to configs (local development)
CONFIG_DIR = Path(__file__).parent / "configs_repo" / "official"
if not CONFIG_DIR.exists():
    CONFIG_DIR = Path(__file__).parent.parent / "configs"

analyzer = ConfigAnalyzer(CONFIG_DIR)


@app.get("/")
async def root():
    """Root endpoint - API information"""
    return {
        "name": "Skill Seekers Config API",
        "version": "1.0.0",
        "endpoints": {
            "/api/configs": "List all available configs",
            "/api/configs/{name}": "Get specific config details",
            "/api/categories": "List all categories",
            "/api/download/{name}": "Download config file",
            "/docs": "API documentation",
        },
        "repository": "https://github.com/yusufkaraaslan/Skill_Seekers",
        "configs_repository": "https://github.com/yusufkaraaslan/skill-seekers-configs",
        "website": "https://api.skillseekersweb.com",
    }


@app.get("/api/configs")
async def list_configs(
    category: str | None = None, tag: str | None = None, type: str | None = None
) -> dict[str, Any]:
    """
    List all available configs with metadata

    Query Parameters:
    - category: Filter by category (e.g., "web-frameworks")
    - tag: Filter by tag (e.g., "javascript")
    - type: Filter by type ("single-source" or "unified")

    Returns:
    - version: API version
    - total: Total number of configs
    - filters: Applied filters
    - configs: List of config metadata
    """
    try:
        # Get all configs
        all_configs = analyzer.analyze_all_configs()

        # Apply filters
        configs = all_configs
        filters_applied = {}

        if category:
            configs = [c for c in configs if c.get("category") == category]
            filters_applied["category"] = category

        if tag:
            configs = [c for c in configs if tag in c.get("tags", [])]
            filters_applied["tag"] = tag

        if type:
            configs = [c for c in configs if c.get("type") == type]
            filters_applied["type"] = type

        return {
            "version": "1.0.0",
            "total": len(configs),
            "filters": filters_applied if filters_applied else None,
            "configs": configs,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing configs: {str(e)}")


@app.get("/api/configs/{name}")
async def get_config(name: str) -> dict[str, Any]:
    """
    Get detailed information about a specific config

    Path Parameters:
    - name: Config name (e.g., "react", "django")

    Returns:
    - Full config metadata including all fields
    """
    try:
        config = analyzer.get_config_by_name(name)

        if not config:
            raise HTTPException(status_code=404, detail=f"Config '{name}' not found")

        return config

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading config: {str(e)}")


@app.get("/api/categories")
async def list_categories() -> dict[str, Any]:
    """
    List all available categories with config counts

    Returns:
    - categories: Dict of category names to config counts
    - total_categories: Total number of categories
    """
    try:
        configs = analyzer.analyze_all_configs()

        # Count configs per category
        category_counts = {}
        for config in configs:
            cat = config.get("category", "uncategorized")
            category_counts[cat] = category_counts.get(cat, 0) + 1

        return {"total_categories": len(category_counts), "categories": category_counts}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing categories: {str(e)}")


@app.get("/api/download/{config_name}")
async def download_config(config_name: str):
    """
    Download a specific config file

    Path Parameters:
    - config_name: Config filename (e.g., "react.json", "django.json")

    Returns:
    - JSON file for download
    """
    try:
        # Validate filename (prevent directory traversal)
        if ".." in config_name or "/" in config_name or "\\" in config_name:
            raise HTTPException(status_code=400, detail="Invalid config name")

        # Ensure .json extension
        if not config_name.endswith(".json"):
            config_name = f"{config_name}.json"

        # Search recursively in all subdirectories
        config_path = None
        for found_path in CONFIG_DIR.rglob(config_name):
            config_path = found_path
            break

        if not config_path or not config_path.exists():
            raise HTTPException(status_code=404, detail=f"Config file '{config_name}' not found")

        return FileResponse(path=config_path, media_type="application/json", filename=config_name)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error downloading config: {str(e)}")


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy", "service": "skill-seekers-api"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

```

### Core Architecture Module: `examples/chroma-example/1_generate_skill.py`
```
#!/usr/bin/env python3
"""
Step 1: Generate Skill for ChromaDB

This script:
1. Scrapes Vue documentation (limited to 20 pages for demo)
2. Packages the skill in ChromaDB format
3. Saves to output/vue-chroma.json

Usage:
    python 1_generate_skill.py
"""

import subprocess
import sys
from pathlib import Path

def main():
    print("=" * 60)
    print("Step 1: Generating Skill for ChromaDB")
    print("=" * 60)

    # Check if skill-seekers is installed
    try:
        result = subprocess.run(
            ["skill-seekers", "--version"],
            capture_output=True,
            text=True
        )
        print(f"\n✅ skill-seekers found: {result.stdout.strip()}")
    except FileNotFoundError:
        print("\n❌ skill-seekers not found!")
        print("Install it with: pip install skill-seekers")
        sys.exit(1)

    # Step 1: Scrape Vue docs (small sample for demo)
    print("\n📥 Step 1/2: Scraping Vue documentation (20 pages)...")
    print("This may take 1-2 minutes...\n")

    scrape_result = subprocess.run(
        [
            "skill-seekers", "scrape",
            "--config", "configs/vue.json",
            "--max-pages", "20",
        ],
        capture_output=True,
        text=True
    )

    if scrape_result.returncode != 0:
        print(f"❌ Scraping failed:\n{scrape_result.stderr}")
        sys.exit(1)

    print("✅ Scraping completed!")

    # Step 2: Package for ChromaDB
    print("\n📦 Step 2/2: Packaging for ChromaDB...\n")

    package_result = subprocess.run(
        [
            "skill-seekers", "package",
            "output/vue",
            "--target", "chroma",
        ],
        capture_output=True,
        text=True
    )

    if package_result.returncode != 0:
        print(f"❌ Packaging failed:\n{package_result.stderr}")
        sys.exit(1)

    # Show the output
    print(package_result.stdout)

    # Check if output file exists
    output_file = Path("output/vue-chroma.json")
    if output_file.exists():
        size_kb = output_file.stat().st_size / 1024
        print(f"📄 File size: {size_kb:.1f} KB")
        print(f"📂 Location: {output_file.absolute()}")
        print("\n✅ Ready for upload! Next step: python 2_upload_to_chroma.py")
    else:
        print("❌ Output file not found!")
        sys.exit(1)

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/chroma-example/2_upload_to_chroma.py`
```
#!/usr/bin/env python3
"""
Step 2: Upload to ChromaDB

This script:
1. Creates a ChromaDB client (in-memory or persistent)
2. Creates a collection
3. Adds all documents with metadata
4. Verifies the upload

Usage:
    # In-memory (development)
    python 2_upload_to_chroma.py

    # Persistent storage (production)
    python 2_upload_to_chroma.py --persist ./chroma_db

    # Reset existing collection
    python 2_upload_to_chroma.py --reset
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import chromadb
except ImportError:
    print("❌ chromadb not installed!")
    print("Install it with: pip install chromadb")
    sys.exit(1)

def create_client(persist_directory: str = None):
    """Create ChromaDB client."""
    print("\n📊 Creating ChromaDB client...")

    try:
        if persist_directory:
            # Persistent client (saves to disk)
            client = chromadb.PersistentClient(path=persist_directory)
            print(f"✅ Client created (persistent: {persist_directory})\n")
        else:
            # In-memory client (faster, but data lost on exit)
            client = chromadb.Client()
            print("✅ Client created (in-memory)\n")

        return client

    except Exception as e:
        print(f"❌ Client creation failed: {e}")
        sys.exit(1)

def load_skill_data(filepath: str = "output/vue-chroma.json"):
    """Load the ChromaDB-format skill JSON."""
    path = Path(filepath)

    if not path.exists():
        print(f"❌ Skill file not found: {filepath}")
        print("Run '1_generate_skill.py' first!")
        sys.exit(1)

    with open(path) as f:
        return json.load(f)

def create_collection(client, collection_name: str, reset: bool = False):
    """Create ChromaDB collection."""
    print(f"📦 Creating collection: {collection_name}")

    try:
        # Check if collection exists
        existing_collections = [c.name for c in client.list_collections()]

        if collection_name in existing_collections:
            if reset:
                print(f"🗑️  Deleting existing collection...")
                client.delete_collection(collection_name)
            else:
                print(f"⚠️  Collection '{collection_name}' already exists")
                response = input("Delete and recreate? [y/N]: ")
                if response.lower() == "y":
                    client.delete_collection(collection_name)
                else:
                    print("Using existing collection")
                    return client.get_collection(collection_name)

        # Create collection
        collection = client.create_collection(
            name=collection_name,
            metadata={"description": "Skill Seekers documentation"}
        )
        print("✅ Collection created!\n")
        return collection

    except Exception as e:
        print(f"❌ Collection creation failed: {e}")
        sys.exit(1)

def upload_documents(collection, data: dict):
    """Add documents to collection."""
    total = len(data["documents"])

    print(f"📤 Adding {total} documents to collection...")

    try:
        # Add all documents in one batch
        collection.add(
            documents=data["documents"],
            metadatas=data["metadatas"],
            ids=data["ids"]
        )

        print(f"✅ Successfully added {total} documents to ChromaDB\n")

    except Exception as e:
        print(f"❌ Upload failed: {e}")
        sys.exit(1)

def verify_upload(collection):
    """Verify documents were uploaded correctly."""
    count = collection.count()
    print(f"🔍 Collection '{collection.name}' now contains {count} documents")

def main():
    parser = argparse.ArgumentParser(description="Upload skill to ChromaDB")
    parser.add_argument(
        "--persist",
        help="Persistent storage directory (e.g., ./chroma_db)"
    )
    parser.add_argument(
        "--file",
        default="output/vue-chroma.json",
        help="Path to ChromaDB JSON file"
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing collection before uploading"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("Step 2: Upload to ChromaDB")
    print("=" * 60)

    # Create client
    client = create_client(args.persist)

    # Load skill data
    data = load_skill_data(args.file)

    # Create collection
    collection = create_collection(client, data["collection_name"], args.reset)

    # Upload documents
    upload_documents(collection, data)

    # Verify
    verify_upload(collection)

    if args.persist:
        print(f"\n💾 Data saved to: {args.persist}")
        print("   Use --persist flag to load it next time")

    print("\n✅ Upload complete! Next step: python 3_query_example.py")

    if args.persist:
        print(f"   python 3_query_example.py --persist {args.persist}")

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/chroma-example/3_query_example.py`
```
#!/usr/bin/env python3
"""
Step 3: Query ChromaDB

This script demonstrates various query patterns with ChromaDB:
1. Semantic search
2. Metadata filtering
3. Distance scoring
4. Top-K results

Usage:
    # In-memory (if you used in-memory upload)
    python 3_query_example.py

    # Persistent (if you used --persist for upload)
    python 3_query_example.py --persist ./chroma_db
"""

import argparse
import sys

try:
    import chromadb
    from rich.console import Console
    from rich.table import Table
    from rich.panel import Panel
except ImportError:
    print("❌ Missing dependencies!")
    print("Install with: pip install chromadb rich")
    sys.exit(1)

console = Console()

def create_client(persist_directory: str = None):
    """Create ChromaDB client."""
    try:
        if persist_directory:
            return chromadb.PersistentClient(path=persist_directory)
        else:
            return chromadb.Client()
    except Exception as e:
        console.print(f"[red]❌ Client creation failed: {e}[/red]")
        sys.exit(1)

def get_collection(client, collection_name: str = "vue"):
    """Get collection from ChromaDB."""
    try:
        return client.get_collection(collection_name)
    except Exception as e:
        console.print(f"[red]❌ Collection not found: {e}[/red]")
        console.print("\n[yellow]Did you run 2_upload_to_chroma.py first?[/yellow]")
        sys.exit(1)

def semantic_search_example(collection):
    """Example 1: Basic Semantic Search."""
    console.print("\n" + "=" * 60)
    console.print("[bold cyan]Example 1: Semantic Search[/bold cyan]")
    console.print("=" * 60)

    query = "How do I create a Vue component?"

    console.print(f"\n[yellow]Query:[/yellow] {query}")

    try:
        results = collection.query(
            query_texts=[query],
            n_results=3
        )

        documents = results["documents"][0]
        metadatas = results["metadatas"][0]
        distances = results["distances"][0]

        if not documents:
            console.print("[red]No results found[/red]")
            return

        # Create results table
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("#", style="dim", width=3)
        table.add_column("Distance", style="cyan", width=10)
        table.add_column("Category", style="green")
        table.add_column("File", style="yellow")
        table.add_column("Preview", style="white")

        for i, (doc, meta, dist) in enumerate(zip(documents, metadatas, distances), 1):
            preview = doc[:80] + "..." if len(doc) > 80 else doc
            table.add_row(
                str(i),
                f"{dist:.3f}",
                meta.get("category", "N/A"),
                meta.get("file", "N/A"),
                preview
            )

        console.print(table)

        # Explain distance scores
        console.print("\n[dim]💡 Distance: Lower = more similar (< 0.5 = very relevant)[/dim]")

    except Exception as e:
        console.print(f"[red]Query failed: {e}[/red]")

def filtered_search_example(collection):
    """Example 2: Search with Metadata Filter."""
    console.print("\n" + "=" * 60)
    console.print("[bold cyan]Example 2: Filtered Search[/bold cyan]")
    console.print("=" * 60)

    query = "reactivity"
    category_filter = "api"

    console.print(f"\n[yellow]Query:[/yellow] {query}")
    console.print(f"[yellow]Filter:[/yellow] category = '{category_filter}'")

    try:
        results = collection.query(
            query_texts=[query],
            n_results=5,
            where={"category": category_filter}
        )

        documents = results["documents"][0]
        metadatas = results["metadatas"][0]
        distances = results["distances"][0]

        if not documents:
            console.print("[red]No results found[/red]")
            return

        console.print(f"\n[green]Found {len(documents)} results in '{category_filter}' category:[/green]\n")

        for i, (doc, meta, dist) in enumerate(zip(documents, metadatas, distances), 1):
            panel = Panel(
                f"[cyan]File:[/cyan] {meta.get('file', 'N/A')}\n"
                f"[cyan]Distance:[/cyan] {dist:.3f}\n\n"
                f"[white]{doc[:200]}...[/white]",
                title=f"Result {i}",
                border_style="green"
            )
            console.print(panel)

    except Exception as e:
        console.print(f"[red]Query failed: {e}[/red]")

def top_k_results_example(collection):
    """Example 3: Get More Results (Top-K)."""
    console.print("\n" + "=" * 60)
    console.print("[bold cyan]Example 3: Top-K Results[/bold cyan]")
    console.print("=" * 60)

    query = "state management"

    console.print(f"\n[yellow]Query:[/yellow] {query}")
    console.print(f"[yellow]K:[/yellow] 10 (top 10 results)")

    try:
        results = collection.query(
            query_texts=[query],
            n_results=10
        )

        documents = results["documents"][0]
        metadatas = results["metadatas"][0]
        distances = results["distances"][0]

        console.print(f"\n[green]Top 10 most relevant documents:[/green]\n")

        for i, (doc, meta, dist) in enumerate(zip(documents, metadatas, distances), 1):
            category = meta.get("category", "N/A")
            file = meta.get("file", "N/A")
            console.print(f"[bold]{i:2d}.[/bold] [{dist:.3f}] {category:10s} | {file}")

    except Exception as e:
        console.print(f"[red]Query failed: {e}[/red]")

def complex_filter_example(collection):
    """Example 4: Complex Metadata Filtering."""
    console.print("\n" + "=" * 60)
    console.print("[bold cyan]Example 4: Complex Filter (AND condition)[/bold cyan]")
    console.print("=" * 60)

    query = "guide"

    console.print(f"\n[yellow]Query:[/yellow] {query}")
    console.print(f"[yellow]Filter:[/yellow] category = 'guides' AND type = 'reference'")

    try:
        results = collection.query(
            query_texts=[query],
            n_results=5,
            where={
                "$and": [
                    {"category": "guides"},
                    {"type": "reference"}
                ]
            }
        )

        documents = results["documents"][0]
        metadatas = results["metadatas"][0]

        if not documents:
            console.print("[red]No results match both conditions[/red]")
            return

        console.print(f"\n[green]Found {len(documents)} documents matching both conditions:[/green]\n")

        for i, (doc, meta) in enumerate(zip(documents, metadatas), 1):
            console.print(f"[bold]{i}. {meta.get('file', 'N/A')}[/bold]")
            console.print(f"   Category: {meta.get('category')} | Type: {meta.get('type')}")
            console.print(f"   {doc[:100]}...\n")

    except Exception as e:
        console.print(f"[red]Query failed: {e}[/red]")

def get_statistics(collection):
    """Show collection statistics."""
    console.print("\n" + "=" * 60)
    console.print("[bold cyan]Collection Statistics[/bold cyan]")
    console.print("=" * 60)

    try:
        # Total count
        count = collection.count()
        console.print(f"\n[green]Total documents:[/green] {count}")

        # Sample metadata to show categories
        sample = collection.get(limit=count)
        metadatas = sample["metadatas"]

        # Count by category
        categories = {}
        for meta in metadatas:
            cat = meta.get("category", "unknown")
            categories[cat] = categories.get(cat, 0) + 1

        console.print(f"\n[green]Documents by category:[/green]")
        for cat, cnt in sorted(categories.items()):
            console.print(f"  • {cat}: {cnt}")

    except Exception as e:
        console.print(f"[red]Statistics failed: {e}[/red]")

def main():
    parser = argparse.ArgumentParser(description="Query ChromaDB examples")
    parser.add_argument(
        "--persist",
        help="Persistent storage directory (if you used --persist fo
```

### Core Architecture Module: `examples/cline-django-assistant/generate_clinerules.py`
```
#!/usr/bin/env python3
"""
Automation script to generate Cline rules from Django documentation.

Usage:
    python generate_clinerules.py --project /path/to/project
    python generate_clinerules.py --project . --with-mcp
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


def run_command(cmd: list[str], description: str) -> bool:
    """Run a shell command and return success status."""
    print(f"\n{'='*60}")
    print(f"STEP: {description}")
    print(f"{'='*60}")
    print(f"Running: {' '.join(cmd)}\n")

    result = subprocess.run(cmd, capture_output=True, text=True)

    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)

    if result.returncode != 0:
        print(f"❌ ERROR: {description} failed with code {result.returncode}")
        return False

    print(f"✅ SUCCESS: {description}")
    return True


def setup_mcp_server(project_path: Path) -> bool:
    """Set up MCP server configuration for Cline."""
    print(f"\n{'='*60}")
    print(f"STEP: Configuring MCP Server")
    print(f"{'='*60}")

    # Create MCP config
    mcp_config = {
        "mcpServers": {
            "skill-seekers": {
                "command": "python",
                "args": [
                    "-m",
                    "skill_seekers.mcp.server_fastmcp",
                    "--transport",
                    "stdio"
                ],
                "env": {}
            }
        }
    }

    # Save to project
    vscode_dir = project_path / ".vscode"
    vscode_dir.mkdir(exist_ok=True)

    mcp_config_file = vscode_dir / "mcp_config.json"
    with open(mcp_config_file, 'w') as f:
        json.dump(mcp_config, f, indent=2)

    print(f"✅ Created: {mcp_config_file}")
    print(f"\nTo activate in Cline:")
    print(f"1. Open Cline panel in VS Code")
    print(f"2. Settings → MCP Servers → Load Configuration")
    print(f"3. Select: {mcp_config_file}")
    print(f"4. Reload VS Code window")

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Generate Cline rules from Django documentation"
    )
    parser.add_argument(
        "--project",
        type=str,
        default=".",
        help="Path to your project directory (default: current directory)",
    )
    parser.add_argument(
        "--skip-scrape",
        action="store_true",
        help="Skip scraping step (use existing output/django)",
    )
    parser.add_argument(
        "--with-mcp",
        action="store_true",
        help="Set up MCP server configuration",
    )
    parser.add_argument(
        "--modular",
        action="store_true",
        help="Create modular rules files (.clinerules.models, .clinerules.views, etc.)",
    )
    args = parser.parse_args()

    project_path = Path(args.project).resolve()
    output_dir = Path("output/django")

    print("=" * 60)
    print("Cline Rules Generator for Django")
    print("=" * 60)
    print(f"Project: {project_path}")
    print(f"Modular rules: {args.modular}")
    print(f"MCP integration: {args.with_mcp}")
    print("=" * 60)

    # Step 1: Scrape Django documentation (unless skipped)
    if not args.skip_scrape:
        if not run_command(
            [
                "skill-seekers",
                "scrape",
                "--config",
                "configs/django.json",
            ],
            "Scraping Django documentation",
        ):
            return 1
    else:
        print(f"\n⏭️  SKIPPED: Using existing {output_dir}")

        if not output_dir.exists():
            print(f"❌ ERROR: {output_dir} does not exist!")
            print(f"Run without --skip-scrape to generate documentation first.")
            return 1

    # Step 2: Package for Cline
    if not run_command(
        [
            "skill-seekers",
            "package",
            str(output_dir),
            "--target",
            "markdown",
        ],
        "Packaging for Cline",
    ):
        return 1

    # Step 3: Copy rules to project
    print(f"\n{'='*60}")
    print(f"STEP: Copying rules to project")
    print(f"{'='*60}")

    markdown_output = output_dir.parent / "django-markdown"
    source_skill = markdown_output / "SKILL.md"

    if not source_skill.exists():
        print(f"❌ ERROR: {source_skill} does not exist!")
        return 1

    if args.modular:
        # Split into modular files
        print("Creating modular rules files...")

        with open(source_skill, 'r') as f:
            content = f.read()

        # Split by major sections
        sections = content.split('\n## ')

        # Core rules (first part)
        core_rules = project_path / ".clinerules"
        with open(core_rules, 'w') as f:
            f.write(sections[0])
        print(f"✅ Created: {core_rules}")

        # Try to extract specific sections (simplified)
        # In a real implementation, this would be more sophisticated
        models_content = next((s for s in sections if 'Model' in s), None)
        if models_content:
            models_rules = project_path / ".clinerules.models"
            with open(models_rules, 'w') as f:
                f.write('## ' + models_content)
            print(f"✅ Created: {models_rules}")

        views_content = next((s for s in sections if 'View' in s), None)
        if views_content:
            views_rules = project_path / ".clinerules.views"
            with open(views_rules, 'w') as f:
                f.write('## ' + views_content)
            print(f"✅ Created: {views_rules}")

    else:
        # Single file
        dest_file = project_path / ".clinerules"
        shutil.copy(source_skill, dest_file)
        print(f"✅ Copied: {dest_file}")

    # Step 4: Set up MCP server (optional)
    if args.with_mcp:
        if not setup_mcp_server(project_path):
            print("⚠️  WARNING: MCP setup failed, but rules were created successfully")

    print(f"\n{'='*60}")
    print(f"✅ SUCCESS: Cline rules generated!")
    print(f"{'='*60}")
    print(f"\nNext steps:")
    print(f"1. Open project in VS Code: code {project_path}")
    print(f"2. Install Cline extension (if not already)")
    print(f"3. Reload VS Code window: Cmd+Shift+P → 'Reload Window'")
    print(f"4. Open Cline panel (sidebar icon)")
    print(f"5. Start autonomous task:")
    print(f"   'Create a Django blog app with posts and comments'")

    if args.with_mcp:
        print(f"\n📡 MCP Server configured at:")
        print(f"   {project_path / '.vscode' / 'mcp_config.json'}")
        print(f"   Load in Cline: Settings → MCP Servers → Load Configuration")

    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `examples/continue-dev-universal/context_server.py`
```
#!/usr/bin/env python3
"""
HTTP Context Provider Server for Continue.dev

Serves framework documentation as Continue.dev context items.
Supports multiple frameworks from Skill Seekers output.

Usage:
    python context_server.py
    python context_server.py --host 0.0.0.0 --port 8765
"""

import argparse
from pathlib import Path
from functools import lru_cache
from typing import Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn


app = FastAPI(
    title="Skill Seekers Context Server",
    description="HTTP context provider for Continue.dev",
    version="1.0.0"
)

# Add CORS middleware for browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=100)
def load_framework_docs(framework: str) -> str:
    """
    Load framework documentation from Skill Seekers output.

    Args:
        framework: Framework name (vue, react, django, etc.)

    Returns:
        Documentation content as string

    Raises:
        FileNotFoundError: If documentation not found
    """
    # Try multiple possible locations
    possible_paths = [
        Path(f"output/{framework}-markdown/SKILL.md"),
        Path(f"../../output/{framework}-markdown/SKILL.md"),
        Path(f"../../../output/{framework}-markdown/SKILL.md"),
    ]

    for doc_path in possible_paths:
        if doc_path.exists():
            with open(doc_path, 'r', encoding='utf-8') as f:
                return f.read()

    raise FileNotFoundError(
        f"Documentation not found for framework: {framework}\n"
        f"Tried paths: {[str(p) for p in possible_paths]}\n"
        f"Run: skill-seekers create --config configs/{framework}.json"
    )


@app.get("/")
async def root():
    """Root endpoint with server information."""
    return {
        "name": "Skill Seekers Context Server",
        "description": "HTTP context provider for Continue.dev",
        "version": "1.0.0",
        "endpoints": {
            "/docs/{framework}": "Get framework documentation",
            "/frameworks": "List available frameworks",
            "/health": "Health check"
        }
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/frameworks")
async def list_frameworks() -> Dict[str, List[str]]:
    """
    List available frameworks.

    Returns:
        Dictionary with available and missing frameworks
    """
    # Check common framework locations
    output_dir = Path("output")
    if not output_dir.exists():
        output_dir = Path("../../output")
    if not output_dir.exists():
        output_dir = Path("../../../output")

    if not output_dir.exists():
        return {
            "available": [],
            "message": "No output directory found. Run skill-seekers to generate documentation."
        }

    # Find all *-markdown directories
    available = []
    for item in output_dir.glob("*-markdown"):
        framework = item.name.replace("-markdown", "")
        skill_file = item / "SKILL.md"
        if skill_file.exists():
            available.append(framework)

    return {
        "available": available,
        "count": len(available),
        "usage": "GET /docs/{framework} to access documentation"
    }


@app.get("/docs/{framework}")
async def get_framework_docs(framework: str, query: str = None) -> JSONResponse:
    """
    Get framework documentation as Continue.dev context items.

    Args:
        framework: Framework name (vue, react, django, etc.)
        query: Optional search query for filtering (future feature)

    Returns:
        JSON response with contextItems array for Continue.dev
    """
    try:
        # Load documentation (cached)
        docs = load_framework_docs(framework)

        # TODO: Implement query filtering if provided
        if query:
            # Filter docs based on query (simplified)
            # In production, use better search (regex, fuzzy matching, etc.)
            pass

        # Return in Continue.dev format
        return JSONResponse({
            "contextItems": [
                {
                    "name": f"{framework.title()} Documentation",
                    "description": f"Complete {framework} framework expert knowledge",
                    "content": docs
                }
            ]
        })

    except FileNotFoundError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error loading documentation: {str(e)}"
        )


@app.get("/project/conventions")
async def get_project_conventions() -> JSONResponse:
    """
    Get project-specific conventions.

    Returns:
        JSON response with project conventions
    """
    # Load project conventions if they exist
    conventions_path = Path(".project-conventions.md")

    if conventions_path.exists():
        with open(conventions_path, 'r') as f:
            content = f.read()
    else:
        # Default conventions
        content = """
# Project Conventions

## General
- Use TypeScript for all new code
- Follow framework-specific best practices
- Write tests for all features

## Git Workflow
- Feature branch workflow
- Squash commits before merge
- Descriptive commit messages

## Code Style
- Use prettier for formatting
- ESLint for linting
- Follow team conventions
"""

    return JSONResponse({
        "contextItems": [
            {
                "name": "Project Conventions",
                "description": "Team coding standards and conventions",
                "content": content
            }
        ]
    })


def main():
    parser = argparse.ArgumentParser(
        description="HTTP Context Provider Server for Continue.dev"
    )
    parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help="Host to bind to (default: 127.0.0.1, use 0.0.0.0 for all interfaces)"
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8765,
        help="Port to bind to (default: 8765)"
    )
    parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload on code changes (development)"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("Skill Seekers Context Server for Continue.dev")
    print("=" * 60)
    print(f"Server: http://{args.host}:{args.port}")
    print(f"Endpoints:")
    print(f"  - GET /                      # Server info")
    print(f"  - GET /health                # Health check")
    print(f"  - GET /frameworks            # List available frameworks")
    print(f"  - GET /docs/{{framework}}     # Get framework docs")
    print(f"  - GET /project/conventions   # Get project conventions")
    print("=" * 60)
    print(f"\nConfigure Continue.dev:")
    print(f"""
{{
  "contextProviders": [
    {{
      "name": "http",
      "params": {{
        "url": "http://{args.host}:{args.port}/docs/vue",
        "title": "vue-docs",
        "displayTitle": "Vue.js Documentation"
      }}
    }}
  ]
}}
""")
    print("=" * 60)
    print("\nPress Ctrl+C to stop\n")

    # Run server
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level="info"
    )


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #425** (2026-07-16): **FactoryDetector matches 'get' as a substring: every getter inflates Factory confidence (plain POJO -> Factory 0.90); Singleton unreachable in Java; dependency graph emits 0 edges**
  *Symptoms*: ## Summary  `FactoryDetector` matches its keywords as **substrings**, so **every Java class with a getter is reported as a `Factory` pattern** — and because `"getInstance"` contains `"get"`, a canonical Singleton is *misclassified* as `Factory` rather than detected as `Singleton`.  Separately, `SingletonDetector.detect_deep()` is **structurally unreachable for Java/C#/C++**, so it can never correct the misclassification.  Net effect: on Java input, GoF detection has very low precision, and `Singleton` never fires.  Verified against **v3.8.0 (current PyPI release)** and the **`development` branch** (both identical in the relevant code).  ### Why this is not fixable by tuning confidence thresholds  This is likely the **root cause** behind the over-detection already reported in **#240** (905 patterns across 173 files; Strategy ×206; Decorator ×225) and **#362** (9238 patterns detected). #240 was addressed by *raising confidence thresholds* — but that cannot fix this class of false positive:  ```java public class Person {                       // plain data class, zero patterns     private String name; private int age;     public String getName() { return name; }     public void setName(String n) { this.name = n; }     public int getAge() { return age; } } ``` **Actual: `Factory(0.80)`** — at/above the *critical* (0.8) tier.  Worse: **confidence scales monotonically with the number of getters**, because each getter matches `"get"` and adds to the score:  | plain data class with… 
  **Post-Mortem & Fix Analysis**:
  > Triage confirmed — all three claims verified against `pattern_recognizer.py`: (1) `factory_method_names` includes bare `"get"` with substring matching (:567-571), and `detect_deep` adds +0.3 per matching method +0.2 for ≥2, reproducing the reported 0.6/0.8/0.9 getter scaling; (2) the Singleton constructor check only matches `__new__/__init__/constructor`, so Java class-named constructors are unreachable and the instance-field check is a commented-out future enhancement — 0.4 < 0.5 threshold, exactly as reported; (3) the dependency-graph edge fix in v3.8.0 (dotted→slash suffix resolution) evidently doesn't cover your case, and the suggested warn-on-0-edges is not implemented. Your proposed fixes (drop `"get"", word-boundary matching, class-named constructors, instance-field check) all look right — a PR would be very welcome!
  > Fixed in #429 (merged) — and thank you @saitrsh for an outstanding report. 🙏 Every claim reproduced *exactly* as written: POJO → `Factory(0.80)`, getter-count confidence scaling, `Config.java` → `Factory(0.60)`, the 0.4 Singleton cap, and your "why the test suite doesn't catch this" section turned out even more right than you knew — fixing the Factory bug *broke* `test_analyze_singleton_code`, which had been passing **only because** the substring bug emitted a bogus Factory for its genuine Python singleton.  What shipped: - **Factory**: creation verbs (`create/make/build/new/construct`) match as prefixes at a word boundary; `get*/set*/is*/has*` excluded outright — your suggested fix #1, as specified. - **Singleton**: class-named constructors recognized (your fix #2), plus an overridden `__new__` now counts by itself. Canonical `Config.java` → `Singleton(0.70)`. Your fix #4 (precedence) became unnecessary — the `getInstance` conflict resolves naturally once `get` stops matching. - **Re

- **Issue #412** (2026-07-16): **Docs: documented `docker pull` images aren't pullable + image name is inconsistent across docs**
  *Symptoms*: ## Summary  The `docker pull` commands in the docs don't work for an anonymous user, and the image name is written three different (inconsistent) ways across the docs. A user following any of the install/deployment guides cannot actually pull the image.  ## What I verified  The Docker Publish workflow **succeeds** and pushes two images — `${DOCKER_USERNAME}/skill-seekers` and `${DOCKER_USERNAME}/skill-seekers-mcp` (see `.github/workflows/docker-publish.yml` matrix). But none of the documented tags are anonymously pullable:  - `https://hub.docker.com/v2/repositories/skillseekers/skill-seekers/` → **HTTP 404** - Registry manifest with a valid **anonymous** pull token → **HTTP 401** for `3.8.0`, `3.7.0`, **and** `latest`  A 404 on the Hub API plus a 401 on the registry (even with an anon token) across every tag is the signature of a **private** repository — i.e. the published repo is private, or it lives under a `DOCKER_USERNAME` namespace different from the documented `skillseekers`. Either way, the documented `docker pull` fails for end users.  This is **not new to v3.8.0** — `3.7.0` and `latest` behave identically, so it's a long-standing state of the publish/visibility setup.  ## Inconsistent image names in the docs  Three different names are used, only one of which matches the workflow's image (`skill-seekers`):  | File | Line | Documented reference | |------|------|----------------------| | `docs/getting-started/01-installation.md` | 232 / 238 | `skillseekers/skill-seekers
  **Post-Mortem & Fix Analysis**:
  > The image reference should have one source of truth shared by the publish workflow and docs, ideally a repository variable or generated snippet, so namespace changes cannot drift across four guides. CI can authenticate only for push, then run an anonymous manifest pull for every documented tag after publication; that catches a private repository as well as a wrong name. The same check should cover the MCP image and pin examples to a release tag while explaining what `latest` means. 

- **Issue #222** (2025-12-30): **fix: Missing py.typed file in package_data**
  *Symptoms*: ## 🐛 Issue Description  The `pyproject.toml` declares `py.typed` in package_data, but the file doesn't exist in the repository:  ```toml [tool.setuptools.package-data] skill_seekers = ["py.typed"] ```  **File Status:** ❌ `src/skill_seekers/py.typed` does not exist  ## 📊 Impact  - **Severity:** LOW - **Affects:** Type checker tools (mypy, pyright, pylance) - **User Impact:** Minimal - only affects developers using type checkers - **Current Behavior:** Warning during package build (non-critical)  ## ✅ Solution Options  ### Option 1: Create the file (Recommended) Enable PEP 561 type checking support: ```bash touch src/skill_seekers/py.typed git add src/skill_seekers/py.typed git commit -m "feat: Add py.typed for PEP 561 type checking support" ```  **Benefits:** - Enables type checkers to use inline type hints - Follows Python typing best practices - Improves IDE autocomplete/intellisense  ### Option 2: Remove from package_data If type checking support is not needed: ```toml # Remove this section from pyproject.toml: [tool.setuptools.package-data] skill_seekers = ["py.typed"] ```  ## 🔍 Discovery  Found during comprehensive packaging audit after PR #221. See audit report for details.  ## 📋 Related  - PR #221: Fixed missing `skill_seekers.cli.adaptors` package - Post-v2.5.1 packaging improvements  ## 💡 Recommendation  **Create the py.typed file** (Option 1) to enable proper type checking support for the package. This is a one-line fix and follows Python packaging best practice

- **Issue #169** (2026-07-17): **fix: Reduce token bloat - Stop scraping closed issues and unnecessary metadata**
  *Symptoms*: ## Community Feedback  > "I'm also concerned that it's scraping things that don't need to be scraped. 'GitHub Issues (open/closed, labels, milestones)'. Why are you scraping anything but open issues? I could see maybe scraping some closed issues that are recent (and prior to a release that hasn't arrived), but I'm not sure a lot of these things are relevant. **People have token usage concerns.**"  ## The Problem  **Current behavior** (`cli/github_scraper.py:403`): ```python # Fetch recent issues (open + closed) issues = self.repo.get_issues(state='all', sort='updated', direction='desc')  # Default: max_issues = 100 ```  **What gets scraped:** - ✅ Open issues (relevant - active bugs/features) - ❌ **Closed issues** (often irrelevant historical noise) - ❌ Issue body (500 chars each × 100 issues = 50KB text) - ❌ All labels (metadata bloat) - ❌ All milestones (often outdated) - ❌ Created/updated/closed timestamps (unnecessary)  **Example:** React repo has 12,000+ closed issues. Why include these in a skill?  ## Why This Is Critical: Token Economy  ### The Token Problem  Users **pay per token** when using Claude: - Claude Pro: 200K context window, but costs more for larger skills - API usage: Direct token costs ($$$) - Sonnet: ~$3 per million input tokens  **Bloated skills = higher costs for users.**  ### Current Token Waste  Example: Scraping `facebook/react`: ``` 100 issues scraped: - 100 titles × 50 chars = 5,000 chars - 100 bodies × 500 chars = 50,000 chars - 100 × labels/miles
  **Post-Mortem & Fix Analysis**:
  > I like the idea of `Option 3: Configurable (Most Flexible)`. It would also be really useful to choose how the issues are sorted. For example, if I set a limit on the number of issues, I would like to sort them with `sort:comments-desc` so more active issues are included first.

- **Issue #115** (2025-10-20): **[H1.2] Investigate Issue #7: Laravel scraping issue**
  *Symptoms*: **Category:** 📚 Community Response | **Time:** 1-2 hours  Debug why Laravel docs don't scrape properly. **See:** FLEXIBLE_ROADMAP.md - Task H1.2
  **Post-Mortem & Fix Analysis**:
  > ## ✅ Task H1.2 Complete!  **Status:** Done  **What Was Accomplished:**  ### 1. Investigated and Fixed Issue #7 ✅  **Problem Identified:** - Django config using wrong selector (div.document doesn't exist) - Laravel config didn't exist at all - Astro config using homepage URL without proper structure - Tailwind config using wrong selector (article doesn't exist)  ### 2. Fixed All Broken Configs ✅  **Django (configs/django.json):** - ❌ Was using: `div.document` (selector doesn't exist) - ✅ Now using: `article` (extracts 6,468 chars of content) - Verified on: https://docs.djangoproject.com/en/stable/  **Laravel (configs/laravel.json) - NEW!:** - ✅ Created complete Laravel 9.x config from scratch - ✅ Selector: `#main-content` (extracts 16,131 chars) - ✅ Base URL: https://laravel.com/docs/9.x/ - ✅ Includes: 8 start_urls, proper categories - ✅ max_pages: 500  **Astro (configs/astro.json):** - ❌ Was using: homepage URL (no article element) - ✅ Now using: `/en/getting-started/` with article sel

- **Issue #98** (2025-10-22): **[F1.6] Fix package path output bug**
  *Symptoms*: **Category:** ⚡ Performance & Reliability | **Time:** 30 min  Fix incorrect path in doc_scraper.py output. **Location:** cli/doc_scraper.py:789 | **See:** FLEXIBLE_ROADMAP.md - Task F1.6
  **Post-Mortem & Fix Analysis**:
  > ✅ **This issue has been fixed!**  **Fixed in:** Commit 581dbc7 (Oct 22, 2025) - "Fix CLI path references in Python code"  **What was fixed:** All path references in `cli/doc_scraper.py` now correctly use `cli/` prefix: - Line 1153: `enhance_cmd = ['python3', 'cli/enhance_skill.py', ...]` - Line 1174: `enhance_cmd = ['python3', 'cli/enhance_skill_local.py', ...]` - Line 1183: Print statement shows correct path - Line 1189: Print statement shows correct path  **Related fixes:** The entire codebase was updated to use correct `cli/` prefixes: - cli/doc_scraper.py: 9 references fixed - cli/enhance_skill_local.py: 6 references fixed - cli/enhance_skill.py: 5 references fixed - cli/package_skill.py: 4 references fixed - cli/estimate_pages.py: 3 references fixed  **Verification:** ```bash grep "package_skill.py" cli/doc_scraper.py # Output shows: python3 cli/package_skill.py ✅ ```  **Related commits:** - 581dbc7 - Fix CLI path references in Python code - 66719cd - Fix CLI path references in do

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

### Incident Patch 1: `5b5d8dfc` (2026-09-30)
**Commit Message**: Merge main (release gate fix) into development

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `.github/workflows/release.yml` (modified, +4/-3)
```diff
@@ -33,13 +33,14 @@ jobs:
         python -m pip install --upgrade pip
         pip install -r requirements.txt
         if [ -f skill_seeker_mcp/requirements.txt ]; then pip install -r skill_seeker_mcp/requirements.txt; fi
-        # Install package in editable mode for tests (required for src/ layout)
-        pip install -e .
+        # Install package in editable mode for tests (required for src/ layout);
+        # the [ui] extra (fastapi) is needed by the Seeker HUD API tests, matching tests.yml
+        pip install -e ".[ui]"
 
     - name: Run tests
       timeout-minutes: 30
       run: |
-        pip install pytest-timeout
+        pip install pytest-timeout psutil
         python -m pytest tests/ -v \
           -m "not slow and not integration and not e2e and not network and not serial and not mcp_only" \
           --timeout=120
```

---

### Incident Patch 2: `50ffc380` (2026-09-30)
**Commit Message**: release: 3.10.0 — Seeker HUD (beta), export-workflow fix

- Bump version 3.10.0.dev0 → 3.10.0 (pyproject, _version fallbacks, uv.lock, ui package)
- Promote CHANGELOG [Unreleased] → [3.10.0] - 2026-09-30; add Seeker HUD (beta) headline,
  beta notice, #456 doctor console-script fix, #470/#471/#450 entries, merge duplicate Fixed
- Mark the Seeker HUD as beta: sidebar pill, launcher banner, docs/guides/WEB_UI.md, AGENTS.md
- Fix .github/workflows/vector-db-export.yml: inline python3 -c blocks were indented inside
  the string and raised IndentationError on every scheduled run

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `.github/workflows/vector-db-export.yml` (modified, +15/-15)
```diff
@@ -107,12 +107,12 @@ jobs:
 
           # Use adaptor directly via CLI
           python3 -c "
-          from pathlib import Path
-          from skill_seekers.cli.adaptors import get_adaptor
-          adaptor = get_adaptor('$target')
-          package_path = adaptor.package(Path('$SKILL_DIR'), Path('output'))
-          print(f'Exported to {package_path}')
-          "
+        from pathlib import Path
+        from skill_seekers.cli.adaptors import get_adaptor
+        adaptor = get_adaptor('$target')
+        package_path = adaptor.package(Path('$SKILL_DIR'), Path('output'))
+        print(f'Exported to {package_path}')
+        "
 
           if [ $? -eq 0 ]; then
             echo "✅ $target export complete"
@@ -130,15 +130,15 @@ jobs:
           echo "📊 Generating quality metrics..."
 
           python3 -c "
-          from pathlib import Path
-          from skill_seekers.cli.quality_metrics import QualityAnalyzer
-          analyzer = QualityAnalyzer(Path('$SKILL_DIR'))
-          report = analyzer.generate_report()
-          formatted = analyzer.format_report(report)
-          print(formatted)
-          with open('quality_report_${SKILL_NAME}.txt', 'w') as f:
-              f.write(formatted)
-          "
+        from pathlib import Path
+        from skill_seekers.cli.quality_metrics import QualityAnalyzer
+        analyzer = QualityAnalyzer(Path('$SKILL_DIR'))
+        report = analyzer.generate_report()
+        formatted = analyzer.format_report(report)
+        print(formatted)
+        with open('quality_report_${SKILL_NAME}.txt', 'w') as f:
+            f.write(formatted)
+        "
         fi
       continue-on-error: true
 
```

**File**: `AGENTS.md` (modified, +3/-1)
```diff
@@ -182,7 +182,9 @@ docs/                        # Documentation (guides, integrations, architecture
 
 **Supported platforms (21):** claude, gemini, openai, minimax, opencode, kimi, deepseek, qwen, openrouter, together, fireworks, markdown, langchain, llama-index, haystack, weaviate, chroma, faiss, qdrant, pinecone.
 
-## Web UI (Seeker HUD)
+## Web UI (Seeker HUD) — beta
+
+**Status: beta** (since 3.10.0). Screens, API routes and `~/.skill-seekers/ui/` state may change between minor releases; the CLI and MCP server are unaffected.
 
 Local web app: React 19 + Vite + Tailwind/shadcn frontend in `ui/`, FastAPI backend in `src/skill_seekers/web/`.
 
```

**File**: `CHANGELOG.md` (modified, +11/-4)
```diff
@@ -5,14 +5,17 @@ All notable changes to Skill Seeker will be documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
-## [Unreleased]
+## [3.10.0] - 2026-09-30
 
-_Development version: 3.10.0.dev0_
+**Theme:** Seeker HUD (beta) — a local web UI for the whole toolchain — plus a path-traversal security fix, three machine-readable CLI commands, an opt-in SQLite skill search index, MiniMax video input, and PDF vector-figure extraction.
+
+> **The Seeker HUD web UI is in beta.** It ships in this release for early feedback: screens, `/api/*` routes, and the UI state stored under `~/.skill-seekers/ui/` may change between minor releases without a deprecation period. The CLI, the MCP server, and every existing platform adaptor are unaffected. Please report HUD issues on GitHub.
 
 ### Security
 - **Path traversal in the `fetch_config` MCP tool (CWE-22)** (#462 reported by @Harmenszoon, fixed in PR #464 by @emecii) — the git-URL mode passed the raw `config_name` argument into `cache_dir / f"temp_{name}"`, and `clone_or_pull` both deletes that path (on `refresh` or a failed pull) and clones attacker-chosen content into it, so a crafted name could delete or overwrite directories outside the cache. The shared clone boundary now validates the cache name, and `fetch_config` validates `config_name` once for all three modes in both MCP servers (the named-source and API modes wrote `<destination>/<name>.json` from the raw name too). All name checks now go through one allowlist (`services/path_safety.validate_path_segment`: leading letter or digit, then letters, digits, `.`, `_`, `-`), which also rejects NUL bytes, whitespace and dot-files such as `.git`; the workflow, config-publisher and marketplace validators delegate to it. A failed pull on a cached clone now falls through to a fresh clone instead of deleting the cache and reporting an error.
 
 ### Added
+- **Seeker HUD (beta) — a local web app for the whole toolchain.** `pip install "skill-seekers[ui]"` then `skill-seekers ui` opens a React + FastAPI interface on `http://127.0.0.1:8770` (loopback only) with Overview, Create, Skills, Configs, Workflows, Analyze, Environment, and job-history screens; every long-running action runs as a streamed job. The built frontend is bundled into the wheel, so no Node toolchain is needed to use it. The beta status is shown in the sidebar and the launcher banner and documented in `docs/guides/WEB_UI.md`; the HUD-specific entries below describe the screens in detail.
 - **MiniMax-M3 video input and thinking modes** (#468 by @octo-patch) — `AgentClient.call_with_video()` sends a local MP4/AVI/MOV/MKV clip as an OpenAI-compatible `video_url` part (MiniMax-M3 only, 50 MB inline cap enforced before the request), and `MINIMAX_THINKING=adaptive|disabled` (or a `thinking=` call argument) is carried in the request body. Both are registry-driven — `supports_video`, `video_models`, `video_max_bytes`, `thinking_modes`, `thinking_env` on the provider entry — so `_call_api` still never branches on a provider name. The thinking mode is validated once at client construction; under the Anthropic protocol it is ignored with a warning instead of silently dropped. No built-in pipeline calls the video path yet.
 - **Opt-in SQLite search index for generated skills** (#393, PR #463 by @emecii) — `skill-seekers create <source> --index` (or `"index": true` in a config file) writes `scripts/index.db` (FTS5 with BM25, LIKE-style fallback where FTS5 is unavailable) and a stdlib-only `scripts/search.py` that returns ranked `file#anchor` pointers, and appends a search-first block to SKILL.md. Off by default, Markdown untouched, zero new dependencies; the Claude packager already ships `scripts/`. Sections are split at headings outside fenced code blocks, `index.md` table-of-contents pages are skipped, anchors follow GitHub's rules, query tokens 
```

**File**: `docs/guides/WEB_UI.md` (modified, +2/-0)
```diff
@@ -1,5 +1,7 @@
 # Seeker HUD
 
+> **Beta.** The HUD ships with 3.10.0 for early feedback. Screens, `/api/*` routes, and the UI state stored under `~/.skill-seekers/ui/` may change between minor releases without a deprecation period. The CLI and MCP server are stable and unaffected; please report HUD issues on GitHub.
+
 The HUD is a local React/FastAPI interface to Skill Seekers. Install the API dependencies and build the frontend before launching from a checkout:
 
 ```bash
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "skill-seekers"
-version = "3.10.0.dev0"
+version = "3.10.0"
 description = "Convert documentation websites, GitHub repositories, and PDFs into Claude AI skills. International support with Chinese (简体中文) documentation."
 readme = "README.md"
 requires-python = ">=3.10"
```

---

### Incident Patch 3: `c413bc30` (2026-09-20)
**Commit Message**: fix(enhance): honour the configured default enhance level; correct enhance docs (#473)

Follow-up from triaging #465 (closed: its reported error only exists on 3.4.0 and earlier). The "Default level" set with `skill-seekers config` had been ignored by `create` since the unified command (Feb 2026); `create` now resolves CLI flag → config-file level → user default → shipped default (2), side-effect free. Test suite isolates the developer's real user config. Docstring and docs corrected; troubleshooting entry for the ≤3.4.0 error.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -44,6 +44,8 @@ _Development version: 3.10.0.dev0_
 - Seeker HUD: opening a skill or config from any table, card, or job output now navigates to its routed page instead of opening a drawer; `/mcp` redirects to `/environment`, where the MCP tools catalogue is a collapsible panel rather than its own screen.
 
 ### Fixed
+- **The default enhancement level set with `skill-seekers config` is honoured again** — `create` resolves the level as CLI `--enhance-level` → config-file `enhancement.level` → the user's `ai_enhancement.default_enhance_level` → the shipped default (2). It had been consumed by the old dispatcher until the unified `create` command (Feb 2026) and silently ignored since, while `skill-seekers config` kept displaying it. The fresh default is now 2 everywhere (it was 1 in the config manager and 2 on the CLI). The read is side-effect free: a plain `create` still never creates a config directory.
+- **Docs** — `HOW_TO_GUIDES.md` no longer tells you to run `skill-seekers-enhance` on a single `.md` file (it takes the skill directory), and `TROUBLESHOOTING.md` explains the `unrecognized arguments: --enhance-level` error seen on 3.4.0 and earlier (raised in #465; the call path was removed in 3.5.0 — upgrade). The `arguments/enhance.py` docstring no longer claims `enhance_skill_local.py` builds from the shared table; that worker has its own narrower parser.
 - Seeker HUD: installed-plugin scan no longer reads `~/.claude/plugins/{marketplaces,repos,data}/` (catalogue clones), which over-reported skills from plugins that were never installed.
 - Seeker HUD: MCP HTTP transport is reported live only when /health identifies Skill Seekers' own server (was any listener on the port); packaging an external skill no longer writes the archive into the plugin cache.
 - Seeker HUD: a `SKILL.md` nested inside a skill directory (e.g. vercel's `ai-sdk/upstream/`) no longer shows up as a separate skill; pressing Enter in the top-bar search no longer triggers the opened drawer's first action; the Seeker MCP status cards no longer overflow; the web API test fixture now owns its own `JobManager`, so test jobs stop leaking into `~/.skill-seekers/ui/`.
```

**File**: `docs/TROUBLESHOOTING.md` (modified, +17/-0)
```diff
@@ -445,6 +445,23 @@ curl https://api.anthropic.com/v1/messages \
   -d '{"model":"claude-sonnet-4.5","max_tokens":1024,"messages":[{"role":"user","content":"Hello"}]}'
 ```
 
+### Issue: `skill-seekers-enhance: error: unrecognized arguments: --enhance-level`
+
+**Symptoms:** `skill-seekers create <url>` finishes with `⚠ Enhancement failed, but skill was still built` and the log shows `skill-seekers-enhance: error: unrecognized arguments: --enhance-level 2`. The skill is generated but `SKILL.md` is not AI-enhanced.
+
+**Cause:** Skill Seekers **3.4.0 and earlier** shelled out from the scrapers to `skill-seekers-enhance` with a flag that command never accepted. Since 3.5.0 enhancement runs inside `create` and this call no longer exists.
+
+**Solution:** upgrade.
+
+```bash
+pip install --upgrade skill-seekers
+skill-seekers doctor   # confirms the installed version
+```
+
+On 3.4.0 or earlier, run the enhancement by hand as a workaround: `skill-seekers-enhance output/<name>/` (without `--enhance-level`).
+
+---
+
 ### Issue: Enhancement Hangs/Timeouts
 
 **Symptoms:**
```

**File**: `docs/features/HOW_TO_GUIDES.md` (modified, +3/-3)
```diff
@@ -390,13 +390,13 @@ skill-seekers create tests/ --enhance-level 3
 skill-seekers create tests/ --enhance-level 0
 ```
 
-**Issue: Want to skip enhancement for specific guides**
+**Issue: Want to generate guides without AI, then enhance later**
 ```bash
 # Generate basic guides first
 skill-seekers-how-to-guides examples.json --ai-mode none
 
-# Then enhance only specific guides manually
-skill-seekers-enhance output/codebase/tutorials/user_management.md
+# Then enhance the skill (enhance works on the skill directory, not on a single guide)
+skill-seekers enhance output/codebase/
 ```
 
 ---
```

**File**: `src/skill_seekers/cli/arguments/create.py` (modified, +3/-2)
```diff
@@ -60,10 +60,11 @@
         "kwargs": {
             "type": int,
             "choices": [0, 1, 2, 3],
-            "default": 2,
+            "default": None,  # None = your configured default (skill-seekers config), else 2
             "help": (
                 "AI enhancement level (auto-detects API vs LOCAL mode): "
-                "0=disabled, 1=SKILL.md only, 2=+architecture/config (default), 3=full enhancement. "
+                "0=disabled, 1=SKILL.md only, 2=+architecture/config, 3=full enhancement. "
+                "Default: the level set with `skill-seekers config` (2 unless changed). "
                 "Mode selection: uses API if API key is set (ANTHROPIC_API_KEY, MOONSHOT_API_KEY, etc.), otherwise LOCAL (AI coding agent)"
             ),
             "metavar": "LEVEL",
```

**File**: `src/skill_seekers/cli/arguments/enhance.py` (modified, +8/-3)
```diff
@@ -1,8 +1,13 @@
 """Enhance command argument definitions.
 
-This module defines ALL arguments for the enhance command in ONE place.
-Both enhance_command.py (dispatcher), enhance_skill_local.py (standalone),
-and parsers/enhance_parser.py (unified CLI) import and use these definitions.
+This module defines ALL arguments for the ``enhance`` command in ONE place.
+Both enhance_command.py (``skill-seekers-enhance`` / dispatcher) and
+parsers/enhance_parser.py (unified CLI) build their parser from it.
+
+enhance_skill_local.py is NOT built from this table: it is the LOCAL-agent
+worker the MCP server and the install pipeline spawn as a subprocess with a
+deliberately narrower, hand-built parser. Do not assume a flag added here
+reaches it.
 """
 
 import argparse
```

---

### Incident Patch 4: `2bcab0d6` (2026-09-20)
**Commit Message**: fix(security): validate Git config cache names (#464)

Fixes CWE-22 path traversal in the `fetch_config` MCP tool (#462, reported by @Harmenszoon): the git-URL mode passed the raw `config_name` argument into `cache_dir / f"temp_{name}"`, where `clone_or_pull` both deletes the path and clones attacker-chosen content into it. Closes #462.

Contributed by @emecii. Review follow-ups added on top: `config_name` validated once for all three modes in both MCP servers; one shared allowlist validator (`services/path_safety`) replacing the denylist and the three earlier copies (workflow, config publisher, marketplace), also rejecting NUL bytes, whitespace and dot-files such as `.git`; the CLI fetcher validates too; a failed pull now falls through to a fresh clone instead of deleting the cache and reporting an error; accurate error text; tests; CHANGELOG `Security` entry.

Co-authored-by: emecii <emecii@users.noreply.github.com>
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -9,6 +9,9 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 _Development version: 3.10.0.dev0_
 
+### Security
+- **Path traversal in the `fetch_config` MCP tool (CWE-22)** (#462 reported by @Harmenszoon, fixed in PR #464 by @emecii) — the git-URL mode passed the raw `config_name` argument into `cache_dir / f"temp_{name}"`, and `clone_or_pull` both deletes that path (on `refresh` or a failed pull) and clones attacker-chosen content into it, so a crafted name could delete or overwrite directories outside the cache. The shared clone boundary now validates the cache name, and `fetch_config` validates `config_name` once for all three modes in both MCP servers (the named-source and API modes wrote `<destination>/<name>.json` from the raw name too). All name checks now go through one allowlist (`services/path_safety.validate_path_segment`: leading letter or digit, then letters, digits, `.`, `_`, `-`), which also rejects NUL bytes, whitespace and dot-files such as `.git`; the workflow, config-publisher and marketplace validators delegate to it. A failed pull on a cached clone now falls through to a fresh clone instead of deleting the cache and reporting an error.
+
 ### Added
 - **Opt-in SQLite search index for generated skills** (#393, PR #463 by @emecii) — `skill-seekers create <source> --index` (or `"index": true` in a config file) writes `scripts/index.db` (FTS5 with BM25, LIKE-style fallback where FTS5 is unavailable) and a stdlib-only `scripts/search.py` that returns ranked `file#anchor` pointers, and appends a search-first block to SKILL.md. Off by default, Markdown untouched, zero new dependencies; the Claude packager already ships `scripts/`. Sections are split at headings outside fenced code blocks, `index.md` table-of-contents pages are skipped, anchors follow GitHub's rules, query tokens are quoted so `NOT`/`OR` are plain words, and nothing is installed when a skill has no indexable references. Enhancement and indexing now resolve the skill directory the same way the scrapers do, including a config-file `output_dir`.
 - **`skill-seekers doctor --json`** (#459 by @Whxuan0701) — machine-readable diagnostics for CI and agents: `version`, per-check results, pass/warn/fail `summary`, `healthy` and `exit_code`, as exactly one JSON document on stdout. Import-time noise from dependencies is forwarded to stderr, a crashing check is reported as `{"error": ...}`, and `verbose_detail` (which carries masked API-key fragments) is only populated with `--verbose`, matching the human report. The `doctor` command now has a section in the CLI reference.
```

**File**: `src/skill_seekers/cli/config_fetcher.py` (modified, +9/-0)
```diff
@@ -46,6 +46,15 @@ def fetch_config_from_api(
     if config_name.startswith("configs/"):
         config_name = config_name[8:]
 
+    # The name becomes <destination>/<name>.json — keep it to one segment.
+    from skill_seekers.services.path_safety import validate_path_segment
+
+    try:
+        validate_path_segment(config_name, label="config name")
+    except ValueError as e:
+        logger.error(f"❌ {e}")
+        return None
+
     try:
         with httpx.Client(timeout=timeout) as client:
             # Get config details first
```

**File**: `src/skill_seekers/mcp/server_legacy.py` (modified, +12/-1)
```diff
@@ -1187,6 +1187,7 @@ async def scrape_github_tool(args: dict) -> list[TextContent]:
 async def fetch_config_tool(args: dict) -> list[TextContent]:
     """Fetch config from API, git URL, or named source"""
     from skill_seekers.services.git_repo import GitConfigRepo
+    from skill_seekers.services.path_safety import validate_path_segment
     from skill_seekers.services.source_manager import SourceManager
 
     config_name = args.get("config_name")
@@ -1201,6 +1202,14 @@ async def fetch_config_tool(args: dict) -> list[TextContent]:
     token = args.get("token")
     force_refresh = args.get("refresh", False)
 
+    # config_name becomes a path segment in every mode (cache dir, destination
+    # file), so validate it once here rather than per mode (#462, CWE-22).
+    if config_name:
+        try:
+            validate_path_segment(config_name, label="config name")
+        except ValueError as e:
+            return [TextContent(type="text", text=f"❌ {e}")]
+
     try:
         # MODE 1: Named Source (highest priority)
         if source_name:
@@ -1237,6 +1246,8 @@ async def fetch_config_tool(args: dict) -> list[TextContent]:
                     token=token,
                     force_refresh=force_refresh,
                 )
+            except ValueError as e:
+                return [TextContent(type="text", text=f"❌ {str(e)}")]
             except Exception as e:
                 return [TextContent(type="text", text=f"❌ Git error: {str(e)}")]
 
@@ -1297,7 +1308,7 @@ async def fetch_config_tool(args: dict) -> list[TextContent]:
                     force_refresh=force_refresh,
                 )
             except ValueError as e:
-                return [TextContent(type="text", text=f"❌ Invalid git URL: {str(e)}")]
+                return [TextContent(type="text", text=f"❌ {str(e)}")]
             except Exception as e:
                 return [TextContent(type="text", text=f"❌ Git error: {str(e)}")]
 
```

**File**: `src/skill_seekers/mcp/tools/source_tools.py` (modified, +12/-1)
```diff
@@ -79,6 +79,7 @@ async def fetch_config_tool(args: dict) -> list[TextContent]:
         List of TextContent with fetch results or config list
     """
     from skill_seekers.services.git_repo import GitConfigRepo
+    from skill_seekers.services.path_safety import validate_path_segment
     from skill_seekers.services.source_manager import SourceManager
 
     config_name = args.get("config_name")
@@ -93,6 +94,14 @@ async def fetch_config_tool(args: dict) -> list[TextContent]:
     token = args.get("token")
     force_refresh = args.get("refresh", False)
 
+    # config_name becomes a path segment in every mode (cache dir, destination
+    # file), so validate it once here rather than per mode (#462, CWE-22).
+    if config_name:
+        try:
+            validate_path_segment(config_name, label="config name")
+        except ValueError as e:
+            return [TextContent(type="text", text=f"❌ {e}")]
+
     try:
         # MODE 1: Named Source (highest priority)
         if source_name:
@@ -129,6 +138,8 @@ async def fetch_config_tool(args: dict) -> list[TextContent]:
                     token=token,
                     force_refresh=force_refresh,
                 )
+            except ValueError as e:
+                return [TextContent(type="text", text=f"❌ {str(e)}")]
             except Exception as e:
                 return [TextContent(type="text", text=f"❌ Git error: {str(e)}")]
 
@@ -189,7 +200,7 @@ async def fetch_config_tool(args: dict) -> list[TextContent]:
                     force_refresh=force_refresh,
                 )
             except ValueError as e:
-                return [TextContent(type="text", text=f"❌ Invalid git URL: {str(e)}")]
+                return [TextContent(type="text", text=f"❌ {str(e)}")]
             except Exception as e:
                 return [TextContent(type="text", text=f"❌ Git error: {str(e)}")]
 
```

**File**: `src/skill_seekers/mcp/tools/workflow_tools.py` (modified, +4/-5)
```diff
@@ -11,7 +11,6 @@
 
 from __future__ import annotations
 
-import os
 from pathlib import Path
 
 import yaml
@@ -30,10 +29,10 @@ def __init__(self, type: str, text: str):
 
 
 def _validate_name(name: str) -> str:
-    """Validate workflow name to prevent path traversal (CWE-22)."""
-    if not name or ".." in name or "/" in name or "\\" in name or os.path.isabs(name):
-        raise ValueError(f"Invalid workflow name: {name!r}")
-    return name
+    """Validate workflow name to prevent path traversal (CWE-22) — shared allowlist."""
+    from skill_seekers.services.path_safety import validate_path_segment
+
+    return validate_path_segment(name, label="workflow name")
 
 
 def _ensure_user_dir() -> Path:
```

---

### Incident Patch 5: `f540a5a3` (2026-09-20)
**Commit Message**: fix(doctor): restore the skill-seekers-doctor console script (#456)

The COMMAND_CLASSES migration (#327) dropped doctor.main() and the module's __main__ block but left `skill-seekers-doctor` in [project.scripts], so the published console script raised ImportError in v3.7.0 through v3.9.1 and `python -m skill_seekers.cli.doctor` exited 0 without running anything.

Diagnosed by @michaeldhendricks12-cell (who proposed removing the entry point); resolved by restoring a thin main() built from the central DoctorParser instead, plus a guard test that resolves every [project.scripts] target and dispatch tests for DoctorCommand.

Co-authored-by: michaeldhendricks12-cell <michaeldhendricks12-cell@users.noreply.github.com>
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -69,6 +69,7 @@ _Development version: 3.10.0.dev0_
 - **`QWEN.md` reduced from 719 to 64 lines** — it duplicated `AGENTS.md` while advertising three different version numbers at once (v3.6.0, 3.3.0, and "17+ source types" beside "18 source types"). It is now a pointer to `AGENTS.md` that keeps the essential commands and conventions inline and carries no hardcoded version.
 
 ### Fixed
+- **`skill-seekers-doctor` console script and `python -m skill_seekers.cli.doctor` work again** (#456, reported by @michaeldhendricks12-cell) — the COMMAND_CLASSES migration (#327) removed `doctor.main()` but left the console script pointing at it, so it raised `ImportError` in v3.7.0 through v3.9.1 and the module ran as a silent no-op. A thin `main()` built from the central `DoctorParser` restores both without duplicating flag definitions. A new test resolves every `[project.scripts]` target so a dangling entry point cannot ship again.
 - **Stale and incorrect README claims corrected against the codebase** — version badge 3.7.0 → 3.9.0; the documented `scan --quick|--comprehensive|--enhance` flags do not exist and are now `create --preset quick|standard|comprehensive`; export targets "16 formats"/"21 platforms" → 22; CLI reference "all 20 commands" → 19; the `install-agent` table 15 → 19 entries; workflow presets "24+" → 68; and the dead `# skill-seekers list-configs` line removed.
 - **Three overlapping troubleshooting guides unified** — root `TROUBLESHOOTING.md` (485 lines), `docs/TROUBLESHOOTING.md` (1,102) and `docs/user-guide/06-troubleshooting.md` (108) shared only 2 of 22 headings, so none was a stale copy. `docs/TROUBLESHOOTING.md` is now the single comprehensive reference (1,398 lines) with the five sections that existed only at root merged in; the user-guide chapter stays as the short entry in the numbered series.
 - **92 broken relative links repaired across the docs tree** (109 → 17) — targets relinked to their real locations, case/separator mismatches fixed (`integrations/cursor.md` → `CURSOR.md`, `advanced/api-reference.md` → `reference/API_REFERENCE.md`), and links to never-written docs unlinked rather than left as 404s. The remaining 17 are intentional (template placeholders, illustrative generated-output samples, archived snapshots).
```

**File**: `src/skill_seekers/cli/doctor.py` (modified, +20/-0)
```diff
@@ -305,3 +305,23 @@ def __init__(self, args) -> None:
     def execute(self) -> int:
         results = run_all_checks()
         return print_report(results, verbose=getattr(self.args, "verbose", False))
+
+
+def main(args=None) -> int:
+    """Standalone entry point (``skill-seekers-doctor`` / ``python -m skill_seekers.cli.doctor``).
+
+    Builds its parser from the central ``DoctorParser`` so the flag set has a
+    single definition, then runs the same ``DoctorCommand`` the unified CLI
+    dispatches to. This was dropped by mistake in the COMMAND_CLASSES migration
+    (#327), which left the published console script raising ImportError.
+    """
+    if args is None:
+        from skill_seekers.cli.parsers.doctor_parser import DoctorParser
+
+        parser = DoctorParser().build_standalone(prog="skill-seekers-doctor")
+        args = parser.parse_args()
+    return DoctorCommand(args).execute()
+
+
+if __name__ == "__main__":
+    raise SystemExit(main())
```

**File**: `tests/test_cli_paths.py` (modified, +46/-0)
```diff
@@ -10,6 +10,8 @@
 import unittest
 from pathlib import Path
 
+import pytest
+
 # Add parent directory to path
 sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
 
@@ -205,3 +207,47 @@ def test_main_cli_file_exists(self):
 
 if __name__ == "__main__":
     unittest.main()
+
+
+def _console_script_targets() -> list[tuple[str, str, str]]:
+    """Parse ``[project.scripts]`` from pyproject.toml without a TOML library (3.10 has none)."""
+    import re
+
+    text = (Path(__file__).resolve().parent.parent / "pyproject.toml").read_text(encoding="utf-8")
+    section = re.search(r"^\[project\.scripts\]\n(.*?)^\[", text, re.M | re.S)
+    assert section, "[project.scripts] not found in pyproject.toml"
+    targets = []
+    for line in section.group(1).splitlines():
+        m = re.match(r'^([\w-]+)\s*=\s*"([\w.]+):(\w+)"', line)
+        if m:
+            targets.append(m.groups())
+    assert len(targets) > 20, targets
+    return targets
+
+
+class TestConsoleScriptTargets:
+    """Every ``skill-seekers-*`` console script must point at a function that exists.
+
+    ``skill-seekers-doctor`` shipped broken for four releases (v3.7.0-v3.9.1)
+    after the COMMAND_CLASSES migration removed ``doctor.main`` but left the
+    pyproject entry behind (#456). Nothing imported the target, so nothing
+    failed. This does.
+    """
+
+    @pytest.mark.parametrize(
+        "script,module,attr",
+        _console_script_targets(),
+        ids=[t[0] for t in _console_script_targets()],
+    )
+    def test_target_resolves(self, script, module, attr):
+        import importlib
+        import importlib.util
+
+        assert importlib.util.find_spec(module) is not None, f"{script}: module {module} missing"
+        try:
+            mod = importlib.import_module(module)
+        except ModuleNotFoundError as exc:
+            if exc.name and not exc.name.startswith("skill_seekers"):
+                pytest.skip(f"{script}: optional dependency {exc.name} not installed")
+            raise
+        assert callable(getattr(mod, attr, None)), f"{script}: {module} has no callable {attr}()"
```

**File**: `tests/test_doctor.py` (modified, +44/-0)
```diff
@@ -7,6 +7,7 @@
 
 from skill_seekers.cli.doctor import (
     CheckResult,
+    DoctorCommand,
     check_api_keys,
     check_core_deps,
     check_git,
@@ -15,6 +16,7 @@
     check_output_directory,
     check_package_installed,
     check_python_version,
+    main,
     print_report,
     run_all_checks,
 )
@@ -173,3 +175,45 @@ def test_no_verbose_hides_detail(self, capsys):
         print_report(results, verbose=False)
         captured = capsys.readouterr()
         assert "secret: hidden" not in captured.out
+
+
+class TestDoctorEntryPoints:
+    """The unified CLI dispatch, the console script and ``python -m`` all reach the same code."""
+
+    _ok = [CheckResult("python", "pass", "3.12")]
+
+    def test_command_class_dispatch_contract(self, capsys):
+        from argparse import Namespace
+
+        with patch("skill_seekers.cli.doctor.run_all_checks", return_value=self._ok):
+            assert DoctorCommand(Namespace(verbose=True)).execute() == 0
+        assert "python" in capsys.readouterr().out
+
+    def test_main_parses_argv_from_central_parser(self, capsys):
+        with (
+            patch("skill_seekers.cli.doctor.run_all_checks", return_value=self._ok),
+            patch("skill_seekers.cli.doctor.print_report", return_value=0) as report,
+            patch("sys.argv", ["skill-seekers-doctor", "--verbose"]),
+        ):
+            assert main() == 0
+        assert report.call_args.kwargs["verbose"] is True
+
+    def test_main_accepts_preparsed_namespace(self):
+        from argparse import Namespace
+
+        with patch("skill_seekers.cli.doctor.run_all_checks", return_value=self._ok):
+            assert main(Namespace(verbose=False)) == 0
+
+    def test_module_is_runnable(self):
+        """``python -m skill_seekers.cli.doctor`` must run the checks, not silently exit 0."""
+        import subprocess
+        import sys
+
+        proc = subprocess.run(
+            [sys.executable, "-m", "skill_seekers.cli.doctor", "--help"],
+            capture_output=True,
+            text=True,
+            timeout=60,
+        )
+        assert proc.returncode == 0
+        assert "--verbose" in proc.stdout
```

---

### Incident Patch 6: `4cca1e69` (2026-09-20)
**Commit Message**: fix(unified): preserve source reference trees (#454)

Unified multi-source builds dropped every converter-backed source's readable references (PDF, EPUB, Word, PPTX, video, ...) — the final skill held only an index or raw JSON while the Markdown sat unused in the scrape cache, and the synthesized SKILL.md linked to files that did not exist. Closes #453.

Contributed by @Iams4kura; review follow-ups (bounded enhancement input, SKILL.md link rewriting, managed references wipe, namespaced data JSON, copy-error tolerance, single naming source for sub-skill dirs and cache stems) added on top.

Co-authored-by: Iams4kura <Iams4kura@users.noreply.github.com>
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -49,6 +49,12 @@ _Development version: 3.10.0.dev0_
 - Seeker HUD: unmatched `/api/*` paths now 404 for every HTTP method, without widening the SPA catch-all route's accepted methods.
 - Seeker HUD: Doctor check levels are normalised (`pass`/`warn`/`fail` → `ok`/`warning`/`error`) so the status pill reflects real failures, and agent install paths resolve under the HUD's workspace root instead of the server process's working directory.
 
+### Fixed
+- **Unified multi-source builds preserve readable source references** (#453) — converter-backed sources such as PDF and EPUB no longer leave their generated Markdown stranded in the scrape cache while the final skill contains only an index or raw JSON. Each source's `references/` tree and adjacent assets are copied into an indexed namespace, preventing same-name collisions and preserving relative asset links; visual video frames and `skip_scrape` reference locations are preserved too.
+  - Namespaces are `<scrape index>_<sanitized id>` (raw data JSON included), so URL/path ids are filesystem-safe and same-named inputs stay apart. Links in the synthesized SKILL.md are rewritten to the unified locations instead of pointing at the sub-skill's `references/*.md`.
+  - The builder now recreates the `references/` entries it owns on every build (source-type directories, `api/`, `codebase_analysis/`, `conflicts.md`); user files kept elsewhere under `references/` are left alone. A copy failure inside a cached sub-skill is logged and the build continues.
+  - The unified API-mode enhancement prompt reads references through the same bounded reader the platform adaptors use (200k chars total, 30k per file, keyed by relative path). Previously it inlined every reference file unbounded, which the full PDF/EPUB trees would have pushed past any model's context window.
+
 ## [3.9.1] - 2026-08-02
 
 **Theme:** Documentation and project-infrastructure release. No runtime code changed — the package is functionally identical to 3.9.0.
```

**File**: `docs/features/UNIFIED_SCRAPING.md` (modified, +23/-3)
```diff
@@ -399,22 +399,42 @@ output/skill-name/
 │   │   ├── issues.md
 │   │   └── releases.md
 │   ├── pdf/                     # PDF references (if applicable)
-│   │   └── index.md
+│   │   ├── index.md
+│   │   └── 0_manual/          # One namespace per input document
+│   │       ├── references/     # Readable extracted Markdown
+│   │       └── assets/         # Images used by those references
 │   ├── video/                   # Video transcripts (if applicable)
 │   │   └── index.md
 │   ├── openapi/                 # OpenAPI spec (if applicable)
 │   │   └── index.md
 │   ├── jupyter/                 # Notebook content (if applicable)
 │   │   └── index.md
-│   ├── <source-type>/           # Other source type references
-│   │   └── index.md
+│   ├── <source-type>/           # Other converter-backed sources
+│   │   ├── index.md
+│   │   ├── 0_<source>_data.json # Raw extracted data
+│   │   └── 0_<source>/        # Readable references + assets
 │   ├── api/                     # Merged API reference
 │   │   └── merged_api.md
 │   └── conflicts.md             # Detailed conflict report
 ├── scripts/                     # Empty (for user scripts)
 └── assets/                      # Empty (for user assets)
 ```
 
+Converter-backed sources such as PDF, Word, EPUB, Jupyter, and PowerPoint keep
+each input's generated reference tree in its own indexed namespace. This avoids
+filename collisions when multiple inputs contain files such as `content.md` and
+keeps relative links from the Markdown to adjacent assets intact. Video sources
+use the same layout and preserve adjacent visual-extraction `frames/` as well.
+The namespace is `<scrape index>_<sanitized id>`, so URL or path ids are
+filesystem-safe and two inputs with the same file name stay apart. Links in the
+synthesized SKILL.md are rewritten to these locations.
+
+Every build recreates the directories it owns under `references/`
+(`documentation/`, `github/`, `pdf/`, the converter-backed types, `api/`,
+`codebase_analysis/`, `conflicts.md`), so a source removed from the config
+cannot leave stale content behind. Files you keep under `references/` outside
+those entries are left untouched.
+
 ### SKILL.md Format
 
 ```markdown
```

**File**: `src/skill_seekers/cli/adaptors/base.py` (modified, +6/-25)
```diff
@@ -217,39 +217,20 @@ def _read_reference_files(
         """
         Read reference markdown files from skill directory.
 
-        Single canonical copy — claude/openai/gemini carried byte-identical
-        versions and openai_compatible a cosmetic variant.
+        Delegates to the shared bounded reader in ``scraper_utils`` (also used
+        by the unified enhancement path) so every enhancement prompt observes
+        the same size limits. Keys are paths relative to ``references_dir``.
 
         Args:
             references_dir: Path to references directory
             max_chars: Maximum total characters to read
 
         Returns:
-            Dictionary mapping filename to content
+            Dictionary mapping relative file path to content
         """
-        if not references_dir.exists():
-            return {}
-
-        references = {}
-        total_chars = 0
-
-        for ref_file in sorted(references_dir.rglob("*.md")):
-            if total_chars >= max_chars:
-                break
-
-            try:
-                content = ref_file.read_text(encoding="utf-8")
-                # Truncate very large files
-                if len(content) > 30000:
-                    content = content[:30000] + "\n\n...(truncated)"
-
-                references[ref_file.name] = content
-                total_chars += len(content)
-
-            except Exception as e:
-                print(f"  ⚠ Could not read {ref_file.name}: {e}")
+        from skill_seekers.cli.scraper_utils import read_reference_markdown
 
-        return references
+        return read_reference_markdown(references_dir, max_chars=max_chars)
 
     def _enhance_skill_md_via_client(
         self,
```

**File**: `src/skill_seekers/cli/scraper_utils.py` (modified, +45/-0)
```diff
@@ -14,7 +14,11 @@
   near-identical in the word/pdf/epub/html/pptx/asciidoc/jupyter scrapers).
 """
 
+import logging
 import re
+from pathlib import Path
+
+logger = logging.getLogger(__name__)
 
 
 def reference_filename(
@@ -162,3 +166,44 @@ def extract_table_from_html(table_elem) -> dict | None:
         return None
 
     return {"headers": headers, "rows": rows}
+
+
+def read_reference_markdown(
+    references_dir: Path | str,
+    *,
+    max_chars: int = 200_000,
+    max_file_chars: int = 30_000,
+) -> dict[str, str]:
+    """Read ``*.md`` files under ``references_dir`` into a bounded mapping.
+
+    Single reader shared by the platform adaptors and the unified enhancement
+    path so an enhancement prompt can never grow without limit: each file is
+    capped at ``max_file_chars`` and reading stops once ``max_chars`` have been
+    collected. Unified builds copy whole PDF/EPUB reference trees under
+    ``references/`` (#453), so an unbounded read would exceed any model's
+    context window on a multi-book config.
+
+    Keys are POSIX paths relative to ``references_dir`` so same-name files in
+    different sub-skill namespaces (``pdf/0_a/references/index.md`` vs
+    ``pdf/1_b/references/index.md``) do not overwrite each other. Files are
+    visited in sorted order so truncation is deterministic.
+    """
+    references_dir = Path(references_dir)
+    if not references_dir.exists():
+        return {}
+
+    references: dict[str, str] = {}
+    total_chars = 0
+    for ref_file in sorted(references_dir.rglob("*.md")):
+        if total_chars >= max_chars:
+            break
+        try:
+            content = ref_file.read_text(encoding="utf-8", errors="ignore")
+        except OSError as exc:
+            logger.warning("Could not read %s: %s", ref_file, exc)
+            continue
+        if len(content) > max_file_chars:
+            content = content[:max_file_chars] + "\n\n...(truncated)"
+        references[ref_file.relative_to(references_dir).as_posix()] = content
+        total_chars += len(content)
+    return references
```

**File**: `src/skill_seekers/cli/unified_scraper.py` (modified, +132/-57)
```diff
@@ -549,7 +549,7 @@ def _scrape_github(self, source: dict[str, Any]):
         # Create config for GitHub scraper
         github_config = {
             "repo": repo,
-            "name": f"{self.name}_github_{idx}_{repo_id}",
+            "name": self._sub_skill_name("github", idx, repo_id),
             "github_token": source.get("github_token"),
             "include_issues": source.get("include_issues", True),
             "max_issues": source.get("max_issues", 100),
@@ -605,7 +605,9 @@ def _scrape_github(self, source: dict[str, Any]):
             logger.info(f"📁 Repository clone saved for future use: {cloned_repo_path}")
 
         # Save data to unified location with unique filename
-        github_data_file = os.path.join(self.data_dir, f"github_data_{idx}_{repo_id}.json")
+        github_data_file = os.path.join(
+            self.data_dir, f"{self._cache_stem('github', idx, repo_id)}.json"
+        )
         with open(github_data_file, "w", encoding="utf-8") as f:
             json.dump(github_data, f, indent=2, ensure_ascii=False)
 
@@ -622,6 +624,7 @@ def _scrape_github(self, source: dict[str, Any]):
                 "idx": idx,
                 "data": github_data,
                 "data_file": github_data_file,
+                "refs_dir": os.path.join(github_skill_dir, "references"),
             }
         )
 
@@ -639,6 +642,23 @@ def _scrape_github(self, source: dict[str, Any]):
 
         logger.info("✅ GitHub: Repository scraped successfully")
 
+    def _sub_skill_name(self, bucket: str, idx: int, source_id: str | None = None) -> str:
+        """Cache sub-skill directory name for one source.
+
+        ``{name}_{bucket}_{idx}_{source_id}`` (``{name}_{bucket}_{idx}`` for
+        types without an id, i.e. video). Fresh scrapes name the standalone
+        sub-skill with this and cached loads reconstruct ``refs_dir`` from it,
+        so the two paths cannot drift.
+        """
+        suffix = f"_{source_id}" if source_id is not None else ""
+        return f"{self.name}_{bucket}_{idx}{suffix}"
+
+    @staticmethod
+    def _cache_stem(bucket: str, idx: int, source_id: str | None = None) -> str:
+        """Cache data filename stem for one source: ``{bucket}_data_{idx}[_{source_id}]``."""
+        suffix = f"_{source_id}" if source_id is not None else ""
+        return f"{bucket}_data_{idx}{suffix}"
+
     def _scrape_with_converter(
         self,
         *,
@@ -701,7 +721,14 @@ def _scrape_with_converter(
         shutil.copy(data_file, cache_data_file)
 
         # Append to list instead of overwriting (multi-source support)
-        self.scraped_data[bucket].append({**record, "data": data, "data_file": cache_data_file})
+        self.scraped_data[bucket].append(
+            {
+                **record,
+                "data": data,
+                "data_file": cache_data_file,
+                "refs_dir": os.path.join(source_skill_dir, "references"),
+            }
+        )
 
         # Build standalone SKILL.md for synthesis
         try:
@@ -727,15 +754,15 @@ def _scrape_pdf(self, source: dict[str, Any]):
             bucket="pdf",
             converter_type="pdf",
             config={
-                "name": f"{self.name}_pdf_{idx}_{pdf_id}",
+                "name": self._sub_skill_name("pdf", idx, pdf_id),
                 "pdf_path": source["path"],  # Fixed: use pdf_path instead of pdf
                 "description": f"{source.get('name', pdf_id)} documentation",
                 "extract_tables": source.get("extract_tables", True),
                 "ocr": source.get("ocr", False),
                 "password": source.get("password"),
             },
             record={"pdf_path": pdf_path, "pdf_id": pdf_id, "idx": idx},
-            cache_stem=f"pdf_data_{idx}_{pdf_id}",
+            cache_stem=self._cache_stem("pdf", idx, pdf_id),
             label="PDF",
             summary_key="pages",
             summary_noun="pages",
@@ -756,7 +783,7 @@ def _scrape_word(self, source: dict[
```

---

### Incident Patch 7: `0709580b` (2026-09-13)
**Commit Message**: fix(hud): final review — working vector uploads, merged analysis manifests, unsaved-edit guard, install path, sync copy

run_upload filtered the packager's output on .zip/.gz, so every vector/RAG
target (which writes <name>-<target>.json) failed with "produced no archive";
it now takes the newest regular file in the target's own directory, and a
missing directory raises the same RuntimeError instead of a FileNotFoundError.

run_analyze no longer rmtree's the whole run directory: it clears only the
outputs of the tools this invocation runs and merges into the existing
manifest, so a per-tool re-run keeps its siblings' results. The manifest is
written in a finally, recording "<tool> exited <code>" when a tool fails
instead of leaving the Analysis cards with nothing to read.

POST /api/environment/agents/{agent}/install no longer accepts a
caller-supplied skill_dir — the source is always the workspace bootstrap
output. UPLOAD_TARGETS is derived from adaptors.get_upload_platforms(), so
faiss/qdrant are rejected with a 400 rather than queued into an argparse
failure.

The store gains dirty/setDirty/confirmLeave; SkillPage and ConfigPage publish
their editor dirtiness and the sidebar, he

**File**: `CHANGELOG.md` (modified, +6/-3)
```diff
@@ -23,8 +23,8 @@ _Development version: 3.10.0.dev0_
 - Seeker HUD: `GET /api/mcp/status` probes the stdio/HTTP transports; the Seeker MCP tab shows real status and copyable client config.
 - Seeker HUD: live skill search shared between the top bar and the grid; configs search; 25/50/100 paging on the skills, configs and workflows lists.
 - Seeker HUD: routed skill page at `/skills/<id>` with Overview, SKILL.md, Files, Installs, Enhance, Analysis, Export, and History tabs, replacing the skill drawer.
-- Seeker HUD: routed config page at `/configs/<id>` with Overview, JSON, Validate, Estimate, Sync, Push/Submit, and Generate tabs, replacing the config drawer.
-- Seeker HUD: Workflows screen at `/workflows/<name>` lists, views, copies, edits, validates, and deletes enhancement-workflow YAML.
+- Seeker HUD: routed config page at `/configs/<id>` with Overview, JSON, Validate, Estimate, Sync, Push/Submit, and Generate tabs.
+- Seeker HUD: Workflows screen at `/workflows` (rows select `/workflows/<name>`) lists, views, copies, edits, validates, and deletes enhancement-workflow YAML.
 - Seeker HUD: Analyze screen at `/analyze` runs the C3.x codebase-analysis tools against a directory, skill, or owner/repo target and records manifests under `output/_analysis/`.
 - Seeker HUD: Environment screen at `/environment` adds Doctor, Servers (start/stop the MCP HTTP and embedding servers), and Agents (install/reinstall a skill) panels alongside the MCP tools catalogue.
 - Seeker HUD: twelve new job types — `upload`, `translate`, `update`, `quality`, `analyze`, `split`, `push`, `submit`, `sync-check`, `generate-config`, `install-agent`, `server` — back the new page actions; servers started from Environment run as jobs, and stopping the server cancels the job.
@@ -41,7 +41,10 @@ _Development version: 3.10.0.dev0_
 - Seeker HUD: a `SKILL.md` nested inside a skill directory (e.g. vercel's `ai-sdk/upstream/`) no longer shows up as a separate skill; pressing Enter in the top-bar search no longer triggers the opened drawer's first action; the Seeker MCP status cards no longer overflow; the web API test fixture now owns its own `JobManager`, so test jobs stop leaking into `~/.skill-seekers/ui/`.
 - Seeker HUD: config sync-state paths are read and written through one sanitised `sync_state_path()` helper, closing a path-traversal read of arbitrary `*_sync.json` files via an unsanitised config `name`.
 - Seeker HUD: sync checks now detect and report unreachable pages (non-zero exit, `status: "error"`, unreachable-page count) instead of silently recording a down docs site as zero changes.
-- Seeker HUD: analysis runs are isolated per target by a hashed run directory, so concurrent runs no longer share state, and a stale previous run's leftover test output no longer falsely triggers the guides step.
+- Seeker HUD: analysis runs are isolated per target by a hashed run directory, so concurrent runs no longer share state, and a stale previous run's leftover test output no longer falsely triggers the guides step. Running one tool now merges into the target's manifest instead of replacing it (a re-run clears only that tool's own output), and the manifest is written even when a tool exits non-zero, recording the failure alongside the results that survived.
+- Seeker HUD: uploads to the vector/RAG targets work again — the packager's `<name>-<target>.json` output was filtered out by an archive-only extension check, so every Chroma/Weaviate/Pinecone upload failed with "produced no archive".
+- Seeker HUD: `POST /api/environment/agents/{agent}/install` no longer accepts a caller-supplied `skill_dir`; the install source is always the workspace's own bootstrap output. Upload targets are derived from the adaptor registry, so `faiss`/`qdrant` are rejected up front instead of queueing a job that dies in argparse.
+- Seeker HUD: leaving a skill or config page with unsaved SKILL.md / JSON edits now asks for confirmation — the sidebar, header search and breadcrumbs used to 
```

**File**: `CLAUDE.md` (modified, +5/-0)
```diff
@@ -190,6 +190,11 @@ Local codebase analysis features, all opt-out (`--skip-*` flags):
 - **Tools run in-process** via `run_cli_main()` in `mcp/tools/_common.py`: same argv parsed by the command's REAL parser (sys.argv patch under a lock), stdout/stderr capture + contextvar log capture, identical `(stdout, stderr, returncode)` contract. No subprocess startup; old hard timeouts are advisory.
 - **Exceptions BY DESIGN**: `enhance_skill` (LOCAL agent) and `install_skill`'s enhancement step stay subprocess — the agent must be a real child process for the fork-bomb-guard env semantics (`SKILL_SEEKER_ENHANCE_ACTIVE`). Never make these in-process.
 - **Domain logic lives in `skill_seekers.services/`** (marketplace_manager, marketplace_publisher, config_publisher, source_manager, git_repo) — importable by CLI without the `[mcp]` extra; old `skill_seekers.mcp.*` paths are back-compat shims. No `sys.path` hacks anywhere in `mcp/`.
+
+### Seeker HUD (web UI)
+
+FastAPI backend in `src/skill_seekers/web/`, React app in `ui/`; see `docs/guides/WEB_UI.md`.
+
 - HUD routes live in `src/skill_seekers/web/routes/` (one module per screen, `register(app, ctx)`); `app.py` keeps the original routes.
 
 ### Enhancement (AgentClient is the single AI transport)
```

**File**: `src/skill_seekers/web/analysis_store.py` (modified, +11/-0)
```diff
@@ -33,6 +33,17 @@ def slug_for(value: str) -> str:
     return f"{stem}-{hashlib.sha256(value.encode('utf-8')).hexdigest()[:8]}"
 
 
+def read_manifest(root: Path, slug: str) -> dict[str, Any]:
+    """The manifest already recorded for ``slug``, or ``{}`` if there is none.
+
+    A run of one tool merges into whatever earlier runs of the other tools
+    recorded, so the reader has to tolerate a missing or malformed file.
+    """
+    safe_name(slug)
+    data = read_json(analysis_root(root) / slug / "manifest.json", {})
+    return data if isinstance(data, dict) else {}
+
+
 def write_manifest(root: Path, slug: str, data: dict[str, Any]) -> Path:
     """Record one analysis run; ``slug`` must be a single path component."""
     safe_name(slug)
```

**File**: `src/skill_seekers/web/routes/environment.py` (modified, +5/-10)
```diff
@@ -9,7 +9,6 @@
 from __future__ import annotations
 
 import time
-from pathlib import Path
 from typing import Any
 
 from fastapi import FastAPI, HTTPException
@@ -25,7 +24,9 @@
 # Module level on purpose: this file uses `from __future__ import annotations`,
 # and FastAPI cannot resolve a request model defined inside register().
 class InstallAgentRequest(BaseModel):
-    skill_dir: str | None = None
+    # No skill_dir field on purpose: the source is always the workspace's own
+    # bootstrap output, so a request body can never point the installer at an
+    # arbitrary directory on this machine.
     force: bool = False
 
 
@@ -160,16 +161,10 @@ def install_agent_route(agent: str, req: InstallAgentRequest) -> dict[str, Any]:
 
         if agent not in get_available_agents():
             raise HTTPException(400, "Unsupported agent")
-        skill_dir = (
-            Path(req.skill_dir).expanduser()
-            if req.skill_dir
-            else workspace_dir(ctx.root, "output") / "skill-seekers"
-        )
+        skill_dir = workspace_dir(ctx.root, "output") / "skill-seekers"
         if not (skill_dir / "SKILL.md").is_file():
             raise HTTPException(
-                409,
-                "Build the Skill Seekers skill first (scripts/bootstrap_skill.sh) "
-                "or choose a skill directory",
+                409, "Build the Skill Seekers skill first (scripts/bootstrap_skill.sh)"
             )
         job = ctx.submit_job(
             "install-agent",
```

**File**: `src/skill_seekers/web/routes/skill_detail.py` (modified, +12/-12)
```diff
@@ -10,17 +10,17 @@
 from .. import registry
 from ..context import HudContext
 
-UPLOAD_TARGETS = {
-    "claude",
-    "gemini",
-    "openai",
-    "kimi",
-    "chroma",
-    "faiss",
-    "qdrant",
-    "weaviate",
-    "pinecone",
-}
+
+def upload_targets() -> set[str]:
+    """Targets whose adaptor actually uploads.
+
+    Derived from the adaptor registry rather than hand-listed: faiss and qdrant
+    package fine but have no uploading adaptor, so accepting them here queued a
+    job that died in ``upload_skill``'s argparse.
+    """
+    from skill_seekers.cli.adaptors import get_upload_platforms
+
+    return set(get_upload_platforms())
 
 
 class UploadRequest(BaseModel):
@@ -109,7 +109,7 @@ def skill_enhance_status(skill_id: str) -> dict[str, Any] | None:
     def upload_skill(skill_id: str, req: UploadRequest) -> dict[str, Any]:
         from ..paths import workspace_dir
 
-        if req.target not in UPLOAD_TARGETS:
+        if req.target not in upload_targets():
             raise HTTPException(400, f"Unsupported upload target: {req.target}")
         skill_dir = ctx.skill_dir_for(skill_id)
         job = ctx.submit_job(
```

---

### Incident Patch 8: `d53262e2` (2026-09-13)
**Commit Message**: fix(hud): clamp analyze confidence; slug column label

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CjVnprDdTWsh8N6fqc37pP

**File**: `ui/src/sections/Analyze.tsx` (modified, +11/-3)
```diff
@@ -85,14 +85,20 @@ export default function Analyze() {
     ...(tools.includes('quality') ? ['--quality-check'] : []),
   ].join(' ');
 
-  const runDisabled = store.pending || selectedTools.length === 0 || !targetValue.trim();
+  // The number input's min/max only constrain the spinner, not typed text —
+  // a typed 2 must disable the run rather than reach the backend, which
+  // rejects min_confidence outside 0–1 with a 400.
+  const minConfidenceNumber = Number(minConfidence);
+  const minConfidenceInvalid = minConfidence.trim() === '' || Number.isNaN(minConfidenceNumber) || minConfidenceNumber < 0 || minConfidenceNumber > 1;
+
+  const runDisabled = store.pending || selectedTools.length === 0 || !targetValue.trim() || minConfidenceInvalid;
 
   const run = async () => {
     const body: AnalyzeBody = {
       target: { kind: targetKind, value: targetValue.trim() },
       tools: selectedTools,
       depth,
-      min_confidence: Number(minConfidence) || 0,
+      min_confidence: Math.min(1, Math.max(0, Number(minConfidence) || 0)),
       ai_mode: aiMode,
       attach_to: attachTo || null,
     };
@@ -224,8 +230,10 @@ export default function Analyze() {
                   step={0.05}
                   value={minConfidence}
                   onChange={(e) => setMinConfidence(e.target.value)}
+                  aria-invalid={minConfidenceInvalid}
                   className="mt-1 h-8 font-mono-hud text-xs bg-secondary/50"
                 />
+                {minConfidenceInvalid && <p className="mt-1 text-[10px] text-destructive">must be between 0 and 1</p>}
               </div>
               <div>
                 <FL>AI enhancement</FL>
@@ -274,7 +282,7 @@ export default function Analyze() {
               <table className="w-full min-w-[520px] text-sm">
                 <thead>
                   <tr className="border-b border-border font-mono-hud text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
-                    <th className="px-3 py-2.5 text-left font-medium">target</th>
+                    <th className="px-3 py-2.5 text-left font-medium">slug</th>
                     <th className="px-3 py-2.5 text-left font-medium">tools</th>
                     <th className="px-3 py-2.5 text-left font-medium">started</th>
                     <th className="px-3 py-2.5 text-left font-medium">attached to</th>
```

**File**: `ui/tests/pages.spec.ts` (modified, +11/-2)
```diff
@@ -199,8 +199,17 @@ test('analyze submits the selected tools for a directory', async ({ page }) => {
   await page.getByRole('textbox', { name: 'local path' }).fill('~/dev/lazy-bird');
   await page.getByRole('checkbox', { name: /Design patterns/ }).check();
   await page.getByRole('checkbox', { name: /Quality check/ }).check();
-  await page.getByRole('button', { name: 'Run analysis' }).click();
-  await expect.poll(() => body).toMatchObject({ target: { kind: 'dir', value: '~/dev/lazy-bird' }, tools: ['patterns', 'quality'], depth: 'basic' });
+  const runButton = page.getByRole('button', { name: 'Run analysis' });
+  const confidence = page.getByRole('spinbutton', { name: 'Minimum confidence' });
+  // The number input's min/max only constrain the spinner, not typed text —
+  // a typed 2 must disable the run rather than reach the backend, which
+  // rejects min_confidence outside 0-1 with a 400.
+  await confidence.fill('2');
+  await expect(runButton).toBeDisabled();
+  await confidence.fill('0.5');
+  await expect(runButton).toBeEnabled();
+  await runButton.click();
+  await expect.poll(() => body).toMatchObject({ target: { kind: 'dir', value: '~/dev/lazy-bird' }, tools: ['patterns', 'quality'], depth: 'basic', min_confidence: 0.5 });
 });
 
 // The skill page packs eight tabs of tables, chip rows and card grids into the
```

---

### Incident Patch 9: `54e30abc` (2026-09-13)
**Commit Message**: fix(hud): Use in Create waits for workspace settings

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01CjVnprDdTWsh8N6fqc37pP

**File**: `ui/src/sections/Workflows.tsx` (modified, +19/-1)
```diff
@@ -1,5 +1,6 @@
 import { useState } from 'react';
 import { useNavigate } from 'react-router';
+import { toast } from 'sonner';
 import { Panel, SectionHeader } from '@/components/hud';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
@@ -57,6 +58,16 @@ export default function Workflows({ selected }: { selected: string | null }) {
   const openWorkflow = (name: string) => navigate(`/workflows/${encodeURIComponent(name)}`);
 
   const stashForCreate = (name: string) => {
+    // `/api/workflows` and `/api/settings` load in parallel — `store.root`
+    // reads '' until settings arrive, and a draft stashed under
+    // `seeker.create..workflows` (empty root) is never read back by
+    // sections/Create.tsx (its draftKey is keyed by the real root). The
+    // button is disabled until settings load (see WorkflowDetail below),
+    // but guard here too rather than trust only the disabled prop.
+    if (!store.root) {
+      toast.error('Workspace settings not loaded yet');
+      return;
+    }
     // Mirrors sections/Create.tsx's draft key exactly (`seeker.create.<root>.`
     // + field name) so the Create screen picks this up as its `workflows`
     // draft on the next load.
@@ -294,7 +305,14 @@ function WorkflowDetail({ row, reload, onUseInCreate }: {
           <Button size="sm" variant="outline" disabled={store.pending} onClick={validate} className="font-mono-hud text-[11px] uppercase tracking-wider">
             <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Validate
           </Button>
-          <Button size="sm" variant="outline" onClick={onUseInCreate} className="font-mono-hud text-[11px] uppercase tracking-wider">
+          <Button
+            size="sm"
+            variant="outline"
+            disabled={!store.settings}
+            title={store.settings ? undefined : 'Loading workspace settings…'}
+            onClick={onUseInCreate}
+            className="font-mono-hud text-[11px] uppercase tracking-wider"
+          >
             <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Use in Create
           </Button>
           {row.origin === 'bundled' ? (
```

**File**: `ui/tests/pages.spec.ts` (modified, +15/-0)
```diff
@@ -174,6 +174,21 @@ test('workflows install dialog PUTs a new user workflow and closes on success',
   await expect(page.getByRole('dialog')).toHaveCount(0);
 });
 
+test('Use in Create waits for workspace settings before stashing the create draft', async ({ page }) => {
+  await page.route('**/api/settings', async route => {
+    await new Promise((resolve) => setTimeout(resolve, 1500));
+    return route.fulfill({ json: payloads['/api/settings'] });
+  });
+  await page.goto('/workflows/default');
+  const button = page.getByRole('button', { name: 'Use in Create' });
+  await expect(button).toBeDisabled();
+  await expect(button).toBeEnabled({ timeout: 5000 });
+  await button.click();
+  await expect(page).toHaveURL(/\/create$/);
+  const stashed = await page.evaluate(() => sessionStorage.getItem('seeker.create./ws.workflows'));
+  expect(stashed).toBe('["default"]');
+});
+
 // The skill page packs eight tabs of tables, chip rows and card grids into the
 // same column the nav sections use; every one of them has to fit the narrow
 // viewports hud.spec.ts pins for the rest of the HUD.
```

---

### Incident Patch 10: `57f7164e` (2026-09-13)
**Commit Message**: fix(hud): sync tab refreshes, guarded JSON editor, Generate with AI from Library

Review round 1 fixes for Task 11 (three Important findings):

- SyncTab now takes an onChanged callback (wired to the page's reload) and
  calls it after every successful setSync/syncCheck, so the stats-strip pill
  and the Overview Lifecycle bullet update and a tab switch away-and-back
  re-seeds the switch from fresh data instead of stale mount-time props.
- Lifted the JSON editor's editing/draft/error state out of JsonTab into
  ConfigPage itself (mirrors SkillPage.tsx's editing/draft/dirty/beforeunload
  pattern): the revision sent on save is now pinned at startEdit() rather
  than re-read from `data.revision` at save time; the jobs-driven detail
  reload is skipped while editing; a dirty guard with a confirm dialog now
  gates every path that changes tabs (the tab bar itself and the header's
  Validate/Estimate shortcuts), plus a beforeunload warning while dirty.
- Extracted the Generate tab's form into a shared
  `ui/src/components/generate-config-form.tsx` (`onGenerated?: () => void`)
  and added a "Generate with AI" button to Library's header, next to "Add
  config source", opening a dialog th

**File**: `ui/src/components/generate-config-form.tsx` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+// Shared "Generate a config with AI" form — used by ConfigPage's Generate tab
+// and by Library's "Generate with AI" dialog (POST /api/configs/generate).
+import { useState } from 'react';
+import { Button } from '@/components/ui/button';
+import { Input } from '@/components/ui/input';
+import { Checkbox } from '@/components/ui/checkbox';
+import { useStore } from '@/lib/store';
+import { cn } from '@/lib/utils';
+import { Sparkles } from 'lucide-react';
+
+const GENERATE_KINDS: { id: 'url' | 'name' | 'dir'; label: string; placeholder: string }[] = [
+  { id: 'url', label: 'Docs URL', placeholder: 'https://docs.example.com/' },
+  { id: 'name', label: 'Framework name', placeholder: 'react' },
+  { id: 'dir', label: 'Project directory', placeholder: './my-project' },
+];
+
+export function GenerateConfigForm({ onGenerated }: { onGenerated?: () => void }) {
+  const store = useStore();
+  const [kind, setKind] = useState<'url' | 'name' | 'dir'>('url');
+  const [value, setValue] = useState('');
+  const [probe, setProbe] = useState(true);
+  const agents = store.settings?.capabilities.agents ?? [];
+  const [agent, setAgent] = useState(String(store.settings?.defaults.default_agent ?? 'claude'));
+  const active = GENERATE_KINDS.find((k) => k.id === kind) ?? GENERATE_KINDS[0];
+
+  const submit = async () => {
+    if (await store.generateConfig({ kind, value: value.trim(), probe_urls: probe })) {
+      setValue('');
+      onGenerated?.();
+    }
+  };
+
+  return (
+    <div className="space-y-3">
+      <p className="text-xs text-muted-foreground">
+        Writes a new unified config by inspecting a documentation site, resolving a framework name against the registry, or scanning a
+        local project directory. Runs as a background job — check Jobs for progress.
+      </p>
+      <div className="flex flex-wrap gap-1.5">
+        {GENERATE_KINDS.map((k) => (
+          <button
+            key={k.id}
+            aria-pressed={kind === k.id}
+            onClick={() => setKind(k.id)}
+            className={cn(
+              'rounded border px-2.5 py-1 font-mono-hud text-[11px] transition-colors',
+              kind === k.id ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
+            )}
+          >
+            {k.label}
+          </button>
+        ))}
+      </div>
+      <div className="space-y-1">
+        <div className="font-mono-hud text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{active.label}</div>
+        <Input
+          aria-label={active.label}
+          value={value}
+          onChange={(e) => setValue(e.target.value)}
+          placeholder={active.placeholder}
+          className="h-8 font-mono-hud text-xs"
+        />
+      </div>
+      <div className="space-y-1">
+        <div className="font-mono-hud text-[10px] uppercase tracking-[0.2em] text-muted-foreground">enhancement agent (display only)</div>
+        <select
+          aria-label="Enhancement agent"
+          value={agent}
+          onChange={(e) => setAgent(e.target.value)}
+          className="h-8 w-full rounded border border-border bg-secondary/40 px-2 font-mono-hud text-xs outline-none focus:border-primary/50"
+        >
+          {agents.map((a) => <option key={a} value={a}>{a}</option>)}
+        </select>
+        <p className="text-[10px] text-muted-foreground">Config generation is not agent-driven — this only previews which agent later enhancement passes would use.</p>
+      </div>
+      <label className="flex items-center gap-2.5 font-mono-hud text-[11px] text-foreground/80 cursor-pointer select-none">
+        <Checkbox checked={probe} onCheckedChange={(v) => setProbe(v === true)} />
+        probe discovered URLs before writing the config
+      </label>
+      <Button
+        className="w-full font-mono-hud text-[11px] uppercase tracking-wider"
+        disabled={store.pending || !value.trim()}
+        onClick={submi
```

**File**: `ui/src/sections/ConfigPage.tsx` (modified, +109/-112)
```diff
@@ -9,13 +9,14 @@ import { Input } from '@/components/ui/input';
 import { Checkbox } from '@/components/ui/checkbox';
 import { Switch } from '@/components/ui/switch';
 import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
+import { GenerateConfigForm } from '@/components/generate-config-form';
 import { usePayload } from '@/hooks/use-payload';
 import { api } from '@/lib/api';
 import type { ConfigDetail, Validation } from '@/lib/api';
 import { useStore } from '@/lib/store';
 import { cn } from '@/lib/utils';
 import {
-  CheckCircle2, Copy, FileJson, Gauge, GitBranch, Pencil, RefreshCw, Rocket, Scissors, Sparkles, UploadCloud, Wand2,
+  CheckCircle2, Copy, FileJson, Gauge, GitBranch, Pencil, RefreshCw, Rocket, Scissors, UploadCloud, Wand2,
 } from 'lucide-react';
 
 // ── static tables ───────────────────────────────────────────────────────────
@@ -35,12 +36,6 @@ const SPLIT_STRATEGIES = ['auto', 'none', 'source', 'category', 'router', 'size'
 // PUT .../sync's argparse-equivalent choices (routes/configs.py:SYNC_INTERVALS).
 const SYNC_INTERVALS = ['hourly', 'daily', 'weekly', 'manual'] as const;
 
-const GENERATE_KINDS: { id: 'url' | 'name' | 'dir'; label: string; placeholder: string }[] = [
-  { id: 'url', label: 'Docs URL', placeholder: 'https://docs.example.com/' },
-  { id: 'name', label: 'Framework name', placeholder: 'react' },
-  { id: 'dir', label: 'Project directory', placeholder: './my-project' },
-];
-
 // registry.list_config_entries origins — same palette as sections/Library.tsx
 // (not exported from there, so this is the one deliberate duplicate).
 const ORIGIN_STYLE: Record<string, string> = {
@@ -121,14 +116,37 @@ export default function ConfigPage({ id }: { id: string }) {
   const [splitStrategy, setSplitStrategy] = useState<(typeof SPLIT_STRATEGIES)[number]>('auto');
   const [splitTarget, setSplitTarget] = useState(5000);
 
+  // JSON editor state lives here, not in JsonTab, so a tab change (or the
+  // header's Validate/Estimate shortcuts, which also change tabs) can guard
+  // against silently discarding a draft — mirrors SkillPage.tsx's
+  // editing/draft/dirty/beforeunload pattern (SkillPage.tsx:172-231).
+  const [editingJson, setEditingJson] = useState(false);
+  const [jsonDraft, setJsonDraft] = useState('');
+  const [jsonError, setJsonError] = useState('');
+  // The revision sent on save is pinned at the moment editing starts, not
+  // re-read from `data.revision` at save time — `data` can be refreshed from
+  // under an open editor (job polling, a manual reload), which would silently
+  // swap in a fresher revision and defeat the 409 conflict check.
+  const [pinnedRevision, setPinnedRevision] = useState('');
+
+  const dirty = editingJson && data !== null && jsonDraft !== JSON.stringify(data.data, null, 2);
+  useEffect(() => {
+    if (!dirty) return;
+    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
+    window.addEventListener('beforeunload', warn);
+    return () => window.removeEventListener('beforeunload', warn);
+  }, [dirty]);
+
   // Estimate/sync-check/push/submit/generate all run as background jobs whose
   // results only land once the job finishes and rewrites the config's
   // sidecar files, so re-read the detail whenever a job's signature changes
   // (mirrors SkillPage's jobsKey effect). Skipped while no job has ever run
-  // for this workspace, so a quiet page does not double-fetch on mount.
+  // for this workspace (so a quiet page does not double-fetch on mount) and
+  // while the JSON editor is open (a background reload would replace `data`
+  // out from under an in-progress edit).
   const jobsKey = store.jobs.map((j) => `${j.id}:${j.status}:${j.progress}`).join(',');
   useEffect(() => {
-    if (jobsKey) reload();
+    if (jobsKey && !editingJson) reload();
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [jobsKey]);
 
@@ -146,6 +1
```

**File**: `ui/src/sections/Library.tsx` (modified, +20/-1)
```diff
@@ -6,7 +6,8 @@ import { usePagination } from '@/hooks/use-pagination';
 import { Button } from '@/components/ui/button';
 import { Input } from '@/components/ui/input';
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
-import { GitBranch, Plus, RefreshCw, FileJson, ArrowUpCircle, Trash2, CloudDownload, Search } from 'lucide-react';
+import { GenerateConfigForm } from '@/components/generate-config-form';
+import { GitBranch, Plus, RefreshCw, FileJson, ArrowUpCircle, Sparkles, Trash2, CloudDownload, Search } from 'lucide-react';
 import { cn } from '@/lib/utils';
 
 const ORIGIN_STYLE: Record<ConfigEntry['origin'], string> = {
@@ -38,6 +39,7 @@ export default function Library({
   const { pending } = useStore();
   const [activeSource, setActiveSource] = useState<string>('all');
   const [addOpen, setAddOpen] = useState(false);
+  const [generateOpen, setGenerateOpen] = useState(false);
   const [repo, setRepo] = useState('');
   const [query, setQuery] = useState('');
 
@@ -65,6 +67,9 @@ export default function Library({
               <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
               <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="filter configs…" className="pl-8 h-8 font-mono-hud text-xs bg-secondary/50" />
             </div>
+            <Button size="sm" variant="outline" onClick={() => setGenerateOpen(true)} className="font-mono-hud text-xs uppercase tracking-wider">
+              <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Generate with AI
+            </Button>
             <Button size="sm" onClick={() => setAddOpen(true)} className="font-mono-hud text-xs uppercase tracking-wider">
               <Plus className="mr-1.5 h-3.5 w-3.5" /> Add config source
             </Button>
@@ -200,6 +205,20 @@ export default function Library({
         <Pager page={pager.page} pageCount={pager.pageCount} pageSize={pager.pageSize} total={pager.total} onPage={pager.setPage} onPageSize={pager.setPageSize} />
       </Panel>
 
+      {/* generate with AI dialog */}
+      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
+        <DialogContent className="!fixed hud-panel border-border sm:max-w-md">
+          <DialogHeader>
+            <DialogTitle className="font-mono-hud text-sm uppercase tracking-[0.2em] text-primary">// Generate with AI</DialogTitle>
+            <DialogDescription className="text-xs text-muted-foreground">
+              Draft a new unified config from a docs URL, a framework name, or a local project directory. Runs as a background job and
+              lands in this library when it finishes.
+            </DialogDescription>
+          </DialogHeader>
+          <GenerateConfigForm onGenerated={() => setGenerateOpen(false)} />
+        </DialogContent>
+      </Dialog>
+
       {/* add source dialog */}
       <Dialog open={addOpen} onOpenChange={setAddOpen}>
         <DialogContent className="!fixed hud-panel border-border sm:max-w-md">
```

**File**: `ui/tests/pages.spec.ts` (modified, +35/-0)
```diff
@@ -116,6 +116,41 @@ test('config page validates, edits with revision, and toggles sync', async ({ pa
   await expect(page.getByText(/valid/i).first()).toBeVisible();
 });
 
+test('sync toggle updates the stats strip and survives a tab switch', async ({ page }) => {
+  let syncSettings: unknown = null;
+  await page.route('**/api/configs/cfg-1', route => route.fulfill({ json: { id: 'cfg-1', name: 'react.json', path: '/ws/configs/react.json', source: 'official', origin: 'preset', framework: 'react', version: '2.1', data: { name: 'react', sources: [] }, revision: 'c1', validation: { valid: true, errors: [], warnings: [] }, usedBy: [], sync: null, syncSettings, lastEstimate: null } }));
+  await page.route('**/api/configs/cfg-1/sync', route => { syncSettings = route.request().postDataJSON(); return route.fulfill({ json: { ok: true, syncSettings } }); });
+  await page.goto('/configs/cfg-1');
+  await page.getByRole('tab', { name: 'Sync' }).click();
+  await page.getByRole('switch', { name: 'Watch upstream docs for changes' }).click();
+  await expect(page.getByText(/watching/i).first()).toBeVisible();
+  await page.getByRole('tab', { name: 'JSON' }).click();
+  await page.getByRole('tab', { name: 'Sync' }).click();
+  await expect(page.getByRole('switch', { name: 'Watch upstream docs for changes' })).toBeChecked();
+});
+
+test('json edits ask before discarding on tab change', async ({ page }) => {
+  await page.goto('/configs/cfg-1');
+  await page.getByRole('tab', { name: 'JSON' }).click();
+  await page.getByRole('button', { name: 'Edit', exact: true }).click();
+  const editor = page.getByRole('textbox', { name: 'Config JSON' });
+  await editor.fill('{"name":"changed","sources":[]}');
+  page.once('dialog', d => d.dismiss());
+  await page.getByRole('tab', { name: 'Validate' }).click();
+  await expect(editor).toHaveValue('{"name":"changed","sources":[]}');
+});
+
+test('library generates a config with AI from a docs URL', async ({ page }) => {
+  let generated: unknown = null;
+  await page.route('**/api/configs/generate', route => { generated = route.request().postDataJSON(); return route.fulfill({ json: { ok: true, job: { id: 'g1' } } }); });
+  await page.goto('/configs');
+  await page.getByRole('button', { name: 'Generate with AI' }).click();
+  await page.getByRole('textbox', { name: 'Docs URL' }).fill('https://docs.example.com/start');
+  await page.getByRole('button', { name: 'Generate config' }).click();
+  await expect.poll(() => generated).toEqual({ kind: 'url', value: 'https://docs.example.com/start', probe_urls: true });
+  await expect(page.getByRole('dialog')).toHaveCount(0);
+});
+
 // The skill page packs eight tabs of tables, chip rows and card grids into the
 // same column the nav sections use; every one of them has to fit the narrow
 // viewports hud.spec.ts pins for the rest of the HUD.
```

#### Recent Merged Pull Requests:
- **PR #473** (2026-09-20): fix(enhance): honour the configured default enhance level; correct enhance docs (@yusufkaraaslan)
- **PR #472** (2026-09-20): feat(sponsors): add Fluxion AI as Bronze sponsor (@yusufkaraaslan)
- **PR #471** (2026-09-16): test(benchmark): make compare test deterministic (@yusufkaraaslan)
- **PR #470** (2026-09-16): chore(sponsors): remove lapsed RapidProxy and Atlas Cloud placements (@yusufkaraaslan)
- **PR #468** (2026-09-20): feat: support MiniMax video input and thinking modes (@octo-patch)
- **PR #465** (closed): fix(enhance): accept --enhance-level on skill-seekers-enhance (@christianare)
- **PR #464** (2026-09-20): fix(security): validate Git config cache names (@emecii)
- **PR #463** (2026-09-20): feat(index): add opt-in SQLite skill search (@emecii)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
