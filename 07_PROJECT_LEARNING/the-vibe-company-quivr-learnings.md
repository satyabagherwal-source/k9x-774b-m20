# Forensic Learning Record (Deep Inspection): The-Vibe-Company/quivr

> **Canonical Artifact**: `07_PROJECT_LEARNING/the-vibe-company-quivr-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/The-Vibe-Company/quivr](https://github.com/The-Vibe-Company/quivr))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:40:39.170Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `The-Vibe-Company/quivr`
- **Description**: Opiniated RAG for integrating GenAI in your apps 🧠   Focus on your product rather than the RAG. Easy integration in existing products with customisation!  Any LLM: GPT4, Groq, Llama. Any Vectorstore: PGVector, Faiss. Any Files. Anyway you want.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 39571 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/quivr_core/__init__.py`
```
from importlib.metadata import entry_points

from .brain import Brain
from .processor.registry import register_processor, registry

__all__ = ["Brain", "registry", "register_processor"]


def register_entries():
    if entry_points is not None:
        try:
            eps = entry_points()
        except TypeError:
            pass  # importlib-metadata < 0.8
        else:
            if hasattr(eps, "select"):  # Python 3.10+ / importlib_metadata >= 3.9.0
                processors = eps.select(group="quivr_core.processor")
            else:
                processors = eps.get("quivr_core.processor", [])
            registered_names = set()
            for spec in processors:
                err_msg = f"Unable to load processor from {spec}"
                name = spec.name
                if name in registered_names:
                    continue
                registered_names.add(name)
                register_processor(
                    name,
                    spec.value.replace(":", "."),
                    errtxt=err_msg,
                    append=True,
                )


register_entries()

```

### Core Architecture Module: `core/quivr_core/base_config.py`
```
from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict
from typing import Self


class QuivrBaseConfig(BaseModel):
    """
    Base configuration class for Quivr.

    This class extends Pydantic's BaseModel and provides a foundation for
    configuration management in quivr-core.

    Attributes:
        model_config (ConfigDict): Configuration for the Pydantic model.
            It's set to forbid extra attributes, ensuring strict adherence
            to the defined schema.

    Class Methods:
        from_yaml: Create an instance of the class from a YAML file.
    """

    model_config = ConfigDict(extra="forbid")

    @classmethod
    def from_yaml(cls, file_path: str | Path) -> Self:
        """
        Create an instance of the class from a YAML file.

        Args:
            file_path (str | Path): The path to the YAML file.

        Returns:
            QuivrBaseConfig: An instance of the class initialized with the data from the YAML file.
        """
        # Load the YAML file
        with open(file_path, "r") as stream:
            config_data = yaml.safe_load(stream)

        # Instantiate the class using the YAML data
        return cls(**config_data)

```

### Core Architecture Module: `core/quivr_core/brain/__init__.py`
```
from .brain import Brain

__all__ = ["Brain"]

```

### Core Architecture Module: `core/quivr_core/brain/brain.py`
```
import asyncio
import logging
import os
from pathlib import Path
from pprint import PrettyPrinter
from typing import Any, AsyncGenerator, Callable, Dict, Self, Type, Union
from uuid import UUID, uuid4

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.vectorstores import VectorStore
from langchain_openai import OpenAIEmbeddings
from rich.console import Console
from rich.panel import Panel

from quivr_core.brain.info import BrainInfo, ChatHistoryInfo
from quivr_core.brain.serialization import (
    BrainSerialized,
    EmbedderConfig,
    FAISSConfig,
    LocalStorageConfig,
    TransparentStorageConfig,
)
from quivr_core.files.file import load_qfile
from quivr_core.llm import LLMEndpoint
from quivr_core.processor.registry import get_processor_class
from quivr_core.rag.entities.chat import ChatHistory
from quivr_core.rag.entities.config import RetrievalConfig
from quivr_core.rag.entities.models import (
    LangchainMetadata,
    ParsedRAGChunkResponse,
    ParsedRAGResponse,
    QuivrKnowledge,
    SearchResult,
)
from quivr_core.rag.quivr_rag import QuivrQARAG
from quivr_core.rag.quivr_rag_langgraph import QuivrQARAGLangGraph
from quivr_core.storage.local_storage import LocalStorage, TransparentStorage
from quivr_core.storage.storage_base import StorageBase

from .brain_defaults import build_default_vectordb, default_embedder, default_llm

logger = logging.getLogger("quivr_core")


async def process_files(
    storage: StorageBase, skip_file_error: bool, **processor_kwargs: dict[str, Any]
) -> list[Document]:
    """
    Process files in storage.
    This function takes a StorageBase and return a list of langchain documents.
    Args:
        storage (StorageBase): The storage containing the files to process.
        skip_file_error (bool): Whether to skip files that cannot be processed.
        processor_kwargs (dict[str, Any]): Additional arguments for the processor.
    Returns:
        list[Document]: List of processed documents in the Langchain Document format.
    Raises:
        ValueError: If a file cannot be processed and skip_file_error is False.
        Exception: If no processor is found for a file of a specific type and skip_file_error is False.
    """

    knowledge = []
    for file in await storage.get_files():
        try:
            if file.file_extension:
                processor_cls = get_processor_class(file.file_extension)
                logger.debug(f"processing {file} using class {processor_cls.__name__}")
                processor = processor_cls(**processor_kwargs)
                docs = await processor.process_file(file)
                knowledge.extend(docs)
            else:
                logger.error(f"can't find processor for {file}")
                if skip_file_error:
                    continue
                else:
                    raise ValueError(f"can't parse {file}. can't find file extension")
        except KeyError as e:
            if skip_file_error:
                continue
            else:
                raise Exception(f"Can't parse {file}. No available processor") from e

    return knowledge


class Brain:
    """
    A class representing a Brain.
    This class allows for the creation of a Brain, which is a collection of knowledge one wants to retrieve information from.
    A Brain is set to:
    * Store files in the storage of your choice (local, S3, etc.)
    * Process the files in the storage to extract text and metadata in a wide range of format.
    * Store the processed files in the vector store of your choice (FAISS, PGVector, etc.) - default to FAISS.
    * Create an index of the processed files.
    * Use the *Quivr* workflow for the retrieval augmented generation.
    A Brain is able to:
    * Search for information in the vector store.
    * Answer questions about the knowledges in the Brain.
    * Stream the answer to the question.
    Attributes:
        name (str): The name of the brain.
        id (UUID): The unique identifier of the brain.
        storage (StorageBase): The storage used to store the files.
        llm (LLMEndpoint): The language model used to generate the answer.
        vector_db (VectorStore): The vector store used to store the processed files.
        embedder (Embeddings): The embeddings used to create the index of the processed files.
    """

    def __init__(
        self,
        *,
        name: str,
        llm: LLMEndpoint,
        id: UUID | None = None,
        vector_db: VectorStore | None = None,
        embedder: Embeddings | None = None,
        storage: StorageBase | None = None,
        workspace_id: UUID | None = None,
        chat_id: UUID | None = None,
    ):
        self.id = id
        self.name = name
        self.storage = storage
        self.workspace_id = workspace_id
        self.chat_id = chat_id
        # Chat history
        self._chats = self._init_chats()
        self.default_chat = list(self._chats.values())[0]

        # RAG dependencies:
        self.llm = llm
        self.vector_db = vector_db
        self.embedder = embedder

    def __repr__(self) -> str:
        pp = PrettyPrinter(width=80, depth=None, compact=False, sort_dicts=False)
        return pp.pformat(self.info())

    def print_info(self):
        console = Console()
        tree = self.info().to_tree()
        panel = Panel(tree, title="Brain Info", expand=False, border_style="bold")
        console.print(panel)

    @classmethod
    def load(cls, folder_path: str | Path) -> Self:
        """
        Load a brain from a folder path.
        Args:
            folder_path (str | Path): The path to the folder containing the brain.
        Returns:
            Brain: The brain loaded from the folder path.
        Example:
        ```python
        brain_loaded = Brain.load("path/to/brain")
        brain_loaded.print_info()
        ```
        """
        if isinstance(folder_path, str):
            folder_path = Path(folder_path)
        if not folder_path.exists():
            raise ValueError(f"path {folder_path} doesn't exist")

        # Load brainserialized
        with open(os.path.join(folder_path, "config.json"), "r") as f:
            bserialized = BrainSerialized.model_validate_json(f.read())

        storage: StorageBase | None = None
        # Loading storage
        if bserialized.storage_config.storage_type == "transparent_storage":
            storage = TransparentStorage.load(bserialized.storage_config)
        elif bserialized.storage_config.storage_type == "local_storage":
            storage = LocalStorage.load(bserialized.storage_config)
        else:
            raise ValueError("unknown storage")

        # Load Embedder
        if bserialized.embedding_config.embedder_type == "openai_embedding":
            from langchain_openai import OpenAIEmbeddings

            embedder = OpenAIEmbeddings(**bserialized.embedding_config.config)
        else:
            raise ValueError("unknown embedder")

        # Load vector db
        if bserialized.vectordb_config.vectordb_type == "faiss":
            from langchain_community.vectorstores import FAISS

            vector_db = FAISS.load_local(
                folder_path=bserialized.vectordb_config.vectordb_folder_path,
                embeddings=embedder,
                allow_dangerous_deserialization=True,
            )
        else:
            raise ValueError("Unsupported vectordb")

        return cls(
            id=bserialized.id,
            name=bserialized.name,
            embedder=embedder,
            llm=LLMEndpoint.from_config(bserialized.llm_config),
            storage=storage,
            vector_db=vector_db,
        )

    async def save(self, folder_path: str | Path):
        """
        Save the brain to a folder path.
        Args:
            folder_path (str | Path): The path to the folder where the brain will be saved.
        Returns:
      
```

### Core Architecture Module: `core/quivr_core/brain/brain_defaults.py`
```
import logging

from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_core.vectorstores import VectorStore

from quivr_core.rag.entities.config import DefaultModelSuppliers, LLMEndpointConfig
from quivr_core.llm import LLMEndpoint

logger = logging.getLogger("quivr_core")


async def build_default_vectordb(
    docs: list[Document], embedder: Embeddings
) -> VectorStore:
    try:
        from langchain_community.vectorstores import FAISS

        logger.debug("Using Faiss-CPU as vector store.")
        # TODO(@aminediro) : embedding call is usually not concurrent for all documents but waits
        if len(docs) > 0:
            vector_db = await FAISS.afrom_documents(documents=docs, embedding=embedder)
            return vector_db
        else:
            raise ValueError("can't initialize brain without documents")

    except ImportError as e:
        raise ImportError(
            "Please provide a valid vector store or install quivr-core['base'] package for using the default one."
        ) from e


def default_embedder() -> Embeddings:
    try:
        from langchain_openai import OpenAIEmbeddings

        logger.debug("Loaded OpenAIEmbeddings as default LLM for brain")
        embedder = OpenAIEmbeddings()
        return embedder
    except ImportError as e:
        raise ImportError(
            "Please provide a valid Embedder or install quivr-core['base'] package for using the defaultone."
        ) from e


def default_llm() -> LLMEndpoint:
    try:
        logger.debug("Loaded ChatOpenAI as default LLM for brain")
        llm = LLMEndpoint.from_config(
            LLMEndpointConfig(supplier=DefaultModelSuppliers.OPENAI, model="gpt-4o")
        )
        return llm

    except ImportError as e:
        raise ImportError(
            "Please provide a valid BaseLLM or install quivr-core['base'] package"
        ) from e

```

### Core Architecture Module: `core/quivr_core/brain/info.py`
```
from dataclasses import dataclass
from uuid import UUID

from rich.tree import Tree


@dataclass
class ChatHistoryInfo:
    nb_chats: int
    current_default_chat: UUID
    current_chat_history_length: int

    def add_to_tree(self, chats_tree: Tree):
        chats_tree.add(f"Number of Chats: [bold]{self.nb_chats}[/bold]")
        chats_tree.add(
            f"Current Default Chat: [bold magenta]{self.current_default_chat}[/bold magenta]"
        )
        chats_tree.add(
            f"Current Chat History Length: [bold]{self.current_chat_history_length}[/bold]"
        )


@dataclass
class LLMInfo:
    model: str
    llm_base_url: str
    temperature: float
    max_tokens: int
    supports_function_calling: int

    def add_to_tree(self, llm_tree: Tree):
        llm_tree.add(f"Model: [italic]{self.model}[/italic]")
        llm_tree.add(f"Base URL: [underline]{self.llm_base_url}[/underline]")
        llm_tree.add(f"Temperature: [bold]{self.temperature}[/bold]")
        llm_tree.add(f"Max Tokens: [bold]{self.max_tokens}[/bold]")
        func_call_color = "green" if self.supports_function_calling else "red"
        llm_tree.add(
            f"Supports Function Calling: [bold {func_call_color}]{self.supports_function_calling}[/bold {func_call_color}]"
        )


@dataclass
class StorageInfo:
    storage_type: str
    n_files: int

    def add_to_tree(self, files_tree: Tree):
        files_tree.add(f"Storage Type: [italic]{self.storage_type}[/italic]")
        files_tree.add(f"Number of Files: [bold]{self.n_files}[/bold]")


@dataclass
class BrainInfo:
    brain_id: UUID
    brain_name: str
    chats_info: ChatHistoryInfo
    llm_info: LLMInfo
    files_info: StorageInfo | None = None

    def to_tree(self):
        tree = Tree("📊 Brain Information")
        tree.add(f"🆔 ID: [bold cyan]{self.brain_id}[/bold cyan]")
        tree.add(f"🧠 Brain Name: [bold green]{self.brain_name}[/bold green]")

        if self.files_info:
            files_tree = tree.add("📁 Files")
            self.files_info.add_to_tree(files_tree)

        chats_tree = tree.add("💬 Chats")
        self.chats_info.add_to_tree(chats_tree)

        llm_tree = tree.add("🤖 LLM")
        self.llm_info.add_to_tree(llm_tree)
        return tree

```

### Core Architecture Module: `core/quivr_core/brain/serialization.py`
```
from pathlib import Path
from typing import Any, Dict, Literal, Union
from uuid import UUID

from pydantic import BaseModel, Field, SecretStr

from quivr_core.rag.entities.config import LLMEndpointConfig
from quivr_core.rag.entities.models import ChatMessage
from quivr_core.files.file import QuivrFileSerialized


class EmbedderConfig(BaseModel):
    embedder_type: Literal["openai_embedding"] = "openai_embedding"
    # TODO: type this correctly
    config: Dict[str, Any]


class PGVectorConfig(BaseModel):
    vectordb_type: Literal["pgvector"] = "pgvector"
    pg_url: str
    pg_user: str
    pg_psswd: SecretStr
    table_name: str
    vector_dim: int


class FAISSConfig(BaseModel):
    vectordb_type: Literal["faiss"] = "faiss"
    vectordb_folder_path: str


class LocalStorageConfig(BaseModel):
    storage_type: Literal["local_storage"] = "local_storage"
    storage_path: Path
    files: dict[UUID, QuivrFileSerialized]


class TransparentStorageConfig(BaseModel):
    storage_type: Literal["transparent_storage"] = "transparent_storage"
    files: dict[UUID, QuivrFileSerialized]


class BrainSerialized(BaseModel):
    id: UUID
    name: str
    chat_history: list[ChatMessage]
    vectordb_config: Union[FAISSConfig, PGVectorConfig] = Field(
        ..., discriminator="vectordb_type"
    )
    storage_config: Union[TransparentStorageConfig, LocalStorageConfig] = Field(
        ..., discriminator="storage_type"
    )

    llm_config: LLMEndpointConfig
    embedding_config: EmbedderConfig

```

### Core Architecture Module: `core/quivr_core/config.py`
```
from enum import Enum

import yaml
from pydantic import BaseModel


class ParserType(str, Enum):
    """Parser type enumeration."""

    UNSTRUCTURED = "unstructured"
    LLAMA_PARSER = "llama_parser"
    MEGAPARSE_VISION = "megaparse_vision"


class StrategyEnum(str, Enum):
    """Method to use for the conversion"""

    FAST = "fast"
    AUTO = "auto"
    HI_RES = "hi_res"


class MegaparseBaseConfig(BaseModel):
    @classmethod
    def from_yaml(cls, file_path: str):
        # Load the YAML file
        with open(file_path, "r") as stream:
            config_data = yaml.safe_load(stream)

        # Instantiate the class using the YAML data
        return cls(**config_data)


class MegaparseConfig(MegaparseBaseConfig):
    method: ParserType = ParserType.UNSTRUCTURED
    strategy: StrategyEnum = StrategyEnum.FAST
    check_table: bool = False
    parsing_instruction: str | None = None
    model_name: str = "gpt-4o"

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3691** (2026-09-29): **[Security] RCE via Pickle Deserialization in Brain.load()**
  *Symptoms*: brain.py:190 uses FAISS.load_local() with allow_dangerous_deserialization=True. Any brain directory with a crafted index.pkl gives arbitrary code execution when loaded via Brain.load().  Attack vector: shared brain files via HuggingFace Hub, GitHub, email.  PoC: create brain dir with malicious pickle in index.pkl, victim calls Brain.load(path) = RCE.  Fix: remove allow_dangerous_deserialization=True or use FAISS native format instead of pickle.
  **Post-Mortem & Fix Analysis**:
  > Thanks for your contributions, we'll be closing this issue as it has gone stale. Feel free to reopen if you'd like to continue the discussion.

- **Issue #3654** (2025-12-10): **The garbage collector is trying to clean up non-checked-in connection <AdaptedConnection <asyncpg.connection.Connection object at 0x7f66a5b06110>>, which will be terminated.  Please ensure that SQLAlchemy pooled connections are returned to the pool expl...**
  *Symptoms*: Sentry Issue: [PYTHON-FASTAPI-1VP](https://quivr-brain.sentry.io/issues/6996552839/?referrer=github_integration)  ``` The garbage collector is trying to clean up non-checked-in connection <AdaptedConnection <asyncpg.connection.Connection object at 0x7f66a5b06110>>, which will be terminated.  Please ensure that SQLAlchemy pooled connections are returned to the pool explicitly, either by calling ``close()`` or by using appropriate context managers to manage their lifecycle. ```

- **Issue #3650** (2025-12-12): **[Bug]: RuntimeError: There is no current event loop in thread 'MainThread' when using Brain.from_files() in script**
  *Symptoms*: ### What happened?  I tried following the quick-start guide, on a brand new system. I'm running a minimal test of quivr-core and encountering a runtime error related to the asyncio event loop when calling `Brain.from_files()` inside a simple script.  This happens with Python 3.12, but I’m not sure if it’s a version compatibility issue or something else related to how event loops are handled.  Here’s a minimal reproducible example, which is exactly the content of the quick-start:  ``` import tempfile from quivr_core import Brain  if __name__ == "__main__":     with tempfile.NamedTemporaryFile(mode="w", suffix=".txt") as temp_file:         temp_file.write("Gold is a liquid of blue-like colour.")         temp_file.flush()          brain = Brain.from_files(             name="test_brain",             file_paths=[temp_file.name],         )          answer = brain.ask("what is gold? answer in french")         print("answer:", answer) ```  and here's the error this gives:   ``` RuntimeError: There is no current event loop in thread 'MainThread'. ```  ### Relevant log output  ```bash Full traceback excerpt:   File ".../brain.py", line 383, in Brain.from_files     loop = asyncio.get_event_loop() RuntimeError: There is no current event loop in thread 'MainThread'.    Environment: Python version: 3.12.3 OS: Linux quivr-core version: latest from PyPI Installed via: pip ```  ### Twitter / LinkedIn details  _No response_
  **Post-Mortem & Fix Analysis**:
  > <!-- Greeting --> Hi @nsheff! I'm [Dosu](https://go.dosu.dev/dosubot) and I’m helping the quivr team.  <!-- Answer --> This error happens because Python 3.12 changed how asyncio event loops are managed: asyncio.get_event_loop() now raises a RuntimeError if no event loop is set in the current context, which is the case for fresh scripts like yours. The current Brain.from_files() implementation assumes an event loop is always available, which isn't true on Python 3.12+ scripts and causes this crash [see source](https://github.com/QuivrHQ/quivr/blob/947a785415c6c35ab2ae8157222b4720b0710b4d/core/quivr_core/brain/brain.py).  A quick workaround is to create and set an event loop before calling Brain.from_files(). You can add this before your call:  ```python import asyncio  try:     asyncio.get_running_loop() except RuntimeError:     loop = asyncio.new_event_loop()     asyncio.set_event_loop(loop) ```  Or, as a more robust solution, you can use the async version directly:  ```python import a
  > ### Brain.from_files() (sync wrapper) raises asyncio event-loop errors on Python 3.11+ / 3.12 — make sync wrapper robust  **Description** **Brain.from_files()** (and similar synchronous wrappers) call the async implementation internally and attempt to run it synchronously. On newer Python versions and in environments with a running event loop (REPLs, Jupyter, or frameworks), this causes errors such as:  - RuntimeError: asyncio.run() cannot be called from a running event loop - RuntimeError: There is no current event loop in thread 'MainThread'  This breaks the quick-start example on fresh installs and on Python ≥ 3.11/3.12 in several common environments.  **Minimal repro**  **from quivr_core import Brain**  if __name__ == "__main__":     brain = Brain.from_files(name="test_brain", file_paths=["example.txt"])     answer = brain.ask("what is gold? answer in french")     print(answer)   **Proposed change**  - Introduce a small helper used by sync wrappers to execute internal coroutines sa
  > Thanks for your contributions, we'll be closing this issue as it has gone stale. Feel free to reopen if you'd like to continue the discussion.

- **Issue #3623** (2025-04-18): **[Bug]: Doc Update**
  *Symptoms*: ### What happened?  Tried to install with python 3.10.6 and package was not found in pypi.  Maybe update docs as "Python 3.10 and newer" is not accurate.  Also tried to use Python 3.13 and ran into issues with numpy dependency.  I am using Python 3.11.5 now and it downloaded successfully.  ### Relevant log output  ```bash  ```  ### Twitter / LinkedIn details  _No response_
  **Post-Mortem & Fix Analysis**:
  > <!-- Greeting --> Hey there, @pAulseperformance! I'm here to help you with any bugs, questions, or contributions you might have. Let's get this sorted out together!  <!-- Answer --> The documentation should indeed be updated to reflect the correct Python version requirements. The package requires at least Python 3.11.9, not 3.10 as currently stated in the documentation <sup>[[1]](https://github.com/QuivrHQ/quivr/blob/main/docs/.python-version)</sup><sup>[[2]](https://github.com/QuivrHQ/quivr/blob/main/backend/requirements.txt)</sup><sup>[[3]](https://github.com/QuivrHQ/quivr/blob/main/core/.python-version)</sup><sup>[[4]](https://github.com/QuivrHQ/quivr/blob/main/core/pyproject.toml)</sup><sup>[[5]](https://github.com/QuivrHQ/quivr/blob/main/examples/simple_question/.python-version)</sup>. Additionally, the numpy dependency is specified as `numpy==1.26.4` for Python versions `>= '3.9'`, which might be causing issues with Python 3.13 <sup>[[2]](https://github.com/QuivrHQ/quivr/blob/mai

- **Issue #3617** (2025-03-21): **[Bug]: Can't install library on Windows**
  *Symptoms*: ### What happened?  (.venv) PS C:\quivr-main> pip install quivr-core Collecting quivr-core   Using cached quivr_core-0.0.26-py3-none-any.whl.metadata (1.0 kB) Collecting aiofiles>=23.1.0 (from quivr-core)   Using cached aiofiles-24.1.0-py3-none-any.whl.metadata (10 kB) Collecting faiss-cpu>=1.8.0.post1 (from quivr-core)   Using cached faiss_cpu-1.10.0-cp312-cp312-win_amd64.whl.metadata (4.5 kB) Collecting httpx>=0.27.0 (from quivr-core)   Using cached httpx-0.28.1-py3-none-any.whl.metadata (7.1 kB) Collecting langchain-anthropic>=0.1.23 (from quivr-core)   Using cached langchain_anthropic-0.3.10-py3-none-any.whl.metadata (1.9 kB) Collecting langchain-cohere>=0.1.0 (from quivr-core)   Using cached langchain_cohere-0.4.3-py3-none-any.whl.metadata (6.6 kB) Collecting langchain-community>=0.2.12 (from quivr-core)   Using cached langchain_community-0.3.20-py3-none-any.whl.metadata (2.4 kB) Collecting langchain-core>=0.2.38 (from quivr-core)   Using cached langchain_core-0.3.47-py3-none-any.whl.metadata (5.9 kB) Collecting langchain-openai>=0.1.0 (from quivr-core)   Using cached langchain_openai-0.3.9-py3-none-any.whl.metadata (2.3 kB) Collecting langchain<0.3.0,>=0.2.14 (from quivr-core)   Using cached langchain-0.2.17-py3-none-any.whl.metadata (7.1 kB) Collecting langgraph>=0.2.38 (from quivr-core)   Using cached langgraph-0.3.18-py3-none-any.whl.metadata (7.5 kB) Collecting markupsafe>=2.1.5 (from quivr-core)   Using cached MarkupSafe-3.0.2-cp312-cp312-win_amd64.whl.metadata (4.
  **Post-Mortem & Fix Analysis**:
  > <p><a href="https://linear.app/getquivr/issue/CORE-371/[bug]-cant-insatll-lib-on-windows">CORE-371 [Bug]: Can't insatll lib on Windows</a></p>
  > <!-- Greeting --> Hey @AlbaRuth, I'm here to assist you with any bugs, questions, or contributions while you wait for a human maintainer. Let's tackle this together!  <!-- Answer --> I found a similar open issue regarding the installation problem on Windows due to `uvloop` not supporting the platform. You can check the details of this issue [here](https://github.com/QuivrHQ/quivr/issues/3616). Unfortunately, no solution has been found in the comments of that issue <sup>[[1]](https://github.com/QuivrHQ/quivr/issues/3616)</sup>.  Since `uvloop` is not listed as a required dependency in the setup configuration of the `quivr-core` package, you might try to exclude it from the installation if possible <sup>[[2]](https://github.com/QuivrHQ/quivr/blob/main/backend/requirements.txt)</sup><sup>[[3]](https://github.com/QuivrHQ/quivr/blob/main/core/pyproject.toml)</sup>. Alternatively, you could look for a way to install `quivr-core` without the optional dependencies that require `uvloop`.   <!--

- **Issue #3616** (2025-04-18): **[Bug]: stopped installing quivr-core due to (error: subprocess-exited-with-error)**
  *Symptoms*: ### What happened?  Dear All  Thanks a lot for this amazing application.  kindly not that a bug happened running on windows while installing quivr after entering this `pip install quivr-core # Check that the installation worked`, the following stopped me   ``` Collecting uvloop>=0.18.0 (from megaparse==0.0.43->megaparse[all]==0.0.43->quivr-core)   Using cached uvloop-0.21.0.tar.gz (2.5 MB)   Installing build dependencies ... done   Getting requirements to build wheel ... error   error: subprocess-exited-with-error    × Getting requirements to build wheel did not run successfully.   │ exit code: 1   ╰─> [20 lines of output]       Traceback (most recent call last):         File "C:\Users\ai\.conda\envs\quivr\Lib\site-packages\pip\_vendor\pyproject_hooks\_in_process\_in_process.py", line 389, in <module>           main()           ~~~~^^         File "C:\Users\ai\.conda\envs\quivr\Lib\site-packages\pip\_vendor\pyproject_hooks\_in_process\_in_process.py", line 373, in main           json_out["return_val"] = hook(**hook_input["kwargs"])                                    ~~~~^^^^^^^^^^^^^^^^^^^^^^^^         File "C:\Users\ai\.conda\envs\quivr\Lib\site-packages\pip\_vendor\pyproject_hooks\_in_process\_in_process.py", line 143, in get_requires_for_build_wheel           return hook(config_settings)         File "C:\Users\ai\AppData\Local\Temp\pip-build-env-uofmz46i\overlay\Lib\site-packages\setuptools\build_meta.py", line 334, in get_requires_for_build_wheel           return self._ge
  **Post-Mortem & Fix Analysis**:
  > <p><a href="https://linear.app/getquivr/issue/CORE-370/[bug]-stopped-installing-quivr-core-due-to-error-subprocess-exited">CORE-370 [Bug]: stopped installing quivr-core due to (error: subprocess-exited-with-error)</a></p>

- **Issue #3582** (2025-02-05): **[Bug]:  Test Jacopo**
  *Symptoms*: ### What happened?  A bug happened!  ### Relevant log output  ```bash Tootot ```  ### Twitter / LinkedIn details  _No response_
  **Post-Mortem & Fix Analysis**:
  > <p><a href="https://linear.app/getquivr/issue/ENT-549/[bug]-test-jacopo">ENT-549 [Bug]: Test Jacopo</a></p>

- **Issue #3570** (2025-01-29): **Fix error on Hugging Face CRAG dataset**
  *Symptoms*: We are observing the error below on certain subsets of CRAG, the reason being that the alt_ans field can sometimes contain an empty list (which apparently is interpreted as a number) or a list of strings. This prevents us from visualizing the dataset on the platform, but also to retrieve using `import load_dataset from dataset`  ``` Cannot load the dataset split (in streaming mode) to extract the first rows. Error code:   StreamingRowsError Exception:    ArrowInvalid Message:      JSON parse error: Column(/alt_ans/[]) changed from number to string in row 7 Traceback:    Traceback (most recent call last):                 File "/src/services/worker/.venv/lib/python3.9/site-packages/datasets/packaged_modules/json/json.py", line 160, in _generate_tables                   df = pandas_read_json(f)                 File "/src/services/worker/.venv/lib/python3.9/site-packages/datasets/packaged_modules/json/json.py", line 38, in pandas_read_json                   return pd.read_json(path_or_buf, **kwargs)                 File "/src/services/worker/.venv/lib/python3.9/site-packages/pandas/io/json/_json.py", line 815, in read_json                   return json_reader.read()                 File "/src/services/worker/.venv/lib/python3.9/site-packages/pandas/io/json/_json.py", line 1025, in read                   obj = self._get_object_parser(self.data)                 File "/src/services/worker/.venv/lib/python3.9/site-packages/pandas/io/json/_json.py", line 1051, in _get_object_parser   
  **Post-Mortem & Fix Analysis**:
  > <p><a href="https://linear.app/getquivr/issue/CORE-347/fix-error-on-hugging-face-crag-dataset">CORE-347 Fix error on Hugging Face CRAG dataset</a></p>

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

### Incident Patch 1: `947a7854` (2025-06-19)
**Commit Message**: fix: add Claude 4 support (#3645)

Add claude 4 support

**File**: `core/quivr_core/rag/entities/config.py` (modified, +10/-0)
```diff
@@ -152,6 +152,16 @@ class LLMModelConfig:
             ),
         },
         DefaultModelSuppliers.ANTHROPIC: {
+            "claude-opus-4": LLMConfig(
+                max_context_tokens=200000,
+                max_output_tokens=8192,
+                tokenizer_hub="Quivr/claude-tokenizer",
+            ),
+            "claude-sonnet-4": LLMConfig(
+                max_context_tokens=200000,
+                max_output_tokens=8192,
+                tokenizer_hub="Quivr/claude-tokenizer",
+            ),
             "claude-3-7-sonnet": LLMConfig(
                 max_context_tokens=200000,
                 max_output_tokens=8192,
```

---

### Incident Patch 2: `5dd44d8e` (2025-06-02)
**Commit Message**: fix: historic and iterate (#3642)

fix: ENT-1146
Fix 1: context length to 0

Fix: 2: Historic is now added

**File**: `core/quivr_core/rag/entities/config.py` (modified, +23/-0)
```diff
@@ -17,6 +17,8 @@
 from quivr_core.processor.splitter import SplitterConfig
 
 logger = logging.getLogger("quivr_core")
+MIN_CONTEXT_TOKENS = 4096
+MIN_OUTPUT_TOKENS = 4096
 
 
 def normalize_to_env_variable_name(name: str) -> str:
@@ -84,6 +86,11 @@ class LLMConfig(QuivrBaseConfig):
 class LLMModelConfig:
     _model_defaults: Dict[DefaultModelSuppliers, Dict[str, LLMConfig]] = {
         DefaultModelSuppliers.OPENAI: {
+            "gpt-4.1": LLMConfig(
+                max_context_tokens=1047576,
+                max_output_tokens=32768,
+                tokenizer_hub="Quivr/gpt-4o",
+            ),
             "gpt-4o": LLMConfig(
                 max_context_tokens=128000,
                 max_output_tokens=16384,
@@ -366,13 +373,29 @@ def set_llm_model_config(self):
                         f"Lowering max_context_tokens from {self.max_context_tokens} to {_max_context_tokens}"
                     )
                     self.max_context_tokens = _max_context_tokens
+
+                if self.max_context_tokens < MIN_CONTEXT_TOKENS:
+                    logger.error(
+                        f"max_context_tokens is too low: {self.max_context_tokens}. "
+                    )
+                    raise ValueError(
+                        f"max_context_tokens is too low: {self.max_context_tokens}. "
+                    )
             if llm_model_config.max_output_tokens:
                 if self.max_output_tokens > llm_model_config.max_output_tokens:
                     logger.warning(
                         f"Lowering max_output_tokens from {self.max_output_tokens} to {llm_model_config.max_output_tokens}"
                     )
                     self.max_output_tokens = llm_model_config.max_output_tokens
 
+                if self.max_output_tokens < MIN_OUTPUT_TOKENS:
+                    logger.error(
+                        f"max_output_tokens is too low: {self.max_output_tokens}. "
+                    )
+                    raise ValueError(
+                        f"max_output_tokens is too low: {self.max_output_tokens}. "
+                    )
+
             self.tokenizer_hub = llm_model_config.tokenizer_hub
 
     def set_llm_model(self, model: str):
```

**File**: `core/quivr_core/rag/quivr_rag_langgraph.py` (modified, +13/-6)
```diff
@@ -24,6 +24,7 @@
 from langchain_core.documents import BaseDocumentCompressor, Document
 from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
 from langchain_core.messages.ai import AIMessageChunk
+from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
 from langchain_core.prompts.base import BasePromptTemplate
 from langchain_core.runnables.schema import StreamEvent
 from langchain_core.vectorstores import VectorStore
@@ -460,6 +461,7 @@ def filter_history(self, state: AgentState) -> AgentState:
             message_tokens = self.llm_endpoint.count_tokens(
                 human_message.content
             ) + self.llm_endpoint.count_tokens(ai_message.content)
+
             if (
                 total_tokens + message_tokens
                 > self.retrieval_config.llm_config.max_context_tokens
@@ -1003,13 +1005,18 @@ def generate_chat_llm(self, state: AgentState) -> AgentState:
         state, reduced_inputs = self.reduce_rag_context(
             state, final_inputs, system_message if system_message else prompt
         )
-        CHAT_LLM_PROMPT = [
-            SystemMessage(content=str(system_message)),
-            HumanMessage(content=str(user_message)),
-        ]
-
+        CHAT_LLM_PROMPT = ChatPromptTemplate.from_messages(
+            [
+                SystemMessage(content=str(system_message)),
+                MessagesPlaceholder(variable_name="chat_history"),
+                HumanMessage(content=str(user_message)),
+            ]
+        )
         # Run
-        response = llm.invoke(CHAT_LLM_PROMPT)
+        chat_llm_prompt = CHAT_LLM_PROMPT.invoke(
+            {"chat_history": final_inputs["chat_history"]}
+        )
+        response = llm.invoke(chat_llm_prompt)
         return {**state, "messages": [response]}
 
     def build_chain(self):
```

---

### Incident Patch 3: `62a85850` (2025-05-05)
**Commit Message**: fix: prompts to ensure correct formatting (#3636)

Fix : ENT-1043

**File**: `core/quivr_core/rag/prompts.py` (modified, +1/-0)
```diff
@@ -276,6 +276,7 @@ def _define_custom_prompts() -> dict[TemplatePromptName, BasePromptTemplate]:
     <default instructions>
     - Don't be too verbose, use the same amount of details as in similar tickets.
     - Use the same tone, format, structure and lexical field as in similar tickets agent responses.
+    - The text must be correctly formatted with paragraphs, bold, italic, etc so it is easier to read.
     - Maintain consistency in terminology used in recent tickets.
     - Answer in the same language as the user.
     - Don't add a signature at the end of the answer, it will be added once the answer is sent.
```

---

### Incident Patch 4: `4f0fb6f4` (2025-04-18)
**Commit Message**: fix(brain): pass missing run_id (#3631)

# Description

Please include a summary of the changes and the related issue. Please
also include relevant motivation and context.

## Checklist before requesting a review

Please delete options that are not relevant.

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my code
- [ ] I have commented hard-to-understand areas
- [ ] I have ideally added tests that prove my fix is effective or that
my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged

## Screenshots (if appropriate):

**File**: `core/quivr_core/brain/brain.py` (modified, +3/-0)
```diff
@@ -496,6 +496,7 @@ def add_file(self) -> None:
     async def ask_streaming(
         self,
         question: str,
+        run_id: UUID,
         system_prompt: str | None = None,
         retrieval_config: RetrievalConfig | None = None,
         rag_pipeline: Type[Union[QuivrQARAG, QuivrQARAGLangGraph]] | None = None,
@@ -542,6 +543,7 @@ async def ask_streaming(
             "langfuse_session_id": str(self.chat_id),
         }
         async for response in rag_instance.answer_astream(
+            run_id=run_id,
             question=question,
             system_prompt=system_prompt or None,
             history=chat_history,
@@ -585,6 +587,7 @@ async def aask(
         full_answer = ""
 
         async for response in self.ask_streaming(
+            run_id=run_id,
             question=question,
             system_prompt=system_prompt,
             retrieval_config=retrieval_config,
```

---

### Incident Patch 5: `2898a5d5` (2025-04-17)
**Commit Message**: fix: fix grammar and typo in zendesk prompte template (#3628)

# Description

Fix grammar and typo in zendesk prompte template

## Checklist before requesting a review

Please delete options that are not relevant.

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my code
- [ ] I have commented hard-to-understand areas
- [ ] I have ideally added tests that prove my fix is effective or that
my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged

## Screenshots (if appropriate):

**File**: `core/quivr_core/rag/prompts.py` (modified, +3/-3)
```diff
@@ -268,7 +268,7 @@ def _define_custom_prompts() -> dict[TemplatePromptName, BasePromptTemplate]:
     You will also have access to the most relevant similar tickets and additional information sometimes such as API calls.
     Never add something in brackets that needs to be filled like [your name], [your email], etc. 
     Do NOT invent information that was not present in previous tickets or in user metabadata or ticket metadata or additional information.
-    Always prioritize information from the most recent tickets, espcially if they are contradictory.
+    Always prioritize information from the most recent tickets, especially if they are contradictory.
     
     Here is the current time: {current_time} UTC
     
@@ -289,12 +289,12 @@ def _define_custom_prompts() -> dict[TemplatePromptName, BasePromptTemplate]:
     """
 
     user_prompt_template = """
-    Here are informations about the user that can help you to answer:
+    Here is information about the user that can help you to answer:
     <user_metadata>
     {user_metadata}
     </user_metadata>
 
-    Here are metadata on the curent ticket that can help you to answer:
+    Here are metadata on the current ticket that can help you to answer:
     <ticket_metadata>
     {ticket_metadata}
     </ticket_metadata>
```

---

### Incident Patch 6: `df2d345f` (2025-04-10)
**Commit Message**: fix: format prompt for zendesk (#3627)

# Description

Please include a summary of the changes and the related issue. Please
also include relevant motivation and context.

## Checklist before requesting a review

Please delete options that are not relevant.

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my code
- [ ] I have commented hard-to-understand areas
- [ ] I have ideally added tests that prove my fix is effective or that
my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged

## Screenshots (if appropriate):

**File**: `core/quivr_core/rag/prompts.py` (modified, +3/-3)
```diff
@@ -323,10 +323,10 @@ def _define_custom_prompts() -> dict[TemplatePromptName, BasePromptTemplate]:
     Based on the informations provided, answer directly with the message to send to the customer, ready to be sent:
     Answer:"""
 
-    ZENDESK_TEMPLATE_PROMPT = ChatPromptTemplate(
+    ZENDESK_TEMPLATE_PROMPT = ChatPromptTemplate.from_messages(
         [
-            ("system", system_message_zendesk_template),
-            ("user", user_prompt_template),
+            SystemMessagePromptTemplate.from_template(system_message_zendesk_template),
+            HumanMessagePromptTemplate.from_template(user_prompt_template),
         ]
     )
     custom_prompts[TemplatePromptName.ZENDESK_TEMPLATE_PROMPT] = ZENDESK_TEMPLATE_PROMPT
```

**File**: `core/quivr_core/rag/quivr_rag_langgraph.py` (modified, +1/-1)
```diff
@@ -943,7 +943,7 @@ def generate_zendesk_rag(self, state: AgentState) -> AgentState:
             if variable not in inputs:
                 inputs[variable] = state.get(variable, "")
 
-        msg = prompt_template.format(**inputs)
+        msg = prompt_template.format_prompt(**inputs)
         llm = self.bind_tools_to_llm(self.generate_zendesk_rag.__name__)
         response = llm.invoke(msg)
 
```

---

### Incident Patch 7: `4f61fa98` (2025-04-10)
**Commit Message**: refactor: improve assertion formatting and remove debug print statement in QuivrQARAGLangGraph (#3626)

# Description

Please include a summary of the changes and the related issue. Please
also include relevant motivation and context.

## Checklist before requesting a review

Please delete options that are not relevant.

- [ ] My code follows the style guidelines of this project
- [ ] I have performed a self-review of my code
- [ ] I have commented hard-to-understand areas
- [ ] I have ideally added tests that prove my fix is effective or that
my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] Any dependent changes have been merged

## Screenshots (if appropriate):

**File**: `core/quivr_core/rag/quivr_rag_langgraph.py` (modified, +3/-4)
```diff
@@ -812,9 +812,9 @@ async def retrieve_full_documents_context(self, state: AgentState) -> AgentState
 
         _docs = []
 
-        assert hasattr(
-            self.vector_store, "get_vectors_by_knowledge_id"
-        ), "Vector store must have method 'get_vectors_by_knowledge_id', this is an enterprise only feature"
+        assert hasattr(self.vector_store, "get_vectors_by_knowledge_id"), (
+            "Vector store must have method 'get_vectors_by_knowledge_id', this is an enterprise only feature"
+        )
 
         for knowledge_id in top_knowledge_ids:
             _docs.append(
@@ -970,7 +970,6 @@ def generate_chat_llm(self, state: AgentState) -> AgentState:
             dict: The updated state with re-phrased question
         """
         messages = state["messages"]
-        print(messages)
 
         # Check if there is a system message in messages
         system_message = None
```

---

### Incident Patch 8: `22c740b9` (2025-03-14)
**Commit Message**: feat: fix chat with model (#3615)

# Description


FIX bug

**File**: `core/quivr_core/brain/brain.py` (modified, +1/-5)
```diff
@@ -519,7 +519,6 @@ async def ask_streaming(
             print(chunk.answer)
         ```
         """
-        assert self.vector_db
         llm = self.llm
 
         # If you passed a different llm model we'll override the brain  one
@@ -529,10 +528,7 @@ async def ask_streaming(
         else:
             retrieval_config = RetrievalConfig(llm_config=self.llm.get_config())
 
-        if rag_pipeline is None:
-            rag_pipeline = QuivrQARAGLangGraph
-
-        rag_instance = rag_pipeline(
+        rag_instance = QuivrQARAGLangGraph(
             retrieval_config=retrieval_config, llm=llm, vector_store=self.vector_db
         )
 
```

---

### Incident Patch 9: `501783b5` (2025-02-27)
**Commit Message**: fix: add system prompt to zendesk rag (#3604)

# Description

Add System prompt to zendesk rag

fix: ENT-673

**File**: `core/quivr_core/rag/prompts.py` (modified, +4/-0)
```diff
@@ -280,6 +280,10 @@ def _define_custom_prompts() -> CustomPromptsDict:
     {similar_tickets}
     -------------------------------------
 
+    ------ Current Ticket History ------
+    {system_prompt}
+    -------------------------------------
+
     ------ Client Query ------
     {client_query}
     --------------------------
```

**File**: `core/quivr_core/rag/quivr_rag_langgraph.py` (modified, +3/-0)
```diff
@@ -913,6 +913,9 @@ def generate_zendesk_rag(self, state: AgentState) -> AgentState:
         inputs = {
             "similar_tickets": docs,
             "client_query": user_task,
+            "system_prompt": self.retrieval_config.prompt
+            if self.retrieval_config.prompt
+            else "",
         }
 
         msg = custom_prompts.ZENDESK_TEMPLATE_PROMPT.format(**inputs)
```

---

### Incident Patch 10: `699b5495` (2025-02-12)
**Commit Message**: fix: Zendesk system prompt (#3592)

* Modify zendesk system prompt

**File**: `core/quivr_core/rag/prompts.py` (modified, +10/-0)
```diff
@@ -266,6 +266,16 @@ def _define_custom_prompts() -> CustomPromptsDict:
     - Give a the most complete answer to the client query and give relevant links if needed.
     - Based on the following similar client tickets, provide a response to the client query in the same format.
 
+    ------ Output Format ------
+    - You shouln't provide the greetings and the signature as those will be added automatically after generation.
+    - Avoid using lists or bullet points, or any other formatting that feels robotic in the response.
+    - Use paragraphs and sentences.
+    - Provide a neutral tone response, and a generalist answer, avoid specific.
+    - Keep the same lexical field as in the similar tickets agent responses.
+    - Always add the most relevant informations to the response, just like in similar tickets response so the user have all the informations needed.
+    - Stay as close as similar response as possible.
+
+
     ------ Zendesk Similar Tickets ------
     {similar_tickets}
     -------------------------------------
```

#### Recent Merged Pull Requests:
- **PR #3713** (closed): feat(search-ui): front de recherche RAG — modes Recherche et Agent (@Zewed)
- **PR #3712** (closed): Remediation/unifai gha main 947a785 08240004 (@radhika-singh-10)
- **PR #3708** (closed): docs: fix typos in README (Opiniated → Opinionated, asnwer → answer) (@MarkHe1222)
- **PR #3702** (closed): fix(deps): pin langfuse <3 and support moved CallbackHandler import (@Solaris-star)
- **PR #3699** (closed): docs: add community health files (CONTRIBUTING.md, CODE_OF_CONDUCT.md) (@Mukller)
- **PR #3690** (closed): feat: add TwelveLabs video ingestion (Pegasus) and Marengo embeddings (@mohit-twelvelabs)
- **PR #3659** (closed): feat: Add Forge LLM provider support (@Yiiii0)
- **PR #3655** (closed): Sync (@rodgui)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
