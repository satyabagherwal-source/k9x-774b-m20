# Forensic Learning Record (Deep Inspection): microsoft/autogen

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-autogen-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/autogen](https://github.com/microsoft/autogen))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:57:24.276Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/autogen`
- **Description**: A programming framework for agentic AI
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 61269 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `python/packages/autogen-agentchat/src/autogen_agentchat/state/__init__.py`
```
"""State management for agents, teams and termination conditions."""

from ._states import (
    AssistantAgentState,
    BaseGroupChatManagerState,
    BaseState,
    ChatAgentContainerState,
    MagenticOneOrchestratorState,
    RoundRobinManagerState,
    SelectorManagerState,
    SocietyOfMindAgentState,
    SwarmManagerState,
    TeamState,
)

__all__ = [
    "BaseState",
    "AssistantAgentState",
    "BaseGroupChatManagerState",
    "ChatAgentContainerState",
    "RoundRobinManagerState",
    "SelectorManagerState",
    "SwarmManagerState",
    "MagenticOneOrchestratorState",
    "TeamState",
    "SocietyOfMindAgentState",
]

```

### Core Architecture Module: `python/packages/autogen-agentchat/src/autogen_agentchat/state/_states.py`
```
from typing import Any, List, Mapping, Optional

from pydantic import BaseModel, Field


class BaseState(BaseModel):
    """Base class for all saveable state"""

    type: str = Field(default="BaseState")
    version: str = Field(default="1.0.0")


class AssistantAgentState(BaseState):
    """State for an assistant agent."""

    llm_context: Mapping[str, Any] = Field(default_factory=lambda: dict([("messages", [])]))
    type: str = Field(default="AssistantAgentState")


class TeamState(BaseState):
    """State for a team of agents."""

    agent_states: Mapping[str, Any] = Field(default_factory=dict)
    type: str = Field(default="TeamState")


class BaseGroupChatManagerState(BaseState):
    """Base state for all group chat managers."""

    message_thread: List[Mapping[str, Any]] = Field(default_factory=list)
    current_turn: int = Field(default=0)
    type: str = Field(default="BaseGroupChatManagerState")


class ChatAgentContainerState(BaseState):
    """State for a container of chat agents."""

    agent_state: Mapping[str, Any] = Field(default_factory=dict)
    message_buffer: List[Mapping[str, Any]] = Field(default_factory=list)
    type: str = Field(default="ChatAgentContainerState")


class RoundRobinManagerState(BaseGroupChatManagerState):
    """State for :class:`~autogen_agentchat.teams.RoundRobinGroupChat` manager."""

    next_speaker_index: int = Field(default=0)
    type: str = Field(default="RoundRobinManagerState")


class SelectorManagerState(BaseGroupChatManagerState):
    """State for :class:`~autogen_agentchat.teams.SelectorGroupChat` manager."""

    previous_speaker: Optional[str] = Field(default=None)
    type: str = Field(default="SelectorManagerState")


class SwarmManagerState(BaseGroupChatManagerState):
    """State for :class:`~autogen_agentchat.teams.Swarm` manager."""

    current_speaker: str = Field(default="")
    type: str = Field(default="SwarmManagerState")


class MagenticOneOrchestratorState(BaseGroupChatManagerState):
    """State for :class:`~autogen_agentchat.teams.MagneticOneGroupChat` orchestrator."""

    task: str = Field(default="")
    facts: str = Field(default="")
    plan: str = Field(default="")
    n_rounds: int = Field(default=0)
    n_stalls: int = Field(default=0)
    type: str = Field(default="MagenticOneOrchestratorState")


class SocietyOfMindAgentState(BaseState):
    """State for a Society of Mind agent."""

    inner_team_state: Mapping[str, Any] = Field(default_factory=dict)
    type: str = Field(default="SocietyOfMindAgentState")

```

### Core Architecture Module: `python/packages/autogen-agentchat/src/autogen_agentchat/utils/__init__.py`
```
"""
This module implements various utilities common to AgentChat agents and teams.
"""

from ._utils import content_to_str, remove_images

__all__ = ["content_to_str", "remove_images"]

```

### Core Architecture Module: `python/packages/autogen-agentchat/src/autogen_agentchat/utils/_utils.py`
```
from typing import List, Union

from autogen_core import FunctionCall, Image
from autogen_core.models import FunctionExecutionResult, LLMMessage, UserMessage
from pydantic import BaseModel

# Type aliases for convenience
_StructuredContent = BaseModel
_UserContent = Union[str, List[Union[str, Image]]]
_AssistantContent = Union[str, List[FunctionCall]]
_FunctionExecutionContent = List[FunctionExecutionResult]
_SystemContent = str


def content_to_str(
    content: _UserContent | _AssistantContent | _FunctionExecutionContent | _SystemContent | _StructuredContent,
) -> str:
    """Convert the content of an LLMMessage to a string."""
    if isinstance(content, str):
        return content
    elif isinstance(content, BaseModel):
        return content.model_dump_json()
    else:
        result: List[str] = []
        for c in content:
            if isinstance(c, str):
                result.append(c)
            elif isinstance(c, Image):
                result.append("<image>")
            else:
                result.append(str(c))

    return "\n".join(result)


def remove_images(messages: List[LLMMessage]) -> List[LLMMessage]:
    """Remove images from a list of LLMMessages"""
    str_messages: List[LLMMessage] = []
    for message in messages:
        if isinstance(message, UserMessage) and isinstance(message.content, list):
            str_messages.append(UserMessage(content=content_to_str(message.content), source=message.source))
        else:
            str_messages.append(message)
    return str_messages

```

### Core Architecture Module: `python/packages/autogen-core/src/autogen_core/__init__.py`
```
import importlib.metadata

__version__ = importlib.metadata.version("autogen_core")

from ._agent import Agent
from ._agent_id import AgentId
from ._agent_instantiation import AgentInstantiationContext
from ._agent_metadata import AgentMetadata
from ._agent_proxy import AgentProxy
from ._agent_runtime import AgentRuntime
from ._agent_type import AgentType
from ._base_agent import BaseAgent
from ._cache_store import CacheStore, InMemoryStore
from ._cancellation_token import CancellationToken
from ._closure_agent import ClosureAgent, ClosureContext
from ._component_config import (
    Component,
    ComponentBase,
    ComponentFromConfig,
    ComponentLoader,
    ComponentModel,
    ComponentSchemaType,
    ComponentToConfig,
    ComponentType,
    is_component_class,
    is_component_instance,
)
from ._constants import (
    EVENT_LOGGER_NAME as EVENT_LOGGER_NAME_ALIAS,
)
from ._constants import (
    ROOT_LOGGER_NAME as ROOT_LOGGER_NAME_ALIAS,
)
from ._constants import (
    TRACE_LOGGER_NAME as TRACE_LOGGER_NAME_ALIAS,
)
from ._default_subscription import DefaultSubscription, default_subscription, type_subscription
from ._default_topic import DefaultTopicId
from ._image import Image
from ._intervention import (
    DefaultInterventionHandler,
    DropMessage,
    InterventionHandler,
)
from ._message_context import MessageContext
from ._message_handler_context import MessageHandlerContext
from ._routed_agent import RoutedAgent, event, message_handler, rpc
from ._serialization import (
    JSON_DATA_CONTENT_TYPE as JSON_DATA_CONTENT_TYPE_ALIAS,
)
from ._serialization import (
    PROTOBUF_DATA_CONTENT_TYPE as PROTOBUF_DATA_CONTENT_TYPE_ALIAS,
)
from ._serialization import (
    MessageSerializer,
    UnknownPayload,
    try_get_known_serializers_for_type,
)
from ._single_threaded_agent_runtime import SingleThreadedAgentRuntime
from ._subscription import Subscription
from ._subscription_context import SubscriptionInstantiationContext
from ._telemetry import (
    trace_create_agent_span,
    trace_invoke_agent_span,
    trace_tool_span,
)
from ._topic import TopicId
from ._type_prefix_subscription import TypePrefixSubscription
from ._type_subscription import TypeSubscription
from ._types import FunctionCall

EVENT_LOGGER_NAME = EVENT_LOGGER_NAME_ALIAS
"""The name of the logger used for structured events."""

ROOT_LOGGER_NAME = ROOT_LOGGER_NAME_ALIAS
"""The name of the root logger."""

TRACE_LOGGER_NAME = TRACE_LOGGER_NAME_ALIAS
"""Logger name used for developer intended trace logging. The content and format of this log should not be depended upon."""

JSON_DATA_CONTENT_TYPE = JSON_DATA_CONTENT_TYPE_ALIAS
"""The content type for JSON data."""

PROTOBUF_DATA_CONTENT_TYPE = PROTOBUF_DATA_CONTENT_TYPE_ALIAS
"""The content type for Protobuf data."""

__all__ = [
    "Agent",
    "AgentId",
    "AgentProxy",
    "AgentMetadata",
    "AgentRuntime",
    "BaseAgent",
    "CacheStore",
    "InMemoryStore",
    "CancellationToken",
    "AgentInstantiationContext",
    "TopicId",
    "Subscription",
    "MessageContext",
    "AgentType",
    "SubscriptionInstantiationContext",
    "MessageHandlerContext",
    "MessageSerializer",
    "try_get_known_serializers_for_type",
    "UnknownPayload",
    "Image",
    "RoutedAgent",
    "ClosureAgent",
    "ClosureContext",
    "message_handler",
    "event",
    "rpc",
    "FunctionCall",
    "TypeSubscription",
    "DefaultSubscription",
    "DefaultTopicId",
    "default_subscription",
    "type_subscription",
    "TypePrefixSubscription",
    "JSON_DATA_CONTENT_TYPE",
    "PROTOBUF_DATA_CONTENT_TYPE",
    "SingleThreadedAgentRuntime",
    "ROOT_LOGGER_NAME",
    "EVENT_LOGGER_NAME",
    "TRACE_LOGGER_NAME",
    "Component",
    "ComponentBase",
    "ComponentFromConfig",
    "ComponentLoader",
    "ComponentModel",
    "ComponentSchemaType",
    "ComponentToConfig",
    "ComponentType",
    "is_component_class",
    "is_component_instance",
    "DropMessage",
    "InterventionHandler",
    "DefaultInterventionHandler",
    "trace_create_agent_span",
    "trace_invoke_agent_span",
    "trace_tool_span",
]

```

### Core Architecture Module: `python/packages/autogen-core/src/autogen_core/_agent.py`
```
from typing import TYPE_CHECKING, Any, Mapping, Protocol, runtime_checkable

from ._agent_id import AgentId
from ._agent_metadata import AgentMetadata
from ._message_context import MessageContext

# Forward declaration for type checking only
if TYPE_CHECKING:
    from ._agent_runtime import AgentRuntime


@runtime_checkable
class Agent(Protocol):
    @property
    def metadata(self) -> AgentMetadata:
        """Metadata of the agent."""
        ...

    @property
    def id(self) -> AgentId:
        """ID of the agent."""
        ...

    async def bind_id_and_runtime(self, id: AgentId, runtime: "AgentRuntime") -> None:
        """Function used to bind an Agent instance to an `AgentRuntime`.

        Args:
            agent_id (AgentId): ID of the agent.
            runtime (AgentRuntime): AgentRuntime instance to bind the agent to.
        """
        ...

    async def on_message(self, message: Any, ctx: MessageContext) -> Any:
        """Message handler for the agent. This should only be called by the runtime, not by other agents.

        Args:
            message (Any): Received message. Type is one of the types in `subscriptions`.
            ctx (MessageContext): Context of the message.

        Returns:
            Any: Response to the message. Can be None.

        Raises:
            asyncio.CancelledError: If the message was cancelled.
            CantHandleException: If the agent cannot handle the message.
        """
        ...

    async def save_state(self) -> Mapping[str, Any]:
        """Save the state of the agent. The result must be JSON serializable."""
        ...

    async def load_state(self, state: Mapping[str, Any]) -> None:
        """Load in the state of the agent obtained from `save_state`.

        Args:
            state (Mapping[str, Any]): State of the agent. Must be JSON serializable.
        """

        ...

    async def close(self) -> None:
        """Called when the runtime is closed"""
        ...

```

### Core Architecture Module: `python/packages/autogen-core/src/autogen_core/_agent_id.py`
```
import re

from typing_extensions import Self

from ._agent_type import AgentType


def is_valid_agent_type(value: str) -> bool:
    return bool(re.match(r"^[\w\-\.]+\Z", value))


class AgentId:
    """
    Agent ID uniquely identifies an agent instance within an agent runtime - including distributed runtime. It is the 'address' of the agent instance for receiving messages.

    See here for more information: :ref:`agentid_and_lifecycle`
    """

    def __init__(self, type: str | AgentType, key: str) -> None:
        if isinstance(type, AgentType):
            type = type.type

        if not is_valid_agent_type(type):
            raise ValueError(rf"Invalid agent type: {type}. Allowed values MUST match the regex: `^[\w\-\.]+\Z`")

        self._type = type
        self._key = key

    def __hash__(self) -> int:
        return hash((self._type, self._key))

    def __str__(self) -> str:
        return f"{self._type}/{self._key}"

    def __repr__(self) -> str:
        return f'AgentId(type="{self._type}", key="{self._key}")'

    def __eq__(self, value: object) -> bool:
        if not isinstance(value, AgentId):
            return False
        return self._type == value.type and self._key == value.key

    @classmethod
    def from_str(cls, agent_id: str) -> Self:
        """Convert a string of the format ``type/key`` into an AgentId"""
        items = agent_id.split("/", maxsplit=1)
        if len(items) != 2:
            raise ValueError(f"Invalid agent id: {agent_id}")
        type, key = items[0], items[1]
        return cls(type, key)

    @property
    def type(self) -> str:
        """
        An identifier that associates an agent with a specific factory function.

        Strings may only be composed of alphanumeric letters (a-z) and (0-9), or underscores (_).
        """
        return self._type

    @property
    def key(self) -> str:
        """
        Agent instance identifier.

        Strings may only be composed of alphanumeric letters (a-z) and (0-9), or underscores (_).
        """
        return self._key

```

### Core Architecture Module: `python/packages/autogen-core/src/autogen_core/_agent_instantiation.py`
```
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, ClassVar, Generator

from ._agent_id import AgentId
from ._agent_runtime import AgentRuntime


class AgentInstantiationContext:
    """A static class that provides context for agent instantiation.

    This static class can be used to access the current runtime and agent ID
    during agent instantiation -- inside the factory function or the agent's
    class constructor.

    Example:

        Get the current runtime and agent ID inside the factory function and
        the agent's constructor:

        .. code-block:: python

            import asyncio
            from dataclasses import dataclass

            from autogen_core import (
                AgentId,
                AgentInstantiationContext,
                MessageContext,
                RoutedAgent,
                SingleThreadedAgentRuntime,
                message_handler,
            )


            @dataclass
            class TestMessage:
                content: str


            class TestAgent(RoutedAgent):
                def __init__(self, description: str):
                    super().__init__(description)
                    # Get the current runtime -- we don't use it here, but it's available.
                    _ = AgentInstantiationContext.current_runtime()
                    # Get the current agent ID.
                    agent_id = AgentInstantiationContext.current_agent_id()
                    print(f"Current AgentID from constructor: {agent_id}")

                @message_handler
                async def handle_test_message(self, message: TestMessage, ctx: MessageContext) -> None:
                    print(f"Received message: {message.content}")


            def test_agent_factory() -> TestAgent:
                # Get the current runtime -- we don't use it here, but it's available.
                _ = AgentInstantiationContext.current_runtime()
                # Get the current agent ID.
                agent_id = AgentInstantiationContext.current_agent_id()
                print(f"Current AgentID from factory: {agent_id}")
                return TestAgent(description="Test agent")


            async def main() -> None:
                # Create a SingleThreadedAgentRuntime instance.
                runtime = SingleThreadedAgentRuntime()

                # Start the runtime.
                runtime.start()

                # Register the agent type with a factory function.
                await runtime.register_factory("test_agent", test_agent_factory)

                # Send a message to the agent. The runtime will instantiate the agent and call the message handler.
                await runtime.send_message(TestMessage(content="Hello, world!"), AgentId("test_agent", "default"))

                # Stop the runtime.
                await runtime.stop()


            asyncio.run(main())

    """

    def __init__(self) -> None:
        raise RuntimeError(
            "AgentInstantiationContext cannot be instantiated. It is a static class that provides context management for agent instantiation."
        )

    _AGENT_INSTANTIATION_CONTEXT_VAR: ClassVar[ContextVar[tuple[AgentRuntime, AgentId]]] = ContextVar(
        "_AGENT_INSTANTIATION_CONTEXT_VAR"
    )

    @classmethod
    @contextmanager
    def populate_context(cls, ctx: tuple[AgentRuntime, AgentId]) -> Generator[None, Any, None]:
        """:meta private:"""
        token = AgentInstantiationContext._AGENT_INSTANTIATION_CONTEXT_VAR.set(ctx)
        try:
            yield
        finally:
            AgentInstantiationContext._AGENT_INSTANTIATION_CONTEXT_VAR.reset(token)

    @classmethod
    def current_runtime(cls) -> AgentRuntime:
        try:
            return cls._AGENT_INSTANTIATION_CONTEXT_VAR.get()[0]
        except LookupError as e:
            raise RuntimeError(
                "AgentInstantiationContext.runtime() must be called within an instantiation context such as when the AgentRuntime is instantiating an agent. Mostly likely this was caused by directly instantiating an agent instead of using the AgentRuntime to do so."
            ) from e

    @classmethod
    def current_agent_id(cls) -> AgentId:
        try:
            return cls._AGENT_INSTANTIATION_CONTEXT_VAR.get()[1]
        except LookupError as e:
            raise RuntimeError(
                "AgentInstantiationContext.agent_id() must be called within an instantiation context such as when the AgentRuntime is instantiating an agent. Mostly likely this was caused by directly instantiating an agent instead of using the AgentRuntime to do so."
            ) from e

    @classmethod
    def is_in_factory_call(cls) -> bool:
        if cls._AGENT_INSTANTIATION_CONTEXT_VAR.get(None) is None:
            return False
        return True

```

### Core Architecture Module: `python/packages/autogen-core/src/autogen_core/_agent_metadata.py`
```
from typing import TypedDict


class AgentMetadata(TypedDict):
    type: str
    key: str
    description: str

```

### Core Architecture Module: `python/packages/autogen-core/src/autogen_core/_agent_proxy.py`
```
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Awaitable, Mapping

from ._agent_id import AgentId
from ._agent_metadata import AgentMetadata
from ._cancellation_token import CancellationToken

if TYPE_CHECKING:
    from ._agent_runtime import AgentRuntime


class AgentProxy:
    """A helper class that allows you to use an :class:`~autogen_core.AgentId` in place of its associated :class:`~autogen_core.Agent`"""

    def __init__(self, agent: AgentId, runtime: AgentRuntime):
        self._agent = agent
        self._runtime = runtime

    @property
    def id(self) -> AgentId:
        """Target agent for this proxy"""
        return self._agent

    @property
    def metadata(self) -> Awaitable[AgentMetadata]:
        """Metadata of the agent."""
        return self._runtime.agent_metadata(self._agent)

    async def send_message(
        self,
        message: Any,
        *,
        sender: AgentId,
        cancellation_token: CancellationToken | None = None,
        message_id: str | None = None,
    ) -> Any:
        return await self._runtime.send_message(
            message,
            recipient=self._agent,
            sender=sender,
            cancellation_token=cancellation_token,
            message_id=message_id,
        )

    async def save_state(self) -> Mapping[str, Any]:
        """Save the state of the agent. The result must be JSON serializable."""
        return await self._runtime.agent_save_state(self._agent)

    async def load_state(self, state: Mapping[str, Any]) -> None:
        """Load in the state of the agent obtained from `save_state`.

        Args:
            state (Mapping[str, Any]): State of the agent. Must be JSON serializable.
        """
        await self._runtime.agent_load_state(self._agent, state)

```

### Core Architecture Module: `python/packages/autogen-core/src/autogen_core/_agent_runtime.py`
```
from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Awaitable, Callable, Mapping, Protocol, Type, TypeVar, overload, runtime_checkable

from ._agent import Agent
from ._agent_id import AgentId
from ._agent_metadata import AgentMetadata
from ._agent_type import AgentType
from ._cancellation_token import CancellationToken
from ._serialization import MessageSerializer
from ._subscription import Subscription
from ._topic import TopicId

# Undeliverable - error

T = TypeVar("T", bound=Agent)


@runtime_checkable
class AgentRuntime(Protocol):
    async def send_message(
        self,
        message: Any,
        recipient: AgentId,
        *,
        sender: AgentId | None = None,
        cancellation_token: CancellationToken | None = None,
        message_id: str | None = None,
    ) -> Any:
        """Send a message to an agent and get a response.

        Args:
            message (Any): The message to send.
            recipient (AgentId): The agent to send the message to.
            sender (AgentId | None, optional): Agent which sent the message. Should **only** be None if this was sent from no agent, such as directly to the runtime externally. Defaults to None.
            cancellation_token (CancellationToken | None, optional): Token used to cancel an in progress . Defaults to None.

        Raises:
            CantHandleException: If the recipient cannot handle the message.
            UndeliverableException: If the message cannot be delivered.
            Other: Any other exception raised by the recipient.

        Returns:
            Any: The response from the agent.
        """

        ...

    async def publish_message(
        self,
        message: Any,
        topic_id: TopicId,
        *,
        sender: AgentId | None = None,
        cancellation_token: CancellationToken | None = None,
        message_id: str | None = None,
    ) -> None:
        """Publish a message to all agents in the given namespace, or if no namespace is provided, the namespace of the sender.

        No responses are expected from publishing.

        Args:
            message (Any): The message to publish.
            topic_id (TopicId): The topic to publish the message to.
            sender (AgentId | None, optional): The agent which sent the message. Defaults to None.
            cancellation_token (CancellationToken | None, optional): Token used to cancel an in progress. Defaults to None.
            message_id (str | None, optional): The message id. If None, a new message id will be generated. Defaults to None. This message id must be unique. and is recommended to be a UUID.

        Raises:
            UndeliverableException: If the message cannot be delivered.
        """
        ...

    async def register_factory(
        self,
        type: str | AgentType,
        agent_factory: Callable[[], T | Awaitable[T]],
        *,
        expected_class: type[T] | None = None,
    ) -> AgentType:
        """Register an agent factory with the runtime associated with a specific type. The type must be unique. This API does not add any subscriptions.

        .. note::

            This is a low level API and usually the agent class's `register` method should be used instead, as this also handles subscriptions automatically.

        Example:

        .. code-block:: python

            from dataclasses import dataclass

            from autogen_core import AgentRuntime, MessageContext, RoutedAgent, event
            from autogen_core.models import UserMessage


            @dataclass
            class MyMessage:
                content: str


            class MyAgent(RoutedAgent):
                def __init__(self) -> None:
                    super().__init__("My core agent")

                @event
                async def handler(self, message: UserMessage, context: MessageContext) -> None:
                    print("Event received: ", message.content)


            async def my_agent_factory():
                return MyAgent()


            async def main() -> None:
                runtime: AgentRuntime = ...  # type: ignore
                await runtime.register_factory("my_agent", lambda: MyAgent())


            import asyncio

            asyncio.run(main())


        Args:
            type (str): The type of agent this factory creates. It is not the same as agent class name. The `type` parameter is used to differentiate between different factory functions rather than agent classes.
            agent_factory (Callable[[], T]): The factory that creates the agent, where T is a concrete Agent type. Inside the factory, use `autogen_core.AgentInstantiationContext` to access variables like the current runtime and agent ID.
            expected_class (type[T] | None, optional): The expected class of the agent, used for runtime validation of the factory. Defaults to None. If None, no validation is performed.
        """
        ...

    async def register_agent_instance(
        self,
        agent_instance: Agent,
        agent_id: AgentId,
    ) -> AgentId:
        """Register an agent instance with the runtime. The type may be reused, but each agent_id must be unique. All agent instances within a type must be of the same object type. This API does not add any subscriptions.

        .. note::

            This is a low level API and usually the agent class's `register_instance` method should be used instead, as this also handles subscriptions automatically.

        Example:

        .. code-block:: python

            from dataclasses import dataclass

            from autogen_core import AgentId, AgentRuntime, MessageContext, RoutedAgent, event
            from autogen_core.models import UserMessage


            @dataclass
            class MyMessage:
                content: str


            class MyAgent(RoutedAgent):
                def __init__(self) -> None:
                    super().__init__("My core agent")

                @event
                async def handler(self, message: UserMessage, context: MessageContext) -> None:
                    print("Event received: ", message.content)


            async def main() -> None:
                runtime: AgentRuntime = ...  # type: ignore
                agent = MyAgent()
                await runtime.register_agent_instance(
                    agent_instance=agent, agent_id=AgentId(type="my_agent", key="default")
                )


            import asyncio

            asyncio.run(main())


        Args:
            agent_instance (Agent): A concrete instance of the agent.
            agent_id (AgentId): The agent's identifier. The agent's type is `agent_id.type`.
        """
        ...

    # TODO: uncomment out the following type ignore when this is fixed in mypy: https://github.com/python/mypy/issues/3737
    async def try_get_underlying_agent_instance(self, id: AgentId, type: Type[T] = Agent) -> T:  # type: ignore[assignment]
        """Try to get the underlying agent instance by name and namespace. This is generally discouraged (hence the long name), but can be useful in some cases.

        If the underlying agent is not accessible, this will raise an exception.

        Args:
            id (AgentId): The agent id.
            type (Type[T], optional): The expected type of the agent. Defaults to Agent.

        Returns:
            T: The concrete agent instance.

        Raises:
            LookupError: If the agent is not found.
            NotAccessibleError: If the agent is not accessible, for example if it is located remotely.
            TypeError: If the agent is not of the expected type.
        """
        ...

    @overload
    async def get(self, id: AgentId, /, *, lazy: bool = ...) -> AgentId: ...

    @overload
    async def get(self, type: AgentType | str, /, key: str = ..., *, lazy: bool = ...) -> AgentId: ...

    async def get(
        self, id_or_type: AgentId | AgentType | str, /, key: str = "default", *, lazy: bool = True
    ) -> AgentId: ...

    async def save_state(self) -> Mapping[str, Any]:
        """Save the state of the entire runtime, including all hosted agents. The only way to restore the state is to pass it to :meth:`load_state`.

        The structure of the state is implementation defined and can be any JSON serializable object.

        Returns:
            Mapping[str, Any]: The saved state.
        """
        ...

    async def load_state(self, state: Mapping[str, Any]) -> None:
        """Load the state of the entire runtime, including all hosted agents. The state should be the same as the one returned by :meth:`save_state`.

        Args:
            state (Mapping[str, Any]): The saved state.
        """
        ...

    async def agent_metadata(self, agent: AgentId) -> AgentMetadata:
        """Get the metadata for an agent.

        Args:
            agent (AgentId): The agent id.

        Returns:
            AgentMetadata: The agent metadata.
        """
        ...

    async def agent_save_state(self, agent: AgentId) -> Mapping[str, Any]:
        """Save the state of a single agent.

        The structure of the state is implementation defined and can be any JSON serializable object.

        Args:
            agent (AgentId): The agent id.

        Returns:
            Mapping[str, Any]: The saved state.
        """
        ...

    async def agent_load_state(self, agent: AgentId, state: Mapping[str, Any]) -> None:
        """Load the state of a single agent.

        Args:
            agent (AgentId): The agent id.
            state (Mapping[str, Any]): The saved state.
        """
        ...

    async def add_subscription(self, subscription: Subscription) -> None:
        """Add a new subscription that the runtime should fulfill when processing published messages

        Args:
            subscription (Subscription): The subscription to add
        """
        ...

    async def remove_subscription(self, id: str) -> None:
        """Remove a subscri
```

### Core Architecture Module: `python/packages/autogen-core/src/autogen_core/_agent_type.py`
```
from dataclasses import dataclass


@dataclass(eq=True, frozen=True)
class AgentType:
    type: str
    """String representation of this agent type."""

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8274** (2026-09-25): **feat(examples): add Adam Network agent integration example**
  *Symptoms*: ## Summary  Adds a small, self-contained example showing how an AutoGen `AssistantAgent` can talk to the **[Adam Network](https://adam-network.up.railway.app)** — a decentralized, open social stream built for autonomous AI agents (and humans).  ### What is Adam Network?  - Open social network / messaging stream designed for AI agents to read, post, and reply. - Anti-spam via a 6-character reverse-SHA-1 Proof-of-Work challenge, solved **client-side** by the SDK — no human friction. - Python SDK: [`adam-network-client`](https://pypi.org/project/adam-network-client/) on PyPI (also available for LangChain, CrewAI, LlamaIndex, ElizaOS, and as a remote MCP server). - Repo: https://github.com/snow884/adam-network · Contact: Adam Ivansky (adam.ivansky@gmail.com)  ### What this example does  1. Exposes two Python tools — `post_to_adam_network` and `search_adam_network` — that wrap the Adam Network SDK. 2. Wires them into an AutoGen `AssistantAgent` via `FunctionTool`. 3. Runs a short conversation where the agent searches the stream and posts an update.  ### How to run  ```bash pip install autogen-agentchat adam-network-client python examples/adam_network_autogen_example.py ```  No API keys are needed for Adam Network (guest mode works out of the box); only the LLM provider key for the AutoGen model is required.  Happy to adjust the file location or structure to match the repo's example conventions. Thanks for considering!
  **Post-Mortem & Fix Analysis**:
  > This was opened by an automated promotion agent that wasn't checking whether contributions like this were wanted here first — apologies for the drive-by PR and the noise. Not a reflection on this project. Closing it and deleting the branch/fork; no action needed on your end.

- **Issue #8250** (2026-09-30): **Fix: drop trailing assistant message when rstrip leaves it empty**
  *Symptoms*: Fixes #7768  ## Root cause `_rstrip_last_assistant_message()` is documented as removing the last assistant message when it is empty, but it only called `.rstrip()` on the content and left the (now possibly empty) message in the list. When the trailing `AssistantMessage.content` was whitespace-only, this produced an empty-string content block, which the Anthropic API rejects (text content blocks must be non-empty).  ## Fix After stripping, if the content becomes an empty string, drop the message entirely — matching the function's documented behavior. Non-empty trailing assistant messages are still only whitespace-stripped, preserving the existing \"prefill\" behavior and pre-existing passing tests. Same fix applied to both the Anthropic and OpenAI clients, which share an identical copy of this helper.  ## Verification Added regression tests in both `test_anthropic_model_client.py` and `test_openai_model_client.py`. Ran the full local suite: all pre-existing and new tests pass (unrelated failures due to missing `OPENAI_API_KEY` in this environment, confirmed unrelated via traceback inspection).\n\n*(This is a restoration of closed PR #8029)*

- **Issue #8245** (2026-10-04): **fix(autogen-ext): enforce trust boundary on Docker volume mounts (OWASP ASI10)**
  *Symptoms*: ## Summary  Fixes #7917 (OWASP ASI10: Docker code executor mounts host filesystem without trust boundary validation).  `DockerCommandLineCodeExecutor.start()` accepted arbitrary host paths via `extra_volumes` without validating them. An agent with code-execution capability could escape the container sandbox simply by mounting `/etc/passwd`, `/var/run/docker.sock`, or any sensitive path on the host. This is the trust-boundary violation that OWASP flags as ASI10.  ## Changes  ### `python/packages/autogen-ext/src/autogen_ext/code_executors/docker/_docker_code_executor.py`  Adds `_validate_host_volume_paths()` and calls it at the start of `start()` *before* any Docker client connection is attempted (fail-closed). The validator:  1. **Allowlists** paths under the executor's own `work_dir` / `bind_dir` so the default sandbox workflow keeps working unchanged. 2. **Rejects** absolute paths resolving to well-known sensitive directories (`/etc`, `/root`, `/home`, `/var`, `/usr`, `/proc`, `/sys`, `/var/run/docker.sock`, etc.). The list is resolved against the host at import time, so `/etc` is correctly caught on macOS where it symlinks to `/private/etc`. 3. **Rejects** relative paths or paths containing `..` that escape the workspace roots. 4. **Rejects** empty strings, NUL-byte injections, and non-dict bind specifications before any container is created. 5. **Requires** absolute paths outside the sensitive block to exist on the host so typos surface immediately.  ### `python/packages/a

- **Issue #8237** (2026-10-02): **CSOAI — AutoGen interop: multi-agent governance**
  *Symptoms*: Withdrawn. No action is requested from this project.

- **Issue #8236** (2026-10-02): **CSOAI — AutoGen AI governance multi-agent**
  *Symptoms*: Withdrawn. No action is requested from this project.

- **Issue #8235** (2026-10-02): **CSOAI — AutoGen AI governance multi-agent**
  *Symptoms*: Withdrawn. No action is requested from this project.

- **Issue #8201** (2026-10-04): **feat: add Cross-Chain Intent Tool supporting ERC-7683 standard**
  *Symptoms*: ## Why are these changes needed?\n\nThis PR introduces a `CrossChainIntentTool` to AutoGen, enabling agents to participate in cross-chain intent protocols as discussed in #7888. The tool follows the ERC-7683 standard for cross-chain intents, allowing agents to:\n- Formulate cross-chain orders (swaps, bridges, etc.)\n- Submit intents to solver engines via HTTP\n- Support multi-chain coordination in agentic workflows\n\nThis implementation provides a foundational bridge for Web3-enabled autonomous agents in the AutoGen ecosystem.\n\n## Related issue number\n\nCloses #7888\n\n## Checks\n\n- [x] I've added tests (if relevant) corresponding to the changes introduced in this PR.\n- [x] I've made sure all auto checks have passed.

- **Issue #8198** (2026-10-04): **docs: add security extension points guidance**
  *Symptoms*: ## Why are these changes needed?  AutoGen is in maintenance mode, but issue #7669 asks where Agent Threat Rules-style content scanning should fit for existing AutoGen users.  This PR adds a docs-only security extension points page that explains the maintainer-shaped path: keep fast-changing threat rule packs outside AutoGen, and compose external scanners at existing message, tool, or workbench boundaries. It specifically calls out that tool and workbench boundaries are better fits than chat-message-only scanning for prompt injection and exfiltration entering through web pages, files, MCP servers, or other tool outputs.  ## Related issue number  Related to #7669  ## Verification  - Characterization check before docs change failed as expected: no `security-extension-points.md` page and no extensions-guide toctree entry. - `python3` characterization check after docs change: `PASS: docs coverage for #7669 exists` - `uv run python check_md_code_blocks.py docs/src/user-guide/extensions-user-guide/security-extension-points.md` passed. - `git diff --check FETCH_HEAD...HEAD` passed. - `uv run sphinx-build -b html -W --keep-going docs/src docs/build` reached and rendered `user-guide/extensions-user-guide/security-extension-points`; it still exits non-zero on pre-existing optional dependency autodoc warnings for `cv2`, `chromadb`, `mem0`, `redisvl`, `llama_cpp`, `ollama`, `semantic_kernel`, `graphrag`, and `json_schema_to_pydantic`.  ## Second-agent review  Preferred reviewer `claude -p

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

### Incident Patch 1: `8544314f` (2026-03-26)
**Commit Message**: fix: restrict importlib provider loading to trusted namespaces (#7463)

**File**: `README.md` (modified, +6/-0)
```diff
@@ -152,6 +152,12 @@ For more advanced multi-agent orchestrations and workflows, read
 
 Use AutoGen Studio to prototype and run multi-agent workflows without writing code.
 
+> **Caution**: AutoGen Studio is meant to help you rapidly prototype multi-agent workflows and
+> demonstrate an example of end user interfaces built with AutoGen. It is **not meant to be a
+> production-ready app**. Developers are encouraged to use the AutoGen framework to build their own
+> applications, implementing authentication, security and other features required for deployed
+> applications. See the [security note](https://microsoft.github.io/autogen/dev/user-guide/autogenstudio-user-guide/index.html#a-note-on-security) for more details.
+
 ```bash
 # Run AutoGen Studio on http://localhost:8080
 autogenstudio ui --port 8080 --appdir ./my-app
```

**File**: `python/docs/src/user-guide/autogenstudio-user-guide/installation.md` (modified, +4/-0)
```diff
@@ -7,6 +7,10 @@ myst:
 
 # Installation
 
+```{caution}
+AutoGen Studio is meant to help you rapidly prototype multi-agent workflows and demonstrate an example of end user interfaces built with AutoGen. It is not meant to be a production-ready app. Developers are encouraged to use the AutoGen framework to build their own applications, implementing authentication, security and other features required for deployed applications.
+```
+
 There are two ways to install AutoGen Studio - from PyPi or from source. We **recommend installing from PyPi** unless you plan to modify the source code.
 
 ## Create a Virtual Environment (Recommended)
```

**File**: `python/packages/autogen-core/src/autogen_core/_component_config.py` (modified, +45/-0)
```diff
@@ -52,6 +52,34 @@ def _type_to_provider_str(t: type) -> str:
     "OllamaChatCompletionClient": "autogen_ext.models.ollama.OllamaChatCompletionClient",
 }
 
+_TRUSTED_PROVIDER_NAMESPACES: tuple[str, ...] = (
+    "autogen_core.",
+    "autogen_agentchat.",
+    "autogen_ext.",
+    "autogen_studio.",
+    "autogenstudio.",
+    "autogen_test_utils.",
+)
+
+
+def _get_trusted_namespaces() -> tuple[str, ...]:
+    """Return the set of trusted provider namespaces.
+
+    The default set covers all first-party AutoGen packages. Additional namespaces
+    can be added at runtime by setting the ``AUTOGEN_ALLOWED_PROVIDER_NAMESPACES``
+    environment variable to a comma-separated list of package prefixes
+    (e.g. ``mycompany_agents,mypackage``).
+    """
+    import os
+
+    extra = os.environ.get("AUTOGEN_ALLOWED_PROVIDER_NAMESPACES", "")
+    if extra:
+        extras = tuple(
+            ns.strip() if ns.strip().endswith(".") else ns.strip() + "." for ns in extra.split(",") if ns.strip()
+        )
+        return _TRUSTED_PROVIDER_NAMESPACES + extras
+    return _TRUSTED_PROVIDER_NAMESPACES
+
 
 class ComponentFromConfig(Generic[FromConfigT]):
     @classmethod
@@ -224,6 +252,23 @@ def load_component(
             raise ValueError("Invalid")
 
         module_path, class_name = output
+
+        trusted = _get_trusted_namespaces()
+        # Also allow test modules (pytest convention) to load components
+        module_name = module_path.rsplit(".", maxsplit=1)[-1]
+        is_test_module = module_name.startswith("test_") or module_path.startswith("test_")
+        if not is_test_module and not any(
+            module_path.startswith(ns) or module_path == ns.rstrip(".") for ns in trusted
+        ):
+            raise ValueError(
+                f"Provider module '{module_path}' is not in a trusted namespace. "
+                f"Allowed namespaces by default: autogen_core, autogen_agentchat, autogen_ext, "
+                f"autogen_studio, autogenstudio. "
+                f"To allow additional namespaces, set the AUTOGEN_ALLOWED_PROVIDER_NAMESPACES "
+                f"environment variable to a comma-separated list "
+                f"(e.g. AUTOGEN_ALLOWED_PROVIDER_NAMESPACES=mycompany_agents,mypackage)."
+            )
+
         module = importlib.import_module(module_path)
         component_class = module.__getattribute__(class_name)
 
```

**File**: `python/packages/autogen-core/tests/test_component_config.py` (modified, +16/-0)
```diff
@@ -367,3 +367,19 @@ def test_component_descriptions() -> None:
     assert ComponentWithDocstring("test").dump_component().description == "A component using just docstring."
     assert ComponentWithDescription("test").dump_component().description == "Explicit description"
     assert ComponentWithDescription("test").dump_component().label == "Custom Component"
+
+
+def test_untrusted_provider_rejected() -> None:
+    """load_component must reject providers outside trusted namespaces."""
+    bad_model = ComponentModel(provider="os.path.join", config={})
+    with pytest.raises(ValueError, match="not in a trusted namespace"):
+        ComponentLoader.load_component(bad_model, object)  # type: ignore
+
+
+def test_trusted_provider_via_env_var(monkeypatch: pytest.MonkeyPatch) -> None:
+    """AUTOGEN_ALLOWED_PROVIDER_NAMESPACES extends the allowed namespace list."""
+    monkeypatch.setenv("AUTOGEN_ALLOWED_PROVIDER_NAMESPACES", "mycompany_agents")
+    from autogen_core._component_config import _get_trusted_namespaces  # type: ignore
+
+    namespaces = _get_trusted_namespaces()
+    assert "mycompany_agents." in namespaces
```

**File**: `python/packages/autogen-ext/src/autogen_ext/agents/video_surfer/tools.py` (modified, +19/-2)
```diff
@@ -16,10 +16,27 @@ def extract_audio(video_path: str, audio_output_path: str) -> str:
     """
     Extracts audio from a video file and saves it as an MP3 file.
 
-    :param video_path: Path to the video file.
-    :param audio_output_path: Path to save the extracted audio file.
+    :param video_path: Path to the video file (must be a local file path, not a URL).
+    :param audio_output_path: Path to save the extracted audio file (must end with .mp3).
     :return: Confirmation message with the path to the saved audio file.
     """
+    import os
+    import re
+
+    # Reject URLs to prevent SSRF via ffmpeg
+    if re.match(r"^[a-zA-Z][a-zA-Z0-9+\-.]*://", video_path):
+        raise ValueError("video_path must be a local file path, not a URL.")
+
+    # Enforce .mp3 extension to prevent writing arbitrary file types
+    if not audio_output_path.lower().endswith(".mp3"):
+        raise ValueError("audio_output_path must end with .mp3.")
+
+    # Prevent path traversal — output must stay within the current working directory
+    cwd = os.path.realpath(os.getcwd())
+    output_real = os.path.realpath(audio_output_path)
+    if not output_real.startswith(cwd + os.sep) and output_real != cwd:
+        raise ValueError("audio_output_path must be within the current working directory.")
+
     (ffmpeg.input(video_path).output(audio_output_path, format="mp3").run(quiet=True, overwrite_output=True))  # type: ignore
     return f"Audio extracted and saved to {audio_output_path}."
 
```

**File**: `python/packages/autogen-studio/README.md` (modified, +12/-1)
```diff
@@ -9,8 +9,19 @@ AutoGen Studio is an AutoGen-powered AI app (user interface) to help you rapidly
 
 Code for AutoGen Studio is on GitHub at [microsoft/autogen](https://github.com/microsoft/autogen/tree/main/python/packages/autogen-studio)
 
+> [!CAUTION]
+> AutoGen Studio is meant to help you rapidly prototype multi-agent workflows and demonstrate an example of end user interfaces built with AutoGen. It is **not meant to be a production-ready app**. Developers are encouraged to use the [AutoGen framework](https://microsoft.github.io/autogen) to build their own applications, implementing authentication, security and other features required for deployed applications.
+
 > [!WARNING]
-> AutoGen Studio is under active development and is currently not meant to be a production-ready app. Expect breaking changes in upcoming releases. [Documentation](https://microsoft.github.io/autogen/docs/autogen-studio/getting-started) and the `README.md` might be outdated.
+> AutoGen Studio is under active development. Expect breaking changes in upcoming releases.
+
+## A Note on Security
+
+AutoGen Studio is a research prototype and is **not meant to be used** in a production environment. Some baseline practices are encouraged e.g., using Docker code execution environment for your agents.
+
+However, other considerations such as rigorous tests related to jailbreaking, ensuring LLMs only have access to the right keys of data given the end user's permissions, and other security features are not implemented in AutoGen Studio.
+
+If you are building a production application, please use the [AutoGen framework](https://microsoft.github.io/autogen) and implement the necessary security features.
 
 ## Updates
 
```

---

### Incident Patch 2: `b0477309` (2026-03-11)
**Commit Message**: fix: Improve AutoGen Studio: deprecate FunctionTool, harden MCP WebSocket endpoint (#7362)

**File**: `.github/workflows/docs.yml` (modified, +2/-2)
```diff
@@ -237,7 +237,7 @@ jobs:
       - run: |
           uv venv --python=3.11
           source .venv/bin/activate
-          uv sync --locked --all-extras
+          uv sync --locked
           poe --directory ${{ matrix.version.poe-dir }} docs-build
           mkdir -p docs-staging/${{ matrix.version.dest-dir }}/
           mv ${{ matrix.version.poe-dir }}/docs/build/* docs-staging/${{ matrix.version.dest-dir }}/
@@ -363,7 +363,7 @@ jobs:
         uses: actions/setup-dotnet@v4
         with:
           global-json-file: dotnet/global.json
-      - run: dotnet tool update -g docfx
+      - run: dotnet tool update -g docfx --version 2.67.5
       - run: |
           docfx docs/dotnet/docfx.json
           mkdir -p build/dotnet/
```

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -203,3 +203,6 @@ registry.json
 # files created by the gitty agent in python/samples/gitty
 .gitty/
 .aider*
+
+# Claude Code
+.claude/
```

**File**: `docs/dotnet/docfx.json` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@
       "noRestore": false,
       "namespaceLayout": "flattened",
       "memberLayout": "samePage",
-      "allowCompilationErrors": false
+      "allowCompilationErrors": true
     }
   ],
   "build": {
```

**File**: `python/packages/autogen-ext/pyproject.toml` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ video-surfer = [
     "autogen-agentchat==0.7.5",
     "opencv-python>=4.5",
     "ffmpeg-python",
-    "openai-whisper",
+    "openai-whisper>=20250625",
 ]
 diskcache = [
     "diskcache>=5.6.3"
```

**File**: `python/packages/autogen-ext/src/autogen_ext/memory/redis/_redis_memory.py` (modified, +4/-0)
```diff
@@ -288,6 +288,10 @@ async def query(
         top_k = kwargs.pop("top_k", self.config.top_k)
         distance_threshold = kwargs.pop("distance_threshold", self.config.distance_threshold)
 
+        # return empty results for empty/whitespace queries
+        if isinstance(query, str) and not query.strip():
+            return MemoryQueryResult(results=[])
+
         # if sequential memory is requested skip prompt creation
         sequential = bool(kwargs.pop("sequential", self.config.sequential))
         if self.config.sequential and not sequential:
```

**File**: `python/packages/autogen-ext/tests/memory/test_redis_memory.py` (modified, +22/-1)
```diff
@@ -71,6 +71,26 @@ async def test_redis_memory_close_with_mock() -> None:
         mock_history.delete.assert_called_once()
 
 
+@pytest.mark.asyncio
+async def test_redis_memory_query_empty_string_with_mock() -> None:
+    with patch("autogen_ext.memory.redis._redis_memory.SemanticMessageHistory") as MockHistory:
+        mock_history = MagicMock()
+        MockHistory.return_value = mock_history
+
+        config = RedisMemoryConfig()
+        memory = RedisMemory(config=config)
+
+        # Empty string should return empty results without calling the vectorizer
+        result = await memory.query("")
+        assert result.results == []
+        mock_history.get_relevant.assert_not_called()
+
+        # Whitespace-only string should also return empty results
+        result = await memory.query("   ")
+        assert result.results == []
+        mock_history.get_relevant.assert_not_called()
+
+
 def redis_available() -> bool:
     try:
         client = Redis.from_url("redis://localhost:6379")  # type: ignore[reportUnkownMemberType]
@@ -465,8 +485,9 @@ async def test_markdown_memory_type(semantic_memory: RedisMemory) -> None:
     results = await semantic_memory.query("how can I make itemized lists, or italicize text with asterisks?")
     assert results.results[0].content == markdown_data
 
-    # test we can query with markdown interpreted as a text string also
+    # empty query should return empty results without error
     results = await semantic_memory.query("")
+    assert results.results == []
 
     # we can also if the markdown is within a MemoryContent container
     results = await semantic_memory.query(
```

**File**: `python/packages/autogen-studio/autogenstudio/validation/validation_service.py` (modified, +8/-0)
```diff
@@ -115,6 +115,14 @@ def validate_instantiation(component: ComponentModel) -> Optional[ValidationErro
         """Validate that the component can be instantiated"""
         try:
             model = component.model_copy(deep=True)
+
+            # SECURITY: Skip instantiation for FunctionTool to prevent arbitrary code execution.
+            # FunctionTool._from_config() uses exec() on user-provided source_code, which is an RCE vector.
+            # Schema validation is sufficient for FunctionTool - we validate the config structure without
+            # actually executing the code. This blocks drive-by attacks via the /api/validate/ endpoint.
+            if "FunctionTool" in model.provider:
+                return None
+
             # Attempt to load the component
             module_path, class_name = model.provider.rsplit(".", maxsplit=1)
             module = importlib.import_module(module_path)
```

**File**: `python/packages/autogen-studio/autogenstudio/web/routes/mcp.py` (modified, +17/-30)
```diff
@@ -1,8 +1,6 @@
-import base64
-import json
 import uuid
 from datetime import datetime, timezone
-from typing import Any, Dict
+from typing import Any, Dict, Union
 
 from autogen_ext.tools.mcp._config import (
     McpServerParams,
@@ -32,6 +30,11 @@
 # Global session tracking for status endpoint
 active_sessions: Dict[str, Dict[str, Any]] = {}
 
+# Server-side storage for pending MCP session parameters.
+# Params are registered via POST /ws/connect and consumed (popped) when the WebSocket connects.
+# This prevents attackers from injecting arbitrary server_params via the WebSocket query string.
+pending_session_params: Dict[str, Union[StdioServerParams, SseServerParams, StreamableHttpServerParams]] = {}
+
 
 class CreateWebSocketConnectionRequest(BaseModel):
     server_params: McpServerParams
@@ -129,35 +132,19 @@ async def create_mcp_session(bridge: MCPWebSocketBridge, server_params: McpServe
 
 @router.websocket("/ws/{session_id}")
 async def mcp_websocket(websocket: WebSocket, session_id: str):
-    """Main WebSocket endpoint - now a thin layer"""
+    """Main WebSocket endpoint - looks up server params from server-side storage"""
+    # Look up pre-registered server params (one-time use)
+    server_params = pending_session_params.pop(session_id, None)
+    if server_params is None:
+        await websocket.close(code=4004, reason="Unknown or expired session")
+        return
+
     await websocket.accept()
     logger.info(f"MCP WebSocket connection established for session {session_id}")
 
     bridge = None
 
     try:
-        # Parse server parameters
-        query_params = dict(websocket.query_params)
-        server_params_encoded = query_params.get("server_params")
-
-        if not server_params_encoded:
-            await websocket.close(code=4000, reason="Missing server_params")
-            return
-
-        decoded_params = base64.b64decode(server_params_encoded).decode("utf-8")
-        server_params_dict = json.loads(decoded_params)
-
-        # Create appropriate server params object
-        if server_params_dict.get("type") == "StdioServerParams":
-            server_params = StdioServerParams(**server_params_dict)
-        elif server_params_dict.get("type") == "SseServerParams":
-            server_params = SseServerParams(**server_params_dict)
-        elif server_params_dict.get("type") == "StreamableHttpServerParams":
-            server_params = StreamableHttpServerParams(**server_params_dict)
-        else:
-            await websocket.close(code=4000, reason="Invalid server parameters")
-            return
-
         # Create bridge and run MCP session
         bridge = MCPWebSocketBridge(websocket, session_id)
         await create_mcp_session(bridge, server_params, session_id)
@@ -197,18 +184,18 @@ async def mcp_websocket(websocket: WebSocket, session_id: str):
 
 @router.post("/ws/connect")
 async def create_mcp_websocket_connection(request: CreateWebSocketConnectionRequest):
-    """Create WebSocket connection URL"""
+    """Register server params and return a WebSocket URL with session_id only"""
     try:
         session_id = str(uuid.uuid4())
 
-        server_params_json = json.dumps(serialize_for_json(request.server_params.model_dump()))
-        server_params_encoded = base64.b64encode(server_params_json.encode("utf-8")).decode("utf-8")
+        # Store params server-side — WebSocket handler will pop them on connect
+        pending_session_params[session_id] = request.server_params
 
         return {
             "status": True,
             "message": "WebSocket connection URL created",
             "session_id": session_id,
-            "websocket_url": f"/api/mcp/ws/{session_id}?server_params={server_params_encoded}",
+            "websocket_url": f"/api/mcp/ws/{session_id}",
             "timestamp": datetime.now(timezone.utc).isoformat(),
         }
 
```

---

### Incident Patch 3: `13e144e5` (2025-10-04)
**Commit Message**: fix: order by clause (#7051)

Co-authored-by: Victor Dibia <[REDACTED_EMAIL]>

**File**: `python/packages/autogen-studio/autogenstudio/web/routes/runs.py` (modified, +1/-1)
```diff
@@ -60,6 +60,6 @@ async def get_run(run_id: int, db=Depends(get_db)) -> Dict:
 @router.get("/{run_id}/messages")
 async def get_run_messages(run_id: int, db=Depends(get_db)) -> Dict:
     """Get all messages for a run"""
-    messages = db.get(Message, filters={"run_id": run_id}, order="created_at asc", return_json=False)
+    messages = db.get(Message, filters={"run_id": run_id}, order="asc", return_json=False)
 
     return {"status": True, "data": messages.data}
```

---

### Incident Patch 4: `6dc0a234` (2025-10-04)
**Commit Message**: update instructions for Quickstart (#7068)

**File**: `README.md` (modified, +2/-0)
```diff
@@ -37,6 +37,8 @@ pip install -U "autogenstudio"
 
 ## Quickstart
 
+The following samples call OpenAI API, so you first need to create an account and export your key as `export OPENAI_API_KEY="sk-..."`.
+
 ### Hello World
 
 Create an assistant agent using OpenAI's GPT-4o model. See [other supported models](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/models.html).
```

---

### Incident Patch 5: `29931b37` (2025-09-30)
**Commit Message**: Fix(mcp): drain pending command futures on McpSessionActor failure (#7045)

**File**: `python/packages/autogen-ext/src/autogen_ext/tools/mcp/_actor.py` (modified, +13/-0)
```diff
@@ -262,6 +262,19 @@ async def _run_actor(self) -> None:
                         except Exception as e:
                             cmd["future"].set_exception(e)
         except Exception as e:
+            try:
+                while True:
+                    try:
+                        pending_cmd = self._command_queue.get_nowait()
+                    except asyncio.QueueEmpty:
+                        break
+                    fut = pending_cmd.get("future")
+                    if fut is not None and not fut.done():
+                        fut.set_exception(e)
+            except Exception:
+                # Best-effort draining only
+                pass
+
             if self._shutdown_future and not self._shutdown_future.done():
                 self._shutdown_future.set_exception(e)
             else:
```

**File**: `python/packages/autogen-ext/tests/tools/test_mcp_actor.py` (modified, +85/-1)
```diff
@@ -16,7 +16,7 @@
     RequestUsage,
     UserMessage,
 )
-from autogen_ext.tools.mcp import StdioServerParams
+from autogen_ext.tools.mcp import StdioServerParams, StreamableHttpServerParams
 from autogen_ext.tools.mcp._actor import (
     McpSessionActor,
     _parse_sampling_content,  # pyright: ignore[reportPrivateUsage]
@@ -553,6 +553,90 @@ async def test_run_actor_session_exception() -> None:
         assert actor._actor_task is None  # type: ignore[reportPrivateUsage]
 
 
+@pytest.mark.asyncio
+async def test_run_actor_drains_queue_on_session_exception() -> None:
+    """Ensure pending command futures are failed when session creation raises.
+
+    Uses StreamableHttpServerParams with an invalid URL to trigger failure,
+    covering the queue-draining logic added in the referenced commit.
+    """
+    # Use an invalid local URL/port to force immediate connection failure
+    server_params = StreamableHttpServerParams(
+        url="http://127.0.0.1:1/invalid",  # very likely closed port
+        timeout=0.1,
+        sse_read_timeout=0.1,
+    )
+    actor = McpSessionActor(server_params)
+
+    # Prepare pending commands before the actor starts, so the outer except drains them
+    fut1: asyncio.Future[Any] = asyncio.Future()
+    fut2: asyncio.Future[Any] = asyncio.Future()
+    await actor._command_queue.put({"type": "list_tools", "future": fut1})  # type: ignore[reportPrivateUsage]
+    await actor._command_queue.put({"type": "call_tool", "name": "t", "args": {}, "future": fut2})  # type: ignore[reportPrivateUsage]
+
+    actor._active = True  # type: ignore[reportPrivateUsage]
+    task = asyncio.create_task(actor._run_actor())  # type: ignore[reportPrivateUsage]
+
+    # Wait for task to complete; it should handle the exception and drain the queue
+    try:
+        await asyncio.wait_for(task, timeout=2.0)
+    except asyncio.TimeoutError:
+        # If something goes wrong, ensure task cleanup for test stability
+        task.cancel()
+        with pytest.raises(asyncio.CancelledError):
+            await task
+
+    # Verify futures were failed by the draining logic
+    assert fut1.done()
+    assert fut1.exception() is not None
+
+    assert fut2.done()
+    assert fut2.exception() is not None
+
+
+@pytest.mark.asyncio
+async def test_run_actor_draining_swallows_internal_errors() -> None:
+    """draining errors during exception handling are swallowed.
+
+    We force `create_mcp_server_session` to raise so `_run_actor` enters the outer
+    exception handler, then make `get_nowait()` itself raise a non-QueueEmpty
+    exception. The inner `except Exception: pass` (best-effort draining) should
+    swallow it and continue to set the shutdown future exception instead of
+    crashing the task.
+    """
+    actor = McpSessionActor(StdioServerParams(command="echo", args=["test"]))
+
+    # Replace the command queue with a mock that raises from get_nowait()
+    mock_q = MagicMock()
+    mock_q.get_nowait.side_effect = RuntimeError("drain failure")
+    actor._command_queue = mock_q  # type: ignore[reportPrivateUsage]
+
+    # Prepare a shutdown future to observe behavior after draining attempt
+    actor._shutdown_future = asyncio.Future()  # type: ignore[reportPrivateUsage]
+
+    with patch(
+        "autogen_ext.tools.mcp._actor.create_mcp_server_session",
+        side_effect=Exception("Session error"),
+    ):
+        actor._active = True  # type: ignore[reportPrivateUsage]
+        task = asyncio.create_task(actor._run_actor())  # type: ignore[reportPrivateUsage]
+
+        # The task should finish and set the shutdown future with the session error
+        try:
+            await asyncio.wait_for(task, timeout=1.0)
+        except asyncio.TimeoutError:
+            task.cancel()
+            with pytest.raises(asyncio.CancelledError):
+                await task
+
+    # Draining raised internally, but should have been swallowed (lines 274-276)
+    mock_q.get_nowait.assert_called()  # type: ignore[reportPrivateUsage]
+    assert actor._shutdown_future.done()  # type: ignore[reportPrivateUsage]
+    exc = actor._shutdown_future.exception()  # type: ignore[reportPrivateUsage]
+    assert isinstance(exc, Exception)
+    assert "Session error" in str(exc)
+
+
 @pytest.mark.asyncio
 async def test_run_actor_shutdown_future_exception() -> None:
     """Test _run_actor sets exception on shutdown future when session fails."""
```

---

### Incident Patch 6: `f76f92dd` (2025-09-18)
**Commit Message**: Fix not supported field warnings in count_tokens_openai (#6987)

**File**: `python/packages/autogen-core/tests/test_model_context.py` (modified, +5/-2)
```diff
@@ -137,7 +137,10 @@ async def test_token_limited_model_context_with_token_limit(
         await model_context.add_message(msg)
 
     retrieved = await model_context.get_messages()
-    assert len(retrieved) == 1  # Token limit set very low, will remove 2 of the messages
+    # Token limit set low, will remove some messages
+    # OpenAI: keeps 2 messages (29 tokens with limit 30)
+    # Ollama: keeps 1 message (20 tokens with limit 20)
+    assert len(retrieved) < len(messages)  # Some messages removed due to token limit
     assert retrieved != messages  # Will not be equal to the original messages
 
     await model_context.clear()
@@ -151,7 +154,7 @@ async def test_token_limited_model_context_with_token_limit(
     await model_context.clear()
     await model_context.load_state(state)
     retrieved = await model_context.get_messages()
-    assert len(retrieved) == 1
+    assert len(retrieved) < len(messages)  # Some messages removed due to token limit
     assert retrieved != messages
 
 
```

**File**: `python/packages/autogen-ext/src/autogen_ext/models/openai/_openai_client.py` (modified, +14/-1)
```diff
@@ -393,6 +393,17 @@ def count_tokens_openai(
                         elif field == "description":
                             tool_tokens += 2
                             tool_tokens += len(encoding.encode(v["description"]))  # pyright: ignore
+                        elif field == "anyOf":
+                            tool_tokens -= 3
+                            for o in v["anyOf"]:  # type: ignore
+                                tool_tokens += 3
+                                tool_tokens += len(encoding.encode(str(o["type"])))  # pyright: ignore
+                        elif field == "default":
+                            tool_tokens += 2
+                            tool_tokens += len(encoding.encode(json.dumps(v["default"])))
+                        elif field == "title":
+                            tool_tokens += 2
+                            tool_tokens += len(encoding.encode(str(v["title"])))  # pyright: ignore
                         elif field == "enum":
                             tool_tokens -= 3
                             for o in v["enum"]:  # pyright: ignore
@@ -404,7 +415,9 @@ def count_tokens_openai(
                 if len(parameters["properties"]) == 0:  # pyright: ignore
                     tool_tokens -= 2
         num_tokens += tool_tokens
-    num_tokens += 12
+
+    if oai_tools:
+        num_tokens += 12
     return num_tokens
 
 
```

**File**: `python/packages/autogen-ext/tests/models/test_openai_model_client.py` (modified, +18/-2)
```diff
@@ -2,7 +2,7 @@
 import json
 import logging
 import os
-from typing import Annotated, Any, AsyncGenerator, Dict, List, Literal, Tuple, TypeVar
+from typing import Annotated, Any, AsyncGenerator, Dict, List, Literal, Optional, Tuple, TypeVar
 from unittest.mock import AsyncMock, MagicMock
 
 import httpx
@@ -450,11 +450,27 @@ def tool1(test: str, test2: str) -> str:
     def tool2(test1: int, test2: List[int]) -> str:
         return str(test1) + str(test2)
 
-    tools = [FunctionTool(tool1, description="example tool 1"), FunctionTool(tool2, description="example tool 2")]
+    def tool3(test1: Annotated[Optional[str], "example"] = None, test2: Literal["1", "2"] = "2") -> str:
+        return str(test1) + str(test2)
+
+    tools = [
+        FunctionTool(tool1, description="example tool 1"),
+        FunctionTool(tool2, description="example tool 2"),
+        FunctionTool(tool3, description="example tool 3"),
+    ]
 
     mockcalculate_vision_tokens = MagicMock()
     monkeypatch.setattr("autogen_ext.models.openai._openai_client.calculate_vision_tokens", mockcalculate_vision_tokens)
 
+    # Test count_tokens without tools
+    num_tokens = client.count_tokens(messages)
+    assert num_tokens
+
+    # Check that calculate_vision_tokens was called
+    mockcalculate_vision_tokens.assert_called_once()
+    mockcalculate_vision_tokens.reset_mock()
+
+    # Test count_tokens with tools
     num_tokens = client.count_tokens(messages, tools=tools)
     assert num_tokens
 
```

---

### Incident Patch 7: `fb03c1c6` (2025-09-18)
**Commit Message**: Fix: Handle nested objects in array items for JSON schema conversion (#6993)

Co-authored-by: Eric Zhu <[REDACTED_EMAIL]>

**File**: `python/packages/autogen-core/src/autogen_core/utils/_json_to_pydantic.py` (modified, +16/-0)
```diff
@@ -128,6 +128,17 @@ def get_ref(self, ref_name: str) -> Any:
 
         return self._model_cache[ref_name]
 
+    def _get_item_model_name(self, array_field_name: str, parent_model_name: str) -> str:
+        """Generate hash-based model names for array items to keep names short and unique."""
+        import hashlib
+
+        # Create a short hash of the full path to ensure uniqueness
+        full_path = f"{parent_model_name}_{array_field_name}"
+        hash_suffix = hashlib.md5(full_path.encode()).hexdigest()[:6]
+
+        # Use field name as-is with hash suffix
+        return f"{array_field_name}_{hash_suffix}"
+
     def _process_definitions(self, root_schema: Dict[str, Any]) -> None:
         if "$defs" in root_schema:
             for model_name in root_schema["$defs"]:
@@ -253,6 +264,11 @@ def _extract_field_type(self, key: str, value: Dict[str, Any], model_name: str,
             item_schema = value.get("items", {"type": "string"})
             if "$ref" in item_schema:
                 item_type = self.get_ref(item_schema["$ref"].split("/")[-1])
+            elif item_schema.get("type") == "object" and "properties" in item_schema:
+                # Handle array items that are objects with properties - create a nested model
+                # Use hash-based naming to keep names short and unique
+                item_model_name = self._get_item_model_name(key, model_name)
+                item_type = self._json_schema_to_model(item_schema, item_model_name, root_schema)
             else:
                 item_type_name = item_schema.get("type")
                 if item_type_name is None:
```

**File**: `python/packages/autogen-core/tests/test_json_to_pydantic.py` (modified, +208/-0)
```diff
@@ -834,3 +834,211 @@ def test_unknown_format_raises() -> None:
     converter = _JSONSchemaToPydantic()
     with pytest.raises(FormatNotSupportedError):
         converter.json_schema_to_pydantic(schema, "UnknownFormatModel")
+
+
+def test_array_items_with_object_schema_properties() -> None:
+    """Test that array items with object schemas create proper Pydantic models."""
+    schema = {
+        "type": "object",
+        "properties": {
+            "users": {
+                "type": "array",
+                "items": {
+                    "type": "object",
+                    "properties": {"name": {"type": "string"}, "email": {"type": "string"}, "age": {"type": "integer"}},
+                    "required": ["name", "email"],
+                },
+            }
+        },
+    }
+
+    converter = _JSONSchemaToPydantic()
+    Model = converter.json_schema_to_pydantic(schema, "UserListModel")
+
+    # Verify the users field has correct type annotation
+    users_field = Model.model_fields["users"]
+    from typing import Union, get_args, get_origin
+
+    # Extract inner type from Optional[List[...]]
+    actual_list_type = users_field.annotation
+    if get_origin(users_field.annotation) is Union:
+        union_args = get_args(users_field.annotation)
+        for arg in union_args:
+            if get_origin(arg) is list:
+                actual_list_type = arg
+                break
+
+    assert get_origin(actual_list_type) is list
+    inner_type = get_args(actual_list_type)[0]
+
+    # Verify array items are BaseModel subclasses, not dict
+    assert inner_type is not dict
+    assert hasattr(inner_type, "model_fields")
+
+    # Verify expected fields are present
+    expected_fields = {"name", "email", "age"}
+    actual_fields = set(inner_type.model_fields.keys())
+    assert expected_fields.issubset(actual_fields)
+
+    # Test instantiation and field access
+    test_data = {
+        "users": [
+            {"name": "Alice", "email": "alice@example.com", "age": 30},
+            {"name": "Bob", "email": "bob@example.com"},
+        ]
+    }
+
+    instance = Model(**test_data)
+    assert len(instance.users) == 2  # type: ignore[attr-defined]
+
+    first_user = instance.users[0]  # type: ignore[attr-defined]
+    assert hasattr(first_user, "model_fields")  # type: ignore[reportUnknownArgumentType]
+    assert not isinstance(first_user, dict)
+
+    # Test attribute access (BaseModel behavior)
+    assert first_user.name == "Alice"  # type: ignore[attr-defined]
+    assert first_user.email == "alice@example.com"  # type: ignore[attr-defined]
+    assert first_user.age == 30  # type: ignore[attr-defined]
+
+
+def test_nested_arrays_with_object_schemas() -> None:
+    """Test deeply nested arrays with object schemas create proper Pydantic models."""
+    schema = {
+        "type": "object",
+        "properties": {
+            "companies": {
+                "type": "array",
+                "items": {
+                    "type": "object",
+                    "properties": {
+                        "name": {"type": "string"},
+                        "departments": {
+                            "type": "array",
+                            "items": {
+                                "type": "object",
+                                "properties": {
+                                    "name": {"type": "string"},
+                                    "employees": {
+                                        "type": "array",
+                                        "items": {
+                                            "type": "object",
+                                            "properties": {
+                                                "name": {"type": "string"},
+                                                "role": {"type": "string"},
+                                                "skills": {"type": "array", "items": {"type": "string"}},
+                                            },
+                                            "required": ["name", "role"],
+                                        },
+                                    },
+                                },
+                                "required": ["name"],
+                            },
+                        },
+                    },
+                    "required": ["name"],
+                },
+            }
+        },
+    }
+
+    converter = _JSONSchemaToPydantic()
+    Model = converter.json_schema_to_pydantic(schema, "CompanyListModel")
+
+    # Verify companies field type annotation
+    companies_field = Model.model_fields["companies"]
+    from typing import Union, get_args, get_origin
+
+    # Extract companies inner type
+    actual_list_type = companies_field.annotation
+    if get_origin(companies_field.annotation) is Union:
+        union_args = get_args(companies_field.annotation)
+        for arg in union_args:
+            if get_origin(arg) is list:
+                actual_l
```

---

### Incident Patch 8: `17d3aef9` (2025-09-18)
**Commit Message**: Add security warnings and default to DockerCommandLineCodeExecutor (#7035)

Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `python/packages/autogen-agentchat/src/autogen_agentchat/agents/_code_executor_agent.py` (modified, +12/-0)
```diff
@@ -454,6 +454,18 @@ def __init__(
         self._approval_func = approval_func
         self._approval_func_is_async = approval_func is not None and iscoroutinefunction(approval_func)
 
+        # Issue warning if no approval function is set
+        if approval_func is None:
+            import warnings
+
+            warnings.warn(
+                "No approval function set for CodeExecutorAgent. This means code will be executed automatically without human oversight. "
+                "For security, consider setting an approval_func to review and approve code before execution. "
+                "See the CodeExecutorAgent documentation for examples of approval functions.",
+                UserWarning,
+                stacklevel=2,
+            )
+
         if supported_languages is not None:
             self._supported_languages = supported_languages
         else:
```

**File**: `python/packages/autogen-ext/src/autogen_ext/code_executors/__init__.py` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+"""Code executor utilities for AutoGen-Ext."""
+
+import warnings
+from typing import Optional
+
+from autogen_core.code_executor import CodeExecutor
+
+# Docker imports for default code executor
+try:
+    import docker as docker_client
+    from docker.errors import DockerException
+
+    from .docker import DockerCommandLineCodeExecutor
+
+    _docker_available = True
+except ImportError:
+    docker_client = None  # type: ignore
+    DockerException = Exception  # type: ignore
+    DockerCommandLineCodeExecutor = None  # type: ignore
+    _docker_available = False
+
+from .local import LocalCommandLineCodeExecutor
+
+
+def _is_docker_available() -> bool:
+    """Check if Docker is available and running."""
+    if not _docker_available:
+        return False
+
+    try:
+        if docker_client is not None:
+            client = docker_client.from_env()
+            client.ping()  # type: ignore
+            return True
+    except DockerException:
+        return False
+
+    return False
+
+
+def create_default_code_executor(work_dir: Optional[str] = None) -> CodeExecutor:
+    """Create a default code executor, preferring Docker if available.
+
+    This function creates a code executor using the following priority:
+    1. DockerCommandLineCodeExecutor if Docker is available
+    2. LocalCommandLineCodeExecutor with a warning if Docker is not available
+
+    Args:
+        work_dir: Optional working directory for the code executor
+
+    Returns:
+        CodeExecutor: A code executor instance
+
+    .. warning::
+        For security, it is recommended to use DockerCommandLineCodeExecutor
+        when available to isolate code execution.
+    """
+    if _is_docker_available() and DockerCommandLineCodeExecutor is not None:
+        try:
+            if work_dir:
+                return DockerCommandLineCodeExecutor(work_dir=work_dir)
+            else:
+                return DockerCommandLineCodeExecutor()
+        except Exception:
+            # Fallback to local if Docker fails to initialize
+            pass
+
+    # Issue warning and use local executor if Docker is not available
+    warnings.warn(
+        "Docker is not available or not running. Using LocalCommandLineCodeExecutor instead of the recommended DockerCommandLineCodeExecutor. "
+        "For security, it is recommended to install Docker and ensure it's running before using code executors. "
+        "To install Docker, visit: https://docs.docker.com/get-docker/",
+        UserWarning,
+        stacklevel=2,
+    )
+
+    if work_dir:
+        return LocalCommandLineCodeExecutor(work_dir=work_dir)
+    else:
+        return LocalCommandLineCodeExecutor()
+
+
+__all__ = ["create_default_code_executor"]
```

**File**: `python/packages/autogen-ext/src/autogen_ext/code_executors/docker/_docker_code_executor.py` (modified, +1/-3)
```diff
@@ -23,11 +23,10 @@
     FunctionWithRequirements,
     FunctionWithRequirementsStr,
 )
+from docker.types import DeviceRequest
 from pydantic import BaseModel
 from typing_extensions import Self
 
-from docker.types import DeviceRequest
-
 from .._common import (
     CommandLineCodeResult,
     build_python_functions_file,
@@ -43,7 +42,6 @@
 
 try:
     import asyncio_atexit
-
     import docker
     from docker.errors import DockerException, ImageNotFound, NotFound
     from docker.models.containers import Container
```

**File**: `python/packages/autogen-ext/src/autogen_ext/code_executors/docker_jupyter/_docker_jupyter.py` (modified, +2/-1)
```diff
@@ -11,10 +11,11 @@
 
 from autogen_core import CancellationToken, Component
 from autogen_core.code_executor import CodeBlock, CodeExecutor, CodeResult
-from autogen_ext.code_executors._common import silence_pip
 from pydantic import BaseModel
 from typing_extensions import Self
 
+from autogen_ext.code_executors._common import silence_pip
+
 from ._jupyter_server import JupyterClient, JupyterConnectable, JupyterConnectionInfo, JupyterKernelClient
 
 
```

**File**: `python/packages/autogen-ext/src/autogen_ext/code_executors/local/__init__.py` (modified, +9/-0)
```diff
@@ -159,6 +159,15 @@ def __init__(
         cleanup_temp_files: bool = True,
         virtual_env_context: Optional[SimpleNamespace] = None,
     ):
+        # Issue warning about using LocalCommandLineCodeExecutor
+        warnings.warn(
+            "Using LocalCommandLineCodeExecutor may execute code on the local machine which can be unsafe. "
+            "For security, it is recommended to use DockerCommandLineCodeExecutor instead. "
+            "To install Docker, visit: https://docs.docker.com/get-docker/",
+            UserWarning,
+            stacklevel=2,
+        )
+
         if timeout < 1:
             raise ValueError("Timeout must be greater than or equal to 1.")
         self._timeout = timeout
```

**File**: `python/packages/autogen-ext/src/autogen_ext/teams/magentic_one.py` (modified, +2/-52)
```diff
@@ -11,64 +11,14 @@
 from autogen_ext.agents.file_surfer import FileSurfer
 from autogen_ext.agents.magentic_one import MagenticOneCoderAgent
 from autogen_ext.agents.web_surfer import MultimodalWebSurfer
-from autogen_ext.code_executors.local import LocalCommandLineCodeExecutor
+from autogen_ext.code_executors import create_default_code_executor
 from autogen_ext.models.openai._openai_client import BaseOpenAIChatCompletionClient
 
-# Docker imports for default code executor
-try:
-    import docker
-    from docker.errors import DockerException
-
-    from autogen_ext.code_executors.docker import DockerCommandLineCodeExecutor
-
-    _docker_available = True
-except ImportError:
-    docker = None  # type: ignore
-    DockerException = Exception  # type: ignore
-    DockerCommandLineCodeExecutor = None  # type: ignore
-    _docker_available = False
-
 SyncInputFunc = Callable[[str], str]
 AsyncInputFunc = Callable[[str, Optional[CancellationToken]], Awaitable[str]]
 InputFuncType = Union[SyncInputFunc, AsyncInputFunc]
 
 
-def _is_docker_available() -> bool:
-    """Check if Docker is available and running."""
-    if not _docker_available:
-        return False
-
-    try:
-        if docker is not None:
-            client = docker.from_env()
-            client.ping()  # type: ignore
-            return True
-    except DockerException:
-        return False
-
-    return False
-
-
-def _create_default_code_executor() -> CodeExecutor:
-    """Create the default code executor, preferring Docker if available."""
-    if _is_docker_available() and DockerCommandLineCodeExecutor is not None:
-        try:
-            return DockerCommandLineCodeExecutor()
-        except Exception:
-            # Fallback to local if Docker fails to initialize
-            pass
-
-    # Issue warning and use local executor if Docker is not available
-    warnings.warn(
-        "Docker is not available or not running. Using LocalCommandLineCodeExecutor instead of the recommended DockerCommandLineCodeExecutor. "
-        "For security, it is recommended to install Docker and ensure it's running before using MagenticOne. "
-        "To install Docker, visit: https://docs.docker.com/get-docker/",
-        UserWarning,
-        stacklevel=3,
-    )
-    return LocalCommandLineCodeExecutor()
-
-
 class MagenticOne(MagenticOneGroupChat):
     """
     MagenticOne is a specialized group chat class that integrates various agents
@@ -256,7 +206,7 @@ def __init__(
                 DeprecationWarning,
                 stacklevel=2,
             )
-            code_executor = _create_default_code_executor()
+            code_executor = create_default_code_executor()
 
         fs = FileSurfer("FileSurfer", model_client=client)
         ws = MultimodalWebSurfer("WebSurfer", model_client=client)
```

**File**: `python/packages/autogen-ext/tests/teams/test_magentic_one.py` (modified, +2/-2)
```diff
@@ -115,7 +115,7 @@ def test_docker_availability_check() -> None:
     assert isinstance(result, bool)
 
 
-@patch("autogen_ext.teams.magentic_one._is_docker_available")
+@patch("autogen_ext.code_executors._is_docker_available")
 def test_magentic_one_falls_back_to_local_when_docker_unavailable(
     mock_docker_check: Mock, mock_chat_client: Mock
 ) -> None:
@@ -154,7 +154,7 @@ def test_magentic_one_falls_back_to_local_when_docker_unavailable(
         assert deprecated_warning_found, f"Deprecation warning not found in: {warning_messages}"
 
 
-@patch("autogen_ext.teams.magentic_one._is_docker_available")
+@patch("autogen_ext.code_executors._is_docker_available")
 def test_magentic_one_falls_back_to_local_with_approval_function(
     mock_docker_check: Mock, mock_chat_client: Mock
 ) -> None:
```

---

### Incident Patch 9: `6f67b959` (2025-09-16)
**Commit Message**: Fix finish_reason logic in Azure AI client streaming response (#6963)

Co-authored-by: weizhang3 <[REDACTED_EMAIL]>
Co-authored-by: Eric Zhu <[REDACTED_EMAIL]>

**File**: `python/packages/autogen-ext/src/autogen_ext/models/azure/_azure_ai_client.py` (modified, +3/-3)
```diff
@@ -523,6 +523,9 @@ async def create_stream(
             if choice and choice.finish_reason is not None:
                 if isinstance(choice.finish_reason, CompletionsFinishReason):
                     finish_reason = cast(FinishReasons, choice.finish_reason.value)
+                    # Handle special case for TOOL_CALLS finish reason
+                    if choice.finish_reason is CompletionsFinishReason.TOOL_CALLS:
+                        finish_reason = "function_calls"
                 else:
                     if choice.finish_reason in ["stop", "length", "function_calls", "content_filter", "unknown"]:
                         finish_reason = choice.finish_reason  # type: ignore
@@ -554,9 +557,6 @@ async def create_stream(
         if finish_reason is None:
             raise ValueError("No stop reason found")
 
-        if choice and choice.finish_reason is CompletionsFinishReason.TOOL_CALLS:
-            finish_reason = "function_calls"
-
         content: Union[str, List[FunctionCall]]
 
         if len(content_deltas) > 1:
```

---

### Incident Patch 10: `c469fc0d` (2025-09-16)
**Commit Message**: Fix OllamaChatCompletionClient load_component() error by adding to WELL_KNOWN_PROVIDERS (#7030)

Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: ekzhu <[REDACTED_EMAIL]>
Co-authored-by: Eric Zhu <[REDACTED_EMAIL]>

**File**: `python/packages/autogen-core/src/autogen_core/_component_config.py` (modified, +1/-0)
```diff
@@ -49,6 +49,7 @@ def _type_to_provider_str(t: type) -> str:
     "AzureOpenAIChatCompletionClient": "autogen_ext.models.openai.AzureOpenAIChatCompletionClient",
     "openai_chat_completion_client": "autogen_ext.models.openai.OpenAIChatCompletionClient",
     "OpenAIChatCompletionClient": "autogen_ext.models.openai.OpenAIChatCompletionClient",
+    "OllamaChatCompletionClient": "autogen_ext.models.ollama.OllamaChatCompletionClient",
 }
 
 
```

**File**: `python/packages/autogen-ext/tests/models/test_ollama_chat_completion_client.py` (modified, +43/-0)
```diff
@@ -1313,3 +1313,46 @@ async def _mock_chat(*args: Any, **kwargs: Any) -> ChatResponse:
     assert len(create_result.content) > 0
     assert isinstance(create_result.content[0], FunctionCall)
     assert create_result.content[0].name == add_tool.name
+
+
+def test_ollama_load_component() -> None:
+    """Test that OllamaChatCompletionClient can be loaded via ChatCompletionClient.load_component()."""
+    from autogen_core.models import ChatCompletionClient
+
+    # Test the exact configuration from the issue
+    config = {
+        "provider": "OllamaChatCompletionClient",
+        "config": {
+            "model": "qwen3",
+            "host": "http://1.2.3.4:30130",
+        },
+    }
+
+    # This should not raise an error anymore
+    client = ChatCompletionClient.load_component(config)
+
+    # Verify we got the right type of client
+    assert isinstance(client, OllamaChatCompletionClient)
+    assert client._model_name == "qwen3"  # type: ignore[reportPrivateUsage]
+
+    # Test that the config was applied correctly
+    create_args = client.get_create_args()
+    assert create_args["model"] == "qwen3"  # type: ignore[reportPrivateUsage]
+
+
+def test_ollama_load_component_via_class() -> None:
+    """Test that OllamaChatCompletionClient can be loaded via the class directly."""
+    config = {
+        "provider": "OllamaChatCompletionClient",
+        "config": {
+            "model": "llama3.2",
+            "host": "http://localhost:11434",
+        },
+    }
+
+    # Load via the specific class
+    client = OllamaChatCompletionClient.load_component(config)
+
+    # Verify we got the right type and configuration
+    assert isinstance(client, OllamaChatCompletionClient)
+    assert client._model_name == "llama3.2"  # type: ignore[reportPrivateUsage]
```

---

### Incident Patch 11: `e0e39e47` (2025-09-16)
**Commit Message**: Fix Redis caching always returning False due to unhandled string values (#7022)

Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: ekzhu <[REDACTED_EMAIL]>
Co-authored-by: Eric Zhu <[REDACTED_EMAIL]>

**File**: `python/packages/autogen-ext/src/autogen_ext/models/cache/_chat_completion_cache.py` (modified, +25/-0)
```diff
@@ -223,6 +223,31 @@ def _check_cache(
                 except ValidationError:
                     # If reconstruction fails, treat as cache miss
                     return None, cache_key
+            elif isinstance(cached_result, str):
+                # Handle case where cache store returns a string (e.g., Redis with decode errors)
+                try:
+                    # Try to parse the string as JSON and reconstruct CreateResult
+                    parsed_data = json.loads(cached_result)
+                    if isinstance(parsed_data, dict):
+                        cached_result = CreateResult.model_validate(parsed_data)
+                    elif isinstance(parsed_data, list):
+                        # Handle streaming results stored as JSON string
+                        reconstructed_list_2: list[CreateResult | str] = []
+                        for item in parsed_data:  # type: ignore[reportUnknownVariableType]
+                            if isinstance(item, dict):
+                                reconstructed_list_2.append(CreateResult.model_validate(item))
+                            elif isinstance(item, str):
+                                reconstructed_list_2.append(item)
+                            else:
+                                # If item is neither dict nor str, treat as cache miss
+                                return None, cache_key
+                        cached_result = reconstructed_list_2
+                    else:
+                        # If parsed data is not dict or list, treat as cache miss
+                        return None, cache_key
+                except (json.JSONDecodeError, ValidationError):
+                    # If JSON parsing or validation fails, treat as cache miss
+                    return None, cache_key
             # If it's already the right type (CreateResult or list), return as-is
             return cached_result, cache_key
 
```

**File**: `python/packages/autogen-ext/tests/models/test_chat_completion_cache.py` (modified, +123/-0)
```diff
@@ -1,4 +1,5 @@
 import copy
+import json
 from typing import Any, Dict, List, Optional, Tuple, Union, cast
 
 import pytest
@@ -482,6 +483,128 @@ def test_check_cache_already_correct_type() -> None:
     assert cache_key is not None
 
 
+def test_check_cache_string_json_deserialization_success() -> None:
+    """Test _check_cache when Redis cache returns a string containing valid JSON.
+    This tests the fix for the Redis string caching issue where Redis returns
+    string data instead of dict/CreateResult, causing cache misses.
+    """
+    _, prompts, system_prompt, replay_client, _ = get_test_data()
+
+    # Create a JSON string representing a valid CreateResult
+    create_result_json = json.dumps(
+        {
+            "content": "response from string json",
+            "usage": {"prompt_tokens": 12, "completion_tokens": 6},
+            "cached": False,
+            "finish_reason": "stop",
+            "logprobs": None,
+            "thought": None,
+        }
+    )
+
+    # Mock cache store that returns the JSON string (simulating Redis behavior)
+    mock_store = MockCacheStore(return_value=cast(Any, create_result_json))
+    cached_client = ChatCompletionCache(replay_client, mock_store)
+
+    # Test _check_cache method directly
+    messages = [system_prompt, UserMessage(content=prompts[0], source="user")]
+    cached_result, cache_key = cached_client._check_cache(messages, [], None, {})  # type: ignore
+
+    # Should successfully reconstruct the CreateResult from JSON string
+    assert cached_result is not None
+    assert isinstance(cached_result, CreateResult)
+    assert cached_result.content == "response from string json"
+    assert cached_result.usage.prompt_tokens == 12
+    assert cached_result.usage.completion_tokens == 6
+    assert cache_key is not None
+
+
+def test_check_cache_string_json_list_deserialization_success() -> None:
+    """Test _check_cache when Redis cache returns a string containing valid JSON list.
+    This tests the fix for streaming results stored as JSON strings in Redis.
+    """
+    _, prompts, system_prompt, replay_client, _ = get_test_data()
+
+    # Create a JSON string representing a streaming result list
+    streaming_list_json = json.dumps(
+        [
+            "streaming chunk 1",
+            {
+                "content": "streaming response from json",
+                "usage": {"prompt_tokens": 8, "completion_tokens": 4},
+                "cached": False,
+                "finish_reason": "stop",
+                "logprobs": None,
+                "thought": None,
+            },
+            "streaming chunk 2",
+        ]
+    )
+
+    # Mock cache store that returns the JSON string (simulating Redis streaming)
+    mock_store = MockCacheStore(return_value=cast(Any, streaming_list_json))
+    cached_client = ChatCompletionCache(replay_client, mock_store)
+
+    # Test _check_cache method directly
+    messages = [system_prompt, UserMessage(content=prompts[0], source="user")]
+    cached_result, cache_key = cached_client._check_cache(messages, [], None, {})  # type: ignore
+
+    # Should successfully reconstruct the list from JSON string
+    assert cached_result is not None
+    assert isinstance(cached_result, list)
+    assert len(cached_result) == 3
+    assert cached_result[0] == "streaming chunk 1"
+    assert isinstance(cached_result[1], CreateResult)
+    assert cached_result[1].content == "streaming response from json"
+    assert cached_result[2] == "streaming chunk 2"
+    assert cache_key is not None
+
+
+def test_check_cache_string_invalid_json_failure() -> None:
+    """Test _check_cache gracefully handles invalid JSON strings.
+    This ensures the system degrades gracefully when Redis returns corrupted
+    string data that cannot be parsed as JSON.
+    """
+    _, prompts, system_prompt, replay_client, _ = get_test_data()
+
+    # Create an invalid JSON string
+    invalid_json_string = '{"content": "test", invalid json}'
+
+    # Mock cache store that returns the invalid JSON string
+    mock_store = MockCacheStore(return_value=cast(Any, invalid_json_string))
+    cached_client = ChatCompletionCache(replay_client, mock_store)
+
+    # Test _check_cache method directly
+    messages = [system_prompt, UserMessage(content=prompts[0], source="user")]
+    cached_result, cache_key = cached_client._check_cache(messages, [], None, {})  # type: ignore
+
+    # Should return None (cache miss) when JSON parsing fails
+    assert cached_result is None
+    assert cache_key is not None
+
+
+def test_check_cache_string_invalid_data_failure() -> None:
+    """Test _check_cache gracefully handles JSON strings with invalid data structure.
+    This ensures the system handles JSON that parses but doesn't represent valid CreateResult data.
+    """
+    _, prompts, system_prompt, replay_client, _ = get_test_data()
+
+    # Create a JSON string that parses but has invalid structure
+    invalid_data_json = json.dumps({"invalid_structu
```

---

### Incident Patch 12: `14809f51` (2025-09-16)
**Commit Message**: Fix GraphFlow cycle detection to properly clean up recursion state (#7026)

Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: ekzhu <[REDACTED_EMAIL]>
Co-authored-by: Eric Zhu <[REDACTED_EMAIL]>

**File**: `python/packages/autogen-agentchat/src/autogen_agentchat/teams/_group_chat/_graph/_digraph_group_chat.py` (modified, +4/-3)
```diff
@@ -165,12 +165,13 @@ def dfs(node_name: str) -> bool:
             visited.add(node_name)
             rec_stack.add(node_name)
             path.append(node_name)
+            cycle = False
 
             for edge in self.nodes[node_name].edges:
                 target = edge.target
                 if target not in visited:
                     if dfs(target):
-                        return True
+                        cycle = True
                 elif target in rec_stack:
                     # Found a cycle → extract the cycle
                     cycle_start_index = path.index(target)
@@ -182,11 +183,11 @@ def dfs(node_name: str) -> bool:
                         raise ValueError(
                             f"Cycle detected without exit condition: {' -> '.join(cycle_nodes + cycle_nodes[:1])}"
                         )
-                    return True  # Found cycle, but it has an exit condition
+                    cycle = True  # Found cycle, but it has an exit condition
 
             rec_stack.remove(node_name)
             path.pop()
-            return False
+            return cycle
 
         has_cycle = False
         for node in self.nodes:
```

**File**: `python/packages/autogen-agentchat/tests/test_group_chat_graph.py` (modified, +45/-0)
```diff
@@ -247,6 +247,51 @@ def test_cycle_detection_without_exit_condition() -> None:
         graph.has_cycles_with_exit()
 
 
+def test_cycle_detection_cleanup_bug() -> None:
+    """Test that cycle detection properly cleans up recursion state.
+
+    This test reproduces the bug where the DFS algorithm in has_cycles_with_exit
+    didn't properly clean up rec_stack and path when returning early upon finding
+    a cycle with valid exit conditions. The bug could cause incorrect behavior
+    when processing subsequent unvisited nodes in graphs with multiple components.
+    """
+
+    # Create a graph that exposes the cleanup bug:
+    # A -> B -> C -> A (cycle with condition)
+    # A -> D (separate branch that could be affected by stale rec_stack/path)
+    # E (disconnected component that could be affected by cleanup issues)
+    graph = DiGraph(
+        nodes={
+            "A": DiGraphNode(name="A", edges=[DiGraphEdge(target="B"), DiGraphEdge(target="D")]),
+            "B": DiGraphNode(name="B", edges=[DiGraphEdge(target="C")]),
+            "C": DiGraphNode(name="C", edges=[DiGraphEdge(target="A", condition="loop")]),
+            "D": DiGraphNode(name="D", edges=[]),
+            "E": DiGraphNode(name="E", edges=[]),  # Disconnected component
+        }
+    )
+
+    # This should work correctly with the fix - proper cleanup ensures
+    # that processing node E is not affected by stale recursion state
+    # from processing the A->B->C->A cycle
+    result = graph.has_cycles_with_exit()
+    assert result is True  # Has valid cycles
+
+    # Test with multiple cycles to ensure thorough cleanup
+    multi_cycle_graph = DiGraph(
+        nodes={
+            "A": DiGraphNode(name="A", edges=[DiGraphEdge(target="B")]),
+            "B": DiGraphNode(name="B", edges=[DiGraphEdge(target="A", condition="cycle1")]),
+            "C": DiGraphNode(name="C", edges=[DiGraphEdge(target="D")]),
+            "D": DiGraphNode(name="D", edges=[DiGraphEdge(target="C", condition="cycle2")]),
+            "E": DiGraphNode(name="E", edges=[DiGraphEdge(target="F")]),
+            "F": DiGraphNode(name="F", edges=[]),
+        }
+    )
+
+    result = multi_cycle_graph.has_cycles_with_exit()
+    assert result is True  # Has valid cycles
+
+
 def test_different_activation_groups_detection() -> None:
     """Test different activation groups."""
     graph = DiGraph(
```

---

### Incident Patch 13: `79d5d6ab` (2025-09-16)
**Commit Message**: Fix spurious </think> tags caused by empty string reasoning_content in streaming (#7025)

Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: ekzhu <[REDACTED_EMAIL]>
Co-authored-by: Eric Zhu <[REDACTED_EMAIL]>

**File**: `python/packages/autogen-ext/src/autogen_ext/models/openai/_openai_client.py` (modified, +2/-2)
```diff
@@ -947,8 +947,8 @@ async def create_stream(
                     is_reasoning = True
                 thought_deltas.append(reasoning_content)
                 yield reasoning_content
-            elif is_reasoning:
-                # Exit reasoning mode.
+            elif reasoning_content is None and is_reasoning:
+                # Exit reasoning mode only when reasoning_content is None (not when it's an empty string).
                 reasoning_content = "</think>"
                 thought_deltas.append(reasoning_content)
                 is_reasoning = False
```

---

### Incident Patch 14: `0df6be1f` (2025-09-16)
**Commit Message**: fix: extra args not work to disable thinking (#7006)

**File**: `python/packages/autogen-ext/src/autogen_ext/models/openai/_openai_client.py` (modified, +1/-1)
```diff
@@ -94,7 +94,7 @@
 aopenai_init_kwargs = set(inspect.getfullargspec(AsyncAzureOpenAI.__init__).kwonlyargs)
 
 create_kwargs = set(completion_create_params.CompletionCreateParamsBase.__annotations__.keys()) | set(
-    ("timeout", "stream")
+    ("timeout", "stream", "extra_body")
 )
 # Only single choice allowed
 disallowed_create_args = set(["stream", "messages", "function_call", "functions", "n"])
```

---

### Incident Patch 15: `31078550` (2025-08-31)
**Commit Message**: Fix message ID for correlation between streaming chunks and final mes… (#6969)

Co-authored-by: Eric Zhu <[REDACTED_EMAIL]>

**File**: `python/packages/autogen-agentchat/src/autogen_agentchat/agents/_assistant_agent.py` (modified, +6/-2)
```diff
@@ -972,9 +972,11 @@ async def on_messages_stream(
 
         # --- NEW: If the model produced a hidden "thought," yield it as an event ---
         if model_result.thought:
-            thought_event = ThoughtEvent(content=model_result.thought, source=agent_name)
+            thought_event = ThoughtEvent(content=model_result.thought, source=agent_name, id=message_id)
             yield thought_event
             inner_messages.append(thought_event)
+            # Regenerate the message ID for correlation between streaming chunks and final message
+            message_id = str(uuid.uuid4())
 
         # Add the assistant message to the model context (including thought if present)
         await model_context.add_message(
@@ -1281,9 +1283,11 @@ async def _execute_tool_calls(
 
             # Yield thought event if present
             if current_model_result.thought:
-                thought_event = ThoughtEvent(content=current_model_result.thought, source=agent_name)
+                thought_event = ThoughtEvent(content=current_model_result.thought, source=agent_name, id=message_id)
                 yield thought_event
                 inner_messages.append(thought_event)
+                # Regenerate the message ID for correlation between streaming chunks and final message
+                message_id = str(uuid.uuid4())
 
             # Add the assistant message to the model context (including thought if present)
             await model_context.add_message(
```

#### Recent Merged Pull Requests:
- **PR #8274** (closed): feat(examples): add Adam Network agent integration example (@snow884)
- **PR #8250** (closed): Fix: drop trailing assistant message when rstrip leaves it empty (@mayuriphad)
- **PR #8245** (closed): fix(autogen-ext): enforce trust boundary on Docker volume mounts (OWASP ASI10) (@maxpetrusenkoagent)
- **PR #8201** (closed): feat: add Cross-Chain Intent Tool supporting ERC-7683 standard (@maxpetrusenkoagent)
- **PR #8198** (closed): docs: add security extension points guidance (@maxpetrusenkoagent)
- **PR #8163** (closed): Document message delivery behavior differences (@Saravanan2104)
- **PR #8149** (closed): feat: add action_ref parameter to trace_tool_span (@wasim-builds)
- **PR #8148** (closed): docs: add CancellationToken propagation guide (@wasim-builds)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
