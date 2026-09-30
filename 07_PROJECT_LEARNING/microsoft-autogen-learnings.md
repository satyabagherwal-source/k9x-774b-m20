# Forensic Learning Record (Deep Inspection): microsoft/autogen

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-autogen-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/autogen](https://github.com/microsoft/autogen))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:15:58.508Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/autogen`
- **Description**: A programming framework for agentic AI
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 61243 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `dotnet/website/template/public/main.js`
```
export default {
    iconLinks: [
      {
        icon: 'github',
        href: 'https://github.com/microsoft/autogen',
        title: 'GitHub'
      }
    ]
  }
```

### Core Architecture Module: `python/check_md_code_blocks.py`
```
"""Check code blocks in Markdown files for syntax errors."""

import argparse
import logging
import tempfile
from typing import List, Tuple

from pygments import highlight  # type: ignore
from pygments.formatters import TerminalFormatter
from pygments.lexers import PythonLexer
from sphinx.util.console import darkgreen, darkred, faint, red, teal  # type: ignore[attr-defined]

logger = logging.getLogger(__name__)
logger.addHandler(logging.StreamHandler())
logger.setLevel(logging.INFO)

def extract_python_code_blocks(markdown_file_path: str) -> List[Tuple[str, int]]:
    """Extract Python code blocks from a Markdown file."""
    with open(markdown_file_path, "r", encoding="utf-8") as file:
        lines = file.readlines()

    code_blocks: List[Tuple[str, int]] = []
    in_code_block = False
    current_block: List[str] = []

    for i, line in enumerate(lines):
        if line.strip().startswith("```python"):
            in_code_block = True
            current_block = []
        elif line.strip().startswith("```"):
            in_code_block = False
            code_blocks.append(("\n".join(current_block), i - len(current_block) + 1))
        elif in_code_block:
            current_block.append(line)

    return code_blocks

def check_code_blocks(markdown_file_paths: List[str]) -> None:
    """Check Python code blocks in a Markdown file for syntax errors."""
    files_with_errors = []

    for markdown_file_path in markdown_file_paths:
        code_blocks = extract_python_code_blocks(markdown_file_path)
        had_errors = False
        for code_block, line_no in code_blocks:
            markdown_file_path_with_line_no = f"{markdown_file_path}:{line_no}"
            logger.info("Checking a code block in %s...", markdown_file_path_with_line_no)

            # Skip blocks that don't import autogen_agentchat, autogen_core, or autogen_ext
            if all(all(import_code not in code_block for import_code in [f"import {module}", f"from {module}"]) for module in ["autogen_agentchat", "autogen_core", "autogen_ext"]):
                logger.info(" " + darkgreen("OK[ignored]"))
                continue

            with tempfile.NamedTemporaryFile(suffix=".py", delete=False) as temp_file:
                temp_file.write(code_block.encode("utf-8"))
                temp_file.flush()

                # Run pyright on the temporary file using subprocess.run
                import subprocess

                result = subprocess.run(["pyright", temp_file.name], capture_output=True, text=True)
                if result.returncode != 0:
                    logger.info(" " + darkred("FAIL"))
                    highlighted_code = highlight(code_block, PythonLexer(), TerminalFormatter())  # type: ignore
                    output = f"{faint('========================================================')}\n{red('Error')}: Pyright found issues in {teal(markdown_file_path_with_line_no)}:\n{faint('--------------------------------------------------------')}\n{highlighted_code}\n{faint('--------------------------------------------------------')}\n\n{teal('pyright output:')}\n{red(result.stdout)}{faint('========================================================')}\n"
                    logger.info(output)
                    had_errors = True
                else:
                    logger.info(" " + darkgreen("OK"))

        if had_errors:
            files_with_errors.append(markdown_file_path)

    if files_with_errors:
        raise RuntimeError("Syntax errors found in the following files:\n" + "\n".join(files_with_errors))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Check code blocks in Markdown files for syntax errors.")
    # Argument is a list of markdown files containing glob patterns
    parser.add_argument("markdown_files", nargs="+", help="Markdown files to check.")
    args = parser.parse_args()
    check_code_blocks(args.markdown_files)

```

### Core Architecture Module: `python/fixup_generated_files.py`
```
from pathlib import Path
from typing import Dict

this_file_dir = Path(__file__).parent

files = [
    this_file_dir / "packages/autogen-ext/src/autogen_ext/runtimes/grpc/protos/agent_worker_pb2_grpc.py",
    this_file_dir / "packages/autogen-ext/src/autogen_ext/runtimes/grpc/protos/agent_worker_pb2_grpc.pyi",
    this_file_dir / "packages/autogen-ext/src/autogen_ext/runtimes/grpc/protos/agent_worker_pb2.py",
    this_file_dir / "packages/autogen-ext/src/autogen_ext/runtimes/grpc/protos/agent_worker_pb2.pyi",
    this_file_dir / "packages/autogen-ext/src/autogen_ext/runtimes/grpc/protos/cloudevent_pb2_grpc.py",
    this_file_dir / "packages/autogen-ext/src/autogen_ext/runtimes/grpc/protos/cloudevent_pb2_grpc.pyi",
    this_file_dir / "packages/autogen-ext/src/autogen_ext/runtimes/grpc/protos/cloudevent_pb2.py",
    this_file_dir / "packages/autogen-ext/src/autogen_ext/runtimes/grpc/protos/cloudevent_pb2.pyi",
]

substitutions: Dict[str, str] = {
    "\nimport agent_worker_pb2 as agent__worker__pb2\n": "\nfrom . import agent_worker_pb2 as agent__worker__pb2\n",
    "\nimport agent_worker_pb2\n": "\nfrom . import agent_worker_pb2\n",
    "\nimport cloudevent_pb2 as cloudevent__pb2\n": "\nfrom . import cloudevent_pb2 as cloudevent__pb2\n",
    "\nimport cloudevent_pb2\n": "\nfrom . import cloudevent_pb2\n",
}


def main():
    for file in files:
        with open(file, "r") as f:
            content = f.read()

        print("Fixing imports in file:", file)
        for old, new in substitutions.items():
            content = content.replace(old, new)

        with open(file, "w") as f:
            f.write(content)

```

### Core Architecture Module: `python/packages/agbench/benchmarks/GAIA/Scripts/custom_tabulate.py`
```
import os
import sys
import re
from agbench.tabulate_cmd import default_tabulate
import json
import pandas as pd
import sqlite3
import glob
import string
import warnings
import numpy as np

EXCLUDE_DIR_NAMES = ["__pycache__"]


def in_house_normalize_answer(a):
    # Lower case
    # Trim (left and right)
    # standardize comma separated values
    # Replace multiple spaces with one space
    # Remove trailing punctuation
    norm_answer = ", ".join(a.strip().lower().split(","))
    norm_answer = re.sub(r"[\.\!\?]+$", "", re.sub(r"\s+", " ", norm_answer))
    return norm_answer


def in_house_question_scorer(
    model_answer: str,
    ground_truth: str,
) -> bool:
     n_ma = in_house_normalize_answer(model_answer)
     n_gt = in_house_normalize_answer(ground_truth)
     return (n_gt != "" and n_gt == n_ma)
 

def gaia_question_scorer(
    model_answer: str,
    ground_truth: str,
) -> bool:
    #FROM: https://huggingface.co/spaces/gaia-benchmark/leaderboard/blob/main/scorer.py

    def normalize_number_str(number_str: str) -> float:
        # we replace these common units and commas to allow
        # conversion to float
        for char in ["$", "%", ","]:
            number_str = number_str.replace(char, "")
        try:
            return float(number_str)
        except ValueError:
            print(f"String {number_str} cannot be normalized to number str.")
            return float("inf")

    def split_string(s: str, char_list: list[str] = [",", ";"],) -> list[str]:
        pattern = f"[{''.join(char_list)}]"
        return re.split(pattern, s)

    def normalize_str(input_str, remove_punct=True) -> str:
        """
        Normalize a string by:
        - Removing all white spaces
        - Optionally removing punctuation (if remove_punct is True)
        - Converting to lowercase
        Parameters:
        - input_str: str, the string to normalize
        - remove_punct: bool, whether to remove punctuation (default: True)
        Returns:
        - str, the normalized string
        """
        # Remove all white spaces. Required e.g for seagull vs. sea gull
        no_spaces = re.sub(r"\s", "", input_str)

        # Remove punctuation, if specified.
        if remove_punct:
            translator = str.maketrans("", "", string.punctuation)
            return no_spaces.lower().translate(translator)
        else:
            return no_spaces.lower()


    def is_float(element: any) -> bool:
        try:
            float(element)
            return True
        except ValueError:
            return False

    # if gt is a number
    if is_float(ground_truth):
        normalized_answer = normalize_number_str(model_answer)
        return normalized_answer == float(ground_truth)

    # if gt is a list
    elif any(char in ground_truth for char in [",", ";"]):
        # question with the fish: normalization removes punct

        gt_elems = split_string(ground_truth)
        ma_elems = split_string(model_answer)

        # check length is the same
        if len(gt_elems) != len(ma_elems):
            #warnings.warn(
            #    "Answer lists have different lengths, returning False.", UserWarning
            #)
            return False

        # compare each element as float or str
        comparisons = []
        for ma_elem, gt_elem in zip(ma_elems, gt_elems):
            if is_float(gt_elem):
                normalized_ma_elem = normalize_number_str(ma_elem)
                comparisons.append(normalized_ma_elem == float(gt_elem))
            else:
                # we do not remove punct since comparisons can include punct
                comparisons.append(
                    normalize_str(ma_elem, remove_punct=False)
                    == normalize_str(gt_elem, remove_punct=False)
                )
        return all(comparisons)

    # if gt is a str
    else:
        return normalize_str(model_answer) == normalize_str(ground_truth)


##############

def scorer(instance_dir):
    # Read the expected answer
    expected_answer_file = os.path.join(instance_dir, "expected_answer.txt")
    if not os.path.isfile(expected_answer_file):
        return None

    expected_answer = None
    with open(expected_answer_file, "rt") as fh:
        expected_answer = fh.read().strip()

    # Read the console
    console_log_file = os.path.join(instance_dir, "console_log.txt")
    if not os.path.isfile(console_log_file):
        return None

    console_log = ""
    with open(console_log_file, "rt") as fh:
        console_log = fh.read()

        final_answer = None 
        m = re.search(r"FINAL ANSWER:(.*?)\n", console_log, re.DOTALL)
        if m:
            final_answer = m.group(1).strip()

        # Missing the final answer line
        if final_answer is None:
            return None

        # Return true if they are equal after normalization
        # return in_house_question_scorer(final_answer, expected_answer)
        return gaia_question_scorer(final_answer, expected_answer)


def main(args):
    default_tabulate(args, scorer=scorer)

if __name__ == "__main__" and __package__ is None:
    main(sys.argv)

```

### Core Architecture Module: `python/packages/agbench/benchmarks/GAIA/Scripts/init_tasks.py`
```
#
# Run this file to download the human_eval dataset, and create a corresponding testbed scenario:
# (default: ../scenarios/human_eval_two_agents_gpt4.jsonl and ./scenarios/human_eval_two_agents_gpt35.jsonl)
#

import json
import os
import re
import sys

from huggingface_hub import snapshot_download

SCRIPT_PATH = os.path.realpath(__file__)
SCRIPT_NAME = os.path.basename(SCRIPT_PATH)
SCRIPT_DIR = os.path.dirname(SCRIPT_PATH)

SCENARIO_DIR = os.path.realpath(os.path.join(SCRIPT_DIR, os.path.pardir))
TEMPLATES_DIR = os.path.join(SCENARIO_DIR, "Templates")
TASKS_DIR = os.path.join(SCENARIO_DIR, "Tasks")
DOWNLOADS_DIR = os.path.join(SCENARIO_DIR, "Downloads")
REPO_DIR = os.path.join(DOWNLOADS_DIR, "GAIA")


def download_gaia():
    """Download the GAIA benchmark from Hugging Face."""

    if not os.path.isdir(DOWNLOADS_DIR):
        os.mkdir(DOWNLOADS_DIR)

    """Download the GAIA dataset from Hugging Face Hub"""
    snapshot_download(
        repo_id="gaia-benchmark/GAIA",
        repo_type="dataset",
        local_dir=REPO_DIR,
        local_dir_use_symlinks=True,
    )


def create_jsonl(name, tasks, files_dir, template):
    """Creates a JSONL scenario file with a given name, and template path."""

    if not os.path.isdir(TASKS_DIR):
        os.mkdir(TASKS_DIR)

    with open(os.path.join(TASKS_DIR, name + ".jsonl"), "wt") as fh:
        for task in tasks:
            print(f"Converting: [{name}] {task['task_id']}")

            # Figure out what files we need to copy
            template_cp_list = [template]
            if len(task["file_name"].strip()) > 0:
                template_cp_list.append(
                    [
                        os.path.join(files_dir, task["file_name"].strip()),
                        task["file_name"].strip(),
                        #os.path.join("coding", task["file_name"].strip()),
                    ]
                )

            record = {
                "id": task["task_id"],
                "template": template_cp_list,
                "substitutions": {
                    "scenario.py": {
                        "__FILE_NAME__": task["file_name"],
                    },
                    "expected_answer.txt": {"__EXPECTED_ANSWER__": task["Final answer"]},
                    "prompt.txt": {"__PROMPT__": task["Question"]},
                },
            }

            fh.write(json.dumps(record).strip() + "\n")


###############################################################################
def main():
    gaia_validation_files = os.path.join(REPO_DIR, "2023", "validation")
    gaia_test_files = os.path.join(REPO_DIR, "2023", "test")

    if not os.path.isdir(gaia_validation_files) or not os.path.isdir(gaia_test_files):
        download_gaia()

    if not os.path.isdir(gaia_validation_files) or not os.path.isdir(gaia_test_files):
        sys.exit(f"Error: '{REPO_DIR}' does not appear to be a copy of the GAIA repository.")

    # Load the GAIA data
    gaia_validation_tasks = [[], [], []]
    with open(os.path.join(gaia_validation_files, "metadata.jsonl")) as fh:
        for line in fh:
            data = json.loads(line)
            gaia_validation_tasks[data["Level"] - 1].append(data)

    gaia_test_tasks = [[], [], []]
    with open(os.path.join(gaia_test_files, "metadata.jsonl")) as fh:
        for line in fh:
            data = json.loads(line)

            # A welcome message -- not a real task
            if data["task_id"] == "0-0-0-0-0":
                continue

            gaia_test_tasks[data["Level"] - 1].append(data)

    # list all directories in the Templates directory
    # and populate a dictionary with the name and path
    templates = {}
    for entry in os.scandir(TEMPLATES_DIR):
        if entry.is_dir():
            templates[re.sub(r"\s", "", entry.name)] = entry.path

    # Add coding directories if needed (these are usually empty and left out of the repo)
    #for template in templates.values():
    #    code_dir_path = os.path.join(template, "coding")
    #    if not os.path.isdir(code_dir_path):
    #        os.mkdir(code_dir_path)

    # Create the various combinations of [models] x [templates]
    for t in templates.items():
        create_jsonl(
            f"gaia_validation_level_1__{t[0]}",
            gaia_validation_tasks[0],
            gaia_validation_files,
            t[1],
        )
        create_jsonl(
            f"gaia_validation_level_2__{t[0]}",
            gaia_validation_tasks[1],
            gaia_validation_files,
            t[1],
        )
        create_jsonl(
            f"gaia_validation_level_3__{t[0]}",
            gaia_validation_tasks[2],
            gaia_validation_files,
            t[1],
        )
        create_jsonl(
            f"gaia_test_level_1__{t[0]}",
            gaia_test_tasks[0],
            gaia_test_files,
            t[1],
        )
        create_jsonl(
            f"gaia_test_level_2__{t[0]}",
            gaia_test_tasks[1],
            gaia_test_files,
            t[1],
        )
        create_jsonl(
            f"gaia_test_level_3__{t[0]}",
            gaia_test_tasks[2],
            gaia_test_files,
            t[1],
        )


if __name__ == "__main__" and __package__ is None:
    main()

```

### Core Architecture Module: `python/packages/agbench/benchmarks/GAIA/Templates/MagenticOne/scenario.py`
```
import asyncio
import os
import yaml
import warnings
from autogen_ext.agents.magentic_one import MagenticOneCoderAgent
from autogen_agentchat.teams import MagenticOneGroupChat
from autogen_agentchat.ui import Console
from autogen_core.models import ModelFamily
from autogen_ext.code_executors.local import LocalCommandLineCodeExecutor
from autogen_agentchat.conditions import TextMentionTermination
from autogen_core.models import ChatCompletionClient
from autogen_ext.agents.web_surfer import MultimodalWebSurfer
from autogen_ext.agents.file_surfer import FileSurfer
from autogen_agentchat.agents import CodeExecutorAgent
from autogen_agentchat.messages import TextMessage

# Suppress warnings about the requests.Session() not being closed
warnings.filterwarnings(action="ignore", message="unclosed", category=ResourceWarning)

async def main() -> None:

    # Load model configuration and create the model client.
    with open("config.yaml", "r") as f:
        config = yaml.safe_load(f)

    orchestrator_client = ChatCompletionClient.load_component(config["orchestrator_client"])
    coder_client = ChatCompletionClient.load_component(config["coder_client"])
    web_surfer_client = ChatCompletionClient.load_component(config["web_surfer_client"])
    file_surfer_client = ChatCompletionClient.load_component(config["file_surfer_client"])
    
    # Read the prompt
    prompt = ""
    with open("prompt.txt", "rt") as fh:
        prompt = fh.read().strip()
    filename = "__FILE_NAME__".strip()

    # Set up the team
    coder = MagenticOneCoderAgent(
        "Assistant",
        model_client = coder_client,
    )

    executor = CodeExecutorAgent("ComputerTerminal", code_executor=LocalCommandLineCodeExecutor())

    file_surfer = FileSurfer(
        name="FileSurfer",
        model_client = file_surfer_client,
    )
                
    web_surfer = MultimodalWebSurfer(
        name="WebSurfer",
        model_client = web_surfer_client,
        downloads_folder=os.getcwd(),
        debug_dir="logs",
        to_save_screenshots=True,
    )

    team = MagenticOneGroupChat(
        [coder, executor, file_surfer, web_surfer],
        model_client=orchestrator_client,
        max_turns=20,
        final_answer_prompt= f""",
We have completed the following task:

{prompt}

The above messages contain the conversation that took place to complete the task.
Read the above conversation and output a FINAL ANSWER to the question.
To output the final answer, use the following template: FINAL ANSWER: [YOUR FINAL ANSWER]
Your FINAL ANSWER should be a number OR as few words as possible OR a comma separated list of numbers and/or strings.
ADDITIONALLY, your FINAL ANSWER MUST adhere to any formatting instructions specified in the original question (e.g., alphabetization, sequencing, units, rounding, decimal places, etc.)
If you are asked for a number, express it numerically (i.e., with digits rather than words), don't use commas, and don't include units such as $ or percent signs unless specified otherwise.
If you are asked for a string, don't use articles or abbreviations (e.g. for cities), unless specified otherwise. Don't output any final sentence punctuation such as '.', '!', or '?'.
If you are asked for a comma separated list, apply the above rules depending on whether the elements are numbers or strings.
""".strip()
    )

    # Prepare the prompt
    filename_prompt = ""
    if len(filename) > 0:
        filename_prompt = f"The question is about a file, document or image, which can be accessed by the filename '{filename}' in the current working directory."
    task = f"{prompt}\n\n{filename_prompt}"

    # Run the task
    stream = team.run_stream(task=task.strip())
    await Console(stream)

if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `python/packages/agbench/benchmarks/GAIA/Templates/ParallelAgents/scenario.py`
```
import asyncio
import os
import re
import logging
import yaml
import warnings
import contextvars
import builtins
import shutil
import json
from datetime import datetime
from typing import List, Optional, Dict
from collections import deque
from autogen_agentchat import TRACE_LOGGER_NAME as AGENTCHAT_TRACE_LOGGER_NAME, EVENT_LOGGER_NAME as AGENTCHAT_EVENT_LOGGER_NAME
from autogen_core import TRACE_LOGGER_NAME as CORE_TRACE_LOGGER_NAME, EVENT_LOGGER_NAME as CORE_EVENT_LOGGER_NAME
from autogen_ext.agents.magentic_one import MagenticOneCoderAgent
from autogen_agentchat.teams import MagenticOneGroupChat
from autogen_agentchat.ui import Console
from autogen_core.models import (
    AssistantMessage,
    ChatCompletionClient,
    LLMMessage,
    UserMessage,
)
from autogen_core.logging import LLMCallEvent
from autogen_ext.code_executors.local import LocalCommandLineCodeExecutor
from autogen_agentchat.conditions import TextMentionTermination
from autogen_core.models import ChatCompletionClient
from autogen_ext.agents.web_surfer import MultimodalWebSurfer
from autogen_ext.agents.file_surfer import FileSurfer
from autogen_agentchat.agents import CodeExecutorAgent
from autogen_agentchat.messages import (
    TextMessage,
    AgentEvent,
    ChatMessage,
    HandoffMessage,
    MultiModalMessage,
    StopMessage,
    TextMessage,
    ToolCallExecutionEvent,
    ToolCallRequestEvent,
    ToolCallSummaryMessage,
)
from autogen_core import CancellationToken
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_ext.models.openai._model_info import _MODEL_TOKEN_LIMITS, resolve_model
from autogen_agentchat.utils import content_to_str

# Suppress warnings about the requests.Session() not being closed
warnings.filterwarnings(action="ignore", message="unclosed", category=ResourceWarning)

core_event_logger = logging.getLogger(CORE_EVENT_LOGGER_NAME)
agentchat_event_logger = logging.getLogger(AGENTCHAT_EVENT_LOGGER_NAME)
agentchat_trace_logger = logging.getLogger(AGENTCHAT_TRACE_LOGGER_NAME)

# Create a context variable to hold the current team's log file and the current team id.
current_log_file = contextvars.ContextVar("current_log_file", default=None)
current_team_id = contextvars.ContextVar("current_team_id", default=None)

# Save the original print function and event_logger.info method.
original_print = builtins.print
original_agentchat_event_logger_info = agentchat_event_logger.info
original_core_event_logger_info = core_event_logger.info

class LogHandler(logging.FileHandler):
    def __init__(self, filename: str = "log.jsonl", print_message: bool = True) -> None:
        super().__init__(filename, mode="w")
        self.print_message = print_message

    def emit(self, record: logging.LogRecord) -> None:
        try:
            ts = datetime.fromtimestamp(record.created).isoformat()
            if AGENTCHAT_EVENT_LOGGER_NAME in record.name:
                original_msg = record.msg
                record.msg = json.dumps(
                    {
                        "timestamp": ts,
                        "source": record.msg.source,
                        "message": content_to_str(record.msg.content),
                        "type": record.msg.type,
                    }
                )
                super().emit(record)
                record.msg = original_msg
            elif CORE_EVENT_LOGGER_NAME in record.name:
                if isinstance(record.msg, LLMCallEvent):
                    original_msg = record.msg
                    record.msg = json.dumps(
                        {
                            "timestamp": ts,
                            "prompt_tokens": record.msg.kwargs["prompt_tokens"],
                            "completion_tokens": record.msg.kwargs["completion_tokens"],
                            "type": "LLMCallEvent",
                        }
                    )
                    super().emit(record)
                    record.msg = original_msg
        except Exception:
            print("error in logHandler.emit", flush=True)
            self.handleError(record)

def tee_print(*args, **kwargs):
    # Get the current log file from the context.
    log_file = current_log_file.get()
    # Call the original print (goes to the console).
    original_print(*args, **kwargs)
    # Also write to the log file if one is set.
    if log_file is not None:
        sep = kwargs.get("sep", " ")
        end = kwargs.get("end", "\n")
        message = sep.join(map(str, args)) + end
        log_file.write(message)
        log_file.flush()

def team_specific_agentchat_event_logger_info(msg, *args, **kwargs):
    team_id = current_team_id.get()
    if team_id is not None:
        # Get a logger with a team-specific name.
        team_logger = logging.getLogger(f"{AGENTCHAT_EVENT_LOGGER_NAME}.team{team_id}")
        team_logger.info(msg, *args, **kwargs)
    else:
        original_agentchat_event_logger_info(msg, *args, **kwargs)

def team_specific_core_event_logger_info(msg, *args, **kwargs):
    team_id = current_team_id.get()
    if team_id is not None:
        # Get a logger with a team-specific name.
        team_logger = logging.getLogger(f"{CORE_EVENT_LOGGER_NAME}.team{team_id}")
        team_logger.info(msg, *args, **kwargs)
    else:
        original_core_event_logger_info(msg, *args, **kwargs)

# Monkey-patch the built-in print and event_logger.info methods with our team-specific versions.
builtins.print = tee_print
agentchat_event_logger.info = team_specific_agentchat_event_logger_info
core_event_logger.info = team_specific_core_event_logger_info

async def run_team(team: MagenticOneGroupChat, team_idx: int, task: str, cancellation_token: CancellationToken, logfile):
    token_logfile = current_log_file.set(logfile)
    token_team_id = current_team_id.set(team_idx)
    try:
        task_result = await Console(
            team.run_stream(
                task=task.strip(),
                cancellation_token=cancellation_token
            )
        )
        return team_idx, task_result
    finally:
        current_log_file.reset(token_logfile)
        current_team_id.reset(token_team_id)
        logfile.close()

async def aggregate_final_answer(task: str, client: ChatCompletionClient, team_results, source: str = "Aggregator", cancellation_token: Optional[CancellationToken] = None) -> str:
        """
        team_results: {"team_key": TaskResult}
        team_completion_order: The order in which the teams completed their tasks
        """

        if len(team_results) == 1:
            final_answer = list(team_results.values())[0].messages[-1].content
            aggregator_logger.info(
                f"{source} (Response):\n{final_answer}"
            )
            return final_answer

        assert len(team_results) > 1

        aggregator_messages_to_send = {team_id: deque() for team_id in team_results.keys()} # {team_id: context}

        team_ids = list(team_results.keys())
        current_round = 0
        while (
            not all(len(team_result.messages) == 0 for team_result in team_results.values())
            and ((not resolve_model(client._create_args["model"]) in _MODEL_TOKEN_LIMITS) or client.remaining_tokens([m for messages in aggregator_messages_to_send.values() for m in messages])
            > 2000)
        ):
            team_idx = team_ids[current_round % len(team_ids)]
            if len(team_results[team_idx].messages) > 0:
                m = team_results[team_idx].messages[-1]
                if isinstance(m, ToolCallRequestEvent | ToolCallExecutionEvent):
                    # Ignore tool call messages.
                    pass
                elif isinstance(m, StopMessage | HandoffMessage):
                    aggregator_messages_to_send[team_idx].appendleft(UserMessage(content=m.to_model_text(), source=m.source))
                elif m.source == "MagenticOneOrchestrator":
                    assert isinstance(m, TextMessage | ToolCallSummaryMessage)
                    a
```

### Core Architecture Module: `python/packages/agbench/benchmarks/GAIA/Templates/SelectorGroupChat/scenario.py`
```
import asyncio
import os
import yaml
import warnings
from typing import Sequence
from autogen_ext.agents.magentic_one import MagenticOneCoderAgent
from autogen_agentchat.teams import SelectorGroupChat
from autogen_agentchat.conditions import MaxMessageTermination
from autogen_agentchat.ui import Console
from autogen_agentchat.utils import content_to_str
from autogen_core.models import ModelFamily
from autogen_ext.code_executors.local import LocalCommandLineCodeExecutor
from autogen_agentchat.conditions import TextMentionTermination
from autogen_agentchat.base import TerminationCondition, TerminatedException
from autogen_core.models import ChatCompletionClient
from autogen_ext.agents.web_surfer import MultimodalWebSurfer
from autogen_ext.agents.file_surfer import FileSurfer
from autogen_agentchat.agents import CodeExecutorAgent
from autogen_agentchat.messages import TextMessage, BaseAgentEvent, BaseChatMessage, HandoffMessage, MultiModalMessage, StopMessage
from autogen_core.models import LLMMessage, UserMessage, AssistantMessage

# Suppress warnings about the requests.Session() not being closed
warnings.filterwarnings(action="ignore", message="unclosed", category=ResourceWarning)

async def main() -> None:

    # Load model configuration and create the model client.
    with open("config.yaml", "r") as f:
        config = yaml.safe_load(f)

    orchestrator_client = ChatCompletionClient.load_component(config["orchestrator_client"])
    coder_client = ChatCompletionClient.load_component(config["coder_client"])
    web_surfer_client = ChatCompletionClient.load_component(config["web_surfer_client"])
    file_surfer_client = ChatCompletionClient.load_component(config["file_surfer_client"])
    
    # Read the prompt
    prompt = ""
    with open("prompt.txt", "rt") as fh:
        prompt = fh.read().strip()
    filename = "__FILE_NAME__".strip()

    # Set up the team
    coder = MagenticOneCoderAgent(
        "Assistant",
        model_client = coder_client,
    )

    executor = CodeExecutorAgent("ComputerTerminal", code_executor=LocalCommandLineCodeExecutor())

    file_surfer = FileSurfer(
        name="FileSurfer",
        model_client = file_surfer_client,
    )
                
    web_surfer = MultimodalWebSurfer(
        name="WebSurfer",
        model_client = web_surfer_client,
        downloads_folder=os.getcwd(),
        debug_dir="logs",
        to_save_screenshots=True,
    )

    # Prepare the prompt
    filename_prompt = ""
    if len(filename) > 0:
        filename_prompt = f"The question is about a file, document or image, which can be accessed by the filename '{filename}' in the current working directory."
    task = f"{prompt}\n\n{filename_prompt}"

    # Termination conditions
    max_messages_termination = MaxMessageTermination(max_messages=20)
    llm_termination = LLMTermination(
        prompt=f"""Consider the following task:
{task.strip()}

Does the above conversation suggest that the task has been solved?
If so, reply "TERMINATE", otherwise reply "CONTINUE"
""",
        model_client=orchestrator_client
    )

    termination = max_messages_termination | llm_termination

    # Create the team
    team = SelectorGroupChat(
        [coder, executor, file_surfer, web_surfer],
        model_client=orchestrator_client,
        termination_condition=termination,
    )

    # Run the task
    stream = team.run_stream(task=task.strip())
    result = await Console(stream)

    # Do one more inference to format the results
    final_context: Sequence[LLMMessage] = []
    for message in result.messages:
        if isinstance(message, TextMessage):
            final_context.append(UserMessage(content=message.content, source=message.source))
        elif isinstance(message, MultiModalMessage):
            if orchestrator_client.model_info["vision"]:
                final_context.append(UserMessage(content=message.content, source=message.source))
            else:
                final_context.append(UserMessage(content=content_to_str(message.content), source=message.source))
    final_context.append(UserMessage(
        content=f"""We have completed the following task:
{prompt}

The above messages contain the conversation that took place to complete the task.
Read the above conversation and output a FINAL ANSWER to the question.
To output the final answer, use the following template: FINAL ANSWER: [YOUR FINAL ANSWER]
Your FINAL ANSWER should be a number OR as few words as possible OR a comma separated list of numbers and/or strings.
ADDITIONALLY, your FINAL ANSWER MUST adhere to any formatting instructions specified in the original question (e.g., alphabetization, sequencing, units, rounding, decimal places, etc.)
If you are asked for a number, express it numerically (i.e., with digits rather than words), don't use commas, and don't include units such as $ or percent signs unless specified otherwise.
If you are asked for a string, don't use articles or abbreviations (e.g. for cities), unless specified otherwise. Don't output any final sentence punctuation such as '.', '!', or '?'.
If you are asked for a comma separated list, apply the above rules depending on whether the elements are numbers or strings.
#""".strip(),
        source="user"))

    # Call the model to evaluate
    response = await orchestrator_client.create(final_context)
    print(response.content, flush=True)


class LLMTermination(TerminationCondition):
    """Terminate the conversation if an LLM determines the task is complete.

    Args:
        prompt: The prompt to evaluate in the llm
        model_client: The LLM model_client to use
        termination_phrase: The phrase to look for in the LLM output to trigger termination
    """

    def __init__(self, prompt: str, model_client: ChatCompletionClient, termination_phrase: str = "TERMINATE") -> None:
        self._prompt = prompt
        self._model_client = model_client
        self._termination_phrase = termination_phrase
        self._terminated = False
        self._context: Sequence[LLMMessage] = []

    @property
    def terminated(self) -> bool:
        return self._terminated

    async def __call__(self, messages: Sequence[BaseAgentEvent | BaseChatMessage]) -> StopMessage | None:
        if self._terminated:
            raise TerminatedException("Termination condition has already been reached")

        # Build the context
        for message in messages:
            if isinstance(message, TextMessage):
                self._context.append(UserMessage(content=message.content, source=message.source))
            elif isinstance(message, MultiModalMessage):
                if self._model_client.model_info["vision"]:
                    self._context.append(UserMessage(content=message.content, source=message.source))
                else:
                    self._context.append(UserMessage(content=content_to_str(message.content), source=message.source))

        if len(self._context) == 0:
            return None

        # Call the model to evaluate
        response = await self._model_client.create(self._context + [UserMessage(content=self._prompt, source="user")]) 

        # Check for termination
        if isinstance(message.content, str) and self._termination_phrase in response.content:
            self._terminated = True
            return StopMessage(content=message.content, source="LLMTermination")
        return None

    async def reset(self) -> None:
        self._terminated = False
        self._context = []


if __name__ == "__main__":
    asyncio.run(main())

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

- **Issue #8149** (2026-09-04): **feat: add action_ref parameter to trace_tool_span**
  *Symptoms*: ## Summary  Fixes #7850  Added gen_ai.agent.action_ref attribute support for cross-producer audit correlation. The action_ref is an optional parameter that can be set on tool spans.  ## Changes  - Added GEN_AI_AGENT_ACTION_REF constant - Added optional action_ref parameter to trace_tool_span - Added tests for the new parameter  ## Test plan  - [x] New tests pass - [x] Existing tests still pass
  **Post-Mortem & Fix Analysis**:
  > Superseded by #8187

- **Issue #8148** (2026-09-04): **docs: add CancellationToken propagation guide**
  *Symptoms*: ## Summary  Fixes #8091  Added documentation showing how to propagate CancellationToken through nested tools using cancellation_token parameter and cancellation_token.link_future().  ## Changes  - Added CancellationToken propagation section to migration guide - Shows two methods: using cancellation_token parameter and link_future() - Includes code examples for both approaches  ## Test plan  - [x] Documentation builds correctly
  **Post-Mortem & Fix Analysis**:
  > Superseded by #8184

- **Issue #8146** (2026-09-04): **fix: include tool_choice in ChatCompletionCache cache key**
  *Symptoms*: ## Summary  Fixes #7968  Previously, calls with identical messages/tools but different tool_choice values would incorrectly return cached results. Now tool_choice is included in the cache key computation.  ## Changes  - Updated _check_cache to accept and include tool_choice in cache key - Handles both string and Tool object tool_choice values - Added regression test  ## Test plan  - [x] New test passes - [x] Existing tests still pass
  **Post-Mortem & Fix Analysis**:
  > Superseded by #8185

- **Issue #8143** (2026-09-04): **fix: prevent AssistantAgent deadlock on tool call cancellation**
  *Symptoms*: ## Summary  Fixes #7956 and adds regression test for #8092  Previously, cancelling an in-flight tool call would cause asyncio.gather to raise without executing put_nowait(None), leaving the consumer loop blocking forever on stream.get(). This violated the documented cancellation contract.  ## Changes  - Added return_exceptions=True to asyncio.gather in _execute_tool_calls - Handle exceptions in tool call results by converting them to error FunctionExecutionResult - This ensures put_nowait(None) always executes, allowing the consumer loop to terminate properly even when a tool call raises (including CancelledError) - Added regression test that verifies stream terminates after tool cancellation  ## Test plan  - [x] New regression test passes - [x] Existing tests still pass
  **Post-Mortem & Fix Analysis**:
  > Superseded by #8182

- **Issue #8142** (2026-09-04): **fix: remove orphaned FunctionExecutionResultMessage after truncation**
  *Symptoms*: ## Summary  Fixes #7955  Previously, TokenLimitedChatCompletionContext only checked index 0 for an orphaned FunctionExecutionResultMessage after truncation. When the middle-index pop removed an AssistantMessage while leaving its paired FunctionExecutionResultMessage elsewhere in the list, it was never removed. This caused providers like OpenAI and Anthropic to reject requests with a 400 error.  ## Changes  - Added _remove_orphaned_function_results method that scans the entire message list - Collects all call_ids from AssistantMessage instances - Removes any FunctionExecutionResultMessage that does not have a matching call_id - Added regression test that reproduces the issue from the bug report  ## Test plan  - [x] New test passes, verifying orphaned messages are removed - [x] Existing tests still pass
  **Post-Mortem & Fix Analysis**:
  > Superseded by #8183

- **Issue #8127** (2026-09-04): **docs: PZERO OpenAIChatCompletionClient example**
  *Symptoms*: Fixes #8101  Adds a named PZERO example to the `OpenAIChatCompletionClient` docstring to demonstrate how to use hosted OpenAI-compatible endpoints with custom model info, sitting right below the existing Ollama example.
  **Post-Mortem & Fix Analysis**:
  > Superseded by #8181

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

---

### Incident Patch 3: `13e144e5` (2025-10-04)
**Commit Message**: fix: order by clause (#7051)

Co-authored-by: Victor Dibia <victordibia@microsoft.com>

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

### Incident Patch 4: `29931b37` (2025-09-30)
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
+    mock_q.get_nowait.assert_called()  # type: ignore[rep
```

---

### Incident Patch 5: `f76f92dd` (2025-09-18)
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

### Incident Patch 6: `fb03c1c6` (2025-09-18)
**Commit Message**: Fix: Handle nested objects in array items for JSON schema conversion (#6993)

Co-authored-by: Eric Zhu <ekzhu@users.noreply.github.com>

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
+      
```

---

### Incident Patch 7: `17d3aef9` (2025-09-18)
**Commit Message**: Add security warnings and default to DockerCommandLineCodeExecutor (#7035)

Co-authored-by: Claude <noreply@anthropic.com>

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

---

### Incident Patch 8: `6f67b959` (2025-09-16)
**Commit Message**: Fix finish_reason logic in Azure AI client streaming response (#6963)

Co-authored-by: weizhang3 <weizhang3@microsoft.com>
Co-authored-by: Eric Zhu <ekzhu@users.noreply.github.com>

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

### Incident Patch 9: `c469fc0d` (2025-09-16)
**Commit Message**: Fix OllamaChatCompletionClient load_component() error by adding to WELL_KNOWN_PROVIDERS (#7030)

Co-authored-by: copilot-swe-agent[bot] <198982749+Copilot@users.noreply.github.com>
Co-authored-by: ekzhu <320302+ekzhu@users.noreply.github.com>
Co-authored-by: Eric Zhu <ekzhu@users.noreply.github.com>

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

### Incident Patch 10: `e0e39e47` (2025-09-16)
**Commit Message**: Fix Redis caching always returning False due to unhandled string values (#7022)

Co-authored-by: copilot-swe-agent[bot] <198982749+Copilot@users.noreply.github.com>
Co-authored-by: ekzhu <320302+ekzhu@users.noreply.github.com>
Co-authored-by: Eric Zhu <ekzhu@users.noreply.github.com>

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
+    # Mock 
```

#### Recent Merged Pull Requests:
- **PR #8274** (closed): feat(examples): add Adam Network agent integration example (@snow884)
- **PR #8250** (closed): Fix: drop trailing assistant message when rstrip leaves it empty (@mayuriphad)
- **PR #8149** (closed): feat: add action_ref parameter to trace_tool_span (@wasim-builds)
- **PR #8148** (closed): docs: add CancellationToken propagation guide (@wasim-builds)
- **PR #8146** (closed): fix: include tool_choice in ChatCompletionCache cache key (@wasim-builds)
- **PR #8143** (closed): fix: prevent AssistantAgent deadlock on tool call cancellation (@wasim-builds)
- **PR #8142** (closed): fix: remove orphaned FunctionExecutionResultMessage after truncation (@wasim-builds)
- **PR #8127** (closed): docs: PZERO OpenAIChatCompletionClient example (@wasim-builds)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
