# Forensic Learning Record (Deep Inspection): google/adk-python

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-adk-python-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/google/adk-python](https://github.com/google/adk-python))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:59:34.362Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google/adk-python`
- **Description**: An open-source, code-first Python toolkit for building, evaluating, and deploying sophisticated AI agents with flexibility and control.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 21718 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `contributing/samples/a2a/a2a_human_in_loop/__init__.py`
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

### Core Architecture Module: `contributing/samples/a2a/a2a_human_in_loop/agent.py`
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


from typing import Any

from google.adk.agents.llm_agent import Agent
from google.adk.agents.remote_a2a_agent import AGENT_CARD_WELL_KNOWN_PATH
from google.adk.agents.remote_a2a_agent import RemoteA2aAgent
from google.adk.apps import App
from google.adk.apps import ResumabilityConfig
from google.genai import types


def reimburse(purpose: str, amount: float) -> dict[str, Any]:
  """Reimburse the amount of money to the employee."""
  return {
      'status': 'ok',
  }


approval_agent = RemoteA2aAgent(
    name='approval_agent',
    description='Help approve the reimburse if the amount is greater than 100.',
    agent_card=(
        f'http://localhost:8001/a2a/human_in_loop{AGENT_CARD_WELL_KNOWN_PATH}'
    ),
)


root_agent = Agent(
    name='reimbursement_agent',
    instruction="""
      You are an agent whose job is to handle the reimbursement process for
      the employees. If the amount is less than $100, you will automatically
      approve the reimbursement. And call reimburse() to reimburse the amount to the employee.

      If the amount is greater than $100. You will hand over the request to
      approval_agent to handle the reimburse.
""",
    tools=[reimburse],
    sub_agents=[approval_agent],
    generate_content_config=types.GenerateContentConfig(temperature=0.1),
)

# The human-in-the-loop approval runs as a long-running tool on the remote
# approval_agent. When the manager approves (or rejects) the request, the ADK
# Web UI sends back a FunctionResponse for that pending long-running call. For
# the next turn to be routed back to the (remote) approval_agent so it can
# resume the paused tool instead of restarting at the root reimbursement_agent,
# the app must be resumable. Without this, the confirmation is delivered to the
# root agent, which has no pending call, and nothing happens.
app = App(
    name='a2a_human_in_loop',
    root_agent=root_agent,
    resumability_config=ResumabilityConfig(
        is_resumable=True,
    ),
)

```

### Core Architecture Module: `contributing/samples/a2a/a2a_human_in_loop/remote_a2a/human_in_loop/__init__.py`
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

### Core Architecture Module: `contributing/samples/a2a/a2a_human_in_loop/remote_a2a/human_in_loop/agent.py`
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

from typing import Any

from google.adk import Agent
from google.adk.tools.long_running_tool import LongRunningFunctionTool
from google.adk.tools.tool_context import ToolContext
from google.genai import types


def reimburse(purpose: str, amount: float) -> dict[str, Any]:
  """Reimburse the amount of money to the employee."""
  return {
      'status': 'ok',
  }


def ask_for_approval(
    purpose: str, amount: float, tool_context: ToolContext
) -> dict[str, Any]:
  """Ask for approval for the reimbursement."""
  return {
      'status': 'pending',
      'amount': amount,
      'ticketId': 'reimbursement-ticket-001',
  }


root_agent = Agent(
    name='reimbursement_agent',
    instruction="""
      You are an agent whose job is to handle the reimbursement process for
      the employees. If the amount is less than $100, you will automatically
      approve the reimbursement.

      If the amount is greater than $100, you will
      ask for approval from the manager. If the manager approves, you will
      call reimburse() to reimburse the amount to the employee. If the manager
      rejects, you will inform the employee of the rejection.
""",
    tools=[reimburse, LongRunningFunctionTool(func=ask_for_approval)],
    generate_content_config=types.GenerateContentConfig(temperature=0.1),
)

```

### Core Architecture Module: `contributing/samples/a2a/a2a_state_forwarding/__init__.py`
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

### Core Architecture Module: `contributing/samples/a2a/a2a_state_forwarding/agent.py`
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

from typing import Any

from a2a.types import Message as A2AMessage
from google.adk.a2a.agent.config import A2aRemoteAgentConfig
from google.adk.a2a.agent.config import ParametersConfig
from google.adk.a2a.agent.config import RequestInterceptor
from google.adk.agents.callback_context import CallbackContext
from google.adk.agents.invocation_context import InvocationContext
from google.adk.agents.llm_agent import Agent
from google.adk.agents.remote_a2a_agent import AGENT_CARD_WELL_KNOWN_PATH
from google.adk.agents.remote_a2a_agent import RemoteA2aAgent

# Only these session state keys are forwarded to the remote agent as A2A
# request metadata. Keeping the list explicit prevents accidentally leaking
# unrelated state (credentials, internal flags, large blobs, etc.) across the
# service boundary.
ALLOWED_FORWARD_KEYS: frozenset[str] = frozenset({"user_name"})


async def _forward_state_as_a2a_metadata(
    ctx: InvocationContext,
    a2a_request: A2AMessage,
    parameters: ParametersConfig,
) -> tuple[A2AMessage, ParametersConfig]:
  """Forward whitelisted session state keys through A2A request metadata."""
  payload: dict[str, Any] = {
      key: value
      for key, value in ctx.session.state.items()
      if key in ALLOWED_FORWARD_KEYS
  }
  if payload:
    parameters.request_metadata = {
        **(parameters.request_metadata or {}),
        **payload,
    }
  return a2a_request, parameters


greet_agent = RemoteA2aAgent(
    name="greet_agent",
    description="Greets the user using a name taken from session state.",
    agent_card=(
        f"http://localhost:8001/a2a/greet_agent{AGENT_CARD_WELL_KNOWN_PATH}"
    ),
    config=A2aRemoteAgentConfig(
        request_interceptors=[
            RequestInterceptor(before_request=_forward_state_as_a2a_metadata),
        ]
    ),
)


def _seed_state(callback_context: CallbackContext) -> None:
  """Seed demo session state so the remote agent has something to greet."""
  callback_context.state.setdefault("user_name", "Alice")


root_agent = Agent(
    model="gemini-2.5-flash",
    name="root_agent",
    instruction=(
        "You are a helpful assistant. When the user asks to be greeted,"
        " delegate to the greet_agent sub-agent."
    ),
    sub_agents=[greet_agent],
    before_agent_callback=_seed_state,
)

```

### Core Architecture Module: `contributing/samples/a2a/a2a_state_forwarding/remote_a2a/greet_agent/__init__.py`
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

### Core Architecture Module: `contributing/samples/a2a/a2a_state_forwarding/remote_a2a/greet_agent/agent.py`
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

from google.adk.agents.callback_context import CallbackContext
from google.adk.agents.llm_agent import Agent


def _inject_metadata_into_state(callback_context: CallbackContext) -> None:
  """Expand incoming A2A metadata into the session state.

  ADK's request_converter places A2A request metadata under
  `run_config.custom_metadata['a2a_metadata']`. We copy those entries into
  session state so that the agent's `instruction` template can resolve
  placeholders like `{user_name}` from values the caller provided.
  """
  run_config = callback_context.run_config
  if run_config is None or not run_config.custom_metadata:
    return
  a2a_metadata = run_config.custom_metadata.get("a2a_metadata") or {}
  for key, value in a2a_metadata.items():
    callback_context.state[key] = value


root_agent = Agent(
    model="gemini-2.5-flash",
    name="greet_agent",
    description="Greets the user using a name provided in session state.",
    instruction=(
        "Greet the user exactly in the following format, without any extra"
        " text:\n"
        "Hello {user_name}! How are you doing today?"
    ),
    before_agent_callback=_inject_metadata_into_state,
)

```

### Core Architecture Module: `contributing/samples/adk_team/adk_answering_agent/utils.py`
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
import sys
from typing import Any
from typing import Optional
from urllib.parse import urljoin

from adk_answering_agent.settings import GITHUB_GRAPHQL_URL
from adk_answering_agent.settings import GITHUB_TOKEN
from google.adk.runners import Runner
from google.genai import types
import requests

headers = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
}


def error_response(error_message: str) -> dict[str, Any]:
  return {"status": "error", "error_message": error_message}


def run_graphql_query(query: str, variables: dict[str, Any]) -> dict[str, Any]:
  """Executes a GraphQL query."""
  payload = {"query": query, "variables": variables}
  response = requests.post(
      GITHUB_GRAPHQL_URL, headers=headers, json=payload, timeout=60
  )
  response.raise_for_status()
  return response.json()


def parse_number_string(number_str: str | None, default_value: int = 0) -> int:
  """Parse a number from the given string."""
  if not number_str:
    return default_value

  try:
    return int(number_str)
  except ValueError:
    print(
        f"Warning: Invalid number string: {number_str}. Defaulting to"
        f" {default_value}.",
        file=sys.stderr,
    )
    return default_value


def _check_url_exists(url: str) -> bool:
  """Checks if a URL exists and is accessible."""
  try:
    # Set a timeout to prevent the program from waiting indefinitely.
    # allow_redirects=True ensures we correctly handle valid links
    # after redirection.
    response = requests.head(url, timeout=5, allow_redirects=True)
    # Status codes 2xx (Success) or 3xx (Redirection) are considered valid.
    return response.ok
  except requests.RequestException:
    # Catch all possible exceptions from the requests library
    # (e.g., connection errors, timeouts).
    return False


def _generate_github_url(repo_name: str, relative_path: str) -> str:
  """Generates a standard GitHub URL for a repo file."""
  return f"https://github.com/google/{repo_name}/blob/main/{relative_path}"


def convert_gcs_to_https(gcs_uri: str) -> Optional[str]:
  """Converts a GCS file link into a publicly accessible HTTPS link.

  Args:
      gcs_uri: The Google Cloud Storage link, in the format
        'gs://bucket_name/prefix/relative_path'.

  Returns:
      The converted HTTPS link as a string, or None if the input format is
      incorrect.
  """
  # Parse the GCS link
  if not gcs_uri or not gcs_uri.startswith("gs://"):
    print(f"Error: Invalid GCS link format: {gcs_uri}")
    return None

  try:
    # Strip 'gs://' and split by '/', requiring at least 3 parts
    # (bucket, prefix, path)
    parts = gcs_uri[5:].split("/", 2)
    if len(parts) < 3:
      raise ValueError(
          "GCS link must contain a bucket, prefix, and relative_path."
      )

    _, prefix, relative_path = parts
  except (ValueError, IndexError) as e:
    print(f"Error: Failed to parse GCS link '{gcs_uri}': {e}")
    return None

  # Replace .html with .md
  if relative_path.endswith(".html"):
    relative_path = relative_path.removesuffix(".html") + ".md"

  # Replace .txt with .yaml
  if relative_path.endswith(".txt"):
    relative_path = relative_path.removesuffix(".txt") + ".yaml"

  # Convert the links for adk-docs
  if prefix == "adk-docs" and relative_path.startswith("docs/"):
    path_after_docs = relative_path[len("docs/") :]
    if not path_after_docs.endswith(".md"):
      # Use the regular github url
      return _generate_github_url(prefix, relative_path)

    base_url = "https://google.github.io/adk-docs/"
    if os.path.basename(path_after_docs) == "index.md":
      # Use the directory path if it is an index file
      final_path_segment = os.path.dirname(path_after_docs)
    else:
      # Otherwise, use the file name without extension
      final_path_segment = path_after_docs.removesuffix(".md")

    if final_path_segment and not final_path_segment.endswith("/"):
      final_path_segment += "/"

    potential_url = urljoin(base_url, final_path_segment)

    # Check if the generated link exists
    if _check_url_exists(potential_url):
      return potential_url
    else:
      # If it doesn't exist, fall back to the regular github url
      return _generate_github_url(prefix, relative_path)

  # Convert the links for other cases, e.g. adk-python
  else:
    return _generate_github_url(prefix, relative_path)


async def call_agent_async(
    runner: Runner, user_id: str, session_id: str, prompt: str
) -> str:
  """Call the agent asynchronously with the user's prompt."""
  content = types.Content(
      role="user", parts=[types.Part.from_text(text=prompt)]
  )

  final_response_text = ""
  async for event in runner.run_async(
      user_id=user_id,
      session_id=session_id,
      new_message=content,
  ):
    if event.content and event.content.parts:
      if text := "".join(part.text or "" for part in event.content.parts):
        if event.author != "user":
          final_response_text += text

  return final_response_text

```

### Core Architecture Module: `contributing/samples/adk_team/adk_documentation/utils.py`
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

import re
from typing import Any
from typing import Dict
from typing import List
from typing import Tuple

from adk_documentation.settings import GITHUB_TOKEN
from google.adk.runners import Runner
from google.genai import types
import requests

HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
}


def error_response(error_message: str) -> Dict[str, Any]:
  return {"status": "error", "error_message": error_message}


def get_request(
    url: str,
    headers: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
) -> Dict[str, Any]:
  """Executes a GET request."""
  if headers is None:
    headers = HEADERS
  if params is None:
    params = {}
  response = requests.get(url, headers=headers, params=params, timeout=60)
  response.raise_for_status()
  return response.json()


def get_paginated_request(
    url: str, headers: dict[str, Any] | None = None
) -> List[Dict[str, Any]]:
  """Executes GET requests and follows 'next' pagination links to fetch all results."""
  if headers is None:
    headers = HEADERS

  results = []
  while url:
    response = requests.get(url, headers=headers, timeout=60)
    response.raise_for_status()
    results.extend(response.json())
    url = response.links.get("next", {}).get("url")
  return results


def post_request(url: str, payload: Any) -> Dict[str, Any]:
  response = requests.post(url, headers=HEADERS, json=payload, timeout=60)
  response.raise_for_status()
  return response.json()


def patch_request(url: str, payload: Any) -> Dict[str, Any]:
  response = requests.patch(url, headers=HEADERS, json=payload, timeout=60)
  response.raise_for_status()
  return response.json()


async def call_agent_async(
    runner: Runner, user_id: str, session_id: str, prompt: str
) -> str:
  """Call the agent asynchronously with the user's prompt."""
  content = types.Content(
      role="user", parts=[types.Part.from_text(text=prompt)]
  )

  final_response_text = ""
  async for event in runner.run_async(
      user_id=user_id,
      session_id=session_id,
      new_message=content,
  ):
    if event.content and event.content.parts:
      if text := "".join(part.text or "" for part in event.content.parts):
        if event.author != "user":
          final_response_text += text

  return final_response_text


def parse_suggestions(issue_body: str) -> List[Tuple[int, str]]:
  """Parse numbered suggestions from issue body.

  Supports multiple formats:
  - Format A (markdown headers): "### 1. Title"
  - Format B (numbered list with bold): "1. **Title**"

  Args:
      issue_body: The body text of the GitHub issue.

  Returns:
      A list of tuples, where each tuple contains:
      - The suggestion number (1-based)
      - The full text of that suggestion
  """
  # Try different patterns in order of preference
  patterns = [
      # Format A: "### 1. Title" (markdown header with number)
      (r"(?=^###\s+\d+\.)", r"^###\s+(\d+)\."),
      # Format B: "1. **Title**" (numbered list with bold)
      (r"(?=^\d+\.\s+\*\*)", r"^(\d+)\.\s+\*\*"),
  ]

  for split_pattern, match_pattern in patterns:
    parts = re.split(split_pattern, issue_body, flags=re.MULTILINE)

    suggestions = []
    for part in parts:
      part = part.strip()
      if not part:
        continue

      match = re.match(match_pattern, part)
      if match:
        suggestion_num = int(match.group(1))
        suggestions.append((suggestion_num, part))

    # If we found suggestions with this pattern, return them
    if suggestions:
      return suggestions

  return []

```

### Core Architecture Module: `contributing/samples/adk_team/adk_issue_formatting_agent/utils.py`
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

from typing import Any

from adk_issue_formatting_agent.settings import GITHUB_TOKEN
import requests

headers = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28",
}


def get_request(
    url: str, params: dict[str, Any] | None = None
) -> dict[str, Any]:
  if params is None:
    params = {}
  response = requests.get(url, headers=headers, params=params, timeout=60)
  response.raise_for_status()
  return response.json()


def post_request(url: str, payload: Any) -> dict[str, Any]:
  response = requests.post(url, headers=headers, json=payload, timeout=60)
  response.raise_for_status()
  return response.json()


def error_response(error_message: str) -> dict[str, Any]:
  return {"status": "error", "message": error_message}


def read_file(file_path: str) -> str:
  """Read the content of the given file."""
  try:
    with open(file_path, "r") as f:
      return f.read()
  except FileNotFoundError:
    print(f"Error: File not found: {file_path}.")
    return ""

```

### Core Architecture Module: `contributing/samples/adk_team/adk_issue_monitoring_agent/utils.py`
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

import logging
from typing import Any

from adk_issue_monitoring_agent.settings import GITHUB_TOKEN
from adk_issue_monitoring_agent.settings import INITIAL_FULL_SCAN
from adk_issue_monitoring_agent.settings import SPAM_LABEL_NAME
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger("google_adk." + __name__)

_api_call_count = 0


def get_api_call_count() -> int:
  return _api_call_count


def reset_api_call_count() -> None:
  global _api_call_count
  _api_call_count = 0


def _increment_api_call_count() -> None:
  global _api_call_count
  _api_call_count += 1


retry_strategy = Retry(
    total=6,
    backoff_factor=2,
    status_forcelist=[429, 500, 502, 503, 504],
    allowed_methods=["GET", "DELETE"],
)
adapter = HTTPAdapter(max_retries=retry_strategy)
_session = requests.Session()
_session.mount("https://", adapter)
_session.headers.update({
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
})


def get_request(url: str, params: dict[str, Any] | None = None) -> Any:
  _increment_api_call_count()
  response = _session.get(url, params=params or {}, timeout=60)
  response.raise_for_status()
  return response.json()


def post_request(url: str, payload: Any) -> Any:
  _increment_api_call_count()
  response = _session.post(url, json=payload, timeout=60)
  response.raise_for_status()
  return response.json()


def error_response(error_message: str) -> dict[str, Any]:
  return {"status": "error", "message": error_message}


def get_repository_maintainers(owner: str, repo: str) -> list[str]:
  """Fetches all users with push/maintain access."""
  url = f"https://api.github.com/repos/{owner}/{repo}/collaborators"
  data = get_request(url, {"permission": "push"})
  return [user["login"] for user in data]


def get_issue_details(
    owner: str, repo: str, issue_number: int
) -> dict[str, Any]:
  """Fetches the main issue object to get the original description (body)."""
  url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}"
  return get_request(url)


def get_issue_comments(
    owner: str, repo: str, issue_number: int
) -> list[dict[str, Any]]:
  """Fetches ALL comments for a specific issue, handling pagination."""
  url = f"https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}/comments"
  all_comments = []
  page = 1

  while True:
    data = get_request(url, params={"per_page": 100, "page": page})
    if not data:
      break

    all_comments.extend(data)

    if len(data) < 100:
      break
    page += 1

  return all_comments


def get_target_issues(owner: str, repo: str) -> list[int]:
  """
  Fetches issues.
  If INITIAL_FULL_SCAN is True, fetches ALL open issues.
  If False, fetches only issues updated in the last 24 hours using the 'since' parameter.

  Raises requests.exceptions.RequestException if a page cannot be fetched. A
  partial list is indistinguishable from a genuinely short one, so the caller
  is told the fetch failed instead.
  """
  from datetime import datetime
  from datetime import timedelta
  from datetime import timezone

  url = f"https://api.github.com/repos/{owner}/{repo}/issues"
  params = {
      "state": "open",
      "per_page": 100,
  }

  if INITIAL_FULL_SCAN:
    logger.info("INITIAL_FULL_SCAN is True. Fetching ALL open issues...")
  else:
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    params["since"] = yesterday
    logger.info(f"Daily mode: Fetching issues updated since {yesterday}...")

  issue_numbers = []
  page = 1

  while True:
    params["page"] = page
    try:
      items = get_request(url, params=params)

      if not items:
        break

      for item in items:
        if "pull_request" not in item:
          # Extract all the label names on this issue
          current_labels = [label["name"] for label in item.get("labels", [])]

          # Only add the issue if it DOES NOT already have the spam label
          if SPAM_LABEL_NAME not in current_labels:
            issue_numbers.append(item["number"])
          else:
            logger.debug(
                f"Skipping #{item['number']} - already marked as spam."
            )

      if len(items) < 100:
        break

      page += 1
    except requests.exceptions.RequestException as e:
      logger.error(f"Failed to fetch issues on page {page}: {e}")
      raise

  return issue_numbers

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7399** (2026-10-05): **docs: correct Redis session retention and configuration defaults**
  *Symptoms*: ### Link to Issue or Description of Change  **Problem:** The RedisSessionService guide lists `ttl_seconds=0` as the default, which implies sessions never expire. `RedisSessionServiceConfig` actually defaults to 604800 seconds (7 days). The documented host, port, and key prefix defaults also differ from the configuration model.  **Solution:** Align those four defaults with the model and explain that `ttl_seconds=0` must be set explicitly to disable expiration. Clarify that a write refreshes the expiration timer for the key being written.  ### Testing Plan  - Compared all eight documented defaults with an instantiated   `RedisSessionServiceConfig`: four mismatches before, zero after. Confirmed   an explicit `ttl_seconds=0` remains accepted. - Inspected the Redis writes to verify they pass an expiration only for a   positive TTL. - `python3 scripts/check_docs.py` passed. - `pre-commit run --files docs/guides/integrations/redis/redis_session_service/index.md`   passed (documentation links/index, whitespace, and spelling). - `git diff --check` passed.  Documentation only; no runtime behavior changes, Redis server, or model calls.  ### Checklist  - [x] I have read `CONTRIBUTING.md`. - [x] I have performed a self-review. 
  **Post-Mortem & Fix Analysis**:
  > Hello @joefernandez any chance get your review help?
  > Thank you @BichengWang for your contribution! 🎉  Your changes have been successfully imported and merged via Copybara in commit 0f6a3d5.  Closing this PR as the changes are now in the main branch.

- **Issue #7391** (2026-10-05): **fix(flows): inject artifact text, not the Part repr, into instructions**
  *Symptoms*: **Please ensure you have read the [contribution guide](https://github.com/google/adk-python/blob/main/CONTRIBUTING.md) before creating a pull request.**  ### Link to Issue or Description of Change  No existing issue; described below following the bug-report structure.  **Describe the Bug:**  `{artifact.<name>}` placeholders in instructions, and the Jinja `artifact()` helper, render `str(artifact)` (`_instructions_utils.py`, regex and Jinja paths). Every artifact service returns a `types.Part`, and `str(Part)` is its pydantic field dump. The existing tests use a mock `load_artifact` that returns a plain `str`, so they don't catch this.  **Impact:**  Every agent whose instruction references an artifact sends the model the `Part` repr instead of the content.  **Observed Behavior:**  With `InMemoryArtifactService` and `types.Part(text="Buy milk.")`, the instruction `Notes: {artifact.notes.txt}` renders as:  ``` Notes: media_resolution=None code_execution_result=None executable_code=None file_data=None function_call=None function_response=None inline_data=None text='Buy milk.' thought=None ... ```  **Expected Behavior:** `Notes: Buy milk.`  **Solution:**  Add `_artifact_to_text` and use it on both paths: - a `Part` with `text` renders as that text; - `text/*` `inline_data` is decoded as UTF-8; - anything else keeps the existing `str()` rendering. Sending non-text artifacts as real parts is a separate feature (#4674).  ### Testing Plan  **Unit Tests:**  - [x] I have added or update
  **Post-Mortem & Fix Analysis**:
  > Thank you @AtulJoshi1206 for your contribution! 🎉  Your changes have been successfully imported and merged via Copybara in commit cd5814e.  Closing this PR as the changes are now in the main branch.

- **Issue #7388** (2026-10-05): **fix(flows): count ID-less responses when resuming parallel calls**
  *Symptoms*: ### Link to Issue or Description of Change  - Closes: #7387. - Related: #7108, specifically the [remaining ID-less response case](https://github.com/google/adk-python/issues/7108#issuecomment-5896130105).  **Problem:**  When a restored resumable invocation contains parallel calls to the same tool, one ID-less response currently marks all calls with that name as answered. The flow can therefore continue without executing an unmatched sibling. This is separate from the original #7108 fix, which already landed.  **Solution:**  Count ID-less responses per tool name. Match explicit response IDs first, then consume one name-only response per remaining call in original call order. Filter the replay event by content part so calls without IDs can also be distinguished by their position. Preserve non-call parts and stored events.  The existing agent-authored batch-completion guard, pause/LRO/HITL decisions, branch filtering, and author provenance checks remain unchanged. The helper docstring documents the matching rule; no public API or configuration changes are introduced.  Name-only responses cannot identify which same-name arguments actually ran. Call order is a deterministic compatibility fallback, not an exactly-once guarantee. Normal ADK responses retain call IDs; this fix concerns restored or caller-supplied histories with ID-less responses.  ### Testing Plan  **Unit Tests:**  - [x] I have added or updated unit tests for my change. - [x] Full supported-vers
  **Post-Mortem & Fix Analysis**:
  > Thank you @SoroushRF for your contribution! 🎉  Your changes have been successfully imported and merged via Copybara in commit 531f410.  Closing this PR as the changes are now in the main branch.

- **Issue #7387** (2026-10-05): **ID-less responses suppress unanswered same-name calls when resuming parallel tools**
  *Symptoms*: ## Required Information  **Describe the Bug:**  A restored resumable invocation with two parallel calls to the same tool and one ID-less function response can skip the unexecuted sibling. The partial-replay helper treats ID-less response names as a set, so one response marks every call with that name as answered.  This is the remaining edge described in the [last comment on #7108](https://github.com/google/adk-python/issues/7108#issuecomment-5896130105), rather than the original bug fixed by #7115. A maintainer [requested a new issue for remaining failures](https://github.com/google/adk-python/pull/7115).  **Steps to Reproduce:**  1. Restore a resumable session containing an agent-authored event with `ask/c1` and `ask/c2` calls with different arguments. 2. Include one subsequent user-authored `FunctionResponse(name="ask", id=None)` and no agent-authored batch-completion event. 3. Resume the saved invocation. The existing name fallback marks both calls answered.  **Expected Behavior:**  An ID-less response should account for one same-name call, leaving the other call eligible for replay. Since the response cannot identify the arguments of the answered call, the proposed deterministic fallback matches explicit IDs first, then consumes ID-less responses against remaining calls in their original order. Please confirm that matching policy before a PR is submitted.  **Observed Behavior:**  The flow continues without executing the remaining call. With a deterministic offline model, 

- **Issue #7376** (2026-10-05): **fix(models): send temperature and top_p on interactions API requests**
  *Symptoms*: `build_generation_config` drops `temperature`, `top_p` and `top_k` as parameters google-genai cannot carry on an interactions request. Since google-genai 2.26.0, `GenerationConfigParam` declares `temperature` and `top_p`, so a configured temperature is still dropped by ADK, and the warning blames the client. `test_dropped_parameters_are_the_ones_the_request_cannot_carry` has been failing on main since 2.26.0.  Send `temperature` and `top_p`. `top_k` is still undeclared and stays dropped with its warning.  ### Testing Plan  **Unit tests**  `TestBuildGenerationConfig` now expects `temperature` and `top_p` in the built config and only `top_k` in the client-side warning.  ``` $ pytest tests/unittests/models -q 1390 passed ```  **Manual E2E**  `Gemini(model="gemini-2.5-flash", use_interactions_api=True)` with `temperature=0`, six runs of a "random number" prompt against the live API. On main the request carries no `generation_config` and returns six different numbers. With this change it sends `{"temperature": 0.0}` and returns the same two numbers as a direct `client.aio.interactions.create(..., generation_config={"temperature": 0})`. 
  **Post-Mortem & Fix Analysis**:
  > thanks @donggyun112 for catching this and for the fix. the same fix landed later that day in 8e89a64, which sends temperature and top_p when the installed google-genai supports them. it's on main but not in a release yet. please open a new issue if this is still happening.

- **Issue #7374** (2026-10-02): **chore: merge release v2.11.0 to main**
  *Symptoms*: Syncs version bump and CHANGELOG from release v2.11.0 to main.
  **Post-Mortem & Fix Analysis**:
  > Thank you @adk-bot for your contribution! 🎉  Your changes have been successfully imported and merged via Copybara in commit 9e8c2bc.  Closing this PR as the changes are now in the main branch.

- **Issue #7373** (2026-10-02): **chore(release/candidate): release 2.11.0**
  *Symptoms*: ## [2.11.0](https://github.com/google/adk-python/compare/v2.10.0...v2.11.0) (2026-10-01)   ### Highlights  This release adds graceful cancellation and tool confirmation to workflows, a tool for consulting another model mid-task, and a built-in SQLite memory service.  * **Execution cancellation**: Pass an `abort_signal` to `Runner`, `Workflow`, and nodes to stop a run gracefully; `/run_sse` now cancels the run when the client disconnects. See the [unit guide](https://github.com/google/adk-python/blob/main/docs/guides/runners/runner/abort.md) for more details. ([ef5bbcf](https://github.com/google/adk-python/commit/ef5bbcfe51670bd211645a043914c162e7c1cd60), [3d73603](https://github.com/google/adk-python/commit/3d73603deb180a6518982b2b60f036c764f0cf7e)) * **Tool confirmation in workflows**: Tool nodes now pause for user approval via `RequestInput`, the same way an `LlmAgent` does, instead of passing an error downstream. ([ce132b9](https://github.com/google/adk-python/commit/ce132b92d471b8df903524593d863171b000a764)) * **ModelConsultTool**: Let an agent consult another model mid-task, capped by per-turn and per-session budgets. See the [unit guide](https://github.com/google/adk-python/blob/main/docs/guides/tools/model_consult/model_consult_tool/index.md) for more details. ([84cc99a](https://github.com/google/adk-python/commit/84cc99abd53010817a85b51fdcdc5d4f48366769)) * **SQLite memory service**: Keep agent memory in a local SQLite database, selected with a `sqlite://` memory serv
  **Post-Mortem & Fix Analysis**:
  > # Release artifact check: PASS  Comparing `2.11.0` against `2.10.0`. Modules swept: 775 candidate, 764 baseline.  No module regressed against the baseline.  <details> <summary>No longer shipped (2)</summary>  - `google.adk.flows.llm_flows._fencing` - `google.adk.flows.llm_flows._live_llm_flow`  </details> 

- **Issue #7372** (2026-10-01): **chore: update compiled adk web assets**
  *Symptoms*: This PR automatically updates the compiled adk web files in `src/google/adk/cli/browser/` using the assets from `google/adk-web@v1.0.7`. Please review the diff before merging.
  **Post-Mortem & Fix Analysis**:
  > Thank you @adk-bot for your contribution! 🎉  Your changes have been successfully imported and merged via Copybara in commit 22df082.  Closing this PR as the changes are now in the main branch.

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

### Incident Patch 1: `4b1e0045` (2026-10-05)
**Commit Message**: fix: allow OIDC token exchange without client_secret

Merge https://github.com/google/adk-python/pull/7049

Fixes #2256

PiperOrigin-RevId: 993936217

**File**: `src/google/adk/auth/auth_handler.py` (modified, +34/-21)
```diff
@@ -14,6 +14,7 @@
 
 from __future__ import annotations
 
+import logging
 from typing import TYPE_CHECKING
 
 from fastapi.openapi.models import OAuthFlows
@@ -38,6 +39,8 @@
 except ImportError:
   AUTHLIB_AVAILABLE = False
 
+logger = logging.getLogger("google_adk." + __name__)
+
 
 def _normalize_oauth_scopes(
     scopes: dict[str, str] | list[str] | None,
@@ -108,7 +111,12 @@ def _validate(self) -> None:
     if not self.auth_config.auth_scheme:
       raise ValueError("auth_scheme is empty.")
 
-  def _is_exchangeable(self, credential: AuthCredential | None) -> bool:
+  def _is_exchangeable(
+      self,
+      credential: AuthCredential | None,
+      *,
+      allow_public: bool = False,
+  ) -> bool:
     """Returns whether credential still needs, and can do, a token exchange."""
     if not isinstance(
         self.auth_config.auth_scheme, SecurityBase
@@ -118,12 +126,9 @@ def _is_exchangeable(self, credential: AuthCredential | None) -> bool:
     ):
       return False
     oauth2 = credential.oauth2 if credential else None
-    return bool(
-        oauth2
-        and not oauth2.access_token
-        and oauth2.client_id
-        and oauth2.client_secret
-    )
+    if not oauth2 or oauth2.access_token or not oauth2.client_id:
+      return False
+    return bool(oauth2.client_secret or allow_public)
 
   def _read_stored_credential(
       self, state: State
@@ -170,7 +175,7 @@ def get_auth_response(self, state: State) -> AuthCredential | None:
         credential=credential,
         raw_credential=self.auth_config.raw_auth_credential,
     )
-    if not self._is_exchangeable(credential):
+    if not self._is_exchangeable(credential, allow_public=True):
       return credential
 
     exchange_result = OAuth2CredentialExchanger()._exchange_sync(
@@ -263,14 +268,11 @@ def _generate_auth_request(self) -> AuthConfig:
           credential_key=self.auth_config.credential_key,
       )
 
-    # Check for client_id and client_secret
-    if (
-        not self.auth_config.raw_auth_credential.oauth2.client_id
-        or not self.auth_config.raw_auth_credential.oauth2.client_secret
-    ):
+    # Public clients (Azure AD B2C, PKCE) have a client_id and no secret.
+    if not self.auth_config.raw_auth_credential.oauth2.client_id:
       raise ValueError(
-          f"Auth Scheme {self.auth_config.auth_scheme.type_} requires both"
-          " client_id and client_secret in auth_credential.oauth2."
+          f"Auth Scheme {self.auth_config.auth_scheme.type_} requires"
+          " client_id in auth_credential.oauth2."
       )
 
     # Generate new auth URI
@@ -355,12 +357,21 @@ def generate_auth_uri(
       else:
         scopes = []
 
+    code_challenge_method = auth_credential.oauth2.code_challenge_method
+    if not auth_credential.oauth2.client_secret and not code_challenge_method:
+      logger.warning(
+          "OAuth2 client_secret is not set for client_id %s; treating client"
+          " as public.",
+          auth_credential.oauth2.client_id,
+      )
+      code_challenge_method = "S256"
+
     client = OAuth2Session(
         auth_credential.oauth2.client_id,
         auth_credential.oauth2.client_secret,
         scope=" ".join(scopes),
         redirect_uri=auth_credential.oauth2.redirect_uri,
-        code_challenge_method=auth_credential.oauth2.code_challenge_method,
+        code_challenge_method=code_challenge_method,
     )
     params = {
         "access_type": "offline",
@@ -375,13 +386,12 @@ def generate_auth_uri(
     # If not provided in the credential, generate a cryptographically secure
     # random token of 48 characters (OAuth2 recommends 43-128 characters).
     code_verifier = auth_credential.oauth2.code_verifier
-    method = auth_credential.oauth2.code_challenge_method
 
-    if method:
-      if method != "S256":
+    if code_challenge_method:
+      if code_challenge_method != "S256":
         raise ValueError(
-            f"Unsupported code_challenge_method: {method}. Only 'S256' is"
-            " supported."
+            f"Unsupported code_challenge_method: {code_challenge_method}. Only"
+            " 'S256' is supported."
         )
       if not code_verifier:
         code_verifier = generate_token(48)
@@ -396,5 +406,8 @@ def generate_auth_uri(
       exchanged_auth_credential.oauth2.state = state
       if code_verifier:
         exchanged_auth_credential.oauth2.code_verifier = code_verifier
+        exchanged_auth_credential.oauth2.code_challenge_method = (
+            code_challenge_method
+        )
 
     return exchanged_auth_credential
```

**File**: `src/google/adk/auth/oauth2_credential_util.py` (modified, +21/-2)
```diff
@@ -151,18 +151,37 @@ def create_oauth2_session(
       not auth_credential
       or not auth_credential.oauth2
       or not auth_credential.oauth2.client_id
-      or not auth_credential.oauth2.client_secret
   ):
     return None, None
 
+  # Public clients have no client_secret and use the "none" auth method.
+  token_endpoint_auth_method: str | None = (
+      auth_credential.oauth2.token_endpoint_auth_method
+  )
+  if not auth_credential.oauth2.client_secret:
+    if token_endpoint_auth_method == "private_key_jwt":
+      return None, None
+    if (
+        token_endpoint_auth_method
+        in ("client_secret_basic", "client_secret_post", "client_secret_jwt")
+        or token_endpoint_auth_method is None
+    ):
+      if not auth_credential.oauth2.code_challenge_method:
+        logger.warning(
+            "OAuth2 client_secret is not set for client_id %s; treating client"
+            " as public (token_endpoint_auth_method='none').",
+            auth_credential.oauth2.client_id,
+        )
+      token_endpoint_auth_method = "none"
+
   # Scope is intentionally omitted: token exchange and refresh don't require
   # it per RFC 6749, and some providers reject it on these requests.
   session = OAuth2Session(
       auth_credential.oauth2.client_id,
       auth_credential.oauth2.client_secret,
       redirect_uri=auth_credential.oauth2.redirect_uri,
       state=auth_credential.oauth2.state,
-      token_endpoint_auth_method=auth_credential.oauth2.token_endpoint_auth_method,
+      token_endpoint_auth_method=token_endpoint_auth_method,
       code_challenge_method=auth_credential.oauth2.code_challenge_method,
       default_timeout=_TOKEN_REQUEST_TIMEOUT_SECONDS,
   )
```

**File**: `src/google/adk/tools/openapi_tool/openapi_spec_parser/tool_auth_handler.py` (modified, +0/-5)
```diff
@@ -711,11 +711,6 @@ def _request_credential(self) -> None:
             "OAuth2 credentials client_id is missing."
         )
 
-      if not self.auth_credential.oauth2.client_secret:
-        raise AuthCredentialMissingError(
-            "OAuth2 credentials client_secret is missing."
-        )
-
     self.tool_context.request_credential(self._build_auth_config())
     return None
 
```

**File**: `src/google/adk/workflow/utils/_workflow_hitl_utils.py` (modified, +51/-13)
```diff
@@ -23,7 +23,9 @@
 from google.genai import types
 from pydantic import ValidationError
 
+from ...auth.auth_credential import AuthCredential
 from ...auth.auth_credential import AuthCredentialTypes as _AuthCredentialTypes
+from ...auth.auth_credential import OAuth2Auth
 from ...auth.auth_handler import AuthHandler
 from ...auth.auth_tool import AuthConfig
 from ...auth.auth_tool import AuthToolArguments
@@ -33,7 +35,6 @@
 from .._errors import WorkflowDataError
 
 if TYPE_CHECKING:
-  from ...auth.auth_credential import AuthCredential
   from ...sessions.state import State
 
 REQUEST_INPUT_FUNCTION_CALL_NAME = 'adk_request_input'
@@ -134,12 +135,20 @@ def get_request_input_interrupt_ids(event: Event) -> list[str]:
 _OAUTH_STATE_KEY_PREFIX = 'adk_oauth_state:'
 """Session state prefix under which a generated OAuth state is kept."""
 
+_OAUTH_CREDENTIAL_KEY_PREFIX = 'adk_oauth_credential:'
+"""Session state prefix for a generated OAuth request credential."""
+
 
 def _oauth_state_key(interrupt_id: str) -> str:
   """Returns the session state key holding the generated OAuth state."""
   return f'{_OAUTH_STATE_KEY_PREFIX}{interrupt_id}'
 
 
+def _oauth_credential_key(interrupt_id: str) -> str:
+  """Returns the session state key holding the generated OAuth credential."""
+  return f'{_OAUTH_CREDENTIAL_KEY_PREFIX}{interrupt_id}'
+
+
 def _build_auth_message(auth_config: AuthConfig) -> str:
   """Builds a human-readable message describing what credential is needed."""
   raw_cred = auth_config.raw_auth_credential
@@ -169,21 +178,30 @@ def create_auth_request_event(
   Args:
     auth_config: The auth configuration for the node.
     interrupt_id: The interrupt ID for this auth request.
-    state: The session state. The OAuth state generated for this request is
-      kept there so the resume response can be checked against it.
+    state: The session state. The OAuth state and any PKCE verifier
+      credential generated for this request are kept there for
+      ``process_auth_resume``.
 
   Returns:
     An Event containing an ``adk_request_credential`` function call.
   """
   auth_handler = AuthHandler(auth_config)
   auth_request = auth_handler.generate_auth_request()
   generated_credential = auth_request.exchanged_auth_credential
-  if (
-      generated_credential
-      and generated_credential.oauth2
-      and generated_credential.oauth2.state
-  ):
-    state[_oauth_state_key(interrupt_id)] = generated_credential.oauth2.state
+  if generated_credential and generated_credential.oauth2:
+    if generated_credential.oauth2.state:
+      state[_oauth_state_key(interrupt_id)] = generated_credential.oauth2.state
+    if generated_credential.oauth2.code_verifier:
+      state[_oauth_credential_key(interrupt_id)] = AuthCredential(
+          auth_type=generated_credential.auth_type,
+          oauth2=OAuth2Auth(
+              code_verifier=generated_credential.oauth2.code_verifier,
+              code_challenge_method=(
+                  generated_credential.oauth2.code_challenge_method
+              ),
+          ),
+      )
+      generated_credential.oauth2.code_verifier = None
   args = AuthToolArguments(
       function_call_id=interrupt_id,
       auth_config=auth_request,
@@ -218,8 +236,6 @@ def _build_credential_from_value(
   For API_KEY, the value is used as the key string directly.
   For all other types, the value is parsed as an AuthCredential dict.
   """
-  from ...auth.auth_credential import AuthCredential
-
   raw_cred = auth_config.raw_auth_credential
   if raw_cred is None:
     return AuthCredential.model_validate(value)
@@ -244,7 +260,8 @@ async def process_auth_resume(
   Only the credential is read from the response; the node's own auth config
   decides which scheme the credential is exchanged and stored under. When an
   OAuth state was generated for this request, the response must carry that
-  same state back.
+  same state back. Any PKCE verifier cached in ``state`` for this request is
+  restored onto the credential and cleared from ``state``.
 
   Accepts multiple response formats (tried in order):
     1. A full AuthConfig dict (from web UI OAuth flow).
@@ -259,7 +276,8 @@ async def process_auth_resume(
   Args:
     response_data: The unwrapped response from the client.
     auth_config: The original auth configuration for the node.
-    state: The session state to store credentials in.
+    state: The session state to read the cached OAuth state and PKCE verifier
+      from, and to store exchanged credentials in.
     interrupt_id: The interrupt ID of the auth request being resumed.
 
   Raises:
@@ -285,6 +303,26 @@ async def process_auth_resume(
           ' with the authorization result filled in.'
       )
 
+  credential_key = _oauth_credential_key(interrupt_id)
+  stored_credential = state.get(credential_key)
+  if isinstance(stored_credential, Mapping):
+    stored_credential = AuthCredential.model_validate(stored_credential)
+  if (
+      isinstance(stored_crede
```

**File**: `tests/unittests/auth/test_auth_handler.py` (modified, +152/-4)
```diff
@@ -386,6 +386,59 @@ def test_generate_auth_uri_pkce(
     assert "code_verifier" in kwargs
     assert kwargs["code_verifier"] == result.oauth2.code_verifier
 
+  @patch("google.adk.auth.auth_handler.OAuth2Session")
+  def test_generate_auth_uri_public_client_defaults_pkce_s256(
+      self, mock_oauth2_session, oauth2_auth_scheme, caplog
+  ):
+    """Public clients default code_challenge_method to S256."""
+    public_credential = AuthCredential(
+        auth_type=AuthCredentialTypes.OAUTH2,
+        oauth2=OAuth2Auth(
+            client_id="public-client",
+            redirect_uri="https://example.com/callback",
+        ),
+    )
+    config = AuthConfig(
+        auth_scheme=oauth2_auth_scheme,
+        raw_auth_credential=public_credential,
+        exchanged_auth_credential=public_credential.model_copy(deep=True),
+    )
+    mock_client = Mock()
+    mock_oauth2_session.return_value = mock_client
+    mock_client.create_authorization_url.return_value = (
+        "https://example.com/oauth2/authorize?code_challenge=...&code_challenge_method=S256",
+        "mock_state",
+    )
+
+    handler = AuthHandler(config)
+    with caplog.at_level("WARNING", logger="google_adk"):
+      result = handler.generate_auth_uri()
+    auth_request = handler.generate_auth_request()
+
+    assert (
+        mock_oauth2_session.call_args.kwargs["code_challenge_method"] == "S256"
+    )
+    assert result.oauth2.code_challenge_method == "S256"
+    assert result.oauth2.code_verifier is not None
+    assert (
+        auth_request.exchanged_auth_credential.oauth2.code_challenge_method
+        == "S256"
+    )
+    assert (
+        auth_request.exchanged_auth_credential.oauth2.code_verifier is not None
+    )
+    assert any(
+        "client_secret is not set" in record.message
+        and "public-client" in record.message
+        for record in caplog.records
+    )
+
+    caplog.clear()
+    public_credential.oauth2.code_challenge_method = "S256"
+    with caplog.at_level("WARNING", logger="google_adk"):
+      handler.generate_auth_uri()
+    assert not caplog.records
+
   @patch("google.adk.auth.auth_handler.OAuth2Session")
   def test_generate_auth_uri_with_nonce(
       self, mock_oauth2_session, oauth2_auth_scheme, oauth2_credentials
@@ -545,7 +598,7 @@ def test_auth_uri_in_raw_credential(
     )
 
   def test_missing_client_credentials(self, oauth2_auth_scheme):
-    """Test when client_id or client_secret is missing."""
+    """Test when client_id is missing."""
     bad_credential = AuthCredential(
         auth_type=AuthCredentialTypes.OAUTH2,
         oauth2=OAuth2Auth(redirect_uri="https://example.com/callback"),
@@ -561,11 +614,37 @@ def test_missing_client_credentials(self, oauth2_auth_scheme):
     )
     handler = AuthHandler(config)
 
-    with pytest.raises(
-        ValueError, match="requires both client_id and client_secret"
-    ):
+    with pytest.raises(ValueError, match="requires client_id"):
       handler.generate_auth_request()
 
+  @patch("google.adk.auth.auth_handler.AuthHandler.generate_auth_uri")
+  def test_public_client_without_client_secret(
+      self, mock_generate_auth_uri, oauth2_auth_scheme
+  ):
+    """Public clients can start the auth request with client_id only."""
+    public_credential = AuthCredential(
+        auth_type=AuthCredentialTypes.OAUTH2,
+        oauth2=OAuth2Auth(
+            client_id="public-client",
+            redirect_uri="https://example.com/callback",
+        ),
+    )
+    mock_generate_auth_uri.return_value = public_credential.model_copy(
+        deep=True
+    )
+    config = AuthConfig(
+        auth_scheme=oauth2_auth_scheme,
+        raw_auth_credential=public_credential,
+        exchanged_auth_credential=public_credential.model_copy(deep=True),
+    )
+    handler = AuthHandler(config)
+
+    result = handler.generate_auth_request()
+
+    mock_generate_auth_uri.assert_called_once()
+    assert result.raw_auth_credential.oauth2.client_id == "public-client"
+    assert result.raw_auth_credential.oauth2.client_secret is None
+
   @patch("google.adk.auth.auth_handler.AuthHandler.generate_auth_uri")
   def test_generate_new_auth_uri(self, mock_generate_auth_uri, auth_config):
     """Test generating a new auth URI."""
@@ -774,6 +853,48 @@ def test_reattaches_configured_client_for_exchange(
     assert state[credential_key].oauth2.access_token == "mock_access_token"
     assert state[credential_key].oauth2.client_secret is None
 
+  @patch("google.adk.auth.oauth2_credential_util.OAuth2Session")
+  def test_get_auth_response_exchanges_public_client(
+      self, mock_oauth2_session, oauth2_auth_scheme
+  ):
+    """Public clients exchange an auth code with client_id only."""
+    public = AuthCredential(
+        auth_type=AuthCredentialTypes.OAUTH2,
+        oauth2=OAuth2Auth(
+            client_id="public-client",
+            redirect_uri="https://example.com/callback",
+        ),
+    )
+    stored = public.model_copy(deep=True)
+    
```

**File**: `tests/unittests/auth/test_oauth2_credential_util.py` (modified, +106/-4)
```diff
@@ -128,8 +128,8 @@ def test_create_oauth2_session_invalid_scheme(self):
     assert client is None
     assert token_endpoint is None
 
-  def test_create_oauth2_session_missing_credentials(self):
-    """Test create_oauth2_session with missing credentials."""
+  def test_create_oauth2_session_missing_client_id(self):
+    """Test create_oauth2_session with missing client_id."""
     scheme = OpenIdConnectWithConfig(
         type_="openIdConnect",
         openId_connect_url=(
@@ -142,8 +142,80 @@ def test_create_oauth2_session_missing_credentials(self):
     credential = AuthCredential(
         auth_type=AuthCredentialTypes.OPEN_ID_CONNECT,
         oauth2=OAuth2Auth(
-            client_id="test_client_id",
-            # Missing client_secret
+            client_secret="test_client_secret",
+        ),
+    )
+
+    client, token_endpoint = create_oauth2_session(scheme, credential)
+
+    assert client is None
+    assert token_endpoint is None
+
+  @pytest.mark.parametrize(
+      "token_endpoint_auth_method",
+      ["client_secret_basic", "client_secret_post", "client_secret_jwt"],
+  )
+  def test_create_oauth2_session_public_client_without_secret(
+      self, token_endpoint_auth_method, caplog
+  ):
+    """Public clients have a client_id and no client_secret."""
+    scheme = OpenIdConnectWithConfig(
+        type_="openIdConnect",
+        openId_connect_url=(
+            "https://example.com/.well-known/openid_configuration"
+        ),
+        authorization_endpoint="https://example.com/auth",
+        token_endpoint="https://example.com/token",
+        scopes=["openid"],
+    )
+    credential = AuthCredential(
+        auth_type=AuthCredentialTypes.OPEN_ID_CONNECT,
+        oauth2=OAuth2Auth(
+            client_id="public-client",
+            redirect_uri="https://app/cb",
+            token_endpoint_auth_method=token_endpoint_auth_method,
+        ),
+    )
+
+    with caplog.at_level("WARNING", logger="google_adk"):
+      client, token_endpoint = create_oauth2_session(scheme, credential)
+
+    assert client is not None
+    assert token_endpoint == "https://example.com/token"
+    assert client.client_id == "public-client"
+    assert client.client_secret is None
+    assert client.token_endpoint_auth_method == "none"
+    assert any(
+        "client_secret is not set" in record.message
+        and "public-client" in record.message
+        for record in caplog.records
+    )
+
+    caplog.clear()
+    credential.oauth2.code_challenge_method = "S256"
+    with caplog.at_level("WARNING", logger="google_adk"):
+      client, _ = create_oauth2_session(scheme, credential)
+    assert client is not None
+    assert client.token_endpoint_auth_method == "none"
+    assert not caplog.records
+
+  def test_create_oauth2_session_private_key_jwt_without_secret(self):
+    """private_key_jwt without client_secret returns None, None."""
+    scheme = OpenIdConnectWithConfig(
+        type_="openIdConnect",
+        openId_connect_url=(
+            "https://example.com/.well-known/openid_configuration"
+        ),
+        authorization_endpoint="https://example.com/auth",
+        token_endpoint="https://example.com/token",
+        scopes=["openid"],
+    )
+    credential = AuthCredential(
+        auth_type=AuthCredentialTypes.OPEN_ID_CONNECT,
+        oauth2=OAuth2Auth(
+            client_id="jwt-client",
+            redirect_uri="https://app/cb",
+            token_endpoint_auth_method="private_key_jwt",
         ),
     )
 
@@ -358,6 +430,36 @@ def test_refresh_request_omits_scope(self):
 
     assert "scope" not in captured["data"]
 
+  def test_public_client_refresh_without_authorization_header(self):
+    """Public client refresh requests omit the Authorization header."""
+    credential = AuthCredential(
+        auth_type=AuthCredentialTypes.OAUTH2,
+        oauth2=OAuth2Auth(
+            client_id="public-client",
+            redirect_uri="https://example.com/callback",
+        ),
+    )
+
+    client, token_endpoint = create_oauth2_session(
+        self._oauth2_scheme_with_scopes(), credential
+    )
+    assert client is not None
+
+    response = Mock()
+    response.status_code = 200
+    response.json.return_value = {
+        "access_token": "new_access_token",
+        "token_type": "Bearer",
+        "expires_in": 3600,
+        "refresh_token": "new_refresh_token",
+    }
+    client.send = Mock(return_value=response)
+    client.refresh_token(token_endpoint, refresh_token="old_refresh_token")
+
+    req = client.send.call_args[0][0]
+    assert "Authorization" not in req.headers
+    assert "client_id=public-client" in req.body
+
   def test_token_exchange_omits_scope(self):
     """Authorization-code exchange must not carry scope (it is redundant)."""
     credential = AuthCredential(
```

**File**: `tests/unittests/tools/openapi_tool/openapi_spec_parser/test_tool_auth_handler.py` (modified, +64/-2)
```diff
@@ -127,6 +127,68 @@ def openid_connect_credential():
   return credential
 
 
+@pytest.mark.asyncio
+async def test_openid_connect_public_client_without_secret(
+    openid_connect_scheme,
+):
+  public_credential = AuthCredential(
+      auth_type=AuthCredentialTypes.OPEN_ID_CONNECT,
+      oauth2=OAuth2Auth(
+          client_id='public-client',
+          redirect_uri='https://app/cb',
+      ),
+  )
+  tool_context = create_mock_tool_context()
+  handler = ToolAuthHandler(
+      tool_context,
+      openid_connect_scheme,
+      public_credential,
+  )
+  result = await handler.prepare_auth_credentials()
+  assert result.state == 'pending'
+  assert result.auth_credential == public_credential
+
+
+@pytest.mark.asyncio
+async def test_openid_connect_public_client_exchanges_auth_response(
+    openid_connect_scheme, monkeypatch
+):
+  public_credential = AuthCredential(
+      auth_type=AuthCredentialTypes.OPEN_ID_CONNECT,
+      oauth2=OAuth2Auth(
+          client_id='public-client',
+          redirect_uri='https://app/cb',
+      ),
+  )
+  stored = public_credential.model_copy(deep=True)
+  stored.oauth2.auth_code = 'public-auth-code'
+  stored.oauth2.auth_response_uri = 'https://app/cb?code=public-auth-code'
+
+  tool_context = create_mock_tool_context()
+  handler = ToolAuthHandler(
+      tool_context,
+      openid_connect_scheme,
+      public_credential,
+  )
+  auth_config = handler._build_auth_config()
+  tool_context.state['temp:' + auth_config.credential_key] = stored
+
+  mock_client = MagicMock()
+  mock_client.fetch_token.return_value = {
+      'access_token': 'public_access_token',
+      'token_type': 'bearer',
+  }
+  monkeypatch.setattr(
+      'google.adk.auth.oauth2_credential_util.OAuth2Session',
+      lambda *args, **kwargs: mock_client,
+  )
+
+  result = await handler.prepare_auth_credentials()
+  assert result.state == 'done'
+  assert result.auth_credential.auth_type == AuthCredentialTypes.HTTP
+  assert result.auth_credential.http.credentials.token == 'public_access_token'
+
+
 @pytest.mark.asyncio
 async def test_openid_connect_no_auth_response(
     openid_connect_scheme, openid_connect_credential
@@ -1153,7 +1215,7 @@ async def test_handle_unauthorized_error_returns_failed_when_reauth_impossible(
   tool_context = create_mock_tool_context()
   incomplete_credential = AuthCredential(
       auth_type=AuthCredentialTypes.OPEN_ID_CONNECT,
-      oauth2=OAuth2Auth(client_id='cid'),
+      oauth2=OAuth2Auth(),
   )
   handler = ToolAuthHandler.from_tool_context(
       tool_context=tool_context,
@@ -1172,7 +1234,7 @@ async def test_handle_unauthorized_error_returns_failed_when_reauth_impossible(
       ),
   )
 
-  # client_secret is missing, so _request_credential raises.
+  # client_id is missing, so _request_credential raises.
   recovery = await handler.handle_unauthorized_error()
   assert recovery == 'failed'
   assert not tool_context.actions.requested_auth_configs
```

**File**: `tests/unittests/workflow/utils/test_workflow_hitl_utils.py` (modified, +53/-1)
```diff
@@ -15,7 +15,13 @@
 from __future__ import annotations
 
 import json
+from unittest.mock import MagicMock
+from urllib.parse import parse_qs
+from urllib.parse import urlparse
 
+from authlib.oauth2.rfc6749 import OAuth2Token
+from authlib.oauth2.rfc7636 import create_s256_code_challenge
+from google.adk.auth.auth_handler import AuthHandler
 from google.adk.events.event import Event
 from google.adk.events.event import NodeInfo
 from google.adk.events.request_input import RequestInput
@@ -520,4 +526,50 @@ async def test_false_for_a_different_credential_key(self):
     assert has_auth_credential(other_config, state) is False
 
 
-#
+@pytest.mark.asyncio
+@pytest.mark.parametrize("serialize_state_to_json", [False, True])
+async def test_public_client_pkce_code_verifier_persisted_across_resume(
+    monkeypatch,
+    serialize_state_to_json: bool,
+):
+  """Public client PKCE code_verifier is preserved across request and resume."""
+  auth_config = _oauth_auth_config()
+  auth_config.raw_auth_credential.oauth2.client_secret = None
+  state = _empty_state()
+  event = create_auth_request_event(auth_config, "auth-id-1", state)
+
+  oauth2_args = event.content.parts[0].function_call.args["authConfig"][
+      "exchangedAuthCredential"
+  ]["oauth2"]
+  assert "codeVerifier" not in oauth2_args
+  auth_uri = oauth2_args["authUri"]
+  code_challenge = parse_qs(urlparse(auth_uri).query)["code_challenge"][0]
+
+  if serialize_state_to_json:
+    state["adk_oauth_credential:auth-id-1"] = state[
+        "adk_oauth_credential:auth-id-1"
+    ].model_dump(mode="json", by_alias=True)
+
+  mock_client = MagicMock()
+  mock_client.fetch_token.return_value = OAuth2Token(
+      {"access_token": "public_access_token"}
+  )
+  monkeypatch.setattr(
+      "google.adk.auth.oauth2_credential_util.OAuth2Session",
+      lambda *args, **kwargs: mock_client,
+  )
+
+  await process_auth_resume(
+      _oauth_resume_response(auth_config, _requested_state(event)),
+      auth_config,
+      state,
+      "auth-id-1",
+  )
+  cred = AuthHandler(auth_config).get_auth_response(state)
+
+  assert cred is not None
+  assert cred.oauth2.access_token == "public_access_token"
+  assert state["adk_oauth_credential:auth-id-1"] is None
+  verifier = mock_client.fetch_token.call_args.kwargs.get("code_verifier")
+  assert verifier is not None
+  assert create_s256_code_challenge(verifier) == code_challenge
```

---

### Incident Patch 2: `97f9379b` (2026-10-05)
**Commit Message**: fix(cli): restrict mutating /dev and agent builder endpoints to local clients by default

`DevServer`'s `/dev/.../builder/...` routes and mutating `/dev/...` routes
(test rebuild/run/PUT/DELETE, eval-set creation/update/delete/add-session/run,
and deploy endpoints) read and write files under `agents_dir`, execute local
tests/evals, or trigger deployments with no authentication. If a developer runs
`adk web --host 0.0.0.0` (for example inside a container or to preview the UI
from another device), any host that can reach the port can overwrite agent
files, mutate test/eval state, or run local workloads.

Require the caller to be a direct loopback peer (`127.0.0.1`, `::1`, or a Unix
domain socket) with no `Forwarded` / `X-Forwarded-For` / `X-Real-IP` headers on
the `/builder` endpoints and all mutating `/dev` routes, returning `403`
otherwise. Callers that intentionally expose these routes off-machine can set
`ADK_ALLOW_REMOTE_AGENT_BUILDER=1` to restore the previous behavior.

Co-authored-by: Yuhan Gao <[REDACTED_EMAIL]>
PiperOrigin-RevId: 993931649

**File**: `src/google/adk/cli/_dev_deploy.py` (modified, +7/-0)
```diff
@@ -42,6 +42,7 @@
 import abc
 import asyncio
 from collections.abc import AsyncIterator
+from collections.abc import Sequence
 from datetime import datetime
 import json
 import logging
@@ -901,6 +902,7 @@ def register_dev_deploy_endpoints(
     app: FastAPI,
     *,
     get_agent_dir: Callable[[str], str],
+    dependencies: Optional[Sequence[Any]] = None,
 ) -> None:
   """Registers the dev-only deploy endpoints on `app`.
 
@@ -910,6 +912,8 @@ def register_dev_deploy_endpoints(
       that escape the agents directory. `DevServer._get_agent_dir` passed in
       rather than the server itself, to keep this module free of a circular
       import.
+    dependencies: Optional FastAPI route dependencies applied to the mutating
+      deploy endpoints.
   """
 
   def _resolve_agent_dir(app_name: str) -> str:
@@ -986,6 +990,7 @@ async def get_deploy_defaults(app_name: str) -> DeployDefaults:
       "/dev/apps/{app_name}/deploy/agent_engine",
       tags=[TAG_DEPLOY],
       response_class=StreamingResponse,
+      dependencies=dependencies,
   )
   async def deploy_to_agent_engine(
       app_name: str,
@@ -1006,6 +1011,7 @@ async def deploy_to_agent_engine(
       "/dev/apps/{app_name}/deploy/cloud_run",
       tags=[TAG_DEPLOY],
       response_class=StreamingResponse,
+      dependencies=dependencies,
   )
   async def deploy_to_cloud_run(
       app_name: str,
@@ -1022,6 +1028,7 @@ async def deploy_to_cloud_run(
       "/dev/apps/{app_name}/deploy/gke",
       tags=[TAG_DEPLOY],
       response_class=StreamingResponse,
+      dependencies=dependencies,
   )
   async def deploy_to_gke(
       app_name: str,
```

**File**: `src/google/adk/cli/api_server.py` (modified, +27/-1)
```diff
@@ -180,7 +180,7 @@ def _strip_optional_quotes(value: str) -> str:
 
 
 def _get_scope_header(
-    scope: dict[str, Any], header_name: bytes
+    scope: Mapping[str, Any], header_name: bytes
 ) -> Optional[str]:
   """Return the first matching header value from an ASGI scope."""
   for candidate_name, candidate_value in scope.get("headers", []):
@@ -232,6 +232,32 @@ def _get_server_host(scope: dict[str, Any]) -> Optional[str]:
   return None
 
 
+_FORWARDING_HEADERS = (b"forwarded", b"x-forwarded-for", b"x-forwarded-host")
+
+
+def _is_local_client(scope: Mapping[str, Any]) -> bool:
+  """Return True if the request came straight from a process on this machine.
+
+  Header-based checks only constrain browsers: ``Origin``, ``Sec-Fetch-*`` and
+  custom headers are all trivially forged by a non-browser HTTP client, and
+  ``_OriginCheckMiddleware`` deliberately lets a request through when
+  ``Origin`` is absent so that non-browser API clients keep working. The peer
+  address of the connection is the one signal a remote caller cannot fake, so
+  it is what endpoints that must not be reachable over the network have to
+  use.
+
+  A request that arrived through a proxy or a tunnel is never treated as
+  local: the peer address is then the forwarder's rather than the caller's.
+  """
+  for header_name in _FORWARDING_HEADERS:
+    if _get_scope_header(scope, header_name) is not None:
+      return False
+  client = scope.get("client")
+  if not client or len(client) != 2:
+    return False
+  return _is_loopback_address(str(client[0]))
+
+
 def _get_request_origin(scope: dict[str, Any]) -> Optional[str]:
   """Compute the effective origin for the current HTTP/WebSocket request."""
   forwarded = _get_scope_header(scope, b"forwarded")
```

**File**: `src/google/adk/cli/dev_server.py` (modified, +89/-8)
```diff
@@ -14,7 +14,8 @@
 
 """Development server with all ADK endpoints.
 
-This module provides the DevServer class which extends ApiServer with development-only endpoints.
+This module provides the DevServer class which extends ApiServer with
+development-only endpoints.
 All production endpoints are inherited from ApiServer.
 All dev-only endpoints (eval, debug, graph, test management, deploy) are added by DevServer.
 
@@ -26,6 +27,11 @@
 evaluation and debugging code. This server is intended solely for local
 development on a trusted machine. Never expose it to an untrusted or public
 network, and never use it for a production or multi-user deployment.
+
+Mutating ``/dev`` endpoints (and the Agent Builder YAML readback) additionally
+reject callers that are not on the loopback interface, so that binding the
+server to a routable address does not by itself hand out write or code-execution
+access over the network. See ``_require_local_agent_builder_client``.
 """
 
 from __future__ import annotations
@@ -47,6 +53,7 @@
 from typing import Optional
 
 import anyio
+from fastapi import Depends
 from fastapi import FastAPI
 from fastapi import HTTPException
 from fastapi import Request as FastAPIRequest
@@ -83,6 +90,7 @@
 from ..utils._telemetry_config import read_telemetry_consent
 from ..utils._telemetry_config import write_telemetry_consent
 from ._dev_deploy import register_dev_deploy_endpoints
+from .api_server import _is_local_client
 from .api_server import ApiServer
 
 NESTED_APP_SEPARATOR = "."
@@ -103,6 +111,48 @@
 TAG_DEBUG = "Debug"
 TAG_EVALUATION = "Evaluation"
 
+_ALLOW_REMOTE_AGENT_BUILDER_ENV = "ADK_ALLOW_REMOTE_AGENT_BUILDER"
+_TRUTHY_ENV_VALUES = frozenset({"1", "true", "yes"})
+
+
+def _require_local_agent_builder_client(request: FastAPIRequest) -> None:
+  """Rejects mutating ``/dev`` and Agent Builder requests from remote callers.
+
+  Mutating ``/dev`` endpoints (and the Agent Builder YAML readback) read and
+  write files under ``agents_dir`` or spawn test, evaluation and deployment
+  runs, and like every other endpoint on this server, are unauthenticated. The
+  origin check in ``_OriginCheckMiddleware`` only stops a browser from being
+  used as a confused deputy; it lets a request through when ``Origin`` is
+  absent, so a non-browser client skips it just by omitting the header.
+  Restricting these endpoints to loopback peers is what keeps
+  ``adk web --host 0.0.0.0``, a forwarded container port or a tunnel from
+  handing anyone on the network access to them.
+
+  Args:
+    request: The incoming request.
+
+  Raises:
+    HTTPException: 403, if the caller is not on the loopback interface and
+      ``ADK_ALLOW_REMOTE_AGENT_BUILDER`` is not set.
+  """
+  if _is_local_client(request.scope):
+    return
+  if (
+      os.environ.get(_ALLOW_REMOTE_AGENT_BUILDER_ENV, "").strip().lower()
+      in _TRUTHY_ENV_VALUES
+  ):
+    return
+  raise HTTPException(
+      status_code=403,
+      detail=(
+          "This /dev endpoint only accepts requests from the machine running"
+          " the server. Set"
+          f" {_ALLOW_REMOTE_AGENT_BUILDER_ENV}=1 to allow remote access, and"
+          " only on a network you trust: these endpoints are unauthenticated"
+          " and write agent files to disk."
+      ),
+  )
+
 
 class CreateTestRequest(common.BaseModel):
   session_data: dict
@@ -750,7 +800,9 @@ def ensure_tmp_exists(app_name: str) -> bool:
       return True
 
     @app.post(
-        "/dev/apps/{app_name}/builder/save", response_model_exclude_none=True
+        "/dev/apps/{app_name}/builder/save",
+        response_model_exclude_none=True,
+        dependencies=[Depends(_require_local_agent_builder_client)],
     )
     async def builder_build(
         app_name: str, files: list[UploadFile], tmp: Optional[bool] = False
@@ -802,7 +854,9 @@ async def builder_build(
         return False
 
     @app.post(
-        "/dev/apps/{app_name}/builder/cancel", response_model_exclude_none=True
+        "/dev/apps/{app_name}/builder/cancel",
+        response_model_exclude_none=True,
+        dependencies=[Depends(_require_local_agent_builder_client)],
     )
     async def builder_cancel(app_name: str) -> bool:
       return cleanup_tmp(app_name)
@@ -811,6 +865,7 @@ async def builder_cancel(app_name: str) -> bool:
         "/dev/apps/{app_name}/builder",
         response_model_exclude_none=True,
         response_class=PlainTextResponse,
+        dependencies=[Depends(_require_local_agent_builder_client)],
     )
     async def get_agent_builder(
         app_name: str,
@@ -967,7 +1022,10 @@ async def list_tests(app_name: str) -> list[str]:
       test_files = glob.glob(pattern)
       return sorted([os.path.basename(f) for f in test_files])
 
-    @app.post("/dev/apps/{app_name}/tests/rebuild")
+    @app.post(
+        "/dev/apps/{app_name}/tests/rebuild",
+        dependencies=[Depends(_require_local_agent_builder_client)],
+    )
     async def rebuild_app_tests(
         app_name: 
```

**File**: `tests/unittests/cli/test_adk_web_server_tests.py` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ def test_client(tmp_path):
       host="127.0.0.1",
       port=8000,
   )
-  return TestClient(app)
+  return TestClient(app, client=("127.0.0.1", 51234))
 
 
 def test_list_tests_empty(test_client):
```

**File**: `tests/unittests/cli/test_fast_api.py` (modified, +172/-4)
```diff
@@ -570,7 +570,7 @@ def _create_test_client(
       ),
   ):
     app = get_fast_api_app(**defaults)
-    return TestClient(app)
+    return TestClient(app, client=("127.0.0.1", 51234))
 
 
 @pytest.mark.parametrize(
@@ -855,7 +855,7 @@ def test_app(
 
 
 @pytest.fixture
-def builder_test_client(
+def builder_test_app(
     tmp_path,
     mock_session_service,
     mock_artifact_service,
@@ -864,7 +864,7 @@ def builder_test_client(
     mock_eval_sets_manager,
     mock_eval_set_results_manager,
 ):
-  """Return a TestClient rooted in a temporary agents directory."""
+  """Return a dev-server app rooted in a temporary agents directory."""
   with (
       patch.object(signal, "signal", autospec=True, return_value=None),
       # Building the app adds tmp_path to sys.path; undo it for later tests.
@@ -924,7 +924,27 @@ def builder_test_client(
         bind_host="127.0.0.1",
         port=8000,
     )
-    return TestClient(app, base_url=_LOOPBACK_BASE_URL)
+    return app
+
+
+@pytest.fixture
+def builder_test_client(builder_test_app):
+  """A client that reaches the server from the machine it runs on."""
+  return TestClient(
+      builder_test_app,
+      base_url=_LOOPBACK_BASE_URL,
+      client=("127.0.0.1", 51234),
+  )
+
+
+@pytest.fixture
+def remote_builder_test_client(builder_test_app):
+  """A client that reaches the server from somewhere else on the network."""
+  return TestClient(
+      builder_test_app,
+      base_url=_LOOPBACK_BASE_URL,
+      client=("203.0.113.7", 51234),
+  )
 
 
 @pytest.fixture
@@ -4882,6 +4902,154 @@ def test_builder_get_allows_request_without_origin(builder_test_client):
   assert not response.text
 
 
+def test_builder_save_rejects_remote_client(
+    remote_builder_test_client, tmp_path
+):
+  """A non-browser client off-machine must not be able to write agent YAML."""
+  # Omitting the Origin header skips _OriginCheckMiddleware entirely, so the
+  # loopback check is the only thing between the network and agents_dir.
+  response = remote_builder_test_client.post(
+      "/dev/apps/app/builder/save",
+      files=[(
+          "files",
+          ("app/root_agent.yaml", b"name: pwned\n", "application/x-yaml"),
+      )],
+  )
+
+  assert response.status_code == 403
+  assert not (tmp_path / "app" / "root_agent.yaml").exists()
+
+
+def test_builder_get_rejects_remote_client(remote_builder_test_client):
+  """The YAML readback is a disclosure too, so it is gated the same way."""
+  response = remote_builder_test_client.get("/dev/apps/app/builder")
+
+  assert response.status_code == 403
+
+
+def test_builder_cancel_rejects_remote_client(remote_builder_test_client):
+  """Discarding another developer's draft is a remote write as well."""
+  response = remote_builder_test_client.post("/dev/apps/app/builder/cancel")
+
+  assert response.status_code == 403
+
+
+def test_builder_save_rejects_forwarded_loopback_client(
+    builder_test_client, tmp_path
+):
+  """Behind a proxy the peer is loopback but the caller is still remote."""
+  response = builder_test_client.post(
+      "/dev/apps/app/builder/save",
+      headers={"x-forwarded-for": "203.0.113.7"},
+      files=[(
+          "files",
+          ("app/root_agent.yaml", b"name: pwned\n", "application/x-yaml"),
+      )],
+  )
+
+  assert response.status_code == 403
+  assert not (tmp_path / "app" / "root_agent.yaml").exists()
+
+
+def test_builder_save_allows_remote_client_when_opted_in(
+    remote_builder_test_client, tmp_path, monkeypatch
+):
+  """Serving the builder off-machine stays possible, but has to be chosen."""
+  monkeypatch.setenv("ADK_ALLOW_REMOTE_AGENT_BUILDER", "1")
+
+  response = remote_builder_test_client.post(
+      "/dev/apps/app/builder/save",
+      files=[(
+          "files",
+          ("app/root_agent.yaml", b"name: app\n", "application/x-yaml"),
+      )],
+  )
+
+  assert response.status_code == 200
+  assert (tmp_path / "app" / "root_agent.yaml").is_file()
+
+
+def test_remote_client_can_still_reach_non_builder_endpoints(
+    remote_builder_test_client,
+):
+  """The gate is scoped to mutating /dev routes and builder readback."""
+  assert remote_builder_test_client.get("/list-apps").status_code == 200
+  assert (
+      remote_builder_test_client.get("/dev/apps/app/tests").status_code == 200
+  )
+  assert (
+      remote_builder_test_client.get("/dev/apps/app/eval-sets").status_code
+      == 200
+  )
+
+
+@pytest.mark.parametrize(
+    ("method", "path", "json_body"),
+    [
+        ("POST", "/dev/apps/app/tests/rebuild", None),
+        ("POST", "/dev/apps/app/tests/run", {}),
+        ("PUT", "/dev/apps/app/tests/test_smoke", {"content": "x = 1\n"}),
+        ("DELETE", "/dev/apps/app/tests/test_smoke", None),
+        ("POST", "/dev/apps/app/eval-sets", {"eval_set": {"eval_set_id": "s"}}),
+        ("POST", "/dev/apps/app/eval_sets/s", None),
+        (
+            "POST",
+            "/dev/apps/app/eval_sets/s/run_eval",
+            {"eval_ids": [], "eval_metrics": []},

```

**File**: `tests/unittests/cli/test_local_client_check.py` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+# Copyright 2026 Google LLC
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Tests for _is_local_client, the peer-address gate on the Agent Builder."""
+
+from typing import Any
+from typing import Optional
+
+from google.adk.cli.api_server import _is_local_client
+import pytest
+
+
+def _make_scope(
+    client: Optional[tuple[str, int]] = ("127.0.0.1", 51234),
+    headers: Optional[list[tuple[bytes, bytes]]] = None,
+) -> dict[str, Any]:
+  """Build a minimal ASGI scope for testing."""
+  scope: dict[str, Any] = {
+      "type": "http",
+      "method": "POST",
+      "headers": headers or [],
+  }
+  if client is not None:
+    scope["client"] = client
+  return scope
+
+
+class TestIsLocalClient:
+  """The peer address is the only signal a remote caller cannot forge."""
+
+  @pytest.mark.parametrize(
+      "client_host",
+      ["127.0.0.1", "127.1.2.3", "::1", "localhost"],
+  )
+  def test_loopback_peers_are_local(self, client_host: str):
+    assert _is_local_client(_make_scope(client=(client_host, 51234)))
+
+  @pytest.mark.parametrize(
+      "client_host",
+      ["203.0.113.7", "192.168.1.5", "10.0.0.1", "0.0.0.0", "evil.com"],
+  )
+  def test_remote_peers_are_not_local(self, client_host: str):
+    assert not _is_local_client(_make_scope(client=(client_host, 51234)))
+
+  def test_missing_client_is_not_local(self):
+    """ASGI servers may omit `client`; fail closed rather than open."""
+    assert not _is_local_client(_make_scope(client=None))
+
+  @pytest.mark.parametrize(
+      "header_name",
+      [b"forwarded", b"x-forwarded-for", b"x-forwarded-host"],
+  )
+  def test_forwarded_loopback_peer_is_not_local(self, header_name: bytes):
+    """Through a proxy or tunnel the peer is the forwarder, not the caller."""
+    scope = _make_scope(headers=[(header_name, b"203.0.113.7")])
+    assert not _is_local_client(scope)
+
+  def test_forged_origin_does_not_make_a_remote_peer_local(self):
+    """Any non-browser client can set Origin, so it must not be trusted here."""
+    scope = _make_scope(
+        client=("203.0.113.7", 51234),
+        headers=[(b"origin", b"http://127.0.0.1:8000")],
+    )
+    assert not _is_local_client(scope)
```

---

### Incident Patch 3: `5c540559` (2026-10-05)
**Commit Message**: fix: skip compaction instead of failing when summarization errors

A summarizer calls a model, so it fails for the ordinary transient reasons a
model call does, and that exception propagated out of both compaction paths
and ended the user's invocation. Compaction only shrinks a history that is
still usable in full, so a failure is now logged and the turn continues
uncompacted.

Co-authored-by: George Weale <[REDACTED_EMAIL]>
PiperOrigin-RevId: 993921524

**File**: `src/google/adk/apps/compaction.py` (modified, +17/-3)
```diff
@@ -19,6 +19,8 @@
 from typing import AsyncGenerator
 
 from google.genai import types
+from opentelemetry.trace import Status
+from opentelemetry.trace import StatusCode
 
 from ..events._rewind_events import _apply_rewinds
 from ..events.event import Event
@@ -59,9 +61,21 @@ async def _summarize_events_with_trace(
 
   with tracer.start_as_current_span(f'compact_events {trigger}') as span:
     span.set_attributes(attributes)
-    compaction_event = await config.summarizer.maybe_summarize_events(
-        events=events_to_compact
-    )
+    try:
+      compaction_event = await config.summarizer.maybe_summarize_events(
+          events=events_to_compact
+      )
+    except Exception as e:  # pylint: disable=broad-exception-caught
+      # The full history is still usable, so a failure must not end the turn.
+      # Nothing unwinds past the span, so without an explicit status it would
+      # be recorded as a successful compaction.
+      span.record_exception(e)
+      span.set_status(Status(StatusCode.ERROR, type(e).__name__))
+      logger.warning(
+          'Event compaction failed; continuing with the uncompacted history.',
+          exc_info=True,
+      )
+      return None
     span.set_attributes(_build_compaction_result_attributes(compaction_event))
     return compaction_event
 
```

**File**: `tests/unittests/apps/test_compaction.py` (modified, +79/-1)
```diff
@@ -39,20 +39,26 @@
 from opentelemetry.sdk.trace import TracerProvider
 from opentelemetry.sdk.trace.export import SimpleSpanProcessor
 from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
+from opentelemetry.trace import StatusCode
 from pydantic import ValidationError
 import pytest
 
 
 class _StubSummarizer(BaseEventsSummarizer):
 
-  def __init__(self, compacted_event: Event | None):
+  def __init__(
+      self, compacted_event: Event | None, error: Exception | None = None
+  ):
     self._compacted_event = compacted_event
+    self._error = error
     self.called_with_events = None
 
   async def maybe_summarize_events(
       self, *, events: list[Event]
   ) -> Event | None:
     self.called_with_events = events
+    if self._error is not None:
+      raise self._error
     return self._compacted_event
 
 
@@ -602,6 +608,33 @@ def test_latest_prompt_token_count_without_agent_name_uses_latest(self):
 
     self.assertEqual(token_count, 100)
 
+  async def test_summarizer_failure_does_not_end_the_invocation(self):
+    app = App(
+        name='test',
+        root_agent=Mock(spec=BaseAgent),
+        events_compaction_config=EventsCompactionConfig(
+            summarizer=self.mock_compactor,
+            compaction_interval=1,
+            overlap_size=0,
+        ),
+    )
+    session = Session(
+        app_name='test',
+        user_id='u1',
+        id='s1',
+        events=[
+            self._create_event(1.0, 'inv1', 'e1'),
+            self._create_event(2.0, 'inv2', 'e2'),
+        ],
+    )
+    self.mock_compactor.maybe_summarize_events.side_effect = RuntimeError(
+        'summarizer model is unavailable'
+    )
+
+    await self._run_sliding_window(app, session, self.mock_session_service)
+
+    self.mock_session_service.append_event.assert_not_called()
+
   async def test_run_compaction_for_token_threshold_keeps_retention_events(
       self,
   ):
@@ -2143,6 +2176,51 @@ async def test_run_compaction_for_sliding_window_adds_summary_trace(
   )
 
 
+@pytest.mark.asyncio
+async def test_summarizer_failure_marks_the_compaction_span_as_error(
+    span_exporter: InMemorySpanExporter,
+):
+  summarizer = _StubSummarizer(
+      None, error=RuntimeError('summarizer model is unavailable')
+  )
+  app = App(
+      name='test',
+      root_agent=Mock(spec=BaseAgent),
+      events_compaction_config=EventsCompactionConfig(
+          summarizer=summarizer,
+          compaction_interval=2,
+          overlap_size=1,
+      ),
+  )
+  session = Session(
+      app_name='test',
+      user_id='u1',
+      id='session-id',
+      events=[
+          _create_trace_test_event(
+              timestamp=1.0, invocation_id='inv1', text='e1'
+          ),
+          _create_trace_test_event(
+              timestamp=2.0, invocation_id='inv2', text='e2'
+          ),
+      ],
+  )
+  session_service = AsyncMock(spec=BaseSessionService)
+
+  async for _ in _run_compaction_for_sliding_window(
+      app, session, session_service
+  ):
+    pass
+
+  summary_span = next(
+      span
+      for span in span_exporter.get_finished_spans()
+      if span.name == 'compact_events sliding_window'
+  )
+  assert summary_span.status.status_code == StatusCode.ERROR
+  assert summary_span.status.description == 'RuntimeError'
+
+
 def test_count_chars_in_content():
   """Tests counting characters in Content objects."""
   # pylint: disable=protected-access
```

---

### Incident Patch 4: `25b8a181` (2026-10-05)
**Commit Message**: fix: isolate dev deploy log and staging paths per invocation

Append a unique identifier to dev deploy log and staging paths to prevent collisions when multiple deploys run within the same second or across parallel workers.

PiperOrigin-RevId: 993903285

**File**: `src/google/adk/cli/_dev_deploy.py` (modified, +2/-1)
```diff
@@ -55,6 +55,7 @@
 from typing import ClassVar
 from typing import Literal
 from typing import Optional
+import uuid
 
 from fastapi import FastAPI
 from fastapi import HTTPException
@@ -784,7 +785,7 @@ async def _spawn_deploy(
   would block forever once an undrained pipe buffer filled. A file has no such
   limit, and it leaves the full log behind for debugging.
   """
-  stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
+  stamp = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
   base = os.path.join(tempfile.gettempdir(), "adk_deploy")
   staging_dir = os.path.join(base, f"{app_name}_{request.target}_{stamp}")
   log_path = os.path.join(base, f"{app_name}_{request.target}_{stamp}.log")
```

**File**: `tests/unittests/cli/test_dev_deploy.py` (modified, +15/-0)
```diff
@@ -23,6 +23,7 @@
 
 import asyncio
 import contextlib
+from datetime import datetime
 import json
 import os
 import sys
@@ -631,6 +632,20 @@ def test_the_deploy_log_is_kept_for_debugging(client):
   assert os.path.exists(result['logPath'])
 
 
+def test_deploy_log_path_is_unique_per_invocation(client):
+  """Two deploys in the same second get distinct log and staging paths."""
+  fixed_time = datetime(2026, 1, 1, 12, 0, 0)
+  with patch.object(dev_deploy, 'datetime') as mock_dt:
+    mock_dt.now.return_value = fixed_time
+    result1 = deploy(
+        client, 'agent_engine', {'region': 'us-central1'}, 'print("1")'
+    )
+    result2 = deploy(
+        client, 'agent_engine', {'region': 'us-central1'}, 'print("2")'
+    )
+  assert result1['logPath'] != result2['logPath']
+
+
 # --- Endpoints ---------------------------------------------------------------
 
 
```

---

### Incident Patch 5: `1135d7ff` (2026-10-05)
**Commit Message**: fix: use the project backend when generating eval scenarios

Scenario generation is only served by the Vertex AI project backend, but an API key in the environment won the branch and built a client that failed with an AttributeError from inside the transport. The constructor now always uses the configured cloud project and location, and raises a ValueError naming whichever of the two is missing.

Co-authored-by: George Weale <[REDACTED_EMAIL]>
PiperOrigin-RevId: 993890978

**File**: `src/google/adk/evaluation/_vertex_ai_scenario_generation_facade.py` (modified, +11/-13)
```diff
@@ -50,22 +50,20 @@ class ScenarioGenerator:
   def __init__(self) -> None:
     project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
     location = os.environ.get("GOOGLE_CLOUD_LOCATION")
-    api_key = os.environ.get("GOOGLE_API_KEY")
-
-    if api_key:
-      self._client = vertexai.Client(api_key=api_key)
-    elif project_id or location:
-      if not project_id:
-        raise ValueError("Missing project id." + _ERROR_MESSAGE_SUFFIX)
-      if not location:
-        raise ValueError("Missing location." + _ERROR_MESSAGE_SUFFIX)
-      self._client = vertexai.Client(project=project_id, location=location)
-    else:
+
+    # Scenario generation is served only by the project backend, not API keys.
+    missing: list[str] = []
+    if not project_id:
+      missing.append("project id")
+    if not location:
+      missing.append("location")
+    if missing:
       raise ValueError(
-          "Either API Key or Google cloud Project id and location should be"
-          " specified."
+          "Missing " + " and ".join(missing) + "." + _ERROR_MESSAGE_SUFFIX
       )
 
+    self._client = vertexai.Client(project=project_id, location=location)
+
   def generate_scenarios(
       self,
       agent: base_agent.BaseAgent,
```

**File**: `tests/unittests/evaluation/test_vertex_ai_scenario_generation_facade.py` (modified, +26/-10)
```diff
@@ -30,16 +30,33 @@
 class TestScenarioGenerator:
   """Unit tests for ScenarioGenerator."""
 
-  def test_constructor_with_api_key(self, mocker):
+  def test_constructor_with_api_key_only_raises_error(self, mocker):
     mocker.patch.dict(
         os.environ, {"GOOGLE_API_KEY": "test_api_key"}, clear=True
     )
+    mocker.patch("google.adk.dependencies.vertexai.vertexai.Client")
+
+    with pytest.raises(ValueError, match="Missing project id and location."):
+      ScenarioGenerator()
+
+  def test_constructor_prefers_project_over_api_key(self, mocker):
+    mocker.patch.dict(
+        os.environ,
+        {
+            "GOOGLE_API_KEY": "test_api_key",
+            "GOOGLE_CLOUD_PROJECT": "test_project",
+            "GOOGLE_CLOUD_LOCATION": "test_location",
+        },
+        clear=True,
+    )
     mock_client_cls = mocker.patch(
         "google.adk.dependencies.vertexai.vertexai.Client"
     )
     ScenarioGenerator()
 
-    mock_client_cls.assert_called_once_with(api_key="test_api_key")
+    mock_client_cls.assert_called_once_with(
+        project="test_project", location="test_location"
+    )
 
   def test_constructor_with_project_and_location(self, mocker):
     """Test constructor with project and location in env."""
@@ -82,19 +99,18 @@ def test_constructor_with_no_env_vars_raises_error(self, mocker):
     mocker.patch.dict(os.environ, {}, clear=True)
     mocker.patch("google.adk.dependencies.vertexai.vertexai.Client")
 
-    with pytest.raises(
-        ValueError,
-        match=(
-            "Either API Key or Google cloud Project id and location should be"
-            " specified."
-        ),
-    ):
+    with pytest.raises(ValueError, match="Missing project id and location."):
       ScenarioGenerator()
 
   def test_generate_scenarios(self, mocker):
     """Test scenario generation with mocked components."""
     mocker.patch.dict(
-        os.environ, {"GOOGLE_API_KEY": "test_api_key"}, clear=True
+        os.environ,
+        {
+            "GOOGLE_CLOUD_PROJECT": "test_project",
+            "GOOGLE_CLOUD_LOCATION": "test_location",
+        },
+        clear=True,
     )
     mock_client_cls = mocker.patch(
         "google.adk.dependencies.vertexai.vertexai.Client"
```

---

### Incident Patch 6: `d0c40600` (2026-10-05)
**Commit Message**: fix!: take the ADK user id only from an authenticated principal

The A2A user id scopes the session, user-scoped state, artifacts and memory, but
it was read from the call context's user_name without checking
is_authenticated, so an auth layer that passes through a name it has not
verified would let a caller act as any user it named. The name is now used only
for an authenticated principal, so a deployment that relied on unverified names
moves to the existing A2A_USER_<context_id> fallback and logs a one-time warning
saying so.

Co-authored-by: George Weale <[REDACTED_EMAIL]>
PiperOrigin-RevId: 993862868

**File**: `src/google/adk/a2a/converters/request_converter.py` (modified, +28/-9)
```diff
@@ -15,6 +15,8 @@
 from __future__ import annotations
 
 from collections.abc import Callable
+import functools
+import logging
 from typing import Any
 from typing import Optional
 
@@ -28,6 +30,8 @@
 from .part_converter import A2APartToGenAIPartConverter
 from .part_converter import convert_a2a_part_to_genai_part
 
+logger = logging.getLogger('google_adk.' + __name__)
+
 A2A_METADATA_KEY = 'a2a_metadata'
 
 
@@ -65,18 +69,33 @@ class AgentRunRequest(BaseModel):
 
 
 def _get_user_id(request: RequestContext) -> str:
-  # Get user from call context if available (auth is enabled on a2a server)
-  if (
-      request.call_context
-      and request.call_context.user
-      and request.call_context.user.user_name
-  ):
-    return request.call_context.user.user_name
-
-  # Get user from context id
+  """Returns the ADK user id to run this request as.
+
+  The user id scopes the session, ``user:``-prefixed state, artifacts and
+  memory, so it is taken only from a principal the A2A server authenticated.
+  The name on an unauthenticated principal is a claim the caller made rather
+  than one the server checked, so it is ignored and the conversation is used as
+  an anonymous identity instead.
+  """
+  user = request.call_context.user if request.call_context else None
+  if user and user.user_name:
+    if user.is_authenticated:
+      return user.user_name
+    _warn_unauthenticated_user_name_once()
+
   return f'A2A_USER_{request.context_id}'
 
 
+@functools.lru_cache(maxsize=1)
+def _warn_unauthenticated_user_name_once() -> None:
+  logger.warning(
+      'Ignoring the user name of an unauthenticated A2A caller. Requests'
+      ' without an authenticated user run as A2A_USER_<context_id>, so'
+      ' sessions, state, artifacts and memory stored under an unverified name'
+      ' are no longer used.'
+  )
+
+
 @a2a_experimental
 def convert_a2a_request_to_agent_run_request(
     request: RequestContext,
```

**File**: `tests/unittests/a2a/converters/test_request_converter.py` (modified, +80/-0)
```diff
@@ -12,24 +12,40 @@
 # See the License for the specific language governing permissions and
 # limitations under the License.
 
+import logging
 from unittest.mock import Mock
 
+from a2a.auth.user import User
 from a2a.server.agent_execution import RequestContext
 from google.adk.a2a import _compat
 from google.adk.a2a.converters.request_converter import _get_user_id
+from google.adk.a2a.converters.request_converter import _warn_unauthenticated_user_name_once
 from google.adk.a2a.converters.request_converter import convert_a2a_request_to_agent_run_request
 from google.adk.runners import RunConfig
 from google.genai import types as genai_types
 import pytest
 
 
+class _UnverifiedUser(User):
+  """A principal an auth layer passed through with the caller's claimed name."""
+
+  @property
+  def is_authenticated(self) -> bool:
+    return False
+
+  @property
+  def user_name(self) -> str:
+    return "victim@example.com"
+
+
 class TestGetUserId:
   """Test cases for _get_user_id function."""
 
   def test_get_user_id_from_call_context(self):
     """Test getting user ID from call context when auth is enabled."""
     # Arrange
     mock_user = Mock()
+    mock_user.is_authenticated = True
     mock_user.user_name = "authenticated_user"
 
     mock_call_context = Mock()
@@ -125,6 +141,67 @@ def test_get_user_id_with_none_context_id(self):
     # Assert
     assert result == "A2A_USER_None"
 
+  def test_get_user_id_ignores_unauthenticated_user_name(self):
+    """Test that an unverified principal's name is not used as the user ID."""
+    # Arrange
+    mock_call_context = Mock()
+    mock_call_context.user = _UnverifiedUser()
+
+    request = Mock(spec=RequestContext)
+    request.call_context = mock_call_context
+    request.context_id = "test_context"
+
+    # Act
+    result = _get_user_id(request)
+
+    # Assert
+    assert result == "A2A_USER_test_context"
+
+  def test_get_user_id_warns_once_about_unauthenticated_user_name(self, caplog):
+    """Test that an ignored name is logged once and the name is not logged."""
+    # Arrange
+    mock_call_context = Mock()
+    mock_call_context.user = _UnverifiedUser()
+
+    request = Mock(spec=RequestContext)
+    request.call_context = mock_call_context
+    request.context_id = "test_context"
+    _warn_unauthenticated_user_name_once.cache_clear()
+
+    # Act
+    with caplog.at_level(logging.WARNING, logger="google_adk"):
+      _get_user_id(request)
+      _get_user_id(request)
+
+    # Assert
+    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
+    assert len(warnings) == 1
+    assert "unauthenticated A2A caller" in warnings[0].getMessage()
+    assert "victim@example.com" not in caplog.text
+
+  def test_get_user_id_does_not_warn_for_authenticated_user(self, caplog):
+    """Test that an authenticated principal is used without a warning."""
+    # Arrange
+    mock_user = Mock()
+    mock_user.is_authenticated = True
+    mock_user.user_name = "authenticated_user"
+
+    mock_call_context = Mock()
+    mock_call_context.user = mock_user
+
+    request = Mock(spec=RequestContext)
+    request.call_context = mock_call_context
+    request.context_id = "test_context"
+    _warn_unauthenticated_user_name_once.cache_clear()
+
+    # Act
+    with caplog.at_level(logging.WARNING, logger="google_adk"):
+      result = _get_user_id(request)
+
+    # Assert
+    assert result == "authenticated_user"
+    assert not caplog.records
+
 
 class TestConvertA2aRequestToAgentRunRequest:
   """Test cases for convert_a2a_request_to_agent_run_request function."""
@@ -139,6 +216,7 @@ def test_convert_a2a_request_basic(self):
     mock_message.parts = [mock_part1, mock_part2]
 
     mock_user = Mock()
+    mock_user.is_authenticated = True
     mock_user.user_name = "test_user"
 
     mock_call_context = Mock()
@@ -188,6 +266,7 @@ def test_convert_a2a_request_multiple_parts(self):
     mock_message.parts = [mock_part1, mock_part2]
 
     mock_user = Mock()
+    mock_user.is_authenticated = True
     mock_user.user_name = "test_user"
 
     mock_call_context = Mock()
@@ -390,6 +469,7 @@ def test_end_to_end_conversion_with_auth_user(self):
     """Test end-to-end conversion with authenticated user."""
     # Arrange
     mock_user = Mock()
+    mock_user.is_authenticated = True
     mock_user.user_name = "auth_user"
 
     mock_call_context = Mock()
```

---

### Incident Patch 7: `9311d6f5` (2026-10-05)
**Commit Message**: fix: use card descriptions for initial routing

Merge https://github.com/google/adk-python/pull/6694

Resolves the remote agent card description before initial selection so the parent LLM can use it for routing decisions.

Fixes #4064

PiperOrigin-RevId: 993862196

**File**: `src/google/adk/a2a/agent/_remote_a2a_agent.py` (modified, +102/-7)
```diff
@@ -918,6 +918,11 @@ async def _resolve_agent_card_from_url(
       http_kwargs = await execute_before_card_request_interceptors(
           self._config.card_request_interceptors, ctx
       )
+      if http_kwargs is None:
+        http_kwargs = {}
+      if self._httpx_client_needs_cleanup and "timeout" not in http_kwargs:
+        http_kwargs["timeout"] = self._timeout
+
       return await resolver.get_agent_card(
           relative_card_path=relative_card_path,
           http_kwargs=http_kwargs,
@@ -952,6 +957,13 @@ async def _resolve_agent_card(
       self, ctx: Optional[InvocationContext] = None
   ) -> AgentCard:
     """Resolve agent card from source."""
+    if ctx is not None:
+      cache_key = f"_remote_a2a_card_{self.name}"
+      metadata = getattr(ctx, "_private_metadata", None)
+      if isinstance(metadata, dict) and cache_key in metadata:
+        cached_card: AgentCard = metadata[cache_key]
+        return cached_card
+
     agent_card_source = self._agent_card_source
     if agent_card_source is None:
       raise AgentCardResolutionError("No agent card source was configured.")
@@ -971,9 +983,24 @@ async def _resolve_agent_card(
             "Agent card URL must use https, or http on a loopback host:"
             f" {agent_card_source}"
         )
-      return await self._resolve_agent_card_from_url(agent_card_source, ctx)
+      card = await self._resolve_agent_card_from_url(agent_card_source, ctx)
     else:
-      return await self._resolve_agent_card_from_file(agent_card_source)
+      card = await self._resolve_agent_card_from_file(agent_card_source)
+    if ctx is not None:
+      cred_by_key = getattr(ctx, "credential_by_key", None)
+      has_unresolved_auth = bool(
+          self._auth_config
+          and self._auth_config.credential_key
+          and (
+              not isinstance(cred_by_key, dict)
+              or not cred_by_key.get(self._auth_config.credential_key)
+          )
+      )
+      if not has_unresolved_auth:
+        metadata = getattr(ctx, "_private_metadata", None)
+        if isinstance(metadata, dict):
+          metadata[cache_key] = card
+    return card
 
   async def _validate_agent_card(self, agent_card: AgentCard) -> None:
     """Validate resolved agent card."""
@@ -995,6 +1022,62 @@ async def _validate_agent_card(self, agent_card: AgentCard) -> None:
 
     self._validate_card_rpc_targets(agent_card)
 
+  async def _get_transfer_description(self, ctx: InvocationContext) -> str:
+    """Returns local or agent-card metadata for transfer selection."""
+    if self.description:
+      return self.description
+
+    if self._agent_card:
+      return (
+          _adopted_card_description(
+              self._agent_card.description, self._agent_card_source
+          )
+          if self._agent_card.description
+          else ""
+      )
+
+    agent_ctx = ctx.model_copy(update={"agent": self})
+    if self._auth_config:
+      credential_key = self._auth_config.credential_key
+      cred_by_key = getattr(ctx, "credential_by_key", None)
+      if credential_key and (
+          not isinstance(cred_by_key, dict)
+          or not cred_by_key.get(credential_key)
+      ):
+        prev_end_invocation = ctx.end_invocation
+        try:
+          auth_event = await self._resolve_auth_credential(agent_ctx)
+          cred_by_key = getattr(ctx, "credential_by_key", None)
+          if (
+              auth_event is not None
+              or not isinstance(cred_by_key, dict)
+              or not cred_by_key.get(credential_key)
+          ):
+            return self.description or ""
+        finally:
+          ctx.end_invocation = prev_end_invocation
+          agent_ctx.end_invocation = prev_end_invocation
+
+    agent_card = await self._resolve_agent_card(agent_ctx)
+    await self._validate_agent_card(agent_card)
+
+    # Public cards are shared across invocations, matching the existing client
+    # cache. Authenticated cards remain invocation-scoped because their metadata
+    # may vary by session.
+    per_invocation_card = bool(
+        self._config.card_request_interceptors
+        and self._agent_card_source
+        and self._agent_card_source.startswith(("http://", "https://"))
+    )
+    if not per_invocation_card:
+      self._agent_card = agent_card
+
+    if agent_card.description:
+      return _adopted_card_description(
+          agent_card.description, self._agent_card_source
+      )
+    return ""
+
   def _validate_card_rpc_targets(self, agent_card: AgentCard) -> None:
     """Constrains where a card fetched over the network may aim RPC traffic.
 
@@ -1059,6 +1142,7 @@ async def _ensure_resolved(
     per_invocation_card = bool(
         self._config.card_request_interceptors
         and self._agent_card_source
+        and self._agent_card_source.startswith(("http://", "https://"))
         and ctx is not None
     )
 
@@ -1067,6 +1151,13 @@ async def _ensure_resolved(
 
     try:
       if per_invocation_card:
+  
```

**File**: `src/google/adk/agents/invocation_context.py` (modified, +3/-0)
```diff
@@ -282,6 +282,9 @@ class InvocationContext(BaseModel):
   _custom_metadata: dict[str, Any] = PrivateAttr(default_factory=dict)
   """Custom metadata for attaching low-level execution telemetry."""
 
+  _private_metadata: dict[str, Any] = PrivateAttr(default_factory=dict)
+  """Private metadata for internal caching, not exposed to user code."""
+
   _invocation_cost_manager: _InvocationCostManager = PrivateAttr(
       default_factory=_InvocationCostManager
   )
```

**File**: `src/google/adk/flows/llm_flows/extensions/_agent_transfer.py` (modified, +66/-8)
```diff
@@ -16,6 +16,8 @@
 
 from __future__ import annotations
 
+import asyncio
+import logging
 import typing
 from typing import AsyncGenerator
 from typing import Sequence
@@ -35,6 +37,9 @@
   from ....agents.llm_agent import LlmAgent
 
 
+logger = logging.getLogger('google_adk.' + __name__)
+
+
 class _AgentTransferLlmRequestProcessor(BaseLlmRequestProcessor):
   """Agent transfer request processor."""
 
@@ -58,13 +63,19 @@ async def run_async(
 
     transfer_to_agent_tool = _build_transfer_tool(transfer_targets)
 
-    llm_request.append_instructions([
-        _build_transfer_instructions(
-            transfer_to_agent_tool.name,
-            agent,
-            transfer_targets,
-        )
-    ])
+    if agent.mode not in ('task', 'single_turn'):
+      transfer_target_infos = await asyncio.gather(*[
+          _build_transfer_target_info(target, invocation_context)
+          for target in transfer_targets
+      ])
+
+      llm_request.append_instructions([
+          _build_transfer_instructions(
+              transfer_to_agent_tool.name,
+              agent,
+              transfer_target_infos,
+          )
+      ])
 
     tool_context = ToolContext(invocation_context)
     await transfer_to_agent_tool.process_llm_request(
@@ -83,6 +94,53 @@ class _AgentLike(typing.Protocol):
   description: str
 
 
+class _TransferTargetInfo:
+  """Invocation-scoped metadata used to build transfer instructions."""
+
+  def __init__(self, *, name: str, description: str) -> None:
+    self.name = name
+    self.description = description
+
+
+async def _build_transfer_target_info(
+    target_agent: BaseAgent,
+    ctx: InvocationContext,
+) -> _TransferTargetInfo:
+  """Builds transfer metadata without mutating invocation-scoped values."""
+  cache_key = f'_transfer_target_info_{target_agent.name}'
+  metadata = getattr(ctx, '_private_metadata', None)
+  if isinstance(metadata, dict) and cache_key in metadata:
+    cached = metadata[cache_key]
+    if isinstance(cached, _TransferTargetInfo):
+      return cached
+
+  get_transfer_description = getattr(
+      target_agent, '_get_transfer_description', None
+  )
+  if callable(get_transfer_description):
+    try:
+      description = await asyncio.wait_for(
+          get_transfer_description(ctx), timeout=5.0
+      )
+    except Exception as e:
+      logger.warning(
+          'Failed to load transfer description for agent %s: %s',
+          target_agent.name,
+          e,
+      )
+      description = target_agent.description
+  else:
+    description = target_agent.description
+
+  info = _TransferTargetInfo(
+      name=target_agent.name,
+      description=description,
+  )
+  if isinstance(metadata, dict):
+    metadata[cache_key] = info
+  return info
+
+
 def _build_target_agents_info(target_agent: _AgentLike) -> str:
   return f"""
 Agent name: {target_agent.name}
@@ -138,7 +196,7 @@ def _build_transfer_instruction_body(
 def _build_transfer_instructions(
     tool_name: str,
     agent: LlmAgent,
-    target_agents: Sequence[BaseAgent],
+    target_agents: Sequence[_AgentLike],
 ) -> str:
   """Build instructions for agent transfer (agent-tree variant).
 
```

**File**: `tests/unittests/a2a/agent/test_remote_a2a_agent.py` (modified, +166/-3)
```diff
@@ -535,9 +535,68 @@ async def test_resolve_agent_card_from_url_success(self):
             httpx_client=mock_client, base_url="https://example.com"
         )
         mock_resolver.get_agent_card.assert_called_once_with(
-            relative_card_path="/agent.json", http_kwargs=None
+            relative_card_path="/agent.json",
+            http_kwargs={"timeout": remote_a2a_agent.DEFAULT_TIMEOUT},
         )
 
+  @pytest.mark.asyncio
+  async def test_resolve_agent_card_from_url_uses_configured_timeout(self):
+    """Test that configured timeout is used for card resolution."""
+    agent = RemoteA2aAgent(
+        name="test_agent",
+        agent_card="https://example.com/agent.json",
+        timeout=15.0,
+    )
+
+    with patch.object(agent, "_ensure_httpx_client") as mock_ensure_client:
+      mock_client = AsyncMock()
+      mock_ensure_client.return_value = mock_client
+
+      with patch(
+          "google.adk.a2a.agent._remote_a2a_agent.A2ACardResolver"
+      ) as mock_resolver_class:
+        mock_resolver = AsyncMock()
+        mock_resolver.get_agent_card.return_value = self.agent_card
+        mock_resolver_class.return_value = mock_resolver
+
+        result = await agent._resolve_agent_card_from_url(
+            "https://example.com/agent.json", Mock()
+        )
+
+        assert result == self.agent_card
+        mock_resolver.get_agent_card.assert_called_once_with(
+            relative_card_path="/agent.json", http_kwargs={"timeout": 15.0}
+        )
+
+  @pytest.mark.asyncio
+  async def test_resolve_agent_card_from_url_with_shared_client_does_not_inject_timeout(
+      self,
+  ):
+    """Test that timeout is not injected when using a shared client."""
+    shared_client = httpx.AsyncClient()
+    agent = RemoteA2aAgent(
+        name="test_agent",
+        agent_card="https://example.com/agent.json",
+        httpx_client=shared_client,
+    )
+
+    with patch(
+        "google.adk.a2a.agent._remote_a2a_agent.A2ACardResolver"
+    ) as mock_resolver_class:
+      mock_resolver = AsyncMock()
+      mock_resolver.get_agent_card.return_value = self.agent_card
+      mock_resolver_class.return_value = mock_resolver
+
+      result = await agent._resolve_agent_card_from_url(
+          "https://example.com/agent.json", Mock()
+      )
+
+      assert result == self.agent_card
+      mock_resolver.get_agent_card.assert_called_once_with(
+          relative_card_path="/agent.json",
+          http_kwargs={},
+      )
+
   @pytest.mark.asyncio
   async def test_resolve_agent_card_from_url_invalid_url(self):
     """Test agent card resolution from invalid URL raises error."""
@@ -632,7 +691,10 @@ async def provider(ctx):
 
     mock_resolver.get_agent_card.assert_called_once_with(
         relative_card_path="/agent.json",
-        http_kwargs={"headers": {"Authorization": "Bearer abc"}},
+        http_kwargs={
+            "headers": {"Authorization": "Bearer abc"},
+            "timeout": remote_a2a_agent.DEFAULT_TIMEOUT,
+        },
     )
 
   @pytest.mark.asyncio
@@ -671,7 +733,10 @@ async def provider_b(ctx):
 
     mock_resolver.get_agent_card.assert_called_once_with(
         relative_card_path="/agent.json",
-        http_kwargs={"headers": {"X-Common": "b", "X-A": "1", "X-B": "2"}},
+        http_kwargs={
+            "headers": {"X-Common": "b", "X-A": "1", "X-B": "2"},
+            "timeout": remote_a2a_agent.DEFAULT_TIMEOUT,
+        },
     )
 
   @pytest.mark.asyncio
@@ -711,6 +776,68 @@ async def test_ensure_resolved_refetches_card_when_interceptor_set(self):
     assert agent._a2a_client is None
     assert agent._is_resolved is False
 
+  @pytest.mark.asyncio
+  async def test_ensure_resolved_caches_card_per_invocation_with_interceptor(
+      self,
+  ):
+    """With a card interceptor, the card is resolved only once per invocation."""
+    provider = AsyncMock(
+        return_value=A2aCardRequestConfig(headers={"Authorization": "Bearer x"})
+    )
+    agent = RemoteA2aAgent(
+        name="test_agent",
+        agent_card="https://example.com/agent.json",
+        config=A2aRemoteAgentConfig(
+            card_request_interceptors=[
+                CardRequestInterceptor(before_request=provider)
+            ]
+        ),
+    )
+
+    ctx = Mock(spec=InvocationContext)
+    ctx._private_metadata = {}
+
+    with patch.object(
+        agent, "_resolve_agent_card_from_url", new_callable=AsyncMock
+    ) as mock_resolve_url:
+      mock_resolve_url.return_value = self.agent_card
+      with patch.object(agent, "_ensure_httpx_client") as mock_ensure:
+        mock_ensure.return_value = AsyncMock()
+        mock_factory = Mock()
+        mock_factory.create.return_value = Mock()
+        agent._a2a_client_factory = mock_factory
+
+        client1 = await agent._ensure_resolved(ctx)
+        client2 = await agent._ensure_resolved(ctx)
+
+    assert mock_resolve_url.await_count == 1
+    assert mock_factory.create.call_count == 1
+    assert client1 is client2
+    a
```

**File**: `tests/unittests/agents/test_invocation_context.py` (modified, +10/-0)
```diff
@@ -514,6 +514,16 @@ def test_custom_metadata_default_empty(self):
     )
     assert inv_ctx._custom_metadata == {}
 
+  def test_private_metadata_default_empty(self):
+    """Tests that _private_metadata is empty by default."""
+    inv_ctx = InvocationContext(
+        session_service=Mock(spec=BaseSessionService),
+        agent=Mock(spec=BaseAgent),
+        invocation_id='inv_1',
+        session=Mock(spec=Session, events=[]),
+    )
+    assert inv_ctx._private_metadata == {}
+
   def test_custom_metadata_empty_run_config(self):
     """Tests that _custom_metadata is empty when RunConfig has no custom_metadata."""
     run_cfg = RunConfig()
```

**File**: `tests/unittests/flows/llm_flows/extensions/test_agent_transfer_system_instructions.py` (modified, +548/-0)
```diff
@@ -19,13 +19,24 @@
 implementation.
 """
 
+import asyncio
+from typing import Any
 from typing import AsyncGenerator
+from unittest.mock import AsyncMock
+from unittest.mock import Mock
+from unittest.mock import patch
 
+from google.adk.a2a.agent.config import A2aCardRequestConfig
+from google.adk.a2a.agent.config import A2aRemoteAgentConfig
+from google.adk.a2a.agent.config import CardRequestInterceptor
 from google.adk.agents.base_agent import BaseAgent
 from google.adk.agents.invocation_context import InvocationContext
 from google.adk.agents.llm_agent import Agent
+from google.adk.agents.remote_a2a_agent import RemoteA2aAgent
 from google.adk.artifacts.in_memory_artifact_service import InMemoryArtifactService
 from google.adk.events.event import Event
+from google.adk.flows.llm_flows.context._fencing import QUOTED_CONTENT_BEGIN
+from google.adk.flows.llm_flows.context._fencing import QUOTED_CONTENT_END
 from google.adk.flows.llm_flows.extensions import _agent_transfer as agent_transfer
 from google.adk.memory.in_memory_memory_service import InMemoryMemoryService
 from google.adk.models.llm_request import LlmRequest
@@ -342,3 +353,540 @@ async def test_agent_transfer_with_non_llm_peer_agent():
 
   instructions = llm_request.config.system_instruction
   assert 'non_llm_peer' in instructions
+
+
+def _make_agent_card(description: str) -> Any:
+  iface = Mock(url='https://example.com/rpc', protocol_binding='JSONRPC')
+  return Mock(
+      description=description,
+      supported_interfaces=[iface],
+      additional_interfaces=[],
+      url='https://example.com/rpc',
+  )
+
+
+@pytest.mark.asyncio
+async def test_agent_transfer_uses_configured_description_before_fetching_remote_card():
+  """If remote agent has local description, it is used without fetching card."""
+  mock_model = testing_utils.MockModel.create(responses=[])
+  remote_agent = RemoteA2aAgent(
+      name='remote_agent',
+      agent_card='https://example.com/agent-card.json',
+      description='Locally configured routing description.',
+  )
+  main_agent = Agent(
+      name='main_agent',
+      model=mock_model,
+      sub_agents=[remote_agent],
+  )
+  invocation_context = await create_test_invocation_context(main_agent)
+  llm_request = LlmRequest()
+
+  with patch.object(
+      remote_agent, '_resolve_agent_card', new_callable=AsyncMock
+  ) as resolve_card:
+    async for _ in agent_transfer.request_processor.run_async(
+        invocation_context, llm_request
+    ):
+      pass
+
+  instructions = llm_request.config.system_instruction
+  assert (
+      'Agent description: Locally configured routing description.'
+      in instructions
+  )
+  resolve_card.assert_not_awaited()
+
+
+@pytest.mark.asyncio
+async def test_agent_transfer_keeps_authenticated_descriptions_per_invocation():
+  """Authenticated card descriptions do not leak between invocations."""
+  mock_model = testing_utils.MockModel.create(responses=[])
+  remote_agent = RemoteA2aAgent(
+      name='remote_agent',
+      agent_card='https://example.com/agent-card.json',
+      config=A2aRemoteAgentConfig(
+          card_request_interceptors=[CardRequestInterceptor()]
+      ),
+  )
+  main_agent = Agent(
+      name='main_agent',
+      model=mock_model,
+      sub_agents=[remote_agent],
+  )
+  first_context = await create_test_invocation_context(main_agent)
+  second_context = await create_test_invocation_context(main_agent)
+  first_request = LlmRequest()
+  second_request = LlmRequest()
+
+  with patch.object(
+      remote_agent,
+      '_resolve_agent_card',
+      new=AsyncMock(
+          side_effect=[
+              _make_agent_card('First session description.'),
+              _make_agent_card('Second session description.'),
+          ]
+      ),
+  ):
+    async for _ in agent_transfer.request_processor.run_async(
+        first_context, first_request
+    ):
+      pass
+    async for _ in agent_transfer.request_processor.run_async(
+        second_context, second_request
+    ):
+      pass
+
+  first_instructions = first_request.config.system_instruction
+  second_instructions = second_request.config.system_instruction
+  first_fenced = (
+      f'{QUOTED_CONTENT_BEGIN}\nFirst session'
+      f' description.\n{QUOTED_CONTENT_END}'
+  )
+  second_fenced = (
+      f'{QUOTED_CONTENT_BEGIN}\nSecond session'
+      f' description.\n{QUOTED_CONTENT_END}'
+  )
+  assert first_fenced in first_instructions
+  assert second_fenced not in first_instructions
+  assert second_fenced in second_instructions
+  assert first_fenced not in second_instructions
+  assert remote_agent.description == ''
+
+
+@pytest.mark.asyncio
+async def test_agent_transfer_continues_when_remote_card_is_unavailable(caplog):
+  """An unavailable remote card does not block the parent model request."""
+  mock_model = testing_utils.MockModel.create(responses=[])
+  remote_agent = RemoteA2aAgent(
+      name='remote_agent',
+      agent_card='https://example.com/agent-card.json',
+  )
+
```

---

### Incident Patch 8: `ec7756b9` (2026-10-05)
**Commit Message**: fix: warn when the dev server binds a non-loopback address

The web and API servers authenticate nothing, so any client that can reach one can read, change, or delete another user's sessions and artifacts by editing the user ID in the request path. This logs a warning at startup whenever the app is told it will bind a non-loopback address, so an operator putting it on a network learns it must not face untrusted clients.

Co-authored-by: George Weale <[REDACTED_EMAIL]>
PiperOrigin-RevId: 993851171

**File**: `src/google/adk/cli/fast_api.py` (modified, +12/-1)
```diff
@@ -168,7 +168,9 @@ def get_fast_api_app(
       returned app; pass ``bind_host`` to guard it.
     bind_host: The address the caller will bind the returned app to. A loopback
       value turns on DNS-rebinding protection, which rejects requests addressed
-      to any other host. Leave it None to serve the app yourself without that.
+      to any other host. A non-loopback value logs a startup warning that the
+      app has no authentication. Leave it None to serve the app yourself
+      without either.
     port: Port number for the server (defaults to 8000).
     url_prefix: Optional prefix for all URL routes.
     trace_to_cloud: Whether to export traces to Google Cloud Trace.
@@ -206,6 +208,15 @@ def get_fast_api_app(
     The configured FastAPI application instance.
   """
 
+  if bind_host is not None and not _is_loopback_address(bind_host):
+    logger.warning(
+        "ADK server is binding to a non-loopback address (%s) and has no"
+        " authentication: any client that can reach it can read, modify, and"
+        " delete any user's sessions and artifacts. Do not expose it to"
+        " untrusted networks without an authenticating proxy.",
+        bind_host,
+    )
+
   # Enable the YAML key denylist for config loads if the web UI is enabled.
   if web:
     from ..agents import config_agent_utils
```

**File**: `tests/unittests/cli/test_fast_api.py` (modified, +41/-0)
```diff
@@ -573,6 +573,47 @@ def _create_test_client(
     return TestClient(app)
 
 
+@pytest.mark.parametrize(
+    "bind_host, expect_warning",
+    [
+        (None, False),
+        ("127.0.0.1", False),
+        ("localhost", False),
+        ("::1", False),
+        ("0.0.0.0", True),
+        ("::", True),
+        ("192.168.1.10", True),
+    ],
+)
+def test_no_auth_warning_on_non_loopback_bind(
+    bind_host,
+    expect_warning,
+    mock_session_service,
+    mock_artifact_service,
+    mock_memory_service,
+    mock_agent_loader,
+    mock_eval_sets_manager,
+    mock_eval_set_results_manager,
+    caplog,
+):
+  """Warns about missing auth only when bound to a reachable (non-loopback) address."""
+  with caplog.at_level(logging.WARNING):
+    _create_test_client(
+        mock_session_service,
+        mock_artifact_service,
+        mock_memory_service,
+        mock_agent_loader,
+        mock_eval_sets_manager,
+        mock_eval_set_results_manager,
+        bind_host=bind_host,
+    )
+  warned = any(
+      "has no authentication" in record.getMessage()
+      for record in caplog.records
+  )
+  assert warned is expect_warning
+
+
 def test_agent_with_bigquery_analytics_plugin(
     tmp_path,
     mock_session_service,
```

---

### Incident Patch 9: `e896ecbb` (2026-10-05)
**Commit Message**: fix: give failed migrations and deploy usage errors the right exit code

adk migrate session printed its failure and still exited 0, so a CI pipeline treated a failed migration as success, and the deploy commands reported click's own usage errors as a generic deploy failure with exit code 1. A failed migration now exits 1 after printing the error, and the deploy commands re-raise click exceptions so a usage error keeps click's usage message and exit code 2.

Co-authored-by: George Weale <[REDACTED_EMAIL]>
PiperOrigin-RevId: 993845697

**File**: `src/google/adk/cli/cli_tools_click.py` (modified, +9/-0)
```diff
@@ -2608,6 +2608,8 @@ def cli_deploy_cloud_run(
         extra_gcloud_args=tuple(gcloud_args),
         with_cloud_run_sandbox=with_cloud_run_sandbox,
     )
+  except (click.ClickException, click.Abort):
+    raise
   except Exception as e:
     click.secho(f"Deploy failed: {e}", fg="red", err=True)
     ctx.exit(1)
@@ -2665,6 +2667,8 @@ def cli_deploy_docker(
         provider_args=provider_args,
         env=env,
     )
+  except (click.ClickException, click.Abort):
+    raise
   except Exception as e:
     click.secho(f"Deploy failed: {e}", fg="red", err=True)
     ctx.exit(1)
@@ -2729,6 +2733,7 @@ def cli_migrate_session(
     click.secho("Migration check and upgrade process finished.", fg="green")
   except Exception as e:
     click.secho(f"Migration failed: {e}", fg="red", err=True)
+    click.get_current_context().exit(1)
 
 
 @deploy.command("agent_engine")
@@ -3047,6 +3052,8 @@ def cli_deploy_agent_engine(
         extra_packages=list(extra_packages),
         worker_pool=worker_pool,
     )
+  except (click.ClickException, click.Abort):
+    raise
   except Exception as e:
     click.secho(f"Deploy failed: {e}", fg="red", err=True)
     click.get_current_context().exit(1)
@@ -3259,6 +3266,8 @@ def cli_deploy_gke(
         trigger_oidc_audience=trigger_oidc_audience,
         trigger_oidc_service_accounts=trigger_oidc_service_accounts,
     )
+  except (click.ClickException, click.Abort):
+    raise
   except Exception as e:
     click.secho(f"Deploy failed: {e}", fg="red", err=True)
     click.get_current_context().exit(1)
```

**File**: `tests/unittests/cli/utils/test_cli_tools_click.py` (modified, +56/-1)
```diff
@@ -1339,6 +1339,28 @@ def _boom(*_a: Any, **_k: Any) -> None:  # noqa: D401
   assert "Deploy failed: boom" in result.output
 
 
+def test_cli_deploy_cloud_run_click_error_is_surfaced_unchanged(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+  """A ClickException from the deployer keeps its own message."""
+
+  def _reject(*_a: Any, **_k: Any) -> None:
+    raise click.ClickException("extra_packages path not found: nope")
+
+  monkeypatch.setattr("google.adk.cli.cli_deploy.run", _reject)
+
+  agent_dir = tmp_path / "agent_click_error"
+  agent_dir.mkdir()
+  runner = CliRunner()
+  result = runner.invoke(
+      cli_tools_click.main, ["deploy", "cloud_run", str(agent_dir)]
+  )
+
+  assert result.exit_code == 1
+  assert "Error: extra_packages path not found: nope" in result.output
+  assert "Deploy failed" not in result.output
+
+
 def test_cli_deploy_cloud_run_passthrough_args(
     tmp_path: Path, monkeypatch: pytest.MonkeyPatch
 ) -> None:
@@ -1590,6 +1612,38 @@ def test_cli_deploy_agent_engine_otel_to_cloud_success(
   assert called_kwargs.get("otel_to_cloud")
 
 
+def test_cli_deploy_agent_engine_usage_error_exits_two(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+  """A usage error keeps click's exit code 2 and its usage message."""
+  rec = _Recorder()
+  monkeypatch.setattr("google.adk.cli.cli_deploy.to_agent_engine", rec)
+
+  agent_dir = tmp_path / "agent_ae_usage"
+  agent_dir.mkdir()
+  runner = CliRunner()
+  result = runner.invoke(
+      cli_tools_click.main,
+      [
+          "deploy",
+          "agent_engine",
+          "--project",
+          "test-proj",
+          "--region",
+          "us-central1",
+          "--validate-agent-import",
+          "--skip-agent-import-validation",
+          str(agent_dir),
+      ],
+  )
+
+  assert result.exit_code == 2
+  assert "Usage:" in result.output
+  assert "Error: Do not pass both --validate-agent-import" in result.output
+  assert "Deploy failed" not in result.output
+  assert not rec.calls
+
+
 # cli deploy gke
 def test_cli_deploy_gke_success(
     tmp_path: Path, monkeypatch: pytest.MonkeyPatch
@@ -3431,7 +3485,7 @@ def fake_upgrade(
 def test_cli_migrate_session_reports_the_underlying_failure(
     monkeypatch: pytest.MonkeyPatch,
 ) -> None:
-  """A failed migration is reported to the user rather than raised."""
+  """A failed migration is reported to the user and exits non-zero."""
 
   def explode(*args: Any, **kwargs: Any) -> None:
     raise RuntimeError("destination schema is newer")
@@ -3452,4 +3506,5 @@ def explode(*args: Any, **kwargs: Any) -> None:
       ],
   )
 
+  assert result.exit_code == 1
   assert "Migration failed: destination schema is newer" in result.output
```

---

### Incident Patch 10: `1cd0a2ae` (2026-10-05)
**Commit Message**: fix(scripts): require a unit guide only for re-exported modules

The unit guide rule judged a new module by its file name, which cannot tell a module with a public interface from an internal one, so most files it flagged needed a NO_UNIT_GUIDE waiver for code no package exports. A new module now needs a guide only when some package __init__.py imports from it or names it, counting the TYPE_CHECKING imports, __getattr__ imports and lazy-import tables ADK uses.

Co-authored-by: George Weale <[REDACTED_EMAIL]>
PiperOrigin-RevId: 993844250

**File**: `.agents/skills/adk-unit-guide/SKILL.md` (modified, +9/-2)
```diff
@@ -136,6 +136,13 @@ them rather than in a guide of their own, which covers any filename ending
 `_utils.py`, `_helper.py`, `_helpers.py`, `_types.py`, `_errors.py`,
 `_exceptions.py`, or `_constants.py`.
 
+A module is also exempt when no package `__init__.py` imports from it or names
+it, because then it has no public interface for a guide to describe. The check
+reads every `__init__.py` under `src/google/adk/`, and lazy re-exports count:
+an import under `if TYPE_CHECKING:` or inside `__getattr__`, and a string that
+names the module in a lazy-import table. Its `_` prefix decides nothing, so
+export a name from a new module and that module needs a guide.
+
 Everything else needs a guide or a waiver. A waiver is a `NO_UNIT_GUIDE=` or
 `SKIP_UNIT_GUIDE=` tag carrying the reason, and the two names behave
 identically. It waives the unit guide requirement alone; the `_` prefix rule
@@ -147,7 +154,7 @@ Write a reason a reviewer can check against the code, because the tag becomes
 the only record of why the guide is absent:
 
 ```
-NO_UNIT_GUIDE=_model_call is internal to the LLM flow; no __init__.py re-exports it.
+NO_UNIT_GUIDE=InvocationNotFoundError is covered by docs/guides/errors/index.md.
 ```
 
 ### Where to put the waiver
@@ -165,7 +172,7 @@ not found, and nothing reports the miss.
 The environment carries the tag for a commit that does not exist yet:
 
 ```
-NO_UNIT_GUIDE='internal to the LLM flow' git commit ...
+NO_UNIT_GUIDE='covered by docs/guides/errors/index.md' git commit ...
 ```
 
 Reach for that form when the pre-commit hook stops you. A pre-commit hook runs
```

**File**: `scripts/check_new_py_files.py` (modified, +118/-3)
```diff
@@ -22,8 +22,9 @@
    See .agents/skills/adk-style/references/visibility.md.
 2. Unit guide requirement: Newly-added Python files under src/google/adk/ must
    have a corresponding unit guide in docs/guides/ (unless exempt or tagged with
-   NO_UNIT_GUIDE / SKIP_UNIT_GUIDE in the commit message or environment).
-   See .agents/skills/adk-unit-guide/SKILL.md.
+   NO_UNIT_GUIDE / SKIP_UNIT_GUIDE in the commit message or environment). A
+   module that no package __init__.py imports from or names is internal and
+   needs no guide. See .agents/skills/adk-unit-guide/SKILL.md.
 
 Either rule can be switched off on its own, with --no-prefix-check and
 --no-unit-guide. The two are gated by separate CI jobs for that reason: the
@@ -52,7 +53,9 @@
 from __future__ import annotations
 
 import argparse
+import ast
 import fnmatch
+import importlib.util
 import os
 import re
 import shutil
@@ -463,6 +466,109 @@ def is_exempt_from_unit_guide(rel_path: str, filename: str) -> bool:
   return False
 
 
+# A module name as a lazy-import table writes it: '.mod', '..pkg.mod' or 'mod'.
+_MODULE_NAME_STRING = re.compile(r'^\.*[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*$')
+
+_ABSOLUTE_PACKAGE = 'google.adk'
+
+
+def _resolve_module(package: list[str], name: str) -> list[str] | None:
+  """Resolves a module name to path components relative to the package root.
+
+  Args:
+    package: The importing package's components, empty for the package root.
+    name: The module name as written, leading dots included.
+
+  Returns:
+    The components, empty for the package root itself, or None when the name
+    lies outside the package.
+  """
+  try:
+    absolute = importlib.util.resolve_name(
+        name, '.'.join([_ABSOLUTE_PACKAGE, *package])
+    )
+  except ImportError:
+    return None
+  if absolute == _ABSOLUTE_PACKAGE:
+    return []
+  if not absolute.startswith(_ABSOLUTE_PACKAGE + '.'):
+    return None
+  return absolute[len(_ABSOLUTE_PACKAGE) + 1 :].split('.')
+
+
+def _modules_named_in_init(tree: ast.AST, package: list[str]) -> set[str]:
+  """Returns the package-relative modules one __init__.py imports or names."""
+  targets: list[list[str] | None] = []
+  for node in ast.walk(tree):
+    if isinstance(node, ast.ImportFrom):
+      target = _resolve_module(package, '.' * node.level + (node.module or ''))
+      if target is None:
+        continue
+      targets.append(target)
+      # `from . import _mod` imports the module itself.
+      targets.extend(target + [alias.name] for alias in node.names)
+    elif isinstance(node, ast.Import):
+      targets.extend(
+          _resolve_module(package, alias.name) for alias in node.names
+      )
+    elif isinstance(node, ast.Constant) and isinstance(node.value, str):
+      name = node.value
+      if not _MODULE_NAME_STRING.match(name):
+        continue
+      if not name.startswith(('.', _ABSOLUTE_PACKAGE + '.')):
+        # A bare name in a lazy-import table is joined onto the package's name.
+        name = '.' + name
+      targets.append(_resolve_module(package, name))
+  return {'/'.join(target) for target in targets if target}
+
+
+def _raise_walk_error(error: OSError) -> None:
+  raise error
+
+
+def _reexported_modules(repo_root: str) -> set[str] | None:
+  """Returns the modules that some package __init__.py imports from or names.
+
+  An import counts wherever it sits, including under `if TYPE_CHECKING:` and
+  inside a lazy `__getattr__`, and so does a string naming a module, which is
+  how a lazy-import table refers to one.
+
+  Args:
+    repo_root: The root directory of the repository.
+
+  Returns:
+    Package-relative module paths without their extension, e.g.
+    `agents/_llm_agent`. None when the package or some __init__.py cannot be
+    read: what it exports is then unknown, so no module can be shown to be
+    internal.
+  """
+  package_root = os.path.join(repo_root, _PACKAGE_RELPATH)
+  named: set[str] = set()
+  try:
+    for dirpath, dirnames, filenames in os.walk(
+        package_root, onerror=_raise_walk_error, followlinks=True
+    ):
+      rel_dir = os.path.relpath(dirpath, package_root).replace(os.sep, '/')
+      package = [] if rel_dir == '.' else rel_dir.split('/')
+      if package and not _keep_relative_path(f'{rel_dir}/__init__.py'):
+        dirnames[:] = []
+        continue
+      if '__init__.py' not in filenames:
+        continue
+      init_path = os.path.join(dirpath, '__init__.py')
+      with open(init_path, 'r', encoding='utf-8') as f:
+        tree = ast.parse(f.read(), filename=init_path)
+      named |= _modules_named_in_init(tree, package)
+  except (OSError, SyntaxError, ValueError) as e:
+    print(
+        f'Warning: the package __init__.py files cannot all be read ({e}),'
+        ' so every new module is held to the unit guide rule.',
+        file=sys.stderr,
+    )
+    return None
+  return named
+
+
 def has_no_unit_guide_tag(commit_msg: str) -> bool:
   """Checks if NO_UNIT_GUIDE / SKIP_UNIT_GUIDE is present in 
```

**File**: `tests/unittests/scripts/test_check_new_py_files.py` (modified, +156/-0)
```diff
@@ -16,6 +16,7 @@
 
 from __future__ import annotations
 
+from collections.abc import Iterator
 import os
 import pathlib
 import shutil
@@ -168,6 +169,7 @@ def test_no_waiver_ignores_a_tag_the_caller_did_not_mean(
   the directory it runs in.
   """
   added = _tree_with_added_file(tmp_path, 'agents/_agent.py')
+  _export_from_package(tmp_path, 'agents/_agent.py')
   argv = ['--new-dir', str(tmp_path), '--no-prefix-check', str(added)]
 
   monkeypatch.setenv('NO_UNIT_GUIDE', 'stray')
@@ -182,6 +184,7 @@ def test_no_waiver_ignores_a_tag_the_caller_did_not_mean(
 
 def test_check_files_prefix_violation(tmp_path: pathlib.Path) -> None:
   # Missing '_' prefix
+  _export_from_package(tmp_path, 'agents/agent.py')
   files = [('src/google/adk/agents/agent.py', 'agents/agent.py', 'agent.py')]
   prefix_errs, guide_errs = check_new_py_files.check_files(
       files,
@@ -198,6 +201,7 @@ def test_check_files_prefix_violation(tmp_path: pathlib.Path) -> None:
 
 def test_check_files_guide_violation(tmp_path: pathlib.Path) -> None:
   # Proper '_' prefix, but missing unit guide
+  _export_from_package(tmp_path, 'agents/_agent.py')
   files = [('src/google/adk/agents/_agent.py', 'agents/_agent.py', '_agent.py')]
   prefix_errs, guide_errs = check_new_py_files.check_files(
       files,
@@ -213,6 +217,7 @@ def test_check_files_guide_found(tmp_path: pathlib.Path) -> None:
   guide_file = tmp_path / 'docs' / 'guides' / 'agents' / 'agent.md'
   guide_file.parent.mkdir(parents=True, exist_ok=True)
   guide_file.write_text('# Agent Guide', encoding='utf-8')
+  _export_from_package(tmp_path, 'agents/_agent.py')
 
   files = [('src/google/adk/agents/_agent.py', 'agents/_agent.py', '_agent.py')]
   prefix_errs, guide_errs = check_new_py_files.check_files(
@@ -224,6 +229,127 @@ def test_check_files_guide_found(tmp_path: pathlib.Path) -> None:
   assert len(guide_errs) == 0
 
 
+def test_a_module_no_package_init_imports_needs_no_guide(
+    tmp_path: pathlib.Path,
+) -> None:
+  """An internal module has no public interface for a guide to describe."""
+  init = tmp_path / 'src' / 'google' / 'adk' / 'flows' / '__init__.py'
+  init.parent.mkdir(parents=True)
+  init.write_text('from ._flow_utils import run\n', encoding='utf-8')
+
+  files = [(
+      'src/google/adk/flows/_flow.py',
+      'flows/_flow.py',
+      '_flow.py',
+  )]
+  prefix_errs, guide_errs = check_new_py_files.check_files(
+      files,
+      repo_root=str(tmp_path),
+      commit_msg='clean commit',
+  )
+  assert not prefix_errs
+  assert not guide_errs
+
+
+@pytest.mark.parametrize(
+    ('init_dir', 'init_source'),
+    [
+        ('models', 'from ._llm import Llm\n'),
+        ('models', 'from . import _llm\n'),
+        ('models', 'from google.adk.models._llm import Llm\n'),
+        (
+            'models',
+            (
+                'from typing import TYPE_CHECKING\n'
+                'if TYPE_CHECKING:\n'
+                '  from ._llm import Llm\n'
+            ),
+        ),
+        (
+            'models',
+            'def __getattr__(name):\n  from ._llm import Llm\n  return Llm\n',
+        ),
+        ('models', "_lazy_imports = {'Llm': '._llm'}\n"),
+        ('models', "_LAZY_MEMBERS = {'Llm': '_llm'}\n"),
+        ('', 'from .models._llm import Llm\n'),
+        ('tools', "_LAZY_MAPPING = {'Llm': ('..models._llm', 'Llm')}\n"),
+    ],
+)
+def test_a_module_any_package_init_imports_or_names_needs_a_guide(
+    tmp_path: pathlib.Path, init_dir: str, init_source: str
+) -> None:
+  """Every way ADK re-exports a module counts, lazy ones included."""
+  init = tmp_path / 'src' / 'google' / 'adk' / init_dir / '__init__.py'
+  init.parent.mkdir(parents=True, exist_ok=True)
+  init.write_text(init_source, encoding='utf-8')
+
+  files = [('src/google/adk/models/_llm.py', 'models/_llm.py', '_llm.py')]
+  _, guide_errs = check_new_py_files.check_files(
+      files,
+      repo_root=str(tmp_path),
+      commit_msg='clean commit',
+  )
+  assert len(guide_errs) == 1
+
+
+def test_an_unparseable_init_holds_every_module_to_the_guide_rule(
+    tmp_path: pathlib.Path, capsys: pytest.CaptureFixture[str]
+) -> None:
+  """What a broken __init__.py exports is unknown, so nothing is internal."""
+  init = tmp_path / 'src' / 'google' / 'adk' / 'flows' / '__init__.py'
+  init.parent.mkdir(parents=True)
+  init.write_text('from . import (\n', encoding='utf-8')
+
+  files = [('src/google/adk/flows/_flow.py', 'flows/_flow.py', '_flow.py')]
+  _, guide_errs = check_new_py_files.check_files(
+      files,
+      repo_root=str(tmp_path),
+      commit_msg='clean commit',
+  )
+  assert len(guide_errs) == 1
+  assert 'cannot all be read' in capsys.readouterr().err
+
+
+def test_an_unreadable_package_directory_holds_every_module_to_the_rule(
+    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+  """A directory the walk cannot list may hold the __init__.py that exports."""
+  _export_from_package(tmp_path, 'agents/_agent.py')
+  real_scandir = 
```

---

### Incident Patch 11: `ab9fffc9` (2026-10-05)
**Commit Message**: feat(cli): source the agent builder assistant's ADK knowledge from the installed package

Delete the contained search_adk_knowledge tool and the google_search_agent and
url_context_agent sub-agents, so the assistant researches ADK by reading the
package installed on the machine. Repair write-time validation, which passed
every config of the most common agent shape, and refuse google.adk.* names that
do not resolve in the installed version.

Co-authored-by: Yuhan Gao <[REDACTED_EMAIL]>
PiperOrigin-RevId: 993816495

**File**: `src/google/adk/cli/built_in_agents/adk_agent_builder_assistant.py` (modified, +1/-22)
```diff
@@ -26,18 +26,14 @@
 from google.adk.agents import LlmAgent
 from google.adk.agents.readonly_context import ReadonlyContext
 from google.adk.models import BaseLlm
-from google.adk.tools import AgentTool
 from google.adk.tools import FunctionTool
 from google.genai import types
 
-from .sub_agents.google_search_agent import create_google_search_agent
-from .sub_agents.url_context_agent import create_url_context_agent
 from .tools.cleanup_unused_files import cleanup_unused_files
 from .tools.delete_files import delete_files
 from .tools.explore_project import explore_project
 from .tools.read_config_files import read_config_files
 from .tools.read_files import read_files
-from .tools.search_adk_knowledge import search_adk_knowledge
 from .tools.search_adk_source import search_adk_source
 from .tools.write_config_files import write_config_files
 from .tools.write_files import write_files
@@ -83,21 +79,6 @@ def create_agent(
     # Load full ADK AgentConfig schema directly into instruction context
     instruction = AgentBuilderAssistant._load_instruction_with_schema(model)
 
-    # TOOL ARCHITECTURE: Hybrid approach using both AgentTools and FunctionTools
-    #
-    # Why use sub-agents for built-in tools?
-    # - ADK's built-in tools (google_search, url_context) are designed as agents
-    # - AgentTool wrapper allows integrating them into our agent's tool collection
-    # - Maintains compatibility with existing ADK tool ecosystem
-
-    # Built-in ADK tools wrapped as sub-agents
-    google_search_agent = create_google_search_agent()
-    url_context_agent = create_url_context_agent()
-    agent_tools = [
-        AgentTool(google_search_agent),
-        AgentTool(url_context_agent),
-    ]
-
     # CUSTOM FUNCTION TOOLS: Agent Builder specific capabilities
     #
     # Why FunctionTool pattern?
@@ -119,12 +100,10 @@ def create_agent(
         FunctionTool(cleanup_unused_files),
         # ADK source code search (regex-based)
         FunctionTool(search_adk_source),  # Search ADK source with regex
-        # ADK knowledge search
-        FunctionTool(search_adk_knowledge),  # Search ADK knowledge base
     ]
 
     # Combine all tools
-    all_tools = agent_tools + custom_tools
+    all_tools = custom_tools
 
     # Create agent directly using LlmAgent constructor
     agent = LlmAgent(
```

**File**: `src/google/adk/cli/built_in_agents/instruction_embedded.template` (modified, +24/-33)
```diff
@@ -288,25 +288,25 @@ tools:
 
 ### ADK Knowledge and Research Tools
 
-**Default research tool**: Use `search_adk_knowledge` first for ADK concepts, APIs,
-examples, and troubleshooting. Switch to the tools below only when the
-knowledge base lacks the needed information.
+**Research is local.** `search_adk_source` reads the ADK installed on this
+machine, so what it returns is true for the version in use. There is no web
+access: if it cannot find something, it does not exist in this version, and you
+should say so rather than reach for what you remember.
 
 - `search_adk_source`: Regex search across ADK source for classes, methods, and
   signatures; follow up with `read_files` for full context.
-- `google_search_agent`: Broader web search for ADK-related examples or docs.
-- `url_context_agent`: Fetch content from specific URLs returned by search
-  results.
 
 **Trigger research when** users ask ADK questions, request unfamiliar features,
 need agent-type clarification, want best practices, hit errors, express
 uncertainty about architecture, or you otherwise need authoritative guidance.
 
 **Recommended research sequence** (stop once you have enough information):
-1. `search_adk_knowledge`
-2. `search_adk_source` → `read_files`
-3. `google_search_agent`
-4. `url_context_agent`
+1. `search_adk_source` → `read_files`
+
+Never recommend or emit a `google.adk.*` symbol that this search could not find
+in the installed package. If it is not there, it does not exist in this version,
+whatever you remember about it. Tell the user it is unavailable instead of
+substituting something that looks similar.
 
 **For ADK Code Questions (NEW - Preferred Method):**
 1. **search_adk_source** - Find exact code patterns:
@@ -319,22 +319,14 @@ uncertainty about architecture, or you otherwise need authoritative guidance.
    * Understand complete implementation details
    * Analyze class relationships and usage patterns
 
-**For External Examples and Documentation:**
-- **google_search_agent**: Search and analyze web content (returns full page content, not just URLs)
-  * Search within key repositories: "site:github.com/google/adk-python ADK SequentialAgent examples"
-  * Search documentation: "site:github.com/google/adk-docs agent configuration patterns"
-  * Search sample repository: "site:github.com/google/adk-samples multi-agent workflow"
-  * General searches: "ADK workflow patterns", "ADK tool integration patterns", "ADK project structure"
-  * Returns complete page content as search results - no need for additional URL fetching
-- **url_context_agent**: Fetch specific URLs only when:
-  * Specific URLs are mentioned in search results that need additional content
-  * User provides specific URLs in their query
-  * You need to fetch content from URLs found within google_search results
-  * NOT needed for general searches - google_search_agent already provides page content
+**When source search does not cover a case:** say so. There is no web access
+from here, and guessing at an API you cannot find in the installed package
+produces code that fails to load. Describe what is available and ask the user
+how they want to proceed.
 
 **Research for Agent Building:**
-- When user requests complex multi-agent systems: Search for similar patterns in samples
-- When unsure about tool integration: Look for tool usage examples in contributing/samples
+- When user requests complex multi-agent systems: Look for similar patterns with `search_adk_source`
+- When unsure about tool integration: Look for tool usage in the installed package with `search_adk_source`
 - When designing workflows: Find SequentialAgent, ParallelAgent, or LoopAgent examples
 - When user needs specific integrations: Search for API, database, or service integration examples
 
@@ -353,15 +345,14 @@ uncertainty about architecture, or you otherwise need authoritative guidance.
 - Only `LlmAgent` definitions (root or sub-agents) are allowed to carry `model`, `instruction`, and `tools`
 
 ### When Creating Python Tools or Callbacks:
-1. **Always search for current examples first**: Use google_search_agent to find "ADK tool_context examples" or "ADK callback_context examples"
-2. **Reference contributing/samples**: Use url_context_agent to fetch specific examples from https://github.com/google/adk-python/tree/main/contributing/samples
-3. **Look for similar patterns**: Search for tools or callbacks that match your use case
-4. **Use snake_case**: Function names should be snake_case (e.g., `check_prime`, `roll_dice`)
-5. **Remove tool suffix**: Don't add "_tool" to function names
-6. **Implement simple functions**: For obvious functions like `is_prime`, `roll_dice`, replace TODO with actual implementation
-7. **Keep TODO for complex**: For complex business logic, leave TODO comments
-8. **Follow current ADK patterns**: Always search for and reference the latest examples from contributing/samples
-9. **Gemini API Usage**: If generating Python code that interacts wi
```

**File**: `src/google/adk/cli/built_in_agents/sub_agents/__init__.py` (removed, +0/-25)
```diff
@@ -1,25 +0,0 @@
-# Copyright 2026 Google LLC
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-#     http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-
-"""Sub-agents for Agent Builder Assistant."""
-
-from __future__ import annotations
-
-from .google_search_agent import create_google_search_agent
-from .url_context_agent import create_url_context_agent
-
-__all__ = [
-    'create_google_search_agent',
-    'create_url_context_agent',
-]
```

**File**: `src/google/adk/cli/built_in_agents/sub_agents/google_search_agent.py` (removed, +0/-61)
```diff
@@ -1,61 +0,0 @@
-# Copyright 2026 Google LLC
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-#     http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-
-"""Sub-agent for Google Search functionality."""
-
-from __future__ import annotations
-
-from google.adk.agents import LlmAgent
-from google.adk.tools import google_search
-
-
-def create_google_search_agent() -> LlmAgent:
-  """Create a sub-agent that only uses google_search tool."""
-  return LlmAgent(
-      name="google_search_agent",
-      description=(
-          "Agent for performing Google searches to find ADK examples and"
-          " documentation"
-      ),
-      instruction="""You are a specialized search agent for the Agent Builder Assistant.
-
-Your role is to search for relevant ADK (Agent Development Kit) examples, patterns, documentation, and solutions.
-
-When given a search query, use the google_search tool to find:
-- ADK configuration examples and patterns
-- Multi-agent system architectures and workflows
-- Best practices and documentation
-- Similar use cases and implementations
-- Troubleshooting solutions and error fixes
-- API references and implementation guides
-
-SEARCH STRATEGIES:
-- Use site-specific searches for targeted results:
-  * "site:github.com/google/adk-python [query]" for core ADK examples
-  * "site:github.com/google/adk-samples [query]" for sample implementations
-  * "site:github.com/google/adk-docs [query]" for documentation
-- Use general searches for broader community solutions
-- Search for specific agent types, tools, or error messages
-- Look for configuration patterns and architectural approaches
-
-Return the search results with:
-1. Relevant URLs found
-2. Brief description of what each result contains
-3. Relevance to the original query
-4. Suggestions for which URLs should be fetched for detailed analysis
-
-Focus on finding practical, actionable examples that can guide ADK development and troubleshooting.""",
-      model="gemini-2.5-flash",
-      tools=[google_search],
-  )
```

**File**: `src/google/adk/cli/built_in_agents/sub_agents/url_context_agent.py` (removed, +0/-64)
```diff
@@ -1,64 +0,0 @@
-# Copyright 2026 Google LLC
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-#     http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-
-"""Sub-agent for URL context fetching functionality."""
-
-from __future__ import annotations
-
-from google.adk.agents import LlmAgent
-from google.adk.tools import url_context
-
-
-def create_url_context_agent() -> LlmAgent:
-  """Create a sub-agent that only uses url_context tool."""
-  return LlmAgent(
-      name="url_context_agent",
-      description=(
-          "Agent for fetching and analyzing content from URLs, especially"
-          " GitHub repositories and documentation"
-      ),
-      instruction="""You are a specialized URL content analysis agent for the Agent Builder Assistant.
-
-Your role is to fetch and analyze complete content from URLs to extract detailed, actionable information.
-
-TARGET CONTENT TYPES:
-- GitHub repository files (YAML configurations, Python implementations, README files)
-- ADK documentation pages and API references
-- Code examples and implementation patterns
-- Configuration samples and templates
-- Troubleshooting guides and solutions
-
-When given a URL, use the url_context tool to:
-1. Fetch the complete content from the specified URL
-2. Analyze the content thoroughly for relevant information
-3. Extract specific details about:
-   - Agent configurations and structure
-   - Tool implementations and usage patterns
-   - Architecture decisions and relationships
-   - Code snippets and examples
-   - Best practices and recommendations
-   - Error handling and troubleshooting steps
-
-Return a comprehensive analysis that includes:
-- Summary of what the content provides
-- Specific implementation details and code patterns
-- Key configuration examples or snippets
-- How the content relates to the original query
-- Actionable insights and recommendations
-- Any warnings or important considerations mentioned
-
-Focus on extracting complete, detailed information that enables practical application of the patterns and examples found.""",
-      model="gemini-2.5-flash",
-      tools=[url_context],
-  )
```

**File**: `src/google/adk/cli/built_in_agents/tools/search_adk_knowledge.py` (removed, +0/-88)
```diff
@@ -1,88 +0,0 @@
-# Copyright 2026 Google LLC
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-#     http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-
-"""ADK knowledge search tool."""
-
-from __future__ import annotations
-
-from typing import Any
-from typing import cast
-import uuid
-
-import requests
-
-KNOWLEDGE_SERVICE_APP_URL = "https://adk-agent-builder-knowledge-service-654646711756.us-central1.run.app"
-KNOWLEDGE_SERVICE_APP_NAME = "adk_knowledge_agent"
-KNOWLEDGE_SERVICE_APP_USER_NAME = "agent_builder_assistant"
-
-HEADERS = {
-    "Content-Type": "application/json",
-    "Accept": "application/json",
-}
-
-
-def search_adk_knowledge(
-    query: str,
-) -> dict[str, Any]:
-  """Searches ADK knowledge base for relevant information.
-
-  Args:
-    query: The query to search in ADK knowledge base.
-
-  Returns:
-    A dict with status and the response from the knowledge service.
-  """
-  # Create a new session
-  session_id = uuid.uuid4()
-  create_session_url = f"{KNOWLEDGE_SERVICE_APP_URL}/apps/{KNOWLEDGE_SERVICE_APP_NAME}/users/{KNOWLEDGE_SERVICE_APP_USER_NAME}/sessions/{session_id}"
-
-  try:
-    create_session_response = post_request(
-        create_session_url,
-        {},
-    )
-  except requests.exceptions.RequestException as e:
-    return error_response(f"Failed to create session: {e}")
-  session_id = create_session_response["id"]
-
-  # Search ADK knowledge base
-  search_url = f"{KNOWLEDGE_SERVICE_APP_URL}/run"
-  try:
-    search_response = post_request(
-        search_url,
-        {
-            "app_name": KNOWLEDGE_SERVICE_APP_NAME,
-            "user_id": KNOWLEDGE_SERVICE_APP_USER_NAME,
-            "session_id": session_id,
-            "new_message": {"role": "user", "parts": [{"text": query}]},
-        },
-    )
-  except requests.exceptions.RequestException as e:
-    return error_response(f"Failed to search ADK knowledge base: {e}")
-  return {
-      "status": "success",
-      "response": search_response,
-  }
-
-
-def error_response(error_message: str) -> dict[str, Any]:
-  """Returns an error response."""
-  return {"status": "error", "error_message": error_message}
-
-
-def post_request(url: str, payload: dict[str, Any]) -> dict[str, Any]:
-  """Executes a POST request."""
-  response = requests.post(url, headers=HEADERS, json=payload, timeout=60)
-  response.raise_for_status()
-  return cast(dict[str, Any], response.json())
```

**File**: `src/google/adk/cli/built_in_agents/tools/write_config_files.py` (modified, +146/-21)
```diff
@@ -16,6 +16,7 @@
 
 from __future__ import annotations
 
+import importlib
 from pathlib import Path
 import re
 from typing import Any
@@ -28,9 +29,11 @@
 
 from google.adk.tools.tool_context import ToolContext
 import jsonschema
+from pydantic import BaseModel
 import yaml
 
 from ..utils import load_agent_config_schema
+from ..utils._adk_symbols import adk_symbol_exists as _adk_symbol_exists
 from ..utils.path_normalizer import sanitize_generated_file_path
 from ..utils.resolve_root_directory import resolve_file_path
 from .write_files import write_files
@@ -425,6 +428,30 @@ def _validate_single_config(
           ),
       }
 
+    # Step 2b: every google.adk.* name the config references must exist in the
+    # ADK installed here. A model recalling an older or imagined API writes a
+    # plausible name that only fails when the agent is loaded -- one run
+    # produced `google.adk.tools.tool_args.ToolArgs`, which has never existed.
+    # The schema cannot see this: the name is a well-formed string.
+    symbol_errors = _validate_adk_symbols(config_dict)
+    if symbol_errors:
+      return {
+          "success": False,
+          "error_type": "UNKNOWN_ADK_SYMBOL",
+          "error": (
+              "Configuration references names that do not exist in the"
+              f" installed ADK ({_adk_version()})"
+          ),
+          "validation_errors": symbol_errors,
+          "file_path": str(path),
+          "validation_step": "symbol_resolution",
+          "retry_suggestion": (
+              "Look each name up with search_adk_source before using it. If a"
+              " name is not in the installed package it does not exist in this"
+              " version, whatever it was called in an earlier release."
+          ),
+      }
+
     # Step 3: Additional structural validation
     # TODO: Remove once the frontend performs these validations before calling
     # this tool.
@@ -469,37 +496,97 @@ def _validate_single_config(
     }
 
 
+_ADK_AGENT_CLASSES = frozenset(
+    {"LlmAgent", "LoopAgent", "ParallelAgent", "SequentialAgent"}
+)
+
+
+def _schema_branch(
+    schema: Dict[str, Any], config_dict: Dict[str, Any]
+) -> Dict[str, Any]:
+  """Select the one schema branch that applies to this config.
+
+  AgentConfig's top level is a union over the agent classes, and BaseAgentConfig
+  accepts additional properties, so a valid LlmAgent matches two branches at
+  once. Validating against the union therefore fails on correct input.
+
+  This used to be handled by string-matching jsonschema's "is valid under each
+  of" message and returning valid. That silently disabled validation for the
+  most common agent shape: jsonschema surfaces one error, the union ambiguity
+  won every time, and genuinely broken nested fields -- a callback written with
+  `code:` instead of `name:`, for instance -- were written to disk and only
+  discovered when the agent failed to load.
+
+  Instead, dispatch on `agent_class` the way AgentConfig's own pydantic
+  Discriminator does, and validate against that single branch.
+  """
+  branches = schema.get("oneOf") or schema.get("anyOf")
+  if not branches:
+    return schema
+  defs = schema.get("$defs", {})
+  agent_class = (config_dict.get("agent_class") or "LlmAgent").rsplit(".", 1)[
+      -1
+  ]
+  wanted = (
+      f"{agent_class}Config"
+      if agent_class in _ADK_AGENT_CLASSES
+      else "BaseAgentConfig"
+  )
+  for branch in branches:
+    if branch.get("$ref", "").rsplit("/", 1)[-1] == wanted and wanted in defs:
+      return {"$defs": defs, **defs[wanted]}
+  return schema
+
+
+def _runtime_accepts(config_dict: Dict[str, Any]) -> bool:
+  """Whether the pydantic models accept this config.
+
+  The shipped schema is emitted with camelCase aliases and
+  additionalProperties false, while the models also accept the snake_case field
+  names. A live-audio config using `response_modalities` is rejected by the
+  schema and loads perfectly. When the two disagree the runtime wins: it is
+  what actually runs, and rejecting a working config is worse than the gap this
+  validation closes.
+  """
+  try:
+    from ....agents.config_agent_utils import _resolve_agent_class  # pylint: disable=g-import-not-at-top
+
+    cls = _resolve_agent_class(config_dict.get("agent_class", "LlmAgent"))
+    config_type = getattr(cls, "config_type", None)
+    if not (
+        isinstance(config_type, type) and issubclass(config_type, BaseModel)
+    ):
+      return False
+    config_type.model_validate(config_dict)
+    return True
+  except Exception:  # pylint: disable=broad-except
+    return False
+
+
 def _validate_against_schema(
     config_dict: Dict[str, Any],
 ) -> Dict[str, Any]:
   """Validate configuration against AgentConfig.json schema."""
   try:
+    # raw_format=False returns the parsed schema, but the loader is annotated
+    # as returning either that or the raw text, so narrow it before use.
     schema = load_agent_config_schema(raw_format=False)
-   
```

**File**: `src/google/adk/cli/built_in_agents/tools/write_files.py` (modified, +57/-0)
```diff
@@ -16,6 +16,7 @@
 
 from __future__ import annotations
 
+import ast
 from datetime import datetime
 from pathlib import Path
 import shutil
@@ -26,9 +27,48 @@
 
 from google.adk.tools.tool_context import ToolContext
 
+from ..utils._adk_symbols import adk_symbol_exists as _adk_symbol_exists
 from ..utils.resolve_root_directory import resolve_file_path
 
 
+def _unknown_adk_imports(file_path: str, content: str) -> List[str]:
+  """google.adk.* names a Python file imports that do not resolve here.
+
+  Only imports are inspected, and only in Python files. An import is a hard
+  promise the name exists; an attribute deeper in the body may be guarded, so
+  flagging those would reject working code.
+  """
+  if not file_path.endswith(".py"):
+    return []
+  try:
+    tree = ast.parse(content)
+  except SyntaxError:
+    return []  # a syntax error is a different complaint, reported elsewhere
+
+  names: List[str] = []
+  for node in ast.walk(tree):
+    if isinstance(node, ast.ImportFrom) and (node.module or "").startswith(
+        "google.adk"
+    ):
+      names.extend(
+          f"{node.module}.{alias.name}"
+          for alias in node.names
+          if alias.name != "*"
+      )
+    elif isinstance(node, ast.Import):
+      names.extend(
+          alias.name
+          for alias in node.names
+          if alias.name.startswith("google.adk")
+      )
+
+  unknown: List[str] = []
+  for name in dict.fromkeys(names):
+    if not _adk_symbol_exists(name):
+      unknown.append(name)
+  return unknown
+
+
 async def write_files(
     files: Dict[str, str],
     tool_context: ToolContext,
@@ -89,6 +129,23 @@ async def write_files(
           "package_inits_created": [],
       }
 
+      unknown = _unknown_adk_imports(file_path, content)
+      if unknown:
+        # The file imports names that do not exist in the ADK installed here,
+        # so it cannot run. Catching it now costs one retry; letting it through
+        # costs a broken agent the developer has to debug. Measured over 483
+        # generated Python files from evaluation runs, this rejects only files
+        # that genuinely fail to import.
+        file_info["error"] = (
+            "Imports names that do not exist in the installed ADK: "
+            + ", ".join(unknown)
+            + ". Check each with search_adk_source before using it."
+        )
+        result["success"] = False
+        result["failed_writes"] = result.get("failed_writes", 0) + 1
+        result["files"][file_path] = file_info
+        continue
+
       try:
         # Check if file already exists
         file_info["existed_before"] = file_path_obj.exists()
```

---

### Incident Patch 12: `d185ca5a` (2026-10-05)
**Commit Message**: fix: harden SetModelResponseTool fallback to prevent infinite loops

Merge https://github.com/google/adk-python/pull/5091

Improves the fallback behavior of SetModelResponseTool to avoid infinite loops when models ignore set_model_response and keep calling other tools. Caps consecutive tool rounds per agent turn at 25 by default (configurable via ADK_MAX_TOOL_ROUNDS; <= 0 disables the cap) and emits an error event with error_code="MAX_TOOL_ROUNDS_EXCEEDED" when the cap is reached.

PiperOrigin-RevId: 993785655

**File**: `src/google/adk/flows/llm_flows/core/_function_call_postprocessor.py` (modified, +7/-3)
```diff
@@ -77,6 +77,12 @@ async def postprocess_handle_function_calls_async(
   if function_response_event := await functions.handle_function_calls_async(
       invocation_context, function_call_event, llm_request.tools_dict
   ):
+    json_response = _output_schema_processor.get_structured_model_response(
+        function_response_event
+    )
+    if json_response is not None:
+      function_response_event.actions.transfer_to_agent = None
+
     auth_event = functions.generate_auth_event(
         invocation_context, function_response_event
     )
@@ -104,9 +110,7 @@ async def postprocess_handle_function_calls_async(
       yield function_response_event
 
     # Check if this is a set_model_response function response
-    if json_response := _output_schema_processor.get_structured_model_response(
-        function_response_event
-    ):
+    if json_response is not None:
       # Create and yield a final model response event
       final_event = _output_schema_processor.create_final_model_response_event(
           invocation_context, json_response
```

**File**: `src/google/adk/flows/llm_flows/prompt/_schema.py` (modified, +87/-11)
```diff
@@ -12,23 +12,53 @@
 # See the License for the specific language governing permissions and
 # limitations under the License.
 
-"""Handles output schema when tools are also present."""
+"""Handles output schema when tools are also present.
+
+Unlike `RunConfig.max_llm_calls` (which bounds total LLM calls across an entire
+invocation), `ADK_MAX_TOOL_ROUNDS` (default 25) bounds consecutive tool-call
+rounds for a single agent turn before forcing `set_model_response` on round N-1
+and terminating on round N.
+"""
 
 from __future__ import annotations
 
 import json
+import logging
+import os
 from typing import AsyncGenerator
 
+from google.genai import types
 from typing_extensions import override
 
 from ....agents.invocation_context import InvocationContext
 from ....events.event import Event
 from ....models.llm_request import LlmRequest
 from ....tools.set_model_response_tool import SetModelResponseTool
+from ....utils._schema_utils import is_basemodel_schema
 from .._base_llm_processor import BaseLlmRequestProcessor
 from ..core._utils import as_llm_agent
 from ..core._utils import require_agent_name
 
+logger = logging.getLogger('google_adk.' + __name__)
+
+# Max tool rounds before forcing set_model_response (N-1) or terminating (N).
+_MAX_TOOL_ROUNDS = 25
+
+
+def _get_max_tool_rounds() -> int:
+  """Resolves the max tool rounds limit from environment or fallback."""
+  if env_val := os.getenv('ADK_MAX_TOOL_ROUNDS'):
+    try:
+      return int(env_val)
+    except ValueError:
+      logger.warning(
+          'Invalid value for ADK_MAX_TOOL_ROUNDS env var: %s. Using default'
+          ' %d.',
+          env_val,
+          _MAX_TOOL_ROUNDS,
+      )
+  return _MAX_TOOL_ROUNDS
+
 
 class _OutputSchemaRequestProcessor(BaseLlmRequestProcessor):
   """Processor that handles output schema for agents with tools."""
@@ -52,22 +82,68 @@ async def run_async(
     ):
       return
 
+    # Count consecutive tool rounds for this agent in the current turn.
+    tool_rounds = 0
+    for e in reversed(
+        invocation_context._get_events(
+            current_invocation=True, current_branch=True
+        )
+    ):
+      if e.author != agent.name:
+        continue
+      if e.get_function_responses():
+        tool_rounds += 1
+      elif e.is_final_response():
+        break
+
+    max_tool_rounds = _get_max_tool_rounds()
+
+    # Terminate the invocation if the model never calls set_model_response.
+    if max_tool_rounds > 0 and tool_rounds >= max_tool_rounds:
+      error_msg = (
+          f'Tool execution reached {tool_rounds} rounds without producing'
+          ' structured output via set_model_response. Breaking loop to prevent'
+          ' runaway API costs.'
+      )
+      logger.error(error_msg)
+      invocation_context.end_invocation = True
+      yield Event(
+          author=require_agent_name(invocation_context),
+          invocation_id=invocation_context.invocation_id,
+          branch=invocation_context.branch,
+          error_code='MAX_TOOL_ROUNDS_EXCEEDED',
+          error_message=error_msg,
+      )
+      return
+
     # Add the set_model_response tool to handle structured output
     set_response_tool = SetModelResponseTool(agent.output_schema)
     llm_request.append_tools([set_response_tool])
 
-    # Add instruction about using the set_model_response tool
-    instruction = (
-        'IMPORTANT: You have access to other tools, but you must provide '
-        'your final response using the set_model_response tool with the '
-        'required structured format. After using any other tools needed '
-        'to complete the task, always call set_model_response with your '
-        'final answer in the specified schema format.'
-    )
+    # Primitive types (str, int, etc.) produce a trivial tool signature
+    # that flash models tend to ignore, so use a stronger instruction.
+    if is_basemodel_schema(agent.output_schema):
+      instruction = (
+          'After completing any needed tool calls, you must provide your'
+          ' final response by calling set_model_response with the required'
+          ' fields.'
+      )
+    else:
+      instruction = (
+          'IMPORTANT: After using any needed tools, you MUST call'
+          ' set_model_response to provide your final answer.'
+          ' This is required to complete the task.'
+      )
     llm_request.append_instructions([instruction])
 
-    return
-    yield  # Generator requires yield statement in function body.
+    # On round N-1, restrict the model to only call set_model_response.
+    if max_tool_rounds > 0 and tool_rounds >= max_tool_rounds - 1:
+      llm_request.config.tool_config = types.ToolConfig(
+          function_calling_config=types.FunctionCallingConfig(
+              mode=types.FunctionCallingConfigMode.ANY,
+              allowed_function_names=['set_model_response'],
+          )
+      )
 
 
 def create_final_model_response_event(
```

**File**: `tests/unittests/flows/llm_flows/prompt/test_schema.py` (modified, +300/-0)
```diff
@@ -20,6 +20,8 @@
 from google.adk.events.event import Event
 from google.adk.events.event_actions import EventActions
 from google.adk.flows.llm_flows.base_llm_flow import BaseLlmFlow
+from google.adk.flows.llm_flows.prompt._schema import _MAX_TOOL_ROUNDS
+from google.adk.flows.llm_flows.prompt._schema import _OutputSchemaRequestProcessor
 from google.adk.flows.llm_flows.prompt._schema import get_structured_model_response
 from google.adk.flows.llm_flows.single_flow import SingleFlow
 from google.adk.models.llm_request import LlmRequest
@@ -595,3 +597,301 @@ async def test_flow_yields_only_function_response_for_normal_tools():
   assert first_event.get_function_responses()[0].response == {
       'result': 'Searched for: test query'
   }
+
+
+def _make_function_response_event(
+    tool_name: str = 'dummy_tool',
+    *,
+    author: str = 'test_agent',
+    invocation_id: str = 'test-id',
+    branch: str | None = None,
+    skip_summarization: bool | None = None,
+) -> Event:
+  """Helper to create a function response event for round counting."""
+  return Event(
+      invocation_id=invocation_id,
+      author=author,
+      branch=branch,
+      actions=EventActions(skip_summarization=skip_summarization),
+      content=types.Content(
+          role='user',
+          parts=[
+              types.Part(
+                  function_response=types.FunctionResponse(
+                      name=tool_name, response={'result': 'ok'}
+                  )
+              )
+          ],
+      ),
+  )
+
+
+@pytest.mark.asyncio
+async def test_type_aware_instruction_basemodel():
+  """Test that BaseModel schema gets a field-specific instruction."""
+  agent = LlmAgent(
+      name='test_agent',
+      model=testing_utils.ModelWithCapabilities(output_schema_and_tools=False),
+      output_schema=PersonSchema,
+      tools=[FunctionTool(func=dummy_tool)],
+  )
+  invocation_context = await _create_invocation_context(agent)
+  llm_request = LlmRequest()
+  processor = _OutputSchemaRequestProcessor()
+
+  async for _ in processor.run_async(invocation_context, llm_request):
+    pass
+
+  assert (
+      'After completing any needed tool calls, you must provide your final'
+      ' response'
+      in llm_request.config.system_instruction
+  )
+  assert 'IMPORTANT' not in llm_request.config.system_instruction
+
+
+@pytest.mark.asyncio
+async def test_type_aware_instruction_primitive():
+  """Test that primitive schema (str) gets a stronger instruction."""
+  agent = LlmAgent(
+      name='test_agent',
+      model=testing_utils.ModelWithCapabilities(output_schema_and_tools=False),
+      output_schema=str,
+      tools=[FunctionTool(func=dummy_tool)],
+  )
+  invocation_context = await _create_invocation_context(agent)
+  llm_request = LlmRequest()
+  processor = _OutputSchemaRequestProcessor()
+
+  async for _ in processor.run_async(invocation_context, llm_request):
+    pass
+
+  assert 'IMPORTANT' in llm_request.config.system_instruction
+  assert 'MUST call' in llm_request.config.system_instruction
+
+
+@pytest.mark.asyncio
+async def test_hard_cutoff_at_max_rounds():
+  """Test that invocation is terminated at _MAX_TOOL_ROUNDS and emits an error event."""
+  agent = LlmAgent(
+      name='test_agent',
+      model=testing_utils.ModelWithCapabilities(output_schema_and_tools=False),
+      output_schema=PersonSchema,
+      tools=[FunctionTool(func=dummy_tool)],
+  )
+  invocation_context = await _create_invocation_context(agent)
+  llm_request = LlmRequest()
+  processor = _OutputSchemaRequestProcessor()
+
+  invocation_context.session.events.extend(
+      _make_function_response_event() for _ in range(_MAX_TOOL_ROUNDS)
+  )
+
+  events = [
+      e async for e in processor.run_async(invocation_context, llm_request)
+  ]
+
+  assert invocation_context.end_invocation is True
+  assert 'set_model_response' not in llm_request.tools_dict
+  assert len(events) == 1
+  assert events[0].error_code == 'MAX_TOOL_ROUNDS_EXCEEDED'
+  assert (
+      events[0].error_message is not None
+      and f'{_MAX_TOOL_ROUNDS} rounds' in events[0].error_message
+  )
+  assert events[0].author == 'test_agent'
+  assert events[0].invocation_id == 'test-id'
+
+
+@pytest.mark.asyncio
+async def test_force_tool_choice_at_penultimate_round():
+  """Test that tool_choice is forced on round N-1, including skip_summarization rounds."""
+  agent = LlmAgent(
+      name='test_agent',
+      model=testing_utils.ModelWithCapabilities(output_schema_and_tools=False),
+      output_schema=PersonSchema,
+      tools=[FunctionTool(func=dummy_tool)],
+  )
+  invocation_context = await _create_invocation_context(agent)
+  llm_request = LlmRequest()
+  processor = _OutputSchemaRequestProcessor()
+
+  invocation_context.session.events.extend(
+      _make_function_response_event(skip_summarization=(i == 0))
+      for i in range(_MAX_TOOL_ROUNDS - 1)
+  )
+
+  async for _ in processor.run_async(invocation_context, llm_request):
+    pass
+
+  assert 'set_
```

---

### Incident Patch 13: `233e64c5` (2026-10-05)
**Commit Message**: fix: preserve history after filtered Redis reads

Merge https://github.com/google/adk-python/pull/7140

PiperOrigin-RevId: 993780769

**File**: `src/google/adk/integrations/redis/_redis_session_service.py` (modified, +26/-5)
```diff
@@ -348,10 +348,12 @@ async def append_event(self, session: Session, event: Event) -> Event:
     session.last_update_time = event.timestamp
 
     # Sync app and user state deltas to their respective keys
+    session_delta: dict[str, Any] = {}
     if event.actions and event.actions.state_delta:
       deltas = _session_util.extract_state_delta(event.actions.state_delta)
       app_delta = deltas.get("app", {})
       user_delta = deltas.get("user", {})
+      session_delta = deltas.get("session", {})
 
       if app_delta:
         app_key = self._app_state_key(session.app_name)
@@ -387,9 +389,28 @@ async def append_event(self, session: Session, event: Event) -> Event:
     )
 
     key = self._session_key(session.app_name, session.user_id, session.id)
-    await client.set(
-        key,
-        storage_session.model_dump_json(),
-        ex=self.config.ttl_seconds if self.config.ttl_seconds > 0 else None,
-    )
+
+    async def append_to_storage(pipe: Any) -> None:
+      raw = await pipe.get(key)
+      if raw:
+        # The caller may hold a filtered view. Reload on every transaction
+        # attempt so concurrent appends are preserved as well.
+        stored_session = Session.model_validate_json(raw)
+        storage_session.events = stored_session.events
+        storage_session.state = stored_session.state
+        if not event.partial:
+          storage_session.events.append(event)
+          if session_delta:
+            storage_session.state.update(session_delta)
+      else:
+        storage_session.events = list(session.events)
+        storage_session.state = dict(session_only_state)
+      pipe.multi()
+      pipe.set(
+          key,
+          storage_session.model_dump_json(),
+          ex=self.config.ttl_seconds if self.config.ttl_seconds > 0 else None,
+      )
+
+    await client.transaction(append_to_storage, key)
     return event
```

**File**: `tests/unittests/integrations/redis/_fake_redis.py` (modified, +25/-0)
```diff
@@ -17,7 +17,11 @@
 from __future__ import annotations
 
 from collections.abc import AsyncIterator
+from collections.abc import Awaitable
+from collections.abc import Callable
 import re
+from typing import Any
+from unittest.mock import Mock
 
 
 class FakeRedisAsync:
@@ -29,6 +33,7 @@ def __init__(self) -> None:
     self._created_at: dict[str, float] = {}
     self._current_time: float = 0.0
     self.scan_patterns: list[str] = []
+    self._versions: dict[str, int] = {}
 
   def advance_time(self, seconds: float) -> None:
     self._current_time += seconds
@@ -43,6 +48,7 @@ def _is_expired(self, key: str) -> bool:
         self._store.pop(key, None)
         self._ex_store.pop(key, None)
         self._created_at.pop(key, None)
+        self._versions[key] = self._versions.get(key, 0) + 1
         return True
     return False
 
@@ -63,16 +69,35 @@ async def set(
     self._store[key] = value
     self._ex_store[key] = ex
     self._created_at[key] = self._current_time
+    self._versions[key] = self._versions.get(key, 0) + 1
     return True
 
   async def delete(self, key: str) -> int:
     self._ex_store.pop(key, None)
     self._created_at.pop(key, None)
     if key in self._store:
       del self._store[key]
+      self._versions[key] = self._versions.get(key, 0) + 1
       return 1
     return 0
 
+  async def transaction(
+      self, func: Callable[[Any], Awaitable[None]], key: str
+  ) -> list[bool | None]:
+    """Retries a queued write if the watched key changed or expired."""
+    while True:
+      self._is_expired(key)
+      version = self._versions.get(key, 0)
+      pipe = Mock(get=self.get)
+      await func(pipe)
+      self._is_expired(key)
+      if self._versions.get(key, 0) != version:
+        continue
+      return [
+          await self.set(*call.args, **call.kwargs)
+          for call in pipe.set.call_args_list
+      ]
+
   @staticmethod
   def _glob_match(pattern: str, key: str) -> bool:
     """Matches a key the way Redis glob-style patterns do."""
```

**File**: `tests/unittests/integrations/redis/test_redis_session_service.py` (modified, +169/-0)
```diff
@@ -25,6 +25,7 @@
 from google.adk.integrations.redis._config import RedisSessionServiceConfig
 from google.adk.integrations.redis._redis_session_service import RedisSessionService
 from google.adk.sessions.base_session_service import GetSessionConfig
+from google.genai import types
 import pytest
 
 from ._fake_redis import FakeRedisAsync
@@ -177,6 +178,174 @@ async def test_get_session_with_after_timestamp(session_service):
   assert [e.author for e in fetched.events] == ["user_3", "user_4"]
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "config, start",
+    [
+        (None, 0),
+        (GetSessionConfig(num_recent_events=2), 2),
+        (GetSessionConfig(num_recent_events=0), 4),
+        (GetSessionConfig(after_timestamp=102), 2),
+        (GetSessionConfig(num_recent_events=3, after_timestamp=102), 2),
+    ],
+)
+async def test_append_event_preserves_filtered_history(
+    session_service, config, start
+):
+  """A filtered view can grow without removing stored events."""
+  session = await session_service.create_session(
+      app_name="app1", user_id="u1", state={"original": "value"}
+  )
+  events = [
+      Event(
+          author="user",
+          invocation_id=f"invocation-{i}",
+          timestamp=100.0 + i,
+          content=types.Content(parts=[types.Part(text=f"event-{i}")]),
+      )
+      for i in range(6)
+  ]
+  for event in events[:4]:
+    await session_service.append_event(session, event)
+  view = await session_service.get_session(
+      app_name="app1", user_id="u1", session_id=session.id, config=config
+  )
+  assert view.events == events[start:4]
+  events[4].actions.state_delta = {
+      "added": 1,
+      "app:mode": "test",
+      "user:theme": "dark",
+      "temp:scratch": "local",
+  }
+
+  for event in events[4:]:
+    assert await session_service.append_event(view, event) is event
+
+  stored = await session_service.get_session(
+      app_name="app1", user_id="u1", session_id=session.id
+  )
+  assert stored.events == events
+  assert view.events == events[start:]
+  assert stored.state == {
+      "original": "value",
+      "added": 1,
+      "app:mode": "test",
+      "user:theme": "dark",
+  }
+  assert view.state["temp:scratch"] == "local"
+  assert "temp:scratch" not in stored.events[4].actions.state_delta
+
+
+@pytest.mark.asyncio
+async def test_partial_event_preserves_filtered_history(session_service):
+  session = await session_service.create_session(app_name="app1", user_id="u1")
+  old_event = Event(author="user", invocation_id="old")
+  await session_service.append_event(session, old_event)
+  view = await session_service.get_session(
+      app_name="app1",
+      user_id="u1",
+      session_id=session.id,
+      config=GetSessionConfig(num_recent_events=0),
+  )
+  partial = Event(author="agent", invocation_id="partial", partial=True)
+
+  assert await session_service.append_event(view, partial) is partial
+
+  stored = await session_service.get_session(
+      app_name="app1", user_id="u1", session_id=session.id
+  )
+  assert stored.events == [old_event]
+  assert view.events == []
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("change", ["append", "delete", "expire"])
+async def test_append_event_retries_storage_changes(
+    session_service, fake_redis, monkeypatch, change
+):
+  """A concurrent append is retained; missing storage keeps recreation behavior."""
+  session = await session_service.create_session(app_name="app1", user_id="u1")
+  old_event = Event(author="user", invocation_id="old")
+  await session_service.append_event(session, old_event)
+  view = await session_service.get_session(
+      app_name="app1",
+      user_id="u1",
+      session_id=session.id,
+      config=GetSessionConfig(num_recent_events=0),
+  )
+  other_event = Event(author="agent", invocation_id="other")
+  new_event = Event(author="user", invocation_id="new")
+  key = session_service._session_key("app1", "u1", session.id)
+  original_get = fake_redis.get
+  changed = False
+
+  async def get_with_concurrent_change(read_key):
+    nonlocal changed
+    raw = await original_get(read_key)
+    if read_key == key and not changed:
+      changed = True
+      if change == "append":
+        await session_service.append_event(session, other_event)
+      elif change == "delete":
+        await session_service.delete_session(
+            app_name="app1", user_id="u1", session_id=session.id
+        )
+      else:
+        fake_redis.advance_time(3601)
+    return raw
+
+  monkeypatch.setattr(fake_redis, "get", get_with_concurrent_change)
+  await session_service.append_event(view, new_event)
+
+  stored = await session_service.get_session(
+      app_name="app1", user_id="u1", session_id=session.id
+  )
+  expected = [old_event, other_event] if change == "append" else []
+  assert stored.events == expected + [new_event]
+  assert view.events == [new_event]
+  fake_redis.advance_time(3599)
+  assert await original_get(key) is not None
+  fake_redi
```

---

### Incident Patch 14: `531f4101` (2026-10-05)
**Commit Message**: fix: count ID-less responses when resuming parallel calls

Merge https://github.com/google/adk-python/pull/7388

Fixes #7387

PiperOrigin-RevId: 993764397

**File**: `src/google/adk/flows/llm_flows/core/_resume.py` (modified, +21/-14)
```diff
@@ -24,6 +24,7 @@
 
 from __future__ import annotations
 
+from collections import Counter
 import dataclasses
 import enum
 from typing import Any
@@ -216,8 +217,9 @@ def _unexecuted_calls_event(
 ) -> Event | None:
   """`call_event` cut down to the calls that never ran, or None if all did.
 
-  A call ran when a response in `later_events` carries its id, or its name
-  with no id. None is also returned once the agent has written any event with
+  A call ran when a response in `later_events` carries its id. Responses with
+  no id each match one remaining same-name call, in call order. None is also
+  returned once the agent has written any event with
   content after `call_event`: tool responses and auth or confirmation requests
   are only written after the whole batch ran, so a call still missing its
   response then ran and lost it, or is pending.
@@ -229,19 +231,24 @@ def _unexecuted_calls_event(
     return None
   responses = [fr for ev in later_events for fr in ev.get_function_responses()]
   answered_ids = {fr.id for fr in responses if fr.id is not None}
-  answered_names = {fr.name for fr in responses if fr.id is None}
-  unexecuted_ids = {
-      fc.id
-      for fc in call_event.get_function_calls()
-      if fc.id not in answered_ids and fc.name not in answered_names
-  }
-  if not unexecuted_ids or call_event.content is None:
+  answered_names = Counter(fr.name for fr in responses if fr.id is None)
+  if call_event.content is None:
+    return None
+  parts = []
+  has_unexecuted_call = False
+  for part in call_event.content.parts or []:
+    if (call := part.function_call) is None:
+      parts.append(part)
+    elif call.id in answered_ids:
+      # Explicit IDs take precedence without consuming a name-only response.
+      continue
+    elif answered_names[call.name]:
+      answered_names[call.name] -= 1
+    else:
+      parts.append(part)
+      has_unexecuted_call = True
+  if not has_unexecuted_call:
     return None
-  parts = [
-      part
-      for part in call_event.content.parts or []
-      if part.function_call is None or part.function_call.id in unexecuted_ids
-  ]
   return call_event.model_copy(
       update={'content': call_event.content.model_copy(update={'parts': parts})}
   )
```

**File**: `tests/unittests/flows/llm_flows/core/test_resume.py` (modified, +85/-1)
```diff
@@ -79,7 +79,7 @@ def _response_event(
   )
 
 
-def _parallel_call_event(calls: list[tuple[str, str]]) -> Event:
+def _parallel_call_event(calls: list[tuple[str, str | None]]) -> Event:
   return Event(
       author='agent',
       invocation_id='inv-1',
@@ -366,6 +366,90 @@ def test_response_without_an_id_answers_its_call_by_name(self):
     )
     assert _replayed_ids(decision) == ['c2']
 
+  @pytest.mark.parametrize(
+      ('call_ids', 'response_ids', 'replayed_ids'),
+      [
+          (['c1', 'c2'], [None], ['c2']),
+          (['c1', 'c2'], [None, None], []),
+          (['c1', 'c2'], [None, None, None], []),
+          (['c1', 'c2', 'c3'], [None, 'c1'], ['c3']),
+          (['c1', 'c2', 'c3'], ['c1', None], ['c3']),
+          (['c1', 'c2'], ['c1', 'c1'], ['c2']),
+          (['c1', 'c2'], [None, 'other'], ['c2']),
+          ([None, None], [None], [None]),
+          ([None, 'c2', None], [None, 'c2'], [None]),
+      ],
+      ids=[
+          'one_idless_response',
+          'all_idless_responses',
+          'extra_idless_response',
+          'idless_before_explicit_id',
+          'explicit_id_before_idless',
+          'duplicate_explicit_id',
+          'unmatched_explicit_id',
+          'idless_calls',
+          'mixed_call_ids',
+      ],
+  )
+  def test_same_name_responses_answer_only_matching_calls(
+      self,
+      call_ids: list[str | None],
+      response_ids: list[str | None],
+      replayed_ids: list[str | None],
+  ) -> None:
+    """Each ID-less response covers one call after explicit IDs are matched."""
+    call = _parallel_call_event([('ask', call_id) for call_id in call_ids])
+    # Distinct arguments identify ID-less siblings even when their IDs match.
+    for index, part in enumerate(call.content.parts):
+      part.function_call.args = {'index': index}
+    responses = [_response_event('ask', call_id) for call_id in response_ids]
+    events = [call, *responses]
+    original_events = [event.model_copy(deep=True) for event in events]
+
+    decision = decide_resume(self._ctx(), events, {'ask': object()})
+
+    if replayed_ids:
+      assert decision.action is ResumeAction.REPLAY_CALLS
+      assert _replayed_ids(decision) == replayed_ids
+      assert decision.replay_event().get_function_calls()[-1].args == {
+          'index': len(call_ids) - 1
+      }
+    else:
+      assert decision.action is ResumeAction.CONTINUE
+    assert events == original_events
+
+  def test_idless_response_replay_preserves_other_content_parts(self) -> None:
+    """Filtering calls retains non-call parts in their original order."""
+    call = _parallel_call_event([('ask', 'c1'), ('ask', 'c2')])
+    call.content.parts.insert(0, types.Part(text='Before calls'))
+    call.content.parts.insert(2, types.Part(text='Between calls'))
+    call.content.parts.append(types.Part(text='After calls'))
+    original_call = call.model_copy(deep=True)
+
+    decision = decide_resume(
+        self._ctx(), [call, _response_event('ask', None)], {'ask': object()}
+    )
+
+    assert decision.action is ResumeAction.REPLAY_CALLS
+    assert decision.replay_event().content.parts == [
+        call.content.parts[0],
+        call.content.parts[2],
+        call.content.parts[3],
+        call.content.parts[4],
+    ]
+    assert call == original_call
+
+  def test_idless_response_after_agent_batch_completion_does_not_replay(
+      self,
+  ) -> None:
+    """An agent-authored batch result prevents replay of a pending sibling."""
+    call = _parallel_call_event([('ask', 'c1'), ('ask', 'c2')])
+    events = [call, _response_event('ask', None, author='agent')]
+
+    decision = decide_resume(self._ctx(), events, {'ask': object()})
+
+    assert decision.action is ResumeAction.CONTINUE
+
   def test_sibling_missing_a_response_after_an_auth_resume_is_not_replayed(
       self,
   ):
```

**File**: `tests/unittests/flows/llm_flows/test_base_llm_flow.py` (modified, +76/-0)
```diff
@@ -53,6 +53,7 @@
 from google.adk.tools.base_toolset import BaseToolset
 from google.adk.tools.enterprise_search_tool import EnterpriseWebSearchTool
 from google.adk.tools.google_search_tool import GoogleSearchTool
+from google.adk.tools.tool_context import ToolContext
 from google.adk.utils.context_utils import Aclosing
 from google.adk.utils.variant_utils import GoogleLLMVariant
 from google.genai import types
@@ -2989,6 +2990,81 @@ async def test_resume_short_circuit_skips_partial_function_call():
   assert not any(e.actions and e.actions.transfer_to_agent for e in events)
 
 
+@pytest.mark.parametrize(
+    ('response_ids', 'expected_executions'),
+    [([None], [1, 2]), ([None, 'c1'], [2]), (['c1', None], [2])],
+    ids=['idless', 'idless_before_explicit_id', 'explicit_id_before_idless'],
+)
+async def test_resume_executes_only_unanswered_same_name_calls(
+    response_ids: list[str | None], expected_executions: list[int]
+) -> None:
+  """Restored ID-less responses do not hide unexecuted same-name siblings."""
+  executions = []
+
+  def ask(index: int, tool_context: ToolContext) -> dict[str, int]:
+    executions.append(index)
+    tool_context.actions.skip_summarization = True
+    return {'index': index}
+
+  agent = Agent(
+      name='root_agent',
+      model=testing_utils.MockModel.create(responses=['No replay occurred']),
+      tools=[ask],
+  )
+  invocation_context = await testing_utils.create_invocation_context(
+      agent=agent, user_content='Resume the saved calls'
+  )
+  invocation_context.resumability_config = ResumabilityConfig(is_resumable=True)
+  call_event = Event(
+      invocation_id=invocation_context.invocation_id,
+      author=agent.name,
+      content=types.Content(
+          role='model',
+          parts=[
+              types.Part(
+                  function_call=types.FunctionCall(
+                      id=f'c{index + 1}', name='ask', args={'index': index}
+                  )
+              )
+              for index in range(3)
+          ],
+      ),
+  )
+  response_events = [
+      Event(
+          invocation_id=invocation_context.invocation_id,
+          author='user',
+          content=types.Content(
+              role='user',
+              parts=[
+                  types.Part(
+                      function_response=types.FunctionResponse(
+                          id=response_id,
+                          name='ask',
+                          response={'result': 'saved'},
+                      )
+                  )
+              ],
+          ),
+      )
+      for response_id in response_ids
+  ]
+  invocation_context.session.events.extend([call_event, *response_events])
+  original_call = call_event.model_copy(deep=True)
+
+  events = [
+      event async for event in agent._llm_flow.run_async(invocation_context)
+  ]
+
+  assert sorted(executions) == expected_executions
+  assert [
+      response.id
+      for event in events
+      for response in event.get_function_responses()
+  ] == [f'c{index + 1}' for index in expected_executions]
+  assert call_event == original_call
+
+
 @pytest.mark.asyncio
 async def test_preprocess_final_response_skips_llm_call():
   """A final response from preprocessing must finish the current step."""
```

---

### Incident Patch 15: `cd5814ed` (2026-10-05)
**Commit Message**: fix: inject artifact text, not the Part repr, into instructions

Merge https://github.com/google/adk-python/pull/7391

`{artifact.<name>}` and Jinja2 `artifact("<name>")` in instructions now convert `types.Part` artifacts via `load_artifacts_tool.as_safe_part_for_llm` instead of rendering `str(Part)`.

PiperOrigin-RevId: 993763912

**File**: `docs/guides/utils/instructions_utils/index.md` (modified, +18/-15)
```diff
@@ -96,12 +96,14 @@ the syntax does not make obvious.
     extra thought.
 *   **`{artifact.filename}` loads a file instead of a state value.** The engine
     asks the artifact service for that artifact in the current session and
-    substitutes `str()` of what comes back. A missing artifact raises
+    converts a `types.Part` with `load_artifacts_tool.as_safe_part_for_llm`:
+    `Part.text` and text-like `inline_data` (`text/*`, JSON, XML, CSV, or DOCX)
+    are substituted as their text content, other binary blobs render as a
+    `[Binary artifact: ...]` placeholder, and Gemini-native inline media (such
+    as `image/*` or `application/pdf`) falls back to `str()`, which is the
+    Pydantic field dump rather than prompt text. A missing artifact raises
     `KeyError`, and `{artifact.filename?}` substitutes an empty string in the
-    same way the optional state form does. Check what that `str()` produces
-    before relying on the form: an artifact fetched from an artifact service is
-    a `types.Part`, and its `str()` is the whole Pydantic field dump rather than
-    the text you had in mind.
+    same way the optional state form does.
 
 A state key may carry one of the state prefixes, so `{app:theme}`,
 `{user:locale}`, and `{temp:draft}` all work, and read from the corresponding
@@ -266,16 +268,17 @@ function to instructions. Anywhere you hold a `ReadonlyContext`, and a
     missing, so it raises. `{customer name}` is not a valid name, so it is left
     in the prompt untouched and the model sees the braces. The two typos fail in
     completely different ways.
-*   **Artifacts are stringified, and that is almost never what you want.** Both
-    engines insert `str(artifact)`, and an artifact loaded from an artifact
-    service is a `types.Part`, whose `str()` is the Pydantic field dump. A
-    plain-text artifact reading "hello world" reaches the prompt as
-    `media_resolution=None code_execution_result=None ... text='hello world'
-    thought=None ...`, which is every field of the Part when only one of them
-    was what you wanted. Binary data is worse still. There is no option to
-    extract `.text`, so an
-    instruction that needs an artifact's contents should load it in Python and
-    interpolate the text itself rather than using `{artifact.name}`.
+*   **Binary and media artifacts cannot be inlined into an instruction.** Both
+    engines pass a loaded `types.Part` through
+    `load_artifacts_tool.as_safe_part_for_llm`, because an instruction is a
+    plain string: `Part.text` and text-like `inline_data` (`text/*`, JSON, XML,
+    CSV, or DOCX) unwrap to their text, other binary blobs render as a
+    `[Binary artifact: name, type, size]` placeholder, and Gemini-native media
+    (`image/*`, `audio/*`, `video/*`, `application/pdf`) or a `file_data`
+    reference has no `.text` and falls back to `str(artifact)`, which inserts
+    the Pydantic field dump into the prompt. Use `{artifact.name}` and
+    `artifact('name')` only for text artifacts, and pass binary or media
+    artifacts to the model as content parts instead.
 *   **A callable instruction gets no injection.** The omission is deliberate,
     on the assumption that a function with access to the context can interpolate
     for itself, and it is the reason to call this function yourself.
```

**File**: `src/google/adk/flows/llm_flows/prompt/_instructions_utils.py` (modified, +13/-2)
```diff
@@ -22,10 +22,12 @@
 from typing import Callable
 from typing import Union
 
+from google.genai import types
 from typing_extensions import TypeAlias
 
 from ....agents.readonly_context import ReadonlyContext
 from ....sessions.state import State
+from ....tools import load_artifacts_tool
 
 __all__ = [
     'InstructionProvider',
@@ -43,6 +45,15 @@
 _TEMPLATE_VAR_PATTERN = re.compile(r'(?<![\$\{\\]){+[^{}]*}+')
 
 
+def _artifact_to_text(artifact: object, artifact_name: str) -> str:
+  """Renders a loaded artifact as instruction text."""
+  if isinstance(artifact, types.Part):
+    safe = load_artifacts_tool.as_safe_part_for_llm(artifact, artifact_name)
+    if safe.text is not None:
+      return safe.text
+  return str(artifact)
+
+
 async def inject_session_state(
     template: str,
     readonly_context: ReadonlyContext,
@@ -164,7 +175,7 @@ async def _replace_match(match: re.Match[str]) -> str:
               f"Artifact '{var_name}' not found in agent"
               f" '{readonly_context.agent_name}'."
           )
-      return str(artifact)
+      return _artifact_to_text(artifact, var_name)
     else:
       if not _is_valid_state_name(var_name):
         return str(match.group())
@@ -238,7 +249,7 @@ async def _load_artifact(filename: str) -> str:
           f"Artifact '{filename}' not found in agent"
           f" '{readonly_context.agent_name}'."
       )
-    return str(artifact)
+    return _artifact_to_text(artifact, filename)
 
   env = SandboxedEnvironment(
       enable_async=True,
```

**File**: `tests/unittests/flows/llm_flows/prompt/test_instructions_utils.py` (modified, +54/-0)
```diff
@@ -19,10 +19,12 @@
 from google.adk.agents.llm_agent import Agent
 from google.adk.agents.llm_agent import InstructionProvider as LlmAgentInstructionProvider
 from google.adk.agents.readonly_context import ReadonlyContext
+from google.adk.artifacts import InMemoryArtifactService
 from google.adk.flows.llm_flows.prompt import _instructions_utils as instructions_utils
 from google.adk.flows.llm_flows.prompt._instructions_utils import _is_valid_state_name
 from google.adk.flows.llm_flows.prompt._instructions_utils import InstructionProvider
 from google.adk.sessions.session import Session
+from google.genai import types
 import pytest
 
 from .... import testing_utils
@@ -566,3 +568,55 @@ async def test_inject_session_state_jinja2_state_mapping_is_read_only():
         use_jinja2=True,
     )
   assert invocation_context.session.state == {"user:name": "Foo", "count": 1}
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    "use_jinja2,template",
+    [
+        (False, "Notes: {artifact.notes}"),
+        (True, "Notes: {{ artifact('notes') }}"),
+    ],
+    ids=["regex", "jinja2"],
+)
+@pytest.mark.parametrize(
+    "artifact,expected",
+    [
+        (types.Part(text="Buy milk."), "Notes: Buy milk."),
+        (
+            types.Part.from_bytes(data=b"Buy milk.", mime_type="text/plain"),
+            "Notes: Buy milk.",
+        ),
+        (
+            types.Part.from_bytes(
+                data=b"\x00\x01\x02\x03", mime_type="application/octet-stream"
+            ),
+            (
+                "Notes: [Binary artifact: notes, type:"
+                " application/octet-stream, size: 0.0 KB. Content cannot be"
+                " displayed inline.]"
+            ),
+        ),
+    ],
+    ids=["text_part", "text_inline_data", "binary_inline_data"],
+)
+async def test_inject_session_state_artifact_part_renders_as_text(
+    use_jinja2, template, artifact, expected
+):
+  artifact_service = InMemoryArtifactService()
+  await artifact_service.save_artifact(
+      app_name="test_app",
+      user_id="test_user",
+      session_id="test_session_id",
+      filename="notes",
+      artifact=artifact,
+  )
+  invocation_context = await _create_test_readonly_context(
+      artifact_service=artifact_service
+  )
+
+  populated_instruction = await instructions_utils.inject_session_state(
+      template, invocation_context, use_jinja2=use_jinja2
+  )
+
+  assert populated_instruction == expected
```

#### Recent Merged Pull Requests:
- **PR #7399** (closed): docs: correct Redis session retention and configuration defaults (@BichengWang)
- **PR #7391** (closed): fix(flows): inject artifact text, not the Part repr, into instructions (@AtulJoshi1206)
- **PR #7388** (closed): fix(flows): count ID-less responses when resuming parallel calls (@SoroushRF)
- **PR #7376** (closed): fix(models): send temperature and top_p on interactions API requests (@donggyun112)
- **PR #7374** (closed): chore: merge release v2.11.0 to main (@adk-bot)
- **PR #7373** (2026-10-02): chore(release/candidate): release 2.11.0 (@adk-bot)
- **PR #7372** (closed): chore: update compiled adk web assets (@adk-bot)
- **PR #7371** (closed): chore(release/candidate): release 2.11.0 (@adk-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
