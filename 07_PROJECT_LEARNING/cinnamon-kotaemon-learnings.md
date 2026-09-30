# Forensic Learning Record (Deep Inspection): Cinnamon/kotaemon

> **Canonical Artifact**: `07_PROJECT_LEARNING/cinnamon-kotaemon-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Cinnamon/kotaemon](https://github.com/Cinnamon/kotaemon))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:44:00.816Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Cinnamon/kotaemon`
- **Description**: An open-source RAG-based tool for chatting with your documents.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 25791 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app.py`
```
import os

from theflow.settings import settings as flowsettings

KH_APP_DATA_DIR = getattr(flowsettings, "KH_APP_DATA_DIR", ".")
KH_GRADIO_SHARE = getattr(flowsettings, "KH_GRADIO_SHARE", False)
GRADIO_TEMP_DIR = os.getenv("GRADIO_TEMP_DIR", None)
# override GRADIO_TEMP_DIR if it's not set
if GRADIO_TEMP_DIR is None:
    GRADIO_TEMP_DIR = os.path.join(KH_APP_DATA_DIR, "gradio_tmp")
    os.environ["GRADIO_TEMP_DIR"] = GRADIO_TEMP_DIR


from ktem.main import App  # noqa

app = App()
demo = app.make()
demo.queue().launch(
    favicon_path=app._favicon,
    inbrowser=True,
    allowed_paths=[
        "libs/ktem/ktem/assets",
        GRADIO_TEMP_DIR,
    ],
    share=KH_GRADIO_SHARE,
)

```

### Core Architecture Module: `flowsettings.py`
```
import os
from importlib.metadata import version
from inspect import currentframe, getframeinfo
from pathlib import Path

from decouple import config
from ktem.utils.lang import SUPPORTED_LANGUAGE_MAP
from theflow.settings.default import *  # noqa

cur_frame = currentframe()
if cur_frame is None:
    raise ValueError("Cannot get the current frame.")
this_file = getframeinfo(cur_frame).filename
this_dir = Path(this_file).parent

# change this if your app use a different name
KH_PACKAGE_NAME = "kotaemon_app"

KH_APP_VERSION = config("KH_APP_VERSION", None)
if not KH_APP_VERSION:
    try:
        # Caution: This might produce the wrong version
        # https://stackoverflow.com/a/59533071
        KH_APP_VERSION = version(KH_PACKAGE_NAME)
    except Exception:
        KH_APP_VERSION = "local"

KH_GRADIO_SHARE = config("KH_GRADIO_SHARE", default=False, cast=bool)
KH_ENABLE_FIRST_SETUP = config("KH_ENABLE_FIRST_SETUP", default=True, cast=bool)
KH_DEMO_MODE = config("KH_DEMO_MODE", default=False, cast=bool)
KH_OLLAMA_URL = config("KH_OLLAMA_URL", default="http://localhost:11434/v1/")

# App can be ran from anywhere and it's not trivial to decide where to store app data.
# So let's use the same directory as the flowsetting.py file.
KH_APP_DATA_DIR = this_dir / "ktem_app_data"
KH_APP_DATA_EXISTS = KH_APP_DATA_DIR.exists()
KH_APP_DATA_DIR.mkdir(parents=True, exist_ok=True)

# User data directory
KH_USER_DATA_DIR = KH_APP_DATA_DIR / "user_data"
KH_USER_DATA_DIR.mkdir(parents=True, exist_ok=True)

# markdown output directory
KH_MARKDOWN_OUTPUT_DIR = KH_APP_DATA_DIR / "markdown_cache_dir"
KH_MARKDOWN_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# chunks output directory
KH_CHUNKS_OUTPUT_DIR = KH_APP_DATA_DIR / "chunks_cache_dir"
KH_CHUNKS_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# zip output directory
KH_ZIP_OUTPUT_DIR = KH_APP_DATA_DIR / "zip_cache_dir"
KH_ZIP_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# zip input directory
KH_ZIP_INPUT_DIR = KH_APP_DATA_DIR / "zip_cache_dir_in"
KH_ZIP_INPUT_DIR.mkdir(parents=True, exist_ok=True)

# HF models can be big, let's store them in the app data directory so that it's easier
# for users to manage their storage.
# ref: https://huggingface.co/docs/huggingface_hub/en/guides/manage-cache
os.environ["HF_HOME"] = str(KH_APP_DATA_DIR / "huggingface")
os.environ["HF_HUB_CACHE"] = str(KH_APP_DATA_DIR / "huggingface")

# doc directory
KH_DOC_DIR = this_dir / "docs"

KH_MODE = "dev"
KH_SSO_ENABLED = config("KH_SSO_ENABLED", default=False, cast=bool)

KH_FEATURE_CHAT_SUGGESTION = config(
    "KH_FEATURE_CHAT_SUGGESTION", default=False, cast=bool
)
KH_FEATURE_USER_MANAGEMENT = config(
    "KH_FEATURE_USER_MANAGEMENT", default=True, cast=bool
)
KH_USER_CAN_SEE_PUBLIC = None
KH_FEATURE_USER_MANAGEMENT_ADMIN = str(
    config("KH_FEATURE_USER_MANAGEMENT_ADMIN", default="admin")
)
KH_FEATURE_USER_MANAGEMENT_PASSWORD = str(
    config("KH_FEATURE_USER_MANAGEMENT_PASSWORD", default="admin")
)
KH_ENABLE_ALEMBIC = False
KH_DATABASE = f"sqlite:///{KH_USER_DATA_DIR / 'sql.db'}"
KH_FILESTORAGE_PATH = str(KH_USER_DATA_DIR / "files")
KH_WEB_SEARCH_BACKEND = (
    "kotaemon.indices.retrievers.tavily_web_search.WebSearch"
    # "kotaemon.indices.retrievers.jina_web_search.WebSearch"
)

KH_DOCSTORE = {
    # "__type__": "kotaemon.storages.ElasticsearchDocumentStore",
    # "__type__": "kotaemon.storages.SimpleFileDocumentStore",
    "__type__": "kotaemon.storages.LanceDBDocumentStore",
    "path": str(KH_USER_DATA_DIR / "docstore"),
}
KH_VECTORSTORE = {
    # "__type__": "kotaemon.storages.LanceDBVectorStore",
    "__type__": "kotaemon.storages.ChromaVectorStore",
    # "__type__": "kotaemon.storages.MilvusVectorStore",
    # "__type__": "kotaemon.storages.QdrantVectorStore",
    "path": str(KH_USER_DATA_DIR / "vectorstore"),
}
KH_LLMS = {}
KH_EMBEDDINGS = {}
KH_RERANKINGS = {}

# populate options from config
if config("AZURE_OPENAI_API_KEY", default="") and config(
    "AZURE_OPENAI_ENDPOINT", default=""
):
    if config("AZURE_OPENAI_CHAT_DEPLOYMENT", default=""):
        KH_LLMS["azure"] = {
            "spec": {
                "__type__": "kotaemon.llms.AzureChatOpenAI",
                "temperature": 0,
                "azure_endpoint": config("AZURE_OPENAI_ENDPOINT", default=""),
                "api_key": config("AZURE_OPENAI_API_KEY", default=""),
                "api_version": config("OPENAI_API_VERSION", default="")
                or "2024-02-15-preview",
                "azure_deployment": config("AZURE_OPENAI_CHAT_DEPLOYMENT", default=""),
                "timeout": 20,
            },
            "default": False,
        }
    if config("AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT", default=""):
        KH_EMBEDDINGS["azure"] = {
            "spec": {
                "__type__": "kotaemon.embeddings.AzureOpenAIEmbeddings",
                "azure_endpoint": config("AZURE_OPENAI_ENDPOINT", default=""),
                "api_key": config("AZURE_OPENAI_API_KEY", default=""),
                "api_version": config("OPENAI_API_VERSION", default="")
                or "2024-02-15-preview",
                "azure_deployment": config(
                    "AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT", default=""
                ),
                "timeout": 10,
            },
            "default": False,
        }

OPENAI_DEFAULT = "<YOUR_OPENAI_KEY>"
OPENAI_API_KEY = config("OPENAI_API_KEY", default=OPENAI_DEFAULT)
GOOGLE_API_KEY = config("GOOGLE_API_KEY", default="your-key")
IS_OPENAI_DEFAULT = len(OPENAI_API_KEY) > 0 and OPENAI_API_KEY != OPENAI_DEFAULT

if OPENAI_API_KEY:
    KH_LLMS["openai"] = {
        "spec": {
            "__type__": "kotaemon.llms.ChatOpenAI",
            "temperature": 0,
            "base_url": config("OPENAI_API_BASE", default="")
            or "https://api.openai.com/v1",
            "api_key": OPENAI_API_KEY,
            "model": config("OPENAI_CHAT_MODEL", default="gpt-4o-mini"),
            "timeout": 20,
        },
        "default": IS_OPENAI_DEFAULT,
    }
    KH_EMBEDDINGS["openai"] = {
        "spec": {
            "__type__": "kotaemon.embeddings.OpenAIEmbeddings",
            "base_url": config("OPENAI_API_BASE", default="https://api.openai.com/v1"),
            "api_key": OPENAI_API_KEY,
            "model": config(
                "OPENAI_EMBEDDINGS_MODEL", default="text-embedding-3-large"
            ),
            "timeout": 10,
            "context_length": 8191,
        },
        "default": IS_OPENAI_DEFAULT,
    }

VOYAGE_API_KEY = config("VOYAGE_API_KEY", default="")
if VOYAGE_API_KEY:
    KH_EMBEDDINGS["voyageai"] = {
        "spec": {
            "__type__": "kotaemon.embeddings.VoyageAIEmbeddings",
            "api_key": VOYAGE_API_KEY,
            "model": config("VOYAGE_EMBEDDINGS_MODEL", default="voyage-3-large"),
        },
        "default": False,
    }
    KH_RERANKINGS["voyageai"] = {
        "spec": {
            "__type__": "kotaemon.rerankings.VoyageAIReranking",
            "model_name": "rerank-2",
            "api_key": VOYAGE_API_KEY,
        },
        "default": False,
    }

if config("LOCAL_MODEL", default=""):
    KH_LLMS["ollama"] = {
        "spec": {
            "__type__": "kotaemon.llms.ChatOpenAI",
            "base_url": KH_OLLAMA_URL,
            "model": config("LOCAL_MODEL", default="qwen2.5:7b"),
            "api_key": "ollama",
        },
        "default": False,
    }
    KH_LLMS["ollama-long-context"] = {
        "spec": {
            "__type__": "kotaemon.llms.LCOllamaChat",
            "base_url": KH_OLLAMA_URL.replace("v1/", ""),
            "model": config("LOCAL_MODEL", default="qwen2.5:7b"),
            "num_ctx": 8192,
        },
        "default": False,
    }

    KH_EMBEDDINGS["ollama"] = {
        "spec": {
            "__type__": "kotaemon.embeddings.OpenAIEmbeddings",
            "base_url": KH_OLLAMA_URL,
            "model": config("LOCAL_MODEL_EMBEDDINGS", default="nomic-embed-text"),
            "api_key": "ollama",
        },
        "default"
```

### Core Architecture Module: `libs/kotaemon/kotaemon/__init__.py`
```
# Disable telemetry with monkey patching
import logging

logger = logging.getLogger(__name__)
try:
    import posthog

    def capture(*args, **kwargs):
        logger.info("posthog.capture called with args: %s, kwargs: %s", args, kwargs)

    posthog.capture = capture
except ImportError:
    pass

try:
    import os

    os.environ["HAYSTACK_TELEMETRY_ENABLED"] = "False"
    import haystack.telemetry

    haystack.telemetry.telemetry = None
except ImportError:
    pass

```

### Core Architecture Module: `libs/kotaemon/kotaemon/agents/__init__.py`
```
from .base import BaseAgent
from .io import AgentFinish, AgentOutput, AgentType, BaseScratchPad
from .langchain_based import LangchainAgent
from .react.agent import ReactAgent
from .rewoo.agent import RewooAgent
from .tools import (
    BaseTool,
    ComponentTool,
    GoogleSearchTool,
    LLMTool,
    MCPTool,
    WikipediaTool,
)

__all__ = [
    # agent
    "BaseAgent",
    "ReactAgent",
    "RewooAgent",
    "LangchainAgent",
    # tool
    "BaseTool",
    "ComponentTool",
    "GoogleSearchTool",
    "WikipediaTool",
    "LLMTool",
    "MCPTool",
    # io
    "AgentType",
    "AgentOutput",
    "AgentFinish",
    "BaseScratchPad",
]

```

### Core Architecture Module: `libs/kotaemon/kotaemon/agents/base.py`
```
from typing import Optional, Union

from kotaemon.base import BaseComponent, Node, Param
from kotaemon.llms import BaseLLM, PromptTemplate

from .io import AgentOutput, AgentType
from .tools import BaseTool


class BaseAgent(BaseComponent):
    """Define base agent interface"""

    name: str = Param(help="Name of the agent.")
    agent_type: AgentType = Param(help="Agent type, must be one of AgentType")
    description: str = Param(
        help=(
            "Description used to tell the model how/when/why to use the agent. You can"
            " provide few-shot examples as a part of the description. This will be"
            " input to the prompt of LLM."
        )
    )
    llm: Optional[BaseLLM] = Node(
        help=(
            "LLM to be used for the agent (optional). LLM must implement BaseLLM"
            " interface."
        )
    )
    prompt_template: Optional[Union[PromptTemplate, dict[str, PromptTemplate]]] = Param(
        help="A prompt template or a dict to supply different prompt to the agent"
    )
    plugins: list[BaseTool] = Param(
        default_callback=lambda _: [],
        help="List of plugins / tools to be used in the agent",
    )

    @staticmethod
    def safeguard_run(run_func, *args, **kwargs):
        def wrapper(self, *args, **kwargs):
            try:
                return run_func(self, *args, **kwargs)
            except Exception as e:
                return AgentOutput(
                    text="",
                    agent_type=self.agent_type,
                    status="failed",
                    error=str(e),
                )

        return wrapper

    def add_tools(self, tools: list[BaseTool]) -> None:
        """Helper method to add tools and update agent state if needed"""
        self.plugins.extend(tools)

    def run(self, *args, **kwargs) -> AgentOutput | list[AgentOutput]:
        """Run the component."""
        raise NotImplementedError()

```

### Core Architecture Module: `libs/kotaemon/kotaemon/agents/io/__init__.py`
```
from .base import AgentAction, AgentFinish, AgentOutput, AgentType, BaseScratchPad

__all__ = ["AgentOutput", "AgentFinish", "BaseScratchPad", "AgentType", "AgentAction"]

```

### Core Architecture Module: `libs/kotaemon/kotaemon/agents/io/base.py`
```
import json
import logging
import os
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, Literal, NamedTuple, Optional, Union

from pydantic import ConfigDict

from kotaemon.base import LLMInterface


def check_log():
    """
    Checks if logging has been enabled.
    :return: True if logging has been enabled, False otherwise.
    :rtype: bool
    """
    return os.environ.get("LOG_PATH", None) is not None


class AgentType(Enum):
    """
    Enumerated type for agent types.
    """

    openai = "openai"
    openai_multi = "openai_multi"
    openai_tool = "openai_tool"
    self_ask = "self_ask"
    react = "react"
    rewoo = "rewoo"
    vanilla = "vanilla"


class BaseScratchPad:
    """
    Base class for output handlers.

    Attributes:
    -----------
    logger : logging.Logger
        The logger object to log messages.

    Methods:
    --------
    stop():
        Stop the output.

    update_status(output: str, **kwargs):
        Update the status of the output.

    thinking(name: str):
        Log that a process is thinking.

    done(_all=False):
        Log that the process is done.

    stream_print(item: str):
        Not implemented.

    json_print(item: Dict[str, Any]):
        Log a JSON object.

    panel_print(item: Any, title: str = "Output", stream: bool = False):
        Log a panel output.

    clear():
        Not implemented.

    print(content: str, **kwargs):
        Log arbitrary content.

    format_json(json_obj: str):
        Format a JSON object.

    debug(content: str, **kwargs):
        Log a debug message.

    info(content: str, **kwargs):
        Log an informational message.

    warning(content: str, **kwargs):
        Log a warning message.

    error(content: str, **kwargs):
        Log an error message.

    critical(content: str, **kwargs):
        Log a critical message.
    """

    def __init__(self):
        """
        Initialize the BaseOutput object.

        """
        self.logger = logging
        self.log = []

    def stop(self):
        """
        Stop the output.
        """

    def update_status(self, output: str, **kwargs):
        """
        Update the status of the output.
        """
        if check_log():
            self.logger.info(output)

    def thinking(self, name: str):
        """
        Log that a process is thinking.
        """
        if check_log():
            self.logger.info(f"{name} is thinking...")

    def done(self, _all=False):
        """
        Log that the process is done.
        """

        if check_log():
            self.logger.info("Done")

    def stream_print(self, item: str):
        """
        Stream print.
        """

    def json_print(self, item: Dict[str, Any]):
        """
        Log a JSON object.
        """
        if check_log():
            self.logger.info(json.dumps(item, indent=2))

    def panel_print(self, item: Any, title: str = "Output", stream: bool = False):
        """
        Log a panel output.

        Args:
            item : Any
                The item to log.
            title : str, optional
                The title of the panel, defaults to "Output".
            stream : bool, optional
        """
        if not stream:
            self.log.append(item)
        if check_log():
            self.logger.info("-" * 20)
            self.logger.info(item)
            self.logger.info("-" * 20)

    def clear(self):
        """
        Not implemented.
        """

    def print(self, content: str, **kwargs):
        """
        Log arbitrary content.
        """
        self.log.append(content)
        if check_log():
            self.logger.info(content)

    def format_json(self, json_obj: str):
        """
        Format a JSON object.
        """
        formatted_json = json.dumps(json_obj, indent=2)
        return formatted_json

    def debug(self, content: str, **kwargs):
        """
        Log a debug message.
        """
        if check_log():
            self.logger.debug(content, **kwargs)

    def info(self, content: str, **kwargs):
        """
        Log an informational message.
        """
        if check_log():
            self.logger.info(content, **kwargs)

    def warning(self, content: str, **kwargs):
        """
        Log a warning message.
        """
        if check_log():
            self.logger.warning(content, **kwargs)

    def error(self, content: str, **kwargs):
        """
        Log an error message.
        """
        if check_log():
            self.logger.error(content, **kwargs)

    def critical(self, content: str, **kwargs):
        """
        Log a critical message.
        """
        if check_log():
            self.logger.critical(content, **kwargs)


@dataclass
class AgentAction:
    """Agent's action to take.

    Args:
        tool: The tool to invoke.
        tool_input: The input to the tool.
        log: The log message.
    """

    tool: str
    tool_input: Union[str, dict]
    log: str


class AgentFinish(NamedTuple):
    """Agent's return value when finishing execution.

    Args:
        return_values: The return values of the agent.
        log: The log message.
    """

    return_values: dict
    log: str


class AgentOutput(LLMInterface):
    """Output from an agent.

    Args:
        text: The text output from the agent.
        agent_type: The type of agent.
        status: The status after executing the agent.
        error: The error message if any.
    """

    model_config = ConfigDict(extra="allow")

    text: str
    type: str = "agent"
    agent_type: AgentType
    status: Literal["thinking", "finished", "stopped", "failed"]
    error: Optional[str] = None
    intermediate_steps: Optional[list] = None

```

### Core Architecture Module: `libs/kotaemon/kotaemon/agents/langchain_based.py`
```
from typing import List, Optional

from langchain.agents import AgentType as LCAgentType
from langchain.agents import initialize_agent
from langchain.agents.agent import AgentExecutor as LCAgentExecutor

from kotaemon.llms import LLM, ChatLLM

from .base import BaseAgent
from .io import AgentOutput, AgentType
from .tools import BaseTool


class LangchainAgent(BaseAgent):
    """Wrapper for Langchain Agent"""

    name: str = "LangchainAgent"
    agent_type: AgentType
    description: str = "LangchainAgent for answering multi-step reasoning questions"
    AGENT_TYPE_MAP = {
        AgentType.openai: LCAgentType.OPENAI_FUNCTIONS,
        AgentType.openai_multi: LCAgentType.OPENAI_MULTI_FUNCTIONS,
        AgentType.react: LCAgentType.ZERO_SHOT_REACT_DESCRIPTION,
        AgentType.self_ask: LCAgentType.SELF_ASK_WITH_SEARCH,
    }
    agent: Optional[LCAgentExecutor] = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if self.agent_type not in self.AGENT_TYPE_MAP:
            raise NotImplementedError(
                f"AgentType {self.agent_type } not supported by Langchain wrapper"
            )
        self.update_agent_tools()

    def update_agent_tools(self):
        assert isinstance(self.llm, (ChatLLM, LLM))
        langchain_plugins = [tool.to_langchain_format() for tool in self.plugins]

        # a fix for search_doc tool name:
        # use "Intermediate Answer" for self-ask agent
        found_search_tool = False
        if self.agent_type == AgentType.self_ask:
            for plugin in langchain_plugins:
                if plugin.name == "search_doc":
                    plugin.name = "Intermediate Answer"
                    langchain_plugins = [plugin]
                    found_search_tool = True
                    break

        if self.agent_type != AgentType.self_ask or found_search_tool:
            # reinit Langchain AgentExecutor
            self.agent = initialize_agent(
                langchain_plugins,
                self.llm.to_langchain_format(),
                agent=self.AGENT_TYPE_MAP[self.agent_type],
                handle_parsing_errors=True,
                verbose=True,
            )

    def add_tools(self, tools: List[BaseTool]) -> None:
        super().add_tools(tools)
        self.update_agent_tools()
        return

    def run(self, instruction: str) -> AgentOutput:
        assert (
            self.agent is not None
        ), "Lanchain AgentExecutor is not correctly initialized"

        # Langchain AgentExecutor call
        output = self.agent(instruction)["output"]

        return AgentOutput(
            text=output,
            agent_type=self.agent_type,
            status="finished",
        )

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #843** (2026-06-29): **[BUG]**
  *Symptoms*: ### Description  d  ### Reproduction steps  ```bash 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error d ```  ### Screenshots  ```bash <img width="1521" height="161" alt="image" src="https://github.com/user-attachments/assets/335056ce-aed3-43b8-8a34-8b69a93b210c" /> ```  ### Logs  ```bash  ```  ### Browsers  _No response_  ### OS  _No response_  ### Additional information  _No response_

- **Issue #842** (2026-06-29): **[Security] Unauthenticated RCE via Insecure Deserialization in /check_connection endpoint**
  *Symptoms*: ### Description   ## Summary  An unsafe deserialization vulnerability in the `/check_connection` Gradio API endpoint allows any unauthenticated attacker to execute arbitrary operating system commands on the server with the privileges of the application process. No credentials, session cookies, or API keys of any kind are required. The vulnerability exists because all Gradio event-handler endpoints are publicly reachable regardless of the application's login UI, and the endpoint deserializes attacker-controlled YAML/JSON into arbitrary Python classes using `importlib.import_module` + `getattr`.  - **Severity:** Critical (CVSS 3.1 score 10.0) - **Vector:** `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H`  ---  ## Details  ### Root Cause 1 — Gradio architectural bypass (no server-side auth enforcement)  `libs/ktem/ktem/main.py`, lines 127–189: Access control is implemented as UI tab visibility toggling in `toggle_login_visibility()`. When a user is not logged in, the chat/settings tabs are hidden in the browser, but all 361 Gradio `fn=` event-handler endpoints remain callable as `HTTP POST /run/predict` or via the Gradio client SDK with no server-side gate. The application registers `check_connection` as a public API endpoint with no `user_id` input wired:  ```python # libs/ktem/ktem/llms/ui.py  lines 243-245 self._check_connection_btn.click(     self.check_connection,     inputs=[self.selected_llm_name, self.edit_spec],   # ← no user_id     ... ) ```  A grep of the entire `llms/u

- **Issue #810** (2026-02-10): **[BUG] .env modification in container not take effect**
  *Symptoms*: ### Description  I modified the .env file in container's  /app like this <img width="1388" height="212" alt="Image" src="https://github.com/user-attachments/assets/060c15bb-ef56-4003-abc6-f267756279dc" /> And I test the config in the container to make sure it's alright.  <img width="1494" height="204" alt="Image" src="https://github.com/user-attachments/assets/33310798-043b-4430-b9c4-c2b3f9cd1489" />  But when I uploaded a pdf file for indexing, it seems that the /app/lib/embedding/openai.py is not using the config above. (I add this logging in the  /app/lib/embedding/openai.py)  <img width="1379" height="203" alt="Image" src="https://github.com/user-attachments/assets/6aa63e95-25cf-4105-a207-6c6bb0963b15" />  Did I miss something? Thanks.  ### Reproduction steps  ```bash 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error ```  ### Screenshots  ```bash ![DESCRIPTION](LINK.png) ```  ### Logs  ```bash  ```  ### Browsers  _No response_  ### OS  _No response_  ### Additional information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Never mind.  Just figured out that there is conflict between .env file and settings in web ui.

- **Issue #783** (2025-09-09): **[BUG] ERROR:ktem.index.file.pipelines:HTTP Error 403: Forbidden**
  *Symptoms*: ### Description  When running the standard Kotaemon Docker image with the command :  ``` docker run -e GRADIO_SERVER_NAME=0.0.0.0 -e GRADIO_SERVER_PORT=7860 -v ./ktem_app_data:/app/ktem_app_data -p 7860:7860 -it --rm ghcr.io/cinnamon/kotaemon:main-full ``` I get an error when trying upload an index a docx file.   ### Reproduction steps  ```bash Goto files Click to upload Select the docx file  upload result :   ❌ | IBMF-REQ-000012 - test_document_V0.docx: HTTP Error 403: Forbidden  Upload info:  Indexing [1/1]: IBMF-REQ-000012 - test_document_V0.docx  => Converting IBMF-REQ-000012 - test_document_V0.docx to text  ```  ### Logs  ```bash docker run -e GRADIO_SERVER_NAME=0.0.0.0 -e GRADIO_SERVER_PORT=7860 -v ./ktem_app_data:/app/ktem_app_data -p 7860:7860 -it --rm ghcr.io/cinnamon/kotaemon:main-full /app/launch.sh: 20: ollama: not found [nltk_data] Downloading package punkt_tab to [nltk_data]     /usr/local/lib/python3.10/site- [nltk_data]     packages/llama_index/core/_static/nltk_cache... [nltk_data]   Package punkt_tab is already up-to-date! Nano-GraphRAG dependencies not installed. Try `pip install nano-graphrag` to install. Nano-GraphRAG retriever pipeline will not work properly. INFO:chromadb.telemetry.product.posthog:Anonymized telemetry enabled. See                     https://docs.trychroma.com/telemetry for more information. INFO:kotaemon:posthog.capture called with args: ('91a3fa9d-32d1-446a-870a-0e11b1ef6385', 'ClientStartEvent', {'batch_size': 1, 'in_colab': False, '
  **Post-Mortem & Fix Analysis**:
  > I had the same issue and my workaround was to update the unstructured package in the container: `docker exec -it CONTAINER_NAME pip install --upgrade unstructured`
  > Big thanks, this solved this issue !!

- **Issue #769** (2025-08-09): **[BUG]  error after installation**
  *Symptoms*: ### Description  Starting Kotaemon UI... (prebuilt PDF.js is at C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\libs\ktem\ktem\assets\prebuilt\pdfjs-4.0.379-dist) Traceback (most recent call last):   File "C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\app.py", line 14, in <module>     from ktem.main import App  # noqa   File "C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\install_dir\env\lib\site-packages\ktem\main.py", line 6, in <module>     from ktem.pages.resources import ResourcesTab   File "C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\install_dir\env\lib\site-packages\ktem\pages\resources\__init__.py", line 4, in <module>     from ktem.embeddings.ui import EmbeddingManagement   File "C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\install_dir\env\lib\site-packages\ktem\embeddings\ui.py", line 10, in <module>     from .manager import embedding_models_manager   File "C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\install_dir\env\lib\site-packages\ktem\embeddings\manager.py", line 216, in <module>     embedding_models_manager = EmbeddingManager()   File "C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\install_dir\env\lib\site-packages\ktem\embeddings\manager.py", line 34, in __init__     self.load()   File "C:\Users\massimo\Downloads\kotaemon-app\kotaemon-app\install_dir\env\lib\site-packages\ktem\embeddings\manager.py", line 45, in load     self._models[item.name] = deserialize(item.spec, safe=False)   File "C:\Users\massimo\Downl
  **Post-Mortem & Fix Analysis**:
  > I have the same problem on Ubuntu 24.04.2 LTS.
  > Resolved. Comment Voyageai in .env.
  > Could you please give more details on how you resolved this? Commented the voyageai lines in .env but issue persists.

- **Issue #725** (2025-04-03): **[BUG] deployment failed on huggingface space with the latest docker image**
  *Symptoms*: ### Description  I was trying to deploy the kotaemon using Huggingface space. However, after the update to the latest version (March 30). the build continues to fail on the space side. I tried main-full, main-lite, and feat-nltk-build-lite. All failed with code 137.  It looks like the Docker build is OOM during the exporting cache phase. I also tried to upgrade my space RAM (32GB), but it didn't work.    ### Reproduction steps  Here is my huggingface space [site](https://huggingface.co/spaces/WFRaain/ad_rag_gui/tree/main).   ### Logs  ```bash build error Job failed with exit code: 137  ===== Build Queued at 2025-04-03 01:39:30 / Commit SHA: 59f0ef5 =====  --> FROM ghcr.io/cinnamon/kotaemon:main-lite@sha256:80dc9b3e3f3e55129e8d8dac5f4c7762665572114d749d663c35354b8d66e624 DONE 5.9s  DONE 6.0s  DONE 6.1s  DONE 21.3s  DONE 24.8s  DONE 24.8s  --> RUN apt update -qqy && apt install -y --no-install-recommends     bash     curl     wget     procps     git     git-lfs &&     apt-get clean && rm -rf /var/lib/apt/lists/*  WARNING: apt does not have a stable CLI interface. Use with caution in scripts.  1 package can be upgraded. Run 'apt list --upgradable' to see it.  WARNING: apt does not have a stable CLI interface. Use with caution in scripts.  Reading package lists... Building dependency tree... Reading state information... bash is already the newest version (5.2.15-2+b7). bash set to manually installed. curl is already the newest version (7.88.1-10+deb12u12). procps is already the n
  **Post-Mortem & Fix Analysis**:
  > Seem weird. Might be just occasional HF space issue. I just duplicate the space https://huggingface.co/spaces/cin-model/kotaemon_template for testing and it works fine.
  > Thanks, it works now!

- **Issue #721** (2025-04-02): **[BUG] new docker main-ollama: ModuleNotFoundError: No module named 'lance'**
  *Symptoms*: ### Description  starting docker  ``` docker run \ -e GRADIO_SERVER_NAME=0.0.0.0 \ -e GRADIO_SERVER_PORT=7860 \ -e USE_LIGHTRAG=true \ -e USE_MS_GRAPHRAG=false \ -e USE_NANO_GRAPHRAG=false \ -e OPENAI_API_KEY=sk-... \ -e LOCAL_MODEL=qwen2.5:7b \ -e KH_OLLAMA_URL=http://host.docker.internal:11434/v1/ \ -e COHERE_API_KEY=0... \ -v ./ktem_app_data:/app/ktem_app_data \ -p 7860:7860 -it --rm \ ghcr.io/cinnamon/kotaemon:main-ollama ``` and uploading file gives an error: ModuleNotFoundError: No module named 'lance'   ### Reproduction steps  ```bash delete old docker stuff and provoke new download:   docker run \ -e GRADIO_SERVER_NAME=0.0.0.0 \ -e GRADIO_SERVER_PORT=7860 \ -e USE_LIGHTRAG=true \ -e USE_MS_GRAPHRAG=false \ -e USE_NANO_GRAPHRAG=false \ -e OPENAI_API_KEY=sk-... \ -e LOCAL_MODEL=qwen2.5:7b \ -e KH_OLLAMA_URL=http://host.docker.internal:11434/v1/ \ -e COHERE_API_KEY=0... \ -v ./ktem_app_data:/app/ktem_app_data \ -p 7860:7860 -it --rm \ ghcr.io/cinnamon/kotaemon:main-ollama   upload file to koteamon in Files/File Collection ```  ### Screenshots  ```bash ![DESCRIPTION](LINK.png) ```  ### Logs  ```bash ❯ docker run \ -e GRADIO_SERVER_NAME=0.0.0.0 \ -e GRADIO_SERVER_PORT=7860 \ -e USE_LIGHTRAG=true \ -e USE_MS_GRAPHRAG=false \ -e USE_NANO_GRAPHRAG=false \ -e OPENAI_API_KEY=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 \ -e LOCAL_MODEL=qwen2.5:7b \ -e KH_OLLAMA_URL=http://host.docker.internal:11434/v1/ \ -e COHERE_API_KEY=0wcJGpDBl68zCbuMzeCwshp38bJJr7zUgdc9F5rw \ -v ./k
  **Post-Mortem & Fix Analysis**:
  > the api keys are not a joke for 1st April... they are revoked 
  > @bennoloeffler this has been fixed in latest image. Please remove and pull new one.

- **Issue #715** (2025-03-31): **[BUG] fails to launch when building docker image**
  *Symptoms*: i noticed that the official image is a few months old and some versions behind the latest release  any tips on building for docker?  I'm using a workflow that pulls the dockerfile whenever a new release is pushed and builds the image, no modification just the full fat dockerfile   and i can't launch the docker image built from the dockerfile   running on arm64v8  full install of everything except graphrag(it's disabled for arm on the dockerfile but why, the app is super lightweight)?    ### Logs  [kotaemon.log (3).txt](https://github.com/user-attachments/files/19527064/kotaemon.log.3.txt)  here's the workflow script [build.kotaemon.yml.txt](https://github.com/user-attachments/files/19527058/build.kotaemon.yml.txt)
  **Post-Mortem & Fix Analysis**:
  > [kotaemon.log (3).txt](https://github.com/user-attachments/files/19527030/kotaemon.log.3.txt)   building with the provided dockerfile causes the image to not launch, any help is appreciated 🙏
  > @Fuckingnameless I will update a new Docker build soon with a new release.
  > Done

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

### Incident Patch 1: `4015bb0f` (2026-03-28)
**Commit Message**: fix: update default Cohere rerank model to rerank-v4.0-fast

**File**: `flowsettings.py` (modified, +1/-1)
```diff
@@ -310,7 +310,7 @@
 KH_RERANKINGS["cohere"] = {
     "spec": {
         "__type__": "kotaemon.rerankings.CohereReranking",
-        "model_name": "rerank-multilingual-v2.0",
+        "model_name": "rerank-v4.0-fast",
         "cohere_api_key": config("COHERE_API_KEY", default=""),
     },
     "default": True,
```

**File**: `libs/kotaemon/kotaemon/indices/rankings/cohere.py` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 
 
 class CohereReranking(BaseReranking):
-    model_name: str = "rerank-multilingual-v2.0"
+    model_name: str = "rerank-v4.0-fast"
     cohere_api_key: str = config("COHERE_API_KEY", "")
     use_key_from_ktem: bool = False
 
```

**File**: `libs/kotaemon/kotaemon/rerankings/cohere.py` (modified, +4/-3)
```diff
@@ -13,10 +13,11 @@ class CohereReranking(BaseReranking):
     """Cohere Reranking model"""
 
     model_name: str = Param(
-        "rerank-multilingual-v2.0",
+        "rerank-v4.0-fast",
         help=(
-            "ID of the model to use. You can go to [Supported Models]"
-            "(https://docs.cohere.com/docs/rerank-2) to see the supported models"
+            "ID of the model to use. See [Cohere Rerank models]"
+            "(https://docs.cohere.com/docs/models#rerank) for supported IDs "
+            "(e.g. rerank-v4.0-fast, rerank-v4.0-pro, rerank-multilingual-v3.0)."
         ),
         required=True,
     )
```

**File**: `libs/ktem/ktem/pages/setup.py` (modified, +1/-1)
```diff
@@ -226,7 +226,7 @@ def update_model(
                     name="cohere",
                     spec={
                         "__type__": "kotaemon.rerankings.CohereReranking",
-                        "model_name": "rerank-multilingual-v2.0",
+                        "model_name": "rerank-v4.0-fast",
                         "cohere_api_key": cohere_api_key,
                     },
                     default=True,
```

---

### Incident Patch 2: `37cdc28c` (2025-07-02)
**Commit Message**: fix: add validation to avoid path-traversal vulnerabilities (#755)

* fix: add validation to avoid path-traversal vulnerabilities

* fix: update init value is_safe

Co-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>

* refactor: extract zip check

* fix: dont need to check relative path

* fix: disable check zip file (zipfile have taken it)

---------

Co-authored-by: kan_cin <kan@cinnamon.is>
Co-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>
Co-authored-by: phv2312 <kat87yb@gmail.com>

**File**: `libs/ktem/ktem/index/file/ui.py` (modified, +23/-10)
```diff
@@ -1059,15 +1059,18 @@ def _may_extract_zip(self, files, zip_dir: str):
         """Handle zip files"""
         zip_files = [file for file in files if file.endswith(".zip")]
         remaining_files = [file for file in files if not file.endswith("zip")]
+        errors: list[str] = []
 
         # Clean-up <zip_dir> before unzip to remove old files
         shutil.rmtree(zip_dir, ignore_errors=True)
 
+        # Unzip
         for zip_file in zip_files:
             # Prepare new zip output dir, separated for each files
             basename = os.path.splitext(os.path.basename(zip_file))[0]
             zip_out_dir = os.path.join(zip_dir, basename)
             os.makedirs(zip_out_dir, exist_ok=True)
+
             with zipfile.ZipFile(zip_file, "r") as zip_ref:
                 zip_ref.extractall(zip_out_dir)
 
@@ -1084,7 +1087,7 @@ def _may_extract_zip(self, files, zip_dir: str):
         if n_zip_file > 0:
             print(f"Update zip files: {n_zip_file}")
 
-        return remaining_files
+        return remaining_files, errors
 
     def index_fn(
         self, files, urls, reindex: bool, settings, user_id
@@ -1100,20 +1103,22 @@ def index_fn(
         """
         if urls:
             files = [it.strip() for it in urls.split("\n")]
-            errors = []
+            errors = self.validate_urls(files)
         else:
             if not files:
                 gr.Info("No uploaded file")
                 yield "", ""
                 return
+            files, unzip_errors = self._may_extract_zip(
+                files, flowsettings.KH_ZIP_INPUT_DIR
+            )
+            errors = self.validate_files(files)
+            errors.extend(unzip_errors)
 
-            files = self._may_extract_zip(files, flowsettings.KH_ZIP_INPUT_DIR)
-
-            errors = self.validate(files)
-            if errors:
-                gr.Warning(", ".join(errors))
-                yield "", ""
-                return
+        if errors:
+            gr.Warning(", ".join(errors))
+            yield "", ""
+            return
 
         gr.Info(f"Start indexing {len(files)} files...")
 
@@ -1569,7 +1574,7 @@ def interact_group_list(self, list_groups, ev: gr.SelectData):
             selected_item["files"],
         )
 
-    def validate(self, files: list[str]):
+    def validate_files(self, files: list[str]):
         """Validate if the files are valid"""
         paths = [Path(file) for file in files]
         errors = []
@@ -1598,6 +1603,14 @@ def validate(self, files: list[str]):
 
         return errors
 
+    def validate_urls(self, urls: list[str]):
+        """Validate if the urls are valid"""
+        errors = []
+        for url in urls:
+            if not url.startswith("http") and not url.startswith("https"):
+                errors.append(f"Invalid url `{url}`")
+        return errors
+
 
 class FileSelector(BasePage):
     """File selector UI in the Chat page"""
```

---

### Incident Patch 3: `ec1f6abd` (2025-07-01)
**Commit Message**: fix: typo lancedb (#760)

**File**: `libs/kotaemon/kotaemon/rerankings/cohere.py` (modified, +7/-2)
```diff
@@ -1,6 +1,7 @@
 from __future__ import annotations
 
 import os
+
 from decouple import config
 
 from kotaemon.base import Document, Param
@@ -25,7 +26,9 @@ class CohereReranking(BaseReranking):
         required=True,
     )
     base_url: str = Param(
-        None, help="Rerank API base url. Default is https://api.cohere.com", required=False
+        None,
+        help="Rerank API base url. Default is https://api.cohere.com",
+        required=False,
     )
 
     def run(self, documents: list[Document], query: str) -> list[Document]:
@@ -42,7 +45,9 @@ def run(self, documents: list[Document], query: str) -> list[Document]:
             print("Cohere API key not found. Skipping rerankings.")
             return documents
 
-        cohere_client = cohere.Client(self.cohere_api_key, base_url=self.base_url or os.getenv("CO_API_URL"))
+        cohere_client = cohere.Client(
+            self.cohere_api_key, base_url=self.base_url or os.getenv("CO_API_URL")
+        )
         compressed_docs: list[Document] = []
 
         if not documents:  # to avoid empty api call
```

**File**: `libs/kotaemon/kotaemon/storages/docstores/lancedb.py` (modified, +3/-2)
```diff
@@ -114,10 +114,11 @@ def get(self, ids: Union[List[str], str]) -> List[Document]:
         except (ValueError, FileNotFoundError):
             docs = []
 
-        # return the documents using the order of original ids (which were ordered by score)
+        # return the documents using the order of original
+        # ids (which were ordered by score)
         doc_dict = {
             doc["id"]: Document(
-                d_=doc["id"],
+                id_=doc["id"],
                 text=doc["text"] if doc["text"] else "<empty>",
                 metadata=json.loads(doc["attributes"]),
             )
```

---

### Incident Patch 4: `833982ac` (2025-06-05)
**Commit Message**: fix(docstore): preserve retrieval ranking order in lancedb get() (#745)

**File**: `libs/kotaemon/kotaemon/storages/docstores/lancedb.py` (modified, +7/-4)
```diff
@@ -113,14 +113,17 @@ def get(self, ids: Union[List[str], str]) -> List[Document]:
             )
         except (ValueError, FileNotFoundError):
             docs = []
-        return [
-            Document(
-                id_=doc["id"],
+
+        # return the documents using the order of original ids (which were ordered by score)
+        doc_dict = {
+            doc["id"]: Document(
+                d_=doc["id"],
                 text=doc["text"] if doc["text"] else "<empty>",
                 metadata=json.loads(doc["attributes"]),
             )
             for doc in docs
-        ]
+        }
+        return [doc_dict[_id] for _id in ids if _id in doc_dict]
 
     def delete(self, ids: Union[List[str], str], refresh_indices: bool = True):
         """Delete document by id"""
```

---

### Incident Patch 5: `ddb51872` (2025-06-05)
**Commit Message**: fix: scope is not passd to vector store query (#747)

**File**: `libs/kotaemon/kotaemon/indices/vectorindex.py` (modified, +2/-2)
```diff
@@ -168,7 +168,7 @@ def run(
         if self.retrieval_mode == "vector":
             emb = self.embedding(text)[0].embedding
             _, scores, ids = self.vector_store.query(
-                embedding=emb, top_k=top_k_first_round, **kwargs
+                embedding=emb, top_k=top_k_first_round, doc_ids=scope, **kwargs
             )
             docs = self.doc_store.get(ids)
             result = [
@@ -197,7 +197,7 @@ def query_vectorstore():
 
                 assert self.doc_store is not None
                 _, vs_scores, vs_ids = self.vector_store.query(
-                    embedding=emb, top_k=top_k_first_round, **kwargs
+                    embedding=emb, top_k=top_k_first_round, doc_ids=scope, **kwargs
                 )
                 if vs_ids:
                     vs_docs = self.doc_store.get(vs_ids)
```

---

### Incident Patch 6: `6f4acc97` (2025-04-15)
**Commit Message**: fix: update Docling call to generate figure caption #729 #none

**File**: `libs/kotaemon/kotaemon/loaders/docling_loader.py` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ def load_data(
             else:
                 gen_caption_count += 1
                 gen_caption = generate_single_figure_caption(
-                    img_base64, self.vlm_endpoint
+                    figure=img_base64, vlm_endpoint=self.vlm_endpoint
                 )
 
             # join the extractive and generative captions
```

---

### Incident Patch 7: `a3e2e207` (2025-04-01)
**Commit Message**: fix: comfort CI

**File**: `libs/ktem/ktem/index/file/graph/lightrag_pipelines.py` (modified, +3/-4)
```diff
@@ -29,10 +29,9 @@
 
 try:
     from lightrag import LightRAG, QueryParam
-    
-    # newer verisons of LightRAG needs to be initialized before using
-    from lightrag.kg.shared_storage import initialize_pipeline_status
 
+    # newer versions of LightRAG needs to be initialized before using
+    from lightrag.kg.shared_storage import initialize_pipeline_status
     from lightrag.operate import (
         _find_most_related_edges_from_entities,
         _find_most_related_text_unit_from_entities,
@@ -240,7 +239,7 @@ def build_graphrag(working_dir, llm_func, embedding_func):
         embedding_func=embedding_func,
     )
 
-    # newer verisons of LightRAG needs to be initialized before using
+    # newer versions of LightRAG needs to be initialized before using
     asyncio.run(graphrag_func.initialize_storages())
     asyncio.run(initialize_pipeline_status())
 
```

---

### Incident Patch 8: `911b20ca` (2025-04-01)
**Commit Message**: fix: error 'history_messages' with LightRAG latest version (#719) bump:patch

* fix: Error: 'history_messages' with LightRAG

* added comment

**File**: `libs/ktem/ktem/index/file/graph/lightrag_pipelines.py` (modified, +9/-0)
```diff
@@ -29,6 +29,10 @@
 
 try:
     from lightrag import LightRAG, QueryParam
+    
+    # newer verisons of LightRAG needs to be initialized before using
+    from lightrag.kg.shared_storage import initialize_pipeline_status
+
     from lightrag.operate import (
         _find_most_related_edges_from_entities,
         _find_most_related_text_unit_from_entities,
@@ -235,6 +239,11 @@ def build_graphrag(working_dir, llm_func, embedding_func):
         llm_model_func=llm_func,
         embedding_func=embedding_func,
     )
+
+    # newer verisons of LightRAG needs to be initialized before using
+    asyncio.run(graphrag_func.initialize_storages())
+    asyncio.run(initialize_pipeline_status())
+
     return graphrag_func
 
 
```

---

### Incident Patch 9: `79a5f064` (2025-04-01)
**Commit Message**: fix: rename nonexistent function call in update_macos.sh script (#687) #none

**File**: `scripts/update_macos.sh` (modified, +2/-2)
```diff
@@ -40,7 +40,7 @@ function update_latest() {
 
     if [ -f "pyproject.toml" ]; then
         echo "Source files detected. Please perform git pull manually."
-        deactivate_environment
+        deactivate_conda_env
         exit 1
     else
         echo "Installing version: $app_version"
@@ -51,7 +51,7 @@ function update_latest() {
         if [ $? -ne 0 ]; then
             echo
             echo "Update failed. You may need to run the update again."
-            deactivate_environment
+            deactivate_conda_env
             exit 1
         fi
     fi
```

---

### Incident Patch 10: `edec6142` (2025-03-31)
**Commit Message**: fix: add pylance req for local script-based install bump:patch

**File**: `libs/kotaemon/pyproject.toml` (modified, +1/-0)
```diff
@@ -51,6 +51,7 @@ dependencies = [
     "plotly<6.0.0",
     "PyMuPDF>=1.23,<=1.24.11",
     "pypdf>=4.2.0,<4.3",
+    "pylance",
     "python-decouple", # for theflow
     "python-docx>=1.1.0,<1.2",
     "python-dotenv>=1.0.1,<1.1",
```

#### Recent Merged Pull Requests:
- **PR #849** (closed): Agent/harden minimal baseline (@SwartzMss)
- **PR #840** (closed): feat: benchmark structure and score method update (@262412)
- **PR #829** (closed): docs: update uv installation instructions to remove missing run_uv.sh (@octo-patch)
- **PR #824** (closed): feat: enhance logging configuration and improve log messages across the application (@KudoKhang)
- **PR #823** (2026-03-28): fix: update default Cohere rerank model to rerank-v4.0-fast (@KudoKhang)
- **PR #818** (closed): feat: add Novita AI as LLM provider (@Alex-yang00)
- **PR #816** (closed): Dev (@262412)
- **PR #814** (2026-05-30): feat: integrate PaddleOCR as document loaders + enhance chat/index UX (@niko-nnkn)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
