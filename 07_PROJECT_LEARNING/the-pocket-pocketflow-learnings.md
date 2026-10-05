# Forensic Learning Record (Deep Inspection): The-Pocket/PocketFlow

> **Canonical Artifact**: `07_PROJECT_LEARNING/the-pocket-pocketflow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/The-Pocket/PocketFlow](https://github.com/The-Pocket/PocketFlow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:36:42.696Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `The-Pocket/PocketFlow`
- **Description**: Pocket Flow: 100-line LLM framework. Let Agents build Agents!
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 11220 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cookbook/pocketflow-a2a/common/server/utils.py`
```
from common.types import (
    JSONRPCResponse,
    ContentTypeNotSupportedError,
    UnsupportedOperationError,
)
from typing import List


def are_modalities_compatible(
    server_output_modes: List[str], client_output_modes: List[str]
):
    """Modalities are compatible if they are both non-empty
    and there is at least one common element."""
    if client_output_modes is None or len(client_output_modes) == 0:
        return True

    if server_output_modes is None or len(server_output_modes) == 0:
        return True

    return any(x in server_output_modes for x in client_output_modes)


def new_incompatible_types_error(request_id):
    return JSONRPCResponse(id=request_id, error=ContentTypeNotSupportedError())


def new_not_implemented_error(request_id):
    return JSONRPCResponse(id=request_id, error=UnsupportedOperationError())

```

### Core Architecture Module: `cookbook/pocketflow-a2a/common/utils/in_memory_cache.py`
```
"""In Memory Cache utility."""

import threading
import time
from typing import Any, Dict, Optional


class InMemoryCache:
    """A thread-safe Singleton class to manage cache data.

    Ensures only one instance of the cache exists across the application.
    """

    _instance: Optional["InMemoryCache"] = None
    _lock: threading.Lock = threading.Lock()
    _initialized: bool = False

    def __new__(cls):
        """Override __new__ to control instance creation (Singleton pattern).

        Uses a lock to ensure thread safety during the first instantiation.

        Returns:
            The singleton instance of InMemoryCache.
        """
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        """Initialize the cache storage.

        Uses a flag (_initialized) to ensure this logic runs only on the very first
        creation of the singleton instance.
        """
        if not self._initialized:
            with self._lock:
                if not self._initialized:
                    # print("Initializing SessionCache storage")
                    self._cache_data: Dict[str, Dict[str, Any]] = {}
                    self._ttl: Dict[str, float] = {}
                    self._data_lock: threading.Lock = threading.Lock()
                    self._initialized = True

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set a key-value pair.

        Args:
            key: The key for the data.
            value: The data to store.
            ttl: Time to live in seconds. If None, data will not expire.
        """
        with self._data_lock:
            self._cache_data[key] = value

            if ttl is not None:
                self._ttl[key] = time.time() + ttl
            else:
                if key in self._ttl:
                    del self._ttl[key]

    def get(self, key: str, default: Any = None) -> Any:
        """Get the value associated with a key.

        Args:
            key: The key for the data within the session.
            default: The value to return if the session or key is not found.

        Returns:
            The cached value, or the default value if not found.
        """
        with self._data_lock:
            if key in self._ttl and time.time() > self._ttl[key]:
                del self._cache_data[key]
                del self._ttl[key]
                return default
            return self._cache_data.get(key, default)

    def delete(self, key: str) -> None:
        """Delete a specific key-value pair from a cache.

        Args:
            key: The key to delete.

        Returns:
            True if the key was found and deleted, False otherwise.
        """

        with self._data_lock:
            if key in self._cache_data:
                del self._cache_data[key]
                if key in self._ttl:
                    del self._ttl[key]
                return True
            return False

    def clear(self) -> bool:
        """Remove all data.

        Returns:
            True if the data was cleared, False otherwise.
        """
        with self._data_lock:
            self._cache_data.clear()
            self._ttl.clear()
            return True
        return False

```

### Core Architecture Module: `cookbook/pocketflow-a2a/common/utils/push_notification_auth.py`
```
from jwcrypto import jwk
import uuid
from starlette.responses import JSONResponse
from starlette.requests import Request
from typing import Any

import jwt
import time
import json
import hashlib
import httpx
import logging

from jwt import PyJWK, PyJWKClient

logger = logging.getLogger(__name__)
AUTH_HEADER_PREFIX = 'Bearer '

class PushNotificationAuth:
    def _calculate_request_body_sha256(self, data: dict[str, Any]):
        """Calculates the SHA256 hash of a request body.

        This logic needs to be same for both the agent who signs the payload and the client verifier.
        """
        body_str = json.dumps(
            data,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        )
        return hashlib.sha256(body_str.encode()).hexdigest()

class PushNotificationSenderAuth(PushNotificationAuth):
    def __init__(self):
        self.public_keys = []
        self.private_key_jwk: PyJWK = None

    @staticmethod
    async def verify_push_notification_url(url: str) -> bool:
        async with httpx.AsyncClient(timeout=10) as client:
            try:
                validation_token = str(uuid.uuid4())
                response = await client.get(
                    url,
                    params={"validationToken": validation_token}
                )
                response.raise_for_status()
                is_verified = response.text == validation_token

                logger.info(f"Verified push-notification URL: {url} => {is_verified}")            
                return is_verified                
            except Exception as e:
                logger.warning(f"Error during sending push-notification for URL {url}: {e}")

        return False

    def generate_jwk(self):
        key = jwk.JWK.generate(kty='RSA', size=2048, kid=str(uuid.uuid4()), use="sig")
        self.public_keys.append(key.export_public(as_dict=True))
        self.private_key_jwk = PyJWK.from_json(key.export_private())
    
    def handle_jwks_endpoint(self, _request: Request):
        """Allow clients to fetch public keys.
        """
        return JSONResponse({
            "keys": self.public_keys
        })
    
    def _generate_jwt(self, data: dict[str, Any]):
        """JWT is generated by signing both the request payload SHA digest and time of token generation.

        Payload is signed with private key and it ensures the integrity of payload for client.
        Including iat prevents from replay attack.
        """
        
        iat = int(time.time())

        return jwt.encode(
            {"iat": iat, "request_body_sha256": self._calculate_request_body_sha256(data)},
            key=self.private_key_jwk,
            headers={"kid": self.private_key_jwk.key_id},
            algorithm="RS256"
        )

    async def send_push_notification(self, url: str, data: dict[str, Any]):
        jwt_token = self._generate_jwt(data)
        headers = {'Authorization': f"Bearer {jwt_token}"}
        async with httpx.AsyncClient(timeout=10) as client: 
            try:
                response = await client.post(
                    url,
                    json=data,
                    headers=headers
                )
                response.raise_for_status()
                logger.info(f"Push-notification sent for URL: {url}")                            
            except Exception as e:
                logger.warning(f"Error during sending push-notification for URL {url}: {e}")

class PushNotificationReceiverAuth(PushNotificationAuth):
    def __init__(self):
        self.public_keys_jwks = []
        self.jwks_client = None

    async def load_jwks(self, jwks_url: str):
        self.jwks_client = PyJWKClient(jwks_url)
    
    async def verify_push_notification(self, request: Request) -> bool:
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith(AUTH_HEADER_PREFIX):
            print("Invalid authorization header")
            return False
        
        token = auth_header[len(AUTH_HEADER_PREFIX):]
        signing_key = self.jwks_client.get_signing_key_from_jwt(token)

        decode_token = jwt.decode(
            token,
            signing_key,
            options={"require": ["iat", "request_body_sha256"]},
            algorithms=["RS256"],
        )

        actual_body_sha256 = self._calculate_request_body_sha256(await request.json())
        if actual_body_sha256 != decode_token["request_body_sha256"]:
            # Payload signature does not match the digest in signed token.
            raise ValueError("Invalid request body")
        
        if time.time() - decode_token["iat"] > 60 * 5:
            # Do not allow push-notifications older than 5 minutes.
            # This is to prevent replay attack.
            raise ValueError("Token is expired")
        
        return True

```

### Core Architecture Module: `cookbook/pocketflow-a2a/utils.py`
```
from openai import OpenAI
import os
from duckduckgo_search import DDGS

def call_llm(prompt):    
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", "your-api-key"))
    r = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return r.choices[0].message.content

def search_web(query):
    results = DDGS().text(query, max_results=5)
    # Convert results to a string
    results_str = "\n\n".join([f"Title: {r['title']}\nURL: {r['href']}\nSnippet: {r['body']}" for r in results])
    return results_str
    
if __name__ == "__main__":
    print("## Testing call_llm")
    prompt = "In a few words, what is the meaning of life?"
    print(f"## Prompt: {prompt}")
    response = call_llm(prompt)
    print(f"## Response: {response}")

    print("## Testing search_web")
    query = "Who won the Nobel Prize in Physics 2024?"
    print(f"## Query: {query}")
    results = search_web(query)
    print(f"## Results: {results}")
```

### Core Architecture Module: `cookbook/pocketflow-agent-skills/utils.py`
```
from pathlib import Path
import os
from openai import OpenAI


def load_skills(skills_dir: str) -> dict[str, str]:
    skills = {}
    for md_file in sorted(Path(skills_dir).glob("*.md")):
        skills[md_file.stem] = md_file.read_text(encoding="utf-8")

    if not skills:
        raise ValueError(f"No skill files found in {skills_dir}")
    return skills


def call_llm(prompt: str) -> str:
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", "your-api-key"))
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content

```

### Core Architecture Module: `cookbook/pocketflow-agent/utils.py`
```
from openai import OpenAI
import os
from ddgs import DDGS
import requests

def call_llm(prompt):    
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", "your-api-key"))
    r = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return r.choices[0].message.content

def search_web_duckduckgo(query):
    results = DDGS().text(query, max_results=5)
    # Convert results to a string
    results_str = "\n\n".join([f"Title: {r['title']}\nURL: {r['href']}\nSnippet: {r['body']}" for r in results])
    return results_str

def search_web_brave(query):

    url = f"https://api.search.brave.com/res/v1/web/search?q={query}"
    api_key = "your brave search api key"

    headers = {
        "accept": "application/json",
        "Accept-Encoding": "gzip",
        "x-subscription-token": api_key
    }

    response = requests.get(url, headers=headers)

    if response.status_code == 200:
        data = response.json()
        results = data['web']['results']
        results_str = "\n\n".join([f"Title: {r['title']}\nURL: {r['url']}\nDescription: {r['description']}" for r in results])     
    else:
        print(f"Request failed with status code: {response.status_code}")
    return results_str
    
if __name__ == "__main__":
    print("## Testing call_llm")
    prompt = "In a few words, what is the meaning of life?"
    print(f"## Prompt: {prompt}")
    response = call_llm(prompt)
    print(f"## Response: {response}")

    print("## Testing search_web")
    query = "Who won the Nobel Prize in Physics 2024?"
    print(f"## Query: {query}")
    results = search_web_duckduckgo(query)
    print(f"## Results: {results}")
```

### Core Architecture Module: `cookbook/pocketflow-agentic-rag/utils.py`
```
import os

def call_llm(prompt):
    """Call LLM — auto-detects OpenAI or Gemini based on available API key."""
    if os.environ.get("OPENAI_API_KEY"):
        from openai import OpenAI
        client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        r = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}]
        )
        return r.choices[0].message.content
    elif os.environ.get("GEMINI_API_KEY"):
        from google import genai
        client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
        r = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        return r.text
    else:
        raise ValueError("Set OPENAI_API_KEY or GEMINI_API_KEY")

# Document store — summaries about PocketFlow concepts
DOCS = {
    "overview": "PocketFlow is a 100-line LLM framework. Core abstraction: Graph with Nodes and Flows. Zero dependencies.",
    "nodes": "Nodes have prep/exec/post. prep reads shared store, exec does work (LLM calls), post writes back. Only exec retries on failure. BatchNode handles lists.",
    "flows": "Flows connect nodes: >> chains, action strings branch, self-loops loop. Flow is also a Node, so flows nest inside flows.",
    "rag": "RAG = Retrieval Augmented Generation. Offline: chunk, embed, store. Online: embed query, retrieve top-K, generate answer with context.",
    "agents": "An agent is an LLM + tools + loop. DecideNode picks an action, tool nodes execute, loop back. ReAct pattern: Reason, Act, Observe, Repeat.",
}

if __name__ == "__main__":
    print("=== Testing call_llm ===")
    prompt = "In a few words, what is the meaning of life?"
    print(f"Prompt: {prompt}")
    response = call_llm(prompt)
    print(f"Response: {response}")

    print("\n=== Testing DOCS store ===")
    for name, summary in DOCS.items():
        print(f"  [{name}]: {summary[:60]}...")

```

### Core Architecture Module: `cookbook/pocketflow-async-basic/utils.py`
```
import asyncio
import aiohttp
from openai import AsyncOpenAI

async def fetch_recipes(ingredient):
    """Fetch recipes from an API asynchronously."""
    print(f"Fetching recipes for {ingredient}...")
    
    # Simulate API call with delay
    await asyncio.sleep(1)
    
    # Mock recipes (in real app, would fetch from API)
    recipes = [
        f"{ingredient} Stir Fry",
        f"Grilled {ingredient} with Herbs",
        f"Baked {ingredient} with Vegetables"
    ]
    
    print(f"Found {len(recipes)} recipes.")
    
    return recipes

async def call_llm_async(prompt):
    """Make async LLM call."""
    print("\nSuggesting best recipe...")
    
    # Simulate LLM call with delay
    await asyncio.sleep(1)
    
    # Mock LLM response (in real app, would call OpenAI)
    recipes = prompt.split(": ")[1].split(", ")
    suggestion = recipes[1]  # Always suggest second recipe
    
    print(f"How about: {suggestion}")
    return suggestion

async def get_user_input(prompt):
    """Get user input asynchronously."""
    # Create event loop to handle async input
    loop = asyncio.get_event_loop()
    
    # Get input in a non-blocking way
    answer = await loop.run_in_executor(None, input, prompt)

    return answer.lower() 
```

### Core Architecture Module: `cookbook/pocketflow-batch/utils.py`
```
from anthropic import Anthropic
import os

def call_llm(prompt):
    client = Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY", "your-api-key"))
    response = client.messages.create(
        model="claude-3-7-sonnet-20250219",
        max_tokens=20000,
        thinking={
            "type": "enabled",
            "budget_tokens": 16000
        },
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    return response.content[1].text

if __name__ == "__main__":
    print("## Testing call_llm")
    prompt = "In a few words, what is the meaning of life?"
    print(f"## Prompt: {prompt}")
    response = call_llm(prompt)
    print(f"## Response: {response}")
```

### Core Architecture Module: `cookbook/pocketflow-browser-agent/utils.py`
```
from openai import OpenAI
import base64
import os
import yaml


def call_llm(prompt, image=None):
    """Call the LLM. Pass `image` (PNG bytes) to use a vision model on a screenshot."""
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", "your-api-key"))
    if image is None:
        content = prompt
    else:
        b64 = base64.b64encode(image).decode()
        content = [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
        ]
    r = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": content}],
        temperature=0,
    )
    return r.choices[0].message.content


def parse_yaml(reply):
    """Pull the ```yaml block out of an LLM reply and parse it into a dict."""
    if "```" in reply:
        reply = reply.split("```")[1]
        if reply.startswith("yaml"):
            reply = reply[len("yaml"):]
    return yaml.safe_load(reply)


if __name__ == "__main__":
    print("## Testing call_llm")
    prompt = "In a few words, what is the meaning of life?"
    print(f"## Prompt: {prompt}")
    response = call_llm(prompt)
    print(f"## Response: {response}")

```

### Core Architecture Module: `cookbook/pocketflow-chat-guardrail/utils.py`
```
from openai import OpenAI
import os

def call_llm(messages):
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY", "your-api-key"))
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        temperature=0.7
    )
    
    return response.choices[0].message.content

if __name__ == "__main__":
    # Test the LLM call
    messages = [{"role": "user", "content": "In a few words, what's the meaning of life?"}]
    response = call_llm(messages)
    print(f"Prompt: {messages[0]['content']}")
    print(f"Response: {response}")

```

### Core Architecture Module: `cookbook/pocketflow-chat-memory/utils/__init__.py`
```


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #145** (2026-08-12): **AsyncBatchNode and AsyncParallelBatchNode crash when prep_async returns None**
  *Symptoms*: `BatchNode._exec` iterates `(items or [])` but the two async versions iterate `items` directly. the default `prep_async` returns None, so an async batch node that doesn't override it blows up where the sync one is fine.  ```python import asyncio from pocketflow import BatchNode, AsyncBatchNode  class Sync(BatchNode):     def prep(self, shared): pass     def exec(self, item): return item  class Async(AsyncBatchNode):     async def prep_async(self, shared): pass     async def exec_async(self, item): return item  Sync()._run({})                        # None asyncio.run(Async()._run_async({}))    # TypeError: 'NoneType' object is not iterable ```  `AsyncParallelBatchNode` does the same thing.  four of the six batch spots in `__init__.py` already guard for this (lines 37, 55, 92, 98). the two async batch nodes on 77 and 80 are the only ones that don't:  ``` 37  def _exec(self,items): return [super(BatchNode,self)._exec(i) for i in (items or [])] 55  pr=self.prep(shared) or [] 77  async def _exec(self,items): return [await super(AsyncBatchNode,self)._exec(i) for i in items] 80  async def _exec(self,items): return await asyncio.gather(*(super(AsyncParallelBatchNode,self)._exec(i) for i in items)) 92  pr=await self.prep_async(shared) or [] 98  pr=await self.prep_async(shared) or [] ```  happy to send a two line PR that just adds `(items or [])` to both, matching what the sync class already does, if that's the fix you want. 

- **Issue #143** (2026-07-13): **Polish docs and comments in PocketFlow (#119)**
  *Symptoms*: Small scoped patch based on the reported behavior.  Related to #119.

- **Issue #139** (2026-05-28): **Question about PocketFlow licensing and PocketFlow Creator**
  *Symptoms*: Hello,  First, thank you for creating PocketFlow. I have been studying the project and appreciate the work you have put into making LLM workflow and agent systems easier to build.  I am working on a related project called PocketFlow Creator. The goal is to provide a visual GUI for designing PocketFlow-style workflows, including selecting node types, configuring prompts and conditions, wiring nodes visually, and saving workflows as reusable projects. The intended user experience is inspired by tools such as Visual Basic and Delphi from the late 1990s and early 2000s, where users could build systems visually while editing the properties and behavior of individual components.  I also want to be transparent: I have already published an initial version of PocketFlow Creator under an MIT license. After publishing it, I realized that the PocketFlow repository does not appear to include a LICENSE file. I am not used to seeing public projects without an explicit license, but I should have confirmed the licensing terms before publishing anything related to the project.  Could you clarify what license you intend for PocketFlow?  In particular, I would like to know whether you would allow:  * use of PocketFlow as a dependency; * creation of tools that generate PocketFlow-compatible workflows; * modification or extension of PocketFlow code; * redistribution of related or derivative tools; and * possible commercial use in the future.  If PocketFlow Creator creates any licensing concern, pl

- **Issue #136** (2026-04-03): **Incomplete visualization tool**
  *Symptoms*: The visualization seems incomplete.  The examples in the repo cannot visualize router node that end to one node.  For example:  ```                    | -> task 1  ----| start -> router -> | -> task 2  ----| -> finish                    | -> task 3  ----| ```  start >> router router - "yes" >> task1 >> finish router - "No" >> task2 >> finish router - "Cancel" >> task3 >> finish  The d3 connecting line only appear on task1 -> finish, others are missing. 
  **Post-Mortem & Fix Analysis**:
  > Forget it, i just modify the code and use mermaid js instead.  Thank you

- **Issue #133** (2026-03-27): **Expand framework comparison table: new columns + new framework rows**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Hi, is this good to ship?

- **Issue #131** (2026-02-16): **cookbook: add Agent Skills example and README entry**
  *Symptoms*: Adds a new cookbook example: `cookbook/pocketflow-agent-skills` to demonstrate a practical Agent Skills pattern in PocketFlow.  What is included: - skill files as markdown (`skills/*.md`) - `SelectSkill` node for routing requests to a skill - `ApplySkill` node that injects skill instructions into the LLM prompt - runnable CLI entry (`main.py`) and setup docs (`README.md`, `requirements.txt`) - root README tutorial table entry  Validation run: `python3 -m py_compile cookbook/pocketflow-agent-skills/main.py cookbook/pocketflow-agent-skills/flow.py cookbook/pocketflow-agent-skills/nodes.py cookbook/pocketflow-agent-skills/utils.py`  Closes #128
  **Post-Mortem & Fix Analysis**:
  > this is cool and clean!

- **Issue #128** (2026-02-16): **Proposal:  Adding Agent Skills usage to cookbook**
  *Symptoms*: It appears that [Agent Skills](https://agentskills.io/) has emerged as a standard for extending agent capabilities and providing domain expertise. The framework enables:  - Packaging specialized knowledge into reusable instructions - Adding new capabilities to agents (e.g., creating presentations, building MCP servers) - etc  It would be valuable to include examples of Agent Skills usage in the cookbook. Are there any plans to incorporate this?

- **Issue #124** (2025-12-24): **Add requirements.txt for pocketflow-llm-streaming**
  *Symptoms*: I found out that requirements.txt for pocketflow-llm-streaming is missing, so I added one
  **Post-Mortem & Fix Analysis**:
  > @zachary62 hi, could you approve my pr

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

### Incident Patch 1: `8d9fdd56` (2026-02-16)
**Commit Message**: Merge pull request #121 from cctv1237/cookbook-agent-fix

Fixed cookbook agent issues

**File**: `cookbook/pocketflow-agent/nodes.py` (modified, +39/-8)
```diff
@@ -1,6 +1,7 @@
 from pocketflow import Node
 from utils import call_llm, search_web_duckduckgo
 import yaml
+import re
 
 class DecideAction(Node):
     def prep(self, shared):
@@ -44,22 +45,52 @@ def exec(self, inputs):
 thinking: |
     <your step-by-step reasoning process>
 action: search OR answer
-reason: <why you chose this action>
-answer: <if action is answer>
-search_query: <specific search query if action is search>
+reason: |
+    <why you chose this action - always use block scalar>
+answer: |
+    <if action is answer - always use block scalar, leave empty if searching>
+search_query: <specific search query if action is search (plain string)>
 ```
 IMPORTANT: Make sure to:
-1. Use proper indentation (4 spaces) for all multi-line fields
-2. Use the | character for multi-line text fields
-3. Keep single-line fields without the | character
+1. ALWAYS use the | block scalar for thinking, reason and answer so colons or quotes inside the text do not break YAML.
+2. Use proper indentation (4 spaces) for all multi-line fields under |.
+3. Keep search_query as a single line string without the | character.
 """
         
         # Call the LLM to make a decision
         response = call_llm(prompt)
         
         # Parse the response to get the decision
-        yaml_str = response.split("```yaml")[1].split("```")[0].strip()
-        decision = yaml.safe_load(yaml_str)
+        def extract_yaml_block(text):
+            """Extract YAML from a fenced code block, or fall back to the whole text."""
+            match = re.search(r"```yaml(.*?)```", text, re.DOTALL | re.IGNORECASE)
+            if match:
+                return match.group(1).strip()
+            return text.strip()
+
+        def parse_yaml_safely(block):
+            """Parse YAML, retrying with block scalars if colon characters caused issues."""
+            try:
+                return yaml.safe_load(block)
+            except yaml.YAMLError:
+                fixed_lines = []
+                for line in block.splitlines():
+                    if re.match(r"^(thinking|reason|answer|search_query):", line) and "|" not in line:
+                        key, _, val = line.partition(":")
+                        fixed_lines.append(f"{key}: |")
+                        val = val.strip()
+                        if val:
+                            fixed_lines.append(f"  {val}")
+                    else:
+                        fixed_lines.append(line)
+                fixed_block = "\n".join(fixed_lines)
+                try:
+                    return yaml.safe_load(fixed_block)
+                except yaml.YAMLError as exc:
+                    raise ValueError(f"Unable to parse LLM YAML response:\n{block}") from exc
+
+        yaml_str = extract_yaml_block(response)
+        decision = parse_yaml_safely(yaml_str)
         
         return decision
     
```

**File**: `cookbook/pocketflow-agent/requirements.txt` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 pocketflow>=0.0.1
-duckduckgo-search>=7.5.2     # For web search
+ddgs>=7.5.2     # For web search
 aiohttp>=3.8.0               # For HTTP requests
 openai>=1.0.0                # For LLM calls 
 requests>=2.25.1             # For HTTP requests
```

**File**: `cookbook/pocketflow-agent/utils.py` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 from openai import OpenAI
 import os
-from duckduckgo_search import DDGS
+from ddgs import DDGS
 import requests
 
 def call_llm(prompt):    
```

---

### Incident Patch 2: `f580a7c7` (2026-02-16)
**Commit Message**: Merge pull request #131 from liuxiaopai-ai/docs/agent-skills-cookbook

cookbook: add Agent Skills example and README entry

**File**: `README.md` (modified, +1/-0)
```diff
@@ -86,6 +86,7 @@ From there, it's easy to implement popular design patterns like ([Multi-](https:
 | [Text2SQL](https://github.com/The-Pocket/PocketFlow/tree/main/cookbook/pocketflow-text2sql) |  ★☆☆ <sup>*Beginner*</sup>  | Convert natural language to SQL queries with an auto-debug loop |
 | [Code Generator](https://github.com/The-Pocket/PocketFlow/tree/main/cookbook/pocketflow-code-generator) | ★☆☆ <sup>*Beginner*</sup> | Generate test cases, implement solutions, and iteratively improve code |
 | [MCP](https://github.com/The-Pocket/PocketFlow/tree/main/cookbook/pocketflow-mcp) |  ★☆☆ <sup>*Beginner*</sup> |  Agent using Model Context Protocol for numerical operations |
+| [Agent Skills](https://github.com/The-Pocket/PocketFlow/tree/main/cookbook/pocketflow-agent-skills) |  ★☆☆ <sup>*Beginner*</sup> | Route requests to reusable markdown skills and apply them in an agent flow |
 | [A2A](https://github.com/The-Pocket/PocketFlow/tree/main/cookbook/pocketflow-a2a) |  ★☆☆ <sup>*Beginner*</sup> | Agent wrapped with A2A protocol for inter-agent communication |
 | [Streamlit FSM](https://github.com/The-Pocket/PocketFlow/tree/main/cookbook/pocketflow-streamlit-fsm) | ★☆☆ <sup>*Beginner*</sup> | Streamlit app with finite state machine for HITL image generation |
 | [FastAPI WebSocket](https://github.com/The-Pocket/PocketFlow/tree/main/cookbook/pocketflow-fastapi-websocket) | ★☆☆ <sup>*Beginner*</sup> | Real-time chat interface with streaming LLM responses via WebSocket |
```

**File**: `cookbook/pocketflow-agent-skills/README.md` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+# Agent Skills with PocketFlow
+
+This cookbook shows a lightweight pattern for using **Agent Skills** inside a PocketFlow graph.
+
+Agent Skills are just reusable instruction files (Markdown) that you can route to at runtime.
+
+## What this demo does
+
+- keeps skills as local markdown files (`./skills/*.md`)
+- chooses a skill based on the user request
+- injects the chosen skill into the final LLM prompt
+
+## Flow
+
+```mermaid
+graph TD
+    A[SelectSkill] --> B[ApplySkill]
+```
+
+1. **SelectSkill** picks a skill file (e.g. executive brief vs checklist writer)
+2. **ApplySkill** reads that skill and executes the task with the LLM
+
+## Run
+
+```bash
+pip install -r requirements.txt
+export OPENAI_API_KEY="your-key"
+python main.py --"Summarize this launch plan for a VP audience"
+```
+
+Try another task:
+
+```bash
+python main.py --"Turn this into an implementation checklist"
+```
+
+## Files
+
+- `main.py` — CLI entry
+- `flow.py` — graph wiring
+- `nodes.py` — skill selection + execution nodes
+- `utils.py` — load skills + LLM helper
+- `skills/*.md` — reusable Agent Skills
```

**File**: `cookbook/pocketflow-agent-skills/flow.py` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+from pocketflow import Flow
+from nodes import SelectSkill, ApplySkill
+
+
+def create_flow():
+    select_skill = SelectSkill()
+    apply_skill = ApplySkill()
+
+    select_skill >> apply_skill
+
+    return Flow(start=select_skill)
```

**File**: `cookbook/pocketflow-agent-skills/main.py` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+import sys
+from flow import create_flow
+
+
+def parse_task(default_task: str) -> str:
+    for arg in sys.argv[1:]:
+        if arg.startswith("--"):
+            return arg[2:]
+    return default_task
+
+
+def main():
+    task = parse_task("Summarize this launch plan for a VP audience")
+
+    shared = {
+        "task": task,
+        "skills_dir": "skills",
+    }
+
+    flow = create_flow()
+
+    print(f"🧩 Task: {task}")
+    flow.run(shared)
+
+    print("\n=== Skill Used ===")
+    print(shared.get("selected_skill", "(none)"))
+
+    print("\n=== Output ===")
+    print(shared.get("result", "(no result)"))
+
+
+if __name__ == "__main__":
+    main()
```

**File**: `cookbook/pocketflow-agent-skills/nodes.py` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+from pocketflow import Node
+from utils import call_llm, load_skills
+
+
+class SelectSkill(Node):
+    def prep(self, shared):
+        return {
+            "task": shared["task"],
+            "skills": load_skills(shared["skills_dir"]),
+        }
+
+    def exec(self, prep_res):
+        task = prep_res["task"].lower()
+        skills = prep_res["skills"]
+
+        # Tiny deterministic router for demo purposes.
+        if "checklist" in task or "steps" in task:
+            preferred = "checklist_writer"
+        else:
+            preferred = "executive_brief"
+
+        if preferred in skills:
+            return preferred, skills[preferred]
+
+        # fallback: first available skill
+        name, content = next(iter(skills.items()))
+        return name, content
+
+    def post(self, shared, prep_res, exec_res):
+        skill_name, skill_content = exec_res
+        shared["selected_skill"] = skill_name
+        shared["selected_skill_content"] = skill_content
+        return "default"
+
+
+class ApplySkill(Node):
+    def prep(self, shared):
+        return {
+            "task": shared["task"],
+            "skill_name": shared["selected_skill"],
+            "skill_content": shared["selected_skill_content"],
+        }
+
+    def exec(self, prep_res):
+        prompt = f"""
+You are running an Agent Skill.
+
+Skill name: {prep_res['skill_name']}
+
+Skill instructions:
+---
+{prep_res['skill_content']}
+---
+
+User task:
+{prep_res['task']}
+
+Follow the skill instructions exactly and return the final result only.
+""".strip()
+        return call_llm(prompt)
+
+    def post(self, shared, prep_res, exec_res):
+        shared["result"] = exec_res
+        return "default"
```

**File**: `cookbook/pocketflow-agent-skills/requirements.txt` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+pocketflow>=0.0.1
+openai>=1.0.0
```

**File**: `cookbook/pocketflow-agent-skills/skills/checklist_writer.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+# Checklist Writer Skill
+
+Convert requests into clear, actionable checklists.
+
+## Rules
+- Use numbered steps.
+- Keep each step short and verifiable.
+- Highlight dependencies and blockers.
+- End with a "Definition of Done" section.
```

**File**: `cookbook/pocketflow-agent-skills/skills/executive_brief.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+# Executive Brief Skill
+
+You are writing for senior leaders.
+
+## Rules
+- Keep it concise and decision-oriented.
+- Start with 3 bullet point summary.
+- Include risks and recommended next action.
+- Avoid implementation-level details unless critical.
```

---

### Incident Patch 3: `0eca4d4a` (2025-12-24)
**Commit Message**: Merge pull request #124 from shenyfg/requirements

Add requirements.txt for pocketflow-llm-streaming

**File**: `cookbook/pocketflow-llm-streaming/requirements.txt` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+pocketflow>=0.0.1
+openai>=1.0.0
\ No newline at end of file
```

---

### Incident Patch 4: `39f9eee9` (2025-12-23)
**Commit Message**: Add requirements.txt for pocketflow-llm-streaming

**File**: `cookbook/pocketflow-llm-streaming/requirements.txt` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+pocketflow>=0.0.1
+openai>=1.0.0
\ No newline at end of file
```

---

### Incident Patch 5: `96c7b55a` (2025-12-15)
**Commit Message**: Fixed cookbook agent issues

**File**: `cookbook/pocketflow-agent/nodes.py` (modified, +39/-8)
```diff
@@ -1,6 +1,7 @@
 from pocketflow import Node
 from utils import call_llm, search_web_duckduckgo
 import yaml
+import re
 
 class DecideAction(Node):
     def prep(self, shared):
@@ -44,22 +45,52 @@ def exec(self, inputs):
 thinking: |
     <your step-by-step reasoning process>
 action: search OR answer
-reason: <why you chose this action>
-answer: <if action is answer>
-search_query: <specific search query if action is search>
+reason: |
+    <why you chose this action - always use block scalar>
+answer: |
+    <if action is answer - always use block scalar, leave empty if searching>
+search_query: <specific search query if action is search (plain string)>
 ```
 IMPORTANT: Make sure to:
-1. Use proper indentation (4 spaces) for all multi-line fields
-2. Use the | character for multi-line text fields
-3. Keep single-line fields without the | character
+1. ALWAYS use the | block scalar for thinking, reason and answer so colons or quotes inside the text do not break YAML.
+2. Use proper indentation (4 spaces) for all multi-line fields under |.
+3. Keep search_query as a single line string without the | character.
 """
         
         # Call the LLM to make a decision
         response = call_llm(prompt)
         
         # Parse the response to get the decision
-        yaml_str = response.split("```yaml")[1].split("```")[0].strip()
-        decision = yaml.safe_load(yaml_str)
+        def extract_yaml_block(text):
+            """Extract YAML from a fenced code block, or fall back to the whole text."""
+            match = re.search(r"```yaml(.*?)```", text, re.DOTALL | re.IGNORECASE)
+            if match:
+                return match.group(1).strip()
+            return text.strip()
+
+        def parse_yaml_safely(block):
+            """Parse YAML, retrying with block scalars if colon characters caused issues."""
+            try:
+                return yaml.safe_load(block)
+            except yaml.YAMLError:
+                fixed_lines = []
+                for line in block.splitlines():
+                    if re.match(r"^(thinking|reason|answer|search_query):", line) and "|" not in line:
+                        key, _, val = line.partition(":")
+                        fixed_lines.append(f"{key}: |")
+                        val = val.strip()
+                        if val:
+                            fixed_lines.append(f"  {val}")
+                    else:
+                        fixed_lines.append(line)
+                fixed_block = "\n".join(fixed_lines)
+                try:
+                    return yaml.safe_load(fixed_block)
+                except yaml.YAMLError as exc:
+                    raise ValueError(f"Unable to parse LLM YAML response:\n{block}") from exc
+
+        yaml_str = extract_yaml_block(response)
+        decision = parse_yaml_safely(yaml_str)
         
         return decision
     
```

**File**: `cookbook/pocketflow-agent/requirements.txt` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 pocketflow>=0.0.1
-duckduckgo-search>=7.5.2     # For web search
+ddgs>=7.5.2     # For web search
 aiohttp>=3.8.0               # For HTTP requests
 openai>=1.0.0                # For LLM calls 
 requests>=2.25.1             # For HTTP requests
```

**File**: `cookbook/pocketflow-agent/utils.py` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 from openai import OpenAI
 import os
-from duckduckgo_search import DDGS
+from ddgs import DDGS
 import requests
 
 def call_llm(prompt):    
```

---

### Incident Patch 6: `23e36bfb` (2025-08-13)
**Commit Message**: Merge pull request #109 from Dawinia/fix107

FIX: RecursionError when loop flow

**File**: `cookbook/pocketflow-visualization/async_loop_flow.py` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+from async_flow import *
+from pocketflow import Flow, AsyncParallelBatchNode, Node
+
+# Create node instances
+validate_payment = ValidatePayment()
+process_payment = ProcessPayment()
+payment_confirmation = PaymentConfirmation()
+
+check_stock = CheckStock()
+reserve_items = ReserveItems()
+update_inventory = UpdateInventory()
+
+create_label = CreateLabel()
+assign_carrier = AssignCarrier()
+schedule_pickup = SchedulePickup()
+
+# Payment processing sub-flow
+validate_payment >> process_payment
+validate_payment - "out_of_stock" >> validate_payment  # 循环重试
+process_payment - 'something fail' >> validate_payment
+process_payment - 'pass' >> payment_confirmation
+payment_flow = AsyncFlow(start=validate_payment)
+
+# Inventory sub-flow
+check_stock >> reserve_items >> update_inventory
+inventory_flow = AsyncFlow(start=check_stock)
+
+# Shipping sub-flow
+create_label >> assign_carrier >> schedule_pickup
+shipping_flow = AsyncFlow(start=create_label)
+
+# Connect the flows into a main order pipeline
+payment_flow >> inventory_flow >> shipping_flow
+# payment_flow >> inventory_flow >> create_label
+# payment_flow >> inventory_flow >> assign_carrier
+
+
+# Create the master flow
+class OrderFlow(AsyncFlow):
+    pass
+
+order_pipeline = OrderFlow(start=payment_flow)
+
+# Create shared data structure
+shared_data = {
+    "order_id": "ORD-12345",
+    "customer": "John Doe",
+    "items": [
+        {"id": "ITEM-001", "name": "Smartphone", "price": 999.99, "quantity": 1},
+        {"id": "ITEM-002", "name": "Phone case", "price": 29.99, "quantity": 1},
+    ],
+    "shipping_address": {
+        "street": "123 Main St",
+        "city": "Anytown",
+        "state": "CA",
+        "zip": "12345",
+    },
+}
+
+
+# Run the entire pipeline asynchronously
+async def main():
+    await order_pipeline.run_async(shared_data)
+
+    # Print final status
+    print("\nOrder processing completed!")
+    print(f"Payment: {shared_data.get('payment_confirmation')}")
+    print(f"Inventory: {shared_data.get('inventory_update')}")
+    print(f"Shipping: {shared_data.get('pickup_status')}")
+
+
+if __name__ == "__main__":
+    asyncio.run(main())
```

**File**: `cookbook/pocketflow-visualization/visualize.py` (modified, +87/-6)
```diff
@@ -77,6 +77,7 @@ def flow_to_json(start):
     node_types = {}
     flow_nodes = {}  # Keep track of flow nodes
     ctr = 1
+    visited = set()
 
     def get_id(n):
         nonlocal ctr
@@ -99,6 +100,9 @@ def walk(node, parent=None, group=None, parent_group=None, action=None):
             action: Action label on the edge from parent to this node
         """
         node_id = get_id(node)
+        if (node_id, action) in visited:
+            return
+        visited.add((node_id, action))
 
         # Add node if not already in nodes list and not a Flow
         if not any(n["id"] == node_id for n in nodes) and not isinstance(node, Flow):
@@ -552,8 +556,38 @@ def create_d3_visualization(
             
             // Update positions on each tick
             simulation.on("tick", () => {
-                // Update links with straight lines
+                // Update links with curved paths for bidirectional connections
                 link.attr("d", d => {
+                    // Handle self-referencing links with a water-drop shape
+                    if (d.source === d.target) {
+                        const nodeX = d.source.x;
+                        const nodeY = d.source.y;
+                        const offsetX = 40;
+                        const offsetY = 10;
+                        const controlOffset = 50;
+                        
+                        // Create a water-drop shaped path
+                        return `M ${nodeX},${nodeY - 5}
+                                C ${nodeX + controlOffset},${nodeY - 30} 
+                                  ${nodeX + offsetX},${nodeY + offsetY} 
+                                  ${nodeX},${nodeY}`;
+                    }
+                    
+                    // Check if there's a reverse connection
+                    const isReverse = data.links.some(l => 
+                        l.source === d.target && l.target === d.source
+                    );
+                    
+                    // If it's part of a bidirectional connection, curve the path
+                    if (isReverse) {
+                        const dx = d.target.x - d.source.x;
+                        const dy = d.target.y - d.source.y;
+                        const dr = Math.sqrt(dx * dx + dy * dy) * 0.9;
+                        
+                        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
+                    }
+                    
+                    // For unidirectional connections, use straight lines
                     return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
                 });
                 
@@ -567,10 +601,57 @@ def create_d3_visualization(
                     .attr("x", d => d.x)
                     .attr("y", d => d.y);
                 
-                // Position link labels at midpoint
-                linkLabel
-                    .attr("x", d => (d.source.x + d.target.x) / 2)
-                    .attr("y", d => (d.source.y + d.target.y) / 2);
+                // Position link labels with offset for bidirectional connections
+                linkLabel.attr("x", d => {
+                    // Handle self-referencing links
+                    if (d.source === d.target) {
+                        return d.source.x + 30;
+                    }
+                    
+                    // Check if there's a reverse connection
+                    const reverseLink = data.links.find(l => 
+                        l.source === d.target && l.target === d.source
+                    );
+                    
+                    // If it's part of a bidirectional connection, offset the label
+                    if (reverseLink) {
+                        const dx = d.target.x - d.source.x;
+                        const dy = d.target.y - d.source.y;
+                        // Calculate perpendicular offset
+                        const length = Math.sqrt(dx * dx + dy * dy);
+                        const offsetX = -dy / length * 10; // Perpendicular offset
+                        
+                        return (d.source.x + d.target.x) / 2 + offsetX;
+                    }
+                    
+                    // For unidirectional connections, use midpoint
+                    return (d.source.x + d.target.x) / 2;
+                })
+                .attr("y", d => {
+                    // Handle self-referencing links
+                    if (d.source === d.target) {
+                        return d.source.y;
+                    }
+                    
+                    // Check if there's a reverse connection
+                    const reverseLink = data.links.find(l => 
+                        l.source === d.target && l.target === d.source
+                    );
+                    
+                    // If it's part of a bidirectional connection, offset the label
+                    if (reverseLink) {
+                        const
```

---

### Incident Patch 7: `129b9b07` (2025-08-13)
**Commit Message**: FIX: RecursionError when loop flow

**File**: `cookbook/pocketflow-visualization/async_loop_flow.py` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+from async_flow import *
+from pocketflow import Flow, AsyncParallelBatchNode, Node
+
+# Create node instances
+validate_payment = ValidatePayment()
+process_payment = ProcessPayment()
+payment_confirmation = PaymentConfirmation()
+
+check_stock = CheckStock()
+reserve_items = ReserveItems()
+update_inventory = UpdateInventory()
+
+create_label = CreateLabel()
+assign_carrier = AssignCarrier()
+schedule_pickup = SchedulePickup()
+
+# Payment processing sub-flow
+validate_payment >> process_payment
+validate_payment - "out_of_stock" >> validate_payment  # 循环重试
+process_payment - 'something fail' >> validate_payment
+process_payment - 'pass' >> payment_confirmation
+payment_flow = AsyncFlow(start=validate_payment)
+
+# Inventory sub-flow
+check_stock >> reserve_items >> update_inventory
+inventory_flow = AsyncFlow(start=check_stock)
+
+# Shipping sub-flow
+create_label >> assign_carrier >> schedule_pickup
+shipping_flow = AsyncFlow(start=create_label)
+
+# Connect the flows into a main order pipeline
+payment_flow >> inventory_flow >> shipping_flow
+# payment_flow >> inventory_flow >> create_label
+# payment_flow >> inventory_flow >> assign_carrier
+
+
+# Create the master flow
+class OrderFlow(AsyncFlow):
+    pass
+
+order_pipeline = OrderFlow(start=payment_flow)
+
+# Create shared data structure
+shared_data = {
+    "order_id": "ORD-12345",
+    "customer": "John Doe",
+    "items": [
+        {"id": "ITEM-001", "name": "Smartphone", "price": 999.99, "quantity": 1},
+        {"id": "ITEM-002", "name": "Phone case", "price": 29.99, "quantity": 1},
+    ],
+    "shipping_address": {
+        "street": "123 Main St",
+        "city": "Anytown",
+        "state": "CA",
+        "zip": "12345",
+    },
+}
+
+
+# Run the entire pipeline asynchronously
+async def main():
+    await order_pipeline.run_async(shared_data)
+
+    # Print final status
+    print("\nOrder processing completed!")
+    print(f"Payment: {shared_data.get('payment_confirmation')}")
+    print(f"Inventory: {shared_data.get('inventory_update')}")
+    print(f"Shipping: {shared_data.get('pickup_status')}")
+
+
+if __name__ == "__main__":
+    asyncio.run(main())
```

**File**: `cookbook/pocketflow-visualization/visualize.py` (modified, +87/-6)
```diff
@@ -77,6 +77,7 @@ def flow_to_json(start):
     node_types = {}
     flow_nodes = {}  # Keep track of flow nodes
     ctr = 1
+    visited = set()
 
     def get_id(n):
         nonlocal ctr
@@ -99,6 +100,9 @@ def walk(node, parent=None, group=None, parent_group=None, action=None):
             action: Action label on the edge from parent to this node
         """
         node_id = get_id(node)
+        if (node_id, action) in visited:
+            return
+        visited.add((node_id, action))
 
         # Add node if not already in nodes list and not a Flow
         if not any(n["id"] == node_id for n in nodes) and not isinstance(node, Flow):
@@ -552,8 +556,38 @@ def create_d3_visualization(
             
             // Update positions on each tick
             simulation.on("tick", () => {
-                // Update links with straight lines
+                // Update links with curved paths for bidirectional connections
                 link.attr("d", d => {
+                    // Handle self-referencing links with a water-drop shape
+                    if (d.source === d.target) {
+                        const nodeX = d.source.x;
+                        const nodeY = d.source.y;
+                        const offsetX = 40;
+                        const offsetY = 10;
+                        const controlOffset = 50;
+                        
+                        // Create a water-drop shaped path
+                        return `M ${nodeX},${nodeY - 5}
+                                C ${nodeX + controlOffset},${nodeY - 30} 
+                                  ${nodeX + offsetX},${nodeY + offsetY} 
+                                  ${nodeX},${nodeY}`;
+                    }
+                    
+                    // Check if there's a reverse connection
+                    const isReverse = data.links.some(l => 
+                        l.source === d.target && l.target === d.source
+                    );
+                    
+                    // If it's part of a bidirectional connection, curve the path
+                    if (isReverse) {
+                        const dx = d.target.x - d.source.x;
+                        const dy = d.target.y - d.source.y;
+                        const dr = Math.sqrt(dx * dx + dy * dy) * 0.9;
+                        
+                        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
+                    }
+                    
+                    // For unidirectional connections, use straight lines
                     return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
                 });
                 
@@ -567,10 +601,57 @@ def create_d3_visualization(
                     .attr("x", d => d.x)
                     .attr("y", d => d.y);
                 
-                // Position link labels at midpoint
-                linkLabel
-                    .attr("x", d => (d.source.x + d.target.x) / 2)
-                    .attr("y", d => (d.source.y + d.target.y) / 2);
+                // Position link labels with offset for bidirectional connections
+                linkLabel.attr("x", d => {
+                    // Handle self-referencing links
+                    if (d.source === d.target) {
+                        return d.source.x + 30;
+                    }
+                    
+                    // Check if there's a reverse connection
+                    const reverseLink = data.links.find(l => 
+                        l.source === d.target && l.target === d.source
+                    );
+                    
+                    // If it's part of a bidirectional connection, offset the label
+                    if (reverseLink) {
+                        const dx = d.target.x - d.source.x;
+                        const dy = d.target.y - d.source.y;
+                        // Calculate perpendicular offset
+                        const length = Math.sqrt(dx * dx + dy * dy);
+                        const offsetX = -dy / length * 10; // Perpendicular offset
+                        
+                        return (d.source.x + d.target.x) / 2 + offsetX;
+                    }
+                    
+                    // For unidirectional connections, use midpoint
+                    return (d.source.x + d.target.x) / 2;
+                })
+                .attr("y", d => {
+                    // Handle self-referencing links
+                    if (d.source === d.target) {
+                        return d.source.y;
+                    }
+                    
+                    // Check if there's a reverse connection
+                    const reverseLink = data.links.find(l => 
+                        l.source === d.target && l.target === d.source
+                    );
+                    
+                    // If it's part of a bidirectional connection, offset the label
+                    if (reverseLink) {
+                        const
```

---

### Incident Patch 8: `9c3def98` (2025-08-04)
**Commit Message**: update requirements

**File**: `.cursorrules` (modified, +6/-0)
```diff
@@ -156,6 +156,12 @@ my_project/
     └── design.md
 ```
 
+- **`requirements.txt`**: Lists the Python dependencies for the project.
+  ```
+  PyYAML
+  pocketflow
+  ```
+
 - **`docs/design.md`**: Contains project documentation for each step above. This should be *high-level* and *no-code*.
   ~~~
   # Design Doc: Your Project Name
```

**File**: `docs/guide.md` (modified, +6/-0)
```diff
@@ -156,6 +156,12 @@ my_project/
     └── design.md
 ```
 
+- **`requirements.txt`**: Lists the Python dependencies for the project.
+  ```
+  PyYAML
+  pocketflow
+  ```
+
 - **`docs/design.md`**: Contains project documentation for each step above. This should be *high-level* and *no-code*.
   ~~~
   # Design Doc: Your Project Name
```

---

### Incident Patch 9: `7dd0fc4a` (2025-07-31)
**Commit Message**: Updated requirements.txt to include PyYAML and improved the format

**File**: `cookbook/pocketflow-agent/requirements.txt` (modified, +5/-4)
```diff
@@ -1,5 +1,6 @@
 pocketflow>=0.0.1
-aiohttp>=3.8.0  # For HTTP requests
-openai>=1.0.0   # For LLM calls 
-duckduckgo-search>=7.5.2    # For web search
-requests>=2.25.1  # For HTTP requests
\ No newline at end of file
+duckduckgo-search>=7.5.2     # For web search
+aiohttp>=3.8.0               # For HTTP requests
+openai>=1.0.0                # For LLM calls 
+requests>=2.25.1             # For HTTP requests
+PyYAML>=6.0.2                # For YAML parsing
\ No newline at end of file
```

---

### Incident Patch 10: `fd5817fd` (2025-07-31)
**Commit Message**: fix: align AsyncNode retry mechanism with Node implementation

- Change AsyncNode._exec() to use self.cur_retry instead of local variable i
- Ensures consistency between sync and async retry mechanisms
- Fixes AttributeError when accessing cur_retry in derived classes
- Maintains backward compatibility while resolving retry tracking inconsistency

**File**: `pocketflow/__init__.py` (modified, +2/-2)
```diff
@@ -62,10 +62,10 @@ async def exec_async(self,prep_res): pass
     async def exec_fallback_async(self,prep_res,exc): raise exc
     async def post_async(self,shared,prep_res,exec_res): pass
     async def _exec(self,prep_res): 
-        for i in range(self.max_retries):
+        for self.cur_retry in range(self.max_retries):
             try: return await self.exec_async(prep_res)
             except Exception as e:
-                if i==self.max_retries-1: return await self.exec_fallback_async(prep_res,e)
+                if self.cur_retry==self.max_retries-1: return await self.exec_fallback_async(prep_res,e)
                 if self.wait>0: await asyncio.sleep(self.wait)
     async def run_async(self,shared): 
         if self.successors: warnings.warn("Node won't run successors. Use AsyncFlow.")  
```

---

### Incident Patch 11: `67bc5d87` (2025-07-06)
**Commit Message**: Merge pull request #86 from raceychan/type-hints

Adding type hints to __init__.py without changing format and logic

**File**: `pocketflow/__init__.pyi` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+import asyncio
+from typing import Any, Dict, List, Optional, Union, TypeVar, Generic
+
+# Type variables for better type relationships
+_PrepResult = TypeVar('_PrepResult')
+_ExecResult = TypeVar('_ExecResult')
+_PostResult = TypeVar('_PostResult')
+
+# More specific parameter types
+ParamValue = Union[str, int, float, bool, None, List[Any], Dict[str, Any]]
+SharedData = Dict[str, Any]
+Params = Dict[str, ParamValue]
+
+class BaseNode(Generic[_PrepResult, _ExecResult, _PostResult]):
+    params: Params
+    successors: Dict[str, BaseNode[Any, Any, Any]]
+    
+    def __init__(self) -> None: ...
+    def set_params(self, params: Params) -> None: ...
+    def next(self, node: BaseNode[Any, Any, Any], action: str = "default") -> BaseNode[Any, Any, Any]: ...
+    def prep(self, shared: SharedData) -> _PrepResult: ...
+    def exec(self, prep_res: _PrepResult) -> _ExecResult: ...
+    def post(self, shared: SharedData, prep_res: _PrepResult, exec_res: _ExecResult) -> _PostResult: ...
+    def _exec(self, prep_res: _PrepResult) -> _ExecResult: ...
+    def _run(self, shared: SharedData) -> _PostResult: ...
+    def run(self, shared: SharedData) -> _PostResult: ...
+    def __rshift__(self, other: BaseNode[Any, Any, Any]) -> BaseNode[Any, Any, Any]: ...
+    def __sub__(self, action: str) -> _ConditionalTransition: ...
+
+class _ConditionalTransition:
+    src: BaseNode[Any, Any, Any]
+    action: str
+    
+    def __init__(self, src: BaseNode[Any, Any, Any], action: str) -> None: ...
+    def __rshift__(self, tgt: BaseNode[Any, Any, Any]) -> BaseNode[Any, Any, Any]: ...
+
+class Node(BaseNode[_PrepResult, _ExecResult, _PostResult]):
+    max_retries: int
+    wait: Union[int, float]
+    cur_retry: int
+    
+    def __init__(self, max_retries: int = 1, wait: Union[int, float] = 0) -> None: ...
+    def exec_fallback(self, prep_res: _PrepResult, exc: Exception) -> _ExecResult: ...
+    def _exec(self, prep_res: _PrepResult) -> _ExecResult: ...
+
+class BatchNode(Node[Optional[List[_PrepResult]], List[_ExecResult], _PostResult]):
+    def _exec(self, items: Optional[List[_PrepResult]]) -> List[_ExecResult]: ...
+
+class Flow(BaseNode[_PrepResult, Any, _PostResult]):
+    start_node: Optional[BaseNode[Any, Any, Any]]
+    
+    def __init__(self, start: Optional[BaseNode[Any, Any, Any]] = None) -> None: ...
+    def start(self, start: BaseNode[Any, Any, Any]) -> BaseNode[Any, Any, Any]: ...
+    def get_next_node(
+        self, curr: BaseNode[Any, Any, Any], action: Optional[str]
+    ) -> Optional[BaseNode[Any, Any, Any]]: ...
+    def _orch(
+        self, shared: SharedData, params: Optional[Params] = None
+    ) -> Any: ...
+    def _run(self, shared: SharedData) -> _PostResult: ...
+    def post(self, shared: SharedData, prep_res: _PrepResult, exec_res: Any) -> _PostResult: ...
+
+class BatchFlow(Flow[Optional[List[Params]], Any, _PostResult]):
+    def _run(self, shared: SharedData) -> _PostResult: ...
+
+class AsyncNode(Node[_PrepResult, _ExecResult, _PostResult]):
+    async def prep_async(self, shared: SharedData) -> _PrepResult: ...
+    async def exec_async(self, prep_res: _PrepResult) -> _ExecResult: ...
+    async def exec_fallback_async(self, prep_res: _PrepResult, exc: Exception) -> _ExecResult: ...
+    async def post_async(
+        self, shared: SharedData, prep_res: _PrepResult, exec_res: _ExecResult
+    ) -> _PostResult: ...
+    async def _exec(self, prep_res: _PrepResult) -> _ExecResult: ...
+    async def run_async(self, shared: SharedData) -> _PostResult: ...
+    async def _run_async(self, shared: SharedData) -> _PostResult: ...
+    def _run(self, shared: SharedData) -> _PostResult: ...
+
+class AsyncBatchNode(AsyncNode[Optional[List[_PrepResult]], List[_ExecResult], _PostResult], BatchNode[Optional[List[_PrepResult]], List[_ExecResult], _PostResult]):
+    async def _exec(self, items: Optional[List[_PrepResult]]) -> List[_ExecResult]: ...
+
+class AsyncParallelBatchNode(AsyncNode[Optional[List[_PrepResult]], List[_ExecResult], _PostResult], BatchNode[Optional[List[_PrepResult]], List[_ExecResult], _PostResult]):
+    async def _exec(self, items: Optional[List[_PrepResult]]) -> List[_ExecResult]: ...
+
+class AsyncFlow(Flow[_PrepResult, Any, _PostResult], AsyncNode[_PrepResult, Any, _PostResult]):
+    async def _orch_async(
+        self, shared: SharedData, params: Optional[Params] = None
+    ) -> Any: ...
+    async def _run_async(self, shared: SharedData) -> _PostResult: ...
+    async def post_async(
+        self, shared: SharedData, prep_res: _PrepResult, exec_res: Any
+    ) -> _PostResult: ...
+
+class AsyncBatchFlow(AsyncFlow[Optional[List[Params]], Any, _PostResult], BatchFlow[Optional[List[Params]], Any, _PostResult]):
+    async def _run_async(self, shared: SharedData) -> _PostResult: ...
+
+class AsyncParallelBatchFlow(AsyncFlow[Optional[List[Params]], Any, _PostResult], BatchFlow[Optional[List[Params]], Any, _PostResult]):
+    async def _run_async(se
```

---

### Incident Patch 12: `d360ba8d` (2025-07-01)
**Commit Message**: fix the search func call

**File**: `cookbook/pocketflow-agent/utils.py` (modified, +1/-1)
```diff
@@ -48,5 +48,5 @@ def search_web_brave(query):
     print("## Testing search_web")
     query = "Who won the Nobel Prize in Physics 2024?"
     print(f"## Query: {query}")
-    results = search_web(query)
+    results = search_web_duckduckgo(query)
     print(f"## Results: {results}")
\ No newline at end of file
```

---

### Incident Patch 13: `3c970ba2` (2025-05-09)
**Commit Message**: Merge pull request #52 from Ming-jiayou/Fixed-pocketflow-llm-streaming

Fixed  pocketflow-llm-streaming

**File**: `cookbook/pocketflow-llm-streaming/main.py` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ def wait_for_interrupt():
         # Get prompt from shared store
         prompt = shared["prompt"]
         # Get chunks from LLM function
-        chunks = fake_stream_llm(prompt)
+        chunks = stream_llm(prompt)
         return chunks, interrupt_event, listener_thread
 
     def exec(self, prep_res):
```

---

### Incident Patch 14: `b91494fd` (2025-05-09)
**Commit Message**: Fixed  pocketflow-llm-streaming

**File**: `cookbook/pocketflow-llm-streaming/main.py` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ def wait_for_interrupt():
         # Get prompt from shared store
         prompt = shared["prompt"]
         # Get chunks from LLM function
-        chunks = fake_stream_llm(prompt)
+        chunks = stream_llm(prompt)
         return chunks, interrupt_event, listener_thread
 
     def exec(self, prep_res):
```

---

### Incident Patch 15: `000dc61e` (2025-04-29)
**Commit Message**: Update requirements.txt

**File**: `cookbook/pocketflow-chat-memory/requirements.txt` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-pocketflow>=0.0.5
+pocketflow>=0.0.2
 numpy>=1.20.0
 faiss-cpu>=1.7.0
-openai>=1.0.0
\ No newline at end of file
+openai>=1.0.0
```

#### Recent Merged Pull Requests:
- **PR #143** (closed): Polish docs and comments in PocketFlow (#119) (@bglglzd)
- **PR #133** (2026-03-27): Expand framework comparison table: new columns + new framework rows (@zhimin-z)
- **PR #131** (2026-02-16): cookbook: add Agent Skills example and README entry (@liuxiaopai-ai)
- **PR #124** (2025-12-24): Add requirements.txt for pocketflow-llm-streaming (@shenyfg)
- **PR #121** (2026-02-16): Fixed cookbook agent issues (@cctv1237)
- **PR #115** (closed): Hope it helps  (@ElgAtoAi)
- **PR #114** (closed): megacomboloco (@ElgAtoAi)
- **PR #109** (2025-08-13): FIX: RecursionError when loop flow (@Dawinia)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
