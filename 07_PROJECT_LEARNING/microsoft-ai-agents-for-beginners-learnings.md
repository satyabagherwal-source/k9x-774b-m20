# Forensic Learning Record (Deep Inspection): microsoft/ai-agents-for-beginners

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-ai-agents-for-beginners-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/ai-agents-for-beginners](https://github.com/microsoft/ai-agents-for-beginners))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:56:42.698Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/ai-agents-for-beginners`
- **Description**: 18 Lessons to Get Started Building AI Agents
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 76494 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `11-agentic-protocols/code_samples/mcp-agents/client/utils.py`
```
#!/usr/bin/env python3
"""
Client Utilities for MCP Session Management

This module provides utilities for managing MCP client sessions,
including token persistence and session resumption.
"""

import json
import os
from typing import Optional, Dict, Any

from rich.console import Console

# Import shared constants locally
DEFAULT_TOKEN_FILE = "resumption_tokens.json"

console = Console()


def cast_input_value(value: str, prop_info: dict):
    """Cast input value to the correct type based on schema property info."""
    if not value:
        return value
    
    prop_type = prop_info.get("type", "string")
    
    try:
        if prop_type == "integer":
            return int(value)
        elif prop_type == "number":
            return float(value)
        elif prop_type == "boolean":
            return value.lower() in ['true', 't', 'yes', 'y', '1']
        else:  # string or other types
            return value
    except ValueError:
        # If casting fails, return the original string
        return value


class TokenManager:
    """Manages resumption tokens and session information."""
    
    def __init__(self, token_file: str = DEFAULT_TOKEN_FILE):
        self.token_file = token_file
    
    def save_tokens(self, session_id: str, resumption_token: str, protocol_version: Optional[str] = None, 
                   last_tool: Optional[str] = None, last_args: Optional[dict] = None) -> bool:
        """Save session ID, resumption token, protocol version, and last tool info to file.
        
        Only creates a token file when we have an actual resumption token from the server.
        Never creates empty or placeholder token files.
        """
        # Validate that we have real tokens, not placeholders
        if not session_id or not resumption_token:
            console.print(f"[red]✗ Cannot save tokens: missing session_id or resumption_token[/red]")
            return False
            
        if resumption_token.startswith("pending_") or resumption_token.startswith("temp_"):
            console.print(f"[red]✗ Cannot save placeholder token: {resumption_token}[/red]")
            return False
        
        data: Dict[str, Any] = {
            "session_id": session_id,
            "resumption_token": resumption_token,
        }
        if protocol_version:
            data["protocol_version"] = protocol_version
        if last_tool:
            data["last_tool"] = last_tool
        if last_args:
            data["last_args"] = last_args
        
        try:
            with open(self.token_file, 'w') as f:
                json.dump(data, f, indent=2)
            console.print(f"[green]✓ Saved resumption token to {self.token_file}[/green]")
            return True
        except Exception as e:
            console.print(f"[red]✗ Failed to save tokens: {e}[/red]")
            return False
    
    def load_tokens(self) -> Optional[Dict[str, Any]]:
        """Load session ID, resumption token, and tool info from file."""
        if not os.path.exists(self.token_file):
            console.print(f"[yellow]No resumption token file found ({self.token_file})[/yellow]")
            return None
            
        try:
            with open(self.token_file, 'r') as f:
                data = json.load(f)
            
            if "session_id" in data and "resumption_token" in data:
                console.print(f"[cyan]📄 Found resumption tokens in {self.token_file}[/cyan]")
                console.print(f"[cyan]   Session ID: {data['session_id']}[/cyan]")
                console.print(f"[cyan]   Token: {data['resumption_token'][:20]}...[/cyan]")
                if "last_tool" in data:
                    console.print(f"[cyan]   Last Tool: {data['last_tool']}[/cyan]")
                return data
            else:
                console.print(f"[yellow]Invalid token file format[/yellow]")
                return None
                
        except Exception as e:
            console.print(f"[red]✗ Failed to load tokens: {e}[/red]")
            return None
    
    def delete_tokens(self) -> bool:
        """Delete the resumption token file."""
        try:
            if os.path.exists(self.token_file):
                os.remove(self.token_file)
                return True
            else:
                return False
        except Exception as e:
            console.print(f"[red]✗ Failed to delete token file: {e}[/red]")
            return False

```

### Core Architecture Module: `.agents/skills/azure-openai-to-responses/scripts/detect_legacy.py`
```
#!/usr/bin/env python3
"""Detect legacy Azure OpenAI Chat Completions patterns in a Python codebase.

Usage:
    python detect_legacy.py <directory>
    python detect_legacy.py .                  # current directory
    python detect_legacy.py src/ tests/        # multiple directories

Scans for legacy OpenAI Chat Completions API usage, deprecated Azure client
constructors, response shape access patterns, deprecated parameters, and
test infrastructure that needs updating for the Responses API migration.

Exit codes:
    0 — no legacy patterns found
    1 — legacy patterns found (migration needed)
"""

import argparse
import re
import sys
from pathlib import Path

# Legacy patterns grouped by category
# Each entry: (regex_pattern, description, category)
PATTERNS: list[tuple[str, str, str]] = [
    # Legacy API calls
    (r"chat\.completions\.create", "Chat Completions API call", "api-call"),
    (r"ChatCompletion\.create", "Legacy ChatCompletion.create", "api-call"),
    (r"Completion\.create", "Legacy Completion.create", "api-call"),
    # Deprecated Azure client constructors
    (r"AzureOpenAI\(", "Deprecated AzureOpenAI constructor", "client"),
    (r"AsyncAzureOpenAI\(", "Deprecated AsyncAzureOpenAI constructor", "client"),
    # Response shape access patterns
    (r"choices\[0\]\.message\.content", "Chat Completions response access", "response-shape"),
    (r"choices\[0\]\.delta\.content", "Chat Completions streaming access", "response-shape"),
    (r"choices\[0\]\.message\.function_call", "Legacy function_call access", "response-shape"),
    (r"choices\[0\]\.message\.tool_calls", "Legacy tool_calls access", "response-shape"),
    (r"choices\[0\]", "Generic choices[0] access", "response-shape"),
    # Deprecated parameters
    (r"\bmax_tokens\b", "Deprecated max_tokens (use max_output_tokens)", "parameter"),
    (r"\bmax_completion_tokens\b", "Azure o-series max_completion_tokens (use max_output_tokens)", "parameter"),
    (r"""['"]seed['"]""" , "Unsupported seed parameter", "parameter"),
    (r"\bresponse_format\b", "Legacy response_format (use text.format)", "parameter"),
    (r"\breasoning_effort\b", "O-series reasoning_effort (migrate to reasoning={'effort': ...})", "parameter"),
    (r"\btop_p\b", "top_p parameter (not supported on o-series models)", "parameter"),
    # Deprecated env vars
    (r"AZURE_OPENAI_API_VERSION|AZURE_OPENAI_VERSION", "Deprecated api_version env var", "env-var"),
    (r"AZURE_OPENAI_CLIENT_ID", "Should be AZURE_CLIENT_ID", "env-var"),
    # GitHub Models (not supported by Responses API — must remove)
    (r"models\.github\.ai|models\.inference\.ai\.azure", "GitHub Models endpoint (Responses API not supported — remove)", "github-models"),
    # Framework-level legacy patterns
    (r"OpenAIChatCompletionClient", "MAF OpenAIChatCompletionClient (uses Chat Completions; replace with OpenAIChatClient in 1.0.0+)", "framework"),
    # Test infrastructure
    (r"ChatCompletionChunk", "Legacy mock type in tests", "test"),
    (r"AsyncCompletions\.create", "Legacy mock patch path in tests", "test"),
    (r"_azure_ad_token_provider", "Legacy Azure AD assertion in tests", "test"),
    (r"prompt_filter_results", "Azure-specific filter mock in tests", "test"),
    (r"content_filter_results", "Azure-specific filter mock in tests", "test"),
]

SKIP_DIRS = {
    ".git", ".venv", "venv", "__pycache__", "node_modules",
    ".tox", ".mypy_cache", ".pytest_cache", "dist", "build",
    ".github",  # don't scan the agent definition
    "skills",   # don't scan the skill itself
}

# Files that reference legacy patterns intentionally (docs, tooling)
SKIP_FILES = {
    "README.md",
    "migrate.py",
    "find_legacy_openai_repos.py",
    "detect_legacy.py",
    "bulk_migrate.py",
}

EXTENSIONS = {".py", ".env", ".toml", ".cfg", ".ini", ".txt", ".md", ".yml", ".yaml", ".bicep", ".json"}


def scan_file(path: Path) -> list[tuple[int, str, str, str]]:
    """Scan a single file for legacy patterns. Returns list of (line_no, line, description, category)."""
    hits: list[tuple[int, str, str, str]] = []
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return hits

    for line_no, line in enumerate(text.splitlines(), start=1):
        for pattern, description, category in PATTERNS:
            if re.search(pattern, line):
                hits.append((line_no, line.strip(), description, category))
    return hits


def scan_directory(root: Path) -> dict[str, list[tuple[int, str, str, str]]]:
    """Walk a directory tree and return {filepath: [(line, text, desc, cat), ...]}."""
    results: dict[str, list[tuple[int, str, str, str]]] = {}
    for path in sorted(root.rglob("*")):
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.name in SKIP_FILES:
            continue
        if path.is_file() and path.suffix in EXTENSIONS:
            hits = scan_file(path)
            if hits:
                results[str(path)] = hits
    return results


def print_report(all_results: dict[str, list[tuple[int, str, str, str]]]) -> int:
    """Print a grouped report and return total hit count."""
    total = 0
    categories: dict[str, list[tuple[str, int, str, str]]] = {}

    for filepath, hits in all_results.items():
        for line_no, line_text, description, category in hits:
            categories.setdefault(category, []).append((filepath, line_no, line_text, description))
            total += 1

    if total == 0:
        print("[PASS] No legacy Chat Completions patterns found.")
        return 0

    category_labels = {
        "api-call": "Legacy API Calls (must rewrite)",
        "client": "Deprecated Azure Client Constructors (must replace)",
        "response-shape": "Response Shape Access (must update)",
        "parameter": "Deprecated Parameters (must remove/rename)",
        "env-var": "Deprecated Environment Variables (must clean up)",
        "test": "Test Infrastructure (must update)",
    }

    print(f"[SCAN] Found {total} legacy pattern(s) across {len(all_results)} file(s):\n")

    for cat_key in ["api-call", "client", "response-shape", "parameter", "env-var", "test"]:
        items = categories.get(cat_key, [])
        if not items:
            continue
        print(f"## {category_labels[cat_key]} ({len(items)} hit(s))\n")
        for filepath, line_no, line_text, description in items:
            print(f"  {filepath}:{line_no}")
            print(f"    {description}")
            print(f"    > {line_text[:120]}")
            print()

    print(f"---\nTotal: {total} legacy pattern(s) in {len(all_results)} file(s).")
    print("Run the migration skill to fix these.")
    return total


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Detect legacy Azure OpenAI Chat Completions patterns."
    )
    parser.add_argument(
        "directories",
        nargs="+",
        help="Directories to scan",
    )
    args = parser.parse_args()

    all_results: dict[str, list[tuple[int, str, str, str]]] = {}
    for d in args.directories:
        root = Path(d)
        if not root.is_dir():
            print(f"Warning: {d} is not a directory, skipping.", file=sys.stderr)
            continue
        all_results.update(scan_directory(root))

    total = print_report(all_results)
    sys.exit(1 if total > 0 else 0)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `.agents/skills/jupyter-notebook/scripts/new_notebook.py`
```
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any


def slugify(text: str) -> str:
    lowered = text.strip().lower()
    cleaned = re.sub(r"[^a-z0-9]+", "-", lowered)
    collapsed = re.sub(r"-+", "-", cleaned).strip("-")
    return collapsed or "notebook"


def find_repo_root(start: Path) -> Path:
    for candidate in (start, *start.parents):
        if (candidate / ".git").exists():
            return candidate
    return start


def load_template(skill_dir: Path, kind: str) -> dict[str, Any]:
    asset_name = "experiment-template.ipynb" if kind == "experiment" else "tutorial-template.ipynb"
    template_path = skill_dir / "assets" / asset_name
    if not template_path.exists():
        raise SystemExit(f"Missing template: {template_path}")
    with template_path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise SystemExit(f"Unexpected template shape: {template_path}")
    return data


def update_title(notebook: dict[str, Any], kind: str, title: str) -> None:
    prefix = "Experiment" if kind == "experiment" else "Tutorial"
    expected = f"# {prefix}: {title}\n"

    cells = notebook.get("cells")
    if not isinstance(cells, list) or not cells:
        raise SystemExit("Template notebook has no cells")

    first_cell = cells[0]
    if not isinstance(first_cell, dict) or first_cell.get("cell_type") != "markdown":
        raise SystemExit("Template notebook must start with a markdown title cell")

    source = first_cell.get("source", [])
    if isinstance(source, str):
        source_lines = [source]
    elif isinstance(source, list):
        source_lines = [str(line) for line in source]
    else:
        source_lines = []

    if source_lines:
        source_lines[0] = expected
    else:
        source_lines = [expected]

    first_cell["source"] = source_lines

    metadata = notebook.setdefault("metadata", {})
    if not isinstance(metadata, dict):
        raise SystemExit("Notebook metadata must be a mapping")

    language_info = metadata.setdefault("language_info", {})
    if isinstance(language_info, dict):
        language_info.setdefault("name", "python")
        language_info.setdefault("version", "3.12")


def default_output(repo_root: Path, title: str) -> Path:
    filename = f"{slugify(title)}.ipynb"
    return repo_root / "output" / "jupyter-notebook" / filename


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Scaffold a Jupyter notebook for experiments or tutorials.")
    parser.add_argument(
        "--kind",
        choices=["experiment", "tutorial"],
        default="experiment",
        help="Notebook style to scaffold (default: experiment).",
    )
    parser.add_argument(
        "--title",
        required=True,
        help="Human-readable notebook title used in the first markdown cell.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output path for the notebook. Defaults to output/jupyter-notebook/<slug>.ipynb.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite the output file if it already exists.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    script_path = Path(__file__).resolve()
    skill_dir = script_path.parents[1]
    repo_root = find_repo_root(skill_dir)

    notebook = load_template(skill_dir, args.kind)
    update_title(notebook, args.kind, args.title)

    out_path = args.out or default_output(repo_root, args.title)
    out_path = out_path.resolve()

    if out_path.exists() and not args.force:
        raise SystemExit(f"Refusing to overwrite existing file without --force: {out_path}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(notebook, f, indent=2)
        f.write("\n")

    print(f"Wrote {out_path} using kind={args.kind}.")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `11-agentic-protocols/code_samples/github-mcp/app.py`
```
import os
import json
import logging
logging.getLogger("agent_framework.foundry").setLevel(logging.ERROR)
from typing import Annotated
from dotenv import load_dotenv
import requests
import re

import chainlit as cl
from mcp import ClientSession

from agent_framework import tool, AgentResponseUpdate, WorkflowBuilder
from agent_framework.foundry import FoundryChatClient
from azure.identity import AzureCliCredential
from azure.core.credentials import AzureKeyCredential

from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import SearchIndex, SimpleField, SearchFieldDataType, SearchableField


# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# Initialize Azure AI Search with persistent storage
search_service_endpoint = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT")
search_api_key = os.getenv("AZURE_SEARCH_API_KEY")
index_name = "event-descriptions"

search_client = SearchClient(
    endpoint=search_service_endpoint,
    index_name=index_name,
    credential=AzureKeyCredential(search_api_key)
)

index_client = SearchIndexClient(
    endpoint=search_service_endpoint,
    credential=AzureKeyCredential(search_api_key)
)

# Define the index schema
fields = [
    SimpleField(name="id", type=SearchFieldDataType.String, key=True),
    SearchableField(name="content", type=SearchFieldDataType.String)
]

index = SearchIndex(name=index_name, fields=fields)

# Check if index already exists if not, create it
try:
    existing_index = index_client.get_index(index_name)
    print(f"Index '{index_name}' already exists, using the existing index.")
except Exception as e:
    # Create the index if it doesn't exist
    print(f"Creating new index '{index_name}'...")
    index_client.create_index(index)

# Always read event descriptions from markdown file
current_dir = os.path.dirname(os.path.abspath(__file__))
event_descriptions_path = os.path.join(current_dir, "event-descriptions.md")

try:
    with open(event_descriptions_path, "r", encoding='utf-8') as f:
        markdown_content = f.read()
except FileNotFoundError:
    logger.warning(f"Could not find {event_descriptions_path}")
    markdown_content = ""

# Split the markdown content into individual event descriptions
event_descriptions = markdown_content.split("---")  # You can change the delimiter

# Create documents for Azure Search
documents = []
for i, description in enumerate(event_descriptions):
    description = description.strip()  # Remove leading/trailing whitespace
    if description:  # Avoid empty descriptions
        documents.append({"id": str(i + 1), "content": description})

# Add documents to the index (only if we have documents)
if documents:
    # Delete existing documents first to avoid duplicates
    try:
        search_client.delete_documents(documents=[{"id": doc["id"]} for doc in documents])
        print("Cleared existing documents")
    except Exception as e:
        print(f"Warning: Failed to clear existing documents: {str(e)}")
    
    # Upload new documents
    search_client.upload_documents(documents)
    print(f"Uploaded {len(documents)} documents to index")


# RAG tool for event search
@tool
def search_events(
    query: Annotated[str, "The search query to find relevant events"]
) -> str:
    """Searches for relevant events based on a query using Azure Search and a live API."""
    context_strings = []
    try:
        results = search_client.search(query, top=5)
        for result in results:
            if 'content' in result:
                context_strings.append(f"Event: {result['content']}")
    except Exception as e:
        context_strings.append(f"Error searching Azure Search: {str(e)}")
    # Live API (example: Devpost hackathons)
    try:
        api_resp = requests.get(f"https://devpost.com/api/hackathons?search={query}", timeout=5)
        if api_resp.ok:
            data = api_resp.json()
            for event in data.get('hackathons', [])[:5]:
                context_strings.append(f"Live Event: {event.get('title')} - {event.get('url')}")
    except Exception as e:
        context_strings.append(f"Error fetching live events: {str(e)}")
    if context_strings:
        return "\n\n".join(context_strings)
    else:
        return "No relevant events found."


def flatten(xss):
    return [x for xs in xss for x in xs]


GITHUB_INSTRUCTIONS = """
You are an expert on GitHub repositories. When answering questions, you **must** use the provided GitHub username to find specific information about that user's repositories, including:

*   Who created the repositories
*   The programming languages used
*   Information found in files and README.md files within those repositories
*   Provide links to each repository referenfced in your answers

**Important:** Never perform general searches for repositories. Always use the given GitHub username to find the relevant information. If a GitHub username is not provided, state that you need a username to proceed.
"""

HACKATHON_AGENT = """
You are an AI Agent Hackathon Strategist specializing in recommending winning project ideas.

Your task:
1. Analyze the GitHub activity of users to understand their technical skills
2. Suggest creative AI Agent projects tailored to their expertise. 
3. Focus on projects that align with Microsoft's AI Agent Hackathon prize categories

When making recommendations:
- Base your ideas strictly on the user's GitHub repositories, languages, and tools
- Give suggestions on tools, languages and frameworks to use to build it. 
- Provide detailed project descriptions including architecture and implementation approach
- Explain why the project has potential to win in specific prize categories
- Highlight technical feasibility given the user's demonstrated skills by referencing the specific repositories or languages used.

Formatting your response:
- Provide a clear and structured response that includes:
    - Suggested Project Name
    - Project Description 
    - Potential languages and tools to use
    - Link to each relevant GitHub repository you based your recommendation on

Hackathon prize categories:
- Best Overall Agent ($20,000)
- Best Agent in Python ($5,000)
- Best Agent in C# ($5,000)
- Best Agent in Java ($5,000)
- Best Agent in JavaScript/TypeScript ($5,000)
- Best Copilot Agent using Microsoft Copilot Studio or Microsoft 365 Agents SDK ($5,000)
- Best Microsoft Foundry Agent Service Usage ($5,000)
        
"""

EVENTS_AGENT = """
You are an Event Recommendation Agent specializing in suggesting relevant tech events.

Your task:
1. Review the project idea recommended by the Hackathon Agent
2. Use the search_events function to find relevant events based on the technologies mentioned.
3. NEVER suggest and event that the where there is not a relevant technology that the user has used.
3. ONLY recommend events that were returned by the search_events functionf

When making recommendations:
- IMPORTANT: You must first call the search_events function with appropriate technology keywords from the project
- Only recommend events that were explicitly returned by the search_events function
- Do not make up or suggest events that weren't in the search results
- Construct search queries using specific technologies mentioned (e.g., "Python AI workshop" or "JavaScript hackathon")
- Try multiple search queries if needed to find the most relevant events


For each recommended event:
- Only include events found in the search_events results
- Explain the direct connection between the event and the specific project requirements
- Highlight relevant workshops, sessions, or networking opportunities

Formatting your response:
- Start with "Based on the hackathon project idea, here are relevant events that I found:"
- Only list events that were returned by the search_events function
- For each event, include the exact event details as returned by search_events
- Explain specifically how each event relates to the project technologies

If no relevant events are found, acknowledge this and suggest trying different search terms instead of making up events.
"""


@cl.on_mcp_connect
async def on_mcp(connection, session: ClientSession):
    logger.info(f"MCP Connection established: {connection.name}")
    result = await session.list_tools()
    tools = [{
        "name": t.name,
        "description": t.description,
        "input_schema": t.inputSchema,
    } for t in result.tools]

    mcp_tools = cl.user_session.get("mcp_tools", {})
    mcp_tools[connection.name] = tools
    cl.user_session.set("mcp_tools", mcp_tools)
    
    # Log available tools
    print(f"Available MCP tools for {connection.name}:")
    for t in tools:
        print(f"  - {t['name']}: {t['description']}")

@cl.step(type="tool")
async def call_tool(tool_use):
    tool_name = tool_use.name
    tool_input = tool_use.input

    current_step = cl.context.current_step
    current_step.name = tool_name

    # Identify which mcp is used
    mcp_tools = cl.user_session.get("mcp_tools", {})
    mcp_name = None

    for connection_name, tools in mcp_tools.items():
        if any(t.get("name") == tool_name for t in tools):
            mcp_name = connection_name
            break

    if not mcp_name:
        current_step.output = json.dumps(
            {"error": f"Tool {tool_name} not found in any MCP connection"})
        return current_step.output

    mcp_session, _ = cl.context.session.mcp_sessions.get(mcp_name)

    if not mcp_session:
        current_step.output = json.dumps(
            {"error": f"MCP {mcp_name} not found in any MCP connection"})
        return current_step.output

    try:
        current_step.output = await mcp_session.call_tool(tool_name, tool_input)
    except Exception as e:
        current_step.output = json.dumps({"error": str(e)})

    return 
```

### Core Architecture Module: `11-agentic-protocols/code_samples/mcp-agents/client/__init__.py`
```
"""
MCP Client implementations.

This package contains various MCP client implementations:
- client.py: Basic MCP client
- resumable_client.py: Client with resumption support
- utils.py: Utility functions for token management, etc.
"""

```

### Core Architecture Module: `11-agentic-protocols/code_samples/mcp-agents/client/client.py`
```
#!/usr/bin/env python3
"""
Interactive MCP Client for Agent-to-Agent Communication Tutorial
"""

import asyncio
import argparse
import logging
from typing import Dict, Any

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from mcp.server.streamable_http import MCP_SESSION_ID_HEADER, MCP_PROTOCOL_VERSION_HEADER
from mcp.shared.message import ClientMessageMetadata
import mcp.types as types
from rich.console import Console
from rich.panel import Panel

from .utils import TokenManager, cast_input_value

console = Console()


def display_tools(tools):
    """Display available tools as a simple list."""
    console.print("[bold]Available Tools:[/bold]")
    for tool in tools:
        tool_type = "🤖" if any(word in tool.name.lower() for word in ["agent", "travel", "research"]) else "🔧"
        console.print(f"  {tool_type} [cyan]{tool.name}[/cyan]")
    console.print()
    console.print("[dim]Type a tool name to run it with default arguments[/dim]")


def extract_text_content(result) -> str:
    """Extract text content from tool result."""
    for content in result.content:
        if hasattr(content, 'text'):
            return content.text
    return "No text content available"


async def execute_tool_with_resumption(session, command: str, args: dict, get_session_id, on_resumption_token_update, existing_tokens=None, token_manager=None):
    """Execute a tool with resumption support using send_request."""
    current_session_id = get_session_id()
    if not current_session_id:
        raise RuntimeError("No session ID available - resumption requires a valid session")
    
    session_id = current_session_id
    
    # If we have an existing resumption token, pass it for resumption
    if existing_tokens and existing_tokens.get("resumption_token"):
        metadata = ClientMessageMetadata(
            resumption_token=existing_tokens["resumption_token"],
        )
    else:
        # Create enhanced callback that saves tool context immediately when token is received
        def enhanced_callback(token: str):
            # Since callback fires immediately with the actual resumption token,
            # save everything needed for resumption right away
            protocol_version = getattr(session, 'protocol_version', None)
            if token_manager:
                token_manager.save_tokens(session_id, token, protocol_version, command, args)
            # Also call the original callback
            return on_resumption_token_update(session_id, token, command, args)
        
        metadata = ClientMessageMetadata(
            on_resumption_token_update=enhanced_callback,
        )
    
    result = await session.send_request(
        types.ClientRequest(
            types.CallToolRequest(
                method="tools/call",
                params=types.CallToolRequestParams(
                    name=command,
                    arguments=args
                ),
            )
        ),
        types.CallToolResult,
        metadata=metadata,
    )
    
    return result


async def interactive_mode(server_url: str):
    """Run interactive mode with tool exploration."""
    # Configure logging to suppress noisy SSE parsing errors
    logging.getLogger('mcp.client.streamable_http').setLevel(logging.ERROR)
    
    # Filter out specific SSE JSON parsing errors
    class SSEFilter(logging.Filter):
        def filter(self, record):
            # Suppress "Error parsing SSE message" and JSON validation errors
            if ("Error parsing SSE message" in record.getMessage() or 
                "ValidationError" in record.getMessage() or
                "EOF while parsing" in record.getMessage()):
                return False
            return True
    
    # Apply filter to relevant loggers
    for logger_name in ['mcp.client.streamable_http', 'mcp', 'pydantic_core']:
        logger = logging.getLogger(logger_name)
        logger.addFilter(SSEFilter())
    
    console.print(Panel("[bold cyan]🎮 Interactive MCP Client[/bold cyan]", expand=False))
    console.print("[dim]Explore MCP server tools interactively[/dim]\n")
    
    # Check for existing resumption tokens
    token_manager = TokenManager()
    existing_tokens: Dict[str, Any] | None = token_manager.load_tokens()
    
    # Prepare headers for resumption if tokens exist
    headers = {}
    if existing_tokens:
        headers[MCP_SESSION_ID_HEADER] = existing_tokens["session_id"]
        if "protocol_version" in existing_tokens:
            headers[MCP_PROTOCOL_VERSION_HEADER] = existing_tokens["protocol_version"]
        console.print(f"[cyan]🔄 Found existing session, attempting resumption...[/cyan]")
    
    try:
        async with streamablehttp_client(
            server_url,
            headers=headers if headers else None,
            terminate_on_close=False  # Enable resumption
        ) as (read_stream, write_stream, get_session_id):
            
            # Create message handler for real-time notifications
            async def message_handler(message) -> None:
                try:
                    if isinstance(message, types.ServerNotification):
                        if isinstance(message.root, types.LoggingMessageNotification):
                            console.print(f"📡 [dim]{message.root.params.data}[/dim]")
                        elif isinstance(message.root, types.ProgressNotification):
                            progress = message.root.params
                            console.print(f"🔄 [yellow]{progress.message} ({progress.progress}/{progress.total})[/yellow]")
                        elif isinstance(message.root, types.ResourceUpdatedNotification):
                            console.print(f"� [blue]Resource updated: {message.root.params.uri}[/blue]")
                except Exception:
                    # Silently ignore message handler errors
                    pass
            
            # Add sampling callback for research agent
            async def sampling_callback(context, params):
                try:
                    message_text = params.messages[0].content.text if params.messages else 'No message'
                    console.print(f"\n🧠 [bold cyan]Server requested sampling:[/bold cyan]")
                    console.print(f"   [yellow]{message_text}[/yellow]")
                    
                    # Mock response instead of prompting user
                    mock_response = "Based on current research, MCP has evolved significantly with new features like resumable streams, elicitation, and sampling capabilities, enabling sophisticated agent-to-agent communication patterns."
                    
                    console.print(f"[dim]🤖 Auto-responding with mock data:[/dim]")
                    console.print(f"   [green]{mock_response[:80]}...[/green]")
                    
                    return types.CreateMessageResult(
                        role="assistant",
                        content=types.TextContent(
                            type="text",
                            text=mock_response
                        ),
                        model="interactive-client",
                        stopReason="endTurn"
                    )
                except Exception as e:
                    return types.ErrorData(code=-1, message=str(e))
            
            # Add elicitation callback for travel agent  
            async def elicitation_callback(context, params):
                try:
                    console.print(f"\n💬 [bold yellow]Server is asking for confirmation:[/bold yellow]")
                    console.print(f"   [cyan]{params.message}[/cyan]")
                    
                    # Get user's decision
                    while True:
                        response = console.input("\n[bold]Do you accept? (y/n/details): [/bold]").strip().lower()
                        
                        if response in ['y', 'yes', 'accept']:
                            user_notes = console.input("[dim]Any additional notes (optional): [/dim]").strip()
                            console.print(f"[dim]✅ Sending acceptance with notes: '{user_notes or 'Confirmed by user'}'[/dim]")
                            return types.ElicitResult(
                                action="accept",
                                content={
                                    "confirm": True, 
                                    "notes": user_notes if user_notes else "Confirmed by user"
                                }
                            )
                        elif response in ['n', 'no', 'decline']:
                            reason = console.input("[dim]Reason for declining (optional): [/dim]").strip()
                            return types.ElicitResult(
                                action="decline",
                                content={
                                    "confirm": False,
                                    "notes": reason if reason else "Declined by user"
                                }
                            )
                        elif response in ['d', 'details']:
                            console.print(f"[dim]Schema: {params.requestedSchema if hasattr(params, 'requestedSchema') else 'Not specified'}[/dim]")
                        else:
                            console.print("[red]Please enter 'y' (yes), 'n' (no), or 'd' (details)[/red]")
                            
                except Exception as e:
                    console.print(f"[red]Error in elicitation: {e}[/red]")
                    return types.ElicitResult(action="decline", content={"confirm": False, "notes": f"Error: {e}"})
            
            # Add resumption token callback for long-running tools
            async def on_resumption_token_update(session_id: str, resumption_token: str, tool_name: str, tool_args: dict):
                """Callback for when resumption token is updated during long-running operations."""
 
```

### Core Architecture Module: `11-agentic-protocols/code_samples/mcp-agents/client/resumable_client.py`
```
#!/usr/bin/env python3
"""
Minimal Resumable MCP Client

Simple client that demonstrates session resumption with the long_running_agent tool.
- If resumption token exists, resumes the session
- If no token exists, creates new session and saves token
- Clears token when task completes
"""

import argparse
import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Dict, Any, Optional

from mcp import ClientSession, types
from mcp.client.streamable_http import streamablehttp_client
from mcp.server.streamable_http import MCP_SESSION_ID_HEADER, MCP_PROTOCOL_VERSION_HEADER
from mcp.shared.message import ClientMessageMetadata
from mcp.types import TextContent

# Configure logging to suppress noisy SSE warnings
logging.basicConfig(level=logging.WARNING)
logger = logging.getLogger(__name__)

# Suppress specific noisy loggers
logging.getLogger('httpx').setLevel(logging.WARNING)
logging.getLogger('mcp.client.streamable_http').setLevel(logging.ERROR)
logging.getLogger('mcp').setLevel(logging.WARNING)
logging.getLogger('pydantic_core').setLevel(logging.ERROR)

# Filter out specific SSE JSON parsing errors
class SSEFilter(logging.Filter):
    def filter(self, record):
        return not (
            "Error parsing SSE message" in record.getMessage() or
            "Invalid JSON: EOF while parsing" in record.getMessage()
        )

# Apply filter to relevant loggers
for logger_name in ['mcp.client.streamable_http', 'mcp', 'pydantic_core']:
    log = logging.getLogger(logger_name)
    log.addFilter(SSEFilter())

# Token file location
TOKEN_FILE = Path(".mcp_resumption_token.json")


def load_resumption_tokens() -> Optional[Dict[str, Any]]:
    """Load resumption tokens from file."""
    if TOKEN_FILE.exists():
        try:
            with open(TOKEN_FILE, 'r') as f:
                tokens = json.load(f)
                logger.info(f"🔄 Loaded resumption tokens: session_id={tokens.get('session_id')}")
                return tokens
        except Exception as e:
            logger.error(f"Error loading tokens: {e}")
    return None


def save_resumption_tokens(session_id: str, resumption_token: str, protocol_version: str = "2025-03-26"):
    """Save resumption tokens to file."""
    tokens = {
        "session_id": session_id,
        "resumption_token": resumption_token,
        "protocol_version": protocol_version,
        "tool_name": "long_running_agent",
        "tool_args": {}
    }
    try:
        with open(TOKEN_FILE, 'w') as f:
            json.dump(tokens, f, indent=2)
        logger.info(f"💾 Saved resumption tokens: session_id={session_id}")
    except Exception as e:
        logger.error(f"Error saving tokens: {e}")


def clear_resumption_tokens():
    """Clear resumption tokens file."""
    if TOKEN_FILE.exists():
        try:
            TOKEN_FILE.unlink()
            logger.info("🗑️ Cleared resumption tokens")
        except Exception as e:
            logger.error(f"Error clearing tokens: {e}")


async def run_long_running_task(server_url: str):
    """Run the long_running_agent with resumption support."""
    
    # Check for existing tokens
    existing_tokens = load_resumption_tokens()
    
    # Prepare headers for resumption if tokens exist
    headers = {}
    if existing_tokens:
        headers[MCP_SESSION_ID_HEADER] = existing_tokens["session_id"]
        headers[MCP_PROTOCOL_VERSION_HEADER] = existing_tokens.get("protocol_version", "2025-03-26")
        print("🔄 Resuming existing session...")
    else:
        print("🆕 Creating new session...")
    
    try:
        async with streamablehttp_client(
            server_url,
            headers=headers if headers else None,
            terminate_on_close=False  # Enable resumption
        ) as (read_stream, write_stream, get_session_id):
            
            # Message handler for real-time notifications (standardized to use log messages)
            async def message_handler(message) -> None:
                try:
                    if isinstance(message, types.ServerNotification):
                        if isinstance(message.root, types.LoggingMessageNotification):
                            log_data = message.root.params
                            # Format log messages similar to progress notifications for consistency
                            print(f"📡 [{log_data.logger}] {log_data.data}")
                        elif isinstance(message.root, types.ProgressNotification):
                            # Keep support for progress notifications in case other tools use them
                            progress = message.root.params
                            print(f"📊 Progress: {progress.progress}/{progress.total} - {progress.message}")
                        elif isinstance(message.root, types.ResourceUpdatedNotification):
                            print(f"🔄 Resource updated: {message.root.params.uri}")
                except Exception:
                    # Silently ignore message handler errors to avoid breaking the flow
                    pass
            
            async with ClientSession(read_stream, write_stream, message_handler=message_handler) as session:
                
                # Only initialize if this is a new session (no existing tokens)
                if not existing_tokens:
                    result = await session.initialize()
                    print(f"✅ Session initialized: {result.serverInfo.name}")
                else:
                    print("✅ Using existing session (no initialization needed)")
                
                # Set up resumption token callback (matching test signature)
                async def on_resumption_token_update(token: str) -> None:
                    print(f"💾 Resumption token received: {token[:20]}...")
                    session_id = get_session_id()
                    if session_id:
                        protocol_version = getattr(session, 'negotiated_protocol_version', '2025-03-26')
                        save_resumption_tokens(session_id, token, protocol_version)
                        print(f"💾 Resumption token saved")
                
                # Prepare metadata with resumption support
                if existing_tokens and existing_tokens.get("resumption_token"):
                    # Resume existing task
                    print("🔄 Resuming long-running task...")
                    metadata = ClientMessageMetadata(
                        resumption_token=existing_tokens["resumption_token"]
                    )
                else:
                    # Start new task
                    print("🚀 Starting long-running task...")
                    metadata = ClientMessageMetadata(
                        on_resumption_token_update=on_resumption_token_update
                    )
                
                # Execute the long_running_agent tool
                try:
                    print("metadata:", metadata)
                    result = await session.send_request(
                        types.ClientRequest(
                            types.CallToolRequest(
                                method="tools/call",
                                params=types.CallToolRequestParams(
                                    name="long_running_agent",
                                    arguments={}
                                ),
                            )
                        ),
                        types.CallToolResult,
                        metadata=metadata,
                    )
                    
                    # Task completed successfully
                    content_text = "Task completed"
                    if result.content and len(result.content) > 0:
                        first_content = result.content[0]
                        if isinstance(first_content, TextContent):
                            content_text = first_content.text
                    
                    print(f"✅ Task completed: {content_text}")
                    clear_resumption_tokens()
                    
                except Exception as e:
                    print(f"❌ Task failed: {e}")
                    # Keep tokens in case we want to retry
                    
    except Exception as e:
        print(f"❌ Connection error: {e}")


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Minimal Resumable MCP Client")
    parser.add_argument("--url", default="http://127.0.0.1:8006/mcp", help="MCP server URL")
    parser.add_argument("--clear-tokens", action="store_true", help="Clear resumption tokens and exit")
    
    args = parser.parse_args()
    
    if args.clear_tokens:
        clear_resumption_tokens()
        print("🗑️ Resumption tokens cleared")
        return
    
    print("🤖 Minimal Resumable MCP Client")
    print(f"🔗 Connecting to: {args.url}")
    
    await run_long_running_task(args.url)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Interrupted by user")
    except Exception as e:
        print(f"💥 Fatal error: {e}")

```

### Core Architecture Module: `11-agentic-protocols/code_samples/mcp-agents/server/__init__.py`
```
"""
MCP Server implementations.

This package contains various MCP server implementations:
- server.py: Basic MCP server
- resumable_server.py: Server with event store and resumption support
- event_store.py: Event store implementation for session resumption
"""

```

### Core Architecture Module: `11-agentic-protocols/code_samples/mcp-agents/server/event_store.py`
```
#!/usr/bin/env python3
"""
Event Store Implementation for MCP Session Resumption

This module provides event store implementations that enable MCP session resumption
by storing and replaying events after client reconnection.
"""

import asyncio
import logging
import sqlite3
from typing import Optional

from pydantic import TypeAdapter

from mcp.server.streamable_http import (
    EventCallback,
    EventId,
    EventMessage,
    EventStore,
    StreamId,
)
from mcp.types import JSONRPCMessage

logger = logging.getLogger(__name__)


class SimpleEventStore(EventStore):
    """Simple in-memory event store for testing resumption functionality."""

    def __init__(self):
        self._events: list[tuple[StreamId, EventId, JSONRPCMessage]] = []
        self._event_id_counter = 0
        logger.info("SimpleEventStore initialized")

    async def store_event(self, stream_id: StreamId, message: JSONRPCMessage) -> EventId:
        """Store an event and return its ID."""
        self._event_id_counter += 1
        event_id = str(self._event_id_counter)
        self._events.append((stream_id, event_id, message))
        logger.info(f"Stored event {event_id} for stream {stream_id}")
        return event_id

    async def replay_events_after(
        self,
        last_event_id: EventId,
        send_callback: EventCallback,
    ) -> StreamId | None:
        """Replay events after the specified ID."""
        logger.info(f"Replaying events after {last_event_id}")

        # Find the last event and its stream. Event IDs are global, but replay
        # must remain scoped to the stream being resumed.
        start_index = None
        stream_id = None
        for i, (event_stream_id, event_id, _) in enumerate(self._events):
            if event_id == last_event_id:
                start_index = i + 1
                stream_id = event_stream_id
                break

        if start_index is None:
            logger.warning(f"Event ID {last_event_id} not found")
            return None

        # Replay events
        replayed_count = 0
        for event_stream_id, event_id, message in self._events[start_index:]:
            if event_stream_id != stream_id:
                continue
            await send_callback(EventMessage(message, event_id))
            replayed_count += 1

        logger.info(f"Replayed {replayed_count} events, stream_id: {stream_id}")
        return stream_id

    def get_event_count(self) -> int:
        """Get the total number of stored events."""
        return len(self._events)

    def clear_events(self) -> None:
        """Clear all stored events."""
        self._events.clear()
        self._event_id_counter = 0
        logger.info("Event store cleared")


class PersistentEventStore(EventStore):
    """
    Event store that persists events to disk using SQLite.
    """
    
    def __init__(self, storage_path: str = "events.db") -> None:
        self.storage_path = storage_path
        self._adapter = TypeAdapter(JSONRPCMessage)

        # Use check_same_thread=False to allow access from asyncio executor threads
        self._conn = sqlite3.connect(self.storage_path, check_same_thread=False)
        self._create_table()
        logger.info(f"PersistentEventStore initialized with {self.storage_path}")

    def _create_table(self) -> None:
        """Create the events table if it doesn't exist."""
        cursor = self._conn.cursor()
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    stream_id TEXT NOT NULL,
                    message TEXT NOT NULL
                )
            """)
            self._conn.commit()
        except sqlite3.Error:
            logger.exception("Failed to create 'events' table in PersistentEventStore")
            try:
                self._conn.close()
            except Exception:
                logger.exception("Failed to close SQLite connection after table creation error")
            raise
        finally:
            try:
                cursor.close()
            except Exception:
                logger.exception("Failed to close SQLite cursor after table creation")
    
    async def store_event(self, stream_id: StreamId, message: JSONRPCMessage) -> EventId:
        """Store an event and return its ID."""
        # Serialize message to JSON
        json_str = self._adapter.dump_json(message).decode('utf-8')

        # Run DB operation in thread pool to avoid blocking event loop
        return await asyncio.to_thread(self._store_event_sync, stream_id, json_str)

    def _store_event_sync(self, stream_id: StreamId, json_str: str) -> EventId:
        cursor = self._conn.cursor()
        cursor.execute(
            "INSERT INTO events (stream_id, message) VALUES (?, ?)",
            (stream_id, json_str)
        )
        self._conn.commit()

        event_id = str(cursor.lastrowid)
        logger.info(f"Stored event {event_id} for stream {stream_id}")
        return event_id
    
    async def replay_events_after(
        self,
        last_event_id: EventId,
        send_callback: EventCallback,
    ) -> StreamId | None:
        """Replay events after the specified ID, filtered by the stream of the last event."""
        logger.info(f"Replaying events after {last_event_id}")

        # Fetch events in thread pool
        events_data = await asyncio.to_thread(self._fetch_events_sync, last_event_id)

        if events_data is None:
            logger.warning(f"Could not resume stream from event {last_event_id}")
            return None

        stream_id = None
        replayed_count = 0

        for event_id, row_stream_id, message_json in events_data:
            if stream_id is None:
                stream_id = row_stream_id

            try:
                message = self._adapter.validate_json(message_json)
                await send_callback(EventMessage(message, event_id))
                replayed_count += 1
            except Exception as e:
                logger.error(f"Failed to deserialize event {event_id}: {e}")

        logger.info(f"Replayed {replayed_count} events for stream {stream_id}")
        return stream_id

    def _fetch_events_sync(self, last_event_id: EventId) -> list[tuple[EventId, StreamId, str]] | None:
        try:
            target_id = int(last_event_id)
        except (ValueError, TypeError):
            logger.warning(f"Invalid event ID format: {last_event_id}")
            return None

        cursor = self._conn.cursor()

        # 1. Identify the stream from the last event ID
        cursor.execute("SELECT stream_id FROM events WHERE id = ?", (target_id,))
        result = cursor.fetchone()

        if not result:
            logger.warning(f"Event ID {target_id} not found")
            return None

        stream_id = result[0]

        # 2. Fetch subsequent events for THIS STREAM ONLY
        cursor.execute(
            "SELECT id, stream_id, message FROM events WHERE id > ? AND stream_id = ? ORDER BY id ASC",
            (target_id, stream_id)
        )

        # Convert rows to list of (str_id, stream_id, msg_json)
        return [(str(row[0]), row[1], row[2]) for row in cursor.fetchall()]

    def get_event_count(self) -> int:
        """Get the total number of stored events."""
        cursor = self._conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM events")
        result = cursor.fetchone()
        return result[0] if result else 0

    def clear_events(self) -> None:
        """Clear all stored events."""
        cursor = self._conn.cursor()
        cursor.execute("DELETE FROM events")
        # Reset auto-increment sequence
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='events'")
        self._conn.commit()
        logger.info("Event store cleared")

    def close(self) -> None:
        """Close the underlying SQLite connection."""
        conn = getattr(self, "_conn", None)
        if conn is None:
            return
        try:
            conn.close()
            logger.info("PersistentEventStore connection closed")
        except sqlite3.Error as exc:
            logger.warning("Error closing PersistentEventStore connection: %s", exc)
        finally:
            self._conn = None

    def __enter__(self) -> "PersistentEventStore":
        """Enter the runtime context related to this object."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Exit the runtime context and close the connection."""
        self.close()

```

### Core Architecture Module: `11-agentic-protocols/code_samples/mcp-agents/server/server.py`
```
#!/usr/bin/env python3
"""
Resumable MCP Server Implementation

This server provides full session resumption capabilities using an event store.
It supports long-running tasks that can be resumed after client disconnection.
"""

import argparse
import asyncio
import logging
import re

from typing import Optional

import anyio
import uvicorn
from pydantic import AnyUrl
from starlette.applications import Starlette
from starlette.routing import Mount
from pydantic import BaseModel, Field
from mcp.server import Server
from mcp.server.streamable_http import EventStore
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import TextContent, Tool, SamplingMessage

from .event_store import SimpleEventStore

logger = logging.getLogger(__name__)


                            
class PriceConfirmationSchema(BaseModel):
    confirm: bool = Field(description="Confirm the price for this trip")
    notes: str = Field(default="", description="Any additional notes about the price")
                            
class ResumableServer(Server):
    """Server implementation with long-running tools and notifications for resumption testing."""

    def __init__(self, name: str = "resumable_mcp_server"):
        super().__init__(name)
        logger.info(f"ResumableServer '{name}' initialized")

        @self.list_tools()
        async def handle_list_tools() -> list[Tool]:
            """List available tools including resumable ones."""
            return [
                Tool(
                    name="travel_agent",
                    description="Book a travel trip with progress updates and price confirmation",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "destination": {
                                "type": "string",
                                "description": "Travel destination",
                                "default": "Paris"
                            }
                        }
                    },
                ),
                Tool(
                    name="research_agent",
                    description="Research a topic with progress updates and interactive summaries",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "topic": {
                                "type": "string",
                                "description": "Research topic",
                                "default": "AI trends"
                            }
                        }
                    },
                ),
                Tool(
                    name="long_running_agent",
                    description="A long-running task for testing resumption (50 steps, 2 seconds each)",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    },
                ),
            ]

        @self.call_tool()
        async def handle_call_tool(name: str, args: dict) -> list[TextContent]:
            """Handle tool execution with support for long-running tasks."""
            ctx = self.request_context
            logger.info(f"Tool called: {name} with args: {args}")

            if name == "travel_agent":
                destination = args.get("destination", "Paris")
                logger.info(f"Travel agent: destination={destination}")
                
                # Simple travel booking flow with progress updates
                steps = [
                    "Checking flights...",
                    "Finding available dates...", 
                    "Confirming prices...",
                    "Booking flight..."
                ]
                
                elicitation_result = None
                booking_cancelled = False
                
                for i, step in enumerate(steps):
                    await ctx.session.send_progress_notification(
                        progress_token=ctx.request_id,
                        progress=i * 25,
                        total=100,
                        message=step, 
                        related_request_id=str(ctx.request_id)   
                    )
                    
                    # Add elicitation request at step 3 (Confirming prices)
                    if i == 2:  # "Confirming prices..." step
                        try:
                            elicit_result = await ctx.session.elicit(
                                message=f"Please confirm the estimated price of $1200 for your trip to {destination}",
                                requestedSchema=PriceConfirmationSchema.model_json_schema(),
                                related_request_id=ctx.request_id,
                            )
                            
                            elicitation_result = elicit_result
                            
                            if elicit_result and elicit_result.action == "accept":
                                logger.info(f"User confirmed price: {elicit_result.content}")
                                # Continue with booking
                            elif elicit_result and elicit_result.action == "decline":
                                logger.info(f"User declined price confirmation: {elicit_result.content}")
                                booking_cancelled = True
                                # Stop the booking process
                                await ctx.session.send_progress_notification(
                                    progress_token=ctx.request_id,
                                    progress=100,
                                    total=100,
                                    message="Booking cancelled by user",
                                    related_request_id= str(ctx.request_id)
                                )
                                break
                            else:
                                logger.info("User cancelled elicitation")
                                booking_cancelled = True
                                await ctx.session.send_progress_notification(
                                    progress_token=ctx.request_id,
                                    progress=100,
                                    total=100,
                                    message="Booking cancelled"
                                )
                                break
                                
                        except Exception as e:
                            logger.info(f"Elicitation request failed (this is normal in tests): {e}")
                            # Continue with booking anyway for fallback
                    
                    if not booking_cancelled:
                        await anyio.sleep(2)  # Fixed 0.5 second delay between steps
                
                # Generate final result based on elicitation outcome
                if booking_cancelled:
                    if elicitation_result and hasattr(elicitation_result, 'content') and elicitation_result.content:
                        notes = elicitation_result.content.get('notes', 'No reason provided')
                        result_text = f"❌ Booking cancelled for trip to {destination}. Reason: {notes}"
                    else:
                        result_text = f"❌ Booking cancelled for trip to {destination}."
                else:
                    # Final progress update for successful booking
                    await ctx.session.send_progress_notification(
                        progress_token=ctx.request_id,
                        progress=100,
                        total=100,
                        message="Trip booked successfully"
                    )
                    
                    # Include confirmation details in success message
                    if elicitation_result and elicitation_result.action == "accept" and elicitation_result.content:
                        notes = elicitation_result.content.get('notes', 'No additional notes')
                        result_text = f"✅ Trip booked successfully to {destination}! Price confirmed with notes: '{notes}'"
                    else:
                        result_text = f"✅ Trip booked successfully to {destination}!"

                return [TextContent(type="text", text=result_text)]

            elif name == "research_agent":
                topic = args.get("topic", "AI trends")
                logger.info(f"Research agent: topic={topic}")
                
                # Simple research flow with progress updates
                steps = [
                    "Gathering sources...",
                    "Analyzing data...", 
                    "Summarizing findings...",
                    "Finalizing report..."
                ]
                
                sampling_summary = None
                
                for i, step in enumerate(steps):
                    await ctx.session.send_progress_notification(
                        progress_token=ctx.request_id,
                        progress=i * 25,
                        total=100,
                        message=step
                    )
                    
                    # Add sampling request at step 3 (Summarizing findings)
                    if i == 2:  # "Summarizing findings..." step
                        try:
                            sampling_result = await ctx.session.create_message(
                                messages=[
                                    SamplingMessage(
                                        role="user",
                                        content=TextContent(type="text", text=f"Please summarize the key findings for research on: {topic}")
                                    )
                                ],
              
```

### Core Architecture Module: `14-microsoft-agent-framework/code-samples/14-langchain-hosted-agent.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""
Sample: Host a LangChain / LangGraph agent as a Microsoft Foundry hosted agent.

This sample shows how to take an agent built with LangGraph and expose it through
the Microsoft Foundry hosted-agent **Responses** protocol using the
`langchain_azure_ai.agents.hosting` package. Foundry then manages the runtime,
sessions, scaling, identity, and protocol endpoints while your agent logic stays
in LangGraph.

The Responses API is the recommended API for agent-style development in Foundry:
it provides OpenAI-compatible chat, streaming, response history, and conversation
threading in a single API surface.

Prerequisites
-------------
- An Azure subscription and a Microsoft Foundry project.
- A deployed chat model that supports the Responses API (e.g. gpt-5-mini or gpt-5-nano).
- Python 3.10+ and the Azure CLI signed in (`az login`).
- Install the hosting extra:
      pip install -U "langchain-azure-ai[hosting]>=1.2.4" azure-identity
- Set environment variables:
      FOUNDRY_PROJECT_ENDPOINT=https://<resource>.services.ai.azure.com/api/projects/<project>
      FOUNDRY_MODEL_NAME=gpt-5-mini

Run locally
-----------
    python 14-langchain-hosted-agent.py

Then send a Responses request to the local server:
    curl -sS -H "Content-Type: application/json" \
      -X POST http://localhost:8088/responses \
      -d '{"input":"Give me one tip for testing hosted agents.","stream":false}'

Deploy to Foundry (Azure Developer CLI)
---------------------------------------
    azd ext install azure.ai.agents
    azd auth login
    azd ai agent init -m <sample-manifest-url>
    azd ai agent run          # runs the container locally (requires Docker)
    azd provision             # if a new Foundry project/model is needed
    azd deploy                # packages + rolls out to the Foundry hosted runtime

See: https://learn.microsoft.com/azure/foundry/how-to/develop/langchain-hosted-agents
"""

import os

from azure.ai.projects import AIProjectClient
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langchain_azure_ai.agents.hosting import ResponsesHostServer

# Scope used to request tokens for the Foundry project's OpenAI-compatible endpoint.
_AZURE_AI_SCOPE = "https://ai.azure.com/.default"


def build_chat_model() -> ChatOpenAI:
    """Create a ChatOpenAI bound to the Foundry project's Responses endpoint."""
    project_endpoint = os.environ["FOUNDRY_PROJECT_ENDPOINT"].rstrip("/")
    deployment = os.environ.get("FOUNDRY_MODEL_NAME", "gpt-5-mini")

    credential = DefaultAzureCredential()
    project = AIProjectClient(endpoint=project_endpoint, credential=credential)

    # The project's OpenAI-compatible client exposes the Responses-capable base URL.
    openai_client = project.get_openai_client()
    token_provider = get_bearer_token_provider(credential, _AZURE_AI_SCOPE)

    return ChatOpenAI(
        model=deployment,
        base_url=str(openai_client.base_url),
        api_key=token_provider,
    )


def main() -> None:
    # A minimal LangGraph agent. Add your own tools to the list to give it capabilities.
    graph = create_agent(build_chat_model(), tools=[])

    # ResponsesHostServer exposes the compiled graph over POST /responses and emits
    # Responses API server-sent events (response.created, response.output_text.delta,
    # response.completed) when a request sets "stream": true.
    port = int(os.environ.get("PORT", "8088"))
    ResponsesHostServer(graph).run(port=port)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `14-microsoft-agent-framework/code-samples/hotel_booking_workflow_sample.py`
```
# Copyright (c) Microsoft. All rights reserved.

"""
Sample: Hotel Booking Conditional Workflow

This sample demonstrates a conditional workflow using the Microsoft Agent Framework
that routes based on hotel availability.

Workflow:
1. User provides a destination city
2. Agent checks hotel availability using a tool
3. Conditional routing:
   - If NO availability → Suggest alternative city
   - If availability → Suggest booking
4. Display result with HTML formatting

Key Concepts:
- WorkflowBuilder with conditional edges
- AgentExecutor wrapping AI agents
- @executor decorator for custom logic
- Pydantic models for structured outputs
- @ai_function decorator for tools
- OpenAIChatClient integration
"""

import asyncio
import json
import os
from typing import Annotated, Any, Never

from agent_framework import (
    AgentExecutor,
    AgentExecutorRequest,
    AgentExecutorResponse,
    ChatMessage,
    Role,
    WorkflowBuilder,
    WorkflowContext,
    ai_function,
    executor,
)
from agent_framework.openai import OpenAIChatClient
from azure.identity import AzureCliCredential
from dotenv import load_dotenv
from pydantic import BaseModel

# ============================================================================
# STEP 1: PYDANTIC MODELS FOR STRUCTURED OUTPUTS
# ============================================================================


class BookingCheckResult(BaseModel):
    """Result from checking hotel availability at a destination."""

    destination: str
    has_availability: bool
    message: str


class AlternativeResult(BaseModel):
    """Suggested alternative destination when no rooms available."""

    alternative_destination: str
    reason: str


class BookingConfirmation(BaseModel):
    """Booking suggestion when rooms are available."""

    destination: str
    action: str
    message: str


# ============================================================================
# STEP 2: HOTEL BOOKING TOOL (AI FUNCTION)
# ============================================================================


@ai_function(description="Check hotel room availability for a destination city")
def hotel_booking(destination: Annotated[str, "The destination city to check for hotel rooms"]) -> str:
    """
    Simulates checking hotel room availability.

    For demo purposes:
    - Stockholm, Seattle, Tokyo have rooms
    - All other cities don't have rooms

    Returns:
        JSON string with availability status
    """
    print(f"🔍 Checking hotel availability in {destination}...")

    # Simulate availability check
    cities_with_rooms = ["stockholm", "seattle", "tokyo", "london", "amsterdam"]
    has_rooms = destination.lower() in cities_with_rooms

    result = {"has_availability": has_rooms, "destination": destination}

    return json.dumps(result)


# ============================================================================
# STEP 3: CONDITION FUNCTIONS FOR ROUTING
# ============================================================================


def has_availability_condition(message: Any) -> bool:
    """
    Condition for routing when hotels ARE available.

    Args:
        message: Message from upstream executor (should be AgentExecutorResponse)

    Returns:
        True if availability exists, False otherwise
    """
    if not isinstance(message, AgentExecutorResponse):
        return True  # Default to True if not the expected type

    try:
        result = BookingCheckResult.model_validate_json(message.agent_run_response.text)
        print(f"✅ Availability check: {result.has_availability} for {result.destination}")
        return result.has_availability
    except Exception as e:
        print(f"⚠️  Error parsing availability result: {e}")
        return False


def no_availability_condition(message: Any) -> bool:
    """
    Condition for routing when hotels are NOT available.

    Args:
        message: Message from upstream executor

    Returns:
        True if no availability, False otherwise
    """
    if not isinstance(message, AgentExecutorResponse):
        return False

    try:
        result = BookingCheckResult.model_validate_json(message.agent_run_response.text)
        print(f"❌ No availability for {result.destination}")
        return not result.has_availability
    except Exception as e:
        print(f"⚠️  Error parsing availability result: {e}")
        return False


# ============================================================================
# STEP 4: DISPLAY EXECUTOR (Custom transformation)
# ============================================================================


@executor(id="display_result")
async def display_result(response: AgentExecutorResponse, ctx: WorkflowContext[Never, str]) -> None:
    """
    Display the final result as workflow output.

    This executor receives the final agent response and yields it as output.
    """
    print(f"📤 Yielding workflow output...")
    await ctx.yield_output(response.agent_run_response.text)


# ============================================================================
# STEP 5: MAIN WORKFLOW FUNCTION
# ============================================================================


async def main() -> None:
    """
    Main function to build and execute the hotel booking workflow.
    """
    # Load environment variables
    load_dotenv()

    # Verify configuration
    print("=" * 80)
    print("🏨 HOTEL BOOKING CONDITIONAL WORKFLOW")
    print("=" * 80)

    # Provider selection: Azure OpenAI (Responses API), OpenAI, or MiniMax
    # The OpenAIChatClient works with any OpenAI-compatible API, and targets the
    # Azure OpenAI Responses API when given an azure_endpoint + credential.
    minimax_api_key = os.getenv("MINIMAX_API_KEY")
    azure_openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
    openai_api_key = os.getenv("OPENAI_API_KEY")

    if minimax_api_key:
        # MiniMax: OpenAI-compatible API with large context window (up to 204K tokens).
        # Defaults to MiniMax-M3; override MINIMAX_MODEL_ID if your account/region
        # doesn't have access to it (e.g. set it to MiniMax-M2.7).
        chat_client = OpenAIChatClient(
            base_url=os.environ.get("MINIMAX_BASE_URL", "https://api.minimax.io/v1"),
            api_key=minimax_api_key,
            model_id=os.environ.get("MINIMAX_MODEL_ID", "MiniMax-M3"),
        )
        print("Using MiniMax provider")
    elif azure_openai_endpoint:
        # Azure OpenAI (Responses API). Sign in with `az login` for keyless Entra ID auth.
        # GitHub Models is deprecated (retiring July 2026) and does not support the Responses API.
        chat_client = OpenAIChatClient(
            azure_endpoint=azure_openai_endpoint,
            credential=AzureCliCredential(),
            model_id=os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-5-mini"),
        )
        print("Using Azure OpenAI (Responses API) provider")
    else:
        # Default: OpenAI
        chat_client = OpenAIChatClient(model_id="gpt-5-mini")
        print("Using OpenAI provider")



    print("\n" + "=" * 80)
    print("STEP 1: Creating AI Agents with Structured Outputs")
    print("=" * 80)

    # Agent 1: Check availability
    availability_agent = AgentExecutor(
        chat_client.create_agent(
            instructions=(
                "You are a hotel booking assistant that checks room availability. "
                "Use the hotel_booking tool to check if rooms are available at the destination. "
                "Return JSON with fields: destination (string), has_availability (bool), and message (string). "
                "The message should summarize the availability status."
            ),
            tools=[hotel_booking],
            response_format=BookingCheckResult,
        ),
        id="availability_agent",
    )
    print("✅ Created availability_agent with hotel_booking tool")

    # Agent 2: Suggest alternative (when no rooms)
    alternative_agent = AgentExecutor(
        chat_client.create_agent(
            instructions=(
                "You are a helpful travel assistant. When a user cannot find hotels in their requested city, "
                "suggest an alternative nearby city that has availability. "
                "Return JSON with fields: alternative_destination (string) and reason (string). "
                "Choose from: Stockholm, Seattle, Tokyo, London, or Amsterdam (these have rooms). "
                "Make your suggestion sound appealing and helpful."
            ),
            response_format=AlternativeResult,
        ),
        id="alternative_agent",
    )
    print("✅ Created alternative_agent for suggesting other cities")

    # Agent 3: Suggest booking (when rooms available)
    booking_agent = AgentExecutor(
        chat_client.create_agent(
            instructions=(
                "You are a booking assistant. The user has found available hotel rooms. "
                "Encourage them to book by highlighting the destination's appeal. "
                "Return JSON with fields: destination (string), action (string), and message (string). "
                "The action should be 'book_now' and message should be encouraging."
            ),
            response_format=BookingConfirmation,
        ),
        id="booking_agent",
    )
    print("✅ Created booking_agent for confirming bookings")

    print("\n" + "=" * 80)
    print("STEP 2: Building Workflow with Conditional Edges")
    print("=" * 80)

    # Build the workflow
    workflow = (
        WorkflowBuilder()
        .set_start_executor(availability_agent)
        # NO AVAILABILITY PATH: availability_agent → alternative_agent → display_result
        .add_edge(availability_agent, alternative_agent, condition=no_availability_condition)
        .add_edge(alternative_agent, display_result)
        # HAS AVAILABILITY PATH: availability_agent → booking_agent → display_result
        .add_edge(availability_agent, booking_agent, condition=has_availability_condition)
        .add_edge(
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #763** (2026-10-04): **01. integrate with OpenAI .NET SDK**
  *Symptoms*: 

- **Issue #755** (2026-09-22): **Resource suggestion: browser exercise on evidence for an agent stop claim**
  *Symptoms*: Lesson 18 makes an important distinction: signed receipts prove attribution, integrity and ordering, not that the recorded action was correct. This short browser exercise gives learners a complementary operational question: what evidence is enough to say an AI agent has stopped?  https://noqt.no-qt.chatgpt.site/can-you-prove-the-ai-is-stopped  Across three fictional rounds, learners choose the strongest claim supported when:  - the named parent exits but child work survives; - the wrong boundary is emptied and an outside canary is stopped; - the selected process hierarchy is observed empty while the declared outside canary survives.  It is an educational browser simulation only. No process runs or is controlled, and it is not a containment test, benchmark, certification or efficacy claim.  The exercise seems to fit Lesson 18's "what receipts prove (and do not)" boundary, and also complements Lesson 10's advice to define termination conditions by asking how the stop is actually evidenced. Would this be useful as an optional additional resource? If the course prefers not to link external exercises, no change is needed.
  **Post-Mortem & Fix Analysis**:
  > 👋 Thanks for contributing @noqt! We will review the issue and get back to you soon.

- **Issue #748** (2026-09-16): **[CI] Pilot automatic assignment for translation issues and PRs**
  *Symptoms*: ## Purpose  I would like to help triage translation-related issues and pull requests. This pilot adds `@skytin1004` as an assignee when an open item has an `i18n` or `translation` label, or contains `[i18n]` or `[translation]` in its title. Matching is case-insensitive. Existing assignees are preserved, and discussion stays in this repository.  ## Before enabling  Please confirm that this routing is useful and that `@skytin1004` is eligible for assignment. The repository-level GitHub assignment eligibility check currently returns 404 for this account. This draft is a proposal, not a working live deployment; maintainers need to resolve eligibility before enabling it. Assignment means initial triage, not review approval or an obligation to fix every report.  ## Behavior  Runs on opened, edited, labeled, and reopened issue/PR events. Reads current metadata, skips closed or unrelated items and items already assigned to the account, and uses the additive assignment API. It verifies the response and fails visibly if GitHub does not add the assignee. It does not remove assignments when tags or labels are removed, request reviews, post comments, or change translation execution.  Uses `pull_request_target` only for metadata operations on fork PRs. There is no checkout, execution of contributor code, or interpolation of issue/PR content into scripts. The GitHub Script action is pinned to a verified commit; token permissions are limited to issues and pull requests.  ## Validation  - Par
  **Post-Mortem & Fix Analysis**:
  > Pausing this proposal for now to keep repository maintenance simple. I’ll continue helping with translation issues directly.

- **Issue #745** (2026-09-13): **course**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > 👋 Thanks for contributing @yosefalene20-ops! We will review the issue and get back to you soon.

- **Issue #742** (2026-09-09): **Practice**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > 👋 Thanks for contributing @PoulamiDasDA! We will review the pull request and get back to you soon.

- **Issue #737** (2026-09-09): **docs: add synthetic evaluation data guidance**
  *Symptoms*: ## Summary  Adds guidance to Lesson 10 on building safe offline evaluation datasets for business agents.  The new section: - explains why production data should not be copied into evaluation sets - recommends starting from schemas or contracts and attaching expected outcomes from business rules - includes an optional schema-based synthetic data example using Great Generator - calls out reproducibility with seeds and schemas - clarifies that synthetic data is not anonymized production data  ## Validation  - Ran `git diff --check` - Verified the `great-generator` example against `great-generator==0.1.7` - Docs-only change
  **Post-Mortem & Fix Analysis**:
  > 👋 Thanks for contributing @ravikiranpagidi! We will review the pull request and get back to you soon.

- **Issue #736** (2026-09-09): **[Fix] Update lesson directory range in AGENTS.md**
  *Symptoms*: Updated the lesson directory range from 00-15+ to 00-18 in AGENTS.md to match the current course structure.
  **Post-Mortem & Fix Analysis**:
  > 👋 Thanks for contributing @dhruvatr! We will review the pull request and get back to you soon.
  > Thank You

- **Issue #735** (2026-09-09): **Use a specific Azure.Search.Documents package version**
  *Symptoms*: Replaced the wildcard package version with a specific version to improve package version consistency and compatibility.
  **Post-Mortem & Fix Analysis**:
  > 👋 Thanks for contributing @dhruvatr! We will review the pull request and get back to you soon.

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

### Incident Patch 1: `05e940e6` (2026-09-09)
**Commit Message**: Merge pull request #729 from RenatoMignone/fix/lesson-10-multimodal-receipt

[Fix] Send Lesson 10 receipt as native multimodal image input

**File**: `10-ai-agents-production/code_samples/10-expense_claim-demo.ipynb` (modified, +18/-26)
```diff
@@ -53,13 +53,12 @@
     "logging.getLogger(\"agent_framework.foundry\").setLevel(logging.ERROR)\n",
     "\n",
     "import os\n",
-    "import base64\n",
     "import dotenv\n",
     "from typing import Annotated, List\n",
     "\n",
     "from pydantic import BaseModel, Field\n",
     "\n",
-    "from agent_framework import tool, AgentResponseUpdate, WorkflowBuilder\n",
+    "from agent_framework import Content, Message, tool, AgentResponseUpdate, WorkflowBuilder\n",
     "from agent_framework.foundry import FoundryChatClient\n",
     "from azure.identity import DefaultAzureCredential\n",
     "\n",
@@ -186,11 +185,10 @@
    "cell_type": "markdown",
    "metadata": {},
    "source": [
-    "# Tool for Extracting Travel Expenses from Receipt Images\n",
+    "# Loading Travel Expense Receipt Images\n",
     "\n",
-    "Create a tool function to extract travel expenses from receipt images.\n",
-    "- This tool uses the `@tool` decorator from the Microsoft Agent Framework.\n",
-    "- It reads the receipt image, encodes it as base64, and returns the data URI for the agent to analyze."
+    "Create a helper function to load receipt images as native multimodal content.\n",
+    "- It reads the receipt image bytes and wraps them in Agent Framework `Content` for the agent to analyze."
    ]
   },
   {
@@ -199,19 +197,11 @@
    "metadata": {},
    "outputs": [],
    "source": [
-    "@tool(approval_mode=\"never_require\")\n",
-    "def load_receipt_image(\n",
-    "    image_path: Annotated[str, \"Path to the receipt image file\"] = \"receipt.jpg\"\n",
-    ") -> str:\n",
-    "    \"\"\"Load a receipt image and return its base64-encoded data URI for OCR extraction.\"\"\"\n",
-    "    try:\n",
-    "        with open(image_path, \"rb\") as f:\n",
-    "            image_data = base64.b64encode(f.read()).decode(\"utf-8\")\n",
-    "        return f\"data:image/jpeg;base64,{image_data}\"\n",
-    "    except Exception as e:\n",
-    "        error_msg = f\"[LOG] Error loading image '{image_path}': {str(e)}\"\n",
-    "        print(error_msg)\n",
-    "        return error_msg"
+    "def load_receipt_image(image_path: str = \"receipt.jpg\") -> Content:\n",
+    "    \"\"\"Load a receipt image as native multimodal content.\"\"\"\n",
+    "    with open(image_path, \"rb\") as f:\n",
+    "        image_bytes = f.read()\n",
+    "    return Content.from_data(image_bytes, \"image/jpeg\")"
    ]
   },
   {
@@ -221,7 +211,7 @@
     "## Processing Expenses\n",
     "\n",
     "Define the agents and wire them into a sequential workflow using `WorkflowBuilder`.\n",
-    "- The OCR agent extracts structured expense data from the receipt image using the `load_receipt_image` tool.\n",
+    "- The OCR agent extracts structured expense data from the receipt image supplied in the user message.\n",
     "- The Email agent takes the extracted data and generates a professional expense claim email using the `generate_expense_email` tool.\n",
     "- `WorkflowBuilder` with `add_edge` creates a sequential pipeline: OCR Agent → Email Agent."
    ]
@@ -233,11 +223,10 @@
    "outputs": [],
    "source": [
     "ocr_agent = client.as_agent(\n",
-    "    tools=[load_receipt_image],\n",
     "    name=\"OCRAgent\",\n",
     "    instructions=(\n",
     "        \"You are an expert OCR assistant specialized in extracting structured data from receipt images. \"\n",
-    "        \"Use the 'load_receipt_image' tool to load the receipt image, then analyze it and extract \"\n",
+    "        \"Analyze the receipt image supplied in the user message and extract \"\n",
     "        \"travel-related expense details in the format: 'date|description|amount|category' separated by semicolons. \"\n",
     "        \"Follow these rules: \"\n",
     "        \"- Date: Convert dates (e.g., '4/4/22') to 'dd-MMM-yyyy' (e.g., '04-Apr-2022'). \"\n",
@@ -276,9 +265,7 @@
    "cell_type": "markdown",
    "metadata": {},
    "source": [
-    "> **Note:** This workflow currently passes the receipt image as base64 text, which most chat models (including gpt-5-mini) will not treat as an image.\n",
-    "> It may also exceed the model context window. Prefer running OCR with Azure AI Vision (or another OCR tool) and pass only extracted text, or refactor to send the image as an `image_url` message.\n",
-    "> If you only want to avoid context errors, try a smaller receipt image or a model with a larger context window."
+    "> **Note:** The receipt bytes are wrapped in native Agent Framework multimodal `Content`, so Foundry receives them as image input rather than ordinary text."
    ]
   },
   {
@@ -299,8 +286,13 @@
     ")\n",
     "\n",
     "last_author = None\n",
+    "receipt_message = Message(\n",
+    "    role=\"user\",\n",
+    "    contents=[prompt, load_receipt_image(\"receipt.jpg\")],\n",
+    ")\n",
+    "\n",
     "events = workflow.run(\n",
-    "    prompt,\n",
+    "    receipt_message,\n",
     "    stream=True,\n",
     ")\n",
     "async for even
```

---

### Incident Patch 2: `df52ffb2` (2026-09-09)
**Commit Message**: Merge branch 'main' into fix/lesson-10-multimodal-receipt

**File**: `.env.example` (modified, +8/-0)
```diff
@@ -41,3 +41,11 @@ BING_CONNECTION_ID="..."
 MINIMAX_API_KEY="..."
 MINIMAX_BASE_URL="https://api.minimax.io/v1"
 MINIMAX_MODEL_ID="MiniMax-M3"
+
+# Novita AI (Alternative OpenAI-compatible provider)
+# Novita AI offers open-source and frontier LLMs (DeepSeek, Llama, Qwen, and more) via an OpenAI-compatible API.
+# NOTE: Current samples do not automatically consume NOVITA_* variables; pass these values explicitly when constructing OpenAIChatClient.
+# Get your API key from https://novita.ai/settings/key-management
+NOVITA_API_KEY="..."
+NOVITA_BASE_URL="https://api.novita.ai/openai/v1"
+NOVITA_MODEL_ID="moonshotai/kimi-k3"
```

**File**: `.github/dependabot.yml` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+version: 2
+updates:
+  - package-ecosystem: "github-actions"
+    directory: "/"
+    groups:
+      github-actions:
+        patterns: ["*"]
+    schedule:
+      interval: "weekly"
+    cooldown:
+      default-days: 7
```

**File**: `.github/workflows/smoke-test.yml` (modified, +2/-2)
```diff
@@ -47,10 +47,10 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: Checkout
-        uses: actions/checkout@v4
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
 
       - name: Azure login (OIDC)
-        uses: azure/login@v2
+        uses: azure/login@f5d393ae46f8fde4be8b75f32e3fc50e654ad0ca # v3.0.1
         with:
           client-id: ${{ secrets.AZURE_CLIENT_ID }}
           tenant-id: ${{ secrets.AZURE_TENANT_ID }}
```

**File**: `.github/workflows/welcome-issue.yml` (modified, +2/-2)
```diff
@@ -11,7 +11,7 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: Add Label and thanks comment to Issue
-        uses: actions/github-script@v8
+        uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0
         with:
           script: |
             const issueAuthor = context.payload.sender.login
@@ -29,7 +29,7 @@ jobs:
             })
       - name: Auto-assign issue
         continue-on-error: true
-        uses: pozil/auto-assign-issue@v2
+        uses: pozil/auto-assign-issue@7bf9d82c77d45976224660b873fc83e60576c5aa # v2
         with:
           repo-token:  ${{ secrets.GITHUB_TOKEN }}
           assignees: koreyspace
\ No newline at end of file
```

**File**: `.github/workflows/welcome-pr.yml` (modified, +3/-3)
```diff
@@ -5,13 +5,13 @@ on:
     types: [opened]
 permissions:
   contents: read
-  pull-requests: write
+  issues: write
 jobs:
   asses-pull-request:
     runs-on: ubuntu-latest
     steps:
       - name: Add Label and thanks comment to Pull request
-        uses: actions/github-script@v8
+        uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0
         with:
           script: |
             const issueAuthor = context.payload.sender.login
@@ -29,7 +29,7 @@ jobs:
             })
       - name: Auto-assign issue
         continue-on-error: true
-        uses: pozil/auto-assign-issue@v2
+        uses: pozil/auto-assign-issue@7bf9d82c77d45976224660b873fc83e60576c5aa # v2
         with:
           repo-token:  ${{ secrets.GITHUB_TOKEN }}
           assignees: koreyspace
```

**File**: `00-course-setup/AzureSearch.cs` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-#:package Azure.Search.Documents@11.*
+#:package Azure.Search.Documents@11.7.0
 #:package Azure.Identity@1.21.0
 #:property PublishAot=false
 
```

**File**: `00-course-setup/README.md` (modified, +16/-0)
```diff
@@ -285,6 +285,22 @@ Add these variables to your `.env` file:
 
 The code samples that use `OpenAIChatClient` (e.g., Lesson 14 hotel booking workflow) will automatically detect and use your MiniMax configuration when `MINIMAX_API_KEY` is set.
 
+## Alternative Provider: Novita AI (OpenAI-Compatible)
+
+[Novita AI](https://novita.ai/llm-api) provides an OpenAI-compatible API for open-source and frontier LLMs (DeepSeek, Llama, Qwen, and more). Since the Microsoft Agent Framework's `OpenAIChatClient` works with any OpenAI-compatible endpoint, you can use Novita AI as a drop-in alternative to Azure OpenAI or OpenAI.
+
+Add these variables to your `.env` file:
+
+| Variable | Where to find it |
+|----------|-----------------|
+| `NOVITA_API_KEY` | [Novita AI Dashboard](https://novita.ai/settings/key-management) → API Keys |
+| `NOVITA_BASE_URL` | Use `https://api.novita.ai/openai/v1` (default value) |
+| `NOVITA_MODEL_ID` | Model name to use (e.g., `moonshotai/kimi-k3`) |
+
+**Example models**: `moonshotai/kimi-k3`, `zai-org/glm-5.2`, `deepseek/deepseek-v4-flash-0731`. Novita AI also hosts many other open-source model families (Llama, Qwen, GLM, and more) — check the [Novita AI model library](https://novita.ai/llm-api) for the current list of available models and their model IDs.
+
+The current samples do not automatically consume `NOVITA_*` variables. To use Novita AI, pass these values explicitly when constructing `OpenAIChatClient` in the sample you are running.
+
 ## Alternative Provider: Foundry Local (Run Models On-Device)
 
 [Foundry Local](https://foundrylocal.ai) is a lightweight runtime that downloads, manages, and serves language models **entirely on your own machine** through an OpenAI-compatible API — no cloud required.
```

**File**: `11-agentic-protocols/code_samples/mcp-agents/README.md` (modified, +17/-2)
```diff
@@ -367,10 +367,25 @@ class SimpleEventStore(EventStore):
 
     async def replay_events_after(self, last_event_id: EventId, send_callback: EventCallback) -> StreamId | None:
         """Replay events after the specified ID for resumption."""
-        # Find events after the last known event and replay them
-        for _, event_id, message in self._events[start_index:]:
+        start_index = None
+        stream_id = None
+        for index, (event_stream_id, event_id, _) in enumerate(self._events):
+            if event_id == last_event_id:
+                start_index = index + 1
+                stream_id = event_stream_id
+                break
+
+        if start_index is None:
+            return None
+
+        # Replay only later events from the session's original stream.
+        for event_stream_id, event_id, message in self._events[start_index:]:
+            if event_stream_id != stream_id:
+                continue
             await send_callback(EventMessage(message, event_id))
 
+        return stream_id
+
 # From server/server.py - Passing event store to session manager
 def create_server_app(event_store: Optional[EventStore] = None) -> Starlette:
     server = ResumableServer()
```

---

### Incident Patch 3: `7a5cab7d` (2026-09-01)
**Commit Message**: Fix lesson directory range in AGENTS.md

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ This repository contains "AI Agents for Beginners" - a comprehensive educational
 - Azure AI Services: Microsoft Foundry, Microsoft Foundry Agent Service V2
 
 **Architecture:**
-- Lesson-based structure (00-15+ directories)
+- Lesson-based structure (00-18 directories)
 - Each lesson contains: README documentation, code samples (Jupyter notebooks), and images
 - Multi-language support via automated translation system
 - One Python notebook per lesson using Microsoft Agent Framework
```

---

### Incident Patch 4: `fe3f563c` (2026-08-31)
**Commit Message**: fix: use specific Azure.Search.Documents package version

**File**: `00-course-setup/AzureSearch.cs` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-#:package Azure.Search.Documents@11.*
+#:package Azure.Search.Documents@11.7.0
 #:package Azure.Identity@1.21.0
 #:property PublishAot=false
 
```

---

### Incident Patch 5: `4155e883` (2026-08-26)
**Commit Message**: Translate lesson titles to Japanese in study guide

https://github.com/microsoft/ai-agents-for-beginners/blob/main/translations/ja/STUDY_GUIDE.md
#PingMSFTDocs

**File**: `translations/ja/STUDY_GUIDE.md` (modified, +4/-4)
```diff
@@ -90,10 +90,10 @@
 
 | レッスン | 学べること | レッスン後に試すこと |
 |--------|----------------|---------------------------|
-| [01 - Intro to AI Agents](./01-intro-to-ai-agents/README.md) | エージェントと基本的なチャットボットの違い。 | デモアイデアをチャットアプリではなくエージェントとして説明する。 |
-| [02 - Agentic Frameworks](./02-explore-agentic-frameworks/README.md) | モデル、ツール、状態、ワークフローを助けるフレームワーク。 | あなたのデモのどの部分をフレームワークが管理するか特定する。 |
-| [03 - Agentic Design Patterns](./03-agentic-design-patterns/README.md) | エージェントの動作設計でよく使われるパターン。 | コードを書く前にユーザージャーニーをスケッチする。 |
-| [04 - Tool Use](./04-tool-use/README.md) | エージェントがツールを使ってデータを得たり行動をとる方法。 | デモエージェントが必要とする一つのツールを定義する。 |
+| [01 - AIエージェント入門](./01-intro-to-ai-agents/README.md) | エージェントと基本的なチャットボットの違い。 | デモアイデアをチャットアプリではなくエージェントとして説明する。 |
+| [02 - エージェントフレームワーク](./02-explore-agentic-frameworks/README.md) | モデル、ツール、状態、ワークフローを助けるフレームワーク。 | あなたのデモのどの部分をフレームワークが管理するか特定する。 |
+| [03 - エージェント設計パターン](./03-agentic-design-patterns/README.md) | エージェントの動作設計でよく使われるパターン。 | コードを書く前にユーザージャーニーをスケッチする。 |
+| [04 - ツールの使用](./04-tool-use/README.md) | エージェントがツールを使ってデータを得たり行動をとる方法。 | デモエージェントが必要とする一つのツールを定義する。 |
 | [05 - Agentic RAG](./05-agentic-rag/README.md) | 検索により文書やデータで回答を根拠づける方法。 | デモが検索すべき知識源を決める。 |
 | [06 - 信頼できるエージェント](./06-building-trustworthy-agents/README.md) | ガードレール、監督、および安全な動作を追加する方法。 | エージェントが最初にユーザーに尋ねるべき場合のルールを1つ追加する。 |
 | [07 - 計画設計](./07-planning-design/README.md) | エージェントが大きな目標を小さなステップに分解する方法。 | デモのリクエストに対して3段階の計画を書く。 |
```

---

### Incident Patch 6: `f64c076e` (2026-08-26)
**Commit Message**: Fix welcome PR workflow permissions

Co-authored-by: leestott <[REDACTED_EMAIL]>

**File**: `.github/workflows/welcome-pr.yml` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ on:
     types: [opened]
 permissions:
   contents: read
-  pull-requests: write
+  issues: write
 jobs:
   asses-pull-request:
     runs-on: ubuntu-latest
```

---

### Incident Patch 7: `0deea13b` (2026-08-26)
**Commit Message**: Merge pull request #725 from dbshadow/fix-zh-table-formatting

[Fix] Fix markdown table formatting across all translations

**File**: `translations/ar/README.md` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@
 | بناء وكلاء ذكاء اصطناعي موثوقين                 | [رابط](./06-building-trustworthy-agents/README.md)  | [فيديو](https://youtu.be/iZKkMEGBCUQ?si=jZjpiMnGFOE9L8OK ) | [رابط](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst)    |
 | نمط تصميم التخطيط                             | [رابط](./07-planning-design/README.md)              | [فيديو](https://youtu.be/kPfJ2BrBCMY?si=6SC_iv_E5-mzucnC)  | [رابط](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst)    |
 | نمط تصميم متعدد الوكلاء                        | [رابط](./08-multi-agent/README.md)                   | [فيديو](https://youtu.be/V6HpE9hZEx0?si=rMgDhEu7wXo2uo6g)  | [رابط](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst)    |
-
 | نمط تصميم التفكير فوق المعرفي                 | [رابط](./09-metacognition/README.md)               | [فيديو](https://youtu.be/His9R6gw6Ec?si=8gck6vvdSNCt6OcF)  | [رابط](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | وكلاء الذكاء الاصطناعي في الإنتاج                      | [رابط](./10-ai-agents-production/README.md)        | [فيديو](https://youtu.be/l4TP6IyJxmQ?si=31dnhexRo6yLRJDl)  | [رابط](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | استخدام بروتوكولات الوكلاء (MCP، A2A و NLWeb) | [رابط](./11-agentic-protocols/README.md)           | [فيديو](https://youtu.be/X-Dh9R3Opn8)                                 | [رابط](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
```

**File**: `translations/ar/STUDY_GUIDE.md` (modified, +0/-1)
```diff
@@ -95,7 +95,6 @@
 | [03 - أنماط تصميم وكيلة](./03-agentic-design-patterns/README.md) | أنماط شائعة لتصميم سلوك الوكيل. | ارسم رحلة المستخدم قبل كتابة الكود. |
 | [04 - استخدام الأدوات](./04-tool-use/README.md) | كيف يستدعي الوكلاء الأدوات للحصول على بيانات أو اتخاذ إجراء. | حدد أداة واحدة يحتاجها نموذج وكيلك. |
 | [05 - وكيل RAG](./05-agentic-rag/README.md) | كيف يعتمد الاسترجاع على الأرضية للإجابات في الوثائق أو البيانات. | قرر مصدر المعرفة الذي يجب أن يبحث فيه نموذجك. |
-
 | [06 - وكلاء موثوقون](./06-building-trustworthy-agents/README.md) | كيفية إضافة الضوابط والإشراف والسلوك الأكثر أمانًا. | أضف قاعدة واحدة لتحديد متى يجب على الوكيل سؤال المستخدم أولاً. |
 | [07 - تصميم التخطيط](./07-planning-design/README.md) | كيف يقوم الوكلاء بتقسيم الأهداف الكبيرة إلى خطوات أصغر. | اكتب خطة من ثلاث خطوات لطلب العرض التوضيحي الخاص بك. |
 | [08 - تصميم متعدد الوكلاء](./08-multi-agent/README.md) | متى يتم تقسيم العمل بين وكلاء متخصصين. | قرر ما إذا كان العرض التوضيحي الخاص بك يحتاج إلى وكيل واحد أو عدة وكلاء. |
```

**File**: `translations/bg/README.md` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@
 | Създаване на доверени AI агенти                 | [Линк](./06-building-trustworthy-agents/README.md)    | [Видео](https://youtu.be/iZKkMEGBCUQ?si=jZjpiMnGFOE9L8OK ) | [Линк](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Дизайн модел за планиране                        | [Линк](./07-planning-design/README.md)                | [Видео](https://youtu.be/kPfJ2BrBCMY?si=6SC_iv_E5-mzucnC)  | [Линк](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Дизайн модел за мулти-агенти                     | [Линк](./08-multi-agent/README.md)                    | [Видео](https://youtu.be/V6HpE9hZEx0?si=rMgDhEu7wXo2uo6g)  | [Линк](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
-
 | Дизайнерски шаблон за метакогниция               | [Връзка](./09-metacognition/README.md)               | [Видео](https://youtu.be/His9R6gw6Ec?si=8gck6vvdSNCt6OcF)  | [Връзка](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | AI агенти в продукция                             | [Връзка](./10-ai-agents-production/README.md)        | [Видео](https://youtu.be/l4TP6IyJxmQ?si=31dnhexRo6yLRJDl)  | [Връзка](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Използване на агентни протоколи (MCP, A2A и NLWeb) | [Връзка](./11-agentic-protocols/README.md)           | [Видео](https://youtu.be/X-Dh9R3Opn8)                                 | [Връзка](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
```

**File**: `translations/bn/README.md` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@
 | বিশ্বাসযোগ্য এআই এজেন্ট নির্মাণ               | [লিঙ্ক](./06-building-trustworthy-agents/README.md) | [ভিডিও](https://youtu.be/iZKkMEGBCUQ?si=jZjpiMnGFOE9L8OK ) | [লিঙ্ক](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | পরিকল্পনা ডিজাইন প্যাটার্ন                     | [লিঙ্ক](./07-planning-design/README.md)             | [ভিডিও](https://youtu.be/kPfJ2BrBCMY?si=6SC_iv_E5-mzucnC)  | [লিঙ্ক](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | বহু-এজেন্ট ডিজাইন প্যাটার্ন                   | [লিঙ্ক](./08-multi-agent/README.md)                 | [ভিডিও](https://youtu.be/V6HpE9hZEx0?si=rMgDhEu7wXo2uo6g)  | [লিঙ্ক](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
-
 | মেটাকগনিশন ডিজাইন প্যাটার্ন                 | [Link](./09-metacognition/README.md)               | [Video](https://youtu.be/His9R6gw6Ec?si=8gck6vvdSNCt6OcF)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | প্রোডাকশনে AI এজেন্টস                      | [Link](./10-ai-agents-production/README.md)        | [Video](https://youtu.be/l4TP6IyJxmQ?si=31dnhexRo6yLRJDl)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | এজেন্টিক প্রোটোকল ব্যবহার (MCP, A2A এবং NLWeb) | [Link](./11-agentic-protocols/README.md)           | [Video](https://youtu.be/X-Dh9R3Opn8)                                 | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
```

**File**: `translations/cs/README.md` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@ Máte návrhy nebo jste našli chyby ve psaní či kódu? [Založte issue](https
 | Budování důvěryhodných AI agentů               | [Odkaz](./06-building-trustworthy-agents/README.md) | [Video](https://youtu.be/iZKkMEGBCUQ?si=jZjpiMnGFOE9L8OK ) | [Odkaz](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Návrhový vzor plánování                         | [Odkaz](./07-planning-design/README.md)             | [Video](https://youtu.be/kPfJ2BrBCMY?si=6SC_iv_E5-mzucnC)  | [Odkaz](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Návrhový vzor více agentů                      | [Odkaz](./08-multi-agent/README.md)                 | [Video](https://youtu.be/V6HpE9hZEx0?si=rMgDhEu7wXo2uo6g)  | [Odkaz](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
-
 | Vzor návrhu metakognice                 | [Link](./09-metacognition/README.md)               | [Video](https://youtu.be/His9R6gw6Ec?si=8gck6vvdSNCt6OcF)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | AI agenti v produkci                      | [Link](./10-ai-agents-production/README.md)        | [Video](https://youtu.be/l4TP6IyJxmQ?si=31dnhexRo6yLRJDl)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Používání agentních protokolů (MCP, A2A a NLWeb) | [Link](./11-agentic-protocols/README.md)           | [Video](https://youtu.be/X-Dh9R3Opn8)                                 | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
```

**File**: `translations/da/README.md` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@ Har du forslag eller fundet stave- eller kodefejl? [Opret et issue](https://gith
 | Bygning af pålidelige AI-agenter               | [Link](./06-building-trustworthy-agents/README.md) | [Video](https://youtu.be/iZKkMEGBCUQ?si=jZjpiMnGFOE9L8OK ) | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Designmønster for planlægning                    | [Link](./07-planning-design/README.md)             | [Video](https://youtu.be/kPfJ2BrBCMY?si=6SC_iv_E5-mzucnC)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Designmønster for multi-agent                    | [Link](./08-multi-agent/README.md)                 | [Video](https://youtu.be/V6HpE9hZEx0?si=rMgDhEu7wXo2uo6g)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
-
 | Metakognition Designmønster                 | [Link](./09-metacognition/README.md)               | [Video](https://youtu.be/His9R6gw6Ec?si=8gck6vvdSNCt6OcF)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | AI-agenter i produktion                      | [Link](./10-ai-agents-production/README.md)        | [Video](https://youtu.be/l4TP6IyJxmQ?si=31dnhexRo6yLRJDl)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Brug af agentiske protokoller (MCP, A2A og NLWeb) | [Link](./11-agentic-protocols/README.md)           | [Video](https://youtu.be/X-Dh9R3Opn8)                                 | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
```

**File**: `translations/de/README.md` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@ Haben Sie Vorschläge oder Fehler in Rechtschreibung oder Code gefunden? [Eröff
 | Vertrauenswürdige KI-Agenten entwickeln         | [Link](./06-building-trustworthy-agents/README.md) | [Video](https://youtu.be/iZKkMEGBCUQ?si=jZjpiMnGFOE9L8OK ) | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst)          |
 | Designmuster für Planung                         | [Link](./07-planning-design/README.md)             | [Video](https://youtu.be/kPfJ2BrBCMY?si=6SC_iv_E5-mzucnC)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst)          |
 | Designmuster für Multi-Agenten                   | [Link](./08-multi-agent/README.md)                 | [Video](https://youtu.be/V6HpE9hZEx0?si=rMgDhEu7wXo2uo6g)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst)          |
-
 | Metakognition-Designmuster                 | [Link](./09-metacognition/README.md)               | [Video](https://youtu.be/His9R6gw6Ec?si=8gck6vvdSNCt6OcF)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | KI-Agenten im Einsatz                      | [Link](./10-ai-agents-production/README.md)        | [Video](https://youtu.be/l4TP6IyJxmQ?si=31dnhexRo6yLRJDl)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Verwendung agentenbasierter Protokolle (MCP, A2A und NLWeb) | [Link](./11-agentic-protocols/README.md)           | [Video](https://youtu.be/X-Dh9R3Opn8)                                 | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
```

**File**: `translations/el/README.md` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@
 | Δημιουργία Αξιόπιστων Πρακτόρων AI             | [Σύνδεσμος](./06-building-trustworthy-agents/README.md) | [Βίντεο](https://youtu.be/iZKkMEGBCUQ?si=jZjpiMnGFOE9L8OK ) | [Σύνδεσμος](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Σχεδιαστικό Πρότυπο Προγραμματισμού           | [Σύνδεσμος](./07-planning-design/README.md)        | [Βίντεο](https://youtu.be/kPfJ2BrBCMY?si=6SC_iv_E5-mzucnC) | [Σύνδεσμος](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Σχεδιαστικό Πρότυπο Πολλαπλών Πρακτόρων       | [Σύνδεσμος](./08-multi-agent/README.md)            | [Βίντεο](https://youtu.be/V6HpE9hZEx0?si=rMgDhEu7wXo2uo6g) | [Σύνδεσμος](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
-
 | Σχέδιο Μεταγνωσίας                 | [Link](./09-metacognition/README.md)               | [Video](https://youtu.be/His9R6gw6Ec?si=8gck6vvdSNCt6OcF)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Πράκτορες AI στην Παραγωγή                      | [Link](./10-ai-agents-production/README.md)        | [Video](https://youtu.be/l4TP6IyJxmQ?si=31dnhexRo6yLRJDl)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Χρήση Πρωτοκόλλων Πράκτορα (MCP, A2A και NLWeb) | [Link](./11-agentic-protocols/README.md)           | [Video](https://youtu.be/X-Dh9R3Opn8)                                 | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
```

---

### Incident Patch 8: `bcb7fd7e` (2026-08-26)
**Commit Message**: Merge pull request #724 from KXHXK/fix/mcp-event-replay-stream

[Fix] Scope MCP event replay to the original stream

**File**: `11-agentic-protocols/code_samples/mcp-agents/README.md` (modified, +17/-2)
```diff
@@ -367,10 +367,25 @@ class SimpleEventStore(EventStore):
 
     async def replay_events_after(self, last_event_id: EventId, send_callback: EventCallback) -> StreamId | None:
         """Replay events after the specified ID for resumption."""
-        # Find events after the last known event and replay them
-        for _, event_id, message in self._events[start_index:]:
+        start_index = None
+        stream_id = None
+        for index, (event_stream_id, event_id, _) in enumerate(self._events):
+            if event_id == last_event_id:
+                start_index = index + 1
+                stream_id = event_stream_id
+                break
+
+        if start_index is None:
+            return None
+
+        # Replay only later events from the session's original stream.
+        for event_stream_id, event_id, message in self._events[start_index:]:
+            if event_stream_id != stream_id:
+                continue
             await send_callback(EventMessage(message, event_id))
 
+        return stream_id
+
 # From server/server.py - Passing event store to session manager
 def create_server_app(event_store: Optional[EventStore] = None) -> Starlette:
     server = ResumableServer()
```

**File**: `11-agentic-protocols/code_samples/mcp-agents/server/event_store.py` (modified, +11/-11)
```diff
@@ -48,28 +48,28 @@ async def replay_events_after(
     ) -> StreamId | None:
         """Replay events after the specified ID."""
         logger.info(f"Replaying events after {last_event_id}")
-        
-        # Find the index of the last event ID
+
+        # Find the last event and its stream. Event IDs are global, but replay
+        # must remain scoped to the stream being resumed.
         start_index = None
-        for i, (_, event_id, _) in enumerate(self._events):
+        stream_id = None
+        for i, (event_stream_id, event_id, _) in enumerate(self._events):
             if event_id == last_event_id:
                 start_index = i + 1
+                stream_id = event_stream_id
                 break
 
         if start_index is None:
-            # If event ID not found, start from beginning
-            start_index = 0
-            logger.info("Event ID not found, starting from beginning")
+            logger.warning(f"Event ID {last_event_id} not found")
+            return None
 
-        stream_id = None
         # Replay events
         replayed_count = 0
-        for _, event_id, message in self._events[start_index:]:
+        for event_stream_id, event_id, message in self._events[start_index:]:
+            if event_stream_id != stream_id:
+                continue
             await send_callback(EventMessage(message, event_id))
             replayed_count += 1
-            # Capture the stream ID from the first replayed event
-            if stream_id is None and len(self._events) > start_index:
-                stream_id = self._events[start_index][0]
 
         logger.info(f"Replayed {replayed_count} events, stream_id: {stream_id}")
         return stream_id
```

**File**: `11-agentic-protocols/code_samples/mcp-agents/server/test_event_store.py` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import unittest
+from unittest.mock import AsyncMock
+
+from event_store import SimpleEventStore
+from mcp.server.streamable_http import EventMessage
+from mcp.types import JSONRPCMessage, JSONRPCNotification
+
+
+def message(method: str) -> JSONRPCMessage:
+    return JSONRPCMessage(root=JSONRPCNotification(jsonrpc="2.0", method=method))
+
+
+class SimpleEventStoreTests(unittest.IsolatedAsyncioTestCase):
+    async def test_replay_is_limited_to_original_stream(self) -> None:
+        store = SimpleEventStore()
+        first = message("notifications/first")
+        other_stream = message("notifications/other")
+        expected = message("notifications/expected")
+
+        last_event_id = await store.store_event("stream-a", first)
+        await store.store_event("stream-b", other_stream)
+        expected_event_id = await store.store_event("stream-a", expected)
+
+        callback = AsyncMock()
+        stream_id = await store.replay_events_after(last_event_id, callback)
+
+        self.assertEqual(stream_id, "stream-a")
+        callback.assert_awaited_once()
+        replayed = callback.await_args.args[0]
+        self.assertIsInstance(replayed, EventMessage)
+        self.assertEqual(replayed.event_id, expected_event_id)
+        self.assertIs(replayed.message, expected)
+
+    async def test_unknown_event_id_does_not_replay(self) -> None:
+        store = SimpleEventStore()
+        await store.store_event("stream-a", message("notifications/first"))
+        callback = AsyncMock()
+
+        stream_id = await store.replay_events_after("missing", callback)
+
+        self.assertIsNone(stream_id)
+        callback.assert_not_awaited()
+
+    async def test_returns_stream_when_no_later_events_exist(self) -> None:
+        store = SimpleEventStore()
+        last_event_id = await store.store_event(
+            "stream-a", message("notifications/first")
+        )
+
+        callback = AsyncMock()
+        stream_id = await store.replay_events_after(last_event_id, callback)
+
+        self.assertEqual(stream_id, "stream-a")
+        callback.assert_not_awaited()
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 9: `adae2638` (2026-08-26)
**Commit Message**: build(deps): bump the github-actions group with 3 updates

Bumps the github-actions group with 3 updates: [actions/checkout](https://github.com/actions/checkout), [azure/login](https://github.com/azure/login) and [actions/github-script](https://github.com/actions/github-script).


Updates `actions/checkout` from 4.4.0 to 7.0.1
- [Release notes](https://github.com/actions/checkout/releases)
- [Changelog](https://github.com/actions/checkout/blob/main/CHANGELOG.md)
- [Commits](https://github.com/actions/checkout/compare/11d5960a326750d5838078e36cf38b85af677262...3d3c42e5aac5ba805825da76410c181273ba90b1)

Updates `azure/login` from 2.3.1 to 3.0.1
- [Release notes](https://github.com/azure/login/releases)
- [Commits](https://github.com/azure/login/compare/7184910d9eb2b1c5e48f7073824a90609bb9b6d6...f5d393ae46f8fde4be8b75f32e3fc50e654ad0ca)

Updates `actions/github-script` from 8.0.0 to 9.0.0
- [Release notes](https://github.com/actions/github-script/releases)
- [Commits](https://github.com/actions/github-script/compare/ed597411d8f924073f98dfc5c65a23a2325f34cd...3a2844b7e9c422d3c10d287c895573f7108da1b3)

---
updated-dependencies:
- dependency-name: actions/checkout
  dependency-version: 7

**File**: `.github/workflows/smoke-test.yml` (modified, +2/-2)
```diff
@@ -47,10 +47,10 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: Checkout
-        uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
 
       - name: Azure login (OIDC)
-        uses: azure/login@7184910d9eb2b1c5e48f7073824a90609bb9b6d6 # v2.3.1
+        uses: azure/login@f5d393ae46f8fde4be8b75f32e3fc50e654ad0ca # v3.0.1
         with:
           client-id: ${{ secrets.AZURE_CLIENT_ID }}
           tenant-id: ${{ secrets.AZURE_TENANT_ID }}
```

**File**: `.github/workflows/welcome-issue.yml` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: Add Label and thanks comment to Issue
-        uses: actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd # v8.0.0
+        uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0
         with:
           script: |
             const issueAuthor = context.payload.sender.login
```

**File**: `.github/workflows/welcome-pr.yml` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ jobs:
     runs-on: ubuntu-latest
     steps:
       - name: Add Label and thanks comment to Pull request
-        uses: actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd # v8.0.0
+        uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0
         with:
           script: |
             const issueAuthor = context.payload.sender.login
```

---

### Incident Patch 10: `63eb4fab` (2026-08-25)
**Commit Message**: fix(lesson-10): send receipt as multimodal image input

**File**: `10-ai-agents-production/code_samples/10-expense_claim-demo.ipynb` (modified, +18/-26)
```diff
@@ -53,13 +53,12 @@
     "logging.getLogger(\"agent_framework.foundry\").setLevel(logging.ERROR)\n",
     "\n",
     "import os\n",
-    "import base64\n",
     "import dotenv\n",
     "from typing import Annotated, List\n",
     "\n",
     "from pydantic import BaseModel, Field\n",
     "\n",
-    "from agent_framework import tool, AgentResponseUpdate, WorkflowBuilder\n",
+    "from agent_framework import Content, Message, tool, AgentResponseUpdate, WorkflowBuilder\n",
     "from agent_framework.foundry import FoundryChatClient\n",
     "from azure.identity import DefaultAzureCredential\n",
     "\n",
@@ -186,11 +185,10 @@
    "cell_type": "markdown",
    "metadata": {},
    "source": [
-    "# Tool for Extracting Travel Expenses from Receipt Images\n",
+    "# Loading Travel Expense Receipt Images\n",
     "\n",
-    "Create a tool function to extract travel expenses from receipt images.\n",
-    "- This tool uses the `@tool` decorator from the Microsoft Agent Framework.\n",
-    "- It reads the receipt image, encodes it as base64, and returns the data URI for the agent to analyze."
+    "Create a helper function to load receipt images as native multimodal content.\n",
+    "- It reads the receipt image bytes and wraps them in Agent Framework `Content` for the agent to analyze."
    ]
   },
   {
@@ -199,19 +197,11 @@
    "metadata": {},
    "outputs": [],
    "source": [
-    "@tool(approval_mode=\"never_require\")\n",
-    "def load_receipt_image(\n",
-    "    image_path: Annotated[str, \"Path to the receipt image file\"] = \"receipt.jpg\"\n",
-    ") -> str:\n",
-    "    \"\"\"Load a receipt image and return its base64-encoded data URI for OCR extraction.\"\"\"\n",
-    "    try:\n",
-    "        with open(image_path, \"rb\") as f:\n",
-    "            image_data = base64.b64encode(f.read()).decode(\"utf-8\")\n",
-    "        return f\"data:image/jpeg;base64,{image_data}\"\n",
-    "    except Exception as e:\n",
-    "        error_msg = f\"[LOG] Error loading image '{image_path}': {str(e)}\"\n",
-    "        print(error_msg)\n",
-    "        return error_msg"
+    "def load_receipt_image(image_path: str = \"receipt.jpg\") -> Content:\n",
+    "    \"\"\"Load a receipt image as native multimodal content.\"\"\"\n",
+    "    with open(image_path, \"rb\") as f:\n",
+    "        image_bytes = f.read()\n",
+    "    return Content.from_data(image_bytes, \"image/jpeg\")"
    ]
   },
   {
@@ -221,7 +211,7 @@
     "## Processing Expenses\n",
     "\n",
     "Define the agents and wire them into a sequential workflow using `WorkflowBuilder`.\n",
-    "- The OCR agent extracts structured expense data from the receipt image using the `load_receipt_image` tool.\n",
+    "- The OCR agent extracts structured expense data from the receipt image supplied in the user message.\n",
     "- The Email agent takes the extracted data and generates a professional expense claim email using the `generate_expense_email` tool.\n",
     "- `WorkflowBuilder` with `add_edge` creates a sequential pipeline: OCR Agent → Email Agent."
    ]
@@ -233,11 +223,10 @@
    "outputs": [],
    "source": [
     "ocr_agent = client.as_agent(\n",
-    "    tools=[load_receipt_image],\n",
     "    name=\"OCRAgent\",\n",
     "    instructions=(\n",
     "        \"You are an expert OCR assistant specialized in extracting structured data from receipt images. \"\n",
-    "        \"Use the 'load_receipt_image' tool to load the receipt image, then analyze it and extract \"\n",
+    "        \"Analyze the receipt image supplied in the user message and extract \"\n",
     "        \"travel-related expense details in the format: 'date|description|amount|category' separated by semicolons. \"\n",
     "        \"Follow these rules: \"\n",
     "        \"- Date: Convert dates (e.g., '4/4/22') to 'dd-MMM-yyyy' (e.g., '04-Apr-2022'). \"\n",
@@ -276,9 +265,7 @@
    "cell_type": "markdown",
    "metadata": {},
    "source": [
-    "> **Note:** This workflow currently passes the receipt image as base64 text, which most chat models (including gpt-5-mini) will not treat as an image.\n",
-    "> It may also exceed the model context window. Prefer running OCR with Azure AI Vision (or another OCR tool) and pass only extracted text, or refactor to send the image as an `image_url` message.\n",
-    "> If you only want to avoid context errors, try a smaller receipt image or a model with a larger context window."
+    "> **Note:** The receipt bytes are wrapped in native Agent Framework multimodal `Content`, so Foundry receives them as image input rather than ordinary text."
    ]
   },
   {
@@ -299,8 +286,13 @@
     ")\n",
     "\n",
     "last_author = None\n",
+    "receipt_message = Message(\n",
+    "    role=\"user\",\n",
+    "    contents=[prompt, load_receipt_image(\"receipt.jpg\")],\n",
+    ")\n",
+    "\n",
     "events = workflow.run(\n",
-    "    prompt,\n",
+    "    receipt_message,\n",
     "    stream=True,\n",
     ")\n",
     "async for even
```

---

### Incident Patch 11: `5630ae4a` (2026-08-24)
**Commit Message**: Translate course guide to Japanese

https://github.com/microsoft/ai-agents-for-beginners/blob/main/translations/ja/STUDY_GUIDE.md
#PingMSFTDocs

**File**: `translations/ja/STUDY_GUIDE.md` (modified, +8/-9)
```diff
@@ -7,7 +7,7 @@
 
 ここが初めてなら、シンプルに始めましょう：
 
-1. [Course Setup](./00-course-setup/README.md) を読みます。
+1. [コース設定](./00-course-setup/README.md) を読みます。
 2. レッスン01～06を順番に完了します。
 3. 学びながら、一つの小さなデモアイデアを心に留めておきます。
 4. 各レッスンの後で「これまでできなかったことが、今エージェントは何ができる
@@ -61,7 +61,7 @@
 レッスンを進める中で、いくつかのプロバイダーオプションがあります：
 
 - **Microsoft Foundry / Azure OpenAI (Responses API)** — レッスン全体で使われる主要ルート。`az login`でキー不要のEntra ID認証が可能です。
-- **Foundry Local** — OpenAI互換APIを通じてデバイス上で完全にモデルを実行（クラウド不要、APIキー不要）。オフラインやコストなし実験に最適。[Course Setup](./00-course-setup/README.md)を参照。
+- **Foundry Local** — OpenAI互換APIを通じてデバイス上で完全にモデルを実行（クラウド不要、APIキー不要）。オフラインやコストなし実験に最適。[コース設定](./00-course-setup/README.md)を参照。
 - **MiniMax** — 大きなコンテキストモデルが使えるOpenAI互換プロバイダーで、代替として利用可能。
 
 > **注意：** GitHub Modelsは廃止予定（2026年7月引退）でResponses APIをサポートしていません。サンプルはAzure OpenAI / Microsoft Foundryへ更新されています。
@@ -90,12 +90,11 @@
 
 | レッスン | 学べること | レッスン後に試すこと |
 |--------|----------------|---------------------------|
-| [01 - Intro to AI Agents](./01-intro-to-ai-agents/README.md) | エージェントと基本的なチャットボットの違い。 | デモアイデアをチャットアプリではなくエージェントとして説明する。 |
-| [02 - Agentic Frameworks](./02-explore-agentic-frameworks/README.md) | モデル、ツール、状態、ワークフローを助けるフレームワーク。 | あなたのデモのどの部分をフレームワークが管理するか特定する。 |
-| [03 - Agentic Design Patterns](./03-agentic-design-patterns/README.md) | エージェントの動作設計でよく使われるパターン。 | コードを書く前にユーザージャーニーをスケッチする。 |
-| [04 - Tool Use](./04-tool-use/README.md) | エージェントがツールを使ってデータを得たり行動をとる方法。 | デモエージェントが必要とする一つのツールを定義する。 |
-| [05 - Agentic RAG](./05-agentic-rag/README.md) | 検索により文書やデータで回答を根拠づける方法。 | デモが検索すべき知識源を決める。 |
-
+| [01 - AIエージェント入門](./01-intro-to-ai-agents/README.md) | エージェントと基本的なチャットボットの違い。 | デモアイデアをチャットアプリではなくエージェントとして説明する。 |
+| [02 - エージェンティック・フレームワーク](./02-explore-agentic-frameworks/README.md) | モデル、ツール、状態、ワークフローを助けるフレームワーク。 | あなたのデモのどの部分をフレームワークが管理するか特定する。 |
+| [03 - エージェンティック・設計パターン](./03-agentic-design-patterns/README.md) | エージェントの動作設計でよく使われるパターン。 | コードを書く前にユーザージャーニーをスケッチする。 |
+| [04 - ツールの使用](./04-tool-use/README.md) | エージェントがツールを使ってデータを得たり行動をとる方法。 | デモエージェントが必要とする一つのツールを定義する。 |
+| [05 - エージェンティックRAG](./05-agentic-rag/README.md) | 検索により文書やデータで回答を根拠づける方法。 | デモが検索すべき知識源を決める。 |
 | [06 - 信頼できるエージェント](./06-building-trustworthy-agents/README.md) | ガードレール、監督、および安全な動作を追加する方法。 | エージェントが最初にユーザーに尋ねるべき場合のルールを1つ追加する。 |
 | [07 - 計画設計](./07-planning-design/README.md) | エージェントが大きな目標を小さなステップに分解する方法。 | デモのリクエストに対して3段階の計画を書く。 |
 | [08 - マルチエージェント設計](./08-multi-agent/README.md) | 仕事を専門エージェント間で分割するタイミング。 | デモに1つのエージェントが必要か複数かを決める。 |
@@ -242,4 +241,4 @@ RAGは、推測するのではなくソース資料からエージェントが
 <!-- CO-OP TRANSLATOR DISCLAIMER START -->
 **免責事項**：
 本書類は AI 翻訳サービス [Co-op Translator](https://github.com/Azure/co-op-translator) を使用して翻訳されています。正確性を期していますが、自動翻訳には誤りや不正確な部分が含まれる可能性があることをご承知おきください。原文の原語版が正式な情報源とみなされるべきです。重要な情報については、専門の人間による翻訳を推奨します。本翻訳の利用により生じたいかなる誤解や解釈違いについても、当方は責任を負いかねます。
-<!-- CO-OP TRANSLATOR DISCLAIMER END -->
\ No newline at end of file
+<!-- CO-OP TRANSLATOR DISCLAIMER END -->
```

---

### Incident Patch 12: `ce2154be` (2026-08-21)
**Commit Message**: [Fix] Fix markdown table formatting across all translations

**File**: `translations/ar/README.md` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@
 | بناء وكلاء ذكاء اصطناعي موثوقين                 | [رابط](./06-building-trustworthy-agents/README.md)  | [فيديو](https://youtu.be/iZKkMEGBCUQ?si=jZjpiMnGFOE9L8OK ) | [رابط](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst)    |
 | نمط تصميم التخطيط                             | [رابط](./07-planning-design/README.md)              | [فيديو](https://youtu.be/kPfJ2BrBCMY?si=6SC_iv_E5-mzucnC)  | [رابط](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst)    |
 | نمط تصميم متعدد الوكلاء                        | [رابط](./08-multi-agent/README.md)                   | [فيديو](https://youtu.be/V6HpE9hZEx0?si=rMgDhEu7wXo2uo6g)  | [رابط](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst)    |
-
 | نمط تصميم التفكير فوق المعرفي                 | [رابط](./09-metacognition/README.md)               | [فيديو](https://youtu.be/His9R6gw6Ec?si=8gck6vvdSNCt6OcF)  | [رابط](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | وكلاء الذكاء الاصطناعي في الإنتاج                      | [رابط](./10-ai-agents-production/README.md)        | [فيديو](https://youtu.be/l4TP6IyJxmQ?si=31dnhexRo6yLRJDl)  | [رابط](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | استخدام بروتوكولات الوكلاء (MCP، A2A و NLWeb) | [رابط](./11-agentic-protocols/README.md)           | [فيديو](https://youtu.be/X-Dh9R3Opn8)                                 | [رابط](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
```

**File**: `translations/ar/STUDY_GUIDE.md` (modified, +0/-1)
```diff
@@ -95,7 +95,6 @@
 | [03 - أنماط تصميم وكيلة](./03-agentic-design-patterns/README.md) | أنماط شائعة لتصميم سلوك الوكيل. | ارسم رحلة المستخدم قبل كتابة الكود. |
 | [04 - استخدام الأدوات](./04-tool-use/README.md) | كيف يستدعي الوكلاء الأدوات للحصول على بيانات أو اتخاذ إجراء. | حدد أداة واحدة يحتاجها نموذج وكيلك. |
 | [05 - وكيل RAG](./05-agentic-rag/README.md) | كيف يعتمد الاسترجاع على الأرضية للإجابات في الوثائق أو البيانات. | قرر مصدر المعرفة الذي يجب أن يبحث فيه نموذجك. |
-
 | [06 - وكلاء موثوقون](./06-building-trustworthy-agents/README.md) | كيفية إضافة الضوابط والإشراف والسلوك الأكثر أمانًا. | أضف قاعدة واحدة لتحديد متى يجب على الوكيل سؤال المستخدم أولاً. |
 | [07 - تصميم التخطيط](./07-planning-design/README.md) | كيف يقوم الوكلاء بتقسيم الأهداف الكبيرة إلى خطوات أصغر. | اكتب خطة من ثلاث خطوات لطلب العرض التوضيحي الخاص بك. |
 | [08 - تصميم متعدد الوكلاء](./08-multi-agent/README.md) | متى يتم تقسيم العمل بين وكلاء متخصصين. | قرر ما إذا كان العرض التوضيحي الخاص بك يحتاج إلى وكيل واحد أو عدة وكلاء. |
```

**File**: `translations/bg/README.md` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@
 | Създаване на доверени AI агенти                 | [Линк](./06-building-trustworthy-agents/README.md)    | [Видео](https://youtu.be/iZKkMEGBCUQ?si=jZjpiMnGFOE9L8OK ) | [Линк](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Дизайн модел за планиране                        | [Линк](./07-planning-design/README.md)                | [Видео](https://youtu.be/kPfJ2BrBCMY?si=6SC_iv_E5-mzucnC)  | [Линк](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Дизайн модел за мулти-агенти                     | [Линк](./08-multi-agent/README.md)                    | [Видео](https://youtu.be/V6HpE9hZEx0?si=rMgDhEu7wXo2uo6g)  | [Линк](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
-
 | Дизайнерски шаблон за метакогниция               | [Връзка](./09-metacognition/README.md)               | [Видео](https://youtu.be/His9R6gw6Ec?si=8gck6vvdSNCt6OcF)  | [Връзка](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | AI агенти в продукция                             | [Връзка](./10-ai-agents-production/README.md)        | [Видео](https://youtu.be/l4TP6IyJxmQ?si=31dnhexRo6yLRJDl)  | [Връзка](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Използване на агентни протоколи (MCP, A2A и NLWeb) | [Връзка](./11-agentic-protocols/README.md)           | [Видео](https://youtu.be/X-Dh9R3Opn8)                                 | [Връзка](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
```

**File**: `translations/bn/README.md` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@
 | বিশ্বাসযোগ্য এআই এজেন্ট নির্মাণ               | [লিঙ্ক](./06-building-trustworthy-agents/README.md) | [ভিডিও](https://youtu.be/iZKkMEGBCUQ?si=jZjpiMnGFOE9L8OK ) | [লিঙ্ক](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | পরিকল্পনা ডিজাইন প্যাটার্ন                     | [লিঙ্ক](./07-planning-design/README.md)             | [ভিডিও](https://youtu.be/kPfJ2BrBCMY?si=6SC_iv_E5-mzucnC)  | [লিঙ্ক](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | বহু-এজেন্ট ডিজাইন প্যাটার্ন                   | [লিঙ্ক](./08-multi-agent/README.md)                 | [ভিডিও](https://youtu.be/V6HpE9hZEx0?si=rMgDhEu7wXo2uo6g)  | [লিঙ্ক](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
-
 | মেটাকগনিশন ডিজাইন প্যাটার্ন                 | [Link](./09-metacognition/README.md)               | [Video](https://youtu.be/His9R6gw6Ec?si=8gck6vvdSNCt6OcF)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | প্রোডাকশনে AI এজেন্টস                      | [Link](./10-ai-agents-production/README.md)        | [Video](https://youtu.be/l4TP6IyJxmQ?si=31dnhexRo6yLRJDl)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | এজেন্টিক প্রোটোকল ব্যবহার (MCP, A2A এবং NLWeb) | [Link](./11-agentic-protocols/README.md)           | [Video](https://youtu.be/X-Dh9R3Opn8)                                 | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
```

**File**: `translations/cs/README.md` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@ Máte návrhy nebo jste našli chyby ve psaní či kódu? [Založte issue](https
 | Budování důvěryhodných AI agentů               | [Odkaz](./06-building-trustworthy-agents/README.md) | [Video](https://youtu.be/iZKkMEGBCUQ?si=jZjpiMnGFOE9L8OK ) | [Odkaz](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Návrhový vzor plánování                         | [Odkaz](./07-planning-design/README.md)             | [Video](https://youtu.be/kPfJ2BrBCMY?si=6SC_iv_E5-mzucnC)  | [Odkaz](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Návrhový vzor více agentů                      | [Odkaz](./08-multi-agent/README.md)                 | [Video](https://youtu.be/V6HpE9hZEx0?si=rMgDhEu7wXo2uo6g)  | [Odkaz](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
-
 | Vzor návrhu metakognice                 | [Link](./09-metacognition/README.md)               | [Video](https://youtu.be/His9R6gw6Ec?si=8gck6vvdSNCt6OcF)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | AI agenti v produkci                      | [Link](./10-ai-agents-production/README.md)        | [Video](https://youtu.be/l4TP6IyJxmQ?si=31dnhexRo6yLRJDl)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Používání agentních protokolů (MCP, A2A a NLWeb) | [Link](./11-agentic-protocols/README.md)           | [Video](https://youtu.be/X-Dh9R3Opn8)                                 | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
```

**File**: `translations/da/README.md` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@ Har du forslag eller fundet stave- eller kodefejl? [Opret et issue](https://gith
 | Bygning af pålidelige AI-agenter               | [Link](./06-building-trustworthy-agents/README.md) | [Video](https://youtu.be/iZKkMEGBCUQ?si=jZjpiMnGFOE9L8OK ) | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Designmønster for planlægning                    | [Link](./07-planning-design/README.md)             | [Video](https://youtu.be/kPfJ2BrBCMY?si=6SC_iv_E5-mzucnC)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Designmønster for multi-agent                    | [Link](./08-multi-agent/README.md)                 | [Video](https://youtu.be/V6HpE9hZEx0?si=rMgDhEu7wXo2uo6g)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
-
 | Metakognition Designmønster                 | [Link](./09-metacognition/README.md)               | [Video](https://youtu.be/His9R6gw6Ec?si=8gck6vvdSNCt6OcF)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | AI-agenter i produktion                      | [Link](./10-ai-agents-production/README.md)        | [Video](https://youtu.be/l4TP6IyJxmQ?si=31dnhexRo6yLRJDl)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Brug af agentiske protokoller (MCP, A2A og NLWeb) | [Link](./11-agentic-protocols/README.md)           | [Video](https://youtu.be/X-Dh9R3Opn8)                                 | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
```

**File**: `translations/de/README.md` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@ Haben Sie Vorschläge oder Fehler in Rechtschreibung oder Code gefunden? [Eröff
 | Vertrauenswürdige KI-Agenten entwickeln         | [Link](./06-building-trustworthy-agents/README.md) | [Video](https://youtu.be/iZKkMEGBCUQ?si=jZjpiMnGFOE9L8OK ) | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst)          |
 | Designmuster für Planung                         | [Link](./07-planning-design/README.md)             | [Video](https://youtu.be/kPfJ2BrBCMY?si=6SC_iv_E5-mzucnC)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst)          |
 | Designmuster für Multi-Agenten                   | [Link](./08-multi-agent/README.md)                 | [Video](https://youtu.be/V6HpE9hZEx0?si=rMgDhEu7wXo2uo6g)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst)          |
-
 | Metakognition-Designmuster                 | [Link](./09-metacognition/README.md)               | [Video](https://youtu.be/His9R6gw6Ec?si=8gck6vvdSNCt6OcF)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | KI-Agenten im Einsatz                      | [Link](./10-ai-agents-production/README.md)        | [Video](https://youtu.be/l4TP6IyJxmQ?si=31dnhexRo6yLRJDl)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Verwendung agentenbasierter Protokolle (MCP, A2A und NLWeb) | [Link](./11-agentic-protocols/README.md)           | [Video](https://youtu.be/X-Dh9R3Opn8)                                 | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
```

**File**: `translations/el/README.md` (modified, +0/-1)
```diff
@@ -103,7 +103,6 @@
 | Δημιουργία Αξιόπιστων Πρακτόρων AI             | [Σύνδεσμος](./06-building-trustworthy-agents/README.md) | [Βίντεο](https://youtu.be/iZKkMEGBCUQ?si=jZjpiMnGFOE9L8OK ) | [Σύνδεσμος](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Σχεδιαστικό Πρότυπο Προγραμματισμού           | [Σύνδεσμος](./07-planning-design/README.md)        | [Βίντεο](https://youtu.be/kPfJ2BrBCMY?si=6SC_iv_E5-mzucnC) | [Σύνδεσμος](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Σχεδιαστικό Πρότυπο Πολλαπλών Πρακτόρων       | [Σύνδεσμος](./08-multi-agent/README.md)            | [Βίντεο](https://youtu.be/V6HpE9hZEx0?si=rMgDhEu7wXo2uo6g) | [Σύνδεσμος](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
-
 | Σχέδιο Μεταγνωσίας                 | [Link](./09-metacognition/README.md)               | [Video](https://youtu.be/His9R6gw6Ec?si=8gck6vvdSNCt6OcF)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Πράκτορες AI στην Παραγωγή                      | [Link](./10-ai-agents-production/README.md)        | [Video](https://youtu.be/l4TP6IyJxmQ?si=31dnhexRo6yLRJDl)  | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
 | Χρήση Πρωτοκόλλων Πράκτορα (MCP, A2A και NLWeb) | [Link](./11-agentic-protocols/README.md)           | [Video](https://youtu.be/X-Dh9R3Opn8)                                 | [Link](https://aka.ms/ai-agents-beginners/collection?WT.mc_id=academic-105485-koreyst) |
```

---

### Incident Patch 13: `18028673` (2026-08-21)
**Commit Message**: fix(mcp): scope event replay to original stream

Signed-off-by: KXH <[REDACTED_EMAIL]>

**File**: `11-agentic-protocols/code_samples/mcp-agents/README.md` (modified, +17/-2)
```diff
@@ -367,10 +367,25 @@ class SimpleEventStore(EventStore):
 
     async def replay_events_after(self, last_event_id: EventId, send_callback: EventCallback) -> StreamId | None:
         """Replay events after the specified ID for resumption."""
-        # Find events after the last known event and replay them
-        for _, event_id, message in self._events[start_index:]:
+        start_index = None
+        stream_id = None
+        for index, (event_stream_id, event_id, _) in enumerate(self._events):
+            if event_id == last_event_id:
+                start_index = index + 1
+                stream_id = event_stream_id
+                break
+
+        if start_index is None:
+            return None
+
+        # Replay only later events from the session's original stream.
+        for event_stream_id, event_id, message in self._events[start_index:]:
+            if event_stream_id != stream_id:
+                continue
             await send_callback(EventMessage(message, event_id))
 
+        return stream_id
+
 # From server/server.py - Passing event store to session manager
 def create_server_app(event_store: Optional[EventStore] = None) -> Starlette:
     server = ResumableServer()
```

**File**: `11-agentic-protocols/code_samples/mcp-agents/server/event_store.py` (modified, +11/-11)
```diff
@@ -48,28 +48,28 @@ async def replay_events_after(
     ) -> StreamId | None:
         """Replay events after the specified ID."""
         logger.info(f"Replaying events after {last_event_id}")
-        
-        # Find the index of the last event ID
+
+        # Find the last event and its stream. Event IDs are global, but replay
+        # must remain scoped to the stream being resumed.
         start_index = None
-        for i, (_, event_id, _) in enumerate(self._events):
+        stream_id = None
+        for i, (event_stream_id, event_id, _) in enumerate(self._events):
             if event_id == last_event_id:
                 start_index = i + 1
+                stream_id = event_stream_id
                 break
 
         if start_index is None:
-            # If event ID not found, start from beginning
-            start_index = 0
-            logger.info("Event ID not found, starting from beginning")
+            logger.warning(f"Event ID {last_event_id} not found")
+            return None
 
-        stream_id = None
         # Replay events
         replayed_count = 0
-        for _, event_id, message in self._events[start_index:]:
+        for event_stream_id, event_id, message in self._events[start_index:]:
+            if event_stream_id != stream_id:
+                continue
             await send_callback(EventMessage(message, event_id))
             replayed_count += 1
-            # Capture the stream ID from the first replayed event
-            if stream_id is None and len(self._events) > start_index:
-                stream_id = self._events[start_index][0]
 
         logger.info(f"Replayed {replayed_count} events, stream_id: {stream_id}")
         return stream_id
```

**File**: `11-agentic-protocols/code_samples/mcp-agents/server/test_event_store.py` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import unittest
+from unittest.mock import AsyncMock
+
+from event_store import SimpleEventStore
+from mcp.server.streamable_http import EventMessage
+from mcp.types import JSONRPCMessage, JSONRPCNotification
+
+
+def message(method: str) -> JSONRPCMessage:
+    return JSONRPCMessage(root=JSONRPCNotification(jsonrpc="2.0", method=method))
+
+
+class SimpleEventStoreTests(unittest.IsolatedAsyncioTestCase):
+    async def test_replay_is_limited_to_original_stream(self) -> None:
+        store = SimpleEventStore()
+        first = message("notifications/first")
+        other_stream = message("notifications/other")
+        expected = message("notifications/expected")
+
+        last_event_id = await store.store_event("stream-a", first)
+        await store.store_event("stream-b", other_stream)
+        expected_event_id = await store.store_event("stream-a", expected)
+
+        callback = AsyncMock()
+        stream_id = await store.replay_events_after(last_event_id, callback)
+
+        self.assertEqual(stream_id, "stream-a")
+        callback.assert_awaited_once()
+        replayed = callback.await_args.args[0]
+        self.assertIsInstance(replayed, EventMessage)
+        self.assertEqual(replayed.event_id, expected_event_id)
+        self.assertIs(replayed.message, expected)
+
+    async def test_unknown_event_id_does_not_replay(self) -> None:
+        store = SimpleEventStore()
+        await store.store_event("stream-a", message("notifications/first"))
+        callback = AsyncMock()
+
+        stream_id = await store.replay_events_after("missing", callback)
+
+        self.assertIsNone(stream_id)
+        callback.assert_not_awaited()
+
+    async def test_returns_stream_when_no_later_events_exist(self) -> None:
+        store = SimpleEventStore()
+        last_event_id = await store.store_event(
+            "stream-a", message("notifications/first")
+        )
+
+        callback = AsyncMock()
+        stream_id = await store.replay_events_after(last_event_id, callback)
+
+        self.assertEqual(stream_id, "stream-a")
+        callback.assert_not_awaited()
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 14: `342a0b0a` (2026-08-18)
**Commit Message**: Fix concurrent workflow review feedback

Co-authored-by: leestott <[REDACTED_EMAIL]>

**File**: `translations/en/08-multi-agent/code_samples/workflows-agent-framework/dotNET/03.dotnet-agent-framework-workflow-ghmodel-concurrent.md` (modified, +8/-4)
```diff
@@ -80,7 +80,7 @@ graph TD
     F --> H
     G --> H
     
-    H --> I[Synchronized Output MERMAAD_SLOT_10: Azure OpenAI (Responses API)]
+    H --> I[Synchronized Output]
     
     J[Azure OpenAI (Responses API)] --> D
     J --> E
@@ -273,13 +273,17 @@ Modify the aggregation logic to support variable agent counts:
 ```csharp
 private int _expectedAgentCount;
 private readonly List<ChatMessage> _messages = [];
+private readonly object _messagesLock = new();
 
 public override ValueTask HandleAsync(ChatMessage message, IWorkflowContext context, CancellationToken cancellationToken = default)
 {
-    this._messages.Add(message);
-    if (this._messages.Count == _expectedAgentCount)
+    lock (this._messagesLock)
     {
-        // Process aggregation
+        this._messages.Add(message);
+        if (this._messages.Count == _expectedAgentCount)
+        {
+            // Process aggregation
+        }
     }
     
     return ValueTask.CompletedTask;
```

---

### Incident Patch 15: `01777b05` (2026-08-18)
**Commit Message**: Merge pull request #718 from microsoft/copilot/fix-code-for-review-comments

Fix concurrent workflow aggregation compile issue

**File**: `08-multi-agent/code_samples/workflows-agent-framework/dotNET/03.dotnet-agent-framework-workflow-ghmodel-concurrent.cs` (modified, +14/-13)
```diff
@@ -14,7 +14,6 @@
 using Microsoft.Agents.AI;
 using Microsoft.Agents.AI.Workflows;
 using DotNetEnv;
-using System.Text;
 
 // Load environment variables from .env file
 Env.Load("../../../.env");
@@ -97,6 +96,7 @@ public override async ValueTask HandleAsync(string message, IWorkflowContext con
 public class ConcurrentAggregationExecutor() : Executor<ChatMessage>("ConcurrentAggregationExecutor")
 {
     private readonly List<ChatMessage> _messages = [];
+    private readonly object _lock = new();
 
     /// <summary>
     /// Handles incoming messages from the agents and aggregates their responses.
@@ -105,22 +105,23 @@ public class ConcurrentAggregationExecutor() : Executor<ChatMessage>("Concurrent
     /// <param name="context">Workflow context for accessing workflow services and adding events</param>
     /// <returns>A task representing the asynchronous operation</returns>
 
-    public override ValueTask HandleAsync(ChatMessage message, IWorkflowContext context, CancellationToken cancellationToken = default)
+    public override async ValueTask HandleAsync(ChatMessage message, IWorkflowContext context, CancellationToken cancellationToken = default)
     {
-        this._messages.Add(message);
-        return ValueTask.CompletedTask;
-    }
-
+        string? formattedMessages = null;
 
-    protected override ValueTask OnMessageDeliveryFinishedAsync(IWorkflowContext context, CancellationToken cancellationToken = default)
-    {
-        StringBuilder resultBuilder = new();
-        foreach (ChatMessage m in this._messages)
+        lock (this._lock)
         {
-            var formattedMessages = string.Join(Environment.NewLine, this._messages.Select(m => $"{m.AuthorName}: {m.Text}"));
-            return context.YieldOutputAsync(formattedMessages);
+            this._messages.Add(message);
+
+            if (this._messages.Count == 2)
+            {
+                formattedMessages = string.Join(Environment.NewLine, this._messages.Select(m => $"{m.AuthorName}: {m.Text}"));
+            }
         }
 
-        return ValueTask.CompletedTask;
+        if (formattedMessages is not null)
+        {
+            await context.YieldOutputAsync(formattedMessages);
+        }
     }
 }
```

**File**: `08-multi-agent/code_samples/workflows-agent-framework/dotNET/03.dotnet-agent-framework-workflow-ghmodel-concurrent.ipynb` (modified, +14/-12)
```diff
@@ -533,6 +533,7 @@
     "public class ConcurrentAggregationExecutor() : Executor<ChatMessage>(\"ConcurrentAggregationExecutor\")\n",
     "{\n",
     "    private readonly List<ChatMessage> _messages = [];\n",
+    "    private readonly object _lock = new();\n",
     "\n",
     "    /// <summary>\n",
     "    /// Handles incoming messages from the agents and aggregates their responses.\n",
@@ -541,23 +542,24 @@
     "    /// <param name=\"context\">Workflow context for accessing workflow services and adding events</param>\n",
     "    /// <returns>A task representing the asynchronous operation</returns>\n",
     "\n",
-    "    public override ValueTask HandleAsync(ChatMessage message, IWorkflowContext context, CancellationToken cancellationToken = default)\n",
+    "    public override async ValueTask HandleAsync(ChatMessage message, IWorkflowContext context, CancellationToken cancellationToken = default)\n",
     "    {\n",
-    "        this._messages.Add(message);\n",
-    "        return ValueTask.CompletedTask;\n",
-    "    }\n",
-    "\n",
+    "        string? formattedMessages = null;\n",
     "\n",
-    "    protected override ValueTask OnMessageDeliveryFinishedAsync(IWorkflowContext context, CancellationToken cancellationToken = default)\n",
-    "    {\n",
-    "        StringBuilder resultBuilder = new();\n",
-    "        foreach (ChatMessage m in this._messages)\n",
+    "        lock (this._lock)\n",
     "        {\n",
-    "            var formattedMessages = string.Join(Environment.NewLine, this._messages.Select(m => $\"{m.AuthorName}: {m.Text}\"));\n",
-    "            return context.YieldOutputAsync(formattedMessages);\n",
+    "            this._messages.Add(message);\n",
+    "\n",
+    "            if (this._messages.Count == 2)\n",
+    "            {\n",
+    "                formattedMessages = string.Join(Environment.NewLine, this._messages.Select(m => $\"{m.AuthorName}: {m.Text}\"));\n",
+    "            }\n",
     "        }\n",
     "\n",
-    "        return ValueTask.CompletedTask;\n",
+    "        if (formattedMessages is not null)\n",
+    "        {\n",
+    "            await context.YieldOutputAsync(formattedMessages);\n",
+    "        }\n",
     "    }\n",
     "}"
    ]
```

#### Recent Merged Pull Requests:
- **PR #763** (closed): 01. integrate with OpenAI .NET SDK (@lmtoan99)
- **PR #748** (closed): [CI] Pilot automatic assignment for translation issues and PRs (@skytin1004)
- **PR #742** (closed): Practice (@PoulamiDasDA)
- **PR #737** (closed): docs: add synthetic evaluation data guidance (@ravikiranpagidi)
- **PR #736** (2026-09-09): [Fix] Update lesson directory range in AGENTS.md (@dhruvatr)
- **PR #735** (2026-09-09): Use a specific Azure.Search.Documents package version (@dhruvatr)
- **PR #733** (2026-09-09): Translate lesson titles to Japanese in study guide (@hyoshioka0128)
- **PR #732** (closed): chore(i18n): sync translations with latest source changes (@localizeflow[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
