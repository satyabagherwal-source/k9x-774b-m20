# Forensic Learning Record (Deep Inspection): vitali87/code-graph-rag

> **Canonical Artifact**: `07_PROJECT_LEARNING/vitali87-code-graph-rag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vitali87/code-graph-rag](https://github.com/vitali87/code-graph-rag))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:46:45.696Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vitali87/code-graph-rag`
- **Description**: The ultimate RAG for your monorepo. Query, understand, and edit multi-language codebases with the power of AI and knowledge graphs
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5191 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/bench_ast_cache.py`
```
import sys
import time
from collections import OrderedDict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import harness  # noqa: E402

WARMUP_RUNS = 3
BENCH_RUNS = 50


class MockNode:
    __slots__ = ("data",)

    def __init__(self, size: int) -> None:
        self.data = b"\x00" * size


def bench_ordered_dict_insert(count: int, item_size: int) -> float:
    start = time.perf_counter()
    cache: OrderedDict[Path, tuple[MockNode, str]] = OrderedDict()
    for i in range(count):
        key = Path(f"/fake/path/module_{i}.py")
        cache[key] = (MockNode(item_size), "python")
    return time.perf_counter() - start


def bench_ordered_dict_lookup(cache: OrderedDict, keys: list[Path]) -> float:
    start = time.perf_counter()
    for key in keys:
        _ = key in cache
    return time.perf_counter() - start


def bench_ordered_dict_access_lru(cache: OrderedDict, keys: list[Path]) -> float:
    start = time.perf_counter()
    for key in keys:
        if key in cache:
            cache.move_to_end(key)
            _ = cache[key]
    return time.perf_counter() - start


def bench_ordered_dict_eviction(count: int, max_size: int, item_size: int) -> float:
    start = time.perf_counter()
    cache: OrderedDict[Path, tuple[MockNode, str]] = OrderedDict()
    for i in range(count):
        key = Path(f"/fake/path/module_{i}.py")
        cache[key] = (MockNode(item_size), "python")
        while len(cache) > max_size:
            cache.popitem(last=False)
    return time.perf_counter() - start


def bench_getsizeof_overhead(cache: OrderedDict) -> float:
    start = time.perf_counter()
    _ = sum(sys.getsizeof(v) for v in cache.values())
    return time.perf_counter() - start


def run_benchmark(name: str, func, *args) -> dict[str, float]:
    return harness.run_benchmark(
        name, func, *args, warmup_runs=WARMUP_RUNS, bench_runs=BENCH_RUNS
    )


def print_results(results: list[dict[str, float]]) -> None:
    harness.print_results(results, 45)


def main() -> None:
    configs = [
        (500, 1024),
        (2000, 4096),
        (5000, 8192),
    ]

    for count, item_size in configs:
        print(f"\n{'='*115}")
        print(f"BoundedASTCache Benchmark (entries={count}, item_size={item_size}B)")
        print(f"{'='*115}")

        results = []

        r = run_benchmark(f"insert ({count})", bench_ordered_dict_insert, count, item_size)
        results.append(r)

        cache: OrderedDict[Path, tuple[MockNode, str]] = OrderedDict()
        keys: list[Path] = []
        for i in range(count):
            key = Path(f"/fake/path/module_{i}.py")
            keys.append(key)
            cache[key] = (MockNode(item_size), "python")

        r = run_benchmark(f"lookup ({count})", bench_ordered_dict_lookup, cache, keys)
        results.append(r)

        r = run_benchmark(f"access+LRU ({count})", bench_ordered_dict_access_lru, cache, keys)
        results.append(r)

        max_size = count // 2
        r = run_benchmark(
            f"insert+evict (max={max_size})",
            bench_ordered_dict_eviction, count, max_size, item_size,
        )
        results.append(r)

        r = run_benchmark(f"getsizeof scan ({count})", bench_getsizeof_overhead, cache)
        results.append(r)

        print_results(results)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/bench_dropin_replacements.py`
```
import hashlib
import json
import os
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import harness  # noqa: E402

try:
    import blake3
    import orjson
except ImportError as e:
    print(f"SKIP bench_dropin_replacements: {e}")
    print("Install with: uv pip install blake3 orjson")
    raise SystemExit(0)

WARMUP_RUNS = 3
BENCH_RUNS = 30


def generate_graph_data(num_nodes: int, num_rels: int) -> dict:
    nodes = []
    for i in range(num_nodes):
        nodes.append({
            "node_id": i,
            "labels": ["Function" if i % 3 == 0 else "Class" if i % 3 == 1 else "Module"],
            "properties": {
                "qualified_name": f"project.module{i // 100}.Class{i // 10}.method{i}",
                "name": f"method{i}",
                "start_line": i * 10,
                "end_line": i * 10 + 9,
                "docstring": f"Method {i} documentation string with some content" if i % 5 == 0 else None,
                "decorators": ["staticmethod"] if i % 7 == 0 else [],
                "is_exported": i % 4 == 0,
            },
        })

    rels = []
    for i in range(num_rels):
        rels.append({
            "from_id": i % num_nodes,
            "to_id": (i * 7 + 3) % num_nodes,
            "type": "CALLS" if i % 3 == 0 else "DEFINES" if i % 3 == 1 else "IMPORTS",
            "properties": {"weight": i % 10} if i % 5 == 0 else {},
        })

    return {
        "nodes": nodes,
        "relationships": rels,
        "metadata": {
            "total_nodes": num_nodes,
            "total_relationships": num_rels,
            "exported_at": "2026-03-14T10:00:00+00:00",
        },
    }


def generate_snippets(count: int, avg_length: int = 200) -> list[str]:
    import random
    import string
    random.seed(42)
    snippets = []
    for _ in range(count):
        length = avg_length + random.randint(-50, 50)
        snippet = "".join(random.choices(string.ascii_letters + string.digits + " \n\t", k=length))
        snippets.append(snippet)
    return snippets


def create_test_files(directory: str, count: int, avg_size_kb: int) -> list[Path]:
    paths = []
    for i in range(count):
        path = Path(directory) / f"file_{i}.py"
        content = os.urandom(avg_size_kb * 1024)
        path.write_bytes(content)
        paths.append(path)
    return paths


def bench_json_dumps(data: dict) -> float:
    start = time.perf_counter()
    _ = json.dumps(data)
    return time.perf_counter() - start


def bench_orjson_dumps(data: dict) -> float:
    start = time.perf_counter()
    _ = orjson.dumps(data)
    return time.perf_counter() - start


def bench_json_dumps_indent(data: dict) -> float:
    start = time.perf_counter()
    _ = json.dumps(data, indent=2, ensure_ascii=False)
    return time.perf_counter() - start


def bench_orjson_dumps_indent(data: dict) -> float:
    start = time.perf_counter()
    _ = orjson.dumps(data, option=orjson.OPT_INDENT_2)
    return time.perf_counter() - start


def bench_json_loads(json_bytes: bytes) -> float:
    start = time.perf_counter()
    _ = json.loads(json_bytes)
    return time.perf_counter() - start


def bench_orjson_loads(json_bytes: bytes) -> float:
    start = time.perf_counter()
    _ = orjson.loads(json_bytes)
    return time.perf_counter() - start


def bench_sha256_hashing(snippets: list[str]) -> float:
    start = time.perf_counter()
    for s in snippets:
        _ = hashlib.sha256(s.encode()).hexdigest()
    return time.perf_counter() - start


def bench_blake3_hashing(snippets: list[str]) -> float:
    start = time.perf_counter()
    for s in snippets:
        _ = blake3.blake3(s.encode()).hexdigest()
    return time.perf_counter() - start


def bench_sha256_file(files: list[Path]) -> float:
    start = time.perf_counter()
    for f in files:
        hasher = hashlib.sha256()
        with f.open("rb") as fh:
            while chunk := fh.read(8192):
                hasher.update(chunk)
        _ = hasher.hexdigest()
    return time.perf_counter() - start


def bench_blake3_file(files: list[Path]) -> float:
    start = time.perf_counter()
    for f in files:
        hasher = blake3.blake3()
        with f.open("rb") as fh:
            while chunk := fh.read(8192):
                hasher.update(chunk)
        _ = hasher.hexdigest()
    return time.perf_counter() - start


def run_benchmark(name: str, func, *args) -> dict[str, float]:
    return harness.run_benchmark(
        name, func, *args, warmup_runs=WARMUP_RUNS, bench_runs=BENCH_RUNS
    )


def print_results(results: list[dict[str, float]]) -> None:
    harness.print_results(results, 50)


def print_comparison(baseline: dict[str, float], optimized: dict[str, float]) -> None:
    speedup = baseline["median_ms"] / optimized["median_ms"] if optimized["median_ms"] > 0 else float("inf")
    print(f"  -> Speedup: {speedup:.1f}x (median)")


def main() -> None:
    print("=" * 120)
    print("DROP-IN REPLACEMENT BENCHMARKS: Python stdlib vs Rust-backed alternatives")
    print("=" * 120)

    # --- JSON Serialization ---
    for num_nodes, num_rels in [(1000, 2000), (5000, 10000), (20000, 50000)]:
        print(f"\n{'='*120}")
        print(f"JSON Serialization: stdlib json vs orjson (nodes={num_nodes}, rels={num_rels})")
        print(f"{'='*120}")

        data = generate_graph_data(num_nodes, num_rels)
        json_bytes = json.dumps(data).encode()
        orjson_bytes = orjson.dumps(data)
        print(f"Data size: {len(json_bytes) / 1024:.1f} KB")

        results = []

        r1 = run_benchmark(f"json.dumps compact ({num_nodes}n)", bench_json_dumps, data)
        results.append(r1)
        r2 = run_benchmark(f"orjson.dumps compact ({num_nodes}n)", bench_orjson_dumps, data)
        results.append(r2)

        r3 = run_benchmark(f"json.dumps indented ({num_nodes}n)", bench_json_dumps_indent, data)
        results.append(r3)
        r4 = run_benchmark(f"orjson.dumps indented ({num_nodes}n)", bench_orjson_dumps_indent, data)
        results.append(r4)

        r5 = run_benchmark(f"json.loads ({num_nodes}n)", bench_json_loads, json_bytes)
        results.append(r5)
        r6 = run_benchmark(f"orjson.loads ({num_nodes}n)", bench_orjson_loads, orjson_bytes)
        results.append(r6)

        print_results(results)

        print("\nSpeedups:")
        print(f"  dumps compact: {r1['median_ms'] / r2['median_ms']:.1f}x")
        print(f"  dumps indented: {r3['median_ms'] / r4['median_ms']:.1f}x")
        print(f"  loads: {r5['median_ms'] / r6['median_ms']:.1f}x")

    # --- Hashing: SHA256 vs BLAKE3 ---
    print(f"\n\n{'='*120}")
    print("Hashing: hashlib.sha256 vs blake3 (snippet hashing for EmbeddingCache)")
    print(f"{'='*120}")

    for size in [500, 2000, 10000]:
        snippets = generate_snippets(size)
        print(f"\n--- Snippet count: {size} ---")

        results = []
        r1 = run_benchmark(f"hashlib.sha256 ({size} snippets)", bench_sha256_hashing, snippets)
        results.append(r1)
        r2 = run_benchmark(f"blake3 ({size} snippets)", bench_blake3_hashing, snippets)
        results.append(r2)

        print_results(results)
        print(f"  Speedup: {r1['median_ms'] / r2['median_ms']:.1f}x")

    # --- File Hashing ---
    print(f"\n\n{'='*120}")
    print("File Hashing: SHA256 vs BLAKE3 (incremental build file change detection)")
    print(f"{'='*120}")

    for file_count, avg_size_kb in [(50, 5), (200, 10), (500, 20)]:
        with tempfile.TemporaryDirectory() as tmpdir:
            files = create_test_files(tmpdir, file_count, avg_size_kb)
            total_mb = sum(f.stat().st_size for f in files) / (1024 * 1024)
            print(f"\n--- Files: {file_count}, Total: {total_mb:.1f} MB ---")

            results = []
            r1 = run_benchmark(f"sha256 ({file_count}f, {avg_size_kb}KB avg)", bench_sha256_file, files)
            results.append(r1)
            r2 = run_benchmark(f"blake3 ({file_count}f, {avg_size_kb}KB a
```

### Core Architecture Module: `benchmarks/bench_embedding_cache.py`
```
import hashlib
import random
import string
import sys
import time
from pathlib import Path

from codebase_rag.embedder import EmbeddingCache

sys.path.insert(0, str(Path(__file__).resolve().parent))
import harness  # noqa: E402

WARMUP_RUNS = 3
BENCH_RUNS = 50
EMBEDDING_DIM = 768


def generate_snippets(count: int, avg_length: int = 200) -> list[str]:
    snippets = []
    for i in range(count):
        length = avg_length + random.randint(-50, 50)
        snippet = "".join(random.choices(string.ascii_letters + string.digits + " \n\t", k=length))
        snippets.append(snippet)
    return snippets


def generate_embedding() -> list[float]:
    return [random.random() for _ in range(EMBEDDING_DIM)]


def bench_sha256_hashing(snippets: list[str]) -> float:
    start = time.perf_counter()
    for s in snippets:
        _ = hashlib.sha256(s.encode()).hexdigest()
    return time.perf_counter() - start


def bench_cache_put(cache: EmbeddingCache, snippets: list[str], embeddings: list[list[float]]) -> float:
    start = time.perf_counter()
    for s, e in zip(snippets, embeddings):
        cache.put(s, e)
    return time.perf_counter() - start


def bench_cache_get_hit(cache: EmbeddingCache, snippets: list[str]) -> float:
    start = time.perf_counter()
    for s in snippets:
        _ = cache.get(s)
    return time.perf_counter() - start


def bench_cache_get_miss(cache: EmbeddingCache, miss_snippets: list[str]) -> float:
    start = time.perf_counter()
    for s in miss_snippets:
        _ = cache.get(s)
    return time.perf_counter() - start


def bench_cache_get_many(cache: EmbeddingCache, snippets: list[str]) -> float:
    start = time.perf_counter()
    _ = cache.get_many(snippets)
    return time.perf_counter() - start


def run_benchmark(name: str, func, *args) -> dict[str, float]:
    return harness.run_benchmark(
        name, func, *args, warmup_runs=WARMUP_RUNS, bench_runs=BENCH_RUNS
    )


def print_results(results: list[dict[str, float]]) -> None:
    harness.print_results(results, 40)


def main() -> None:
    random.seed(42)

    sizes = [500, 2000, 10000]

    for size in sizes:
        print(f"\n{'='*110}")
        print(f"EmbeddingCache Benchmark (n={size})")
        print(f"{'='*110}")

        snippets = generate_snippets(size)
        embeddings = [generate_embedding() for _ in range(size)]
        miss_snippets = generate_snippets(size, avg_length=300)

        results = []

        r = run_benchmark(f"sha256 hashing ({size})", bench_sha256_hashing, snippets)
        results.append(r)

        cache = EmbeddingCache()
        r = run_benchmark(f"cache.put ({size})", bench_cache_put, cache, snippets, embeddings)
        results.append(r)

        cache = EmbeddingCache()
        cache.put_many(snippets, embeddings)

        r = run_benchmark(f"cache.get hit ({size})", bench_cache_get_hit, cache, snippets)
        results.append(r)

        r = run_benchmark(f"cache.get miss ({size})", bench_cache_get_miss, cache, miss_snippets)
        results.append(r)

        r = run_benchmark(f"cache.get_many ({size})", bench_cache_get_many, cache, snippets)
        results.append(r)

        print_results(results)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/bench_file_hashing.py`
```
import hashlib
import os
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import harness  # noqa: E402

WARMUP_RUNS = 3
BENCH_RUNS = 30


def create_test_files(directory: str, count: int, avg_size_kb: int) -> list[Path]:
    paths = []
    for i in range(count):
        path = Path(directory) / f"file_{i}.py"
        content = os.urandom(avg_size_kb * 1024)
        path.write_bytes(content)
        paths.append(path)
    return paths


def hash_file_sha256(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with filepath.open("rb") as f:
        while chunk := f.read(8192):
            hasher.update(chunk)
    return hasher.hexdigest()


def hash_file_sha256_large_buffer(filepath: Path) -> str:
    hasher = hashlib.sha256()
    with filepath.open("rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def hash_file_sha256_mmap(filepath: Path) -> str:
    import mmap
    hasher = hashlib.sha256()
    with filepath.open("rb") as f:
        with mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
            hasher.update(mm)
    return hasher.hexdigest()


def hash_file_md5(filepath: Path) -> str:
    hasher = hashlib.md5()
    with filepath.open("rb") as f:
        while chunk := f.read(8192):
            hasher.update(chunk)
    return hasher.hexdigest()


def hash_file_blake2b(filepath: Path) -> str:
    hasher = hashlib.blake2b()
    with filepath.open("rb") as f:
        while chunk := f.read(8192):
            hasher.update(chunk)
    return hasher.hexdigest()


def bench_hash_files(files: list[Path], hash_func) -> float:
    start = time.perf_counter()
    for f in files:
        _ = hash_func(f)
    return time.perf_counter() - start


def run_benchmark(name: str, func, *args) -> dict[str, float]:
    return harness.run_benchmark(
        name, func, *args, warmup_runs=WARMUP_RUNS, bench_runs=BENCH_RUNS
    )


def print_results(results: list[dict[str, float]]) -> None:
    harness.print_results(results, 45)


def main() -> None:
    configs = [
        (50, 5),
        (200, 10),
        (500, 20),
    ]

    for file_count, avg_size_kb in configs:
        print(f"\n{'='*115}")
        print(f"File Hashing Benchmark (files={file_count}, avg_size={avg_size_kb}KB)")
        print(f"{'='*115}")

        with tempfile.TemporaryDirectory() as tmpdir:
            files = create_test_files(tmpdir, file_count, avg_size_kb)
            total_mb = sum(f.stat().st_size for f in files) / (1024 * 1024)
            print(f"Total data: {total_mb:.1f} MB")

            results = []

            r = run_benchmark(f"sha256 8KB buf ({file_count}f)", bench_hash_files, files, hash_file_sha256)
            results.append(r)

            r = run_benchmark(f"sha256 64KB buf ({file_count}f)", bench_hash_files, files, hash_file_sha256_large_buffer)
            results.append(r)

            r = run_benchmark(f"sha256 mmap ({file_count}f)", bench_hash_files, files, hash_file_sha256_mmap)
            results.append(r)

            r = run_benchmark(f"md5 ({file_count}f)", bench_hash_files, files, hash_file_md5)
            results.append(r)

            r = run_benchmark(f"blake2b ({file_count}f)", bench_hash_files, files, hash_file_blake2b)
            results.append(r)

            print_results(results)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/bench_find_ending_with_fix.py`
```
import sys
import time
from collections import defaultdict
from pathlib import Path

from codebase_rag.graph_updater import FunctionRegistryTrie
from codebase_rag.types_defs import NodeType, SimpleNameLookup

sys.path.insert(0, str(Path(__file__).resolve().parent))
import harness  # noqa: E402

WARMUP_RUNS = 3
BENCH_RUNS = 30


def generate_realistic_registry(count: int) -> tuple[list[str], list[str]]:
    modules = ["codebase_rag", "utils", "parsers", "services", "tools", "models"]
    submodules = ["core", "api", "handlers", "helpers", "base", "factory"]
    classes = ["Handler", "Manager", "Factory", "Builder", "Processor", "Resolver",
               "Analyzer", "Extractor", "Generator", "Validator"]
    methods = ["process", "handle", "create", "build", "resolve", "validate",
               "execute", "parse", "extract", "transform", "analyze", "generate",
               "find", "get", "set", "update", "delete", "check"]

    qualified_names = []
    for i in range(count):
        mod = modules[i % len(modules)]
        sub = submodules[(i // len(modules)) % len(submodules)]
        cls = classes[(i // (len(modules) * len(submodules))) % len(classes)]
        meth = methods[(i // (len(modules) * len(submodules) * len(classes))) % len(methods)]
        qualified_names.append(f"{mod}.{sub}.{cls}.method_{i}.{meth}")

    lookup_suffixes = methods + [f"method_{i}" for i in range(0, count, count // 20)]
    return qualified_names, lookup_suffixes


def bench_linear_scan_endswith(entries: dict[str, NodeType], suffix: str) -> float:
    start = time.perf_counter()
    _ = [qn for qn in entries.keys() if qn.endswith(f".{suffix}")]
    return time.perf_counter() - start


def bench_indexed_lookup(lookup: SimpleNameLookup, suffix: str) -> float:
    start = time.perf_counter()
    _ = list(lookup.get(suffix, set()))
    return time.perf_counter() - start


def bench_trie_find_ending_with_index_hit(
    trie: FunctionRegistryTrie, suffixes: list[str], indexed_suffixes: set[str]
) -> float:
    start = time.perf_counter()
    for suffix in suffixes:
        if suffix in indexed_suffixes:
            _ = trie.find_ending_with(suffix)
    return time.perf_counter() - start


def bench_trie_find_ending_with_index_miss(
    trie: FunctionRegistryTrie, suffixes: list[str], indexed_suffixes: set[str]
) -> float:
    start = time.perf_counter()
    for suffix in suffixes:
        if suffix not in indexed_suffixes:
            _ = trie.find_ending_with(suffix)
    return time.perf_counter() - start


def bench_trie_find_ending_with_all(
    trie: FunctionRegistryTrie, suffixes: list[str]
) -> float:
    start = time.perf_counter()
    for suffix in suffixes:
        _ = trie.find_ending_with(suffix)
    return time.perf_counter() - start


def bench_linear_scan_batch(entries: dict[str, NodeType], suffixes: list[str]) -> float:
    start = time.perf_counter()
    for suffix in suffixes:
        _ = [qn for qn in entries.keys() if qn.endswith(f".{suffix}")]
    return time.perf_counter() - start


def bench_indexed_lookup_batch(lookup: SimpleNameLookup, suffixes: list[str]) -> float:
    start = time.perf_counter()
    for suffix in suffixes:
        _ = list(lookup.get(suffix, set()))
    return time.perf_counter() - start


def bench_full_suffix_index_batch(
    suffix_index: dict[str, set[str]], suffixes: list[str]
) -> float:
    start = time.perf_counter()
    for suffix in suffixes:
        _ = list(suffix_index.get(suffix, set()))
    return time.perf_counter() - start


def build_full_suffix_index(qualified_names: list[str]) -> dict[str, set[str]]:
    index: dict[str, set[str]] = defaultdict(set)
    for qn in qualified_names:
        simple_name = qn.rsplit(".", 1)[-1]
        index[simple_name].add(qn)
    return dict(index)


def run_benchmark(name: str, func, *args) -> dict[str, float]:
    return harness.run_benchmark(
        name, func, *args, warmup_runs=WARMUP_RUNS, bench_runs=BENCH_RUNS
    )


def print_results(results: list[dict[str, float]]) -> None:
    harness.print_results(results, 55)


def main() -> None:
    print("=" * 125)
    print("find_ending_with FIX BENCHMARK: Linear Scan vs Indexed Lookup")
    print("This benchmarks the #1 CPU hotspot (48.3% of total runtime)")
    print("=" * 125)

    sizes = [1000, 4500, 10000]

    for size in sizes:
        print(f"\n{'='*125}")
        print(f"Registry size: {size} entries")
        print(f"{'='*125}")

        qualified_names, lookup_suffixes = generate_realistic_registry(size)

        simple_lookup: SimpleNameLookup = defaultdict(set)
        trie = FunctionRegistryTrie(simple_name_lookup=simple_lookup)
        for qn in qualified_names:
            trie.insert(qn, NodeType.FUNCTION)
            simple_name = qn.rsplit(".", 1)[-1]
            simple_lookup[simple_name].add(qn)

        full_suffix_index = build_full_suffix_index(qualified_names)

        partially_indexed_suffixes = set(list(simple_lookup.keys())[:len(simple_lookup) // 5])
        miss_suffixes = [s for s in lookup_suffixes if s not in partially_indexed_suffixes]

        results = []

        print(f"\nSingle-suffix operations (on '{lookup_suffixes[0]}'):")
        r = run_benchmark(
            f"LINEAR SCAN endswith ({size} entries)",
            bench_linear_scan_endswith, dict(trie.items()), lookup_suffixes[0],
        )
        results.append(r)

        r = run_benchmark(
            f"INDEXED lookup (hit) ({size} entries)",
            bench_indexed_lookup, simple_lookup, lookup_suffixes[0],
        )
        results.append(r)

        print_results(results)
        if results[1]["median_ms"] > 0:
            speedup = results[0]["median_ms"] / results[1]["median_ms"]
            print(f"\n  -> Index hit speedup: {speedup:.0f}x")

        results = []
        num_queries = len(lookup_suffixes)
        print(f"\nBatch operations ({num_queries} queries, simulating call resolution):")

        r = run_benchmark(
            f"LINEAR SCAN batch ({num_queries}q, {size} entries)",
            bench_linear_scan_batch, dict(trie.items()), lookup_suffixes,
        )
        results.append(r)

        r = run_benchmark(
            f"PARTIAL INDEX batch ({num_queries}q, {size} entries)",
            bench_trie_find_ending_with_all, trie, lookup_suffixes,
        )
        results.append(r)

        r = run_benchmark(
            f"FULL SUFFIX INDEX batch ({num_queries}q, {size} entries)",
            bench_full_suffix_index_batch, full_suffix_index, lookup_suffixes,
        )
        results.append(r)

        print_results(results)

        if results[2]["median_ms"] > 0:
            print(f"\n  -> Linear scan vs full index: {results[0]['median_ms'] / results[2]['median_ms']:.0f}x speedup")
            print(f"  -> Partial index vs full index: {results[1]['median_ms'] / results[2]['median_ms']:.1f}x speedup")

    print(f"\n\n{'='*125}")
    print("CONCLUSION: The 48.3% CPU hotspot is caused by linear scans on index misses.")
    print("Building a complete suffix index eliminates the bottleneck entirely.")
    print("This is a pure Python fix requiring zero FFI, zero new dependencies.")
    print(f"{'='*125}")


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/bench_graph_loader.py`
```
import json
import sys
import tempfile
import time
from pathlib import Path

from codebase_rag.graph_loader import GraphLoader

sys.path.insert(0, str(Path(__file__).resolve().parent))
import harness  # noqa: E402

WARMUP_RUNS = 2
BENCH_RUNS = 20


def generate_graph_json(num_nodes: int, num_rels: int) -> str:
    nodes = []
    for i in range(num_nodes):
        nodes.append({
            "node_id": i,
            "labels": ["Function" if i % 3 == 0 else "Class" if i % 3 == 1 else "Module"],
            "properties": {
                "qualified_name": f"project.module{i // 100}.Class{i // 10}.method{i}",
                "name": f"method{i}",
                "start_line": i * 10,
                "end_line": i * 10 + 9,
            },
        })

    rels = []
    for i in range(num_rels):
        rels.append({
            "from_id": i % num_nodes,
            "to_id": (i * 7 + 3) % num_nodes,
            "type": "CALLS" if i % 2 == 0 else "DEFINES",
            "properties": {},
        })

    graph = {
        "nodes": nodes,
        "relationships": rels,
        "metadata": {
            "total_nodes": num_nodes,
            "total_relationships": num_rels,
        },
    }
    return json.dumps(graph)


def bench_json_parse(json_str: str) -> float:
    start = time.perf_counter()
    _ = json.loads(json_str)
    return time.perf_counter() - start


def bench_graph_load(file_path: str) -> float:
    start = time.perf_counter()
    loader = GraphLoader(file_path)
    loader.load()
    return time.perf_counter() - start


def bench_find_nodes_by_label(loader: GraphLoader) -> float:
    labels = ["Function", "Class", "Module"]
    start = time.perf_counter()
    for label in labels:
        _ = loader.find_nodes_by_label(label)
    return time.perf_counter() - start


def bench_find_node_by_property(loader: GraphLoader) -> float:
    start = time.perf_counter()
    for i in range(100):
        qn = f"project.module{i}.Class{i * 10 // 10}.method{i * 10}"
        _ = loader.find_node_by_property("qualified_name", qn)
    return time.perf_counter() - start


def bench_get_relationships(loader: GraphLoader, num_nodes: int) -> float:
    start = time.perf_counter()
    for i in range(min(500, num_nodes)):
        _ = loader.get_relationships_for_node(i)
    return time.perf_counter() - start


def bench_summary(loader: GraphLoader) -> float:
    start = time.perf_counter()
    _ = loader.summary()
    return time.perf_counter() - start


def run_benchmark(name: str, func, *args) -> dict[str, float]:
    return harness.run_benchmark(
        name, func, *args, warmup_runs=WARMUP_RUNS, bench_runs=BENCH_RUNS
    )


def print_results(results: list[dict[str, float]]) -> None:
    harness.print_results(results, 40)


def main() -> None:
    configs = [
        (1000, 2000),
        (5000, 10000),
        (20000, 50000),
    ]

    for num_nodes, num_rels in configs:
        print(f"\n{'='*110}")
        print(f"GraphLoader Benchmark (nodes={num_nodes}, rels={num_rels})")
        print(f"{'='*110}")

        json_str = generate_graph_json(num_nodes, num_rels)
        print(f"JSON size: {len(json_str) / 1024:.1f} KB")

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as tmp:
            tmp.write(json_str)
            tmp_path = tmp.name

        results = []

        r = run_benchmark(f"json.loads ({num_nodes}n)", bench_json_parse, json_str)
        results.append(r)

        r = run_benchmark(f"GraphLoader.load ({num_nodes}n)", bench_graph_load, tmp_path)
        results.append(r)

        loader = GraphLoader(tmp_path)
        loader.load()

        r = run_benchmark(f"find_nodes_by_label ({num_nodes}n)", bench_find_nodes_by_label, loader)
        results.append(r)

        r = run_benchmark(f"find_node_by_property ({num_nodes}n)", bench_find_node_by_property, loader)
        results.append(r)

        r = run_benchmark(f"get_relationships ({num_nodes}n)", bench_get_relationships, loader, num_nodes)
        results.append(r)

        r = run_benchmark(f"summary ({num_nodes}n)", bench_summary, loader)
        results.append(r)

        print_results(results)

        Path(tmp_path).unlink(missing_ok=True)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `benchmarks/bench_indexing.py`
```
"""Indexing-time benchmark on a pinned corpus (issue #1374, deliverable 4).

The first of the four benchmarks that issue asks for, and deliberately the
first: it needs no model key and no databases, so it runs in CI and produces a
README row immediately. The other three (agentic resolved-rate, query latency,
token cost) all require a live stack or an LLM key.

**What this measures.** The real `GraphUpdater` pipeline -- the same parse,
definition and call passes production runs -- against an in-memory ingestor
rather than Memgraph. So the number is honest about parsing and graph
construction, and excludes database round-trips by construction. That
exclusion is the point rather than a shortcut: it isolates the cost this
project controls from the cost of the two databases, which is precisely the
question the field-test review asked (is the graph worth feeding?), and it is
what makes the measurement reproducible without infrastructure.

Do not read the result as end-to-end `cgr index` wall-clock. Deliverable 2 in
#1374 covers the real stack, and that number will be larger.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path

from codebase_rag import constants as cs

# macOS reports ru_maxrss in bytes, Linux in kibibytes. Getting this wrong is a
# silent factor-of-1024 error in a published table, so it is converted rather
# than reported raw.
_RSS_SCALE = 1 if sys.platform == "darwin" else 1024

# `resource` is Unix-only and this repo runs Windows CI, so an unconditional
# top-level import makes the module unimportable there -- collection fails
# before any measurement can run. Absent it, memory is reported as unavailable
# rather than guessed.
try:  # pragma: no cover - platform-dependent
    import resource
except ModuleNotFoundError:  # pragma: no cover - Windows
    resource = None  # type: ignore[assignment]

# Sentinel for "this platform cannot report peak memory". Distinct from 0,
# which would read as "the run used no memory".
RSS_UNAVAILABLE = -1

_CHILD_ENV_FLAG = "CGR_BENCH_INDEXING_CHILD"


@dataclass(frozen=True)
class IndexingMeasurement:
    """One indexing run, with everything needed to reproduce it.

    The provenance fields are not decoration: a timing without its corpus and
    version is a number nobody can check, and #1374 is explicit that the
    credibility of the table is the reproducibility of its cells.
    """

    corpus_name: str
    corpus_path: str
    cgr_version: str
    file_count: int
    node_count: int
    edge_count: int
    duration_seconds: float
    peak_rss_bytes: int


def _proc_peak_rss_bytes() -> int | None:
    """This process's peak RSS from `/proc/self/status`, or None if unreadable.

    `VmHWM` is per-process and genuinely reset by exec, which `ru_maxrss` is
    NOT on Linux -- there the child inherits the parent's high-water mark
    across fork/exec, so a freshly spawned child reports whatever the parent
    had already peaked at. Measured: a released 192 MiB parent ballast moved
    the child's reported peak by 201,375,744 bytes.

    Returns None rather than a sentinel so the caller can fall back; absent
    `/proc` (macOS, Windows) is not the same as "cannot measure".
    """
    try:
        with open("/proc/self/status", encoding=cs.ENCODING_UTF8) as handle:
            for line in handle:
                if line.startswith("VmHWM:"):
                    # "VmHWM:\t  123456 kB"
                    return int(line.split()[1]) * 1024
    except (OSError, ValueError, IndexError):
        return None
    return None


def _self_peak_rss_bytes() -> int:
    """This process's peak RSS, or `RSS_UNAVAILABLE` where unsupported.

    Only meaningful in the freshly-spawned child, and the source depends on
    the platform because `ru_maxrss` is not child-local everywhere:

    - Linux: `/proc/self/status` `VmHWM`, which IS exec-scoped. If it cannot
      be read, this reports unavailable rather than falling back --
      `ru_maxrss` survives fork/exec here, so the fallback would report the
      parent's history as the child's peak. Measured: a released 192 MiB
      parent allocation moved the fallback's answer by 199,208,960 bytes for
      an identical one-file workload.
    - macOS and other non-Linux Unix: `ru_maxrss`, where fork/exec does reset
      the high-water mark, so the value is already child-local.
    - Windows: no `resource` module, so unavailable.

    Reporting unavailable beats reporting a number that is wrong in the
    direction of "this run used memory it never touched".
    """
    from_proc = _proc_peak_rss_bytes()
    if from_proc is not None:
        return from_proc
    if resource is None or sys.platform.startswith("linux"):
        return RSS_UNAVAILABLE
    return resource.getrusage(resource.RUSAGE_SELF).ru_maxrss * _RSS_SCALE


def _module_name() -> str:
    """This module's importable name, for relaunching it with `-m`.

    `__spec__` is None when the file is run directly as a script
    (`python benchmarks/bench_indexing.py`), so reading `__spec__.name`
    raises AttributeError before the child is ever spawned -- the benchmark
    dies on its most obvious invocation. Falling back to the literal keeps
    both `python -m benchmarks.bench_indexing` and direct execution working.
    """
    spec = globals().get("__spec__")
    if spec is not None and getattr(spec, "name", None):
        return str(spec.name)
    return "benchmarks.bench_indexing"


def _cgr_version() -> str:
    try:
        from importlib.metadata import version

        return version("code-graph-rag")
    except Exception:
        # A source checkout without an installed distribution still benchmarks;
        # it just cannot pin a version, and saying so beats inventing one.
        return "unknown"


def measure_indexing(corpus: Path, project_name: str) -> IndexingMeasurement:
    """Index `corpus` once in a fresh subprocess and report what it cost.

    The subprocess is what makes the memory figure meaningful. `ru_maxrss` is
    a process high-water mark, so measuring in-process attributes any earlier
    allocation to the indexing run: a released 128 MiB buffer makes a one-file
    index report 128 MiB. Subtracting two readings does not rescue it either,
    because once the prior high-water exceeds the run's own peak the
    difference is zero or negative. Only a new process starts clean.

    Raises on a corpus with no indexable files rather than reporting zeroes:
    "0 files in 0.01s" reads like a very fast index rather than like a
    benchmark that measured nothing, and it is the published-number version of
    the silent-smaller-than-truth failure.
    """
    corpus = corpus.resolve()
    if os.environ.get(_CHILD_ENV_FLAG):
        # Already the child: measure directly, and let the peak be this
        # process's, which is exactly the run's.
        return _measure_in_this_process(corpus, project_name)

    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            _module_name(),
            str(corpus),
            "--project-name",
            project_name,
            "--json",
        ],
        capture_output=True,
        text=True,
        encoding=cs.ENCODING_UTF8,
        # Handled below: the child's stderr is surfaced in the raised message,
        # which says more than CalledProcessError's return code alone.
        check=False,
        env={**os.environ, _CHILD_ENV_FLAG: "1"},
        cwd=Path(__file__).resolve().parent.parent,
    )
    if completed.returncode != 0:
        raise ValueError(
            f"benchmark subprocess failed ({completed.returncode}): "
            f"{completed.stderr.strip()[-2000:]}"
        )
    return IndexingMeasurement(**json.loads(completed.stdout))


def _measure_in_this_process(corpus: Path, project_name: str) -> IndexingMeasurement:
    # Imported here rather than at module 
```

### Core Architecture Module: `benchmarks/bench_json_serialization.py`
```
import json
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import harness  # noqa: E402

WARMUP_RUNS = 3
BENCH_RUNS = 20


def generate_graph_data(num_nodes: int, num_rels: int) -> dict:
    nodes = []
    for i in range(num_nodes):
        nodes.append({
            "id": i,
            "labels": ["Function" if i % 3 == 0 else "Class" if i % 3 == 1 else "Module"],
            "properties": {
                "qualified_name": f"project.module{i // 100}.Class{i // 10}.method{i}",
                "name": f"method{i}",
                "start_line": i * 10,
                "end_line": i * 10 + 9,
                "docstring": f"Method {i} documentation string with some content" if i % 5 == 0 else None,
                "decorators": ["staticmethod"] if i % 7 == 0 else [],
                "is_exported": i % 4 == 0,
            },
        })

    rels = []
    for i in range(num_rels):
        rels.append({
            "from_id": i % num_nodes,
            "to_id": (i * 7 + 3) % num_nodes,
            "type": "CALLS" if i % 3 == 0 else "DEFINES" if i % 3 == 1 else "IMPORTS",
            "properties": {"weight": i % 10} if i % 5 == 0 else {},
        })

    return {
        "nodes": nodes,
        "relationships": rels,
        "metadata": {
            "total_nodes": num_nodes,
            "total_relationships": num_rels,
            "exported_at": "2026-03-14T10:00:00+00:00",
        },
    }


def bench_json_dumps(data: dict) -> float:
    start = time.perf_counter()
    _ = json.dumps(data)
    return time.perf_counter() - start


def bench_json_dumps_indent(data: dict) -> float:
    start = time.perf_counter()
    _ = json.dumps(data, indent=2, ensure_ascii=False)
    return time.perf_counter() - start


def bench_json_loads(json_str: str) -> float:
    start = time.perf_counter()
    _ = json.loads(json_str)
    return time.perf_counter() - start


def bench_json_dump_file(data: dict, path: str) -> float:
    start = time.perf_counter()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return time.perf_counter() - start


def bench_json_load_file(path: str) -> float:
    start = time.perf_counter()
    with open(path, encoding="utf-8") as f:
        _ = json.load(f)
    return time.perf_counter() - start


def run_benchmark(name: str, func, *args) -> dict[str, float]:
    return harness.run_benchmark(
        name, func, *args, warmup_runs=WARMUP_RUNS, bench_runs=BENCH_RUNS
    )


def print_results(results: list[dict[str, float]]) -> None:
    harness.print_results(results, 45)


def main() -> None:
    configs = [
        (1000, 2000),
        (5000, 10000),
        (20000, 50000),
    ]

    for num_nodes, num_rels in configs:
        print(f"\n{'='*115}")
        print(f"JSON Serialization Benchmark (nodes={num_nodes}, rels={num_rels})")
        print(f"{'='*115}")

        data = generate_graph_data(num_nodes, num_rels)
        json_str = json.dumps(data)
        json_str_indented = json.dumps(data, indent=2, ensure_ascii=False)
        print(f"Compact JSON: {len(json_str) / 1024:.1f} KB, Indented: {len(json_str_indented) / 1024:.1f} KB")

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as tmp:
            json.dump(data, tmp, indent=2, ensure_ascii=False)
            tmp_path = tmp.name

        results = []

        r = run_benchmark(f"json.dumps compact ({num_nodes}n)", bench_json_dumps, data)
        results.append(r)

        r = run_benchmark(f"json.dumps indented ({num_nodes}n)", bench_json_dumps_indent, data)
        results.append(r)

        r = run_benchmark(f"json.loads compact ({num_nodes}n)", bench_json_loads, json_str)
        results.append(r)

        r = run_benchmark(f"json.loads indented ({num_nodes}n)", bench_json_loads, json_str_indented)
        results.append(r)

        r = run_benchmark(f"json.dump to file ({num_nodes}n)", bench_json_dump_file, data, tmp_path)
        results.append(r)

        r = run_benchmark(f"json.load from file ({num_nodes}n)", bench_json_load_file, tmp_path)
        results.append(r)

        print_results(results)

        Path(tmp_path).unlink(missing_ok=True)


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2399** (2026-09-30): **[Bug]: `cgr diff-index` unusable from any installed build: wheel omits `codec/schema.proto`, so every manifest has `codec_schema_sha256: null`**
  *Symptoms*: ### What happened?  `cgr diff-index` refuses to compare two indexes that `cgr index` just wrote:  ``` $ cgr index --repo-path repo -o v1 $ cgr index --repo-path repo -o v2          # after editing a file $ cgr diff-index --old v1 --new v2 schema metadata missing: no codec_schema_sha256 for v1; re-export with a manifest before diffing     (exit 2) ```  ![diff-index rejects indexes written by cgr index](https://raw.githubusercontent.com/vitali87/code-graph-rag/claude/peaceful-mendel-rq15bg/issue-evidence/diff-index-no-schema.png)  ### Cause  `build_manifest` (`codebase_rag/services/provenance.py:179`) sets:  ```python "codec_schema_sha256": (_sha256(_SCHEMA_FILE) if _SCHEMA_FILE.is_file() else None), ```  where `_SCHEMA_FILE = Path(pb.__file__).parent / "schema.proto"` (line 35). `pyproject.toml` includes the `codec*` package but declares package-data only for `codebase_rag`, so `schema.proto` isn't in the wheel. Both the local `uv tool install .` build and the **published PyPI wheel** (`code_graph_rag-0.1.38-py3-none-any.whl`) contain only:  ``` ['codec/__init__.py', 'codec/schema_pb2.py', 'codec/schema_pb2.pyi'] ```  So on every non-editable install, every manifest is written with `"codec_schema_sha256": null`, and `graph_diff.py:62-75` rejects it. `diff-index` only works from a source checkout. That's presumably why tests pass.  The error message is also misleading. It tells the user to "re-export with a manifest", but the index already has one, and re-exporting produces the

- **Issue #2398** (2026-09-30): **[Bug]: after #2353 the INFO default still floods `--update-graph` with one line per symbol/file (~98% of output), and `cgr status` prints ingest logs**
  *Symptoms*: ### What happened?  #2353 / PR #2375 moved the CLI's default log level from DEBUG to INFO. The indexing output is still dominated by per-symbol and per-file lines, because those are logged **at INFO**:  - `  Found Function: … (qn: …)`: `function_ingest._register_function` - `    Found Method: … (qn: …)`: `parsers/utils.ingest_method` - `  Found Class: … (qn: …)`: `class_ingest/node_type.py:55` - `Parsing and Caching AST for python: …`: `definition_processor.process_file:460` - `Identified Package/Folder: …`: `structure_processor`  Measured on main @ cab26f1:  | repo | total lines | per-symbol / per-file lines | |---|---|---| | pallets/click | 2,287 | 2,181 (95%) | | this repo (vitali87/code-graph-rag) | 25,104 | 24,513 (98%) |  The pass headers, warnings and the final "sync done" line are still buried, which was the point of #2353:  ![INFO default still floods the terminal](https://raw.githubusercontent.com/vitali87/code-graph-rag/claude/peaceful-mendel-rq15bg/issue-evidence/info-log-flood.png)  Related: read-only commands also interleave ingest-style INFO lines with their report. `cgr status` prints `Connecting to Memgraph at localhost:7687...`, `Successfully connected to Memgraph.`, `--- Flushing all pending writes to database... ---`, `--- Flushing complete. ---`, `Disconnected from Memgraph.` between its `stack:` and `syncs:` sections. It performs no writes, so "Flushing all pending writes" is misleading. `cgr stats` does the same.  ### What did you expect to happen?  At 
  **Post-Mortem & Fix Analysis**:
  > Here's what it looks like in a terminal at the default level (pallets/click, 178 files, 12 s). The per-symbol lines scroll past faster than they can be read, and the pass headers and "sync done" line are only visible after it stops:  ![INFO flood, live](https://raw.githubusercontent.com/vitali87/code-graph-rag/claude/peaceful-mendel-rq15bg/issue-evidence/info-log-flood-live.gif)  --- _Generated by [Claude Code](https://claude.ai/code)_

- **Issue #2396** (2026-09-29): **[Bug]: incremental sync never removes a dependency deleted from Cargo.toml / requirements.txt / package.json (stale DEPENDS_ON_EXTERNAL)**
  *Symptoms*: ### What happened?  When a dependency is removed from a manifest, `cgr start --update-graph` re-parses the manifest (the log shows `Parsing dependency file: .../requirements.txt`) but only ever **adds or updates** `(:Project)-[:DEPENDS_ON_EXTERNAL]->(:ExternalPackage)` edges. It never deletes the ones that are gone. After removing `ryu` from `Cargo.toml`, `requests` from `requirements.txt` and `lodash` from `package.json`, all three are still reported as dependencies of the project indefinitely. A fresh index of the identical files has only the three remaining dependencies:  ![removed dependencies survive incremental sync](https://raw.githubusercontent.com/vitali87/code-graph-rag/claude/peaceful-mendel-rq15bg/issue-evidence/stale-dependencies.png)  | | incremental (after removal) | fresh index of same files | |---|---|---| | Cargo.toml | `ryu 1.0`, `itoa 1.0` | `itoa 1.0` | | requirements.txt | `requests ==2.31.0`, `flask >=3.0` | `flask >=3.0` | | package.json | `lodash ^4.17.21`, `express ^4.0.0` | `express ^4.0.0` |  A version change *is* picked up (`flask>=3.0` → `flask>=3.1` updates `version_spec`), because `ensure_relationship_batch` in `DefinitionProcessor.process_dependencies` is a MERGE. Nothing deletes the edges for names no longer in the file.  I first hit this with real history: `serde-rs/json` dropped `ryu` in favour of `zmij` in the last 30 commits. Syncing `HEAD~30 → HEAD` incrementally leaves `DEPENDS_ON_EXTERNAL ryu {version_spec: "1.0"}` on the project, whil

- **Issue #2394** (2026-09-29): **[Bug]: `cgr doctor` fails (exit 1) on graphs cgr itself just built: LINKS_TO, CALLS→Class and IncompleteRun flagged as integrity violations**
  *Symptoms*: ### What happened?  `cgr doctor`'s "Graph structural integrity" check (the #646 audit) rejects graphs the indexer produces through normal use, so `doctor` exits 1 on a perfectly healthy setup. On an **empty** Memgraph, indexing a two-file project (a README with one relative link, and a Python function that calls a class passed as a parameter) is enough:  ![doctor fails on a freshly built two-file graph](https://raw.githubusercontent.com/vitali87/code-graph-rag/claude/peaceful-mendel-rq15bg/issue-evidence/doctor-integrity-own-graph.png)  ``` ✗ Graph structural integrity violations Failed checks details:   Graph structural integrity violations: (Module)-[:LINKS_TO]->(File) is not documented in RELATIONSHIP_SCHEMAS;   (Function)-[:CALLS]->(Class) is not documented in RELATIONSHIP_SCHEMAS doctor exit: 1 ```  Three separate things produce the "violations", and cgr writes all of them:  1. **`(Module)-[:LINKS_TO]->(File)`**. The Markdown pass emits it for every relative link in a `.md` file (`RelationshipType.LINKS_TO`, `constants/graph.py:336`), but `RELATIONSHIP_SCHEMAS` (`types_defs.py:1118`) doesn't list it. Any repo with a README that links to a file triggers it; this repo's own `CONTRIBUTING.md` produces 49 of them. 2. **`(Function|Method)-[:CALLS]->(Class)`**. Callable-parameter dispatch emits it: `def ensure(t): return t()` called as `ensure(Config)`, click's `Context.ensure_object(object_type)`, or this repo's `decorators.validate_project_path(result_factory, ...)`. Direct 
  **Post-Mortem & Fix Analysis**:
  > ### More violations on a larger graph (≈60 projects: zod, MediatR, gson, fastapi, …): some are schema gaps, some are real bugs  ![doctor-new-drift](https://raw.githubusercontent.com/vitali87/code-graph-rag/claude/peaceful-mendel-rq15bg/issue-evidence/doctor-new-drift.png)  **Legitimate relationships missing from `RELATIONSHIP_SCHEMAS`** (TypeScript): - `(Interface)-[:INHERITS]->(Type)`: `interface ZodInvalidTypeIssue extends ZodIssueBase`, where `ZodIssueBase` is a `type` alias (zod v3 `ZodError.ts`). - `(Class)-[:IMPLEMENTS]->(Type)`: `class ParseInputLazyPath implements ParseInput`, where `ParseInput` is a `type` alias. - `Resource` nodes carry an undocumented `project` property.  **Violations that are really bugs elsewhere:** - `(Class)-[:INHERITS]->(Method)`: a C# base class resolved to a same-named property (#2534). - `(Module|Function)-[:REFERENCES]->(Interface)`: JSX `<Ns.Item>` bound to an unrelated first-party interface (#2535). - **`N Pattern node(s) have no relationships`**:

- **Issue #2362** (2026-09-29): **[Bug]: chat prints full loguru tracebacks with local variable values (diagnose=True) when a graph query fails**
  *Symptoms*: ### What happened?  When a generated Cypher query fails during interactive `cgr start` (see the list-ordering bug), the chat prints a full loguru traceback. It spans several screens, through asyncio's `run_in_executor` and `graph_service.py:859 fetch_read_only` → `:280 _execute_query`, and annotates each frame with the **values of local variables**: the full query text, `functools.partial` reprs, cursor objects, event loop state.  The chat sink is added at `main.py:442` as `logger.add(_rich_log_sink, format=cs.LOG_FORMAT, colorize=False)`. It doesn't set `backtrace`/`diagnose`, and loguru defaults `diagnose=True`.  ### Why it matters  - **Security:** `diagnose=True` prints variable values from every frame. Loguru's docs warn against it in production because it can leak sensitive data. Frames on the provider or config path can hold API keys, tokens or file contents. - **UX:** a recoverable tool error, from which the agent retries and answers, fills the chat with an internal stack dump.  ### What did you expect to happen?  `diagnose=False` (and probably `backtrace=False`) on user-facing sinks: the chat sink, the CLI default sink, and the MCP server sink. Recoverable tool errors should show as a one-line error, with full tracebacks only when debugging is turned on explicitly.  ### Minimal reproduction  1. Start an interactive `cgr start` session. 2. Trigger any Cypher DatabaseError, e.g. a question that makes the generator `ORDER BY labels(n)`. 3. Watch the traceback with variab

- **Issue #2361** (2026-09-30): **[Bug]: Cypher generator orders by `labels(n)`, failing with "Comparison is not defined for values of type list"**
  *Symptoms*: ### What happened?  Asked "Using the graph, what is this repo about? Keep it short." (orchestrator and Cypher model: `claude-opus-5-5`), the Cypher generator produced:  ```cypher MATCH (p:Project {name: 'code-graph-rag__177ec2a6'})-[r:CONTAINS_PACKAGE|CONTAINS_MODULE]->(n) WHERE n.qualified_name STARTS WITH 'code-graph-rag__177ec2a6.' RETURN n.name AS name, n.path AS path, n.qualified_name AS qualified_name, labels(n) AS type, type(r) AS relationship ORDER BY type, name LIMIT 50; ```  Memgraph rejected it: `mgclient.DatabaseError: Comparison is not defined for values of type list.` The query sorts on `type`, which is the alias for `labels(n)`, a list. The agent recovered with a simpler query and even told the user: "My first graph query failed with a database error."  ### What did you expect to happen?  Generated queries never sort on a list. Possible fixes: - The Cypher prompt says to order by `labels(n)[0]` (or `type(r)`), never `labels(n)`. - The validator rejects or rewrites `ORDER BY` on a `labels(...)` alias. - On this specific DatabaseError, retry once with the error fed back to the generator.  ### Minimal reproduction  Run that query against any indexed project in Memgraph 3.3.  ### Code Graph RAG version or commit  main @ 7f71f5a, pydantic-ai-slim 2.51.0, Memgraph 3.3.0

- **Issue #2358** (2026-09-29): **[Bug]: pydantic-ai's ASCII startup banner appears in `cgr start` with newer pydantic-ai; set PYDANTIC_AI_NO_BANNER**
  *Symptoms*: ### What happened?  With `pydantic-ai-slim` 2.51.0, which PyPI installs of `cgr` resolve today because `pyproject.toml` requires `>=2.0.0`, `cgr start` prints pydantic-ai's startup banner. It is a multi-line ASCII logo, a line listing the model, output types and tool count, and an advert for Logfire observability. It lands inside cgr's own UI, both in interactive chat and in `cgr start -a`.  The banner does not appear with the locked 2.31.1. The banner text itself says it can be suppressed with `PYDANTIC_AI_NO_BANNER=1`.  ### What did you expect to happen?  `cgr` sets `PYDANTIC_AI_NO_BANNER=1` (e.g. `os.environ.setdefault`) before building agents, so the dependency's banner never shows in cgr's UI.  ### Minimal reproduction  1. `uv pip install "pydantic-ai-slim[anthropic,google,openai]==2.51.0"` 2. `cgr start --repo-path . -a "hi"` with any provider configured.  ### Code Graph RAG version or commit  main @ 7f71f5a, pydantic-ai-slim 2.51.0

- **Issue #2357** (2026-09-29): **[Bug]: `claude-opus-5-5` rejected as "Unknown anthropic model": model validation is tied to the locked pydantic-ai catalogue**
  *Symptoms*: ### What happened?  With `ORCHESTRATOR_PROVIDER=anthropic ORCHESTRATOR_MODEL=claude-opus-5-5`, `cgr start` refuses to start:  ``` ValueError: Orchestrator configuration error: Unknown anthropic model 'claude-opus-5-5'. Did you mean 'claude-opus-4-5', 'claude-opus-5', 'claude-opus-4-8'? ```  `validate_model_id` (`providers/base.py:483`) checks the ID against `pydantic_ai.models.known_model_names()`. `uv.lock` pins `pydantic-ai-slim` **2.31.1**, whose catalogue predates Opus 5.5. The latest release, **2.51.0**, lists `anthropic:claude-opus-5-5`, and with it installed the same config works.  `pyproject.toml` only requires `>=2.0.0`, so installs from PyPI (`uv tool install`, `pipx`) resolve a new pydantic-ai and are fine. The lockfile, and anything built from it (dev environments, Docker, binaries), rejects current models until someone bumps the lock.  ### What did you expect to happen?  - Bump `pydantic-ai-slim` in `uv.lock` to a version that knows current models. - Longer term: since a new model ID fails until the lock catches up, consider warning instead of raising for IDs that look like valid IDs from the provider's family (e.g. `claude-*`), or add an explicit override.  ### Minimal reproduction  1. `uv sync` 2. `ANTHROPIC_API_KEY=... ORCHESTRATOR_PROVIDER=anthropic ORCHESTRATOR_MODEL=claude-opus-5-5 CYPHER_PROVIDER=anthropic CYPHER_MODEL=claude-opus-5-5 cgr start --repo-path . -a "hi"`  ### Code Graph RAG version or commit  main @ 7f71f5a  Related: after bumping to 2.51.0, p

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

### Incident Patch 1: `9064a804` (2026-09-29)
**Commit Message**: Merge pull request #2122 from vitali87/fix/zizmor-docs-perms-and-bump-injection

ci: fix zizmor findings incl. action pinned to a known RCE (GHSA-8q5r-mmjf-575q)

**File**: `.github/workflows/build-binaries.yml` (modified, +3/-3)
```diff
@@ -135,7 +135,7 @@ jobs:
 
       - name: Upload to release
         if: startsWith(github.ref, 'refs/tags/v')
-        uses: softprops/action-gh-release@a06a81a03ee405af7f2048a818ed3f03bbf83c7b # v2
+        uses: softprops/action-gh-release@a06a81a03ee405af7f2048a818ed3f03bbf83c7b # v2.5.0
         with:
           files: dist/code-graph-rag-*
           fail_on_unmatched_files: true
@@ -168,7 +168,7 @@ jobs:
           done
 
       - name: Upload signatures to release
-        uses: softprops/action-gh-release@a06a81a03ee405af7f2048a818ed3f03bbf83c7b # v2
+        uses: softprops/action-gh-release@a06a81a03ee405af7f2048a818ed3f03bbf83c7b # v2.5.0
         with:
           files: artifacts/*.sigstore.json
           fail_on_unmatched_files: false
@@ -186,7 +186,7 @@ jobs:
         run: cp "${{ steps.attest.outputs.bundle-path }}" artifacts/multiple.intoto.jsonl
 
       - name: Upload provenance to release
-        uses: softprops/action-gh-release@a06a81a03ee405af7f2048a818ed3f03bbf83c7b # v2
+        uses: softprops/action-gh-release@a06a81a03ee405af7f2048a818ed3f03bbf83c7b # v2.5.0
         with:
           files: artifacts/multiple.intoto.jsonl
           fail_on_unmatched_files: false
```

**File**: `.github/workflows/claude-code-review.yml` (modified, +5/-5)
```diff
@@ -40,15 +40,15 @@ jobs:
 
       - name: Run Claude Code Review
         id: claude-review
-        uses: anthropics/claude-code-action@28f83620103c48a57093dcc2837eec89e036bb9f # beta
+        uses: anthropics/claude-code-action@cfc3eb22bfed5c26ef66e3223c982af27e4524de # v1.0.231
         with:
           claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
 
           # Optional: Specify model (defaults to Claude Sonnet 4, uncomment for Claude Opus 4.8)
           # model: "claude-opus-4-8"
 
-          # Direct prompt for automated review (no @claude mention needed)
-          direct_prompt: |
+          # Prompt for automated review (no @claude mention needed)
+          prompt: |
             Please review this Python pull request against our CONTRIBUTING.md standards:
 
             **Code Quality:**
@@ -79,15 +79,15 @@ jobs:
           # use_sticky_comment: true
 
           # Optional: Customize review based on file types
-          # direct_prompt: |
+          # prompt: |
           #   Review this PR focusing on:
           #   - For TypeScript files: Type safety and proper interface usage
           #   - For API endpoints: Security, input validation, and error handling
           #   - For React components: Performance, accessibility, and best practices
           #   - For tests: Coverage, edge cases, and test quality
 
           # Optional: Different prompts for different authors
-          # direct_prompt: |
+          # prompt: |
           #   ${{ github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR' &&
           #   'Welcome! Please review this PR from a first-time contributor. Be encouraging and provide detailed explanations for any suggestions.' ||
           #   'Please provide a thorough code review focusing on our coding standards and best practices.' }}
```

**File**: `.github/workflows/docs.yml` (modified, +5/-2)
```diff
@@ -15,8 +15,6 @@ on:
 
 permissions:
   contents: read
-  pages: write
-  id-token: write
 
 concurrency:
   group: pages
@@ -55,6 +53,11 @@ jobs:
   deploy:
     needs: build
     runs-on: ubuntu-latest
+    # Only this job talks to Pages; the build job gets the workflow-level
+    # contents: read and no OIDC token.
+    permissions:
+      pages: write
+      id-token: write
     environment:
       name: github-pages
       url: ${{ steps.deployment.outputs.page_url }}
```

**File**: `.github/workflows/publish.yml` (modified, +1/-1)
```diff
@@ -54,6 +54,6 @@ jobs:
         run: uv build
 
       - name: Publish to PyPI
-        uses: pypa/gh-action-pypi-publish@dc37677b2e1c63e2034f94d8a5b11f265b73ba33 # release/v1
+        uses: pypa/gh-action-pypi-publish@dc37677b2e1c63e2034f94d8a5b11f265b73ba33 # v1.14.2
         with:
           skip-existing: true
```

**File**: `.github/workflows/scorecard.yml` (modified, +1/-1)
```diff
@@ -73,6 +73,6 @@ jobs:
       # Upload the results to GitHub's code scanning dashboard (optional).
       # Commenting out will disable upload of results to your repo's Code Scanning dashboard
       - name: "Upload to code-scanning"
-        uses: github/codeql-action/upload-sarif@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v3
+        uses: github/codeql-action/upload-sarif@2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2 # v4.38.2
         with:
           sarif_file: results.sarif
```

---

### Incident Patch 2: `f422a183` (2026-09-29)
**Commit Message**: fix(packaging): ship codec/schema.proto so installed builds can diff-index (#2399)

**File**: `codebase_rag/constants/graph.py` (modified, +10/-0)
```diff
@@ -174,6 +174,16 @@ class EdgeResolution(StrEnum):
 PROTOBUF_NODES_FILE = "nodes.bin"
 PROTOBUF_RELS_FILE = "relationships.bin"
 
+DIFF_ERR_NO_MANIFEST = (
+    "schema metadata missing: no readable manifest in {path}; "
+    "re-export with a manifest before diffing"
+)
+DIFF_ERR_NO_SCHEMA_HASH = (
+    "schema metadata missing: {manifest} records no codec_schema_sha256 because "
+    "the cgr that wrote it could not find codec/schema.proto; "
+    "upgrade code-graph-rag and re-index before diffing"
+)
+
 ONEOF_PROJECT = "project"
 ONEOF_PACKAGE = "package"
 ONEOF_FOLDER = "folder"
```

**File**: `codebase_rag/logs.py` (modified, +7/-0)
```diff
@@ -238,6 +238,13 @@
 PROTOBUF_FLUSH_SUCCESS = "Successfully flushed {nodes} unique nodes and {rels} unique relationships to {path}"
 PROTOBUF_FLUSHING = "Flushing data to {path}..."
 
+# Provenance manifest logs
+CODEC_SCHEMA_MISSING = (
+    "Codec schema {path} is missing from this install, so the manifest records "
+    "no codec_schema_sha256 and cgr diff-index will refuse this index; "
+    "upgrade code-graph-rag"
+)
+
 # Parser loader logs
 BUILDING_BINDINGS = "Building Python bindings for {lang}..."
 BUILD_FAILED = "Failed to build {lang} bindings: stdout={stdout}, stderr={stderr}"
```

**File**: `codebase_rag/services/graph_diff.py` (modified, +12/-15)
```diff
@@ -51,30 +51,27 @@ def _load_indexes(index_dir: Path, names: tuple[str, ...]) -> list[pb.GraphCodeI
     return found
 
 
-def _schema_hash(index_dir: Path) -> str | None:
+def _schema_hash(index_dir: Path) -> str:
+    # An absent/malformed manifest or missing hash means compatibility cannot
+    # be verified at all; proceeding would produce a delta with unknowable
+    # field semantics.
     manifest_path = index_dir / MANIFEST_FILE
-    if not manifest_path.is_file():
-        return None
     try:
         manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
-    except (OSError, json.JSONDecodeError):
-        return None
+    except (OSError, ValueError) as error:
+        raise DiffError(cs.DIFF_ERR_NO_MANIFEST.format(path=index_dir)) from error
     value = manifest.get("codec_schema_sha256") if isinstance(manifest, dict) else None
-    return value if isinstance(value, str) else None
+    if not isinstance(value, str):
+        # The manifest is there, so "write one" is the wrong advice: the cgr
+        # that wrote it had no codec/schema.proto to hash, and re-exporting
+        # from that same install writes the same null again (#2399).
+        raise DiffError(cs.DIFF_ERR_NO_SCHEMA_HASH.format(manifest=manifest_path))
+    return value
 
 
 def _require_same_schema(old_dir: Path, new_dir: Path) -> None:
     old_hash = _schema_hash(old_dir)
     new_hash = _schema_hash(new_dir)
-    if old_hash is None or new_hash is None:
-        # An absent/malformed manifest or missing hash means compatibility
-        # cannot be verified at all; proceeding would produce a delta with
-        # unknowable field semantics.
-        missing = old_dir if old_hash is None else new_dir
-        raise DiffError(
-            f"schema metadata missing: no codec_schema_sha256 for {missing}; "
-            "re-export with a manifest before diffing"
-        )
     if old_hash != new_hash:
         raise DiffError(
             "schema mismatch: the artifacts were produced by different codec "
```

**File**: `codebase_rag/services/provenance.py` (modified, +14/-3)
```diff
@@ -21,9 +21,12 @@
 from importlib import metadata
 from pathlib import Path
 
+from loguru import logger
+
 import codec.schema_pb2 as pb
 
 from .. import constants as cs
+from .. import logs as ls
 from ..language_spec import get_language_spec
 
 type JsonDict = dict[str, object]
@@ -58,6 +61,16 @@ def _sha256(path: Path) -> str:
     return digest.hexdigest()
 
 
+def _codec_schema_sha256() -> str | None:
+    if _SCHEMA_FILE.is_file():
+        return _sha256(_SCHEMA_FILE)
+    # The index itself is still sound, so indexing goes on; but diff-index
+    # refuses a manifest without this hash, and saying so only then leaves the
+    # user no clue that the install, not the index, is at fault (#2399).
+    logger.warning(ls.CODEC_SCHEMA_MISSING.format(path=_SCHEMA_FILE))
+    return None
+
+
 def _git_line(repo_path: Path, *args: str) -> str | None:
     try:
         proc = subprocess.run(
@@ -176,9 +189,7 @@ def build_manifest(
     return {
         "manifest_version": _MANIFEST_VERSION,
         "analyzer_version": _analyzer_version(),
-        "codec_schema_sha256": (
-            _sha256(_SCHEMA_FILE) if _SCHEMA_FILE.is_file() else None
-        ),
+        "codec_schema_sha256": _codec_schema_sha256(),
         "capture": capture,
         "source": source,
         "artifacts": artifacts,
```

**File**: `codebase_rag/tests/test_graph_diff.py` (modified, +51/-0)
```diff
@@ -136,6 +136,57 @@ def test_missing_schema_hash_refuses_to_diff(tmp_path: Path) -> None:
         diff_indexes(out_a, out_b)
 
 
+def _diff_error(old: Path, new: Path) -> str:
+    with pytest.raises(DiffError) as caught:
+        diff_indexes(old, new)
+    return str(caught.value)
+
+
+def test_a_null_schema_hash_blames_the_install_not_the_manifest(
+    tmp_path: Path,
+) -> None:
+    # Issue #2399: a cgr installed without codec/schema.proto writes a manifest
+    # whose hash is null. Telling the user to "re-export with a manifest" sent
+    # them round a loop, since the index had one and re-exporting from the
+    # same install wrote the same null.
+    repo = tmp_path / "proj"
+    _write(repo, _BASE)
+    out_a = tmp_path / "out_a"
+    out_b = tmp_path / "out_b"
+    _export(repo, out_a)
+    _export(repo, out_b)
+    manifest_path = out_a / MANIFEST_FILE
+    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
+    manifest["codec_schema_sha256"] = None
+    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
+
+    message = _diff_error(out_a, out_b)
+
+    assert message.startswith("schema metadata missing")
+    assert str(manifest_path) in message
+    assert "re-export with a manifest" not in message
+    assert "upgrade code-graph-rag and re-index" in message
+
+
+def test_a_missing_manifest_keeps_its_re_export_advice(tmp_path: Path) -> None:
+    # The upgrade advice is for a manifest that exists but carries no hash; an
+    # index with no manifest at all still just needs one written.
+    repo = tmp_path / "proj"
+    _write(repo, _BASE)
+    out_a = tmp_path / "out_a"
+    out_b = tmp_path / "out_b"
+    _export(repo, out_a)
+    _export(repo, out_b)
+    (out_b / MANIFEST_FILE).unlink()
+
+    message = _diff_error(out_a, out_b)
+
+    assert message.startswith("schema metadata missing")
+    assert str(out_b) in message
+    assert "re-export with a manifest" in message
+    assert "upgrade" not in message
+
+
 def test_bool_flip_reports_declared_defaults_not_null(tmp_path: Path) -> None:
     from codebase_rag.capture import resolve_capture
 
```

---

### Incident Patch 3: `650ca35e` (2026-09-29)
**Commit Message**: fix(logging): log per-symbol indexing and connection lifecycle at DEBUG (#2398)

**File**: `codebase_rag/graph_updater.py` (modified, +6/-1)
```diff
@@ -2078,7 +2078,12 @@ def run(self, force: bool = False) -> None:
         # nodes, so a read after it could not tell a new package from an old
         # one (issue #1570).
         self._packages_before_run = None if force else self._package_paths()
-        self.factory.structure_processor.identify_structure()
+        structure = self.factory.structure_processor.identify_structure()
+        logger.info(
+            ls.STRUCTURE_IDENTIFIED.format(
+                packages=structure.packages, folders=structure.folders
+            )
+        )
 
         # Cleared here, not only in _run_cpp_frontend: in HYBRID that method
         # runs AFTER Pass 2, so its reset is too late for a REUSED updater
```

**File**: `codebase_rag/logs.py` (modified, +2/-0)
```diff
@@ -8,6 +8,7 @@
 
 # Pass logs
 PASS_1_STRUCTURE = "--- Pass 1: Identifying Packages and Folders ---"
+STRUCTURE_IDENTIFIED = "Identified {packages} packages and {folders} folders"
 PASS_2_FILES = (
     "\n--- Pass 2: Processing Files, Caching ASTs, and Collecting Definitions ---"
 )
@@ -373,6 +374,7 @@
 # Memgraph logs
 MG_CONNECTING = "Connecting to Memgraph at {host}:{port}..."
 MG_CONNECTED = "Successfully connected to Memgraph."
+MG_CONNECT_FAILED = "Could not connect to Memgraph at {host}:{port}: {error}"
 MG_EXCEPTION = "An exception occurred: {error}. Attempting best-effort flush..."
 MG_FLUSH_ERROR = "Failed to flush during cleanup: {error}"
 MG_DISCONNECTED = "\nDisconnected from Memgraph."
```

**File**: `codebase_rag/parsers/class_ingest/cpp_modules.py` (modified, +2/-2)
```diff
@@ -108,7 +108,7 @@ def _process_export_module(
         (cs.NodeLabel.MODULE_INTERFACE, cs.KEY_QUALIFIED_NAME, interface_qn),
     )
 
-    logger.info(logs.CLASS_CPP_MODULE_INTERFACE.format(qn=interface_qn))
+    logger.debug(logs.CLASS_CPP_MODULE_INTERFACE.format(qn=interface_qn))
 
 
 def _process_module_implementation(
@@ -151,7 +151,7 @@ def _process_module_implementation(
     interface_qn = f"{project_name}.{module_name}"
     deferred_impls.append((impl_qn, interface_qn))
 
-    logger.info(logs.CLASS_CPP_MODULE_IMPL.format(qn=impl_qn))
+    logger.debug(logs.CLASS_CPP_MODULE_IMPL.format(qn=impl_qn))
 
 
 def find_cpp_exported_classes(root_node: Node) -> list[Node]:
```

**File**: `codebase_rag/parsers/class_ingest/mixin.py` (modified, +1/-1)
```diff
@@ -2117,7 +2117,7 @@ def _ingest_bodied_inline_module(
                 file_path, self.repo_path
             ).as_posix()
             module_props[cs.KEY_ABSOLUTE_PATH] = cached_resolve_posix(file_path)
-        logger.info(
+        logger.debug(
             logs.CLASS_FOUND_INLINE_MODULE.format(name=module_name, qn=inline_module_qn)
         )
         # Same-qn bodied twins (mutually-exclusive cfg mods, or two impls
```

**File**: `codebase_rag/parsers/class_ingest/node_type.py` (modified, +18/-14)
```diff
@@ -21,28 +21,30 @@ def determine_node_type(
         ):
             return _go_type_node_type(class_node, class_name, class_qn)
         case cs.TS_INTERFACE_DECLARATION | cs.TS_RS_TRAIT_ITEM:
-            logger.info(logs.CLASS_FOUND_INTERFACE.format(name=class_name, qn=class_qn))
+            logger.debug(
+                logs.CLASS_FOUND_INTERFACE.format(name=class_name, qn=class_qn)
+            )
             return NodeType.INTERFACE
         case (
             cs.TS_ENUM_DECLARATION
             | cs.TS_ENUM_SPECIFIER
             | cs.TS_ENUM_CLASS_SPECIFIER
             | cs.TS_RS_ENUM_ITEM
         ):
-            logger.info(logs.CLASS_FOUND_ENUM.format(name=class_name, qn=class_qn))
+            logger.debug(logs.CLASS_FOUND_ENUM.format(name=class_name, qn=class_qn))
             return NodeType.ENUM
         case cs.TS_TYPE_ALIAS_DECLARATION | cs.TS_RS_TYPE_ITEM:
-            logger.info(logs.CLASS_FOUND_TYPE.format(name=class_name, qn=class_qn))
+            logger.debug(logs.CLASS_FOUND_TYPE.format(name=class_name, qn=class_qn))
             return NodeType.TYPE
         case cs.TS_STRUCT_SPECIFIER | cs.TS_RS_STRUCT_ITEM:
-            logger.info(logs.CLASS_FOUND_STRUCT.format(name=class_name, qn=class_qn))
+            logger.debug(logs.CLASS_FOUND_STRUCT.format(name=class_name, qn=class_qn))
             return NodeType.CLASS
         case cs.TS_UNION_SPECIFIER | cs.TS_RS_UNION_ITEM:
-            logger.info(logs.CLASS_FOUND_UNION.format(name=class_name, qn=class_qn))
+            logger.debug(logs.CLASS_FOUND_UNION.format(name=class_name, qn=class_qn))
             return NodeType.UNION
         case cs.CppNodeType.TEMPLATE_DECLARATION:
             node_type = extract_template_class_type(class_node) or NodeType.CLASS
-            logger.info(
+            logger.debug(
                 logs.CLASS_FOUND_TEMPLATE.format(
                     node_type=node_type, name=class_name, qn=class_qn
                 )
@@ -52,7 +54,7 @@ def determine_node_type(
             log_exported_class_type(class_node, class_name, class_qn)
             return NodeType.CLASS
         case _:
-            logger.info(logs.CLASS_FOUND_CLASS.format(name=class_name, qn=class_qn))
+            logger.debug(logs.CLASS_FOUND_CLASS.format(name=class_name, qn=class_qn))
             return NodeType.CLASS
 
 
@@ -62,13 +64,15 @@ def _go_type_node_type(
     underlying = class_node.child_by_field_name(cs.FIELD_TYPE)
     match underlying.type if underlying else None:
         case cs.TS_GO_STRUCT_TYPE:
-            logger.info(logs.CLASS_FOUND_STRUCT.format(name=class_name, qn=class_qn))
+            logger.debug(logs.CLASS_FOUND_STRUCT.format(name=class_name, qn=class_qn))
             return NodeType.CLASS
         case cs.TS_GO_INTERFACE_TYPE:
-            logger.info(logs.CLASS_FOUND_INTERFACE.format(name=class_name, qn=class_qn))
+            logger.debug(
+                logs.CLASS_FOUND_INTERFACE.format(name=class_name, qn=class_qn)
+            )
             return NodeType.INTERFACE
         case _:
-            logger.info(logs.CLASS_FOUND_TYPE.format(name=class_name, qn=class_qn))
+            logger.debug(logs.CLASS_FOUND_TYPE.format(name=class_name, qn=class_qn))
             return NodeType.TYPE
 
 
@@ -78,19 +82,19 @@ def log_exported_class_type(
     node_text = safe_decode_with_fallback(class_node) if class_node.text else ""
     match _detect_export_type(node_text):
         case cs.CPP_EXPORT_STRUCT_PREFIX:
-            logger.info(
+            logger.debug(
                 logs.CLASS_FOUND_EXPORTED_STRUCT.format(name=class_name, qn=class_qn)
             )
         case cs.CPP_EXPORT_UNION_PREFIX:
-            logger.info(
+            logger.debug(
                 logs.CLASS_FOUND_EXPORTED_UNION.format(name=class_name, qn=class_qn)
             )
         case cs.CPP_EXPORT_TEMPLATE_PREFIX:
-            logger.info(
+            logger.debug(
                 logs.CLASS_FOUND_EXPORTED_TEMPLATE.format(name=class
```

---

### Incident Patch 4: `f8e2a42f` (2026-09-29)
**Commit Message**: fix: resolve the SonarCloud findings on the Ctrl+C changes

**File**: `codebase_rag/exceptions.py` (modified, +4/-1)
```diff
@@ -156,7 +156,10 @@ class ReadOnlyQueryError(Exception):
     """An untrusted query would write, so it was never executed."""
 
 
-class EmbeddingsInterrupted(KeyboardInterrupt):
+# Deriving from Exception would let every `except Exception` handler between
+# the embeddings pass and the top level swallow a Ctrl+C (python:S5709
+# accepted).
+class EmbeddingsInterrupted(KeyboardInterrupt):  # NOSONAR
     """Ctrl+C stopped the embeddings pass of a run that has already committed.
 
     A `KeyboardInterrupt`, so a caller that does not look for it still stops
```

**File**: `codebase_rag/tests/test_embeddings_interrupt.py` (modified, +8/-11)
```diff
@@ -78,11 +78,12 @@ def test_an_interrupted_embeddings_pass_commits_the_run_before_stopping(
     embedding_io: tuple[MagicMock, MagicMock],
 ) -> None:
     _interrupt_embeddings_query(mock_ingestor)
+    updater = _updater(py_project, mock_ingestor)
 
     # Still a KeyboardInterrupt, so a caller that does not look for it (the
     # watcher's initial scan) stops exactly as it did before.
     with pytest.raises(KeyboardInterrupt) as stopped:
-        _updater(py_project, mock_ingestor).run()
+        updater.run()
 
     hashes = json.loads((py_project / cs.HASH_CACHE_FILENAME).read_text())
     assert {"module_a.py", "module_b.py"} <= set(hashes)
@@ -99,9 +100,10 @@ def test_an_interrupted_embeddings_pass_keeps_the_vectors_it_computed(
 ) -> None:
     cache, close_client = embedding_io
     _interrupt_embeddings_query(mock_ingestor)
+    updater = _updater(py_project, mock_ingestor)
 
     with pytest.raises(KeyboardInterrupt):
-        _updater(py_project, mock_ingestor).run()
+        updater.run()
 
     cache.save.assert_called_once_with()
     close_client.assert_called_once_with()
@@ -112,13 +114,14 @@ def test_an_interrupt_before_the_embeddings_pass_commits_nothing(
 ) -> None:
     # Only the last pass may be cut short: an earlier one leaves the graph
     # partial, and a committed cache would hide that from the next sync.
+    updater = _updater(py_project, mock_ingestor)
     with (
         patch.object(
             GraphUpdater, "_prune_orphan_nodes", side_effect=KeyboardInterrupt
         ),
         pytest.raises(KeyboardInterrupt) as stopped,
     ):
-        _updater(py_project, mock_ingestor).run()
+        updater.run()
 
     assert type(stopped.value) is KeyboardInterrupt
     # The walk leaves an empty placeholder; only a committed run fills it.
@@ -141,10 +144,7 @@ def fetch_all(query: str, params: PropertyParams | None = None) -> list[ResultRo
 
     mock_ingestor.fetch_all.side_effect = fetch_all
 
-    try:
-        _updater(py_project, mock_ingestor).run()
-    except KeyboardInterrupt:
-        pytest.fail("a failed embeddings pass was reported as Ctrl+C")
+    _updater(py_project, mock_ingestor).run()
 
     hashes = json.loads((py_project / cs.HASH_CACHE_FILENAME).read_text())
     assert {"module_a.py", "module_b.py"} <= set(hashes)
@@ -165,10 +165,7 @@ def test_a_reused_updater_does_not_replay_an_earlier_interrupt(
     mock_ingestor.fetch_all.side_effect = None
     (py_project / "module_a.py").write_text("def func_a():\n    return 1\n")
 
-    try:
-        updater.run()
-    except KeyboardInterrupt:
-        pytest.fail("the second run replayed the first run's interrupt")
+    updater.run()
 
     assert not updater.skipped_because_in_sync
 
```

**File**: `codebase_rag/tests/test_interruptible_thread.py` (modified, +2/-1)
```diff
@@ -75,8 +75,9 @@ def test_an_interrupt_the_task_raised_itself_is_not_swallowed() -> None:
     def task() -> None:
         raise KeyboardInterrupt
 
+    worker = _Worker(task)
     with pytest.raises(KeyboardInterrupt):
-        _Worker(task).run()
+        worker.run()
 
 
 def test_a_second_interrupt_does_not_cut_the_cleanup_short() -> None:
```

---

### Incident Patch 5: `fd205319` (2026-09-29)
**Commit Message**: fix(vector-store): keep the embedding cache out of the repository with the stack's Qdrant (#2355)

**File**: `codebase_rag/embedder.py` (modified, +3/-1)
```diff
@@ -92,7 +92,9 @@ def __len__(self) -> int:
 def get_embedding_cache() -> EmbeddingCache:
     global _embedding_cache
     if _embedding_cache is None:
-        cache_path = Path(settings.QDRANT_DB_PATH) / cs.EMBEDDING_CACHE_FILENAME
+        from .vector_store import embedding_cache_dir
+
+        cache_path = embedding_cache_dir() / cs.EMBEDDING_CACHE_FILENAME
         _embedding_cache = EmbeddingCache(path=cache_path)
         _embedding_cache.load()
     return _embedding_cache
```

**File**: `codebase_rag/tests/test_bundled_qdrant_default.py` (modified, +81/-0)
```diff
@@ -202,3 +202,84 @@ def __enter__(self) -> int:
 
     def __exit__(self, *exc: object) -> None:
         self._gen.close()
+
+
+@pytest.fixture
+def fresh_embedding_cache() -> Generator[None, None, None]:
+    from codebase_rag import embedder
+
+    embedder.clear_embedding_cache()
+    yield
+    embedder.clear_embedding_cache()
+
+
+def _cache_path() -> Path:
+    from codebase_rag import embedder
+
+    path = embedder.get_embedding_cache()._path
+    assert path is not None
+    return path
+
+
+def test_the_embedding_cache_leaves_the_repository_with_the_vectors(
+    stack_home: Path,
+    open_qdrant: int,
+    monkeypatch: pytest.MonkeyPatch,
+    tmp_path: Path,
+    fresh_embedding_cache: None,
+) -> None:
+    # The cache holds the vectors too; left at the cwd-relative default it
+    # still dropped a hidden folder into every indexed repository.
+    repo = tmp_path / "repo"
+    repo.mkdir()
+    monkeypatch.chdir(repo)
+    monkeypatch.setenv(stack_cs.COMPOSE_QDRANT_HTTP_PORT_VAR, str(open_qdrant))
+
+    path = _cache_path()
+
+    assert path.parent == stack_home
+    assert not (repo / cs.QDRANT_DEFAULT_DB_PATH).exists()
+
+
+def test_without_the_stack_the_cache_stays_beside_the_embedded_store(
+    _isolate_cgr_home: Path,
+    monkeypatch: pytest.MonkeyPatch,
+    fresh_embedding_cache: None,
+) -> None:
+    # Negative: the embedded store and its cache keep sharing a folder.
+    monkeypatch.setattr(settings, "QDRANT_DB_PATH", cs.QDRANT_DEFAULT_DB_PATH)
+
+    assert _cache_path() == Path(cs.QDRANT_DEFAULT_DB_PATH) / (
+        cs.EMBEDDING_CACHE_FILENAME
+    )
+
+
+def test_an_explicit_url_keeps_the_cache_where_it_was(
+    stack_home: Path,
+    open_qdrant: int,
+    monkeypatch: pytest.MonkeyPatch,
+    fresh_embedding_cache: None,
+) -> None:
+    # Negative: only the bundled stack's cache moves.
+    monkeypatch.setenv(stack_cs.COMPOSE_QDRANT_HTTP_PORT_VAR, str(open_qdrant))
+    monkeypatch.setattr(settings, "QDRANT_URL", "http://qdrant.internal:6333")
+
+    assert _cache_path().parent == Path(cs.QDRANT_DEFAULT_DB_PATH)
+
+
+def test_the_stack_is_probed_once_for_the_client_and_the_cache(
+    stack_home: Path,
+    open_qdrant: int,
+    monkeypatch: pytest.MonkeyPatch,
+    fresh_embedding_cache: None,
+) -> None:
+    from codebase_rag import stack
+
+    monkeypatch.setenv(stack_cs.COMPOSE_QDRANT_HTTP_PORT_VAR, str(open_qdrant))
+    probe = MagicMock(wraps=stack.bundled_qdrant_url)
+    monkeypatch.setattr(stack, "bundled_qdrant_url", probe)
+
+    _client_kwargs()
+    _cache_path()
+
+    assert probe.call_count == 1
```

**File**: `codebase_rag/vector_store.py` (modified, +32/-4)
```diff
@@ -4,6 +4,7 @@
 import time
 from collections.abc import Callable, Iterable, Sequence
 from importlib.metadata import PackageNotFoundError, version
+from pathlib import Path
 from typing import Any, Protocol, Required, TypedDict, cast
 from urllib.parse import urlsplit
 
@@ -60,6 +61,10 @@ def _search_project_scoped(
 
 _CLIENT: Any | None = None
 _CLIENT_BACKEND: VectorStoreBackend | None = None
+# The bundled stack's Qdrant URL once probed, so the client and the embedding
+# cache agree on where the vectors go and the stack is probed only once.
+_BUNDLED_QDRANT: str | None = None
+_BUNDLED_QDRANT_PROBED = False
 
 # Each name is the real class or None (dependency absent), typed Any via
 # cast so ty does not flag the guarded call sites: the availability gates
@@ -104,7 +109,8 @@ def search_embeddings(
 
 
 def close_vector_store_client() -> None:
-    global _CLIENT, _CLIENT_BACKEND
+    global _CLIENT, _CLIENT_BACKEND, _BUNDLED_QDRANT, _BUNDLED_QDRANT_PROBED
+    _BUNDLED_QDRANT, _BUNDLED_QDRANT_PROBED = None, False
     if _CLIENT is not None:
         close = getattr(_CLIENT, "close", None)
         if callable(close):
@@ -198,11 +204,33 @@ def _bundled_qdrant_url() -> str | None:
     stayed empty (issue #2355). A QDRANT_DB_PATH the user set is their choice
     and is kept, and then the stack is not even probed.
     """
-    if settings.QDRANT_DB_PATH != QDRANT_DEFAULT_DB_PATH:
+    global _BUNDLED_QDRANT, _BUNDLED_QDRANT_PROBED
+    if (
+        settings.QDRANT_URL
+        or settings.VECTOR_STORE_BACKEND != VectorStoreBackend.QDRANT
+        or settings.QDRANT_DB_PATH != QDRANT_DEFAULT_DB_PATH
+    ):
         return None
-    from .stack import bundled_qdrant_url
+    if not _BUNDLED_QDRANT_PROBED:
+        from . import stack
+
+        _BUNDLED_QDRANT = stack.bundled_qdrant_url()
+        _BUNDLED_QDRANT_PROBED = True
+    return _BUNDLED_QDRANT
 
-    return bundled_qdrant_url()
+
+def embedding_cache_dir() -> Path:
+    """The folder the embedding cache is kept in.
+
+    It sits beside the embedded store, as before. When the bundled stack's
+    Qdrant takes the vectors it moves to the stack's folder with them: the
+    cache holds vectors too, and at the cwd-relative default it still put a
+    hidden folder into every indexed repository (issue #2355). Its keys carry
+    the embedding model, so one cache serves every project.
+    """
+    if _bundled_qdrant_url() is not None:
+        return settings.CGR_HOME.expanduser()
+    return Path(settings.QDRANT_DB_PATH)
 
 
 def _qdrant_api_key(url: str) -> str | None:
```

**File**: `docs/sdk/semantic-search.md` (modified, +6/-1)
```diff
@@ -26,7 +26,12 @@ order:
 4. Otherwise: an embedded Qdrant in `./.qdrant_code_embeddings`, relative to
    the directory cgr runs in.
 
-The embedding cache stays in `QDRANT_DB_PATH` in every case. For a server that requires an API key
+The embedding cache (`.embedding_cache.json`) sits in the embedded store's
+folder, and moves to the stack's folder (`CGR_HOME`, default `~/.cgr`) along
+with the vectors in case 3, so nothing is written into the indexed repository.
+Its keys carry the embedding model, so one cache serves every project.
+
+For a server that requires an API key
 (Qdrant Cloud, or a self-hosted server started with `QDRANT__SERVICE__API_KEY`),
 also set `QDRANT_API_KEY`, over an `https://` URL:
 
```

---

### Incident Patch 6: `a903f5c5` (2026-09-29)
**Commit Message**: fix(vector-store): store embeddings in the stack's Qdrant when QDRANT_URL is unset (#2355)

**File**: `.env.example` (modified, +5/-2)
```diff
@@ -101,8 +101,11 @@ NEO4J_PASSWORD=
 NEO4J_DATABASE=neo4j
 
 # Qdrant settings
-# Leave QDRANT_URL unset to use local file mode (only suitable below ~20k embeddings)
-# For larger codebases, run the bundled docker-compose service and point at it:
+# With QDRANT_URL and QDRANT_DB_PATH both unset, embeddings go to the Qdrant
+# `cgr daemon up` runs when that stack is up, and to local file mode in
+# ./.qdrant_code_embeddings otherwise (only suitable below ~20k embeddings).
+# Set QDRANT_DB_PATH to always use local file mode in that folder, or point
+# QDRANT_URL at any Qdrant server:
 # QDRANT_URL=http://localhost:6333
 # API key for a Qdrant server that requires one: always Qdrant Cloud, and a
 # self-hosted server started with QDRANT__SERVICE__API_KEY. Ignored in local
```

**File**: `codebase_rag/config.py` (modified, +1/-1)
```diff
@@ -349,7 +349,7 @@ def ollama_endpoint(self) -> str:
         }
     )
 
-    QDRANT_DB_PATH: str = "./.qdrant_code_embeddings"
+    QDRANT_DB_PATH: str = cs.QDRANT_DEFAULT_DB_PATH
     QDRANT_URL: str | None = None
     # Sent as the `api-key` header, so only a server (QDRANT_URL) uses it:
     # Qdrant Cloud always requires one, and a self-hosted server does once
```

**File**: `codebase_rag/constants/providers.py` (modified, +4/-0)
```diff
@@ -176,6 +176,10 @@ class VectorStoreBackend(StrEnum):
 # qdrant-client sends the `api-key` header in the clear only when the URL
 # names this scheme; a URL without a scheme switches to https once a key is set.
 QDRANT_INSECURE_URL_SCHEME = "http"
+# The embedded store's folder when QDRANT_DB_PATH is left alone; left alone
+# too, and with the bundled stack running, the stack's Qdrant is used instead
+# (issue #2355).
+QDRANT_DEFAULT_DB_PATH = "./.qdrant_code_embeddings"
 
 SEMANTIC_DEPENDENCIES = (
     MODULE_PYMILVUS,
```

**File**: `codebase_rag/logs.py` (modified, +9/-0)
```diff
@@ -204,6 +204,15 @@
 QDRANT_DELETE_PROJECT_FAILED = (
     "Failed to delete Qdrant vectors for project '{project}': {error}"
 )
+QDRANT_USING_BUNDLED = (
+    "Storing embeddings in the Qdrant the cgr stack runs at {url} (QDRANT_URL is "
+    "unset); set QDRANT_DB_PATH to keep them in an embedded store instead"
+)
+QDRANT_BUNDLED_WANTS_KEY = (
+    "The cgr stack's Qdrant at {url} refuses requests without a key, so embeddings "
+    "stay in the embedded store at '{path}'. Set QDRANT_URL and QDRANT_API_KEY to "
+    "use the stack's Qdrant"
+)
 QDRANT_LOCK_ERROR = (
     "Failed to open embedded Qdrant at '{path}': {error}. The storage folder is "
     "locked by another process; look for the '.lock' sentinel inside it. Embedded "
```

**File**: `codebase_rag/stack/__init__.py` (modified, +2/-0)
```diff
@@ -1,6 +1,7 @@
 from .manager import (
     StackManager,
     StackStatus,
+    bundled_qdrant_url,
     daemon_down,
     daemon_logs,
     daemon_restart,
@@ -12,6 +13,7 @@
 __all__ = [
     "StackManager",
     "StackStatus",
+    "bundled_qdrant_url",
     "daemon_down",
     "daemon_logs",
     "daemon_restart",
```

---

### Incident Patch 7: `8b6fb8e0` (2026-09-29)
**Commit Message**: fix(doctor): accept the edges and markers cgr itself writes (#2394)

**File**: `codebase_rag/constants/graph.py` (modified, +6/-0)
```diff
@@ -543,6 +543,12 @@ class AuditCheck(StrEnum):
     DANGLING_RELATIONSHIP = "dangling_relationship"
 
 
+# Labels cgr writes for its own bookkeeping rather than as part of the code
+# graph: not in NODE_SCHEMAS (the Cypher prompt is built from it), and not
+# graded by the structural audit. `IncompleteRun` is the sync marker, which
+# doctor reports as an interrupted sync instead (issue #2394).
+AUDIT_BOOKKEEPING_LABELS = frozenset({"IncompleteRun"})
+
 # Graph audit violation details (issue #646)
 AUDIT_DETAIL_ORPHAN = "{label} '{key}' has no relationships"
 AUDIT_DETAIL_UNDOCUMENTED_LABEL = "label '{label}' is not documented in NODE_SCHEMAS"
```

**File**: `codebase_rag/constants/health.py` (modified, +10/-0)
```diff
@@ -33,6 +33,16 @@
 HEALTH_CHECK_GRAPH_INTEGRITY_VIOLATIONS_MSG = "{count} violation(s) found"
 HEALTH_CHECK_GRAPH_INTEGRITY_ERROR_MSG = "Audit queries failed"
 HEALTH_CHECK_GRAPH_INTEGRITY_SEPARATOR = "; "
+# An outstanding `:IncompleteRun` marker, reported the way `cgr status`
+# reports it rather than as a schema violation (issue #2394).
+HEALTH_CHECK_INTERRUPTED_SYNC = "Interrupted syncs"
+HEALTH_CHECK_INTERRUPTED_SYNC_MSG = (
+    "{count} project(s) have a sync that was interrupted or is still running"
+)
+HEALTH_CHECK_INTERRUPTED_SYNC_DETAIL = (
+    "project {project}: last sync was interrupted or is still running; re-run "
+    "`cgr start --update-graph` if no sync is active"
+)
 
 # Model credentials are judged by the rule the runtime applies at
 # start-up (`ModelConfig.validate_api_key`), so doctor cannot fail a
```

**File**: `codebase_rag/cypher_queries.py` (modified, +4/-1)
```diff
@@ -40,8 +40,11 @@
 # count instead of `WHERE NOT (n)--()`: Memgraph 3.x rejects pattern
 # expressions inside WHERE, and this form is accepted by both 2.x and 3.x
 # (issue #1257).
+# `:IncompleteRun` is the CLI's own sync marker, unattached to any project
+# tree on purpose (see CYPHER_MARK_PROJECT_INCOMPLETE); doctor reports it as
+# an interrupted sync, not as an orphan (issue #2394).
 CYPHER_AUDIT_ORPHANS = (
-    "MATCH (n) WHERE NOT n:Project "
+    "MATCH (n) WHERE NOT n:Project AND NOT n:IncompleteRun "
     "OPTIONAL MATCH (n)--(x) "
     "WITH n, count(x) AS degree "
     "WHERE degree = 0 "
```

**File**: `codebase_rag/graph_audit.py` (modified, +6/-1)
```diff
@@ -203,6 +203,8 @@ def collect_live_violations(
     """Run the structural audit against a live graph via Cypher (doctor)."""
     violations: list[AuditViolation] = []
     for row in fetch_all(cq.CYPHER_AUDIT_ORPHANS):
+        if row["label"] in cs.AUDIT_BOOKKEEPING_LABELS:
+            continue
         violations.append(
             AuditViolation(
                 cs.AuditCheck.ORPHAN_NODE,
@@ -213,7 +215,10 @@ def collect_live_violations(
         )
     documented_props = documented_node_properties()
     for row in fetch_all(cq.CYPHER_AUDIT_LABELS):
-        if row["label"] not in documented_props:
+        if (
+            row["label"] not in documented_props
+            and row["label"] not in cs.AUDIT_BOOKKEEPING_LABELS
+        ):
             violations.append(
                 AuditViolation(
                     cs.AuditCheck.UNDOCUMENTED_LABEL,
```

**File**: `codebase_rag/parsers/call_processor.py` (modified, +6/-0)
```diff
@@ -1589,6 +1589,12 @@ def _emit_rel(
         # Every CALLS/REFERENCES/INSTANTIATES edge this processor emits goes
         # through here so the current site (line/col/arg shape of the
         # producing expression) rides along as edge properties (#1522).
+        # Invoking a class constructs it. A direct `Config()` is written as
+        # INSTANTIATES, and a class reached through a callable parameter
+        # (`ensure(Config)` running `obj_type()`) is the same fact; as CALLS it
+        # was an edge type the schema does not have (issue #2394).
+        if rel_type == cs.RelationshipType.CALLS and to_spec[0] == cs.NodeLabel.CLASS:
+            rel_type = cs.RelationshipType.INSTANTIATES
         site = self._site_node
         if site is not None:
             cached = self._site_cache
```

---

### Incident Patch 8: `671359ae` (2026-09-29)
**Commit Message**: fix(start): let Ctrl+C stop the pre-chat sync instead of waiting it out

**File**: `codebase_rag/logs.py` (modified, +1/-0)
```diff
@@ -378,6 +378,7 @@
 MG_CONNECTING = "Connecting to Memgraph at {host}:{port}..."
 MG_CONNECTED = "Successfully connected to Memgraph."
 MG_EXCEPTION = "An exception occurred: {error}. Attempting best-effort flush..."
+MG_INTERRUPTED = "Interrupted. Attempting best-effort flush..."
 MG_FLUSH_ERROR = "Failed to flush during cleanup: {error}"
 MG_DISCONNECTED = "\nDisconnected from Memgraph."
 MG_CYPHER_ERROR = "!!! Cypher Error: {error}"
```

**File**: `codebase_rag/main.py` (modified, +2/-1)
```diff
@@ -105,6 +105,7 @@
     StructuralReplaceArgs,
     ToolArgs,
 )
+from .utils.interruptible_thread import run_in_interruptible_thread
 from .utils.rich_markdown import LeftAlignedMarkdown
 from .utils.token_utils import estimate_message_tokens
 
@@ -2176,7 +2177,7 @@ async def _run_pre_chat_sync(task: Callable[[], None], message: str) -> None:
     logger.disable("codebase_rag")
     try:
         with _thinking_with_status_bar(message):
-            await asyncio.to_thread(task)
+            await run_in_interruptible_thread(task)
     finally:
         logger.enable("codebase_rag")
 
```

**File**: `codebase_rag/services/graph_service.py` (modified, +6/-1)
```diff
@@ -215,7 +215,12 @@ def __exit__(
     ) -> None:
         try:
             if exc_type:
-                logger.exception(ls.MG_EXCEPTION.format(error=exc_val))
+                if issubclass(exc_type, Exception):
+                    logger.exception(ls.MG_EXCEPTION.format(error=exc_val))
+                else:
+                    # Ctrl+C or a cancelled task: the user stopped the run,
+                    # and a traceback here read as a crash.
+                    logger.warning(ls.MG_INTERRUPTED)
                 # Best-effort flush: persist buffered nodes/relationships even when
                 # an exception occurred. Catch broad Exception so a secondary flush
                 # failure never masks the original.
```

**File**: `codebase_rag/utils/interruptible_thread.py` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+"""Run blocking work in a worker thread that Ctrl+C can stop.
+
+`asyncio.to_thread` keeps the event loop, and with it the spinner and the
+Shift+Tab listener, alive while the work runs. But SIGINT only ever reaches
+the main thread: Ctrl+C cancelled the awaiting task while the worker ran on to
+the end, and the interpreter waited for it at exit, so `cgr start` looked
+frozen for as long as the rest of its sync took.
+
+Here the cancellation is handed to the worker as a `KeyboardInterrupt`, so the
+work unwinds through its own handlers exactly as it would on the main thread
+(a sync commits what it may and keeps its incomplete-run marker otherwise),
+and the awaiting side waits for that before the cancellation carries on.
+"""
+
+import asyncio
+import contextvars
+import ctypes
+import threading
+from collections.abc import Callable
+
+
+def _set_async_exc(ident: int, exc: type[BaseException] | None) -> None:
+    # CPython raises `exc` in that thread at its next bytecode boundary; None
+    # (a NULL pointer) withdraws one that has not been raised yet.
+    ctypes.pythonapi.PyThreadState_SetAsyncExc(
+        ctypes.c_ulong(ident), None if exc is None else ctypes.py_object(exc)
+    )
+
+
+class _Worker:
+    """One task, and the only way to interrupt it.
+
+    The lock orders the two threads: the interrupt is delivered only while the
+    task runs, and the worker withdraws one still pending before it returns
+    to the executor, whose own code must never see it.
+    """
+
+    def __init__(self, task: Callable[[], None]) -> None:
+        self._task = task
+        self._lock = threading.Lock()
+        self._ident: int | None = None
+        self._stop_requested = False
+
+    def run(self) -> None:
+        try:
+            with self._lock:
+                if self._stop_requested:
+                    return
+                self._ident = threading.get_ident()
+            try:
+                self._task()
+            finally:
+                with self._lock:
+                    if self._ident is not None:
+                        _set_async_exc(self._ident, None)
+                    self._ident = None
+        except KeyboardInterrupt:
+            # A worker thread never receives SIGINT itself, so this is the
+            # interrupt `interrupt` delivered; the awaiting side re-raises its
+            # own cancellation. Anything else is not ours to swallow.
+            if not self._stop_requested:
+                raise
+
+    def interrupt(self) -> None:
+        with self._lock:
+            if self._stop_requested:
+                return
+            self._stop_requested = True
+            if self._ident is not None:
+                _set_async_exc(self._ident, KeyboardInterrupt)
+
+
+async def run_in_interruptible_thread(task: Callable[[], None]) -> None:
+    """`asyncio.to_thread(task)`, except that cancelling it stops `task`."""
+    worker = _Worker(task)
+    context = contextvars.copy_context()
+    future = asyncio.get_running_loop().run_in_executor(None, context.run, worker.run)
+    try:
+        # Shielded: a cancelled executor future stops being awaitable while
+        # its thread runs on, and the wait below needs it.
+        await asyncio.shield(future)
+    except asyncio.CancelledError:
+        worker.interrupt()
+        await asyncio.gather(future, return_exceptions=True)
+        raise
```

---

### Incident Patch 9: `6bbd0dff` (2026-09-29)
**Commit Message**: fix(sync): keep the graph and hash cache when Ctrl+C stops the embeddings pass

**File**: `codebase_rag/cli.py` (modified, +13/-2)
```diff
@@ -29,6 +29,7 @@
 from . import cli_help as ch
 from . import constants as cs
 from . import cypher_queries as cq
+from . import exceptions as ex
 from . import logs as ls
 from .capture import CaptureSelection, resolve_capture, split_spec
 from .cli_runtime import app_context, connect_memgraph, style
@@ -673,11 +674,19 @@ def _run_graph_sync(
             capture=_capture_selection(capture),
             skip_embeddings=skip_embeddings,
         )
-        updater.run()
+        interrupted: ex.EmbeddingsInterrupted | None = None
+        try:
+            updater.run()
+        except ex.EmbeddingsInterrupted as stop:
+            # Raised only after the run committed, so the graph is whole and
+            # the sync is recorded like any other; the interrupt then ends
+            # the command outside the connection, which would otherwise log
+            # it as a failed write.
+            interrupted = stop
         cgr_state.record_sync(project_name)
         _clear_sync_incomplete(ingestor, project_name)
 
-        if output:
+        if output and interrupted is None:
             _info(style(cs.CLI_MSG_EXPORTING_TO.format(path=output), cs.Color.CYAN))
             if not export_graph_to_file(ingestor, output):
                 raise typer.Exit(1)
@@ -698,6 +707,8 @@ def _run_graph_sync(
                 cs.StyleModifier.NONE,
             )
         )
+    if interrupted is not None:
+        raise interrupted
 
 
 def _delete_hash_cache(repo_path: Path) -> None:
```

**File**: `codebase_rag/exceptions.py` (modified, +9/-0)
```diff
@@ -154,3 +154,12 @@ class LLMGenerationError(Exception):
 
 class ReadOnlyQueryError(Exception):
     """An untrusted query would write, so it was never executed."""
+
+
+class EmbeddingsInterrupted(KeyboardInterrupt):
+    """Ctrl+C stopped the embeddings pass of a run that has already committed.
+
+    A `KeyboardInterrupt`, so a caller that does not look for it still stops
+    where it would have; one that does can finish its own bookkeeping first,
+    because the graph and the hash cache are already saved.
+    """
```

**File**: `codebase_rag/graph_updater.py` (modified, +24/-0)
```diff
@@ -1259,6 +1259,7 @@ def __init__(
         self.skip_embeddings = (
             settings.SKIP_EMBEDDINGS if skip_embeddings is None else skip_embeddings
         )
+        self._embeddings_interrupted = False
         self.skipped_because_in_sync = False
         self._collected_dir_mtimes: DirMtimesCache = {}
         self._cpp_frontend_covered: frozenset[str] = frozenset()
@@ -2015,6 +2016,7 @@ def run(self, force: bool = False) -> None:
         # report, so a stale True describes a run that did real work as
         # already in sync (#1620).
         self.skipped_because_in_sync = False
+        self._embeddings_interrupted = False
         self._sink.ensure_node_batch(
             cs.NODE_PROJECT,
             {
@@ -2224,6 +2226,8 @@ def run(self, force: bool = False) -> None:
         self._generate_semantic_embeddings()
 
         self._commit_run_state()
+        if self._embeddings_interrupted:
+            raise ex.EmbeddingsInterrupted
 
     def _clear_python_inference_caches(self) -> None:
         py_engine = self.factory.type_inference._python_type_inference
@@ -7710,9 +7714,29 @@ def flush() -> int:
             get_embedding_cache().save()
             close_qdrant_client()
 
+        except KeyboardInterrupt:
+            self._stop_interrupted_embeddings()
         except Exception as e:
             logger.warning(ls.EMBEDDING_GENERATION_FAILED, error=e)
 
+    def _stop_interrupted_embeddings(self) -> None:
+        """Hold a Ctrl+C in the embeddings pass until `run` has committed.
+
+        The graph writes are flushed before this pass, so letting the
+        interrupt escape here would only skip `_commit_run_state`: with no
+        hash cache the next sync re-parses the whole repository, and after
+        `--clean` there is not even the old cache to fall back on. The next
+        sync that re-indexes embeds every function again, so saving the
+        embedding cache lets it reuse the vectors this pass already computed.
+        """
+        from .embedder import get_embedding_cache
+        from .vector_store import close_qdrant_client
+
+        logger.warning(ls.EMBEDDINGS_INTERRUPTED)
+        get_embedding_cache().save()
+        close_qdrant_client()
+        self._embeddings_interrupted = True
+
     def _reconcile_embeddings(
         self,
         expected_ids: set[int],
```

**File**: `codebase_rag/logs.py` (modified, +4/-0)
```diff
@@ -177,6 +177,10 @@
 NO_SOURCE_FOR = "No source code found for {name}"
 EMBEDDINGS_COMPLETE = "Successfully generated {count} semantic embeddings"
 EMBEDDING_GENERATION_FAILED = "Failed to generate semantic embeddings: {error}"
+EMBEDDINGS_INTERRUPTED = (
+    "Semantic embedding generation interrupted; the graph is saved without the"
+    " remaining embeddings, which the next sync that finds a code change generates"
+)
 EMBEDDING_STORE_FAILED = "Failed to store embedding for {name}: {error}"
 EMBEDDING_STORE_RETRY = "Vector store upsert failed (attempt {attempt}/{max_attempts}), retrying in {delay:.1f}s: {error}"
 EMBEDDING_BATCH_STORED = "Stored batch of {count} embeddings in vector store"
```

---

### Incident Patch 10: `562bb02a` (2026-09-29)
**Commit Message**: fix(deps): drop dependencies removed from a manifest on incremental sync (#2396)

**File**: `codebase_rag/constants/graph.py` (modified, +16/-0)
```diff
@@ -720,6 +720,22 @@ class AuditCheck(StrEnum):
     "WHERE inbound = 0 "
     "DETACH DELETE m"
 )
+# A manifest re-parse only MERGEs the dependencies it still names, and an edge
+# does not record which manifest declared it, so the project's edges are
+# dropped and rebuilt from every manifest whenever one changes (issue #2396).
+CYPHER_DELETE_PROJECT_DEPENDENCIES = (
+    "MATCH (:Project {name: $project_name})-[r:DEPENDS_ON_EXTERNAL]->(:ExternalPackage) "
+    "DELETE r"
+)
+# ExternalPackage nodes are shared by name across projects, so only a package
+# no project depends on any more goes.
+CYPHER_DELETE_ORPHAN_EXTERNAL_PACKAGES = (
+    "MATCH (e:ExternalPackage) "
+    "OPTIONAL MATCH (x)-->(e) "
+    "WITH e, count(x) AS inbound "
+    "WHERE inbound = 0 "
+    "DETACH DELETE e"
+)
 CYPHER_PROJECT_MODULE_PATHS = (
     # The bare-name alternative covers the repository-root __init__.py,
     # whose module qn is the project name itself.
```

**File**: `codebase_rag/graph_updater.py` (modified, +53/-0)
```diff
@@ -1857,6 +1857,51 @@ def _is_dependency_file(self, file_name: str, filepath: Path) -> bool:
             or filepath.suffix.lower() == cs.CSPROJ_SUFFIX
         )
 
+    def _resync_dependencies(
+        self,
+        touched_keys: Iterable[str],
+        reparsed_keys: Collection[str],
+        manifests: Iterable[tuple[Path, str]] | None = None,
+    ) -> None:
+        """Rebuild the project's DEPENDS_ON_EXTERNAL edges when a manifest moved.
+
+        Re-parsing a manifest only MERGEs the dependencies it still names, so
+        a dependency removed from it, or a whole manifest deleted, kept its
+        edge through every later sync while a fresh index dropped it (issue
+        #2396). An edge does not record which manifest declared it (two
+        manifests can name one package), so the project's edges go and every
+        manifest is parsed again; manifests are few and cheap to parse. The
+        ones in `reparsed_keys` are skipped because the caller's re-parse
+        re-adds them. `manifests` is the caller's own walk when it has one;
+        a caller holding a partial file list walks the tree here instead.
+
+        Runs before anything this sync buffers, so the orphan sweep cannot
+        race a re-add: a package still declared is MERGEd back afterwards.
+        """
+        if not isinstance(self.ingestor, QueryProtocol):
+            return
+        if not any(
+            self._is_dependency_file(PurePosixPath(key).name, Path(key))
+            for key in touched_keys
+        ):
+            return
+        logger.info(ls.DEPENDENCIES_RESYNC, project=self.project_name)
+        self.ingestor.execute_write(
+            cs.CYPHER_DELETE_PROJECT_DEPENDENCIES,
+            {cs.KEY_PROJECT_NAME: self.project_name},
+        )
+        self.ingestor.execute_write(cs.CYPHER_DELETE_ORPHAN_EXTERNAL_PACKAGES)
+        if manifests is None:
+            manifests = (
+                (Path(f"{dirpath}/{fname}"), rel_path)
+                for dirpath, fname, rel_path in walk_eligible_files(
+                    self.repo_path, self.exclude_paths, self.unignore_paths
+                )
+            )
+        for path, key in manifests:
+            if key not in reparsed_keys and self._is_dependency_file(path.name, path):
+                self.factory.definition_processor.process_dependencies(path)
+
     def _resolve_deferred_definitions(self, rehydrate: bool) -> dict[str, str]:
         """Every deferred definition-level resolution that must follow Pass 2.
 
@@ -5221,6 +5266,13 @@ def _process_files(self, force: bool = False) -> None:
         # emptied graph.
         self._delete_stale_subtrees((*reindexed_keys, *deleted_before_parse))
         self._drop_deleted_file_state(deleted_before_parse)
+        # A single-file run walked only its target, so it cannot supply the
+        # other manifests; the helper walks for them.
+        self._resync_dependencies(
+            (*self._reparsed_file_keys, *deleted_before_parse),
+            self._reparsed_file_keys,
+            eligible_files if self._single_file is None else None,
+        )
         # LIBCLANG ran before this method and emitted the covered files'
         # subtrees; the delete above matches by path, so it took any it had
         # just written for a stem-flux survivor, and the loop below skips
@@ -7176,6 +7228,7 @@ def reingest(
             )
         )
         self._reingest_delete(reparse, gone, hashes)
+        self._resync_dependencies((*reparse, *gone), reparse)
         parsed = self._reingest_reparse(reparse, gone)
         # After BOTH seed calls and after the re-parse, so a re-parsed file's
         # own entry is exempt while its Module node is still unflushed
```

**File**: `codebase_rag/logs.py` (modified, +4/-0)
```diff
@@ -973,6 +973,10 @@
     "Re-parsing {count} dependent caller file(s) of re-indexed targets"
 )
 INCREMENTAL_DELETED = "Removed state for {count} deleted files"
+DEPENDENCIES_RESYNC = (
+    "A dependency manifest changed; rebuilding the external dependencies of "
+    "'{project}' from every manifest"
+)
 REINGEST_MODULE_PATHS_UNKNOWN = (
     "Re-ingest aborted: the graph's module paths could not be read, so the "
     "module qns already taken are unknown"
```

**File**: `codebase_rag/tests/test_incremental_dependency_removal.py` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
+"""Issue #2396: a dependency removed from a manifest leaves the graph.
+
+An incremental sync re-parsed a changed manifest, but re-parsing only
+MERGEs the dependencies still named, so a removed one kept its
+DEPENDS_ON_EXTERNAL edge forever while a fresh index of the same files
+dropped it.
+"""
+
+from __future__ import annotations
+
+import shutil
+from pathlib import Path
+
+from codebase_rag import constants as cs
+from codebase_rag.graph_updater import GraphUpdater
+from codebase_rag.parser_loader import load_parsers
+from codebase_rag.types_defs import PropertyDict
+from evals.cgr_graph import _StatefulIngestor
+
+PROJECT = "proj"
+
+CARGO = '[package]\nname = "demo"\nversion = "0.1.0"\n\n[dependencies]\n{deps}'
+BEFORE: dict[str, str] = {
+    "src/main.rs": "fn main() {}\n",
+    "Cargo.toml": CARGO.format(deps='ryu = "1.0"\nitoa = "1.0"\n'),
+    "requirements.txt": "requests==2.31.0\nflask>=3.0\n",
+    "web/package.json": (
+        '{"name": "web", "dependencies": {"lodash": "^4.17.21", "express": "^4.0.0"}}\n'
+    ),
+}
+
+
+def _write(root: Path, files: dict[str, str]) -> None:
+    for rel, text in files.items():
+        path = root / rel
+        path.parent.mkdir(parents=True, exist_ok=True)
+        path.write_text(text, encoding="utf-8")
+
+
+def _updater(store: _StatefulIngestor, repo: Path) -> GraphUpdater:
+    parsers, queries = load_parsers()
+    return GraphUpdater(
+        ingestor=store,
+        repo_path=repo,
+        parsers=parsers,
+        queries=queries,
+        project_name=PROJECT,
+    )
+
+
+def _dependencies(store: _StatefulIngestor) -> dict[str, str | None]:
+    found: dict[str, str | None] = {}
+    for edge in store.keyed_edges:
+        from_label, from_val, rel, to_label, to_val, _site = edge
+        if (
+            from_label == cs.NodeLabel.PROJECT
+            and from_val == PROJECT
+            and rel == cs.RelationshipType.DEPENDS_ON_EXTERNAL
+            and to_label == cs.NodeLabel.EXTERNAL_PACKAGE
+        ):
+            spec = store.props_for(edge).get(cs.KEY_VERSION_SPEC)
+            found[str(to_val)] = None if spec is None else str(spec)
+    return found
+
+
+def _packages(store: _StatefulIngestor) -> set[str]:
+    return {
+        str(uid)
+        for (label, uid) in store.nodes
+        if label == cs.NodeLabel.EXTERNAL_PACKAGE
+    }
+
+
+class _RecordingIngestor(_StatefulIngestor):
+    def __init__(self) -> None:
+        super().__init__()
+        self.issued: list[str] = []
+
+    def execute_write(self, query: str, params: PropertyDict | None = None) -> None:
+        self.issued.append(query)
+        super().execute_write(query, params)
+
+
+def _fresh(tmp_path: Path, repo: Path) -> _StatefulIngestor:
+    clean = tmp_path / "clean"
+    shutil.copytree(
+        repo,
+        clean,
+        ignore=shutil.ignore_patterns(cs.HASH_CACHE_FILENAME, cs.DIR_MTIMES_FILENAME),
+    )
+    store = _StatefulIngestor()
+    _updater(store, clean).run(force=True)
+    return store
+
+
+def _synced_repo(tmp_path: Path) -> tuple[_RecordingIngestor, Path]:
+    repo = tmp_path / "repo"
+    repo.mkdir()
+    _write(repo, BEFORE)
+    store = _RecordingIngestor()
+    _updater(store, repo).run(force=True)
+    assert set(_dependencies(store)) == {
+        "ryu",
+        "itoa",
+        "requests",
+        "flask",
+        "lodash",
+        "express",
+    }
+    return store, repo
+
+
+def test_removed_dependencies_leave_on_an_incremental_sync(tmp_path: Path) -> None:
+    store, repo = _synced_repo(tmp_path)
+    _write(
+        repo,
+        {
+            "Cargo.toml": CARGO.format(deps='itoa = "1.0"\n'),
+            "requirements.txt": "flask>=3.1\n",
+            "web/package.json": '{"name": "web", "dependencies": {"express": "^4.0.0"}}\n',
+        },
+    )
+
+    _updater(store, repo).run(force=False)
+
+    assert _dependencies(store) == {
+        "itoa": "1.0",
+        "flask": ">=3.1",
+        "express": "^4.0.0"
```

**File**: `evals/cgr_graph.py` (modified, +26/-0)
```diff
@@ -86,6 +86,9 @@ def execute_write(self, query: str, params: PropertyDict | None = None) -> None:
 
 _MODULE_LABEL = cs.NodeLabel.MODULE.value
 _EXTERNAL_MODULE_LABEL = cs.NodeLabel.EXTERNAL_MODULE.value
+_EXTERNAL_PACKAGE_LABEL = cs.NodeLabel.EXTERNAL_PACKAGE.value
+_PROJECT_LABEL = cs.NodeLabel.PROJECT.value
+_DEPENDS_ON_EXTERNAL = cs.RelationshipType.DEPENDS_ON_EXTERNAL.value
 _FILE_LABEL = cs.NodeLabel.FILE.value
 _FOLDER_LABEL = cs.NodeLabel.FOLDER.value
 _PACKAGE_LABEL = cs.NodeLabel.PACKAGE.value
@@ -1309,6 +1312,18 @@ def execute_write(self, query: str, params: PropertyDict | None = None) -> None:
                 )
             case cs.CYPHER_DELETE_ORPHAN_EXTERNAL_MODULES:
                 self._delete_orphan_external_modules()
+            case cs.CYPHER_DELETE_PROJECT_DEPENDENCIES:
+                self._delete_project_dependencies(
+                    params.get(cs.KEY_PROJECT_NAME) if params else None
+                )
+            case cs.CYPHER_DELETE_ORPHAN_EXTERNAL_PACKAGES:
+                self._detach_delete(
+                    {
+                        node
+                        for node in self.nodes
+                        if node[0] == _EXTERNAL_PACKAGE_LABEL and not self._in.get(node)
+                    }
+                )
             case _:
                 return None
 
@@ -1401,6 +1416,17 @@ def in_scope(qn: str) -> bool:
                         frontier.append(child)
         self._detach_delete(doomed)
 
+    def _delete_project_dependencies(self, project_name: PropertyValue) -> None:
+        project = (_PROJECT_LABEL, project_name)
+        for edge in [
+            edge
+            for edge in self._out.get(project, set())
+            if edge[2] == _DEPENDS_ON_EXTERNAL and edge[3] == _EXTERNAL_PACKAGE_LABEL
+        ]:
+            self.edge_props.pop(edge, None)
+            self._out[project].discard(edge)
+            self._in.get((edge[3], edge[4]), set()).discard(edge)
+
     def _delete_orphan_external_modules(self) -> None:
         doomed = {
             (label, uid)
```

#### Recent Merged Pull Requests:
- **PR #2492** (2026-09-30): fix(packaging): ship codec/schema.proto so installed builds can diff-index (@vitali87)
- **PR #2491** (2026-09-30): fix(logging): log per-symbol indexing and connection lifecycle at DEBUG (@vitali87)
- **PR #2489** (2026-09-30): perf(sync): scope the orphan prune to this project and batch the legacy-identity check (@vitali87)
- **PR #2484** (2026-09-29): fix(vector-store): store embeddings in the stack's Qdrant when QDRANT_URL is unset (@vitali87)
- **PR #2436** (2026-09-29): feat(cli): scope cgr stats to projects or a workspace (@vitali87)
- **PR #2431** (2026-09-29): fix(doctor): accept the edges and markers cgr itself writes (@vitali87)
- **PR #2425** (2026-09-30): fix(sync): keep a sync's work on Ctrl+C and let Ctrl+C stop the pre-chat sync (@vitali87)
- **PR #2408** (2026-09-29): fix(deps): drop dependencies removed from a manifest on incremental sync (@vitali87)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
