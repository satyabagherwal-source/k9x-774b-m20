# Forensic Learning Record (Deep Inspection): areal-project/AReaL

> **Canonical Artifact**: `07_PROJECT_LEARNING/areal-project-areal-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/areal-project/AReaL](https://github.com/areal-project/AReaL))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:22:22.685Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `areal-project/AReaL`
- **Description**: The RL Bridge for LLM-based Agent Applications. Made Simple & Flexible.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5812 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `areal/api/engine_api.py`
```
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

import abc
from collections.abc import Callable
from concurrent.futures import Future
from typing import TYPE_CHECKING, Any

import torch
import torch.distributed as dist
from torchdata.stateful_dataloader import StatefulDataLoader

from areal.api.alloc_mode import ParallelStrategy
from areal.api.cli_args import PerfTracerConfig
from areal.api.io_struct import (
    DeviceRuntimeInfo,
    LocalInfServerInfo,
    ModelRequest,
    ModelResponse,
    ParamSpec,
    SaveLoadMeta,
    WeightUpdateMeta,
)

if TYPE_CHECKING:
    from areal.api.workflow_api import WorkflowLike
    from areal.infra import WorkflowExecutor
    from areal.utils.data import MicroBatchList


class TrainEngine(abc.ABC):
    @abc.abstractmethod
    def create_process_group(self, parallel_strategy: ParallelStrategy | None = None):
        """Initialize PyTorch distributed communication groups.

        Parameters
        ----------
        parallel_strategy : ParallelStrategy, optional
            The parallel strategy configuration for distributed training, by default None
        """
        raise NotImplementedError()

    @abc.abstractmethod
    def initialize(self, *args, **kwargs):
        """Initialize environments for distributed training and load models.

        This method should be called after `create_process_group`.

        Parameters
        ----------
        *args
            Variable length argument list
        **kwargs
            Arbitrary keyword arguments
        """
        raise NotImplementedError()

    @property
    @abc.abstractmethod
    def data_parallel_group(self) -> dist.ProcessGroup:
        """Get the data parallel communication group of this engine.

        Returns
        -------
        dist.ProcessGroup
            The data parallel communication group
        """
        raise NotImplementedError()

    @property
    @abc.abstractmethod
    def data_parallel_rank(self) -> int:
        """Get the rank of the current process in the data parallel group.

        Returns
        -------
        int
            The rank of the current process in the data parallel group
        """
        raise NotImplementedError()

    @property
    @abc.abstractmethod
    def data_parallel_world_size(self) -> int:
        """Get the world size of the data parallel group.

        Returns
        -------
        int
            The world size of the data parallel group
        """
        raise NotImplementedError()

    @abc.abstractmethod
    def current_data_parallel_head(self) -> int:
        """Get the current data parallel head rank.

        Returns
        -------
        int
            The rank of the current data parallel head
        """
        raise NotImplementedError()

    @abc.abstractmethod
    def is_data_parallel_head(self) -> bool:
        """Check if the current rank is the data parallel head of the current engine.

        Returns
        -------
        bool
            True if the current rank is the data parallel head, False otherwise
        """
        raise NotImplementedError()

    @property
    @abc.abstractmethod
    def context_and_model_parallel_group(self) -> dist.ProcessGroup:
        """Get the context and model parallel communication group of this engine.

        Returns
        -------
        dist.ProcessGroup
            The context and model parallel communication group
        """
        raise NotImplementedError()

    @property
    @abc.abstractmethod
    def cpu_group(self) -> dist.ProcessGroup:
        """Get the CPU communication group of this engine.

        Returns
        -------
        dist.ProcessGroup
            The CPU communication group
        """
        raise NotImplementedError()

    def destroy(self):
        """Destroy the engine and release GPU memory of models."""

    @property
    @abc.abstractmethod
    def initialized(self) -> bool:
        """Check if the engine has been initialized.

        Returns
        -------
        bool
            True if initialize() has been called successfully, False otherwise
        """
        raise NotImplementedError()

    @abc.abstractmethod
    def train(self, mode: bool = True):
        """Set the engine to training mode.

        Parameters
        ----------
        mode : bool, optional
            Whether to set the engine to training mode, by default True
        """
        raise NotImplementedError()

    def eval(self):
        """Set the engine to evaluation mode.

        This is a convenience method that calls `self.train(False)`.
        """
        return self.train(False)

    @abc.abstractmethod
    def update_weights(self, meta: WeightUpdateMeta):
        """Update weights to the inference engine in a blocking manner.

        Parameters
        ----------
        meta : WeightUpdateMeta
            Metadata containing information about the weight update
        """
        raise NotImplementedError()

    @abc.abstractmethod
    def connect_engine(self, engine: InferenceEngine, meta: WeightUpdateMeta):
        """Connect to an inference engine for online training.

        Parameters
        ----------
        engine : InferenceEngine
            The inference engine to connect to
        """
        raise NotImplementedError()

    @abc.abstractmethod
    def rollout_batch(
        self,
        data: list[dict[str, Any]],
        workflow: WorkflowLike,
        workflow_kwargs: dict[str, Any] | None = None,
        group_size: int = 1,
        reward_normalization: bool = False,
        drop_incomplete_group: bool = False,
        min_usable_group_size: int = 1,
        reward_normalization_use_std: bool = True,
    ) -> list[dict[str, Any]]:
        """Submit a batch of requests and wait for results.

        This method does not support asynchronous rollout and should be used for offline
        data collection or debugging, not in production experiments.
        Should note that this is a simple rollout engine method forwarding with
        distributed data management.

        Parameters
        ----------
        data : list[dict[str, Any]]
            A list of input data dictionaries.
        workflow : WorkflowLike
            The workflow to use for rollout generation.
        workflow_kwargs : dict[str, Any] | None, optional
            Keyword arguments to pass to the workflow constructor, by default None.
        group_size : int, optional
            Number of times to run the workflow per input and concatenate results.
            Default is 1 (no grouping).
        min_usable_group_size : int, optional
            Estimator-owned minimum number of usable logical rollout slots. Must be
            between 1 and ``group_size``. Default is 1.

        Returns
        -------
        list[dict[str, Any]]
            A list of trajectory dictionaries, one per accepted rollout result.
            Each trajectory contains tensors whose leading dimension is the number
            of usable slots, between ``min_usable_group_size`` and ``group_size``.
        """
        raise NotImplementedError()

    @abc.abstractmethod
    def prepare_batch(
        self,
        dataloader: StatefulDataLoader,
        workflow: WorkflowLike,
        workflow_kwargs: dict[str, Any] | None = None,
        should_accept_fn: Callable[[dict[str, Any]], bool] | str | None = None,
        group_size: int = 1,
        dynamic_bs: bool = False,
        reward_normalization: bool = False,
        drop_incomplete_group: bool = False,
        min_usable_group_size: int = 1,
        reward_normalization_use_std: bool = True,
    ) -> list[dict[str, Any]]:
        """Prepare a batch of data for training from a dataloader.

        Parameters
        ----------
        dataloader : StatefulDataLoader
            The dataloader to fetch data from.
        workflow : WorkflowLike
            The workflow to use for rollout generation.
        workflow_kwargs : dict[str, Any] | None, optional
            Keyword arguments to pass to the workflow constructor, by default None.
        should_accept_fn : Callable[[dict[str, Any]], bool] | str | None, optional
            A function to filter trajectories, by default None.
        group_size : int, optional
            Number of times to run the workflow per input and concatenate results.
            Default is 1 (no grouping).
        dynamic_bs : bool, optional
            If True, enables dynamic batch sizing. The method will stop collecting
            when (accepted + rejected) >= batch_size, returning only accepted results.
            This results in variable-sized batches of valid data. Default is False.
        min_usable_group_size : int, optional
            Estimator-owned minimum number of usable logical rollout slots. Must be
            between 1 and ``group_size``. Default is 1.

        Returns
        -------
        dict[str, Any]
            The prepared batch data.
        """
        raise NotImplementedError()

    @abc.abstractmethod
    def set_version(self, version: int):
        """Set the current weight version in the training engine.

        Parameters
        ----------
        version : int
            The weight version number to set
        """
        raise NotImplementedError()

    @abc.abstractmethod
    def get_version(self) -> int:
        """Get the current weight version in the training engine.

        Returns
        -------
        int
            The current weight version number
        """
        raise NotImplementedError()

    @abc.abstractmethod
    def save(self, meta: SaveLoadMeta):
        """Save model weights and optimizer states for later use.

        Parameters
        ----------
        meta : SaveLoadMeta
            Metadata containing information about where and how to save
        """
        raise NotImplementedError()

    @abc.abstractmethod
    def load(self, meta: SaveLoadMeta):
        """Load model weights and optimize
```

### Core Architecture Module: `areal/engine/__init__.py`
```
# SPDX-License-Identifier: Apache-2.0

__all__ = [
    "FSDPEngine",
    "FSDPPPOActor",
    "FSDPPPOCritic",
    "FSDPLMEngine",
    "FSDPRWEngine",
    "FSDPDPOEngine",
    "MegatronEngine",
    "MegatronScoringEngine",
    "MegatronPPOActor",
    "MegatronPPOCritic",
    "MegatronLMEngine",
    "MegatronRWEngine",
    "MegatronDPOEngine",
    "RemoteSGLangEngine",
    "RemotevLLMEngine",
]

_LAZY_IMPORTS = {
    "FSDPEngine": "areal.engine.fsdp_engine",
    "FSDPPPOActor": "areal.engine.fsdp_engine",
    "FSDPPPOCritic": "areal.engine.fsdp_engine",
    "FSDPLMEngine": "areal.engine.fsdp_engine",
    "FSDPRWEngine": "areal.engine.fsdp_engine",
    "FSDPDPOEngine": "areal.engine.fsdp_engine",
    "MegatronEngine": "areal.engine.megatron_engine",
    "MegatronScoringEngine": "areal.engine.megatron_engine",
    "MegatronPPOActor": "areal.engine.megatron_engine",
    "MegatronPPOCritic": "areal.engine.megatron_engine",
    "MegatronLMEngine": "areal.engine.megatron_engine",
    "MegatronRWEngine": "areal.engine.megatron_engine",
    "MegatronDPOEngine": "areal.engine.megatron_engine",
    "RemoteSGLangEngine": "areal.engine.sglang_remote",
    "RemotevLLMEngine": "areal.engine.vllm_remote",
}


def __getattr__(name: str):
    if name in _LAZY_IMPORTS:
        import importlib

        module = importlib.import_module(_LAZY_IMPORTS[name])
        val = getattr(module, name)
        globals()[name] = val
        return val
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__():
    return list(__all__)

```

### Core Architecture Module: `areal/engine/awex/__init__.py`
```
# SPDX-License-Identifier: Apache-2.0

"""AWEX colocated weight-transfer integration (writer, reader, SGLang plugin)."""

```

### Core Architecture Module: `areal/engine/awex/colocate_reader.py`
```
# SPDX-License-Identifier: Apache-2.0

"""AWEX colocate weight reader (native awex worker-reader adapter).

Runs inside the SGLang scheduler process. This is a thin shell around awex's
native ``NCCLWorkerWeightsReader`` that:

1. Eager-registers the inference-side metadata the train writer waits for
   (``infer_conf`` + ``num_infer_engines``), computed via awex's own
   ``InferParamMetaResolver._get_model_param_info`` + ``_build_params_meta``
   (no hand-rolled name normalization or shard merging).
2. Lazily constructs the awex ``NCCLWorkerWeightsReader`` on the first weight
   update (it needs ``training_params_meta``, which only appears after the
   first training step) and delegates the whole IPC-collect + StreamBatch
   transport + writer handshake to it.

Why the awex-native reader instead of a hand-rolled receiver: the community
SGLang scheduler has no ``execute_task_in_model_worker`` driver layer, so we
build the awex *worker* reader directly in-process. The native worker reader
uses ``NcclColocateStreamBatchTransport`` (recursive partition), the transport
AWEX ships -- a hand-rolled ring-shift transport deadlocks on mismatched
train/infer pipeline layouts (e.g. train PP=4 vs infer PP=1).

The plugin shell still owns the steps awex's *driver* would normally do
(``_pre_update_weights`` wait-for-offload + resume weights, ``_resume_kvcache``
signal-finished); see ``awex_sglang_plugin.process_awex_queue``.
"""

from __future__ import annotations

from typing import Any

import torch

from areal.engine.awex.memory_saver import patch_tms_hook_mode
from areal.engine.awex.metadata import serialize_metadata_gc
from areal.engine.awex.parallel import resolve_scheduler_parallel_attr

# Must run before any awex import: awex.models.registry auto-imports model
# modules at module load, and the BailingMoe module's transitive megatron import
# trips the hook_mode race above.
patch_tms_hook_mode()

from awex.meta.infer_meta_resolver import InferParamMetaResolver  # noqa: E402
from awex.meta.meta_resolver import ParamMetaResolver  # noqa: E402
from awex.reader.nccl_reader import NCCLWorkerWeightsReader  # noqa: E402
from awex.sharding import get_sharding_strategy_builder  # noqa: E402
from awex.util.common import AttrDict, simple_hf_config  # noqa: E402

from areal.utils.logging import getLogger  # noqa: E402

logger = getLogger("AwexColocateReader")


class _DeviceBoundWeightsReader(NCCLWorkerWeightsReader):
    """Bind communication to the model's logical CUDA device, not a rank id."""

    def __init__(self, *args, model: torch.nn.Module, **kwargs):
        device = next(model.parameters()).device
        if device.type != "cuda" or device.index is None:
            raise RuntimeError("AWEX reader requires model weights resumed on CUDA")
        self._model_device = device
        super().__init__(*args, model=model, **kwargs)

    def _set_device(self) -> None:
        # TODO(agent): This adapter is CUDA-only; physical ids remain metadata
        # identities and must not be used as CUDA_VISIBLE_DEVICES indices.
        torch.cuda.set_device(self._model_device)
        self.barrier_device = self._model_device.index
        self.backend = "nccl"
        self.ready_tensor = torch.tensor(1, device=self._model_device)
        logger.info(
            "Bound AWEX reader rank %s to model device %s",
            self.transfer_rank,
            self._model_device,
        )


class _PhysicalDeviceMetaServerClient:
    """Use physical GPU ids in AWEX colocate metadata and handshake keys."""

    _DEVICE_KEY_PREFIXES = (
        "training_serialized_weights_",
        "weights_update_finished_",
        "write_finished_",
    )

    def __init__(self, client: Any, physical_gpu_id: int):
        self._client = client
        self._physical_gpu_id = physical_gpu_id

    def __getattr__(self, name: str) -> Any:
        return getattr(self._client, name)

    def _rewrite_device_key(self, key: str) -> str:
        if not key.startswith(self._DEVICE_KEY_PREFIXES):
            return key
        prefix_and_ip, step = key.rsplit("_", 1)
        prefix_and_ip, _logical_gpu_id = prefix_and_ip.rsplit("_", 1)
        return f"{prefix_and_ip}_{self._physical_gpu_id}_{step}"

    def add_object_to_set(self, key: str, value: Any) -> Any:
        if key == "inference_device_rank_entries":
            ip_address, _logical_gpu_id, transfer_rank = value
            value = (ip_address, self._physical_gpu_id, transfer_rank)
        return self._client.add_object_to_set(key, value)

    def get_object(self, key: str, *args: Any, **kwargs: Any) -> Any:
        return self._client.get_object(self._rewrite_device_key(key), *args, **kwargs)

    def put_object(self, key: str, *args: Any, **kwargs: Any) -> Any:
        return self._client.put_object(self._rewrite_device_key(key), *args, **kwargs)

    def get_object_then_delete(self, key: str, *args: Any, **kwargs: Any) -> Any:
        return self._client.get_object_then_delete(
            self._rewrite_device_key(key), *args, **kwargs
        )


def _to_awex_attr_dict(value: Any) -> Any:
    """Restore recursive attribute access missing from AWEX 0.8.1 configs."""
    if isinstance(value, dict):
        return AttrDict({key: _to_awex_attr_dict(item) for key, item in value.items()})
    if isinstance(value, list):
        return [_to_awex_attr_dict(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_to_awex_attr_dict(item) for item in value)
    return value


def _get_router_dtype(config):
    """Read router dtype from a flat or multimodal Hugging Face config."""
    router_dtype = getattr(config, "router_dtype", None)
    if router_dtype is not None:
        return router_dtype
    text_config = getattr(config, "text_config", config)
    return getattr(text_config, "router_dtype", "bf16")


def _get_awex_infer_hf_config(model, model_runner=None):
    """Serialize the complete runtime config for AWEX metadata exchange."""
    # SGLang keeps only ``text_config`` on Qwen3-VL-MoE's runtime model while
    # retaining the original composite config on ``ModelRunner.model_config``.
    # Prefer that original config so AWEX also receives ``vision_config``.
    model_config = getattr(model_runner, "model_config", None)
    config = getattr(model_config, "hf_config", None)
    if config is None:
        config = model.config
    serialized_config = _to_awex_attr_dict(simple_hf_config(config))
    if not getattr(serialized_config, "architectures", None):
        serialized_config.architectures = [type(model).__name__]
    return serialized_config


def _ensure_awex_models_registered() -> None:
    """Rebuild awex's model registry in case it cached a failed auto-import.

    ``import_model_configs`` is ``lru_cache``-d and ``ModelRegistry`` is built
    once at module load. If anything imported the registry before our hook_mode
    patch took effect, a native converter could be silently missing. Clear the
    cache and rebuild now that the patch is in place.

    The explicit architecture list is diagnostic only: AWEX remains the source
    of truth for model registration, transfer plans, conversion, and sharding.
    In particular, Qwen3.5 Dense and MoE reuse AWEX's native implementations
    for both causal-language-model and multimodal conditional-generation
    runtimes. Keeping those architecture names here makes an unavailable or
    failed AWEX model import visible before the first colocated weight update,
    without duplicating any model-specific transfer logic in AReaL.
    """
    try:
        from awex.models import registry as _reg

        _reg.import_model_configs.cache_clear()
        _reg.ModelRegistry.models = _reg.import_model_configs()
        missing = [
            m
            for m in (
                "BailingMoeV2_5ForCausalLM",
                "BailingMoeV2ForCausalLM",
                "Qwen3VLForConditionalGeneration",
                "Qwen3VLMoeForConditionalGeneration",
                "Qwen3_5ForCausalLM",
                "Qwen3_5MoeForCausalLM",
                "Qwen3_5ForConditionalGeneration",
                "Qwen3_5MoeForConditionalGeneration",
            )
            if m not in _reg.ModelRegistry.models
        ]
        if missing:
            logger.warning(f"awex model registry still missing converters: {missing}")
    except Exception as e:  # pragma: no cover - diagnostics only
        logger.warning(f"Failed to rebuild awex model registry: {e}")


_ensure_awex_models_registered()


class _SingleInstanceMetaResolver(ParamMetaResolver):
    """Aggregate per-rank raw meta of ONE inference instance into ParameterMeta.

    awex's ``InferParamMetaResolver`` normally drives this via
    ``execute_task_in_model_worker`` (a driver fan-out we do not have). We
    instead exchange the per-rank raw meta dicts through the MetaServer
    (see ``_build_instance_params_meta``) and reuse awex's ``_build_params_meta``
    for the aggregation, plus awex's own sharding strategy builder for
    ``_get_sharding_info``. This yields the exact same ``parameters_meta`` the
    native reader expects, with awex converter parameter names (no hand-rolled
    normalization).
    """

    def __init__(self, hf_config, engine_name, infer_engine_config, raw_meta_list):
        super().__init__(hf_config)
        self._raw_meta_list = raw_meta_list
        rank0 = self._select_rank0(raw_meta_list)
        self._model_arch_name = rank0["model_arch_name"]
        self._sharding_strategy = get_sharding_strategy_builder(engine_name)(
            self._model_arch_name,
            infer_engine_config,
            rank0["rank_info"],
        )

    @staticmethod
    def _select_rank0(raw_meta_list):
        for info in raw_meta_list:
            if info["rank_info"].global_rank == 0:
                return info
        return raw_meta_list[0]

    def get_model_arch_name(self) -> str:
        return self._model_arch_name

    @serialize_metadata_gc
    def get_parameters_meta
```

### Core Architecture Module: `areal/engine/awex/colocate_writer.py`
```
# SPDX-License-Identifier: Apache-2.0

# Licensed under the Apache License, Version 2.0
"""AWEX colocate adapter for MegatronEngine (training side).

Provides:
- Manual GPU→CPU offload for model weights and optimizer states
- CUDA IPC weight transfer to colocated SGLang (same GPU, via MetaServer)
- Coordinates with SGLang inference via MetaServer signals

Weight transfer flow (mirrors the AWEX reference nccl_writer colocate mode):
  1. Convert Megatron params → HF format
  2. Group tensors by shape/dtype → share_memory_() → cuda_ipc_serialize
  3. Put serialized IPC handles to MetaServer
  4. Infer side (same GPU) deserializes via CUDA IPC (zero-copy)
  5. Infer-only NCCL group handles redistribution among infer ranks
  6. Infer signals done → train cleans up shared tensors

This adapter is used when weight_update_type == "awex" in colocate mode.
"""

from __future__ import annotations

import gc
import os
from typing import TYPE_CHECKING

import torch
import torch.distributed as dist

from areal.engine.megatron_utils.weight_residency import MegatronWeightResidency
from areal.utils.environ import get_float_env_var
from areal.utils.logging import getLogger

if TYPE_CHECKING:
    from areal.engine.megatron_engine import MegatronEngine

logger = getLogger("AwexColocate")


def resolve_physical_gpu_id(relative_gpu_id: int) -> int:
    """Map a CUDA-masked relative device index to its physical GPU id.

    CUDA IPC keys must be unique per node, so both sides of a colocated
    transfer have to agree on physical GPU ids. Inside a process that was
    given a device mask, ``torch.cuda.current_device()`` and SGLang's
    ``gpu_id`` are indices into that mask rather than physical ids, so the
    mask itself is the only ground truth. UUID masks and invalid indices are
    rejected because they cannot produce the node-local ordinal AWEX keys use.
    """
    cuda_visible = os.environ.get("CUDA_VISIBLE_DEVICES", "")
    if not cuda_visible:
        return relative_gpu_id
    visible_devices = [item.strip() for item in cuda_visible.split(",") if item.strip()]
    if not all(item.isdigit() for item in visible_devices):
        raise ValueError(
            "AWEX colocate requires numeric CUDA_VISIBLE_DEVICES entries; "
            f"got {visible_devices!r}"
        )
    if relative_gpu_id >= len(visible_devices):
        raise ValueError(
            f"CUDA device {relative_gpu_id} is outside "
            f"CUDA_VISIBLE_DEVICES={visible_devices!r}"
        )
    return int(visible_devices[relative_gpu_id])


def awex_colocate_timeout_s(default: float = 1800.0) -> float:
    return get_float_env_var("AWEX_COLOCATE_TIMEOUT_S", default)


class AwexWeightPublisher:
    """Publish Megatron weights to a colocated SGLang engine through AWEX.

    Uses CUDA IPC (share_memory + ForkingPickler serialization) for zero-copy
    weight transfer to the colocated SGLang process on the same GPU. The infer
    side handles redistribution among infer ranks via its own NCCL group. GPU
    residency is delegated to one shared :class:`MegatronWeightResidency`.
    """

    def __init__(
        self,
        engine: MegatronEngine,
        residency: MegatronWeightResidency | None = None,
    ) -> None:
        self._engine = engine
        self._residency = residency or MegatronWeightResidency(engine)
        self._meta_server_addr: str | None = None
        self._meta_server_client = None
        self._transfer_rank: int | None = None
        self._weight_converter = None
        self._initialized = False
        self._rank_info = None
        self._ip_address: str | None = None
        self._infer_world_size: int | None = None
        self._num_infer_engines: int | None = None
        self._logical_train_rank: int | None = None

    @property
    def residency(self) -> MegatronWeightResidency:
        """Return the sole residency manager used during publication."""
        return self._residency

    def init_colocate_weight_update(
        self,
        meta_server_addr: str | None = None,
        pair_name: str = "default",
        transfer_rank: int = 0,
        timeout_s: float | None = None,
    ) -> None:
        """Initialize MetaServer connection. NCCL group creation is deferred
        to the first weight update (lazy init) to allow SGLang to start first.
        """
        from awex.meta.meta_server import MetaServerClient, start_meta_server

        if not meta_server_addr:
            meta_server_addr = os.environ.get("AWEX_META_SERVER_ADDR", "")
        if not meta_server_addr:
            host, port = start_meta_server()
            meta_server_addr = f"{host}:{port}"
            os.environ["AWEX_META_SERVER_ADDR"] = meta_server_addr
            logger.info("Started MetaServer at %s", meta_server_addr)

        host, port = meta_server_addr.rsplit(":", 1)
        self._meta_server_client = MetaServerClient(host, int(port))
        self._meta_server_addr = meta_server_addr
        self._transfer_rank = transfer_rank
        # Train-side wait budget for infer's weights_update_finished signal.
        # Keep the writer/reader/plugin on one env-controlled timeout to avoid
        # split-brain diagnostics.
        self._timeout_s = awex_colocate_timeout_s() if timeout_s is None else timeout_s
        if dist.get_rank() == 0:
            self._meta_server_client.put_object(
                "awex_train_info", {"train_world_size": dist.get_world_size()}
            )
            logger.info(
                "Registered awex_train_info (train_world_size=%d) with MetaServer",
                dist.get_world_size(),
            )

        logger.info(
            "AwexWeightPublisher initialized: meta_server=%s, transfer_rank=%d",
            meta_server_addr,
            transfer_rank,
        )

    def eager_publish_train_info(self, meta_server_addr: str | None) -> None:
        """Publish train world metadata before the colocated reader starts."""
        addr = meta_server_addr or os.environ.get("AWEX_META_SERVER_ADDR", "")
        if not addr or (dist.is_initialized() and dist.get_rank() != 0):
            return
        try:
            from awex.meta.meta_server import MetaServerClient

            host, port = addr.rsplit(":", 1)
            client = MetaServerClient(host, int(port))
            world = dist.get_world_size() if dist.is_initialized() else 1
            client.put_object("awex_train_info", {"train_world_size": world})
            logger.info(
                "Eager-published awex_train_info (train_world_size=%d) to %s",
                world,
                addr,
            )
        except Exception as exc:
            logger.warning("Eager publish awex_train_info failed: %s", exc)

    def _lazy_initialize(self) -> None:
        """Perform deferred initialization: metadata exchange and weight converter setup.

        In colocate mode, train side does NOT join any NCCL group.
        Weight transfer uses CUDA IPC (share_memory + serialize via MetaServer).
        The infer side creates its own infer-only NCCL group for redistribution.
        """
        if self._initialized:
            return

        from awex.models.registry import get_train_weights_converter
        from awex.sharding.param_sharding import get_rank_info_extractor
        from awex.util.common import get_ip_address

        rank = dist.get_rank()

        self._rank_info = get_rank_info_extractor("mcore")()
        training_world_size = self._rank_info.world_size
        self._ip_address = get_ip_address()
        self._physical_gpu_id = resolve_physical_gpu_id(torch.cuda.current_device())

        from awex.meta.train_meta_resolver import McoreParamMetaResolver

        class _EngineShim:
            def __init__(self, engine):
                self.model = engine.model
                if not isinstance(self.model, (list, tuple)):
                    self.model = [self.model]
                self.hf_config = engine.hf_config
                self.enable_debug_mode = False
                self.enable_colocate_mode = False
                self.engine_name = "mcore"
                self.config = {}
                self.meta_server_addr = ""

            def release_memory_occupation(self, tags=None):
                pass

            def resume_memory_occupation(self, tags=None):
                pass

        shim = _EngineShim(self._engine)

        infer_conf = self._meta_server_client.get_object(
            "infer_conf", timeout=self._timeout_s
        )
        logger.info("Got infer_conf from MetaServer: %s", infer_conf)

        meta_resolver = McoreParamMetaResolver(shim, self._engine.hf_config, infer_conf)
        parameters_meta = meta_resolver.get_parameters_meta()
        logger.info(
            "Collected training parameters metadata: %d params", len(parameters_meta)
        )

        if rank == 0:
            self._meta_server_client.put_object("training_params_meta", parameters_meta)
            logger.info("Registered training_params_meta with MetaServer")

        self._infer_world_size = infer_conf["infer_world_size"]
        self._logical_train_rank = self._infer_world_size + self._rank_info.global_rank

        # Register physical device entry for (ip, node_local_gpu_id) -> rank
        # pairing on the infer side (AWEX reader._init_reader_in_colocate_mode).
        # device_id must be the node-local physical GPU id (matching the infer
        # side and the CUDA IPC key), NOT a global rank. CUDA_VISIBLE_DEVICES is
        # the ground truth since torch.cuda.current_device() is always 0 here.
        self._meta_server_client.add_object_to_set(
            "training_device_rank_entries",
            (self._ip_address, self._physical_gpu_id, self._logical_train_rank),
        )
        logger.info(
            "Registered training_device_rank_entries: (ip=%s, gpu=%d, rank=%d)",
            self._ip_address,
            self._physical_gpu_id,
            self._logical_train_rank,
        )
        self._num_infer_engines
```

### Core Architecture Module: `areal/engine/awex/memory_saver.py`
```
# SPDX-License-Identifier: Apache-2.0

"""Compatibility helpers for SGLang's torch-memory-saver integration."""

from __future__ import annotations

import os


def patch_tms_hook_mode() -> None:
    """Keep pauseable CUDA graphs on torch-memory-saver's preload hook.

    ``megatron.core.inference.contexts.dynamic_context`` assigns
    ``torch_memory_saver.hook_mode = "torch"`` at module import time. SGLang's
    pauseable CUDA graphs require the default ``preload`` hook, so drop that
    assignment when graph saving is enabled. Also ignore unsafe attempts to
    reconfigure the singleton after its implementation has been initialized.

    This must run from the SGLang entry module, before the scheduler imports
    Megatron transitively. Calling it later from the AWEX weight reader is too
    late because CUDA graphs are captured before that reader is constructed.
    """
    try:
        import torch_memory_saver as tms
    except Exception:
        return

    instance = getattr(tms, "torch_memory_saver", None)
    if instance is None:
        return
    cls = type(instance)
    prop = cls.hook_mode
    if getattr(prop.fset, "_awex_safe", False):
        return

    def safe_setter(self, value):
        if value == "torch" and os.environ.get(
            "SGLANG_MEMORY_SAVER_CUDA_GRAPH", ""
        ).lower() in {"1", "true", "yes", "on"}:
            return
        if not hasattr(self, "_impl_ctor_kwargs"):
            return
        prop.fset(self, value)

    safe_setter._awex_safe = True
    cls.hook_mode = property(prop.fget, safe_setter)


__all__ = ["patch_tms_hook_mode"]

```

### Core Architecture Module: `areal/engine/awex/metadata.py`
```
# SPDX-License-Identifier: Apache-2.0

"""Coordinate AWEX metadata construction with SGLang's GC object scans."""

import threading
from collections.abc import Callable
from functools import wraps
from typing import ParamSpec, TypeVar

_P = ParamSpec("_P")
_T = TypeVar("_T")
_metadata_gc_lock = threading.Lock()


def serialize_metadata_gc(func: Callable[_P, _T]) -> Callable[_P, _T]:
    """Keep GC scans from retaining partially constructed metadata tuples.

    CPython's tuple(iterator) may resize an unfinished tuple. gc.get_objects()
    in another thread can retain that tuple, violating the resize refcount
    requirement (CPython issue 15108). SGLang scans objects while freezing GC
    after server startup, concurrently with AWEX's metadata worker.
    """

    @wraps(func)
    def guarded(*args: _P.args, **kwargs: _P.kwargs) -> _T:
        with _metadata_gc_lock:
            return func(*args, **kwargs)

    return guarded

```

### Core Architecture Module: `areal/engine/awex/parallel.py`
```
# SPDX-License-Identifier: Apache-2.0

"""Parallel-state lookup for the SGLang AWEX integration."""

from typing import Any


def resolve_scheduler_parallel_attr(scheduler: Any, name: str) -> int | None:
    """Read parallel state across supported SGLang attribute layouts."""
    worker = getattr(scheduler, "tp_worker", None)
    runner = getattr(worker, "model_runner", None)
    for owner in (
        scheduler,
        getattr(scheduler, "ps", None),
        worker,
        getattr(worker, "ps", None),
        getattr(runner, "ps", None),
    ):
        value = getattr(owner, name, None)
        if value is not None:
            return int(value)
    return None

```

### Core Architecture Module: `areal/engine/awex/sglang_plugin.py`
```
# SPDX-License-Identifier: Apache-2.0

"""AWEX SGLang scheduler plugin for colocated weight transfer.

Patches SGLang's scheduler to inject CUDA IPC weight receiving capabilities.
When AWEX_META_SERVER_ADDR env var is set, starts a background thread that
fetches IPC handles from MetaServer (CPU I/O) and queues them for the
scheduler's main loop to process (CUDA copy on main thread).

Weight transfer flow (aligned with Asystem colocate mode):
  1. Training side: convert params → cuda_ipc_serialize → MetaServer put
  2. Background thread: MetaServer get → queue IPC data (CPU only)
  3. Scheduler main loop: release_memory → deserialize + copy → resume_memory
  4. Main loop: signal done → train side releases shared tensors

Usage:
    # Option 1: Register plugin then launch SGLang
    from areal.engine.awex.sglang_plugin import register_awex_plugin
    register_awex_plugin()

    # Option 2: Run as entry module (replaces sglang.launch_server)
    # python3 -m areal.engine.awex.sglang_plugin --model-path ...
"""

from __future__ import annotations

import importlib
import os
import queue
import threading
import time
from collections.abc import Callable
from contextlib import contextmanager
from copy import copy
from dataclasses import dataclass, field
from typing import Any

from areal.engine.awex.memory_saver import patch_tms_hook_mode
from areal.engine.awex.metadata import serialize_metadata_gc
from areal.engine.awex.parallel import resolve_scheduler_parallel_attr

# Must run before importing SGLang. Its scheduler may import Megatron while
# initializing the model, and Megatron otherwise switches torch-memory-saver
# away from the preload hook required by pauseable CUDA graphs.
patch_tms_hook_mode()


def assert_alloc_conf_supports_memory_saver(conf: str) -> None:
    """Reject allocator configs that silently disable SGLang's memory saver."""
    if "expandable_segments:true" in conf.lower().replace(" ", ""):
        raise RuntimeError(
            "SGLang's memory saver cannot unmap/remap expandable segments, so "
            f"it would disable itself (PYTORCH_CUDA_ALLOC_CONF={conf!r}). Give "
            "the rollout role its own scheduling_spec env_vars without "
            "expandable_segments instead of sharing the actor's."
        )


assert_alloc_conf_supports_memory_saver(os.environ.get("PYTORCH_CUDA_ALLOC_CONF", ""))

from areal.utils import pkg_version  # noqa: E402
from areal.utils.environ import get_float_env_var  # noqa: E402
from areal.utils.logging import getLogger  # noqa: E402

logger = getLogger("AwexSGLangPlugin")
SUPPORTED_SGLANG_VERSIONS = ("0.5.9", "0.5.10.post1", "0.5.18.dev10+g85b539146")


@contextmanager
def _retract_memory_idle(scheduler: Any, owner: Any):
    """Ignore only parked requests while retaining the native execution checks."""
    original_idle = getattr(scheduler, "is_fully_idle", None)
    if (
        not callable(original_idle)
        or not getattr(scheduler, "_engine_paused", False)
        or original_idle()
        or not hasattr(scheduler, "waiting_queue")
    ):
        yield
        return

    def drained_idle(*args, **kwargs):
        # This scope runs synchronously on the scheduler thread. Do not weaken
        # checks for running/overlap/chunked/grammar/disaggregation work.
        waiting = scheduler.waiting_queue
        scheduler.waiting_queue = []
        try:
            return original_idle(*args, **kwargs)
        finally:
            scheduler.waiting_queue = waiting

    if not drained_idle():
        yield
        return
    targets = [scheduler] if owner is scheduler else [scheduler, owner]
    saved = [
        (
            target,
            getattr(target, "is_fully_idle"),
            not hasattr(target, "__dict__") or "is_fully_idle" in vars(target),
        )
        for target in targets
    ]
    try:
        for target in targets:
            target.is_fully_idle = drained_idle
        yield
    finally:
        for target, previous, existed in reversed(saved):
            if existed:
                target.is_fully_idle = previous
            else:
                del target.is_fully_idle


def assert_supported_sglang_version() -> None:
    """Refuse to patch a SGLang build whose internals were not verified."""
    installed = pkg_version.get_version("sglang")
    if installed not in SUPPORTED_SGLANG_VERSIONS:
        raise RuntimeError(
            "AWEX colocate patches SGLang internals and was verified against "
            f"{', '.join(SUPPORTED_SGLANG_VERSIONS)}, but found {installed}. "
            "Re-check Scheduler.__init__, the event loops, and "
            "execute_task_in_model_worker before allowing this version."
        )


def _load_sglang_plugins_if_available() -> bool:
    """Load SGLang runtime plugins when supported by the installed version.

    ``sglang.srt.plugins`` was added after the 0.5.10 runtime currently pinned
    by AReaL.  AWEX does not depend on that registry because it injects its
    scheduler entry point directly through ``launch_server``.  Treat the
    registry as optional so the same entry module works with both APIs.
    """
    try:
        plugins = importlib.import_module("sglang.srt.plugins")
    except ModuleNotFoundError as exc:
        if exc.name != "sglang.srt.plugins":
            raise
        logger.info(
            "[AWEX] SGLang plugin registry is unavailable; using the "
            "launch_server scheduler hook"
        )
        return False

    load_plugins = getattr(plugins, "load_plugins", None)
    if not callable(load_plugins):
        logger.info(
            "[AWEX] SGLang plugin registry has no load_plugins entry point; "
            "using the launch_server scheduler hook"
        )
        return False

    load_plugins()
    return True


def _resolve_transfer_rank(
    *,
    infer_world_size: int,
    gpu_id: int,
    node_id: int,
    nnodes: int,
    instance_world_size: int,
) -> int:
    """Resolve the inference rank in AWEX's global transfer world.

    A one-GPU SGLang server can use the colocated actor's inherited global
    rank when CUDA device isolation remaps its only GPU to device zero. For a
    multi-GPU server, every TP/PP scheduler inherits the same environment, so
    its scheduler-local physical GPU identity must be used instead.
    """
    explicit_rank = os.environ.get("AWEX_TRANSFER_RANK")
    if explicit_rank is not None:
        transfer_rank = int(explicit_rank)
    else:
        env_rank = os.environ.get("RANK")
        env_world_size = os.environ.get("WORLD_SIZE")
        if (
            instance_world_size == 1
            and env_rank is not None
            and env_world_size is not None
            and int(env_world_size) == infer_world_size
        ):
            transfer_rank = int(env_rank)
        else:
            n_gpus_per_node = max(1, infer_world_size // nnodes)
            transfer_rank = node_id * n_gpus_per_node + gpu_id

    if not 0 <= transfer_rank < infer_world_size:
        raise ValueError(
            "AWEX transfer rank must be in "
            f"[0, {infer_world_size}), got {transfer_rank}"
        )
    return transfer_rank


def _writer_version_key(ip_address: str, physical_gpu_id: int) -> str:
    return f"awex_writer_version_{ip_address}_{physical_gpu_id}"


def _try_get_writer_version(
    meta_server_client: Any,
    key: str,
    timeout_s: float,
) -> int | None:
    """Return the writer's current version if published, otherwise None."""

    try:
        wait_key = getattr(meta_server_client, "wait_key", None)
        if callable(wait_key):
            wait_key(key, timeout=timeout_s)
        return int(meta_server_client.get_object(key, timeout=timeout_s))
    except Exception:
        return None


class AwexSchedulerPlugin:
    """Binds awex weight-receive to a SGLang Scheduler instance.

    Architecture: background thread handles MetaServer I/O (CPU only),
    scheduler main loop handles CUDA weight copy (via process_awex_queue).
    """

    def __init__(self, scheduler: Any) -> None:
        self._scheduler = scheduler
        self._receiver = None
        self._bg_thread: threading.Thread | None = None
        self._initialization_error: Exception | None = None
        self._weight_queue: queue.Queue = queue.Queue()
        self._version = 0
        self._paused_poll_interval_s = max(
            0.0, get_float_env_var("AWEX_PAUSED_POLL_INTERVAL_S", 0.01)
        )

    @staticmethod
    def _int_attr(scheduler: Any, name: str, default: int) -> int:
        value = resolve_scheduler_parallel_attr(scheduler, name)
        if value is not None:
            return value
        value = getattr(getattr(scheduler, "server_args", None), name, None)
        if value is not None:
            return int(value)
        return default

    @staticmethod
    def _callable(scheduler: Any, name: str) -> Callable:
        for obj in (scheduler, getattr(scheduler, "weight_updater", None)):
            if obj is None:
                continue
            method = getattr(obj, name, None)
            if callable(method):
                return method
        raise AttributeError(f"Scheduler has no callable {name!r}")

    def _logical_gpu_id(self) -> int:
        return self._int_attr(self._scheduler, "gpu_id", 0)

    def _physical_gpu_id(self) -> int:
        """Return the node-local physical GPU id used by AWEX keys."""
        logical_gpu_id = self._logical_gpu_id()
        visible_devices = [
            item.strip()
            for item in os.environ.get("CUDA_VISIBLE_DEVICES", "").split(",")
            if item.strip()
        ]
        if visible_devices:
            if logical_gpu_id >= len(visible_devices):
                raise ValueError(
                    f"SGLang gpu_id={logical_gpu_id} is outside "
                    f"CUDA_VISIBLE_DEVICES={visible_devices!r}"
                )
            physical_gpu_id = visible_devices[logical_gpu_id]
            if not physical_gpu_id.isdigit():
         
```

### Core Architecture Module: `areal/engine/core/__init__.py`
```
# SPDX-License-Identifier: Apache-2.0

"""Core utilities for training engines."""

from areal.engine.core.train_engine import (
    aggregate_eval_losses,
    compute_microbatch_loss_weight,
    compute_total_loss_weight,
    reorder_and_pad_outputs,
    stage_batch_for_engine,
)

__all__ = [
    "aggregate_eval_losses",
    "compute_microbatch_loss_weight",
    "compute_total_loss_weight",
    "reorder_and_pad_outputs",
    "stage_batch_for_engine",
]

```

### Core Architecture Module: `areal/engine/core/model.py`
```
# SPDX-License-Identifier: Apache-2.0

from enum import Enum
from importlib.metadata import PackageNotFoundError, version

import torch
from packaging.version import InvalidVersion, Version

VALID_VISION_MODELS = [
    "qwen2_vl",
    "qwen2_5_vl",
    "qwen3_vl",
    "qwen3_vl_moe",
    "qwen3_5",
    "qwen3_5_moe",
    "gemma3",
]
# This registry is used to check if a model is a vision model that we have checked it works with AReaL.
# As different vision models vary in their image processing, special tokens and keys, etc.
# We will add models to this registry as we test them.
# If you want to add a new vision model, please make sure it works with AReaL.


def is_valid_vision_model(model_type: str) -> bool:
    return model_type in VALID_VISION_MODELS


def is_qwen2_vl_model(model_type: str) -> bool:
    return model_type in ["qwen2_vl", "qwen2_5_vl"]


def is_qwen3_vl_model(model_type: str) -> bool:
    """True for the Qwen3-VL family (dense and MoE).

    Existing call sites in ``fsdp_engine``, ``fsdp_utils/parallel``, and
    ``awex/fsdp_adapter`` gate family-level behaviour (mRoPE index,
    attention-mask handling) that is identical for dense and MoE, so this
    helper covers both. Use ``is_qwen3_vl_moe_model`` when the MoE-vs-dense
    distinction matters.
    """
    return model_type in ("qwen3_vl", "qwen3_vl_moe")


def is_qwen3_vl_moe_model(model_type: str) -> bool:
    return model_type == "qwen3_vl_moe"


def is_qwen_vl_model(model_type: str) -> bool:
    return is_qwen2_vl_model(model_type) or is_qwen3_vl_model(model_type)


def lang_config(hf_config):
    """Return the language-model side of a (possibly nested) HF config.

    Qwen3-VL and similar VLMs nest text-model attributes (vocab_size,
    num_attention_heads, num_key_value_heads, hidden_size, head_dim) under
    ``hf_config.text_config``. Qwen2.5-VL and pure text models keep them
    flat. Use this anywhere the caller wants a language-side attribute and
    doesn't know the model family up front.
    """
    return getattr(hf_config, "text_config", hf_config)


def is_gemma3_model(model_type: str) -> bool:
    return model_type in ["gemma3"]


VALID_MOE_MODELS = [
    "qwen3_moe",
    "qwen3_vl_moe",
    "qwen3_5_moe",
    "qwen3_5_moe_text",
    "bailing_moe_v2",
    "bailing_moe_linear",
    "bailing_hybrid",
]
# This registry is used to check if a model is a MoE model that we have checked it works with AReaL.


def is_moe_model(model_type: str) -> bool:
    return model_type in VALID_MOE_MODELS


def is_qwen3_moe_model(model_type: str) -> bool:
    return model_type in ["qwen3_moe"]


def is_qwen3_5_model(model_type: str) -> bool:
    return model_type in ["qwen3_5", "qwen3_5_text", "qwen3_5_moe", "qwen3_5_moe_text"]


class SequencePackingMode(str, Enum):
    WRAPPER_THD = "wrapper_thd"
    MODEL_THD = "model_thd"
    PADDED = "padded"


def supports_gdn_packed_seq() -> bool:
    """Require the released GDN THD/CP kernel and matching Qwen bridge."""
    try:
        return Version(version("megatron-core")) >= Version("0.18.2") and Version(
            version("megatron-bridge")
        ) >= Version("0.5.1")
    except PackageNotFoundError:
        return False


def validate_model_packed_seq_dependencies(
    model_type: str, bridge_type: str, context_parallel_size: int
) -> None:
    """Validate dependencies required by model-owned Qwen VLM THD paths."""
    requires_new_stack = bridge_type == "megatron-bridge" and (
        model_type in ("qwen3_5", "qwen3_5_moe")
        or (is_qwen3_vl_model(model_type) and context_parallel_size > 1)
    )
    if not requires_new_stack:
        return

    minimum_versions = {
        "megatron-core": Version("0.18.2"),
        "megatron-bridge": Version("0.5.1"),
    }
    found_versions: dict[str, str] = {}
    incompatible = False
    for package, minimum in minimum_versions.items():
        try:
            raw_version = version(package)
            found_versions[package] = raw_version
            incompatible |= Version(raw_version) < minimum
        except PackageNotFoundError:
            found_versions[package] = "not installed"
            incompatible = True
        except InvalidVersion:
            found_versions[package] = f"invalid version {raw_version!r}"
            incompatible = True

    if incompatible:
        found = ", ".join(
            f"{package}={found_versions[package]}" for package in minimum_versions
        )
        raise RuntimeError(
            "Model-owned THD requires megatron-core>=0.18.2 and "
            "megatron-bridge>=0.5.1 for "
            f"model_type={model_type}, bridge_type={bridge_type}, "
            f"context_parallel_size={context_parallel_size}; found {found}. "
            "Upgrade the Megatron runtime image before enabling this path."
        )


def supports_model_packed_seq(model_type: str, bridge_type: str) -> bool:
    """Whether the bridge model owns BSHD-to-THD packing internally."""
    return bridge_type == "megatron-bridge" and (
        is_qwen3_vl_model(model_type) or model_type in ("qwen3_5", "qwen3_5_moe")
    )


def resolve_sequence_packing_mode(
    model_type: str, bridge_type: str
) -> SequencePackingMode:
    """Select one packing path from the model and bridge contract."""
    if supports_model_packed_seq(model_type, bridge_type):
        return SequencePackingMode.MODEL_THD
    if is_valid_vision_model(model_type) or requires_padded_seq(
        model_type, bridge_type
    ):
        return SequencePackingMode.PADDED
    return SequencePackingMode.WRAPPER_THD


def requires_padded_seq(model_type: str, bridge_type: str | None = None) -> bool:
    """Whether the model must run the padded (BSHD) forward instead of packed (THD).

    Only the active Megatron-Bridge backend has a validated GDN THD contract.
    Keep other or unspecified bridges padded regardless of installed packages.
    """
    return is_qwen3_5_model(model_type) and not (
        bridge_type == "megatron-bridge" and supports_gdn_packed_seq()
    )


# Copied from trl
def disable_dropout_in_model(model: torch.nn.Module) -> None:
    for module in model.modules():
        if isinstance(module, torch.nn.Dropout):
            module.p = 0

```

### Core Architecture Module: `areal/engine/core/train_engine.py`
```
# SPDX-License-Identifier: Apache-2.0

"""Core operations for training engines.

This module provides stateless utility functions that are shared across
different training engine implementations (FSDP, Megatron, etc.).
"""

from collections.abc import Callable
from typing import Any

import torch
import torch.distributed as dist

from areal.infra.platforms import current_platform
from areal.utils.data import (
    TRANSPORT_DUMMY_KEY,
    MicroBatchList,
    pad_and_stack_tensors_along_first_dim,
    reorder_list,
    tensor_container_to,
    unpack_sequence,
)

__all__ = [
    "compute_microbatch_loss_weight",
    "compute_total_loss_weight",
    "aggregate_eval_losses",
    "reorder_and_pad_outputs",
    "stage_batch_for_engine",
]


def compute_microbatch_loss_weight(
    microbatch: dict[str, Any],
    loss_weight_fn: Callable[[dict[str, Any]], torch.Tensor],
) -> torch.Tensor:
    """Return zero without invoking an objective on transport-only data."""
    if microbatch.get(TRANSPORT_DUMMY_KEY) is not True:
        return loss_weight_fn(microbatch)
    reference = next(
        (value for value in microbatch.values() if isinstance(value, torch.Tensor)),
        None,
    )
    if reference is None:
        raise ValueError("Transport micro-batch does not contain a tensor")
    return torch.zeros((), dtype=torch.float32, device=reference.device)


def compute_total_loss_weight(
    mb_list: MicroBatchList,
    loss_weight_fn: Callable[[dict[str, Any]], torch.Tensor],
    dp_group: dist.ProcessGroup,
    device: torch.device | str | int | None = None,
) -> torch.Tensor:
    """Compute total loss weight and all_reduce across data parallel group.

    This aggregates the loss weights from all micro-batches and reduces
    them across the data parallel group to get a global normalization factor.

    Parameters
    ----------
    mb_list : MicroBatchList
        The list of micro-batches.
    loss_weight_fn : Callable[[dict[str, Any]], torch.Tensor]
        Function to compute loss weight for each micro-batch.
    dp_group : dist.ProcessGroup
        The data parallel process group for all_reduce.
    device : torch.device | str | int | None
        Optional device for the reduced scalar. Megatron uses this to keep
        microbatches on CPU while reducing the weight through NCCL/HCCL.

    Returns
    -------
    torch.Tensor
        The total loss weight (scalar tensor) after all_reduce.
    """
    total_weight = torch.stack(
        [compute_microbatch_loss_weight(mb, loss_weight_fn) for mb in mb_list.mbs]
    ).sum()
    total_weight = total_weight.detach().clone().to(device=device, dtype=torch.float32)
    dist.all_reduce(total_weight, group=dp_group)
    assert total_weight > 0, (
        "Global total loss weight must be positive after all_reduce"
    )
    return total_weight


def stage_batch_for_engine(data: dict[str, Any], engine: Any) -> dict[str, Any]:
    """Move a transient trainer batch to the engine's staging device in-place.

    Megatron streams microbatches from CPU. Replacing the values in the
    existing dictionary is important for RPC calls: the RPC argument container
    aliases this dictionary, so a simple local rebind would keep the original
    full-batch accelerator tensors alive for the duration of training.
    Other engines retain their existing input placement.
    """
    if not getattr(engine, "stream_microbatches_from_cpu", False):
        return data
    staged = tensor_container_to(data, "cpu")
    data.clear()
    data.update(staged)
    return data


def aggregate_eval_losses(
    losses: list[torch.Tensor] | None,
    dp_group: dist.ProcessGroup,
    is_pp_last_stage: bool = True,
    pp_group: dist.ProcessGroup | None = None,
    pp_src_rank: int | None = None,
) -> torch.Tensor:
    """Aggregate evaluation losses from micro-batches.

    Parameters
    ----------
    losses : list[torch.Tensor] | None
        List of loss tensors from each micro-batch. None on non-last PP stages.
    dp_group : dist.ProcessGroup
        The data parallel process group for all_reduce.
    is_pp_last_stage : bool
        Whether this rank is the last PP stage. True by default.
    pp_group : dist.ProcessGroup | None
        Pipeline parallel group for broadcast. None if PP broadcast is not required.
    pp_src_rank : int | None
        Global rank of last PP stage (required if pp_group is set).

    Returns
    -------
    torch.Tensor
        The aggregated loss after summing and all_reduce.
    """
    if is_pp_last_stage:
        assert losses is not None, "losses required on last PP stage"
        loss = torch.stack(losses).sum(dtype=torch.float32)
        dist.all_reduce(loss, group=dp_group)
    else:
        device = current_platform.current_device()
        loss = torch.empty(1, device=device, dtype=torch.float32)

    if pp_group is not None:
        assert pp_src_rank is not None, "pp_src_rank required when pp_group is set"
        dist.broadcast(loss, src=pp_src_rank, group=pp_group)

    return loss


def reorder_and_pad_outputs(
    outputs: list[torch.Tensor],
    output_seqlens: list[int],
    mb_list: MicroBatchList,
    aggregate_fn: Callable[[list[Any]], Any] = torch.cat,
) -> torch.Tensor:
    """Aggregate, reorder, and pad forward outputs from micro-batches.

    This handles the output post-processing for forward_batch:
    1. Aggregate outputs from all micro-batches
    2. Unpack by sequence lengths
    3. Reorder to match original input order
    4. Pad and stack along batch dimension

    Parameters
    ----------
    outputs : list[torch.Tensor]
        List of output tensors from each micro-batch.
    output_seqlens : list[int]
        Sequence lengths for unpacking.
    mb_list : MicroBatchList
        The micro-batch list containing reordering indices.
    aggregate_fn : Callable[[list[Any]], Any], optional
        Function to aggregate outputs, by default torch.cat.

    Returns
    -------
    torch.Tensor
        The processed outputs, padded and stacked along batch dimension.
    """
    res = aggregate_fn(outputs)
    semantic_batch_size = len(output_seqlens)
    output_seqlens = [*output_seqlens, *([1] * mb_list.transport_dummy_count)]
    seqlens = [output_seqlens[i] for i in mb_list.forward_indices]
    unpacked = unpack_sequence(res, lens=seqlens, dim=0)
    reordered = reorder_list(unpacked, mb_list.backward_indices)
    if mb_list.transport_dummy_count:
        reordered = reordered[:semantic_batch_size]
    return pad_and_stack_tensors_along_first_dim(reordered)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1658** (2026-10-02): **[Feature] Avoid re-rendering the full chat history on every multi-turn tool rollout**
  *Symptoms*: # Checklist  - [x] This feature will maintain backward compatibility with the current APIs in   `areal/api/`. If not, please raise a refactor issue first.  ## Background  `ArealOpenAI` re-runs Hugging Face chat-template rendering and tokenization over the **entire** message history on every `chat.completions.create()` call.  For long-running tool-use agents the prompt-prep cost therefore grows with trajectory length. With one user message plus an `assistant(tool_calls) + tool` pair per request, request `i` contains `2i - 1` messages, so the **cumulative** number of messages fed to the template is:  ```text 1 + 3 + 5 + ... + (2N - 1) = N² ```  Existing tests check token correctness, not incremental cost.  ## Current behavior  ### `hf` (default)  `chat_template_type="hf"` is the default (`ArealOpenAI`, Data Proxy `areal/v2/inference_service/data_proxy/config.py`). Each create:  1. Receives the full `messages` history. 2. Normalizes tool-call arguments / multimodal messages. 3. Calls `_prepare_prompt()`. 4. Runs `apply_chat_template(..., add_generation_prompt=True)` on the **full** list. 5. Sends the full prompt token IDs to the inference engine.  Code:  - `areal/experimental/openai/client.py` — request construction + `_prepare_prompt` - same file, `chat_template_type == "hf"` branch — full-history render  Typical trace:  ```text user -> assistant(tool_calls) -> tool -> assistant(tool_calls) -> tool -> ... ```  ### `concat`  `concat` reuses parent **generation** token IDs for TI
  **Post-Mortem & Fix Analysis**:
  > I’d like to work on this. I reproduced the current behavior on `cc21ab97` with a CPU-only counting tokenizer: for 10 scripted tool turns, both `hf` and `concat` call the template over `[1, 3, ..., 19]` messages, totaling 100 messages.  For a first PR, I propose keeping the scope conservative:  - text-only `hf` and `concat`; Processor/multimodal requests keep the full-history path; - a tokenizer-scoped incremental helper with exact token-identity tests against full rendering; - unknown or history-dependent templates always fall back to full rendering; - no public API or `areal/api/cli_args.py` changes; - CPU-only regressions covering tool definitions, `chat_template_kwargs`, parent/child concat alignment, and a synthetic 1/10/50/200-turn cost counter.  The remaining design choice is how a template becomes eligible. Would you prefer (a) an internal allowlist for template families verified by tests, or (b) a runtime equality check that promotes a tokenizer/template instance only after ful
  > > I’d like to work on this. I reproduced the current behavior on `cc21ab97` with a CPU-only counting tokenizer: for 10 scripted tool turns, both `hf` and `concat` call the template over `[1, 3, ..., 19]` messages, totaling 100 messages. >  > For a first PR, I propose keeping the scope conservative: >  > * text-only `hf` and `concat`; Processor/multimodal requests keep the full-history path; > * a tokenizer-scoped incremental helper with exact token-identity tests against full rendering; > * unknown or history-dependent templates always fall back to full rendering; > * no public API or `areal/api/cli_args.py` changes; > * CPU-only regressions covering tool definitions, `chat_template_kwargs`, parent/child concat alignment, and a synthetic 1/10/50/200-turn cost counter. >  > The remaining design choice is how a template becomes eligible. Would you prefer (a) an internal allowlist for template families verified by tests, or (b) a runtime equality check that promotes a tokenizer/template i
  > This issue has been automatically marked as stale because it has not had recent activity within the last 14 days.  If this issue is still relevant, please add a comment to keep it open. Otherwise, it will be automatically closed in 16 days.  Thank you for your contribution!

- **Issue #1629** (2026-08-21): **[PLEASE DELETE] [WRONG POST]**
  *Symptoms*: 

- **Issue #1581** (2026-08-27): **[BUG][V2]Memory leak when DELETE /data/clear fails**
  *Symptoms*:  ## Summary    When a storage node fails to handle `DELETE /data/clear`, the failure is silently   swallowed at multiple layers, and there is no fallback that reclaims the leaked   `_storage` entries. The only recovery is a process restart. Worse, the existing   post-clear observability check (`fetch_buffer_stats`) only inspects the consumer   side and will not detect this failure mode at all.      ## Environment    - AReaL: v2.0.0 (also reproduced on `main` at fee938ea)   - Path: HTTP RTensor backend (`areal/infra/rpc/rtensor.py`)    ## Failure chain    1. `HttpRTensorBackend.delete` (`areal/infra/rpc/rtensor.py:256-270`) — single      bare `await session.delete(...)`. No retry. Non-200 responses fall through      silently (`if resp.status == 200: ...`), returning `None` with no log.   2. `RTensor.clear_node` (`rtensor.py:550-564`) — no try/except, no retry.   3. `TrainController._async_clear_batches` (`train_controller.py:808-811`) —      `asyncio.gather(..., return_exceptions=True)`, but the returned exception list      is **never inspected**. Same shape in `v2/training_service/controller/      controller.py:883-892` (no logging at all) and `data_service/controller/      controller.py:414-429` (DEBUG log only).   4. Training continues normally. `_storage` on the failed node accumulates the      step's tensors forever.   5. `fetch_buffer_stats` (`train_controller.py:845-868`) only queries engine      consumer-side `_fetch_buffer`, which was already popped locally in      `R
  **Post-Mortem & Fix Analysis**:
  > Thanks for filing this thorough issue and tracing the complete failure chain!   This is a critical silent failure path. Unhandled `DELETE /data/clear` failures leading to leaked tensors in `_storage` and eventual CPU OOMs on storage nodes are high impact.  Your analysis is spot-on across all three layers. We should implement your proposed fixes:  1. **Wire `DELETE` into HTTP retry helper**:    Update `HttpRTensorBackend.delete` in `areal/infra/rpc/rtensor.py` to use `arequest_with_retry(method="DELETE", ...)` from `areal/infra/utils/http.py`.  2. **Inspect and surface `asyncio.gather` exceptions**:    Check the results of `asyncio.gather(..., return_exceptions=True)` in `TrainController._async_clear_batches`, `v2/training_service/controller/controller.py`, and `DataController._clear_one`, logging warnings/errors on any returned `Exception`.  3. **Extend observability to track node `_storage` size**:    Expose `_storage` size metrics from storage nodes and extend `fetch_buffer_stats` (o
  > This issue has been automatically marked as stale because it has not had recent activity within the last 14 days.  If this issue is still relevant, please add a comment to keep it open. Otherwise, it will be automatically closed in 16 days.  Thank you for your contribution!

- **Issue #1565** (2026-09-04): **[BUG][v2] Teardown leaves an orphan process after torch-memory-saver CUDA free errors**
  *Symptoms*: ## Checklist  - [ ] The error occurs when using the provided Docker image. (This reproduction used a pinned non-container environment.) - [x] I can consistently reproduce the bug across multiple trials. - [x] Training succeeds; the reported failure is isolated to native teardown, not a peer-worker training error.  ## Detailed Information  ### Describe the bug  With the native `GatewayTrainController` v2 path, LoRA, and disk weight updates, training and all native weight publications complete successfully, but shutdown emits torch-memory-saver CUDA free errors and leaves a live orphaned Python process in the exact training session.  The parent trainer exits with code 0. After a 5-second grace period, one process remains with `PPID=1`. An external exact-session supervisor can drain it with SIGTERM, but that is containment rather than a valid native teardown.  This reproduced in two consecutive 2-step runs and again in a fresh 4-step run.  ### Expected behavior  `PPOTrainer.close()` / controller teardown should:  1. order TMS CUDA frees and engine destruction safely; 2. reap all spawned worker/child processes; 3. return only after the training session has no live members; 4. not report “destroyed gracefully” when `/destroy_engine` disconnected.  ### Full logs  The retained, sanitized log contains:  ```text [torch_memory_saver.cpp] CUresult error: 1 (invalid argument) file=csrc/core.cpp func=free line=66 [torch_memory_saver.cpp] CUresult error: 1 (invalid argument) file=csrc/core
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. I investigated the current teardown path and found a concrete explanation for the CUDA free failures.  My current understanding is:  - The final PPO step may leave the actor offloaded. - `FSDPEngine.destroy()` then deletes the optimizer/model without normalizing the TMS state. - In torch-memory-saver 0.0.9, `pause()` already unmaps the VMM allocation and releases its handle, while `free()` attempts to unmap/release it again even when the allocation is `PAUSED`. - The native error path calls `exit(1)`, which is consistent with the two `CUresult error` messages and the `/destroy_engine` `Server disconnected` responses in this report.  There is now an independent minimal reproduction of the same paused-free issue upstream:  - https://github.com/fzyzcjy/torch_memory_saver/issues/92  This explains the CUDA error and worker disconnect with high confidence. Whether it completely explains the remaining orphan PID still needs to be confirmed by rerunning the orig
  > Thank you for your reply and suggestions. I believe the priorities can be divided as follows:  - Prioritize waiting and promoting upstream fixes on the TMS, do not add a temporary workaround for prepare_destroy, to avoid peak GPU memory usage or OOM when restoring the complete model during destruction. - After upstream repair on TMS, upgrade dependencies and patch offload -> destroy test as well as TMS-related dependency tests. Fix controller errors and false positives individually, and then confirm orphan process issues, repairing them individually if necessary. - If there is no progress in the upstream for a long time, consider a minimal temporary workaround.
  > This issue has been automatically marked as stale because it has not had recent activity within the last 14 days.  If this issue is still relevant, please add a comment to keep it open. Otherwise, it will be automatically closed in 16 days.  Thank you for your contribution!

- **Issue #1560** (2026-07-28): **[BUG] Megatron–vLLM weight sync incorrectly requires matching pipeline-parallel sizes**
  *Symptoms*: ## Checklist  * [x] The error occurs when using our provided Docker image. * [x] I can consistently reproduce the bug across multiple trials or random seeds. * [x] If the error causes experiment abortion, I've verified that this error is the root cause, not a secondary error caused by peer workers.  ## Detailed Information  ### Describe the bug  When using Megatron for training and vLLM for rollout generation, AReaL currently requires the training and inference pipeline-parallel sizes to be identical:  ```python if gen_pp_size > 1:     train_pp_size = self.parallel_strategy.pipeline_parallel_size     if train_pp_size != gen_pp_size:         raise ValueError(...) ```  This restriction was introduced by commit:  ```text 95ca87042c582c463387c56dbc1a359d65b4fc4f feat: support pp for Sglang (#1162) Author: TaoZex Date: May 8, 2026 ```  The restriction appears to be required by the new **SGLang per-PP-stage weight synchronization path**, where every Megatron PP stage is paired with the corresponding SGLang PP stage. However, the condition is currently based only on `gen_pp_size > 1`, so it is also applied when the rollout backend is vLLM.  This unnecessarily prevents useful configurations such as:  ```text Megatron training: PP=4 vLLM rollout:      PP=2 ```  The vLLM weight synchronization path does not require a 1:1 correspondence between training and inference PP stages. Each Megatron PP source rank can create a full weight-update group spanning all vLLM ranks and broadcast the p
  **Post-Mortem & Fix Analysis**:
  > Thanks for the thorough writeup, @gursimar, your analysis is spot on. I've opened #1564 implementing exactly the backend-specific condition you proposed.  On your question (was it intentional?): No — it's an over-broad guard. The per-PP-stage path is genuinely SGLang-specific: `SGLangBackend.build_init_weights_group_request` forms one `NCCL` group per PP stage, which is what needs `train_pp_size == gen_pp_size`. VLLMBackend has no per-PP branch at all — it always joins a single flat group spanning every inference worker (`world_size = gen_parallel.world_size + 1`). Gating on `gen_pp_size > 1` alone incorrectly swept vLLM into the SGLang path. Routing vLLM to the single-group branch is the same path already used (and working) for `gen_pp_size == 1` with `train_pp_size > 1`, where each training PP head broadcasts the layers it owns to all inference workers.
  > Thanks @koladefaj 

- **Issue #1557** (2026-08-23): **[BUG] FSDP packed SFT passes a dict attention mask to Llama models**
  *Symptoms*: ## Checklist  - [ ] The error occurs when using our provided Docker image. - [x] I can consistently reproduce the bug across multiple trials or random seeds. - [x] If the error causes experiment abortion, I've verified that this error is the root   cause, not a secondary error caused by peer workers.  ## Detailed Information  ### Describe the bug  `FSDPEngine._prepare_mb_list` passes `{"full_attention": None, "sliding_attention": None}` as `attention_mask` for every model except a small Qwen3-family allowlist.  That mapping is not a common Transformers input contract. Llama models expect a tensor or `None`, so FSDP SFT with `openbmb/MiniCPM5-1B-SFT` (`model_type: llama`) fails before the attention kernel runs:  `AttributeError: 'dict' object has no attribute 'ndim'`  This is related to #1132 and its narrow fix in #1153, but it reaches a different model family and code path: Llama/MiniCPM5 through the FSDP SFT `_prepare_mb_list` path rather than Qwen3.5 through PPO `compute_logp`.  The hard-coded mapping also prevents mapping-aware Transformers models from building their backend-specific packed masks. This overlaps with the masking problem reported in #1442.  ### Expected behavior  AReaL should pass `attention_mask=None` and let each Transformers model build the mask format required by its configured attention backend. AReaL already provides reset packed `position_ids`, `cu_seq_lens_q/k`, and `max_length_q/k`; with `use_cache=False`, Transformers 5.3 uses the reset positions t
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically marked as stale because it has not had recent activity within the last 14 days.  If this issue is still relevant, please add a comment to keep it open. Otherwise, it will be automatically closed in 16 days.  Thank you for your contribution!
  > This issue has been automatically closed because it has been inactive for 30 days.  If you believe this issue is still relevant, please feel free to reopen it or create a new issue with updated information.  Thank you for your contribution!

- **Issue #1494** (2026-08-09): **[BUG] CI (sglang): `test_gsm8k_grpo` fails on A100 with flash-attn CUTE `crd2idx` after TE 2.16 upgrade**
  *Symptoms*: ## Checklist  - [x] The error occurs when using our provided Docker image. - [x] I can consistently reproduce the bug across multiple trials or random seeds. - [x] If the error causes experiment abortion, I've verified that this error is the root   cause, not a secondary error caused by peer workers.  ## Detailed Information  ### Describe the bug  The sglang variant of `test-areal.yml` CI has been failing on `tests/test_examples.py::test_gsm8k_grpo` since the `ghcr.io/areal-project/areal-runtime:dev-sglang` image was rebuilt on 2026-07-02. Root cause is a **latent flash-attn CUTE bug on SM80 GPUs (A100)** that was recently activated by TransformerEngine 2.16's new FA4 dispatch path. Manifests as a `crd2idx` MLIR compilation failure inside `flash_attn/cute/pack_gqa.py:140` during Megatron actor forward pass. The runner then hangs on cleanup and eventually loses heartbeat, so the GitHub Actions log blob is often unavailable for post-mortem.   ### Expected behavior  A clear and concise description of what you expected to happen.  ### Full logs  ``` loc("tPrPtr[i] = utils.elem_pointer(tensor, ((h_idx, m_idx),)).toint()"     ("/opt/.venv/lib/python3.12/site-packages/flash_attn/cute/pack_gqa.py":140)): error: unable to compute crd2idx with        '!cute.layout<"(?):(?{i64 div=8})">' and        '!cute.coord<"((?,?))">' ValueError: Operation creation failed ```  ## To Reproduce Run pytest tests/test_examples.py::test_gsm8k_grpo -m 'not vllm' -v -s on devices with SM80.  ### Commit ID
  **Post-Mortem & Fix Analysis**:
  > I think the underlying issue is the dependency configuration rather than the test itself.  `TransformerEngine` is installed directly from `@stable` in the Docker image:  ``` RUN uv pip install \   git+https://github.com/NVIDIA/TransformerEngine.git@stable ```  At the same time, `transformer-engine` is excluded from `uv.lock`, so every image rebuild resolves whatever commit `stable` points to. The image rebuilt on 2026-07-02 therefore picked up TE 2.16.  The failure also lines up with the attention stack in the image. `sglang` pulls in `flash_attn_4` (resolved to `4.0.0b10`), and the traceback comes from the FA4/CUTE path (`flash_attn/cute/pack_gqa.py`).  I haven't checked the TE source closely enough to say this with certainty, but it looks like TE 2.16 changed the dispatch path for A100/SM80, which now reaches the FA4 kernel and triggers the existing `crd2idx` compilation failure. Previous images don't appear to exercise that path.  Two possible fixes:  - Set `NVTE_FLASH_ATTN=0` in th
  > This issue has been automatically marked as stale because it has not had recent activity within the last 14 days.  If this issue is still relevant, please add a comment to keep it open. Otherwise, it will be automatically closed in 16 days.  Thank you for your contribution!
  > This issue has been automatically closed because it has been inactive for 30 days.  If you believe this issue is still relevant, please feel free to reopen it or create a new issue with updated information.  Thank you for your contribution!

- **Issue #1442** (2026-07-27): **[BUG] attn_impl=sdpa silently produces wrong logp with packed sequences on FSDP+HF backend**
  *Symptoms*: ## Checklist  - [ ] The error occurs when using our provided Docker image.   - [x] I can consistently reproduce the bug across multiple trials or random seeds. - [x] If the error causes experiment abortion, I've verified that this error is the root   cause, not a secondary error caused by peer workers. >I'm using a uv-managed `.venv` (non-Docker) due to local CUDA constraints. The bug is in framework code (`fsdp_engine.py:1879-1903`) that runs identically inside and outside Docker. It reproduces deterministically on every run with the configuration `fsdp + HF + attn_impl=sdpa + packed_sequences`, independent of random seed or model. No experiment abortion occurs — the training runs to completion with silently incorrect logp values, which is part of why this is so hard to detect. ## Detailed Information  ### Describe the bug  When `attn_impl=sdpa` (or `eager`) is configured on the FSDP + HuggingFace training backend with packed sequences, the training engine's logits are systematically corrupted by cross-sample attention contamination — even though `cu_seqlens` correctly describes packed-sequence boundaries.  **Root cause** — `areal/engine/fsdp_engine.py:1879-1903`:  ```python mb["cu_seq_lens_q"] = mb["cu_seq_lens_k"] = mb["cu_seqlens"] mb["attention_mask"] = None  # or {full_attention: None, sliding_attention: None} ```  `cu_seq_lens_q/k` is consumed only by `flash_attention_2/3` via the varlen path. The SDPA path in `transformers.integrations.sdpa_attention.sdpa_attention_fo
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically marked as stale because it has not had recent activity within the last 14 days.  If this issue is still relevant, please add a comment to keep it open. Otherwise, it will be automatically closed in 16 days.  Thank you for your contribution!
  > This issue has been automatically closed because it has been inactive for 30 days.  If you believe this issue is still relevant, please feel free to reopen it or create a new issue with updated information.  Thank you for your contribution!

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

### Incident Patch 1: `2fad2d0e` (2026-09-27)
**Commit Message**: fix(dataset): drop ViRL39K rows with unextractable boxed answers (#1758)

mathruler's extract_boxed_content returns the literal string "None"
when it finds no closing brace. ViRL39K row 34209 has an unbalanced
`\left\{` in its reference, so the loader stored "None" as the gold
answer. Any reply without a closed \boxed{} also extracts to "None",
so grade_answer matched it and an empty or refusal reply scored 0.9
while a real attempt scored 0.1.

Filter such rows before processing and log how many were dropped, and
make acc_reward in the NPU ViRL39K example return 0.0 when the reply
has no extractable boxed answer.

Fixes #1757

Signed-off-by: Mohammad Hijjawi <[REDACTED_EMAIL]>

**File**: `areal/dataset/virl39k.py` (modified, +18/-0)
```diff
@@ -8,6 +8,10 @@
 from PIL import Image
 from PIL.Image import Image as ImageObject
 
+from areal.utils import logging
+
+logger = logging.getLogger("ViRL39KDataset")
+
 
 def convert_image(
     image: ImageObject,
@@ -65,6 +69,20 @@ def get_virl39k_rl_dataset(
         if not os.path.isdir(os.path.join(img_folder_path, "images")):
             raise ValueError(f"images folder not found at {img_folder_path}")
 
+    # extract_boxed_content returns the literal "None" when a reference has no
+    # closing brace (e.g. an unbalanced `\left\{`). Such a gold answer would
+    # match every reply without a boxed answer, so drop these rows.
+    num_rows = len(dataset)
+    dataset = dataset.filter(
+        lambda answer: extract_boxed_content(answer) != "None",
+        input_columns="answer",
+    )
+    if len(dataset) < num_rows:
+        logger.warning(
+            f"Dropped {num_rows - len(dataset)} ViRL39K rows whose boxed "
+            "answer could not be extracted."
+        )
+
     def process(example):
         problem = example["question"]
         if "<image>" not in problem:
```

**File**: `areal/utils/logging.py` (modified, +1/-0)
```diff
@@ -76,6 +76,7 @@
     # Dataset - green
     "Dataset": "light_green",
     "CLEVR70KDataset": "light_green",
+    "ViRL39KDataset": "light_green",
     # Trainers - green
     "RLTrainer": "light_green",
     "SFTTrainer": "light_green",
```

**File**: `examples/vlm_npu/virl39k_grpo.py` (modified, +3/-0)
```diff
@@ -17,6 +17,9 @@ def format_reward(predict_str: str) -> float:
 
 def acc_reward(predict_str: str, ground_truth: str) -> float:
     answer = extract_boxed_content(predict_str)
+    # "None" is mathruler's sentinel for "no closed \boxed{} found".
+    if answer == "None":
+        return 0.0
     return 1.0 if grade_answer(answer, ground_truth) else 0.0
 
 
```

**File**: `tests/test_virl39k.py` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+# SPDX-License-Identifier: Apache-2.0
+
+from __future__ import annotations
+
+from types import SimpleNamespace
+
+from datasets import Dataset
+from PIL import Image
+
+from examples.vlm_npu.virl39k_grpo import acc_reward, virl39k_reward_fn
+
+from areal.dataset.virl39k import get_virl39k_rl_dataset
+
+# From ViRL39K row 34209: `\left\{` opens a brace that `\right.` never closes, so
+# mathruler's extract_boxed_content returns its "None" sentinel for this reference.
+UNBALANCED_ANSWER = r"\boxed{\left\{\eqalign{&x+y-4=30\cr&(x-4)-(y-4)=2\cr }\right.}"
+
+
+def _fake_processor():
+    return SimpleNamespace(
+        image_processor=SimpleNamespace(image_processor_type="Qwen2VLImageProcessor"),
+        tokenizer=SimpleNamespace(
+            apply_chat_template=lambda messages, **_: messages[0]["content"]
+        ),
+    )
+
+
+def _write_virl39k_parquet(tmp_path, answers):
+    (tmp_path / "images").mkdir()
+    Image.new("RGB", (32, 32), color="blue").save(tmp_path / "images" / "0.png")
+    n = len(answers)
+    Dataset.from_dict(
+        {
+            "question": ["<image>Solve it."] * n,
+            "answer": answers,
+            "image": [["images/0.png"]] * n,
+            "PassRate_32BTrained": [0.5] * n,
+            "PassRate_7BBase": [0.5] * n,
+            "category": ["math"] * n,
+            "source": ["test"] * n,
+            "qid": [f"q{i}" for i in range(n)],
+        }
+    ).to_parquet(tmp_path / "train.parquet")
+    return str(tmp_path / "train.parquet")
+
+
+def test_loader_drops_rows_without_extractable_boxed_answer(tmp_path):
+    """A reference whose boxed content cannot be extracted must not be stored
+    as the literal "None" gold answer."""
+    path = _write_virl39k_parquet(tmp_path, [r"\boxed{A}", UNBALANCED_ANSWER])
+
+    dataset = get_virl39k_rl_dataset(path, "train", _fake_processor())
+
+    assert dataset["answer"] == ["A"]
+
+
+def test_acc_reward_rejects_unextractable_prediction():
+    """A reply without a closed \\boxed{} must never match, even against "None"."""
+    assert acc_reward("I'm sorry, I can't help with that.", "None") == 0.0
+    assert acc_reward(r"<think>ok</think> \boxed{5", "None") == 0.0
+    assert acc_reward(r"<think>ok</think> \boxed{5}", "5") == 1.0
+
+
+def test_reward_fn_gives_no_accuracy_credit_for_empty_reply():
+    reward = virl39k_reward_fn(
+        prompt="",
+        completions="",
+        prompt_ids=[],
+        completion_ids=[],
+        answer="None",
+    )
+    assert reward == 0.0
```

---

### Incident Patch 2: `068f6ed8` (2026-09-24)
**Commit Message**: fix: reclaim training caches and bind NUMA by CUDA UUID (#1756)

Resolve CUDA-visible devices by UUID before applying NUMA affinity.
Reclaim idle device cache before the first gradient finalization and
release unused pinned host buffers after checkpoint owners are freed.
Keep pending asynchronous checkpoint payloads alive until completion.

**File**: `areal/engine/megatron_engine.py` (modified, +18/-1)
```diff
@@ -368,6 +368,7 @@ def __init__(self, config: TrainEngineConfig):
         self.bridge = None
         self.process_group_initialized = False
         self._initialized = False
+        self._has_finalized_model_grads = False
         self.rollout_engine: InferenceEngine | None = None
         self.rollout_coordinator: DistRolloutCoordinator | None = None
         self.weight_update_group_initialized: bool = False
@@ -722,12 +723,28 @@ def initialize(self, addr: str | None, ft_spec: FinetuneSpec, *args, **kwargs):
             ]
             if len(self.model) == 1:
                 model_config.param_sync_func = model_config.param_sync_func[0]
-        model_config.finalize_model_grads_func = finalize_model_grads
+        model_config.finalize_model_grads_func = self._finalize_model_grads
         self._mark_duplicated_params()
         self._create_optimizer(ft_spec)
         self._set_optimizer_grad_scale_func()
         self._initialized = True
 
+    def _finalize_model_grads(self, *args: Any, **kwargs: Any) -> None:
+        if not self._has_finalized_model_grads:
+            # With non-overlapped reduction, the first gradient collective runs
+            # after the whole batch. Variable-length microbatches may have filled
+            # the allocator cache by then. NCCL allocates outside that cache and
+            # cannot reclaim it on OOM, even when most reserved memory is unused.
+            self.get_device_stats().log(
+                "before first gradient synchronization", rank=None
+            )
+            current_platform.empty_cache()
+            self.get_device_stats().log(
+                "after reclaiming gradient sync cache", rank=None
+            )
+        finalize_model_grads(*args, **kwargs)
+        self._has_finalized_model_grads = True
+
     def _set_optimizer_grad_scale_func(self) -> None:
         """Use one optimizer loss scale for the main and auxiliary losses.
 
```

**File**: `areal/engine/megatron_utils/checkpointer.py` (modified, +41/-0)
```diff
@@ -59,6 +59,37 @@ def get_device_name() -> str:
     return device
 
 
+def _release_cached_host_memory(rank: int) -> None:
+    """Return unused D2H staging buffers without touching live async payloads."""
+    if get_device_name() != "cuda":
+        return
+    # PyTorch 2.9 exposes only this private binding. Device empty_cache does
+    # not release the separate pinned host allocator's cached checkpoint data.
+    empty_cache = getattr(torch._C, "_host_emptyCache", None)
+    if not callable(empty_cache):
+        return
+
+    def reserved_bytes() -> int | None:
+        try:
+            return torch.cuda.host_memory_stats().get("reserved_bytes.current")
+        except Exception:
+            # Stats are optional and must never prevent reclamation.
+            return None
+
+    before = reserved_bytes()
+    try:
+        empty_cache()
+    except Exception as exc:
+        # Cleanup is best effort: do not strand peers in later collectives or
+        # turn an already published checkpoint into a reported save failure.
+        logger.warning("[Rank %s] Pinned host cache cleanup failed: %s", rank, exc)
+        return
+    log_with_rank(
+        f"Released checkpoint host cache: reserved_bytes={before}->{reserved_bytes()}",
+        rank=rank,
+    )
+
+
 class _UnsupportedMCoreAsyncLayout(RuntimeError):
     """Raised when MCore's retained async payload cannot be released safely.
 
@@ -605,6 +636,12 @@ def save_checkpoint(
             if finalize_fn is not None:
                 _run_checkpoint_publication(self.rank, finalize_fn)
 
+        # Drop this frame's owners before asking the allocator to return cached
+        # staging memory. An async writer still owns its live CPU payload; the
+        # allocator preserves it until the queue reaps that completed request.
+        del state_dict, async_save_request
+        _release_cached_host_memory(self.rank)
+
     def _reap_finished_async_saves(self) -> None:
         """Non-blocking finalize of any background save processes that have finished.
 
@@ -615,6 +652,8 @@ def _reap_finished_async_saves(self) -> None:
         if self._async_queue is None:
             return
         finalized = self._async_queue.maybe_finalize_async_calls(blocking=False)
+        if finalized:
+            _release_cached_host_memory(self.rank)
         for call_idx in finalized:
             log_with_rank(
                 f"Finalized async checkpoint save #{call_idx}",
@@ -645,6 +684,8 @@ def wait_async_saves(self) -> None:
                 log_only_rank_0=True,
             )
         finalized = self._async_queue.maybe_finalize_async_calls(blocking=True)
+        if finalized:
+            _release_cached_host_memory(self.rank)
         for call_idx in finalized:
             log_with_rank(
                 f"Finalized async checkpoint save #{call_idx}",
```

**File**: `areal/infra/platforms/cuda.py` (modified, +10/-2)
```diff
@@ -69,12 +69,20 @@ def set_numa_affinity(cls, local_rank: int) -> None:
 
             pynvml.nvmlInit()
             nvml_initialized = True
-            handle = pynvml.nvmlDeviceGetHandleByIndex(local_rank)
+            # CUDA ordinals are relative to CUDA_VISIBLE_DEVICES, while NVML
+            # indices are physical. Single-GPU workers all have local_rank=0.
+            # Resolve through CUDA's device UUID so each worker binds to its GPU.
+            device_uuid = str(torch.cuda.get_device_properties(local_rank).uuid)
+            # PyTorch exposes the bare UUID; NVML expects its device prefix.
+            if not device_uuid.startswith(("GPU-", "MIG-")):
+                device_uuid = f"GPU-{device_uuid}"
+            handle = pynvml.nvmlDeviceGetHandleByUUID(device_uuid)
             pynvml.nvmlDeviceSetCpuAffinity(handle)
             cpu_set = os.sched_getaffinity(0)
             logger.info(
-                "Set NUMA affinity for GPU %s: bound to %s CPU cores.",
+                "Set NUMA affinity for CUDA device %s (%s): bound to %s CPU cores.",
                 local_rank,
+                device_uuid,
                 len(cpu_set),
             )
         except ImportError:
```

**File**: `tests/test_cuda_numa_affinity.py` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+# SPDX-License-Identifier: Apache-2.0
+
+import sys
+from types import SimpleNamespace
+from unittest.mock import Mock
+
+import pytest
+
+from areal.infra.platforms.cuda import CudaPlatform
+
+
+@pytest.mark.parametrize(
+    "visible,local_rank,uuid",
+    [("4", 0, "four"), ("7,4", 1, "four"), ("GPU-four", 0, "GPU-four")],
+)
+def test_numa_affinity_uses_cuda_device_uuid(monkeypatch, visible, local_rank, uuid):
+    import areal.infra.platforms.cuda as cuda
+
+    monkeypatch.setenv("CUDA_VISIBLE_DEVICES", visible)
+    nvml = SimpleNamespace(
+        nvmlInit=Mock(),
+        nvmlShutdown=Mock(),
+        nvmlDeviceGetHandleByIndex=Mock(
+            side_effect=AssertionError("physical index lookup")
+        ),
+        nvmlDeviceGetHandleByUUID=Mock(return_value="actual-device"),
+        nvmlDeviceSetCpuAffinity=Mock(),
+    )
+    properties = Mock(return_value=SimpleNamespace(uuid=uuid))
+    monkeypatch.setitem(sys.modules, "pynvml", nvml)
+    monkeypatch.setattr(cuda.torch.cuda, "get_device_properties", properties)
+    monkeypatch.setattr(cuda.os, "sched_getaffinity", lambda _: {2, 3})
+
+    CudaPlatform.set_numa_affinity(local_rank)
+
+    properties.assert_called_once_with(local_rank)
+    nvml.nvmlDeviceGetHandleByUUID.assert_called_once_with(
+        uuid if uuid.startswith("GPU-") else f"GPU-{uuid}"
+    )
+    nvml.nvmlDeviceSetCpuAffinity.assert_called_once_with("actual-device")
+    nvml.nvmlDeviceGetHandleByIndex.assert_not_called()
+    nvml.nvmlShutdown.assert_called_once()
+
+
+def test_numa_affinity_uuid_unavailable_skips_binding(monkeypatch):
+    import areal.infra.platforms.cuda as cuda
+
+    nvml = SimpleNamespace(
+        nvmlInit=Mock(),
+        nvmlShutdown=Mock(),
+        nvmlDeviceGetHandleByUUID=Mock(),
+        nvmlDeviceSetCpuAffinity=Mock(),
+    )
+    monkeypatch.setitem(sys.modules, "pynvml", nvml)
+    monkeypatch.setattr(
+        cuda.torch.cuda, "get_device_properties", lambda _: SimpleNamespace()
+    )
+
+    CudaPlatform.set_numa_affinity(0)
+
+    nvml.nvmlDeviceSetCpuAffinity.assert_not_called()
+    nvml.nvmlShutdown.assert_called_once()
```

**File**: `tests/test_megatron_async_save.py` (modified, +149/-0)
```diff
@@ -90,6 +90,10 @@ def _import_checkpointer():
     import pathlib
 
     repo_root = pathlib.Path(__file__).resolve().parents[1]
+    # load_checkpoint imports its lightweight optimizer-state helper lazily.
+    sys.modules["areal.engine.megatron_utils"].__path__ = [
+        str(repo_root / "areal" / "engine" / "megatron_utils")
+    ]
     spec = importlib.util.spec_from_file_location(
         "areal.engine.megatron_utils.checkpointer",
         repo_root / "areal" / "engine" / "megatron_utils" / "checkpointer.py",
@@ -452,3 +456,148 @@ def test_save_unknown_payload_layout_fails_before_scheduling(
 
     queue.schedule_async_request.assert_not_called()
     assert buckets == ["opaque-bucket"]
+
+
+def test_sync_save_releases_state_before_host_cleanup(
+    patched_checkpointer, monkeypatch, tmp_path
+):
+    mod, manager, _ = patched_checkpointer
+    manager.async_save = False
+    manager._async_queue = None
+    references = []
+    events = []
+
+    class Payload:
+        pass
+
+    def generate(*args):
+        payload = Payload()
+        references.append(weakref.ref(payload))
+        return {"model": payload}
+
+    def save(**kwargs):
+        assert kwargs["sharded_state_dict"]["model"] is references[0]()
+        events.append("saved")
+
+    def cleanup(rank):
+        assert rank == manager.rank
+        assert references[0]() is None
+        events.append("cleaned")
+
+    monkeypatch.setattr(manager, "generate_state_dict", generate)
+    monkeypatch.setattr(mod, "save_dist_checkpointing", save)
+    monkeypatch.setattr(mod, "_release_cached_host_memory", cleanup)
+    monkeypatch.setattr(mod.torch.distributed, "barrier", lambda: None)
+
+    manager.save_checkpoint(
+        str(tmp_path / "step0"), finalize_fn=lambda: events.append("published")
+    )
+
+    assert events == ["saved", "published", "cleaned"]
+
+
+@pytest.mark.parametrize("blocking", [False, True])
+def test_async_host_cleanup_preserves_pending_and_follows_completed_payload(
+    patched_checkpointer, monkeypatch, tmp_path, blocking
+):
+    mod, manager, queue = patched_checkpointer
+    holder = []
+    references = []
+    cleanup_liveness = []
+    completed = False
+
+    class Payload:
+        pass
+
+    def schedule(request):
+        payload = Payload()
+        holder.append(payload)
+        references.append(weakref.ref(payload))
+        return 0
+
+    def finalize(*, blocking):
+        if not completed:
+            return []
+        holder.clear()
+        return [0]
+
+    monkeypatch.setattr(manager, "generate_state_dict", lambda *args: {})
+    monkeypatch.setattr(
+        mod,
+        "save_dist_checkpointing",
+        lambda **kwargs: _request_with_pending_payload([]),
+    )
+    monkeypatch.setattr(queue, "schedule_async_request", schedule)
+    monkeypatch.setattr(queue, "maybe_finalize_async_calls", finalize)
+    monkeypatch.setattr(
+        mod,
+        "_release_cached_host_memory",
+        lambda rank: cleanup_liveness.append(references[0]() is not None),
+    )
+
+    manager.save_checkpoint(str(tmp_path / "step0"))
+    # Scheduling must not wait for the writer or clear its CPU holder.
+    assert cleanup_liveness == [True]
+    manager._reap_finished_async_saves()
+    assert cleanup_liveness == [True]
+    assert len(holder) == 1
+
+    completed = True
+    if blocking:
+        manager.wait_async_saves()
+    else:
+        manager._reap_finished_async_saves()
+
+    assert cleanup_liveness == [True, False]
+    assert references[0]() is None
+
+
+@pytest.mark.parametrize("device", ["cpu", "npu", "cuda"])
+def test_host_cleanup_requires_cuda_and_callable_binding(monkeypatch, device):
+    mod = _import_checkpointer()
+    empty_cache = MagicMock()
+    monkeypatch.setattr(mod, "get_device_name", lambda: device)
+    monkeypatch.setattr(mod.torch._C, "_host_emptyCache", empty_cache, raising=False)
+    mod._release_cached_host_memory(0)
+    assert empty_cache.call_count == int(device == "cuda")
+    monkeypatch.delattr(mod.torch._C, "_host_emptyCache")
+    mod._release_cached_host_memory(0)
+    monkeypatch.setattr(mod.torch._C, "_host_emptyCache", None, raising=False)
+    mod._release_cached_host_memory(0)
+
+
+def test_host_cleanup_stats_failure_does_not_prevent_reclamation(monkeypatch):
+    mod = _import_checkpointer()
+    empty_cache = MagicMock()
+    monkeypatch.setattr(mod, "get_device_name", lambda: "cuda")
+    monkeypatch.setattr(mod.torch._C, "_host_emptyCache", empty_cache, raising=False)
+    monkeypatch.setattr(
+        mod.torch.cuda,
+        "host_memory_stats",
+        MagicMock(side_effect=RuntimeError("stats unavailable")),
+        raising=False,
+    )
+
+    mod._release_cached_host_memory(0)
+
+    empty_cache.assert_called_once_with()
+
+
+def test_host_cleanup_failure_preserves_published_save(
+    patched_checkpointer, monkeypatch, tmp_path
+):
+    mod, manager, _ = patched_checkpointer
+    manager.async_save = False
+    manager._async_qu
```

**File**: `tests/test_megatron_grad_sync.py` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+# SPDX-License-Identifier: Apache-2.0
+
+from types import SimpleNamespace
+from unittest.mock import Mock
+
+import pytest
+import torch
+
+from areal.engine import megatron_engine as engine_module
+
+
+def make_engine(monkeypatch):
+    engine = engine_module.MegatronEngine.__new__(engine_module.MegatronEngine)
+    engine._has_finalized_model_grads = False
+    engine.get_device_stats = Mock(return_value=SimpleNamespace(log=Mock()))
+    reclaim = Mock()
+    monkeypatch.setattr(engine_module.current_platform, "empty_cache", reclaim)
+    return engine, reclaim
+
+
+def test_first_grad_sync_reclaims_before_reduction_and_preserves_arguments(monkeypatch):
+    engine, reclaim = make_engine(monkeypatch)
+    gradients = torch.tensor([1.0, -2.0, 3.0])
+    model = [SimpleNamespace(gradients=gradients)]
+    num_tokens = torch.tensor(4)
+
+    def finalize(models, token_count, *, force_all_reduce=False):
+        reclaim.assert_called_once_with()
+        assert models is model
+        assert token_count is num_tokens
+        assert force_all_reduce
+        torch.testing.assert_close(gradients, torch.tensor([1.0, -2.0, 3.0]))
+        gradients.div_(token_count)
+
+    monkeypatch.setattr(engine_module, "finalize_model_grads", finalize)
+    engine._finalize_model_grads(model, num_tokens, force_all_reduce=True)
+
+    torch.testing.assert_close(gradients, torch.tensor([0.25, -0.5, 0.75]))
+    assert engine._has_finalized_model_grads
+
+
+def test_later_grad_sync_keeps_cache_and_still_reduces(monkeypatch):
+    engine, reclaim = make_engine(monkeypatch)
+    finalize = Mock()
+    monkeypatch.setattr(engine_module, "finalize_model_grads", finalize)
+    first_model, second_model = object(), object()
+
+    engine._finalize_model_grads(first_model)
+    engine._finalize_model_grads(second_model)
+
+    reclaim.assert_called_once_with()
+    assert finalize.call_count == 2
+    finalize.assert_called_with(second_model)
+
+
+def test_failed_grad_sync_propagates_without_marking_it_initialized(monkeypatch):
+    engine, reclaim = make_engine(monkeypatch)
+    failure = RuntimeError("collective failed")
+    finalize = Mock(side_effect=[failure, None])
+    monkeypatch.setattr(engine_module, "finalize_model_grads", finalize)
+
+    with pytest.raises(RuntimeError, match="collective failed") as caught:
+        engine._finalize_model_grads([])
+
+    assert caught.value is failure
+    assert not engine._has_finalized_model_grads
+    engine._finalize_model_grads([])
+    assert reclaim.call_count == 2
+    assert engine._has_finalized_model_grads
```

**File**: `tests/test_megatron_optimizer_config.py` (modified, +2/-0)
```diff
@@ -17,6 +17,7 @@ def _make_test_engine(optimizer_config: OptimizerConfig):
     engine.optimizer_config = optimizer_config
     engine.config = SimpleNamespace(use_lora=False)
     engine.mcore_config = MegatronEngineConfig()
+    engine.bridge_cls = None
     engine.model = [object()]
     engine.dtype = torch.bfloat16
     engine.enable_fp8 = False
@@ -187,6 +188,7 @@ def test_precision_aware_optimizer_fields_are_applied_before_validation(
     )
     engine.optimizer_config = OptimizerConfig(type="adam")
     engine.config = SimpleNamespace(use_lora=False)
+    engine.bridge_cls = None
     engine.mcore_config = MegatronEngineConfig(
         use_precision_aware_optimizer=True,
         main_grads_dtype="bfloat16",
```

---

### Incident Patch 3: `0fa9f623` (2026-09-23)
**Commit Message**: fix(engine): preserve colocate state across offload and recovery (#1749)

* fix(engine): preserve colocate state across offload and recovery

* test: align regression fixtures with current engine contracts

**File**: `areal/engine/awex/colocate_reader.py` (modified, +4/-9)
```diff
@@ -33,6 +33,8 @@
 import torch
 
 from areal.engine.awex.memory_saver import patch_tms_hook_mode
+from areal.engine.awex.metadata import serialize_metadata_gc
+from areal.engine.awex.parallel import resolve_scheduler_parallel_attr
 
 # Must run before any awex import: awex.models.registry auto-imports model
 # modules at module load, and the BailingMoe module's transitive megatron import
@@ -228,6 +230,7 @@ def _select_rank0(raw_meta_list):
     def get_model_arch_name(self) -> str:
         return self._model_arch_name
 
+    @serialize_metadata_gc
     def get_parameters_meta(self):
         return self._build_params_meta()
 
@@ -290,15 +293,7 @@ def _build_model_context(self) -> dict[str, Any]:
         dp_size = int(getattr(server_args, "dp_size", 1))
 
         def rank_attr(name: str) -> int | None:
-            for obj in (
-                scheduler,
-                getattr(scheduler, "ps", None),
-                getattr(scheduler, "tp_worker", None),
-            ):
-                value = getattr(obj, name, None) if obj is not None else None
-                if value is not None:
-                    return int(value)
-            return None
+            return resolve_scheduler_parallel_attr(scheduler, name)
 
         tp_rank = rank_attr("tp_rank")
         if tp_rank is None and self._instance_local_rank is not None:
```

**File**: `areal/engine/awex/metadata.py` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+# SPDX-License-Identifier: Apache-2.0
+
+"""Coordinate AWEX metadata construction with SGLang's GC object scans."""
+
+import threading
+from collections.abc import Callable
+from functools import wraps
+from typing import ParamSpec, TypeVar
+
+_P = ParamSpec("_P")
+_T = TypeVar("_T")
+_metadata_gc_lock = threading.Lock()
+
+
+def serialize_metadata_gc(func: Callable[_P, _T]) -> Callable[_P, _T]:
+    """Keep GC scans from retaining partially constructed metadata tuples.
+
+    CPython's tuple(iterator) may resize an unfinished tuple. gc.get_objects()
+    in another thread can retain that tuple, violating the resize refcount
+    requirement (CPython issue 15108). SGLang scans objects while freezing GC
+    after server startup, concurrently with AWEX's metadata worker.
+    """
+
+    @wraps(func)
+    def guarded(*args: _P.args, **kwargs: _P.kwargs) -> _T:
+        with _metadata_gc_lock:
+            return func(*args, **kwargs)
+
+    return guarded
```

**File**: `areal/engine/awex/parallel.py` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+# SPDX-License-Identifier: Apache-2.0
+
+"""Parallel-state lookup for the SGLang AWEX integration."""
+
+from typing import Any
+
+
+def resolve_scheduler_parallel_attr(scheduler: Any, name: str) -> int | None:
+    """Read parallel state across supported SGLang attribute layouts."""
+    worker = getattr(scheduler, "tp_worker", None)
+    runner = getattr(worker, "model_runner", None)
+    for owner in (
+        scheduler,
+        getattr(scheduler, "ps", None),
+        worker,
+        getattr(worker, "ps", None),
+        getattr(runner, "ps", None),
+    ):
+        value = getattr(owner, name, None)
+        if value is not None:
+            return int(value)
+    return None
```

**File**: `areal/engine/awex/sglang_plugin.py` (modified, +37/-13)
```diff
@@ -36,6 +36,8 @@
 from typing import Any
 
 from areal.engine.awex.memory_saver import patch_tms_hook_mode
+from areal.engine.awex.metadata import serialize_metadata_gc
+from areal.engine.awex.parallel import resolve_scheduler_parallel_attr
 
 # Must run before importing SGLang. Its scheduler may import Megatron while
 # initializing the model, and Megatron otherwise switches torch-memory-saver
@@ -225,6 +227,7 @@ def __init__(self, scheduler: Any) -> None:
         self._scheduler = scheduler
         self._receiver = None
         self._bg_thread: threading.Thread | None = None
+        self._initialization_error: Exception | None = None
         self._weight_queue: queue.Queue = queue.Queue()
         self._version = 0
         self._paused_poll_interval_s = max(
@@ -233,16 +236,12 @@ def __init__(self, scheduler: Any) -> None:
 
     @staticmethod
     def _int_attr(scheduler: Any, name: str, default: int) -> int:
-        for obj in (
-            scheduler,
-            getattr(scheduler, "ps", None),
-            getattr(scheduler, "server_args", None),
-        ):
-            if obj is None or not hasattr(obj, name):
-                continue
-            value = getattr(obj, name)
-            if value is not None:
-                return int(value)
+        value = resolve_scheduler_parallel_attr(scheduler, name)
+        if value is not None:
+            return value
+        value = getattr(getattr(scheduler, "server_args", None), name, None)
+        if value is not None:
+            return int(value)
         return default
 
     @staticmethod
@@ -415,6 +414,12 @@ def awex_get_weight_metadata(self) -> list:
     def awex_get_parallelism(self) -> dict:
         return self._require_receiver().get_parallelism()
 
+    def _raise_initialization_error(self) -> None:
+        if self._initialization_error is not None:
+            raise RuntimeError(
+                "AWEX receiver initialization failed"
+            ) from self._initialization_error
+
     # ── Main loop hook: process queued weight updates ─────────────────
 
     def process_awex_queue(self, extra_ready: bool = True) -> None:
@@ -445,6 +450,8 @@ def process_awex_queue(self, extra_ready: bool = True) -> None:
         import torch
         import torch.distributed
 
+        self._raise_initialization_error()
+
         tp_cpu_group = self._scheduler.tp_cpu_group
         tp_size = self._int_attr(self._scheduler, "tp_size", 1)
 
@@ -537,6 +544,7 @@ def _patch_event_loop(self) -> None:
             original_process_input_requests = scheduler.process_input_requests
 
             def _process_input_requests_with_awex(recv_reqs):
+                plugin._raise_initialization_error()
                 result = original_process_input_requests(recv_reqs)
                 if getattr(scheduler, "_engine_paused", False):
                     plugin.process_awex_queue()
@@ -655,6 +663,7 @@ def _maybe_restore_decode_metrics(stage, batch, result):
                 )
 
         def _recv_requests():
+            plugin._raise_initialization_error()
             if hasattr(scheduler, "recv_requests"):
                 return scheduler.recv_requests()
             return scheduler.request_receiver.recv_requests()
@@ -824,7 +833,8 @@ def _background_worker(self, meta_server_addr: str) -> None:
 
         try:
             self._init_receiver_from_meta_server(meta_server_addr)
-        except Exception:
+        except Exception as exc:
+            self._initialization_error = exc
             logger.exception("AWEX background worker initialization failed")
             return
 
@@ -1025,6 +1035,14 @@ def register_awex_plugin() -> None:
     assert_supported_sglang_version()
     from sglang.srt.managers.scheduler import Scheduler
 
+    # Install before construction: the scheduler dispatcher captures bound
+    # handlers during __init__. Metadata aggregation runs in our worker thread.
+    freeze_gc = getattr(Scheduler, "handle_freeze_gc", None)
+    if callable(freeze_gc) and not getattr(freeze_gc, "_areal_awex_gc_guard", False):
+        guarded_freeze_gc = serialize_metadata_gc(freeze_gc)
+        guarded_freeze_gc._areal_awex_gc_guard = True
+        Scheduler.handle_freeze_gc = guarded_freeze_gc
+
     _orig_init = Scheduler.__init__
 
     def _patched_init(self, *args, **kwargs):
@@ -1075,9 +1093,15 @@ def _patch_execute_task_in_model_worker(
     task_cls = _get_model_worker_task_cls()
 
     def execute_task_in_model_worker(task_spec):
+        tp_size = plugin._int_attr(scheduler, "tp_size", 1)
+        tp_rank = resolve_scheduler_parallel_attr(scheduler, "tp_rank")
+        if tp_rank is None and tp_size == 1:
+            tp_rank = 0
+        if tp_rank is None or not 0 <= tp_rank < tp_size:
+            raise RuntimeError("Cannot resolve a valid AWEX inference TP rank")
         model_context = dict(
-            tp_rank=plugin._int_attr(scheduler, "tp_rank", 0),
-            tp_size=plugin._int_attr(scheduler, "tp_size", 1),
+
```

**File**: `areal/engine/megatron_engine.py` (modified, +6/-0)
```diff
@@ -2147,6 +2147,12 @@ def _create_optimizer(self, ft_spec: FinetuneSpec) -> None:
         )
 
         self.optimizer = get_megatron_optimizer(mcore_opt_config, self.model)
+        if mcore_opt_config.optimizer_cpu_offload:
+            from areal.engine.megatron_utils.hybrid_optimizer import (
+                install_hybrid_optimizer_checkpoint_compat,
+            )
+
+            install_hybrid_optimizer_checkpoint_compat(self.optimizer)
 
         lr_scheduler = OptimizerParamScheduler(
             self.optimizer,
```

**File**: `areal/engine/megatron_utils/checkpointer.py` (modified, +5/-0)
```diff
@@ -504,6 +504,11 @@ def load_checkpoint(
             )
             optimizer_state_dict = state_dict["optimizer"]
             self.optimizer.load_state_dict(optimizer_state_dict)
+            from areal.engine.megatron_utils.hybrid_optimizer import (
+                sync_loaded_hybrid_optimizer_state,
+            )
+
+            sync_loaded_hybrid_optimizer_state(self.optimizer)
             log_with_rank(
                 f"Loaded optimizer checkpoint from {local_path}",
                 rank=self.rank,
```

**File**: `areal/engine/megatron_utils/hybrid_optimizer.py` (added, +56/-0)
```diff
@@ -0,0 +1,56 @@
+# SPDX-License-Identifier: Apache-2.0
+"""Checkpoint compatibility for Megatron's CPU offload optimizer."""
+
+from collections.abc import Iterator
+from types import MethodType
+from typing import Any
+
+import torch
+
+
+@torch.no_grad()
+def _restore_inner_master_params(optimizer: Any) -> None:
+    if not optimizer.param_update_in_fp32:
+        return
+    # Native FP32 shards have an inner CPU copy but no param_to_fp32_param
+    # entry. Restore the parameter actually consumed by the sub-optimizer.
+    for param, state in optimizer.state.items():
+        optimizer.param_to_inner_param[param].copy_(state["master_param"])
+
+
+def iter_hybrid_optimizers(optimizer: Any) -> Iterator[Any]:
+    if hasattr(optimizer, "chained_optimizers"):
+        for child in optimizer.chained_optimizers:
+            yield from iter_hybrid_optimizers(child)
+    elif hasattr(optimizer, "optimizer"):
+        yield from iter_hybrid_optimizers(optimizer.optimizer)
+    elif hasattr(optimizer, "param_to_inner_param"):
+        # Ordinary optimizers must not require the optional CPU-offload module.
+        from megatron.core.optimizer.cpu_offloading.hybrid_optimizer import (
+            HybridDeviceOptimizer,
+        )
+
+        if isinstance(optimizer, HybridDeviceOptimizer):
+            yield optimizer
+
+
+def install_hybrid_optimizer_checkpoint_compat(optimizer: Any) -> None:
+    """Handle both native FP32 shards and mixed-precision master parameters."""
+    for hybrid in iter_hybrid_optimizers(optimizer):
+        hybrid._update_fp32_params_by_new_state = MethodType(
+            _restore_inner_master_params, hybrid
+        )
+
+
+def sync_loaded_hybrid_optimizer_state(optimizer: Any) -> None:
+    """Publish loaded distributed checkpoint state to CPU/GPU sub-optimizers."""
+    for hybrid in iter_hybrid_optimizers(optimizer):
+        # dp_reshardable carries a nonpersistent template `step`, whereas
+        # the checkpoint's authoritative Adam counter lives in param_groups.
+        for group in hybrid.param_groups:
+            if "step" in group:
+                for param in group["params"]:
+                    state = hybrid.state[param]
+                    if isinstance(state.get("step"), torch.Tensor):
+                        state["step"].fill_(group["step"])
+        hybrid._sync_hdo_state_to_sub_optimizers()
```

**File**: `areal/engine/megatron_utils/weight_residency.py` (modified, +22/-30)
```diff
@@ -30,6 +30,8 @@ class MegatronWeightResidency:
     def __init__(self, engine: MegatronEngine) -> None:
         self._engine = engine
         self._released_tags: set[str] = set()
+        self._offloaded_optimizer_params: list[tuple[torch.Tensor, torch.device]] = []
+        self._offloaded_optimizer_states: list[tuple[dict, str, torch.device]] = []
 
     @property
     def released_tags(self) -> frozenset[str]:
@@ -226,17 +228,23 @@ def _offload_optimizer_states(self) -> None:
 
         count = 0
         for opt in inner_optimizers:
+            # Offload FP32 main parameter copies (shard_fp32_from_float16_groups)
             if hasattr(opt, "shard_fp32_from_float16_groups"):
                 for group in opt.shard_fp32_from_float16_groups:
                     if isinstance(group, list):
                         for tensor in group:
                             if tensor is not None and tensor.data.is_cuda:
+                                self._offloaded_optimizer_params.append(
+                                    (tensor, tensor.device)
+                                )
                                 tensor.data = tensor.data.to("cpu", non_blocking=True)
                                 count += 1
                     elif group is not None and group.data.is_cuda:
+                        self._offloaded_optimizer_params.append((group, group.device))
                         group.data = group.data.to("cpu", non_blocking=True)
                         count += 1
 
+            # Offload Adam states (exp_avg, exp_avg_sq)
             base_opt = getattr(opt, "optimizer", opt)
             if not hasattr(base_opt, "state") or base_opt.state is None:
                 continue
@@ -247,6 +255,9 @@ def _offload_optimizer_states(self) -> None:
                         and isinstance(state[key], torch.Tensor)
                         and state[key].is_cuda
                     ):
+                        self._offloaded_optimizer_states.append(
+                            (state, key, state[key].device)
+                        )
                         state[key] = state[key].to("cpu", non_blocking=True)
                         count += 1
 
@@ -274,38 +285,19 @@ def _reload_optimizer_states(self) -> None:
             logger.info("Reloaded optimizer via restore_from_cpu()")
             return
 
-        inner_optimizers = self._get_inner_optimizers()
-        if not inner_optimizers:
-            return
-
-        device = self._engine.device
+        # Restore only tensors moved by this adapter. HybridDeviceOptimizer
+        # also owns native CPU parameters and moments, which must stay on CPU.
         count = 0
-        for opt in inner_optimizers:
-            if hasattr(opt, "shard_fp32_from_float16_groups"):
-                for group in opt.shard_fp32_from_float16_groups:
-                    if isinstance(group, list):
-                        for tensor in group:
-                            if tensor is not None and not tensor.data.is_cuda:
-                                tensor.data = tensor.data.to(device, non_blocking=True)
-                                count += 1
-                    elif group is not None and not group.data.is_cuda:
-                        group.data = group.data.to(device, non_blocking=True)
-                        count += 1
-
-            base_opt = getattr(opt, "optimizer", opt)
-            if not hasattr(base_opt, "state") or base_opt.state is None:
-                continue
-            for state in base_opt.state.values():
-                for key in ("exp_avg", "exp_avg_sq"):
-                    if (
-                        key in state
-                        and isinstance(state[key], torch.Tensor)
-                        and not state[key].is_cuda
-                    ):
-                        state[key] = state[key].to(device, non_blocking=True)
-                        count += 1
+        for param, device in self._offloaded_optimizer_params:
+            param.data = param.data.to(device, non_blocking=True)
+            count += 1
+        for state, key, device in self._offloaded_optimizer_states:
+            state[key] = state[key].to(device, non_blocking=True)
+            count += 1
         torch.cuda.synchronize()
-        logger.info("Reloaded %d optimizer state tensors to GPU", count)
+        self._offloaded_optimizer_params.clear()
+        self._offloaded_optimizer_states.clear()
+        logger.info("Reloaded %d optimizer state tensors to original devices", count)
 
 
 __all__ = ["MegatronWeightResidency"]
```

---

### Incident Patch 4: `634812a7` (2026-09-23)
**Commit Message**: build: upgrade Megatron Core to 0.19 and Bridge to 0.6 (#1733)

* build: upgrade Megatron dependencies

* fix(megatron): adapt to native MCore 0.19 APIs

* fix(megatron): support GTP rematerialized LM heads

* build: skip unsupported Hadamard extension

* build: upgrade cuDNN for Megatron runtime

Align the SGLang training environment with the cuDNN 9.19 runtime used for upgraded Megatron GDN and context-parallel workloads. Keep the vLLM dependency stack unchanged.

* build: pin patched Megatron Bridge wheel

* build: update Bridge compatibility wheel

**File**: `.agents/skills/upgrade-deps/SKILL.md` (modified, +10/-10)
```diff
@@ -537,13 +537,13 @@ ______________________________________________________________________
 
 ## Checklist File Status
 
-| Package           | Checklist file                  | Status                                                                                                                                             |
-| ----------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
-| `megatron-core`   | `checklists/megatron-core.md`   | ✅ 18 API entries (parallel_state, DDP, optimizer, pipeline, checkpointing, transformer config, FP8, GPTModel, tensor_parallel, layer specs, RoPE) |
-| `megatron-bridge` | `checklists/megatron-bridge.md` | ✅ 7 API entries (AutoBridge, LoRA, save/load HF, monkey-patch guard)                                                                              |
-| `mbridge`         | `checklists/mbridge.md`         | ✅ 14 API entries (AutoBridge, Bridge properties, weight mappings, LLMBridge subclassing, register_model, monkey-patch target)                     |
-| `vllm`            | `checklists/vllm.md`            | ✅ 14 API entries (entrypoints, LoRA manager, worker V0/V1, tool parsers, CLI)                                                                     |
-| `sglang`          | `checklists/sglang.md`          | ✅ 14 API entries (HTTP endpoints, tool/reasoning parsers, CLI flags, version guards)                                                              |
-| `transformers`    | `checklists/transformers.md`    | ✅ 12 API entries (Auto\* classes, tokenizer, flash attention monkey-patches, Qwen VL internals, LR schedulers)                                    |
-| `peft`            | `checklists/peft.md`            | ✅ 4 API entries (LoraConfig, TaskType, get_peft_model, weight key format)                                                                         |
-| `torchao`         | `checklists/torchao.md`         | ✅ 5 API entries (fp8_blockwise_mm, enable_fp8_linear/experts, shard validation, Triton kernels)                                                   |
+| Package           | Checklist file                  | Status                                                                                                                                                                              |
+| ----------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| `megatron-core`   | `checklists/megatron-core.md`   | ✅ 23 API entries (parallel_state, DDP, optimizer, pipeline, checkpointing/async internals, transformer config, FP8, GPT/MTP, tensor_parallel, custom attention, layer specs, RoPE) |
+| `megatron-bridge` | `checklists/megatron-bridge.md` | ✅ 9 API entries (AutoBridge, LoRA, save/load HF, Qwen3-VL patch target, AutoMapping, monkey-patch guard)                                                                           |
+| `mbridge`         | `checklists/mbridge.md`         | ✅ 14 API entries (AutoBridge, Bridge properties, weight mappings, LLMBridge subclassing, register_model, monkey-patch target)                                                      |
+| `vllm`            | `checklists/vllm.md`            | ✅ 14 API entries (entrypoints, LoRA manager, worker V0/V1, tool parsers, CLI)                                                                                                      |
+| `sglang`          | `checklists/sglang.md`          | ✅ 14 API entries (HTTP endpoints, tool/reasoning parsers, CLI flags, version guards)                                                                                               |
+| `transformers`    | `checklists/transformers.md`    | ✅ 12 API entries (Auto\* classes, tokenizer, flash attention monkey-patches, Qwen VL internals, LR schedulers)                                                                     |
+| `peft`            | `checklists/peft.md`            | ✅ 4 API entries (LoraConfig, TaskType, get_peft_model, weight key format)                                                                                                          |
+| `torchao`         | `checklists/torchao.md`         | ✅ 5 API entries (fp8_blockwise_mm, enable_fp8_linear/experts, shard validation, Triton kernels)                                                                                    |
```

**File**: `.agents/skills/upgrade-deps/checklists/megatron-bridge.md` (modified, +61/-10)
```diff
@@ -4,7 +4,9 @@ github: NVIDIA-NeMo/Megatron-Bridge
 branch_template: v${VERSION}
 upstream_paths:
   - megatron/bridge/__init__.py
-  - megatron/bridge/auto_bridge.py
+  - megatron/bridge/models/conversion/auto_bridge.py
+  - megatron/bridge/models/conversion/param_mapping.py
+  - megatron/bridge/models/qwen_vl/modelling_qwen3_vl/text_model.py
   - megatron/bridge/peft/lora.py
 ---
 
@@ -19,13 +21,21 @@ upstream_paths:
 
 ### Secondary (model / infra layer)
 
-_None._
+| File                                        | Imports / Usage                                                   |
+| ------------------------------------------- | ----------------------------------------------------------------- |
+| `areal/models/mcore/vocab_parallel_head.py` | `AutoMapping.register_module_type` for dynamic LM-head subclasses |
 
 ### Tertiary (tests, config)
 
-| File                             | Imports / Usage                                                                   |
-| -------------------------------- | --------------------------------------------------------------------------------- |
-| `areal/tools/validation_base.py` | `"megatron-bridge"` → `"megatron.bridge"` in `PACKAGE_IMPORT_MAP` (metadata only) |
+| File                                          | Imports / Usage                                                                   |
+| --------------------------------------------- | --------------------------------------------------------------------------------- |
+| `areal/tools/validation_base.py`              | `"megatron-bridge"` → `"megatron.bridge"` in `PACKAGE_IMPORT_MAP` (metadata only) |
+| `areal/tools/validate_docker_installation.py` | Megatron Bridge package validation metadata                                       |
+| `tests/test_bailing_v3_nccl.py`               | Conditional Bridge availability and real conversion integration                   |
+| `tests/test_megatron_bridge_deterministic.py` | Bridge provider determinism integration                                           |
+| `tests/test_megatron_engine.py`               | Megatron engine integration through Bridge-backed paths                           |
+| `tests/test_megatron_transport.py`            | Conditional import of Bridge-backed Megatron engine                               |
+| `tests/test_megatron_lm_head.py`              | `AutoMapping` registry assertion for promoted LM-head subclasses                  |
 
 ______________________________________________________________________
 
@@ -38,7 +48,7 @@ signatures on returned objects**, and **moved/renamed modules**.
 
 ### 1. `megatron.bridge.AutoBridge.from_hf_pretrained`
 
-**Source:** `megatron/bridge/auto_bridge.py`
+**Source:** `megatron/bridge/models/conversion/auto_bridge.py`
 
 Called in `areal/engine/megatron_engine.py` (line 430):
 
@@ -59,7 +69,7 @@ ______________________________________________________________________
 
 ### 2. `megatron.bridge.AutoBridge.save_hf_pretrained`
 
-**Source:** `megatron/bridge/auto_bridge.py`
+**Source:** `megatron/bridge/models/conversion/auto_bridge.py`
 
 Called in `areal/engine/megatron_engine.py` (line 1561):
 
@@ -74,7 +84,7 @@ ______________________________________________________________________
 
 ### 3. `megatron.bridge.AutoBridge.load_hf_weights`
 
-**Source:** `megatron/bridge/auto_bridge.py`
+**Source:** `megatron/bridge/models/conversion/auto_bridge.py`
 
 Called in `areal/engine/megatron_engine.py` (line 1595):
 
@@ -89,7 +99,7 @@ ______________________________________________________________________
 
 ### 4. `megatron.bridge.AutoBridge.save_hf_adapter`
 
-**Source:** `megatron/bridge/auto_bridge.py`
+**Source:** `megatron/bridge/models/conversion/auto_bridge.py`
 
 Called in `areal/engine/megatron_engine.py` (lines 1554-1559) via the monkey-patched
 method on the bridge instance:
@@ -121,7 +131,7 @@ ______________________________________________________________________
 
 ### 5. `megatron.bridge.AutoBridge.export_adapter_weights`
 
-**Source:** `megatron/bridge/auto_bridge.py`
+**Source:** `megatron/bridge/models/conversion/auto_bridge.py`
 
 Called inside the monkey-patched `save_hf_adapter` in
 `areal/engine/megatron_utils/megatron_lora.py` (lines 237-240):
@@ -181,6 +191,47 @@ correct keyword to enable grad on LoRA parameters.
 
 ______________________________________________________________________
 
+### 8. Qwen3-VL model forward contract
+
+**Source:** `megatron/bridge/models/qwen_vl/modelling_qwen3_vl/text_model.py`
+
+Called through `packed_context_parallel_forward` in
+`areal/engine/megatron_utils/packed_context_parallel.py`:
+
+```python
+output = model(
+    input_ids=input_ids,
+    attention_mask=attention_mask,
+    position_ids=position_ids,
+    packed_seq_params=packed_seq_params,
+    loss_mask=mtp_loss_mask,
+)
+```
+
+**Check:** Verify `Qwen3VLModel.forward` and its `Qwen3VLGPTModel` decoder accept
+`loss_mask`, preserve `labels=None` logits output, and pass layout-aligned `input_ids`
+to MCor
```

**File**: `.agents/skills/upgrade-deps/checklists/megatron-core.md` (modified, +183/-23)
```diff
@@ -1,17 +1,25 @@
 ---
 package: megatron-core
 github: NVIDIA/Megatron-LM
-branch_template: core_r${VERSION}
+branch_template: core_v${VERSION}
 upstream_paths:
   - megatron/core/parallel_state.py
   - megatron/core/distributed/
   - megatron/core/optimizer/
   - megatron/core/optimizer_param_scheduler.py
   - megatron/core/pipeline_parallel/
+  - megatron/core/tensor_parallel/
   - megatron/core/transformer/transformer_config.py
   - megatron/core/transformer/pipeline_parallel_layer_layout.py
+  - megatron/core/transformer/multi_token_prediction.py
+  - megatron/core/transformer/multi_latent_attention.py
+  - megatron/core/transformer/spec_utils.py
+  - megatron/core/transformer/transformer_block.py
+  - megatron/core/transformer/transformer_layer.py
   - megatron/core/dist_checkpointing/
+  - megatron/core/dist_checkpointing/mapping.py
   - megatron/core/dist_checkpointing/serialization.py
+  - megatron/core/dist_checkpointing/strategies/async_utils.py
   - megatron/core/dist_checkpointing/strategies/fully_parallel.py
   - megatron/core/fp8_utils.py
   - megatron/core/models/gpt/
@@ -32,29 +40,55 @@ upstream_paths:
 | `areal/engine/megatron_utils/pipeline_parallel.py`       | `TransformerConfig`, `PipelineParallelLayerLayout`                                                                                                                                                               |
 | `areal/engine/megatron_utils/packed_context_parallel.py` | `PackedSeqParams`, `parallel_state`                                                                                                                                                                              |
 | `areal/engine/megatron_utils/fp8/tensor_helper.py`       | `fp8_utils.is_float8tensor`                                                                                                                                                                                      |
+| `areal/engine/megatron_utils/deterministic.py`           | `AttnBackend` enum for deterministic attention selection                                                                                                                                                         |
+| `areal/engine/megatron_utils/weight_residency.py`        | `DistributedDataParallel` flat-buffer residency (`buffers`, `expert_parallel_buffers`)                                                                                                                           |
 
 ### Secondary (model / infra layer)
 
-| File                                              | Imports / Usage                                                                                                                                                                                        |
-| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
-| `areal/models/mcore/registry.py`                  | `GPTModel`, `DDP`, `TransformerConfig`, `parallel_state`, `AutoConfig`                                                                                                                                 |
-| `areal/models/mcore/bailing_moe.py`               | `MLATransformerConfig`, `LayerType`, `ModuleSpec`, `SelfAttention`, `AttnMaskType`, `TransformerLayer`, `TransformerLayerSubmodules`, `TransformerBlockSubmodules`, `apply_rotary_pos_emb`, rope_utils |
-| `areal/models/mcore/tree_attn/module_megatron.py` | `TransformerConfig`, `SelfAttention`, `AttnMaskType`, layer specs                                                                                                                                      |
-| `areal/models/mcore/lightning_attention.py`       | `parallel_state`, `apply_rotary_pos_emb`, `MegatronModule`, `ModuleSpec`, `build_module`                                                                                                               |
-| `areal/models/mcore/bailing_moe_bridge.py`        | `MLATransformerConfig`, `AttnBackend`                                                                                                                                                                  |
-| `areal/models/mcore/common.py`                    | `TransformerConfig`                                                                                                                                                                                    |
-| `areal/models/mcore/qwen3.py`                     | `gpt_layer_specs`, `TransformerConfig`                                                                                                                                                                 |
+| File                                              | Imports / Usage                                                                                   
```

**File**: `areal/api/cli_args.py` (modified, +7/-8)
```diff
@@ -1118,12 +1118,11 @@ class MegatronEngineConfig:
         default=False,
         metadata={
             "help": "Train the Multi-Token-Prediction (MTP) head as an auxiliary "
-            "objective (SFT/RL). Requires enable_mtp=True. The MTP loss is fed an "
-            "independent label channel (mtp_kwargs) so the main forward keeps "
-            "labels=None and returns logits; MTP gradients are isolated from the "
-            "backbone (output weight detached, backbone hidden states cut from the "
-            "MTP graph). bridge_type=megatron-bridge only; packed context parallel "
-            "training is supported.",
+            "objective (SFT/RL). Requires enable_mtp=True. The main forward keeps "
+            "labels=None and returns logits; Megatron-Core derives MTP targets from "
+            "input_ids and isolates MTP gradients from the backbone and LM head. "
+            "bridge_type=megatron-bridge only; packed context parallel training is "
+            "supported.",
         },
     )
 
@@ -1171,8 +1170,8 @@ def __post_init__(self) -> None:
             import torch
 
             for package, minimum in (
-                ("megatron-core", "0.18.2"),
-                ("megatron-bridge", "0.5.1"),
+                ("megatron-core", "0.19.0"),
+                ("megatron-bridge", "0.6.0"),
             ):
                 try:
                     installed = pkg_version.get_version(package)
```

**File**: `areal/engine/megatron_engine.py` (modified, +17/-20)
```diff
@@ -69,7 +69,6 @@
     resolve_sequence_packing_mode,
     validate_model_packed_seq_dependencies,
 )
-from areal.engine.megatron_utils import megatron_bridge_patches  # noqa: F401
 from areal.engine.megatron_utils.bailing_v3 import (
     BailingV3MlaWeightPairs,
     is_bailing_v3,
@@ -1356,10 +1355,10 @@ def forward_step(batch_iter, model):
                     "BSHD is supported only for text-only models such as Qwen3.5"
                 )
 
-            # MTP training: feed the MTP head independent label and mask
-            # channels so the main forward keeps labels=None and returns
-            # logits. packed_context_parallel_forward converts both tensors to
-            # the model's actual THD or BSHD layout before forwarding them.
+            # MTP training: pass the token loss mask through the model's actual
+            # THD or BSHD layout. MCore 0.19 derives MTP labels directly from
+            # input_ids when the main forward keeps labels=None, so AReaL only
+            # needs to provide the aligned supervision mask.
             # This is intentionally enabled by the training config rather than
             # gated by the model family: Qwen3.5 is registered as vision-capable
             # but its text-only and multimodal batches use the same padded MTP
@@ -1376,17 +1375,14 @@ def forward_step(batch_iter, model):
                         "multimodal, padding, and sequence-boundary positions are "
                         "not used as MTP supervision."
                     )
-                mtp_labels = mb_input.padded_mb["input_ids"]
-                if mtp_loss_mask.shape != mtp_labels.shape:
+                input_ids = mb_input.padded_mb["input_ids"]
+                if mtp_loss_mask.shape != input_ids.shape:
                     raise ValueError(
                         "MTP training requires loss_mask to match input_ids before "
                         f"layout conversion, got {mtp_loss_mask.shape} and "
-                        f"{mtp_labels.shape}."
+                        f"{input_ids.shape}."
                     )
-                mb_input.padded_mb["mtp_kwargs"] = {
-                    "mtp_labels": mtp_labels,
-                    "mtp_loss_mask": mtp_loss_mask,
-                }
+                mb_input.padded_mb["mtp_loss_mask"] = mtp_loss_mask
 
             output = packed_context_parallel_forward(
                 model,
@@ -1472,8 +1468,8 @@ def forward_step(batch_iter, model):
                         ),
                     )
 
-            # Release MTP label channel after forward pass
-            mb_input.padded_mb.pop("mtp_kwargs", None)
+            # Release the MTP-only model input after the forward pass.
+            mb_input.padded_mb.pop("mtp_loss_mask", None)
 
             # Release tree attention metadata after forward pass
             for key in tree_attn_keys:
@@ -1621,7 +1617,7 @@ def _collect_mtp_loss(self, num_microbatches: int) -> float | None:
 
         Megatron-Core's ``process_mtp_loss`` accumulates the (detached) per-layer
         MTP loss across micro-batches into ``MTPLossLoggingHelper.tracker`` and
-        records the reduce/avg groups. The tracker only holds ``values`` on the
+        records the reduce/avg groups. The tracker only holds ``loss_values`` on the
         last pipeline stage (where the MTP loss is computed); other stages skip
         the reduction. The reduce step's collectives stay matched because the
         avg_group (data-parallel + context-parallel) is contained within a single
@@ -1635,13 +1631,14 @@ def _collect_mtp_loss(self, num_microbatches: int) -> float | None:
         )
 
         tracker = MTPLossLoggingHelper.tracker
-        if "values" not in tracker:
+        if "loss_values" not in tracker:
             return None
 
-        MTPLossLoggingHelper.reduce_loss_in_tracker()
-        # `values` is summed over micro-batches; normalize to a per-microbatch loss.
-        mtp_loss = tracker["values"].sum().item() / max(num_microbatches, 1)
-        MTPLossLoggingHelper.clean_loss_in_tracker()
+        MTPLossLoggingHelper.reduce_metrics_in_tracker()
+        # `loss_values` is summed over micro-batches; normalize to a
+        # per-microbatch loss.
+        mtp_loss = tracker["loss_values"].sum().item() / max(num_microbatches, 1)
+        MTPLossLoggingHelper.clean_metrics_in_tracker()
         return mtp_loss
 
     @torch.no_grad()
```

**File**: `areal/engine/megatron_utils/checkpointer.py` (modified, +1/-1)
```diff
@@ -396,7 +396,7 @@ def generate_state_dict(
             # megatron-core v0.14+ removed flattened_range support (Megatron-LM
             # PR #2126), but the sharded_state_dict default
             # (fully_sharded_model_space) still emits it, so saving optimizer
-            # state fails on the pinned 0.17.0. dp_reshardable is upstream's
+            # state fails on the pinned 0.19.0. dp_reshardable is upstream's
             # current default. Trade-off: the optimizer state (not the model
             # weights) becomes reshardable only along DP -- load hard-asserts
             # the same bucket layout (per_bucket_numel_unpadded), so save and
```

**File**: `areal/engine/megatron_utils/megatron_bridge_patches.py` (removed, +0/-345)
```diff
@@ -1,345 +0,0 @@
-# SPDX-License-Identifier: Apache-2.0
-
-"""Runtime patches for megatron-bridge bugs not yet in a released version.
-
-Each patch is keyed to an upstream PR. Patches are not version-gated; instead
-each one's hot path becomes a no-op once the upstream fix is present (the patch
-checks for the missing attribute/behavior before acting), and an idempotency
-sentinel prevents double-application. Apply patches at import time via
-``_apply_patches_on_import()`` at module bottom.
-"""
-
-from __future__ import annotations
-
-import contextvars
-import inspect
-
-import areal.utils.logging as logging
-
-logger = logging.getLogger("MegatronBridgePatches")
-
-# Carry the per-forward MTP labels and loss mask from ``GPTModel.forward``
-# (where the caller passes ``mtp_kwargs``) down to ``process_mtp_loss`` (invoked
-# inside ``_postprocess``) without touching the long forward signature.
-# ContextVars are PP/recompute-safe: each rank-process has its own values and the
-# forward call is synchronous, so set/read/reset stay paired within one forward.
-_MTP_TRAIN_LABELS: contextvars.ContextVar = contextvars.ContextVar(
-    "areal_mtp_train_labels", default=None
-)
-_MTP_TRAIN_LOSS_MASK: contextvars.ContextVar = contextvars.ContextVar(
-    "areal_mtp_train_loss_mask", default=None
-)
-
-
-def _wrap_forward_for_mtp_kwargs(model_cls) -> None:
-    """Patch ``model_cls.forward`` to pop/consume ``mtp_kwargs``.
-
-    Stashes ``mtp_kwargs["mtp_labels"]`` and ``mtp_loss_mask`` into paired
-    ContextVars for the duration of the call so the (separately patched)
-    module-level ``process_mtp_loss`` can pick them up inside ``_postprocess``,
-    then calls the original ``forward`` with ``mtp_kwargs`` stripped out
-    (the original signature never declares it).
-    """
-    _orig_forward = model_cls.forward
-
-    def _patched_forward(self, *args, **kwargs):
-        mtp_kwargs = kwargs.pop("mtp_kwargs", None)
-        mtp_labels = mtp_kwargs.get("mtp_labels") if mtp_kwargs else None
-        mtp_loss_mask = mtp_kwargs.get("mtp_loss_mask") if mtp_kwargs else None
-        # Multimodal wrappers pass precomputed decoder_input and deliberately
-        # set language_model.input_ids=None. MCore still needs token IDs inside
-        # the MTP block to build the shifted token embeddings, so restore the
-        # layout-aligned IDs from the independent MTP channel in that case.
-        if (
-            mtp_labels is not None
-            and "input_ids" in kwargs
-            and kwargs["input_ids"] is None
-        ):
-            kwargs["input_ids"] = mtp_labels
-        labels_token = _MTP_TRAIN_LABELS.set(mtp_labels)
-        mask_token = _MTP_TRAIN_LOSS_MASK.set(mtp_loss_mask)
-        try:
-            return _orig_forward(self, *args, **kwargs)
-        finally:
-            _MTP_TRAIN_LOSS_MASK.reset(mask_token)
-            _MTP_TRAIN_LABELS.reset(labels_token)
-
-    model_cls.forward = _patched_forward
-
-
-def _patch_qwen3vl_pr3143_word_embeddings() -> None:
-    """megatron-bridge PR #3143: expose word_embeddings on MTP shadow embedding.
-
-    Bug (issue #3112 / PR #3143): in ``Qwen3VLGPTModel.forward``, when
-    ``mtp_process and sequence_parallel`` are both True, ``self.embedding`` is
-    temporarily replaced with a plain closure ``_sp_scatter_embedding``. The
-    closure lacks the ``word_embeddings`` attribute that
-    ``shared_embedding_or_output_weight()`` accesses during ``_postprocess``
-    when ``share_embeddings_and_output_weights=True`` — typical for the
-    smaller Qwen3.5 dense models (0.8B/2B/4B).
-
-    Failure mode:
-        ``AttributeError: 'function' object has no attribute 'word_embeddings'``
-
-    Affected versions: megatron-bridge 0.4.0 and 0.4.1. Fixed on ``main``
-    by commit 20749b09 (PR #3143) but not in any non-alpha release yet.
-
-    Strategy: wrap ``Qwen3VLGPTModel._postprocess`` so it lazily restores
-    ``word_embeddings`` on the shadow embedding by inspecting its closure.
-    Closure-based recovery is non-invasive — we don't touch ``forward``
-    itself (~70 LoC method).
-    """
-    try:
-        from megatron.bridge.models.qwen_vl.modelling_qwen3_vl.text_model import (
-            Qwen3VLGPTModel,
-        )
-    except ImportError:
-        return
-
-    if getattr(Qwen3VLGPTModel, "_areal_pr3143_applied", False):
-        return
-
-    _orig_postprocess = Qwen3VLGPTModel._postprocess
-
-    def _patched_postprocess(self, *args, **kwargs):
-        emb = self.__dict__.get("embedding")
-        # Only intervene when the shadow closure is currently installed and
-        # lacks the expected attribute.
-        if (
-            callable(emb)
-            and not hasattr(emb, "word_embeddings")
-            and emb.__closure__ is not None
-        ):
-            for cell in emb.__closure__:
-                try:
-                    target = cell.cell_contents
-                except ValueError:
-                    continue
-                if has
```

**File**: `areal/engine/megatron_utils/packed_context_parallel.py` (modified, +35/-46)
```diff
@@ -391,77 +391,60 @@ def _build_thd_packed_seq_params(
     )
 
 
-def _prepare_mtp_forward_kwargs(
-    mtp_kwargs: dict[str, Any],
+def _prepare_mtp_loss_mask(
+    loss_mask: torch.Tensor,
     input_ids: torch.Tensor,
     attention_mask: torch.Tensor | None,
     *,
     cu_seqlens: torch.Tensor | None,
     packed_num_tokens: int,
     uses_padded_form: bool,
     uses_model_packed_seq: bool,
-) -> dict[str, torch.Tensor]:
-    """Align packed MTP labels and masks with the model's execution layout."""
-    labels = mtp_kwargs.get("mtp_labels")
-    loss_mask = mtp_kwargs.get("mtp_loss_mask")
-    if labels is None or loss_mask is None:
-        raise ValueError("MTP training requires both mtp_labels and mtp_loss_mask.")
-    if labels.shape != loss_mask.shape:
-        raise ValueError(
-            "MTP labels and loss mask must have identical shapes, got "
-            f"{labels.shape} and {loss_mask.shape}."
-        )
+) -> torch.Tensor:
+    """Align MTP supervision with the model's execution layout.
 
+    MCore 0.19 derives MTP labels from the layout-aligned ``input_ids`` and
+    accepts ``loss_mask`` directly. AReaL therefore only needs to apply the
+    same padding or context-parallel partition to the mask.
+    """
     if cu_seqlens is None:
-        if labels.numel() != input_ids.numel():
+        if loss_mask.numel() != input_ids.numel():
             raise ValueError(
-                "MTP labels must contain one value per input token, got "
-                f"{labels.numel()} labels for {input_ids.numel()} tokens."
+                "MTP loss mask must contain one value per input token, got "
+                f"{loss_mask.numel()} values for {input_ids.numel()} tokens."
             )
-        return {
-            "mtp_labels": labels.reshape(input_ids.shape).contiguous(),
-            "mtp_loss_mask": loss_mask.reshape(input_ids.shape).contiguous(),
-        }
+        return loss_mask.reshape(input_ids.shape).contiguous()
 
-    if labels.ndim != 1:
+    if loss_mask.ndim != 1:
         raise ValueError(
-            "MTP labels and loss mask must enter packed sequence-layout conversion "
-            f"as 1-D tensors, got {labels.shape=} and {loss_mask.shape=}."
+            "MTP loss mask must enter packed sequence-layout conversion as a "
+            f"1-D tensor, got {loss_mask.shape=}."
         )
 
-    if labels.numel() != packed_num_tokens:
+    if loss_mask.numel() != packed_num_tokens:
         raise ValueError(
-            "MTP labels must match the packed sequence length, got "
-            f"{labels.numel()} labels for {packed_num_tokens} tokens."
+            "MTP loss mask must match the packed sequence length, got "
+            f"{loss_mask.numel()} values for {packed_num_tokens} tokens."
         )
 
     if uses_padded_form and not uses_model_packed_seq:
         if attention_mask is None:
             raise ValueError("Padded MTP training requires a 2-D validity mask.")
-        padded_labels = torch.zeros_like(input_ids)
         padded_loss_mask = torch.zeros(
             input_ids.shape,
             dtype=loss_mask.dtype,
             device=loss_mask.device,
         )
-        padded_labels[attention_mask] = labels
         padded_loss_mask[attention_mask] = loss_mask
-        return {
-            "mtp_labels": padded_labels,
-            "mtp_loss_mask": padded_loss_mask,
-        }
+        return padded_loss_mask
 
     # Packed context parallelism assigns each rank two zigzag chunks per
     # sequence. Apply the exact same mapping used for input_ids so every local
     # hidden state keeps its token-aligned MTP target and validity mask. MCore's
     # roll_tensor subsequently uses cp_group and packed_seq_params to exchange
     # future-token boundaries across CP ranks.
-    labels = split_packed_seqs_for_context_parallel(labels, cu_seqlens)
     loss_mask = split_packed_seqs_for_context_parallel(loss_mask, cu_seqlens)
-    return {
-        "mtp_labels": labels.unsqueeze(0).contiguous(),
-        "mtp_loss_mask": loss_mask.unsqueeze(0).contiguous(),
-    }
+    return loss_mask.unsqueeze(0).contiguous()
 
 
 def packed_context_parallel_forward(
@@ -562,20 +545,26 @@ def packed_context_parallel_forward(
             if key in input_:
                 vlm_kwargs[key] = input_[key]
 
-    # MTP training: convert the independent label and mask channels to the
-    # exact layout used by this forward. MCore rolls both once per MTP layer;
-    # keeping them aligned prevents cross-sequence targets and masks padding
-    # or unavailable future-token positions.
+    # For BSHD text-only, drop the packed-form position_ids (a 1D tensor of
+    # length total_len) — they don't match the 2D [B, S] input. Let mcore
+    # compute the default torch.arange positions per row; padding positions
+    # are masked out by attention_mask.
+    if dense_mask_text_forward:
+        position_ids = None
+
+    # MTP training: convert the supervision mask to the exact la
```

---

### Incident Patch 5: `3c4be16b` (2026-09-22)
**Commit Message**: fix(examples): complete Arena metrics and generation defaults (#1746)

* feat: report Arena turn and harness outcome metrics

Record generated-turn distributions and bounded harness outcome rates
for exported episodes so rollout quality changes can be diagnosed.
Keep reward assignment and failure attribution unchanged.

* feat: complete Arena rollout observability

Link exported interactions to Arena tasks and proxy sessions. Report
attempted-group quality by task type and stream while retaining existing
metric names. Tolerate missing measurements and invalid optional metadata
without fabricating rewards or changing failure attribution.

* fix(examples): forward Arena generation defaults

* test: remove follow-up unit test additions

**File**: `areal/experimental/openai/proxy/workflow.py` (modified, +153/-8)
```diff
@@ -5,17 +5,20 @@
 import asyncio
 import atexit
 import inspect
+import json
 import os
 import threading
 from concurrent.futures import ProcessPoolExecutor
 from typing import TYPE_CHECKING, Any, Literal
 
 import aiohttp
+import torch
 
 from areal.api import RolloutWorkflow
 from areal.infra import workflow_context
 from areal.utils import logging, stats_tracker
 from areal.utils.perf_tracer import session_context, trace_session
+from areal.utils.stats_tracker import DistributedStatsTracker, ReduceType
 
 from .client_session import OpenAIProxyClient, post_json
 from .server import (
@@ -36,6 +39,17 @@
 logger = logging.getLogger("OpenAIProxyWorkflow")
 
 
+HARNESS_OUTCOME_METRIC_CODES = frozenset(
+    {
+        "AGENT_MAX_TURNS_EXCEEDED",
+        "AGENT_RUN_TIMEOUT",
+        "AUTONOMOUS_INCOMPLETE_NO_SHIP",
+        "GAMEAGENT_RUN_FAILED",
+        "LLM_RESPONSE_FAILED",
+        "LLM_RESPONSE_TIMEOUT",
+    }
+)
+
 AgentFailureDisposition = Literal[
     "model_failure_zero",
     "system_failure_reject",
@@ -212,13 +226,51 @@ def record_group_metrics(
     def record_episode_metrics(
         self,
         data: dict[str, Any],
-        reward: float,
+        reward: float | None,
     ) -> None:
         """Delegate optional episode metrics after interactions are exported."""
+        if reward is None:
+            return
         recorder = getattr(self.agent, "record_episode_metrics", None)
         if callable(recorder):
             recorder(data, reward)
 
+    async def _get_agent_episode_metadata(self) -> dict[str, Any]:
+        """Collect bounded audit metadata from an optional agent hook."""
+
+        getter = getattr(self.agent, "get_episode_metadata", None)
+        if not callable(getter):
+            return {}
+        try:
+            metadata = getter()
+            if inspect.isawaitable(metadata):
+                metadata = await metadata
+            if not isinstance(metadata, dict):
+                raise TypeError("get_episode_metadata must return a dict")
+            if not all(isinstance(key, str) for key in metadata):
+                raise TypeError("get_episode_metadata keys must be strings")
+            json.dumps(metadata, allow_nan=False)
+            return metadata
+        except Exception:
+            logger.warning(
+                "Failed to collect optional agent episode metadata.",
+                exc_info=True,
+            )
+            return {}
+
+    @staticmethod
+    def _stamp_interaction_metadata(
+        interactions: dict[str, InteractionWithTokenLogpReward],
+        metadata: dict[str, Any],
+    ) -> None:
+        """Attach episode identifiers to every exported trajectory branch."""
+
+        for interaction in interactions.values():
+            interaction.metadata = {
+                **(interaction.metadata or {}),
+                **metadata,
+            }
+
     async def _call_agent_hook(self, name: str, *args: Any, **kwargs: Any) -> None:
         """Call an optional agent lifecycle hook without blocking the event loop."""
 
@@ -328,6 +380,88 @@ def _set_individual_rollout_reward(
             last = interactions[next(reversed(interactions))]
             last.rollout_reward = last.reward
 
+    @staticmethod
+    def _record_turn_distribution(
+        tracker: DistributedStatsTracker,
+        metric: str,
+        num_turns: int,
+        *,
+        include: bool = True,
+    ) -> None:
+        """Record average, minimum, and maximum turns for one sample."""
+        values = torch.tensor([float(num_turns)], dtype=torch.float32)
+        denominator = f"{metric}_count"
+        tracker.denominator(
+            **{
+                denominator: torch.full_like(
+                    values,
+                    include,
+                    dtype=torch.bool,
+                )
+            }
+        )
+        tracker.stat(
+            denominator,
+            reduce_type=ReduceType.AVG_MIN_MAX,
+            **{metric: values},
+        )
+
+    @staticmethod
+    def _record_interaction_stats(
+        interactions: dict[str, InteractionWithTokenLogpReward],
+        *,
+        is_harness_error: bool = False,
+        harness_outcome_code: str | None = None,
+    ) -> None:
+        """Record terminal reward and turns in the last exported interaction.
+
+        Concat exports contain cumulative turns; individual exports describe
+        only their final sequence. Episodes without usable exports are absent.
+        """
+        if not interactions:
+            return
+
+        interaction = interactions[next(reversed(interactions))]
+        tracker = stats_tracker.get(workflow_context.stat_scope())
+        if interaction.reward is not None:
+            tracker.scalar(reward=interaction.reward)
+        if interaction.has_tensor_data:
+            try:
+                turn_ids = interaction.to_tensor_dict().get("turn_ids")
+            except Exception:
+                logger.warning("Could not read tu
```

**File**: `examples/swe/arena_agent.py` (modified, +87/-1)
```diff
@@ -30,6 +30,7 @@
 from examples.swe.arena_config import load_arena_stream_configs
 from examples.swe.arena_types import ArenaStreamConfig
 
+from areal.experimental.openai.proxy.workflow import HARNESS_OUTCOME_METRIC_CODES
 from areal.infra import workflow_context
 from areal.utils import logging, stats_tracker
 from areal.utils.dynamic_import import import_from_string
@@ -49,6 +50,7 @@
         "LLM_RESPONSE_TIMEOUT",
     }
 )
+_GAMEAGENT_OUTCOME_METRIC_CODES = tuple(sorted(HARNESS_OUTCOME_METRIC_CODES))
 _WORKER_GATEWAY_REGISTRY_ATTR = "_arena_session_gateway_registry_v1"
 _WORKER_GATEWAY_CLEANUP_KEY = "arena-session-gateway-registrations"
 
@@ -58,7 +60,12 @@ def _record_arena_metrics(**metrics: float) -> None:
 
 
 def _record_arena_domain_reward(reward: float, arena_task_type: str) -> None:
-    _record_arena_metrics(**{f"{arena_task_type}/reward": float(reward)})
+    _record_arena_metrics(
+        **{
+            f"{arena_task_type}/reward": float(reward),
+            f"domain/{arena_task_type}/reward": float(reward),
+        }
+    )
 
 
 @dataclass
@@ -508,6 +515,9 @@ def __init__(
         self._task_result_dumped: ContextVar[bool] = ContextVar(
             "arena_task_result_dumped", default=False
         )
+        self._proxy_session_id: ContextVar[str] = ContextVar(
+            "arena_proxy_session_id", default=""
+        )
         self.result_dump_dir = str(
             self.econfig.get("arena_result_dump_dir", "") or ""
         ).strip()
@@ -547,6 +557,14 @@ def record_group_metrics(
             reward is not None and self._is_solved_reward(reward, stream_config)
             for reward in rewards
         )
+        group_quality = {
+            "all_correct": float(pass_count == group_size),
+            "all_wrong": float(pass_count == 0),
+            **{
+                f"group_pass_count_{count}_ratio": float(count == pass_count)
+                for count in range(group_size + 1)
+            },
+        }
         group_pass_distribution = {
             f"group_pass_{count}": float(count == pass_count)
             for count in range(group_size + 1)
@@ -557,6 +575,16 @@ def record_group_metrics(
                 f"{arena_task_type}/pass@k": float(pass_count > 0),
                 f"stream/{stream_config.name}/pass@k": float(pass_count > 0),
                 **group_pass_distribution,
+                **group_quality,
+                **{
+                    f"{prefix}/{name}": value
+                    for prefix in (
+                        f"domain/{arena_task_type}",
+                        f"stream/{stream_config.name}",
+                    )
+                    for name, value in group_quality.items()
+                },
+                f"domain/{arena_task_type}/pass@k": float(pass_count > 0),
             }
         )
 
@@ -583,6 +611,13 @@ def _gameagent_outcome_code(raw: Any) -> str | None:
         marker = _GAMEAGENT_OUTCOME_CODE_PATTERN.search(detail)
         return marker.group(1) if marker is not None else None
 
+    @classmethod
+    def _gameagent_outcome_metric_code(cls, raw: Any) -> str:
+        """Normalize Harness outcomes to the bounded metric cardinality."""
+
+        code = cls._gameagent_outcome_code(raw)
+        return code if code in HARNESS_OUTCOME_METRIC_CODES else "OTHER"
+
     @classmethod
     def _is_model_attributed_harness_failure(cls, error: ArenaTaskFailedError) -> bool:
         """Recognize explicit, allowlisted Harness model-failure outcomes."""
@@ -648,6 +683,20 @@ def record_episode_metrics(
             "training_score": float(reward),
             f"stream/{stream_config.name}/training_score": float(reward),
         }
+        is_harness_error = result is not None and result.status == "HARNESS_FAILED"
+        is_harness_success = result is not None and result.status in {"DONE", "OK"}
+        outcome_code = (
+            self._gameagent_outcome_metric_code(result.raw)
+            if is_harness_error and result is not None
+            else None
+        )
+        metrics["harness_success"] = float(is_harness_success)
+        metrics["harness_error"] = float(is_harness_error)
+        for code in _GAMEAGENT_OUTCOME_METRIC_CODES:
+            metrics[f"harness_error/{code}"] = float(outcome_code == code)
+        metrics["harness_error/OTHER"] = float(
+            is_harness_error and outcome_code not in _GAMEAGENT_OUTCOME_METRIC_CODES
+        )
         if result is not None and result.score is not None:
             metrics.update(
                 {
@@ -656,6 +705,7 @@ def record_episode_metrics(
                     # never the heterogeneous Arena ``raw`` object.
                     "raw_reward": result.score,
                     f"{arena_task_type}/raw_reward": result.score,
+                    f"domain/{arena_task_type}/raw_reward": result.score,
                     "arena_raw_present": float(result.raw is not None),
                     "arena_trace_present": float(result.trace_id is not None),

```

**File**: `examples/swe/train_swe_rl.py` (modified, +2/-0)
```diff
@@ -337,6 +337,8 @@ def resolve_path(p: str) -> str:
         econfig=econfig_dict,
         gen_args=dict(
             temperature=config.gconfig.temperature,
+            top_p=config.gconfig.top_p,
+            top_k=config.gconfig.top_k,
             max_completion_tokens=config.gconfig.max_new_tokens,
         ),
         timeout=econfig.timeout,
```

---

### Incident Patch 6: `a00e8c22` (2026-09-22)
**Commit Message**: fix(reward): complete PRM fallback and tool-result status handling (#1747)

* feat(reward): configure PRM export failure policy

* fix(proxy): preserve explicit tool-result success status

* fix(reward): guard v1 fallback policy after PRM refactor

* test: remove follow-up unit test additions

**File**: `areal/api/cli_args.py` (modified, +12/-0)
```diff
@@ -2621,6 +2621,18 @@ class PRMConfig:
         metadata={"help": "Process-reward scorers whose weighted outputs are summed."},
     )
 
+    error_policy: str = field(
+        default="reject",
+        metadata={
+            "help": "On v1 proxy PRM errors: reject the trajectory or keep pre-scoring rewards.",
+            "choices": ["reject", "keep_original"],
+        },
+    )
+
+    def __post_init__(self) -> None:
+        if self.error_policy not in {"reject", "keep_original"}:
+            raise ValueError("PRM error_policy must be reject or keep_original")
+
 
 @dataclass
 class AgentConfig:
```

**File**: `areal/experimental/openai/proxy/proxy_rollout_server.py` (modified, +32/-14)
```diff
@@ -37,7 +37,7 @@
 from areal.infra.processor_cache import ProcessorCacheRegistry
 from areal.infra.rpc.serialization import deserialize_value, serialize_value
 from areal.infra.utils.http import validate_admin_api_key
-from areal.utils import name_resolve, names, seeding
+from areal.utils import name_resolve, names, seeding, stats_tracker
 from areal.utils.dynamic_import import import_from_string
 from areal.utils.hf_utils import load_hf_processor_and_tokenizer
 from areal.utils.logging import getLogger
@@ -1180,9 +1180,11 @@ async def responses(
     )
 
 
-def _anthropic_tool_error_ids(anthropic_request: dict[str, Any]) -> set[str]:
-    """Return IDs of Anthropic tool results explicitly marked as errors."""
-    failed_ids: set[str] = set()
+def _anthropic_tool_result_statuses(
+    anthropic_request: dict[str, Any],
+) -> dict[str, bool]:
+    """Preserve explicit success and error states without inferring missing flags."""
+    statuses: dict[str, bool] = {}
     for message in anthropic_request.get("messages") or []:
         content = message.get("content") if isinstance(message, Mapping) else None
         if not isinstance(content, list):
@@ -1191,11 +1193,11 @@ def _anthropic_tool_error_ids(anthropic_request: dict[str, Any]) -> set[str]:
             if (
                 isinstance(block, Mapping)
                 and block.get("type") == "tool_result"
-                and block.get("is_error")
+                and isinstance(block.get("is_error"), bool)
                 and block.get("tool_use_id")
             ):
-                failed_ids.add(str(block["tool_use_id"]))
-    return failed_ids
+                statuses[str(block["tool_use_id"])] = block["is_error"]
+    return statuses
 
 
 def _translate_anthropic_to_openai_request(anthropic_request: dict[str, Any]) -> dict:
@@ -1206,15 +1208,15 @@ def _translate_anthropic_to_openai_request(anthropic_request: dict[str, Any]) ->
         raise ValueError("Failed to translate request")
     openai_request = dict(openai_request)
 
-    failed_ids = _anthropic_tool_error_ids(anthropic_request)
-    if failed_ids:
+    statuses = _anthropic_tool_result_statuses(anthropic_request)
+    if statuses:
         for message in openai_request.get("messages") or []:
             if (
                 isinstance(message, dict)
                 and message.get("role") == "tool"
-                and message.get("tool_call_id") in failed_ids
+                and message.get("tool_call_id") in statuses
             ):
-                message["is_error"] = True
+                message["is_error"] = statuses[message["tool_call_id"]]
 
     return openai_request
 
@@ -1430,10 +1432,26 @@ async def export_trajectories(
                 is_eval=request.is_eval,
             )
         except Exception:
-            logger.exception(
-                "PRM runner failed for session %s; rejecting trajectory", session_id
+            if _prm_runner.config.error_policy == "keep_original":
+                logger.exception(
+                    "PRM runner failed for session %s; keeping pre-scoring rewards",
+                    session_id,
+                )
+                stats_tracker.get(
+                    "eval-rollout" if request.is_eval else "rollout"
+                ).scalar(prm_fallback=1.0)
+            else:
+                logger.exception(
+                    "PRM runner failed for session %s; rejecting trajectory", session_id
+                )
+                interactions = {}
+                stats_tracker.get(
+                    "eval-rollout" if request.is_eval else "rollout"
+                ).scalar(prm_fallback=0.0)
+        else:
+            stats_tracker.get("eval-rollout" if request.is_eval else "rollout").scalar(
+                prm_fallback=0.0
             )
-            interactions = {}
 
     # Remove session from cache and clean up API key mapping
     with _lock:
```

**File**: `areal/v2/inference_service/data_proxy/config.py` (modified, +4/-0)
```diff
@@ -34,6 +34,10 @@ class DataProxyConfig:
     prm: PRMConfig = field(default_factory=PRMConfig)
 
     def __post_init__(self) -> None:
+        if self.prm.enabled and self.prm.scorers and self.prm.error_policy != "reject":
+            raise ValueError(
+                "PRM keep_original error policy is only supported by the v1 proxy"
+            )
         if (
             self.prm.enabled
             and self.prm.scorers
```

**File**: `docs/en/cli_reference.md` (modified, +6/-5)
```diff
@@ -1328,11 +1328,12 @@ Control how direct process signals modify outcome advantages.
 
 Process-reward scoring and advantage shaping for agent rollouts.
 
-| Parameter           | Type                                                         | Default                     | Description                                                                                 |
-| ------------------- | ------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------- |
-| `enabled`           | boolean                                                      | `True`                      | Enable process rewards when scorers are configured. An empty scorer list is always a no-op. |
-| `advantage_shaping` | [`PRMAdvantageShapingConfig`](section-prm-advantage-shaping) | *PRMAdvantageShapingConfig* | How direct process signals are combined with outcome advantages.                            |
-| `scorers`           | list of [`PRMScorerConfig`](section-prm-scorer)              | `[]`                        | Process-reward scorers whose weighted outputs are summed.                                   |
+| Parameter           | Type                                                         | Default                     | Description                                                                                                       |
+| ------------------- | ------------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
+| `enabled`           | boolean                                                      | `True`                      | Enable process rewards when scorers are configured. An empty scorer list is always a no-op.                       |
+| `advantage_shaping` | [`PRMAdvantageShapingConfig`](section-prm-advantage-shaping) | *PRMAdvantageShapingConfig* | How direct process signals are combined with outcome advantages.                                                  |
+| `scorers`           | list of [`PRMScorerConfig`](section-prm-scorer)              | `[]`                        | Process-reward scorers whose weighted outputs are summed.                                                         |
+| `error_policy`      | string                                                       | `"reject"`                  | On v1 proxy PRM errors: reject the trajectory or keep pre-scoring rewards. **Choices:** `reject`, `keep_original` |
 
 (section-prm-scorer)=
 
```

**File**: `docs/zh/cli_reference.md` (modified, +6/-5)
```diff
@@ -1326,11 +1326,12 @@ Control how direct process signals modify outcome advantages.
 
 Process-reward scoring and advantage shaping for agent rollouts.
 
-| Parameter           | Type                                                         | Default                     | Description                                                                                 |
-| ------------------- | ------------------------------------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------- |
-| `enabled`           | boolean                                                      | `True`                      | Enable process rewards when scorers are configured. An empty scorer list is always a no-op. |
-| `advantage_shaping` | [`PRMAdvantageShapingConfig`](section-prm-advantage-shaping) | *PRMAdvantageShapingConfig* | How direct process signals are combined with outcome advantages.                            |
-| `scorers`           | list of [`PRMScorerConfig`](section-prm-scorer)              | `[]`                        | Process-reward scorers whose weighted outputs are summed.                                   |
+| Parameter           | Type                                                         | Default                     | Description                                                                                                       |
+| ------------------- | ------------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
+| `enabled`           | boolean                                                      | `True`                      | Enable process rewards when scorers are configured. An empty scorer list is always a no-op.                       |
+| `advantage_shaping` | [`PRMAdvantageShapingConfig`](section-prm-advantage-shaping) | *PRMAdvantageShapingConfig* | How direct process signals are combined with outcome advantages.                                                  |
+| `scorers`           | list of [`PRMScorerConfig`](section-prm-scorer)              | `[]`                        | Process-reward scorers whose weighted outputs are summed.                                                         |
+| `error_policy`      | string                                                       | `"reject"`                  | On v1 proxy PRM errors: reject the trajectory or keep pre-scoring rewards. **Choices:** `reject`, `keep_original` |
 
 (section-prm-scorer)=
 
```

---

### Incident Patch 7: `379abffe` (2026-09-22)
**Commit Message**: fix(examples): reject generic GameAgent response failures (#1748)

* fix(examples): reject generic GameAgent response failures

Remove LLM_RESPONSE_FAILED from the model-failure recovery allowlist.
Generic upstream and stream failures must not become zero-reward
training samples solely because this outcome code is present.

Preserve independent context-overflow and legacy agent-failure rules.

* test: remove follow-up unit test additions

**File**: `examples/swe/arena_agent.py` (modified, +0/-1)
```diff
@@ -46,7 +46,6 @@
         "AGENT_MAX_TURNS_EXCEEDED",
         "AGENT_RUN_TIMEOUT",
         "AUTONOMOUS_INCOMPLETE_NO_SHIP",
-        "LLM_RESPONSE_FAILED",
         "LLM_RESPONSE_TIMEOUT",
     }
 )
```

**File**: `tests/test_swe_arena_multi_stream.py` (modified, +0/-1)
```diff
@@ -831,7 +831,6 @@ def test_arena_failure_classifier_keeps_explicit_claude_agent_phase_failure():
         ("AGENT_MAX_TURNS_EXCEEDED", "outcome", 2),
         ("AGENT_RUN_TIMEOUT", "outcome_code", 2),
         ("AUTONOMOUS_INCOMPLETE_NO_SHIP", "error", 2),
-        ("LLM_RESPONSE_FAILED", "outcome", 2),
         ("LLM_RESPONSE_TIMEOUT", "outcome_code", 2),
         ("LLM_RESPONSE_FAILED", "outcome", 0),
     ],
```

---

### Incident Patch 8: `caa613c9` (2026-09-21)
**Commit Message**: fix: preserve tool call IDs and message grouping in agent history (#1734)

Preserve harness-provided tool identities in DataProxy-managed history
so later agent requests receive correctly associated tool results.
Explicit message IDs retain calls from the same model reply together
without inferring reply boundaries from adjacent events.

Key changes:
- Normalize and validate structured tool events after agent execution.
- Preserve IDs through history, Responses and WebSocket output.
- Retain unambiguous legacy reporting and raw-response passthrough.
- Cover association errors, grouping and failed-turn history isolation.

Refs: #1048, #1383

Signed-off-by: 杨博 <[REDACTED_EMAIL]>

**File**: `areal/v2/agent_service/README.md` (modified, +57/-3)
```diff
@@ -71,7 +71,7 @@ class AgentRequest:
     message: str                              # Current user message
     session_key: str                          # Session identifier
     run_id: str                               # Unique run identifier
-    history: list[dict[str, str]]             # Prior conversation turns
+    history: list[dict[str, Any]]             # Prior conversation turns
     queue_mode: QueueMode = QueueMode.COLLECT
     metadata: dict[str, Any] = field(default_factory=dict)
 ```
@@ -90,10 +90,64 @@ class AgentResponse:
 ```python
 class EventEmitter(Protocol):
     async def emit_delta(self, text: str) -> None: ...
-    async def emit_tool_call(self, name: str, args: str) -> None: ...
-    async def emit_tool_result(self, name: str, result: str) -> None: ...
+    async def emit_tool_call(
+        self,
+        name: str,
+        args: str,
+        *,
+        call_id: str | None = None,
+        message_id: str | None = None,
+    ) -> None: ...
+    async def emit_tool_result(
+        self, name: str, result: str, *, call_id: str | None = None
+    ) -> None: ...
+```
+
+These methods **report** tool activity; the harness still executes tools and manages its
+own within-run model/tool loop. On the structured `AgentResponse` path, DataProxy uses
+the events to build cross-request history for agents that consume `request.history`.
+This is not the inference service's training-trajectory capture.
+
+Pass the harness's `call_id` on both the call and its result. To preserve multiple calls
+from **one assistant reply**, also pass the same `message_id` for those calls:
+
+```python
+await emitter.emit_tool_call(
+    "search", '{"q":"A"}', call_id="call-a", message_id="reply-1"
+)
+await emitter.emit_tool_call(
+    "search", '{"q":"B"}', call_id="call-b", message_id="reply-1"
+)
+# Results can arrive in either order.
+await emitter.emit_tool_result("search", "result B", call_id="call-b")
+await emitter.emit_tool_result("search", "result A", call_id="call-a")
 ```
 
+The next request's history contains **one** assistant message with both tool calls,
+followed by the two tool results in their reported order. Call IDs are preserved in the
+Worker's events, history (`id` / `tool_call_id`), Responses output (`call_id`), and
+WebSocket tool-call events (`toolCall.callId`).
+
+- IDs are opaque, non-empty strings. Call IDs must be unique within a run. Each
+  assistant reply must have its own message ID within that run; a harness can assign
+  local reply IDs if its SDK does not provide them.
+- Emit all calls for a message before its results or calls from another message. A
+  message group cannot be reopened across either boundary. Text deltas do not define
+  message boundaries and are not reconstructed as intermediate assistant messages.
+- Both new arguments are optional. Existing two-argument serial reporting still works:
+  the Worker generates missing call IDs and matches a result without an ID only when
+  exactly one same-name call is pending. Without `message_id`, each call remains a
+  separate assistant message; adjacent calls are never implicitly grouped.
+- For structured responses, unknown/duplicate IDs, mismatched tool names, ambiguous
+  results and reopened groups fail the turn with a structured Worker error (HTTP 500).
+  Validation happens after `run` returns. DataProxy leaves prior history unchanged,
+  including not appending the failed turn's user message. The service does not retry the
+  agent: tools may already have caused side effects.
+- Call-only reporting remains supported for observability, but a partial event log is
+  not necessarily a replayable conversation. Agents relying on managed history should
+  report all calls and results. Raw `StreamResponse` turns bypass this normalization and
+  keep no DataProxy history.
+
 ## HTTP APIs
 
 ### Router
```

**File**: `areal/v2/agent_service/data_proxy/app.py` (modified, +25/-26)
```diff
@@ -223,46 +223,45 @@ async def _relay():
             # Worker reported an error; forward it without touching history.
             return JSONResponse(result, status_code=status_code)
 
-        session.history.append({"role": "user", "content": message})
-
-        call_counter = 0
+        # The Worker has normalized IDs and validated explicit message groups.
+        # Stage this turn before modifying the saved cross-request history.
+        new_messages: list[dict[str, Any]] = [{"role": "user", "content": message}]
+        tool_messages: dict[str, dict[str, Any]] = {}
         for evt in result.get("events", []):
             if evt.get("type") == "tool_call":
-                call_id = f"call_{evt.get('name', '')}_{run_id}_{call_counter}"
-                call_counter += 1
-                session.history.append(
-                    {
+                call = {
+                    "id": evt["call_id"],
+                    "type": "function",
+                    "function": {
+                        "name": evt.get("name", ""),
+                        "arguments": evt.get("args", ""),
+                    },
+                }
+                message_id = evt.get("message_id")
+                if message_id is not None and message_id in tool_messages:
+                    tool_messages[message_id]["tool_calls"].append(call)
+                else:
+                    tool_message = {
                         "role": "assistant",
                         "content": None,
-                        "tool_calls": [
-                            {
-                                "id": call_id,
-                                "type": "function",
-                                "function": {
-                                    "name": evt.get("name", ""),
-                                    "arguments": evt.get("args", ""),
-                                },
-                            }
-                        ],
+                        "tool_calls": [call],
                     }
-                )
+                    new_messages.append(tool_message)
+                    if message_id is not None:
+                        tool_messages[message_id] = tool_message
             elif evt.get("type") == "tool_result":
-                result_call_id = (
-                    f"call_{evt.get('name', '')}_{run_id}_{call_counter - 1}"
-                    if call_counter > 0
-                    else f"call_{evt.get('name', '')}_{run_id}_0"
-                )
-                session.history.append(
+                new_messages.append(
                     {
                         "role": "tool",
-                        "tool_call_id": result_call_id,
+                        "tool_call_id": evt["call_id"],
                         "content": evt.get("result", ""),
                     }
                 )
 
         summary = result.get("summary", "")
         if summary:
-            session.history.append({"role": "assistant", "content": summary})
+            new_messages.append({"role": "assistant", "content": summary})
+        session.history.extend(new_messages)
 
         session.last_active = time.monotonic()
         return JSONResponse(result, status_code=status_code)
```

**File**: `areal/v2/agent_service/gateway/app.py` (modified, +1/-0)
```diff
@@ -181,6 +181,7 @@ async def websocket_endpoint(websocket: WebSocket, token: str = Query(default=""
                                         run_id,
                                         evt.get("name", ""),
                                         evt.get("args", ""),
+                                        call_id=evt.get("call_id"),
                                     )
                                 )
                             )
```

**File**: `areal/v2/agent_service/gateway/bridge.py` (modified, +8/-7)
```diff
@@ -195,13 +195,14 @@ def _build_output_items(result: dict[str, Any]) -> list[dict[str, Any]]:
             )
         for evt in result.get("events", []):
             if evt.get("type") == "tool_call":
-                output_items.append(
-                    {
-                        "type": "function_call",
-                        "name": evt.get("name", ""),
-                        "arguments": evt.get("args", ""),
-                    }
-                )
+                item = {
+                    "type": "function_call",
+                    "name": evt.get("name", ""),
+                    "arguments": evt.get("args", ""),
+                }
+                if evt.get("call_id") is not None:
+                    item["call_id"] = evt["call_id"]
+                output_items.append(item)
         return output_items
 
     @staticmethod
```

**File**: `areal/v2/agent_service/protocol.py` (modified, +11/-2)
```diff
@@ -304,13 +304,22 @@ def make_delta_event(run_id: str, delta: str) -> EventFrame:
     )
 
 
-def make_tool_call_event(run_id: str, tool_name: str, tool_args: str) -> EventFrame:
+def make_tool_call_event(
+    run_id: str,
+    tool_name: str,
+    tool_args: str,
+    *,
+    call_id: str | None = None,
+) -> EventFrame:
     """Create a tool call streaming event."""
+    tool_call = {"name": tool_name, "args": tool_args}
+    if call_id is not None:
+        tool_call["callId"] = call_id
     return EventFrame(
         event="agent",
         payload={
             "runId": run_id,
-            "toolCall": {"name": tool_name, "args": tool_args},
+            "toolCall": tool_call,
         },
     )
 
```

**File**: `areal/v2/agent_service/types.py` (modified, +37/-3)
```diff
@@ -79,11 +79,45 @@ class StreamResponse:
 
 
 class EventEmitter(Protocol):
-    """Callback interface for streaming events from agent to caller."""
+    """Report events for callers and optional DataProxy-managed history.
+
+    Tool execution remains the harness's responsibility. On structured turns,
+    the Worker validates tool associations after ``run`` returns; raw
+    :class:`StreamResponse` turns ignore collected events.
+    """
 
     async def emit_delta(self, text: str) -> None: ...
-    async def emit_tool_call(self, name: str, args: str) -> None: ...
-    async def emit_tool_result(self, name: str, result: str) -> None: ...
+
+    async def emit_tool_call(
+        self,
+        name: str,
+        args: str,
+        *,
+        call_id: str | None = None,
+        message_id: str | None = None,
+    ) -> None:
+        """Report a call, preserving the harness's ID when supplied.
+
+        ``call_id`` must be unique within this run. Calls from the same model
+        reply should share a ``message_id`` (unique per reply within the run)
+        and be emitted before that reply's tool results. Without a message ID,
+        each call remains a separate assistant message; no grouping is inferred.
+        """
+        ...
+
+    async def emit_tool_result(
+        self,
+        name: str,
+        result: str,
+        *,
+        call_id: str | None = None,
+    ) -> None:
+        """Report a result for a prior call with the same ID and tool name.
+
+        Without ``call_id``, exactly one same-name call must still be pending.
+        Missing call IDs are generated by the Worker, not returned by emitters.
+        """
+        ...
 
 
 @runtime_checkable
```

**File**: `areal/v2/agent_service/worker/app.py` (modified, +32/-6)
```diff
@@ -20,6 +20,7 @@
     AgentRunnable,
     StreamResponse,
 )
+from .events import normalize_tool_events
 
 logger = logging.getLogger("AgentWorker")
 
@@ -31,11 +32,32 @@ def __init__(self) -> None:
     async def emit_delta(self, text: str) -> None:
         self.events.append({"type": "delta", "text": text})
 
-    async def emit_tool_call(self, name: str, args: str) -> None:
-        self.events.append({"type": "tool_call", "name": name, "args": args})
-
-    async def emit_tool_result(self, name: str, result: str) -> None:
-        self.events.append({"type": "tool_result", "name": name, "result": result})
+    async def emit_tool_call(
+        self,
+        name: str,
+        args: str,
+        *,
+        call_id: str | None = None,
+        message_id: str | None = None,
+    ) -> None:
+        event = {"type": "tool_call", "name": name, "args": args}
+        if call_id is not None:
+            event["call_id"] = call_id
+        if message_id is not None:
+            event["message_id"] = message_id
+        self.events.append(event)
+
+    async def emit_tool_result(
+        self,
+        name: str,
+        result: str,
+        *,
+        call_id: str | None = None,
+    ) -> None:
+        event = {"type": "tool_result", "name": name, "result": result}
+        if call_id is not None:
+            event["call_id"] = call_id
+        self.events.append(event)
 
 
 def create_worker_app(
@@ -101,6 +123,10 @@ async def run(body: dict[str, Any]):
             response: AgentResponse | StreamResponse = await agent.run(
                 request, emitter=emitter
             )
+            if not isinstance(response, StreamResponse):
+                # Validate outside the harness so caught emitter errors cannot
+                # publish a successful turn with partially invalid history.
+                events = normalize_tool_events(emitter.events)
         except Exception as exc:
             logger.exception("Agent run failed (session=%s)", request.session_key)
             return JSONResponse(
@@ -127,6 +153,6 @@ async def run(body: dict[str, Any]):
                 media_type=response.headers.get("content-type"),
             )
 
-        return {**asdict(response), "events": emitter.events}
+        return {**asdict(response), "events": events}
 
     return app
```

**File**: `areal/v2/agent_service/worker/events.py` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+# SPDX-License-Identifier: Apache-2.0
+
+"""Normalize structured tool events once, before publishing a successful run."""
+
+import uuid
+from typing import Any
+
+
+def normalize_tool_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
+    """Assign missing call IDs and validate associations without reordering events.
+
+    Explicit IDs are opaque. A result without an ID may match only one pending
+    call of the same name. Message IDs group calls from one assistant message;
+    a group cannot reopen after a result or a call from another message.
+
+    This validates reported associations, not transcript completeness: agents
+    that only report calls for observability need not emit results. All state
+    is local to this invocation, and input events are left untouched on failure.
+    """
+    normalized = [dict(event) for event in events]
+    reserved_ids: set[str] = set()
+    for event in normalized:
+        if event.get("type") not in ("tool_call", "tool_result"):
+            continue
+        fields = (
+            ("call_id", "message_id") if event["type"] == "tool_call" else ("call_id",)
+        )
+        for field in fields:
+            value = event.get(field)
+            if value is not None and (not isinstance(value, str) or not value):
+                raise ValueError(f"{field} must be a non-empty string or None")
+        if event.get("call_id") is not None:
+            reserved_ids.add(event["call_id"])
+
+    # Do not rely on run_id: callers may omit or reuse it across turns.
+    prefix = f"call_{uuid.uuid4().hex}"
+    counter = 0
+    seen_calls: set[str] = set()
+    pending: dict[str, str] = {}
+    seen_messages: set[str] = set()
+    current_message: str | None = None
+
+    for event in normalized:
+        event_type = event.get("type")
+        if event_type not in ("tool_call", "tool_result"):
+            continue
+        name = event.get("name", "")
+        call_id = event.get("call_id")
+
+        if event_type == "tool_call":
+            if call_id is None:
+                call_id = f"{prefix}_{counter}"
+                while call_id in reserved_ids:
+                    counter += 1
+                    call_id = f"{prefix}_{counter}"
+                counter += 1
+            if call_id in seen_calls:
+                raise ValueError(f"Duplicate tool call_id {call_id!r}")
+
+            message_id = event.get("message_id")
+            if message_id is not None and message_id != current_message:
+                if message_id in seen_messages:
+                    raise ValueError(
+                        f"message_id {message_id!r} cannot reopen after another "
+                        "message or a tool result"
+                    )
+                seen_messages.add(message_id)
+            current_message = message_id
+            seen_calls.add(call_id)
+            pending[call_id] = name
+        else:
+            current_message = None
+            if call_id is None:
+                candidates = [
+                    cid for cid, tool_name in pending.items() if tool_name == name
+                ]
+                if not candidates:
+                    raise ValueError(f"No pending tool call for result {name!r}")
+                if len(candidates) != 1:
+                    raise ValueError(
+                        f"Ambiguous tool result for {name!r}; provide call_id"
+                    )
+                call_id = candidates[0]
+            if call_id not in pending:
+                reason = "Duplicate result for" if call_id in seen_calls else "Unknown"
+                raise ValueError(f"{reason} tool call_id {call_id!r}")
+            if pending[call_id] != name:
+                raise ValueError(
+                    f"Tool result name {name!r} does not match call_id {call_id!r} "
+                    f"({pending[call_id]!r})"
+                )
+            del pending[call_id]
+
+        event["call_id"] = call_id
+    return normalized
```

---

### Incident Patch 9: `b4b1439a` (2026-09-21)
**Commit Message**: fix(utils): honor custom IPv6 probe addresses (#1740)

Resolve the configured probe host before route detection so IPv6-only environments do not silently fall back to an unrelated hardcoded endpoint.

Signed-off-by: Andrew9603 <[REDACTED_EMAIL]>
Co-authored-by: Andrew9603 <[REDACTED_EMAIL]>

**File**: `areal/utils/network.py` (modified, +32/-11)
```diff
@@ -39,18 +39,39 @@ def gethostip(probe_host: str = "8.8.8.8", probe_port: int = 80) -> str:
         pass
 
     try:
-        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
-            sock.connect((probe_host, probe_port))
-            return sock.getsockname()[0]
-    except OSError as e:
+        probe_infos = socket.getaddrinfo(
+            probe_host, probe_port, socket.AF_UNSPEC, socket.SOCK_DGRAM
+        )
+    except socket.gaierror:
+        probe_infos = []
+
+    # Keep an IPv6 fallback for the default IPv4-only probe address while
+    # respecting custom IPv6 addresses supplied by callers.
+    if probe_host == "8.8.8.8":
+        probe_infos.append(
+            (
+                socket.AF_INET6,
+                socket.SOCK_DGRAM,
+                0,
+                "",
+                ("2001:4860:4860::8888", probe_port, 0, 0),
+            )
+        )
+
+    last_error = None
+    for family, socktype, proto, _, sockaddr in probe_infos:
+        if family not in (socket.AF_INET, socket.AF_INET6):
+            continue
         try:
-            with socket.socket(socket.AF_INET6, socket.SOCK_DGRAM) as sock:
-                sock.connect(("2001:4860:4860::8888", probe_port))
-                ip6 = sock.getsockname()[0]
-                if ip6 and ip6 != "::1":
-                    return ip6
-        except OSError:
-            raise RuntimeError("Could not determine host IP") from e
+            with socket.socket(family, socktype, proto) as sock:
+                sock.connect(sockaddr)
+                ip = sock.getsockname()[0]
+                if ip and ip not in {"127.0.0.1", "::1"}:
+                    return ip
+        except OSError as e:
+            last_error = e
+
+    raise RuntimeError("Could not determine host IP") from last_error
 
 
 def get_loopback_ip() -> str:
```

**File**: `tests/test_network_ipv6_utils.py` (modified, +51/-0)
```diff
@@ -37,6 +37,57 @@ def test_dual_stack_environment_executes_correct_branch(ip_stack):
     assert ip not in {"127.0.0.1", "::1"}
 
 
+def test_gethostip_uses_custom_ipv6_probe(monkeypatch):
+    network = _load_network_module()
+    probe_host = "2001:db8::100"
+    probe_port = 4321
+    connect_calls = []
+
+    def fake_getaddrinfo(host, port, family, socktype):
+        if host == "local-host":
+            return []
+        assert (host, port, family, socktype) == (
+            probe_host,
+            probe_port,
+            network.socket.AF_UNSPEC,
+            network.socket.SOCK_DGRAM,
+        )
+        return [
+            (
+                network.socket.AF_INET6,
+                network.socket.SOCK_DGRAM,
+                0,
+                "",
+                (probe_host, probe_port, 0, 0),
+            )
+        ]
+
+    class FakeSocket:
+        def __init__(self, family, socktype, proto):
+            assert family == network.socket.AF_INET6
+            assert socktype == network.socket.SOCK_DGRAM
+            assert proto == 0
+
+        def __enter__(self):
+            return self
+
+        def __exit__(self, exc_type, exc_value, traceback):
+            return False
+
+        def connect(self, sockaddr):
+            connect_calls.append(sockaddr)
+
+        def getsockname(self):
+            return ("2001:db8::200", 12345, 0, 0)
+
+    monkeypatch.setattr(network.socket, "gethostname", lambda: "local-host")
+    monkeypatch.setattr(network.socket, "getaddrinfo", fake_getaddrinfo)
+    monkeypatch.setattr(network.socket, "socket", FakeSocket)
+
+    assert network.gethostip(probe_host, probe_port) == "2001:db8::200"
+    assert connect_calls == [(probe_host, probe_port, 0, 0)]
+
+
 def test_split_hostport_accepts_unbracketed_ipv6():
     network = _load_network_module()
     host, port = network.split_hostport("2001:db8::1:8000")
```

---

### Incident Patch 10: `44233e5c` (2026-09-21)
**Commit Message**: fix(utils): treat missing packages as not matching version checks (#1689)

* fix(utils): lazy test model dict and safe package version checking

- Use lazy evaluation in testing model path dictionaries to avoid eager downloads on test collection
- Safely handle PackageNotFoundError in version check helper functions

* fix(utils): drop lazy model dict already landed in #1568

Keep PackageNotFoundError handling in package version checks
and add unit coverage for missing and installed packages.

**File**: `areal/utils/pkg_version.py` (modified, +12/-3)
```diff
@@ -39,7 +39,10 @@ def is_version_greater_or_equal(package_name: str, target_version: str) -> bool:
     :param target_version: Target version to compare against.
     :return: True if the installed version is greater than or equal to the target version, False otherwise.
     """
-    installed_version = get_version(package_name)
+    try:
+        installed_version = get_version(package_name)
+    except PackageNotFoundError:
+        return False
     return compare_versions(installed_version, target_version) >= 0
 
 
@@ -51,7 +54,10 @@ def is_version_less(package_name: str, target_version: str) -> bool:
     :param target_version: Target version to compare against.
     :return: True if the installed version is less than the target version, False otherwise.
     """
-    installed_version = get_version(package_name)
+    try:
+        installed_version = get_version(package_name)
+    except PackageNotFoundError:
+        return False
     return compare_versions(installed_version, target_version) < 0
 
 
@@ -63,5 +69,8 @@ def is_version_equal(package_name: str, target_version: str) -> bool:
     :param target_version: Target version to compare against.
     :return: True if the installed version is equal to the target version, False otherwise.
     """
-    installed_version = get_version(package_name)
+    try:
+        installed_version = get_version(package_name)
+    except PackageNotFoundError:
+        return False
     return compare_versions(installed_version, target_version) == 0
```

**File**: `tests/test_pkg_version.py` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+# SPDX-License-Identifier: Apache-2.0
+
+from importlib.metadata import PackageNotFoundError
+from unittest import mock
+
+from areal.utils import pkg_version
+
+
+def test_missing_package_comparisons_return_false():
+    with mock.patch.object(
+        pkg_version, "get_version", side_effect=PackageNotFoundError("missing-pkg")
+    ):
+        assert pkg_version.is_version_greater_or_equal("missing-pkg", "1.0.0") is False
+        assert pkg_version.is_version_less("missing-pkg", "1.0.0") is False
+        assert pkg_version.is_version_equal("missing-pkg", "1.0.0") is False
+
+
+def test_installed_package_comparisons():
+    with mock.patch.object(pkg_version, "get_version", return_value="1.2.3"):
+        assert pkg_version.is_version_greater_or_equal("pkg", "1.2.3") is True
+        assert pkg_version.is_version_greater_or_equal("pkg", "1.2.4") is False
+        assert pkg_version.is_version_less("pkg", "1.2.4") is True
+        assert pkg_version.is_version_less("pkg", "1.2.3") is False
+        assert pkg_version.is_version_equal("pkg", "1.2.3") is True
+        assert pkg_version.is_version_equal("pkg", "1.2.4") is False
```

---

### Incident Patch 11: `574bc6a7` (2026-09-21)
**Commit Message**: fix(engine): avoid AWEX idle-loop collective deadlock (#1737)

Process queued AWEX weight updates only after the explicit SGLang pause request synchronizes scheduler ranks. This avoids interleaving the readiness all-reduce with the next request broadcast when TP event loops drift.

**File**: `areal/engine/awex/sglang_plugin.py` (modified, +1/-68)
```diff
@@ -57,11 +57,7 @@ def assert_alloc_conf_supports_memory_saver(conf: str) -> None:
 assert_alloc_conf_supports_memory_saver(os.environ.get("PYTORCH_CUDA_ALLOC_CONF", ""))
 
 from areal.utils import pkg_version  # noqa: E402
-from areal.utils.environ import (  # noqa: E402
-    get_bool_env_var,
-    get_float_env_var,
-    get_int_env_var,
-)
+from areal.utils.environ import get_float_env_var  # noqa: E402
 from areal.utils.logging import getLogger  # noqa: E402
 
 logger = getLogger("AwexSGLangPlugin")
@@ -234,14 +230,6 @@ def __init__(self, scheduler: Any) -> None:
         self._paused_poll_interval_s = max(
             0.0, get_float_env_var("AWEX_PAUSED_POLL_INTERVAL_S", 0.01)
         )
-        self._process_queue_when_idle = get_bool_env_var(
-            "AREAL_AWEX_PROCESS_QUEUE_WHEN_IDLE", "true"
-        )
-        # Idle-poll throttle in *loop iterations*, not wall-clock time: TP
-        # ranks run the scheduler loop in lockstep, so a loop-count gate is
-        # deterministic across ranks (a time-based gate deadlocks, see
-        # _maybe_process_awex_queue_when_idle).
-        self._idle_poll_loops = max(1, get_int_env_var("AWEX_IDLE_POLL_LOOPS", 64))
 
     @staticmethod
     def _int_attr(scheduler: Any, name: str, default: int) -> int:
@@ -677,56 +665,6 @@ def _on_idle():
             else:
                 scheduler.on_idle()
 
-        def _is_idle_for_awex_update() -> bool:
-            is_fully_idle = getattr(scheduler, "is_fully_idle", None)
-            if callable(is_fully_idle):
-                try:
-                    return bool(is_fully_idle())
-                except TypeError:
-                    return bool(is_fully_idle(for_health_check=False))
-
-            for attr in ("cur_batch", "last_batch"):
-                if getattr(scheduler, attr, None) is not None:
-                    return False
-
-            result_queue = getattr(scheduler, "result_queue", None)
-            if result_queue is not None and len(result_queue) > 0:
-                return False
-
-            running_batch = getattr(scheduler, "running_batch", None)
-            if running_batch is not None:
-                is_empty = getattr(running_batch, "is_empty", None)
-                if callable(is_empty) and not is_empty():
-                    return False
-
-            return True
-
-        def _maybe_process_awex_queue_when_idle(loop_count: int) -> None:
-            if not plugin._process_queue_when_idle:
-                return
-            # DEADLOCK WARNING: everything gating the all_reduce inside
-            # process_awex_queue() MUST be deterministic and identical across
-            # TP ranks. Loop iterations are lockstep (every iteration goes
-            # through the recv_requests broadcast), so a loop-count throttle
-            # is safe. A wall-clock throttle (time.monotonic) is NOT: ranks
-            # hit the window at different times, some skip the all_reduce
-            # while others enter it, and the next recv_requests broadcast
-            # cross-deadlocks against the pending all_reduce (observed as
-            # TP0 stuck in broadcast_pyobj vs TP1-7 stuck in all_reduce).
-            if loop_count % plugin._idle_poll_loops != 0:
-                return
-
-            tp_size = self._int_attr(scheduler, "tp_size", 1)
-            is_idle = _is_idle_for_awex_update()
-            if tp_size == 1:
-                if is_idle and not plugin._weight_queue.empty():
-                    plugin.process_awex_queue()
-                return
-
-            # Rank-local idle state is folded into the collective vote instead
-            # of gating it, so all ranks always enter the all_reduce together.
-            plugin.process_awex_queue(extra_ready=is_idle)
-
         # Patch event_loop_overlap (the one actually used by SGLang)
         _orig_overlap = scheduler.event_loop_overlap
 
@@ -809,8 +747,6 @@ def pop_and_process():
                 elif batch is None:
                     _on_idle()
 
-                _maybe_process_awex_queue_when_idle(_loop_count)
-
                 if scheduler.is_generation:
                     scheduler.launch_batch_sample_if_needed(batch_result)
 
@@ -825,15 +761,13 @@ def _patched_normal():
             logger.info(
                 f"[AWEX] _patched_normal STARTING (gpu_id={getattr(scheduler, 'gpu_id', '?')})",
             )
-            _loop_count = 0
             while True:
                 recv_reqs = _recv_requests()
                 scheduler.process_input_requests(recv_reqs)
                 if scheduler._engine_paused:
                     plugin.process_awex_queue()
                     time.sleep(plugin._paused_poll_interval_s)
                     continue
-                _loop_count += 1
                 batch = scheduler.get_next_batch_to_run()
                 scheduler.cur_batch = batch
                 if batch:
@@ -844,7 +778,6 @@ def _patched_normal():
                     )
                 else:
            
```

---

### Incident Patch 12: `5409c921` (2026-09-21)
**Commit Message**: fix(trainer): offload AWEX rollout before auxiliary scoring (#1738)

Release colocated rollout memory before loading or running the reference,
critic, or teacher model. Keep actor onload after auxiliary scoring and
preserve the existing AWEX handoff and rollback protocol.

Cover auxiliary memory ownership across v1 AWEX, v1 disk, and v2 paths.

**File**: `areal/trainer/rl_trainer.py` (modified, +13/-12)
```diff
@@ -935,6 +935,18 @@ def train(
                 )
             if self._should_offload_rollout:
                 self._offload_rollout()
+            elif self._is_v1_awex_colocate(self.config):
+                # Auxiliary models may share the rollout GPUs too.
+                logger.info("[AWEX] colocate: pausing rollout...")
+                self.rollout.pause()
+                logger.info("[AWEX] colocate: pause_generation_sync...")
+                self.rollout.pause_generation_sync()
+                logger.info("[AWEX] colocate: offload kv_cache...")
+                self.rollout.offload(tags=["kv_cache"])
+                logger.info("[AWEX] colocate: offload weights...")
+                self.rollout.offload(tags=["weights"])
+                logger.info("[AWEX] colocate: offload cuda_graph...")
+                self.rollout.offload(tags=["cuda_graph"])
 
             if self.critic is not None:
                 if self._should_offload_critic:
@@ -992,19 +1004,8 @@ def train(
                 if self._should_offload_teacher:
                     self._offload_model(self.teacher, role="teacher")
 
-            # In colocate (awex) mode: switch GPU from inference to training.
-            # Release SGLang KV cache + weights to free GPU for actor.
+            # TODO(agent): Keep actor onload after auxiliary scoring on shared GPUs.
             if self._is_v1_awex_colocate(self.config):
-                logger.info("[AWEX] colocate: pausing rollout...")
-                self.rollout.pause()
-                logger.info("[AWEX] colocate: pause_generation_sync...")
-                self.rollout.pause_generation_sync()
-                logger.info("[AWEX] colocate: offload kv_cache...")
-                self.rollout.offload(tags=["kv_cache"])
-                logger.info("[AWEX] colocate: offload weights...")
-                self.rollout.offload(tags=["weights"])
-                logger.info("[AWEX] colocate: offload cuda_graph...")
-                self.rollout.offload(tags=["cuda_graph"])
                 try:
                     if self.mopd_teacher_phase is not None:
                         rollout_batch = self.mopd_teacher_phase.materialize(
```

**File**: `tests/test_trainer_eval_before_train.py` (modified, +73/-0)
```diff
@@ -2,6 +2,7 @@
 
 from contextlib import nullcontext
 from types import SimpleNamespace
+from unittest.mock import Mock
 
 import pytest
 
@@ -256,6 +257,78 @@ def test_ppo_trainer_orders_initial_eval_around_recovery(monkeypatch, recovered:
         }
 
 
+@pytest.mark.parametrize("role", ["ref", "critic", "teacher", None])
+@pytest.mark.parametrize(
+    ("version", "mode"), [("v1", "awex"), ("v1", "disk"), ("v2", "awex")]
+)
+def test_ppo_train_colocated_auxiliary_scoring_releases_rollout_first(
+    monkeypatch, role, version, mode
+):
+    """Auxiliary scoring must not overlap rollout memory or load the actor early."""
+    _disable_timing_contexts(monkeypatch, rl_trainer)
+    trainer = _build_ppo_trainer([])
+    trainer.config.actor._version = version
+    trainer.config.actor.weight_update_mode = mode
+    trainer.config.rollout._version = version
+    awex_colocate = version == "v1" and mode == "awex"
+    trainer._should_offload_rollout = not awex_colocate
+    trainer._should_offload_actor = not awex_colocate
+    trainer.rollout = Mock()
+    released = set()
+    memory_tags = {"kv_cache", "weights", "cuda_graph"}
+
+    def release_rollout(*, tags=None):
+        trainer.rollout.pause.assert_called_once()
+        pause = (
+            trainer.rollout.pause_generation_sync
+            if awex_colocate
+            else trainer.rollout.pause_generation
+        )
+        pause.assert_called_once()
+        released.update(memory_tags if tags is None else tags)
+
+    trainer.rollout.offload.side_effect = release_rollout
+    trainer.actor.onload = Mock()
+    auxiliary = Mock(parallel_strategy=SimpleNamespace(dp_size=1))
+
+    def check_auxiliary_memory():
+        assert released == memory_tags, "rollout memory is still resident"
+        trainer.actor.onload.assert_not_called()
+
+    def score(batch):
+        check_auxiliary_memory()
+        return [object() for _ in batch]
+
+    auxiliary.onload.side_effect = check_auxiliary_memory
+    auxiliary.compute_logp.side_effect = score
+    auxiliary.compute_values.side_effect = score
+    if role is not None:
+        setattr(trainer, role, auxiliary)
+        setattr(trainer, f"_should_offload_{role}", True)
+    if role == "teacher":
+        trainer.config.teacher = SimpleNamespace(
+            engine_type="train", rl_loss_weight=1.0, distill_loss_weight=1.0
+        )
+
+    def check_actor_memory():
+        assert released == memory_tags
+        if role is not None:
+            scorer = (
+                auxiliary.compute_values if role == "critic" else auxiliary.compute_logp
+            )
+            scorer.assert_called_once()
+            if role != "critic":
+                auxiliary.offload.assert_called_once()
+
+    trainer.actor.onload.side_effect = check_actor_memory
+
+    with pytest.raises(_StopAfterFirstUpdate):
+        trainer.train(workflow=object())
+
+    trainer.actor.onload.assert_called_once()
+    assert trainer.rollout.offload.call_count == (3 if awex_colocate else 1)
+
+
 @pytest.mark.parametrize(
     ("requires_rl", "explicit_minimum", "expected"),
     [(False, None, 1), (False, 3, 3), (True, None, 2)],
```

---

### Incident Patch 13: `3aad281e` (2026-09-20)
**Commit Message**: fix(reward): validate scorer configuration before PRM execution (#1727)

**File**: `areal/reward/prm/runner.py` (modified, +6/-0)
```diff
@@ -275,11 +275,17 @@ def _order_trajectory_items(
 class PRMRunner:
     """Run configured scorers and commit token rewards atomically per scorer."""
 
+    supports_scorer_config_validation = True
+
     def __init__(self, config: PRMConfig):
         self.config = config
         self._scorers = (
             [_resolve_scorer(spec) for spec in config.scorers] if config.enabled else []
         )
+        for scorer in self._scorers:
+            validate = getattr(scorer, "validate_prm_config", None)
+            if validate is not None:
+                validate(config, training_enabled=config.enabled and scorer.enabled)
         self._observation_schemas: dict[
             str,
             dict[
```

**File**: `tests/test_prm_config_validation.py` (added, +29/-0)
```diff
@@ -0,0 +1,29 @@
+import pytest
+
+from areal.reward.prm import BaseScorer, PRMConfig, PRMRunner
+
+
+class ValidatingScorer(BaseScorer):
+    name = "validating"
+
+    def validate_prm_config(self, config, *, training_enabled):
+        self.validated = training_enabled
+        if config.advantage_shaping.mode != "additive":
+            raise ValueError("additive required")
+
+    async def evaluate(self, interaction, ctx):
+        return 0.0
+
+
+def test_prm_runner_invokes_scorer_validation():
+    scorer = ValidatingScorer()
+    runner = PRMRunner(PRMConfig(enabled=True, scorers=[scorer]))
+    assert runner.supports_scorer_config_validation
+    assert scorer.validated
+
+
+def test_prm_runner_rejects_incompatible_scorer_config():
+    config = PRMConfig(enabled=True, scorers=[ValidatingScorer()])
+    config.advantage_shaping.mode = "gvpo"
+    with pytest.raises(ValueError, match="additive required"):
+        PRMRunner(config)
```

---

### Incident Patch 14: `ac5614a9` (2026-09-20)
**Commit Message**: fix(proxy): preserve configured chat template defaults (#1725)

* fix(proxy): preserve configured chat template defaults

* fix(proxy): expose defaults and order thinking aliases

**File**: `areal/api/cli_args.py` (modified, +4/-0)
```diff
@@ -2624,6 +2624,10 @@ class AgentConfig:
         default="qwen3",
         metadata={"help": "Parser for reasoning content (<think> tags)."},
     )
+    chat_template_kwargs: dict[str, Any] = field(
+        default_factory=dict,
+        metadata={"help": "Default chat template arguments for proxy requests."},
+    )
     chat_template_type: str = field(
         default="hf",
         metadata={
```

**File**: `areal/experimental/openai/proxy/proxy_rollout_server.py` (modified, +36/-0)
```diff
@@ -900,6 +900,42 @@ async def _call_client_create(
             raise HTTPException(status_code=500, detail=message) from e
         kwargs["messages"] = prepared_messages
 
+    defaults = dict(
+        getattr(_engine.config.agent, "chat_template_kwargs", {}) if _engine else {}
+    )
+    extra_body = dict(kwargs.get("extra_body") or {})
+    session_template = session_data.metadata.get("chat_template_kwargs") or {}
+    thinking_keys = ("thinking_option", "enable_thinking", "thinking")
+    template_kwargs = {}
+    for layer in (
+        defaults,
+        session_template,
+        extra_body.get("chat_template_kwargs") or {},
+        kwargs.pop("chat_template_kwargs", None) or {},
+    ):
+        effective = {
+            key: value
+            for key, value in layer.items()
+            if key not in thinking_keys or value is not None
+        }
+        # Thinking aliases share precedence, even when their names differ.
+        if any(key in effective for key in thinking_keys):
+            for key in thinking_keys:
+                template_kwargs.pop(key, None)
+        template_kwargs.update(effective)
+    session_thinking = {
+        key: value
+        for key, value in session_template.items()
+        if key in thinking_keys and value is not None
+    }
+    if session_thinking:
+        for key in thinking_keys:
+            template_kwargs.pop(key, None)
+        template_kwargs.update(session_thinking)
+    if template_kwargs:
+        extra_body["chat_template_kwargs"] = template_kwargs
+        kwargs["extra_body"] = extra_body
+
     dropped_args = []
     for k, v in kwargs.items():
         if k not in areal_client_allowed_args:
```

**File**: `docs/en/cli_reference.md` (modified, +1/-0)
```diff
@@ -948,6 +948,7 @@ Consolidates proxy settings (mode, parsers, export) with agent-service orchestra
 | `mode`                      | string                     | `"inline"`          | OpenAI proxy mode: 'inline' (in-process), 'subproc' (subprocess), or 'online' (external user sessions for online RL training). `inline` mode runs the provided agent workflow directly in the same process. `subproc` mode launches a separate process to run the agent. `online` mode waits for external users to complete sessions via the proxy gateway URL, enabling online RL training. **Choices:** `inline`, `subproc`, `online`                                                          |
 | `tool_call_parser`          | string                     | `"qwen"`            | Parser for tool calls in model output.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
 | `reasoning_parser`          | string                     | `"qwen3"`           | Parser for reasoning content (<think> tags).                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
+| `chat_template_kwargs`      | `dict`                     | `{}`                | Default chat template arguments for proxy requests.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
 | `chat_template_type`        | string                     | `"hf"`              | Chat template type: 'hf' (standard) or 'concat' (multi-turn concatenation). **Choices:** `hf`, `concat`                                                                                                                                                                                                                                                                                                                                                                                          |
 | `engine_max_tokens`         | integer \| None            | `None`              | Maximum total tokens for the engine (prompt + completion).                                                                                                                                                                                                                                                                                                                                                                                                                                       |
 | `turn_discount`             | float                      | `1.0`               | Discount factor for reward propagation in 'individual' export. Concat leaves keep their own branch-local outcome reward.                                                                                                                                                                                                                                                                                                                                                                         |
```

**File**: `docs/zh/cli_reference.md` (modified, +1/-0)
```diff
@@ -946,6 +946,7 @@ Consolidates proxy settings (mode, parsers, export) with agent-service orchestra
 | `mode`                      | string                     | `"inline"`          | OpenAI proxy mode: 'inline' (in-process), 'subproc' (subprocess), or 'online' (external user sessions for online RL training). `inline` mode runs the provided agent workflow directly in the same process. `subproc` mode launches a separate process to run the agent. `online` mode waits for external users to complete sessions via the proxy gateway URL, enabling online RL training. **Choices:** `inline`, `subproc`, `online`                                                          |
 | `tool_call_parser`          | string                     | `"qwen"`            | Parser for tool calls in model output.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
 | `reasoning_parser`          | string                     | `"qwen3"`           | Parser for reasoning content (<think> tags).                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
+| `chat_template_kwargs`      | `dict`                     | `{}`                | Default chat template arguments for proxy requests.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
 | `chat_template_type`        | string                     | `"hf"`              | Chat template type: 'hf' (standard) or 'concat' (multi-turn concatenation). **Choices:** `hf`, `concat`                                                                                                                                                                                                                                                                                                                                                                                          |
 | `engine_max_tokens`         | integer \| None            | `None`              | Maximum total tokens for the engine (prompt + completion).                                                                                                                                                                                                                                                                                                                                                                                                                                       |
 | `turn_discount`             | float                      | `1.0`               | Discount factor for reward propagation in 'individual' export. Concat leaves keep their own branch-local outcome reward.                                                                                                                                                                                                                                                                                                                                                                         |
```

---

### Incident Patch 15: `b90011b6` (2026-09-18)
**Commit Message**: fix(engine): adapt colocated AWEX to SGLang scheduler APIs (#1723)

**File**: `areal/engine/awex/colocate_reader.py` (modified, +60/-7)
```diff
@@ -50,6 +50,30 @@
 logger = getLogger("AwexColocateReader")
 
 
+class _DeviceBoundWeightsReader(NCCLWorkerWeightsReader):
+    """Bind communication to the model's logical CUDA device, not a rank id."""
+
+    def __init__(self, *args, model: torch.nn.Module, **kwargs):
+        device = next(model.parameters()).device
+        if device.type != "cuda" or device.index is None:
+            raise RuntimeError("AWEX reader requires model weights resumed on CUDA")
+        self._model_device = device
+        super().__init__(*args, model=model, **kwargs)
+
+    def _set_device(self) -> None:
+        # TODO(agent): This adapter is CUDA-only; physical ids remain metadata
+        # identities and must not be used as CUDA_VISIBLE_DEVICES indices.
+        torch.cuda.set_device(self._model_device)
+        self.barrier_device = self._model_device.index
+        self.backend = "nccl"
+        self.ready_tensor = torch.tensor(1, device=self._model_device)
+        logger.info(
+            "Bound AWEX reader rank %s to model device %s",
+            self.transfer_rank,
+            self._model_device,
+        )
+
+
 class _PhysicalDeviceMetaServerClient:
     """Use physical GPU ids in AWEX colocate metadata and handshake keys."""
 
@@ -264,29 +288,58 @@ def _build_model_context(self) -> dict[str, Any]:
         tp_size = int(getattr(server_args, "tp_size", 1))
         pp_size = int(getattr(server_args, "pp_size", 1))
         dp_size = int(getattr(server_args, "dp_size", 1))
-        tp_rank = int(getattr(scheduler, "tp_rank", 0))
+
+        def rank_attr(name: str) -> int | None:
+            for obj in (
+                scheduler,
+                getattr(scheduler, "ps", None),
+                getattr(scheduler, "tp_worker", None),
+            ):
+                value = getattr(obj, name, None) if obj is not None else None
+                if value is not None:
+                    return int(value)
+            return None
+
+        tp_rank = rank_attr("tp_rank")
+        if tp_rank is None and self._instance_local_rank is not None:
+            tp_rank = self._instance_local_rank % tp_size
+        if tp_rank is None or not 0 <= tp_rank < tp_size:
+            raise RuntimeError("Cannot resolve a valid AWEX inference TP rank")
+        pp_rank = rank_attr("pp_rank")
+        if pp_rank is None:
+            pp_rank = (
+                self._instance_local_rank // tp_size
+                if self._instance_local_rank is not None
+                else (0 if pp_size == 1 else None)
+            )
+        if pp_rank is None or not 0 <= pp_rank < pp_size:
+            raise RuntimeError("Cannot resolve a valid AWEX inference PP rank")
 
         if self._infer_instance_world_size is not None:
             world_size = self._infer_instance_world_size
             global_rank = self._instance_local_rank
         else:
             world_size = tp_size * pp_size
-            global_rank = tp_rank
+            global_rank = pp_rank * tp_size + tp_rank
+
+        attn_tp_rank = rank_attr("attn_tp_rank")
+        attn_tp_size = rank_attr("attn_tp_size")
+        attn_dp_rank = rank_attr("attn_dp_rank")
 
         return {
             "scheduler": scheduler,
             "infer_engine_config": server_args,
             "tp_rank": tp_rank,
             "tp_size": tp_size,
-            "pp_rank": int(getattr(scheduler, "pp_rank", 0)),
+            "pp_rank": pp_rank,
             "pp_size": pp_size,
             "dp_size": dp_size,
             "world_size": world_size,
             "global_rank": global_rank,
             "local_rank": tp_rank,
-            "attn_tp_rank": int(getattr(scheduler, "attn_tp_rank", tp_rank)),
-            "attn_tp_size": int(getattr(scheduler, "attn_tp_size", tp_size)),
-            "attn_dp_rank": int(getattr(scheduler, "attn_dp_rank", 0)),
+            "attn_tp_rank": tp_rank if attn_tp_rank is None else attn_tp_rank,
+            "attn_tp_size": tp_size if attn_tp_size is None else attn_tp_size,
+            "attn_dp_rank": 0 if attn_dp_rank is None else attn_dp_rank,
         }
 
     def get_parallelism(self) -> dict:
@@ -494,7 +547,7 @@ def _ensure_reader(self) -> NCCLWorkerWeightsReader:
         logger.info("Got training_params_meta from MetaServer")
 
         model_context = self._build_model_context()
-        reader = NCCLWorkerWeightsReader(
+        reader = _DeviceBoundWeightsReader(
             engine_name="sglang",
             model=self._get_model(),
             model_context=model_context,
```

**File**: `areal/engine/awex/sglang_plugin.py` (modified, +88/-9)
```diff
@@ -30,6 +30,7 @@
 import threading
 import time
 from collections.abc import Callable
+from contextlib import contextmanager
 from copy import copy
 from dataclasses import dataclass, field
 from typing import Any
@@ -64,7 +65,54 @@ def assert_alloc_conf_supports_memory_saver(conf: str) -> None:
 from areal.utils.logging import getLogger  # noqa: E402
 
 logger = getLogger("AwexSGLangPlugin")
-SUPPORTED_SGLANG_VERSIONS = ("0.5.9", "0.5.10.post1")
+SUPPORTED_SGLANG_VERSIONS = ("0.5.9", "0.5.10.post1", "0.5.18.dev10+g85b539146")
+
+
+@contextmanager
+def _retract_memory_idle(scheduler: Any, owner: Any):
+    """Ignore only parked requests while retaining the native execution checks."""
+    original_idle = getattr(scheduler, "is_fully_idle", None)
+    if (
+        not callable(original_idle)
+        or not getattr(scheduler, "_engine_paused", False)
+        or original_idle()
+        or not hasattr(scheduler, "waiting_queue")
+    ):
+        yield
+        return
+
+    def drained_idle(*args, **kwargs):
+        # This scope runs synchronously on the scheduler thread. Do not weaken
+        # checks for running/overlap/chunked/grammar/disaggregation work.
+        waiting = scheduler.waiting_queue
+        scheduler.waiting_queue = []
+        try:
+            return original_idle(*args, **kwargs)
+        finally:
+            scheduler.waiting_queue = waiting
+
+    if not drained_idle():
+        yield
+        return
+    targets = [scheduler] if owner is scheduler else [scheduler, owner]
+    saved = [
+        (
+            target,
+            getattr(target, "is_fully_idle"),
+            not hasattr(target, "__dict__") or "is_fully_idle" in vars(target),
+        )
+        for target in targets
+    ]
+    try:
+        for target in targets:
+            target.is_fully_idle = drained_idle
+        yield
+    finally:
+        for target, previous, existed in reversed(saved):
+            if existed:
+                target.is_fully_idle = previous
+            else:
+                del target.is_fully_idle
 
 
 def assert_supported_sglang_version() -> None:
@@ -282,19 +330,20 @@ def _require_receiver(self):
         return self._receiver
 
     def _patch_memory_transitions(self) -> None:
-        """Make AWEX release/resume requests idempotent across retries."""
+        """Make explicitly tagged AWEX memory requests idempotent across retries."""
         scheduler = self._scheduler
         if getattr(scheduler, "_areal_awex_memory_transitions_patched", False):
             return
-        original_release = getattr(scheduler, "release_memory_occupation", None)
-        original_resume = getattr(scheduler, "resume_memory_occupation", None)
+        owner = getattr(scheduler, "weight_updater", None) or scheduler
+        original_release = getattr(owner, "release_memory_occupation", None)
+        original_resume = getattr(owner, "resume_memory_occupation", None)
         if original_release is None or original_resume is None:
             return
 
         def _filtered_request(request: Any, *, release: bool) -> Any | None:
             tags = getattr(request, "tags", None)
-            offload_tags = getattr(scheduler, "offload_tags", None)
-            if tags is None or offload_tags is None:
+            offload_tags = getattr(owner, "offload_tags", None)
+            if not tags or offload_tags is None:
                 return request
             effective_tags = [
                 tag
@@ -317,17 +366,47 @@ def _filtered_request(request: Any, *, release: bool) -> Any | None:
         def _release(request: Any, *args: Any, **kwargs: Any) -> Any:
             filtered = _filtered_request(request, release=True)
             if filtered is None:
-                return None
-            return original_release(filtered, *args, **kwargs)
+                from sglang.srt.managers.io_struct import (
+                    ReleaseMemoryOccupationReqOutput,
+                )
+
+                return ReleaseMemoryOccupationReqOutput()
+            with _retract_memory_idle(scheduler, owner):
+                return original_release(filtered, *args, **kwargs)
 
         def _resume(request: Any, *args: Any, **kwargs: Any) -> Any:
             filtered = _filtered_request(request, release=False)
             if filtered is None:
-                return None
+                from sglang.srt.managers.io_struct import (
+                    ResumeMemoryOccupationReqOutput,
+                )
+
+                return ResumeMemoryOccupationReqOutput()
             return original_resume(filtered, *args, **kwargs)
 
         scheduler.release_memory_occupation = _release
         scheduler.resume_memory_occupation = _resume
+        original_flush = getattr(scheduler, "flush_cache", None)
+        if callable(original_flush):
+
+            def _flush(*args, **kwargs):
+                with _retract_memory_idle(scheduler, owner):
+                    return original_flush(*args, **kwargs)
+
+    
```

#### Recent Merged Pull Requests:
- **PR #1769** (closed): feat(rollout): KV cache transfer alternative to prefill; greatly reduces post-update time-to-first-token (2–3.4× in replay on one H100) (@ilovehhhyn)
- **PR #1764** (closed): feat(trainer): support DTA tree training on Ascend NPU (@262913)
- **PR #1758** (2026-09-27): fix(dataset): drop ViRL39K rows with unextractable boxed answers (@MohammadHijjawi97)
- **PR #1756** (2026-09-24): fix: reclaim training caches and bind NUMA by CUDA UUID (@dingzhiqiang)
- **PR #1754** (2026-09-30): refactor(awex-colocate): remove patch awex and peft colocate flow (@PrometheusComing)
- **PR #1753** (closed): test: align full-suite CI fixtures with current contracts (@sitabulaixizawaluduo)
- **PR #1750** (2026-09-26): feat(reward): preserve episode outcomes and support mean-only groups (@dingzhiqiang)
- **PR #1749** (2026-09-23): fix(engine): preserve colocate state across offload and recovery (@dingzhiqiang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
