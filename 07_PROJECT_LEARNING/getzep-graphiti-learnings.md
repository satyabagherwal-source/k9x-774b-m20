# Forensic Learning Record (Deep Inspection): getzep/graphiti

> **Canonical Artifact**: `07_PROJECT_LEARNING/getzep-graphiti-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/getzep/graphiti](https://github.com/getzep/graphiti))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:29:15.606Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `getzep/graphiti`
- **Description**: Build Real-Time Knowledge Graphs for AI Agents
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 31463 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `graphiti_core/__init__.py`
```
from .graphiti import Graphiti

__all__ = ['Graphiti']

```

### Core Architecture Module: `graphiti_core/cross_encoder/__init__.py`
```
"""
Copyright 2025, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

from .client import CrossEncoderClient
from .openai_reranker_client import OpenAIRerankerClient

__all__ = ['CrossEncoderClient', 'OpenAIRerankerClient']

```

### Core Architecture Module: `graphiti_core/cross_encoder/bge_reranker_client.py`
```
"""
Copyright 2024, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

import asyncio
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentence_transformers import CrossEncoder
else:
    try:
        from sentence_transformers import CrossEncoder
    except ImportError:
        raise ImportError(
            'sentence-transformers is required for BGERerankerClient. '
            'Install it with: pip install graphiti-core[sentence-transformers]'
        ) from None

from graphiti_core.cross_encoder.client import CrossEncoderClient


class BGERerankerClient(CrossEncoderClient):
    def __init__(self):
        self.model = CrossEncoder('BAAI/bge-reranker-v2-m3')

    async def rank(self, query: str, passages: list[str]) -> list[tuple[str, float]]:
        if not passages:
            return []

        input_pairs = [[query, passage] for passage in passages]

        # Run the synchronous predict method in an executor
        loop = asyncio.get_running_loop()
        scores = await loop.run_in_executor(None, self.model.predict, input_pairs)

        ranked_passages = sorted(
            [(passage, float(score)) for passage, score in zip(passages, scores, strict=False)],
            key=lambda x: x[1],
            reverse=True,
        )

        return ranked_passages

```

### Core Architecture Module: `graphiti_core/cross_encoder/client.py`
```
"""
Copyright 2024, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

from abc import ABC, abstractmethod


class CrossEncoderClient(ABC):
    """
    CrossEncoderClient is an abstract base class that defines the interface
    for cross-encoder models used for ranking passages based on their relevance to a query.
    It allows for different implementations of cross-encoder models to be used interchangeably.
    """

    @abstractmethod
    async def rank(self, query: str, passages: list[str]) -> list[tuple[str, float]]:
        """
        Rank the given passages based on their relevance to the query.

        Args:
            query (str): The query string.
            passages (list[str]): A list of passages to rank.

        Returns:
            list[tuple[str, float]]: A list of tuples containing the passage and its score,
                                     sorted in descending order of relevance.
        """
        pass

```

### Core Architecture Module: `graphiti_core/cross_encoder/gemini_reranker_client.py`
```
"""
Copyright 2024, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

import logging
import re
from typing import TYPE_CHECKING

from ..helpers import semaphore_gather
from ..llm_client import LLMConfig, RateLimitError
from .client import CrossEncoderClient

if TYPE_CHECKING:
    from google import genai
    from google.genai import types
else:
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        raise ImportError(
            'google-genai is required for GeminiRerankerClient. '
            'Install it with: pip install graphiti-core[google-genai]'
        ) from None

logger = logging.getLogger(__name__)

DEFAULT_MODEL = 'gemini-2.5-flash-lite'


class GeminiRerankerClient(CrossEncoderClient):
    """
    Google Gemini Reranker Client
    """

    def __init__(
        self,
        config: LLMConfig | None = None,
        client: 'genai.Client | None' = None,
    ):
        """
        Initialize the GeminiRerankerClient with the provided configuration and client.

        The Gemini Developer API does not yet support logprobs. Unlike the OpenAI reranker,
        this reranker uses the Gemini API to perform direct relevance scoring of passages.
        Each passage is scored individually on a 0-100 scale.

        Args:
            config (LLMConfig | None): The configuration for the LLM client, including API key, model, base URL, temperature, and max tokens.
            client (genai.Client | None): An optional async client instance to use. If not provided, a new genai.Client is created.
        """
        if config is None:
            config = LLMConfig()

        self.config = config
        if client is None:
            self.client = genai.Client(api_key=config.api_key)
        else:
            self.client = client

    async def rank(self, query: str, passages: list[str]) -> list[tuple[str, float]]:
        """
        Rank passages based on their relevance to the query using direct scoring.

        Each passage is scored individually on a 0-100 scale, then normalized to [0,1].
        """
        if len(passages) <= 1:
            return [(passage, 1.0) for passage in passages]

        # Generate scoring prompts for each passage
        scoring_prompts = []
        for passage in passages:
            prompt = f"""Rate how well this passage answers or relates to the query. Use a scale from 0 to 100.

Query: {query}

Passage: {passage}

Provide only a number between 0 and 100 (no explanation, just the number):"""

            scoring_prompts.append(
                [
                    types.Content(
                        role='user',
                        parts=[types.Part.from_text(text=prompt)],
                    ),
                ]
            )

        try:
            # Execute all scoring requests concurrently - O(n) API calls
            responses = await semaphore_gather(
                *[
                    self.client.aio.models.generate_content(
                        model=self.config.model or DEFAULT_MODEL,
                        contents=prompt_messages,  # type: ignore
                        config=types.GenerateContentConfig(
                            system_instruction='You are an expert at rating passage relevance. Respond with only a number from 0-100.',
                            temperature=0.0,
                            max_output_tokens=3,
                        ),
                    )
                    for prompt_messages in scoring_prompts
                ]
            )

            # Extract scores and create results
            results = []
            for passage, response in zip(passages, responses, strict=True):
                try:
                    if hasattr(response, 'text') and response.text:
                        # Extract numeric score from response
                        score_text = response.text.strip()
                        # Handle cases where model might return non-numeric text
                        score_match = re.search(r'\b(\d{1,3})\b', score_text)
                        if score_match:
                            score = float(score_match.group(1))
                            # Normalize to [0, 1] range and clamp to valid range
                            normalized_score = max(0.0, min(1.0, score / 100.0))
                            results.append((passage, normalized_score))
                        else:
                            logger.warning(
                                f'Could not extract numeric score from response: {score_text}'
                            )
                            results.append((passage, 0.0))
                    else:
                        logger.warning('Empty response from Gemini for passage scoring')
                        results.append((passage, 0.0))
                except (ValueError, AttributeError) as e:
                    logger.warning(f'Error parsing score from Gemini response: {e}')
                    results.append((passage, 0.0))

            # Sort by score in descending order (highest relevance first)
            results.sort(reverse=True, key=lambda x: x[1])
            return results

        except Exception as e:
            # Check if it's a rate limit error based on Gemini API error codes
            error_message = str(e).lower()
            if (
                'rate limit' in error_message
                or 'quota' in error_message
                or 'resource_exhausted' in error_message
                or '429' in str(e)
            ):
                raise RateLimitError from e

            logger.error(f'Error in generating LLM response: {e}')
            raise

```

### Core Architecture Module: `graphiti_core/cross_encoder/openai_reranker_client.py`
```
"""
Copyright 2024, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

import logging
from typing import Any

import numpy as np
import openai
from openai import AsyncAzureOpenAI, AsyncOpenAI

from ..helpers import semaphore_gather
from ..llm_client import LLMConfig, OpenAIClient, RateLimitError
from ..prompts import Message
from .client import CrossEncoderClient

logger = logging.getLogger(__name__)

DEFAULT_MODEL = 'gpt-4.1-nano'


class OpenAIRerankerClient(CrossEncoderClient):
    def __init__(
        self,
        config: LLMConfig | None = None,
        client: AsyncOpenAI | AsyncAzureOpenAI | OpenAIClient | None = None,
    ):
        """
        Initialize the OpenAIRerankerClient with the provided configuration and client.

        This reranker uses the OpenAI API to run a simple boolean classifier prompt concurrently
        for each passage. Log-probabilities are used to rank the passages.

        Args:
            config (LLMConfig | None): The configuration for the LLM client, including API key, model, base URL, temperature, and max tokens.
            client (AsyncOpenAI | AsyncAzureOpenAI | OpenAIClient | None): An optional async client instance to use. If not provided, a new AsyncOpenAI client is created.
        """
        if config is None:
            config = LLMConfig()

        self.config = config
        if client is None:
            self.client = AsyncOpenAI(api_key=config.api_key, base_url=config.base_url)
        elif isinstance(client, OpenAIClient):
            self.client = client.client
        else:
            self.client = client

    async def rank(self, query: str, passages: list[str]) -> list[tuple[str, float]]:
        openai_messages_list: Any = [
            [
                Message(
                    role='system',
                    content='You are an expert tasked with determining whether the passage is relevant to the query',
                ),
                Message(
                    role='user',
                    content=f"""
                           Respond with "True" if PASSAGE is relevant to QUERY and "False" otherwise.
                           <PASSAGE>
                           {passage}
                           </PASSAGE>
                           <QUERY>
                           {query}
                           </QUERY>
                           """,
                ),
            ]
            for passage in passages
        ]
        try:
            responses = await semaphore_gather(
                *[
                    self.client.chat.completions.create(
                        model=self.config.model or DEFAULT_MODEL,
                        messages=openai_messages,
                        temperature=0,
                        max_tokens=1,
                        logit_bias={'6432': 1, '7983': 1},
                        logprobs=True,
                        top_logprobs=2,
                    )
                    for openai_messages in openai_messages_list
                ]
            )

            responses_top_logprobs = [
                response.choices[0].logprobs.content[0].top_logprobs
                if response.choices[0].logprobs is not None
                and response.choices[0].logprobs.content is not None
                else []
                for response in responses
            ]
            scores: list[float] = []
            for top_logprobs in responses_top_logprobs:
                if len(top_logprobs) == 0:
                    continue
                norm_logprobs = np.exp(top_logprobs[0].logprob)
                if top_logprobs[0].token.strip().split(' ')[0].lower() == 'true':
                    scores.append(norm_logprobs)
                else:
                    scores.append(1 - norm_logprobs)

            results = [(passage, score) for passage, score in zip(passages, scores, strict=True)]
            results.sort(reverse=True, key=lambda x: x[1])
            return results
        except openai.RateLimitError as e:
            raise RateLimitError from e
        except Exception as e:
            logger.error(f'Error in generating LLM response: {e}')
            raise

```

### Core Architecture Module: `graphiti_core/decorators.py`
```
"""
Copyright 2024, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

import functools
import inspect
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from graphiti_core.driver.driver import GraphProvider
from graphiti_core.helpers import semaphore_gather
from graphiti_core.search.search_config import SearchResults

F = TypeVar('F', bound=Callable[..., Awaitable[Any]])


def handle_multiple_group_ids(func: F) -> F:
    """
    Decorator for FalkorDB methods that need to handle multiple group_ids.
    Runs the function for each group_id separately and merges results.

    Also routes a *single* group_id to the matching FalkorDB graph via a
    call-scoped driver clone. Without this, add_episode re-binds the shared
    driver for writes while search/retrieve with one group_id query the
    driver's default database and silently return empty results (#1659).
    """

    @functools.wraps(func)
    async def wrapper(self, *args, **kwargs):
        group_ids_func_pos = get_parameter_position(func, 'group_ids')
        group_ids_pos = (
            group_ids_func_pos - 1 if group_ids_func_pos is not None else None
        )  # Adjust for zero-based index
        group_ids = kwargs.get('group_ids')

        # If not in kwargs and position exists, get from args
        if group_ids is None and group_ids_pos is not None and len(args) > group_ids_pos:
            group_ids = args[group_ids_pos]

        is_falkor = (
            hasattr(self, 'clients')
            and hasattr(self.clients, 'driver')
            and self.clients.driver.provider == GraphProvider.FALKORDB
        )

        # FalkorDB: one group_id still needs the graph named after that id.
        # Clone is call-scoped so we never reassign self.driver / self.clients.driver.
        if is_falkor and group_ids and len(group_ids) == 1:
            gid = group_ids[0]
            driver = self.clients.driver
            if gid != getattr(driver, '_database', None):
                return await func(
                    self,
                    *args,
                    **{**kwargs, 'driver': driver.clone(database=gid)},
                )
            return await func(self, *args, **kwargs)

        # FalkorDB with multiple group_ids: run per graph and merge
        if is_falkor and group_ids and len(group_ids) > 1:
            # Execute for each group_id concurrently
            driver = self.clients.driver

            async def execute_for_group(gid: str):
                # Bind the call by name, per task, from the original args.
                # Popping group_ids from its original positional slot shifts
                # every later positional argument down, so a caller that
                # passed driver positionally collided with the keyword
                # injected here (TypeError: got multiple values for argument
                # 'driver') (#1758). Re-binding from the signature normalizes
                # every argument to its declared name before the per-group
                # rewrite; a fresh BoundArguments per task also avoids
                # sharing one mutated-in-place object across concurrent
                # tasks, which is safe only as long as nothing awaits
                # between the rewrite and the read.
                bound = inspect.signature(func).bind(self, *args, **kwargs)
                bound.arguments['group_ids'] = [gid]
                bound.arguments['driver'] = driver.clone(database=gid)
                return await func(*bound.args, **bound.kwargs)

            results = await semaphore_gather(
                *[execute_for_group(gid) for gid in group_ids],
                max_coroutines=getattr(self, 'max_coroutines', None),
            )

            # Merge results based on type
            if isinstance(results[0], SearchResults):
                return SearchResults.merge(results)
            elif isinstance(results[0], list):
                return [item for result in results for item in result]
            elif isinstance(results[0], tuple):
                # Handle tuple outputs (like build_communities returning (nodes, edges))
                merged_tuple = []
                for i in range(len(results[0])):
                    component_results = [result[i] for result in results]
                    if isinstance(component_results[0], list):
                        merged_tuple.append(
                            [item for component in component_results for item in component]
                        )
                    else:
                        merged_tuple.append(component_results)
                return tuple(merged_tuple)
            else:
                return results

        # Normal execution
        return await func(self, *args, **kwargs)

    return wrapper  # type: ignore


def get_parameter_position(func: Callable, param_name: str) -> int | None:
    """
    Returns the positional index of a parameter in the function signature.
    If the parameter is not found, returns None.
    """
    sig = inspect.signature(func)
    for idx, (name, _param) in enumerate(sig.parameters.items()):
        if name == param_name:
            return idx
    return None

```

### Core Architecture Module: `graphiti_core/driver/__init__.py`
```
"""
Copyright 2024, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

from neo4j import Neo4jDriver

__all__ = ['Neo4jDriver']

```

### Core Architecture Module: `graphiti_core/driver/driver.py`
```
"""
Copyright 2024, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

from __future__ import annotations

import copy
import logging
import os
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Coroutine
from contextlib import asynccontextmanager
from enum import Enum
from typing import TYPE_CHECKING, Any

from dotenv import load_dotenv

from graphiti_core.driver.graph_operations.graph_operations import GraphOperationsInterface
from graphiti_core.driver.query_executor import QueryExecutor, Transaction
from graphiti_core.driver.search_interface.search_interface import SearchInterface

if TYPE_CHECKING:
    from graphiti_core.driver.operations.community_edge_ops import CommunityEdgeOperations
    from graphiti_core.driver.operations.community_node_ops import CommunityNodeOperations
    from graphiti_core.driver.operations.entity_edge_ops import EntityEdgeOperations
    from graphiti_core.driver.operations.entity_node_ops import EntityNodeOperations
    from graphiti_core.driver.operations.episode_node_ops import EpisodeNodeOperations
    from graphiti_core.driver.operations.episodic_edge_ops import EpisodicEdgeOperations
    from graphiti_core.driver.operations.graph_ops import GraphMaintenanceOperations
    from graphiti_core.driver.operations.has_episode_edge_ops import HasEpisodeEdgeOperations
    from graphiti_core.driver.operations.next_episode_edge_ops import NextEpisodeEdgeOperations
    from graphiti_core.driver.operations.saga_node_ops import SagaNodeOperations
    from graphiti_core.driver.operations.search_ops import SearchOperations

logger = logging.getLogger(__name__)

DEFAULT_SIZE = 10

load_dotenv()

ENTITY_INDEX_NAME = os.environ.get('ENTITY_INDEX_NAME', 'entities')
EPISODE_INDEX_NAME = os.environ.get('EPISODE_INDEX_NAME', 'episodes')
COMMUNITY_INDEX_NAME = os.environ.get('COMMUNITY_INDEX_NAME', 'communities')
ENTITY_EDGE_INDEX_NAME = os.environ.get('ENTITY_EDGE_INDEX_NAME', 'entity_edges')


class GraphProvider(Enum):
    NEO4J = 'neo4j'
    FALKORDB = 'falkordb'
    KUZU = 'kuzu'
    NEPTUNE = 'neptune'


class GraphDriverSession(ABC):
    provider: GraphProvider

    async def __aenter__(self):
        return self

    @abstractmethod
    async def __aexit__(self, exc_type, exc, tb):
        # No cleanup needed for Falkor, but method must exist
        pass

    @abstractmethod
    async def run(self, query: str, **kwargs: Any) -> Any:
        raise NotImplementedError()

    @abstractmethod
    async def close(self):
        raise NotImplementedError()

    @abstractmethod
    async def execute_write(self, func, *args, **kwargs):
        raise NotImplementedError()


class GraphDriver(QueryExecutor, ABC):
    provider: GraphProvider
    fulltext_syntax: str = (
        ''  # Neo4j (default) syntax does not require a prefix for fulltext queries
    )
    _database: str
    default_group_id: str = ''
    # Legacy interfaces (kept for backwards compatibility during Phase 1)
    search_interface: SearchInterface | None = None
    graph_operations_interface: GraphOperationsInterface | None = None

    @abstractmethod
    def execute_query(self, cypher_query_: str, **kwargs: Any) -> Coroutine:
        raise NotImplementedError()

    @abstractmethod
    def session(self, database: str | None = None) -> GraphDriverSession:
        raise NotImplementedError()

    @abstractmethod
    def close(self):
        raise NotImplementedError()

    @abstractmethod
    def delete_all_indexes(self) -> Coroutine:
        raise NotImplementedError()

    def with_database(self, database: str) -> GraphDriver:
        """
        Returns a shallow copy of this driver with a different default database.
        Reuses the same connection (e.g. FalkorDB, Neo4j).
        """
        cloned = copy.copy(self)
        cloned._database = database

        return cloned

    @abstractmethod
    async def build_indices_and_constraints(self, delete_existing: bool = False):
        raise NotImplementedError()

    def clone(self, database: str) -> GraphDriver:
        """Clone the driver with a different database or graph name."""
        return self

    def build_fulltext_query(
        self, query: str, group_ids: list[str] | None = None, max_query_length: int = 128
    ) -> str:
        """
        Specific fulltext query builder for database providers.
        Only implemented by providers that need custom fulltext query building.
        """
        raise NotImplementedError(f'build_fulltext_query not implemented for {self.provider}')

    # --- New operations interfaces ---

    @asynccontextmanager
    async def transaction(self) -> AsyncIterator[Transaction]:
        """Return a transaction context manager.

        Usage::

            async with driver.transaction() as tx:
                await ops.save(driver, node, tx=tx)

        Drivers with real transaction support (e.g., Neo4j) commit on clean exit
        and roll back on exception. Drivers without native transactions return a
        thin wrapper where queries execute immediately.

        The base implementation provides a no-op wrapper using the session. Drivers
        should override this to provide real transaction semantics where supported.
        """
        session = self.session()
        try:
            yield _SessionTransaction(session)
        finally:
            await session.close()

    @property
    def entity_node_ops(self) -> EntityNodeOperations | None:
        return None

    @property
    def episode_node_ops(self) -> EpisodeNodeOperations | None:
        return None

    @property
    def community_node_ops(self) -> CommunityNodeOperations | None:
        return None

    @property
    def saga_node_ops(self) -> SagaNodeOperations | None:
        return None

    @property
    def entity_edge_ops(self) -> EntityEdgeOperations | None:
        return None

    @property
    def episodic_edge_ops(self) -> EpisodicEdgeOperations | None:
        return None

    @property
    def community_edge_ops(self) -> CommunityEdgeOperations | None:
        return None

    @property
    def has_episode_edge_ops(self) -> HasEpisodeEdgeOperations | None:
        return None

    @property
    def next_episode_edge_ops(self) -> NextEpisodeEdgeOperations | None:
        return None

    @property
    def search_ops(self) -> SearchOperations | None:
        return None

    @property
    def graph_ops(self) -> GraphMaintenanceOperations | None:
        return None


class _SessionTransaction(Transaction):
    """Fallback transaction that wraps a session — queries execute immediately."""

    def __init__(self, session: GraphDriverSession):
        self._session = session

    async def run(self, query: str, **kwargs: Any) -> Any:
        return await self._session.run(query, **kwargs)

```

### Core Architecture Module: `graphiti_core/driver/falkordb/__init__.py`
```
"""
Copyright 2024, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

STOPWORDS = [
    'a',
    'is',
    'the',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'but',
    'by',
    'for',
    'if',
    'in',
    'into',
    'it',
    'no',
    'not',
    'of',
    'on',
    'or',
    'such',
    'that',
    'their',
    'then',
    'there',
    'these',
    'they',
    'this',
    'to',
    'was',
    'will',
    'with',
]

```

### Core Architecture Module: `graphiti_core/driver/falkordb/fulltext.py`
```
"""Shared FalkorDB fulltext-query construction."""

import re

from graphiti_core.driver.falkordb import STOPWORDS
from graphiti_core.helpers import validate_group_ids

MAX_QUERY_LENGTH = 128

# FalkorDB separator characters that break text into tokens.
_SEPARATOR_MAP = str.maketrans(
    {
        ',': ' ',
        '.': ' ',
        '<': ' ',
        '>': ' ',
        '{': ' ',
        '}': ' ',
        '[': ' ',
        ']': ' ',
        '"': ' ',
        "'": ' ',
        ':': ' ',
        ';': ' ',
        '!': ' ',
        '@': ' ',
        '#': ' ',
        '$': ' ',
        '%': ' ',
        '^': ' ',
        '&': ' ',
        '*': ' ',
        '(': ' ',
        ')': ' ',
        '-': ' ',
        '+': ' ',
        '=': ' ',
        '~': ' ',
        '?': ' ',
        '|': ' ',
        '/': ' ',
        '\\': ' ',
        '`': ' ',
    }
)


def sanitize_falkor_fulltext_query(query: str) -> str:
    """Replace FalkorDB special characters with whitespace."""
    return ' '.join(query.translate(_SEPARATOR_MAP).split())


def _escape_fulltext_group_id(group_id: str) -> str:
    """Escape a validated group ID for RediSearch fulltext syntax."""
    return re.sub(r'([^a-zA-Z0-9])', r'\\\1', group_id)


def build_falkor_fulltext_query(
    query: str,
    group_ids: list[str] | None = None,
    max_query_length: int = MAX_QUERY_LENGTH,
) -> str:
    """Build a FalkorDB RedisSearch fulltext query."""
    validate_group_ids(group_ids)

    group_filter = ''
    if group_ids:
        escaped_group_ids = [f'"{_escape_fulltext_group_id(group_id)}"' for group_id in group_ids]
        group_filter = f'(@group_id:{"|".join(escaped_group_ids)})'

    filtered_words = [
        word
        for word in sanitize_falkor_fulltext_query(query).split()
        if word.lower() not in STOPWORDS
    ]
    if not filtered_words:
        return ''

    sanitized_query = ' | '.join(filtered_words)
    if len(sanitized_query.split(' ')) + len(group_ids or []) >= max_query_length:
        return ''

    return f'{group_filter} ({sanitized_query})'

```

### Core Architecture Module: `graphiti_core/driver/falkordb/operations/__init__.py`
```
"""
Copyright 2024, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

from graphiti_core.driver.falkordb.operations.community_edge_ops import (
    FalkorCommunityEdgeOperations,
)
from graphiti_core.driver.falkordb.operations.community_node_ops import (
    FalkorCommunityNodeOperations,
)
from graphiti_core.driver.falkordb.operations.entity_edge_ops import FalkorEntityEdgeOperations
from graphiti_core.driver.falkordb.operations.entity_node_ops import FalkorEntityNodeOperations
from graphiti_core.driver.falkordb.operations.episode_node_ops import FalkorEpisodeNodeOperations
from graphiti_core.driver.falkordb.operations.episodic_edge_ops import FalkorEpisodicEdgeOperations
from graphiti_core.driver.falkordb.operations.graph_ops import FalkorGraphMaintenanceOperations
from graphiti_core.driver.falkordb.operations.has_episode_edge_ops import (
    FalkorHasEpisodeEdgeOperations,
)
from graphiti_core.driver.falkordb.operations.next_episode_edge_ops import (
    FalkorNextEpisodeEdgeOperations,
)
from graphiti_core.driver.falkordb.operations.saga_node_ops import FalkorSagaNodeOperations
from graphiti_core.driver.falkordb.operations.search_ops import FalkorSearchOperations

__all__ = [
    'FalkorEntityNodeOperations',
    'FalkorEpisodeNodeOperations',
    'FalkorCommunityNodeOperations',
    'FalkorSagaNodeOperations',
    'FalkorEntityEdgeOperations',
    'FalkorEpisodicEdgeOperations',
    'FalkorCommunityEdgeOperations',
    'FalkorHasEpisodeEdgeOperations',
    'FalkorNextEpisodeEdgeOperations',
    'FalkorSearchOperations',
    'FalkorGraphMaintenanceOperations',
]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1955** (2026-10-05): **fix: honour an explicit overlap_tokens=0 in content chunking**
  *Symptoms*: Fixes #1951  The three chunking entry points resolved their default with `overlap_tokens or CHUNK_OVERLAP_TOKENS` : an explicit `0` is falsy so it was replaced by the default and the caller silently got overlapping chunks  What hid it is the other half : `CHUNK_OVERLAP_TOKENS` comes from `os.getenv` at `helpers.py:46` so `None or 0` evaluates to `0` and `CHUNK_OVERLAP_TOKENS=0` in the environment already worked The same setting was honoured through one route and ignored through the other : passing `0` gave 6 chunks or 2 depending on an environment variable the caller does not control  Three lines : `content_chunking.py:234` `:394` and `:570` now resolve the default with an explicit `is None` test `chunk_size_tokens` on the line above keeps its `or` : a zero chunk size is not a meaningful setting while a zero overlap is  ## Type of change  - [x] Bug fix - [ ] Feature (linked Feature issue already has `rfc-approved`) - [ ] Documentation - [ ] Maintenance or refactor  ## Related issue  Fixes #1951  ## Design approval  - [x] This is not a feature pull request. - [ ] The linked Feature issue has the `rfc-approved` label after discussion with the Graphiti team.  ## Testing  - [x] Tests were added or updated for behavior changes. - [ ] `make check` passes. - [ ] Tests are not applicable; the reason is explained below.  One test added to the existing `TestChunkOverlap` class : it runs both routes and asserts they agree  ``` $ pytest tests/utils/test
  **Post-Mortem & Fix Analysis**:
  > All contributors have signed the CLA  ✍️ ✅<br/><sub>Posted by the ****CLA Assistant Lite bot****.</sub>
  > I have read the CLA Document and I hereby sign the CLA behalf on myself, e-mail: ayoub.hammoudi05@gmail.com
  > Closing in favour of #1952 : same fix and it now carries the two-route assertion as well so there is no reason to keep two open  The bug is in #1951 if anyone needs the context

- **Issue #1763** (2026-08-21): **[BUG] Node attributes are silently cleared when no entity type applies to the node**
  *Symptoms*: ## Bug Description `extract_attributes_from_nodes` assigns `node.attributes = attributes` unconditionally (`graphiti_core/utils/maintenance/node_operations.py:763-764`), and `_extract_entity_attributes` returns a bare `{}` whenever no entity type applies to the node (`:790-791`):  ```python if entity_type is None or len(entity_type.model_fields) == 0:     return {} ```  For a node that deduplicates onto an existing stored node, that empty dict replaces attributes a previous typed pass had extracted. The loss reaches storage:  - The resolved node **is** the database node — `_promote_resolved_node` returns the existing   candidate (`dedup_helpers.py:177/181`), and `get_entity_node_from_record` populates `attributes`   from the record (`nodes.py:1052-1054`). - `get_entity_node_save_query` replaces attributes wholesale — `SET n = $entity_data` for   Neo4j/FalkorDB/Neptune, `n.attributes = $attributes` for Kuzu (`node_db_queries.py:137`).  Provider-agnostic; not specific to any backend.  ## Steps to Reproduce Two paths reach the early return. Either is enough:  ```python from pydantic import BaseModel  class Person(BaseModel):     age: int | None = None     city: str | None = None  # 1. A node's attributes are populated by a typed pass. await graphiti.add_episode(..., entity_types={'Person': Person})  # 2a. A later episode omits entity_types entirely — the same node dedups and is wiped. await graphiti.add_episode(..., entity_types=None)  # 2b. Or entity_types is supplied but lacks

- **Issue #1716** (2026-09-21): **[BUG] graph-service all API endpoints lack authentication allowing remote graph wipe and cross-tenant access**
  *Symptoms*: ## Vulnerability type - [x] Incorrect Access Control  ## CWE CWE-306 Missing Authentication for Critical Function  ## Vendor of the product(s) Zep AI (getzep)  ## Affected product(s)/code base ### Product graphiti graph-service (server/graph_service)  ### Version main (to be confirmed)  ## Attack type - [x] Remote  ## Impact - [x] Information Disclosure - [x] Denial of Service - Other impact detail: Unauthenticated deletion and overwrite of graph data across tenants - data integrity loss.  ## Affected component(s) server/graph_service FastAPI app - all endpoints in routers/ingest.py (POST /messages, /entity-node, DELETE /entity-edge/{uuid}, /group/{group_id}, /episode/{uuid}, POST /clear) and routers/retrieve.py (POST /search, GET /entity-edge/{uuid}, /episodes/{group_id}, POST /get-memory); backend graph DB via clear_data.  ## Core vulnerable code path Unauthenticated HTTP request -> FastAPI app without auth middleware (server/graph_service/main.py:20-29) -> route handler -> POST /clear -> clear_data(driver) -> 'MATCH (n) DETACH DELETE n' (graph_data_operations.py:34-44); DELETE /group/{group_id} -> ZepGraphiti.delete_group (zep_graphiti.py:46-64); POST /search with arbitrary group_ids -> graphiti.search (no ownership check); POST /messages with attacker-controlled uuid -> EpisodicNode.save MERGE (n:Episodic {uuid: $uuid}).  Core vulnerable code path:  ```python # server/graph_service/main.py:20-29 app = FastAPI(lifespan=lifespan)   app.include_router(retrieve.router) app.in
  **Post-Mortem & Fix Analysis**:
  > I can take a focused hardening PR, but the default policy is a release/security-contract decision, so I want to confirm the boundary before changing deployment behavior.  Proposed scope: - Add a `GRAPH_SERVICE_API_KEY` setting and one app-level dependency covering both existing routers, using `Authorization: Bearer <key>` plus `secrets.compare_digest`. - Keep only the liveness endpoint unauthenticated; every data-bearing route, including `/clear`, requires the dependency. - Make the service fail closed at startup when no key is configured, with an explicit `GRAPH_SERVICE_ALLOW_INSECURE_NO_AUTH=1` escape hatch for local development/test deployments. This avoids silently retaining the vulnerable default while preserving an intentional opt-in for isolated environments. - Document the required container environment variable and add FastAPI tests for missing, wrong, and correct credentials, plus the explicit insecure-development opt-in.  I would not attempt tenant ownership/authorization in
  > > confirm  @zrh805 Thank you very much for your prompt and thorough analysis!  I completely agree with the proposed mitigation strategy, especially the decision to default to requiring an API key with an explicit opt-out for development. This is the most secure and responsible approach to fix this vulnerability.  Your proposed scope also makes perfect sense:  1. Using GRAPH_SERVICE_API_KEY with Bearer Token auth correctly establishes the missing trust boundary. 2. Protecting all data-bearing routes while leaving only the liveness endpoint open is clean and effective. 3. The explicit GRAPH_SERVICE_ALLOW_INSECURE_NO_AUTH=1 escape hatch, combined with a fail-closed default, is a very robust design.  I have no additional findings at this point. Your plan already covers all the attack vectors I identified.  Thanks again for your quick and professional handling! I'd be happy to test the PR or provide any further information if needed. 
  > Thanks for submitting this issue! Graphiti is not intended to be run fully available on the public internet; it is up to the person hosting Graphiti to protect it (whether that be with authentication they provide, a firewall, or other means they deem appropriate). I'll close this issue.

- **Issue #1662** (2026-07-27): **[BUG] : EntityEdge.get_by_node_uuid returns swapped source/target when queried from the target side**
  *Symptoms*:   ## Bug Description    `EntityEdge.get_by_node_uuid` returns `source_node_uuid` and `target_node_uuid` swapped relative to the stored   relationship direction, whenever the queried node is the relationship's actual target. The same class of bug affects   `edge_bfs_search`.    ## Steps to Reproduce    ```python   from datetime import datetime   from graphiti_core.edges import EntityEdge   from graphiti_core.nodes import EntityNode    # Two entity nodes   alice = EntityNode(name='Alice', group_id='g', summary='alice', created_at=datetime.now())   bob = EntityNode(name='Bob', group_id='g', summary='bob', created_at=datetime.now())   await alice.save(driver)   await bob.save(driver)    # Edge with explicit direction: alice -> bob   edge = EntityEdge(       source_node_uuid=alice.uuid,       target_node_uuid=bob.uuid,       name='likes',       fact='Alice likes Bob',       episodes=[],       created_at=datetime.now(),       group_id='g',   )   await edge.save(driver)    # Query from the TARGET side   retrieved = await EntityEdge.get_by_node_uuid(driver, bob.uuid)   print(retrieved[0].source_node_uuid)  # actual:   bob.uuid   (the queried node)   print(retrieved[0].target_node_uuid)  # actual:   alice.uuid    Expected Behavior    The returned edge should preserve the stored relationship direction:   - source_node_uuid == alice.uuid   - target_node_uuid == bob.uuid    Actual Behavior    The returned edge has its direction reversed:   - source_node_uuid == bob.uuid (the queried node

- **Issue #1642** (2026-08-12): **[BUG] Cross-encoder reranking drops most candidates in edge_search**
  *Symptoms*: ## Description  In `edge_search`, the retrieval stage collects candidates from multiple search methods (`bm25`, `cosine_similarity`, `bfs`) with `2 * limit` candidates each.  However, when using `EdgeReranker.cross_encoder`, only the first `limit` candidates from the merged candidate set are passed to the reranker:  ```python fact_to_uuid_map = {     edge.fact: edge.uuid for edge in list(edge_uuid_map.values())[:limit] } ```  This causes most retrieved candidates to be discarded before reranking.  ## Example  Assume:  ```python limit = 20 ```  With three enabled search methods:  * BM25: 40 candidates * Vector similarity: 40 candidates * BFS: 40 candidates  The search stage can produce up to 120 candidates.  But cross-encoder only evaluates:  ```python edge_uuid_map.values()[:20] ```  The remaining candidates are never scored.  Because `edge_uuid_map` preserves insertion order, candidates from later search methods may be completely excluded depending on the order of `search_results`.  ## Impact  * Hybrid search recall is reduced. * Candidates retrieved by vector search or BFS may never reach the reranker. * Cross-encoder ranking quality becomes dependent on retrieval method ordering.  ## Suggested Fix  Separate the reranker candidate limit from the final result limit.  For example:  candidate_limit = config.cross_encoder_candidate_limit  candidate_edges = list(edge_uuid_map.values())[:candidate_limit]  fact_to_uuid_map = {     edge.fact: edge.uuid     for edge in candidate_edg
  **Post-Mortem & Fix Analysis**:
  > I’m interested in working on this issue.  Before opening a PR, I’d like to confirm the preferred scope. Would you prefer a minimal fix that increases the candidate pool passed to the cross-encoder, for example via a separate `cross_encoder_candidate_limit`, or a balanced merge strategy across retrieval methods before reranking?  I can keep the PR focused and include tests that verify candidates from later retrieval methods are not dropped before cross-encoder reranking.
  > Thank you very much for contributing to the Graphiti project. I've merged a change to use RRF before running cross-encoding. I've also increased the candidate limit by 2x  See PR for more details: #1754 

- **Issue #1481** (2026-09-01): **[BUG] Database Parameter Not Honored in Neo4jDriver.execute_query()**
  *Symptoms*: Even with custom initialization of the driver, the issue persists. Write operations work correctly, but during queries, the database parameter is still not passed to the underlying Neo4j connector.  **Reason:**  `Neo4jDriver.execute_query()` incorrectly puts `database_` into `parameters_` (treating it as a Cypher query parameter `$database_`), rather than passing it as a Neo4j connection parameter. As a result, search queries actually run on the default database instead of the target database.  In contrast, `add_episode` uses the `transaction()` / `session()` method for write operations, which correctly passes `database=self._database`. Therefore, data is written to the correct database.  **Root Cause:**  `Neo4jDriver.execute_query()` places `database_` inside `parameters_` — the position intended for Cypher query parameters:  ```python # Original code (with bug) params.setdefault('database_', self._database)          # ← becomes $database_ query parameter result = await self.client.execute_query(cypher, parameters_=params, **kwargs) ```  This means that no target database is specified at the connection level, causing the Neo4j driver to default to the server’s default database (`neo4j`).  **Why is `add_episode` not affected?**   Because write operations use the `transaction()` method:  ```python # transaction() — passes database correctly async with self.client.session(database=self._database) as session: ```  Data is correctly written to the target database, but search quer
  **Post-Mortem & Fix Analysis**:
  > Verified the diagnosis against current `main` and the installed neo4j driver. The bug is exactly as described.  **Cross-driver signature proof (neo4j 6.1.0):**  ``` AsyncGraphDatabase.driver(...).execute_query(     query_,     parameters_: dict | None = None,     routing_: ...,     database_: str | None = None,        # ← connection-level, trailing-underscore     impersonated_user_: ...,     ... ) ```  So `database_` is a top-level keyword argument, not a Cypher parameter. The current code  ```python params.setdefault('database_', self._database) result = await self.client.execute_query(cypher_query_, parameters_=params, **kwargs) ```  injects `database_` into `parameters_`, where the driver hands it to the query as `$database_` (which is unused by every graphiti Cypher) and leaves the real connection-level `database_=None` — so the driver falls back to the server default. `transaction()` is unaffected because it opens `client.session(database=self._database)` directly, which is why wr
  > Thanks for contributing to Graphiti and for diagnosing this.   We’ve shipped the fix in graphiti-core v0.30.1 and MCP v1.1.0: `database_` is now passed as a Neo4j connection argument, and the MCP server honors `NEO4J_DATABASE`.  Please note:  - If your server’s home database is not named `neo4j` and you don’t pass `database` to the driver, queries now target `neo4j` instead of your home database — pass your database name explicitly to keep the old behavior. - If you configured a custom database, reads now correctly target it. Data previously written via `execute_query` may reside in your home database and may need to be migrated.

- **Issue #1425** (2026-09-06): **[BUG] hypens "-" in title silently fails with syntax error while processing episode from the graphiti mcp server**
  *Symptoms*: ## Bug Description ``` graphiti-mcp-1  | 2026-04-20 22:15:42 - httpx - INFO - HTTP Request: POST http://10.103.17.13:5000/v1/embeddings "HTTP/1.1 200 OK" graphiti-mcp-1  | 2026-04-20 22:15:42 - graphiti_core.driver.falkordb_driver - ERROR - Error executing FalkorDB query: RediSearch: Syntax error at offset 16 near jira graphiti-mcp-1  | CALL db.idx.fulltext.queryNodes('Entity', $query)YIELD node AS n, score WHERE n.group_id IN $group_ids graphiti-mcp-1  |             WITH n, score graphiti-mcp-1  |             ORDER BY score DESC graphiti-mcp-1  |             LIMIT $limit graphiti-mcp-1  |             RETURN graphiti-mcp-1  | graphiti-mcp-1  |         n.uuid AS uuid, graphiti-mcp-1  |         n.name AS name, graphiti-mcp-1  |         n.group_id AS group_id, graphiti-mcp-1  |         n.created_at AS created_at, graphiti-mcp-1  |         n.summary AS summary, graphiti-mcp-1  |         labels(n) AS labels, graphiti-mcp-1  |         properties(n) AS attributes graphiti-mcp-1  | graphiti-mcp-1  | {'query': '(@group_id:"jira-summary") (Samuel | Wycliffe)', 'limit': 20, 'routing_': 'r', 'group_ids': ['jira-summary']} ```  ## Steps to Reproduce Simply tell it to write user-profile details or jira summary as I did.  ## Expected Behavior I expected to see my nodes, with my details.  ## Actual Behavior The mcp call itself succeeded, but I was not able to see my nodes in FalkorDB UI. Digging into the logs I found the syntax error traceback shown above.  ## Environment - **Graphiti Versio
  **Post-Mortem & Fix Analysis**:
  > I am taking this issue. I will add focused escaping for FalkorDB full text group filters and regression coverage for hyphenated group IDs.
  > I confirmed current main already escapes hyphenated FalkorDB group IDs, so this report is resolved by existing code and I will not open a duplicate PR.
  > Thanks

- **Issue #1342** (2026-09-08): **[BUG]  `episode_mentions_reranker` sorts nodes ascending (fewest mentions first)**
  *Symptoms*: ## Bug Description `episode_mentions_reranker` in `graphiti_core/search/search_utils.py` sorts nodes in ascending order of mention count, so nodes mentioned in the fewest episodes rank highest. This is the opposite of what the reranker name implies and what the equivalent edge reranker does.  ## Steps to Reproduce Provide a minimal code example that reproduces the issue:  ```python from collections import defaultdict                                                          def rrf(results, rank_const=1, min_score=0):     scores = defaultdict(float)     for result in results:         for i, uuid in enumerate(result):             scores[uuid] += 1 / (i + rank_const)                                                             sorted_uuids = sorted(scores.keys(), key=lambda u: scores[u], reverse=True)     return (                                                                                                     [u for u in sorted_uuids if scores[u] >= min_score],                                                   [scores[u] for u in sorted_uuids if scores[u] >= min_score],                                         )                                                                                                   # Simulate episode_mentions_reranker with mocked DB counts                                               def simulate_reranker(node_uuid_lists, db_mention_counts):     sorted_uuids, _ = rrf(node_uuid_lists)                                                                   s
  **Post-Mortem & Fix Analysis**:
  > Fix in #1344.
  > Hi, I've been looking into this and traced the root cause.  **Proposed approach:** In graphiti_core/search/search_utils.py, change the episode_mentions_reranker function: (1) replace float('inf') default score with 0, (2) add reverse=True to sorted_uuids.sort(), (3) fix the copy-pasted comment. Then extend test_episode_mentions_reranker in tests/utils/search/search_utils_test.py to include two nodes with positive mention counts and assert the higher-mention node ranks first.  I'll open a draft PR shortly. Happy to adjust based on your preference.

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

### Incident Patch 1: `6b4b56ff` (2026-09-27)
**Commit Message**: @iuiu-py has signed the CLA in getzep/graphiti#1905

**File**: `signatures/version1/cla.json` (modified, +10/-0)
```diff
@@ -1625,6 +1625,16 @@
       "created_at": "2026-09-24T13:06:07Z",
       "repoId": 840056306,
       "pullRequestNo": 1917
+    },
+    {
+      "name": "iuiu-py",
+      "email": "wangzifei@cit.group.hk",
+      "accountType": "personal",
+      "id": 92971770,
+      "comment_id": 5787430943,
+      "created_at": "2026-09-23T01:33:39Z",
+      "repoId": 840056306,
+      "pullRequestNo": 1905
     }
   ]
 }
\ No newline at end of file
```

---

### Incident Patch 2: `16cdf704` (2026-09-21)
**Commit Message**: Add contributor guidelines and an intake bot for issues and pull requests (#1902)

* Add issue forms and a classify-then-apply intake bot.

Route reports through structured GitHub forms, then classify with a read-only model job and apply only allowlisted labels and templated comments.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* Update contribution guidelines and issue templates to clarify submission process

- Enhanced the CONTRIBUTING.md file to emphasize the importance of linking pull requests to existing issues and obtaining design approval for feature work.
- Updated pull request template to require a linked issue and highlight the need for prior discussion with the Graphiti team for feature requests.
- Revised issue templates to guide users on reporting bugs, proposing features, and asking questions, ensuring they follow the updated contribution guidelines.
- Changed label naming conventions from 'area/*' to 'scope:*' for better clarity in categorizing issues and pull requests.
- Adjusted intake bot logic and tests to align with the new labeling system and submission requirements.

These changes aim to streamline the contribution process and improve communication within the 

**File**: `.github/ISSUE_TEMPLATE/01-bug.yml` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+name: Bug
+description: Report reproducible behavior that differs from expected Graphiti behavior
+title: "[Bug] "
+labels:
+  - bug
+body:
+  - type: markdown
+    attributes:
+      value: |
+        Thanks for reporting a problem. Please read
+        [Reporting a bug](https://github.com/getzep/graphiti/blob/main/CONTRIBUTING.md#reporting-a-bug)
+        before you file: the fastest fixes start with a reproduction someone else can run.
+        Reports missing a usable reproduction or environment details get labeled `needs-info`
+        and wait until you can add them.
+
+        Please remove credentials, private data, and other secrets. For security vulnerabilities,
+        stop and use [private reporting](https://github.com/getzep/graphiti/security/advisories/new).
+  - type: checkboxes
+    id: existing-issues
+    attributes:
+      label: Before you file
+      options:
+        - label: I searched existing issues and did not find a duplicate.
+          required: true
+        - label: I read the [contributing guide](https://github.com/getzep/graphiti/blob/main/CONTRIBUTING.md#reporting-a-bug) and included a minimal reproduction.
+          required: true
+  - type: dropdown
+    id: component
+    attributes:
+      label: Affected component
+      options:
+        - graphiti-core
+        - MCP server
+        - REST server
+        - Documentation or examples
+        - CI, Docker, or release
+        - Other
+    validations:
+      required: true
+  - type: textarea
+    id: description
+    attributes:
+      label: Bug description
+      description: What were you trying to do, and what happened?
+    validations:
+      required: true
+  - type: textarea
+    id: reproduction
+    attributes:
+      label: Minimal reproduction
+      description: Provide a self-contained example or test case that demonstrates the problem.
+      render: python
+    validations:
+      required: true
+  - type: textarea
+    id: expected
+    attributes:
+      label: Expected behavior
+    validations:
+      required: true
+  - type: textarea
+    id: actual
+    attributes:
+      label: Actual behavior
+    validations:
+      required: true
+  - type: textarea
+    id: environment
+    attributes:
+      label: Environment
+      description: |
+        Include Graphiti version or commit, Python version, operating system, installation method,
+        database backend and version, and relevant LLM, embedding, or reranking provider/model.
+      placeholder: |
+        Graphiti:
+        Python:
+        OS:
+        Installation:
+        Database:
+        Model providers:
+    validations:
+      required: true
+  - type: textarea
+    id: logs
+    attributes:
+      label: Logs or traceback
+      description: Paste the complete relevant output. Remove secrets and private data.
+      render: shell
```

**File**: `.github/ISSUE_TEMPLATE/02-feature.yml` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+name: Feature
+description: Propose new functionality or an improvement to existing behavior
+title: "[Feature] "
+labels:
+  - feature
+body:
+  - type: markdown
+    attributes:
+      value: |
+        Start with the user problem. Please read
+        [Proposing a feature](https://github.com/getzep/graphiti/blob/main/CONTRIBUTING.md#proposing-a-feature)
+        before you file.
+
+        **Do not open an implementation pull request yet.** Feature work needs a discussion with
+        the Graphiti team on this issue and explicit approval (`rfc-approved`) first. A feature
+        PR opened without that approval is flagged, not reviewed, and is closed after 14 days
+        if the gap is still there. A correctly approved, linked PR is not auto-closed.
+
+        Use this issue as the design discussion. Fill in proposal, alternatives, and impact,
+        especially for a new driver, model provider, public API, major architecture change, or
+        a change likely over 500 lines.
+  - type: checkboxes
+    id: existing-issues
+    attributes:
+      label: Before you file
+      options:
+        - label: I searched existing issues and did not find an existing proposal.
+          required: true
+        - label: I read the [contributing guide](https://github.com/getzep/graphiti/blob/main/CONTRIBUTING.md#proposing-a-feature) and will not open a feature pull request until the Graphiti team has discussed this issue and added `rfc-approved`.
+          required: true
+  - type: dropdown
+    id: component
+    attributes:
+      label: Affected component
+      options:
+        - graphiti-core
+        - MCP server
+        - REST server
+        - Documentation or examples
+        - CI, Docker, or release
+        - Multiple components
+        - Other
+    validations:
+      required: true
+  - type: dropdown
+    id: size
+    attributes:
+      label: Size
+      description: Select large if this adds a driver, provider, API, architecture change, or likely exceeds 500 lines.
+      options:
+        - Small improvement to existing behavior
+        - Large feature requiring design approval
+        - Unsure
+    validations:
+      required: true
+  - type: textarea
+    id: problem
+    attributes:
+      label: User problem
+      description: What are you trying to accomplish, and what is blocking you today?
+    validations:
+      required: true
+  - type: textarea
+    id: outcome
+    attributes:
+      label: Desired outcome
+      description: Describe the behavior or capability that would solve the problem.
+    validations:
+      required: true
+  - type: textarea
+    id: proposal
+    attributes:
+      label: Proposed design
+      description: Required for large features. Describe the public API, data flow, and important implementation choices.
+  - type: textarea
+    id: alternatives
+    attributes:
+      label: Alternatives considered
+      description: Required for large features. Include existing workarounds and why they are insufficient.
+  - type: textarea
+    id: impact
+    attributes:
+      label: Compatibility and operational impact
+      description: Required for large features. Cover breaking changes, migrations, dependencies, performance, and deployment impact.
```

**File**: `.github/ISSUE_TEMPLATE/03-docs.yml` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+name: Documentation
+description: Report incorrect, unclear, or missing documentation
+title: "[Docs] "
+labels:
+  - documentation
+body:
+  - type: markdown
+    attributes:
+      value: |
+        Thanks for helping us improve the docs. See the
+        [contributing guide](https://github.com/getzep/graphiti/blob/main/CONTRIBUTING.md#where-to-start)
+        for how documentation issues are handled. Point us at the exact page or file so we can
+        fix the right thing.
+  - type: checkboxes
+    id: existing-issues
+    attributes:
+      label: Before you file
+      options:
+        - label: I searched existing issues and did not find a duplicate.
+          required: true
+  - type: input
+    id: location
+    attributes:
+      label: Documentation location
+      description: Link to the page or provide the repository path.
+      placeholder: https://help.getzep.com/graphiti/... or path/to/file.md
+    validations:
+      required: true
+  - type: dropdown
+    id: problem-type
+    attributes:
+      label: Problem type
+      options:
+        - Incorrect information
+        - Unclear explanation
+        - Missing documentation
+        - Broken example or link
+        - Other
+    validations:
+      required: true
+  - type: textarea
+    id: problem
+    attributes:
+      label: What needs to change?
+      description: Explain what is wrong, confusing, or missing.
+    validations:
+      required: true
+  - type: textarea
+    id: suggestion
+    attributes:
+      label: Suggested improvement
+      description: Optional wording, examples, or references that could improve the documentation.
```

**File**: `.github/ISSUE_TEMPLATE/04-question.yml` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+name: Question
+description: Ask for help understanding or using Graphiti
+title: "[Question] "
+labels:
+  - question
+body:
+  - type: markdown
+    attributes:
+      value: |
+        Questions are welcome. Provide enough context for the community to understand your setup —
+        the [contributing guide](https://github.com/getzep/graphiti/blob/main/CONTRIBUTING.md#where-to-start)
+        explains what helps us answer quickly. If it turns out to be a bug, we will ask you to
+        open a bug report with a reproduction.
+
+        Remove credentials, private data, and other secrets.
+  - type: checkboxes
+    id: existing-issues
+    attributes:
+      label: Before you ask
+      options:
+        - label: I searched the documentation and existing issues before asking.
+          required: true
+  - type: dropdown
+    id: component
+    attributes:
+      label: Component
+      options:
+        - graphiti-core
+        - MCP server
+        - REST server
+        - Documentation or examples
+        - CI, Docker, or release
+        - General usage or architecture
+        - Other
+    validations:
+      required: true
+  - type: textarea
+    id: goal
+    attributes:
+      label: What are you trying to accomplish?
+    validations:
+      required: true
+  - type: textarea
+    id: attempted
+    attributes:
+      label: What have you tried?
+      description: Include relevant code, documentation, and errors.
+    validations:
+      required: true
+  - type: textarea
+    id: environment
+    attributes:
+      label: Environment
+      description: Include Graphiti version, Python version, database backend, and relevant model providers.
+    validations:
+      required: true
```

**File**: `.github/ISSUE_TEMPLATE/bug_report.md` (removed, +0/-54)
```diff
@@ -1,54 +0,0 @@
----
-name: Bug Report
-about: Create a report to help us improve Graphiti
-title: '[BUG] '
-labels: bug
-assignees: ''
----
-
-## Bug Description
-A clear and concise description of what the bug is.
-
-## Steps to Reproduce
-Provide a minimal code example that reproduces the issue:
-
-```python
-# Your code here
-```
-
-## Expected Behavior
-A clear and concise description of what you expected to happen.
-
-## Actual Behavior
-A clear and concise description of what actually happened.
-
-## Environment
-- **Graphiti Version**: [e.g. 0.15.1]
-- **Python Version**: [e.g. 3.11.5]
-- **Operating System**: [e.g. macOS 14.0, Ubuntu 22.04]
-- **Database Backend**: [e.g. Neo4j 5.26, FalkorDB 1.1.2]
-- **LLM Provider & Model**: [e.g. OpenAI gpt-4.1, Anthropic claude-4-sonnet, Google gemini-2.5-flash]
-
-## Installation Method
-- [ ] pip install
-- [ ] uv add
-- [ ] Development installation (git clone)
-
-## Error Messages/Traceback
-```
-Paste the full error message and traceback here
-```
-
-## Configuration
-```python
-# Relevant configuration or initialization code
-```
-
-## Additional Context
-- Does this happen consistently or intermittently?
-- Which component are you using? (core library, REST server, MCP server)
-- Any recent changes to your environment?
-- Related issues or similar problems you've encountered?
-
-## Possible Solution
-If you have ideas about what might be causing the issue or how to fix it, please share them here.
\ No newline at end of file
```

**File**: `.github/ISSUE_TEMPLATE/config.yml` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+blank_issues_enabled: false
+contact_links:
+  - name: Report a security vulnerability (private)
+    url: https://github.com/getzep/graphiti/security/advisories/new
+    about: Do not open a public issue for security problems. Disclose privately here and a maintainer will follow up.
+  - name: Contributing guide
+    url: https://github.com/getzep/graphiti/blob/main/CONTRIBUTING.md
+    about: Read this first. File an issue before any PR. Feature work needs team discussion and approval. Only incomplete items auto-close after 14 days.
+  - name: Documentation
+    url: https://help.getzep.com/graphiti/graphiti/overview
+    about: Check the docs before filing. Many questions are answered there.
```

**File**: `.github/intake/README.md` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+# Issue / PR intake automation
+
+A fully deterministic triage bot for issues and pull requests. `decide.py`
+fetches the item through the GitHub API and computes a decision from objective
+facts only — the issue-form sections, the labels the forms apply, the changed
+file paths, and the `Fixes #<number>` references in the body. `apply.py` turns
+that decision into allowlisted labels and one templated "sticky" comment. No
+LLM is involved and no API key secret is needed: both scripts run on the
+standard `GITHUB_TOKEN` and the Python standard library alone.
+
+## One-time setup
+
+1. **Create the labels** (required before the issue forms or bot run — GitHub
+   silently drops form labels that do not exist):
+
+   ```bash
+   bash .github/scripts/setup-triage-labels.sh
+   ```
+
+2. **(Optional) repository variable** to disable intake without editing code:
+
+   | Variable | Default | Purpose |
+   |----------|---------|---------|
+   | `INTAKE_ENABLED` | unset (enabled) | Set to `false` to disable all intake + stale workflows (kill switch). |
+
+## How it runs
+
+- **`.github/workflows/issue-intake.yml`** — on issue open/edit/reopen. One
+  job: `decide.py --kind issue` then `apply.py --write`.
+- **`.github/workflows/pr-intake.yml`** — on PR open/sync/reopen/edit, for
+  same-repo and fork branches. It uses `pull_request_target` so the token can
+  label fork PRs, checks out the base-branch scripts (never the PR's), and
+  reads the PR through the API, so it never runs PR-authored code.
+- **`.github/workflows/ai-moderator.yml`** — spam and AI-generated-content
+  detection for new issues and comments (the `github/ai-moderator` action).
+- **`.github/workflows/stale.yml`** — daily; warns then closes items that keep
+  any `needs-*` label (`needs-info`, `needs-issue`, `needs-rfc`, `needs-tests`,
+  `needs-rework`) for 14 days. `rfc-approved` and `security` items are exempt.
+
+Trusted authors (`OWNER`/`MEMBER` author association) and draft pull requests
+are skipped: `decide.py` writes the empty decision `{}`, which `apply.py`
+treats as a clean no-op.
+
+## Issue rules
+
+The issue forms (`.github/ISSUE_TEMPLATE/*.yml`) render into `### <Label>`
+sections in the body. A section counts as missing when it is absent, blank, or
+`_No response_`.
+
+- **`category`**: the first of `bug`, `feature`, `documentation`, `question`
+  already on the issue (the form sets it), else `other`.
+- **`areas`**: from the `Affected component` (or `Component`) dropdown —
+  `graphiti-core` → `scope:core`, `MCP server` → `scope:mcp`, `REST server` →
+  `scope:service`, `Documentation or examples` → `scope:docs`,
+  `CI, Docker, or release` → `scope:ci`. Other values and a missing section
+  give no scope; a `documentation` issue with no scope defaults to
+  `scope:docs`.
+- **Required sections** (missing ones produce `needs-info` and land in
+  `missing_fields`):
+
+  | Category | Required |
+  |----------|----------|
+  | bug | description, reproduction, expected, actual, environment |
+  | feature | problem, outcome |
+  | question | goal, attempted, environment |
+  | documentation | location, problem |
+
+- **`needs-rfc`**: a feature whose `Size` is `Large feature requiring design
+  approval` gets `needs-rfc` unless the issue already has `rfc-approved`, and
+  `proposal`/`alternatives`/`impact` become required as well.
+- **`comment_id`**: `ask_rfc_fields` when `needs-rfc`; `ask_repro` for a bug
+  missing fields; `ask_info` for anything else missing fields; else none.
+
+## Pull request rules
+
+- **`areas`**: derived from the changed file paths (see `PATH_SCOPE_RULES`).
+- **`needs-issue`**: no linked issue (`Fixes #<number>`) → `needs-issue` and
+  the `linked-issue` missing field. A number that 404s or resolves to a pull
+  request does not count.
+- **`category`**: `feature`/`bug`/`documentation` when a linked issue carries
+  that label, else `feature` when the template's Feature checkbox is ticked,
+  else `other`.
+- **`needs-rfc`**: a feature PR whose linked issue lacks `rfc-approved`.
+- **`needs-tests`**: the diff touches code but no test file, and the
+  `Tests are not applicable` checkbox is not ticked.
+- **`needs-rework`**: `needs-issue` and `needs-tests` together.
+- **`comment_id`**: `pr_needs_rework` > `pr_needs_rfc` > `pr_needs_tests`.
+
+## Files
+
+| File | Role |
+|------|------|
+| `decide.py` | Read-only: fetch item, compute the deterministic decision, write JSON. Stdlib only. |
+| `apply.py` | Deterministic: validate the decision, apply allowlisted labels + one templated sticky comment. Stdlib only. |
+| `decision.schema.json` | The decision contract and the **single source of truth** for the label taxonomy (apply.py derives its allowlist from it). |
+| `templates/*.md` | The only text the bot can post; substitutions come from closed sets. |
+
+Tests: `tests/intake/` (run by `unit_tests.yml`). The workflow guard tests in
+`test_workflows.py` encode the security invariants — keep th
```

**File**: `.github/intake/apply.py` (added, +547/-0)
```diff
@@ -0,0 +1,547 @@
+#!/usr/bin/env python3
+"""Intake apply layer.
+
+Takes a decision (JSON) and turns it into allowlisted labels plus a templated
+sticky comment. Never executes model text and never echoes an issue or pull
+request body. GitHub writes happen only when the CLI is explicitly given
+``--write`` and a write-scoped token.
+
+The deciding step (decide.py) emits decision.schema.json.
+This file is the only place that may turn a decision into GitHub-facing output.
+"""
+
+from __future__ import annotations
+
+import argparse
+import json
+import os
+import re
+import sys
+from collections.abc import Callable
+from dataclasses import asdict, dataclass
+from html import escape
+from pathlib import Path
+from typing import Any
+from urllib.error import HTTPError
+from urllib.parse import urlparse
+from urllib.request import Request, urlopen
+
+INTAKE_DIR = Path(__file__).resolve().parent
+SCHEMA_PATH = INTAKE_DIR / 'decision.schema.json'
+TEMPLATE_DIR = INTAKE_DIR / 'templates'
+STICKY_MARKER = '<!-- graphiti-intake-bot -->'
+# Must fit the widest legitimate item: a category, all five path-derived scope:*
+# labels, every needs-* flag, and duplicate — truncating those silently loses
+# signal, while the cap still bounds label spam from a hijacked decision.
+MAX_LABELS = 12
+MAX_COMMENT_CHARS = 4000
+MAX_SUBSTITUTION_CHARS = 80
+# Upper bound on comment pages scanned for the sticky marker; the loop also
+# stops on the first short page, so this only bounds pathological threads.
+MAX_COMMENT_PAGES = 50
+
+# Derived from the decision schema so it is the single source of truth for the
+# label taxonomy; the allowlist can never silently drift from the schema enum.
+_SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding='utf-8'))
+ALLOWLIST = frozenset(_SCHEMA['properties']['labels']['items']['enum'])
+BANNED_LABELS = frozenset(
+    {
+        'rfc-approved',
+        'good first issue',
+        'help wanted',
+        'triage/high',
+        'triage/medium',
+        'triage/low',
+        'triage/skip',
+        'wontfix',
+        'spam',
+        'ai-generated',
+    }
+)
+LABEL_ALIASES = {
+    'enhancement': 'feature',
+    'slop-detected': 'needs-rework',
+    'intake/needs-info': 'needs-info',
+    'area/core': 'scope:core',
+    'area/mcp': 'scope:mcp',
+    'area/server': 'scope:service',
+    'area/docs': 'scope:docs',
+}
+TYPE_LABELS = frozenset(_SCHEMA['properties']['category']['enum']) & ALLOWLIST
+LABEL_ORDER = (
+    'bug',
+    'feature',
+    'question',
+    'documentation',
+    'security',
+    'scope:core',
+    'scope:mcp',
+    'scope:service',
+    'scope:docs',
+    'scope:ci',
+    'needs-info',
+    'needs-issue',
+    'needs-rfc',
+    'needs-tests',
+    'needs-rework',
+    'duplicate',
+    'invalid',
+)
+MISSING_FIELD_COPY = {
+    'reproduction': 'a minimal reproduction script or test case',
+    'expected': 'expected behavior',
+    'actual': 'actual behavior',
+    'environment': 'environment details (versions, backend, models)',
+    'logs': 'relevant logs or traceback, with secrets removed',
+    'description': 'a short description of the problem',
+    'problem': 'the user problem this would solve',
+    'outcome': 'the desired outcome',
+    'goal': 'what you are trying to accomplish',
+    'attempted': 'what you tried and what happened',
+    'suggestion': 'a suggested improvement',
+    'proposal': 'a proposed design',
+    'alternatives': 'alternatives considered',
+    'impact': 'compatibility and operational impact',
+    'tests': 'tests for the behavior change',
+    'linked-issue': 'a linked issue (`Fixes #<number>`)',
+    'scope': 'a narrower, reviewable scope',
+    'location': 'a docs URL or repository path',
+}
+SECRET_RE = re.compile(r'(?:ghp_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|sk-[A-Za-z0-9_-]{8,})')
+URL_RE = re.compile(r'https?://[^\s)<>]+', re.IGNORECASE)
+# Host allowlist checked against the parsed hostname, never a string prefix — a
+# prefix check lets `https://help.getzep.com.evil.com/...` slip through.
+ALLOWED_LINK_HOSTS = frozenset({'github.com', 'getzep.com'})
+GITHUB_API = 'https://api.github.com'
+MANAGED_LABELS = ALLOWLIST | frozenset(LABEL_ALIASES)
+
+GitHubRequest = Callable[[str, str, str, object | None], object]
+
+
+@dataclass(frozen=True)
+class ApplyResult:
+    labels: tuple[str, ...]
+    comment: str | None
+    comment_id: str | None
+    dropped_labels: tuple[str, ...]
+    no_op: bool
+    sticky_marker: str = STICKY_MARKER
+
+    def to_dict(self) -> dict[str, Any]:
+        return asdict(self)
+
+
+@dataclass(frozen=True)
+class GitHubApplySummary:
+    labels_changed: bool
+    comment_action: str
+    no_op: bool = False
+
+    def to_dict(self) -> dict[str, Any]:
+        return asdict(self)
+
+
+def load_schema() -> dict[str, Any]:
+    return json.loads(SCHEMA_PATH.read_text(encoding='utf-8'))
+
+
+def _comment_ids(schema: dict[str, Any]) -> frozenset[str]:
+    variants = schema['properties']['comment_id']['one
```

---

### Incident Patch 3: `c035afb7` (2026-09-11)
**Commit Message**: Update mcp_server/uv.lock to fix httpx2/httpcore2 Dependabot alerts [ZEPAI-3570] (#1884)

**File**: `mcp_server/uv.lock` (modified, +64/-24)
```diff
@@ -199,7 +199,8 @@ name = "anthropic"
 version = "0.111.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "anyio" },
+    { name = "anyio", version = "4.14.2", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.14'" },
+    { name = "anyio", version = "4.15.1", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.14'" },
     { name = "distro" },
     { name = "docstring-parser" },
     { name = "httpx" },
@@ -217,17 +218,37 @@ wheels = [
 
 [[package]]
 name = "anyio"
-version = "4.9.0"
+version = "4.14.2"
 source = { registry = "https://pypi.org/simple" }
+resolution-markers = [
+    "python_full_version == '3.13.*'",
+    "python_full_version == '3.12.*'",
+    "python_full_version < '3.12'",
+]
 dependencies = [
-    { name = "exceptiongroup", marker = "python_full_version < '3.11'" },
+    { name = "exceptiongroup", marker = "python_full_version < '3.11' or python_full_version >= '3.14'" },
     { name = "idna" },
-    { name = "sniffio" },
-    { name = "typing-extensions", version = "4.14.0", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.13'" },
+    { name = "typing-extensions", version = "4.14.0", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version != '3.13.*'" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/61/cc/a381afa6efea9f496eff839d4a6a1aed3bfafc7b3ab4b0d1b243a12573dd/anyio-4.14.2.tar.gz", hash = "sha256:cfa139f3ed1a23ee8f88a145ddb5ac7605b8bbfd8592baacd7ce3d8bb4313c7f", size = 260176, upload-time = "2026-07-12T20:29:07.082Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/da/35/f2287558c17e29fafc8ef3daf819bb9834061cfa43bff8014f7df7f63bdc/anyio-4.14.2-py3-none-any.whl", hash = "sha256:9f505dda5ac9f0c8309b5e8bd445a8c2bf7246f3ce950121e45ea15bc41d1494", size = 125813, upload-time = "2026-07-12T20:29:05.763Z" },
+]
+
+[[package]]
+name = "anyio"
+version = "4.15.1"
+source = { registry = "https://pypi.org/simple" }
+resolution-markers = [
+    "python_full_version >= '3.14'",
+]
+dependencies = [
+    { name = "idna" },
+    { name = "typing-extensions", version = "4.16.0", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.15'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/95/7d/4c1bd541d4dffa1b52bd83fb8527089e097a106fc90b467a7313b105f840/anyio-4.9.0.tar.gz", hash = "sha256:673c0c244e15788651a4ff38710fea9675823028a6f08a5eda409e0c9840a028", size = 190949, upload-time = "2025-03-17T00:02:54.77Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/a9/d2/f4d173e22df740bc37b1db102b386ba719b66e95b0f0d751f556b387e6d2/anyio-4.15.1.tar.gz", hash = "sha256:9f28306018cbd6d329e64a36d58256edff76dd996fe423bc957326e578b82a94", size = 276966, upload-time = "2026-09-05T10:42:39.44Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/a1/ee/48ca1a7c89ffec8b6a0c5d02b89c305671d5ffd8d3c94acf8b8c408575bb/anyio-4.9.0-py3-none-any.whl", hash = "sha256:9f76d541cad6e36af7beb62e978876f3b41e3e04f2c1fbf0884604c0a9c4d93c", size = 100916, upload-time = "2025-03-17T00:02:52.713Z" },
+    { url = "https://files.pythonhosted.org/packages/12/b8/4bd346e22b28902df4d651910f5242c28d84e4a5c2435ca5c3f797ed7e2e/anyio-4.15.1-py3-none-any.whl", hash = "sha256:6152fdbbf9a77fdec97731721bebf7c4c44f7c29b424b0065826173efc7ed101", size = 132079, upload-time = "2026-09-05T10:42:37.923Z" },
 ]
 
 [[package]]
@@ -826,7 +847,8 @@ name = "google-genai"
 version = "2.8.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "anyio" },
+    { name = "anyio", version = "4.14.2", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.14'" },
+    { name = "anyio", version = "4.15.1", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.14'" },
     { name = "distro" },
     { name = "google-auth", extra = ["requests"] },
     { name = "httpx" },
@@ -873,7 +895,8 @@ name = "groq"
 version = "1.2.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "anyio" },
+    { name = "anyio", version = "4.14.2", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.14'" },
+    { name = "anyio", version = "4.15.1", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.14'" },
     { name = "distro" },
     { name = "httpx" },
     { name = "pydantic", version = "2.11.7", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.14'" },
@@ -943,23 +966,24 @@ wheels = [
 
 [[package]]
 name = "httpcore2"
-version = "2.6.0"
+version = "2.12.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "h11" },
     { name = "truststore" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/53/db/2ad49878b36af4cff7527c1158b083ad6d9350462f
```

---

### Incident Patch 4: `9efd61f5` (2026-09-11)
**Commit Message**: Update mcp_server/uv.lock to fix Dependabot alerts [ZEPAI-3570] (#1882)

* Update MCP server dependencies in uv lock [ZEPAI-3570]

* Trigger CLA check after allowlist update



---

### Incident Patch 5: `323bbe56` (2026-09-11)
**Commit Message**: Update root uv.lock to fix Dependabot alerts [ZEPAI-3570] (#1881)

* Update root dependencies in uv lock [ZEPAI-3570]

* Trigger CLA check after allowlist update



---

### Incident Patch 6: `3ff5c160` (2026-09-08)
**Commit Message**: Land contributor fixes from #1686 #1689 #1720 #1761 (#1856)

* fix FalkorDriver.convert_datetimes_to_strings TypeError on datetime values

* normalize datetimes to UTC in convert_datetimes_to_strings

* add unit tests for datetime param conversion fixes

* add integration test for episode retrieval with non-UTC valid_at

* stop persisting labels list as a node property in FalkorDB bulk save

* apply all entity labels in a single query in FalkorDB bulk save

* add integration test for FalkorDB bulk save labels handling

* fix: episode_mentions_reranker sorts ascending instead of descending

episode_mentions_reranker() in graphiti_core/search/search_utils.py
ranked nodes by mention count in ascending order, so entities mentioned
in the fewest episodes ranked first - the opposite of what the reranker's
name implies and the opposite of every other count-based reranker in the
codebase.

Root cause: the function queried MENTIONS edge counts (higher = more
central/relevant), assigned unmentioned nodes a float('inf') sentinel
(borrowed from a distance-based reranker convention, where "no path
found" correctly means "worst"), then sorted ascending. Under mention-
count semantics this is bac

**File**: `graphiti_core/driver/falkordb_driver.py` (modified, +3/-3)
```diff
@@ -70,7 +70,7 @@
 from graphiti_core.driver.operations.saga_node_ops import SagaNodeOperations
 from graphiti_core.driver.operations.search_ops import SearchOperations
 from graphiti_core.graph_queries import get_fulltext_indices, get_range_indices
-from graphiti_core.utils.datetime_utils import convert_datetimes_to_strings
+from graphiti_core.utils.datetime_utils import convert_datetimes_to_strings, ensure_utc
 
 logger = logging.getLogger(__name__)
 
@@ -360,8 +360,8 @@ def convert_datetimes_to_strings(obj):
             return [FalkorDriver.convert_datetimes_to_strings(item) for item in obj]
         elif isinstance(obj, tuple):
             return tuple(FalkorDriver.convert_datetimes_to_strings(item) for item in obj)
-        elif isinstance(obj, datetime):
-            return obj.isoformat()
+        elif isinstance(obj, datetime.datetime):
+            return ensure_utc(obj).isoformat()  # type: ignore[union-attr]
         else:
             return obj
 
```

**File**: `graphiti_core/graphiti.py` (modified, +4/-1)
```diff
@@ -377,7 +377,8 @@ async def _get_or_create_saga(
         records, _, _ = await driver.execute_query(
             """
             MATCH (s:Saga {name: $name, group_id: $group_id})
-            RETURN s.uuid AS uuid, s.name AS name, s.group_id AS group_id, s.created_at AS created_at
+            RETURN s.uuid AS uuid, s.name AS name, s.group_id AS group_id, s.created_at AS created_at,
+                   s.first_episode_uuid AS first_episode_uuid, s.last_episode_uuid AS last_episode_uuid
             """,
             name=saga_name,
             group_id=group_id,
@@ -391,6 +392,8 @@ async def _get_or_create_saga(
                 name=record['name'],
                 group_id=record['group_id'],
                 created_at=parse_db_date(record['created_at']),  # type: ignore
+                first_episode_uuid=record['first_episode_uuid'],
+                last_episode_uuid=record['last_episode_uuid'],
             )
 
         saga = SagaNode(name=saga_name, group_id=group_id, created_at=created_at)
```

**File**: `graphiti_core/models/nodes/node_db_queries.py` (modified, +18/-14)
```diff
@@ -201,21 +201,25 @@ def get_entity_node_save_bulk_query(
         case GraphProvider.FALKORDB:
             queries = []
             for node in nodes:
-                for label in node['labels']:
-                    queries.append(
-                        (
-                            f"""
-                            UNWIND $nodes AS node
-                            MERGE (n:Entity {{uuid: node.uuid}})
-                            SET n:{label}
-                            SET n = node
-                            WITH n, node
-                            SET n.name_embedding = vecf32(node.name_embedding)
-                            RETURN n.uuid AS uuid
-                            """,
-                            {'nodes': [node]},
-                        )
+                # Exclude the labels list so it is not persisted as a node property
+                # by `SET n = node`.
+                node_data = {k: v for k, v in node.items() if k != 'labels'}
+                # Apply all labels in a single query instead of one query per label.
+                label_expr = ':'.join(node['labels']) if node['labels'] else 'Entity'
+                queries.append(
+                    (
+                        f"""
+                        UNWIND $nodes AS node
+                        MERGE (n:Entity {{uuid: node.uuid}})
+                        SET n:{label_expr}
+                        SET n = node
+                        WITH n, node
+                        SET n.name_embedding = vecf32(node.name_embedding)
+                        RETURN n.uuid AS uuid
+                        """,
+                        {'nodes': [node_data]},
                     )
+                )
             return queries
         case GraphProvider.NEPTUNE:
             queries = []
```

**File**: `graphiti_core/search/search_utils.py` (modified, +9/-4)
```diff
@@ -1883,10 +1883,15 @@ async def episode_mentions_reranker(
 
     for uuid in sorted_uuids:
         if uuid not in scores:
-            scores[uuid] = float('inf')
-
-    # rerank on shortest distance
-    sorted_uuids.sort(key=lambda cur_uuid: scores[cur_uuid])
+            # Node has no MENTIONS edges at all - treat as zero mentions so it
+            # ranks last (descending sort below) and is excluded by any
+            # min_score > 0, instead of being (incorrectly) unfilterable.
+            scores[uuid] = 0
+
+    # rerank by descending mention count - nodes mentioned in the most
+    # episodes rank first, matching the reranker's name and the convention
+    # used by the other count-based rerankers.
+    sorted_uuids.sort(key=lambda cur_uuid: scores[cur_uuid], reverse=True)
 
     return [uuid for uuid in sorted_uuids if scores[uuid] >= min_score], [
         scores[uuid] for uuid in sorted_uuids if scores[uuid] >= min_score
```

**File**: `graphiti_core/utils/datetime_utils.py` (modified, +6/-1)
```diff
@@ -50,6 +50,11 @@ def convert_datetimes_to_strings(obj):
     elif isinstance(obj, tuple):
         return tuple(convert_datetimes_to_strings(item) for item in obj)
     elif isinstance(obj, datetime):
-        return obj.isoformat()
+        # Normalize to UTC before serializing. The resulting ISO strings are
+        # compared lexicographically by drivers that store datetimes as strings
+        # (e.g. FalkorDB), which is only correct when all offsets are identical.
+        utc_dt = ensure_utc(obj)
+        assert utc_dt is not None
+        return utc_dt.isoformat()
     else:
         return obj
```

**File**: `tests/driver/test_falkordb_driver.py` (modified, +133/-0)
```diff
@@ -400,6 +400,40 @@ def test_convert_other_types_unchanged(self):
         assert convert_datetimes_to_strings(None) is None
         assert convert_datetimes_to_strings(True) is True
 
+    @unittest.skipIf(not HAS_FALKORDB, 'FalkorDB is not installed')
+    def test_static_method_handles_datetime_values(self):
+        """FalkorDriver.convert_datetimes_to_strings must not raise on datetime values.
+
+        Regression test: isinstance() was called with the datetime module instead
+        of the datetime.datetime class, raising TypeError for any datetime input.
+        """
+        test_datetime = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
+
+        result = FalkorDriver.convert_datetimes_to_strings({'ts': test_datetime, 'n': 5})
+
+        assert result == {'ts': test_datetime.isoformat(), 'n': 5}
+
+    @unittest.skipIf(not HAS_FALKORDB, 'FalkorDB is not installed')
+    def test_convert_normalizes_non_utc_offsets(self):
+        """Non-UTC offsets must be normalized to UTC before serialization.
+
+        FalkorDB stores datetimes as ISO strings and compares them
+        lexicographically, which is only correct when all offsets match.
+        """
+        from datetime import timedelta
+
+        from graphiti_core.driver.falkordb_driver import convert_datetimes_to_strings
+
+        tz_plus_3 = timezone(timedelta(hours=3))
+        # 13:00+03:00 is 10:00 UTC
+        aware_non_utc = datetime(2024, 1, 1, 13, 0, 0, tzinfo=tz_plus_3)
+
+        assert convert_datetimes_to_strings(aware_non_utc) == '2024-01-01T10:00:00+00:00'
+
+        # naive datetimes are assumed UTC and serialized with an explicit offset
+        naive = datetime(2024, 1, 1, 10, 0, 0)
+        assert convert_datetimes_to_strings(naive) == '2024-01-01T10:00:00+00:00'
+
 
 # Simple integration test
 class TestFalkorDriverIntegration:
@@ -472,3 +506,102 @@ async def test_clear_data_group_ids_includes_saga_nodes(self):
         finally:
             await driver.execute_query('MATCH (n) DETACH DELETE n')
             await driver.close()
+
+    @pytest.mark.asyncio
+    @unittest.skipIf(not HAS_FALKORDB, 'FalkorDB is not installed')
+    async def test_bulk_save_does_not_persist_labels_property(self):
+        """Bulk-saved entities must get real labels, not a stray 'labels' property.
+
+        Regression test: the FALKORDB bulk save query ran `SET n = node` with the
+        labels list still in the map, persisting it as a node property (the
+        single-node save does not), and issued one query per label.
+        """
+        pytest.importorskip('falkordb')
+
+        from graphiti_core.models.nodes.node_db_queries import get_entity_node_save_bulk_query
+
+        falkor_host = os.getenv('FALKORDB_HOST', 'localhost')
+        falkor_port = os.getenv('FALKORDB_PORT', '6379')
+
+        try:
+            driver = FalkorDriver(host=falkor_host, port=falkor_port, database='test_bulk_labels')
+            await driver.execute_query('MATCH (n) DETACH DELETE n')
+        except Exception as e:
+            pytest.skip(f'FalkorDB not available for integration test: {e}')
+
+        try:
+            node = {
+                'uuid': 'bulk-1',
+                'name': 'BulkGuy',
+                'group_id': 'g1',
+                'summary': 's',
+                'created_at': '2024-01-01T00:00:00',
+                'labels': ['Entity', 'Person'],
+                'name_embedding': [0.1, 0.2, 0.3, 0.4],
+            }
+            queries = get_entity_node_save_bulk_query(GraphProvider.FALKORDB, [node])
+
+            # one query per node, not one per label
+            assert len(queries) == 1
+
+            for query, params in queries:
+                await driver.execute_query(query, **params)
+
+            records, _, _ = await driver.execute_query(
+                "MATCH (n:Entity {uuid: 'bulk-1'}) RETURN labels(n) AS labels, n.labels AS prop"
+            )
+            assert len(records) == 1
+            assert set(records[0]['labels']) == {'Entity', 'Person'}
+            assert records[0]['prop'] is None
+        finally:
+            await driver.execute_query('MATCH (n) DETACH DELETE n')
+            await driver.close()
+
+    @pytest.mark.asyncio
+    @unittest.skipIf(not HAS_FALKORDB, 'FalkorDB is not installed')
+    async def test_retrieve_episodes_with_non_utc_valid_at(self):
+        """Episodes saved with a non-UTC offset must be found by a UTC reference time.
+
+        Regression test: valid_at was serialized with its original offset and
+        compared lexicographically against a UTC reference string, so an episode
+        at 10:00 UTC written as 13:00+03:00 was missed by a 10:30 UTC reference.
+        """
+        pytest.importorskip('falkordb')
+
+        from datetime import timedelta
+
+        from graphiti_core.nodes import EpisodeType, EpisodicNode
+        from graphiti_core.utils.datetime_utils import utc_now
+
+        falkor_host = os.getenv('FALKORDB_HOST', 'localhost')
+        falk
```

**File**: `tests/helpers_test.py` (modified, +19/-9)
```diff
@@ -26,6 +26,7 @@
 from graphiti_core.embedder.client import EmbedderClient
 from graphiti_core.helpers import lucene_sanitize
 from graphiti_core.nodes import CommunityNode, EntityNode, EpisodicNode
+from graphiti_core.utils.datetime_utils import ensure_utc
 from graphiti_core.utils.maintenance.graph_data_operations import clear_data
 
 load_dotenv()
@@ -245,15 +246,24 @@ async def print_graph(graph_driver: GraphDriver):
         print('  ', edge)
 
 
+def assert_datetimes_equal(left, right):
+    """Compare datetimes after normalizing naive values to UTC.
+
+    FalkorDB round-trips ISO strings with an explicit +00:00 offset, so a naive
+    input and an aware UTC result represent the same instant.
+    """
+    assert ensure_utc(left) == ensure_utc(right)
+
+
 async def assert_episodic_node_equals(retrieved: EpisodicNode, sample: EpisodicNode):
     assert retrieved.uuid == sample.uuid
     assert retrieved.name == sample.name
     assert retrieved.group_id == group_id
-    assert retrieved.created_at == sample.created_at
+    assert_datetimes_equal(retrieved.created_at, sample.created_at)
     assert retrieved.source == sample.source
     assert retrieved.source_description == sample.source_description
     assert retrieved.content == sample.content
-    assert retrieved.valid_at == sample.valid_at
+    assert_datetimes_equal(retrieved.valid_at, sample.valid_at)
     assert set(retrieved.entity_edges) == set(sample.entity_edges)
 
 
@@ -265,7 +275,7 @@ async def assert_entity_node_equals(
     assert retrieved.name == sample.name
     assert retrieved.group_id == sample.group_id
     assert set(retrieved.labels) == set(sample.labels)
-    assert retrieved.created_at == sample.created_at
+    assert_datetimes_equal(retrieved.created_at, sample.created_at)
     assert retrieved.name_embedding is not None
     assert sample.name_embedding is not None
     assert np.allclose(retrieved.name_embedding, sample.name_embedding)
@@ -280,7 +290,7 @@ async def assert_community_node_equals(
     assert retrieved.uuid == sample.uuid
     assert retrieved.name == sample.name
     assert retrieved.group_id == group_id
-    assert retrieved.created_at == sample.created_at
+    assert_datetimes_equal(retrieved.created_at, sample.created_at)
     assert retrieved.name_embedding is not None
     assert sample.name_embedding is not None
     assert np.allclose(retrieved.name_embedding, sample.name_embedding)
@@ -290,7 +300,7 @@ async def assert_community_node_equals(
 async def assert_episodic_edge_equals(retrieved: EpisodicEdge, sample: EpisodicEdge):
     assert retrieved.uuid == sample.uuid
     assert retrieved.group_id == sample.group_id
-    assert retrieved.created_at == sample.created_at
+    assert_datetimes_equal(retrieved.created_at, sample.created_at)
     assert retrieved.source_node_uuid == sample.source_node_uuid
     assert retrieved.target_node_uuid == sample.target_node_uuid
 
@@ -301,7 +311,7 @@ async def assert_entity_edge_equals(
     await retrieved.load_fact_embedding(graph_driver)
     assert retrieved.uuid == sample.uuid
     assert retrieved.group_id == sample.group_id
-    assert retrieved.created_at == sample.created_at
+    assert_datetimes_equal(retrieved.created_at, sample.created_at)
     assert retrieved.source_node_uuid == sample.source_node_uuid
     assert retrieved.target_node_uuid == sample.target_node_uuid
     assert retrieved.name == sample.name
@@ -310,9 +320,9 @@ async def assert_entity_edge_equals(
     assert sample.fact_embedding is not None
     assert np.allclose(retrieved.fact_embedding, sample.fact_embedding)
     assert retrieved.episodes == sample.episodes
-    assert retrieved.expired_at == sample.expired_at
-    assert retrieved.valid_at == sample.valid_at
-    assert retrieved.invalid_at == sample.invalid_at
+    assert_datetimes_equal(retrieved.expired_at, sample.expired_at)
+    assert_datetimes_equal(retrieved.valid_at, sample.valid_at)
+    assert_datetimes_equal(retrieved.invalid_at, sample.invalid_at)
     assert retrieved.attributes == sample.attributes
 
 
```

**File**: `tests/test_edge_int.py` (modified, +12/-12)
```diff
@@ -23,7 +23,7 @@
 
 from graphiti_core.edges import CommunityEdge, EntityEdge, EpisodicEdge
 from graphiti_core.nodes import CommunityNode, EntityNode, EpisodeType, EpisodicNode
-from tests.helpers_test import get_edge_count, get_node_count, group_id
+from tests.helpers_test import assert_datetimes_equal, get_edge_count, get_node_count, group_id
 
 pytest_plugins = ('pytest_asyncio',)
 
@@ -104,7 +104,7 @@ async def test_episodic_edge(graph_driver, mock_embedder):
     assert retrieved.uuid == episodic_edge.uuid
     assert retrieved.source_node_uuid == episode_node.uuid
     assert retrieved.target_node_uuid == alice_node.uuid
-    assert retrieved.created_at == now
+    assert_datetimes_equal(retrieved.created_at, now)
     assert retrieved.group_id == group_id
 
     # Get edge by uuids
@@ -113,7 +113,7 @@ async def test_episodic_edge(graph_driver, mock_embedder):
     assert retrieved[0].uuid == episodic_edge.uuid
     assert retrieved[0].source_node_uuid == episode_node.uuid
     assert retrieved[0].target_node_uuid == alice_node.uuid
-    assert retrieved[0].created_at == now
+    assert_datetimes_equal(retrieved[0].created_at, now)
     assert retrieved[0].group_id == group_id
 
     # Get edge by group ids
@@ -122,15 +122,15 @@ async def test_episodic_edge(graph_driver, mock_embedder):
     assert retrieved[0].uuid == episodic_edge.uuid
     assert retrieved[0].source_node_uuid == episode_node.uuid
     assert retrieved[0].target_node_uuid == alice_node.uuid
-    assert retrieved[0].created_at == now
+    assert_datetimes_equal(retrieved[0].created_at, now)
     assert retrieved[0].group_id == group_id
 
     # Get episodic node by entity node uuid
     retrieved = await EpisodicNode.get_by_entity_node_uuid(graph_driver, alice_node.uuid)
     assert len(retrieved) == 1
     assert retrieved[0].uuid == episode_node.uuid
     assert retrieved[0].name == 'test_episode'
-    assert retrieved[0].created_at == now
+    assert_datetimes_equal(retrieved[0].created_at, now)
     assert retrieved[0].group_id == group_id
 
     # Delete edge by uuid
@@ -210,7 +210,7 @@ async def test_entity_edge(graph_driver, mock_embedder):
     assert retrieved.uuid == entity_edge.uuid
     assert retrieved.source_node_uuid == alice_node.uuid
     assert retrieved.target_node_uuid == bob_node.uuid
-    assert retrieved.created_at == now
+    assert_datetimes_equal(retrieved.created_at, now)
     assert retrieved.group_id == group_id
 
     # Get edge by uuids
@@ -219,7 +219,7 @@ async def test_entity_edge(graph_driver, mock_embedder):
     assert retrieved[0].uuid == entity_edge.uuid
     assert retrieved[0].source_node_uuid == alice_node.uuid
     assert retrieved[0].target_node_uuid == bob_node.uuid
-    assert retrieved[0].created_at == now
+    assert_datetimes_equal(retrieved[0].created_at, now)
     assert retrieved[0].group_id == group_id
 
     # Get edge by group ids
@@ -228,7 +228,7 @@ async def test_entity_edge(graph_driver, mock_embedder):
     assert retrieved[0].uuid == entity_edge.uuid
     assert retrieved[0].source_node_uuid == alice_node.uuid
     assert retrieved[0].target_node_uuid == bob_node.uuid
-    assert retrieved[0].created_at == now
+    assert_datetimes_equal(retrieved[0].created_at, now)
     assert retrieved[0].group_id == group_id
 
     # Get edge by node uuid
@@ -237,7 +237,7 @@ async def test_entity_edge(graph_driver, mock_embedder):
     assert retrieved[0].uuid == entity_edge.uuid
     assert retrieved[0].source_node_uuid == alice_node.uuid
     assert retrieved[0].target_node_uuid == bob_node.uuid
-    assert retrieved[0].created_at == now
+    assert_datetimes_equal(retrieved[0].created_at, now)
     assert retrieved[0].group_id == group_id
 
     # Get edge by node uuid from the target side — direction must be preserved
@@ -360,7 +360,7 @@ async def test_community_edge(graph_driver, mock_embedder):
     assert retrieved.uuid == community_edge.uuid
     assert retrieved.source_node_uuid == community_node_1.uuid
     assert retrieved.target_node_uuid == community_node_2.uuid
-    assert retrieved.created_at == now
+    assert_datetimes_equal(retrieved.created_at, now)
     assert retrieved.group_id == group_id
 
     # Get edge by uuids
@@ -369,7 +369,7 @@ async def test_community_edge(graph_driver, mock_embedder):
     assert retrieved[0].uuid == community_edge.uuid
     assert retrieved[0].source_node_uuid == community_node_1.uuid
     assert retrieved[0].target_node_uuid == community_node_2.uuid
-    assert retrieved[0].created_at == now
+    assert_datetimes_equal(retrieved[0].created_at, now)
     assert retrieved[0].group_id == group_id
 
     # Get edge by group ids
@@ -378,7 +378,7 @@ async def test_community_edge(graph_driver, mock_embedder):
     assert retrieved[0].uuid == community_edge.uuid
     assert retrieved[0].source_node_uuid == community_node_1.uuid
     assert retrieved[0].target_node_uuid == community_node_2.uuid
-    assert retrieved[0].created_at == now
+    asse
```

---

### Incident Patch 7: `2d96f271` (2026-09-08)
**Commit Message**: fix(falkordb): avoid a full :Entity scan per hit in edge_fulltext_search (#1711)

edge_fulltext_search resolves a matched relationship's endpoints with

    MATCH (n:Entity)-[e:RELATES_TO {uuid: rel.uuid}]->(m:Entity)

FalkorDB plans this as a Node By Label Scan over every :Entity node for
each row the fulltext index yields, so the search costs O(hits x entities)
even though the trailing LIMIT keeps only a handful of rows:

    Results
      Project
        Filter
          Edge By Index Scan | [e:RELATES_TO]
            Node By Label Scan | (n:Entity)     <-- once per hit
              ProcedureCall

The relationship the index already returned knows its own endpoints, so
read them with startNode()/endNode() instead. The added label predicate
keeps the result set identical to the pattern's.

Measured on a FalkorDB graph with 5,665 nodes / 20,263 RELATES_TO edges /
3,725 entities, same query, byte-identical 306-row result set:

    before   33,383 ms
    after         1.6 ms

Neo4j and Kuzu are untouched.

Co-authored-by: trevor-sykes <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5 <[REDACTED_EMAIL]>
Co-authored-by: Preston Rasmussen <[REDACTED_EMAIL]>

**File**: `graphiti_core/search/search_utils.py` (modified, +11/-0)
```diff
@@ -204,6 +204,17 @@ async def edge_fulltext_search(
     YIELD relationship AS rel, score
     MATCH (n:Entity)-[e:RELATES_TO {uuid: rel.uuid}]->(m:Entity)
     """
+    if driver.provider == GraphProvider.FALKORDB:
+        # FalkorDB plans the MATCH above as a full :Entity label scan for EVERY row the
+        # fulltext index yields, so the cost is O(hits x entities). The relationship the
+        # index already returned knows its own endpoints, so read them directly. The label
+        # predicate keeps the result set identical to the pattern's.
+        match_query = """
+        YIELD relationship AS rel, score
+        WITH rel AS e, score, startNode(rel) AS n, endNode(rel) AS m
+        WHERE n:Entity AND m:Entity
+        WITH e, score, n, m
+        """
     if driver.provider == GraphProvider.KUZU:
         match_query = """
         YIELD node, score
```

---

### Incident Patch 8: `08834609` (2026-09-08)
**Commit Message**: fix: use request-scoped driver for concurrent multi-group_id isolation (#1676) (#1699)

fix: use request-scoped driver for concurrent group_id isolation (#1676)

add_episode and add_episode_bulk previously reassigned the shared
self.driver (and self.clients.driver) whenever a group_id mapped to a
different database:

    if group_id != self.driver._database:
        self.driver = self.driver.clone(database=group_id)
        self.clients.driver = self.driver

Because these coroutines contain many await points (LLM calls,
embeddings, DB reads/writes), a concurrent call for a *different*
group_id could reassign self.driver mid-execution. The first call's
remaining operations then targeted the wrong database, silently
persisting episodes under the wrong graph. This manifested in
production as episodes leaking across FalkorDB group graphs with no
error raised.

This replaces the shared-state mutation with a request-scoped bundle:
_resolve_request_scope(group_id) returns the effective group_id, a
per-call driver, and a matching GraphitiClients copy. Both entry points
and their helper methods (_extract_and_resolve_edges,
_process_episode_data, _extract_and_dedupe_nodes_bulk,
_resolve_node

**File**: `graphiti_core/graphiti.py` (modified, +115/-59)
```diff
@@ -344,7 +344,11 @@ async def close(self):
         await self.driver.close()
 
     async def _get_or_create_saga(
-        self, saga_name: str, group_id: str, created_at: datetime
+        self,
+        saga_name: str,
+        group_id: str,
+        created_at: datetime,
+        driver: GraphDriver | None = None,
     ) -> SagaNode:
         """
         Get an existing saga by name or create a new one.
@@ -368,7 +372,9 @@ async def _get_or_create_saga(
         """
         from graphiti_core.helpers import parse_db_date
 
-        records, _, _ = await self.driver.execute_query(
+        driver = driver or self.driver
+
+        records, _, _ = await driver.execute_query(
             """
             MATCH (s:Saga {name: $name, group_id: $group_id})
             RETURN s.uuid AS uuid, s.name AS name, s.group_id AS group_id, s.created_at AS created_at
@@ -388,22 +394,24 @@ async def _get_or_create_saga(
             )
 
         saga = SagaNode(name=saga_name, group_id=group_id, created_at=created_at)
-        await saga.save(self.driver)
+        await saga.save(driver)
         return saga
 
     async def _saga_get_previous_episode_uuid(
-        self, saga_uuid: str, current_episode_uuid: str
+        self, saga_uuid: str, current_episode_uuid: str, driver: GraphDriver | None = None
     ) -> str | None:
         """Find the most recent episode UUID in a saga, excluding the current one."""
-        if self.driver.graph_operations_interface:
+        driver = driver or self.driver
+
+        if driver.graph_operations_interface:
             try:
-                return await self.driver.graph_operations_interface.saga_get_previous_episode_uuid(
-                    self.driver, saga_uuid, current_episode_uuid
+                return await driver.graph_operations_interface.saga_get_previous_episode_uuid(
+                    driver, saga_uuid, current_episode_uuid
                 )
             except NotImplementedError:
                 pass
 
-        records, _, _ = await self.driver.execute_query(
+        records, _, _ = await driver.execute_query(
             """
             MATCH (s:Saga {uuid: $saga_uuid})-[:HAS_EPISODE]->(e:Episodic)
             WHERE e.uuid <> $current_episode_uuid
@@ -639,9 +647,17 @@ async def _extract_and_resolve_edges(
         nodes: list[EntityNode],
         uuid_map: dict[str, str],
         custom_extraction_instructions: str | None = None,
+        clients: GraphitiClients | None = None,
     ) -> tuple[list[EntityEdge], list[EntityEdge], list[EntityEdge]]:
         """Extract edges from episode(s) and resolve against existing graph.
 
+        Parameters
+        ----------
+        clients : GraphitiClients | None
+            Optional request-scoped clients bundle. Defaults to ``self.clients``.
+            Callers pass a per-request bundle so concurrent calls for different
+            group_ids target the correct database (issue #1676).
+
         Returns
         -------
         tuple[list[EntityEdge], list[EntityEdge], list[EntityEdge]]
@@ -650,11 +666,12 @@ async def _extract_and_resolve_edges(
             - invalidated_edges: Edges invalidated by new information
             - new_edges: Only edges that are new to the graph (not duplicates)
         """
+        clients = clients or self.clients
         episodes = episode if isinstance(episode, list) else [episode]
         primary_episode = episodes[0]
 
         extracted_edges = await extract_edges(
-            self.clients,
+            clients,
             episode,
             extracted_nodes,
             previous_episodes,
@@ -667,7 +684,7 @@ async def _extract_and_resolve_edges(
         edges = resolve_edge_pointers(extracted_edges, uuid_map)
 
         resolved_edges, invalidated_edges, new_edges = await resolve_extracted_edges(
-            self.clients,
+            clients,
             edges,
             primary_episode,
             nodes,
@@ -687,6 +704,7 @@ async def _process_episode_data(
         saga: str | SagaNode | None = None,
         saga_previous_episode_uuid: str | None = None,
         node_episode_index_map: dict[str, list[int]] | None = None,
+        clients: GraphitiClients | None = None,
     ) -> tuple[list[EpisodicEdge], EpisodicNode]:
         """Process and save episode data to the graph.
 
@@ -713,7 +731,13 @@ async def _process_episode_data(
         node_episode_index_map : dict[str, list[int]] | None
             Optional mapping from node UUID to 0-indexed episode positions for
             building episodic edges with correct attribution.
+        clients : GraphitiClients | None
+            Optional request-scoped clients bundle. Defaults to ``self.clients``.
+            Callers pass a per-request bundle so concurrent calls for different
+            group_ids target the correct database (issue #1676).
         """
+        clients = clients or self.clients
+        driver = clients.driver
         episodes = episode if isinstance(episode, l
```

**File**: `tests/test_request_scope_concurrency.py` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+"""
+Copyright 2024, Zep Software, Inc.
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+"""
+
+# Regression tests for concurrent multi-group_id database routing (issue #1676).
+#
+# These tests are database-free: they exercise ``Graphiti._resolve_request_scope``
+# directly with a fake driver. The historical bug was that ``add_episode`` /
+# ``add_episode_bulk`` reassigned the shared ``self.driver`` when a ``group_id``
+# mapped to a different database. Because those coroutines have many ``await``
+# points, a concurrent call for a different ``group_id`` could reassign
+# ``self.driver`` mid-execution and silently persist episodes under the wrong
+# graph. The fix returns a request-scoped driver/clients bundle instead of
+# mutating shared instance state.
+
+import asyncio
+from typing import Any
+from unittest.mock import Mock
+
+import pytest
+
+from graphiti_core.cross_encoder.client import CrossEncoderClient
+from graphiti_core.driver.driver import GraphDriver, GraphProvider
+from graphiti_core.embedder.client import EmbedderClient
+from graphiti_core.graphiti import Graphiti
+from graphiti_core.graphiti_types import GraphitiClients
+from graphiti_core.llm_client import LLMClient
+from graphiti_core.tracer import Tracer
+
+pytest_plugins = ('pytest_asyncio',)
+
+
+class FakeDriver(GraphDriver):
+    """Minimal in-memory GraphDriver whose ``clone`` records the target database.
+
+    Each ``clone`` returns a brand new instance bound to the requested database,
+    mirroring how the real drivers hand back a call-scoped copy without mutating
+    the original.
+    """
+
+    provider = GraphProvider.NEO4J
+
+    def __init__(self, database: str = 'default_db'):
+        self._database = database
+        self.clone_calls: list[str] = []
+
+    def clone(self, database: str) -> 'FakeDriver':
+        self.clone_calls.append(database)
+        cloned = FakeDriver(database=database)
+        return cloned
+
+    # --- Abstract methods: unused by these tests, kept as no-ops. ---
+    async def execute_query(self, cypher_query_: str, **kwargs: Any) -> Any:  # pragma: no cover
+        raise NotImplementedError
+
+    def session(self, database: str | None = None):  # pragma: no cover
+        raise NotImplementedError
+
+    def close(self):  # pragma: no cover
+        raise NotImplementedError
+
+    def delete_all_indexes(self):  # pragma: no cover
+        raise NotImplementedError
+
+    async def build_indices_and_constraints(
+        self, delete_existing: bool = False
+    ):  # pragma: no cover
+        raise NotImplementedError
+
+
+def _make_graphiti(database: str = 'default_db') -> tuple[Graphiti, FakeDriver]:
+    """Build a Graphiti instance around a FakeDriver, bypassing __init__ side effects."""
+    driver = FakeDriver(database=database)
+    clients = GraphitiClients(  # type: ignore[call-arg]
+        driver=driver,
+        llm_client=Mock(spec=LLMClient),
+        embedder=Mock(spec=EmbedderClient),
+        cross_encoder=Mock(spec=CrossEncoderClient),
+        tracer=Mock(spec=Tracer),
+    )
+    graphiti = Graphiti.__new__(Graphiti)
+    graphiti.driver = driver
+    graphiti.clients = clients
+    return graphiti, driver
+
+
+def test_resolve_request_scope_none_group_id_reuses_shared_driver():
+    graphiti, driver = _make_graphiti()
+
+    group_id, scoped_driver, scoped_clients = graphiti._resolve_request_scope(None)
+
+    # Default group id for Neo4j is the empty string.
+    assert group_id == ''
+    # No clone occurred and the shared instances are reused as-is.
+    assert scoped_driver is driver
+    assert scoped_clients is graphiti.clients
+    assert driver.clone_calls == []
+
+
+def test_resolve_request_scope_matching_group_id_reuses_shared_driver():
+    graphiti, driver = _make_graphiti(database='tenant_a')
+
+    group_id, scoped_driver, scoped_clients = graphiti._resolve_request_scope('tenant_a')
+
+    assert group_id == 'tenant_a'
+    assert scoped_driver is driver
+    assert scoped_clients is graphiti.clients
+    assert driver.clone_calls == []
+
+
+def test_resolve_request_scope_different_group_id_does_not_mutate_shared_state():
+    graphiti, driver = _make_graphiti(database='default_db')
+    original_clients = graphiti.clients
+
+    group_id, scoped_driver, scoped_clients = graphiti._resolve_request_scope('tenant_b')
+
+    # A request-scoped clone targeting the requested database is returned.
+    assert group_id == 'tenant_b'
+    assert scoped_driver is no
```

---

### Incident Patch 9: `ef68089a` (2026-09-08)
**Commit Message**: fix: bind arguments by name in multi-group decorator branch (#1758) (#1760)

* fix: bind arguments by name in multi-group decorator branch (#1758)

The multi-group branch popped group_ids from its original positional slot
and re-invoked the wrapped function with the shifted positional args plus
group_ids/driver as keywords. A caller that also passed driver positionally
collided with the injected keyword and raised
TypeError: got multiple values for argument 'driver'.

Bind the call once with inspect.signature(func).bind(...) and rewrite the
bound arguments per group instead of splicing positional slots.

* chore: re-trigger CLA check

* chore: re-trigger CLA check

* fix: bind arguments per task in the multi-group dispatch

The single BoundArguments object was shared across the per-group tasks
and mutated in place — safe only because nothing awaited between the
rewrite and the read. Rebinding from the original call inside each task
removes the trap.

---------

Co-authored-by: icn5381 <[REDACTED_EMAIL]>
Co-authored-by: Preston Rasmussen <[REDACTED_EMAIL]>

**File**: `graphiti_core/decorators.py` (modified, +15/-10)
```diff
@@ -74,16 +74,21 @@ async def wrapper(self, *args, **kwargs):
             driver = self.clients.driver
 
             async def execute_for_group(gid: str):
-                # Remove group_ids from args if it was passed positionally
-                filtered_args = list(args)
-                if group_ids_pos is not None and len(args) > group_ids_pos:
-                    filtered_args.pop(group_ids_pos)
-
-                return await func(
-                    self,
-                    *filtered_args,
-                    **{**kwargs, 'group_ids': [gid], 'driver': driver.clone(database=gid)},
-                )
+                # Bind the call by name, per task, from the original args.
+                # Popping group_ids from its original positional slot shifts
+                # every later positional argument down, so a caller that
+                # passed driver positionally collided with the keyword
+                # injected here (TypeError: got multiple values for argument
+                # 'driver') (#1758). Re-binding from the signature normalizes
+                # every argument to its declared name before the per-group
+                # rewrite; a fresh BoundArguments per task also avoids
+                # sharing one mutated-in-place object across concurrent
+                # tasks, which is safe only as long as nothing awaits
+                # between the rewrite and the read.
+                bound = inspect.signature(func).bind(self, *args, **kwargs)
+                bound.arguments['group_ids'] = [gid]
+                bound.arguments['driver'] = driver.clone(database=gid)
+                return await func(*bound.args, **bound.kwargs)
 
             results = await semaphore_gather(
                 *[execute_for_group(gid) for gid in group_ids],
```

**File**: `tests/test_handle_multiple_group_ids.py` (modified, +35/-0)
```diff
@@ -102,3 +102,38 @@ async def test_non_falkor_single_group_id_is_passthrough():
     assert driver.clone_calls == []
     assert host.seen_drivers == [None]
     assert result == ["q:None:['tenant']"]
+
+
+@pytest.mark.asyncio
+async def test_falkor_multi_group_ids_with_positional_driver():
+    """A positional `driver` must not collide with the injected keyword (#1758).
+
+    The multi-group branch pops `group_ids` from its original positional slot
+    and re-invokes `func` with the shifted positional args plus `driver` as a
+    keyword — which raised `TypeError: got multiple values for argument
+    'driver'` whenever the caller also passed `driver` positionally."""
+    driver = _FakeDriver('reggraph')
+    host = _Host(driver)
+
+    result = await host.search('q', ['a', 'b'], driver)
+
+    assert driver.clone_calls == ['a', 'b']
+    assert host.clients.driver is driver
+    assert set(host.seen_drivers) == {'a', 'b'}
+    assert sorted(result) == ["q:a:['a']", "q:b:['b']"]
+
+
+@pytest.mark.asyncio
+async def test_falkor_multi_group_ids_with_positional_group_ids_and_kwarg_driver():
+    """`group_ids` positional with `driver` as a keyword: the wrapper must keep
+    serving positional `group_ids` after the positional-slot pop is replaced by
+    name-based binding."""
+    driver = _FakeDriver('reggraph')
+    host = _Host(driver)
+
+    result = await host.search('q', ['a', 'b'], driver=driver)
+
+    assert driver.clone_calls == ['a', 'b']
+    assert host.clients.driver is driver
+    assert set(host.seen_drivers) == {'a', 'b'}
+    assert sorted(result) == ["q:a:['a']", "q:b:['b']"]
```

---

### Incident Patch 10: `7db96847` (2026-09-08)
**Commit Message**: fix: include Saga nodes when clearing data by group_ids (#1688)

* include Saga nodes when clearing data by group_ids

* add integration test for group-scoped clear_data deleting Saga nodes

---------

Co-authored-by: Preston Rasmussen <[REDACTED_EMAIL]>

**File**: `graphiti_core/driver/falkordb/operations/graph_ops.py` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ async def clear_data(
             await executor.execute_query('MATCH (n) DETACH DELETE n')
         else:
             # FalkorDB: iterate labels individually
-            for label in ['Entity', 'Episodic', 'Community']:
+            for label in ['Entity', 'Episodic', 'Community', 'Saga']:
                 await executor.execute_query(
                     f"""
                     MATCH (n:{label})
```

**File**: `graphiti_core/driver/kuzu/operations/graph_ops.py` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ async def clear_data(
         else:
             # Kuzu requires deleting RelatesToNode_ intermediates in addition to
             # Entity, Episodic, and Community nodes.
-            for label in ['RelatesToNode_', 'Entity', 'Episodic', 'Community']:
+            for label in ['RelatesToNode_', 'Entity', 'Episodic', 'Community', 'Saga']:
                 await executor.execute_query(
                     f"""
                     MATCH (n:{label})
```

**File**: `graphiti_core/driver/neo4j/operations/graph_ops.py` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ async def clear_data(
         if group_ids is None:
             await executor.execute_query('MATCH (n) DETACH DELETE n')
         else:
-            for label in ['Entity', 'Episodic', 'Community']:
+            for label in ['Entity', 'Episodic', 'Community', 'Saga']:
                 await executor.execute_query(
                     f"""
                     MATCH (n:{label})
```

**File**: `graphiti_core/driver/neptune/operations/graph_ops.py` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ async def clear_data(
         if group_ids is None:
             await executor.execute_query('MATCH (n) DETACH DELETE n')
         else:
-            for label in ['Entity', 'Episodic', 'Community']:
+            for label in ['Entity', 'Episodic', 'Community', 'Saga']:
                 await executor.execute_query(
                     f"""
                     MATCH (n:{label})
```

**File**: `graphiti_core/utils/maintenance/graph_data_operations.py` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ async def delete_all(tx):
             await tx.run('MATCH (n) DETACH DELETE n')
 
         async def delete_group_ids(tx):
-            labels = ['Entity', 'Episodic', 'Community']
+            labels = ['Entity', 'Episodic', 'Community', 'Saga']
             if driver.provider == GraphProvider.KUZU:
                 labels.append('RelatesToNode_')
 
```

**File**: `tests/driver/test_falkordb_driver.py` (modified, +43/-0)
```diff
@@ -429,3 +429,46 @@ async def test_basic_integration_with_real_falkordb(self):
 
         except Exception as e:
             pytest.skip(f'FalkorDB not available for integration test: {e}')
+
+    @pytest.mark.asyncio
+    @unittest.skipIf(not HAS_FALKORDB, 'FalkorDB is not installed')
+    async def test_clear_data_group_ids_includes_saga_nodes(self):
+        """clear_data(group_ids=...) must delete Saga nodes of those groups.
+
+        Regression test: the label list only covered Entity, Episodic and
+        Community, so Saga nodes survived group-scoped deletion.
+        """
+        pytest.importorskip('falkordb')
+
+        falkor_host = os.getenv('FALKORDB_HOST', 'localhost')
+        falkor_port = os.getenv('FALKORDB_PORT', '6379')
+
+        try:
+            driver = FalkorDriver(host=falkor_host, port=falkor_port, database='test_clear_saga')
+            await driver.execute_query('MATCH (n) DETACH DELETE n')
+        except Exception as e:
+            pytest.skip(f'FalkorDB not available for integration test: {e}')
+
+        try:
+            await driver.execute_query(
+                "CREATE (:Saga {uuid: 's1', name: 'saga', group_id: 'g1', "
+                "created_at: '2024-01-01T00:00:00'})"
+            )
+            await driver.execute_query(
+                "CREATE (:Entity {uuid: 'e1', name: 'x', group_id: 'g1', "
+                "created_at: '2024-01-01T00:00:00'})"
+            )
+            await driver.execute_query(
+                "CREATE (:Saga {uuid: 's2', name: 'other', group_id: 'g2', "
+                "created_at: '2024-01-01T00:00:00'})"
+            )
+
+            await driver.graph_ops.clear_data(driver, group_ids=['g1'])
+
+            records, _, _ = await driver.execute_query('MATCH (n) RETURN n.uuid AS uuid')
+            remaining = sorted(r['uuid'] for r in records)
+            # everything in g1 is gone, including the Saga node; g2 is untouched
+            assert remaining == ['s2']
+        finally:
+            await driver.execute_query('MATCH (n) DETACH DELETE n')
+            await driver.close()
```

---

### Incident Patch 11: `b943c9e8` (2026-09-06)
**Commit Message**: @cnYui has signed the CLA in getzep/graphiti#1568

**File**: `signatures/version1/cla.json` (modified, +20/-0)
```diff
@@ -1485,6 +1485,26 @@
       "created_at": "2026-09-04T17:52:34Z",
       "repoId": 840056306,
       "pullRequestNo": 1835
+    },
+    {
+      "name": "cnYui",
+      "email": "xiaobianfuai@gmail.com",
+      "accountType": "personal",
+      "id": 132864240,
+      "comment_id": 4655089821,
+      "created_at": "2026-06-09T01:20:06Z",
+      "repoId": 840056306,
+      "pullRequestNo": 1568
+    },
+    {
+      "name": "cnYui",
+      "email": "xiaobianfuai@gmail.com",
+      "accountType": "personal",
+      "id": 132864240,
+      "comment_id": 5559203820,
+      "created_at": "2026-09-06T12:26:31Z",
+      "repoId": 840056306,
+      "pullRequestNo": 1568
     }
   ]
 }
\ No newline at end of file
```

---

### Incident Patch 12: `9d63818f` (2026-09-01)
**Commit Message**: fix(ci): bump gh-action-pypi-publish for metadata 2.5 (#1821)

Hatchling now emits Metadata-Version 2.5, which the pinned Twine 6 action rejects during the v0.30.0 release. v1.14.2 ships Twine 7 so the wheel can upload.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `.github/workflows/release-graphiti-core.yml` (modified, +1/-1)
```diff
@@ -42,4 +42,4 @@ jobs:
       - name: Build project for distribution
         run: uv build
       - name: Publish package distributions to PyPI
-        uses: pypa/gh-action-pypi-publish@ed0c53931b1dc9bd32cbe73a98c7f6766f8a527e # release/v1
+        uses: pypa/gh-action-pypi-publish@dc37677b2e1c63e2034f94d8a5b11f265b73ba33 # v1.14.2
```

---

### Incident Patch 13: `7eea1315` (2026-09-01)
**Commit Message**: fix(neo4j): route queries to the configured database

Pass database_ as Neo4j's routing keyword instead of a unused Cypher parameter, and send index deletion through the same path.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `graphiti_core/driver/neo4j_driver.py` (modified, +12/-8)
```diff
@@ -158,17 +158,23 @@ async def transaction(self) -> AsyncIterator[Transaction]:
                 raise
 
     async def execute_query(self, cypher_query_: LiteralString, **kwargs: Any) -> EagerResult:
-        # Check if database_ is provided in kwargs.
-        # If not populated, set the value to retain backwards compatibility
         params = kwargs.pop('params', None)
         if params is None:
             params = {}
-        params.setdefault('database_', self._database)
+        # Route via Neo4j's database_ kwarg; an explicit override wins (including None,
+        # which lets the server resolve the home database), else the driver default.
+        database = kwargs.pop('database_') if 'database_' in kwargs else self._database
 
         try:
-            result = await self.client.execute_query(cypher_query_, parameters_=params, **kwargs)
+            result = await self.client.execute_query(
+                cypher_query_, parameters_=params, database_=database, **kwargs
+            )
         except Exception as e:
-            logger.error(f'Error executing Neo4j query: {e}\n{cypher_query_}\n{params}')
+            # Log parameter names only; values may contain sensitive data.
+            logger.error(
+                f'Error executing Neo4j query: {e}\n{cypher_query_}\n'
+                f'parameter keys: {sorted([*params, *kwargs])}'
+            )
             raise
 
         return result
@@ -189,9 +195,7 @@ async def close(self) -> None:
         await self.client.close()
 
     def delete_all_indexes(self) -> Coroutine:
-        return self.client.execute_query(
-            'CALL db.indexes() YIELD name DROP INDEX name',
-        )
+        return self.execute_query('CALL db.indexes() YIELD name DROP INDEX name')
 
     async def _execute_index_query(self, query: LiteralString) -> EagerResult | None:
         """Execute an index creation query, ignoring 'index already exists' errors.
```

**File**: `tests/driver/test_neo4j_driver_routing.py` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+"""Unit tests for Neo4jDriver query routing to the configured database.
+
+Neo4j's client takes ``database_`` as a top-level routing keyword, distinct from
+Cypher ``parameters_``. These tests assert ``execute_query`` (and index deletion)
+pass the driver database through that routing slot rather than stuffing it into
+query parameters, so a non-default database name is actually used.
+
+No live Neo4j is required: the scheduled init task is cancelled and ``client``
+is replaced with a mock.
+"""
+
+from unittest.mock import AsyncMock, MagicMock, patch
+
+import pytest
+
+from graphiti_core.driver.neo4j_driver import Neo4jDriver
+
+pytestmark = pytest.mark.asyncio
+
+
+def _make_driver(**init_kwargs) -> Neo4jDriver:
+    """Build a Neo4jDriver whose client is a mock and whose init task is inert."""
+    mock_client = MagicMock()
+    mock_client.execute_query = AsyncMock()
+    mock_client.close = AsyncMock()
+
+    with (
+        patch(
+            'graphiti_core.driver.neo4j_driver.AsyncGraphDatabase.driver',
+            return_value=mock_client,
+        ),
+        patch.object(Neo4jDriver, 'build_indices_and_constraints', new_callable=AsyncMock),
+    ):
+        driver = Neo4jDriver(uri='bolt://x', user='u', password='p', **init_kwargs)
+
+    if driver._init_task is not None:
+        driver._init_task.cancel()
+
+    assert driver.client is mock_client
+    return driver
+
+
+async def test_execute_query_routes_to_configured_database():
+    driver = _make_driver(database='custom')
+    try:
+        await driver.execute_query('RETURN 1')
+
+        driver.client.execute_query.assert_awaited_once()
+        call_kwargs = driver.client.execute_query.await_args.kwargs
+        assert call_kwargs['database_'] == 'custom'
+        assert 'database_' not in call_kwargs['parameters_']
+    finally:
+        await driver.close()
+
+
+async def test_execute_query_per_call_database_override_wins():
+    driver = _make_driver(database='custom')
+    try:
+        await driver.execute_query('RETURN 1', database_='override')
+
+        driver.client.execute_query.assert_awaited_once()
+        call_kwargs = driver.client.execute_query.await_args.kwargs
+        assert call_kwargs['database_'] == 'override'
+        assert 'database_' not in call_kwargs['parameters_']
+    finally:
+        await driver.close()
+
+
+async def test_execute_query_explicit_none_database_requests_home_database():
+    driver = _make_driver(database='custom')
+    try:
+        await driver.execute_query('RETURN 1', database_=None)
+
+        driver.client.execute_query.assert_awaited_once()
+        call_kwargs = driver.client.execute_query.await_args.kwargs
+        assert call_kwargs['database_'] is None
+        assert 'database_' not in call_kwargs['parameters_']
+    finally:
+        await driver.close()
+
+
+async def test_execute_query_defaults_to_neo4j_database():
+    driver = _make_driver()
+    try:
+        await driver.execute_query('RETURN 1')
+
+        driver.client.execute_query.assert_awaited_once()
+        call_kwargs = driver.client.execute_query.await_args.kwargs
+        assert call_kwargs['database_'] == 'neo4j'
+        assert 'database_' not in call_kwargs['parameters_']
+    finally:
+        await driver.close()
+
+
+async def test_delete_all_indexes_routes_through_execute_query():
+    driver = _make_driver(database='custom')
+    try:
+        await driver.delete_all_indexes()
+
+        driver.client.execute_query.assert_awaited_once()
+        call_kwargs = driver.client.execute_query.await_args.kwargs
+        assert call_kwargs['database_'] == 'custom'
+        assert 'database_' not in call_kwargs['parameters_']
+    finally:
+        await driver.close()
```

---

### Incident Patch 14: `993e081a` (2026-08-13)
**Commit Message**: fix(attributes): preserve prior node attributes when no entity type applies

`extract_attributes_from_nodes` assigns `node.attributes = attributes`
unconditionally, and `_extract_entity_attributes` returned a bare `{}` whenever
no entity type applied to the node. Because a deduplicated node is the node
hydrated from the database (`_promote_resolved_node` returns the existing
candidate, and `get_entity_node_from_record` populates `attributes`), and the
entity save queries replace attributes wholesale, that `{}` silently cleared
attributes a previous typed pass had stored.

Two paths reach it:

- `entity_types=None` on a later episode for a node whose attributes were
  written by an earlier call that did pass `entity_types`.
- `entity_types` supplied but missing the node's label, since
  `entity_types.get(...)` then resolves to None. A node whose only label is
  `Entity` resolves the lookup key to `''` and takes the same path.

The typed path already preserves prior values via
`apply_capped_attributes(..., merge_mode='overlay')`; only the
no-applicable-type early return bypassed it. Returning the node's prior
attributes makes the documented contract at the call site ("returns the
alr

**File**: `graphiti_core/utils/maintenance/node_operations.py` (modified, +4/-1)
```diff
@@ -788,7 +788,10 @@ async def _extract_entity_attributes(
     entity_type: type[BaseModel] | None,
 ) -> dict[str, Any]:
     if entity_type is None or len(entity_type.model_fields) == 0:
-        return {}
+        # No applicable type means nothing to extract, not "extracted nothing": return the
+        # node's prior attributes so the caller's assignment leaves them untouched. Returning
+        # {} here would clear attributes a previous typed pass stored on a deduplicated node.
+        return dict(node.attributes or {})
 
     attributes_context = _build_episode_context(
         # should not include summary
```

**File**: `tests/utils/maintenance/test_node_operations.py` (modified, +68/-0)
```diff
@@ -918,3 +918,71 @@ async def test_batch_summaries_calls_llm_for_long_summary():
     # LLM should have been called to condense the long summary
     llm_client.generate_response.assert_awaited_once()
     assert node.summary == 'Condensed summary'
+
+
+@pytest.mark.asyncio
+async def test_extract_attributes_preserves_prior_attributes_when_entity_types_none():
+    """Prior attributes survive when no entity types are supplied.
+
+    Mirrors the invariant `add_triplet` already enforces ("merge rather than replace",
+    see `test_add_triplet_empty_attributes_preserved`): an empty extraction result must
+    not clear attributes a previous typed pass stored on the node.
+    """
+    clients, _ = _make_clients()
+    clients.llm_client.generate_response = AsyncMock(return_value={'summaries': []})
+    clients.embedder.create = AsyncMock(return_value=[0.1, 0.2, 0.3])
+    clients.embedder.create_batch = AsyncMock(return_value=[[0.1, 0.2, 0.3]])
+
+    node = EntityNode(
+        name='Alice',
+        group_id='group',
+        labels=['Entity', 'Person'],
+        summary='Existing summary',
+        attributes={'age': 30, 'city': 'New York'},
+    )
+
+    results = await extract_attributes_from_nodes(
+        clients,
+        [node],
+        episode=_make_episode(),
+        previous_episodes=[],
+        entity_types=None,
+    )
+
+    assert results[0].attributes == {'age': 30, 'city': 'New York'}
+
+
+@pytest.mark.asyncio
+async def test_extract_attributes_preserves_prior_attributes_when_label_not_in_entity_types():
+    """Prior attributes survive when the node's label is absent from `entity_types`.
+
+    `entity_types.get(...)` resolves to None for any label not in the map, which takes the
+    same no-applicable-type path as `entity_types=None`.
+    """
+    from pydantic import BaseModel
+
+    class Organization(BaseModel):
+        industry: str | None = None
+
+    clients, _ = _make_clients()
+    clients.llm_client.generate_response = AsyncMock(return_value={'summaries': []})
+    clients.embedder.create = AsyncMock(return_value=[0.1, 0.2, 0.3])
+    clients.embedder.create_batch = AsyncMock(return_value=[[0.1, 0.2, 0.3]])
+
+    node = EntityNode(
+        name='Alice',
+        group_id='group',
+        labels=['Entity', 'Person'],
+        summary='Existing summary',
+        attributes={'age': 30, 'city': 'New York'},
+    )
+
+    results = await extract_attributes_from_nodes(
+        clients,
+        [node],
+        episode=_make_episode(),
+        previous_episodes=[],
+        entity_types={'Organization': Organization},
+    )
+
+    assert results[0].attributes == {'age': 30, 'city': 'New York'}
```

---

### Incident Patch 15: `d40da88f` (2026-08-12)
**Commit Message**: fix edge cross-encoder shortlist via balanced merge (#1642) (#1754)

* fix edge cross-encoder shortlist via balanced merge (#1642)

Round-robin merge retrieval result sets before CE ranking so BM25 insertion order cannot crowd out cosine/BFS candidates.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

* use RRF with 2x limit for edge cross-encoder shortlist (#1642)

Replace balanced_merge with RRF fusion and a 2*limit CE candidate cap so multi-method hits reach ranking without unbounded cost.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

---------

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `graphiti_core/search/search.py` (modified, +4/-3)
```diff
@@ -393,9 +393,10 @@ async def edge_search(
                         reranker_min_score,
                     )
             elif config.reranker == EdgeReranker.cross_encoder:
-                fact_to_uuid_map = {
-                    edge.fact: edge.uuid for edge in list(edge_uuid_map.values())[:limit]
-                }
+                search_result_uuids = [[edge.uuid for edge in result] for result in search_results]
+                rrf_result_uuids, _ = rrf(search_result_uuids, min_score=reranker_min_score)
+                rrf_edges = [edge_uuid_map[uuid] for uuid in rrf_result_uuids][: 2 * limit]
+                fact_to_uuid_map = {edge.fact: edge.uuid for edge in rrf_edges}
                 with _trace_phase(
                     search_tracer,
                     'search.edge_search.cross_encoder_rank',
```

**File**: `tests/utils/search/test_edge_cross_encoder_rrf_shortlist.py` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+from datetime import datetime, timezone
+from types import SimpleNamespace
+
+import pytest
+
+from graphiti_core.edges import EntityEdge
+from graphiti_core.search.search import edge_search
+from graphiti_core.search.search_config import EdgeReranker, EdgeSearchConfig, EdgeSearchMethod
+from graphiti_core.search.search_filters import SearchFilters
+
+
+def _edge(uuid: str, fact: str) -> EntityEdge:
+    return EntityEdge(
+        uuid=uuid,
+        source_node_uuid='source',
+        target_node_uuid='target',
+        name='relates_to',
+        group_id='group_1',
+        fact=fact,
+        created_at=datetime.now(timezone.utc),
+    )
+
+
+@pytest.mark.asyncio
+async def test_rrf_shortlist_includes_cosine_top_hit(monkeypatch):
+    """RRF + 2*limit shortlist: cosine rank-1 reaches CE even when BM25 list is long."""
+    limit = 2
+    bm25_hits = [_edge(f'bm25-{i}', f'bm25-fact-{i}') for i in range(6)]
+    cosine_hit = _edge('cosine-1', 'cosine-top-fact')
+    ranked_passages: list[str] = []
+
+    async def fake_fulltext(*args, **kwargs):
+        return bm25_hits
+
+    async def fake_similarity(*args, **kwargs):
+        return [cosine_hit]
+
+    class RecordingCrossEncoder:
+        async def rank(self, query: str, passages: list[str]):
+            ranked_passages.extend(passages)
+            scored = [(p, 0.99 if p == cosine_hit.fact else 0.1) for p in passages]
+            scored.sort(key=lambda item: item[1], reverse=True)
+            return scored
+
+    monkeypatch.setattr('graphiti_core.search.search.edge_fulltext_search', fake_fulltext)
+    monkeypatch.setattr('graphiti_core.search.search.edge_similarity_search', fake_similarity)
+
+    edges, scores = await edge_search(
+        driver=SimpleNamespace(),
+        cross_encoder=RecordingCrossEncoder(),
+        query='find the cosine top hit',
+        query_vector=[0.1, 0.2, 0.3],
+        group_ids=None,
+        config=EdgeSearchConfig(
+            search_methods=[EdgeSearchMethod.bm25, EdgeSearchMethod.cosine_similarity],
+            reranker=EdgeReranker.cross_encoder,
+        ),
+        search_filter=SearchFilters(),
+        limit=limit,
+    )
+
+    assert cosine_hit.fact in ranked_passages
+    assert len(ranked_passages) == 2 * limit
+    assert len(ranked_passages) > limit
+    assert edges[0].uuid == cosine_hit.uuid
+    assert len(edges) == limit
+    assert len(scores) == limit
+
+
+@pytest.mark.asyncio
+async def test_smoke_alice_works_at_zep_reaches_cross_encoder(monkeypatch):
+    """Smoke: BM25 fills weak hits; cosine has the real answer.
+
+    Query: "Where does Alice work?"
+    BM25:  "Alice likes coffee", "Alice lives in SF"  (and more)
+    Cosine: "Alice works at Zep"
+
+    Before the fix, CE only saw the first `limit` BM25 facts.
+    After, RRF shortlists up to `2 * limit` candidates so Zep reaches CE and can rank #1.
+    """
+    limit = 2
+    coffee = _edge('bm25-1', 'Alice likes coffee')
+    lives_in_sf = _edge('bm25-2', 'Alice lives in SF')
+    extra_bm25 = [_edge(f'bm25-{i}', f'Alice unrelated {i}') for i in range(3, 5)]
+    works_at_zep = _edge('cosine-1', 'Alice works at Zep')
+    ranked_passages: list[str] = []
+
+    async def fake_fulltext(*args, **kwargs):
+        return [coffee, lives_in_sf, *extra_bm25]
+
+    async def fake_similarity(*args, **kwargs):
+        return [works_at_zep]
+
+    class RecordingCrossEncoder:
+        async def rank(self, query: str, passages: list[str]):
+            ranked_passages.extend(passages)
+            scored = [(p, 0.99 if p == works_at_zep.fact else 0.1) for p in passages]
+            scored.sort(key=lambda item: item[1], reverse=True)
+            return scored
+
+    monkeypatch.setattr('graphiti_core.search.search.edge_fulltext_search', fake_fulltext)
+    monkeypatch.setattr('graphiti_core.search.search.edge_similarity_search', fake_similarity)
+
+    edges, scores = await edge_search(
+        driver=SimpleNamespace(),
+        cross_encoder=RecordingCrossEncoder(),
+        query='Where does Alice work?',
+        query_vector=[0.1, 0.2, 0.3],
+        group_ids=None,
+        config=EdgeSearchConfig(
+            search_methods=[EdgeSearchMethod.bm25, EdgeSearchMethod.cosine_similarity],
+            reranker=EdgeReranker.cross_encoder,
+        ),
+        search_filter=SearchFilters(),
+        limit=limit,
+    )
+
+    assert works_at_zep.fact in ranked_passages
+    assert len(ranked_passages) <= 2 * limit
+    assert edges[0].uuid == works_at_zep.uuid
+    assert edges[0].fact == 'Alice works at Zep'
+    assert len(edges) == limit
+    assert len(scores) == limit
```

#### Recent Merged Pull Requests:
- **PR #1955** (closed): fix: honour an explicit overlap_tokens=0 in content chunking (@Ayoubhm07)
- **PR #1939** (2026-09-28): Replace Ellipsis with on-request Copilot code review (@pevans)
- **PR #1936** (2026-09-28): Update anyio to 4.14.2 or later in the uv lock files (@jackaldenryan)
- **PR #1928** (closed): Add RFC for AI code review and coding agents (@pevans)
- **PR #1926** (2026-09-25): route MCP tools to the graph of the requested group_id (@pevans)
- **PR #1921** (2026-09-25): upgrade mcp_server to MCP SDK 2.x (@pevans)
- **PR #1910** (closed): OpenAIGenericClient: list every property as required in the json_schema response format (@v8eta)
- **PR #1902** (2026-09-21): Add contributor guidelines and an intake bot for issues and pull requests (@pevans)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
