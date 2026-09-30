# Forensic Learning Record (Deep Inspection): qdrant/fastembed

> **Canonical Artifact**: `07_PROJECT_LEARNING/qdrant-fastembed-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/qdrant/fastembed](https://github.com/qdrant/fastembed))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:07:52.449Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `qdrant/fastembed`
- **Description**: Fast, Accurate, Lightweight Python library to make State of the Art Embedding
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3228 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `experiments/attention_export.py`
```
from optimum.exporters.onnx import main_export
from transformers import AutoTokenizer

model_id = "sentence-transformers/paraphrase-MiniLM-L6-v2"
output_dir = f"models/{model_id.replace('/', '_')}"
model_kwargs = {"output_attentions": True, "return_dict": True}
tokenizer = AutoTokenizer.from_pretrained(model_id)

# export if the output model does not exist
# try:
#     sess = onnxruntime.InferenceSession(f"{output_dir}/model.onnx")
#     print("Model already exported")
# except FileNotFoundError:
print(f"Exporting model to {output_dir}")
main_export(
    model_id, output=output_dir, no_post_process=True, model_kwargs=model_kwargs
)

```

### Core Architecture Module: `experiments/if_splade_to_onnx.py`
```
"""Export an inference-free SPLADE document encoder to ONNX.

Converts `opensearch-project/opensearch-neural-sparse-encoding-doc-v3-gte` (an MLM head
over a GTE backbone) into an onnx model producing token logits, and assembles a model dir
with everything fastembed's `IfSplade` needs: model.onnx, tokenizer files and idf.json.

Usage:
    python experiments/if_splade_to_onnx.py --output-dir models/opensearch-neural-sparse-encoding-doc-v3-gte
"""

import argparse
import shutil
from pathlib import Path

import torch
from huggingface_hub import hf_hub_download
from transformers import AutoModelForMaskedLM, AutoTokenizer

MODEL_ID = "opensearch-project/opensearch-neural-sparse-encoding-doc-v3-gte"
# revision of the remote modeling code (Alibaba-NLP/new-impl), pinned in the model card
CODE_REVISION = "40ced75c3017eb27626c9d4ea981bde21a2662f4"

TOKENIZER_FILES = [
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "vocab.txt",
    "idf.json",
]


class LogitsOnly(torch.nn.Module):
    def __init__(self, model: torch.nn.Module):
        super().__init__()
        self.model = model

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        return self.model(input_ids=input_ids, attention_mask=attention_mask).logits


def export(model_id: str, output_dir: Path, opset: int = 14) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)

    model = AutoModelForMaskedLM.from_pretrained(
        model_id, trust_remote_code=True, code_revision=CODE_REVISION
    )
    model.eval()
    wrapped = LogitsOnly(model)

    tokenizer = AutoTokenizer.from_pretrained(model_id)
    dummy = tokenizer(
        ["fastembed is a library", "onnx export"],
        padding=True,
        truncation=True,
        return_tensors="pt",
        return_token_type_ids=False,
    )

    onnx_path = output_dir / "model.onnx"
    with torch.inference_mode():
        torch.onnx.export(
            wrapped,
            (dummy["input_ids"], dummy["attention_mask"]),
            f=onnx_path.as_posix(),
            input_names=["input_ids", "attention_mask"],
            output_names=["logits"],
            dynamic_axes={
                "input_ids": {0: "batch_size", 1: "sequence_length"},
                "attention_mask": {0: "batch_size", 1: "sequence_length"},
                "logits": {0: "batch_size", 1: "sequence_length"},
            },
            do_constant_folding=True,
            opset_version=opset,
            dynamo=False,
        )

    for file_name in TOKENIZER_FILES:
        local_path = hf_hub_download(repo_id=model_id, filename=file_name)
        shutil.copy(local_path, output_dir / file_name)

    return onnx_path


def parity_check(model_id: str, output_dir: Path) -> None:
    import numpy as np
    import onnxruntime as ort

    model = AutoModelForMaskedLM.from_pretrained(
        model_id, trust_remote_code=True, code_revision=CODE_REVISION
    )
    model.eval()
    tokenizer = AutoTokenizer.from_pretrained(model_id)

    documents = [
        "Currently New York is rainy.",
        "fastembed is a lightweight library for generating embeddings",
        "hello world",
    ]
    features = tokenizer(
        documents, padding=True, truncation=True, return_tensors="pt", return_token_type_ids=False
    )

    with torch.inference_mode():
        torch_logits = model(**features).logits.numpy()

    session = ort.InferenceSession(output_dir / "model.onnx")
    onnx_logits = session.run(
        ["logits"],
        {
            "input_ids": features["input_ids"].numpy(),
            "attention_mask": features["attention_mask"].numpy(),
        },
    )[0]

    max_diff = np.abs(torch_logits - onnx_logits).max()
    print(f"max |torch - onnx| logits diff: {max_diff}")
    assert max_diff < 1e-3, "onnx export does not match the torch model"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-id", default=MODEL_ID)
    parser.add_argument("--output-dir", default=f"models/{MODEL_ID.replace('/', '_')}", type=Path)
    parser.add_argument("--opset", default=14, type=int)
    args = parser.parse_args()

    onnx_path = export(args.model_id, args.output_dir, args.opset)
    print(f"Exported to {onnx_path}")
    parity_check(args.model_id, args.output_dir)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `experiments/try_attention_export.py`
```
import numpy as np
import onnx
import onnxruntime
from transformers import AutoTokenizer

model_id = "sentence-transformers/paraphrase-MiniLM-L6-v2"
output_dir = f"models/{model_id.replace('/', '_')}"
model_kwargs = {"output_attentions": True, "return_dict": True}
tokenizer = AutoTokenizer.from_pretrained(model_id)

model_path = f"{output_dir}/model.onnx"
onnx_model = onnx.load(model_path)
ort_session = onnxruntime.InferenceSession(model_path)
text = "This is a test sentence"
tokenizer_output = tokenizer(text, return_tensors="np")
input_ids = tokenizer_output["input_ids"]
attention_mask = tokenizer_output["attention_mask"]
print(attention_mask)
# Prepare the input
input_ids = np.array(input_ids).astype(
    np.int64
)  # Replace your_input_ids with actual input data

# Run the ONNX model
outputs = ort_session.run(
    None, {"input_ids": input_ids, "attention_mask": attention_mask}
)

# Get the attention weights
attentions = outputs[-1]

# Print the attention weights for the first layer and first head
print(attentions[0][0])

```

### Core Architecture Module: `fastembed/__init__.py`
```
import importlib.metadata

from fastembed.image import ImageEmbedding
from fastembed.late_interaction import LateInteractionTextEmbedding
from fastembed.late_interaction_multimodal import LateInteractionMultimodalEmbedding
from fastembed.sparse import SparseEmbedding, SparseTextEmbedding
from fastembed.text import TextEmbedding

try:
    version = importlib.metadata.version("fastembed")
except importlib.metadata.PackageNotFoundError as _:
    version = importlib.metadata.version("fastembed-gpu")

__version__ = version
__all__ = [
    "TextEmbedding",
    "SparseTextEmbedding",
    "SparseEmbedding",
    "ImageEmbedding",
    "LateInteractionTextEmbedding",
    "LateInteractionMultimodalEmbedding",
]

```

### Core Architecture Module: `fastembed/common/__init__.py`
```
from fastembed.common.types import ImageInput, OnnxProvider, PathInput

__all__ = ["OnnxProvider", "ImageInput", "PathInput"]

```

### Core Architecture Module: `fastembed/common/model_description.py`
```
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


@dataclass(frozen=True)
class ModelSource:
    hf: str | None = None
    url: str | None = None
    _deprecated_tar_struct: bool = False

    @property
    def deprecated_tar_struct(self) -> bool:
        return self._deprecated_tar_struct

    def __post_init__(self) -> None:
        if self.hf is None and self.url is None:
            raise ValueError(
                f"At least one source should be set, current sources: hf={self.hf}, url={self.url}"
            )


@dataclass(frozen=True)
class BaseModelDescription:
    model: str
    sources: ModelSource
    model_file: str
    description: str
    license: str
    size_in_GB: float
    additional_files: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class DenseModelDescription(BaseModelDescription):
    dim: int | None = None
    tasks: dict[str, Any] | None = field(default_factory=dict)

    def __post_init__(self) -> None:
        assert self.dim is not None, "dim is required for dense model description"


@dataclass(frozen=True)
class SparseModelDescription(BaseModelDescription):
    requires_idf: bool | None = None
    vocab_size: int | None = None


class PoolingType(str, Enum):
    CLS = "CLS"
    MEAN = "MEAN"
    LAST_TOKEN = "LAST_TOKEN"
    DISABLED = "DISABLED"

```

### Core Architecture Module: `fastembed/common/model_management.py`
```
import os
import time
import gzip
import json
import shutil
import tarfile
import tempfile
import warnings
import contextlib
from copy import deepcopy
from pathlib import Path, PureWindowsPath
from typing import Any, TypeVar, Generic

import requests
from huggingface_hub import constants, snapshot_download, model_info, list_repo_tree
from huggingface_hub.file_download import repo_folder_name
from huggingface_hub.hf_api import RepoFile
from huggingface_hub.utils import (
    HFValidationError,
    RepositoryNotFoundError,
    disable_progress_bars,
    enable_progress_bars,
)
from loguru import logger
from tqdm import tqdm
from fastembed.common.model_description import BaseModelDescription

T = TypeVar("T", bound=BaseModelDescription)

_DOWNLOAD_CHUNK_SIZE = 256 * 1024


def _hf_transport_errors() -> tuple[type[Exception], ...]:
    """Network errors of huggingface_hub's HTTP library that aren't OSError.

    A refused connection, a DNS failure or a timeout raises an OSError in huggingface_hub 0.x,
    which is built on requests, but a TransportError in 1.x (httpx) and 2.x (httpx2).
    """
    try:
        # huggingface_hub>=1.30 re-exports whichever of httpx and httpx2 it's built on.
        from huggingface_hub.utils import httpx
    except ImportError:
        try:
            import httpx  # huggingface_hub 1.0 to 1.29
        except ImportError:  # huggingface_hub 0.x
            return ()
    return (httpx.TransportError,)


# Errors from an HF download that download_model handles by falling back to url and retrying.
_HF_DOWNLOAD_ERRORS = (OSError, RepositoryNotFoundError, ValueError) + _hf_transport_errors()


class CorruptedCacheError(ValueError):
    """A cached model file is present but does not match the size recorded for it.

    Distinct from the download failures above so that callers can tell "this snapshot is
    unusable, look elsewhere" apart from "the hub could not be reached": only the former
    is worth re-fetching a file the hub's existence-only cache check would otherwise keep.
    Subclasses ValueError to stay inside _HF_DOWNLOAD_ERRORS for callers that don't care.
    """


class ModelManagement(Generic[T]):
    METADATA_FILE = "files_metadata.json"

    @classmethod
    def list_supported_models(cls) -> list[dict[str, Any]]:
        """Lists the supported models.

        Returns:
            list[T]: A list of dictionaries containing the model information.
        """
        raise NotImplementedError()

    @classmethod
    def add_custom_model(
        cls,
        *args: Any,
        **kwargs: Any,
    ) -> None:
        """Add a custom model to the existing embedding classes based on the passed model descriptions

        Model description dict should contain the fields same as in one of the model descriptions presented
         in fastembed.common.model_description

         E.g. for BaseModelDescription:
              model: str
              sources: ModelSource
              model_file: str
              description: str
              license: str
              size_in_GB: float
              additional_files: list[str]

        Returns:
            None
        """
        raise NotImplementedError()

    @classmethod
    def _list_supported_models(cls) -> list[T]:
        raise NotImplementedError()

    @classmethod
    def _get_model_description(cls, model_name: str) -> T:
        """
        Gets the model description from the model_name.

        Args:
            model_name (str): The name of the model.

        raises:
            ValueError: If the model_name is not supported.

        Returns:
            T: The model description.
        """
        for model in cls._list_supported_models():
            if model_name.lower() == model.model.lower():
                return model

        raise ValueError(f"Model {model_name} is not supported in {cls.__name__}.")

    @classmethod
    def download_file_from_gcs(cls, url: str, output_path: str, show_progress: bool = True) -> str:
        """
        Downloads a file from Google Cloud Storage.

        Args:
            url (str): The URL to download the file from.
            output_path (str): The path to save the downloaded file to.
            show_progress (bool, optional): Whether to show a progress bar. Defaults to True.

        Returns:
            str: The path to the downloaded file.
        """

        response = requests.get(url, stream=True, timeout=(10, 120))

        # Handle HTTP errors
        if response.status_code == 403:
            raise PermissionError(
                "Authentication Error: You do not have permission to access this resource. "
                "Please check your credentials."
            )
        # Otherwise an error page gets written out as though it were the archive.
        response.raise_for_status()

        # Get the total size of the file
        total_size_in_bytes = int(response.headers.get("content-length", 0))

        # Warn if the total size is zero
        if total_size_in_bytes == 0:
            print(f"Warning: Content-length header is missing or zero in the response from {url}.")

        show_progress = bool(total_size_in_bytes and show_progress)

        with tqdm(
            total=total_size_in_bytes,
            unit="iB",
            unit_scale=True,
            disable=not show_progress,
        ) as progress_bar:
            with open(output_path, "wb") as file:
                for chunk in response.iter_content(chunk_size=_DOWNLOAD_CHUNK_SIZE):
                    if chunk:  # Filter out keep-alive new chunks
                        progress_bar.update(len(chunk))
                        file.write(chunk)
        return output_path

    @classmethod
    def _find_legacy_cased_source(cls, cache_dir: str, hf_source_repo: str) -> str | None:
        """Looks for a cached snapshot of the same repo spelled with a different casing.

        Built-in sources used to be lowercase and were canonicalized once it turned out that
        relying on the hub's normalizing redirect breaks proxies. Both the hub and fastembed
        derive the cache directory from the source verbatim, so on a case-sensitive filesystem
        an offline load would otherwise miss a model an older version had already cached.

        Args:
            cache_dir (str): The path to the cache directory.
            hf_source_repo (str): Name of the model on HuggingFace Hub.

        Returns:
            str | None: The differently cased source found in the cache, None if there is none.
        """
        separator = constants.REPO_ID_SEPARATOR
        try:
            expected = repo_folder_name(repo_id=hf_source_repo, repo_type="model")
            entries = list(Path(cache_dir).iterdir())
        except (HFValidationError, OSError):
            return None

        # the repo id sits at the tail of the folder name, with every "/" replaced
        offset = len(expected) - len(hf_source_repo.replace("/", separator))

        for entry in entries:
            if entry.name == expected or entry.name.lower() != expected.lower():
                continue
            if not entry.is_dir():
                continue
            # the hub forbids the separator inside a repo id, so it only marks the split
            return entry.name[offset:].replace(separator, "/")
        return None

    @classmethod
    def download_files_from_huggingface(
        cls,
        hf_source_repo: str,
        cache_dir: str,
        extra_patterns: list[str],
        local_files_only: bool = False,
        **kwargs: Any,
    ) -> str:
        """
        Downloads a model from HuggingFace Hub.
        Args:
            hf_source_repo (str): Name of the model on HuggingFace Hub, e.g. "Qdrant/all-MiniLM-L6-v2-onnx".
            cache_dir (Optional[str]): The path to the cache directory.
            extra_patterns (list[str]): extra patterns to allow in the snapshot download, typically
                includes the required model files.
            local
```

### Core Architecture Module: `fastembed/common/onnx_model.py`
```
import warnings
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Generic, Iterable, Sequence, Type, TypeVar

import numpy as np
import onnxruntime as ort

from numpy.typing import NDArray
from tokenizers import Tokenizer

from fastembed.common.types import OnnxProvider, NumpyArray, Device
from fastembed.parallel_processor import Worker

# Holds type of the embedding result
T = TypeVar("T")


@dataclass
class OnnxOutputContext:
    model_output: NumpyArray
    attention_mask: NDArray[np.int64] | None = None
    input_ids: NDArray[np.int64] | None = None
    metadata: dict[str, Any] | None = None


class OnnxModel(Generic[T]):
    EXPOSED_SESSION_OPTIONS = ("enable_cpu_mem_arena",)

    @classmethod
    def _get_worker_class(cls) -> Type["EmbeddingWorker[T]"]:
        raise NotImplementedError("Subclasses must implement this method")

    def _get_worker_init_kwargs(self) -> dict[str, Any]:
        """Additional kwargs a worker process needs to reconstruct this model.

        Workers are started with `spawn`/`forkserver`, hence they don't inherit class-level state
        which has been set up in runtime, e.g. models registered via `add_custom_model`.
        Such state has to be shipped to the workers explicitly.

        Returns:
            dict[str, Any]: kwargs to pass to `_get_worker_class().init_embedding`.
        """
        return {}

    def _post_process_onnx_output(self, output: OnnxOutputContext, **kwargs: Any) -> Iterable[T]:
        """Post-process the ONNX model output to convert it into a usable format.

        Args:
            output (OnnxOutputContext): The raw output from the ONNX model.
            **kwargs: Additional keyword arguments that may be needed by specific implementations.

        Returns:
            Iterable[T]: Post-processed output as an iterable of type T.
        """
        raise NotImplementedError("Subclasses must implement this method")

    def __init__(self) -> None:
        self.model: ort.InferenceSession | None = None
        self.tokenizer: Tokenizer | None = None

    def _preprocess_onnx_input(
        self, onnx_input: dict[str, NumpyArray], **kwargs: Any
    ) -> dict[str, NumpyArray]:
        """
        Preprocess the onnx input.
        """
        return onnx_input

    def _load_onnx_model(
        self,
        model_dir: Path,
        model_file: str,
        threads: int | None,
        providers: Sequence[OnnxProvider] | None = None,
        cuda: bool | Device = Device.AUTO,
        device_id: int | None = None,
        extra_session_options: dict[str, Any] | None = None,
    ) -> None:
        model_path = model_dir / model_file
        # List of Execution Providers: https://onnxruntime.ai/docs/execution-providers
        available_providers = ort.get_available_providers()
        cuda_available = "CUDAExecutionProvider" in available_providers
        explicit_cuda = cuda is True or cuda == Device.CUDA

        if explicit_cuda and providers is not None:
            warnings.warn(
                f"`cuda` and `providers` are mutually exclusive parameters, "
                f"cuda: {cuda}, providers: {providers}. If you'd like to use providers, cuda should be one of "
                f"[False, Device.CPU, Device.AUTO].",
                category=UserWarning,
                stacklevel=6,
            )

        if providers is not None:
            onnx_providers = list(providers)
        elif explicit_cuda or (cuda == Device.AUTO and cuda_available):
            if device_id is None:
                onnx_providers = ["CUDAExecutionProvider"]
            else:
                onnx_providers = [("CUDAExecutionProvider", {"device_id": device_id})]
        else:
            onnx_providers = ["CPUExecutionProvider"]

        requested_provider_names: list[str] = []
        for provider in onnx_providers:
            # check providers available
            provider_name = provider if isinstance(provider, str) else provider[0]
            requested_provider_names.append(provider_name)
            if provider_name not in available_providers:
                raise ValueError(
                    f"Provider {provider_name} is not available. Available providers: {available_providers}"
                )

        so = ort.SessionOptions()
        so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        if threads is not None:
            so.intra_op_num_threads = threads
            so.inter_op_num_threads = threads

        if extra_session_options is not None:
            self.add_extra_session_options(so, extra_session_options)

        self.model = ort.InferenceSession(
            str(model_path), providers=onnx_providers, sess_options=so
        )
        if "CUDAExecutionProvider" in requested_provider_names:
            assert self.model is not None
            current_providers = self.model.get_providers()
            if "CUDAExecutionProvider" not in current_providers:
                warnings.warn(
                    f"Attempt to set CUDAExecutionProvider failed. Current providers: {current_providers}."
                    "If you are using CUDA 12.x, install onnxruntime-gpu via "
                    "`pip install onnxruntime-gpu --extra-index-url https://aiinfra.pkgs.visualstudio.com/PublicPackages/_packaging/onnxruntime-cuda-12/pypi/simple/`",
                    RuntimeWarning,
                )

    @classmethod
    def _select_exposed_session_options(cls, model_kwargs: dict[str, Any]) -> dict[str, Any]:
        """A convenience method to select the exposed session options in models

        Args:
            model_kwargs (dict[str, Any]): The model kwargs.

        Returns:
            dict[str, Any]: a dict with filtered exposed session options.
        """
        return {k: v for k, v in model_kwargs.items() if k in cls.EXPOSED_SESSION_OPTIONS}

    @classmethod
    def add_extra_session_options(
        cls, session_options: ort.SessionOptions, extra_options: dict[str, Any]
    ) -> None:
        """Add extra session options to the existing options object in-place

        Args:
            session_options (ort.SessionOptions): The existing session options object.
            extra_options (dict[str, Any]): The extra session options available in cls.EXPOSED_SESSION_OPTIONS.

        Returns:
            None
        """
        for option in extra_options:
            assert (
                option in cls.EXPOSED_SESSION_OPTIONS
            ), f"{option} is unknown or not exposed (exposed options: {cls.EXPOSED_SESSION_OPTIONS})"
        if "enable_cpu_mem_arena" in extra_options:
            session_options.enable_cpu_mem_arena = extra_options["enable_cpu_mem_arena"]

    def load_onnx_model(self) -> None:
        raise NotImplementedError("Subclasses must implement this method")

    def onnx_embed(self, *args: Any, **kwargs: Any) -> OnnxOutputContext:
        raise NotImplementedError("Subclasses must implement this method")


class EmbeddingWorker(Worker, Generic[T]):
    def init_embedding(
        self,
        model_name: str,
        cache_dir: str,
        **kwargs: Any,
    ) -> OnnxModel[T]:
        raise NotImplementedError()

    def __init__(
        self,
        model_name: str,
        cache_dir: str,
        **kwargs: Any,
    ):
        self.model = self.init_embedding(model_name, cache_dir, **kwargs)

    @classmethod
    def start(cls, model_name: str, cache_dir: str, **kwargs: Any) -> "EmbeddingWorker[T]":
        return cls(model_name=model_name, cache_dir=cache_dir, **kwargs)

    def process(self, items: Iterable[tuple[int, Any]]) -> Iterable[tuple[int, Any]]:
        raise NotImplementedError("Subclasses must implement this method")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #565** (2026-07-26): **qdrant-client: `set_model` attempts network connection despite `HF_HUB_OFFLINE=1` and local cache**
  *Symptoms*:  ---  ### **Title: qdrant-client: `set_model` attempts network connection despite `HF_HUB_OFFLINE=1` and local cache**  ## Current Behavior When the `HF_HUB_OFFLINE=1` environment variable is set, `QdrantClient.set_model()` still attempts to download the embedding model from Hugging Face. This fails in an offline environment, **even when the model is already present in the local cache**, preventing the client from initializing.  The logs paradoxically show `fastembed` reporting "offline mode is enabled" as the reason for a network connection failure, indicating that while the flag is recognized, the connection attempt is not being properly suppressed.  ## Steps to Reproduce 1.  Set up an environment with no internet access (e.g., a firewalled server or a Docker container).  2.  Set the environment variable: `export HF_HUB_OFFLINE=1`.  3.  Pre-download the embedding model into the specified cache directory (`/app/.cache/fastembed`).  4.  Confirm the model files are present in the cache. The directory structure and size should be verified:     ```bash     $ du -h -d 3 /app/.cache/fastembed/models--qdrant--paraphrase-multilingual-MiniLM-L12-v2-onnx-Q/          241M    /app/.cache/fastembed/models--qdrant--paraphrase-multilingual-MiniLM-L12-v2-onnx-Q/blobs     4.0K    /app/.cache/fastembed/models--qdrant--paraphrase-multilingual-MiniLM-L12-v2-onnx-Q/refs     20K     /app/.cache/fastembed/models--qdrant--paraphrase-multilingual-MiniLM-L12-v2-onnx-Q/snapshots/faf4aa4225822f3bc63768
  **Post-Mortem & Fix Analysis**:
  > I believe this is related to `fastembed`, so I'll move this issue there. Let me know if you think that is not correct.
  > #575 
  > Hey @koolay   Sorry for the late response, this should be fixed now. Two changes landed since the report: we try to load the model from cache before making any network calls at all (#577, available as of 0.7.4), and `HF_HUB_OFFLINE` is now respected and treated like `local_files_only=True` (#614, available as of 0.8.0).  Closing this as completed

- **Issue #410** (2024-12-30): **[Bug]: Shape Mismatch During Expand Operation in ColBERT ONNX Model**
  *Symptoms*: ### What happened?  I encountered a shape mismatch error when using ColBERT’s ONNX model to generate embeddings for a batch of text chunks. While most batches work fine, some cause the following error: `[E:onnxruntime:, sequential_executor.cc:516 ExecuteKernel] Non-zero status code returned while running Expand node. Name:'/bert/Expand' Status Message: /bert/Expand: left operand cannot broadcast on dim 1 LeftShape: {1,512}, RightShape: {18,513} `  In this case:  - 18 is the batch size passed to the model. - 512 and 513 refer to the token sequence lengths of the tensors being processed. - The issue appears to be related to the tokenization and batching process inside the model, as the input to the ONNX model is plain text, and tokenization happens internally.  ### What is the expected behaviour?  model should generate embeddings for the provided text.   ### A minimal reproducible example  _No response_  ### What Python version are you on? e.g. python --version  Python 3.10.15  ### FastEmbed version  FastEmbed 0.3.6  ### What os are you seeing the problem on?  Linux  ### Relevant stack traces and/or logs  ```shell 2024-11-21 10:10:48.454 | INFO     | app:embed_documents:61 - Received request to embed documents with 18 texts using model 'colbert' 2024-11-21 10:10:48.455 | INFO     | app:get_or_initialize_model:38 - Using cached model: colbert 2024-11-21 10:10:48.481 | ERROR    | app:embed_documents:71 - Error embedding documents: [ONNXRuntimeError] : 1 : FAIL : Non-zer
  **Post-Mortem & Fix Analysis**:
  > same error here also when trying to use AnswerdotAI  with vepsa.onnx  InvalidArgument: [ONNXRuntimeError] : 2 : INVALID_ARGUMENT : Non-zero status code returned while running Expand node. Name:'/bert/Expand' Status Message: invalid expand shape but with Jinaai/Colbertv2 it worked fine
  > Hey, Facing an issue while running the code snippet from the notebook qdrant/workshop-ultimate-hybrid-search, for batches having elements with large documents I get this error: ``` InvalidArgument: [ONNXRuntimeError] : 2 : INVALID_ARGUMENT : Non-zero status code returned while running Expand node. Name:'/bert/Expand' Status Message: invalid expand shape ```
  > same here , InvalidArgument: [ONNXRuntimeError] : 2 : INVALID_ARGUMENT : Non-zero status code returned while running Expand node. Name:'/bert/Expand' Status Message: invalid expand shape.   looks like it is expecting chunk sizes to be smaller??   However - good news is It works with jinaai/jina-colbert-v2 embedding model without any issues. 

- **Issue #407** (2024-12-17): **Error occurs when using late interaction model.**
  *Symptoms*: Hello,  I don't know if this is the right palce to raise an issue but, I tried following the demo from qdrant/[workshop-ultimate-hybrid-search](https://github.com/qdrant/workshop-ultimate-hybrid-search) and encountered an error as follows(didn't make any changes to the code provided): ![image](https://github.com/user-attachments/assets/bcc04d92-b843-4fb8-9fcb-99449af36100)  Many Thanks, 
  **Post-Mortem & Fix Analysis**:
  > hey there,   I am also facing kind of similar issue. I am processing texts batch_wise my batch_size is 20, for many batches late-interaction model is working fine but some batches in middle it is giving this error. Any idea how to resolve this issue?  `Error embedding documents: [ONNXRuntimeError] : 1 : FAIL : Non-zero status code returned while running Expand node. Name:'/bert/Expand' Status Message: /bert/Expand: left operand cannot broadcast on dim 1 LeftShape: {1,512}, RightShape: {20,513}`
  > Hey, thanks for rising the issue, we'll look into it
  > Recent commit solved the error. Closing the issue.

- **Issue #319** (2024-08-14): **Fix to avoid overfloat and get rid of model_max_length**
  *Symptoms*: Got rid of max_length=512 and parameter Replaced it with maxsize to work with [such](https://huggingface.co/Snowflake/snowflake-arctic-embed-s/blob/main/tokenizer_config.json) situations. Checkout `model_max_length`

- **Issue #204** (2024-07-17): **incorrect nomic embeddings**
  *Symptoms*: I was comparing the nomic embeddings and they are very different from the original version. ```python import pandas as pd from more_itertools import chunked from typing import List import numpy as np import torch.nn.functional as F from sentence_transformers import SentenceTransformer import torch import os from tqdm.notebook import tqdm import json from fastembed import SparseTextEmbedding, TextEmbedding  assert torch.cuda.is_available() SEED = 25  model = SentenceTransformer("nomic-ai/nomic-embed-text-v1.5", trust_remote_code=True)  def embed(texts: List[str]):     embeddings = model.encode(["clustering: " + t for t in texts], convert_to_tensor=True)     embeddings = F.layer_norm(embeddings, normalized_shape=(embeddings.shape[1],))     embeddings = F.normalize(embeddings, p=2, dim=1)     return embeddings.cpu().numpy()       import types embedding_model = TextEmbedding(model_name="nomic-ai/nomic-embed-text-v1.5")  def embed_fast(texts: List[str]):     embeddings = embedding_model.embed(["clustering: " + t for t in texts])     # Force computation if embed_func returns a generator     if isinstance(embeddings, types.GeneratorType):         embeddings = np.array(list(embeddings))     return embeddings ```  ```pycon res1 = embed(data) res1 array([[ 0.0478127 ,  0.07791077, -0.16337295, ..., -0.09588917,         -0.01815554, -0.0391101 ],        [ 0.00486873,  0.05552602, -0.17271836, ..., -0.06137123,         -0.01570066,  0.00191791],
  **Post-Mortem & Fix Analysis**:
  > Ohh, we missed this completely in our tests — I'll look into this. Thanks a ton for reporting this!
  > Same for nomic embed v1. Any planned resolution on this?
  > Hey @k4u5h1k, sorry for the late response, yes, we're working on it, we'll fix it soon

- **Issue #174** (2024-06-06): **Bug: Data downloading does not work in Binary Quantization from Scratch notebook**
  *Symptoms*: ### What happened?  It seems like the link format used in data downloading is not valid anymore.    ```bash git clone https://github.com/qdrant/fastembed.git python3 -m venv venv && source venv/bin/activate && pip3 install -U pip poetry && poetry install --with dev jupyter-notebook ```  Then open [Binary Quantization from Scratch.ipynb](https://github.com/qdrant/fastembed/blob/main/docs/experimental/Binary%20Quantization%20from%20Scratch.ipynb) try to run cells sequentially:  <img width="1156" alt="image" src="https://github.com/qdrant/fastembed/assets/22641570/f27197a3-5778-4b74-8896-e1dfa32be5a7">     ### Version  0.2.4 (Latest)  ### What os are you seeing the problem on?  _No response_  ### Relevant stack traces and/or logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > @NirantK could you please look into it?
  > Ouch, thanks for spotting this — I'll raise a PR this week for this

- **Issue #170** (2024-04-01): **_get_worker_class is not implemented in SpladePP**
  *Symptoms*: ### What happened?  `_get_worker_class` method was not implemented in SpladePP, thus setting `parallel` in `embed` was leading to errors  ### Version  0.2.4 (Latest)  ### What os are you seeing the problem on?  _No response_  ### Relevant stack traces and/or logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > Closing this since it's fixed! Thanks for this @joein — I'd missed this completely!

- **Issue #159** (2024-03-22): **[Bug/Model Request]: Model names does not seem case-insensitive**
  *Symptoms*: ### What happened?  (Version is 0.2.5 but I could not select this value)  ```python from fastembed.sparse.sparse_text_embedding import SparseTextEmbedding  # this works fastembed_sparse_embedder=SparseTextEmbedding(model_name="prithvida/Splade_PP_en_v1")  # this raises an error fastembed_sparse_embedder=SparseTextEmbedding(model_name="prithvida/splade_pp_en_v1") ```  ### Version  0.2.4 (Latest)  ### What os are you seeing the problem on?  Linux  ### Relevant stack traces and/or logs  ```shell --------------------------------------------------------------------------- ValueError                                Traceback (most recent call last) <ipython-input-7-7e0184b3ecdf> in <cell line: 3>()       1 from fastembed.sparse.sparse_text_embedding import SparseTextEmbedding       2  ----> 3 fastembed_sparse_embedder=SparseTextEmbedding(model_name="prithvida/splade_pp_en_v1")  2 frames /usr/local/lib/python3.10/dist-packages/fastembed/sparse/sparse_text_embedding.py in __init__(self, model_name, cache_dir, threads, **kwargs)      50             supported_models = EMBEDDING_MODEL_TYPE.list_supported_models()      51             if any(model_name.lower() == model["model"].lower() for model in supported_models): ---> 52                 self.model = EMBEDDING_MODEL_TYPE(model_name, cache_dir, threads, **kwargs)      53                 return      54   /usr/local/lib/python3.10/dist-packages/fastembed/sparse/splade_pp.py in __init__(self, model_name, cache_dir, 
  **Post-Mortem & Fix Analysis**:
  > @Anush008 can you take this up? 

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

### Incident Patch 1: `e0447a2e` (2026-09-29)
**Commit Message**: fix: preserve center crop size with odd padding (#746)

* fix: preserve center crop size with odd padding

* tests: refactor tests, leave just one

---------

Co-authored-by: George <justmist15@gmail.com>

**File**: `fastembed/image/transform/functional.py` (modified, +3/-2)
```diff
@@ -42,9 +42,10 @@ def center_crop(
     new_shape = image.shape[:-2] + (new_height, new_width)
     new_image = np.zeros_like(image, shape=new_shape, dtype=np.float32)
 
-    top_pad = (new_height - orig_height) // 2
+    # Round padding up to offset the floor-rounded crop origin when the difference is odd.
+    top_pad = (new_height - orig_height + 1) // 2
     bottom_pad = top_pad + orig_height
-    left_pad = (new_width - orig_width) // 2
+    left_pad = (new_width - orig_width + 1) // 2
     right_pad = left_pad + orig_width
     new_image[..., top_pad:bottom_pad, left_pad:right_pad] = image
 
```

**File**: `tests/test_image_transform.py` (modified, +21/-0)
```diff
@@ -3,6 +3,27 @@
 from PIL import Image
 
 from fastembed.image.transform.functional import normalize, resize
+from fastembed.image.transform.operators import Compose
+
+
+def test_center_crop_odd_padding_keeps_batch_shape_and_pixels() -> None:
+    pixels = np.arange(1, 28, dtype=np.uint8).reshape(3, 3, 3)
+    processor = Compose.from_config(
+        {
+            "do_resize": False,
+            "do_center_crop": True,
+            "crop_size": 4,
+            "do_rescale": False,
+        }
+    )
+    images = [Image.fromarray(pixels), Image.new("RGB", (4, 4))]
+
+    batch = np.array(processor(images))
+    expected = np.zeros((3, 4, 4), dtype=np.float32)
+    expected[:, 1:, 1:] = pixels.transpose(2, 0, 1)
+
+    assert batch.shape == (2, 3, 4, 4)
+    np.testing.assert_array_equal(batch[0], expected)
 
 
 @pytest.mark.parametrize(
```

---

### Incident Patch 2: `aa4c8ea6` (2026-09-28)
**Commit Message**: fix: fix description limits (#741)

**File**: `fastembed/rerank/cross_encoder/onnx_text_cross_encoder.py` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@
     ),
     BaseModelDescription(
         model="jinaai/jina-reranker-v2-base-multilingual",
-        description="A multi-lingual reranker model for cross-encoder re-ranking with 1K context length and sliding window",
+        description="A multi-lingual reranker model for cross-encoder re-ranking with 1K context length",
         license="cc-by-nc-4.0",
         size_in_GB=1.11,
         sources=ModelSource(hf="jinaai/jina-reranker-v2-base-multilingual"),
```

**File**: `fastembed/text/multitask_embedding.py` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@
         },
         description=(
             "Multi-task unimodal (text) embedding model, multi-lingual (~100), "
-            "1024 tokens truncation, and 8192 sequence length. Prefixes for queries/documents: not necessary, 2024 year."
+            "8192 input tokens truncation. Prefixes for queries/documents: not necessary, 2024 year."
         ),
         license="cc-by-nc-4.0",
         size_in_GB=2.29,
```

**File**: `fastembed/text/pooled_embedding.py` (modified, +2/-2)
```diff
@@ -50,7 +50,7 @@
         model="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
         dim=384,
         description=(
-            "Text embeddings, Unimodal (text), Multilingual (~50 languages), 512 input tokens truncation, "
+            "Text embeddings, Unimodal (text), Multilingual (~50 languages), 128 input tokens truncation, "
             "Prefixes for queries/documents: not necessary, 2019 year."
         ),
         license="apache-2.0",
@@ -62,7 +62,7 @@
         model="sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
         dim=768,
         description=(
-            "Text embeddings, Unimodal (text), Multilingual (~50 languages), 384 input tokens truncation, "
+            "Text embeddings, Unimodal (text), Multilingual (~50 languages), 512 input tokens truncation, "
             "Prefixes for queries/documents: not necessary, 2021 year."
         ),
         license="apache-2.0",
```

---

### Incident Patch 3: `21680f4a` (2026-09-26)
**Commit Message**: fix: enable type checkers in PR CI (#736)

**File**: `.github/workflows/type-checkers.yml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 name: type-checkers
 
-on: [push]
+on: [push, pull_request]
 
 jobs:
   build:
```

---

### Incident Patch 4: `1647dc81` (2026-09-26)
**Commit Message**: fix: fix mypy (#735)

**File**: `fastembed/sparse/bm25.py` (modified, +2/-0)
```diff
@@ -162,13 +162,15 @@ def __init__(
         self.punctuation = set(get_all_punctuation())
         self.disable_stemmer = disable_stemmer
 
+        self.stopwords: set[str]
         if self._custom_stopwords is not None:
             self.stopwords = self._custom_stopwords
         elif disable_stemmer:
             self.stopwords = set()
         else:
             self.stopwords = set(self._load_stopwords(self._model_dir, self.language))
 
+        self.stemmer: Stemmer | None
         if stemmer is not None:
             self.stemmer = stemmer
         elif disable_stemmer:
```

---

### Incident Patch 5: `44d0c4ef` (2026-09-26)
**Commit Message**: Fix MUVERA encoding for empty documents (#733)

* Fix MUVERA encoding for empty documents

* Test MUVERA empty multivector encodings

* fix: raise on empty vectors in muvera

* Test ValueError for empty MUVERA inputs

* replace getattr with explicit calls in tests

Updated error messages for empty inputs in tests.

* remove redundant fixture

* remove unused import

* pytest import is actually required

* fix exception match message

---------

Co-authored-by: George Panchuk <george.panchuk@qdrant.tech>

**File**: `fastembed/postprocess/muvera.py` (modified, +10/-0)
```diff
@@ -228,6 +228,9 @@ def process_document(self, vectors: NumpyArray) -> NumpyArray:
 
         Returns:
             NumpyArray: Fixed dimensional encodings of shape (r_reps * b * dim_proj,)
+
+        Raises:
+            ValueError: If the document multivector is empty
         """
         return self.process(vectors, fill_empty_clusters=True, normalize_by_count=True)
 
@@ -243,6 +246,9 @@ def process_query(self, vectors: NumpyArray) -> NumpyArray:
 
         Returns:
             NumpyArray: Fixed dimensional encoding of shape (r_reps * b * dim_proj,)
+
+        Raises:
+            ValueError: If the query multivector is empty
         """
         return self.process(vectors, fill_empty_clusters=False, normalize_by_count=False)
 
@@ -278,11 +284,15 @@ def process(
 
         Raises:
             AssertionError: If input vectors don't have expected dimensionality
+            ValueError: If the input multivector is empty
         """
         assert (
             vectors.shape[1] == self.dim
         ), f"Expected vectors of shape (n, {self.dim}), got {vectors.shape}"
 
+        if len(vectors) == 0:
+            raise ValueError("Cannot encode an empty multivector")
+
         # Store results from each random projection
         output_vectors = []
 
```

**File**: `tests/test_postprocess.py` (modified, +13/-0)
```diff
@@ -1,4 +1,5 @@
 import numpy as np
+import pytest
 
 from fastembed import LateInteractionTextEmbedding
 from fastembed.postprocess import Muvera
@@ -36,3 +37,15 @@ def test_single_input():
         fde_query = muvera.process_query(multivector)
         assert fde_query.shape[0] == muvera.embedding_size
         assert np.allclose(fde_query[np.nonzero(fde_query)][:3], CANONICAL_QUERY_VALUES)
+
+
+def test_empty_multivectors_raise_value_error():
+    muvera = Muvera(dim=4, k_sim=2, dim_proj=2, r_reps=3)
+    empty = np.empty((0, 4))
+
+    with pytest.raises(ValueError, match="Cannot encode an empty multivector"):
+        muvera.process_document(empty)
+
+    with pytest.raises(ValueError, match="Cannot encode an empty multivector"):
+        muvera.process_query(empty)
+
```

---

### Incident Patch 6: `43531ea3` (2026-09-26)
**Commit Message**: fix: improve parallel processes cleanup (#734)

* fix: improve parallel processes cleanup

* fix: fix mypy

**File**: `fastembed/parallel_processor.py` (modified, +8/-4)
```diff
@@ -215,10 +215,14 @@ def semi_ordered_map(
                 # join would wait forever for processes blocked on the input queue.
                 self.emergency_shutdown = True
                 self.join_or_terminate()
-                # Nothing reads the input pipe anymore, so the feeder thread can be stuck writing to it,
-                # holding every batch it hasn't sent. Closing our read end fails that write with EPIPE and
-                # lets the thread exit, same as Queue._terminate_broken() in python 3.12+.
-                self.input_queue._reader.close()  # type: ignore[attr-defined]
+                # Nothing reads the input pipe anymore, so the feeder thread can be stuck
+                # writing to it, holding every item it hasn't sent. On POSIX, closing our
+                # read end fails that write with EPIPE; Windows also needs to cancel the send.
+                terminate_broken = getattr(self.input_queue, "_terminate_broken", None)
+                if terminate_broken is not None:
+                    terminate_broken()
+                else:
+                    self.input_queue._reader.close()  # type: ignore[attr-defined]
             self.input_queue.close()
             self.output_queue.close()
             if self.emergency_shutdown:
```

---

### Incident Patch 7: `e572d004` (2026-09-26)
**Commit Message**: fix: terminate interrupted parallel workers (#670)

* fix: terminate interrupted parallel workers

* fix: reap terminated parallel workers

* test: cover worker cleanup after pool reuse

* fix: bound parallel worker shutdown and free unsent input batches

* fix: reset emergency shutdown on start

---------

Co-authored-by: FU-max-boop <214359569+FU-max-boop@users.noreply.github.com>
Co-authored-by: George Panchuk <george.panchuk@qdrant.tech>

**File**: `fastembed/parallel_processor.py` (modified, +27/-2)
```diff
@@ -1,5 +1,6 @@
 import logging
 import os
+import time
 from collections import defaultdict
 from copy import deepcopy
 from enum import Enum
@@ -111,7 +112,11 @@ def __init__(
         self.num_active_workers: BaseValue | None = None
 
     def start(self, **kwargs: Any) -> None:
+        self.emergency_shutdown = False
         self.input_queue = self.ctx.Queue(self.queue_size)
+        # An emergency shutdown unblocks the feeder thread with EPIPE (see semi_ordered_map), let it
+        # exit quietly instead of printing a traceback. ProcessPoolExecutor does the same.
+        self.input_queue._ignore_epipe = True  # type: ignore[attr-defined]
         self.output_queue = self.ctx.Queue(self.queue_size)
 
         ctx_value = self.ctx.Value("i", self.num_workers)
@@ -153,6 +158,7 @@ def ordered_map(self, stream: Iterable[Any], *args: Any, **kwargs: Any) -> Itera
     def semi_ordered_map(
         self, stream: Iterable[Any], *args: Any, **kwargs: Any
     ) -> Iterable[tuple[int, Any]]:
+        completed = False
         try:
             self.start(**kwargs)
 
@@ -196,10 +202,23 @@ def semi_ordered_map(
                     raise RuntimeError("Thread unexpectedly terminated")
                 yield out_item
                 read += 1
+            completed = True
         finally:
             assert self.input_queue is not None, "Input queue is None"
             assert self.output_queue is not None, "Output queue is None"
-            self.join()
+            if completed:
+                self.join()
+            else:
+                # The generator may be closed before the input stream is exhausted (for
+                # example, when a caller only consumes a prefix of the embeddings). In that
+                # case workers have not necessarily received their stop signals and a normal
+                # join would wait forever for processes blocked on the input queue.
+                self.emergency_shutdown = True
+                self.join_or_terminate()
+                # Nothing reads the input pipe anymore, so the feeder thread can be stuck writing to it,
+                # holding every batch it hasn't sent. Closing our read end fails that write with EPIPE and
+                # lets the thread exit, same as Queue._terminate_broken() in python 3.12+.
+                self.input_queue._reader.close()  # type: ignore[attr-defined]
             self.input_queue.close()
             self.output_queue.close()
             if self.emergency_shutdown:
@@ -227,10 +246,16 @@ def join_or_terminate(self, timeout: int = 1) -> None:
         @param timeout:
         @return:
         """
+        # One deadline for the whole pool: workers that can't finish (e.g. after an early close)
+        # would otherwise each use up the full timeout, one after another.
+        deadline = time.monotonic() + timeout
+        for process in self.processes:
+            process.join(timeout=max(0.0, deadline - time.monotonic()))
         for process in self.processes:
-            process.join(timeout=timeout)
             if process.is_alive():
                 process.terminate()
+        for process in self.processes:
+            process.join(timeout=timeout)
         self.processes.clear()
 
     def join(self) -> None:
```

**File**: `tests/test_parallel_processor.py` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+import threading
+from itertools import count
+from multiprocessing import get_all_start_methods
+
+import pytest
+
+from fastembed.parallel_processor import ParallelWorkerPool, Worker
+
+
+class EchoWorker(Worker):
+    @classmethod
+    def start(cls, **kwargs):
+        return cls()
+
+    def process(self, items):
+        yield from items
+
+
+# semi_ordered_map is closed by garbage collection, so an error in its cleanup is only reported as unraisable
+@pytest.mark.filterwarnings("error::pytest.PytestUnraisableExceptionWarning")
+def test_closing_partially_consumed_iterator_stops_workers():
+    start_method = "forkserver" if "forkserver" in get_all_start_methods() else "spawn"
+    pool = ParallelWorkerPool(2, EchoWorker, start_method=start_method)
+    # the stream never ends, so the workers never get their stop signals
+    results = pool.ordered_map(count())
+    assert next(results) == 0
+    workers = list(pool.processes)
+
+    # close() used to wait in join() forever, run it in a thread so a regression fails instead of
+    # hanging the test session
+    closer = threading.Thread(target=results.close, daemon=True)
+    closer.start()
+    closer.join(timeout=30)
+    try:
+        assert not closer.is_alive(), "closing the iterator hung"
+        assert not any(worker.is_alive() for worker in workers)
+    finally:
+        for worker in workers:
+            if worker.is_alive():
+                worker.kill()
```

---

### Incident Patch 8: `44741113` (2026-09-25)
**Commit Message**: fix: verify the cached model files and re-fetch a corrupt one (#642)

* fix: re-download model when cached files fail verification

An interrupted or externally truncated download can leave a corrupt
file in the Hugging Face cache. On the next load the offline-first
probe sees the file on disk and returns it, so the model fails with
INVALID_PROTOBUF and the only fix is to delete the cache by hand.

This makes the cache self-heal. The probe now raises when a model
file's size does not match the recorded metadata, so download_model
falls through to an online retry with force_download=True
(huggingface_hub's cache check is existence-only and will not
re-fetch a present-but-truncated blob).

Verification also walks the repo tree recursively and matches files
by their repo-relative path. Without that, weights kept in a
subdirectory (onnx/model.onnx, more than half the models) were never
recorded in the metadata, so neither the new check nor the existing
one ever looked at them. A mismatch on an auxiliary config file is
still left to best-effort loading, as before.

* fix: merge force_download into kwargs on the recovery retry

If a caller passes force_download through kwargs, the explic

**File**: `fastembed/common/model_management.py` (modified, +88/-17)
```diff
@@ -51,6 +51,16 @@ def _hf_transport_errors() -> tuple[type[Exception], ...]:
 _HF_DOWNLOAD_ERRORS = (OSError, RepositoryNotFoundError, ValueError) + _hf_transport_errors()
 
 
+class CorruptedCacheError(ValueError):
+    """A cached model file is present but does not match the size recorded for it.
+
+    Distinct from the download failures above so that callers can tell "this snapshot is
+    unusable, look elsewhere" apart from "the hub could not be reached": only the former
+    is worth re-fetching a file the hub's existence-only cache check would otherwise keep.
+    Subclasses ValueError to stay inside _HF_DOWNLOAD_ERRORS for callers that don't care.
+    """
+
+
 class ModelManagement(Generic[T]):
     METADATA_FILE = "files_metadata.json"
 
@@ -215,6 +225,15 @@ def download_files_from_huggingface(
             Path: The path to the model directory.
         """
 
+        def _repo_relative_path(relative_path: Path) -> str:
+            # Cached files are stored under `snapshots/<revision>/<repo_path>`. Strip that
+            # prefix so the remainder matches a repo file's path, which may itself be nested
+            # (e.g. `onnx/model.onnx`).
+            parts = relative_path.parts
+            if len(parts) > 2 and parts[0] == "snapshots":
+                return "/".join(parts[2:])
+            return relative_path.as_posix()
+
         def _verify_files_from_metadata(
             model_dir: Path, stored_metadata: dict[str, Any], repo_files: list[RepoFile]
         ) -> bool:
@@ -226,7 +245,8 @@ def _verify_files_from_metadata(
                         return False
 
                     if repo_files:  # online verification
-                        file_info = next((f for f in repo_files if f.path == file_path.name), None)
+                        repo_path = _repo_relative_path(Path(rel_path))
+                        file_info = next((f for f in repo_files if f.path == repo_path), None)
                         if (
                             not file_info
                             or file_info.size != meta["size"]
@@ -249,9 +269,10 @@ def _collect_file_metadata(
             file_info_map = {f.path: f for f in repo_files}
             for file_path in model_dir.rglob("*"):
                 if file_path.is_file() and file_path.name != cls.METADATA_FILE:
-                    repo_file = file_info_map.get(file_path.name)
+                    relative_path = file_path.relative_to(model_dir)
+                    repo_file = file_info_map.get(_repo_relative_path(relative_path))
                     if repo_file:
-                        meta[str(file_path.relative_to(model_dir))] = {
+                        meta[str(relative_path)] = {
                             "size": repo_file.size,
                             "blob_id": repo_file.blob_id,
                         }
@@ -290,18 +311,46 @@ def _save_file_metadata(model_dir: Path, meta: dict[str, dict[str, int | str]])
             if legacy_source is not None:
                 sources.append(legacy_source)
 
+            # a corrupt candidate is remembered rather than raised on the spot: the next
+            # candidate may still be loadable, and if none is, this is the error worth
+            # reporting, since it is the only one download_model can act on.
+            corruption: CorruptedCacheError | None = None
+
             for index, source in enumerate(sources):
+                last_source = index == len(sources) - 1
                 snapshot_dir = Path(cache_dir) / repo_folder_name(
                     repo_id=source, repo_type="model"
                 )
                 metadata_file = snapshot_dir / cls.METADATA_FILE
                 if metadata_file.exists():
                     metadata = json.loads(metadata_file.read_text())
-                    verified = _verify_files_from_metadata(snapshot_dir, metadata, repo_files=[])
-                    if not verified:
-                        logger.warning(
-                            "Loca
```

**File**: `tests/test_model_management.py` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+"""Offline cache-verification tests for ModelManagement.
+
+The offline probe must distinguish a corrupt *model* file (which would make ONNX Runtime
+fail with a cryptic protobuf error) from a benign size drift on an auxiliary file. A corrupt
+model file must raise so ``download_model`` falls through to a forced re-download; an auxiliary
+mismatch must be tolerated so an offline caller is not bricked by best-effort-loadable drift.
+Model files may live in a subdirectory (e.g. ``onnx/model.onnx``), so matching is done on the
+repo-relative path, not the bare filename.
+"""
+
+import json
+from pathlib import Path
+from typing import Any
+
+import pytest
+
+from fastembed.common import model_management
+from fastembed.common.model_management import ModelManagement
+
+REVISION = "0123456789abcdef0123456789abcdef01234567"
+
+
+def _seed_cache(cache: Path, files: dict[str, bytes], metadata: dict[str, Any]) -> Path:
+    snapshot = cache / "models--qdrant--fake-onnx"
+    for name, blob in files.items():
+        path = snapshot / name
+        path.parent.mkdir(parents=True, exist_ok=True)
+        path.write_bytes(blob)
+    snapshot.mkdir(parents=True, exist_ok=True)
+    (snapshot / ModelManagement.METADATA_FILE).write_text(json.dumps(metadata))
+    return snapshot
+
+
+def test_offline_probe_raises_when_model_file_is_corrupt(tmp_path: Path) -> None:
+    cache = tmp_path / "cache"
+    _seed_cache(
+        cache,
+        files={"model.onnx": b"x" * 10},
+        metadata={"model.onnx": {"size": 999_999, "blob_id": "deadbeef"}},
+    )
+
+    with pytest.raises(ValueError, match="corrupt"):
+        ModelManagement.download_files_from_huggingface(
+            "qdrant/fake-onnx",
+            cache_dir=str(cache),
+            extra_patterns=["model.onnx"],
+            local_files_only=True,
+        )
+
+
+def test_offline_probe_raises_when_subdir_model_file_is_corrupt(tmp_path: Path) -> None:
+    cache = tmp_path / "cache"
+    key = f"snapshots/{REVISION}/onnx/model.onnx"
+    _seed_cache(
+        cache,
+        files={key: b"x" * 10},
+        metadata={key: {"size": 999_999, "blob_id": "deadbeef"}},
+    )
+
+    with pytest.raises(ValueError, match="corrupt"):
+        ModelManagement.download_files_from_huggingface(
+            "qdrant/fake-onnx",
+            cache_dir=str(cache),
+            extra_patterns=["onnx/model.onnx"],
+            local_files_only=True,
+        )
+
+
+def test_offline_probe_tolerates_auxiliary_file_drift(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    cache = tmp_path / "cache"
+    snapshot = _seed_cache(
+        cache,
+        files={"model.onnx": b"x" * 10, "config.json": b"y" * 20},
+        metadata={
+            "model.onnx": {"size": 10, "blob_id": "modelblob"},
+            "config.json": {"size": 999, "blob_id": "configblob"},
+        },
+    )
+
+    # The model file matches metadata; only config.json drifted. The probe must NOT raise:
+    # it falls through to snapshot_download (mocked here to return the cached path).
+    monkeypatch.setattr(model_management, "snapshot_download", lambda **kwargs: str(snapshot))
+
+    result = ModelManagement.download_files_from_huggingface(
+        "qdrant/fake-onnx",
+        cache_dir=str(cache),
+        extra_patterns=["model.onnx"],
+        local_files_only=True,
+    )
+    assert result == str(snapshot)
```

---

### Incident Patch 9: `7ca84e26` (2026-09-25)
**Commit Message**: fix: don't depend on the hub's case-normalizing redirect for model sources (#732)

* fix: don't depend on the hub's case-normalizing redirect for model sources

* fix: fall back to a differently cased cache entry when loading offline

**File**: `fastembed/common/model_management.py` (modified, +80/-18)
```diff
@@ -13,8 +13,10 @@
 
 import requests
 from huggingface_hub import constants, snapshot_download, model_info, list_repo_tree
+from huggingface_hub.file_download import repo_folder_name
 from huggingface_hub.hf_api import RepoFile
 from huggingface_hub.utils import (
+    HFValidationError,
     RepositoryNotFoundError,
     disable_progress_bars,
     enable_progress_bars,
@@ -157,6 +159,41 @@ def download_file_from_gcs(cls, url: str, output_path: str, show_progress: bool
                         file.write(chunk)
         return output_path
 
+    @classmethod
+    def _find_legacy_cased_source(cls, cache_dir: str, hf_source_repo: str) -> str | None:
+        """Looks for a cached snapshot of the same repo spelled with a different casing.
+
+        Built-in sources used to be lowercase and were canonicalized once it turned out that
+        relying on the hub's normalizing redirect breaks proxies. Both the hub and fastembed
+        derive the cache directory from the source verbatim, so on a case-sensitive filesystem
+        an offline load would otherwise miss a model an older version had already cached.
+
+        Args:
+            cache_dir (str): The path to the cache directory.
+            hf_source_repo (str): Name of the model on HuggingFace Hub.
+
+        Returns:
+            str | None: The differently cased source found in the cache, None if there is none.
+        """
+        separator = constants.REPO_ID_SEPARATOR
+        try:
+            expected = repo_folder_name(repo_id=hf_source_repo, repo_type="model")
+            entries = list(Path(cache_dir).iterdir())
+        except (HFValidationError, OSError):
+            return None
+
+        # the repo id sits at the tail of the folder name, with every "/" replaced
+        offset = len(expected) - len(hf_source_repo.replace("/", separator))
+
+        for entry in entries:
+            if entry.name == expected or entry.name.lower() != expected.lower():
+                continue
+            if not entry.is_dir():
+                continue
+            # the hub forbids the separator inside a repo id, so it only marks the split
+            return entry.name[offset:].replace(separator, "/")
+        return None
+
     @classmethod
     def download_files_from_huggingface(
         cls,
@@ -169,7 +206,7 @@ def download_files_from_huggingface(
         """
         Downloads a model from HuggingFace Hub.
         Args:
-            hf_source_repo (str): Name of the model on HuggingFace Hub, e.g. "qdrant/all-MiniLM-L6-v2-onnx".
+            hf_source_repo (str): Name of the model on HuggingFace Hub, e.g. "Qdrant/all-MiniLM-L6-v2-onnx".
             cache_dir (Optional[str]): The path to the cache directory.
             extra_patterns (list[str]): extra patterns to allow in the snapshot download, typically
                 includes the required model files.
@@ -238,26 +275,51 @@ def _save_file_metadata(model_dir: Path, meta: dict[str, dict[str, int | str]])
 
         allow_patterns.extend(extra_patterns)
 
-        snapshot_dir = Path(cache_dir) / f"models--{hf_source_repo.replace('/', '--')}"
+        snapshot_dir = Path(cache_dir) / repo_folder_name(
+            repo_id=hf_source_repo, repo_type="model"
+        )
         metadata_file = snapshot_dir / cls.METADATA_FILE
 
         if local_files_only:
             disable_progress_bars()
-            if metadata_file.exists():
-                metadata = json.loads(metadata_file.read_text())
-                verified = _verify_files_from_metadata(snapshot_dir, metadata, repo_files=[])
-                if not verified:
-                    logger.warning(
-                        "Local file sizes do not match the metadata."
-                    )  # do not raise, still make an attempt to load the model
-            result = snapshot_download(
-                repo_id=hf_source_repo,
-                allow_patterns=allow_patterns,
-                cache_dir=cache_dir,
-                local_files_only=
```

**File**: `fastembed/late_interaction/token_embeddings.py` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@
         " Prefixes for queries/documents: not necessary, 2023 year.",
         license="apache-2.0",
         size_in_GB=0.12,
-        sources=ModelSource(hf="xenova/jina-embeddings-v2-small-en"),
+        sources=ModelSource(hf="Xenova/jina-embeddings-v2-small-en"),
         model_file="onnx/model.onnx",
     ),
 ]
```

**File**: `fastembed/sparse/sparse_text_embedding.py` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ def list_supported_models(cls) -> list[dict[str, Any]]:
                         "license": "apache-2.0",
                         "size_in_GB": 0.532,
                         "sources": {
-                            "hf": "qdrant/SPLADE_PP_en_v1",
+                            "hf": "Qdrant/Splade_PP_en_v1",
                         },
                     }
                 ]
```

**File**: `fastembed/text/onnx_embedding.py` (modified, +5/-5)
```diff
@@ -47,7 +47,7 @@
         ),
         license="mit",
         size_in_GB=1.20,
-        sources=ModelSource(hf="qdrant/bge-large-en-v1.5-onnx"),
+        sources=ModelSource(hf="Qdrant/bge-large-en-v1.5-onnx"),
         model_file="model.onnx",
     ),
     DenseModelDescription(
@@ -113,7 +113,7 @@
         ),
         license="apache-2.0",
         size_in_GB=0.09,
-        sources=ModelSource(hf="snowflake/snowflake-arctic-embed-xs"),
+        sources=ModelSource(hf="Snowflake/snowflake-arctic-embed-xs"),
         model_file="onnx/model.onnx",
     ),
     DenseModelDescription(
@@ -125,7 +125,7 @@
         ),
         license="apache-2.0",
         size_in_GB=0.13,
-        sources=ModelSource(hf="snowflake/snowflake-arctic-embed-s"),
+        sources=ModelSource(hf="Snowflake/snowflake-arctic-embed-s"),
         model_file="onnx/model.onnx",
     ),
     DenseModelDescription(
@@ -149,7 +149,7 @@
         ),
         license="apache-2.0",
         size_in_GB=0.54,
-        sources=ModelSource(hf="snowflake/snowflake-arctic-embed-m-long"),
+        sources=ModelSource(hf="Snowflake/snowflake-arctic-embed-m-long"),
         model_file="onnx/model.onnx",
     ),
     DenseModelDescription(
@@ -161,7 +161,7 @@
         ),
         license="apache-2.0",
         size_in_GB=1.02,
-        sources=ModelSource(hf="snowflake/snowflake-arctic-embed-l"),
+        sources=ModelSource(hf="Snowflake/snowflake-arctic-embed-l"),
         model_file="onnx/model.onnx",
     ),
     DenseModelDescription(
```

**File**: `fastembed/text/pooled_embedding.py` (modified, +3/-3)
```diff
@@ -55,7 +55,7 @@
         ),
         license="apache-2.0",
         size_in_GB=0.22,
-        sources=ModelSource(hf="qdrant/paraphrase-multilingual-MiniLM-L12-v2-onnx-Q"),
+        sources=ModelSource(hf="Qdrant/paraphrase-multilingual-MiniLM-L12-v2-onnx-Q"),
         model_file="model_optimized.onnx",
     ),
     DenseModelDescription(
@@ -67,7 +67,7 @@
         ),
         license="apache-2.0",
         size_in_GB=1.00,
-        sources=ModelSource(hf="xenova/paraphrase-multilingual-mpnet-base-v2"),
+        sources=ModelSource(hf="Xenova/paraphrase-multilingual-mpnet-base-v2"),
         model_file="onnx/model.onnx",
     ),
     DenseModelDescription(
@@ -80,7 +80,7 @@
         license="mit",
         size_in_GB=2.24,
         sources=ModelSource(
-            hf="qdrant/multilingual-e5-large-onnx",
+            hf="Qdrant/multilingual-e5-large-onnx",
             _deprecated_tar_struct=True,
         ),
         model_file="model.onnx",
```

---

### Incident Patch 10: `d0b0478f` (2026-09-25)
**Commit Message**: fix: round Jina CLIP crop offsets to match Jina's reference (#731)

**File**: `fastembed/image/transform/functional.py` (modified, +4/-2)
```diff
@@ -144,14 +144,16 @@ def pad2square(
     left, right = 0, width
     top, bottom = 0, height
 
+    # Jina's reference crops with torchvision's CenterCrop, which rounds the offset half to
+    # even like round() instead of flooring it: a 227 px edge is cropped from 2, not 1
     crop_required = False
     if width > size:
-        left = (width - size) // 2
+        left = round((width - size) / 2)
         right = left + size
         crop_required = True
 
     if height > size:
-        top = (height - size) // 2
+        top = round((height - size) / 2)
         bottom = top + size
         crop_required = True
 
```

#### Recent Merged Pull Requests:
- **PR #751** (2026-09-29): new: add constella (@joein)
- **PR #750** (closed): fix: prepare sparse post-processing for lazy parallel embedding (@jipeng6036-del)
- **PR #748** (2026-09-29): new: add codeowners (@joein)
- **PR #746** (2026-09-29): fix: preserve center crop size with odd padding (@HuaTNA)
- **PR #743** (2026-09-28): new: add bge-reranker-v2-m3 (@joein)
- **PR #741** (2026-09-28): fix: fix description limits (@joein)
- **PR #740** (2026-09-26): ci: enable tests on push to main (@joein)
- **PR #739** (2026-09-26): ci: skip late multimodal tests on windows (@joein)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
