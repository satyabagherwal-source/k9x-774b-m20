# Forensic Learning Record (Deep Inspection): langroid/langroid

> **Canonical Artifact**: `07_PROJECT_LEARNING/langroid-langroid-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/langroid/langroid](https://github.com/langroid/langroid))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:59:42.650Z  
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

### Core Architecture Module: `examples/basic/1-agent-3-tools-address-user.py`
```
"""
Barebones example of a single agent using 3 tools.
Similar to 1-agent-3-tools.py, but here the task is set up
with `interactive=False`, meaning user input is awaited only
when user is explicitly addressed using an addressing prefix.
"""

from typing import Any, List, Tuple

import fire

import langroid as lr
import langroid.language_models as lm
from langroid.agent.tools.orchestration import ForwardTool
from langroid.utils.configuration import settings
from langroid.utils.constants import AT

DEFAULT_LLM = lm.OpenAIChatModel.GPT4o

# (1) DEFINE THE TOOLS


class UpdateTool(lr.ToolMessage):
    request: str = "update"
    purpose: str = "To update the stored number to the given <number>"
    number: int

    @classmethod
    def examples(cls) -> List["lr.ToolMessage" | Tuple[str, "lr.ToolMessage"]]:
        # Examples that will be compiled into few-shot examples for the LLM.
        # Each example can either be...
        return [
            cls(number=3),  # ... just instances of the tool-class, OR
            (  # ...a tuple of "thought leading to tool", and the tool instance
                "I want to update the stored number to number 4 from the user",
                cls(number=4),
            ),
        ]


class AddTool(lr.ToolMessage):
    request: str = "add"
    purpose: str = "To add the given <number> to the stored number"
    number: int

    @classmethod
    def examples(cls) -> List["lr.ToolMessage" | Tuple[str, "lr.ToolMessage"]]:
        return [
            cls(number=3),
            (
                "I want to add number 10 to the stored number",
                cls(number=10),
            ),
        ]


class ShowTool(lr.ToolMessage):
    request: str = "show"
    purpose: str = "To show the user the stored <number>"

    @classmethod
    def examples(cls) -> List["lr.ToolMessage" | Tuple[str, "lr.ToolMessage"]]:
        return [
            cls(number=3),
            (
                "I want to show the user the stored number 10",
                cls(number=10),
            ),
        ]


# (2) DEFINE THE AGENT, with the tool-handling methods
class NumberAgent(lr.ChatAgent):
    secret: int = 0

    def update(self, msg: UpdateTool) -> str:
        self.secret = msg.number
        return f"Ok I updated the stored number to {msg.number}"

    def add(self, msg: AddTool) -> str:
        self.secret += msg.number
        return f"Added {msg.number} to stored number => {self.secret}"

    def show(self, msg: ShowTool) -> str:
        return f"Inform the user that the SECRET NUMBER is {self.secret}"

    def handle_message_fallback(self, msg: str | lr.ChatDocument) -> Any:
        """
        If we're here it means there was no recognized tool in `msg`.
        So if it was from LLM, use ForwardTool to send to user.
        """
        if isinstance(msg, lr.ChatDocument) and msg.metadata.sender == lr.Entity.LLM:
            return ForwardTool(agent="User")


def app(
    m: str = DEFAULT_LLM,  # pass -d <model> to use non-default LLM
    d: bool = False,  # pass -d to enable debug mode (see prompts etc)
    nc: bool = False,  # pass -nc to disable cache-retrieval (i.e. get fresh answers)
):
    settings.debug = d
    settings.cache = not nc
    # create LLM config
    llm_cfg = lm.OpenAIGPTConfig(
        chat_model=m or DEFAULT_LLM,
        chat_context_length=4096,  # set this based on model
        max_output_tokens=100,
        temperature=0.2,
        stream=True,
        timeout=45,
    )

    # (3) CREATE THE AGENT
    agent_config = lr.ChatAgentConfig(
        name="NumberAgent",
        llm=llm_cfg,
        system_message=f"""
        When the user's request matches one of your available tools, use it, 
        otherwise respond directly to the user.
        NOTE: Whenever you want to address the user directly, you MUST
        use "{AT}User", followed by your message. 
        """,
    )

    agent = NumberAgent(agent_config)

    # (4) ENABLE/ATTACH THE TOOLS to the AGENT

    agent.enable_message(UpdateTool)
    agent.enable_message(AddTool)
    agent.enable_message(ShowTool)

    # (5) CREATE AND RUN THE TASK
    task_config = lr.TaskConfig(addressing_prefix=AT)
    task = lr.Task(agent, interactive=False, config=task_config)

    """
    Note: try saying these when it waits for user input:
    
    add 10
    update 50
    add 3
    show 
    """

    task.run()


if __name__ == "__main__":
    fire.Fire(app)

```

### Core Architecture Module: `examples/basic/1-agent-3-tools.py`
```
"""
Barebones example of a single agent using 3 tools.

"""

from typing import Any, List, Tuple

import fire

import langroid as lr
import langroid.language_models as lm
from langroid.agent.tools.orchestration import ForwardTool
from langroid.utils.configuration import settings

DEFAULT_LLM = lm.OpenAIChatModel.GPT4o

# (1) DEFINE THE TOOLS


class UpdateTool(lr.ToolMessage):
    request: str = "update"
    purpose: str = "To update the stored number to the given <number>"
    number: int

    @classmethod
    def examples(cls) -> List["lr.ToolMessage" | Tuple[str, "lr.ToolMessage"]]:
        # Examples that will be compiled into few-shot examples for the LLM.
        # Each example can either be...
        return [
            cls(number=3),  # ... just instances of the tool-class, OR
            (  # ...a tuple of "thought leading to tool", and the tool instance
                "I want to update the stored number to number 4 from the user",
                cls(number=4),
            ),
        ]


class AddTool(lr.ToolMessage):
    request: str = "add"
    purpose: str = "To add the given <number> to the stored number"
    number: int

    @classmethod
    def examples(cls) -> List["lr.ToolMessage" | Tuple[str, "lr.ToolMessage"]]:
        return [
            cls(number=3),
            (
                "I want to add number 10 to the stored number",
                cls(number=10),
            ),
        ]


class ShowTool(lr.ToolMessage):
    request: str = "show"
    purpose: str = "To show the user the stored <number>"

    @classmethod
    def examples(cls) -> List["lr.ToolMessage" | Tuple[str, "lr.ToolMessage"]]:
        return [
            cls(number=3),
            (
                "I want to show the user the stored number 10",
                cls(number=10),
            ),
        ]


# (2) DEFINE THE AGENT, with the tool-handling methods
class NumberAgent(lr.ChatAgent):
    secret: int = 0

    def update(self, msg: UpdateTool) -> str:
        self.secret = msg.number
        return f"""
            Ok I updated the stored number to {msg.number}.
            Ask the user what they want to do
        """

    def add(self, msg: AddTool) -> str:
        self.secret += msg.number
        return f"""
            Added {msg.number} to stored number => {self.secret}.
            Ask the user what they want to do.
        """

    def show(self, msg: ShowTool) -> str:
        return f"Tell the user that the SECRET NUMBER is {self.secret}"

    def handle_message_fallback(self, msg: str | lr.ChatDocument) -> Any:
        """
        If we're here it means there was no recognized tool in `msg`.
        So if it was from LLM, use ForwardTool to send to user.
        """
        if isinstance(msg, lr.ChatDocument) and msg.metadata.sender == lr.Entity.LLM:
            return ForwardTool(agent="User")


def app(
    m: str = DEFAULT_LLM,  # model
    d: bool = False,  # pass -d to enable debug mode (see prompts etc)
    nc: bool = False,  # pass -nc to disable cache-retrieval (i.e. get fresh answers)
):
    settings.debug = d
    settings.cache = not nc
    # create LLM config
    llm_cfg = lm.OpenAIGPTConfig(
        chat_model=m or DEFAULT_LLM,
        chat_context_length=4096,  # set this based on model
        max_output_tokens=100,
        temperature=0.2,
        stream=True,
        timeout=45,
    )

    # (3) CREATE THE AGENT
    agent_config = lr.ChatAgentConfig(
        name="NumberAgent",
        llm=llm_cfg,
        system_message="""
        When the user's request matches one of your available tools, use it, 
        otherwise respond directly to the user.
        """,
    )

    agent = NumberAgent(agent_config)

    # (4) ENABLE/ATTACH THE TOOLS to the AGENT

    agent.enable_message(UpdateTool)
    agent.enable_message(AddTool)
    agent.enable_message(ShowTool)

    # (5) CREATE AND RUN THE TASK
    task = lr.Task(agent, interactive=False)

    """
    Note: try saying these when it waits for user input:
    
    add 10
    update 50
    add 3
    show <--- in this case remember to hit enter when it waits for your input.
    """
    task.run()


if __name__ == "__main__":
    fire.Fire(app)

```

### Core Architecture Module: `examples/basic/1d-screen-click.py`
```
"""

A Bit-Shooter Game played on a 1-dimensional binary screen.

Given an LLM Agent access to a 1-dimensional "screen" represented
as a string of bits (0s and 1s), e.g. "101010",
and equip it with a "Click tool" (like a mouse click) that allows it to
click on a bit -- clicking the bit causes it to flip.

The Agent plays a "Bit Shooter" game where the goal is to get rid of all
1s in the "screen".

To use the Click tool, the Agent must specify the position (zero-based)
where it wants to click. This causes the bit to flip.
The LLM is then presented with the new state of the screen,
and the process repeats until all 1s are gone.

Clearly the Agent (LLM) needs to be able to accurately count the bit positions,
to be able to correctly click on the 1s.

Run like this (--model is optional, defaults to GPT4o):

python3 examples/basic/1d-screen-click.py --model litellm/anthropic/claude-3-5-sonnet-20241022

At the beginning you get to specify the initial state of the screen:
- size of the screen (how many bits)
- the (0-based) locations of the 1s (SPACE-separated) in the screen.

E.g. try this:
- size = 50,
- 1-indices: 0 20 30 40

The loop is set to run in interactive mode (to prevent runaway loops),
so you have to keep hitting enter to see the LLM's next move.

The main observation is that when you run it with claude-3.5-sonnet,
the accuracy of the Agent's clicks is far superior to other LLMs like GPT-4o
and even GPT-4.

To try with other LLMs, you can set the --model param to, for example:
- gpt-4 (set OPENAI_API_KEY in your env or .env file)
- gpt-4o (ditto, set OPENAI_API_KEY)
- groq/llama-3.1-70b-versatile (set GROQ_API_KEY in your env or .env file)
- cerebras/llama3.1-70b (set CEREBRAS_API_KEY in your env or .env file)
- ollama/qwen2.5-coder:latest

See here for a full guide on local/open LLM setup with Langroid:
https://langroid.github.io/langroid/tutorials/local-llm-setup/
And here for how to use with other non-OpenAPI LLMs:
https://langroid.github.io/langroid/tutorials/non-openai-llms/
"""

from typing import List, Tuple

import fire
from rich.prompt import Prompt

import langroid as lr
import langroid.language_models as lm
from langroid.agent.tools.orchestration import AgentDoneTool
from pydantic import BaseModel
from langroid.utils.globals import GlobalState


class ScreenState(BaseModel):
    """
    Represents the state of the 1-dimensional binary screen
    """

    screen: str | None = None  # binary string, e.g. "101010"

    def __init__(
        self,
        one_indices: List[int] = [1],
        size: int = 1,
    ):
        super().__init__()
        # Initialize with all zeros
        screen_list = ["0"] * size

        # Set 1s at specified indices
        for idx in one_indices:
            if 0 <= idx < size:
                screen_list[idx] = "1"

        # Join into string
        self.screen = "".join(screen_list)

    @classmethod
    def set_state(
        cls,
        one_indices: List[int],
        size: int,
    ) -> "ScreenState":
        """
        Factory method to create and set initial state.
        """
        initial_state = cls(
            one_indices=one_indices,
            size=size,
        )
        GlobalScreenState.set_values(state=initial_state)

    def flip(self, i: int):
        """
        Flip the i-th bit
        """
        if self.screen is None or i < 0 or i >= len(self.screen):
            return

        screen_list = list(self.screen)
        screen_list[i] = "1" if screen_list[i] == "0" else "0"
        self.screen = "".join(screen_list)


class GlobalScreenState(GlobalState):
    state: ScreenState = ScreenState()


def get_state() -> ScreenState:
    return GlobalScreenState.get_value("state")


class ClickTool(lr.ToolMessage):
    request: str = "click_tool"
    purpose: str = """
        To click at <position> on the 1-dimensional binary screen, 
        which causes the bit at that position to FLIP.
        IMPORTANT: the position numbering starts from 0!!!
    """

    position: int

    @classmethod
    def examples(cls) -> List[lr.ToolMessage | Tuple[str, lr.ToolMessage]]:
        return [
            cls(position=3),
            (
                "I want to click at position 5",
                cls(position=5),
            ),
        ]

    def handle(self) -> str | AgentDoneTool:
        state = get_state()
        state.flip(self.position)
        print("SCREEN STATE = ", state.screen)
        if "1" not in state.screen:
            return AgentDoneTool()
        return state.screen


def main(model: str = ""):
    llm_config = lm.OpenAIGPTConfig(
        chat_model=model or lm.OpenAIChatModel.GPT4o,
    )
    click_tool_name = ClickTool.default_value("request")
    agent = lr.ChatAgent(
        lr.ChatAgentConfig(
            name="Clicker",
            llm=llm_config,
            use_functions_api=False,  # suppress OpenAI functions/tools
            use_tools=True,  # enable langroid-native tools: works with any LLM
            show_stats=False,
            system_message=f"""
            You are an expert at COMPUTER USE.
            In this task you only have to be able to understand a 1-dimensional 
            screen presented to you as a string of bits (0s and 1s).
            You will play a 1-dimensional BIT-shooter game!
            
            Your task is to CLICK ON THE LEFTMOST 1 in the bit-string, 
            to flip it to a 0.
            
            Always try to click on the LEFTMOST 1 in the bit-sequence. 
            
            To CLICK on the screen you 
            must use the TOOL `{click_tool_name}` where the  
            `position` field specifies the position (zero-based) to click.
            If you CORRECTLY click on a 1, the bit at that position will be 
            turned to 0.
            But if you click on a 0, it will turn into a 1, 
            taking you further from your goal.
            
            So you MUST ACCURATELY specify the position of the LEFTMOST 1 to click,
            making SURE there is a 1 at that position.
            In other words, it is critical that you are able to ACCURATELY COUNT 
            the bit positions so that you are able to correctly identify the position 
            of the LEFTMOST 1 bit in the "screen" given to you as a string of bits.
            """,
        )
    )

    agent.enable_message(ClickTool)

    task = lr.Task(agent, interactive=True, only_user_quits_root=False)

    # kick it off with initial screen state (set below by user)
    task.run(get_state())


if __name__ == "__main__":
    size = int(Prompt.ask("Size of screen (how many bits)"))
    ones = Prompt.ask("Indices of 1s (SPACE-separated)").split(" ")
    ones = [int(x) for x in ones]
    ScreenState.set_state(ones, size)
    print("SCREEN STATE = ", get_state().screen)
    fire.Fire(main)

```

### Core Architecture Module: `examples/basic/2-agent-tools.py`
```
"""
2 Agent setup where Main agent asks a question, Helper has a few tools to help answer,
and for any question, Helper finishes after first use of any tool.

Run like this:

python3 examples/basic/2-agent-tools.py

When it waits for user input, try asking things like:

- capital of uganda?
    => Main answers
- polinsky of 4?
    => Main says do not know, handled by helper, who returns answer
- chichikov of 5?
    => Main says do not know, handled by helper, who returns answer
"""

from typing import Any

import langroid as lr
from langroid.agent.tools.orchestration import AgentDoneTool, ForwardTool


class MainChatAgent(lr.ChatAgent):
    def handle_message_fallback(self, msg: str | lr.ChatDocument) -> Any:
        """
        We'd be here if there were no recognized tools in the incoming msg.
        If this was from LLM, forward to user.
        """
        if isinstance(msg, lr.ChatDocument) and msg.metadata.sender == lr.Entity.LLM:
            return ForwardTool(agent="User")


main = MainChatAgent(
    lr.ChatAgentConfig(
        name="Main",
        system_message=f"""
        Help the user with their questions. When you don't know the answer, 
        simply say {lr.utils.constants.NO_ANSWER} and nothing else.
        Your Helper will attempt to handle the question, and send you back their
        answer, and you can present it to the user.   
        
        At the BEGINNING, ask the user what they need help with.
        """,
    )
)


class PolinskyTool(lr.ToolMessage):
    request: str = "polinsky"
    purpose: str = "To compute the polinsky transform of a <number>"
    number: int

    def handle(self) -> AgentDoneTool:
        p = 3 * self.number + 1
        return AgentDoneTool(content=f"The Polinsky transform of {self.number} is {p}")


class ChichikovTool(lr.ToolMessage):
    request: str = "chichikov"
    purpose: str = "To compute the Chichikov transform of a <number>"
    number: int

    def handle(self) -> AgentDoneTool:
        n = self.number**2
        return AgentDoneTool(content=f"The Chichikov transform of {self.number} is {n}")


helper = lr.ChatAgent(
    lr.ChatAgentConfig(
        name="Helper",
        system_message="""
        You have a few tools to help answer the user's questions. 
        Decide which tool to use, and send your request using the correct format 
        for the tool.
        """,
    )
)
helper.enable_message(PolinskyTool)
helper.enable_message(ChichikovTool)

main_task = lr.Task(main, interactive=False)
helper_task = lr.Task(helper, interactive=False)

main_task.add_sub_task(helper_task)

main_task.run()

```

### Core Architecture Module: `examples/basic/autocorrect.py`
```
"""
A two agent chat system where
- AutoCorrect agent corrects the user's possibly mistyped input,
- Chatter agent responds to the corrected user's input.

Run it like this:

python3 examples/basic/autocorrect.py

"""

import typer
from rich import print

import langroid as lr
from langroid.agent.chat_agent import ChatAgent, ChatAgentConfig
from langroid.agent.task import Task
from langroid.language_models.openai_gpt import OpenAIChatModel, OpenAIGPTConfig
from langroid.utils.configuration import Settings, set_global
from langroid.utils.logging import setup_colored_logging

app = typer.Typer()

setup_colored_logging()


def chat() -> None:
    print(
        """
        [blue]Welcome to the Autocorrecting Chatbot!
        You can quickly type your message, don't even look at your keyboard. 
        Feel free to type and I will try my best to understand it,
        and I will type out what I think you meant.
        If you agree with my suggestion, just hit enter so I can respond to it.
        If you disagree with my suggestion, say "try again" or say "no" or something 
        similar, and I will try again.
        When I am confused, I will offer some numbered choices to pick from.
        
        Let's go! Enter x or q to quit at any point.
        """
    )

    config = ChatAgentConfig(
        llm=OpenAIGPTConfig(
            chat_model=OpenAIChatModel.GPT4o,
        ),
        vecdb=None,
    )
    autocorrect_agent = ChatAgent(config)
    autocorrect_task = Task(
        autocorrect_agent,
        name="AutoCorrect",
        system_message="""
        You are an expert at understanding mistyped text. You are extremely 
        intelligent, an expert in the English language, and you have common sense, 
        so no matter how badly mistyped the text is, you will know the MOST LIKELY 
        AND SENSIBLE correct version of it.
        For any text you receive, your job is to write the correct version of it, 
        and not say anything else. 
        If you are unsure, offer up to 3 numbered suggestions, and the user will pick 
        one. Once the user selects a suggestion, simply write out that version.
        Remember to ONLY suggest sensible interpretations. For example
        "Which month is the tallest in the world" is meaningless, so you should not
        ever include such a suggestion in your list.
        Start by asking me to writing something.
        """,
    )

    chat_agent = ChatAgent(config)
    chat_task = Task(
        chat_agent,
        name="Chat",
        system_message="Answer or respond very concisely, no more than 1-2 sentences!",
        done_if_no_response=[lr.Entity.LLM],
        done_if_response=[lr.Entity.LLM],
    )
    autocorrect_task.add_sub_task(chat_task)
    autocorrect_task.run()


@app.command()
def main(
    debug: bool = typer.Option(False, "--debug", "-d", help="debug mode"),
    no_stream: bool = typer.Option(False, "--nostream", "-ns", help="no streaming"),
    nocache: bool = typer.Option(False, "--nocache", "-nc", help="don't use cache"),
) -> None:
    set_global(
        Settings(
            debug=debug,
            cache=not nocache,
            stream=not no_stream,
            cache_type="redis",
        )
    )
    chat()


if __name__ == "__main__":
    app()

```

### Core Architecture Module: `examples/basic/chat-2-agent-discuss.py`
```
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "langroid",
# ]
# ///

"""
Give a problem statement, two agents Alice and Bob will discuss it,
and EITHER of them may return a final result via MyFinalResultTool.

Run like this (Omit model to default to GPT4o):

python3 examples/basic/chat-2-agent-discuss.py --model gemini/gemini-2.0-flash-exp

For example, try giving his problem:
What is the prime number that comes after 17?

"""

import logging

from fire import Fire
from rich.prompt import Prompt

import langroid as lr
import langroid.language_models as lm
from langroid.agent.task import TaskConfig
from langroid.agent.tools.orchestration import FinalResultTool

# set info level
logging.basicConfig(level=logging.INFO)


# Any tool subclassed from FinalResultTool can be used to return the final result
# from any agent, and it will short-circuit the flow and return the result.
class MyFinalResultTool(FinalResultTool):
    request: str = "my_final_result_tool"
    purpose: str = "To present the final <result> of a discussion"
    # override this flag since it's False by default
    _allow_llm_use: bool = True

    result: str


def main(model: str = ""):
    problem = Prompt.ask(
        """
        [blue]Alice and Bob will discuss a problem.
        Please enter the problem statement:[/blue]
        """
    )

    llm_config = lm.OpenAIGPTConfig(
        chat_model=model or lm.OpenAIChatModel.GPT4o,
        chat_context_length=128_000,
        timeout=60,
    )

    logging.warning("Setting up Alice, Bob agents...")

    alice = lr.ChatAgent(
        lr.ChatAgentConfig(
            llm=llm_config,
            name="Alice",
            system_message=f"""
            Here is a problem the user wants to solve:
            <problem>
            {problem}
            </problem>
            To solve this, you will engage in a discussion with your colleague Bob.
            At any point, if you decide the problem is solved,
            you must use the TOOL `{MyFinalResultTool.name()}` to
            return the FINAL answer to the problem. 

            In each round of the discussion, limit yourself to a CONCISE
            message.
            """,
        )
    )

    alice.enable_message(MyFinalResultTool)
    # Set `inf_loop_cycle_len` to 0, to turn OFF inf loop detection
    alice_task_config = TaskConfig(inf_loop_cycle_len=10)
    # set up alice_task to return a result of type MyFinalResultTool
    alice_task = lr.Task(alice, config=alice_task_config, interactive=False)[
        MyFinalResultTool
    ]

    bob = lr.ChatAgent(
        lr.ChatAgentConfig(
            llm=llm_config,
            name="Bob",
            system_message=f"""
            Here is a problem the user wants to solve:
            <problem>
            {problem}
            </problem>
            To solve this, you will engage in a discussion with your colleague Alice.
            At any point, if you decide the problem is solved,
            you must use the TOOL `{MyFinalResultTool.name()}` to
            return the FINAL answer to the problem. 

            In each round of the discussion, limit yourself to a CONCISE
            message. 
            
            You will first receive a message from Alice, and you can then follow up. 
            """,
        )
    )

    bob.enable_message(MyFinalResultTool)

    bob_task = lr.Task(bob, interactive=False, single_round=True)

    # make the Con agent the sub-task of the Pro agent, so
    # they go back and forth in the arguments
    alice_task.add_sub_task(bob_task)

    result = alice_task.run("get started")

    print(
        f"""
        FINAL RESULT:
        {result.result}
        """
    )


if __name__ == "__main__":
    Fire(main)

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

### Incident Patch 1: `fa8efb9f` (2026-09-23)
**Commit Message**: docs: fix dead github-cli link in CONTRIBUTING (#1148)

CONTRIBUTING.md pointed contributors at docs/development/github-cli.md,
which was deleted in #127 (2023-07-14) and has no successor in the repo,
so the "Read more" link has been a 404 for ~3 years.

Verified via the contents API (docs/development not found), code search
(0 matches for filename:github-cli) and the commits API (4 commits on the
path, i.e. deleted rather than moved). Re-points at the upstream GitHub CLI
manual. Docs only.

Assisted-by: Claude Code / claude-opus-5[1m]
Machine: MacBook-Anton
Account: a@gmail
Operator: robot:git-s3-docs-fix-lane

Co-authored-by: Anton Dziatkovskii <194927794+tonydzi@users.noreply.github.com>

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -308,7 +308,7 @@ When done with these, commit and push to github and submit the PR. If this
 is an ongoing PR, just push to github again and the PR will be updated.
 
 It is strongly recommended to use the `gh` command-line utility when working with git.
-Read more [here](docs/development/github-cli.md).
+Read more in the [GitHub CLI manual](https://cli.github.com/manual/).
 
 ## Releasing (maintainers)
 
```

---

### Incident Patch 2: `1ad23733` (2026-09-23)
**Commit Message**: fix: merge complete groups of overlapping context windows (#1146) [notest]

* Merge all members of connected context groups

* Test transitive context-window merges

**File**: `langroid/utils/algorithms/graph.py` (modified, +2/-2)
```diff
@@ -88,8 +88,8 @@ def components(order: np.ndarray) -> List[List[int]]:
         else:
             # If the node is connected to multiple groups, we merge them
             main_group = min(connected_groups)
-            for j in np.nonzero(order[i, :])[0]:
-                if i2g.get(j) in connected_groups:
+            for j in i2g:
+                if i2g[j] in connected_groups:
                     i2g[j] = main_group
             i2g[i] = main_group
 
```

**File**: `tests/main/test_graph.py` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import numpy as np
+import pytest
+
+from langroid.utils.algorithms.graph import components
+from langroid.vector_store.base import VectorStore
+
+
+def test_components_merges_entire_groups() -> None:
+    order = np.zeros((6, 6), dtype=int)
+    # Node 4 joins two existing groups, including non-neighbors 0 and 1.
+    for i, j in [(0, 2), (1, 3), (2, 4), (3, 4)]:
+        order[i, j] = order[j, i] = 1
+
+    assert components(order) == [[0, 1, 2, 3, 4], [5]]
+
+
+@pytest.mark.parametrize(
+    "indices",
+    [(0, 1, 2, 3, 4), (4, 3, 2, 1, 0), (0, 2, 4, 3, 1)],
+)
+def test_remove_overlaps_merges_transitive_windows(indices: tuple[int, ...]) -> None:
+    windows = [["a", "b"], ["e", "f"], ["b", "c"], ["d", "e"], ["c", "d"]]
+    windows = [windows[i] for i in indices] + [["x", "y"]]
+
+    assert VectorStore.remove_overlaps(windows) == [
+        ["a", "b", "c", "d", "e", "f"],
+        ["x", "y"],
+    ]
```

---

### Incident Patch 3: `be1c9a57` (2026-09-23)
**Commit Message**: fix: preserve document identity in fuzzy search results (#1145) [notest]

Co-authored-by: dingpuyu <8564180+dingpuyu@users.noreply.github.com>

**File**: `langroid/parsing/search.py` (modified, +5/-9)
```diff
@@ -65,19 +65,15 @@ def find_fuzzy_matches_in_docs(
         return []
     best_matches = process.extract(
         query,
-        [d.content for d in docs_clean],
+        {i: d.content for i, d in enumerate(docs_clean)},
         limit=k,
         scorer=fuzz.partial_ratio,
     )
 
-    real_matches = [(m, score) for m, score in best_matches if score > threshold]
-    # find the original docs that corresponding to the matches
-    orig_doc_matches = []
-    for i, (m, s) in enumerate(real_matches):
-        for j, doc_clean in enumerate(docs_clean):
-            if m in doc_clean.content:
-                orig_doc_matches.append((docs[j], s))
-                break
+    # Preserve document identity when cleaned texts overlap or are identical.
+    orig_doc_matches = [
+        (docs[i], score) for _, score, i in best_matches if score > threshold
+    ]
     if words_after is None and words_before is None:
         return orig_doc_matches
     if len(orig_doc_matches) == 0:
```

**File**: `tests/main/test_doc_chat_retrieval_thresholds.py` (modified, +11/-0)
```diff
@@ -278,6 +278,17 @@ def test_fuzzy_score_threshold_on_reciprocal_rank_fusion_path():
     assert chunks == []
 
 
+def test_fuzzy_retrieval_keeps_documents_with_overlapping_content():
+    agent = _make_fuzzy_agent(None, use_reciprocal_rank_fusion=True)
+    docs = _mk_docs({"long": "quantum mechanics", "short": "quantum"})
+    agent.chunked_docs = docs
+    agent.chunked_docs_clean = docs
+
+    chunks = agent.get_relevant_chunks("quantum entanglement")
+
+    assert [doc.metadata.id for doc in chunks] == ["short", "long"]
+
+
 # values that are not finite numbers: invalid for BOTH thresholds
 _NON_FINITE_THRESHOLDS: List[Any] = [
     None,
```

**File**: `tests/main/test_string_search.py` (modified, +29/-0)
```diff
@@ -54,6 +54,35 @@ def test_return_correct_number_of_matches(
     assert len(results) == n_matches_expected
 
 
+@pytest.mark.parametrize(
+    "contents, query, expected_indices",
+    [
+        (["quantum mechanics", "quantum"], "quantum entanglement", [1, 0]),
+        (["quantum", "quantum"], "quantum", [0, 1]),
+    ],
+)
+@pytest.mark.parametrize("k", [1, 2])
+def test_fuzzy_matches_return_corresponding_documents(
+    contents, query, expected_indices, k
+):
+    docs = [
+        Document(
+            content=content.capitalize() + ".",
+            metadata=DocMetaData(id=str(i), source=f"source-{i}"),
+        )
+        for i, content in enumerate(contents)
+    ]
+    docs_clean = [
+        Document(content=content, metadata=doc.metadata)
+        for content, doc in zip(contents, docs)
+    ]
+
+    results = find_fuzzy_matches_in_docs(query, docs, docs_clean, k)
+
+    assert [doc for doc, _ in results] == [docs[i] for i in expected_indices[:k]]
+    assert results[0][1] == 100
+
+
 @pytest.mark.parametrize(
     "words_before, words_after, expected",
     [
```

---

### Incident Patch 4: `d9f3e955` (2026-09-23)
**Commit Message**: fix: batch exception policies for output_map and cancellation (#1144) [notest]

* fix: apply batch exception policies to output mapping

* fix: propagate external batch cancellation

* fix: only propagate cancellation of the batch itself, not task-raised CancelledError

Combines #1140 (output_map under the exception policy) and #1142
(cancellation propagation), which conflict in the same hunk, and fixes a
regression in #1142: it re-raised every CancelledError, so a task whose own
code raises CancelledError aborted a sequential batch instead of following
RETURN_NONE / RETURN_EXCEPTION (32 cases of test_task_gen_batch_exceptions).

- handle_error now propagates a CancelledError only when the batch's own
  task has been cancelled (asyncio.Task.cancelling(), Python 3.11+; on 3.10
  the previous policy-based behavior is kept).
- In parallel mode, an exception object *returned* by a task under RAISE is a
  normal result and is passed to output_map, not re-raised.
- Parallel mode materializes the coroutine list, so a one-shot iterator input
  can no longer swallow a RAISE failure into an empty result list.
- Document cancellation semantics in docs/notes/batch-processing.md.

Co-Authored-B

**File**: `docs/notes/batch-processing.md` (modified, +22/-0)
```diff
@@ -28,6 +28,28 @@ answers = run_batch_tasks(
 
 The returned list has the same length and ordering as `items`.
 
+## Handling errors
+
+For helpers that accept `handle_exceptions`, the selected policy applies to
+both task execution and `output_map`, in sequential and concurrent batches.
+`RETURN_NONE` puts `None` in a failed item's position; `RETURN_EXCEPTION`
+puts the exception there; `RAISE` propagates it.
+
+`output_map` receives successful task results, including a successful `None`
+result. It does not receive the placeholders produced by error handling.
+
+Cancelling the batch itself (for example, cancelling the `asyncio` task that
+runs it) is not a task failure: the `CancelledError` propagates under every
+policy, and no further items are started. A `CancelledError` raised by a
+task's own code, while the batch is not cancelled, is treated like any other
+exception and follows the policy.
+
+Telling the two apart relies on `asyncio.Task.cancelling()`, available from
+Python 3.11. On Python 3.10, a `CancelledError` caught in the sequential or
+`stop_on_first_result` paths always follows the policy, so under `RETURN_NONE`
+or `RETURN_EXCEPTION` an external cancellation may be recorded as a failed
+item instead of propagating.
+
 ## Stopping at the first valid result
 
 Set `stop_on_first_result=True` for a search-style batch that should return as
```

**File**: `langroid/agent/batch.py` (modified, +57/-23)
```diff
@@ -12,7 +12,6 @@
     Optional,
     TypeVar,
     Union,
-    cast,
 )
 
 from dotenv import load_dotenv
@@ -68,6 +67,20 @@ def _convert_exception_handling(
     )
 
 
+def _batch_cancelled() -> bool:
+    """Whether the task running the batch has itself been cancelled.
+
+    Uses `asyncio.Task.cancelling()` (Python 3.11+); a `CancelledError` raised
+    by a task's own code does not bump this counter, so it can be told apart
+    from external cancellation of the batch. On Python 3.10 the counter is not
+    available and this returns False, which keeps the pre-existing behavior
+    of applying the exception policy to any `CancelledError`.
+    """
+    task = asyncio.current_task()
+    cancelling = getattr(task, "cancelling", None)
+    return cancelling is not None and cancelling() > 0
+
+
 async def _process_batch_async(
     inputs: Iterable[str | ChatDocument],
     do_task: Callable[[str | ChatDocument, int], Coroutine[Any, Any, Any]],
@@ -96,7 +109,15 @@ async def _process_batch_async(
     exception_handling = _convert_exception_handling(handle_exceptions)
 
     def handle_error(e: BaseException) -> Any:
-        """Handle exceptions based on exception_handling."""
+        """Handle failures based on exception_handling.
+
+        A `CancelledError` caused by cancellation of the batch itself always
+        propagates, regardless of policy. A `CancelledError` raised from
+        inside a task (with the batch not cancelled) is an ordinary task
+        failure and follows the policy.
+        """
+        if isinstance(e, asyncio.CancelledError) and _batch_cancelled():
+            raise e
         match exception_handling:
             case ExceptionHandling.RAISE:
                 raise e
@@ -156,31 +177,44 @@ def handle_error(e: BaseException) -> Any:
 
     # Parallel execution
     else:
+        capture_failures = exception_handling != ExceptionHandling.RAISE
+
+        async def run_one(input: str | ChatDocument, i: int) -> tuple[bool, Any]:
+            """Run one task, tagging the outcome as (succeeded, value).
+
+            Tagging keeps an exception object *returned* by a task distinct
+            from one it raised. Under RAISE, failures propagate so that
+            `gather` fails fast, as before.
+            """
+            try:
+                return True, await do_task(input, i)
+            except (KeyboardInterrupt, SystemExit):
+                raise
+            except BaseException as e:
+                if not capture_failures:
+                    raise
+                return False, e
+
+        # Materialize the coroutines so the failure path below sees the batch
+        # size even when `inputs` is a one-shot iterator.
+        coros = [run_one(input, i + start_idx) for i, input in enumerate(inputs)]
         try:
-            return_exceptions = exception_handling != ExceptionHandling.RAISE
             with quiet_mode(), SuppressLoggerWarnings():
-                results_with_exceptions = cast(
-                    list[Optional[ChatDocument | BaseException]],
-                    await asyncio.gather(
-                        *(
-                            do_task(input, i + start_idx)
-                            for i, input in enumerate(inputs)
-                        ),
-                        return_exceptions=return_exceptions,
-                    ),
-                )
-
-                if exception_handling == ExceptionHandling.RETURN_NONE:
-                    results = [
-                        None if isinstance(r, BaseException) else r
-                        for r in results_with_exceptions
-                    ]
-                else:  # ExceptionHandling.RETURN_EXCEPTION
-                    results = results_with_exceptions
+                outcomes = await asyncio.gather(*coros)
+        except asyncio.CancelledError:
+            raise
         except BaseException as e:
-            results = [handle_error(e) for _ in inputs]
+            return [hand
```

**File**: `tests/main/test_batch_cancellation.py` (added, +260/-0)
```diff
@@ -0,0 +1,260 @@
+"""Batch cancellation must propagate independently of error policy."""
+
+import asyncio
+import sys
+
+import pytest
+
+from langroid.agent.batch import (
+    ExceptionHandling,
+    _process_batch_async,
+    run_batched_tasks,
+)
+from langroid.agent.chat_document import ChatDocument
+
+
+def _require_cancellation_detection(policy: ExceptionHandling) -> None:
+    """Skip where a policy-handled CancelledError cannot be told from a
+    cancellation of the batch: that needs `Task.cancelling()` (Python 3.11+).
+    See docs/notes/batch-processing.md."""
+    if policy != ExceptionHandling.RAISE and sys.version_info < (3, 11):
+        pytest.skip("external batch cancellation is only detected on Python 3.11+")
+
+
+@pytest.mark.parametrize("policy", list(ExceptionHandling))
+def test_public_batch_propagates_cancellation(
+    policy: ExceptionHandling,
+) -> None:
+    _require_cancellation_detection(policy)
+
+    async def work(value: str | ChatDocument, index: int) -> str:
+        current = asyncio.current_task()
+        assert current is not None
+        current.cancel()
+        await asyncio.sleep(0)
+        return str(value)
+
+    with pytest.raises(asyncio.CancelledError):
+        run_batched_tasks(
+            inputs=["a"],
+            do_task=work,
+            batch_size=None,
+            stop_on_first_result=False,
+            sequential=True,
+            handle_exceptions=policy,
+            output_map=lambda value: value,
+            message_template="Testing cancellation",
+        )
+
+
+@pytest.mark.parametrize("policy", list(ExceptionHandling))
+@pytest.mark.parametrize("mode", ["sequential", "parallel", "first_result"])
+@pytest.mark.parametrize("iterable", [False, True])
+def test_batch_propagates_cancellation(
+    policy: ExceptionHandling, mode: str, iterable: bool
+) -> None:
+    if mode == "sequential":
+        _require_cancellation_detection(policy)
+
+    async def scenario() -> None:
+        started: list[int] = []
+        cleaned: list[int] = []
+        ready = asyncio.Event()
+        expected = 1 if mode == "sequential" else 2
+
+        async def work(value: str | ChatDocument, index: int) -> str:
+            started.append(index)
+            if len(started) == expected:
+                ready.set()
+            try:
+                if mode == "sequential" and index > 0:
+                    return str(value)
+                await asyncio.Event().wait()
+                return str(value)
+            finally:
+                cleaned.append(index)
+
+        inputs = ["a", "b"]
+        batch = asyncio.create_task(
+            _process_batch_async(
+                iter(inputs) if iterable else inputs,
+                work,
+                sequential=mode == "sequential",
+                stop_on_first_result=mode == "first_result",
+                handle_exceptions=policy,
+            )
+        )
+        try:
+            await asyncio.wait_for(ready.wait(), timeout=2)
+            batch.cancel()
+            with pytest.raises(asyncio.CancelledError):
+                await asyncio.wait_for(batch, timeout=2)
+            assert sorted(started) == list(range(expected))
+            assert sorted(cleaned) == list(range(expected))
+        finally:
+            batch.cancel()
+            await asyncio.gather(batch, return_exceptions=True)
+
+    asyncio.run(scenario())
+
+
+@pytest.mark.parametrize("policy", list(ExceptionHandling))
+def test_batch_first_result_still_cleans_pending(
+    policy: ExceptionHandling,
+) -> None:
+    async def scenario() -> None:
+        started = asyncio.Event()
+        cleaned = asyncio.Event()
+
+        async def work(value: str | ChatDocument, index: int) -> str:
+            if index == 0:
+                await started.wait()
+                return "winner"
+            try:
+                started.set()
+                await asyncio.Event().wait()
+                return "unused"
+            finally:
+ 
```

**File**: `tests/main/test_batch_mapping.py` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+"""Regression tests for per-item batch output mapping."""
+
+from typing import Any
+
+import pytest
+
+from langroid.agent.batch import ExceptionHandling, run_batch_agent_method
+from langroid.agent.chat_agent import ChatAgent, ChatAgentConfig
+from langroid.agent.chat_document import ChatDocMetaData, ChatDocument
+from langroid.language_models.mock_lm import MockLMConfig
+from langroid.mytypes import Entity
+
+
+class MappingAgent(ChatAgent):
+    async def produce(self, message: str | ChatDocument | None) -> ChatDocument | None:
+        assert isinstance(message, str)
+        if message == "task_error":
+            raise ValueError("task failed")
+        if message == "empty":
+            return None
+        return ChatDocument(
+            content=message, metadata=ChatDocMetaData(sender=Entity.AGENT)
+        )
+
+
+@pytest.mark.parametrize("sequential", [True, False])
+@pytest.mark.parametrize("batch_size", [None, 2])
+@pytest.mark.parametrize("policy", list(ExceptionHandling))
+@pytest.mark.parametrize("failure", ["bad", "task_error"])
+def test_batch_mapping_exception_policy(
+    sequential: bool,
+    batch_size: int | None,
+    policy: ExceptionHandling,
+    failure: str,
+) -> None:
+    agent = MappingAgent(ChatAgentConfig(llm=MockLMConfig(), vecdb=None, parsing=None))
+    mapped: list[Any] = []
+
+    def output_map(result: ChatDocument | None) -> int:
+        mapped.append(result)
+        assert isinstance(result, ChatDocument)
+        return int(result.content)
+
+    def run() -> list[Any]:
+        return run_batch_agent_method(
+            agent,
+            agent.produce,
+            ["1", failure, "3"],
+            sequential=sequential,
+            batch_size=batch_size,
+            handle_exceptions=policy,
+            output_map=output_map,
+        )
+
+    if policy == ExceptionHandling.RAISE:
+        with pytest.raises(ValueError):
+            run()
+        return
+
+    results = run()
+    assert results[0] == 1
+    assert results[2] == 3
+    if policy == ExceptionHandling.RETURN_NONE:
+        assert results[1] is None
+    else:
+        assert isinstance(results[1], ValueError)
+    assert all(isinstance(item, ChatDocument) for item in mapped)
+
+
+@pytest.mark.parametrize("sequential", [True, False])
+@pytest.mark.parametrize("policy", list(ExceptionHandling))
+def test_batch_mapping_preserves_successful_none(
+    sequential: bool, policy: ExceptionHandling
+) -> None:
+    agent = MappingAgent(ChatAgentConfig(llm=MockLMConfig(), vecdb=None, parsing=None))
+    results = run_batch_agent_method(
+        agent,
+        agent.produce,
+        ["1", "empty", "3"],
+        sequential=sequential,
+        handle_exceptions=policy,
+        output_map=lambda result: -1 if result is None else int(result.content),
+    )
+    assert results == [1, -1, 3]
```

---

### Incident Patch 5: `67b2594b` (2026-09-23)
**Commit Message**: fix: isolate configurations of batch agent copies (#1141) [notest]

**File**: `langroid/agent/batch.py` (modified, +3/-2)
```diff
@@ -492,8 +492,9 @@ def run_batch_agent_method(
     agent_name = agent_cfg.name
 
     async def _do_task(input: str | ChatDocument, i: int) -> Any:
-        agent_cfg.name = f"{agent_cfg.name}-{i}"
-        agent_i = agent_cls(agent_cfg)
+        agent_i_cfg = copy.deepcopy(agent_cfg)
+        agent_i_cfg.name = f"{agent_name}-{i}"
+        agent_i = agent_cls(agent_i_cfg)
         method_i = getattr(agent_i, method_name, None)
         if method_i is None:
             raise ValueError(f"Agent {agent_name} has no method {method_name}")
```

**File**: `tests/main/test_batch_config.py` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+"""Regression tests for isolated configurations of batch agent copies."""
+
+import asyncio
+import json
+
+import pytest
+
+from langroid.agent.base import Agent, AgentConfig
+from langroid.agent.batch import run_batch_agent_method
+from langroid.agent.chat_document import ChatDocMetaData, ChatDocument
+from langroid.language_models.mock_lm import MockLMConfig
+from langroid.mytypes import Entity
+
+
+class RecordingConfig(AgentConfig):
+    seen_inputs: list[str] = []
+
+
+class RecordingAgent(Agent):
+    async def record(self, message: str | ChatDocument | None) -> ChatDocument:
+        assert isinstance(message, str)
+        assert isinstance(self.config, RecordingConfig)
+        self.config.seen_inputs.append(message)
+        await asyncio.sleep(0)
+        return ChatDocument(
+            content=json.dumps(self.config.seen_inputs),
+            metadata=ChatDocMetaData(sender=Entity.AGENT, sender_name=self.config.name),
+        )
+
+
+@pytest.mark.parametrize("sequential", [True, False])
+@pytest.mark.parametrize("batch_size", [None, 1, 2, 3])
+def test_batch_agent_config_isolation(sequential: bool, batch_size: int | None) -> None:
+    config = RecordingConfig(
+        name="Worker", llm=MockLMConfig(), vecdb=None, parsing=None
+    )
+    agent = RecordingAgent(config)
+    results = run_batch_agent_method(
+        agent,
+        agent.record,
+        ["a", "b", "c"],
+        sequential=sequential,
+        batch_size=batch_size,
+    )
+    assert [r.metadata.sender_name for r in results] == [
+        "Worker-0",
+        "Worker-1",
+        "Worker-2",
+    ]
+    assert [json.loads(r.content) for r in results] == [["a"], ["b"], ["c"]]
+    assert config.name == "Worker"
+    assert config.seen_inputs == []
+    assert config.llm is not None and config.llm.stream is True
```

---

### Incident Patch 6: `7a12310e` (2026-09-16)
**Commit Message**: fix: preserve JSON escape semantics in function arguments (#1137)

**File**: `langroid/parsing/parse_json.py` (modified, +9/-1)
```diff
@@ -52,7 +52,15 @@ def parse_imperfect_json(json_string: str) -> Union[Dict[str, Any], List[Any]]:
     if not json_string.strip():
         raise ValueError("Empty string is not valid JSON")
 
-    # First, try parsing with ast.literal_eval
+    # Preserve JSON escape semantics before trying Python literals or repairs.
+    try:
+        result = json.loads(json_string)
+        if isinstance(result, (dict, list)):
+            return result
+    except json.JSONDecodeError:
+        pass
+
+    # Accept Python literals such as single quotes, True, and None.
     try:
         result = ast.literal_eval(json_string)
         if isinstance(result, (dict, list)):
```

**File**: `tests/main/test_json.py` (modified, +17/-0)
```diff
@@ -94,6 +94,23 @@ def test_extract_top_level_json(s, expected):
             {"key": "value \n with escaped \nnewline"},
         ),
         ('{"key": "value", "number": 42}', {"key": "value", "number": 42}),
+        (
+            r'{"url": "https:\/\/example.org\/path"}',
+            {"url": "https://example.org/path"},
+        ),
+        (r'{"text": "\ud83d\ude00"}', {"text": "😀"}),
+        (
+            r'{"\ud83d\ude00": {"url": "https:\/\/example.org"}}',
+            {"😀": {"url": "https://example.org"}},
+        ),
+        (
+            r'["https:\/\/example.org", "\ud83d\ude00"]',
+            ["https://example.org", "😀"],
+        ),
+        (
+            r'{"path": "C:\\work\\file.txt", "literal": "\\ud83d\\ude00"}',
+            {"path": r"C:\work\file.txt", "literal": r"\ud83d\ude00"},
+        ),
         (
             '{"key": "value", "number": 42,}',
             {"key": "value", "number": 42},
```

**File**: `tests/main/test_openai_json_arguments.py` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+"""JSON argument values must survive response parsing and stream assembly."""
+
+import json
+from collections.abc import AsyncIterator
+from typing import Any
+
+import pytest
+
+from langroid.language_models.base import LLMResponse
+from langroid.language_models.openai_gpt import OpenAIGPT, OpenAIGPTConfig
+
+
+@pytest.fixture(
+    params=[
+        r'{"url": "https:\/\/example.org\/path"}',
+        r'{"text": "\ud83d\ude00"}',
+        '{"text": "ordinary JSON"}',
+        r'{"path": "C:\\work\\file.txt"}',
+        '{"enabled": true, "value": null}',
+    ],
+    ids=["escaped-slashes", "surrogate-pair", "plain", "backslash", "bool-null"],
+)
+def payload(request: pytest.FixtureRequest) -> str:
+    return str(request.param)
+
+
+@pytest.fixture(params=["function_call", "tool_calls"])
+def call_kind(request: pytest.FixtureRequest) -> str:
+    return str(request.param)
+
+
+@pytest.fixture
+def model() -> OpenAIGPT:
+    return OpenAIGPT(
+        OpenAIGPTConfig(api_key="test-key", stream=False, cache_config=None)
+    )
+
+
+def _call_content(
+    payload: str, call_kind: str, *, stream: bool = False
+) -> dict[str, Any]:
+    function = {"name": "inspect_value", "arguments": payload}
+    if call_kind == "function_call":
+        return {"function_call": function}
+    tool: dict[str, Any] = {
+        "id": "call_local",
+        "type": "function",
+        "function": function,
+    }
+    if stream:
+        tool["index"] = 0
+    return {"tool_calls": [tool]}
+
+
+def _events(payload: str, call_kind: str) -> list[dict[str, Any]]:
+    # Single-character chunks split both escape sequences and surrogate pairs.
+    events = [
+        {
+            "choices": [
+                {
+                    "delta": _call_content(char, call_kind, stream=True),
+                    "finish_reason": None,
+                }
+            ]
+        }
+        for char in payload
+    ]
+    for event in events[1:]:
+        delta = event["choices"][0]["delta"]
+        if call_kind == "function_call":
+            del delta["function_call"]["name"]
+        else:
+            tool = delta["tool_calls"][0]
+            tool["id"] = None
+            tool["type"] = None
+            tool["function"]["name"] = None
+    events.append({"choices": [{"delta": {}, "finish_reason": call_kind}]})
+    return events
+
+
+def _assert_arguments(response: LLMResponse, payload: str, call_kind: str) -> None:
+    if call_kind == "function_call":
+        call = response.function_call
+    else:
+        assert response.oai_tool_calls is not None
+        assert len(response.oai_tool_calls) == 1
+        call = response.oai_tool_calls[0].function
+    assert call is not None
+    assert call.name == "inspect_value"
+    assert call.arguments == json.loads(payload)
+
+
+def test_non_stream_json_arguments(
+    model: OpenAIGPT, payload: str, call_kind: str
+) -> None:
+    response = model._process_chat_completion_response(
+        cached=False,
+        response={
+            "choices": [{"message": _call_content(payload, call_kind)}],
+            "usage": {},
+        },
+    )
+    _assert_arguments(response, payload, call_kind)
+
+
+def test_stream_json_arguments_and_cache_replay(
+    model: OpenAIGPT, payload: str, call_kind: str
+) -> None:
+    response, cached = model._stream_response(_events(payload, call_kind), chat=True)
+    _assert_arguments(response, payload, call_kind)
+    replayed = model._process_chat_completion_response(cached=True, response=cached)
+    _assert_arguments(replayed, payload, call_kind)
+
+
+@pytest.mark.asyncio
+async def test_async_stream_json_arguments_and_cache_replay(
+    model: OpenAIGPT, payload: str, call_kind: str
+) -> None:
+    async def events() -> AsyncIterator[dict[str, Any]]:
+        for event in _events(payload, call_kind):
+            yield event
+
+    response, cached = await model._stream_response_async(events(), chat=True)
+    _assert_arguments(response, pay
```

---

### Incident Patch 7: `053dbfe5` (2026-09-12)
**Commit Message**: fix: preserve commas in done-sequence patterns (#1135)

* fix #1134 done-sequence regex comma parsing

Supersedes #1134 and credits Hongzhu Yi (@yhz5613813) for the original regression fix.

* fix #1134 bracketed done-sequence regexes

Addresses GitHub Codex review finding on superseding PR #1135.

* chore #1134 remove generated lockfile churn

* fix #1134 literal closing brackets in regex patterns

Addresses the final local cold-review finding for superseding PR #1135.

* fix #1134 newline regex patterns

Addresses GitHub Codex review finding on superseding PR #1135.

* fix #1134 regex character class parsing

Addresses GitHub Codex review finding on superseding PR #1135.

**File**: `langroid/agent/done_sequence_parser.py` (modified, +31/-3)
```diff
@@ -66,8 +66,36 @@ def _parse_string_pattern(
     """
     events = []
 
-    # Split by comma and strip whitespace
-    parts = [p.strip() for p in pattern.split(",")]
+    # Commas inside bracket parameters are part of the tool name or regex.
+    parts = []
+    current: List[str] = []
+    bracket_depth = 0
+    escaped = False
+    in_character_class = False
+    for index, char in enumerate(pattern):
+        if escaped:
+            escaped = False
+        elif char == "\\":
+            escaped = True
+        elif bracket_depth == 0 and char == "[":
+            bracket_depth += 1
+        elif bracket_depth > 0 and char == "[" and not in_character_class:
+            in_character_class = True
+        elif char == "]" and in_character_class:
+            in_character_class = False
+        elif char == "]" and bracket_depth > 0:
+            next_index = index + 1
+            while next_index < len(pattern) and pattern[next_index].isspace():
+                next_index += 1
+            if next_index == len(pattern) or pattern[next_index] == ",":
+                bracket_depth -= 1
+
+        if char == "," and bracket_depth == 0:
+            parts.append("".join(current).strip())
+            current = []
+        else:
+            current.append(char)
+    parts.append("".join(current).strip())
 
     for part in parts:
         if not part:
@@ -99,7 +127,7 @@ def _parse_event_token(
         ValueError: If token is invalid
     """
     # Check for bracket notation
-    bracket_match = re.match(r"^([A-Z])\[([^\]]+)\]$", token)
+    bracket_match = re.match(r"^([A-Z])\[(.+)\]$", token, re.DOTALL)
 
     if bracket_match:
         event_code = bracket_match.group(1)
```

**File**: `tests/main/test_done_sequence_commas.py` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+from langroid.agent.done_sequence_parser import parse_done_sequence
+from langroid.agent.task import EventType
+
+
+def test_content_match_pattern_can_contain_commas() -> None:
+    sequence = parse_done_sequence(r"L, C[done,\s*thanks]")
+
+    assert len(sequence.events) == 2
+    assert sequence.events[0].event_type == EventType.LLM_RESPONSE
+    assert sequence.events[1].event_type == EventType.CONTENT_MATCH
+    assert sequence.events[1].content_pattern == r"done,\s*thanks"
```

**File**: `tests/main/test_done_sequence_escaped_brackets.py` (added, +55/-0)
```diff
@@ -0,0 +1,55 @@
+from langroid.agent.done_sequence_parser import parse_done_sequence
+from langroid.agent.task import EventType
+
+
+def test_content_match_escaped_open_bracket_can_be_followed_by_event() -> None:
+    sequence = parse_done_sequence(r"C[\[done,thanks], A")
+
+    assert len(sequence.events) == 2
+    assert sequence.events[0].event_type == EventType.CONTENT_MATCH
+    assert sequence.events[0].content_pattern == r"\[done,thanks"
+    assert sequence.events[1].event_type == EventType.AGENT_RESPONSE
+
+
+def test_content_match_character_class_can_contain_commas() -> None:
+    sequence = parse_done_sequence(r"C[[a,b]], A")
+
+    assert len(sequence.events) == 2
+    assert sequence.events[0].event_type == EventType.CONTENT_MATCH
+    assert sequence.events[0].content_pattern == r"[a,b]"
+    assert sequence.events[1].event_type == EventType.AGENT_RESPONSE
+
+
+def test_content_match_escaped_closing_bracket_can_contain_commas() -> None:
+    sequence = parse_done_sequence(r"C[done\],thanks], A")
+
+    assert len(sequence.events) == 2
+    assert sequence.events[0].event_type == EventType.CONTENT_MATCH
+    assert sequence.events[0].content_pattern == r"done\],thanks"
+    assert sequence.events[1].event_type == EventType.AGENT_RESPONSE
+
+
+def test_content_match_unescaped_closing_bracket_can_contain_commas() -> None:
+    sequence = parse_done_sequence(r"C[]done,thanks], A")
+
+    assert len(sequence.events) == 2
+    assert sequence.events[0].event_type == EventType.CONTENT_MATCH
+    assert sequence.events[0].content_pattern == r"]done,thanks"
+    assert sequence.events[1].event_type == EventType.AGENT_RESPONSE
+
+
+def test_content_match_newline_can_contain_commas() -> None:
+    sequence = parse_done_sequence("C[done\nthanks,again], A")
+
+    assert len(sequence.events) == 2
+    assert sequence.events[0].event_type == EventType.CONTENT_MATCH
+    assert sequence.events[0].content_pattern == "done\nthanks,again"
+    assert sequence.events[1].event_type == EventType.AGENT_RESPONSE
+
+
+def test_content_match_character_class_matching_open_bracket_can_be_followed() -> None:
+    sequence = parse_done_sequence(r"C[[[]], A")
+
+    assert len(sequence.events) == 2
+    assert sequence.events[0].content_pattern == r"[[]"
+    assert sequence.events[1].event_type == EventType.AGENT_RESPONSE
```

---

### Incident Patch 8: `bbf64f35` (2026-09-02)
**Commit Message**: Revert "test: permission-wall probe (auto-closed) (#1131)" (#1132)

This reverts commit af096775e32e27eb9716834dd3565dbb75fce8e6.

**File**: `.permission-wall-probe` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-probe 1788384225
```

---

### Incident Patch 9: `cc2592d6` (2026-08-31)
**Commit Message**: fix: avoid sharing the default TaskConfig across Task instances (#1124)

**File**: `langroid/agent/task.py` (modified, +2/-1)
```diff
@@ -226,7 +226,7 @@ def __init__(
         default_return_type: Optional[type] = None,
         done_if_no_response: List[Responder] = [],
         done_if_response: List[Responder] = [],
-        config: TaskConfig = TaskConfig(),
+        config: TaskConfig | None = None,
         **kwargs: Any,  # catch-all for any legacy params, for backwards compatibility
     ):
         """
@@ -308,6 +308,7 @@ def __init__(
             show_subtask_response=noop_fn,
             set_parent_agent=noop_fn,
         )
+        config = config if config is not None else TaskConfig()
         self.config = config
         # Store parsed done sequences (will be initialized after agent assignment)
         self._parsed_done_sequences: Optional[List[DoneSequence]] = None
```

**File**: `tests/main/test_task.py` (modified, +15/-0)
```diff
@@ -32,6 +32,21 @@
 from langroid.utils.constants import DONE, PASS
 
 
+def test_task_config_identity_contract() -> None:
+    """Default tasks get fresh configs while explicit configs retain identity."""
+    first = Task()
+    second = Task()
+
+    assert first.config is not second.config
+    first.config.recognize_string_signals = False
+    assert second.config.recognize_string_signals
+
+    config = TaskConfig()
+    explicit = Task(config=config)
+    assert explicit.config is config
+    assert isinstance(Task(config=None).config, TaskConfig)
+
+
 def test_task_cost(test_settings: Settings):
     """Test that max_cost, max_tokens are respected by Task.run()"""
 
```

---

### Incident Patch 10: `b4100762` (2026-08-30)
**Commit Message**: fix(utils): expand '~' in read_file and close the resulting file-tool sandbox escape (#1120)

* fix(utils): expand '~' in read_file and in the file-tool path guard

read_file() checked existence on the un-expanded path, so
read_file("~/existing") raised FileNotFoundError even when the file
exists. Expand once, then check and read from the expanded path.

Expanding in read_file() alone would open a sandbox escape: ReadFileTool
validates with safe_resolve_path(), which treated "~" as a literal
directory under curr_dir, so "~/.ssh/id_rsa" passed the guard and was
then read from the real home dir. safe_resolve_path() now expands "~"
too, so such a path is rejected as outside the allowed directory.

Tests: tilde read succeeds; missing tilde path still raises;
safe_resolve_path rejects "~/..." and still allows in-base paths;
ReadFileTool tilde escape is blocked (companion to the existing
GHSA-fg23-3346-88f5 traversal tests).

Supersedes #1118, originally authored by @pacocartones.

* fix(utils): don't let an unexpandable '~user' path raise RuntimeError

Path.expanduser() raises RuntimeError for a reference whose home dir
cannot be determined (e.g. '~nosuchuser/f.txt'). After the previous

**File**: `langroid/utils/system.py` (modified, +46/-11)
```diff
@@ -187,14 +187,45 @@ def generate_unique_id() -> str:
     return str(uuid.uuid4())
 
 
+def expand_user_path(path: str | Path) -> Path:
+    """
+    Expand a leading ``~`` in ``path``, falling back to the literal path when
+    the home directory cannot be determined.
+
+    :meth:`pathlib.Path.expanduser` raises ``RuntimeError`` for an unresolvable
+    reference such as ``~nosuchuser/f.txt``. Callers here treat a path they
+    cannot expand as an ordinary (literal) path, so an agent-supplied path can
+    never crash a file tool.
+
+    Args:
+        path (str|Path): The path to expand.
+
+    Returns:
+        Path: The expanded path, or the literal path if expansion failed.
+    """
+    p = Path(path)
+    try:
+        return p.expanduser()
+    except RuntimeError:
+        return p
+
+
 def safe_resolve_path(base_dir: str | Path, user_path: str | Path) -> Path:
     """
     Resolve ``user_path`` relative to ``base_dir`` and ensure the result stays
     within ``base_dir`` (a path-traversal guard for file tools).
 
-    A ``user_path`` containing ``..`` segments, an absolute path, or a symlink
-    pointing outside ``base_dir`` is rejected. Symlinks are resolved via
-    :meth:`pathlib.Path.resolve`, so symlink-based escapes are caught as well.
+    A ``user_path`` containing ``..`` segments, an absolute path, a ``~`` home
+    reference, or a symlink pointing outside ``base_dir`` is rejected. Symlinks
+    are resolved via :meth:`pathlib.Path.resolve`, so symlink-based escapes are
+    caught as well.
+
+    A ``~`` path is checked under *both* interpretations -- expanded (as
+    :func:`read_file` reads it) and literal (as ``create_file`` and
+    :func:`list_dir` write/list it, since those do not expand) -- and rejected
+    if either one escapes. Callers validate with this function but then operate
+    on the raw path, so validating only one interpretation would leave the other
+    unguarded.
 
     Args:
         base_dir (str|Path): Directory that file operations must stay within.
@@ -207,12 +238,14 @@ def safe_resolve_path(base_dir: str | Path, user_path: str | Path) -> Path:
         ValueError: If the resolved path escapes ``base_dir``.
     """
     base = Path(base_dir).resolve()
-    target = (base / Path(user_path)).resolve()
-    if target != base and base not in target.parents:
-        raise ValueError(
-            f"Path '{user_path}' is outside the allowed directory '{base}'"
-        )
-    return target
+    expanded = (base / expand_user_path(user_path)).resolve()
+    literal = (base / Path(user_path)).resolve()
+    for target in (expanded, literal):
+        if target != base and base not in target.parents:
+            raise ValueError(
+                f"Path '{user_path}' is outside the allowed directory '{base}'"
+            )
+    return expanded
 
 
 def create_file(
@@ -274,10 +307,12 @@ def read_file(path: str, line_numbers: bool = False) -> str:
     Raises:
         FileNotFoundError: If the specified file does not exist.
     """
+    # expand "~" before checking existence, so a "~/..." path is not
+    # spuriously reported as missing
+    file = expand_user_path(path)
     # raise an error if the file does not exist
-    if not Path(path).exists():
+    if not file.exists():
         raise FileNotFoundError(f"File not found: {path}")
-    file = Path(path).expanduser()
     content = file.read_text()
     if line_numbers:
         lines = content.splitlines()
```

**File**: `tests/main/test_file_tools.py` (modified, +28/-0)
```diff
@@ -357,6 +357,34 @@ def test_read_file_tool_symlink_escape_blocked(sandbox_with_secret):
     assert _ESCAPE_MARKER in result
 
 
+def test_read_file_tool_tilde_escape_blocked(sandbox_with_secret, monkeypatch):
+    # "~/..." must be checked as the home path it refers to, not as a literal
+    # "~" directory under the sandbox -- otherwise read_file's expanduser()
+    # reads it from the real home dir after the guard has already passed.
+    sandbox, secret = sandbox_with_secret
+    monkeypatch.setenv("HOME", str(secret.parent))
+    monkeypatch.setenv("USERPROFILE", str(secret.parent))  # Windows
+    tool = ReadFileTool.create(get_curr_dir=lambda: sandbox)(
+        file_path=f"~/{secret.name}"
+    )
+    result = tool.handle()
+    assert "LANGROID_TOOL_ESCAPE_SECRET" not in result
+    assert _ESCAPE_MARKER in result
+
+
+def test_read_file_tool_unresolvable_tilde_user_no_crash(sandbox_with_secret):
+    # "~nosuchuser/..." cannot be expanded (Path.expanduser raises
+    # RuntimeError for it); the tool must return its normal error string
+    # rather than propagating RuntimeError out of the handler.
+    sandbox, _ = sandbox_with_secret
+    tool = ReadFileTool.create(get_curr_dir=lambda: sandbox)(
+        file_path="~nosuchuser12345/f.txt"
+    )
+    result = tool.handle()
+    assert "LANGROID_TOOL_ESCAPE_SECRET" not in result
+    assert "File not found" in result
+
+
 def test_write_file_tool_parent_traversal_blocked(temp_dir):
     sandbox = temp_dir / "sandbox"
     sandbox.mkdir()
```

**File**: `tests/main/test_system_utils.py` (modified, +84/-1)
```diff
@@ -2,7 +2,12 @@
 
 import pytest
 
-from langroid.utils.system import create_file, diff_files, read_file
+from langroid.utils.system import (
+    create_file,
+    diff_files,
+    read_file,
+    safe_resolve_path,
+)
 
 
 @pytest.fixture
@@ -95,6 +100,84 @@ def test_read_file_with_line_numbers(tmp_path):
     assert read_file(str(file_path), line_numbers=True) == expected
 
 
+def test_read_file_tilde_expansion(tmp_path, monkeypatch):
+    # simulate a home directory and read a file via a "~/..." path;
+    # read_file must expand "~" before checking existence (regression
+    # for a FileNotFoundError raised on a path that actually exists).
+    monkeypatch.setenv("HOME", str(tmp_path))
+    monkeypatch.setenv("USERPROFILE", str(tmp_path))  # Windows
+    content = "Line 1\nLine 2"
+    (tmp_path / "tilde_read_test.txt").write_text(content)
+    assert read_file("~/tilde_read_test.txt") == content
+
+
+def test_read_file_missing_tilde_path(tmp_path, monkeypatch):
+    monkeypatch.setenv("HOME", str(tmp_path))
+    monkeypatch.setenv("USERPROFILE", str(tmp_path))  # Windows
+    with pytest.raises(FileNotFoundError):
+        read_file("~/no_such_file.txt")
+
+
+def test_safe_resolve_path_rejects_tilde(tmp_path, monkeypatch):
+    # "~" must not be treated as a literal directory name under base_dir:
+    # read_file expands it, so the guard has to expand it too.
+    home = tmp_path / "home"
+    home.mkdir()
+    (home / "secret.txt").write_text("SECRET")
+    base = tmp_path / "sandbox"
+    base.mkdir()
+    monkeypatch.setenv("HOME", str(home))
+    monkeypatch.setenv("USERPROFILE", str(home))  # Windows
+    with pytest.raises(ValueError, match="outside the allowed directory"):
+        safe_resolve_path(base, "~/secret.txt")
+
+
+def test_read_file_unresolvable_tilde_user(tmp_path, monkeypatch):
+    # "~nosuchuser/..." cannot be expanded; Path.expanduser() raises
+    # RuntimeError for it. read_file must still report it as missing, as it
+    # documents, rather than propagating RuntimeError.
+    monkeypatch.chdir(tmp_path)
+    with pytest.raises(FileNotFoundError):
+        read_file("~nosuchuser12345/f.txt")
+
+
+def test_safe_resolve_path_unresolvable_tilde_user(tmp_path):
+    # an unexpandable "~user" path is treated literally, so it stays inside
+    # base_dir and must not raise RuntimeError out of the guard.
+    base = tmp_path / "sandbox"
+    base.mkdir()
+    resolved = safe_resolve_path(base, "~nosuchuser12345/f.txt")
+    assert base in resolved.parents
+
+
+def test_safe_resolve_path_rejects_literal_tilde_symlink_escape(tmp_path, monkeypatch):
+    # The tools validate with safe_resolve_path but then operate on the RAW
+    # path: create_file/list_dir do not expand "~". So when base_dir is the
+    # home dir, "~/x" expands to an in-base path while the literal "base/~/x"
+    # can follow a "~" symlink out of the sandbox. Both readings must be
+    # checked.
+    home = tmp_path / "home"
+    home.mkdir()
+    outside = tmp_path / "outside"
+    outside.mkdir()
+    (outside / "secret.txt").write_text("SECRET")
+    monkeypatch.setenv("HOME", str(home))
+    monkeypatch.setenv("USERPROFILE", str(home))  # Windows
+    try:
+        (home / "~").symlink_to(outside, target_is_directory=True)
+    except (OSError, NotImplementedError):
+        pytest.skip("symlinks not supported on this platform")
+    with pytest.raises(ValueError, match="outside the allowed directory"):
+        safe_resolve_path(home, "~/secret.txt")
+
+
+def test_safe_resolve_path_allows_path_within_base(tmp_path):
+    base = tmp_path / "sandbox"
+    (base / "sub").mkdir(parents=True)
+    (base / "sub" / "ok.txt").write_text("ok")
+    assert safe_resolve_path(base, "sub/ok.txt") == (base / "sub" / "ok.txt").resolve()
+
+
 def test_diff_files(tmp_path):
     file1 = tmp_path / "file1.txt"
     file2 = tmp_path / "file2.txt"
```

#### Recent Merged Pull Requests:
- **PR #1148** (2026-09-23): docs: fix dead github-cli link in CONTRIBUTING (@tonydzi)
- **PR #1146** (2026-09-23): fix: merge complete groups of overlapping context windows (@YaoxinHuang)
- **PR #1145** (2026-09-23): fix: preserve document identity in fuzzy search results (@dingpuyu)
- **PR #1144** (2026-09-23): fix: batch exception policies for output_map and cancellation (supersedes #1140, #1142) (@pchalasani)
- **PR #1143** (2026-09-23): docs: link the quiet-mode note and add the missing cross-encoder note (@KunyangZhang)
- **PR #1141** (2026-09-23): fix: isolate configurations of batch agent copies (@feng1201)
- **PR #1139** (2026-09-16): feat: support openai SDK 3.x (httpx2) alongside 2.x (httpx) (@pchalasani)
- **PR #1137** (2026-09-16): fix: preserve JSON escape semantics in function arguments (@feng1201)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
