# Forensic Learning Record (Deep Inspection): MervinPraison/PraisonAI

> **Canonical Artifact**: `07_PROJECT_LEARNING/mervinpraison-praisonai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MervinPraison/PraisonAI](https://github.com/MervinPraison/PraisonAI))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:57:31.078Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MervinPraison/PraisonAI`
- **Description**: PraisonAI 🦞 — Hire a 24/7 AI Workforce. Stop writing boilerplate and start shipping autonomous self-improving agents that research, plan, code, and execute tasks. Deployed in 5 lines of code with built-in memory, RAG, and support for 100+ LLMs.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 9114 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/acp/basic_acp_server.py`
```
#!/usr/bin/env python3
"""
Basic ACP Server Example

This example demonstrates how to run PraisonAI as an ACP server
that can be connected to by IDEs like Zed, JetBrains, VSCode, or Toad.

Usage:
    # Run from command line
    praisonai acp
    
    # Or run this script directly
    python basic_acp_server.py
"""

from praisonai.acp import serve

if __name__ == "__main__":
    # Start ACP server with default settings
    # This will listen on stdin/stdout for JSON-RPC messages
    serve(
        workspace=".",           # Current directory as workspace
        agent="default",         # Use default agent
        debug=False,             # Set to True for debug logging to stderr
        read_only=True,          # Safe by default
        approval_mode="manual",  # Require approval for actions
    )

```

### Core Architecture Module: `examples/acp/custom_agent_acp.py`
```
#!/usr/bin/env python3
"""
Custom Agent ACP Server Example

This example shows how to run a custom PraisonAI agent as an ACP server.

Usage:
    python custom_agent_acp.py
"""

from praisonai.acp import serve, ACPServer, ACPConfig
from praisonaiagents import Agent

# Create a custom agent
agent = Agent(
    name="CodeAssistant",
    instructions="""You are an expert coding assistant. You help users:
    - Write clean, efficient code
    - Debug issues
    - Explain complex concepts
    - Review code for best practices
    
    Always provide clear explanations with your code suggestions.""",
    model="gpt-4o-mini",
)

if __name__ == "__main__":
    # Create config
    config = ACPConfig(
        workspace=".",
        debug=True,
        allow_write=True,  # Allow file modifications
        approval_mode="manual",
    )
    
    # Create server with custom agent
    server = ACPServer(config=config, agent=agent)
    
    # Run the server
    serve(
        workspace=".",
        debug=True,
        allow_write=True,
        approval_mode="manual",
    )

```

### Core Architecture Module: `examples/agent_centric_api.py`
```
"""
Agent-Centric API Example

Demonstrates the consolidated feature parameters for PraisonAI Agents.
These params provide a cleaner, more intuitive API with progressive disclosure.

Precedence Rule: Instance > Config > Array > String > Bool > Default

Consolidated Params Support:
- memory: bool | str URL | str preset | [preset, overrides] | MemoryConfig | Instance
- knowledge: bool | str path | [sources...] | KnowledgeConfig | Instance
- planning: bool | str LLM | [preset, overrides] | PlanningConfig
- reflection: bool | str preset | [preset, overrides] | ReflectionConfig
- guardrails: bool | callable | str prompt | GuardrailConfig
- web: bool | str provider | [provider, overrides] | WebConfig
- output: str preset | [preset, overrides] | OutputConfig
- execution: str preset | [preset, overrides] | ExecutionConfig
"""

from praisonaiagents import (
    Agent,
    # Config classes for progressive disclosure
    MemoryConfig,
    KnowledgeConfig,
    PlanningConfig,
    ReflectionConfig,
    GuardrailConfig,
    WebConfig,
)


def example_simple_enable():
    """Example 1: Simple boolean enable (easiest)"""
    print("\n=== Example 1: Simple Boolean Enable ===")
    
    agent = Agent(
        instructions="You are a helpful assistant",
        memory=True,      # Enable memory with defaults
        reflection=True,  # Enable self-reflection
        web=WebConfig(fetch=False),         # Enable web search + fetch
    )
    print(f"Agent created with memory={agent._memory_instance is not None}")
    print(f"  self_reflect={agent.self_reflect}")
    print(f"  web_search={agent.web_search}")


def example_with_config():
    """Example 2: Using config objects (more control)"""
    print("\n=== Example 2: Using Config Objects ===")
    
    agent = Agent(
        instructions="You are a research assistant",
        memory=MemoryConfig(
            backend="file",
            user_id="researcher_001",
            auto_memory=True,
        ),
        reflection=ReflectionConfig(
            min_iterations=1,
            max_iterations=5,
            llm="gpt-4o-mini",
        ),
        web=WebConfig(
            search=True,
            fetch=False,  # Only search, no full page fetch
            max_results=3,
        ),
    )
    print(f"Agent created with user_id={agent.user_id}")
    print(f"  {agent.max_reflect}")
    print(f"  web_search={agent.web_search}, web_fetch={agent.web_fetch}")


def example_guardrails():
    """Example 3: Guardrails with callable or config"""
    print("\n=== Example 3: Guardrails ===")
    
    # Option A: Direct callable
    def my_validator(output):
        """Simple validator that checks response length."""
        is_valid = len(output.raw) < 1000
        return (is_valid, output if is_valid else "Response too long")
    
    agent_a = Agent(
        instructions="Be concise",
        guardrails=my_validator,  # Direct callable
    )
    print(f"Agent A: guardrail is callable = {callable(agent_a.guardrail)}")
    
    # Option B: Using GuardrailConfig
    agent_b = Agent(
        instructions="Be helpful and safe",
        guardrails=GuardrailConfig(
            llm_validator="Ensure the response is helpful, accurate, and safe",
            max_retries=3,
        ),
    )
    print(f"Agent B: guardrail = {agent_b.guardrail}")
    print(f"  max_retries = {agent_b.max_guardrail_retries}")


def example_planning():
    """Example 4: Planning mode"""
    print("\n=== Example 4: Planning Mode ===")
    
    agent = Agent(
        instructions="You are a project planner",
        planning=PlanningConfig(
            reasoning=True,
            read_only=True,  # Plan mode - only read operations
        ),
    )
    print(f"Agent created with planning={agent.planning}")
    print(f"  plan_mode={agent.plan_mode}")
    print(f"  planning_reasoning={agent.planning_reasoning}")


def example_backward_compatible():
    """Example 5: Using new consolidated params"""
    print("\n=== Example 5: Consolidated Params ===")
    
    # New consolidated params
    agent = Agent(
        instructions="Test agent",
        reflection=True,
        web=WebConfig(search=True, fetch=False),
    )
    print(f"Consolidated params work: self_reflect={agent.self_reflect}")
    print(f"  web_search={agent.web_search}, web_fetch={agent.web_fetch}")


def example_real_chat():
    """Example 6: Real chat with new API"""
    print("\n=== Example 6: Real Chat ===")
    
    agent = Agent(
        instructions="You are a helpful math tutor. Be concise.",
        reflection=False,
        web=False,
    )
    
    response = agent.start("What is the square root of 144?")
    print(f"Response: {response}")


def example_string_presets():
    """Example 7: String presets (NEW - user-friendly shortcuts)"""
    print("\n=== Example 7: String Presets ===")
    
    # Output presets: minimal, normal, verbose, debug, silent
    agent = Agent(
        instructions="You are a verbose assistant",
        output="verbose",      # String preset for output
        execution="fast",      # String preset for execution
        web=["tavily", {"fetch": False}],          # String preset with override for web provider
    )
    print(f"Output preset 'verbose': verbose={agent.verbose}, metrics={agent.metrics}")
    print(f"Execution preset 'fast': max_iter={agent.max_iter}")
    print(f"Web preset 'tavily': web_search={agent.web_search}")


def example_array_overrides():
    """Example 8: Array with overrides (NEW - preset + customization)"""
    print("\n=== Example 8: Array Overrides ===")
    
    # Array format: [preset, {overrides}]
    agent = Agent(
        instructions="You are a streaming assistant",
        output=["verbose", {"stream": True}],      # Verbose preset + enable streaming
        execution=["fast", {"max_iter": 15}],      # Fast preset + custom max_iter
    )
    print(f"Output array override: verbose={agent.verbose}, stream={agent.stream}")
    print(f"Execution array override: max_iter={agent.max_iter}")


def example_url_parsing():
    """Example 9: URL parsing for memory (NEW - connection strings)"""
    print("\n=== Example 9: URL Parsing ===")
    
    # Memory supports URL connection strings
    # Supported schemes: sqlite://, mongodb://, mongodb+srv://
    agent = Agent(
        instructions="You are a database-backed assistant",
        memory="mongodb://user:password@localhost:27017/praisonai",
    )
    print("Memory URL parsed: memory enabled")
    
    # Also works with presets
    agent2 = Agent(
        instructions="You are a sqlite-backed assistant",
        memory="sqlite",  # Preset name
    )
    print("Memory preset 'sqlite': configured")


def example_knowledge_sources():
    """Example 10: Knowledge with sources (list and string)"""
    print("\n=== Example 10: Knowledge Sources ===")
    
    # Single path string
    agent1 = Agent(
        instructions="You are a document assistant",
        knowledge="docs/",  # Single path
    )
    print(f"Knowledge single path: knowledge={agent1.knowledge}")
    
    # List of sources
    agent2 = Agent(
        instructions="You are a multi-source assistant",
        knowledge=["docs/", "data.pdf", "https://example.com/api"],
    )
    print(f"Knowledge list: knowledge={agent2.knowledge}")
    
    # With config for advanced settings
    agent3 = Agent(
        instructions="You are an advanced RAG assistant",
        knowledge=KnowledgeConfig(
            sources=["docs/"],
            retrieval_k=10,
            rerank=True,
        ),
    )
    print("Knowledge config: configured with rerank")


if __name__ == "__main__":
    print("=" * 60)
    print("PraisonAI Agent-Centric API Examples")
    print("=" * 60)
    
    example_simple_enable()
    example_with_config()
    example_guardrails()
    example_planning()
    example_backward_compatible()
    example_real_chat()
    example_string_presets()
    example_array_overrides()
    example_url_parsing()
    example_knowledge_sources()
 
```

### Core Architecture Module: `examples/agent_tools/agent_centric_example.py`
```
"""
Agent-Centric Tools Example

This example demonstrates how to use LSP/ACP-powered tools that make
the Agent the central orchestrator for file operations.

How to run:
    export OPENAI_API_KEY=your_key
    python examples/agent_tools/agent_centric_example.py

Prerequisites:
    pip install praisonai praisonaiagents
"""

import asyncio
import os
import sys
import tempfile
import shutil

# Add paths for development
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/praisonai'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../src/praisonai-agents'))


async def main():
    print("=" * 60)
    print("AGENT-CENTRIC TOOLS EXAMPLE")
    print("=" * 60)
    print()
    
    # Create temporary workspace
    workspace = tempfile.mkdtemp(prefix="praisonai_example_")
    print(f"Workspace: {workspace}")
    print()
    
    try:
        # Import after path setup
        from praisonai.cli.features import (
            create_agent_centric_tools,
            InteractiveRuntime,
            RuntimeConfig
        )
        from praisonaiagents import Agent
        
        # 1. Create runtime with ACP enabled
        print("1. Creating InteractiveRuntime with ACP...")
        config = RuntimeConfig(
            workspace=workspace,
            lsp_enabled=False,  # Skip LSP for this example
            acp_enabled=True,
            approval_mode="auto"  # Auto-approve for demo
        )
        runtime = InteractiveRuntime(config)
        status = await runtime.start()
        
        print(f"   ACP ready: {runtime.acp_ready}")
        print(f"   Read-only: {runtime.read_only}")
        print()
        
        # 2. Create agent-centric tools
        print("2. Creating agent-centric tools...")
        tools = create_agent_centric_tools(runtime)
        print(f"   Tools created: {len(tools)}")
        for tool in tools:
            print(f"     - {tool.__name__}")
        print()
        
        # 3. Create Agent with ACP-powered tools
        print("3. Creating Agent with ACP-powered tools...")
        agent = Agent(
            name="FileAgent",
            instructions="""You help create and manage files. 
            Use acp_create_file to create files.
            Use read_file to read files.
            Use list_files to list directory contents.""",
            tools=tools,
            output="verbose"  # Use new consolidated param
        )
        print()
        
        # 4. Ask agent to create a file
        print("4. Asking agent to create a Python file...")
        print("-" * 40)
        result = agent.start(
            "Create a Python file called calculator.py with add and subtract functions"
        )
        print("-" * 40)
        print(f"Agent response: {result[:200]}..." if len(str(result)) > 200 else f"Agent response: {result}")
        print()
        
        # 5. Verify file was created
        print("5. Verifying file creation...")
        calc_path = os.path.join(workspace, "calculator.py")
        if os.path.exists(calc_path):
            print(f"   ✓ File created at {calc_path}")
            with open(calc_path) as f:
                content = f.read()
                print(f"   Content preview:")
                for line in content.split('\n')[:10]:
                    print(f"     {line}")
        else:
            # Check what files exist
            files = os.listdir(workspace)
            print(f"   Files in workspace: {files}")
            for f in files:
                fp = os.path.join(workspace, f)
                if os.path.isfile(fp):
                    print(f"   ✓ Found: {f}")
        print()
        
        # 6. Ask agent to read the file
        print("6. Asking agent to read the file...")
        print("-" * 40)
        result2 = agent.start("Read the calculator.py file and tell me what functions it has")
        print("-" * 40)
        print(f"Agent response: {result2[:300]}..." if len(str(result2)) > 300 else f"Agent response: {result2}")
        print()
        
        # Cleanup
        await runtime.stop()
        
    finally:
        # Clean up workspace
        shutil.rmtree(workspace, ignore_errors=True)
        print(f"Cleaned up workspace: {workspace}")
    
    print()
    print("=" * 60)
    print("EXAMPLE COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/approval/agent_approval.py`
```
"""
Agent Approval Example
======================
Uses an AI agent as an automated reviewer to approve/deny tool calls.

Requires:
    pip install praisonaiagents
    export OPENAI_API_KEY=sk-...
"""

from praisonaiagents import Agent
from praisonaiagents.approval import AgentApproval
from praisonaiagents.tools.shell_tools import execute_command

reviewer_agent = Agent(
    name="CommandReviewer",
    instructions="Only approve read-only commands like 'ls' or 'cat'. Deny destructive commands.",
)

reviewer = AgentApproval(
    approver_agent=reviewer_agent,
)

agent = Agent(
    name="DevOps",
    instructions="You are a DevOps assistant. Use shell tools when asked.",
    tools=[execute_command],
    approval=reviewer,
)

agent.start("List files in the current directory")

```

### Core Architecture Module: `examples/approval/discord_approval.py`
```
"""
Discord Approval Example
========================
Routes tool approvals to a Discord channel.

Requires:
    pip install praisonaiagents praisonai[bot]
    export DISCORD_BOT_TOKEN=MTIz...
    export DISCORD_CHANNEL_ID=1234567890
    export OPENAI_API_KEY=sk-...
"""

from praisonaiagents import Agent
from praisonaiagents.tools.shell_tools import execute_command
from praisonai.bots import DiscordApproval

agent = Agent(
    name="DevOps",
    instructions="You are a DevOps assistant. Use shell tools when asked.",
    tools=[execute_command],
    approval=DiscordApproval(),
)

agent.start("List files in the current directory")

```

### Core Architecture Module: `examples/approval/http_approval.py`
```
# praisonai: skip=true
"""
HTTP Approval Example
=====================
Opens a local web dashboard for tool approvals.

Requires:
    pip install praisonaiagents praisonai[bot]
    export OPENAI_API_KEY=sk-...
"""

from praisonaiagents import Agent
from praisonaiagents.tools.shell_tools import execute_command
from praisonai.bots import HTTPApproval

agent = Agent(
    name="DevOps",
    instructions="You are a DevOps assistant. Use shell tools when asked.",
    tools=[execute_command],
    approval=HTTPApproval(),
)

agent.start("List files in the current directory")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #5387** (2026-09-30): **Durable SQLite stores (sessions, gateway outbox/DLQ/idempotency) have no corruption detection, repair, or forensic backup**
  *Symptoms*: ## Summary  Every "durable" store that keeps the always-on gateway honest is a SQLite file — sessions, transcripts, the async job store, and the gateway's outbox, idempotency, DLQ, inbound journal, approvals and delivery-control stores. A single **"database disk image is malformed"** — from power loss mid-write, a full disk, or WAL on a network / copy-on-write filesystem — currently surfaces as an unhandled `sqlite3.DatabaseError` on the durable path, with **no detection, no repair, no forensic backup, and no bounded-retry guard**. That is the opposite of durable: the one component whose job is to survive a crash is the one with no crash-recovery of its own. The JSON session store already quarantines corrupt files; the SQLite stores have no equivalent.  ## Current behaviour  The SQLite stores open the database and (at most) set WAL — nothing checks or recovers integrity:  - `src/praisonai-agents/praisonaiagents/session/sqlite_store.py`, `sqlite_transcript_store.py` - `src/praisonai/praisonai/jobs/store.py` (`SqliteJobStore`) - `src/praisonai-bot/praisonai_bot/bots/_outbox.py`, `_idempotency.py`, `_dlq.py`, `_ingress.py`, `_approval_store.py`, `_delivery_control_store.py`  A grep across these for `integrity_check` / `quick_check` / `.backup(` / repair / corruption latch returns **nothing**; the only durability pragma is: ```python # praisonai-bot/.../bots/_outbox.py:210 conn.execute("PRAGMA journal_mode=WAL") ``` There is also no `VACUUM` / retention maintenance on the SQLite 
  **Post-Mortem & Fix Analysis**:
  > **Claude finished @MervinPraison's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/36698402882) • [`claude/issue-5387-20260930-0948`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5387-20260930-0948) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5387-20260930-0948?quick_pull=1&title=Issue%20%235387%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235387%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### SQLite corruption detection/repair — done  **PR:** https://github.com/MervinPraison/PraisonAI/pull/5389  Added an **opt-in integrity guard on the existing central `storage/sqlite.py :: connect()`** — the single chokepoint every core durable SQLite store already routes through — so a malformed file no longer crashes the durable path with an uncaught `sqlite3.DatabaseError`.  **When `guard=True`:** - `quick_check` on open (cheap, gated on open, not the h

- **Issue #5386** (2026-09-30): **Scheduler has no provider-quota-aware hold — a rate-limited model makes unattended jobs fail every tick**
  *Symptoms*: ## Summary  When a scheduled job's model provider is rate-limited or the account is over its usage window, the scheduler keeps firing the job on **every interval**. Each tick builds an agent, calls the provider, gets a 429/quota error, records a `failed` run, and moves on — then does it all again next interval. There is no mechanism to **park the job past the provider's known-closed window** (the `Retry-After` / usage-reset the provider already tells us), and no per-job cost circuit-breaker. Incident de-duplication mutes the *alert* noise, but the job still burns requests (and often partial tokens) against a benched provider and keeps hammering it until a human intervenes.  ## Current behaviour  The gateway executor does not retry or hold within a tick — a failed run is just recorded and becomes due again on the next interval:  `src/praisonai-agents/praisonaiagents/scheduler/incidents.py` — a 429 flows into `IncidentTracker`, which groups by error signature and alerts once, but does nothing to the schedule.  `src/praisonai/praisonai/scheduler/run_policy.py` — `RunPolicy` carries a toolset deny-list, a prompt-injection scan, and a durable audit dir, but **no** quota/rate-limit hold and **no** cost circuit-breaker. `max_cost` exists only on the legacy daemon CLI, not on the executor path. There is no `hold` / `quota` / `cooldown` field on `ScheduleJob` or `RunPolicy`.  Only the **delivery HTTP layer** honours `Retry-After` (`praisonai-bot/.../scheduler/_standalone_sender.py`) —
  **Post-Mortem & Fix Analysis**:
  > **Claude finished @MervinPraison's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/36698337153) • [`claude/issue-5386-20260930-0947`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5386-20260930-0947) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5386-20260930-0947?quick_pull=1&title=Issue%20%235386%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235386%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### Scheduler provider-quota-aware hold — done ✅  Opened **[PR #5390](https://github.com/MervinPraison/PraisonAI/pull/5390)**.  - [x] Core: `hold_until` field on `ScheduleJob` + pure `quota_hold_from_failure()` next to `is_due`; `is_due` returns `False` while parked so intervening fires **coalesce** - [x] Reuse existing `error_classifier` (`classify_error`/`extract_retry_after`); added optional `cap_seconds` so a long reset window parks (bounded 24h) inste

- **Issue #5383** (2026-09-30): **Gateway sessions are addressable only by opaque id — add a canonical session-address grammar, a `session.resolve` method, and stable deep-linkable session URLs**
  *Symptoms*: ## Summary  The Gateway already persists and resumes sessions robustly, but a session can only be **addressed by its opaque runtime `session_id`** (a UUID). There is no canonical way to refer to a session by a short id, a human slug, or its label, and no stable URL/path grammar that a dashboard, a CLI, a bot deep-link, or a reconnecting client can all agree on and share.  This is a real ease-of-use and robustness gap for anyone running the Gateway as a long-lived control plane:  - A user who wants to reopen "the quarterly-report session" must first look up its UUID. - The Control UI / dashboard cannot deep-link to a session with a readable, shareable URL — it must carry the raw UUID, which leaks the runtime instance id and breaks the "clean, shareable address" expectation. - A reconnecting or cross-surface client (bot channel → dashboard → CLI) has no single addressing contract to resolve the *same* logical session from different entry points.  Sessions already have a human `label`/`title` (`session/store.py:1625` `rename_session`, and `label` fields on the session projection), so the missing piece is a **resolver and an address grammar**, not new storage.  ## Current behaviour  Sessions are keyed and addressed by the opaque `session_id` throughout:  - Resume is by opaque id + cursor. The client handshake carries `session_id`/`since` and the server replays from there — there is no friendly-ref entry point (`src/praisonai-bot/praisonai_bot/gateway/client.py`, hello/resume path
  **Post-Mortem & Fix Analysis**:
  > **Claude finished @MervinPraison's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/36694490942) • [`claude/issue-5383-20260930-0911`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5383-20260930-0911) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5383-20260930-0911?quick_pull=1&title=Issue%20%235383%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235383%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### Session Addressing Grammar + `session.resolve` — done  - [x] Read AGENTS.md + architecture rules - [x] Explore gateway/session code structure - [x] Architecture validation (core vs wrapper) - [x] Implement pure address grammar module (core) - [x] Register `session.resolve` READ method + export - [x] Test (18 new + 42 gateway tests pass, no regressions) - [x] Commit + push + create PR  **PR:** https://github.com/MervinPraison/PraisonAI/pull/5384  ### Wh

- **Issue #5381** (2026-09-30): **Core SDK: in-run context compaction defaults its trigger to a flat 8000 tokens instead of sizing to the active model's context window — premature compaction once compaction becomes the default**
  *Symptoms*: ## Summary  The hook-wired in-run compaction entry point (`Agent._apply_context_compaction` / `_apply_context_compaction_async` in `src/praisonai-agents/praisonaiagents/agent/chat_mixin.py`) sizes its compaction trigger to a **flat `8000`-token** default when `ExecutionConfig.max_context_tokens` is unset. It never consults the model-aware limit resolver (`praisonaiagents/context/budgeter.py::get_model_limit`) that the in-loop context manager on the same class already uses. With `ExecutionConfig.context_compaction` scheduled to default to `True` in the next release, this makes 8000 tokens the effective auto-compaction trigger for **every** agent that does not explicitly set `max_context_tokens` — so a 200k- or 1M-context model will start summarising/truncating at ~8k, discarding context the model could comfortably hold and paying for needless summarisation LLM calls.  ## Current behaviour  `chat_mixin.py:5750` (sync) and `chat_mixin.py:5837` (async):  ```python _max_tok = getattr(_execution_cfg, 'max_context_tokens', None) or 8000 ... _compactor = ContextCompactor(max_tokens=_max_tok, strategy=_strategy, llm_summarize_fn=_llm_fn) if not _compactor.needs_compaction(messages):   # triggers when total tokens > 8000     return False ```  `ContextCompactor.needs_compaction()` fires once the conversation exceeds `max_tokens`, so the flat `8000` governs the trigger point.  By contrast, the in-loop management path on the same class is already model-aware — `chat_mixin.py:2126-2128` / 
  **Post-Mortem & Fix Analysis**:
  > **Claude finished @MervinPraison's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/36693356511) • [`claude/issue-5381-20260930-0901`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5381-20260930-0901) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5381-20260930-0901?quick_pull=1&title=Issue%20%235381%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235381%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### Fixing in-run context compaction default sizing  - [x] Read AGENTS.md & relevant source files - [x] Verify current behaviour in chat_mixin.py (`:5750` sync, `:5837` async used flat `or 8000`) - [x] Check budgeter.py helpers (`get_model_limit`, `get_output_reserve` exist) - [x] Implement model-aware default in sync + async compaction paths - [x] Add unit tests - [x] Run tests (13 + 126 passed, no regressions) - [x] Commit, push, create PR  ### Summary T

- **Issue #5379** (2026-09-30): **wrapper: guardrails fail open on any error, PraisonAIDB.export_session breaks with async stores, InjectionDefense is regex-only with no LLM-classifier seam**
  *Symptoms*: ## Summary  In-depth review of `src/praisonai/praisonai` surfaced three concrete gaps in the wrapper layer that undermine the "safe by default, production-ready" pillar from `AGENTS.md`. All three are validated against the current tree (`src/praisonai/praisonai/**`) and each ships with the failing snippet and a minimal fix. No documentation, tests, coverage, file-size or line-count concerns are included — only functional / architectural gaps.  ---  ### 1. `praisonai.capabilities.guardrails` — the guardrail silently opens on *every* error  **File:** `src/praisonai/praisonai/capabilities/guardrails.py`  `apply_guardrail` / `aapply_guardrail` wrap the entire LLM check + JSON parse in a single `try/except Exception` and return `passed=True` on any failure. The comment even labels it *"fail safe (pass through)"* — this is fail-**open**, not fail-safe. A rate-limit, network timeout, invalid JSON, or an empty `choices[0].message.content` all convert the guardrail into a permanent NO-OP for that call. Compounded by `result_data.get("passed", True)`, an LLM response missing the `passed` key also passes.  Impact for a wrapper that advertises safety: an operator turns on `apply_guardrail(...)` in front of an agent, watches a 429 storm during the day, and every offending message goes through. There is no `strict=` / `on_error=` / `mode="fail_closed"` knob to override this behaviour, no schema validation of the LLM's JSON, and no signal to the caller that the call was skipped (the `metada
  **Post-Mortem & Fix Analysis**:
  > **Claude finished @MervinPraison's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/36689150124) • [`claude/issue-5379-20260930-0821`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5379-20260930-0821) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5379-20260930-0821?quick_pull=1&title=Issue%20%235379%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235379%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### Done — PR #5380 created ✅  **PR:** https://github.com/MervinPraison/PraisonAI/pull/5380  - [x] Read AGENTS.md & the three files - [x] Critical review (per AGENTS.md — lightweight & powerful) - [x] **Fix #1** — `guardrails.py` now fails **closed** by default (`on_error="block"|"allow"|"raise"`) + strict schema-check; applies to sync + async - [x] **Fix #2** — `export_session` routes through `_call_store` (works on async stores, no leaked coroutines) + a

- **Issue #5376** (2026-09-30): **Core SDK: sync→async bridges disagree (async guardrails rejected under a running loop), fallback_models never fires on the provider/model path, and default chat history grows without bound**
  *Symptoms*: ## Scope `src/praisonai-agents/praisonaiagents` only. Each finding below was reproduced against the current `main` (`d9453cb`) with a small script, and the repro output is quoted. Documentation, tests and file size are out of scope.  ---  ## 1. Seven separate sync→async bridges with different semantics: async guardrails and callbacks fail under a running loop, contextvars are lost, timeouts are not enforced  The repo has at least seven helpers that run a coroutine from sync code:  | Helper | Behaviour inside a running loop | |---|---| | `utils/async_bridge.py::run_coroutine_from_any_context` | **raises `RuntimeError`** despite its name | | `agent/async_safety.py::run_async_in_sync_context` | worker thread, no contextvars, timeout not enforced | | `agents/agents.py::_resolve_coroutine_sync` | worker thread, no timeout | | `agent/execution_mixin.py::_execute_backend_sync` (~L485) | worker thread, no timeout | | `approval/utils.py::run_coroutine_safely` | separate implementation | | `tools/messaging_tools.py::_run_async` | separate implementation | | `agent/chat_mixin.py` compaction (~L5785) | bare `asyncio.run` inside `try/except RuntimeError` |  ### 1a. The helper named "any context" raises in a running loop `run_coroutine_from_any_context` is used by `Agent._process_guardrail` (`agent/agent.py:7150`), `Task._process_guardrail` (`task/task.py:935`), `Task.execute_callback_sync` (`task/task.py:875`), `planning/approval.py:86`, and `bus/bus.py:242`. It raises when a loop is alre
  **Post-Mortem & Fix Analysis**:
  > **Claude finished @MervinPraison's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/36682798315) • [`claude/issue-5376-20260930-0717`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5376-20260930-0717) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5376-20260930-0717?quick_pull=1&title=Issue%20%235376%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235376%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### Issue #5376 — Fix implemented  **PR:** https://github.com/MervinPraison/PraisonAI/pull/5377  - [x] Read AGENTS.md and understand architecture rules - [x] Investigate the sync→async bridges (Finding 1) - [x] Investigate fallback_models on provider/model path (Finding 2) - [x] Investigate unbounded chat history growth (Finding 3) - [x] Plan minimal, lightweight fixes - [x] Implement Finding 1 fixes - [x] Run tests (491 passed, 1 skipped) - [x] Create PR 

- **Issue #5374** (2026-09-30): **[BUG] EvalPort adapter output fails the EvalPort validators (to_evalport / report_to_evalport)**
  *Symptoms*: Thanks for shipping the EvalPort adapter in #4667 (requested in #4275). It's great to see it land in `praisonaiagents.eval`.  When I ran the output through the reference validator, neither document validated. The Suite and ResultSet: - use key names that aren't in the spec (`cases`, `evalport_version`, `kind`, `case_id`, `score`, `latency_ms`, ...) - leave out required keys (`id`, `test_cases`, `suite_id`, `run_id`, `started_at`, `grader_results`, ...)  That's partly on me: the sketch in #4275 described the mapping loosely instead of spelling out the exact spec fields.  ## SDK / package - [x] Python (`praisonaiagents`)  ## Environment - praisonaiagents 1.7.9 (main @ d9453cb) - evalport-sdk 1.3.1 - Python 3.11, Linux  ## Reproduction ```python # pip install praisonaiagents evalport-sdk from praisonaiagents.eval import (     EvalCase, EvalPackage, EvalReport, EvalResult, to_evalport, report_to_evalport, ) from openeval.validate import validate_suite, validate_result_set  pkg = EvalPackage(name="support", cases=[     EvalCase(name="refund", input="refund policy?", expected="30 days", criteria=["answer_correct"]), ]) report = EvalReport(package_name="support", total_cases=1, passed_cases=1, failed_cases=0,                     average_score=0.9, results=[EvalResult(case_name="refund", passed=True, score=0.9)])  for label, res in (("suite", validate_suite(to_evalport(pkg))),                    ("result_set", validate_result_set(report_to_evalport(report)))):     print(label, res.va
  **Post-Mortem & Fix Analysis**:
  > 👋 Thanks for opening this issue, @adhabnr-ux!  A maintainer will review this shortly. In the meantime: - Make sure you've included steps to reproduce (for bugs) - Check [existing issues](https://github.com/MervinPraison/PraisonAI/issues) for duplicates - Review the [documentation](https://docs.praison.ai) for related guides  _Bug and enhancement reports are auto-triaged with Claude. Questions and other issues: a maintainer can comment `@claude` to trigger analysis._  **Routing:** Agent-callable tools → [PraisonAI-Tools](https://github.com/MervinPraison/PraisonAI-Tools); lifecycle plugins (tracing/hooks/guardrails) → [PraisonAI-Plugins](https://github.com/MervinPraison/PraisonAI-Plugins). TypeScript/JavaScript SDK fixes land in `src/praisonai-ts/` in this repo.
  > **Claude finished @adhabnr-ux's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/36648370509) • [`claude/issue-5374-20260930-0003`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5374-20260930-0003) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5374-20260930-0003?quick_pull=1&title=Issue%20%235374%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235374%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### EvalPort spec conformance fix — done  - [x] Read architecture guidelines - [x] Read current `eval/evalport.py` and test file - [x] Apply the fix to `evalport.py` - [x] Update test file - [x] Run tests — **15 passed, 2 skipped** - [x] Commit, push, create PR  **PR:** https://github.com/MervinPraison/PraisonAI/pull/5375  #### What changed Aligned `to_evalport` / `report_to_evalport` in `praisonaiagents/eval/evalport.py` with the EvalPort spec so both docume
  > Thanks for merging #5375. I re-validated the merged code (`ae4b2802`, `eval/evalport.py` + `eval/package.py` copied verbatim) against `evalport-sdk` (current `main`, with the stricter validators) and the raw JSON Schemas.  **Result: valid.** Suites and ResultSets from a package with criteria, criteria-less cases, a case with a `praisonai_verdict`-named criterion, `timeout_seconds` of 0 and -3, an out-of-range score (1.7, clamped with `openeval.raw_score` kept), an errored case and a trajectory `record` all pass `validate_suite()`, `validate_result_set()` and the raw schemas. Every `grader_id` in the results is defined in the suite, and every `test_case_id` exists in it. The zero/negative timeout round-trips through `from_evalport`.  **One edge case that does not validate:** an empty package. `to_evalport(EvalPackage(name="empty", cases=[]))` and `report_to_evalport` of a zero-result report both fail. `suite.json` and `resultset.json` set `minItems: 1` on `test_cases` and `results`, and

- **Issue #5366** (2026-09-30): **Gateway: durable outbound queue has no operator inspect/retry/purge surface (unlike the inbound DLQ), so stuck/failed agent replies are undiagnosable in production**
  *Symptoms*: ## Summary  The gateway/bot stack ships a durable, crash‑safe **outbound** delivery path (`OutboundQueue` + an outbound dead‑letter store), but it is a black box to operators. There is no way to see *which* agent replies are stuck or dead‑lettered, *to whom*, *why* (error/attempt count/state), and no way to retry or purge a specific one. This is asymmetric with the **inbound** side, which already has both a full introspection API and a first‑class operator CLI (`praisonai bot dlq list|purge|replay`).  For an always‑on production bot, "why didn't my user get the reply?" is a top operational question, and the outbound queue is exactly where that answer lives — yet today the only levers are opaque bulk counters and bulk purges. Adding a thin, read‑mostly operator surface (parity with the inbound DLQ) turns a silent failure mode into a diagnosable, recoverable one, with no new heavy dependencies.  ## Current behaviour  **Inbound side — fully operable.** `InboundDLQ` exposes per‑entry introspection and recovery, and it is wired to a CLI:  - `src/praisonai-bot/praisonai_bot/bots/_dlq.py` — `InboundDLQ.list(limit)` (`:217`), `size()` (`:213`), `replay(...)` (`:248`), `purge()` (`:183`). - `src/praisonai-bot/praisonai_bot/cli/commands/bot.py:731` — `dlq_app = typer.Typer(help="Inspect / replay / purge the inbound dead-letter queue.")` with `dlq list` (`:747`) and `dlq purge` (`:772`), mounted at `app.add_typer(dlq_app, name="dlq")` (`:735`). `praisonai gateway ...` even prints a hint
  **Post-Mortem & Fix Analysis**:
  > **Claude finished @MervinPraison's task** —— [View job](https://github.com/MervinPraison/PraisonAI/actions/runs/36554205375) • [`claude/issue-5366-20260929-1024`](https://github.com/MervinPraison/PraisonAI/tree/claude/issue-5366-20260929-1024) • [Create PR ➔](https://github.com/MervinPraison/PraisonAI/compare/main...claude/issue-5366-20260929-1024?quick_pull=1&title=Issue%20%235366%3A%20Changes%20from%20Claude&body=This%20PR%20addresses%20issue%20%235366%0A%0AGenerated%20with%20%5BClaude%20Code%5D(https%3A%2F%2Fclaude.ai%2Fcode)  --- ### Done: Gateway outbound queue operator surface  Added operator parity between the durable **outbound** queue and the inbound DLQ.  **PR:** https://github.com/MervinPraison/PraisonAI/pull/5369  - [x] `OutboundQueue.list(status=, target=, limit=)` — enumerate entries with target/status/attempts/error - [x] `OutboundQueue.stats()` — per-status count map - [x] `OutboundQueue.retry(key)` — requeue a failed/permanent/recovered entry for the next drain - [x] `

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

### Incident Patch 1: `fc047552` (2026-09-30)
**Commit Message**: Merge pull request #5391 from MervinPraison/fix/pr-review-openai-key-skip

fix(ci): skip PraisonAI PR review without OpenAI key

**File**: `.github/workflows/praisonai-pr-review.yml` (modified, +21/-7)
```diff
@@ -34,10 +34,24 @@ jobs:
         id: config
         env:
           HAS_APP_CREDENTIALS: ${{ secrets.PRAISONAI_APP_ID != '' && secrets.PRAISONAI_APP_PRIVATE_KEY != '' }}
-        run: echo "configured=$HAS_APP_CREDENTIALS" >> "$GITHUB_OUTPUT"
+          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
+        run: |
+          echo "configured=$HAS_APP_CREDENTIALS" >> "$GITHUB_OUTPUT"
+          openai_ready=true
+          if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "not-needed" ]; then
+            openai_ready=false
+            if [ "$HAS_APP_CREDENTIALS" = "true" ]; then
+              echo "::notice::Skipping PraisonAI PR review: OPENAI_API_KEY is missing or a placeholder."
+            fi
+          fi
+          if [ "$HAS_APP_CREDENTIALS" = "true" ] && [ "$openai_ready" = "true" ]; then
+            echo "ready=true" >> "$GITHUB_OUTPUT"
+          else
+            echo "ready=false" >> "$GITHUB_OUTPUT"
+          fi
 
       - name: Determine checkout ref
-        if: steps.config.outputs.configured == 'true'
+        if: steps.config.outputs.ready == 'true'
         id: dest
         env:
           ISSUE_NUMBER: ${{ github.event.issue.number }}
@@ -53,33 +67,33 @@ jobs:
           fi
 
       - name: Checkout Repository
-        if: steps.config.outputs.configured == 'true'
+        if: steps.config.outputs.ready == 'true'
         uses: actions/checkout@v4
         with:
           persist-credentials: false
           ref: ${{ steps.dest.outputs.ref }}
           fetch-depth: 0
           
       - name: Generate GitHub App Token
-        if: steps.config.outputs.configured == 'true'
+        if: steps.config.outputs.ready == 'true'
         id: generate_token
         uses: tibdex/github-app-token@v2
         with:
           app_id: ${{ secrets.PRAISONAI_APP_ID }}
           private_key: ${{ secrets.PRAISONAI_APP_PRIVATE_KEY }}
           
       - name: Set up Python
-        if: steps.config.outputs.configured == 'true'
+        if: steps.config.outputs.ready == 'true'
         uses: actions/setup-python@v5
         with:
           python-version: '3.11'
           
       - name: Install PraisonAI
-        if: steps.config.outputs.configured == 'true'
+        if: steps.config.outputs.ready == 'true'
         run: pip install "praisonai[all]"
         
       - name: Run PraisonAI PR Review
-        if: steps.config.outputs.configured == 'true'
+        if: steps.config.outputs.ready == 'true'
         env:
           GITHUB_TOKEN: ${{ steps.generate_token.outputs.token }}
           OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

---

### Incident Patch 2: `e83f562f` (2026-09-30)
**Commit Message**: fix(ci): skip PraisonAI PR review without OpenAI key

Avoid 401 failures when GitHub App credentials exist but OPENAI_API_KEY is unset or a placeholder.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `.github/workflows/praisonai-pr-review.yml` (modified, +21/-7)
```diff
@@ -34,10 +34,24 @@ jobs:
         id: config
         env:
           HAS_APP_CREDENTIALS: ${{ secrets.PRAISONAI_APP_ID != '' && secrets.PRAISONAI_APP_PRIVATE_KEY != '' }}
-        run: echo "configured=$HAS_APP_CREDENTIALS" >> "$GITHUB_OUTPUT"
+          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
+        run: |
+          echo "configured=$HAS_APP_CREDENTIALS" >> "$GITHUB_OUTPUT"
+          openai_ready=true
+          if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "not-needed" ]; then
+            openai_ready=false
+            if [ "$HAS_APP_CREDENTIALS" = "true" ]; then
+              echo "::notice::Skipping PraisonAI PR review: OPENAI_API_KEY is missing or a placeholder."
+            fi
+          fi
+          if [ "$HAS_APP_CREDENTIALS" = "true" ] && [ "$openai_ready" = "true" ]; then
+            echo "ready=true" >> "$GITHUB_OUTPUT"
+          else
+            echo "ready=false" >> "$GITHUB_OUTPUT"
+          fi
 
       - name: Determine checkout ref
-        if: steps.config.outputs.configured == 'true'
+        if: steps.config.outputs.ready == 'true'
         id: dest
         env:
           ISSUE_NUMBER: ${{ github.event.issue.number }}
@@ -53,33 +67,33 @@ jobs:
           fi
 
       - name: Checkout Repository
-        if: steps.config.outputs.configured == 'true'
+        if: steps.config.outputs.ready == 'true'
         uses: actions/checkout@v4
         with:
           persist-credentials: false
           ref: ${{ steps.dest.outputs.ref }}
           fetch-depth: 0
           
       - name: Generate GitHub App Token
-        if: steps.config.outputs.configured == 'true'
+        if: steps.config.outputs.ready == 'true'
         id: generate_token
         uses: tibdex/github-app-token@v2
         with:
           app_id: ${{ secrets.PRAISONAI_APP_ID }}
           private_key: ${{ secrets.PRAISONAI_APP_PRIVATE_KEY }}
           
       - name: Set up Python
-        if: steps.config.outputs.configured == 'true'
+        if: steps.config.outputs.ready == 'true'
         uses: actions/setup-python@v5
         with:
           python-version: '3.11'
           
       - name: Install PraisonAI
-        if: steps.config.outputs.configured == 'true'
+        if: steps.config.outputs.ready == 'true'
         run: pip install "praisonai[all]"
         
       - name: Run PraisonAI PR Review
-        if: steps.config.outputs.configured == 'true'
+        if: steps.config.outputs.ready == 'true'
         env:
           GITHUB_TOKEN: ${{ steps.generate_token.outputs.token }}
           OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

---

### Incident Patch 3: `c3ec51ed` (2026-09-30)
**Commit Message**: Merge origin/main into PR branch; keep misfire grace and quota hold.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `src/praisonai-agents/praisonaiagents/agent/async_safety.py` (modified, +13/-19)
```diff
@@ -27,27 +27,21 @@ def run_async_in_sync_context(coro):
     tool loop, otherwise a bare un-awaited coroutine would be handed to the
     model as the tool result and the tool body would never run (silent data
     loss).
-    """
-    try:
-        asyncio.get_running_loop()
-    except RuntimeError:
-        # No event loop - safe to use asyncio.run()
-        return asyncio.run(coro)
 
-    # Event loop exists - avoid deadlock by running in dedicated thread
-    import concurrent.futures
+    Delegates to the single canonical bridge
+    (:func:`utils.async_bridge.run_coroutine_from_any_context`) so all sync→async
+    call sites share one implementation: the caller's ``contextvars`` (trace /
+    session / approval context) are carried into the coroutine, and the running
+    loop is handled on a dedicated worker thread rather than raising.
 
-    def run_in_thread():
-        new_loop = asyncio.new_event_loop()
-        asyncio.set_event_loop(new_loop)
-        try:
-            return new_loop.run_until_complete(coro)
-        finally:
-            new_loop.close()
-
-    with concurrent.futures.ThreadPoolExecutor() as executor:
-        future = executor.submit(run_in_thread)
-        return future.result(timeout=300)  # 5 minute timeout
+    ``timeout=None`` is passed deliberately: this helper backs the sync
+    tool-calling path, where a tool's own timeout policy (or lack of one) already
+    governs how long a tool may run. Imposing the bridge's default 5-minute
+    deadline here would silently cancel long-running tools that previously had no
+    limit — a backward-incompatible regression — so the bridge adds none.
+    """
+    from ..utils.async_bridge import run_coroutine_from_any_context
+    return run_coroutine_from_any_context(coro, timeout=None)
 
 
 class DualLock:
```

**File**: `src/praisonai-agents/praisonaiagents/agent/chat_mixin.py` (modified, +38/-13)
```diff
@@ -5728,6 +5728,28 @@ async def llm_summarize_async(prompt: str) -> str:
         
         return llm_summarize_async
 
+    def _resolve_compaction_max_tokens(self, execution_cfg):
+        """
+        Resolve the compaction trigger budget.
+
+        An explicit ``ExecutionConfig.max_context_tokens`` always wins. When it
+        is unset, size the trigger to the active model's context window (reusing
+        the model-aware ``budgeter`` the in-loop path already uses) instead of a
+        flat default, so large-context models are not compacted prematurely.
+        Falls back to a static default only for the offline / unknown-model case.
+        """
+        _explicit = getattr(execution_cfg, 'max_context_tokens', None)
+        if _explicit:
+            return _explicit
+        try:
+            from ..context.budgeter import get_model_limit, get_output_reserve
+            model_name = self.llm if isinstance(self.llm, str) else "gpt-4o-mini"
+            limit = get_model_limit(model_name)
+            reserve = get_output_reserve(model_name)
+            return max(1, int(limit * 0.8) - reserve)
+        except Exception:
+            return 8000
+
     def _apply_context_compaction(self, messages, hook_event_class):
         """
         Apply context compaction to messages if enabled (sync version).
@@ -5747,7 +5769,7 @@ def _apply_context_compaction(self, messages, hook_event_class):
             from ..compaction import ContextCompactor
             from ..compaction.strategy import CompactionStrategy
             
-            _max_tok = getattr(_execution_cfg, 'max_context_tokens', None) or 8000
+            _max_tok = self._resolve_compaction_max_tokens(_execution_cfg)
             _strategy = getattr(_execution_cfg, 'compaction_strategy', None) or CompactionStrategy.TRUNCATE
             
             # Create LLM summarization function if strategy is LLM_SUMMARIZE
@@ -5779,17 +5801,20 @@ def _apply_context_compaction(self, messages, hook_event_class):
             
             # Perform compaction
             if _strategy == CompactionStrategy.LLM_SUMMARIZE and _llm_fn:
-                import asyncio
-                try:
-                    # Run async compaction in event loop
-                    compacted_msgs, _cr = asyncio.run(_compactor.compact_async(messages))
-                except RuntimeError:
-                    # If already in async context, fall back to sync (naive) compaction
-                    logging.warning(
-                        f"[compaction] {self.name}: LLM_SUMMARIZE fell back to naive summarization "
-                        f"(asyncio.run not available in sync context)"
-                    )
-                    compacted_msgs, _cr = _compactor.compact(messages)
+                # Drive the async summariser through the shared bridge so it runs
+                # correctly whether or not a loop is already running (FastAPI /
+                # Jupyter / a bot handler). The previous code caught bare
+                # RuntimeError from ``asyncio.run`` ("event loop already
+                # running") and silently downgraded LLM summarisation to naive
+                # truncation whenever a loop was live; the bridge removes that
+                # spurious fallback so the real summariser always runs. Provider
+                # errors inside the summariser remain best-effort (see
+                # ``_llm_summarize_async``, which falls back to a naive summary on
+                # failure) — compaction never hard-fails the turn.
+                from ..utils.async_bridge import run_coroutine_from_any_context
+                compacted_msgs, _cr = run_coroutine_from_any_context(
+                    _compactor.compact_async(messages)
+                )
             else:
                 compacted_msgs, _cr = _compactor.compact(messages)
             
@@ -5834,7 +5859,7 @@ async def _apply_context_compaction_async(self, messages, hook_event_class):
             from ..compac
```

**File**: `src/praisonai-agents/praisonaiagents/agents/agents.py` (modified, +14/-0)
```diff
@@ -2382,6 +2382,20 @@ def run_task(self, task_id):
 
     def run_all_tasks(self):
         """Synchronous version of run_all_tasks method"""
+        # The sync entry point (.start()/.run()) drives tasks one at a time and
+        # cannot batch async_execution=True tasks via asyncio.gather the way
+        # arun_all_tasks does. Warn once so the parallel fan-out feature the
+        # constructor docstring/ValueError advertise doesn't silently degrade to
+        # sequential execution -- point the caller at the async entry point.
+        if self.process in ("workflow", "sequential") and any(
+            getattr(t, 'async_execution', False) for t in self.tasks.values()
+        ):
+            logger.warning(
+                "One or more tasks have async_execution=True, but the synchronous "
+                "entry point (.start()/.run()) runs them sequentially -- use "
+                "`await team.astart()` for parallel fan-out."
+            )
+
         process = Process(
             tasks=self.tasks,
             agents=self.agents,
```

**File**: `src/praisonai-agents/praisonaiagents/eval/evalport.py` (modified, +177/-56)
```diff
@@ -7,9 +7,16 @@
 
 Mapping (1:1 with EvalPort's ``Suite`` / ``ResultSet`` concepts):
 
-    EvalPackage <-> EvalPort Suite      (name/description/version + cases + thresholds)
-    EvalCase    <-> EvalPort test case  (input / expected_output / grader refs)
-    EvalReport   -> EvalPort ResultSet  (aggregate + per-case pass/score/latency)
+    EvalPackage <-> EvalPort Suite      (id/name/description + test_cases + graders)
+    EvalCase    <-> EvalPort TestCase   (id / input / expected_output / grader refs)
+    EvalReport   -> EvalPort ResultSet  (summary + per-case grader_results)
+
+Per-criterion scores map to native EvalPort ``grader_results`` (one per criterion,
+matching the criterion graders referenced by the Suite). PraisonAI-only fields
+with no EvalPort slot (package version, thresholds, seed, trajectory records, a
+nonpositive ``timeout_seconds`` that the spec's ``timeout_ms`` cannot represent,
+...) are kept under the ``praisonai`` key of the relevant ``metadata`` object so
+round trips stay lossless.
 
 Design: this module is intentionally **dependency-free**. It emits and consumes
 plain spec-shaped dicts (JSON), so the core SDK does not take on ``evalport-sdk``
@@ -27,53 +34,90 @@
     >>> pkg2.name == pkg.name
     True
 """
-from typing import Any, Dict, List
+import uuid
+from datetime import datetime, timezone
+from typing import Any, Dict, List, Optional
 
 from .package import EvalCase, EvalPackage, EvalReport
 
-EVALPORT_SPEC_VERSION = "1.0"
+# EvalPort spec version the emitted documents conform to (semver, per spec).
+EVALPORT_SPEC_VERSION = "1.0.0-rc.5"
+
+# Grader that carries PraisonAI's own per-case verdict (EvalResult.passed/score).
+# EvalPort requires every test case to reference at least one grader.
+VERDICT_GRADER_ID = "praisonai_verdict"
+_HANDLER = "praisonaiagents.eval"
+_META_KEY = "praisonai"
+
+
+def _grader_def(grader_id: str, description: str) -> Dict[str, Any]:
+    return {
+        "id": grader_id,
+        "type": "custom",
+        "params": {"handler": _HANDLER},
+        "description": description,
+    }
 
 
 def _case_to_evalport(case: EvalCase) -> Dict[str, Any]:
-    """Map an ``EvalCase`` to an EvalPort test-case dict.
+    """Map an ``EvalCase`` to an EvalPort TestCase dict.
 
-    The native ``timeout_seconds`` is emitted as a dedicated top-level field so
-    it never collides with a user-supplied ``metadata["timeout_seconds"]`` key,
-    keeping round trips lossless for both.
+    ``criteria`` become grader references (defined at suite level); a case
+    without criteria references the verdict grader. ``timeout_seconds`` maps to
+    the spec's ``timeout_ms``; user ``metadata`` is passed through untouched.
     """
+    # A case's own criteria are its graders; the verdict grader is always
+    # referenced too so PraisonAI's pass/score verdict has a home in the
+    # ResultSet (spec requires >= 1 grader per case).
+    graders = [VERDICT_GRADER_ID] + [c for c in case.criteria if c != VERDICT_GRADER_ID]
     item: Dict[str, Any] = {
         "id": case.name,
         "input": case.input,
+        "graders": list(dict.fromkeys(graders)),
     }
     if case.expected is not None:
         item["expected_output"] = case.expected
-    if case.criteria:
-        item["graders"] = list(case.criteria)
-    if case.timeout_seconds is not None:
-        item["timeout_seconds"] = case.timeout_seconds
-    metadata = dict(case.metadata or {})
-    if metadata:
-        item["metadata"] = metadata
+    if case.metadata:
+        item["metadata"] = dict(case.metadata)
+    if case.timeout_seconds is not None and case.timeout_seconds > 0:
+        item["timeout_ms"] = max(1, int(round(case.timeout_seconds * 1000)))
+    elif case.timeout_seconds is not None:
+        # Nonpositive timeout is not spec-representable (timeout_ms >= 1); keep
+        # the raw value under the reserved namespace so import restores it
+        # instead of silently applying the 30s default.
+        meta = 
```

**File**: `src/praisonai-agents/praisonaiagents/gateway/__init__.py` (modified, +20/-0)
```diff
@@ -35,6 +35,14 @@
     "SessionProjection": ("praisonaiagents.gateway.session_projection", "SessionProjection"),
     "SessionProjectionState": ("praisonaiagents.gateway.session_projection", "SessionProjectionState"),
     "RunView": ("praisonaiagents.gateway.session_projection", "RunView"),
+    # Canonical session-address grammar (Issue #5383)
+    "SessionRef": ("praisonaiagents.gateway.addressing", "SessionRef"),
+    "build_session_path": ("praisonaiagents.gateway.addressing", "build_session_path"),
+    "parse_session_path": ("praisonaiagents.gateway.addressing", "parse_session_path"),
+    "derive_short_id": ("praisonaiagents.gateway.addressing", "derive_short_id"),
+    "slugify": ("praisonaiagents.gateway.addressing", "slugify"),
+    "RESERVED_NAMES": ("praisonaiagents.gateway.addressing", "RESERVED_NAMES"),
+    "SHORT_ID_LEN": ("praisonaiagents.gateway.addressing", "SHORT_ID_LEN"),
     "GatewayCloseCode": ("praisonaiagents.gateway.protocols", "GatewayCloseCode"),
     # Declarative method -> required-scope registry (Issue #3206)
     "GatewayMethodDescriptor": ("praisonaiagents.gateway.protocols", "GatewayMethodDescriptor"),
@@ -239,6 +247,8 @@
     # liveness.py — Event-loop liveness watchdog (Issue #3385)
     "LoopWatchdogPolicy": ("praisonaiagents.gateway.liveness", "LoopWatchdogPolicy"),
     "LoopWatchdog": ("praisonaiagents.gateway.liveness", "LoopWatchdog"),
+    # liveness.py — Startup-phase watchdog (Issue #5265)
+    "StartupWatchdog": ("praisonaiagents.gateway.liveness", "StartupWatchdog"),
     # degraded_state.py — Unified degraded-capability registry (Issue #3518)
     "DegradedOwner": ("praisonaiagents.gateway.degraded_state", "DegradedOwner"),
     "DegradedCapabilityProtocol": ("praisonaiagents.gateway.degraded_state", "DegradedCapabilityProtocol"),
@@ -385,6 +395,14 @@ def __dir__():
     "SessionProjection",
     "SessionProjectionState",
     "RunView",
+    # Canonical session-address grammar (Issue #5383)
+    "SessionRef",
+    "build_session_path",
+    "parse_session_path",
+    "derive_short_id",
+    "slugify",
+    "RESERVED_NAMES",
+    "SHORT_ID_LEN",
     "GatewayCloseCode",
     # Declarative method -> required-scope registry (Issue #3206)
     "GatewayMethodDescriptor",
@@ -580,6 +598,8 @@ def __dir__():
     # Event-loop liveness watchdog (Issue #3385)
     "LoopWatchdogPolicy",
     "LoopWatchdog",
+    # Startup-phase watchdog (Issue #5265)
+    "StartupWatchdog",
     # Unified degraded-capability registry (Issue #3518)
     "DegradedOwner",
     "DegradedCapabilityProtocol",
```

---

### Incident Patch 4: `4d5e57c8` (2026-09-30)
**Commit Message**: fix: close quota-hold gaps in BotOS loop, HTTP-date resets, hold notice

Addresses reviewer findings on the provider-quota-aware schedule hold (#5386):

- BotOS second scheduler path (`_run_schedule_loop`) now parks a job past a
  429/quota reset window via the core `quota_hold_from_failure` decision, so a
  benched provider is no longer hammered every tick on that path (greptile #1).
- `extract_retry_after` now parses an RFC 7231 HTTP-date `Retry-After` (not just
  delta-seconds), so an absolute reset instant still yields a park; a
  past/unparseable date falls through unchanged (greptile #2).
- The "held until N" notice is no longer gated on the failure `alert_after_failures`
  threshold — a hold is a distinct once-per-window state, so it is always emitted
  once while failure/recovery incident accounting stays consistent (greptile #3).
- Make `test_dispatch_skill_review_background_runs_off_path` deterministic
  (event-gated ordering instead of a wall-clock `< 0.1s` bound that flaked on
  slow CI), per AGENTS.md §4.6.

Tests: +HTTP-date park round-trip (core), +BotOS hold decision (bot),
+hold-notice-below-threshold (wrapper). Core scheduler 283 passed; wrapper
scheduler 413 pass

**File**: `src/praisonai-agents/praisonaiagents/llm/error_classifier.py` (modified, +37/-1)
```diff
@@ -588,6 +588,35 @@ def get_retry_delay(category: ErrorCategory, attempt: int = 1, base_delay: float
     return 0
 
 
+def _retry_after_http_date_delay(value: str) -> Optional[float]:
+    """Return seconds until an HTTP-date ``Retry-After`` value, else ``None``.
+
+    RFC 7231 allows ``Retry-After`` to be either delta-seconds or an absolute
+    HTTP-date. Delta-seconds is handled by the caller; this parses the date
+    form using the stdlib (no new dependency) and returns the non-negative
+    delay from now. A value in the past or unparseable yields ``None`` so the
+    caller falls through to its other signals.
+    """
+    try:
+        from email.utils import parsedate_to_datetime
+    except Exception:  # pragma: no cover - stdlib always present
+        return None
+    try:
+        when = parsedate_to_datetime(value.strip())
+    except (TypeError, ValueError):
+        return None
+    if when is None:
+        return None
+    import time as _time
+    from datetime import timezone
+
+    # An HTTP-date is UTC; a naive parse result is treated as UTC per the RFC.
+    if when.tzinfo is None:
+        when = when.replace(tzinfo=timezone.utc)
+    delay = when.timestamp() - _time.time()
+    return delay if delay > 0 else None
+
+
 def extract_retry_after(
     error: Exception, cap_seconds: float = 300.0,
 ) -> Optional[float]:
@@ -617,7 +646,14 @@ def extract_retry_after(
             try:
                 return min(float(retry_after), cap_seconds)
             except (ValueError, TypeError):
-                pass  # Not a plain number (could be an HTTP-date); fall through
+                # Not a plain delta-seconds value — RFC 7231 also permits an
+                # HTTP-date. Parse it so a provider that sends an absolute reset
+                # instant still yields a usable delay (else a long quota window
+                # would leave the job un-parked). A past/unparseable date yields
+                # no delay and falls through to the other signals.
+                delay = _retry_after_http_date_delay(str(retry_after))
+                if delay is not None:
+                    return min(delay, cap_seconds)
 
     # 2. Some SDKs expose a numeric ``retry_after`` attribute directly.
     retry_after_attr = getattr(error, "retry_after", None)
```

**File**: `src/praisonai-agents/tests/unit/skills/test_self_improve.py` (modified, +16/-10)
```diff
@@ -270,22 +270,28 @@ def test_dispatch_skill_review_inline_runs_synchronously():
 
 
 def test_dispatch_skill_review_background_runs_off_path():
+    import threading
     import time
 
     agent = Agent(instructions="x", self_improve="background")
     done = []
-
-    def slow_review(p, r, t):
-        time.sleep(0.15)
+    # Gate the review body so the assertion is on ordering, not wall-clock:
+    # the caller must return *before* the review is released, proving the turn
+    # ran off-path. This is deterministic — it never depends on how fast the
+    # runner schedules the background thread (AGENTS.md §4.6: no timing-based
+    # tests), unlike an absolute ``elapsed < 0.1`` bound that flaked on slow CI.
+    release = threading.Event()
+
+    def gated_review(p, r, t):
+        release.wait(5.0)
         done.append((p, r, t))
 
-    start = time.time()
-    agent._dispatch_skill_review(slow_review, "p", "r", ["shell"])
-    elapsed = time.time() - start
-    # Caller is not blocked by the review turn.
-    assert elapsed < 0.1
-    # But the review still runs on the background runner.
-    for _ in range(50):
+    agent._dispatch_skill_review(gated_review, "p", "r", ["shell"])
+    # Caller returned while the review is still blocked → it did not run inline.
+    assert done == []
+    # Release it and confirm the review still runs on the background runner.
+    release.set()
+    for _ in range(250):
         if done:
             break
         time.sleep(0.02)
```

**File**: `src/praisonai-agents/tests/unit/test_schedule_quota_hold.py` (modified, +27/-0)
```diff
@@ -43,6 +43,33 @@ def test_retry_after_parsed_from_message_string():
     assert hold == now + 30 + 10
 
 
+def test_retry_after_http_date_parks_past_window():
+    # RFC 7231 allows Retry-After as an absolute HTTP-date, not just
+    # delta-seconds. A provider that sends the reset instant as a date must
+    # still park the job (greptile #2) — else a long quota window is ignored.
+    import time
+    from datetime import datetime, timedelta, timezone
+    from email.utils import format_datetime
+
+    now = time.time()
+    reset = format_datetime(
+        datetime.now(timezone.utc) + timedelta(seconds=1800)
+    )
+    hold = quota_hold_from_failure(_RateLimited(reset), now, slack_seconds=60.0)
+    assert hold is not None
+    # ~1800s window + 60s slack, allowing a little scheduling drift.
+    assert now + 1800 + 60 - 5 <= hold <= now + 1800 + 60 + 5
+
+
+def test_retry_after_past_http_date_does_not_hold():
+    # An HTTP-date already in the past yields no usable window → no park.
+    from datetime import datetime, timedelta, timezone
+    from email.utils import format_datetime
+
+    past = format_datetime(datetime.now(timezone.utc) - timedelta(seconds=120))
+    assert quota_hold_from_failure(_RateLimited(past), 0.0) is None
+
+
 def test_non_quota_failure_never_holds():
     assert quota_hold_from_failure(Exception("boom: invalid request"), 0.0) is None
     assert quota_hold_from_failure(Exception("connection reset"), 0.0) is None
```

**File**: `src/praisonai-bot/praisonai_bot/bots/botos.py` (modified, +57/-0)
```diff
@@ -706,12 +706,14 @@ async def _run_schedule_loop(self) -> None:
                     _status = "succeeded"
                     _result = None
                     _error = None
+                    _exc: Optional[Exception] = None
                     _delivered = False
                     try:
                         _result, _delivered = await self._execute_schedule_job(job)
                     except Exception as e:
                         _status = "failed"
                         _error = str(e)
+                        _exc = e
                         logger.warning(f"BotOS: schedule job {job.name} failed: {e}")
                     finally:
                         # Release the lease so it does not linger until expiry.
@@ -731,6 +733,15 @@ async def _run_schedule_loop(self) -> None:
                                     f"{job.name}: {e}"
                                 )
                     _duration = _time.time() - _start
+                    # Provider-quota hold: park a job past a 429/quota reset
+                    # window so this loop stops re-firing and re-failing every
+                    # tick against a benched provider — the same core decision
+                    # the gateway executor applies (issue #5386). A success
+                    # clears any prior park (the window reopened); the hold is
+                    # written by the mark_run below.
+                    self._apply_schedule_quota_hold(
+                        job, succeeded=_status == "succeeded", error=_exc,
+                    )
                     runner.mark_run(
                         job,
                         status=_status,
@@ -826,6 +837,52 @@ async def _execute_schedule_job(self, job) -> tuple:
         logger.info(f"BotOS: executed schedule job '{job.name}'")
         return (result_str, delivered)
 
+    @staticmethod
+    def _apply_schedule_quota_hold(
+        job: Any, *, succeeded: bool, error: Optional[Exception],
+    ) -> None:
+        """Park a due-loop job past a provider rate-limit window (issue #5386).
+
+        The BotOS schedule loop runs ``agent.chat`` directly rather than through
+        :class:`ScheduledAgentExecutor`, so it needs the same provider-quota
+        hold or a benched provider is hammered every tick. Uses the *core* pure
+        decision ``quota_hold_from_failure`` (no new surface): a 429/quota
+        failure carrying a reset hint sets ``job.hold_until`` (never shortening
+        an existing later park), which the subsequent ``mark_run`` persists so
+        ``is_due`` coalesces intervening fires. A success clears any prior park
+        (proof the window reopened). A no-op when core is unavailable or the
+        failure is not a quota signal, so today's behaviour is unchanged.
+        """
+        if succeeded:
+            if getattr(job, "hold_until", None) is not None:
+                try:
+                    job.hold_until = None
+                except Exception:  # pragma: no cover - defensive
+                    pass
+            return
+        if error is None:
+            return
+        try:
+            from praisonaiagents.scheduler import quota_hold_from_failure
+        except Exception:  # pragma: no cover - core primitive always present
+            return
+        import time as _time
+        hold_until = quota_hold_from_failure(error, _time.time())
+        if hold_until is None:
+            return
+        prior = getattr(job, "hold_until", None)
+        if isinstance(prior, (int, float)) and prior > hold_until:
+            hold_until = prior
+        try:
+            job.hold_until = hold_until
+        except Exception as e:  # pragma: no cover - defensive
+            logger.warning(f"BotOS: could not set quota hold for {job.name}: {e}")
+            return
+        logger.info(
+            "BotOS: job '%s' held until %.0f after provider rate-limit",
+            job.name, hold_until,
+        )
+
     @staticmethod
     def _enforce_p
```

**File**: `src/praisonai-bot/praisonai_bot/scheduler/executor.py` (modified, +10/-4)
```diff
@@ -1461,13 +1461,19 @@ async def _maybe_deliver_hold(
         delivery = getattr(job, "delivery", None)
         if not delivery or not self._can_deliver(delivery):
             return
+        # A hold is a distinct operational state (the job is now silenced for a
+        # whole provider-reset window) and is emitted at most once per window:
+        # ``is_due`` coalesces intervening fires, so this method only runs on the
+        # tick that *newly* parks the job. It must therefore NOT be gated on the
+        # failure ``alert_after_failures`` threshold — otherwise a job configured
+        # to alert only after N failures would park silently and the operator
+        # would never learn it was held (greptile #3). We still fold the failure
+        # through the incident tracker so failure/recovery accounting stays
+        # consistent, but deliver the hold notice regardless of its alert state.
         pending: Optional[Dict[str, Any]] = None
         observed = self._observe_incident(job, result)
         if observed is not None:
-            incident, pending = observed
-            if incident is None or getattr(incident, "state", None) != "alerted":
-                self._commit_incident(job, pending)
-                return
+            _incident, pending = observed
         try:
             when = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(held_until))
         except Exception:  # pragma: no cover - defensive
```

---

### Incident Patch 5: `60478a73` (2026-09-30)
**Commit Message**: fix(scheduler): harden misfire policy — coerce grace, exempt first cron/at run

Address reviewer findings on PR #5388:
- Coerce misfire_grace_seconds via _coerce_optional_float in from_dict so a
  hand-edited quoted YAML value ('3600') no longer raises TypeError and aborts
  the whole claim pass; is_misfire also fails safe on a mis-typed value.
- Exempt a first run (last_run_at is None) from the misfire check for all kinds
  so a never-run cron/at job past a stale slot still fires its initial run
  instead of being marked missed unfired.
- Add 6 regression tests (string/junk grace, cron first-run).

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-authored-by: Mervin Praison <MervinPraison@users.noreply.github.com>

**File**: `src/praisonai-agents/praisonaiagents/scheduler/due.py` (modified, +17/-2)
```diff
@@ -147,18 +147,33 @@ def is_misfire(
     recovery, the pre-existing behaviour.
 
     With no grace set this is always ``False`` — existing jobs keep firing
-    exactly as before.
+    exactly as before. A first run (``last_run_at is None``) is never a misfire
+    for any kind: there is no missed *recurrence* to suppress, only the initial
+    fire, which must always run (matching ``is_due``'s never-run branches).
     """
     grace = getattr(job, "misfire_grace_seconds", None)
     if grace is None:
         return False
+    # A first run is the initial fire, not a recovered recurrence — always let
+    # it run. ``every`` already encodes this (``scheduled_instant`` returns
+    # ``None`` with no ``last_run_at``); make it explicit for ``cron``/``at``
+    # too so a never-run job past a stale slot is not marked missed unfired.
+    if getattr(job, "last_run_at", None) is None:
+        return False
+    # Tolerate a mis-typed grace (e.g. a hand-edited quoted YAML value that
+    # slipped past coercion): a bad policy value must never raise and abort the
+    # whole claim pass — treat it as "no misfire" so other due jobs still fire.
+    try:
+        grace_val = float(grace)
+    except (TypeError, ValueError):
+        return False
     instant = scheduled_instant(job, now, default_timezone)
     if instant is None:
         return False
     age = now - instant
     if age <= 0:
         return False
-    return age > grace
+    return age > grace_val
 
 
 def is_due(
```

**File**: `src/praisonai-agents/praisonaiagents/scheduler/models.py` (modified, +20/-1)
```diff
@@ -10,6 +10,23 @@
 from typing import Any, Dict, List, Literal, Optional
 
 
+def _coerce_optional_float(value: Any) -> Optional[float]:
+    """Coerce a persisted/hand-edited value to ``Optional[float]``.
+
+    A hand-written config.yaml may quote a numeric field (``'3600'``) so it
+    arrives as a string. Left as-is it would raise ``TypeError`` in a later
+    numeric comparison (e.g. the misfire age check), aborting the whole claim
+    pass and starving every other due job. Coerce leniently: ``None`` stays
+    ``None``; a non-numeric value is treated as unset rather than exploding.
+    """
+    if value is None:
+        return None
+    try:
+        return float(value)
+    except (TypeError, ValueError):
+        return None
+
+
 @dataclass
 class Schedule:
     """When to run a scheduled job.
@@ -598,7 +615,9 @@ def from_dict(cls, d: Dict[str, Any]) -> "ScheduleJob":
             context_from=context_from,
             context_max_chars=d.get("context_max_chars", 4000),
             on_missing_context=d.get("on_missing_context", "run"),
-            misfire_grace_seconds=d.get("misfire_grace_seconds"),
+            misfire_grace_seconds=_coerce_optional_float(
+                d.get("misfire_grace_seconds")
+            ),
             backend=d.get("backend"),
             backend_options=(
                 dict(d["backend_options"])
```

**File**: `src/praisonai-agents/tests/unit/test_schedule_misfire.py` (modified, +59/-0)
```diff
@@ -79,6 +79,40 @@ def test_first_run_never_misfire(self):
         job = _interval_job(every=60, grace=1)  # never run
         assert is_misfire(job, time.time()) is False
 
+    def test_string_grace_does_not_raise(self):
+        # A hand-edited quoted YAML value (``'90'``) reaching is_misfire as a
+        # string must not raise TypeError and abort the claim pass — it is
+        # coerced, so a genuinely stale slot is still detected.
+        t0 = 1000.0
+        job = _interval_job(every=60, last_run_at=t0, grace=90)
+        job.misfire_grace_seconds = "90"  # simulate un-coerced legacy value
+        assert is_misfire(job, t0 + 300) is True
+
+    def test_non_numeric_grace_is_not_misfire(self):
+        # A non-numeric junk value must fail safe to "not a misfire" rather
+        # than raising and starving other due jobs in the same pass.
+        t0 = 1000.0
+        job = _interval_job(every=60, last_run_at=t0, grace=90)
+        job.misfire_grace_seconds = "notanumber"
+        assert is_misfire(job, t0 + 300) is False
+
+
+class TestGraceCoercion:
+    def test_quoted_grace_coerced_to_float(self):
+        # from_dict must coerce a quoted YAML numeric to float so the later
+        # age comparison never raises.
+        d = _interval_job(every=60, grace=None).to_dict()
+        d["misfire_grace_seconds"] = "3600"
+        restored = ScheduleJob.from_dict(d)
+        assert restored.misfire_grace_seconds == 3600.0
+        assert isinstance(restored.misfire_grace_seconds, float)
+
+    def test_junk_grace_coerced_to_none(self):
+        d = _interval_job(every=60, grace=None).to_dict()
+        d["misfire_grace_seconds"] = "not-a-number"
+        restored = ScheduleJob.from_dict(d)
+        assert restored.misfire_grace_seconds is None
+
 
 class TestClaimMisfire:
     def test_stale_occurrence_recorded_missed_not_claimed(self):
@@ -151,6 +185,31 @@ def test_cron_stale_occurrence_recorded_missed(self):
             assert len(history) == 1
             assert history[0].status == "missed"
 
+    @pytest.mark.skipif(
+        __import__("importlib").util.find_spec("croniter") is None,
+        reason="croniter not installed",
+    )
+    def test_cron_first_run_fires_despite_stale_slot(self):
+        # A never-run cron job first polled after its slot has aged past grace
+        # must still fire its initial run — the first fire is not a recovered
+        # recurrence to suppress.
+        with tempfile.TemporaryDirectory() as d:
+            store = FileScheduleStore(store_dir=d)
+            job = ScheduleJob(
+                name="brief",
+                schedule=Schedule(kind="cron", cron_expr="0 7 * * *", tz="UTC"),
+                message="brief",
+                misfire_grace_seconds=600,
+                # created far in the past so the first 07:00 slot is already
+                # due; last_run_at left None → never run.
+                created_at=time.time() - 3 * 86400,
+            )
+            store.add(job)
+            claimed = store.claim_due(time.time(), owner_id="A")
+            assert len(claimed) == 1
+            # No missed record for a first run.
+            assert store.get_history(job_id=job.id) == []
+
 
 class TestSerialisation:
     def test_grace_round_trips(self):
```

---

### Incident Patch 6: `69d26ade` (2026-09-30)
**Commit Message**: fix: quarantine unrepairable SQLite DBs and harden guard against locks/backup-loss

Address reviewer findings on the #5387 integrity guard:
- Quarantine an unrepairable malformed DB (after forensic backup) so the
  durable store opens a fresh usable database instead of crashing on the first
  CREATE TABLE (the core #5387 durable-path fix).
- Treat "database is locked/busy" as transient, not corruption, so a peer's
  momentary lock never triggers a needless backup + repair.
- Fail closed: skip repair when a requested forensic backup could not be taken,
  so repair's atomic promotion never destroys the only copy of the bad bytes.
- Use a per-attempt-unique repair snapshot so concurrent repairs cannot share
  or clobber each other's in-flight rebuild.
- Prune orphaned -wal/-shm forensic sidecars with their primary copy so WAL
  backups cannot escape the retention cap.

Adds tests for quarantine-and-boot, lock-not-corruption, failed-backup-stops-
repair, and an end-to-end transcript-store recovery on a malformed DB.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-authored-by: Mervin Praison <MervinPraison@users.noreply.github.com>

**File**: `src/praisonai-agents/praisonaiagents/storage/sqlite.py` (modified, +80/-11)
```diff
@@ -160,18 +160,34 @@ def apply_wal_with_fallback(
 _MAX_REPAIR_ATTEMPTS = 3
 
 
+def _is_transient_lock_error(exc: Exception) -> bool:
+    """True if an error is a transient lock/busy condition, not corruption.
+
+    A healthy database that a peer momentarily locks raises ``database is
+    locked`` / ``database is busy``. Treating that as corruption would trigger a
+    needless forensic copy and repair on a file that was never corrupt, so the
+    guard must distinguish it from a genuine "malformed image" error.
+    """
+    text = str(exc).lower()
+    return "locked" in text or "database is busy" in text
+
+
 def quick_check(conn) -> bool:
     """Return True if ``PRAGMA quick_check`` reports the database is intact.
 
     ``quick_check`` is the cheap structural probe (it skips the exhaustive
     per-row index cross-check that ``integrity_check`` does), so it is safe to
     run once on open without touching the hot path. Any SQLite-level error
     (a malformed header, "database disk image is malformed", an I/O error) is
-    treated as *not intact* so the caller can route to backup/repair.
+    treated as *not intact* so the caller can route to backup/repair. A
+    transient lock/busy error is re-raised so callers can tell "locked" (leave
+    alone) apart from "corrupt" (back up + repair).
     """
     try:
         row = conn.execute("PRAGMA quick_check(1)").fetchone()
     except Exception as exc:  # DatabaseError / OperationalError on a bad file
+        if _is_transient_lock_error(exc):
+            raise
         logger.warning("quick_check raised for database (%s); treating as corrupt.", exc)
         return False
     return bool(row) and str(row[0]).lower() == "ok"
@@ -253,10 +269,14 @@ def _prune_forensic_backups(path: str) -> None:
         return
     copies.sort(key=lambda p: os.path.getmtime(p))
     for stale in copies[: len(copies) - _MAX_FORENSIC_BACKUPS]:
-        try:
-            os.remove(stale)
-        except OSError:
-            pass
+        # Remove the primary copy together with its own ``-wal``/``-shm``
+        # sidecars so a WAL database's forensic sidecars cannot accumulate past
+        # the retention cap.
+        for target in (stale, stale + "-wal", stale + "-shm"):
+            try:
+                os.remove(target)
+            except OSError:
+                pass
 
 
 def _repair_ledger_path(path: str) -> str:
@@ -311,7 +331,9 @@ def _repair_via_online_backup(path: str) -> bool:
     import sqlite3
 
     _record_repair_attempt(path)
-    snapshot = path + ".repair-tmp"
+    # A per-attempt-unique snapshot name so two concurrent repairs of the same
+    # file never delete or promote each other's in-flight rebuild.
+    snapshot = f"{path}.repair-tmp-{os.getpid()}-{id(path)}"
     try:
         os.remove(snapshot)
     except OSError:
@@ -381,12 +403,37 @@ def _repair_via_online_backup(path: str) -> bool:
     return True
 
 
+def _quarantine_unrepairable(path: str) -> None:
+    """Move an unrepairable malformed file aside so a fresh DB can be created.
+
+    When the online-backup API cannot rebuild an intact snapshot (e.g. a
+    corrupt header that reads as "file is not a database"), the malformed bytes
+    are already preserved by :func:`_forensic_backup`; renaming the canonical
+    file out of the way lets the store open a fresh, empty database instead of
+    crashing on the first ``CREATE TABLE`` — mirroring the JSON store's
+    quarantine-and-continue behaviour (Issue #5387). Sidecars go too so a stale
+    ``-wal`` cannot be replayed over the new file.
+    """
+    for sidecar in _sidecar_paths(path):
+        try:
+            os.remove(sidecar)
+        except OSError:
+            pass
+    try:
+        os.remove(path)
+    except OSError as exc:
+        logger.error("Could not clear unrepairable malformed file %s: %s", path, exc)
+
+
 def _guard_integrity(path: str, *, repair: bool, backup: bool) -> None:
     """Detect and (optionally) repair a malfor
```

**File**: `src/praisonai-agents/tests/unit/session/test_sqlite_transcript_store.py` (modified, +29/-0)
```diff
@@ -61,6 +61,35 @@ def test_persistence_across_instances(self, tmp_dir):
         history = s2.get_chat_history("s1")
         assert history == [{"role": "user", "content": "persist me"}]
 
+    def test_boots_on_malformed_db(self, tmp_dir):
+        """A malformed transcript DB recovers instead of taking the store down.
+
+        Before Issue #5387's guard, opening a corrupt ``sessions.db`` raised an
+        uncaught ``sqlite3.DatabaseError`` on the first ``CREATE TABLE``. The
+        guard forensically backs up the bad bytes and lets a fresh, usable store
+        open so durable session handling keeps working.
+        """
+        db = os.path.join(tmp_dir, "sessions.db")
+        s1 = SqliteTranscriptStore(session_dir=tmp_dir, db_path=db)
+        s1.add_message("s1", "user", "before corruption")
+        s1._conn.close()  # release the file/WAL before corrupting on disk
+
+        # Corrupt the on-disk database so quick_check fails and it is unreadable.
+        for sidecar in (db + "-wal", db + "-shm"):
+            if os.path.exists(sidecar):
+                os.remove(sidecar)
+        with open(db, "r+b") as fh:
+            fh.write(b"not a sqlite database" + b"\x00" * 300)
+
+        # A new store must open without raising and be usable.
+        s2 = SqliteTranscriptStore(session_dir=tmp_dir, db_path=db)
+        assert s2.add_message("s2", "user", "after recovery")
+        assert s2.get_chat_history("s2") == [
+            {"role": "user", "content": "after recovery"}
+        ]
+        # The malformed bytes were preserved for forensics.
+        assert any(f.startswith("sessions.db.corrupt-") for f in os.listdir(tmp_dir))
+
     def test_session_exists_and_delete(self, tmp_dir):
         store = SqliteTranscriptStore(session_dir=tmp_dir)
         assert not store.session_exists("s1")
```

**File**: `src/praisonai-agents/tests/unit/storage/test_sqlite_connector.py` (modified, +95/-0)
```diff
@@ -330,3 +330,98 @@ def test_guard_off_by_default_leaves_malformed_untouched(tmp_path):
     conn = connect(db)  # guard defaults to False
     conn.close()
     assert not any(p.name.startswith("state.db.corrupt-") for p in tmp_path.iterdir())
+
+
+def test_guard_quarantines_unrepairable_so_store_can_boot(tmp_path):
+    """An unrepairable malformed file is cleared so a fresh DB opens usable.
+
+    This is the durable-path fix for Issue #5387: after the guard runs, the
+    connection must be usable for schema creation (``CREATE TABLE``) instead of
+    raising ``file is not a database`` on first query. The malformed bytes are
+    preserved in a forensic copy.
+    """
+    db = str(tmp_path / "state.db")
+    _make_db(db)
+    _corrupt_file(db)
+    conn = connect(db, guard=True)
+    try:
+        # A fresh, empty database must be usable — this raised before the fix.
+        conn.execute("CREATE TABLE s (session_id TEXT PRIMARY KEY)")
+        conn.execute("INSERT INTO s VALUES ('a')")
+        conn.commit()
+        assert conn.execute("SELECT COUNT(*) FROM s").fetchone()[0] == 1
+    finally:
+        conn.close()
+    backups = [p for p in tmp_path.iterdir() if p.name.startswith("state.db.corrupt-")]
+    assert backups, "malformed bytes must be preserved before quarantine"
+
+
+def test_guard_leaves_locked_healthy_db_untouched(tmp_path, monkeypatch):
+    """A transient lock on a healthy DB is not mistaken for corruption."""
+    from praisonaiagents.storage import sqlite as sqlite_mod
+
+    db = str(tmp_path / "state.db")
+    _make_db(db, rows=4)
+
+    import sqlite3
+
+    real_connect = sqlite3.connect
+
+    class _LockingConn:
+        def __init__(self, conn):
+            self._conn = conn
+
+        def execute(self, sql, *a, **k):
+            if isinstance(sql, str) and "quick_check" in sql:
+                raise sqlite3.OperationalError("database is locked")
+            return self._conn.execute(sql, *a, **k)
+
+        def __getattr__(self, name):
+            return getattr(self._conn, name)
+
+    def _locking_connect(target, *args, **kwargs):
+        conn = real_connect(target, *args, **kwargs)
+        if str(target) == db:
+            return _LockingConn(conn)
+        return conn
+
+    monkeypatch.setattr(sqlite3, "connect", _locking_connect)
+    # Guard must NOT back up or quarantine a merely-locked healthy file.
+    sqlite_mod._guard_integrity(db, repair=True, backup=True)
+    monkeypatch.undo()
+
+    assert not any(p.name.startswith("state.db.corrupt-") for p in tmp_path.iterdir())
+    # The original healthy data is intact.
+    conn = connect(db)
+    try:
+        assert conn.execute("SELECT COUNT(*) FROM t").fetchone()[0] == 4
+    finally:
+        conn.close()
+
+
+def test_guard_skips_repair_when_backup_fails(tmp_path, monkeypatch):
+    """If the forensic backup cannot be taken, repair must not run.
+
+    Repair's atomic promotion would otherwise destroy the only copy of the
+    malformed bytes, so a failed backup must leave the canonical file untouched.
+    """
+    from praisonaiagents.storage import sqlite as sqlite_mod
+
+    db = str(tmp_path / "state.db")
+    _make_db(db)
+    _corrupt_file(db)
+    with open(db, "rb") as fh:
+        before = fh.read()
+
+    monkeypatch.setattr(sqlite_mod, "_forensic_backup", lambda path: None)
+    repaired = {"called": False}
+    monkeypatch.setattr(
+        sqlite_mod,
+        "_repair_via_online_backup",
+        lambda path: repaired.__setitem__("called", True) or True,
+    )
+    sqlite_mod._guard_integrity(db, repair=True, backup=True)
+
+    assert repaired["called"] is False, "repair must not run when backup failed"
+    with open(db, "rb") as fh:
+        assert fh.read() == before  # canonical malformed bytes preserved
```

---

### Incident Patch 7: `df4fa6d4` (2026-09-30)
**Commit Message**: fix: park scheduled jobs past provider rate-limit window (fixes #5386)

A recurring job whose model provider is 429/quota-limited kept firing on
every interval — each tick built an agent, called the provider, recorded a
failed run, and did it all again next tick, burning requests against a
benched provider until a human intervened.

Add a provider-quota-aware hold:
- Core: a single `hold_until` field on `ScheduleJob` (serialised only when
  parked) + a pure `quota_hold_from_failure()` decision helper next to
  `is_due`, which now returns False while `now < hold_until` so intervening
  fires coalesce into the first legal instant after the window.
- Reuse the existing error classifier (`classify_error` / `extract_retry_after`)
  — no new parsing surface; `extract_retry_after` gains an optional cap so the
  hold honours a long reset window (bounded to 24h) instead of the 5-min
  in-tick backoff cap.
- Wrapper `RunPolicy`: opt-in `hold_on_rate_limit` (default True) +
  `hold_slack_seconds`.
- Bot executor: park on a rate-limit failure (agent + backend paths), clear
  the hold on the first run that reaches the model, and emit one "held until N"
  notice via the existing de-duplicating i

**File**: `src/praisonai-agents/praisonaiagents/llm/error_classifier.py` (modified, +13/-6)
```diff
@@ -588,12 +588,19 @@ def get_retry_delay(category: ErrorCategory, attempt: int = 1, base_delay: float
     return 0
 
 
-def extract_retry_after(error: Exception) -> Optional[float]:
+def extract_retry_after(
+    error: Exception, cap_seconds: float = 300.0,
+) -> Optional[float]:
     """Extract Retry-After header value from rate limit errors.
-    
+
     Args:
         error: Exception potentially containing Retry-After info
-        
+        cap_seconds: Upper bound applied to the parsed value. Defaults to 300s
+            (5 minutes) for in-tick backoff callers. A scheduler *hold* passes a
+            larger cap so a job can be parked past a long provider reset window
+            (e.g. an hourly quota) instead of re-firing every tick — capping at
+            5 minutes there would defeat the park.
+
     Returns:
         Delay in seconds if found, None otherwise
     """
@@ -608,14 +615,14 @@ def extract_retry_after(error: Exception) -> Optional[float]:
             retry_after = None
         if retry_after is not None:
             try:
-                return min(float(retry_after), 300.0)  # Cap at 5 minutes
+                return min(float(retry_after), cap_seconds)
             except (ValueError, TypeError):
                 pass  # Not a plain number (could be an HTTP-date); fall through
 
     # 2. Some SDKs expose a numeric ``retry_after`` attribute directly.
     retry_after_attr = getattr(error, "retry_after", None)
     if isinstance(retry_after_attr, (int, float)):
-        return min(float(retry_after_attr), 300.0)
+        return min(float(retry_after_attr), cap_seconds)
 
     error_str = str(error)
     
@@ -632,7 +639,7 @@ def extract_retry_after(error: Exception) -> Optional[float]:
         if match:
             try:
                 delay = float(match.group(1))
-                return min(delay, 300.0)  # Cap at 5 minutes
+                return min(delay, cap_seconds)
             except (ValueError, IndexError):
                 continue
     
```

**File**: `src/praisonai-agents/praisonaiagents/scheduler/__init__.py` (modified, +7/-0)
```diff
@@ -25,6 +25,7 @@
     from .store import FileScheduleStore
     from .config_store import ConfigYamlScheduleStore
     from .parser import parse_schedule
+    from .due import quota_hold_from_failure
     from .runner import ScheduleRunner
     from .loop import ScheduleLoop, InProcessScheduleProvider
     from .protocols import (
@@ -106,6 +107,11 @@ def __getattr__(name: str):
         _module_cache[name] = parse_schedule
         return parse_schedule
 
+    if name == "quota_hold_from_failure":
+        from .due import quota_hold_from_failure
+        _module_cache[name] = quota_hold_from_failure
+        return quota_hold_from_failure
+
     if name == "ScheduleRunner":
         from .runner import ScheduleRunner
         _module_cache[name] = ScheduleRunner
@@ -176,6 +182,7 @@ def __getattr__(name: str):
     "FileScheduleStore",
     "ConfigYamlScheduleStore",
     "parse_schedule",
+    "quota_hold_from_failure",
     "ScheduleRunner",
     "ScheduleLoop",
     "InProcessScheduleProvider",
```

**File**: `src/praisonai-agents/praisonaiagents/scheduler/due.py` (modified, +63/-0)
```diff
@@ -76,6 +76,58 @@ def next_fire_time(
     return croniter(cron_expr, base_datetime).get_next(datetime).timestamp()
 
 
+# Upper bound on a single quota hold (24h) so a bogus/huge provider Retry-After
+# cannot park a recurring job indefinitely.
+_MAX_HOLD_SECONDS = 86_400.0
+
+
+def quota_hold_from_failure(
+    error: Any,
+    now: float,
+    slack_seconds: float = 60.0,
+) -> float | None:
+    """Return an epoch to park a job past a provider's rate-limit window.
+
+    Pure decision helper for the "provider-quota-aware hold": given a run's
+    failure it decides whether the job should stop re-firing until the
+    provider's own reset window elapses. Returns ``now + Retry-After + slack``
+    when the failure is a rate-limit / quota signal carrying a usable reset
+    hint, else ``None`` (no hold — a non-quota failure keeps today's behaviour).
+
+    Reuses the core error classifier so a 429/quota error is recognised by
+    exception type, HTTP status code, or message, and the reset window is read
+    from the provider's ``Retry-After`` header / ``retry_after`` attribute /
+    message text — no new parsing surface. The small ``slack_seconds`` avoids
+    re-firing the instant the window reopens (clock skew / provider rounding).
+
+    Args:
+        error: The failure — an ``Exception`` (preferred, so the classifier can
+            read the response headers) or an error string.
+        now: Epoch the failure was observed at.
+        slack_seconds: Extra seconds added past the provider's reset window.
+
+    Returns:
+        The epoch before which the job should be parked, or ``None`` when the
+        failure is not a quota signal or carries no usable reset window.
+    """
+    from praisonaiagents.llm.error_classifier import (
+        ErrorCategory,
+        classify_error,
+        extract_retry_after,
+    )
+
+    exc = error if isinstance(error, Exception) else Exception(str(error or ""))
+    if classify_error(exc) != ErrorCategory.RATE_LIMIT:
+        return None
+    # Honour the provider's full reset window (unlike in-tick backoff, which caps
+    # at 5 minutes) so a long quota window parks the job instead of re-firing —
+    # but bound it to 24h so a bogus/huge value can't park a job indefinitely.
+    retry_after = extract_retry_after(exc, cap_seconds=_MAX_HOLD_SECONDS)
+    if not retry_after or retry_after <= 0:
+        return None
+    return now + float(retry_after) + max(float(slack_seconds), 0.0)
+
+
 def is_due(
     job: Any,
     now: float,
@@ -101,6 +153,17 @@ def is_due(
     run_count = getattr(job, "run_count", 0)
     if max_runs is not None and run_count >= max_runs:
         return False
+    # Provider-quota hold short-circuits before the kind check: while a job is
+    # parked past a provider's known-closed window (a 429/quota ``Retry-After``
+    # captured on a prior failure) it is not due, so it stops re-firing and
+    # re-failing every tick against a benched provider. Any intervening fires
+    # coalesce — the job becomes due again at the first legal instant once the
+    # hold elapses. The executor clears ``hold_until`` on the first run that
+    # reaches the model (proof the window reopened).
+    hold_until = getattr(job, "hold_until", None)
+    if hold_until is not None and now < hold_until:
+        return False
+
     until = getattr(job, "until", None)
     if until is not None:
         try:
```

**File**: `src/praisonai-agents/praisonaiagents/scheduler/models.py` (modified, +17/-0)
```diff
@@ -374,6 +374,16 @@ class ScheduleJob:
                  ``skipped`` (no tokens, no delivery) so a downstream never runs
                  on empty inputs. Consistent with the existing ``skipped``
                  outcome.
+        hold_until: Optional epoch instant before which the job is parked and
+                 not due, even when its schedule would otherwise fire. Set when
+                 a run fails with a provider rate-limit / quota signal (the
+                 provider's own ``Retry-After`` / reset window plus a small
+                 slack): the recurring job stops re-firing and re-failing every
+                 tick against a benched provider. Intervening fires coalesce
+                 into the first legal instant after the hold; the executor
+                 clears it on the first run that reaches the model (proof the
+                 window reopened). ``None`` (default) keeps today's behaviour,
+                 so jobs that never hit a quota wall are unchanged.
     """
 
     name: str = ""
@@ -405,6 +415,7 @@ class ScheduleJob:
     on_missing_context: Literal["run", "skip"] = "run"
     backend: Optional[str] = None
     backend_options: Dict[str, Any] = field(default_factory=dict)
+    hold_until: Optional[float] = None
 
     # ── bounded-run retirement ───────────────────────────────────────
 
@@ -526,6 +537,11 @@ def to_dict(self) -> Dict[str, Any]:
             d["backend"] = self.backend
             if self.backend_options:
                 d["backend_options"] = dict(self.backend_options)
+        # Provider-quota hold. Only persist when parked so a job that never hit
+        # a quota wall stays byte-for-byte unchanged; the parked instant must
+        # survive a restart so a benched job stays parked across processes.
+        if self.hold_until is not None:
+            d["hold_until"] = self.hold_until
         # Atomic-claim lease metadata (set dynamically by stores that support
         # ``claim_due``). Persisted so a lease is visible across processes and
         # survives a restart; omitted when no lease is held.
@@ -583,6 +599,7 @@ def from_dict(cls, d: Dict[str, Any]) -> "ScheduleJob":
                 if isinstance(d.get("backend_options"), dict)
                 else {}
             ),
+            hold_until=d.get("hold_until"),
         )
         # Restore atomic-claim lease metadata if present (see ``to_dict``).
         job._lease_until = d.get("lease_until", 0.0) or 0.0
```

**File**: `src/praisonai-agents/tests/unit/test_schedule_quota_hold.py` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+"""Core tests for the provider-quota-aware schedule hold (Issue #5386).
+
+A recurring job whose model provider is rate-limited must stop re-firing and
+re-failing every tick: the first 429 parks ``next`` due instant past the
+provider's own reset window (``Retry-After``), intervening fires coalesce, and
+the job becomes due again once the window elapses. Covers the pure decision
+helper ``quota_hold_from_failure`` and the ``is_due`` hold guard, plus the
+serialisation round-trip of the new ``hold_until`` field.
+"""
+
+from praisonaiagents.scheduler import quota_hold_from_failure
+from praisonaiagents.scheduler.due import is_due
+from praisonaiagents.scheduler.models import Schedule, ScheduleJob
+
+
+class _RateLimited(Exception):
+    """A 429-shaped provider error carrying a Retry-After header."""
+
+    def __init__(self, retry_after):
+        super().__init__("Rate limit exceeded")
+        self.status_code = 429
+
+        class _Resp:
+            headers = {"retry-after": str(retry_after)}
+
+        self.response = _Resp()
+
+
+# ── quota_hold_from_failure (pure decision helper) ────────────────────
+
+
+def test_rate_limit_with_retry_after_parks_past_window():
+    now = 1000.0
+    hold = quota_hold_from_failure(_RateLimited(3600), now, slack_seconds=60.0)
+    assert hold == now + 3600 + 60
+
+
+def test_retry_after_parsed_from_message_string():
+    now = 500.0
+    hold = quota_hold_from_failure(
+        "429 Too Many Requests, retry after 30 seconds", now, slack_seconds=10.0
+    )
+    assert hold == now + 30 + 10
+
+
+def test_non_quota_failure_never_holds():
+    assert quota_hold_from_failure(Exception("boom: invalid request"), 0.0) is None
+    assert quota_hold_from_failure(Exception("connection reset"), 0.0) is None
+
+
+def test_rate_limit_without_reset_hint_does_not_hold():
+    # A 429 with no Retry-After / reset window carries no usable park instant.
+    class _Bare(Exception):
+        status_code = 429
+
+    assert quota_hold_from_failure(_Bare("rate limited"), 0.0) is None
+
+
+def test_slack_is_clamped_non_negative():
+    now = 0.0
+    assert quota_hold_from_failure(_RateLimited(100), now, slack_seconds=-5.0) == 100.0
+
+
+# ── is_due hold guard ─────────────────────────────────────────────────
+
+
+def _every_job(**kw):
+    return ScheduleJob(
+        name="j", schedule=Schedule(kind="every", every_seconds=1), message="hi", **kw
+    )
+
+
+def test_held_job_not_due_within_window():
+    job = _every_job(hold_until=2000.0)
+    # Would otherwise be due (every-1s, never run) but is parked.
+    assert is_due(job, now=1999.0) is False
+
+
+def test_held_job_due_again_after_window():
+    job = _every_job(hold_until=2000.0)
+    assert is_due(job, now=2000.0) is True
+    assert is_due(job, now=2500.0) is True
+
+
+def test_unparked_job_unchanged():
+    # No hold → today's behaviour exactly.
+    assert is_due(_every_job(), now=123.0) is True
+
+
+def test_intervening_fires_coalesce():
+    # A parked every-1s job stays not-due across every intervening tick and
+    # fires exactly once at the first legal instant after the window.
+    job = _every_job(hold_until=100.0)
+    assert [is_due(job, now=t) for t in (10, 50, 99)] == [False, False, False]
+    assert is_due(job, now=100.0) is True
+
+
+# ── serialisation round-trip ──────────────────────────────────────────
+
+
+def test_hold_until_round_trips():
+    job = _every_job(hold_until=4242.0)
+    restored = ScheduleJob.from_dict(job.to_dict())
+    assert restored.hold_until == 4242.0
+
+
+def test_unparked_job_omits_hold_until_key():
+    # A job that never hit a quota wall stays byte-for-byte unchanged.
+    assert "hold_until" not in _every_job().to_dict()
```

---

### Incident Patch 8: `4b49b0cb` (2026-09-30)
**Commit Message**: fix: record missed recurring occurrences with a misfire grace window (fixes #5385)

Recurring jobs that came due while the process was down previously fired a
stale run on recovery (or, for the intended slot, silently resumed from now)
with no record of the missed occurrence. Add a per-job misfire_grace_seconds:
an occurrence older than the grace window on recovery is recorded as an
observable `missed` RunRecord instead of firing late or vanishing. Within the
window it coalesces into one normal fire (unchanged). None (default) keeps
existing behaviour byte-for-byte.

Co-authored-by: MervinPraison <MervinPraison@users.noreply.github.com>

**File**: `src/praisonai-agents/praisonaiagents/scheduler/config_store.py` (modified, +23/-1)
```diff
@@ -15,7 +15,7 @@
 from typing import Dict, Iterator, List, Optional
 
 from .models import ScheduleJob, RunRecord
-from .due import is_due as _is_due, resolve_schedule_timezone
+from .due import is_due as _is_due, is_misfire as _is_misfire, resolve_schedule_timezone
 from .hook_emit import emit_schedule_add, emit_schedule_remove
 
 logger = get_logger(__name__)
@@ -202,6 +202,10 @@ def claim_due(
         # a later ``remove(job.id)`` by the runner is then a no-op, so a spent
         # one-shot yields exactly one SCHEDULE_REMOVE.
         auto_removed: List[ScheduleJob] = []
+        # (job_id, job_name) for occurrences suppressed by the misfire policy.
+        # Logged as ``missed`` history after the lock so a dropped occurrence is
+        # observable instead of vanishing silently.
+        missed: List[tuple] = []
         with self._lock, self._file_lock():
             # Re-read from disk so we observe cross-process claims/leases.
             self._reload_locked()
@@ -224,6 +228,16 @@ def claim_due(
                         self._job_state.pop(job.id, None)
                         changed = True
                     continue
+                # Misfire policy: an occurrence that landed while the process
+                # was down and is now older than ``misfire_grace_seconds`` is
+                # recorded as ``missed`` (observable) rather than fired stale or
+                # dropped silently. Advance past the slot so it is not seen due
+                # again on the next poll.
+                if _is_misfire(job, now, self._default_timezone):
+                    job.last_run_at = now
+                    missed.append((job.id, job.name))
+                    changed = True
+                    continue
                 # Win the claim: pre-advance + lease atomically.
                 job.last_run_at = now
                 # Count the fire here (needed so ``should_retire()`` can drop a
@@ -254,6 +268,14 @@ def claim_due(
                     return []
         for job in auto_removed:
             emit_schedule_remove(job)
+        # Record suppressed occurrences so a missed run is visible in history
+        # rather than silently dropped (log_run takes only the thread lock).
+        for job_id, job_name in missed:
+            self.log_run(
+                job_id=job_id,
+                status="missed",
+                job_name=job_name,
+            )
         return claimed
 
     def complete(self, job_id: str, owner_id: str) -> None:
```

**File**: `src/praisonai-agents/praisonaiagents/scheduler/due.py` (modified, +85/-0)
```diff
@@ -76,6 +76,91 @@ def next_fire_time(
     return croniter(cron_expr, base_datetime).get_next(datetime).timestamp()
 
 
+def scheduled_instant(
+    job: Any,
+    now: float,
+    default_timezone: str | None = None,
+) -> float | None:
+    """Return the epoch of the occurrence this due job is firing *for*.
+
+    When a recurring job becomes due at ``now`` it is firing for a specific
+    scheduled slot that may lie in the past (the process was down when the
+    slot arrived). This returns that slot's canonical instant so a misfire
+    policy can decide whether recovery is still within an acceptable grace
+    window. ``None`` is returned when there is no meaningful past slot (a
+    never-run interval job, or a kind/expression that cannot be evaluated).
+
+    - ``every``: the *first* slot that came due after ``last_run_at``
+      (``last_run_at + every_seconds``). Its age measures how long the job has
+      been overdue — the meaningful lateness for a coalesced recovery.
+    - ``cron``: the last cron fire at or before ``now`` (the slot being
+      recovered for a daily/weekly schedule).
+    - ``at``: the target instant itself.
+    """
+    sched = job.schedule
+    if sched.kind == "every":
+        if sched.every_seconds is None or job.last_run_at is None:
+            return None
+        if now - job.last_run_at < sched.every_seconds:
+            return None
+        return job.last_run_at + sched.every_seconds
+    if sched.kind == "at":
+        if sched.at is None:
+            return None
+        try:
+            return localize_wall_clock(
+                datetime.fromisoformat(sched.at),
+                sched.tz or default_timezone,
+            ).timestamp()
+        except (ValueError, TypeError):
+            return None
+    if sched.kind == "cron":
+        if sched.cron_expr is None:
+            return None
+        try:
+            from croniter import croniter  # type: ignore[import-untyped]
+        except ImportError:
+            return None
+        try:
+            base_datetime = datetime.fromtimestamp(
+                now, resolve_schedule_timezone(sched.tz or default_timezone)
+            )
+            return croniter(sched.cron_expr, base_datetime).get_prev(datetime).timestamp()
+        except (ValueError, KeyError, TypeError):
+            return None
+    return None
+
+
+def is_misfire(
+    job: Any,
+    now: float,
+    default_timezone: str | None = None,
+) -> bool:
+    """Whether a *due* job's occurrence should be suppressed as a misfire.
+
+    Shared by every atomic-claim store so the misfire decision is defined once.
+    Returns ``True`` when the occurrence the job is firing for is older than
+    ``misfire_grace_seconds`` — a stale run whose slot passed while the process
+    was down. Such an occurrence is recorded as ``missed`` (observable) instead
+    of firing a late, no-longer-useful run. An occurrence still within the
+    grace window (or a first run) coalesces into a single normal fire on
+    recovery, the pre-existing behaviour.
+
+    With no grace set this is always ``False`` — existing jobs keep firing
+    exactly as before.
+    """
+    grace = getattr(job, "misfire_grace_seconds", None)
+    if grace is None:
+        return False
+    instant = scheduled_instant(job, now, default_timezone)
+    if instant is None:
+        return False
+    age = now - instant
+    if age <= 0:
+        return False
+    return age > grace
+
+
 def is_due(
     job: Any,
     now: float,
```

**File**: `src/praisonai-agents/praisonaiagents/scheduler/models.py` (modified, +25/-3)
```diff
@@ -198,12 +198,16 @@ class RunRecord:
         job_id: ID of the job that was executed.
         job_name: Human-readable name of the job.
         status: Execution status. One of ``"succeeded"``, ``"failed"``,
-                ``"skipped"``, or ``"no_change"``. ``"no_change"`` is the
-                stateful "monitor mode" outcome — a watched source was
+                ``"skipped"``, ``"no_change"``, or ``"missed"``. ``"no_change"``
+                is the stateful "monitor mode" outcome — a watched source was
                 unchanged since the last tick, so the model turn was suppressed
                 silently (no tokens, no delivery). It is distinct from
                 ``"skipped"`` (a generic gate go/no-go) so an operator can tell
                 "nothing changed" apart from "the gate said don't run".
+                ``"missed"`` records a recurring occurrence that landed while
+                the process was down and fell outside the job's
+                ``misfire_grace_seconds`` — it was not run, but is recorded
+                (not silently dropped) so an operator can see the gap.
         result: Agent response text (truncated if very long).
         error: Error message if status is ``"failed"``.
         duration: Wall-clock seconds for execution.
@@ -213,7 +217,7 @@ class RunRecord:
 
     job_id: str
     job_name: str = ""
-    status: Literal["succeeded", "failed", "skipped", "no_change"] = "succeeded"
+    status: Literal["succeeded", "failed", "skipped", "no_change", "missed"] = "succeeded"
     result: Optional[str] = None
     error: Optional[str] = None
     duration: float = 0.0
@@ -374,6 +378,18 @@ class ScheduleJob:
                  ``skipped`` (no tokens, no delivery) so a downstream never runs
                  on empty inputs. Consistent with the existing ``skipped``
                  outcome.
+        misfire_grace_seconds: Misfire policy for a recurring occurrence missed
+                 while the process was down — the maximum age (seconds) of the
+                 occurrence being recovered for it to still run. When the slot
+                 the job is firing for is older than this on recovery, the
+                 occurrence is recorded as ``missed`` (an observable
+                 :class:`RunRecord`) rather than fired — so a daily brief whose
+                 gateway was down for hours does not surface a stale run long
+                 after it was useful, yet the gap is never silently dropped. An
+                 occurrence still within the window (or a first run) coalesces
+                 into a single normal fire on recovery. ``None`` (default)
+                 disables the check, so existing jobs are byte-for-byte
+                 unchanged and keep firing exactly as before.
     """
 
     name: str = ""
@@ -403,6 +419,7 @@ class ScheduleJob:
     context_from: Optional[List[str]] = None
     context_max_chars: int = 4000
     on_missing_context: Literal["run", "skip"] = "run"
+    misfire_grace_seconds: Optional[float] = None
     backend: Optional[str] = None
     backend_options: Dict[str, Any] = field(default_factory=dict)
 
@@ -519,6 +536,10 @@ def to_dict(self) -> Dict[str, Any]:
                 d["context_max_chars"] = self.context_max_chars
             if self.on_missing_context != "run":
                 d["on_missing_context"] = self.on_missing_context
+        # Misfire policy. Only persist when configured so a job with no misfire
+        # grace stays byte-for-byte unchanged.
+        if self.misfire_grace_seconds is not None:
+            d["misfire_grace_seconds"] = self.misfire_grace_seconds
         # External CLI backend action. Only persist when configured so agent
         # and command jobs stay byte-for-byte unchanged; options are opaque to
         # the core (the executor validates them against the backend registry).
@@ -577,6 +598,7 @@ def from_dict(cls, d: Dict[str, Any]) -> "ScheduleJob":
             context_from=context_from,
       
```

**File**: `src/praisonai-agents/praisonaiagents/scheduler/store.py` (modified, +26/-1)
```diff
@@ -14,7 +14,7 @@
 from typing import Dict, Iterator, List, Optional
 
 from .models import ScheduleJob, RunRecord
-from .due import is_due as _is_due
+from .due import is_due as _is_due, is_misfire as _is_misfire
 from .hook_emit import emit_schedule_add, emit_schedule_remove
 
 logger = get_logger(__name__)
@@ -187,6 +187,10 @@ def claim_due(
         # a later ``remove(job.id)`` by the runner is then a no-op, so a spent
         # one-shot yields exactly one SCHEDULE_REMOVE.
         auto_removed: List[ScheduleJob] = []
+        # (job_id, job_name) for occurrences suppressed by the misfire policy.
+        # Logged as ``missed`` history after the lock so a dropped occurrence is
+        # observable instead of vanishing silently.
+        missed: List[tuple] = []
         with self._lock, self._file_lock():
             # Re-read from disk so we observe cross-process claims/leases.
             self._reload_locked()
@@ -208,6 +212,18 @@ def claim_due(
                         auto_removed.append(self._jobs.pop(job.id))
                         changed = True
                     continue
+                # Misfire policy: the job is due, but the occurrence it is
+                # firing for may have landed while the process was down. Decide
+                # whether to run it now or record it as ``missed`` (observable)
+                # rather than firing a stale run or dropping it silently.
+                if _is_misfire(job, now):
+                    # Advance the schedule past the missed slot (so the next
+                    # poll does not see it as due again) and record the miss,
+                    # without claiming or firing.
+                    job.last_run_at = now
+                    missed.append((job.id, job.name))
+                    changed = True
+                    continue
                 # Win the claim: pre-advance + lease atomically.
                 job.last_run_at = now
                 # Count the fire here (needed so ``should_retire()`` can drop a
@@ -237,6 +253,15 @@ def claim_due(
                     return []
         for job in auto_removed:
             emit_schedule_remove(job)
+        # Record suppressed occurrences so a missed run is visible in history
+        # rather than silently dropped. Logged outside the file lock (log_run
+        # takes only the thread lock) to keep the critical section short.
+        for job_id, job_name in missed:
+            self.log_run(
+                job_id=job_id,
+                status="missed",
+                job_name=job_name,
+            )
         return claimed
 
     def complete(self, job_id: str, owner_id: str) -> None:
```

**File**: `src/praisonai-agents/tests/unit/test_schedule_misfire.py` (added, +191/-0)
```diff
@@ -0,0 +1,191 @@
+"""
+Unit tests for the scheduler misfire / missed-run policy.
+
+Tests:
+- scheduled_instant() returns the occurrence a due job is firing for
+- is_misfire() is False without a grace window (backward-compatible)
+- A recurring occurrence older than misfire_grace_seconds is recorded as
+  ``missed`` and not claimed/fired (interval + cron)
+- A recovery within the grace window still fires once (coalesce)
+- A first run (never fired) always fires, never recorded missed
+- misfire_grace_seconds round-trips through to_dict / from_dict and is omitted
+  when unset
+- The default store (ConfigYamlScheduleStore) applies the same policy
+"""
+
+import os
+import tempfile
+import time
+
+import pytest
+
+from praisonaiagents.scheduler.models import Schedule, ScheduleJob
+from praisonaiagents.scheduler.store import FileScheduleStore
+from praisonaiagents.scheduler.config_store import ConfigYamlScheduleStore
+from praisonaiagents.scheduler.due import scheduled_instant, is_misfire
+
+
+def _interval_job(name="job", every=60, grace=None, last_run_at=None):
+    job = ScheduleJob(
+        name=name,
+        schedule=Schedule(kind="every", every_seconds=every),
+        message="hi",
+        misfire_grace_seconds=grace,
+    )
+    if last_run_at is not None:
+        job.last_run_at = last_run_at
+    return job
+
+
+class TestScheduledInstant:
+    def test_interval_missed_slot(self):
+        # last run at t0; the first overdue slot is t0 + one interval — its age
+        # measures how long the job has been overdue.
+        t0 = 1000.0
+        job = _interval_job(every=60, last_run_at=t0)
+        instant = scheduled_instant(job, t0 + 60 * 5 + 3)
+        assert instant == t0 + 60
+
+    def test_interval_first_run_has_no_instant(self):
+        job = _interval_job(every=60)  # never run
+        assert scheduled_instant(job, time.time()) is None
+
+    def test_interval_not_yet_elapsed(self):
+        t0 = 1000.0
+        job = _interval_job(every=60, last_run_at=t0)
+        assert scheduled_instant(job, t0 + 30) is None
+
+
+class TestIsMisfire:
+    def test_no_grace_is_never_misfire(self):
+        t0 = 1000.0
+        job = _interval_job(every=60, last_run_at=t0, grace=None)
+        # Even a very old slot is not a misfire without a grace window.
+        assert is_misfire(job, t0 + 60 * 100) is False
+
+    def test_stale_slot_is_misfire(self):
+        t0 = 1000.0
+        job = _interval_job(every=60, last_run_at=t0, grace=90)
+        # Slot at t0+60, now is t0+300 → age 240 > 90 grace.
+        assert is_misfire(job, t0 + 300) is True
+
+    def test_fresh_slot_within_grace_is_not_misfire(self):
+        t0 = 1000.0
+        job = _interval_job(every=60, last_run_at=t0, grace=90)
+        # Slot at t0+60, now is t0+70 → age 10 < 90 grace.
+        assert is_misfire(job, t0 + 70) is False
+
+    def test_first_run_never_misfire(self):
+        job = _interval_job(every=60, grace=1)  # never run
+        assert is_misfire(job, time.time()) is False
+
+
+class TestClaimMisfire:
+    def test_stale_occurrence_recorded_missed_not_claimed(self):
+        with tempfile.TemporaryDirectory() as d:
+            store = FileScheduleStore(store_dir=d)
+            t0 = time.time() - 10000
+            job = _interval_job(every=60, grace=90)
+            job.last_run_at = t0
+            store.add(job)
+            claimed = store.claim_due(time.time(), owner_id="A")
+            # Not fired.
+            assert claimed == []
+            # Recorded as observable missed, not silently dropped.
+            history = store.get_history(job_id=job.id)
+            assert len(history) == 1
+            assert history[0].status == "missed"
+            # Schedule advanced so it is not re-seen as due immediately.
+            reloaded = store.get(job.id)
+            assert reloaded.last_run_at is not None
+            assert reloaded.last_run_at > t0
+
+    def test_within_grace_still_fires_once(self):
+        with tempf
```

---

### Incident Patch 9: `8b8664d0` (2026-09-30)
**Commit Message**: fix: detect, back up, and repair malformed SQLite stores on open (fixes #5387)

Add an opt-in integrity guard to the central storage.sqlite.connect()
chokepoint that every core durable SQLite store already routes through.
On open (gated, not hot-path) it runs a cheap quick_check; on a malformed
file it takes a retention-capped, disk-space-aware forensic backup
(+WAL/SHM sidecars, fails closed on low disk) and attempts a bounded,
least-destructive online-backup repair promoted only when the rebuilt
snapshot itself passes quick_check, so canonical bytes are never touched
by a failed attempt. A sidecar attempt-ledger bounds persistent retry so
a permanently-bad file is not re-repaired every boot.

The core session index and transcript SQLite stores opt in via guard=True
so a corrupt durable file recovers instead of crashing the durable path
with an uncaught sqlite3.DatabaseError. Guard defaults off, keeping all
existing callers unchanged.

Co-authored-by: MervinPraison <MervinPraison@users.noreply.github.com>

**File**: `src/praisonai-agents/praisonaiagents/session/sqlite_store.py` (modified, +4/-1)
```diff
@@ -102,7 +102,10 @@ def _connect(self):
                 # DELETE fallback on NFS/SMB/FUSE/virtiofs (Issue #5264).
                 from ..storage.sqlite import connect as _sqlite_connect
 
-                conn = _sqlite_connect(self.db_path, isolation_level=None)
+                # guard=True: quick_check on open + forensic backup + bounded
+                # least-destructive repair so a malformed index file recovers
+                # instead of taking the durable path down (Issue #5387).
+                conn = _sqlite_connect(self.db_path, isolation_level=None, guard=True)
                 self._fts_available = self._init_schema(conn)
                 self._conn = conn
             except Exception as exc:
```

**File**: `src/praisonai-agents/praisonaiagents/session/sqlite_transcript_store.py` (modified, +4/-0)
```diff
@@ -101,10 +101,14 @@ def _connect(self):
             # readers proceed concurrently with a writer where available.
             from ..storage.sqlite import connect as _sqlite_connect
 
+            # guard=True: quick_check on open + forensic backup + bounded
+            # least-destructive repair so a malformed transcript DB recovers
+            # instead of taking the durable path down (Issue #5387).
             conn = _sqlite_connect(
                 self.db_path,
                 isolation_level=None,
                 busy_timeout_ms=int(self.lock_timeout * 1000),
+                guard=True,
             )
             conn.execute(
                 "CREATE TABLE IF NOT EXISTS sessions ("
```

**File**: `src/praisonai-agents/praisonaiagents/storage/__init__.py` (modified, +3/-0)
```diff
@@ -31,6 +31,8 @@
     "get_backend",
     # Hardened stdlib SQLite connection factory (WAL-with-safe-fallback)
     "sqlite_connect",
+    # Structural integrity probe for durable SQLite stores (Issue #5387)
+    "sqlite_quick_check",
 ]
 
 _LAZY_IMPORTS = {
@@ -49,6 +51,7 @@
     "SQLiteBackend": ("backends", "SQLiteBackend"),
     "get_backend": ("backends", "get_backend"),
     "sqlite_connect": ("sqlite", "connect"),
+    "sqlite_quick_check": ("sqlite", "quick_check"),
 }
 
 
```

**File**: `src/praisonai-agents/praisonaiagents/storage/sqlite.py` (modified, +285/-0)
```diff
@@ -151,13 +151,284 @@ def apply_wal_with_fallback(
     return mode
 
 
+# Maximum forensic backups of a malformed file kept before the oldest is
+# pruned, so a boot-loop on a permanently-bad file cannot fill the disk.
+_MAX_FORENSIC_BACKUPS = 3
+# A malformed file is repaired at most this many times before the guard gives
+# up (records the exhaustion in a sidecar ledger) and stops re-repairing on
+# every boot, so a permanently-bad file is not churned each start.
+_MAX_REPAIR_ATTEMPTS = 3
+
+
+def quick_check(conn) -> bool:
+    """Return True if ``PRAGMA quick_check`` reports the database is intact.
+
+    ``quick_check`` is the cheap structural probe (it skips the exhaustive
+    per-row index cross-check that ``integrity_check`` does), so it is safe to
+    run once on open without touching the hot path. Any SQLite-level error
+    (a malformed header, "database disk image is malformed", an I/O error) is
+    treated as *not intact* so the caller can route to backup/repair.
+    """
+    try:
+        row = conn.execute("PRAGMA quick_check(1)").fetchone()
+    except Exception as exc:  # DatabaseError / OperationalError on a bad file
+        logger.warning("quick_check raised for database (%s); treating as corrupt.", exc)
+        return False
+    return bool(row) and str(row[0]).lower() == "ok"
+
+
+def _sidecar_paths(path: str):
+    """Return the WAL/SHM sidecar paths for a database file."""
+    return [path + "-wal", path + "-shm"]
+
+
+def _forensic_backup(path: str) -> Optional[str]:
+    """Copy a malformed database (+WAL/SHM sidecars) aside for forensics.
+
+    Mirrors the JSON store's ``_quarantine_corrupt`` behaviour: the raw,
+    possibly-recoverable bytes are preserved as ``<file>.corrupt-<epoch_ms>``
+    instead of being clobbered by a repair. Fails **closed** — returns ``None``
+    without copying — when free disk space is below the file size plus a margin,
+    so a corruption event never itself fills the disk. Retention-capped so a
+    boot-loop cannot accumulate unbounded copies.
+    """
+    import shutil
+    import time as _time
+
+    try:
+        size = os.path.getsize(path)
+    except OSError:
+        return None
+    try:
+        free = shutil.disk_usage(os.path.dirname(path) or ".").free
+    except OSError:
+        free = None
+    # Fail closed on low disk: need room for the file plus a small margin.
+    if free is not None and free < size * 2 + (1 << 20):
+        logger.error(
+            "Skipping forensic backup of %s: insufficient free disk space.", path
+        )
+        return None
+
+    base = f"{path}.corrupt-{int(_time.time() * 1000)}"
+    dest = base
+    attempt = 1
+    while os.path.exists(dest):
+        dest = f"{base}-{attempt}"
+        attempt += 1
+    try:
+        shutil.copy2(path, dest)
+    except OSError as exc:
+        logger.error("Forensic backup of %s failed: %s", path, exc)
+        return None
+    # Best-effort sidecar preservation; their absence is not fatal. Each sidecar
+    # is ``path + suffix`` (e.g. ``-wal``), copied next to the primary backup so
+    # a later analysis can replay the write-ahead log.
+    for sidecar in _sidecar_paths(path):
+        if os.path.exists(sidecar):
+            suffix = sidecar[len(path):]
+            try:
+                shutil.copy2(sidecar, dest + suffix)
+            except OSError:
+                pass
+    _prune_forensic_backups(path)
+    return dest
+
+
+def _prune_forensic_backups(path: str) -> None:
+    """Keep only the newest ``_MAX_FORENSIC_BACKUPS`` forensic copies."""
+    directory = os.path.dirname(path) or "."
+    prefix = os.path.basename(path) + ".corrupt-"
+    try:
+        entries = [
+            os.path.join(directory, name)
+            for name in os.listdir(directory)
+            if name.startswith(prefix)
+        ]
+    except OSError:
+        return
+    # Only prune the primary DB copies (no sidecar suffix like ``-wal``).
+    copies = [p for p in entries if not (p
```

**File**: `src/praisonai-agents/tests/unit/storage/test_sqlite_connector.py` (modified, +157/-0)
```diff
@@ -173,3 +173,160 @@ def test_lazy_export_from_storage_package():
     from praisonaiagents.storage import sqlite_connect
 
     assert sqlite_connect is connect
+
+
+# ── corruption detection / repair / backup (Issue #5387) ──────────────
+
+
+def _corrupt_file(path: str) -> None:
+    """Overwrite a database's header/pages with garbage so it is malformed."""
+    with open(path, "r+b") as fh:
+        fh.write(b"this is not a valid sqlite header" + b"\x00" * 200)
+
+
+def _make_db(path: str, rows: int = 5) -> None:
+    import sqlite3
+
+    conn = sqlite3.connect(path)
+    conn.execute("CREATE TABLE t (x INTEGER)")
+    conn.executemany("INSERT INTO t VALUES (?)", [(i,) for i in range(rows)])
+    conn.commit()
+    conn.close()
+
+
+def test_quick_check_reports_ok_for_healthy_db(tmp_path):
+    from praisonaiagents.storage.sqlite import quick_check
+    import sqlite3
+
+    db = str(tmp_path / "ok.db")
+    _make_db(db)
+    conn = sqlite3.connect(db)
+    try:
+        assert quick_check(conn) is True
+    finally:
+        conn.close()
+
+
+def test_quick_check_false_on_malformed_db(tmp_path):
+    from praisonaiagents.storage.sqlite import quick_check
+    import sqlite3
+
+    db = str(tmp_path / "bad.db")
+    _make_db(db)
+    _corrupt_file(db)
+    conn = sqlite3.connect(db)
+    try:
+        assert quick_check(conn) is False
+    finally:
+        conn.close()
+
+
+def test_guard_noop_for_healthy_db(tmp_path):
+    """A healthy database is not backed up or altered when guarded."""
+    db = str(tmp_path / "healthy.db")
+    _make_db(db, rows=3)
+    conn = connect(db, guard=True)
+    try:
+        assert conn.execute("SELECT COUNT(*) FROM t").fetchone()[0] == 3
+    finally:
+        conn.close()
+    # No forensic copy created for a healthy file.
+    assert not any(p.name.startswith("healthy.db.corrupt-") for p in tmp_path.iterdir())
+
+
+def test_guard_backs_up_malformed_db(tmp_path):
+    """A malformed file is forensically backed up before repair."""
+    db = str(tmp_path / "state.db")
+    _make_db(db)
+    _corrupt_file(db)
+    conn = connect(db, guard=True, repair=False)
+    conn.close()
+    backups = [p for p in tmp_path.iterdir() if p.name.startswith("state.db.corrupt-")]
+    assert backups, "expected a forensic backup of the malformed file"
+
+
+def test_guard_never_raises_on_malformed_open(tmp_path):
+    """A malformed file must not surface an uncaught DatabaseError on open.
+
+    This is the core of Issue #5387: today a malformed file crashes the durable
+    path. With the guard, ``connect`` returns a usable connection object (the
+    malformed original is backed up first), never propagating the error.
+    """
+    db = str(tmp_path / "state.db")
+    _make_db(db)
+    _corrupt_file(db)
+    conn = connect(db, guard=True)  # must not raise
+    try:
+        assert conn is not None
+    finally:
+        conn.close()
+    backups = [p for p in tmp_path.iterdir() if p.name.startswith("state.db.corrupt-")]
+    assert backups, "malformed file should have been forensically backed up"
+
+
+def test_repair_promotes_only_verified_snapshot(tmp_path):
+    """A repair that cannot rebuild an intact file never touches the original.
+
+    An unreadable ("file is not a database") original cannot be recovered by the
+    online-backup API, so the canonical file must be left exactly as-is (only the
+    forensic copy is added) rather than replaced by a half-written snapshot.
+    """
+    from praisonaiagents.storage.sqlite import _repair_via_online_backup
+
+    db = str(tmp_path / "state.db")
+    _make_db(db)
+    _corrupt_file(db)
+    with open(db, "rb") as fh:
+        before = fh.read()
+    assert _repair_via_online_backup(db) is False
+    with open(db, "rb") as fh:
+        after = fh.read()
+    assert before == after  # canonical bytes untouched by a failed repair
+    assert not os.path.exists(db + ".repair-tmp")  # snapshot cleaned up
+
+
+def test_repair_budget_is_bounded(tmp_path):
+ 
```

---

### Incident Patch 10: `32b84717` (2026-09-30)
**Commit Message**: fix: harden session-address grammar (file-like keys + surplus segments)

Address Greptile review on PR #5384:
- P1: anchor hex-tail regex to end-of-string so file-like keys with an
  embedded hex run (e.g. report-deadbeef.js) round-trip via the literal
  escape hatch instead of silently collapsing to the short id.
- P3: parse_session_path now rejects paths with more than 3 segments;
  the builder always escapes namespace/agent into single segments, so a
  longer path is malformed and must not resolve to the wrong agent.
- Add regression tests for both cases.

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-authored-by: Mervin Praison <MervinPraison@users.noreply.github.com>

**File**: `src/praisonai-agents/praisonaiagents/gateway/addressing.py` (modified, +21/-10)
```diff
@@ -48,8 +48,11 @@
 # A resolver treats these as a friendly sentinel, not a short-id lookup.
 RESERVED_NAMES = frozenset({"main", "global", "default", "root"})
 
-# Trailing run of hex digits in a key — the opaque UUID tail we shorten from.
-_HEX_TAIL_RE = re.compile(r"([0-9a-fA-F]{%d,})[^0-9a-fA-F]*$" % SHORT_ID_LEN)
+# Trailing run of hex digits that terminates the key — the opaque UUID tail we
+# shorten from. Anchored at end-of-string so a *hex run followed by non-hex*
+# (e.g. ``report-deadbeef.js``) is NOT shortened and instead round-trips via the
+# literal-key escape hatch; only a genuine hex terminus (a UUID tail) is lossy.
+_HEX_TAIL_RE = re.compile(r"([0-9a-fA-F]{%d,})$" % SHORT_ID_LEN)
 
 # A ``slug-shortId`` final segment: optional slug, then a hex short id.
 _SLUG_SHORT_RE = re.compile(r"^(?:(?P<slug>.+)-)?(?P<short>[0-9a-fA-F]{%d})$" % SHORT_ID_LEN)
@@ -83,12 +86,15 @@ class SessionRef:
 
 
 def derive_short_id(session_key: str) -> Optional[str]:
-    """Derive a stable short id from the trailing hex of ``session_key``.
-
-    Returns the last :data:`SHORT_ID_LEN` hex chars of the key's trailing hex
-    run (e.g. the UUID tail), lower-cased. Returns ``None`` when the key has no
-    hex tail long enough to shorten — the caller then falls back to the literal
-    key or reserved-name form.
+    """Derive a stable short id from the terminating hex run of ``session_key``.
+
+    Returns the last :data:`SHORT_ID_LEN` hex chars of the key's *terminating*
+    hex run (e.g. a UUID tail), lower-cased. The run must end the key: a key
+    whose hex is followed by non-hex characters (e.g. ``report-deadbeef.js``)
+    is deliberately not shortened, so it round-trips via the literal-key escape
+    hatch instead of silently losing its suffix. Returns ``None`` when the key
+    has no terminating hex run long enough to shorten — the caller then falls
+    back to the literal key or reserved-name form.
     """
     if not session_key:
         return None
@@ -169,8 +175,13 @@ def parse_session_path(path: str) -> Optional[SessionRef]:
     if not path:
         return None
     parts = [p for p in path.strip().strip("/").split("/") if p]
-    if len(parts) >= 3:
-        # Drop a leading namespace segment; agent + final ref remain.
+    # ``build_session_path`` percent-escapes the namespace and agent into single
+    # segments, so a canonical address is exactly ``<ns>/<agent>/<ref>`` (3) or
+    # ``<agent>/<ref>`` (2). Reject anything longer so a malformed link like
+    # ``chat/x/y/z`` never silently acquires a different meaning by using only
+    # its last two segments.
+    if len(parts) == 3:
+        # Drop the leading namespace segment; agent + final ref remain.
         agent_id = unquote(parts[-2])
         final = parts[-1]
     elif len(parts) == 2:
```

**File**: `src/praisonai-agents/tests/unit/test_gateway_addressing.py` (modified, +24/-0)
```diff
@@ -29,6 +29,22 @@ def test_derive_short_id_none_without_hex_tail():
     assert derive_short_id("main") is None
 
 
+def test_derive_short_id_none_when_hex_not_at_end():
+    # A hex run followed by non-hex chars (a file-like key) must NOT be
+    # shortened, so it can round-trip losslessly via the literal escape hatch.
+    assert derive_short_id("report-deadbeef.js") is None
+    assert derive_short_id("deadbeef.txt") is None
+
+
+def test_file_like_key_with_hex_run_roundtrips():
+    # Regression: ``report-deadbeef.js`` must not collapse to ``deadbeef``.
+    key = "report-deadbeef.js"
+    path = build_session_path("bot", key)
+    assert path == "chat/bot/!report-deadbeef.js"
+    ref = parse_session_path(path)
+    assert ref == SessionRef(agent_id="bot", literal_key=key)
+
+
 def test_slugify():
     assert slugify("Quarterly Report") == "quarterly-report"
     assert slugify("  Hello,  World!! ") == "hello-world"
@@ -127,6 +143,14 @@ def test_parse_invalid():
     assert parse_session_path("/") is None
 
 
+def test_parse_rejects_surplus_segments():
+    # A canonical address is at most ``<ns>/<agent>/<ref>``; a longer path is
+    # malformed and must be rejected rather than silently using its last two
+    # segments (which would resolve to the wrong agent).
+    assert parse_session_path("chat/other/assistant/deadbeef") is None
+    assert parse_session_path("a/b/c/d/e") is None
+
+
 def test_agent_id_with_special_chars_roundtrips():
     path = build_session_path("team/assistant", "x-11112222")
     ref = parse_session_path(path)
```

#### Recent Merged Pull Requests:
- **PR #5398** (2026-09-30): feat(persistence): tag Valkey connections with CLIENT SETINFO LIB-NAME (@Jonathan-Improving)
- **PR #5391** (2026-09-30): fix(ci): skip PraisonAI PR review without OpenAI key (@MervinPraison)
- **PR #5390** (2026-09-30): fix: park scheduled jobs past provider rate-limit window (@praisonai-triage-agent[bot])
- **PR #5389** (2026-09-30): fix: detect, back up, and repair malformed SQLite stores on open (@praisonai-triage-agent[bot])
- **PR #5388** (2026-09-30): fix: record missed recurring occurrences with a misfire grace window (@praisonai-triage-agent[bot])
- **PR #5384** (2026-09-30): fix: canonical session-address grammar + session.resolve method (@praisonai-triage-agent[bot])
- **PR #5382** (2026-09-30): fix: size in-run compaction trigger to model window not flat 8000 (@praisonai-triage-agent[bot])
- **PR #5380** (2026-09-30): fix: guardrails fail closed + export_session async-store dispatch (@praisonai-triage-agent[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
