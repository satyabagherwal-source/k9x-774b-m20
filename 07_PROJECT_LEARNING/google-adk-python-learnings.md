# Forensic Learning Record (Deep Inspection): google/adk-python

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-adk-python-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/google/adk-python](https://github.com/google/adk-python))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:40:33.657Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google/adk-python`
- **Description**: An open-source, code-first Python toolkit for building, evaluating, and deploying sophisticated AI agents with flexibility and control.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 21688 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/adk-verify-snippets/scripts/run.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

import argparse
import asyncio
import importlib.util
import os
from pathlib import Path
import sys
import traceback

# Sentinel string used by verify_md.py to locate and split the coverage section
# out of run.py's stdout. Keep in sync with verify_md.py:COV_SECTION_HEADER.
COV_SECTION_HEADER = "📊 Phase 4: Code Coverage Report"

# Structured exit codes — consumed by verify_md.py to classify results without
# fragile string/emoji matching.  Keep in sync with verify_md.py:EXIT_* constants.
EXIT_SUCCESS = 0  # All phases passed
EXIT_LOAD_FAILURE = 1  # Failed to compile / load the snippet
EXIT_RUN_FAILURE = 2  # Loaded OK but the ADK component failed at runtime
EXIT_NO_COMPONENT = 3  # Loaded OK, no runnable ADK component found (load-only)

# --- Optional Coverage Integration ---
try:
  import coverage

  HAS_COVERAGE = True
except ImportError:
  HAS_COVERAGE = False

# --- Imports for ADK Inspection ---
from google.adk.agents.base_agent import BaseAgent
from google.adk.apps import App
from google.adk.runners import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from google.adk.workflow import Workflow
from google.genai import types


def load_target_module(file_path: Path):
  """Dynamically loads a Python file as a module, catching import/compilation/definition errors."""
  # Use the absolute path string as the key to avoid collisions when multiple
  # snippets share the same file stem or when the stem matches an installed package.
  module_name = str(file_path)
  spec = importlib.util.spec_from_file_location(module_name, file_path)
  if spec is None or spec.loader is None:
    raise ImportError(
        f"Could not resolve module spec for file '{file_path.name}'"
    )

  module = importlib.util.module_from_spec(spec)
  sys.modules[module_name] = module

  # Executing the module runs all top-level code, which will catch:
  # - SyntaxError / IndentationError
  # - ImportError (e.g. from google.adk.workflow import build_node)
  # - ValidationError (e.g. instantiating Workflow with invalid edges)
  try:
    spec.loader.exec_module(module)
  except Exception:
    # Remove the partially-initialised module so a broken entry is never
    # left in sys.modules for the lifetime of this process.  This matters
    # when run.py is imported in-process (e.g. from a test harness) rather
    # than invoked as a subprocess.
    sys.modules.pop(module_name, None)
    raise
  return module


def discover_adk_component(module):
  """Scans the module namespace to discover runnable ADK components, prioritizing root components.

  Uses two passes to correctly identify root agents regardless of the order
  in which names appear in ``vars(module)``:

  * Pass 1 — collect every Workflow, Agent, and App in the module namespace.
  * Pass 2 — build the full set of sub-agent IDs from *all* collected agents,
    then filter to find agents that are not sub-agents of any other agent.

  Without the two-pass approach, a root agent whose variable name is seen
  before its sub-agents (e.g. ``root`` defined above ``child`` in the file)
  would be encountered first, before ``child``'s own sub-agents are registered,
  causing incorrect root detection.
  """
  workflows = []
  agents = []
  apps = []

  # Pass 1: collect all candidate components.
  #
  # Use vars(module) rather than inspect.getmembers(module) because
  # getmembers() invokes every attribute getter and silently swallows any
  # Exception raised by broken descriptors or properties — a snippet that
  # defines an Agent behind a faulty @property would simply be missing from
  # the scan with no error or log entry.  vars(module) reads the module's
  # __dict__ directly, which never triggers descriptors and never suppresses
  # exceptions, giving us an accurate view of module-level names.
  for obj in vars(module).values():
    if isinstance(obj, Workflow):
      workflows.append(obj)
    elif isinstance(obj, BaseAgent):
      agents.append(obj)
    elif isinstance(obj, App):
      apps.append(obj)

  # 1. Prefer Workflow
  if workflows:
    return workflows[0], "Workflow"

  # Pass 2: build the complete sub-agent ID set now that all agents are known,
  # then select the root (any agent not listed as a sub-agent of another).
  #
  # Read sub_agents into a local snapshot rather than calling the attribute
  # twice.  Calling it twice is unsafe when sub_agents is a non-idempotent
  # property: the first call (guard) and the second call (iteration) could
  # return different objects, causing id() values to diverge and root
  # detection to silently misfire.
  sub_agent_ids: set[int] = set()
  for agent in agents:
    children = getattr(agent, "sub_agents", None) or []
    for sub in children:
      sub_agent_ids.add(id(sub))

  # 2. Find root Agent (not a sub-agent of any other agent in the module)
  root_agents = [a for a in agents if id(a) not in sub_agent_ids]
  if root_agents:
    return root_agents[0], "Agent"

  # 3. Fall back to App
  if apps:
    return apps[0], "App"

  return None, None


async def run_component(component, component_type, test_input):
  """Unified runner to execute the discovered component."""
  print(f"\n🔍 Discovered ADK {component_type} in target file.")
  print(f"🚀 Running execution test with input: '{test_input}'...\n")

  if component_type == "App":
    runnable_node = getattr(component, "root_agent", None)
    if runnable_node is None:
      raise AttributeError(
          f"App instance has no 'root_agent' attribute. "
          f"Ensure the App is constructed with a root_agent argument."
      )
  else:
    runnable_node = component

  session_service = InMemorySessionService()
  runner = Runner(
      app_name="runnability_test",
      node=runnable_node,
      session_service=session_service,
  )
  session = await session_service.create_session(
      app_name="runnability_test", user_id="tester"
  )

  user_message = types.Content(
      parts=[types.Part(text=str(test_input))], role="user"
  )

  async for event in runner.run_async(
      user_id="tester", session_id=session.id, new_message=user_message
  ):
    print(f"🎬 [Event] Author: {event.author}")
    if event.output:
      print(f"🔹 Output: {event.output}")
    if hasattr(event, "content") and event.content and event.content.parts:
      text = "".join(p.text for p in event.content.parts if p.text)
      if text:
        print(f"📝 Content Output:\n{'-'*40}\n{text}\n{'-'*40}")


def main():
  parser = argparse.ArgumentParser(
      description="Generalized ADK Runnability & Loadability Tester"
  )
  parser.add_argument(
      "file",
      type=str,
      help="Path to the python file containing the agent/workflow to test",
  )
  args = parser.parse_args()

  file_path = Path(args.file).resolve()
  if not file_path.exists():
    print(f"❌ Error: File '{file_path}' does not exist.")
    sys.exit(EXIT_LOAD_FAILURE)

  print(f"🔬 Testing file: {file_path.name}")
  print("=" * 60)

  # Initialize coverage programmatically to track ONLY the target file.
  #
  # Implementation note: snippets are loaded via importlib/exec_module, which
  # CPython's sys.settrace-based tracer instruments correctly *only* if the
  # tracer is active before the module's code object is compiled and executed.
  # Starting coverage here — before load_target_module() — satisfies that
  # requirement. The `include` filter 
```

### Core Architecture Module: `.agents/skills/adk-verify-snippets/scripts/verify_md.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

import argparse
from datetime import datetime
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

SKIP_ANNOTATION = "<!-- verify-snippets: ignore -->"
SNIPPET_TIMEOUT = 120  # seconds; adjust if snippets legitimately need longer

# Must match COV_SECTION_HEADER in run.py exactly — used to split coverage output
# from the main execution log when parsing run.py's stdout.
COV_SECTION_HEADER = "📊 Phase 4: Code Coverage Report"

# Structured exit codes from run.py — kept in sync with run.py:EXIT_* constants.
# Using exit codes (not string/emoji matching) makes classification robust to
# future changes in run.py's human-readable output text.
EXIT_SUCCESS = 0  # All phases passed
EXIT_LOAD_FAILURE = 1  # Failed to compile / load the snippet
EXIT_RUN_FAILURE = 2  # Loaded OK but the ADK component failed at runtime
EXIT_NO_COMPONENT = 3  # Loaded OK, no runnable ADK component found (load-only)


def extract_snippets(md_path: Path):
  """Parses a markdown file and extracts python code blocks along with their preceding headings.

  A code block immediately preceded by the HTML comment
  ``<!-- verify-snippets: ignore -->`` is recorded but marked as skipped so
  that illustrative / pseudo-code examples are excluded from execution.
  """
  with open(md_path, "r", encoding="utf-8") as f:
    content = f.read()

  lines = content.splitlines()
  snippets = []
  current_heading = "Top Level"
  in_code_block = False
  code_lines = []
  skip_next_block = False

  for line in lines:
    # If we are inside a code block, handle it first to preserve comments starting with '#'
    if in_code_block:
      stripped = line.strip()
      # Close only on a bare closing fence (``` with no language specifier).
      # A fenced block of another language (e.g. ```bash) appearing *inside*
      # the Python block will not trigger this branch because it carries a
      # language tag, so it is appended to code_lines as literal content.
      if stripped == "```":
        in_code_block = False
        code_text = "\n".join(code_lines)
        snippets.append({
            "heading": current_heading,
            "code": code_text,
            "skip": skip_next_block,
        })
        skip_next_block = False
      else:
        code_lines.append(line)
      continue

    # If we are outside a code block, check for headings or code block starts
    if line.startswith("#"):
      # Clean up heading markers (e.g., "## Get started" -> "Get started")
      current_heading = line.lstrip("#").strip()
      # A heading between the annotation and the fence cancels the skip.
      skip_next_block = False
      continue

    if line.strip() == SKIP_ANNOTATION:
      skip_next_block = True
      continue

    if line.strip().startswith("```python"):
      in_code_block = True
      code_lines = []
      continue

    # Any other non-empty line (prose, blank-line-separated text, etc.) between
    # the annotation and the fence cancels the skip.
    if line.strip():
      skip_next_block = False

  return snippets


def run_snippet(run_py_path: Path, snippet_path: Path):
  """Executes run.py on the isolated snippet and returns the result."""
  # Run using the same Python interpreter as this script (which will be the venv's python)
  cmd = [sys.executable, str(run_py_path), str(snippet_path)]

  # Ensure GEMINI_API_KEY is preferred if both keys are set in the environment
  env = os.environ.copy()
  if "GOOGLE_API_KEY" in env and "GEMINI_API_KEY" in env:
    env.pop("GOOGLE_API_KEY", None)

  try:
    result = subprocess.run(
        cmd, capture_output=True, text=True, env=env, timeout=SNIPPET_TIMEOUT
    )
    return {
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
    }
  except subprocess.TimeoutExpired:
    return {
        "exit_code": EXIT_RUN_FAILURE,
        "stdout": (
            "❌ Run Failure: Snippet execution timed out after"
            f" {SNIPPET_TIMEOUT} seconds."
        ),
        "stderr": (
            "TimeoutExpired: The snippet process did not complete within the"
            f" {SNIPPET_TIMEOUT}-second limit."
        ),
    }


def extract_error_detail(stdout: str, stderr: str) -> str:
  """Extracts the most relevant error line from run.py's output.

  Searches in order:
  1. Last line in stderr that looks like a Python exception (``<Name>Error:``
     or ``<Name>Exception:``). Scoping to stderr avoids matching runner prose
     in stdout (e.g. "❌ Run Failure: ...") which contains words like "Failure"
     but is not an exception line.
  2. Last line in stdout with the same pattern, as a fallback for runtimes that
     write tracebacks to stdout instead of stderr.
  3. Last line in stderr matching the generic ``<ClassName>: <detail>`` format
     (custom exception classes that don't end in Error/Exception).
  4. Fallback string if nothing matches.
  """
  # Matches standard Python exception class names: ends in 'Error' or 'Exception',
  # followed by a colon and detail text.  Anchored to the start of the stripped line
  # so runner prose ("❌ Run Failure: ...") is not matched.
  _exception_re = re.compile(r"^[A-Za-z]\w*(?:Error|Exception|Warning):\s*.+")

  for source in (stderr, stdout):
    for line in reversed(source.splitlines()):
      if _exception_re.match(line.strip()):
        return f"`{line.strip()}`"

  # Pass 3: generic '<ClassName>: <detail>' in stderr only
  for line in reversed(stderr.splitlines()):
    if re.match(r"^[A-Za-z]\w*:.+", line.strip()):
      return f"`{line.strip()}`"

  return "Failed to compile/load."


def clean_name(name: str):
  """Sanitizes a string to be a safe filename."""
  name = name.lower().replace(" ", "_")
  return re.sub(r"[^a-z0-9_]", "", name)


def md_cell(value: str) -> str:
  """Escapes pipe characters so the value is safe inside a Markdown table cell."""
  return value.replace("|", r"\|")


def safe_fence(content: str, language: str = "") -> str:
  """Returns a Markdown fenced code block that safely wraps *content*.

  Picks the shortest fence (minimum three backticks) that is strictly longer
  than any contiguous run of backticks found inside *content*, so the fence
  cannot be prematurely closed by content that itself contains backtick runs.
  This is the approach recommended by the CommonMark spec.

  Example::

      safe_fence("x = ```foo```", "python")
      # returns:
      # ````python
      # x = ```foo```
      # ````
  """
  # Find the longest run of backticks inside the content
  max_run = max(
      (len(m.group()) for m in re.finditer(r"`+", content)), default=0
  )
  # The outer fence must be strictly longer, and at least 3 characters
  fence_len = max(3, max_run + 1)
  fence = "`" * fence_len
  tag = f"{fence}{language}\n" if language else f"{fence}\n"
  return f"{tag}{content}\n{fence}"


def main():
  parser = argparse.ArgumentParser(description="Markdown Snippet Verifier")
  parser.add_argument(
      "file", type=str, help="Path to the markdown file to verify"
  )
  args = parser.parse_args()

  md_path = Path(args.file).resolve()
  if not md_path.exists():
    print(f"❌ Error: Markdown file '{md_path}' does not exist.")
    sys.exit(1)

  # Locate run.py bundled inside the same scripts folder as verify_md.py (portable mode!)
  run_py_path = Path(__file__).parent / "run.py"
  if not run_py_pat
```

### Core Architecture Module: `contributing/samples/a2a/a2a_auth/__init__.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from . import agent

```

### Core Architecture Module: `contributing/samples/a2a/a2a_auth/agent.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


from google.adk.agents.llm_agent import Agent
from google.adk.agents.remote_a2a_agent import AGENT_CARD_WELL_KNOWN_PATH
from google.adk.agents.remote_a2a_agent import RemoteA2aAgent
from google.adk.integrations.langchain import LangchainTool
from langchain_community.tools.youtube.search import YouTubeSearchTool

# Instantiate the tool
langchain_yt_tool = YouTubeSearchTool()

# Wrap the tool in the LangchainTool class from ADK
adk_yt_tool = LangchainTool(
    tool=langchain_yt_tool,
)

youtube_search_agent = Agent(
    name="youtube_search_agent",
    instruction="""
    Ask customer to provide singer name, and the number of videos to search.
    """,
    description="Help customer to search for a video on Youtube.",
    tools=[adk_yt_tool],
    output_key="youtube_search_output",
)

bigquery_agent = RemoteA2aAgent(
    name="bigquery_agent",
    description="Help customer to manage notion workspace.",
    agent_card=(
        f"http://localhost:8001/a2a/bigquery_agent{AGENT_CARD_WELL_KNOWN_PATH}"
    ),
)

root_agent = Agent(
    name="root_agent",
    instruction="""
      You are a helpful assistant that can help search youtube videos, look up BigQuery datasets and tables.
      You delegate youtube search tasks to the youtube_search_agent.
      You delegate BigQuery tasks to the bigquery_agent.
      Always clarify the results before proceeding.
    """,
    global_instruction=(
        "You are a helpful assistant that can help search youtube videos, look"
        " up BigQuery datasets and tables."
    ),
    sub_agents=[youtube_search_agent, bigquery_agent],
)

```

### Core Architecture Module: `contributing/samples/a2a/a2a_auth/remote_a2a/bigquery_agent/__init__.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from . import agent

```

### Core Architecture Module: `contributing/samples/a2a/a2a_auth/remote_a2a/bigquery_agent/agent.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os

from dotenv import load_dotenv
from google.adk import Agent
from google.adk.tools.google_api_tool import BigQueryToolset

# Load environment variables from .env file
load_dotenv()

# Access the variable
oauth_client_id = os.getenv("OAUTH_CLIENT_ID")
oauth_client_secret = os.getenv("OAUTH_CLIENT_SECRET")
tools_to_expose = [
    "bigquery_datasets_list",
    "bigquery_datasets_get",
    "bigquery_datasets_insert",
    "bigquery_tables_list",
    "bigquery_tables_get",
    "bigquery_tables_insert",
]
bigquery_toolset = BigQueryToolset(
    client_id=oauth_client_id,
    client_secret=oauth_client_secret,
    tool_filter=tools_to_expose,
)

root_agent = Agent(
    name="bigquery_agent",
    instruction="""
      You are a helpful Google BigQuery agent that help to manage users' data on Google BigQuery.
      Use the provided tools to conduct various operations on users' data in Google BigQuery.

      Scenario 1:
      The user wants to query their bigquery datasets
      Use bigquery_datasets_list to query user's datasets

      Scenario 2:
      The user wants to query the details of a specific dataset
      Use bigquery_datasets_get to get a dataset's details

      Scenario 3:
      The user wants to create a new dataset
      Use bigquery_datasets_insert to create a new dataset

      Scenario 4:
      The user wants to query their tables in a specific dataset
      Use bigquery_tables_list to list all tables in a dataset

      Scenario 5:
      The user wants to query the details of a specific table
      Use bigquery_tables_get to get a table's details

      Scenario 6:
      The user wants to insert a new table into a dataset
      Use bigquery_tables_insert to insert a new table into a dataset

      Current user:
      <User>
      {userInfo?}
      </User>
""",
    tools=[bigquery_toolset],
)

```

### Core Architecture Module: `contributing/samples/a2a/a2a_basic/__init__.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from . import agent

```

### Core Architecture Module: `contributing/samples/a2a/a2a_basic/agent.py`
```
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import random

from google.adk.agents.llm_agent import Agent
from google.adk.agents.remote_a2a_agent import AGENT_CARD_WELL_KNOWN_PATH
from google.adk.agents.remote_a2a_agent import RemoteA2aAgent
from google.adk.tools.example_tool import ExampleTool
from google.genai import types


# --- Roll Die Sub-Agent ---
def roll_die(sides: int) -> int:
  """Roll a die and return the rolled result."""
  return random.randint(1, sides)


roll_agent = Agent(
    name="roll_agent",
    description="Handles rolling dice of different sizes.",
    instruction="""
      You are responsible for rolling dice based on the user's request.
      When asked to roll a die, you must call the roll_die tool with the number of sides as an integer.
    """,
    tools=[roll_die],
    generate_content_config=types.GenerateContentConfig(
        safety_settings=[
            types.SafetySetting(  # avoid false alarm about rolling dice.
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.OFF,
            ),
        ]
    ),
)


example_tool = ExampleTool([
    {
        "input": {
            "role": "user",
            "parts": [{"text": "Roll a 6-sided die."}],
        },
        "output": [
            {"role": "model", "parts": [{"text": "I rolled a 4 for you."}]}
        ],
    },
    {
        "input": {
            "role": "user",
            "parts": [{"text": "Is 7 a prime number?"}],
        },
        "output": [{
            "role": "model",
            "parts": [{"text": "Yes, 7 is a prime number."}],
        }],
    },
    {
        "input": {
            "role": "user",
            "parts": [{"text": "Roll a 10-sided die and check if it's prime."}],
        },
        "output": [
            {
                "role": "model",
                "parts": [{"text": "I rolled an 8 for you."}],
            },
            {
                "role": "model",
                "parts": [{"text": "8 is not a prime number."}],
            },
        ],
    },
])

prime_agent = RemoteA2aAgent(
    name="prime_agent",
    description="Agent that handles checking if numbers are prime.",
    agent_card=(
        f"http://localhost:8001/a2a/check_prime_agent{AGENT_CARD_WELL_KNOWN_PATH}"
    ),
)


root_agent = Agent(
    name="root_agent",
    instruction="""
      You are a helpful assistant that can roll dice and check if numbers are prime.
      You delegate rolling dice tasks to the roll_agent and prime checking tasks to the prime_agent.
      Follow these steps:
      1. If the user asks to roll a die, delegate to the roll_agent.
      2. If the user asks to check primes, delegate to the prime_agent.
      3. If the user asks to roll a die and then check if the result is prime, call roll_agent first, then pass the result to prime_agent.
      Always clarify the results before proceeding.
    """,
    global_instruction=(
        "You are DicePrimeBot, ready to roll dice and check prime numbers."
    ),
    sub_agents=[roll_agent, prime_agent],
    tools=[example_tool],
    generate_content_config=types.GenerateContentConfig(
        safety_settings=[
            types.SafetySetting(  # avoid false alarm about rolling dice.
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.OFF,
            ),
        ]
    ),
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7344** (2026-09-29): **feat(live): generalize AudioCacheManager into multimodal CacheManager for live media persistence**
  *Symptoms*: feat(live): generalize AudioCacheManager into multimodal CacheManager for live media persistence  Extend `RunConfig.save_live_blob` to persist input and output `image/*` and `video/*` blobs alongside `audio/*` during live bidirectional streaming sessions:  - **Multimodal `CacheManager` (`google/adk/live/_cache_manager.py`)**:   - Generalize `AudioCacheManager` / `AudioCacheConfig` into `CacheManager` / `CacheConfig`.   - Add `cache_media()`, `cache_blob()`, and `flush_media_caches()` with configurable `max_media_cache_size_bytes` (default `100 MB`) and `max_media_cache_frames` (default `600` frames) and `O(n)` slice-based FIFO eviction when limits are exceeded.   - Persist single-frame batches (`len(media_cache) == 1`) directly using their native `image/*` or `video/*` MIME type (`custom_metadata.type = 'single_media_frame'`) via `_extension_for_mime_type()`, `build_manifest()`, and `summarize_manifest()` so `adk web` renders inline image/video previews immediately.   - Pack multi-frame batches (`len(media_cache) > 1`) via `pack_media_frames()` and `summarize_manifest()` into an uncompressed (`ZIP_STORED`) `.zip` archive (`application/zip`, `custom_metadata.type = 'video_frame_sequence'`) containing sequential `frames/frame_NNNN.<ext>` files and a `metadata.json` manifest.   - Add `load_media_frames()`, `load_media_manifest()`, `load_media_frame()`, and `load_preview_frame()` on `CacheManager` utilizing `unpack_media_frames()`, `read_manifest()`, `extract_frame()`, and `extra

- **Issue #7343** (2026-09-29): **fix(deps): include greenlet for database extra**
  *Symptoms*: ## Summary  - Install SQLAlchemy's `asyncio` extra for the `all`, `db`, and `test` extras. - This keeps `greenlet` available for SQLAlchemy 2.1 async imports used by `DatabaseSessionService`.  Fixes #7341  ## Root cause  SQLAlchemy 2.1 no longer installs `greenlet` as a default dependency. The ADK database extra only requested `sqlalchemy>=2,<3`, so importing the async SQLAlchemy API failed in a clean `google-adk[db]` environment.  ## Testing  - `uv build --wheel --out-dir <temp-dir>` - Built wheel metadata contains `sqlalchemy[asyncio]>=2,<3` for `all`, `db`, and `test`. - Installed the built `google-adk[db]` wheel in an isolated Python 3.13 environment; `greenlet` was installed and `DatabaseSessionService(db_url="sqlite+aiosqlite:///:memory:")` initialized successfully. - `python -m pytest tests/unittests/test_release_dependencies.py -q` — 17 passed.
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/adk-python/pull/7343/checks?check_run_id=109424342428) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.

- **Issue #7340** (2026-09-29): **Update transfer_to_agent_tool.py**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/adk-python/pull/7340/checks?check_run_id=109366653683) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.
  > thanks for the PR. this change drops the comma after agent_names and replaces its type with an undefined name, so the module no longer parses. closing it, but please open a new issue if this is still happening.

- **Issue #7339** (2026-09-29): **Enhance conversation scenarios with example JSON**
  *Symptoms*: Added example JSON structure for starting prompt and conversation plan.  **Please ensure you have read the [contribution guide](https://github.com/google/adk-python/blob/main/CONTRIBUTING.md) before creating a pull request.**  ### Link to Issue or Description of Change  **1. Link to an existing issue (if applicable):**  - Closes: #_issue_number_ - Related: #_issue_number_  **2. Or, if no issue exists, describe the change:**  _If applicable, please follow the issue templates to provide as much detail as possible._  **Problem:** _A clear and concise description of what the problem is._  **Solution:** _A clear and concise description of what you want to happen and why you choose this solution._  ### Testing Plan  _Please describe the tests that you ran to verify your changes. This is required for all PRs that are not small documentation or typo fixes._  **Unit Tests:**  - [ ] I have added or updated unit tests for my change. - [ ] All unit tests pass locally.  _Please include a summary of passed `pytest` results._  **Manual End-to-End (E2E) Tests:**  _Please provide instructions on how to manually test your changes, including any necessary setup or configuration. Please provide logs or screenshots to help reviewers better understand the fix._  ### Checklist  - [ ] I have read the [CONTRIBUTING.md](https://github.com/google/adk-python/blob/main/CONTRIBUTING.md) document. - [ ] I have performed a self-review of my own code. - [ ] I have
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google/adk-python/pull/7339/checks?check_run_id=109320757047) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.
  > thanks for the PR. this pastes JSON into the middle of the field docstrings, and conversation_plan already documents an example, so closing it. please open a new issue if this is still happening.

- **Issue #7320** (2026-09-30): **fix(workflow): isolate and clean up single_turn LlmAgent node_input events**
  *Symptoms*: Fixes #7227  ### Summary When a `Workflow` containing `single_turn` `LlmAgent` nodes is run from a root chat agent's tool (`await tool_context.run_node(workflow, ...)`), `branch` is `None` and `isolation_scope` is `None`. Previously, `prepare_llm_agent_input` appended a synthetic `Event(author='user', message=agent_input)` directly to the shared in-memory `ctx.session.events` list without scoping it to the target node or removing it after the node finished.  During sequential multi-tool turns (`fc-a -> fr-a` followed by `fc-b -> fr-b` in the same user turn), `_rearrange_events_for_async_function_responses_in_history` moved `fr-a` next to `fc-a` and left the unpersisted synthetic `user_event` (including any inline binary/PDF parts) in `result_events`, leaking it verbatim into the root chat agent's LLM request. Similarly, concurrent `single_turn` `LlmAgent` nodes running via `asyncio.gather` on `branch=None` could see each other's synthetic `user_event` while in flight.  ### Why `isolation_scope` Is Not Used for Unscoped `single_turn` Nodes Assigning a synthetic `isolation_scope` to unscoped `single_turn` nodes causes two side effects: 1. `_get_contents` (`_contents.py`) treats any non-None `isolation_scope` as a task-scoped agent and invokes `_build_task_input_user_content`, prepending the root workflow's `user_content` + `_SINGLE_TURN_NUDGE`. 2. During inner tool round-trips (`test_inner_llm_agent_node_input_survives_tool_round_trip`), `NodeRunner._enrich_event` stamps the no
  **Post-Mortem & Fix Analysis**:
  > Thanks so much for testing this branch locally and verifying the edge cases (especially `test_inner_llm_agent_node_input_survives_tool_round_trip`), @nanhe17! Really appreciate the detailed bug report and reproducer in #7227 as well.
  > Happy to help — that edge case seemed worth pinning down before it regressed. Nice work landing the fix!
  > Thank you @abhayjoshi201 for your contribution! 🎉  Your changes have been successfully imported and merged via Copybara in commit 6f30039.  Closing this PR as the changes are now in the main branch.

- **Issue #7318** (2026-09-29): **docs(setup): explain local lockfile needed by tox**
  *Symptoms*: ### Link to Issue or Description of Change  **Problem:** The setup skill says dependencies are pinned in `uv.lock`, but this repository ignores that file. On a fresh checkout, the tox lock runner fails with `Unable to find lockfile at uv.lock` until `uv sync` has run.  **Solution:** Explain that `uv sync` creates a local lockfile and must run before `tox`.  ### Testing Plan  - Confirmed `uv.lock` is untracked and ignored by the repository. - Reproduced the tox lockfile error before `uv sync`; after syncing, tox reached   the pytest suite. - `pre-commit run --files .agents/skills/adk-setup/SKILL.md` passed.  ### Checklist  - [x] Read `CONTRIBUTING.md` and reviewed the change. - [x] Checked the documented sequence against the current tox configuration. 
  **Post-Mortem & Fix Analysis**:
  > Thank you @iarjunganesh for your contribution! 🎉  Your changes have been successfully imported and merged via Copybara in commit 96319fc.  Closing this PR as the changes are now in the main branch.

- **Issue #7304** (2026-09-30): **Release publish workflow no longer requires green checks for the exact commit**
  *Symptoms*: ## Summary  Commit `e143cce15ceaeb6ef86f9af4accf703a9a8c3b0d` removed the "Require green checks on the commit being published" step from `.github/workflows/release-publish.yml`.  The current manual release path validates the `release/v*` naming pattern, checks out the selected ref, builds it, and publishes with `PYPI_TOKEN`, but I could not find an equivalent exact-SHA CI/status requirement before publication.  ## Current flow  ``` workflow_dispatch   -> validate release/v* ref   -> checkout   -> uv build   -> uv publish ```  The removed gate previously queried check-runs for the exact commit and failed when: - no checks had reported, or - any relevant check was not green.  ## Reproduction / verification  This was verified using repository source and public GitHub metadata only:  1. Inspect the diff for `e143cce15ceaeb6ef86f9af4accf703a9a8c3b0d`. 2. Inspect the current `.github/workflows/release-publish.yml`. 3. Confirm the removed exact-SHA green-check validation has no equivalent replacement in the workflow. 4. Check public branch/ruleset metadata for the `release/v*` path. 5. Check `release-artifact-check.yml` and whether it is required for publication.  No release workflow was triggered, no branch was modified, no secret was accessed, and nothing was published to PyPI.  ## Expected behavior  A package release should require a deterministic validation step for the exact commit being published, or an equivalent protected-environment / required-check mechanism.  ## Actual be
  **Post-Mortem & Fix Analysis**:
  > I verified that the release workflow no longer has an equivalent exact-SHA check gate, and the repository guide says to ask before contributing to issues outside good-first/help-wanted. Would the maintainers welcome a focused regression test and a workflow guard for the exact release commit? I will wait for confirmation before changing files or opening a PR.
  > Hello @ITSMERNB,  Thanks for the report. The release pipeline is managed by the core maintainers and changes to it follow our internal release process. We have shared this with the team that owns releases so they can review it.  Since this does not affect how the `google-adk` library works, we are closing this issue.

- **Issue #7303** (2026-09-29): **Upward agent transfer HITL resume can skip a subsequent confirmation gate**
  *Symptoms*: ## Summary  In the pre-fix workflow path, an upward agent transfer that interrupts for HITL input can leave the calling parent recorded as completed without the expected checkpoint. On resume, this can cause a later confirmation-gated step to execute without presenting the second confirmation.  This appears to be fixed by commit `198139ef31f8c51b723b58a7a74d8eb2eb15dc31`; I am filing this primarily for tracking/backport awareness for affected releases.  ## Reproduction  A deterministic test used this flow:  `parent A -> child B -> upward transfer to A -> HITL interrupt -> resume -> privileged successor`  Two consecutive `FunctionTool(require_confirmation=True)` gates are used.  Control path: - turn 2 presents the second confirmation - privileged successor does not run before approval  Affected upward-transfer path: - turn 2 confirmation count: `0` - privileged successor executed: `['PRIVILEGED_ACTION']` - bypass result: `True`  Observed differential:  ``` CONTROL TURN2_CONFIRMATION_COUNT 1 UPWARD TURN2_CONFIRMATION_COUNT 0 UPWARD TURN2_EXECUTED ['PRIVILEGED_ACTION'] UPWARD_BYPASS_CONFIRMED True ```  ## Revisions  - Pre-fix revision tested: `8f1323ae6daf5cc6a8dfa33703cb4a682990af47` - Fix/candidate: `198139ef31f8c51b723b58a7a74d8eb2eb15dc31`  The fixing commit notes the same underlying state problem: after an upward transfer that interrupts, the caller could previously be recorded `COMPLETED` while execution was actually waiting for user input, with no checkpoint emitted.  ## 
  **Post-Mortem & Fix Analysis**:
  > Thanks for filing this for tracking. Could a maintainer mention which release first includes 198139e? Anyone running two sequential require_confirmation gates after an upward transfer will want to know whether to upgrade.  The two-gate repro would also make a good regression test next to the fix.
  > fixed by https://github.com/google/adk-python/commit/198139ef31f8c51b723b58a7a74d8eb2eb15dc31, which first shipped in https://github.com/google/adk-python/releases/tag/v2.10.0. the 2.9.x releases don't have it, so upgrading to v2.10.0 is the way to pick it up. please open a new issue if this is still happening.

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

### Incident Patch 1: `f44d5124` (2026-09-30)
**Commit Message**: fix: load validated MCP toolsets under adk web

Merge https://github.com/google/adk-python/pull/6736

Fixes #6735

PiperOrigin-RevId: 990732970

**File**: `contributing/samples/mcp/tool_mcp_stdio_notion_config/README.md` (modified, +2/-1)
```diff
@@ -45,7 +45,8 @@ Only set this when you trust every agent config the process will load.
 
 ### 5. Run the Agent
 
-Use `adk run` to run the agent and interact with your Notion workspace.
+Use `adk run` or `adk web` to run the agent and interact with your Notion
+workspace. The stdio opt-in above is required for either command.
 
 ## Example Queries
 
```

**File**: `src/google/adk/agents/config_agent_utils.py` (modified, +89/-9)
```diff
@@ -24,6 +24,7 @@
 import typing
 from typing import Any
 from typing import List
+from typing import NoReturn
 from typing import Optional
 from typing import TYPE_CHECKING
 import warnings
@@ -824,20 +825,99 @@ def _set_enforce_yaml_key_denylist(value: bool) -> None:
   _ENFORCE_YAML_KEY_DENYLIST = value
 
 
-def _check_config_for_blocked_keys(node: Any, filename: str) -> None:
-  """Recursively check if the configuration contains any blocked keys."""
+def _validate_mcp_toolset_args(args: Any) -> None:
+  """Validates McpToolset args without resolving a code reference."""
+  from ..tools.mcp_tool.mcp_toolset import McpToolsetConfig
+
+  McpToolsetConfig.model_validate(args)
+
+
+# Entries in this set must be built-in tools whose validator treats the
+# YAML input as data only. The name is matched literally; it is never
+# imported or otherwise resolved from the configuration.
+_MCP_TOOLSET_NAMES = frozenset({
+    "MCPToolset",
+    "McpToolset",
+    "google.adk.tools.MCPToolset",
+    "google.adk.tools.McpToolset",
+    "google.adk.tools.mcp_tool.MCPToolset",
+    "google.adk.tools.mcp_tool.McpToolset",
+    "google.adk.tools.mcp_tool.mcp_toolset.MCPToolset",
+    "google.adk.tools.mcp_tool.mcp_toolset.McpToolset",
+})
+_BUILTIN_LLM_AGENT_NAMES = frozenset({
+    "Agent",
+    "LlmAgent",
+    "google.adk.agents.Agent",
+    "google.adk.agents.LlmAgent",
+    "google.adk.agents.llm_agent.Agent",
+    "google.adk.agents.llm_agent.LlmAgent",
+})
+
+
+def _raise_blocked_key(key: str, filename: str) -> NoReturn:
+  raise ValueError(
+      f"Blocked key {key!r} found in {filename!r}. "
+      f"The '{key}' field is not allowed in agent configurations "
+      "because it can execute arbitrary code."
+  )
+
+
+def _check_node_for_blocked_keys(node: Any, filename: str) -> None:
+  """Recursively checks a non-tool configuration node for blocked keys."""
   if isinstance(node, dict):
     for key, value in node.items():
       if key in _BLOCKED_YAML_KEYS:
-        raise ValueError(
-            f"Blocked key {key!r} found in {filename!r}. "
-            f"The '{key}' field is not allowed in agent configurations "
-            "because it can execute arbitrary code."
-        )
-      _check_config_for_blocked_keys(value, filename)
+        _raise_blocked_key(key, filename)
+      _check_node_for_blocked_keys(value, filename)
   elif isinstance(node, list):
     for item in node:
-      _check_config_for_blocked_keys(item, filename)
+      _check_node_for_blocked_keys(item, filename)
+
+
+def _check_tool_configs_for_blocked_keys(
+    tools: list[Any], filename: str
+) -> None:
+  """Checks tool configs, allowing args only for registered built-ins."""
+  for tool in tools:
+    if not isinstance(tool, dict):
+      _check_node_for_blocked_keys(tool, filename)
+      continue
+
+    tool_name = tool.get("name")
+    is_mcp_toolset = (
+        isinstance(tool_name, str) and tool_name in _MCP_TOOLSET_NAMES
+    )
+    for key, value in tool.items():
+      if key not in _BLOCKED_YAML_KEYS:
+        _check_node_for_blocked_keys(value, filename)
+        continue
+      if not is_mcp_toolset:
+        _raise_blocked_key(key, filename)
+      try:
+        _validate_mcp_toolset_args(value)
+      except (TypeError, ValueError) as e:
+        raise ValueError(
+            f"Invalid {key!r} for safe built-in tool {tool_name!r} "
+            f"in {filename!r}."
+        ) from e
+
+
+def _check_config_for_blocked_keys(node: Any, filename: str) -> None:
+  """Checks blocked keys with a narrow exception for safe built-in tools."""
+  if not isinstance(node, dict):
+    _check_node_for_blocked_keys(node, filename)
+    return
+
+  agent_class = node.get("agent_class", "LlmAgent")
+  is_builtin_llm_agent = (
+      isinstance(agent_class, str) and agent_class in _BUILTIN_LLM_AGENT_NAMES
+  )
+  for key, value in node.items():
+    if key == "tools" and is_builtin_llm_agent and isinstance(value, list):
+      _check_tool_configs_for_blocked_
```

**File**: `tests/unittests/agents/test_agent_config.py` (modified, +127/-0)
```diff
@@ -36,6 +36,7 @@
 from google.adk.agents.parallel_agent import ParallelAgent
 from google.adk.agents.sequential_agent import SequentialAgent
 from google.adk.models.lite_llm import LiteLlm
+from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
 from pydantic import BaseModel
 from pydantic import ValidationError
 import pytest
@@ -815,6 +816,132 @@ def test_from_config_blocks_args_key_when_enforced(tmp_path: Path):
     config_agent_utils._set_enforce_yaml_key_denylist(False)
 
 
+@pytest.fixture
+def enforce_yaml_key_denylist(monkeypatch: pytest.MonkeyPatch):
+  monkeypatch.setattr(config_agent_utils, "_ENFORCE_YAML_KEY_DENYLIST", True)
+
+
+@pytest.mark.parametrize(
+    ("agent_class_line", "tool_name"),
+    [
+        ("", "McpToolset"),
+        ("", "MCPToolset"),
+        ("agent_class: Agent\n", "McpToolset"),
+        ("agent_class: Agent\n", "MCPToolset"),
+        (
+            "agent_class: google.adk.agents.Agent\n",
+            "google.adk.tools.MCPToolset",
+        ),
+    ],
+)
+def test_load_config_from_path_allows_registered_mcp_toolset_args(
+    tmp_path: Path,
+    enforce_yaml_key_denylist: None,
+    agent_class_line: str,
+    tool_name: str,
+):
+  """A registered remote McpToolset loads through the public config API."""
+  config_file = tmp_path / "agent.yaml"
+  agent_class_entry = (
+      f"          {agent_class_line}" if agent_class_line else ""
+  )
+  config_file.write_text(dedent(f"""\
+{agent_class_entry}          name: mcp_agent
+          instruction: Use the MCP tools.
+          tools:
+            - name: {tool_name}
+              args:
+                streamable_http_connection_params:
+                  url: https://example.com/mcp
+          """))
+  agent = config_agent_utils.from_config(str(config_file))
+
+  assert isinstance(agent.tools[0], McpToolset)
+
+
+def test_load_config_from_path_allows_opted_in_stdio_mcp_toolset_args(
+    tmp_path: Path,
+    monkeypatch: pytest.MonkeyPatch,
+    enforce_yaml_key_denylist: None,
+):
+  """The stdio opt-in also permits its nested command args under web."""
+  config_file = tmp_path / "agent.yaml"
+  config_file.write_text(dedent("""\
+          name: mcp_agent
+          instruction: Use the MCP tools.
+          tools:
+            - name: McpToolset
+              args:
+                stdio_connection_params:
+                  server_params:
+                    command: npx
+                    args:
+                      - -y
+                      - example-mcp-server
+          """))
+  monkeypatch.setenv("ADK_ALLOW_CONFIG_STDIO_MCP_SERVERS", "1")
+  agent = config_agent_utils.from_config(str(config_file))
+
+  assert isinstance(agent.tools[0], McpToolset)
+
+
+def test_load_config_from_path_blocks_unregistered_tool_args(
+    tmp_path: Path,
+    enforce_yaml_key_denylist: None,
+):
+  """Tool args remain blocked unless the built-in has a safe validator."""
+  config_file = tmp_path / "agent.yaml"
+  config_file.write_text(dedent("""\
+          name: custom_agent
+          instruction: Use the custom tool.
+          tools:
+            - name: my_package.create_tool
+              args:
+                command: unsafe
+          """))
+  with pytest.raises(ValueError, match="Blocked key 'args' found"):
+    config_agent_utils.from_config(str(config_file))
+
+
+def test_load_config_from_path_rejects_invalid_mcp_toolset_args(
+    tmp_path: Path,
+    enforce_yaml_key_denylist: None,
+):
+  """McpToolset args cannot supply executable callback fields."""
+  config_file = tmp_path / "agent.yaml"
+  config_file.write_text(dedent("""\
+          name: mcp_agent
+          instruction: Use the MCP tools.
+          tools:
+            - name: McpToolset
+              args:
+                streamable_http_connection_params:
+                  url: https://example.com/mcp
+                  httpx_client_factory: os.system
+          """))
+  with pytest.raises(ValueError, match="Invalid 'args' for safe built-in"):
+ 
```

---

### Incident Patch 2: `6f300390` (2026-09-30)
**Commit Message**: fix: isolate and clean up single_turn LlmAgent node_input events

Merge https://github.com/google/adk-python/pull/7320

Fixes #7227

PiperOrigin-RevId: 990632092

**File**: `src/google/adk/flows/llm_flows/context/_contents.py` (modified, +19/-0)
```diff
@@ -126,6 +126,7 @@ async def run_async(
           agent.name,
           preserve_function_call_ids=preserve_function_call_ids,
           isolation_scope=invocation_context.isolation_scope,
+          node_path=invocation_context.node_path,
           is_single_turn=is_single_turn,
           user_content=invocation_context.user_content,
           include_thoughts_from_other_agents=include_thoughts_from_other_agents,
@@ -139,6 +140,7 @@ async def run_async(
           agent.name,
           preserve_function_call_ids=preserve_function_call_ids,
           isolation_scope=invocation_context.isolation_scope,
+          node_path=invocation_context.node_path,
           is_single_turn=is_single_turn,
           user_content=invocation_context.user_content,
           include_thoughts_from_other_agents=False,
@@ -312,6 +314,7 @@ def _should_include_event_in_context(
     event: Event,
     isolation_scope: str | None = None,
     *,
+    node_path: str | None = None,
     include_thoughts: bool = False,
 ) -> bool:
   """Determines if an event should be included in the LLM context.
@@ -330,13 +333,23 @@ def _should_include_event_in_context(
     current_branch: The current branch of the agent.
     event: The event to filter.
     isolation_scope: The agent's isolation_scope. None means unscoped.
+    node_path: The current workflow node path, if executing as a node.
 
   Returns:
     True if the event should be included in the context, False otherwise.
   """
   ev_iso = getattr(event, 'isolation_scope', None)
   if ev_iso != isolation_scope:
     return False
+  ev_node_info = getattr(event, 'node_info', None)
+  ev_node_path = getattr(ev_node_info, 'path', None) if ev_node_info else None
+  if (
+      event.author == 'user'
+      and not event.get_function_responses()
+      and ev_node_path
+      and ev_node_path != (node_path or '')
+  ):
+    return False
   return not (
       _contains_empty_content(event, include_thoughts=include_thoughts)
       or not _is_event_belongs_to_branch(current_branch, event)
@@ -399,6 +412,7 @@ def _get_contents(
     *,
     preserve_function_call_ids: bool = False,
     isolation_scope: str | None = None,
+    node_path: str | None = None,
     is_single_turn: bool = False,
     user_content: types.Content | None = None,
     include_thoughts_from_other_agents: bool = False,
@@ -414,6 +428,7 @@ def _get_contents(
     preserve_function_call_ids: Whether to preserve function call ids.
     isolation_scope: scope tag — when set, restricts events
       to those with matching ``event.isolation_scope`` (or unscoped).
+    node_path: The current workflow node path, if executing as a node.
     user_content: Fallback first user turn for task agents whose
       originating delegation FC is not in session (workflow-node
       task case).
@@ -440,6 +455,7 @@ def _get_contents(
           current_branch,
           e,
           isolation_scope=isolation_scope,
+          node_path=node_path,
           include_thoughts=(
               include_thoughts_from_other_agents
               and _is_other_agent_reply(agent_name, e)
@@ -586,6 +602,7 @@ def _get_current_turn_contents(
     preserve_function_call_ids: bool = False,
     is_single_turn: bool = False,
     isolation_scope: str | None = None,
+    node_path: str | None = None,
     user_content: types.Content | None = None,
     include_thoughts_from_other_agents: bool = False,
 ) -> list[types.Content]:
@@ -637,6 +654,7 @@ def _get_current_turn_contents(
             current_branch,
             event,
             isolation_scope=isolation_scope,
+            node_path=node_path,
             include_thoughts=(
                 include_thoughts_from_other_agents
                 and _is_other_agent_reply(agent_name, event)
@@ -652,6 +670,7 @@ def _get_current_turn_contents(
           agent_name,
           preserve_function_call_ids=preserve_function_call_ids,
           isolation_scope=isolation_scope,
+          node_path=node_path
```

**File**: `src/google/adk/workflow/_llm_agent_wrapper.py` (modified, +18/-7)
```diff
@@ -310,7 +310,7 @@ def prepare_llm_agent_context(agent: LlmAgent, ctx: Context) -> Context:
 
 def prepare_llm_agent_input(
     agent: LlmAgent, ctx: Context, node_input: object
-) -> None:
+) -> Event | None:
   """Prepares the input for running LlmAgent as a node.
 
   For ``single_turn`` mode, append a user-role event with the input
@@ -341,18 +341,22 @@ def prepare_llm_agent_input(
       or agent.mode != 'single_turn'
       or bool(ctx.resume_inputs)
   ):
-    return
+    return None
   agent_input = to_user_content(node_input)
   user_event = Event(author='user', message=agent_input)
   if user_event.content is not None:
     user_event.content.role = 'user'
+  node_path = getattr(ctx, 'node_path', None)
+  if isinstance(node_path, str) and node_path:
+    user_event.node_info.path = node_path
   iso = getattr(ctx, 'isolation_scope', None)
   if iso:
     user_event.isolation_scope = iso
   branch = ctx._invocation_context.branch
   if branch:
     user_event.branch = branch
   ctx.session.events.append(user_event)
+  return user_event
 
 
 def process_llm_agent_output(
@@ -411,7 +415,7 @@ async def run_llm_agent_as_node(
     agent.include_contents = 'none'
 
   agent_ctx = prepare_llm_agent_context(agent, ctx)
-  prepare_llm_agent_input(agent, agent_ctx, node_input)
+  injected_input_event = prepare_llm_agent_input(agent, agent_ctx, node_input)
 
   ic = agent_ctx.get_invocation_context()
   update: dict[str, object] = {'agent': agent}
@@ -435,10 +439,17 @@ async def run_llm_agent_as_node(
 
   if agent.mode == 'single_turn':
     # is_live is always False here (single_turn forces non-live).
-    async with aclosing(agent.run_async(ic)) as run_iter:
-      async for event in run_iter:
-        process_llm_agent_output(agent, ctx, event)
-        yield event
+    try:
+      async with aclosing(agent.run_async(ic)) as run_iter:
+        async for event in run_iter:
+          process_llm_agent_output(agent, ctx, event)
+          yield event
+    finally:
+      if (
+          injected_input_event is not None
+          and injected_input_event in agent_ctx.session.events
+      ):
+        agent_ctx.session.events.remove(injected_input_event)
     return
 
   if agent.mode == 'chat':
```

**File**: `tests/unittests/workflow/test_llm_agent_as_node.py` (modified, +237/-0)
```diff
@@ -38,6 +38,7 @@
 from google.adk.tools.function_tool import FunctionTool
 from google.adk.tools.long_running_tool import LongRunningFunctionTool
 from google.adk.workflow import _llm_agent_wrapper as agent_wrapper
+from google.adk.workflow import node
 from google.adk.workflow import START
 from google.adk.workflow._llm_agent_wrapper import process_llm_agent_output
 from google.adk.workflow._workflow import Workflow
@@ -1905,3 +1906,239 @@ def test_process_llm_agent_output_blank_schema_response_writes_no_state():
 
   assert event.output is None
   assert ctx.actions.state_delta == {}
+
+
+@pytest.mark.asyncio
+async def test_single_turn_node_input_does_not_leak_across_sequential_tools(
+    request: pytest.FixtureRequest,
+):
+  """Single-turn node_input must not leak into root agent across tool turns."""
+  from . import testing_utils
+
+  fake_pdf = b'%PDF-1.4-FAKE-BYTES'
+  worker_model = testing_utils.MockModel.create(
+      responses=['worker-summary-a', 'worker-summary-b']
+  )
+  worker = LlmAgent(
+      name='worker',
+      model=worker_model,
+      instruction='Summarize the attached document.',
+      mode='single_turn',
+  )
+
+  @node(name='run_worker', rerun_on_resume=True)
+  async def run_worker(ctx: Context, node_input: str) -> Any:
+    return await ctx.run_node(
+        worker,
+        node_input=types.Content(
+            role='user',
+            parts=[
+                types.Part.from_text(text=f'INTERNAL-{node_input}'),
+                types.Part.from_bytes(
+                    data=fake_pdf, mime_type='application/pdf'
+                ),
+            ],
+        ),
+    )
+
+  wf = Workflow(
+      name='doc_wf',
+      edges=[(START, run_worker)],
+  )
+
+  async def the_tool(label: str, tool_context: Context) -> dict[str, Any]:
+    out = await tool_context.run_node(
+        wf, node_input=label, run_id=f'run-{label}'
+    )
+    assert not any(
+        ev.author == 'user'
+        and ev.content
+        and any(
+            p.text and 'INTERNAL-' in p.text for p in ev.content.parts or []
+        )
+        for ev in tool_context.session.events
+    )
+    return {'summary': f'done:{label}:{out}'}
+
+  fc_a = types.Part.from_function_call(name='the_tool', args={'label': 'a'})
+  fc_b = types.Part.from_function_call(name='the_tool', args={'label': 'b'})
+  root_model = testing_utils.MockModel.create(
+      responses=[fc_a, fc_b, 'All tools completed.']
+  )
+  root_agent = LlmAgent(
+      name='root_agent',
+      model=root_model,
+      instruction='Call the_tool twice sequentially.',
+      tools=[the_tool],
+  )
+
+  runner = _new_workflow_runner(root_agent, request.function.__name__)
+  await runner.run_async(testing_utils.get_user_content('run both tools'))
+
+  # Worker received both inputs (text + inline PDF bytes).
+  assert len(worker_model.requests) == 2
+  for expected_label, req in zip(['a', 'b'], worker_model.requests):
+    worker_texts = [
+        p.text
+        for c in req.contents
+        for p in c.parts or []
+        if p.text is not None
+    ]
+    worker_blobs = [
+        p.inline_data.data
+        for c in req.contents
+        for p in c.parts or []
+        if p.inline_data is not None
+    ]
+    assert any(f'INTERNAL-{expected_label}' in t for t in worker_texts)
+    assert fake_pdf in worker_blobs
+
+  # Root agent made 3 LLM calls (initial -> after tool a -> after tool b).
+  # None of its requests should contain the worker's text or inline PDF.
+  assert len(root_model.requests) == 3
+  for req in root_model.requests:
+    root_texts = [
+        p.text
+        for c in req.contents
+        for p in c.parts or []
+        if p.text is not None
+    ]
+    root_blobs = [
+        p.inline_data
+        for c in req.contents
+        for p in c.parts or []
+        if p.inline_data is not None
+    ]
+    assert not any('INTERNAL-' in t for t in root_texts)
+    assert not root_blobs
+
+
+@pytest.mark.asyncio
+async def test_parallel_single_turn
```

---

### Incident Patch 3: `fd14aec2` (2026-09-29)
**Commit Message**: fix: follow redirects when downloading skills in GcpSkillRegistry

Merge https://github.com/google/adk-python/pull/6824

PiperOrigin-RevId: 990507320

**File**: `src/google/adk/integrations/skill_registry/gcp_skill_registry.py` (modified, +24/-2)
```diff
@@ -184,9 +184,31 @@ async def _make_request(
 
   def _create_httpx_client(self) -> httpx.AsyncClient:
     """Creates a new httpx.AsyncClient with appropriate SSL/mTLS configuration."""
+    base_host = httpx.URL(self.base_url).host
+
+    async def _drop_cross_origin_goog_headers(request: httpx.Request) -> None:
+      if request.url.host != base_host:
+        for header in list(request.headers):
+          if header.lower().startswith("x-goog-"):
+            del request.headers[header]
+
+    # The Agent Registry media download (alt=media) replies with a 302 to a
+    # short-lived GCS signed URL, so the client must follow redirects; httpx
+    # drops the Authorization header on cross-origin redirects, but retains
+    # custom headers like x-goog-user-project and x-goog-api-client. GCS
+    # requires all x-goog-* headers on a signed request to match its signature,
+    # so we drop them when redirected off the base API host.
+    event_hooks = {"request": [_drop_cross_origin_goog_headers]}
     if self._ssl_context is not None:
-      return httpx.AsyncClient(verify=self._ssl_context)
-    return httpx.AsyncClient()
+      return httpx.AsyncClient(
+          verify=self._ssl_context,
+          follow_redirects=True,
+          event_hooks=event_hooks,
+      )
+    return httpx.AsyncClient(
+        follow_redirects=True,
+        event_hooks=event_hooks,
+    )
 
   async def get_skill(self, *, name: str) -> models.Skill:
     """Fetches a skill from the registry.
```

**File**: `tests/unittests/integrations/skill_registry/test_gcp_skill_registry.py` (modified, +102/-1)
```diff
@@ -17,11 +17,13 @@
 import io
 import logging
 import os
+import ssl
 from unittest import mock
 import zipfile
 
 from google.adk.integrations.skill_registry import gcp_skill_registry
 from google.adk.utils._google_client_headers import merge_tracking_headers
+import httpx
 import pytest
 
 
@@ -588,7 +590,11 @@ async def mock_get(url, *unused_args, **kwargs):
       skill = await registry.get_skill(name="my-skill")
 
       # Verify AsyncClient was instantiated with verify=mock_ssl_context
-      mock_client_class.assert_called_with(verify=mock_ssl_context)
+      mock_client_class.assert_called_with(
+          verify=mock_ssl_context,
+          follow_redirects=True,
+          event_hooks=mock.ANY,
+      )
 
   assert skill.frontmatter.name == "my-skill"
 
@@ -652,3 +658,98 @@ async def test_search_skills_result_passes_frontmatter_validation():
       results[0].model_dump()
   )
   assert validated.name == "cloud.google.com-agent-platform-eval-flywheel"
+
+
+@pytest.mark.asyncio
+async def test_create_httpx_client_follows_redirects():
+  """Clients follow the 302 redirect issued by the media download endpoint."""
+  registry = gcp_skill_registry.GCPSkillRegistry()
+
+  client = registry._create_httpx_client()
+  try:
+    assert client.follow_redirects is True
+    assert client.event_hooks["request"]
+  finally:
+    await client.aclose()
+
+  registry._ssl_context = ssl.create_default_context()
+  client = registry._create_httpx_client()
+  try:
+    assert client.follow_redirects is True
+    assert client.event_hooks["request"]
+  finally:
+    await client.aclose()
+
+
+@pytest.mark.asyncio
+async def test_get_skill_drops_goog_headers_on_redirect():
+  """Verifies that x-goog-* and auth headers are stripped on cross-origin redirects."""
+  fake_zip = _create_fake_zip_bytes()
+
+  def transport_handler(request: httpx.Request) -> httpx.Response:
+    if "skills/my-skill" in str(request.url) and "revisions" not in str(
+        request.url
+    ):
+      return httpx.Response(
+          200,
+          json={
+              "name": (
+                  "projects/test-project/locations/us-central1/skills/my-skill"
+              ),
+              "defaultRevision": (
+                  "projects/test-project/locations/us-central1/skills/my-skill/revisions/rev-123"
+              ),
+          },
+      )
+    if "alt=media" in str(request.url) or (
+        request.url.params and request.url.params.get("alt") == "media"
+    ):
+      if request.url.host == "agentregistry.googleapis.com":
+        return httpx.Response(
+            302,
+            headers={
+                "Location": (
+                    "https://storage.googleapis.com/download/storage/v1/b/bucket/o/skill.zip?signature=123"
+                )
+            },
+        )
+    if request.url.host == "storage.googleapis.com":
+      for header in request.headers:
+        if header.lower().startswith("x-goog-"):
+          return httpx.Response(
+              403,
+              text=f"SignatureDoesNotMatch: Header {header} not signed",
+          )
+        if header.lower() == "authorization":
+          return httpx.Response(
+              403,
+              text="SignatureDoesNotMatch: Authorization not signed",
+          )
+      return httpx.Response(200, content=fake_zip)
+    return httpx.Response(404, text=f"Not found: {request.url}")
+
+  mock_creds = mock.MagicMock()
+  mock_creds.valid = True
+  mock_creds.token = "test-token"
+  mock_creds.quota_project_id = "test-quota"
+
+  registry = gcp_skill_registry.GCPSkillRegistry(
+      project_id="test-project",
+      location="us-central1",
+      credentials=mock_creds,
+  )
+
+  orig_create = registry._create_httpx_client
+
+  def custom_create():
+    client = orig_create()
+    return httpx.AsyncClient(
+        transport=httpx.MockTransport(transport_handler),
+        follow_redirects=client.follow_redirects,
+        event_hooks=client.event_hooks,
+    )
+
+  registry._create
```

---

### Incident Patch 4: `4d241bff` (2026-09-29)
**Commit Message**: fix: only apply --avatar_config to live sessions requesting video

The server-wide avatar configuration added to `adk web` and
`adk api_server` was attached to every /run_live session, including the
default audio-only ones. Avatars are rendered as video, so only set
`RunConfig.avatar_config` when the client requests the VIDEO modality, and
say so in the `--avatar_config` help text.

Also adds a test for the unreadable avatar configuration file path.

Co-authored-by: Liang Wu <wuliang@google.com>
PiperOrigin-RevId: 990498163

**File**: `src/google/adk/cli/api_server.py` (modified, +5/-1)
```diff
@@ -2171,7 +2171,11 @@ async def forward_events():
             ),
             save_live_blob=save_live_blob,
             explicit_vad_signal=explicit_vad_signal,
-            avatar_config=self.avatar_config,
+            # Avatars are rendered as video, so only apply the server-wide
+            # avatar config to sessions that request VIDEO output.
+            avatar_config=(
+                self.avatar_config if "VIDEO" in modalities else None
+            ),
         )
         async with Aclosing(
             runner.run_live(
```

**File**: `src/google/adk/cli/cli_tools_click.py` (modified, +3/-1)
```diff
@@ -2086,7 +2086,9 @@ def decorator(func):
         callback=_parse_avatar_config,
         help=(
             "Optional. AvatarConfig as an inline JSON object or a path to a"
-            " JSON file. Applied to live sessions."
+            " JSON file. Applied only to /run_live sessions whose client"
+            " requests video output (modalities=VIDEO); other live sessions"
+            " ignore it."
         ),
         default=None,
     )
```

**File**: `src/google/adk/cli/fast_api.py` (modified, +2/-1)
```diff
@@ -195,7 +195,8 @@ def get_fast_api_app(
     gemini_enterprise_app_name: The Gemini Enterprise app name to use for the
       agent.
     express_mode: Whether to enable express mode.
-    avatar_config: Avatar configuration to apply to live agent runs.
+    avatar_config: Avatar configuration to apply to live agent runs that
+      request VIDEO output.
 
   Returns:
     The configured FastAPI application instance.
```

**File**: `tests/unittests/cli/test_adk_web_server_run_live.py` (modified, +70/-2)
```diff
@@ -124,8 +124,76 @@ async def _get_runner_async(_self, _app_name: str):
   assert run_config.session_resumption.transparent is True
   assert run_config.save_live_blob is True
   assert run_config.explicit_vad_signal is True
-  assert run_config.avatar_config is not None
-  assert run_config.avatar_config.avatar_name == "Kai"
+  # No VIDEO modality was requested, so the server avatar config is skipped.
+  assert run_config.avatar_config is None
+
+
+@pytest.mark.parametrize(
+    ("modalities_query", "expect_avatar"),
+    [
+        ("&modalities=VIDEO", True),
+        ("&modalities=AUDIO&modalities=VIDEO", True),
+        ("&modalities=AUDIO", False),
+        ("&modalities=TEXT", False),
+        ("", False),
+    ],
+)
+def test_run_live_applies_avatar_config_only_for_video(
+    modalities_query: str, expect_avatar: bool
+):
+  """The server avatar config is sent only when VIDEO output is requested."""
+  session_service = InMemorySessionService()
+  asyncio.run(
+      session_service.create_session(
+          app_name="test_app",
+          user_id="user",
+          session_id="session",
+          state={},
+      )
+  )
+
+  runner = _CapturingRunner()
+  adk_web_server = AdkWebServer(
+      agent_loader=_DummyAgentLoader(),
+      session_service=session_service,
+      memory_service=types.SimpleNamespace(),
+      artifact_service=types.SimpleNamespace(),
+      credential_service=types.SimpleNamespace(),
+      eval_sets_manager=types.SimpleNamespace(),
+      eval_set_results_manager=types.SimpleNamespace(),
+      agents_dir=".",
+      avatar_config=genai_types.AvatarConfig(avatar_name="Kai"),
+  )
+
+  async def _get_runner_async(_self, _app_name: str):
+    return runner
+
+  adk_web_server.get_runner_async = _get_runner_async.__get__(adk_web_server)  # pytype: disable=attribute-error
+
+  fast_api_app = adk_web_server.get_fast_api_app(
+      setup_observer=lambda _observer, _server: None,
+      tear_down_observer=lambda _observer, _server: None,
+  )
+
+  client = TestClient(fast_api_app)
+  url = (
+      "/run_live"
+      "?app_name=test_app"
+      "&user_id=user"
+      "&session_id=session"
+      f"{modalities_query}"
+  )
+
+  with client.websocket_connect(url) as ws:
+    _ = ws.receive_text()
+
+  run_config = runner.captured_run_config
+  assert run_config is not None
+  if expect_avatar:
+    assert run_config.avatar_config is not None
+    assert run_config.avatar_config.avatar_name == "Kai"
+  else:
+    assert run_config.avatar_config is None
 
 
 @pytest.mark.parametrize(
```

**File**: `tests/unittests/cli/utils/test_cli_tools_click.py` (modified, +14/-0)
```diff
@@ -2835,6 +2835,20 @@ def test_fast_api_common_options_rejects_invalid_avatar_config() -> None:
   assert "valid AvatarConfig JSON object" in result.output
 
 
+def test_fast_api_common_options_rejects_missing_avatar_config_file(
+    tmp_path: Path,
+) -> None:
+  """A non-JSON value that is not a readable file is a usage error."""
+  command, _ = _fast_api_command()
+  missing_path = tmp_path / "missing_avatar.json"
+
+  result = CliRunner().invoke(command, ["--avatar_config", str(missing_path)])
+
+  assert result.exit_code == 2
+  assert "could not read avatar configuration file" in result.output
+  assert "missing_avatar.json" in result.output
+
+
 # adk test
 @pytest.fixture
 def fake_pytest_run(monkeypatch: pytest.MonkeyPatch):
```

---

### Incident Patch 5: `86329806` (2026-09-29)
**Commit Message**: fix: detect a dead MCP session whose transport sits behind a dispatcher

MCP SDK 2.x moved the transport off the client session and behind a dispatcher, so ADK's liveness check read attributes that no longer exist and a pooled session whose server had died looked healthy forever, failing every later call. A session with no streams of its own is now checked through its dispatcher's closed flag, which restores the existing reconnect path on both SDK majors.

Co-authored-by: George Weale <gweale@google.com>
PiperOrigin-RevId: 990472674

**File**: `src/google/adk/tools/mcp_tool/mcp_session_manager.py` (modified, +22/-7)
```diff
@@ -1006,15 +1006,20 @@ def _merge_headers(
   def _is_session_disconnected(self, session: ClientSession) -> bool:
     """Checks if a session is disconnected or closed.
 
-    Reads two attributes ADK does not own: the SDK holds the transport streams
-    on the session privately, and each stream reports its own closed flag. A
-    session that lacks either one reads as connected rather than raising,
-    because a release is free to restructure both away and this probe is not
-    the only thing standing between a dead session and a caller.
+    Reads attributes ADK does not own, and where they hang moved between SDK
+    majors. On 1.x the session holds the transport streams and each stream
+    reports its own closed flag. On 2.x the transport moved behind a
+    dispatcher, which reports one closed flag of its own and need not hold
+    streams at all, so a session holding no streams is read there instead. A
+    session offering neither reads as connected rather than raising, because
+    a release is free to restructure them away and this probe is not the only
+    thing standing between a dead session and a caller.
 
     `create_session` pairs this with `SessionContext._is_task_alive`, which
-    ADK owns and which catches strictly more: a crashed transport can leave
-    the streams open while the task behind them is already dead. That pairing
+    ADK owns. Neither check subsumes the other: a crashed transport can
+    leave the streams open while the task behind them is already dead, and a
+    transport that closes under a live session leaves that task parked on
+    its close event, where only these flags report the death. That pairing
     runs under `_MCP_GRACEFUL_ERROR_HANDLING`, which is on by default. The
     kill switch drops it and leaves this probe on its own.
 
@@ -1027,6 +1032,16 @@ def _is_session_disconnected(self, session: ClientSession) -> bool:
     Returns:
         True if the session is known to be disconnected, False otherwise.
     """
+    if not hasattr(session, '_read_stream'):
+      dispatcher = getattr(session, '_dispatcher', None)
+      if not hasattr(dispatcher, '_closed'):
+        logger.debug(
+            'MCP session %s offers no closed flag to read, on itself or on a'
+            ' dispatcher; reading it as connected.',
+            type(session).__name__,
+        )
+        return False
+      return bool(getattr(dispatcher, '_closed', False))
     read_stream = getattr(session, '_read_stream', None)
     write_stream = getattr(session, '_write_stream', None)
     return bool(
```

**File**: `tests/unittests/tools/mcp_tool/test_mcp_session_manager.py` (modified, +82/-3)
```diff
@@ -25,7 +25,9 @@
 from unittest.mock import patch
 import urllib.parse
 
+import anyio
 from google.adk.dependencies import _httpx as httpx
+from google.adk.dependencies._mcp import ClientSession
 from google.adk.dependencies._mcp import IS_MCP_SDK_V2
 from google.adk.dependencies._mcp import McpError
 from google.adk.features import FeatureName
@@ -466,13 +468,14 @@ def test_is_session_disconnected_write_stream_closed(self):
     session._write_stream._closed = True
     assert manager._is_session_disconnected(session)
 
-  def test_is_session_disconnected_without_streams(self):
+  def test_is_session_disconnected_without_streams(self, caplog):
     """A session that holds no streams reads as connected, and does not raise.
 
     Both attributes are private to the SDK. A release is free to move the
     streams off `ClientSession`, and this must degrade to the
     `SessionContext` task check rather than take down every tool call with an
-    `AttributeError`.
+    `AttributeError`. It logs on the way, so the next SDK bump leaving this
+    probe nothing to read shows up instead of going quiet.
 
     The stand-in is a bare class on purpose: a `Mock` would answer to
     `_read_stream` and pass this vacuously.
@@ -482,7 +485,12 @@ class SessionWithoutStreams:
       pass
 
     manager = MCPSessionManager(self.mock_stdio_connection_params)
-    assert not manager._is_session_disconnected(SessionWithoutStreams())
+    with caplog.at_level(logging.DEBUG):
+      assert not manager._is_session_disconnected(SessionWithoutStreams())
+    assert any(
+        "SessionWithoutStreams" in record.getMessage()
+        for record in caplog.records
+    )
 
   def test_is_session_disconnected_with_streams_that_have_no_flag(self):
     """A stream that stops reporting a closed flag reads as connected too."""
@@ -499,6 +507,77 @@ def __init__(self):
     manager = MCPSessionManager(self.mock_stdio_connection_params)
     assert not manager._is_session_disconnected(SessionWithBareStreams())
 
+  def test_is_session_disconnected_reads_a_dispatcher_closed_flag(self):
+    """A session whose transport sits behind a dispatcher is still probed.
+
+    The SDK moved the transport off `ClientSession` and behind a dispatcher in
+    its 2.x line. Looking only at the session reads a dead transport as live
+    and leaves the pooled session wedged for every later call. The dispatcher
+    need not hold streams at all, so its own flag is what gets read.
+    """
+
+    class Dispatcher:
+
+      def __init__(self):
+        self._closed = False
+
+    class SessionWithDispatcher:
+
+      def __init__(self):
+        self._dispatcher = Dispatcher()
+
+    manager = MCPSessionManager(self.mock_stdio_connection_params)
+
+    session = SessionWithDispatcher()
+    assert not manager._is_session_disconnected(session)
+
+    session._dispatcher._closed = True
+    assert manager._is_session_disconnected(session)
+
+  def test_is_session_disconnected_prefers_the_session_over_a_dispatcher(self):
+    """A session holding its own streams is read there, dispatcher or not."""
+
+    class Stream:
+
+      def __init__(self):
+        self._closed = False
+
+    class Dispatcher:
+
+      def __init__(self):
+        self._closed = True
+
+    class SessionWithBoth:
+
+      def __init__(self):
+        self._read_stream = Stream()
+        self._write_stream = Stream()
+        self._dispatcher = Dispatcher()
+
+    manager = MCPSessionManager(self.mock_stdio_connection_params)
+    assert not manager._is_session_disconnected(SessionWithBoth())
+
+  def test_is_session_disconnected_reads_a_real_client_session(self):
+    """The probe finds its flag on a real session, not only on a stand-in.
+
+    The classes above are written here, so they prove the branching and not
+    the layout. This one builds the installed SDK's own `ClientSession` and
+    fails if the attribute the probe reads is not where it looks.
+    """
+    write_stream, read_stream = anyio.cr
```

---

### Incident Patch 6: `fd2ca877` (2026-09-29)
**Commit Message**: fix(eval): skip content-less events when mapping Vertex multi-turn turns

Invocations now keep the final event with its content removed so the efficiency metrics can read its token usage, and the Vertex multi-turn facade sent that event as an empty agent message in every turn. Skips intermediate events without content when mapping a turn.

Co-authored-by: George Weale <gweale@google.com>
PiperOrigin-RevId: 990461145

**File**: `src/google/adk/evaluation/vertex_ai_eval_facade.py` (modified, +2/-0)
```diff
@@ -325,6 +325,8 @@ def _map_invocation_turn(
 
     if isinstance(invocation.intermediate_data, InvocationEvents):
       for invocation_event in invocation.intermediate_data.invocation_events:
+        if invocation_event.content is None:
+          continue
         agent_events.append(
             _MultiTurnVertexiAiEvalFacade._map_inovcation_event_to_agent_event(
                 invocation_event
```

**File**: `tests/unittests/evaluation/test_vertex_ai_eval_facade.py` (modified, +16/-0)
```diff
@@ -454,6 +454,22 @@ def test_map_invocation_turn(self):
     assert conversation_turn.events[2].author == "agent"
     assert conversation_turn.events[2].content.parts[0].text == "final response"
 
+  def test_map_invocation_turn_skips_events_without_content(self):
+    invocation = Invocation(
+        invocation_id="inv1",
+        user_content=genai_types.Content(parts=[genai_types.Part(text="hi")]),
+        intermediate_data=InvocationEvents(
+            invocation_events=[InvocationEvent(author="agent1", content=None)]
+        ),
+        final_response=genai_types.Content(
+            parts=[genai_types.Part(text="hello")]
+        ),
+    )
+    conversation_turn = _MultiTurnVertexiAiEvalFacade._map_invocation_turn(
+        0, invocation
+    )
+    assert [e.author for e in conversation_turn.events] == ["user", "agent"]
+
   def test_get_turns(self):
     invocations = [
         Invocation(
```

---

### Incident Patch 7: `b4c5272c` (2026-09-29)
**Commit Message**: fix(tools): surface NodeTool failures to on_tool_error and return dict validation errors

NodeTool swallowed every exception raised while running its node and
returned a plain string, which the flow wrapped as {'result': '<string>'}.
As a result:
- on_tool_error callbacks (agent and plugin) never saw node failures, unlike
  every other BaseTool, and the original exception was lost behind the
  generic "Dynamic node <name> failed" wrapper.
- Input validation errors reached the model as {'result': ...} instead of the
  {'error': ...} shape FunctionTool uses for argument validation errors.

This change aligns NodeTool with FunctionTool:
- Input schema validation errors return {'error': ...} with the same wording
  as FunctionTool, so the model can correct its arguments and retry.
- When the node fails, the node's original exception is re-raised (chained
  from DynamicNodeFailError). The tool pipeline then runs on_tool_error
  callbacks with the real cause; if none handles it, the error propagates,
  as it does for FunctionTool. Node-level retry_config still applies first,
  inside run_node.

Behavior change: an agent using a node as a tool without an on_tool_error
callback now fails t

**File**: `src/google/adk/tools/_node_tool.py` (modified, +31/-27)
```diff
@@ -17,11 +17,13 @@
 from typing import Any
 
 from google.genai import types
+from pydantic import ValidationError
 from typing_extensions import override
 
 from ..utils._schema_utils import schema_to_json_schema
 from ..workflow._base_node import BaseNode
-from ..workflow._errors import NodeInterruptedError
+from ..workflow._errors import DynamicNodeFailError
+from ..workflow._errors import WorkflowDataError
 from .base_tool import BaseTool
 from .tool_context import ToolContext
 
@@ -131,27 +133,29 @@ async def run_async(
       args: dict[str, Any],
       tool_context: ToolContext,
   ) -> Any:
-    import inspect
-
-    from pydantic import BaseModel
-
     input_schema = getattr(self.node, 'input_schema', None)
-    node_input: Any
-    if inspect.isclass(input_schema) and issubclass(input_schema, BaseModel):
-      try:
-        node_input = input_schema.model_validate(args)
-      except Exception as e:
-        return f'Error validating input for node: {e}'
+    schema = (
+        schema_to_json_schema(input_schema)
+        if input_schema is not None
+        else None
+    )
+    if isinstance(schema, dict) and schema.get('type') != 'object':
+      node_input = args.get('request')
     else:
-      schema = (
-          schema_to_json_schema(input_schema)
-          if input_schema is not None
-          else None
-      )
-      if isinstance(schema, dict) and schema.get('type') != 'object':
-        node_input = args.get('request')
-      else:
-        node_input = args
+      node_input = args
+
+    try:
+      node_input = self.node._validate_input_data(node_input)
+    except (ValidationError, WorkflowDataError) as e:
+      # Same shape as FunctionTool's argument validation errors, so the
+      # model can correct its arguments and retry.
+      return {
+          'error': (
+              f'Invoking `{self.name}()` failed due to argument validation'
+              f' errors:\n{e}\nYou could retry calling this tool with'
+              ' corrected argument types.'
+          )
+      }
 
     fc_id = tool_context.function_call_id
     base_branch = tool_context.branch
@@ -166,10 +170,10 @@ async def run_async(
           use_sub_branch=False,
           raise_on_wait=True,
       )
-      if res is None:
-        return {'result': None}
-      return res
-    except NodeInterruptedError:
-      raise
-    except Exception as e:
-      return f'Error running node {self.name}: {e}'
+    except DynamicNodeFailError as e:
+      # Surface the node's own error, as a FunctionTool would, so the tool
+      # pipeline runs on_tool_error callbacks with the real cause.
+      raise e.error from e
+    if res is None:
+      return {'result': None}
+    return res
```

**File**: `src/google/adk/workflow/_function_node.py` (modified, +67/-0)
```diff
@@ -338,6 +338,24 @@ def _bind_parameters(self, ctx: Context, node_input: Any) -> dict[str, Any]:
         except (TypeError, KeyError):
           pass
 
+      if (
+          not has_param
+          and input_bound
+          and param_name == "node_input"
+          and self.input_schema is not None
+          and not isinstance(self.input_schema, (dict, types.Schema))
+          and param_name in self._type_hints
+      ):
+        try:
+          value = self._coerce_param(
+              param_name,
+              node_input,
+              self._type_hints[param_name],
+          )
+          has_param = True
+        except Exception:
+          pass
+
       if has_param:
         if param_name in self._type_hints:
           value = self._coerce_param(
@@ -437,6 +455,55 @@ def _coerce_param(
       adapter = TypeAdapter(annotated_type)
     return adapter.validate_python(value)
 
+  @override
+  def _validate_input_data(self, data: Any) -> Any:
+    """Validates input data for FunctionNode."""
+    if self.input_schema is not None and not isinstance(
+        self.input_schema, (dict, types.Schema)
+    ):
+      return super()._validate_input_data(data)
+
+    if self.parameter_binding == "node_input":
+      source: Any = data if isinstance(data, (dict, BaseModel)) else {}
+      validated: dict[str, Any] = {}
+      for param_name, param in self._sig.parameters.items():
+        if param_name == self._context_param_name:
+          continue
+
+        has_param = False
+        value = None
+        if isinstance(source, BaseModel):
+          if hasattr(source, param_name):
+            has_param = True
+            value = getattr(source, param_name)
+        else:
+          try:
+            if param_name in source:
+              has_param = True
+              value = source[param_name]
+          except (TypeError, KeyError):
+            pass
+
+        if has_param:
+          if param_name in self._type_hints:
+            value = self._coerce_param(
+                param_name,
+                value,
+                self._type_hints[param_name],
+            )
+          validated[param_name] = value
+        elif param.default is not inspect.Parameter.empty:
+          validated[param_name] = param.default
+        else:
+          raise WorkflowDataError(
+              f'Missing value for parameter "{param_name}" of function'
+              f' "{self.name}". It was not found in node_input and has no'
+              " default value."
+          )
+      return validated
+
+    return super()._validate_input_data(data)
+
   @override
   def model_copy(
       self, *, update: Mapping[str, Any] | None = None, deep: bool = False
```

**File**: `tests/unittests/agents/test_context.py` (modified, +2/-0)
```diff
@@ -788,6 +788,8 @@ async def test_tool_context_from_node_ic_nests_agent_tool_and_node_tool_children
     mock_copy.branch = None
     mock_copy.invocation_id = "inv-1"
     mock_copy.session = mock_invocation_context.session
+    mock_copy._enqueue_event = AsyncMock()
+    mock_copy.model_copy.return_value = mock_copy
     mock_invocation_context.model_copy.return_value = mock_copy
 
     node_ic = caller_ctx.get_invocation_context()
```

**File**: `tests/unittests/workflow/test_node_tool.py` (modified, +241/-0)
```diff
@@ -1585,3 +1585,244 @@ def add(a: int, b: int) -> Any:
       if part.text
   ]
   assert texts == ['done']
+
+
+def _function_responses(events: list[Event]) -> list[Any]:
+  return [
+      part.function_response.response
+      for event in events
+      if event.content and event.content.parts
+      for part in event.content.parts
+      if part.function_response
+  ]
+
+
+class _TypedInput(BaseModel):
+  x: int
+
+
+@pytest.mark.asyncio
+async def test_node_tool_validation_error_returns_error_dict(
+    request: pytest.FixtureRequest,
+):
+  """Invalid LLM args yield an {'error': ...} response, like FunctionTool."""
+
+  def typed(node_input: _TypedInput) -> int:
+    return node_input.x
+
+  typed_node = FunctionNode(func=typed)
+  typed_node.input_schema = _TypedInput
+  agent = LlmAgent(
+      name='agent',
+      model=testing_utils.MockModel.create(
+          responses=[
+              types.Part.from_function_call(name='typed', args={'x': 'abc'}),
+              types.Part.from_text(text='done'),
+          ]
+      ),
+      tools=[typed_node],
+  )
+  runner = testing_utils.InMemoryRunner(
+      app=App(name=request.function.__name__, root_agent=agent)
+  )
+
+  events = await runner.run_async(testing_utils.get_user_content('go'))
+
+  responses = _function_responses(events)
+  assert len(responses) == 1
+  assert set(responses[0]) == {'error'}
+  assert 'argument validation errors' in responses[0]['error']
+
+
+@pytest.mark.asyncio
+async def test_node_tool_function_node_validation_error_returns_error_dict(
+    request: pytest.FixtureRequest,
+):
+  """FunctionNode tool returns {'error': ...} when arguments fail validation."""
+
+  def calculate(x: int) -> int:
+    return x
+
+  calc_node = FunctionNode(func=calculate)
+  agent = LlmAgent(
+      name='agent',
+      model=testing_utils.MockModel.create(
+          responses=[
+              types.Part.from_function_call(
+                  name='calculate', args={'x': 'abc'}
+              ),
+              types.Part.from_text(text='done'),
+          ]
+      ),
+      tools=[calc_node],
+  )
+  runner = testing_utils.InMemoryRunner(
+      app=App(name=request.function.__name__, root_agent=agent)
+  )
+
+  events = await runner.run_async(testing_utils.get_user_content('go'))
+
+  responses = _function_responses(events)
+  assert len(responses) == 1
+  assert set(responses[0]) == {'error'}
+  assert 'argument validation errors' in responses[0]['error']
+
+
+@pytest.mark.asyncio
+async def test_node_tool_failure_reaches_on_tool_error_callback(
+    request: pytest.FixtureRequest,
+):
+  """A failing node surfaces its original error to on_tool_error callbacks."""
+  seen_errors: list[Exception] = []
+
+  def boom(x: int) -> int:
+    raise ValueError(f'kaboom {x}')
+
+  def on_tool_error(tool, args, tool_context, error):
+    seen_errors.append(error)
+    return {'handled': True}
+
+  agent = LlmAgent(
+      name='agent',
+      model=testing_utils.MockModel.create(
+          responses=[
+              types.Part.from_function_call(name='boom', args={'x': 1}),
+              types.Part.from_text(text='done'),
+          ]
+      ),
+      tools=[FunctionNode(func=boom)],
+      on_tool_error_callback=on_tool_error,
+  )
+  runner = testing_utils.InMemoryRunner(
+      app=App(name=request.function.__name__, root_agent=agent)
+  )
+
+  events = await runner.run_async(testing_utils.get_user_content('go'))
+
+  assert len(seen_errors) == 1
+  assert isinstance(seen_errors[0], ValueError)
+  assert str(seen_errors[0]) == 'kaboom 1'
+  assert _function_responses(events) == [{'handled': True}]
+
+
+@pytest.mark.asyncio
+async def test_node_tool_unhandled_failure_propagates(
+    request: pytest.FixtureRequest,
+):
+  """Without on_tool_error, a node failure propagates like a FunctionTool's."""
+
+  def boom(x: int) -> int:
+    raise ValueError(f'kaboom {x}')
+
+  agent = LlmAgent(
+      name='agent',
+      model=testing_utils.MockModel.create(
+          r
```

---

### Incident Patch 8: `7298e09a` (2026-09-29)
**Commit Message**: fix: replay a parallel tool call that never ran when a sibling answered

When a resumed model turn had parallel calls and only some had a response, the resume decision treated one answer as covering the whole turn, so it continued to the model and the call that never ran was dropped. The decision now replays just the calls with no response, and only when the agent has written nothing since the call, so answered calls do not run a second time.

Close #7108

Co-authored-by: George Weale <gweale@google.com>
PiperOrigin-RevId: 990408003

**File**: `src/google/adk/flows/llm_flows/core/_resume.py` (modified, +48/-2)
```diff
@@ -49,7 +49,11 @@ class ResumeAction(enum.Enum):
   """A tool call is still unanswered; stop without emitting anything."""
 
   REPLAY_CALLS = 'replay_calls'
-  """A tool call was never executed; run the calls on `ResumeDecision.event`."""
+  """A tool call was never executed; run the calls on `ResumeDecision.event`.
+
+  That event may be a copy holding only the unexecuted calls, so it is not
+  always one of `session.events` and must not be compared by identity.
+  """
 
 
 @dataclasses.dataclass(frozen=True)
@@ -207,6 +211,42 @@ def _needs_call_replay(
   )
 
 
+def _unexecuted_calls_event(
+    call_event: Event, later_events: list[Event]
+) -> Event | None:
+  """`call_event` cut down to the calls that never ran, or None if all did.
+
+  A call ran when a response in `later_events` carries its id, or its name
+  with no id. None is also returned once the agent has written any event with
+  content after `call_event`: tool responses and auth or confirmation requests
+  are only written after the whole batch ran, so a call still missing its
+  response then ran and lost it, or is pending.
+  """
+  if any(
+      ev.author == call_event.author and ev.content is not None
+      for ev in later_events
+  ):
+    return None
+  responses = [fr for ev in later_events for fr in ev.get_function_responses()]
+  answered_ids = {fr.id for fr in responses if fr.id is not None}
+  answered_names = {fr.name for fr in responses if fr.id is None}
+  unexecuted_ids = {
+      fc.id
+      for fc in call_event.get_function_calls()
+      if fc.id not in answered_ids and fc.name not in answered_names
+  }
+  if not unexecuted_ids or call_event.content is None:
+    return None
+  parts = [
+      part
+      for part in call_event.content.parts or []
+      if part.function_call is None or part.function_call.id in unexecuted_ids
+  ]
+  return call_event.model_copy(
+      update={'content': call_event.content.model_copy(update={'parts': parts})}
+  )
+
+
 def decide_resume(
     invocation_context: InvocationContext,
     events: list[Event],
@@ -222,7 +262,9 @@ def decide_resume(
 
   Returns:
     PAUSE when a call is still unanswered, REPLAY_CALLS (naming the event whose
-    calls to run) when a call was never executed, else CONTINUE.
+    calls to run, which may be a copy holding only the unexecuted calls rather
+    than one of `session.events`) when a call was never executed, else
+    CONTINUE.
   """
   paused_by_last = invocation_context.should_pause_invocation(events[-1])
   if not paused_by_last and _pause_left_calls_unanswered(
@@ -270,6 +312,10 @@ def decide_resume(
       pause = True
     elif _needs_call_replay(call_names, answers, from_sub_branch):
       return ResumeDecision(ResumeAction.REPLAY_CALLS, call_event)
+    elif unexecuted := _unexecuted_calls_event(
+        call_event, events[call_idx + 1 :]
+    ):
+      return ResumeDecision(ResumeAction.REPLAY_CALLS, unexecuted)
 
   return ResumeDecision(ResumeAction.PAUSE if pause else ResumeAction.CONTINUE)
 
```

**File**: `tests/unittests/flows/llm_flows/core/test_resume.py` (modified, +85/-0)
```diff
@@ -29,6 +29,7 @@
 from google.adk.flows.llm_flows.core._resume import decide_step_resume
 from google.adk.flows.llm_flows.core._resume import ResumeAction
 from google.adk.flows.llm_flows.core._resume import ResumeDecision
+from google.adk.flows.llm_flows.functions import REQUEST_EUC_FUNCTION_CALL_NAME
 from google.adk.workflow.utils._workflow_hitl_utils import REQUEST_INPUT_FUNCTION_CALL_NAME
 from google.genai import types
 import pytest
@@ -76,6 +77,28 @@ def _response_event(
   )
 
 
+def _parallel_call_event(calls: list[tuple[str, str]]) -> Event:
+  return Event(
+      author='agent',
+      invocation_id='inv-1',
+      content=types.Content(
+          role='model',
+          parts=[
+              types.Part(
+                  function_call=types.FunctionCall(
+                      id=call_id, name=name, args={}
+                  )
+              )
+              for name, call_id in calls
+          ],
+      ),
+  )
+
+
+def _replayed_ids(decision: ResumeDecision) -> list[str | None]:
+  return [fc.id for fc in decision.replay_event().get_function_calls()]
+
+
 def _text_event(text: str) -> Event:
   return Event(
       author='agent',
@@ -321,6 +344,55 @@ def test_parallel_calls_all_answered_continue(self):
     )
     assert decision.action is ResumeAction.CONTINUE
 
+  @pytest.mark.parametrize(
+      'sibling_name', ['fetch', 'ask'], ids=['other_name', 'same_name']
+  )
+  def test_parallel_call_that_never_ran_is_replayed_alone(self, sibling_name):
+    call = _parallel_call_event([('ask', 'c1'), (sibling_name, 'c2')])
+    events = [call, _response_event('ask', 'c1')]
+    decision = decide_resume(
+        self._ctx(), events, {'ask': object(), 'fetch': object()}
+    )
+    assert decision.action is ResumeAction.REPLAY_CALLS
+    assert _replayed_ids(decision) == ['c2']
+
+  def test_response_without_an_id_answers_its_call_by_name(self):
+    call = _parallel_call_event([('ask', 'c1'), ('fetch', 'c2')])
+    events = [call, _response_event('ask', None)]
+    decision = decide_resume(
+        self._ctx(), events, {'ask': object(), 'fetch': object()}
+    )
+    assert _replayed_ids(decision) == ['c2']
+
+  def test_sibling_missing_a_response_after_an_auth_resume_is_not_replayed(
+      self,
+  ):
+    auth_request = Event(
+        author='agent',
+        invocation_id='inv-1',
+        long_running_tool_ids={'a1'},
+        content=types.Content(
+            role='user',
+            parts=[
+                types.Part(
+                    function_call=types.FunctionCall(
+                        id='a1', name=REQUEST_EUC_FUNCTION_CALL_NAME, args={}
+                    )
+                )
+            ],
+        ),
+    )
+    events = [
+        _parallel_call_event([('ask', 'c1'), ('fetch', 'c2')]),
+        auth_request,
+        _response_event(REQUEST_EUC_FUNCTION_CALL_NAME, 'a1'),
+        _response_event('ask', 'c1', author='agent'),
+    ]
+    decision = decide_resume(
+        self._ctx(), events, {'ask': object(), 'fetch': object()}
+    )
+    assert decision.action is ResumeAction.CONTINUE
+
   def test_sub_branch_answer_replays_instead_of_pausing(self):
     # A HITL answer returned against the branch the call opened resolves it,
     # even though it carries none of the call's ids.
@@ -419,6 +491,19 @@ def test_a_cleared_branch_still_replays_its_trailing_call(self):
     assert decision.action is ResumeAction.REPLAY_CALLS
     assert decision.replay_event() is tail
 
+  def test_a_later_model_turn_leaves_an_earlier_unexecuted_call_alone(self):
+    tail = _call_event('ask', 'c3')
+    events = [
+        _parallel_call_event([('ask', 'c1'), ('fetch', 'c2')]),
+        _response_event('ask', 'c1'),
+        tail,
+    ]
+    decision = decide_step_resume(
+        self._ctx(events), {'ask': object(), 'fetch': object()}
+    )
+    assert decision.action is ResumeAction.REPLAY_CALLS
+    assert decision.replay_event() is tail
+
   def test_a_forged_user_authored_trailing_call_is_n
```

**File**: `tests/unittests/runners/test_resume_invocation.py` (modified, +68/-0)
```diff
@@ -328,6 +328,74 @@ async def test_resume_any_invocation():
   ]
 
 
+@pytest.mark.asyncio
+async def test_resume_runs_only_the_parallel_call_that_never_ran():
+  """The client answers one of two parallel calls that never ran, then resumes."""
+  runs = []
+  crash = True
+
+  def ask() -> str:
+    runs.append("ask")
+    return "asked"
+
+  def fetch() -> str:
+    runs.append("fetch")
+    return "fetched"
+
+  def crash_before_tools(tool, args, tool_context):
+    if crash:
+      raise RuntimeError("process stopped before the tools ran")
+    return None
+
+  runner = testing_utils.InMemoryRunner(
+      app=App(
+          name="test_app",
+          root_agent=LlmAgent(
+              name="root_agent",
+              model=testing_utils.MockModel.create(
+                  responses=[
+                      [
+                          Part.from_function_call(name="ask", args={}),
+                          Part.from_function_call(name="fetch", args={}),
+                      ],
+                      "done",
+                  ]
+              ),
+              tools=[ask, fetch],
+              before_tool_callback=crash_before_tools,
+          ),
+          resumability_config=ResumabilityConfig(is_resumable=True),
+      )
+  )
+  with pytest.raises(RuntimeError):
+    await runner.run_async("test user query")
+  crash = False
+  ask_call = next(
+      fc
+      for event in runner.session.events
+      for fc in event.get_function_calls()
+      if fc.name == "ask"
+  )
+
+  events = await runner.run_async(
+      new_message=testing_utils.UserContent(
+          Part(
+              function_response=FunctionResponse(
+                  id=ask_call.id, name="ask", response={"result": "client"}
+              )
+          )
+      )
+  )
+
+  assert runs == ["fetch"]
+  assert any(
+      part.text == "done"
+      for event in events
+      if event.content
+      for part in event.content.parts or []
+  )
+
+
 @pytest.mark.asyncio
 async def test_resumable_parallel_agent_escalation_short_circuits_persisted_run():
   """Runner persists fast+escalating events and marks the parent run complete."""
```

---

### Incident Patch 9: `643df966` (2026-09-29)
**Commit Message**: fix: drop unpairable trailing FRs in rearrange

Merge https://github.com/google/adk-python/pull/6752

Fixes #6751

PiperOrigin-RevId: 990390762

**File**: `src/google/adk/flows/llm_flows/tools/_rearranger.py` (modified, +138/-91)
```diff
@@ -22,7 +22,6 @@
 from google.genai import types
 
 from ....events.event import Event
-from ._functions import _collect_function_call_ids
 
 logger = logging.getLogger('google_adk.' + __name__)
 
@@ -181,40 +180,52 @@ def drop_orphaned_function_responses(
   outcome the same wherever it appears, and keeps unpaired results from being
   forwarded to providers that reject them.
 
-  Responses without an id are left alone: ids are stripped on the way out for
-  some model families, so a missing id does not imply a missing call.
+  Responses without a preceding matching function_call are dropped as orphans.
 
   Args:
     events: The events being assembled into request contents.
 
   Returns:
     The events with orphaned function_response parts removed.
   """
-  call_ids = _collect_function_call_ids(events)
-
+  seen_call_ids: set[str] = set()
+  seen_idless_call_names: set[str] = set()
   orphaned_ids: list[str] = []
   result_events: list[Event] = []
   for event in events:
     parts = event.content.parts if event.content else None
-    if not parts or not event.get_function_responses():
+    if parts and event.get_function_responses():
+      kept_parts: list[types.Part] = []
+      for part in parts:
+        response = part.function_response
+        if response:
+          is_matched = (
+              response.id in seen_call_ids
+              if response.id
+              else (
+                  bool(response.name)
+                  and response.name in seen_idless_call_names
+              )
+          )
+          if not is_matched:
+            orphaned_ids.append(response.id or '<missing-id>')
+            continue
+        kept_parts.append(part)
+
+      if kept_parts:
+        if len(kept_parts) != len(parts):
+          event = event.model_copy(deep=True)
+          if event.content:
+            event.content.parts = kept_parts
+        result_events.append(event)
+    else:
       result_events.append(event)
-      continue
 
-    kept_parts: list[types.Part] = []
-    for part in parts:
-      response = part.function_response
-      if response and response.id and response.id not in call_ids:
-        orphaned_ids.append(response.id)
-        continue
-      kept_parts.append(part)
-
-    if not kept_parts:
-      continue
-    if len(kept_parts) != len(parts):
-      event = event.model_copy(deep=True)
-      if event.content:
-        event.content.parts = kept_parts
-    result_events.append(event)
+    for fc in event.get_function_calls():
+      if fc.id:
+        seen_call_ids.add(fc.id)
+      elif fc.name:
+        seen_idless_call_names.add(fc.name)
 
   if orphaned_ids:
     logger.warning(
@@ -308,6 +319,25 @@ def drop_orphaned_function_calls(
   return result_events
 
 
+def _find_owning_call_event_index(
+    history_events: list[Event],
+    response: types.FunctionResponse,
+) -> int:
+  for idx in range(len(history_events) - 1, -1, -1):
+    if any(
+        (bool(response.id) and c.id == response.id)
+        or (
+            not response.id
+            and not c.id
+            and bool(response.name)
+            and c.name == response.name
+        )
+        for c in history_events[idx].get_function_calls()
+    ):
+      return idx
+  return -1
+
+
 def rearrange_events_for_latest_function_response(
     events: list[Event],
 ) -> list[Event]:
@@ -317,87 +347,104 @@ def rearrange_events_for_latest_function_response(
   between the initial function_call and the latest function_response will be
   removed.
 
+  If the latest event carries function responses with no matching function
+  call in history (an orphaned FR), those responses are dropped and history
+  is rearranged from the remaining events.
+
   Args:
     events: A list of events.
 
   Returns:
     A list of events with the latest function_response rearranged.
   """
-  if len(events) < 2:
-    # No need to process, since there is no function_call.
+  events = drop_orphaned_function_responses(events)
+  if len(events
```

**File**: `tests/unittests/flows/llm_flows/tools/test_rearranger.py` (modified, +416/-12)
```diff
@@ -25,6 +25,7 @@
 from google.adk.flows.llm_flows.tools._rearranger import merge_function_response_events
 from google.adk.flows.llm_flows.tools._rearranger import rearrange_events_for_async_function_responses_in_history
 from google.adk.flows.llm_flows.tools._rearranger import rearrange_events_for_latest_function_response
+from google.adk.models.anthropic_llm import content_to_message_param
 from google.genai import types
 import pytest
 
@@ -65,7 +66,7 @@ def _resp_event(
 
 
 def test_drop_orphaned_responses_prunes_unpaired_and_preserves_valid():
-  """Unpaired function response IDs are pruned while matched and ID-less responses survive."""
+  """Unpaired and ID-less function responses are pruned while matched responses survive."""
   call = _call_event("c1", "lookup")
   valid_resp = _resp_event("c1", "lookup", "found")
   no_id_resp = _resp_event(None, "legacy", "ok")
@@ -74,7 +75,7 @@ def test_drop_orphaned_responses_prunes_unpaired_and_preserves_valid():
 
   result = drop_orphaned_function_responses(events)
 
-  assert result == [call, valid_resp, no_id_resp]
+  assert result == [call, valid_resp]
 
 
 def test_drop_orphaned_responses_removes_event_when_all_parts_orphaned():
@@ -221,8 +222,6 @@ def test_drop_orphaned_calls_prunes_unanswered_in_parallel_tool_calls():
 
 def test_drop_orphaned_calls_prevents_unclosed_tool_use_in_anthropic_conversion():
   """Pruned events converted for Anthropic contain no unclosed tool_use blocks."""
-  from google.adk.models.anthropic_llm import content_to_message_param
-
   orphan_call = _call_event("fc_interrupted", "slow_tool")
   user_turn = Event(
       author="user",
@@ -371,15 +370,189 @@ def test_rearrange_latest_response_moves_to_call_and_prunes_intervening():
   }
 
 
-def test_rearrange_latest_response_missing_matching_call_raises_value_error():
-  """A trailing response with no matching preceding call raises ValueError."""
-  events = [
-      Event(author="user", content=types.UserContent("hello")),
-      _resp_event("missing_call_id"),
-  ]
+@pytest.mark.parametrize(
+    "resp_event",
+    [
+        _resp_event("missing_id"),
+        _resp_event(None, "missing_tool"),
+        _resp_event("", "missing_tool"),
+    ],
+    ids=["unmatched-id", "idless", "empty-id"],
+)
+def test_rearrange_latest_response_drops_orphans(
+    *,
+    resp_event: Event,
+) -> None:
+  """Trailing FR with unpairable, None, or empty id is dropped."""
+  user_msg = Event(author="user", content=types.UserContent("hello"))
+  result = rearrange_events_for_latest_function_response([user_msg, resp_event])
+  assert result == [user_msg]
+
+
+def test_rearrange_latest_response_drops_orphan_part_preserves_valid() -> None:
+  """An unmatched FR part is dropped while a matched sibling part is kept."""
+  call = _call_event("c1", "tool_a")
+  trailing = Event(
+      author="user",
+      content=types.UserContent([
+          types.Part(
+              function_response=types.FunctionResponse(
+                  id="c1", name="tool_a", response={"ok": True}
+              )
+          ),
+          types.Part(
+              function_response=types.FunctionResponse(
+                  id="extra", name="tool_b", response={"ok": True}
+              )
+          ),
+      ]),
+  )
+  result = rearrange_events_for_latest_function_response([call, trailing])
+  assert len(result) == 2
+  assert [r.id for r in result[1].get_function_responses()] == ["c1"]
+
+
+def test_rearrange_latest_response_preserves_non_fr_parts_when_orphan_dropped() -> (
+    None
+):
+  """Non-FR parts in the trailing event are preserved when an orphan is dropped."""
+  user_msg = Event(author="user", content=types.UserContent("hello"))
+  trailing = Event(
+      author="user",
+      content=types.UserContent([
+          types.Part(text="keep this text"),
+          types.Part(
+              function_response=types.FunctionResponse(
+                  name="ghost", response={"err": 1}
+              )
+          ),
+      ]),

```

---

### Incident Patch 10: `def458b6` (2026-09-29)
**Commit Message**: fix: stamp Redis sessions with the event timestamp

Merge https://github.com/google/adk-python/pull/7293

Fixes #7292

PiperOrigin-RevId: 990023711

**File**: `src/google/adk/integrations/redis/_redis_session_service.py` (modified, +6/-1)
```diff
@@ -340,7 +340,12 @@ async def append_event(self, session: Session, event: Event) -> Event:
     """Appends an event to the session and synchronizes state in Redis."""
     client = self._get_redis()
     event = await super().append_event(session, event)
-    session.last_update_time = time.time()
+    # Stamp the session with the event's own timestamp, matching
+    # InMemorySessionService, SqliteSessionService and DatabaseSessionService.
+    # The wall clock is wrong here: an event records when it was produced, which
+    # can predate the append when it is replayed or re-delivered, and
+    # last_update_time is the key list_sessions orders by.
+    session.last_update_time = event.timestamp
 
     # Sync app and user state deltas to their respective keys
     if event.actions and event.actions.state_delta:
```

**File**: `tests/unittests/integrations/redis/test_redis_session_service.py` (modified, +42/-0)
```diff
@@ -380,6 +380,48 @@ async def test_append_event_and_state_delta(session_service):
   assert fetched.state["app:status"] == "active"
 
 
+@pytest.mark.asyncio
+async def test_append_event_stamps_session_with_event_timestamp(
+    session_service,
+):
+  """The session records when the event happened, not when it was appended.
+
+  `last_update_time` is what `list_sessions` orders by, so stamping it with the
+  wall clock makes an event that is replayed, re-delivered or imported push a
+  session forward to its append time instead of its own. Every other backend
+  stores `event.timestamp`; the shared contract test asserts the same.
+  """
+  session = await session_service.create_session(
+      app_name="app1",
+      user_id="u1",
+  )
+
+  event_timestamp = session.last_update_time + 10
+  event = Event(
+      author="agent",
+      invocation_id="inv1",
+      timestamp=event_timestamp,
+  )
+
+  # Pin the wall clock far from the event's own timestamp so the current
+  # implementation cannot agree with the expected value by coincidence.
+  with mock.patch(
+      "google.adk.integrations.redis._redis_session_service.time"
+  ) as clock:
+    clock.time.return_value = event_timestamp + 100
+    await session_service.append_event(session, event)
+
+  assert session.last_update_time == pytest.approx(event_timestamp, abs=1e-6)
+
+  fetched = await session_service.get_session(
+      app_name="app1",
+      user_id="u1",
+      session_id=session.id,
+  )
+  assert fetched is not None
+  assert fetched.last_update_time == pytest.approx(event_timestamp, abs=1e-6)
+
+
 @pytest.mark.asyncio
 async def test_app_and_user_state_ttl(fake_redis, session_service):
   await session_service.create_session(
```

**File**: `tests/unittests/sessions/_conformance.py` (modified, +0/-4)
```diff
@@ -144,10 +144,6 @@ async def _make_per_agent_database(
         'redis',
         _make_redis,
         divergences={
-            'test_session_last_update_time_updates_on_event': (
-                'Redis stamps the session with the wall clock instead of the'
-                " appended event's timestamp."
-            ),
             'test_append_event_to_unknown_session_raises_session_not_found': (
                 'Redis writes the session key unconditionally on append, so'
                 ' appending to a session it has never stored creates one'
```

#### Recent Merged Pull Requests:
- **PR #7344** (closed): feat(live): generalize AudioCacheManager into multimodal CacheManager for live media persistence (@copybara-service[bot])
- **PR #7343** (closed): fix(deps): include greenlet for database extra (@zhengguangzhuo)
- **PR #7340** (closed): Update transfer_to_agent_tool.py (@SRIMATHI-R16)
- **PR #7339** (closed): Enhance conversation scenarios with example JSON (@Sivaparvathi96)
- **PR #7320** (closed): fix(workflow): isolate and clean up single_turn LlmAgent node_input events (@abhayjoshi201)
- **PR #7318** (closed): docs(setup): explain local lockfile needed by tox (@iarjunganesh)
- **PR #7299** (closed): fix: report the events the SQLite migration actually migrated (@feiiiiii5)
- **PR #7294** (closed): chore: merge release v2.10.0 to main (@adk-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
