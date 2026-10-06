# Forensic Learning Record (Deep Inspection): langroid/langroid

> **Canonical Artifact**: `07_PROJECT_LEARNING/langroid-langroid-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/langroid/langroid](https://github.com/langroid/langroid))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:12:58.960Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `langroid/langroid`
- **Description**: Harness LLMs with Multi-Agent Programming
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 4109 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/basic/batch-concurrency.py`
```
"""Offline rolling-concurrency demo and reproducible equal-capacity benchmark.

Run the MockLM demo:
    uv run python examples/basic/batch-concurrency.py

Save a benchmark (no model calls):
    uv run python examples/basic/batch-concurrency.py --benchmark --output-dir results
"""

import argparse
import asyncio
import csv
import hashlib
import json
import logging
import math
import platform
import statistics
import subprocess
import time
import tracemalloc
from pathlib import Path
from typing import Any

from langroid.agent.batch import (
    ExceptionHandling,
    run_batch_tasks,
    run_batched_tasks,
)
from langroid.agent.chat_agent import ChatAgent, ChatAgentConfig
from langroid.agent.chat_document import ChatDocument
from langroid.agent.task import Task
from langroid.language_models.mock_lm import MockLMConfig
from langroid.mytypes import Entity
from langroid.utils.configuration import Settings, set_global


def demo() -> None:
    """Run real Task clones with a local MockLM and a rolling limit of two."""

    async def respond(message: str) -> str:
        await asyncio.sleep(0.1 if message == "slow" else 0.01)
        return f"Processed {message}"

    agent = ChatAgent(
        ChatAgentConfig(
            name="OfflineWorker",
            vecdb=None,
            llm=MockLMConfig(response_fn_async=respond),
        )
    )
    task = Task(agent, interactive=False, done_if_response=[Entity.LLM])
    results = run_batch_tasks(
        task,
        ["slow", "fast-1", "fast-2"],
        sequential=False,
        max_concurrency=2,
        output_map=lambda result: None if result is None else result.content,
    )
    print(results)


def measure(workload: str, mode: str, n: int, capacity: int) -> dict[str, Any]:
    """Measure one public call, retaining only its own task references."""
    durations = [
        0.2 if workload == "long_tail" and index % 10 == 0 else 0.02
        for index in range(n)
    ]
    started = [0.0] * n
    completed = [0.0] * n
    owned: set[asyncio.Task[Any]] = set()
    active = 0
    peak_active = 0

    async def work(value: str | ChatDocument, index: int) -> int:
        nonlocal active, peak_active
        current = asyncio.current_task()
        assert current is not None
        owned.add(current)
        started[index] = time.perf_counter() - submitted
        active += 1
        peak_active = max(active, peak_active)
        try:
            await asyncio.sleep(durations[index])
            return index
        finally:
            completed[index] = time.perf_counter() - submitted
            active -= 1

    inputs = [str(index) for index in range(n)]
    submitted = time.perf_counter()
    results = run_batched_tasks(
        inputs=inputs,
        do_task=work,
        batch_size=capacity if mode == "fixed" else None,
        max_concurrency=capacity if mode == "rolling" else None,
        sequential=False,
        stop_on_first_result=False,
        handle_exceptions=ExceptionHandling.RAISE,
        output_map=lambda value: value,
        message_template="Offline concurrency benchmark",
    )
    elapsed = time.perf_counter() - submitted
    assert results == list(range(n))
    assert peak_active <= capacity and active == 0
    residual = sum(not task.done() for task in owned)
    assert residual == 0
    p95_index = math.ceil(n * 0.95) - 1
    return dict(
        workload=workload,
        mode=mode,
        n=n,
        capacity=capacity,
        elapsed_seconds=elapsed,
        throughput_per_second=n / elapsed,
        queue_p95_seconds=sorted(started)[p95_index],
        end_to_end_p95_seconds=sorted(completed)[p95_index],
        peak_active=peak_active,
        residual_tasks=residual,
        items=[
            dict(
                index=i,
                duration_seconds=durations[i],
                queue_seconds=started[i],
                end_to_end_seconds=completed[i],
            )
            for i in range(n)
        ],
    )


def benchmark(output_dir: Path) -> None:
    """Alternate modes after warmup; measure Python memory separately."""
    n, capacity, repetitions = 100, 10, 5
    runs: list[dict[str, Any]] = []
    memory: list[dict[str, Any]] = []
    for workload in ("uniform", "long_tail"):
        for mode in ("fixed", "rolling"):
            measure(workload, mode, n, capacity)
        for repetition in range(repetitions):
            modes = (
                ("fixed", "rolling") if repetition % 2 == 0 else ("rolling", "fixed")
            )
            for mode in modes:
                row = measure(workload, mode, n, capacity)
                row["repetition"] = repetition + 1
                runs.append(row)
        for mode in ("fixed", "rolling"):
            tracemalloc.start()
            try:
                measure(workload, mode, n, capacity)
                _, peak = tracemalloc.get_traced_memory()
            finally:
                tracemalloc.stop()
            memory.append(dict(workload=workload, mode=mode, peak_python_bytes=peak))

    repo = Path(__file__).resolve().parents[2]

    def git(*args: str) -> str:
        return subprocess.check_output(["git", *args], cwd=repo, text=True).strip()

    metadata = dict(
        python=platform.python_version(),
        platform=platform.platform(),
        baseline_sha=git("rev-parse", "HEAD"),
        git_status=git("status", "--short"),
        batch_source_sha256=hashlib.sha256(
            (repo / "langroid/agent/batch.py").read_bytes()
        ).hexdigest(),
        n=n,
        capacity=capacity,
        repetitions=repetitions,
        workload=(
            "Deterministic: uniform 20ms; long-tail every tenth 200ms, " "others 20ms"
        ),
        submission="All items submitted at public-call entry, before scheduling",
        memory=(
            "Separate tracemalloc run; Python allocations including "
            "instrumentation, not RSS"
        ),
        logging=(
            "logging disabled; quiet=True, progress=False, cache=False; "
            "no external model or service"
        ),
        statistic=(
            "P95 nearest rank; aggregate speedup is ratio of median elapsed times"
        ),
    )
    summaries = []
    for workload in ("uniform", "long_tail"):
        fixed, rolling = [
            statistics.median(
                row["elapsed_seconds"]
                for row in runs
                if row["workload"] == workload and row["mode"] == mode
            )
            for mode in ("fixed", "rolling")
        ]
        summaries.append(
            dict(
                workload=workload,
                fixed_median_seconds=fixed,
                rolling_median_seconds=rolling,
                speedup=fixed / rolling,
                elapsed_reduction_fraction=(fixed - rolling) / fixed,
            )
        )
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "benchmark.json").write_text(
        json.dumps(
            dict(metadata=metadata, runs=runs, memory=memory, summary=summaries),
            indent=2,
        ),
        encoding="utf-8",
    )
    with (output_dir / "benchmark.csv").open(
        "w", newline="", encoding="utf-8"
    ) as stream:
        writer = csv.DictWriter(
            stream, fieldnames=[key for key in runs[0] if key != "items"]
        )
        writer.writeheader()
        writer.writerows(
            {key: value for key, value in row.items() if key != "items"} for row in runs
        )
    print(json.dumps(summaries, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--benchmark", action="store_true")
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    set_global(
        Settings(quiet=True, progress=False, cache=False, cache_type="fakeredis")
    )
    if args.benchmark:
        if args.output_dir is None:
            parser.error("--benchmark requires --output-dir")
        logging.disable(logging.CRITICAL)
        benchmark(args.output_dir)
    else:
        demo()

```

### Core Architecture Module: `examples/basic/concurrent-tasks.py`
```
"""
Toy example showing how to combine results from multiple tasks running concurrently.

- main agent/task uses `multi_task_tool` tool to specify what to send to tasks t2, t3
- t2, t3 are run concurrently
- results from t2, t3 are combined and returned to main agent/task
- main agent/task then uses the combined results to generate a final response
"""

from typing import Dict

from fire import Fire
import langroid as lr
import langroid.language_models as lm
from langroid.agent.batch import run_batch_task_gen
from langroid.agent.tools.orchestration import AgentDoneTool
from langroid.utils.globals import GlobalState

CITY_AGENT_NAME = "CityAgent"
NAME_AGENT_NAME = "NameAgent"


class MyGlobalState(GlobalState):
    name_task_map: Dict[str, str] = {}


class MultiTaskTool(lr.ToolMessage):
    request: str = "multi_task_tool"
    purpose: str = """
        Specify messages to send to multiple agents, via <agent_msgs>
        which is a dict mapping agent names to messages.
    """
    agent_msgs: Dict[str, str]

    def handle(self) -> AgentDoneTool:
        inputs = list(self.agent_msgs.values())
        agent_names = list(self.agent_msgs.keys())
        name_task_map = MyGlobalState.get_value("name_task_map")
        tasks = [name_task_map[name] for name in agent_names]

        def result2content_fn(chat_doc: lr.ChatDocument) -> str:
            return chat_doc.content

        def task_gen(i: int):  # task generator
            return tasks[i]

        results = run_batch_task_gen(task_gen, inputs, output_map=result2content_fn)
        output = "\n".join(
            f"{agent_names[i]}: {result}" for i, result in enumerate(results)
        )
        return AgentDoneTool(content=output)


def chat(model: str = "", sentence: str = None) -> None:

    cities_agent = lr.ChatAgent(
        lr.ChatAgentConfig(
            name=CITY_AGENT_NAME,
            llm=lm.OpenAIGPTConfig(
                chat_model=model or lm.OpenAIChatModel.GPT4o,
            ),
            system_message="""
            You'll receive a sentence. 
            Simply show the the list of cities in the sentence if any,
            as a comma-separated list, say nothing else.
            If no cities are found, say "NO CITIES".
            """,
        )
    )

    names_agent = lr.ChatAgent(
        lr.ChatAgentConfig(
            name=NAME_AGENT_NAME,
            llm=lm.OpenAIGPTConfig(
                chat_model=model or lm.OpenAIChatModel.GPT4o,
            ),
            system_message="""
            You'll receive a sentence. 
            Simply show the the list of names in the sentence if any,
            as a comma-separated list, say nothing else.
            If no names are found, say "NO NAMES".
            """,
        )
    )

    cities_task = lr.Task(cities_agent, interactive=False, single_round=True)
    names_task = lr.Task(names_agent, interactive=False, single_round=True)

    MyGlobalState.set_values(
        name_task_map={CITY_AGENT_NAME: cities_task, NAME_AGENT_NAME: names_task}
    )

    agent = lr.ChatAgent(
        lr.ChatAgentConfig(
            name="MainAgent",
            llm=lm.OpenAIGPTConfig(
                chat_model=model or lm.OpenAIChatModel.GPT4o,
            ),
            system_message=f"""
            You'll receive a sentence. Your end-goal is to get the 
            list of cities and names mentioned in the sentence,
            BUT YOU DO NOT KNOW HOW TO EXTRACT THEM;
            you'll receive the help of {CITY_AGENT_NAME} and {NAME_AGENT_NAME} for this.
            You must use the TOOL `{MultiTaskTool.name()}` to send the sentence 
            to them.
            Once you receive the consolidated results,
            say "DONE" and show the list of cities and names.
            """,
        )
    )

    agent.enable_message(MultiTaskTool)

    task = lr.Task(agent, interactive=False, single_round=False)

    sentence = sentence or "Satoshi will meet Alice in New York and Bob in London"

    result = task.run(sentence)

    print(
        f"""
        [bold]Final Result:[/bold]
        {result}
        """
    )


if __name__ == "__main__":
    Fire(chat)

```

### Core Architecture Module: `examples/data-qa/sql-chat/utils.py`
```
import logging
import urllib.parse

from rich import print
from rich.prompt import Prompt

from langroid.parsing.utils import closest_string

logger = logging.getLogger(__name__)


DEFAULT_PORTS = dict(
    postgresql=5432,
    mysql=3306,
    mariadb=3306,
    mssql=1433,
    oracle=1521,
    mongodb=27017,
    redis=6379,
)


def fix_uri(uri: str) -> str:
    """Fixes a URI by percent-encoding the username and password."""

    if "%" in uri:
        return uri  # already %-encoded, so don't do anything
    # Split by '://'
    scheme_part, rest_of_uri = uri.split("://", 1)

    # Get the final '@' (assuming only the last '@' is the separator for user info)
    last_at_index = rest_of_uri.rfind("@")
    userinfo_part = rest_of_uri[:last_at_index]
    rest_of_uri_after_at = rest_of_uri[last_at_index + 1 :]

    if ":" not in userinfo_part:
        return uri
    # Split userinfo by ':' to get username and password
    username, password = userinfo_part.split(":", 1)

    # Percent-encode the username and password
    username = urllib.parse.quote(username)
    password = urllib.parse.quote(password)

    # Construct the fixed URI
    fixed_uri = f"{scheme_part}://{username}:{password}@{rest_of_uri_after_at}"

    return fixed_uri


def _create_database_uri(
    scheme: str,
    username: str,
    password: str,
    hostname: str,
    port: int,
    databasename: str,
) -> str:
    """Generates a database URI based on provided parameters."""
    username = urllib.parse.quote_plus(username)
    password = urllib.parse.quote_plus(password)
    port_str = f":{port}" if port else ""
    return f"{scheme}://{username}:{password}@{hostname}{port_str}/{databasename}"


def get_database_uri() -> str:
    """Main function to gather input and print the database URI."""
    scheme_input = Prompt.ask("Enter the database type (e.g., postgresql, mysql)")
    scheme = closest_string(scheme_input, list(DEFAULT_PORTS.keys()))

    # Handle if no close match is found.
    if scheme == "No match found":
        print(f"No close match found for '{scheme_input}'. Please verify your input.")
        return

    username = Prompt.ask("Enter the database username")
    password = Prompt.ask("Enter the database password", password=True)
    hostname = Prompt.ask("Enter the database hostname")

    # Inform user of default port, and let them choose to override or leave blank
    default_port = DEFAULT_PORTS.get(scheme, "")
    port_msg = (
        f"Enter the database port "
        f"(hit enter to use default: {default_port} or specify another value)"
    )

    port = Prompt.ask(port_msg, default=default_port)
    if not port:  # If user pressed enter without entering anything
        port = default_port
    port = int(port)

    databasename = Prompt.ask("Enter the database name")

    uri = _create_database_uri(scheme, username, password, hostname, port, databasename)
    print(f"Your {scheme.upper()} URI is:\n{uri}")
    return uri

```

### Core Architecture Module: `examples/docqa/rag-concurrent.py`
```
"""
Concurrent RAG example using DocChatAgent with custom asyncio harness

This example demonstrates running multiple DocChat queries concurrently
with detailed live logging that shows every task starting and finishing
in real time (no waiting for gather() to return), making concurrency
easy to verify at a glance.

IMPORTANT: The --sequential flag runs tasks in a TRUE sequential loop
(not asyncio's sequential mode), providing a baseline for comparison.

Usage:

# Run concurrently with asyncio (default)
python3 examples/docqa/rag-concurrent.py

# Run in TRUE sequential mode (simple loop) for baseline comparison
python3 examples/docqa/rag-concurrent.py --sequential

# With specific model
python3 examples/docqa/rag-concurrent.py -m ollama/mistral:7b-instruct-v0.2-q8_0

# Use local SentenceTransformer embeddings with Docker Qdrant on localhost:6333
python3 examples/docqa/rag-concurrent.py --local-embeddings

# Turn on cross-encoder reranking (auto-picks CUDA/MPS/CPU; override with device flag)
python3 examples/docqa/rag-concurrent.py --cross-encoder
python3 examples/docqa/rag-concurrent.py --cross-encoder --cross-encoder-device=mps

# Compare both modes to measure concurrency speedup
python3 examples/docqa/rag-concurrent.py --sequential  # Baseline
python3 examples/docqa/rag-concurrent.py  # Should be faster if truly concurrent

# Use Langroid's built-in run_batch_tasks harness instead of the custom one
python3 examples/docqa/rag-concurrent.py --use-builtin-batch

# Show only concurrency logs (suppress long answers) and filter to START/WORKER lines
python3 examples/docqa/rag-concurrent.py --num-questions=3 --log-only \\
  | rg "Q[0-9]{2} (START|WORKER|COMPLETE)"

The logs show:
- Timestamps (HH:MM:SS.mmm) for each task start/complete
- Thread IDs to verify parallel execution
- Question numbers for tracking

Expected patterns:
- SEQUENTIAL: START->COMPLETE->START->COMPLETE (one at a time)
- CONCURRENT: Multiple STARTs with close timestamps before any COMPLETEs

If concurrent mode shows START->COMPLETE pattern, there's a bottleneck
(e.g., shared vecdb client causing serialization).

See here for more on how to set up a local LLM to work with Langroid:
https://langroid.github.io/langroid/tutorials/local-llm-setup/
"""

import asyncio
import os
import threading
import time
from contextvars import ContextVar
from datetime import datetime
from typing import Dict

import fire

import langroid as lr
import langroid.language_models as lm
from langroid.agent.batch import run_batch_task_gen
from langroid.agent.special.doc_chat_agent import DocChatAgent, DocChatAgentConfig

os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Thread-safe logging with timestamps
log_lock = threading.Lock()
CURRENT_QUESTION: ContextVar[int | None] = ContextVar("CURRENT_QUESTION", default=None)
EVENT_HISTORY: list[str] = []
QUESTION_TO_INDEX: Dict[str, int] = {}


def log_event(event_type: str, question_num: int, message: str = ""):
    """Thread-safe logging with precise timestamps"""
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    thread_id = threading.get_ident() % 10000  # Short thread ID
    line = (
        f"[{timestamp}] [{thread_id:04d}] "
        f"Q{question_num:02d} {event_type:12s} {message}"
    )
    EVENT_HISTORY.append(line)
    with log_lock:
        print(line)


# 10 questions about Borges' "The Library of Babel"
ALL_QUESTIONS = [
    "What is the structure of the Library described in the story?",
    "What do the books in the Library contain?",
    "What is the significance of the hexagonal galleries?",
    "How many books are estimated to exist in the Library?",
    "What is the narrator's theory about the origin of the Library?",
    "How does the story describe the contents of most books?",
    "What happens to librarians who search for meaningful books?",
    "What is the emotional impact of the infinite Library on the librarians?",
    "What philosophical themes does the story explore?",
    "What is the relationship between infinity and meaning in the story?",
]


class LoggingDocChatAgent(DocChatAgent):
    """DocChatAgent that reports worker-thread execution for visibility."""

    def answer_from_docs(self, query: str):
        q_num = CURRENT_QUESTION.get()
        if q_num is None:
            q_num = QUESTION_TO_INDEX.get(query)
        if q_num is not None:
            log_event(
                "WORKER_START", q_num, f"Vec/LLM on T{threading.get_ident()%10000:04d}"
            )
            start = time.time()
        result = super().answer_from_docs(query)
        if q_num is not None:
            elapsed = time.time() - start
            log_event(
                "WORKER_DONE",
                q_num,
                f"{elapsed:.2f}s on T{threading.get_ident()%10000:04d}",
            )
        return result


def app(
    m: str = "",
    sequential: bool = False,
    num_questions: int = 10,
    log_only: bool = False,
    use_builtin_batch: bool = False,
    local_embeddings: bool = False,
    cross_encoder: bool = False,
    cross_encoder_device: str = "",
):
    """
    Run DocChat queries on Library of Babel story.

    Args:
        m: Model name (default: GPT-4o)
        sequential: If True, run truly sequentially (simple loop);
                   if False, run with asyncio concurrency (default: False)
        num_questions: Number of questions to run (max 10)
        log_only: Suppress verbose answers and print a concise log summary
        use_builtin_batch: Use Langroid's run_batch_tasks instead of the custom harness
        cross_encoder: Enable reranking via cross encoder (auto-picks CUDA/MPS/CPU)
        cross_encoder_device: Optional explicit device override (e.g. "cuda", "mps")
    """
    num_questions = max(1, min(num_questions, len(ALL_QUESTIONS)))
    questions = ALL_QUESTIONS[:num_questions]
    QUESTION_TO_INDEX.clear()
    QUESTION_TO_INDEX.update({q: i + 1 for i, q in enumerate(questions)})
    EVENT_HISTORY.clear()
    mode = "TRULY SEQUENTIAL (simple loop)" if sequential else "CONCURRENT (asyncio)"
    print(f"\n{'='*80}")
    print(f"Running in {mode} mode")
    print(f"{'='*80}\n")

    # Create the llm config object
    llm_config = lm.OpenAIGPTConfig(
        chat_model=m or lm.OpenAIChatModel.GPT4o,
        chat_context_length=32_000,
        max_output_tokens=300,
        temperature=0.2,
        stream=False,  # Disable streaming for batch processing
        timeout=45,
    )

    # Configure DocChatAgent with Library of Babel story
    vecdb_config = None
    if local_embeddings:
        try:
            from langroid.embedding_models.models import (
                SentenceTransformerEmbeddingsConfig,
            )
            from langroid.vector_store.qdrantdb import QdrantDBConfig
        except ImportError as exc:
            raise RuntimeError(
                "SentenceTransformer embeddings require the hf-embeddings extras"
            ) from exc

        os.environ.setdefault("QDRANT_API_URL", "http://localhost:6333")
        os.environ.setdefault("QDRANT_API_KEY", "local-dev-key")

        sentence_cfg = SentenceTransformerEmbeddingsConfig(
            model_type="sentence-transformer",
            model_name="sentence-transformers/all-MiniLM-L6-v2",
        )
        vecdb_config = QdrantDBConfig(
            cloud=True,
            collection_name="doc-chat-local-embeddings",
            replace_collection=True,
            embedding=sentence_cfg,
        )

    config_kwargs = dict(
        name="RagAgent",
        llm=llm_config,
        relevance_extractor_config=None,
    )
    if vecdb_config is not None:
        config_kwargs["vecdb"] = vecdb_config

    if cross_encoder:
        config_kwargs.update(
            dict(
                cross_encoder_reranking_model="cross-encoder/ms-marco-MiniLM-L-6-v2",
                cross_encoder_device=cross_encoder_device or None,
            )
        )

    config = DocChatAgentConfig(**config_kwargs)

    # Create agent and ingest the document
    agent = LoggingDocChatAgent(config)
    url = "https://xpressenglish.com/our-stories/library-of-babel/"
    print(f"\nIngesting document: {url}")
    agent.ingest_doc_paths([url])
    print("Document ingested successfully.\n")
    if local_embeddings and agent.vecdb is not None:
        agent.vecdb.config.replace_collection = False

    # Create a single task that will be cloned for each question
    print(f"Creating task for concurrent execution of {len(questions)} queries...\n")

    task = lr.Task(
        agent,
        interactive=False,
        single_round=True,
    )

    # Run tasks and measure time
    print("\n" + "=" * 80)
    print("EXECUTION LOG (with timestamps and thread IDs)")
    print("=" * 80 + "\n")
    start_time = time.time()

    if sequential:
        # TRUE SEQUENTIAL: Simple loop, no async
        results = []
        for i, question in enumerate(questions, 1):
            log_event(
                "START", i, question[:50] + "..." if len(question) > 50 else question
            )  # noqa: E501
            token = CURRENT_QUESTION.set(i)
            try:
                result = task.run(question, turns=1)
            finally:
                CURRENT_QUESTION.reset(token)
            log_event(
                "COMPLETE",
                i,
                f"Got response ({len(str(result.content if result else ''))} chars)",
            )  # noqa: E501
            final = (
                result.content
                if result and hasattr(result, "content")
                else str(result) if result else ""
            )  # noqa: E501
            results.append(final)
    else:
        if use_builtin_batch:

            def input_map(question: str) -> str:
                q_num = QUESTION_TO_INDEX[question]
                log_event(
                    "START",
                    q_num,
                    question[:50] + "..." if len(question) > 50 else question,
                )
                return question

            #
```

### Core Architecture Module: `examples/docqa/streamlit-app/utils.py`
```
import os

import streamlit as st

from langroid.agent.special import DocChatAgent, DocChatAgentConfig
from langroid.embedding_models.models import OpenAIEmbeddingsConfig
from langroid.language_models.openai_gpt import OpenAIGPTConfig
from langroid.parsing.parser import ParsingConfig
from langroid.vector_store.qdrantdb import QdrantDBConfig

OPENAI_KEY = os.environ["OPENAI_API_KEY"]


@st.cache_data
def configure(filename: str, chat_model: str = "") -> DocChatAgentConfig:
    llm_cfg = OpenAIGPTConfig(
        chat_model=chat_model,
    )

    oai_embed_config = OpenAIEmbeddingsConfig(
        model_type="openai",
        model_name="text-embedding-3-small",
        dims=1536,
    )

    # Configuring DocChatAgent
    cfg = DocChatAgentConfig(
        n_similar_chunks=4,
        n_relevant_chunks=4,
        parsing=ParsingConfig(
            chunk_size=100,
            overlap=20,
        ),
        show_stats=False,
        cross_encoder_reranking_model="",
        llm=llm_cfg,
        vecdb=QdrantDBConfig(
            embedding=oai_embed_config,
            collection_name="lease",
            replace_collection=True,
            cloud=False,
        ),
        doc_paths=[filename],
    )

    return cfg


def agent(cfg, prompt):
    # Creating DocChatAgent
    rag_agent = st.session_state["rag_agent"]
    if (
        rag_agent is None
        or st.session_state["chat_model"] != cfg.llm.chat_model
        or st.session_state["file_path"] != cfg.doc_paths[0]
    ):
        rag_agent = DocChatAgent(cfg)
        st.session_state["rag_agent"] = rag_agent

    response = rag_agent.llm_response(prompt)
    return response.content

```

### Core Architecture Module: `examples/multi-agent-debate/chainlit_utils.py`
```
import logging
from typing import Optional, Tuple

import chainlit as cl
from config import MODEL_MAP
from models import SystemMessages
from utils import extract_topics

DEFAULT_TURN_COUNT = 2
DEFAULT_TIMEOUT = 100

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


def parse_boolean_response(response: str) -> bool:
    """
    Convert a user response into a boolean value.
    Args:
        response (str): User input as "yes" or "no".
    Returns:
        bool: True for "yes", False for "no".
    """
    if response == "yes":
        return True
    elif response == "no":
        return False
    raise ValueError("Invalid response: expected 'yes' or 'no'.")


async def handle_boolean_response(res, default=False):
    """
    Handle the user's response from an AskActionMessage.

    Args:
        res (dict): The response dictionary from AskActionMessage.
        default (bool): The default value to return in case of errors or timeouts.

    Returns:
        bool: Parsed boolean response from the user.
    """
    if res:
        try:
            user_choice = res.get("payload", {}).get("value", "").lower()
            return parse_boolean_response(user_choice)
        except ValueError:
            await cl.Message(
                content=f"Unexpected response. Defaulting to '{default}'."
            ).send()
            return default
    # Default if no response or timeout
    await cl.Message(
        content=f"You didn't respond in time. Defaulting to '{default}'."
    ).send()
    return default


async def is_same_llm_for_all_agents() -> bool:
    """
    Ask the user if they want to use the same LLM for all agents.

    Returns:
        bool: True if yes, False if no. Timeout or no response is defaulted to False.
    """

    # Create a Chainlit action message with a timeout
    ask_message = cl.AskActionMessage(
        content=f"Do you want to use the same LLM for all agents?\n\n(If you do not respond within {DEFAULT_TIMEOUT} "
        f"seconds, we will default to selecting individual LLMs.)",
        actions=[
            cl.Action(name="yes", payload={"value": "yes"}, label="Yes"),
            cl.Action(name="no", payload={"value": "no"}, label="No"),
        ],
        timeout=DEFAULT_TIMEOUT,
    )

    res = await ask_message.send()

    # Override the timeout before Chainlit sends its message
    if not res:
        await ask_message.remove()  # Removes the pending action before timeout triggers
        res = {"payload": {"value": "no"}}  # Auto-select "No"

    user_selection = await handle_boolean_response(res, default=False)

    await cl.Message(
        content=(
            "You have chosen to proceed with the same LLM for all agents."
            if user_selection
            else "You have chosen to select individual LLMs for each agent."
        )
    ).send()

    return user_selection


async def select_max_debate_turns() -> int:
    """
    Ask the user to select the maximum number of turns for debates.
    Returns:
        int: The number of debate turns.
    """
    ask_message = cl.AskActionMessage(
        content=f"How many turns should the debates take?\n\n(If you do not respond within {DEFAULT_TIMEOUT} "
        f"seconds, we will default to selecting 2 turns.)",
        actions=[
            cl.Action(name="2", payload={"value": "2"}, label="2"),
            cl.Action(name="4", payload={"value": "4"}, label="4"),
            cl.Action(name="8", payload={"value": "8"}, label="8"),
            cl.Action(name="16", payload={"value": "16"}, label="16"),
        ],
        timeout=DEFAULT_TIMEOUT,
    )

    res = await ask_message.send()

    # Prevents Chainlit's default timeout message
    if not res:
        await ask_message.remove()
        res = {"payload": {"value": "2"}}  # Default to 2 turns

    try:
        turns = int(res["payload"]["value"])
        await cl.Message(content=f"You selected {turns} turns for the debate.").send()
        return turns
    except (ValueError, KeyError):
        await cl.Message(content="Invalid input. Defaulting to 2 turns.").send()
        return DEFAULT_TURN_COUNT


async def select_model(config_agent_name: str) -> str:
    """
    Prompts the user to select an LLM model for the specified agent.
    Args:
        config_agent_name (str): The name of the agent being configured.
    Returns:
        str: The selected model key from MODEL_MAP.
    """
    # Model selections for user
    llm_options = {
        "1": "GPT-4o",
        "2": "GPT-4",
        "3": "GPT-4o-MINI",
        "4": "GPT-4-TURBO",
        "5": "GPT-4-32K",
        "6": "GPT-3.5-TURBO",
        "7": "Mistral 7b-instruct",
        "8": "Gemini 2.0 Flash",
        "9": "Gemini 1.5 Flash",
        "10": "Gemini 1.5 Flash 8B",
        "11": "Gemini 1.5 Pro",
    }

    # Prepare the user prompt
    options_text = "\n".join([f"{key}: {value}" for key, value in llm_options.items()])
    prompt_text = f"Select a Model for {config_agent_name}:\n{options_text}\nEnter your choice (1-{len(llm_options)}):"

    # Prompt the user for model selection
    response = await cl.AskUserMessage(content=prompt_text, timeout=20).send()
    if response:
        try:
            selected_option = response["output"].strip()
            if selected_option in MODEL_MAP:
                await cl.Message(
                    content=f"You selected: {llm_options[selected_option]}"
                ).send()
                return selected_option
            else:
                await cl.Message(
                    content="Invalid selection. Please enter a valid number."
                ).send()
                return await select_model(config_agent_name)  # Retry on invalid input
        except Exception as e:
            await cl.Message(content=f"An error occurred: {e}").send()
            return await select_model(config_agent_name)  # Retry on error
    else:
        await cl.Message(
            content="You didn't respond in time. Defaulting to GPT-4o."
        ).send()
        return "1"  # Default to GPT-4o


async def is_llm_delegate() -> bool:
    """
    Ask the user if the Pro and Con agents should debate autonomously.

    Returns:
        bool: True if yes, False if no.
    """
    # Create the AskActionMessage and send it
    ask_message = cl.AskActionMessage(
        content=f"Should the Pro and Con agents debate autonomously?\n\n(If you do not respond within {DEFAULT_TIMEOUT} "
        f"seconds, we will default to autonomous debate.)",
        actions=[
            cl.Action(name="yes", payload={"value": "yes"}, label="Yes"),
            cl.Action(name="no", payload={"value": "no"}, label="No"),
        ],
        timeout=DEFAULT_TIMEOUT,
    )

    res = await ask_message.send()

    # # Prevents Chainlit's default timeout message
    if not res:
        await ask_message.remove()
        res = {"payload": {"value": "no"}}  # Auto-select "No"

    user_selection = await handle_boolean_response(res, default=False)

    await cl.Message(
        content=(
            "You have chosen to proceed with autonomous debate"
            if user_selection
            else "You have chosen to engage in debate with an AI agent"
        )
    ).send()

    print("The user selected to proceed with the debate")
    return user_selection


async def select_side(topic_name: str) -> str:
    """
    Prompt the user to select a pro or con side in the debate
    Args:
        topic_name (str): The name of the debate topic.
    Returns:
        str: The selected debate side, either "pro" or "con".
    """
    response = await cl.AskUserMessage(
        content=f"Which side would you like to debate on?\n1. Pro-{topic_name}\n2. Con-{topic_name}",
        timeout=20,
    ).send()

    if response:
        side_choice = response["output"].strip()
        if side_choice in ["1", "2"]:
            return "pro" if side_choice == "1" else "con"
        else:
            await cl.Message(
                content="Invalid selection. Please choose 1 for Pro or 2 for Con."
            ).send()
            return await select_side(topic_name)  # Retry on invalid input
    else:
        await cl.Message(
            content="You didn't respond in time. Defaulting to 'pro'."
        ).send()
        return "pro"  # Default to "pro" if no response


async def select_topic_and_setup_side(
    LLM_DELEGATE_FLAG, system_messages: "SystemMessages"
) -> Tuple[str, str, str, str]:
    """
    Prompt the user to select a debate topic and sets up the respective side.
    Args:
        system_messages (SystemMessages): The object containing system messages with respective
                                          debate topics.
    Returns:
        Tuple[str, str, str, str]: A tuple containing:
            - topic_name (str): The name of the selected debate topic.
            - pro_key (str): The key for the Pro side of the selected topic.
            - con_key (str): The key for the Con side of the selected topic.
            - side (str): The user's selected side, either "pro" or "con".
    Raises:
        ValueError: If no topic is selected or no topics are available in the provided
                    `system_messages`.
    """
    selected_topic_tuple = await select_debate_topic(
        system_messages
    )  # Assuming this is an async function
    if not selected_topic_tuple:
        logger.error("No topic selected. Exiting.")
        raise ValueError("No topic selected.")

    topic_name, pro_key, con_key = selected_topic_tuple
    if LLM_DELEGATE_FLAG:
        side = "pro"
    else:
        side = await select_side(topic_name)
    return topic_name, pro_key, con_key, side


async def select_debate_topic(system_messages: "SystemMessages") -> Optional[tuple]:
    """
    Prompt the user to select a debate topic dynamically loaded from  SystemMessages.
    Args:
        system_messages (SystemMessages): The object containing debate topics.
    Returns:
        Optional[tuple]: A tuple con
```

### Core Architecture Module: `examples/multi-agent-debate/utils.py`
```
import logging
import re
from typing import List, Literal, Optional, Tuple

from models import SystemMessages
from rich.prompt import Confirm, Prompt

from langroid.utils.logging import setup_logger

DEFAULT_TURN_COUNT = 2

# set info logger
logger = setup_logger(__name__, level=logging.INFO, terminal=True)


def extract_topics(system_messages: SystemMessages) -> List[Tuple[str, str, str]]:
    """Extract unique debate topics from the SystemMessages object.

    Processes the `SystemMessages` object to identify debate topics by pairing
    `pro_` and `con_` keys. Ensures each topic is represented only once.

    Args:
        system_messages (SystemMessages): The object containing system messages
            with `pro_` and `con_` topic keys.

    Returns:
        List[Tuple[str, str, str]]: A list of tuples,
        where each tuple contains:
            - topic_name (str): The name of the debate topic.
            - pro_key (str): The key for the pro side of the debate.
            - con_key (str): The key for the con side of the debate.
    """
    topics: List[Tuple[str, str, str]] = []
    for key, message in system_messages.messages.items():
        # Process only "pro_" keys to avoid duplicates
        if key.startswith("pro_"):
            con_key = key.replace("pro_", "con_", 1)  # Match "con_" dynamically
            if con_key in system_messages.messages:  # Ensure "con_" exists
                topics.append((message.topic, key, con_key))
    return topics


def select_model(config_agent_name: str) -> str:
    """
    Prompt the user to select an OpenAI or Gemini model
    for the specified agent.

    This function prompts the user to select an option from
    a list of available models.
    The user's input corresponds to a predefined choice, which is
    then returned as a string representing the selected option.

    Args:
        config_agent_name (str): The name of the agent being configured,
        used in the prompt to personalize the message.

    Returns:
        str: The user's selected option as a string, corresponding to one of the
             predefined model choices (e.g., "1", "2", ..., "10").
    """
    return Prompt.ask(
        f"Select a Model for {config_agent_name}:\n"
        "1: gpt-4o\n"
        "2: gpt-4\n"
        "3: gpt-4o-mini\n"
        "4: gpt-4-turbo\n"
        "5: gpt-4-32k\n"
        "6: gpt-3.5-turbo-1106\n"
        "7: Mistral: mistral:7b-instruct-v0.2-q8_0a\n"
        "8: Gemini: gemini-2.0-flash\n"
        "8: Gemini: gemini-1.5-flash\n"
        "9: Gemini: gemini-1.5-flash-8b\n"
        "10: Gemini: gemini-1.5-pro\n",
        choices=["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        default="1",
    )


def select_debate_topic(system_messages: SystemMessages) -> Optional[tuple]:
    """Prompt the user to select a debate topic from SystemMessages.

    Dynamically loads debate topics from the SystemMessages object, displays
    the options to the user, and prompts them to select a topic.

    Args:
        system_messages (SystemMessages): The object containing debate topics.

    Returns:
        Optional[tuple]: A tuple containing:
            - topic_name (str): The selected topic's name.
            - pro_key (str): The key for the pro side of the debate.
            - con_key (str): The key for the con side of the debate.
            Returns None if no topics are available or an error occurs.
    """
    topics = extract_topics(system_messages)

    if not topics:
        logger.error("No topics found in the JSON file.")
        return None

    # Prepare topic choices for user selection
    topic_choices = "\n".join(
        [f"{i + 1}. {topic[0]}" for i, topic in enumerate(topics)]
    )
    user_input = Prompt.ask(
        f"Select a debate topic:\n{topic_choices}",
        choices=[str(i + 1) for i in range(len(topics))],
        default="1",
    )
    topic_index = int(user_input) - 1

    selected_topic = topics[topic_index]
    logger.info(f"Selected topic: {selected_topic[0]}")
    return selected_topic


def select_side(topic_name: str) -> Literal["pro", "con"]:
    """Prompt the user to select their side in the debate.

    Presents the user with a choice to debate on either the pro or con side
    of the given topic.

    Args:
        topic_name (str): The name of the debate topic.

    Returns:
        Literal["pro", "con"]: The selected debate side.
    """
    side = Prompt.ask(
        f"Which side would you like to debate on?\n1. Pro-{topic_name}\n2. "
        f"Con-{topic_name}",
        choices=["1", "2"],
        default="1",
    )
    return "pro" if side == "1" else "con"


def select_topic_and_setup_side(
    system_messages: SystemMessages,
) -> Tuple[str, str, str, str]:
    """Prompt the user to select a debate topic and sets up the respective side.

    This function handles the user interaction for selecting a debate topic and the side
    (Pro or Con) they want to argue. It validates that a topic is selected and raises an
    exception if the topic is not available.

    Args:
        system_messages (SystemMessages): The object containing system messages with respective
                                          debate topics.

    Returns:
        Tuple[str, str, str, str]: A tuple containing:
            - topic_name (str): The name of the selected debate topic.
            - pro_key (str): The key for the Pro side of the selected topic.
            - con_key (str): The key for the Con side of the selected topic.
            - side (str): The user's selected side, either "pro" or "con".

    Raises:
        ValueError: If no topic is selected or no topics are available in the provided
                    `system_messages`.
    """
    selected_topic_tuple = select_debate_topic(system_messages)
    if not selected_topic_tuple:
        logger.error("No topic selected. Exiting.")
        raise ValueError("No topic selected.")

    topic_name, pro_key, con_key = selected_topic_tuple
    side = select_side(topic_name)
    return topic_name, pro_key, con_key, side


def is_llm_delegate() -> bool:
    """Prompt the user to decide on LLM delegation.

    Asks the user whether the LLM should autonomously continue the debate
    without requiring user input.

    Returns:
        bool: True if the user chooses LLM delegation, otherwise return False.
    """
    return Confirm.ask(
        "Should the Pro and Con agents debate autonomously?",
        default=False,
    )


def is_metaphor_search_key_set() -> bool:
    """Prompt the user confirmation about metaphorSearch API keys.

    Asks the user to confirm the metaphorSearch API keys.

    Returns:
        bool: True if the user chooses LLM delegation, otherwise return False.
    """
    return Confirm.ask(
        "Do you have an API Key for Metaphor Search?",
        default=False,
    )


def is_same_llm_for_all_agents() -> bool:
    """Prompt the user to decide if same LLM should be used for all agents.

    Asks the user whether the same LLM should be configured for all agents.

    Returns:
        bool: True if the user chooses same LLM for all agents, otherwise return False.
    """
    # Ask the user if they want to use the same LLM configuration for all agents
    return Confirm.ask(
        "Do you want to use the same LLM for all agents?",
        default=True,
    )


def select_max_debate_turns() -> int:
    # Prompt for number of debate turns
    while True:
        max_turns = Prompt.ask(
            "How many turns should the debate continue for?",
            default=str(DEFAULT_TURN_COUNT),
        )
        try:
            return int(max_turns)
        except ValueError:
            return DEFAULT_TURN_COUNT


def extract_urls(message_history):
    """
    Extracts all URLs from the given message history content and returns them in the format [url1, url2, ..., urln].

    Parameters:
        message_history (list): A list of LLMMessage objects containing message history.

    Returns:
        str: A string representation of a list of URLs.
    """
    # Extract content only from non-system messages
    content = " ".join(
        message.content
        for message in message_history
        if hasattr(message, "content") and message.content and message.role != "system"
    )

    # Extract URLs from content
    urls = re.findall(r"https?://\S+", content)
    return urls  # Return the list of URLs directly


def is_url_ask_question(topic_name: str) -> bool:
    """Prompt the user to decide to ask questions from the searched URL docs.

    Asks the user whether they want to ask questions from the searched URL docs?

    Returns:
        bool: True if the user chooses to ask questions from searched url docs., otherwise return False.
    """
    return Confirm.ask(
        f"Would you like to Chat with documents found through Search for more information on the {topic_name}",
        default=False,
    )

```

### Core Architecture Module: `langroid/language_models/utils.py`
```
# from openai-cookbook
import asyncio
import logging
import random
import time
from typing import Any, Callable, Dict, List

import aiohttp
import openai
import requests

logger = logging.getLogger(__name__)
# setlevel to warning
logger.setLevel(logging.WARNING)


# define a retry decorator
def retry_with_exponential_backoff(
    func: Callable[..., Any],
    initial_delay: float = 1,
    exponential_base: float = 1.3,
    jitter: bool = True,
    max_retries: int = 5,
    errors: tuple = (  # type: ignore
        requests.exceptions.RequestException,
        openai.APITimeoutError,
        openai.RateLimitError,
        openai.AuthenticationError,  # redundant: also fast-failed by the 4xx guard
        openai.APIError,
        aiohttp.ServerTimeoutError,
        asyncio.TimeoutError,
    ),
) -> Callable[..., Any]:
    """Retry a function with exponential backoff."""

    def wrapper(*args: List[Any], **kwargs: Dict[Any, Any]) -> Any:
        # Initialize variables
        num_retries = 0
        delay = initial_delay

        # Loop until a successful response or max_retries is hit or exception is raised
        while True:
            try:
                return func(*args, **kwargs)

            # Non-retryable client errors (4xx): retrying will never succeed.
            # Match by exception type -- str(e) for a native OpenAI-SDK error is
            # "Error code: 404 - ..." and does NOT contain "NotFoundError", so
            # the string guard below misses direct-API (e.g. Gemini) errors.
            except (
                openai.BadRequestError,  # 400 (e.g. context too long)
                openai.AuthenticationError,  # 401
                openai.PermissionDeniedError,  # 403
                openai.NotFoundError,  # 404 (e.g. retired/unknown model)
                openai.UnprocessableEntityError,  # 422
            ) as e:
                logger.error(f"OpenAI API request failed with error: {e}.")
                raise e

            # Retry on specified errors
            except errors as e:

                # For certain types of errors that slip through here
                # (e.g. when using proxies like LiteLLM, do not retry)
                if any(
                    err in str(e)
                    for err in [
                        "BadRequestError",
                        "ConnectionError",
                        "NotFoundError",
                    ]
                ):
                    logger.error(f"OpenAI API request failed with error: {e}.")
                    raise e
                # Increment retries
                num_retries += 1

                # Check if max retries has been reached
                if num_retries > max_retries:
                    raise Exception(
                        f"Maximum number of retries ({max_retries}) exceeded."
                        f" Last error: {str(e)}."
                    )

                # Increment the delay
                delay *= exponential_base * (1 + jitter * random.random())
                logger.warning(
                    f"""OpenAI API request failed with error: 
                    {e}. 
                    Retrying in {delay} seconds..."""
                )
                # Sleep for the delay
                time.sleep(delay)

            # Raise exceptions for any errors not specified
            except Exception as e:
                raise e

    return wrapper


def async_retry_with_exponential_backoff(
    func: Callable[..., Any],
    initial_delay: float = 1,
    exponential_base: float = 1.3,
    jitter: bool = True,
    max_retries: int = 5,
    errors: tuple = (  # type: ignore
        openai.APITimeoutError,
        openai.RateLimitError,
        openai.AuthenticationError,  # redundant: also fast-failed by the 4xx guard
        openai.APIError,
        aiohttp.ServerTimeoutError,
        asyncio.TimeoutError,
    ),
) -> Callable[..., Any]:
    """Retry a function with exponential backoff."""

    async def wrapper(*args: List[Any], **kwargs: Dict[Any, Any]) -> Any:
        # Initialize variables
        num_retries = 0
        delay = initial_delay

        # Loop until a successful response or max_retries is hit or exception is raised
        while True:
            try:
                result = await func(*args, **kwargs)
                return result

            # Non-retryable client errors (4xx): retrying will never succeed.
            # Match by exception type -- str(e) for a native OpenAI-SDK error is
            # "Error code: 404 - ..." and does NOT contain "NotFoundError", so
            # the string guard below misses direct-API (e.g. Gemini) errors.
            except (
                openai.BadRequestError,  # 400 (e.g. context too long)
                openai.AuthenticationError,  # 401
                openai.PermissionDeniedError,  # 403
                openai.NotFoundError,  # 404 (e.g. retired/unknown model)
                openai.UnprocessableEntityError,  # 422
            ) as e:
                logger.error(f"OpenAI API request failed with error: {e}.")
                raise e
            # Retry on specified errors
            except errors as e:
                # For certain types of errors that slip through here
                # (e.g. when using proxies like LiteLLM, do not retry)
                if any(
                    err in str(e)
                    for err in [
                        "BadRequestError",
                        "ConnectionError",
                        "NotFoundError",
                    ]
                ):
                    logger.error(f"OpenAI API request failed with error: {e}.")
                    raise e

                # Increment retries
                num_retries += 1

                # Check if max retries has been reached
                if num_retries > max_retries:
                    raise Exception(
                        f"Maximum number of retries ({max_retries}) exceeded."
                        f" Last error: {str(e)}."
                    )

                # Increment the delay
                delay *= exponential_base * (1 + jitter * random.random())
                logger.warning(
                    f"""OpenAI API request failed with error{e}. 
                    Retrying in {delay} seconds..."""
                )
                # Sleep for the delay, without blocking the event loop
                await asyncio.sleep(delay)

            # Raise exceptions for any errors not specified
            except Exception as e:
                raise e

    return wrapper

```

### Core Architecture Module: `langroid/parsing/pdf_utils.py`
```
import tempfile
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING, Any, BinaryIO, List, Optional, Tuple, Union

try:
    import fitz
except ImportError:
    if not TYPE_CHECKING:
        fitz = None

from langroid.exceptions import LangroidImportError

if fitz is None:
    raise LangroidImportError("fitz", ["pymupdf", "all", "pdf-parsers", "doc-chat"])


def pdf_split_pages(
    input_pdf: Union[BytesIO, BinaryIO, str],
    splits: Optional[List[int]] = None,
) -> Tuple[List[Path], TemporaryDirectory[Any]]:
    """Splits a PDF into individual pages or chunks in a temporary directory.

    Args:
        input_pdf: Input PDF file in bytes, binary mode, or a file path
        splits: Optional list of page numbers to split at.
                If provided, pages will be grouped into chunks ending at
                these page numbers.
                For example, if splits = [4, 9], the result will have pages 1-4, 5-9,
                and 10-end.
                If not provided, default to splitting into individual pages.
        max_workers: Maximum number of concurrent workers for parallel processing

    Returns:
        Tuple containing:
            - List of paths to individual PDF pages or chunks
            - Temporary directory object (caller must call cleanup())

    Example:
        paths, tmp_dir = split_pdf_temp("input.pdf")
        # Use paths...
        tmp_dir.cleanup()  # Clean up temp files when done
    """
    tmp_dir = tempfile.TemporaryDirectory()
    if isinstance(input_pdf, str):
        doc = fitz.open(input_pdf)
    else:
        doc = fitz.open(stream=input_pdf, filetype="pdf")
    paths = []

    total_pages = len(doc)

    if splits is None:
        # Split into individual pages (original behavior)
        for page_num in range(total_pages):
            new_doc = fitz.open()
            new_doc.insert_pdf(doc, from_page=page_num, to_page=page_num)
            output = Path(tmp_dir.name) / f"page_{page_num + 1}.pdf"
            new_doc.save(str(output))
            new_doc.close()
            paths.append(output)
    else:
        # Split according to specified page ranges
        # Make sure the splits list is sorted and includes all valid splits
        splits = sorted([s for s in splits if 1 <= s <= total_pages])

        # Create the ranges to process
        ranges = []
        start_page = 0
        for end_page in splits:
            ranges.append((start_page, end_page - 1))
            start_page = end_page

        # Add the final range if there are pages after the last split
        if start_page < total_pages:
            ranges.append((start_page, total_pages - 1))

        # Process each range
        for i, (from_page, to_page) in enumerate(ranges):
            new_doc = fitz.open()
            new_doc.insert_pdf(doc, from_page=from_page, to_page=to_page)
            output = Path(tmp_dir.name) / f"pages_{from_page + 1}_to_{to_page + 1}.pdf"
            new_doc.save(str(output))
            new_doc.close()
            paths.append(output)

    doc.close()
    return paths, tmp_dir

```

### Core Architecture Module: `langroid/parsing/utils.py`
```
import difflib
import logging
import random
import re
from functools import cache
from itertools import islice
from typing import Iterable, List, Sequence, TypeVar

from faker import Faker

from langroid.mytypes import Document
from langroid.parsing.document_parser import DocumentType
from langroid.parsing.parser import Parser, ParsingConfig
from langroid.parsing.repo_loader import RepoLoader
from langroid.parsing.url_loader import URLLoader
from langroid.parsing.urls import get_urls_paths_bytes_indices

Faker.seed(23)
random.seed(43)

logger = logging.getLogger(__name__)


def download_nltk_resource(resource: str) -> None:
    import nltk

    @cache
    def _download() -> None:
        try:
            nltk.data.find(resource)
        except LookupError:
            model = resource.split("/")[-1]
            nltk.download(model, quiet=True)

    _download()


T = TypeVar("T")


def batched(iterable: Iterable[T], n: int) -> Iterable[Sequence[T]]:
    """Batch data into tuples of length n. The last batch may be shorter."""
    # batched('ABCDEFG', 3) --> ABC DEF G
    if n < 1:
        raise ValueError("n must be at least one")
    it = iter(iterable)
    while batch := tuple(islice(it, n)):
        yield batch


def generate_random_sentences(k: int) -> str:
    # Load the sample text
    import nltk
    from nltk.corpus import gutenberg

    download_nltk_resource("corpora/gutenberg")
    download_nltk_resource("tokenizers/punkt")

    text = gutenberg.raw("austen-emma.txt")

    # Split the text into sentences
    sentences = nltk.tokenize.sent_tokenize(text)

    # Generate k random sentences
    random_sentences = random.choices(sentences, k=k)
    return " ".join(random_sentences)


def generate_random_text(num_sentences: int) -> str:
    fake = Faker()
    text = ""
    for _ in range(num_sentences):
        text += fake.sentence() + " "
    return text


def closest_string(query: str, string_list: List[str]) -> str:
    """Find the closest match to the query in a list of strings.

    This function is case-insensitive and ignores leading and trailing whitespace.
    If no match is found, it returns 'No match found'.

    Args:
        query (str): The string to match.
        string_list (List[str]): The list of strings to search.

    Returns:
        str: The closest match to the query from the list, or 'No match found'
             if no match is found.
    """
    # Create a dictionary where the keys are the standardized strings and
    # the values are the original strings.
    str_dict = {s.lower().strip(): s for s in string_list}

    # Standardize the query and find the closest match in the list of keys.
    closest_match = difflib.get_close_matches(
        query.lower().strip(), str_dict.keys(), n=1
    )

    # Retrieve the original string from the value in the dictionary.
    original_closest_match = (
        str_dict[closest_match[0]] if closest_match else "No match found"
    )

    return original_closest_match


def split_paragraphs(text: str) -> List[str]:
    """
    Split the input text into paragraphs using "\n\n" as the delimiter.

    Args:
        text (str): The input text.

    Returns:
        list: A list of paragraphs.
    """
    # Split based on a newline, followed by spaces/tabs, then another newline.
    paras = re.split(r"\n[ \t]*\n", text)
    return [para.strip() for para in paras if para.strip()]


def split_newlines(text: str) -> List[str]:
    """
    Split the input text into lines using "\n" as the delimiter.

    Args:
        text (str): The input text.

    Returns:
        list: A list of lines.
    """
    lines = re.split(r"\n", text)
    return [line.strip() for line in lines if line.strip()]


def number_segments(s: str, granularity: int = 1) -> str:
    """
    Number the segments in a given text, preserving paragraph structure.
    A segment is a sequence of `len` consecutive "sentences", where a "sentence"
    is either a normal sentence, or if there isn't enough punctuation to properly
    identify sentences, then we use a pseudo-sentence via heuristics (split by newline
    or failing that, just split every 40 words). The goal here is simply to number
    segments at a reasonable granularity so the LLM can identify relevant segments,
    in the RelevanceExtractorAgent.

    Args:
        s (str): The input text.
        granularity (int): The number of sentences in a segment.
            If this is -1, then the entire text is treated as a single segment,
            and is numbered as <#1#>.

    Returns:
        str: The text with segments numbered in the style <#1#>, <#2#> etc.

    Example:
        >>> number_segments("Hello world! How are you? Have a good day.")
        '<#1#> Hello world! <#2#> How are you? <#3#> Have a good day.'
    """
    import nltk

    if granularity < 0:
        return "<#1#> " + s
    numbered_text = []
    count = 0

    paragraphs = split_paragraphs(s)
    for paragraph in paragraphs:
        sentences = nltk.sent_tokenize(paragraph)
        # Some docs are problematic (e.g. resumes) and have no (or too few) periods,
        # so we can't split usefully into sentences.
        # We try a series of heuristics to split into sentences,
        # until the avg num words per sentence is less than 40.
        avg_words_per_sentence = sum(
            len(nltk.word_tokenize(sentence)) for sentence in sentences
        ) / len(sentences)
        if avg_words_per_sentence > 40:
            sentences = split_newlines(paragraph)
        avg_words_per_sentence = sum(
            len(nltk.word_tokenize(sentence)) for sentence in sentences
        ) / len(sentences)
        if avg_words_per_sentence > 40:
            # Still too long, just split on every 40 words
            sentences = []
            for sentence in nltk.sent_tokenize(paragraph):
                words = nltk.word_tokenize(sentence)
                for i in range(0, len(words), 40):
                    # if there are less than 20 words left after this,
                    # just add them to the last sentence and break
                    if len(words) - i < 20:
                        sentences.append(" ".join(words[i:]))
                        break
                    else:
                        sentences.append(" ".join(words[i : i + 40]))
        for i, sentence in enumerate(sentences):
            num = count // granularity + 1
            number_prefix = f"<#{num}#>" if count % granularity == 0 else ""
            sentence = f"{number_prefix} {sentence}"
            count += 1
            sentences[i] = sentence
        numbered_paragraph = " ".join(sentences)
        numbered_text.append(numbered_paragraph)

    return "  \n\n  ".join(numbered_text)


def number_sentences(s: str) -> str:
    return number_segments(s, granularity=1)


def parse_number_range_list(specs: str) -> List[int]:
    """
    Parse a specs string like "3,5,7-10" into a list of integers.

    Weak LLMs sometimes emit messy specs. Rather than raising, such fragments
    are skipped so the well-formed part of the spec is still honored:

    - A fragment with no digits at all (a trailing comma, an empty entry, a
      lone hyphen) refers to no segment, so nothing is lost and it is skipped
      quietly.
    - A fragment that does contain digits but is not a valid spec (``"1-"``,
      ``"-5"``, ``"1-2-3"``) drops a segment reference the model meant to make,
      so it is skipped *and* logged at WARNING.

    Args:
        specs (str): A string containing segment numbers and/or ranges
                     (e.g., "3,5,7-10").

    Returns:
        List[int]: List of segment numbers.

    Example:
        >>> parse_number_range_list("3,5,7-10")
        [3, 5, 7, 8, 9, 10]
    """
    spec_indices = set()  # type: ignore
    skipped: List[str] = []
    for original in specs.split(","):
        # some weak LLMs may generate <#1#> instead of 1, so extract just the digits
        # or the "-"
        part = "".join(char for char in original if char.isdigit() or char == "-")
        if not any(char.isdigit() for char in part):
            # no digits at all, e.g. from a trailing comma or one or more
            # stray hyphens: this refers to no segment, so nothing is lost
            # -- skip quietly
            continue
        if "-" in part:
            endpoints = part.split("-")
            # a well-formed range has exactly two integer endpoints
            if len(endpoints) != 2 or endpoints[0] == "" or endpoints[1] == "":
                skipped.append(original)
                continue
            spec_indices.update(range(int(endpoints[0]), int(endpoints[1]) + 1))
        else:
            spec_indices.add(int(part))

    if skipped:
        logger.warning(
            "parse_number_range_list: skipped malformed segment spec(s) %s "
            "in %r; returning only the well-formed segments %s",
            skipped,
            specs,
            sorted(spec_indices),
        )
    return sorted(list(spec_indices))


def strip_k(s: str, k: int = 2) -> str:
    """
    Strip any leading and trailing whitespaces from the input text beyond length k.
    This is useful for removing leading/trailing whitespaces from a text while
    preserving paragraph structure.

    Args:
        s (str): The input text.
        k (int): The number of leading and trailing whitespaces to retain.

    Returns:
        str: The text with leading and trailing whitespaces removed beyond length k.
    """

    # Count leading and trailing whitespaces
    leading_count = len(s) - len(s.lstrip())
    trailing_count = len(s) - len(s.rstrip())

    # Determine how many whitespaces to retain
    leading_keep = min(leading_count, k)
    trailing_keep = min(trailing_count, k)

    # Use slicing to get the desired output
    return s[leading_count - leading_keep : len(s) - (trailing_count - trailing_keep)]


def clean_whitespace(text: str) -> str:
    """Remove extra whitespace from the input text, while preserv
```

### Core Architecture Module: `langroid/utils/__init__.py`
```
from . import configuration
from . import globals
from . import constants
from . import logging
from . import pydantic_utils
from . import system
from . import output
from . import object_registry

__all__ = [
    "configuration",
    "globals",
    "constants",
    "logging",
    "pydantic_utils",
    "system",
    "output",
    "object_registry",
]

```

### Core Architecture Module: `langroid/utils/algorithms/__init__.py`
```
from . import graph

__all__ = ["graph"]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #756** (2025-03-09): **Pdf (and other) parsing: metadata should use true page number from doc, not what came from page-splitting**
  *Symptoms*: e.g. some books may contain some bunch of non-numbered pages, followed by (i), (ii), etc, then numbering starts at physical page 10.   When splitting into pages, we create a `Document` object for each page, containing `DocMetadata` where there is a "page number" but this is a physical page number based on the page-splitting, so when `DocChatAgent` cites a reference as "page 20", it is referring to physical page 20, but the actual numbered page could be 10. 

- **Issue #328** (2024-01-11): **import langroid as lr: using lr.* causes mypy errors**
  *Symptoms*: After doing ``` import langroid as lr ``` if we use `lr.*` within code, mypy complains with errors like  ``` module ChatAgent does not explicitly export ... ```  Will be good to see if there's a way to have mypy ignore these, or some other fix.  

- **Issue #231** (2023-08-31): **Bug: DocChatAgent not using stand-alone query**
  *Symptoms*: In a multi-round dialog, although we are converting the curr query  to a stand-alone query (via the LLM), we are not actually using this when generating the final answer. 
  **Post-Mortem & Fix Analysis**:
  > fixed in PR #232 

- **Issue #221** (2023-08-24): **DocChatAgent should take message history into account, for relevant doc retrieval**
  *Symptoms*: DocChatAgent currently gets relevant docs only based on query, ignores history.  We need to modify `get_relevant_extract(query)` so it applies `standalone_query = followup_to_standalone(... query)`, and  get relevant docs based on `standalone_query`. E.g. if there is a question, "Who is Charlie Chaplin?", followed by "What were his major movies?", currently doc retrieval for the second query is based only on `What were his major movies?`, which likely will not result in good retrieval. Instead, if we convert this to a standalone query, retrieval would be based on "What were Charlie Chaplin's major movies?" 

- **Issue #153** (2023-07-19): **fix occasional pytest failure on `test_vector_stores`**
  *Symptoms*: This failure happens once in a while. Investigate and fix.  ``` =================================== FAILURES =================================== __________________________ test_vector_stores[vecdb1] __________________________  vecdb = <langroid.vector_store.qdrantdb.QdrantDB object at 0x7fe976d89d10>      @pytest.mark.parametrize("vecdb", generate_vecdbs(openai_cfg))     def test_vector_stores(vecdb: Union[ChromaDB, QdrantDB]):         docs = [             Document(content="hello", metadata=DocMetaData(id=1)),             Document(content="world", metadata=DocMetaData(id=2)),             Document(content="hi there", metadata=DocMetaData(id=3)),         ] >       vecdb.add_documents(docs)  tests/main/test_vector_stores.py:62:  _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _  langroid/vector_store/qdrantdb.py:148: in add_documents     self.client.upsert( .venv/lib/python3.11/site-packages/qdrant_client/qdrant_client.py:748: in upsert     return self._client.upsert( .venv/lib/python3.11/site-packages/qdrant_client/qdrant_remote.py:1085: in upsert     http_result = self.openapi_client.points_api.upsert_points( .venv/lib/python3.11/site-packages/qdrant_client/http/api/points_api.py:12[42](https://github.com/langroid/langroid/actions/runs/5582569002/jobs/10201984745#step:6:43): in upsert_points     return self._build_for_upsert_points( .venv/lib/python3.11/site-packages/qdrant_client/http/api/points_api.py:668: in _build_fo
  **Post-Mortem & Fix Analysis**:
  > Possibly addressed by #154  , will revisit if test continues to fail. The failure appears to be when using `qdrant` in local-storage mode.
  > closing since this seems to have fixed it

- **Issue #114** (2023-06-27): **task.py block should be disabled after first try**
  *Symptoms*: A sub-task may return a result ChatDocument where the metadata.block specifies an entity that should be blocked from responding to the message (in the parent task).  E.g. message_validator may add a recipient when LLM msg omitted a recipient, and then set block = LLM. However the block should only apply for the first attempt by the entity.   
  **Post-Mortem & Fix Analysis**:
  > done in PR #117 and improved in #119 

- **Issue #80** (2023-07-10): **Rate limit error **
  *Symptoms*: Probably we need to count for this issue  ![image](https://github.com/langroid/llmagent/assets/15859139/a14dc270-683a-4913-bc6e-7a4a5cb25401) 
  **Post-Mortem & Fix Analysis**:
  > 1 line fix, pushed

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

### Incident Patch 1: `fc16e7e7` (2026-10-05)
**Commit Message**: ci: keep the quick gate keyless by skipping the two import-time LLM modules (#1187)

#1186 put a cheap `quick` gate in front of the paid suite and made the paid
job `needs: quick`. The gate's first step is `pytest tests/main
--collect-only`, and --collect-only executes module-level code. Two modules
need credentials at import, so collection cannot succeed without them, and
the job (correctly) carries no keys at all:

  test_retriever_agent.py:100      agent.ingest() over 101 docs
  test_tool_messages_azure.py:82   builds an Azure agent

Run 37327406478 on main is the result: "2 errors during collection", quick
red in 7 minutes, paid job skipped for unsatisfied `needs`. The suite was
fully DARK and the release gate could never go green -- a red gate, not a
passing one.

Fix: skip exactly those two modules in the collect step and leave the job
keyless. Feeding the gate real credentials is the worse trade. It needs
OPENAI_KEY *and* Azure credentials present (azure_openai.py:102-113 raises
on an empty AZURE_OPENAI_API_KEY / AZURE_OPENAI_API_BASE, and is reached
only after the OpenAI client is built, so OPENAI_KEY alone would not even
fix collection), and it buys that coverage by making

**File**: `.github/workflows/pytest.yml` (modified, +22/-1)
```diff
@@ -70,10 +70,31 @@ jobs:
             --extra fastembed \
             --extra crawl4ai
           
+      # This job deliberately has NO API keys: a gate standing in front of a
+      # paid suite should be hermetic. But --collect-only executes
+      # module-level code, and two modules need real credentials at import,
+      # so they cannot be collected keyless and are skipped here by name:
+      #   test_retriever_agent.py:100      agent.ingest() over 101 docs
+      #   test_tool_messages_azure.py:82   builds an Azure agent
+      # Feeding this job real credentials instead is the worse trade. It needs
+      # OPENAI_KEY *and* Azure credentials present -- azure_openai.py:102-113
+      # raises on an empty AZURE_OPENAI_API_KEY / AZURE_OPENAI_API_BASE, and
+      # is reached only after the OpenAI client is built, so OPENAI_KEY alone
+      # would not even fix collection. And it buys that coverage by making the
+      # cheap gate embed those 101 docs for real: one batched request at the
+      # default batch_size of 512. That puts the OpenAI API on the release
+      # path, where a 401 or an outage would block releases for reasons that
+      # have nothing to do with the tree. (The Azure keys are only read, not
+      # called, at import -- it is the embedding request that goes out.)
+      # Cost of the skip: the 21 parametrized cases in these two files get
+      # their imports checked by the paid job minutes later, not here.
       - name: Collect every test (catches import and collection errors)
         env:
           PYTEST_ADDOPTS: "-p no:logging"
-        run: uv run pytest tests/main --collect-only -q --ct fakeredis
+        run: |
+          uv run pytest tests/main --collect-only -q --ct fakeredis \
+            --ignore=tests/main/test_retriever_agent.py \
+            --ignore=tests/main/test_tool_messages_azure.py
       - name: Run the tests that need no LLM
         env:
           PYTEST_ADDOPTS: "-p no:logging"
```

---

### Incident Patch 2: `877ece41` (2026-10-05)
**Commit Message**: ci: run the paid suite per release, not per push, behind a cheap gate (#1186)

* ci: run the paid suite per release, not per push, behind a cheap gate

Pass 1 runs the WHOLE suite against a real LLM for ~50 minutes and bills
Prasad's own OpenAI key. It fired on every merge to main: three full runs
in two days (10-04, 10-05 00:41, 10-05 11:43), one per ship, when one per
RELEASE is what is needed. His balance auto-topped-up $15 three times.

- Drop the push trigger. `ops ship` now dispatches this workflow with
  `gh workflow run Pytest --ref main`, confirms a run exists for the head,
  and waits for it, so the release gate is unchanged. A 09:17 UTC nightly
  run keeps main honest between releases.
- Add a `quick` job the paid `pytest` job now `needs`: collect every test
  (catches import and collection errors) and run the tests that need no
  LLM. The 10-05 11:43 run spent the full 50 minutes and then failed on
  six MOCKED tests; this catches that class in ~2 minutes. It installs the
  same extras as the paid job, because with core-only deps collection
  fails on missing optional imports and the gate would cry wolf.

Caching was NOT the problem: REDIS_HOST/PASSWORD/PORT are configu

**File**: `.github/workflows/pytest.yml` (modified, +74/-8)
```diff
@@ -1,13 +1,19 @@
 name: Pytest
 
 on:
-  push:
-    paths:
-      - "langroid/**"
-      - "tests/**"
-      - ".github/workflows/pytest.yml"
-    branches:
-      - main
+  # NO push trigger. Pass 1 runs the WHOLE suite against a real LLM for ~50
+  # minutes and bills Prasad's own key, and it fired on every merge to main:
+  # three full runs in two days on 2026-10-04/05, one per ship, when one per
+  # RELEASE is what is actually needed. `ops ship` now dispatches this
+  # workflow explicitly and waits for it, so the release gate is unchanged.
+  # A WEEKLY run keeps main honest between releases. Deliberately not daily:
+  # main is unchanged on roughly three days in four (23 distinct commit-days
+  # in the last 90), so a daily cron would fire ~90 paid runs per 90 days
+  # against a mostly-unchanged tree -- MORE than the ~28 the push trigger
+  # produced, i.e. the opposite of this change's purpose. Every release
+  # dispatches a run anyway, so this cron is a backstop, not the main signal.
+  schedule:
+    - cron: "17 9 * * 1"  # 09:17 UTC Mondays
   # NO pull_request trigger. `ready_for_review` used to fire the whole suite,
   # so marking a draft ready cost a full run and merging it cost another
   # (#1169 on 2026-10-02 did exactly that). Opening a non-draft PR never
@@ -20,6 +26,65 @@ on:
 
 
 jobs:
+  # Two-minute gate in front of the paid suite. On 2026-10-05 a run spent the
+  # full 50 minutes and then failed on six MOCKED tests -- a collection error
+  # or a broken no-LLM test should never cost an LLM suite to discover.
+  quick:
+    if: "contains(github.event.head_commit.message, 'notest') == false"
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-python@v5
+        with:
+          python-version: "3.11"
+      - uses: astral-sh/setup-uv@v5
+        with:
+          enable-cache: true
+          cache-dependency-glob: "uv.lock"
+      # Same extras as the paid job: with core-only deps, collection fails on
+      # missing optional imports (fitz, sqlalchemy, neo4j, arango) and the gate
+      # would cry wolf. Installing costs Actions minutes, not LLM calls.
+      - name: Install project dependencies with uv
+        run: |
+          uv sync --dev \
+            --extra neo4j \
+            --extra arango \
+            --extra lancedb \
+            --extra meilisearch \
+            --extra chromadb \
+            --extra docling \
+            --extra litellm \
+            --extra pymupdf4llm \
+            --extra weaviate \
+            --extra pinecone \
+            --extra milvus \
+            --extra postgres\
+            --extra hf-embeddings \
+            --extra unstructured \
+            --extra pdf-parsers \
+            --extra docx \
+            --extra sql \
+            --extra exa \
+            --extra tavily \
+            --extra firecrawl \
+            --extra fastembed \
+            --extra crawl4ai
+          
+      - name: Collect every test (catches import and collection errors)
+        env:
+          PYTEST_ADDOPTS: "-p no:logging"
+        run: uv run pytest tests/main --collect-only -q --ct fakeredis
+      - name: Run the tests that need no LLM
+        env:
+          PYTEST_ADDOPTS: "-p no:logging"
+        run: |
+          uv run pytest -q --ct fakeredis \
+            tests/main/test_model_info.py \
+            tests/main/test_vertexai_isolation.py \
+            tests/main/test_vertexai_routing.py \
+            tests/main/test_global_settings.py \
+            tests/main/test_graph.py
+
   cancel:
     if: "contains(github.event.head_commit.message, 'notest') == false"
     name: Cancel Previous Runs
@@ -31,7 +96,8 @@ jobs:
         with:
           access_token: ${{ github.token }}
   pytest:
-    if: "contains(github.event.head_commit.message, 'notest') == false"    
+    needs: quick
+    if: "contains(github.event.head_commit.message, 'notest') == false"
     runs-on: ubuntu-latest
     services:
       meilisearch:
```

---

### Incident Patch 3: `b472a9c0` (2026-10-05)
**Commit Message**: fix(llm): retire Haiku 3, add Haiku 4.5, resolve dated snapshots (#1184)

* fix(llm): retire Haiku 3, add Haiku 4.5, resolve dated snapshots

Anthropic retired claude-3-haiku-20240307 on 2026-04-20 and emailed that
requests were still failing with not_found_error. PR #1169 replaced the
Haiku 3.5 ids but explicitly left Haiku 3 out of scope; this finishes it.

- Replace all 14 claude-3-haiku-20240307 references (tests, Portkey
  examples, portkey docs) with claude-haiku-4-5-20251001.
- Add a ModelInfo entry for claude-haiku-4-5: 200K context, 64K output,
  $1/$5 per MTok. The enum member existed with no entry, so the model
  #1169 migrated TO was resolving to the 16K unknown-model fallback, and
  its context-length checks were wrong.
- Resolve DATED SNAPSHOTS of known models generally, rather than adding
  a row per release: strip a trailing -YYYYMMDD or -YYYY-MM-DD and look
  up the base. Conservative by construction — anchored ASCII regex with
  month/day ranges, and the stripped name is only a candidate, kept only
  if that base model is already known. So gpt-4o-2024-08-06 and
  claude-haiku-4-5-20251001 now inherit correctly, while
  some-new-model-20260101 still warns instead o

**File**: `docs/notes/portkey.md` (modified, +3/-3)
```diff
@@ -120,7 +120,7 @@ Configure automatic retries for better reliability:
 
 ```python
 config = lm.OpenAIGPTConfig(
-    chat_model="portkey/anthropic/claude-3-haiku-20240307",
+    chat_model="portkey/anthropic/claude-haiku-4-5-20251001",
     portkey_params=PortkeyParams(
         retry={
             "max_retries": 3,
@@ -211,7 +211,7 @@ Portkey supports 200+ models from various providers. Common ones include:
 
 # Anthropic
 "portkey/anthropic/claude-3-5-sonnet-20241022"
-"portkey/anthropic/claude-3-haiku-20240307"
+"portkey/anthropic/claude-haiku-4-5-20251001"
 
 # Google
 "portkey/google/gemini-2.0-flash-lite"
@@ -263,7 +263,7 @@ Use multiple providers for reliability:
 ```python
 providers = [
     ("openai", "gpt-4o-mini"),
-    ("anthropic", "claude-3-haiku-20240307"),
+    ("anthropic", "claude-haiku-4-5-20251001"),
     ("google", "gemini-2.0-flash-lite")
 ]
 
```

**File**: `examples/portkey/portkey_basic_chat.py` (modified, +3/-1)
```diff
@@ -81,7 +81,9 @@ def main():
         print("✅ OpenAI API key found")
 
     if os.getenv("ANTHROPIC_API_KEY"):
-        providers_to_test.append(("Anthropic", "anthropic", "claude-3-haiku-20240307"))
+        providers_to_test.append(
+            ("Anthropic", "anthropic", "claude-haiku-4-5-20251001")
+        )
         print("✅ Anthropic API key found")
 
     if os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY"):
```

**File**: `examples/portkey/portkey_multi_provider.py` (modified, +2/-2)
```diff
@@ -123,7 +123,7 @@ def demonstrate_fallback_strategy(portkey_api_key: str):
     # Define providers in order of preference
     fallback_providers = [
         ("openai", "gpt-4o-mini", "OPENAI_API_KEY"),
-        ("anthropic", "claude-3-haiku-20240307", "ANTHROPIC_API_KEY"),
+        ("anthropic", "claude-haiku-4-5-20251001", "ANTHROPIC_API_KEY"),
         ("google", "gemini-2.0-flash-lite", "GOOGLE_API_KEY"),
     ]
 
@@ -177,7 +177,7 @@ def main():
     if os.getenv("ANTHROPIC_API_KEY"):
         try:
             llm, name = create_provider_llm(
-                "anthropic", "claude-3-haiku-20240307", portkey_api_key
+                "anthropic", "claude-haiku-4-5-20251001", portkey_api_key
             )
             providers.append((llm, name))
             print("✅ Anthropic provider ready")
```

**File**: `langroid/language_models/model_info.py` (modified, +70/-5)
```diff
@@ -1,5 +1,6 @@
 import logging
 import re
+from datetime import date
 from enum import Enum
 from typing import Dict, List, Optional
 
@@ -551,6 +552,16 @@ class ModelInfo(BaseModel):
         output_cost_per_million=15.0,
         description="Claude 3 Sonnet",
     ),
+    AnthropicModel.CLAUDE_4_5_HAIKU.value: ModelInfo(
+        name=AnthropicModel.CLAUDE_4_5_HAIKU.value,
+        provider=ModelProvider.ANTHROPIC,
+        context_length=200_000,
+        max_output_tokens=64_000,
+        input_cost_per_million=1.00,
+        cached_cost_per_million=0.10,
+        output_cost_per_million=5.00,
+        description="Claude Haiku 4.5",
+    ),
     AnthropicModel.CLAUDE_3_HAIKU.value: ModelInfo(
         name=AnthropicModel.CLAUDE_3_HAIKU.value,
         provider=ModelProvider.ANTHROPIC,
@@ -818,14 +829,68 @@ def _normalize_model_names(models: List[str | ModelName]) -> List[str]:
     normalized_models: List[str] = []
     seen: set[str] = set()
     for model in models:
-        normalized_model = _normalize_gemini_model_name(_model_name(model))
-        if normalized_model is None or normalized_model in seen:
-            continue
-        seen.add(normalized_model)
-        normalized_models.append(normalized_model)
+        name = _model_name(model)
+        for normalized_model in (
+            _normalize_gemini_model_name(name),
+            _strip_dated_snapshot(name),
+        ):
+            if normalized_model is None or normalized_model in seen:
+                continue
+            seen.add(normalized_model)
+            normalized_models.append(normalized_model)
     return normalized_models
 
 
+# A dated snapshot of a model we already know: "-20251001" (Anthropic) or
+# "-2024-08-06" (OpenAI), optionally behind a provider prefix. Providers ship
+# these constantly, and a hard-coded table cannot keep up — so strip the date
+# and let the caller look up the base name.
+#
+# `(?P=sep)` makes the two separators agree, so only those two real shapes
+# match; mixed forms like "-2024-0806" are not dates anyone ships.
+_DATED_SNAPSHOT_SUFFIX = re.compile(
+    r"-(?P<year>20[0-9]{2})(?P<sep>-?)(?P<month>[0-9]{2})(?P=sep)(?P<day>[0-9]{2})\Z"
+)
+
+
+def _strip_dated_snapshot(model: str) -> str | None:
+    """Return `model` without a trailing dated-snapshot stamp, else None.
+
+    Deliberately conservative in three ways. The pattern is anchored and
+    ASCII-only, both separators must agree, and the result must be a real
+    calendar date, so a lookalike tail is not mistaken for a date. Gemini
+    names are left alone: `_normalize_gemini_model_name` owns them and
+    deliberately refuses to guess a bare-dated name, and this helper must not
+    reverse that policy by the back door. And the result is only a CANDIDATE:
+    `get_model_info` looks it up and keeps it only if that base model is
+    already in `MODEL_INFO`, so an unknown `some-new-model-20260101` still
+    warns rather than silently inheriting another model's limits and prices.
+
+    Caveat, deliberately accepted: a snapshot inherits the metadata of the
+    BASE ALIAS, which is exact for context length and provider but only
+    approximate for the price and output cap of an OLD snapshot that the alias
+    has since moved past (`gpt-4o-2024-05-13` gets today's `gpt-4o` prices).
+    That is still strictly better than the unknown-model fallback it replaces,
+    which gave every snapshot a 16k context and zero cost.
+    """
+    base_model = model.rsplit("/", 1)[-1]
+    if base_model.startswith("gemini-"):
+        return None
+    match = _DATED_SNAPSHOT_SUFFIX.search(base_model)
+    if match is None:
+        return None
+    try:
+        date(
+            int(match.group("year")),
+            int(match.group("month")),
+            int(match.group("day")),
+        )
+    except ValueError:
+        return None  # e.g. "-2024-02-31": shaped like a date, is not one
+    candidate = base_model[: match.start()]
+    return candidate or None
+
+
 def _normalize_gemini_model_name(model: str) -> str | None:
     base_model = model.rsplit("/", 1)[-1]
     if base_model in GEMINI_CANONICAL_MODEL_NAMES:
```

**File**: `tests/main/test_llm.py` (modified, +4/-4)
```diff
@@ -359,8 +359,8 @@ def test_keys():
     [
         "langdb/gpt-4o-mini",
         "langdb/openai/gpt-4o-mini",
-        "langdb/anthropic/claude-3-haiku-20240307",
-        "langdb/claude-3-haiku-20240307",
+        "langdb/anthropic/claude-haiku-4-5-20251001",
+        "langdb/claude-haiku-4-5-20251001",
         "langdb/gemini/gemini-2.0-flash-lite",
         "langdb/gemini-2.0-flash-lite",
     ],
@@ -503,7 +503,7 @@ def test_portkey_integration():
     try:
         # Test basic portkey model configuration
         config = lm.OpenAIGPTConfig(
-            chat_model="portkey/anthropic/claude-3-haiku-20240307",
+            chat_model="portkey/anthropic/claude-haiku-4-5-20251001",
             portkey_params=PortkeyParams(
                 api_key="pk-test-key",
             ),
@@ -512,7 +512,7 @@ def test_portkey_integration():
         llm = lm.OpenAIGPT(config)
 
         # Check that model was parsed correctly
-        assert llm.config.chat_model == "claude-3-haiku-20240307"
+        assert llm.config.chat_model == "claude-haiku-4-5-20251001"
         assert llm.is_portkey
         assert llm.api_base == "https://api.portkey.ai/v1"
         assert llm.config.portkey_params.provider == "anthropic"
```

**File**: `tests/main/test_llm_async.py` (modified, +4/-4)
```diff
@@ -129,8 +129,8 @@ async def test_llm_async_concurrent(test_settings: Settings):
     [
         "langdb/gpt-4o-mini",
         "langdb/openai/gpt-4o-mini",
-        "langdb/anthropic/claude-3-haiku-20240307",
-        "langdb/claude-3-haiku-20240307",
+        "langdb/anthropic/claude-haiku-4-5-20251001",
+        "langdb/claude-haiku-4-5-20251001",
         "langdb/gemini/gemini-2.0-flash-lite",
         "langdb/gemini-2.0-flash-lite",
     ],
@@ -390,7 +390,7 @@ async def test_portkey_integration_async():
     try:
         # Test basic portkey model configuration
         config = lm.OpenAIGPTConfig(
-            chat_model="portkey/anthropic/claude-3-haiku-20240307",
+            chat_model="portkey/anthropic/claude-haiku-4-5-20251001",
             portkey_params=PortkeyParams(
                 api_key="pk-test-key",
             ),
@@ -399,7 +399,7 @@ async def test_portkey_integration_async():
         llm = lm.OpenAIGPT(config)
 
         # Check that model was parsed correctly
-        assert llm.config.chat_model == "claude-3-haiku-20240307"
+        assert llm.config.chat_model == "claude-haiku-4-5-20251001"
         assert llm.is_portkey
         assert llm.api_base == "https://api.portkey.ai/v1"
         assert llm.config.portkey_params.provider == "anthropic"
```

**File**: `tests/main/test_model_info.py` (modified, +93/-0)
```diff
@@ -3,8 +3,12 @@
 import pytest
 
 from langroid.language_models.model_info import (
+    AnthropicModel,
     GeminiModel,
+    ModelProvider,
     _normalize_gemini_model_name,
+    _strip_dated_snapshot,
+    get_model_info,
 )
 
 
@@ -104,3 +108,92 @@ def test_normalize_gemini_all_canonical_names_are_stable() -> None:
         assert (
             result == member.value
         ), f"Canonical name {member.value!r} normalized to {result!r}"
+
+
+@pytest.mark.parametrize(
+    "dated,base",
+    [
+        # Anthropic: -YYYYMMDD
+        ("claude-haiku-4-5-20251001", "claude-haiku-4-5"),
+        # OpenAI: -YYYY-MM-DD
+        ("gpt-4o-2024-08-06", "gpt-4o"),
+        # behind a provider prefix
+        ("anthropic/claude-haiku-4-5-20251001", "claude-haiku-4-5"),
+    ],
+)
+def test_dated_snapshot_resolves_to_base_model(dated: str, base: str):
+    """A dated snapshot of a KNOWN model inherits that model's info.
+
+    Providers ship dated snapshots constantly; a hard-coded table cannot keep
+    up, and the old behaviour silently gave them a 16k context.
+    """
+    base_info = get_model_info(base)
+    # Anchor the comparison: two UNKNOWN names both resolve to the same
+    # default ModelInfo, so comparing them alone would pass vacuously if the
+    # base entry were removed or renamed.
+    assert base_info.provider != ModelProvider.UNKNOWN
+    assert base_info.name == base
+    assert get_model_info(dated) == base_info
+
+
+@pytest.mark.parametrize(
+    "unknown",
+    [
+        "some-new-model-20260101",  # base is not a known model
+        "gpt-4o-2024-13-45",  # not a real date
+        "claude-haiku-4-5-2025100",  # too few digits
+        # Unicode digit lookalikes: Python's \d matches these, so a naive
+        # regex would strip "-20２4-08-06" and hand this ID gpt-4o's limits
+        # and prices. The digit classes are ASCII-only to prevent that.
+        "gpt-4o-20２４-08-06",  # fullwidth TWO, FOUR in the year
+        "gpt-4o-2024-08-1０",  # fullwidth ZERO in the day
+        # Shaped like a date but impossible, so not a snapshot of anything.
+        "gpt-4o-2024-02-31",  # February has no 31st
+        "gpt-4o-2023-02-29",  # 2023 is not a leap year
+        "gpt-4o-20240230",  # same, in the compact form
+        # Mixed separators: no provider ships these, so treating them as
+        # dates would only let malformed IDs inherit real prices.
+        "gpt-4o-2024-0806",
+        "gpt-4o-202408-06",
+    ],
+)
+def test_unknown_dated_model_does_not_borrow_info(unknown: str):
+    """Stripping a date must not GUESS: an unknown base stays unknown."""
+    info = get_model_info(unknown)
+    assert info.provider == ModelProvider.UNKNOWN
+    assert info.input_cost_per_million == 0.0
+
+
+def test_leap_day_snapshot_still_resolves():
+    """The calendar check must not reject a date that is real."""
+    assert get_model_info("gpt-4o-20240229") == get_model_info("gpt-4o")
+
+
+def test_dated_gemini_name_keeps_the_gemini_policy():
+    """The generic stripper must not override the Gemini normalizer.
+
+    `_normalize_gemini_model_name` deliberately refuses to guess a bare-dated
+    name (`gemini-2.5-pro-03-25` must not become `gemini-2.5-pro`). A generic
+    date-stripper that resolved `gemini-2.5-pro-2025-03-25` would reverse that
+    ruling by the back door -- and silently, since it also flips the model to
+    "known", which turns on `rename_params` and extra-body filtering.
+    """
+    assert _strip_dated_snapshot("gemini-2.5-pro-2025-03-25") is None
+    info = get_model_info("gemini-2.5-pro-2025-03-25")
+    assert info.provider == ModelProvider.UNKNOWN
+    # the canonical name is of course still resolved
+    assert get_model_info("gemini-2.5-pro").provider == ModelProvider.GOOGLE
+
+
+def test_haiku_4_5_cached_price_is_discounted():
+    """A cached read must not be billed at the full input rate.
+
+    `OpenAIGPT.chat_cost()` treats a zero `cached_cost_per_million` as
+    "missing" and falls back to `input_cost_per_million`, so leaving it unset
+    would overstate the cached portion of every Haiku 4.5 request by 10x.
+    """
+    info = get_model_info(AnthropicModel.CLAUDE_4_5_HAIKU)
+    assert info.input_cost_per_million == 1.00
+    assert info.cached_cost_per_million == 0.10
+    # and a dated snapshot inherits the discount
+    assert get_model_info("claude-haiku-4-5-20251001").cached_cost_per_million == 0.10
```

---

### Incident Patch 4: `d730212a` (2026-10-05)
**Commit Message**: chore(tests): cheap model by default, and no full suite on PR-ready (#1183) [notest]

* chore(tests): cheap model by default, and no full suite on PR-ready

Two sources of OpenAI spend that were not buying anything:

- tests/conftest.py defaulted --m to gpt-4o, so every local or
  agent-driven pytest run billed the strong model. This suite drives
  multi-agent pipelines with many calls per test; one investigation ran
  a single file ~8 times on that default. Default is now gpt-4o-mini.
  CI's bulk pass already passes --m explicitly, so it is unaffected, and
  the fallback ladder still escalates mini -> gpt-4o -> gemini-2-flash
  for tests marked 'fallback'.
- the workflow triggered on pull_request/ready_for_review, so marking a
  draft ready ran the whole suite and merging it ran it again (#1169 did
  exactly that). Opening a non-draft PR never triggered it anyway. The
  trigger is gone; workflow_dispatch replaces it for on-demand runs, and
  the gate that matters still runs on every push to main.

* ci: pin gpt-4o on the retry passes, and name the ref for manual runs

Both from review of this branch:

- the two retry steps omitted --m and relied on the conftest default
  being gpt

**File**: `.github/workflows/pytest.yml` (modified, +11/-7)
```diff
@@ -8,11 +8,15 @@ on:
       - ".github/workflows/pytest.yml"
     branches:
       - main
-  pull_request:
-    types:
-      - ready_for_review
-    branches:
-      - main
+  # NO pull_request trigger. `ready_for_review` used to fire the whole suite,
+  # so marking a draft ready cost a full run and merging it cost another
+  # (#1169 on 2026-10-02 did exactly that). Opening a non-draft PR never
+  # triggered this workflow anyway, so the signal lost is small, and the gate
+  # that matters runs on main below — `ops ship` refuses to release on red.
+  # Run it on a branch by hand when you want it:
+  #   gh workflow run Pytest --ref <branch>
+  # (without --ref, gh dispatches against the remote default branch).
+  workflow_dispatch:
 
 
 jobs:
@@ -242,7 +246,7 @@ jobs:
       env:
         PYTEST_ADDOPTS: "-p no:logging"
       run: |
-        uv run pytest --cov langroid --cov-append --cov-config .coveragerc \
+        uv run pytest --m gpt-4o --cov langroid --cov-append --cov-config .coveragerc \
           -rf -vv --log-cli-level=INFO --show-capture=no \
           -n auto --timeout=300 \
           --first-test-file=tests/main/sql_chat/test_sql_chat_agent.py \
@@ -262,7 +266,7 @@ jobs:
       env:
         PYTEST_ADDOPTS: "-p no:logging"
       run: |
-        uv run pytest --nc --cov langroid --cov-append --cov-config .coveragerc \
+        uv run pytest --m gpt-4o --nc --cov langroid --cov-append --cov-config .coveragerc \
           --junitxml=test-results.xml \
           -rf --show-capture=no --timeout=300 -n auto \
           --first-test-file=tests/main/sql_chat/test_sql_chat_agent.py \
```

**File**: `tests/conftest.py` (modified, +8/-1)
```diff
@@ -40,7 +40,14 @@ def pytest_addoption(parser) -> None:
     parser.addoption("--ct", default="redis", help="redis, fakeredis")
     parser.addoption(
         "--m",
-        default=OpenAIChatModel.GPT4o,
+        # Cheap by default: every local or agent-driven `pytest` run bills a
+        # real key, and this suite drives multi-agent pipelines with many
+        # calls per test. An investigation on 2026-10-04 ran one file ~8 times
+        # on the old gpt-4o default and was a visible share of a $45 / 3-day
+        # OpenAI bill. CI's bulk pass passes `--m` explicitly anyway; pass
+        # `--m gpt-4o` (or any model) when a test genuinely needs a stronger
+        # one.
+        default=OpenAIChatModel.GPT4o_MINI,
         help="""
         language model name, e.g. litellm/ollama/llama2, or 
         local or localhost:8000 or localhost:8000/v1
```

---

### Incident Patch 5: `4735083c` (2026-10-05)
**Commit Message**: fix: stringify DataFrames with duplicate column names (#1179) [notest]

Co-authored-by: zjp <你的邮箱>

**File**: `langroid/utils/pandas_utils.py` (modified, +12/-8)
```diff
@@ -358,14 +358,18 @@ def stringify(x: Any) -> str:
         df = x.head(10).copy()
 
     # Truncate long text columns to 1000 characters
-    for col in df.columns:
-        if df[col].dtype == object:
-            df[col] = df[col].apply(
-                lambda item: (
-                    (item[:1000] + "...")
-                    if isinstance(item, str) and len(item) > 1000
-                    else item
-                )
+    for position in range(df.shape[1]):
+        column = df.iloc[:, position]
+        if column.dtype == object:
+            df.isetitem(
+                position,
+                column.apply(
+                    lambda item: (
+                        (item[:1000] + "...")
+                        if isinstance(item, str) and len(item) > 1000
+                        else item
+                    )
+                ),
             )
 
     # Convert to string
```

**File**: `tests/main/test_pandas_utils.py` (modified, +17/-0)
```diff
@@ -180,6 +180,23 @@ def test_benign_expressions_still_work_via_safe_eval_globals(expr, expected):
     assert _eval_via_safe_globals(expr) == expected
 
 
+@pytest.mark.parametrize(
+    "values, expected",
+    [
+        ([["long" * 251, "right"]], "long" * 250 + "..."),
+        ([["left", 7]], "left"),
+    ],
+    ids=["truncates_duplicate_text_columns", "preserves_duplicate_mixed_columns"],
+)
+def test_stringify_handles_duplicate_column_names(values, expected):
+    """Stringify each column by position so duplicate labels stay valid."""
+    frame = pd.DataFrame(values, columns=["duplicate", "duplicate"])
+
+    result = stringify(frame)
+
+    assert expected in result
+
+
 @pytest.mark.parametrize("copy_on_write", [False, True])
 @pytest.mark.parametrize("as_series", [False, True])
 def test_stringify_preserves_tabular_input(
```

---

### Incident Patch 6: `ea139fb7` (2026-10-05)
**Commit Message**: fix(lance-rag): address the query-plan answer to the Critic explicitly (#1182)

The 3-agent LanceRAG pipeline only worked by accident. answer_tool
returned its QueryPlanAnswerTool with no recipient, so Task.step offered
the turn to the planner's OWN LLM before the Critic sub-task. That reply
is accepted whenever it is non-null, and because llm_response sets
expecting_query_plan unconditionally, the LLM simply emits another
query_plan. The Critic then never receives the answer,
query_plan_feedback never fires, and the task spins until the inf-loop
guard or max_turns, where Task.result() returns None.

Naming the Critic makes _recipient_mismatch skip our own LLM, so the
handoff is deterministic on any model. Also pass name=critic_name to the
Critic Task, since that coupling is now load-bearing rather than dead
config.

Evidence: with the old code an instrumented gpt-4o run did 71 LanceRAG
round-trips and reached the Critic once, content-less;
test_lance_doc_chat_df_direct failed (InfiniteLoopException locally,
MAX_TURNS in CI) and had done so since at least 2026-08-22, passing only
on gpt-4.1. With the fix the whole file is 3 passed / 3 xfailed / 14
xpassed with caching off. Adds a n

**File**: `langroid/agent/special/lance_rag/lance_rag_task.py` (modified, +3/-0)
```diff
@@ -69,6 +69,9 @@ def new(
         critic_agent = QueryPlanCritic(critic_config)
         critic_task = Task(
             critic_agent,
+            # the planner addresses its QueryPlanAnswerTool to this name, so
+            # the task name and `critic_name` must agree
+            name=critic_name,
             interactive=False,
         )
         rag_task = Task(
```

**File**: `langroid/agent/special/lance_rag/query_planner_agent.py` (modified, +18/-3)
```diff
@@ -231,17 +231,32 @@ def query_plan_feedback(self, msg: QueryPlanFeedbackTool) -> str | AgentDoneTool
         SUGGESTED FIX: {suggested}
         """
 
-    def answer_tool(self, msg: AnswerTool) -> QueryPlanAnswerTool:
+    def answer_tool(self, msg: AnswerTool) -> ChatDocument:
         """Handle AnswerTool received from LanceRagAgent:
-        Construct a QueryPlanAnswerTool with the answer"""
+        Construct a QueryPlanAnswerTool with the answer, addressed to the Critic.
+
+        The recipient is explicit on purpose. Returning the tool bare leaves it
+        with no addressee, and `Task.step` then offers the turn to THIS agent's
+        own LLM before the Critic sub-task. That reply is accepted when it is
+        non-null, and since `llm_response` above sets `expecting_query_plan`
+        unconditionally, the LLM is told to produce a query plan again: it
+        emits a duplicate `query_plan`, the Critic never receives the answer,
+        `query_plan_feedback` never arrives, and the task spins until the
+        inf-loop guard or max_turns (`Task.result()` then returns None).
+        Naming the Critic makes `_recipient_mismatch` skip our own LLM, so the
+        handoff is deterministic on any model.
+        """
         self.result = msg.answer  # save answer to interpret feedback later
         assert self.curr_query_plan is not None
         query_plan_answer_tool = QueryPlanAnswerTool(
             plan=self.curr_query_plan,
             answer=msg.answer,
         )
         self.curr_query_plan = None  # reset
-        return query_plan_answer_tool
+        return self.create_agent_response(
+            recipient=self.config.critic_name,
+            tool_messages=[query_plan_answer_tool],
+        )
 
     def handle_message_fallback(
         self, msg: str | ChatDocument
```

**File**: `tests/main/test_lance_doc_chat_agent.py` (modified, +43/-1)
```diff
@@ -5,7 +5,16 @@
 from langroid.agent.special.doc_chat_agent import DocChatAgentConfig
 from langroid.agent.special.lance_doc_chat_agent import LanceDocChatAgent
 from langroid.agent.special.lance_rag.lance_rag_task import LanceRAGTaskCreator
-from langroid.agent.special.lance_tools import AnswerTool, QueryPlan, QueryPlanTool
+from langroid.agent.special.lance_rag.query_planner_agent import (
+    LanceQueryPlanAgent,
+    LanceQueryPlanAgentConfig,
+)
+from langroid.agent.special.lance_tools import (
+    AnswerTool,
+    QueryPlan,
+    QueryPlanAnswerTool,
+    QueryPlanTool,
+)
 from langroid.agent.tools.orchestration import AgentDoneTool
 from langroid.embedding_models.models import OpenAIEmbeddingsConfig
 from langroid.mytypes import DocMetaData, Document
@@ -362,3 +371,36 @@ def test_lance_doc_chat_df_direct(test_settings: Settings):
     )
     # check there is non-empty response content
     assert result is not None and len(result.content) > 10
+
+
+def test_answer_tool_addresses_the_critic():
+    """The planner must ADDRESS its QueryPlanAnswerTool to the Critic.
+
+    Returned without a recipient, the tool reaches `Task.step` unaddressed and
+    the planner's own LLM is offered the turn ahead of the Critic sub-task.
+    That reply is accepted when non-null, and because `llm_response` sets
+    `expecting_query_plan` unconditionally the LLM just emits another
+    `query_plan`: the Critic never gets the answer, `query_plan_feedback`
+    never fires, and the task spins to the inf-loop guard or max_turns, where
+    `Task.result()` is None. No LLM is needed to pin the routing.
+    """
+    config = LanceQueryPlanAgentConfig(
+        critic_name="QueryPlanCritic",
+        doc_agent_name="LanceRAG",
+        doc_schema="",
+    )
+    agent = LanceQueryPlanAgent(config)
+    agent.curr_query_plan = QueryPlan(
+        original_query="which 2023 issues mention JSON?",
+        query="2023 issues mentioning JSON",
+    )
+
+    response = agent.answer_tool(AnswerTool(answer="Issue #42 mentions JSON."))
+
+    assert response.metadata.recipient == config.critic_name
+    tools = response.tool_messages
+    assert len(tools) == 1 and isinstance(tools[0], QueryPlanAnswerTool)
+    assert tools[0].answer == "Issue #42 mentions JSON."
+    # bookkeeping the feedback round depends on
+    assert agent.result == "Issue #42 mentions JSON."
+    assert agent.curr_query_plan is None
```

---

### Incident Patch 7: `5a2e5b10` (2026-10-04)
**Commit Message**: fix: honor match_domain in find_urls, without dropping the scheme filter (#1180)

* fix: honor match_domain in find_urls, without dropping the scheme filter

find_urls(match_domain=False) discarded off-domain links anyway, because the
domain filter was applied unconditionally. Apply it only when requested.

Honoring the flag by itself regresses scheme filtering, though. On main the
`netloc == base_domain` comparison incidentally rejected non-web links, since
mailto:, javascript:, tel:, data: and file: all parse to an empty netloc. A
bare `not match_domain or ...` short-circuits that comparison, so with the
flag off there is no filtering at all: such links are returned, and each one
is added to `visited` before the request is attempted, so it survives the
InvalidSchema that the broad except swallows and consumes max_links budget.
Filter on scheme explicitly, independently of the domain check.

Document what disabling match_domain means: the crawl follows hosts named by
the pages it reads, including untrusted external and internal addresses, and
find_urls consults neither robots.txt nor any inter-request delay. max_links
and max_depth still bound the crawl in both modes.

Tests: both

**File**: `langroid/parsing/urls.py` (modified, +50/-4)
```diff
@@ -204,10 +204,30 @@ def find_urls(
         visited (set): A set of URLs that have already been visited.
         depth (int): The current depth of the recursion.
         max_depth (int): The maximum depth of the recursion.
-        match_domain (bool): Whether to only return URLs that are on the same domain.
+        match_domain (bool): Whether to restrict the crawl to `url`'s own domain.
+            When True (the default), only same-domain links are followed and
+            returned. When False, links to other domains are followed as well,
+            so the crawl will issue requests to hosts named by the pages it
+            reads -- which may include untrusted external hosts, and internal
+            or link-local addresses. `find_urls` does not consult robots.txt and
+            does not delay between requests, so disable this only for domains
+            you control or otherwise trust. `max_links` and `max_depth` still
+            bound the crawl in both modes.
 
     Returns:
-        set: A set of URLs found on the page.
+        set: A set of URLs found on the page, at most `max_links` of them. Only
+            `http`/`https` links that carry a host are followed and returned;
+            links with any other scheme (e.g. `mailto:`, `tel:`, `javascript:`,
+            `ftp:`) are skipped, including ones on the page's own domain, as are
+            hostless references such as `http:foo`. The seed `url` is exempt
+            from that filtering, though it is not guaranteed to survive the
+            `max_links` truncation.
+
+            These are URLs *discovered*, not necessarily URLs crawled: a page
+            that alone supplies `max_links` links returns them without
+            following any, so the result can contain links one hop beyond
+            `max_depth`. `max_depth` bounds the requests issued, not the
+            provenance of the returned set.
     """
 
     if visited is None:
@@ -233,9 +253,35 @@ def find_urls(
             set(urldefrag(link).url for link in links)  # type: ignore
         )
 
-        # Filter links based on domain matching requirement
+        # Keep only fetchable web links, then apply the domain filter if
+        # requested.
+        #
+        # Both the scheme and host checks are load-bearing in both modes, and
+        # neither is implied by the domain comparison once that comparison is
+        # made conditional:
+        #
+        # - Schemes like `mailto:`, `javascript:`, `tel:` and `data:` parse to
+        #   an empty netloc, so with `match_domain` True the domain comparison
+        #   rejects them already -- but with it False that comparison is
+        #   skipped, and such links would be returned and consume `max_links`.
+        # - `ftp://`/`ws://` links to the page's own domain DO match
+        #   `base_domain`, so the domain comparison admits them in either mode;
+        #   previously they were returned even though `requests` cannot fetch
+        #   them.
+        # - Malformed references such as `http:foo` and `http:///path` have a
+        #   web scheme but no host, so only the netloc check excludes them.
+        #
+        # Anything admitted here may be requested, and `find_urls` adds a URL
+        # to `visited` before the request, so a junk entry survives the
+        # exception the broad `except` below swallows and lands in the result.
+        def is_fetchable_web_link(link: str) -> bool:
+            parsed = urlparse(link)
+            if parsed.scheme not in ("http", "https") or not parsed.netloc:
+                return False
+            return not match_domain or parsed.netloc == base_domain
+
         domain_matching_links = [
-            link for link in defragged_links if urlparse(link).netloc == base_domain
+            link for link in defragged_links if is_fetchable_web_link(link)
         ]
 
         # ensure url is first, since below we are taking first max_links urls
```

**File**: `tests/main/test_urls.py` (added, +278/-0)
```diff
@@ -0,0 +1,278 @@
+from itertools import count
+from unittest.mock import patch
+from urllib.parse import urlparse
+
+import pytest
+from requests import Response
+
+from langroid.parsing.urls import find_urls
+
+START_URL = "https://example.test/start"
+LOCAL_URL = "https://example.test/local"
+REMOTE_URL = "https://other.test/remote"
+
+
+def page_response(url: str, timeout: int) -> Response:
+    assert timeout == 5
+    pages = {
+        START_URL: (
+            '<a href="/local#section">Local</a>'
+            '<a href="https://other.test/remote#section">Remote</a>'
+        ),
+        LOCAL_URL: '<a href="/start">Back</a>',
+        REMOTE_URL: '<a href="https://example.test/start">Back</a>',
+    }
+    response = Response()
+    response.status_code = 200
+    response.url = url
+    response._content = pages[url].encode("utf-8")
+    response.encoding = "utf-8"
+    return response
+
+
+@pytest.mark.parametrize("max_links", [3, 4])
+@pytest.mark.parametrize("match_domain", [True, False])
+def test_find_urls_domain_option(match_domain: bool, max_links: int) -> None:
+    with patch("langroid.parsing.urls.requests.get", side_effect=page_response) as get:
+        found = find_urls(START_URL, max_links=max_links, match_domain=match_domain)
+
+    expected = {START_URL, LOCAL_URL}
+    if not match_domain:
+        expected.add(REMOTE_URL)
+    assert found == expected
+
+    # The fetch set, not just the result set, must respect the domain option:
+    # `find_urls` swallows every request exception, so a stray fetch would
+    # otherwise be invisible here.
+    fetched = {call.args[0] for call in get.call_args_list}
+    assert fetched <= expected
+    if match_domain:
+        assert REMOTE_URL not in fetched
+
+
+def test_find_urls_stays_on_domain_by_default() -> None:
+    with patch("langroid.parsing.urls.requests.get", side_effect=page_response):
+        found = find_urls(START_URL, max_links=4)
+
+    assert found == {START_URL, LOCAL_URL}
+
+
+CHAIN = [
+    "https://a.test/page",
+    "https://b.test/page",
+    "https://c.test/page",
+    "https://d.test/page",
+]
+
+
+def chain_response(url: str, timeout: int) -> Response:
+    """Serve a cross-domain chain a -> b -> c -> d, one link per page."""
+    assert timeout == 5
+    nxt = CHAIN[CHAIN.index(url) + 1]
+    response = Response()
+    response.status_code = 200
+    response.url = url
+    response._content = f'<a href="{nxt}">Next</a>'.encode("utf-8")
+    response.encoding = "utf-8"
+    return response
+
+
+@pytest.mark.parametrize("max_depth", [0, 1, 2])
+def test_find_urls_cross_domain_crawl_still_obeys_depth(max_depth: int) -> None:
+    """max_depth bounds a cross-domain crawl at each depth, not just depth 0.
+
+    Each page lives on its own domain and links only to the next, so with
+    `match_domain` False the chain is followed exactly `max_depth` hops and the
+    page one hop beyond must never be fetched. A depth-0-only version of this
+    test would be vacuous: nothing past the seed is fetched either way, so it
+    would pass even if every request failed.
+    """
+    with patch("langroid.parsing.urls.requests.get", side_effect=chain_response) as get:
+        found = find_urls(
+            CHAIN[0], max_links=10, max_depth=max_depth, match_domain=False
+        )
+
+    expected = set(CHAIN[: max_depth + 1])
+    assert found == expected
+    fetched = [call.args[0] for call in get.call_args_list]
+    assert sorted(fetched) == sorted(expected)
+    assert CHAIN[max_depth + 1] not in fetched
+
+
+SCHEMES_URL = "https://example.test/schemes"
+SCHEMES_OK_URL = "https://example.test/ok"
+SCHEMES_HTML = (
+    # Empty-netloc schemes: rejected by the domain comparison as a side effect
+    # when match_domain is True, so only the scheme check excludes them when it
+    # is False.
+    '<a href="mailto:someone@example.com">Mail</a>'
+    '<a href="javascript:void(0)">JS</a>'
+    '<a href="tel:+15551234">Tel</a>'
+    '<a href="data:text/html,hello">Data</a>'
+    '<a href="file:///etc/passwd">File</a>'
+    # Non-web schemes that DO carry a matching netloc: the domain comparison
+    # admits these, so only the scheme check excludes them -- in either mode.
+    '<a href="ftp://example.test/file.zip">FTP</a>'
+    '<a href="ws://example.test/socket">WS</a>'
+    # A web scheme with NO host: only the netloc check excludes these. urljoin
+    # leaves them as-is rather than resolving them against the base.
+    '<a href="http:foo">Hostless</a>'
+    '<a href="http:///path">EmptyHost</a>'
+    # A real web link, so a page that was never fetched cannot be mistaken for
+    # a page whose links were all filtered out.
+    '<a href="https://example.test/ok">Ok</a>'
+    '<a href="https://other.test/remote">Remote</a>'
+)
+
+
+def schemes_response(url: str, timeout: int) -> Response:
+    assert timeout == 5
+    pages = {
+        SCHEMES_URL: SCHEMES_HTML,
+        SCHEMES_OK_URL: '<a href="https://example.test/schemes">B
```

---

### Incident Patch 8: `8c7b410c` (2026-10-04)
**Commit Message**: fix: parse quoted column names when loading tabular data (#1176) [notest]

Co-authored-by: zjp <你的邮箱>

**File**: `langroid/parsing/table_loader.py` (modified, +10/-4)
```diff
@@ -1,4 +1,4 @@
-from csv import Sniffer
+from csv import Sniffer, reader
 from typing import List
 
 import pandas as pd
@@ -32,9 +32,15 @@ def read_tabular_data(path_or_url: str, sep: None | str = None) -> pd.DataFrame:
 
         # get non-blank column names
         with pd.io.common.get_handle(path_or_url, "r") as f:
-            header_line = f.handle.readline().strip()
-            valid_cols = [col for col in header_line.split(sep) if col]
-            valid_cols = [c.replace('"', "").replace("'", "") for c in valid_cols]
+            if len(sep) == 1:
+                valid_cols = [
+                    col for col in next(reader(f.handle, delimiter=sep)) if col
+                ]
+            else:
+                # Preserve the existing multi-character separator handling.
+                header_line = f.handle.readline().strip()
+                valid_cols = [col for col in header_line.split(sep) if col]
+                valid_cols = [c.replace('"', "").replace("'", "") for c in valid_cols]
             if hasattr(f.handle, "seek"):
                 f.handle.seek(0)
 
```

**File**: `tests/main/test_table_loader.py` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+import csv
+from pathlib import Path
+
+import pandas as pd
+import pytest
+
+from langroid.parsing.table_loader import read_tabular_data
+
+
+@pytest.mark.parametrize("explicit_sep", [False, True])
+@pytest.mark.parametrize(
+    "separator, column",
+    [
+        (",", "gross, net"),
+        (";", "gross; net"),
+        ("\t", "gross\tnet"),
+        (",", 'say "hello"'),
+        (",", "owner's share"),
+    ],
+)
+def test_read_quoted_headers(
+    tmp_path: Path, explicit_sep: bool, separator: str, column: str
+) -> None:
+    path = tmp_path / "table.csv"
+    with path.open("w", encoding="utf-8", newline="") as handle:
+        writer = csv.writer(handle, delimiter=separator)
+        writer.writerow([column, "cost"])
+        writer.writerows([[10, 3], [20, 7]])
+
+    result = read_tabular_data(str(path), separator if explicit_sep else None)
+
+    pd.testing.assert_frame_equal(
+        result, pd.DataFrame({column: [10, 20], "cost": [3, 7]})
+    )
+
+
+@pytest.mark.parametrize("separator", [",", ";", "\t"])
+def test_read_tabular_data_skips_blank_headers(tmp_path: Path, separator: str) -> None:
+    path = tmp_path / "table.csv"
+    with path.open("w", encoding="utf-8", newline="") as handle:
+        writer = csv.writer(handle, delimiter=separator)
+        writer.writerow(["name", "", "amount", ""])
+        writer.writerows([["Alice", "ignored", 10, "ignored"]])
+
+    result = read_tabular_data(str(path), separator)
+
+    pd.testing.assert_frame_equal(
+        result, pd.DataFrame({"name": ["Alice"], "amount": [10]})
+    )
+
+
+def test_read_tabular_data_strips_column_whitespace(tmp_path: Path) -> None:
+    path = tmp_path / "table.csv"
+    path.write_text(" name , amount \nAlice,10\n", encoding="utf-8")
+
+    result = read_tabular_data(str(path), ",")
+
+    pd.testing.assert_frame_equal(
+        result, pd.DataFrame({"name": ["Alice"], "amount": [10]})
+    )
+
+
+def test_read_tabular_data_multichar_separator(tmp_path: Path) -> None:
+    path = tmp_path / "table.csv"
+    path.write_text("name::amount\nAlice::10\n", encoding="utf-8")
+
+    result = read_tabular_data(str(path), "::")
+
+    pd.testing.assert_frame_equal(
+        result, pd.DataFrame({"name": ["Alice"], "amount": [10]})
+    )
```

---

### Incident Patch 9: `e7cda01c` (2026-10-04)
**Commit Message**: fix: preserve unselected global settings during partial updates (#1174) [notest]

Co-authored-by: zjp <你的邮箱>

**File**: `langroid/utils/configuration.py` (modified, +5/-2)
```diff
@@ -74,12 +74,15 @@ def update_global_settings(cfg: BaseSettings, keys: List[str]) -> None:
         from langroid.utils.configuration import settings
         if settings.debug: ...
 
-    This updates the global default.
+    This updates only the selected keys in the global default, preserving
+    all other settings.
     """
     config_dict = cfg.model_dump()
     filtered_config = {key: config_dict[key] for key in keys if key in config_dict}
     new_settings = Settings(**filtered_config)
-    _global_settings.__dict__.update(new_settings.__dict__)
+    _global_settings.__dict__.update(
+        new_settings.model_dump(include=set(filtered_config))
+    )
 
 
 def set_global(key_vals: Settings) -> None:
```

**File**: `tests/main/test_global_settings.py` (modified, +74/-0)
```diff
@@ -1,9 +1,11 @@
 import random
 import threading
 import time
+from typing import Iterator
 
 import pytest
 
+from langroid.pydantic_v1 import BaseSettings, ValidationError
 from langroid.utils.configuration import (
     Settings,
     set_global,
@@ -24,6 +26,78 @@ def test_update_global_settings():
     assert settings.debug is False
 
 
+class DebugConfig(BaseSettings):
+    debug: str
+
+
+@pytest.fixture
+def configured_settings() -> Iterator[Settings]:
+    saved = Settings(**settings.dict())
+    initial = Settings(
+        cache=False,
+        cache_type="none",
+        chat_model="mock-model",
+        max_turns=7,
+        quiet=True,
+        stream=False,
+    )
+    set_global(initial)
+    try:
+        yield initial
+    finally:
+        set_global(saved)
+
+
+@pytest.mark.parametrize("keys", [["debug"], [], ["missing"]])
+def test_selective_update_preserves_other_settings(
+    configured_settings: Settings, keys: list[str]
+) -> None:
+    expected = configured_settings.model_dump()
+    if "debug" in keys:
+        expected["debug"] = True
+
+    update_global_settings(Settings(debug=True), keys=keys)
+
+    assert settings.dict() == expected
+
+
+def test_selective_updates_accumulate(configured_settings: Settings) -> None:
+    update_global_settings(Settings(debug=True), keys=["debug"])
+    update_global_settings(Settings(stream=True), keys=["stream"])
+
+    expected = configured_settings.model_dump()
+    expected.update(debug=True, stream=True)
+    assert settings.dict() == expected
+
+
+def test_selective_update_does_not_copy_temporary_override(
+    configured_settings: Settings,
+) -> None:
+    override = Settings(quiet=False, cache=True)
+    with temporary_settings(override):
+        update_global_settings(Settings(debug=True), keys=["debug"])
+        assert settings.dict() == override.model_dump()
+
+    expected = configured_settings.model_dump()
+    expected["debug"] = True
+    assert settings.dict() == expected
+
+
+@pytest.mark.usefixtures("configured_settings")
+@pytest.mark.parametrize("value,expected", [("true", True), ("false", False)])
+def test_selective_update_validates_selected_value(value: str, expected: bool) -> None:
+    update_global_settings(DebugConfig(debug=value), keys=["debug"])
+    assert settings.debug is expected
+
+
+def test_selective_update_rejects_invalid_value(
+    configured_settings: Settings,
+) -> None:
+    with pytest.raises(ValidationError):
+        update_global_settings(DebugConfig(debug="not-a-bool"), keys=["debug"])
+    assert settings.dict() == configured_settings.model_dump()
+
+
 # Shared list to collect exceptions
 thread_exceptions = []
 
```

---

### Incident Patch 10: `e9e13d3e` (2026-10-04)
**Commit Message**: fix: avoid mutating DataFrames when rendering results (#1173) [notest]

* fix: avoid mutating DataFrames when rendering results

* perf: copy only displayed pandas rows

---------

Co-authored-by: zjp <你的邮箱>

**File**: `langroid/utils/pandas_utils.py` (modified, +2/-5)
```diff
@@ -351,11 +351,11 @@ def safe_eval_globals(local_vars: Dict[str, Any]) -> Dict[str, Any]:
 def stringify(x: Any) -> str:
     # Convert x to DataFrame if it is not one already
     if isinstance(x, pd.Series):
-        df = x.to_frame()
+        df = x.head(10).to_frame().copy()
     elif not isinstance(x, pd.DataFrame):
         return str(x)
     else:
-        df = x
+        df = x.head(10).copy()
 
     # Truncate long text columns to 1000 characters
     for col in df.columns:
@@ -368,8 +368,5 @@ def stringify(x: Any) -> str:
                 )
             )
 
-    # Limit to 10 rows
-    df = df.head(10)
-
     # Convert to string
     return df.to_string(index=False)  # type: ignore
```

**File**: `tests/main/test_pandas_utils.py` (modified, +29/-0)
```diff
@@ -5,6 +5,7 @@
     UnsafeCommandError,
     safe_eval_globals,
     sanitize_command,
+    stringify,
 )
 
 SAFE = [
@@ -177,3 +178,31 @@ def test_dangerous_payloads_blocked_via_safe_eval_globals(payload):
 def test_benign_expressions_still_work_via_safe_eval_globals(expr, expected):
     """The restricted builtins must not break legitimate pandas expressions."""
     assert _eval_via_safe_globals(expr) == expected
+
+
+@pytest.mark.parametrize("copy_on_write", [False, True])
+@pytest.mark.parametrize("as_series", [False, True])
+def test_stringify_preserves_tabular_input(
+    copy_on_write: bool, as_series: bool
+) -> None:
+    """Display truncation must preserve every row of the caller's data."""
+    values = ["x" * 1001, None, 7] + [f"row {i}" for i in range(3, 11)]
+    values.append("y" * 1001)  # The final row is not displayed.
+    series = pd.Series(values, name="text", dtype=object)
+    original = series if as_series else series.to_frame()
+    before = original.copy(deep=True)
+    expected = pd.DataFrame({"text": ["x" * 1000 + "..."] + values[1:10]})
+
+    with pd.option_context("mode.copy_on_write", copy_on_write):
+        rendered = stringify(original)
+
+    if isinstance(original, pd.Series):
+        pd.testing.assert_series_equal(original, before)
+    else:
+        pd.testing.assert_frame_equal(original, before)
+    assert rendered == expected.to_string(index=False)
+
+
+@pytest.mark.parametrize("value", ["plain text", 42, [1, 2]])
+def test_stringify_non_tabular_input(value: object) -> None:
+    assert stringify(value) == str(value)
```

---

### Incident Patch 11: `843d30ae` (2026-10-04)
**Commit Message**: fix: preserve declared types of XML tool collection arguments (#1172) [notest]

* fix: preserve declared types of XML tool collection arguments

`XMLToolMessage.extract_field_values` inferred structure from the XML text
alone, which lost field types several ways:

- an empty element (`<tags/>`, as `format_example()` emits for an empty
  list or dict) parsed as an empty string;
- a single-entry dict or single-field nested model parsed as a list,
  because the "all children share a tag" heuristic is trivially true;
- nested elements had no type at all, so a `List[Model]` of single-field
  models parsed as a list of lists.

Valid XML tool-calls therefore failed Pydantic validation. Agent dispatch
compounded this by parsing candidates against the base `XMLToolMessage`,
which declares no fields at all, so no type information was available.

Decide empty containers and mapping-vs-list from the field's declared
annotation, pass an expected type down to child elements (a list's item
type, a mapping's value type, a model's same-named field), keep valid
empty-dict arguments (filter internal fields by name rather than by empty
value), keep the root element a mapping, and re-parse XML against 

**File**: `langroid/agent/base.py` (modified, +19/-1)
```diff
@@ -1972,8 +1972,13 @@ def _get_one_tool_message(
             return None
 
         properties = maybe_tool_dict.get("properties")
+        # When the tool-call was nested under "properties" the raw string no
+        # longer maps 1:1 onto the tool's fields, so re-parsing it below
+        # against a concrete tool class would lose that unwrapping.
+        unwrapped_properties = isinstance(properties, dict)
         if isinstance(properties, dict):
             maybe_tool_dict = properties
+        reparse_xml = not is_json and not unwrapped_properties
         request = maybe_tool_dict.get("request")
         if request is None:
             if self.enabled_requests_for_inference is None:
@@ -2000,7 +2005,16 @@ def maybe_parse(tool: type[ToolMessage]) -> Optional[ToolMessage]:
                     return None
 
                 try:
-                    return tool.model_validate(maybe_tool_dict)
+                    # The dict above came from parsing XML against the BASE
+                    # XMLToolMessage, which knows no field types; re-parse
+                    # against this candidate so its collection fields are
+                    # typed correctly.
+                    data = (
+                        tool.extract_field_values(tool_candidate_str)
+                        if reparse_xml and issubclass(tool, XMLToolMessage)
+                        else maybe_tool_dict
+                    )
+                    return tool.model_validate(data)
                 except ValidationError:
                     return None
 
@@ -2030,6 +2044,10 @@ def maybe_parse(tool: type[ToolMessage]) -> Optional[ToolMessage]:
             return None
 
         try:
+            if reparse_xml and issubclass(message_class, XMLToolMessage):
+                # Same reason as in `maybe_parse` above: the generic parse does
+                # not know this class's field types.
+                maybe_tool_dict = message_class.extract_field_values(tool_candidate_str)
             message = message_class.model_validate(maybe_tool_dict)
         except ValidationError as ve:
             self.tool_error = from_llm
```

**File**: `langroid/agent/xml_tool_message.py` (modified, +161/-21)
```diff
@@ -3,7 +3,7 @@
 from typing import Any, Dict, List, Optional, Union, get_args, get_origin
 
 from lxml import etree
-from pydantic import BaseModel, ConfigDict
+from pydantic import BaseModel, ConfigDict, RootModel
 
 from langroid.agent.tool_message import ToolMessage
 
@@ -17,6 +17,90 @@
     pass
 
 
+def _unwrap_optional(annotation: Any) -> Any:
+    """Reduce `Optional[X]` (and `X | None`) to `X`, leaving anything else as is.
+
+    `format_instructions` applies the same reduction when it decides how to
+    show a field to the LLM, so parsing must apply it too: otherwise a field
+    declared `Optional[List[str]]` is advertised as a list but parsed as a
+    scalar.
+
+    Args:
+        annotation: A type annotation, possibly `None`.
+
+    Returns:
+        The single non-`None` member of an `Optional`/`Union` annotation, or
+        the annotation unchanged when it is not such a union.
+    """
+    origin = get_origin(annotation)
+    is_union = origin is Union
+    if HAS_UNION_TYPE:
+        from types import UnionType as _UnionType
+
+        is_union = is_union or origin is _UnionType
+    if not is_union:
+        return annotation
+    non_none = [arg for arg in get_args(annotation) if arg is not type(None)]
+    return non_none[0] if len(non_none) == 1 else annotation
+
+
+def _is_model(annotation: Any) -> bool:
+    """Whether `annotation` is a Pydantic model whose fields map onto tags.
+
+    `RootModel` is excluded: its content is a single unnamed value, which may
+    itself be a list, so its children are not named fields and the structural
+    heuristics must be left to decide.
+    """
+    return (
+        isinstance(annotation, type)
+        and issubclass(annotation, BaseModel)
+        and not issubclass(annotation, RootModel)
+    )
+
+
+def _child_field(annotation: Any, tag: str) -> Any:
+    """`FieldInfo` of field `tag` when `annotation` is a model declaring it.
+
+    This supplies the child's declared TYPE, so a nested element is typed by
+    its own model's field rather than by whatever top-level field happens to
+    share its tag. Note that `verbatim` is deliberately NOT taken from here:
+    it stays a top-level-only flag, matching the pre-existing behavior that
+    `test_roundtrip_complex_nested_tolerant` pins (a nested field declared
+    verbatim is still stripped).
+
+    Args:
+        annotation: The parent element's resolved annotation.
+        tag: The child element's tag.
+
+    Returns:
+        The child's `FieldInfo`, or `None` if the parent is not a model
+        declaring such a field.
+    """
+    if not _is_model(annotation):
+        return None
+    return annotation.model_fields.get(tag)
+
+
+def _child_type(annotation: Any, is_mapping: bool) -> Any:
+    """Annotation the children of an `annotation`-typed element should have.
+
+    For a list that is its item type, for a mapping its value type; `None`
+    when the element's type says nothing about its children (a model's
+    children are resolved per-tag by `_child_field` instead).
+
+    Args:
+        annotation: The element's own (Optional-reduced) annotation.
+        is_mapping: Whether the element is being parsed as a mapping.
+
+    Returns:
+        A type annotation for the children, or `None` if unknown.
+    """
+    args = get_args(annotation)
+    if is_mapping:
+        return args[1] if len(args) == 2 else None
+    return args[0] if len(args) == 1 else None
+
+
 class XMLToolMessage(ToolMessage):
     """
     Abstract class for tools formatted using XML instead of JSON.
@@ -88,18 +172,52 @@ def extract_field_values(cls, formatted_string: str) -> Optional[Dict[str, Any]]
         )
         root = etree.fromstring(formatted_string.encode("utf-8"), parser=parser)
 
-        def parse_element(element: etree._Element) -> Any:
+        def parse_element(
+            element: etree._Element, expected_field: Any = None, expected: Any = None
+        ) -> Any:
             # Skip elements starting with underscore
             if element.tag.startswith("_"):
                 return {}
 
-            field_info = cls.model_fields.get(element.tag)
+            # Resolve what this element IS by position, not by tag name. Only a
+            # direct child of the root is a top-level field, so only it may be
+            # matched to one by name; a deeper element is described solely by
+            # what its parent passes down (`expected_field` when the parent is
+            # a model and so has field metadata, `expected` for a list's items
+            # or a mapping's values). Looking deeper elements up by tag would
+            # let a nested tag -- or a dict key -- that happens to collide with
+            # a top-level field name borrow that field's type or its
+            # `verbatim` flag.
+            is_top_level = element is not root and element.getparent() is root
+            annotation: Any
+            if element is root:
+                annotation = None
+           
```

**File**: `tests/main/test_xml_tool_containers.py` (added, +356/-0)
```diff
@@ -0,0 +1,356 @@
+"""Tests that XML tool-calls preserve the declared types of collection fields.
+
+`XMLToolMessage.extract_field_values` infers structure from the XML alone, which
+loses type information several ways: an empty element looks like an empty string
+rather than an empty list/dict; a single-entry dict (or a single-field nested
+model) looks like a list because all its children share a tag; and a nested
+element has no declared type at all. Each makes otherwise valid tool-calls fail
+Pydantic validation.
+
+The tests here also cover the hazard that comes with consulting declared types:
+resolving an element's type by tag name lets a nested tag -- or a dict key --
+colliding with a top-level field name borrow that field's type or `verbatim`
+flag.
+"""
+
+from typing import Any, Dict, List, Optional
+
+import pytest
+from pydantic import BaseModel, Field, RootModel, field_validator, model_validator
+
+from langroid.agent.chat_agent import ChatAgent, ChatAgentConfig
+from langroid.agent.xml_tool_message import XMLToolMessage
+from langroid.language_models.mock_lm import MockLMConfig
+
+
+class Filters(BaseModel):
+    category: str
+
+
+class SearchXML(XMLToolMessage):
+    request: str = "search_xml"
+    purpose: str = "Search with collection arguments"
+    filters: Dict[str, str]
+    tags: List[str]
+    options: Filters
+
+    def handle(self) -> str:
+        category = self.filters.get("category", "all")
+        return f"{category}|{len(self.tags)}|{self.options.category}"
+
+
+class OptionalSearchXML(XMLToolMessage):
+    """Same collection fields, but declared as `Optional[...]`.
+
+    `format_instructions` reduces `Optional[X]` to `X` when telling the LLM how
+    to format a field, so parsing has to do the same reduction.
+    """
+
+    request: str = "optional_search_xml"
+    purpose: str = "Search with optional collection arguments"
+    filters: Optional[Dict[str, str]] = None
+    tags: Optional[List[str]] = None
+
+
+@pytest.mark.parametrize("filters", [{}, {"category": "RAG"}, {"a": "A", "b": "B"}])
+@pytest.mark.parametrize("tags", [[], ["AI"], ["AI", "RAG"]])
+def test_xml_tool_collection_roundtrip(
+    filters: Dict[str, str], tags: List[str]
+) -> None:
+    original = SearchXML(filters=filters, tags=tags, options=Filters(category="RAG"))
+    parsed = SearchXML.parse(original.format_example())
+    assert parsed == original
+
+
+@pytest.mark.parametrize("filters", [{}, {"category": "RAG"}, {"a": "A", "b": "B"}])
+@pytest.mark.parametrize("tags", [[], ["AI"], ["AI", "RAG"]])
+def test_optional_xml_tool_collection_roundtrip(
+    filters: Dict[str, str], tags: List[str]
+) -> None:
+    original = OptionalSearchXML(filters=filters, tags=tags)
+    parsed = OptionalSearchXML.parse(original.format_example())
+    assert parsed == original
+
+
+def test_explicit_empty_collections_are_retained() -> None:
+    values = SearchXML.extract_field_values(
+        "<tool><request>search_xml</request><filters/><tags/>"
+        "<options><category>RAG</category></options><_internal>ignore</_internal></tool>"
+    )
+    assert values is not None
+    assert values["filters"] == {}
+    assert values["tags"] == []
+    assert "_internal" not in values
+
+
+def test_optional_empty_collections_use_declared_types() -> None:
+    values = OptionalSearchXML.extract_field_values(
+        "<tool><request>optional_search_xml</request><filters/><tags/></tool>"
+    )
+    assert values is not None
+    assert values["filters"] == {}
+    assert values["tags"] == []
+
+
+def test_optional_single_entry_dict_stays_a_mapping() -> None:
+    """A one-key dict must not be mistaken for a one-element list."""
+    values = OptionalSearchXML.extract_field_values(
+        "<tool><request>optional_search_xml</request>"
+        "<filters><category>RAG</category></filters></tool>"
+    )
+    assert values is not None
+    assert values["filters"] == {"category": "RAG"}
+
+
+class BareCollectionsXML(XMLToolMessage):
+    """Bare `list`/`dict` annotations, which `format_instructions` also
+    advertises as collections."""
+
+    request: str = "bare_collections_xml"
+    purpose: str = "Search with bare collection annotations"
+    tags: list = []
+    filters: dict = {}
+
+
+class NestedListXML(XMLToolMessage):
+    request: str = "nested_list_xml"
+    purpose: str = "A list of single-field nested models"
+    items: List[Filters] = []
+
+
+def test_bare_collection_annotations_use_declared_types() -> None:
+    values = BareCollectionsXML.extract_field_values(
+        "<tool><request>bare_collections_xml</request><tags/><filters/></tool>"
+    )
+    assert values is not None
+    assert values["tags"] == []
+    assert values["filters"] == {}
+
+
+def test_single_field_models_inside_a_list_stay_mappings() -> None:
+    """Each list item is a one-field model, so it must not collapse to a list."""
+    parsed = NestedListXML.parse(
+        "<tool><request>nested_list_xml</request>"
+        "<items
```

---

### Incident Patch 12: `54cb0f7e` (2026-10-04)
**Commit Message**: fix: copy metadata for CodeParser chunks (#1170) [notest]

**File**: `langroid/parsing/code_parser.py` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@ def split(self, docs: List[Document]) -> List[Document]:
         """
         chunked_docs = [
             [
-                Document(content=chunk, metadata=d.metadata)
+                Document(content=chunk, metadata=d.metadata.model_copy())
                 for chunk in chunk_code(
                     d.content,
                     d.metadata.language,  # type: ignore
```

**File**: `tests/main/test_code_parser.py` (modified, +70/-0)
```diff
@@ -1,5 +1,10 @@
+from typing import List
+
+import pytest
+
 from langroid.mytypes import DocMetaData, Document
 from langroid.parsing.code_parser import CodeParser, CodeParsingConfig
+from langroid.parsing.parser import Parser, ParsingConfig
 
 MAX_CHUNK_SIZE = 10
 
@@ -62,3 +67,68 @@ class Item(BaseModel):
     joined_splits = "".join([doc.content for doc in split_docs])
     joined_docs = "".join([doc.content for doc in docs])
     assert joined_splits.strip() == joined_docs.strip()
+
+
+@pytest.fixture
+def code_documents() -> List[Document]:
+    """Return two source documents that each produce multiple code chunks."""
+    return [
+        Document(
+            content="\n".join(f"value_{i} = {i}" for i in range(10)),
+            metadata=DocMetaData(
+                source="first.py", language="py", attributes={"kind": "code"}
+            ),
+        ),
+        Document(
+            content="\n".join(f"echo value_{i}" for i in range(10)),
+            metadata=DocMetaData(source="second.sh", language="sh"),
+        ),
+    ]
+
+
+def test_code_parser_metadata(code_documents: List[Document]) -> None:
+    """Keep chunk metadata independent while preserving source metadata."""
+    original = [doc.model_dump() for doc in code_documents]
+    parser = CodeParser(CodeParsingConfig(chunk_size=MAX_CHUNK_SIZE))
+    chunks = parser.split(code_documents)
+
+    assert len({id(chunk.metadata) for chunk in chunks}) == len(chunks)
+    for doc in code_documents:
+        group = [c for c in chunks if c.metadata.source == doc.metadata.source]
+        assert len(group) > 1
+        assert "".join(c.content for c in group).strip() == doc.content.strip()
+        assert all(c.metadata is not doc.metadata for c in group)
+        assert all(c.metadata == doc.metadata for c in group)
+
+    # Nested values retain the existing shallow-copy semantics.
+    assert chunks[0].metadata.attributes is code_documents[0].metadata.attributes
+    chunks[0].metadata.source = "changed"
+    assert chunks[1].metadata.source == "first.py"
+    assert [doc.model_dump() for doc in code_documents] == original
+
+
+@pytest.mark.parametrize("n_neighbor_ids", [0, 1, 3])
+def test_code_parser_window_ids(
+    code_documents: List[Document], n_neighbor_ids: int
+) -> None:
+    """Assign distinct IDs and keep each neighbor window within its source."""
+    original = [doc.model_dump() for doc in code_documents]
+    chunks = CodeParser(CodeParsingConfig(chunk_size=MAX_CHUNK_SIZE)).split(
+        code_documents
+    )
+    parser = Parser(ParsingConfig(n_neighbor_ids=n_neighbor_ids))
+    parser.add_window_ids(chunks)
+
+    assert len({chunk.id() for chunk in chunks}) == len(chunks)
+    assert all(chunk.metadata.is_chunk for chunk in chunks)
+    for doc in code_documents:
+        group = [c for c in chunks if c.metadata.source == doc.metadata.source]
+        ids = [chunk.id() for chunk in group]
+        assert len(ids) > 1
+        assert doc.id() not in ids
+        for i, chunk in enumerate(group):
+            assert (
+                chunk.metadata.window_ids
+                == ids[max(0, i - n_neighbor_ids) : i + n_neighbor_ids + 1]
+            )
+    assert [doc.model_dump() for doc in code_documents] == original
```

---

### Incident Patch 13: `7ecc8d14` (2026-10-04)
**Commit Message**: fix: initialize TableChatAgent with text-only dataframes (#1162) [notest]

**File**: `langroid/agent/special/table_chat_agent.py` (modified, +3/-1)
```diff
@@ -96,7 +96,9 @@ def dataframe_summary(df: pd.DataFrame) -> str:
     )
 
     # Numerical data summary
-    num_summary = df.describe().map(lambda x: "{:.2f}".format(x))
+    num_summary = df.describe().map(
+        lambda x: x if isinstance(x, str) else "{:.2f}".format(x)
+    )
     num_str = "Numerical Column Summary:\n" + num_summary.to_string() + "\n\n"
 
     # Categorical data summary
```

**File**: `tests/main/test_table_chat_agent.py` (modified, +82/-1)
```diff
@@ -8,7 +8,11 @@
 import pandas as pd
 import pytest
 
-from langroid.agent.special.table_chat_agent import TableChatAgent, TableChatAgentConfig
+from langroid.agent.special.table_chat_agent import (
+    TableChatAgent,
+    TableChatAgentConfig,
+    dataframe_summary,
+)
 from langroid.agent.task import Task
 from langroid.language_models.base import (
     LLMFunctionCall,
@@ -31,6 +35,83 @@
 """
 
 
+@pytest.mark.parametrize(
+    "data, expected_text, expected_rows",
+    [
+        pytest.param(
+            pd.DataFrame({"city": ["Paris", "Rome", "Paris"]}),
+            "'city': Paris, Rome",
+            [["top", "Paris"], ["count", "3.00"], ["city", "0"]],
+            id="text-only",
+        ),
+        pytest.param(
+            pd.DataFrame({"city": ["Paris", None, "Paris"]}),
+            "'city': Paris, None",
+            [["top", "Paris"], ["freq", "2.00"], ["city", "1"]],
+            id="text-with-missing",
+        ),
+        pytest.param(
+            pd.DataFrame({"city": [None, None]}),
+            "'city': None",
+            [["count", "0.00"], ["top", "nan"], ["city", "2"]],
+            id="all-missing-text",
+        ),
+        pytest.param(
+            pd.DataFrame({"city": [f"city{i}" for i in range(10)]}),
+            "'city': 10 unique values",
+            [["count", "10.00"], ["unique", "10.00"], ["city", "0"]],
+            id="many-text-values",
+        ),
+        pytest.param(
+            pd.DataFrame({"score": [1.0, 2.0, np.nan]}),
+            "Categorical Column Summary:\n\n",
+            [["count", "2.00"], ["mean", "1.50"], ["score", "1"]],
+            id="numeric-only",
+        ),
+        pytest.param(
+            pd.DataFrame(
+                {"city": ["Paris", None, "Rome"], "score": [1.0, 2.0, np.nan]}
+            ),
+            "'city': Paris, None, Rome",
+            [["mean", "1.50"], ["city", "1"], ["score", "1"]],
+            id="mixed",
+        ),
+        pytest.param(
+            pd.DataFrame({"flag": [True, False, True]}),
+            "Categorical Column Summary:\n\n",
+            [["top", "1.00"], ["freq", "2.00"], ["flag", "0"]],
+            id="boolean",
+        ),
+        pytest.param(
+            pd.DataFrame(
+                {"flag": pd.Series([True, False, None, True], dtype="boolean")}
+            ),
+            "Categorical Column Summary:\n\n",
+            [["top", "1.00"], ["count", "3.00"], ["flag", "1"]],
+            id="boolean-with-missing",
+        ),
+    ],
+)
+def test_table_chat_agent_summary(
+    data: pd.DataFrame,
+    expected_text: str,
+    expected_rows: list[list[str]],
+) -> None:
+    """Summarize and initialize tables with different value types offline."""
+    agent = TableChatAgent(TableChatAgentConfig(data=data))
+    summary = dataframe_summary(data)
+    assert "COLUMN NAMES:\n" in summary
+    assert "Numerical Column Summary:\n" in summary
+    assert "Categorical Column Summary:\n" in summary
+    assert "Missing Values Column Summary:\n" in summary
+    assert expected_text in summary
+    rows = [line.split() for line in summary.splitlines()]
+    for expected_row in expected_rows:
+        assert expected_row in rows
+
+    assert summary in agent.config.system_message
+
+
 @pytest.fixture
 def mock_data_frame_blanks() -> pd.DataFrame:
     return read_tabular_data(StringIO(DATA_STRING))  # type: ignore[arg-type]
```

---

### Incident Patch 14: `324631cd` (2026-10-02)
**Commit Message**: fix(tests): replace retired Haiku 3.5 with Haiku 4.5 (#1169)

**File**: `tests/main/test_llm.py` (modified, +2/-2)
```diff
@@ -407,7 +407,7 @@ def test_llm_openrouter(model: str):
     "model",
     [
         "portkey/openai/gpt-4o-mini",
-        "portkey/anthropic/claude-3-5-haiku-latest",
+        "portkey/anthropic/claude-haiku-4-5-20251001",
         "portkey/google/gemini-2.0-flash-lite",
     ],
 )
@@ -996,7 +996,7 @@ def test_litellm_model_key():
     """
     Test that passing in explicit api_key works with `litellm/*` models
     """
-    model = "litellm/anthropic/claude-3-5-haiku-latest"
+    model = "litellm/anthropic/claude-haiku-4-5-20251001"
     # disable any chat model passed via --m arg to pytest cmd
     settings.chat_model = model
 
```

**File**: `tests/main/test_llm_async.py` (modified, +2/-2)
```diff
@@ -273,7 +273,7 @@ async def test_litellm_model_key_async():
     """
     Test that passing in explicit api_key works with `litellm/*` models
     """
-    model = "litellm/anthropic/claude-3-5-haiku-latest"
+    model = "litellm/anthropic/claude-haiku-4-5-20251001"
     # disable any chat model passed via --m arg to pytest cmd
     settings.chat_model = model
     llm_config = lm.OpenAIGPTConfig(
@@ -292,7 +292,7 @@ async def test_litellm_model_key_async():
     "model",
     [
         "portkey/openai/gpt-4o-mini",
-        "portkey/anthropic/claude-3-5-haiku-latest",
+        "portkey/anthropic/claude-haiku-4-5-20251001",
         "portkey/google/gemini-2.0-flash-lite",
     ],
 )
```

---

### Incident Patch 15: `1347cf15` (2026-10-01)
**Commit Message**: fix: make run_batch_function(sequential=False) actually run concurrently (#1160)

* fix: make run_batch_function(sequential=False) actually run concurrently

`run_batch_function` takes a blocking synchronous callable, but the
concurrent path wrapped it in a coroutine that simply called it:

    async def _do_task(item):
        return function(item)

That gives `asyncio.gather` no suspension point, so the calls ran back to
back and `sequential=False` was indistinguishable from `sequential=True`
for every callable the helper accepts (issue #1157).

Hand each call to a worker thread via `asyncio.to_thread` instead, so the
flag has its documented effect. Results stay in input order, `batch_size`
still bounds how many calls are in flight, and the sequential path still
runs the callback directly on the calling thread.

Also give the function a docstring, and document the thread-safety and
cancellation consequences in docs/notes/batch-processing.md.

Reported by @CSXizhang.

Co-Authored-By: Claude Opus 5 <[REDACTED_EMAIL]>

* test: make the batch-size concurrency probe actually measure batching

The overlap probe released its waiters as soon as a second call was in
flight, which pinned t

**File**: `docs/notes/batch-processing.md` (modified, +18/-0)
```diff
@@ -110,6 +110,24 @@ processing is used. The `stop_on_first_result` path schedules the tasks in the
 current batch concurrently so that it can return whichever valid result
 finishes first.
 
+## Synchronous callbacks
+
+`run_batch_function` takes a plain synchronous callable rather than a
+coroutine. With the default `sequential=True` it calls that function one item
+at a time on the calling thread. With `sequential=False` the calls are handed
+to worker threads so that blocking work actually overlaps, which means:
+
+- the function must be thread-safe;
+- results are still returned in input order, and `batch_size` still bounds
+  how many calls are in flight at once;
+- a raised exception aborts the batch, but calls already running in threads
+  cannot be cancelled and will run to completion.
+
+Before [GitHub issue #1157](https://github.com/langroid/langroid/issues/1157),
+`sequential=False` wrapped the callback in a coroutine that invoked it
+directly. That left `asyncio.gather` with no suspension point, so blocking
+callbacks ran back to back and the flag had no observable effect.
+
 See `tests/main/test_batch.py` for executable examples and edge-case coverage.
 
 ## Rolling bounded concurrency
```

**File**: `langroid/agent/batch.py` (modified, +31/-9)
```diff
@@ -757,18 +757,40 @@ def run_batch_function(
     sequential: bool = True,
     batch_size: Optional[int] = None,
 ) -> List[U]:
-    async def _do_task(item: T) -> U:
-        return function(item)
+    """Apply a synchronous `function` to each item, optionally concurrently.
+
+    Args:
+        function: Blocking, synchronous callable applied to each item.
+        items: The items to process.
+        sequential: If True (default), call `function` one item at a time on
+            the calling thread. If False, overlap the calls using worker
+            threads.
+        batch_size: If given, process the items in consecutive batches of this
+            size; each batch finishes before the next one starts. Defaults to
+            one batch containing all items.
+
+    Returns:
+        The results, in the same order as `items`.
+
+    Note:
+        With `sequential=False` the calls run in worker threads (via
+        `asyncio.to_thread`), so `function` must be thread-safe. The number of
+        threads is bounded by asyncio's default executor; use `batch_size` to
+        bound it further. A `function` that raises aborts the batch, but
+        already-running calls cannot be cancelled and will run to completion.
+    """
 
     async def _do_all(items: Iterable[T]) -> List[U]:
         if sequential:
-            results = []
-            for item in items:
-                result = await _do_task(item)
-                results.append(result)
-            return results
-
-        return await asyncio.gather(*(_do_task(item) for item in items))
+            return [function(item) for item in items]
+
+        # `function` is blocking and synchronous, so awaiting a coroutine that
+        # merely calls it gives gather() no suspension point and the calls run
+        # back to back (issue #1157). Hand each one to a worker thread so that
+        # `sequential=False` actually overlaps them.
+        return list(
+            await asyncio.gather(*(asyncio.to_thread(function, item) for item in items))
+        )
 
     results: List[U] = []
 
```

**File**: `tests/main/test_batch.py` (modified, +88/-1)
```diff
@@ -1,6 +1,7 @@
 import asyncio
+import threading
 import time
-from typing import Any, Optional
+from typing import Any, List, Optional, Tuple
 
 import pytest
 
@@ -602,3 +603,89 @@ async def mock_task(input: str, i: int) -> Any:
     results = asyncio.run(run_batch())
 
     assert results == [None, None, "Processed valid", None]
+
+
+_PROBE_ITEMS = 4
+
+
+def _overlap_probe(
+    sequential: bool,
+    batch_size: Optional[int] = None,
+    wait_timeout: float = 0.5,
+) -> Tuple[List[int], int]:
+    """Run `run_batch_function` over `_PROBE_ITEMS` items, recording the peak
+    number of callbacks in flight at once.
+
+    Each callback waits until *every* item is running at once, or until a
+    short bounded timeout expires -- never unbounded, so the probe cannot
+    hang when execution turns out to be more serial than expected.
+
+    Releasing only at full width is what makes the measurement meaningful:
+    a probe that released as soon as it saw a second peer would report a peak
+    of 2 no matter how much concurrency was actually available, and so could
+    not tell `batch_size=2` apart from `batch_size` being ignored.
+
+    Args:
+        sequential: Passed through to `run_batch_function`.
+        batch_size: Passed through to `run_batch_function`.
+        wait_timeout: Per-callback upper bound on the blocking wait.
+
+    Returns:
+        The results list, and the peak number of concurrently active calls.
+    """
+    lock = threading.Lock()
+    all_running = threading.Event()
+    state = {"active": 0, "peak": 0}
+
+    def work(i: int) -> int:
+        with lock:
+            state["active"] += 1
+            state["peak"] = max(state["peak"], state["active"])
+            if state["active"] >= _PROBE_ITEMS:
+                all_running.set()
+        all_running.wait(timeout=wait_timeout)
+        with lock:
+            state["active"] -= 1
+        return i * i
+
+    results = run_batch_function(
+        work,
+        list(range(_PROBE_ITEMS)),
+        sequential=sequential,
+        batch_size=batch_size,
+    )
+    return results, state["peak"]
+
+
+def test_run_batch_function_sequential_does_not_overlap() -> None:
+    """`sequential=True` must keep exactly one callback in flight."""
+    # the event can never fire here, so every call pays `wait_timeout`;
+    # keep it small since the assertion does not depend on its size.
+    results, peak = _overlap_probe(sequential=True, wait_timeout=0.05)
+    assert results == [0, 1, 4, 9]
+    assert peak == 1
+
+
+def test_run_batch_function_concurrent_overlaps() -> None:
+    """`sequential=False` must actually overlap blocking sync callbacks.
+
+    Regression guard for issue #1157: the concurrent path wrapped `function`
+    in a coroutine that called it directly, giving `asyncio.gather` no
+    suspension point, so blocking callbacks ran back to back and
+    `sequential=False` was indistinguishable from `sequential=True`.
+    """
+    results, peak = _overlap_probe(sequential=False)
+    assert results == [0, 1, 4, 9], "results must stay in input order"
+    assert peak == _PROBE_ITEMS, f"expected all calls to overlap, saw peak {peak}"
+
+
+def test_run_batch_function_concurrent_respects_batch_size() -> None:
+    """Concurrency is confined to one batch at a time, and order is kept.
+
+    With `batch_size=2` only two of the four calls may be in flight at once,
+    so the probe's full-width event never fires and the peak must stay at the
+    batch size -- which is what distinguishes this from the unbatched case.
+    """
+    results, peak = _overlap_probe(sequential=False, batch_size=2)
+    assert results == [0, 1, 4, 9]
+    assert peak == 2
```

#### Recent Merged Pull Requests:
- **PR #1192** (2026-10-06): test: use MockLM for two tests that never needed a real LLM (#494) (@pchalasani)
- **PR #1187** (2026-10-05): ci: keep the quick gate keyless by skipping the two import-time LLM modules (@pchalasani)
- **PR #1186** (2026-10-05): ci: run the paid suite per release, not per push, behind a cheap gate (@pchalasani)
- **PR #1185** (2026-10-05): test(vertexai): capture warnings without pytest's caplog (@pchalasani)
- **PR #1184** (2026-10-05): fix(llm): retire Haiku 3, add Haiku 4.5, resolve dated snapshots (@pchalasani)
- **PR #1183** (2026-10-05): chore(tests): cheap model by default, and no full suite on PR-ready (@pchalasani)
- **PR #1182** (2026-10-05): fix(lance-rag): address the query-plan answer to the Critic explicitly (@pchalasani)
- **PR #1181** (2026-10-05): feat(llm): first-class Vertex AI routing with an isolated config (supersedes #1175) (@pchalasani)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
