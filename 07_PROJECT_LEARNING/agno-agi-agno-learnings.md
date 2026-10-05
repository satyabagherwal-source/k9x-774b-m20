# Forensic Learning Record (Deep Inspection): agno-agi/agno

> **Canonical Artifact**: `07_PROJECT_LEARNING/agno-agi-agno-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agno-agi/agno](https://github.com/agno-agi/agno))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:03:58.175Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agno-agi/agno`
- **Description**: Build, run, and manage agent platforms.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 42565 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cookbook/00_quickstart/agent_with_state_management.py`
```
"""
Agent with State Management - Finance Agent with Watchlist
===========================================================
This example shows how to give your agent persistent state that it can
read and modify. The agent maintains a stock watchlist across conversations.

Different from storage (conversation history) and memory (user preferences),
state is structured data the agent actively manages: counters, lists, flags.

Key concepts:
- session_state: A dict that persists across runs
- Tools can read/write state via run_context.session_state
- State variables can be injected into instructions with {variable_name}

Example prompts to try:
- "Add NVDA and AMD to my watchlist"
- "What's on my watchlist?"
- "Remove AMD from the list"
- "How are my watched stocks doing today?"
"""

from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from agno.models.google import Gemini
from agno.run import RunContext
from agno.tools.yfinance import YFinanceTools

# ---------------------------------------------------------------------------
# Storage Configuration
# ---------------------------------------------------------------------------
agent_db = SqliteDb(
    id="quickstart-state-db",
    db_file="tmp/quickstart/state.db",
)


# ---------------------------------------------------------------------------
# Custom Tools that Modify State
# ---------------------------------------------------------------------------
def add_to_watchlist(run_context: RunContext, ticker: str) -> str:
    """
    Add a stock ticker to the watchlist.

    Args:
        ticker: Stock ticker symbol (e.g., NVDA, AAPL)

    Returns:
        Confirmation message
    """
    ticker = ticker.upper().strip()
    watchlist = run_context.session_state.get("watchlist", [])

    if ticker in watchlist:
        return f"{ticker} is already on your watchlist"

    watchlist.append(ticker)
    run_context.session_state["watchlist"] = watchlist

    return f"Added {ticker} to watchlist. Current watchlist: {', '.join(watchlist)}"


def remove_from_watchlist(run_context: RunContext, ticker: str) -> str:
    """
    Remove a stock ticker from the watchlist.

    Args:
        ticker: Stock ticker symbol to remove

    Returns:
        Confirmation message
    """
    ticker = ticker.upper().strip()
    watchlist = run_context.session_state.get("watchlist", [])

    if ticker not in watchlist:
        return f"{ticker} is not on your watchlist"

    watchlist.remove(ticker)
    run_context.session_state["watchlist"] = watchlist

    if watchlist:
        return f"Removed {ticker}. Remaining watchlist: {', '.join(watchlist)}"
    return f"Removed {ticker}. Watchlist is now empty."


# ---------------------------------------------------------------------------
# Agent Instructions
# ---------------------------------------------------------------------------
instructions = """\
You are a Finance Agent that manages a stock watchlist.

## Current Watchlist
{watchlist}

## Capabilities

1. Manage watchlist
   - Add stocks: use add_to_watchlist tool
   - Remove stocks: use remove_from_watchlist tool

2. Get stock data
   - Use YFinance tools to fetch prices and metrics for watched stocks
   - Compare stocks on the watchlist

## Rules

- Always confirm watchlist changes
- When asked about "my stocks" or "watchlist", refer to the current state
- Fetch fresh data when reporting on watchlist performance\
"""

# ---------------------------------------------------------------------------
# Create the Agent
# ---------------------------------------------------------------------------
agent_with_state_management = Agent(
    name="Agent with State Management",
    model=Gemini(id="gemini-3.6-flash"),
    instructions=instructions,
    tools=[
        add_to_watchlist,
        remove_from_watchlist,
        YFinanceTools(),
    ],
    session_state={"watchlist": []},
    add_session_state_to_context=True,
    db=agent_db,
    add_datetime_to_context=True,
    add_history_to_context=True,
    num_history_runs=5,
    markdown=True,
)

# ---------------------------------------------------------------------------
# Run the Agent
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Reuse this ID to restore the same watchlist after restarting the script.
    session_id = "watchlist-session"

    # Add some stocks
    agent_with_state_management.print_response(
        "Add NVDA, AAPL, and GOOGL to my watchlist",
        session_id=session_id,
        stream=True,
    )

    # Check the watchlist
    agent_with_state_management.print_response(
        "How are my watched stocks doing today?",
        session_id=session_id,
        stream=True,
    )

    # View the state directly
    print("\n" + "=" * 60)
    print("Session State:")
    print(
        "  Watchlist: "
        f"{agent_with_state_management.get_session_state(session_id=session_id).get('watchlist', [])}"
    )
    print("=" * 60)

# ---------------------------------------------------------------------------
# More Examples
# ---------------------------------------------------------------------------
"""
State vs Storage vs Memory:

- State: Structured data the agent manages (watchlist, counters, flags)
- Storage: Conversation history ("what did we discuss?")
- Memory: User preferences ("what do I like?")

State is perfect for:
- Tracking items (watchlists, todos, carts)
- Counters and progress
- Multi-step workflows
- Any structured data that changes during conversation

Accessing state:

1. In tools: run_context.session_state["key"]
2. In instructions: {key} (with add_session_state_to_context=True)
3. After run: agent.get_session_state() or response.session_state
"""

```

### Core Architecture Module: `cookbook/00_quickstart/human_in_the_loop.py`
```
"""
Human in the Loop - Approve Before the Agent Acts
==================================================
This example pauses an agent before it executes a tool that has an external
effect. The user can inspect the exact tool call, approve it, or reject it.

The demo uses a simulated publishing tool, so it does not contact an external
service. The confirmation pattern is the same for email, payments, database
writes, deployments, or any other sensitive action.

Key concepts:
- @tool(requires_confirmation=True): Mark an action that needs approval
- active_requirements: Inspect what the run is waiting for
- confirm() / reject(): Record the user's decision
- continue_run(): Resume the same run after the decision

Example prompts to try:
- "Research NVDA and publish a three-bullet brief"
- "Draft an AMD comparison, but ask before publishing it"
- "Prepare a Tesla brief and do not publish it"
"""

from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from agno.models.google import Gemini
from agno.tools import tool
from agno.tools.yfinance import YFinanceTools
from agno.utils import pprint
from rich.console import Console
from rich.prompt import Prompt

# ---------------------------------------------------------------------------
# Storage Configuration
# ---------------------------------------------------------------------------
hitl_db = SqliteDb(
    id="quickstart-human-in-the-loop-db",
    db_file="tmp/quickstart/human_in_the_loop.db",
)


# ---------------------------------------------------------------------------
# Sensitive Tool
# ---------------------------------------------------------------------------
@tool(requires_confirmation=True)
def publish_research_brief(title: str, summary: str) -> str:
    """
    Publish a research brief.

    This quickstart simulates publishing and does not call an external service.

    Args:
        title: Public title for the brief
        summary: Final brief to publish

    Returns:
        Confirmation that the simulated publish completed
    """
    return f"Published '{title}' ({len(summary)} characters)"


# ---------------------------------------------------------------------------
# Agent Instructions
# ---------------------------------------------------------------------------
instructions = """\
You are a market research partner.

1. Use Yahoo Finance to gather current facts.
2. Produce a concise, evidence-based brief.
3. Only call publish_research_brief when the user explicitly asks to publish.
4. Never claim publication succeeded until the tool has executed.
5. Treat the publishing tool as a simulated external action in this demo.\
"""

# ---------------------------------------------------------------------------
# Create the Agent
# ---------------------------------------------------------------------------
human_in_the_loop_agent = Agent(
    name="Agent with Human in the Loop",
    model=Gemini(id="gemini-3.6-flash"),
    instructions=instructions,
    tools=[
        YFinanceTools(
            enable_company_info=True,
            enable_stock_fundamentals=True,
            enable_company_news=True,
        ),
        publish_research_brief,
    ],
    db=hitl_db,
    add_datetime_to_context=True,
    markdown=True,
)

# ---------------------------------------------------------------------------
# Run the Agent
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    console = Console()
    session_id = "human-in-the-loop-session"
    run_response = human_in_the_loop_agent.run(
        "Research NVIDIA's current position and publish a three-bullet brief "
        "titled 'NVDA snapshot'.",
        session_id=session_id,
    )

    if run_response.content:
        pprint.pprint_run_response(run_response)

    pending_requirements = list(run_response.active_requirements or [])
    if not pending_requirements:
        raise RuntimeError("Expected the run to pause for publication approval")

    for requirement in pending_requirements:
        if not requirement.needs_confirmation:
            continue

        console.print(
            "\n[bold yellow]Confirmation Required[/bold yellow]\n"
            f"Tool: [bold blue]{requirement.tool_execution.tool_name}[/bold blue]\n"
            f"Args: {requirement.tool_execution.tool_args}"
        )
        choice = Prompt.ask(
            "Continue?",
            choices=["y", "n"],
            default="y",
        )

        if choice == "y":
            requirement.confirm()
            console.print("[green]Approved[/green]")
        else:
            requirement.reject()
            console.print("[red]Rejected[/red]")

    final_response = human_in_the_loop_agent.continue_run(
        run_id=run_response.run_id,
        session_id=session_id,
        requirements=run_response.requirements,
    )
    pprint.pprint_run_response(final_response)

# ---------------------------------------------------------------------------
# More Examples
# ---------------------------------------------------------------------------
"""
Apply this pattern to any tool whose effect deserves review:

1. Mark the tool with @tool(requires_confirmation=True)
2. Start the run with agent.run()
3. Show each pending requirement and its arguments
4. Call requirement.confirm() or requirement.reject()
5. Resume with agent.continue_run()

Typical approval gates:
- Send an email or publish content
- Write to a production database
- Create a purchase or financial transaction
- Deploy code or change infrastructure
- Delete or overwrite user data
"""

```

### Core Architecture Module: `cookbook/02_agents/03_context_management/instructions_with_state.py`
```
"""
Instructions With State
=============================

Example demonstrating how to use a function as instructions for an agent.
"""

from textwrap import dedent

from agno.agent import Agent
from agno.models.openai import OpenAIResponses
from agno.run import RunContext


# This will be our instructions function
def get_run_instructions(run_context: RunContext) -> str:
    """Build instructions for the Agent based on the run context."""
    if not run_context.session_state:
        return "You are a helpful game development assistant that can answer questions about coding and game design."

    game_genre = run_context.session_state.get("game_genre", "")
    difficulty_level = run_context.session_state.get("difficulty_level", "")

    return dedent(
        f"""
        You are a specialized game development assistant.
        The team is currently working on a {game_genre} game.
        The current project difficulty level is set to {difficulty_level}.
        Please tailor your responses to match this genre and complexity level when providing
        coding advice, design suggestions, or technical guidance."""
    )


# ---------------------------------------------------------------------------
# Create Agent
# ---------------------------------------------------------------------------
game_development_agent = Agent(
    model=OpenAIResponses(id="gpt-5.2"),
    instructions=get_run_instructions,
)

# ---------------------------------------------------------------------------
# Run Agent
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    game_development_agent.print_response(
        "What genre are we working on and what should I focus on for the core mechanics?",
        session_state={"game_genre": "platformer", "difficulty_level": "hard"},
    )

```

### Core Architecture Module: `cookbook/02_agents/04_tools/02_session_state_tools.py`
```
"""
Session State Tools
===================
Use `session_state` as a parameter name in your factory to receive
the session state dict directly (no need for run_context).

Set `cache_callables=False` so the factory runs fresh every time,
picking up any session_state changes between runs.
"""

from agno.agent import Agent
from agno.models.openai import OpenAIResponses

# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------


def get_greeting(name: str) -> str:
    """Greet someone by name."""
    return f"Hello, {name}!"


def get_farewell(name: str) -> str:
    """Say goodbye to someone."""
    return f"Goodbye, {name}!"


def get_tools(session_state: dict):
    """Pick tools based on the 'mode' key in session_state."""
    mode = session_state.get("mode", "greet")
    print(f"--> Factory resolved mode: {mode}")

    if mode == "greet":
        return [get_greeting]
    else:
        return [get_farewell]


# ---------------------------------------------------------------------------
# Create the Agent
# ---------------------------------------------------------------------------

agent = Agent(
    model=OpenAIResponses(id="gpt-5-mini"),
    tools=get_tools,
    cache_callables=False,
    instructions=["Use the available tool to respond."],
)


# ---------------------------------------------------------------------------
# Run the Agent
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=== Greet mode ===")
    agent.print_response(
        "Say hi to Alice",
        session_state={"mode": "greet"},
        stream=True,
    )

    print("\n=== Farewell mode ===")
    agent.print_response(
        "Say bye to Alice",
        session_state={"mode": "farewell"},
        stream=True,
    )

```

### Core Architecture Module: `cookbook/02_agents/05_state_and_session/agentic_session_state.py`
```
"""
Agentic Session State
=============================

Agentic Session State.
"""

from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from agno.models.openai import OpenAIResponses

db = SqliteDb(db_file="tmp/agents.db")
# ---------------------------------------------------------------------------
# Create Agent
# ---------------------------------------------------------------------------
agent = Agent(
    model=OpenAIResponses(id="gpt-5-mini"),
    db=db,
    session_state={"shopping_list": []},
    add_session_state_to_context=True,  # Required so the agent is aware of the session state
    enable_agentic_state=True,
)

# ---------------------------------------------------------------------------
# Run Agent
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    agent.print_response("Add milk, eggs, and bread to the shopping list")

    agent.print_response("I picked up the eggs, now what's on my list?")

    print(f"Session state: {agent.get_session_state()}")

```

### Core Architecture Module: `cookbook/02_agents/05_state_and_session/chat_history.py`
```
"""
Chat History
=============================

Chat History.
"""

from agno.agent.agent import Agent
from agno.db.postgres import PostgresDb
from agno.models.openai import OpenAIResponses

db_url = "postgresql+psycopg://ai:ai@localhost:5532/ai"

db = PostgresDb(db_url=db_url, session_table="sessions")

# ---------------------------------------------------------------------------
# Create Agent
# ---------------------------------------------------------------------------
agent = Agent(
    model=OpenAIResponses(id="gpt-5-mini"),
    db=db,
    session_id="chat_history",
    instructions="You are a helpful assistant that can answer questions about space and oceans.",
    add_history_to_context=True,
)

# ---------------------------------------------------------------------------
# Run Agent
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    agent.print_response("Tell me a new interesting fact about space")
    print(agent.get_chat_history())

    agent.print_response("Tell me a new interesting fact about oceans")
    print(agent.get_chat_history())

```

### Core Architecture Module: `cookbook/02_agents/05_state_and_session/dynamic_session_state.py`
```
"""
Dynamic Session State
=============================

Dynamic Session State.
"""

import json
from typing import Any, Dict

from agno.agent import Agent
from agno.db.in_memory import InMemoryDb
from agno.models.openai import OpenAIResponses
from agno.run import RunContext
from agno.tools.toolkit import Toolkit
from agno.utils.log import log_info, log_warning


class CustomerDBTools(Toolkit):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.register(self.process_customer_request)

    def process_customer_request(
        self,
        agent: Agent,
        customer_id: str,
        action: str = "retrieve",
        name: str = "John Doe",
    ):
        log_warning("Tool called, this shouldn't happen.")
        return "This should not be seen."


def customer_management_hook(run_context: RunContext, arguments: Dict[str, Any]):
    if run_context.session_state is None:
        run_context.session_state = {}

    action = arguments.get("action", "retrieve")
    cust_id = arguments.get("customer_id")
    name = arguments.get("name", None)

    if not cust_id:
        raise ValueError("customer_id is required.")

    if action == "create":
        run_context.session_state["customer_profiles"][cust_id] = {"name": name}
        log_info(f"Hook: UPDATED session_state for customer '{cust_id}'.")
        return f"Success! Customer {cust_id} has been created."

    if action == "retrieve":
        profile = run_context.session_state.get("customer_profiles", {}).get(cust_id)
        if profile:
            log_info(f"Hook: FOUND customer '{cust_id}' in session_state.")
            return f"Profile for {cust_id}: {json.dumps(profile)}"
        else:
            raise ValueError(f"Customer '{cust_id}' not found.")

    log_info(f"Session state: {run_context.session_state}")


# ---------------------------------------------------------------------------
# Create Agent
# ---------------------------------------------------------------------------
def run_test():
    # ---------------------------------------------------------------------------
    # Create Agent
    # ---------------------------------------------------------------------------

    agent = Agent(
        model=OpenAIResponses(id="gpt-5.2"),
        tools=[CustomerDBTools()],
        tool_hooks=[customer_management_hook],
        session_state={"customer_profiles": {"123": {"name": "Jane Doe"}}},
        instructions="Your profiles: {customer_profiles}. Use `process_customer_request`. Use either create or retrieve as action for the tool.",
        resolve_in_context=True,
        db=InMemoryDb(),
    )

    prompt = "First, create customer 789 named 'Tom'. Then, retrieve Tom's profile. Step by step."
    log_info(f" Prompting: '{prompt}'")
    agent.print_response(prompt, stream=False)

    log_info("\n--- TEST ANALYSIS ---")
    log_info(
        "Check logs for the second tool call. The system prompt will NOT contain customer '789'."
    )


# ---------------------------------------------------------------------------
# Run Agent
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    run_test()

```

### Core Architecture Module: `cookbook/02_agents/05_state_and_session/last_n_session_messages.py`
```
"""
Last N Session Messages
=============================

Last N Session Messages.
"""

import asyncio
import os

from agno.agent import Agent
from agno.db.sqlite import AsyncSqliteDb
from agno.models.openai import OpenAIResponses

# ---------------------------------------------------------------------------
# Create Agent
# ---------------------------------------------------------------------------
# Remove the tmp db file before running the script
if os.path.exists("tmp/data.db"):
    os.remove("tmp/data.db")

# Create agents for different users to demonstrate user-specific session history
agent = Agent(
    model=OpenAIResponses(id="gpt-5-mini"),
    db=AsyncSqliteDb(db_file="tmp/data.db"),
    search_past_sessions=True,  # allow searching previous sessions
    num_past_sessions_to_search=2,  # only include the last 2 sessions in the search to avoid context length issues
)


async def main():
    # User 1 sessions
    print("=== User 1 Sessions ===")
    await agent.aprint_response(
        "What is the capital of South Africa?",
        session_id="user1_session_1",
        user_id="user_1",
    )
    await agent.aprint_response(
        "What is the capital of China?", session_id="user1_session_2", user_id="user_1"
    )
    await agent.aprint_response(
        "What is the capital of France?", session_id="user1_session_3", user_id="user_1"
    )

    # User 2 sessions
    print("\n=== User 2 Sessions ===")
    await agent.aprint_response(
        "What is the population of India?",
        session_id="user2_session_1",
        user_id="user_2",
    )
    await agent.aprint_response(
        "What is the currency of Japan?", session_id="user2_session_2", user_id="user_2"
    )

    # Now test session history search - each user should only see their own sessions
    print("\n=== Testing Session History Search ===")
    print(
        "User 1 asking about previous conversations (should only see capitals, not population/currency):"
    )
    await agent.aprint_response(
        "What did I discuss in my previous conversations?",
        session_id="user1_session_4",
        user_id="user_1",
    )

    print(
        "\nUser 2 asking about previous conversations (should only see population/currency, not capitals):"
    )
    await agent.aprint_response(
        "What did I discuss in my previous conversations?",
        session_id="user2_session_3",
        user_id="user_2",
    )


# ---------------------------------------------------------------------------
# Run Agent
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `cookbook/02_agents/05_state_and_session/metadata_resolution.py`
```
"""
Metadata Resolution
=============================

Demonstrates the three-layer metadata resolution for Agents:
  agent.metadata < session.metadata < call-site metadata

Session-stored metadata overrides agent defaults, and call-site
metadata overrides both. This works for both sync and async runs.
"""

import asyncio
import time

from agno.agent import Agent
from agno.db.in_memory import InMemoryDb
from agno.models.openai import OpenAIResponses
from agno.session.agent import AgentSession

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
db = InMemoryDb()

# Pre-seed a session with metadata (simulates a returning user)
session = AgentSession(
    session_id="demo-session",
    agent_id="metadata-demo-agent",
    metadata={
        "user_tier": "premium",  # Will override agent's "free"
        "session_pref": "dark_mode",  # Session-only key
    },
    created_at=int(time.time()),
)
db.upsert_session(session)

# ---------------------------------------------------------------------------
# Create Agent
# ---------------------------------------------------------------------------
agent = Agent(
    id="metadata-demo-agent",
    model=OpenAIResponses(id="gpt-5-mini"),
    db=db,
    metadata={
        "user_tier": "free",  # Will be overridden by session
        "agent_env": "production",  # Agent-only key
    },
)


# ---------------------------------------------------------------------------
# Run Agent
# ---------------------------------------------------------------------------
async def run_async_demo() -> None:
    print("\n=== Async run with all three layers ===")
    result = await agent.arun(
        input="Say 'async test'",
        session_id="demo-session",
        metadata={"user_tier": "vip"},
    )
    print(f"Metadata: {result.metadata}")
    print(f"  user_tier = '{result.metadata['user_tier']}' (call-site wins)")
    print(f"  session_pref = '{result.metadata['session_pref']}' (from session)")
    print(f"  agent_env = '{result.metadata['agent_env']}' (from agent)")


if __name__ == "__main__":
    # Session metadata overrides agent metadata
    print("=== Session overrides agent (sync) ===")
    result1 = agent.run(input="Say 'test1'", session_id="demo-session")
    print(f"Metadata: {result1.metadata}")
    print(f"  user_tier = '{result1.metadata['user_tier']}' (session wins over agent)")

    # Call-site metadata overrides both
    print("\n=== Call-site overrides all (sync) ===")
    result2 = agent.run(
        input="Say 'test2'",
        session_id="demo-session",
        metadata={"user_tier": "enterprise", "request_id": "req-123"},
    )
    print(f"Metadata: {result2.metadata}")
    print(f"  user_tier = '{result2.metadata['user_tier']}' (call-site wins)")

    # Async run
    asyncio.run(run_async_demo())

    # New session uses agent defaults
    print("\n=== New session uses agent defaults ===")
    result4 = agent.run(input="Say 'test4'", session_id="new-session")
    print(f"Metadata: {result4.metadata}")
    print(f"  user_tier = '{result4.metadata['user_tier']}' (agent default)")

    print("\n" + "=" * 50)
    print("Resolution order: agent < session < call-site")
    print("=" * 50)

```

### Core Architecture Module: `cookbook/02_agents/05_state_and_session/persistent_session.py`
```
"""
Persistent Session
=============================

Persistent Session Example.
"""

from agno.agent.agent import Agent
from agno.db.postgres import PostgresDb
from agno.models.openai import OpenAIResponses

db_url = "postgresql+psycopg://ai:ai@localhost:5532/ai"

db = PostgresDb(db_url=db_url, session_table="sessions")

# ---------------------------------------------------------------------------
# Create Agent
# ---------------------------------------------------------------------------
agent = Agent(
    model=OpenAIResponses(id="gpt-5-mini"),
    db=db,
    session_id="session_storage",
    add_history_to_context=True,
)

# ---------------------------------------------------------------------------
# Run Agent
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    agent.print_response("Tell me a new interesting fact about space")

```

### Core Architecture Module: `cookbook/02_agents/05_state_and_session/search_past_sessions.py`
```
"""
Search Past Sessions
====================

Demonstrates the two-step list-then-read pattern for accessing previous sessions.

The agent gets two tools:
  - search_past_sessions() -- lightweight per-run previews of recent sessions
  - read_past_session(session_id) -- full conversation for a specific session

Enable with `search_past_sessions=True`. Optionally set
`num_past_sessions_to_search` to control how many past sessions are searched (default 20)
and `num_past_session_runs_in_search` to control how many runs per session appear in
the preview (default 3).
"""

import asyncio
import os

from agno.agent.agent import Agent
from agno.db.sqlite import AsyncSqliteDb
from agno.models.openai import OpenAIResponses

# ---------------------------------------------------------------------------
# Setup -- fresh DB each run
# ---------------------------------------------------------------------------
DB_FILE = "tmp/agent_session_history.db"
if os.path.exists(DB_FILE):
    os.remove(DB_FILE)

db = AsyncSqliteDb(db_file=DB_FILE)

# ---------------------------------------------------------------------------
# Create Agent
# ---------------------------------------------------------------------------
agent = Agent(
    model=OpenAIResponses(id="gpt-5.6-luna"),
    db=db,
    search_past_sessions=True,
    num_past_sessions_to_search=10,
)


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
async def main() -> None:
    # --- Seed a few sessions with different topics ---
    print("=== Session 1: Space ===")
    await agent.aprint_response(
        "Tell me about black holes",
        session_id="session_space",
        user_id="alice",
    )

    print("\n=== Session 2: Cooking ===")
    await agent.aprint_response(
        "How do I make pasta carbonara?",
        session_id="session_cooking",
        user_id="alice",
    )

    print("\n=== Session 3: Music ===")
    await agent.aprint_response(
        "Who composed the Four Seasons?",
        session_id="session_music",
        user_id="alice",
    )

    # --- Now ask the agent to search and recall ---
    print("\n=== Search: browse all past sessions ===")
    await agent.aprint_response(
        "What topics did we discuss in my previous sessions?",
        session_id="session_recall",
        user_id="alice",
    )

    print("\n=== Search: find cooking session ===")
    await agent.aprint_response(
        "Find my past session where we talked about cooking",
        session_id="session_search",
        user_id="alice",
    )

    # --- Demonstrate user scoping ---
    print("\n=== Different user sees no history ===")
    await agent.aprint_response(
        "What did we discuss before?",
        session_id="bob_session_1",
        user_id="bob",
    )


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `cookbook/02_agents/05_state_and_session/session_options.py`
```
"""
Session Options
=============================

Simple example demonstrating store_history_messages option.
"""

from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from agno.models.openai import OpenAIResponses
from agno.utils.pprint import pprint_run_response

# ---------------------------------------------------------------------------
# Create Agent
# ---------------------------------------------------------------------------
agent = Agent(
    model=OpenAIResponses(id="gpt-5-mini"),
    db=SqliteDb(db_file="tmp/example_no_history.db"),
    add_history_to_context=True,  # Use history during execution
    num_history_runs=3,
    store_history_messages=False,  # Don't store history messages in database
)


# ---------------------------------------------------------------------------
# Run Agent
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("\n=== First Run: Establishing context ===")
    response1 = agent.run("My name is Alice and I love Python programming.")
    pprint_run_response(response1)

    print("\n=== Second Run: Using history (but not storing it) ===")
    response2 = agent.run("What is my name and what do I love?")
    pprint_run_response(response2)

    # Check what was stored
    stored_run = agent.get_last_run_output()
    if stored_run and stored_run.messages:
        history_messages = [m for m in stored_run.messages if m.from_history]
        print("\n Storage Info:")
        print(f"   Total messages stored: {len(stored_run.messages)}")
        print(f"   History messages: {len(history_messages)} (scrubbed!)")
        print("\n History was used during execution (agent knew the answer)")
        print("   but history messages are NOT stored in the database!")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10399** (2026-09-22): **[Bug] JSONReader splits string roots and rejects other scalar roots**
  *Symptoms*: ### Description  `JSONReader` iterates the decoded root directly unless it is an object. Valid JSON scalar roots are therefore split into characters, discarded, or rejected.  ### Steps to Reproduce  ```python from io import BytesIO from agno.knowledge.reader.json_reader import JSONReader  reader = JSONReader(chunk=False) for text in ['"hello"', '""', '42', 'true', 'null']:     try:         documents = reader.read(BytesIO(text.encode("utf-8")))         print(text, [document.content for document in documents])     except Exception as error:         print(text, type(error).__name__, str(error)) ```  ### Agent Configuration (if applicable)  _No response_  ### Expected Behavior  Each non-array root produces one document containing the serialized JSON value. Arrays continue to produce one document per item; an empty array produces no documents.  ### Actual Behavior  `"hello"` produces five character documents, `""` produces no documents, and `42`, `true`, and `null` raise `TypeError`. `async_read` has the same behavior.  ### Screenshots or Logs (if applicable)  _No response_  ### Environment  ```markdown macOS; Python 3.12.13; Agno main af6e1ff734bd255b7f6b71f095c2a0fa52067094. Reproduced with both file paths and BytesIO. ```  ### Possible Solutions (optional)  Normalize every decoded non-list root to a one-item list before creating documents.  ### Additional Context  PR #9974 addresses encoding detection for JSON uploads. This issue concerns root-value handling after decoding and 

- **Issue #10398** (2026-09-22): **[Bug] TavilyReader does not forward extract_depth and extract_format**
  *Symptoms*: ### Description  `TavilyReader` sends `depth` instead of the SDK's `extract_depth` parameter and omits `format`. Setting `extract_depth="advanced"` and `extract_format="text"` therefore does not send the requested options to the Extract API.  ### Steps to Reproduce  ```python import json from unittest.mock import Mock, patch from agno.knowledge.chunking.fixed import FixedSizeChunking from agno.knowledge.reader.tavily_reader import TavilyReader  reader = TavilyReader(     api_key="tvly-offline-test",     extract_depth="advanced",     extract_format="text",     chunk=False,     chunking_strategy=FixedSizeChunking(), ) response = Mock(status_code=200) response.json.return_value = {     "results": [{"url": "https://example.com", "raw_content": "content"}] } with patch("requests.Session.post", return_value=response) as post:     reader.read("https://example.com")     print(json.loads(post.call_args.kwargs["data"])) ```  ### Agent Configuration (if applicable)  _No response_  ### Expected Behavior  The payload contains `extract_depth: advanced` and `format: text`.  ### Actual Behavior  The payload contains `depth: advanced`; `extract_depth` and `format` are absent. The same problem occurs with `async_read`.  ### Screenshots or Logs (if applicable)  _No response_  ### Environment  ```markdown macOS; Python 3.12.13; Agno main af6e1ff734bd255b7f6b71f095c2a0fa52067094; tavily-python 0.8.4. Reproduction intercepts the HTTP request and needs no live API key. ```  ### Possible Solutions (

- **Issue #10361** (2026-09-21): **[Bug] FieldLabeledCSVReader accepts non-positive page_size inconsistently**
  *Symptoms*: ### Description  `FieldLabeledCSVReader.async_read()` does not validate `page_size` before reading the input. For more than 10 data rows, a negative page size silently returns no documents and zero is caught as a read error. Files with 10 or fewer rows accept either value because they bypass pagination.  ### Steps to Reproduce  Run this against main at `85b6d1d178b70d59e8f2c0d432d2a66b35004f31`:  ```python import asyncio from io import StringIO  from agno.knowledge.reader.field_labeled_csv_reader import FieldLabeledCSVReader  async def main():     reader = FieldLabeledCSVReader()     for row_count in (1, 11):         content = "name\n" + "".join(f"person_{i}\n" for i in range(row_count))         for page_size in (0, -1):             documents = await reader.async_read(StringIO(content), page_size=page_size)             print(row_count, page_size, len(documents))  asyncio.run(main()) ```  ### Agent Configuration (if applicable)  _No response_  ### Expected Behavior  Zero and negative page sizes consistently raise a clear `ValueError` before consuming the input, regardless of the number of rows. Positive page sizes continue to return every row in order.  ### Actual Behavior  ```text 1 0 1 1 -1 1 11 0 0 11 -1 0 ```  The 11-row case with `page_size=0` also logs `range() arg 3 must not be zero`. With `page_size=-1`, the pagination loop generates no pages and returns an empty list without an error.  ### Screenshots or Logs (if applicable)  _No response_  ### Environment  ```markdow

- **Issue #10277** (2026-09-20): **[Bug] Incorrect native reasoning model detection for `reasoning_model`**
  *Symptoms*: ### Description  Agno incorrectly determines whether the configured `reasoning_model` is a supported native reasoning model. In my case, the configured model is expected to run as the separate reasoning stage, but Agno classifies it incorrectly and skips the reasoning stage / emits an unexpected warning.  ### Steps to Reproduce   ```python from agno.agent import Agent from agno.models.[provider] import [ModelClass] agent = Agent(     model=[ModelClass](id="qwen、deepseek-4...."),     reasoning_model=[ModelClass](         id="qwen、deepseek-4....",         # Include any reasoning-related configuration here     ), ) agent.print_response(     "Solve this step by step.",     stream=True,     show_full_reasoning=True, ) ```  ### Agent Configuration (if applicable)  reasoning_model=DashScope(id='deepseek-v4-pro'), reasoning_agent=Agent(model=DashScope(id='deepseek-v4-pro'),                               description=""                               )  ### Expected Behavior  Agno should recognize [reasoning-model-id] as a supported native reasoning model when it is configured as reasoning_model. The model should run as the separate reasoning stage before the main response model. show_full_reasoning=True should display the reasoning content that is exposed by the provider.  ### Actual Behavior  Agno identifies [reasoning-model-id] as [unsupported / non-native / incorrect model type]. The separate reasoning stage is skipped or does not behave as expected.  ### Screenshots or Logs (if app
  **Post-Mortem & Fix Analysis**:
  > Hi, I'd like to work on this. From the current code, it looks like `DashScope` inherits `OpenAILike`, while `is_openai_reasoning_model()` recognizes `deepseek-r1` but not DeepSeek V4 IDs. The dedicated DeepSeek checker already treats `deepseek-v4-pro` and `deepseek-v4-flash` as native reasoning models.  I can add the corresponding detection plus regression tests for the DashScope/OpenAILike path. Before I start, is that narrow fix preferred, or should this be handled through the broader OpenAILike native-reasoning work related to #8400/#8418? 

- **Issue #10050** (2026-09-16): **[Bug] CodingTools run_shell allows argument injection to escape the restrict_to_base_dir sandbox via skipped flag tokens (CWE-88, CVSS 9.8)**
  *Symptoms*: ### Description  ### Summary  This is a security vulnerability report (not a functional bug).  An argument-injection vulnerability in `CodingTools` lets anyone who can influence the command string passed to `run_shell()` (`libs/agno/agno/tools/coding.py:499`) -- by calling the library directly, or through an agent whose toolset registers `run_shell` -- escape the `restrict_to_base_dir` sandbox and write arbitrary files (and execute arbitrary commands) with the privileges of the agno process. The pre-execution screening `_check_command()` (coding.py:253) unconditionally skips every flag token (`if token.startswith("-"): continue`, coding.py:288-289), so an allowlisted interpreter such as `python` (the first entry in `DEFAULT_ALLOWED_COMMANDS`) combined with the skipped `-c` flag carries an out-of-base write that is never caught by the path-boundary check; after the check passes, `run_shell()` hands the raw command string to the host shell via `subprocess.run(..., shell=True)` (coding.py:522-529). `restrict_to_base_dir=True` is the constructor default (coding.py:125) and its docstring promises "file and shell operations cannot escape base_dir" (coding.py:146). The vulnerable code is unchanged in the latest release v3.0.6.  ### Impact  - **Type:** Argument injection that defeats the `restrict_to_base_dir` path boundary (CWE-88 Argument Injection); the incomplete token validation is improper input validation (CWE-20). The ultimate sink is OS command execution via `shell=True` (co
  **Post-Mortem & Fix Analysis**:
  > Confirmed every code claim here against `main` (not the PoC, which I did not run): `_check_command()` skips every flag token at `libs/agno/agno/tools/coding.py:288-289`, `python` is the first entry in `DEFAULT_ALLOWED_COMMANDS`, `run_shell()` executes via `subprocess.run(command, shell=True, ...)` at :522-529, and `restrict_to_base_dir` defaults to `True` at :125 with the docstring at :146 promising that shell operations "cannot escape base_dir".  Worth triaging this together with the rest of the cluster rather than one at a time, because they share a root cause. There are two open PRs already hardening this exact file, both stalled:  - #8468 (2026-06-18, by @Jiangrong-W) blocks inline-code interpreter execution - #9472 (2026-08-09, by @coderdailyone) blocks command-separator chaining  Both touch `libs/agno/agno/tools/coding.py` and its unit tests. Together with #10048 (chr()-encoding) and this one, that is four independent people finding four different ways through the same screen, ov
  > Fixed by #10210 (merged) and #10220 (merged). I ran your exact PoC against the merged code: `python -c "open(<out-of-base>,'w')..."` is now rejected with "Inline code execution (-c/-m or reading from stdin) is not allowed in restricted mode," and no file is created outside base_dir. The argument injection is closed because inline code-execution flags on interpreters are rejected before execution (independent of the path check), and #10220 additionally runs restricted-mode commands without a shell (shell=False). As documented, restrict_to_base_dir remains harm reduction rather than a sandbox: an allowlisted interpreter running a written script file is still reachable by design, and restrict_to_base_dir=False is for trusted input only. Thanks for the detailed, reproducible report, @ybyu-ieu. Closing as resolved.

- **Issue #10048** (2026-09-16): **[Bug] CodingTools run_shell allows arbitrary command execution via chr()-encoding bypass of the restricted-mode command disallowlist (CWE-78, CVSS 9.8)**
  *Symptoms*: ### Description  ### Summary  This is a security vulnerability report (not a functional bug).  A command-injection vulnerability in `CodingTools` lets anyone who can influence the `command` argument of `run_shell()` -- directly, or remotely through an agent that processes untrusted content (prompt injection) -- execute arbitrary commands on the host with the privileges of the agno process. `run_shell()` (agno/tools/coding.py:499) executes every command string with `subprocess.run(command, shell=True)` (coding.py:522-529) after screening it against an incomplete disallowlist of shell operators. The default restricted mode (`restrict_to_base_dir=True`, coding.py:125) is defeated by `chr()`-encoding the payload: a command such as `python -c "exec(chr(...)+chr(...))"` contains none of the disallowed substrings, `python` is the first entry of the default allowlist (`DEFAULT_ALLOWED_COMMANDS`, coding.py:32-33), `-c` is skipped as a flag token, and the command executes arbitrary Python -- and therefore arbitrary OS commands -- on the host, with no confirmation gate by default. The pre-execution screening (`_check_command()`, coding.py:253) fails in three complementary ways:  ```python # agno/tools/coding.py:250-251 -- the disallowlist: nine shell-operator substrings only     _DANGEROUS_PATTERNS: List[str] = ["&&", "||", ";", "|", "$(", "`", ">", ">>", "<"]  # agno/tools/coding.py:266-269 -- a raw substring match against the original command string         for pattern in self._DANGER
  **Post-Mortem & Fix Analysis**:
  > Fixed by #10210 (merged) and #10220 (merged). I ran your exact chr()-encoded PoC against the merged code: `python -c "exec(chr(...)+...)"` is rejected with "Inline code execution (-c/-m ...) is not allowed in restricted mode," and the marker file is not created. The encoding no longer matters: restricted mode now rejects the `-c`/`-m` flags outright rather than pattern-matching payload content, so obfuscation has nothing to defeat. #10220 also removes shell=True in restricted mode entirely (commands are tokenized and run with shell=False). Thanks for the thorough report, @ybyu-ieu. Closing as resolved.

- **Issue #9971** (2026-09-21): **[Bug] CSVReader returns no documents for text streams**
  *Symptoms*: ### Description  I reproduced a failure when passing `io.StringIO` or an already-open text file to `CSVReader`. Both `read()` and `async_read()` call `.decode()` on the string returned by the stream, log an error, and return an empty list. The same CSV works when supplied as a path or `BytesIO`. File-like objects are documented inputs.  ### Steps to Reproduce  This example needs no API keys or network access:  ```python import asyncio from io import StringIO from agno.knowledge.reader.csv_reader import CSVReader  reader = CSVReader() source = StringIO("name,city\nAlice,Paris") print([doc.content for doc in reader.read(source)]) print([doc.content for doc in asyncio.run(reader.async_read(source))]) ```  Passing a file opened with `open(path, encoding="utf-8")` has the same result.  ### Agent Configuration (if applicable)  _No response_  ### Expected Behavior  Both calls return `['name, city', 'Alice, Paris']`, matching the output from binary streams and paths.  ### Actual Behavior  Both calls return `[]` and log `Error reading ...: 'str' object has no attribute 'decode'`.  ### Screenshots or Logs (if applicable)  _No response_  ### Environment  ```markdown Agno 3.0.6, main at d1a388446e1b44b20498c772e91303588e2734cf Python 3.12.10 Windows ```  ### Possible Solutions (optional)  _No response_  ### Additional Context  I have a focused fix with tests for in-memory and file-backed text streams, Unicode content, and both chunking modes. This report and the patch were prepared with 
  **Post-Mortem & Fix Analysis**:
  > Fixed by #10355. CSVReader.read and async_read now accept text streams such as StringIO and text-mode files. Closing.

- **Issue #9923** (2026-09-03): **[Bug] Assistant-turn replay incorrectly reconstructs provider content causing Anthropic to reject replayed thinking blocks**
  *Symptoms*: ### Description  --------- HUMAN SUMMARY (ME) ---------  Hey all, we noticed that occasionally during a resume our agent would incorrectly reconstruct it's conversation. This causes Anthropic to reject our API requests due to a misaligned signature under a thinking block.  Our short term fix here is filtering these messages out entirely when we detect one with an invalid signature:  ```python # simplified implementation of dropping messages with a bad signature def _drop_stale_thinking(     session: AgentSession | TeamSession, ) -> AgentSession | TeamSession:     for run in session.runs or []:         for message in run.messages or []:             if message.has_stale_thinking:                 clear_message(message)     return session ```  Below is an agent's summary of the issue, I've read through everything and vetted the claims and I (the human here) believe this is an accurate summary of the issue we are encountering. Happy to contribute a PR here if folks think the proposed fix is apt & contributions are welcome.  --------- AGENT SUMMARY ---------  Agno stores an assistant message as a set of convenience fields:  One `content` string, one `reasoning_content` string, one `provider_data["signature"]`, a `tool_calls` list. A provider response is an ordered list of typed content blocks.  On replay, agno rebuilds blocks from the fields. The rebuilt message is a reconstruction of the conversation that actually happened.  When Anthropic started to sign thinking blocks and verif
  **Post-Mortem & Fix Analysis**:
  > Hi there, looking into this
  > @ashpreetbedi Ty! Lmk if you'd like contributions here or want to this discuss more, happy to help.
  > Hi @Syntaf ! Thanks for reporting, the fix will be out with the next release 3.0.6! 

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

### Incident Patch 1: `c44b0820` (2026-10-05)
**Commit Message**: [fix] Read text and Markdown streams with non-string names (#10779)

## Summary

`TextReader` and `MarkdownReader` call `.split()` on an input stream's
`name`. For a stream opened from a file descriptor, `name` is an
integer; a stream can also expose `name=None`. Both readers catch the
resulting exception and return `[]`, dropping otherwise valid content.

Check that the stream name is a string before extracting its prefix, in
both `read()` and `async_read()`. Other names use each reader's existing
fallback (`text_file` or `file`). Explicit document names and
string-name behavior are preserved.

The regression tests use a real descriptor-backed stream, plus binary
and text in-memory streams. They check content, names, rewinding
partially read inputs, and leaving caller-owned streams open.

## Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Improvement
- [ ] Model update
- [ ] Other:

---

## Checklist

- [x] Code complies with style guidelines
- [x] Ran format/validation scripts (`./scripts/format.sh` and
`./scripts/validate.sh`)
- [x] Self-review completed (Codex reviewed the diff and executed the
regression tests)
- [x] Documentation updated (comments 

**File**: `libs/agno/agno/knowledge/reader/markdown_reader.py` (modified, +5/-2)
```diff
@@ -74,7 +74,9 @@ def read(self, file: Union[Path, IO[Any]], name: Optional[str] = None) -> List[D
                 file_contents = file.read_text(encoding=self.encoding or "utf-8")
             else:
                 log_debug(f"Reading uploaded file: {getattr(file, 'name', 'BytesIO')}")
-                file_name = name or getattr(file, "name", "file").split(".")[0]
+                # Streams opened from file descriptors can have an integer name.
+                stream_name = getattr(file, "name", None)
+                file_name = name or (stream_name.split(".")[0] if isinstance(stream_name, str) else "file")
                 file.seek(0)
                 file_contents = file.read()
                 if isinstance(file_contents, bytes):
@@ -110,7 +112,8 @@ async def async_read(self, file: Union[Path, IO[Any]], name: Optional[str] = Non
                     file_contents = file.read_text(encoding=self.encoding or "utf-8")
             else:
                 log_debug(f"Reading uploaded file asynchronously: {getattr(file, 'name', 'BytesIO')}")
-                file_name = name or getattr(file, "name", "file").split(".")[0]
+                stream_name = getattr(file, "name", None)
+                file_name = name or (stream_name.split(".")[0] if isinstance(stream_name, str) else "file")
                 file.seek(0)
                 file_contents = file.read()
                 if isinstance(file_contents, bytes):
```

**File**: `libs/agno/agno/knowledge/reader/text_reader.py` (modified, +5/-2)
```diff
@@ -46,7 +46,9 @@ def read(self, file: Union[Path, IO[Any]], name: Optional[str] = None) -> List[D
                 file_contents = file.read_text(encoding=self.encoding or "utf-8")
             else:
                 log_debug(f"Reading uploaded file: {getattr(file, 'name', 'BytesIO')}")
-                file_name = name or getattr(file, "name", "text_file").split(".")[0]
+                # Streams opened from file descriptors can have an integer name.
+                stream_name = getattr(file, "name", None)
+                file_name = name or (stream_name.split(".")[0] if isinstance(stream_name, str) else "text_file")
                 file.seek(0)
                 file_contents = file.read()
                 if isinstance(file_contents, bytes):
@@ -88,7 +90,8 @@ async def async_read(self, file: Union[Path, IO[Any]], name: Optional[str] = Non
                     file_contents = file.read_text(encoding=self.encoding or "utf-8")
             else:
                 log_debug(f"Reading uploaded file asynchronously: {getattr(file, 'name', 'BytesIO')}")
-                file_name = name or getattr(file, "name", "text_file").split(".")[0]
+                stream_name = getattr(file, "name", None)
+                file_name = name or (stream_name.split(".")[0] if isinstance(stream_name, str) else "text_file")
                 file.seek(0)
                 file_contents = file.read()
                 if isinstance(file_contents, bytes):
```

**File**: `libs/agno/tests/unit/reader/test_text_stream_names.py` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+from io import BytesIO, StringIO
+
+import pytest
+
+from agno.knowledge.reader.markdown_reader import MarkdownReader
+from agno.knowledge.reader.text_reader import TextReader
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("reader_cls, default_name", [(TextReader, "text_file"), (MarkdownReader, "file")])
+@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
+@pytest.mark.parametrize("name", [None, "override.txt"])
+async def test_read_stream_opened_from_file_descriptor(tmp_path, reader_cls, default_name, use_async, name):
+    content = "# Notes\n\ncafé 中文\n"
+    path = tmp_path / "notes.txt"
+    path.write_bytes(content.encode("utf-8"))
+    reader = reader_cls(chunk=False)
+
+    with path.open("rb") as source, open(source.fileno(), "rb", closefd=False) as stream:
+        assert isinstance(stream.name, int)
+        stream.read(3)
+        documents = await reader.async_read(stream, name=name) if use_async else reader.read(stream, name=name)
+        assert not stream.closed
+
+    assert len(documents) == 1
+    assert documents[0].content == content
+    assert documents[0].name == (name or default_name)
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("reader_cls, default_name", [(TextReader, "text_file"), (MarkdownReader, "file")])
+@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
+@pytest.mark.parametrize("stream_type", [BytesIO, StringIO])
+@pytest.mark.parametrize("stream_name", [None, 0, "notes.txt"])
+async def test_read_stream_with_optional_name(reader_cls, default_name, use_async, stream_type, stream_name):
+    content = "# Notes\n\ncafé 中文\n"
+    data = content.encode("utf-8") if stream_type is BytesIO else content
+    reader = reader_cls(chunk=False)
+
+    with stream_type(data) as stream:
+        stream.name = stream_name
+        documents = await reader.async_read(stream) if use_async else reader.read(stream)
+        assert not stream.closed
+
+    assert len(documents) == 1
+    assert documents[0].content == content
+    assert documents[0].name == ("notes" if stream_name == "notes.txt" else default_name)
```

---

### Incident Patch 2: `3feab68a` (2026-10-05)
**Commit Message**: [cookbook] Fix DynamoDb import path in the DynamoDB cookbook README (#10788)

## Summary

Fixes #10801

`cookbook/06_storage/dynamodb/README.md` imports `DynamoDb` from
`agno.db.dynamodb`, a module that does not exist. The package ships
`agno/db/dynamo/`, and `DynamoDb` is exported from the package root
(`libs/agno/agno/db/dynamo/__init__.py`, `__all__ = ["DynamoDb"]`).
Copying the snippet as written raises `ModuleNotFoundError`.

The cookbook's own runnable example in this directory
(`dynamo_for_agent.py`) already imports it correctly as `from agno.db
import DynamoDb`, so this just aligns the README with the code sitting
next to it.

How it was found: I extracted every `from agno...` import in all 754
markdown files and checked each module path against the source tree. Of
the 62 distinct `agno.*` modules referenced, this is the only one that
does not exist.

(If applicable, issue number: **#10801** — tracked by issue
[#10801](https://github.com/agno-agi/agno/issues/10801).)

## Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Improvement
- [ ] Model update
- [ ] Other:

---

## Checklist

- [x] Code complies with style guidelines
- [ ] Ran format/validat

**File**: `cookbook/06_storage/dynamodb/README.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ uv pip install boto3
 
 ```python
 from agno.agent import Agent
-from agno.db.dynamodb import DynamoDb
+from agno.db import DynamoDb
 
 db = DynamoDb(
     region_name="us-east-1"
```

---

### Incident Patch 3: `a184c901` (2026-10-05)
**Commit Message**: [fix] Handle non-string stream names in JSONReader (#10634)

## Summary

Fixes #10632.

`JSONReader.read()` and `async_read()` raise `AttributeError` for valid
temporary file streams whose `name` is an integer or `None`. Use the
existing `json_file` fallback for non-string stream names in the shared
reading path. Explicit names and existing string-filename behavior are
preserved.

Add sync/async regression coverage for both non-string cases, plus
explicit-name and multi-dot filename controls. The tests also verify
parsed content, rewinding from EOF, and caller ownership of the stream.

## Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Improvement
- [ ] Model update
- [ ] Other:

---

## Checklist

- [x] Code complies with style guidelines
- [x] Ran format/validation scripts (`./scripts/format.sh` and
`./scripts/validate.sh`)
- [x] Self-review completed
- [ ] Documentation updated (comments, docstrings)
- [ ] Examples and guides: Relevant cookbook examples have been included
or updated (if applicable)
- [x] Tested in clean environment
- [x] Tests added/updated (if applicable)

### Duplicate and AI-Generated PR Check

- [x] I have searched existing [open 

**File**: `libs/agno/agno/knowledge/reader/json_reader.py` (modified, +2/-1)
```diff
@@ -61,7 +61,8 @@ def _read_documents(self, path: Union[Path, IO[Any]], name: Optional[str] = None
                 json_contents = json.loads(path.read_text(encoding=self.encoding or "utf-8"))
             elif hasattr(path, "seek") and hasattr(path, "read"):
                 log_debug(f"Reading uploaded file: {getattr(path, 'name', 'BytesIO')}")
-                json_name = name or getattr(path, "name", "json_file").split(".")[0]
+                stream_name = getattr(path, "name", None)
+                json_name = name or (stream_name.split(".")[0] if isinstance(stream_name, str) else "json_file")
                 path.seek(0)
                 json_contents = json.load(path)
             else:
```

**File**: `libs/agno/tests/unit/reader/test_json_reader.py` (modified, +30/-0)
```diff
@@ -38,6 +38,36 @@ def test_read_json_bytesio():
     assert json.loads(documents[0].content) == test_data
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
+@pytest.mark.parametrize(
+    ("stream_name", "name", "expected_name"),
+    [
+        (None, None, "json_file"),
+        (3, None, "json_file"),
+        (None, "upload", "upload"),
+        (3, "upload", "upload"),
+        ("report.v1.json", None, "report"),
+        ("report.v1.json", "upload", "upload"),
+    ],
+)
+async def test_read_json_stream_names(use_async, stream_name, name, expected_name):
+    with BytesIO(b'{"key": "value"}') as stream:
+        stream.name = stream_name
+        stream.seek(0, 2)
+        reader = JSONReader(chunk=False)
+
+        if use_async:
+            documents = await reader.async_read(stream, name=name)
+        else:
+            documents = reader.read(stream, name=name)
+
+        assert len(documents) == 1
+        assert documents[0].name == expected_name
+        assert json.loads(documents[0].content) == {"key": "value"}
+        assert not stream.closed
+
+
 def test_read_json_list():
     # Test reading a JSON file containing a list
     test_data = [{"key1": "value1"}, {"key2": "value2"}]
```

---

### Incident Patch 4: `18413f7f` (2026-10-02)
**Commit Message**: fix: complete page sync for Mintlify-style sites (non-page links, nested indexes, MDX code, redirect aliases) (#10726)

## Summary

Large Mintlify sites sync as `partial` today even though every
documentation page indexes. A `partial` result skips pruning, so pages
removed from the site stay searchable indefinitely. docs.langchain.com
reproduces it. Four causes, all fixed here:

1. **Links to non-page files fail discovery.** LangChain's `llms.txt`
has an "OpenAPI Specs" section:
- `https://api.host.langchain.com/openapi.json` is off-host, which marks
discovery incomplete.
- Two same-site `.json` specs are treated as pages, fetched as
`…openapi.json.md`, and 404 as page failures.

Discovery now skips links to files that cannot be pages (specs, data,
media, archives: `.json`, `.yaml`, `.xml`, `.csv`, `.pdf`, images, audio
and video, archives, fonts) wherever they point. `.js` and `.css` are
excluded, because pages can be named like `/guides/node.js`. **Off-host
page links still block pruning:**
`test_collisions_and_foreign_destinations_cannot_prune` is unchanged.

2. **Depth-first traversal exceeds `max_depth` on indexes the root lists
directly.** Mintlify roots list every `/_llms/` 

**File**: `cookbook/05_agent_os/27_public_pages/README.md` (modified, +13/-3)
```diff
@@ -93,7 +93,9 @@ An application may bind an explicit override into its callback. Acceptance still
 
 A sync with any failed page reports `status="partial"`; the other pages are published and searchable, and pruning waits for a clean run. `SyncReport.failed` is the full count and `failed_paths` names up to 20 of those pages (for example `("/guides/setup.md",)`), so an application can show which pages to check or decide how many failures it tolerates. Each failure is also logged with its path and underlying cause (for example `SyncFailed: sync_failed <- ConnectError: [Errno 104] Connection reset by peer`). A later sync retries failed pages along with any changed ones.
 
-Page and index fetches retry transient failures (connection resets, dropped connections, timeouts, 429 and 5xx responses) up to five attempts with jittered exponential backoff of roughly 0.5, 1, 2 and 4 seconds, honoring a `Retry-After` header up to 10 seconds. Each attempt has its own timeout (5 seconds to connect, including the TLS handshake, and 10 seconds overall), so a stalled connection is abandoned and retried instead of consuming the whole fetch. Retries never extend past each fetch's 30-second deadline. Other 4xx responses, foreign redirects, oversized pages and cancellation fail without retrying.
+A listed page that redirects to another host, to a section of another page (`/guide#setup`) or to a URL that isn't Markdown is an alias, not a page of the source: it is skipped rather than failed, so it doesn't make the run `partial`. `SyncReport.skipped` counts them and `skipped_paths` names up to 20; each is logged with its target. An alias stored by an earlier sync is pruned. A page that moved to another `.md` URL on the same site is followed and stored under its listed path. A listed `.md` page answered with HTML is a failed page (logged as `PageNotMarkdown`), never stored as text.
+
+Page and index fetches retry transient failures (connection resets, dropped connections, timeouts, 429 and 5xx responses) up to five attempts with jittered exponential backoff of roughly 0.5, 1, 2 and 4 seconds, honoring a `Retry-After` header up to 10 seconds. Each attempt has its own timeout (5 seconds to connect, including the TLS handshake, and 10 seconds overall), so a stalled connection is abandoned and retried instead of consuming the whole fetch. Retries never extend past each fetch's 30-second deadline. Other 4xx responses, foreign index redirects, oversized pages and cancellation fail without retrying.
 
 ## Explicit retrieval and customization
 
@@ -298,14 +300,22 @@ the `check` mode, which validates configuration without IO:
 `sync` needs only `./cookbook/scripts/run_pgvector.sh` and `OPENAI_API_KEY`; it
 uses the same `ai` database as the other cookbooks. It publishes every page the
 index discovers through the transform, prints one stored page, and embeds each
-chunk. `incomplete_discovery` in the report means nested indexes exceeded the
-discovery bounds, not a failed page.
+chunk. Nested indexes (`/_llms/...` or `.../llms.txt`) are followed breadth-first,
+so each is reached at its shallowest depth. Index links to files that cannot be
+pages (OpenAPI specs, data, media, archives such as `.json`, `.yaml`, `.png`) are
+skipped wherever they point. `incomplete_discovery` in the report means nested
+indexes exceeded the discovery bounds or a page link could not be followed, not
+a failed page.
 
 - `fumadocs` converts whole-line components and the leading Documentation Index
   preamble, then decodes serializer escapes/entities outside fences. This includes
   inline code, preserving the existing documentation application's behavior.
 - `mintlify` handles the shared steps/tabs/callouts/cards/fields/media vocabulary
   and preamble, keeping escapes and entities unless `unescape_serializer=True`.
+- Both site profiles drop top-level MDX `import`/`export` statements, such as the
+  component definitions Mintlify inlines into page Markdown. A statement must
+  start a block, statements inside fences are kept, and one that never closes is
+  kept. Use `strip_esm=False` to keep them all.
 - `component_aliases={"Aside": "Warning"}` selects a built-in rendering.
   `component_renderers={"Panel": renderer}` overrides a component with a trusted
   Python callback receiving literal attributes and normalized inner Markdown.
```

**File**: `cookbook/05_agent_os/27_public_pages/TEST_LOG.md` (modified, +46/-0)
```diff
@@ -510,3 +510,49 @@ Every test written for a fix was seen failing first; stateful suites ran twice.
   progress finishes its transaction; a function step that never yields cannot be
   stopped. NOT RUN: MCP delivery and Control Plane or AG-UI rendering, which are
   not part of this example.
+
+---
+
+## 2026-10-02 page discovery skips non-page links; profiles drop MDX module code
+
+### documentation_markdown.py
+
+**Status:** PASS
+
+**Description:** Ran the default `check` mode with the demo Python and this
+worktree on `PYTHONPATH`. Ran discovery and both site profiles against live
+corpora without a database or model calls: docs.langchain.com (Mintlify, nested
+`/_llms/` indexes, OpenAPI spec links including one on another host) and
+docs.agno.com (Fumadocs).
+
+**Result:** Configuration validated. LangChain discovery found 1,666 pages with
+`complete=True` (previously `False`: the spec links marked it incomplete and two
+same-site `.json` specs failed as pages; depth-first traversal also exceeded
+`max_depth` on a chain the root lists directly). `mintlify` dropped 1.7 MB of
+inlined component code across 55 of 1,666 pages, keeping every heading and prose
+line on the pages checked. docs.agno.com discovery is unchanged (3,913 pages,
+complete) and `fumadocs` output is byte-identical with and without `strip_esm`
+on all 3,913 pages. The `sync` mode's embedding run was not executed.
+
+---
+
+## 2026-10-02 redirected page aliases are skipped, not failed
+
+### Live sync of docs.langchain.com
+
+**Status:** PASS
+
+**Description:** Ran a docs-agent template stack (PostgreSQL 18 + pgvector,
+`DOCS_FORMAT=mintlify`) with this worktree mounted as `agno`, and synced
+docs.langchain.com through the `sync-docs` workflow, before and after this change.
+
+**Result:** Before: `partial` in 1,147 s, 1,628 updated, 38 failed, so pruning was
+skipped. All 38 were listed pages that redirect elsewhere: to
+reference.langchain.com, GitHub, academy.langchain.com and other hosts; to a
+`#section` of another page (`invalid_source_url`); or to a same-site URL without
+`.md`, whose HTML was embedded until the provider rejected it at its 8,192-token
+input limit. After: `completed` in 243 s, 1,666 discovered, 23 updated, 0 failed,
+38 skipped, each logged with its target. 1,628 pages are stored and no alias is.
+The quoted-attribute fix updated the four pages that kept `<Tab title="… > …">`
+and `ResponseField type="Record<…>"` tags; the only remaining component tags are
+the contributing guide's inline-code mentions.
```

**File**: `libs/agno/agno/knowledge/page/__init__.py` (modified, +4/-0)
```diff
@@ -9,7 +9,9 @@
     PageCommandResult,
     PageError,
     PageList,
+    PageMoved,
     PageNotFound,
+    PageNotMarkdown,
     PageRead,
     PageResult,
     PageSearchConfig,
@@ -37,7 +39,9 @@
     "PageCommandResult",
     "PageError",
     "PageList",
+    "PageMoved",
     "PageNotFound",
+    "PageNotMarkdown",
     "PageRead",
     "PageResult",
     "PageSearchConfig",
```

**File**: `libs/agno/agno/knowledge/page/_coordinator.py` (modified, +15/-2)
```diff
@@ -51,6 +51,7 @@
     Page,
     PageChanged,
     PageError,
+    PageMoved,
     PageList,
     PageNotFound,
     PageRead,
@@ -67,7 +68,7 @@
     encoded_size,
 )
 from agno.utils.bounded import BoundedWorkers, WorkBudget
-from agno.utils.log import log_warning
+from agno.utils.log import log_info, log_warning
 from agno.vectordb.pgvector import PgVector
 from agno.vectordb.pgvector.index import HNSW
 
@@ -1449,6 +1450,7 @@ def progress(stage, *, path=None):
         progress("waiting")
         errors = []
         failed_paths: list[str] = []
+        skipped_paths: list[str] = []
         acquired = False
         with self.engine.connect() as conn:
             lock_deadline = time.monotonic() + min(1200, budget.remaining())
@@ -1514,6 +1516,13 @@ def progress(stage, *, path=None):
                                     source_url=source.url,
                                 )
                             )
+                        except PageMoved as moved:
+                            # An alias of another page or an off-site link: not a page of this
+                            # source, so it is skipped rather than failed and never stored.
+                            skipped_paths.append(page.path)
+                            log_info(
+                                f"Page skipped: {page.path} redirects to {moved.target} (not a page of this source)"
+                            )
                         except Exception as exc:
                             log_warning(f"Page sync failed for {page.path} ({_failure(exc)})")
                             if conn.invalidated or conn.closed or self._pending_publication is not None:
@@ -1540,8 +1549,10 @@ def progress(stage, *, path=None):
                             row.metadata["_agno"]["page"]["path"]
                             for row in self._rows(conn, limit=20_001, include_content=False)
                         ]
+                    skipped = set(skipped_paths)
                     for path in paths:
-                        if path in pages:
+                        # Skipped aliases are pruned too: an older sync may have stored them.
+                        if path in pages and path not in skipped:
                             continue
                         pending_delete = False
                         try:
@@ -1584,6 +1595,8 @@ def progress(stage, *, path=None):
                     unknown=unknown,
                     errors=tuple(errors[:20]),
                     failed_paths=tuple(failed_paths[:20]),
+                    skipped=len(skipped_paths),
+                    skipped_paths=tuple(skipped_paths[:20]),
                 )
                 if not conn.invalidated and not conn.closed:
                     with conn.begin():
```

**File**: `libs/agno/agno/knowledge/page/_source.py` (modified, +40/-4)
```diff
@@ -6,6 +6,7 @@
 import random
 import re
 import time
+from collections import deque
 from dataclasses import dataclass
 from datetime import datetime, timezone
 from email.utils import parsedate_to_datetime
@@ -15,7 +16,7 @@
 import httpx
 
 from agno.fs._paths import normalize_path
-from agno.knowledge.page.types import SyncFailed
+from agno.knowledge.page.types import PageMoved, PageNotMarkdown, SyncFailed
 from agno.knowledge.reader.llms_txt_reader import LLMsTxtReader
 from agno.utils.bounded import WorkBudget
 
@@ -61,6 +62,21 @@ def source_url(url: str) -> str:
     return urlunsplit(("https", parts.netloc.lower(), parts.path or "/", "", ""))
 
 
+# Files an index may link to that can never be a documentation page: API specs,
+# data, media and archives. Discovery skips them wherever they point, so a link to
+# an OpenAPI spec neither fails as a page nor marks discovery incomplete. Not .js
+# or .css: pages can be named like "/guides/node.js".
+NON_PAGE_FILE = re.compile(
+    r"\.(?:json|ya?ml|xml|csv|tsv|pdf|png|jpe?g|gif|svg|webp|ico|mp3|mp4|webm|wav|zip|gz|tgz|tar|woff2?|ttf)$",
+    re.I,
+)
+
+
+def is_non_page_file(url: str) -> bool:
+    """True when a link names a file that cannot be a documentation page."""
+    return isinstance(url, str) and NON_PAGE_FILE.search(urlsplit(url).path) is not None
+
+
 @dataclass(frozen=True)
 class SourcePage:
     path: str
@@ -153,11 +169,24 @@ def fetch(self, url: str, max_bytes: int) -> str:
                             extensions={"sni_hostname": parts.hostname},
                         ) as response:
                             if response.is_redirect:
+                                location = urljoin(current, response.headers["location"])
+                                if url.endswith(".md"):
+                                    # A listed Markdown page that now redirects to another host, to a
+                                    # section of another page, or to a non-Markdown URL (which serves
+                                    # HTML) is an alias, not a page of this source. A move to another
+                                    # Markdown URL on the same host is followed.
+                                    target = urlsplit(location)
+                                    if target.netloc.lower() != self.origin or not target.path.endswith(".md"):
+                                        raise PageMoved(location)
+                                    location = urlunsplit(target._replace(fragment=""))
                                 if redirect == 3:
                                     raise SyncFailed()
-                                current = source_url(urljoin(current, response.headers["location"]))
+                                current = source_url(location)
                                 continue
                             response.raise_for_status()
+                            content_type = response.headers.get("content-type", "").lower()
+                            if url.endswith(".md") and content_type.startswith("text/html"):
+                                raise PageNotMarkdown()
                             body = bytearray()
                             for chunk in response.iter_bytes():
                                 self.budget.remaining()
@@ -218,13 +247,15 @@ def visit(index: str, depth: int) -> None:
             if not entries:
                 self.complete = False
             for entry in entries:
+                if is_non_page_file(entry.url):
+                    continue
                 try:
                     target = source_url(entry.url)
                     if urlsplit(target).netloc != self.origin or not target.startswith(self.base + "/"):
                         raise ValueError("invalid_source_destination")
                     relative = target[len(self.base) :]
                     if relative.endswith("/llms.txt") or relative.startswith("/_llms/"):
-                        visit(target, depth + 1)
+                        queue.append((target, depth + 1))
                         continue
                     # Fumadocs links can identify the rendered page through an
                     # llms.mdx route while its resolved Markdown is served at .md.
@@ -264,7 +295,12 @@ def visit(index: str, depth: int) -> None:
                 except Exception:
                     self.complete = False
 
-        visit(self.url, 0)
+        # Breadth-first, so each nested index is reached at its shallowest depth: a root
+        # that lists every sub-index directly stays within max_depth however deep the
+        # sub-indexes link to each other.
+        queue: deque[tuple[str, int]] = deque([(self.url, 0)])
+        while queue:
+            visit(*queue.popleft())
         if not pages:
             raise SyncFailed()
         return pages
```

**File**: `libs/agno/agno/knowledge/page/types.py` (modified, +20/-0)
```diff
@@ -51,6 +51,22 @@ class SyncFailed(PageError):
     code = "sync_failed"
 
 
+class PageMoved(PageError):
+    """A listed page redirects to a different page or another host: an alias, not a page of this source."""
+
+    code = "page_moved"
+
+    def __init__(self, target: str):
+        super().__init__()
+        self.target = target
+
+
+class PageNotMarkdown(PageError):
+    """A listed Markdown page answered with HTML; it is never stored as page text."""
+
+    code = "page_not_markdown"
+
+
 class PageResult(BaseModel):
     model_config = ConfigDict(frozen=True, extra="forbid")
     schema_version: Literal[1] = 1
@@ -195,6 +211,10 @@ class SyncReport(PageResult):
     # Site paths (e.g. "/guides/setup.md") of pages that failed to publish or delete
     # in this run, first 20, so callers can name them; `failed` stays the full count.
     failed_paths: Tuple[str, ...] = ()
+    # Listed pages that redirect to another page or host (aliases, not pages of this source).
+    # They are not failures and do not block pruning; `skipped_paths` names the first 20.
+    skipped: int = 0
+    skipped_paths: Tuple[str, ...] = ()
 
 
 def encoded_size(value: BaseModel) -> int:
```

**File**: `libs/agno/agno/knowledge/reader/utils/mdx.py` (modified, +99/-4)
```diff
@@ -15,11 +15,13 @@
 from agno.utils.markdown import FenceState, advance_code_fence
 
 HTML_BLOCK = r"div|h[1-6]|video"
+# Tag attributes: anything but < and >, except inside quoted values (type="Record<string, string>").
+ATTRS = r"""(?P<attrs>\s(?:"[^"]*"|'[^']*'|[^<>"'])*?)?"""
 HTML_VOID = r"img|br|source|video"
-BLOCK_OPEN = re.compile(rf"^\s*<(?P<name>[A-Z][A-Za-z]*|{HTML_BLOCK})(?P<attrs>\s[^<>]*?)?(?<!/)>\s*$")
+BLOCK_OPEN = re.compile(rf"^\s*<(?P<name>[A-Z][A-Za-z]*|{HTML_BLOCK}){ATTRS}(?<!/)>\s*$")
 BLOCK_CLOSE = re.compile(rf"^\s*</(?P<name>[A-Z][A-Za-z]*|{HTML_BLOCK})>\s*$")
-SELF_CLOSING = re.compile(rf"^\s*<(?P<name>[A-Z][A-Za-z]*|{HTML_VOID})(?P<attrs>\s[^<>]*?)?\s*/>\s*$")
-ONE_LINER = re.compile(r"^\s*<(?P<name>[A-Z][A-Za-z]*|h[1-6])(?P<attrs>\s[^<>]*?)?>(?P<body>.*)</(?P=name)>\s*$")
+SELF_CLOSING = re.compile(rf"^\s*<(?P<name>[A-Z][A-Za-z]*|{HTML_VOID}){ATTRS}\s*/>\s*$")
+ONE_LINER = re.compile(rf"^\s*<(?P<name>[A-Z][A-Za-z]*|h[1-6]){ATTRS}>(?P<body>.*)</(?P=name)>\s*$")
 ATTR = re.compile(r"""([A-Za-z][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}|([^\s"'<>]+)))?""")
 CALLOUTS = {"Note": "Note", "Warning": "Warning", "Tip": "Tip", "Info": "Info", "Check": "Check", "Callout": ""}
 LABELLED = {"CodeBlockTab": "value", "Tab": "title", "Accordion": "title"}  # tag -> attribute that names it
@@ -131,7 +133,9 @@ def _render(name: str, attrs: dict[str, str], inner: list[str], ctx: _Context) -
         head = f"[{title}]({href})" if title and href else f"**{title}**" if title else f"<{href}>" if href else ""
         return _bullet(head, inner, ctx)
     if name in ("ResponseField", "ParamField"):
-        head = f"`{attrs['name']}`" if attrs.get("name") else ""
+        # Mintlify's ParamField names its field by location: path=, query=, body= or header=.
+        field = next((attrs[key] for key in ("name", "path", "query", "body", "header") if attrs.get(key)), "")
+        head = f"`{field}`" if field else ""
         details = [attrs["type"]] if attrs.get("type") else []
         if "required" in attrs:
             details.append("required")
@@ -240,6 +244,92 @@ def normalize_mdx(
     return "\n".join(lines) + ("\n" if markdown.endswith("\n") and lines else "")
 
 
+# MDX module statements: top-level `import`/`export` at the start of a block. Mintlify
+# serves component definitions this way in its Markdown; they are code, never content.
+ESM_START = re.compile(
+    r"^(?:import\s+(?:type\s+)?(?:[\w$]+|\{|\*|[\"'])"
+    r"|export\s+(?:(?:const|let|var|function|class|default|type|interface|async)\b|\{|\*))"
+)
+# A statement continues past a line that ends in an operator, an opener or `from`.
+ESM_CONTINUES = re.compile(r"(?:=>|[=(\[{,+\-*/?:&|]|\bfrom)$")
+
+
+def _esm_end(lines: list[str], start: int) -> int | None:
+    """Index of the line that closes the statement starting at `start`, or None if it never closes.
+
+    Tracks bracket depth outside strings and comments. Quotes reset at each line end,
+    so an apostrophe in embedded JSX text cannot swallow the rest of the page.
+    """
+    depth = 0
+    in_template = in_comment = False
+    for index in range(start, len(lines)):
+        line, quote, i = lines[index], "", 0
+        while i < len(line):
+            char = line[i]
+            if in_comment:
+                if line.startswith("*/", i):
+                    in_comment, i = False, i + 2
+                    continue
+            elif in_template or quote:
+                if char == "\\":
+                    i += 2
+                    continue
+                if in_template and char == "`":
+                    in_template = False
+                elif char == quote:
+                    quote = ""
+            elif line.startswith("//", i):
+                break
+            elif line.startswith("/*", i):
+                in_comment, i = True, i + 2
+                continue
+            elif char in "'\"":
+                quote = char
+            elif char == "`":
+                in_template = True
+            elif char in "([{":
+                depth += 1
+            elif char in ")]}":
+                depth -= 1
+                if depth < 0:
+                    return None
+            i += 1
+        if depth == 0 and not (in_template or in_comment) and not ESM_CONTINUES.search(line.rstrip()):
+            return index
+    return None
+
+
+def _strip_esm(markdown: str) -> str:
+    """Drop top-level MDX import/export statements outside code fences.
+
+    A statement must start a block (first line or after a blank line) with ESM syntax,
+    so prose such as a wrapped line beginning "export the file" is kept. A statement
+    that never closes is kept rather than risk dropping the rest of the page.
+    """
+    if "import" not in markdown and "export" not in markdown:
+        return markdown
+    lines = markdown.split("\n")
+    out: list[str] = []
+    index = 0
+    removed = False
+    fence: FenceState | None = None
+    while index < 
```

**File**: `libs/agno/tests/integration/knowledge/test_page_storage.py` (modified, +27/-0)
```diff
@@ -81,6 +81,33 @@ def fetch(self, url, max_bytes):
     return knowledge, embedder, site
 
 
+def test_redirected_aliases_are_skipped_not_failed_and_pruned(corpus, monkeypatch):
+    """A listed page that now redirects elsewhere is an alias: skipped, never a failure, and pruned."""
+    from agno.knowledge.page import PageMoved
+
+    knowledge, _, site = corpus
+    url = "https://docs.example.com/llms.txt"
+    alias = "https://docs.example.com/old-agent.md"
+    site[url] += f"\n- [Old agent]({alias})"
+    site[alias] = "# Old agent\n\nServed before it moved.\n"
+    assert knowledge.sync_pages(url=url).updated == 2
+    assert "/old-agent.md" in [page.path for page in knowledge.list_pages().pages]
+
+    served = PageSource.fetch
+
+    def fetch(self, page_url, max_bytes):
+        if page_url == alias:
+            raise PageMoved("https://github.com/org/repo/blob/main/CHANGELOG.md")
+        return served(self, page_url, max_bytes)
+
+    monkeypatch.setattr(PageSource, "fetch", fetch)
+    report = knowledge.sync_pages(url=url)
+    assert report.status == "completed" and report.failed == 0 and not report.errors
+    assert report.skipped == 1 and report.skipped_paths == ("/old-agent.md",)
+    assert report.deleted == 1  # the alias stored by the earlier sync is pruned
+    assert [page.path for page in knowledge.list_pages().pages] == ["/agent.md"]
+
+
 def warm_search_pool(knowledge, count):
     # Parallel optional work reuses pooled connections; cold work falls back to
     # the parent's snapshot instead of adding an unbounded transport handshake.
```

---

### Incident Patch 5: `1e72e54b` (2026-10-02)
**Commit Message**: fix: retry transient page fetch failures with backoff (#10730)

## Summary

A Render deployment syncing docs.agno.com (3,913 pages) failed 1–2
random pages on every run, reported only as `Page sync failed
(SyncFailed)`. Fetching each page in isolation never failed, from Render
or locally. Wrapping `PageSource.fetch` during a real sync revealed the
cause, on a different page each run:

```
SyncFailed: sync_failed <- ConnectError: [Errno 104] Connection reset by peer
```

Two problems combined:

1. **A stalled connection used up the whole fetch.** Each attempt's HTTP
timeout was the entire remaining 30 s fetch deadline. Timing the
failures on Render showed the failing attempt took about 30 s: a TLS
handshake that hung, then ended in `Connection reset by peer`. No time
was left for a retry.
2. **The retries were too short.** The fetcher retried transient
failures only twice, waiting 0.25 s and then 0.5 s.

This PR makes `PageSource.fetch`, used for both pages and nested
indexes, more patient with transient failures:

- **Each attempt gets its own timeout:** 5 s to connect, including the
TLS handshake, and 10 s overall, always within the fetch deadline. A
stalled handshake is abandoned

**File**: `cookbook/05_agent_os/27_public_pages/README.md` (modified, +2/-0)
```diff
@@ -93,6 +93,8 @@ An application may bind an explicit override into its callback. Acceptance still
 
 A sync with any failed page reports `status="partial"`; the other pages are published and searchable, and pruning waits for a clean run. `SyncReport.failed` is the full count and `failed_paths` names up to 20 of those pages (for example `("/guides/setup.md",)`), so an application can show which pages to check or decide how many failures it tolerates. Each failure is also logged with its path and underlying cause (for example `SyncFailed: sync_failed <- ConnectError: [Errno 104] Connection reset by peer`). A later sync retries failed pages along with any changed ones.
 
+Page and index fetches retry transient failures (connection resets, dropped connections, timeouts, 429 and 5xx responses) up to five attempts with jittered exponential backoff of roughly 0.5, 1, 2 and 4 seconds, honoring a `Retry-After` header up to 10 seconds. Each attempt has its own timeout (5 seconds to connect, including the TLS handshake, and 10 seconds overall), so a stalled connection is abandoned and retried instead of consuming the whole fetch. Retries never extend past each fetch's 30-second deadline. Other 4xx responses, foreign redirects, oversized pages and cancellation fail without retrying.
+
 ## Explicit retrieval and customization
 
 `attach_docs_context` calls the same `search_docs` exposed to the model and places its bounded JSON in `{docs_context}` before the first model call. The example owns its instructions and evidence formatting; customize that hook for query alternatives or full-page rendering. No Knowledge object is attached to the Agent. The model can use the three explicitly named tools. Follow-up suggestions use a separately configured model after the answer.
```

**File**: `cookbook/05_agent_os/27_public_pages/TEST_LOG.md` (modified, +31/-0)
```diff
@@ -302,3 +302,34 @@ embedding on first sync followed by a clean retry, and a failed prune deletion.
 (`("/agent.md",)`), and the clean retry reports none. Found on a deployed
 docs corpus where 1 of 3,913 pages failed and neither the report nor the logs
 said which.
+
+---
+
+## 2026-10-02 patient retries for page fetches
+
+### PageSource.fetch retries
+
+**Status:** PASS
+
+**Description:** A Render deployment syncing docs.agno.com (3,913 pages) failed
+1–2 random pages every run. Wrapping the fetcher during a real sync showed
+`ConnectError: [Errno 104] Connection reset by peer` on a different page each
+time, while isolated fetches always succeeded. The previous policy (3 attempts,
+0.25 s and 0.5 s waits) gave up within about a second. Ran the fetch reliability
+and page contract unit tests and the page storage integration suite against
+PostgreSQL 18 + pgvector with this worktree.
+
+**Result:** A burst of four connection resets recovers on the fifth attempt with
+waits of 0.5, 1, 2 and 4 s. A 502, a dropped connection and a write error are
+retried; `Retry-After` is honored and capped at 10 s; a retry that would pass the
+fetch deadline fails immediately with its cause. Permanent failures still make
+one request.
+
+**Live follow-up (same day):** the backoff alone did not help on the deployment.
+A Render shell run of a real sync with the new retry policy swapped in still gave
+up on a page after one attempt: the attempt took about 30 s, a TLS handshake that
+hung and then ended in `Connection reset by peer`, consuming the whole fetch
+deadline before any retry. Each attempt now has its own timeout (5 s connect,
+10 s overall). The next live run timed out the stalled handshake at 5.0 s
+(`ConnectTimeout: The handshake operation timed out`), retried on a fresh
+connection, recovered on attempt 2, and finished with 0 failed pages.
```

**File**: `libs/agno/agno/knowledge/page/_source.py` (modified, +58/-13)
```diff
@@ -3,9 +3,12 @@
 from __future__ import annotations
 
 import ipaddress
+import random
 import re
 import time
 from dataclasses import dataclass
+from datetime import datetime, timezone
+from email.utils import parsedate_to_datetime
 from typing import Dict, Optional
 from urllib.parse import quote, unquote, urljoin, urlsplit, urlunsplit
 
@@ -66,12 +69,39 @@ class SourcePage:
     citation_url: str
 
 
+def _retry_after_seconds(value: Optional[str]) -> Optional[float]:
+    """Seconds requested by a Retry-After header (delta-seconds or HTTP date), if valid."""
+    if not value:
+        return None
+    value = value.strip()
+    if value.isdigit():
+        return float(value)
+    try:
+        when = parsedate_to_datetime(value)
+    except (TypeError, ValueError):
+        return None
+    if when.tzinfo is None:
+        return None
+    return max(0.0, (when - datetime.now(timezone.utc)).total_seconds())
+
+
 class PageSource:
     max_pages = 20_000
     max_indexes = 100
     max_depth = 3
     max_index_bytes = 8 * 1024 * 1024
     max_page_bytes = 4 * 1024 * 1024
+    # Transient failures (connection resets, timeouts, 429/5xx) arrive in bursts during
+    # a full sync, so retries back off for several seconds, within each fetch's deadline.
+    fetch_attempts = 5
+    retry_base_seconds = 0.5
+    retry_max_seconds = 4.0
+    retry_after_max_seconds = 10.0
+    # A stalled connection (seen as a TLS handshake that hangs, then resets) must not
+    # consume the whole fetch deadline: each attempt gets its own bound so a retry on
+    # a fresh connection still fits. Healthy page fetches take well under a second.
+    connect_timeout_seconds = 5.0
+    attempt_timeout_seconds = 10.0
 
     def __init__(self, url: str, public_url: Optional[str], budget: WorkBudget):
         self.url = source_url(url)
@@ -86,7 +116,7 @@ def fetch(self, url: str, max_bytes: int) -> str:
         """Pin validated DNS answers to the connection while retaining TLS hostname checks."""
         url = source_url(url)
         deadline = time.monotonic() + min(30, self.budget.remaining())
-        for attempt in range(3):
+        for attempt in range(self.fetch_attempts):
             current = url
             try:
                 for redirect in range(4):
@@ -113,7 +143,9 @@ def fetch(self, url: str, max_bytes: int) -> str:
                     remaining = min(deadline - time.monotonic(), self.budget.remaining())
                     if remaining <= 0:
                         raise TimeoutError()
-                    with httpx.Client(timeout=remaining, trust_env=False, follow_redirects=False) as client:
+                    attempt_timeout = min(remaining, self.attempt_timeout_seconds)
+                    timeout = httpx.Timeout(attempt_timeout, connect=min(self.connect_timeout_seconds, attempt_timeout))
+                    with httpx.Client(timeout=timeout, trust_env=False, follow_redirects=False) as client:
                         with client.stream(
                             "GET",
                             pinned,
@@ -134,22 +166,35 @@ def fetch(self, url: str, max_bytes: int) -> str:
                                 body.extend(chunk)
                             return body.decode("utf-8", errors="strict")
                 raise SyncFailed()
-            except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError, httpx.HTTPStatusError) as exc:
-                if (
-                    isinstance(exc, httpx.HTTPStatusError)
-                    and exc.response.status_code != 429
-                    and exc.response.status_code < 500
-                ):
+            except (
+                httpx.TimeoutException,
+                httpx.NetworkError,
+                httpx.RemoteProtocolError,
+                httpx.HTTPStatusError,
+            ) as exc:
+                status = exc.response.status_code if isinstance(exc, httpx.HTTPStatusError) else None
+                if status is not None and status != 429 and status < 500:
                     raise SyncFailed() from exc
-                if attempt == 2:
+                if attempt == self.fetch_attempts - 1:
                     raise SyncFailed() from exc
-                delay = min(0.25 * 2**attempt, self.budget.remaining())
-                if self.budget.cancelled.wait(delay):
-                    self.budget.remaining()
-                if time.monotonic() >= deadline:
+                delay = self._retry_delay(attempt, exc)
+                # Never sleep past the fetch deadline; fail now with the transport cause.
+                if time.monotonic() + delay >= deadline:
                     raise SyncFailed() from exc
+                if self.budget.cancelled.wait(min(delay, self.budget.remaining())):
+                    self.budget.remaining()
         raise SyncFailed()
 
+    def _retry_delay(self, attempt: int, exc: Exception) -> float:
+        """Exponential backoff with jitter; a server's bounded Retry-After takes pre
```

**File**: `libs/agno/tests/unit/knowledge/test_page_source_reliability.py` (modified, +125/-1)
```diff
@@ -26,11 +26,12 @@ def handle(request):
         return httpx.Response(200, content=b"hello")
 
     monkeypatch.setattr(httpx, "Client", lambda **kw: original(transport=httpx.MockTransport(handle), **kw))
+    monkeypatch.setattr(PageSource, "retry_base_seconds", 0)
     source = PageSource("https://docs.example.com/llms.txt", None, WorkBudget(5))
     if exhausted:
         with pytest.raises(SyncFailed):
             source.fetch(source.url, 10)
-        assert len(seen) == 3
+        assert len(seen) == PageSource.fetch_attempts
     else:
         assert source.fetch(source.url, 10) == "hello"
         assert len(seen) == 2
@@ -74,3 +75,126 @@ def test_duplicate_navigation_keeps_first_title(monkeypatch):
     pages = source.discover()
     assert source.complete and set(pages) == {"/a.md", "/b.md"}
     assert pages["/a.md"].title == "First"
+
+
+def _source_with(monkeypatch, handle, budget=None):
+    """A PageSource whose transport is `handle` and whose retry waits are recorded, not slept."""
+    import random
+
+    import dns.resolver
+
+    monkeypatch.setattr(dns.resolver.Resolver, "resolve", lambda *a, **kw: ["93.184.216.34"])
+    original = httpx.Client
+    monkeypatch.setattr(httpx, "Client", lambda **kw: original(transport=httpx.MockTransport(handle), **kw))
+    monkeypatch.setattr(random, "uniform", lambda low, high: high)  # no jitter: exact schedule
+    source = PageSource("https://docs.example.com/llms.txt", None, budget or WorkBudget(60))
+    waits: list[float] = []
+    monkeypatch.setattr(source.budget.cancelled, "wait", lambda seconds: waits.append(round(seconds, 3)) or False)
+    return source, waits
+
+
+def test_burst_of_connection_resets_backs_off_and_recovers(monkeypatch):
+    seen = []
+
+    def handle(request):
+        seen.append(request)
+        if len(seen) < 5:
+            raise httpx.ConnectError("[Errno 104] Connection reset by peer")
+        return httpx.Response(200, content=b"hello")
+
+    source, waits = _source_with(monkeypatch, handle)
+    assert source.fetch(source.url, 10) == "hello"
+    assert len(seen) == 5 and waits == [0.5, 1.0, 2.0, 4.0]
+
+
+@pytest.mark.parametrize(
+    "failure",
+    [
+        lambda request: httpx.Response(502),
+        lambda request: (_ for _ in ()).throw(httpx.RemoteProtocolError("Server disconnected")),
+        lambda request: (_ for _ in ()).throw(httpx.WriteError("broken pipe")),
+    ],
+)
+def test_server_errors_and_dropped_connections_are_retried(monkeypatch, failure):
+    seen = []
+
+    def handle(request):
+        seen.append(request)
+        return failure(request) if len(seen) == 1 else httpx.Response(200, content=b"ok")
+
+    source, waits = _source_with(monkeypatch, handle)
+    assert source.fetch(source.url, 10) == "ok" and waits == [0.5]
+
+
+@pytest.mark.parametrize("header,expected", [("3", 3.0), ("99", 10.0)])
+def test_retry_after_is_honored_and_bounded(monkeypatch, header, expected):
+    seen = []
+
+    def handle(request):
+        seen.append(request)
+        if len(seen) == 1:
+            return httpx.Response(429, headers={"retry-after": header})
+        return httpx.Response(200, content=b"ok")
+
+    source, waits = _source_with(monkeypatch, handle)
+    assert source.fetch(source.url, 10) == "ok" and waits == [expected]
+
+
+def test_retry_never_sleeps_past_the_fetch_deadline(monkeypatch):
+    def handle(request):
+        return httpx.Response(503, headers={"retry-after": "8"})
+
+    source, waits = _source_with(monkeypatch, handle, budget=WorkBudget(5))
+    with pytest.raises(SyncFailed) as failed:
+        source.fetch(source.url, 10)
+    assert waits == [] and isinstance(failed.value.__cause__, httpx.HTTPStatusError)
+
+
+def test_retry_after_parsing():
+    from datetime import datetime, timedelta, timezone
+    from email.utils import format_datetime
+
+    from agno.knowledge.page._source import _retry_after_seconds
+
+    soon = format_datetime(datetime.now(timezone.utc) + timedelta(seconds=30), usegmt=True)
+    assert _retry_after_seconds("5") == 5.0
+    assert 25 <= (_retry_after_seconds(soon) or 0) <= 30
+    assert _retry_after_seconds("Wed, 21 Oct 2015 07:28:00 GMT") == 0.0
+    assert _retry_after_seconds("soon") is None and _retry_after_seconds(None) is None
+
+
+def test_each_attempt_has_its_own_timeout_so_a_stalled_handshake_is_retried(monkeypatch):
+    """A handshake that hangs must time out per attempt, not consume the 30 s fetch deadline."""
+    timeouts = []
+    seen = []
+
+    def handle(request):
+        seen.append(request)
+        if len(seen) == 1:
+            raise httpx.ConnectTimeout("_ssl.c:1064: The handshake operation timed out")
+        return httpx.Response(200, content=b"ok")
+
+    source, waits = _source_with(monkeypatch, handle)
+    wrapped = httpx.Client
+
+    def recording_client(**kwargs):
+        timeouts.append(kwargs["timeout"])
+        return wrapped(**kwargs)
+
+    monkeypatch.setattr(httpx, "Client", recording_c
```

---

### Incident Patch 6: `54468b83` (2026-10-01)
**Commit Message**: [fix] Don't crash when a JSON fragment provides a scalar before a list (#10654)

## Summary

`_parse_individual_json()` merges streamed JSON fragments field by
field. For a
list field it only created its accumulator when the key was **absent**,
so an
earlier fragment that supplied a scalar for the same field was extended
instead
of replaced:

```python
AttributeError: 'str' object has no attribute 'extend'
```

An implementation-level exception escaped instead of the helper's
documented
`None`-on-invalid result. Models commonly emit a draft scalar before the
real
list (`{"items": "draft"}` followed by `{"items": ["final"]}`), so this
is easy
to hit with `output_schema` on a list field.

## Root cause

```python
if isinstance(field_value, list):
    if field_name not in merged_data:      # key IS present (bound to a scalar)
        merged_data[field_name] = []
    merged_data[field_name].extend(field_value)   # -> str/int/None/dict.extend
```

The same failure occurs with an earlier `str`, `int`, `None`, `bool` or
`dict`.

## Fix

Re/initialize the accumulator whenever its current value is not a list:

```diff
- if field_name not in merged_data:
+ if not isinstance(merged_data.get(f

**File**: `libs/agno/agno/utils/string.py` (modified, +4/-1)
```diff
@@ -173,7 +173,10 @@ def _parse_individual_json(content: str, output_schema: Type[BaseModel]) -> Opti
                     field_value = candidate_obj[field_name]
                     # If field is a list, extend it; otherwise, use the latest value
                     if isinstance(field_value, list):
-                        if field_name not in merged_data:
+                        # An earlier fragment may have provided a non-list value for this field
+                        # (an LLM often emits a draft scalar before the real list). Extending
+                        # that value would raise, so start a fresh accumulator instead.
+                        if not isinstance(merged_data.get(field_name), list):
                             merged_data[field_name] = []
                         merged_data[field_name].extend(field_value)
                     else:
```

**File**: `libs/agno/tests/unit/utils/test_string.py` (modified, +48/-0)
```diff
@@ -1,9 +1,12 @@
+import json
 from typing import List, Optional
 
+import pytest
 from pydantic import BaseModel
 
 from agno.utils.string import (
     _extract_json_objects,
+    _parse_individual_json,
     generate_id_from_name,
     parse_response_dict_str,
     parse_response_model_str,
@@ -386,6 +389,51 @@ class CodeModel(BaseModel):
     assert result.description == "A recursive factorial function with comments and multiplication"
 
 
+class ListFieldModel(BaseModel):
+    items: list[str]
+
+
+def test_parse_individual_json_merges_lists():
+    """Two list fragments for the same field are concatenated."""
+    result = _parse_individual_json('{"items": ["a"]}\n{"items": ["b"]}', ListFieldModel)
+    assert result is not None
+    assert result.items == ["a", "b"]
+
+
+@pytest.mark.parametrize("parse", [_parse_individual_json, parse_response_model_str])
+@pytest.mark.parametrize("scalar", ["draft", 42, None, True, {"nested": 1}])
+def test_scalar_before_list_across_parsers(parse, scalar):
+    """A scalar fragment before a list fragment must not crash the merge.
+
+    Regression test: the list branch only created its accumulator when the key
+    was absent, so a preceding scalar (an LLM commonly emits a draft value
+    first) was extended instead, raising
+    AttributeError: 'str' object has no attribute 'extend'.
+
+    Covers both the merge helper and the public parser, whose final fallback
+    is _parse_individual_json. json.dumps keeps every fragment a valid JSON
+    object; the extraction-count assertion pins that precondition so the test
+    cannot pass by silently dropping an invalid fragment.
+    """
+    content = json.dumps({"items": scalar}) + "\n" + json.dumps({"items": ["final"]})
+    assert len(_extract_json_objects(content)) == 2
+    result = parse(content, ListFieldModel)
+    assert result is not None, f"expected the later list to win for {scalar!r}"
+    assert result.items == ["final"]
+
+
+def test_parse_individual_json_list_before_scalar_still_fails_softly():
+    """A scalar after a list keeps the documented None-on-invalid behaviour."""
+    result = _parse_individual_json('{"items": ["a"]}\n{"items": "draft"}', ListFieldModel)
+    assert result is None
+
+
+def test_parse_individual_json_scalar_only_still_fails_softly():
+    """A lone scalar for a list field is still rejected by validation."""
+    result = _parse_individual_json('{"items": "draft"}', ListFieldModel)
+    assert result is None
+
+
 def test_generate_id_from_name_with_name():
     """Test that named IDs are deterministic kebab-case"""
     assert generate_id_from_name("My Agent") == "my-agent"
```

---

### Incident Patch 7: `13d3c946` (2026-09-30)
**Commit Message**: [fix] db: an async delete that failed is not a run that was not there (#10682)

Closes #10685

## Problem

`AsyncPostgresDb.delete_run` and `AsyncMySQLDb.delete_run` return
`False` when the delete fails. `False` already means something else here
- the docstring says *"True if the run was deleted, False otherwise"*,
and it comes from `result.rowcount > 0`. So a dropped connection, a
deadlock or a timeout reaches the caller as "there was no such run", and
the run is still in the table.

`delete_runs` in both files has the same handler without even the
`return`, so it logs and falls out of the function.

This is not an async convention. Across `agno/db`, 13 of 17 backends
re-raise from these handlers, and that includes `AsyncSqliteDb` and
`AsyncMongoDb` - two async backends that get it right. The two files
here disagree with **their own sync twins**:

| backend | sync `delete_run` | async `delete_run` |
|---|---|---|
| sqlite | raise | raise |
| mongo | raise | raise |
| postgres | raise | **return False** |
| mysql | raise | **return False** |

`postgres.py:1234` and `mysql.py:841` both end `log_error(...)` with
`raise e`. The async copies kept the log line and dropped the raise.

##

**File**: `libs/agno/agno/db/mysql/async_mysql.py` (modified, +2/-1)
```diff
@@ -839,7 +839,7 @@ async def delete_run(self, run_id: str) -> bool:
             return deleted
         except Exception as e:
             log_error(f"Error deleting run: {str(e)}")
-            return False
+            raise e
 
     async def delete_runs(self, run_ids: List[str]) -> None:
         """Delete all given runs from the runs table."""
@@ -853,6 +853,7 @@ async def delete_runs(self, run_ids: List[str]) -> None:
             log_debug(f"Successfully deleted {result.rowcount} runs")  # type: ignore
         except Exception as e:
             log_error(f"Error deleting runs: {str(e)}")
+            raise e
 
     # -- Session methods --
     async def delete_session(self, session_id: str, user_id: Optional[str] = None) -> bool:
```

**File**: `libs/agno/agno/db/postgres/async_postgres.py` (modified, +2/-1)
```diff
@@ -1034,7 +1034,7 @@ async def delete_run(self, run_id: str) -> bool:
 
         except Exception as e:
             log_error(f"Error deleting run: {str(e)}")
-            return False
+            raise e
 
     async def delete_runs(self, run_ids: List[str]) -> None:
         """Delete all given runs from the runs table.
@@ -1055,6 +1055,7 @@ async def delete_runs(self, run_ids: List[str]) -> None:
 
         except Exception as e:
             log_error(f"Error deleting runs: {str(e)}")
+            raise e
 
     # -- Session methods --
     async def delete_session(self, session_id: str, user_id: Optional[str] = None) -> bool:
```

**File**: `libs/agno/tests/unit/db/test_async_mysql.py` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+from unittest.mock import AsyncMock, Mock
+
+import pytest
+from sqlalchemy.ext.asyncio import AsyncEngine
+
+from agno.db.mysql.async_mysql import AsyncMySQLDb
+
+
+@pytest.fixture
+def mock_async_engine():
+    """Create a mock async SQLAlchemy engine"""
+    engine = Mock(spec=AsyncEngine)
+    engine.url = "fake:///url"
+    return engine
+
+
+@pytest.fixture
+def async_mysql_db(mock_async_engine):
+    """Create an AsyncMySQLDb instance with mock engine"""
+    return AsyncMySQLDb(
+        db_engine=mock_async_engine,
+        db_schema="test_schema",
+        session_table="test_sessions",
+    )
+
+
+def _session_raising(error: Exception) -> Mock:
+    """An async session factory whose execute() fails the way a live backend does."""
+    session = AsyncMock()
+    session.__aenter__ = AsyncMock(return_value=session)
+    session.__aexit__ = AsyncMock(return_value=None)
+    session.begin = Mock(return_value=session)
+    session.execute = AsyncMock(side_effect=error)
+    return Mock(return_value=session)
+
+
+@pytest.mark.asyncio
+async def test_delete_run_raises_on_a_backend_failure(async_mysql_db):
+    """False means the run was not found. A dropped connection must not say that."""
+    async_mysql_db._get_table = AsyncMock(return_value=Mock())
+    async_mysql_db.async_session_factory = _session_raising(OSError("server closed the connection"))
+
+    with pytest.raises(OSError, match="server closed"):
+        await async_mysql_db.delete_run("run-1")
+
+
+@pytest.mark.asyncio
+async def test_delete_run_still_returns_false_when_there_is_no_such_run(async_mysql_db):
+    """The meaning of False, pinned so it is not lost to the fix above."""
+    async_mysql_db._get_table = AsyncMock(return_value=None)
+
+    assert await async_mysql_db.delete_run("run-1") is False
+
+
+@pytest.mark.asyncio
+async def test_delete_runs_raises_on_a_backend_failure(async_mysql_db):
+    async_mysql_db._get_table = AsyncMock(return_value=Mock())
+    async_mysql_db.async_session_factory = _session_raising(OSError("server closed the connection"))
+
+    with pytest.raises(OSError, match="server closed"):
+        await async_mysql_db.delete_runs(["run-1", "run-2"])
```

**File**: `libs/agno/tests/unit/db/test_async_postgres.py` (modified, +37/-0)
```diff
@@ -103,3 +103,40 @@ async def _none(table_type, create_table_if_not_found=False):
     assert await async_postgres_db.get_schedules() == ([], 0)
     with pytest.raises(RuntimeError, match="schedules table unavailable"):
         await async_postgres_db.get_schedules(raise_on_error=True)
+
+
+def _session_raising(error: Exception) -> Mock:
+    """An async session factory whose execute() fails the way a live backend does."""
+    session = AsyncMock()
+    session.__aenter__ = AsyncMock(return_value=session)
+    session.__aexit__ = AsyncMock(return_value=None)
+    session.begin = Mock(return_value=session)
+    session.execute = AsyncMock(side_effect=error)
+    return Mock(return_value=session)
+
+
+@pytest.mark.asyncio
+async def test_delete_run_raises_on_a_backend_failure(async_postgres_db):
+    """False means the run was not found. A dropped connection must not say that."""
+    async_postgres_db._get_table = AsyncMock(return_value=Mock())
+    async_postgres_db.async_session_factory = _session_raising(OSError("server closed the connection"))
+
+    with pytest.raises(OSError, match="server closed"):
+        await async_postgres_db.delete_run("run-1")
+
+
+@pytest.mark.asyncio
+async def test_delete_run_still_returns_false_when_there_is_no_such_run(async_postgres_db):
+    """The meaning of False, pinned so it is not lost to the fix above."""
+    async_postgres_db._get_table = AsyncMock(return_value=None)
+
+    assert await async_postgres_db.delete_run("run-1") is False
+
+
+@pytest.mark.asyncio
+async def test_delete_runs_raises_on_a_backend_failure(async_postgres_db):
+    async_postgres_db._get_table = AsyncMock(return_value=Mock())
+    async_postgres_db.async_session_factory = _session_raising(OSError("server closed the connection"))
+
+    with pytest.raises(OSError, match="server closed"):
+        await async_postgres_db.delete_runs(["run-1", "run-2"])
```

---

### Incident Patch 8: `eecade71` (2026-09-30)
**Commit Message**: fix: HITL continue with background and stream duplicates the paused run in its own history (#10597)

## Summary

Fixes #10086. Supersedes #10088 by @rodrigocoliveira, who found the root
cause and wrote the continue wiring tests adapted here. Thanks!

**This is a major fix. Human-in-the-loop (HITL) does not work in AgentOS
with its default settings.** The AgentOS UI sends `background=true` and
`stream=true` on every run and continue: background mode is on by
default for AgentOS above 2.6.0 when the agent or team has a database.
With that setting, continuing a paused run fails for any agent or team
that has `add_history_to_context=True` and uses a model that replays the
full conversation, such as `OpenAIChat`:

```
An assistant message with 'tool_calls' must be followed by tool messages responding to each 'tool_call_id'.
```

Every HITL type is affected (confirmation, user input, external
execution), for both agents and teams. Retrying doesn't help, because
each background continue produces the same duplicate.

### Root cause

A background continue saves the run as `PENDING`, then `RUNNING`, before
it rebuilds the run's messages, so the run shows as in progress to
anyone polling it. 

**File**: `libs/agno/agno/agent/_messages.py` (modified, +11/-3)
```diff
@@ -30,6 +30,7 @@
 from agno.run.agent import RunOutput
 from agno.run.messages import RunMessages
 from agno.session import AgentSession
+from agno.session._utils import continue_history_session
 from agno.tools.function import Function
 from agno.utils.agent import (
     aexecute_instructions,
@@ -1506,6 +1507,7 @@ def _build_continue_run_messages(
     session: Optional[AgentSession] = None,
     add_history_to_context: Optional[bool] = None,
     run_context: Optional[RunContext] = None,
+    run_response: Optional[RunOutput] = None,
 ) -> RunMessages:
     """This function returns a RunMessages object with the following attributes:
         - system_message: The system message for this run
@@ -1560,7 +1562,7 @@ def _build_continue_run_messages(
             agent.system_message_role if agent.system_message_role not in ["user", "assistant", "tool"] else None
         )
 
-        history: List[Message] = session.get_messages(
+        history: List[Message] = continue_history_session(session, run_response).get_messages(
             last_n_runs=agent.num_history_runs,
             limit=agent.num_history_messages,
             skip_roles=[skip_role] if skip_role else None,
@@ -1595,12 +1597,15 @@ def get_continue_run_messages(
     session: Optional[AgentSession] = None,
     add_history_to_context: Optional[bool] = None,
     run_context: Optional[RunContext] = None,
+    run_response: Optional[RunOutput] = None,
 ) -> RunMessages:
     """Build the messages that resume a paused run, reading offloaded media back first.
 
     The paused run's own messages come off the database carrying a reference and no bytes.
     """
-    run_messages = _build_continue_run_messages(agent, input, session, add_history_to_context, run_context)
+    run_messages = _build_continue_run_messages(
+        agent, input, session, add_history_to_context, run_context, run_response
+    )
     media_storage = _resolve_media_storage(agent)
     if media_storage is not None:
         from agno.utils.media_offload import refresh_messages_media
@@ -1615,9 +1620,12 @@ async def aget_continue_run_messages(
     session: Optional[AgentSession] = None,
     add_history_to_context: Optional[bool] = None,
     run_context: Optional[RunContext] = None,
+    run_response: Optional[RunOutput] = None,
 ) -> RunMessages:
     """Async variant of :func:`get_continue_run_messages`."""
-    run_messages = _build_continue_run_messages(agent, input, session, add_history_to_context, run_context)
+    run_messages = _build_continue_run_messages(
+        agent, input, session, add_history_to_context, run_context, run_response
+    )
     media_storage = _resolve_media_storage(agent)
     if media_storage is not None:
         from agno.utils.media_offload import arefresh_messages_media
```

**File**: `libs/agno/agno/agent/_run.py` (modified, +3/-0)
```diff
@@ -3710,6 +3710,7 @@ def continue_run_dispatch(
         session=agent_session,
         add_history_to_context=agent.add_history_to_context,
         run_context=run_context,
+        run_response=run_response,
     )
 
     # Reset the run state
@@ -5035,6 +5036,7 @@ async def _acontinue_run(
                     input=input_messages,
                     session=agent_session,
                     add_history_to_context=agent.add_history_to_context,
+                    run_response=run_response,
                 )
 
                 # Reset the run state
@@ -5558,6 +5560,7 @@ async def _acontinue_run_stream(
                     input=input_messages,
                     session=agent_session,
                     add_history_to_context=agent.add_history_to_context,
+                    run_response=run_response,
                 )
 
                 # Reset the run state
```

**File**: `libs/agno/agno/session/_utils.py` (modified, +20/-1)
```diff
@@ -2,7 +2,8 @@
 
 from __future__ import annotations
 
-from typing import TYPE_CHECKING, Any, Optional, Union
+from copy import copy
+from typing import TYPE_CHECKING, Any, Optional, TypeVar, Union
 
 if TYPE_CHECKING:
     from agno.run.agent import RunOutput
@@ -12,6 +13,8 @@
     from agno.session.team import TeamSession
     from agno.session.workflow import WorkflowSession
 
+HistorySessionT = TypeVar("HistorySessionT", "AgentSession", "TeamSession")
+
 
 def resolve_run_index(
     session: Union["AgentSession", "TeamSession", "WorkflowSession"],
@@ -42,3 +45,19 @@ def resolve_run_index(
         if existing_id == target_id:
             return idx
     return None
+
+
+def continue_history_session(
+    session: HistorySessionT,
+    run: Optional[Union["RunOutput", "TeamRunOutput"]],
+) -> HistorySessionT:
+    """Return a copy of ``session`` without the continued run.
+
+    The continued run's messages are its input, so it must not also come back as history, whatever
+    its stored status. The original session and its runs are left untouched, including cached sessions.
+    """
+    if run is None:
+        return session
+    history_session = copy(session)
+    history_session.runs = [r for r in session.runs or [] if r.run_id != run.run_id]
+    return history_session
```

**File**: `libs/agno/agno/team/_run.py` (modified, +16/-4)
```diff
@@ -90,7 +90,7 @@
     TeamRunOutputEvent,
 )
 from agno.session import TeamSession
-from agno.session._utils import resolve_run_index
+from agno.session._utils import continue_history_session, resolve_run_index
 from agno.tools.function import Function
 from agno.utils.agent import (
     abuild_full_run_storage_copy,
@@ -5417,6 +5417,7 @@ def _build_continue_run_messages(
     session: Optional[TeamSession] = None,
     add_history_to_context: Optional[bool] = None,
     run_context: Optional[RunContext] = None,
+    run_response: Optional[TeamRunOutput] = None,
 ) -> RunMessages:
     """Build a RunMessages object from the existing conversation messages.
 
@@ -5458,7 +5459,7 @@ def _build_continue_run_messages(
 
         skip_role = team.system_message_role if team.system_message_role not in ["user", "assistant", "tool"] else None
 
-        history: List[Message] = session.get_messages(
+        history: List[Message] = continue_history_session(session, run_response).get_messages(
             last_n_runs=team.num_history_runs,
             limit=team.num_history_messages,
             skip_roles=[skip_role] if skip_role else None,
@@ -5490,12 +5491,13 @@ def _get_continue_run_messages(
     session: Optional[TeamSession] = None,
     add_history_to_context: Optional[bool] = None,
     run_context: Optional[RunContext] = None,
+    run_response: Optional[TeamRunOutput] = None,
 ) -> RunMessages:
     """Build the messages that resume a paused run, reading offloaded media back first.
 
     The paused run's own messages come off the database carrying a reference and no bytes.
     """
-    run_messages = _build_continue_run_messages(team, input, session, add_history_to_context, run_context)
+    run_messages = _build_continue_run_messages(team, input, session, add_history_to_context, run_context, run_response)
     if team.media_storage is not None:
         from agno.utils.media_offload import refresh_messages_media
 
@@ -5509,9 +5511,10 @@ async def _aget_continue_run_messages(
     session: Optional[TeamSession] = None,
     add_history_to_context: Optional[bool] = None,
     run_context: Optional[RunContext] = None,
+    run_response: Optional[TeamRunOutput] = None,
 ) -> RunMessages:
     """Async variant of :func:`_get_continue_run_messages`."""
-    run_messages = _build_continue_run_messages(team, input, session, add_history_to_context, run_context)
+    run_messages = _build_continue_run_messages(team, input, session, add_history_to_context, run_context, run_response)
     if team.media_storage is not None:
         from agno.utils.media_offload import arefresh_messages_media
 
@@ -7733,6 +7736,7 @@ def continue_run_dispatch(
             session=team_session,
             add_history_to_context=team.add_history_to_context,
             run_context=run_context,
+            run_response=run_response,
         )
 
         log_debug(f"Team Continue Run (forked): {run_response.run_id}", center=True)
@@ -7977,6 +7981,7 @@ def _paused_stream_with_final() -> Iterator[Union[TeamRunOutputEvent, RunOutputE
             session=team_session,
             add_history_to_context=team.add_history_to_context,
             run_context=run_context,
+            run_response=run_response,
         )
 
         # Handle tool call updates (execute confirmed tools, etc.)
@@ -8049,6 +8054,7 @@ def _paused_stream_with_final() -> Iterator[Union[TeamRunOutputEvent, RunOutputE
             session=team_session,
             add_history_to_context=team.add_history_to_context,
             run_context=run_context,
+            run_response=run_response,
         )
 
         # Prepare for member HITL continuation
@@ -8211,6 +8217,7 @@ def _continue_run_dispatch_stream_with_member_events(
             session=team_session,
             add_history_to_context=team.add_history_to_context,
             run_context=run_context,
+            run_response=run_response,
         )
 
         _handle_team_tool_call_updates(team, run_response=run_response, run_messages=run_messages, tools=_tools)
@@ -8262,6 +8269,7 @@ def _continue_run_dispatch_stream_with_member_events(
             session=team_session,
             add_history_to_context=team.add_history_to_context,
             run_context=run_context,
+            run_response=run_response,
         )
 
         _prepare_member_hitl_continuation(run_response, run_messages, member_results)
@@ -9745,6 +9753,7 @@ async def _acontinue_run(
                         session=team_session,
                         add_history_to_context=team.add_history_to_context,
                         run_context=run_context,
+                        run_response=run_response,
                     )
 
                     await _ahandle_team_tool_call_updates(
@@ -9793,6 +9802,7 @@ async def _acontinue_run(
                         session=team_session,
                         add_history_to_context=team.add_history_to_context,
                         run_context=run_context,
+               
```

**File**: `libs/agno/tests/integration/agent/human_in_the_loop/test_background_stream_continue.py` (added, +202/-0)
```diff
@@ -0,0 +1,202 @@
+"""Integration tests for continuing a paused agent run with background=True and stream=True.
+
+A background continue persists the run as PENDING/RUNNING before its messages are
+rebuilt, so the continued run must not be read back as its own history. Chat
+Completions rejects a request where an assistant tool call has no matching tool
+result, so a duplicated tool call makes the continue end in ERROR instead of COMPLETED.
+"""
+
+import asyncio
+import os
+
+import pytest
+
+from agno.agent import Agent
+from agno.models.openai import OpenAIChat
+from agno.run.agent import RunOutput
+from agno.run.base import RunStatus
+from agno.tools.decorator import tool
+
+pytestmark = pytest.mark.skipif(not os.getenv("OPENAI_API_KEY"), reason="OPENAI_API_KEY not set")
+
+
+@tool(requires_confirmation=True)
+def restart_service(service: str) -> str:
+    """Restart a service.
+
+    Args:
+        service: Name of the service to restart.
+    """
+    return f"Restarted {service}"
+
+
+@tool(external_execution=True)
+def get_location() -> str:
+    """Return the user's current location. Executed by the client."""
+    return ""
+
+
+@tool(requires_user_input=True, user_input_fields=["city"])
+def book_hotel(city: str = "") -> str:
+    """Book a hotel in the city the user provides.
+
+    Args:
+        city: City to book the hotel in.
+    """
+    return f"Booked a hotel in {city}"
+
+
+PAUSE_CASES = {
+    "confirmation": (restart_service, "Restart the billing service."),
+    "external_execution": (get_location, "Where am I right now? Use the get_location tool."),
+    "user_input": (book_hotel, "Book me a hotel. Use the book_hotel tool."),
+}
+
+
+def _make_agent(db, tool_fn, **kwargs) -> Agent:
+    return Agent(
+        model=OpenAIChat(id="gpt-4o-mini"),
+        tools=[tool_fn],
+        db=db,
+        add_history_to_context=True,
+        instructions=[
+            "Always call the available tool when the user asks for something it can do.",
+            "Never ask for confirmation or details in chat; the tool collects them.",
+        ],
+        telemetry=False,
+        **kwargs,
+    )
+
+
+def _resolve(run: RunOutput) -> None:
+    for requirement in run.active_requirements:
+        if requirement.needs_confirmation:
+            requirement.confirm()
+        elif requirement.needs_external_execution:
+            requirement.set_external_execution_result('{"city": "Paris"}')
+        elif requirement.needs_user_input:
+            requirement.provide_user_input({"city": "Paris"})
+
+
+async def _wait_for_terminal_run(agent: Agent, run_id: str, session_id: str, timeout: float = 30.0) -> RunOutput:
+    """Background runs finish on a detached task, so poll the database for a settled status."""
+    deadline = asyncio.get_running_loop().time() + timeout
+    while True:
+        run = await agent.aget_run_output(run_id=run_id, session_id=session_id)
+        if run is not None and run.status not in (RunStatus.pending, RunStatus.running):
+            return run
+        if asyncio.get_running_loop().time() > deadline:
+            raise TimeoutError(f"Run {run_id} did not settle; last status: {run.status if run else None}")
+        await asyncio.sleep(0.1)
+
+
+async def _start_background_stream(agent: Agent, message: str, session_id: str) -> RunOutput:
+    async for _ in agent.arun(message, session_id=session_id, stream=True, background=True):
+        pass
+    last = agent.get_last_run_output(session_id=session_id)
+    assert last is not None and last.run_id is not None
+    return await _wait_for_terminal_run(agent, last.run_id, session_id)
+
+
+async def _continue_background_stream(agent: Agent, run: RunOutput) -> RunOutput:
+    assert run.run_id is not None and run.session_id is not None
+    async for _ in agent.acontinue_run(
+        run_id=run.run_id,
+        session_id=run.session_id,
+        requirements=run.requirements,
+        stream=True,
+        background=True,
+    ):
+        pass
+    return await _wait_for_terminal_run(agent, run.run_id, run.session_id)
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("pause_type", list(PAUSE_CASES))
+async def test_background_stream_continue_completes(shared_db, pause_type):
+    tool_fn, prompt = PAUSE_CASES[pause_type]
+    agent = _make_agent(shared_db, tool_fn)
+    session_id = f"bg-stream-{pause_type}"
+
+    paused = await _start_background_stream(agent, prompt, session_id)
+    assert paused.status == RunStatus.paused, f"expected a pause, got {paused.status}: {paused.content}"
+
+    _resolve(paused)
+    completed = await _continue_background_stream(agent, paused)
+
+    assert completed.status == RunStatus.completed, f"continue ended {completed.status}: {completed.content}"
+
+
+@pytest.mark.asyncio
+async def test_background_stream_continue_keeps_prior_history(shared_db):
+    """Excluding the continued run must not drop genuinely earlier turns from history."""
+    agent = _make_agent(
+        shared_db,
```

**File**: `libs/agno/tests/integration/teams/human_in_the_loop/test_team_background_stream_continue.py` (added, +124/-0)
```diff
@@ -0,0 +1,124 @@
+"""Integration tests for continuing a paused team run with background=True and stream=True.
+
+A background continue persists the team run as PENDING/RUNNING before its messages are
+rebuilt, so the continued run must not be read back as its own history. Chat Completions rejects a
+duplicated, unanswered tool call, so the bug makes the continue end in ERROR.
+"""
+
+import asyncio
+import os
+
+import pytest
+
+from agno.agent import Agent
+from agno.models.openai import OpenAIChat
+from agno.run.base import RunStatus
+from agno.run.team import TeamRunOutput
+from agno.team.team import Team
+from agno.tools.decorator import tool
+
+pytestmark = pytest.mark.skipif(not os.getenv("OPENAI_API_KEY"), reason="OPENAI_API_KEY not set")
+
+
+@tool(requires_confirmation=True)
+def approve_deployment(app_name: str, environment: str) -> str:
+    """Approve a deployment to the specified environment.
+
+    Args:
+        app_name: Name of the application to deploy.
+        environment: Target environment (staging, production).
+    """
+    return f"Deployed {app_name} to {environment} successfully"
+
+
+def _make_team_tool_team(db, **kwargs) -> Team:
+    helper = Agent(
+        name="Helper Agent",
+        role="Assists with general questions",
+        model=OpenAIChat(id="gpt-4o-mini"),
+        telemetry=False,
+    )
+    return Team(
+        name="Deploy Team",
+        model=OpenAIChat(id="gpt-4o-mini"),
+        members=[helper],
+        tools=[approve_deployment],
+        db=db,
+        add_history_to_context=True,
+        telemetry=False,
+        **kwargs,
+        instructions=[
+            "You MUST use the approve_deployment tool when asked to deploy an application.",
+            "Do NOT respond without using the tool - always call approve_deployment first.",
+        ],
+    )
+
+
+async def _wait_for_terminal_run(team: Team, run_id: str, session_id: str, timeout: float = 60.0) -> TeamRunOutput:
+    """Background runs finish on a detached task, so poll the database for a settled status."""
+    deadline = asyncio.get_running_loop().time() + timeout
+    while True:
+        run = await team.aget_run_output(run_id=run_id, session_id=session_id)
+        if run is not None and run.status not in (RunStatus.pending, RunStatus.running):
+            return run  # type: ignore[return-value]
+        if asyncio.get_running_loop().time() > deadline:
+            raise TimeoutError(f"Run {run_id} did not settle; last status: {run.status if run else None}")
+        await asyncio.sleep(0.1)
+
+
+async def _start_background_stream(team: Team, message: str, session_id: str) -> TeamRunOutput:
+    async for _ in team.arun(message, session_id=session_id, stream=True, background=True):
+        pass
+    last = team.get_last_run_output(session_id=session_id)
+    assert last is not None and last.run_id is not None
+    return await _wait_for_terminal_run(team, last.run_id, session_id)
+
+
+async def _continue_background_stream(team: Team, run: TeamRunOutput) -> TeamRunOutput:
+    assert run.run_id is not None and run.session_id is not None
+    for requirement in run.active_requirements:
+        requirement.confirm()
+    async for _ in team.acontinue_run(
+        run_id=run.run_id,
+        session_id=run.session_id,
+        requirements=run.requirements,
+        stream=True,
+        background=True,
+    ):
+        pass
+    return await _wait_for_terminal_run(team, run.run_id, run.session_id)
+
+
+@pytest.mark.asyncio
+async def test_team_tool_background_stream_continue(shared_db):
+    team = _make_team_tool_team(shared_db)
+    session_id = "team-tool-bg-stream"
+
+    paused = await _start_background_stream(team, "Deploy myapp to production", session_id)
+    assert paused.status == RunStatus.paused, f"expected a pause, got {paused.status}: {paused.content}"
+
+    completed = await _continue_background_stream(team, paused)
+
+    assert completed.status == RunStatus.completed, f"continue ended {completed.status}: {completed.content}"
+
+
+@pytest.mark.asyncio
+async def test_team_background_stream_continue_keeps_prior_history(shared_db):
+    """Excluding the continued run must not drop genuinely earlier team turns from history."""
+    team = _make_team_tool_team(
+        shared_db,
+        additional_context="IMPORTANT: Always address the user by their name in every response.",
+    )
+    session_id = "team-bg-stream-history"
+
+    first = await _start_background_stream(team, "Hi, my name is Alice.", session_id)
+    assert first.status == RunStatus.completed
+
+    paused = await _start_background_stream(team, "Deploy myapp to production", session_id)
+    assert paused.status == RunStatus.paused
+
+    completed = await _continue_background_stream(team, paused)
+    assert completed.status == RunStatus.completed, f"continue ended {completed.status}: {completed.content}"
+
+    # The name only reaches the continued request through history from the first run
+    asser
```

**File**: `libs/agno/tests/unit/agent/test_continue_history_wiring.py` (added, +139/-0)
```diff
@@ -0,0 +1,139 @@
+"""Check that every Agent continue path passes the continued run to the message builder.
+
+The builder uses the run to keep it (and its fork tree) out of its own history. A call
+site that stops passing it still builds valid messages, so history-level tests on other
+paths keep passing while that path regresses. These tests drive the real dispatch
+functions and stop them at the message-builder call with a ``BaseException`` sentinel,
+which passes through every ``except Exception`` handler on the continue path, so
+nothing downstream (model call, tool execution, persistence) needs mocking.
+
+Covers the three call sites: ``continue_run_dispatch``, ``_acontinue_run`` and
+``_acontinue_run_stream``.
+"""
+
+import os
+
+os.environ.setdefault("OPENAI_API_KEY", "test-key-for-testing")
+
+import pytest
+
+from agno.agent import _init, _messages, _response, _run, _storage, _tools
+from agno.agent.agent import Agent
+from agno.run.agent import RunOutput
+from agno.run.base import RunStatus
+from agno.session import AgentSession
+
+RUN_ID = "run-continue-wiring"
+SESSION_ID = "session-wiring"
+
+
+class _StoppedAtMessageBuilder(BaseException):
+    """Raised the instant the message builder is reached."""
+
+
+def _make_run() -> RunOutput:
+    return RunOutput(
+        run_id=RUN_ID,
+        session_id=SESSION_ID,
+        status=RunStatus.running,
+        tools=[],
+        requirements=None,
+        messages=[],
+    )
+
+
+def _patch_sync(monkeypatch: pytest.MonkeyPatch, agent: Agent, runs) -> None:
+    monkeypatch.setattr(_init, "has_async_db", lambda agent: False)
+    monkeypatch.setattr(_storage, "update_metadata", lambda agent, session=None: None)
+    monkeypatch.setattr(_storage, "load_session_state", lambda agent, session=None, session_state=None: session_state)
+    monkeypatch.setattr(_response, "get_response_format", lambda agent, run_context=None: None)
+    monkeypatch.setattr(_tools, "determine_tools_for_model", lambda *a, **kw: [])
+    monkeypatch.setattr(
+        _storage,
+        "read_or_create_session",
+        lambda agent, session_id=None, user_id=None: AgentSession(session_id=session_id, user_id=user_id, runs=runs),
+    )
+    monkeypatch.setattr(agent, "initialize_agent", lambda debug_mode=None: None)
+
+
+def _patch_async(monkeypatch: pytest.MonkeyPatch, agent: Agent, runs) -> None:
+    async def fake_aread_or_create_session(agent, session_id=None, user_id=None):
+        return AgentSession(session_id=session_id, user_id=user_id, runs=runs)
+
+    monkeypatch.setattr(_init, "has_async_db", lambda agent: False)
+    monkeypatch.setattr(_storage, "aread_or_create_session", fake_aread_or_create_session)
+    monkeypatch.setattr(
+        _storage,
+        "read_or_create_session",
+        lambda agent, session_id=None, user_id=None: AgentSession(session_id=session_id, user_id=user_id, runs=runs),
+    )
+    monkeypatch.setattr(_storage, "update_metadata", lambda agent, session=None: None)
+    monkeypatch.setattr(_storage, "load_session_state", lambda agent, session=None, session_state=None: session_state)
+    monkeypatch.setattr(_response, "get_response_format", lambda agent, run_context=None: None)
+    monkeypatch.setattr(_tools, "determine_tools_for_model", lambda *a, **kw: [])
+    monkeypatch.setattr(agent, "initialize_agent", lambda debug_mode=None: None)
+
+
+def test_sync_continue_run_dispatch_passes_run_id_to_message_builder(monkeypatch: pytest.MonkeyPatch):
+    agent = Agent(name="test-agent")
+    _patch_sync(monkeypatch, agent, runs=[_make_run()])
+
+    captured: dict = {}
+
+    def fake_get_continue_run_messages(
+        agent, input, session=None, add_history_to_context=None, run_context=None, run_response=None
+    ):
+        captured["run_id"] = run_response.run_id if run_response is not None else None
+        raise _StoppedAtMessageBuilder()
+
+    monkeypatch.setattr(_messages, "get_continue_run_messages", fake_get_continue_run_messages)
+
+    with pytest.raises(_StoppedAtMessageBuilder):
+        _run.continue_run_dispatch(agent=agent, run_id=RUN_ID, session_id=SESSION_ID, stream=False)
+
+    assert captured.get("run_id") == RUN_ID
+
+
+@pytest.mark.asyncio
+async def test_async_continue_run_passes_run_id_to_message_builder(monkeypatch: pytest.MonkeyPatch):
+    agent = Agent(name="test-agent")
+    _patch_async(monkeypatch, agent, runs=[_make_run()])
+
+    captured: dict = {}
+
+    async def fake_aget_continue_run_messages(
+        agent, input, session=None, add_history_to_context=None, run_context=None, run_response=None
+    ):
+        captured["run_id"] = run_response.run_id if run_response is not None else None
+        raise _StoppedAtMessageBuilder()
+
+    monkeypatch.setattr(_messages, "aget_continue_run_messages", fake_aget_continue_run_messages)
+
+    with pytest.raises(_StoppedAtMessageBuilder):
+        await _run.acontinue_run_dispatch(agent=agent, run_id=RUN_ID, session_id=SESSION_ID, stream=False)
+
+    as
```

**File**: `libs/agno/tests/unit/run/test_continuation.py` (added, +196/-0)
```diff
@@ -0,0 +1,196 @@
+"""Background continuation history, with foreground compatibility coverage."""
+
+from copy import deepcopy
+
+import pytest
+
+from agno.agent import Agent
+from agno.agent._messages import _build_continue_run_messages as agent_messages
+from agno.db.sqlite import AsyncSqliteDb, SqliteDb
+from agno.models.base import Model
+from agno.models.message import Message
+from agno.models.response import ModelResponse, ToolExecution
+from agno.run import RunStatus
+from agno.run.agent import RunOutput
+from agno.run.requirement import RunRequirement
+from agno.run.team import TeamRunOutput
+from agno.session import AgentSession, TeamSession
+from agno.team import Team
+from agno.team._run import _build_continue_run_messages as team_messages
+from agno.tools import tool
+from agno.tools.function import UserInputField
+
+
+class InspectModel(Model):
+    def __init__(self, inspect_messages):
+        super().__init__(id="offline", provider="test")
+        self.inspect_messages = inspect_messages
+        self.calls = 0
+        self.requests = []
+
+    def invoke(self, messages, **kwargs):
+        self.calls += 1
+        self.requests.append(list(messages))
+        self.inspect_messages(messages)
+        return ModelResponse(role="assistant", content="done")
+
+    async def ainvoke(self, messages, **kwargs):
+        return self.invoke(messages, **kwargs)
+
+    def invoke_stream(self, messages, **kwargs):
+        yield self.invoke(messages, **kwargs)
+
+    async def ainvoke_stream(self, messages, **kwargs):
+        yield self.invoke(messages, **kwargs)
+
+    def _parse_provider_response(self, response, **kwargs):
+        return response
+
+    def _parse_provider_response_delta(self, response):
+        return response
+
+
+@pytest.fixture(params=["agent", "team"])
+def kind(request):
+    return request.param
+
+
+def make_component(kind, **kwargs):
+    if kind == "agent":
+        return Agent(id="component", telemetry=False, **kwargs)
+    return Team(id="component", members=[], telemetry=False, **kwargs)
+
+
+def make_run(kind, run_id, **kwargs):
+    cls = RunOutput if kind == "agent" else TeamRunOutput
+    return cls(run_id=run_id, session_id="session", user_id="owner", **{kind + "_id": "component"}, **kwargs)
+
+
+def make_session(kind, runs):
+    cls = AgentSession if kind == "agent" else TeamSession
+    return cls(session_id="session", user_id="owner", runs=runs, **{kind + "_id": "component"})
+
+
+@pytest.mark.parametrize("status", list(RunStatus))
+def test_history_excludes_current_transcript_before_limits(kind, status):
+    component = make_component(kind, add_history_to_context=True, num_history_runs=1)
+    prior = make_run(kind, "prior", status=RunStatus.completed, messages=[Message(role="user", content="prior")])
+    current = make_run(kind, "current", status=status, messages=[Message(role="user", content="current")])
+    session = make_session(kind, [prior, current])
+    before = deepcopy(session.to_dict())
+    builder = agent_messages if kind == "agent" else team_messages
+    result = builder(component, input=deepcopy(current.messages), session=session, run_response=current)
+    assert [m.content for m in result.messages] == ["prior", "current"]
+    assert session.to_dict() == before
+
+
+def prepare_continuation(kind, tmp_path, pause_type, expected_status=RunStatus.paused):
+    db = SqliteDb(db_file=str(tmp_path / "runs.db"))
+    tool_calls = []
+
+    @tool(
+        external_execution=pause_type == "external",
+        requires_confirmation=pause_type == "confirmation",
+        requires_user_input=pause_type == "user_input",
+        user_input_fields=["city"] if pause_type == "user_input" else None,
+    )
+    def location(city: str) -> str:
+        """Return a city after approval or user input."""
+        assert db.get_run("current").status == expected_status
+        tool_calls.append(city)
+        return city
+
+    execution = ToolExecution(
+        tool_call_id="call-location",
+        tool_name="location",
+        tool_args={"city": "Paris"},
+        external_execution_required=pause_type == "external",
+        requires_confirmation=pause_type == "confirmation",
+        requires_user_input=pause_type == "user_input",
+        user_input_schema=[UserInputField(name="city", field_type=str)] if pause_type == "user_input" else None,
+    )
+    requirement = RunRequirement(tool_execution=execution)
+    current = make_run(
+        kind,
+        "current",
+        status=RunStatus.paused,
+        messages=[
+            Message(role="user", content="current request"),
+            Message(
+                role="assistant",
+                tool_calls=[
+                    {
+                        "id": execution.tool_call_id,
+                        "type": "function",
+                        "function": {"name": "location", "arguments": '{"city":"Paris"}'},
+                    }
+                ],
+            ),
+        ],
```

---

### Incident Patch 9: `4db4180a` (2026-09-30)
**Commit Message**: [fix] Handle CR record endings in CSV readers (#10657)

## Summary

Fix CSV ingestion silently returning no documents for CR-delimited
records in `CSVReader` and `FieldLabeledCSVReader`.

Both readers already open synchronous path inputs with `newline=""`, but
their in-memory wrappers use the default `StringIO` newline mode. With
CR-only record separators, `csv.reader` raises `new-line character seen
in unquoted field`; the readers catch it and return `[]`. This affects
binary/text uploads in both modes and path inputs in async mode.

Use `newline=""` for the six `StringIO` wrappers, matching the existing
path handling. This recognizes LF, CRLF, and CR record boundaries while
preserving quoted multiline cells for the existing cell normalization.

Minimal reproduction (no network, model, or database needed):

```python
import asyncio
from io import BytesIO
from agno.knowledge.reader.csv_reader import CSVReader

payload = b"name,city\rAlice,Paris\rBob,Rome\r"
reader = CSVReader(chunk=False)
print(reader.read(BytesIO(payload)))
print(asyncio.run(reader.async_read(BytesIO(payload))))
```

Before: both calls log a CSV error and return `[]`. After: each returns
a document containing all 

**File**: `libs/agno/agno/knowledge/reader/csv_reader.py` (modified, +3/-3)
```diff
@@ -97,7 +97,7 @@ def read(
                 file_contents = file.read()
                 if isinstance(file_contents, bytes):
                     file_contents = file_contents.decode(self.encoding or "utf-8")
-                file_content = io.StringIO(file_contents)
+                file_content = io.StringIO(file_contents, newline="")
 
             csv_lines: List[str] = []
             with file_content as csvfile:
@@ -167,15 +167,15 @@ async def async_read(
                     file_path, mode="r", encoding=self.encoding or "utf-8", newline=""
                 ) as file_content:
                     content = await file_content.read()
-                    file_content_io = io.StringIO(content)
+                    file_content_io = io.StringIO(content, newline="")
                 csv_name = name or file_path.stem
             else:
                 log_debug(f"Reading retrieved file async: {getattr(file, 'name', 'BytesIO')}")
                 file.seek(0)
                 file_contents = file.read()
                 if isinstance(file_contents, bytes):
                     file_contents = file_contents.decode(self.encoding or "utf-8")
-                file_content_io = io.StringIO(file_contents)
+                file_content_io = io.StringIO(file_contents, newline="")
                 csv_name = name or getattr(file, "name", "csv_file").split(".")[0]
 
             file_content_io.seek(0)
```

**File**: `libs/agno/agno/knowledge/reader/field_labeled_csv_reader.py` (modified, +3/-3)
```diff
@@ -110,7 +110,7 @@ def read(
                 content = file.read()
                 if isinstance(content, bytes):
                     content = content.decode(self.encoding or "utf-8")
-                file_content = io.StringIO(content)
+                file_content = io.StringIO(content, newline="")
 
             documents = []
 
@@ -191,7 +191,7 @@ async def async_read(
                 log_debug(f"Reading async: {file}")
                 async with aiofiles.open(file, mode="r", encoding=self.encoding or "utf-8", newline="") as file_content:
                     content = await file_content.read()
-                    file_content_io = io.StringIO(content)
+                    file_content_io = io.StringIO(content, newline="")
                 csv_name = name or file.stem
             else:
                 log_debug(f"Reading retrieved file async: {getattr(file, 'name', 'BytesIO')}")
@@ -200,7 +200,7 @@ async def async_read(
                 content = file.read()
                 if isinstance(content, bytes):
                     content = content.decode(self.encoding or "utf-8")
-                file_content_io = io.StringIO(content)
+                file_content_io = io.StringIO(content, newline="")
 
             file_content_io.seek(0)
             csv_reader = csv.reader(file_content_io, delimiter=delimiter, quotechar=quotechar)
```

**File**: `libs/agno/tests/unit/reader/test_csv_newlines.py` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import io
+
+import pytest
+
+from agno.knowledge.reader.csv_reader import CSVReader
+from agno.knowledge.reader.field_labeled_csv_reader import FieldLabeledCSVReader
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("reader_class", [CSVReader, FieldLabeledCSVReader])
+@pytest.mark.parametrize("use_async", [False, True], ids=["sync", "async"])
+@pytest.mark.parametrize("source", ["path", "bytes", "text"])
+@pytest.mark.parametrize("newline", ["\n", "\r\n", "\r"], ids=["lf", "crlf", "cr"])
+@pytest.mark.parametrize("row_count", [1, 12], ids=["small", "paginated"])
+async def test_csv_line_endings(tmp_path, reader_class, use_async, source, newline, row_count):
+    # Quoted multiline cells must remain one field, even with CR record endings.
+    content = newline.join(["name,notes"] + [f'Person {i},"first{newline}second"' for i in range(row_count)])
+    content += newline
+    if source == "path":
+        file = tmp_path / "contacts.csv"
+        file.write_bytes(content.encode("utf-8"))
+    elif source == "bytes":
+        file = io.BytesIO(content.encode("utf-8"))
+    else:
+        file = io.StringIO(content)
+
+    reader = CSVReader(chunk=False) if reader_class is CSVReader else FieldLabeledCSVReader()
+    if use_async:
+        documents = await reader.async_read(file, name="contacts", page_size=5)
+    else:
+        documents = reader.read(file, name="contacts")
+
+    if reader_class is CSVReader:
+        expected = ["name, notes"] + [f"Person {i}, first second" for i in range(row_count)]
+        assert "\n".join(document.content for document in documents) == "\n".join(expected)
+    else:
+        assert [document.content for document in documents] == [
+            f"Name: Person {i}\nNotes: first second" for i in range(row_count)
+        ]
+        assert [document.meta_data["row_index"] for document in documents] == list(range(row_count))
+
+    assert all(document.name == "contacts" for document in documents)
+    if source != "path":
+        assert not file.closed
```

---

### Incident Patch 10: `c0642f49` (2026-09-29)
**Commit Message**: [fix] Distinguish None-valued Python tool results from missing variables (#10637)

## Summary

Fixes #10636.

PythonTools uses `namespace.get(variable_to_return)` to distinguish a
result from a missing name. A defined variable with value `None` is
consequently reported as missing after successful execution.

Check namespace membership before retrieving the value in
`run_python_code`, `save_to_file_and_run` and
`run_python_file_return_variable`. Preserve the existing error for
absent names and the string conversion of returned values.

## Type of change

- [x] Bug fix

## Checklist

- [x] Code complies with style guidelines
- [x] Ran format/validation scripts (`./scripts/format.sh` and
`./scripts/validate.sh`) — limitations below
- [x] Self-review completed by Codex; no human review is claimed
- [ ] Documentation updated (existing return-value contract is
unchanged)
- [ ] Examples and guides updated (not applicable)
- [x] Tested in clean environment
- [x] Tests added/updated

### Duplicate and AI-Generated PR Check

- [x] Searched existing open pull requests and found no matching fix
- [ ] Similar PR explanation (not applicable)
- [x] This PR was entirely AI-generated

## Verificati

**File**: `libs/agno/agno/tools/python.py` (modified, +6/-6)
```diff
@@ -114,9 +114,9 @@ def save_to_file_and_run(
             globals_after_run = runpy.run_path(str(file_path), init_globals=self.safe_globals, run_name="__main__")
 
             if variable_to_return:
-                variable_value = globals_after_run.get(variable_to_return)
-                if variable_value is None:
+                if variable_to_return not in globals_after_run:
                     return f"Variable {variable_to_return} not found"
+                variable_value = globals_after_run[variable_to_return]
                 log_debug(f"Variable {variable_to_return} value: {variable_value}")
                 return str(variable_value)
             else:
@@ -142,9 +142,9 @@ def run_python_file_return_variable(self, file_name: str, variable_to_return: Op
             log_info(f"Running {file_path}")
             globals_after_run = runpy.run_path(str(file_path), init_globals=self.safe_globals, run_name="__main__")
             if variable_to_return:
-                variable_value = globals_after_run.get(variable_to_return)
-                if variable_value is None:
+                if variable_to_return not in globals_after_run:
                     return f"Variable {variable_to_return} not found"
+                variable_value = globals_after_run[variable_to_return]
                 log_debug(f"Variable {variable_to_return} value: {variable_value}")
                 return str(variable_value)
             else:
@@ -202,9 +202,9 @@ def run_python_code(self, code: str, variable_to_return: Optional[str] = None) -
             exec(code, self.safe_globals, self.safe_locals)
 
             if variable_to_return:
-                variable_value = self.safe_locals.get(variable_to_return)
-                if variable_value is None:
+                if variable_to_return not in self.safe_locals:
                     return f"Variable {variable_to_return} not found"
+                variable_value = self.safe_locals[variable_to_return]
                 log_debug(f"Variable {variable_to_return} value: {variable_value}")
                 return str(variable_value)
             else:
```

**File**: `libs/agno/tests/unit/tools/test_python_tools.py` (modified, +27/-0)
```diff
@@ -130,6 +130,33 @@ def test_run_python_code_error(python_tools):
     assert "Error running python code" in result
 
 
+@pytest.mark.parametrize("execution", ["code", "save_and_run", "file"])
+@pytest.mark.parametrize("value", [None, False, 0, "", [], {}])
+def test_execution_returns_defined_falsy_variables(python_tools, temp_dir, execution, value):
+    code = f"tool_result = {value!r}"
+    if execution == "code":
+        result = python_tools.run_python_code(code, "tool_result")
+    elif execution == "save_and_run":
+        result = python_tools.save_to_file_and_run("result.py", code, "tool_result")
+    else:
+        (temp_dir / "result.py").write_text(code, encoding="utf-8")
+        result = python_tools.run_python_file_return_variable("result.py", "tool_result")
+    assert result == str(value)
+
+
+@pytest.mark.parametrize("execution", ["code", "save_and_run", "file"])
+def test_execution_still_reports_missing_variables(python_tools, temp_dir, execution):
+    code = "tool_result = None"
+    if execution == "code":
+        result = python_tools.run_python_code(code, "missing_result")
+    elif execution == "save_and_run":
+        result = python_tools.save_to_file_and_run("result.py", code, "missing_result")
+    else:
+        (temp_dir / "result.py").write_text(code, encoding="utf-8")
+        result = python_tools.run_python_file_return_variable("result.py", "missing_result")
+    assert result == "Variable missing_result not found"
+
+
 @patch("subprocess.check_call")
 def test_pip_install_package(mock_check_call, python_tools):
     # Test pip package installation
```

---

### Incident Patch 11: `476f61b0` (2026-09-28)
**Commit Message**: [fix] Preserve PubMed metadata for short abstracts (#10640)

## Summary

Fixes #10639.

`PubmedTools.search_pubmed()` currently omits `Title` and `Published`
from its default concise output whenever an abstract has 200 characters
or fewer. This also affects articles without an abstract. Restrict the
conditional expression to summary truncation so the metadata is always
included, while preserving the existing 200-character cutoff and
expanded output.

Add regression coverage for short abstracts, exactly 200 characters, 201
characters, absent abstracts, and expanded results. The tests mock HTTP
responses and exercise the real XML parsing and JSON output paths.

## Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Improvement
- [ ] Model update
- [ ] Other:

---

## Checklist

- [x] Code complies with style guidelines
- [x] Ran format/validation scripts (`./scripts/format.sh` and
`./scripts/validate.sh`)
- [x] Self-review completed
- [ ] Documentation updated (comments, docstrings)
- [ ] Examples and guides: Relevant cookbook examples have been included
or updated (if applicable)
- [x] Tested in clean environment
- [x] Tests added/updated (if applicable)

###

**File**: `libs/agno/agno/tools/pubmed.py` (modified, +1/-3)
```diff
@@ -180,9 +180,7 @@ def search_pubmed(self, query: str, max_results: Optional[int] = None) -> str:
                     article_text = (
                         f"Title: {article.get('Title')}\n"
                         f"Published: {article.get('Published')}\n"
-                        f"Summary: {summary[:200]}..."
-                        if len(summary) > 200
-                        else f"Summary: {summary}"
+                        f"Summary: {summary[:200] + '...' if len(summary) > 200 else summary}"
                     )
                 results.append(article_text)
 
```

**File**: `libs/agno/tests/unit/tools/test_pubmed.py` (modified, +73/-0)
```diff
@@ -1,5 +1,6 @@
 """Unit tests for PubmedTools class."""
 
+import json
 from unittest.mock import MagicMock, patch
 
 import httpx
@@ -99,3 +100,75 @@ def test_search_pubmed_reports_http_status_error():
         result = PubmedTools().search_pubmed("test query")
 
     assert result == "Could not fetch articles. Error: rate limited"
+
+
+@pytest.mark.parametrize(
+    ("results_expanded", "abstract", "expected_result"),
+    [
+        pytest.param(
+            False,
+            "A short abstract.",
+            "Title: Test article\nPublished: 2026\nSummary: A short abstract.",
+            id="short-abstract",
+        ),
+        pytest.param(
+            False,
+            "a" * 200,
+            "Title: Test article\nPublished: 2026\nSummary: " + "a" * 200,
+            id="200-character-abstract",
+        ),
+        pytest.param(
+            False,
+            "a" * 200 + "b",
+            "Title: Test article\nPublished: 2026\nSummary: " + "a" * 200 + "...",
+            id="201-character-abstract",
+        ),
+        pytest.param(
+            False,
+            None,
+            "Title: Test article\nPublished: 2026\nSummary: No abstract available",
+            id="missing-abstract",
+        ),
+        pytest.param(
+            True,
+            "a" * 200 + "b",
+            "Published: 2026\n"
+            "Title: Test article\n"
+            "First Author: Smith, Jane\n"
+            "Journal: Test journal\n"
+            "Publication Type: Journal Article\n"
+            "DOI: 10.1234/test\n"
+            "PubMed URL: https://pubmed.ncbi.nlm.nih.gov/111/\n"
+            "Full Text URL: https://doi.org/10.1234/test\n"
+            "Keywords: medicine\n"
+            "MeSH Terms: Humans\n"
+            "Summary:\n" + "a" * 200 + "b",
+            id="expanded-preserves-full-abstract",
+        ),
+    ],
+)
+def test_search_pubmed_formats_article_results(mock_httpx_get, results_expanded, abstract, expected_result):
+    abstract_xml = f"<Abstract><AbstractText>{abstract}</AbstractText></Abstract>" if abstract is not None else ""
+    details_xml = f"""<PubmedArticleSet>
+        <PubmedArticle>
+            <MedlineCitation>
+                <PMID>111</PMID>
+                <Article>
+                    <Journal><JournalIssue><PubDate><Year>2026</Year></PubDate></JournalIssue>
+                        <Title>Test journal</Title></Journal>
+                    <ArticleTitle>Test article</ArticleTitle>
+                    {abstract_xml}
+                    <AuthorList><Author><LastName>Smith</LastName><ForeName>Jane</ForeName></Author></AuthorList>
+                    <PublicationTypeList><PublicationType>Journal Article</PublicationType></PublicationTypeList>
+                </Article>
+                <KeywordList><Keyword>medicine</Keyword></KeywordList>
+                <MeshHeadingList><MeshHeading><DescriptorName>Humans</DescriptorName></MeshHeading></MeshHeadingList>
+            </MedlineCitation>
+            <PubmedData><ArticleIdList><ArticleId IdType="doi">10.1234/test</ArticleId></ArticleIdList></PubmedData>
+        </PubmedArticle>
+    </PubmedArticleSet>"""
+    mock_httpx_get.side_effect = [MagicMock(content=ESEARCH_XML), MagicMock(content=details_xml.encode())]
+
+    result = PubmedTools(results_expanded=results_expanded).search_pubmed("test query")
+
+    assert json.loads(result) == [expected_result]
```

---

### Incident Patch 12: `c2d8fd00` (2026-09-28)
**Commit Message**: [fix] Preserve nullable document titles in Claude citations (#10147)

## Summary

Claude can return a document citation with `document_title: null`. Agno
serializes the text block with `model_dump(exclude_none=True)`, which
removes that key. On the next turn, replaying the saved assistant
message fails with HTTP 400: `page_location.document_title: Field
required`.

The shared content-block coercion helper now restores a missing
`document_title` as `None` for page, character and content-block
document citations. This covers response capture and replay, including
histories already saved without the field and list-shaped assistant
content. Existing titles are kept, and normalization copies the affected
dictionaries so formatting a request does not change stored history.

The production change is confined to one helper. Signed thinking blocks,
block order, web citations and omission of unrelated null fields keep
their existing behavior.

## Where this appeared

We hit this in production with Agno 3.0.9 while running MindRoom: two
follow-up replies were rejected because a saved page citation lacked
`document_title`.

The regression reproduces the field loss with the real Anthropic SDK a

**File**: `libs/agno/agno/utils/models/claude.py` (modified, +21/-6)
```diff
@@ -112,17 +112,32 @@ def _anthropic_coerce_content_block(item: Any) -> Optional[Any]:
     if item is None:
         return None
     if isinstance(item, dict):
-        return item if item.get("type") else None
-    model_dump = getattr(item, "model_dump", None)
-    if callable(model_dump):
+        block_dict = item
+    else:
+        model_dump = getattr(item, "model_dump", None)
+        if not callable(model_dump):
+            return None
         try:
             block_dict = model_dump(exclude_none=True)
         except Exception as e:
             log_warning(f"Failed to serialize Anthropic content block of type {type(item).__name__}: {e}")
             return None
-        if isinstance(block_dict, dict) and block_dict.get("type"):
-            return block_dict
-    return None
+    if not isinstance(block_dict, dict) or not block_dict.get("type"):
+        return None
+    if block_dict["type"] == "text" and isinstance(block_dict.get("citations"), list):
+        # Document titles are required but nullable. Restore nulls dropped by
+        # exclude_none above or by earlier versions, without mutating stored history.
+        block_dict = {
+            **block_dict,
+            "citations": [
+                {"document_title": None, **citation}
+                if isinstance(citation, dict)
+                and citation.get("type") in ("page_location", "char_location", "content_block_location")
+                else citation
+                for citation in block_dict["citations"]
+            ],
+        }
+    return block_dict
 
 
 _ANTHROPIC_THINKING_BLOCK_TYPES = ("thinking", "redacted_thinking")
```

**File**: `libs/agno/tests/unit/models/anthropic/test_citation_replay.py` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+"""Document citations need a document_title key even when the title is null."""
+
+import json
+
+import pytest
+
+pytest.importorskip("anthropic")
+
+from anthropic.lib.streaming import MessageStopEvent
+from anthropic.types import Message as AnthropicMessage
+from anthropic.types import TextBlock, ThinkingBlock, Usage
+
+from agno.models.anthropic.claude import Claude
+from agno.models.message import Message
+from agno.utils.models.claude import format_messages
+
+
+@pytest.fixture(
+    params=[
+        {"type": "page_location", "start_page_number": 1, "end_page_number": 2},
+        {"type": "char_location", "start_char_index": 0, "end_char_index": 6},
+        {"type": "content_block_location", "start_block_index": 0, "end_block_index": 1},
+    ],
+    ids=["page", "char", "content_block"],
+)
+def citation(request):
+    return {"cited_text": "Sample", "document_index": 0, **request.param}
+
+
+@pytest.mark.parametrize("streaming", [False, True], ids=["response", "stream"])
+@pytest.mark.parametrize("title", [None, "Report"], ids=["null_title", "named_title"])
+def test_response_citations_keep_required_title_through_storage_and_replay(citation, streaming, title):
+    expected_citation = {**citation, "document_title": title}
+    response = AnthropicMessage(
+        id="msg_citation",
+        model="claude-sonnet-4-5",
+        role="assistant",
+        type="message",
+        stop_reason="end_turn",
+        usage=Usage(input_tokens=1, output_tokens=1),
+        content=[
+            ThinkingBlock(type="thinking", thinking="Read the document.", signature="signed-thinking"),
+            TextBlock(type="text", text="A citation.", citations=[expected_citation]),
+        ],
+    )
+    model = Claude(id="claude-sonnet-4-5", api_key="test-key")
+    if streaming:
+        parsed = model._parse_provider_response_delta(MessageStopEvent(type="message_stop", message=response))
+    else:
+        parsed = model._parse_provider_response(response)
+
+    # Exercise the persisted representation, not just the SDK's in-memory block.
+    stored = json.loads(json.dumps(parsed.provider_data))
+    assert stored["content_blocks"][1]["citations"] == [expected_citation]
+    assistant = Message(role="assistant", content=parsed.content, provider_data=stored)
+    messages, _ = format_messages([Message(role="user", content="Summarize."), assistant])
+
+    assert messages[1]["content"] == [
+        {"type": "thinking", "thinking": "Read the document.", "signature": "signed-thinking"},
+        {"type": "text", "text": "A citation.", "citations": [expected_citation]},
+    ]
+
+
+@pytest.mark.parametrize("storage", ["provider_data", "content"])
+def test_replay_restores_title_in_old_history_without_mutating_it(citation, storage):
+    blocks = [{"type": "text", "text": "A citation.", "citations": [citation]}]
+    original = json.loads(json.dumps(blocks))
+    if storage == "provider_data":
+        assistant = Message(role="assistant", content="A citation.", provider_data={"content_blocks": blocks})
+    else:
+        assistant = Message(role="assistant", content=blocks)
+
+    messages, _ = format_messages([Message(role="user", content="Summarize."), assistant])
+    assert messages[1]["content"] == [
+        {"type": "text", "text": "A citation.", "citations": [{**citation, "document_title": None}]},
+    ]
+    assert blocks == original
+    replayed_again, _ = format_messages([Message(role="user", content="Summarize."), assistant])
+    assert replayed_again == messages
+
+
+def test_replay_does_not_add_document_title_to_web_citations():
+    citation = {
+        "type": "web_search_result_location",
+        "cited_text": "Sample",
+        "encrypted_index": "encrypted-index",
+        "url": "https://example.com/report",
+        "title": "Report",
+    }
+    block = {"type": "text", "text": "A web citation.", "citations": [citation]}
+    assistant = Message(role="assistant", content="A web citation.", provider_data={"content_blocks": [block]})
+
+    messages, _ = format_messages([Message(role="user", content="Summarize."), assistant])
+    assert messages[1]["content"] == [block]
```

---

### Incident Patch 13: `087691ec` (2026-09-25)
**Commit Message**: [fix] Honor explicit zero tail in shell and workspace command tools (#10593)

## Summary

Fixes #10592.

`ShellTools.run_shell_command`, `agno.utils.shell.run_shell_command`,
and `Workspace.run_command` / `arun_command` slice command output with
`[-tail:]`. For an explicit `tail=0` that slice becomes `[-0:]` == the
whole list, so asking for zero lines returns **all** output. Guard the
slice with `tail > 0` so `0` returns an empty string, mirroring the
explicit-zero semantics #10492 established for
`CsvTools.read_csv_file(row_limit=0)` (and proposed for these same sites
in closed PR #8987). Positive tails and all error paths keep their
current behavior.

Sites changed:
- `libs/agno/agno/tools/shell.py` (`run_shell_command`)
- `libs/agno/agno/utils/shell.py` (`run_shell_command`)
- `libs/agno/agno/tools/workspace.py` (`run_command` stdout + error
paths, `arun_command` stdout + error paths)

## Type of change

- [x] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Improvement
- [ ] Model update
- [ ] Other:

## Checklist

- [x] Code complies with style guidelines
- [x] Ran format/validation scripts (ruff 0.15.20 check + format on the
touched files)
- [x] Self-review completed
- [

**File**: `libs/agno/agno/tools/shell.py` (modified, +2/-1)
```diff
@@ -62,7 +62,8 @@ def run_shell_command(self, args: List[str], tail: int = 100) -> str:
             log_debug(f"Return code: {result.returncode}")
             if result.returncode != 0:
                 return f"Error: {result.stderr}"
-            return "\n".join(result.stdout.split("\n")[-tail:])
+            # tail=0 asks for no lines; [-0:] would return the whole output.
+            return "\n".join(result.stdout.split("\n")[-tail:]) if tail > 0 else ""
         except Exception as e:
             log_warning(f"Failed to run shell command: {str(e)}")
             return f"Error: {e}"
```

**File**: `libs/agno/agno/tools/workspace.py` (modified, +5/-4)
```diff
@@ -1038,9 +1038,10 @@ def run_command(self, args: List[str], tail: int = 100, timeout: int = 120) -> s
                 timeout=timeout,
             )
             if result.returncode != 0:
-                err = "\n".join(_strip_ansi(result.stderr).splitlines()[-tail:])
+                # tail=0 asks for no lines; [-0:] would return the whole output.
+                err = "\n".join(_strip_ansi(result.stderr).splitlines()[-tail:]) if tail > 0 else ""
                 return f"Error (exit {result.returncode}): {err}"
-            return "\n".join(_strip_ansi(result.stdout).splitlines()[-tail:])
+            return "\n".join(_strip_ansi(result.stdout).splitlines()[-tail:]) if tail > 0 else ""
         except subprocess.TimeoutExpired:
             log_warning(f"run_command timed out after {timeout}s: {args}")
             return f"Error: command timed out after {timeout} seconds"
@@ -1119,9 +1120,9 @@ async def arun_command(self, args: List[str], tail: int = 100, timeout: int = 12
             stdout = stdout_b.decode("utf-8", errors="replace") if stdout_b else ""
             stderr = stderr_b.decode("utf-8", errors="replace") if stderr_b else ""
             if proc.returncode != 0:
-                err = "\n".join(_strip_ansi(stderr).splitlines()[-tail:])
+                err = "\n".join(_strip_ansi(stderr).splitlines()[-tail:]) if tail > 0 else ""
                 return f"Error (exit {proc.returncode}): {err}"
-            return "\n".join(_strip_ansi(stdout).splitlines()[-tail:])
+            return "\n".join(_strip_ansi(stdout).splitlines()[-tail:]) if tail > 0 else ""
         except Exception as e:
             log_warning(f"arun_command failed: {e}")
             return f"Error running command: {e}"
```

**File**: `libs/agno/agno/utils/shell.py` (modified, +3/-2)
```diff
@@ -15,8 +15,9 @@ def run_shell_command(args: List[str], tail: int = 100) -> str:
         if result.returncode != 0:
             return f"Error: {result.stderr}"
 
-        # return only the last n lines of the output
-        return "\n".join(result.stdout.split("\n")[-tail:])
+        # return only the last n lines of the output; tail=0 returns nothing
+        # ([-0:] would return the whole output).
+        return "\n".join(result.stdout.split("\n")[-tail:]) if tail > 0 else ""
     except Exception as e:
         log_warning(f"Failed to run shell command: {str(e)}")
         return f"Error: {e}"
```

**File**: `libs/agno/tests/unit/tools/test_shell_tools.py` (modified, +31/-0)
```diff
@@ -6,6 +6,7 @@
 kwargs passthrough against regressions.
 """
 
+import sys
 import tempfile
 
 from agno.tools.shell import ShellTools
@@ -28,3 +29,33 @@ def test_requires_confirmation_tools_gates_run_shell_command():
     """The documented HITL pattern marks run_shell_command for confirmation."""
     tools = ShellTools(requires_confirmation_tools=["run_shell_command"])
     assert tools.functions["run_shell_command"].requires_confirmation is True
+
+
+def test_run_shell_command_zero_tail_returns_empty():
+    """tail=0 asks for no lines; [-0:] slicing returns the whole output instead."""
+    with tempfile.TemporaryDirectory() as tmp_dir:
+        tools = ShellTools(base_dir=tmp_dir)
+        out = tools.run_shell_command(
+            [sys.executable, "-c", "import sys; sys.stdout.write(chr(97) + chr(10) + chr(98) + chr(10) + chr(99))"],
+            tail=0,
+        )
+        assert out == ""
+
+
+def test_run_shell_command_positive_tail_returns_last_lines():
+    with tempfile.TemporaryDirectory() as tmp_dir:
+        tools = ShellTools(base_dir=tmp_dir)
+        out = tools.run_shell_command(
+            [sys.executable, "-c", "import sys; sys.stdout.write(chr(97) + chr(10) + chr(98) + chr(10) + chr(99))"],
+            tail=2,
+        )
+        assert out == "b" + chr(10) + "c"
+
+
+def test_utils_shell_zero_tail_returns_empty():
+    from agno.utils.shell import run_shell_command as util_run_shell_command
+
+    out = util_run_shell_command(
+        [sys.executable, "-c", "import sys; sys.stdout.write(chr(97) + chr(10) + chr(98) + chr(10) + chr(99))"], tail=0
+    )
+    assert out == ""
```

**File**: `libs/agno/tests/unit/tools/test_workspace.py` (modified, +38/-0)
```diff
@@ -1693,3 +1693,41 @@ def test_empty_deny_list_with_only_exemptions_excludes_nothing():
         _write(base, ".env", "SECRET=1\n")
         ws = Workspace(tmp_dir, exclude_patterns=["!.env.example"])
         assert "SECRET=1" in ws.read_file(".env")
+
+
+# ------------------------------------------------------------------
+# run_command / arun_command: explicit zero tail tests
+# ------------------------------------------------------------------
+
+
+def test_run_command_zero_tail_returns_empty():
+    """tail=0 asks for no lines; [-0:] slicing returns the whole output instead."""
+    with tempfile.TemporaryDirectory() as tmp_dir:
+        ws = Workspace(tmp_dir)
+        out = ws.run_command(
+            [sys.executable, "-c", "import sys; sys.stdout.write(chr(97) + chr(10) + chr(98) + chr(10) + chr(99))"],
+            tail=0,
+        )
+        assert out == ""
+
+
+def test_run_command_positive_tail_returns_last_lines():
+    with tempfile.TemporaryDirectory() as tmp_dir:
+        ws = Workspace(tmp_dir)
+        out = ws.run_command(
+            [sys.executable, "-c", "import sys; sys.stdout.write(chr(97) + chr(10) + chr(98) + chr(10) + chr(99))"],
+            tail=2,
+        )
+        assert out == "b" + chr(10) + "c"
+
+
+def test_arun_command_zero_tail_returns_empty():
+    with tempfile.TemporaryDirectory() as tmp_dir:
+        ws = Workspace(tmp_dir)
+        out = asyncio.run(
+            ws.arun_command(
+                [sys.executable, "-c", "import sys; sys.stdout.write(chr(97) + chr(10) + chr(98) + chr(10) + chr(99))"],
+                tail=0,
+            )
+        )
+        assert out == ""
```

---

### Incident Patch 14: `9f697b2d` (2026-09-25)
**Commit Message**: fix: store raw video bytes in GeminiTools.generate_video artifact (#10554)

## Summary

`GeminiTools.generate_video` built the returned `Video` artifact with
base64 **text** instead of the raw video bytes
(`libs/agno/agno/tools/models/gemini.py:186`):

```python
content=base64.b64encode(generated_video.video_bytes).decode("utf-8"),
```

`agno.media.Video.content` is declared `Optional[bytes]` ("Raw video
bytes"), so Pydantic coerced that string into the UTF-8 bytes of the
base64 text. Every consumer of `Video.get_content_bytes()` — media
offload uploads, writing the artifact to disk — then received base64
text instead of the video.

This PR passes the raw bytes instead, matching the `generate_image`
branch in the same toolkit and the other video toolkits (`opencv.py`,
`fal.py`, `minimax.py`, `replicate.py`, `wavespeed.py`, `lumalab.py`),
and drops the now-unused `base64` import.

Issue number: #10550

## Type of change

- [x] Bug fix

---

## Checklist

- [x] Code complies with style guidelines
- [x] Ran format/validation scripts (`./scripts/format.sh` and
`./scripts/validate.sh`)
- [x] Self-review completed
- [x] Documentation updated (comments, docstrings)
- [ ] Examples and guid

**File**: `cookbook/91_tools/models/gemini_video_generation.py` (modified, +5/-5)
```diff
@@ -12,10 +12,11 @@
 Run `uv pip install google-genai agno` to install the necessary dependencies.
 """
 
+from pathlib import Path
+
 from agno.agent import Agent
 from agno.models.openai import OpenAIChat
 from agno.tools.models.gemini import GeminiTools
-from agno.utils.media import save_base64_data
 
 # ---------------------------------------------------------------------------
 # Create Agent
@@ -38,7 +39,6 @@
     if response and response.videos:
         for video in response.videos:
             if video.content:
-                save_base64_data(
-                    base64_data=str(video.content),
-                    output_path=f"tmp/cat_driving_{video.id}.mp4",
-                )
+                output_path = Path(f"tmp/cat_driving_{video.id}.mp4")
+                output_path.parent.mkdir(parents=True, exist_ok=True)
+                output_path.write_bytes(video.content)
```

**File**: `libs/agno/agno/tools/models/gemini.py` (modified, +2/-3)
```diff
@@ -1,4 +1,3 @@
-import base64
 import time
 from os import getenv
 from typing import Any, Optional
@@ -180,10 +179,10 @@ def generate_video(
 
                 media_id = str(uuid4())
 
-                # Create VideoArtifact with base64 encoded content
+                # Create VideoArtifact with raw bytes
                 video_artifact = Video(
                     id=media_id,
-                    content=base64.b64encode(generated_video.video_bytes).decode("utf-8"),
+                    content=generated_video.video_bytes,
                     original_prompt=prompt,
                     mime_type=generated_video.mime_type or "video/mp4",
                 )
```

**File**: `libs/agno/tests/unit/tools/models/test_gemini.py` (modified, +3/-5)
```diff
@@ -256,11 +256,9 @@ def test_generate_video_success(mock_gemini_tools, mock_agent, mock_video_operat
         assert video_artifact.original_prompt == prompt
         assert video_artifact.mime_type == "video/mp4"
 
-        import base64
-
-        expected_base64_string = base64.b64encode(b"fake_video_bytes").decode("utf-8")
-        expected_content = expected_base64_string.encode("utf-8")  # Convert string to UTF-8 bytes
-        assert video_artifact.content == expected_content
+        # The artifact carries the raw video bytes, not the base64 text encoding of them
+        assert video_artifact.content == b"fake_video_bytes"
+        assert video_artifact.get_content_bytes() == b"fake_video_bytes"
 
         assert mock_gemini_tools.client.models.generate_videos.called
         call_args = mock_gemini_tools.client.models.generate_videos.call_args
```

---

### Incident Patch 15: `0a9043c7` (2026-09-25)
**Commit Message**: fix: reject an overlap that is not smaller than the chunk size (#10321)

Fixes #10347

## Summary

`DocumentChunking` did not validate its `overlap` argument, while
`FixedSizeChunking` and `RecursiveChunking` raise for `overlap >=
chunk_size`. The invalid configuration was accepted and silently
produced chunks longer than the configured `chunk_size`:

```python
from agno.knowledge.chunking.document import DocumentChunking
from agno.knowledge.document.base import Document

text = ("Para one. " * 20) + "\n\n" + ("Para two. " * 20)
chunks = DocumentChunking(chunk_size=100, overlap=150).chunk(Document(name="d", content=text))
print([len(c.content) for c in chunks])
# before: [206, 206, 206, 161]   chunk_size=100
# after:  ValueError: Invalid parameters: overlap (150) must be less than chunk size (100).
```

The same arguments on `FixedSizeChunking` and `RecursiveChunking` raise
`ValueError`, so the three strategies disagreed on what a valid overlap
is. This is not the oversized-content case tracked in #10187 / #10188:
here the arguments are invalid rather than the text.

(If applicable, issue number: none — no issue was filed for this.)

## Type of change

- [x] Bug fix
- [ ] New featu

**File**: `libs/agno/agno/knowledge/chunking/document.py` (modified, +4/-0)
```diff
@@ -8,6 +8,10 @@ class DocumentChunking(ChunkingStrategy):
     """A chunking strategy that splits text based on document structure like paragraphs and sections"""
 
     def __init__(self, chunk_size: int = 5000, overlap: int = 0):
+        # overlap must be less than chunk size
+        if overlap >= chunk_size:
+            raise ValueError(f"Invalid parameters: overlap ({overlap}) must be less than chunk size ({chunk_size}).")
+
         self.chunk_size = chunk_size
         self.overlap = overlap
 
```

**File**: `libs/agno/tests/unit/knowledge/chunking/test_overlap_validation.py` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+"""Chunking strategies agree on which overlap values are invalid."""
+
+import pytest
+
+from agno.knowledge.chunking.document import DocumentChunking
+from agno.knowledge.chunking.fixed import FixedSizeChunking
+from agno.knowledge.chunking.recursive import RecursiveChunking
+from agno.knowledge.document.base import Document
+
+STRATEGIES = [DocumentChunking, FixedSizeChunking, RecursiveChunking]
+
+
+@pytest.mark.parametrize("strategy", STRATEGIES)
+@pytest.mark.parametrize("overlap", [100, 150])
+def test_overlap_not_smaller_than_chunk_size_is_rejected(strategy, overlap):
+    """An overlap of chunk_size or more is rejected instead of overshooting it."""
+    with pytest.raises(ValueError, match="must be less than chunk size"):
+        strategy(chunk_size=100, overlap=overlap)
+
+
+@pytest.mark.parametrize("strategy", STRATEGIES)
+def test_largest_valid_overlap_still_chunks(strategy):
+    """The largest valid overlap is accepted and returns chunks."""
+    chunker = strategy(chunk_size=100, overlap=99)
+
+    chunks = chunker.chunk(Document(name="doc", content="word " * 100))
+
+    assert chunks
+    assert all(chunk.content for chunk in chunks)
```

#### Recent Merged Pull Requests:
- **PR #10811** (closed): [fix] Verify and paginate PR triage issue references (@mikamikasuki)
- **PR #10796** (closed): fix(db): ensure atomic JsonDb writes to prevent table truncation on failure (@neoand)
- **PR #10788** (2026-10-05): [cookbook] Fix DynamoDb import path in the DynamoDB cookbook README (@Xx-173)
- **PR #10784** (closed): [feat] Add String Web Access tools (@asavor)
- **PR #10779** (2026-10-05): [fix] Read text and Markdown streams with non-string names (@pei711)
- **PR #10746** (closed): [fix] Ignore non-finite timestamps during recency reranking (@cyyecao-lappland)
- **PR #10736** (2026-10-02): chore: Release v3.1.1 (@kausmeows)
- **PR #10730** (2026-10-02): fix: retry transient page fetch failures with backoff (@kausmeows)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
