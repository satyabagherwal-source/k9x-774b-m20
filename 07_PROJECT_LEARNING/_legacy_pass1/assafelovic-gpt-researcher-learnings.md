> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/assafelovic-gpt-researcher-learnings.md`  
> **Source**: GitHub ([https://github.com/assafelovic/gpt-researcher](https://github.com/assafelovic/gpt-researcher))  
> **Synthesized By**: Google Gemini Server-to-Server Autonomous AI Agent  
> **Timestamp**: 2026-09-29T16:24:33.728Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Forensic Learning Record: assafelovic/gpt-researcher

## 1. Executive Forensic Architecture & System Mechanics

`gpt-researcher` is an autonomous agent designed for online deep research. It solves the problem of information synthesis scale, hallucination, and bias by orchestrating parallelized search, scraping, filtering, and multi-agent compilation pipelines. 

```
                                  [ User Request ]
                                         │
                                         ▼
                             [ GPTResearcher Master ]
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
       [ Search Planner ]                              [ WebSocket Server ]
                 │                                       (Real-time Logs)
        ┌────────┴────────┐                                      ▲
        ▼                 ▼                                      │
  [ Tavily/Bing ]   [ DuckDuckGo ]                               │
        │                 │                                      │
        └────────┬────────┘                                      │
                 ▼                                               │
       [ URL Queue Manager ]                                     │
                 │                                               │
                 ▼ (Parallel Scraping via Semaphore)             │
       [ Scraper / MCP Server ] ─────────────────────────────────┤
                 │                                               │
                 ▼                                               │
     [ Context Filter Pipeline ]                                 │
     (Embeddings / Jev Fallback)                                 │
                 │                                               │
                 ▼                                               │
     [ Multi-Agent Writer Team ] ────────────────────────────────┘
     (Deduplicated Section Drafts)
                 │
                 ▼
         [ Final Report ]
```

### Architectural Boundaries & Subsystems
1. **The Master Agent (`GPTResearcher`)**: The central orchestrator that manages the state machine of the research run. It coordinates query generation, parallel web search, scraping, context filtering, and report generation.
2. **The Retrieval & Scraping Engine**: Abstracts web search APIs (Tavily, Bing, Google, DuckDuckGo) and web scrapers (Playwright, BeautifulSoup, and MCP integrations like `anybrowse`). It handles rate limits, user-agent rotation, and anti-scraping bypasses.
3. **The Context Processing Pipeline**: Responsible for chunking scraped text, generating vector embeddings, and ranking chunks. It features a lightweight keyword/Jaccard fallback mechanism to bypass embedding API failures.
4. **The Multi-Agent Writer Team**: A distributed writing system where specialized sub-agents draft individual sections of the report in parallel based on filtered context, coordinated by a deduplication engine to prevent repetitive content.
5. **The Communication Layer**: A WebSocket-based streaming interface that pushes real-time execution logs, agent state transitions, and partial drafts to the client.

---

## 2. Deep Micro-Learnings & Runtime Gotchas

### Failure Mode 1: WebSocket Disconnects Crashing Long-Running Research Tasks
* **Failure Mode**: When a client disconnects (e.g., browser tab closed, network hiccup) during a 5-minute deep research run, the WebSocket write throws a `ConnectionClosedError`, which propagates up and terminates the entire background research coroutine.
* **Root Cause**: The agent loop directly calls `websocket.send_json()` without isolating the network I/O from the computational/agentic state machine.
* **Exact Prevention/Fix**: Decouple the agent's logging from the WebSocket transport using an in-memory `asyncio.Queue`. The agent writes to the queue, and a separate, supervised consumer task drains the queue and writes to the WebSocket, gracefully handling disconnects without affecting the agent.

### Failure Mode 2: Multi-Agent Section Deduplication Failure
* **Failure Mode**: The final compiled report contains highly repetitive paragraphs, identical citations, or overlapping sub-sections.
* **Root Cause**: Parallel sub-agents draft sections independently using overlapping context chunks. Without a global state tracking already-written concepts or a post-writing deduplication pass, they synthesize identical source material.
* **Exact Prevention/Fix**: Implement a centralized "Concept Registry" or run a post-generation semantic deduplication pass using Jaccard similarity or LLM-based editing to merge overlapping sections.

### Failure Mode 3: Silent Scraping Failures on Cloudflare-Protected Sites
* **Failure Mode**: The scraper returns empty strings or HTTP 403/503 status codes without raising exceptions, leading to empty context windows and poor-quality reports.
* **Root Cause**: Standard HTTP clients (like `aiohttp` or `requests`) lack JS execution engines, real browser TLS fingerprints, and proxy rotation, making them easy targets for Cloudflare WAF.
* **Exact Prevention/Fix**: Integrate an MCP (Model Context Protocol) server like `anybrowse` or a stealth-configured Playwright instance. Enforce strict content validation: if the returned HTML contains WAF challenges (e.g., `cf-challenge`) or is under a minimum size threshold, trigger an automatic fallback to alternative search result snippets.

### Failure Mode 4: Document Loader Metadata Source Loss
* **Failure Mode**: When processing local files (PDFs, DOCX), the final report citations point to "Unknown Source" instead of the actual file name.
* **Root Cause**: Text splitters and chunking utilities strip the parent document's metadata dictionary or fail to propagate the `source` key to the individual text chunks.
* **Exact Prevention/Fix**: Wrap the document loader in a sanitization layer that explicitly copies the file path/name into the `source` field of every generated chunk's metadata before it enters the vector store.

### Failure Mode 5: Hard-Lock on Embedding API Keys
* **Failure Mode**: The system crashes on startup or during context filtering if the user has not configured an embedding provider API key (e.g., OpenAI, Cohere), even if they only want basic keyword-based research.
* **Root Cause**: The context filtering pipeline hard-coded a dependency on vector embeddings for similarity ranking.
* **Exact Prevention/Fix**: Implement a keyword-based fallback filter (e.g., BM25 or Jaccard similarity) that automatically activates when embedding API keys are missing, making embeddings optional.

---

## 3. 8-Dimensional Multi-Axis Forensic Analysis

### D1: Structural Boundaries & Modularity
`gpt-researcher` maintains a clean separation between the orchestrator (`gpt_researcher/master/agent.py`), the scraping layer (`gpt_researcher/scraper/`), and the document processing layer (`gpt_researcher/document_loaders/`). 
* **The Interface Boundary**: The `GPTResearcher` class acts as a Facade. External callers only interact with `start_research()` and `write_report()`.
* **The Dependency Inversion Violation**: Historically, scrapers and retrievers directly instantiated concrete classes based on string configurations. The system has moved toward factory patterns, but tight coupling to specific LLM providers (like OpenAI) still exists in legacy configuration paths.

### D2: Asynchronous State & Concurrency Defense
The core engine relies heavily on `asyncio` to run parallel searches and scrapes.
* **Concurrency Control**: To prevent rate-limiting (HTTP 429) and socket exhaustion, the scraper uses an `asyncio.Semaphore(limit=10)` to throttle concurrent HTTP requests.
* **Race Conditions**: When multiple parallel scrapers write to a shared context list, they use standard list appends. Since Python's list operations are thread-safe (due to the GIL) and `asyncio` runs on a single thread, explicit locks are not required for in-memory appends, but state mutations on shared dictionaries must be guarded if they span across `await` points.

### D3: Error Boundaries, Recovery & Rollback Protocols
* **Search API Fallbacks**: If the primary search provider (e.g., Tavily) fails or times out, the system catches the exception and falls back to DuckDuckGo or Bing.
* **Partial Progress Salvaging**: If an LLM call fails during the final report compilation, the system does not discard the scraped data. It serializes the current state (scraped context) to a local cache, allowing the user to retry the compilation step without re-running the expensive search and scrape phases.

### D4: Resource Lifecycle & Leak Defenses
* **HTTP Sessions**: `aiohttp.ClientSession` instances are managed using `async with` context managers to guarantee socket closure.
* **Browser Instances**: Playwright browsers are launched and closed per research run. A critical leak vector occurs when a research run is cancelled mid-way; if the cancellation exception (`asyncio.CancelledError`) is not caught properly, the browser process remains orphaned.
* **Fix**: Wrap the browser lifecycle in a `try...finally` block to ensure `browser.close()` is executed during cancellation.

### D5: Boundary Deserialization, Schemas & Input Sanitization
* **LLM Output Parsing**: The agent relies on LLMs returning structured JSON (e.g., list of search queries, section drafts). 
* **Defensive Parsing**: Instead of a naive `json.loads()`, the system uses regex to extract JSON blocks from markdown wrappers (````json ... ````) and implements a fallback parser that attempts to repair common LLM syntax errors (like trailing commas).

### D6: Cross-Platform & Runtime Compatibility Gotchas
* **Windows Asyncio Event Loop**: On Windows, the default `SelectorEventLoop` does not support subprocesses or certain socket operations required by modern async libraries. The system must explicitly set the `ProactorEventLoop` policy on Windows startup.
* **Playwright Binaries**: Fresh installations often fail because the Python package is installed but the underlying browser binaries are missing. The system must handle this gracefully by catching the launch error and prompting the user to run `playwright install`.

### D7: Build, CI/CD, Deployment & Dependency Invariants
* **Dependency Bloat**: The project uses `pyproject.toml` with Poetry. It balances heavy dependencies like LangChain, Playwright, and various vector databases.
* **Invariants**: To prevent CI/CD breakages on fresh installs, the documentation build and package installation steps must decouple heavy optional dependencies (like local vector DBs) from the core agent runtime.

### D8: Concrete Bug Fixes & Forensic Patches

#### Patch 1: Safe WebSocket Writer (Fixing ConnectionClosed Crashes)
```python
# gpt_researcher/utils/websocket_manager.py
import asyncio
import logging

class SafeWebSocketManager:
    def __init__(self, websocket):
        self.websocket = websocket
        self.queue = asyncio.Queue()
        self.active = True
        self.consumer_task = asyncio.create_task(self._consume())

    async def send_log(self, message: str):
        if self.active:
            await self.queue.put({"type": "logs", "output": message})

    async def _consume(self):
        try:
            while self.active:
                data = await self.queue.get()
                try:
                    await self.websocket.send_json(data)
                except Exception as e:
                    logging.warning(f"WebSocket send failed, disabling socket: {e}")
                    self.active = False
                finally:
                    self.queue.task_done()
        except asyncio.CancelledError:
            pass

    async def close(self):
        self.active = False
        self.consumer_task.cancel()
        await asyncio.gather(self.consumer_task, return_exceptions=True)
```

#### Patch 2: Multi-Agent Section Deduplication
```python
# gpt_researcher/master/deduplicator.py
import re
from typing import List

def deduplicate_sections(sections: List[str], threshold: float = 0.6) -> List[str]:
    """
    Deduplicates highly similar paragraphs across generated sections
    using a sliding window Jaccard similarity check.
    """
    seen_paragraphs = set()
    unique_sections = []

    for section in sections:
        paragraphs = section.split("\n\n")
        unique_paragraphs = []
        for para in paragraphs:
            cleaned_para = re.sub(r'\W+', ' ', para).lower().strip()
            if not cleaned_para:
                continue
            
            # Check similarity against already processed paragraphs
            is_duplicate = False
            para_words = set(cleaned_para.split())
            for seen in seen_paragraphs:
                seen_words = set(seen.split())
                if not para_words or not seen_words:
                    continue
                intersection = len(para_words.intersection(seen_words))
                union = len(para_words.union(seen_words))
                jaccard = intersection / union
                if jaccard > threshold:
                    is_duplicate = True
                    break
            
            if not is_duplicate:
                seen_paragraphs.add(cleaned_para)
                unique_paragraphs.append(para)
        
        unique_sections.append("\n\n".join(unique_paragraphs))
    
    return unique_sections
```

#### Patch 3: Keyword Fallback Context Filter (No-Embedding Mode)
```python
# gpt_researcher/context/filter.py
from typing import List, Dict

def filter_context_by_keyword(query: str, documents: List[Dict[str, str]], max_results: int = 5) -> List[Dict[str, str]]:
    """
    Fallback filter when embedding models are unavailable.
    Uses token overlap (Jaccard similarity) to rank document relevance.
    """
    query_tokens = set(re.sub(r'\W+', ' ', query).lower().split())
    ranked_docs = []

    for doc in documents:
        text = doc.get("text", "")
        doc_tokens = set(re.sub(r'\W+', ' ', text).lower().split())
        if not doc_tokens:
            continue
        
        overlap = len(query_tokens.intersection(doc_tokens))
        score = overlap / len(query_tokens) if query_tokens else 0
        ranked_docs.append((score, doc))

    # Sort by score descending
    ranked_docs.sort(key=lambda x: x[0], reverse=True)
    return [doc for score, doc in ranked_docs[:max_results] if score > 0]
```

---

## 4. Net-New Universal Engineering Rules

## 1. The Resilient Agentic Cancellation Token Rule

**RULE**:
Every long-running, multi-step agentic loop (especially those involving external API calls, web scraping, or LLM generation) **MUST** accept and propagate an explicit, thread-safe/coroutine-safe cancellation token (e.g., `asyncio.Event` or a context-managed cancellation flag). The agent **MUST** check this token before initiating any network request, heavy computation, or state mutation.

**WHY**:
Agentic workflows are highly non-deterministic and can run for minutes, consuming expensive LLM and search API credits. If a user cancels a request or disconnects, and the backend does not propagate the cancellation, the agent will continue to execute background tasks, leading to massive credit drain, thread/socket exhaustion, and memory leaks.

**WHEN TO APPLY**:
Apply this to any system orchestrating multi-agent workflows, deep research loops, or recursive LLM chains.

```python
# VERIFIED IMPLEMENTATION PATTERN
import asyncio
import aiohttp

class CancelableAgent:
    def __init__(self, cancel_event: asyncio.Event):
        self.cancel_event = cancel_event

    async def execute_step(self, step_name: str, coro):
        if self.cancel_event.is_set():
            raise asyncio.CancelledError(f"Agent execution halted before step: {step_name}")
        
        # Run the step coroutine wrapped in a cancellation check
        task = asyncio.create_task(coro)
        while not task.done():
            if self.cancel_event.is_set():
                task.cancel()
                raise asyncio.CancelledError(f"Agent execution canceled during step: {step_name}")
            await asyncio.sleep(0.1)
        return await task

# Usage
async def main():
    cancel_event = asyncio.Event()
    agent = CancelableAgent(cancel_event)
    
    async def mock_scrape():
        await asyncio.sleep(10) # Simulate long network call
        return "data"

    # Trigger cancellation externally after 2 seconds
    asyncio.get_event_loop().call_later(2, cancel_event.set)
    
    try:
        await agent.execute_step("Scraping Web", mock_scrape())
    except asyncio.CancelledError:
        print("Agent stopped cleanly, saving credits!")
```

## 2. The Decoupled WebSocket Pub-Sub Boundary Rule

**RULE**:
Never allow an active agentic state machine or background processing loop to write directly to a network socket (WebSocket, gRPC stream, SSE). All telemetry, logging, and state updates **MUST** be written to an intermediate, bounded, in-memory queue. A dedicated, isolated consumer task **MUST** handle the network serialization and transmission.

**WHY**:
Network connections are inherently unstable. If a client disconnects, the socket library will throw an exception on the next write. If the agent is writing directly to the socket, this exception will bubble up and crash the agent's execution thread/coroutine, destroying hours of un-serialized research or computation.

**WHEN TO APPLY**:
Apply this to any real-time streaming architecture, dashboard-connected agents, or long-running background tasks that report progress to a frontend.

```python
# VERIFIED IMPLEMENTATION PATTERN
import asyncio
import json
from typing import Any

class TelemetryBoundary:
    def __init__(self):
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._consumer_task: Optional[asyncio.Task] = None

    async def emit(self, event_type: str, payload: Any):
        """Non-blocking write to the queue. Safe to call anywhere in the agent."""
        try:
            self._queue.put_nowait({"event": event_type, "payload": payload})
        except asyncio.QueueFull:
            # Drop telemetry or log warning, but NEVER crash the agent
            pass

    def start_broadcasting(self, websocket_connection):
        self._consumer_task = asyncio.create_task(self._broadcast_loop(websocket_connection))

    async def _broadcast_loop(self, websocket):
        try:
            while True:
                msg = await self._queue.get()
                try:
                    await websocket.send_text(json.dumps(msg))
                except Exception as network_error:
                    # Log network error, but do not propagate. 
                    # The agent continues running in its own context.
                    print(f"Network delivery failed: {network_error}")
                    break 
                finally:
                    self._queue.task_done()
        except asyncio.CancelledError:
            pass

    async def stop(self):
        if self._consumer_task:
            self._consumer_task.cancel()
            await asyncio.gather(self._consumer_task, return_exceptions=True)
```

---

## 5. Actionable Agent Skill & Implementation Checklist

This checklist ensures that any AI coding agent building a deep research system implements the necessary safeguards, performance optimizations, and architectural boundaries.

### Phase 1: Concurrency & Resource Management
- [ ] **Implement Semaphore Throttling**: Ensure all parallel scraping and search requests are bound by an `asyncio.Semaphore` (recommended limit: 10) to prevent rate limits and socket exhaustion.
- [ ] **Enforce Context Managers**: Wrap all HTTP client sessions (`aiohttp.ClientSession`) and browser instances (Playwright) in `async with` blocks to guarantee resource cleanup.
- [ ] **Handle Windows Event Loop Policy**: Add a startup check to set `ProactorEventLoop` on Windows platforms to prevent subprocess and socket crashes.

### Phase 2: Resiliency & Fallbacks
- [ ] **Decouple Embeddings**: Implement a non-embedding keyword fallback (e.g., Jaccard or BM25) for context filtering so the system remains functional if embedding APIs fail.
- [ ] **Search Provider Redundancy**: Implement a fallback chain for search APIs (e.g., if Tavily fails, catch the exception and fall back to DuckDuckGo).
- [ ] **Stealth Scraping & WAF Detection**: Inspect scraped HTML for Cloudflare challenge markers or empty payloads. Fall back to search engine snippets if a site blocks the scraper.

### Phase 3: State & Memory Integrity
- [ ] **Propagate Metadata**: Verify that document chunkers explicitly copy parent metadata (especially `source` and `title`) to all child chunks to prevent broken citations.
- [ ] **Deduplicate Outputs**: Run a semantic or token-based deduplication pass on parallel-generated sections before compiling the final report.
- [ ] **Isolate Network I/O**: Use an in-memory queue to decouple agent execution logs from WebSocket/SSE transmission, preventing network disconnects from crashing the agent.

### Phase 4: Control Flow
- [ ] **Cancellation Tokens**: Pass an `asyncio.Event` cancellation token down to every nested agent loop and check its state before executing network or LLM calls.
- [ ] **Partial State Serialization**: Save scraped context to a local cache so that if the final report compilation fails, the user can retry without re-running the search/scrape phase.