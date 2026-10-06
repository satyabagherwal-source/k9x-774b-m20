# Forensic Learning Record (Deep Inspection): SqueezeAILab/LLMCompiler

> **Canonical Artifact**: `07_PROJECT_LEARNING/squeezeailab-llmcompiler-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SqueezeAILab/LLMCompiler](https://github.com/SqueezeAILab/LLMCompiler))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:26:42.848Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SqueezeAILab/LLMCompiler`
- **Description**: [ICML 2024] LLMCompiler: An LLM Compiler for Parallel Function Calling
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1891 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/utils/evaluation_utils.py`
```
import re
import string
import time
import traceback
from typing import Union


def normalize_answer(s):
    def remove_articles(text):
        return re.sub(r"\b(a|an|the)\b", " ", text)

    def white_space_fix(text):
        return " ".join(text.split())

    def remove_punc(text):
        exclude = set(string.punctuation)
        return "".join(ch for ch in text if ch not in exclude)

    def lower(text):
        return text.lower()

    return white_space_fix(remove_articles(remove_punc(lower(s))))


def run_and_time(func, *args, **kwargs):
    """helper function to run and time a function.
    Since function can error, we catch the error and return "ERROR" as the result
    """
    start = time.time()
    try:
        result = func(*args, **kwargs)
    except Exception as e:
        print("Error", e)
        traceback.print_exc()
        result = "ERROR"
    end = time.time()
    return result, end - start


async def arun_and_time(func, *args, **kwargs):
    """helper function to run and time a function.
    Since function can error, we catch the error and return "ERROR" as the result
    """
    start = time.time()
    try:
        result = await func(*args, **kwargs)
    except Exception as e:
        print("Error", e)
        traceback.print_exc()
        result = "ERROR"
    end = time.time()
    return result, end - start


def is_number(s):
    try:
        float(s)
        return True
    except ValueError:
        return False


def compare_answer(answer: str, label: str):
    """Compare the answer (from Agent) and label (GT).
    Label can be either a string or a number.
    If label is a number, we allow 10% margin.
    Otherwise, we do the best-effort string matching.
    """
    if answer is None:
        return False

    # see if label is a number, e.g. "1.0" or "1"
    if is_number(label):
        label = float(label)
        # try cast answer to float and return false if it fails
        try:
            answer = float(answer)
        except:
            return False
        # allow 10% margin
        if answer > label * 0.9 and answer < label * 1.1:
            return True
        else:
            return False

    else:
        label = normalize_answer(label)
        answer = normalize_answer(answer)
        return answer == label

```

### Core Architecture Module: `src/utils/logger_utils.py`
```
import json
import time
from collections import defaultdict

import numpy as np

# Global variable to toggle logging
LOG_ENABLED = True


class Logger:
    def __init__(self) -> None:
        self._latency_dict = defaultdict(list)
        self._answer_dict = defaultdict(list)
        self._label_dict = defaultdict(list)

    def log(self, latency: float, answer: str, label: str, key: str) -> None:
        self._latency_dict[key].append(latency)
        self._answer_dict[key].append(answer)
        self._label_dict[key].append(label)

    def _get_mean_latency(self, key: str) -> float:
        latency_array = np.array(self._latency_dict[key])
        return latency_array.mean(), latency_array.std()

    def _get_accuracy(self, key: str) -> float:
        answer_array = np.array(self._answer_dict[key])
        label_array = np.array(self._label_dict[key])
        return (answer_array == label_array).mean()

    def get_results(self, key: str) -> dict:
        mean_latency, std_latency = self._get_mean_latency(key)
        accuracy = self._get_accuracy(key)
        return {
            "mean_latency": mean_latency,
            "std_latency": std_latency,
            "accuracy": accuracy,
        }

    def save_result(self, key: str, path: str):
        with open(f"{path}/dev_react_results.csv", "w") as f:
            for i in range(len(self._answer_dict[key])):
                f.write(f"{self._answer_dict[key][i]},{self._latency_dict[key][i]}\n")


def get_logger() -> Logger:
    return Logger()


# Custom print function to toggle logging


def enable_logging(enable=True):
    """Toggle logging on or off based on the given argument."""
    global LOG_ENABLED
    LOG_ENABLED = enable


def log(*args, block=False, **kwargs):
    """Print the given string only if logging is enabled."""
    if LOG_ENABLED:
        if block:
            print("=" * 80)
        print(*args, **kwargs)
        if block:
            print("=" * 80)


def flush_results(save_path, results):
    print("Saving results")
    json.dump(results, open(save_path, "w"), indent=4)

```

### Core Architecture Module: `src/utils/model_utils.py`
```
import os
from langchain.chat_models import ChatOpenAI, AzureChatOpenAI
from langchain.llms import OpenAI


def get_model(
    model_type,
    model_name,
    vllm_port,
    stream,
    temperature=0,
):
    if model_type == "openai":
        llm = ChatOpenAI(
            model_name=model_name,  # type: ignore
            openai_api_key=os.environ["OPENAI_API_KEY"],  # type: ignore
            streaming=stream,
            temperature=temperature,
        )
    elif model_type == "azure":
        llm = AzureChatOpenAI(
            azure_endpoint=os.environ["AZURE_ENDPOINT"],
            openai_api_version=os.environ["AZURE_OPENAI_API_VERSION"],
            deployment_name=os.environ["AZURE_DEPLOYMENT_NAME"],
            openai_api_key=os.environ["AZURE_OPENAI_API_KEY"],
            openai_api_type="azure",
            # streaming=args.stream,
        )
    elif model_type == "friendli":
        from langchain_community.llms.friendli import Friendli

        if stream:
            print(
                "WARNING: Friendli does not support streaming. "
                "Setting stream=False for friendli endpoints."
            )
        assert "FRIENDLI_TOKEN" in os.environ, "FRIENDLI_TOKEN must be provided"
        llm = Friendli(
            model=model_name,
            temperature=temperature,
        )

    elif model_type == "vllm":
        if vllm_port is None:
            raise ValueError("vllm_port must be provided for vllm model")
        if stream:
            print(
                "WARNING: vllm does not support streaming. "
                "Setting stream=False for vllm model."
            )
        llm = OpenAI(
            openai_api_key="EMPTY",
            openai_api_base=f"http://localhost:{vllm_port}/v1",
            model_name=model_name,
            temperature=temperature,
            max_retries=1,
        )

    else:
        raise NotImplementedError(f"Unknown model type: {model_type}")

    return llm

```

### Core Architecture Module: `src/utils/time_utils.py`
```
from __future__ import annotations

import time
from dataclasses import dataclass, field
from functools import update_wrapper
from typing import Callable, Dict, List

time_contexts: Dict[str, TimeContext] = {}


@dataclass
class TimeContext:
    total_time: float = 0.0
    num_calls: int = 0
    each_time: list[float] = field(default_factory=list)


def time_it(verbose=False) -> Callable:
    def decorator_time_it(func: Callable) -> Callable:
        """Time a function."""
        key = f"{func.__module__}.{func.__name__}"

        async def wrapper(*args, **kwargs):
            s = time.time()
            res = await func(*args, **kwargs)
            time_taken = time.time() - s
            if key not in time_contexts:
                time_contexts[key] = TimeContext()
                if verbose:
                    print(f"Created time context for {key}")
            time_contexts[key].total_time += time_taken
            time_contexts[key].num_calls += 1
            time_contexts[key].each_time.append(time_taken)
            return res

        update_wrapper(wrapper, func)
        return wrapper

    return decorator_time_it


def print_time_contexts():
    global time_contexts
    time_contexts = dict(sorted(time_contexts.items(), key=lambda item: item[0]))
    for key, time_context in time_contexts.items():
        print(
            f"{key}: {time_context.total_time:.2f} ({time_context.num_calls} calls) ({time_context.each_time})"
        )

    return time_contexts

```

### Core Architecture Module: `configs/hotpotqa/configs.py`
```
from configs.hotpotqa.gpt_prompts import OUTPUT_PROMPT as GPT_OUTPUT_PROMPT
from configs.hotpotqa.gpt_prompts import PLANNER_PROMPT as GPT_PLANNER_PROMPT
from configs.hotpotqa.llama_prompts import OUTPUT_PROMPT as LLAMA_OUTPUT_PROMPT
from configs.hotpotqa.llama_prompts import PLANNER_PROMPT as LLAMA_PLANNER_PROMPT

CONFIGS = {
    "default_model": "gpt-3.5-turbo-1106",
    "prompts": {
        "gpt": {
            "planner_prompt": GPT_PLANNER_PROMPT,
            "output_prompt": GPT_OUTPUT_PROMPT,
        },
        "llama": {
            "planner_prompt": LLAMA_PLANNER_PROMPT,
            "output_prompt": LLAMA_OUTPUT_PROMPT,
        },
    },
    "max_replans": 1,
}

```

### Core Architecture Module: `configs/hotpotqa/gpt_prompts.py`
```
from src.llm_compiler.constants import END_OF_PLAN, JOINNER_FINISH

PLANNER_PROMPT = (
    "Question: Which magazine was started first Arthur's Magazine or First for Women?\n"
    '1. search("Arthur\'s Magazine")\n'
    '2. search("First for Women (magazine)")\n'
    "Thought: I can answer the question now.\n"
    f"3. join(){END_OF_PLAN}\n"
    "###\n"
    "\n"
    "Question: Were Pavel Urysohn and Leonid Levin known for the same type of work?\n"
    '1. search("Pavel Urysohn")\n'
    '2. search("Leonid Levin")\n'
    "Thought: I can answer the question now.\n"
    f"3. join(){END_OF_PLAN}\n"
    "###\n"
    "\n"
)

OUTPUT_PROMPT = (
    "Solve a question answering task with interleaving Observation, Thought, and Action steps. Here are some guidelines:\n"
    "  - You will be given a Question and some Wikipedia passages, which are the Observations.\n"
    "  - Thought needs to reason about the question based on the Observations in 1-2 sentences.\n"
    "  - There are cases where the Observations are unclear or irrelevant (in the case wikipedia search was not successful). In such a case where the Observations are unclear, you must make a best guess based on your own knowledge if you don't know the answer. You MUST NEVER say in your thought that you don't know the answer.\n\n"
    "Action can be only one type:\n"
    f" (1) {JOINNER_FINISH}(answer): returns the answer and finishes the task. "
    "Answer should be short and a single item and MUST not be multiple choices. Answer MUST NEVER be 'unclear', 'unknown', 'neither', 'unrelated' or 'undetermined', and otherwise you will be PENALIZED.\n"
    "\n"
    "Here are some examples:\n"
    "\n"
    "Question: Which magazine was started first Arthur's Magazine or First for Women?\n"
    "\n"
    "search(Arthur's Magazine)\n"
    "Observation: Arthur's Magazine (1844-1846) was an American literary periodical published in Philadelphia in the 19th century.\n"
    "search(First for Women (magazine))\n"
    "Observation: First for Women is a woman's magazine published by Bauer Media Group in the USA.[1] The magazine was started in 1989.\n"
    "Thought: First for Women was started in 1989. 1844 (Arthur's Magazine) < 1989 (First for Women), so Arthur's Magazine was started first.\n"
    f"Action: {JOINNER_FINISH}(Arthur's Magazine)\n"
    "###\n"
    "\n"
    "Question: Were Pavel Urysohn and Leonid Levin known for the same type of work?\n"
    "search(Pavel Urysohn)\n"
    "Observation: Pavel Samuilovich Urysohn (February 3, 1898 - August 17, 1924) was a Soviet mathematician who is best known for his contributions in dimension theory.\n"
    "search(Leonid Levin)\n"
    "Observation: Leonid Anatolievich Levin is a Soviet-American mathematician and computer scientist.\n"
    "Thought: Pavel Urysohn is a mathematician. Leonid Levin is a mathematician and computer scientist. So Pavel Urysohn and Leonid Levin have the same type of work.\n"
    f"Action: {JOINNER_FINISH}(yes)\n"
    "###\n"
    "\n"
)

```

### Core Architecture Module: `configs/hotpotqa/llama_prompts.py`
```
from src.llm_compiler.constants import END_OF_PLAN, JOINNER_FINISH

PLANNER_PROMPT = (
    "Question: Are Pam Veasey and Jon Jost both American?\n"
    '1. search("Pam Veasey")\n'
    '2. search("Jon Jost")\n'
    "Thought: I can answer the question now.\n"
    f"3. join(){END_OF_PLAN}\n"
    "###\n"
    "\n"
    "Question: What profession does Nicholas Ray and Elia Kazan have in common?\n"
    '1. search("Nicholas Ray")\n'
    '2. search("Elia Kazan")\n'
    "Thought: I can answer the question now.\n"
    f"3. join(){END_OF_PLAN}\n"
    "###\n"
    "\n"
    "Question: What is the number of kids of older person between Jeff Bezos and Elon Musk?\n"
    '1. search("Jeff Bezos")\n'
    '2. search("Elon Musk")\n'
    "Thought: I cannot answer the question before I know who is older.\n"
    f"3. join(){END_OF_PLAN}\n"
    "###\n"
    "\n"
)

OUTPUT_PROMPT = (
    "You must solve the Question. You are given Observations and you can use them to solve the Question. "
    "Then you MUST provide a Thought, and then an Action.\n"
    "Answer should always be a single item and MUST not be multiple choices.\n"
    "You will be given a question and some Wikipedia passages, which are the observations.\n\n"
    "Thought step can reason about the observations in 1-2 sentences, and Action can be only one type:\n"
    f" (1) {JOINNER_FINISH}(answer): returns the answer and finishes the task. "
    "\n"
    "Follow the guidelines that you will die if you don't follow:\n"
    "  - Answer should be short and a single item and MUST not be multiple choices.\n"
    "  - Thought should be 1-2 sentences.\n"
    "  - Action can only be Finish, and you MUST NEVER take any other actions\n"
    "  - You must say <END_OF_RESPONSE> at the end of your response.\n"
    "\n"
    "\n"
    "Here are some examples:\n"
    "\n"
    "Question: Which magazine was started first Arthur's Magazine or First for Women?\n"
    "search(Arthur's Magazine)\n"
    "Observation: Arthur's Magazine (1844-1846) was an American literary periodical published in Philadelphia in the 19th century.\n"
    "search(First for Women)\n"
    "Observation: First for Women is a woman's magazine published by Bauer Media Group in the USA.[1] The magazine was started in 1989.\n"
    "Thought: Arthur's Magazine was started in 1844. First for Women was started in 1989. 1844 (Arthur's Magazine) < 1989 (First for Women), so Arthur's Magazine was started first.\n"
    f"Action: {JOINNER_FINISH}(Arthur's Magazine)\n"
    "<END_OF_RESPONSE>\n"
    "\n"
    "\n"
    "Question: Were Pavel Urysohn and Leonid Levin known for the same type of work?\n"
    "search(Pavel Urysohn)\n"
    "Observation: Pavel Samuilovich Urysohn (February 3, 1898 - August 17, 1924) was a Soviet mathematician who is best known for his contributions in dimension theory.\n"
    "search(Leonid Levin)\n"
    "Observation: Leonid Anatolievich Levin is a Soviet-American mathematician and computer scientist.\n"
    "Thought: Pavel Urysohn is a mathematician. Leonid Levin is a mathematician and computer scientist. So Pavel Urysohn and Leonid Levin have the same type of work.\n"
    f"Action: {JOINNER_FINISH}(yes)\n"
    "<END_OF_RESPONSE>\n"
    "\n"
    "\n"
    "Question: What profession does Nicholas Ray and Elia Kazan have in common?\n"
    "Observation: Nicholas Ray (born Raymond Nicholas Kienzle Jr., August 7, 1911 - June 16, 1979) was an American film director best known for the 1955 film Rebel Without a Cause.\n"
    "Observation: Elia Kazan was an American film and theatre director.\n"
    "Thought: Professions of Nicholas Ray are director, screenwriter, and actor. Professions of Elia Kazan are director. So profession Nicholas Ray and Elia Kazan have in common is director.\n"
    f"Action: {JOINNER_FINISH}(director)\n"
    "<END_OF_RESPONSE>\n"
    "\n"
    "\n"
)

```

### Core Architecture Module: `configs/hotpotqa/tools.py`
```
from src.agents.tools import Tool
from src.docstore.wikipedia import DocstoreExplorer, ReActWikipedia

web_searcher = ReActWikipedia()
docstore = DocstoreExplorer(web_searcher)

tools = [
    Tool(
        name="search",
        func=docstore.asearch,
        description=(
            "search(entity: str) -> str:\n"
            " - Executes an exact search for the entity on Wikipedia.\n"
            " - Returns the first paragraph if the entity is found.\n"
            " - `entity`: entity to search for on Wikipedia, e.g., Mount Everest, cheetah, San Francisco, etc."
        ),
        stringify_rule=lambda args: f"search({args[0]})",
    ),
]

```

### Core Architecture Module: `configs/hotpotqa_react/configs.py`
```
from configs.hotpotqa_react.gpt_prompts import PROMPT as GPT_PROMPT
from configs.hotpotqa_react.llama_prompts import PROMPT as LLAMA_PROMPT

CONFIGS = {
    "default_model": "gpt-3.5-turbo-1106",
    "prompt": {
        "gpt": GPT_PROMPT,
        "llama": LLAMA_PROMPT,
    },
}

```

### Core Architecture Module: `configs/hotpotqa_react/gpt_prompts.py`
```
from langchain.prompts.prompt import PromptTemplate

_PREFIX = (
    "Solve a question answering task with interleaving Thought, Action, Observation steps.\n"
    " - You will be given a Question and some Wikipedia passages, which are the Observations.\n"
    " - Thought needs to reason about the question based on the Observations in 1-2 sentences.\n"
    " - There are cases where the Observations are unclear or irrelevant (in the case wikipedia search was not successful). In such a case where the Observations are unclear, you must make a best guess based on your own knowledge if you don't know the answer. You MUST NEVER say in your thought that you don't know the answer.\n"
    "\n"
    " - After Thought, you MUST always take an Action. Action can be two types:\n"
    "(1) Search[entity], which searches the exact entity on Wikipedia and returns the first paragraph if it exists. \n"
    # NOTE: uncomment this ReAct-specific prompt for better ReAct accuracy
    # "You MUST find all entities to make the most informed decision. Never search the same entity more than once.\n"
    " - `entity`: entity to search for on Wikipedia, e.g., Mount Everest, cheetah, San Francisco, etc.\n"
    " - Answer should be short and a single item and MUST not be multiple choices. Answer MUST NEVER be 'unclear', 'unknown', 'neither', 'unrelated' or 'undetermined', and otherwise you will be PENALIZED.\n"
    "(2) Finish[answer], which returns the answer and finishes the task.\n"
    " - You MUST use Finish to finish the task.\n"
    "Here are some examples.\n"
)

_EXAMPLES = [
    """Question: Which magazine was started first Arthur's Magazine or First for Women?
Thought: I need to search Arthur's Magazine and First for Women, and find which was started first.
Action: Search[Arthur's Magazine]
Observation: Arthur's Magazine (1844-1846) was an American literary periodical published in Philadelphia in the 19th century.
Thought: Arthur's Magazine was started in 1844. I need to search First for Women next.
Action: Search[First for Women (magazine)]
Observation: First for Women is a woman's magazine published by Bauer Media Group in the USA.[1] The magazine was started in 1989.
Thought: First for Women was started in 1989. 1844 (Arthur's Magazine) < 1989 (First for Women), so Arthur's Magazine was started first.
Action: Finish[Arthur's Magazine]""",
    """Question: Were Pavel Urysohn and Leonid Levin known for the same type of work?
Thought: I need to search Pavel Urysohn first.
Action: Search[Pavel Urysohn]
Observation: Pavel Samuilovich Urysohn (February 3, 1898 - August 17, 1924) was a Soviet mathematician who is best known for his contributions in dimension theory.
Thought: Then I need to search Leonid Levin.
Action: Search[Leonid Levin]
Observation: Leonid Anatolievich Levin is a Soviet-American mathematician and computer scientist.
Thought: Pavel Urysohn is a mathematician. Leonid Levin is a mathematician and computer scientist. So Pavel Urysohn and Leonid Levin have the same type of work.
Action: Finish[yes]""",
]

_SUFFIX = """\nQuestion: {input}
{agent_scratchpad}"""

PROMPT = PromptTemplate.from_examples(
    _EXAMPLES, _SUFFIX, ["input", "agent_scratchpad"], prefix=_PREFIX
)

```

### Core Architecture Module: `configs/hotpotqa_react/llama_prompts.py`
```
from langchain.prompts.prompt import PromptTemplate

_PREFIX = (
    "Solve a question answering task with interleaving Thought, Action, Observation steps.\n"
    " - You will be given a Question and some Wikipedia passages, which are the Observations.\n"
    " - Thought needs to reason about the question based on the Observations in 1-2 sentences.\n"
    " - There are cases where the Observations are unclear or irrelevant (in the case wikipedia search was not successful). "
    "In such a case where the Observations are unclear, you must make a best guess based on your own knowledge if you don't know the answer. "
    "You MUST NEVER say in your thought that you don't know the answer.\n"
    # comment this for unoptimized react
    " - NEVER search the same entities twice. Otherwise, you will be PANALIZED. "
    "If the information is not available, use your own knowledge.\n"
    "\n"
    " - After Thought, you MUST always take an Action. Action can be two types:\n"
    "(1) Search[entity], which searches the exact entity on Wikipedia and returns the first paragraph if it exists. "
    # comment this for unoptimized react
    "You MUST find all entities to make the most informed decision. Never search the same entity more than once.\n"
    " - Answer should be short and a single item and MUST not be multiple choices. "
    "Answer MUST NEVER be 'unclear', 'unknown', 'neither', 'unrelated' or 'undetermined', and otherwise you will be PENALIZED.\n"
    # comment this for unoptimized react
    " - You MUST NEVER search two entities more than once. Even if the search result is irrelavant or unavilable, you MUST NOT search it again or you will be PANALIZED. "
    # comment this for unoptimized react
    "Just say you will use your own knowledge and move on to produce the final answer.\n"
    "(2) Finish[answer], which returns the answer and finishes the task. After this action, you MUST output <END_OF_RESPONSE> to finish the task.\n"
    "Here are some examples."
)

EXAMPLES = [
    """Question: Which magazine was started first Arthur's Magazine or First for Women?
Thought: I need to search Arthur's Magazine and First for Women, and find which was started first.
Action: Search[Arthur's Magazine]
Observation: Arthur's Magazine (1844-1846) was an American literary periodical published in Philadelphia in the 19th century.
Thought: Arthur's Magazine was started in 1844. I need to search First for Women next.
Action: Search[First for Women (magazine)]
Observation: First for Women is a woman's magazine published by Bauer Media Group in the USA.[1] The magazine was started in 1989.
Thought: First for Women was started in 1989. 1844 (Arthur's Magazine) < 1989 (First for Women), so Arthur's Magazine was started first.
Action: Finish[Arthur's Magazine]<END_OF_RESPONSE>""",
    """Question: Were Pavel Urysohn and Leonid Levin known for the same type of work?
Thought: I need to search Pavel Urysohn first.
Action: Search[Pavel Urysohn]
Observation: Pavel Samuilovich Urysohn (February 3, 1898 - August 17, 1924) was a Soviet mathematician who is best known for his contributions in dimension theory.
Thought: Then I need to search Leonid Levin.
Action: Search[Leonid Levin]
Observation: Leonid Anatolievich Levin is a Soviet-American mathematician and computer scientist.
Thought: Pavel Urysohn is a mathematician. Leonid Levin is a mathematician and computer scientist. So Pavel Urysohn and Leonid Levin have the same type of work.
Action: Finish[yes]<END_OF_RESPONSE>""",
    """Question: Were Pavel Urysohn and Leonid Levin known for the same type of work?
Thought: I need to search Pavel Urysohn and Leonid Levin, find their types of work, then find if they are the same.
Action: Search[Pavel Urysohn]
Observation: Could not find [Pavel Urysohn].
Thought: I couldn't find Pavel Urysohn, so I will use my own knowledge. I need to search Leonid Levin next and the type of work.
Action: Search[Leonid Levin]
Observation: Leonid Anatolievich Levin is a Soviet-American mathematician and computer scientist.
Thought: Leonid Levin is a mathematician, and base on my knowledge Pavel Urysohn is also a mathematician. So they have the same type of work.
Action: Finish[yes]<END_OF_RESPONSE>""",
]


SUFFIX = """\nQuestion: {input}
{agent_scratchpad}"""

PROMPT = PromptTemplate.from_examples(
    EXAMPLES, SUFFIX, ["input", "agent_scratchpad"], prefix=_PREFIX
)

```

### Core Architecture Module: `configs/hotpotqa_react/tools.py`
```
from src.agents.tools import Tool
from src.docstore.wikipedia import DocstoreExplorer, ReActWikipedia

web_searcher = ReActWikipedia()
docstore = DocstoreExplorer(web_searcher)

tools = [
    Tool(
        name="Search",
        func=docstore.search,
        description=("useful for when you need to ask with search"),
    ),
]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #21** (2024-07-10): **Friendli endpoints support**
  *Symptoms*: 

- **Issue #18** (2024-05-05): **Double join is right answer?**
  *Symptoms*: I test some scenario and when I run the specific scenario, the result are shown like below:  ```python name='get_current_date' description='get_current_date() -> str - Returns the current date of format %Y-%m-%d %H:%M:%S' args_schema=<class 'pydantic.v1.main.get_current_dateSchema'> func=<function get_current_date at 0x7b3c69f03eb0> () --- name='parse_date' description="parse_date(date: str, character: Literal['Y', 'm', 'd', 'H', 'M', 'S']) -> int - extract specific parts of a date string formatted as 'YYYY-MM-DD'. When provided with a date and a format character ('Y' for year, 'm' for month, 'D' for day, 'H' for hour, 'M' for minute, 'S' for second), it returns the corresponding integer value of the year or month from the date." args_schema=<class 'pydantic.v1.main.parse_dateSchema'> func=<function parse_date at 0x7b3c69c705e0> {'character': 'm'} --- name='get_user_by_name' description='get_user_by_name(name: str) -> __main__.User - Returns User with given name' args_schema=<class 'pydantic.v1.main.get_user_by_nameSchema'> func=<function get_user_by_name at 0x7b3c69c793f0> {'name': '현재 사용자'} --- name='get_credit_by_user_and_month' description='get_credit_by_user_and_month(user_id: int, month: int) -> Optional[int] - Returns the credit at specific month.' args_schema=<class 'pydantic.v1.main.get_credit_by_user_and_monthSchema'> func=<function get_credit_by_user_and_month at 0x7b3c69c70700> {'user_id': '$3.id', 'month': '$2'} --- join () --- name='ask_user_for_add
  **Post-Mortem & Fix Analysis**:
  > the join operation is supposed to be called only once at the end of planning. If this happens persistently over your testing, I suggest that you add an instruction to avoid the join operations in the middle of planning, or provide more in-context examples. 

- **Issue #17** (2024-04-15): **api key as a env variable**
  *Symptoms*: Use OpenAI key by registering it as a env variable so we don't have to pass it as an argument

- **Issue #16** (2024-03-24): **Azure Endpoint Support**
  *Symptoms*: 

- **Issue #15** (2024-03-14): **Streaming Bugfix**
  *Symptoms*: 

- **Issue #14** (2024-03-15): **Error local variable 'full_output' referenced before assignment**
  *Symptoms*: hi，I used pre-training Qwen  and this error occurred `class Qwen_LLM(LLM):     tokenizer: AutoTokenizer = None     model: AutoModelForCausalLM = None      def __init__(self, model_path: str):         super().__init__()         print("Qwen Loading")         self.tokenizer = AutoTokenizer.from_pretrained(             model_path, trust_remote_code=True         )         self.model = AutoModelForCausalLM.from_pretrained(             model_path, device_map="auto", trust_remote_code=True         ).eval()         self.model.generation_config = GenerationConfig.from_pretrained(             model_path, trust_remote_code=True         )         self.model.generation_config.do_sample = False # greedy      def _call(self, prompt: str, stop: Optional[List[str]] = None, run_manager: Optional[CallbackManagerForLLMRun] = None, **kwargs: Any):         # stop = ["Observation:", "Observation:\n"]         # react_stop_words_tokens = [self.tokenizer.encode(stop_) for stop_ in stop]         # response, _ = self.model.chat(self.tokenizer, prompt, history=None, stop_words_ids=react_stop_words_tokens)         # response, _ = self.model.chat(self.tokenizer, prompt)         prompt_ids = torch.tensor([self.tokenizer.encode(prompt)]).to(self.model.device)         output = self.model.generate(prompt_ids, max_new_tokens=512, pad_token_id=self.tokenizer.eos_token_id).tolist()[0]         response = self.tokenizer.decode(output, errors="ignore")         return response      @proper
  **Post-Mortem & Fix Analysis**:
  > For the open source model, please try vLLM.
  > Hi, LLMCompiler currently only supports vLLM for using custom models. That said, you need to set up a vLLM server that runs the QWEN model, following the official vLLM documentation. LLMCompiler works as a client that pings the server once you do so.

- **Issue #13** (2024-02-13): **Update README.md**
  *Symptoms*: 

- **Issue #12** (2024-01-28): **Kssteven418 patch 2**
  *Symptoms*: 

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

### Incident Patch 1: `ffb29cc3` (2024-03-14)
**Commit Message**: Merge pull request #15 from SqueezeAILab/sk/bugfix-0314-2

Streaming Bugfix

**File**: `src/llm_compiler/planner.py` (modified, +4/-3)
```diff
@@ -107,7 +107,6 @@ def _match_buffer_and_generate_task(self, suffix: str) -> Optional[Task]:
         if match := re.match(THOUGHT_PATTERN, self.buffer):
             # Optionally, action can be preceded by a thought
             self.thought = match.group(1)
-            self.buffer = suffix
         elif match := re.match(ACTION_PATTERN, self.buffer):
             # if action is parsed, return the task, and clear the buffer
             idx, tool_name, args, _ = match.groups()
@@ -119,9 +118,9 @@ def _match_buffer_and_generate_task(self, suffix: str) -> Optional[Task]:
                 args=args,
                 thought=self.thought,
             )
-            self.buffer = suffix
             self.thought = ""
             return task
+
         return None
 
     def ingest_token(self, token: str) -> Optional[Task]:
@@ -130,7 +129,9 @@ def ingest_token(self, token: str) -> Optional[Task]:
             prefix, suffix = token.split("\n", 1)
             prefix = prefix.strip()
             self.buffer += prefix + "\n"
-            return self._match_buffer_and_generate_task(suffix)
+            matched_item = self._match_buffer_and_generate_task(suffix)
+            self.buffer = suffix
+            return matched_item
         else:
             self.buffer += token
 
```

---

### Incident Patch 2: `bbbbcd03` (2024-03-14)
**Commit Message**: Streaming Bugfix

**File**: `src/llm_compiler/planner.py` (modified, +4/-3)
```diff
@@ -107,7 +107,6 @@ def _match_buffer_and_generate_task(self, suffix: str) -> Optional[Task]:
         if match := re.match(THOUGHT_PATTERN, self.buffer):
             # Optionally, action can be preceded by a thought
             self.thought = match.group(1)
-            self.buffer = suffix
         elif match := re.match(ACTION_PATTERN, self.buffer):
             # if action is parsed, return the task, and clear the buffer
             idx, tool_name, args, _ = match.groups()
@@ -119,9 +118,9 @@ def _match_buffer_and_generate_task(self, suffix: str) -> Optional[Task]:
                 args=args,
                 thought=self.thought,
             )
-            self.buffer = suffix
             self.thought = ""
             return task
+
         return None
 
     def ingest_token(self, token: str) -> Optional[Task]:
@@ -130,7 +129,9 @@ def ingest_token(self, token: str) -> Optional[Task]:
             prefix, suffix = token.split("\n", 1)
             prefix = prefix.strip()
             self.buffer += prefix + "\n"
-            return self._match_buffer_and_generate_task(suffix)
+            matched_item = self._match_buffer_and_generate_task(suffix)
+            self.buffer = suffix
+            return matched_item
         else:
             self.buffer += token
 
```

---

### Incident Patch 3: `670ed234` (2024-01-27)
**Commit Message**: variable names fixed

**File**: `run_llm_compiler.py` (modified, +7/-7)
```diff
@@ -197,20 +197,20 @@ async def main():
         label = normalize_answer(_label)
 
         if str(id) not in all_results:
-            octopus_answer, octopus_time = await arun_and_time(
+            raw_answer, e2e_time = await arun_and_time(
                 agent.arun,
                 question,
                 callbacks=[logging_callback] if logging_callback is not None else None,
             )
-            normalized_octopus_answer = normalize_answer(octopus_answer)
-            print(f"Answer: {octopus_answer}")
-            print(normalized_octopus_answer, "<>", label)
-            print("time: ", octopus_time)
+            normalized_answer = normalize_answer(raw_answer)
+            print(f"Answer: {raw_answer}")
+            print(normalized_answer, "<>", label)
+            print("time: ", e2e_time)
             all_results[id] = {
                 "question": question,
                 "label": _label,  # not normalized
-                "answer": octopus_answer,  # not normalized
-                "time": octopus_time,
+                "answer": raw_answer,  # not normalized
+                "time": e2e_time,
             }
             stats = None
             if args.do_benchmark and args.react:
```

---

### Incident Patch 4: `30f5199d` (2024-01-17)
**Commit Message**: minor fix

**File**: `configs/parallelqa/tools.py` (modified, +1/-0)
```diff
@@ -55,6 +55,7 @@ async def run_llm_math_chain(question, context=None):
                 "you must convert the distance to kilometers.\n"
                 "  - If you are asked about a particular number in millions, billions, or any other unit, the number should be written without specifying the unit. "
                 "For example, if you are asked for 100 millions, it should be written as 100, not 100 million or 100,000,000.\n"
+                ' - Never introduce a variable. For instance "gazelle_max_speed * 1.4" is not allowed. Pick up a correct number from the given context.\n'
                 "\n"
                 f"{context_str}\n\n"
                 f"Question: {question}\n\n"
```

---

### Incident Patch 5: `b157cf7f` (2024-01-16)
**Commit Message**: React added for movie, llmcompiler bugfix

**File**: `configs/hotpotqa_react/llama_prompts.py` (modified, +6/-2)
```diff
@@ -7,16 +7,20 @@
     " - There are cases where the Observations are unclear or irrelevant (in the case wikipedia search was not successful). "
     "In such a case where the Observations are unclear, you must make a best guess based on your own knowledge if you don't know the answer. "
     "You MUST NEVER say in your thought that you don't know the answer.\n"
-    " - NEVER search the same entities twice. Otherwise, you will be PANALIZED. If the information is not available, use your own knowledge.\n"
+    # comment this for unoptimized react
+    " - NEVER search the same entities twice. Otherwise, you will be PANALIZED. "
+    "If the information is not available, use your own knowledge.\n"
     "\n"
     " - After Thought, you MUST always take an Action. Action can be two types:\n"
     "(1) Search[entity], which searches the exact entity on Wikipedia and returns the first paragraph if it exists. "
+    # comment this for unoptimized react
     "You MUST find all entities to make the most informed decision. Never search the same entity more than once.\n"
     " - Answer should be short and a single item and MUST not be multiple choices. "
     "Answer MUST NEVER be 'unclear', 'unknown', 'neither', 'unrelated' or 'undetermined', and otherwise you will be PENALIZED.\n"
+    # comment this for unoptimized react
     " - You MUST NEVER search two entities more than once. Even if the search result is irrelavant or unavilable, you MUST NOT search it again or you will be PANALIZED. "
+    # comment this for unoptimized react
     "Just say you will use your own knowledge and move on to produce the final answer.\n"
-    # " - You can only use search twice."
     "(2) Finish[answer], which returns the answer and finishes the task. After this action, you MUST output <END_OF_RESPONSE> to finish the task.\n"
     "Here are some examples."
 )
```

**File**: `configs/movie/tools.py` (modified, +22/-13)
```diff
@@ -1,18 +1,27 @@
 from src.agents.tools import Tool
 from src.docstore.wikipedia import DocstoreExplorer, ReActWikipedia
 
-web_searcher = ReActWikipedia()
-docstore = DocstoreExplorer(web_searcher)
 
-tools = [
-    Tool(
-        name="search",
-        func=docstore.asearch,
-        description=(
-            "search(entity: str) -> str:\n"
-            " - Executes an exact search for the entity on Wikipedia.\n"
-            " - Returns the first paragraph if the entity is found.\n"
+def generate_tools(args):
+    web_searcher = ReActWikipedia()
+    if args.model_type == "vllm":
+        # If we use LLaMA with vLLM for the movie recommendation task,
+        # we frequently get the context length error, so we limit the
+        # wikipedia context length to 400 and only return the first sentence.
+        docstore = DocstoreExplorer(web_searcher, char_limit=400, one_sentence=True)
+    else:
+        docstore = DocstoreExplorer(web_searcher)
+
+    tools = [
+        Tool(
+            name="search",
+            func=docstore.asearch,
+            description=(
+                "search(entity: str) -> str:\n"
+                " - Executes an exact search for the entity on Wikipedia.\n"
+                " - Returns the first paragraph if the entity is found.\n"
+            ),
+            stringify_rule=lambda args: f"search({args[0]})",
         ),
-        stringify_rule=lambda args: f"search({args[0]})",
-    ),
-]
+    ]
+    return tools
```

**File**: `configs/movie_react/llama_prompts.py` (modified, +2/-3)
```diff
@@ -8,9 +8,8 @@
     " Never provide answers with explanations or descriptions. answer MUST always be a movie title, nothing else. Answer should never be 'None' or 'I don't know'.\n"
     "Guidelines:\n"
     "- You MUST always output with Finish[answer] even if you are not sure about the answer.\n"
-    "- You MUST search for information about all movies even if the first 4 are dissimilar.\n"
-    "- You MUST find all movies to make the most informed decision including the movies in the options.\n"
-    "- You MUST NEVER find the same movies twice. Even when the search results are not relevant or informative, never search it again or retry with other options.\n"
+    # comment the following sentence for the unoptimized react
+    "- You MUST find all movies and NEVER find the same movies twice.\n"
     "- The Search result may not be available (in case search failed) or not relevant to movie information. If this happens, just ignore it and rely on your own knowledge on that movie.\n"
     "- When you provide the final answer, you MUST use the format Finish[answer], and must NEVER use any other format. answer MUST be a movie title, nothing else. "
     "NEVER provide any other explanation or description. If you don't follow this format, you will be PANALIZED.\n"
```

**File**: `configs/movie_react/tools.py` (modified, +19/-10)
```diff
@@ -1,14 +1,23 @@
 from src.agents.tools import Tool
 from src.docstore.wikipedia import DocstoreExplorer, ReActWikipedia
 
-web_searcher = ReActWikipedia()
-docstore = DocstoreExplorer(web_searcher)
 
-tools = [
-    Tool(
-        name="Search",
-        func=docstore.search,
-        # NOTE: This description is not used
-        description="useful for when you need to ask with search",
-    ),
-]
+def generate_tools(args):
+    web_searcher = ReActWikipedia()
+    if args.model_type == "vllm":
+        # If we use LLaMA with vLLM for the movie recommendation task,
+        # we frequently get the context length error, so we limit the
+        # wikipedia context length to 400 and only return the first sentence.
+        docstore = DocstoreExplorer(web_searcher, char_limit=400, one_sentence=True)
+    else:
+        docstore = DocstoreExplorer(web_searcher)
+
+    tools = [
+        Tool(
+            name="Search",
+            func=docstore.search,
+            # NOTE: This description is not used
+            description="useful for when you need to ask with search",
+        ),
+    ]
+    return tools
```

**File**: `configs/parallelqa/tools.py` (modified, +12/-1)
```diff
@@ -1,5 +1,7 @@
 from src.agents.tools import Tool
+from src.chains.llm_math_chain import LLMMathChain
 from src.docstore.wikipedia import DocstoreExplorer, ReActWikipedia
+from src.utils.model_utils import get_model
 
 _MATH_DESCRIPTION = (
     "math(problem: str, context: Optional[list[str]]) -> float:\n"
@@ -76,7 +78,16 @@ async def run_llm_math_chain(question, context=None):
 docstore = DocstoreExplorer(web_searcher)
 
 
-def generate_tools(llm_math_chain):
+def generate_tools(args, model_name):
+    llm_math_chain = get_model(
+        model_type=args.model_type,
+        model_name=model_name,
+        api_key=args.api_key,
+        vllm_port=args.vllm_port,
+        stream=False,
+        temperature=0,
+    )
+    llm_math_chain = LLMMathChain.from_llm(llm=llm_math_chain, verbose=True)
     return [
         Tool(
             name="search",
```

**File**: `configs/parallelqa_react/tools.py` (modified, +12/-1)
```diff
@@ -1,5 +1,7 @@
 from src.agents.tools import Tool
+from src.chains.llm_math_chain import LLMMathChain
 from src.docstore.wikipedia import DocstoreExplorer, ReActWikipedia
+from src.utils.model_utils import get_model
 
 
 def run_llm_math_chain_factory(llm_math_chain):
@@ -27,7 +29,16 @@ def run_llm_math_chain(args):
 docstore = DocstoreExplorer(web_searcher)
 
 
-def generate_tools(llm_math_chain):
+def generate_tools(args, model_name):
+    llm_math_chain = get_model(
+        model_type=args.model_type,
+        model_name=model_name,
+        api_key=args.api_key,
+        vllm_port=args.vllm_port,
+        stream=False,
+        temperature=0,
+    )
+    llm_math_chain = LLMMathChain.from_llm(llm=llm_math_chain, verbose=True)
     return [
         Tool(
             name="Search",
```

**File**: `run_llm_compiler.py` (modified, +6/-16)
```diff
@@ -11,9 +11,9 @@
 from configs.hotpotqa_react.configs import CONFIGS as HOTPOTQA_REACT_CONFIGS
 from configs.hotpotqa_react.tools import tools as hotpotqa_react_tools
 from configs.movie.configs import CONFIGS as MOVIE_CONFIGS
-from configs.movie.tools import tools as movie_tools
+from configs.movie.tools import generate_tools as movie_generate_tools
 from configs.movie_react.configs import CONFIGS as MOVIE_REACT_CONFIGS
-from configs.movie_react.tools import tools as movie_react_tools
+from configs.movie_react.tools import generate_tools as movie_react_generate_tools
 from configs.parallelqa.configs import CONFIGS as PARALLELQA_CONFIGS
 from configs.parallelqa.tools import generate_tools as parallelqa_generate_tools
 from configs.parallelqa_react.configs import CONFIGS as PARALLELQA_REACT_CONFIGS
@@ -79,29 +79,19 @@ def get_dataset(args):
 def get_tools(model_name, args):
     if args.benchmark_name == "movie":
         if args.react:
-            tools = movie_react_tools
+            tools = movie_react_generate_tools(args)
         else:
-            tools = movie_tools
+            tools = movie_generate_tools(args)
     elif args.benchmark_name == "hotpotqa":
         if args.react:
             tools = hotpotqa_react_tools
         else:
             tools = hotpotqa_tools
     elif args.benchmark_name == "parallelqa":
-        llm_math_chain = get_model(
-            model_type=args.model_type,
-            model_name=model_name,
-            api_key=args.api_key,
-            vllm_port=args.vllm_port,
-            stream=False,
-            temperature=0,
-        )
-        llm_math_chain = LLMMathChain.from_llm(llm=llm_math_chain, verbose=True)
-
         if args.react:
-            tools = parallelqa_react_generate_tools(llm_math_chain)
+            tools = parallelqa_react_generate_tools(args, model_name)
         else:
-            tools = parallelqa_generate_tools(llm_math_chain)
+            tools = parallelqa_generate_tools(args, model_name)
     else:
         raise ValueError(f"Unknown benchmark name: {args.benchmark_name}")
     return tools
```

**File**: `src/llm_compiler/planner.py` (modified, +23/-11)
```diff
@@ -6,6 +6,7 @@
 
 from langchain.callbacks.base import AsyncCallbackHandler, Callbacks
 from langchain.chat_models.base import BaseChatModel
+from langchain.llms.base import BaseLLM
 from langchain.schema import LLMResult
 from langchain.schema.messages import HumanMessage, SystemMessage
 
@@ -225,19 +226,30 @@ async def run_llm(
             system_prompt = self.system_prompt
             human_prompt = f"Question: {inputs['input']}"
 
-        messages = [
-            SystemMessage(content=system_prompt),
-            HumanMessage(content=human_prompt),
-        ]
+        if isinstance(self.llm, BaseChatModel):
+            messages = [
+                SystemMessage(content=system_prompt),
+                HumanMessage(content=human_prompt),
+            ]
+            llm_response = await self.llm._call_async(
+                messages,
+                callbacks=callbacks,
+                stop=self.stop,
+            )
+            response = llm_response.content
+        elif isinstance(self.llm, BaseLLM):
+            message = system_prompt + "\n\n" + human_prompt
+            response = await self.llm.apredict(
+                message,
+                callbacks=callbacks,
+                stop=self.stop,
+            )  # type: ignore
+        else:
+            raise NotImplementedError("LLM must be either BaseChatModel or BaseLLM")
 
-        llm_response = await self.llm._call_async(
-            messages,
-            callbacks=callbacks,
-            stop=self.stop,
-        )
-        log("LLMCompiler planner response: \n", llm_response.content, block=True)
+        log("LLMCompiler planner response: \n", response, block=True)
 
-        return llm_response.content
+        return response
 
     async def plan(
         self, inputs: dict, is_replan: bool, callbacks: Callbacks = None, **kwargs: Any
```

---

### Incident Patch 6: `f93af134` (2024-01-14)
**Commit Message**: minor fix

**File**: `configs/hotpotqa_react/configs.py` (modified, +3/-0)
```diff
@@ -1,3 +1,6 @@
+from configs.hotpotqa_react.gpt_prompts import PROMPT
+
 CONFIGS = {
     "default_model": "gpt-3.5-turbo-1106",
+    "prompt": PROMPT,
 }
```

**File**: `configs/movie_react/configs.py` (modified, +3/-0)
```diff
@@ -1,3 +1,6 @@
+from configs.movie_react.gpt_prompts import PROMPT
+
 CONFIGS = {
     "default_model": "gpt-3.5-turbo-1106",
+    "prompt": PROMPT,
 }
```

**File**: `configs/parallelqa_react/configs.py` (modified, +3/-0)
```diff
@@ -1,3 +1,6 @@
+from configs.parallelqa_react.gpt_prompts import PROMPT
+
 CONFIGS = {
     "default_model": "gpt-4-1106-preview",
+    "prompt": PROMPT,
 }
```

**File**: `run_llm_compiler.py` (modified, +2/-13)
```diff
@@ -132,26 +132,15 @@ def get_configs(args):
     return configs
 
 
-def get_react_prompt(args):
-    if args.benchmark_name == "movie":
-        prompt = MOVIE_REACT_PROMPT
-    elif args.benchmark_name == "hotpotqa":
-        prompt = HOTPOTQA_REACT_PROMPT
-    elif args.benchmark_name == "parallelqa":
-        prompt = PARALLELQA_REACT_PROMPT
-    else:
-        raise ValueError(f"Unknown benchmark name: {args.benchmark_name}")
-    return prompt
-
-
 async def main():
     configs = get_configs(args)
     model_name = args.model_name or configs["default_model"]
     dataset = get_dataset(args)
     tools = get_tools(model_name, args)
 
     if args.react:
-        prompt = get_react_prompt(args)
+        assert "prompt" in configs, "React config requires a prompt"
+        prompt = configs["prompt"]
         print("Run React")
         llm = get_model(
             model_type=args.model_type,
```

---

### Incident Patch 7: `3aa00448` (2024-01-11)
**Commit Message**: Merge pull request #7 from SqueezeAILab/sk/bugfix-0111

bugfix

**File**: `run_llm_compiler.py` (modified, +4/-4)
```diff
@@ -95,14 +95,14 @@ def get_tools(model_name, args):
 def get_configs(args):
     if args.benchmark_name == "movie":
         if args.react:
-            configs = MOVIE_CONFIGS
-        else:
             configs = MOVIE_REACT_CONFIGS
+        else:
+            configs = MOVIE_CONFIGS
     elif args.benchmark_name == "hotpotqa":
         if args.react:
-            configs = HOTPOTQA_CONFIGS
-        else:
             configs = HOTPOTQA_REACT_CONFIGS
+        else:
+            configs = HOTPOTQA_CONFIGS
     elif args.benchmark_name == "parallelqa":
         if args.react:
             configs = PARALLELQA_REACT_CONFIGS
```

---

### Incident Patch 8: `148928c5` (2024-01-11)
**Commit Message**: bugfix

**File**: `run_llm_compiler.py` (modified, +4/-4)
```diff
@@ -95,14 +95,14 @@ def get_tools(model_name, args):
 def get_configs(args):
     if args.benchmark_name == "movie":
         if args.react:
-            configs = MOVIE_CONFIGS
-        else:
             configs = MOVIE_REACT_CONFIGS
+        else:
+            configs = MOVIE_CONFIGS
     elif args.benchmark_name == "hotpotqa":
         if args.react:
-            configs = HOTPOTQA_CONFIGS
-        else:
             configs = HOTPOTQA_REACT_CONFIGS
+        else:
+            configs = HOTPOTQA_CONFIGS
     elif args.benchmark_name == "parallelqa":
         if args.react:
             configs = PARALLELQA_REACT_CONFIGS
```

---

### Incident Patch 9: `cb0716fc` (2023-12-09)
**Commit Message**: Merge pull request #2 from SqueezeAILab/sk/requirements

missing requirements added

**File**: `requirements.txt` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+bs4==0.0.1
+langchain==0.0.348
+numexpr==2.8.7
+tiktoken==0.5.2
+openai==1.3.7
\ No newline at end of file
```

---

### Incident Patch 10: `f25e419a` (2023-12-09)
**Commit Message**: requirements added

**File**: `requirements.txt` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+bs4==0.0.1
+langchain==0.0.348
+numexpr==2.8.7
+tiktoken==0.5.2
+openai==1.3.7
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #21** (2024-07-10): Friendli endpoints support (@kssteven418)
- **PR #17** (2024-04-15): api key as a env variable (@kssteven418)
- **PR #16** (2024-03-24): Azure Endpoint Support (@kssteven418)
- **PR #15** (2024-03-14): Streaming Bugfix (@kssteven418)
- **PR #13** (2024-02-13): Update README.md (@kssteven418)
- **PR #12** (2024-01-28): Kssteven418 patch 2 (@kssteven418)
- **PR #11** (2024-01-28): benchmarking code added (@kssteven418)
- **PR #10** (2024-01-25): Update README.md (@kssteven418)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
