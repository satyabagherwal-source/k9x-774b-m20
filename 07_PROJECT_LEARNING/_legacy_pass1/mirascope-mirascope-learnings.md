# Forensic Learning Record (Deep Inspection): Mirascope/mirascope

> **Canonical Artifact**: `07_PROJECT_LEARNING/mirascope-mirascope-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Mirascope/mirascope](https://github.com/Mirascope/mirascope))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T23:26:27.664Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Mirascope/mirascope`
- **Description**: The LLM Anti-Framework
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1529 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `python/examples/agents/basic.py`
```
import json
import tempfile
from pathlib import Path

from mirascope import llm

# For safety, the agent may only operate within this workspace.
WORKSPACE = Path(tempfile.mkdtemp(prefix="agent_"))


def resolve_path(path_str: str) -> Path | None:
    """Resolve a path within the workspace, returning None if it escapes."""
    path = (WORKSPACE / path_str).resolve()
    if WORKSPACE.resolve() not in path.parents and path != WORKSPACE.resolve():
        return None
    return path


@llm.tool
def list_files(directory: str = ".") -> str:
    """List files in a directory."""
    path = resolve_path(directory)
    if path is None:
        return "Error: Path is outside the workspace"
    if not path.exists():
        return f"Directory not found: {directory}"
    files = [f.name + ("/" if f.is_dir() else "") for f in path.iterdir()]
    return "\n".join(files) if files else "(empty directory)"


@llm.tool
def read_file(filepath: str) -> str:
    """Read the contents of a file."""
    path = resolve_path(filepath)
    if path is None:
        return "Error: Path is outside the workspace"
    if not path.exists():
        return f"File not found: {filepath}"
    return path.read_text()


@llm.tool
def write_file(filepath: str, content: str) -> str:
    """Write content to a file."""
    path = resolve_path(filepath)
    if path is None:
        return "Error: Path is outside the workspace"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    return f"Wrote {len(content)} bytes to {filepath}"


def display_tool_call(tool_call: llm.ToolCall) -> str:
    args = json.loads(tool_call.args)
    match tool_call.name:
        case "list_files":
            return f"[Tool] List files in '{args.get('directory', '.')}'"
        case "read_file":
            return f"[Tool] Read '{args['filepath']}'"
        case "write_file":
            return f"[Tool] Write '{args['filepath']}'"
        case _:
            return f"[Tool]: {tool_call.name}"


def run_agent(model_id: llm.ModelId, query: str):
    model = llm.model(model_id, thinking={"level": "medium", "include_thoughts": True})
    response = model.stream(query, tools=[list_files, read_file, write_file])

    while True:  # The Agent Loop
        for stream in response.streams():
            match stream.content_type:
                case "text":
                    for chunk in stream:
                        print(chunk, flush=True, end="")
                    print("\n")
                case "thought":
                    print("<Thinking>\n", flush=True)
                    for chunk in stream:
                        print(chunk, flush=True, end="")
                    print("</Thinking>\n", flush=True)
                case "tool_call":
                    tool_call = stream.collect()
                    print(display_tool_call(tool_call) + "\n")

        if not response.tool_calls:
            break  # Agent is finished.

        response = response.resume(response.execute_tools())


run_agent(
    "anthropic/claude-sonnet-4-5",
    "Create a calculator module (calc.py) with add, subtract, multiply, divide "
    "functions, then create a test file (test_calc.py) that tests each function.",
)
print(f"View the agent's work in this directory: {WORKSPACE}\n")

```

### Core Architecture Module: `python/examples/async/async_streaming.py`
```
import asyncio

from mirascope import llm


@llm.call("openai/gpt-5-mini")
async def recommend_book(genre: str):
    return f"Recommend a {genre} book."


async def main():
    response = await recommend_book.stream("fantasy")
    async for chunk in response.text_stream():
        print(chunk, end="", flush=True)


asyncio.run(main())

```

### Core Architecture Module: `python/examples/async/async_tools.py`
```
import asyncio

from mirascope import llm


@llm.tool
async def fetch_weather(city: str) -> str:
    """Fetch current weather for a city."""
    await asyncio.sleep(0.1)  # Simulate async API call
    return f"72°F and sunny in {city}"


@llm.call("openai/gpt-5-mini", tools=[fetch_weather])
async def weather_assistant(query: str):
    return query


async def main():
    response = await weather_assistant("What's the weather in Tokyo?")

    while response.tool_calls:
        tool_outputs = await response.execute_tools()
        response = await response.resume(tool_outputs)

    print(response.pretty())


asyncio.run(main())

```

### Core Architecture Module: `python/examples/async/basic.py`
```
import asyncio

from mirascope import llm


@llm.call("openai/gpt-5-mini")
async def recommend_book(genre: str):
    return f"Recommend a {genre} book."


async def main():
    response = await recommend_book("fantasy")
    print(response.text())


asyncio.run(main())

```

### Core Architecture Module: `python/examples/async/basic_model.py`
```
import asyncio

from mirascope import llm

model = llm.Model("openai/gpt-5-mini")


async def main():
    response: llm.AsyncResponse = await model.call_async("Recommend a fantasy book.")
    print(response.text())


asyncio.run(main())

```

### Core Architecture Module: `python/examples/async/basic_prompt.py`
```
import asyncio

from mirascope import llm


@llm.prompt
async def recommend_book(genre: str):
    return f"Recommend a {genre} book."


async def main():
    response: llm.AsyncResponse = await recommend_book("openai/gpt-5-mini", "fantasy")
    print(response.text())


asyncio.run(main())

```

### Core Architecture Module: `python/examples/async/parallel.py`
```
import asyncio

from mirascope import llm


@llm.call("openai/gpt-5-mini")
async def recommend_book(genre: str):
    return f"Recommend a {genre} book."


async def main():
    genres = ["fantasy", "mystery", "romance"]
    responses = await asyncio.gather(*[recommend_book(genre) for genre in genres])

    for genre, response in zip(genres, responses, strict=False):
        print(f"[{genre}]: {response.pretty()}\n")


asyncio.run(main())

```

### Core Architecture Module: `python/examples/calls/access_prompt.py`
```
from mirascope import llm


@llm.call("openai/gpt-5-mini")
def recommend_book(genre: str):
    return f"Please recommend a book in {genre}."


# A Call is just a Prompt + a bundled model
# recommend_book() is equivalent to:
# recommend_book.prompt(recommend_book.model, ...)

# Access Call properties
print(recommend_book.default_model)  # The bundled model
print(recommend_book.model)  # The model that will be used (respects context overrides)
print(recommend_book.prompt)  # The underlying Prompt

# Use the prompt directly with a different model
response = recommend_book.prompt("anthropic/claude-sonnet-4-5", "fantasy")
print(response.pretty())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2648** (2026-03-13): **fix(cloud): claw creation modal hangs during provisioning**
  *Symptoms*: ## Bug  When clicking "Create" in the create claw modal, the modal hangs for a long time waiting for the API to return. The modal eventually closes but drops back to the org page with stale cache — the new claw doesn't appear until several hard refreshes, at which point it shows in "provisioning" state.  ## Expected  Click "Create" → modal closes instantly → claw appears in the list with status "provisioning".  ## Root Cause (Initial Analysis)  `createClawHandler` in `cloud/api/claws.handlers.ts` does everything synchronously in one Effect pipeline: 1. DB insert (fast) 2. R2 bucket provisioning via `clawDeployment.provision()` (slow — Cloudflare API) 3. Secret encryption + DB update (fast) 4. Container warm-up via `clawDeployment.warmUp()` (slow — cold start)  Steps 2 and 4 are the bottleneck. The API doesn't return until the entire pipeline completes, keeping the modal spinner alive.  ## Proposed Approach  Split into fast path (return immediately) and background work: - **Fast path**: DB insert → return claw with status "provisioning" → modal closes - **Background**: R2 provisioning → encrypt secrets → DB update → warm-up (fire-and-forget or via queue)  Also: the frontend should invalidate the claws query cache after creation so the new claw appears immediately.  ## Files  - `cloud/api/claws.handlers.ts` — `createClawHandler` - `cloud/app/components/create-claw-modal.tsx` — frontend modal - `cloud/claws/deployment/` — provisioning service  Reported by Dandelion.

- **Issue #2503** (2026-09-25): **`response.resume` broken when using structured outputs with Anthropic in tool mode**
  *Symptoms*: ### Description  Consider the following script:  ```python from mirascope import llm   @llm.call("anthropic/claude-sonnet-4-5", format=int) def lucky_number():     return "Choose a lucky number between 1 and 10"   result = lucky_number() second_result = result.resume("Ok, now choose a different lucky number") ```  This is very simple and should work. However, it raises the following error:  ``` mirascope.llm.exceptions.BadRequestError: Error code: 400 - {'type': 'error', 'error': {'type': 'invalid_request_error', 'message': 'messages.2: `tool_use` ids were found without `tool_result` blocks immediately after: toolu_01NUbw5mvfYRWaDHvMi1xYK1. Each `tool_use` block must have a corresponding `tool_result` block in the next message.'}, 'request_id': 'req_011CXxuFSqH1PCSqbYYrukMX'} ```  The issue is that: 1. Anthropic provider uses tool mode by default 2. Tool mode injects a special MIRASCOPE_FORMAT_TOOL, which is used for the output 3. When Mirascope processes the assistant message, it converts the tool call into a text block that contains the expected output. There is never a corresponding user block with tool output (because the format tool is never called) 4. When re-encoding the message history to send to Anthropic, we use the raw representation (unprocessed) which still has a tool call 5. Anthropic rejects the request because the tool was never called  Solutions that come to mind include: 1. When encoding the assistant message, check if it contained a format tool invocation, 

- **Issue #2412** (2026-02-12): **Windows clone fails due to invalid filename with colon (:)**
  *Symptoms*: ### Description  Cloning the Mirascope repository on Windows fails because file contains a colon (:) in its name, which is not allowed on Windows file systems. This prevents Git from checking out the working tree.  **Problematic file** typescript/tests/e2e/input/cassettes/audio/openai:completions/encodes-audio-content.har  **Steps to reproduce** 1. On a Windows machine, run:    git clone https://github.com/Mirascope/mirascope.git 2. Observe the error:    fatal: unable to checkout working tree    invalid path 'typescript/tests/e2e/input/cassettes/audio/openai:completions/encodes-audio-content.har'  ### Python, Mirascope & OS Versions, related packages  ```TOML Python version: Python 3.12.4 Mirascope version: 2.2.0 Operating System: Windows 11 Microsoft Windows [Version 10.0.26100.7623] ```  <img width="955" height="358" alt="Image" src="https://github.com/user-attachments/assets/5637f6aa-01be-44cf-bcde-0540f1a6fd02" />
  **Post-Mortem & Fix Analysis**:
  > We've merged in a fix to main. Let us know if you're still having any issues!
  > > We've merged in a fix to main. Let us know if you're still having any issues!  its working!! thanks!!!

- **Issue #2389** (2026-02-04): **Markdown in user message renders terribly**
  *Symptoms*: ### Description  <img width="669" height="565" alt="Image" src="https://github.com/user-attachments/assets/bab8118e-119e-421e-9d4d-2425686ca335" />  ### Python, Mirascope & OS Versions, related packages (not required)  ```TOML  ```

- **Issue #2332** (2026-02-10): **Refresh resets to a different project/environment than the one selected**
  *Symptoms*: ### Description  Steps to repro: 1. Create two projects 2. Select the second project 3. Refresh  ### Python, Mirascope & OS Versions, related packages (not required)  ```TOML  ```
  **Post-Mortem & Fix Analysis**:
  > This is fixed now

- **Issue #2165** (2026-03-20): **Tool call (when not complete with its tool output) renders without parameters**
  *Symptoms*: ### Description  <img width="1079" height="523" alt="Image" src="https://github.com/user-attachments/assets/5ef19f17-3ef2-4572-9087-6ea26488baff" />  ### Python, Mirascope & OS Versions, related packages (not required)  ```TOML  ```
  **Post-Mortem & Fix Analysis**:
  > Given that we've dropped support for cloud this is no longer relevant

- **Issue #2164** (2026-02-10): **Signature/Code styling is wrong in the span more details view**
  *Symptoms*: ### Description  Bad dark mode (no styling): <img width="663" height="226" alt="Image" src="https://github.com/user-attachments/assets/53f220b7-1bc5-4faa-a36e-6a305d2d6647" />  Totally fine in light mode (styled): <img width="661" height="222" alt="Image" src="https://github.com/user-attachments/assets/f049d3e2-3f27-45d9-acdf-56f02ee928e1" />  ### Python, Mirascope & OS Versions, related packages (not required)  ```TOML  ```
  **Post-Mortem & Fix Analysis**:
  > This is resolved

- **Issue #2112** (2026-01-23): **`ops.version(tags=["..."])` runs but the trace in Mirascope Cloud causes an error**
  *Symptoms*: ### Description  ```python import os from typing import Literal  from mirascope import llm, ops  ops.configure()  @ops.version(tags=["tag"])  # this causes failures when trying to view the trace @llm.call("openai/gpt-4o-mini") def my_call(query: str) -> str:     return query  my_call("we should fix this") ```  ### Python, Mirascope & OS Versions, related packages (not required)  ```TOML mirascope[all]==2.0.1 ```

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

### Incident Patch 1: `2c0fa536` (2026-09-28)
**Commit Message**: chore: update GitHub repository stats [skip ci]

**File**: `website/app/lib/github-stats.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "mirascope": {
-    "stars": 1528,
+    "stars": 1529,
     "version": "v2.5.0"
   }
 }
```

---

### Incident Patch 2: `d6f22cdf` (2026-09-24)
**Commit Message**: chore: update GitHub repository stats [skip ci]

**File**: `website/app/lib/github-stats.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "mirascope": {
-    "stars": 1527,
+    "stars": 1528,
     "version": "v2.5.0"
   }
 }
```

---

### Incident Patch 3: `32302bbc` (2026-09-22)
**Commit Message**: chore: update GitHub repository stats [skip ci]

**File**: `website/app/lib/github-stats.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "mirascope": {
-    "stars": 1525,
+    "stars": 1527,
     "version": "v2.5.0"
   }
 }
```

---

### Incident Patch 4: `44ddbf0d` (2026-09-20)
**Commit Message**: chore: update GitHub repository stats [skip ci]

**File**: `website/app/lib/github-stats.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "mirascope": {
-    "stars": 1526,
+    "stars": 1525,
     "version": "v2.5.0"
   }
 }
```

---

### Incident Patch 5: `b9c06695` (2026-09-13)
**Commit Message**: chore: update GitHub repository stats [skip ci]

**File**: `website/app/lib/github-stats.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "mirascope": {
-    "stars": 1525,
+    "stars": 1526,
     "version": "v2.5.0"
   }
 }
```

---

### Incident Patch 6: `debbd031` (2026-09-08)
**Commit Message**: chore: update GitHub repository stats [skip ci]

**File**: `website/app/lib/github-stats.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "mirascope": {
-    "stars": 1524,
+    "stars": 1525,
     "version": "v2.5.0"
   }
 }
```

#### Recent Merged Pull Requests:
- **PR #2889** (closed): fix: encode tool outputs as JSON instead of Python repr across all providers (@SyN-droMe)
- **PR #2877** (closed): fix(ops): emit Langfuse-compatible OpenTelemetry trace attributes (@breken-ai)
- **PR #2876** (closed): fix(ops): preserve function metadata on versioned call wrappers (@breken-ai)
- **PR #2871** (closed): docs: note OpenAI client base_url for multi-model gateways (@seven7763)
- **PR #2867** (2026-06-24): chore: bump minor version number (@willbakst)
- **PR #2865** (2026-06-24): feat(providers): add XAIProvider for Grok via Responses API (@NishchayMahor)
- **PR #2861** (closed): Add LLM cost change analysis to CI (@Jwrede)
- **PR #2857** (closed): [Graphite MQ] Draft PR GROUP:spec_a0eefe (PRs 2856) (@graphite-app[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
