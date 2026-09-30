# Forensic Learning Record (Deep Inspection): trustgraph-ai/trustgraph

> **Canonical Artifact**: `07_PROJECT_LEARNING/trustgraph-ai-trustgraph-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/trustgraph-ai/trustgraph](https://github.com/trustgraph-ai/trustgraph))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:09:12.149Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `trustgraph-ai/trustgraph`
- **Description**: The Semantic Intelligence Layer for Ontologies
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2764 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `check_imports.py`
```
#!/usr/bin/env python3
"""
Check if TrustGraph imports work correctly for testing
"""

import sys
import traceback

def check_import(module_name, description):
    """Try to import a module and report the result"""
    try:
        __import__(module_name)
        print(f"✅ {description}: {module_name}")
        return True
    except ImportError as e:
        print(f"❌ {description}: {module_name}")
        print(f"   Error: {e}")
        return False
    except Exception as e:
        print(f"❌ {description}: {module_name}")
        print(f"   Unexpected error: {e}")
        return False

def main():
    print("Checking TrustGraph imports for testing...")
    print("=" * 50)
    
    imports_to_check = [
        ("trustgraph", "Base trustgraph package"),
        ("trustgraph.base", "Base classes"),
        ("trustgraph.base.llm_service", "LLM service base class"),
        ("trustgraph.base.image_to_text_service", "Image-to-text service base class"),
        ("trustgraph.schema", "Schema definitions"),
        ("trustgraph.exceptions", "Exception classes"),
        ("trustgraph.model", "Model package"),
        ("trustgraph.model.text_completion", "Text completion package"),
        ("trustgraph.model.text_completion.vertexai", "VertexAI package"),
        ("trustgraph.model.image_to_text", "Image-to-text package"),
        ("trustgraph.model.image_to_text.openai", "Image-to-text OpenAI package"),
    ]
    
    success_count = 0
    total_count = len(imports_to_check)
    
    for module_name, description in imports_to_check:
        if check_import(module_name, description):
            success_count += 1
        print()
    
    print("=" * 50)
    print(f"Import Check Results: {success_count}/{total_count} successful")
    
    if success_count == total_count:
        print("✅ All imports successful! Tests should work.")
    else:
        print("❌ Some imports failed. Please install missing packages.")
        print("\nTo fix, run:")
        print("  ./install_packages.sh")
        print("or install packages manually:")
        print("  cd trustgraph-base && pip install -e . && cd ..")
        print("  cd trustgraph-vertexai && pip install -e . && cd ..")
        print("  cd trustgraph-flow && pip install -e . && cd ..")
    
    # Test the specific import used in the test
    print("\n" + "=" * 50)
    print("Testing specific import from test file...")
    try:
        from trustgraph.model.text_completion.vertexai.llm import Processor
        from trustgraph.schema import TextCompletionRequest, TextCompletionResponse, Error
        from trustgraph.base import LlmResult
        print("✅ Test imports successful!")
    except Exception as e:
        print(f"❌ Test imports failed: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `dev-tools/explainable-ai/index.js`
```

// ============================================================================
// TrustGraph Explainability API Demo
// ============================================================================
//
// This example demonstrates how to use the TrustGraph streaming agent API
// with explainability events. It shows how to:
//
//   1. Send an agent query and receive streaming thinking/observation/answer
//   2. Receive and parse explainability events as they arrive
//   3. Resolve the provenance chain for knowledge graph edges:
//      subgraph -> chunk -> page -> document
//   4. Fetch source text from the librarian using chunk IDs
//
// Explainability events use RDF triples (W3C PROV ontology + TrustGraph
// namespace) to describe the retrieval pipeline. The key event types are:
//
//   - AgentQuestion: The initial user query
//   - Analysis/ToolUse: Agent deciding which tool to invoke
//   - GraphRagQuestion: A sub-query sent to the Graph RAG pipeline
//   - Grounding: Concepts extracted from the query for graph traversal
//   - Exploration: Entities discovered during knowledge graph traversal
//   - Focus: The selected knowledge graph edges (triples) used for context
//   - Synthesis: The RAG answer synthesised from retrieved context
//   - Observation: The tool result returned to the agent
//   - Conclusion/Answer: The agent's final answer
//
// Each event carries RDF triples that link back through the provenance chain,
// allowing full traceability from answer back to source documents.
// ============================================================================

import { createTrustGraphSocket } from '@trustgraph/client';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const USER = "trustgraph";

// Simple question
const QUESTION = "Tell me about the author of the document";

// Likely to trigger the deep research plan-and-execute pattern
//const QUESTION = "Do deep research and explain the risks posed globalisation in the modern world";

const SOCKET_URL = "ws://localhost:8888/api/v1/socket";

// ---------------------------------------------------------------------------
// RDF predicates and TrustGraph namespace constants
// ---------------------------------------------------------------------------

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const PROV_DERIVED = "http://www.w3.org/ns/prov#wasDerivedFrom";

const TG_GROUNDING = "https://trustgraph.ai/ns/Grounding";
const TG_CONCEPT = "https://trustgraph.ai/ns/concept";
const TG_EXPLORATION = "https://trustgraph.ai/ns/Exploration";
const TG_ENTITY = "https://trustgraph.ai/ns/entity";
const TG_FOCUS = "https://trustgraph.ai/ns/Focus";
const TG_EDGE = "https://trustgraph.ai/ns/edge";
const TG_CONTAINS = "https://trustgraph.ai/ns/contains";

// ---------------------------------------------------------------------------
// Utility: check whether a set of triples assigns a given RDF type to an ID
// ---------------------------------------------------------------------------

const isType = (triples, id, type) =>
    triples.some(t => t.s.i === id && t.p.i === RDF_TYPE && t.o.i === type);

// ---------------------------------------------------------------------------
// Utility: word-wrap text for display
// ---------------------------------------------------------------------------

const wrapText = (text, width, indent, maxLines) => {
    const clean = text.replace(/\s+/g, " ").trim();
    const lines = [];
    let remaining = clean;
    while (remaining.length > 0 && lines.length < maxLines) {
        if (remaining.length <= width) {
            lines.push(remaining);
            break;
        }
        let breakAt = remaining.lastIndexOf(" ", width);
        if (breakAt <= 0) breakAt = width;
        lines.push(remaining.substring(0, breakAt));
        remaining = remaining.substring(breakAt).trimStart();
    }
    if (remaining.length > 0 && lines.length >= maxLines)
        lines[lines.length - 1] += " ...";
    return lines.map(l => indent + l).join("\n");
};

// ---------------------------------------------------------------------------
// Connect to TrustGraph
// ---------------------------------------------------------------------------

console.log("=".repeat(80));
console.log("TrustGraph Explainability API Demo");
console.log("=".repeat(80));
console.log(`Connecting to: ${SOCKET_URL}`);
console.log(`Question: ${QUESTION}`);
console.log("=".repeat(80));

const client = createTrustGraphSocket(USER, undefined, SOCKET_URL);

console.log("Connected, sending query...\n");

// Get a flow handle. Flows provide access to AI operations (agent, RAG,
// text completion, etc.) as well as knowledge graph queries.
const flow = client.flow("default");

// Get a librarian handle for fetching source document text.
const librarian = client.librarian();

// ---------------------------------------------------------------------------
// Inline explain event printing
// ---------------------------------------------------------------------------
// Explain events arrive during streaming alongside thinking/observation/
// answer chunks. We print a summary immediately and store them for
// post-processing (label resolution and provenance lookups require async
// queries that can't run inside the synchronous callback).

const explainEvents = [];

const printExplainInline = (explainEvent) => {
    const { explainId, explainTriples } = explainEvent;
    if (!explainTriples) return;

    // Extract the RDF types assigned to the explain event's own ID.
    // Every explain event has rdf:type triples that identify what kind
    // of pipeline step it represents (Grounding, Exploration, Focus, etc.)
    const types = explainTriples
        .filter(t => t.s.i === explainId && t.p.i === RDF_TYPE)
        .map(t => t.o.i);

    // Show short type names (e.g. "Grounding" instead of full URI)
    const shortTypes = types
        .map(t => t.split("/").pop().split("#").pop())
        .join(", ");
    console.log(`  [explain] ${shortTypes}`);

    // Grounding events contain the concepts extracted from the query.
    // These are the seed terms used to begin knowledge graph traversal.
    if (isType(explainTriples, explainId, TG_GROUNDING)) {
        const concepts = explainTriples
            .filter(t => t.s.i === explainId && t.p.i === TG_CONCEPT)
            .map(t => t.o.v);
        console.log(`    Grounding concepts: ${concepts.join(", ")}`);
    }

    // Exploration events list the entities found during graph traversal.
    // We show the count here; labelled names are printed after resolution.
    if (isType(explainTriples, explainId, TG_EXPLORATION)) {
        const count = explainTriples
            .filter(t => t.s.i === explainId && t.p.i === TG_ENTITY).length;
        console.log(`    Entities: ${count} found (see below)`);
    }
};

const collectExplain = (explainEvent) => {
    printExplainInline(explainEvent);
    explainEvents.push(explainEvent);
};

// ---------------------------------------------------------------------------
// Label resolution
// ---------------------------------------------------------------------------
// Many explain triples reference entities and predicates by URI. We query
// the knowledge graph for rdfs:label to get human-readable names.

const resolveLabels = async (uris) => {
    const labels = new Map();
    await Promise.all(uris.map(async (uri) => {
        try {
            const results = await flow.triplesQuery(
                { t: "i", i: uri },
                { t: "i", i: RDFS_LABEL },
            );
            if (results.length > 0) {
                labels.set(uri, results[0].o.v);
            }
        } catch (e) {
            // No label found, fall back to URI
        }
    }));
    return labels;
};

// --------------------------------------
```

### Core Architecture Module: `dev-tools/library_client.py`
```
#!/usr/bin/env python3

"""
Client utility for browsing and loading documents from the TrustGraph
public document library.

Usage:
    python library_client.py list
    python library_client.py search <text>
    python library_client.py load-all
    python library_client.py load-doc <id>
    python library_client.py load-match <text>
"""

import json
import urllib.request
import sys
import os
import argparse

from trustgraph.api import Api
from trustgraph.api.types import Uri, Literal, Triple

BUCKET_URL = "https://storage.googleapis.com/trustgraph-library"
INDEX_URL = f"{BUCKET_URL}/index.json"

default_url = os.getenv("TRUSTGRAPH_URL", "http://localhost:8888/")
default_workspace = os.getenv("TRUSTGRAPH_WORKSPACE", "default")
default_token = os.getenv("TRUSTGRAPH_TOKEN", None)


def fetch_index():
    with urllib.request.urlopen(INDEX_URL) as resp:
        return json.loads(resp.read())


def fetch_document_metadata(doc_id):
    url = f"{BUCKET_URL}/{doc_id}.json"
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read())


def fetch_document_content(doc_id):
    url = f"{BUCKET_URL}/{doc_id}.epub"
    with urllib.request.urlopen(url) as resp:
        return resp.read()


def search_index(index, query):
    query = query.lower()
    results = []
    for doc in index:
        title = doc.get("title", "").lower()
        comments = doc.get("comments", "").lower()
        tags = [t.lower() for t in doc.get("tags", [])]
        if (query in title or query in comments or
                any(query in t for t in tags)):
            results.append(doc)
    return results


def print_index(index):
    if not index:
        return

    # Calculate column widths
    id_width = max(len(str(doc.get("id", ""))) for doc in index)
    title_width = max(len(doc.get("title", "")) for doc in index)

    # Cap title width for readability
    title_width = min(title_width, 60)
    id_width = max(id_width, 2)

    try:
        term_width = os.get_terminal_size().columns
    except OSError:
        term_width = 120

    tags_width = max(term_width - id_width - title_width - 6, 20)

    header = f"{'ID':<{id_width}}  {'Title':<{title_width}}  {'Tags':<{tags_width}}"
    print(header)
    print("-" * len(header))

    for doc in index:
        eid = str(doc.get("id", ""))
        title = doc.get("title", "")
        if len(title) > title_width:
            title = title[:title_width - 3] + "..."
        tags = ", ".join(doc.get("tags", []))
        if len(tags) > tags_width:
            tags = tags[:tags_width - 3] + "..."
        print(f"{eid:<{id_width}}  {title:<{title_width}}  {tags}")


def convert_value(v):
    """Convert a JSON triple value to a Uri or Literal."""
    if v["type"] == "uri":
        return Uri(v["value"])
    else:
        return Literal(v["value"])


def convert_metadata(metadata_json):
    """Convert JSON metadata triples to Triple objects."""
    triples = []
    for t in metadata_json:
        triples.append(Triple(
            s=convert_value(t["s"]),
            p=convert_value(t["p"]),
            o=convert_value(t["o"]),
        ))
    return triples


def load_document(api, doc_entry):
    """Fetch metadata and content for a document, then load into TrustGraph."""
    doc_id = doc_entry["id"]
    title = doc_entry["title"]

    print(f"  [{doc_id}] {title}")

    print(f"    fetching metadata...")
    doc_json = fetch_document_metadata(doc_id)
    doc = doc_json[0]

    print(f"    fetching content...")
    content = fetch_document_content(doc_id)

    print(f"    loading into TrustGraph ({len(content) // 1024}KB)...")
    metadata = convert_metadata(doc["metadata"])

    api.add_document(
        id=doc["id"],
        metadata=metadata,
        kind=doc["kind"],
        title=doc["title"],
        comments=doc["comments"],
        tags=doc["tags"],
        document=content,
    )

    print(f"    done.")


def load_documents(api, docs):
    """Load a list of documents."""
    print(f"Loading {len(docs)} document(s)...\n")
    for doc in docs:
        try:
            load_document(api, doc)
        except Exception as e:
            print(f"    FAILED: {e}", file=sys.stderr)
        print()
    print("Complete.")


def main():
    parser = argparse.ArgumentParser(
        description="Browse and load documents from the TrustGraph public document library.",
    )

    parser.add_argument(
        "-u", "--url", default=default_url,
        help=f"TrustGraph API URL (default: {default_url})",
    )
    parser.add_argument(
        "-w", "--workspace", default=default_workspace,
        help=f"Workspace (default: {default_workspace})",
    )
    parser.add_argument(
        "-t", "--token", default=default_token,
        help="Authentication token (default: $TRUSTGRAPH_TOKEN)",
    )

    sub = parser.add_subparsers(dest="command")

    sub.add_parser("list", help="List all documents")

    search_parser = sub.add_parser("search", help="Search documents")
    search_parser.add_argument("query", help="Text to search for")

    sub.add_parser("load-all", help="Load all documents into TrustGraph")

    load_doc_parser = sub.add_parser("load-doc", help="Load a document by ID")
    load_doc_parser.add_argument("id", help="Document ID (ebook number)")

    load_match_parser = sub.add_parser(
        "load-match", help="Load all documents matching a search term",
    )
    load_match_parser.add_argument("query", help="Text to search for")

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    index = fetch_index()

    if args.command in ("list", "search"):
        if args.command == "list":
            print_index(index)
        else:
            results = search_index(index, args.query)
            if results:
                print_index(results)
            else:
                print("No matches found.", file=sys.stderr)
                sys.exit(1)
        return

    # Load commands need the API
    api = Api(args.url, token=args.token, workspace=args.workspace).library()

    if args.command == "load-all":
        load_documents(api, index)

    elif args.command == "load-doc":
        matches = [d for d in index if str(d.get("id")) == args.id]
        if not matches:
            print(f"No document with ID '{args.id}' found.", file=sys.stderr)
            sys.exit(1)
        load_documents(api, matches)

    elif args.command == "load-match":
        results = search_index(index, args.query)
        if results:
            load_documents(api, results)
        else:
            print("No matches found.", file=sys.stderr)
            sys.exit(1)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `trustgraph-base/trustgraph/api/__init__.py`
```
"""
TrustGraph API Client Library

This package provides Python client interfaces for interacting with TrustGraph services.
TrustGraph is a knowledge graph and RAG (Retrieval-Augmented Generation) platform that
combines graph databases, vector embeddings, and LLM capabilities.

The library offers both synchronous and asynchronous APIs for:
- Flow management and execution
- Knowledge graph operations (triples, entities, embeddings)
- RAG queries (graph-based and document-based)
- Agent interactions with streaming support
- WebSocket-based real-time communication
- Bulk import/export operations
- Configuration and collection management

Quick Start:
    ```python
    from trustgraph.api import Api

    # Create API client
    api = Api(url="http://localhost:8888/")

    # Get a flow instance
    flow = api.flow().id("default")

    # Execute a graph RAG query
    response = flow.graph_rag(
        query="What are the main topics?",
        collection="default"
    )
    ```

For streaming and async operations:
    ```python
    # WebSocket streaming
    socket = api.socket()
    flow = socket.flow("default")

    for chunk in flow.agent(question="Hello"):
        print(chunk.content)

    # Async operations
    async with Api(url="http://localhost:8888/") as api:
        async_flow = api.async_flow()
        result = await async_flow.id("default").text_completion(
            system="You are helpful",
            prompt="Hello"
        )
    ```
"""

# Core API
from .api import Api

# Flow clients
from .flow import Flow, FlowInstance
from .async_flow import AsyncFlow, AsyncFlowInstance

# WebSocket clients
from .socket_client import SocketClient, SocketFlowInstance, build_term
from .async_socket_client import AsyncSocketClient, AsyncSocketFlowInstance

# Bulk operation clients
from .bulk_client import BulkClient
from .async_bulk_client import AsyncBulkClient

# Metrics clients
from .metrics import Metrics
from .async_metrics import AsyncMetrics

# Explainability
from .explainability import (
    ExplainabilityClient,
    ExplainEntity,
    Question,
    Grounding,
    Exploration,
    Focus,
    Synthesis,
    Reflection,
    Analysis,
    Observation,
    Conclusion,
    Decomposition,
    Finding,
    Plan,
    StepResult,
    EdgeSelection,
    wire_triples_to_tuples,
    extract_term_value,
)

# Types
from .types import (
    Triple,
    Uri,
    Literal,
    ConfigKey,
    ConfigValue,
    DocumentMetadata,
    ProcessingMetadata,
    CollectionMetadata,
    StreamingChunk,
    AgentThought,
    AgentObservation,
    AgentAnswer,
    RAGChunk,
    TextCompletionResult,
    ImageToTextResult,
    ProvenanceEvent,
)

# Exceptions
from .exceptions import (
    ProtocolException,
    TrustGraphException,
    AgentError,
    ConfigError,
    DocumentRagError,
    FlowError,
    GatewayError,
    GraphRagError,
    LLMError,
    LoadError,
    LookupError,
    NLPQueryError,
    RowsQueryError,
    RequestError,
    StructuredQueryError,
    UnexpectedError,
    # Legacy alias
    ApplicationException,
)

__all__ = [
    # Core API
    "Api",

    # Flow clients
    "Flow",
    "FlowInstance",
    "AsyncFlow",
    "AsyncFlowInstance",

    # WebSocket clients
    "SocketClient",
    "SocketFlowInstance",
    "AsyncSocketClient",
    "AsyncSocketFlowInstance",
    "build_term",

    # Bulk operation clients
    "BulkClient",
    "AsyncBulkClient",

    # Metrics clients
    "Metrics",
    "AsyncMetrics",

    # Explainability
    "ExplainabilityClient",
    "ExplainEntity",
    "Question",
    "Exploration",
    "Focus",
    "Synthesis",
    "Analysis",
    "Observation",
    "Conclusion",
    "EdgeSelection",
    "wire_triples_to_tuples",
    "extract_term_value",

    # Types
    "Triple",
    "Uri",
    "Literal",
    "ConfigKey",
    "ConfigValue",
    "DocumentMetadata",
    "ProcessingMetadata",
    "CollectionMetadata",
    "StreamingChunk",
    "AgentThought",
    "AgentObservation",
    "AgentAnswer",
    "RAGChunk",
    "TextCompletionResult",
    "ImageToTextResult",
    "ProvenanceEvent",

    # Exceptions
    "ProtocolException",
    "TrustGraphException",
    "AgentError",
    "ConfigError",
    "DocumentRagError",
    "FlowError",
    "GatewayError",
    "GraphRagError",
    "LLMError",
    "LoadError",
    "LookupError",
    "NLPQueryError",
    "RowsQueryError",
    "RequestError",
    "StructuredQueryError",
    "UnexpectedError",
    "ApplicationException",  # Legacy alias
]


```

### Core Architecture Module: `trustgraph-base/trustgraph/api/api.py`
```
"""
TrustGraph API Client

Core API client for interacting with TrustGraph services via REST and WebSocket protocols.
"""

import requests
import json
import base64
import time
from typing import Optional

from . library import Library
from . flow import Flow
from . config import Config
from . knowledge import Knowledge
from . collection import Collection
from . exceptions import *
from . types import *

def check_error(response):

    if "error" in response:

        try:
            msg = response["error"]["message"]
            tp = response["error"]["type"]
        except KeyError:
            raise ApplicationException(response["error"])

        raise ApplicationException(f"{tp}: {msg}")

class Api:
    """
    Main TrustGraph API client for synchronous and asynchronous operations.

    This class provides access to all TrustGraph services including flow management,
    knowledge graph operations, document processing, RAG queries, and more. It supports
    both REST-based and WebSocket-based communication patterns.

    The client can be used as a context manager for automatic resource cleanup:
        ```python
        with Api(url="http://localhost:8888/") as api:
            result = api.flow().id("default").graph_rag(query="test")
        ```

    Attributes:
        url: Base URL for the TrustGraph API endpoint
        timeout: Request timeout in seconds
        token: Optional bearer token for authentication
    """

    def __init__(self, url="http://localhost:8888/", timeout=60, token: Optional[str] = None, workspace: str = "default"):
        """
        Initialize the TrustGraph API client.

        Args:
            url: Base URL for TrustGraph API (default: "http://localhost:8888/")
            timeout: Request timeout in seconds (default: 60)
            token: Optional bearer token for authentication

        Example:
            ```python
            # Local development
            api = Api()

            # Production with authentication
            api = Api(
                url="https://trustgraph.example.com/",
                timeout=120,
                token="your-api-token"
            )
            ```
        """

        self.url = url

        if not url.endswith("/"):
            self.url += "/"

        self.url += "api/v1/"

        self.timeout = timeout
        self.token = token
        self.workspace = workspace

        # Lazy initialization for new clients
        self._socket_client = None
        self._bulk_client = None
        self._async_flow = None
        self._async_socket_client = None
        self._async_bulk_client = None
        self._metrics = None
        self._async_metrics = None

    def flow(self):
        """
        Get a Flow client for managing and interacting with flows.

        Flows are the primary execution units in TrustGraph, providing access to
        services like agents, RAG queries, embeddings, and document processing.

        Returns:
            Flow: Flow management client

        Example:
            ```python
            flow_client = api.flow()

            # List available blueprints
            blueprints = flow_client.list_blueprints()

            # Get a specific flow instance
            flow_instance = flow_client.id("default")
            response = flow_instance.text_completion(
                system="You are helpful",
                prompt="Hello"
            )
            ```
        """
        return Flow(api=self)

    def config(self):
        """
        Get a Config client for managing configuration settings.

        Returns:
            Config: Configuration management client

        Example:
            ```python
            config = api.config()

            # Get configuration values
            values = config.get([ConfigKey(type="llm", key="model")])

            # Set configuration
            config.put([ConfigValue(type="llm", key="model", value="gpt-4")])
            ```
        """
        return Config(api=self, workspace=self.workspace)

    def knowledge(self):
        """
        Get a Knowledge client for managing knowledge graph cores.

        Returns:
            Knowledge: Knowledge graph management client

        Example:
            ```python
            knowledge = api.knowledge()

            # List available KG cores
            cores = knowledge.list_kg_cores()

            # Load a KG core
            knowledge.load_kg_core(id="core-123")
            ```
        """
        return Knowledge(api=self)

    def request(self, path, request):
        """
        Make a low-level REST API request.

        This method is primarily for internal use but can be used for direct
        API access when needed.

        Args:
            path: API endpoint path (relative to base URL)
            request: Request payload as a dictionary

        Returns:
            dict: Response object

        Raises:
            ProtocolException: If the response status is not 200 or response is not JSON
            ApplicationException: If the response contains an error

        Example:
            ```python
            response = api.request("flow", {
                "operation": "list-flows"
            })
            ```
        """

        url = f"{self.url}{path}"

        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        # Ensure every REST request carries the workspace so services can
        # scope their behaviour. Callers that already set workspace in the
        # payload (e.g. Library client) take precedence.
        if isinstance(request, dict) and "workspace" not in request:
            request = {**request, "workspace": self.workspace}

        # Invoke the API, input is passed as JSON
        resp = requests.post(url, json=request, timeout=self.timeout, headers=headers)

        # Should be a 200 status code
        if resp.status_code != 200:
            raise ProtocolException(f"Status code {resp.status_code}")

        try:
            # Parse the response as JSON
            object = resp.json()
        except ValueError:
            raise ProtocolException(f"Expected JSON response")

        check_error(object)

        return object

    def library(self):
        """
        Get a Library client for document management.

        The library provides document storage, metadata management, and
        processing workflow coordination.

        Returns:
            Library: Document library management client

        Example:
            ```python
            library = api.library()

            # Add a document
            library.add_document(
                document=b"Document content",
                id="doc-123",
                metadata=[],
                title="My Document",
                comments="Test document"
            )

            # List documents
            docs = library.get_documents()
            ```
        """
        return Library(self)

    def collection(self):
        """
        Get a Collection client for managing data collections.

        Collections organize documents and knowledge graph data into
        logical groupings for isolation and access control.

        Returns:
            Collection: Collection management client

        Example:
            ```python
            collection = api.collection()

            # List collections
            colls = collection.list_collections()

            # Update collection metadata
            collection.update_collection(
                collection="default",
                name="Default Collection",
                description="Main data collection"
            )
            ```
        """
        return Collection(self)

    # New synchronous methods
    def socket(self):
        """
        Get a synchronous WebSocket client for streaming operations.

        WebSocket connections provide streaming support for real-time responses
        from agents, RAG queries, and text co
```

### Core Architecture Module: `trustgraph-base/trustgraph/api/async_bulk_client.py`
```

import json
import websockets
from typing import Optional, AsyncIterator, Dict, Any, Iterator

from . types import Triple
from . bulk_client import _string_to_term


class AsyncBulkClient:
    """Asynchronous bulk operations client"""

    def __init__(self, url: str, timeout: int, token: Optional[str], workspace: str = "default") -> None:
        self.url: str = self._convert_to_ws_url(url)
        self.timeout: int = timeout
        self.token: Optional[str] = token
        self.workspace: str = workspace

    def _convert_to_ws_url(self, url: str) -> str:
        """Convert HTTP URL to WebSocket URL"""
        if url.startswith("http://"):
            return url.replace("http://", "ws://", 1)
        elif url.startswith("https://"):
            return url.replace("https://", "wss://", 1)
        elif url.startswith("ws://") or url.startswith("wss://"):
            return url
        else:
            return f"ws://{url}"

    def _build_ws_url(self, path: str) -> str:
        """Build a WebSocket URL with token and workspace query params."""
        ws_url = f"{self.url}{path}"
        params = []
        if self.token:
            params.append(f"token={self.token}")
        if self.workspace:
            params.append(f"workspace={self.workspace}")
        if params:
            ws_url = f"{ws_url}?{'&'.join(params)}"
        return ws_url

    async def import_triples(self, flow: str, triples: AsyncIterator[Triple], **kwargs: Any) -> None:
        """Bulk import triples via WebSocket"""
        ws_url = self._build_ws_url(f"/api/v1/flow/{flow}/import/triples")

        async with websockets.connect(ws_url, ping_interval=20, ping_timeout=self.timeout) as websocket:
            async for triple in triples:
                t = {
                    "s": _string_to_term(triple.s),
                    "p": _string_to_term(triple.p),
                    "o": _string_to_term(
                        triple.o,
                        datatype=triple.o_datatype,
                        language=triple.o_language,
                    ),
                }
                if triple.g:
                    t["g"] = triple.g
                await websocket.send(json.dumps(t))

    async def export_triples(self, flow: str, **kwargs: Any) -> AsyncIterator[Triple]:
        """Bulk export triples via WebSocket"""
        ws_url = self._build_ws_url(f"/api/v1/flow/{flow}/export/triples")

        async with websockets.connect(ws_url, ping_interval=20, ping_timeout=self.timeout) as websocket:
            async for raw_message in websocket:
                data = json.loads(raw_message)
                yield Triple(
                    s=data.get("s", ""),
                    p=data.get("p", ""),
                    o=data.get("o", ""),
                    g=data.get("g", ""),
                )

    async def import_graph_embeddings(self, flow: str, embeddings: AsyncIterator[Dict[str, Any]], **kwargs: Any) -> None:
        """Bulk import graph embeddings via WebSocket"""
        ws_url = self._build_ws_url(f"/api/v1/flow/{flow}/import/graph-embeddings")

        async with websockets.connect(ws_url, ping_interval=20, ping_timeout=self.timeout) as websocket:
            async for embedding in embeddings:
                await websocket.send(json.dumps(embedding))

    async def export_graph_embeddings(self, flow: str, **kwargs: Any) -> AsyncIterator[Dict[str, Any]]:
        """Bulk export graph embeddings via WebSocket"""
        ws_url = self._build_ws_url(f"/api/v1/flow/{flow}/export/graph-embeddings")

        async with websockets.connect(ws_url, ping_interval=20, ping_timeout=self.timeout) as websocket:
            async for raw_message in websocket:
                yield json.loads(raw_message)

    async def import_document_embeddings(self, flow: str, embeddings: AsyncIterator[Dict[str, Any]], **kwargs: Any) -> None:
        """Bulk import document embeddings via WebSocket"""
        ws_url = self._build_ws_url(f"/api/v1/flow/{flow}/import/document-embeddings")

        async with websockets.connect(ws_url, ping_interval=20, ping_timeout=self.timeout) as websocket:
            async for embedding in embeddings:
                await websocket.send(json.dumps(embedding))

    async def export_document_embeddings(self, flow: str, **kwargs: Any) -> AsyncIterator[Dict[str, Any]]:
        """Bulk export document embeddings via WebSocket"""
        ws_url = self._build_ws_url(f"/api/v1/flow/{flow}/export/document-embeddings")

        async with websockets.connect(ws_url, ping_interval=20, ping_timeout=self.timeout) as websocket:
            async for raw_message in websocket:
                yield json.loads(raw_message)

    async def import_entity_contexts(self, flow: str, contexts: AsyncIterator[Dict[str, Any]], **kwargs: Any) -> None:
        """Bulk import entity contexts via WebSocket"""
        ws_url = self._build_ws_url(f"/api/v1/flow/{flow}/import/entity-contexts")

        async with websockets.connect(ws_url, ping_interval=20, ping_timeout=self.timeout) as websocket:
            async for context in contexts:
                await websocket.send(json.dumps(context))

    async def export_entity_contexts(self, flow: str, **kwargs: Any) -> AsyncIterator[Dict[str, Any]]:
        """Bulk export entity contexts via WebSocket"""
        ws_url = self._build_ws_url(f"/api/v1/flow/{flow}/export/entity-contexts")

        async with websockets.connect(ws_url, ping_interval=20, ping_timeout=self.timeout) as websocket:
            async for raw_message in websocket:
                yield json.loads(raw_message)

    async def import_rows(
        self, flow: str, rows: AsyncIterator[Dict[str, Any]],
        batch_size: int = 40,
        **kwargs: Any,
    ) -> None:
        """Bulk import rows via WebSocket"""
        ws_url = self._build_ws_url(f"/api/v1/flow/{flow}/import/rows")

        async with websockets.connect(ws_url, ping_interval=20, ping_timeout=self.timeout) as websocket:
            batch = []
            template = None
            async for row in rows:
                if template is None:
                    template = row
                batch.append(row.get("values", row))
                if len(batch) >= batch_size:
                    message = dict(template)
                    message["values"] = batch
                    await websocket.send(json.dumps(message))
                    batch = []
            if batch:
                message = dict(template)
                message["values"] = batch
                await websocket.send(json.dumps(message))

    async def aclose(self) -> None:
        """Close connections"""
        # Cleanup handled by context managers
        pass

```

### Core Architecture Module: `trustgraph-base/trustgraph/api/async_flow.py`
```
"""
TrustGraph Asynchronous Flow Management

This module provides async/await based interfaces for managing and interacting
with TrustGraph flows using REST API calls. Unlike async_socket_client which
provides streaming support, this module is focused on non-streaming operations
that return complete responses.

For streaming support (e.g., real-time agent responses, streaming RAG), use
AsyncSocketClient instead.
"""

import aiohttp
import json
import base64
from typing import Optional, Dict, Any, List

from . types import TextCompletionResult, ImageToTextResult

from . exceptions import ProtocolException, ApplicationException


def check_error(response):
    if "error" in response:
        try:
            msg = response["error"]["message"]
            tp = response["error"]["type"]
        except KeyError:
            raise ApplicationException(response["error"])

        raise ApplicationException(f"{tp}: {msg}")


class AsyncFlow:
    """
    Asynchronous flow management client using REST API.

    Provides async/await based flow management operations including listing,
    starting, stopping flows, and managing flow class definitions. Also provides
    access to flow-scoped services like agents, RAG, and queries via non-streaming
    REST endpoints.

    Note: For streaming support, use AsyncSocketClient instead.
    """

    def __init__(self, url: str, timeout: int, token: Optional[str]) -> None:
        """
        Initialize async flow client.

        Args:
            url: Base URL for TrustGraph API
            timeout: Request timeout in seconds
            token: Optional bearer token for authentication
        """
        self.url: str = url
        self.timeout: int = timeout
        self.token: Optional[str] = token

    async def request(self, path: str, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Make async HTTP POST request to Gateway API.

        Internal method for making authenticated requests to the TrustGraph API.

        Args:
            path: API endpoint path (relative to base URL)
            request_data: Request payload dictionary

        Returns:
            dict: Response object from API

        Raises:
            ProtocolException: If HTTP status is not 200 or response is not valid JSON
            ApplicationException: If API returns an error response
        """
        url = f"{self.url}{path}"

        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        timeout = aiohttp.ClientTimeout(total=self.timeout)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, json=request_data, headers=headers) as resp:
                if resp.status != 200:
                    raise ProtocolException(f"Status code {resp.status}")

                try:
                    obj = await resp.json()
                except (ValueError, aiohttp.ContentTypeError):
                    raise ProtocolException(f"Expected JSON response")

                check_error(obj)
                return obj

    async def list(self) -> List[str]:
        """
        List all flow identifiers.

        Retrieves IDs of all flows currently deployed in the system.

        Returns:
            list[str]: List of flow identifiers

        Example:
            ```python
            async_flow = await api.async_flow()

            # List all flows
            flows = await async_flow.list()
            print(f"Available flows: {flows}")
            ```
        """
        result = await self.request("flow", {"operation": "list-flows"})
        return result.get("flow-ids", [])

    async def get(self, id: str) -> Dict[str, Any]:
        """
        Get flow definition.

        Retrieves the complete flow configuration including its class name,
        description, and parameters.

        Args:
            id: Flow identifier

        Returns:
            dict: Flow definition object

        Example:
            ```python
            async_flow = await api.async_flow()

            # Get flow definition
            flow_def = await async_flow.get("default")
            print(f"Flow class: {flow_def.get('class-name')}")
            print(f"Description: {flow_def.get('description')}")
            ```
        """
        result = await self.request("flow", {
            "operation": "get-flow",
            "flow-id": id
        })
        return json.loads(result.get("flow", "{}"))

    async def start(self, class_name: str, id: str, description: str, parameters: Optional[Dict] = None):
        """
        Start a new flow instance.

        Creates and starts a flow from a flow class definition with the specified
        parameters.

        Args:
            class_name: Flow class name to instantiate
            id: Identifier for the new flow instance
            description: Human-readable description of the flow
            parameters: Optional configuration parameters for the flow

        Example:
            ```python
            async_flow = await api.async_flow()

            # Start a flow from a class
            await async_flow.start(
                class_name="default",
                id="my-flow",
                description="Custom flow instance",
                parameters={"model": "claude-3-opus"}
            )
            ```
        """
        request_data = {
            "operation": "start-flow",
            "flow-id": id,
            "class-name": class_name,
            "description": description
        }
        if parameters:
            request_data["parameters"] = json.dumps(parameters)

        await self.request("flow", request_data)

    async def stop(self, id: str):
        """
        Stop a running flow.

        Stops and removes a flow instance, freeing its resources.

        Args:
            id: Flow identifier to stop

        Example:
            ```python
            async_flow = await api.async_flow()

            # Stop a flow
            await async_flow.stop("my-flow")
            ```
        """
        await self.request("flow", {
            "operation": "stop-flow",
            "flow-id": id
        })

    async def list_classes(self) -> List[str]:
        """
        List all flow class names.

        Retrieves names of all flow classes (blueprints) available in the system.

        Returns:
            list[str]: List of flow class names

        Example:
            ```python
            async_flow = await api.async_flow()

            # List available flow classes
            classes = await async_flow.list_classes()
            print(f"Available flow classes: {classes}")
            ```
        """
        result = await self.request("flow", {"operation": "list-classes"})
        return result.get("class-names", [])

    async def get_class(self, class_name: str) -> Dict[str, Any]:
        """
        Get flow class definition.

        Retrieves the blueprint definition for a flow class, including its
        configuration schema and service bindings.

        Args:
            class_name: Flow class name

        Returns:
            dict: Flow class definition object

        Example:
            ```python
            async_flow = await api.async_flow()

            # Get flow class definition
            class_def = await async_flow.get_class("default")
            print(f"Services: {class_def.get('services')}")
            ```
        """
        result = await self.request("flow", {
            "operation": "get-class",
            "class-name": class_name
        })
        return json.loads(result.get("class-definition", "{}"))

    async def put_class(self, class_name: str, definition: Dict[str, Any]):
        """
        Create or update a flow class definition.

        Stores a flow class blueprint that can be used to instantiate flows.

        Args:
            class_name: Flow class name
            defini
```

### Core Architecture Module: `trustgraph-base/trustgraph/api/async_metrics.py`
```

import aiohttp
from typing import Optional, Dict


class AsyncMetrics:
    """Asynchronous metrics client"""

    def __init__(self, url: str, timeout: int, token: Optional[str]) -> None:
        self.url: str = url
        self.timeout: int = timeout
        self.token: Optional[str] = token

    async def get(self) -> str:
        """Get Prometheus metrics as text"""
        url: str = f"{self.url}/api/metrics"

        headers: Dict[str, str] = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        timeout = aiohttp.ClientTimeout(total=self.timeout)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url, headers=headers) as resp:
                if resp.status != 200:
                    raise Exception(f"Status code {resp.status}")

                return await resp.text()

    async def aclose(self) -> None:
        """Close connections"""
        pass

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #949** (2026-06-09): **Crash in `document-decoder`**
  *Symptoms*: 2.4.29. Suddenly started appearing on a standard test doc?  ``` 2026-05-26 11:23:58,061 - document-decoder - ERROR - Message processing exception: module 'matplotlib.ft2font' has no attribute '__path__' Traceback (most recent call last):   File "/usr/local/lib/python3.13/site-packages/trustgraph/base/consumer.py", line 239, in handle_one_from_queue     await self.handler(msg, self, self.flow)   File "/usr/local/lib/python3.13/site-packages/trustgraph/decoding/universal/processor.py", line 421, in on_message     elements = self.extract_elements(blob, mime_type)   File "/usr/local/lib/python3.13/site-packages/trustgraph/decoding/universal/processor.py", line 200, in extract_elements     elements = partition(**kwargs)   File "/usr/local/lib/python3.13/site-packages/unstructured/partition/auto.py", line 215, in partition     partition_pdf = partitioner_loader.get(file_type)   File "/usr/local/lib/python3.13/site-packages/unstructured/partition/auto.py", line 371, in get     self._partitioners[file_type] = self._load_partitioner(file_type)                                     ~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^   File "/usr/local/lib/python3.13/site-packages/unstructured/partition/auto.py", line 389, in _load_partitioner     partitioner_module = importlib.import_module(file_type.partitioner_module_qname)   File "/usr/lib64/python3.13/importlib/__init__.py", line 88, in import_module     return _bootstrap._gcd_import(name[level:], package, level)            ~~~~~~~~~~~~~~~~~~~~~~^^^^^
  **Post-Mortem & Fix Analysis**:
  > Turns out the cause was an HTML doc fed in as a PDF doc. The test data doc was removed and so URL just returns an HTML error page
  > Maybe the real problem is that some validation should have taken place.
  > Opened PR #977 to handle this: https://github.com/trustgraph-ai/trustgraph/pull/977  The patch validates decoded PDF bytes before invoking the PDF loader, so HTML error pages or other non-PDF content are ignored without emitting page documents. Added unit coverage for librarian-backed content that is labeled as a PDF but contains HTML.

- **Issue #902** (2026-05-18): **fix: guard against empty query in SPARQL generator (#870)**
  *Symptoms*: Fixes #870.  Guard `query.split()[0]` so a future refactor that loosens or removes the `startswith` check cannot turn an empty/whitespace response into an unhandled IndexError. The new condition uses the already-split list, so the public behavior on valid queries is unchanged.
  **Post-Mortem & Fix Analysis**:
  > ## Contributor License Agreement  Thank you for your contribution! Before we can accept it, the following contributor(s) must sign our CLA:  **@SAY-5**  Please read the appropriate agreement: - Contributing as an **individual**? Read the [Individual CLA](https://github.com/trustgraph-ai/contributor-license-agreement/blob/main/Fiduciary-Contributor-License-Agreement.md) - Contributing on behalf of a **company or organisation**? Read the [Entity CLA](https://github.com/trustgraph-ai/contributor-license-agreement/blob/main/Entity-Fiduciary-Contributor-License-Agreement.md)  Once you have read the appropriate agreement, **post the following as a comment on this PR** (copy and paste exactly):  ``` I have read the CLA Document and I hereby sign the CLA ```  The bot will record your signature and update this PR automatically.
  > @SAY-5 can you please take a look at the Contributor License Agreement notice above?
  > Apologies for the delay. I'm not able to sign the CLA at this time, so feel free to close this if that's a blocker. The fix itself is small and the diff stands on its own if a maintainer wants to pick it up.

- **Issue #901** (2026-05-22): **text-completion worker treats OpenAI insufficient_quota as retryable (should fail fast)**
  *Symptoms*: **Version:** trustgraph-flow 2.3.21 **File:** `trustgraph/model/text_completion/openai/llm.py`  ## Repro  1. Use an OpenAI key whose account is out of credit (`insufficient_quota`). 2. Issue any TG call that goes through `text-completion-rag` (e.g. `tg-invoke-document-rag ...`).  ## Observed  ``` 2026-05-11 18:55:17,188 - text-completion-rag - HTTP/1.1 429 Too Many Requests 2026-05-11 18:55:17,789 - text-completion-rag - HTTP/1.1 429 Too Many Requests 2026-05-11 18:55:18,772 - text-completion-rag - HTTP/1.1 429 Too Many Requests ... 15 retries in 60s ```  15× retries with exponential backoff = ~20s of wall-clock latency before giving up. The user sees "TG is slow" rather than a clear billing error.  ## Root cause  The 429 retry path treats all 429 responses identically. The OpenAI response body distinguishes:  - `code: rate_limit_exceeded` — transient, retry-with-backoff is correct - `code: insufficient_quota` — billing exhausted, retry is futile - `code: invalid_api_key` / `account_deactivated` — terminal, retry is futile  ## Suggested fix  Parse the 429 body, branch on `error.code`:  ```python if response.status_code == 429:     try:         body = response.json()         code = body.get('error', {}).get('code')         if code in ('insufficient_quota', 'invalid_api_key', 'account_deactivated'):             raise PermanentError(f"OpenAI: {code} - {body['error']['message']}")     except (ValueError, KeyError):         pass     # otherwise: existing retry-with-backoff ```  I 
  **Post-Mortem & Fix Analysis**:
  > ## Root cause + proposed patch  `openai.RateLimitError` is a single class for **two semantically different conditions**:  | `e.body["error"]["code"]` | Meaning | Right action | |---|---|---| | `rate_limit_exceeded` | TPM/RPM ceiling hit | retry with backoff | | `insufficient_quota` | account out of credits / wrong project / hard cap | **fail fast** |  Current code in `trustgraph/model/text_completion/openai/llm.py:108-110`:  ```python except RateLimitError:     # Leave rate limit retries to the base handler     raise TooManyRequests() ```  Both raise `TooManyRequests`, which `base/consumer.py` retries forever with exponential backoff. On an exhausted account this melts a worker into an infinite retry loop and looks externally identical to "LLM slow" — which is what initially put me down the wrong rabbit hole for our graph-rag stall.  ### Proposed patch  Discriminate on `e.body`:  ```python # trustgraph/model/text_completion/openai/llm.py except RateLimitError as e:     # OpenAI uses Ra
  > #904 merged, this is closed.

- **Issue #900** (2026-07-07): **prompt-rag JSONL parser fails on Claude/non-OpenAI providers (document-rag times out)**
  *Symptoms*: **Version:** trustgraph-flow 2.3.21 (Docker image `docker.io/trustgraph/trustgraph-flow:2.3.21`)  ## Repro  1. Configure `text-completion` + `text-completion-rag` processors with `trustgraph.model.text_completion.claude.Processor` instead of `openai.Processor`. 2. Set `CLAUDE_KEY` env, restart workers, restart flow with `--param llm-model=claude-haiku-4-5-20251001 --param llm-rag-model=claude-haiku-4-5-20251001`. 3. Verify bare LLM works:    ```    tg-invoke-llm -f sizzl-ontology "" "Say PONG"    # -> "PONG" in ~2s, HTTP 200 from api.anthropic.com    ``` 4. Try `tg-invoke-document-rag`:    ```    tg-invoke-document-rag -u http://api-gateway:8088/ -f sizzl-ontology -C sizzl-market -d 2 -q "What does X sell?"    # -> Exception (empty body) at ~33s    ```  ## Observed logs (`docker logs deploy-rag-1`)  ``` prompt-rag - WARNING - JSONL parse error on line 1: Expecting value: line 1 column 1 (char 0) prompt-rag - WARNING - JSONL parse error on line 3: Expecting value: line 1 column 1 (char 0) prompt-rag - WARNING - JSONL parse error on line 5: Expecting value: line 1 column 1 (char 0) prompt-rag - WARNING - JSONL parse returned no valid objects ... (repeats)  document-rag - ERROR - Exception processing response: asyncio.exceptions.CancelledError ... TimeoutError ```  text-completion-rag DID get HTTP 200 from Anthropic with token counts logged. The response is plain prose. prompt-rag's parser expects JSONL, gets nothing parseable, returns empty, document-rag times out at 30s.  ## R
  **Post-Mortem & Fix Analysis**:
  > ## Root cause + proposed patch  Reproduced live in TG 2.3.21 against Claude (`claude-3-5-sonnet-20241022`) on flow `sizzl-everything`. `prompt-rag` (document-rag step) hangs ~60s then times out. Log shows the LLM responded fine — parser drops everything.  The bug is in `trustgraph/template/prompt_manager.py::parse_jsonl()`. It splits on `\n` and `json.loads()` each line. That only works for true JSONL (one object per line). Claude — and any model not specifically prompted with "respond as JSONL" — returns a JSON **array** instead:  ``` [   {"question": "..."},   {"question": "..."} ] ```  Every line is invalid JSON in isolation (`[`, `{...},`, `]`), each `json.loads` raises, and the warning loop swallows them silently. The function returns `[]`. Downstream `document-rag` gets an empty question list and the chain stalls.  ### Proposed patch  Add a JSON-array fallback before the line-by-line loop. Keep JSONL behavior as the second-chance path so existing OpenAI-tuned prompts don't regres
  > @beca-oc  thanks for the detailed report.  I can't reproduce this at the moment.  I've tested with claude-haiku-4-5-20251001.  You reported that the issue occurs when using `tg-invoke-document-rag`, which uses two prompts, `extract-concepts` following by `document-synthesis`.  In default configuration, neither of these prompts uses JSONL output.  Perhaps you could check the prompts you are using, did they get re-configured to use JSONL, output?  Both should be `text`.  ``` document-prompt: +----------+-----------------------------------------------------------------------+ | prompt   | Study the following context. Use only the information provided in the | |          | context in your response. Do not speculate if the answer is not found | |          | in the provided set of knowledge statements.                          | |          | Here is the context:                                                  | |          | {{documents}}                                                      
  > Using the `document-synthesis` prompt with Claude 4.5 Haiku...  <img width="1669" height="1198" alt="Image" src="https://github.com/user-attachments/assets/ef004988-7330-4ad0-b067-49446c55acc6" />

- **Issue #894** (2026-05-18): **api-gateway --timeout flag silently ignored by all per-service dispatchers (manager.py:239, 396)**
  *Symptoms*: **Repo:** `trustgraph-ai/trustgraph` **Suggested title:** `api-gateway --timeout flag silently ignored by all per-service dispatchers (manager.py:239, 396)` **Suggested labels:** `bug`, `good first issue`, `gateway`  ---  ## Summary  The `api-gateway` accepts a `--timeout` flag (default `600`, [`gateway/service.py:36`](https://github.com/trustgraph-ai/trustgraph/blob/main/trustgraph-flow/trustgraph/gateway/service.py#L36)) and stores it on `Service.timeout`. The flag is documented as *"API request timeout in seconds"*, and the value is wired correctly into the WebSocket endpoint manager.  However, the value is **not** propagated into `DispatcherManager`, which constructs every per-service dispatcher (graph-rag, document-rag, text-completion, embeddings, librarian, …) with a **hardcoded `timeout = 120`**. So `--timeout 600` (or any other value) has no effect on actual request paths.  The practical effect: any synchronous request that takes more than two minutes returns `{"error": {"type": "gateway-error", "message": "Timeout"}}` exactly at the 120 s mark, regardless of the gateway flag. This is easy to hit on graph-rag with default parameters (`entity_limit=50, max_path_length=2`) on a single-node Cassandra triples-store, which fans out to ~300 SPARQL streaming queries.  ## Reproduction  Stack: `trustgraph/trustgraph-flow:2.3.21`, default docker-compose deploy with `--timeout 600` on `api-gateway`.  ```bash # A request whose server-side processing takes ~150 s time curl -sS -X

- **Issue #873** (2026-05-26): **Unsafe string split when parsing Prometheus metric labels in ontology monitoring**
  *Symptoms*: ## Description  In `trustgraph-flow/trustgraph/query/ontology/monitoring.py` (line 478):  ```python cache_type = metric_name.split('cache_type=')[1].split(',')[0].split('}')[0] ```  ## Problem  If a metric name in the counters dict doesn't contain the substring \`cache_type=\`, the \`split()\` returns a single-element list and \`[1]\` raises \`IndexError\`.  The guard on line 477 (\`if 'cache_type=' in metric_name\`) currently prevents this, but the parsing itself is fragile — any refactoring that moves or removes the guard exposes the crash.  The chained-split approach is also hard to read.  ## Suggested fix  Please PR against the latest `release/vX.Y` branch.  Use a small helper or regex to extract label values safely:  ```python def _extract_label(metric_name, label):     """Extract a Prometheus-style label value from a metric name, or None."""     prefix = f'{label}="'     if prefix not in metric_name:         return None     return metric_name.split(prefix)[1].split('"')[0] ```  Or keep inline but add a guard:  ```python parts = metric_name.split('cache_type=') if len(parts) < 2:     continue cache_type = parts[1].split(',')[0].split('}')[0] ```  ## What you'll learn  How TrustGraph's ontology query engine collects and reports internal performance metrics, and safe patterns for parsing structured strings.
  **Post-Mortem & Fix Analysis**:
  > I can take this.  I’ll replace the chained split with a safe label extractor and add coverage for metrics with and without `cache_type`.
  > Fixed by #948 

- **Issue #871** (2026-05-08): **Publisher not cleaned up on error in librarian submit_document**
  *Symptoms*: ## Description  In `trustgraph-flow/trustgraph/librarian/service.py` (lines 449–460):  ```python pub = Publisher(     self.pubsub, q, schema=schema )  await pub.start()  # FIXME: Time wait kludge? await asyncio.sleep(1)  await pub.send(None, doc)  await pub.stop() ```  ## Problem  If `pub.send()` raises an exception, `pub.stop()` is never called and the publisher (and its underlying connection) leaks.  Other code in the same file already handles this correctly — see lines 374–394 which use `try / finally` around the same pattern.  There is also a `FIXME` comment on the `asyncio.sleep(1)` that should be investigated.  ## Suggested fix  Please PR against the latest `release/vX.Y` branch.  Wrap in try/finally, matching the existing pattern at line 378:  ```python pub = Publisher(self.pubsub, q, schema=schema) try:     await pub.start()     await pub.send(None, doc) finally:     await pub.stop() ```  Also investigate whether the `asyncio.sleep(1)` is still necessary and either remove it or document why it's needed.  ## What you'll learn  How the librarian service submits documents to processing queues, async resource management patterns in Python, and how to spot inconsistencies by reading surrounding code.

- **Issue #870** (2026-05-19): **IndexError on empty query string in SPARQL generator**
  *Symptoms*: ## Description  In `trustgraph-flow/trustgraph/query/ontology/sparql_generator.py` (line 209):  ```python query_type=query.split()[0].upper(), ```  ## Problem  If the LLM returns an empty or whitespace-only string that passes the `startswith` check on line 205 (it won't in practice, but the guard is incomplete), `query.split()` returns an empty list and `[0]` raises `IndexError`.  More realistically, if the code is refactored and the `startswith` guard on line 205 is changed or removed, this line becomes an unguarded crash point.  ## Suggested fix  Please PR against the latest `release/vX.Y` branch.  Add a guard before indexing:  ```python parts = query.split() if not parts:     # handle empty query — skip or use a default     ... query_type = parts[0].upper() ```  ## What you'll learn  How TrustGraph's SPARQL generation pipeline processes LLM output, and defensive coding practices for parsing untrusted text.

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

### Incident Patch 1: `dd96de4d` (2026-09-30)
**Commit Message**: Fix Discord badge link in README.md (#1146)

**File**: `README.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 
 [![Docker Pulls](https://github.com/trustgraph-ai/badges/blob/master/docker-pulls.svg)](https://hub.docker.com/u/trustgraph) [![PyPI version](https://img.shields.io/pypi/v/trustgraph.svg)](https://pypi.org/project/trustgraph/) ![License](https://img.shields.io/badge/license-Apache%202.0-blue) ![E2E Tests](https://github.com/trustgraph-ai/trustgraph/actions/workflows/release.yaml/badge.svg)
 [![Discord](https://img.shields.io/discord/1251652173201149994
-)](https://discord.gg/kT5dAsaj8v) [![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/trustgraph-ai/trustgraph)
+)](https://discord.gg/kT5dAsaj8v)
 
 [**Playground**](https://docs.google.com/forms/d/e/1FAIpQLSeTnF22ZjUP20FWV--VvS5606x-5cOvnKty6AqcPdtlnPuqbQ/viewform) | [**Self-Host**](https://config-ui.demo.trustgraph.ai/) | [**Docs**](https://docs.trustgraph.ai) | [**YouTube**](https://www.youtube.com/@TrustGraphAI?sub_confirmation=1) | [**Discord**](https://discord.gg/sQMwkRz5GX) | [**Website**](https://trustgraph.ai) 
 
```

---

### Incident Patch 2: `181223e8` (2026-09-22)
**Commit Message**: fix: parse ontology definitions without eval (#1128)

**File**: `trustgraph-flow/trustgraph/extract/kg/ontology/ontology_selector.py` (modified, +11/-4)
```diff
@@ -3,6 +3,7 @@
 Selects relevant ontology subsets based on text similarity.
 """
 
+import ast
 import logging
 from typing import List, Dict, Any, Set, Optional, Tuple
 from dataclasses import dataclass
@@ -186,11 +187,17 @@ def _build_ontology_subsets(self, relevant_elements: Set[Tuple[str, str, str, Di
         for ont_id, elem_type, elem_id, definition in relevant_elements:
             # Parse definition back from string if needed
             if isinstance(definition, str):
-                import json
+                # These strings come from str(dict) above, which is a Python
+                # repr and not JSON. Swapping quotes breaks on any value
+                # containing an apostrophe, and the old fallback ran eval on
+                # metadata that arrives from the vector store.
                 try:
-                    definition = json.loads(definition.replace("'", '"'))
-                except:
-                    definition = eval(definition)  # Fallback for dict-like strings
+                    definition = ast.literal_eval(definition)
+                except (ValueError, SyntaxError):
+                    logger.warning(
+                        f"Could not parse definition for {ont_id}/{elem_id}, skipping"
+                    )
+                    continue
 
             # Get the actual ontology and element
             ontology = self.loader.get_ontology(ont_id)
```

---

### Incident Patch 3: `9215897a` (2026-09-20)
**Commit Message**: fix(api): send graph URI as plain string in bulk triple import (#1127)

_string_to_term() was converting the graph URI into a Term dict
(e.g. {"t": "i", "i": "urn:graph:source"}) but Triple.g is str,
not Term. The deserializer passed the dict through to Cassandra
which failed with 'dict' object has no attribute 'encode'.

**File**: `trustgraph-base/trustgraph/api/async_bulk_client.py` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@ async def import_triples(self, flow: str, triples: AsyncIterator[Triple], **kwar
                     ),
                 }
                 if triple.g:
-                    t["g"] = _string_to_term(triple.g)
+                    t["g"] = triple.g
                 await websocket.send(json.dumps(t))
 
     async def export_triples(self, flow: str, **kwargs: Any) -> AsyncIterator[Triple]:
```

**File**: `trustgraph-base/trustgraph/api/bulk_client.py` (modified, +1/-1)
```diff
@@ -154,7 +154,7 @@ async def _import_triples_async(
                     ),
                 }
                 if triple.g:
-                    t["g"] = _string_to_term(triple.g)
+                    t["g"] = triple.g
                 batch.append(t)
                 if len(batch) >= batch_size:
                     message = {
```

---

### Incident Patch 4: `5755c6f9` (2026-09-20)
**Commit Message**: fix(sparql): check bool before int/float in BIND evaluation (#1126)

Python bool is a subclass of int, so the (int, float) branch was
catching booleans first, producing untyped literals like "True" instead
of xsd:boolean "true". This caused FILTER on bound boolean variables
to always evaluate to true since _effective_boolean treats non-empty
untyped strings as truthy.

**File**: `trustgraph-flow/trustgraph/query/sparql/algebra.py` (modified, +4/-4)
```diff
@@ -461,15 +461,15 @@ def exists_cb(graph_node, sol):
         new_sol = dict(sol)
         if isinstance(val, Term):
             new_sol[var_name] = val
-        elif isinstance(val, (int, float)):
-            new_sol[var_name] = Term(type=LITERAL, value=str(val))
-        elif isinstance(val, str):
-            new_sol[var_name] = Term(type=LITERAL, value=val)
         elif isinstance(val, bool):
             new_sol[var_name] = Term(
                 type=LITERAL, value=str(val).lower(),
                 datatype="http://www.w3.org/2001/XMLSchema#boolean"
             )
+        elif isinstance(val, (int, float)):
+            new_sol[var_name] = Term(type=LITERAL, value=str(val))
+        elif isinstance(val, str):
+            new_sol[var_name] = Term(type=LITERAL, value=val)
         elif val is not None:
             new_sol[var_name] = Term(type=LITERAL, value=str(val))
         yield new_sol
```

---

### Incident Patch 5: `bb3632ec` (2026-09-16)
**Commit Message**: fix(test): update pdf decoder tests for pypdf migration (#1124)

Replace PyPDFLoader mocks with PdfReader mocks to match the langchain
removal in trustgraph-flow. Tests now mock pypdf.PdfReader with .pages
and .extract_text() instead of langchain's .load() and .page_content.

**File**: `tests/unit/test_decoding/test_pdf_decoder.py` (modified, +25/-22)
```diff
@@ -40,20 +40,22 @@ async def test_processor_initialization(self):
         assert consumer_specs[0].name == "input"
         assert consumer_specs[0].schema == Document
 
-    @patch('trustgraph.decoding.pdf.pdf_decoder.PyPDFLoader')
+    @patch('trustgraph.decoding.pdf.pdf_decoder.PdfReader')
     @patch('trustgraph.base.async_processor.AsyncProcessor', MockAsyncProcessor)
-    async def test_on_message_success(self, mock_pdf_loader_class):
+    async def test_on_message_success(self, mock_pdf_reader_class):
         """Test successful PDF processing"""
         # Mock PDF content
         pdf_content = b"%PDF-1.7\nfake pdf content"
         pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
 
-        # Mock PyPDFLoader
-        mock_loader = MagicMock()
-        mock_page1 = MagicMock(page_content="Page 1 content")
-        mock_page2 = MagicMock(page_content="Page 2 content")
-        mock_loader.load.return_value = [mock_page1, mock_page2]
-        mock_pdf_loader_class.return_value = mock_loader
+        # Mock PdfReader
+        mock_reader = MagicMock()
+        mock_page1 = MagicMock()
+        mock_page1.extract_text.return_value = "Page 1 content"
+        mock_page2 = MagicMock()
+        mock_page2.extract_text.return_value = "Page 2 content"
+        mock_reader.pages = [mock_page1, mock_page2]
+        mock_pdf_reader_class.return_value = mock_reader
 
         # Mock message
         mock_metadata = Metadata(id="test-doc")
@@ -84,9 +86,9 @@ async def test_on_message_success(self, mock_pdf_loader_class):
         # Verify triples were sent for each page (provenance)
         assert mock_triples_flow.send.call_count == 2
 
-    @patch('trustgraph.decoding.pdf.pdf_decoder.PyPDFLoader')
+    @patch('trustgraph.decoding.pdf.pdf_decoder.PdfReader')
     @patch('trustgraph.base.async_processor.AsyncProcessor', MockAsyncProcessor)
-    async def test_on_message_rejects_librarian_content_that_is_not_pdf(self, mock_pdf_loader_class):
+    async def test_on_message_rejects_librarian_content_that_is_not_pdf(self, mock_pdf_reader_class):
         """Test rejecting non-PDF content before invoking the PDF loader"""
         html_content = b"<html><body>Not found</body></html>"
         html_base64 = base64.b64encode(html_content)
@@ -119,21 +121,21 @@ async def test_on_message_rejects_librarian_content_that_is_not_pdf(self, mock_p
 
         await processor.on_message(mock_msg, None, mock_flow)
 
-        mock_pdf_loader_class.assert_not_called()
+        mock_pdf_reader_class.assert_not_called()
         mock_output_flow.send.assert_not_called()
         mock_triples_flow.send.assert_not_called()
         mock_flow.librarian.save_child_document.assert_not_called()
 
-    @patch('trustgraph.decoding.pdf.pdf_decoder.PyPDFLoader')
+    @patch('trustgraph.decoding.pdf.pdf_decoder.PdfReader')
     @patch('trustgraph.base.async_processor.AsyncProcessor', MockAsyncProcessor)
-    async def test_on_message_empty_pdf(self, mock_pdf_loader_class):
+    async def test_on_message_empty_pdf(self, mock_pdf_reader_class):
         """Test handling of empty PDF"""
         pdf_content = b"%PDF-1.7\nfake pdf content"
         pdf_base64 = base64.b64encode(pdf_content).decode('utf-8')
 
-        mock_loader = MagicMock()
-        mock_loader.load.return_value = []
-        mock_pdf_loader_class.return_value = mock_loader
+        mock_reader = MagicMock()
+        mock_reader.pages = []
+        mock_pdf_reader_class.return_value = mock_reader
 
         mock_metadata = Metadata(id="test-doc")
         mock_document = Document(metadata=mock_metadata, data=pdf_base64)
@@ -154,17 +156,18 @@ async def test_on_message_empty_pdf(self, mock_pdf_loader_class):
 
         mock_output_flow.send.assert_not_called()
 
-    @patch('trustgraph.decoding.pdf.pdf_decoder.PyPDFLoader')
+    @patch('trustgraph.decoding.pdf.pdf_decoder.PdfReader')
     @patch('trustgraph.base.async_processor.AsyncProcessor', MockAsyncProcessor)
-    async def test_on_m
```

---

### Incident Patch 6: `5348d9f3` (2026-09-16)
**Commit Message**: fix(ci): widen top-level permissions so reusable workflow inherits them (#1121)

Reusable workflow jobs inherit permissions from the caller. The
top-level permissions were contents:read which blocked the nested
jobs from requesting contents:write + id-token:write.

**File**: `.github/workflows/build-container.yaml` (modified, +0/-6)
```diff
@@ -19,9 +19,6 @@ jobs:
   build-platform:
 
     name: Build ${{ inputs.container }} (${{ matrix.platform }})
-    permissions:
-      contents: write
-      id-token: write
     environment:
       name: release
     strategy:
@@ -66,9 +63,6 @@ jobs:
     name: Combine manifest ${{ inputs.container }}
     runs-on: ubuntu-24.04
     needs: build-platform
-    permissions:
-      contents: write
-      id-token: write
     environment:
       name: release
 
```

**File**: `.github/workflows/release.yaml` (modified, +2/-1)
```diff
@@ -8,7 +8,8 @@ on:
       - v*
 
 permissions:
-  contents: read
+  contents: write
+  id-token: write
 
 jobs:
 
```

---

### Incident Patch 7: `a6c2b022` (2026-09-16)
**Commit Message**: fix(test): remove MCP SDK internal assertions from transport compat test (#1118)

The follow_redirects and timeout assertions tested MCP SDK internals
rather than TrustGraph behaviour. A newer MCP SDK release stopped
passing follow_redirects as a constructor kwarg, breaking CI.

**File**: `tests/unit/test_agent/test_mcp_tool_transport_compat.py` (modified, +0/-2)
```diff
@@ -122,8 +122,6 @@ def create_in_process_client(*args, **kwargs):
         isinstance(result, str) and "hello" in result
     )
     assert len(client_options) == 1
-    assert client_options[0]["follow_redirects"] is True
-    assert isinstance(client_options[0]["timeout"], http_module.Timeout)
     assert captured_app.requests
 
     for headers in captured_app.requests:
```

---

### Incident Patch 8: `952d5259` (2026-09-16)
**Commit Message**: fix(cli): catch the real exceptions in the doc-embeds tools (#1115)

**File**: `tests/unit/test_cli/test_doc_embeds_errors.py` (added, +301/-0)
```diff
@@ -0,0 +1,301 @@
+"""
+Unit tests for error handling in the doc-embeds CLI tools.
+
+Both modules run their argument parser at import time, so they cannot be
+imported directly.  _load_module() executes everything up to that point and
+hands back the module namespace.
+"""
+
+import ast
+import asyncio
+import io
+import types
+from pathlib import Path
+
+import msgpack
+import pytest
+
+CLI = Path(__file__).parents[3] / "trustgraph-cli" / "trustgraph" / "cli"
+
+
+def _load_module(name):
+    """Execute a doc-embeds CLI module without its top-level entry point."""
+    source = (CLI / f"{name}.py").read_text()
+    tree = ast.parse(source)
+    body = [
+        node for node in tree.body
+        if isinstance(node, (ast.Import, ast.ImportFrom, ast.ClassDef,
+                             ast.FunctionDef, ast.AsyncFunctionDef, ast.Assign))
+    ]
+    module = types.ModuleType(name)
+    exec(compile(ast.Module(body=body, type_ignores=[]), name, "exec"),
+         module.__dict__)
+    return module
+
+
+@pytest.fixture
+def load_de_mod():
+    return _load_module("load_doc_embeds")
+
+
+@pytest.fixture
+def save_de_mod():
+    return _load_module("save_doc_embeds")
+
+
+def _core(tmp_path, messages):
+    path = tmp_path / "core.msgpack"
+    with open(path, "wb") as f:
+        for msg in messages:
+            f.write(msgpack.packb(msg, use_bin_type=True))
+    return path
+
+
+def _entry(doc_id="doc-1"):
+    return ["de", {"m": {"i": doc_id, "m": [], "c": "default"},
+                   "c": [{"c": "chunk", "v": [[0.1, 0.2]]}]}]
+
+
+class TestLoader:
+    """loader() reads the core file and feeds the queue."""
+
+    async def test_corrupt_message_is_reported(self, load_de_mod, tmp_path):
+        """A body that is not valid msgpack must not look like end of file."""
+        path = tmp_path / "core.msgpack"
+        path.write_bytes(msgpack.packb(_entry()) + b"\xc1\xc1\xc1")
+
+        running = load_de_mod.Running()
+        queue = asyncio.Queue(maxsize=10)
+
+        with pytest.raises(Exception) as excinfo:
+            await load_de_mod.loader(running, queue, str(path), "msgpack", None)
+
+        assert not isinstance(excinfo.value, msgpack.exceptions.OutOfData)
+
+    async def test_end_of_stream_stops_the_loader(self, load_de_mod, tmp_path):
+        """Regression guard: passes with and without the fix."""
+        path = _core(tmp_path, [_entry("a"), _entry("b")])
+
+        running = load_de_mod.Running()
+        queue = asyncio.Queue(maxsize=10)
+
+        await asyncio.wait_for(
+            load_de_mod.loader(running, queue, str(path), "msgpack", None), 5
+        )
+
+        assert queue.qsize() == 3
+        assert queue.get_nowait()["m"]["i"] == "a"
+        assert queue.get_nowait()["m"]["i"] == "b"
+        assert queue.get_nowait() is None
+
+    async def test_a_full_queue_does_not_lose_messages(self, load_de_mod,
+                                                       tmp_path):
+        """Regression guard: the put retry loop still waits for room."""
+        path = _core(tmp_path, [_entry("a")])
+
+        running = load_de_mod.Running()
+        queue = asyncio.Queue(maxsize=1)
+        filler = object()
+        queue.put_nowait(filler)
+        drained = []
+
+        async def consumer():
+            await asyncio.sleep(1.2)
+            while True:
+                item = await queue.get()
+                drained.append(item)
+                if item is None:
+                    return
+
+        await asyncio.wait_for(
+            asyncio.gather(
+                load_de_mod.loader(running, queue, str(path), "msgpack", None),
+                consumer(),
+            ),
+            10,
+        )
+
+        assert drained[0] is filler
+        assert drained[1]["m"]["i"] == "a"
+        assert drained[2] is None
+
+    async def test_a_put_failure_is_not_retried_forever(self, load_de_mod,
+                                                        tmp_path, monkeypatch):
+        """An
```

**File**: `trustgraph-cli/trustgraph/cli/load_doc_embeds.py` (modified, +5/-10)
```diff
@@ -37,9 +37,7 @@ async def load_de(running, queue, url):
                     if msg is None:
                         break
 
-                except:
-                    # Hopefully it's TimeoutError.  Annoying to match since
-                    # it changed in 3.11.
+                except asyncio.TimeoutError:
                     continue
 
                 msg = {
@@ -92,7 +90,8 @@ async def loader(running, de_queue, path, format, collection):
 
                 try:
                     unpacked = unpacker.unpack()
-                except:
+                except msgpack.exceptions.OutOfData:
+                    # No more complete messages in the file.
                     break
 
                 if collection:
@@ -109,9 +108,7 @@ async def loader(running, de_queue, path, format, collection):
                         # Successful put message, move on
                         break
 
-                    except:
-                        # Hopefully it's TimeoutError.  Annoying to match since
-                        # it changed in 3.11.
+                    except asyncio.TimeoutError:
                         continue
 
                 if not running.get(): break
@@ -125,9 +122,7 @@ async def loader(running, de_queue, path, format, collection):
                 # Successful put message, move on
                 break
 
-            except:
-                # Hopefully it's TimeoutError.  Annoying to match since
-                # it changed in 3.11.
+            except asyncio.TimeoutError:
                 continue
 
 async def run(running, **args):
```

**File**: `trustgraph-cli/trustgraph/cli/save_doc_embeds.py` (modified, +2/-4)
```diff
@@ -31,7 +31,7 @@ async def fetch_de(running, queue, collection, url):
 
                 try:
                     msg = await asyncio.wait_for(ws.receive(), 1)
-                except:
+                except asyncio.TimeoutError:
                     continue
 
                 if msg.type == aiohttp.WSMsgType.TEXT:
@@ -89,9 +89,7 @@ async def output(running, queue, path, format):
 
             try:
                 msg = await asyncio.wait_for(queue.get(), 0.5)
-            except:
-                # Hopefully it's TimeoutError.  Annoying to match since
-                # it changed in 3.11.
+            except asyncio.TimeoutError:
                 continue
 
             if format == "msgpack":
```

---

### Incident Patch 9: `c82a1f50` (2026-09-03)
**Commit Message**: fix(cli): preserve datatype and language tag in parse_nquads (#1095) (#1111)

parse_nquads was using str() on rdflib terms, discarding datatype,
language tag, and IRI-vs-literal distinctions on import. Populate
Triple.o_datatype and Triple.o_language from the rdflib term so
workspace bundle round-trips are lossless.

**File**: `tests/unit/test_cli/test_nquads.py` (modified, +41/-1)
```diff
@@ -9,7 +9,7 @@
 
 import rdflib
 
-from trustgraph.cli.nquads import serialize_nquads, triple_to_nquad, encode_term
+from trustgraph.cli.nquads import serialize_nquads, parse_nquads, triple_to_nquad, encode_term
 
 from tests.unit.test_cli.conftest import iri, lit
 
@@ -122,6 +122,46 @@ def test_unusable_language_tags_are_skipped_not_emitted(self):
             obj = next(iter(ds.quads((None, None, None, None))))[2]
             assert obj == rdflib.Literal("bonjour", lang=ok)
 
+    def test_parse_nquads_preserves_term_types(self):
+        """parse_nquads must preserve datatype, language and IRI-vs-literal."""
+        batches = [[
+            {"s": iri("http://example.com/s"), "p": iri("http://example.com/typed"),
+             "o": lit("42", d="http://www.w3.org/2001/XMLSchema#integer")},
+            {"s": iri("http://example.com/s"), "p": iri("http://example.com/tagged"),
+             "o": lit("bonjour", lang="fr")},
+            {"s": iri("http://example.com/s"), "p": iri("http://example.com/ref"),
+             "o": iri("http://example.com/o")},
+            {"s": iri("http://example.com/s"), "p": iri("http://example.com/str"),
+             "o": lit("http://example.com/o")},
+        ]]
+        out = io.StringIO()
+        serialize_nquads(batches, GRAPH, out)
+        triples = parse_nquads(out.getvalue().encode())
+
+        by_pred = {t.p: t for t in triples}
+
+        typed = by_pred["http://example.com/typed"]
+        assert typed.o == "42"
+        assert typed.o_datatype == "http://www.w3.org/2001/XMLSchema#integer"
+        assert typed.o_language == ""
+
+        tagged = by_pred["http://example.com/tagged"]
+        assert tagged.o == "bonjour"
+        assert tagged.o_language == "fr"
+        assert tagged.o_datatype == ""
+
+        ref = by_pred["http://example.com/ref"]
+        assert ref.o == "http://example.com/o"
+        assert ref.o_datatype == ""
+        assert ref.o_language == ""
+
+        string_lit = by_pred["http://example.com/str"]
+        assert string_lit.o == "http://example.com/o"
+        assert string_lit.o_datatype == ""
+
+        # IRI and literal with the same lexical form must remain distinguishable
+        assert ref.o == string_lit.o
+
     def test_streaming_shape_one_line_per_triple(self):
         line = triple_to_nquad(
             {"s": iri("http://example.com/s"), "p": iri("http://example.com/p"),
```

**File**: `tests/unit/test_cli/test_workspace_bundle_commands.py` (modified, +2/-1)
```diff
@@ -324,7 +324,8 @@ def test_roundtrip_imports_triples_and_documents(self, knowledge_bundle):
         assert call.args[0] == "default"  # flow id
         triples = sorted(list(call.args[1]), key=lambda t: t.p)
         assert triples == [
-            Triple(s="http://ex.com/s", p="http://ex.com/count", o="42"),
+            Triple(s="http://ex.com/s", p="http://ex.com/count", o="42",
+                   o_datatype="http://www.w3.org/2001/XMLSchema#integer"),
             Triple(s="http://ex.com/s", p="http://ex.com/p",
                    o="http://ex.com/o"),
         ]
```

**File**: `trustgraph-cli/trustgraph/cli/nquads.py` (modified, +19/-6)
```diff
@@ -135,11 +135,20 @@ def serialize_nquads(batches, graph_iri, out):
     return written, skipped
 
 
+def _term_to_triple_field(term):
+    """Convert an rdflib term to (str_value, datatype, language)."""
+    if isinstance(term, rdflib.Literal):
+        dt = str(term.datatype) if term.datatype else ""
+        lang = str(term.language) if term.language else ""
+        return str(term), dt, lang
+    return str(term), "", ""
+
+
 def parse_nquads(data):
     """Parse N-Quads bytes back into api Triple values.
 
-    Terms are stringified with str(), the same convention tg-load-knowledge
-    uses, so values survive the store round trip unchanged. The whole
+    Preserves datatype, language tag and IRI-vs-literal distinctions
+    via the Triple.o_datatype and Triple.o_language fields. The whole
     member is materialized in memory (bundles are bounded by
     --triples-limit at export); line-streaming is a possible follow-up.
 
@@ -148,7 +157,11 @@ def parse_nquads(data):
     """
     ds = rdflib.Dataset()
     ds.parse(data=data.decode("utf-8"), format="nquads")
-    return [
-        Triple(s=str(s), p=str(p), o=str(o))
-        for s, p, o, _g in ds.quads((None, None, None, None))
-    ]
+    result = []
+    for s, p, o, _g in ds.quads((None, None, None, None)):
+        o_val, o_dt, o_lang = _term_to_triple_field(o)
+        result.append(Triple(
+            s=str(s), p=str(p), o=o_val,
+            o_datatype=o_dt, o_language=o_lang,
+        ))
+    return result
```

---

### Incident Patch 10: `7971afcc` (2026-09-03)
**Commit Message**: fix: align requires-python with MCP SDK dependency (#1106) (#1110)

The MCP SDK requires Python >=3.10. All packages declared >=3.8,
making the metadata unsatisfiable on Python 3.8/3.9. Bump all 11
packages to >=3.10 for consistency.

**File**: `trustgraph-base/pyproject.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ dynamic = ["version"]
 authors = [{name = "trustgraph.ai", email = "security@trustgraph.ai"}]
 description = "TrustGraph provides a means to run a pipeline of flexible AI processing components in a flexible means to achieve a processing pipeline."
 readme = "README.md"
-requires-python = ">=3.8"
+requires-python = ">=3.10"
 dependencies = [
     "pulsar-client",
     "prometheus-client",
```

**File**: `trustgraph-bedrock/pyproject.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ dynamic = ["version"]
 authors = [{name = "trustgraph.ai", email = "security@trustgraph.ai"}]
 description = "TrustGraph provides a means to run a pipeline of flexible AI processing components in a flexible means to achieve a processing pipeline."
 readme = "README.md"
-requires-python = ">=3.8"
+requires-python = ">=3.10"
 dependencies = [
     "trustgraph-base>=2.9,<2.10",
     "pulsar-client",
```

**File**: `trustgraph-cli/pyproject.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ dynamic = ["version"]
 authors = [{name = "trustgraph.ai", email = "security@trustgraph.ai"}]
 description = "TrustGraph provides a means to run a pipeline of flexible AI processing components in a flexible means to achieve a processing pipeline."
 readme = "README.md"
-requires-python = ">=3.8"
+requires-python = ">=3.10"
 dependencies = [
     "trustgraph-base>=2.9,<2.10",
     "requests",
```

**File**: `trustgraph-docling/pyproject.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ dynamic = ["version"]
 authors = [{name = "trustgraph.ai", email = "security@trustgraph.ai"}]
 description = "TrustGraph document decoder powered by Docling — lightweight alternative to the unstructured-based decoder."
 readme = "README.md"
-requires-python = ">=3.8"
+requires-python = ">=3.10"
 dependencies = [
     "trustgraph-base>=2.9,<2.10",
     "pulsar-client",
```

**File**: `trustgraph-embeddings-hf/pyproject.toml` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ dynamic = ["version"]
 authors = [{name = "trustgraph.ai", email = "security@trustgraph.ai"}]
 description = "HuggingFace embeddings support for TrustGraph."
 readme = "README.md"
-requires-python = ">=3.8"
+requires-python = ">=3.10"
 dependencies = [
     "trustgraph-base>=2.9,<2.10",
     "trustgraph-flow>=2.9,<2.10",
```

#### Recent Merged Pull Requests:
- **PR #1146** (2026-09-30): Fix Discord badge link in README.md (@JackColquitt)
- **PR #1145** (2026-09-30): fix(tests): update mock signatures for user_context parameter (@cybermaggedon)
- **PR #1144** (2026-09-30): feat: SHACL-AF policy filtering with user context pass-through (@cybermaggedon)
- **PR #1143** (2026-09-30): refactor(api): carry datatype/language on Literal, remove o_datatype/o_language from Triple (@cybermaggedon)
- **PR #1142** (2026-09-29): feat(cli): add --graph flag to tg-load-knowledge (@cybermaggedon)
- **PR #1141** (2026-09-29): feat: add user context schema and tech spec (@cybermaggedon)
- **PR #1140** (2026-09-26): Add Docker Pulls badge to README (@JackColquitt)
- **PR #1139** (2026-09-26): Add section on ontologies in TrustGraph (@JackColquitt)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
