# Forensic Learning Record (Deep Inspection): microsoft/graphrag

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-graphrag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/graphrag](https://github.com/microsoft/graphrag))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:27:14.803Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/graphrag`
- **Description**: A modular graph-based Retrieval-Augmented Generation (RAG) system
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 36233 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/graphrag-llm/graphrag_llm/config/template_engine_config.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""Template engine configuration."""

from pydantic import BaseModel, ConfigDict, Field, model_validator

from graphrag_llm.config.types import (
    TemplateEngineType,
    TemplateManagerType,
)


class TemplateEngineConfig(BaseModel):
    """Configuration for the template engine."""

    model_config = ConfigDict(extra="allow")
    """Allow extra fields to support custom metrics implementations."""

    type: str = Field(
        default=TemplateEngineType.Jinja,
        description="The template engine to use. [jinja]",
    )

    template_manager: str = Field(
        default=TemplateManagerType.File,
        description="The template manager to use. [file, memory] (default: file)",
    )

    base_dir: str | None = Field(
        default=None,
        description="The base directory for file-based template managers.",
    )

    template_extension: str | None = Field(
        default=None,
        description="The file extension for locating templates in file-based template managers.",
    )

    encoding: str | None = Field(
        default=None,
        description="The file encoding for reading templates in file-based template managers.",
    )

    def _validate_file_template_manager_config(self) -> None:
        """Validate parameters for file-based template managers."""
        if self.base_dir is not None and self.base_dir.strip() == "":
            msg = "base_dir must be specified for file-based template managers."
            raise ValueError(msg)

        if (
            self.template_extension is not None
            and self.template_extension.strip() == ""
        ):
            msg = "template_extension cannot be an empty string for file-based template managers."
            raise ValueError(msg)

        if (
            self.template_extension is not None
            and not self.template_extension.startswith(".")
        ):
            self.template_extension = f".{self.template_extension}"

    @model_validator(mode="after")
    def _validate_model(self):
        """Validate the template engine configuration based on its type."""
        if self.template_manager == TemplateManagerType.File:
            self._validate_file_template_manager_config()
        return self

```

### Core Architecture Module: `packages/graphrag-llm/graphrag_llm/templating/jinja_template_engine.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""Jinja template engine."""

from typing import TYPE_CHECKING, Any

from jinja2 import StrictUndefined, Template, UndefinedError

from graphrag_llm.templating.template_engine import TemplateEngine

if TYPE_CHECKING:
    from graphrag_llm.templating.template_manager import TemplateManager


class JinjaTemplateEngine(TemplateEngine):
    """Jinja template engine."""

    _templates: dict[str, Template]
    _template_manager: "TemplateManager"

    def __init__(self, *, template_manager: "TemplateManager", **kwargs: Any) -> None:
        """Initialize the template engine.

        Args
        ----
            template_manager: TemplateManager
                The template manager to use for loading templates.
        """
        self._templates = {}
        self._template_manager = template_manager

    def render(self, template_name: str, context: dict[str, Any]) -> str:
        """Render a template with the given context."""
        jinja_template = self._templates.get(template_name)
        if jinja_template is None:
            template_contents = self._template_manager.get(template_name)
            if template_contents is None:
                msg = f"Template '{template_name}' not found."
                raise KeyError(msg)
            jinja_template = Template(template_contents, undefined=StrictUndefined)
            self._templates[template_name] = jinja_template
        try:
            return jinja_template.render(**context)
        except UndefinedError as e:
            msg = f"Missing key in context for template '{template_name}': {e.message}"
            raise KeyError(msg) from e
        except Exception as e:
            msg = f"Error rendering template '{template_name}': {e!s}"
            raise RuntimeError(msg) from e

    @property
    def template_manager(self) -> "TemplateManager":
        """Template manager associated with this engine."""
        return self._template_manager

```

### Core Architecture Module: `packages/graphrag-llm/graphrag_llm/templating/template_engine.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""Abstract base class for template engines."""

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from graphrag_llm.templating.template_manager import TemplateManager


class TemplateEngine(ABC):
    """Abstract base class for template engines."""

    @abstractmethod
    def __init__(self, *, template_manager: "TemplateManager", **kwargs: Any) -> None:
        """Initialize the template engine.

        Args
        ----
            template_manager: TemplateManager
                The template manager to use for loading templates.

        """
        raise NotImplementedError

    @abstractmethod
    def render(self, template_name: str, context: dict[str, Any]) -> str:
        """Render a template with the given context.

        Args
        ----
            template_name: str
                The name of the template to render.
            context: dict[str, str]
                The context to use for rendering the template.

        Returns
        -------
            str: The rendered template.

        Raises
        ------
            KeyError: If the template is not found or a required key is missing in the context.
        """
        raise NotImplementedError

    @property
    @abstractmethod
    def template_manager(self) -> "TemplateManager":
        """Template manager associated with this engine."""
        raise NotImplementedError

```

### Core Architecture Module: `packages/graphrag-llm/graphrag_llm/templating/template_engine_factory.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""Template engine factory implementation."""

from collections.abc import Callable
from typing import TYPE_CHECKING

from graphrag_common.factory import Factory

from graphrag_llm.config.template_engine_config import TemplateEngineConfig
from graphrag_llm.config.types import TemplateEngineType
from graphrag_llm.templating.template_engine import TemplateEngine
from graphrag_llm.templating.template_manager_factory import create_template_manager

if TYPE_CHECKING:
    from graphrag_common.factory import ServiceScope


class TemplateEngineFactory(Factory[TemplateEngine]):
    """Factory for creating template engine instances."""


template_engine_factory = TemplateEngineFactory()


def register_template_engine(
    template_engine_type: str,
    template_engine_initializer: Callable[..., TemplateEngine],
    scope: "ServiceScope" = "transient",
) -> None:
    """Register a custom template engine implementation.

    Args
    ----
        template_engine_type: str
            The template engine id to register.
        template_engine_initializer: Callable[..., TemplateEngine]
            The template engine initializer to register.
        scope: ServiceScope (default: "transient")
            The service scope for the template engine instance.
    """
    template_engine_factory.register(
        strategy=template_engine_type,
        initializer=template_engine_initializer,
        scope=scope,
    )


def create_template_engine(
    template_engine_config: TemplateEngineConfig | None = None,
) -> TemplateEngine:
    """Create a TemplateEngine instance.

    Args
    ----
        template_engine_config: TemplateEngineConfig | None
            The configuration for the template engine. If None, defaults will be used.

    Returns
    -------
        TemplateEngine:
            An instance of a TemplateEngine subclass.
    """
    template_engine_config = template_engine_config or TemplateEngineConfig()

    strategy = template_engine_config.type
    template_manager = create_template_manager(
        template_engine_config=template_engine_config
    )
    init_args = template_engine_config.model_dump()

    if strategy not in template_engine_factory:
        match strategy:
            case TemplateEngineType.Jinja:
                from graphrag_llm.templating.jinja_template_engine import (
                    JinjaTemplateEngine,
                )

                template_engine_factory.register(
                    strategy=TemplateEngineType.Jinja,
                    initializer=JinjaTemplateEngine,
                    scope="singleton",
                )
            case _:
                msg = f"TemplateEngineConfig.type '{strategy}' is not registered in the TemplateEngineFactory. Registered strategies: {', '.join(template_engine_factory.keys())}"
                raise ValueError(msg)

    return template_engine_factory.create(
        strategy=strategy,
        init_args={
            **init_args,
            "template_manager": template_manager,
        },
    )

```

### Core Architecture Module: `packages/graphrag-llm/graphrag_llm/utils/__init__.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""Utils module."""

from graphrag_llm.utils.completion_messages_builder import (
    CompletionContentPartBuilder,
    CompletionMessagesBuilder,
)
from graphrag_llm.utils.create_completion_response import (
    create_completion_response,
)
from graphrag_llm.utils.create_embedding_response import create_embedding_response
from graphrag_llm.utils.function_tool_manager import (
    FunctionArgumentModel,
    FunctionDefinition,
    FunctionToolManager,
    ToolMessage,
)
from graphrag_llm.utils.gather_completion_response import (
    gather_completion_response,
    gather_completion_response_async,
)
from graphrag_llm.utils.structure_response import (
    structure_completion_response,
)

__all__ = [
    "CompletionContentPartBuilder",
    "CompletionMessagesBuilder",
    "FunctionArgumentModel",
    "FunctionDefinition",
    "FunctionToolManager",
    "ToolMessage",
    "create_completion_response",
    "create_embedding_response",
    "gather_completion_response",
    "gather_completion_response_async",
    "structure_completion_response",
]

```

### Core Architecture Module: `packages/graphrag-llm/graphrag_llm/utils/create_completion_response.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""Create completion response."""

from graphrag_llm.types import (
    LLMChoice,
    LLMCompletionMessage,
    LLMCompletionResponse,
    LLMCompletionUsage,
)


def create_completion_response(response: str) -> LLMCompletionResponse:
    """Create a completion response object.

    Args:
        response: The completion response string.

    Returns
    -------
        LLMCompletionResponse: The completion response object.
    """
    return LLMCompletionResponse(
        id="completion-id",
        object="chat.completion",
        created=0,
        model="mock-model",
        choices=[
            LLMChoice(
                index=0,
                message=LLMCompletionMessage(
                    role="assistant",
                    content=response,
                ),
                finish_reason="stop",
            )
        ],
        usage=LLMCompletionUsage(
            prompt_tokens=0,
            completion_tokens=0,
            total_tokens=0,
        ),
        formatted_response=None,
    )

```

### Core Architecture Module: `packages/graphrag-llm/graphrag_llm/utils/create_embedding_response.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""Create embedding response utilities."""

from graphrag_llm.types import LLMEmbedding, LLMEmbeddingResponse, LLMEmbeddingUsage


def create_embedding_response(
    embeddings: list[float], batch_size: int = 1
) -> LLMEmbeddingResponse:
    """Create a CreateEmbeddingResponse object.

    Args:
        embeddings: List of embedding vectors.
            batch_size: The number of embedding objects to generate.
    -------
        An LLMEmbeddingResponse object.
    """
    embeddings_objects = [
        LLMEmbedding(
            object="embedding",
            embedding=embeddings,
            index=index,
        )
        for index in range(batch_size)
    ]

    return LLMEmbeddingResponse(
        object="list",
        data=embeddings_objects,
        model="mock-model",
        usage=LLMEmbeddingUsage(
            prompt_tokens=0,
            total_tokens=0,
        ),
    )

```

### Core Architecture Module: `packages/graphrag-llm/graphrag_llm/utils/function_tool_manager.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""Function tool manager."""

import json
from collections.abc import Callable
from typing import TYPE_CHECKING, Any, Generic, TypeVar

from openai import pydantic_function_tool
from pydantic import BaseModel
from typing_extensions import TypedDict

if TYPE_CHECKING:
    from graphrag_llm.types import LLMCompletionFunctionToolParam, LLMCompletionResponse

FunctionArgumentModel = TypeVar(
    "FunctionArgumentModel", bound=BaseModel, covariant=True
)


class FunctionDefinition(TypedDict, Generic[FunctionArgumentModel]):
    """Function definition."""

    name: str
    description: str
    input_model: type[FunctionArgumentModel]
    function: Callable[[FunctionArgumentModel], str]


class ToolMessage(TypedDict):
    """Function tool response message to be added to message history."""

    content: str
    tool_call_id: str


class FunctionToolManager:
    """Function tool manager."""

    _tools: dict[str, FunctionDefinition[Any]]

    def __init__(self) -> None:
        """Initialize FunctionToolManager."""
        self._tools = {}

    def register_function_tool(
        self,
        *,
        name: str,
        description: str,
        input_model: type[FunctionArgumentModel],
        function: Callable[[FunctionArgumentModel], str],
    ) -> None:
        """Register function tool.

        Args
        ----
            name: str
                The name of the function tool.
            description: str
                The description of the function tool.
            input_model: type[T]
                The pydantic model type for the function tool input.
            function: Callable[[T], str]
                The function to call for the function tool.
        """
        self._tools[name] = {
            "name": name,
            "description": description,
            "input_model": input_model,
            "function": function,
        }

    def definitions(self) -> list["LLMCompletionFunctionToolParam"]:
        """Get function tool definitions.

        Returns
        -------
            list[LLMCompletionFunctionToolParam]
                List of function tool definitions.
        """
        return [
            pydantic_function_tool(
                tool_def["input_model"],
                name=tool_def["name"],
                description=tool_def["description"],
            )
            for tool_def in self._tools.values()
        ]

    def call_functions(self, response: "LLMCompletionResponse") -> list[ToolMessage]:
        """Call functions based on the response.

        Args
        ----
            response: LLMCompletionResponse
                The LLM completion response.

        Returns
        -------
            list[ToolMessage]
                The list of tool response messages to be added to the message history.
        """
        if not response.choices[0].message.tool_calls:
            return []

        tool_messages: list[ToolMessage] = []

        for tool_call in response.choices[0].message.tool_calls:
            if tool_call.type != "function":
                continue
            tool_id = tool_call.id
            function_name = tool_call.function.name
            function_args = tool_call.function.arguments

            if function_name not in self._tools:
                msg = f"Function '{function_name}' not registered."
                raise ValueError(msg)

            tool_def = self._tools[function_name]
            input_model = tool_def["input_model"]
            function = tool_def["function"]

            try:
                parsed_args_dict = json.loads(function_args)
                input_model_instance = input_model(**parsed_args_dict)
            except Exception as e:
                msg = f"Failed to parse arguments for function '{function_name}': {e}"
                raise ValueError(msg) from e

            result = function(input_model_instance)
            tool_messages.append({
                "content": result,
                "tool_call_id": tool_id,
            })

        return tool_messages

```

### Core Architecture Module: `packages/graphrag-llm/graphrag_llm/utils/gather_completion_response.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""Gather Completion Response Utility."""

from collections.abc import AsyncIterator, Iterator
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from graphrag_llm.types import (
        LLMCompletionChunk,
        LLMCompletionResponse,
    )


def gather_completion_response(
    response: "LLMCompletionResponse | Iterator[LLMCompletionChunk]",
) -> str:
    """Gather completion response from an iterator of response chunks.

    Args
    ----
        response: LMChatCompletion | Iterator[LLMChatCompletionChunk]
            The completion response or an iterator of response chunks.

    Returns
    -------
        The gathered response as a single string.
    """
    if isinstance(response, Iterator):
        return "".join(chunk.choices[0].delta.content or "" for chunk in response)

    return response.choices[0].message.content or ""


async def gather_completion_response_async(
    response: "LLMCompletionResponse | AsyncIterator[LLMCompletionChunk]",
) -> str:
    """Gather completion response from an iterator of response chunks.

    Args
    ----
        response: LMChatCompletion | AsyncIterator[LLMChatCompletionChunk]
            The completion response or an iterator of response chunks.

    Returns
    -------
        The gathered response as a single string.
    """
    if isinstance(response, AsyncIterator):
        gathered_content = ""
        async for chunk in response:
            gathered_content += chunk.choices[0].delta.content or ""

        return gathered_content

    return response.choices[0].message.content or ""

```

### Core Architecture Module: `packages/graphrag-llm/graphrag_llm/utils/structure_response.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""Structure response as pydantic base model."""

import json
from typing import Any, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel, covariant=True)


def structure_completion_response(response: str, model: type[T]) -> T:
    """Structure completion response as pydantic base model.

    Args
    ----
        response: str
            The completion response as a JSON string.
        model: type[T]
            The pydantic base model type to structure the response into.

    Returns
    -------
        The structured response as a pydantic base model.
    """
    parsed_dict: dict[str, Any] = json.loads(response)
    return model(**parsed_dict)

```

### Core Architecture Module: `packages/graphrag/graphrag/index/operations/extract_graph/utils.py`
```
# Copyright (C) 2026 Microsoft Corporation.
# Licensed under the MIT License

"""Utility functions for graph extraction operations."""

import logging

import pandas as pd

logger = logging.getLogger(__name__)


def filter_orphan_relationships(
    relationships: pd.DataFrame,
    entities: pd.DataFrame,
) -> pd.DataFrame:
    """Remove relationships whose source or target has no entity entry.

    After LLM graph extraction, the model may hallucinate entity
    names in relationships that have no corresponding entity row.
    This function drops those dangling references so downstream
    processing never encounters broken graph edges.

    Parameters
    ----------
    relationships:
        Merged relationship DataFrame with at least ``source``
        and ``target`` columns.
    entities:
        Merged entity DataFrame with at least a ``title`` column.

    Returns
    -------
    pd.DataFrame
        Relationships filtered to only those whose ``source``
        and ``target`` both appear in ``entities["title"]``.
    """
    if relationships.empty or entities.empty:
        return relationships.iloc[0:0].reset_index(drop=True)

    entity_titles = set(entities["title"])
    before_count = len(relationships)
    mask = relationships["source"].isin(entity_titles) & relationships["target"].isin(
        entity_titles
    )
    filtered = relationships[mask].reset_index(drop=True)
    dropped = before_count - len(filtered)
    if dropped > 0:
        logger.warning(
            "Dropped %d relationship(s) referencing non-existent entities.",
            dropped,
        )
    return filtered

```

### Core Architecture Module: `packages/graphrag/graphrag/index/operations/summarize_communities/utils.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""A module containing community report generation utilities."""

import pandas as pd

import graphrag.data_model.schemas as schemas


def get_levels(
    df: pd.DataFrame, level_column: str = schemas.COMMUNITY_LEVEL
) -> list[int]:
    """Get the levels of the communities."""
    levels = df[level_column].dropna().unique()
    levels = [int(lvl) for lvl in levels if lvl != -1]
    return sorted(levels, reverse=True)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2419** (2026-07-01): **[Bug]: <title>使用阿里云的text-embeding-v4嵌入向量模型**
  *Symptoms*: ### Do you need to file an issue?  - [ ] I have searched the existing issues and this bug is not already filed. - [x] My model is hosted on OpenAI or Azure. If not, please look at the "model providers" issue and don't file a new one here. - [ ] I believe this is a legitimate bug, not just a question. If this is a question, please use the Discussions area.  ### Describe the bug  使用的是同一个text-embeding-v4嵌入向量模型，调用local_search方法时，报如下错误RuntimeError: lance error: Invalid user input: query dim(1024) doesn't match the column vector vector dim(3072)  ### Steps to reproduce  _No response_  ### Expected Behavior  _No response_  ### GraphRAG Config Used  ```yaml # Paste your config here  ```   ### Logs and screenshots  _No response_  ### Additional Information  - GraphRAG Version: - Operating System: - Python Version: - Related Issues: 

- **Issue #2356** (2026-07-08): **[Bug]: <title> ImportError in v3.0.9 - cannot import name 'ModelType' from 'graphrag.config.enums'**
  *Symptoms*: ### Do you need to file an issue?  - [x] I have searched the existing issues and this bug is not already filed. - [x] My model is hosted on OpenAI or Azure. If not, please look at the "model providers" issue and don't file a new one here. - [x] I believe this is a legitimate bug, not just a question. If this is a question, please use the Discussions area.  ### Describe the bug  After upgrading to graphrag==3.0.9 via pip, I found that the example code provided in the official documentation/notebooks fails to import. It seems the module structure has changed in the latest release (possibly due to the Monorepo refactoring), but the documentation hasn't been updated yet.  ### Steps to reproduce  1.Install graphrag v3.0.9: pip install graphrag==3.0.9  2.Run: from graphrag.config.enums import ModelType，from graphrag.config.models.language_model_config import LanguageModelConfig，from graphrag.language_model.manager import ModelManager  3.See error: ImportError: cannot import name 'ModelType' from 'graphrag.config.enums'，ModuleNotFoundError: No module named 'graphrag.language_model'  ### Expected Behavior  The import should work as described in the documentation, or the documentation should reflect the new import path.  ### GraphRAG Config Used  ```yaml # Paste your config here ### This config file contains required core defaults that must be set, along with a handful of common optional settings. ### For a full list of available settings, see https://microsoft.github.io/graphrag/conf

- **Issue #2301** (2026-07-20): **[Bug]: Example notebooks code is incorrect (not updated)**
  *Symptoms*: ### Do you need to file an issue?  - [x] I have searched the existing issues and this bug is not already filed. - [x] My model is hosted on OpenAI or Azure. If not, please look at the "model providers" issue and don't file a new one here. - [x] I believe this is a legitimate bug, not just a question. If this is a question, please use the Discussions area.  ### Describe the bug  The example notebooks included in the github repo, for example: #docs/examples_notebooks/local_search.ipynb [https://microsoft.github.io/graphrag/examples_notebooks/local_search/] seem to use incorrect, not existing classes. I guess there were some major changes to the project structure, yet those examples are not updated. The errors include: `ImportError: cannot import name 'ModelType' from 'graphrag.config.enums'` `NameError: name 'LanceDBVectorStore' is not defined` `NameError: name 'description_embedding_store' is not defined`  It would be great to have working examples, especially for beginers.  ### Steps to reproduce  _No response_  ### Expected Behavior  _No response_  ### GraphRAG Config Used  ```yaml # Paste your config here  ```   ### Logs and screenshots  _No response_  ### Additional Information  - GraphRAG Version: - Operating System: - Python Version: - Related Issues: 
  **Post-Mortem & Fix Analysis**:
  > import os import pandas as pd import ticker from graphrag.vector_stores.lancedb import LanceDBVectorStore from graphrag.config.models.graph_rag_config import ModelType from graphrag.query.llm.text_utils import Tag  # 1. Fix: Corrected import path for ModelType # Previous: from graphrag.config.enums import ModelType  # 2. Fix: Initialize the missing embedding store variables # This prevents the "NameError: name 'description_embedding_store' is not defined" description_embedding_store = LanceDBVectorStore(     collection_name="description_embeddings" ) description_embedding_store.connect(db_uri="./lancedb")  # 3. Fix: Ensure the environment is ready for the GraphRAG pipeline INPUT_DIR = "./inputs" if not os.path.exists(INPUT_DIR):     os.makedirs(INPUT_DIR)  print("Imports and stores successfully initialized.")
  > I'm working on a fix for the example query notebooks. The current `local_search` notebook still imports `ModelType`, `LanguageModelConfig`, and `ModelManager`, which no longer line up with the current package layout on `main`.  I'm preparing a small update that switches the search notebooks over to the current model factory entry points so the examples match the code that ships today.

- **Issue #2286** (2026-04-07): **[Bug]: openai.BadRequestError: We could not parse the JSON body of your request**
  *Symptoms*: ### Do you need to file an issue?  - [x] I have searched the existing issues and this bug is not already filed. - [x] My model is hosted on OpenAI or Azure. If not, please look at the "model providers" issue and don't file a new one here. - [x] I believe this is a legitimate bug, not just a question. If this is a question, please use the Discussions area.  ### Describe the bug  When indexing, i get the following error message:    ``` 2026-03-21 06:03:32.0180 - INFO - graphrag.logger.progress - Summarize entity/relationship description progress: 71525/106718 2026-03-21 06:03:32.0180 - INFO - graphrag.logger.progress - Summarize entity/relationship description progress: 71526/106718 2026-03-21 06:03:32.0180 - INFO - graphrag.logger.progress - Summarize entity/relationship description progress: 71527/106718 2026-03-21 06:03:32.0180 - INFO - graphrag.logger.progress - Summarize entity/relationship description progress: 71528/106718 2026-03-21 06:03:32.0180 - INFO - graphrag.logger.progress - Summarize entity/relationship description progress: 71529/106718 2026-03-21 06:03:32.0180 - INFO - graphrag.logger.progress - Summarize entity/relationship description progress: 71530/106718 2026-03-21 06:03:32.0181 - INFO - graphrag.logger.progress - Summarize entity/relationship description progress: 71531/106718 2026-03-21 06:03:32.0181 - INFO - graphrag.logger.progress - Summarize entity/relationship description progress: 71532/106718 2026-03-21 06:03:32.0181 - INFO - graphrag.logger.prog
  **Post-Mortem & Fix Analysis**:
  > Using only 100 of the 400 documents, i get:   ``` (bookmarkRag) dobin@paddy:~/repos/bookmarkRag$ graphrag index Starting pipeline with workflows: load_input_documents, create_base_text_units, create_final_documents, extract_graph, finalize_graph, extract_covariates, create_communities, create_final_text_units, create_community_reports, generate_text_embeddings Starting workflow: load_input_documents  Workflow complete: load_input_documents Starting workflow: create_base_text_units   100 / 100 ........................................................................................ Workflow complete: create_base_text_units Starting workflow: create_final_documents  Workflow complete: create_final_documents Starting workflow: extract_graph /home/dobin/repos/bookmarkRag/.venv/lib/python3.12/site-packages/graphrag/index/operations/extract_graph/extract_graph.py:119: FutureWarning: The behavior of DataFrame concatenation with empty or all-NA entries is deprecated. In a future version, this w
  > I set to large embedding model, which allowed the initial index with a few documents:   ```     model: text-embedding-3-large ```  Adding more results in:  ``` (bookmarkRag) dobin@paddy:~/repos/bookmarkRag$ graphrag update Starting pipeline with workflows: load_update_documents, create_base_text_units, create_final_documents, extract_graph, finalize_graph, extract_covariates, create_communities, create_final_text_units, create_community_reports, generate_text_embeddings, update_final_documents, update_entities_relationships, update_text_units, update_covariates, update_communities, update_community_reports, update_text_embeddings, update_clean_state Starting workflow: load_update_documents  Workflow complete: load_update_documents Starting workflow: create_base_text_units   100 / 100 ........................................................................................ Workflow complete: create_base_text_units Starting workflow: create_final_documents  Workflow complete: create_final
  > Recently, I have also been assigned to investigate this issue graphrag==1.2.0   LLMmodel:gpt-4o-mini  It looks like a problem with OPENAI 

- **Issue #2285** (2026-03-20): **[Bug]: _csv.Error: need to escape, but no escapechar set**
  *Symptoms*: ### Do you need to file an issue?  - [x] I have searched the existing issues and this bug is not already filed. - [x] My model is hosted on OpenAI or Azure. If not, please look at the "model providers" issue and don't file a new one here. - [x] I believe this is a legitimate bug, not just a question. If this is a question, please use the Discussions area.  ### Describe the bug  I wrote a little wrapper for graphrag. When i do a local search, it works well. But when i do a global search, i get the following error: ``` (.venv) dobin@paddy:~/repos/quickRag$ python3 quickrag.py query --method global --query "Show me  a list of modern stealthy shellcode loaders"  Traceback (most recent call last):   File "/home/dobin/repos/quickRag/quickrag.py", line 167, in <module>     main()   File "/home/dobin/repos/quickRag/quickrag.py", line 157, in main     result = do_query(   File "/home/dobin/repos/quickRag/quickrag.py", line 85, in do_query     run_global_search(   File "/home/dobin/repos/quickRag/.venv/lib/python3.10/site-packages/graphrag/cli/query.py", line 118, in run_global_search     response, context_data = asyncio.run(   File "/usr/lib/python3.10/asyncio/runners.py", line 44, in run     return loop.run_until_complete(main)   File "/usr/lib/python3.10/asyncio/base_events.py", line 649, in run_until_complete     return future.result()   File "/home/dobin/repos/quickRag/.venv/lib/python3.10/site-packages/pydantic/_internal/_validate_call.py", line 34, in wrapper_function     return
  **Post-Mortem & Fix Analysis**:
  > I see i have an old version. Will try with new one. 
  > I had python 3.10 installed, and didnt get the newest graphrag version. closing for now. 

- **Issue #2265** (2026-07-16): **[Bug]: Pipeline error: Column 1 named vector expected length 44 but got length 11**
  *Symptoms*: ### Do you need to file an issue?  - [ ] I have searched the existing issues and this bug is not already filed. - [ ] My model is hosted on OpenAI or Azure. If not, please look at the "model providers" issue and don't file a new one here. - [ ] I believe this is a legitimate bug, not just a question. If this is a question, please use the Discussions area.  ### Describe the bug  Starting workflow: generate_text_embeddings [2026-03-04T04:22:36Z WARN  lance::dataset::write::insert] No existing dataset at /home/ms_graphrag/secreq_ai_sample/output/lancedb/entity_description.lance, it will be created Pipeline error: Column 1 named vector expected length 44 but got length 11.......................... Pipeline complete   ### Steps to reproduce  The embedded model uses nomic-embed-text-v2-moe deployed locally via lmstudio.  ### Expected Behavior  _No response_  ### GraphRAG Config Used  ```yaml # Paste your config here embedding_models:   default_embedding_model:     model_provider: openai     auth_method: api_key     api_key: "lmstudio" #${GRAPHRAG_API_KEY}     model: nomic-embed-text-v2-moe     api_base: http://localhost:1234/v1     retry:       type: exponential_backoff  vector_store:   type: lancedb   db_uri: output/lancedb   community_full_content:     vector_size: 768   entity_description:     vector_size: 768   text_unit_text:     vector_size: 768 ```   ### Logs and screenshots  [7 rows x 15 columns] 2026-03-04 12:09:55.0252 - INFO - graphrag.index.workflows.generate_text_embed
  **Post-Mortem & Fix Analysis**:
  > Hey, I ran into this too and think I can put together a fix. Taking a crack at it.
  > Put up a fix here: https://github.com/microsoft/graphrag/pull/2268 -- let me know if anything needs adjusting.
  > I also see this in #2286. Would like to see a fix. 

- **Issue #2263** (2026-04-07): **[Bug]: `model_supports_json` is no longer supported on v3, breaking custom model setups**
  *Symptoms*: ### Do you need to file an issue?  - [x] I have searched the existing issues and this bug is not already filed. - [ ] My model is hosted on OpenAI or Azure. If not, please look at the "model providers" issue and don't file a new one here. - [x] I believe this is a legitimate bug, not just a question. If this is a question, please use the Discussions area.  ### Describe the bug  Most models do not support structured output. In this case the LLM caller (liteLLM) usually falls back to a tool call. However, a tool call will cause response content to be empty, which then the LLM caller tries to parse, and fail.  In v2 there is a `model_supports_json` param, which can be disabled to not use structured output in the LLM calls, to avoid this issue. In v3 this setting is gone, and so every model that doesn't support structured output will fail to work.  ### Steps to reproduce  _No response_  ### Expected Behavior  _No response_  ### GraphRAG Config Used  ```yaml # Paste your config here  ```   ### Logs and screenshots  _No response_  ### Additional Information  - GraphRAG Version: 3.0.5 
  **Post-Mortem & Fix Analysis**:
  > The removal of `model_supports_json` in v3 means the LLM caller always attempts structured output, and when the model falls back to a tool call the response content comes back empty, causing the parse failure. I can restore this as a config option in the chat LLM integration so it skips structured output when disabled, similar to how v2 handled it. I'll dig into the LLM caller to make sure the tool call response path also gets handled gracefully when structured output isn't available.
  > Stepping back from this one — the fix was more involved than expected and I ran out of time. Free for anyone else.
  > Hi @Voileexperiments. We added client side json validation support according to LiteLLM documentation (https://docs.litellm.ai/docs/completion/json_mode#validate-json-schema) in PR #2306 but have not been able to fully test as all of our test models support structured responses. Can you provide more details on how to replicate? Which models are you using? Can you provide the configuration file?

- **Issue #2254** (2026-07-10): **[Bug]: An error occurred when embedding vectors using nomic-embed-text deployed locally by ollama.**
  *Symptoms*: ### Do you need to file an issue?  - [x] I have searched the existing issues and this bug is not already filed. - [ ] My model is hosted on OpenAI or Azure. If not, please look at the "model providers" issue and don't file a new one here. - [ ] I believe this is a legitimate bug, not just a question. If this is a question, please use the Discussions area.  ### Describe the bug  $ graphrag index --dry-run --verbose --- Logging error --- Traceback (most recent call last):   File "D:\Program Files\Python311\Lib\logging\__init__.py", line 1110, in emit     msg = self.format(record)           ^^^^^^^^^^^^^^^^^^^   File "D:\Program Files\Python311\Lib\logging\__init__.py", line 953, in format     return fmt.format(record)            ^^^^^^^^^^^^^^^^^^   File "D:\Program Files\Python311\Lib\logging\__init__.py", line 687, in format     record.message = record.getMessage()                      ^^^^^^^^^^^^^^^^^^^   File "D:\Program Files\Python311\Lib\logging\__init__.py", line 377, in getMessage     msg = msg % self.args           ~~~~^~~~~~~~~~~ TypeError: not all arguments converted during string formatting Call stack:   File "<frozen runpy>", line 198, in _run_module_as_main   File "<frozen runpy>", line 88, in _run_code   File "D:\Program Files\Python311\Scripts\graphrag.exe\__main__.py", line 5, in <module>     sys.exit(app())   File "D:\Program Files\Python311\Lib\site-packages\typer\main.py", line 319, in __call__     return get_command(self)(*args, **kwargs)   File "D:\Progr
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this. Removed the extraneous `True` argument from `logger.info()` that was being interpreted as a format string argument.  PR: #2257
  > This caught my eye. I think I see what's going on here, let me put together a fix. I'll include a test to prevent regression.
  > Here's my fix: https://github.com/microsoft/graphrag/pull/2271 -- happy to iterate on feedback.

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

### Incident Patch 1: `7bb23cc7` (2026-08-19)
**Commit Message**: Fix update-deps skill to work with msft feed. (#2510)

**File**: `.agents/skills/update-deps/SKILL.md` (modified, +20/-1)
```diff
@@ -21,6 +21,19 @@ Raise dependency versions across this uv workspace, re-lock, and fix any code or
 fallout until `uv run poe check` and `uv run poe test_unit` are both green — without
 touching the version machinery that the release process owns.
 
+## Hard rules (non-negotiable)
+
+1. **Only the Microsoft feed proxy.** All resolves and syncs MUST use
+   `https://packagefeedproxy.microsoft.io/pypi/simple` (the `[[tool.uv.index]]` configured in
+   the root `pyproject.toml`). Never resolve against public PyPI, never add
+   `--index`/`--default-index`/`--index-url` overrides, and never set `UV_INDEX_URL` or
+   `PIP_INDEX_URL` to pypi.org. Do not disable or reorder the configured index.
+2. **Target versions must be at least 7 days old.** Only bump to a version that was released
+   more than 7 days ago. The proxy does not serve versions published within the last week —
+   syncing to a too-new version WILL fail. Before pinning a specific version, verify its
+   release date and pick the newest release older than 7 days; otherwise let the specifier
+   float and let `uv lock` choose (it can only see eligible versions on the proxy anyway).
+
 ## Layout facts
 
 - This is a **uv workspace monorepo**. The root [`pyproject.toml`](../../../pyproject.toml)
@@ -57,12 +70,15 @@ touching the version machinery that the release process owns.
    (`packages/*/pyproject.toml`) and the root `dev` group. Leave the release-owned lines
    above untouched.
 
-3. **Resolve and lock.**
+3. **Resolve and lock.** All of these use the configured Microsoft feed proxy — do not pass
+   any index override (see Hard rules).
    - For a full "get latest allowed" pass: `uv lock --upgrade`.
    - For targeted bumps after editing specifiers: `uv lock`.
    - Then install: `uv sync --all-packages`.
      If resolution fails, read the conflict, relax/adjust the offending specifier, and re-lock.
      Do not delete `uv.lock` to force it.
+   - If a sync fails to find a version you just pinned, it is almost certainly younger than 7
+     days on the proxy — step down to the newest release older than one week.
 
 4. **Static checks.** Run `uv run poe check` (this is `ruff format --check` + `ruff check` +
    `pyright`). Apply safe autofixes with `uv run poe fix`; format with `uv run poe format`.
@@ -108,6 +124,9 @@ verified, repo-specific fix patterns before improvising.
 
 ## Completion checklist
 
+- [ ] All resolves/syncs used the `packagefeedproxy.microsoft.io` index; no public-PyPI or
+      index-override was introduced.
+- [ ] No dependency was bumped to a version released within the last 7 days.
 - [ ] Only intended specifiers changed; no `graphrag-*==` pin or `version` field edited.
 - [ ] `uv.lock` regenerated via `uv lock`/`uv lock --upgrade` (not hand-edited or deleted).
 - [ ] `uv run poe check` passes (ruff format, ruff lint, pyright).
```

---

### Incident Patch 2: `e810e63a` (2026-08-13)
**Commit Message**: Fix/cache event loop lifecycle (#2484)

fix(llm): preserve event loop in sync cache

Co-authored-by: FU-max-boop <[REDACTED_EMAIL]>

**File**: `.semversioner/next-release/patch-20260811050438120824.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "type": "patch",
+  "description": "Preserve caller event loops in synchronous LLM cache middleware."
+}
```

**File**: `packages/graphrag-llm/graphrag_llm/middleware/with_cache.py` (modified, +36/-35)
```diff
@@ -67,41 +67,42 @@ def _cache_middleware(
         cache_key = cache_key_creator(kwargs)
 
         event_loop = asyncio.new_event_loop()
-        asyncio.set_event_loop(event_loop)
-        cached_response = event_loop.run_until_complete(cache.get(cache_key))
-        if (
-            cached_response is not None
-            and isinstance(cached_response, dict)
-            and "response" in cached_response
-            and cached_response["response"] is not None
-            and isinstance(cached_response["response"], dict)
-        ):
-            try:
-                if (
-                    metrics is not None
-                    and "metrics" in cached_response
-                    and cached_response["metrics"] is not None
-                    and isinstance(cached_response["metrics"], dict)
-                ):
-                    metrics.update(cached_response["metrics"])
-                    metrics["cached_responses"] = 1
-
-                if request_type == "chat":
-                    return LLMCompletionResponse(**cached_response["response"])
-                return LLMEmbeddingResponse(**cached_response["response"])
-            except Exception:  # noqa: BLE001
-                # Try to retrieve value from cache but if it fails, continue
-                # to make the request.
-                ...
-
-        response = sync_middleware(**kwargs)
-        cache_value = {
-            "response": response.model_dump(),  # type: ignore
-            "metrics": metrics if metrics is not None else {},
-        }
-        event_loop.run_until_complete(cache.set(cache_key, cache_value))
-        event_loop.close()
-        return response
+        try:
+            cached_response = event_loop.run_until_complete(cache.get(cache_key))
+            if (
+                cached_response is not None
+                and isinstance(cached_response, dict)
+                and "response" in cached_response
+                and cached_response["response"] is not None
+                and isinstance(cached_response["response"], dict)
+            ):
+                try:
+                    if (
+                        metrics is not None
+                        and "metrics" in cached_response
+                        and cached_response["metrics"] is not None
+                        and isinstance(cached_response["metrics"], dict)
+                    ):
+                        metrics.update(cached_response["metrics"])
+                        metrics["cached_responses"] = 1
+
+                    if request_type == "chat":
+                        return LLMCompletionResponse(**cached_response["response"])
+                    return LLMEmbeddingResponse(**cached_response["response"])
+                except Exception:  # noqa: BLE001
+                    # Try to retrieve value from cache but if it fails, continue
+                    # to make the request.
+                    ...
+
+            response = sync_middleware(**kwargs)
+            cache_value = {
+                "response": response.model_dump(),  # type: ignore
+                "metrics": metrics if metrics is not None else {},
+            }
+            event_loop.run_until_complete(cache.set(cache_key, cache_value))
+            return response
+        finally:
+            event_loop.close()
 
     async def _cache_middleware_async(
         **kwargs: Any,
```

**File**: `tests/unit/language_model/__init__.py` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+# Copyright (c) 2024 Microsoft Corporation.
+# Licensed under the MIT License
```

**File**: `tests/unit/language_model/test_cache_middleware.py` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+# Copyright (c) 2024 Microsoft Corporation.
+# Licensed under the MIT License
+
+"""Unit tests for the LLM cache middleware."""
+
+import asyncio
+from collections.abc import Callable
+from typing import Any
+
+import pytest
+from graphrag_cache.memory_cache import MemoryCache
+from graphrag_llm.middleware.with_cache import with_cache
+from graphrag_llm.types import LLMCompletionResponse
+from graphrag_llm.utils import create_completion_response
+
+
+@pytest.fixture
+def tracked_event_loops(monkeypatch: pytest.MonkeyPatch):
+    """Install a caller-owned loop and track loops created by the middleware."""
+    original_loop = asyncio.new_event_loop()
+    create_event_loop = asyncio.new_event_loop
+    created_loops: list[asyncio.AbstractEventLoop] = []
+
+    def _create_event_loop() -> asyncio.AbstractEventLoop:
+        event_loop = create_event_loop()
+        created_loops.append(event_loop)
+        return event_loop
+
+    asyncio.set_event_loop(original_loop)
+    monkeypatch.setattr(asyncio, "new_event_loop", _create_event_loop)
+
+    yield original_loop, created_loops
+
+    asyncio.set_event_loop(None)
+    original_loop.close()
+    for event_loop in created_loops:
+        if not event_loop.is_closed():
+            event_loop.close()
+
+
+def _with_sync_cache(
+    cache: MemoryCache,
+    sync_middleware: Callable[..., LLMCompletionResponse],
+):
+    async def _async_middleware(**kwargs: Any) -> LLMCompletionResponse:
+        return await asyncio.to_thread(sync_middleware, **kwargs)
+
+    def _cache_key(input_args: dict[str, Any]) -> str:
+        return "cache-key"
+
+    cached_middleware, _ = with_cache(
+        sync_middleware=sync_middleware,
+        async_middleware=_async_middleware,
+        request_type="chat",
+        cache=cache,
+        cache_key_creator=_cache_key,
+    )
+    return cached_middleware
+
+
+def test_sync_cache_preserves_event_loop_on_miss(tracked_event_loops) -> None:
+    """The sync cache should not replace the caller's loop on a cache miss."""
+    original_loop, created_loops = tracked_event_loops
+    response = create_completion_response("uncached")
+    cached_middleware = _with_sync_cache(MemoryCache(), lambda **_: response)
+
+    cached_response = cached_middleware(messages=[])
+
+    assert isinstance(cached_response, LLMCompletionResponse)
+    assert cached_response.content == "uncached"
+    assert asyncio.get_event_loop() is original_loop
+    assert len(created_loops) == 1
+    assert created_loops[0].is_closed()
+
+
+def test_sync_cache_preserves_event_loop_on_hit(tracked_event_loops) -> None:
+    """The sync cache should close its loop before returning a cached response."""
+    original_loop, created_loops = tracked_event_loops
+    response = create_completion_response("cached")
+    cache = MemoryCache()
+    asyncio.run(
+        cache.set(
+            "cache-key",
+            {"response": response.model_dump(), "metrics": {}},
+        )
+    )
+    asyncio.set_event_loop(original_loop)
+
+    def _unexpected_request(**_: Any) -> LLMCompletionResponse:
+        pytest.fail("The wrapped middleware should not run on a cache hit.")
+
+    cached_middleware = _with_sync_cache(cache, _unexpected_request)
+
+    cached_response = cached_middleware(messages=[])
+
+    assert isinstance(cached_response, LLMCompletionResponse)
+    assert cached_response.content == "cached"
+    assert asyncio.get_event_loop() is original_loop
+    assert len(created_loops) == 1
+    assert created_loops[0].is_closed()
+
+
+def test_sync_cache_closes_event_loop_on_error(tracked_event_loops) -> None:
+    """The sync cache should close its loop when the wrapped middleware fails."""
+    original_loop, created_loops = tracked_event_loops
+
+    def _raise_error(**_: Any) -> LLMCompletionResponse:
+        msg = "request failed"
+        raise RuntimeError(msg)
+
+    cached_middleware = _with_sync_cache(MemoryCache(), _raise_error)
+
+    with pytest.raises(RuntimeError, match="request failed"):
+        cached_middleware(messages=[])
+
+    assert asyncio.get_event_loop() is original_loop
+    assert len(created_loops) == 1
+    assert created_loops[0].is_closed()
```

---

### Incident Patch 3: `0bb28657` (2026-07-17)
**Commit Message**: Fix JSONL loader handling of blank/invalid lines (#2434)

* Fix JSONL loader for blank and invalid rows

* Sync docs for schema and metadata fields

* Revert "Sync docs for schema and metadata fields"

This reverts commit 55f170f7d25f58ba4494f2dee8c5690fd282c778.

**File**: `.semversioner/next-release/patch-20260710221345787890.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "type": "patch",
+  "description": "Fix JSONL input loader to skip blank lines and ignore invalid JSON rows"
+}
```

**File**: `packages/graphrag-input/graphrag_input/jsonl.py` (modified, +24/-1)
```diff
@@ -34,5 +34,28 @@ async def read_file(self, path: str) -> list[TextDocument]:
             - output - list with a TextDocument for each row in the file.
         """
         text = await self._storage.get(path, encoding=self._encoding)
-        rows = [json.loads(line) for line in text.splitlines()]
+        rows: list[dict] = []
+        for line_number, line in enumerate(text.splitlines(), start=1):
+            if not line.strip():
+                continue
+
+            try:
+                parsed_row = json.loads(line)
+            except json.JSONDecodeError:
+                logger.warning(
+                    "Skipping malformed JSONL row in %s at line %s",
+                    path,
+                    line_number,
+                )
+                continue
+
+            if isinstance(parsed_row, dict):
+                rows.append(parsed_row)
+            else:
+                logger.warning(
+                    "Skipping non-object JSONL row in %s at line %s",
+                    path,
+                    line_number,
+                )
+
         return await self.process_data_columns(rows, path)
```

**File**: `tests/unit/indexing/input/data/jsonl-with-invalid-and-blank-lines/input.jsonl` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+{ "title": "Hello", "text": "Hi how are you today?"}
+
+not json
+{ "title": "Goodbye", "text": "I'm outta here"}
+   
+["not", "an", "object"]
+{ "title": "Adios", "text": "See you later"}
```

**File**: `tests/unit/indexing/input/test_jsonl_loader.py` (modified, +17/-0)
```diff
@@ -40,3 +40,20 @@ async def test_jsonl_loader_one_file_with_title():
     documents = await reader.read_files()
     assert len(documents) == 3
     assert documents[0].title == "Hello"
+
+
+async def test_jsonl_loader_skips_blank_and_invalid_rows():
+    config = InputConfig(
+        type=InputType.JsonLines,
+        title_column="title",
+    )
+    storage = create_storage(
+        StorageConfig(
+            base_dir="tests/unit/indexing/input/data/jsonl-with-invalid-and-blank-lines",
+        )
+    )
+    reader = create_input_reader(config, storage)
+    documents = await reader.read_files()
+
+    assert len(documents) == 3
+    assert [document.title for document in documents] == ["Hello", "Goodbye", "Adios"]
```

---

### Incident Patch 4: `f5af4d25` (2026-07-17)
**Commit Message**: Fix cannot release un-acquired lock in Blob logger (#2457)

* fix issue-2170

* semversioner change

* test changes

* Potential fix for pull request finding

Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

* fix syntax mismatch

---------

Co-authored-by: Gaudy Blanco <[REDACTED_EMAIL]>
Co-authored-by: Copilot Autofix powered by AI <[REDACTED_EMAIL]>

**File**: `.semversioner/next-release/patch-20260717165805703786.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "type": "patch",
+  "description": "Fix 2170 - cannot release un-acquired lock in Blob logger"
+}
```

**File**: `packages/graphrag/graphrag/logger/blob_workflow_logger.py` (modified, +20/-20)
```diff
@@ -6,7 +6,6 @@
 import json
 import logging
 from datetime import datetime, timezone
-from pathlib import Path
 from typing import Any
 
 from azure.identity import DefaultAzureCredential
@@ -41,6 +40,7 @@ def __init__(
 
         self._connection_string = connection_string
         self.account_url = account_url
+        self._base_dir = base_dir
 
         if self._connection_string:
             self._blob_service_client = BlobServiceClient.from_connection_string(
@@ -56,18 +56,8 @@ def __init__(
                 credential=DefaultAzureCredential(),
             )
 
-        if blob_name == "":
-            blob_name = f"report/{datetime.now(tz=timezone.utc).strftime('%Y-%m-%d-%H:%M:%S:%f')}.logs.json"
-
-        self._blob_name = str(Path(base_dir or "") / blob_name)
         self._container_name = container_name
-        self._blob_client = self._blob_service_client.get_blob_client(
-            self._container_name, self._blob_name
-        )
-        if not self._blob_client.exists():
-            self._blob_client.create_append_blob()
-
-        self._num_blocks = 0  # refresh block counter
+        self._rotate_blob(blob_name or None)
 
     def emit(self, record) -> None:
         """Emit a log record to blob storage."""
@@ -98,17 +88,27 @@ def _get_log_type(self, level: int) -> str:
             return "warning"
         return "log"
 
+    def _rotate_blob(self, blob_name: str | None = None):
+        """Create a new blob file when the current one reaches max block count."""
+        if not blob_name:
+            blob_name = f"report/{datetime.now(tz=timezone.utc).strftime('%Y-%m-%d-%H:%M:%S:%f')}.logs.json"
+        blob_path = blob_name.lstrip("/")
+        if self._base_dir:
+            blob_path = f"{self._base_dir.strip('/')}/{blob_path}"
+        self._blob_name = blob_path
+        self._blob_client = self._blob_service_client.get_blob_client(
+            self._container_name, self._blob_name
+        )
+        if not self._blob_client.exists():
+            self._blob_client.create_append_blob()
+        self._num_blocks = 0
+
     def _write_log(self, log: dict[str, Any]):
         """Write log data to blob storage."""
         # create a new file when block count hits close 25k
-        if (
-            self._num_blocks >= self._max_block_count
-        ):  # Check if block count exceeds 25k
-            self.__init__(
-                self._connection_string,
-                self._container_name,
-                account_url=self.account_url,
-            )
+
+        if self._num_blocks >= self._max_block_count:
+            self._rotate_blob()
 
         blob_client = self._blob_service_client.get_blob_client(
             self._container_name, self._blob_name
```

**File**: `tests/unit/logger/__init__.py` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+# Copyright (c) 2024 Microsoft Corporation.
+# Licensed under the MIT License
```

**File**: `tests/unit/logger/test_blob_workflow_logger.py` (added, +163/-0)
```diff
@@ -0,0 +1,163 @@
+# Copyright (c) 2024 Microsoft Corporation.
+# Licensed under the MIT License
+
+"""Unit tests for the BlobWorkflowLogger."""
+
+import json
+from unittest.mock import MagicMock, patch
+
+import pytest
+from graphrag.logger.blob_workflow_logger import BlobWorkflowLogger
+
+
+@pytest.fixture
+def mock_blob_service():
+    """Create a mock BlobServiceClient and related objects."""
+    with patch(
+        "graphrag.logger.blob_workflow_logger.BlobServiceClient"
+    ) as mock_bsc_cls:
+        mock_blob_client = MagicMock()
+        mock_blob_client.exists.return_value = False
+
+        mock_bsc = MagicMock()
+        mock_bsc.get_blob_client.return_value = mock_blob_client
+
+        mock_bsc_cls.return_value = mock_bsc
+
+        yield mock_bsc, mock_blob_client
+
+
+@pytest.fixture
+def mock_credential():
+    """Mock DefaultAzureCredential."""
+    with patch(
+        "graphrag.logger.blob_workflow_logger.DefaultAzureCredential"
+    ) as mock_cred:
+        yield mock_cred
+
+
+def _make_logger() -> BlobWorkflowLogger:
+    return BlobWorkflowLogger(
+        connection_string=None,
+        container_name="test-container",
+        blob_name="test.logs.json",
+        base_dir="logs",
+        account_url="https://test.blob.core.windows.net",
+    )
+
+
+def test_init_requires_container_name(mock_credential):
+    """Test that a missing container name raises a ValueError."""
+    with pytest.raises(ValueError, match="No container name provided"):
+        BlobWorkflowLogger(
+            connection_string=None,
+            container_name=None,
+            account_url="https://test.blob.core.windows.net",
+        )
+
+
+def test_init_requires_connection_or_account_url():
+    """Test that missing both connection string and account url raises."""
+    with pytest.raises(ValueError, match="No storage account blob url provided"):
+        BlobWorkflowLogger(
+            connection_string=None,
+            container_name="test-container",
+        )
+
+
+def test_init_creates_append_blob(mock_blob_service, mock_credential):
+    """Test that a new append blob is created on initialization."""
+    _mock_bsc, mock_blob_client = mock_blob_service
+
+    logger = _make_logger()
+
+    mock_blob_client.create_append_blob.assert_called_once()
+    assert logger._num_blocks == 0  # noqa: SLF001
+    assert logger._base_dir == "logs"  # noqa: SLF001
+
+
+def test_init_uses_provided_blob_name(mock_blob_service, mock_credential):
+    """Test that the provided blob name is honored and nested under base_dir."""
+    logger = _make_logger()
+
+    assert logger._blob_name == "logs/test.logs.json"  # noqa: SLF001
+
+
+def test_rotate_blob_does_not_reinitialize_handler(mock_blob_service, mock_credential):
+    """Test that blob rotation does not call __init__ on the handler.
+
+    This verifies the fix for issue #2170 where calling self.__init__()
+    during rotation caused 'cannot release un-acquired lock' errors.
+    """
+    mock_bsc, _mock_blob_client = mock_blob_service
+
+    logger = _make_logger()
+
+    # Simulate reaching max block count
+    logger._num_blocks = logger._max_block_count  # noqa: SLF001
+
+    # Store reference to the original lock to verify it's not replaced
+    original_lock = logger.lock
+
+    # Write a log entry, which should trigger rotation
+    logger._write_log({"type": "log", "data": "test message"})  # noqa: SLF001
+
+    # Verify the lock was NOT replaced (i.e., __init__ was not called)
+    assert logger.lock is original_lock
+
+    # Verify block counter was reset (rotation happened)
+    # After rotation (reset to 0) + 1 write = 1
+    assert logger._num_blocks == 1  # noqa: SLF001
+
+    # Verify a new blob client was created during rotation
+    assert mock_bsc.get_blob_client.call_count > 1
+
+
+def test_rotate_blob_creates_new_blob_name(mock_blob_service, mock_credential):
+    """Test that rotation generates a new blob name."""
+    _mock_bsc, _mock_blob_client = mock_blob_service
+
+    logger = _make_logger()
+
+    original_blob_name = logger._blob_name  # noqa: SLF001
+
+    # Trigger rotation
+    logger._rotate_blob()  # noqa: SLF001
+
+    # New blob name should be different (auto-generated with timestamp)
+    assert logger._blob_name != original_blob_name  # noqa: SLF001
+    assert logger._num_blocks == 0  # noqa: SLF001
+
+
+def test_write_log_appends_block(mock_blob_service, mock_credential):
+    """Test that writing a log appends an encoded block and increments count."""
+    _mock_bsc, mock_blob_client = mock_blob_service
+
+    logger = _make_logger()
+
+    logger._write_log({"type": "log", "data": "hello"})  # noqa: SLF001
+
+    mock_blob_client.append_block.assert_called_once()
+    (payload,), _kwargs = mock_blob_client.append_block.call_args
+    decoded = json.loads(payload.decode("utf-8"))
+    assert decoded == {"type": "log", "data": "hello"}
+    assert logger._num_blocks == 1  # noqa: SLF001
+
+
+@pytest.mark.parametri
```

---

### Incident Patch 5: `dac4f721` (2026-07-10)
**Commit Message**: Fix .strip call (#2431)

- Resolves #2381

**File**: `.semversioner/next-release/patch-20260710184002601897.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "type": "patch",
+  "description": "Fix .strip call - resolves #2381"
+}
```

**File**: `packages/graphrag/graphrag/config/models/graph_rag_config.py` (modified, +1/-1)
```diff
@@ -270,7 +270,7 @@ def _validate_vector_store_db_uri(self) -> None:
         """Validate the vector store configuration."""
         store = self.vector_store
         if store.type == VectorStoreType.LanceDB:
-            if not store.db_uri or store.db_uri.strip == "":
+            if not store.db_uri or store.db_uri.strip() == "":
                 store.db_uri = graphrag_config_defaults.vector_store.db_uri
             store.db_uri = str(Path(store.db_uri).resolve())
 
```

---

### Incident Patch 6: `27410150` (2026-07-10)
**Commit Message**: Fix logging bug. (#2429)

- Resolves #2254

**File**: `.semversioner/next-release/patch-20260710152344024031.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "type": "patch",
+  "description": "Fix logging bug."
+}
```

**File**: `packages/graphrag/graphrag/cli/index.py` (modified, +1/-1)
```diff
@@ -116,7 +116,7 @@ def _run_index(
     )
 
     if dry_run:
-        logger.info("Dry run complete, exiting...", True)
+        logger.info("Dry run complete, exiting...")
         sys.exit(0)
 
     _register_signal_handlers()
```

---

### Incident Patch 7: `b1f0e6c3` (2026-03-30)
**Commit Message**: Fix broken documentation links. (#2305)

- Addresses #2258 and #2287
- Resolves #2249

Co-authored-by: Br1an67 <[REDACTED_EMAIL]>

**File**: `.semversioner/next-release/patch-20260330124917517235.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "type": "patch",
+  "description": "fix broken documentation links."
+}
```

**File**: `docs/config/yaml.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 The default configuration mode may be configured by using a `settings.yml` or `settings.json` file in the data project root. If a `.env` file is present along with this config file, then it will be loaded, and the environment variables defined therein will be available for token replacements in your configuration document using `${ENV_VAR}` syntax. We initialize with YML by default in `graphrag init` but you may use the equivalent JSON form if preferred.
 
-Many of these config values have defaults. Rather than replicate them here, please refer to the [constants in the code](https://github.com/microsoft/graphrag/blob/main/graphrag/config/defaults.py) directly.
+Many of these config values have defaults. Rather than replicate them here, please refer to the [constants in the code](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/config/defaults.py) directly.
 
 For example:
 
```

**File**: `docs/index/architecture.md` (modified, +7/-7)
```diff
@@ -40,13 +40,13 @@ Several subsystems within GraphRAG use a factory pattern to register and retriev
 
 The following subsystems use a factory pattern that allows you to register your own implementations:
 
-- [language model](https://github.com/microsoft/graphrag/blob/main/graphrag/language_model/factory.py) - implement your own `chat` and `embed` methods to use a model provider of choice beyond the built-in LiteLLM wrapper
-- [input reader](https://github.com/microsoft/graphrag/blob/main/graphrag/index/input/factory.py) - implement your own input document reader to support file types other than text, CSV, and JSON
-- [cache](https://github.com/microsoft/graphrag/blob/main/graphrag/cache/factory.py) - create your own cache storage location in addition to the file, blob, and CosmosDB ones we provide
-- [logger](https://github.com/microsoft/graphrag/blob/main/graphrag/logger/factory.py) - create your own log writing location in addition to the built-in file and blob storage
-- [storage](https://github.com/microsoft/graphrag/blob/main/graphrag/storage/factory.py) - create your own storage provider (database, etc.) beyond the file, blob, and CosmosDB ones built in
-- [vector store](https://github.com/microsoft/graphrag/blob/main/graphrag/vector_stores/factory.py) - implement your own vector store other than the built-in lancedb, Azure AI Search, and CosmosDB ones built in
-- [pipeline + workflows](https://github.com/microsoft/graphrag/blob/main/graphrag/index/workflows/factory.py) - implement your own workflow steps with a custom `run_workflow` function, or register an entire pipeline (list of named workflows)
+- [language model](https://github.com/microsoft/graphrag/blob/main/packages/graphrag-llm/graphrag_llm/completion/completion_factory.py) - implement your own `chat` and `embed` methods to use a model provider of choice beyond the built-in LiteLLM wrapper
+- [input reader](https://github.com/microsoft/graphrag/blob/main/packages/graphrag-input/graphrag_input/input_reader.py) - implement your own input document reader to support file types other than text, CSV, and JSON
+- [cache](https://github.com/microsoft/graphrag/blob/main/packages/graphrag-cache/graphrag_cache/cache_factory.py) - create your own cache storage location in addition to the file, blob, and CosmosDB ones we provide
+- [logger](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/logger/factory.py) - create your own log writing location in addition to the built-in file and blob storage
+- [storage](https://github.com/microsoft/graphrag/blob/main/packages/graphrag-storage/graphrag_storage/tables/table_provider_factory.py) - create your own storage provider (database, etc.) beyond the file, blob, and CosmosDB ones built in
+- [vector store](https://github.com/microsoft/graphrag/blob/main/packages/graphrag-vectors/graphrag_vectors/vector_store_factory.py) - implement your own vector store other than the built-in lancedb, Azure AI Search, and CosmosDB ones built in
+- [pipeline + workflows](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/index/workflows/factory.py) - implement your own workflow steps with a custom `run_workflow` function, or register an entire pipeline (list of named workflows)
 
 The links for each of these subsystems point to the source code of the factory, which includes registration of the default built-in implementations. In addition, we have a detailed discussion of [language models](../config/models.md), which includes and example of a custom provider, and a [sample notebook](../examples_notebooks/custom_vector_store.ipynb) that demonstrates a custom vector store.
 
```

**File**: `docs/index/inputs.md` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ Also see the [outputs](outputs.md) documentation for the final documents table s
 
 ## Bring-your-own DataFrame
 
-GraphRAG's [indexing API method](https://github.com/microsoft/graphrag/blob/main/graphrag/api/index.py) allows you to pass in your own pandas DataFrame and bypass all of the input loading/parsing described in the next section. This is convenient if you have content in a format or storage location we don't support out-of-the-box. _You must ensure that your input DataFrame conforms to the schema described above._ All of the chunking behavior described later will proceed exactly the same.
+GraphRAG's [indexing API method](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/api/index.py) allows you to pass in your own pandas DataFrame and bypass all of the input loading/parsing described in the next section. This is convenient if you have content in a format or storage location we don't support out-of-the-box. _You must ensure that your input DataFrame conforms to the schema described above._ All of the chunking behavior described later will proceed exactly the same.
 
 ## Custom File Handling
 
```

**File**: `docs/index/overview.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ uv run poe index --root <data_root> # default config mode
 
 ### Python API
 
-Please see the indexing API [python file](https://github.com/microsoft/graphrag/blob/main/graphrag/api/index.py) for the recommended method to call directly from Python code.
+Please see the indexing API [python file](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/api/index.py) for the recommended method to call directly from Python code.
 
 ## Further Reading
 
```

**File**: `docs/prompt_tuning/manual_prompt_tuning.md` (modified, +9/-9)
```diff
@@ -10,7 +10,7 @@ Each of these prompts may be overridden by writing a custom prompt file in plain
 
 ### Entity/Relationship Extraction
 
-[Prompt Source](http://github.com/microsoft/graphrag/blob/main/graphrag/prompts/index/extract_graph.py)
+[Prompt Source](http://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/prompts/index/extract_graph.py)
 
 #### Tokens
 
@@ -22,7 +22,7 @@ Each of these prompts may be overridden by writing a custom prompt file in plain
 
 ### Summarize Entity/Relationship Descriptions
 
-[Prompt Source](http://github.com/microsoft/graphrag/blob/main/graphrag/prompts/index/summarize_descriptions.py)
+[Prompt Source](http://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/prompts/index/summarize_descriptions.py)
 
 #### Tokens
 
@@ -31,7 +31,7 @@ Each of these prompts may be overridden by writing a custom prompt file in plain
 
 ### Claim Extraction
 
-[Prompt Source](http://github.com/microsoft/graphrag/blob/main/graphrag/prompts/index/extract_claims.py)
+[Prompt Source](http://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/prompts/index/extract_claims.py)
 
 #### Tokens
 
@@ -46,7 +46,7 @@ See the [configuration documentation](../config/overview.md) for details on how
 
 ### Generate Community Reports
 
-[Prompt Source](http://github.com/microsoft/graphrag/blob/main/graphrag/prompts/index/community_report.py)
+[Prompt Source](http://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/prompts/index/community_report.py)
 
 #### Tokens
 
@@ -56,7 +56,7 @@ See the [configuration documentation](../config/overview.md) for details on how
 
 ### Local Search
 
-[Prompt Source](http://github.com/microsoft/graphrag/blob/main/graphrag/prompts/query/local_search_system_prompt.py)
+[Prompt Source](http://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/prompts/query/local_search_system_prompt.py)
 
 #### Tokens
 
@@ -65,11 +65,11 @@ See the [configuration documentation](../config/overview.md) for details on how
 
 ### Global Search
 
-[Mapper Prompt Source](http://github.com/microsoft/graphrag/blob/main/graphrag/prompts/query/global_search_map_system_prompt.py)
+[Mapper Prompt Source](http://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/prompts/query/global_search_map_system_prompt.py)
 
-[Reducer Prompt Source](http://github.com/microsoft/graphrag/blob/main/graphrag/prompts/query/global_search_reduce_system_prompt.py)
+[Reducer Prompt Source](http://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/prompts/query/global_search_reduce_system_prompt.py)
 
-[Knowledge Prompt Source](http://github.com/microsoft/graphrag/blob/main/graphrag/prompts/query/global_search_knowledge_system_prompt.py)
+[Knowledge Prompt Source](http://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/prompts/query/global_search_knowledge_system_prompt.py)
 
 Global search uses a map/reduce approach to summarization. You can tune these prompts independently. This search also includes the ability to adjust the use of general knowledge from the model's training.
 
@@ -80,7 +80,7 @@ Global search uses a map/reduce approach to summarization. You can tune these pr
 
 ### Drift Search
 
-[Prompt Source](http://github.com/microsoft/graphrag/blob/main/graphrag/prompts/query/drift_search_system_prompt.py)
+[Prompt Source](http://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/prompts/query/drift_search_system_prompt.py)
 
 #### Tokens
 
```

**File**: `docs/query/drift_search.md` (modified, +5/-5)
```diff
@@ -4,7 +4,7 @@
 
 GraphRAG is a technique that uses large language models (LLMs) to create knowledge graphs and summaries from unstructured text documents and leverages them to improve retrieval-augmented generation (RAG) operations on private datasets. It offers comprehensive global overviews of large, private troves of unstructured text documents while also enabling exploration of detailed, localized information. By using LLMs to create comprehensive knowledge graphs that connect and describe entities and relationships contained in those documents, GraphRAG leverages semantic structuring of the data to generate responses to a wide variety of complex user queries.
 
-DRIFT search (Dynamic Reasoning and Inference with Flexible Traversal) builds upon Microsoft’s GraphRAG technique, combining characteristics of both global and local search to generate detailed responses in a method that balances computational costs with quality outcomes using our [drift search](https://github.com/microsoft/graphrag/blob/main//graphrag/query/structured_search/drift_search/) method.
+DRIFT search (Dynamic Reasoning and Inference with Flexible Traversal) builds upon Microsoft’s GraphRAG technique, combining characteristics of both global and local search to generate detailed responses in a method that balances computational costs with quality outcomes using our [drift search](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/query/structured_search/drift_search/) method.
 
 ## Methodology
 
@@ -19,13 +19,13 @@ DRIFT Search introduces a new approach to local search queries by including comm
 
 ## Configuration
 
-Below are the key parameters of the [DRIFTSearch class](https://github.com/microsoft/graphrag/blob/main//graphrag/query/structured_search/drift_search/search.py):
+Below are the key parameters of the [DRIFTSearch class](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/query/structured_search/drift_search/search.py):
 
 * `model`: Language model chat completion object to be used for response generation
-- `context_builder`: [context builder](https://github.com/microsoft/graphrag/blob/main/graphrag/query/structured_search/drift_search/drift_context.py) object to be used for preparing context data from community reports and query information
-- `config`: model to define the DRIFT Search hyperparameters. [DRIFT Config model](https://github.com/microsoft/graphrag/blob/main/graphrag/config/models/drift_search_config.py)
+- `context_builder`: [context builder](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/query/structured_search/drift_search/drift_context.py) object to be used for preparing context data from community reports and query information
+- `config`: model to define the DRIFT Search hyperparameters. [DRIFT Config model](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/config/models/drift_search_config.py)
 - `tokenizer`: token encoder for tracking the budget for the algorithm.
-- `query_state`: a state object as defined in [Query State](https://github.com/microsoft/graphrag/blob/main/graphrag/query/structured_search/drift_search/state.py) that allows to track execution of a DRIFT Search instance, alongside follow ups and [DRIFT actions](https://github.com/microsoft/graphrag/blob/main/graphrag/query/structured_search/drift_search/action.py).
+- `query_state`: a state object as defined in [Query State](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/query/structured_search/drift_search/state.py) that allows to track execution of a DRIFT Search instance, alongside follow ups and [DRIFT actions](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/query/structured_search/drift_search/action.py).
 
 ## How to Use
 
```

**File**: `docs/query/global_search.md` (modified, +7/-7)
```diff
@@ -4,7 +4,7 @@
 
 Baseline RAG struggles with queries that require aggregation of information across the dataset to compose an answer. Queries such as “What are the top 5 themes in the data?” perform terribly because baseline RAG relies on a vector search of semantically similar text content within the dataset. There is nothing in the query to direct it to the correct information.
 
-However, with GraphRAG we can answer such questions, because the structure of the LLM-generated knowledge graph tells us about the structure (and thus themes) of the dataset as a whole. This allows the private dataset to be organized into meaningful semantic clusters that are pre-summarized. Using our [global search](https://github.com/microsoft/graphrag/blob/main//graphrag/query/structured_search/global_search/) method, the LLM uses these clusters to summarize these themes when responding to a user query.
+However, with GraphRAG we can answer such questions, because the structure of the LLM-generated knowledge graph tells us about the structure (and thus themes) of the dataset as a whole. This allows the private dataset to be organized into meaningful semantic clusters that are pre-summarized. Using our [global search](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/query/structured_search/global_search/) method, the LLM uses these clusters to summarize these themes when responding to a user query.
 
 ## Methodology
 
@@ -52,19 +52,19 @@ The quality of the global search’s response can be heavily influenced by the l
 
 ## Configuration
 
-Below are the key parameters of the [GlobalSearch class](https://github.com/microsoft/graphrag/blob/main//graphrag/query/structured_search/global_search/search.py):
+Below are the key parameters of the [GlobalSearch class](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/query/structured_search/global_search/search.py):
 
 * `model`: Language model chat completion object to be used for response generation
-* `context_builder`: [context builder](https://github.com/microsoft/graphrag/blob/main//graphrag/query/structured_search/global_search/community_context.py) object to be used for preparing context data from community reports
-* `map_system_prompt`: prompt template used in the `map` stage. Default template can be found at [map_system_prompt](https://github.com/microsoft/graphrag/blob/main//graphrag/prompts/query/global_search_map_system_prompt.py)
-* `reduce_system_prompt`: prompt template used in the `reduce` stage, default template can be found at [reduce_system_prompt](https://github.com/microsoft/graphrag/blob/main//graphrag/prompts/query/global_search_reduce_system_prompt.py)
+* `context_builder`: [context builder](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/query/structured_search/global_search/community_context.py) object to be used for preparing context data from community reports
+* `map_system_prompt`: prompt template used in the `map` stage. Default template can be found at [map_system_prompt](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/prompts/query/global_search_map_system_prompt.py)
+* `reduce_system_prompt`: prompt template used in the `reduce` stage, default template can be found at [reduce_system_prompt](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/prompts/query/global_search_reduce_system_prompt.py)
 * `response_type`: free-form text describing the desired response type and format (e.g., `Multiple Paragraphs`, `Multi-Page Report`)
 * `allow_general_knowledge`: setting this to True will include additional instructions to the `reduce_system_prompt` to prompt the LLM to incorporate relevant real-world knowledge outside of the dataset. Note that this may increase hallucinations, but can be useful for certain scenarios. Default is False
-*`general_knowledge_inclusion_prompt`: instruction to add to the `reduce_system_prompt` if `allow_general_knowledge` is enabled. Default instruction can be found at [general_knowledge_instruction](https://github.com/microsoft/graphrag/blob/main//graphrag/prompts/query/global_search_knowledge_system_prompt.py)
+*`general_knowledge_inclusion_prompt`: instruction to add to the `reduce_system_prompt` if `allow_general_knowledge` is enabled. Default instruction can be found at [general_knowledge_instruction](https://github.com/microsoft/graphrag/blob/main/packages/graphrag/graphrag/prompts/query/global_search_knowledge_system_prompt.py)
 * `max_data_tokens`: token budget for the context data
 * `map_llm_params`: a dictionary of additional parameters (e.g., temperature, max_tokens) to be passed to the LLM call at the `map` stage
 * `reduce_llm_params`: a dictionary of additional parameters (e.g., temperature, max_tokens) to passed to the LLM call at the `reduce` stage
-* `context_builder_params`: a dictionary of additional parameters to be passed to the [`context_builder`](https://github.com/microsoft/graphra
```

---

### Incident Patch 8: `64c55522` (2026-02-25)
**Commit Message**: fix csv file reader (#2248)

* fix

* fix test with inline content

* fix format

**File**: `.semversioner/next-release/patch-20260225001919068435.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "type": "patch",
+  "description": "fix csv reader"
+}
```

**File**: `packages/graphrag-input/graphrag_input/csv.py` (modified, +2/-1)
```diff
@@ -4,6 +4,7 @@
 """A module containing 'CSVFileReader' model."""
 
 import csv
+import io
 import logging
 import sys
 
@@ -39,6 +40,6 @@ async def read_file(self, path: str) -> list[TextDocument]:
         """
         file = await self._storage.get(path, encoding=self._encoding)
 
-        reader = csv.DictReader(file.splitlines())
+        reader = csv.DictReader(io.StringIO(file))
         rows = list(reader)
         return await self.process_data_columns(rows, path)
```

**File**: `tests/unit/indexing/input/test_csv_loader.py` (modified, +23/-0)
```diff
@@ -54,3 +54,26 @@ async def test_csv_loader_multiple_files():
     reader = create_input_reader(config, storage)
     documents = await reader.read_files()
     assert len(documents) == 4
+
+
+async def test_csv_loader_preserves_multiline_fields(tmp_path):
+    """Multiline quoted CSV fields must retain their internal newlines."""
+    csv_content = (
+        "title,text\r\n"
+        '"Post 1","Line one.\nLine two.\nLine three."\r\n'
+        '"Post 2","Single line."\r\n'
+    )
+    (tmp_path / "input.csv").write_text(csv_content, encoding="utf-8")
+    config = InputConfig(
+        type=InputType.Csv,
+        text_column="text",
+        title_column="title",
+    )
+    storage = create_storage(StorageConfig(base_dir=str(tmp_path)))
+    reader = create_input_reader(config, storage)
+    documents = await reader.read_files()
+    assert len(documents) == 2
+    assert documents[0].title == "Post 1"
+    assert documents[0].text == "Line one.\nLine two.\nLine three."
+    assert documents[1].title == "Post 2"
+    assert documents[1].text == "Single line."
```

---

### Incident Patch 9: `20d30fd9` (2026-02-17)
**Commit Message**: Cosmosdb communities bug (#2232)

* work in progress

* cosmosdb output error fix

* semserver update

* remove unnecessary code

* clean code

* remove unnecessary prints

**File**: `.semversioner/next-release/patch-20260215034903124458.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "type": "patch",
+  "description": "add support for cosmosdb output"
+}
```

**File**: `packages/graphrag-storage/graphrag_storage/azure_cosmos_storage.py` (modified, +152/-62)
```diff
@@ -25,6 +25,8 @@
 
 logger = logging.getLogger(__name__)
 
+_DEFAULT_PAGE_SIZE = 100
+
 
 class AzureCosmosStorage(Storage):
     """The CosmosDB-Storage Implementation."""
@@ -37,7 +39,7 @@ class AzureCosmosStorage(Storage):
     _database_name: str
     _container_name: str
     _encoding: str
-    _no_id_prefixes: list[str]
+    _no_id_prefixes: set[str]
 
     def __init__(
         self,
@@ -51,7 +53,7 @@ def __init__(
         """Create a CosmosDB storage instance."""
         logger.info("Creating cosmosdb storage")
         database_name = database_name
-        if database_name is None:
+        if not database_name:
             msg = "CosmosDB Storage requires a base_dir to be specified. This is used as the database name."
             logger.error(msg)
             raise ValueError(msg)
@@ -81,7 +83,7 @@ def __init__(
         self._cosmosdb_account_name = (
             account_url.split("//")[1].split(".")[0] if account_url else None
         )
-        self._no_id_prefixes = []
+        self._no_id_prefixes = set()
         logger.debug(
             "Creating cosmosdb storage with account [%s] and database [%s] and container [%s]",
             self._cosmosdb_account_name,
@@ -150,12 +152,10 @@ def find(
                 {"name": "@pattern", "value": file_pattern.pattern}
             ]
 
-            items = list(
-                self._container_client.query_items(
-                    query=query,
-                    parameters=parameters,
-                    enable_cross_partition_query=True,
-                )
+            items = self._query_all_items(
+                self._container_client,
+                query=query,
+                parameters=parameters,
             )
             logger.debug("All items: %s", [item["id"] for item in items])
             num_loaded = 0
@@ -192,72 +192,111 @@ async def get(
         try:
             if not self._database_client or not self._container_client:
                 return None
+
             if as_bytes:
                 prefix = self._get_prefix(key)
-                query = f"SELECT * FROM c WHERE STARTSWITH(c.id, '{prefix}')"  # noqa: S608
-                queried_items = self._container_client.query_items(
-                    query=query, enable_cross_partition_query=True
+                query = f"SELECT * FROM c WHERE STARTSWITH(c.id, '{prefix}:')"  # noqa: S608
+                items_list = self._query_all_items(
+                    self._container_client,
+                    query=query,
                 )
-                items_list = list(queried_items)
+
+                logger.info("Cosmos load prefix=%s count=%d", prefix, len(items_list))
+
+                if not items_list:
+                    logger.warning("No items found for prefix %s (key=%s)", prefix, key)
+                    return None
+
                 for item in items_list:
-                    item["id"] = item["id"].split(":")[1]
+                    item["id"] = item["id"].split(":", 1)[1]
 
                 items_json_str = json.dumps(items_list)
-
                 items_df = pd.read_json(
                     StringIO(items_json_str), orient="records", lines=False
                 )
 
-                # Drop the "id" column if the original dataframe does not include it
-                # TODO: Figure out optimal way to handle missing id keys in input dataframes
-                if prefix in self._no_id_prefixes:
-                    items_df.drop(columns=["id"], axis=1, inplace=True)
-
+                if prefix == "entities":
+                    # Always preserve the Cosmos suffix for debugging/migrations
+                    items_df["cosmos_id"] = items_df["id"]
+                    items_df["id"] = items_df["id"].astype(
+                        str
+                    )  # Only restore pipeline UUID id if we actually have it
+
+                    if "human_readable_id" in items_df.columns:
+                        # Fill any NaN values before converting to int
+                        items_df["human_readable_id"] = (
+                            items_df["human_readable_id"]
+                            .fillna(items_df["id"])
+                            .astype(int)
+                        )
+                    else:
+                        # Fresh run case: extract_graph entities may not have entity_id yet
+                        # Keep id as the suffix (stable_key/index) for now.
+                        logger.info(
+                            "Entities loaded without entity_id; leaving id as cosmos suffix."
+                        )
+
+                if items_df.empty:
+                    logger.warning(
+                        "No rows returned for prefix %s (key=%s)", prefix, key
+                    )
+                    return None
                 return items_df.to_parquet()
             item = self._container_client.read_item(item=key, partition_key=key)
             item_body = item.get("body")
             return
```

**File**: `packages/graphrag/graphrag/data_model/dfs.py` (modified, +10/-5)
```diff
@@ -28,6 +28,11 @@
 )
 
 
+def _safe_int(series: pd.Series, fill: int = -1) -> pd.Series:
+    """Convert a series to int, filling NaN values first."""
+    return series.fillna(fill).astype(int)
+
+
 def _split_list_column(value: Any) -> list[Any]:
     """Split a column containing a list string into an actual list."""
     if isinstance(value, str):
@@ -38,25 +43,25 @@ def _split_list_column(value: Any) -> list[Any]:
 def entities_typed(df: pd.DataFrame) -> pd.DataFrame:
     """Return the entities dataframe with correct types, in case it was stored in a weakly-typed format."""
     if SHORT_ID in df.columns:
-        df[SHORT_ID] = df[SHORT_ID].astype(int)
+        df[SHORT_ID] = _safe_int(df[SHORT_ID])
     if TEXT_UNIT_IDS in df.columns:
         df[TEXT_UNIT_IDS] = df[TEXT_UNIT_IDS].apply(_split_list_column)
     if NODE_FREQUENCY in df.columns:
-        df[NODE_FREQUENCY] = df[NODE_FREQUENCY].astype(int)
+        df[NODE_FREQUENCY] = _safe_int(df[NODE_FREQUENCY], 0)
     if NODE_DEGREE in df.columns:
-        df[NODE_DEGREE] = df[NODE_DEGREE].astype(int)
+        df[NODE_DEGREE] = _safe_int(df[NODE_DEGREE], 0)
 
     return df
 
 
 def relationships_typed(df: pd.DataFrame) -> pd.DataFrame:
     """Return the relationships dataframe with correct types, in case it was stored in a weakly-typed format."""
     if SHORT_ID in df.columns:
-        df[SHORT_ID] = df[SHORT_ID].astype(int)
+        df[SHORT_ID] = _safe_int(df[SHORT_ID])
     if EDGE_WEIGHT in df.columns:
         df[EDGE_WEIGHT] = df[EDGE_WEIGHT].astype(float)
     if EDGE_DEGREE in df.columns:
-        df[EDGE_DEGREE] = df[EDGE_DEGREE].astype(int)
+        df[EDGE_DEGREE] = _safe_int(df[EDGE_DEGREE], 0)
     if TEXT_UNIT_IDS in df.columns:
         df[TEXT_UNIT_IDS] = df[TEXT_UNIT_IDS].apply(_split_list_column)
 
```

**File**: `packages/graphrag/graphrag/index/run/run_pipeline.py` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@ async def run_pipeline(
     input_storage = create_storage(config.input_storage)
 
     output_storage = create_storage(config.output_storage)
+
     output_table_provider = create_table_provider(config.table_provider, output_storage)
 
     cache = create_cache(config.cache)
```

**File**: `packages/graphrag/graphrag/index/workflows/create_communities.py` (modified, +0/-1)
```diff
@@ -30,7 +30,6 @@ async def run_workflow(
     reader = DataReader(context.output_table_provider)
     entities = await reader.entities()
     relationships = await reader.relationships()
-
     max_cluster_size = config.cluster_graph.max_cluster_size
     use_lcc = config.cluster_graph.use_lcc
     seed = config.cluster_graph.seed
```

---

### Incident Patch 10: `8d4080c4` (2026-02-11)
**Commit Message**: add memory profiling (#2227)

* add profiling

* add unit test for profiling

* fix property name

**File**: `.semversioner/next-release/patch-20260211221626814603.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "type": "patch",
+  "description": "add profiling to get memory usage"
+}
```

**File**: `packages/graphrag/graphrag/index/run/profiling.py` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+# Copyright (C) 2025 Microsoft
+# Licensed under the MIT License
+
+"""Workflow profiling utilities."""
+
+import time
+import tracemalloc
+from types import TracebackType
+from typing import Self
+
+from graphrag.index.typing.stats import WorkflowMetrics
+
+
+class WorkflowProfiler:
+    """Context manager for profiling workflow execution.
+
+    Captures timing and memory metrics using tracemalloc. Designed to wrap
+    workflow execution in run_pipeline with minimal code intrusion.
+
+    Example
+    -------
+        with WorkflowProfiler() as profiler:
+            result = await workflow_function(config, context)
+        metrics = profiler.metrics
+    """
+
+    def __init__(self) -> None:
+        self._start_time: float = 0.0
+        self._elapsed: float = 0.0
+        self._peak_memory: int = 0
+        self._current_memory: int = 0
+        self._tracemalloc_overhead: int = 0
+
+    def __enter__(self) -> Self:
+        """Start profiling: begin tracemalloc and record start time."""
+        tracemalloc.start()
+        self._start_time = time.time()
+        return self
+
+    def __exit__(
+        self,
+        exc_type: type[BaseException] | None,
+        exc_val: BaseException | None,
+        exc_tb: TracebackType | None,
+    ) -> None:
+        """Stop profiling: capture metrics and stop tracemalloc."""
+        self._elapsed = time.time() - self._start_time
+        self._current_memory, self._peak_memory = tracemalloc.get_traced_memory()
+        self._tracemalloc_overhead = tracemalloc.get_tracemalloc_memory()
+        tracemalloc.stop()
+
+    @property
+    def metrics(self) -> WorkflowMetrics:
+        """Return collected metrics as a WorkflowMetrics dataclass."""
+        return WorkflowMetrics(
+            overall=self._elapsed,
+            peak_memory_bytes=self._peak_memory,
+            memory_delta_bytes=self._current_memory,
+            tracemalloc_overhead_bytes=self._tracemalloc_overhead,
+        )
```

**File**: `packages/graphrag/graphrag/index/run/run_pipeline.py` (modified, +6/-3)
```diff
@@ -18,6 +18,7 @@
 
 from graphrag.callbacks.workflow_callbacks import WorkflowCallbacks
 from graphrag.config.models.graph_rag_config import GraphRagConfig
+from graphrag.index.run.profiling import WorkflowProfiler
 from graphrag.index.run.utils import create_run_context
 from graphrag.index.typing.context import PipelineRunContext
 from graphrag.index.typing.pipeline import Pipeline
@@ -127,13 +128,15 @@ async def _run_pipeline(
         for name, workflow_function in pipeline.run():
             last_workflow = name
             context.callbacks.workflow_start(name, None)
-            work_time = time.time()
-            result = await workflow_function(config, context)
+
+            with WorkflowProfiler() as profiler:
+                result = await workflow_function(config, context)
+
             context.callbacks.workflow_end(name, result)
             yield PipelineRunResult(
                 workflow=name, result=result.result, state=context.state, error=None
             )
-            context.stats.workflows[name] = {"overall": time.time() - work_time}
+            context.stats.workflows[name] = profiler.metrics
             if result.stop:
                 logger.info("Halting pipeline at workflow request")
                 break
```

**File**: `packages/graphrag/graphrag/index/typing/stats.py` (modified, +19/-2)
```diff
@@ -6,6 +6,23 @@
 from dataclasses import dataclass, field
 
 
+@dataclass
+class WorkflowMetrics:
+    """Metrics collected for a single workflow execution."""
+
+    overall: float
+    """Wall-clock time in seconds."""
+
+    peak_memory_bytes: int
+    """Peak memory usage during workflow execution (tracemalloc)."""
+
+    memory_delta_bytes: int
+    """Net memory change after workflow completion (tracemalloc)."""
+
+    tracemalloc_overhead_bytes: int
+    """Memory used by tracemalloc itself for tracking allocations."""
+
+
 @dataclass
 class PipelineRunStats:
     """Pipeline running stats."""
@@ -21,5 +38,5 @@ class PipelineRunStats:
     input_load_time: float = field(default=0)
     """Float representing the input load time."""
 
-    workflows: dict[str, dict[str, float]] = field(default_factory=dict)
-    """A dictionary of workflows."""
+    workflows: dict[str, WorkflowMetrics] = field(default_factory=dict)
+    """Metrics for each workflow execution."""
```

**File**: `tests/unit/indexing/test_profiling.py` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+# Copyright (C) 2025 Microsoft
+# Licensed under the MIT License
+
+"""Unit tests for WorkflowProfiler."""
+
+import time
+
+from graphrag.index.run.profiling import WorkflowProfiler
+from graphrag.index.typing.stats import WorkflowMetrics
+
+
+class TestWorkflowProfiler:
+    """Tests for the WorkflowProfiler context manager."""
+
+    def test_captures_time(self):
+        """Verify profiler captures elapsed time."""
+        with WorkflowProfiler() as profiler:
+            time.sleep(0.05)  # Sleep 50ms
+
+        metrics = profiler.metrics
+        assert metrics.overall >= 0.05
+        assert metrics.overall < 0.5  # Should not take too long
+
+    def test_captures_peak_memory(self):
+        """Verify profiler captures peak memory from allocations."""
+        with WorkflowProfiler() as profiler:
+            # Allocate ~1MB of data
+            data = [0] * (1024 * 1024 // 8)  # 1M integers ≈ 8MB on 64-bit
+            _ = data  # Keep reference to prevent GC
+
+        metrics = profiler.metrics
+        assert metrics.peak_memory_bytes > 0
+
+    def test_captures_memory_delta(self):
+        """Verify profiler captures memory delta (current allocation)."""
+        with WorkflowProfiler() as profiler:
+            _data = [0] * 10000  # Keep allocation in scope
+
+        metrics = profiler.metrics
+        # Memory delta should be non-negative
+        assert metrics.memory_delta_bytes >= 0
+
+    def test_captures_tracemalloc_overhead(self):
+        """Verify profiler captures tracemalloc's own memory overhead."""
+        with WorkflowProfiler() as profiler:
+            _ = list(range(1000))
+
+        metrics = profiler.metrics
+        assert metrics.tracemalloc_overhead_bytes > 0
+
+    def test_returns_workflow_metrics_dataclass(self):
+        """Verify profiler.metrics returns a WorkflowMetrics instance."""
+        with WorkflowProfiler() as profiler:
+            pass
+
+        metrics = profiler.metrics
+        assert isinstance(metrics, WorkflowMetrics)
+
+    def test_all_metrics_populated(self):
+        """Verify all four metrics are populated after profiling."""
+        with WorkflowProfiler() as profiler:
+            _ = list(range(100))
+
+        metrics = profiler.metrics
+        assert metrics.overall >= 0
+        assert metrics.peak_memory_bytes >= 0
+        assert metrics.memory_delta_bytes >= 0
+        assert metrics.tracemalloc_overhead_bytes >= 0
+
+    def test_handles_exception_in_context(self):
+        """Verify profiler captures metrics even when exception is raised."""
+        profiler: WorkflowProfiler | None = None
+        try:
+            with WorkflowProfiler() as profiler:
+                _ = [0] * 1000
+                msg = "Test exception"
+                raise ValueError(msg)
+        except ValueError:
+            pass
+
+        assert profiler is not None
+        metrics = profiler.metrics
+        assert metrics.overall > 0
+        assert metrics.peak_memory_bytes > 0
+
+    def test_multiple_profilers_independent(self):
+        """Verify multiple profiler instances don't interfere."""
+        with WorkflowProfiler() as profiler1:
+            time.sleep(0.02)
+
+        with WorkflowProfiler() as profiler2:
+            time.sleep(0.04)
+
+        # profiler2 should have longer time
+        assert profiler2.metrics.overall > profiler1.metrics.overall
```

---

### Incident Patch 11: `d39ebed6` (2026-01-27)
**Commit Message**: Fix deps (#2193)

* fix missing project urls

* fix missing deps.

**File**: `packages/graphrag-llm/pyproject.toml` (modified, +3/-0)
```diff
@@ -41,6 +41,9 @@ dependencies = [
     "typing-extensions~=4.12"
 ]
 
+[project.urls]
+Source = "https://github.com/microsoft/graphrag"
+
 [build-system]
 requires = ["hatchling>=1.27.0,<2.0.0"]
 build-backend = "hatchling.build"
```

**File**: `packages/graphrag/pyproject.toml` (modified, +1/-0)
```diff
@@ -37,6 +37,7 @@ dependencies = [
     "azure-storage-blob~=12.24",
     "devtools~=0.12",
     "graphrag-cache==3.0.0",
+    "graphrag-chunking==3.0.0",
     "graphrag-common==3.0.0",
     "graphrag-input==3.0.0",
     "graphrag-llm==3.0.0",
```

**File**: `uv.lock` (modified, +2/-0)
```diff
@@ -889,6 +889,7 @@ dependencies = [
     { name = "blis" },
     { name = "devtools" },
     { name = "graphrag-cache" },
+    { name = "graphrag-chunking" },
     { name = "graphrag-common" },
     { name = "graphrag-input" },
     { name = "graphrag-llm" },
@@ -917,6 +918,7 @@ requires-dist = [
     { name = "blis", specifier = "~=1.0" },
     { name = "devtools", specifier = "~=0.12" },
     { name = "graphrag-cache", editable = "packages/graphrag-cache" },
+    { name = "graphrag-chunking", editable = "packages/graphrag-chunking" },
     { name = "graphrag-common", editable = "packages/graphrag-common" },
     { name = "graphrag-input", editable = "packages/graphrag-input" },
     { name = "graphrag-llm", editable = "packages/graphrag-llm" },
```

---

### Incident Patch 12: `2bd3922d` (2025-10-06)
**Commit Message**: Litellm auth fix (#2083)

* Fix scope for Azure auth with LiteLLM

* Change internal language on max_attempts to max_retries

* Rework model config connectivity validation

* Semver

* Swtich smoke tests to LiteLLM

* Take out temporary retry_strategy = none since it is not fnllm compatible

* Bump smoke test timeout

* Bump smoke timeout further

* Tune smoke params

* Update smoke test bounds

* Remove covariates from min-csv smoke

* Smoke: adjust communities, remove drift

* Remove secrets where they aren't necessary

* Clean out old env var references

**File**: `.github/workflows/gh-pages.yml` (modified, +0/-2)
```diff
@@ -15,8 +15,6 @@ jobs:
       GH_PAGES: 1
       DEBUG: 1
       GRAPHRAG_API_KEY: ${{ secrets.GRAPHRAG_API_KEY }}
-      GRAPHRAG_LLM_MODEL: ${{ secrets.GRAPHRAG_LLM_MODEL }}
-      GRAPHRAG_EMBEDDING_MODEL: ${{ secrets.GRAPHRAG_EMBEDDING_MODEL }}
 
     steps:
       - uses: actions/checkout@v4
```

**File**: `.github/workflows/python-notebook-tests.yml` (modified, +0/-2)
```diff
@@ -38,8 +38,6 @@ jobs:
     env:
       DEBUG: 1
       GRAPHRAG_API_KEY: ${{ secrets.OPENAI_NOTEBOOK_KEY }}
-      GRAPHRAG_LLM_MODEL: ${{ secrets.GRAPHRAG_LLM_MODEL }}
-      GRAPHRAG_EMBEDDING_MODEL: ${{ secrets.GRAPHRAG_EMBEDDING_MODEL }}
 
     runs-on: ${{ matrix.os }}
     steps:
```

**File**: `.github/workflows/python-smoke-tests.yml` (modified, +0/-12)
```diff
@@ -37,20 +37,8 @@ jobs:
       fail-fast: false # Continue running all jobs even if one fails
     env:
       DEBUG: 1
-      GRAPHRAG_LLM_TYPE: "azure_openai_chat"
-      GRAPHRAG_EMBEDDING_TYPE: "azure_openai_embedding"
       GRAPHRAG_API_KEY: ${{ secrets.OPENAI_API_KEY }}
       GRAPHRAG_API_BASE: ${{ secrets.GRAPHRAG_API_BASE }}
-      GRAPHRAG_API_VERSION: ${{ secrets.GRAPHRAG_API_VERSION }}
-      GRAPHRAG_LLM_DEPLOYMENT_NAME: ${{ secrets.GRAPHRAG_LLM_DEPLOYMENT_NAME }}
-      GRAPHRAG_EMBEDDING_DEPLOYMENT_NAME: ${{ secrets.GRAPHRAG_EMBEDDING_DEPLOYMENT_NAME }}
-      GRAPHRAG_LLM_MODEL: ${{ secrets.GRAPHRAG_LLM_MODEL }}
-      GRAPHRAG_EMBEDDING_MODEL: ${{ secrets.GRAPHRAG_EMBEDDING_MODEL }}
-      # We have Windows + Linux runners in 3.10, so we need to divide the rate limits by 2
-      GRAPHRAG_LLM_TPM: 200_000 # 400_000 / 2
-      GRAPHRAG_LLM_RPM: 1_000 # 2_000 / 2
-      GRAPHRAG_EMBEDDING_TPM: 225_000 # 450_000 / 2
-      GRAPHRAG_EMBEDDING_RPM: 1_000 # 2_000 / 2
       # Azure AI Search config
       AZURE_AI_SEARCH_URL_ENDPOINT: ${{ secrets.AZURE_AI_SEARCH_URL_ENDPOINT }}
       AZURE_AI_SEARCH_API_KEY: ${{ secrets.AZURE_AI_SEARCH_API_KEY }}
```

**File**: `.semversioner/next-release/patch-20251001224059977938.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "type": "patch",
+  "description": "Fix Azure auth scope issue with LiteLLM."
+}
```

**File**: `DEVELOPING.md` (modified, +0/-5)
```diff
@@ -119,8 +119,3 @@ and then in your bashrc, add
 Make sure you have python3.10-dev installed or more generally `python<version>-dev`
 
 `sudo apt-get install python3.10-dev`
-
-### LLM call constantly exceeds TPM, RPM or time limits
-
-`GRAPHRAG_LLM_THREAD_COUNT` and `GRAPHRAG_EMBEDDING_THREAD_COUNT` are both set to 50 by default. You can modify these values
-to reduce concurrency. Please refer to the [Configuration Documents](https://microsoft.github.io/graphrag/config/overview/)
```

**File**: `docs/developing.md` (modified, +0/-5)
```diff
@@ -77,8 +77,3 @@ Make sure llvm-9 and llvm-9-dev are installed:
 and then in your bashrc, add
 
 `export LLVM_CONFIG=/usr/bin/llvm-config-9`
-
-### LLM call constantly exceeds TPM, RPM or time limits
-
-`GRAPHRAG_LLM_THREAD_COUNT` and `GRAPHRAG_EMBEDDING_THREAD_COUNT` are both set to 50 by default. You can modify these values
-to reduce concurrency. Please refer to the [Configuration Documents](config/overview.md)
```

**File**: `docs/prompt_tuning/auto_prompt_tuning.md` (modified, +1/-9)
```diff
@@ -79,15 +79,7 @@ After that, it uses one of the following selection methods to pick a sample to w
 
 ## Modify Env Vars
 
-After running auto tuning, you should modify the following environment variables (or config variables) to pick up the new prompts on your index run. Note: Please make sure to update the correct path to the generated prompts, in this example we are using the default "prompts" path.
-
-- `GRAPHRAG_ENTITY_EXTRACTION_PROMPT_FILE` = "prompts/entity_extraction.txt"
-
-- `GRAPHRAG_COMMUNITY_REPORT_PROMPT_FILE` = "prompts/community_report.txt"
-
-- `GRAPHRAG_SUMMARIZE_DESCRIPTIONS_PROMPT_FILE` = "prompts/summarize_descriptions.txt"
-
-or in your yaml config file:
+After running auto tuning, you should modify the following config variables to pick up the new prompts on your index run. Note: Please make sure to update the correct path to the generated prompts, in this example we are using the default "prompts" path.
 
 ```yaml
 entity_extraction:
```

**File**: `graphrag/config/models/graph_rag_config.py` (modified, +1/-1)
```diff
@@ -107,7 +107,7 @@ def _validate_retry_services(self) -> None:
 
                 _ = retry_factory.create(
                     strategy=model.retry_strategy,
-                    max_attempts=model.max_retries,
+                    max_retries=model.max_retries,
                     max_retry_wait=model.max_retry_wait,
                 )
 
```

---

### Incident Patch 13: `2bf7e7c0` (2025-09-18)
**Commit Message**: Fix multi-index search (#2063)

**File**: `.semversioner/next-release/patch-20250918192431890892.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "type": "patch",
+  "description": "Fix multi-index search."
+}
```

**File**: `graphrag/utils/api.py` (modified, +11/-10)
```diff
@@ -168,57 +168,58 @@ def update_context_data(
     """
     updated_context_data = {}
     for key in context_data:
+        entries = context_data[key].to_dict(orient="records")
         updated_entry = []
         if key == "reports":
             updated_entry = [
                 dict(
-                    {k: entry[k] for k in entry},
+                    entry,
                     index_name=links["community_reports"][int(entry["id"])][
                         "index_name"
                     ],
                     index_id=links["community_reports"][int(entry["id"])]["id"],
                 )
-                for entry in context_data[key]
+                for entry in entries
             ]
         if key == "entities":
             updated_entry = [
                 dict(
-                    {k: entry[k] for k in entry},
+                    entry,
                     entity=entry["entity"].split("-")[0],
                     index_name=links["entities"][int(entry["id"])]["index_name"],
                     index_id=links["entities"][int(entry["id"])]["id"],
                 )
-                for entry in context_data[key]
+                for entry in entries
             ]
         if key == "relationships":
             updated_entry = [
                 dict(
-                    {k: entry[k] for k in entry},
+                    entry,
                     source=entry["source"].split("-")[0],
                     target=entry["target"].split("-")[0],
                     index_name=links["relationships"][int(entry["id"])]["index_name"],
                     index_id=links["relationships"][int(entry["id"])]["id"],
                 )
-                for entry in context_data[key]
+                for entry in entries
             ]
         if key == "claims":
             updated_entry = [
                 dict(
-                    {k: entry[k] for k in entry},
+                    entry,
                     entity=entry["entity"].split("-")[0],
                     index_name=links["covariates"][int(entry["id"])]["index_name"],
                     index_id=links["covariates"][int(entry["id"])]["id"],
                 )
-                for entry in context_data[key]
+                for entry in entries
             ]
         if key == "sources":
             updated_entry = [
                 dict(
-                    {k: entry[k] for k in entry},
+                    entry,
                     index_name=links["text_units"][int(entry["id"])]["index_name"],
                     index_id=links["text_units"][int(entry["id"])]["id"],
                 )
-                for entry in context_data[key]
+                for entry in entries
             ]
         updated_context_data[key] = updated_entry
     return updated_context_data
```

---

### Incident Patch 14: `69ad36e7` (2025-08-27)
**Commit Message**: Fix id baseline (#2036)

* Fix all human_readable_id columns to start at 0

* Semver

**File**: `.semversioner/next-release/patch-20250827005334747623.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "type": "patch",
+  "description": "Fix all human_readable_id fields to be 0-based."
+}
```

**File**: `graphrag/index/workflows/create_final_documents.py` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ def create_final_documents(
     ).reset_index(drop=True)
 
     rejoined["id"] = rejoined["id"].astype(str)
-    rejoined["human_readable_id"] = rejoined.index + 1
+    rejoined["human_readable_id"] = rejoined.index
 
     if "metadata" not in rejoined.columns:
         rejoined["metadata"] = pd.Series(dtype="object")
```

**File**: `graphrag/index/workflows/create_final_text_units.py` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ def create_final_text_units(
 ) -> pd.DataFrame:
     """All the steps to transform the text units."""
     selected = text_units.loc[:, ["id", "text", "document_ids", "n_tokens"]]
-    selected["human_readable_id"] = selected.index + 1
+    selected["human_readable_id"] = selected.index
 
     entity_join = _entities(final_entities)
     relationship_join = _relationships(final_relationships)
```

**File**: `graphrag/index/workflows/extract_covariates.py` (modified, +1/-1)
```diff
@@ -88,6 +88,6 @@ async def extract_covariates(
     )
     text_units.drop(columns=["text_unit_id"], inplace=True)  # don't pollute the global
     covariates["id"] = covariates["covariate_type"].apply(lambda _x: str(uuid4()))
-    covariates["human_readable_id"] = covariates.index + 1
+    covariates["human_readable_id"] = covariates.index
 
     return covariates.loc[:, COVARIATES_FINAL_COLUMNS]
```

**File**: `tests/verbs/test_extract_covariates.py` (modified, +2/-2)
```diff
@@ -58,8 +58,8 @@ async def test_extract_covariates():
     assert_series_equal(actual["text_unit_id"], input["id"], check_names=False)
 
     # make sure the human ids are incrementing
-    assert actual["human_readable_id"][0] == 1
-    assert actual["human_readable_id"][1] == 2
+    assert actual["human_readable_id"][0] == 0
+    assert actual["human_readable_id"][1] == 1
 
     # check that the mock data is parsed and inserted into the correct columns
     assert actual["covariate_type"][0] == "claim"
```

**File**: `tests/verbs/test_finalize_graph.py` (modified, +0/-6)
```diff
@@ -30,9 +30,6 @@ async def test_finalize_graph():
         "relationships", context.output_storage
     )
 
-    assert len(nodes_actual) == 291
-    assert len(edges_actual) == 452
-
     # x and y will be zero with the default configuration, because we do not embed/umap
     assert nodes_actual["x"].sum() == 0
     assert nodes_actual["y"].sum() == 0
@@ -58,9 +55,6 @@ async def test_finalize_graph_umap():
         "relationships", context.output_storage
     )
 
-    assert len(nodes_actual) == 291
-    assert len(edges_actual) == 452
-
     # x and y should have some value other than zero due to umap
     assert nodes_actual["x"].sum() != 0
     assert nodes_actual["y"].sum() != 0
```

**File**: `tests/verbs/test_prune_graph.py` (modified, +1/-1)
```diff
@@ -28,4 +28,4 @@ async def test_prune_graph():
 
     nodes_actual = await load_table_from_storage("entities", context.output_storage)
 
-    assert len(nodes_actual) == 21
+    assert len(nodes_actual) == 20
```

#### Recent Merged Pull Requests:
- **PR #2582** (closed): Bump litellm from 1.100.1 to 1.102.1 in /packages/graphrag-llm (@dependabot[bot])
- **PR #2581** (closed): Bump pandas from 3.0.5 to 3.0.6 (@dependabot[bot])
- **PR #2580** (closed): Bump azure-storage-blob from 12.30.2 to 12.30.3 in the azure group across 1 directory (@dependabot[bot])
- **PR #2579** (closed): Bump the github-actions group with 7 updates (@dependabot[bot])
- **PR #2572** (2026-09-23): Release v3.2.0 (@gaudyb)
- **PR #2570** (2026-09-23): new cache implementation (@gaudyb)
- **PR #2569** (closed): Update lancedb requirement from ~=0.38.0 to >=0.38,<0.40 in /packages/graphrag-vectors (@dependabot[bot])
- **PR #2568** (closed): Bump litellm from 1.100.0 to 1.101.0 in /packages/graphrag-llm (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
