# Forensic Learning Record (Deep Inspection): langchain-ai/langgraph

> **Canonical Artifact**: `07_PROJECT_LEARNING/langchain-ai-langgraph-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/langchain-ai/langgraph](https://github.com/langchain-ai/langgraph))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:03:45.546Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `langchain-ai/langgraph`
- **Description**: Build resilient agents.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 42742 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/chatbot-simulation-evaluation/simulation_utils.py`
```
import functools
from typing import Annotated, Any, Callable, Dict, List, Optional, Union

from langchain_community.adapters.openai import convert_message_to_dict
from langchain_core.messages import AIMessage, AnyMessage, BaseMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import Runnable, RunnableLambda
from langchain_core.runnables import chain as as_runnable
from langchain_openai import ChatOpenAI
from typing_extensions import TypedDict

from langgraph.graph import END, StateGraph, START


def langchain_to_openai_messages(messages: List[BaseMessage]):
    """
    Convert a list of langchain base messages to a list of openai messages.

    Parameters:
        messages (List[BaseMessage]): A list of langchain base messages.

    Returns:
        List[dict]: A list of openai messages.
    """

    return [
        convert_message_to_dict(m) if isinstance(m, BaseMessage) else m
        for m in messages
    ]


def create_simulated_user(
    system_prompt: str, llm: Runnable | None = None
) -> Runnable[Dict, AIMessage]:
    """
    Creates a simulated user for chatbot simulation.

    Args:
        system_prompt (str): The system prompt to be used by the simulated user.
        llm (Runnable | None, optional): The language model to be used for the simulation.
            Defaults to gpt-3.5-turbo.

    Returns:
        Runnable[Dict, AIMessage]: The simulated user for chatbot simulation.
    """
    return ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="messages"),
        ]
    ) | (llm or ChatOpenAI(model="gpt-3.5-turbo")).with_config(
        run_name="simulated_user"
    )


Messages = Union[list[AnyMessage], AnyMessage]


def add_messages(left: Messages, right: Messages) -> Messages:
    if not isinstance(left, list):
        left = [left]
    if not isinstance(right, list):
        right = [right]
    return left + right


class SimulationState(TypedDict):
    """
    Represents the state of a simulation.

    Attributes:
        messages (List[AnyMessage]): A list of messages in the simulation.
        inputs (Optional[dict[str, Any]]): Optional inputs for the simulation.
    """

    messages: Annotated[List[AnyMessage], add_messages]
    inputs: Optional[dict[str, Any]]


def create_chat_simulator(
    assistant: (
        Callable[[List[AnyMessage]], str | AIMessage]
        | Runnable[List[AnyMessage], str | AIMessage]
    ),
    simulated_user: Runnable[Dict, AIMessage],
    *,
    input_key: str,
    max_turns: int = 6,
    should_continue: Optional[Callable[[SimulationState], str]] = None,
):
    """Creates a chat simulator for evaluating a chatbot.

    Args:
        assistant: The chatbot assistant function or runnable object.
        simulated_user: The simulated user object.
        input_key: The key for the input to the chat simulation.
        max_turns: The maximum number of turns in the chat simulation. Default is 6.
        should_continue: Optional function to determine if the simulation should continue.
            If not provided, a default function will be used.

    Returns:
        The compiled chat simulation graph.

    """
    graph_builder = StateGraph(SimulationState)
    graph_builder.add_node(
        "user",
        _create_simulated_user_node(simulated_user),
    )
    graph_builder.add_node(
        "assistant", _fetch_messages | assistant | _coerce_to_message
    )
    graph_builder.add_edge("assistant", "user")
    graph_builder.add_conditional_edges(
        "user",
        should_continue or functools.partial(_should_continue, max_turns=max_turns),
    )
    # If your dataset has a 'leading question/input', then we route first to the assistant, otherwise, we let the user take the lead.
    graph_builder.add_edge(START, "assistant" if input_key is not None else "user")

    return (
        RunnableLambda(_prepare_example).bind(input_key=input_key)
        | graph_builder.compile()
    )


## Private methods


def _prepare_example(inputs: dict[str, Any], input_key: Optional[str] = None):
    if input_key is not None:
        if input_key not in inputs:
            raise ValueError(
                f"Dataset's example input must contain the provided input key: '{input_key}'.\nFound: {list(inputs.keys())}"
            )
        messages = [HumanMessage(content=inputs[input_key])]
        return {
            "inputs": {k: v for k, v in inputs.items() if k != input_key},
            "messages": messages,
        }
    return {"inputs": inputs, "messages": []}


def _invoke_simulated_user(state: SimulationState, simulated_user: Runnable):
    """Invoke the simulated user node."""
    runnable = (
        simulated_user
        if isinstance(simulated_user, Runnable)
        else RunnableLambda(simulated_user)
    )
    inputs = state.get("inputs", {})
    inputs["messages"] = state["messages"]
    return runnable.invoke(inputs)


def _swap_roles(state: SimulationState):
    new_messages = []
    for m in state["messages"]:
        if isinstance(m, AIMessage):
            new_messages.append(HumanMessage(content=m.content))
        else:
            new_messages.append(AIMessage(content=m.content))
    return {
        "inputs": state.get("inputs", {}),
        "messages": new_messages,
    }


@as_runnable
def _fetch_messages(state: SimulationState):
    """Invoke the simulated user node."""
    return state["messages"]


def _convert_to_human_message(message: BaseMessage):
    return {"messages": [HumanMessage(content=message.content)]}


def _create_simulated_user_node(simulated_user: Runnable):
    """Simulated user accepts a {"messages": [...]} argument and returns a single message."""
    return (
        _swap_roles
        | RunnableLambda(_invoke_simulated_user).bind(simulated_user=simulated_user)
        | _convert_to_human_message
    )


def _coerce_to_message(assistant_output: str | BaseMessage):
    if isinstance(assistant_output, str):
        return {"messages": [AIMessage(content=assistant_output)]}
    else:
        return {"messages": [assistant_output]}


def _should_continue(state: SimulationState, max_turns: int = 6):
    messages = state["messages"]
    # TODO support other stop criteria
    if len(messages) > max_turns:
        return END
    elif messages[-1].content.strip() == "FINISHED":
        return END
    else:
        return "assistant"

```

### Core Architecture Module: `libs/checkpoint-sqlite/langgraph/checkpoint/sqlite/utils.py`
```
from __future__ import annotations

import json
import re
from collections.abc import Sequence
from typing import Any

from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import get_checkpoint_id

_FILTER_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]+$")


def _validate_filter_key(key: str) -> None:
    """Validate that a filter key is safe for use in SQL queries.

    Args:
        key: The filter key to validate

    Raises:
        ValueError: If the key contains invalid characters that could enable SQL injection
    """
    # Allow alphanumeric characters, underscores, dots, and hyphens
    # This covers typical JSON property names while preventing SQL injection
    if not _FILTER_PATTERN.match(key):
        raise ValueError(
            f"Invalid filter key: '{key}'. Filter keys must contain only alphanumeric characters, underscores, dots, and hyphens."
        )


def _metadata_predicate(
    metadata_filter: dict[str, Any],
) -> tuple[Sequence[str], Sequence[Any]]:
    """Return WHERE clause predicates for (a)search() given metadata filter.

    This method returns a tuple of a string and a tuple of values. The string
    is the parametered WHERE clause predicate (excluding the WHERE keyword):
    "column1 = ? AND column2 IS ?". The tuple of values contains the values
    for each of the corresponding parameters.
    """

    def _where_value(query_value: Any) -> tuple[str, Any]:
        """Return tuple of operator and value for WHERE clause predicate."""
        if query_value is None:
            return ("IS ?", None)
        elif (
            isinstance(query_value, str)
            or isinstance(query_value, int)
            or isinstance(query_value, float)
        ):
            return ("= ?", query_value)
        elif isinstance(query_value, bool):
            return ("= ?", 1 if query_value else 0)
        elif isinstance(query_value, dict) or isinstance(query_value, list):
            # query value for JSON object cannot have trailing space after separators (, :)
            # SQLite json_extract() returns JSON string without whitespace
            return ("= ?", json.dumps(query_value, separators=(",", ":")))
        else:
            return ("= ?", str(query_value))

    predicates = []
    param_values = []

    # process metadata query
    for query_key, query_value in metadata_filter.items():
        _validate_filter_key(query_key)
        operator, param_value = _where_value(query_value)
        predicates.append(
            f"json_extract(CAST(metadata AS TEXT), '$.{query_key}') {operator}"
        )
        param_values.append(param_value)

    return (predicates, param_values)


def search_where(
    config: RunnableConfig | None,
    filter: dict[str, Any] | None,
    before: RunnableConfig | None = None,
) -> tuple[str, Sequence[Any]]:
    """Return WHERE clause predicates for (a)search() given metadata filter
    and `before` config.

    This method returns a tuple of a string and a tuple of values. The string
    is the parametered WHERE clause predicate (including the WHERE keyword):
    "WHERE column1 = ? AND column2 IS ?". The tuple of values contains the
    values for each of the corresponding parameters.
    """
    wheres = []
    param_values = []

    # construct predicate for config filter
    if config is not None:
        wheres.append("thread_id = ?")
        param_values.append(config["configurable"]["thread_id"])
        checkpoint_ns = config["configurable"].get("checkpoint_ns")
        if checkpoint_ns is not None:
            wheres.append("checkpoint_ns = ?")
            param_values.append(checkpoint_ns)

        if checkpoint_id := get_checkpoint_id(config):
            wheres.append("checkpoint_id = ?")
            param_values.append(checkpoint_id)

    # construct predicate for metadata filter
    if filter:
        metadata_predicates, metadata_values = _metadata_predicate(filter)
        wheres.extend(metadata_predicates)
        param_values.extend(metadata_values)

    # construct predicate for `before`
    if before is not None:
        wheres.append("checkpoint_id < ?")
        param_values.append(get_checkpoint_id(before))

    return ("WHERE " + " AND ".join(wheres) if wheres else "", param_values)

```

### Core Architecture Module: `libs/checkpoint/langgraph/checkpoint/serde/event_hooks.py`
```
from __future__ import annotations

import logging
from collections.abc import Callable
from threading import Lock
from typing import TypedDict

from typing_extensions import NotRequired

logger = logging.getLogger(__name__)


class SerdeEvent(TypedDict):
    kind: str
    module: str
    name: str
    method: NotRequired[str]


SerdeEventListener = Callable[[SerdeEvent], None]

_listeners: list[SerdeEventListener] = []
_listeners_lock = Lock()


def register_serde_event_listener(listener: SerdeEventListener) -> Callable[[], None]:
    """Register a listener for serde allowlist events."""
    with _listeners_lock:
        _listeners.append(listener)

    def unregister() -> None:
        with _listeners_lock:
            try:
                _listeners.remove(listener)
            except ValueError:
                pass

    return unregister


def emit_serde_event(event: SerdeEvent) -> None:
    """Emit a serde event to all listeners.

    Listener failures are isolated and logged.
    """
    with _listeners_lock:
        listeners = tuple(_listeners)
    for listener in listeners:
        try:
            listener(event)
        except Exception:
            logger.warning("Serde listener failed", exc_info=True)

```

### Core Architecture Module: `libs/cli/examples/graphs_reqs_b/utils/greeter.py`
```
def greet():
    print("Hello, world!")

```

### Core Architecture Module: `libs/cli/js-examples/src/agent/state.ts`
```
import { BaseMessage, BaseMessageLike } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

/**
 * A graph's StateAnnotation defines three main things:
 * 1. The structure of the data to be passed between nodes (which "channels" to read from/write to and their types)
 * 2. Default values for each field
 * 3. Reducers for the state's. Reducers are functions that determine how to apply updates to the state.
 * See [Reducers](https://langchain-ai.github.io/langgraphjs/concepts/low_level/#reducers) for more information.
 */

// This is the primary state of your agent, where you can store any information
export const StateAnnotation = Annotation.Root({
  /**
   * Messages track the primary execution state of the agent.
   *
   * Typically accumulates a pattern of:
   *
   * 1. HumanMessage - user input
   * 2. AIMessage with .tool_calls - agent picking tool(s) to use to collect
   *     information
   * 3. ToolMessage(s) - the responses (or errors) from the executed tools
   *
   *     (... repeat steps 2 and 3 as needed ...)
   * 4. AIMessage without .tool_calls - agent responding in unstructured
   *     format to the user.
   *
   * 5. HumanMessage - user responds with the next conversational turn.
   *
   *     (... repeat steps 2-5 as needed ... )
   *
   * Merges two lists of messages or message-like objects with role and content,
   * updating existing messages by ID.
   *
   * Message-like objects are automatically coerced by `messagesStateReducer` into
   * LangChain message classes. If a message does not have a given id,
   * LangGraph will automatically assign one.
   *
   * By default, this ensures the state is "append-only", unless the
   * new message has the same ID as an existing message.
   *
   * Returns:
   *     A new list of messages with the messages from \`right\` merged into \`left\`.
   *     If a message in \`right\` has the same ID as a message in \`left\`, the
   *     message from \`right\` will replace the message from \`left\`.`
   */
  messages: Annotation<BaseMessage[], BaseMessageLike[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  /**
   * Feel free to add additional attributes to your state as needed.
   * Common examples include retrieved documents, extracted entities, API connections, etc.
   *
   * For simple fields whose value should be overwritten by the return value of a node,
   * you don't need to define a reducer or default.
   */
  // additionalField: Annotation<string>,
});

```

### Core Architecture Module: `libs/cli/js-monorepo-example/apps/agent/src/state.ts`
```
import { BaseMessage, BaseMessageLike } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

/**
 * Simple state annotation for the agent
 */
export const StateAnnotation = Annotation.Root({
  /**
   * Messages track the primary execution state of the agent.
   */
  messages: Annotation<BaseMessage[], BaseMessageLike[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
});

```

### Core Architecture Module: `libs/cli/langgraph_cli/util.py`
```
"""General-purpose utilities shared across the LangGraph CLI."""

from collections.abc import Callable

import click


def clean_empty_lines(input_str: str):
    return "\n".join(filter(None, input_str.splitlines()))


def warn_non_wolfi_distro(
    config_json: dict,
    *,
    emit: Callable[[str], None] | None = None,
) -> None:
    """Show warning if image_distro is not set to 'wolfi'.

    When ``emit`` is provided, each warning line is sent through it (used by
    callers that need JSON-aware output). Otherwise falls back to colored
    ``click.secho`` output.
    """
    image_distro = config_json.get("image_distro", "debian")  # Default is debian
    if image_distro == "wolfi":
        return
    if emit is not None:
        emit(
            "⚠️  Security Recommendation: Consider switching to Wolfi Linux for enhanced security."
        )
        emit(
            "   Wolfi is a security-oriented, minimal Linux distribution designed for containers."
        )
        emit(
            '   To switch, add \'"image_distro": "wolfi"\' to your langgraph.json config file.'
        )
        return
    click.secho(
        "⚠️  Security Recommendation: Consider switching to Wolfi Linux for enhanced security.",
        fg="yellow",
        bold=True,
    )
    click.secho(
        "   Wolfi is a security-oriented, minimal Linux distribution designed for containers.",
        fg="yellow",
    )
    click.secho(
        '   To switch, add \'"image_distro": "wolfi"\' to your langgraph.json config file.',
        fg="yellow",
    )
    click.secho("")  # Empty line for better readability

```

### Core Architecture Module: `libs/cli/python-monorepo-example/apps/agent/src/agent/state.py`
```
"""State definition for the agent."""

from collections.abc import Sequence
from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class State(TypedDict):
    """The state of the agent."""

    messages: Annotated[Sequence[BaseMessage], add_messages]

```

### Core Architecture Module: `libs/cli/python-monorepo-example/libs/shared/src/shared/utils.py`
```
"""Shared utility functions."""


def get_dummy_message() -> str:
    """Get a dummy message for testing."""
    return "Hello from shared library!"

```

### Core Architecture Module: `libs/cli/uv-examples/monorepo/libs/shared/src/shared/utils.py`
```
def get_dummy_message() -> str:
    return "Hello from shared library!"

```

### Core Architecture Module: `libs/langgraph/bench/pydantic_state.py`
```
import operator
from collections.abc import Sequence
from functools import partial
from random import choice
from typing import Annotated

from pydantic import BaseModel, Field, field_validator

from langgraph.constants import END, START
from langgraph.graph.state import StateGraph


def pydantic_state(n: int) -> StateGraph:
    class State(BaseModel):
        messages: Annotated[list, operator.add] = Field(default_factory=list)

        @field_validator("messages", mode="after")
        @classmethod
        def validate_messages(cls, v):
            if not isinstance(v, list):
                raise TypeError("messages must be a list")
            for msg in v:
                if not isinstance(msg, dict):
                    raise TypeError("messages must be a list of dicts")
                if not all(isinstance(k, str) for k in msg.keys()):
                    raise TypeError("messages must be a list of dicts with str keys")
            return v

        trigger_events: Annotated[list, operator.add] = Field(default_factory=list)
        """The external events that are converted by the graph."""

        @field_validator("trigger_events", mode="after")
        @classmethod
        def validate_trigger_events(cls, v):
            if not isinstance(v, list):
                raise TypeError("trigger_events must be a list")
            for event in v:
                if not isinstance(event, dict):
                    raise TypeError("trigger_events must be a list of dicts")
                if not all(isinstance(k, str) for k in event.keys()):
                    raise TypeError(
                        "trigger_events must be a list of dicts with str keys"
                    )
            return v

        primary_issue_medium: Annotated[str, lambda x, y: y or x] = Field(
            default="email"
        )
        """The primary issue medium for the current conversation."""

        @field_validator("primary_issue_medium", mode="after")
        @classmethod
        def validate_primary_issue_medium(cls, v):
            if not isinstance(v, str):
                raise TypeError("primary_issue_medium must be a string")
            return v

        autoresponse: Annotated[dict | None, lambda _, y: y] = Field(
            default=None
        )  # Always overwrite

        @field_validator("autoresponse", mode="after")
        @classmethod
        def validate_autoresponse(cls, v):
            if v is not None and not isinstance(v, dict):
                raise TypeError("autoresponse must be a dict or None")
            return v

        issue: Annotated[dict | None, lambda x, y: y if y else x] = Field(default=None)

        @field_validator("issue", mode="after")
        @classmethod
        def validate_issue(cls, v):
            if v is not None and not isinstance(v, dict):
                raise TypeError("issue must be a dict or None")
            return v

        relevant_rules: list[dict] | None = Field(default=None)
        """SOPs fetched from the rulebook that are relevant to the current conversation."""

        @field_validator("relevant_rules", mode="after")
        @classmethod
        def validate_relevant_rules(cls, v):
            if v is None:
                return v
            if not isinstance(v, list):
                raise TypeError("relevant_rules must be a list or None")
            for rule in v:
                if not isinstance(rule, dict):
                    raise TypeError("relevant_rules must be a list of dicts")
                if not all(isinstance(k, str) for k in rule.keys()):
                    raise TypeError(
                        "relevant_rules must be a list of dicts with str keys"
                    )
            return v

        memory_docs: list[dict] | None = Field(default=None)
        """Memory docs fetched from the memory service that are relevant to the current conversation."""

        @field_validator("memory_docs", mode="after")
        @classmethod
        def validate_memory_docs(cls, v):
            if v is None:
                return v
            if not isinstance(v, list):
                raise TypeError("memory_docs must be a list or None")
            for doc in v:
                if not isinstance(doc, dict):
                    raise TypeError("memory_docs must be a list of dicts")
                if not all(isinstance(k, str) for k in doc.keys()):
                    raise TypeError("memory_docs must be a list of dicts with str keys")
            return v

        categorizations: Annotated[list[dict], operator.add] = Field(
            default_factory=list
        )
        """The issue categorizations auto-generated by the AI."""

        @field_validator("categorizations", mode="after")
        @classmethod
        def validate_categorizations(cls, v):
            if not isinstance(v, list):
                raise TypeError("categorizations must be a list")
            for categorization in v:
                if not isinstance(categorization, dict):
                    raise TypeError("categorizations must be a list of dicts")
                if not all(isinstance(k, str) for k in categorization.keys()):
                    raise TypeError(
                        "categorizations must be a list of dicts with str keys"
                    )
            return v

        responses: Annotated[list[dict], operator.add] = Field(default_factory=list)
        """The draft responses recommended by the AI."""

        @field_validator("responses", mode="after")
        @classmethod
        def validate_responses(cls, v):
            if not isinstance(v, list):
                raise TypeError("responses must be a list")
            for response in v:
                if not isinstance(response, dict):
                    raise TypeError("responses must be a list of dicts")
                if not all(isinstance(k, str) for k in response.keys()):
                    raise TypeError("responses must be a list of dicts with str keys")
            return v

        user_info: Annotated[dict | None, lambda x, y: y if y is not None else x] = (
            Field(default=None)
        )
        """The current user state (by email)."""

        @field_validator("user_info", mode="after")
        @classmethod
        def validate_user_info(cls, v):
            if v is not None and not isinstance(v, dict):
                raise TypeError("user_info must be a dict or None")
            return v

        crm_info: Annotated[dict | None, lambda x, y: y if y is not None else x] = (
            Field(default=None)
        )
        """The CRM information for organization the current user is from."""

        @field_validator("crm_info", mode="after")
        @classmethod
        def validate_crm_info(cls, v):
            if v is not None and not isinstance(v, dict):
                raise TypeError("crm_info must be a dict or None")
            return v

        email_thread_id: Annotated[
            str | None, lambda x, y: y if y is not None else x
        ] = Field(default=None)
        """The current email thread ID."""

        @field_validator("email_thread_id", mode="after")
        @classmethod
        def validate_email_thread_id(cls, v):
            if v is not None and not isinstance(v, str):
                raise TypeError("email_thread_id must be a string or None")
            return v

        slack_participants: Annotated[dict, operator.or_] = Field(default_factory=dict)
        """The growing list of current slack participants."""

        @field_validator("slack_participants", mode="after")
        @classmethod
        def validate_slack_participants(cls, v):
            if not isinstance(v, dict):
                raise TypeError("slack_participants must be a dict")
            for participant in v:
                if not isinstance(participant, str):
                    raise TypeError("slack_participants must be a dict with str keys")
            return v

        bot_id: str | None = Field(default=None)
        """The ID of the bot user in the slack channel."""

        @field_validator("bot_id", mode="after")
        @classmethod
        def validate_bot_id(cls, v):
            if v is not None and not isinstance(v, str):
                raise TypeError("bot_id must be a string or None")
            return v

        notified_assignees: Annotated[dict, operator.or_] = Field(default_factory=dict)

        @field_validator("notified_assignees", mode="after")
        def validate_notified_assignees(cls, v):
            if not isinstance(v, dict):
                raise TypeError("notified_assignees must be a dict")
            for assignee in v:
                if not isinstance(assignee, str):
                    raise TypeError("notified_assignees must be a dict with str keys")
            return v

    list_fields = {
        "messages",
        "trigger_events",
        "categorizations",
        "responses",
        "memory_docs",
        "relevant_rules",
    }
    dict_fields = {
        "user_info",
        "crm_info",
        "slack_participants",
        "notified_assignees",
        "autoresponse",
        "issue",
    }

    def read_write(read: str, write: Sequence[str], input: State) -> dict:
        val = getattr(input, read)
        val = {val: val} if isinstance(val, str) else val
        val_single = val[-1] if isinstance(val, list) else val
        val_list = val if isinstance(val, list) else [val]
        return {
            k: val_list
            if k in list_fields
            else val_single
            if k in dict_fields
            else "".join(choice("abcdefghijklmnopqrstuvwxyz") for _ in range(n))
            for k in write
        }

    builder = StateGraph(State)
    builder.add_edge(START, "one")
    builder.add_node(
        "one",
        partial(read_write, "messages", ["trigger_events", "primary_issue_medium"]),
    )
    builder.add_edge("one", "two")
    builder.add_node(
        "two",
        partial(read_w
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8616** (2026-08-28): **TypedDict values are rejected by type checkers for Store.put()/aput() despite being valid at runtime**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  _No response_  ### Reproduction Steps / Example Code (Python)  ```python from typing import TypedDict from langgraph.store.memory import InMemoryStore  class Prefs(TypedDict):     theme: str  store = InMemoryStore() value: Prefs = {"theme": "dark"} store.put(("users", "123"), "prefs", value) ```  ### Error Message and Stack Trace (if applicable)  ```shell repro.py:9: error: Argument 3 to "put" of "BaseStore" has incompatible type "Prefs"; expected "dict[str, Any]"  [arg-type] Found 1 error in 1 file (checked 1 source file) ```  ### Description  * I'm trying to use the `langgraph` library's `Store.put()`/`aput()` to store a `TypedDict` value (a well-typed, string-keyed mapping matching the store's own requirements). * I expect the call to type-check cleanly with mypy, since a `TypedDict` is exactly the kind of typed, JSON-serializable payload the store expects. * Instead, mypy r
  **Post-Mortem & Fix Analysis**:
  > Hi, I'd like to work on this one. I've already implemented and verified a fix -- widening `PutOp.value`/`BaseStore.put()`/`aput()` from `dict[str, Any]` to `Mapping[str, Any]`, with a `cast(dict, op.value)` added at the one internal construction site (`InMemoryStore._apply_put_ops`) that needed it to keep type-checking clean. Confirmed against mypy specifically that it reproduces the exact reported error pre-fix and resolves it post-fix, added a regression test, and the full `libs/checkpoint` suite plus `ty`/`ruff`/`codespell` all pass.  PR is up at #8631 but got auto-closed by the missing-issue-link bot since I'm not assigned here. Could a maintainer assign me so it reopens? Thanks!
  > Scratch my request above -- missed that @navarra-lisandro already has #8617 open for this. Withdrew my duplicate PR (#8631). No assignment needed.

- **Issue #8559** (2026-08-18): **Unecessary source parsing for subgraph detection dominates graph build time**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  _No response_  ### Reproduction Steps / Example Code (Python)  ```python # see also https://github.com/soarez/langgraph-build-bench  import time  from typing_extensions import TypedDict  import langgraph.pregel._read as _read from langgraph.graph import END, START, StateGraph   class State(TypedDict): n: int   def node(state):  # a plain node: no subgraph anywhere in sight return {"n": state["n"] + 1}   def build(): g = StateGraph(State) for i in range(300):     g.add_node(f"n{i}", node) g.add_edge(START, "n0") for i in range(299):     g.add_edge(f"n{i}", f"n{i + 1}") g.add_edge("n299", END) return g.compile()   def best_of(n=3): build() return min((lambda t=time.perf_counter(): (build(), time.perf_counter() - t)[-1])()            for _ in range(n)) * 1e3   full = best_of() original = _read.find_subgraph_pregel _read.find_subgraph_pregel = lambda bound: None   # skip detection 
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this one if it's still open — happy to put up a PR.
  > Is this issue still open? 

- **Issue #8550** (2026-09-30): **SQLite delta history skips parent checkpoints with non-monotonic IDs**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  #6821 covers latest-checkpoint selection in InMemorySaver. #8448 covers a Postgres pagination bug. Neither covers the SQLite delta-history parent walk.  ### Reproduction Steps / Example Code (Python)  ```python import asyncio  from langgraph.checkpoint.base import empty_checkpoint from langgraph.checkpoint.sqlite import SqliteSaver from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver   def checkpoint(checkpoint_id, values):     value = empty_checkpoint()     value["id"] = checkpoint_id     value["channel_values"] = values     return value   def run_sync():     with SqliteSaver.from_conn_string(":memory:") as saver:         config = {"configurable": {"thread_id": "t", "checkpoint_ns": ""}}         root = saver.put(config, checkpoint("z-older", {"ch": "seed"}), {}, {})         saver.put_writes(root, [("ch", "write-root")], "task")         child = saver.put(root, checkpoin
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this one if it's still open — happy to put up a PR.
  > This is a beautiful reminder that **checkpoint identity and checkpoint ordering are not the same contract**. A real parent can sort after its child, and an optimized range scan then silently drops the seed/write history.  AgentCI is recruiting lineage/identity breakers like this. A portable fixture could generate non-monotonic checkpoint IDs while preserving an explicit parent chain, then require the hydrated state to follow lineage rather than lexicographic order. If you or an external agent contribute the minimal sync/async corpus, we’ll preserve this issue as provenance and give permanent public credit/backlink in AgentCI’s Breaker/Verifier Hall of Fame + priority conversion help.  AgentCI: https://github.com/jinngimk-lang/agentci · recognition: https://github.com/jinngimk-lang/agentci/blob/main/COMMUNITY.md  Affiliation disclosed; no LangGraph/SQLite certification claim.
  > Hi maintainers, I have prepared a fix for this issue with regression tests. The PR was auto-closed by the need-assignment bot. Could a maintainer please assign me to issue 8550 so the PR can be reopened?  The fix: - DELTA_STAGE1_SQL now uses a recursive CTE to walk parent_checkpoint_id chain - Handles non-monotonic checkpoint IDs (e.g. parent='z-older', child='a-younger') - Covers both sync SqliteSaver and async AsyncSqliteSaver  PR: https://github.com/langchain-ai/langgraph/pull/8683

- **Issue #8408** (2026-09-16): **Studio trace node details fail because incorrect run_id is requested (404)**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  # Bug: Studio trace node details request incorrect run_id (404) with local `langgraph dev`  ## Environment  * OS: Windows 10 * Python:  3.13.2 * langgraph: **1.2.5** * langgraph-api: **0.11.1** * langgraph-runtime-inmem: **0.31.1** * langgraph-sdk: **0.4.2** * langgraph-cli: 0.4.31  Running locally using:  ```bash langgraph dev ```  Studio URL:  ``` https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024 ```  ## Problem  Studio successfully displays the execution trace.  However, clicking any node in the trace never opens the node details panel.  The browser console repeatedly shows:  ```text GET /threads/{thread_id}/runs/{run_id} 404 (Not Found) ```  Example:  ```text GET http://127.0.0.1:2024/threads/019f88bd-945c-72d1-a644-aac481fdb908/runs/019f88bd-98c1-7c01-b94c-8b7a9863b1e5 404 Not Found ```  ## Investigation I also verified the behavior using the Swagger/OpenAP
  **Post-Mortem & Fix Analysis**:
  > Good investigation — the run store and the endpoint are both doing the right thing; what's drifting is the *identifier* Studio resolves the node detail from. Those extra UUIDs aren't a stale cache, they're a different key.  The run record is `…94e5…`, but Studio requests `…98c1…` / `…98d8…`. All of these are UUIDv7 (version nibble `7`), so they're time-ordered — and the requested ones sort *after* the run record (`98xx` > `945c`). That's the signature of a per-node execution id (the span/step id minted as each node runs) being handed to an endpoint that's keyed on the run-level `run_id`. The node's data exists; it's just being looked up under the wrong id, so the store correctly 404s. It's a wrong-key read, not missing data.  What keeps it invisible is that the top-level trace resolves fine via the run record's id, so the breakage only surfaces the moment a human clicks a node. The trace write-path (span ids) and the detail read-path (run `run_id`) have landed on different keys, and th
  > Yes, I can reproduce the same behavior.  The returned run_id works correctly through the API (GET /threads/{thread_id}/runs/{run_id} returns 200), but Studio requests different UUIDs when opening node details. Those IDs appear to be node/span execution IDs rather than the actual run ID, causing the /runs/{id} endpoint to return 404.  This started after upgrading from langgraph-api 0.10.0 to 0.11.1.
  > **Reliability note (architecture only)**  Production agent/workflow failures usually reduce to a **contract** issue before a model/prompt issue:  1. **Success criteria** — durable artifact id (turn/run/session id), not only "green path" 2. **Side-effect before complete** — never blind-retry without an idempotency key on the business object 3. **Timeout must cancel or fence** — a log-only timeout leaves handlers running (double-speak / double-write) 4. **Tool vs path split** — external action can succeed while the agent path still errors (silent-green / false-red)  If you have one failing run + expected vs actual, reply with stack/version and I will send a free root-cause checklist.

- **Issue #8384** (2026-08-07): **InMemorySaver silently and permanently drops the first write after migrating a channel to DeltaChannel**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  None found. I searched open issues for `DeltaChannel`, `BinaryOperatorAggregate`, `snapshot_frequency`, `get_delta_channel_history`, and `migration` and didn't see this reported.  ### Reproduction Steps / Example Code (Python)  ```python from typing import Annotated from typing_extensions import TypedDict  from langgraph.channels.binop import BinaryOperatorAggregate from langgraph.channels.delta import DeltaChannel from langgraph.checkpoint.memory import InMemorySaver from langgraph.graph import END, START, StateGraph   def add(a, b):     return a + b   def noop(_state):     return {}   saver = InMemorySaver() config = {"configurable": {"thread_id": "t1"}}   # 1. Build up state under the "old" channel type (this is what a real #    conversation looks like before opting into DeltaChannel). class OldState(TypedDict):     items: Annotated[list, BinaryOperatorAggregate(list, add)] 
  **Post-Mortem & Fix Analysis**:
  > Hi! I've isolated the root cause and have a fix ready (branch: https://github.com/PiedPiper911/langgraph/tree/fix/inmemory-delta-channel-migration).  **The fix**: Remove the special case in `InMemorySaver.get_delta_channel_history` that skips pending writes when the stored blob is a plain value (not `_DeltaSnapshot`). A plain-value seed does not subsume its own checkpoint's pending writes — skipping them silently loses the first post-migration write.  This matches the reference `BaseCheckpointSaver` and `SqliteSaver` behavior. Verified against the repro in this issue and the existing delta-channel test suite (42 tests pass).  Could a maintainer assign me so I can reopen the PR? Happy to add regression tests as well.
  > Hi! I'd like to work on this issue. I've already prepared a fix (PR #8390 — InMemorySaver get_delta_channel_history fix) and can have it ready for review as soon as I'm assigned. Could a maintainer assign me? Thank you!
  > **Reliability note**  Production automation failures usually reduce to a **contract** issue before a model/prompt issue:  1. **Success criteria** — durable artifact id (message/booking/row), not only node green 2. **Side-effect before complete** — never blind-retry without an idempotency key on the business object 3. **Tool vs path split** — external action can succeed while the node/agent path still errors (silent-green / false-red)  If you have one failing execution + expected vs actual, reply with stack/version and I will send a free root-cause checklist.

- **Issue #8211** (2026-06-30): **with_structured_output is not supported when reasoning effort is used**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  _No response_  ### Reproduction Steps / Example Code (Python)  ```python import asyncio import os  from langchain_openai import ChatOpenAI from pydantic import BaseModel, Field   class SomeStructuredResp(BaseModel):     response: str = Field("default reasoning")   temperature = 0.7 open_ai_base_url = os.getenv("OPEN_AI_BASE_URL", "http://localhost:8080/v1") open_ai_reasoning_effort = os.getenv("REASONING_EFFORT", "disabled")  llm = ChatOpenAI(     model="HauhauCS/Gemma4-26B-A4B-QAT-Uncensored-HauhauCS-Balanced-MTP",     temperature=temperature,     base_url=open_ai_base_url,     api_key=os.getenv("OPENAI_API_KEY", "xyz"),     reasoning={"effort": "low"},     extra_body={         "chat_template_kwargs": {             "enable_thinking": open_ai_reasoning_effort != "disabled",         }     }, )  structured_llm = llm.with_structured_output(SomeStructuredResp)   async def main():  
  **Post-Mortem & Fix Analysis**:
  > Hi, I looked into this. The error occurs because with_structured_output uses tool calling / JSON mode under the hood, but when reasoning={"effort": "low"} is passed, the local inference server ignores the structured output instruction and returns plain conversational text instead. A potential workaround while a proper fix is investigated: use method="json_mode" explicitly when calling with_structured_output:  structured_llm = llm.with_structured_output(SomeStructuredResp, method="json_mode")  This may help depending on your local server's JSON mode support. I'd also note this seems to be a langchain-openai issue rather than LangGraph , the error trace points to langchain_openai/chat_models/base.py. Would it help to file this upstream at langchain-ai/langchain?
  > Thanks, I tried json_mode and it gives output parsing failure so not much progress. I've opened this issue in langchain for anyone with same issue https://github.com/langchain-ai/langchain/issues/38561. Closing this.

- **Issue #8089** (2026-06-17): **Langgraph dev fails with AttributeError**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  _No response_  ### Reproduction Steps / Example Code (Python)  ```python Invesitgated due to student query of why langgraph dev was failing.  Reproduced in my workspace.  Clone langgraph-academy repo and follow proper steps to prepare environment as per the README.md file.  Supplied a .env file with keys as instructed.  Cd to module-1/studio and copy the .env here as well. When running langgraph dev the error is produced. ```  ### Error Message and Stack Trace (if applicable)  ```shell AttributeError: module 'langgraph_api.config' has no attribute 'LSD_PROM_METRICS_ENABLED' ```  ### Description  List of installed langchain packages: pip list | grep lang langchain                                1.3.9 langchain-classic                        1.0.8 langchain-community                      0.4.2 langchain-core                           1.4.7 langchain-openai                        
  **Post-Mortem & Fix Analysis**:
  > What I ran verbatim:  git clone https://github.com/langchain-ai/langchain-academy.git cd langchain-academy python3 -m venv lc-academy-env source lc-academy-env/bin/activate pip install -r requirements.txt pip list | grep lang langchain                                1.3.9 langchain-classic                        1.0.8 langchain-community                      0.4.2 langchain-core                           1.4.7 langchain-openai                         1.3.2 langchain-protocol                       0.0.17 langchain-tavily                         0.2.18 langchain-text-splitters                 1.1.2 langgraph                                1.2.5 langgraph-api                            0.12.0.dev3 langgraph-checkpoint                     4.1.1 langgraph-checkpoint-sqlite              3.1.0 langgraph-cli                            0.4.29 langgraph-prebuilt                       1.1.0 langgraph-runtime-inmem                  0.31.0.dev9 langgraph-sdk                            0.4.2 langsmi
  > release(cli): 0.4.30 #8101 Has solved this problem - verified with langchain-academy course repo

- **Issue #8083** (2026-06-18): **Lang Graph did not save all data to the checkpoint**
  *Symptoms*: ### Checked other resources  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangGraph rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangGraph (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Related Issues / PRs  _No response_  ### Reproduction Steps / Example Code (Python)  ```python new StateGraph(new StateSchema({   messages: new ReducedValue(z.custom().default(() => []), { reducer: messagesStateReducer }),   stepCount: new ReducedValue(z.number().default(0), { reducer: (a,b) => a+b }), }))   .addNode('a', (s) => ({ messages: [new HumanMessage('hi')], stepCount: 1 }))   .addNode('b', (s) => ({ stepCount: 2 }))  // ← doesn't touch messages   .addEdge(START, 'a')   .addEdge('a', 'b')   .addEdge('b', END)   .compile({ checkpointer })  // After invoke, getState returns messages: [] when it should be [HumanMessage('hi')] ```  ### Error Message and Stack Trace (if applicable)  ```shell  ```  ### Description  - I use graph with custom Redis (fallback to Postgres) as checkpoint. The implement is good with many unit tests. - I update part of state in different node. - After call `invoke`, I c
  **Post-Mortem & Fix Analysis**:
  > @KafkaUnderCurrent This python project   javascript is https://github.com/langchain-ai/langgraphjs
  > Hi,  I've investigated this issue and spent some time tracing the checkpoint persistence and restoration flow in LangGraphJS.  Based on my current understanding, the issue may be related to how RedisSaver handles checkpoint storage in multi-node graphs.  My current hypothesis is:  A node writes to the messages channel and creates a checkpoint. A later node writes only to a different channel. The latest checkpoint contains only the channels written by that final node. Earlier channels remain referenced through channel_versions but may not be present in channel_values. During restoration, those missing channels may not be reconstructed correctly, resulting in incomplete state recovery.  To validate this, my plan is:  Create a dedicated multi-node reproduction test where different nodes write to different channels. Verify the exact contents of channel_values and channel_versions across checkpoints. Confirm whether the latest checkpoint can be restored with the complete state from all prio
  > I will move this issue to correct repo https://github.com/langchain-ai/langgraphjs/issues/2555

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

### Incident Patch 1: `2d942085` (2026-10-05)
**Commit Message**: fix(langgraph): fork before replaying an update checkpoint the thread moved past (#9170)

Depends on #9165

A replay saves a fork checkpoint first, so its writes land on the fork. Two things still reached the checkpoint it replayed from, and through it every branch that already grew from that checkpoint.

It skips the fork for an update or fork checkpoint, which is already a branch of its own. Once the thread has moved past such a checkpoint it can have children, and the replay's writes stored on it reach every one of them. Edit a checkpoint, continue from it, then replay the edit, and the branch you continued reads back a write it never ran:

```
plain channel: ['in1', 'a', 'b', 'edit', 'in2', 'a', 'b']
DeltaChannel:  ['in1', 'a', 'b', 'edit', 'b', 'in2', 'a', 'b']
                                         ^ the replay's b
```

And a `Command(update=...)` or `Command(goto=...)` replayed from any checkpoint stored its writes there before the run saved its fork. The branches that grew from that checkpoint replayed the update into a `DeltaChannel`, and a later replay of the same checkpoint repeated the old `Command`: the update again, in every channel, or the `goto`'s node again.

Bot

**File**: `libs/langgraph/langgraph/pregel/_loop.py` (modified, +53/-8)
```diff
@@ -98,7 +98,9 @@
 )
 from langgraph.pregel._checkpoint import (
     achannels_from_checkpoint,
+    acheckpoint_superseded,
     channels_from_checkpoint,
+    checkpoint_superseded,
     copy_checkpoint,
     create_checkpoint,
     delta_channels_to_snapshot,
@@ -236,6 +238,9 @@ class PregelLoop:
     _resume_loaded_writes: Sequence[PendingWrite] = ()
     # Tasks `_reapply_writes_to_succeeded_nodes` handed loaded writes back to.
     _reapplied_task_ids: set[str]
+    # An update or fork checkpoint addressed by `checkpoint_id` that the thread
+    # has moved past, so it may already have children.
+    _addressed_checkpoint_superseded: bool = False
 
     # The checkpoint_config that points at the parent loaded at `__enter__`
     # (or the synthetic-empty checkpoint, on first run). We capture it
@@ -905,6 +910,22 @@ def _first(
             self.checkpoint_pending_writes = [
                 w for w in self.checkpoint_pending_writes if w[1] != RESUME
             ]
+        # The parent checkpoint subgraphs replay from, when a fork below would
+        # otherwise move it
+        replay_bound: RunnableConfig | None = None
+        # Whether this run saves a fork checkpoint (below) to start its branch.
+        # The fork carries a `Command`'s writes itself, so nothing this run
+        # writes is stored on the checkpoint it addressed, which may have
+        # children that replay it.
+        forks = (
+            is_resuming
+            and is_time_traveling
+            and (
+                self.checkpoint_metadata.get("source") not in ("update", "fork")
+                or self._addressed_checkpoint_superseded
+            )
+        )
+        carried: list[PendingWrite] = []
         # A resume that reapplies the head's pending writes only learns which
         # of them go back to their tasks once those are scheduled, so
         # `after_tick` seals the rest. Kept apart from the writes this run adds.
@@ -952,10 +973,18 @@ def _first(
                 raise EmptyInputError("Received empty Command input")
             # save writes
             for tid, ws in writes.items():
-                self.put_writes(tid, ws)
+                if forks:
+                    carried.extend((tid, c, v) for c, v in ws)
+                else:
+                    self.put_writes(tid, ws)
+            self._delta_channels_forced_snapshot.update(
+                delta_channels_with_pending_writes(self.specs, carried)
+            )
         # apply NULL writes
         if null_writes := [
-            w[1:] for w in self.checkpoint_pending_writes if w[0] == NULL_TASK_ID
+            w[1:]
+            for w in (*self.checkpoint_pending_writes, *carried)
+            if w[0] == NULL_TASK_ID
         ]:
             null_updated_channels = apply_writes(
                 self.checkpoint,
@@ -980,11 +1009,15 @@ def _first(
             # the parent's latest checkpoint remains the old one and
             # subsequent resumes load the wrong state.
             # Skip for update_state forks (source=update/fork) since they
-            # already have their own fork checkpoint.
-            if is_time_traveling and self.checkpoint_metadata.get("source") not in (
-                "update",
-                "fork",
-            ):
+            # already have their own fork checkpoint, unless the thread moved
+            # past it: its other children would replay whatever this run
+            # stores on it.
+            if forks:
+                if (
+                    self.checkpoint_metadata.get("source") in ("update", "fork")
+                    and self.prev_checkpoint_config
+                ):
+                    replay_bound = self.prev_checkpoint_config
                 # Clear old INTERRUPT writes from the loaded checkpoint.
                 # The fork will have a new checkpoint_id which changes
                 # task IDs — stale interrupt writes would accumulate and
@@ -1077,7 +1110,11 @@ def _first(
             replay_state: ReplayState | None = None
             if is_time_traveling:
                 replay_checkpoint_id = self.checkpoint["id"]
-                if (
+                if replay_bound is not None:
+                    replay_checkpoint_id = replay_bound[CONF].get(
+                        CONFIG_KEY_CHECKPOINT_ID, replay_checkpoint_id
+                    )
+                elif (
                     self.checkpoint_metadata.get("source")
                     in (
                         "update",
@@ -1664,6 +1701,10 @@ def __enter__(self) -> Self:
             # This covers both normal replay and subgraphs resolved via
             # checkpoint_map during time-travel.
             saved = self.checkpointer.get_tuple(self.checkpoint_config)
+            if saved is not None and saved.metadata.get("source") in ("update", "fork"):
+                self._addressed_checkpoint_superseded = checkpoint_superseded(
+                    self.checkpointer, self.checkpoint_config, saved
+ 
```

**File**: `libs/langgraph/tests/test_delta_channel_fork.py` (modified, +100/-0)
```diff
@@ -545,6 +545,106 @@ def test_unaddressed_bulk_update_keeps_snapshot_cadence(
     assert not _snapshotted_checkpoints(sync_checkpointer, config)
 
 
+def _build_two_steps(checkpointer: BaseCheckpointSaver, subgraph: bool) -> Any:
+    if subgraph:
+        inner = StateGraph(_State)
+        inner.add_node("b1", lambda state: _both("b1"))
+        inner.add_node("b2", lambda state: _both("b2"))
+        inner.add_edge(START, "b1")
+        inner.add_edge("b1", "b2")
+        second: Any = inner.compile()
+    else:
+        second = lambda state: _both("b")  # noqa: E731
+    builder = StateGraph(_State)
+    builder.add_node("a", lambda state: _both("a"))
+    builder.add_node("b", second)
+    builder.add_edge(START, "a")
+    builder.add_edge("a", "b")
+    return builder.compile(checkpointer=checkpointer)
+
+
+@pytest.mark.parametrize(
+    "replay_input", [None, Command(update=_both("cmd"))], ids=["none", "command"]
+)
+@pytest.mark.parametrize("subgraph", [False, True])
+def test_replay_from_an_edit_the_thread_moved_past_leaves_its_branch_alone(
+    sync_checkpointer: BaseCheckpointSaver,
+    durability: Durability,
+    subgraph: bool,
+    replay_input: Command | None,
+) -> None:
+    graph = _build_two_steps(sync_checkpointer, subgraph)
+    config = _thread("t")
+    graph.invoke(_both("in-1"), config, durability=durability)
+    edit = graph.update_state(config, _both("edit"), as_node="a")
+    graph.invoke(_both("in-2"), config, durability=durability)
+    branch = graph.get_state(config)
+
+    graph.invoke(replay_input, edit, durability=durability)
+
+    after = graph.get_state(branch.config).values
+    assert after["log"] == after["plain"] == branch.values["log"], (
+        f"a replay from the edit wrote into the branch that already grew from it: "
+        f"{after['log']}"
+    )
+    replay = graph.get_state(config).values
+    assert replay["log"] == replay["plain"]
+
+
+@pytest.mark.parametrize(
+    "replay_input", [None, Command(update=_both("cmd"))], ids=["none", "command"]
+)
+@pytest.mark.parametrize("subgraph", [False, True])
+async def test_areplay_from_an_edit_the_thread_moved_past_leaves_its_branch_alone(
+    async_checkpointer: BaseCheckpointSaver,
+    durability: Durability,
+    subgraph: bool,
+    replay_input: Command | None,
+) -> None:
+    graph = _build_two_steps(async_checkpointer, subgraph)
+    config = _thread("t")
+    await graph.ainvoke(_both("in-1"), config, durability=durability)
+    edit = await graph.aupdate_state(config, _both("edit"), as_node="a")
+    await graph.ainvoke(_both("in-2"), config, durability=durability)
+    branch = await graph.aget_state(config)
+
+    await graph.ainvoke(replay_input, edit, durability=durability)
+
+    after = (await graph.aget_state(branch.config)).values
+    assert after["log"] == after["plain"] == branch.values["log"], (
+        f"a replay from the edit wrote into the branch that already grew from it: "
+        f"{after['log']}"
+    )
+    replay = (await graph.aget_state(config)).values
+    assert replay["log"] == replay["plain"]
+
+
+@pytest.mark.parametrize(
+    "command",
+    [Command(update=_both("cmd")), Command(goto="a")],
+    ids=["update", "goto"],
+)
+def test_command_replay_of_an_old_checkpoint_stores_nothing_on_it(
+    sync_checkpointer: BaseCheckpointSaver, durability: Durability, command: Command
+) -> None:
+    graph = _build_two_steps(sync_checkpointer, subgraph=False)
+    config = _thread("t")
+    graph.invoke(_both("in"), config, interrupt_before=["b"], durability=durability)
+    old = graph.get_state(config)
+    graph.invoke(None, config, durability=durability)
+    branch = graph.get_state(config)
+
+    graph.invoke(command, old.config, durability=durability)
+
+    after = graph.get_state(branch.config).values
+    assert after["log"] == after["plain"] == branch.values["log"]
+    graph.invoke(None, old.config, durability=durability)
+    replay = graph.get_state(config).values
+    assert replay["log"] == replay["plain"] == ["in", "a", "b"], (
+        f"a later replay of the checkpoint repeated the earlier Command: {replay}"
+    )
+
+
 def _build_paused_before_b(checkpointer: BaseCheckpointSaver) -> Any:
     builder = StateGraph(_State)
     builder.add_node("a", lambda state: _both("a"))
```

---

### Incident Patch 2: `456e2b1a` (2026-10-05)
**Commit Message**: fix(langgraph): keep an update_state on an older checkpoint out of its other branches (#9165)

Fixes #8551

`update_state` stores its writes on the checkpoint it addresses. A
`DeltaChannel` rebuilds its value by replaying the writes stored on its
ancestors, so when that checkpoint already has another child, the edit
shows up in that branch too. #8551's repro, editing an earlier turn and
then reading the branch that already existed:

```
before the edit: ['in-1', 'first-out', 'in-2', 'second-out']
after the edit:  ['in-1', 'first-out', 'patched', 'in-2', 'second-out']
```

The plain reducer channel in the same graph is unaffected. #8548 already
keeps the edited branch itself correct; this is the other direction.

## Fix

When `update_state` addresses a checkpoint that is not the thread's
latest, the checkpoint it creates snapshots the delta channels the
update writes, through the same snapshot #8548 adds for forks, and none
of the update's writes are stored on the addressed checkpoint, whatever
channels it writes. The edited branch reads the snapshot, and the other
branches have nothing new to replay. The addressed checkpoint stays as
it was, so a later `as_node=END` update on it do

**File**: `libs/langgraph/langgraph/pregel/_checkpoint.py` (modified, +42/-2)
```diff
@@ -10,13 +10,24 @@
     BaseCheckpointSaver,
     ChannelVersions,
     Checkpoint,
+    CheckpointTuple,
     PendingWrite,
 )
 from langgraph.checkpoint.base.id import uuid6
 from langgraph.checkpoint.serde.types import _DeltaSnapshot
 
-from langgraph._internal._config import DELTA_MAX_SUPERSTEPS_SINCE_SNAPSHOT
-from langgraph._internal._constants import NS_END, NS_SEP, PUSH, SNAPSHOT_BUMPS
+from langgraph._internal._config import (
+    DELTA_MAX_SUPERSTEPS_SINCE_SNAPSHOT,
+    patch_configurable,
+)
+from langgraph._internal._constants import (
+    CONF,
+    CONFIG_KEY_CHECKPOINT_ID,
+    NS_END,
+    NS_SEP,
+    PUSH,
+    SNAPSHOT_BUMPS,
+)
 from langgraph._internal._typing import MISSING
 from langgraph.channels.base import BaseChannel
 from langgraph.channels.delta import DeltaChannel
@@ -116,6 +127,35 @@ def delta_channels_with_pending_writes(
     }
 
 
+def checkpoint_superseded(
+    saver: BaseCheckpointSaver, config: RunnableConfig, saved: CheckpointTuple
+) -> bool:
+    """Whether the thread has moved past `saved`, the checkpoint `config` addressed.
+
+    A checkpoint with a child is never the latest put, so this misses none. A
+    leaf of an abandoned branch counts as well; telling it apart would mean
+    listing the thread to look for children, which the saver can't do cheaply.
+    """
+    if not config[CONF].get(CONFIG_KEY_CHECKPOINT_ID):
+        return False
+    latest = saver.get_tuple(
+        patch_configurable(config, {CONFIG_KEY_CHECKPOINT_ID: None})
+    )
+    return latest is not None and latest.checkpoint["id"] != saved.checkpoint["id"]
+
+
+async def acheckpoint_superseded(
+    saver: BaseCheckpointSaver, config: RunnableConfig, saved: CheckpointTuple
+) -> bool:
+    """Async `checkpoint_superseded`."""
+    if not config[CONF].get(CONFIG_KEY_CHECKPOINT_ID):
+        return False
+    latest = await saver.aget_tuple(
+        patch_configurable(config, {CONFIG_KEY_CHECKPOINT_ID: None})
+    )
+    return latest is not None and latest.checkpoint["id"] != saved.checkpoint["id"]
+
+
 def create_metadata_for_update_state_api(
     channels: Mapping[str, BaseChannel],
     updated_channels: set[str],
```

**File**: `libs/langgraph/langgraph/pregel/main.py` (modified, +33/-2)
```diff
@@ -108,6 +108,7 @@
     get_sync_graph_callback_manager_for_config,
 )
 from langgraph.channels.base import BaseChannel
+from langgraph.channels.delta import DeltaChannel
 from langgraph.channels.topic import Topic
 from langgraph.config import get_config
 from langgraph.constants import END
@@ -129,7 +130,9 @@
 from langgraph.pregel._call import identifier
 from langgraph.pregel._checkpoint import (
     achannels_from_checkpoint,
+    acheckpoint_superseded,
     channels_from_checkpoint,
+    checkpoint_superseded,
     copy_checkpoint,
     create_checkpoint,
     create_checkpoint_plan_for_update_state_api,
@@ -2028,7 +2031,21 @@ def perform_superstep(
                     ),
                 )
             updated_channels = get_updated_channels_from_tasks(run_tasks)
-            if saved is not None:
+            # The base's other children replay whatever is stored on it, so an
+            # edit of an older checkpoint stores none of its writes there: the
+            # checkpoint written here carries them, its delta channels
+            # snapshotted. Later supersteps address the checkpoint just written.
+            if (
+                is_first
+                and saved is not None
+                and checkpoint_superseded(checkpointer, config, saved)
+            ):
+                fork_pending.update(
+                    ch
+                    for ch in updated_channels
+                    if isinstance(self.channels.get(ch), DeltaChannel)
+                )
+            elif saved is not None:
                 for task_id, task in zip(run_task_ids, run_tasks):
                     channel_writes = [w for w in task.writes if w[0] != PUSH]
                     if channel_writes:
@@ -2502,7 +2519,21 @@ async def aperform_superstep(
                     ),
                 )
             updated_channels = get_updated_channels_from_tasks(run_tasks)
-            if saved is not None:
+            # The base's other children replay whatever is stored on it, so an
+            # edit of an older checkpoint stores none of its writes there: the
+            # checkpoint written here carries them, its delta channels
+            # snapshotted. Later supersteps address the checkpoint just written.
+            if (
+                is_first
+                and saved is not None
+                and await acheckpoint_superseded(checkpointer, config, saved)
+            ):
+                fork_pending.update(
+                    ch
+                    for ch in updated_channels
+                    if isinstance(self.channels.get(ch), DeltaChannel)
+                )
+            elif saved is not None:
                 for task_id, task in zip(run_task_ids, run_tasks):
                     channel_writes = [w for w in task.writes if w[0] != PUSH]
                     if channel_writes:
```

**File**: `libs/langgraph/tests/test_delta_channel_fork.py` (modified, +165/-0)
```diff
@@ -242,6 +242,171 @@ async def test_afork_by_update_state(
     assert state.values["log"] == [*base.values["log"], "patched"]
 
 
+def _assert_branch_unchanged(state: StateSnapshot, expected: list, edit: str) -> None:
+    assert state.values["log"] == state.values["plain"] == expected, (
+        f"{edit!r} was written by an update_state on this branch's base, "
+        f"but this branch now reads {state.values['log']}"
+    )
+
+
+# The old checkpoint is either a finished turn, which saved no writes, or one
+# whose next node already ran there, so the edit reuses that task's id.
+@pytest.mark.parametrize("next_node_ran", [False, True])
+def test_update_state_on_an_old_checkpoint_leaves_its_other_branch_alone(
+    sync_checkpointer: BaseCheckpointSaver, next_node_ran: bool
+) -> None:
+    config = _thread("t")
+    graph = _build(sync_checkpointer, "first")
+    graph.invoke(_both("in-1"), config)
+    _build(sync_checkpointer, "second").invoke(_both("in-2"), config)
+    branch = graph.get_state(config)
+    base = next(
+        snapshot
+        for snapshot in graph.get_state_history(config)
+        if "in-2" not in snapshot.values["log"]
+        and snapshot.next == (("n",) if next_node_ran else ())
+    )
+
+    edited = graph.update_state(_at(config, base), _both("edit"), as_node="n")
+
+    _assert_branch_unchanged(
+        graph.get_state(branch.config), branch.values["log"], "edit"
+    )
+    assert graph.get_state(edited).values["log"] == [*base.values["log"], "edit"]
+
+    _build(sync_checkpointer, "third").invoke(_both("in-3"), branch.config)
+    _assert_branch_unchanged(
+        graph.get_state(config),
+        [*branch.values["log"], "in-3", "third-out"],
+        "edit",
+    )
+
+
+@pytest.mark.parametrize("next_node_ran", [False, True])
+async def test_aupdate_state_on_an_old_checkpoint_leaves_its_other_branch_alone(
+    async_checkpointer: BaseCheckpointSaver, next_node_ran: bool
+) -> None:
+    config = _thread("t")
+    graph = _build(async_checkpointer, "first")
+    await graph.ainvoke(_both("in-1"), config)
+    await _build(async_checkpointer, "second").ainvoke(_both("in-2"), config)
+    branch = await graph.aget_state(config)
+    base = await anext(
+        snapshot
+        async for snapshot in graph.aget_state_history(config)
+        if "in-2" not in snapshot.values["log"]
+        and snapshot.next == (("n",) if next_node_ran else ())
+    )
+
+    edited = await graph.aupdate_state(_at(config, base), _both("edit"), as_node="n")
+
+    _assert_branch_unchanged(
+        await graph.aget_state(branch.config), branch.values["log"], "edit"
+    )
+    assert (await graph.aget_state(edited)).values["log"] == [
+        *base.values["log"],
+        "edit",
+    ]
+
+    await _build(async_checkpointer, "third").ainvoke(_both("in-3"), branch.config)
+    _assert_branch_unchanged(
+        await graph.aget_state(config),
+        [*branch.values["log"], "in-3", "third-out"],
+        "edit",
+    )
+
+
+def test_bulk_update_on_an_old_checkpoint_leaves_its_other_branch_alone(
+    sync_checkpointer: BaseCheckpointSaver,
+) -> None:
+    config = _thread("t")
+    graph = _build(sync_checkpointer, "first")
+    graph.invoke(_both("in-1"), config)
+    base = graph.get_state(config)
+    _build(sync_checkpointer, "second").invoke(_both("in-2"), config)
+    branch = graph.get_state(config)
+
+    edited = graph.bulk_update_state(
+        _at(config, base),
+        [[StateUpdate(_both("s1"), "n")], [StateUpdate(_both("s2"), "n")]],
+    )
+
+    _assert_branch_unchanged(graph.get_state(branch.config), branch.values["log"], "s1")
+    assert graph.get_state(edited).values["log"] == [*base.values["log"], "s1", "s2"]
+
+
+@pytest.mark.parametrize(
+    "edit", [_both("edit"), {"other": ["edit"]}], ids=["delta_and_plain", "plain_only"]
+)
+def test_clearing_an_old_checkpoint_does_not_pick_up_an_edit_of_it(
+    sync_checkpointer: BaseCheckpointSaver, edit: dict
+) -> None:
+    graph = (
+        StateGraph(_State)
+        .add_node("a", lambda state: _both("a"))
+        .add_node("b", lambda state: _both("b"))
+        .add_edge(START, "a")
+        .add_edge("a", "b")
+        .compile(checkpointer=sync_checkpointer)
+    )
+    config = _thread("t")
+    graph.invoke(_both("in"), config, interrupt_before=["b"])
+    base = graph.get_state(config)
+    graph.update_state(config, _both("later"), as_node="a")
+    graph.update_state(base.config, edit, as_node="b")
+
+    cleared = graph.update_state(base.config, None, as_node=END)
+
+    values = graph.get_state(cleared).values
+    assert values["log"] == values["plain"] == ["in", "a"]
+    assert values["other"] == []
+
+
+def test_clearing_a_checkpoint_after_editing_it_keeps_the_edit_in_both_channels(
+    sync_checkpointer: BaseCheckpointSaver,
+) -> None:
+    def q(state: _State) -> dict:
+        interrupt("continue?")
+        return _both("q")
+
+    graph = (
+        StateGraph(_State)
+        .add_node("p
```

---

### Incident Patch 3: `1b84cb08` (2026-10-05)
**Commit Message**: fix(langgraph): keep DeltaChannel counters on every update_state path (#9142)

`update_state` saves `counters_since_delta_snapshot` on the checkpoint
it creates, except on three paths: `update_state(None, as_node=END)`,
`as_node="__input__"` and `as_node="__copy__"`. Those save their
checkpoint without it, so the next checkpoint restarts every delta
channel's counters from zero:

```
before update_state(None, END): [6, 9]
after it:                       (none)
after the next run:             [2, 3]   (with this change: [6, 10], then [8, 13])
```

The counters decide when a channel snapshots, so after any of these
updates the next snapshot comes later than `snapshot_frequency` and
reads walk further back. A thread driven only by these updates never
snapshots, so its walk keeps growing. The field's docstring says it is
absent only on threads that don't use delta channels.

## Fix

`END` and `__input__` build their checkpoint with
`create_checkpoint_plan_for_update_state_api`, the plan an update as a
node already uses, which now takes the checkpoint's `source`. The
counters advance by one superstep (`END` counts the channels its
absorbed writes touched as updated), and a channel that 

**File**: `libs/langgraph/langgraph/pregel/_checkpoint.py` (modified, +3/-2)
```diff
@@ -3,7 +3,7 @@
 import uuid
 from collections.abc import Callable, Iterable, Mapping
 from datetime import datetime, timezone
-from typing import Any, cast
+from typing import Any, Literal, cast
 
 from langchain_core.runnables import RunnableConfig
 from langgraph.checkpoint.base import (
@@ -145,6 +145,7 @@ def create_checkpoint_plan_for_update_state_api(
     channels: Mapping[str, BaseChannel],
     updated_channels: set[str],
     *,
+    source: Literal["update", "input"],
     step: int,
     parents: dict[str, Any],
     saved_metadata: Mapping[str, Any] | None,
@@ -154,7 +155,7 @@ def create_checkpoint_plan_for_update_state_api(
 ) -> tuple[set[str], dict[str, Any]]:
     """Return ``(channels_to_snapshot, metadata)`` for an update_state head."""
     metadata: dict[str, Any] = {
-        "source": "update",
+        "source": source,
         "step": step,
         "parents": parents,
     }
```

**File**: `libs/langgraph/langgraph/pregel/main.py` (modified, +82/-34)
```diff
@@ -1696,6 +1696,7 @@ def perform_superstep(
                         "Cannot apply multiple updates when clearing state"
                     )
 
+                updated_channels: set[str] = set()
                 if saved is not None:
                     # tasks for this checkpoint
                     next_tasks = prepare_next_tasks(
@@ -1718,7 +1719,7 @@ def perform_superstep(
                         for w in saved.pending_writes or []
                         if w[0] == NULL_TASK_ID
                     ]:
-                        apply_writes(
+                        updated_channels |= apply_writes(
                             checkpoint,
                             channels,
                             [PregelTaskWrites((), INPUT, null_writes, [])],
@@ -1732,30 +1733,39 @@ def perform_superstep(
                         if tid in next_tasks:
                             next_tasks[tid].writes.extend(status.output)
                     # clear all current tasks
-                    apply_writes(
+                    updated_channels |= apply_writes(
                         checkpoint,
                         channels,
                         next_tasks.values(),
                         checkpointer.get_next_version,
                         self.trigger_to_nodes,
                     )
                 # save checkpoint
+                channels_to_snapshot, checkpoint_metadata = (
+                    create_checkpoint_plan_for_update_state_api(
+                        channels,
+                        updated_channels,
+                        source="update",
+                        step=step + 1,
+                        parents=saved.metadata.get("parents", {}) if saved else {},
+                        saved_metadata=saved.metadata if saved else None,
+                        is_fresh_thread=saved is None,
+                        fork_channels=fork_pending,
+                        channel_versions=checkpoint["channel_versions"],
+                    )
+                )
                 next_checkpoint = create_checkpoint(
                     checkpoint,
                     channels,
                     step,
                     get_next_version=checkpointer.get_next_version,
-                    channels_to_snapshot=fork_pending,
+                    channels_to_snapshot=channels_to_snapshot,
                     stored_versions=checkpoint_previous_versions,
                 )
                 next_config = checkpointer.put(
                     checkpoint_config,
                     next_checkpoint,
-                    {
-                        "source": "update",
-                        "step": step + 1,
-                        "parents": saved.metadata.get("parents", {}) if saved else {},
-                    },
+                    checkpoint_metadata,
                     get_new_channel_versions(
                         checkpoint_previous_versions,
                         next_checkpoint["channel_versions"],
@@ -1773,7 +1783,7 @@ def perform_superstep(
                     )
 
                 if input_writes := deque(map_input(self.input_channels, values)):
-                    apply_writes(
+                    updated_channels = apply_writes(
                         checkpoint,
                         channels,
                         [PregelTaskWrites((), INPUT, input_writes, [])],
@@ -1787,24 +1797,31 @@ def perform_superstep(
                         if saved and saved.metadata.get("step") is not None
                         else -1
                     )
+                    channels_to_snapshot, checkpoint_metadata = (
+                        create_checkpoint_plan_for_update_state_api(
+                            channels,
+                            updated_channels,
+                            source="input",
+                            step=next_step,
+                            parents=saved.metadata.get("parents", {}) if saved else {},
+                            saved_metadata=saved.metadata if saved else None,
+                            is_fresh_thread=saved is None,
+                            fork_channels=fork_pending,
+                            channel_versions=checkpoint["channel_versions"],
+                        )
+                    )
                     next_checkpoint = create_checkpoint(
                         checkpoint,
                         channels,
                         next_step,
                         get_next_version=checkpointer.get_next_version,
-                        channels_to_snapshot=fork_pending,
+                        channels_to_snapshot=channels_to_snapshot,
                         stored_versions=checkpoint_previous_versions,
                     )
                     next_config = checkpointer.put(
                         checkpoint_config,
                         next_checkpoint,
-                        {
-                            "source": "input",
-                    
```

**File**: `libs/langgraph/tests/test_delta_channel_fork.py` (modified, +1/-1)
```diff
@@ -315,7 +315,7 @@ def test_fork_before_first_value_by_bulk_update(
 
 
 @pytest.mark.parametrize("first_as_node", [INPUT, END, "__copy__"])
-def test_fork_by_bulk_update_whose_first_superstep_skips_the_plan(
+def test_fork_by_bulk_update_whose_first_superstep_is_not_a_node(
     sync_checkpointer: BaseCheckpointSaver, first_as_node: str
 ) -> None:
     config = _thread("t")
```

**File**: `libs/langgraph/tests/test_delta_channel_supersteps_bound.py` (modified, +109/-0)
```diff
@@ -174,6 +174,115 @@ async def test_predicate_fires_on_supersteps_overflow() -> None:
     )
 
 
+def _delta_counters(saver: InMemorySaver, config: Any) -> dict[str, list[int]]:
+    tup = saver.get_tuple(config)
+    assert tup is not None
+    counters = tup.metadata.get("counters_since_delta_snapshot") or {}
+    return {ch: list(c) for ch, c in counters.items()}
+
+
+_CLEAR_COPY_AND_INPUT_UPDATES = pytest.mark.parametrize(
+    ("values", "as_node", "supersteps"),
+    [
+        (None, END, 1),
+        (None, "__copy__", 0),
+        ({"a": []}, "__input__", 1),
+    ],
+    ids=["clear as END", "copy", "update as input"],
+)
+
+
+@_CLEAR_COPY_AND_INPUT_UPDATES
+def test_update_state_path_keeps_delta_counters(
+    values: Any, as_node: str, supersteps: int
+) -> None:
+    saver = InMemorySaver()
+    graph = _build_two_channel_graph(saver)
+    config = {"configurable": {"thread_id": "counters"}}
+    graph.invoke({"a": ["seed-a"], "b": ["seed-b"]}, config)
+    before = _delta_counters(saver, config)
+    assert set(before) == {"a", "b"}, f"both channels need live counters: {before}"
+
+    updated = graph.update_state(config, values, as_node=as_node)
+
+    assert _delta_counters(saver, updated) == {
+        ch: [u, s + supersteps] for ch, (u, s) in before.items()
+    }
+
+
+@_CLEAR_COPY_AND_INPUT_UPDATES
+async def test_aupdate_state_path_keeps_delta_counters(
+    values: Any, as_node: str, supersteps: int
+) -> None:
+    saver = InMemorySaver()
+    graph = _build_two_channel_graph(saver)
+    config = {"configurable": {"thread_id": "counters"}}
+    await graph.ainvoke({"a": ["seed-a"], "b": ["seed-b"]}, config)
+    before = _delta_counters(saver, config)
+    assert set(before) == {"a", "b"}, f"both channels need live counters: {before}"
+
+    updated = await graph.aupdate_state(config, values, as_node=as_node)
+
+    assert _delta_counters(saver, updated) == {
+        ch: [u, s + supersteps] for ch, (u, s) in before.items()
+    }
+
+
+_UPDATES_THAT_ADD_A_SUPERSTEP = pytest.mark.parametrize(
+    ("values", "as_node"),
+    [(None, END), ({"a": []}, "__input__")],
+    ids=["clear as END", "update as input"],
+)
+
+
+@_UPDATES_THAT_ADD_A_SUPERSTEP
+def test_update_state_path_snapshots_at_the_supersteps_bound(
+    values: Any, as_node: str
+) -> None:
+    saver = InMemorySaver()
+    graph = _build_two_channel_graph(saver)
+    config = {"configurable": {"thread_id": "bound"}}
+    graph.invoke({"a": ["seed-a"], "b": ["seed-b"]}, config)
+    expected = graph.get_state(config).values
+    supersteps = _delta_counters(saver, config)["b"][1]
+
+    with patch(
+        "langgraph.pregel._checkpoint.DELTA_MAX_SUPERSTEPS_SINCE_SNAPSHOT",
+        supersteps + 1,
+    ):
+        updated = graph.update_state(config, values, as_node=as_node)
+
+    head = saver.get_tuple(updated)
+    assert head is not None
+    assert isinstance(head.checkpoint["channel_values"].get("b"), _DeltaSnapshot)
+    assert "b" not in _delta_counters(saver, updated)
+    assert graph.get_state(updated).values == expected
+
+
+@_UPDATES_THAT_ADD_A_SUPERSTEP
+async def test_aupdate_state_path_snapshots_at_the_supersteps_bound(
+    values: Any, as_node: str
+) -> None:
+    saver = InMemorySaver()
+    graph = _build_two_channel_graph(saver)
+    config = {"configurable": {"thread_id": "bound"}}
+    await graph.ainvoke({"a": ["seed-a"], "b": ["seed-b"]}, config)
+    expected = (await graph.aget_state(config)).values
+    supersteps = _delta_counters(saver, config)["b"][1]
+
+    with patch(
+        "langgraph.pregel._checkpoint.DELTA_MAX_SUPERSTEPS_SINCE_SNAPSHOT",
+        supersteps + 1,
+    ):
+        updated = await graph.aupdate_state(config, values, as_node=as_node)
+
+    head = saver.get_tuple(updated)
+    assert head is not None
+    assert isinstance(head.checkpoint["channel_values"].get("b"), _DeltaSnapshot)
+    assert "b" not in _delta_counters(saver, updated)
+    assert (await graph.aget_state(updated)).values == expected
+
+
 async def test_counter_reset_after_supersteps_snapshot() -> None:
     """After the supersteps bound triggers a snapshot, the counters for
     that channel reset. Verify by using a bound higher than one run's
```

---

### Incident Patch 4: `524b320e` (2026-10-05)
**Commit Message**: fix(langgraph): don't walk history for a DeltaChannel that was never written (#9141)

A `DeltaChannel` with no version at a checkpoint was never written, so
its value is empty. `channels_from_checkpoint` still asked the saver for
its history, and with no snapshot to stop at, the walk reads every
ancestor of the thread, on every run and every `get_state`. A channel
that never gets written is common: deepagents' `files` channel when an
agent doesn't use files.

On SQLite the walk fails outright once the thread is long enough,
because stage 2 binds one variable per ancestor. With one never-written
channel on a 33,000-step thread:

```
main:   get_state  -> OperationalError: too many SQL variables
        next run   -> OperationalError: too many SQL variables
branch: get_state ok in 1 ms, next run ok
```

## Fix

Only channels that have a version at the checkpoint are walked. A
channel without one hydrates empty without asking the saver.

A version is assigned whenever a channel is written (by a task, an
input, `update_state` or a migration from a plain channel), so no
version means no write on this branch. The walk could only have found
writes this branch never applied.

Snapshotting 

**File**: `libs/langgraph/langgraph/pregel/_checkpoint.py` (modified, +24/-26)
```diff
@@ -311,29 +311,35 @@ def versions_seen_without_bumps(
     return out
 
 
-def _needs_replay(spec: BaseChannel, stored: object) -> bool:
-    """True if `spec` is a `DeltaChannel` and no value is stored at this
-    checkpoint, requiring an ancestor walk to reconstruct.
-
-    `_DeltaSnapshot` blobs and plain values (migration) resolve directly via
-    `from_checkpoint` — only absence (`MISSING`) triggers replay.
+def _delta_channels_to_replay(
+    specs: Mapping[str, BaseChannel], checkpoint: Checkpoint
+) -> list[str]:
+    """DeltaChannels whose value at `checkpoint` the ancestor walk rebuilds.
+
+    A `_DeltaSnapshot` blob or a plain value (migration) resolves directly via
+    `from_checkpoint`, so only a channel with nothing stored here needs the
+    walk. A channel with no version was never written, so it is empty without
+    one; a walk for it would find no snapshot to stop at and read every
+    ancestor, every time the thread is loaded.
     """
-    if not isinstance(spec, DeltaChannel):
-        return False
-    return stored is MISSING
+    return [
+        k
+        for k, spec in specs.items()
+        if isinstance(spec, DeltaChannel)
+        and k in checkpoint["channel_versions"]
+        and checkpoint["channel_values"].get(k, MISSING) is MISSING
+    ]
 
 
 def _require_saver_for_history(
-    checkpoint: Checkpoint,
     delta_channels: list[str],
     saver: BaseCheckpointSaver | None,
     config: RunnableConfig | None,
 ) -> None:
-    written = [k for k in delta_channels if k in checkpoint["channel_versions"]]
-    if written and (saver is None or config is None):
+    if delta_channels and (saver is None or config is None):
         raise ValueError(
-            f"DeltaChannel {written} has history to replay but no checkpointer "
-            "or config was passed to read it"
+            f"DeltaChannel {delta_channels} has history to replay but no "
+            "checkpointer or config was passed to read it"
         )
 
 
@@ -362,12 +368,8 @@ def channels_from_checkpoint(
         else:
             managed_specs[k] = v
 
-    delta_channels: list[str] = [
-        k
-        for k, spec in channel_specs.items()
-        if _needs_replay(spec, checkpoint["channel_values"].get(k, MISSING))
-    ]
-    _require_saver_for_history(checkpoint, delta_channels, saver, config)
+    delta_channels = _delta_channels_to_replay(channel_specs, checkpoint)
+    _require_saver_for_history(delta_channels, saver, config)
     histories: Mapping[str, Any] = {}
     if delta_channels and saver is not None and config is not None:
         histories = saver.get_delta_channel_history(
@@ -405,12 +407,8 @@ async def achannels_from_checkpoint(
         else:
             managed_specs[k] = v
 
-    delta_channels: list[str] = [
-        k
-        for k, spec in channel_specs.items()
-        if _needs_replay(spec, checkpoint["channel_values"].get(k, MISSING))
-    ]
-    _require_saver_for_history(checkpoint, delta_channels, saver, config)
+    delta_channels = _delta_channels_to_replay(channel_specs, checkpoint)
+    _require_saver_for_history(delta_channels, saver, config)
     histories: Mapping[str, Any] = {}
     if delta_channels and saver is not None and config is not None:
         histories = await saver.aget_delta_channel_history(
```

**File**: `libs/langgraph/tests/test_delta_channel_supersteps_bound.py` (modified, +76/-0)
```diff
@@ -16,6 +16,7 @@
 from langgraph.channels.delta import DeltaChannel
 from langgraph.graph import END, START, StateGraph
 from langgraph.pregel._checkpoint import delta_channels_to_snapshot
+from langgraph.types import Command, interrupt
 
 pytestmark = pytest.mark.anyio
 
@@ -219,3 +220,78 @@ async def test_counter_reset_after_supersteps_snapshot() -> None:
 
         state = graph.get_state(config)
         assert state.values["b"] == ["seed-b"]
+
+
+class _HistoryRequestSaver(InMemorySaver):
+    def __init__(self) -> None:
+        super().__init__()
+        self.requested: list[list[str]] = []
+
+    def get_delta_channel_history(self, *, config: Any, channels: Any) -> Any:
+        self.requested.append(sorted(channels))
+        return super().get_delta_channel_history(config=config, channels=channels)
+
+
+def test_never_written_channel_is_not_walked() -> None:
+    saver = _HistoryRequestSaver()
+    graph = _build_two_channel_graph(saver, n_loops=3)
+    config = {"configurable": {"thread_id": "never-written"}}
+    graph.invoke({"a": ["seed-a"]}, config)
+    saver.requested.clear()
+
+    graph.invoke({"a": ["more-a"]}, config)
+    state = graph.get_state(config)
+
+    assert state.values["b"] == []
+    assert saver.requested and all(r == ["a"] for r in saver.requested), (
+        f"only the written channel needs a walk; asked for {saver.requested}"
+    )
+
+
+async def test_anever_written_channel_is_not_walked() -> None:
+    saver = _HistoryRequestSaver()
+    graph = _build_two_channel_graph(saver, n_loops=3)
+    config = {"configurable": {"thread_id": "never-written"}}
+    await graph.ainvoke({"a": ["seed-a"]}, config)
+    saver.requested.clear()
+
+    await graph.ainvoke({"a": ["more-a"]}, config)
+    state = await graph.aget_state(config)
+
+    assert state.values["b"] == []
+    assert saver.requested and all(r == ["a"] for r in saver.requested), (
+        f"only the written channel needs a walk; asked for {saver.requested}"
+    )
+
+
+@pytest.mark.parametrize("durability", ["sync", "async"])
+def test_first_write_pending_at_an_interrupt_is_applied_once_on_resume(
+    durability: Any,
+) -> None:
+    class State(TypedDict):
+        x: list
+        first: Annotated[list, DeltaChannel(_simple_reducer)]
+
+    def ask(state: State) -> dict:
+        interrupt("ok?")
+        return {"x": ["asked"]}
+
+    saver = InMemorySaver()
+    graph = (
+        StateGraph(State)
+        .add_node("p", lambda state: {"first": ["p"]})
+        .add_node("ask", ask)
+        .add_edge(START, "p")
+        .add_edge(START, "ask")
+        .compile(checkpointer=saver)
+    )
+    config = {"configurable": {"thread_id": "pending-first-write"}}
+    graph.invoke({"x": ["in"]}, config, durability=durability)
+    head = saver.get_tuple(config)
+    assert head is not None
+    assert "first" not in head.checkpoint["channel_versions"]
+    assert ("first", ["p"]) in [w[1:] for w in head.pending_writes or []]
+
+    graph.invoke(Command(resume="yes"), config, durability=durability)
+
+    assert graph.get_state(config).values["first"] == ["p"]
```

---

### Incident Patch 5: `9a0394d8` (2026-10-03)
**Commit Message**: fix(langgraph): don't replay an abandoned branch into a DeltaChannel fork (#8548)

Fixes #8443
Fixes #9089

A checkpoint keeps the pending writes that produced its child, and
nothing records which child consumed them. When a new branch starts from
a checkpoint that already has pending writes (going back in time, or new
input on an interrupted head), the `DeltaChannel` ancestor walk replays
those writes into the new branch too. The live run is correct; only a
reload is wrong:

```
fork base:     ['in-1', 'first-out']
fork returns:  ['in-1', 'first-out', 'in-3', 'third-out']
reload gives:  ['in-1', 'first-out', 'in-2', 'in-3', 'third-out']
                                     ^^^^^^ from the branch the fork replaced
```

Plain channels store their full value and are unaffected, so the tests
use one as the oracle.

## Fix

The first checkpoint of a new branch snapshots the delta channels its
base has pending writes for, so the walk stops inside the branch. Only
the base's own writes are branch-specific; everything above it is shared
history. A base with no pending writes has nothing to leak, so an
ordinary turn that addresses the head (as clients commonly do) stores
nothing. `bulk_upd

**File**: `libs/langgraph/langgraph/_internal/_constants.py` (modified, +4/-0)
```diff
@@ -23,6 +23,9 @@
 # for writes of a task where we simply record the return value
 PREVIOUS = sys.intern("__previous__")
 # the implicit branch that handles each node's Control values
+SNAPSHOT_BUMPS = sys.intern("__snapshot_bumps__")
+# `versions_seen` key recording which entries a snapshot-only version bump
+# advanced, and the versions those nodes really read
 
 
 # --- Reserved cache namespaces ---
@@ -116,6 +119,7 @@
     ERROR,
     ERROR_SOURCE_NODE,
     NO_WRITES,
+    SNAPSHOT_BUMPS,
     # reserved config.configurable keys
     CONFIG_KEY_SEND,
     CONFIG_KEY_READ,
```

**File**: `libs/langgraph/langgraph/pregel/_checkpoint.py` (modified, +126/-29)
```diff
@@ -8,13 +8,15 @@
 from langchain_core.runnables import RunnableConfig
 from langgraph.checkpoint.base import (
     BaseCheckpointSaver,
+    ChannelVersions,
     Checkpoint,
+    PendingWrite,
 )
 from langgraph.checkpoint.base.id import uuid6
 from langgraph.checkpoint.serde.types import _DeltaSnapshot
 
 from langgraph._internal._config import DELTA_MAX_SUPERSTEPS_SINCE_SNAPSHOT
-from langgraph._internal._constants import PUSH
+from langgraph._internal._constants import NS_END, NS_SEP, PUSH, SNAPSHOT_BUMPS
 from langgraph._internal._typing import MISSING
 from langgraph.channels.base import BaseChannel
 from langgraph.channels.delta import DeltaChannel
@@ -50,17 +52,23 @@ def exit_delta_task_id(step: int, task_id: str) -> str:
 def delta_channels_to_snapshot(
     channels: Mapping[str, BaseChannel],
     counters_since_delta_snapshot: Mapping[str, tuple[int, int]],
+    channel_versions: ChannelVersions,
 ) -> set[str]:
     """Return the set of DeltaChannel names that should snapshot now.
 
     A channel snapshots when EITHER its accumulated update count reaches
     `snapshot_frequency` OR the total supersteps since its last snapshot
-    reaches `DELTA_MAX_SUPERSTEPS_SINCE_SNAPSHOT`. This is a pure
-    predicate — no mutation.
+    reaches `DELTA_MAX_SUPERSTEPS_SINCE_SNAPSHOT`. A channel without a version
+    was never written on this branch, so it has nothing to snapshot. This is a
+    pure predicate — no mutation.
     """
     result: set[str] = set()
     for name, ch in channels.items():
-        if not isinstance(ch, DeltaChannel) or not ch.is_available():
+        if (
+            not isinstance(ch, DeltaChannel)
+            or not ch.is_available()
+            or name not in channel_versions
+        ):
             continue
         updates, supersteps = counters_since_delta_snapshot.get(name, (0, 0))
         if (
@@ -80,12 +88,31 @@ def get_updated_channels_from_tasks(
 
 def get_delta_channels_from_all_channels(
     channels: Mapping[str, BaseChannel],
+    channel_versions: ChannelVersions,
 ) -> set[str]:
-    """DeltaChannels to snapshot on the first update_state of a fresh thread."""
+    """DeltaChannels to snapshot on the first update_state of a fresh thread:
+    the ones it wrote, as the rest have no version and nothing to store."""
     return {
         k
         for k, ch in channels.items()
-        if isinstance(ch, DeltaChannel) and ch.is_available()
+        if isinstance(ch, DeltaChannel) and ch.is_available() and k in channel_versions
+    }
+
+
+def delta_channels_with_pending_writes(
+    specs: Mapping[str, Any],
+    pending_writes: Iterable[PendingWrite] | None,
+) -> set[str]:
+    """DeltaChannels a branch starting from this checkpoint must snapshot.
+
+    A checkpoint's pending writes belong to the child that consumed them, and
+    nothing records which child that was. A new branch snapshots every delta
+    channel they touch, so its ancestor walk never replays them.
+    """
+    return {
+        ch
+        for _, ch, _ in pending_writes or ()
+        if isinstance(specs.get(ch), DeltaChannel)
     }
 
 
@@ -122,6 +149,8 @@ def create_checkpoint_plan_for_update_state_api(
     parents: dict[str, Any],
     saved_metadata: Mapping[str, Any] | None,
     is_fresh_thread: bool,
+    fork_channels: set[str],
+    channel_versions: ChannelVersions,
 ) -> tuple[set[str], dict[str, Any]]:
     """Return ``(channels_to_snapshot, metadata)`` for an update_state head."""
     metadata: dict[str, Any] = {
@@ -130,14 +159,19 @@ def create_checkpoint_plan_for_update_state_api(
         "parents": parents,
     }
     if is_fresh_thread:
-        return get_delta_channels_from_all_channels(channels), metadata
+        return get_delta_channels_from_all_channels(
+            channels, channel_versions
+        ), metadata
 
     new_counters = create_metadata_for_update_state_api(
         channels,
         updated_channels,
         prev_metadata=saved_metadata,
     )
-    channels_to_snapshot = delta_channels_to_snapshot(channels, new_counters)
+    channels_to_snapshot = (
+        delta_channels_to_snapshot(channels, new_counters, channel_versions)
+        | fork_channels
+    )
     for k in channels_to_snapshot:
         new_counters[k] = (0, 0)
     non_zero = {k: v for k, v in new_counters.items() if v != (0, 0)}
@@ -155,6 +189,7 @@ def create_checkpoint(
     updated_channels: set[str] | None = None,
     get_next_version: GetNextVersion | None = None,
     channels_to_snapshot: set[str] | None = None,
+    stored_versions: ChannelVersions | None = None,
 ) -> Checkpoint:
     """Build a new Checkpoint from the previous one and live channel state.
 
@@ -164,40 +199,44 @@ def create_checkpoint(
     from `checkpoint_writes`. Callers compute the set via
     `delta_channels_to_snapshot(channels, counters)`; defaults to empty
     (no snapshots) when not provided.
+
+    `stored_versions` are the channel versions of the last checkpoint the
+    saver 
```

**File**: `libs/langgraph/langgraph/pregel/_loop.py` (modified, +68/-17)
```diff
@@ -102,6 +102,7 @@
     copy_checkpoint,
     create_checkpoint,
     delta_channels_to_snapshot,
+    delta_channels_with_pending_writes,
     empty_checkpoint,
     exit_delta_task_id,
 )
@@ -223,10 +224,18 @@ class PregelLoop:
     # under the saver's `ORDER BY task_id, idx` sorting.
     _exit_delta_writes: list[tuple[int, str, str, Any]] | None = None
 
-    # Delta channels that saw an Overwrite since the last checkpoint. These
-    # channels must snapshot after live update applies overwrite semantics so
-    # sparse replay starts from the same post-overwrite value.
-    _delta_channels_with_overwrite: set[str]
+    # Delta channels that must snapshot at the next checkpoint, whatever their
+    # cadence counters say:
+    # * an Overwrite arrived since the last checkpoint, so sparse replay has to
+    #   start from the post-overwrite value;
+    # * the checkpoint this run starts from has pending writes to them; see
+    #   `delta_channels_with_pending_writes`.
+    _delta_channels_forced_snapshot: set[str]
+    # Set by `_first` for a resume: the writes it loaded with the checkpoint,
+    # which `after_tick` checks against the ones reapply handed back.
+    _resume_loaded_writes: Sequence[PendingWrite] = ()
+    # Tasks `_reapply_writes_to_succeeded_nodes` handed loaded writes back to.
+    _reapplied_task_ids: set[str]
 
     # The checkpoint_config that points at the parent loaded at `__enter__`
     # (or the synthetic-empty checkpoint, on first run). We capture it
@@ -582,7 +591,7 @@ def accept_push(
             # save the new task
             self.tasks[pushed.id] = pushed
             # match any pending writes to the new task
-            if not self.is_replaying:
+            if self._reapplies_pending_writes:
                 self._reapply_writes_to_succeeded_nodes({pushed.id: pushed})
             # return the new task, to be started if not run before
             return pushed
@@ -660,7 +669,7 @@ def tick(self) -> bool:
             return False
 
         # if there are pending writes from a previous loop, apply them
-        if not self.is_replaying and self.checkpoint_pending_writes:
+        if self._reapplies_pending_writes and self.checkpoint_pending_writes:
             self._reapply_writes_to_succeeded_nodes(self.tasks)
             self._resume_error_handlers_if_applicable()
 
@@ -684,11 +693,26 @@ def tick(self) -> bool:
     def after_tick(self) -> None:
         # finish superstep
         writes = [w for t in self.tasks.values() for w in t.writes]
-        self._delta_channels_with_overwrite.update(
+        self._delta_channels_forced_snapshot.update(
             ch
             for ch, v in writes
             if isinstance(self.specs.get(ch), DeltaChannel) and _get_overwrite(v)[0]
         )
+        if self._resume_loaded_writes:
+            # A loaded write reapply didn't hand back belongs to a task this run
+            # drops or reruns: a `Send` that `Command(goto=...)` replaced, or an
+            # error handler that runs again.
+            self._delta_channels_forced_snapshot.update(
+                delta_channels_with_pending_writes(
+                    self.specs,
+                    [
+                        w
+                        for w in self._resume_loaded_writes
+                        if w[0] not in self._reapplied_task_ids
+                    ],
+                )
+            )
+            self._resume_loaded_writes = ()
         # all tasks have finished
         self.updated_channels = apply_writes(
             self.checkpoint,
@@ -734,6 +758,12 @@ async def amatch_cached_writes(self) -> Sequence[PregelExecutableTask]:
 
     # private
 
+    @property
+    def _reapplies_pending_writes(self) -> bool:
+        """Whether the writes loaded with the checkpoint go back to the tasks
+        that made them, instead of those tasks rerunning."""
+        return not self.is_replaying
+
     def _reapply_writes_to_succeeded_nodes(
         self, tasks: Mapping[str, PregelExecutableTask]
     ) -> None:
@@ -745,6 +775,7 @@ def _reapply_writes_to_succeeded_nodes(
         for tid, status in read_task_statuses(self.checkpoint_pending_writes).items():
             if task := tasks.get(tid):
                 task.writes.extend(status.output)
+                self._reapplied_task_ids.add(tid)
 
     def _resume_error_handlers_if_applicable(self) -> None:
         """On resume, schedule error handlers for tasks that failed in a prior run.
@@ -874,6 +905,23 @@ def _first(
             self.checkpoint_pending_writes = [
                 w for w in self.checkpoint_pending_writes if w[1] != RESUME
             ]
+        # A resume that reapplies the head's pending writes only learns which
+        # of them go back to their tasks once those are scheduled, so
+        # `after_tick` seals the rest. Kept apart from the writes this run adds.
+        reapplies = is_resuming and self._reapplies_pending_writes
+        self._resume_loaded_writes = (
+  
```

**File**: `libs/langgraph/langgraph/pregel/main.py` (modified, +103/-62)
```diff
@@ -46,6 +46,7 @@
 from langgraph.cache.base import BaseCache
 from langgraph.checkpoint.base import (
     BaseCheckpointSaver,
+    ChannelVersions,
     Checkpoint,
     CheckpointTuple,
 )
@@ -132,8 +133,10 @@
     copy_checkpoint,
     create_checkpoint,
     create_checkpoint_plan_for_update_state_api,
+    delta_channels_with_pending_writes,
     empty_checkpoint,
     get_updated_channels_from_tasks,
+    versions_seen_without_bumps,
 )
 from langgraph.pregel._draw import draw_graph
 from langgraph.pregel._io import map_input, read_channels
@@ -1585,6 +1588,27 @@ async def aget_state_history(
                 checkpoint_tuple.config, checkpoint_tuple, saver=checkpointer
             )
 
+    def _infer_as_node(self, versions_seen: dict[str, ChannelVersions]) -> str | None:
+        if len(self.nodes) == 1:
+            return next(iter(self.nodes))
+        seen = versions_seen_without_bumps(versions_seen)
+        if not any(v for vv in seen.values() for v in vv.values()):
+            if (
+                isinstance(self.input_channels, str)
+                and self.input_channels in self.nodes
+            ):
+                return self.input_channels
+            return None
+        last_seen_by_node = sorted(
+            (v, n) for n, s in seen.items() if n in self.nodes for v in s.values()
+        )
+        # if two nodes updated the state at the same time, it's ambiguous
+        if len(last_seen_by_node) == 1 or (
+            last_seen_by_node and last_seen_by_node[-1][0] != last_seen_by_node[-2][0]
+        ):
+            return last_seen_by_node[-1][1]
+        return None
+
     def bulk_update_state(
         self,
         config: RunnableConfig,
@@ -1619,13 +1643,24 @@ def bulk_update_state(
             return pregel.bulk_update_state(subgraph_config, supersteps)
 
         def perform_superstep(
-            input_config: RunnableConfig, updates: Sequence[StateUpdate]
+            input_config: RunnableConfig,
+            updates: Sequence[StateUpdate],
+            is_first: bool = False,
         ) -> RunnableConfig:
             # get last checkpoint
             config = self._own_checkpoint_config(
                 ensure_config(self.config, input_config)
             )
             saved = checkpointer.get_tuple(config)
+            # Later supersteps, including the one after a `__copy__` (stored
+            # under the base's parent), never walk through the base's writes.
+            fork_pending = (
+                delta_channels_with_pending_writes(
+                    self.channels, saved.pending_writes if saved else None
+                )
+                if is_first
+                else set()
+            )
             if saved is not None:
                 self._migrate_checkpoint(saved.checkpoint)
             checkpoint = (
@@ -1705,17 +1740,25 @@ def perform_superstep(
                         self.trigger_to_nodes,
                     )
                 # save checkpoint
+                next_checkpoint = create_checkpoint(
+                    checkpoint,
+                    channels,
+                    step,
+                    get_next_version=checkpointer.get_next_version,
+                    channels_to_snapshot=fork_pending,
+                    stored_versions=checkpoint_previous_versions,
+                )
                 next_config = checkpointer.put(
                     checkpoint_config,
-                    create_checkpoint(checkpoint, channels, step),
+                    next_checkpoint,
                     {
                         "source": "update",
                         "step": step + 1,
                         "parents": saved.metadata.get("parents", {}) if saved else {},
                     },
                     get_new_channel_versions(
                         checkpoint_previous_versions,
-                        checkpoint["channel_versions"],
+                        next_checkpoint["channel_versions"],
                     ),
                 )
                 return patch_checkpoint_map(
@@ -1744,9 +1787,17 @@ def perform_superstep(
                         if saved and saved.metadata.get("step") is not None
                         else -1
                     )
+                    next_checkpoint = create_checkpoint(
+                        checkpoint,
+                        channels,
+                        next_step,
+                        get_next_version=checkpointer.get_next_version,
+                        channels_to_snapshot=fork_pending,
+                        stored_versions=checkpoint_previous_versions,
+                    )
                     next_config = checkpointer.put(
                         checkpoint_config,
-                        create_checkpoint(checkpoint, channels, next_step),
+                        next_checkpoint,
                         {
                             "source": "input",
                             "step": next_step,
@@ -1756,7 +1807,7 @@ 
```

**File**: `libs/langgraph/tests/memory_assert.py` (modified, +5/-3)
```diff
@@ -85,11 +85,13 @@ def put(
                 )
                 == saved
             ), config["configurable"]["checkpoint_ns"]
+        next_config = super().put(config, checkpoint, metadata, new_versions)
+        # Read back, not the object handed in: a DeltaChannel a step did not
+        # write is refilled on read from the blob its inherited version points at.
         self.storage_for_copies[thread_id][checkpoint_ns][checkpoint["id"]] = (
-            self.serde.dumps_typed(checkpoint)
+            self.serde.dumps_typed(super().get(next_config))
         )
-        # call super to write checkpoint
-        return super().put(config, checkpoint, metadata, new_versions)
+        return next_config
 
 
 class MemorySaverNoPending(InMemorySaver):
```

**File**: `libs/langgraph/tests/test_delta_channel_fork.py` (added, +731/-0)
```diff
@@ -0,0 +1,731 @@
+"""Forking a thread must not replay the abandoned branch into the fork.
+
+Every graph carries a `DeltaChannel` and a plain reducer channel fed the same
+values; the plain channel needs no replay, so it is the oracle.
+"""
+
+import sys
+import threading
+from collections.abc import Sequence
+from operator import add
+from typing import Annotated, Any
+
+import pytest
+from langchain_core.runnables import RunnableConfig
+from langgraph.checkpoint.base import BaseCheckpointSaver
+from langgraph.checkpoint.serde.types import _DeltaSnapshot
+from typing_extensions import TypedDict
+
+from langgraph._internal._constants import INPUT
+from langgraph.channels.delta import DeltaChannel
+from langgraph.errors import NodeError
+from langgraph.graph import END, START, StateGraph
+from langgraph.types import (
+    Command,
+    Durability,
+    Send,
+    StateSnapshot,
+    StateUpdate,
+    interrupt,
+)
+
+pytestmark = pytest.mark.anyio
+NEEDS_CONTEXTVARS = pytest.mark.skipif(
+    sys.version_info < (3, 11),
+    reason="Python 3.11+ is required for async contextvars support",
+)
+
+
+def _append(current: list | None, writes: Sequence[Any]) -> list:
+    out = list(current or [])
+    for write in writes:
+        out.extend(write if isinstance(write, list) else [write])
+    return out
+
+
+class _State(TypedDict):
+    log: Annotated[list, DeltaChannel(_append, snapshot_frequency=1000)]
+    plain: Annotated[list, add]
+    other: Annotated[list, add]
+
+
+def _build(checkpointer: BaseCheckpointSaver, tag: str) -> Any:
+    def node(state: _State) -> dict:
+        return {"log": [f"{tag}-out"], "plain": [f"{tag}-out"]}
+
+    builder = StateGraph(_State)
+    builder.add_node("n", node)
+    builder.set_entry_point("n")
+    builder.set_finish_point("n")
+    return builder.compile(checkpointer=checkpointer)
+
+
+def _build_without_delta_writes(checkpointer: BaseCheckpointSaver, tag: str) -> Any:
+    def node(state: _State) -> dict:
+        return {"other": [f"{tag}-other"]}
+
+    builder = StateGraph(_State)
+    builder.add_node("n", node)
+    builder.set_entry_point("n")
+    builder.set_finish_point("n")
+    return builder.compile(checkpointer=checkpointer)
+
+
+def _thread(thread_id: str) -> RunnableConfig:
+    return {"configurable": {"thread_id": thread_id}}
+
+
+def _at(config: RunnableConfig, snapshot: StateSnapshot) -> RunnableConfig:
+    return {
+        "configurable": {
+            **config["configurable"],
+            "checkpoint_ns": "",
+            "checkpoint_id": snapshot.config["configurable"]["checkpoint_id"],
+        }
+    }
+
+
+def _both(marker: str) -> dict:
+    return {"log": [marker], "plain": [marker]}
+
+
+def _snapshotted_checkpoints(
+    checkpointer: BaseCheckpointSaver, config: RunnableConfig
+) -> list[str]:
+    return [
+        tuple_.config["configurable"]["checkpoint_id"]
+        for tuple_ in checkpointer.list(config)
+        if isinstance(tuple_.checkpoint["channel_values"].get("log"), _DeltaSnapshot)
+    ]
+
+
+def _assert_fork_is_clean(state: StateSnapshot, abandoned: str) -> None:
+    assert state.values["log"] == state.values["plain"], (
+        f"delta channel diverged from the plain channel: "
+        f"{state.values['log']} != {state.values['plain']}"
+    )
+    assert abandoned not in state.values["log"], (
+        f"{abandoned!r} belongs to the branch the fork replaced, "
+        f"but was replayed into {state.values['log']}"
+    )
+
+
+def test_fork_by_invoke(
+    sync_checkpointer: BaseCheckpointSaver, durability: Durability
+) -> None:
+    config = _thread("t")
+    _build(sync_checkpointer, "first").invoke(
+        _both("in-1"), config, durability=durability
+    )
+    graph = _build(sync_checkpointer, "second")
+    graph.invoke(_both("in-2"), config, durability=durability)
+    abandoned_head = graph.get_state(config)
+
+    base = next(
+        snapshot
+        for snapshot in graph.get_state_history(config)
+        if "in-2" not in snapshot.values["log"]
+    )
+    _build(sync_checkpointer, "third").invoke(
+        _both("in-3"), _at(config, base), durability=durability
+    )
+
+    state = graph.get_state(config)
+    _assert_fork_is_clean(state, "in-2")
+    assert state.values["log"] == [*base.values["log"], "in-3", "third-out"]
+
+    abandoned = graph.get_state(abandoned_head.config).values
+    assert abandoned["log"] == abandoned["plain"] == abandoned_head.values["log"]
+
+
+async def test_afork_by_invoke(
+    async_checkpointer: BaseCheckpointSaver, durability: Durability
+) -> None:
+    config = _thread("t")
+    await _build(async_checkpointer, "first").ainvoke(
+        _both("in-1"), config, durability=durability
+    )
+    graph = _build(async_checkpointer, "second")
+    await graph.ainvoke(_both("in-2"), config, durability=durability)
+    abandoned_head = await graph.aget_state(config)
+
+    base = await anext(
+        snapshot
+        async for snapshot in graph.aget_state_hist
```

**File**: `libs/langgraph/tests/test_delta_channel_supersteps_bound.py` (modified, +28/-2)
```diff
@@ -94,6 +94,28 @@ async def test_forced_snapshot_single_run() -> None:
         assert "seed-a" in state.values["a"]
 
 
+async def test_supersteps_bound_skips_a_channel_never_written() -> None:
+    with patch(
+        "langgraph.pregel._checkpoint.DELTA_MAX_SUPERSTEPS_SINCE_SNAPSHOT",
+        3,
+    ):
+        saver = InMemorySaver()
+        graph = _build_two_channel_graph(saver, n_loops=4)
+        config = {"configurable": {"thread_id": "never-written"}}
+
+        graph.invoke({"a": ["seed-a"]}, config)
+
+        minted = [
+            t.config["configurable"]["checkpoint_id"]
+            for t in saver.list(config)
+            if "b" in t.checkpoint["channel_versions"]
+        ]
+        assert not minted, (
+            f"b was never written, but {len(minted)} checkpoints minted it a version"
+        )
+        assert graph.get_state(config).values["b"] == []
+
+
 async def test_forced_snapshot_accumulates_across_runs() -> None:
     """Supersteps counter for an unwritten channel persists across separate
     invoke() calls. After enough runs, the channel is force-snapshotted."""
@@ -139,13 +161,17 @@ async def test_predicate_fires_on_supersteps_overflow() -> None:
     channels = {"x": ch_instance}
     counters: dict[str, tuple[int, int]] = {"x": (0, 5000)}
 
-    result = delta_channels_to_snapshot(channels, counters)
+    result = delta_channels_to_snapshot(channels, counters, {"x": 1})
     assert "x" in result
 
     counters_below: dict[str, tuple[int, int]] = {"x": (0, 4999)}
-    result2 = delta_channels_to_snapshot(channels, counters_below)
+    result2 = delta_channels_to_snapshot(channels, counters_below, {"x": 1})
     assert "x" not in result2
 
+    assert not delta_channels_to_snapshot(channels, counters, {}), (
+        "a channel with no version was never written, so it has nothing to snapshot"
+    )
+
 
 async def test_counter_reset_after_supersteps_snapshot() -> None:
     """After the supersteps bound triggers a snapshot, the counters for
```

**File**: `libs/langgraph/tests/test_delta_channel_update_state.py` (modified, +57/-0)
```diff
@@ -113,6 +113,37 @@ def test_fresh_update_state_head_snapshots_delta_channel() -> None:
     assert "counters_since_delta_snapshot" not in head.metadata
 
 
+def test_fresh_update_state_stores_nothing_for_a_delta_channel_it_did_not_write() -> (
+    None
+):
+    saver = InMemorySaver()
+    State = TypedDict(  # type: ignore[call-overload]  # noqa: UP013
+        "State",
+        {
+            "messages": Annotated[list, DeltaChannel(_messages_delta_reducer)],
+            "notes": Annotated[list, DeltaChannel(_messages_delta_reducer)],
+        },
+    )
+    graph = (
+        StateGraph(State)
+        .add_node("model", lambda state: {})
+        .add_edge(START, "model")
+        .compile(checkpointer=saver)
+    )
+    config = {"configurable": {"thread_id": "fresh-unwritten"}}
+
+    graph.update_state(
+        config,
+        {"messages": [HumanMessage(content="hello", id="m1")]},
+        as_node="model",
+    )
+
+    head = saver.get_tuple(config)
+    assert head is not None
+    assert "notes" not in head.checkpoint["channel_versions"]
+    assert graph.get_state(config).values["notes"] == []
+
+
 # ---------------------------------------------------------------------------
 # Non-fresh thread: update_state after invoke
 # ---------------------------------------------------------------------------
@@ -338,3 +369,29 @@ def test_state_history_chain_after_fresh_update_state_delta_channel() -> None:
     assert update_snapshot.metadata["step"] == 0
     assert update_snapshot.parent_config is None
     assert [m.content for m in update_snapshot.values["messages"]] == ["hello"]
+
+
+def test_update_state_that_snapshots_keeps_a_deferred_node_pending() -> None:
+    channel = DeltaChannel(_messages_delta_reducer, snapshot_frequency=1)
+
+    class State(TypedDict):
+        messages: Annotated[list, channel]
+
+    builder = StateGraph(State)
+    builder.add_node("a", lambda state: {"messages": [HumanMessage("a", id="a")]})
+    builder.add_node(
+        "b", lambda state: {"messages": [HumanMessage("b", id="b")]}, defer=True
+    )
+    builder.add_node("c", lambda state: {})
+    builder.add_edge(START, "a")
+    builder.add_edge("a", "b")
+    builder.add_edge("a", "c")
+    graph = builder.compile(checkpointer=InMemorySaver(), interrupt_after=["a"])
+    config = {"configurable": {"thread_id": "t"}}
+    graph.invoke({"messages": [HumanMessage("s", id="s")]}, config)
+
+    graph.update_state(config, {"messages": [HumanMessage("u", id="u")]}, as_node="c")
+    final = graph.invoke(None, config)
+
+    assert [m.content for m in final["messages"]] == ["s", "a", "u", "b"]
+    assert graph.get_state(config).next == ()
```

---

### Incident Patch 6: `3af26317` (2026-10-02)
**Commit Message**: fix(langgraph): hydrate subgraph delta channels with the caller-resolved saver (#8538)

Fixes langchain-ai/langgraph#8470
Fixes langchain-ai/langgraph#8653

Reported by @gururafiki, with a self-contained `InMemorySaver` repro and
the observation that non-delta channels in the same namespace hydrate
fine, which is what makes the failure silent. @doniyor2109 reported
#8653, the same missing saver at the root: a graph compiled without a
checkpointer, whose saver arrives through the config, read the channel
back empty in `get_state`, `get_state_history` and `update_state`.

### The bug, in one read

One subgraph state, two channels written by the same nodes: `delta` is a
`DeltaChannel`, `plain` is an `operator.add` list. Pause the subgraph
before its second node and read it through the documented
`get_state(config, subgraphs=True).tasks[0].state`:

```
main:   {'delta': [],     'plain': ['a1']}
branch: {'delta': ['a1'], 'plain': ['a1']}
```

Same call, same instant, same state object. If this were a rule about
how subgraphs manage state, both channels would be empty. Only the delta
one is, because it is the one channel type that stores nothing in
`channel_values` and has to replay its 

**File**: `libs/langgraph/langgraph/pregel/_checkpoint.py` (modified, +16/-0)
```diff
@@ -226,6 +226,20 @@ def _needs_replay(spec: BaseChannel, stored: object) -> bool:
     return stored is MISSING
 
 
+def _require_saver_for_history(
+    checkpoint: Checkpoint,
+    delta_channels: list[str],
+    saver: BaseCheckpointSaver | None,
+    config: RunnableConfig | None,
+) -> None:
+    written = [k for k in delta_channels if k in checkpoint["channel_versions"]]
+    if written and (saver is None or config is None):
+        raise ValueError(
+            f"DeltaChannel {written} has history to replay but no checkpointer "
+            "or config was passed to read it"
+        )
+
+
 def channels_from_checkpoint(
     specs: Mapping[str, BaseChannel | ManagedValueSpec],
     checkpoint: Checkpoint,
@@ -256,6 +270,7 @@ def channels_from_checkpoint(
         for k, spec in channel_specs.items()
         if _needs_replay(spec, checkpoint["channel_values"].get(k, MISSING))
     ]
+    _require_saver_for_history(checkpoint, delta_channels, saver, config)
     histories: Mapping[str, Any] = {}
     if delta_channels and saver is not None and config is not None:
         histories = saver.get_delta_channel_history(
@@ -298,6 +313,7 @@ async def achannels_from_checkpoint(
         for k, spec in channel_specs.items()
         if _needs_replay(spec, checkpoint["channel_values"].get(k, MISSING))
     ]
+    _require_saver_for_history(checkpoint, delta_channels, saver, config)
     histories: Mapping[str, Any] = {}
     if delta_channels and saver is not None and config is not None:
         histories = await saver.aget_delta_channel_history(
```

**File**: `libs/langgraph/langgraph/pregel/main.py` (modified, +128/-191)
```diff
@@ -835,6 +835,64 @@ def __init__(
         if auto_validate:
             self.validate()
 
+    def _resolve_checkpointer(
+        self, config: RunnableConfig
+    ) -> BaseCheckpointSaver | None:
+        """The saver runs and state methods use: none for `checkpointer=False`,
+        else the one a parent lends a subgraph through the config, else this
+        graph's own."""
+        if self.checkpointer is False:
+            return None
+        conf = config.get(CONF, {})
+        if CONFIG_KEY_CHECKPOINTER in conf:
+            checkpointer = conf[CONFIG_KEY_CHECKPOINTER]
+        elif self.checkpointer is True:
+            raise RuntimeError("checkpointer=True cannot be used for root graphs.")
+        else:
+            checkpointer = self.checkpointer
+        if isinstance(checkpointer, BaseCheckpointSaver):
+            checkpointer = self._apply_checkpointer_allowlist(checkpointer)
+        return checkpointer
+
+    def _state_checkpointer(self, config: RunnableConfig) -> BaseCheckpointSaver:
+        checkpointer = self._resolve_checkpointer(ensure_config(config))
+        if not isinstance(checkpointer, BaseCheckpointSaver):
+            raise ValueError("No checkpointer set")
+        return checkpointer
+
+    def _own_checkpoint_config(self, config: RunnableConfig) -> RunnableConfig:
+        """A `checkpointer=True` subgraph keeps one history per thread, stored
+        under its namespace with the task ids removed."""
+        if self.checkpointer is not True:
+            return config
+        ns = config[CONF].get(CONFIG_KEY_CHECKPOINT_NS, "")
+        # Unlike `recast_checkpoint_ns`, keep the numeric parts: a task that
+        # calls the same subgraph again stores that call's history under one.
+        return patch_configurable(
+            config,
+            {
+                CONFIG_KEY_CHECKPOINT_NS: NS_SEP.join(
+                    part.split(NS_END)[0] for part in ns.split(NS_SEP)
+                )
+            },
+        )
+
+    def _subgraph_for_namespace(
+        self, config: RunnableConfig, checkpointer: BaseCheckpointSaver
+    ) -> tuple[PregelProtocol, RunnableConfig] | None:
+        """The subgraph a state method's namespaced config addresses, and the
+        config to call it with, lending it `checkpointer`. `None` when the
+        config is for this graph."""
+        checkpoint_ns = config[CONF].get(CONFIG_KEY_CHECKPOINT_NS, "")
+        if not checkpoint_ns or CONFIG_KEY_CHECKPOINTER in config[CONF]:
+            return None
+        recast = recast_checkpoint_ns(checkpoint_ns)
+        for _, pregel in self.get_subgraphs(namespace=recast, recurse=True):
+            return pregel, patch_configurable(
+                config, {CONFIG_KEY_CHECKPOINTER: checkpointer}
+            )
+        raise ValueError(f"Subgraph {recast} not found")
+
     def _apply_checkpointer_allowlist(
         self, checkpointer: BaseCheckpointSaver | None
     ) -> BaseCheckpointSaver | None:
@@ -1146,7 +1204,9 @@ def _prepare_state_snapshot(
         self,
         config: RunnableConfig,
         saved: CheckpointTuple | None,
-        recurse: BaseCheckpointSaver | None = None,
+        *,
+        saver: BaseCheckpointSaver,
+        recurse: bool = False,
         live: bool = False,
     ) -> StateSnapshot:
         """Build a `StateSnapshot` from a saved checkpoint and its pending writes.
@@ -1177,9 +1237,7 @@ def _prepare_state_snapshot(
         channels, managed = channels_from_checkpoint(
             self.channels,
             saved.checkpoint,
-            saver=self.checkpointer
-            if isinstance(self.checkpointer, BaseCheckpointSaver)
-            else None,
+            saver=saver,
             config=saved.config,
         )
         # tasks for this checkpoint
@@ -1194,11 +1252,7 @@ def _prepare_state_snapshot(
             stop,
             for_execution=True,
             store=self.store,
-            checkpointer=(
-                self.checkpointer
-                if isinstance(self.checkpointer, BaseCheckpointSaver)
-                else None
-            ),
+            checkpointer=saver,
             manager=None,
         )
         # get the subgraphs
@@ -1225,7 +1279,7 @@ def _prepare_state_snapshot(
                 # get the state of the subgraph
                 config = {
                     CONF: {
-                        CONFIG_KEY_CHECKPOINTER: recurse,
+                        CONFIG_KEY_CHECKPOINTER: saver,
                         "thread_id": saved.config[CONF]["thread_id"],
                         CONFIG_KEY_CHECKPOINT_NS: task_ns,
                     }
@@ -1275,7 +1329,9 @@ async def _aprepare_state_snapshot(
         self,
         config: RunnableConfig,
         saved: CheckpointTuple | None,
-        recurse: BaseCheckpointSaver | None = None,
+        *,
+        saver: BaseCheckpointSaver,
+        recurse: bool = False,
         live: bool = False,
     ) -> StateSnapshot:
         """Build a `StateSnap
```

**File**: `libs/langgraph/tests/test_delta_channel_subgraph.py` (added, +496/-0)
```diff
@@ -0,0 +1,496 @@
+import operator
+from typing import Annotated, Any, Literal
+
+import pytest
+from langchain_core.runnables import RunnableConfig
+from langgraph.checkpoint.base import BaseCheckpointSaver
+from langgraph.checkpoint.memory import InMemorySaver
+from typing_extensions import TypedDict
+
+from langgraph._internal._constants import CONFIG_KEY_CHECKPOINTER
+from langgraph.channels.delta import DeltaChannel
+from langgraph.graph import END, START, StateGraph
+from langgraph.pregel._checkpoint import (
+    achannels_from_checkpoint,
+    channels_from_checkpoint,
+    empty_checkpoint,
+)
+
+pytestmark = pytest.mark.anyio
+
+
+def _extend(state: list | None, writes: list[Any]) -> list:
+    out = list(state or [])
+    for write in writes:
+        out.extend(write if isinstance(write, list) else [write])
+    return out
+
+
+def _state_schema(snapshot_frequency: int = 1000) -> type:
+    class State(TypedDict, total=False):
+        delta: Annotated[
+            list, DeltaChannel(_extend, snapshot_frequency=snapshot_frequency)
+        ]
+        plain: Annotated[list, operator.add]
+
+    return State
+
+
+def _both(*items: str) -> dict:
+    return {"delta": list(items), "plain": list(items)}
+
+
+def _child_builder(*, snapshot_frequency: int = 1000) -> StateGraph:
+    builder = StateGraph(_state_schema(snapshot_frequency))
+    builder.add_node("a", lambda state: _both("a1"))
+    builder.add_node("b", lambda state: _both("b1", "b2"))
+    builder.add_edge(START, "a")
+    builder.add_edge("a", "b")
+    builder.add_edge("b", END)
+    return builder
+
+
+def _wrap(
+    inner: StateGraph,
+    *,
+    checkpointer: bool | None = None,
+    interrupt_before: list[str] | None = None,
+) -> StateGraph:
+    builder = StateGraph(inner.state_schema)
+    builder.add_node(
+        "child",
+        inner.compile(checkpointer=checkpointer, interrupt_before=interrupt_before),
+    )
+    builder.add_edge(START, "child")
+    builder.add_edge("child", END)
+    return builder
+
+
+def _nested_app(
+    checkpointer: BaseCheckpointSaver,
+    *,
+    depth: int = 1,
+    snapshot_frequency: int = 1000,
+    pause_before_b: bool = False,
+    subgraph_checkpointer: bool | None = None,
+) -> Any:
+    graph = _child_builder(snapshot_frequency=snapshot_frequency)
+    for _ in range(depth):
+        graph = _wrap(
+            graph,
+            checkpointer=subgraph_checkpointer,
+            interrupt_before=["b"] if pause_before_b else None,
+        )
+    return graph.compile(checkpointer=checkpointer)
+
+
+def _scoped(config: dict, namespace: str) -> dict:
+    return {"configurable": {**config["configurable"], "checkpoint_ns": namespace}}
+
+
+def _child_namespace(app: Any, config: dict, *, depth: int = 1) -> str:
+    namespace = ""
+    for level in range(depth):
+        scoped = _scoped(config, namespace) if namespace else config
+        namespace = next(
+            (
+                task.state["configurable"]["checkpoint_ns"]
+                for snapshot in app.get_state_history(scoped)
+                for task in snapshot.tasks
+                if task.name == "child" and isinstance(task.state, dict)
+            ),
+            "",
+        )
+        assert namespace, f"no `child` subgraph task at nesting level {level}"
+    return namespace
+
+
+async def _achild_namespace(app: Any, config: dict) -> str:
+    async for snapshot in app.aget_state_history(config):
+        for task in snapshot.tasks:
+            if task.name == "child" and isinstance(task.state, dict):
+                return task.state["configurable"]["checkpoint_ns"]
+    raise AssertionError("no `child` subgraph task")
+
+
+HISTORY = [_both("a1", "b1", "b2"), _both("a1"), _both(), _both()]
+
+
+def test_subgraph_get_state(sync_checkpointer: BaseCheckpointSaver) -> None:
+    app = _nested_app(sync_checkpointer)
+    config = {"configurable": {"thread_id": "1"}}
+    app.invoke({}, config)
+
+    child = _scoped(config, _child_namespace(app, config))
+
+    assert app.get_state(config).values == _both("a1", "b1", "b2")
+    assert app.get_state(child).values == _both("a1", "b1", "b2")
+
+
+async def test_subgraph_aget_state(async_checkpointer: BaseCheckpointSaver) -> None:
+    app = _nested_app(async_checkpointer)
+    config = {"configurable": {"thread_id": "1"}}
+    await app.ainvoke({}, config)
+
+    child = _scoped(config, await _achild_namespace(app, config))
+
+    assert (await app.aget_state(child)).values == _both("a1", "b1", "b2")
+
+
+def test_subgraph_get_state_history(sync_checkpointer: BaseCheckpointSaver) -> None:
+    app = _nested_app(sync_checkpointer)
+    config = {"configurable": {"thread_id": "1"}}
+    app.invoke({}, config)
+
+    child = _scoped(config, _child_namespace(app, config))
+
+    assert [s.values for s in app.get_state_history(child)] == HISTORY
+
+
+async def test_subgraph_aget_state_history(
+    async_checkpointer: BaseCheckpointSaver,
+) -> None:
+    app = _nested
```

---

### Incident Patch 7: `e6cf9ea6` (2026-10-02)
**Commit Message**: fix(langgraph): stop reporting answered interrupts in get_state (#9103)

Execution, snapshots, and resume checks interpreted the same pending
writes separately.

When one of several interrupted tasks finished after resuming,
`get_state()` still reported its answered question as pending.

Use `read_task_statuses()` across execution, state reads, and resume
checks.
An output write marks a task finished; `RESUME` alone does not, since
the
task may pause again. Record `NO_WRITES` when a resumed task completes
without output, so it isn't run again.

Latest-state reads now omit interrupts from finished tasks. History and
explicit checkpoint reads still show the last recorded interrupt per
task. A task paused at its second interrupt appears in `next` with
`result=None`. `Command(resume=value)` without an id now raises when
more than one interrupt is pending, including in a subgraph.

Threads paused before this change, where a resumed task finished without
output, still show that task as unfinished. It appears in `next` and its
answered interrupt counts as pending, so if another interrupt is also
pending, `Command(resume=value)` without an id raises. Resume these
threads by interrupt id. O

**File**: `libs/langgraph/langgraph/pregel/_loop.py` (modified, +11/-35)
```diff
@@ -119,6 +119,7 @@
 )
 from langgraph.pregel._messages import ensure_message_ids
 from langgraph.pregel._read import PregelNode
+from langgraph.pregel._task_status import read_task_statuses
 from langgraph.pregel._utils import get_new_channel_versions, is_xxh3_128_hexdigest
 from langgraph.pregel.debug import (
     map_debug_checkpoint,
@@ -736,17 +737,14 @@ async def amatch_cached_writes(self) -> Sequence[PregelExecutableTask]:
     def _reapply_writes_to_succeeded_nodes(
         self, tasks: Mapping[str, PregelExecutableTask]
     ) -> None:
-        """Restore successful channel writes from checkpoint to in-memory tasks.
+        """Restore the output of finished tasks from checkpoint to in-memory tasks.
 
-        Skips control signals (ERROR, ERROR_SOURCE_NODE, INTERRUPT, RESUME)
-        so that failed/interrupted tasks remain with empty writes and will be
-        re-executed (or routed to error handlers) by the runner.
+        Unfinished (failed or interrupted) tasks keep empty writes, so the
+        runner re-executes them or routes them to error handlers.
         """
-        for tid, k, v in self.checkpoint_pending_writes:
-            if k in (ERROR, ERROR_SOURCE_NODE, INTERRUPT, RESUME):
-                continue
+        for tid, status in read_task_statuses(self.checkpoint_pending_writes).items():
             if task := tasks.get(tid):
-                task.writes.append((k, v))
+                task.writes.extend(status.output)
 
     def _resume_error_handlers_if_applicable(self) -> None:
         """On resume, schedule error handlers for tasks that failed in a prior run.
@@ -816,35 +814,13 @@ def _resume_error_handlers_if_applicable(self) -> None:
                 self.tasks[handler_task.id] = handler_task
 
     def _pending_interrupts(self) -> set[str]:
-        """Return the set of interrupt ids that are pending without corresponding resume values."""
-        # mapping of task ids to interrupt ids
-        pending_interrupts: dict[str, str] = {}
-
-        # set of resume task ids
-        pending_resumes: set[str] = set()
-
-        for task_id, write_type, value in self.checkpoint_pending_writes:
-            if write_type == INTERRUPT:
-                # interrupts is always a list, but there should only be one element
-                pending_interrupts[task_id] = value[0].id
-            elif write_type == RESUME:
-                pending_resumes.add(task_id)
-
-        resumed_interrupt_ids = {
-            pending_interrupts[task_id]
-            for task_id in pending_resumes
-            if task_id in pending_interrupts
-        }
-
-        # Keep only interrupts whose interrupt_id is not resumed
-        hanging_interrupts: set[str] = {
-            interrupt_id
-            for interrupt_id in pending_interrupts.values()
-            if interrupt_id not in resumed_interrupt_ids
+        """Return the ids of interrupts that are still waiting for an answer."""
+        return {
+            interrupt.id
+            for status in read_task_statuses(self.checkpoint_pending_writes).values()
+            for interrupt in status.pending_interrupts
         }
 
-        return hanging_interrupts
-
     def _first(
         self, *, input_keys: str | Sequence[str], updated_channels: set[str] | None
     ) -> set[str] | None:
```

**File**: `libs/langgraph/langgraph/pregel/_runner.py` (modified, +4/-2)
```diff
@@ -45,6 +45,7 @@
 from langgraph.pregel._algo import Call
 from langgraph.pregel._executor import Submit
 from langgraph.pregel._retry import arun_with_retry, run_with_retry
+from langgraph.pregel._task_status import CONTROL_WRITES
 from langgraph.types import (
     CachePolicy,
     PregelExecutableTask,
@@ -606,8 +607,9 @@ def commit(
                 task.config is None or TAG_HIDDEN not in task.config.get("tags", [])
             ):
                 self.node_finished(task.name)
-            if not task.writes:
-                # add no writes marker
+            if all(chan in CONTROL_WRITES for chan, _ in task.writes):
+                # record that the task finished, even if it produced no output
+                # (see `langgraph.pregel._task_status`)
                 task.writes.append((NO_WRITES, None))
             # save task writes to checkpointer
             self.put_writes()(task.id, task.writes)  # type: ignore[misc]
```

**File**: `libs/langgraph/langgraph/pregel/_task_status.py` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+"""Read the status of each task from the writes recorded for a superstep.
+
+While a superstep is open, the checkpointer keeps a log of writes for each
+task in that step. Entries are added as tasks run and are only discarded when
+the whole superstep finishes and a new checkpoint is saved. When a task runs
+again, for example after being resumed, its earlier entries stay in the log.
+
+This module is the single place that turns that log into task status. Code that
+needs to know whether a task finished, which interrupts it raised, which of them
+are still waiting for an answer, or which output it produced must use
+`read_task_statuses` instead of inspecting the writes directly.
+
+The log uses two kinds of writes:
+
+- Control writes describe what happened to a task: `INTERRUPT` (the task asked
+  a question), `RESUME` (answers the task has received), `ERROR`, and
+  `ERROR_SOURCE_NODE`. `INTERRUPT`, `RESUME` and `ERROR` each have a fixed slot
+  per task (`WRITES_IDX_MAP`), so a newer write of the same kind can replace an
+  older one.
+- Every other write is output: channel writes, `RETURN` for functional tasks,
+  and the `NO_WRITES` marker.
+
+The rules are:
+
+1. When a task that ran finishes successfully, `PregelRunner.commit` records at
+   least one output write, adding `NO_WRITES` if the task produced no other
+   output.
+2. A task that pauses at an interrupt records only control writes.
+3. A task is therefore treated as finished if and only if it has an output
+   write.
+4. Because `INTERRUPT` is stored in a fixed slot, its recorded value is the most
+   recent question the task asked. That question is waiting for an answer only
+   while the task is unfinished.
+
+A `RESUME` write never means a task is finished: it can hold the answer to an
+earlier question while the task waits on a later one.
+
+What these rules cannot see:
+
+- A task whose result came from the cache does not go through
+  `PregelRunner.commit`, so nothing is recorded for it. It reads as not
+  finished.
+- A task that fails can record partial output writes along with its error. It
+  reads as finished, which is how the executor has always treated it.
+- Writes recorded before rule 1 existed may describe a finished task with no
+  output using only control writes. Those tasks read as unfinished. The
+  executor treated them the same way before and runs them again. Their last
+  interrupt now counts as pending, so they appear in `next` and a resume
+  without an interrupt id raises if another interrupt is also pending.
+"""
+
+from __future__ import annotations
+
+from collections.abc import Iterable, Sequence
+from dataclasses import dataclass
+from typing import Any
+
+from langgraph.checkpoint.base import PendingWrite
+
+from langgraph._internal._constants import (
+    ERROR,
+    ERROR_SOURCE_NODE,
+    INTERRUPT,
+    NULL_TASK_ID,
+    RESUME,
+)
+from langgraph.types import Interrupt
+
+__all__ = ("CONTROL_WRITES", "TaskStatus", "read_task_statuses")
+
+CONTROL_WRITES = frozenset((ERROR, ERROR_SOURCE_NODE, INTERRUPT, RESUME))
+"""Channels that describe what happened to a task rather than what it produced."""
+
+
+@dataclass(frozen=True, slots=True)
+class TaskStatus:
+    """The status of one task, read from the writes recorded for its superstep."""
+
+    output: tuple[tuple[str, Any], ...] = ()
+    """Output writes in recorded order. Empty if the task has not finished."""
+
+    interrupts: tuple[Interrupt, ...] = ()
+    """The most recent interrupts the task raised, whether or not they were answered."""
+
+    error: BaseException | None = None
+    """The recorded error, if any."""
+
+    @property
+    def finished(self) -> bool:
+        """Whether the task ran to completion."""
+        return bool(self.output)
+
+    @property
+    def pending_interrupts(self) -> tuple[Interrupt, ...]:
+        """Interrupts waiting for an answer. Always empty for a finished task."""
+        return () if self.finished else self.interrupts
+
+
+def read_task_statuses(
+    pending_writes: Iterable[PendingWrite],
+) -> dict[str, TaskStatus]:
+    """Return the status of every task that has recorded writes, keyed by task id.
+
+    Writes from `NULL_TASK_ID` are input to the superstep, not task activity, so
+    they are not included.
+    """
+    output: dict[str, list[tuple[str, Any]]] = {}
+    interrupts: dict[str, list[Interrupt]] = {}
+    errors: dict[str, BaseException] = {}
+    for task_id, channel, value in pending_writes:
+        if task_id == NULL_TASK_ID:
+            continue
+        output.setdefault(task_id, [])
+        if channel == INTERRUPT:
+            interrupts.setdefault(task_id, []).extend(
+                value if isinstance(value, Sequence) else [value]
+            )
+        elif channel == ERROR:
+            errors.setdefault(task_id, value)
+        elif channel not in CONTROL_WRITES:
+            output[task_id].append((channel, value))
+    return {
+        task_id:
```

**File**: `libs/langgraph/langgraph/pregel/debug.py` (modified, +18/-33)
```diff
@@ -26,6 +26,7 @@
 from langgraph.channels.base import BaseChannel
 from langgraph.constants import TAG_HIDDEN
 from langgraph.pregel._io import read_channels
+from langgraph.pregel._task_status import TaskStatus, read_task_statuses
 from langgraph.types import (
     CheckpointPayload,
     PregelExecutableTask,
@@ -37,6 +38,8 @@
 
 TASK_NAMESPACE = UUID("6ba7b831-9dad-11d1-80b4-00c04fd430c8")
 
+_NOT_STARTED = TaskStatus()
+
 
 def map_debug_tasks(tasks: Iterable[PregelExecutableTask]) -> Iterator[TaskPayload]:
     """Produce "task" events for stream_mode=debug."""
@@ -211,35 +214,21 @@ def tasks_w_writes(
     pending_writes: list[PendingWrite] | None,
     states: dict[str, RunnableConfig | StateSnapshot] | None,
     output_keys: str | Sequence[str],
+    *,
+    live: bool = False,
 ) -> tuple[PregelTask, ...]:
-    """Apply writes / subgraph states to tasks to be returned in a StateSnapshot."""
-    pending_writes = pending_writes or []
+    """Apply writes / subgraph states to tasks to be returned in a StateSnapshot.
+
+    With `live=True`, tasks report only the interrupts still waiting for an
+    answer, as of the most recent writes. Otherwise tasks report the interrupts
+    they raised in the step, including answered ones, as a record of the step.
+    """
+    statuses = read_task_statuses(pending_writes or [])
     out: list[PregelTask] = []
     for task in tasks:
-        rtn = next(
-            (
-                val
-                for tid, chan, val in pending_writes
-                if tid == task.id and chan == RETURN
-            ),
-            MISSING,
-        )
-        task_error = next(
-            (exc for tid, n, exc in pending_writes if tid == task.id and n == ERROR),
-            None,
-        )
-        task_interrupts = tuple(
-            v
-            for tid, n, vv in pending_writes
-            if tid == task.id and n == INTERRUPT
-            for v in (vv if isinstance(vv, Sequence) else [vv])
-        )
-
-        task_writes = [
-            (chan, val)
-            for tid, chan, val in pending_writes
-            if tid == task.id and chan not in (ERROR, INTERRUPT, RETURN)
-        ]
+        status = statuses.get(task.id, _NOT_STARTED)
+        rtn = next((val for chan, val in status.output if chan == RETURN), MISSING)
+        task_writes = [(chan, val) for chan, val in status.output if chan != RETURN]
 
         if rtn is not MISSING:
             task_result = rtn
@@ -261,19 +250,15 @@ def tasks_w_writes(
             mapped_writes = map_task_result_writes(filtered_writes)
             task_result = mapped_writes if filtered_writes else {}
 
-        has_writes = rtn is not MISSING or any(
-            w[0] == task.id and w[1] not in (ERROR, INTERRUPT) for w in pending_writes
-        )
-
         out.append(
             PregelTask(
                 task.id,
                 task.name,
                 task.path,
-                task_error,
-                task_interrupts,
+                status.error,
+                status.pending_interrupts if live else status.interrupts,
                 states.get(task.id) if states else None,
-                task_result if has_writes else None,
+                task_result if status.finished else None,
             )
         )
     return tuple(out)
```

**File**: `libs/langgraph/langgraph/pregel/main.py` (modified, +43/-33)
```diff
@@ -79,7 +79,6 @@
     CONFIG_KEY_STREAM_MESSAGES_V2,
     CONFIG_KEY_TASK_ID,
     CONFIG_KEY_THREAD_ID,
-    ERROR,
     INPUT,
     INTERRUPT,
     NS_END,
@@ -149,6 +148,7 @@
 from langgraph.pregel._read import DEFAULT_BOUND, PregelNode
 from langgraph.pregel._retry import RetryPolicy
 from langgraph.pregel._runner import PregelRunner
+from langgraph.pregel._task_status import read_task_statuses
 from langgraph.pregel._tools import StreamToolCallHandler
 from langgraph.pregel._utils import (
     get_new_channel_versions,
@@ -1147,8 +1147,16 @@ def _prepare_state_snapshot(
         config: RunnableConfig,
         saved: CheckpointTuple | None,
         recurse: BaseCheckpointSaver | None = None,
-        apply_pending_writes: bool = False,
+        live: bool = False,
     ) -> StateSnapshot:
+        """Build a `StateSnapshot` from a saved checkpoint and its pending writes.
+
+        With `live=True` the snapshot shows current status: values include the
+        output of tasks that already finished, `next` lists only tasks that still
+        need to run, and `interrupts` lists only questions still waiting for an
+        answer. Otherwise the snapshot is a record of the step: values as of the
+        start of the step, every task in the step, and the interrupts they raised.
+        """
         if not saved:
             return StateSnapshot(
                 values={},
@@ -1236,13 +1244,10 @@ def _prepare_state_snapshot(
                 None,
                 self.trigger_to_nodes,
             )
-        if apply_pending_writes and saved.pending_writes:
-            for tid, k, v in saved.pending_writes:
-                if k in (ERROR, INTERRUPT):
-                    continue
-                if tid not in next_tasks:
-                    continue
-                next_tasks[tid].writes.append((k, v))
+        if live and saved.pending_writes:
+            for tid, status in read_task_statuses(saved.pending_writes).items():
+                if tid in next_tasks:
+                    next_tasks[tid].writes.extend(status.output)
             if tasks := [t for t in next_tasks.values() if t.writes]:
                 apply_writes(
                     saved.checkpoint, channels, tasks, None, self.trigger_to_nodes
@@ -1252,6 +1257,7 @@ def _prepare_state_snapshot(
             saved.pending_writes,
             task_states,
             self.stream_channels_asis,
+            live=live,
         )
         # assemble the state snapshot
         return StateSnapshot(
@@ -1270,8 +1276,16 @@ async def _aprepare_state_snapshot(
         config: RunnableConfig,
         saved: CheckpointTuple | None,
         recurse: BaseCheckpointSaver | None = None,
-        apply_pending_writes: bool = False,
+        live: bool = False,
     ) -> StateSnapshot:
+        """Build a `StateSnapshot` from a saved checkpoint and its pending writes.
+
+        With `live=True` the snapshot shows current status: values include the
+        output of tasks that already finished, `next` lists only tasks that still
+        need to run, and `interrupts` lists only questions still waiting for an
+        answer. Otherwise the snapshot is a record of the step: values as of the
+        start of the step, every task in the step, and the interrupts they raised.
+        """
         if not saved:
             return StateSnapshot(
                 values={},
@@ -1359,13 +1373,10 @@ async def _aprepare_state_snapshot(
                 None,
                 self.trigger_to_nodes,
             )
-        if apply_pending_writes and saved.pending_writes:
-            for tid, k, v in saved.pending_writes:
-                if k in (ERROR, INTERRUPT):
-                    continue
-                if tid not in next_tasks:
-                    continue
-                next_tasks[tid].writes.append((k, v))
+        if live and saved.pending_writes:
+            for tid, status in read_task_statuses(saved.pending_writes).items():
+                if tid in next_tasks:
+                    next_tasks[tid].writes.extend(status.output)
             if tasks := [t for t in next_tasks.values() if t.writes]:
                 apply_writes(
                     saved.checkpoint, channels, tasks, None, self.trigger_to_nodes
@@ -1376,6 +1387,7 @@ async def _aprepare_state_snapshot(
             saved.pending_writes,
             task_states,
             self.stream_channels_asis,
+            live=live,
         )
         # assemble the state snapshot
         return StateSnapshot(
@@ -1430,7 +1442,7 @@ def get_state(
             config,
             saved,
             recurse=checkpointer if subgraphs else None,
-            apply_pending_writes=CONFIG_KEY_CHECKPOINT_ID not in config[CONF],
+            live=CONFIG_KEY_CHECKPOINT_ID not in config[CONF],
         )
 
     async def aget_state(
@@ -1474,7 +1486,7 @@ async def aget_state(
             config,
             saved,
             recurse=checkpointer if subgraphs else None,
-   
```

**File**: `libs/langgraph/langgraph/types.py` (modified, +7/-1)
```diff
@@ -726,7 +726,13 @@ class StateSnapshot(NamedTuple):
     tasks: tuple[PregelTask, ...]
     """Tasks to execute in this step. If already attempted, may contain an error."""
     interrupts: tuple[Interrupt, ...]
-    """Interrupts that occurred in this step that are pending resolution."""
+    """Interrupts that occurred in this step.
+
+    When reading the latest state (`get_state` without a `checkpoint_id`), this
+    contains only interrupts still waiting for an answer. When reading a specific
+    checkpoint or state history, it contains the most recent interrupt each task
+    raised in that step, including ones answered later in the same step.
+    """
 
 
 class Send:
```

**File**: `libs/langgraph/tests/test_interrupt_state.py` (added, +534/-0)
```diff
@@ -0,0 +1,534 @@
+"""State reads while some tasks of a superstep are finished and others are paused.
+
+When parallel tasks each call `interrupt()` and only some of them are resumed,
+the superstep stays open. Its recorded writes then contain the old interrupt of
+each finished task next to that task's output. These tests check that state
+reads, which are rebuilt from the checkpointer, report only the interrupts that
+still need an answer.
+"""
+
+import operator
+import sys
+import uuid
+from collections import Counter
+from typing import Annotated, Any
+
+import pytest
+from langgraph.checkpoint.base import BaseCheckpointSaver
+from typing_extensions import TypedDict
+
+from langgraph._internal._constants import (
+    ERROR,
+    INTERRUPT,
+    NO_WRITES,
+    NULL_TASK_ID,
+    RESUME,
+    RETURN,
+)
+from langgraph.func import entrypoint, task
+from langgraph.graph import END, START, StateGraph
+from langgraph.pregel._task_status import read_task_statuses
+from langgraph.types import Command, Durability, Interrupt, Send, interrupt
+
+pytestmark = pytest.mark.anyio
+
+NEEDS_CONTEXTVARS = pytest.mark.skipif(
+    sys.version_info < (3, 11),
+    reason="Python 3.11+ is required for async contextvars support",
+)
+
+
+class State(TypedDict, total=False):
+    log: Annotated[list[str], operator.add]
+    count: int
+
+
+def _config() -> dict[str, Any]:
+    return {"configurable": {"thread_id": str(uuid.uuid4())}}
+
+
+def _build_parallel(
+    checkpointer: BaseCheckpointSaver,
+    calls: Counter[str],
+    *,
+    a_questions: int = 1,
+    a_returns: Any = "log",
+):
+    """Build a graph where nodes `a` and `b` start in parallel and both ask questions.
+
+    `a` asks `a_questions` questions in a row. `a_returns` controls what `a`
+    returns after its last answer. The default `"log"` returns the answers in
+    `log`. Any other value is returned as-is.
+    """
+
+    def a(state: State) -> Any:
+        calls["a"] += 1
+        answers = [interrupt(f"A{i + 1}") for i in range(a_questions)]
+        if a_returns == "log":
+            return {"log": [f"a:{answer}" for answer in answers]}
+        return a_returns
+
+    def b(state: State) -> State:
+        calls["b"] += 1
+        return {"log": [f"b:{interrupt('B')}"]}
+
+    builder = StateGraph(State)
+    builder.add_node("a", a)
+    builder.add_node("b", b)
+    builder.add_edge(START, "a")
+    builder.add_edge(START, "b")
+    builder.add_edge("a", END)
+    builder.add_edge("b", END)
+    return builder.compile(checkpointer=checkpointer)
+
+
+def _interrupt_by_value(snapshot: Any, value: str) -> Interrupt:
+    return next(i for i in snapshot.interrupts if i.value == value)
+
+
+def _task(snapshot: Any, name: str) -> Any:
+    return next(t for t in snapshot.tasks if t.name == name)
+
+
+def _interrupt_values(interrupts: Any) -> list[str]:
+    return sorted(i.value for i in interrupts)
+
+
+# --- Task A answered and finished, task B still paused ---
+
+
+def test_finished_task_does_not_report_answered_interrupt(
+    sync_checkpointer: BaseCheckpointSaver, durability: Durability
+) -> None:
+    calls: Counter[str] = Counter()
+    graph = _build_parallel(sync_checkpointer, calls)
+    config = _config()
+
+    graph.invoke({"log": []}, config, durability=durability)
+    snapshot = graph.get_state(config)
+    assert _interrupt_values(snapshot.interrupts) == ["A1", "B"]
+
+    graph.invoke(
+        Command(resume={_interrupt_by_value(snapshot, "A1").id: "yes"}),
+        config,
+        durability=durability,
+    )
+
+    snapshot = graph.get_state(config)
+    assert _interrupt_values(snapshot.interrupts) == ["B"]
+    assert snapshot.next == ("b",)
+    assert _task(snapshot, "a").interrupts == ()
+    assert _task(snapshot, "a").result == {"log": ["a:yes"]}
+    assert _interrupt_values(_task(snapshot, "b").interrupts) == ["B"]
+    assert _task(snapshot, "b").result is None
+
+    # Reading the same checkpoint by id gives the record of the step: every task
+    # in it, and every question asked, including the one A already answered.
+    record = graph.get_state(snapshot.config)
+    assert sorted(record.next) == ["a", "b"]
+    assert _interrupt_values(record.interrupts) == ["A1", "B"]
+    assert _interrupt_values(_task(record, "a").interrupts) == ["A1"]
+    assert _task(record, "a").result == {"log": ["a:yes"]}
+
+    # B can still be answered, and the graph finishes normally.
+    result = graph.invoke(
+        Command(resume={_interrupt_by_value(snapshot, "B").id: "ok"}),
+        config,
+        durability=durability,
+    )
+    assert sorted(result["log"]) == ["a:yes", "b:ok"]
+    assert calls == {"a": 2, "b": 3}
+    snapshot = graph.get_state(config)
+    assert snapshot.next == ()
+    assert snapshot.interrupts == ()
+
+    # History still shows where each question was asked.
+    asked = [
+        _interrupt_values(s.interrupts)
+        for s in graph.get_state_history(config)
+        if s.interrupts
+    
```

---

### Incident Patch 8: `313e0e7e` (2026-09-30)
**Commit Message**: chore(deps): bump urllib3 from 2.7.0 to 2.8.0 in /libs/prebuilt (#9130)

Bumps [urllib3](https://github.com/urllib3/urllib3) from 2.7.0 to 2.8.0.
<details>
<summary>Release notes</summary>
<p><em>Sourced from <a
href="https://github.com/urllib3/urllib3/releases">urllib3's
releases</a>.</em></p>
<blockquote>
<h2>2.8.0</h2>
<h2>🚀 urllib3 is fundraising for HTTP/2 support</h2>
<p><a
href="https://sethmlarson.dev/urllib3-is-fundraising-for-http2-support">urllib3
is raising ~$40,000 USD</a> to release HTTP/2 support and ensure
long-term sustainable maintenance of the project. If your company or
organization uses Python and would benefit from HTTP/2 support in
Requests, pip, cloud SDKs, and thousands of other projects <a
href="https://opencollective.com/urllib3">please consider contributing
financially</a> to ensure HTTP/2 support is developed sustainably and
maintained for the long-haul.</p>
<p>Thank you for your support.</p>
<h2>Security</h2>
<p>Fixed the following security issues:</p>
<ul>
<li>The TLS configuration for HTTPS proxies could be ignored or
overridden. (High severity, GHSA-8988-9cw3-xx77)</li>
<li><code>HTTPResponse.stream()</code> and <code>read_chunked()</code>
could bu

**File**: `libs/prebuilt/uv.lock` (modified, +3/-3)
```diff
@@ -1363,11 +1363,11 @@ wheels = [
 
 [[package]]
 name = "urllib3"
-version = "2.7.0"
+version = "2.8.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz", hash = "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c", size = 433602, upload-time = "2026-05-07T16:13:18.596Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/e3/05/b17359e1cefb4f909b5e40b1b90a496d987258916dbbf88e842c729f510e/urllib3-2.8.0.tar.gz", hash = "sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63", size = 458972, upload-time = "2026-09-15T19:29:36.253Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/7f/3e/5db95bcf282c52709639744ca2a8b149baccf648e39c8cc87553df9eae0c/urllib3-2.7.0-py3-none-any.whl", hash = "sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897", size = 131087, upload-time = "2026-05-07T16:13:17.151Z" },
+    { url = "https://files.pythonhosted.org/packages/92/9d/c4e665119135114480843e7ab388fa94d8480650450e6f8e26b70d323a4c/urllib3-2.8.0-py3-none-any.whl", hash = "sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3", size = 135717, upload-time = "2026-09-15T19:29:34.577Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 9: `eb69f67b` (2026-09-30)
**Commit Message**: fix(checkpoint-sqlite): walk delta ancestors by parent pointer (#8557)

## Summary

The sqlite delta history silently drops a parent checkpoint whose id sorts above its child's,
losing that parent's stored value and its pending writes. The channel hydrates short with no error.

Fixes #8550

## Problem

Stage 1 walked ancestors with:

```sql
WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id <= ?
ORDER BY checkpoint_id DESC
```

Ancestry is defined by the `parent_checkpoint_id` column. These two predicates add a second
requirement: that every child's id sorts above its parent's. The contract promises monotonic ids,
but that only holds within one process, so ids from processes with different clocks can break it.

When the requirement is violated the parent is excluded from the stream and its seed and writes go
with it. Dropping the range filter alone does not fix it: in `checkpoint_id DESC` order that parent
arrives *before* the target, so the walk streams past it before it has started.

## Fix

A recursive CTE anchored at the target, following `parent_checkpoint_id`:

```sql
WITH RECURSIVE ancestors(checkpoint_id, parent_checkpoint_id, type, checkpoint) AS (
    SELECT ... 

**File**: `libs/checkpoint-sqlite/langgraph/checkpoint/sqlite/__init__.py` (modified, +11/-10)
```diff
@@ -507,13 +507,12 @@ def get_delta_channel_history(
 
         Two-stage query:
 
-        * Stage 1 (paged): newest-first slice of `checkpoints` returning
-          `(checkpoint_id, parent_checkpoint_id, type, checkpoint)` per
-          ancestor. Sqlite has no JSONB, so we ship the full serialized
-          checkpoint blob and inspect `channel_values` in Python. Pages
-          newest-first by `checkpoint_id` with a `< cursor` predicate;
-          page size is `DELTA_PAGE_SIZE`. Stops paging when every channel
-          has found its seed or the chain is exhausted.
+        * Stage 1 (streamed): recursive CTE over `checkpoints` following
+          `parent_checkpoint_id` from the target, returning
+          `(checkpoint_id, type, checkpoint)` per ancestor. Sqlite has no
+          JSONB, so we ship the full serialized checkpoint blob and inspect
+          `channel_values` in Python. Stops reading when every channel has
+          found its seed or the chain is exhausted.
 
         * Stage 2 (per-channel UNION ALL): one branch per channel reading
           `writes` filtered to that channel's specific `chain_cids`. No
@@ -538,12 +537,14 @@ def get_delta_channel_history(
         seeded: set[str] = set()
 
         with self.cursor(transaction=False) as cur:
-            cur.execute(DELTA_STAGE1_SQL, (thread_id, checkpoint_ns, checkpoint_id))
+            cur.execute(
+                DELTA_STAGE1_SQL,
+                (thread_id, checkpoint_ns, checkpoint_id, thread_id, checkpoint_ns),
+            )
             for row in cur:
-                cid, parent_cid, type_tag, blob = row
+                cid, type_tag, blob = row
                 if step_walk_with_row(
                     cid=cid,
-                    parent_cid=parent_cid,
                     type_tag=type_tag,
                     blob=blob,
                     target_id=checkpoint_id,
```

**File**: `libs/checkpoint-sqlite/langgraph/checkpoint/sqlite/_delta.py` (modified, +36/-25)
```diff
@@ -26,16 +26,33 @@
 
 from langgraph.checkpoint.base import DeltaChannelHistory, PendingWrite
 
-# Stage 1 streams ancestors of `target_cid` newest-first. The `<=`
-# predicate keeps target itself in the stream so we can read its
-# `parent_checkpoint_id` from the first row without a separate lookup;
-# the caller skips target's own writes/seed (matches the
-# `BaseCheckpointSaver` contract).
+# Stage 1 streams target, then its ancestors nearest-first, by following
+# `parent_checkpoint_id` rather than id order: ids are only monotonic within
+# one process, so a range scan by id can miss a parent whose id sorts above
+# its child's. Target is the anchor row; its own writes/seed are skipped
+# (matches the `BaseCheckpointSaver` contract).
+#
+# `put` is `INSERT OR REPLACE`, so re-putting an existing id under a
+# descendant's config makes the chain a loop. `step_walk_with_row` stops on a
+# repeated id; sqlite yields recursive rows lazily, so abandoning the cursor
+# ends the recursion.
+#
+# `CROSS JOIN` pins `ancestors` as the outer loop, so each step is one primary
+# key lookup. With a plain `JOIN` and no `ANALYZE` stats, sqlite can put
+# `checkpoints` outside and scan the whole thread per step.
 DELTA_STAGE1_SQL = (
+    "WITH RECURSIVE ancestors(checkpoint_id, parent_checkpoint_id, type, "
+    "checkpoint) AS ("
     "SELECT checkpoint_id, parent_checkpoint_id, type, checkpoint "
     "FROM checkpoints "
-    "WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id <= ? "
-    "ORDER BY checkpoint_id DESC"
+    "WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ? "
+    "UNION ALL "
+    "SELECT c.checkpoint_id, c.parent_checkpoint_id, c.type, c.checkpoint "
+    "FROM ancestors a CROSS JOIN checkpoints c "
+    "ON c.checkpoint_id = a.parent_checkpoint_id "
+    "WHERE c.thread_id = ? AND c.checkpoint_ns = ?"
+    ") "
+    "SELECT checkpoint_id, type, checkpoint FROM ancestors"
 )
 
 
@@ -68,7 +85,6 @@ def build_delta_stage2_sql(*, chain_lens: Sequence[int]) -> str:
 def step_walk_with_row(
     *,
     cid: str,
-    parent_cid: str | None,
     type_tag: str,
     blob: bytes,
     target_id: str,
@@ -81,36 +97,32 @@ def step_walk_with_row(
 ) -> bool:
     """Process one streamed stage-1 row in the merged ancestor walk.
 
-    The cursor returns (cid, parent_cid, type, blob) rows in
-    `checkpoint_id` DESC order starting at target. The first row is
-    target itself; we read its parent_cid to seed the walk and otherwise
-    skip it (target's own writes/seed are not part of the contract).
+    The cursor returns (cid, type, blob) rows in walk order starting at
+    target. The first row is target itself and is skipped (target's own
+    writes/seed are not part of the contract).
 
-    For each subsequent row, if `cid` matches the walk's current
-    position, we deserialize the blob, append the cid to every
-    not-yet-seeded channel's chain, and check `channel_values` for
+    For each subsequent row we deserialize the blob, append the cid to
+    every not-yet-seeded channel's chain, and check `channel_values` for
     seeds. The deserialized checkpoint is dropped before advancing — no
     cross-row cache, so peak in-flight is one deserialized checkpoint.
 
-    Off-path rows (different branch on the same thread) advance the
-    cursor without doing any work.
-
-    Returns True when every requested channel is seeded — the caller
-    can stop iterating and close the cursor.
+    Returns True when the caller can stop iterating and close the cursor:
+    every requested channel is seeded, or the chain revisited a checkpoint.
     """
     if "started" not in walk_state:
         if cid == target_id:
             walk_state["started"] = True
-            walk_state["cur_cid"] = parent_cid
             walk_state["active"] = {ch for ch in channels if ch not in seeded}
+            walk_state["walked"] = {cid}
         # Not target yet (or target not present): keep streaming.
         return False
     active: set[str] = walk_state["active"]
     if not active:
         return True
-    if cid != walk_state["cur_cid"]:
-        # Off-path row from a sibling branch — skip without deserializing.
-        return False
+    walked: set[str] = walk_state["walked"]
+    if cid in walked:
+        return True
+    walked.add(cid)
     for ch in active:
         chain_by_ch[ch].append(cid)
     ckpt = serde.loads_typed((type_tag, blob))
@@ -120,7 +132,6 @@ def step_walk_with_row(
         seeded.add(ch)
         active.discard(ch)
     del ckpt, channel_values
-    walk_state["cur_cid"] = parent_cid
     return not active
 
 
```

**File**: `libs/checkpoint-sqlite/langgraph/checkpoint/sqlite/aio.py` (modified, +5/-5)
```diff
@@ -625,8 +625,8 @@ async def aget_delta_channel_history(
         """Fast-path override of `BaseCheckpointSaver.aget_delta_channel_history`.
 
         See `SqliteSaver.get_delta_channel_history` for design notes; this
-        is the async equivalent using `aiosqlite` cursors. Stage 1 pages
-        the parent chain newest-first and Python-deserializes each
+        is the async equivalent using `aiosqlite` cursors. Stage 1 streams
+        the parent chain from the target and Python-deserializes each
         checkpoint blob to find per-channel snapshots; stage 2 fetches
         only the relevant writes via per-channel UNION ALL.
         """
@@ -650,13 +650,13 @@ async def aget_delta_channel_history(
 
         async with self.lock, self.conn.cursor() as cur:
             await cur.execute(
-                DELTA_STAGE1_SQL, (thread_id, checkpoint_ns, checkpoint_id)
+                DELTA_STAGE1_SQL,
+                (thread_id, checkpoint_ns, checkpoint_id, thread_id, checkpoint_ns),
             )
             async for row in cur:
-                cid, parent_cid, type_tag, blob = row
+                cid, type_tag, blob = row
                 if step_walk_with_row(
                     cid=cid,
-                    parent_cid=parent_cid,
                     type_tag=type_tag,
                     blob=blob,
                     target_id=checkpoint_id,
```

**File**: `libs/checkpoint-sqlite/tests/test_delta_parent_walk.py` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+from __future__ import annotations
+
+from typing import Any
+
+import pytest
+from langgraph.checkpoint.base import (
+    BaseCheckpointSaver,
+    Checkpoint,
+    DeltaChannelHistory,
+    empty_checkpoint,
+)
+
+from langgraph.checkpoint.sqlite import SqliteSaver
+from langgraph.checkpoint.sqlite._delta import DELTA_STAGE1_SQL
+from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
+
+CHANNEL = "ch"
+CONFIG: dict[str, Any] = {"configurable": {"thread_id": "t", "checkpoint_ns": ""}}
+EXPECTED: DeltaChannelHistory = {
+    "writes": [("task", CHANNEL, "write-root")],
+    "seed": "seed",
+}
+
+
+def _checkpoint(checkpoint_id: str, values: dict[str, Any]) -> Checkpoint:
+    value = empty_checkpoint()
+    value["id"] = checkpoint_id
+    value["channel_values"] = values
+    return value
+
+
+PARENT_ID_ORDERS = [
+    pytest.param("z-older", "a-newer", id="parent_id_sorts_above_child"),
+    pytest.param("a-older", "z-newer", id="parent_id_sorts_below_child"),
+]
+
+
+@pytest.mark.parametrize(("root_id", "child_id"), PARENT_ID_ORDERS)
+def test_sync_walk_reaches_parent_whatever_the_id_order(
+    root_id: str, child_id: str
+) -> None:
+    with SqliteSaver.from_conn_string(":memory:") as saver:
+        root = saver.put(CONFIG, _checkpoint(root_id, {CHANNEL: "seed"}), {}, {})
+        saver.put_writes(root, [(CHANNEL, "write-root")], "task")
+        child = saver.put(root, _checkpoint(child_id, {}), {}, {})
+
+        got = saver.get_delta_channel_history(config=child, channels=[CHANNEL])
+        reference = BaseCheckpointSaver.get_delta_channel_history(
+            saver, config=child, channels=[CHANNEL]
+        )
+        assert got[CHANNEL] == EXPECTED
+        assert got[CHANNEL] == reference[CHANNEL], "fast path disagrees with base"
+
+
+@pytest.mark.parametrize(("root_id", "child_id"), PARENT_ID_ORDERS)
+async def test_async_walk_reaches_parent_whatever_the_id_order(
+    root_id: str, child_id: str
+) -> None:
+    async with AsyncSqliteSaver.from_conn_string(":memory:") as saver:
+        root = await saver.aput(CONFIG, _checkpoint(root_id, {CHANNEL: "seed"}), {}, {})
+        await saver.aput_writes(root, [(CHANNEL, "write-root")], "task")
+        child = await saver.aput(root, _checkpoint(child_id, {}), {}, {})
+
+        got = await saver.aget_delta_channel_history(config=child, channels=[CHANNEL])
+        assert got[CHANNEL] == EXPECTED
+
+
+def test_walk_reaches_root_of_long_chain_with_descending_ids() -> None:
+    steps = 40
+    with SqliteSaver.from_conn_string(":memory:") as saver:
+        parent = saver.put(
+            CONFIG, _checkpoint(f"id-{steps:03d}", {CHANNEL: "seed"}), {}, {}
+        )
+        saver.put_writes(parent, [(CHANNEL, "write-root")], "task")
+        for step in range(steps - 1, 0, -1):
+            parent = saver.put(parent, _checkpoint(f"id-{step:03d}", {}), {}, {})
+
+        got = saver.get_delta_channel_history(config=parent, channels=[CHANNEL])
+        assert got[CHANNEL] == EXPECTED
+
+
+def test_walk_terminates_when_put_makes_the_parent_chain_cycle() -> None:
+    with SqliteSaver.from_conn_string(":memory:") as saver:
+        a = saver.put(CONFIG, _checkpoint("cid-a", {}), {}, {})
+        b = saver.put(a, _checkpoint("cid-b", {}), {}, {})
+        repoint_a_under_b = _checkpoint("cid-a", {})
+        saver.put(b, repoint_a_under_b, {}, {})
+
+        got = saver.get_delta_channel_history(config=b, channels=[CHANNEL])
+        assert got[CHANNEL] == {"writes": []}
+
+
+def test_walk_step_looks_up_the_parent_by_primary_key() -> None:
+    with SqliteSaver.from_conn_string(":memory:") as saver:
+        saver.setup()
+        plan = [
+            row[3]
+            for row in saver.conn.execute(
+                f"EXPLAIN QUERY PLAN {DELTA_STAGE1_SQL}", ("t", "", "id", "t", "")
+            )
+        ]
+    assert any(
+        step.startswith("SEARCH c ") and "checkpoint_id=?" in step for step in plan
+    ), f"recursive step should look up the parent by key, got {plan}"
```

---

### Incident Patch 10: `c0279f09` (2026-09-30)
**Commit Message**: fix(checkpoint-postgres): derive the delta walk cursor once the target loads (#8556)

## Summary

`get_delta_channel_history` on Postgres returns an empty history for any `DeltaChannel` on a
target checkpoint that is not within the first stage-1 pagination page (1024 rows) of the thread.
No exception, no warning: the channel just hydrates empty.

Fixes #8448

## Problem

Stage 1 pages `checkpoints` newest-first from the head of the thread, and after each page
`_try_advance_walks` tries to move every not-yet-seeded channel's walk along the partial
`parent_of` map accumulated so far. The walk starts at the target's parent:

```python
if ch not in walk_cursor_by_ch:
    walk_cursor_by_ch[ch] = parent_of.get(target_id)
```

The target can be any checkpoint in the thread, not just the head, so on the first page
`parent_of` frequently has no row for it yet. `.get` then returns `None`, which is also what a
target with no parent returns, and the two are stored identically. Because the initialisation is
guarded by `ch not in walk_cursor_by_ch`, it never runs again: once the walk is parked at `None`
it stays there even after the target's real row and real parent load on a later page.

The re

**File**: `libs/checkpoint-postgres/langgraph/checkpoint/postgres/__init__.py` (modified, +6/-5)
```diff
@@ -448,11 +448,12 @@ def get_delta_channel_history(
 
         Two-stage query, both stages cover ALL requested channels:
 
-        * Stage 1 (paged): dynamic SELECT over `checkpoints` with K parallel
-          JSONB key lookups (one column pair per channel) — no subquery, no
-          aggregation. Pages newest-first by `checkpoint_id` with a cursor;
-          page size is `_DELTA_PAGE_SIZE`. Stops paging when every channel
-          has found its seed or the chain is exhausted.
+        * Stage 1 (paged): dynamic SELECT over `checkpoints` with three
+          columns per channel: its version, an `EXISTS` probe for a stored
+          blob at that version, and its inline value. Pages newest-first by
+          `checkpoint_id` with a cursor; page size is `_DELTA_PAGE_SIZE`.
+          Stops paging when every channel has found its seed or a page comes
+          back short.
 
         * Stage 2 (per-channel UNION ALL): one branch per channel reading
           `checkpoint_writes` filtered to that channel's specific
```

**File**: `libs/checkpoint-postgres/langgraph/checkpoint/postgres/base.py` (modified, +13/-32)
```diff
@@ -172,30 +172,8 @@ class _DeltaStage2Row(TypedDict, total=False):
     version: str | None  # "b" rows only
 
 
-# Multi-channel two-stage DeltaChannel reconstruction.
-#
-# Stage 1 scans checkpoint metadata (no blob bytes) and emits one row per
-# checkpoint with K parallel JSONB key lookups (one column pair per
-# requested delta channel: ver_i / hs_i).  No subqueries, no aggregation.
-# Python walks the parent chain once across all channels.
-#
-# Stage 2 fetches all writes and the seed blobs for ALL channels in a
-# single roundtrip via `channel = ANY(%s)` and chain/seed-version
-# filtering.
-#
-# Empirical comparison vs an alternative "ship full channel_versions /
-# channel_values JSONB and let Python pick" form (1000 checkpoints,
-# 8 total channels in graph, 3 delta channels requested):
-#
-#   Postgres execution:    A=0.24ms vs B=0.38ms   (both negligible)
-#   End-to-end latency:    A=6.83ms vs B=2.28ms   (B is 3.0x faster)
-#   Wire payload:          A=836KB  vs B=330KB    (61% smaller)
-#   Buffer hits:           identical (167 blocks)
-#
-# B (this dynamic-columns design) wins because it avoids JSONB
-# serialization on the wire and JSONB-to-dict deserialization in
-# psycopg.  Even at K=8 (8 delta channels = 16 dynamic columns), B
-# still beats A end-to-end (4.2ms vs 6.8ms).
+# Delta history is rebuilt in two queries; `_build_delta_stage1_sql` and
+# `_build_delta_stage2_sql` document their shapes.
 
 
 def _build_delta_stage1_sql(channels: Sequence[str], *, paged: bool) -> str:
@@ -335,10 +313,8 @@ def _build_delta_stage2_sql(
     return " UNION ALL ".join(branches)
 
 
-# Stage 1 rows are dynamic-shape dicts: {checkpoint_id, parent_checkpoint_id,
-# ver_0, hs_0, ver_1, hs_1, ...}.  Walking is parameterized by the channel
-# list to map indices back to channel names — no static TypedDict here.
-# `dict[str, Any]` is the practical signature.
+# Stage 1 rows are dicts keyed by the per-channel aliases
+# `_build_delta_stage1_sql` emits, so there is no static TypedDict.
 
 
 class BasePostgresSaver(BaseCheckpointSaver[str]):
@@ -431,19 +407,24 @@ def _try_advance_walks(
           (a) it found a stored value for its channel — a blob or an inline
               primitive (channel becomes seeded),
           (b) it reached a real root (parent_of[cid] is None — fully
-              materialized at this point), or
+              materialized at this point),
           (c) the next ancestor cid isn't in `parent_of` yet (waiting for
-              a later page; the cursor stays put).
+              a later page; the cursor stays put), or
+          (d) the target's own row isn't in `parent_of` yet (the walk has
+              not started; no cursor is set, so a later page retries).
 
         Mutates `chain_by_ch`, `seed_ver_by_ch`, `seed_inline_by_ch`,
         `walk_cursor_by_ch`, and `seeded` in place.
         """
         for i, ch in enumerate(channels):
             if ch in seeded:
                 continue
-            # First-time entry: cursor starts at the target's parent.
+            # Pages start at the thread head, so the target may not have
+            # loaded yet; a `None` cursor would read as "target is a root".
             if ch not in walk_cursor_by_ch:
-                walk_cursor_by_ch[ch] = parent_of.get(target_id)
+                if target_id not in parent_of:
+                    continue
+                walk_cursor_by_ch[ch] = parent_of[target_id]
             cur_cid = walk_cursor_by_ch[ch]
             ch_chain = chain_by_ch[ch]
             hb_i = hb_by_i_by_cid[i]
```

**File**: `libs/checkpoint-postgres/tests/test_delta_pagination.py` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+from __future__ import annotations
+
+from typing import Any
+from uuid import uuid4
+
+import pytest
+from langgraph.checkpoint.base import (
+    Checkpoint,
+    DeltaChannelHistory,
+    empty_checkpoint,
+)
+from langgraph.checkpoint.base.id import uuid6
+from langgraph.checkpoint.serde.types import _DeltaSnapshot
+
+from langgraph.checkpoint.postgres import PostgresSaver
+from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
+from langgraph.checkpoint.postgres.base import _DELTA_PAGE_SIZE
+from tests.conftest import DEFAULT_URI
+
+CHANNEL = "items"
+STEPS = 8
+SEED_STEP = 1
+SEED_VALUE = [10, 20]
+TARGET_STEP = 4
+
+# The real page size is the control; the rest leave the target off the first
+# page (three checkpoints are newer than it).
+PAGE_SIZES = [_DELTA_PAGE_SIZE, 3, 2, 1]
+
+
+def _step_args(
+    thread_id: str, step: int, parent: dict | None
+) -> tuple[dict, Checkpoint, dict[str, Any]]:
+    config: dict = {"configurable": {"thread_id": thread_id, "checkpoint_ns": ""}}
+    if parent is not None:
+        config["configurable"]["checkpoint_id"] = parent["configurable"][
+            "checkpoint_id"
+        ]
+    checkpoint: Checkpoint = empty_checkpoint()
+    checkpoint["id"] = str(uuid6(clock_seq=step))
+    checkpoint["channel_versions"][CHANNEL] = f"v{step}"
+    if step == SEED_STEP:
+        checkpoint["channel_values"][CHANNEL] = _DeltaSnapshot(list(SEED_VALUE))
+        return config, checkpoint, {CHANNEL: f"v{step}"}
+    return config, checkpoint, {}
+
+
+async def _abuild_chain(saver: AsyncPostgresSaver) -> list[dict]:
+    thread_id = str(uuid4())
+    parent: dict | None = None
+    configs: list[dict] = []
+    for step in range(STEPS):
+        config, checkpoint, new_versions = _step_args(thread_id, step, parent)
+        parent = await saver.aput(
+            config,
+            checkpoint,
+            {"source": "loop", "step": step, "parents": {}},
+            new_versions,
+        )
+        await saver.aput_writes(parent, [(CHANNEL, f"w{step}")], str(uuid4()))
+        configs.append(parent)
+    return configs
+
+
+def _build_chain(saver: PostgresSaver) -> list[dict]:
+    thread_id = str(uuid4())
+    parent: dict | None = None
+    configs: list[dict] = []
+    for step in range(STEPS):
+        config, checkpoint, new_versions = _step_args(thread_id, step, parent)
+        parent = saver.put(
+            config,
+            checkpoint,
+            {"source": "loop", "step": step, "parents": {}},
+            new_versions,
+        )
+        saver.put_writes(parent, [(CHANNEL, f"w{step}")], str(uuid4()))
+        configs.append(parent)
+    return configs
+
+
+def _assert_history(entry: DeltaChannelHistory, page_size: int) -> None:
+    seed = entry.get("seed")
+    assert isinstance(seed, _DeltaSnapshot), (
+        f"page_size={page_size}: expected a snapshot seed, "
+        f"got {entry.get('seed', '<missing>')!r}"
+    )
+    assert seed.value == SEED_VALUE
+    assert [w[2] for w in entry["writes"]] == ["w1", "w2", "w3"], (
+        f"page_size={page_size}: got {[w[2] for w in entry['writes']]}"
+    )
+
+
+@pytest.mark.parametrize("page_size", PAGE_SIZES)
+async def test_async_target_older_than_the_first_page(
+    page_size: int, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    monkeypatch.setattr("langgraph.checkpoint.postgres.aio._DELTA_PAGE_SIZE", page_size)
+    async with AsyncPostgresSaver.from_conn_string(DEFAULT_URI) as saver:
+        await saver.setup()
+        configs = await _abuild_chain(saver)
+        result = await saver.aget_delta_channel_history(
+            config=configs[TARGET_STEP], channels=[CHANNEL]
+        )
+        _assert_history(result[CHANNEL], page_size)
+
+
+@pytest.mark.parametrize("page_size", PAGE_SIZES)
+def test_sync_target_older_than_the_first_page(
+    page_size: int, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    monkeypatch.setattr("langgraph.checkpoint.postgres._DELTA_PAGE_SIZE", page_size)
+    with PostgresSaver.from_conn_string(DEFAULT_URI) as saver:
+        saver.setup()
+        configs = _build_chain(saver)
+        result = saver.get_delta_channel_history(
+            config=configs[TARGET_STEP], channels=[CHANNEL]
+        )
+        _assert_history(result[CHANNEL], page_size)
+
+
+async def test_root_target_has_no_history_and_still_terminates(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    monkeypatch.setattr("langgraph.checkpoint.postgres.aio._DELTA_PAGE_SIZE", 1)
+    async with AsyncPostgresSaver.from_conn_string(DEFAULT_URI) as saver:
+        await saver.setup()
+        configs = await _abuild_chain(saver)
+        result = await saver.aget_delta_channel_history(
+            config=configs[0], channels=[CHANNEL]
+        )
+        assert result[CHANNEL] == {"writes": []}
```

---

### Incident Patch 11: `f5804a5b` (2026-09-30)
**Commit Message**: fix(ci): test locally-built wheel and publish to test pypi after pre-release checks (#9124)

**File**: `.github/workflows/release.yml` (modified, +23/-36)
```diff
@@ -139,23 +139,10 @@ jobs:
             echo EOF
           } >> "$GITHUB_OUTPUT"
 
-  test-pypi-publish:
-    needs:
-      - build
-      - release-notes
-    permissions:
-      contents: read
-      id-token: write
-    uses: ./.github/workflows/_test_release.yml
-    with:
-      working-directory: ${{ inputs.working-directory }}
-    secrets: inherit
-
   pre-release-checks:
     needs:
       - build
       - release-notes
-      - test-pypi-publish
     runs-on: ubuntu-latest
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
@@ -180,31 +167,20 @@ jobs:
           enable-cache: false
           working-directory: ${{ inputs.working-directory }}
 
-      - name: Import published package
+      - uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
+        with:
+          name: dist
+          path: ${{ inputs.working-directory }}/dist/
+
+      - name: Import dist package
         shell: bash
         working-directory: ${{ inputs.working-directory }}
         env:
           PKG_NAME: ${{ needs.build.outputs.pkg-name }}
           VERSION: ${{ needs.build.outputs.version }}
-        # Here we use:
-        # - The default regular PyPI index as the *primary* index, meaning
-        #   that it takes priority (https://pypi.org/simple)
-        # - The test PyPI index as an extra index, so that any dependencies that
-        #   are not found on test PyPI can be resolved and installed anyway.
-        #   (https://test.pypi.org/simple). This will include the PKG_NAME==VERSION
-        #   package because VERSION will not have been uploaded to regular PyPI yet.
-        # - attempt install again after 5 seconds if it fails because there is
-        #   sometimes a delay in availability on test pypi
+        # Install directly from the locally-built wheel (no index resolution needed).
         run: |
-          uv run pip install \
-            --extra-index-url https://test.pypi.org/simple/ \
-            "$PKG_NAME==$VERSION" || \
-          ( \
-            sleep 5 && \
-            uv run pip install \
-              --extra-index-url https://test.pypi.org/simple/ \
-              "$PKG_NAME==$VERSION" \
-          )
+          uv run pip install dist/*.whl
 
           if [[ "$PKG_NAME" == *prebuilt* ]]; then
             uv run pip install langgraph
@@ -226,22 +202,33 @@ jobs:
         run: uv sync --group test
         working-directory: ${{ inputs.working-directory }}
 
-      # Overwrite the local version of the package with the test PyPI version.
+      # Overwrite the local version of the package with the built version
       - name: Import published package (again)
         working-directory: ${{ inputs.working-directory }}
         shell: bash
         env:
           PKG_NAME: ${{ needs.build.outputs.pkg-name }}
           VERSION: ${{ needs.build.outputs.version }}
         run: |
-          uv run pip install \
-            --extra-index-url https://test.pypi.org/simple/ \
-            "$PKG_NAME==$VERSION"
+          uv run pip install dist/*.whl
 
       - name: Run unit tests
         run: make test
         working-directory: ${{ inputs.working-directory }}
 
+  test-pypi-publish:
+    needs:
+      - build
+      - release-notes
+      - pre-release-checks
+    permissions:
+      contents: read
+      id-token: write
+    uses: ./.github/workflows/_test_release.yml
+    with:
+      working-directory: ${{ inputs.working-directory }}
+    secrets: inherit
+
   publish:
     needs:
       - build
```

---

### Incident Patch 12: `07b33185` (2026-09-27)
**Commit Message**: fix: reject credential-bearing Git dependencies (#8542)

## Description
Reject Git HTTP dependency URLs containing userinfo before Docker
generation so credentials cannot persist in Dockerfiles or image layers.
Validation now covers local requirement/package metadata and uv
pyproject/lock inputs while keeping errors token-free.

## Test Plan
- [x] Validate credentialed raw, local-manifest, and uv-managed Git URLs
are rejected without echoing secrets
- [x] Validate credential-free HTTPS and SSH Git URLs remain supported

Made by [Open
SWE](https://openswe.vercel.app/agents/81b07455-ece4-3ddc-9955-d7a5bea78d2c)

---------

Co-authored-by: open-swe[bot] <[REDACTED_EMAIL]>

**File**: `libs/cli/README.md` (modified, +2/-0)
```diff
@@ -103,6 +103,8 @@ The CLI uses a `langgraph.json` configuration file with these key settings:
 }
 ```
 
+Git dependencies should use credential-free URLs. The CLI conservatively scans direct `langgraph.json` dependencies, common Python package files, uv project and lock files, and common Node.js package and lock files for HTTP Git URLs with userinfo. This check is not exhaustive: generated Docker builds can copy other files, including nested requirement or constraint files, into image layers without scanning them. For private dependencies, provide short-lived credentials through your build environment's secret-backed Git credential helper. Do not store credentials in copied files such as `langgraph.json` or `pip_config_file`.
+
 See the [full documentation](https://reference.langchain.com/python/langgraph-cli) for detailed configuration options.
 
 ## Development
```

**File**: `libs/cli/langgraph_cli/config.py` (modified, +87/-3)
```diff
@@ -6,6 +6,7 @@
 import shlex
 import textwrap
 from collections import Counter
+from collections.abc import Iterable
 from typing import Literal, NamedTuple
 
 import click
@@ -36,6 +37,10 @@
 # This blocks background execution (cmd &) while allowing command
 # chaining (cmd1 && cmd2) which is common in build commands.
 _SINGLE_AMPERSAND_RE = re.compile(r"(?<!&)&(?:&&)*(?!&)")
+_GIT_HTTP_AUTHORITY_RES = (
+    re.compile(r"git\+https?://(?P<authority>[^/\s\"']+)", re.I),
+    re.compile(r"\bgit\s*=\s*[\"']https?://(?P<authority>[^/\s\"']+)", re.I),
+)
 _API_VERSION_PATTERN = re.compile(
     r"^(?P<major>\d+)"
     r"(?:\.(?P<minor>\d+))?"
@@ -78,6 +83,62 @@ def has_disallowed_build_command_content(command: str) -> bool:
     return False
 
 
+def _has_git_http_url_userinfo(dependency: str) -> bool:
+    """Check whether a Git HTTP URL contains userinfo."""
+    return any(
+        "@" in match.group("authority")
+        for pattern in _GIT_HTTP_AUTHORITY_RES
+        for match in pattern.finditer(dependency)
+    )
+
+
+def _validate_git_http_url_userinfo(
+    values: Iterable[str], *, source: pathlib.Path | None = None
+) -> None:
+    """Reject credential-bearing Git HTTP URLs without echoing their values."""
+    if not any(_has_git_http_url_userinfo(value) for value in values):
+        return
+    message = (
+        "Git dependency URLs must not contain credentials or other URL "
+        "userinfo because generated Dockerfiles and image layers can retain "
+        "them. Use a credential-free Git URL and provide short-lived "
+        "credentials through your build environment's secret-backed Git "
+        "credential helper."
+    )
+    if source is not None:
+        message += f" Found in: {source}"
+    raise click.UsageError(message)
+
+
+def _validate_git_http_url_userinfo_files(paths: Iterable[pathlib.Path]) -> None:
+    """Reject credential-bearing Git HTTP URLs in dependency files."""
+    for path in paths:
+        path = path.resolve()
+        if not path.is_file():
+            continue
+        try:
+            contents = path.read_text(encoding="utf-8", errors="replace")
+        except OSError:
+            raise click.UsageError(
+                f"Could not inspect dependency file for embedded credentials: {path}"
+            ) from None
+        _validate_git_http_url_userinfo([contents], source=path)
+
+
+def _validate_local_dependency_files(config_path: pathlib.Path, config: Config) -> None:
+    """Validate dependency files copied into a non-uv Python image."""
+    paths: list[pathlib.Path] = []
+    for dependency in config["dependencies"]:
+        if not isinstance(dependency, str) or not dependency.startswith("."):
+            continue
+        root = (config_path.parent / dependency).resolve()
+        paths.extend(
+            root / name
+            for name in ("requirements.txt", "pyproject.toml", "setup.py", "setup.cfg")
+        )
+    _validate_git_http_url_userinfo_files(paths)
+
+
 MIN_PYTHON_VERSION = "3.11"
 DEFAULT_PYTHON_VERSION = "3.11"
 
@@ -320,7 +381,9 @@ def _get_source_kind(config: Config) -> str | None:
     return kind if isinstance(kind, str) else None
 
 
-def validate_config(config: Config) -> Config:
+def validate_config(
+    config: Config, *, source_path: pathlib.Path | None = None
+) -> Config:
     """Validate a configuration dictionary."""
 
     graphs = config.get("graphs", {})
@@ -415,6 +478,15 @@ def validate_config(config: Config) -> Config:
                 '  "source": {"kind": "uv", "root": ".."}'
             )
 
+    _validate_git_http_url_userinfo(
+        (
+            dependency
+            for dependency in config["dependencies"]
+            if isinstance(dependency, str)
+        ),
+        source=source_path,
+    )
+
     source = config.get("source")
     source_kind = _get_source_kind(config)
     if source is not None and not isinstance(source, dict):
@@ -609,7 +681,7 @@ def validate_config_file(config_path: pathlib.Path) -> Config:
     """Load and validate a configuration file."""
     with open(config_path) as f:
         config = json.load(f)
-    validated = validate_config(config)
+    validated = validate_config(config, source_path=config_path.resolve())
     # Enforce the package.json doesn't enforce an
     # incompatible Node.js version
     if validated.get("node_version"):
@@ -1280,6 +1352,7 @@ def python_config_to_docker(
             api_version=api_version,
             build_tools_to_uninstall=build_tools_to_uninstall,
         )
+    _validate_local_dependency_files(config_path, config)
     if pip_installer == "auto":
         if _image_supports_uv(base_image):
             pip_installer = "uv"
@@ -1490,7 +1563,18 @@ def node_config_to_docker(
 ) -> tuple[str, dict[str, str]]:
     # Calculate paths for monorepo support
     install_root = (
-        pathlib.Path(build_context).resolve() if build_context else config_path.parent
+        pathlib.Path(build_context).resolve()
+        
```

**File**: `libs/cli/langgraph_cli/schemas.py` (modified, +5/-1)
```diff
@@ -650,7 +650,8 @@ class Config(TypedDict, total=False):
 
     pip_config_file: str | None
     """Optional. Path to a pip config file (e.g., "/etc/pip.conf" or "pip.ini") for controlling
-    package installation (custom indices, credentials, etc.).
+    package installation (custom indices, timeouts, etc.). The file is copied into the
+    generated image, so it must not contain credentials or other secrets.
 
     Only relevant if Python dependencies are installed via pip. If omitted, default pip settings are used.
     """
@@ -689,6 +690,9 @@ class Config(TypedDict, total=False):
       - "." or "./src" if you have a local Python package
       - str (aka "anthropic") for a PyPI package
       - "git+https://github.com/org/repo.git@main" for a Git-based package
+    Git HTTP URLs must not contain userinfo such as a username or token. For private
+    dependencies, provide short-lived credentials through the build environment's
+    secret-backed Git credential helper.
     Defaults to an empty list, meaning no additional packages installed beyond your base environment.
 
     This field is not supported when `source.kind` is `uv`.
```

**File**: `libs/cli/langgraph_cli/uv_lock.py` (modified, +10/-0)
```diff
@@ -880,6 +880,7 @@ def python_config_to_docker_uv_lock(
         _get_node_pm_install_cmd,
         _get_pip_cleanup_lines,
         _image_supports_uv,
+        _validate_git_http_url_userinfo_files,
         docker_tag,
     )
 
@@ -890,11 +891,20 @@ def python_config_to_docker_uv_lock(
         )
 
     config_root = config_path.parent.resolve()
+    source_root = config["source"].get("root", ".")
+    project_root = (config_root / source_root).resolve()
+    _validate_git_http_url_userinfo_files(
+        [project_root / "pyproject.toml", project_root / "uv.lock"]
+    )
+
     install_cmd = "uv pip install --system"
     _, global_reqs_pip_install, pip_config_file_str = _build_python_install_commands(
         config, install_cmd
     )
     plan = _plan_uv_lock_workspace(config_path, config)
+    _validate_git_http_url_userinfo_files(
+        package.pyproject_path for package in plan.install_order
+    )
 
     _update_uv_lock_graph_paths(config_path, config, plan)
     for section, key in [
```

**File**: `libs/cli/schemas/schema.json` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@
                   "type": "null"
                 }
               ],
-              "description": "Optional. Path to a pip config file (e.g., \"/etc/pip.conf\" or \"pip.ini\") for controlling\npackage installation (custom indices, credentials, etc.).\n\nOnly relevant if Python dependencies are installed via pip. If omitted, default pip settings are used.\n"
+              "description": "Optional. Path to a pip config file (e.g., \"/etc/pip.conf\" or \"pip.ini\") for controlling\npackage installation (custom indices, timeouts, etc.). The file is copied into the\ngenerated image, so it must not contain credentials or other secrets.\n\nOnly relevant if Python dependencies are installed via pip. If omitted, default pip settings are used.\n"
             },
             "_INTERNAL_docker_tag": {
               "anyOf": [
@@ -270,7 +270,7 @@
                   "type": "null"
                 }
               ],
-              "description": "Optional. Path to a pip config file (e.g., \"/etc/pip.conf\" or \"pip.ini\") for controlling\npackage installation (custom indices, credentials, etc.).\n\nOnly relevant if Python dependencies are installed via pip. If omitted, default pip settings are used.\n"
+              "description": "Optional. Path to a pip config file (e.g., \"/etc/pip.conf\" or \"pip.ini\") for controlling\npackage installation (custom indices, timeouts, etc.). The file is copied into the\ngenerated image, so it must not contain credentials or other secrets.\n\nOnly relevant if Python dependencies are installed via pip. If omitted, default pip settings are used.\n"
             },
             "_INTERNAL_docker_tag": {
               "anyOf": [
```

**File**: `libs/cli/schemas/schema.v0.json` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@
                   "type": "null"
                 }
               ],
-              "description": "Optional. Path to a pip config file (e.g., \"/etc/pip.conf\" or \"pip.ini\") for controlling\npackage installation (custom indices, credentials, etc.).\n\nOnly relevant if Python dependencies are installed via pip. If omitted, default pip settings are used.\n"
+              "description": "Optional. Path to a pip config file (e.g., \"/etc/pip.conf\" or \"pip.ini\") for controlling\npackage installation (custom indices, timeouts, etc.). The file is copied into the\ngenerated image, so it must not contain credentials or other secrets.\n\nOnly relevant if Python dependencies are installed via pip. If omitted, default pip settings are used.\n"
             },
             "_INTERNAL_docker_tag": {
               "anyOf": [
@@ -270,7 +270,7 @@
                   "type": "null"
                 }
               ],
-              "description": "Optional. Path to a pip config file (e.g., \"/etc/pip.conf\" or \"pip.ini\") for controlling\npackage installation (custom indices, credentials, etc.).\n\nOnly relevant if Python dependencies are installed via pip. If omitted, default pip settings are used.\n"
+              "description": "Optional. Path to a pip config file (e.g., \"/etc/pip.conf\" or \"pip.ini\") for controlling\npackage installation (custom indices, timeouts, etc.). The file is copied into the\ngenerated image, so it must not contain credentials or other secrets.\n\nOnly relevant if Python dependencies are installed via pip. If omitted, default pip settings are used.\n"
             },
             "_INTERNAL_docker_tag": {
               "anyOf": [
```

**File**: `libs/cli/tests/unit_tests/test_config.py` (modified, +237/-0)
```diff
@@ -255,6 +255,243 @@ def test_validate_config():
         )
 
 
+@pytest.mark.parametrize(
+    "dependency",
+    [
+        "git+https://user:secret-token@github.com/org/private.git@main",
+        "private-package @ git+http://token@github.com/org/private.git",
+        "git+HTTPS://user%40example.com:secret%2Ftoken@github.com/org/private.git",
+        "git+https://${GIT_TOKEN}@github.com/org/private.git",
+    ],
+)
+def test_validate_config_rejects_git_http_url_userinfo(dependency: str):
+    with pytest.raises(click.UsageError) as exc_info:
+        validate_config(
+            {
+                "python_version": "3.11",
+                "dependencies": [dependency],
+                "graphs": {"agent": "./agent.py:graph"},
+            }
+        )
+
+    message = str(exc_info.value)
+    assert "must not contain credentials or other URL userinfo" in message
+    assert "secret-token" not in message
+    assert "secret%2Ftoken" not in message
+
+
+def test_validate_config_file_reports_source_for_git_http_url_userinfo(
+    tmp_path: pathlib.Path,
+):
+    config_path = tmp_path / "langgraph.json"
+    config_path.write_text(
+        json.dumps(
+            {
+                "python_version": "3.11",
+                "dependencies": ["git+https://secret-token@github.com/org/private.git"],
+                "graphs": {"agent": "./agent.py:graph"},
+            }
+        )
+    )
+
+    with pytest.raises(click.UsageError) as exc_info:
+        validate_config_file(config_path)
+
+    message = str(exc_info.value)
+    assert "secret-token" not in message
+    assert f"Found in: {config_path.resolve()}" in message
+
+
+@pytest.mark.parametrize(
+    "manifest", ["package.json", "package-lock.json", "yarn.lock", "pnpm-lock.yaml"]
+)
+def test_config_to_docker_rejects_git_http_url_userinfo_in_node_files(
+    tmp_path: pathlib.Path, manifest: str
+):
+    config_path = tmp_path / "langgraph.json"
+    config_path.write_text("{}\n")
+    (tmp_path / "agent.js").write_text("export const graph = {};\n")
+    (tmp_path / "package.json").write_text('{"name":"agent"}\n')
+    (tmp_path / manifest).write_text(
+        '"priv": "git+https://user:secret-token@github.com/org/private.git"\n'
+    )
+    config = validate_config(
+        {
+            "node_version": "20",
+            "graphs": {"agent": "./agent.js:graph"},
+        }
+    )
+
+    with pytest.raises(click.UsageError) as exc_info:
+        config_to_docker(
+            config_path,
+            config,
+            base_image="langchain/langgraphjs-api",
+        )
+
+    message = str(exc_info.value)
+    assert "must not contain credentials or other URL userinfo" in message
+    assert "secret-token" not in message
+    assert f"Found in: {(tmp_path / manifest).resolve()}" in message
+
+
+def test_config_to_docker_allows_node_git_urls_without_http_userinfo(
+    tmp_path: pathlib.Path,
+):
+    config_path = tmp_path / "langgraph.json"
+    config_path.write_text("{}\n")
+    (tmp_path / "agent.js").write_text("export const graph = {};\n")
+    (tmp_path / "package.json").write_text(
+        '{"dependencies":{"public":"git+https://github.com/org/public.git"}}\n'
+    )
+    config = validate_config(
+        {
+            "node_version": "20",
+            "graphs": {"agent": "./agent.js:graph"},
+        }
+    )
+
+    docker, _ = config_to_docker(
+        config_path,
+        config,
+        base_image="langchain/langgraphjs-api",
+    )
+
+    assert f"ADD . /deps/{tmp_path.name}" in docker
+
+
+def test_config_to_docker_rejects_git_http_url_userinfo_in_node_workspace(
+    tmp_path: pathlib.Path,
+):
+    config_root = tmp_path / "apps" / "agent"
+    config_root.mkdir(parents=True)
+    config_path = config_root / "langgraph.json"
+    config_path.write_text("{}\n")
+    (config_root / "agent.js").write_text("export const graph = {};\n")
+    (config_root / "package.json").write_text(
+        '{"dependencies":{"priv":"git+https://secret-token@github.com/org/private.git"}}\n'
+    )
+    (tmp_path / "package.json").write_text('{"name":"workspace"}\n')
+    config = validate_config(
+        {
+            "node_version": "20",
+            "graphs": {"agent": "./agent.js:graph"},
+        }
+    )
+
+    with pytest.raises(click.UsageError) as exc_info:
+        config_to_docker(
+            config_path,
+            config,
+            base_image="langchain/langgraphjs-api",
+            build_context=str(tmp_path),
+        )
+
+    message = str(exc_info.value)
+    assert "secret-token" not in message
+    assert f"Found in: {(config_root / 'package.json').resolve()}" in message
+
+
+@pytest.mark.parametrize(
+    "dependency",
+    [
+        "git+https://github.com/org/public.git@main",
+        "private-package @ git+https://github.com/org/private.git@main",
+        "git+ssh://git@github.com/org/private.git@main",
+    ],
+)
+def test_validate_config_allows_git_urls_without_http_userinfo(dependency: str):
+    con
```

---

### Incident Patch 13: `ed384f3a` (2026-09-20)
**Commit Message**: fix(cli): remediate AnyIO vulnerabilities in example lockfiles (#9022)

- Upgrade AnyIO from 4.13.0 to 4.14.2 in both uv example lockfiles,
fixing GHSA-82r6-8w77-94w6 (TLS certificate spoofing) and
GHSA-5p39-cfhj-2xmp (process-pool hangs).
- Remove the orphaned examples Poetry lockfile left behind by the uv
migration; current example tooling does not consume it.
- Addresses all six currently open Dependabot alerts without changing
unrelated dependencies.

Made by [Open SWE](https://github.com/langchain-ai/open-swe) · [view
thread](https://openswe.vercel.app/agents/37d08f4f-9fe6-51be-adc9-d58aa9e6e010)
· openai:gpt-6-astra (medium)

Co-authored-by: open-swe[bot] <[REDACTED_EMAIL]>

**File**: `libs/cli/examples/poetry.lock` (removed, +0/-285)
```diff
@@ -1,285 +0,0 @@
-# This file is automatically @generated by Poetry 2.0.0 and should not be changed by hand.
-
-[[package]]
-name = "anyio"
-version = "4.4.0"
-description = "High level compatibility layer for multiple asynchronous event loop implementations"
-optional = false
-python-versions = ">=3.8"
-groups = ["main"]
-files = [
-    {file = "anyio-4.4.0-py3-none-any.whl", hash = "sha256:c1b2d8f46a8a812513012e1107cb0e68c17159a7a594208005a57dc776e1bdc7"},
-    {file = "anyio-4.4.0.tar.gz", hash = "sha256:5aadc6a1bbb7cdb0bede386cac5e2940f5e2ff3aa20277e991cf028e0585ce94"},
-]
-
-[package.dependencies]
-exceptiongroup = {version = ">=1.0.2", markers = "python_version < \"3.11\""}
-idna = ">=2.8"
-sniffio = ">=1.1"
-typing-extensions = {version = ">=4.1", markers = "python_version < \"3.11\""}
-
-[package.extras]
-doc = ["Sphinx (>=7)", "packaging", "sphinx-autodoc-typehints (>=1.2.0)", "sphinx-rtd-theme"]
-test = ["anyio[trio]", "coverage[toml] (>=7)", "exceptiongroup (>=1.2.0)", "hypothesis (>=4.0)", "psutil (>=5.9)", "pytest (>=7.0)", "pytest-mock (>=3.6.1)", "trustme", "uvloop (>=0.17)"]
-trio = ["trio (>=0.23)"]
-
-[[package]]
-name = "certifi"
-version = "2024.7.4"
-description = "Python package for providing Mozilla's CA Bundle."
-optional = false
-python-versions = ">=3.6"
-groups = ["main"]
-files = [
-    {file = "certifi-2024.7.4-py3-none-any.whl", hash = "sha256:c198e21b1289c2ab85ee4e67bb4b4ef3ead0892059901a8d5b622f24a1101e90"},
-    {file = "certifi-2024.7.4.tar.gz", hash = "sha256:5a1e7645bc0ec61a09e26c36f6106dd4cf40c6db3a1fb6352b0244e7fb057c7b"},
-]
-
-[[package]]
-name = "click"
-version = "8.1.7"
-description = "Composable command line interface toolkit"
-optional = false
-python-versions = ">=3.7"
-groups = ["main"]
-files = [
-    {file = "click-8.1.7-py3-none-any.whl", hash = "sha256:ae74fb96c20a0277a1d615f1e4d73c8414f5a98db8b799a7931d1582f3390c28"},
-    {file = "click-8.1.7.tar.gz", hash = "sha256:ca9853ad459e787e2192211578cc907e7594e294c7ccc834310722b41b9ca6de"},
-]
-
-[package.dependencies]
-colorama = {version = "*", markers = "platform_system == \"Windows\""}
-
-[[package]]
-name = "colorama"
-version = "0.4.6"
-description = "Cross-platform colored terminal text."
-optional = false
-python-versions = "!=3.0.*,!=3.1.*,!=3.2.*,!=3.3.*,!=3.4.*,!=3.5.*,!=3.6.*,>=2.7"
-groups = ["main"]
-markers = "platform_system == \"Windows\""
-files = [
-    {file = "colorama-0.4.6-py2.py3-none-any.whl", hash = "sha256:4f1d9991f5acc0ca119f9d443620b77f9d6b33703e51011c16baf57afb285fc6"},
-    {file = "colorama-0.4.6.tar.gz", hash = "sha256:08695f5cb7ed6e0531a20572697297273c47b8cae5a63ffc6d6ed5c201be6e44"},
-]
-
-[[package]]
-name = "exceptiongroup"
-version = "1.2.1"
-description = "Backport of PEP 654 (exception groups)"
-optional = false
-python-versions = ">=3.7"
-groups = ["main"]
-markers = "python_version < \"3.11\""
-files = [
-    {file = "exceptiongroup-1.2.1-py3-none-any.whl", hash = "sha256:5258b9ed329c5bbdd31a309f53cbfb0b155341807f6ff7606a1e801a891b29ad"},
-    {file = "exceptiongroup-1.2.1.tar.gz", hash = "sha256:a4785e48b045528f5bfe627b6ad554ff32def154f42372786903b7abcfe1aa16"},
-]
-
-[package.extras]
-test = ["pytest (>=6)"]
-
-[[package]]
-name = "h11"
-version = "0.16.0"
-description = "A pure-Python, bring-your-own-I/O implementation of HTTP/1.1"
-optional = false
-python-versions = ">=3.8"
-groups = ["main"]
-files = [
-    {file = "h11-0.16.0-py3-none-any.whl", hash = "sha256:63cf8bbe7522de3bf65932fda1d9c2772064ffb3dae62d55932da54b31cb6c86"},
-    {file = "h11-0.16.0.tar.gz", hash = "sha256:4e35b956cf45792e4caa5885e69fba00bdbc6ffafbfa020300e549b208ee5ff1"},
-]
-
-[[package]]
-name = "httpcore"
-version = "1.0.9"
-description = "A minimal low-level HTTP client."
-optional = false
-python-versions = ">=3.8"
-groups = ["main"]
-files = [
-    {file = "httpcore-1.0.9-py3-none-any.whl", hash = "sha256:2d400746a40668fc9dec9810239072b40b4484b640a8c38fd654a024c7a1bf55"},
-    {file = "httpcore-1.0.9.tar.gz", hash = "sha256:6e34463af53fd2ab5d807f399a9b45ea31c3dfa2276f15a2c3f00afff6e176e8"},
-]
-
-[package.dependencies]
-certifi = "*"
-h11 = ">=0.16"
-
-[package.extras]
-asyncio = ["anyio (>=4.0,<5.0)"]
-http2 = ["h2 (>=3,<5)"]
-socks = ["socksio (==1.*)"]
-trio = ["trio (>=0.22.0,<1.0)"]
-
-[[package]]
-name = "httpx"
-version = "0.28.1"
-description = "The next generation HTTP client."
-optional = false
-python-versions = ">=3.8"
-groups = ["main"]
-files = [
-    {file = "httpx-0.28.1-py3-none-any.whl", hash = "sha256:d909fcccc110f8c7faf814ca82a9a4d816bc5a6dbfea25d6591d6985b8ba59ad"},
-    {file = "httpx-0.28.1.tar.gz", hash = "sha256:75e98c5f16b0f35b567856f597f06ff2270a374470a5c2392242528e3e3e42fc"},
-]
-
-[package.dependencies]
-anyio = "*"
-certifi = "*"
-httpcore = "==1.*"
-idna = "*"
-
-[package.extras]
-brotli = ["brotli", "brotlicffi"]
-cli = ["click (==8.*)", "pygments (==2.*)", "rich (>=10,<14)"]
-http2 = ["h2 (>=3,<5)"]
-socks = ["socksio (==1.*)"]
-zstd = ["zstandard (>=0.18.0
```

**File**: `libs/cli/uv-examples/monorepo/uv.lock` (modified, +3/-3)
```diff
@@ -39,15 +39,15 @@ wheels = [
 
 [[package]]
 name = "anyio"
-version = "4.13.0"
+version = "4.14.2"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "idna" },
     { name = "typing-extensions", marker = "python_full_version < '3.13'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/19/14/2c5dd9f512b66549ae92767a9c7b330ae88e1932ca57876909410251fe13/anyio-4.13.0.tar.gz", hash = "sha256:334b70e641fd2221c1505b3890c69882fe4a2df910cba14d97019b90b24439dc", size = 231622, upload-time = "2026-03-24T12:59:09.671Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/61/cc/a381afa6efea9f496eff839d4a6a1aed3bfafc7b3ab4b0d1b243a12573dd/anyio-4.14.2.tar.gz", hash = "sha256:cfa139f3ed1a23ee8f88a145ddb5ac7605b8bbfd8592baacd7ce3d8bb4313c7f", size = 260176, upload-time = "2026-07-12T20:29:07.082Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/da/42/e921fccf5015463e32a3cf6ee7f980a6ed0f395ceeaa45060b61d86486c2/anyio-4.13.0-py3-none-any.whl", hash = "sha256:08b310f9e24a9594186fd75b4f73f4a4152069e3853f1ed8bfbf58369f4ad708", size = 114353, upload-time = "2026-03-24T12:59:08.246Z" },
+    { url = "https://files.pythonhosted.org/packages/da/35/f2287558c17e29fafc8ef3daf819bb9834061cfa43bff8014f7df7f63bdc/anyio-4.14.2-py3-none-any.whl", hash = "sha256:9f505dda5ac9f0c8309b5e8bd445a8c2bf7246f3ce950121e45ea15bc41d1494", size = 125813, upload-time = "2026-07-12T20:29:05.763Z" },
 ]
 
 [[package]]
```

**File**: `libs/cli/uv-examples/simple/uv.lock` (modified, +3/-3)
```diff
@@ -13,15 +13,15 @@ wheels = [
 
 [[package]]
 name = "anyio"
-version = "4.13.0"
+version = "4.14.2"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "idna" },
     { name = "typing-extensions", marker = "python_full_version < '3.13'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/19/14/2c5dd9f512b66549ae92767a9c7b330ae88e1932ca57876909410251fe13/anyio-4.13.0.tar.gz", hash = "sha256:334b70e641fd2221c1505b3890c69882fe4a2df910cba14d97019b90b24439dc", size = 231622, upload-time = "2026-03-24T12:59:09.671Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/61/cc/a381afa6efea9f496eff839d4a6a1aed3bfafc7b3ab4b0d1b243a12573dd/anyio-4.14.2.tar.gz", hash = "sha256:cfa139f3ed1a23ee8f88a145ddb5ac7605b8bbfd8592baacd7ce3d8bb4313c7f", size = 260176, upload-time = "2026-07-12T20:29:07.082Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/da/42/e921fccf5015463e32a3cf6ee7f980a6ed0f395ceeaa45060b61d86486c2/anyio-4.13.0-py3-none-any.whl", hash = "sha256:08b310f9e24a9594186fd75b4f73f4a4152069e3853f1ed8bfbf58369f4ad708", size = 114353, upload-time = "2026-03-24T12:59:08.246Z" },
+    { url = "https://files.pythonhosted.org/packages/da/35/f2287558c17e29fafc8ef3daf819bb9834061cfa43bff8014f7df7f63bdc/anyio-4.14.2-py3-none-any.whl", hash = "sha256:9f505dda5ac9f0c8309b5e8bd445a8c2bf7246f3ce950121e45ea15bc41d1494", size = 125813, upload-time = "2026-07-12T20:29:05.763Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 14: `e539ac12` (2026-09-09)
**Commit Message**: chore(deps): fix vulnerable dev dependencies (#8449)

## Summary
Patch both `js-yaml` release lines in `libs/cli/js-examples` for
GHSA-2883-xcg3-v3hh: Jest's transitive copy to 3.15.2 and ESLint's to
4.3.2. Updates the existing fix rather than opening a duplicate; no
runtime dependencies added and no major-version overrides.

Addresses Dependabot alerts
[#398](https://github.com/langchain-ai/langgraph/security/dependabot/398)
and
[#397](https://github.com/langchain-ai/langgraph/security/dependabot/397).
These are real vulnerable versions in example development tooling; patch
rather than dismiss. Alerts remain open until this reaches `main` and
GitHub rescans.

## Verification
- [x] Yarn 1.22.22 regenerated the lockfile with lifecycle scripts
disabled; diff limited to the two js-yaml entries and scoped
resolutions.
- [x] `yarn install --frozen-lockfile --ignore-scripts --force
--non-interactive` in `libs/cli/js-examples`.
- [x] `yarn why js-yaml`: ESLint 4.3.2 and Jest/Istanbul 3.15.2.
- [x] Resolved versions checked against freshly retrieved GitHub
advisory patched versions for both alerts.
- [x] `yarn format:check` and `git diff --check`.
- [ ] Build fails in unchanged `tests/grap

**File**: `libs/cli/js-examples/package.json` (modified, +3/-1)
```diff
@@ -25,7 +25,9 @@
     "@langchain/langgraph": "^1.4.13"
   },
   "resolutions": {
-    "@langchain/langgraph-checkpoint": "1.0.4"
+    "@langchain/langgraph-checkpoint": "1.0.4",
+    "jest/**/js-yaml": "3.15.2",
+    "@eslint/eslintrc/js-yaml": "4.3.2"
   },
   "devDependencies": {
     "@eslint/eslintrc": "^3.3.6",
```

**File**: `libs/cli/js-examples/yarn.lock` (modified, +8/-8)
```diff
@@ -3744,18 +3744,18 @@ js-tokens@^4.0.0:
   resolved "https://registry.yarnpkg.com/js-tokens/-/js-tokens-4.0.0.tgz#19203fb59991df98e3a287050d4647cdeaf32499"
   integrity sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==
 
-js-yaml@^3.13.1:
-  version "3.14.2"
-  resolved "https://registry.yarnpkg.com/js-yaml/-/js-yaml-3.14.2.tgz#77485ce1dd7f33c061fd1b16ecea23b55fcb04b0"
-  integrity sha512-PMSmkqxr106Xa156c2M265Z+FTrPl+oxd/rgOQy2tijQeK5TxQ43psO1ZCwhVOSdnn+RzkzlRz/eY4BgJBYVpg==
+js-yaml@3.15.2, js-yaml@^3.13.1:
+  version "3.15.2"
+  resolved "https://registry.yarnpkg.com/js-yaml/-/js-yaml-3.15.2.tgz#3f83823ac6be17f570f23b2ecdef3777ff5ea364"
+  integrity sha512-6EuL879VkRA+1Cz578mKMiKvjPNEuk6+r1JaFzoSWejZmtf7xWbIyw1e3KkxlkzTIt9Taw6JBhEppG7utc1P+w==
   dependencies:
     argparse "^1.0.7"
     esprima "^4.0.0"
 
-js-yaml@^4.3.0:
-  version "4.3.1"
-  resolved "https://registry.yarnpkg.com/js-yaml/-/js-yaml-4.3.1.tgz#01216c001d67f48e2cd560d708c7af21090a3848"
-  integrity sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==
+js-yaml@4.3.2, js-yaml@^4.3.0:
+  version "4.3.2"
+  resolved "https://registry.yarnpkg.com/js-yaml/-/js-yaml-4.3.2.tgz#8e44fb14a2643c59726bb15787b5f1512cb3d3fb"
+  integrity sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==
   dependencies:
     argparse "^2.0.1"
 
```

---

### Incident Patch 15: `0199b519` (2026-09-08)
**Commit Message**: fix(cli): clarify missing deploy config (#8854)

Shows an actionable, docs-linked error when `langgraph deploy` is run
without a `langgraph.json` instead of exposing a traceback.

**File**: `libs/cli/langgraph_cli/deploy.py` (modified, +10/-0)
```diff
@@ -1603,6 +1603,16 @@ def _deploy_cmd(
 
     # -- 1. Preflight --
     validate_deploy_commands(install_command, build_command)
+    if not config.exists():
+        message = (
+            "We couldn't find a langgraph.json file. Run `langgraph deploy` from "
+            "the root of a LangSmith Deployment project. To get started, visit "
+            "https://docs.langchain.com/langsmith/deployment-quickstart."
+        )
+        if json_output:
+            em.error(message)
+            raise click.exceptions.Exit(1)
+        raise click.ClickException(message)
     config_json = langgraph_cli.config.validate_config_file(config)
     warn_non_wolfi_distro(config_json, emit=em.note)
 
```

**File**: `libs/cli/tests/unit_tests/cli/test_cli.py` (modified, +25/-0)
```diff
@@ -320,6 +320,31 @@ def test_top_level_help_truncates_command_descriptions_to_single_line() -> None:
     assert "[Beta] List LangSmith Deployments." in deploy_list_line
 
 
+def test_deploy_missing_config_shows_actionable_error(tmp_path, monkeypatch) -> None:
+    runner = CliRunner()
+    monkeypatch.chdir(tmp_path)
+
+    result = runner.invoke(cli, ["deploy"])
+
+    assert result.exit_code == 1
+    assert "We couldn't find a langgraph.json file." in result.output
+    assert "Run `langgraph deploy` from the root" in result.output
+    assert "https://docs.langchain.com/langsmith/deployment-quickstart" in result.output
+    assert "Traceback" not in result.output
+
+
+def test_deploy_missing_config_emits_json_error(tmp_path, monkeypatch) -> None:
+    runner = CliRunner()
+    monkeypatch.chdir(tmp_path)
+
+    result = runner.invoke(cli, ["deploy", "--json"])
+
+    assert result.exit_code == 1
+    events = [json.loads(line) for line in result.output.splitlines()]
+    assert events[-1]["event"] == "error"
+    assert "We couldn't find a langgraph.json file." in events[-1]["message"]
+
+
 def test_dev_command_requires_ssl_certfile_and_keyfile_together(tmp_path) -> None:
     config_path = tmp_path / "langgraph.json"
     config_path.write_text(
```

#### Recent Merged Pull Requests:
- **PR #9205** (2026-10-05): release(langgraph): 1.2.13 (@soarez)
- **PR #9204** (closed): fix(langgraph): make Send.__hash__ work with dict payloads (@TINGyu123644)
- **PR #9203** (closed): fix(checkpoint): round-trip parametrized pydantic generics through msgpack (@mathewOracle)
- **PR #9201** (closed): fix(checkpoint-postgres): backfill non-indexed items on PostgresStore vector search (@tanishipss)
- **PR #9200** (closed): fix(checkpoint-sqlite): backfill non-indexed items on SqliteStore vector search (@tanishipss)
- **PR #9199** (closed): fix(checkpoint): treat namespace and prefix literally in RedisCache.clear (@tanishipss)
- **PR #9198** (closed): fix(checkpoint-postgres): accept serde in PostgresSaver.from_conn_string (@tanishipss)
- **PR #9197** (closed): fix(checkpoint-sqlite): rank nearest first for l2 distance in SqliteStore (@tanishipss)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
