# Forensic Learning Record (Deep Inspection): HKUDS/MiniRAG

> **Canonical Artifact**: `07_PROJECT_LEARNING/hkuds-minirag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HKUDS/MiniRAG](https://github.com/HKUDS/MiniRAG))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:19:59.876Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HKUDS/MiniRAG`
- **Description**: [ACL2026] "MiniRAG: Making RAG Simpler with Small and Open-Sourced Language Models"
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 2017 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `minirag/utils.py`
```
import asyncio
import html
import io
import csv
import json
import logging
import os
import re
from dataclasses import dataclass
from functools import wraps
from hashlib import md5
from typing import Any, Union, List
import xml.etree.ElementTree as ET
import copy
import numpy as np
import tiktoken
from nltk.metrics import edit_distance
from rouge import Rouge
from nltk.translate.bleu_score import sentence_bleu
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from nltk.tokenize import word_tokenize
from nltk.translate.bleu_score import SmoothingFunction

ENCODER = None

logger = logging.getLogger("minirag")


def set_logger(log_file: str):
    logger.setLevel(logging.DEBUG)

    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(logging.DEBUG)

    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    file_handler.setFormatter(formatter)

    if not logger.handlers:
        logger.addHandler(file_handler)


@dataclass
class EmbeddingFunc:
    embedding_dim: int
    max_token_size: int
    func: callable

    async def __call__(self, *args, **kwargs) -> np.ndarray:
        return await self.func(*args, **kwargs)


def compute_mdhash_id(content, prefix: str = ""):
    return prefix + md5(content.encode()).hexdigest()


def compute_args_hash(*args, cache_type: str | None = None) -> str:
    args_str = "".join([str(arg) for arg in args])
    if cache_type:
        args_str = f"{cache_type}:{args_str}"
    return md5(args_str.encode()).hexdigest()


def clean_text(text: str) -> str:
    """Clean text by removing null bytes (0x00) and whitespace"""
    return text.strip().replace("\x00", "")


def get_content_summary(content: str, max_length: int = 100) -> str:
    """Get a summary of document content, truncating if necessary"""
    content = content.strip()
    return content if len(content) <= max_length else content[:max_length] + "..."


def locate_json_string_body_from_string(content: str) -> Union[str, None]:
    """Locate the JSON string body from a string"""
    maybe_json_str = re.search(r"{.*}", content, re.DOTALL)
    if maybe_json_str is not None:
        return maybe_json_str.group(0)
    else:
        return None


def convert_response_to_json(response: str) -> dict:
    json_str = locate_json_string_body_from_string(response)
    assert json_str is not None, f"Unable to parse JSON from response: {response}"
    try:
        data = json.loads(json_str)
        return data
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {json_str}")
        raise e from None


def limit_async_func_call(max_size: int, waitting_time: float = 0.0001):
    """Add restriction of maximum async calling times for a async func"""

    def final_decro(func):
        """Not using async.Semaphore to aovid use nest-asyncio"""
        __current_size = 0

        @wraps(func)
        async def wait_func(*args, **kwargs):
            nonlocal __current_size
            while __current_size >= max_size:
                await asyncio.sleep(waitting_time)
            __current_size += 1
            result = await func(*args, **kwargs)
            __current_size -= 1
            return result

        return wait_func

    return final_decro


def wrap_embedding_func_with_attrs(**kwargs):
    """Wrap a function with attributes"""

    def final_decro(func) -> EmbeddingFunc:
        new_func = EmbeddingFunc(**kwargs, func=func)
        return new_func

    return final_decro


def load_json(file_name):
    if not os.path.exists(file_name):
        return None
    with open(file_name, encoding="utf-8") as f:
        return json.load(f)


def write_json(json_obj, file_name):
    with open(file_name, "w", encoding="utf-8") as f:
        json.dump(json_obj, f, indent=2, ensure_ascii=False)


def encode_string_by_tiktoken(content: str, model_name: str = "gpt-4o"):
    global ENCODER
    if ENCODER is None:
        ENCODER = tiktoken.encoding_for_model(model_name)
    tokens = ENCODER.encode(content)
    return tokens


def decode_tokens_by_tiktoken(tokens: list[int], model_name: str = "gpt-4o"):
    global ENCODER
    if ENCODER is None:
        ENCODER = tiktoken.encoding_for_model(model_name)
    content = ENCODER.decode(tokens)
    return content


def pack_user_ass_to_openai_messages(*args: str):
    roles = ["user", "assistant"]
    return [
        {"role": roles[i % 2], "content": content} for i, content in enumerate(args)
    ]


def split_string_by_multi_markers(content: str, markers: list[str]) -> list[str]:
    """Split a string by multiple markers"""
    if not markers:
        return [content]
    results = re.split("|".join(re.escape(marker) for marker in markers), content)
    return [r.strip() for r in results if r.strip()]


# Refer the utils functions of the official GraphRAG implementation:
# https://github.com/microsoft/graphrag
def clean_str(input: Any) -> str:
    """Clean an input string by removing HTML escapes, control characters, and other unwanted characters."""
    # If we get non-string input, just give it back
    if not isinstance(input, str):
        return input

    result = html.unescape(input.strip())
    # https://stackoverflow.com/questions/4324790/removing-control-characters-from-a-string-in-python
    return re.sub(r"[\x00-\x1f\x7f-\x9f]", "", result)


def is_float_regex(value):
    return bool(re.match(r"^[-+]?[0-9]*\.?[0-9]+$", value))


def truncate_list_by_token_size(list_data: list, key: callable, max_token_size: int):
    """Truncate a list of data by token size"""
    if max_token_size <= 0:
        return []
    tokens = 0
    for i, data in enumerate(list_data):
        tokens += len(encode_string_by_tiktoken(key(data)))
        if tokens > max_token_size:
            return list_data[:i]
    return list_data


def list_of_list_to_csv(data: List[List[str]]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerows(data)
    return output.getvalue()


def csv_string_to_list(csv_string: str) -> List[List[str]]:
    output = io.StringIO(csv_string)
    reader = csv.reader(output)
    return [row for row in reader]


def save_data_to_file(data, file_name):
    with open(file_name, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


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
                "entity_type": (
                    node.find("./data[@key='d0']", namespace).text.strip('"')
                    if node.find("./data[@key='d0']", namespace) is not None
                    else ""
                ),
                "description": (
                    node.find("./data[@key='d1']", namespace).text
                    if node.find("./data[@key='d1']", namespace) is not None
                    else ""
                ),
                "source_id": (
                    node.find("./data[@key='d2']", namespace).text
                    if node.find("./data[@key='d2']", namespace) is not None
                    else ""
                ),
            }
            data["nodes"].append(node_data)

        for edge in root.findall(".//edge", namespace):
            edge_data = {
                "source": edge.get("source").strip('"'),
                "target": edge.get("target").strip('"'),
                "weight": (
                    float(edge.find("./data[@key='d3']", namespace).text)
                    if edge.find("./data[@key='d3']", namespace) is not None
                    else 0.0
                ),
                "description": (
                    edge.find("./data[@key='d4']", namespace).text
                    if edge.find("./data[@key='d4']", namespace) is not None
                    else ""
                ),
                "keywords": (
                    edge.find("./data[@key='d5']", namespace).text
                    if edge.find("./data[@key='d5']", namespace) is not None
                    else ""
                ),
                "source_id": (
                    edge.find("./data[@key='d6']", namespace).text
                    if edge.find("./data[@key='d6']", namespace) is not None
                    else ""
                ),
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


def safe_unicode_decode(content):
    # Regular expression to find all Unicode escape sequences of the form \uXXXX
    unicode_escape_pattern = re.compile(r"\\u([0-9a-fA-F]{4})")

    # Function to replace the Unicode escape with the actual character
    def replace_unicode_escape(match):
        # Convert the matched hexadecimal value into the actual Unicode character
        return chr(int(match.group(1), 16))

    # Perform the substitution
    decoded_content = unicode_escape_pattern.sub(
        replace_unicode_escape, content.decode("utf-8")
    )

    return decoded_content


def process_combine_contexts(hl, ll):
    header = None
    list_hl = csv_string_to_list(hl.strip())
    list_ll = csv_string_to_list(ll.strip())

    if list_hl:
        header = list_hl[0]
        list_hl = list_hl[1:]
    if
```

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
    ASCIIColors.yellow(f"{args.chunk_overlap_size}")
    ASCIIColors.white("    ├─ History Turns: ", end="")
    ASCIIColors.yellow(f"{args.history_turns}")
    ASCIIColors.white("    ├─ Cosine Threshold: ", end="")
    ASCIIColors.yellow(f"{args.cosine_threshold}")
    ASCIIColors.white("    └─ Top-K: ", end="")
    ASCIIColors.yellow(f"{args.top_k}")

    # System Configuration
    ASCIIColors.magenta("\n🛠️ System Configuration:")
    ASCIIColors.white("    ├─ Ollama Emulating Model: ", end="")
    ASCIIColors.yellow(f"{ollama_server_infos.LIGHTRAG_MODEL}")
    ASCIIColors.white("    ├─ Log Level: ", end="")
    ASCIIColors.yellow(f"{args.log_level}")
    ASCIIColors.white("    ├─ Timeout: ", end="")
    ASCIIColors.yellow(f"{args.timeout if args.timeout else 'None (infinite)'}")
    ASCIIColors.white("    └─ API Key: ", end="")
    ASCIIColors.yellow("Set" if args.key else "Not Set")

    # Server Status
    ASCIIColors.green("\n✨ Server starting up...\n")

    # Server Access Information
    protocol = "https" if args.ssl else "http"
    if args.host == "0.0.0.0":
        ASCIIColors.magenta("\n🌐 Server Access Information:")
        ASCIIColors.white("    ├─ Local Access: ", end="")
        ASCIIColors.yellow(f"{protocol}://localhost:{args.port}")
        ASCIIColors.white("    ├─ Remote Access: ", end="")
        ASCIIColors.yellow(f"{protocol}://<your-ip-address>:{args.port}")
        ASCIIColors.white("    ├─ API Documentation (local): ", end="")
        ASCIIColors.yellow(f"{protocol}://localhost:{args.port}/docs")
        ASCIIColors.white("    └─ Alternative Documentation (local): ", end="")
        ASCIIColors.yellow(f"{protocol}://localhost:{args.port}/redoc")

        ASCIIColors.yellow("\n📝 Note:")
        ASCIIColors.white("""    Since the server is running on 0.0.0.0:
    - Use 'localhost' or '127.0.0.1' for local access
    - Use your machine's IP address for remote access
    - To find your IP address:
      • Windows: Run 'ipconfig' in terminal
      • Linux/Mac: Run '
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

        const updateIndexedFiles = async () => {
            const response = await fetchWithAuth('/health');
            const data = await response.json();
            indexedFiles.innerHTML = data.indexed_files.map(file => `
                <div class="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm">
                    <span>${file}</span>
                </div>
            `).join('');
        };

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-blue-500');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('border-blue-500');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-blue-500');
            const files = Array.from(e.dataTransfer.files);
            state.files.push(...files);
            updateFileList();
        });

        fileInput.addEventListener('change', () => {
            state.files.push(...Array.from(fileInput.files));
            updateFileList();
        });

        uploadBtn.addEventListener('click', async () => {
            if (state.files.length === 0) {
                showToast('Please select files to upload');
                return;
            }
            let apiKey = localStorage.getItem('apiKey') || '';
            const progress = document.getElementById('uploadProgress');
            const progressBar = progress.querySelector('div');
            const statusText = document.getElementById('uploadStatus');
            progress.classList.remove('hidden');

            for (let i = 0; i < state.files.length; i++) {
                const formData = new FormData();
                formData.append('file', state.files[i]);

                try {
                    await fetch('/documents/upload', {
                        method: 'POST',
                        headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` 
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

### Core Architecture Module: `minirag/base.py`
```
from abc import abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, TypedDict, Optional, Union, Literal, Generic, TypeVar
import os
import numpy as np
from .utils import EmbeddingFunc

TextChunkSchema = TypedDict(
    "TextChunkSchema",
    {"tokens": int, "content": str, "full_doc_id": str, "chunk_order_index": int},
)

T = TypeVar("T")


@dataclass
class QueryParam:
    mode: Literal["light", "naive", "mini"] = "mini"
    only_need_context: bool = False
    only_need_prompt: bool = False
    response_type: str = "Multiple Paragraphs"
    stream: bool = False
    # Number of top-k items to retrieve; corresponds to entities in "local" mode and relationships in "global" mode.
    top_k: int = int(os.getenv("TOP_K", "60"))
    # Number of document chunks to retrieve.
    # top_n: int = 10
    # Number of tokens for the original chunks.
    max_token_for_text_unit: int = 4000
    # Number of tokens for the relationship descriptions
    max_token_for_global_context: int = 4000
    # Number of tokens for the entity descriptions
    max_token_for_local_context: int = 4000

    max_token_for_node_context: int = 500#For Mini, if too long, SLM may be fail to generate any response

    hl_keywords: list[str] = field(default_factory=list)
    ll_keywords: list[str] = field(default_factory=list)
    # Conversation history support
    conversation_history: list[dict] = field(
        default_factory=list
    )  # Format: [{"role": "user/assistant", "content": "message"}]
    history_turns: int = (
        3  # Number of complete conversation turns (user-assistant pairs) to consider
    )


@dataclass
class StorageNameSpace:
    namespace: str
    global_config: dict

    async def index_done_callback(self):
        """commit the storage operations after indexing"""
        pass

    async def query_done_callback(self):
        """commit the storage operations after querying"""
        pass


@dataclass
class BaseVectorStorage(StorageNameSpace):
    embedding_func: EmbeddingFunc
    meta_fields: set = field(default_factory=set)

    async def query(self, query: str, top_k: int) -> list[dict]:
        raise NotImplementedError

    async def upsert(self, data: dict[str, dict]):
        """Use 'content' field from value for embedding, use key as id.
        If embedding_func is None, use 'embedding' field from value
        """
        raise NotImplementedError


@dataclass
class BaseKVStorage(Generic[T], StorageNameSpace):
    embedding_func: EmbeddingFunc

    async def all_keys(self) -> list[str]:
        raise NotImplementedError

    async def get_by_id(self, id: str) -> Union[T, None]:
        raise NotImplementedError

    async def get_by_ids(
        self, ids: list[str], fields: Union[set[str], None] = None
    ) -> list[Union[T, None]]:
        raise NotImplementedError

    async def filter_keys(self, data: list[str]) -> set[str]:
        """return un-exist keys"""
        raise NotImplementedError

    async def upsert(self, data: dict[str, T]):
        raise NotImplementedError

    async def drop(self):
        raise NotImplementedError


@dataclass
class BaseGraphStorage(StorageNameSpace):
    embedding_func: EmbeddingFunc = None

    @abstractmethod
    async def get_types(self) -> tuple[list[str], list[str]]:
        raise NotImplementedError

    async def has_node(self, node_id: str) -> bool:
        raise NotImplementedError

    async def has_edge(self, source_node_id: str, target_node_id: str) -> bool:
        raise NotImplementedError

    async def node_degree(self, node_id: str) -> int:
        raise NotImplementedError

    async def edge_degree(self, src_id: str, tgt_id: str) -> int:
        raise NotImplementedError

    async def get_node(self, node_id: str) -> Union[dict, None]:
        raise NotImplementedError

    async def get_edge(
        self, source_node_id: str, target_node_id: str
    ) -> Union[dict, None]:
        raise NotImplementedError

    async def get_node_edges(
        self, source_node_id: str
    ) -> Union[list[tuple[str, str]], None]:
        raise NotImplementedError

    async def upsert_node(self, node_id: str, node_data: dict[str, str]):
        raise NotImplementedError

    async def upsert_edge(
        self, source_node_id: str, target_node_id: str, edge_data: dict[str, str]
    ):
        raise NotImplementedError

    async def delete_node(self, node_id: str):
        raise NotImplementedError

    async def embed_nodes(self, algorithm: str) -> tuple[np.ndarray, list[str]]:
        raise NotImplementedError("Node embedding is not used in minirag.")


class DocStatus(str, Enum):
    """Document processing status enum"""

    PENDING = "pending"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"


@dataclass
class DocProcessingStatus:
    """Document processing status data structure"""

    content: str
    """Original content of the document"""
    content_summary: str
    """First 100 chars of document content, used for preview"""
    content_length: int
    """Total length of document"""
    status: DocStatus
    """Current processing status"""
    created_at: str
    """ISO format timestamp when document was created"""
    updated_at: str
    """ISO format timestamp when document was last updated"""
    chunks_count: Optional[int] = None
    """Number of chunks after splitting, used for processing"""
    error: Optional[str] = None
    """Error message if failed"""
    metadata: dict[str, Any] = field(default_factory=dict)
    """Additional metadata"""


class DocStatusStorage(BaseKVStorage):
    """Base class for document status storage"""

    async def get_status_counts(self) -> dict[str, int]:
        """Get counts of documents in each status"""
        raise NotImplementedError

    async def get_failed_docs(self) -> dict[str, DocProcessingStatus]:
        """Get all failed documents"""
        raise NotImplementedError

    async def get_pending_docs(self) -> dict[str, DocProcessingStatus]:
        """Get all pending documents"""
        raise NotImplementedError

```

### Core Architecture Module: `minirag/exceptions.py`
```
import httpx
from typing import Literal


class APIStatusError(Exception):
    """Raised when an API response has a status code of 4xx or 5xx."""

    response: httpx.Response
    status_code: int
    request_id: str | None

    def __init__(
        self, message: str, *, response: httpx.Response, body: object | None
    ) -> None:
        super().__init__(message, response.request, body=body)
        self.response = response
        self.status_code = response.status_code
        self.request_id = response.headers.get("x-request-id")


class APIConnectionError(Exception):
    def __init__(
        self, *, message: str = "Connection error.", request: httpx.Request
    ) -> None:
        super().__init__(message, request, body=None)


class BadRequestError(APIStatusError):
    status_code: Literal[400] = 400  # pyright: ignore[reportIncompatibleVariableOverride]


class AuthenticationError(APIStatusError):
    status_code: Literal[401] = 401  # pyright: ignore[reportIncompatibleVariableOverride]


class PermissionDeniedError(APIStatusError):
    status_code: Literal[403] = 403  # pyright: ignore[reportIncompatibleVariableOverride]


class NotFoundError(APIStatusError):
    status_code: Literal[404] = 404  # pyright: ignore[reportIncompatibleVariableOverride]


class ConflictError(APIStatusError):
    status_code: Literal[409] = 409  # pyright: ignore[reportIncompatibleVariableOverride]


class UnprocessableEntityError(APIStatusError):
    status_code: Literal[422] = 422  # pyright: ignore[reportIncompatibleVariableOverride]


class RateLimitError(APIStatusError):
    status_code: Literal[429] = 429  # pyright: ignore[reportIncompatibleVariableOverride]


class APITimeoutError(APIConnectionError):
    def __init__(self, request: httpx.Request) -> None:
        super().__init__(message="Request timed out.", request=request)

```

### Core Architecture Module: `minirag/kg/__init__.py`
```
# print ("init package vars here. ......")

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
+                content: id_ for id_, content in contents.items()
+            }.items()
+        }
         new_docs: dict[str, Any] = {
             id_: {
                 "content": content,
@@ -408,15 +432,23 @@ async def apipeline_enqueue_documents(self, input: str | list[str], ids: list[st
         all_new_doc_ids = set(new_docs.keys())
         unique_new_doc_ids = await self.doc_status.filter_keys(all_new_doc_ids)
 
-        new_docs = {doc_id: new_docs[doc_id] for doc_id in unique_new_doc_ids if doc_id in new_docs}
+        new_docs = {
+            doc_id: new_docs[doc_id]
+            for doc_id in unique_new_doc_ids
+            if doc_id in new_docs
+        }
         if not new_docs:
             logger.info("No new unique documents were found.")
             return
 
         await self.doc_status.upsert(new_docs)
         logger.info(f"Stored {len(new_docs)} new unique documents")
 
-    async def apipeline_process_enqueue_documents(self, split_by_character: str | None = None, split_by_cha
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

---

### Incident Patch 11: `cda07f7f` (2025-02-28)
**Commit Message**: qa fixes

**File**: `dataset/LiHua-World/qa/query_set.csv` (modified, +5/-5)
```diff
@@ -4,7 +4,7 @@ Did Adam Smith send a message to Li Hua about the upcoming building maintenance
 Did Li Hua agree to go out for dinner after Wolfgang first asked him if he wanted to go out for dinner?,Yes,20260123_17:00<and>20260930_16:00,Multi
 Did Li Hua send a message to Jennifer thanking her for the new training schedule before he requested a change in his training schedule for Thursday?,Yes,20260204_15:00<and>20260204_16:00<and>20260211_19:00,Multi
 Did Li Hua ask Jennifer for advice on how to prevent muscle soreness after an intense workout session before he told her that he feels soreness in his arm muscles after the workout this week?,Yes,20260206_16:00<and>20260811_11:00<and>20261008_14:00<and>20261211_11:00,Multi
-Did Li Hua send a message to Jennifer asking for her opinion on protein supplements before he consulted her about his daily protein powder consumption?,Yes,20260213_16:00<and>20261120_20:00,Multi
+Did Li Hua send a message to Jennifer asking for her opinion on protein supplements before he consulted her about his daily protein powder consumption?,Yes,20260214_16:00<and>20261120_20:00,Multi
 "Did Yuriko ask Li Hua for help with her studio's homepage before she booked a seat at the ""Central Perk"" cafe?",Yes,20260223_15:00<and>20260225_15:00,Multi
 Did Li Hua discuss his progress with the fitness plan before he shared a blog post about his recent fitness achievements?,Yes,20260305_17:00<and>20260325_19:00<and>20260610_16:00<and>20260630_18:00<and>20260708_14:00<and>20260817_12:15<and>20261022_22:00<and>20261202_14:00,Multi
 Did Li Hua send a message to Jennifer asking if he can turn the Thursday class to Friday after he requested a change in his training schedule for Thursday?,Yes,20260211_19:00<and>20260309_12:00,Multi
@@ -55,7 +55,7 @@ Did Li Hua send a message to Wolfgang Schulz saying that he has prepared all the
 Did Li Hua provide feedback to Jennifer Moore on his new meal plan before he asked her for advice on a healthy meal plan?,No,20260115_16:45<and>20260122_15:00,Multi
 Did Li Hua's complaint about the customer who modifies their requirements occur before Wolfgang comforted him?,No,20260123_17:30<and>20260131_14:00,Multi
 Did Adam Smith send Li Hua a reminder about the upcoming rent due date before Li Hua sent a message about having already transferred the rent on 20260301?,Yes,20260127_20:30<and>20260227_18:30<and>20260301_10:00<and>20260330_18:00<and>20260331_17:00<and>20260429_17:00<and>20260429_18:00,Multi
-Did Li Hua share a blog post about his recent fitness achievements after Jennifer sent him a motivational message?,Yes,20260129_14:00<and>20260520_18:00<and>20260606_09:00<and>20260817_12:15<and>20261022_22:00<and>20261202_14:00,Multi
+Did Li Hua share a blog post about his recent fitness achievements after Jennifer sent him a motivational message?,Yes,20260520_18:00<and>20260606_09:00<and>20260817_12:15<and>20261022_22:00<and>20261202_14:00,Multi
 Did Li Hua send a follow-up message to Jennifer before she asked him about his latest sleeping schedule?,Yes,20260205_13:00<and>20260725_10:00,Multi
 Did Li Hua ask Adam Smith about placing potted plants in the basement before he asked about decorating the basement?,No,20260219_20:00<and>20261214_14:00,Multi
 Did Li Hua ask Wolfgang for advice on renovating the basement before he invited Adam Smith to check the progress of the basement renovation?,Yes,20260219_20:10<and>20260223_17:00<and>20260707_16:00,Multi
@@ -195,8 +195,8 @@ Why deoes the construction have to be postponed according to Tirion Fordring?,th
 What kinds of Thai food does Wolfgang want to try out at the Thai restaurant on 20260702?,pad thai and maybe some spring rolls,20260702_15:00,Single
 What song does Yuriko propose that the band can practice this weekend according to the band's discussion on 20260703?,Take Me Home Country Roads by John Denver,20260703_11:45,Single
 What is the name of the song that Yuriko recommend to the band on 20260706?,Rolling in the Deep by Adele,20260706_19:30,Single
-Why are LiHua and Adam concerned about the basement in their conversation on 20270707?,They want to check if there were any issues in the basement after those rainstorms,20260707_16:00,Single
-Why is Jennifer checking in in the gym group chat on 20260708?,She wants to hear how the members are all doing and offer some personalized advice.20270708_14:00,Why,Single
+Why are LiHua and Adam concerned about the basement in their conversation on 20260707?,They want to check if there were any issues in the basement after those rainstorms,20260707_16:00,Single
+Why is Jennifer checking in in the gym group chat on 20260708?,She wants to hear how the members are all doing and offer some personalized advice.20260708_14:00,Why,Single
 What is the article that Chae shares with LiHua about?,how to fall asleep faster at night,20260711_11:00,Single
 What is LiHua's feeback on Hailey's new artisanal donuts?,The flavors are so unique and delicious,20260712_16:00,Single
 What new flavor is
```

**File**: `dataset/LiHua-World/qa/query_set.json` (modified, +5/-5)
```diff
@@ -32,7 +32,7 @@
     "5": {
         "question": "Did Li Hua send a message to Jennifer asking for her opinion on protein supplements before he consulted her about his daily protein powder consumption?",
         "answer": "Yes",
-        "evidence": "20260213_16:00<and>20261120_20:00",
+        "evidence": "20260214_16:00<and>20261120_20:00",
         "type": "Multi"
     },
     "6": {
@@ -338,7 +338,7 @@
     "56": {
         "question": "Did Li Hua share a blog post about his recent fitness achievements after Jennifer sent him a motivational message?",
         "answer": "Yes",
-        "evidence": "20260129_14:00<and>20260520_18:00<and>20260606_09:00<and>20260817_12:15<and>20261022_22:00<and>20261202_14:00",
+        "evidence": "20260520_18:00<and>20260606_09:00<and>20260817_12:15<and>20261022_22:00<and>20261202_14:00",
         "type": "Multi"
     },
     "57": {
@@ -1176,14 +1176,14 @@
         "type": "Single"
     },
     "196": {
-        "question": "Why are LiHua and Adam concerned about the basement in their conversation on 20270707?",
+        "question": "Why are LiHua and Adam concerned about the basement in their conversation on 20260707?",
         "answer": "They want to check if there were any issues in the basement after those rainstorms",
         "evidence": "20260707_16:00",
         "type": "Single"
     },
     "197": {
         "question": "Why is Jennifer checking in in the gym group chat on 20260708?",
-        "answer": "She wants to hear how the members are all doing and offer some personalized advice.20270708_14:00",
+        "answer": "She wants to hear how the members are all doing and offer some personalized advice.20260708_14:00",
         "evidence": "Why",
         "type": "Single"
     },
@@ -3720,7 +3720,7 @@
         "type": "Null"
     },
     "620": {
-        "question": "What are the sales figures for the PS5 exclusive games released in 2027 that Thane discussed with group members?",
+        "question": "What are the sales figures for the PS5 exclusive games released in 2026 that Thane discussed with group members?",
         "answer": "Insufficient information",
         "evidence": "N/A",
         "type": "Null"
```

---

### Incident Patch 12: `20fbf07f` (2025-02-27)
**Commit Message**: upd README and fix bugs

**File**: `MANIFEST.in` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+include README.md
+include requirements.txt
+include minirag/api/requirements.txt" > MANIFEST.in
\ No newline at end of file
```

**File**: `README.md` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ The Code Repository: **MiniRAG: Towards Extremely Simple Retrieval-Augmented Gen
 
 
 ## 🎉 News
+- [x] [2025.02.27]🎯📢Now you can use `pip install minirag-hku` to run our code!
 - [x] [2025.02.14]🎯📢Now MiniRAG supports 10+ heterogeneous graph databases, including Neo4j, PostgreSQL, TiDB, etc. Happy valentine's day!🌹🌹🌹
 - [x] [2025.02.05]🎯📢Our team has released [VideoRAG](https://github.com/HKUDS/VideoRAG) understanding extremely long-context videos.
 - [x] [2025.02.01]🎯📢Now MiniRAG supports API&Docker deployment. see [This](./minirag/api/README.md) for more details.
```

**File**: `README_CN.md` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@
 
 
 ## 🎉 News
+- [x] [2025.02.27]🎯📢现在您可以使用 `pip install minirag-hku` 来运行我们的代码！
 - [x] [2025.02.14]🎯📢现在MiniRAG支持包括Neo4j、PostgreSQL、TiDB等在内的10多种异构图数据库。情人节快乐！🌹🌹🌹
 - [x] [2025.02.05]🎯📢我们的团队发布了[VideoRAG](https://github.com/HKUDS/VideoRAG)，能够理解极长上下文视频。
 - [x] [2025.02.01]🎯📢现在MiniRAG支持API和Docker部署。更多详情请参见[这里](./minirag/api/README.md)。
```

**File**: `README_JA.md` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@
 [English](./README.md) | [中文](./README_CN.md)
 
 ## 🎉 News
+- [x] [2025.02.27]🎯📢`pip install minirag-hku`を使用して私たちのコードを実行できるようになりました！
 - [x] [2025.02.14]🎯📢MiniRAGがNeo4j、PostgreSQL、TiDBなど10以上の異種グラフデータベースをサポートするようになりました。バレンタインデーおめでとう！🌹🌹🌹
 - [x] [2025.02.05]🎯📢私たちのチームは、非常に長いコンテキストの動画を理解するVideoRAGをリリースしました。
 - [x] [2025.02.01]🎯📢MiniRAGがAPI&Dockerデプロイメントをサポートするようになりました。詳細はこちらをご覧ください。
```

**File**: `pyproject.toml` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+[build-system]
+requires = ["setuptools>=45", "wheel"]
+build-backend = "setuptools.build_meta"
+
+[project]
+name = "minirag-hku"
+version = "0.0.2"
+authors = [
+    {name = "Tianyu Fan"},
+]
+description = "MiniRAG: Towards Extremely Simple Retrieval-Augmented Generation"
+readme = "README.md"
+requires-python = ">=3.9"
+classifiers = [
+    "Development Status :: 4 - Beta",
+    "Programming Language :: Python :: 3",
+    "License :: OSI Approved :: MIT License",
+    "Operating System :: OS Independent",
+    "Intended Audience :: Developers",
+    "Topic :: Software Development :: Libraries :: Python Modules",
+]
+
+[tool.setuptools]
+packages = ["minirag"]
\ No newline at end of file
```

**File**: `setup.py` (modified, +7/-6)
```diff
@@ -36,17 +36,18 @@ def read_api_requirements():
 long_description = read_long_description()
 requirements = read_requirements()
 
+
 setuptools.setup(
     name="minirag-hku",
     url="https://github.com/HKUDS/MiniRAG",
     version="0.0.2",
-    author="HKUDS",
+    author="Tianyu Fan",
     description="MiniRAG: Towards Extremely Simple Retrieval-Augmented Generation",
     long_description=long_description,
     long_description_content_type="text/markdown",
     packages=setuptools.find_packages(
         exclude=("tests*", "docs*")
-    ),  # Automatically find packages
+    ),
     classifiers=[
         "Development Status :: 4 - Beta",
         "Programming Language :: Python :: 3",
@@ -55,15 +56,15 @@ def read_api_requirements():
         "Intended Audience :: Developers",
         "Topic :: Software Development :: Libraries :: Python Modules",
     ],
-    python_requires=">=3.9",  # rec: 3.9.19
+    python_requires=">=3.9",
     install_requires=requirements,
-    include_package_data=True,  # Includes non-code files from MANIFEST.in
+    include_package_data=True,
     extras_require={
-        "api": read_api_requirements(),  # API requirements as optional
+        "api": read_api_requirements(),
     },
     entry_points={
         "console_scripts": [
             "minirag-server=minirag.api.minirag_server:main [api]",
         ],
     },
-)
+)
\ No newline at end of file
```

---

### Incident Patch 13: `1bfc65ca` (2025-02-27)
**Commit Message**: Merge pull request #34 from yashshah035/fix-imports

fix imports

**File**: `minirag/api/README.md` (modified, +1/-1)
```diff
@@ -453,7 +453,7 @@ source /home/netman/minirag-xyj/venv/bin/activate
 lightrag-server
 ```
 
-Install lightrag.service in Linux.  Sample commands in Ubuntu server look like:
+Install minirag.service in Linux.  Sample commands in Ubuntu server look like:
 #Note: lightrag-server.service is the service file name, you can change it to minirag-server.service as needed.
 ```shell
 sudo cp lightrag-server.service /etc/systemd/system/
```

**File**: `minirag/kg/json_kv_impl.py` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@
     - Remove nodes and edges from the graph
 
 Usage:
-    from lightrag.storage.networkx_storage import NetworkXStorage
+    from minirag.storage.networkx_storage import NetworkXStorage
 
 """
 
```

**File**: `minirag/kg/jsondocstatus_impl.py` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@
     - Remove nodes and edges from the graph
 
 Usage:
-    from lightrag.storage.networkx_storage import NetworkXStorage
+    from minirag.storage.networkx_storage import NetworkXStorage
 
 """
 
```

**File**: `minirag/kg/milvus_impl.py` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 from tqdm.asyncio import tqdm as tqdm_async
 from dataclasses import dataclass
 import numpy as np
-from lightrag.utils import logger
+from minirag.utils import logger
 from ..base import BaseVectorStorage
 
 import pipmaster as pm
```

**File**: `minirag/kg/mongo_impl.py` (modified, +4/-4)
```diff
@@ -10,10 +10,10 @@
 from pymongo import MongoClient
 from motor.motor_asyncio import AsyncIOMotorClient
 from typing import Union, List, Tuple
-from lightrag.utils import logger
+from minirag.utils import logger
 
-from lightrag.base import BaseKVStorage
-from lightrag.base import BaseGraphStorage
+from minirag.base import BaseKVStorage
+from minirag.base import BaseGraphStorage
 
 
 @dataclass
@@ -437,4 +437,4 @@ async def embed_nodes(self, algorithm: str) -> Tuple[np.ndarray, List[str]]:
         """
         Placeholder for demonstration, raises NotImplementedError.
         """
-        raise NotImplementedError("Node embedding is not used in lightrag.")
+        raise NotImplementedError("Node embedding is not used in minirag.")
```

**File**: `minirag/kg/nano_vector_db_impl.py` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@
     - Remove nodes and edges from the graph
 
 Usage:
-    from lightrag.storage.networkx_storage import NetworkXStorage
+    from minirag.storage.networkx_storage import NetworkXStorage
 
 """
 
```

**File**: `minirag/kg/postgres_impl_test.py` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 import asyncpg
 import psycopg
 from psycopg_pool import AsyncConnectionPool
-from lightrag.kg.postgres_impl import PostgreSQLDB, PGGraphStorage
+from minirag.kg.postgres_impl import PostgreSQLDB, PGGraphStorage
 
 DB = "rag"
 USER = "rag"
```

**File**: `minirag/llm.py` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@ async def llm_model_func(
     import asyncio
 
     async def main():
-        from lightrag.llm.openai import gpt_4o_mini_complete
+        from minirag.llm.openai import gpt_4o_mini_complete
 
         result = await gpt_4o_mini_complete("How are you?")
         print(result)
```

---

### Incident Patch 14: `ae4a27e2` (2025-02-25)
**Commit Message**: fix imports

**File**: `minirag/api/README.md` (modified, +1/-1)
```diff
@@ -453,7 +453,7 @@ source /home/netman/minirag-xyj/venv/bin/activate
 lightrag-server
 ```
 
-Install lightrag.service in Linux.  Sample commands in Ubuntu server look like:
+Install minirag.service in Linux.  Sample commands in Ubuntu server look like:
 #Note: lightrag-server.service is the service file name, you can change it to minirag-server.service as needed.
 ```shell
 sudo cp lightrag-server.service /etc/systemd/system/
```

**File**: `minirag/kg/json_kv_impl.py` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@
     - Remove nodes and edges from the graph
 
 Usage:
-    from lightrag.storage.networkx_storage import NetworkXStorage
+    from minirag.storage.networkx_storage import NetworkXStorage
 
 """
 
```

**File**: `minirag/kg/jsondocstatus_impl.py` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@
     - Remove nodes and edges from the graph
 
 Usage:
-    from lightrag.storage.networkx_storage import NetworkXStorage
+    from minirag.storage.networkx_storage import NetworkXStorage
 
 """
 
```

**File**: `minirag/kg/milvus_impl.py` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
 from tqdm.asyncio import tqdm as tqdm_async
 from dataclasses import dataclass
 import numpy as np
-from lightrag.utils import logger
+from minirag.utils import logger
 from ..base import BaseVectorStorage
 
 import pipmaster as pm
```

**File**: `minirag/kg/mongo_impl.py` (modified, +4/-4)
```diff
@@ -10,10 +10,10 @@
 from pymongo import MongoClient
 from motor.motor_asyncio import AsyncIOMotorClient
 from typing import Union, List, Tuple
-from lightrag.utils import logger
+from minirag.utils import logger
 
-from lightrag.base import BaseKVStorage
-from lightrag.base import BaseGraphStorage
+from minirag.base import BaseKVStorage
+from minirag.base import BaseGraphStorage
 
 
 @dataclass
@@ -437,4 +437,4 @@ async def embed_nodes(self, algorithm: str) -> Tuple[np.ndarray, List[str]]:
         """
         Placeholder for demonstration, raises NotImplementedError.
         """
-        raise NotImplementedError("Node embedding is not used in lightrag.")
+        raise NotImplementedError("Node embedding is not used in minirag.")
```

**File**: `minirag/kg/nano_vector_db_impl.py` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@
     - Remove nodes and edges from the graph
 
 Usage:
-    from lightrag.storage.networkx_storage import NetworkXStorage
+    from minirag.storage.networkx_storage import NetworkXStorage
 
 """
 
```

**File**: `minirag/kg/postgres_impl_test.py` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 import asyncpg
 import psycopg
 from psycopg_pool import AsyncConnectionPool
-from lightrag.kg.postgres_impl import PostgreSQLDB, PGGraphStorage
+from minirag.kg.postgres_impl import PostgreSQLDB, PGGraphStorage
 
 DB = "rag"
 USER = "rag"
```

**File**: `minirag/llm.py` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@ async def llm_model_func(
     import asyncio
 
     async def main():
-        from lightrag.llm.openai import gpt_4o_mini_complete
+        from minirag.llm.openai import gpt_4o_mini_complete
 
         result = await gpt_4o_mini_complete("How are you?")
         print(result)
```

---

### Incident Patch 15: `7bdfac26` (2025-02-14)
**Commit Message**: fix bugs

**File**: `minirag/__init__.py` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 from .minirag import MiniRAG as MiniRAG, QueryParam as QueryParam
 
-__version__ = "1.0.0"
+__version__ = "0.0.2"
 __author__ = "Tianyu Fan"
 __url__ = "https://github.com/HKUDS/MiniRAG"
```

**File**: `minirag/base.py` (modified, +3/-0)
```diff
@@ -30,6 +30,9 @@ class QueryParam:
     max_token_for_global_context: int = 4000
     # Number of tokens for the entity descriptions
     max_token_for_local_context: int = 4000
+
+    max_token_for_node_context: int = 500#For Mini, if too long, SLM may be fail to generate any response
+
     hl_keywords: list[str] = field(default_factory=list)
     ll_keywords: list[str] = field(default_factory=list)
     # Conversation history support
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
