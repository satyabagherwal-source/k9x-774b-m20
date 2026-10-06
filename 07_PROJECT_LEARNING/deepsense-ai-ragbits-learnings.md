# Forensic Learning Record (Deep Inspection): deepsense-ai/ragbits

> **Canonical Artifact**: `07_PROJECT_LEARNING/deepsense-ai-ragbits-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/deepsense-ai/ragbits](https://github.com/deepsense-ai/ragbits))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:05:16.233Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `deepsense-ai/ragbits`
- **Description**: Building blocks for rapid development of GenAI applications 
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 1671 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/agents/hooks/agent_output_logging.py`
```
"""
Ragbits Agents Example: Post-tool hook for agent output logging

This example demonstrates how to use a POST_TOOL hook to log outputs returned
by downstream agent tools. The setup consists of a parent agent with two expert
child agents (diet and fitness) registered as tools.

To execute this script simply run:
    ```bash
    uv run examples/agents/hooks/agent_output_logging.py
    ```
"""

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "ragbits-core",
#     "ragbits-agents",
# ]
# ///

import asyncio

from ragbits.agents import Agent
from ragbits.agents.hooks import EventType, Hook
from ragbits.agents.tool import ToolReturn
from ragbits.core.llms import LiteLLM
from ragbits.core.llms.base import ToolCall


async def log_agent_output(tool_call: ToolCall, tool_return: ToolReturn) -> ToolReturn:
    """Log output from agent tools after they complete."""
    output = tool_return.value

    if isinstance(output, dict):
        output = output.get("content", output)

    print(f"\n{'='*60}\n[{tool_call.name}] output:\n{'-'*60}\n{output}\n{'='*60}")
    return tool_return


async def main() -> None:
    """Run the example."""
    llm = LiteLLM("gpt-4o-mini")

    # Child agent 1: Diet expert
    diet_agent = Agent(
        name="diet_expert",
        description="A nutrition expert who provides diet plans and healthy eating advice",
        llm=llm,
    )

    # Child agent 2: Fitness coach
    fitness_agent = Agent(
        name="fitness_coach",
        description="A personal trainer who creates workout routines and exercise plans",
        llm=llm,
    )

    # Hook to log outputs from both agent tools
    hook = Hook(
        event_type=EventType.POST_TOOL,
        callback=log_agent_output,
        tool_names=["diet_expert", "fitness_coach"],
        priority=1,
    )

    # Parent agent with both expert agents as tools
    parent_agent = Agent(
        name="health_assistant",
        llm=llm,
        tools=[diet_agent, fitness_agent],
        hooks=[hook],
    )

    # Query that should trigger both agent tools
    query = "I want to lose 10kg in 3 months. Can you help me with a plan?"
    print(f"Query: {query}\n")

    response = await parent_agent.run(query)
    print(f"Final Response:\n{response.content}")


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/agents/hooks/guardrails_integration.py`
```
"""
Ragbits Agents Example: Guardrails integration with hooks

This example demonstrates how to use the ragbits Guardrail system with agent hooks
to validate inputs before the agent processes them, and how to use ON_EVENT hooks
to transform streaming output in real-time.

To execute this script simply run:
    ```bash
    uv run examples/agents/hooks/guardrails_integration.py
    ```
"""

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "ragbits-agents",
#     "ragbits-guardrails",
# ]
# ///

import asyncio

from ragbits.agents import Agent
from ragbits.agents._main import AgentOptions, AgentRunContext
from ragbits.agents.hooks import EventType, Hook, OnEventCallback, PreRunCallback
from ragbits.agents.hooks.types import StreamingEvent
from ragbits.core.llms import LiteLLM
from ragbits.guardrails.base import Guardrail, GuardrailManager, GuardrailVerificationResult


class BlockedTopicsGuardrail(Guardrail):
    """Guardrail that blocks requests containing forbidden topics."""

    def __init__(self, blocked_topics: list[str]) -> None:
        self.blocked_topics = blocked_topics

    async def verify(self, input_to_verify: str) -> GuardrailVerificationResult:
        """Check if input contains any blocked topics."""
        input_lower = str(input_to_verify).lower()

        for topic in self.blocked_topics:
            if topic in input_lower:
                return GuardrailVerificationResult(
                    guardrail_name=self.__class__.__name__,
                    succeeded=False,
                    fail_reason=f"Input contains blocked topic: {topic}",
                )

        return GuardrailVerificationResult(
            guardrail_name=self.__class__.__name__,
            succeeded=True,
            fail_reason=None,
        )


def create_guardrail_hook(
    guardrail_manager: GuardrailManager,
) -> PreRunCallback:
    """Create a pre-run hook that validates input using guardrails."""

    async def guardrail_hook(
        input: str | None,
        options: AgentOptions,
        context: AgentRunContext,
    ) -> str | None:
        """Validate input against guardrails before agent processes it."""
        user_input = str(input or "")
        results = await guardrail_manager.verify(user_input)

        for result in results:
            if not result.succeeded:
                return f"I cannot help with that request. Reason: {result.fail_reason}"

        return input

    return guardrail_hook


def create_upper_words_hook(words: list[str]) -> OnEventCallback:
    """Create an ON_EVENT hook that upper-cases specified words in streaming text chunks."""

    async def upper_words_hook(event: StreamingEvent) -> StreamingEvent | None:
        if isinstance(event, str):
            result = event
            for word in words:
                result = result.replace(word, word.upper())
            return result
        return event

    return upper_words_hook


async def main() -> None:
    """Run the example demonstrating guardrails with hooks."""
    blocked_topics_guardrail = BlockedTopicsGuardrail(blocked_topics=["politics", "religion"])
    guardrail_manager = GuardrailManager(guardrails=[blocked_topics_guardrail])
    guardrail_hook = create_guardrail_hook(guardrail_manager)
    upper_hook = create_upper_words_hook(["founded", "party"])

    agent = Agent(
        llm=LiteLLM("gpt-4o-mini"),
        prompt="You are a helpful assistant.",
        hooks=[
            Hook(event_type=EventType.PRE_RUN, callback=guardrail_hook),
            Hook(event_type=EventType.ON_EVENT, callback=upper_hook),
        ],
    )

    # Test 1: Safe input with run()
    print("1. Safe query (run):")
    response = await agent.run("What is the capital of France?")
    print(f"\t{response.content}\n")

    # Test 2: Blocked input with run()
    print("2. Blocked query (run):")
    response = await agent.run("Tell me about religion in ancient Rome?")
    print(f"\t{response.content}\n")

    # Test 3: Safe input with streaming
    print("3. Safe query (streaming):\n\t", end="")
    async for chunk in agent.run_streaming("What is 2 + 2?"):
        if isinstance(chunk, str):
            print(chunk, end="")

    # Test 4: Blocked input with streaming — pre-run hook blocks, on-event hook upper-cases the rejection message
    print("\n\n4. On event upper-casing (streaming):\n\t", end="")
    async for chunk in agent.run_streaming("What are the main political parties in the US?"):
        if isinstance(chunk, str):
            print(chunk, end="")


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/agents/hooks/validation_and_sanitization.py`
```
"""
Ragbits Agents Example: Input validation, sanitization, and output masking with hooks

This example demonstrates a customer support agent with PRE_TOOL and POST_TOOL hooks that
validate email addresses before sending, sanitize email domains to an approved list,
and mask sensitive user data in tool responses.

To execute this script simply run:
    ```bash
    uv run examples/agents/hooks/validation_and_sanitization.py
    ```
"""

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "ragbits-agents",
# ]
# ///

import asyncio
import re
from typing import Any

from ragbits.agents import Agent
from ragbits.agents.hooks import EventType, Hook
from ragbits.agents.tool import ToolReturn
from ragbits.core.llms.base import ToolCall
from ragbits.core.llms.litellm import LiteLLM

# Track hook actions for demonstration
hook_actions: list[dict[str, Any]] = []


def search_user(user_id: str) -> dict[str, Any]:
    """Search for user information in the database."""
    users = {
        "123": {"name": "John Doe", "email": "john@example.com", "ssn": "123-45-6789", "balance": 5000},
        "456": {"name": "Jane Smith", "email": "jane@example.com", "ssn": "987-65-4321", "balance": 3500},
    }
    return users.get(user_id, {"error": "User not found"})


def send_notification(email: str, message: str) -> str:
    """Send notification email to user."""
    return f"Email sent to {email}: {message}"


async def validate_email(tool_call: ToolCall) -> ToolCall:
    """Validate email format before sending."""
    if tool_call.name != "send_notification":
        return tool_call

    email = tool_call.arguments.get("email", "")
    email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"

    if not re.match(email_pattern, email):
        hook_actions.append({"hook": "validate_email", "action": "denied", "email": email})
        return tool_call.model_copy(
            update={
                "decision": "deny",
                "reason": f"Invalid email format: {email}",
            }
        )

    hook_actions.append({"hook": "validate_email", "action": "passed", "email": email})
    return tool_call


async def sanitize_email_domain(tool_call: ToolCall) -> ToolCall:
    """Ensure emails only go to approved domains."""
    if tool_call.name != "send_notification":
        return tool_call

    email = tool_call.arguments.get("email", "")
    approved_domains = ["example.com", "test.com"]

    domain = email.split("@")[-1] if "@" in email else ""
    if domain not in approved_domains:
        modified_email = email.split("@")[0] + "@example.com"
        modified_args = tool_call.arguments.copy()
        modified_args["email"] = modified_email

        hook_actions.append(
            {
                "hook": "sanitize_email_domain",
                "action": "modified",
                "original": email,
                "modified": modified_email,
            }
        )

        return tool_call.model_copy(update={"arguments": modified_args})

    hook_actions.append({"hook": "sanitize_email_domain", "action": "passed", "email": email})
    return tool_call


async def mask_sensitive_data(tool_call: ToolCall, tool_return: ToolReturn) -> ToolReturn:
    """Mask sensitive information in user search results."""
    if tool_call.name != "search_user":
        return tool_return

    if isinstance(tool_return.value, dict) and "ssn" in tool_return.value:
        original_ssn = tool_return.value["ssn"]
        masked_output = tool_return.value.copy()
        masked_output["ssn"] = "***-**-****"

        hook_actions.append(
            {
                "hook": "mask_sensitive_data",
                "action": "masked",
                "field": "ssn",
                "original": original_ssn,
                "masked": "***-**-****",
            }
        )

        return ToolReturn(masked_output)

    return tool_return


async def log_notification(tool_call: ToolCall, tool_return: ToolReturn) -> ToolReturn:
    """Add logging metadata to notification results."""
    if tool_call.name != "send_notification":
        return tool_return

    original_output = tool_return.value
    enhanced_output = f"{tool_return.value} [Logged at system]"

    hook_actions.append(
        {
            "hook": "log_notification",
            "action": "enhanced",
            "original": original_output,
            "enhanced": enhanced_output,
        }
    )

    return ToolReturn(enhanced_output)


async def main() -> None:
    """Run the hooks example demonstrating pre-tool and post-tool hooks."""
    llm = LiteLLM("gpt-4o-mini")

    hooks = [
        Hook(event_type=EventType.PRE_TOOL, callback=validate_email, tool_names=["send_notification"], priority=10),
        Hook(
            event_type=EventType.PRE_TOOL, callback=sanitize_email_domain, tool_names=["send_notification"], priority=20
        ),
        Hook(event_type=EventType.POST_TOOL, callback=mask_sensitive_data, tool_names=["search_user"], priority=10),
        Hook(event_type=EventType.POST_TOOL, callback=log_notification, tool_names=["send_notification"], priority=10),
    ]

    agent = Agent(
        llm=llm,
        tools=[search_user, send_notification],
        hooks=hooks,
    )

    prompt = "Look up user 123 and send them a notification about their account balance."

    print(f"Prompt: {prompt}\n")

    response = await agent.run(prompt)

    print(f"\nAgent Response: {response.content}\n")

    print("Tool Results:")
    for tool_call in response.tool_calls:
        if tool_call.name == "search_user":
            result = tool_call.result
            print(f"  search_user: name={result['name']}, ssn={result['ssn']}, balance=${result['balance']}")
        elif tool_call.name == "send_notification":
            print(f"  send_notification: {tool_call.result}")

    print("\nHook Actions:")
    for action in hook_actions:
        if action["hook"] == "mask_sensitive_data":
            print(f"  {action['field'].upper()} masked: {action['original']} → {action['masked']}")
        elif action["hook"] == "validate_email":
            print(f"  Email validation {action['action']}: {action['email']}")
        elif action["hook"] == "sanitize_email_domain":
            if action["action"] == "modified":
                print(f"  Domain redirected: {action['original']} → {action['modified']}")
            else:
                print(f"  Domain approved: {action['email']}")
        elif action["hook"] == "log_notification":
            print("  Output enhanced with logging metadata")


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/core/audit/logfire_.py`
```
"""
Ragbits Core Example: Logfire Audit

This example demonstrates how to collect traces and metrics using Ragbits audit module with Logfire.
We run the LLM generation several times to emit telemetry data, which is automatically captured by Logfire.

Before running the script, follow these steps:

    1. Open your browser and navigate to https://logfire.dev.
    2. Log in (or sign up) and create a new project.
    3. Create a new project dashboard based on the "Basic System Metrics (Logfire)" template.
    4. Create a new write token in your project settings and set it as an environment variable:

    ```bash
    export LOGFIRE_TOKEN=<your-logfire-write-token>
    ```

To run the script, execute the following command:

    ```bash
    uv run examples/core/audit/logfire_.py
    ```

To visualize the metrics collected by Ragbits, follow these steps:

    1. Navigate to your project in Logfire.
    2. To check collected traces, go to the Live section in the top bar.
    3. To check collected metrics, go to the Dashboards section and select the dashboard you created before.
"""  # noqa: E501

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "ragbits-core[logfire]",
#     "google-auth>=2.35.0",
#     "tqdm",
# ]
# ///

import asyncio
from collections.abc import AsyncGenerator

from pydantic import BaseModel
from tqdm.asyncio import tqdm

from ragbits.core.audit import set_metric_handlers, set_trace_handlers, traceable
from ragbits.core.llms import LiteLLM
from ragbits.core.prompt import Prompt

# Ragbits observability setup
set_trace_handlers("logfire")
set_metric_handlers("logfire")


class DinnerIdeaPromptInput(BaseModel):
    """
    Input format for the dinner idea prompt.
    """

    chef_type: str
    ingredients: list[str]


class PromptOutput(BaseModel):
    """
    Output format for the dinner idea prompt.
    """

    answer: str


class DinnerIdeaPrompt(Prompt[DinnerIdeaPromptInput, PromptOutput]):
    """
    The dinner idea prompt.
    """

    system_prompt = """
    You are a {{ chef_type }}. Suggest a tasty dinner using only the ingredients provided.
    """
    user_prompt = """
    Available ingredients:
    {% for item in ingredients %}
        - {{ item }}
    {% endfor %}
    """


class AssistantPromptInput(BaseModel):
    """
    Input format for the assistant prompt.
    """

    suggestions: list[str]


class AssistantPrompt(Prompt[AssistantPromptInput, PromptOutput]):
    """
    The assistant prompt.
    """

    system_prompt = """
    You are an experienced home chef.
    Based on the dinner suggestions provided by different culinary experts,
    combine their ideas into one practical and delicious dinner recipe.
    """
    user_prompt = """
    Suggestions:
    {% for suggestion in suggestions %}
         - {{ suggestion }}
    {% endfor %}
    """


@traceable
async def process_request() -> None:
    """
    Process an example request.
    """
    ingredients = ["eggs", "bread", "cheddar cheese", "tomatoes"]
    chefs = [
        LiteLLM(model_name="gpt-4.1-2025-04-14", use_structured_output=True),
        LiteLLM(model_name="claude-haiku-4-5-20251001", use_structured_output=True),
        LiteLLM(model_name="gemini-2.0-flash", use_structured_output=True),
    ]
    prompts = [
        DinnerIdeaPrompt(DinnerIdeaPromptInput(chef_type=chef_type, ingredients=ingredients))
        for chef_type in ["busy parent", "budget cook", "Michelin chef"]
    ]
    responses = await asyncio.gather(*[llm.generate(prompt) for llm, prompt in zip(chefs, prompts, strict=False)])

    assistant = LiteLLM(model_name="o3", use_structured_output=True)
    prompt = AssistantPrompt(AssistantPromptInput(suggestions=[response.answer for response in responses]))
    async for _ in assistant.generate_streaming(prompt):
        pass


async def main() -> None:
    """
    Run the example.
    """

    async def run() -> AsyncGenerator:
        for _ in range(5):
            await process_request()
            yield

    async for _ in tqdm(run()):
        pass


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/core/audit/otel.py`
```
"""
Ragbits Core Example: OpenTelemetry Audit

This example demonstrates how to collect traces and metrics using Ragbits audit module with OpenTelemetry.
We run the LLM generation several times to collect telemetry data, and then export it to the OpenTelemetry collector and visualize it in Grafana.

The script exports traces to the local OTLP collector running on http://localhost:4317.
The recommended way to run it is using the official Docker image:

    ```bash
    docker run \
        --mount type=bind,src=./examples/core/audit/config/grafana/ragbits-dashboard.json,dst=/otel-lgtm/ragbits-dashboard.json \
        --mount type=bind,src=./examples/core/audit/config/grafana/grafana-dashboards.yaml,dst=/otel-lgtm/grafana/conf/provisioning/dashboards/grafana-dashboards.yaml \
        -p 3000:3000 -p 4317:4317 -p 4318:4318 --rm -ti grafana/otel-lgtm
    ```

To run the script, execute the following command:

    ```bash
    uv run examples/core/audit/otel.py
    ```

To visualize the metrics collected by Ragbits, follow these steps:

    1. Open your browser and navigate to http://localhost:3000.
    2. To check collected metrics, go to the Dashboards section and select Ragbits (make sure auto refresh is enabled).
    3. To check collected traces, go to the Drilldown/Traces section.
"""  # noqa: E501

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "ragbits-core[otel]",
#     "opentelemetry-sdk",
#     "opentelemetry-exporter-otlp-proto-grpc",
#     "google-auth>=2.35.0",
#     "tqdm",
# ]
# ///

import asyncio
from collections.abc import AsyncGenerator

from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from pydantic import BaseModel
from tqdm.asyncio import tqdm

from ragbits.core.audit import set_metric_handlers, set_trace_handlers, traceable
from ragbits.core.llms import LiteLLM
from ragbits.core.prompt import Prompt

resource = Resource({SERVICE_NAME: "ragbits-example"})

# Otel tracer provider setup
span_exporter = OTLPSpanExporter("http://localhost:4317", insecure=True)
tracer_provider = TracerProvider(resource=resource)
tracer_provider.add_span_processor(BatchSpanProcessor(span_exporter, max_export_batch_size=1))
trace.set_tracer_provider(tracer_provider)

# Otel meter provider setup
metric_exporter = OTLPMetricExporter(endpoint="http://localhost:4317", insecure=True)
reader = PeriodicExportingMetricReader(metric_exporter, export_interval_millis=1000)
meter_provider = MeterProvider(metric_readers=[reader], resource=resource)
metrics.set_meter_provider(meter_provider)

# Ragbits observability setup
set_trace_handlers("otel")
set_metric_handlers("otel")


class PhilosopherPromptInput(BaseModel):
    """
    Input format for the philosopher prompt.
    """

    philosopher_type: str
    question: str


class PromptOutput(BaseModel):
    """
    Output format for the philosopher prompt.
    """

    answer: str


class PhilosopherPrompt(Prompt[PhilosopherPromptInput, PromptOutput]):
    """
    The philospher prompt.
    """

    system_prompt = """
    You are an ancient {{ philosopher_type }} philosopher. Answer the user's question exhaustively.
    """
    user_prompt = """
    Question: {{ question }}
    """


class AssistantPromptInput(BaseModel):
    """
    Input format for the assistant prompt.
    """

    knowledge: list[str]
    question: str


class AssistantPrompt(Prompt[AssistantPromptInput, PromptOutput]):
    """
    The assistant prompt.
    """

    system_prompt = """
    Answer the user question based on the knowledge provided.
    """
    user_prompt = """
    Question: {{ question }}

    Knowledge:
    {% for item in knowledge %}
        {{ item }}
    {% endfor %}
    """


@traceable
async def process_request() -> None:
    """
    Process an example request.
    """
    question = "What's the meaning of life?"
    philosophers = [
        LiteLLM(model_name="gpt-4.1-2025-04-14", use_structured_output=True),
        LiteLLM(model_name="claude-haiku-4-5-20251001", use_structured_output=True),
        LiteLLM(model_name="gemini-2.0-flash", use_structured_output=True),
    ]
    prompts = [
        PhilosopherPrompt(PhilosopherPromptInput(question=question, philosopher_type=philosopher_type))
        for philosopher_type in ["nihilist", "stoic", "existentialist"]
    ]
    responses = await asyncio.gather(
        *[llm.generate(prompt) for llm, prompt in zip(philosophers, prompts, strict=False)]
    )

    assistant = LiteLLM(model_name="o3", use_structured_output=True)
    prompt = AssistantPrompt(
        AssistantPromptInput(question=question, knowledge=[response.answer for response in responses])
    )
    async for _ in assistant.generate_streaming(prompt):
        pass


async def main() -> None:
    """
    Run the example.
    """

    async def run() -> AsyncGenerator:
        for _ in range(5):
            await process_request()
            yield

    async for _ in tqdm(run()):
        pass


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/core/llms/ollama.py`
```
"""
Ragbits Core Example: Local LLM with Ollama via LiteLLM

This example demonstrates how to use LiteLLM to connect to a model hosted locally by Ollama.
Before running, make sure Ollama is installed and the model is available:

    ```bash
    ollama pull llama3.2
    ollama serve
    ```

To run the script, execute the following command:

    ```bash
    uv run examples/core/llms/ollama.py
    ```
"""

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "ragbits-core",
# ]
# ///

import asyncio

from ragbits.core.llms import LiteLLM

OLLAMA_API_BASE = "http://localhost:11434"
OLLAMA_MODEL = "ollama/llama3.2"


async def main() -> None:
    """
    Run the example.
    """
    llm = LiteLLM(model_name=OLLAMA_MODEL, api_base=OLLAMA_API_BASE)
    response = await llm.generate("What is the capital of Poland?")
    print(response)


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/core/llms/reasoning.py`
```
"""
Ragbits Core Example: Reasoning with LLM

This example demonstrates how to use reasoning with LLM.

To run the script, execute the following command:

    ```bash
    uv run examples/core/llms/reasoning.py
    ```
"""

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "ragbits-core",
# ]
# ///

import asyncio

from ragbits.core.llms import LiteLLM, LiteLLMOptions


async def main() -> None:
    """
    Run the example.
    """
    options = LiteLLMOptions(reasoning_effort="medium")
    model = LiteLLM(model_name="claude-haiku-4-5-20251001", default_options=options)
    response = await model.generate_with_metadata(
        "Do you like Jazz?",
    )
    print(f"reasoning: {response.reasoning}")

    options = LiteLLMOptions(thinking={"type": "enabled", "budget_tokens": 1024})
    model = LiteLLM(model_name="claude-haiku-4-5-20251001", default_options=options)
    response = await model.generate_with_metadata(
        "Do you like Jazz?",
    )
    print(f"reasoning: {response.reasoning}")


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/core/llms/tool_use.py`
```
"""
Ragbits Core Example: Tool Use with LLM

This example demonstrates how to provide tools and return tool calls from LLM.
We provide a list of tools as additional `tools` parameter to the `llm.generate` method.

Important: this feature does not call provided tools, LLM only decides which tools to call
in order to accomplish a given task.

To run the script, execute the following command:

    ```bash
    uv run examples/core/llms/tool_use.py
    ```
"""

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "ragbits-core",
# ]
# ///

import asyncio
import json

from ragbits.core.llms import LiteLLM


def get_weather(location: str) -> str:
    """
    Returns the current weather for a given location.

    Args:
        location: The location to get the weather for.

    Returns:
        The current weather for the given location.
    """
    match location.lower():
        case "tokyo":
            return json.dumps({"location": "Tokyo", "temperature": "10", "unit": "celsius"})
        case "san francisco":
            return json.dumps({"location": "San Francisco", "temperature": "72", "unit": "fahrenheit"})
        case "paris":
            return json.dumps({"location": "Paris", "temperature": "22", "unit": "celsius"})
        case _:
            return json.dumps({"location": location, "temperature": "unknown"})


async def main() -> None:
    """
    Run the example.
    """
    llm = LiteLLM(model_name="gpt-4o-2024-08-06")
    response = await llm.generate("What's the temperature in San Francisco?", tools=[get_weather])
    print(response)


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/core/prompt/multimodal_with_few_shots.py`
```
"""
Ragbits Core Example: Multimodal Prompt with Few Shots

This example demonstrates how to use the `Prompt` class to generate themed text using an LLM
with both text and image inputs. We define an `ImagePrompt` that generates a themed description
for a given image, using few-shot examples to improve response accuracy.

To run the script, execute the following command:

    ```bash
    uv run examples/core/prompt/multimodal_with_few_shots.py
    ```
"""

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "ragbits-core",
# ]
# ///

import asyncio

from pydantic import BaseModel

from ragbits.core.llms import LiteLLM
from ragbits.core.prompt import Attachment, Prompt


class ImagePromptInput(BaseModel):
    """
    Input format for the ImagePrompt.
    """

    theme: str
    image: Attachment


class ImagePromptOutput(BaseModel):
    """
    Output format for the ImagePrompt.
    """

    description: str


class ImagePrompt(Prompt[ImagePromptInput, ImagePromptOutput]):
    """
    Prompt that generates themed descriptions of images.
    """

    system_prompt = """
    You are themed image describer. Describe the image in the provided theme.
    """

    user_prompt = """
    Theme: {{ theme }}
    """

    few_shots = [
        (
            ImagePromptInput(
                theme="pirates",
                image=Attachment(url="https://upload.wikimedia.org/wikipedia/commons/5/55/Acd_a_frame.jpg"),
            ),
            ImagePromptOutput(description="Arrr, that would be a dog!"),
        ),
        (
            ImagePromptInput(
                theme="fairy tale",
                image=Attachment(url="https://upload.wikimedia.org/wikipedia/commons/6/62/Red_Wolf.jpg"),
            ),
            ImagePromptOutput(
                description="Once upon a time, in an enchanted forest, a noble wolf roamed under the moonlit sky."
            ),
        ),
        (
            ImagePromptInput(
                theme="sci-fi",
                image=Attachment(
                    url="https://upload.wikimedia.org/wikipedia/commons/9/91/Bruce_McCandless_II_during_EVA_in_1984.jpg"
                ),
            ),
            ImagePromptOutput(
                description="A lone astronaut drifts through the void, bathed in the eerie glow of distant galaxies."
            ),
        ),
    ]


async def main() -> None:
    """
    Run the example.
    """
    llm = LiteLLM(model_name="gpt-4o-2024-08-06", use_structured_output=True)
    image = Attachment(url="https://upload.wikimedia.org/wikipedia/en/8/85/Cute_Dom_cat.JPG")
    prompt_input = ImagePromptInput(image=image, theme="dramatic")
    prompt = ImagePrompt(prompt_input)
    response = await llm.generate(prompt)
    print(response.description)


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/core/prompt/multimodal_with_image.py`
```
"""
Ragbits Core Example: Multimodal Prompt with Image Input

This example demonstrates how to use the `Prompt` class to generate themed text using an LLM
with both text and image inputs. We define an `ImagePrompt` that generates a themed description
for a given image.

To run the script, execute the following command:

    ```bash
    uv run examples/core/prompt/multimodal_with_image.py
    ```
"""

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "ragbits-core",
# ]
# ///

import asyncio

from pydantic import BaseModel

from ragbits.core.llms import LiteLLM
from ragbits.core.prompt import Attachment, Prompt


class ImagePromptInput(BaseModel):
    """
    Input format for the ImagePrompt.
    """

    theme: str
    image: Attachment


class ImagePromptOutput(BaseModel):
    """
    Output format for the ImagePrompt.
    """

    description: str


class ImagePrompt(Prompt[ImagePromptInput, ImagePromptOutput]):
    """
    Prompt that generates themed descriptions of images.
    """

    system_prompt = """
    You are themed image describer. Describe the image in the provided theme.
    """

    user_prompt = """
    Theme: {{ theme }}
    """


async def main() -> None:
    """
    Run the example.
    """
    llm = LiteLLM(model_name="gpt-4o-2024-08-06", use_structured_output=True)
    image = Attachment(url="https://upload.wikimedia.org/wikipedia/en/8/85/Cute_Dom_cat.JPG")
    prompt_input = ImagePromptInput(image=image, theme="dramatic")
    prompt = ImagePrompt(prompt_input)
    response = await llm.generate(prompt)
    print(response.description)


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/core/prompt/multimodal_with_pdf.py`
```
"""
Ragbits Core Example: Multimodal Prompt with PDF Input

This example demonstrates how to use the `Prompt` class with both text and PDF inputs.
We define a `DocumentPrompt` that answers the question based on a provided PDF document.

To run the script, execute the following command:

    ```bash
    uv run examples/core/prompt/multimodal_with_pdf.py
    ```
"""

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "ragbits-core",
# ]
# ///

import asyncio

from pydantic import BaseModel

from ragbits.core.llms import LiteLLM
from ragbits.core.prompt import Attachment, Prompt


class DocumentPromptInput(BaseModel):
    """
    Input format for the DocumentPrompt.
    """

    question: str
    document: Attachment


class DocumentPromptOutput(BaseModel):
    """
    Output format for the DocumentPrompt.
    """

    answer: str


class DocumentPrompt(Prompt[DocumentPromptInput, DocumentPromptOutput]):
    """
    Prompt that answers questions based on a provided book passage.
    """

    system_prompt = """
    You are a helpful assistant that answers questions based on the provided document.
    """

    user_prompt = """
    Question: {{ question }}
    """


async def main() -> None:
    """
    Run the example.
    """
    llm = LiteLLM(model_name="gpt-4o-2024-08-06", use_structured_output=True)
    document = Attachment(
        url="https://arxiv.org/pdf/1706.03762",
        mime_type="application/pdf",
    )
    prompt_input = DocumentPromptInput(document=document, question="What is the main contribution of this paper?")
    prompt = DocumentPrompt(prompt_input)
    response = await llm.generate(prompt)
    print(response.answer)


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/core/prompt/text.py`
```
"""
Ragbits Core Example: Text Prompt

This example demonstrates how to use the `Prompt` class to generate themed text using an LLM.
We define an `AnimalPrompt` that generates names for a given animal type.

To run the script, execute the following command:

    ```bash
    uv run examples/core/prompt/text.py
    ```
"""

# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "ragbits-core",
# ]
# ///

import asyncio

from pydantic import BaseModel

from ragbits.core.llms import LiteLLM
from ragbits.core.prompt import Prompt


class AnimalPromptInput(BaseModel):
    """
    Input format for the AnimalPrompt.
    """

    animal: str


class AnimalPromptOutput(BaseModel):
    """
    Output format for the AnimalPrompt.
    """

    name: str


class AnimalPrompt(Prompt[AnimalPromptInput, AnimalPromptOutput]):
    """
    Prompt that generates animal names.
    """

    system_prompt = """
    You are an animal name generator. Use provided animal kind as a base.
    """

    user_prompt = """
    Animal: {{ animal }}
    """


async def main() -> None:
    """
    Run the example.
    """
    llm = LiteLLM(model_name="gpt-4o-2024-08-06", use_structured_output=True)
    prompt = AnimalPrompt(AnimalPromptInput(animal="cat"))
    response = await llm.generate(prompt)
    print(response.name)


if __name__ == "__main__":
    asyncio.run(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #975** (2026-04-27): **bug: UnicodeEncodeError in install_git_hooks.py on Windows**
  *Symptoms*: ### What happened?  Running `uv run scripts/install_git_hooks.py` on Windows fails with a UnicodeEncodeError because `pathlib.write_text()` uses the system default encoding (cp1252 on Windows) which cannot encode the emoji characters in `HOOK_BODY`.  ## Error UnicodeEncodeError: 'charmap' codec can't encode character '\U0001f9f9' in position 31: character maps to <undefined>  ## Expected behavior Hook installs successfully on Windows.  ## Fix Pass `encoding="utf-8"` to the `write_text()` call in `scripts/install_git_hooks.py`.  ## Environment - OS: Windows 11 - Python: 3.14.2 (via uv)   ### How can we reproduce it?  ```python 1. Clone the repo on Windows 2. Run `uv run scripts/install_git_hooks.py` 3. Select pre-commit ```  ### Relevant log output  ```shell  ```

- **Issue #869** (2025-12-19): **bug: SummaryGenerator raises errors when not defined**
  *Symptoms*: ### What happened?  When SummaryGenerator is not defined we get spam of logs with tracebacks included in the issue.  ### How can we reproduce it?  ```python  ```  ### Relevant log output  ```shell Traceback (most recent call last): File "/app/.venv/lib/python3.13/site-packages/ragbits/chat/interface/_interface.py", line 110, in wrapper summary = await self.generate_conversation_summary(message, history, context) ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ File "/app/.venv/lib/python3.13/site-packages/ragbits/chat/interface/_interface.py", line 400, in generate_conversation_summary raise Exception("Tried to invoke `generate_conversation_summary`. No SummaryGenerator found.") Exception: Tried to invoke `generate_conversation_summary`. No SummaryGenerator found. ```
  **Post-Mortem & Fix Analysis**:
  > closed by #875 

- **Issue #856** (2025-11-26): **bug: circular dependency**
  *Symptoms*: ### What happened?  while executing basic example from main readme ImportError ocurred most likely due to circular import  python 3.12.3 pip 24.0  ### How can we reproduce it?  ```python # pip install ragbits  import asyncio from pydantic import BaseModel from ragbits.core.llms import LiteLLM from ragbits.core.prompt import Prompt  class QuestionAnswerPromptInput(BaseModel):     question: str  class QuestionAnswerPrompt(Prompt[QuestionAnswerPromptInput, str]):     system_prompt = """     You are a question answering agent. Answer the question to the best of your ability.     """     user_prompt = """     Question: {{ question }}     """  llm = LiteLLM(model_name="gpt-4.1-nano")  async def main() -> None:     prompt = QuestionAnswerPrompt(QuestionAnswerPromptInput(question="What are high memory and low memory on linux?"))     response = await llm.generate(prompt)     print(response)  if __name__ == "__main__":     asyncio.run(main()) ```  ### Relevant log output  ```shell Traceback (most recent call last):   File "/home/piotr/projects/ragbits_public/basic.py", line 3, in <module>     from ragbits.core.llms import LiteLLM   File "/home/piotr/projects/ragbits_public/.venv/lib/python3.12/site-packages/ragbits/core/llms/__init__.py", line 1, in <module>     from .base import LLM, ToolCall, Usage ImportError: cannot import name 'LLM' from partially initialized module 'ragbits.core.llms.base' (most likely due to a circular import) (/home/piotr/projects/ragbits_public/.venv/lib/pytho
  **Post-Mortem & Fix Analysis**:
  > Issue was caused by incorrect local env configuration. Unable to replicate, not existing.

- **Issue #766** (2025-08-07): **bug: context not filled in chat property**
  *Symptoms*: ### What happened?  Greetings,  I recently started experimenting with ragbits and have a strange problem, the context chunks are not properly rendered in the chat property.  I'm currently using an exact copy of the code at: [https://ragbits.deepsense.ai/#retrieval-augmented-generation](https://ragbits.deepsense.ai/#retrieval-augmented-generation) and I see that the chat property of the prompt variable is passed to the llm.   The contents of prompt at a breakpoint set at line :     `response = await llm.generate(prompt)`  <img width="1710" height="505" alt="Image" src="https://github.com/user-attachments/assets/fa19c42a-ba90-4c8d-8895-4d68f39200fc" />  Here you can see that the context is not filled in in chat while it is properly done in the rendered_user_prompt.  However, the chat property is eventually passed to the llm which responds with the message that no context has been given.  What am I doing wrong here?  Thanks for any help!  ### How can we reproduce it? The only differene with my code is that I use a local llm but that should not impact the code before the actual llm call.  ```python import asyncio from collections.abc import Iterable from pydantic import BaseModel from ragbits.core.embeddings import LiteLLMEmbedder from ragbits.core.llms import LiteLLM from ragbits.core.prompt import Prompt from ragbits.core.vector_stores import InMemoryVectorStore from ragbits.document_search import DocumentSearch from ragbits.document_search.documents.element import Element  cla
  **Post-Mortem & Fix Analysis**:
  > Update: problem seems to have resolved itself. Closing.
  > Hey @ignaceHelsen thanks for raising this issue.  I managed to reproduce it, so we'll take a look what happened. 
  > @ignaceHelsen thanks for raising this.   The issue was that during the prompt initialization, all variables were consumed twice. For most cases this is not an issue. Imagine BaseModel as in your example  ```py class QuestionAnswerPromptInput(BaseModel):     question: str     context: Iterable[Element] ```  if context is a `list` or a `tuple` everything is fine, but if context is `Iterator` or `Generator` which can be consumed only once, we are in trouble.  That's why rendered_user_prompt was correct - it was created first and consumed the iterator. Then chat was incorrect as it tried to consume already consumed iterator and got nothing in return.

- **Issue #543** (2025-05-09): **bug: Don't pass limit=0 to qdrant**
  *Symptoms*: ### What happened?  We see issues like this:  "INFO qdrant::tonic::logging: gRPC /qdrant.Points/Query failed with Client specified an invalid argument "Validation error in body: [limit: value 0 invalid, must be 1 or larger]"  with newer qdrant databases (v1.14). (Also see the actual implementation, where it requires "limit" to be at least 1): https://github.com/qdrant/qdrant/blob/v1.14.0/lib/api/src/grpc/qdrant.rs#L4606   This issue I think originates from https://github.com/deepsense-ai/ragbits/blob/a1d891ead3feaeeac283237740028e3368fd7ce7/packages/ragbits-core/src/ragbits/core/vector_stores/qdrant.py#L338   "limit = limit or (await self._client.count(collection_name=self._index_name)).count" which could result in a limit argument of 0.  A simple "max(1, ...)" could help.  Reproduce: * Use the latest qdrant database version and python client library. Use a grpc connection. * Have a collection with no content yet and ingest data into it  ### How can we reproduce it?  ```python  ```  ### Relevant log output  ```shell "INFO qdrant::tonic::logging: gRPC /qdrant.Points/Query failed with Client specified an invalid argument "Validation error in body: [limit: value 0 invalid, must be 1 or larger]" ```
  **Post-Mortem & Fix Analysis**:
  > Hi David, thanks for raising the issue. We're on it.
  > After testing, it turned out that in addition to the limit being set to 0, gRPC also failed when handling the UUID type in the payload. This issue has been fixed in #548.  @micpst pls review

- **Issue #517** (2025-04-23): **bug:  default instalation has missing dependencies**
  *Symptoms*: ### What happened?  Without manual instalation `standard-imghdr` package does not work correctly. I've tried run example from docs: ```python from ragbits.core.prompt import Prompt  class SongPrompt(Prompt):     user_prompt = """         Write a song about a Python library called Ragbits.     """ ```  ### How can we reproduce it?  ```python I've installed latest version of the package and it looks like on the attached log output. ```  ### Relevant log output  ```shell damian@dgiebas-ubu-i4b-pl ~/A/promptfoo-self-learning (master) [1]> ragbits prompt exec main:SongPrompt Traceback (most recent call last):   File "/home/damian/.cache/pypoetry/virtualenvs/promptfoo-self-learning-nABErWj3-py3.13/bin/ragbits", line 5, in <module>     from ragbits.cli import main   File "/home/damian/.cache/pypoetry/virtualenvs/promptfoo-self-learning-nABErWj3-py3.13/lib/python3.13/site-packages/ragbits/cli/__init__.py", line 11, in <module>     from ragbits.core import audit   File "/home/damian/.cache/pypoetry/virtualenvs/promptfoo-self-learning-nABErWj3-py3.13/lib/python3.13/site-packages/ragbits/core/__init__.py", line 5, in <module>     from ragbits.core import audit   File "/home/damian/.cache/pypoetry/virtualenvs/promptfoo-self-learning-nABErWj3-py3.13/lib/python3.13/site-packages/ragbits/core/audit/__init__.py", line 9, in <module>     from ragbits.core.audit.base import TraceHandler   File "/home/damian/.cache/pypoetry/virtualenvs/promptfoo-self-learning-nABErWj3-py3.13/lib/python3.13/site
  **Post-Mortem & Fix Analysis**:
  > Hello @Draqun, thank you for reporting this issue.  I've managed to reproduce it; it seems that it happens only on Python 3.13, for which we hadn't yet configured automatic tests. I'm going to fix it in the next release and enable testing.
  > This is fixed in https://github.com/deepsense-ai/ragbits/releases/tag/v0.14.0

- **Issue #445** (2025-03-25): **bug: `RayDistributedStrategy` doesn't propagate ingest errors correctly**
  *Symptoms*: ### What happened?  Currently ingest steps return `IngestDocumentResult` which contains an error field that can store any exception from the task. Most of these exceptions can't be serialized properly, resulting in error during ingest and messing up the entire pipeline.  The solution would be to change the `error` field in `IngestDocumentResult` to store only the error type and add fields for error message and stack trace. 

- **Issue #441** (2025-03-26): **bug: creating `LiteLLM` with router using `from_config` doesn't work**
  *Symptoms*: ### What happened?  Initializing router for `LiteLLM` using from config yields incorrect object, instead of getting initialized `litellm.Router` current implementation seems to override it completely with arbitrary object provided for the `router` key.  ### How can we reproduce it?  Here's the code snippet:  ```python from ragbits.core.llms.base import LLM  llm = LLM.subclass_from_config(     ObjectContructionConfig(         type="ragbits.core.llms.litellm:LiteLLM",         config={             "model_name": "gpt-4-turbo",             "router": [                 {                     "model_name": "gpt-4o",                     "litellm_params": {                         "model": "azure/gpt-4o-eval-1",                 },                 {                     "model_name": "gpt-4o",                     "litellm_params": {                         "model": "azure/gpt-4o-eval-2",                     },                 },            ],         },     ) ) print(llm.router) ```  It prints `[{'model_name': 'gpt-4o', 'litellm_params': {'model': 'azure/gpt-4o-eval-1'}}, {'model_name': 'gpt-4o', 'litellm_params': {'model': 'azure/gpt-4o-eval-2'}}]`, but I'd expect to get an initialized `litellm.Router` here instead. 

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

### Incident Patch 1: `32074a71` (2026-05-13)
**Commit Message**: chore: update package versions for nightly build 1.7.0.dev202605130309

**File**: `packages/ragbits-agents/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-agents"
-version = "1.7.0.dev202604280307"
+version = "1.7.0.dev202605130309"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-core==1.7.0.dev202604280307"]
+dependencies = ["ragbits-core==1.7.0.dev202605130309"]
 
 [project.optional-dependencies]
 a2a = [
```

**File**: `packages/ragbits-chat/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-chat"
-version = "1.7.0.dev202604280307"
+version = "1.7.0.dev202605130309"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["fastapi[standard]>=0.115.0,<1.0.0", "uvicorn>=0.31.0,<1.0.0", "httpx>=0.28.1,<1.0.0", "bcrypt>=4.2.0", "python-jose[cryptography]>=3.5.0", "ragbits-agents==1.7.0.dev202604280307", "ragbits-core==1.7.0.dev202604280307"]
+dependencies = ["fastapi[standard]>=0.115.0,<1.0.0", "uvicorn>=0.31.0,<1.0.0", "httpx>=0.28.1,<1.0.0", "bcrypt>=4.2.0", "python-jose[cryptography]>=3.5.0", "ragbits-agents==1.7.0.dev202605130309", "ragbits-core==1.7.0.dev202605130309"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-cli/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-cli"
-version = "1.7.0.dev202604280307"
+version = "1.7.0.dev202605130309"
 description = "A CLI application for ragbits - building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["typer>=0.12.5,<1.0.0", "ragbits-core==1.7.0.dev202604280307"]
+dependencies = ["typer>=0.12.5,<1.0.0", "ragbits-core==1.7.0.dev202605130309"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-core/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-core"
-version = "1.7.0.dev202604280307"
+version = "1.7.0.dev202605130309"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `packages/ragbits-document-search/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-document-search"
-version = "1.7.0.dev202604280307"
+version = "1.7.0.dev202605130309"
 description = "Document Search module for Ragbits"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -29,7 +29,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["docling[easyocr]>=2.65.0,<2.66.0", "opencv-python>=4.11.0.86,<5.0.0.0", "rerankers>=0.6.1,<1.0.0", "filetype>=1.2.0,<2.0.0", "python-pptx>=1.0.0,<2.0.0", "lxml>=6.1.0", "ragbits-core==1.7.0.dev202604280307"]
+dependencies = ["docling[easyocr]>=2.65.0,<2.66.0", "opencv-python>=4.11.0.86,<5.0.0.0", "rerankers>=0.6.1,<1.0.0", "filetype>=1.2.0,<2.0.0", "python-pptx>=1.0.0,<2.0.0", "lxml>=6.1.0", "ragbits-core==1.7.0.dev202605130309"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-evaluate/pyproject.toml` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-evaluate"
-version = "1.7.0.dev202604280307"
+version = "1.7.0.dev202605130309"
 description = "Evaluation module for Ragbits components"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -32,7 +32,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "optuna>=4.0.0,<5.0.0", "distilabel>=1.5.0,<2.0.0", "datasets>=3.0.1,<4.0.0", "ragbits-core==1.7.0.dev202604280307"]
+dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "optuna>=4.0.0,<5.0.0", "distilabel>=1.5.0,<2.0.0", "datasets>=3.0.1,<4.0.0", "ragbits-core==1.7.0.dev202605130309"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
@@ -42,10 +42,10 @@ dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "o
 
 [project.optional-dependencies]
 agents = [
-    "ragbits-agents==1.7.0.dev202604280307",
+    "ragbits-agents==1.7.0.dev202605130309",
 ]
 document-search = [
-    "ragbits-document-search==1.7.0.dev202604280307",
+    "ragbits-document-search==1.7.0.dev202605130309",
 ]
 relari = [
     "continuous-eval>=0.3.12,<1.0.0",
```

**File**: `packages/ragbits-guardrails/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-guardrails"
-version = "1.7.0.dev202604280307"
+version = "1.7.0.dev202605130309"
 description = "Guardrails module for Ragbits components"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-core==1.7.0.dev202604280307"]
+dependencies = ["ragbits-core==1.7.0.dev202605130309"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits/pyproject.toml` (modified, +28/-28)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits"
-version = "1.7.0.dev202604280307"
+version = "1.7.0.dev202605130309"
 description = "Building blocks for rapid development of GenAI applications"
 dynamic = ["readme"]
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-agents==1.7.0.dev202604280307","ragbits-document-search==1.7.0.dev202604280307", "ragbits-cli==1.7.0.dev202604280307", "ragbits-evaluate==1.7.0.dev202604280307", "ragbits-guardrails==1.7.0.dev202604280307", "ragbits-chat==1.7.0.dev202604280307", "ragbits-core==1.7.0.dev202604280307"]
+dependencies = ["ragbits-agents==1.7.0.dev202605130309","ragbits-document-search==1.7.0.dev202605130309", "ragbits-cli==1.7.0.dev202605130309", "ragbits-evaluate==1.7.0.dev202605130309", "ragbits-guardrails==1.7.0.dev202605130309", "ragbits-chat==1.7.0.dev202605130309", "ragbits-core==1.7.0.dev202605130309"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
@@ -41,80 +41,80 @@ dependencies = ["ragbits-agents==1.7.0.dev202604280307","ragbits-document-search
 
 [project.optional-dependencies]
 openai = [
-    "ragbits-guardrails[openai]==1.7.0.dev202604280307",
-    "ragbits-agents[openai]==1.7.0.dev202604280307",
+    "ragbits-guardrails[openai]==1.7.0.dev202605130309",
+    "ragbits-agents[openai]==1.7.0.dev202605130309",
 ]
 chroma = [
-    "ragbits-core[chroma]==1.7.0.dev202604280307",
+    "ragbits-core[chroma]==1.7.0.dev202605130309",
 ]
 local = [
-    "ragbits-core[local]==1.7.0.dev202604280307",
+    "ragbits-core[local]==1.7.0.dev202605130309",
 ]
 fastembed = [
-    "ragbits-core[fastembed]==1.7.0.dev202604280307",
+    "ragbits-core[fastembed]==1.7.0.dev202605130309",
 ]
 promptfoo = [
-    "ragbits-core[promptfoo]==1.7.0.dev202604280307",
+    "ragbits-core[promptfoo]==1.7.0.dev202605130309",
 ]
 otel = [
-    "ragbits-core[otel]==1.7.0.dev202604280307",
+    "ragbits-core[otel]==1.7.0.dev202605130309",
 ]
 logfire = [
-    "ragbits-core[logfire]==1.7.0.dev202604280307",
+    "ragbits-core[logfire]==1.7.0.dev202605130309",
 ]
 qdrant = [
-    "ragbits-core[qdrant]==1.7.0.dev202604280307",
+    "ragbits-core[qdrant]==1.7.0.dev202605130309",
 ]
 pgvector = [
-    "ragbits-core[pgvector]==1.7.0.dev202604280307",
+    "ragbits-core[pgvector]==1.7.0.dev202605130309",
 ]
 fastembed-gpu = [
-    "ragbits-core[fastembed-gpu]==1.7.0.dev202604280307",
+    "ragbits-core[fastembed-gpu]==1.7.0.dev202605130309",
 ]
 azure = [
-    "ragbits-core[azure]==1.7.0.dev202604280307",
+    "ragbits-core[azure]==1.7.0.dev202605130309",
 ]
 gcs = [
-    "ragbits-core[gcs]==1.7.0.dev202604280307",
+    "ragbits-core[gcs]==1.7.0.dev202605130309",
 ]
 hf = [
-    "ragbits-core[hf]==1.7.0.dev202604280307",
+    "ragbits-core[hf]==1.7.0.dev202605130309",
 ]
 s3 = [
-    "ragbits-core[s3]==1.7.0.dev202604280307",
+    "ragbits-core[s3]==1.7.0.dev202605130309",
 ]
 google_drive = [
-    "ragbits-core[google_drive]==1.7.0.dev202604280307",
+    "ragbits-core[google_drive]==1.7.0.dev202605130309",
 ]
 weaviate = [
-    "ragbits-core[weaviate]==1.7.0.dev202604280307",
+    "ragbits-core[weaviate]==1.7.0.dev202605130309",
 ]
 agents = [
-    "ragbits-evaluate[agents]==1.7.0.dev202604280307",
+    "ragbits-evaluate[agents]==1.7.0.dev202605130309",
 ]
 document-search = [
-    "ragbits-evaluate[document-search]==1.7.0.dev202604280307",
+    "ragbits-evaluate[document-search]==1.7.0.dev202605130309",
 ]
 relari = [
-    "ragbits-evaluate[relari]==1.7.0.dev202604280307",
+    "ragbits-evaluate[relari]==1.7.0.dev202605130309",
 ]
 a2a = [
-    "ragbits-agents[a2a]==1.7.0.dev202604280307",
+    "ragbits-agents[a2a]==1.7.0.dev202605130309",
 ]
 mcp = [
-    "ragbits-agents[mcp]==1.7.0.dev202604280307",
+    "ragbits-agents[mcp]==1.7.0.dev202605130309",
 ]
 cli = [
-    "ragbits-agents[cli]==1.7.0.dev202604280307",
+    "ragbits-agents[cli]==1.7.0.dev202605130309",
 ]
 unstructured = [
-    "ragbits-document-search[unstructured]==1.7.0.dev202604280307",
+    "ragbits-document-search[unstructured]==1.7.0.dev202605130309",
 ]
 ray = [
-    "ragbits-document-search[ray]==1.7.0.dev202604280307",
+    "ragbits-document-search[ray]==1.7.0.dev202605130309",
 ]
 sql = [
-    "ragbits-chat[sql]==1.7.0.dev202604280307",
+    "ragbits-chat[sql]==1.7.0.dev202605130309",
 ]
 
 [build-system]
```

---

### Incident Patch 2: `a9baa0e7` (2026-04-28)
**Commit Message**: chore: update package versions for nightly build 1.7.0.dev202604280307

**File**: `packages/ragbits-agents/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-agents"
-version = "1.7.0.dev202604240307"
+version = "1.7.0.dev202604280307"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-core==1.7.0.dev202604240307"]
+dependencies = ["ragbits-core==1.7.0.dev202604280307"]
 
 [project.optional-dependencies]
 a2a = [
```

**File**: `packages/ragbits-chat/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-chat"
-version = "1.7.0.dev202604240307"
+version = "1.7.0.dev202604280307"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["fastapi[standard]>=0.115.0,<1.0.0", "uvicorn>=0.31.0,<1.0.0", "httpx>=0.28.1,<1.0.0", "bcrypt>=4.2.0", "python-jose[cryptography]>=3.5.0", "ragbits-agents==1.7.0.dev202604240307", "ragbits-core==1.7.0.dev202604240307"]
+dependencies = ["fastapi[standard]>=0.115.0,<1.0.0", "uvicorn>=0.31.0,<1.0.0", "httpx>=0.28.1,<1.0.0", "bcrypt>=4.2.0", "python-jose[cryptography]>=3.5.0", "ragbits-agents==1.7.0.dev202604280307", "ragbits-core==1.7.0.dev202604280307"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-cli/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-cli"
-version = "1.7.0.dev202604240307"
+version = "1.7.0.dev202604280307"
 description = "A CLI application for ragbits - building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["typer>=0.12.5,<1.0.0", "ragbits-core==1.7.0.dev202604240307"]
+dependencies = ["typer>=0.12.5,<1.0.0", "ragbits-core==1.7.0.dev202604280307"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-core/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-core"
-version = "1.7.0.dev202604240307"
+version = "1.7.0.dev202604280307"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `packages/ragbits-document-search/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-document-search"
-version = "1.7.0.dev202604240307"
+version = "1.7.0.dev202604280307"
 description = "Document Search module for Ragbits"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -29,7 +29,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["docling[easyocr]>=2.65.0,<2.66.0", "opencv-python>=4.11.0.86,<5.0.0.0", "rerankers>=0.6.1,<1.0.0", "filetype>=1.2.0,<2.0.0", "python-pptx>=1.0.0,<2.0.0", "lxml>=6.1.0", "ragbits-core==1.7.0.dev202604240307"]
+dependencies = ["docling[easyocr]>=2.65.0,<2.66.0", "opencv-python>=4.11.0.86,<5.0.0.0", "rerankers>=0.6.1,<1.0.0", "filetype>=1.2.0,<2.0.0", "python-pptx>=1.0.0,<2.0.0", "lxml>=6.1.0", "ragbits-core==1.7.0.dev202604280307"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-evaluate/pyproject.toml` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-evaluate"
-version = "1.7.0.dev202604240307"
+version = "1.7.0.dev202604280307"
 description = "Evaluation module for Ragbits components"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -32,7 +32,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "optuna>=4.0.0,<5.0.0", "distilabel>=1.5.0,<2.0.0", "datasets>=3.0.1,<4.0.0", "ragbits-core==1.7.0.dev202604240307"]
+dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "optuna>=4.0.0,<5.0.0", "distilabel>=1.5.0,<2.0.0", "datasets>=3.0.1,<4.0.0", "ragbits-core==1.7.0.dev202604280307"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
@@ -42,10 +42,10 @@ dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "o
 
 [project.optional-dependencies]
 agents = [
-    "ragbits-agents==1.7.0.dev202604240307",
+    "ragbits-agents==1.7.0.dev202604280307",
 ]
 document-search = [
-    "ragbits-document-search==1.7.0.dev202604240307",
+    "ragbits-document-search==1.7.0.dev202604280307",
 ]
 relari = [
     "continuous-eval>=0.3.12,<1.0.0",
```

**File**: `packages/ragbits-guardrails/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-guardrails"
-version = "1.7.0.dev202604240307"
+version = "1.7.0.dev202604280307"
 description = "Guardrails module for Ragbits components"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-core==1.7.0.dev202604240307"]
+dependencies = ["ragbits-core==1.7.0.dev202604280307"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits/pyproject.toml` (modified, +28/-28)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits"
-version = "1.7.0.dev202604240307"
+version = "1.7.0.dev202604280307"
 description = "Building blocks for rapid development of GenAI applications"
 dynamic = ["readme"]
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-agents==1.7.0.dev202604240307","ragbits-document-search==1.7.0.dev202604240307", "ragbits-cli==1.7.0.dev202604240307", "ragbits-evaluate==1.7.0.dev202604240307", "ragbits-guardrails==1.7.0.dev202604240307", "ragbits-chat==1.7.0.dev202604240307", "ragbits-core==1.7.0.dev202604240307"]
+dependencies = ["ragbits-agents==1.7.0.dev202604280307","ragbits-document-search==1.7.0.dev202604280307", "ragbits-cli==1.7.0.dev202604280307", "ragbits-evaluate==1.7.0.dev202604280307", "ragbits-guardrails==1.7.0.dev202604280307", "ragbits-chat==1.7.0.dev202604280307", "ragbits-core==1.7.0.dev202604280307"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
@@ -41,80 +41,80 @@ dependencies = ["ragbits-agents==1.7.0.dev202604240307","ragbits-document-search
 
 [project.optional-dependencies]
 openai = [
-    "ragbits-guardrails[openai]==1.7.0.dev202604240307",
-    "ragbits-agents[openai]==1.7.0.dev202604240307",
+    "ragbits-guardrails[openai]==1.7.0.dev202604280307",
+    "ragbits-agents[openai]==1.7.0.dev202604280307",
 ]
 chroma = [
-    "ragbits-core[chroma]==1.7.0.dev202604240307",
+    "ragbits-core[chroma]==1.7.0.dev202604280307",
 ]
 local = [
-    "ragbits-core[local]==1.7.0.dev202604240307",
+    "ragbits-core[local]==1.7.0.dev202604280307",
 ]
 fastembed = [
-    "ragbits-core[fastembed]==1.7.0.dev202604240307",
+    "ragbits-core[fastembed]==1.7.0.dev202604280307",
 ]
 promptfoo = [
-    "ragbits-core[promptfoo]==1.7.0.dev202604240307",
+    "ragbits-core[promptfoo]==1.7.0.dev202604280307",
 ]
 otel = [
-    "ragbits-core[otel]==1.7.0.dev202604240307",
+    "ragbits-core[otel]==1.7.0.dev202604280307",
 ]
 logfire = [
-    "ragbits-core[logfire]==1.7.0.dev202604240307",
+    "ragbits-core[logfire]==1.7.0.dev202604280307",
 ]
 qdrant = [
-    "ragbits-core[qdrant]==1.7.0.dev202604240307",
+    "ragbits-core[qdrant]==1.7.0.dev202604280307",
 ]
 pgvector = [
-    "ragbits-core[pgvector]==1.7.0.dev202604240307",
+    "ragbits-core[pgvector]==1.7.0.dev202604280307",
 ]
 fastembed-gpu = [
-    "ragbits-core[fastembed-gpu]==1.7.0.dev202604240307",
+    "ragbits-core[fastembed-gpu]==1.7.0.dev202604280307",
 ]
 azure = [
-    "ragbits-core[azure]==1.7.0.dev202604240307",
+    "ragbits-core[azure]==1.7.0.dev202604280307",
 ]
 gcs = [
-    "ragbits-core[gcs]==1.7.0.dev202604240307",
+    "ragbits-core[gcs]==1.7.0.dev202604280307",
 ]
 hf = [
-    "ragbits-core[hf]==1.7.0.dev202604240307",
+    "ragbits-core[hf]==1.7.0.dev202604280307",
 ]
 s3 = [
-    "ragbits-core[s3]==1.7.0.dev202604240307",
+    "ragbits-core[s3]==1.7.0.dev202604280307",
 ]
 google_drive = [
-    "ragbits-core[google_drive]==1.7.0.dev202604240307",
+    "ragbits-core[google_drive]==1.7.0.dev202604280307",
 ]
 weaviate = [
-    "ragbits-core[weaviate]==1.7.0.dev202604240307",
+    "ragbits-core[weaviate]==1.7.0.dev202604280307",
 ]
 agents = [
-    "ragbits-evaluate[agents]==1.7.0.dev202604240307",
+    "ragbits-evaluate[agents]==1.7.0.dev202604280307",
 ]
 document-search = [
-    "ragbits-evaluate[document-search]==1.7.0.dev202604240307",
+    "ragbits-evaluate[document-search]==1.7.0.dev202604280307",
 ]
 relari = [
-    "ragbits-evaluate[relari]==1.7.0.dev202604240307",
+    "ragbits-evaluate[relari]==1.7.0.dev202604280307",
 ]
 a2a = [
-    "ragbits-agents[a2a]==1.7.0.dev202604240307",
+    "ragbits-agents[a2a]==1.7.0.dev202604280307",
 ]
 mcp = [
-    "ragbits-agents[mcp]==1.7.0.dev202604240307",
+    "ragbits-agents[mcp]==1.7.0.dev202604280307",
 ]
 cli = [
-    "ragbits-agents[cli]==1.7.0.dev202604240307",
+    "ragbits-agents[cli]==1.7.0.dev202604280307",
 ]
 unstructured = [
-    "ragbits-document-search[unstructured]==1.7.0.dev202604240307",
+    "ragbits-document-search[unstructured]==1.7.0.dev202604280307",
 ]
 ray = [
-    "ragbits-document-search[ray]==1.7.0.dev202604240307",
+    "ragbits-document-search[ray]==1.7.0.dev202604280307",
 ]
 sql = [
-    "ragbits-chat[sql]==1.7.0.dev202604240307",
+    "ragbits-chat[sql]==1.7.0.dev202604280307",
 ]
 
 [build-system]
```

---

### Incident Patch 3: `c048f0d0` (2026-04-27)
**Commit Message**: fix: add encoding='utf-8' to write_text in install_git_hooks.py (#976)

**File**: `scripts/install_git_hooks.py` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ def main() -> None:
     (hooks_dir / "pre-push").unlink(missing_ok=True)
 
     pre_commit_hook = hooks_dir / hook_type
-    pre_commit_hook.write_text(HOOK_BODY)
+    pre_commit_hook.write_text(HOOK_BODY, encoding="utf-8")
     pre_commit_hook.chmod(0o755)
 
     pprint(f"[cyan]Git hook for [b]{hook_type}[/b] installed!")
```

---

### Incident Patch 4: `dcc13029` (2026-04-24)
**Commit Message**: chore: update package versions for nightly build 1.7.0.dev202604240307

**File**: `packages/ragbits-agents/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-agents"
-version = "1.7.0.dev202604150306"
+version = "1.7.0.dev202604240307"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-core==1.7.0.dev202604150306"]
+dependencies = ["ragbits-core==1.7.0.dev202604240307"]
 
 [project.optional-dependencies]
 a2a = [
```

**File**: `packages/ragbits-chat/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-chat"
-version = "1.7.0.dev202604150306"
+version = "1.7.0.dev202604240307"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["fastapi[standard]>=0.115.0,<1.0.0", "uvicorn>=0.31.0,<1.0.0", "httpx>=0.28.1,<1.0.0", "bcrypt>=4.2.0", "python-jose[cryptography]>=3.5.0", "ragbits-agents==1.7.0.dev202604150306", "ragbits-core==1.7.0.dev202604150306"]
+dependencies = ["fastapi[standard]>=0.115.0,<1.0.0", "uvicorn>=0.31.0,<1.0.0", "httpx>=0.28.1,<1.0.0", "bcrypt>=4.2.0", "python-jose[cryptography]>=3.5.0", "ragbits-agents==1.7.0.dev202604240307", "ragbits-core==1.7.0.dev202604240307"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-cli/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-cli"
-version = "1.7.0.dev202604150306"
+version = "1.7.0.dev202604240307"
 description = "A CLI application for ragbits - building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["typer>=0.12.5,<1.0.0", "ragbits-core==1.7.0.dev202604150306"]
+dependencies = ["typer>=0.12.5,<1.0.0", "ragbits-core==1.7.0.dev202604240307"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-core/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-core"
-version = "1.7.0.dev202604150306"
+version = "1.7.0.dev202604240307"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `packages/ragbits-document-search/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-document-search"
-version = "1.7.0.dev202604150306"
+version = "1.7.0.dev202604240307"
 description = "Document Search module for Ragbits"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -29,7 +29,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["docling[easyocr]>=2.65.0,<2.66.0", "opencv-python>=4.11.0.86,<5.0.0.0", "rerankers>=0.6.1,<1.0.0", "filetype>=1.2.0,<2.0.0", "python-pptx>=1.0.0,<2.0.0", "ragbits-core==1.7.0.dev202604150306"]
+dependencies = ["docling[easyocr]>=2.65.0,<2.66.0", "opencv-python>=4.11.0.86,<5.0.0.0", "rerankers>=0.6.1,<1.0.0", "filetype>=1.2.0,<2.0.0", "python-pptx>=1.0.0,<2.0.0", "ragbits-core==1.7.0.dev202604240307"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-evaluate/pyproject.toml` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-evaluate"
-version = "1.7.0.dev202604150306"
+version = "1.7.0.dev202604240307"
 description = "Evaluation module for Ragbits components"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -32,7 +32,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "optuna>=4.0.0,<5.0.0", "distilabel>=1.5.0,<2.0.0", "datasets>=3.0.1,<4.0.0", "ragbits-core==1.7.0.dev202604150306"]
+dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "optuna>=4.0.0,<5.0.0", "distilabel>=1.5.0,<2.0.0", "datasets>=3.0.1,<4.0.0", "ragbits-core==1.7.0.dev202604240307"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
@@ -42,10 +42,10 @@ dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "o
 
 [project.optional-dependencies]
 agents = [
-    "ragbits-agents==1.7.0.dev202604150306",
+    "ragbits-agents==1.7.0.dev202604240307",
 ]
 document-search = [
-    "ragbits-document-search==1.7.0.dev202604150306",
+    "ragbits-document-search==1.7.0.dev202604240307",
 ]
 relari = [
     "continuous-eval>=0.3.12,<1.0.0",
```

**File**: `packages/ragbits-guardrails/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-guardrails"
-version = "1.7.0.dev202604150306"
+version = "1.7.0.dev202604240307"
 description = "Guardrails module for Ragbits components"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-core==1.7.0.dev202604150306"]
+dependencies = ["ragbits-core==1.7.0.dev202604240307"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits/pyproject.toml` (modified, +28/-28)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits"
-version = "1.7.0.dev202604150306"
+version = "1.7.0.dev202604240307"
 description = "Building blocks for rapid development of GenAI applications"
 dynamic = ["readme"]
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-agents==1.7.0.dev202604150306","ragbits-document-search==1.7.0.dev202604150306", "ragbits-cli==1.7.0.dev202604150306", "ragbits-evaluate==1.7.0.dev202604150306", "ragbits-guardrails==1.7.0.dev202604150306", "ragbits-chat==1.7.0.dev202604150306", "ragbits-core==1.7.0.dev202604150306"]
+dependencies = ["ragbits-agents==1.7.0.dev202604240307","ragbits-document-search==1.7.0.dev202604240307", "ragbits-cli==1.7.0.dev202604240307", "ragbits-evaluate==1.7.0.dev202604240307", "ragbits-guardrails==1.7.0.dev202604240307", "ragbits-chat==1.7.0.dev202604240307", "ragbits-core==1.7.0.dev202604240307"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
@@ -41,80 +41,80 @@ dependencies = ["ragbits-agents==1.7.0.dev202604150306","ragbits-document-search
 
 [project.optional-dependencies]
 openai = [
-    "ragbits-guardrails[openai]==1.7.0.dev202604150306",
-    "ragbits-agents[openai]==1.7.0.dev202604150306",
+    "ragbits-guardrails[openai]==1.7.0.dev202604240307",
+    "ragbits-agents[openai]==1.7.0.dev202604240307",
 ]
 chroma = [
-    "ragbits-core[chroma]==1.7.0.dev202604150306",
+    "ragbits-core[chroma]==1.7.0.dev202604240307",
 ]
 local = [
-    "ragbits-core[local]==1.7.0.dev202604150306",
+    "ragbits-core[local]==1.7.0.dev202604240307",
 ]
 fastembed = [
-    "ragbits-core[fastembed]==1.7.0.dev202604150306",
+    "ragbits-core[fastembed]==1.7.0.dev202604240307",
 ]
 promptfoo = [
-    "ragbits-core[promptfoo]==1.7.0.dev202604150306",
+    "ragbits-core[promptfoo]==1.7.0.dev202604240307",
 ]
 otel = [
-    "ragbits-core[otel]==1.7.0.dev202604150306",
+    "ragbits-core[otel]==1.7.0.dev202604240307",
 ]
 logfire = [
-    "ragbits-core[logfire]==1.7.0.dev202604150306",
+    "ragbits-core[logfire]==1.7.0.dev202604240307",
 ]
 qdrant = [
-    "ragbits-core[qdrant]==1.7.0.dev202604150306",
+    "ragbits-core[qdrant]==1.7.0.dev202604240307",
 ]
 pgvector = [
-    "ragbits-core[pgvector]==1.7.0.dev202604150306",
+    "ragbits-core[pgvector]==1.7.0.dev202604240307",
 ]
 fastembed-gpu = [
-    "ragbits-core[fastembed-gpu]==1.7.0.dev202604150306",
+    "ragbits-core[fastembed-gpu]==1.7.0.dev202604240307",
 ]
 azure = [
-    "ragbits-core[azure]==1.7.0.dev202604150306",
+    "ragbits-core[azure]==1.7.0.dev202604240307",
 ]
 gcs = [
-    "ragbits-core[gcs]==1.7.0.dev202604150306",
+    "ragbits-core[gcs]==1.7.0.dev202604240307",
 ]
 hf = [
-    "ragbits-core[hf]==1.7.0.dev202604150306",
+    "ragbits-core[hf]==1.7.0.dev202604240307",
 ]
 s3 = [
-    "ragbits-core[s3]==1.7.0.dev202604150306",
+    "ragbits-core[s3]==1.7.0.dev202604240307",
 ]
 google_drive = [
-    "ragbits-core[google_drive]==1.7.0.dev202604150306",
+    "ragbits-core[google_drive]==1.7.0.dev202604240307",
 ]
 weaviate = [
-    "ragbits-core[weaviate]==1.7.0.dev202604150306",
+    "ragbits-core[weaviate]==1.7.0.dev202604240307",
 ]
 agents = [
-    "ragbits-evaluate[agents]==1.7.0.dev202604150306",
+    "ragbits-evaluate[agents]==1.7.0.dev202604240307",
 ]
 document-search = [
-    "ragbits-evaluate[document-search]==1.7.0.dev202604150306",
+    "ragbits-evaluate[document-search]==1.7.0.dev202604240307",
 ]
 relari = [
-    "ragbits-evaluate[relari]==1.7.0.dev202604150306",
+    "ragbits-evaluate[relari]==1.7.0.dev202604240307",
 ]
 a2a = [
-    "ragbits-agents[a2a]==1.7.0.dev202604150306",
+    "ragbits-agents[a2a]==1.7.0.dev202604240307",
 ]
 mcp = [
-    "ragbits-agents[mcp]==1.7.0.dev202604150306",
+    "ragbits-agents[mcp]==1.7.0.dev202604240307",
 ]
 cli = [
-    "ragbits-agents[cli]==1.7.0.dev202604150306",
+    "ragbits-agents[cli]==1.7.0.dev202604240307",
 ]
 unstructured = [
-    "ragbits-document-search[unstructured]==1.7.0.dev202604150306",
+    "ragbits-document-search[unstructured]==1.7.0.dev202604240307",
 ]
 ray = [
-    "ragbits-document-search[ray]==1.7.0.dev202604150306",
+    "ragbits-document-search[ray]==1.7.0.dev202604240307",
 ]
 sql = [
-    "ragbits-chat[sql]==1.7.0.dev202604150306",
+    "ragbits-chat[sql]==1.7.0.dev202604240307",
 ]
 
 [build-system]
```

---

### Incident Patch 5: `5f5b15e9` (2026-04-24)
**Commit Message**: Automated UI build

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/AuthGuard-CoMO0eC0.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{r as h,j as e,aW as c,aw as p,c as S,bo as x,bp as l,bq as d,br as m,bs as b}from"./index-OlGgRGK4.js";import{a}from"./authStore-cPLtw9rA.js";import{u as j}from"./useInitializeUserStore-Bb7NZ1Qv.js";const v=h.createContext(null);function y({children:t}){const[o]=h.useState(()=>a);return e.jsx(v.Provider,{value:o,children:t})}function U(){const{logout:t,login:o,setHydrated:u}=c(a,f=>f),i=j(),n=p(),s=S("/api/user"),g=x();return h.useEffect(()=>{(async()=>{try{const r=await s.call();r?(o(r),i?i(r.user_id):console.error("Failed to initialize store for user, initializeUserStore() is not defined. Check current HistoryStoreContextProvider implementation."),g.pathname==="/login"&&n("/")):t()}catch(r){console.error("Failed to check session:",r),t(),n("/login")}finally{u()}})()},[]),null}function P({children:t}){const o=x(),u=c(a,s=>s.isAuthenticated),i=c(a,s=>s.hasHydrated),n=c(a,s=>s.logout);return i?o.pathname==="/login"?e.jsx(l,{baseUrl:d,auth:{credentials:"include"},children:t}):u?e.jsx(y,{children:e.jsx(l,{baseUrl:d,auth:{onUnauthorized:n,credentials:"include"},children:t})}):e.jsx(b,{to:"/login",replace:!0}):e.jsxs(l,{baseUrl:d,auth:{credentials:"include"},children:[e.jsx(U,{}),e.jsx(m,{})]})}export{P as default};
+import{r as h,j as e,aW as c,aw as p,c as S,bo as x,bp as l,bq as d,br as m,bs as b}from"./index-Be6O1iVd.js";import{a}from"./authStore-DX4sLJ2o.js";import{u as j}from"./useInitializeUserStore-BqNjwnPQ.js";const v=h.createContext(null);function y({children:t}){const[o]=h.useState(()=>a);return e.jsx(v.Provider,{value:o,children:t})}function U(){const{logout:t,login:o,setHydrated:u}=c(a,f=>f),i=j(),n=p(),s=S("/api/user"),g=x();return h.useEffect(()=>{(async()=>{try{const r=await s.call();r?(o(r),i?i(r.user_id):console.error("Failed to initialize store for user, initializeUserStore() is not defined. Check current HistoryStoreContextProvider implementation."),g.pathname==="/login"&&n("/")):t()}catch(r){console.error("Failed to check session:",r),t(),n("/login")}finally{u()}})()},[]),null}function P({children:t}){const o=x(),u=c(a,s=>s.isAuthenticated),i=c(a,s=>s.hasHydrated),n=c(a,s=>s.logout);return i?o.pathname==="/login"?e.jsx(l,{baseUrl:d,auth:{credentials:"include"},children:t}):u?e.jsx(y,{children:e.jsx(l,{baseUrl:d,auth:{onUnauthorized:n,credentials:"include"},children:t})}):e.jsx(b,{to:"/login",replace:!0}):e.jsxs(l,{baseUrl:d,auth:{credentials:"include"},children:[e.jsx(U,{}),e.jsx(m,{})]})}export{P as default};
```

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/ChatHistory-B32DGMwk.js` (renamed, +2/-2)
```diff
@@ -1,2 +1,2 @@
-const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-BYDHw0h8.js","assets/index-OlGgRGK4.js","assets/index-CwtSwCGi.css"])))=>i.map(i=>d[i]);
-import{r as P,t as ae,k as Xe,Z as W,az as Me,$ as Ze,j as t,q as me,L as xe,n as ye,T as Pe,_ as Ye,s as et,v as R,V as tt,d as X,l as se,aq as Ie,o as ot,H as ke,a9 as rt,J as Ne,aA as at,ac as pe,U as st,X as _e,af as he,aB as nt,aC as lt,ag as it,K as dt,O as be,Q as ct,W as ut,a0 as pt,ah as ft,a2 as K,a3 as Ae,ai as vt,R as ht,aD as bt,a8 as gt,aE as mt,aF as xt,a5 as yt,a as Pt,aw as Ct,i as fe,aG as Ce,aH as ve,D as we,I as Q,as as wt,aI as $t,ay as $e}from"./index-OlGgRGK4.js";import{u as jt,b as St,c as je,d as Dt,e as Mt,m as It,$ as kt,a as Nt}from"./useMenuTriggerState-CdA3WcyE.js";import{$ as _t}from"./useSelectableItem-DYUjiw5b.js";import{i as At}from"./chunk-SSA7SXE4-C1Frnya0.js";var Ot=(e,r)=>{var n;let s=[];const a=(n=P.Children.map(e,d=>P.isValidElement(d)&&d.type===r?(s.push(d),null):d))==null?void 0:n.filter(Boolean),u=s.length>=0?s:void 0;return[a,u]},Ft=ae({base:["w-full","p-1","min-w-[200px]"]});ae({slots:{base:["flex","group","gap-2","items-center","justify-between","relative","px-2","py-1.5","w-full","h-full","box-border","rounded-small","outline-hidden","cursor-pointer","tap-highlight-transparent","data-[pressed=true]:opacity-70",...Xe,"data-[focus-visible=true]:dark:ring-offset-background-content1"],wrapper:"w-full flex flex-col items-start justify-center",title:"flex-1 text-small font-normal truncate",description:["w-full","text-tiny","text-foreground-500","group-hover:text-current"],selectedIcon:["text-inherit","w-3","h-3","shrink-0"],shortcut:["px-1","py-0.5","rounded-sm","font-sans","text-foreground-500","text-tiny","border-small","border-default-300","group-hover:border-current"]},variants:{variant:{solid:{base:""},bordered:{base:"border-medium border-transparent bg-transparent"},light:{base:"bg-transparent"},faded:{base:"border-small border-transparent hover:border-default data-[hover=true]:bg-default-100"},flat:{base:""},shadow:{base:"data-[hover=true]:shadow-lg"}},color:{default:{},primary:{},secondary:{},success:{},warning:{},danger:{}},isDisabled:{true:{base:"opacity-disabled pointer-events-none"}},disableAnimation:{true:{},false:{}}},defaultVariants:{variant:"solid",color:"default"},compoundVariants:[{variant:"solid",color:"default",class:{base:"data-[hover=true]:bg-default data-[hover=true]:text-default-foreground"}},{variant:"solid",color:"primary",class:{base:"data-[hover=true]:bg-primary data-[hover=true]:text-primary-foreground"}},{variant:"solid",color:"secondary",class:{base:"data-[hover=true]:bg-secondary data-[hover=true]:text-secondary-foreground"}},{variant:"solid",color:"success",class:{base:"data-[hover=true]:bg-success data-[hover=true]:text-success-foreground"}},{variant:"solid",color:"warning",class:{base:"data-[hover=true]:bg-warning data-[hover=true]:text-warning-foreground"}},{variant:"solid",color:"danger",class:{base:"data-[hover=true]:bg-danger data-[hover=true]:text-danger-foreground"}},{variant:"shadow",color:"default",class:{base:"data-[hover=true]:shadow-default/50 data-[hover=true]:bg-default data-[hover=true]:text-default-foreground"}},{variant:"shadow",color:"primary",class:{base:"data-[hover=true]:shadow-primary/30 data-[hover=true]:bg-primary data-[hover=true]:text-primary-foreground"}},{variant:"shadow",color:"secondary",class:{base:"data-[hover=true]:shadow-secondary/30 data-[hover=true]:bg-secondary data-[hover=true]:text-secondary-foreground"}},{variant:"shadow",color:"success",class:{base:"data-[hover=true]:shadow-success/30 data-[hover=true]:bg-success data-[hover=true]:text-success-foreground"}},{variant:"shadow",color:"warning",class:{base:"data-[hover=true]:shadow-warning/30 data-[hover=true]:bg-warning data-[hover=true]:text-warning-foreground"}},{variant:"shadow",color:"danger",class:{base:"data-[hover=true]:shadow-danger/30 data-[hover=true]:bg-danger data-[hover=true]:text-danger-foreground"}},{variant:"bordered",color:"default",class:{base:"data-[hover=true]:border-default"}},{variant:"bordered",color:"primary",class:{base:"data-[hover=true]:border-primary data-[hover=true]:text-primary"}},{variant:"bordered",color:"secondary",class:{base:"data-[hover=true]:border-secondary data-[hover=true]:text-secondary"}},{variant:"bordered",color:"success",class:{base:"data-[hover=true]:border-success data-[hover=true]:text-success"}},{variant:"bordered",color:"warning",class:{base:"data-[hover=true]:border-warning data-[hover=true]:text-warning"}},{variant:"bordered",color:"danger",class:{base:"data-[hover=true]:border-danger data-[hover=true]:text-danger"}},{variant:"flat",color:"default",class:{base:"data-[hover=true]:bg-default/40 data-[hover=true]:text-default-foreground"}},{variant:"flat",color:"primary",class:{base:"data-[hover=true]:bg-primary/20 data-[hover=true]:text-primary"}},{variant:"flat",color:"secondary",class:{base:"data-[hover=true]:bg-seconda
```

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/ChatOptionsForm-DBuZluwC.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{g as z,r as f,u as ie,h as ce,a as ue,i as le,b as fe,p as Y,C as Q,j as l,D as de,d as A,I as me,m as ge,e as he,f as pe}from"./index-OlGgRGK4.js";import{g as Z,v as W,F as ve,t as be}from"./index-Cu4AtYtU.js";import{m as Se}from"./chunk-IGSAU2ZA-q02-faRT.js";import"./chunk-SSA7SXE4-C1Frnya0.js";import"./useMenuTriggerState-CdA3WcyE.js";import"./useSelectableItem-DYUjiw5b.js";import"./index-CbkNIwGe.js";var B,V;function xe(){if(V)return B;V=1;var n="Expected a function",t=NaN,s="[object Symbol]",m=/^\s+|\s+$/g,g=/^[-+]0x[0-9a-f]+$/i,h=/^0b[01]+$/i,i=/^0o[0-7]+$/i,b=parseInt,S=typeof z=="object"&&z&&z.Object===Object&&z,y=typeof self=="object"&&self&&self.Object===Object&&self,C=S||y||Function("return this")(),d=Object.prototype,r=d.toString,c=Math.max,O=Math.min,E=function(){return C.Date.now()};function $(e,u,v){var T,L,P,I,p,j,R=0,G=!1,D=!1,k=!0;if(typeof e!="function")throw new TypeError(n);u=q(u)||0,_(v)&&(G=!!v.leading,D="maxWait"in v,P=D?c(q(v.maxWait)||0,u):P,k="trailing"in v?!!v.trailing:k);function H(o){var x=T,F=L;return T=L=void 0,R=o,I=e.apply(F,x),I}function re(o){return R=o,p=setTimeout(N,u),G?H(o):I}function oe(o){var x=o-j,F=o-R,X=u-x;return D?O(X,P-F):X}function U(o){var x=o-j,F=o-R;return j===void 0||x>=u||x<0||D&&F>=P}function N(){var o=E();if(U(o))return K(o);p=setTimeout(N,oe(o))}function K(o){return p=void 0,k&&T?H(o):(T=L=void 0,I)}function se(){p!==void 0&&clearTimeout(p),R=0,T=j=L=p=void 0}function ae(){return p===void 0?I:K(E())}function M(){var o=E(),x=U(o);if(T=arguments,L=this,j=o,x){if(p===void 0)return re(j);if(D)return p=setTimeout(N,u),H(j)}return p===void 0&&(p=setTimeout(N,u)),I}return M.cancel=se,M.flush=ae,M}function _(e){var u=typeof e;return!!e&&(u=="object"||u=="function")}function a(e){return!!e&&typeof e=="object"}function w(e){return typeof e=="symbol"||a(e)&&r.call(e)==s}function q(e){if(typeof e=="number")return e;if(w(e))return t;if(_(e)){var u=typeof e.valueOf=="function"?e.valueOf():e;e=_(u)?u+"":u}if(typeof e!="string")return e===0?e:+e;e=e.replace(m,"");var v=h.test(e);return v||i.test(e)?b(e.slice(2),v?2:8):g.test(e)?t:+e}return B=$,B}xe();var ne=typeof window<"u"?f.useLayoutEffect:f.useEffect;function ee(n,t,s,m){const g=f.useRef(t);ne(()=>{g.current=t},[t]),f.useEffect(()=>{const h=window;if(!(h&&h.addEventListener))return;const i=b=>{g.current(b)};return h.addEventListener(n,i,m),()=>{h.removeEventListener(n,i,m)}},[n,s,m])}function te(n){const t=f.useRef(()=>{throw new Error("Cannot call an event handler while rendering.")});return ne(()=>{t.current=n},[n]),f.useCallback((...s)=>{var m;return(m=t.current)==null?void 0:m.call(t,...s)},[t])}var J=typeof window>"u";function ye(n,t,s={}){const{initializeWithValue:m=!0}=s,g=f.useCallback(r=>s.serializer?s.serializer(r):JSON.stringify(r),[s]),h=f.useCallback(r=>{if(s.deserializer)return s.deserializer(r);if(r==="undefined")return;const c=t instanceof Function?t():t;let O;try{O=JSON.parse(r)}catch(E){return console.error("Error parsing JSON:",E),c}return O},[s,t]),i=f.useCallback(()=>{const r=t instanceof Function?t():t;if(J)return r;try{const c=window.localStorage.getItem(n);return c?h(c):r}catch(c){return console.warn(`Error reading localStorage key “${n}”:`,c),r}},[t,n,h]),[b,S]=f.useState(()=>m?i():t instanceof Function?t():t),y=te(r=>{J&&console.warn(`Tried setting localStorage key “${n}” even though environment is not a client`);try{const c=r instanceof Function?r(i()):r;window.localStorage.setItem(n,g(c)),S(c),window.dispatchEvent(new StorageEvent("local-storage",{key:n}))}catch(c){console.warn(`Error setting localStorage key “${n}”:`,c)}}),C=te(()=>{J&&console.warn(`Tried removing localStorage key “${n}” even though environment is not a client`);const r=t instanceof Function?t():t;window.localStorage.removeItem(n),S(r),window.dispatchEvent(new StorageEvent("local-storage",{key:n}))});f.useEffect(()=>{S(i())},[n]);const d=f.useCallback(r=>{r.key&&r.key!==n||S(i())},[n,i]);return ee("storage",d),ee("local-storage",d),[b,y,C]}const Ce="ragbits-no-history-chat-options";function Le(){const{isOpen:n,onOpen:t,onClose:s}=ie(),m=ce(a=>a.chatOptions),g=f.useRef(null),{setConversationProperties:h,initializeChatOptions:i}=ue(),b=le(a=>a.currentConversation),{config:{user_settings:S}}=fe(),[y,C]=ye(Ce,null),d=S?.form,r=a=>{Y.isPluginActivated(Q.name)||C(a)},c=()=>{t()},O=(a,w)=>{w.preventDefault(),g.current=a.formData,s()},E=()=>{if(!d)return;const a=Z(W,d);g.current=a,s()},$=()=>{s()},_=a=>{if(a!=="exit"||!g.current)return;const w=g.current;h(b,{chatOptions:w}),r(w),g.current=null};return f.useEffect(()=>{if(!d)return;const a=Z(W,d);Y.isPluginActivated(Q.name)?i(a):y!==null?i(y):(i(a),C(a))},[i,d,b,y,C]),d?l.jsxs(l.Fragment,{children:[l.jsx(de,{content:"Chat Options",placement:"bottom",children:l.jsx(A,{isIconOnly:!0,variant:"ghost",className:"p-0","aria-label":"Open chat options",onPress:c,"data-testid":"open-chat-options",children:l.jsx(me,{icon:"heroicons:cog-6-tooth"})})}),l.jsx(ge,{isOpen
```

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/CredentialsLogin-DQf8u3KV.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{r as c,c as x,aW as w,aw as S,j as t,aq as b,aH as j,d as v,bm as C}from"./index-OlGgRGK4.js";import{a as P}from"./authStore-cPLtw9rA.js";import{u as q}from"./useInitializeUserStore-Bb7NZ1Qv.js";import{i as m}from"./chunk-SSA7SXE4-C1Frnya0.js";function E(){const[s,p]=c.useState({username:"",password:""}),l=x("/api/auth/login",{headers:{"Content-Type":"application/json"},method:"POST"}),f=w(P,e=>e.login),g=S(),u=q(),[y,o]=c.useState(!1),h=async e=>{o(!1),e.preventDefault(),e.stopPropagation();const r=new FormData(e.currentTarget),n=r.get("username"),i=r.get("password");try{const a=await l.call({body:{username:n,password:i}});if(!a.success||!a.user){o(!0);return}f(a.user),u?u(a.user.user_id):console.error("Failed to initialize store for user, initializeUserStore() is not defined. Check current HistoryStoreContextProvider implementation."),g("/")}catch(a){console.error("Failed to login",a),o(!0)}},d=e=>r=>p(n=>C(n,i=>{i[e]=r.target.value}));return t.jsxs("form",{className:"flex w-full flex-col gap-4",onSubmit:h,children:[t.jsx(m,{label:"Username",name:"username",labelPlacement:"outside",placeholder:"Your username",required:!0,isRequired:!0,value:s.username,onChange:d("username")}),t.jsx(m,{label:"Password",labelPlacement:"outside",id:"password",name:"password",type:"password",placeholder:"••••••••",required:!0,isRequired:!0,value:s.password,onChange:d("password")}),t.jsx(b,{children:y&&!l.isLoading&&t.jsx(j.div,{className:"text-small text-danger",initial:{opacity:0,y:-10},animate:{opacity:1,y:0},exit:{opacity:0,y:-10},transition:{duration:.3,ease:"easeOut"},children:"We couldn't sign you in. Please verify your credentials and try again."})}),t.jsx(v,{type:"submit",color:s.password&&s.username?"primary":"default",children:"Sign in"})]})}export{E as default};
+import{r as c,c as x,aW as w,aw as S,j as t,aq as b,aH as j,d as v,bm as C}from"./index-Be6O1iVd.js";import{a as P}from"./authStore-DX4sLJ2o.js";import{u as q}from"./useInitializeUserStore-BqNjwnPQ.js";import{i as m}from"./chunk-SSA7SXE4-C3U6kJ4J.js";function E(){const[s,p]=c.useState({username:"",password:""}),l=x("/api/auth/login",{headers:{"Content-Type":"application/json"},method:"POST"}),f=w(P,e=>e.login),g=S(),u=q(),[y,o]=c.useState(!1),h=async e=>{o(!1),e.preventDefault(),e.stopPropagation();const r=new FormData(e.currentTarget),n=r.get("username"),i=r.get("password");try{const a=await l.call({body:{username:n,password:i}});if(!a.success||!a.user){o(!0);return}f(a.user),u?u(a.user.user_id):console.error("Failed to initialize store for user, initializeUserStore() is not defined. Check current HistoryStoreContextProvider implementation."),g("/")}catch(a){console.error("Failed to login",a),o(!0)}},d=e=>r=>p(n=>C(n,i=>{i[e]=r.target.value}));return t.jsxs("form",{className:"flex w-full flex-col gap-4",onSubmit:h,children:[t.jsx(m,{label:"Username",name:"username",labelPlacement:"outside",placeholder:"Your username",required:!0,isRequired:!0,value:s.username,onChange:d("username")}),t.jsx(m,{label:"Password",labelPlacement:"outside",id:"password",name:"password",type:"password",placeholder:"••••••••",required:!0,isRequired:!0,value:s.password,onChange:d("password")}),t.jsx(b,{children:y&&!l.isLoading&&t.jsx(j.div,{className:"text-small text-danger",initial:{opacity:0,y:-10},animate:{opacity:1,y:0},exit:{opacity:0,y:-10},transition:{duration:.3,ease:"easeOut"},children:"We couldn't sign you in. Please verify your credentials and try again."})}),t.jsx(v,{type:"submit",color:s.password&&s.username?"primary":"default",children:"Sign in"})]})}export{E as default};
```

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/FeedbackForm-4ocPbX4e.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{u as g,a as v,b as C,r as T,F as t,c as _,j as e,D as f,d as r,I as b,m as I,e as w,f as D}from"./index-OlGgRGK4.js";import{F as O,t as R,v as S}from"./index-Cu4AtYtU.js";import{m as E}from"./chunk-IGSAU2ZA-q02-faRT.js";import"./chunk-SSA7SXE4-C1Frnya0.js";import"./useMenuTriggerState-CdA3WcyE.js";import"./useSelectableItem-DYUjiw5b.js";import"./index-CbkNIwGe.js";function z({message:s}){const{isOpen:h,onOpen:p,onClose:l}=g(),{mergeExtensions:c}=v(),{config:{feedback:o}}=C(),n=T.useRef(t.Like),k=_("/api/feedback",{headers:{"Content-Type":"application/json"},method:"POST"});if(!s.serverId)return null;const i=o[n.current].form,x=()=>{l()},d=async(a,y)=>{if(!s.serverId)throw new Error('Feedback is only available for messages with "serverId" set');try{await k.call({body:{message_id:s.serverId,feedback:y??n.current,payload:a??{}}})}catch(F){console.error(F)}},j=a=>{c(s.id,{feedbackType:n.current}),d(a.formData),l()},m=async a=>{if(n.current=a,o[a].form===null){c(s.id,{feedbackType:a}),await d(null,a);return}p()},u=s.extensions?.feedbackType;return e.jsxs(e.Fragment,{children:[o.like.enabled&&e.jsx(f,{content:"Like",placement:"bottom",children:e.jsx(r,{isIconOnly:!0,variant:"ghost",className:"p-0","aria-label":"Rate message as helpful",onPress:()=>m(t.Like),"data-testid":"feedback-like",children:e.jsx(b,{icon:u===t.Like?"heroicons:hand-thumb-up-solid":"heroicons:hand-thumb-up"})})}),o.dislike.enabled&&e.jsx(f,{content:"Dislike",placement:"bottom",children:e.jsx(r,{isIconOnly:!0,variant:"ghost",className:"p-0","aria-label":"Rate message as unhelpful",onPress:()=>m(t.Dislike),"data-testid":"feedback-dislike",children:e.jsx(b,{icon:u===t.Dislike?"heroicons:hand-thumb-down-solid":"heroicons:hand-thumb-down"})})}),i&&e.jsx(I,{isOpen:h,onOpenChange:x,children:e.jsx(w,{children:a=>e.jsxs(e.Fragment,{children:[e.jsx(E,{className:"text-default-900 flex flex-col gap-1",children:i.title}),e.jsx(D,{children:e.jsx("div",{className:"flex flex-col gap-4",children:e.jsx(O,{schema:i,validator:S,onSubmit:j,transformErrors:R,liveValidate:!0,children:e.jsxs("div",{className:"flex justify-end gap-4 py-4",children:[e.jsx(r,{color:"danger",variant:"light",onPress:a,"aria-label":"Close feedback form",children:"Cancel"}),e.jsx(r,{color:"primary",type:"submit","aria-label":"Submit feedback","data-testid":"feedback-submit",children:"Submit"})]})})})})]})})})]})}export{z as default};
+import{u as g,a as v,b as C,r as T,F as t,c as _,j as e,D as f,d as r,I as b,m as I,e as w,f as D}from"./index-Be6O1iVd.js";import{F as O,t as R,v as S}from"./index-BSfI8fMz.js";import{m as E}from"./chunk-IGSAU2ZA-C95SHugN.js";import"./chunk-SSA7SXE4-C3U6kJ4J.js";import"./useMenuTriggerState-CF7Kywot.js";import"./useSelectableItem-DLYBSIKg.js";import"./index-DImPjBZJ.js";function z({message:s}){const{isOpen:h,onOpen:p,onClose:l}=g(),{mergeExtensions:c}=v(),{config:{feedback:o}}=C(),n=T.useRef(t.Like),k=_("/api/feedback",{headers:{"Content-Type":"application/json"},method:"POST"});if(!s.serverId)return null;const i=o[n.current].form,x=()=>{l()},d=async(a,y)=>{if(!s.serverId)throw new Error('Feedback is only available for messages with "serverId" set');try{await k.call({body:{message_id:s.serverId,feedback:y??n.current,payload:a??{}}})}catch(F){console.error(F)}},j=a=>{c(s.id,{feedbackType:n.current}),d(a.formData),l()},m=async a=>{if(n.current=a,o[a].form===null){c(s.id,{feedbackType:a}),await d(null,a);return}p()},u=s.extensions?.feedbackType;return e.jsxs(e.Fragment,{children:[o.like.enabled&&e.jsx(f,{content:"Like",placement:"bottom",children:e.jsx(r,{isIconOnly:!0,variant:"ghost",className:"p-0","aria-label":"Rate message as helpful",onPress:()=>m(t.Like),"data-testid":"feedback-like",children:e.jsx(b,{icon:u===t.Like?"heroicons:hand-thumb-up-solid":"heroicons:hand-thumb-up"})})}),o.dislike.enabled&&e.jsx(f,{content:"Dislike",placement:"bottom",children:e.jsx(r,{isIconOnly:!0,variant:"ghost",className:"p-0","aria-label":"Rate message as unhelpful",onPress:()=>m(t.Dislike),"data-testid":"feedback-dislike",children:e.jsx(b,{icon:u===t.Dislike?"heroicons:hand-thumb-down-solid":"heroicons:hand-thumb-down"})})}),i&&e.jsx(I,{isOpen:h,onOpenChange:x,children:e.jsx(w,{children:a=>e.jsxs(e.Fragment,{children:[e.jsx(E,{className:"text-default-900 flex flex-col gap-1",children:i.title}),e.jsx(D,{children:e.jsx("div",{className:"flex flex-col gap-4",children:e.jsx(O,{schema:i,validator:S,onSubmit:j,transformErrors:R,liveValidate:!0,children:e.jsxs("div",{className:"flex justify-end gap-4 py-4",children:[e.jsx(r,{color:"danger",variant:"light",onPress:a,"aria-label":"Close feedback form",children:"Cancel"}),e.jsx(r,{color:"primary",type:"submit","aria-label":"Submit feedback","data-testid":"feedback-submit",children:"Submit"})]})})})})]})})})]})}export{z as default};
```

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/Login-DKYXCjKW.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{r as s,j as e}from"./index-OlGgRGK4.js";function n({children:t}){return s.useEffect(()=>{document.title="Login"},[]),e.jsx("div",{className:"flex h-screen w-screen",children:e.jsxs("div",{className:"rounded-medium border-small border-divider m-auto flex w-full max-w-xs flex-col gap-4 p-4",children:[e.jsxs("div",{className:"text-small",children:[e.jsx("div",{className:"text-foreground truncate leading-5 font-semibold",children:"Sign in"}),e.jsx("div",{className:"text-default-500 truncate leading-5 font-normal",children:"Sign in to start chatting."})]}),t]})})}export{n as default};
+import{r as s,j as e}from"./index-Be6O1iVd.js";function n({children:t}){return s.useEffect(()=>{document.title="Login"},[]),e.jsx("div",{className:"flex h-screen w-screen",children:e.jsxs("div",{className:"rounded-medium border-small border-divider m-auto flex w-full max-w-xs flex-col gap-4 p-4",children:[e.jsxs("div",{className:"text-small",children:[e.jsx("div",{className:"text-foreground truncate leading-5 font-semibold",children:"Sign in"}),e.jsx("div",{className:"text-default-500 truncate leading-5 font-normal",children:"Sign in to start chatting."})]}),t]})})}export{n as default};
```

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/LogoutButton-CLxY8Frn.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{c,aW as a,aw as l,j as o,D as g,d,I as h}from"./index-OlGgRGK4.js";import{a as s}from"./authStore-cPLtw9rA.js";function m(){const n=c("/api/auth/logout",{headers:{"Content-Type":"application/json"},method:"POST"}),r=a(s,t=>t.logout),u=a(s,t=>t.isAuthenticated),e=l(),i=async()=>{if(!u){e("/login");return}try{if(!(await n.call()).success)return;r(),e("/login")}catch(t){console.error("Failed to logout",t)}};return o.jsx(g,{content:"Logout",placement:"bottom",children:o.jsx(d,{isIconOnly:!0,"aria-label":"Logout",variant:"ghost",onPress:i,"data-testid":"logout-button",children:o.jsx(h,{icon:"heroicons:arrow-left-start-on-rectangle"})})})}export{m as default};
+import{c,aW as a,aw as l,j as o,D as g,d,I as h}from"./index-Be6O1iVd.js";import{a as s}from"./authStore-DX4sLJ2o.js";function m(){const n=c("/api/auth/logout",{headers:{"Content-Type":"application/json"},method:"POST"}),r=a(s,t=>t.logout),u=a(s,t=>t.isAuthenticated),e=l(),i=async()=>{if(!u){e("/login");return}try{if(!(await n.call()).success)return;r(),e("/login")}catch(t){console.error("Failed to logout",t)}};return o.jsx(g,{content:"Logout",placement:"bottom",children:o.jsx(d,{isIconOnly:!0,"aria-label":"Logout",variant:"ghost",onPress:i,"data-testid":"logout-button",children:o.jsx(h,{icon:"heroicons:arrow-left-start-on-rectangle"})})})}export{m as default};
```

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/OAuth2Login-BaGretpd.js` (renamed, +1/-1)
```diff
@@ -1,2 +1,2 @@
-import{ar as An,r as K,c as Sn,j as le,aq as Rn,aH as yn,d as On}from"./index-OlGgRGK4.js";var $e,Ct;function Nt(){if(Ct)return $e;Ct=1;const{entries:Z,setPrototypeOf:M,isFrozen:w,getPrototypeOf:Oe,getOwnPropertyDescriptor:ce}=Object;let{freeze:T,seal:y,create:x}=Object,{apply:z,construct:G}=typeof Reflect<"u"&&Reflect;T||(T=function(o){return o}),y||(y=function(o){return o}),z||(z=function(o,l){for(var r=arguments.length,c=new Array(r>2?r-2:0),O=2;O<r;O++)c[O-2]=arguments[O];return o.apply(l,c)}),G||(G=function(o){for(var l=arguments.length,r=new Array(l>1?l-1:0),c=1;c<l;c++)r[c-1]=arguments[c];return new o(...r)});const W=A(Array.prototype.forEach),ue=A(Array.prototype.lastIndexOf),fe=A(Array.prototype.pop),b=A(Array.prototype.push),wt=A(Array.prototype.splice),me=A(String.prototype.toLowerCase),De=A(String.prototype.toString),be=A(String.prototype.match),J=A(String.prototype.replace),xt=A(String.prototype.indexOf),Pt=A(String.prototype.trim),L=A(Object.prototype.hasOwnProperty),g=A(RegExp.prototype.test),Q=vt(TypeError);function A(s){return function(o){o instanceof RegExp&&(o.lastIndex=0);for(var l=arguments.length,r=new Array(l>1?l-1:0),c=1;c<l;c++)r[c-1]=arguments[c];return z(s,o,r)}}function vt(s){return function(){for(var o=arguments.length,l=new Array(o),r=0;r<o;r++)l[r]=arguments[r];return G(s,l)}}function a(s,o){let l=arguments.length>2&&arguments[2]!==void 0?arguments[2]:me;M&&M(s,null);let r=o.length;for(;r--;){let c=o[r];if(typeof c=="string"){const O=l(c);O!==c&&(w(o)||(o[r]=O),c=O)}s[c]=!0}return s}function kt(s){for(let o=0;o<s.length;o++)L(s,o)||(s[o]=null);return s}function I(s){const o=x(null);for(const[l,r]of Z(s))L(s,l)&&(Array.isArray(r)?o[l]=kt(r):r&&typeof r=="object"&&r.constructor===Object?o[l]=I(r):o[l]=r);return o}function ee(s,o){for(;s!==null;){const r=ce(s,o);if(r){if(r.get)return A(r.get);if(typeof r.value=="function")return A(r.value)}s=Oe(s)}function l(){return null}return l}const Ve=T(["a","abbr","acronym","address","area","article","aside","audio","b","bdi","bdo","big","blink","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","content","data","datalist","dd","decorator","del","details","dfn","dialog","dir","div","dl","dt","element","em","fieldset","figcaption","figure","font","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","img","input","ins","kbd","label","legend","li","main","map","mark","marquee","menu","menuitem","meter","nav","nobr","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","search","section","select","shadow","slot","small","source","spacer","span","strike","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","track","tt","u","ul","var","video","wbr"]),Le=T(["svg","a","altglyph","altglyphdef","altglyphitem","animatecolor","animatemotion","animatetransform","circle","clippath","defs","desc","ellipse","enterkeyhint","exportparts","filter","font","g","glyph","glyphref","hkern","image","inputmode","line","lineargradient","marker","mask","metadata","mpath","part","path","pattern","polygon","polyline","radialgradient","rect","stop","style","switch","symbol","text","textpath","title","tref","tspan","view","vkern"]),Ie=T(["feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence"]),Ft=T(["animate","color-profile","cursor","discard","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","foreignobject","hatch","hatchpath","mesh","meshgradient","meshpatch","meshrow","missing-glyph","script","set","solidcolor","unknown","use"]),Ce=T(["math","menclose","merror","mfenced","mfrac","mglyph","mi","mlabeledtr","mmultiscripts","mn","mo","mover","mpadded","mphantom","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msup","msubsup","mtable","mtd","mtext","mtr","munder","munderover","mprescripts"]),Ut=T(["maction","maligngroup","malignmark","mlongdiv","mscarries","mscarry","msgroup","mstack","msline","msrow","semantics","annotation","annotation-xml","mprescripts","none"]),Ke=T(["#text"]),Ze=T(["accept","action","align","alt","autocapitalize","autocomplete","autopictureinpicture","autoplay","background","bgcolor","border","capture","cellpadding","cellspacing","checked","cite","class","clear","color","cols","colspan","controls","controlslist","coords","crossorigin","datetime","decoding","default","dir","disabled","disablepictureinpicture","disableremoteplayback","download","draggable","enctype","enterkeyhint","exportparts","face","for","headers","height","hidden","high","href","hreflang","id","inert","inputmode","integrity","ismap","kind","label","lang","list
```

---

### Incident Patch 6: `e785cbfd` (2026-04-15)
**Commit Message**: chore: update package versions for nightly build 1.7.0.dev202604150306

**File**: `packages/ragbits-agents/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-agents"
-version = "1.7.0.dev202604020305"
+version = "1.7.0.dev202604150306"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-core==1.7.0.dev202604020305"]
+dependencies = ["ragbits-core==1.7.0.dev202604150306"]
 
 [project.optional-dependencies]
 a2a = [
```

**File**: `packages/ragbits-chat/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-chat"
-version = "1.7.0.dev202604020305"
+version = "1.7.0.dev202604150306"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["fastapi[standard]>=0.115.0,<1.0.0", "uvicorn>=0.31.0,<1.0.0", "httpx>=0.28.1,<1.0.0", "bcrypt>=4.2.0", "python-jose[cryptography]>=3.5.0", "ragbits-agents==1.7.0.dev202604020305", "ragbits-core==1.7.0.dev202604020305"]
+dependencies = ["fastapi[standard]>=0.115.0,<1.0.0", "uvicorn>=0.31.0,<1.0.0", "httpx>=0.28.1,<1.0.0", "bcrypt>=4.2.0", "python-jose[cryptography]>=3.5.0", "ragbits-agents==1.7.0.dev202604150306", "ragbits-core==1.7.0.dev202604150306"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-cli/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-cli"
-version = "1.7.0.dev202604020305"
+version = "1.7.0.dev202604150306"
 description = "A CLI application for ragbits - building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["typer>=0.12.5,<1.0.0", "ragbits-core==1.7.0.dev202604020305"]
+dependencies = ["typer>=0.12.5,<1.0.0", "ragbits-core==1.7.0.dev202604150306"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-core/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-core"
-version = "1.7.0.dev202604020305"
+version = "1.7.0.dev202604150306"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `packages/ragbits-document-search/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-document-search"
-version = "1.7.0.dev202604020305"
+version = "1.7.0.dev202604150306"
 description = "Document Search module for Ragbits"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -29,7 +29,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["docling[easyocr]>=2.65.0,<2.66.0", "opencv-python>=4.11.0.86,<5.0.0.0", "rerankers>=0.6.1,<1.0.0", "filetype>=1.2.0,<2.0.0", "python-pptx>=1.0.0,<2.0.0", "ragbits-core==1.7.0.dev202604020305"]
+dependencies = ["docling[easyocr]>=2.65.0,<2.66.0", "opencv-python>=4.11.0.86,<5.0.0.0", "rerankers>=0.6.1,<1.0.0", "filetype>=1.2.0,<2.0.0", "python-pptx>=1.0.0,<2.0.0", "ragbits-core==1.7.0.dev202604150306"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-evaluate/pyproject.toml` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-evaluate"
-version = "1.7.0.dev202604020305"
+version = "1.7.0.dev202604150306"
 description = "Evaluation module for Ragbits components"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -32,7 +32,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "optuna>=4.0.0,<5.0.0", "distilabel>=1.5.0,<2.0.0", "datasets>=3.0.1,<4.0.0", "ragbits-core==1.7.0.dev202604020305"]
+dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "optuna>=4.0.0,<5.0.0", "distilabel>=1.5.0,<2.0.0", "datasets>=3.0.1,<4.0.0", "ragbits-core==1.7.0.dev202604150306"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
@@ -42,10 +42,10 @@ dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "o
 
 [project.optional-dependencies]
 agents = [
-    "ragbits-agents==1.7.0.dev202604020305",
+    "ragbits-agents==1.7.0.dev202604150306",
 ]
 document-search = [
-    "ragbits-document-search==1.7.0.dev202604020305",
+    "ragbits-document-search==1.7.0.dev202604150306",
 ]
 relari = [
     "continuous-eval>=0.3.12,<1.0.0",
```

**File**: `packages/ragbits-guardrails/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-guardrails"
-version = "1.7.0.dev202604020305"
+version = "1.7.0.dev202604150306"
 description = "Guardrails module for Ragbits components"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-core==1.7.0.dev202604020305"]
+dependencies = ["ragbits-core==1.7.0.dev202604150306"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits/pyproject.toml` (modified, +28/-28)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits"
-version = "1.7.0.dev202604020305"
+version = "1.7.0.dev202604150306"
 description = "Building blocks for rapid development of GenAI applications"
 dynamic = ["readme"]
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-agents==1.7.0.dev202604020305","ragbits-document-search==1.7.0.dev202604020305", "ragbits-cli==1.7.0.dev202604020305", "ragbits-evaluate==1.7.0.dev202604020305", "ragbits-guardrails==1.7.0.dev202604020305", "ragbits-chat==1.7.0.dev202604020305", "ragbits-core==1.7.0.dev202604020305"]
+dependencies = ["ragbits-agents==1.7.0.dev202604150306","ragbits-document-search==1.7.0.dev202604150306", "ragbits-cli==1.7.0.dev202604150306", "ragbits-evaluate==1.7.0.dev202604150306", "ragbits-guardrails==1.7.0.dev202604150306", "ragbits-chat==1.7.0.dev202604150306", "ragbits-core==1.7.0.dev202604150306"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
@@ -41,80 +41,80 @@ dependencies = ["ragbits-agents==1.7.0.dev202604020305","ragbits-document-search
 
 [project.optional-dependencies]
 openai = [
-    "ragbits-guardrails[openai]==1.7.0.dev202604020305",
-    "ragbits-agents[openai]==1.7.0.dev202604020305",
+    "ragbits-guardrails[openai]==1.7.0.dev202604150306",
+    "ragbits-agents[openai]==1.7.0.dev202604150306",
 ]
 chroma = [
-    "ragbits-core[chroma]==1.7.0.dev202604020305",
+    "ragbits-core[chroma]==1.7.0.dev202604150306",
 ]
 local = [
-    "ragbits-core[local]==1.7.0.dev202604020305",
+    "ragbits-core[local]==1.7.0.dev202604150306",
 ]
 fastembed = [
-    "ragbits-core[fastembed]==1.7.0.dev202604020305",
+    "ragbits-core[fastembed]==1.7.0.dev202604150306",
 ]
 promptfoo = [
-    "ragbits-core[promptfoo]==1.7.0.dev202604020305",
+    "ragbits-core[promptfoo]==1.7.0.dev202604150306",
 ]
 otel = [
-    "ragbits-core[otel]==1.7.0.dev202604020305",
+    "ragbits-core[otel]==1.7.0.dev202604150306",
 ]
 logfire = [
-    "ragbits-core[logfire]==1.7.0.dev202604020305",
+    "ragbits-core[logfire]==1.7.0.dev202604150306",
 ]
 qdrant = [
-    "ragbits-core[qdrant]==1.7.0.dev202604020305",
+    "ragbits-core[qdrant]==1.7.0.dev202604150306",
 ]
 pgvector = [
-    "ragbits-core[pgvector]==1.7.0.dev202604020305",
+    "ragbits-core[pgvector]==1.7.0.dev202604150306",
 ]
 fastembed-gpu = [
-    "ragbits-core[fastembed-gpu]==1.7.0.dev202604020305",
+    "ragbits-core[fastembed-gpu]==1.7.0.dev202604150306",
 ]
 azure = [
-    "ragbits-core[azure]==1.7.0.dev202604020305",
+    "ragbits-core[azure]==1.7.0.dev202604150306",
 ]
 gcs = [
-    "ragbits-core[gcs]==1.7.0.dev202604020305",
+    "ragbits-core[gcs]==1.7.0.dev202604150306",
 ]
 hf = [
-    "ragbits-core[hf]==1.7.0.dev202604020305",
+    "ragbits-core[hf]==1.7.0.dev202604150306",
 ]
 s3 = [
-    "ragbits-core[s3]==1.7.0.dev202604020305",
+    "ragbits-core[s3]==1.7.0.dev202604150306",
 ]
 google_drive = [
-    "ragbits-core[google_drive]==1.7.0.dev202604020305",
+    "ragbits-core[google_drive]==1.7.0.dev202604150306",
 ]
 weaviate = [
-    "ragbits-core[weaviate]==1.7.0.dev202604020305",
+    "ragbits-core[weaviate]==1.7.0.dev202604150306",
 ]
 agents = [
-    "ragbits-evaluate[agents]==1.7.0.dev202604020305",
+    "ragbits-evaluate[agents]==1.7.0.dev202604150306",
 ]
 document-search = [
-    "ragbits-evaluate[document-search]==1.7.0.dev202604020305",
+    "ragbits-evaluate[document-search]==1.7.0.dev202604150306",
 ]
 relari = [
-    "ragbits-evaluate[relari]==1.7.0.dev202604020305",
+    "ragbits-evaluate[relari]==1.7.0.dev202604150306",
 ]
 a2a = [
-    "ragbits-agents[a2a]==1.7.0.dev202604020305",
+    "ragbits-agents[a2a]==1.7.0.dev202604150306",
 ]
 mcp = [
-    "ragbits-agents[mcp]==1.7.0.dev202604020305",
+    "ragbits-agents[mcp]==1.7.0.dev202604150306",
 ]
 cli = [
-    "ragbits-agents[cli]==1.7.0.dev202604020305",
+    "ragbits-agents[cli]==1.7.0.dev202604150306",
 ]
 unstructured = [
-    "ragbits-document-search[unstructured]==1.7.0.dev202604020305",
+    "ragbits-document-search[unstructured]==1.7.0.dev202604150306",
 ]
 ray = [
-    "ragbits-document-search[ray]==1.7.0.dev202604020305",
+    "ragbits-document-search[ray]==1.7.0.dev202604150306",
 ]
 sql = [
-    "ragbits-chat[sql]==1.7.0.dev202604020305",
+    "ragbits-chat[sql]==1.7.0.dev202604150306",
 ]
 
 [build-system]
```

---

### Incident Patch 7: `1778d2f2` (2026-04-09)
**Commit Message**: ci: remove automated UI build workflow, improve PR check message

**File**: `.github/workflows/build-ui.yml` (removed, +0/-51)
```diff
@@ -1,51 +0,0 @@
-name: Automated UI build
-
-on:
-  workflow_dispatch:
-  push:
-    branches:
-      # UI build is triggered only for `main` branch
-      - main
-    paths:
-      - typescript/ui/**
-      - typescript/@ragbits/api-client/src/**
-      - typescript/@ragbits/api-client-react/src/**
-
-jobs:
-  build:
-    name: Build & commit UI
-    continue-on-error: false
-    runs-on: ubuntu-latest
-    permissions:
-      id-token: write
-      contents: write
-    steps:
-      - uses: actions/checkout@v4
-        with:
-          token: ${{ secrets.GH_TOKEN }}
-
-      - name: Set up Node.js
-        uses: actions/setup-node@v4
-        with:
-          node-version: "lts/*"
-
-      - name: Install TypeScript dependencies
-        run: npm ci
-
-      - name: Build packages
-        run: npm run build
-
-      - name: Configure Git
-        run: |
-          git config user.name "ds-ragbits-robot"
-          git config user.email "ds-ragbits-robot@users.noreply.github.com"
-
-      - name: Commit UI
-        run: |
-          git add packages/ragbits-chat/src/ragbits/chat/ui-build
-          if git diff --cached --quiet; then
-            echo "UI build artifacts are up to date"
-          else
-            git commit -m "Automated UI build"
-            git push origin HEAD
-          fi
```

**File**: `.github/workflows/shared-ui.yml` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ jobs:
       - name: Check UI build artifacts are up to date
         run: |
           if [ -n "$(git diff --name-only packages/ragbits-chat/src/ragbits/chat/ui-build/)" ]; then
-            echo "::error::UI build artifacts are outdated. Run 'npm run build:ui' and commit the changes."
+            echo "::error::UI build artifacts are outdated. Run 'npm run build' and commit the updated ui-build/ directory."
             exit 1
           fi
 
```

---

### Incident Patch 8: `888e3fb0` (2026-04-01)
**Commit Message**: ci: trigger automated UI build on client source changes

**File**: `.github/workflows/build-ui.yml` (modified, +8/-2)
```diff
@@ -8,6 +8,8 @@ on:
       - main
     paths:
       - typescript/ui/**
+      - typescript/@ragbits/api-client/src/**
+      - typescript/@ragbits/api-client-react/src/**
 
 jobs:
   build:
@@ -41,5 +43,9 @@ jobs:
       - name: Commit UI
         run: |
           git add packages/ragbits-chat/src/ragbits/chat/ui-build
-          git commit -m "Automated UI build"
-          git push origin HEAD
+          if git diff --cached --quiet; then
+            echo "UI build artifacts are up to date"
+          else
+            git commit -m "Automated UI build"
+            git push origin HEAD
+          fi
```

---

### Incident Patch 9: `04a69702` (2026-04-01)
**Commit Message**: ci: auto-rebuild UI in nightly build and commit if changed

**File**: `.github/workflows/nightly-build.yml` (modified, +22/-2)
```diff
@@ -74,6 +74,28 @@ jobs:
           uv run scripts/update_nightly_versions.py "${{ needs.check-for-changes.outputs.nightly-version }}"
           uv run scripts/update_nightly_npm_versions.py "${{ needs.check-for-changes.outputs.nightly-version }}"
 
+      - name: Configure Git
+        run: |
+          git config user.name "ds-ragbits-robot"
+          git config user.email "ds-ragbits-robot@users.noreply.github.com"
+
+      - name: Set up Node.js
+        uses: actions/setup-node@v4
+        with:
+          node-version: "lts/*"
+
+      - name: Build and commit UI if needed
+        run: |
+          npm ci
+          npm run build
+          git add packages/ragbits-chat/src/ragbits/chat/ui-build
+          if ! git diff --cached --quiet; then
+            echo "UI build artifacts changed, committing..."
+            git commit -m "Automated UI build"
+          else
+            echo "UI build artifacts are up to date"
+          fi
+
       - name: Install dependencies
         run: |
           uv sync --all-extras
@@ -95,8 +117,6 @@ jobs:
       - name: Sync versions to repo and push tag
         if: ${{ github.event_name == 'schedule' || inputs.dry-run != true }}
         run: |
-          git config user.name "ds-ragbits-robot"
-          git config user.email "ds-ragbits-robot@users.noreply.github.com"
           git add packages/*/pyproject.toml typescript/@ragbits/*/package.json
 
           if git diff --cached --quiet; then
```

---

### Incident Patch 10: `04a6cf7e` (2026-04-01)
**Commit Message**: ci: check UI build artifacts are up to date in PR checks

**File**: `.github/workflows/pull-request-checks.yml` (modified, +1/-1)
```diff
@@ -69,5 +69,5 @@ jobs:
 
   ui:
     needs: check-source-changes
-    if: ${{ needs.check-source-changes.outputs.ui-changed == 'true' }}
+    if: ${{ needs.check-source-changes.outputs.ui-changed == 'true' || needs.check-source-changes.outputs.client-changed == 'true' }}
     uses: ./.github/workflows/shared-ui.yml
```

**File**: `.github/workflows/shared-ui.yml` (modified, +7/-0)
```diff
@@ -59,6 +59,13 @@ jobs:
         run: npm run build
         working-directory: typescript/ui
 
+      - name: Check UI build artifacts are up to date
+        run: |
+          if [ -n "$(git diff --name-only packages/ragbits-chat/src/ragbits/chat/ui-build/)" ]; then
+            echo "::error::UI build artifacts are outdated. Run 'npm run build:ui' and commit the changes."
+            exit 1
+          fi
+
       - name: Run unit tests
         run: npm run test:run
         working-directory: typescript/ui
```

---

### Incident Patch 11: `afb439f7` (2026-04-02)
**Commit Message**: chore: update package versions for nightly build 1.7.0.dev202604020305

**File**: `packages/ragbits-agents/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-agents"
-version = "1.6.2"
+version = "1.7.0.dev202604020305"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-core==1.6.2"]
+dependencies = ["ragbits-core==1.7.0.dev202604020305"]
 
 [project.optional-dependencies]
 a2a = [
```

**File**: `packages/ragbits-chat/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-chat"
-version = "1.6.2"
+version = "1.7.0.dev202604020305"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["fastapi[standard]>=0.115.0,<1.0.0", "uvicorn>=0.31.0,<1.0.0", "httpx>=0.28.1,<1.0.0", "bcrypt>=4.2.0", "python-jose[cryptography]>=3.5.0", "ragbits-agents==1.6.2", "ragbits-core==1.6.2"]
+dependencies = ["fastapi[standard]>=0.115.0,<1.0.0", "uvicorn>=0.31.0,<1.0.0", "httpx>=0.28.1,<1.0.0", "bcrypt>=4.2.0", "python-jose[cryptography]>=3.5.0", "ragbits-agents==1.7.0.dev202604020305", "ragbits-core==1.7.0.dev202604020305"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-cli/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-cli"
-version = "1.6.2"
+version = "1.7.0.dev202604020305"
 description = "A CLI application for ragbits - building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["typer>=0.12.5,<1.0.0", "ragbits-core==1.6.2"]
+dependencies = ["typer>=0.12.5,<1.0.0", "ragbits-core==1.7.0.dev202604020305"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-core/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-core"
-version = "1.6.2"
+version = "1.7.0.dev202604020305"
 description = "Building blocks for rapid development of GenAI applications"
 readme = "README.md"
 requires-python = ">=3.10"
```

**File**: `packages/ragbits-document-search/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-document-search"
-version = "1.6.2"
+version = "1.7.0.dev202604020305"
 description = "Document Search module for Ragbits"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -29,7 +29,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["docling[easyocr]>=2.65.0,<2.66.0", "opencv-python>=4.11.0.86,<5.0.0.0", "rerankers>=0.6.1,<1.0.0", "filetype>=1.2.0,<2.0.0", "python-pptx>=1.0.0,<2.0.0", "ragbits-core==1.6.2"]
+dependencies = ["docling[easyocr]>=2.65.0,<2.66.0", "opencv-python>=4.11.0.86,<5.0.0.0", "rerankers>=0.6.1,<1.0.0", "filetype>=1.2.0,<2.0.0", "python-pptx>=1.0.0,<2.0.0", "ragbits-core==1.7.0.dev202604020305"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits-evaluate/pyproject.toml` (modified, +4/-4)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-evaluate"
-version = "1.6.2"
+version = "1.7.0.dev202604020305"
 description = "Evaluation module for Ragbits components"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -32,7 +32,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "optuna>=4.0.0,<5.0.0", "distilabel>=1.5.0,<2.0.0", "datasets>=3.0.1,<4.0.0", "ragbits-core==1.6.2"]
+dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "optuna>=4.0.0,<5.0.0", "distilabel>=1.5.0,<2.0.0", "datasets>=3.0.1,<4.0.0", "ragbits-core==1.7.0.dev202604020305"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
@@ -42,10 +42,10 @@ dependencies = ["hydra-core>=1.3.2,<2.0.0", "neptune[optuna]>=1.12.0,<2.0.0", "o
 
 [project.optional-dependencies]
 agents = [
-    "ragbits-agents==1.6.2",
+    "ragbits-agents==1.7.0.dev202604020305",
 ]
 document-search = [
-    "ragbits-document-search==1.6.2",
+    "ragbits-document-search==1.7.0.dev202604020305",
 ]
 relari = [
     "continuous-eval>=0.3.12,<1.0.0",
```

**File**: `packages/ragbits-guardrails/pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits-guardrails"
-version = "1.6.2"
+version = "1.7.0.dev202604020305"
 description = "Guardrails module for Ragbits components"
 readme = "README.md"
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-core==1.6.2"]
+dependencies = ["ragbits-core==1.7.0.dev202604020305"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
```

**File**: `packages/ragbits/pyproject.toml` (modified, +28/-28)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "ragbits"
-version = "1.6.2"
+version = "1.7.0.dev202604020305"
 description = "Building blocks for rapid development of GenAI applications"
 dynamic = ["readme"]
 requires-python = ">=3.10"
@@ -31,7 +31,7 @@ classifiers = [
     "Topic :: Scientific/Engineering :: Artificial Intelligence",
     "Topic :: Software Development :: Libraries :: Python Modules",
 ]
-dependencies = ["ragbits-agents==1.6.2","ragbits-document-search==1.6.2", "ragbits-cli==1.6.2", "ragbits-evaluate==1.6.2", "ragbits-guardrails==1.6.2", "ragbits-chat==1.6.2", "ragbits-core==1.6.2"]
+dependencies = ["ragbits-agents==1.7.0.dev202604020305","ragbits-document-search==1.7.0.dev202604020305", "ragbits-cli==1.7.0.dev202604020305", "ragbits-evaluate==1.7.0.dev202604020305", "ragbits-guardrails==1.7.0.dev202604020305", "ragbits-chat==1.7.0.dev202604020305", "ragbits-core==1.7.0.dev202604020305"]
 
 [project.urls]
 "Homepage" = "https://github.com/deepsense-ai/ragbits"
@@ -41,80 +41,80 @@ dependencies = ["ragbits-agents==1.6.2","ragbits-document-search==1.6.2", "ragbi
 
 [project.optional-dependencies]
 openai = [
-    "ragbits-guardrails[openai]==1.6.2",
-    "ragbits-agents[openai]==1.6.2",
+    "ragbits-guardrails[openai]==1.7.0.dev202604020305",
+    "ragbits-agents[openai]==1.7.0.dev202604020305",
 ]
 chroma = [
-    "ragbits-core[chroma]==1.6.2",
+    "ragbits-core[chroma]==1.7.0.dev202604020305",
 ]
 local = [
-    "ragbits-core[local]==1.6.2",
+    "ragbits-core[local]==1.7.0.dev202604020305",
 ]
 fastembed = [
-    "ragbits-core[fastembed]==1.6.2",
+    "ragbits-core[fastembed]==1.7.0.dev202604020305",
 ]
 promptfoo = [
-    "ragbits-core[promptfoo]==1.6.2",
+    "ragbits-core[promptfoo]==1.7.0.dev202604020305",
 ]
 otel = [
-    "ragbits-core[otel]==1.6.2",
+    "ragbits-core[otel]==1.7.0.dev202604020305",
 ]
 logfire = [
-    "ragbits-core[logfire]==1.6.2",
+    "ragbits-core[logfire]==1.7.0.dev202604020305",
 ]
 qdrant = [
-    "ragbits-core[qdrant]==1.6.2",
+    "ragbits-core[qdrant]==1.7.0.dev202604020305",
 ]
 pgvector = [
-    "ragbits-core[pgvector]==1.6.2",
+    "ragbits-core[pgvector]==1.7.0.dev202604020305",
 ]
 fastembed-gpu = [
-    "ragbits-core[fastembed-gpu]==1.6.2",
+    "ragbits-core[fastembed-gpu]==1.7.0.dev202604020305",
 ]
 azure = [
-    "ragbits-core[azure]==1.6.2",
+    "ragbits-core[azure]==1.7.0.dev202604020305",
 ]
 gcs = [
-    "ragbits-core[gcs]==1.6.2",
+    "ragbits-core[gcs]==1.7.0.dev202604020305",
 ]
 hf = [
-    "ragbits-core[hf]==1.6.2",
+    "ragbits-core[hf]==1.7.0.dev202604020305",
 ]
 s3 = [
-    "ragbits-core[s3]==1.6.2",
+    "ragbits-core[s3]==1.7.0.dev202604020305",
 ]
 google_drive = [
-    "ragbits-core[google_drive]==1.6.2",
+    "ragbits-core[google_drive]==1.7.0.dev202604020305",
 ]
 weaviate = [
-    "ragbits-core[weaviate]==1.6.2",
+    "ragbits-core[weaviate]==1.7.0.dev202604020305",
 ]
 agents = [
-    "ragbits-evaluate[agents]==1.6.2",
+    "ragbits-evaluate[agents]==1.7.0.dev202604020305",
 ]
 document-search = [
-    "ragbits-evaluate[document-search]==1.6.2",
+    "ragbits-evaluate[document-search]==1.7.0.dev202604020305",
 ]
 relari = [
-    "ragbits-evaluate[relari]==1.6.2",
+    "ragbits-evaluate[relari]==1.7.0.dev202604020305",
 ]
 a2a = [
-    "ragbits-agents[a2a]==1.6.2",
+    "ragbits-agents[a2a]==1.7.0.dev202604020305",
 ]
 mcp = [
-    "ragbits-agents[mcp]==1.6.2",
+    "ragbits-agents[mcp]==1.7.0.dev202604020305",
 ]
 cli = [
-    "ragbits-agents[cli]==1.6.2",
+    "ragbits-agents[cli]==1.7.0.dev202604020305",
 ]
 unstructured = [
-    "ragbits-document-search[unstructured]==1.6.2",
+    "ragbits-document-search[unstructured]==1.7.0.dev202604020305",
 ]
 ray = [
-    "ragbits-document-search[ray]==1.6.2",
+    "ragbits-document-search[ray]==1.7.0.dev202604020305",
 ]
 sql = [
-    "ragbits-chat[sql]==1.6.2",
+    "ragbits-chat[sql]==1.7.0.dev202604020305",
 ]
 
 [build-system]
```

---

### Incident Patch 12: `c82f6340` (2026-04-01)
**Commit Message**: Automated UI build

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/AuthGuard-BKc_bAGB.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{r as h,j as e,aW as c,aw as p,c as S,bo as x,bp as l,bq as d,br as m,bs as b}from"./index-C2JZO4IG.js";import{a}from"./authStore-36BxASwU.js";import{u as j}from"./useInitializeUserStore-D4Pa-cTl.js";const v=h.createContext(null);function y({children:t}){const[o]=h.useState(()=>a);return e.jsx(v.Provider,{value:o,children:t})}function U(){const{logout:t,login:o,setHydrated:u}=c(a,f=>f),i=j(),n=p(),s=S("/api/user"),g=x();return h.useEffect(()=>{(async()=>{try{const r=await s.call();r?(o(r),i?i(r.user_id):console.error("Failed to initialize store for user, initializeUserStore() is not defined. Check current HistoryStoreContextProvider implementation."),g.pathname==="/login"&&n("/")):t()}catch(r){console.error("Failed to check session:",r),t(),n("/login")}finally{u()}})()},[]),null}function P({children:t}){const o=x(),u=c(a,s=>s.isAuthenticated),i=c(a,s=>s.hasHydrated),n=c(a,s=>s.logout);return i?o.pathname==="/login"?e.jsx(l,{baseUrl:d,auth:{credentials:"include"},children:t}):u?e.jsx(y,{children:e.jsx(l,{baseUrl:d,auth:{onUnauthorized:n,credentials:"include"},children:t})}):e.jsx(b,{to:"/login",replace:!0}):e.jsxs(l,{baseUrl:d,auth:{credentials:"include"},children:[e.jsx(U,{}),e.jsx(m,{})]})}export{P as default};
+import{r as h,j as e,aW as c,aw as p,c as S,bo as x,bp as l,bq as d,br as m,bs as b}from"./index-OlGgRGK4.js";import{a}from"./authStore-cPLtw9rA.js";import{u as j}from"./useInitializeUserStore-Bb7NZ1Qv.js";const v=h.createContext(null);function y({children:t}){const[o]=h.useState(()=>a);return e.jsx(v.Provider,{value:o,children:t})}function U(){const{logout:t,login:o,setHydrated:u}=c(a,f=>f),i=j(),n=p(),s=S("/api/user"),g=x();return h.useEffect(()=>{(async()=>{try{const r=await s.call();r?(o(r),i?i(r.user_id):console.error("Failed to initialize store for user, initializeUserStore() is not defined. Check current HistoryStoreContextProvider implementation."),g.pathname==="/login"&&n("/")):t()}catch(r){console.error("Failed to check session:",r),t(),n("/login")}finally{u()}})()},[]),null}function P({children:t}){const o=x(),u=c(a,s=>s.isAuthenticated),i=c(a,s=>s.hasHydrated),n=c(a,s=>s.logout);return i?o.pathname==="/login"?e.jsx(l,{baseUrl:d,auth:{credentials:"include"},children:t}):u?e.jsx(y,{children:e.jsx(l,{baseUrl:d,auth:{onUnauthorized:n,credentials:"include"},children:t})}):e.jsx(b,{to:"/login",replace:!0}):e.jsxs(l,{baseUrl:d,auth:{credentials:"include"},children:[e.jsx(U,{}),e.jsx(m,{})]})}export{P as default};
```

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/ChatHistory-CgAYnd09.js` (renamed, +2/-2)
```diff
@@ -1,2 +1,2 @@
-const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/index-BHnq25BG.js","assets/index-C2JZO4IG.js","assets/index-CwtSwCGi.css"])))=>i.map(i=>d[i]);
-import{r as P,t as ae,k as Xe,Z as W,az as Me,$ as Ze,j as t,q as me,L as xe,_ as Ye,n as ye,T as Pe,s as et,v as R,V as tt,d as X,l as se,aq as Ie,o as ot,H as ke,a9 as rt,J as Ne,aA as at,ac as pe,U as st,X as _e,af as he,aB as nt,aC as lt,ag as it,K as dt,O as be,Q as ct,W as ut,a0 as pt,ah as ft,a2 as K,a3 as Ae,ai as vt,R as ht,aD as bt,a8 as gt,aE as mt,aF as xt,a5 as yt,a as Pt,aw as Ct,i as fe,aG as Ce,aH as ve,D as we,I as Q,as as wt,aI as $t,ay as $e}from"./index-C2JZO4IG.js";import{u as jt,b as St,c as je,d as Dt,e as Mt,m as It,$ as kt,a as Nt}from"./useMenuTriggerState-VmkJSxDS.js";import{$ as _t}from"./useSelectableItem-CspqFsBK.js";import{i as At}from"./chunk-SSA7SXE4-BPUX2eWx.js";var Ot=(e,r)=>{var n;let s=[];const a=(n=P.Children.map(e,d=>P.isValidElement(d)&&d.type===r?(s.push(d),null):d))==null?void 0:n.filter(Boolean),u=s.length>=0?s:void 0;return[a,u]},Ft=ae({base:["w-full","p-1","min-w-[200px]"]});ae({slots:{base:["flex","group","gap-2","items-center","justify-between","relative","px-2","py-1.5","w-full","h-full","box-border","rounded-small","outline-hidden","cursor-pointer","tap-highlight-transparent","data-[pressed=true]:opacity-70",...Xe,"data-[focus-visible=true]:dark:ring-offset-background-content1"],wrapper:"w-full flex flex-col items-start justify-center",title:"flex-1 text-small font-normal truncate",description:["w-full","text-tiny","text-foreground-500","group-hover:text-current"],selectedIcon:["text-inherit","w-3","h-3","shrink-0"],shortcut:["px-1","py-0.5","rounded-sm","font-sans","text-foreground-500","text-tiny","border-small","border-default-300","group-hover:border-current"]},variants:{variant:{solid:{base:""},bordered:{base:"border-medium border-transparent bg-transparent"},light:{base:"bg-transparent"},faded:{base:"border-small border-transparent hover:border-default data-[hover=true]:bg-default-100"},flat:{base:""},shadow:{base:"data-[hover=true]:shadow-lg"}},color:{default:{},primary:{},secondary:{},success:{},warning:{},danger:{}},isDisabled:{true:{base:"opacity-disabled pointer-events-none"}},disableAnimation:{true:{},false:{}}},defaultVariants:{variant:"solid",color:"default"},compoundVariants:[{variant:"solid",color:"default",class:{base:"data-[hover=true]:bg-default data-[hover=true]:text-default-foreground"}},{variant:"solid",color:"primary",class:{base:"data-[hover=true]:bg-primary data-[hover=true]:text-primary-foreground"}},{variant:"solid",color:"secondary",class:{base:"data-[hover=true]:bg-secondary data-[hover=true]:text-secondary-foreground"}},{variant:"solid",color:"success",class:{base:"data-[hover=true]:bg-success data-[hover=true]:text-success-foreground"}},{variant:"solid",color:"warning",class:{base:"data-[hover=true]:bg-warning data-[hover=true]:text-warning-foreground"}},{variant:"solid",color:"danger",class:{base:"data-[hover=true]:bg-danger data-[hover=true]:text-danger-foreground"}},{variant:"shadow",color:"default",class:{base:"data-[hover=true]:shadow-default/50 data-[hover=true]:bg-default data-[hover=true]:text-default-foreground"}},{variant:"shadow",color:"primary",class:{base:"data-[hover=true]:shadow-primary/30 data-[hover=true]:bg-primary data-[hover=true]:text-primary-foreground"}},{variant:"shadow",color:"secondary",class:{base:"data-[hover=true]:shadow-secondary/30 data-[hover=true]:bg-secondary data-[hover=true]:text-secondary-foreground"}},{variant:"shadow",color:"success",class:{base:"data-[hover=true]:shadow-success/30 data-[hover=true]:bg-success data-[hover=true]:text-success-foreground"}},{variant:"shadow",color:"warning",class:{base:"data-[hover=true]:shadow-warning/30 data-[hover=true]:bg-warning data-[hover=true]:text-warning-foreground"}},{variant:"shadow",color:"danger",class:{base:"data-[hover=true]:shadow-danger/30 data-[hover=true]:bg-danger data-[hover=true]:text-danger-foreground"}},{variant:"bordered",color:"default",class:{base:"data-[hover=true]:border-default"}},{variant:"bordered",color:"primary",class:{base:"data-[hover=true]:border-primary data-[hover=true]:text-primary"}},{variant:"bordered",color:"secondary",class:{base:"data-[hover=true]:border-secondary data-[hover=true]:text-secondary"}},{variant:"bordered",color:"success",class:{base:"data-[hover=true]:border-success data-[hover=true]:text-success"}},{variant:"bordered",color:"warning",class:{base:"data-[hover=true]:border-warning data-[hover=true]:text-warning"}},{variant:"bordered",color:"danger",class:{base:"data-[hover=true]:border-danger data-[hover=true]:text-danger"}},{variant:"flat",color:"default",class:{base:"data-[hover=true]:bg-default/40 data-[hover=true]:text-default-foreground"}},{variant:"flat",color:"primary",class:{base:"data-[hover=true]:bg-primary/20 data-[hover=true]:text-primary"}},{variant:"flat",color:"secondary",class:{base:"data-[hover=true]:bg-seconda
```

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/ChatOptionsForm-DzqpOeP8.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{g as z,r as f,u as ie,h as ce,a as ue,i as le,b as fe,p as Y,C as Q,j as l,D as de,d as A,I as me,m as ge,e as he,f as pe}from"./index-C2JZO4IG.js";import{g as Z,v as W,F as ve,t as be}from"./index-IcE0dB37.js";import{m as Se}from"./chunk-IGSAU2ZA-B49HvkZI.js";import"./chunk-SSA7SXE4-BPUX2eWx.js";import"./useMenuTriggerState-VmkJSxDS.js";import"./useSelectableItem-CspqFsBK.js";import"./index-BVTVJPoR.js";var B,V;function xe(){if(V)return B;V=1;var n="Expected a function",t=NaN,s="[object Symbol]",m=/^\s+|\s+$/g,g=/^[-+]0x[0-9a-f]+$/i,h=/^0b[01]+$/i,i=/^0o[0-7]+$/i,b=parseInt,S=typeof z=="object"&&z&&z.Object===Object&&z,y=typeof self=="object"&&self&&self.Object===Object&&self,C=S||y||Function("return this")(),d=Object.prototype,r=d.toString,c=Math.max,O=Math.min,E=function(){return C.Date.now()};function $(e,u,v){var T,L,P,I,p,j,R=0,G=!1,D=!1,k=!0;if(typeof e!="function")throw new TypeError(n);u=q(u)||0,_(v)&&(G=!!v.leading,D="maxWait"in v,P=D?c(q(v.maxWait)||0,u):P,k="trailing"in v?!!v.trailing:k);function H(o){var x=T,F=L;return T=L=void 0,R=o,I=e.apply(F,x),I}function re(o){return R=o,p=setTimeout(N,u),G?H(o):I}function oe(o){var x=o-j,F=o-R,X=u-x;return D?O(X,P-F):X}function U(o){var x=o-j,F=o-R;return j===void 0||x>=u||x<0||D&&F>=P}function N(){var o=E();if(U(o))return K(o);p=setTimeout(N,oe(o))}function K(o){return p=void 0,k&&T?H(o):(T=L=void 0,I)}function se(){p!==void 0&&clearTimeout(p),R=0,T=j=L=p=void 0}function ae(){return p===void 0?I:K(E())}function M(){var o=E(),x=U(o);if(T=arguments,L=this,j=o,x){if(p===void 0)return re(j);if(D)return p=setTimeout(N,u),H(j)}return p===void 0&&(p=setTimeout(N,u)),I}return M.cancel=se,M.flush=ae,M}function _(e){var u=typeof e;return!!e&&(u=="object"||u=="function")}function a(e){return!!e&&typeof e=="object"}function w(e){return typeof e=="symbol"||a(e)&&r.call(e)==s}function q(e){if(typeof e=="number")return e;if(w(e))return t;if(_(e)){var u=typeof e.valueOf=="function"?e.valueOf():e;e=_(u)?u+"":u}if(typeof e!="string")return e===0?e:+e;e=e.replace(m,"");var v=h.test(e);return v||i.test(e)?b(e.slice(2),v?2:8):g.test(e)?t:+e}return B=$,B}xe();var ne=typeof window<"u"?f.useLayoutEffect:f.useEffect;function ee(n,t,s,m){const g=f.useRef(t);ne(()=>{g.current=t},[t]),f.useEffect(()=>{const h=window;if(!(h&&h.addEventListener))return;const i=b=>{g.current(b)};return h.addEventListener(n,i,m),()=>{h.removeEventListener(n,i,m)}},[n,s,m])}function te(n){const t=f.useRef(()=>{throw new Error("Cannot call an event handler while rendering.")});return ne(()=>{t.current=n},[n]),f.useCallback((...s)=>{var m;return(m=t.current)==null?void 0:m.call(t,...s)},[t])}var J=typeof window>"u";function ye(n,t,s={}){const{initializeWithValue:m=!0}=s,g=f.useCallback(r=>s.serializer?s.serializer(r):JSON.stringify(r),[s]),h=f.useCallback(r=>{if(s.deserializer)return s.deserializer(r);if(r==="undefined")return;const c=t instanceof Function?t():t;let O;try{O=JSON.parse(r)}catch(E){return console.error("Error parsing JSON:",E),c}return O},[s,t]),i=f.useCallback(()=>{const r=t instanceof Function?t():t;if(J)return r;try{const c=window.localStorage.getItem(n);return c?h(c):r}catch(c){return console.warn(`Error reading localStorage key “${n}”:`,c),r}},[t,n,h]),[b,S]=f.useState(()=>m?i():t instanceof Function?t():t),y=te(r=>{J&&console.warn(`Tried setting localStorage key “${n}” even though environment is not a client`);try{const c=r instanceof Function?r(i()):r;window.localStorage.setItem(n,g(c)),S(c),window.dispatchEvent(new StorageEvent("local-storage",{key:n}))}catch(c){console.warn(`Error setting localStorage key “${n}”:`,c)}}),C=te(()=>{J&&console.warn(`Tried removing localStorage key “${n}” even though environment is not a client`);const r=t instanceof Function?t():t;window.localStorage.removeItem(n),S(r),window.dispatchEvent(new StorageEvent("local-storage",{key:n}))});f.useEffect(()=>{S(i())},[n]);const d=f.useCallback(r=>{r.key&&r.key!==n||S(i())},[n,i]);return ee("storage",d),ee("local-storage",d),[b,y,C]}const Ce="ragbits-no-history-chat-options";function Le(){const{isOpen:n,onOpen:t,onClose:s}=ie(),m=ce(a=>a.chatOptions),g=f.useRef(null),{setConversationProperties:h,initializeChatOptions:i}=ue(),b=le(a=>a.currentConversation),{config:{user_settings:S}}=fe(),[y,C]=ye(Ce,null),d=S?.form,r=a=>{Y.isPluginActivated(Q.name)||C(a)},c=()=>{t()},O=(a,w)=>{w.preventDefault(),g.current=a.formData,s()},E=()=>{if(!d)return;const a=Z(W,d);g.current=a,s()},$=()=>{s()},_=a=>{if(a!=="exit"||!g.current)return;const w=g.current;h(b,{chatOptions:w}),r(w),g.current=null};return f.useEffect(()=>{if(!d)return;const a=Z(W,d);Y.isPluginActivated(Q.name)?i(a):y!==null?i(y):(i(a),C(a))},[i,d,b,y,C]),d?l.jsxs(l.Fragment,{children:[l.jsx(de,{content:"Chat Options",placement:"bottom",children:l.jsx(A,{isIconOnly:!0,variant:"ghost",className:"p-0","aria-label":"Open chat options",onPress:c,"data-testid":"open-chat-options",children:l.jsx(me,{icon:"heroicons:cog-6-tooth"})})}),l.jsx(ge,{isOpen
```

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/CredentialsLogin-CDYA_x-h.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{r as c,c as x,aW as w,aw as S,j as t,aq as b,aH as j,d as v,bm as C}from"./index-C2JZO4IG.js";import{a as P}from"./authStore-36BxASwU.js";import{u as q}from"./useInitializeUserStore-D4Pa-cTl.js";import{i as m}from"./chunk-SSA7SXE4-BPUX2eWx.js";function E(){const[s,p]=c.useState({username:"",password:""}),l=x("/api/auth/login",{headers:{"Content-Type":"application/json"},method:"POST"}),f=w(P,e=>e.login),g=S(),u=q(),[y,o]=c.useState(!1),h=async e=>{o(!1),e.preventDefault(),e.stopPropagation();const r=new FormData(e.currentTarget),n=r.get("username"),i=r.get("password");try{const a=await l.call({body:{username:n,password:i}});if(!a.success||!a.user){o(!0);return}f(a.user),u?u(a.user.user_id):console.error("Failed to initialize store for user, initializeUserStore() is not defined. Check current HistoryStoreContextProvider implementation."),g("/")}catch(a){console.error("Failed to login",a),o(!0)}},d=e=>r=>p(n=>C(n,i=>{i[e]=r.target.value}));return t.jsxs("form",{className:"flex w-full flex-col gap-4",onSubmit:h,children:[t.jsx(m,{label:"Username",name:"username",labelPlacement:"outside",placeholder:"Your username",required:!0,isRequired:!0,value:s.username,onChange:d("username")}),t.jsx(m,{label:"Password",labelPlacement:"outside",id:"password",name:"password",type:"password",placeholder:"••••••••",required:!0,isRequired:!0,value:s.password,onChange:d("password")}),t.jsx(b,{children:y&&!l.isLoading&&t.jsx(j.div,{className:"text-small text-danger",initial:{opacity:0,y:-10},animate:{opacity:1,y:0},exit:{opacity:0,y:-10},transition:{duration:.3,ease:"easeOut"},children:"We couldn't sign you in. Please verify your credentials and try again."})}),t.jsx(v,{type:"submit",color:s.password&&s.username?"primary":"default",children:"Sign in"})]})}export{E as default};
+import{r as c,c as x,aW as w,aw as S,j as t,aq as b,aH as j,d as v,bm as C}from"./index-OlGgRGK4.js";import{a as P}from"./authStore-cPLtw9rA.js";import{u as q}from"./useInitializeUserStore-Bb7NZ1Qv.js";import{i as m}from"./chunk-SSA7SXE4-C1Frnya0.js";function E(){const[s,p]=c.useState({username:"",password:""}),l=x("/api/auth/login",{headers:{"Content-Type":"application/json"},method:"POST"}),f=w(P,e=>e.login),g=S(),u=q(),[y,o]=c.useState(!1),h=async e=>{o(!1),e.preventDefault(),e.stopPropagation();const r=new FormData(e.currentTarget),n=r.get("username"),i=r.get("password");try{const a=await l.call({body:{username:n,password:i}});if(!a.success||!a.user){o(!0);return}f(a.user),u?u(a.user.user_id):console.error("Failed to initialize store for user, initializeUserStore() is not defined. Check current HistoryStoreContextProvider implementation."),g("/")}catch(a){console.error("Failed to login",a),o(!0)}},d=e=>r=>p(n=>C(n,i=>{i[e]=r.target.value}));return t.jsxs("form",{className:"flex w-full flex-col gap-4",onSubmit:h,children:[t.jsx(m,{label:"Username",name:"username",labelPlacement:"outside",placeholder:"Your username",required:!0,isRequired:!0,value:s.username,onChange:d("username")}),t.jsx(m,{label:"Password",labelPlacement:"outside",id:"password",name:"password",type:"password",placeholder:"••••••••",required:!0,isRequired:!0,value:s.password,onChange:d("password")}),t.jsx(b,{children:y&&!l.isLoading&&t.jsx(j.div,{className:"text-small text-danger",initial:{opacity:0,y:-10},animate:{opacity:1,y:0},exit:{opacity:0,y:-10},transition:{duration:.3,ease:"easeOut"},children:"We couldn't sign you in. Please verify your credentials and try again."})}),t.jsx(v,{type:"submit",color:s.password&&s.username?"primary":"default",children:"Sign in"})]})}export{E as default};
```

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/FeedbackForm-CygVxlKO.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{u as g,a as v,b as C,r as T,F as t,c as _,j as e,D as f,d as r,I as b,m as I,e as w,f as D}from"./index-C2JZO4IG.js";import{F as O,t as R,v as S}from"./index-IcE0dB37.js";import{m as E}from"./chunk-IGSAU2ZA-B49HvkZI.js";import"./chunk-SSA7SXE4-BPUX2eWx.js";import"./useMenuTriggerState-VmkJSxDS.js";import"./useSelectableItem-CspqFsBK.js";import"./index-BVTVJPoR.js";function z({message:s}){const{isOpen:h,onOpen:p,onClose:l}=g(),{mergeExtensions:c}=v(),{config:{feedback:o}}=C(),n=T.useRef(t.Like),k=_("/api/feedback",{headers:{"Content-Type":"application/json"},method:"POST"});if(!s.serverId)return null;const i=o[n.current].form,x=()=>{l()},d=async(a,y)=>{if(!s.serverId)throw new Error('Feedback is only available for messages with "serverId" set');try{await k.call({body:{message_id:s.serverId,feedback:y??n.current,payload:a??{}}})}catch(F){console.error(F)}},j=a=>{c(s.id,{feedbackType:n.current}),d(a.formData),l()},m=async a=>{if(n.current=a,o[a].form===null){c(s.id,{feedbackType:a}),await d(null,a);return}p()},u=s.extensions?.feedbackType;return e.jsxs(e.Fragment,{children:[o.like.enabled&&e.jsx(f,{content:"Like",placement:"bottom",children:e.jsx(r,{isIconOnly:!0,variant:"ghost",className:"p-0","aria-label":"Rate message as helpful",onPress:()=>m(t.Like),"data-testid":"feedback-like",children:e.jsx(b,{icon:u===t.Like?"heroicons:hand-thumb-up-solid":"heroicons:hand-thumb-up"})})}),o.dislike.enabled&&e.jsx(f,{content:"Dislike",placement:"bottom",children:e.jsx(r,{isIconOnly:!0,variant:"ghost",className:"p-0","aria-label":"Rate message as unhelpful",onPress:()=>m(t.Dislike),"data-testid":"feedback-dislike",children:e.jsx(b,{icon:u===t.Dislike?"heroicons:hand-thumb-down-solid":"heroicons:hand-thumb-down"})})}),i&&e.jsx(I,{isOpen:h,onOpenChange:x,children:e.jsx(w,{children:a=>e.jsxs(e.Fragment,{children:[e.jsx(E,{className:"text-default-900 flex flex-col gap-1",children:i.title}),e.jsx(D,{children:e.jsx("div",{className:"flex flex-col gap-4",children:e.jsx(O,{schema:i,validator:S,onSubmit:j,transformErrors:R,liveValidate:!0,children:e.jsxs("div",{className:"flex justify-end gap-4 py-4",children:[e.jsx(r,{color:"danger",variant:"light",onPress:a,"aria-label":"Close feedback form",children:"Cancel"}),e.jsx(r,{color:"primary",type:"submit","aria-label":"Submit feedback","data-testid":"feedback-submit",children:"Submit"})]})})})})]})})})]})}export{z as default};
+import{u as g,a as v,b as C,r as T,F as t,c as _,j as e,D as f,d as r,I as b,m as I,e as w,f as D}from"./index-OlGgRGK4.js";import{F as O,t as R,v as S}from"./index-Cu4AtYtU.js";import{m as E}from"./chunk-IGSAU2ZA-q02-faRT.js";import"./chunk-SSA7SXE4-C1Frnya0.js";import"./useMenuTriggerState-CdA3WcyE.js";import"./useSelectableItem-DYUjiw5b.js";import"./index-CbkNIwGe.js";function z({message:s}){const{isOpen:h,onOpen:p,onClose:l}=g(),{mergeExtensions:c}=v(),{config:{feedback:o}}=C(),n=T.useRef(t.Like),k=_("/api/feedback",{headers:{"Content-Type":"application/json"},method:"POST"});if(!s.serverId)return null;const i=o[n.current].form,x=()=>{l()},d=async(a,y)=>{if(!s.serverId)throw new Error('Feedback is only available for messages with "serverId" set');try{await k.call({body:{message_id:s.serverId,feedback:y??n.current,payload:a??{}}})}catch(F){console.error(F)}},j=a=>{c(s.id,{feedbackType:n.current}),d(a.formData),l()},m=async a=>{if(n.current=a,o[a].form===null){c(s.id,{feedbackType:a}),await d(null,a);return}p()},u=s.extensions?.feedbackType;return e.jsxs(e.Fragment,{children:[o.like.enabled&&e.jsx(f,{content:"Like",placement:"bottom",children:e.jsx(r,{isIconOnly:!0,variant:"ghost",className:"p-0","aria-label":"Rate message as helpful",onPress:()=>m(t.Like),"data-testid":"feedback-like",children:e.jsx(b,{icon:u===t.Like?"heroicons:hand-thumb-up-solid":"heroicons:hand-thumb-up"})})}),o.dislike.enabled&&e.jsx(f,{content:"Dislike",placement:"bottom",children:e.jsx(r,{isIconOnly:!0,variant:"ghost",className:"p-0","aria-label":"Rate message as unhelpful",onPress:()=>m(t.Dislike),"data-testid":"feedback-dislike",children:e.jsx(b,{icon:u===t.Dislike?"heroicons:hand-thumb-down-solid":"heroicons:hand-thumb-down"})})}),i&&e.jsx(I,{isOpen:h,onOpenChange:x,children:e.jsx(w,{children:a=>e.jsxs(e.Fragment,{children:[e.jsx(E,{className:"text-default-900 flex flex-col gap-1",children:i.title}),e.jsx(D,{children:e.jsx("div",{className:"flex flex-col gap-4",children:e.jsx(O,{schema:i,validator:S,onSubmit:j,transformErrors:R,liveValidate:!0,children:e.jsxs("div",{className:"flex justify-end gap-4 py-4",children:[e.jsx(r,{color:"danger",variant:"light",onPress:a,"aria-label":"Close feedback form",children:"Cancel"}),e.jsx(r,{color:"primary",type:"submit","aria-label":"Submit feedback","data-testid":"feedback-submit",children:"Submit"})]})})})})]})})})]})}export{z as default};
```

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/Login-1Zz4dDvy.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{r as s,j as e}from"./index-C2JZO4IG.js";function n({children:t}){return s.useEffect(()=>{document.title="Login"},[]),e.jsx("div",{className:"flex h-screen w-screen",children:e.jsxs("div",{className:"rounded-medium border-small border-divider m-auto flex w-full max-w-xs flex-col gap-4 p-4",children:[e.jsxs("div",{className:"text-small",children:[e.jsx("div",{className:"text-foreground truncate leading-5 font-semibold",children:"Sign in"}),e.jsx("div",{className:"text-default-500 truncate leading-5 font-normal",children:"Sign in to start chatting."})]}),t]})})}export{n as default};
+import{r as s,j as e}from"./index-OlGgRGK4.js";function n({children:t}){return s.useEffect(()=>{document.title="Login"},[]),e.jsx("div",{className:"flex h-screen w-screen",children:e.jsxs("div",{className:"rounded-medium border-small border-divider m-auto flex w-full max-w-xs flex-col gap-4 p-4",children:[e.jsxs("div",{className:"text-small",children:[e.jsx("div",{className:"text-foreground truncate leading-5 font-semibold",children:"Sign in"}),e.jsx("div",{className:"text-default-500 truncate leading-5 font-normal",children:"Sign in to start chatting."})]}),t]})})}export{n as default};
```

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/LogoutButton-BY4-ccNH.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{c,aW as a,aw as l,j as o,D as g,d,I as h}from"./index-C2JZO4IG.js";import{a as s}from"./authStore-36BxASwU.js";function m(){const n=c("/api/auth/logout",{headers:{"Content-Type":"application/json"},method:"POST"}),r=a(s,t=>t.logout),u=a(s,t=>t.isAuthenticated),e=l(),i=async()=>{if(!u){e("/login");return}try{if(!(await n.call()).success)return;r(),e("/login")}catch(t){console.error("Failed to logout",t)}};return o.jsx(g,{content:"Logout",placement:"bottom",children:o.jsx(d,{isIconOnly:!0,"aria-label":"Logout",variant:"ghost",onPress:i,"data-testid":"logout-button",children:o.jsx(h,{icon:"heroicons:arrow-left-start-on-rectangle"})})})}export{m as default};
+import{c,aW as a,aw as l,j as o,D as g,d,I as h}from"./index-OlGgRGK4.js";import{a as s}from"./authStore-cPLtw9rA.js";function m(){const n=c("/api/auth/logout",{headers:{"Content-Type":"application/json"},method:"POST"}),r=a(s,t=>t.logout),u=a(s,t=>t.isAuthenticated),e=l(),i=async()=>{if(!u){e("/login");return}try{if(!(await n.call()).success)return;r(),e("/login")}catch(t){console.error("Failed to logout",t)}};return o.jsx(g,{content:"Logout",placement:"bottom",children:o.jsx(d,{isIconOnly:!0,"aria-label":"Logout",variant:"ghost",onPress:i,"data-testid":"logout-button",children:o.jsx(h,{icon:"heroicons:arrow-left-start-on-rectangle"})})})}export{m as default};
```

**File**: `packages/ragbits-chat/src/ragbits/chat/ui-build/assets/OAuth2Login-BpftOWWY.js` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+import{ar as An,r as K,c as Sn,j as le,aq as Rn,aH as yn,d as On}from"./index-OlGgRGK4.js";var $e,Ct;function Nt(){if(Ct)return $e;Ct=1;const{entries:Z,setPrototypeOf:M,isFrozen:w,getPrototypeOf:Oe,getOwnPropertyDescriptor:ce}=Object;let{freeze:T,seal:y,create:x}=Object,{apply:z,construct:G}=typeof Reflect<"u"&&Reflect;T||(T=function(o){return o}),y||(y=function(o){return o}),z||(z=function(o,l){for(var r=arguments.length,c=new Array(r>2?r-2:0),O=2;O<r;O++)c[O-2]=arguments[O];return o.apply(l,c)}),G||(G=function(o){for(var l=arguments.length,r=new Array(l>1?l-1:0),c=1;c<l;c++)r[c-1]=arguments[c];return new o(...r)});const W=A(Array.prototype.forEach),ue=A(Array.prototype.lastIndexOf),fe=A(Array.prototype.pop),b=A(Array.prototype.push),wt=A(Array.prototype.splice),me=A(String.prototype.toLowerCase),De=A(String.prototype.toString),be=A(String.prototype.match),J=A(String.prototype.replace),xt=A(String.prototype.indexOf),Pt=A(String.prototype.trim),L=A(Object.prototype.hasOwnProperty),g=A(RegExp.prototype.test),Q=vt(TypeError);function A(s){return function(o){o instanceof RegExp&&(o.lastIndex=0);for(var l=arguments.length,r=new Array(l>1?l-1:0),c=1;c<l;c++)r[c-1]=arguments[c];return z(s,o,r)}}function vt(s){return function(){for(var o=arguments.length,l=new Array(o),r=0;r<o;r++)l[r]=arguments[r];return G(s,l)}}function a(s,o){let l=arguments.length>2&&arguments[2]!==void 0?arguments[2]:me;M&&M(s,null);let r=o.length;for(;r--;){let c=o[r];if(typeof c=="string"){const O=l(c);O!==c&&(w(o)||(o[r]=O),c=O)}s[c]=!0}return s}function kt(s){for(let o=0;o<s.length;o++)L(s,o)||(s[o]=null);return s}function I(s){const o=x(null);for(const[l,r]of Z(s))L(s,l)&&(Array.isArray(r)?o[l]=kt(r):r&&typeof r=="object"&&r.constructor===Object?o[l]=I(r):o[l]=r);return o}function ee(s,o){for(;s!==null;){const r=ce(s,o);if(r){if(r.get)return A(r.get);if(typeof r.value=="function")return A(r.value)}s=Oe(s)}function l(){return null}return l}const Ve=T(["a","abbr","acronym","address","area","article","aside","audio","b","bdi","bdo","big","blink","blockquote","body","br","button","canvas","caption","center","cite","code","col","colgroup","content","data","datalist","dd","decorator","del","details","dfn","dialog","dir","div","dl","dt","element","em","fieldset","figcaption","figure","font","footer","form","h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html","i","img","input","ins","kbd","label","legend","li","main","map","mark","marquee","menu","menuitem","meter","nav","nobr","ol","optgroup","option","output","p","picture","pre","progress","q","rp","rt","ruby","s","samp","search","section","select","shadow","slot","small","source","spacer","span","strike","strong","style","sub","summary","sup","table","tbody","td","template","textarea","tfoot","th","thead","time","tr","track","tt","u","ul","var","video","wbr"]),Le=T(["svg","a","altglyph","altglyphdef","altglyphitem","animatecolor","animatemotion","animatetransform","circle","clippath","defs","desc","ellipse","enterkeyhint","exportparts","filter","font","g","glyph","glyphref","hkern","image","inputmode","line","lineargradient","marker","mask","metadata","mpath","part","path","pattern","polygon","polyline","radialgradient","rect","stop","style","switch","symbol","text","textpath","title","tref","tspan","view","vkern"]),Ie=T(["feBlend","feColorMatrix","feComponentTransfer","feComposite","feConvolveMatrix","feDiffuseLighting","feDisplacementMap","feDistantLight","feDropShadow","feFlood","feFuncA","feFuncB","feFuncG","feFuncR","feGaussianBlur","feImage","feMerge","feMergeNode","feMorphology","feOffset","fePointLight","feSpecularLighting","feSpotLight","feTile","feTurbulence"]),Ft=T(["animate","color-profile","cursor","discard","font-face","font-face-format","font-face-name","font-face-src","font-face-uri","foreignobject","hatch","hatchpath","mesh","meshgradient","meshpatch","meshrow","missing-glyph","script","set","solidcolor","unknown","use"]),Ce=T(["math","menclose","merror","mfenced","mfrac","mglyph","mi","mlabeledtr","mmultiscripts","mn","mo","mover","mpadded","mphantom","mroot","mrow","ms","mspace","msqrt","mstyle","msub","msup","msubsup","mtable","mtd","mtext","mtr","munder","munderover","mprescripts"]),Ut=T(["maction","maligngroup","malignmark","mlongdiv","mscarries","mscarry","msgroup","mstack","msline","msrow","semantics","annotation","annotation-xml","mprescripts","none"]),Ke=T(["#text"]),Ze=T(["accept","action","align","alt","autocapitalize","autocomplete","autopictureinpicture","autoplay","background","bgcolor","border","capture","cellpadding","cellspacing","checked","cite","class","clear","color","cols","colspan","controls","controlslist","coords","crossorigin","datetime","decoding","default","dir","disabled","disablepictureinpicture","disableremoteplayback","download","draggable","enctype","enterkeyhint","exportparts","face","for","headers","height","hidden","high","href","hreflang","id","inert","inputmode","integrity","ismap","kind","label","lang","list
```

---

### Incident Patch 13: `44a7532d` (2026-03-26)
**Commit Message**: fix: upgrade all dependencies with known CRITICAL/HIGH vulnerabilities

**File**: `.github/workflows/shared-packages.yml` (modified, +5/-2)
```diff
@@ -77,6 +77,10 @@ jobs:
           format: "table"
           output: "trivy-scanning-results.txt"
 
+      - name: Print Trivy results
+        if: always()
+        run: cat trivy-scanning-results.txt
+
       - name: Check licenses
         run: |
           uv run ./check_licenses.sh
@@ -220,8 +224,7 @@ jobs:
         run: |
           uv sync --only-group dev
           uv pip install --find-links dist \
-            "$(ls dist/ragbits-*.whl)[a2a,azure,chroma,cli,fastembed,fastembed-gpu,gcs,google-drive,hf,local,logfire,mcp,openai,otel,pgvector,promptfoo,qdrant,ray,relari,s3,sql,unstructured,weaviate]" \
-            docling==2.15.1 torch==2.2.2 pyarrow==17.0.0 ray==2.43.0
+            "$(ls dist/ragbits-*.whl)[a2a,azure,chroma,cli,fastembed,fastembed-gpu,gcs,google-drive,hf,local,logfire,mcp,openai,otel,pgvector,promptfoo,qdrant,ray,relari,s3,sql,unstructured,weaviate]"
 
       - name: Run Tests With Coverage
         run: |
```

**File**: `.libraries-whitelist.txt` (modified, +2/-1)
```diff
@@ -12,4 +12,5 @@ pytest-postgresql
 python-bidi
 griffe
 types-requests
-sse-starlette
\ No newline at end of file
+sse-starlette
+nvidia-cusparselt-cu12
\ No newline at end of file
```

**File**: `.license-whitelist.txt` (modified, +1/-0)
```diff
@@ -19,6 +19,7 @@ MIT License, Mozilla Public License 2.0 (MPL 2.0)
 Mozilla Public License 2.0 (MPL 2.0)
 Public Domain
 Python Software Foundation License
+PSF-2.0
 Python Software Foundation License, MIT License
 Unlicense
 Proprietary License
```

**File**: `.trivyignore` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+# ray 2.43.0: ray 2.52+ hangs in CI during ray.data operations — tested ray.init(num_cpus),
+# materialize(), concurrency=1, RAY_NUM_CPUS env var — none resolved the hang.
+# CVE is browser-based RCE via Safari/Firefox — not applicable to backend batch processing.
+CVE-2025-62593
+
+# pillow 10.4.0: blocked by docling 2.65.x (pillow<12.0.0) and fastembed (numpy<2.0.0).
+# CVE requires processing a malicious PSD file — low risk for our document pipeline.
+CVE-2026-25990
\ No newline at end of file
```

**File**: `package-lock.json` (modified, +244/-156)
```diff
@@ -120,6 +120,7 @@
       "integrity": "sha512-bXYxrXFubeYdvB0NhD/NBB3Qi6aZeV20GOWVI47t2dkecCEoneR4NPVcb7abpXDEvejgrUfFtG6vG/zxAKmg+g==",
       "dev": true,
       "license": "MIT",
+      "peer": true,
       "dependencies": {
         "@ampproject/remapping": "^2.2.0",
         "@babel/code-frame": "^7.27.1",
@@ -495,6 +496,7 @@
         }
       ],
       "license": "MIT",
+      "peer": true,
       "engines": {
         "node": ">=18"
       },
@@ -536,6 +538,7 @@
         }
       ],
       "license": "MIT",
+      "peer": true,
       "engines": {
         "node": ">=18"
       }
@@ -1087,9 +1090,9 @@
       }
     },
     "node_modules/@eslint/eslintrc/node_modules/ajv": {
-      "version": "6.12.6",
-      "resolved": "https://registry.npmjs.org/ajv/-/ajv-6.12.6.tgz",
-      "integrity": "sha512-j3fVLgvTo527anyYyJOGTYJbG+vnnQYvE0m5mmkc1TK+nxAppkCLMIL0aZ4dblVCNoGShhm+kzE4ZUykBoMg4g==",
+      "version": "6.14.0",
+      "resolved": "https://registry.npmjs.org/ajv/-/ajv-6.14.0.tgz",
+      "integrity": "sha512-IWrosm/yrn43eiKqkfkHis7QioDleaXQHdDVPKg0FSwwd/DuvyX79TZnFOnYpB7dcsFAMmtFztZuXPDvSePkFw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -2334,6 +2337,7 @@
       "resolved": "https://registry.npmjs.org/@heroui/system/-/system-2.4.19.tgz",
       "integrity": "sha512-glLZASHQPmyE4BGVD22VyBb/vP0CRfHVFmA8/TXmNWqGLmapmcWgbJ3cnKOE7DWRFns4bMTe2LqSj1rgjt/EjA==",
       "license": "MIT",
+      "peer": true,
       "dependencies": {
         "@heroui/react-utils": "2.1.12",
         "@heroui/system-rsc": "2.3.16",
@@ -2419,6 +2423,7 @@
       "resolved": "https://registry.npmjs.org/@heroui/theme/-/theme-2.4.19.tgz",
       "integrity": "sha512-MksRtU/ux5d9Ogv8duIkBcddrY1W6YuhP9fgaucsvgEDKE9JiSLsb4owI63x1uC0GYQ0+4DIH164E2Lm6KOejQ==",
       "license": "MIT",
+      "peer": true,
       "dependencies": {
         "@heroui/shared-utils": "2.1.10",
         "clsx": "^1.2.1",
@@ -4630,6 +4635,7 @@
       "resolved": "https://registry.npmjs.org/@rjsf/utils/-/utils-5.24.12.tgz",
       "integrity": "sha512-fDwQB0XkjZjpdFUz5UAnuZj8nnbxDbX5tp+jTOjjJKw2TMQ9gFFYCQ12lSpdhezA2YgEGZfxyYTGW0DKDL5Drg==",
       "license": "Apache-2.0",
+      "peer": true,
       "dependencies": {
         "json-schema-merge-allof": "^0.8.1",
         "jsonpointer": "^5.0.1",
@@ -4670,9 +4676,9 @@
       "license": "MIT"
     },
     "node_modules/@rollup/rollup-android-arm-eabi": {
-      "version": "4.44.1",
-      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm-eabi/-/rollup-android-arm-eabi-4.44.1.tgz",
-      "integrity": "sha512-JAcBr1+fgqx20m7Fwe1DxPUl/hPkee6jA6Pl7n1v2EFiktAHenTaXl5aIFjUIEsfn9w3HE4gK1lEgNGMzBDs1w==",
+      "version": "4.60.0",
+      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm-eabi/-/rollup-android-arm-eabi-4.60.0.tgz",
+      "integrity": "sha512-WOhNW9K8bR3kf4zLxbfg6Pxu2ybOUbB2AjMDHSQx86LIF4rH4Ft7vmMwNt0loO0eonglSNy4cpD3MKXXKQu0/A==",
       "cpu": [
         "arm"
       ],
@@ -4684,9 +4690,9 @@
       ]
     },
     "node_modules/@rollup/rollup-android-arm64": {
-      "version": "4.44.1",
-      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm64/-/rollup-android-arm64-4.44.1.tgz",
-      "integrity": "sha512-RurZetXqTu4p+G0ChbnkwBuAtwAbIwJkycw1n6GvlGlBuS4u5qlr5opix8cBAYFJgaY05TWtM+LaoFggUmbZEQ==",
+      "version": "4.60.0",
+      "resolved": "https://registry.npmjs.org/@rollup/rollup-android-arm64/-/rollup-android-arm64-4.60.0.tgz",
+      "integrity": "sha512-u6JHLll5QKRvjciE78bQXDmqRqNs5M/3GVqZeMwvmjaNODJih/WIrJlFVEihvV0MiYFmd+ZyPr9wxOVbPAG2Iw==",
       "cpu": [
         "arm64"
       ],
@@ -4698,9 +4704,9 @@
       ]
     },
     "node_modules/@rollup/rollup-darwin-arm64": {
-      "version": "4.44.1",
-      "resolved": "https://registry.npmjs.org/@rollup/rollup-darwin-arm64/-/rollup-darwin-arm64-4.44.1.tgz",
-      "integrity": "sha512-fM/xPesi7g2M7chk37LOnmnSTHLG/v2ggWqKj3CCA1rMA4mm5KVBT1fNoswbo1JhPuNNZrVwpTvlCVggv8A2zg==",
+      "version": "4.60.0",
+      "resolved": "https://registry.npmjs.org/@rollup/rollup-darwin-arm64/-/rollup-darwin-arm64-4.60.0.tgz",
+      "integrity": "sha512-qEF7CsKKzSRc20Ciu2Zw1wRrBz4g56F7r/vRwY430UPp/nt1x21Q/fpJ9N5l47WWvJlkNCPJz3QRVw008fi7yA==",
       "cpu": [
         "arm64"
       ],
@@ -4712,9 +4718,9 @@
       ]
     },
     "node_modules/@rollup/rollup-darwin-x64": {
-      "version": "4.44.1",
-      "resolved": "https://registry.npmjs.org/@rollup/rollup-darwin-x64/-/rollup-darwin-x64-4.44.1.tgz",
-      "integrity": "sha512-gDnWk57urJrkrHQ2WVx9TSVTH7lSlU7E3AFqiko+bgjlh78aJ88/3nycMax52VIVjIm3ObXnDL2H00e/xzoipw==",
+      "version": "4.60.0",
+      "resolved": "https://registry.npmjs.org/@rollup/rollup-darwin-x64/-/rollup-darwin-x64-4.60.0.tgz",
+      "integrity": "sha512-WADYozJ4QCnXCH4wPB+3FuGmDPoFseVCUrANmA5LWwGmC6FL14BWC7pcq+FstOZv3baGX65tZ378uT6WG8ynTw==",
       "cpu": [
         "x64"
       ],
@@ -4726,9 +4732,9 @@
       ]
     },
     "node_modules/@rollup/r
```

**File**: `packages/ragbits-agents/CHANGELOG.md` (modified, +4/-0)
```diff
@@ -2,6 +2,10 @@
 
 ## Unreleased
 
+### Changed
+
+- Bump mcp dependency to >=1.23.0 for DNS rebinding fix (CVE-2025-66416)
+
 ## 1.6.1 (2026-03-19)
 
 - ragbits-core updated to version v1.6.1
```

**File**: `packages/ragbits-agents/pyproject.toml` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ a2a = [
     "uvicorn>=0.31.0,<1.0.0",
 ]
 mcp = [
-    "mcp>=1.9.4,<2.0.0",
+    "mcp>=1.23.0,<2.0.0",
 ]
 openai = [
     "openai>=1.91.0,<2.0.0",
```

**File**: `packages/ragbits-agents/src/ragbits/agents/_main.py` (modified, +2/-2)
```diff
@@ -1196,8 +1196,8 @@ async def get_agent_card(
             version=version,
             description=description,
             url=f"{protocol}://{host}:{port}",
-            defaultInputModes=default_input_modes or ["text"],
-            defaultOutputModes=default_output_modes or ["text"],
+            default_input_modes=default_input_modes or ["text"],
+            default_output_modes=default_output_modes or ["text"],
             skills=skills or await self._extract_agent_skills(),
             capabilities=capabilities or AgentCapabilities(),
         )
```

---

### Incident Patch 14: `5ccdc627` (2026-03-25)
**Commit Message**: fix: cap litellm below 1.82.7 due to supply chain vulnerability and make Trivy fail CI on critical/high findings

**File**: `.github/workflows/shared-packages.yml` (modified, +2/-2)
```diff
@@ -71,8 +71,8 @@ jobs:
         with:
           scan-type: "fs"
           ignore-unfixed: true
-          exit-code: 0 # change if you want to fail build on vulnerabilities
-          severity: "CRITICAL,HIGH,MEDIUM"
+          exit-code: 1
+          severity: "CRITICAL,HIGH"
           skip-dirs: .venv,.ruff_cache,.mypy_cache
           format: "table"
           output: "trivy-scanning-results.txt"
```

**File**: `packages/ragbits-core/pyproject.toml` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ dependencies = [
     "pydantic>=2.9.1,<3.0.0",
     "typer>=0.12.5,<1.0.0",
     "tomli>=2.0.2,<3.0.0",
-    "litellm>=1.74.0,<2.0.0",
+    "litellm>=1.74.0,<1.82.7",
     "aiohttp>=3.10.8,<4.0.0",
     "filetype>=1.2.0,<2.0.0",
     "griffe>=1.7.3,<2.0.0"
```

**File**: `uv.lock` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 version = 1
-revision = 2
+revision = 3
 requires-python = ">=3.10"
 resolution-markers = [
     "python_full_version < '3.11' and platform_machine == 'x86_64' and sys_platform == 'darwin'",
@@ -5273,7 +5273,7 @@ requires-dist = [
     { name = "googleapis-common-protos", marker = "extra == 'google-drive'", specifier = ">=1.70.0,<2.0.0" },
     { name = "griffe", specifier = ">=1.7.3,<2.0.0" },
     { name = "jinja2", specifier = ">=3.1.4,<4.0.0" },
-    { name = "litellm", specifier = ">=1.74.0,<2.0.0" },
+    { name = "litellm", specifier = ">=1.74.0,<1.82.7" },
     { name = "logfire", marker = "extra == 'logfire'", specifier = ">=3.19.0,<4.0.0" },
     { name = "logfire", extras = ["system-metrics"], marker = "extra == 'logfire'", specifier = ">=3.19.0,<4.0.0" },
     { name = "numpy", marker = "extra == 'local'", specifier = ">=1.26.0,<2.0.0" },
```

---

### Incident Patch 15: `73c9fc50` (2026-03-18)
**Commit Message**: ci: extract reusable deploy-docs workflow and fix missing git confi

**File**: `.github/workflows/deploy-docs.yml` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+name: Deploy documentation
+
+on:
+  workflow_call:
+    inputs:
+      version:
+        description: 'Version to deploy (e.g. "1.6.0" or "nightly")'
+        required: true
+        type: string
+      alias:
+        description: 'Optional alias (e.g. "stable"). When set, --update-aliases is used.'
+        required: false
+        type: string
+  workflow_dispatch:
+    inputs:
+      version:
+        description: 'Version to deploy (e.g. "1.6.0" or "nightly")'
+        required: true
+        type: string
+      alias:
+        description: 'Optional alias (e.g. "stable"). When set, --update-aliases is used.'
+        required: false
+        type: string
+      ref:
+        description: 'Git ref to checkout'
+        required: false
+        type: string
+        default: ''
+
+jobs:
+  deploy-docs:
+    runs-on: ubuntu-latest
+    permissions:
+      contents: write
+    steps:
+      - uses: actions/checkout@v4
+        with:
+          ref: ${{ inputs.ref || github.ref }}
+          token: ${{ secrets.GH_TOKEN }}
+          fetch-depth: 0
+
+      - name: Install uv
+        uses: astral-sh/setup-uv@v2
+        with:
+          version: ${{ vars.UV_VERSION || '0.6.9' }}
+
+      - name: Set up Python
+        uses: actions/setup-python@v4
+        with:
+          python-version: "3.10"
+
+      - name: Deploy documentation
+        shell: bash
+        run: |
+          git config user.name "ds-ragbits-robot"
+          git config user.email "ds-ragbits-robot@deepsense.ai"
+          git fetch origin gh-pages
+          if [ -n "$ALIAS" ]; then
+            uv run mike deploy --push --alias-type copy --update-aliases "$VERSION" "$ALIAS"
+          else
+            uv run mike deploy --push --alias-type copy "$VERSION"
+          fi
+        env:
+          GH_TOKEN: ${{ secrets.GH_TOKEN }}
+          VERSION: ${{ inputs.version }}
+          ALIAS: ${{ inputs.alias }}
```

**File**: `.github/workflows/nightly-build.yml` (modified, +8/-10)
```diff
@@ -161,22 +161,20 @@ jobs:
           TWINE_REPOSITORY_URL: ${{ vars.PYPI_URL || 'https://test.pypi.org/legacy/' }}
           TWINE_PASSWORD: ${{ secrets.PYPI_TOKEN }}
 
-      - name: Deploy nightly documentation
-        shell: bash
-        run: |
-          git config user.name "ds-ragbits-robot"
-          git config user.email "ds-ragbits-robot@users.noreply.github.com"
-          git fetch origin gh-pages
-          uv run mike deploy --push --alias-type copy nightly
-        env:
-          GH_TOKEN: ${{ secrets.GH_TOKEN }}
-
       - name: Notify on failure
         if: failure()
         run: |
           echo "Nightly build failed for commit ${{ needs.check-for-changes.outputs.commit-hash }}"
           echo "Version attempted: ${{ needs.check-for-changes.outputs.nightly-version }}"
 
+  deploy-docs:
+    needs: [check-for-changes, test-packages]
+    if: ${{ github.event_name == 'schedule' || inputs.dry-run != true }}
+    uses: ./.github/workflows/deploy-docs.yml
+    with:
+      version: nightly
+    secrets: inherit
+
   publish-npm:
     needs: [check-for-changes, test-packages]
     if: ${{ github.event_name == 'schedule' || inputs.dry-run != true }}
```

**File**: `.github/workflows/publish-pypi.yml` (modified, +10/-6)
```diff
@@ -11,6 +11,8 @@ jobs:
   publish-release:
     if: startsWith(github.head_ref, 'release/') && github.event.pull_request.merged == true && github.event.pull_request.user.login == 'ds-ragbits-robot'
     runs-on: ubuntu-latest
+    outputs:
+      doc_version: ${{ steps.tag_name.outputs.doc_version }}
     steps:
       - uses: actions/checkout@v4
 
@@ -29,6 +31,7 @@ jobs:
         run: |
           TAG_NAME=$(echo "${{ github.event.pull_request.head.ref }}" | sed 's/.*-//')
           echo "new_tag=$TAG_NAME" >> "$GITHUB_OUTPUT"
+          echo "doc_version=$(echo "$TAG_NAME" | sed 's/^v//')" >> "$GITHUB_OUTPUT"
 
       - name: Create release notes
         run: |
@@ -54,9 +57,10 @@ jobs:
             TWINE_PASSWORD: ${{ secrets.PYPI_TOKEN }}
             TWINE_REPOSITORY_URL: ${{ vars.PYPI_URL || 'https://test.pypi.org/legacy/' }}
 
-      - name: Deploy documentation
-        run: |
-          git fetch origin gh-pages
-          uv run mike deploy --push --alias-type copy --update-aliases ${{ steps.tag_name.outputs.new_tag }} stable
-        env:
-          GH_TOKEN: ${{ secrets.GH_TOKEN }}
+  deploy-docs:
+    needs: publish-release
+    uses: ./.github/workflows/deploy-docs.yml
+    with:
+      version: ${{ needs.publish-release.outputs.doc_version }}
+      alias: stable
+    secrets: inherit
```

#### Recent Merged Pull Requests:
- **PR #989** (closed): feat(evaluate): add EvalPort data loader (@mikemikimike)
- **PR #988** (closed): fix(unstructured): run local partition off event loop (@mikemikimike)
- **PR #987** (closed): fix: enforce final limits in hybrid retrieval (@mikemikimike)
- **PR #985** (closed): feat(chat): allow configuring frontend base URL (@mikemikimike)
- **PR #982** (closed): docs: fix retrieval typos (@cosmopolitan033)
- **PR #978** (2026-05-12): feat: support pydantic models in tool arguments (@puzzle-solver)
- **PR #976** (2026-04-27): fix: add encoding='utf-8' to write_text in install_git_hooks.py (@AabhasK)
- **PR #974** (2026-05-12): docs: add Ollama support documentation (@aholka)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
