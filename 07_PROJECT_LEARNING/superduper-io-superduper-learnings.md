# Forensic Learning Record (Deep Inspection): superduper-io/superduper

> **Canonical Artifact**: `07_PROJECT_LEARNING/superduper-io-superduper-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/superduper-io/superduper](https://github.com/superduper-io/superduper))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:13:04.389Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `superduper-io/superduper`
- **Description**: Superduper: End-to-end framework for building custom AI applications and agents.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 5329 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `applications/simple_rag/rag_plugin.py`
```
from superduper import Model
from superduper.base.query import Query

import typing as t


class Chunker(Model):
    chunk_size: int = 200

    def predict(self, text):
        text = text.split()
        chunks = [' '.join(text[i:i + self.chunk_size]) for i in range(0, len(text), self.chunk_size)]
        return chunks


class RAGModel(Model):
    """Model to use for RAG.

    :param prompt_template: Prompt template.
    :param select: Query to retrieve data.
    :param key: Key to use for get text out of documents.
    :param llm: Language model to use.
    """

    breaks: t.ClassVar[t.Sequence] = ('llm', 'prompt_template')

    prompt_template: str
    select: Query
    key: str
    llm: Model

    def _build_prompt(self, query, docs):
        chunks = [doc[self.key] for doc in docs]
        context = "\n\n".join(chunks)
        return self.prompt_template.format(context=context, query=query)

    def predict(self, query: str):
        """Predict on a single query string.

        :param query: Query string.
        """
        from superduper.base.datalayer import Datalayer

        assert isinstance(self.db, Datalayer)
        select = self.select.set_variables(db=self.db, query=query)
        results = [r.unpack() for r in select.execute()]
        prompt = self._build_prompt(query, results)
        return self.llm.predict(prompt)


def demo_func(db):
    import streamlit as st
    import openai

    openai.api_key = "your_openai_api_key"

    st.title("Chat with the Superduper docs!")

    user_input = st.text_input("Your Question:", key="question_input")

    rag = db.load('RAGModel', 'simple_rag')

    if st.button("Get Answer") and user_input:
        with st.spinner("Thinking..."):
            answer = rag.predict(user_input)
            st.write(f"**Answer:** {answer}")

```

### Core Architecture Module: `plugins/anthropic/superduper_anthropic/__init__.py`
```
from .model import AnthropicCompletions

__version__ = "0.7.0"

__all__ = ('AnthropicCompletions',)

```

### Core Architecture Module: `plugins/anthropic/superduper_anthropic/model.py`
```
import dataclasses as dc
import os
import typing as t

import anthropic
from anthropic import APIConnectionError, APIError, APIStatusError, APITimeoutError
from superduper.base.query_dataset import QueryDataset
from superduper.components.model import APIBaseModel
from superduper.misc.retry import Retry
from superduper.misc.utils import format_prompt

retry = Retry(
    exception_types=(APIConnectionError, APIError, APIStatusError, APITimeoutError)
)

KEY_NAME = 'ANTHROPIC_API_KEY'


class Anthropic(APIBaseModel):
    """Anthropic predictor.

    :param client_kwargs: The keyword arguments to pass to the client.
    """

    client_kwargs: t.Dict[str, t.Any] = dc.field(default_factory=dict)

    def postinit(self):
        """Post-initialization method."""
        self.model = self.model or self.identifier
        super().postinit()

    def setup(self, db=None):
        """Initialize the model.

        :param db: The database to use.
        """
        self.client = anthropic.Anthropic(
            api_key=os.environ[KEY_NAME], **self.client_kwargs
        )
        super().setup(db=db)


class AnthropicCompletions(Anthropic):
    """Cohere completions (chat) predictor.

    :param prompt: The prompt to use to seed the response.

    Example:
    -------
    >>> from superduper_anthropic.model import AnthropicCompletions
    >>>
    >>> model = AnthropicCompletions(
    >>>     identifier="claude-2.1",
    >>>     predict_kwargs={"max_tokens": 64},
    >>> )
    >>> model.predict_batches(["Hello, world!"])

    """

    prompt: str = ''

    @retry
    def predict(
        self,
        X: t.Union[str, list[dict]],
        context: t.Optional[t.List[str]] = None,
        **kwargs,
    ):
        """Generate text from a single input.

        :param X: The input to generate text from.
        :param context: The context to use for the prompt.
        :param kwargs: The keyword arguments to pass to the prompt function and
                        the llm model.
        """
        if isinstance(X, str):
            if context is not None:
                X = format_prompt(X, self.prompt, context=context)
            messages = [{'role': 'user', 'content': X}]

        elif isinstance(X, list) and all(isinstance(p, dict) for p in X):
            messages = X

        else:
            raise ValueError(
                f'Invalid input: {X}, only support str or messages format data'
            )
        message = self.client.messages.create(
            messages=messages,
            model=self.model,
            **{**self.predict_kwargs, **kwargs},
        )
        return message.content[0].text

    def predict_batches(self, dataset: t.Union[t.List, QueryDataset]) -> t.List:
        """Predict the embeddings of a dataset.

        :param dataset: The dataset to predict the embeddings of.
        """
        return [self.predict(dataset[i]) for i in range(len(dataset))]

```

### Core Architecture Module: `plugins/chromadb/superduper_chromadb/__init__.py`
```
from .chromadb import ChromaDBVectorSearcher as VectorSearcher

__version__ = "0.9.0"

__all__ = ['VectorSearcher']

```

### Core Architecture Module: `plugins/chromadb/superduper_chromadb/chromadb.py`
```
import re
import typing as t

import chromadb
import numpy as np
from superduper import CFG, logging
from superduper.backends.base.vector_search import (
    BaseVectorSearcher,
    VectorItem,
)

ID_PAYLOAD_KEY = "_id"


class ChromaDBVectorSearcher(BaseVectorSearcher):
    """
    Implementation of a vector index using [Qdrant](https://qdrant.tech/).

    :param identifier: Unique string identifier of index
    :param dimensions: Dimension of the vector embeddings
    :param h: Seed vectors ``numpy.ndarray``
    :param index: list of IDs
    :param measure: measure to assess similarity
    :param batch_size: Number of vectors to upsert in a single batch (default: 512)
    """

    def __init__(
        self,
        identifier: str,
        dimensions: int,
        measure: t.Optional[str] = None,
        component: str = 'VectorIndex',
        batch_size: int = 512,
    ):
        try:
            plugin, uri = CFG.vector_search_engine.split("://")
            port = int(CFG.vector_search_engine.split(":")[-1])
            assert plugin == "chromadb"
            assert uri.startswith('localhost'), 'ChromaDB only supported on localhost'

        except ValueError as e:
            if 'not enough values to unpack' in str(e):
                plugin = CFG.vector_search_engine
            else:
                raise e

        self.client = chromadb.HttpClient(host="localhost", port=port)

        self.identifier = identifier
        self.measure = measure
        self.batch_size = batch_size
        self.identifier = re.sub("\W+", "", identifier)

        self.collection = self.client.get_or_create_collection(
            name=self.identifier,
            metadata={"hnsw:space": self._distance_mapping(self.measure)},
            embedding_function=None,  # we'll supply vectors manually
        )

        self.component = component

    def initialize(self):
        """Initialize the vector index.

        :param db: Datalayer instance
        """
        pass

    def __len__(self):
        return self.collection.count()

    def add(self, items: t.Sequence[VectorItem], cache: bool = False) -> None:
        """Add vectors to the index.

        :param items: List of vectors to add
        :param cache: Cache vectors (not used in Qdrant implementation).
        """
        if not items:
            return

        vectors = []
        ids = []
        for item in items:
            if hasattr(item.vector, "tolist"):
                vector = item.vector.tolist()
            else:
                vector = item.vector
            vectors.append(vector)
            ids.append(item.id)

        total_batches = (len(vectors) + self.batch_size - 1) // self.batch_size

        logging.info(
            f"Adding {len(vectors)} points to ChromaDB index '{self.identifier}' "
            f"in {total_batches} batches (batch_size={self.batch_size})"
        )

        for batch_idx, i in enumerate(range(0, len(vectors), self.batch_size), 1):
            sub_vectors = vectors[i : i + self.batch_size]
            sub_ids = ids[i : i + self.batch_size]

            logging.info(f"Processing batch {batch_idx}/{total_batches} ")

            self.collection.add(
                ids=sub_ids,
                embeddings=sub_vectors,
            )

        logging.info(
            f"✓ Successfully added all {len(vectors)} points to Qdrant index "
            f"'{self.identifier}' in {total_batches} batches"
        )

    def drop(self):
        """Drop the vector index."""
        try:
            self.client.delete_collection(self.identifier)
        except Exception:
            pass

    def delete(self, ids: t.Sequence[str]) -> None:
        """Delete vectors from the Chroma collection by ID."""
        self.collection.delete(ids=list(ids))

    def find_nearest_from_id(
        self,
        _id,
        n: int = 100,
        within_ids: t.Sequence[str] = (),
    ) -> t.Tuple[t.List[str], t.List[float]]:
        """Find the nearest vectors to a given ID.

        :param _id: ID to search
        :param n: Number of results to return
        :param within_ids: List of IDs to search within
        """
        got = self.collection.get(ids=[_id], include=["embeddings", "ids"])
        if not got or not got.get("ids"):
            raise ValueError(f"id not found: {_id}")
        h = got["embeddings"][0]  # the stored embedding for that id
        return self.find_nearest_from_array(h=h, n=n, within_ids=within_ids)

    def find_nearest_from_array(
        self,
        h: np.typing.ArrayLike,
        n: int = 100,
        within_ids: t.Sequence[str] = (),
    ) -> t.Tuple[t.List[str], t.List[float]]:
        """Find the nearest vectors to a given vector.

        :param h: Vector to search
        :param n: Number of results to return
        :param within_ids: List of IDs to search within
        """
        if isinstance(h, np.ndarray):
            h = h.tolist()
        else:
            assert isinstance(h, list), "Input vector must be a list or numpy array"

        res = self.collection.query(
            query_embeddings=[h], n_results=n, include=["distances"]
        )

        ids = res.get("ids", [[]])[0]
        dists = res.get("distances", [[]])[0]

        if within_ids:
            logging.warning(f"Searching within specific IDs: {within_ids}")

            ix = [i for i, id in enumerate(ids) if id in within_ids]
            ids = [ids[i] for i in ix]
            dists = [dists[i] for i in ix]
        return ids, dists

    def _distance_mapping(self, measure: t.Optional[str] = None):
        if measure == "cosine":
            return 'cosine'
        if measure == "l2":
            return 'l2'
        if measure == "dot":
            return 'ip'
        else:
            raise ValueError(f"Unsupported measure: {measure}")

```

### Core Architecture Module: `plugins/cohere/superduper_cohere/__init__.py`
```
from .model import CohereEmbed, CohereGenerate

__version__ = "0.7.0"

__all__ = 'CohereEmbed', 'CohereGenerate'

```

### Core Architecture Module: `plugins/cohere/superduper_cohere/model.py`
```
import dataclasses as dc
import os
import typing as t

import cohere
import tqdm
from cohere.error import CohereAPIError, CohereConnectionError
from superduper.base.query_dataset import QueryDataset
from superduper.components.model import APIBaseModel
from superduper.misc.retry import Retry
from superduper.misc.utils import format_prompt

retry = Retry(exception_types=(CohereAPIError, CohereConnectionError))

KEY_NAME = 'COHERE_API_KEY'


class Cohere(APIBaseModel):
    """Cohere predictor.

    :param client_kwargs: The keyword arguments to pass to the client.
    """

    client_kwargs: t.Dict[str, t.Any] = dc.field(default_factory=dict)

    def postinit(self):
        """Post-initialization method."""
        self.identifier = self.identifier or self.model
        return super().postinit()


class CohereEmbed(Cohere):
    """Cohere embedding predictor.

    :param shape: The shape as ``tuple`` of the embedding.
    :param batch_size: The batch size to use for the predictor.

    Example:
    -------
    >>> from superduper_cohere.model import CohereEmbed
    >>> model = CohereEmbed(identifier='embed-english-v2.0', batch_size=1)
    >>> model..predict('Hello world')

    """

    batch_size: int = 100

    @retry
    def predict(self, X: str):
        """Predict the embedding of a single text.

        :param X: The text to predict the embedding of.
        """
        client = cohere.Client(os.environ[KEY_NAME], **self.client_kwargs)
        e = client.embed(texts=[X], model=self.identifier, **self.predict_kwargs)
        return e.embeddings[0]

    @retry
    def _predict_a_batch(self, texts: t.List[str]):
        client = cohere.Client(os.environ[KEY_NAME], **self.client_kwargs)
        out = client.embed(texts=texts, model=self.identifier, **self.predict_kwargs)
        return [r for r in out.embeddings]

    def predict_batches(self, dataset: t.Union[t.List, QueryDataset]) -> t.List:
        """Predict the embeddings of a dataset.

        :param dataset: The dataset to predict the embeddings of.
        """
        out = []
        for i in tqdm.tqdm(range(0, len(dataset), self.batch_size)):
            out.extend(
                self._predict_a_batch(
                    dataset[i : i + self.batch_size], **self.predict_kwargs
                )
            )
        return out


class CohereGenerate(Cohere):
    """Cohere realistic text generator (chat predictor).

    :param takes_context: Whether the model takes context into account.
    :param prompt: The prompt to use to seed the response.

    Example:
    -------
    >>> from superduper_cohere.model import CohereGenerate
    >>> model = CohereGenerate(identifier='base-light', prompt='Hello, {context}')
    >>> model.predict('', context=['world!'])

    """

    signature: str = '*args,**kwargs'
    takes_context: bool = True
    prompt: str = ''

    @retry
    def predict(self, prompt: str, context: t.Optional[t.List[str]] = None):
        """Predict the generation of a single prompt.

        :param prompt: The prompt to generate text from.
        :param context: The context to use for the prompt.
        """
        if context is not None:
            prompt = format_prompt(prompt, self.prompt, context=context)
        client = cohere.Client(os.environ[KEY_NAME], **self.client_kwargs)
        resp = client.generate(
            prompt=prompt, model=self.identifier, **self.predict_kwargs
        )
        return resp.generations[0].text

    @retry
    def predict_batches(self, dataset: t.Union[t.List, QueryDataset]) -> t.List:
        """Predict the generations of a dataset.

        :param dataset: The dataset to predict the generations of.
        """
        return [self.predict(dataset[i]) for i in range(len(dataset))]

```

### Core Architecture Module: `plugins/generate_readme.py`
```
#!/usr/bin/env python3
"""
Script to generate or update README.md files for Python plugin projects.

This script reads information from pyproject.toml and source code files to
generate a standardized README.md for each plugin in the plugins directory.
"""

import argparse
import ast
import re
from pathlib import Path
from typing import Dict, List, Optional, Union

import toml

README_TEMPLATE = """# {{plugin_name}}

{{description}}

## Installation

```bash
pip install {{plugin_name}}
```

## API


- [Code](https://github.com/superduper-io/superduper/tree/main/plugins/{{name}})
- [API-docs](/docs/api/plugins/{{plugin_name}})

| Class | Description |
|---|---|
{{classes_table}}

{{examples}}"""


def extract_pyproject_info(pyproject_path: Path) -> Dict[str, str]:
    """
    Extract necessary information from pyproject.toml.

    Args:
    ----
        pyproject_path (Path): Path to the pyproject.toml file.

    Returns:
    -------
        Dict[str, str]: A dictionary containing the extracted information.

    """
    with pyproject_path.open("r", encoding="utf-8") as f:
        pyproject_data = toml.load(f)
    project = pyproject_data.get("project", {})
    name = project.get("name", "")
    description = project.get("description", "")
    urls = project.get("urls", {})
    source_url = urls.get("source", "")
    return {
        "name": name,
        "description": description,
        "source_url": source_url,
        "api_docs_url": f"/docs/api/plugins/{name}",
    }


def parse_example(docstring: str) -> Optional[List[Dict[str, str]]]:
    """
    Parse the docstring to extract an example with text descriptions and code blocks.

    Args:
    ----
        docstring (str): The docstring of a class or method.

    Returns:
    -------
        Optional[List[Dict[str, str]]]: A list of example parts, each part is a
                                        dict with 'type' and 'content'.

    """
    lines = docstring.split('\n')
    in_example_section = False
    example_parts = []
    current_part = {'type': None, 'content': []}

    for i, line in enumerate(lines):
        stripped_line = line.strip()
        if stripped_line.startswith('Example:'):
            in_example_section = True
            continue
        if in_example_section:
            if stripped_line.strip() == '-------':
                continue
            if not stripped_line:
                # Empty line
                if current_part['content']:
                    # Finish the current part
                    example_parts.append(
                        {
                            'type': current_part['type'],
                            'content': '\n'.join(current_part['content']).strip(),
                        }
                    )
                    current_part = {'type': None, 'content': []}
                continue
            if stripped_line.startswith('>>>'):
                # Code line
                if current_part['type'] != 'code':
                    if current_part['content']:
                        # Finish the current part
                        example_parts.append(
                            {
                                'type': current_part['type'],
                                'content': '\n'.join(current_part['content']).strip(),
                            }
                        )
                    current_part = {'type': 'code', 'content': []}
                code_line = line.strip()[4:]
                current_part['content'].append(code_line)
            else:
                # Text line
                if current_part['type'] != 'text':
                    if current_part['content']:
                        # Finish the current part
                        example_parts.append(
                            {
                                'type': current_part['type'],
                                'content': '\n'.join(current_part['content']).strip(),
                            }
                        )
                    current_part = {'type': 'text', 'content': []}
                current_part['content'].append(stripped_line)
    # Add the last part if any
    if current_part['content']:
        example_parts.append(
            {
                'type': current_part['type'],
                'content': '\n'.join(current_part['content']).strip(),
            }
        )

    return example_parts if example_parts else None


def get_classes_with_docstrings(
    package_dir: Path, package_name: str
) -> List[Dict[str, Union[str, List[Dict[str, str]]]]]:
    """
    Parse Python files to extract classes and their docstrings.

    Args:
    ----
        package_dir (Path): Path to the package directory containing Python modules.
        package_name (str): The package's importable name.

    Returns:
    -------
        List[Dict[str, Union[str, List[Dict[str, str]]]]]: A list of dictionaries
                                                           with class information.

    """
    classes_info = []
    for py_file in package_dir.rglob("*.py"):
        with py_file.open("r", encoding="utf-8") as f:
            try:
                tree = ast.parse(f.read(), filename=str(py_file))
            except SyntaxError:
                continue  # Skip files with syntax errors
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                class_name = node.name
                if class_name.startswith("_"):
                    continue
                module_path = py_file.relative_to(package_dir.parent)
                module_name = ".".join(module_path.with_suffix("").parts)
                full_class_name = f"{module_name}.{class_name}"
                docstring = ast.get_docstring(node)
                if docstring:
                    summary_line = docstring.strip().split("\n")[0]
                    if '# noqa' in docstring:
                        continue
                    example_parts = parse_example(docstring)
                else:
                    summary_line = ""
                    example_parts = None
                    continue
                classes_info.append(
                    {
                        "class_name": f"{class_name}",
                        "full_class_name": f"`{full_class_name}`",
                        "description": summary_line,
                        "example_parts": example_parts,
                    }
                )
    return classes_info


def generate_readme_content(
    info: Dict[str, str],
    classes_info: List[Dict[str, Union[str, List[Dict[str, str]]]]],
) -> str:
    """
    Generate the README.md content based on extracted information.

    :param info: Extracted information from pyproject.toml.
    :param classes_info: Extracted classes and their docstrings.
    """
    plugin_name = info["name"]
    # Replace plugin name in the template
    template = README_TEMPLATE.replace("{{plugin_name}}", plugin_name)

    # Replace name in the source url
    template = template.replace(
        "{{name}}",
        plugin_name.split("_", 1)[1],
    )

    # Replace the description
    template = template.replace("{{description}}", info["description"])

    # Generate the classes table
    classes_table = ""
    for cls in classes_info:
        class_name = cls["full_class_name"]
        description = cls["description"]
        classes_table += f"| {class_name} | {description} |\n"
    template = template.replace("{{classes_table}}", classes_table)

    # Generate the examples section
    examples = ""
    for cls in classes_info:
        example_parts = cls.get("example_parts")
        if example_parts:
            examples += f"### {cls['class_name']}\n\n"
            for part in example_parts:
                if part['type'] == 'text':
                    examples += part['content'] + "\n\n"
                elif part['type'] == 'code':
                    examples += "```python\n"
                    examples += part['conten
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2938** (2026-06-10): **fix(snowflake): typo seperate -> separate**
  *Symptoms*: Tiny typo in a code comment in [plugins/snowflake/superduper_snowflake/vector_search.py:98](plugins/snowflake/superduper_snowflake/vector_search.py#L98). Comment only, no behavior change.

- **Issue #2927** (2026-02-03): **close**
  *Symptoms*: close
  **Post-Mortem & Fix Analysis**:
  > `parse_query` does not parse SQL. 

- **Issue #2925** (2026-02-08): **chore(plugins): define version in pyproject for openai/mongodb/sql; read __version__ via importlib.metadata (#2722)**
  *Symptoms*: Summary •  Move plugin version to [project].version in pyproject.toml for: openai, mongodb, sql. •  Remove [tool.setuptools.dynamic] version mapping. •  In package __init__.py, derive __version__ from installed distribution via importlib.metadata (fallback to 0.0.0 if not installed).  Why Per #2722, modern packaging recommends declaring version in pyproject.toml rather than __init__.py. This change aligns plugins with the main project and simplifies packaging.  Notes •  No runtime behavior changes expected. •  Kept __version__ available for importers. •  Tested locally: packages install/editable and import __version__ resolves from distribution.  Follow-ups •  Apply the same change across remaining plugins once this approach is approved.  Refs: #2722

- **Issue #2921** (2025-09-01): **Only update new vectors**
  *Symptoms*: 

- **Issue #2920** (2025-08-26): **[PLUGINS] Bump Version [chromadb]**
  *Symptoms*: 

- **Issue #2919** (2025-08-26): **Bump Version [chromadb]**
  *Symptoms*: 

- **Issue #2918** (2025-08-26): **[PLUGINS] Bump Version [all]**
  *Symptoms*: 

- **Issue #2917** (2026-01-20): **Created Groq Plugin**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Hello @Geoff-Robin - nice work! A question: wouldn't it be possible to connect to this model directly with the `openai` API? You can use our `superduper_openai` plugin for that.
  > Hi @blythed, you can definitely call Groq models through superduper_openai plugin but inference time is significantly slower through OpenAI API Client. This is mostly due to Groq's custom LPU that makes it a lot faster. 
  > @Geoff-Robin can you look at the CI?

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

### Incident Patch 1: `e4e9a18f` (2025-08-14)
**Commit Message**: Fix the crontab job execution issue

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Fix the secrets-error
 - Fix job failure propagation logic and prevent duplicate inverse dependencies
 - Fix the gRPC usage issue in Qdrant
+- Fix the crontab job execution issue
 
 ## [0.7.0](https://github.com/superduper-io/superduper/compare/0.7.0...0.6.0])    (2025-May-26)
 
```

**File**: `superduper/backends/local/crontab.py` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ def initialize(self):
             self.scheduler.add_job(
                 (
                     self.job.run_and_propagate_failure
-                    if not self.job.on_compute
+                    if not self.on_compute
                     else self.job.run_on_compute
                 ),
                 "cron",
```

---

### Incident Patch 2: `9daa51bf` (2025-07-23)
**Commit Message**: Revert "Batch inserts with qdrant-client"

This reverts commit 1702284e7acdbe480f7ccd5f20e9859c5e504a4d.

**File**: `plugins/qdrant/superduper_qdrant/qdrant.py` (modified, +1/-7)
```diff
@@ -114,13 +114,7 @@ def add(self, items: t.Sequence[VectorItem], cache: bool = False) -> None:
             )
             points.append(point)
         logging.info(f"Adding {len(points)} points to Qdrant index '{self.identifier}'")
-        batch_size = 50
-        for i in range(0, len(points), batch_size):
-            batch_points = points[i:i + batch_size]
-            logging.debug(f"Upserting batch of {len(batch_points)} points")
-            if not batch_points:
-                continue
-            self.client.upsert(collection_name=self.identifier, points=batch_points)
+        self.client.upsert(collection_name=self.identifier, points=points)
 
     def drop(self):
         """Drop the vector index."""
```

---

### Incident Patch 3: `499c7a31` (2025-07-23)
**Commit Message**: Revert "[PLUGINS] Bump Version [qdrant]"

This reverts commit 6f30b214d9b8ec780d7a9686ad6d64e98d9343c4.

**File**: `plugins/qdrant/superduper_qdrant/__init__.py` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 from .qdrant import QdrantVectorSearcher as VectorSearcher
 
-__version__ = "0.9.4"
+__version__ = "0.9.3"
 
 __all__ = ['VectorSearcher']
```

---

### Incident Patch 4: `0ac6c9ff` (2025-07-16)
**Commit Message**: Fix list vector input

**File**: `plugins/qdrant/superduper_qdrant/qdrant.py` (modified, +5/-1)
```diff
@@ -97,9 +97,13 @@ def add(self, items: t.Sequence[VectorItem], cache: bool = False) -> None:
         """
         points = []
         for item in items:
+            if hasattr(item.vector, "tolist"):
+                vector = item.vector.tolist()
+            else:
+                vector = item.vector
             point = models.PointStruct(
                 id=self._convert_id(item.id),
-                vector=item.vector.tolist(),
+                vector=vector,
                 payload={ID_PAYLOAD_KEY: item.id},
             )
             points.append(point)
```

---

### Incident Patch 5: `8dbcbdc8` (2025-07-16)
**Commit Message**: Fix the metadata set_failed issue

**File**: `superduper/base/metadata.py` (modified, +3/-4)
```diff
@@ -247,11 +247,10 @@ def set_failed(self, db: 'Datalayer', reason: str, message: str | None = None):
         )
         for idep in self.inverse_dependencies:
             job = db['Job'].get(job_id=idep, decode=True)
-            if job.status != STATUS_FAILED:
+            if job is None:
+                continue
+            elif job.status != STATUS_FAILED:
                 logging.info(f'Setting downstream job {idep} status to failed')
-                if job is None:
-                    continue
-
                 job.set_failed(
                     db, reason=f"Upstream dependency {self.job_id} failed", message=None
                 )
```

---

### Incident Patch 6: `089b3f57` (2025-07-16)
**Commit Message**: Fix job failure propagation logic and prevent duplicate inverse dependencies

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -26,6 +26,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Optimize vector search performance by improving component caching and UUID mapping
 - Add info to Template
 - Fix the secrets-error
+- Fix job failure propagation logic and prevent duplicate inverse dependencies
 
 ## [0.7.0](https://github.com/superduper-io/superduper/compare/0.7.0...0.6.0])    (2025-May-26)
 
```

**File**: `superduper/base/metadata.py` (modified, +9/-6)
```diff
@@ -246,14 +246,17 @@ def set_failed(self, db: 'Datalayer', reason: str, message: str | None = None):
             f'Setting job status for inverse dependencies to failed: {self.inverse_dependencies}'
         )
         for idep in self.inverse_dependencies:
-            logging.info(f'Setting downstream job {idep} status to failed')
             job = db['Job'].get(job_id=idep, decode=True)
-            if job is None:
-                continue
+            if job.status != STATUS_FAILED:
+                logging.info(f'Setting downstream job {idep} status to failed')
+                if job is None:
+                    continue
 
-            job.set_failed(
-                db, reason=f"Upstream dependency {self.job_id} failed", message=None
-            )
+                job.set_failed(
+                    db, reason=f"Upstream dependency {self.job_id} failed", message=None
+                )
+            else:
+                logging.info(f'Downstream job {idep} already failed, skipping')
         logging.info(f'Setting job status {self.job_id} to failed... DONE')
 
         db.metadata.set_component_failed(
```

**File**: `superduper/components/component.py` (modified, +3/-0)
```diff
@@ -607,6 +607,9 @@ def create_jobs(
                 dep_job = lookup[dep]
                 if job.job_id not in dep_job.dependencies:
                     dep_job.inverse_dependencies.append(job.job_id)
+
+        for job in lookup.values():
+            job.inverse_dependencies = list(set(job.inverse_dependencies))
         return local_jobs
 
     @property
```

---

### Incident Patch 7: `d07d3263` (2025-07-16)
**Commit Message**: Fix qdrant ut

**File**: `plugins/qdrant/plugin_test/test_vector_searcher.py` (modified, +4/-1)
```diff
@@ -20,8 +20,11 @@ def index_data():
 )
 @pytest.mark.parametrize("measure", ["l2", "dot", "cosine"])
 def test_index(index_data, measure, vector_index_cls):
+    from superduper import CFG
+
+    CFG.vector_search_engine = "qdrant://:memory:"
     vectors, ids = index_data
-    h = vector_index_cls(uuid="123456", measure=measure, dimensions=3)
+    h = vector_index_cls(identifier="123456", measure=measure, dimensions=3)
     h.add(items=[VectorItem(id=id_, vector=hh) for hh, id_ in zip(vectors, ids)])
     y = np.array([0, 0, 1])
     res, _ = h.find_nearest_from_array(y, 1)
```

---

### Incident Patch 8: `739e0b0d` (2025-07-16)
**Commit Message**: Revert "Move get_schema lower into the execute logic"

This reverts commit 498a19830ecb35bd7469e0c00f12c1cecfa6c482.

**File**: `superduper/backends/base/data_backend.py` (modified, +6/-5)
```diff
@@ -282,20 +282,19 @@ def get(self, query: Query, raw: bool = False):
         except IndexError:
             return None
 
-    def _wrap_results(self, query: Query, result, raw: bool = False):
+    def _wrap_results(self, query: Query, result, schema, raw: bool = False):
         pid = self.primary_id(query.table)
         for r in result:
             if pid in r:
                 r[pid] = str(r[pid])
             if '_source' in r:
                 r['_source'] = str(r['_source'])
 
+        result = [self._decode_document_fields(r, schema, db=self.db) for r in result]
+
         if raw:
             return result
 
-        schema = self.get_schema(query)
-        result = [self._decode_document_fields(r, schema, db=self.db) for r in result]
-
         return [Document.decode(r, schema=schema, db=self.db) for r in result]
 
     def execute(self, query: Query, raw: bool = False):
@@ -306,13 +305,15 @@ def execute(self, query: Query, raw: bool = False):
         """
         query = query if '.outputs' not in str(query) else query.complete_uuids(self.db)
 
+        schema = self.get_schema(query)
+
         if query.decomposition.pre_like:
             return self.pre_like(query, raw=raw)
 
         if query.decomposition.post_like:
             return self.post_like(query, raw=raw)
 
-        return self._wrap_results(query, self.select(query), raw=raw)
+        return self._wrap_results(query, self.select(query), schema=schema, raw=raw)
 
     def get_schema(self, query) -> 'Schema':
         """Get the schema of a query.
```

---

### Incident Patch 9: `d31b9cf3` (2025-07-16)
**Commit Message**: Fix the sectets error andd depth parameter to logging.info

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -12,6 +12,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 #### Changed defaults / behaviours
 
 - Add offset parameter to limit query
+- Add depth parameter to logging.info
 
 ### Bug fixes
 
@@ -23,6 +24,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Fix auto schema inference for nested JSON types
 - Optimize vector search performance by improving component caching and UUID mapping
 - Add info to Template
+- Fix the secrets-error
 
 ## [0.7.0](https://github.com/superduper-io/superduper/compare/0.7.0...0.6.0])    (2025-May-26)
 
```

**File**: `plugins/qdrant/superduper_qdrant/qdrant.py` (modified, +3/-1)
```diff
@@ -44,7 +44,9 @@ def __init__(
             else:
                 raise e
 
-        assert plugin == "qdrant", "Only 'qdrant' vector search engine is supported in QdrantVectorSearcher."
+        assert (
+            plugin == "qdrant"
+        ), "Only 'qdrant' vector search engine is supported in QdrantVectorSearcher."
 
         # Use an in-memory instance by default
         # https://github.com/qdrant/qdrant-client#local-mode
```

**File**: `superduper/backends/local/cluster.py` (modified, +3/-1)
```diff
@@ -32,7 +32,9 @@ class LocalCluster(Cluster):
     @classmethod
     def build(cls, CFG, **kwargs):
         """Build the local cluster."""
-        searcher_impl = load_plugin(CFG.vector_search_engine.split('://')[0]).VectorSearcher
+        searcher_impl = load_plugin(
+            CFG.vector_search_engine.split('://')[0]
+        ).VectorSearcher
 
         return LocalCluster(
             scheduler=LocalScheduler(),
```

**File**: `superduper/base/config_settings.py` (modified, +1/-0)
```diff
@@ -49,6 +49,7 @@ def load_secrets(secrets_dir: str | None = None):
 
     if not os.path.isdir(secrets_dir):
         warn(f"Warning: The path '{secrets_dir}' is not a valid directory.")
+        return
 
     for key_dir in os.listdir(secrets_dir):
         key_path = os.path.join(secrets_dir, key_dir)
```

**File**: `superduper/base/logger.py` (modified, +3/-2)
```diff
@@ -106,13 +106,14 @@ def multikey_debug(msg: str, *args):
         logger.opt(depth=1).debug(" ".join(map(str, (msg, *args))))
 
     @staticmethod
-    def multikey_info(msg: str, *args):
+    def multikey_info(msg: str, *args, depth: int = 1):
         """Log a message with the INFO level.
 
         :param msg: The message to log.
         :param args: Additional arguments to log.
+        :param depth: The depth of the log message in the stack.
         """
-        logger.opt(depth=1).info(" ".join(map(str, (msg, *args))))
+        logger.opt(depth=depth).info(" ".join(map(str, (msg, *args))))
 
     @staticmethod
     def multikey_success(msg: str, *args):
```

---

### Incident Patch 10: `0677b389` (2025-07-15)
**Commit Message**: Fix qdrant plugin

**File**: `plugins/qdrant/superduper_qdrant/qdrant.py` (modified, +29/-20)
```diff
@@ -28,39 +28,52 @@ class QdrantVectorSearcher(BaseVectorSearcher):
 
     def __init__(
         self,
-        uuid: str,
+        identifier: str,
         dimensions: int,
         measure: t.Optional[str] = None,
+        component: str = 'VectorIndex',
     ):
         config_dict = deepcopy(CFG.vector_search_kwargs)
-        self.vector_name: t.Optional[str] = config_dict.pop("vector_name", None)
+        try:
+            plugin, uri = CFG.vector_search_engine.split("://")
+            if uri:
+                config_dict['location'] = uri
+        except ValueError as e:
+            if 'not enough values to unpack' in str(e):
+                plugin = CFG.vector_search_engine
+            else:
+                raise e
+
+        assert plugin == "qdrant", "Only 'qdrant' vector search engine is supported in QdrantVectorSearcher."
+
         # Use an in-memory instance by default
         # https://github.com/qdrant/qdrant-client#local-mode
         config_dict = config_dict or {"location": ":memory:"}
         self.client = QdrantClient(**config_dict)
-        self.collection_name = uuid
+        self.identifier = identifier
         self.measure = measure
 
-        self.collection_name = re.sub("\W+", "", uuid)
-        if not self.client.collection_exists(self.collection_name):
+        self.identifier = re.sub("\W+", "", identifier)
+        if not self.client.collection_exists(self.identifier):
             measure = (
                 measure.name if isinstance(measure, VectorIndexMeasureType) else measure
             )
             distance = self._distance_mapping(measure)
             self.client.create_collection(
-                collection_name=self.collection_name,
+                collection_name=self.identifier,
                 vectors_config=models.VectorParams(size=dimensions, distance=distance),
             )
+        self.component = component
 
-    def initialize(self, db):
+    def initialize(self):
         """Initialize the vector index.
 
         :param db: Datalayer instance
         """
         pass
 
     def __len__(self):
-        return self.client.get_collection(self.collection_name).vectors_count
+        return self.client.get_collection(self.identifier).vectors_count
 
     def _create_collection(self):
         measure = (
@@ -70,7 +83,7 @@ def _create_collection(self):
         )
         distance = self._distance_mapping(measure)
         self.client.create_collection(
-            collection_name=self.collection_name,
+            collection_name=self.identifier,
             vectors_config=models.VectorParams(size=self.dimensions, distance=distance),
         )
 
@@ -84,28 +97,24 @@ def add(self, items: t.Sequence[VectorItem], cache: bool = False) -> None:
         for item in items:
             point = models.PointStruct(
                 id=self._convert_id(item.id),
-                vector=(
-                    {self.vector_name: item.vector.tolist()}
-                    if self.vector_name
-                    else item.vector.tolist()
-                ),
+                vector=item.vector.tolist(),
                 payload={ID_PAYLOAD_KEY: item.id},
             )
             points.append(point)
-        self.client.upsert(collection_name=self.collection_name, points=points)
+        self.client.upsert(collection_name=self.identifier, points=points)
 
     def drop(self):
         """Drop the vector index."""
-        if self.client.collection_exists(self.collection_name):
-            self.client.delete_collection(self.collection_name)
+        if self.client.collection_exists(self.identifier):
+            self.client.delete_collection(self.identifier)
 
     def delete(self, ids: t.Sequence[str]) -> None:
         """Delete vectors from the index.
 
         :param ids: List of IDs to delete
         """
         self.client.delete(
-            collection_name=self.collection_name,
+            collection_name=self.identifier,
             points_selector=mo
```

**File**: `superduper/backends/local/cluster.py` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@ class LocalCluster(Cluster):
     @classmethod
     def build(cls, CFG, **kwargs):
         """Build the local cluster."""
-        searcher_impl = load_plugin(CFG.vector_search_engine).VectorSearcher
+        searcher_impl = load_plugin(CFG.vector_search_engine.split('://')[0]).VectorSearcher
 
         return LocalCluster(
             scheduler=LocalScheduler(),
```

#### Recent Merged Pull Requests:
- **PR #2938** (closed): fix(snowflake): typo seperate -> separate (@vincere-mori)
- **PR #2925** (closed): chore(plugins): define version in pyproject for openai/mongodb/sql; read __version__ via importlib.metadata (#2722) (@AhmadYasser1)
- **PR #2921** (2025-09-01): Only update new vectors (@blythed)
- **PR #2920** (2025-08-26): [PLUGINS] Bump Version [chromadb] (@jieguangzhou)
- **PR #2919** (2025-08-26): Bump Version [chromadb] (@jieguangzhou)
- **PR #2918** (2025-08-26): [PLUGINS] Bump Version [all] (@jieguangzhou)
- **PR #2917** (closed): Created Groq Plugin (@Geoff-Robin)
- **PR #2914** (2025-08-15): Update ci_code.yml (@blythed)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
