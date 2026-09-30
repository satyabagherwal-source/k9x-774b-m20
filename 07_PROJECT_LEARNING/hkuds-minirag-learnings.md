# Forensic Learning Record (Deep Inspection): HKUDS/MiniRAG

> **Canonical Artifact**: `07_PROJECT_LEARNING/hkuds-minirag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HKUDS/MiniRAG](https://github.com/HKUDS/MiniRAG))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:13:23.671Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HKUDS/MiniRAG`
- **Description**: [ACL2026] "MiniRAG: Making RAG Simpler with Small and Open-Sourced Language Models"
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2016 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `graph-visuals/graph_with_html.py`
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
G = nx.read_graphml("./LiHua-World/graph_chunk_entity_relation.graphml")

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

### Core Architecture Module: `graph-visuals/graph_with_neo4j.py`
```
import os
import json
from minirag.utils import xml_to_json
from neo4j import GraphDatabase

# Constants
WORKING_DIR = "./LiHua-World"
BATCH_SIZE_NODES = 500
BATCH_SIZE_EDGES = 100

# Neo4j connection credentials
NEO4J_URI = "bolt://localhost:7687"
NEO4J_USERNAME = "neo4j"
NEO4J_PASSWORD = "your_password"


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

### Core Architecture Module: `main.py`
```
# from huggingface_hub import login
# your_token = "INPUT YOUR TOKEN HERE"
# login(your_token)

import os
from minirag import MiniRAG, QueryParam
from minirag.llm.hf import (
    hf_model_complete,
    hf_embed,
)
from minirag.utils import EmbeddingFunc
from transformers import AutoModel, AutoTokenizer

EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

import argparse


def get_args():
    parser = argparse.ArgumentParser(description="MiniRAG")
    parser.add_argument("--model", type=str, default="PHI")
    parser.add_argument("--outputpath", type=str, default="./logs/Default_output.csv")
    parser.add_argument("--workingdir", type=str, default="./LiHua-World")
    parser.add_argument("--datapath", type=str, default="./dataset/LiHua-World/data/")
    parser.add_argument(
        "--querypath", type=str, default="./dataset/LiHua-World/qa/query_set.csv"
    )
    args = parser.parse_args()
    return args


args = get_args()


if args.model == "PHI":
    LLM_MODEL = "microsoft/Phi-3.5-mini-instruct"
elif args.model == "GLM":
    LLM_MODEL = "THUDM/glm-edge-1.5b-chat"
elif args.model == "MiniCPM":
    LLM_MODEL = "openbmb/MiniCPM3-4B"
elif args.model == "qwen":
    LLM_MODEL = "Qwen/Qwen2.5-3B-Instruct"
else:
    print("Invalid model name")
    exit(1)

WORKING_DIR = args.workingdir
DATA_PATH = args.datapath
QUERY_PATH = args.querypath
OUTPUT_PATH = args.outputpath
print("USING LLM:", LLM_MODEL)
print("USING WORKING DIR:", WORKING_DIR)


if not os.path.exists(WORKING_DIR):
    os.mkdir(WORKING_DIR)

rag = MiniRAG(
    working_dir=WORKING_DIR,
    llm_model_func=hf_model_complete,
    llm_model_max_token_size=200,
    llm_model_name=LLM_MODEL,
    embedding_func=EmbeddingFunc(
        embedding_dim=384,
        max_token_size=1000,
        func=lambda texts: hf_embed(
            texts,
            tokenizer=AutoTokenizer.from_pretrained(EMBEDDING_MODEL),
            embed_model=AutoModel.from_pretrained(EMBEDDING_MODEL),
        ),
    ),
)


# Now indexing
def find_txt_files(root_path):
    txt_files = []
    for root, dirs, files in os.walk(root_path):
        for file in files:
            if file.endswith(".txt"):
                txt_files.append(os.path.join(root, file))
    return txt_files


WEEK_LIST = find_txt_files(DATA_PATH)
for WEEK in WEEK_LIST:
    id = WEEK_LIST.index(WEEK)
    print(f"{id}/{len(WEEK_LIST)}")
    with open(WEEK) as f:
        rag.insert(f.read())

# A toy query
query = 'What does LiHua predict will happen in "The Rings of Power"?'
answer = (
    rag.query(query, param=QueryParam(mode="mini")).replace("\n", "").replace("\r", "")
)
print(answer)

```

### Core Architecture Module: `minirag/__init__.py`
```
from .minirag import MiniRAG as MiniRAG, QueryParam as QueryParam

__version__ = "0.0.2"
__author__ = "Tianyu Fan"
__url__ = "https://github.com/HKUDS/MiniRAG"

```

### Core Architecture Module: `minirag/api/__init__.py`
```
__api_version__ = "1.0.3"

```

### Core Architecture Module: `minirag/api/minirag_server.py`
```
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Request

# Backend (Python)
# Add this to store progress globally
from typing import Dict
import threading

# Global progress tracker
scan_progress: Dict = {
    "is_scanning": False,
    "current_file": "",
    "indexed_count": 0,
    "total_files": 0,
    "progress": 0,
}

# Lock for thread-safe operations
progress_lock = threading.Lock()

import json
import os

from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import logging
import argparse
import time
import re
from typing import List, Dict, Any, Optional, Union
from minirag import MiniRAG, QueryParam
from minirag.api import __api_version__

from minirag.utils import EmbeddingFunc
from enum import Enum
from pathlib import Path
import shutil
import aiofiles
from ascii_colors import trace_exception, ASCIIColors
import sys
import configparser

from fastapi import Depends, Security
from fastapi.security import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from starlette.status import HTTP_403_FORBIDDEN
import pipmaster as pm

from dotenv import load_dotenv

load_dotenv()


def estimate_tokens(text: str) -> int:
    """Estimate the number of tokens in text
    Chinese characters: approximately 1.5 tokens per character
    English characters: approximately 0.25 tokens per character
    """
    # Use regex to match Chinese and non-Chinese characters separately
    chinese_chars = len(re.findall(r"[\u4e00-\u9fff]", text))
    non_chinese_chars = len(re.findall(r"[^\u4e00-\u9fff]", text))

    # Calculate estimated token count
    tokens = chinese_chars * 1.5 + non_chinese_chars * 0.25

    return int(tokens)


class OllamaServerInfos:
    # Constants for emulated Ollama model information
    LIGHTRAG_NAME = "minirag"
    LIGHTRAG_TAG = os.getenv("OLLAMA_EMULATING_MODEL_TAG", "latest")
    LIGHTRAG_MODEL = f"{LIGHTRAG_NAME}:{LIGHTRAG_TAG}"
    LIGHTRAG_SIZE = 7365960935  # it's a dummy value
    LIGHTRAG_CREATED_AT = "2024-01-15T00:00:00Z"
    LIGHTRAG_DIGEST = "sha256:minirag"

    KV_STORAGE = "JsonKVStorage"
    DOC_STATUS_STORAGE = "JsonDocStatusStorage"
    GRAPH_STORAGE = "NetworkXStorage"
    VECTOR_STORAGE = "NanoVectorDBStorage"


# Add infos
ollama_server_infos = OllamaServerInfos()

# read config.ini
config = configparser.ConfigParser()
config.read("config.ini", "utf-8")
# Redis config
redis_uri = config.get("redis", "uri", fallback=None)
if redis_uri:
    os.environ["REDIS_URI"] = redis_uri
    ollama_server_infos.KV_STORAGE = "RedisKVStorage"
    ollama_server_infos.DOC_STATUS_STORAGE = "RedisKVStorage"

# Neo4j config
neo4j_uri = config.get("neo4j", "uri", fallback=None)
neo4j_username = config.get("neo4j", "username", fallback=None)
neo4j_password = config.get("neo4j", "password", fallback=None)
if neo4j_uri:
    os.environ["NEO4J_URI"] = neo4j_uri
    os.environ["NEO4J_USERNAME"] = neo4j_username
    os.environ["NEO4J_PASSWORD"] = neo4j_password
    ollama_server_infos.GRAPH_STORAGE = "Neo4JStorage"

# Milvus config
milvus_uri = config.get("milvus", "uri", fallback=None)
milvus_user = config.get("milvus", "user", fallback=None)
milvus_password = config.get("milvus", "password", fallback=None)
milvus_db_name = config.get("milvus", "db_name", fallback=None)
if milvus_uri:
    os.environ["MILVUS_URI"] = milvus_uri
    os.environ["MILVUS_USER"] = milvus_user
    os.environ["MILVUS_PASSWORD"] = milvus_password
    os.environ["MILVUS_DB_NAME"] = milvus_db_name
    ollama_server_infos.VECTOR_STORAGE = "MilvusVectorDBStorge"

# MongoDB config
mongo_uri = config.get("mongodb", "uri", fallback=None)
mongo_database = config.get("mongodb", "MiniRAG", fallback=None)
if mongo_uri:
    os.environ["MONGO_URI"] = mongo_uri
    os.environ["MONGO_DATABASE"] = mongo_database
    ollama_server_infos.KV_STORAGE = "MongoKVStorage"
    ollama_server_infos.DOC_STATUS_STORAGE = "MongoKVStorage"


def get_default_host(binding_type: str) -> str:
    default_hosts = {
        "ollama": os.getenv("LLM_BINDING_HOST", "http://localhost:11434"),
        "lollms": os.getenv("LLM_BINDING_HOST", "http://localhost:9600"),
        "azure_openai": os.getenv("AZURE_OPENAI_ENDPOINT", "https://api.openai.com/v1"),
        "openai": os.getenv("LLM_BINDING_HOST", "https://api.openai.com/v1"),
    }
    return default_hosts.get(
        binding_type, os.getenv("LLM_BINDING_HOST", "http://localhost:11434")
    )  # fallback to ollama if unknown


def get_env_value(env_key: str, default: Any, value_type: type = str) -> Any:
    """
    Get value from environment variable with type conversion

    Args:
        env_key (str): Environment variable key
        default (Any): Default value if env variable is not set
        value_type (type): Type to convert the value to

    Returns:
        Any: Converted value from environment or default
    """
    value = os.getenv(env_key)
    if value is None:
        return default

    if isinstance(value_type, bool):
        return value.lower() in ("true", "1", "yes")
    try:
        return value_type(value)
    except ValueError:
        return default


def display_splash_screen(args: argparse.Namespace) -> None:
    """
    Display a colorful splash screen showing MiniRAG server configuration

    Args:
        args: Parsed command line arguments
    """
    # Banner
    ASCIIColors.cyan(f"""
    ╔══════════════════════════════════════════════════════════════╗
    ║                   🚀 MiniRAG Server v{__api_version__}                  ║
    ║          Fast, Lightweight RAG Server Implementation         ║
    ╚══════════════════════════════════════════════════════════════╝
    """)

    # Server Configuration
    ASCIIColors.magenta("\n📡 Server Configuration:")
    ASCIIColors.white("    ├─ Host: ", end="")
    ASCIIColors.yellow(f"{args.host}")
    ASCIIColors.white("    ├─ Port: ", end="")
    ASCIIColors.yellow(f"{args.port}")
    ASCIIColors.white("    ├─ SSL Enabled: ", end="")
    ASCIIColors.yellow(f"{args.ssl}")
    if args.ssl:
        ASCIIColors.white("    ├─ SSL Cert: ", end="")
        ASCIIColors.yellow(f"{args.ssl_certfile}")
        ASCIIColors.white("    └─ SSL Key: ", end="")
        ASCIIColors.yellow(f"{args.ssl_keyfile}")

    # Directory Configuration
    ASCIIColors.magenta("\n📂 Directory Configuration:")
    ASCIIColors.white("    ├─ Working Directory: ", end="")
    ASCIIColors.yellow(f"{args.working_dir}")
    ASCIIColors.white("    └─ Input Directory: ", end="")
    ASCIIColors.yellow(f"{args.input_dir}")

    # LLM Configuration
    ASCIIColors.magenta("\n🤖 LLM Configuration:")
    ASCIIColors.white("    ├─ Binding: ", end="")
    ASCIIColors.yellow(f"{args.llm_binding}")
    ASCIIColors.white("    ├─ Host: ", end="")
    ASCIIColors.yellow(f"{args.llm_binding_host}")
    ASCIIColors.white("    └─ Model: ", end="")
    ASCIIColors.yellow(f"{args.llm_model}")

    # Embedding Configuration
    ASCIIColors.magenta("\n📊 Embedding Configuration:")
    ASCIIColors.white("    ├─ Binding: ", end="")
    ASCIIColors.yellow(f"{args.embedding_binding}")
    ASCIIColors.white("    ├─ Host: ", end="")
    ASCIIColors.yellow(f"{args.embedding_binding_host}")
    ASCIIColors.white("    ├─ Model: ", end="")
    ASCIIColors.yellow(f"{args.embedding_model}")
    ASCIIColors.white("    └─ Dimensions: ", end="")
    ASCIIColors.yellow(f"{args.embedding_dim}")

    # RAG Configuration
    ASCIIColors.magenta("\n⚙️ RAG Configuration:")
    ASCIIColors.white("    ├─ Max Async Operations: ", end="")
    ASCIIColors.yellow(f"{args.max_async}")
    ASCIIColors.white("    ├─ Max Tokens: ", end="")
    ASCIIColors.yellow(f"{args.max_tokens}")
    ASCIIColors.white("    ├─ Max Embed Tokens: ", end="")
    ASCIIColors.yellow(f"{args.max_embed_tokens}")
    ASCIIColors.white("    ├─ Chunk Size: ", end="")
    ASCIIColors.yellow(f"{args.chunk_size}")
    ASCIIColors.white("    ├─ Chunk Overlap Size: ", end="")
    ASCIIColors.yellow(f"
```

### Core Architecture Module: `minirag/api/static/js/api.js`
```
// State management
const state = {
    apiKey: localStorage.getItem('apiKey') || '',
    files: [],
    indexedFiles: [],
    currentPage: 'file-manager'
};

// Utility functions
const showToast = (message, duration = 3000) => {
    const toast = document.getElementById('toast');
    toast.querySelector('div').textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), duration);
};

const fetchWithAuth = async (url, options = {}) => {
    const headers = {
        ...(options.headers || {}),
        ...(state.apiKey ? { 'Authorization': `Bearer ${state.apiKey}` } : {})
    };
    return fetch(url, { ...options, headers });
};

// Page renderers
const pages = {
    'file-manager': () => `
        <div class="space-y-6">
            <h2 class="text-2xl font-bold text-gray-800">File Manager</h2>

            <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                <input type="file" id="fileInput" multiple accept=".txt,.md,.doc,.docx,.pdf,.pptx" class="hidden">
                <label for="fileInput" class="cursor-pointer">
                    <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
                    </svg>
                    <p class="mt-2 text-gray-600">Drag files here or click to select</p>
                    <p class="text-sm text-gray-500">Supported formats: TXT, MD, DOC, PDF, PPTX</p>
                </label>
            </div>

            <div id="fileList" class="space-y-2">
                <h3 class="text-lg font-semibold text-gray-700">Selected Files</h3>
                <div class="space-y-2"></div>
            </div>
            <div id="uploadProgress" class="hidden mt-4">
                <div class="w-full bg-gray-200 rounded-full h-2.5">
                    <div class="bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
                </div>
                <p class="text-sm text-gray-600 mt-2"><span id="uploadStatus">0</span> files processed</p>
            </div>
            <button id="rescanBtn" class="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor" class="mr-2">
                    <path d="M12 4a8 8 0 1 1-8 8H2.5a9.5 9.5 0 1 0 2.8-6.7L2 3v6h6L5.7 6.7A7.96 7.96 0 0 1 12 4z"/>
                </svg>
                Rescan Files
            </button>
            <button id="uploadBtn" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Upload & Index Files
            </button>

            <div id="indexedFiles" class="space-y-2">
                <h3 class="text-lg font-semibold text-gray-700">Indexed Files</h3>
                <div class="space-y-2"></div>
            </div>



        </div>
    `,

    'query': () => `
        <div class="space-y-6">
            <h2 class="text-2xl font-bold text-gray-800">Query Database</h2>

            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Query Mode</label>
                    <select id="queryMode" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <option value="light">Light</option>
                        <option value="naive">Naive</option>
                        <option value="mini">Mini</option>
                    </select>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700">Query</label>
                    <textarea id="queryInput" rows="4" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"></textarea>
                </div>

                <button id="queryBtn" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    Send Query
                </button>

                <div id="queryResult" class="mt-4 p-4 bg-white rounded-lg shadow"></div>
            </div>
        </div>
    `,

    'knowledge-graph': () => `
        <div class="flex items-center justify-center h-full">
            <div class="text-center">
                <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                </svg>
                <h3 class="mt-2 text-sm font-medium text-gray-900">Under Construction</h3>
                <p class="mt-1 text-sm text-gray-500">Knowledge graph visualization will be available in a future update.</p>
            </div>
        </div>
    `,

    'status': () => `
        <div class="space-y-6">
            <h2 class="text-2xl font-bold text-gray-800">System Status</h2>
            <div id="statusContent" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="p-6 bg-white rounded-lg shadow-sm">
                    <h3 class="text-lg font-semibold mb-4">System Health</h3>
                    <div id="healthStatus"></div>
                </div>
                <div class="p-6 bg-white rounded-lg shadow-sm">
                    <h3 class="text-lg font-semibold mb-4">Configuration</h3>
                    <div id="configStatus"></div>
                </div>
            </div>
        </div>
    `,

    'settings': () => `
        <div class="space-y-6">
            <h2 class="text-2xl font-bold text-gray-800">Settings</h2>

            <div class="max-w-xl">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">API Key</label>
                        <input type="password" id="apiKeyInput" value="${state.apiKey}"
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    </div>

                    <button id="saveSettings" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    `
};

// Page handlers
const handlers = {
    'file-manager': () => {
        const fileInput = document.getElementById('fileInput');
        const dropZone = fileInput.parentElement.parentElement;
        const fileList = document.querySelector('#fileList div');
        const indexedFiles = document.querySelector('#indexedFiles div');
        const uploadBtn = document.getElementById('uploadBtn');

        const updateFileList = () => {
            fileList.innerHTML = state.files.map(file => `
                <div class="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                    <span>${file.name}</span>
                    <button class="text-red-600 hover:text-red-700" onclick="removeFile('${file.name}')">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                    </button>
                </div>
            `).join('');
        };

        const updateIndexedFiles 
```

### Core Architecture Module: `minirag/api/static/js/graph.js`
```
// js/graph.js
function openGraphModal(label) {
    const modal = document.getElementById("graph-modal");
    const graphTitle = document.getElementById("graph-title");

    if (!modal || !graphTitle) {
        console.error("Key element not found");
        return;
    }

    graphTitle.textContent = `Knowledge Graph - ${label}`;
    modal.style.display = "flex";

    renderGraph(label);
}

function closeGraphModal() {
    const modal = document.getElementById("graph-modal");
    modal.style.display = "none";
    clearGraph();
}

function clearGraph() {
    const svg = document.getElementById("graph-svg");
    svg.innerHTML = "";
}


async function getGraph(label) {
    try {
        const response = await fetch(`/graphs?label=${label}`);
        const rawData = await response.json();
        console.log({data: JSON.parse(JSON.stringify(rawData))});

        const nodes = rawData.nodes

        nodes.forEach(node => {
            node.id = Date.now().toString(36) + Math.random().toString(36).substring(2); // 使用 crypto.randomUUID() 生成唯一 UUID
        });

        //  Strictly verify edge data
        const edges = (rawData.edges || []).map(edge => {
            const sourceNode = nodes.find(n => n.labels.includes(edge.source));
            const targetNode = nodes.find(n => n.labels.includes(edge.target)
                )
            ;
            if (!sourceNode || !targetNode) {
                console.warn("NOT VALID EDGE:", edge);
                return null;
            }
            return {
                source: sourceNode,
                target: targetNode,
                type: edge.type || ""
            };
        }).filter(edge => edge !== null);

        return {nodes, edges};
    } catch (error) {
        console.error("Loading graph failed:", error);
        return {nodes: [], edges: []};
    }
}

async function renderGraph(label) {
    const data = await getGraph(label);


    if (!data.nodes || data.nodes.length === 0) {
        d3.select("#graph-svg")
            .html(`<text x="50%" y="50%" text-anchor="middle">No valid nodes</text>`);
        return;
    }


    const svg = d3.select("#graph-svg");
    const width = svg.node().clientWidth;
    const height = svg.node().clientHeight;

    svg.selectAll("*").remove();

    //  Create a force oriented diagram layout
    const simulation = d3.forceSimulation(data.nodes)
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2));

    //  Add a connection (if there are valid edges)
    if (data.edges.length > 0) {
        simulation.force("link",
            d3.forceLink(data.edges)
                .id(d => d.id)
                .distance(100)
        );
    }

    //  Draw nodes
    const nodes = svg.selectAll(".node")
        .data(data.nodes)
        .enter()
        .append("circle")
        .attr("class", "node")
        .attr("r", 10)
        .call(d3.drag()
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded)
        );


    svg.append("defs")
        .append("marker")
        .attr("id", "arrow-out")
        .attr("viewBox", "0 0 10 10")
        .attr("refX", 8)
        .attr("refY", 5)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L10,5 L0,10 Z")
        .attr("fill", "#999");

    //  Draw edges (with arrows)
    const links = svg.selectAll(".link")
        .data(data.edges)
        .enter()
        .append("line")
        .attr("class", "link")
        .attr("marker-end", "url(#arrow-out)"); //  Always draw arrows on the target side

    //  Edge style configuration
    links
        .attr("stroke", "#999")
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.8);

    //  Draw label (with background box)
    const labels = svg.selectAll(".label")
        .data(data.nodes)
        .enter()
        .append("text")
        .attr("class", "label")
        .text(d => d.labels[0] || "")
        .attr("text-anchor", "start")
        .attr("dy", "0.3em")
        .attr("fill", "#333");

    //  Update Location
    simulation.on("tick", () => {
        links
            .attr("x1", d => {
                //  Calculate the direction vector from the source node to the target node
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance === 0) return d.source.x; // 避免除以零 Avoid dividing by zero
                // Adjust the starting point coordinates (source node edge) based on radius 10
                return d.source.x + (dx / distance) * 10;
            })
            .attr("y1", d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance === 0) return d.source.y;
                return d.source.y + (dy / distance) * 10;
            })
            .attr("x2", d => {
                // Adjust the endpoint coordinates (target node edge) based on a radius of 10
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance === 0) return d.target.x;
                return d.target.x - (dx / distance) * 10;
            })
            .attr("y2", d => {
                const dx = d.target.x - d.source.x;
                const dy = d.target.y - d.source.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance === 0) return d.target.y;
                return d.target.y - (dy / distance) * 10;
            });

        // Update the position of nodes and labels (keep unchanged)
        nodes
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        labels
            .attr("x", d => d.x + 12)
            .attr("y", d => d.y + 4);
    });

    // Drag and drop logic
    function dragStarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
        simulation.alpha(0.3).restart();
    }

    function dragEnded(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #111** (2026-03-04): **Dev合并到main**
  *Symptoms*: 

- **Issue #95** (2025-08-22): **发现了一个bug，导致无法获取type_pool**
  *Symptoms*: <img width="445" height="187" alt="Image" src="https://github.com/user-attachments/assets/70d07932-fa24-4959-9a9e-9c4696fefb69" />    如图，文件minirag/kg/networkx_impl.py中第154行，"type"应改为"entity_type"，否则该函数返回的列表都为空
  **Post-Mortem & Fix Analysis**:
  > 感谢纠错！！由于这个修改是社区提供的，我没有做好足够的检查，抱歉给你带来不便 : (  我已经修复了这个bug，再次抱歉

- **Issue #92** (2025-07-06): **Correct the answers**
  *Symptoms*: 

- **Issue #87** (2025-06-04): **Update query_set.json**
  *Symptoms*: Corrected incorrect answers
  **Post-Mortem & Fix Analysis**:
  > Thanks for your interest of our work!

- **Issue #86** (2025-06-04): **Update query_set.csv**
  *Symptoms*: Corrected incorrect answers
  **Post-Mortem & Fix Analysis**:
  > Thanks for your interest of our work!

- **Issue #84** (2025-06-04): **Add Weaviate-based vector, KV, and graph storage**
  *Symptoms*: **### Add Weaviate-based Implementations for Vector, KV, and Graph Storage** **Overview**  This PR introduces complete support for Weaviate as a backend to MiniRAG’s core storage abstractions, enabling users to leverage a powerful vector-native database with native support for relationships and semantic search.  **What’s Included** **Vector Storage (WeaviateVectorStorage):** Implements upsert, query, delete, count, and clear operations using the Document class and Weaviate’s near-text search.  **Key-Value Storage (WeaviateKVStorage):** Enables efficient key-based reads/writes using KVDocument, with support for get_by_id, all_keys, filter_keys, and more.  **Graph Storage (WeaviateGraphStorage):** Adds basic graph node/edge support using GraphNode with linkedTo relationships. Includes node upsert, edge creation, degree queries, and schema bootstrapping.  **Tests:** Added thorough unit tests with pytest and unittest.mock, achieving solid coverage of implemented functionality.  **Key Benefits** Unified async-compatible design using a run_sync utility.  Modular and pluggable — follows the existing MiniRAG interface patterns.  Built for RAG + KG — combines vector and graph capabilities for hybrid workflows.
  **Post-Mortem & Fix Analysis**:
  > Thanks for your interest of our work!

- **Issue #81** (2025-05-21): **missing import abstractmethod in minirag.base.py**
  *Symptoms*: 您好：  首先感谢您的开源项目minirag！ 我采用pip install -U minirag-hku后，测试reproduce的案例，但是发现minirag.base 中missing Import abstractmethod. 我发现你们的源代码已经修复了该问题，在kaggle notebook中试图pip install -e . 安装，但是似乎仍然返回错误：error: subprocess-exited-with-error 请问是否有解决办法，谢谢！  祝好！ 

- **Issue #79** (2025-05-12): **Fix: Packaging: Sub-packages kg, llm, api.**
  *Symptoms*: To get the sub-packages correctly installed. The `[tool.setuptools]` section from `pyproject.toml` shall be removed.   This forces the build backend to rely solely on the `packages=setuptools.find_packages(...)` configuration defined in `setup.py`, which makes the software works as expected.  Fix #78, fix #55.
  **Post-Mortem & Fix Analysis**:
  > thanks! @theauAg 

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

### Incident Patch 1: `afa34bb7` (2025-05-12)
**Commit Message**: Merge pull request #79 from theauAg/bugfix/import

Fix: Packaging: Sub-packages kg, llm, api.

**File**: `pyproject.toml` (modified, +0/-3)
```diff
@@ -19,6 +19,3 @@ classifiers = [
     "Intended Audience :: Developers",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-
-[tool.setuptools]
-packages = ["minirag"]
\ No newline at end of file
```

---

### Incident Patch 2: `0ffa4477` (2025-04-16)
**Commit Message**: Merge pull request #71 from wrosko/wrosko/fix_chunking_by_token_size

Removing stale split_by_character reference

**File**: `minirag/minirag.py` (modified, +0/-2)
```diff
@@ -484,8 +484,6 @@ async def apipeline_process_enqueue_documents(
                     }
                     for dp in self.chunking_func(
                         status_doc.content,
-                        split_by_character,
-                        split_by_character_only,
                         self.chunk_overlap_token_size,
                         self.chunk_token_size,
                         self.tiktoken_model_name,
```

---

### Incident Patch 3: `e7db2be0` (2025-04-10)
**Commit Message**: fix:TypeError: chunking_by_token_size() takes from 1 to 4 positional arguments but 6 were given

**File**: `minirag/minirag.py` (modified, +0/-2)
```diff
@@ -365,8 +365,6 @@ async def ainsert(
             ).items()
             for dp in self.chunking_func(
                 status_doc.content,
-                split_by_character,
-                split_by_character_only,
                 self.chunk_overlap_token_size,
                 self.chunk_token_size,
                 self.tiktoken_model_name,
```

---

### Incident Patch 4: `a401359b` (2025-04-10)
**Commit Message**: fix: add OPENAI_BASE_URL support

**File**: `minirag/llm/openai.py` (modified, +2/-1)
```diff
@@ -101,7 +101,8 @@ async def openai_complete_if_cache(
 ) -> str:
     if api_key:
         os.environ["OPENAI_API_KEY"] = api_key
-
+    if base_url==None:
+        base_url = os.environ["OPENAI_API_BASE"]
     openai_async_client = (
         AsyncOpenAI() if base_url is None else AsyncOpenAI(base_url=base_url)
     )
```

---

### Incident Patch 5: `a256463d` (2025-04-03)
**Commit Message**: fix: Unable to import packages in llm normally during initialization

**File**: `minirag/llm/__init__.py` (modified, +7/-0)
```diff
@@ -0,0 +1,7 @@
+from minirag.llm.openai import (
+    gpt_4o_mini_complete,
+)
+from minirag.llm.hf import (
+    hf_embed,
+    hf_model_complete
+)
\ No newline at end of file
```

---

### Incident Patch 6: `c7a9aef0` (2025-03-29)
**Commit Message**: fixup _insert_done call

**File**: `minirag/minirag.py` (modified, +2/-0)
```diff
@@ -383,6 +383,8 @@ async def ainsert(
                 relationships_vdb=self.relationships_vdb,
                 global_config=asdict(self),
             )
+ 
+        await self._insert_done()
 
     async def apipeline_enqueue_documents(
         self, input: str | list[str], ids: list[str] | None = None
```

---

### Incident Patch 7: `b869f2d9` (2025-03-29)
**Commit Message**: fix paralle insertion

**File**: `minirag/minirag.py` (modified, +58/-21)
```diff
@@ -4,6 +4,7 @@
 from datetime import datetime
 from functools import partial
 from typing import Type, cast, Any
+from dotenv import load_dotenv
 
 
 from .operate import (
@@ -23,7 +24,7 @@
     clean_text,
     get_content_summary,
     set_logger,
-    logger
+    logger,
 )
 from .base import (
     BaseGraphStorage,
@@ -66,6 +67,8 @@
 #     GraphStorage as ArangoDBStorage
 # )
 
+load_dotenv(dotenv_path=".env", override=False)
+
 
 def lazy_external_import(module_name: str, class_name: str):
     """Lazily import a class from an external module based on the package of the caller."""
@@ -155,7 +158,9 @@ class MiniRAG:
 
     # LLM
     llm_model_func: callable = None
-    llm_model_name: str = "meta-llama/Llama-3.2-1B-Instruct"  #'meta-llama/Llama-3.2-1B'#'google/gemma-2-2b-it'
+    llm_model_name: str = (
+        "meta-llama/Llama-3.2-1B-Instruct"  #'meta-llama/Llama-3.2-1B'#'google/gemma-2-2b-it'
+    )
     llm_model_max_token_size: int = 32768
     llm_model_max_async: int = 16
     llm_model_kwargs: dict = field(default_factory=dict)
@@ -176,6 +181,8 @@ class MiniRAG:
     chunking_func: callable = chunking_by_token_size
     chunking_func_kwargs: dict = field(default_factory=dict)
 
+    max_parallel_insert: int = field(default=int(os.getenv("MAX_PARALLEL_INSERT", 2)))
+
     def __post_init__(self):
         log_file = os.path.join(self.working_dir, "minirag.log")
         set_logger(log_file)
@@ -330,22 +337,32 @@ def insert(self, string_or_strings):
         loop = always_get_an_event_loop()
         return loop.run_until_complete(self.ainsert(string_or_strings))
 
-    async def ainsert(self, input: str | list[str], split_by_character: str | None = None, split_by_character_only: bool = False, ids: str | list[str] | None = None) -> None:
+    async def ainsert(
+        self,
+        input: str | list[str],
+        split_by_character: str | None = None,
+        split_by_character_only: bool = False,
+        ids: str | list[str] | None = None,
+    ) -> None:
         if isinstance(input, str):
             input = [input]
         if isinstance(ids, str):
             ids = [ids]
 
         await self.apipeline_enqueue_documents(input, ids)
-        await self.apipeline_process_enqueue_documents(split_by_character, split_by_character_only)
+        await self.apipeline_process_enqueue_documents(
+            split_by_character, split_by_character_only
+        )
 
         # Perform additional entity extraction as per original ainsert logic
         inserting_chunks = {
             compute_mdhash_id(dp["content"], prefix="chunk-"): {
                 **dp,
                 "full_doc_id": doc_id,
             }
-            for doc_id, status_doc in (await self.doc_status.get_docs_by_status(DocStatus.PROCESSED)).items()
+            for doc_id, status_doc in (
+                await self.doc_status.get_docs_by_status(DocStatus.PROCESSED)
+            ).items()
             for dp in self.chunking_func(
                 status_doc.content,
                 split_by_character,
@@ -367,7 +384,9 @@ async def ainsert(self, input: str | list[str], split_by_character: str | None =
                 global_config=asdict(self),
             )
 
-    async def apipeline_enqueue_documents(self, input: str | list[str], ids: list[str] | None = None) -> None:
+    async def apipeline_enqueue_documents(
+        self, input: str | list[str], ids: list[str] | None = None
+    ) -> None:
         """
         Pipeline for Processing Documents
 
@@ -392,7 +411,12 @@ async def apipeline_enqueue_documents(self, input: str | list[str], ids: list[st
             input = list(set(clean_text(doc) for doc in input))
             contents = {compute_mdhash_id(doc, prefix="doc-"): doc for doc in input}
 
-        unique_contents = {id_: content for content, id_ in {content: id_ for id_, content in contents.items()}.items()}
+        unique_contents = {
+            id_: content
+            for content, id_ in {
+                conten
```

---

### Incident Patch 8: `49fd327b` (2025-03-07)
**Commit Message**: fixes on qa

**File**: `dataset/LiHua-World/qa/query_set.csv` (modified, +1/-1)
```diff
@@ -196,7 +196,7 @@ What kinds of Thai food does Wolfgang want to try out at the Thai restaurant on
 What song does Yuriko propose that the band can practice this weekend according to the band's discussion on 20260703?,Take Me Home Country Roads by John Denver,20260703_11:45,Single
 What is the name of the song that Yuriko recommend to the band on 20260706?,Rolling in the Deep by Adele,20260706_19:30,Single
 Why are LiHua and Adam concerned about the basement in their conversation on 20260707?,They want to check if there were any issues in the basement after those rainstorms,20260707_16:00,Single
-Why is Jennifer checking in in the gym group chat on 20260708?,She wants to hear how the members are all doing and offer some personalized advice.20260708_14:00,Why,Single
+Why is Jennifer checking in in the gym group chat on 20260708?,She wants to hear how the members are all doing and offer some personalized advice.,20260708_14:00,Single
 What is the article that Chae shares with LiHua about?,how to fall asleep faster at night,20260711_11:00,Single
 What is LiHua's feeback on Hailey's new artisanal donuts?,The flavors are so unique and delicious,20260712_16:00,Single
 What new flavor is LiHua looking for as he mentions to Hailey in their conversation on 20260714?,a matcha flavor,20260714_12:00,Single
```

**File**: `dataset/LiHua-World/qa/query_set.json` (modified, +2/-2)
```diff
@@ -1183,8 +1183,8 @@
     },
     "197": {
         "question": "Why is Jennifer checking in in the gym group chat on 20260708?",
-        "answer": "She wants to hear how the members are all doing and offer some personalized advice.20260708_14:00",
-        "evidence": "Why",
+        "answer": "She wants to hear how the members are all doing and offer some personalized advice.",
+        "evidence": "20260708_14:00",
         "type": "Single"
     },
     "198": {
```

---

### Incident Patch 9: `87c1dea5` (2025-03-05)
**Commit Message**: fix bugs

**File**: `reproduce/Step_0_index.py` (modified, +2/-2)
```diff
@@ -11,7 +11,7 @@
 from minirag import MiniRAG
 from minirag.llm import (
     gpt_4o_mini_complete,
-    hf_embedding,
+    hf_embed,
 )
 from minirag.utils import EmbeddingFunc
 from transformers import AutoModel, AutoTokenizer
@@ -69,7 +69,7 @@ def get_args():
     embedding_func=EmbeddingFunc(
         embedding_dim=384,
         max_token_size=1000,
-        func=lambda texts: hf_embedding(
+        func=lambda texts: hf_embed(
             texts,
             tokenizer=AutoTokenizer.from_pretrained(EMBEDDING_MODEL),
             embed_model=AutoModel.from_pretrained(EMBEDDING_MODEL),
```

**File**: `reproduce/Step_1_QA.py` (modified, +2/-2)
```diff
@@ -13,7 +13,7 @@
 from minirag import MiniRAG, QueryParam
 from minirag.llm import (
     hf_model_complete,
-    hf_embedding,
+    hf_embed,
 )
 from minirag.utils import EmbeddingFunc
 from transformers import AutoModel, AutoTokenizer
@@ -71,7 +71,7 @@ def get_args():
     embedding_func=EmbeddingFunc(
         embedding_dim=384,
         max_token_size=1000,
-        func=lambda texts: hf_embedding(
+        func=lambda texts: hf_embed(
             texts,
             tokenizer=AutoTokenizer.from_pretrained(EMBEDDING_MODEL),
             embed_model=AutoModel.from_pretrained(EMBEDDING_MODEL),
```

---

### Incident Patch 10: `2c220df7` (2025-03-01)
**Commit Message**: Fix Docker container crash by adding missing abstractmethod import

**File**: `minirag/base.py` (modified, +2/-1)
```diff
@@ -1,3 +1,4 @@
+from abc import abstractmethod
 from dataclasses import dataclass, field
 from enum import Enum
 from typing import Any, TypedDict, Optional, Union, Literal, Generic, TypeVar
@@ -106,7 +107,7 @@ class BaseGraphStorage(StorageNameSpace):
     @abstractmethod
     async def get_types(self) -> tuple[list[str], list[str]]:
         raise NotImplementedError
-    
+
     async def has_node(self, node_id: str) -> bool:
         raise NotImplementedError
 
```

#### Recent Merged Pull Requests:
- **PR #111** (closed): Dev合并到main (@ggg-ttt)
- **PR #92** (closed): Correct the answers (@feeingHe)
- **PR #87** (2025-06-04): Update query_set.json (@K-359)
- **PR #86** (2025-06-04): Update query_set.csv (@K-359)
- **PR #84** (2025-06-04): Add Weaviate-based vector, KV, and graph storage (@ShorthillsAI)
- **PR #79** (2025-05-12): Fix: Packaging: Sub-packages kg, llm, api. (@theauAg)
- **PR #71** (2025-04-16): Removing stale split_by_character reference (@wrosko)
- **PR #70** (2025-04-14): fix: add OPENAI_BASE_URL support (@QodiCat)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
