# Forensic Learning Record (Deep Inspection): superduper-io/superduper

> **Canonical Artifact**: `07_PROJECT_LEARNING/superduper-io-superduper-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/superduper-io/superduper](https://github.com/superduper-io/superduper))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:55:29.735Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `superduper-io/superduper`
- **Description**: Superduper: End-to-end framework for building custom AI applications and agents.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 5327 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `plugins/mongodb/superduper_mongodb/utils.py`
```
import mongomock
import pymongo
from pymongo.errors import ServerSelectionTimeoutError
from superduper import logging
from superduper.misc.anonymize import anonymize_url


def _get_avaliable_conn(uri: str, **kwargs):
    """Get an available connection to the database.

    This can avoid some issues with database permission verification.
    1. Try to connect to the database with the given URI.
    2. Try to connect to the database with the base URI without database name.

    :param uri: The URI of the database.
    :param kwargs: Additional keyword arguments for the MongoClient.
    """
    base_uri, db_name = uri.rsplit("/", 1)
    kwargs.setdefault("serverSelectionTimeoutMS", 5000)

    raise_e = None

    # Try to connect to the database with the given URI
    client: pymongo.MongoClient = pymongo.MongoClient(uri, **kwargs)
    try:
        client[db_name].list_collection_names()
        return client
    except ServerSelectionTimeoutError as e:
        # If the server is not available, raise the exception
        raise e
    except Exception as e:
        uri_mask = anonymize_url(uri)
        logging.warn(
            f"Failed to connect to the database with the given URI: {uri_mask}"
        )
        logging.error(str(e))
        raise_e = e
        client.close()

    # Try to connect to the database with base URI without database name
    client = pymongo.MongoClient(base_uri, **kwargs)
    base_uri_mask = anonymize_url(base_uri)
    try:
        logging.info(
            f"Trying to connect to the database with the base URI: {base_uri_mask}"
        )
        client[db_name].list_collection_names()
        return client
    except Exception as e:
        logging.warn(
            f"Failed to connect to the database with the base URI: {base_uri_mask}"
        )
        logging.error(str(e))
        client.close()

    if raise_e:
        logging.error("Failed to connect to the database")
        raise raise_e


def connection_callback(uri, flavour):
    """Get the connection to the database.

    :param uri: The URI of the database.
    :param flavour: The flavour of the database.
    """
    flavour = uri.split(":")[0] if flavour is None else flavour
    if flavour == "mongodb":
        name = uri.split("/")[-1]
        conn = _get_avaliable_conn(uri, serverSelectionTimeoutMS=5000)

    elif flavour == "atlas":
        name = uri.split("/")[-1]
        conn = pymongo.MongoClient(
            "/".join(uri.split("/")[:-1]),
            serverSelectionTimeoutMS=5000,
        )

    elif flavour == "mongomock":
        name = uri.split("/")[-1]
        conn = mongomock.MongoClient()
    else:
        raise NotImplementedError
    return conn, name

```

### Core Architecture Module: `plugins/sql/superduper_sql/utils.py`
```
import typing as t

from ibis.expr.datatypes import dtype
from superduper.base.datatype import (
    ID,
    Array,
    BaseDataType,
    BaseVector,
    FieldType,
    FileItem,
    Vector,
)
from superduper.base.schema import Schema

SPECIAL_ENCODABLES_FIELDS = {
    FileItem: "str",
}


def _convert_field_type_to_ibis_type(field_type: FieldType):
    if field_type.identifier == ID.identifier:
        ibis_type = "String"
    else:
        ibis_type = field_type.identifier
    return dtype(ibis_type)


def convert_schema_to_fields(
    schema: Schema, json_native: bool, vector_impl: t.Type[BaseVector]
) -> dict:
    """Return the raw fields.

    Get a dictionary of fields as keys and datatypes as values.
    This is used to create ibis tables.

    :param schema: The schema to convert
    """
    fields = {}

    for k, v in schema.fields.items():
        if isinstance(v, FieldType):
            fields[k] = _convert_field_type_to_ibis_type(v)
        else:
            if isinstance(v, Vector):
                v = vector_impl(shape=v.shape, dtype=v.dtype)

            assert isinstance(v, BaseDataType)

            if not json_native and v.dtype == "json":
                fields[k] = dtype("str")
            elif isinstance(v, Array):
                fields[k] = dtype("str")
            else:
                fields[k] = dtype(v.dtype)

    return fields

```

### Core Architecture Module: `plugins/torch/superduper_torch/utils.py`
```
from __future__ import annotations

import typing as t
from contextlib import contextmanager

if t.TYPE_CHECKING:
    from torch import device as _device
    from torch.nn.modules import Module


def device_of(module: Module) -> t.Union[_device, str]:
    """
    Get device of a model.

    :param module: PyTorch model
    """
    try:
        return next(iter(module.state_dict().values())).device
    except StopIteration:
        return 'cpu'


@contextmanager
def eval(module: Module) -> t.Iterator[None]:
    """
    Temporarily set a module to evaluation mode.

    :param module: PyTorch module
    """
    was_training = module.training
    try:
        module.eval()
        yield
    finally:
        if was_training:
            module.train()


@contextmanager
def set_device(module: Module, device: _device):
    """
    Temporarily set a device of a module.

    :param module: PyTorch module
    :param device: Device to set
    """
    device_before = device_of(module)
    try:
        module.to(device)
        yield
    finally:
        module.to(device_before)


def to_device(
    item: t.Any,  # lists or dicts of Tensors
    device: t.Union[str, _device],
) -> t.Any:
    """
    Send tensor leaves of nested list/ dictionaries/ tensors to device.

    :param item: torch.Tensor instance
    :param device: device to which one would like to send
    """
    if isinstance(item, tuple):
        item = list(item)
    if isinstance(item, list):
        for i, it in enumerate(item):
            item[i] = to_device(it, device)
        return item
    if isinstance(item, dict):
        for k in item:
            item[k] = to_device(item[k], device)
        return item
    if hasattr(item, 'to'):
        return item.to(device)
    return item

```

### Core Architecture Module: `superduper/misc/utils.py`
```
import hashlib
import typing as t


def str_shape(shape: t.Sequence[int] | int) -> str:
    """Convert a shape to a string.

    :param shape: The shape to convert.
    """
    if isinstance(shape, int):
        return str(shape)
    if not shape:
        raise ValueError('Shape was empty')
    return 'x'.join(str(x) for x in shape)


def merge_dicts(r: t.Dict, s: t.Dict) -> dict:
    """Merge two dictionaries recursively.

    :param r: The first dictionary.
    :param s: The second dictionary.

    >>> r = {'foo': {'bar': 1, 'baz': 2}, 'qux': 3}
    >>> s = {'foo': {'bar': 4, 'quux': 5}, 'quux': 6}
    >>> merge_dicts(r, s)
    {'foo': {'bar': 4, 'baz': 2, 'quux': 5}, 'qux': 3, 'quux': 6}
    """
    for k, v in s.items():
        if isinstance(v, dict) and k in r:
            r[k] = merge_dicts(r[k], v)
        else:
            r[k] = v
    return r


# TODO move to plugins
def format_prompt(X: str, prompt: str, context: t.Optional[t.List[str]] = None) -> str:
    """Format a prompt with the given input and context.

    :param X: The input to format the prompt with.
    :param prompt: The prompt to format.
    :param context: The context to format the prompt with.
    """
    format_params = {}
    if '{input}' in prompt:
        format_params['input'] = X
    else:
        prompt += X

    if '{context}' in prompt:
        if isinstance(context, (list, tuple)):
            context = '\n'.join(context)

        if context:
            format_params['context'] = context
        else:
            raise ValueError(f'A context is required for prompt {prompt}')

    return prompt.format(**format_params)


def hash_item(item: t.Any) -> str:
    """Hash an item.

    :param item: The item to hash.
    """
    if item is None:
        return hashlib.sha256(('<NoneType>' + str(item)).encode()).hexdigest()
    if isinstance(item, bytearray):
        return hashlib.sha256(item).hexdigest()
    if isinstance(item, str):
        return hashlib.sha256(str(item).encode()).hexdigest()
    if isinstance(item, float):
        return hashlib.sha256(('<float>' + str(item)).encode()).hexdigest()
    if isinstance(item, int):
        return hashlib.sha256(('<int>' + str(item)).encode()).hexdigest()
    if isinstance(item, bool):
        return hashlib.sha256(('<bool>' + str(item)).encode()).hexdigest()
    if isinstance(item, (list, tuple)):
        hashes = []
        for i in item:
            hashes.append(hash_item(i))
        hashes = ''.join(hashes)
        return hashlib.sha256(hashes.encode()).hexdigest()
    if isinstance(item, dict):
        keys = sorted(item.keys())
        hashes = []
        for k in keys:
            hashes.append((hash_item(k), hash_item(item[k])))  # type: ignore[arg-type]
        return hashlib.sha256(str(hashes).encode()).hexdigest()
    return hashlib.sha256(str(item).encode()).hexdigest()


def _history_listing_to_dict(raw: str) -> dict[str, str]:
    import re

    pattern = re.compile(r"^\s*(\d+/\d+|\d+):\s*(.*)$")
    lines = raw.splitlines()
    out = {}
    i = 0
    while i < len(lines):
        m = pattern.match(lines[i])
        if m:  # found a header
            key, first = m.groups()
            if first:  # code on same line
                out[key] = first
                i += 1
            else:  # code starts next line(s)
                i += 1
                buf = []
                while i < len(lines) and not pattern.match(lines[i]):
                    buf.append(lines[i])
                    i += 1
                out[key] = "\n".join(buf)
        else:
            i += 1
    return out


def grab_source_code_ipython(cls_or_fn: t.Union[t.Type, t.Callable]) -> str:
    """Grab the source code of a class or function.

    :param cls_or_fn: The class or function
    """
    from contextlib import redirect_stdout
    from io import StringIO

    from IPython import get_ipython

    ip = get_ipython()  # current InteractiveShell
    buf = StringIO()

    # Whatever would normally be printed by `%history -g foo` is
    # captured in the StringIO buffer instead.
    with redirect_stdout(buf):
        ip.run_line_magic(
            "history", f"-g {cls_or_fn.__name__}"
        )  # replace “foo” with your pattern

    hist_text = buf.getvalue()  # plain string with newlines

    lookup = _history_listing_to_dict(hist_text)

    relevant = [
        v
        for v in lookup.values()
        if v.startswith(f"class {cls_or_fn.__name__}(")
        or v.startswith(f"def {cls_or_fn.__name__}(")
    ]
    return relevant[-1] if relevant else ""

```

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
                    examples += part['content'] + "\n"
                    examples += "```\n\n"

    if examples:
        examples = "## Examples\n\n" + examples
    template = template.replace("{{examples}}", examples)
    return template


def update_readme(readme_path: Path, new_content: str) -> None:
    """
    Update the README.md file with new content, preserving existing sections.

    Args:
    ----
        readme_path (Path): Path to the README.md file.
        new_content (str): The new content to insert into the README.md.

    """
    auto_gen_start = "<!-- Auto-generated content start -->\n"
    auto_gen_end = "<!-- Auto-generated content end -->\n"
    if readme_path.exists():
        with readme_path.open("r", encoding="utf-8") as f:
            existing_content = f.read()
        # Replace the auto-generated content
        pattern = re.compile(
            re.escape(auto_gen_start) + ".*?" + re.escape(auto_gen_end), re.DOTALL
        )
        if pattern.search(existing_content):
            new_full_content = pattern.sub(
                auto_gen_start + new_content + "\n" + auto_gen_end, existing_content
            )
        else:
            # If markers not found, prepend the new content
            new_full_content = (
                auto_gen_start
                + new_content
                + "\n"
                + auto_gen_end
                + "\n"
                + existing_content
            )
    else:
        # Create a new README.md with placeholders
        new_full_content = auto_gen_start + new_content + "\n" + auto_gen_end
        new_full_content += "\n<!-- Add your additional content below -->\n"
    with readme_path.open("w", encoding="utf-8") as f:
        f.write(new_full_content)


def process_plugin(plugin_dir: Path) -> None:
    """
    Process a single plugin directory to generate or update its README.md.

    Args:
    ----
        plugin_dir (Path): Path to the plugin directory.

    """
    print(f"Processing plugin at {plugin_dir}")
    pyproject_path = pl
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
             points_selector=models.Filter(
                 must=[
                     models.FieldCondition(
@@ -160,12 +169,12 @@ def _query_nearest(
             )
 
         search_result = self.client.query_points(
-            collection_name=self.collection_name,
+            collection_name=self.identifier,
             query=query,
             limit=n,
             query_filter=query_filter,
             with_payload=[ID_PAYLOAD_KEY],
-            using=self.vector_name,
+            using=None,
         ).points
 
         ids = [hit.payload[ID_PAYLOAD_KEY] for hit in search_result if hit.payload]
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

---

### Incident Patch 11: `7c33a19b` (2025-06-25)
**Commit Message**: Fix schema for JSON

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - Fix the `.variables` parameter at the top level
 - Fix the to_records feature in ibis
 - Fix the execution of datatype in replace and update operations.
+- Fix auto schema inference for nested JSON types
 
 - Add info to Template
 
```

**File**: `superduper/base/config_settings.py` (modified, +2/-2)
```diff
@@ -112,8 +112,8 @@ def config(self) -> t.Any:
 
         secrets_volume = env.get('secrets_volume') or parent.get('secrets_volume')
 
-        if secrets_volume:   # type: ignore[arg-type]
-            secrets_volume = os.path.expanduser(secrets_volume)
+        if secrets_volume:
+            secrets_volume = os.path.expanduser(secrets_volume)  # type: ignore[arg-type]
 
         if secrets_volume and os.path.isdir(secrets_volume):
             load_secrets(secrets_volume)
```

**File**: `superduper/components/model.py` (modified, +2/-7)
```diff
@@ -22,13 +22,11 @@
 from superduper.misc import typing as st
 from superduper.misc.importing import isreallyinstance
 from superduper.misc.schema import (
-    _map_type_to_superduper,
+    Annotation,
     _safe_resolve_annotation,
-    process as process_annotation,
 )
 
 if t.TYPE_CHECKING:
-    from superduper.backends.base.cluster import Cluster
     from superduper.base.datalayer import Datalayer
     from superduper.components.dataset import Dataset
 
@@ -258,10 +256,7 @@ def postinit(self):
                 annotation = _safe_resolve_annotation(
                     annotation, {**module_globals, **superduper_globals}
                 )
-                inferred_annotation, iterable = process_annotation(annotation)
-                self.datatype = _map_type_to_superduper(
-                    self.__class__.__name__, 'predict', inferred_annotation, iterable
-                )
+                self.datatype = Annotation.build(annotation).datatype
 
         if not self.identifier:
             raise Exception('_Predictor identifier must be non-empty')
```

**File**: `superduper/misc/schema.py` (modified, +377/-148)
```diff
@@ -1,12 +1,17 @@
+import collections
 import sys
 import types
 import typing as t
+from abc import ABC
+from collections import defaultdict
 from dataclasses import fields
+from pathlib import Path
 from typing import Any, ForwardRef, get_args, get_origin
 
 from superduper import logging
 from superduper.base.base import Base
 from superduper.components.component import Component
+from superduper.misc import typing as superduper_typing
 
 ORDER = [
     'str',
@@ -18,6 +23,375 @@
 ]
 
 
+class Annotation(ABC):
+    """Base class for all annotations."""
+
+    def __init__(self):
+        pass
+
+    def __repr__(self):
+        out = str(self.__class__.__name__)
+        if hasattr(self, 'args') and self.args:
+            out += '[' + ', '.join(str(arg) for arg in self.args) + ']'
+        return out
+
+    @staticmethod
+    def build(annotation: t.Type):
+        """Build an annotation from a type.
+
+        :param annotation: The type to build the annotation from.
+        """
+        if isinstance(annotation, ForwardRef):
+            module_globals = sys.modules[annotation.__module__].__dict__
+            superduper_globals = sys.modules["superduper"].__dict__
+            origin = _evaluate_forward_ref(
+                annotation, {**module_globals, **superduper_globals}
+            )
+        else:
+            origin = get_origin(annotation)
+
+        if origin is None:
+            return ANNOTATIONS[annotation]()
+
+        args = get_args(annotation)
+        return ANNOTATIONS[origin](*args)
+
+    @property
+    def args(self) -> t.List['Annotation']:
+        """Return the arguments of the annotation."""
+        return []
+
+    @property
+    def base_types(self) -> t.Set[str]:
+        """Return the base type of the annotation."""
+        out: t.Set = set()
+        for arg in self.args:
+            out = out | arg.base_types
+        return out
+
+    @property
+    def datatype(self) -> str:
+        """Return the datatype of the annotation."""
+        bt = self.base_types
+        if 'dill' in bt:
+            return 'dill'
+        if 'file' in bt:
+            allowed = {
+                'Path': 'file',
+                'List[Path]': 'flist',
+                'Dict[Str, Path]': 'fdict',
+            }
+        if 'componenttype' in bt:
+            allowed = {
+                'Component': 'componenttype',
+                'List[Component]': 'componentlist',
+                'Dict[Str, Component]': 'componentdict',
+            }
+            assert (
+                str(self) in allowed
+            ), f"Invalid component type: {str(self)}; supported: {allowed}"
+            return allowed[str(self)]
+        if 'basetype' in bt:
+            assert (
+                str(self) == 'Base'
+            ), f"Invalid base type: {str(self)}; expected 'Base'"
+            return 'basetype'
+        return 'json'
+
+
+class Literal(Annotation):
+    """Annotation for Literal types.
+
+    :param items: The items in the Literal.
+    """
+
+    def __init__(self, *items: t.Any):
+        self.items = items
+
+    @property
+    def args(self):
+        """Return the arguments of the annotation."""
+        return []
+
+    @property
+    def base_types(self) -> t.Set[str]:
+        """Return the base types of the annotation."""
+        return {type(item).__name__ for item in self.items}
+
+    @property
+    def datatype(self) -> str:
+        """Return the datatype of the annotation."""
+        if self.base_types.issubset({'float', 'int', 'str', 'bool'}):
+            return 'json'
+        return 'dill'
+
+
+class Union(Annotation):
+    """Annotation for Union types.
+
+    :param items: The items in the Union.
+    """
+
+    def __init__(self, *items: t.Type):
+        self.items = [Annotation.build(arg) for arg in items if arg is not type(None)]
+
+    @property
+    def args(self):
+        """Return the arguments of the annotation."""
+        return self.items
+
+    @property
+    def datatype(self):
+        """Return the datatype of the annotation."""
+        if len(self.items) == 1:
+            return self.items[0].datatype
+        else:
+            return super().datatype
+
+
+class Dict(Annotation):
+    """Annotation for Dict types.
+
+    :param key_type: The type of the keys in the Dict.
+    :param value_type: The type of the values in the Dict.
+    """
+
+    def __init__(
+        self, key_type: t.Type | None = None, value_type: t.Type | None = None
+    ):
+        if key_type is None:
+            key_type = str
+        if value_type is None:
+            value_type = str
+        self.key_type = Annotation.build(key_type)
+        self.value_type = Annotation.build(value_type)
+
+    @property
+    def args(self):
+        return [self.key_type, self.value_type]
+
+
+class Tuple(Annotation):
+    """Annotation for Tuple types.
+
+    :param items: The items in the Tuple.
+    """
+
+    def __init__(self, *items: t.Type):
+        self.items = [
```

**File**: `test/unittest/base/test_datalayer.py` (modified, +0/-14)
```diff
@@ -118,20 +118,6 @@ def test_add_version(db: Datalayer):
     assert db.show('TestComponent', 'test') == [0, 1, 2]
 
 
-class TestComponentPickle(TestComponent):
-    artifact: st.Pickle
-
-
-def test_add_component_with_bad_artifact(db):
-    artifact = {'data': lambda x: x}
-    component = TestComponentPickle(
-        identifier='test',
-        artifact=artifact,
-    )
-    with pytest.raises(Exception):
-        db.apply(component)
-
-
 def test_add_artifact_auto_replace(db):
     # Check artifact is automatically replaced to metadata
     artifact = {'data': 1}
```

**File**: `test/unittest/misc/test_schema.py` (modified, +117/-2)
```diff
@@ -1,5 +1,7 @@
-from superduper import Model
-from superduper.misc.schema import get_schema
+import pytest
+
+from superduper import Model, t
+from superduper.misc.schema import Annotation, get_schema
 
 
 def test_get_components():
@@ -9,3 +11,116 @@ def test_get_components():
     assert s['validation'] == 'componenttype'
     assert s['serve'] == 'bool'
     assert s['datatype'] == 'str'
+
+
+class MyClass: ...
+
+
+def test_annotation_rendering():
+
+    a = Annotation.build(str)
+
+    assert str(a) == "Str"
+
+    a = Annotation.build(t.List[Model])
+
+    assert str(a) == "List[Component]"
+
+    a = Annotation.build(t.Dict[str, Model])
+
+    assert str(a) == "Dict[Str, Component]"
+
+    a = Annotation.build(t.Dict[str, t.Dict[str, Model]])
+
+    assert str(a) == "Dict[Str, Dict[Str, Component]]"
+
+    a = Annotation.build(t.Union[str, t.Dict[str, Model]])
+
+    assert str(a) == "Union[Str, Dict[Str, Component]]"
+
+    a = Annotation.build(str | t.Dict[str, Model])
+
+    assert str(a) == "Union[Str, Dict[Str, Component]]"
+
+    a = Annotation.build(str | t.Dict[str, Model] | t.List[Model])
+
+    assert str(a) == "Union[Str, Dict[Str, Component], List[Component]]"
+
+    a = Annotation.build(
+        str | t.Dict[str, str] | t.List[int] | t.Tuple[t.List[str], t.Dict[str, str]]
+    )
+
+    assert (
+        str(a)
+        == "Union[Str, Dict[Str, Str], List[Int], Tuple[List[Str], Dict[Str, Str]]]"
+    )
+
+
+def test_base_types():
+
+    a = Annotation.build(
+        str | t.Dict[str, str] | t.List[int] | t.Tuple[t.List[str], t.Dict[str, str]]
+    )
+    assert a.base_types == {'str', 'int'}
+
+    a = Annotation.build(
+        str
+        | t.Dict[str, str]
+        | t.List[int]
+        | t.Tuple[t.List[str], t.Dict[str, MyClass]]
+    )
+
+    assert a.base_types == {'str', 'int', 'dill'}
+
+
+def test_type_mapping():
+
+    a = Annotation.build(str)
+
+    assert a.datatype == 'str'
+
+    a = Annotation.build(
+        str | t.Dict[str, str] | t.List[int] | t.Tuple[t.List[str], t.Dict[str, str]]
+    )
+
+    assert a.datatype == 'json'
+
+    a = Annotation.build(
+        str
+        | t.Dict[str, str]
+        | t.List[int]
+        | t.Tuple[t.List[str], t.Dict[str, MyClass]]
+    )
+
+    assert a.datatype == 'dill'
+
+    a = Annotation.build(
+        str | t.Dict[str, str] | t.List[int] | t.Tuple[t.List[str], t.Dict[str, Model]]
+    )
+
+    with pytest.raises(AssertionError):
+        _ = a.datatype
+
+    a = Annotation.build(t.Dict[str, Model])
+
+    assert a.datatype == 'componentdict'
+
+
+class MyModel(Model):
+    a: str
+    b: str | t.List[str] | t.Dict[str, str]
+    c: t.Callable
+    d: 'MyModel'
+
+
+def test_model_schema():
+
+    s = MyModel.class_schema
+
+    print()
+    print(s)
+
+    assert str(s['a']) == 'str'
+    assert str(s['b']) == 'JSON'
+    assert str(s['c']) == 'Dill'
+    assert str(s['d']) == 'ComponentType'
```

**File**: `test/unittest/test_quality.py` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
 ALLOWABLE_DEFECTS = {
     'cast': 1,  # Try to keep this down
     'noqa': 13,  # Try to keep this down
-    'type_ignore': 21,  # This should only ever increase in obscure edge cases
+    'type_ignore': 22,  # This should only ever increase in obscure edge cases
 }
 
 
```

---

### Incident Patch 12: `c4d82cdc` (2025-06-23)
**Commit Message**: Fix status of children

**File**: `superduper/base/datalayer.py` (modified, +2/-1)
```diff
@@ -600,7 +600,7 @@ def load_all(self, component: str, **kwargs) -> t.List[Component]:
         out: t.List[Component] = []
         for identifier in identifiers:
             try:
-                c = self.load(component, identifier)
+                c = self.load(component, identifier, **kwargs)
                 applies = True
                 for k, v in kwargs.items():
                     if getattr(c, k) != v:
@@ -712,6 +712,7 @@ def load(
                 builds=info.get('_builds', {}),
                 db=self,
             )
+            c._use_component_cache = component_cache
         else:
             raise ValueError(
                 'Must provide either `uuid` or `component` and `identifier`'
```

**File**: `superduper/base/datatype.py` (modified, +2/-1)
```diff
@@ -180,7 +180,6 @@ def decode_data(self, item, builds, db):
                 uuid=uuid,
                 db=db,
             )
-            # return db.load(component=component, uuid=uuid)
         elif isinstance(item, str):
             raise ValueError(f'Unknown reference type {item} for a base instance')
 
@@ -906,6 +905,7 @@ class ComponentRef(Saveable):
     component: str
     uuid: str
     object: t.Optional[Component] = None
+    component_cache: bool = True
 
     def setup(self):
         """Initialize the component reference."""
@@ -915,6 +915,7 @@ def setup(self):
             component=self.component,
             identifier=self.identifier,
             uuid=self.uuid,
+            component_cache=self.component_cache,
         )
         self.object.setup()
         return self.object
```

**File**: `superduper/components/component.py` (modified, +5/-1)
```diff
@@ -213,6 +213,7 @@ def __post_init__(self, db: t.Optional['Datalayer'] = None):
         self.status, self.details = init_status()
 
         self._original_parameters: t.Dict | None = None
+        self._use_component_cache: bool = True
 
         self._handle_variables()
         self.postinit()
@@ -720,7 +721,10 @@ def _setup(item):
             if isinstance(item, list):
                 return [_setup(i) for i in item]
 
-            from superduper.base.datatype import Saveable
+            from superduper.base.datatype import Saveable, ComponentRef
+
+            if isinstance(item, ComponentRef):
+                item.component_cache = self._use_component_cache
 
             if isinstance(item, Saveable):
                 item.setup()
```

**File**: `superduper/components/listener.py` (modified, +5/-2)
```diff
@@ -58,9 +58,12 @@ def managed_tables(self):
     @property
     def output_table(self):
         """Output table property."""
-        return Table(
-            self.outputs, fields={self.outputs: self.model.datatype, '_source': 'str'}
+        t = Table(
+            self.outputs,
+            fields={self.outputs: self.model.datatype, '_source': 'str'},
         )
+        t.status = 'running'
+        return t
 
     @property
     def predict_id(self):
```

---

### Incident Patch 13: `176479b1` (2025-06-23)
**Commit Message**: Fix loading envs in correct order

**File**: `superduper/base/config_settings.py` (modified, +5/-10)
```diff
@@ -1,7 +1,6 @@
 import os
 import typing as t
 from dataclasses import dataclass
-from functools import cached_property
 from pathlib import Path
 from warnings import warn
 
@@ -19,7 +18,10 @@
 USER_CONFIG: str = (
     str(Path(CONFIG_FILE).expanduser())
     if CONFIG_FILE
-    else (f'{HOME}/.superduper/config.yaml' if HOME else None)
+    else (
+        f'{os.getcwd()}/superduper.yaml' if os.path.exists(os.getcwd() + '/superduper.yaml')
+        else (f'{HOME}/.superduper/config.yaml' if HOME else None)
+    )
 )
 PREFIX = 'SUPERDUPER_'
 ROOT = Path(__file__).parents[2]
@@ -65,11 +67,7 @@ def load_secrets(secrets_dir: str | None = None):
         os.environ[env_name] = content
 
 
-<<<<<<< HEAD
-def load_user_config():
-=======
 def load_user_config(base: t.Dict | None = None):
->>>>>>> 23136a364 (Fix loading envs in correct order)
     kwargs = {}
     if USER_CONFIG is not None:
         try:
@@ -80,11 +78,8 @@ def load_user_config(base: t.Dict | None = None):
                 raise ConfigError(
                     f'Could not find config file: {USER_CONFIG}'
                 ) from e
-<<<<<<< HEAD
-=======
     if base is not None:
         kwargs = config_dicts.combine_configs((base, kwargs))
->>>>>>> 23136a364 (Fix loading envs in correct order)
     return kwargs
 
 
@@ -116,7 +111,7 @@ def config(self) -> t.Any:
         env = config_dicts.environ_to_config_dict(prefix, parent, env)
         env = config_dicts.combine_configs((load_user_config(), env))
 
-        secrets_volume = env.get('secrets_volume') or parent.get('secrets_volume') or kwargs.get('secrets_volume')
+        secrets_volume = env.get('secrets_volume') or parent.get('secrets_volume')
 
         if secrets_volume:
             secrets_volume = os.path.expanduser(secrets_volume)
```

---

### Incident Patch 14: `5eca6e34` (2025-06-23)
**Commit Message**: Fix loading envs in correct order

**File**: `superduper/base/config_settings.py` (modified, +11/-1)
```diff
@@ -65,7 +65,11 @@ def load_secrets(secrets_dir: str | None = None):
         os.environ[env_name] = content
 
 
+<<<<<<< HEAD
 def load_user_config():
+=======
+def load_user_config(base: t.Dict | None = None):
+>>>>>>> 23136a364 (Fix loading envs in correct order)
     kwargs = {}
     if USER_CONFIG is not None:
         try:
@@ -76,6 +80,11 @@ def load_user_config():
                 raise ConfigError(
                     f'Could not find config file: {USER_CONFIG}'
                 ) from e
+<<<<<<< HEAD
+=======
+    if base is not None:
+        kwargs = config_dicts.combine_configs((base, kwargs))
+>>>>>>> 23136a364 (Fix loading envs in correct order)
     return kwargs
 
 
@@ -95,7 +104,6 @@ class ConfigSettings:
     environ: t.Optional[t.Dict] = None
     base: t.Optional[str] = None
 
-    # @cached_property
     @property
     def config(self) -> t.Any:
         """Read a configuration using defaults as basis."""
@@ -122,6 +130,8 @@ def config(self) -> t.Any:
             warn(f"Warning: The path '{secrets_volume}' is not a valid directory.")
 
         kwargs = load_user_config()
+        if self.base:
+            kwargs = kwargs.get(self.base, {})
         kwargs = config_dicts.combine_configs((parent, kwargs, env))
 
         return _dataclass_from_dict(self.cls, kwargs)
```

---

### Incident Patch 15: `31647356` (2025-06-23)
**Commit Message**: Fix loading envs in correct order

**File**: `superduper/base/config_settings.py` (modified, +17/-14)
```diff
@@ -65,6 +65,20 @@ def load_secrets(secrets_dir: str | None = None):
         os.environ[env_name] = content
 
 
+def load_user_config():
+    kwargs = {}
+    if USER_CONFIG is not None:
+        try:
+            with open(USER_CONFIG) as f:
+                kwargs = yaml.safe_load(f)
+        except FileNotFoundError as e:
+            if USER_CONFIG != f'{HOME}/.superduper/config.yaml':
+                raise ConfigError(
+                    f'Could not find config file: {USER_CONFIG}'
+                ) from e
+    return kwargs
+
+
 @dataclass(frozen=True)
 class ConfigSettings:
     """Helper class to read a configuration from a dataclass.
@@ -92,8 +106,9 @@ def config(self) -> t.Any:
             prefix = PREFIX + self.base.upper() + '_'
 
         env = config_dicts.environ_to_config_dict(prefix, parent, env)
+        env = config_dicts.combine_configs((load_user_config(), env))
 
-        secrets_volume = env.get('secrets_volume') or parent.get('secrets_volume')
+        secrets_volume = env.get('secrets_volume') or parent.get('secrets_volume') or kwargs.get('secrets_volume')
 
         if secrets_volume:
             secrets_volume = os.path.expanduser(secrets_volume)
@@ -106,19 +121,7 @@ def config(self) -> t.Any:
         elif secrets_volume:
             warn(f"Warning: The path '{secrets_volume}' is not a valid directory.")
 
-        kwargs = {}
-        if USER_CONFIG is not None:
-            try:
-                with open(USER_CONFIG) as f:
-                    kwargs = yaml.safe_load(f)
-            except FileNotFoundError as e:
-                if USER_CONFIG != f'{HOME}/.superduper/config.yaml':
-                    raise ConfigError(
-                        f'Could not find config file: {USER_CONFIG}'
-                    ) from e
-            if self.base:
-                kwargs = kwargs.get(self.base, {})
-
+        kwargs = load_user_config()
         kwargs = config_dicts.combine_configs((parent, kwargs, env))
 
         return _dataclass_from_dict(self.cls, kwargs)
```

**File**: `superduper/components/application.py` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@ class Application(Component):
 
     components: t.List[Component]
     variables: t.Dict | None = None
+    template: t.Optional[str] = None
 
     @classmethod
     def build_from_db(cls, identifier, db: "Datalayer"):
```

**File**: `superduper/misc/schema.py` (modified, +10/-0)
```diff
@@ -9,6 +9,16 @@
 from superduper.components.component import Component
 
 
+ORDER = [
+    'str',
+    'int',
+    'float',
+    'bool',
+    'json',
+    'dill',
+]
+
+
 def gather_mro_globals(cls):
     """Return a merged dictionary of the module global from the MRO of `cls`.
 
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
