# Forensic Learning Record (Deep Inspection): gusye1234/nano-graphrag

> **Canonical Artifact**: `07_PROJECT_LEARNING/gusye1234-nano-graphrag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gusye1234/nano-graphrag](https://github.com/gusye1234/nano-graphrag))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:12:59.595Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gusye1234/nano-graphrag`
- **Description**: A simple, easy-to-hack GraphRAG implementation
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: N/A
- **Stars / Engagement**: 3991 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Remote API meta.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `nano_graphrag/_utils.py`
```
import asyncio
import html
import json
import logging
import os
import re
import numbers
from dataclasses import dataclass
from functools import wraps
from hashlib import md5
from typing import Any, Union, Literal

import numpy as np
import tiktoken


from transformers import AutoTokenizer

logger = logging.getLogger("nano-graphrag")
logging.getLogger("neo4j").setLevel(logging.ERROR)

def always_get_an_event_loop() -> asyncio.AbstractEventLoop:
    try:
        # If there is already an event loop, use it.
        loop = asyncio.get_event_loop()
    except RuntimeError:
        # If in a sub-thread, create a new event loop.
        logger.info("Creating a new event loop in a sub-thread.")
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop


def extract_first_complete_json(s: str):
    """Extract the first complete JSON object from the string using a stack to track braces."""
    stack = []
    first_json_start = None
    
    for i, char in enumerate(s):
        if char == '{':
            stack.append(i)
            if first_json_start is None:
                first_json_start = i
        elif char == '}':
            if stack:
                start = stack.pop()
                if not stack:
                    first_json_str = s[first_json_start:i+1]
                    try:
                        # Attempt to parse the JSON string
                        return json.loads(first_json_str.replace("\n", ""))
                    except json.JSONDecodeError as e:
                        logger.error(f"JSON decoding failed: {e}. Attempted string: {first_json_str[:50]}...")
                        return None
                    finally:
                        first_json_start = None
    logger.warning("No complete JSON object found in the input string.")
    return None

def parse_value(value: str):
    """Convert a string value to its appropriate type (int, float, bool, None, or keep as string). Work as a more broad 'eval()'"""
    value = value.strip()

    if value == "null":
        return None
    elif value == "true":
        return True
    elif value == "false":
        return False
    else:
        # Try to convert to int or float
        try:
            if '.' in value:  # If there's a dot, it might be a float
                return float(value)
            else:
                return int(value)
        except ValueError:
            # If conversion fails, return the value as-is (likely a string)
            return value.strip('"')  # Remove surrounding quotes if they exist

def extract_values_from_json(json_string, keys=["reasoning", "answer", "data"], allow_no_quotes=False):
    """Extract key values from a non-standard or malformed JSON string, handling nested objects."""
    extracted_values = {}
    
    # Enhanced pattern to match both quoted and unquoted values, as well as nested objects
    regex_pattern = r'(?P<key>"?\w+"?)\s*:\s*(?P<value>{[^}]*}|".*?"|[^,}]+)'
    
    for match in re.finditer(regex_pattern, json_string, re.DOTALL):
        key = match.group('key').strip('"')  # Strip quotes from key
        value = match.group('value').strip()

        # If the value is another nested JSON (starts with '{' and ends with '}'), recursively parse it
        if value.startswith('{') and value.endswith('}'):
            extracted_values[key] = extract_values_from_json(value)
        else:
            # Parse the value into the appropriate type (int, float, bool, etc.)
            extracted_values[key] = parse_value(value)

    if not extracted_values:
        logger.warning("No values could be extracted from the string.")
    
    return extracted_values


def convert_response_to_json(response: str) -> dict:
    """Convert response string to JSON, with error handling and fallback to non-standard JSON extraction."""
    prediction_json = extract_first_complete_json(response)
    
    if prediction_json is None:
        logger.info("Attempting to extract values from a non-standard JSON string...")
        prediction_json = extract_values_from_json(response, allow_no_quotes=True)
    
    if not prediction_json:
        logger.error("Unable to extract meaningful data from the response.")
    else:
        logger.info("JSON data successfully extracted.")
    
    return prediction_json




class TokenizerWrapper:
    def __init__(self, tokenizer_type: Literal["tiktoken", "huggingface"] = "tiktoken", model_name: str = "gpt-4o"):
        self.tokenizer_type = tokenizer_type
        self.model_name = model_name
        self._tokenizer = None
        self._lazy_load_tokenizer()

    def _lazy_load_tokenizer(self):
        if self._tokenizer is not None:
            return
        logger.info(f"Loading tokenizer: type='{self.tokenizer_type}', name='{self.model_name}'")
        if self.tokenizer_type == "tiktoken":
            self._tokenizer = tiktoken.encoding_for_model(self.model_name)
        elif self.tokenizer_type == "huggingface":
            if AutoTokenizer is None:
                raise ImportError("`transformers` is not installed. Please install it via `pip install transformers` to use HuggingFace tokenizers.")
            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name, use_fast=True)
        else:
            raise ValueError(f"Unknown tokenizer_type: {self.tokenizer_type}")

    def get_tokenizer(self):
        """提供对底层 tokenizer 对象的访问，用于特殊情况（如 decode_batch）。"""
        self._lazy_load_tokenizer()
        return self._tokenizer

    def encode(self, text: str) -> list[int]:
        self._lazy_load_tokenizer()
        return self._tokenizer.encode(text)

    def decode(self, tokens: list[int]) -> str:
        self._lazy_load_tokenizer()
        return self._tokenizer.decode(tokens)
    
    # +++ 新增 +++: 增加一个批量解码的方法以提高效率，并保持接口一致性
    def decode_batch(self, tokens_list: list[list[int]]) -> list[str]:
        self._lazy_load_tokenizer()
        # HuggingFace tokenizer 有 decode_batch，但 tiktoken 没有，我们用列表推导来模拟
        if self.tokenizer_type == "tiktoken":
            return [self._tokenizer.decode(tokens) for tokens in tokens_list]
        elif self.tokenizer_type == "huggingface":
            return self._tokenizer.batch_decode(tokens_list, skip_special_tokens=True)
        else:
             raise ValueError(f"Unknown tokenizer_type: {self.tokenizer_type}")
        


def truncate_list_by_token_size(
    list_data: list, 
    key: callable, 
    max_token_size: int, 
    tokenizer_wrapper: TokenizerWrapper
):
    """Truncate a list of data by token size using a provided tokenizer wrapper."""
    if max_token_size <= 0:
        return []
    tokens = 0
    for i, data in enumerate(list_data):
        tokens += len(tokenizer_wrapper.encode(key(data))) + 1 # 防御性，模拟通过\n拼接列表的情况
        if tokens > max_token_size:
            return list_data[:i]
    return list_data


def compute_mdhash_id(content, prefix: str = ""):
    return prefix + md5(content.encode()).hexdigest()


def write_json(json_obj, file_name):
    with open(file_name, "w", encoding="utf-8") as f:
        json.dump(json_obj, f, indent=2, ensure_ascii=False)


def load_json(file_name):
    if not os.path.exists(file_name):
        return None
    with open(file_name, encoding="utf-8") as f:
        return json.load(f)


# it's dirty to type, so it's a good way to have fun
def pack_user_ass_to_openai_messages(prompt: str, generated_content: str, using_amazon_bedrock: bool):
    if using_amazon_bedrock:
        return [
            {"role": "user", "content": [{"text": prompt}]},
            {"role": "assistant", "content": [{"text": generated_content}]},
        ]
    else:
        return [
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": generated_content},
        ]


def is_float_regex(value):
    return bool(re.match(r"^[-+]?[0-9]*\.?[0-9]+$", value))


def compute_args_hash(*args):
    return md5(str(args).encode()).hexdigest()


def split_string_by_multi_markers(content: str, markers: list[str]) -> list[str]:
    """Split a string by multiple markers"""
    if not markers:
        return [content]
    results = re.split("|".join(re.escape(marker) for marker in markers), content)
    return [r.strip() for r in results if r.strip()]


def enclose_string_with_quotes(content: Any) -> str:
    """Enclose a string with quotes"""
    if isinstance(content, numbers.Number):
        return str(content)
    content = str(content)
    content = content.strip().strip("'").strip('"')
    return f'"{content}"'


def list_of_list_to_csv(data: list[list]):
    return "\n".join(
        [
            ",\t".join([f"{enclose_string_with_quotes(data_dd)}" for data_dd in data_d])
            for data_d in data
        ]
    )


# -----------------------------------------------------------------------------------
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


# Utils types -----------------------------------------------------------------------
@dataclass
class EmbeddingFunc:
    embedding_dim: int
    max_token_size: int
    func: callable

    async def __call__(self, *args, **kwargs) -> np.ndarray:
        return await self.func(*args, **kwargs)


# Decorators ------------------------------------------------------------------------
def limit_async_func_call(max_size: int, waitting_time: float = 0.0001):
    """Add restriction of maximum async calling times for a async func"""

    def final_decro(func):
        """Not using async.Semaphore 
```

### Core Architecture Module: `examples/benchmarks/dspy_entity.py`
```
import dspy
import os
from dotenv import load_dotenv
from openai import AsyncOpenAI
import logging
import asyncio
import time
import shutil
from nano_graphrag.entity_extraction.extract import extract_entities_dspy
from nano_graphrag.base import BaseKVStorage
from nano_graphrag._storage import NetworkXStorage
from nano_graphrag._utils import compute_mdhash_id, compute_args_hash
from nano_graphrag._op import extract_entities

WORKING_DIR = "./nano_graphrag_cache_dspy_entity"

load_dotenv()

logger = logging.getLogger("nano-graphrag")
logger.setLevel(logging.DEBUG)


async def deepseepk_model_if_cache(
    prompt: str, model: str = "deepseek-chat", system_prompt : str = None, history_messages: list = [], **kwargs
) -> str:
    openai_async_client = AsyncOpenAI(
        api_key=os.environ.get("DEEPSEEK_API_KEY"), base_url="https://api.deepseek.com"
    )
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    # Get the cached response if having-------------------
    hashing_kv: BaseKVStorage = kwargs.pop("hashing_kv", None)
    messages.extend(history_messages)
    messages.append({"role": "user", "content": prompt})
    if hashing_kv is not None:
        args_hash = compute_args_hash(model, messages)
        if_cache_return = await hashing_kv.get_by_id(args_hash)
        if if_cache_return is not None:
            return if_cache_return["return"]
    # -----------------------------------------------------

    response = await openai_async_client.chat.completions.create(
        model=model, messages=messages, **kwargs
    )

    # Cache the response if having-------------------
    if hashing_kv is not None:
        await hashing_kv.upsert(
            {args_hash: {"return": response.choices[0].message.content, "model": model}}
        )
    # -----------------------------------------------------
    return response.choices[0].message.content


async def benchmark_entity_extraction(text: str, system_prompt: str, use_dspy: bool = False):
    working_dir = os.path.join(WORKING_DIR, f"use_dspy={use_dspy}")
    if os.path.exists(working_dir):
        shutil.rmtree(working_dir)

    start_time = time.time()
    graph_storage = NetworkXStorage(namespace="test", global_config={
        "working_dir": working_dir,
        "entity_summary_to_max_tokens": 500,
        "cheap_model_func": lambda *args, **kwargs: deepseepk_model_if_cache(*args, system_prompt=system_prompt, **kwargs),
        "best_model_func": lambda *args, **kwargs: deepseepk_model_if_cache(*args, system_prompt=system_prompt, **kwargs),
        "cheap_model_max_token_size": 4096,
        "best_model_max_token_size": 4096,
        "tiktoken_model_name": "gpt-4o",
        "hashing_kv": BaseKVStorage(namespace="test", global_config={"working_dir": working_dir}),
        "entity_extract_max_gleaning": 1,
        "entity_extract_max_tokens": 4096,
        "entity_extract_max_entities": 100,
        "entity_extract_max_relationships": 100,
    })
    chunks = {compute_mdhash_id(text, prefix="chunk-"): {"content": text}}
    
    if use_dspy:
        graph_storage = await extract_entities_dspy(chunks, graph_storage, None, graph_storage.global_config)
    else:
        graph_storage = await extract_entities(chunks, graph_storage, None, graph_storage.global_config)
    
    end_time = time.time()
    execution_time = end_time - start_time
    
    return graph_storage, execution_time


def print_extraction_results(graph_storage: NetworkXStorage):
    print("\nEntities:")
    entities = []
    for node, data in graph_storage._graph.nodes(data=True):
        entity_type = data.get('entity_type', 'Unknown')
        description = data.get('description', 'No description')
        entities.append(f"- {node} ({entity_type}):\n  {description}")
    print("\n".join(entities))

    print("\nRelationships:")
    relationships = []
    for source, target, data in graph_storage._graph.edges(data=True):
        description = data.get('description', 'No description')
        relationships.append(f"- {source} -> {target}:\n  {description}")
    print("\n".join(relationships))


async def run_benchmark(text: str):
    print("\nRunning benchmark with DSPy-AI:")
    system_prompt = """
    You are an expert system specialized in entity and relationship extraction from complex texts. 
    Your task is to thoroughly analyze the given text and extract all relevant entities and their relationships with utmost precision and completeness.
    """
    system_prompt_dspy = f"{system_prompt} Time: {time.time()}."
    lm = dspy.LM(
        model="deepseek/deepseek-chat", 
        model_type="chat",
        api_provider="openai",
        api_key=os.environ["DEEPSEEK_API_KEY"], 
        base_url=os.environ["DEEPSEEK_BASE_URL"], 
        system_prompt=system_prompt, 
        temperature=1.0,
        max_tokens=8192
    )
    dspy.settings.configure(lm=lm, experimental=True)
    graph_storage_with_dspy, time_with_dspy = await benchmark_entity_extraction(text, system_prompt_dspy, use_dspy=True)
    print(f"Execution time with DSPy-AI: {time_with_dspy:.2f} seconds")
    print_extraction_results(graph_storage_with_dspy)

    print("Running benchmark without DSPy-AI:")
    system_prompt_no_dspy = f"{system_prompt} Time: {time.time()}."
    graph_storage_without_dspy, time_without_dspy = await benchmark_entity_extraction(text, system_prompt_no_dspy, use_dspy=False)
    print(f"Execution time without DSPy-AI: {time_without_dspy:.2f} seconds")
    print_extraction_results(graph_storage_without_dspy)

    print("\nComparison:")
    print(f"Time difference: {abs(time_with_dspy - time_without_dspy):.2f} seconds")
    print(f"DSPy-AI is {'faster' if time_with_dspy < time_without_dspy else 'slower'}")

    entities_without_dspy = len(graph_storage_without_dspy._graph.nodes())
    entities_with_dspy = len(graph_storage_with_dspy._graph.nodes())
    relationships_without_dspy = len(graph_storage_without_dspy._graph.edges())
    relationships_with_dspy = len(graph_storage_with_dspy._graph.edges())

    print(f"Entities extracted: {entities_without_dspy} (without DSPy-AI) vs {entities_with_dspy} (with DSPy-AI)")
    print(f"Relationships extracted: {relationships_without_dspy} (without DSPy-AI) vs {relationships_with_dspy} (with DSPy-AI)")


if __name__ == "__main__":
    with open("./tests/zhuyuanzhang.txt", encoding="utf-8-sig") as f:
        text = f.read()

    asyncio.run(run_benchmark(text=text))

```

### Core Architecture Module: `examples/benchmarks/hnsw_vs_nano_vector_storage.py`
```
import asyncio
import time
import numpy as np
from tqdm import tqdm
from nano_graphrag import GraphRAG
from nano_graphrag._storage import NanoVectorDBStorage, HNSWVectorStorage
from nano_graphrag._utils import wrap_embedding_func_with_attrs


WORKING_DIR = "./nano_graphrag_cache_benchmark_hnsw_vs_nano_vector_storage"
DATA_LEN = 100_000
FAKE_DIM = 1024
BATCH_SIZE = 100000


@wrap_embedding_func_with_attrs(embedding_dim=FAKE_DIM, max_token_size=8192)
async def sample_embedding(texts: list[str]) -> np.ndarray:
    return np.float32(np.random.rand(len(texts), FAKE_DIM))


def generate_test_data():
    return {str(i): {"content": f"Test content {i}"} for i in range(DATA_LEN)}


async def benchmark_storage(storage_class, name):
    rag = GraphRAG(working_dir=WORKING_DIR, embedding_func=sample_embedding)
    storage = storage_class(
        namespace=f"benchmark_{name}",
        global_config=rag.__dict__,
        embedding_func=sample_embedding,
        meta_fields={"content"},
    )

    test_data = generate_test_data()
    
    print(f"Benchmarking {name}...")
    with tqdm(total=DATA_LEN, desc=f"{name} Benchmark") as pbar:
        start_time = time.time()
        for i in range(0, len(test_data), BATCH_SIZE):
            batch = {k: test_data[k] for k in list(test_data.keys())[i:i+BATCH_SIZE]}
            await storage.upsert(batch)
            pbar.update(min(BATCH_SIZE, DATA_LEN - i))
        
        insert_time = time.time() - start_time

        save_start_time = time.time()
        await storage.index_done_callback()
        save_time = time.time() - save_start_time
        pbar.update(1)

        query_vector = np.random.rand(FAKE_DIM)
        query_times = []
        for _ in range(100):
            query_start = time.time()
            await storage.query(query_vector, top_k=10)
            query_times.append(time.time() - query_start)
            pbar.update(1)
    
    avg_query_time = sum(query_times) / len(query_times)
    
    print(f"{name} - Insert: {insert_time:.2f}s, Save: {save_time:.2f}s, Avg Query: {avg_query_time:.4f}s")
    return insert_time, save_time, avg_query_time


async def run_benchmarks():
    print("Running NanoVectorDB benchmark...")
    nano_insert_time, nano_save_time, nano_query_time = await benchmark_storage(NanoVectorDBStorage, "nano")
    
    print("\nRunning HNSWVectorStorage benchmark...")
    hnsw_insert_time, hnsw_save_time, hnsw_query_time = await benchmark_storage(HNSWVectorStorage, "hnsw")
    
    print("\nBenchmark Results:")
    print(f"NanoVectorDB - Insert: {nano_insert_time:.2f}s, Save: {nano_save_time:.2f}s, Avg Query: {nano_query_time:.4f}s")
    print(f"HNSWVectorStorage - Insert: {hnsw_insert_time:.2f}s, Save: {hnsw_save_time:.2f}s, Avg Query: {hnsw_query_time:.4f}s")


if __name__ == "__main__":
    asyncio.run(run_benchmarks())
```

### Core Architecture Module: `examples/benchmarks/md5_vs_xxhash.py`
```
import time
import xxhash
from hashlib import md5
from tqdm import tqdm
import numpy as np


def xxhash_ids(data: list[str]) -> np.ndarray:
    return np.fromiter(
        (xxhash.xxh32_intdigest(d.encode()) for d in data),
        dtype=np.uint32,
        count=len(data)
    )


def md5_ids(data: list[str]) -> np.ndarray:
    return np.fromiter(
        (int(md5(d.encode()).hexdigest(), 16) & 0xFFFFFFFF for d in data),
        dtype=np.uint32,
        count=len(data)
    )


if __name__ == "__main__":
    num_ids = 1000000
    num_iterations = 100
    xxhash_times = []
    md5_times = []

    for i in tqdm(range(num_iterations)):
        test_data = [f"{i}_{j}" for j in range(num_ids)]
        
        start_time = time.time()
        xxhash_result = xxhash_ids(test_data)
        xxhash_times.append(time.time() - start_time)
        
        start_time = time.time()
        md5_result = md5_ids(test_data)
        md5_times.append(time.time() - start_time)
        
        assert len(xxhash_result) == len(md5_result) == num_ids
        assert not np.array_equal(xxhash_result, md5_result)

    avg_xxhash_time = np.mean(xxhash_times)
    avg_md5_time = np.mean(md5_times)
    std_xxhash_time = np.std(xxhash_times)
    std_md5_time = np.std(md5_times)

    print(f"num_ids: {num_ids} | num_iterations: {num_iterations}")
    print(f"\nAverage xxhash time: {avg_xxhash_time:.4f} seconds")
    print(f"Average MD5 time: {avg_md5_time:.4f} seconds")
    print(f"xxhash is {avg_md5_time / avg_xxhash_time:.2f}x faster than MD5 on average")
    print(f"\nxxhash time standard deviation: {std_xxhash_time:.4f} seconds")
    print(f"MD5 time standard deviation: {std_md5_time:.4f} seconds")
```

### Core Architecture Module: `examples/graphml_visualize.py`
```
import networkx as nx
import json
import os
import webbrowser
import http.server
import socketserver
import threading

# load GraphML file and transfer to JSON
def graphml_to_json(graphml_file):
    G = nx.read_graphml(graphml_file)
    data = nx.node_link_data(G)
    return json.dumps(data)


# create HTML file
def create_html(html_path):
    html_content = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Graph Visualization</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        svg {
            width: 100%;
            height: 100%;
        }
        .links line {
            stroke: #999;
            stroke-opacity: 0.6;
        }
        .nodes circle {
            stroke: #fff;
            stroke-width: 1.5px;
        }
        .node-label {
            font-size: 12px;
            pointer-events: none;
        }
        .link-label {
            font-size: 10px;
            fill: #666;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
        }
        .link:hover .link-label {
            opacity: 1;
        }
        .tooltip {
            position: absolute;
            text-align: left;
            padding: 10px;
            font: 12px sans-serif;
            background: lightsteelblue;
            border: 0px;
            border-radius: 8px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
            max-width: 300px;
        }
        .legend {
            position: absolute;
            top: 10px;
            right: 10px;
            background-color: rgba(255, 255, 255, 0.8);
            padding: 10px;
            border-radius: 5px;
        }
        .legend-item {
            margin: 5px 0;
        }
        .legend-color {
            display: inline-block;
            width: 20px;
            height: 20px;
            margin-right: 5px;
            vertical-align: middle;
        }
    </style>
</head>
<body>
    <svg></svg>
    <div class="tooltip"></div>
    <div class="legend"></div>
    <script type="text/javascript" src="./graph_json.js"></script>
    <script>
        const graphData = graphJson;
        
        const svg = d3.select("svg"),
            width = window.innerWidth,
            height = window.innerHeight;

        svg.attr("viewBox", [0, 0, width, height]);

        const g = svg.append("g");

        const entityTypes = [...new Set(graphData.nodes.map(d => d.entity_type))];
        const color = d3.scaleOrdinal(d3.schemeCategory10).domain(entityTypes);

        const simulation = d3.forceSimulation(graphData.nodes)
            .force("link", d3.forceLink(graphData.links).id(d => d.id).distance(150))
            .force("charge", d3.forceManyBody().strength(-300))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius(30));

        const linkGroup = g.append("g")
            .attr("class", "links")
            .selectAll("g")
            .data(graphData.links)
            .enter().append("g")
            .attr("class", "link");

        const link = linkGroup.append("line")
            .attr("stroke-width", d => Math.sqrt(d.value));

        const linkLabel = linkGroup.append("text")
            .attr("class", "link-label")
            .text(d => d.description || "");

        const node = g.append("g")
            .attr("class", "nodes")
            .selectAll("circle")
            .data(graphData.nodes)
            .enter().append("circle")
            .attr("r", 5)
            .attr("fill", d => color(d.entity_type))
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        const nodeLabel = g.append("g")
            .attr("class", "node-labels")
            .selectAll("text")
            .data(graphData.nodes)
            .enter().append("text")
            .attr("class", "node-label")
            .text(d => d.id);

        const tooltip = d3.select(".tooltip");

        node.on("mouseover", function(event, d) {
            tooltip.transition()
                .duration(200)
                .style("opacity", .9);
            tooltip.html(`<strong>${d.id}</strong><br>Entity Type: ${d.entity_type}<br>Description: ${d.description || "N/A"}`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        });

        const legend = d3.select(".legend");
        entityTypes.forEach(type => {
            legend.append("div")
                .attr("class", "legend-item")
                .html(`<span class="legend-color" style="background-color: ${color(type)}"></span>${type}`);
        });

        simulation
            .nodes(graphData.nodes)
            .on("tick", ticked);

        simulation.force("link")
            .links(graphData.links);

        function ticked() {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            linkLabel
                .attr("x", d => (d.source.x + d.target.x) / 2)
                .attr("y", d => (d.source.y + d.target.y) / 2)
                .attr("text-anchor", "middle")
                .attr("dominant-baseline", "middle");

            node
                .attr("cx", d => d.x)
                .attr("cy", d => d.y);

            nodeLabel
                .attr("x", d => d.x + 8)
                .attr("y", d => d.y + 3);
        }

        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        const zoom = d3.zoom()
            .scaleExtent([0.1, 10])
            .on("zoom", zoomed);

        svg.call(zoom);

        function zoomed(event) {
            g.attr("transform", event.transform);
        }

    </script>
</body>
</html>
    '''

    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)


def create_json(json_data, json_path):
    json_data = "var graphJson = " + json_data.replace('\\"', '').replace("'", "\\'").replace("\n", "")
    with open(json_path, 'w', encoding='utf-8') as f:
        f.write(json_data)


# start simple HTTP server
def start_server(port):
    handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"Server started at http://localhost:{port}")
        httpd.serve_forever()

# main function
def visualize_graphml(graphml_file, html_path, port=8000):
    json_data = graphml_to_json(graphml_file)
    html_dir = os.path.dirname(html_path)
    if not os.path.exists(html_dir):
        os.makedirs(html_dir)
    json_path = os.path.join(html_dir, 'graph_json.js')
    create_json(json_data, json_path)
    create_html(html_path)
    # start server in background
    server_thread = threading.Thread(target=start_server(port))
    server_thread.daemon = True
    server_thread.start()
    
    # open default browser
    webbrowser.open(f'http://localhost:{port}/{html_path}')
    
    print("Visualization is ready. Press Ctrl+C to exit.")
    try:
        # keep main thread running
        while True:
            pass
    except KeyboardInterrupt:
        print("Shutting down...")

# usage
if __name__ == "__main__":
    graphml_file = r"nano_graphrag_cache_azure_openai_TEST\graph_chunk_entity_relation.graphml"  # replace with your GraphML file path
    html_path = "graph_visualization.html"
    visualize_graphml(graphml_file, html_path, 11236)
```

### Core Architecture Module: `examples/no_openai_key_at_all.py`
```
import os
import logging
import ollama
import numpy as np
from nano_graphrag import GraphRAG, QueryParam
from nano_graphrag import GraphRAG, QueryParam
from nano_graphrag.base import BaseKVStorage
from nano_graphrag._utils import compute_args_hash, wrap_embedding_func_with_attrs
from sentence_transformers import SentenceTransformer

logging.basicConfig(level=logging.WARNING)
logging.getLogger("nano-graphrag").setLevel(logging.INFO)

# !!! qwen2-7B maybe produce unparsable results and cause the extraction of graph to fail.
WORKING_DIR = "./nano_graphrag_cache_ollama_TEST"
MODEL = "qwen2"

EMBED_MODEL = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2", cache_folder=WORKING_DIR, device="cpu"
)


# We're using Sentence Transformers to generate embeddings for the BGE model
@wrap_embedding_func_with_attrs(
    embedding_dim=EMBED_MODEL.get_sentence_embedding_dimension(),
    max_token_size=EMBED_MODEL.max_seq_length,
)
async def local_embedding(texts: list[str]) -> np.ndarray:
    return EMBED_MODEL.encode(texts, normalize_embeddings=True)


async def ollama_model_if_cache(
    prompt, system_prompt=None, history_messages=[], **kwargs
) -> str:
    # remove kwargs that are not supported by ollama
    kwargs.pop("max_tokens", None)
    kwargs.pop("response_format", None)

    ollama_client = ollama.AsyncClient()
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    # Get the cached response if having-------------------
    hashing_kv: BaseKVStorage = kwargs.pop("hashing_kv", None)
    messages.extend(history_messages)
    messages.append({"role": "user", "content": prompt})
    if hashing_kv is not None:
        args_hash = compute_args_hash(MODEL, messages)
        if_cache_return = await hashing_kv.get_by_id(args_hash)
        if if_cache_return is not None:
            return if_cache_return["return"]
    # -----------------------------------------------------
    response = await ollama_client.chat(model=MODEL, messages=messages, **kwargs)

    result = response["message"]["content"]
    # Cache the response if having-------------------
    if hashing_kv is not None:
        await hashing_kv.upsert({args_hash: {"return": result, "model": MODEL}})
    # -----------------------------------------------------
    return result


def remove_if_exist(file):
    if os.path.exists(file):
        os.remove(file)


def query():
    rag = GraphRAG(
        working_dir=WORKING_DIR,
        best_model_func=ollama_model_if_cache,
        cheap_model_func=ollama_model_if_cache,
        embedding_func=local_embedding,
    )
    print(
        rag.query(
            "What are the top themes in this story?", param=QueryParam(mode="global")
        )
    )


def insert():
    from time import time

    with open("./tests/mock_data.txt", encoding="utf-8-sig") as f:
        FAKE_TEXT = f.read()

    remove_if_exist(f"{WORKING_DIR}/vdb_entities.json")
    remove_if_exist(f"{WORKING_DIR}/kv_store_full_docs.json")
    remove_if_exist(f"{WORKING_DIR}/kv_store_text_chunks.json")
    remove_if_exist(f"{WORKING_DIR}/kv_store_community_reports.json")
    remove_if_exist(f"{WORKING_DIR}/graph_chunk_entity_relation.graphml")

    rag = GraphRAG(
        working_dir=WORKING_DIR,
        enable_llm_cache=True,
        best_model_func=ollama_model_if_cache,
        cheap_model_func=ollama_model_if_cache,
        embedding_func=local_embedding,
    )
    start = time()
    rag.insert(FAKE_TEXT)
    print("indexing time:", time() - start)
    # rag = GraphRAG(working_dir=WORKING_DIR, enable_llm_cache=True)
    # rag.insert(FAKE_TEXT[half_len:])


if __name__ == "__main__":
    insert()
    query()

```

### Core Architecture Module: `examples/using_amazon_bedrock.py`
```
from nano_graphrag import GraphRAG, QueryParam

graph_func = GraphRAG(
    working_dir="../bedrock_example",
    using_amazon_bedrock=True,
    best_model_id="us.anthropic.claude-3-sonnet-20240229-v1:0",
    cheap_model_id="us.anthropic.claude-3-haiku-20240307-v1:0",
)

with open("../tests/mock_data.txt") as f:
    graph_func.insert(f.read())

prompt = "What are the top themes in this story?"

# Perform global graphrag search
print(graph_func.query(prompt, param=QueryParam(mode="global")))

# Perform local graphrag search (I think is better and more scalable one)
print(graph_func.query(prompt, param=QueryParam(mode="local")))

```

### Core Architecture Module: `examples/using_custom_chunking_method.py`
```
from nano_graphrag._utils import encode_string_by_tiktoken
from nano_graphrag.base import QueryParam
from nano_graphrag.graphrag import GraphRAG
from nano_graphrag._op import chunking_by_seperators


def chunking_by_token_size(
    tokens_list: list[list[int]],  # nano-graphrag may pass a batch of docs' tokens
    doc_keys: list[str],  # nano-graphrag may pass a batch of docs' key ids
    tiktoken_model,  # a titoken model
    overlap_token_size=128,
    max_token_size=1024,
):

    results = []
    for index, tokens in enumerate(tokens_list):
        chunk_token = []
        lengths = []
        for start in range(0, len(tokens), max_token_size - overlap_token_size):

            chunk_token.append(tokens[start : start + max_token_size])
            lengths.append(min(max_token_size, len(tokens) - start))

        chunk_token = tiktoken_model.decode_batch(chunk_token)
        for i, chunk in enumerate(chunk_token):

            results.append(
                {
                    "tokens": lengths[i],
                    "content": chunk.strip(),
                    "chunk_order_index": i,
                    "full_doc_id": doc_keys[index],
                }
            )

    return results


WORKING_DIR = "./nano_graphrag_cache_local_embedding_TEST"
rag = GraphRAG(
    working_dir=WORKING_DIR,
    chunk_func=chunking_by_seperators,
)

```

### Core Architecture Module: `examples/using_deepseek_api_as_llm+glm_api_as_embedding.py`
```
import os
import logging
import numpy as np
from openai import AsyncOpenAI, OpenAI
from dataclasses import dataclass
from nano_graphrag import GraphRAG, QueryParam
from nano_graphrag.base import BaseKVStorage
from nano_graphrag._utils import compute_args_hash

logging.basicConfig(level=logging.WARNING)
logging.getLogger("nano-graphrag").setLevel(logging.INFO)

GLM_API_KEY = "XXXX"
DEEPSEEK_API_KEY = "sk-XXXX"

MODEL = "deepseek-chat"


async def deepseepk_model_if_cache(
    prompt, system_prompt=None, history_messages=[], **kwargs
) -> str:
    openai_async_client = AsyncOpenAI(
        api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com"
    )
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    # Get the cached response if having-------------------
    hashing_kv: BaseKVStorage = kwargs.pop("hashing_kv", None)
    messages.extend(history_messages)
    messages.append({"role": "user", "content": prompt})
    if hashing_kv is not None:
        args_hash = compute_args_hash(MODEL, messages)
        if_cache_return = await hashing_kv.get_by_id(args_hash)
        if if_cache_return is not None:
            return if_cache_return["return"]
    # -----------------------------------------------------

    response = await openai_async_client.chat.completions.create(
        model=MODEL, messages=messages, **kwargs
    )

    # Cache the response if having-------------------
    if hashing_kv is not None:
        await hashing_kv.upsert(
            {args_hash: {"return": response.choices[0].message.content, "model": MODEL}}
        )
    # -----------------------------------------------------
    return response.choices[0].message.content


def remove_if_exist(file):
    if os.path.exists(file):
        os.remove(file)


@dataclass
class EmbeddingFunc:
    embedding_dim: int
    max_token_size: int
    func: callable

    async def __call__(self, *args, **kwargs) -> np.ndarray:
        return await self.func(*args, **kwargs)

def wrap_embedding_func_with_attrs(**kwargs):
    """Wrap a function with attributes"""

    def final_decro(func) -> EmbeddingFunc:
        new_func = EmbeddingFunc(**kwargs, func=func)
        return new_func

    return final_decro

@wrap_embedding_func_with_attrs(embedding_dim=1024, max_token_size=8192)
async def GLM_embedding(texts: list[str]) -> np.ndarray:
    model_name = "embedding-2"
    client = OpenAI(
        api_key=GLM_API_KEY,
        base_url="https://open.bigmodel.cn/api/paas/v4/"
    ) 
    embedding = client.embeddings.create(
        input=texts,
        model=model_name,
    )
    final_embedding = [d.embedding for d in embedding.data]
    return np.array(final_embedding)



WORKING_DIR = "./nano_graphrag_cache_deepseek_TEST"

def query():
    rag = GraphRAG(
        working_dir=WORKING_DIR,
        best_model_func=deepseepk_model_if_cache,
        cheap_model_func=deepseepk_model_if_cache,
        embedding_func=GLM_embedding,
    )
    print(
        rag.query(
            "What are the top themes in this story?", param=QueryParam(mode="global")
        )
    )


def insert():
    from time import time

    with open("./tests/mock_data.txt", encoding="utf-8-sig") as f:
        FAKE_TEXT = f.read()

    remove_if_exist(f"{WORKING_DIR}/vdb_entities.json")
    remove_if_exist(f"{WORKING_DIR}/kv_store_full_docs.json")
    remove_if_exist(f"{WORKING_DIR}/kv_store_text_chunks.json")
    remove_if_exist(f"{WORKING_DIR}/kv_store_community_reports.json")
    remove_if_exist(f"{WORKING_DIR}/graph_chunk_entity_relation.graphml")

    rag = GraphRAG(
        working_dir=WORKING_DIR,
        enable_llm_cache=True,
        best_model_func=deepseepk_model_if_cache,
        cheap_model_func=deepseepk_model_if_cache,
        embedding_func=GLM_embedding,
    )
    start = time()
    rag.insert(FAKE_TEXT)
    print("indexing time:", time() - start)
    # rag = GraphRAG(working_dir=WORKING_DIR, enable_llm_cache=True)
    # rag.insert(FAKE_TEXT[half_len:])


if __name__ == "__main__":
    insert()
    # query()

```

### Core Architecture Module: `examples/using_deepseek_as_llm.py`
```
import os
import logging
from openai import AsyncOpenAI
from nano_graphrag import GraphRAG, QueryParam
from nano_graphrag import GraphRAG, QueryParam
from nano_graphrag.base import BaseKVStorage
from nano_graphrag._utils import compute_args_hash

logging.basicConfig(level=logging.WARNING)
logging.getLogger("nano-graphrag").setLevel(logging.INFO)

DEEPSEEK_API_KEY = "sk-XXXX"
MODEL = "deepseek-chat"


async def deepseepk_model_if_cache(
    prompt, system_prompt=None, history_messages=[], **kwargs
) -> str:
    openai_async_client = AsyncOpenAI(
        api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com"
    )
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    # Get the cached response if having-------------------
    hashing_kv: BaseKVStorage = kwargs.pop("hashing_kv", None)
    messages.extend(history_messages)
    messages.append({"role": "user", "content": prompt})
    if hashing_kv is not None:
        args_hash = compute_args_hash(MODEL, messages)
        if_cache_return = await hashing_kv.get_by_id(args_hash)
        if if_cache_return is not None:
            return if_cache_return["return"]
    # -----------------------------------------------------

    response = await openai_async_client.chat.completions.create(
        model=MODEL, messages=messages, **kwargs
    )

    # Cache the response if having-------------------
    if hashing_kv is not None:
        await hashing_kv.upsert(
            {args_hash: {"return": response.choices[0].message.content, "model": MODEL}}
        )
    # -----------------------------------------------------
    return response.choices[0].message.content


def remove_if_exist(file):
    if os.path.exists(file):
        os.remove(file)


WORKING_DIR = "./nano_graphrag_cache_deepseek_TEST"


def query():
    rag = GraphRAG(
        working_dir=WORKING_DIR,
        best_model_func=deepseepk_model_if_cache,
        cheap_model_func=deepseepk_model_if_cache,
    )
    print(
        rag.query(
            "What are the top themes in this story?", param=QueryParam(mode="global")
        )
    )


def insert():
    from time import time

    with open("./tests/mock_data.txt", encoding="utf-8-sig") as f:
        FAKE_TEXT = f.read()

    remove_if_exist(f"{WORKING_DIR}/vdb_entities.json")
    remove_if_exist(f"{WORKING_DIR}/kv_store_full_docs.json")
    remove_if_exist(f"{WORKING_DIR}/kv_store_text_chunks.json")
    remove_if_exist(f"{WORKING_DIR}/kv_store_community_reports.json")
    remove_if_exist(f"{WORKING_DIR}/graph_chunk_entity_relation.graphml")

    rag = GraphRAG(
        working_dir=WORKING_DIR,
        enable_llm_cache=True,
        best_model_func=deepseepk_model_if_cache,
        cheap_model_func=deepseepk_model_if_cache,
    )
    start = time()
    rag.insert(FAKE_TEXT)
    print("indexing time:", time() - start)
    # rag = GraphRAG(working_dir=WORKING_DIR, enable_llm_cache=True)
    # rag.insert(FAKE_TEXT[half_len:])


if __name__ == "__main__":
    insert()
    # query()

```

### Core Architecture Module: `examples/using_dspy_entity_extraction.py`
```
import os
from openai import AsyncOpenAI
from dotenv import load_dotenv
import logging
import numpy as np
import dspy
from sentence_transformers import SentenceTransformer
from nano_graphrag import GraphRAG, QueryParam
from nano_graphrag._llm import gpt_4o_mini_complete
from nano_graphrag._storage import HNSWVectorStorage
from nano_graphrag.base import BaseKVStorage
from nano_graphrag._utils import compute_args_hash, wrap_embedding_func_with_attrs
from nano_graphrag.entity_extraction.extract import extract_entities_dspy

logging.basicConfig(level=logging.WARNING)
logging.getLogger("nano-graphrag").setLevel(logging.DEBUG)

WORKING_DIR = "./nano_graphrag_cache_using_dspy_entity_extraction"

load_dotenv()


EMBED_MODEL = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2", cache_folder=WORKING_DIR, device="cpu"
)


@wrap_embedding_func_with_attrs(
    embedding_dim=EMBED_MODEL.get_sentence_embedding_dimension(),
    max_token_size=EMBED_MODEL.max_seq_length,
)
async def local_embedding(texts: list[str]) -> np.ndarray:
    return EMBED_MODEL.encode(texts, normalize_embeddings=True)


async def deepseepk_model_if_cache(
    prompt, model: str = "deepseek-chat", system_prompt=None, history_messages=[], **kwargs
) -> str:
    openai_async_client = AsyncOpenAI(
        api_key=os.environ.get("DEEPSEEK_API_KEY"), base_url="https://api.deepseek.com"
    )
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    # Get the cached response if having-------------------
    hashing_kv: BaseKVStorage = kwargs.pop("hashing_kv", None)
    messages.extend(history_messages)
    messages.append({"role": "user", "content": prompt})
    if hashing_kv is not None:
        args_hash = compute_args_hash(model, messages)
        if_cache_return = await hashing_kv.get_by_id(args_hash)
        if if_cache_return is not None:
            return if_cache_return["return"]
    # -----------------------------------------------------

    response = await openai_async_client.chat.completions.create(
        model=model, messages=messages, **kwargs
    )

    # Cache the response if having-------------------
    if hashing_kv is not None:
        await hashing_kv.upsert(
            {args_hash: {"return": response.choices[0].message.content, "model": model}}
        )
    # -----------------------------------------------------
    return response.choices[0].message.content



def remove_if_exist(file):
    if os.path.exists(file):
        os.remove(file)


def insert():
    from time import time

    with open("./tests/mock_data.txt", encoding="utf-8-sig") as f:
        FAKE_TEXT = f.read()

    remove_if_exist(f"{WORKING_DIR}/vdb_entities.json")
    remove_if_exist(f"{WORKING_DIR}/kv_store_full_docs.json")
    remove_if_exist(f"{WORKING_DIR}/kv_store_text_chunks.json")
    remove_if_exist(f"{WORKING_DIR}/kv_store_community_reports.json")
    remove_if_exist(f"{WORKING_DIR}/graph_chunk_entity_relation.graphml")
    rag = GraphRAG(
        working_dir=WORKING_DIR,
        enable_llm_cache=True,
        vector_db_storage_cls=HNSWVectorStorage,
        vector_db_storage_cls_kwargs={"max_elements": 1000000, "ef_search": 200, "M": 50},
        best_model_max_async=10,
        cheap_model_max_async=10,
        best_model_func=deepseepk_model_if_cache,
        cheap_model_func=deepseepk_model_if_cache,
        embedding_func=local_embedding,
        entity_extraction_func=extract_entities_dspy
    )
    start = time()
    rag.insert(FAKE_TEXT)
    print("indexing time:", time() - start)


def query():
    rag = GraphRAG(
        working_dir=WORKING_DIR,
        enable_llm_cache=True,
        vector_db_storage_cls=HNSWVectorStorage,
        vector_db_storage_cls_kwargs={"max_elements": 1000000, "ef_search": 200, "M": 50},
        best_model_max_token_size=8196,
        cheap_model_max_token_size=8196,
        best_model_max_async=4,
        cheap_model_max_async=4,
        best_model_func=gpt_4o_mini_complete,
        cheap_model_func=gpt_4o_mini_complete,
        embedding_func=local_embedding,
        entity_extraction_func=extract_entities_dspy
        
    )
    print(
        rag.query(
            "What are the top themes in this story?", param=QueryParam(mode="global")
        )
    )
    print(
        rag.query(
            "What are the top themes in this story?", param=QueryParam(mode="local")
        )
    )


if __name__ == "__main__":
    lm = dspy.LM(
        model="deepseek/deepseek-chat", 
        model_type="chat",
        api_provider="openai",
        api_key=os.environ["DEEPSEEK_API_KEY"], 
        base_url=os.environ["DEEPSEEK_BASE_URL"], 
        temperature=1.0,
        max_tokens=8192
    )
    dspy.settings.configure(lm=lm, experimental=True)
    insert()
    query()

```

### Core Architecture Module: `examples/using_faiss_as_vextorDB.py`
```
import os
import asyncio
import numpy as np
from nano_graphrag.graphrag import GraphRAG, QueryParam
from nano_graphrag._utils import logger
from nano_graphrag.base import BaseVectorStorage
from dataclasses import dataclass
import faiss
import pickle
import logging
import xxhash
logging.getLogger('msal').setLevel(logging.WARNING)
logging.getLogger('azure').setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)

WORKING_DIR = "./nano_graphrag_cache_faiss_TEST"

@dataclass
class FAISSStorage(BaseVectorStorage):

    def __post_init__(self):
        self._index_file_name = os.path.join(
            self.global_config["working_dir"], f"{self.namespace}_faiss.index"
        )
        self._metadata_file_name = os.path.join(
            self.global_config["working_dir"], f"{self.namespace}_metadata.pkl"
        )
        self._max_batch_size = self.global_config["embedding_batch_num"]
        
        if os.path.exists(self._index_file_name) and os.path.exists(self._metadata_file_name):
            self._index = faiss.read_index(self._index_file_name)
            with open(self._metadata_file_name, 'rb') as f:
                self._metadata = pickle.load(f)
        else:
            self._index = faiss.IndexIDMap(faiss.IndexFlatIP(self.embedding_func.embedding_dim))
            self._metadata = {}

    async def upsert(self, data: dict[str, dict]):
        logger.info(f"Inserting {len(data)} vectors to {self.namespace}")
        
        contents = [v["content"] for v in data.values()]
        batches = [
            contents[i : i + self._max_batch_size]
            for i in range(0, len(contents), self._max_batch_size)
        ]
        embeddings_list = await asyncio.gather(
            *[self.embedding_func(batch) for batch in batches]
        )
        embeddings = np.concatenate(embeddings_list)
        
        ids = []
        for k, v in data.items():
            id = xxhash.xxh32_intdigest(k.encode())
            metadata = {k1: v1 for k1, v1 in v.items() if k1 in self.meta_fields}
            metadata['id'] = k
            self._metadata[id] = metadata
            ids.append(id)
        
        ids = np.array(ids, dtype=np.int64)
        self._index.add_with_ids(embeddings, ids)
        
        
        return len(data)

    async def query(self, query, top_k=5):
        embedding = await self.embedding_func([query])
        distances, indices = self._index.search(embedding, top_k)
        
        results = []
        for _, (distance, id) in enumerate(zip(distances[0], indices[0])):
            if id != -1:  # FAISS returns -1 for empty slots
                if id in self._metadata:
                    metadata = self._metadata[id]
                    results.append({**metadata, "distance": 1 - distance})  # Convert to cosine distance
        
        return results
    
    async def index_done_callback(self):
        faiss.write_index(self._index, self._index_file_name)
        with open(self._metadata_file_name, 'wb') as f:
            pickle.dump(self._metadata, f)

if __name__ == "__main__":

    graph_func = GraphRAG(
        working_dir=WORKING_DIR,
        enable_llm_cache=True,
        vector_db_storage_cls=FAISSStorage,
    )

    with open(r"tests/mock_data.txt", encoding='utf-8') as f:
        graph_func.insert(f.read()[:30000])

    # Perform global graphrag search
    print(graph_func.query("What are the top themes in this story?"))

    
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #43** (2024-09-26): **pip install need patch, example fails**
  *Symptoms*: Installed this (great!) library via pip. But then on running the example:  ```python from nano_graphrag import GraphRAG, QueryParam  graph_func = GraphRAG(working_dir="./dickens")  with open("./book.txt") as f:     graph_func.insert(f.read()) ```  I get the following error:  ```python       1 from __future__ import division       3 from builtins import str, range, object ----> 4 from past.utils import old_div       6 import autograd.numpy as np       7 from ._utils import outer_rows  ModuleNotFoundError: No module named 'past' ```  Seems an issue with `graspologic`:  https://github.com/microsoft/graphrag/pull/1033/commits/5135baeffb4cd104f8381f9d380eac659aa0e1ac  `pip install future=1.0.0` solves this. 

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

### Incident Patch 1: `acb35c06` (2026-01-27)
**Commit Message**: fix: add encoding parameter to open() calls in setup.py

fix: add encoding parameter to open() calls in setup.py

**File**: `setup.py` (modified, +3/-3)
```diff
@@ -1,21 +1,21 @@
 import setuptools
 from setuptools import find_packages
 
-with open("readme.md", "r") as fh:
+with open("readme.md", "r", encoding="utf-8") as fh:
     long_description = fh.read()
 
 
 vars2find = ["__author__", "__version__", "__url__"]
 vars2readme = {}
-with open("./nano_graphrag/__init__.py") as f:
+with open("./nano_graphrag/__init__.py", encoding="utf-8") as f:
     for line in f.readlines():
         for v in vars2find:
             if line.startswith(v):
                 line = line.replace(" ", "").replace('"', "").replace("'", "").strip()
                 vars2readme[v] = line.split("=")[1]
 
 deps = []
-with open("./requirements.txt") as f:
+with open("./requirements.txt", encoding="utf-8") as f:
     for line in f.readlines():
         if not line.strip():
             continue
```

---

### Incident Patch 2: `2ececa2e` (2025-12-28)
**Commit Message**: fix: add encoding parameter to open() calls in setup.py

Add explicit encoding='utf-8' parameter to all open() calls in setup.py
to fix installation errors on Windows systems where the default encoding
may not be UTF-8 (e.g., cp1252).

This fixes the 'charmap' codec can't decode error that Windows users
encounter when installing the package from source.

Closes #140
Closes #163
Closes #125

Signed-off-by: majiayu000 <[REDACTED_EMAIL]>

**File**: `setup.py` (modified, +3/-3)
```diff
@@ -1,21 +1,21 @@
 import setuptools
 from setuptools import find_packages
 
-with open("readme.md", "r") as fh:
+with open("readme.md", "r", encoding="utf-8") as fh:
     long_description = fh.read()
 
 
 vars2find = ["__author__", "__version__", "__url__"]
 vars2readme = {}
-with open("./nano_graphrag/__init__.py") as f:
+with open("./nano_graphrag/__init__.py", encoding="utf-8") as f:
     for line in f.readlines():
         for v in vars2find:
             if line.startswith(v):
                 line = line.replace(" ", "").replace('"', "").replace("'", "").strip()
                 vars2readme[v] = line.split("=")[1]
 
 deps = []
-with open("./requirements.txt") as f:
+with open("./requirements.txt", encoding="utf-8") as f:
     for line in f.readlines():
         if not line.strip():
             continue
```

---

### Incident Patch 3: `01f429e8` (2025-07-23)
**Commit Message**: Fix: Ensure compatibility with Python versions older than 3.12

**File**: `nano_graphrag/_op.py` (modified, +1/-1)
```diff
@@ -530,7 +530,7 @@ async def _pack_single_community_describe(
 
     # 4. 准备节点和边数据（过滤子社区已包含的）
     def format_row(row: list) -> str:
-        return ','.join(f'"{str(item).replace("\"", "\"\"")}"' for item in row)
+        return ','.join('"{}"'.format(str(item).replace('"', '""')) for item in row)
 
     node_fields = ["id", "entity", "type", "description", "degree"]
     edge_fields = ["id", "source", "target", "description", "rank"]
```

---

### Incident Patch 4: `c7a6e7af` (2025-07-23)
**Commit Message**: Fix: Ensure compatibility with Python versions older than 3.12

The f-string syntax used for CSV row generation is only valid in Python 3.12 and newer. This causes a `SyntaxError` when running the code on earlier versions like Python 3.11.

This commit replaces the incompatible f-string with a `str.format()` call, which is functionally identical and compatible with all supported Python 3 versions.

**File**: `nano_graphrag/_op.py` (modified, +1/-1)
```diff
@@ -530,7 +530,7 @@ async def _pack_single_community_describe(
 
     # 4. 准备节点和边数据（过滤子社区已包含的）
     def format_row(row: list) -> str:
-        return ','.join(f'"{str(item).replace("\"", "\"\"")}"' for item in row)
+        return ','.join('"{}"'.format(str(item).replace('"', '""')) for item in row)
 
     node_fields = ["id", "entity", "type", "description", "degree"]
     edge_fields = ["id", "source", "target", "description", "rank"]
```

---

### Incident Patch 5: `0cea71bc` (2025-07-11)
**Commit Message**: fix: refine prompt length calculation with tokenizer support

**File**: `nano_graphrag/_op.py` (modified, +181/-145)
```diff
@@ -1,21 +1,20 @@
 import re
 import json
 import asyncio
-import tiktoken
 from typing import Union
 from collections import Counter, defaultdict
 from ._splitter import SeparatorSplitter
 from ._utils import (
     logger,
     clean_str,
     compute_mdhash_id,
-    decode_tokens_by_tiktoken,
-    encode_string_by_tiktoken,
     is_float_regex,
     list_of_list_to_csv,
     pack_user_ass_to_openai_messages,
     split_string_by_multi_markers,
     truncate_list_by_token_size,
+
+    TokenizerWrapper
 )
 from .base import (
     BaseGraphStorage,
@@ -32,24 +31,22 @@
 def chunking_by_token_size(
     tokens_list: list[list[int]],
     doc_keys,
-    tiktoken_model,
+    tokenizer_wrapper: TokenizerWrapper, 
     overlap_token_size=128,
     max_token_size=1024,
 ):
-
     results = []
     for index, tokens in enumerate(tokens_list):
         chunk_token = []
         lengths = []
         for start in range(0, len(tokens), max_token_size - overlap_token_size):
-
             chunk_token.append(tokens[start : start + max_token_size])
             lengths.append(min(max_token_size, len(tokens) - start))
 
-        # here somehow tricky, since the whole chunk tokens is list[list[list[int]]] for corpus(doc(chunk)),so it can't be decode entirely
-        chunk_token = tiktoken_model.decode_batch(chunk_token)
-        for i, chunk in enumerate(chunk_token):
 
+        chunk_texts = tokenizer_wrapper.decode_batch(chunk_token)
+
+        for i, chunk in enumerate(chunk_texts):
             results.append(
                 {
                     "tokens": lengths[i],
@@ -58,34 +55,31 @@ def chunking_by_token_size(
                     "full_doc_id": doc_keys[index],
                 }
             )
-
     return results
 
 
 def chunking_by_seperators(
     tokens_list: list[list[int]],
     doc_keys,
-    tiktoken_model,
+    tokenizer_wrapper: TokenizerWrapper,
     overlap_token_size=128,
     max_token_size=1024,
 ):
-
+    from .prompt import PROMPTS
+    # *** 修改 ***: 直接使用 wrapper 编码，而不是获取底层 tokenizer
+    separators = [tokenizer_wrapper.encode(s) for s in PROMPTS["default_text_separator"]]
     splitter = SeparatorSplitter(
-        separators=[
-            tiktoken_model.encode(s) for s in PROMPTS["default_text_separator"]
-        ],
+        separators=separators,
         chunk_size=max_token_size,
         chunk_overlap=overlap_token_size,
     )
     results = []
     for index, tokens in enumerate(tokens_list):
-        chunk_token = splitter.split_tokens(tokens)
-        lengths = [len(c) for c in chunk_token]
-
-        # here somehow tricky, since the whole chunk tokens is list[list[list[int]]] for corpus(doc(chunk)),so it can't be decode entirely
-        chunk_token = tiktoken_model.decode_batch(chunk_token)
-        for i, chunk in enumerate(chunk_token):
+        chunk_tokens = splitter.split_tokens(tokens)
+        lengths = [len(c) for c in chunk_tokens]
 
+        decoded_chunks = tokenizer_wrapper.decode_batch(chunk_tokens)
+        for i, chunk in enumerate(decoded_chunks):
             results.append(
                 {
                     "tokens": lengths[i],
@@ -94,48 +88,43 @@ def chunking_by_seperators(
                     "full_doc_id": doc_keys[index],
                 }
             )
-
     return results
 
 
-def get_chunks(new_docs, chunk_func=chunking_by_token_size, **chunk_func_params):
+def get_chunks(new_docs, chunk_func=chunking_by_token_size, tokenizer_wrapper: TokenizerWrapper = None, **chunk_func_params):
     inserting_chunks = {}
-
     new_docs_list = list(new_docs.items())
     docs = [new_doc[1]["content"] for new_doc in new_docs_list]
     doc_keys = [new_doc[0] for new_doc in new_docs_list]
 
-    ENCODER = tiktoken.encoding_for_model("gpt-4o")
-    tokens = ENCODER.encode_batch(docs, num_threads=16)
+    tokens = [tokenizer_wrapper.encode(doc) for doc in docs]
     chunks = chunk_func(
-        tokens, doc_keys=doc_keys, tiktoken_model=ENCODER, **chunk_func_params
+        tokens, doc_keys=doc_keys, tokenizer_wrapper=tokenizer_wrapper, overlap_token_size=chunk_func_params.get("overlap_token_size", 128), max_token_size=chunk_func_params.get("max_token_size", 1024)
     )
-
     for chunk in chunks:
         inserting_chunks.update(
             {compute_mdhash_id(chunk["content"], prefix="chunk-"): chunk}
         )
-
     return inserting_chunks
 
 
 async def _handle_entity_relation_summary(
     entity_or_relation_name: str,
     description: str,
     global_config: dict,
+    tokenizer_wrapper: TokenizerWrapper,
 ) -> str:
     use_llm_func: callable = global_config["cheap_model_func"]
     llm_max_tokens = global_config["cheap_model_max_token_size"]
-    tiktoken_model_name = global_config["tiktoken_model_name"]
     summary_max_tokens = global_config["entity_summary_to_max_tokens"]
 
-    tokens = encode_string_by_tiktoken(description, model_name=tiktoken_model_name)
-    if len(tokens) < summary_max_tokens:  # No need for summary
+
+    tokens = tok
```

**File**: `nano_graphrag/_utils.py` (modified, +54/-17)
```diff
@@ -8,14 +8,16 @@
 from dataclasses import dataclass
 from functools import wraps
 from hashlib import md5
-from typing import Any, Union
+from typing import Any, Union, Literal
 
 import numpy as np
 import tiktoken
 
+
+from transformers import AutoTokenizer
+
 logger = logging.getLogger("nano-graphrag")
 logging.getLogger("neo4j").setLevel(logging.ERROR)
-ENCODER = None
 
 def always_get_an_event_loop() -> asyncio.AbstractEventLoop:
     try:
@@ -118,29 +120,64 @@ def convert_response_to_json(response: str) -> dict:
 
 
 
-def encode_string_by_tiktoken(content: str, model_name: str = "gpt-4o"):
-    global ENCODER
-    if ENCODER is None:
-        ENCODER = tiktoken.encoding_for_model(model_name)
-    tokens = ENCODER.encode(content)
-    return tokens
+class TokenizerWrapper:
+    def __init__(self, tokenizer_type: Literal["tiktoken", "huggingface"] = "tiktoken", model_name: str = "gpt-4o"):
+        self.tokenizer_type = tokenizer_type
+        self.model_name = model_name
+        self._tokenizer = None
+        self._lazy_load_tokenizer()
+
+    def _lazy_load_tokenizer(self):
+        if self._tokenizer is not None:
+            return
+        logger.info(f"Loading tokenizer: type='{self.tokenizer_type}', name='{self.model_name}'")
+        if self.tokenizer_type == "tiktoken":
+            self._tokenizer = tiktoken.encoding_for_model(self.model_name)
+        elif self.tokenizer_type == "huggingface":
+            if AutoTokenizer is None:
+                raise ImportError("`transformers` is not installed. Please install it via `pip install transformers` to use HuggingFace tokenizers.")
+            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name, use_fast=True)
+        else:
+            raise ValueError(f"Unknown tokenizer_type: {self.tokenizer_type}")
 
+    def get_tokenizer(self):
+        """提供对底层 tokenizer 对象的访问，用于特殊情况（如 decode_batch）。"""
+        self._lazy_load_tokenizer()
+        return self._tokenizer
 
-def decode_tokens_by_tiktoken(tokens: list[int], model_name: str = "gpt-4o"):
-    global ENCODER
-    if ENCODER is None:
-        ENCODER = tiktoken.encoding_for_model(model_name)
-    content = ENCODER.decode(tokens)
-    return content
+    def encode(self, text: str) -> list[int]:
+        self._lazy_load_tokenizer()
+        return self._tokenizer.encode(text)
+
+    def decode(self, tokens: list[int]) -> str:
+        self._lazy_load_tokenizer()
+        return self._tokenizer.decode(tokens)
+    
+    # +++ 新增 +++: 增加一个批量解码的方法以提高效率，并保持接口一致性
+    def decode_batch(self, tokens_list: list[list[int]]) -> list[str]:
+        self._lazy_load_tokenizer()
+        # HuggingFace tokenizer 有 decode_batch，但 tiktoken 没有，我们用列表推导来模拟
+        if self.tokenizer_type == "tiktoken":
+            return [self._tokenizer.decode(tokens) for tokens in tokens_list]
+        elif self.tokenizer_type == "huggingface":
+            return self._tokenizer.batch_decode(tokens_list, skip_special_tokens=True)
+        else:
+             raise ValueError(f"Unknown tokenizer_type: {self.tokenizer_type}")
+        
 
 
-def truncate_list_by_token_size(list_data: list, key: callable, max_token_size: int):
-    """Truncate a list of data by token size"""
+def truncate_list_by_token_size(
+    list_data: list, 
+    key: callable, 
+    max_token_size: int, 
+    tokenizer_wrapper: TokenizerWrapper
+):
+    """Truncate a list of data by token size using a provided tokenizer wrapper."""
     if max_token_size <= 0:
         return []
     tokens = 0
     for i, data in enumerate(list_data):
-        tokens += len(encode_string_by_tiktoken(key(data)))
+        tokens += len(tokenizer_wrapper.encode(key(data))) + 1 # 防御性，模拟通过\n拼接列表的情况
         if tokens > max_token_size:
             return list_data[:i]
     return list_data
```

**File**: `nano_graphrag/graphrag.py` (modified, +20/-5)
```diff
@@ -5,7 +5,6 @@
 from functools import partial
 from typing import Callable, Dict, List, Optional, Type, Union, cast
 
-import tiktoken
 
 
 from ._llm import (
@@ -39,6 +38,7 @@
     convert_response_to_json,
     always_get_an_event_loop,
     logger,
+    TokenizerWrapper,
 )
 from .base import (
     BaseGraphStorage,
@@ -59,19 +59,22 @@ class GraphRAG:
     enable_naive_rag: bool = False
 
     # text chunking
+    tokenizer_type: str = "tiktoken"  # or 'huggingface'
+    tiktoken_model_name: str = "gpt-4o"
+    huggingface_model_name: str = "bert-base-uncased"  # default HF model
     chunk_func: Callable[
         [
             list[list[int]],
             List[str],
-            tiktoken.Encoding,
+            TokenizerWrapper,
             Optional[int],
             Optional[int],
         ],
         List[Dict[str, Union[str, int]]],
     ] = chunking_by_token_size
     chunk_token_size: int = 1200
     chunk_overlap_token_size: int = 100
-    tiktoken_model_name: str = "gpt-4o"
+    
 
     # entity extraction
     entity_extract_max_gleaning: int = 1
@@ -138,6 +141,11 @@ def __post_init__(self):
         _print_config = ",\n  ".join([f"{k} = {v}" for k, v in asdict(self).items()])
         logger.debug(f"GraphRAG init with param:\n\n  {_print_config}\n")
 
+        self.tokenizer_wrapper = TokenizerWrapper(
+            tokenizer_type=self.tokenizer_type,
+            model_name=self.tiktoken_model_name if self.tokenizer_type == "tiktoken" else self.huggingface_model_name
+        )
+
         if self.using_azure_openai:
             # If there's no OpenAI API key, use Azure OpenAI
             if self.best_model_func == gpt_4o_complete:
@@ -215,6 +223,8 @@ def __post_init__(self):
             partial(self.cheap_model_func, hashing_kv=self.llm_response_cache)
         )
 
+
+
     def insert(self, string_or_strings):
         loop = always_get_an_event_loop()
         return loop.run_until_complete(self.ainsert(string_or_strings))
@@ -236,6 +246,7 @@ async def aquery(self, query: str, param: QueryParam = QueryParam()):
                 self.community_reports,
                 self.text_chunks,
                 param,
+                self.tokenizer_wrapper,
                 asdict(self),
             )
         elif param.mode == "global":
@@ -246,6 +257,7 @@ async def aquery(self, query: str, param: QueryParam = QueryParam()):
                 self.community_reports,
                 self.text_chunks,
                 param,
+                self.tokenizer_wrapper,
                 asdict(self),
             )
         elif param.mode == "naive":
@@ -254,6 +266,7 @@ async def aquery(self, query: str, param: QueryParam = QueryParam()):
                 self.chunks_vdb,
                 self.text_chunks,
                 param,
+                self.tokenizer_wrapper,
                 asdict(self),
             )
         else:
@@ -285,6 +298,7 @@ async def ainsert(self, string_or_strings):
                 chunk_func=self.chunk_func,
                 overlap_token_size=self.chunk_overlap_token_size,
                 max_token_size=self.chunk_token_size,
+                tokenizer_wrapper=self.tokenizer_wrapper,
             )
 
             _add_chunk_keys = await self.text_chunks.filter_keys(
@@ -301,7 +315,7 @@ async def ainsert(self, string_or_strings):
                 logger.info("Insert chunks for naive RAG")
                 await self.chunks_vdb.upsert(inserting_chunks)
 
-            # TODO: no incremental update for communities now, so just drop all
+            # TODO: don't support incremental update for communities now, so we have to drop all
             await self.community_reports.drop()
 
             # ---------- extract/summary entity and upsert to graph
@@ -310,6 +324,7 @@ async def ainsert(self, string_or_strings):
                 inserting_chunks,
                 knwoledge_graph_inst=self.chunk_entity_relation_graph,
                 entity_vdb=self.entities_vdb,
+                tokenizer_wrapper=self.tokenizer_wrapper,
                 global_config=asdict(self),
                 using_amazon_bedrock=self.using_amazon_bedrock,
             )
@@ -323,7 +338,7 @@ async def ainsert(self, string_or_strings):
                 self.graph_cluster_algorithm
             )
             await generate_community_report(
-                self.community_reports, self.chunk_entity_relation_graph, asdict(self)
+                self.community_reports, self.chunk_entity_relation_graph, self.tokenizer_wrapper, asdict(self)
             )
 
             # ---------- commit upsertings and indexing
```

---

### Incident Patch 6: `644b2770` (2025-07-11)
**Commit Message**: fix: prevent prompt overflow by truncating long inputs

**File**: `nano_graphrag/_op.py` (modified, +189/-146)
```diff
@@ -1,21 +1,20 @@
 import re
 import json
 import asyncio
-import tiktoken
 from typing import Union
 from collections import Counter, defaultdict
 from ._splitter import SeparatorSplitter
 from ._utils import (
     logger,
     clean_str,
     compute_mdhash_id,
-    decode_tokens_by_tiktoken,
-    encode_string_by_tiktoken,
     is_float_regex,
     list_of_list_to_csv,
     pack_user_ass_to_openai_messages,
     split_string_by_multi_markers,
     truncate_list_by_token_size,
+
+    TokenizerWrapper
 )
 from .base import (
     BaseGraphStorage,
@@ -32,24 +31,22 @@
 def chunking_by_token_size(
     tokens_list: list[list[int]],
     doc_keys,
-    tiktoken_model,
+    tokenizer_wrapper: TokenizerWrapper, # *** 修改 ***: 明确类型
     overlap_token_size=128,
     max_token_size=1024,
 ):
-
     results = []
     for index, tokens in enumerate(tokens_list):
         chunk_token = []
         lengths = []
         for start in range(0, len(tokens), max_token_size - overlap_token_size):
-
             chunk_token.append(tokens[start : start + max_token_size])
             lengths.append(min(max_token_size, len(tokens) - start))
 
-        # here somehow tricky, since the whole chunk tokens is list[list[list[int]]] for corpus(doc(chunk)),so it can't be decode entirely
-        chunk_token = tiktoken_model.decode_batch(chunk_token)
-        for i, chunk in enumerate(chunk_token):
+        # *** 修改 ***: 直接使用 wrapper 解码
+        chunk_texts = tokenizer_wrapper.decode_batch(chunk_token)
 
+        for i, chunk in enumerate(chunk_texts):
             results.append(
                 {
                     "tokens": lengths[i],
@@ -58,34 +55,31 @@ def chunking_by_token_size(
                     "full_doc_id": doc_keys[index],
                 }
             )
-
     return results
 
 
 def chunking_by_seperators(
     tokens_list: list[list[int]],
     doc_keys,
-    tiktoken_model,
+    tokenizer_wrapper: TokenizerWrapper,
     overlap_token_size=128,
     max_token_size=1024,
 ):
-
+    from .prompt import PROMPTS
+    # *** 修改 ***: 直接使用 wrapper 编码，而不是获取底层 tokenizer
+    separators = [tokenizer_wrapper.encode(s) for s in PROMPTS["default_text_separator"]]
     splitter = SeparatorSplitter(
-        separators=[
-            tiktoken_model.encode(s) for s in PROMPTS["default_text_separator"]
-        ],
+        separators=separators,
         chunk_size=max_token_size,
         chunk_overlap=overlap_token_size,
     )
     results = []
     for index, tokens in enumerate(tokens_list):
-        chunk_token = splitter.split_tokens(tokens)
-        lengths = [len(c) for c in chunk_token]
-
-        # here somehow tricky, since the whole chunk tokens is list[list[list[int]]] for corpus(doc(chunk)),so it can't be decode entirely
-        chunk_token = tiktoken_model.decode_batch(chunk_token)
-        for i, chunk in enumerate(chunk_token):
-
+        chunk_tokens = splitter.split_tokens(tokens)
+        lengths = [len(c) for c in chunk_tokens]
+        # *** 修改 ***: 直接使用 wrapper 解码
+        decoded_chunks = tokenizer_wrapper.decode_batch(chunk_tokens)
+        for i, chunk in enumerate(decoded_chunks):
             results.append(
                 {
                     "tokens": lengths[i],
@@ -94,48 +88,43 @@ def chunking_by_seperators(
                     "full_doc_id": doc_keys[index],
                 }
             )
-
     return results
 
 
-def get_chunks(new_docs, chunk_func=chunking_by_token_size, **chunk_func_params):
+def get_chunks(new_docs, chunk_func=chunking_by_token_size, tokenizer_wrapper: TokenizerWrapper = None, **chunk_func_params):
     inserting_chunks = {}
-
     new_docs_list = list(new_docs.items())
     docs = [new_doc[1]["content"] for new_doc in new_docs_list]
     doc_keys = [new_doc[0] for new_doc in new_docs_list]
 
-    ENCODER = tiktoken.encoding_for_model("gpt-4o")
-    tokens = ENCODER.encode_batch(docs, num_threads=16)
+    tokens = [tokenizer_wrapper.encode(doc) for doc in docs]
     chunks = chunk_func(
-        tokens, doc_keys=doc_keys, tiktoken_model=ENCODER, **chunk_func_params
+        tokens, doc_keys=doc_keys, tokenizer_wrapper=tokenizer_wrapper, overlap_token_size=chunk_func_params.get("overlap_token_size", 128), max_token_size=chunk_func_params.get("max_token_size", 1024)
     )
-
     for chunk in chunks:
         inserting_chunks.update(
             {compute_mdhash_id(chunk["content"], prefix="chunk-"): chunk}
         )
-
     return inserting_chunks
 
 
 async def _handle_entity_relation_summary(
     entity_or_relation_name: str,
     description: str,
     global_config: dict,
+    tokenizer_wrapper: TokenizerWrapper,
 ) -> str:
     use_llm_func: callable = global_config["cheap_model_func"]
     llm_max_tokens = global_config["cheap_model_max_token_size"]
-    tiktoken_model_name = global_config["tiktoken_model_name"]
     summary_max_tokens = global_config["entity_summary_to_max_tokens"]
 
-    tokens = encode_string_by_tiktoken(description, model_name=tiktoken_mo
```

**File**: `nano_graphrag/_utils.py` (modified, +54/-17)
```diff
@@ -8,14 +8,16 @@
 from dataclasses import dataclass
 from functools import wraps
 from hashlib import md5
-from typing import Any, Union
+from typing import Any, Union, Literal
 
 import numpy as np
 import tiktoken
 
+
+from transformers import AutoTokenizer
+
 logger = logging.getLogger("nano-graphrag")
 logging.getLogger("neo4j").setLevel(logging.ERROR)
-ENCODER = None
 
 def always_get_an_event_loop() -> asyncio.AbstractEventLoop:
     try:
@@ -118,29 +120,64 @@ def convert_response_to_json(response: str) -> dict:
 
 
 
-def encode_string_by_tiktoken(content: str, model_name: str = "gpt-4o"):
-    global ENCODER
-    if ENCODER is None:
-        ENCODER = tiktoken.encoding_for_model(model_name)
-    tokens = ENCODER.encode(content)
-    return tokens
+class TokenizerWrapper:
+    def __init__(self, tokenizer_type: Literal["tiktoken", "huggingface"] = "tiktoken", model_name: str = "gpt-4o"):
+        self.tokenizer_type = tokenizer_type
+        self.model_name = model_name
+        self._tokenizer = None
+        self._lazy_load_tokenizer()
+
+    def _lazy_load_tokenizer(self):
+        if self._tokenizer is not None:
+            return
+        logger.info(f"Loading tokenizer: type='{self.tokenizer_type}', name='{self.model_name}'")
+        if self.tokenizer_type == "tiktoken":
+            self._tokenizer = tiktoken.encoding_for_model(self.model_name)
+        elif self.tokenizer_type == "huggingface":
+            if AutoTokenizer is None:
+                raise ImportError("`transformers` is not installed. Please install it via `pip install transformers` to use HuggingFace tokenizers.")
+            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name, use_fast=True)
+        else:
+            raise ValueError(f"Unknown tokenizer_type: {self.tokenizer_type}")
 
+    def get_tokenizer(self):
+        """提供对底层 tokenizer 对象的访问，用于特殊情况（如 decode_batch）。"""
+        self._lazy_load_tokenizer()
+        return self._tokenizer
 
-def decode_tokens_by_tiktoken(tokens: list[int], model_name: str = "gpt-4o"):
-    global ENCODER
-    if ENCODER is None:
-        ENCODER = tiktoken.encoding_for_model(model_name)
-    content = ENCODER.decode(tokens)
-    return content
+    def encode(self, text: str) -> list[int]:
+        self._lazy_load_tokenizer()
+        return self._tokenizer.encode(text)
+
+    def decode(self, tokens: list[int]) -> str:
+        self._lazy_load_tokenizer()
+        return self._tokenizer.decode(tokens)
+    
+    # +++ 新增 +++: 增加一个批量解码的方法以提高效率，并保持接口一致性
+    def decode_batch(self, tokens_list: list[list[int]]) -> list[str]:
+        self._lazy_load_tokenizer()
+        # HuggingFace tokenizer 有 decode_batch，但 tiktoken 没有，我们用列表推导来模拟
+        if self.tokenizer_type == "tiktoken":
+            return [self._tokenizer.decode(tokens) for tokens in tokens_list]
+        elif self.tokenizer_type == "huggingface":
+            return self._tokenizer.batch_decode(tokens_list, skip_special_tokens=True)
+        else:
+             raise ValueError(f"Unknown tokenizer_type: {self.tokenizer_type}")
+        
 
 
-def truncate_list_by_token_size(list_data: list, key: callable, max_token_size: int):
-    """Truncate a list of data by token size"""
+def truncate_list_by_token_size(
+    list_data: list, 
+    key: callable, 
+    max_token_size: int, 
+    tokenizer_wrapper: TokenizerWrapper
+):
+    """Truncate a list of data by token size using a provided tokenizer wrapper."""
     if max_token_size <= 0:
         return []
     tokens = 0
     for i, data in enumerate(list_data):
-        tokens += len(encode_string_by_tiktoken(key(data)))
+        tokens += len(tokenizer_wrapper.encode(key(data))) + 1 # 防御性，模拟通过\n拼接列表的情况
         if tokens > max_token_size:
             return list_data[:i]
     return list_data
```

**File**: `nano_graphrag/graphrag.py` (modified, +20/-5)
```diff
@@ -5,7 +5,6 @@
 from functools import partial
 from typing import Callable, Dict, List, Optional, Type, Union, cast
 
-import tiktoken
 
 
 from ._llm import (
@@ -39,6 +38,7 @@
     convert_response_to_json,
     always_get_an_event_loop,
     logger,
+    TokenizerWrapper,
 )
 from .base import (
     BaseGraphStorage,
@@ -59,19 +59,22 @@ class GraphRAG:
     enable_naive_rag: bool = False
 
     # text chunking
+    tokenizer_type: str = "tiktoken"  # or 'huggingface'
+    tiktoken_model_name: str = "gpt-4o"
+    huggingface_model_name: str = "bert-base-uncased"  # default HF model
     chunk_func: Callable[
         [
             list[list[int]],
             List[str],
-            tiktoken.Encoding,
+            TokenizerWrapper,
             Optional[int],
             Optional[int],
         ],
         List[Dict[str, Union[str, int]]],
     ] = chunking_by_token_size
     chunk_token_size: int = 1200
     chunk_overlap_token_size: int = 100
-    tiktoken_model_name: str = "gpt-4o"
+    
 
     # entity extraction
     entity_extract_max_gleaning: int = 1
@@ -138,6 +141,11 @@ def __post_init__(self):
         _print_config = ",\n  ".join([f"{k} = {v}" for k, v in asdict(self).items()])
         logger.debug(f"GraphRAG init with param:\n\n  {_print_config}\n")
 
+        self.tokenizer_wrapper = TokenizerWrapper(
+            tokenizer_type=self.tokenizer_type,
+            model_name=self.tiktoken_model_name if self.tokenizer_type == "tiktoken" else self.huggingface_model_name
+        )
+
         if self.using_azure_openai:
             # If there's no OpenAI API key, use Azure OpenAI
             if self.best_model_func == gpt_4o_complete:
@@ -215,6 +223,8 @@ def __post_init__(self):
             partial(self.cheap_model_func, hashing_kv=self.llm_response_cache)
         )
 
+
+
     def insert(self, string_or_strings):
         loop = always_get_an_event_loop()
         return loop.run_until_complete(self.ainsert(string_or_strings))
@@ -236,6 +246,7 @@ async def aquery(self, query: str, param: QueryParam = QueryParam()):
                 self.community_reports,
                 self.text_chunks,
                 param,
+                self.tokenizer_wrapper,
                 asdict(self),
             )
         elif param.mode == "global":
@@ -246,6 +257,7 @@ async def aquery(self, query: str, param: QueryParam = QueryParam()):
                 self.community_reports,
                 self.text_chunks,
                 param,
+                self.tokenizer_wrapper,
                 asdict(self),
             )
         elif param.mode == "naive":
@@ -254,6 +266,7 @@ async def aquery(self, query: str, param: QueryParam = QueryParam()):
                 self.chunks_vdb,
                 self.text_chunks,
                 param,
+                self.tokenizer_wrapper,
                 asdict(self),
             )
         else:
@@ -285,6 +298,7 @@ async def ainsert(self, string_or_strings):
                 chunk_func=self.chunk_func,
                 overlap_token_size=self.chunk_overlap_token_size,
                 max_token_size=self.chunk_token_size,
+                tokenizer_wrapper=self.tokenizer_wrapper,
             )
 
             _add_chunk_keys = await self.text_chunks.filter_keys(
@@ -301,7 +315,7 @@ async def ainsert(self, string_or_strings):
                 logger.info("Insert chunks for naive RAG")
                 await self.chunks_vdb.upsert(inserting_chunks)
 
-            # TODO: no incremental update for communities now, so just drop all
+            # TODO: don't support incremental update for communities now, so we have to drop all
             await self.community_reports.drop()
 
             # ---------- extract/summary entity and upsert to graph
@@ -310,6 +324,7 @@ async def ainsert(self, string_or_strings):
                 inserting_chunks,
                 knwoledge_graph_inst=self.chunk_entity_relation_graph,
                 entity_vdb=self.entities_vdb,
+                tokenizer_wrapper=self.tokenizer_wrapper,
                 global_config=asdict(self),
                 using_amazon_bedrock=self.using_amazon_bedrock,
             )
@@ -323,7 +338,7 @@ async def ainsert(self, string_or_strings):
                 self.graph_cluster_algorithm
             )
             await generate_community_report(
-                self.community_reports, self.chunk_entity_relation_graph, asdict(self)
+                self.community_reports, self.chunk_entity_relation_graph, self.tokenizer_wrapper, asdict(self)
             )
 
             # ---------- commit upsertings and indexing
```

---

### Incident Patch 7: `da57aa2a` (2025-03-18)
**Commit Message**: fix: update dspy cot

**File**: `nano_graphrag/entity_extraction/metric.py` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ class AssessRelationships(dspy.Signature):
 def relationships_similarity_metric(
     gold: dspy.Example, pred: dspy.Prediction, trace=None
 ) -> float:
-    model = dspy.TypedChainOfThought(AssessRelationships)
+    model = dspy.ChainOfThought(AssessRelationships)
     gold_relationships = [Relationship(**item) for item in gold["relationships"]]
     predicted_relationships = [Relationship(**item) for item in pred["relationships"]]
     similarity_score = float(
```

**File**: `nano_graphrag/entity_extraction/module.py` (modified, +27/-21)
```diff
@@ -265,60 +265,66 @@ def __init__(
         max_retries: int = 3,
         entity_types: list[str] = ENTITY_TYPES,
         self_refine: bool = False,
-        num_refine_turns: int = 1
+        num_refine_turns: int = 1,
     ):
         super().__init__()
         self.lm = lm
         self.entity_types = entity_types
         self.self_refine = self_refine
         self.num_refine_turns = num_refine_turns
-        
-        self.extractor = dspy.TypedChainOfThought(signature=CombinedExtraction, max_retries=max_retries)
+
+        self.extractor = dspy.ChainOfThought(
+            signature=CombinedExtraction, max_retries=max_retries
+        )
         self.extractor = TypedEntityRelationshipExtractorException(
             self.extractor, exception_types=(ValueError,)
         )
-        
+
         if self.self_refine:
-            self.critique = dspy.TypedChainOfThought(
-                signature=CritiqueCombinedExtraction, 
-                max_retries=max_retries
+            self.critique = dspy.ChainOfThought(
+                signature=CritiqueCombinedExtraction, max_retries=max_retries
             )
-            self.refine = dspy.TypedChainOfThought(
-                signature=RefineCombinedExtraction, 
-                max_retries=max_retries
+            self.refine = dspy.ChainOfThought(
+                signature=RefineCombinedExtraction, max_retries=max_retries
             )
 
     def forward(self, input_text: str) -> dspy.Prediction:
         with dspy.context(lm=self.lm if self.lm is not None else dspy.settings.lm):
             extraction_result = self.extractor(
                 input_text=input_text, entity_types=self.entity_types
             )
-            
+
             current_entities: list[Entity] = extraction_result.entities
             current_relationships: list[Relationship] = extraction_result.relationships
-            
+
             if self.self_refine:
                 for _ in range(self.num_refine_turns):
                     critique_result = self.critique(
-                        input_text=input_text, 
-                        entity_types=self.entity_types, 
+                        input_text=input_text,
+                        entity_types=self.entity_types,
                         current_entities=current_entities,
-                        current_relationships=current_relationships
+                        current_relationships=current_relationships,
                     )
                     refined_result = self.refine(
-                        input_text=input_text, 
-                        entity_types=self.entity_types, 
+                        input_text=input_text,
+                        entity_types=self.entity_types,
                         current_entities=current_entities,
                         current_relationships=current_relationships,
                         entity_critique=critique_result.entity_critique,
-                        relationship_critique=critique_result.relationship_critique
+                        relationship_critique=critique_result.relationship_critique,
+                    )
+                    logger.debug(
+                        f"entities: {len(current_entities)} | refined_entities: {len(refined_result.refined_entities)}"
+                    )
+                    logger.debug(
+                        f"relationships: {len(current_relationships)} | refined_relationships: {len(refined_result.refined_relationships)}"
                     )
-                    logger.debug(f"entities: {len(current_entities)} | refined_entities: {len(refined_result.refined_entities)}")
-                    logger.debug(f"relationships: {len(current_relationships)} | refined_relationships: {len(refined_result.refined_relationships)}")
                     current_entities = refined_result.refined_entities
                     current_relationships = refined_result.refined_relationships
 
         entities = [entity.to_dict() for entity in current_entities]
-        relationships = [relationship.to_dict() for relationship in current_relationships]
+        relationships = [
+            relationship.to_dict() for relationship in current_relationships
+        ]
 
         return dspy.Prediction(entities=entities, relationships=relationships)
```

**File**: `tests/entity_extraction/test_metric.py` (modified, +132/-43)
```diff
@@ -9,7 +9,9 @@
 
 @pytest.fixture
 def mock_dspy_predict():
-    with patch('nano_graphrag.entity_extraction.metric.dspy.TypedChainOfThought') as mock_predict:
+    with patch(
+        "nano_graphrag.entity_extraction.metric.dspy.ChainOfThought"
+    ) as mock_predict:
         mock_instance = Mock()
         mock_instance.return_value = dspy.Prediction(similarity_score=0.75)
         mock_predict.return_value = mock_instance
@@ -23,7 +25,7 @@ def sample_relationship():
         "tgt_id": "ENTITY2",
         "description": "Example relationship",
         "weight": 0.8,
-        "order": 1
+        "order": 1,
     }
 
 
@@ -33,85 +35,170 @@ def sample_entity():
         "entity_name": "EXAMPLE_ENTITY",
         "entity_type": "PERSON",
         "description": "An example entity",
-        "importance_score": 0.8
+        "importance_score": 0.8,
     }
 
 
 @pytest.fixture
 def example():
     def _example(items):
-        return {"relationships": items} if "src_id" in (items[0] if items else {}) else {"entities": items}
+        return (
+            {"relationships": items}
+            if "src_id" in (items[0] if items else {})
+            else {"entities": items}
+        )
+
     return _example
 
 
 @pytest.fixture
 def prediction():
     def _prediction(items):
-        return {"relationships": items} if "src_id" in (items[0] if items else {}) else {"entities": items}
+        return (
+            {"relationships": items}
+            if "src_id" in (items[0] if items else {})
+            else {"entities": items}
+        )
+
     return _prediction
 
 
 @pytest.mark.asyncio
-async def test_relationship_similarity_metric(sample_relationship, example, prediction, mock_dspy_predict):
-    gold = example([
-        {**sample_relationship, "src_id": "ENTITY1", "tgt_id": "ENTITY2", "description": "is related to"},
-        {**sample_relationship, "src_id": "ENTITY2", "tgt_id": "ENTITY3", "description": "is connected with"},
-    ])
-    pred = prediction([
-        {**sample_relationship, "src_id": "ENTITY1", "tgt_id": "ENTITY2", "description": "is connected to"},
-        {**sample_relationship, "src_id": "ENTITY2", "tgt_id": "ENTITY3", "description": "is linked with"},
-    ])
+async def test_relationship_similarity_metric(
+    sample_relationship, example, prediction, mock_dspy_predict
+):
+    gold = example(
+        [
+            {
+                **sample_relationship,
+                "src_id": "ENTITY1",
+                "tgt_id": "ENTITY2",
+                "description": "is related to",
+            },
+            {
+                **sample_relationship,
+                "src_id": "ENTITY2",
+                "tgt_id": "ENTITY3",
+                "description": "is connected with",
+            },
+        ]
+    )
+    pred = prediction(
+        [
+            {
+                **sample_relationship,
+                "src_id": "ENTITY1",
+                "tgt_id": "ENTITY2",
+                "description": "is connected to",
+            },
+            {
+                **sample_relationship,
+                "src_id": "ENTITY2",
+                "tgt_id": "ENTITY3",
+                "description": "is linked with",
+            },
+        ]
+    )
 
     similarity = relationships_similarity_metric(gold, pred)
     assert 0 <= similarity <= 1
 
 
 @pytest.mark.asyncio
 async def test_entity_recall_metric(sample_entity, example, prediction):
-    gold = example([
-        {**sample_entity, "entity_name": "ENTITY1"},
-        {**sample_entity, "entity_name": "ENTITY2"},
-        {**sample_entity, "entity_name": "ENTITY3"},
-    ])
-    pred = example([
-        {**sample_entity, "entity_name": "ENTITY1"},
-        {**sample_entity, "entity_name": "ENTITY3"},
-        {**sample_entity, "entity_name": "ENTITY4"},
-    ])
+    gold = example(
+        [
+            {**sample_entity, "entity_name": "ENTITY1"},
+            {**sample_entity, "entity_name": "ENTITY2"},
+            {**sample_entity, "entity_name": "ENTITY3"},
+        ]
+    )
+    pred = example(
+        [
+            {**sample_entity, "entity_name": "ENTITY1"},
+            {**sample_entity, "entity_name": "ENTITY3"},
+            {**sample_entity, "entity_name": "ENTITY4"},
+        ]
+    )
 
     recall = entity_recall_metric(gold, pred)
-    assert recall == 2/3
+    assert recall == 2 / 3
 
 
 @pytest.mark.asyncio
-async def test_relationship_similarity_metric_no_common_keys(sample_relationship, example, prediction, mock_dspy_predict):
-    gold = example([{**sample_relationship, "src_id": "ENTITY1", "tgt_id": "ENTITY2", "description": "is related to"}])
-    pred = prediction([{**sample_relationship, "src_id": "ENTITY3", "tgt_id": "ENTITY4", "description": "is connected with"}])
+async def test_relationship_similarity_metric_no_common_keys(
+    sample_relationship, example, prediction, mock_dspy_predict
+):
+    gold = example(
+        [
+            {
+                **sample_relationship,
+            
```

**File**: `tests/entity_extraction/test_module.py` (modified, +37/-18)
```diff
@@ -1,50 +1,69 @@
 import pytest
 import dspy
 from unittest.mock import Mock, patch
-from nano_graphrag.entity_extraction.module import TypedEntityRelationshipExtractor, Relationship, Entity
+from nano_graphrag.entity_extraction.module import (
+    TypedEntityRelationshipExtractor,
+    Relationship,
+    Entity,
+)
 
 
-@pytest.mark.parametrize("self_refine,num_refine_turns", [
-    (False, 0),
-    (True, 2)
-])
+@pytest.mark.parametrize("self_refine,num_refine_turns", [(False, 0), (True, 2)])
 def test_entity_relationship_extractor(self_refine, num_refine_turns):
-    with patch('nano_graphrag.entity_extraction.module.dspy.TypedChainOfThought') as mock_chain_of_thought:
+    with patch(
+        "nano_graphrag.entity_extraction.module.dspy.ChainOfThought"
+    ) as mock_chain_of_thought:
         input_text = "Apple announced a new iPhone model."
         mock_extractor = Mock()
         mock_critique = Mock()
         mock_refine = Mock()
-        
+
         mock_chain_of_thought.side_effect = [mock_extractor, mock_critique, mock_refine]
 
         mock_entities = [
-            Entity(entity_name="APPLE", entity_type="ORGANIZATION", description="A technology company", importance_score=1),
-            Entity(entity_name="IPHONE", entity_type="PRODUCT", description="A smartphone", importance_score=1)
+            Entity(
+                entity_name="APPLE",
+                entity_type="ORGANIZATION",
+                description="A technology company",
+                importance_score=1,
+            ),
+            Entity(
+                entity_name="IPHONE",
+                entity_type="PRODUCT",
+                description="A smartphone",
+                importance_score=1,
+            ),
         ]
         mock_relationships = [
-            Relationship(src_id="APPLE", tgt_id="IPHONE", description="Apple manufactures iPhone", weight=1, order=1)
+            Relationship(
+                src_id="APPLE",
+                tgt_id="IPHONE",
+                description="Apple manufactures iPhone",
+                weight=1,
+                order=1,
+            )
         ]
 
         mock_extractor.return_value = dspy.Prediction(
             entities=mock_entities, relationships=mock_relationships
         )
-        
+
         if self_refine:
             mock_critique.return_value = dspy.Prediction(
                 entity_critique="Good entities, but could be more detailed.",
-                relationship_critique="Relationships are accurate but limited."
+                relationship_critique="Relationships are accurate but limited.",
             )
             mock_refine.return_value = dspy.Prediction(
-                refined_entities=mock_entities,
-                refined_relationships=mock_relationships
+                refined_entities=mock_entities, refined_relationships=mock_relationships
             )
-        
-        extractor = TypedEntityRelationshipExtractor(self_refine=self_refine, num_refine_turns=num_refine_turns)
+
+        extractor = TypedEntityRelationshipExtractor(
+            self_refine=self_refine, num_refine_turns=num_refine_turns
+        )
         result = extractor.forward(input_text=input_text)
 
         mock_extractor.assert_called_once_with(
-            input_text=input_text,
-            entity_types=extractor.entity_types
+            input_text=input_text, entity_types=extractor.entity_types
         )
 
         if self_refine:
```

---

### Incident Patch 8: `fd070706` (2025-03-17)
**Commit Message**: fix: plugging in the self.namespace into the Cypher commands causes bugs, it needs ' ' (#132)

**File**: `nano_graphrag/_storage/gdb_neo4j.py` (modified, +16/-16)
```diff
@@ -12,7 +12,7 @@
 
 
 def make_path_idable(path):
-    return path.replace(".", "_").replace("/", "__").replace("-", "_")
+    return path.replace(".", "_").replace("/", "__").replace("-", "_").replace(":", "_")
 
 
 @dataclass
@@ -69,7 +69,7 @@ async def index_start_callback(self):
     async def has_node(self, node_id: str) -> bool:
         async with self.async_driver.session() as session:
             result = await session.run(
-                f"MATCH (n:{self.namespace}) WHERE n.id = $node_id RETURN COUNT(n) > 0 AS exists",
+                f"MATCH (n:`{self.namespace}`) WHERE n.id = $node_id RETURN COUNT(n) > 0 AS exists",
                 node_id=node_id,
             )
             record = await result.single()
@@ -78,7 +78,7 @@ async def has_node(self, node_id: str) -> bool:
     async def has_edge(self, source_node_id: str, target_node_id: str) -> bool:
         async with self.async_driver.session() as session:
             result = await session.run(
-                f"MATCH (s:{self.namespace})-[r]->(t:{self.namespace}) "
+                f"MATCH (s:`{self.namespace}`)-[r]->(t:`{self.namespace}`) "
                 "WHERE s.id = $source_id AND t.id = $target_id "
                 "RETURN COUNT(r) > 0 AS exists",
                 source_id=source_node_id,
@@ -90,8 +90,8 @@ async def has_edge(self, source_node_id: str, target_node_id: str) -> bool:
     async def node_degree(self, node_id: str) -> int:
         async with self.async_driver.session() as session:
             result = await session.run(
-                f"MATCH (n:{self.namespace}) WHERE n.id = $node_id "
-                f"RETURN COUNT {{(n)-[]-(:{self.namespace})}} AS degree",
+                f"MATCH (n:`{self.namespace}`) WHERE n.id = $node_id "
+                f"RETURN COUNT {{(n)-[]-(:`{self.namespace}`)}} AS degree",
                 node_id=node_id,
             )
             record = await result.single()
@@ -100,9 +100,9 @@ async def node_degree(self, node_id: str) -> int:
     async def edge_degree(self, src_id: str, tgt_id: str) -> int:
         async with self.async_driver.session() as session:
             result = await session.run(
-                f"MATCH (s:{self.namespace}), (t:{self.namespace}) "
+                f"MATCH (s:`{self.namespace}`), (t:`{self.namespace}`) "
                 "WHERE s.id = $src_id AND t.id = $tgt_id "
-                f"RETURN COUNT {{(s)-[]-(:{self.namespace})}} + COUNT {{(t)-[]-(:{self.namespace})}} AS degree",
+                f"RETURN COUNT {{(s)-[]-(:`{self.namespace}`)}} + COUNT {{(t)-[]-(:`{self.namespace}`)}} AS degree",
                 src_id=src_id,
                 tgt_id=tgt_id,
             )
@@ -112,7 +112,7 @@ async def edge_degree(self, src_id: str, tgt_id: str) -> int:
     async def get_node(self, node_id: str) -> Union[dict, None]:
         async with self.async_driver.session() as session:
             result = await session.run(
-                f"MATCH (n:{self.namespace}) WHERE n.id = $node_id RETURN properties(n) AS node_data",
+                f"MATCH (n:`{self.namespace}`) WHERE n.id = $node_id RETURN properties(n) AS node_data",
                 node_id=node_id,
             )
             record = await result.single()
@@ -137,7 +137,7 @@ async def get_edge(
     ) -> Union[dict, None]:
         async with self.async_driver.session() as session:
             result = await session.run(
-                f"MATCH (s:{self.namespace})-[r]->(t:{self.namespace}) "
+                f"MATCH (s:`{self.namespace}`)-[r]->(t:`{self.namespace}`) "
                 "WHERE s.id = $source_id AND t.id = $target_id "
                 "RETURN properties(r) AS edge_data",
                 source_id=source_node_id,
@@ -151,7 +151,7 @@ async def get_node_edges(
     ) -> Union[list[tuple[str, str]], None]:
         async with self.async_driver.session() as session:
             result = await session.run(
-                f"MATCH (s:{self.namespace})-[r]->(t:{self.namespace}) WHERE s.id = $source_id "
+                f"MATCH (s:`{self.namespace}`)-[r]->(t:`{self.namespace}`) WHERE s.id = $source_id "
                 "RETURN s.id AS source, t.id AS target",
                 source_id=source_node_id,
             )
@@ -164,7 +164,7 @@ async def upsert_node(self, node_id: str, node_data: dict[str, str]):
         node_type = node_data.get("entity_type", "UNKNOWN").strip('"')
         async with self.async_driver.session() as session:
             await session.run(
-                f"MERGE (n:{self.namespace}:{node_type} {{id: $node_id}}) "
+                f"MERGE (n:`{self.namespace}`:`{node_type}` {{id: $node_id}}) "
                 "SET n += $node_data",
                 node_id=node_id,
                 node_data=node_data,
@@ -176,7 +176,7 @@ async def upsert_edge(
         edge_data.setdefault("weight", 0.0)
         async with self.async_driver.session() as session:
             await session.run(
-                f"MATCH (s:{self.namespace}), (t:{self.namespace})
```

---

### Incident Patch 9: `a8043a62` (2024-11-17)
**Commit Message**:  fix: Cache Bug (#98)

**File**: `nano_graphrag/_op.py` (modified, +10/-3)
```diff
@@ -786,10 +786,17 @@ async def _find_most_related_edges_from_entities(
     all_related_edges = await asyncio.gather(
         *[knowledge_graph_inst.get_node_edges(dp["entity_name"]) for dp in node_datas]
     )
-    all_edges = set()
+    
+    all_edges = []
+    seen = set()
+    
     for this_edges in all_related_edges:
-        all_edges.update([tuple(sorted(e)) for e in this_edges])
-    all_edges = list(all_edges)
+        for e in this_edges:
+            sorted_edge = tuple(sorted(e))
+            if sorted_edge not in seen:
+                seen.add(sorted_edge)
+                all_edges.append(sorted_edge) 
+                
     all_edges_pack = await asyncio.gather(
         *[knowledge_graph_inst.get_edge(e[0], e[1]) for e in all_edges]
     )
```

---

### Incident Patch 10: `7a5686c7` (2024-10-19)
**Commit Message**: fix: add submodules for pypi (#70)

**File**: `nano_graphrag/__init__.py` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 from .graphrag import GraphRAG, QueryParam
 
-__version__ = "0.0.8"
+__version__ = "0.0.8.2"
 __author__ = "Jianbai Ye"
 __url__ = "https://github.com/gusye1234/nano-graphrag"
 
```

**File**: `setup.py` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
 import setuptools
+from setuptools import find_packages
 
 with open("readme.md", "r") as fh:
     long_description = fh.read()
@@ -28,7 +29,7 @@
     description="A simple, easy-to-hack GraphRAG implementation",
     long_description=long_description,
     long_description_content_type="text/markdown",
-    packages=["nano_graphrag"],
+    packages=find_packages(),
     classifiers=[
         "Programming Language :: Python :: 3",
         "License :: OSI Approved :: MIT License",
```

---

### Incident Patch 11: `1a858517` (2024-09-19)
**Commit Message**: fix: add splitter example and clean code

**File**: `examples/using_custom_chunking_method.py` (modified, +28/-53)
```diff
@@ -1,68 +1,43 @@
-
-
 from nano_graphrag._utils import encode_string_by_tiktoken
 from nano_graphrag.base import QueryParam
 from nano_graphrag.graphrag import GraphRAG
+from nano_graphrag._op import chunking_by_seperators
 
 
-def chunking_by_specific_separators(
-    content: str, overlap_token_size=128, max_token_size=1024, tiktoken_model="gpt-4o",
+def chunking_by_token_size(
+    tokens_list: list[list[int]],  # nano-graphrag may pass a batch of docs' tokens
+    doc_keys: list[str],  # nano-graphrag may pass a batch of docs' key ids
+    tiktoken_model,  # a titoken model
+    overlap_token_size=128,
+    max_token_size=1024,
 ):
-    from langchain_text_splitters  import RecursiveCharacterTextSplitter
-    
 
-    text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(chunk_size=max_token_size,
-        chunk_overlap=overlap_token_size,
-        # length_function=lambda x: len(encode_string_by_tiktoken(x)),
-        model_name=tiktoken_model,
-        is_separator_regex=False,
-        separators=[
-            # Paragraph separators
-            "\n\n",
-            "\r\n\r\n",
-            # Line breaks
-            "\n",
-            "\r\n",
-            # Sentence ending punctuation
-            "。",  # Chinese period
-            "．",  # Full-width dot
-            ".",  # English period
-            "！",  # Chinese exclamation mark
-            "!",  # English exclamation mark
-            "？",  # Chinese question mark
-            "?",  # English question mark
-            # Whitespace characters
-            " ",  # Space
-            "\t",  # Tab
-            "\u3000",  # Full-width space
-            # Special characters
-            "\u200b",  # Zero-width space (used in some Asian languages)
-            # Final fallback
-            "",
-        ])
-    texts = text_splitter.split_text(content)
-    
     results = []
-    for index, chunk_content in enumerate(texts):
-        
-        results.append(
-            {
-                # "tokens": None,
-                "content": chunk_content.strip(),
-                "chunk_order_index": index,
-            }
-        )
+    for index, tokens in enumerate(tokens_list):
+        chunk_token = []
+        lengths = []
+        for start in range(0, len(tokens), max_token_size - overlap_token_size):
+
+            chunk_token.append(tokens[start : start + max_token_size])
+            lengths.append(min(max_token_size, len(tokens) - start))
+
+        chunk_token = tiktoken_model.decode_batch(chunk_token)
+        for i, chunk in enumerate(chunk_token):
+
+            results.append(
+                {
+                    "tokens": lengths[i],
+                    "content": chunk.strip(),
+                    "chunk_order_index": i,
+                    "full_doc_id": doc_keys[index],
+                }
+            )
+
     return results
 
 
 WORKING_DIR = "./nano_graphrag_cache_local_embedding_TEST"
 rag = GraphRAG(
     working_dir=WORKING_DIR,
-    chunk_func=chunking_by_specific_separators,
+    chunk_func=chunking_by_seperators,
 )
-
-with open("../tests/mock_data.txt", encoding="utf-8-sig") as f:
-    FAKE_TEXT = f.read()
-
-# rag.insert(FAKE_TEXT)
-print(rag.query("What the main theme of this story?", param=QueryParam(mode="local")))
```

**File**: `nano_graphrag/_op.py` (modified, +71/-78)
```diff
@@ -1,11 +1,10 @@
-import asyncio
-import json
 import re
+import json
+import asyncio
+import tiktoken
 from typing import Union
 from collections import Counter, defaultdict
-
-import tiktoken
-
+from ._splitter import SeparatorSplitter
 from ._utils import (
     logger,
     clean_str,
@@ -30,99 +29,93 @@
 from .prompt import GRAPH_FIELD_SEP, PROMPTS
 
 
+def chunking_by_token_size(
+    tokens_list: list[list[int]],
+    doc_keys,
+    tiktoken_model,
+    overlap_token_size=128,
+    max_token_size=1024,
+):
+
+    results = []
+    for index, tokens in enumerate(tokens_list):
+        chunk_token = []
+        lengths = []
+        for start in range(0, len(tokens), max_token_size - overlap_token_size):
 
+            chunk_token.append(tokens[start : start + max_token_size])
+            lengths.append(min(max_token_size, len(tokens) - start))
 
-def chunking_by_token_size(
-        tokens_list: list[list[int]], doc_keys,tiktoken_model, overlap_token_size=128, max_token_size=1024,
-    ):
-        
-        results=[]
-        for index,tokens in enumerate(tokens_list):
-            chunk_token=[]
-            lengths=[]
-            for start in range(0, len(tokens), max_token_size - overlap_token_size):
-                
-                chunk_token.append(tokens[start : start + max_token_size])
-                lengths.append(min(max_token_size, len(tokens) - start))
-
-            # here somehow tricky, since the whole chunk tokens is list[list[list[int]]] for corpus(doc(chunk)),so it can't be decode entirely
-            chunk_token=tiktoken_model.decode_batch(chunk_token)
-            for i,chunk in enumerate(chunk_token):
-                
-                results.append(
-                    {
-                        "tokens": lengths[i],
-                        "content": chunk.strip(),
-                        "chunk_order_index": i,
-                        "full_doc_id":doc_keys[index],
-                    }
-                )
+        # here somehow tricky, since the whole chunk tokens is list[list[list[int]]] for corpus(doc(chunk)),so it can't be decode entirely
+        chunk_token = tiktoken_model.decode_batch(chunk_token)
+        for i, chunk in enumerate(chunk_token):
 
-        return results
-
-def chunking_by_seperators(tokens_list: list[list[int]], doc_keys,tiktoken_model, overlap_token_size=128, max_token_size=1024 ):
-    from nano_graphrag._spliter import SeparatorSplitter
-
-    DEFAULT_SEPERATORS=[
-        # Paragraph separators
-        "\n\n",
-        "\r\n\r\n",
-        # Line breaks
-        "\n",
-        "\r\n",
-        # Sentence ending punctuation
-        "。",  # Chinese period
-        "．",  # Full-width dot
-        ".",  # English period
-        "！",  # Chinese exclamation mark
-        "!",  # English exclamation mark
-        "？",  # Chinese question mark
-        "?",  # English question mark
-        # Whitespace characters
-        " ",  # Space
-        "\t",  # Tab
-        "\u3000",  # Full-width space
-        # Special characters
-        "\u200b",  # Zero-width space (used in some Asian languages)
-    ]
-    
-    splitter=SeparatorSplitter(separators=[tiktoken_model.encode(s) for s in DEFAULT_SEPERATORS],chunk_size=max_token_size,chunk_overlap=overlap_token_size)
-    results=[]
-    for index,tokens in enumerate(tokens_list):
-        chunk_token=splitter.split_tokens(tokens)
-        lengths=[len(c) for c in chunk_token]
+            results.append(
+                {
+                    "tokens": lengths[i],
+                    "content": chunk.strip(),
+                    "chunk_order_index": i,
+                    "full_doc_id": doc_keys[index],
+                }
+            )
+
+    return results
+
+
+def chunking_by_seperators(
+    tokens_list: list[list[int]],
+    doc_keys,
+    tiktoken_model,
+    overlap_token_size=128,
+    max_token_size=1024,
+):
+
+    splitter = SeparatorSplitter(
+        separators=[
+            tiktoken_model.encode(s) for s in PROMPTS["default_text_separator"]
+        ],
+        chunk_size=max_token_size,
+        chunk_overlap=overlap_token_size,
+    )
+    results = []
+    for index, tokens in enumerate(tokens_list):
+        chunk_token = splitter.split_tokens(tokens)
+        lengths = [len(c) for c in chunk_token]
 
         # here somehow tricky, since the whole chunk tokens is list[list[list[int]]] for corpus(doc(chunk)),so it can't be decode entirely
-        chunk_token=tiktoken_model.decode_batch(chunk_token)
-        for i,chunk in enumerate(chunk_token):
-            
+        chunk_token = tiktoken_model.decode_batch(chunk_token)
+        for i, chunk in enumerate(chunk_token):
+
             results.append(
                 {
                     "tokens": lengths[i],
                     "content": chunk.strip(),
                     "chunk_order_index": i,
-                    "full_doc_id":doc_keys[index],
+                    "full_doc_id": doc_keys[index],
              
```

**File**: `nano_graphrag/graphrag.py` (modified, +17/-5)
```diff
@@ -68,7 +68,16 @@ class GraphRAG:
     enable_naive_rag: bool = False
 
     # text chunking
-    chunk_func: Callable[[list[list[int]],List[str],tiktoken.Encoding, Optional[int], Optional[int], ], List[Dict[str, Union[str, int]]]] = chunking_by_token_size
+    chunk_func: Callable[
+        [
+            list[list[int]],
+            List[str],
+            tiktoken.Encoding,
+            Optional[int],
+            Optional[int],
+        ],
+        List[Dict[str, Union[str, int]]],
+    ] = chunking_by_token_size
     chunk_token_size: int = 1200
     chunk_overlap_token_size: int = 100
     tiktoken_model_name: str = "gpt-4o"
@@ -266,10 +275,13 @@ async def ainsert(self, string_or_strings):
             logger.info(f"[New Docs] inserting {len(new_docs)} docs")
 
             # ---------- chunking
-            
-            inserting_chunks = get_chunks(new_docs=new_docs,chunk_func=self.chunk_func,overlap_token_size=self.chunk_overlap_token_size,
-            max_token_size=self.chunk_token_size)
-            
+
+            inserting_chunks = get_chunks(
+                new_docs=new_docs,
+                chunk_func=self.chunk_func,
+                overlap_token_size=self.chunk_overlap_token_size,
+                max_token_size=self.chunk_token_size,
+            )
 
             _add_chunk_keys = await self.text_chunks.filter_keys(
                 list(inserting_chunks.keys())
```

**File**: `nano_graphrag/prompt.py` (modified, +23/-0)
```diff
@@ -490,3 +490,26 @@
 PROMPTS["fail_response"] = "Sorry, I'm not able to provide an answer to that question."
 
 PROMPTS["process_tickers"] = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
+
+PROMPTS["default_text_separator"] = [
+    # Paragraph separators
+    "\n\n",
+    "\r\n\r\n",
+    # Line breaks
+    "\n",
+    "\r\n",
+    # Sentence ending punctuation
+    "。",  # Chinese period
+    "．",  # Full-width dot
+    ".",  # English period
+    "！",  # Chinese exclamation mark
+    "!",  # English exclamation mark
+    "？",  # Chinese question mark
+    "?",  # English question mark
+    # Whitespace characters
+    " ",  # Space
+    "\t",  # Tab
+    "\u3000",  # Full-width space
+    # Special characters
+    "\u200b",  # Zero-width space (used in some Asian languages)
+]
```

**File**: `readme.md` (modified, +18/-0)
```diff
@@ -176,6 +176,8 @@ Below are the components you can use:
 |                 |  [`milvus-lite`](https://github.com/milvus-io/milvus-lite)   |      [examples](./examples)      |
 |                 | [faiss](https://github.com/facebookresearch/faiss?tab=readme-ov-file) |      [examples](./examples)      |
 | Visualization   |                           graphml                            |      [examples](./examples)      |
+| Chunking        |                        by token size                         |             Built-in             |
+|                 |                       by text splitter                       |             Built-in             |
 
 - `Built-in` means we have that implementation inside `nano-graphrag`. `examples` means we have that implementation inside an tutorial under [examples](./examples) folder.
 
@@ -227,6 +229,22 @@ Some important prompts:
 
 </details>
 
+<details>
+<summary>Customize Chunking</summary>
+`nano-graphrag` allow you to customize your own chunking method, check out the [example](./examples/using_custom_chunking_method.py).
+
+Switch to the built-in text splitter chunking method:
+
+```python
+from nano_graphrag._op import chunking_by_seperators
+
+GraphRAG(...,chunk_func=chunking_by_seperators,...)
+```
+
+</details>
+
+
+
 <details>
 <summary>LLM Function</summary>
 
```

**File**: `tests/test_splitter.py` (modified, +27/-18)
```diff
@@ -1,22 +1,26 @@
 import unittest
 from typing import List
-
-from nano_graphrag._spliter import SeparatorSplitter
+import tiktoken
+from nano_graphrag._splitter import SeparatorSplitter
+from nano_graphrag._op import chunking_by_seperators
 
 # Assuming the SeparatorSplitter class is already imported
 
+
 class TestSeparatorSplitter(unittest.TestCase):
 
     def setUp(self):
-        self.tokenize = lambda text: [ord(c) for c in text]  # Simple tokenizer for testing
-        self.detokenize = lambda tokens: ''.join(chr(t) for t in tokens)
+        self.tokenize = lambda text: [
+            ord(c) for c in text
+        ]  # Simple tokenizer for testing
+        self.detokenize = lambda tokens: "".join(chr(t) for t in tokens)
 
     def test_split_with_custom_separator(self):
         splitter = SeparatorSplitter(
-            separators=[self.tokenize('\n'), self.tokenize('.')],
+            separators=[self.tokenize("\n"), self.tokenize(".")],
             chunk_size=19,
             chunk_overlap=0,
-            keep_separator="end"
+            keep_separator="end",
         )
         text = "This is a test.\nAnother test."
         tokens = self.tokenize(text)
@@ -30,24 +34,17 @@ def test_split_with_custom_separator(self):
 
     def test_chunk_size_limit(self):
         splitter = SeparatorSplitter(
-            chunk_size=5,
-            chunk_overlap=0,
-            separators=[self.tokenize("\n")]
+            chunk_size=5, chunk_overlap=0, separators=[self.tokenize("\n")]
         )
         text = "1234567890"
         tokens = self.tokenize(text)
-        expected = [
-            self.tokenize("12345"),
-            self.tokenize("67890")
-        ]
+        expected = [self.tokenize("12345"), self.tokenize("67890")]
         result = splitter.split_tokens(tokens)
         self.assertEqual(result, expected)
 
     def test_chunk_overlap(self):
         splitter = SeparatorSplitter(
-            chunk_size=5,
-            chunk_overlap=2,
-            separators=[self.tokenize("\n")]
+            chunk_size=5, chunk_overlap=2, separators=[self.tokenize("\n")]
         )
         text = "1234567890"
         tokens = self.tokenize(text)
@@ -59,5 +56,17 @@ def test_chunk_overlap(self):
         result = splitter.split_tokens(tokens)
         self.assertEqual(result, expected)
 
-if __name__ == '__main__':
-    unittest.main()
\ No newline at end of file
+    def test_chunking_by_seperators(self):
+        encoder = tiktoken.encoding_for_model("gpt-4o")
+        text = "This is a test.\nAnother test."
+        tokens_list = [encoder.encode(text)]
+        doc_keys = ["doc1"]
+        results = chunking_by_seperators(tokens_list, doc_keys, encoder)
+        assert len(results) == 1
+        assert results[0]["chunk_order_index"] == 0
+        assert results[0]["full_doc_id"] == "doc1"
+        assert results[0]["content"] == text
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 12: `ad74d13d` (2024-09-18)
**Commit Message**: fix: graspologic dep for future(#43)

**File**: `requirements.txt` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+future>=1.0.0
 openai
 tiktoken
 networkx
```

---

### Incident Patch 13: `657f7030` (2024-09-18)
**Commit Message**: fix: pop max_tokens for ollama

**File**: `examples/no_openai_key_at_all.py` (modified, +3/-0)
```diff
@@ -32,6 +32,9 @@ async def local_embedding(texts: list[str]) -> np.ndarray:
 async def ollama_model_if_cache(
     prompt, system_prompt=None, history_messages=[], **kwargs
 ) -> str:
+    # remove kwargs that are not supported by ollama
+    kwargs.pop("max_tokens", None)
+
     ollama_client = ollama.AsyncClient()
     messages = []
     if system_prompt:
```

**File**: `examples/using_ollama_as_llm.py` (modified, +3/-0)
```diff
@@ -16,6 +16,9 @@
 async def ollama_model_if_cache(
     prompt, system_prompt=None, history_messages=[], **kwargs
 ) -> str:
+    # remove kwargs that are not supported by ollama
+    kwargs.pop("max_tokens", None)
+
     ollama_client = ollama.AsyncClient()
     messages = []
     if system_prompt:
```

---

### Incident Patch 14: `c2e67595` (2024-09-18)
**Commit Message**: fix: use utf-8

**File**: `nano_graphrag/_utils.py` (modified, +2/-2)
```diff
@@ -70,14 +70,14 @@ def compute_mdhash_id(content, prefix: str = ""):
 
 
 def write_json(json_obj, file_name):
-    with open(file_name, "w", encoding='utf-8') as f:
+    with open(file_name, "w", encoding="utf-8") as f:
         json.dump(json_obj, f, indent=2, ensure_ascii=False)
 
 
 def load_json(file_name):
     if not os.path.exists(file_name):
         return None
-    with open(file_name) as f:
+    with open(file_name, encoding="utf-8") as f:
         return json.load(f)
 
 
```

---

### Incident Patch 15: `f11e9f27` (2024-09-17)
**Commit Message**: fix: index outbound error

**File**: `nano_graphrag/_op.py` (modified, +4/-10)
```diff
@@ -14,7 +14,7 @@
     list_of_list_to_csv,
     pack_user_ass_to_openai_messages,
     split_string_by_multi_markers,
-    truncate_list_by_token_size
+    truncate_list_by_token_size,
 )
 from .base import (
     BaseGraphStorage,
@@ -49,9 +49,6 @@ def chunking_by_token_size(
     return results
 
 
-
-
-
 async def _handle_entity_relation_summary(
     entity_or_relation_name: str,
     description: str,
@@ -83,7 +80,7 @@ async def _handle_single_entity_extraction(
     record_attributes: list[str],
     chunk_key: str,
 ):
-    if record_attributes[0] != '"entity"' or len(record_attributes) < 4:
+    if len(record_attributes) < 4 or record_attributes[0] != '"entity"':
         return None
     # add this record as a node in the G
     entity_name = clean_str(record_attributes[1].upper())
@@ -104,7 +101,7 @@ async def _handle_single_relationship_extraction(
     record_attributes: list[str],
     chunk_key: str,
 ):
-    if record_attributes[0] != '"relationship"' or len(record_attributes) < 5:
+    if len(record_attributes) < 5 or record_attributes[0] != '"relationship"':
         return None
     # add this record as edge
     source = clean_str(record_attributes[1].upper())
@@ -216,10 +213,7 @@ async def _merge_edges_then_upsert(
         src_id,
         tgt_id,
         edge_data=dict(
-            weight=weight,
-            description=description,
-            source_id=source_id,
-            order=order
+            weight=weight, description=description, source_id=source_id, order=order
         ),
     )
 
```

#### Recent Merged Pull Requests:
- **PR #180** (closed): Cleanup (@chian)
- **PR #179** (closed): Method loop separation (@chian)
- **PR #176** (closed): Hpc (@chian)
- **PR #174** (closed): Feature/parser (@takemotoooo-eeic)
- **PR #170** (2026-01-27): fix: add encoding parameter to open() calls in setup.py (@majiayu000)
- **PR #169** (closed): fix: correct typos in variable names (@majiayu000)
- **PR #168** (closed): fix: handle leiden clustering with zero edges gracefully (@majiayu000)
- **PR #165** (closed): fix(examples): correct chunking function usage (@BAIKEMARK)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
