# Forensic Learning Record (Deep Inspection): microsoft/graphrag

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-graphrag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/graphrag](https://github.com/microsoft/graphrag))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:42:36.219Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/graphrag`
- **Description**: A modular graph-based Retrieval-Augmented Generation (RAG) system
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 36177 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/graphrag-cache/graphrag_cache/__init__.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""The GraphRAG Cache package."""

from graphrag_cache.cache import Cache
from graphrag_cache.cache_config import CacheConfig
from graphrag_cache.cache_factory import create_cache, register_cache
from graphrag_cache.cache_key import CacheKeyCreator, create_cache_key
from graphrag_cache.cache_type import CacheType

__all__ = [
    "Cache",
    "CacheConfig",
    "CacheKeyCreator",
    "CacheType",
    "create_cache",
    "create_cache_key",
    "register_cache",
]

```

### Core Architecture Module: `packages/graphrag-cache/graphrag_cache/cache.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""Abstract base class for cache."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from graphrag_storage import Storage


class Cache(ABC):
    """Provide a cache interface for the pipeline."""

    @abstractmethod
    def __init__(self, *, storage: Storage | None, **kwargs: Any) -> None:
        """Create a cache instance."""

    @abstractmethod
    async def get(self, key: str) -> Any:
        """Get the value for the given key.

        Args:
            - key - The key to get the value for.
            - as_bytes - Whether or not to return the value as bytes.

        Returns
        -------
            - output - The value for the given key.
        """

    @abstractmethod
    async def set(self, key: str, value: Any, debug_data: dict | None = None) -> None:
        """Set the value for the given key.

        Args:
            - key - The key to set the value for.
            - value - The value to set.
        """

    @abstractmethod
    async def has(self, key: str) -> bool:
        """Return True if the given key exists in the cache.

        Args:
            - key - The key to check for.

        Returns
        -------
            - output - True if the key exists in the cache, False otherwise.
        """

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete the given key from the cache.

        Args:
            - key - The key to delete.
        """

    @abstractmethod
    async def clear(self) -> None:
        """Clear the cache."""

    @abstractmethod
    def child(self, name: str) -> Cache:
        """Create a child cache with the given name.

        Args:
            - name - The name to create the sub cache with.
        """

```

### Core Architecture Module: `packages/graphrag-cache/graphrag_cache/cache_config.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""Cache configuration model."""

from graphrag_storage import StorageConfig, StorageType
from pydantic import BaseModel, ConfigDict, Field, model_validator

from graphrag_cache.cache_type import CacheType


class CacheConfig(BaseModel):
    """The configuration section for cache."""

    model_config = ConfigDict(extra="allow")
    """Allow extra fields to support custom cache implementations."""

    type: str = Field(
        description="The cache type to use. Builtin types include 'Json', 'Memory', 'Noop', and 'Sqlite'.",
        default=CacheType.Json,
    )

    storage: StorageConfig | None = Field(
        description="The storage configuration to use for storage-backed caches such as 'Json' and 'Sqlite'.",
        default_factory=lambda: StorageConfig(type=StorageType.File, base_dir="cache"),
    )

    database_name: str = Field(
        description="The SQLite database name within the configured file storage. Used only when type is 'Sqlite'.",
        default="cache.db",
    )

    @model_validator(mode="after")
    def _validate_sqlite_storage(self) -> "CacheConfig":
        if self.type == CacheType.Sqlite and (
            self.storage is None or self.storage.type != StorageType.File
        ):
            msg = "Cache type 'sqlite' requires storage type 'file'."
            raise ValueError(msg)
        return self

```

### Core Architecture Module: `packages/graphrag-cache/graphrag_cache/cache_factory.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License


"""Cache factory implementation."""

from collections.abc import Callable

from graphrag_common.factory import Factory, ServiceScope
from graphrag_storage import Storage, create_storage

from graphrag_cache.cache import Cache
from graphrag_cache.cache_config import CacheConfig
from graphrag_cache.cache_type import CacheType


class CacheFactory(Factory["Cache"]):
    """A factory class for cache implementations."""


cache_factory = CacheFactory()


def register_cache(
    cache_type: str,
    cache_initializer: Callable[..., Cache],
    scope: ServiceScope = "transient",
) -> None:
    """Register a custom cache implementation.

    Args
    ----
        - cache_type: str
            The cache id to register.
        - cache_initializer: Callable[..., Cache]
            The cache initializer to register.
    """
    cache_factory.register(cache_type, cache_initializer, scope)


def create_cache(
    config: CacheConfig | None = None, storage: Storage | None = None
) -> "Cache":
    """Create a cache implementation based on the given configuration.

    Args
    ----
        - config: CacheConfig
            The cache configuration to use.
        - storage: Storage | None
            The storage implementation to use for file-based caches such as 'Json'.

    Returns
    -------
        Cache
            The created cache implementation.
    """
    config = config or CacheConfig()
    config_model = config.model_dump()
    cache_strategy = config.type

    if not storage and config.storage:
        storage = create_storage(config.storage)

    if cache_strategy not in cache_factory:
        match cache_strategy:
            case CacheType.Json:
                from graphrag_cache.json_cache import JsonCache

                register_cache(CacheType.Json, JsonCache)

            case CacheType.Memory:
                from graphrag_cache.memory_cache import MemoryCache

                register_cache(CacheType.Memory, MemoryCache)

            case CacheType.Noop:
                from graphrag_cache.noop_cache import NoopCache

                register_cache(CacheType.Noop, NoopCache)

            case CacheType.Sqlite:
                from graphrag_cache.sqlite_cache import SQLiteCache

                register_cache(CacheType.Sqlite, SQLiteCache)

            case _:
                msg = f"CacheConfig.type '{cache_strategy}' is not registered in the CacheFactory. Registered types: {', '.join(cache_factory.keys())}."
                raise ValueError(msg)

    if storage:
        config_model["storage"] = storage

    return cache_factory.create(strategy=cache_strategy, init_args=config_model)

```

### Core Architecture Module: `packages/graphrag-cache/graphrag_cache/cache_key.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""Create cache key."""

from typing import Any, Protocol, runtime_checkable

from graphrag_common.hasher import hash_data


@runtime_checkable
class CacheKeyCreator(Protocol):
    """Create cache key function protocol.

    Args
    ----
        input_args: dict[str, Any]
            The input arguments for creating the cache key.

    Returns
    -------
        str
            The generated cache key.
    """

    def __call__(
        self,
        input_args: dict[str, Any],
    ) -> str:
        """Create cache key."""
        ...


def create_cache_key(input_args: dict[str, Any]) -> str:
    """Create a cache key based on the input arguments."""
    return hash_data(input_args)

```

### Core Architecture Module: `packages/graphrag-cache/graphrag_cache/cache_type.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License


"""Builtin cache implementation types."""

from enum import StrEnum


class CacheType(StrEnum):
    """Enum for cache types."""

    Json = "json"
    Memory = "memory"
    Noop = "none"
    Sqlite = "sqlite"

```

### Core Architecture Module: `packages/graphrag-cache/graphrag_cache/json_cache.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""A module containing 'JsonCache' model."""

import json
from typing import Any

from graphrag_storage import Storage, StorageConfig, create_storage

from graphrag_cache.cache import Cache


class JsonCache(Cache):
    """File pipeline cache class definition."""

    _storage: Storage

    def __init__(
        self,
        storage: Storage | dict[str, Any] | None = None,
        **kwargs: Any,
    ) -> None:
        """Init method definition."""
        if storage is None:
            msg = "JsonCache requires either a Storage instance to be provided or a StorageConfig to create one."
            raise ValueError(msg)
        if isinstance(storage, Storage):
            self._storage = storage
        else:
            self._storage = create_storage(StorageConfig(**storage))

    async def get(self, key: str) -> Any | None:
        """Get method definition."""
        if await self.has(key):
            try:
                data = await self._storage.get(key)
                data = json.loads(data)
            except UnicodeDecodeError:
                await self._storage.delete(key)
                return None
            except json.decoder.JSONDecodeError:
                await self._storage.delete(key)
                return None
            else:
                return data.get("result")

        return None

    async def set(self, key: str, value: Any, debug_data: dict | None = None) -> None:
        """Set method definition."""
        if value is None:
            return
        data = {"result": value, **(debug_data or {})}
        await self._storage.set(key, json.dumps(data, ensure_ascii=False))

    async def has(self, key: str) -> bool:
        """Has method definition."""
        return await self._storage.has(key)

    async def delete(self, key: str) -> None:
        """Delete method definition."""
        if await self.has(key):
            await self._storage.delete(key)

    async def clear(self) -> None:
        """Clear method definition."""
        await self._storage.clear()

    def child(self, name: str) -> "Cache":
        """Child method definition."""
        return JsonCache(storage=self._storage.child(name))

```

### Core Architecture Module: `packages/graphrag-cache/graphrag_cache/memory_cache.py`
```
# Copyright (c) 2024 Microsoft Corporation.
# Licensed under the MIT License

"""MemoryCache implementation."""

from typing import Any

from graphrag_cache.cache import Cache


class MemoryCache(Cache):
    """In memory cache class definition."""

    _cache: dict[str, Any]
    _name: str

    def __init__(self, **kwargs: Any) -> None:
        """Init method definition."""
        self._cache = {}

    async def get(self, key: str) -> Any:
        """Get the value for the given key.

        Args:
            - key - The key to get the value for.
            - as_bytes - Whether or not to return the value as bytes.

        Returns
        -------
            - output - The value for the given key.
        """
        return self._cache.get(key)

    async def set(self, key: str, value: Any, debug_data: dict | None = None) -> None:
        """Set the value for the given key.

        Args:
            - key - The key to set the value for.
            - value - The value to set.
        """
        self._cache[key] = value

    async def has(self, key: str) -> bool:
        """Return True if the given key exists in the storage.

        Args:
            - key - The key to check for.

        Returns
        -------
            - output - True if the key exists in the storage, False otherwise.
        """
        return key in self._cache

    async def delete(self, key: str) -> None:
        """Delete the given key from the storage.

        Args:
            - key - The key to delete.
        """
        del self._cache[key]

    async def clear(self) -> None:
        """Clear the storage."""
        self._cache.clear()

    def child(self, name: str) -> "Cache":
        """Create a sub cache with the given name."""
        return MemoryCache()

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

Co-authored-by: FU-max-boop <214359569+FU-max-boop@users.noreply.github.com>

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
+    with pytest.raises(Ru
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

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

* fix syntax mismatch

---------

Co-authored-by: Gaudy Blanco <gaudy-microsoft@MacBook-Pro-m4-Gaudy-For-Work.local>
Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

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
+    _mock_bsc, _mock_blob_client = mo
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

Co-authored-by: Br1an67 <932039080@qq.com>

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
+                        # Fill any NaN values before converting to i
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

#### Recent Merged Pull Requests:
- **PR #2572** (2026-09-23): Release v3.2.0 (@gaudyb)
- **PR #2570** (2026-09-23): new cache implementation (@gaudyb)
- **PR #2569** (closed): Update lancedb requirement from ~=0.38.0 to >=0.38,<0.40 in /packages/graphrag-vectors (@dependabot[bot])
- **PR #2568** (closed): Bump litellm from 1.100.0 to 1.101.0 in /packages/graphrag-llm (@dependabot[bot])
- **PR #2567** (closed): Bump tqdm from 4.70.0 to 4.70.1 (@dependabot[bot])
- **PR #2566** (closed): Bump the dev-tooling group across 1 directory with 3 updates (@dependabot[bot])
- **PR #2565** (closed): Bump the azure group across 1 directory with 2 updates (@dependabot[bot])
- **PR #2564** (closed): Bump the github-actions group with 7 updates (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
