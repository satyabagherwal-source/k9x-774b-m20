# Forensic Learning Record (Deep Inspection): HKUDS/LightRAG

> **Canonical Artifact**: `07_PROJECT_LEARNING/hkuds-lightrag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HKUDS/LightRAG](https://github.com/HKUDS/LightRAG))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:40:38.582Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HKUDS/LightRAG`
- **Description**: [EMNLP2025] LightRAG: Simple and Fast Retrieval-Augmented Generation
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 39939 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/generate_query.py`
```
from openai import OpenAI

# os.environ["OPENAI_API_KEY"] = ""


def openai_complete_if_cache(
    model="gpt-4o-mini", prompt=None, system_prompt=None, history_messages=[], **kwargs
) -> str:
    openai_client = OpenAI()

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.extend(history_messages)
    messages.append({"role": "user", "content": prompt})

    response = openai_client.chat.completions.create(
        model=model, messages=messages, **kwargs
    )
    if not response.choices or response.choices[0].message is None:
        return ""
    return response.choices[0].message.content


if __name__ == "__main__":
    description = ""
    prompt = f"""
    Given the following description of a dataset:

    {description}

    Please identify 5 potential users who would engage with this dataset. For each user, list 5 tasks they would perform with this dataset. Then, for each (user, task) combination, generate 5 questions that require a high-level understanding of the entire dataset.

    Output the results in the following structure:
    - User 1: [user description]
        - Task 1: [task description]
            - Question 1:
            - Question 2:
            - Question 3:
            - Question 4:
            - Question 5:
        - Task 2: [task description]
            ...
        - Task 5: [task description]
    - User 2: [user description]
        ...
    - User 5: [user description]
        ...
    """

    result = openai_complete_if_cache(model="gpt-4o-mini", prompt=prompt)

    file_path = "./queries.txt"
    with open(file_path, "w") as file:
        file.write(result)

    print(f"Queries written to {file_path}")

```

### Core Architecture Module: `examples/graph_visual_with_html.py`
```
import pipmaster as pm

if not pm.is_installed("pyvis"):
    pm.install("pyvis")
if not pm.is_installed("networkx"):
    pm.install("networkx")

import networkx as nx
from pyvis.network import Network
import random

# Load the GraphML file
G = nx.read_graphml("./dickens/graph_chunk_entity_relation.graphml")

# Create a Pyvis network
net = Network(height="100vh", notebook=True)

# Convert NetworkX graph to Pyvis network
net.from_nx(G)


# Add colors and title to nodes
for node in net.nodes:
    node["color"] = "#{:06x}".format(random.randint(0, 0xFFFFFF))
    if "description" in node:
        node["title"] = node["description"]

# Add title to edges
for edge in net.edges:
    if "description" in edge:
        edge["title"] = edge["description"]

# Save and display the network
net.show("knowledge_graph.html")

```

### Core Architecture Module: `examples/graph_visual_with_neo4j.py`
```
import os
import json
import xml.etree.ElementTree as ET
from neo4j import GraphDatabase

# Constants
WORKING_DIR = "./dickens"
BATCH_SIZE_NODES = 500
BATCH_SIZE_EDGES = 100

# Neo4j connection credentials
NEO4J_URI = "bolt://localhost:7687"
NEO4J_USERNAME = "neo4j"
NEO4J_PASSWORD = "your_password"


def xml_to_json(xml_file):
    try:
        tree = ET.parse(xml_file)
        root = tree.getroot()

        # Print the root element's tag and attributes to confirm the file has been correctly loaded
        print(f"Root element: {root.tag}")
        print(f"Root attributes: {root.attrib}")

        data = {"nodes": [], "edges": []}

        # Use namespace
        namespace = {"": "http://graphml.graphdrawing.org/xmlns"}

        for node in root.findall(".//node", namespace):
            node_data = {
                "id": node.get("id").strip('"'),
                "entity_type": node.find("./data[@key='d1']", namespace).text.strip('"')
                if node.find("./data[@key='d1']", namespace) is not None
                else "",
                "description": node.find("./data[@key='d2']", namespace).text
                if node.find("./data[@key='d2']", namespace) is not None
                else "",
                "source_id": node.find("./data[@key='d3']", namespace).text
                if node.find("./data[@key='d3']", namespace) is not None
                else "",
            }
            data["nodes"].append(node_data)

        for edge in root.findall(".//edge", namespace):
            edge_data = {
                "source": edge.get("source").strip('"'),
                "target": edge.get("target").strip('"'),
                "weight": float(edge.find("./data[@key='d5']", namespace).text)
                if edge.find("./data[@key='d5']", namespace) is not None
                else 0.0,
                "description": edge.find("./data[@key='d6']", namespace).text
                if edge.find("./data[@key='d6']", namespace) is not None
                else "",
                "keywords": edge.find("./data[@key='d9']", namespace).text
                if edge.find("./data[@key='d9']", namespace) is not None
                else "",
                "source_id": edge.find("./data[@key='d8']", namespace).text
                if edge.find("./data[@key='d8']", namespace) is not None
                else "",
            }
            data["edges"].append(edge_data)

        # Print the number of nodes and edges found
        print(f"Found {len(data['nodes'])} nodes and {len(data['edges'])} edges")

        return data
    except ET.ParseError as e:
        print(f"Error parsing XML file: {e}")
        return None
    except Exception as e:
        print(f"An error occurred: {e}")
        return None


def convert_xml_to_json(xml_path, output_path):
    """Converts XML file to JSON and saves the output."""
    if not os.path.exists(xml_path):
        print(f"Error: File not found - {xml_path}")
        return None

    json_data = xml_to_json(xml_path)
    if json_data:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        print(f"JSON file created: {output_path}")
        return json_data
    else:
        print("Failed to create JSON data")
        return None


def process_in_batches(tx, query, data, batch_size):
    """Process data in batches and execute the given query."""
    for i in range(0, len(data), batch_size):
        batch = data[i : i + batch_size]
        tx.run(query, {"nodes": batch} if "nodes" in query else {"edges": batch})


def main():
    # Paths
    xml_file = os.path.join(WORKING_DIR, "graph_chunk_entity_relation.graphml")
    json_file = os.path.join(WORKING_DIR, "graph_data.json")

    # Convert XML to JSON
    json_data = convert_xml_to_json(xml_file, json_file)
    if json_data is None:
        return

    # Load nodes and edges
    nodes = json_data.get("nodes", [])
    edges = json_data.get("edges", [])

    # Neo4j queries
    create_nodes_query = """
    UNWIND $nodes AS node
    MERGE (e:Entity {id: node.id})
    SET e.entity_type = node.entity_type,
        e.description = node.description,
        e.source_id = node.source_id,
        e.displayName = node.id
    REMOVE e:Entity
    WITH e, node
    CALL apoc.create.addLabels(e, [node.id]) YIELD node AS labeledNode
    RETURN count(*)
    """

    create_edges_query = """
    UNWIND $edges AS edge
    MATCH (source {id: edge.source})
    MATCH (target {id: edge.target})
    WITH source, target, edge,
         CASE
            WHEN edge.keywords CONTAINS 'lead' THEN 'lead'
            WHEN edge.keywords CONTAINS 'participate' THEN 'participate'
            WHEN edge.keywords CONTAINS 'uses' THEN 'uses'
            WHEN edge.keywords CONTAINS 'located' THEN 'located'
            WHEN edge.keywords CONTAINS 'occurs' THEN 'occurs'
           ELSE REPLACE(SPLIT(edge.keywords, ',')[0], '\"', '')
         END AS relType
    CALL apoc.create.relationship(source, relType, {
      weight: edge.weight,
      description: edge.description,
      keywords: edge.keywords,
      source_id: edge.source_id
    }, target) YIELD rel
    RETURN count(*)
    """

    set_displayname_and_labels_query = """
    MATCH (n)
    SET n.displayName = n.id
    WITH n
    CALL apoc.create.setLabels(n, [n.entity_type]) YIELD node
    RETURN count(*)
    """

    # Create a Neo4j driver
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))

    try:
        # Execute queries in batches
        with driver.session() as session:
            # Insert nodes in batches
            session.execute_write(
                process_in_batches, create_nodes_query, nodes, BATCH_SIZE_NODES
            )

            # Insert edges in batches
            session.execute_write(
                process_in_batches, create_edges_query, edges, BATCH_SIZE_EDGES
            )

            # Set displayName and labels
            session.run(set_displayname_and_labels_query)

    except Exception as e:
        print(f"Error occurred: {e}")

    finally:
        driver.close()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/graph_visual_with_opensearch.py`
```
"""
Knowledge Graph Visualization with OpenSearch + LightRAG WebUI

This script demonstrates two ways to visualize the knowledge graph
stored in OpenSearch:

1. **WebUI (recommended)**: Opens the LightRAG WebUI in your browser
   for interactive graph exploration with search, filtering, and
   force-directed layout.

2. **Standalone HTML**: Fetches graph data from the LightRAG Server API
   and generates an interactive HTML file using Pyvis, similar to
   graph_visual_with_html.py but reading from OpenSearch instead of
   a local .graphml file.

Prerequisites:
    1. LightRAG Server running with OpenSearch storage:
       lightrag-server --host 0.0.0.0 --port 9621

    2. Documents already indexed (e.g., via the WebUI or API)

Usage:
    # Open WebUI for interactive exploration
    python examples/graph_visual_with_opensearch.py

    # Generate standalone HTML file
    python examples/graph_visual_with_opensearch.py --html

    # Custom server URL and output file
    python examples/graph_visual_with_opensearch.py --html --server http://localhost:9621 --output my_graph.html
"""

import argparse
import os
import sys
import webbrowser

import pipmaster as pm

if not pm.is_installed("requests"):
    pm.install("requests")
if not pm.is_installed("pyvis"):
    pm.install("pyvis")

import requests
from pyvis.network import Network


def fetch_graph(server_url: str, label: str = "*", max_nodes: int = 300) -> dict:
    """Fetch knowledge graph data from LightRAG Server API."""
    url = f"{server_url}/graphs"
    params = {"label": label, "max_nodes": max_nodes}
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()


def generate_html(graph_data: dict, output_file: str) -> str:
    """Generate an interactive HTML visualization from graph data."""
    nodes = graph_data.get("nodes", [])
    edges = graph_data.get("edges", [])

    if not nodes:
        print("No nodes found in the graph. Index some documents first.")
        sys.exit(1)

    print(f"Building visualization: {len(nodes)} nodes, {len(edges)} edges")

    net = Network(height="100vh", notebook=False, cdn_resources="in_line")

    # Add nodes with colors based on entity type
    import hashlib

    for node in nodes:
        node_id = node.get("id", "")
        props = node.get("properties", {})
        entity_type = props.get("entity_type", "unknown")
        description = props.get("description", "")

        # Deterministic color from entity type
        color_hash = int(hashlib.md5(entity_type.encode()).hexdigest()[:6], 16)
        color = f"#{color_hash:06x}"

        net.add_node(
            node_id,
            label=node_id,
            title=f"[{entity_type}] {description[:200]}"
            if description
            else entity_type,
            color=color,
        )

    # Add edges
    for edge in edges:
        source = edge.get("source", "")
        target = edge.get("target", "")
        props = edge.get("properties", {})
        rel_type = edge.get("type", "")
        description = props.get("description", "")

        net.add_edge(
            source,
            target,
            title=f"[{rel_type}] {description[:200]}" if description else rel_type,
            label=rel_type,
        )

    net.save_graph(output_file)
    print(f"Graph saved to {output_file}")
    return output_file


def main():
    parser = argparse.ArgumentParser(
        description="Visualize LightRAG knowledge graph from OpenSearch"
    )
    parser.add_argument(
        "--html",
        action="store_true",
        help="Generate standalone HTML file instead of opening WebUI",
    )
    parser.add_argument(
        "--server",
        default="http://localhost:9621",
        help="LightRAG Server URL (default: http://localhost:9621)",
    )
    parser.add_argument(
        "--output",
        default="knowledge_graph_opensearch.html",
        help="Output HTML file (default: knowledge_graph_opensearch.html)",
    )
    parser.add_argument(
        "--label",
        default="*",
        help="Starting node label, or '*' for all nodes (default: *)",
    )
    parser.add_argument(
        "--max-nodes",
        type=int,
        default=300,
        help="Maximum nodes to fetch (default: 300)",
    )
    args = parser.parse_args()

    # Verify server is running
    try:
        requests.get(f"{args.server}/health", timeout=5)
    except requests.ConnectionError:
        print(f"Error: Cannot connect to LightRAG Server at {args.server}")
        print("Start the server first: lightrag-server --host 0.0.0.0 --port 9621")
        sys.exit(1)

    if args.html:
        # Generate standalone HTML
        graph_data = fetch_graph(args.server, args.label, args.max_nodes)
        output = generate_html(graph_data, args.output)
        webbrowser.open(f"file://{os.path.abspath(output)}")
    else:
        # Open WebUI graph explorer
        url = f"{args.server}/#/graph"
        print(f"Opening LightRAG WebUI graph explorer: {url}")
        webbrowser.open(url)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/insert_custom_kg.py`
```
import os
from lightrag import LightRAG
from lightrag.llm.openai import gpt_4o_mini_complete
#########
# Uncomment the below two lines if running in a jupyter notebook to handle the async nature of rag.insert()
# import nest_asyncio
# nest_asyncio.apply()
#########

WORKING_DIR = "./custom_kg"

if not os.path.exists(WORKING_DIR):
    os.mkdir(WORKING_DIR)

rag = LightRAG(
    working_dir=WORKING_DIR,
    llm_model_func=gpt_4o_mini_complete,  # Use gpt_4o_mini_complete LLM model
    # llm_model_func=gpt_4o_complete  # Optionally, use a stronger model
)

custom_kg = {
    "entities": [
        {
            "entity_name": "CompanyA",
            "entity_type": "Organization",
            "description": "A major technology company",
            "source_id": "Source1",
        },
        {
            "entity_name": "ProductX",
            "entity_type": "Product",
            "description": "A popular product developed by CompanyA",
            "source_id": "Source1",
        },
        {
            "entity_name": "PersonA",
            "entity_type": "Person",
            "description": "A renowned researcher in AI",
            "source_id": "Source2",
        },
        {
            "entity_name": "UniversityB",
            "entity_type": "Organization",
            "description": "A leading university specializing in technology and sciences",
            "source_id": "Source2",
        },
        {
            "entity_name": "CityC",
            "entity_type": "Location",
            "description": "A large metropolitan city known for its culture and economy",
            "source_id": "Source3",
        },
        {
            "entity_name": "EventY",
            "entity_type": "Event",
            "description": "An annual technology conference held in CityC",
            "source_id": "Source3",
        },
    ],
    "relationships": [
        # Each real source_id contributes an evidence-count floor of 1.0.
        # Larger values are optional boosts; omit source_id for a source-less
        # non-negative fractional weight.
        {
            "src_id": "CompanyA",
            "tgt_id": "ProductX",
            "description": "CompanyA develops ProductX",
            "keywords": "develop, produce",
            "weight": 1.0,
            "source_id": "Source1",
        },
        {
            "src_id": "PersonA",
            "tgt_id": "UniversityB",
            "description": "PersonA works at UniversityB",
            "keywords": "employment, affiliation",
            "weight": 1.25,
            "source_id": "Source2",
        },
        {
            "src_id": "CityC",
            "tgt_id": "EventY",
            "description": "EventY is hosted in CityC",
            "keywords": "host, location",
            "weight": 1.0,
            "source_id": "Source3",
        },
    ],
    "chunks": [
        {
            "content": "ProductX, developed by CompanyA, has revolutionized the market with its cutting-edge features.",
            "source_id": "Source1",
            "source_chunk_index": 0,
        },
        {
            "content": "One outstanding feature of ProductX is its advanced AI capabilities.",
            "source_id": "Source1",
            "chunk_order_index": 1,
        },
        {
            "content": "PersonA is a prominent researcher at UniversityB, focusing on artificial intelligence and machine learning.",
            "source_id": "Source2",
            "source_chunk_index": 0,
        },
        {
            "content": "EventY, held in CityC, attracts technology enthusiasts and companies from around the globe.",
            "source_id": "Source3",
            "source_chunk_index": 0,
        },
        {
            "content": "None",
            "source_id": "UNKNOWN",
            "source_chunk_index": 0,
        },
    ],
}

rag.insert_custom_kg(custom_kg)

```

### Core Architecture Module: `examples/lightrag_ag2_multiagent_demo.py`
```
"""LightRAG + AG2 Multi-Agent Demo.

Demonstrates how AG2 agents can use LightRAG's knowledge graph retrieval
as a tool. Multiple specialized agents collaborate to answer complex
questions over indexed documents.

Architecture:
    User -> AG2 GroupChat (Researcher + Analyst + Writer) -> LightRAG queries
    - Researcher: uses LightRAG hybrid search to gather facts
    - Analyst: uses LightRAG naive (vector) search for complementary results
    - Writer: synthesizes findings into a final answer

Requires:
    pip install lightrag-hku "ag2[openai]>=0.11.4,<1.0"
    export OPENAI_API_KEY="..."

Usage:
    python examples/lightrag_ag2_multiagent_demo.py
"""

import asyncio
import json
import os
import shutil
import threading

from autogen import (
    AssistantAgent,
    GroupChat,
    GroupChatManager,
    LLMConfig,
    UserProxyAgent,
)

from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import gpt_4o_mini_complete, openai_embed

# --- Configuration ---

WORKING_DIR = "./ag2_demo_workdir"

SAMPLE_TEXT = """
Artificial intelligence has transformed multiple industries. Machine learning,
a subset of AI, enables systems to learn from data without explicit programming.
Deep learning, using neural networks with many layers, has achieved breakthroughs
in computer vision, natural language processing, and speech recognition.

Transformer architectures, introduced in the 2017 paper "Attention Is All You Need"
by Vaswani et al., revolutionized NLP. Models like GPT and BERT are built on
transformers. GPT (Generative Pre-trained Transformer) uses decoder-only architecture
for text generation, while BERT (Bidirectional Encoder Representations) uses
encoder-only architecture for understanding tasks.

Retrieval-Augmented Generation (RAG) combines the strengths of retrieval systems
and generative models. Instead of relying solely on parametric knowledge, RAG
systems retrieve relevant documents from a knowledge base and use them as context
for generation. This approach reduces hallucination and enables models to access
up-to-date information.

Knowledge graphs represent information as entities and relationships. When combined
with RAG, knowledge graphs enable structured reasoning over document collections.
LightRAG implements this approach with dual-level retrieval: local search focuses
on specific entities, while global search captures broader themes and relationships.
"""


# --- LightRAG Setup ---


async def setup_lightrag() -> LightRAG:
    """Initialize LightRAG and index sample documents."""
    if os.path.exists(WORKING_DIR):
        shutil.rmtree(WORKING_DIR)
    os.makedirs(WORKING_DIR, exist_ok=True)

    rag = LightRAG(
        working_dir=WORKING_DIR,
        embedding_func=openai_embed,
        llm_model_func=gpt_4o_mini_complete,
    )
    await rag.initialize_storages()
    await rag.ainsert(SAMPLE_TEXT)
    print("LightRAG initialized and documents indexed.\n")
    return rag


# --- Async Bridge ---
# AG2 runs tools in a background thread without an event loop.
# We maintain a dedicated event loop in a separate thread for LightRAG async calls.

_bg_loop: asyncio.AbstractEventLoop = None


def _start_background_loop(loop: asyncio.AbstractEventLoop):
    asyncio.set_event_loop(loop)
    loop.run_forever()


def _run_async(coro):
    """Submit a coroutine to the background event loop and wait for the result."""
    future = asyncio.run_coroutine_threadsafe(coro, _bg_loop)
    return future.result(timeout=120)


# --- AG2 Agent Tools ---

# Global reference to LightRAG instance (set in main)
_rag_instance: LightRAG = None


def create_agents():
    """Create AG2 agents with LightRAG tools."""
    llm_config = LLMConfig(
        {
            "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
            "api_key": os.environ["OPENAI_API_KEY"],
            "api_type": "openai",
        }
    )

    researcher = AssistantAgent(
        name="Researcher",
        system_message=(
            "You are a research specialist. Use the lightrag_query tool to search "
            "the knowledge base. Start with 'hybrid' mode for comprehensive results. "
            "If you need specific entity details, use 'local' mode. "
            "Present your findings as structured bullet points. "
            "Always call the tool -- do NOT answer from your own knowledge."
        ),
        llm_config=llm_config,
    )

    analyst = AssistantAgent(
        name="Analyst",
        system_message=(
            "You are a knowledge graph analyst. Your FIRST action MUST be calling "
            "the lightrag_query tool with mode='naive' to run a direct vector search. "
            "This gives different results from the Researcher's hybrid search. "
            "After receiving the naive search results, compare them with the "
            "Researcher's findings and highlight any additional insights. "
            "You MUST call the tool before writing any analysis."
        ),
        llm_config=llm_config,
    )

    writer = AssistantAgent(
        name="Writer",
        system_message=(
            "You are a technical writer. Synthesize the findings from the "
            "Researcher and Analyst into a clear, well-structured answer. "
            "Do NOT use the search tool -- work only with what the other agents "
            "have found. End your response with TERMINATE."
        ),
        llm_config=llm_config,
    )

    def is_termination(msg):
        return "TERMINATE" in (msg.get("content") or "")

    user_proxy = UserProxyAgent(
        name="User",
        human_input_mode="NEVER",
        max_consecutive_auto_reply=10,
        code_execution_config=False,
        is_termination_msg=is_termination,
    )

    # --- Register LightRAG as a tool ---

    @user_proxy.register_for_execution()
    @researcher.register_for_llm(
        description=(
            "Query the LightRAG knowledge base. "
            "mode: 'naive' (simple vector), 'local' (entity-focused), "
            "'global' (theme/relationship-focused), 'hybrid' (combined). "
            "Returns retrieved context from indexed documents."
        )
    )
    @analyst.register_for_llm(
        description=(
            "Query the LightRAG knowledge base. "
            "mode: 'naive' (simple vector), 'local' (entity-focused), "
            "'global' (theme/relationship-focused), 'hybrid' (combined). "
            "Returns retrieved context from indexed documents."
        )
    )
    def lightrag_query(query: str, mode: str = "hybrid") -> str:
        """Query LightRAG synchronously (wraps async call)."""
        valid_modes = {"naive", "local", "global", "hybrid"}
        if mode not in valid_modes:
            return json.dumps(
                {"error": f"Invalid mode '{mode}'. Use one of: {valid_modes}"}
            )
        try:
            result = _run_async(
                _rag_instance.aquery(query, param=QueryParam(mode=mode))
            )
            return json.dumps({"mode": mode, "query": query, "result": result})
        except Exception as e:
            return json.dumps({"error": str(e)})

    return user_proxy, researcher, analyst, writer


def run_multiagent_query(user_proxy, researcher, analyst, writer, question: str):
    """Run a multi-agent GroupChat to answer a question using LightRAG."""
    # Enforce pipeline: Researcher -> Analyst -> Writer.
    # func_call_filter (default True) automatically routes tool calls
    # to/from user_proxy, so transitions only govern non-tool handoffs.
    # User can only start with Researcher; Researcher advances to Analyst;
    # Analyst advances to Writer. Writer terminates the conversation.
    allowed_transitions = {
        user_proxy: [researcher],
        researcher: [user_proxy, analyst],
        analyst: [user_proxy, writer],
        writer: [],
    }

    group_chat = GroupChat(
        agents=[user_proxy, researcher, analyst, writer],
        messages=[],
        max_round=12,
        allowed_or_disallowed_spe
```

### Core Architecture Module: `examples/lightrag_azure_openai_demo.py`
```
import os
import asyncio
from lightrag import LightRAG, QueryParam
from lightrag.utils import EmbeddingFunc
import numpy as np
from dotenv import load_dotenv
import logging
from openai import AzureOpenAI

logging.basicConfig(level=logging.INFO)

load_dotenv()

AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")

AZURE_EMBEDDING_DEPLOYMENT = os.getenv("AZURE_EMBEDDING_DEPLOYMENT")
AZURE_EMBEDDING_API_VERSION = os.getenv("AZURE_EMBEDDING_API_VERSION")

WORKING_DIR = "./dickens"

if os.path.exists(WORKING_DIR):
    import shutil

    shutil.rmtree(WORKING_DIR)

os.mkdir(WORKING_DIR)


async def llm_model_func(
    prompt, system_prompt=None, history_messages=[], keyword_extraction=False, **kwargs
) -> str:
    client = AzureOpenAI(
        api_key=AZURE_OPENAI_API_KEY,
        api_version=AZURE_OPENAI_API_VERSION,
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
    )

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    if history_messages:
        messages.extend(history_messages)
    messages.append({"role": "user", "content": prompt})

    chat_completion = client.chat.completions.create(
        model=AZURE_OPENAI_DEPLOYMENT,  # model = "deployment_name".
        messages=messages,
        temperature=kwargs.get("temperature", 0),
        top_p=kwargs.get("top_p", 1),
        n=kwargs.get("n", 1),
    )
    if not chat_completion.choices or chat_completion.choices[0].message is None:
        return ""
    return chat_completion.choices[0].message.content


async def embedding_func(texts: list[str]) -> np.ndarray:
    client = AzureOpenAI(
        api_key=AZURE_OPENAI_API_KEY,
        api_version=AZURE_EMBEDDING_API_VERSION,
        azure_endpoint=AZURE_OPENAI_ENDPOINT,
    )
    embedding = client.embeddings.create(model=AZURE_EMBEDDING_DEPLOYMENT, input=texts)

    embeddings = [item.embedding for item in embedding.data]
    return np.array(embeddings)


async def test_funcs():
    result = await llm_model_func("How are you?")
    print("Resposta do llm_model_func: ", result)

    result = await embedding_func(["How are you?"])
    print("Resultado do embedding_func: ", result.shape)
    print("Dimensão da embedding: ", result.shape[1])


asyncio.run(test_funcs())

embedding_dimension = 3072


async def initialize_rag():
    rag = LightRAG(
        working_dir=WORKING_DIR,
        llm_model_func=llm_model_func,
        embedding_func=EmbeddingFunc(
            embedding_dim=embedding_dimension,
            max_token_size=8192,
            func=embedding_func,
        ),
    )

    await rag.initialize_storages()  # Auto-initializes pipeline_status
    return rag


def main():
    rag = asyncio.run(initialize_rag())

    book1 = open("./book_1.txt", encoding="utf-8")
    book2 = open("./book_2.txt", encoding="utf-8")

    rag.insert([book1.read(), book2.read()])

    query_text = "What are the main themes?"

    print("Result (Naive):")
    print(rag.query(query_text, param=QueryParam(mode="naive")))

    print("\nResult (Local):")
    print(rag.query(query_text, param=QueryParam(mode="local")))

    print("\nResult (Global):")
    print(rag.query(query_text, param=QueryParam(mode="global")))

    print("\nResult (Hybrid):")
    print(rag.query(query_text, param=QueryParam(mode="hybrid")))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `examples/lightrag_gemini_demo.py`
```
"""
LightRAG Demo with Google Gemini Models

This example demonstrates how to use LightRAG with Google's Gemini 2.0 Flash model
for text generation and the text-embedding-004 model for embeddings.

Prerequisites:
    1. Set GEMINI_API_KEY environment variable:
       export GEMINI_API_KEY='your-actual-api-key'

    2. Prepare a text file named 'book.txt' in the current directory
       (or modify BOOK_FILE constant to point to your text file)

Usage:
    python examples/lightrag_gemini_demo.py
"""

import os
import asyncio
import nest_asyncio
import numpy as np

from lightrag import LightRAG, QueryParam
from lightrag.llm.gemini import gemini_model_complete, gemini_embed
from lightrag.utils import wrap_embedding_func_with_attrs

nest_asyncio.apply()

WORKING_DIR = "./rag_storage"
BOOK_FILE = "./book.txt"

# Validate API key
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError(
        "GEMINI_API_KEY environment variable is not set. "
        "Please set it with: export GEMINI_API_KEY='your-api-key'"
    )

if not os.path.exists(WORKING_DIR):
    os.mkdir(WORKING_DIR)


# --------------------------------------------------
# LLM function
# --------------------------------------------------
async def llm_model_func(prompt, system_prompt=None, history_messages=[], **kwargs):
    return await gemini_model_complete(
        prompt,
        system_prompt=system_prompt,
        history_messages=history_messages,
        api_key=GEMINI_API_KEY,
        model_name="gemini-2.0-flash",
        **kwargs,
    )


# --------------------------------------------------
# Embedding function
# --------------------------------------------------
@wrap_embedding_func_with_attrs(
    embedding_dim=768,
    send_dimensions=True,
    max_token_size=2048,
    model_name="models/text-embedding-004",
)
async def embedding_func(texts: list[str]) -> np.ndarray:
    return await gemini_embed.func(
        texts, api_key=GEMINI_API_KEY, model="models/text-embedding-004"
    )


# --------------------------------------------------
# Initialize RAG
# --------------------------------------------------
async def initialize_rag():
    rag = LightRAG(
        working_dir=WORKING_DIR,
        llm_model_func=llm_model_func,
        embedding_func=embedding_func,
        llm_model_name="gemini-2.0-flash",
    )

    # 🔑 REQUIRED
    await rag.initialize_storages()
    return rag


# --------------------------------------------------
# Main
# --------------------------------------------------
def main():
    # Validate book file exists
    if not os.path.exists(BOOK_FILE):
        raise FileNotFoundError(
            f"'{BOOK_FILE}' not found. "
            "Please provide a text file to index in the current directory."
        )

    rag = asyncio.run(initialize_rag())

    # Insert text
    with open(BOOK_FILE, "r", encoding="utf-8") as f:
        rag.insert(f.read())

    query = "What are the top themes?"

    print("\nNaive Search:")
    print(rag.query(query, param=QueryParam(mode="naive")))

    print("\nLocal Search:")
    print(rag.query(query, param=QueryParam(mode="local")))

    print("\nGlobal Search:")
    print(rag.query(query, param=QueryParam(mode="global")))

    print("\nHybrid Search:")
    print(rag.query(query, param=QueryParam(mode="hybrid")))


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4108** (2026-09-28): **Flaky offline test: test_forked_workers_inherit_the_masters_claim fails on a transient thread at fork() in CI**
  *Symptoms*: ## Summary  `tests/workspace/test_working_dir_lock.py::test_forked_workers_inherit_the_masters_claim` fails intermittently in the **Backend Offline Unit Tests** workflow on the GitHub-hosted Ubuntu runners. The lock behaviour under test works in every failing run. The test fails because the probe process is briefly multi-threaded at one of its four `fork()` calls, and CPython then emits its multi-threaded-fork `DeprecationWarning`, which the probe treats as a failure.  ## Observed failures  | Run | Branch / commit | Job | | --- | --- | --- | | [36213604223](https://github.com/HKUDS/LightRAG/actions/runs/36213604223) | `dev` @ `203db9696` | Offline Tests (3.12) | | [36284031712](https://github.com/HKUDS/LightRAG/actions/runs/36284031712) | PR #4107 @ `ecc403f78` | Offline Tests (3.12) | | [36286038708](https://github.com/HKUDS/LightRAG/actions/runs/36286038708) | PR #4107 @ `72cd76bf5` | Offline Tests (3.14); the 3.12 job was then cancelled by matrix fail-fast |  All three have the same signature. It is always the single failing test out of ~8.3k:  ``` AssertionError: probe 'workers' failed (rc=1)   stdout:   OK   OK   OK   OK   stderr:   parent: fork() warned -- This process (pid=NNNN) is multi-threaded, use of fork() may lead to deadlocks in the child. ```  - All four forked children report `OK`, so the inherited claim works as intended. - Only **one** of the four forks warned. The extra thread was therefore transient (it existed at one `fork()` and was gone by the others), 
  **Post-Mortem & Fix Analysis**:
  > Closing in favor of the test-removal approach in https://github.com/HKUDS/LightRAG/pull/4117 (target: dev), which is open for review and has not yet merged. PR #4115 is superseded.  The fork probe does not exercise the real Gunicorn startup hooks, and maintaining its thread-free environment costs more than the narrow inheritance coverage provides. The replacement removes that probe and its test while retaining the other directory-lock tests. Local workspace validation: 119 passed, 3 deselected; Ruff and diff checks passed. 

- **Issue #4040** (2026-09-22): **[Bug]: RAGAS evaluation: a case where every metric is NaN is reported as a successful 0.0 and skews the averages**
  *Symptoms*: ### Do you need to file an issue?  - [x] I have searched the existing issues and this bug is not already filed. - [x] I believe this is a legitimate bug, not just a question or feature request.  ### Describe the bug  In `RAGEvaluator.evaluate_single_case` (`lightrag/evaluation/eval_rag_quality.py`), `ragas_score` is the mean of the non-NaN metrics, but it falls back to `0` when all four metrics are NaN (e.g. the judge LLM's output can't be parsed). That case still has a non-empty `metrics` dict, so everything downstream counts it as a success:  - `success_rate` stays at 100 % - `min_ragas_score` becomes 0 - the average `ragas_score` is dragged down  Meanwhile the per-metric averages correctly skip the NaNs, so the summary contradicts itself. A judge-LLM failure ends up looking like a bad RAG answer.  I understand the `0` fallback may have been intentional, but it seems to contradict the "excluding NaN values" intent of the code, so I'm filing it as a bug. Happy to adjust if you'd prefer different semantics.  ### Steps to reproduce  import math from lightrag.evaluation.eval_rag_quality import RAGEvaluator  ev = object.__new__(RAGEvaluator) nan = math.nan good = {"metrics": {"faithfulness": .8, "answer_relevance": .8,                     "context_recall": .8, "context_precision": .8}, "ragas_score": .8} all_nan = {"metrics": {"faithfulness": nan, "answer_relevance": nan,                        "context_recall": nan, "context_precision": nan}, "ragas_score": 0}  print(ev._calcul

- **Issue #3996** (2026-09-17): **[Bug]: Neo4j whole-graph edge readers return every relationship twice**
  *Symptoms*: ## Do you need to file an issue?  - [x] I have searched the existing issues and pull requests and this bug is not already filed. - [x] I believe this is a legitimate bug, not just a question or feature request.  ## Describe the bug  `Neo4JStorage.get_all_edges()` and `Neo4JStorage.iter_edges()` use an undirected Cypher pattern with both endpoints unbound:  ```cypher MATCH (a:`workspace`)-[r]-(b:`workspace`) RETURN DISTINCT a.entity_id AS source,                 b.entity_id AS target,                 properties(r) AS properties ```  Cypher matches the same physical relationship in both orientations. The two projected rows are not equal because `source` and `target` are swapped, so `DISTINCT` does not collapse them. Both APIs therefore return every stored relationship twice.  Affected code on current `main`:  - [`get_all_edges()`](https://github.com/HKUDS/LightRAG/blob/044eac0b5040191fe73a99e2847ba63b30338763/lightrag/kg/neo4j_impl.py#L1885-L1907) - [`iter_edges()`](https://github.com/HKUDS/LightRAG/blob/044eac0b5040191fe73a99e2847ba63b30338763/lightrag/kg/neo4j_impl.py#L1909-L1936)  Neo4j documents that a bound relationship without a specified direction is matched in both directions: https://neo4j.com/docs/cypher-manual/current/clauses/match/#match-undirected-relationships  ## Steps to reproduce  1. Configure LightRAG with `Neo4JStorage`. 2. Create nodes `Alpha` and `Beta`. 3. Store one relationship between them. 4. Call `await storage.get_all_edges()` or flatten `storage.iter
  **Post-Mortem & Fix Analysis**:
  > Closing this duplicate tracking issue because the existing PR #3981 already addresses the Neo4j duplicate-edge enumeration bug. I missed that PR in the initial search. The remaining bounded-memory concern with its current implementation is being reviewed directly on #3981.

- **Issue #3990** (2026-09-17): **OMML parser: CJK and fullwidth delimiter characters silently fall back to parentheses**
  *Symptoms*: ### Summary  `OMMLParser.parse_d` keys its delimiter table by the literal character Word stores in `m:begChr` / `m:endChr`. The table covers ASCII and a handful of mathematical Unicode brackets, but **no CJK or fullwidth punctuation**. Every one of those characters misses the lookup and falls through to the `(` / `)` default, so a Word equation delimited with 【 】 or （ ） comes out as `\left( x \right)`.  This renders, so nothing fails loudly — the glyph is just silently wrong. That makes it a different defect class from the parse errors fixed in #3977, which is why it was split out.  Given how much CJK content goes through this parser, the wrong glyph is likely to be seen more often than the parse errors were.  ### Reproduction  ```python from xml.etree import ElementTree as ET from lightrag.parser.docx.omml import convert_omml_to_latex  NS = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"'  def delimited(beg, end):     return convert_omml_to_latex(ET.fromstring(         f'<m:oMath {NS}><m:d>'         f'<m:dPr><m:begChr m:val="{beg}"/><m:endChr m:val="{end}"/></m:dPr>'         '<m:e><m:r><m:t>x</m:t></m:r></m:e></m:d></m:oMath>'))  print(delimited("【", "】"))  # 【x】 -> '\left( x \right)' print(delimited("（", "）"))  # （x） -> '\left( x \right)' ```  Observed on `c2c9d91` (current head of #3977); the fallback behaviour is unchanged from `main`.  | pair | codepoints | current output | |---|---|---| | 〈 〉 | U+3008 / U+3009 | `\left( x \right)` | | 《 》 | U+300A 
  **Post-Mortem & Fix Analysis**:
  > @codex review
  > ### Summary  * Updated OMML delimiter parsing to normalize only `m:begChr` and `m:endChr` using NFKC, allowing fullwidth punctuation to reuse the existing supported LaTeX mappings without modifying equation content.  * Replaced the non-canonical U+2329/U+232A lookup entries with canonical U+3008/U+3009 angle brackets; legacy forms remain supported through normalization.  * Added regression coverage for canonical and legacy angle brackets plus fullwidth parentheses, square brackets, braces, and vertical bars.  * Committed the changes as `caca310d` (`fix(parser): normalize equivalent OMML delimiters`) and created the follow-up PR metadata titled **“Fix equivalent Unicode OMML delimiter handling.”**  **Testing**  * ✅ `uv sync --extra test` * ✅ `./scripts/test.sh tests/parser/docx/test_omml_latex_delimiters.py` — 30 passed. * ✅ `ruff check lightrag/parser/docx/omml/ommlparser.py tests/parser/docx/test_omml_latex_delimiters.py` * ✅ `git diff --check`   [View task →](https://chatgpt.com/s/cd

- **Issue #3983** (2026-09-17): **[Bug]: /context mode prefix also matches "/contextualize" and truncates the query on Ollama-compatible endpoints**
  *Symptoms*: ### Do you need to file an issue?  - [x] I have searched the existing issues and this bug is not already filed. - [x] I believe this is a legitimate bug, not just a question or feature request.  ### Describe the bug  The context mode keys in `parse_query_mode()` (`lightrag/api/routers/ollama_api.py`) are matched with `query.startswith(prefix)` and no word-boundary check. The `/context` key (unlike the space-suffixed keys such as `/local `) therefore also prefix-matches ordinary English words:  Any query beginning with "/contextualize ...", "/contexts ...", etc. is silently treated as `/context` mode, with two effects:  1. The matched fragment is cut out of the retrieval query text ("context" disappears from the user's question). 2. `only_need_context` is set to True, so no LLM answer is generated — the endpoint returns retrieved context only.  Affected paths: the RAG branches of the Ollama-compatible endpoints `/api/chat` and `/api/generate`, which call `parse_query_mode()` on the incoming prompt / last chat message.  ### Steps to reproduce  No services or API keys needed — the repro is at the function level:  python -c "from lightrag.api.routers.ollama_api import parse_query_mode; print(parse_query_mode('/contextualize the following passage'))"  Output:  ('ualize the following passage', <SearchMode.mix: 'mix'>, True, None)  For comparison, the legitimate form still works as documented:  python -c "from lightrag.api.routers.ollama_api import parse_query_mode; print(parse_quer

- **Issue #3949** (2026-09-15): **LaTeX escape damage goes unreported when a word character follows (CJK, digits, underscore)**
  *Symptoms*: ### Summary  `_WS_LATEX_SUSPECT_PATTERN` in `lightrag/utils.py` detects whitespace-class LaTeX escape damage (`"\tau"` emitted with a single backslash inside JSON decodes to a tab plus `au`). Outside dollar math the damage is deliberately not repaired — a tab there is legitimate whitespace — so this warning is the **only** trace that a LaTeX command was destroyed.  The pattern ends each residue with `\b`. Python's `re` uses Unicode word semantics, so a CJK ideograph **is** a word character and no boundary exists between `au` and `为`. Damage followed by a word character is therefore never reported.  ```python >>> from lightrag.utils import _WS_LATEX_SUSPECT_PATTERN as P >>> bool(P.search("阈值\tau为0.5"))     # CJK follows  -> silent False >>> bool(P.search("阈值\tau。"))         # punctuation  -> reported True >>> bool(P.search("the \tau2 value"))   # digit        -> silent False >>> bool(P.search("col\text_id header"))  # underscore -> silent False ```  ### Why the `\b` is there  It suppresses the case where a residue happens to start an English word: `"col1\tauthor list"` must not be reported. That is a real constraint and the reason the in-math variant cannot simply be reused — `_WS_LATEX_MATH_PATTERN` relaxes the guard to `(?![A-Za-z])`, which is correct inside a confirmed math span but would report `col\text_id` in ordinary tab-separated prose.  ### Impact  Warning-only; no data is rewritten and no behavior changes. But the information loss is real:  - A description is persist

- **Issue #3948** (2026-09-16): **Manual retry drain self-deadlocks: `/documents/texts` run holds its own enqueue reservation while DRAIN_TO_IDLE waits on `pending_enqueues == 0` (busy forever, 5 Hz log spin)**
  *Symptoms*: ### Do you need to file an issue?  - [x] I have searched the existing issues and this bug is not already filed. - [x] I believe this is a legitimate bug, not just a question or feature request.  ### Describe the bug  When `POST /documents/reprocess_failed` is requested while a processing run that was **started by a `POST /documents/texts` background task** is still working, the pipeline enters `DRAIN_TO_IDLE` and never leaves it. `busy` stays `true` indefinitely, nothing is in flight, and the log prints `All enqueued documents have been processed` every ~200 ms.  Mechanism (verified against `main` as of 2026-09-15 and v1.5.7): 1. `/documents/texts` reserves an enqueue slot, then its background task runs `pipeline_index_texts()` inside `try: … finally: await _release_enqueue_slot(rag, enqueue_token)`. 2. `pipeline_index_texts()` does `await rag.apipeline_enqueue_documents(...)` **then** `await rag.apipeline_process_enqueue_documents()` (`lightrag/api/routers/document_routes.py` ~L2773–2774). If the pipeline was idle, that call *becomes* the processing run — so the slot stays reserved for the whole run. 3. A manual retry queued mid-run freezes enqueues and switches the run to `DRAIN_TO_IDLE`. The drain decision returns `CONTINUE_DRAIN_WAIT` while `pipeline_status["pending_enqueues"] > 0` (`lightrag/pipeline.py` ~L3814–3822). 4. The only remaining reservation is the running supervisor's own token. It can only be released when the run returns, and the run cannot return until the 
  **Post-Mortem & Fix Analysis**:
  > **Claim**: I can reproduce this (the  background task holds its reservation through , so its token is counted in L3814's drain-wait). Will push a branch with an async repro test (mock storages) + minimal fix (release after enqueue, before processing) + verification that adjacent insert tests stay green. ETA: a few hours.

- **Issue #3942** (2026-09-15): **[Bug]: Milvus event-loop offloading gaps in `delete_entity_relation`, `get_by_ids`, and `get_by_id`**
  *Symptoms*: ### Do you need to file an issue?  - [x] I have searched the existing issues and this bug is not already filed. - [x] I believe this is a legitimate bug, not just a question or feature request.  ### Describe the bug  `MilvusVectorDBStorage.delete_entity_relation`, `_query_rows_by_ids` (the helper shared by `get_by_ids` and `get_vectors_by_ids`), and `get_by_id` still call the synchronous `pymilvus` SDK directly inside `async def` methods — [`lightrag/kg/milvus_impl.py:2768`](https://github.com/HKUDS/LightRAG/blob/824f33d360a63168381f6555d6139008d7f56288/lightrag/kg/milvus_impl.py#L2768) (`delete_entity_relation`, calling `self._client.query`/`self._client.delete` at [L2817](https://github.com/HKUDS/LightRAG/blob/824f33d360a63168381f6555d6139008d7f56288/lightrag/kg/milvus_impl.py#L2817) and [L2833](https://github.com/HKUDS/LightRAG/blob/824f33d360a63168381f6555d6139008d7f56288/lightrag/kg/milvus_impl.py#L2833)), [`lightrag/kg/milvus_impl.py:2902`](https://github.com/HKUDS/LightRAG/blob/824f33d360a63168381f6555d6139008d7f56288/lightrag/kg/milvus_impl.py#L2902) (`_query_rows_by_ids`, calling `self._client.query` at [L2935](https://github.com/HKUDS/LightRAG/blob/824f33d360a63168381f6555d6139008d7f56288/lightrag/kg/milvus_impl.py#L2935)), and [`lightrag/kg/milvus_impl.py:2962`](https://github.com/HKUDS/LightRAG/blob/824f33d360a63168381f6555d6139008d7f56288/lightrag/kg/milvus_impl.py#L2962) (`get_by_id`, calling `self._client.query` at [L2980](https://github.com/HKUDS/LightRAG/blob

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

### Incident Patch 1: `2ff9db50` (2026-09-26)
**Commit Message**: ✅ test(api): cover both auth modes in whitelist prefix tests

- parametrize whitelist fixture over api-key-only and password-and-api-key modes
- patch cached auth_configured value to assert correct 401/403 status
- treat 403 as an auth failure alongside 401 in whitelisted route checks

**File**: `tests/api/test_path_prefixes.py` (modified, +15/-9)
```diff
@@ -774,11 +774,13 @@ class TestWhitelistUnderApiPrefix:
     the routers' own auth dependency all come together.
     """
 
-    @pytest.fixture
-    def _default_whitelist(self, monkeypatch):
-        """Pin the shipped default so a developer-local WHITELIST_PATHS in .env
-        (already baked into the module-level patterns at import time) cannot
-        change what these tests assert."""
+    @pytest.fixture(params=[False, True], ids=["api-key-only", "password-and-api-key"])
+    def _default_whitelist(self, monkeypatch, request):
+        """Pin the shipped whitelist and both auth modes, independent of .env.
+
+        Auth state is cached at import time; patch the cached value as well.
+        Return the missing-credentials status for the selected auth mode.
+        """
         original_argv = sys.argv.copy()
         try:
             # config resolves its args on first attribute access; importing under
@@ -791,6 +793,8 @@ def _default_whitelist(self, monkeypatch):
         monkeypatch.setattr(
             utils_api, "whitelist_patterns", [("/health", False), ("/api", True)]
         )
+        monkeypatch.setattr(utils_api, "auth_configured", request.param)
+        return 401 if request.param else 403
 
     @staticmethod
     def _args_with_prefix(prefix: str):
@@ -835,7 +839,9 @@ def test_destructive_route_requires_auth_under_a_colliding_prefix(
             client = TestClient(create_app(_colliding_prefix_args))
             prefix = "" if mode == "strip" else "/api/v1"
 
-            assert client.delete(f"{prefix}/documents").status_code == 401
+            assert (
+                client.delete(f"{prefix}/documents").status_code == _default_whitelist
+            )
 
     @pytest.mark.parametrize("mode", ["verbatim", "strip"])
     def test_whitelisted_routes_stay_open_under_a_prefix(
@@ -845,7 +851,7 @@ def test_whitelisted_routes_stay_open_under_a_prefix(
         Ollama-compatible routes must keep their documented exemption.
 
         Both answered 401 under this prefix before the fix. The assertion is
-        "not 401" rather than 200 because these handlers reach further into a
+        "neither 401 nor 403" rather than 200 because these handlers reach into a
         LightRAG that is only a MagicMock here: /health reads shared storage that
         no test initializes, and /api/tags feeds mock attributes to a Pydantic
         response model. Both therefore fail *after* the auth gate, which is why
@@ -862,7 +868,7 @@ def test_whitelisted_routes_stay_open_under_a_prefix(
             )
             prefix = "" if mode == "strip" else "/site01"
 
-            assert client.get(f"{prefix}/health").status_code != 401
+            assert client.get(f"{prefix}/health").status_code not in (401, 403)
             # GET, matching the real registration; GET /api/chat would be a 405
             # from the router without the dependency ever running.
-            assert client.get(f"{prefix}/api/tags").status_code != 401
+            assert client.get(f"{prefix}/api/tags").status_code not in (401, 403)
```

---

### Incident Patch 2: `186d96ce` (2026-09-25)
**Commit Message**: Merge pull request #4100 from danielaskdd/fix/table-row-trim-bisect

fix(multimodal): bisect row count when trimming oversized tables

**File**: `lightrag/multimodal_context.py` (modified, +61/-20)
```diff
@@ -267,6 +267,33 @@ def _char_trim_trailing(text: str, max_tokens: int, tokenizer: Tokenizer) -> str
 # ---------------------------------------------------------------------------
 
 
+def _largest_fitting_row_prefix(
+    row_count: int,
+    build,
+    max_tokens: int,
+    tokenizer: Tokenizer,
+) -> str | None:
+    """Return ``build(k)`` for the largest ``k`` in ``[1, row_count - 1]`` that fits.
+
+    ``build(k)`` renders a table holding ``k`` rows; its token count grows
+    with ``k``, so the search bisects instead of probing every ``k``: each
+    probe re-serializes and re-tokenizes the whole candidate, and a linear
+    scan over a large table is quadratic.  Bisection relies on that growth
+    being monotonic, the same tokenizer assumption ``_char_trim_trailing``
+    makes over characters.  Returns ``None`` when not even one row fits.
+    """
+    lo, hi = 0, row_count - 1
+    best: str | None = None
+    while lo < hi:
+        mid = (lo + hi + 1) // 2
+        candidate = build(mid)
+        if _count_tokens(tokenizer, candidate) <= max_tokens:
+            lo, best = mid, candidate
+        else:
+            hi = mid - 1
+    return best
+
+
 def _row_trim_table_leading(
     tag_text: str, max_tokens: int, tokenizer: Tokenizer
 ) -> str | None:
@@ -288,14 +315,18 @@ def _row_trim_table_leading(
         if not parsed:
             return None
         attrs_str, rows = parsed
-        for k in range(len(rows) - 1, 0, -1):
-            candidate = (
+        candidate = _largest_fitting_row_prefix(
+            len(rows),
+            lambda k: (
                 f"<table {attrs_str}>"
                 f"{json.dumps(rows[-k:], ensure_ascii=False)}"
                 f"</table>"
-            )
-            if _count_tokens(tokenizer, candidate) <= max_tokens:
-                return candidate
+            ),
+            max_tokens,
+            tokenizer,
+        )
+        if candidate is not None:
+            return candidate
         return _char_fallback_json_table(
             attrs_str,
             json.dumps(rows[-1], ensure_ascii=False) if rows else body,
@@ -307,11 +338,14 @@ def _row_trim_table_leading(
         rows = split_html_rows(body)
         if not rows:
             return None
-        for k in range(len(rows) - 1, 0, -1):
-            inner = serialize_html_rows(rows[-k:])
-            candidate = f"<table {attrs}>{inner}</table>"
-            if _count_tokens(tokenizer, candidate) <= max_tokens:
-                return candidate
+        candidate = _largest_fitting_row_prefix(
+            len(rows),
+            lambda k: f"<table {attrs}>{serialize_html_rows(rows[-k:])}</table>",
+            max_tokens,
+            tokenizer,
+        )
+        if candidate is not None:
+            return candidate
         return _char_fallback_html_table(
             attrs,
             rows[-1][1] if rows else body,
@@ -337,12 +371,16 @@ def _row_trim_table_trailing(
         if not parsed:
             return None
         attrs_str, rows = parsed
-        for k in range(len(rows) - 1, 0, -1):
-            candidate = (
+        candidate = _largest_fitting_row_prefix(
+            len(rows),
+            lambda k: (
                 f"<table {attrs_str}>{json.dumps(rows[:k], ensure_ascii=False)}</table>"
-            )
-            if _count_tokens(tokenizer, candidate) <= max_tokens:
-                return candidate
+            ),
+            max_tokens,
+            tokenizer,
+        )
+        if candidate is not None:
+            return candidate
         return _char_fallback_json_table(
             attrs_str,
             json.dumps(rows[0], ensure_ascii=False) if rows else body,
@@ -354,11 +392,14 @@ def _row_trim_table_trailing(
         rows = split_html_rows(body)
         if not rows:
             return None
-        for k in range(len(rows) - 1, 0, -1):
-            inner = serialize_html_rows(rows[:k])
-            candidate = f"<table {attrs}>{inner}</table>"
-   
```

**File**: `tests/pipeline/test_multimodal_content_truncation.py` (modified, +67/-0)
```diff
@@ -227,3 +227,70 @@ def test_table_budget_too_small_for_wrapper_avoids_partial_tags():
     # Never spend the budget on a broken opening <table ... without </table>.
     assert not (out.lstrip().startswith("<table") and "</table>" not in out)
     assert _MARKER_RE.search(out) is None
+
+
+class _CountingCharTokenizer(_CharTokenizer):
+    def __init__(self) -> None:
+        self.calls = 0
+
+    def encode(self, content: str):
+        self.calls += 1
+        return super().encode(content)
+
+
+@pytest.mark.offline
+@pytest.mark.parametrize("fmt", ["json", "html"])
+@pytest.mark.parametrize("keep", ["head", "tail"])
+def test_row_trim_keeps_most_rows_with_logarithmic_probes(fmt, keep):
+    """Row trimming picks the largest fitting row count without probing
+    every count: a linear scan re-tokenized the whole candidate per row,
+    which took ~25s for an 8000-row table.  The probe count is asserted
+    instead of a duration so the bound holds on any runner.  Bisection over
+    4000 rows needs ~13 probes plus the entry check; the ceiling of 40
+    leaves room for small helper changes while staying two orders of
+    magnitude below the ~2700 probes a linear scan makes."""
+    from lightrag.multimodal_context import (
+        _row_trim_table_leading,
+        _row_trim_table_trailing,
+        parse_table_tag,
+        serialize_html_rows,
+        split_html_rows,
+    )
+
+    row_count = 4000
+    if fmt == "json":
+        rows = [[f"r{i}c0", f"r{i}c1"] for i in range(row_count)]
+        attrs = 'id="t" format="json"'
+        content = f"<table {attrs}>{json.dumps(rows)}</table>"
+    else:
+        rows_html = "".join(
+            f"<tr><td>r{i}c0</td><td>r{i}c1</td></tr>" for i in range(row_count)
+        )
+        attrs = 'id="t" format="html"'
+        content = f"<table {attrs}>{rows_html}</table>"
+
+    counting = _CountingCharTokenizer()
+    tok = Tokenizer(model_name="char", tokenizer=counting)
+    budget = len(content) // 3
+    trim = _row_trim_table_trailing if keep == "head" else _row_trim_table_leading
+    out = trim(content, budget, tok)
+
+    assert out is not None
+    assert len(out) <= budget
+    assert counting.calls < 40, f"{counting.calls} tokenizer calls"
+
+    # Maximality: one more row from the same side would not fit.
+    if fmt == "json":
+        _, kept = parse_table_tag(out)
+        k = len(kept)
+        more = rows[: k + 1] if keep == "head" else rows[-(k + 1) :]
+        bigger = f"<table {attrs}>{json.dumps(more, ensure_ascii=False)}</table>"
+    else:
+        all_rows = split_html_rows(rows_html)
+        k = len(split_html_rows(out[out.index(">") + 1 : -len("</table>")]))
+        more = all_rows[: k + 1] if keep == "head" else all_rows[-(k + 1) :]
+        bigger = f"<table {attrs}>{serialize_html_rows(more)}</table>"
+    assert 0 < k < row_count
+    assert len(bigger) > budget
+    edge = "r0c0" if keep == "head" else f"r{row_count - 1}c0"
+    assert edge in out
```

---

### Incident Patch 3: `1576936a` (2026-09-25)
**Commit Message**: Merge pull request #4095 from danielaskdd/fix/issue-4088-flaky-tests

test: remove load sensitivity from cancellation and fork probes

**File**: `tests/llm/hf_impl/_fork_probe.py` (modified, +57/-4)
```diff
@@ -10,10 +10,24 @@
 which cannot be promoted to an error (it is emitted after fork() has already
 returned), so in-process the warning could only ever be filtered away.
 
-Here the process is single-threaded, which is also what the scenario under
-test actually looks like -- a gunicorn pre-fork master imports the app and
-forks. That lets the warning be asserted ABSENT rather than suppressed: its
-presence means something made this process multi-threaded and the probe fails.
+Here the process is single-threaded, which is the precondition the at-fork
+reset under test is about. That lets the warning be asserted ABSENT rather
+than suppressed: its presence means something made this process
+multi-threaded and the probe fails.
+
+"Single-threaded" includes native threads, which threading.enumerate() cannot
+see and CPython 3.12+ counts from the OS when it decides to warn. Importing
+lightrag.llm.hf pulls in numpy, whose BLAS runtime starts one OS thread per
+core at import. OpenBLAS normally stops those threads in its own pre-fork
+handler, so they are not a confirmed cause of the warning; but they are
+unrelated to the executor reset, and no pool at all is simpler to reason about
+than one that must be torn down in time. main() therefore caps the common
+runtimes at one thread (_NATIVE_POOL_CAPS) before anything imports numpy. The
+caps isolate the check; they do not model production -- a real pre-fork master
+that has not set them forks with those pools running.
+
+If the warning ever fires, the stderr report adds the OS threads that existed
+before fork(), by kernel name, to identify the native pool responsible.
 
 Exit code 0 means every check passed; anything else is a failure explained on
 stderr.
@@ -27,6 +41,36 @@
 import types
 import warnings
 
+# Set, not setdefault: a runner exporting OMP_NUM_THREADS=4 must not reopen
+# the pools. GOTO_NUM_THREADS covers older OpenBLAS builds; RAYON_NUM_THREADS
+# covers Rust-backed extensions such as tokenizers.
+_NATIVE_POOL_CAPS = {
+    "OMP_NUM_THREADS": "1",
+    "OPENBLAS_NUM_THREADS": "1",
+    "GOTO_NUM_THREADS": "1",
+    "MKL_NUM_THREADS": "1",
+    "NUMEXPR_NUM_THREADS": "1",
+    "VECLIB_MAXIMUM_THREADS": "1",
+    "BLIS_NUM_THREADS": "1",
+    "RAYON_NUM_THREADS": "1",
+}
+
+
+def _os_thread_names() -> list[str] | None:
+    # Linux only; elsewhere the diagnostic is simply omitted.
+    try:
+        tids = os.listdir("/proc/self/task")
+    except OSError:
+        return None
+    names = []
+    for tid in tids:
+        try:
+            with open(f"/proc/self/task/{tid}/comm", encoding="utf-8") as f:
+                names.append(f.read().strip())
+        except OSError:
+            names.append(f"<tid {tid} gone>")
+    return sorted(names)
+
 
 def _install_stubs() -> None:
     # Inlined rather than reused from the test module: the helper there drives
@@ -60,6 +104,9 @@ def __exit__(self, *exc):
 
 
 def main() -> int:
+    # Must run before _install_stubs() and the lightrag import below: the
+    # runtimes read these once, when numpy is first imported.
+    os.environ.update(_NATIVE_POOL_CAPS)
     _install_stubs()
 
     import lightrag.llm.hf as hf
@@ -74,6 +121,7 @@ def main() -> int:
         failures.append("parent: _get_hf_inference_executor() left the slot empty")
 
     alive = sorted(t.name for t in threading.enumerate())
+    os_threads = _os_thread_names()
     if alive != ["MainThread"]:
         failures.append(f"parent: expected a single thread before fork, got {alive}")
 
@@ -100,6 +148,11 @@ def main() -> int:
 
     for warning in caught:
         failures.append(f"parent: fork() warned -- {warning.message}")
+    if caught and os_threads is not None:
+        failures.append(
+            f"parent: {len(os_threads)} OS thread(s) before fork {os_threads} "
+            f"for Python threads {alive}; any extra is a native pool"
+        )
 
     for line in failures:
         print(line, file=sys.stderr)
```

**File**: `tests/llm/hf_impl/test_hf_off_event_loop.py` (modified, +5/-3)
```diff
@@ -97,10 +97,12 @@ def test_inference_executor_resets_after_fork():
     must reset both so the child lazily builds a fresh pair.
 
     The fork runs in a subprocess, not here: a fresh single-threaded
-    interpreter is both what a pre-fork master actually looks like and the
-    only place CPython's multi-threaded-fork warning can be asserted absent
-    instead of filtered away. _fork_probe.py explains the rest."""
+    interpreter is the only place CPython's multi-threaded-fork warning can
+    be asserted absent instead of filtered away. _fork_probe.py explains the
+    rest, including the native thread-pool caps that keep it single-threaded."""
     probe = Path(__file__).with_name("_fork_probe.py")
+    # The probe caps the BLAS/OpenMP pools itself, so running it directly
+    # behaves the same as running it from here.
     result = subprocess.run(
         [sys.executable, str(probe)],
         capture_output=True,
```

**File**: `tests/pipeline/test_pipeline_cancellation.py` (modified, +93/-66)
```diff
@@ -22,7 +22,6 @@
 import asyncio
 import json
 import logging
-import time
 from datetime import datetime, timezone
 from pathlib import Path
 from typing import Any
@@ -165,25 +164,46 @@ async def _run_worker_until_drained(
     worker_coro_factory,
     queue: asyncio.Queue,
     *,
-    timeout: float = 2.0,
+    timeout: float = 15.0,
 ) -> None:
     """Spin up the worker, await q.join(), then cancel the worker — same
-    teardown sequence as ``_run_pipeline_batch``."""
+    teardown sequence as ``_run_pipeline_batch``.
+
+    The join is raced against the worker task: a worker that dies stops
+    calling ``task_done()``, so waiting on the join alone would sit out the
+    whole timeout and then report a bare ``TimeoutError`` instead of the
+    worker's own exception. ``timeout`` is only a hang guard for a worker
+    that stays alive but never drains; a passing run returns as soon as the
+    queue is empty, so its size costs nothing."""
     worker = asyncio.create_task(worker_coro_factory())
+    join_task = asyncio.create_task(queue.join())
     try:
-        await asyncio.wait_for(queue.join(), timeout=timeout)
+        done, _ = await asyncio.wait(
+            {worker, join_task},
+            timeout=timeout,
+            return_when=asyncio.FIRST_COMPLETED,
+        )
+        if worker in done:
+            # Re-raises the worker's exception; a clean return is still a bug
+            # because the worker loop is supposed to run until cancelled.
+            worker.result()
+            raise AssertionError("worker exited before draining its queue")
+        if join_task not in done:
+            raise AssertionError(f"queue did not drain within {timeout}s hang guard")
     finally:
-        worker.cancel()
-        await asyncio.gather(worker, return_exceptions=True)
+        for task in (join_task, worker):
+            task.cancel()
+        await asyncio.gather(join_task, worker, return_exceptions=True)
 
 
 @pytest.mark.asyncio
 async def test_parse_worker_drains_queue_when_cancelled_before_start(
     tmp_path, monkeypatch
 ):
     """Cancellation set BEFORE the worker pulls any item: parser must not
-    run, every queued doc is FAILED with a friendly message, q.join()
-    returns quickly."""
+    run, every queued doc is FAILED with a friendly message, and q.join()
+    returns (bounded by the drain helper's hang guard, not a latency
+    assertion)."""
     rag = _build_rag(tmp_path)
     await rag.initialize_storages()
     try:
@@ -216,14 +236,11 @@ async def test_parse_worker_drains_queue_when_cancelled_before_start(
 
         pipeline_status["cancellation_requested"] = True
 
-        start = time.monotonic()
         await _run_worker_until_drained(
             lambda: rag._parse_worker("native", ctx.parse_queues["native"], ctx),
             ctx.parse_queues["native"],
         )
-        elapsed = time.monotonic() - start
 
-        assert elapsed < 1.0, f"queue drain should be fast, took {elapsed:.2f}s"
         assert get_parser_spy.call_count == 0
 
         cancel_messages = [
@@ -311,11 +328,27 @@ async def _submit(_prompt, **_kwargs):
                 ingress=await get_pipeline_ingress(rag.workspace),
             )
         )
-        await asyncio.wait_for(submit_started.wait(), timeout=1.0)
+        # Both bounds are hang guards, not latency assertions: a green run
+        # returns as soon as the event fires / the batch finishes. The first
+        # wait races the batch so a batch that fails before reaching the LLM
+        # surfaces its own exception instead of a timeout.
+        started = asyncio.create_task(submit_started.wait())
+        done, _ = await asyncio.wait(
+            {started, batch}, timeout=15.0, return_when=asyncio.FIRST_COMPLETED
+        )
+        if started not in done:
+            started.cancel()
+            await asyncio.gather(started, return_exceptions=True)
+            if batch in done:
+                batch.result()
+                raise As
```

---

### Incident Patch 4: `1d725c4f` (2026-09-25)
**Commit Message**: fix(multimodal): bisect row count when trimming oversized tables

_row_trim_table_leading/_trailing probed every row count from len-1
downward, re-serializing and re-tokenizing the whole candidate on each
probe. An 8000-row JSON table needed 7061 tokenizer calls (~25s with a
trivial char tokenizer, far longer with tiktoken) before the EXTRACT
prompt could be built.

Bisect the row count instead, in all four JSON/HTML x head/tail paths,
through one helper. Token count grows with the row count, the same
monotonicity _char_trim_trailing already relies on over characters, so
the chosen row count is unchanged; the fallback paths when no row fits
are untouched.

The regression test pins both maximality (one more row would not fit)
and a logarithmic probe count rather than a duration.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `lightrag/multimodal_context.py` (modified, +61/-20)
```diff
@@ -267,6 +267,33 @@ def _char_trim_trailing(text: str, max_tokens: int, tokenizer: Tokenizer) -> str
 # ---------------------------------------------------------------------------
 
 
+def _largest_fitting_row_prefix(
+    row_count: int,
+    build,
+    max_tokens: int,
+    tokenizer: Tokenizer,
+) -> str | None:
+    """Return ``build(k)`` for the largest ``k`` in ``[1, row_count - 1]`` that fits.
+
+    ``build(k)`` renders a table holding ``k`` rows; its token count grows
+    with ``k``, so the search bisects instead of probing every ``k``: each
+    probe re-serializes and re-tokenizes the whole candidate, and a linear
+    scan over a large table is quadratic.  Bisection relies on that growth
+    being monotonic, the same tokenizer assumption ``_char_trim_trailing``
+    makes over characters.  Returns ``None`` when not even one row fits.
+    """
+    lo, hi = 0, row_count - 1
+    best: str | None = None
+    while lo < hi:
+        mid = (lo + hi + 1) // 2
+        candidate = build(mid)
+        if _count_tokens(tokenizer, candidate) <= max_tokens:
+            lo, best = mid, candidate
+        else:
+            hi = mid - 1
+    return best
+
+
 def _row_trim_table_leading(
     tag_text: str, max_tokens: int, tokenizer: Tokenizer
 ) -> str | None:
@@ -288,14 +315,18 @@ def _row_trim_table_leading(
         if not parsed:
             return None
         attrs_str, rows = parsed
-        for k in range(len(rows) - 1, 0, -1):
-            candidate = (
+        candidate = _largest_fitting_row_prefix(
+            len(rows),
+            lambda k: (
                 f"<table {attrs_str}>"
                 f"{json.dumps(rows[-k:], ensure_ascii=False)}"
                 f"</table>"
-            )
-            if _count_tokens(tokenizer, candidate) <= max_tokens:
-                return candidate
+            ),
+            max_tokens,
+            tokenizer,
+        )
+        if candidate is not None:
+            return candidate
         return _char_fallback_json_table(
             attrs_str,
             json.dumps(rows[-1], ensure_ascii=False) if rows else body,
@@ -307,11 +338,14 @@ def _row_trim_table_leading(
         rows = split_html_rows(body)
         if not rows:
             return None
-        for k in range(len(rows) - 1, 0, -1):
-            inner = serialize_html_rows(rows[-k:])
-            candidate = f"<table {attrs}>{inner}</table>"
-            if _count_tokens(tokenizer, candidate) <= max_tokens:
-                return candidate
+        candidate = _largest_fitting_row_prefix(
+            len(rows),
+            lambda k: f"<table {attrs}>{serialize_html_rows(rows[-k:])}</table>",
+            max_tokens,
+            tokenizer,
+        )
+        if candidate is not None:
+            return candidate
         return _char_fallback_html_table(
             attrs,
             rows[-1][1] if rows else body,
@@ -337,12 +371,16 @@ def _row_trim_table_trailing(
         if not parsed:
             return None
         attrs_str, rows = parsed
-        for k in range(len(rows) - 1, 0, -1):
-            candidate = (
+        candidate = _largest_fitting_row_prefix(
+            len(rows),
+            lambda k: (
                 f"<table {attrs_str}>{json.dumps(rows[:k], ensure_ascii=False)}</table>"
-            )
-            if _count_tokens(tokenizer, candidate) <= max_tokens:
-                return candidate
+            ),
+            max_tokens,
+            tokenizer,
+        )
+        if candidate is not None:
+            return candidate
         return _char_fallback_json_table(
             attrs_str,
             json.dumps(rows[0], ensure_ascii=False) if rows else body,
@@ -354,11 +392,14 @@ def _row_trim_table_trailing(
         rows = split_html_rows(body)
         if not rows:
             return None
-        for k in range(len(rows) - 1, 0, -1):
-            inner = serialize_html_rows(rows[:k])
-            candidate = f"<table {attrs}>{inner}</table>"
-   
```

**File**: `tests/pipeline/test_multimodal_content_truncation.py` (modified, +67/-0)
```diff
@@ -227,3 +227,70 @@ def test_table_budget_too_small_for_wrapper_avoids_partial_tags():
     # Never spend the budget on a broken opening <table ... without </table>.
     assert not (out.lstrip().startswith("<table") and "</table>" not in out)
     assert _MARKER_RE.search(out) is None
+
+
+class _CountingCharTokenizer(_CharTokenizer):
+    def __init__(self) -> None:
+        self.calls = 0
+
+    def encode(self, content: str):
+        self.calls += 1
+        return super().encode(content)
+
+
+@pytest.mark.offline
+@pytest.mark.parametrize("fmt", ["json", "html"])
+@pytest.mark.parametrize("keep", ["head", "tail"])
+def test_row_trim_keeps_most_rows_with_logarithmic_probes(fmt, keep):
+    """Row trimming picks the largest fitting row count without probing
+    every count: a linear scan re-tokenized the whole candidate per row,
+    which took ~25s for an 8000-row table.  The probe count is asserted
+    instead of a duration so the bound holds on any runner.  Bisection over
+    4000 rows needs ~13 probes plus the entry check; the ceiling of 40
+    leaves room for small helper changes while staying two orders of
+    magnitude below the ~2700 probes a linear scan makes."""
+    from lightrag.multimodal_context import (
+        _row_trim_table_leading,
+        _row_trim_table_trailing,
+        parse_table_tag,
+        serialize_html_rows,
+        split_html_rows,
+    )
+
+    row_count = 4000
+    if fmt == "json":
+        rows = [[f"r{i}c0", f"r{i}c1"] for i in range(row_count)]
+        attrs = 'id="t" format="json"'
+        content = f"<table {attrs}>{json.dumps(rows)}</table>"
+    else:
+        rows_html = "".join(
+            f"<tr><td>r{i}c0</td><td>r{i}c1</td></tr>" for i in range(row_count)
+        )
+        attrs = 'id="t" format="html"'
+        content = f"<table {attrs}>{rows_html}</table>"
+
+    counting = _CountingCharTokenizer()
+    tok = Tokenizer(model_name="char", tokenizer=counting)
+    budget = len(content) // 3
+    trim = _row_trim_table_trailing if keep == "head" else _row_trim_table_leading
+    out = trim(content, budget, tok)
+
+    assert out is not None
+    assert len(out) <= budget
+    assert counting.calls < 40, f"{counting.calls} tokenizer calls"
+
+    # Maximality: one more row from the same side would not fit.
+    if fmt == "json":
+        _, kept = parse_table_tag(out)
+        k = len(kept)
+        more = rows[: k + 1] if keep == "head" else rows[-(k + 1) :]
+        bigger = f"<table {attrs}>{json.dumps(more, ensure_ascii=False)}</table>"
+    else:
+        all_rows = split_html_rows(rows_html)
+        k = len(split_html_rows(out[out.index(">") + 1 : -len("</table>")]))
+        more = all_rows[: k + 1] if keep == "head" else all_rows[-(k + 1) :]
+        bigger = f"<table {attrs}>{serialize_html_rows(more)}</table>"
+    assert 0 < k < row_count
+    assert len(bigger) > budget
+    edge = "r0c0" if keep == "head" else f"r{row_count - 1}c0"
+    assert edge in out
```

---

### Incident Patch 5: `1e7fd952` (2026-09-25)
**Commit Message**: test: race cancellation hang guards against the task under test

The drain helper waited on queue.join() alone, so a worker that raised
stopped calling task_done(), sat out the whole timeout and reported a bare
TimeoutError while the worker's exception was swallowed by the teardown
gather. Race the join against the worker and re-raise its exception, and
do the same for the in-flight native parser test's first wait against the
batch task.

With failures surfacing immediately, the remaining bounds are pure hang
guards: raise the 1s/2s ceilings to 15s, matching the in-flight VLM tests.
A green run returns as soon as the queue drains, so this adds no runtime.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `tests/pipeline/test_pipeline_cancellation.py` (modified, +43/-7)
```diff
@@ -164,16 +164,36 @@ async def _run_worker_until_drained(
     worker_coro_factory,
     queue: asyncio.Queue,
     *,
-    timeout: float = 2.0,
+    timeout: float = 15.0,
 ) -> None:
     """Spin up the worker, await q.join(), then cancel the worker — same
-    teardown sequence as ``_run_pipeline_batch``."""
+    teardown sequence as ``_run_pipeline_batch``.
+
+    The join is raced against the worker task: a worker that dies stops
+    calling ``task_done()``, so waiting on the join alone would sit out the
+    whole timeout and then report a bare ``TimeoutError`` instead of the
+    worker's own exception. ``timeout`` is only a hang guard for a worker
+    that stays alive but never drains; a passing run returns as soon as the
+    queue is empty, so its size costs nothing."""
     worker = asyncio.create_task(worker_coro_factory())
+    join_task = asyncio.create_task(queue.join())
     try:
-        await asyncio.wait_for(queue.join(), timeout=timeout)
+        done, _ = await asyncio.wait(
+            {worker, join_task},
+            timeout=timeout,
+            return_when=asyncio.FIRST_COMPLETED,
+        )
+        if worker in done:
+            # Re-raises the worker's exception; a clean return is still a bug
+            # because the worker loop is supposed to run until cancelled.
+            worker.result()
+            raise AssertionError("worker exited before draining its queue")
+        if join_task not in done:
+            raise AssertionError(f"queue did not drain within {timeout}s hang guard")
     finally:
-        worker.cancel()
-        await asyncio.gather(worker, return_exceptions=True)
+        for task in (join_task, worker):
+            task.cancel()
+        await asyncio.gather(join_task, worker, return_exceptions=True)
 
 
 @pytest.mark.asyncio
@@ -308,11 +328,27 @@ async def _submit(_prompt, **_kwargs):
                 ingress=await get_pipeline_ingress(rag.workspace),
             )
         )
-        await asyncio.wait_for(submit_started.wait(), timeout=1.0)
+        # Both bounds are hang guards, not latency assertions: a green run
+        # returns as soon as the event fires / the batch finishes. The first
+        # wait races the batch so a batch that fails before reaching the LLM
+        # surfaces its own exception instead of a timeout.
+        started = asyncio.create_task(submit_started.wait())
+        done, _ = await asyncio.wait(
+            {started, batch}, timeout=15.0, return_when=asyncio.FIRST_COMPLETED
+        )
+        if started not in done:
+            started.cancel()
+            await asyncio.gather(started, return_exceptions=True)
+            if batch in done:
+                batch.result()
+                raise AssertionError("batch finished before the parser LLM call")
+            batch.cancel()
+            await asyncio.gather(batch, return_exceptions=True)
+            raise AssertionError("parser LLM call never started within hang guard")
         async with pipeline_status_lock:
             pipeline_status["cancellation_requested"] = True
 
-        await asyncio.wait_for(batch, timeout=2.0)
+        await asyncio.wait_for(batch, timeout=15.0)
         row = await rag.doc_status.get_by_id(doc_id)
         assert row is not None
         assert row["status"] == DocStatus.FAILED.value
```

---

### Incident Patch 6: `6702eea9` (2026-09-22)
**Commit Message**: Merge pull request #3957 from Shizoqua/fix/opensearch-cosine-score-conversion

fix(opensearch): compare cosine threshold against raw similarity

**File**: `lightrag/kg/opensearch_impl.py` (modified, +19/-10)
```diff
@@ -6922,24 +6922,33 @@ async def query(
             response = await self.client.search(
                 index=self._index_name, body=search_body
             )
+            hits = response["hits"]["hits"]
             results = []
-            for hit in response["hits"]["hits"]:
-                # OpenSearch k-NN with lucene engine and cosinesimil space type
-                # returns scores that can be used directly as similarity measure.
-                score = hit["_score"]
-
-                if score >= self.cosine_better_than_threshold:
+            cosine_similarities = []
+            for hit in hits:
+                # OpenSearch k-NN with the lucene engine and cosinesimil space
+                # type scores each hit as (1 + cosine_similarity) / 2, in
+                # [0, 1] -- not raw cosine similarity (Lucene's
+                # VectorSimilarityFunction.COSINE requires non-negative
+                # scores, so the plugin rescales rather than returning the
+                # native [-1, 1] range). Convert back before comparing to
+                # cosine_better_than_threshold, which every other backend
+                # compares against raw cosine similarity.
+                cosine_similarity = 2 * hit["_score"] - 1
+                cosine_similarities.append(cosine_similarity)
+
+                if cosine_similarity >= self.cosine_better_than_threshold:
                     doc = hit["_source"]
                     doc["id"] = hit["_id"]
-                    doc["distance"] = score
+                    doc["distance"] = cosine_similarity
                     results.append(doc)
             logger.info(
                 f"[{self.workspace}] Vector query on {self._index_name}: "
                 f"top_k={top_k}, threshold={self.cosine_better_than_threshold}, "
-                f"total_hits={len(response['hits']['hits'])}, "
+                f"total_hits={len(hits)}, "
                 f"passed_filter={len(results)}, "
-                f"score_range=[{min((h['_score'] for h in response['hits']['hits']), default=0):.4f}, "
-                f"{max((h['_score'] for h in response['hits']['hits']), default=0):.4f}]"
+                f"cosine_range=[{min(cosine_similarities, default=0):.4f}, "
+                f"{max(cosine_similarities, default=0):.4f}]"
             )
             return results
         except OpenSearchException as e:
```

**File**: `tests/kg/opensearch_impl/test_opensearch_storage.py` (modified, +42/-4)
```diff
@@ -4713,7 +4713,9 @@ async def test_upsert_generates_embeddings(
     async def test_query_cosine_score_conversion(
         self, global_config, embed_func, mock_client
     ):
-        """Test that scores are used directly and threshold filtering works."""
+        """lucene/cosinesimil hits score as (1 + cosine_similarity) / 2, so an
+        engine score of 0.85 must convert back to a raw cosine similarity of
+        0.7, not be used directly."""
         mock_client.search = AsyncMock(
             return_value={
                 "hits": {
@@ -4736,16 +4738,18 @@ async def test_query_cosine_score_conversion(
         with patch.object(ClientManager, "get_client", return_value=mock_client):
             s = self._make(global_config, embed_func)
             await s.initialize()
-            results = await s.query("test", top_k=5)
+            with patch("lightrag.kg.opensearch_impl.logger.info") as mock_log:
+                results = await s.query("test", top_k=5)
             assert len(results) == 1
-            assert results[0]["distance"] == 0.85
+            assert results[0]["distance"] == pytest.approx(0.7)
+            assert "cosine_range=[0.7000, 0.7000]" in mock_log.call_args.args[0]
 
     @pytest.mark.asyncio
     async def test_query_filters_below_threshold(
         self, global_config, embed_func, mock_client
     ):
         """Low scores should be filtered out."""
-        # score 0.15 < threshold 0.2
+        # engine score 0.15 -> cosine similarity 2*0.15-1 = -0.7 < threshold 0.2
         mock_client.search = AsyncMock(
             return_value={
                 "hits": {
@@ -4771,6 +4775,40 @@ async def test_query_filters_below_threshold(
             results = await s.query("test", top_k=5)
             assert len(results) == 0
 
+    @pytest.mark.asyncio
+    async def test_query_rejects_unconverted_score_that_would_have_passed(
+        self, global_config, embed_func, mock_client
+    ):
+        """Regression: comparing the raw engine score against the threshold
+        (instead of converting to cosine similarity first) let a weakly- or
+        negatively-correlated match through. Engine score 0.3 satisfies the
+        default 0.2 threshold directly, but its true cosine similarity is
+        2*0.3-1 = -0.4, which must be filtered out."""
+        mock_client.search = AsyncMock(
+            return_value={
+                "hits": {
+                    "hits": [
+                        {
+                            "_id": "v1",
+                            "_score": 0.3,
+                            "_source": {"content": "unrelated"},
+                        },
+                    ],
+                    "total": {"value": 1},
+                },
+                "aggregations": {
+                    "status_counts": {"buckets": []},
+                    "src": {"buckets": []},
+                    "tgt": {"buckets": []},
+                },
+            }
+        )
+        with patch.object(ClientManager, "get_client", return_value=mock_client):
+            s = self._make(global_config, embed_func)
+            await s.initialize()
+            results = await s.query("test", top_k=5)
+            assert len(results) == 0
+
     @pytest.mark.asyncio
     async def test_query_with_provided_embedding(
         self, global_config, embed_func, mock_client
```

---

### Incident Patch 7: `e12a687b` (2026-09-22)
**Commit Message**: fix(opensearch): log raw cosine score range

**File**: `lightrag/kg/opensearch_impl.py` (modified, +7/-4)
```diff
@@ -6687,8 +6687,10 @@ async def query(
             response = await self.client.search(
                 index=self._index_name, body=search_body
             )
+            hits = response["hits"]["hits"]
             results = []
-            for hit in response["hits"]["hits"]:
+            cosine_similarities = []
+            for hit in hits:
                 # OpenSearch k-NN with the lucene engine and cosinesimil space
                 # type scores each hit as (1 + cosine_similarity) / 2, in
                 # [0, 1] -- not raw cosine similarity (Lucene's
@@ -6698,6 +6700,7 @@ async def query(
                 # cosine_better_than_threshold, which every other backend
                 # compares against raw cosine similarity.
                 cosine_similarity = 2 * hit["_score"] - 1
+                cosine_similarities.append(cosine_similarity)
 
                 if cosine_similarity >= self.cosine_better_than_threshold:
                     doc = hit["_source"]
@@ -6707,10 +6710,10 @@ async def query(
             logger.info(
                 f"[{self.workspace}] Vector query on {self._index_name}: "
                 f"top_k={top_k}, threshold={self.cosine_better_than_threshold}, "
-                f"total_hits={len(response['hits']['hits'])}, "
+                f"total_hits={len(hits)}, "
                 f"passed_filter={len(results)}, "
-                f"score_range=[{min((h['_score'] for h in response['hits']['hits']), default=0):.4f}, "
-                f"{max((h['_score'] for h in response['hits']['hits']), default=0):.4f}]"
+                f"cosine_range=[{min(cosine_similarities, default=0):.4f}, "
+                f"{max(cosine_similarities, default=0):.4f}]"
             )
             return results
         except OpenSearchException as e:
```

**File**: `tests/kg/opensearch_impl/test_opensearch_storage.py` (modified, +3/-1)
```diff
@@ -4687,9 +4687,11 @@ async def test_query_cosine_score_conversion(
         with patch.object(ClientManager, "get_client", return_value=mock_client):
             s = self._make(global_config, embed_func)
             await s.initialize()
-            results = await s.query("test", top_k=5)
+            with patch("lightrag.kg.opensearch_impl.logger.info") as mock_log:
+                results = await s.query("test", top_k=5)
             assert len(results) == 1
             assert results[0]["distance"] == pytest.approx(0.7)
+            assert "cosine_range=[0.7000, 0.7000]" in mock_log.call_args.args[0]
 
     @pytest.mark.asyncio
     async def test_query_filters_below_threshold(
```

---

### Incident Patch 8: `dbf2d243` (2026-09-22)
**Commit Message**: Merge pull request #3956 from Shizoqua/fix/mongo-cosine-score-conversion

fix(mongo): compare cosine threshold against raw similarity

**File**: `lightrag/kg/mongo_impl.py` (modified, +15/-2)
```diff
@@ -4673,7 +4673,18 @@ async def query(
                 }
             },
             {"$addFields": {"score": {"$meta": "vectorSearchScore"}}},
-            {"$match": {"score": {"$gte": self.cosine_better_than_threshold}}},
+            # Atlas Vector Search normalizes a cosine-similarity index's
+            # vectorSearchScore to (1 + cosine_similarity) / 2, in [0, 1] --
+            # not raw cosine similarity, which every other backend compares
+            # cosine_better_than_threshold against. Rescale the threshold the
+            # same way for the server-side filter; the raw score is
+            # converted back below so "distance" matches the other
+            # backends' raw-cosine convention.
+            {
+                "$match": {
+                    "score": {"$gte": (1 + self.cosine_better_than_threshold) / 2}
+                }
+            },
             {"$project": {"vector": 0}},
         ]
 
@@ -4686,7 +4697,9 @@ async def query(
             {
                 **doc,
                 "id": doc["_id"],
-                "distance": doc.get("score", None),
+                "distance": 2 * doc["score"] - 1
+                if doc.get("score") is not None
+                else None,
                 "created_at": doc.get("created_at"),  # Include created_at field
             }
             for doc in results
```

**File**: `tests/kg/mongo_impl/test_mongo_vector_query_cosine_threshold.py` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+"""MongoVectorDBStorage.query() filters on Atlas Vector Search's
+vectorSearchScore. For a cosine-similarity index, Atlas normalizes that
+score to (1 + cosine_similarity) / 2, in [0, 1] -- not raw cosine
+similarity, which every other backend (faiss, postgres, nano) compares
+cosine_better_than_threshold against. Comparing the threshold straight
+against the normalized score both rescales the effective cutoff (a
+default 0.2 threshold only requires raw cosine similarity >= -0.6) and
+reports the wrong value in the "distance" field.
+"""
+
+from unittest.mock import AsyncMock, MagicMock
+
+import numpy as np
+import pytest
+
+pytest.importorskip("pymongo", reason="pymongo is required for Mongo storage tests")
+
+from lightrag.kg.mongo_impl import MongoVectorDBStorage
+
+pytestmark = pytest.mark.offline
+
+
+class MockEmbeddingFunc:
+    def __init__(self, dim=8):
+        self.embedding_dim = dim
+        self.max_token_size = 512
+        self.model_name = "mock-embed"
+
+    async def __call__(self, texts, **kwargs):
+        return np.random.rand(len(texts), self.embedding_dim).astype(np.float32)
+
+
+class _AsyncCursor:
+    def __init__(self, docs):
+        self._docs = list(docs)
+
+    async def to_list(self, length=None):
+        return list(self._docs)
+
+
+def _make_storage(threshold=0.2):
+    storage = MongoVectorDBStorage(
+        namespace="entities",
+        workspace="test",
+        global_config={
+            "embedding_batch_num": 10,
+            "vector_db_storage_cls_kwargs": {"cosine_better_than_threshold": threshold},
+        },
+        embedding_func=MockEmbeddingFunc(),
+        meta_fields={"content"},
+    )
+    storage._data = MagicMock()
+    storage._index_name = "test_index"
+    return storage
+
+
+@pytest.mark.asyncio
+async def test_match_stage_uses_the_rescaled_threshold():
+    """The server-side $match must compare against (1 + threshold) / 2, the
+    same scale Atlas reports vectorSearchScore on, not the raw threshold."""
+    storage = _make_storage(threshold=0.2)
+    storage._data.aggregate = AsyncMock(return_value=_AsyncCursor([]))
+
+    await storage.query("test", top_k=5, query_embedding=[0.1] * 8)
+
+    pipeline = storage._data.aggregate.await_args[0][0]
+    match_stage = next(stage for stage in pipeline if "$match" in stage)
+    assert match_stage["$match"]["score"]["$gte"] == pytest.approx(0.6)
+
+
+@pytest.mark.asyncio
+async def test_distance_is_converted_back_to_raw_cosine_similarity():
+    """A doc surviving the server-side filter carries Atlas's normalized
+    score; the returned "distance" must be the raw cosine similarity."""
+    storage = _make_storage(threshold=0.2)
+    storage._data.aggregate = AsyncMock(
+        return_value=_AsyncCursor([{"_id": "v1", "score": 0.85, "content": "match"}])
+    )
+
+    results = await storage.query("test", top_k=5, query_embedding=[0.1] * 8)
+
+    assert len(results) == 1
+    assert results[0]["distance"] == pytest.approx(0.7)
```

---

### Incident Patch 9: `45973237` (2026-09-22)
**Commit Message**: Merge pull request #4041 from pablo-legeren/fix/eval-all-nan-metrics-not-success

fix(evaluation): report all-NaN RAGAS cases as failed, not a 0.0 success

**File**: `lightrag/evaluation/eval_rag_quality.py` (modified, +30/-10)
```diff
@@ -112,6 +112,17 @@ def _is_nan(value: Any) -> bool:
     return isinstance(value, float) and math.isnan(value)
 
 
+#: Metric names averaged in benchmark stats, shared so the all-failed and
+#: has-successes branches of _calculate_benchmark_stats agree on the keys.
+_METRIC_NAMES = (
+    "faithfulness",
+    "answer_relevance",
+    "context_recall",
+    "context_precision",
+    "ragas_score",
+)
+
+
 class RAGEvaluator:
     """Evaluate RAG system quality using RAGAS metrics"""
 
@@ -524,9 +535,15 @@ async def evaluate_single_case(
                     # Calculate RAGAS score (average of all metrics, excluding NaN values)
                     metrics = result["metrics"]
                     valid_metrics = [v for v in metrics.values() if not _is_nan(v)]
-                    ragas_score = (
-                        sum(valid_metrics) / len(valid_metrics) if valid_metrics else 0
-                    )
+                    if not valid_metrics:
+                        # Nothing was scored (e.g. the judge LLM's output could
+                        # not be parsed for any metric). Report a failed case
+                        # rather than a 0.0 "success" that drags the averages
+                        # down as if the RAG answer itself were bad.
+                        raise ValueError(
+                            "All RAGAS metrics returned NaN; no score could be computed"
+                        )
+                    ragas_score = sum(valid_metrics) / len(valid_metrics)
                     result["ragas_score"] = round(ragas_score, 4)
 
                     # Update progress counter
@@ -788,22 +805,25 @@ def _calculate_benchmark_stats(
         failed_tests = total_tests - successful_tests
 
         if not valid_results:
+            # Every case failed (e.g. an all-NaN RAGAS result, or every RAG
+            # call raised). Keep the same keys the success path returns —
+            # zeroed rather than omitted — so callers like run() can read
+            # average_metrics / min_ragas_score / max_ragas_score
+            # unconditionally instead of branching on whether anything
+            # succeeded.
             return {
                 "total_tests": total_tests,
                 "successful_tests": 0,
                 "failed_tests": failed_tests,
                 "success_rate": 0.0,
+                "average_metrics": dict.fromkeys(_METRIC_NAMES, 0.0),
+                "min_ragas_score": 0,
+                "max_ragas_score": 0,
             }
 
         # Calculate averages for each metric (handling NaN values correctly)
         # Track both sum and count for each metric to handle NaN values properly
-        metrics_data = {
-            "faithfulness": {"sum": 0.0, "count": 0},
-            "answer_relevance": {"sum": 0.0, "count": 0},
-            "context_recall": {"sum": 0.0, "count": 0},
-            "context_precision": {"sum": 0.0, "count": 0},
-            "ragas_score": {"sum": 0.0, "count": 0},
-        }
+        metrics_data = {name: {"sum": 0.0, "count": 0} for name in _METRIC_NAMES}
 
         for result in valid_results:
             metrics = result.get("metrics", {})
```

**File**: `tests/evaluation/test_eval_rag_quality.py` (modified, +178/-0)
```diff
@@ -1,8 +1,11 @@
+import asyncio
 import builtins
 import json
 
+import pandas as pd
 import pytest
 
+from lightrag.evaluation import eval_rag_quality as module
 from lightrag.evaluation.eval_rag_quality import RAGEvaluator
 
 pytestmark = pytest.mark.offline
@@ -29,3 +32,178 @@ def open_with_ascii_default(file, mode="r", *args, **kwargs):
     evaluator.test_dataset_path = dataset_path
 
     assert evaluator._load_test_dataset() == expected
+
+
+NAN = float("nan")
+_METRIC_COLUMNS = (
+    "faithfulness",
+    "answer_relevancy",
+    "context_recall",
+    "context_precision",
+)
+
+
+def _patch_ragas_stack(monkeypatch, fake_evaluate):
+    """Patch every name the optional `ragas`/`tqdm` imports leave undefined.
+
+    Without the `evaluation` extra installed (as in offline CI), the
+    module-level try/except only sets Dataset/evaluate/LangchainLLMWrapper
+    to None on ImportError — tqdm and the four metric classes stay
+    undefined names, so evaluate_single_case raises NameError before ever
+    reaching the logic under test. Patching only Dataset/evaluate is not
+    enough to make these tests independent of the optional dependency.
+    """
+
+    class _FakeDataset:
+        @staticmethod
+        def from_dict(data):
+            return data
+
+    class _FakeMetric:
+        """Stand-in for a RAGAS metric class: only ever instantiated."""
+
+    class _FakeTqdm:
+        """Stand-in for tqdm.auto.tqdm: only .close() is exercised."""
+
+        def __init__(self, *args, **kwargs):
+            pass
+
+        def close(self):
+            pass
+
+    # Dataset/evaluate always exist (the except branch sets them to None),
+    # but tqdm and the four metric classes are never assigned at all when
+    # RAGAS_AVAILABLE is False — plain setattr would itself raise
+    # AttributeError, so those need raising=False.
+    monkeypatch.setattr(module, "Dataset", _FakeDataset)
+    monkeypatch.setattr(module, "evaluate", fake_evaluate)
+    monkeypatch.setattr(module, "tqdm", _FakeTqdm, raising=False)
+    monkeypatch.setattr(module, "Faithfulness", _FakeMetric, raising=False)
+    monkeypatch.setattr(module, "AnswerRelevancy", _FakeMetric, raising=False)
+    monkeypatch.setattr(module, "ContextRecall", _FakeMetric, raising=False)
+    monkeypatch.setattr(module, "ContextPrecision", _FakeMetric, raising=False)
+
+
+async def fake_generate_rag_response(question, client):
+    return {"answer": "an answer", "contexts": ["a context"]}
+
+
+async def _evaluate_one_case(monkeypatch, scores: dict[str, float]) -> dict:
+    """Run evaluate_single_case with RAGAS stubbed to return ``scores``."""
+
+    class _FakeResults:
+        def to_pandas(self):
+            return pd.DataFrame([{name: scores[name] for name in _METRIC_COLUMNS}])
+
+    _patch_ragas_stack(monkeypatch, lambda **kwargs: _FakeResults())
+
+    evaluator = object.__new__(RAGEvaluator)
+    evaluator.eval_llm = None
+    evaluator.eval_embeddings = None
+    evaluator.generate_rag_response = fake_generate_rag_response
+
+    position_pool = asyncio.Queue()
+    position_pool.put_nowait(0)
+    return await evaluator.evaluate_single_case(
+        1,
+        {"question": "q", "ground_truth": "gt"},
+        asyncio.Semaphore(1),
+        asyncio.Semaphore(1),
+        None,
+        {"completed": 0},
+        position_pool,
+        asyncio.Lock(),
+    )
+
+
+async def test_all_nan_metrics_is_a_failed_case_not_a_zero_score(monkeypatch):
+    result = await _evaluate_one_case(monkeypatch, dict.fromkeys(_METRIC_COLUMNS, NAN))
+
+    # Same shape as every other failed case, so the table, CSV and statistics
+    # all treat it as an error instead of a successful 0.0.
+    assert result["metrics"] == {}
+    assert "NaN" in result["error"]
+
+
+async def test_partially_nan_metrics_are_averaged_over_the_scored_ones(monkeypatch):
+    scores = dict.fromkeys(_METRIC_COLUMNS, 0.5)
+    scores["faithfulness"] = NAN
+
+    result = await _evaluate_one_case(monkeypatch, s
```

---

### Incident Patch 10: `4e4a3b0a` (2026-09-22)
**Commit Message**: Merge pull request #4027 from Shizoqua/fix/azure-embed-truncation-forwarding

fix(azure): forward max_token_size in azure_openai_embed

**File**: `lightrag/llm/openai.py` (modified, +8/-0)
```diff
@@ -1316,6 +1316,7 @@ async def azure_openai_embed(
     context: str = "document",
     query_prefix: str | None = None,
     document_prefix: str | None = None,
+    max_token_size: int | None = None,
 ) -> np.ndarray:
     """Azure OpenAI embedding wrapper function.
 
@@ -1325,6 +1326,12 @@ async def azure_openai_embed(
     All parameters from the underlying openai_embed are exposed to ensure
     full feature parity and API consistency.
 
+    ``max_token_size`` must stay a named parameter here: EmbeddingFunc.__call__
+    injects it from the @wrap_embedding_func_with_attrs decorator only when
+    the wrapped function's own signature declares it, and it is then
+    forwarded to openai_embed.func to truncate oversized texts before they
+    reach the Azure API, exactly as the standard OpenAI binding does.
+
     IMPORTANT - Decorator Usage:
 
     1. This function is decorated with @wrap_embedding_func_with_attrs to provide
@@ -1386,6 +1393,7 @@ async def azure_openai_embed(
         base_url=base_url,
         api_key=api_key,
         embedding_dim=embedding_dim,
+        max_token_size=max_token_size,
         token_tracker=token_tracker,
         client_configs=client_configs,
         use_azure=True,
```

**File**: `tests/llm/azure_openai_impl/test_azure_embed_truncation_forwarding.py` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+"""``azure_openai_embed`` must truncate long texts like ``openai_embed`` does.
+
+``EmbeddingFunc.__call__`` auto-injects ``max_token_size`` from the decorator
+only when the wrapped function's own signature declares that parameter
+(``lightrag.utils.EmbeddingFunc.__call__``). ``azure_openai_embed`` is
+decorated with ``max_token_size=8192`` but its signature never declared the
+parameter, and its call into ``openai_embed.func`` never forwarded one
+either, so the injection silently no-opped: a text longer than the model's
+context window reached Azure's embeddings API untouched instead of being cut
+to fit, unlike the identical path for the standard OpenAI binding.
+
+Fixed by adding ``max_token_size`` to ``azure_openai_embed``'s signature and
+forwarding it to ``openai_embed.func``.
+"""
+
+from types import SimpleNamespace
+from unittest.mock import AsyncMock
+
+import pytest
+
+from lightrag.llm.azure_openai import azure_openai_embed
+from lightrag.llm.openai import _get_tiktoken_encoding_for_model
+
+pytestmark = pytest.mark.offline
+
+MODEL = "text-embedding-3-small"
+EMBEDDING_DIM = 1536
+MAX_TOKEN_SIZE = 8192
+
+
+class _FakeEmbeddingClient:
+    """Captures the ``input`` list that actually reaches the embeddings API."""
+
+    def __init__(self, captured):
+        self._captured = captured
+        self.embeddings = SimpleNamespace(create=self._create)
+
+    async def __aenter__(self):
+        return self
+
+    async def __aexit__(self, exc_type, exc, tb):
+        return False
+
+    async def _create(self, **params):
+        self._captured.append(params)
+        return SimpleNamespace(
+            data=[
+                SimpleNamespace(embedding=[0.0] * EMBEDDING_DIM)
+                for _ in params["input"]
+            ]
+        )
+
+
+def _token_count(text):
+    encoding = _get_tiktoken_encoding_for_model(MODEL)
+    return len(encoding.encode(text, disallowed_special=()))
+
+
+@pytest.mark.asyncio
+async def test_azure_openai_embed_truncates_oversized_text(monkeypatch):
+    """A text far beyond the declared 8192-token budget must be cut down
+    before reaching the Azure embeddings API, exactly as ``openai_embed``
+    truncates for the standard OpenAI binding.
+    """
+    captured = []
+    monkeypatch.setattr(
+        "lightrag.llm.openai.create_openai_async_client",
+        lambda **_: _FakeEmbeddingClient(captured),
+    )
+    monkeypatch.setenv("AZURE_EMBEDDING_API_KEY", "test-key")
+    monkeypatch.setenv("AZURE_EMBEDDING_ENDPOINT", "https://example.openai.azure.com/")
+    monkeypatch.setenv("AZURE_EMBEDDING_DEPLOYMENT", MODEL)
+
+    text = "filler words here more filler " * 2000
+    assert _token_count(text) > MAX_TOKEN_SIZE
+
+    await azure_openai_embed([text])
+
+    assert len(captured) == 1
+    (sent,) = captured[0]["input"]
+    assert sent != text
+    assert _token_count(sent) <= MAX_TOKEN_SIZE
+
+
+@pytest.mark.asyncio
+async def test_azure_openai_embed_passes_short_text_through(monkeypatch):
+    """Stability: text within budget still reaches the API unchanged."""
+    captured = []
+    monkeypatch.setattr(
+        "lightrag.llm.openai.create_openai_async_client",
+        lambda **_: _FakeEmbeddingClient(captured),
+    )
+    monkeypatch.setenv("AZURE_EMBEDDING_API_KEY", "test-key")
+    monkeypatch.setenv("AZURE_EMBEDDING_ENDPOINT", "https://example.openai.azure.com/")
+    monkeypatch.setenv("AZURE_EMBEDDING_DEPLOYMENT", MODEL)
+
+    text = "a short sentence"
+
+    await azure_openai_embed([text])
+
+    assert captured[0]["input"] == [text]
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("limit_kwargs", [{}, {"max_token_size": 128}])
+async def test_azure_openai_embed_preserves_positional_arguments(
+    monkeypatch, limit_kwargs
+):
+    """All pre-existing positional arguments retain their original meaning."""
+    embed = AsyncMock()
+    monkeypatch.setattr("lightrag.llm.openai.openai_embed.func", embed)
+    monkeypatch.delenv("AZURE_EM
```

#### Recent Merged Pull Requests:
- **PR #4120** (2026-09-30): chore(storage): warn at startup that Redis storage is deprecated (@danielaskdd)
- **PR #4117** (closed): test(workspace): remove flaky fork inheritance probe (@danielaskdd)
- **PR #4115** (closed): test(workspace): wait for transient threads before fork probe (@pentaoa)
- **PR #4105** (2026-09-26): refactor(config): clarify configuration storage anchor filename (@danielaskdd)
- **PR #4104** (2026-09-26): fix(config): default Redis deployments to JSON configuration (@danielaskdd)
- **PR #4103** (2026-09-26): fix(setup): pin configuration storage to readable anchor (@danielaskdd)
- **PR #4102** (2026-09-25): test: faster local test runs (skip tests/setup by default, concurrent RSS children, faster .env generation) (@danielaskdd)
- **PR #4101** (2026-09-25): test: faster offline suite (env probe, setup CI split, local xdist) (@danielaskdd)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
