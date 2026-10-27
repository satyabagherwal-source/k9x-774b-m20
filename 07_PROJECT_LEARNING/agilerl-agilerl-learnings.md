> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/agilerl-agilerl-learnings.md`  
> **Source**: github ([https://github.com/AgileRL/AgileRL](https://github.com/AgileRL/AgileRL))  
> **Source Version**: `101484ce`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T20:01:11.480Z  
> **Learning ID**: `learn-github-agilerl-agilerl`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): AgileRL/AgileRL

> **Canonical Artifact**: `07_PROJECT_LEARNING/agilerl-agilerl-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/AgileRL/AgileRL](https://github.com/AgileRL/AgileRL))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T20:01:09.938Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `AgileRL/AgileRL`
- **Description**: The complete post-training stack for LLMs, plus RL for any problem. SFT, DPO and multi-turn agentic RL, with evolutionary hyperparameter optimization built in.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 960 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agilerl-arena/agilerl/arena/memory/resolve/engine.py`
```
# Copyright 2026 AgileRL
# SPDX-License-Identifier: Apache-2.0
"""Choose an omitted vLLM tensor-parallel width for a rollout allocation."""

from __future__ import annotations

from typing import Literal

from agilerl.arena.memory.estimator import estimate_generation, generation_can_serve
from agilerl.arena.memory.manifest import (
    MANIFEST_WEIGHT_VARIANTS,
    generation_settings_from_manifest,
)
from agilerl.arena.memory.solver import solve
from agilerl.arena.memory.specs import DeviceSpec, MiB, ModelArch, ModelSpec, RunConfig
from agilerl.arena.models.algorithms.rollout_llm import RolloutLLMSpec
from agilerl.arena.models.manifest import TrainingManifest
from agilerl.arena.models.model_info import SUPPORTED_MODEL_INFO


def _width_candidates(
    leftover: int,
    rollout_engines_per_agent: int | Literal["auto"],
    gpus_per_node: int,
) -> list[tuple[int, int]]:
    """Tensor-parallel widths that fit the leftover GPUs, with their engine counts.

    :param leftover: GPUs left after the trainers are placed.
    :param rollout_engines_per_agent: Engines per member, ``auto``, or ``0``.
    :param gpus_per_node: GPUs on one node. One engine stays on one node.
    :return: ``(tensor_parallel_size, engines)`` pairs.
    """
    if rollout_engines_per_agent in {"auto", 0}:
        return [
            (width, leftover // width)
            for width in range(1, leftover + 1)
            if leftover % width == 0 and width <= gpus_per_node
        ]
    engines = int(rollout_engines_per_agent)
    return [
        (width, engines)
        for width in range(1, leftover + 1)
        if engines * width <= leftover and width <= gpus_per_node
    ]


def resolve_engine_tensor_parallel(
    manifest: TrainingManifest,
    total_gpus: int,
    device: DeviceSpec,
    gpus_per_node: int | None = None,
) -> int | None:
    """Assign the omitted engine width that keeps the most sequences resident.

    :param manifest: Validated training manifest.
    :param total_gpus: GPUs in the allocation.
    :param device: One GPU of that allocation.
    :param gpus_per_node: GPUs on one node. Defaults to ``total_gpus``.
    :return: The assigned width, or None when the manifest is left unchanged.
    """
    spec = manifest.algorithm
    if not isinstance(spec, RolloutLLMSpec) or spec.vllm_config is None:
        return None
    vllm = spec.vllm_config
    if vllm.tensor_parallel_size is not None:
        return None
    hub_id = spec.pretrained_model_name_or_path
    info = SUPPORTED_MODEL_INFO.get(hub_id) if hub_id is not None else None
    if info is None:
        return None
    per_node = total_gpus if gpus_per_node is None else gpus_per_node
    leftover = (
        total_gpus
        - manifest.training.pop_size * manifest.training.training_gpus_per_agent
    )
    if leftover < 1:
        return None
    candidates = _width_candidates(
        leftover, manifest.training.rollout_engines_per_agent, per_node
    )
    if not candidates:
        return None

    counted = info.inspected["num_params"]
    n_params = counted if isinstance(counted, int) else None
    model = ModelSpec(
        model_id=hub_id,
        arch=ModelArch.from_hf_config(info.config),
        n_params=n_params,
        variants=MANIFEST_WEIGHT_VARIANTS,
    )
    pinned = "max_num_seqs" in vllm.model_fields_set
    # The predicted KV pool runs 0.01-0.44 GiB above vLLM 0.32's measured pool
    # (L4 drift rows; Qwen3.6-35B-A3B on A100 at TP=1 and 2), and vLLM preempts
    # once demand passes the pool, so a width must clear demand by this much.
    kv_margin = 512 * MiB

    def resident_sequences(width: int, engines: int) -> int:
        trial = generation_settings_from_manifest(manifest, tensor_parallel_size=width)
        try:
            if pinned:
                breakdown = estimate_generation(model, device, trial)
                if not generation_can_serve(breakdown, kv_margin):
                    return 0
                return engines * trial.max_num_seqs
            run = RunConfig(
                model=model,
                train_device=device,
                gen_device=device,
                generation=trial,
            )
            solved = solve(
                run, "max_num_seqs", phases=("generation",), kv_margin_bytes=kv_margin
            )
        except ValueError:
            # Illegal Mamba TP widths raise; a width that cannot be solved scores 0.
            return 0
        return engines * solved.value

    best: tuple[int, int, int] | None = None
    for width, engines in candidates:
        score = resident_sequences(width, engines)
        rank = (score, engines, width)
        if score > 0 and (best is None or rank > best):
            best = rank
    if best is None:
        return None
    chosen = best[2]
    vllm.tensor_parallel_size = chosen
    return chosen

```

### Core Architecture Module: `agilerl-arena/agilerl/arena/utils.py`
```
# Copyright 2026 AgileRL
# SPDX-License-Identifier: Apache-2.0

import os
import tarfile
import tempfile
from collections.abc import Callable
from pathlib import Path
from typing import BinaryIO

from agilerl.arena.exceptions import ArenaFileNotFoundError


def extract_filename(disposition: str | None) -> str | None:
    """Parse a filename from a Content-Disposition header value."""
    if not disposition:
        return None
    for part in disposition.split(";"):
        part = part.strip()
        if part.startswith("filename="):
            return part.removeprefix("filename=").strip('"')
    return None


def order_dataset_fields(
    row: dict[str, str | int | None],
) -> dict[str, str | int | None]:
    """Return a copy of a dataset row with ``name`` and ``hf_dataset_id`` first.

    :param row: The dataset row to order.
    :type row: dict[str, str | None | int]
    :returns: The ordered dataset row.
    :rtype: dict[str, str | None | int]
    """
    ordered = {
        "name": row.get("name"),
        "hf_dataset_id": row.get("hf_dataset_id"),
    }
    for key, value in row.items():
        if key not in ordered:
            ordered[key] = value
    return ordered


def sort_dataset_search_by_downloads(
    results: list[dict[str, str | int | None]],
) -> list[dict[str, str | int | None]]:
    """Sort HuggingFace search rows by ``downloads`` descending."""
    return sorted(results, key=lambda row: row.get("downloads") or 0, reverse=True)


def multipart_text_fields(
    fields: dict[str, str | None],
) -> dict[str, tuple[None, str]]:
    """Convert text form fields to httpx multipart ``files`` entries.

    Arena dataset create expects ``multipart/form-data`` even when no file is
    uploaded. Pass the return value as ``files=`` and omit ``data=``.
    """
    return {key: (None, value) for key, value in fields.items() if value is not None}


def _tar_to_tempfile(add_entries: Callable[[tarfile.TarFile], None]) -> BinaryIO:
    """Write a ``.tar.gz`` to an unlinked temporary file and rewind it.

    Spooling to disk instead of memory keeps large artifact uploads from
    holding the whole archive resident; httpx streams the open handle.
    """
    buf = tempfile.TemporaryFile()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        add_entries(tar)
    buf.seek(0)
    return buf


_ENV_CONFIG_NAMES: tuple[str, ...] = (
    "env_config.yaml",
    "env_config.yml",
    "env_config.json",
)


def discover_env_sidecars(
    source: str | os.PathLike[str] | bytes,
    *,
    requirements: str | os.PathLike[str] | None,
    env_config: str | os.PathLike[str] | None,
) -> tuple[str | os.PathLike[str] | None, str | os.PathLike[str] | None]:
    """Auto-detect ``requirements`` and ``env_config`` sidecars in a source dir.

    When *source* is a directory, its top level is inspected for a
    ``requirements.txt`` and an ``env_config.{yaml,yml,json}`` file (in that
    precedence) so callers need not pass them explicitly. An explicitly provided
    argument always wins and short-circuits detection for that slot. Non-directory
    sources (single files, ``.tar.gz`` paths, or raw bytes) are passed through
    unchanged.

    :param source: The environment source.
    :type source: str | os.PathLike[str] | bytes
    :param requirements: Explicit requirements path, or ``None`` to auto-detect.
    :type requirements: str | os.PathLike[str] | None
    :param env_config: Explicit env-config path, or ``None`` to auto-detect.
    :type env_config: str | os.PathLike[str] | None
    :returns: The resolved ``(requirements, env_config)`` pair.
    :rtype: tuple[str | os.PathLike[str] | None, str | os.PathLike[str] | None]
    """
    if requirements is not None and env_config is not None:
        return requirements, env_config

    if isinstance(source, bytes):
        return requirements, env_config

    path = Path(os.fspath(source)).expanduser().resolve()
    if not path.is_dir():
        return requirements, env_config

    if requirements is None:
        candidate = path / "requirements.txt"
        if candidate.is_file():
            requirements = candidate

    if env_config is None:
        for name in _ENV_CONFIG_NAMES:
            candidate = path / name
            if candidate.is_file():
                env_config = candidate
                break

    return requirements, env_config


def prepare_env_upload(
    source: str | os.PathLike[str] | bytes,
) -> tuple[str, BinaryIO | bytes]:
    """Resolve an environment source into an upload-ready ``(name, payload)`` pair.

    *source* may be:

    * A path to a directory — compressed into ``.tar.gz`` automatically.
    * A path to a single file — compressed into ``.tar.gz`` automatically.
    * A path to an existing ``.tar.gz`` file — opened for streaming as-is.
    * Raw ``bytes`` — used directly (assumed to be a valid ``.tar.gz``).

    Path inputs resolve to open binary handles so httpx streams the upload in
    chunks instead of holding the whole artifact in memory; the caller is
    responsible for closing them once the request has been sent.

    :param source: The source of the environment.
    :type source: str | os.PathLike[str] | bytes
    :returns: The name and payload (open handle or bytes) of the environment.
    :rtype: tuple[str, BinaryIO | bytes]
    :raises ArenaFileNotFoundError: If *source* is a path that does not exist.
    """
    if isinstance(source, bytes):
        return ("environment.tar.gz", source)

    path = Path(os.fspath(source)).expanduser().resolve()

    # Directory
    if path.is_dir():

        def _add_dir(tar: tarfile.TarFile) -> None:
            for child in sorted(path.rglob("*")):
                if child.is_file():
                    tar.add(str(child), arcname=child.relative_to(path).as_posix())

        return (f"{path.name}.tar.gz", _tar_to_tempfile(_add_dir))

    # Single file
    if path.is_file():
        if path.suffixes[-2:] == [".tar", ".gz"] or path.suffix == ".tgz":
            return (path.name, path.open("rb"))

        def _add_file(tar: tarfile.TarFile) -> None:
            tar.add(str(path), arcname=path.name)

        return (f"{path.stem}.tar.gz", _tar_to_tempfile(_add_file))

    msg = f"Source path not found: {path}"
    raise ArenaFileNotFoundError(msg)


def prepare_file_upload(
    source: str | os.PathLike[str] | bytes,
    *,
    default_name: str,
    content_type: str,
    filename: str | None = None,
) -> tuple[str, BinaryIO | bytes, str]:
    """Resolve a path or raw bytes into an httpx multipart file tuple.

    Path inputs resolve to open binary handles so httpx streams the upload
    in chunks instead of reading the whole file into memory; the caller is
    responsible for closing them once the request has been sent.

    :param source: File path or raw file contents.
    :type source: str | os.PathLike[str] | bytes
    :param default_name: Filename used when *source* is raw bytes.
    :type default_name: str
    :param content_type: MIME type for the upload part.
    :type content_type: str
    :param filename: Multipart filename override (relative parquet shard path).
    :type filename: str | None
    :returns: ``(filename, payload, content_type)`` for httpx ``files=``.
    :rtype: tuple[str, BinaryIO | bytes, str]
    :raises ArenaFileNotFoundError: If *source* is a path that does not exist.
    """
    if isinstance(source, bytes):
        return (filename or default_name, source, content_type)

    path = Path(os.fspath(source)).expanduser().resolve()
    if not path.is_file():
        msg = f"Upload file not found: {path}"
        raise ArenaFileNotFoundError(msg)
    return (filename or path.name, path.open("rb"), content_type)

```

### Core Architecture Module: `agilerl/algorithms/core/__init__.py`
```
# Copyright 2026 AgileRL
# SPDX-License-Identifier: Apache-2.0

from .base import (
    ActionResult,
    EvolvableAlgorithm,
    LLMAlgorithm,
    MultiAgentAlgorithm,
    SingleAgentAlgorithm,
)
from .optimizer_wrapper import OptimizerWrapper

__all__ = [
    "ActionResult",
    "EvolvableAlgorithm",
    "LLMAlgorithm",
    "MultiAgentAlgorithm",
    "OptimizerWrapper",
    "SingleAgentAlgorithm",
]

```

### Core Architecture Module: `agilerl/algorithms/core/base.py`
```
# Copyright 2026 AgileRL
# SPDX-License-Identifier: Apache-2.0

from __future__ import annotations

import copy
import inspect
import io
import logging
import os
import shutil
import tempfile
import warnings
from abc import ABC, ABCMeta, abstractmethod
from collections import OrderedDict, defaultdict, deque
from collections.abc import (
    Callable,
    Generator,
    Iterable,
    Iterator,
    Mapping,
    Sequence,
)
from contextlib import AbstractContextManager, contextmanager, nullcontext
from dataclasses import asdict, replace
from functools import partial
from importlib.metadata import version
from itertools import accumulate, chain, groupby, pairwise
from pathlib import Path
from typing import (
    TYPE_CHECKING,
    Any,
    Generic,
    Literal,
    Protocol,
    TypeVar,
    cast,
    overload,
)

import dill
import numpy as np
import numpy.typing as npt
import torch
import torch.nn.functional as F
from accelerate import Accelerator
from gymnasium import spaces
from tensordict import TensorDict
from torch._dynamo import OptimizedModule
from torch.utils.hooks import RemovableHandle
from typing_extensions import Self

from agilerl import HAS_LIGER_KERNEL, HAS_LLM_DEPENDENCIES, HAS_VLLM

if HAS_LIGER_KERNEL:
    from liger_kernel.transformers import _apply_liger_kernel_to_instance
from agilerl.algorithms.core.llm_ops.fused_logprobs import (
    FusedLinearLogProbsFunction,
    fused_linear_logprobs_chunked,
    scored_position_index,
)
from agilerl.algorithms.core.optimizer_wrapper import (
    REPLICATED_GROUP_SUFFIX,
    OptimizerWrapper,
)
from agilerl.algorithms.core.registry import (
    HyperparameterConfig,
    MutationHook,
    MutationRegistry,
    NetworkGroup,
    OptimizerConfig,
    OptimizerFactory,
)
from agilerl.architectures import (
    FAMILY_RUNTIME_CONFIGS,
    ModelRuntimeConfig,
    install_family_patches,
)
from agilerl.architectures.nemotron_h import register_nemotron_h_liger
from agilerl.architectures.vllm_language import (
    serves_images,
    unbuilt_tower_modules,
)
from agilerl.arena.memory.estimator import (
    PhaseBreakdown,
    estimate_training,
    training_breakdown,
)
from agilerl.arena.memory.manifest import ALGORITHM_NAMES
from agilerl.arena.memory.resolve.batch import resolve_mini_batch_size
from agilerl.arena.memory.resolve.chunk import resolve_chunk_rows
from agilerl.arena.memory.resolve.fsdp import resolve_fsdp_memory
from agilerl.arena.memory.specs import (
    Algorithm,
    DeviceSpec,
    ModelArch,
    ModelSpec,
    TrainingSettings,
    WeightDtype,
)
from agilerl.arena.models.algorithms.rollout_llm import records_sampling_supports
from agilerl.arena.models.networks import VllmModality
from agilerl.arena.models.profiling import ProfilingConfig
from agilerl.components.llm_rollout_data import EpisodeSegments
from agilerl.distributed import (
    BaseRuntime,
    DPRuntime,
    FSDPConfig,
    FSDPRuntime,
    allreduce_minmax_int,
    allreduce_sum_ints,
    any_rank,
    barrier,
    broadcast_object_list,
    full_shape_views,
    gather_params,
    get_local_rank,
    get_rank,
    get_world_size,
    init_distributed,
    is_main_process,
    reshard_fsdp_modules,
    resolve_device,
    set_seed,
)
from agilerl.distributed.runtime import OptimizerStep
from agilerl.llm_envs import RolloutHarness
from agilerl.metrics import AgentMetrics, MultiAgentMetrics
from agilerl.modules import EvolvableModule, ModuleDict
from agilerl.modules.configs import MlpNetConfig, NetConfig
from agilerl.protocols import (
    AgentWrapperProtocol,
    EvolvableAlgorithmProtocol,
    EvolvableModuleProtocol,
    ModuleDictProtocol,
    PeftModelProtocol,
    PretrainedConfigProtocol,
)
from agilerl.typing import (
    ActionResult,
    ActionType,
    ArrayDict,
    BackwardHook,
    CheckpointInfo,
    DeviceType,
    ExperiencesT,
    FitnessValue,
    GradInput,
    GraMaScores,
    GymSpaceType,
    InfosDict,
    LLMObsType,
    LLMRolloutExperiences,
    LrNameType,
    MaybeActionMask,
    ModuleType,
    MultiAgentActionMasks,
    MultiAgentObservationType,
    MultiAgentSetup,
    MultiAgentSpacesType,
    NetConfigType,
    ObservationType,
    RolloutPrompt,
    TorchObsType,
    coerce_action_mask,
)
from agilerl.utils.algo_utils import (
    CosineLRScheduleConfig,
    VLLMConfig,
    _resolve_lr,
    check_supported_space,
    chkpt_attribute_to_device,
    clone_llm,
    concatenate_tensors,
    configure_tf32_precision,
    filter_init_dict,
    get_input_size_from_space,
    get_output_size_from_space,
    isroutine,
    key_in_nested_dict,
    module_checkpoint_dict,
    needs_image_transpose,
    preprocess_observation,
    recursive_check_module_attrs,
    stack_and_pad_experiences,
    stack_experiences,
    transpose_image_space,
)
from agilerl.utils.evolvable_networks import (
    compile_model,
    config_from_dict,
    get_default_encoder_config,
    is_image_space,
    is_vector_space,
)
from agilerl.utils.learn_profiler import LearnProfiler
from agilerl.utils.llm_packing import (
    PackedBatch,
    mixers_without_boundary_reset,
    pack_next_token_frame,
    pack_padded_batch,
    unpack_hidden_states,
    unpack_logprobs,
)
from agilerl.utils.mutation_utils import target_activations
from agilerl.utils.phase_timer import PhaseTimer
from agilerl.utils.sampling_supports import extract_vllm_sampling_supports
from agilerl.utils.torch_utils import release_device_memory
from agilerl.utils.vision_rows import (
    PinnedStaging,
    VisionRows,
    pixel_values_for_minibatch,
    prefetch_to_device,
)

if TYPE_CHECKING:
    from torch.optim.lr_scheduler import LambdaLR
    from transformers import BitsAndBytesConfig, GenerationConfig, PreTrainedModel

# Make imports visible to typechecker and import when required
if TYPE_CHECKING or HAS_LLM_DEPENDENCIES:
    from peft import (
        LoraConfig,
        PeftModel,
        get_peft_model,
        prepare_model_for_kbit_training,
    )
    from transformers import PretrainedConfig

    from agilerl.algorithms.core.llm_ops.checkpoint import LLMCheckpointSnapshot
    from agilerl.algorithms.core.llm_ops.frozen_vision import (
        VisionFeatureCache,
        install_frozen_vision_no_grad,
    )
    from agilerl.algorithms.core.llm_ops.vision_lockstep import (
        PlannedImages,
        VisionLockstep,
        vision_language_module,
        vision_lockstep,
    )
    from agilerl.algorithms.core.llm_ops.vllm_colocate import (
        patch_vllm_3d_moe_lora_flag,
        patch_vllm_lora_keep_resident,
    )
    from agilerl.lora.fused import (
        get_cached_lora_layers,
        patch_lora_for_fused_forward,
        set_fused_adapter_routing,
        unset_fused_adapter_routing,
    )
    from agilerl.lora.moe import (
        install_packed_expert_grouped_gemm,
        materializes_expert_lora,
        set_routed_experts_recompute,
        upgrade_moe_param_wrappers,
    )
    from agilerl.utils.algo_utils import clone_llm
    from agilerl.utils.llm_utils import (
        LEARN_PHASE_METRIC_NAMES,
        LEARN_PHASES,
        RolloutSampling,
        adapt_lora_config_for_model,
        apply_vllm_compile_cache_env,
        attention_mask_from_padded_ids,
        build_completion_mask,
        build_vllm_llm_init_kwargs,
        build_vllm_rollout_lora_request,
        calculate_k3_kl,
        create_model_from_name_or_path,
        fill_outside_mask,
        format_colocated_vllm_oom_hint,
        generation_tokens_for_turn,
        get_lora_params,
        get_model_name_or_path,
        hf_completion_lengths,
        hf_turn_generation_config,
        is_rollout_prompt,
        language_model_attn_implementation,
        log_cuda_memory_snapshot,
        lora_target_module_names,
        make_llm_scheduler,
        move_params_to_cpu,
        move_params_to_gpu,
        needs_cross_rank_seq_padding,
        offload_colocated_trainer_from_gpu,
        prepare_prompt_hf_generate,
        save_lora_adapters,
        save_peft_adapter_for_vllm_rollout,
        snapshot_lora_adapters,
    )
    from agilerl.utils.segment_balance import balance_rows_across_ranks
    from agilerl.utils.segment_rows import (
        SegmentRows,
        append_vision_tails,
        filler_token_frac,
        pad_row_values,
        pad_segment_rows,
        segment_window_layout,
        split_episode_segments,
    )


if TYPE_CHECKING:
    from vllm import LLM, CompletionOutput, SamplingParams
elif HAS_VLLM:
    from vllm import LLM, CompletionOutput, SamplingParams
else:
    LLM = CompletionOutput = SamplingParams = None

__all__ = [
    "ActionResult",
    "EvolvableAlgorithm",
    "MultiAgentAlgorithm",
    "SingleAgentAlgorithm",
]

logger = logging.getLogger(__name__)


def _align_fsdp_reduce_dtype(config: FSDPConfig, multi_pass: bool) -> FSDPConfig:
    """Reduce gradients in parameter dtype for split actor/critic passes.

    Deferred sync holds a pass's gradients in ``reduce_dtype``; a split learn
    touches actor parameters on the policy pass and critic parameters on the
    value pass, so a step boundary collects held policy gradients next to
    fresh value gradients and reduce-scatter requires one dtype across the
    unit. Reducing in parameter dtype keeps held and fresh gradients uniform.

    :param config: The run's FSDP config.
    :type config: FSDPConfig
    :param multi_pass: Whether one optimizer step runs separate policy and
        value backward passes over different parameters.
    :type multi_pass: bool
    :return: ``config`` with ``reduce_dtype`` set to ``param_dtype`` for
        split-pass runs, else ``config`` unchanged.
    :rtype: FSDPConfig
    """
    if (
        not multi_pass
        or not config.defer_grad_sync
        or config.reduce_dtype == config.param_dtype
    ):
        return config
    logger.info(
        "FSDP reduce_dtype %s differs from param_dtype %s with split "
        "actor/critic passes; reducing in %s so held and fresh gradients "
        "share 
```

### Core Architecture Module: `agilerl/algorithms/core/llm_ops/__init__.py`
```
# Copyright 2026 AgileRL
# SPDX-License-Identifier: Apache-2.0

"""LLM-specific fused-kernel ops."""

```

### Core Architecture Module: `agilerl/algorithms/core/llm_ops/checkpoint.py`
```
# Copyright 2026 AgileRL
# SPDX-License-Identifier: Apache-2.0

"""Host copies of LLM checkpoints that write while training continues."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import dill
import torch

from agilerl.utils.llm_utils import (
    CheckpointFileOpener,
    LoraAdapterSnapshot,
    directory_opener,
    write_lora_adapters,
)


@dataclass
class LLMCheckpointSnapshot:
    """Host copy of an LLM checkpoint, taken by :meth:`LLMAlgorithm.snapshot_checkpoint`.

    Shares no storage with live weights or optimizer state, and :meth:`write`
    runs no collectives, so it can be written while training continues.
    Ranks other than the main process hold an empty snapshot.

    :param attributes: ``attributes.pt`` payload; ``None`` off the main process.
    :type attributes: dict[str, Any] | None
    :param adapters: Adapter weights for a ``lora_only`` checkpoint.
    :type adapters: LoraAdapterSnapshot | None
    """

    attributes: dict[str, Any] | None
    adapters: LoraAdapterSnapshot | None = None

    def write(self, path: str | Path) -> None:
        """Write the checkpoint directory that :meth:`LLMAlgorithm.load_checkpoint` reads.

        :param path: Directory to write the checkpoint into.
        :type path: str | Path
        """
        self.write_files(directory_opener(path))

    def write_files(self, open_file: CheckpointFileOpener) -> None:
        """Write each checkpoint file through ``open_file``.

        ``attributes.pt`` goes last, so a reader that finds it finds every
        other file of the checkpoint.

        :param open_file: Opens a file by its path relative to the checkpoint directory.
        :type open_file: CheckpointFileOpener
        """
        if self.attributes is None:
            return
        if self.adapters is not None:
            write_lora_adapters(self.adapters, open_file)
        with open_file("attributes.pt") as file:
            torch.save(self.attributes, file, pickle_module=dill)

```

### Core Architecture Module: `agilerl/algorithms/core/llm_ops/frozen_vision.py`
```
# Copyright 2026 AgileRL
# SPDX-License-Identifier: Apache-2.0

"""Run frozen vision towers without autograd, and reuse their outputs within a learn step.

Hugging Face ``enable_input_require_grads`` (called by
``gradient_checkpointing_enable``) hooks the input embeddings of every
sub-model, the vision tower's patch embedding included. A tower with no
trainable parameter then still records autograd, saves its activations,
and is recomputed under activation checkpointing, although no gradient
it computes is ever used.

A learn step runs the same images through a frozen tower several times
(reference, old-policy and gradient forwards). :class:`VisionFeatureCache`
keeps each image's tower output for the rest of the step.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Hashable, Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from functools import partial
from typing import NamedTuple

import torch
import torch.nn as nn
from peft.tuners.tuners_utils import BaseTunerLayer
from torch.utils._pytree import TreeSpec, tree_flatten, tree_map_only, tree_unflatten
from transformers import PreTrainedModel

logger = logging.getLogger(__name__)

MODE_DEPENDENT_MODULES = (
    nn.BatchNorm1d,
    nn.BatchNorm2d,
    nn.BatchNorm3d,
    nn.SyncBatchNorm,
)
DROPOUT_MODULES = (
    nn.Dropout,
    nn.Dropout1d,
    nn.Dropout2d,
    nn.Dropout3d,
    nn.AlphaDropout,
    nn.FeatureAlphaDropout,
)
CALL_ARG_TYPES = (bool, int, float, str, type(None))


class CallKey(NamedTuple):
    """Non-image arguments of a tower call, which its cache entries share."""

    rows_per_image: int
    image_shape: tuple[int, ...]
    image_dtype: torch.dtype
    args: tuple[Hashable, ...]
    kwargs: tuple[tuple[str, Hashable], ...]
    mode: bool | None


@dataclass(frozen=True)
class TowerCall:
    """Output layout of tower calls that share their non-image arguments.

    :param spec: Pytree structure of the output.
    :param device: Device the output tensors live on.
    """

    spec: TreeSpec
    device: torch.device


class VisionFeatureCache:
    """Frozen vision tower outputs of one learn step, one entry per image.

    Callers name the images of the next tower calls with :meth:`images`; keys
    only mean something inside one :meth:`step`. The images are the first
    positional argument, or ``pixel_values``. They hold one row per key, or
    an equal run of packed rows per key next to tensor arguments with one
    equal row per key (a patch grid). Every other tensor argument has one row per
    key or per image row, and belongs to the image its key names. Output
    tensors are image-major.

    A call whose images all have entries for the same non-image arguments
    reuses them. Any other call runs the tower and stores each image's slice
    of every output tensor in host memory. A call that will reuse entries can
    take :meth:`stand_in` images, which hold no pixels.

    :param mode_dependent: Whether train mode can change the tower output, so
        entries from eval-mode calls are kept apart from train-mode ones.
    """

    def __init__(self, mode_dependent: bool = True) -> None:
        self.mode_dependent = mode_dependent
        self.entries: dict[tuple[CallKey, int], list[torch.Tensor]] | None = None
        self.calls: dict[CallKey, TowerCall] = {}
        self.keys: list[int] | None = None
        self.tower: nn.Module | None = None
        # "run" or "reuse" when ranks agreed on the next tower call.
        self.agreed: str | None = None
        # One element per (dtype, device) that every stand-in image aliases.
        self.placeholders: dict[tuple[torch.dtype, torch.device], torch.Tensor] = {}

    @contextmanager
    def step(self) -> Iterator[None]:
        """Keep tower outputs until the context exits."""
        self.entries = {}
        self.calls = {}
        try:
            yield
        finally:
            self.entries = None
            self.calls = {}
            self.agreed = None

    def covers(self) -> bool:
        """Whether every image the next tower call names has an entry."""
        return self.keys is not None and self.reuse_dtype(self.keys) is not None

    def reuse_dtype(self, keys: Sequence[int]) -> torch.dtype | None:
        """:meth:`image_dtype` of ``keys`` in the tower's current mode.

        :param keys: Keys of the images.
        :return: The dtype a call reusing them takes, or ``None``.
        """
        tower = self.tower
        return None if tower is None else self.image_dtype(keys, tower.training)

    def image_dtype(self, keys: Sequence[int], training: bool) -> torch.dtype | None:
        """Image dtype of a stored tower call with an entry for every image in ``keys``.

        :param keys: Keys of the images.
        :param training: Whether the tower runs in train mode.
        :return: The dtype the tower saw, or ``None`` when no call holds them all.
        """
        entries = self.entries
        if not entries or not keys or self.tower is None:
            return None
        mode = training if self.mode_dependent else None
        for call in self.calls:
            if call.mode == mode and all((call, key) in entries for key in keys):
                return call.image_dtype
        return None

    def stand_in(
        self, shape: Sequence[int], dtype: torch.dtype, device: str | torch.device
    ) -> torch.Tensor:
        """``shape`` images of one shared element, for a tower call that reuses every entry.

        :param shape: Shape of the images the call would take.
        :param dtype: :meth:`image_dtype` of those images.
        :param device: Device of the call.
        :return: A view of one element.
        """
        key = (dtype, torch.device(device))
        if key not in self.placeholders:
            self.placeholders[key] = torch.zeros((), dtype=dtype, device=device)
        return self.placeholders[key].expand(*shape)

    @contextmanager
    def images(self, keys: torch.Tensor | None) -> Iterator[None]:
        """Name the images of tower calls inside the context, in batch order.

        :param keys: ``(N,)`` integer key per image, or ``None`` to bypass the cache.
        :type keys: torch.Tensor | None
        """
        previous = self.keys
        self.keys = None if keys is None else keys.tolist()
        try:
            yield
        finally:
            self.keys = previous

    def run(
        self,
        tower: nn.Module,
        forward: Callable[..., object],
        args: tuple[object, ...],
        kwargs: dict[str, object],
    ) -> object:
        """Tower output for ``forward(*args, **kwargs)``, from the cache when every image has an entry.

        :raises RuntimeError: If ranks agreed to reuse entries this call lacks.
        """
        entries = self.entries
        keys = self.keys
        call = (
            None
            if entries is None or not keys
            else self._call_key(tower, args, kwargs, len(keys))
        )
        if entries is not None and keys and call is not None and self.agreed != "run":
            hit = self._lookup(entries, call, keys)
            if hit is not None:
                return hit
        if self.agreed == "reuse":
            msg = "Ranks agreed to reuse cached vision features this call lacks"
            raise RuntimeError(msg)
        pixels = args[0] if args else kwargs.get("pixel_values")
        if isinstance(pixels, torch.Tensor) and any(
            pixels.untyped_storage().data_ptr()
            == placeholder.untyped_storage().data_ptr()
            for placeholder in self.placeholders.values()
        ):
            msg = "A vision tower call on stand-in images lacks cached features"
            raise RuntimeError(msg)
        output = forward(*args, **kwargs)
        if entries is not None and keys and call is not None:
            self._store(entries, call, keys, output)
        return output

    def _lookup(
        self,
        entries: dict[tuple[CallKey, int], list[torch.Tensor]],
        call: CallKey,
        keys: list[int],
    ) -> object | None:
        """The stored output of ``keys`` for ``call``, or ``None`` unless every key has an entry."""
        stored = [entries.get((call, key)) for key in keys]
        hits = [entry for entry in stored if entry is not None]
        layout = self.calls.get(call)
        if layout is None or len(hits) != len(keys):
            return None
        return tree_unflatten(
            [
                torch.cat(
                    [entry[leaf].to(layout.device, non_blocking=True) for entry in hits]
                )
                for leaf in range(len(hits[0]))
            ],
            layout.spec,
        )

    def _call_key(
        self,
        tower: nn.Module,
        args: tuple[object, ...],
        kwargs: dict[str, object],
        images: int,
    ) -> CallKey | None:
        """Key of a call's non-image arguments, or ``None`` when its layout cannot key a cache."""
        if args:
            pixels, args, extra = args[0], args[1:], kwargs
        else:
            pixels = kwargs.get("pixel_values")
            extra = {
                name: value for name, value in kwargs.items() if value is not pixels
            }
        if not isinstance(pixels, torch.Tensor) or pixels.dim() == 0:
            return None
        rows = pixels.shape[0]
        if rows % images or not _keyable_arguments(
            [*args, *extra.values()], images, rows
        ):
            return None

        def describe(value: object) -> Hashable:
            if not isinstance(value, torch.Tensor):
                return value
            return (value.shape[0] == images, tuple(value.shape[1:]), value.dtype)

        mode = tower.training if self.mode_dependent else None
        return CallKey(
            rows // images,
            tuple(pixels.shape[1:]),
            pixels.dtype,
            tuple(describe(value) for value in ar
```

### Core Architecture Module: `agilerl/algorithms/core/llm_ops/fused_logprobs.py`
```
# Copyright 2026 AgileRL
# SPDX-License-Identifier: Apache-2.0

"""Memory-bounded fused-linear log-prob computation.

Computes per-token target logprobs straight from last-hidden-states with the
``(B, T, V)`` logits slab never materialized: the lm_head matmul + log-softmax
reduction runs over bounded ``(chunk_rows, V)`` tiles in both the forward and
the (gradient-checkpointed) backward. Used by ``LLMAlgorithm`` for both the
no-grad old/reference passes and the gradient forward.
"""

from __future__ import annotations

from collections.abc import Callable
from functools import partial
from typing import Any

import torch

from agilerl.distributed import materialize_dtensors


def fp32_lm_head_operands(
    head_w: torch.Tensor,
    head_b: torch.Tensor | None,
    cast_to_fp32: bool,
) -> tuple[torch.Tensor, torch.Tensor | None]:
    """Upcast the lm_head for one chunk loop, hoisted out of the loop body.

    A ``(V, H)`` fp32 copy is gigabytes at production vocab sizes, so a loop
    takes at most one, shared by every chunk. Call inside an FSDP/DTensor
    gather (or with already-dense weights), or the copy is taken from a shard.

    :param head_w: ``(V, H)``.
    :type head_w: torch.Tensor
    :param head_b: ``(V,)`` or ``None``.
    :type head_b: torch.Tensor | None
    :param cast_to_fp32: whether the loop runs its matmul in fp32.
    :type cast_to_fp32: bool
    :return: The head operands to pass to every chunk.
    :rtype: tuple[torch.Tensor, torch.Tensor | None]
    """
    if not cast_to_fp32 or head_w.dtype == torch.float32:
        return head_w, head_b
    bias = head_b.float() if head_b is not None else None
    return head_w.float(), bias


def support_scores(
    scores: torch.Tensor,
    support_ids: torch.Tensor,
    target_ids: torch.Tensor,
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """Target score and log-sum-exp of ``scores`` over each row's sampling support.

    A support row lists the token ids the sampler could draw, padded with
    ``-1``; a row whose first id is ``-1`` has no recorded support. Its
    normalizer is the target's own score repeated, so it stays finite and its
    gradient is zero once the caller selects the full-vocab normalizer there.
    The target and the support share one gather, so the backward builds one
    ``(..., V)`` scatter buffer.

    :param scores: ``(..., V)`` logits or log-probs.
    :type scores: torch.Tensor
    :param support_ids: ``(..., K)`` support token ids, ``-1`` padded.
    :type support_ids: torch.Tensor
    :param target_ids: ``(...)`` sampled token ids.
    :type target_ids: torch.Tensor
    :return: ``(selected, normalizer, restricted)``, each ``(...)``: the
        target's score, the log-sum-exp over the support, and whether the row
        has a support.
    :rtype: tuple[torch.Tensor, torch.Tensor, torch.Tensor]
    """
    present = support_ids >= 0
    restricted = present[..., 0]
    targets = target_ids.unsqueeze(-1)
    ids = torch.where(present, support_ids.long(), targets)
    values = scores.gather(dim=-1, index=torch.cat([targets, ids], dim=-1))
    support = values[..., 1:].masked_fill(
        ~present & restricted.unsqueeze(-1), float("-inf")
    )
    return values[..., 0], torch.logsumexp(support, dim=-1), restricted


def _fused_logprob_chunk(
    h_chunk: torch.Tensor,
    head_w: torch.Tensor,
    head_b: torch.Tensor | None,
    target_chunk: torch.Tensor,
    temperature: float,
    cast_to_fp32: bool,
    softcap: float | None,
    logit_bias: torch.Tensor | None = None,
) -> torch.Tensor:
    """Per-token logprobs for one flat ``(chunk_rows, H)`` slab of hidden states.

    Functional (no in-place ops) so it is safe under both ``torch.compile`` and
    the autograd recompute in :class:`FusedLinearLogProbsFunction`. The
    max-shift used elsewhere for stability is folded into ``logsumexp`` (which
    is already numerically stable), keeping the body fusion-friendly.

    :param h_chunk: ``(chunk_rows, H)`` hidden states.
    :type h_chunk: torch.Tensor
    :param head_w: ``(V, H)``.
    :type head_w: torch.Tensor
    :param head_b: ``(V,)`` or ``None``.
    :type head_b: torch.Tensor | None
    :param target_chunk: ``(chunk_rows,)`` target token ids.
    :type target_chunk: torch.Tensor
    :param temperature: logits divided by this before log_softmax (skip at 1.0).
    :type temperature: float
    :param cast_to_fp32: upcast ``h_chunk`` so the matmul and the reduction run
        in fp32; the head is expected to arrive fp32 already
        (:func:`fp32_lm_head_operands`).
    :type cast_to_fp32: bool
    :param softcap: squash logits to ``softcap * tanh(logits / softcap)`` before
        the temperature, as the model's own head does; ``None`` skips it.
    :type softcap: float | None
    :param logit_bias: ``(V,)`` fp32 bias added after the softcap and before the
        temperature, as vLLM applies its ``logit_bias``; ``None`` adds none.
    :type logit_bias: torch.Tensor | None
    :return: ``(chunk_rows,)`` per-token logprobs.
    :rtype: torch.Tensor
    """
    if cast_to_fp32:
        h_chunk = h_chunk.float()
    if h_chunk.dtype != head_w.dtype:
        # Chunk-tiling callers upcast the head once ahead of their loop, so this
        # only fires for a direct call or an fp16 checkpoint under bf16 autocast
        # (fp32 hidden, fp16 head). It copies the whole ``(V, H)`` head.
        compute_dtype = torch.promote_types(h_chunk.dtype, head_w.dtype)
        h_chunk = h_chunk.to(compute_dtype)
        head_w = head_w.to(compute_dtype)
    logits = h_chunk @ head_w.t()
    if head_b is not None:
        logits = logits + head_b
    if softcap is not None:
        logits = softcap * torch.tanh(logits / softcap)
    if logit_bias is not None:
        logits = logits + logit_bias.to(logits.dtype)
    if temperature != 1.0:
        logits = logits / temperature
    selected = logits.gather(dim=-1, index=target_chunk.unsqueeze(-1)).squeeze(-1)
    log_z = torch.logsumexp(logits, dim=-1)
    return selected - log_z


def support_logprob_chunk(
    h_chunk: torch.Tensor,
    head_w: torch.Tensor,
    head_b: torch.Tensor | None,
    target_chunk: torch.Tensor,
    temperature: float,
    cast_to_fp32: bool,
    softcap: float | None,
    support_chunk: torch.Tensor,
    logit_bias: torch.Tensor | None = None,
) -> torch.Tensor:
    """Per-token logprobs over each row's sampling support, from the support's head rows alone.

    A logprob normalized over a support depends only on the support's logits,
    so the head is gathered to those ``K`` rows per token rather than
    multiplied in full. Every row must have a support; a target outside its
    support has probability zero.

    :param h_chunk: ``(n, H)`` hidden states.
    :type h_chunk: torch.Tensor
    :param head_w: ``(V, H)`` in the model's dtype; gathered rows are upcast
        when ``cast_to_fp32`` is set.
    :type head_w: torch.Tensor
    :param head_b: ``(V,)`` or ``None``.
    :type head_b: torch.Tensor | None
    :param target_chunk: ``(n,)`` target token ids.
    :type target_chunk: torch.Tensor
    :param temperature: logits divided by this before normalizing (skip at 1.0).
    :type temperature: float
    :param cast_to_fp32: run the dot products and the reduction in fp32.
    :type cast_to_fp32: bool
    :param softcap: final-logit softcap of the model's head, or ``None``.
    :type softcap: float | None
    :param support_chunk: ``(n, K)`` support token ids, ``-1`` padded, with a
        support on every row.
    :type support_chunk: torch.Tensor
    :param logit_bias: ``(V,)`` fp32 bias added after the softcap, or ``None``.
    :type logit_bias: torch.Tensor | None
    :return: ``(n,)`` per-token logprobs.
    :rtype: torch.Tensor
    """
    present = support_chunk >= 0
    ids = support_chunk.long().clamp(min=0)
    matches = present & (ids == target_chunk.unsqueeze(-1))
    rows = head_w[ids]
    if cast_to_fp32:
        h_chunk = h_chunk.float()
        rows = rows.float()
    compute_dtype = torch.promote_types(h_chunk.dtype, rows.dtype)
    logits = torch.bmm(
        rows.to(compute_dtype), h_chunk.to(compute_dtype).unsqueeze(-1)
    ).squeeze(-1)
    if head_b is not None:
        logits = logits + head_b[ids].to(logits.dtype)
    if softcap is not None:
        logits = softcap * torch.tanh(logits / softcap)
    if logit_bias is not None:
        logits = logits + logit_bias[ids].to(logits.dtype)
    if temperature != 1.0:
        logits = logits / temperature
    # The target's own support column, so a one-id support cancels exactly.
    selected = logits.gather(-1, matches.int().argmax(-1, keepdim=True)).squeeze(-1)
    log_z = torch.logsumexp(logits.masked_fill(~present, float("-inf")), dim=-1)
    return torch.where(
        matches.any(-1), selected - log_z, torch.full_like(log_z, float("-inf"))
    )


def support_chunk_rows(chunk_rows: int, head_w: torch.Tensor, width: int) -> int:
    """Rows per support chunk whose gathered head fits the full-vocab chunk's logits.

    :param chunk_rows: rows of a full-vocab ``(chunk_rows, V)`` chunk.
    :type chunk_rows: int
    :param head_w: ``(V, H)``.
    :type head_w: torch.Tensor
    :param width: support width ``K``.
    :type width: int
    :return: Rows whose ``(rows, K, H)`` gather has at most ``chunk_rows * V``
        elements, and at least ``chunk_rows``.
    :rtype: int
    """
    vocab, hidden = head_w.shape
    return max(chunk_rows, chunk_rows * vocab // (width * hidden))


def split_support_rows(
    flat_support: torch.Tensor | None,
) -> tuple[torch.Tensor | None, torch.Tensor | None]:
    """Split flat rows into those scored over a support and those scored over the vocabulary.

    :param flat_support: ``(N, K)`` supports, or ``None``.
    :type flat_support: torch.Tensor | None
    :return: ``(support_rows, vocab_rows)`` long indices, or ``(None, None)``
        without supports, when every row is scored over the vocabulary.
    :rtype: tuple[torch.Tensor |
```

### Core Architecture Module: `agilerl/algorithms/core/llm_ops/fused_loss.py`
```
# Copyright 2026 AgileRL
# SPDX-License-Identifier: Apache-2.0

"""Fused linear PPO-style policy gradient loss with per-token / per-turn advantages.

Liger's ``LigerFusedLinearGRPOFunction`` only handles GRPO's
per-trajectory scalar advantage. LLMPPO carries ``(B, T)`` per-token
advantages (GAE returns); turn-PPO with ``turn_level_clip=True`` carries
``(B, max_turns)`` per-turn advantages. This module provides a sibling
autograd Function that handles both per-token and per-turn
advantages via a ``turn_ids`` switch.

Same chunked forward+backward idea as Liger's base: each chunk computes
the loss + accumulates ``grad_input``/``grad_weight`` and is then freed,
so the gradient-time ``(B, T, V)`` logits tensor is never materialized.
PPO's value-head loss runs outside this fusion (the value tensor is small).

The per-chunk math (:func:`llm_policy_loss_fn`) lives in this module;
the K3 KL-divergence estimator it uses (:func:`calculate_k3_kl`) is canonically
defined in :mod:`agilerl.utils.llm_utils` and re-exported here for
backward-compatible imports. This module requires ``liger-kernel`` at
import time — gate on :data:`agilerl.HAS_LIGER_KERNEL` before importing.
"""

from __future__ import annotations

from typing import Protocol

import torch
from torch.autograd.function import FunctionCtx

from agilerl import HAS_LIGER_KERNEL

if not HAS_LIGER_KERNEL:
    msg = (
        "Liger fused loss functions are only available when liger-kernel "
        "is installed. Check ``HAS_LIGER_KERNEL`` before importing or "
        "using this module."
    )
    raise ImportError(msg)

from liger_kernel.chunked_loss.dpo_loss import LigerFusedLinearDPOFunction
from liger_kernel.chunked_loss.fused_linear_ppo import LigerFusedLinearPPOBase
from liger_kernel.chunked_loss.fused_linear_preference import (
    LigerFusedLinearPreferenceBase,
)

from agilerl.algorithms.core.llm_ops.fused_logprobs import support_scores
from agilerl.utils.llm_utils import calculate_k3_kl, k3_kl_penalty_reference


class SaveForBackwardCtx(Protocol):
    """The one autograd-``ctx`` capability these forwards use."""

    def save_for_backward(self, *tensors: torch.Tensor | None) -> None: ...


def llm_policy_loss_fn(
    log_probs: torch.Tensor,
    selected_token_ids: torch.Tensor,
    attention_mask: torch.Tensor,
    advantages: torch.Tensor,
    full_attention_mask: torch.Tensor,
    ref_per_token_logps: torch.Tensor | None = None,
    old_per_token_logps: torch.Tensor | None = None,
    epsilon_low: float = 0.2,
    epsilon_high: float = 0.2,
    beta: float = 0.0,
    turn_ids: torch.Tensor | None = None,
    full_turn_mask: torch.Tensor | None = None,
    max_turns: int | None = None,
    importance_sampling_level: str = "token",
    turn_log_ratio_reduction: str = "mean",
    vllm_is_ratio: torch.Tensor | None = None,
    kl_clamp: float | None = None,
    support_ids: torch.Tensor | None = None,
    # Liger's ``LigerFusedLinearPPOBase._compute_loss`` invokes the loss fn
    # with kwargs this fn does not consume (``ref_log_probs``, ``loss_type``,
    # ``max_completion_length``, ``sapo_temperature_pos``, ...), so a
    # catch-all is required to absorb them.
    **_unused: object,
) -> tuple[torch.Tensor, list[torch.Tensor]]:
    """Per-chunk policy + KL loss at token / turn / trajectory ratio granularity.

    :class:`LigerFusedLinearPolicyLossFunction` (below) wraps this fn
    behind a chunked forward+backward. ``importance_sampling_level`` selects
    the branch; ``turn_ids`` / ``full_turn_mask`` / ``max_turns`` are required
    by (and only used in) the turn branch:

    * ``"token"`` — ratio, clip, max(-adv*r, ...) at the token level.
      ``advantages`` is ``(chunk_B, T)``.
    * ``"turn"`` — token log-ratios are pooled into
      ``(chunk_B, max_turns)`` per-turn log ratios; clipping and the policy
      formula run on those. ``turn_log_ratio_reduction="mean"`` gives a
      length-normalized mean (geometric-mean ratio), ``"sum"`` gives a sum
      (product ratio). ``advantages`` is ``(chunk_B, max_turns)``.
      ``full_turn_mask`` is the global ``(B, max_turns)`` mask (for the
      cross-chunk reduction denominator). KL stays token-level (matches
      unfused turn-PPO).
    * ``"trajectory"`` — token log-ratios are mean-pooled over the whole
      completion (GSPO). ``advantages`` is ``(chunk_B, 1)``.

    :param log_probs: ``(chunk_B, T, V)`` fp32 log-softmax of the chunk's
        logits (the fused Function computes this inline per chunk).
    :type log_probs: torch.Tensor
    :param selected_token_ids: ``(chunk_B, T)`` target token ids.
    :type selected_token_ids: torch.Tensor
    :param attention_mask: ``(chunk_B, T)`` token-level action mask.
    :type attention_mask: torch.Tensor
    :param advantages: token mode ``(chunk_B, T)``; turn mode
        ``(chunk_B, max_turns)``; trajectory mode ``(chunk_B, 1)``.
    :type advantages: torch.Tensor
    :param full_attention_mask: ``(B, T)`` global mask used as the
        token-level reduction denominator (KL, and the policy-loss in
        token mode).
    :type full_attention_mask: torch.Tensor
    :param ref_per_token_logps: ``(chunk_B, T)`` reference logprobs (for
        the KL metric and, when ``beta > 0``, the KL penalty).
    :type ref_per_token_logps: torch.Tensor | None
    :param old_per_token_logps: ``(chunk_B, T)`` old-policy logprobs.
    :type old_per_token_logps: torch.Tensor | None
    :param epsilon_low: PPO clip lower bound.
    :type epsilon_low: float
    :param epsilon_high: PPO clip upper bound.
    :type epsilon_high: float
    :param beta: KL penalty weight (0 disables — REINFORCE folds KL into
        advantages upstream).
    :type beta: float
    :param turn_ids: ``(chunk_B, T)`` turn index per token, ``-1`` for
        non-action tokens. Required for the turn level.
    :type turn_ids: torch.Tensor | None
    :param full_turn_mask: ``(B, max_turns)`` global per-turn existence
        mask (used as the reduction denominator in turn mode).
    :type full_turn_mask: torch.Tensor | None
    :param max_turns: Total turn buckets across the batch.
    :type max_turns: int | None
    :param importance_sampling_level: Ratio-pooling granularity —
        ``"token"`` (default), ``"turn"`` or ``"trajectory"``.
    :type importance_sampling_level: str
    :param turn_log_ratio_reduction: Turn-level reduction for pooled log-ratios,
        one of ``"mean"`` or ``"sum"``.
    :type turn_log_ratio_reduction: str
    :param vllm_is_ratio: Optional detached, upper-clamped per-token vLLM
        sampling-mismatch ratio ``(chunk_B, T)`` (token mode only). When
        provided, the per-token policy loss is multiplied by it *before* the KL
        term, matching the standard PyTorch path. The per-token reweight cannot
        be pooled into the turn/trajectory ratio, so it is honoured for token
        mode only; ``None`` keeps the loss identical to the uncorrected path.
    :type vllm_is_ratio: torch.Tensor | None
    :param kl_clamp: Per-token K3 bound of the KL penalty (see
        :func:`k3_kl_penalty_reference`), or ``None`` for no bound.
    :type kl_clamp: float | None
    :param support_ids: ``(chunk_B, T, K)`` sampling support of each token,
        ``-1`` padded; a token with a support takes its logprob over that
        support alone. ``None`` normalizes over the full vocabulary.
    :type support_ids: torch.Tensor | None
    :return: ``(chunk_loss, [kl, clipfrac, pg_loss, entropy, kl_clamp_frac])`` — first
        element backprops; metrics are detached scalars contributing to
        the global mean across chunks.
    :rtype: tuple[torch.Tensor, list[torch.Tensor]]
    """
    if support_ids is None:
        per_token_logps = log_probs.gather(
            dim=-1, index=selected_token_ids.unsqueeze(-1)
        ).squeeze(-1)
    else:
        per_token_logps, support_log_z, restricted = support_scores(
            log_probs, support_ids, selected_token_ids
        )
        per_token_logps = per_token_logps - torch.where(
            restricted, support_log_z, torch.zeros_like(support_log_z)
        )

    if old_per_token_logps is None:
        # PPO/REINFORCE always pass old_log_probs; this guards against a
        # caller forgetting (ratio == 1, gradient still well-defined).
        old_per_token_logps = per_token_logps.detach()
    token_log_ratio = per_token_logps - old_per_token_logps

    # KL is logged regardless of whether it's added to the loss — REINFORCE
    # folds KL into advantages upstream and runs with beta=0 here, but
    # still wants the kl scalar for monitoring. KL stays token-level in
    # both branches (matches the unfused PPO/REINFORCE convention).
    kl_div: torch.Tensor | None = None
    kl_penalty: torch.Tensor | None = None
    kl_clamped: torch.Tensor | None = None
    if ref_per_token_logps is not None:
        kl_div = calculate_k3_kl(ref_per_token_logps, per_token_logps)
        penalty_reference, kl_clamped = k3_kl_penalty_reference(
            ref_per_token_logps, per_token_logps, kl_clamp
        )
        kl_penalty = calculate_k3_kl(penalty_reference, per_token_logps)

    token_global_count = full_attention_mask.float().sum().clamp(min=1.0)

    if importance_sampling_level == "token":
        if turn_ids is not None:
            # The level is authoritative; fail loudly on a stray turn_ids.
            msg = (
                "turn_ids was provided but importance_sampling_level='token'; "
                "pass importance_sampling_level='turn' for turn-level pooling."
            )
            raise ValueError(msg)
        # Token mode: ratio + clip + max-formula at token level.
        ratio = torch.exp(token_log_ratio)
        clipped_ratio = torch.clamp(ratio, 1.0 - epsilon_low, 1.0 + epsilon_high)
        pg_unit_loss = torch.max(-advantages * ratio, -advantages * clipped_ratio)
        if vllm_is_ratio is not None:
            # Truncated importance sampling: reweight each token by the
            # detached, upper-clam
```

### Core Architecture Module: `agilerl/algorithms/core/llm_ops/vision_lockstep.py`
```
# Copyright 2026 AgileRL
# SPDX-License-Identifier: Apache-2.0

"""Keep every rank's vision tower calls in step during a learn that has images on some rank.

FSDP2 shards vision blocks as their own units. A forward that skips the tower
skips their all-gathers, and with a trainable tower their gradient
reduce-scatters, while another rank's forward enters them, so both ranks hang.
"""

from __future__ import annotations

from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from typing import Any

import torch
from torch import nn
from transformers import PreTrainedModel
from transformers.utils import ModelOutput

from agilerl.algorithms.core.llm_ops.frozen_vision import VisionFeatureCache
from agilerl.distributed.process import allreduce_sum_ints, any_rank

__all__ = [
    "FILLER_METHOD",
    "PlannedImages",
    "VisionLockstep",
    "vision_language_module",
    "vision_lockstep",
]

#: Method a patched VL model class runs its vision tower on one filler image with.
FILLER_METHOD = "vision_filler_features"

ForwardOutput = torch.Tensor | tuple[torch.Tensor, ...] | ModelOutput
#: Cache keys of a planned forward's images, ``[]`` for none, or ``None`` for unkeyed images.
PlannedImages = list[int] | None


def vision_language_module(model: nn.Module) -> PreTrainedModel | None:
    """Submodule whose forward takes ``pixel_values`` and can run a filler image, or ``None``.

    Its forward runs the vision tower before calling its ``get_decoder()``.
    """
    return next(
        (
            module
            for module in model.modules()
            if isinstance(module, PreTrainedModel) and hasattr(module, FILLER_METHOD)
        ),
        None,
    )


def _tensors(value: object) -> Iterator[torch.Tensor]:
    """Every tensor in a nest of model outputs, tuples, lists and dicts."""
    if isinstance(value, torch.Tensor):
        yield value
    elif isinstance(value, dict):
        for item in value.values():
            yield from _tensors(item)
    elif isinstance(value, (list, tuple)):
        for item in value:
            yield from _tensors(item)


def _plus_zero(output: ForwardOutput, zero: torch.Tensor) -> ForwardOutput:
    """``output`` with ``zero`` added to its first tensor."""
    if isinstance(output, torch.Tensor):
        return output + zero
    if isinstance(output, tuple):
        return (output[0] + zero, *output[1:])
    key = next(iter(output.keys()))
    output[key] = output[key] + zero
    return output


class VisionLockstep:
    """Whether each forward must run the vision tower on some rank, as every rank agrees.

    :param cache: Vision feature cache of the learn step.
    """

    def __init__(self, cache: VisionFeatureCache) -> None:
        self.cache = cache
        self.planned: list[PlannedImages] = []
        self.agreed_runs: list[bool] = []
        self.forwards = 0

    @contextmanager
    def plan(self, forwards: Sequence[PlannedImages]) -> Iterator[None]:
        """Agree on the next forwards' tower calls in one all-reduce per run of new images; any later forward agrees alone.

        :param forwards: Images of each forward, in run order; every rank names as many.
        """
        self.planned, self.agreed_runs, self.forwards = list(forwards), [], 0
        try:
            self._agree()
            yield
        finally:
            self.planned, self.agreed_runs, self.forwards = [], [], 0

    def reuses(self, forward: int) -> bool:
        """Whether every rank already agreed that planned forward ``forward`` reuses cached features.

        :param forward: Index of the forward in the plan.
        """
        return forward < len(self.agreed_runs) and not self.agreed_runs[forward]

    def must_run(self, has_images: bool) -> bool:
        """Whether any rank must run the tower on the forward starting now.

        :param has_images: Whether this rank's forward has images.
        """
        if self.forwards == len(self.planned):
            return any_rank(has_images and not self.cache.covers())
        if self.forwards == len(self.agreed_runs):
            self._agree()
        self.forwards += 1
        return self.agreed_runs[self.forwards - 1]

    def _agree(self) -> None:
        """Agree on the next planned forwards, up to one whose images an earlier one stores."""
        remaining = self.planned[len(self.agreed_runs) :]
        if not remaining:
            return
        stored: set[int] = set()
        needs: list[int] = []
        repeats: list[int] = []
        for images in remaining:
            repeats.append(int(images is not None and not stored.isdisjoint(images)))
            covered = bool(images) and self.cache.reuse_dtype(images) is not None
            needs.append(int(images is None or (bool(images) and not covered)))
            if images and not covered and self.cache.tower is not None:
                stored.update(images)
        totals = allreduce_sum_ints(needs + repeats)
        count = len(remaining)
        end = next((k for k in range(1, count) if totals[count + k]), count)
        self.agreed_runs.extend(total > 0 for total in totals[:end])


@contextmanager
def vision_lockstep(
    module: PreTrainedModel, cache: VisionFeatureCache
) -> Iterator[VisionLockstep]:
    """Run ``module``'s vision tower on every rank's forward, or on none.

    Each forward, the ranks agree whether any must run the tower: one has
    images that ``cache`` lacks (:class:`VisionLockstep`). If none must, ranks
    with images reuse their cached features. Otherwise ranks with images run
    the tower, and a forward without images runs it on one zero image and adds
    zero times its features to the output, so the tower's forward and backward
    run there too. An empty ``pixel_values`` counts as no images.

    The zero image runs as ``module.get_decoder()`` starts, where a forward
    with images has already run the tower, so every rank gathers FSDP units
    computed before the tower (Gemma4 per-layer embeddings) in the same order.

    :param module: Module :func:`vision_language_module` returns.
    :param cache: Vision feature cache of the learn step.
    :return: The agreement, which callers can :meth:`VisionLockstep.plan` forwards on.
    """
    lockstep = VisionLockstep(cache)
    filler_devices: list[torch.device] = []
    pending: list[object] = []

    def agree(
        _module: nn.Module, args: tuple[Any, ...], kwargs: dict[str, Any]
    ) -> tuple[tuple[Any, ...], dict[str, Any]] | None:
        pixel_values = kwargs.get("pixel_values")
        has_images = pixel_values is not None and pixel_values.shape[0] > 0
        if not has_images:
            kwargs["pixel_values"] = None
        if not lockstep.must_run(has_images):
            cache.agreed = "reuse"
            return args, kwargs
        cache.agreed = "run"
        if has_images:
            return args, kwargs
        anchor = kwargs.get("input_ids")
        if anchor is None:
            anchor = kwargs["inputs_embeds"]
        filler_devices.append(anchor.device)
        return args, kwargs

    def run_filler(_module: nn.Module, _args: tuple[Any, ...]) -> None:
        if not filler_devices:
            return
        with cache.images(None):
            pending.append(getattr(module, FILLER_METHOD)(filler_devices.pop()))

    def add_filler(
        _module: nn.Module,
        _args: tuple[Any, ...],
        _kwargs: dict[str, Any],
        output: ForwardOutput,
    ) -> ForwardOutput | None:
        cache.agreed = None
        if not pending:
            return None
        features = [
            tensor.sum().float()
            for tensor in _tensors(pending.pop())
            if tensor.is_floating_point()
        ]
        return _plus_zero(output, torch.stack(features).sum() * 0)

    handles = [
        module.register_forward_pre_hook(agree, with_kwargs=True),
        module.get_decoder().register_forward_pre_hook(run_filler),
        module.register_forward_hook(add_filler, with_kwargs=True),
    ]
    try:
        yield lockstep
    finally:
        cache.agreed = None
        for handle in handles:
            handle.remove()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #584** (2026-07-22): **Fused LoRA routing crashes on models that flatten activations before MLP linears (e.g. OPT)**
  *Symptoms*: ### Symptom  Fused multi-adapter LoRA routing (`set_fused_adapter_routing`) crashes inside PEFT for models whose MLP flattens `(batch, seq, hidden)` → `(batch * seq, hidden)` before the LoRA-wrapped linears. E.g. `facebook/opt-125m` on the GRPO fused-forward path:  ``` ValueError: Length of `adapter_names` should be the same as the number of inputs, but got 4 and 4096 respectively. ```  Reproduced locally on a tiny OPT (batch=2, seq=5 → `got 2 and 10`).  ### What's wrong  `_fused_routing_pre_hook` (`agilerl/algorithms/core/llm_ops/fused_lora.py`) injects the per-row routing list (length == batch) verbatim into every LoRA layer's forward. But PEFT's `_check_forward_args` requires `len(adapter_names) == x.shape[0]` for *each* layer's input, and `_mixed_batch_forward` indexes `x[i]` by `adapter_names[i]`. This silently assumes every LoRA-wrapped linear sees `batch` as its leading dimension.  That holds for Qwen/Llama, but not for models that flatten before their MLP linears:  - `opt` — `hidden_states.reshape(-1, hidden)` before `fc1`/`fc2` - MoE routers — `switch_transformers`, `nllb_moe` - multimodal — `aria`  There the MLP linears see `x.shape[0] = batch * seq`, so the batch-sized routing mismatches → the `ValueError`. Attention linears keep `(batch, seq, hidden)` and still match, which is why only some layers trip.  ### Fix direction  Align the per-row routing to the actual leading dim each LoRA layer sees: when the leading dim is a whole multiple of the routing length, repea

- **Issue #468** (2026-02-10): **Bad performance when using ContinuousQNetwork with layer_norm=True**
  *Symptoms*: **What version of AgileRL are you using?** 2.4.2  **What did you do?** Run `python -m benchmarking.benchmarking_off_policy` with the following config (encoder is by default True in `EvolvableMLP`): ``` --- # Define initial hyperparameters INIT_HP:     ENV_NAME: LunarLanderContinuous-v3   # Gym environment name     ALGO: DDPG                           # Algorithm     # Swap image channels dimension from last to first [H, W, C] -> [C, H, W]     CHANNELS_LAST: false     NUM_ENVS: 16               # No. parallel environments for training     O_U_NOISE: true            # Ornstein-Uhlenbeck action noise     EXPL_NOISE: 0.1            # Action noise scale     MEAN_NOISE: 0.             # Mean action noise     THETA: 0.15                # Rate of mean reversion in OU noise     DT: 0.01                   # Timestep for OU noise     BATCH_SIZE: 128            # Batch size     LR_ACTOR: 0.0003           # Actor learning rate     LR_CRITIC: 0.0003           # Critic learning rate     MAX_STEPS: 1_000_000       # Max no. steps     TARGET_SCORE: 200.         # Early training stop at avg score of last 100 episodes     GAMMA: 0.99                # Discount factor     MEMORY_SIZE: 100_000       # Max memory buffer size     POLICY_FREQ: 2             # Policy update frequency     LEARN_STEP: 2             # Learning frequency     TAU: 0.005                 # For soft update of target parameters     TOURN_SIZE: 2              # Tournament size     ELITISM: true              # Elitism in tournam
  **Post-Mortem & Fix Analysis**:
  > Solved in https://github.com/AgileRL/AgileRL/issues/468

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

### Incident Patch 1: `c2b3e348` (2026-10-26)
**Commit Message**: fix: MoE routers under activation checkpointing, vision models, FSDP2, rollout logprobs and memory estimates

- MoE: top-k router renormalization runs out of place for every catalog MoE family that renormalizes in place (Qwen3-MoE, Qwen3-Next, Qwen3-Omni, Qwen3.5/3.6-MoE, Qwen3-VL-MoE, Gemma 4, Qwen2-MoE, OLMoE, FlexOlmo, Mellum, Qwen4Exp, Mixtral, MiniMax). Selective activation checkpointing of MoE blocks no longer fails in backward.
- FSDP2: units that have not run forward keep gradient sync on during gradient accumulation, which avoids a torch 2.13 post-backward crash (for example a frozen vision tower in text-only training). `wrap_every_n_blocks > 1` keeps checkpoint parameter names. Gemma 4 RoPE buffers are built per layer type.
- Qwen3.5/3.6 gated delta net: `seq_idx` is computed once in the text-model forward, which fixes a crash at micro-batch 1 under checkpointing. Multi-row packed batches keep document boundaries. The expert-parallel count exchange runs outside dispatch modes. Class-patched `LigerExperts` run split expert LoRA with SiLU.
- Logprobs: the final-logit softcap (Gemma 4) is applied in fused logprobs and in the Liger losses that support it; GRPO-family objectiv

**File**: `agilerl-arena/README.md` (modified, +3/-0)
```diff
@@ -61,6 +61,9 @@ arena env validate --source path/to/my_env.py --name my-env
 ```bash
 arena memory estimate path/to/manifest.yaml --gpu "NVIDIA L4"
 
+# An unset engine width or max_num_seqs is resolved from the node's GPUs:
+arena memory estimate path/to/manifest.yaml --gpu "NVIDIA L4" --num-gpus 4
+
 # Longest context one dedicated L4 serving GPU can hold:
 arena memory solve max_model_len --inference --gpu "NVIDIA L4" \
     --model Qwen/Qwen2.5-7B-Instruct
```

**File**: `agilerl-arena/agilerl/arena/memory/README.md` (modified, +6/-0)
```diff
@@ -15,6 +15,11 @@ to resolve a Hugging Face model id (metadata only).
 
 Exit 0 if both phases fit, 3 if either is over budget, 2 on a usage error.
 
+A manifest that leaves `vllm_config.tensor_parallel_size` or `max_num_seqs`
+unset (with `rollout_engines_per_agent: auto`) gets them from the node's GPU
+count, as the run does. Pass `--num-gpus` with `--gpu` or `--device-gb`; a
+resource tier brings its own count.
+
 Training and generation are separate peaks on separate devices. Resource
 selection uses the larger bar. The estimate errs high.
 
@@ -36,6 +41,7 @@ buffer as `estimate`. `--inference` is a dedicated serving GPU
 | `manifest.py` | manifest + GPU → `RunConfig` |
 | `formulas.py` | parameter counts, KV, activations, tiles |
 | `estimator.py` | the two phase bars |
+| `trainer_residency.py` | frozen base weights and allocator slack on one training GPU |
 | `advice.py` | ranked setting changes when a bar is over budget |
 | `solver.py` | invert one field: largest value that still fits |
 | `resources.py` | cheapest Arena resource tier whose node fits a manifest |
```

**File**: `agilerl-arena/agilerl/arena/memory/advice.py` (modified, +17/-0)
```diff
@@ -120,6 +120,23 @@ def _generation_candidates(
 ) -> list[tuple[str, Callable[[RunConfig], RunConfig]]]:
     g = config.generation
     candidates: list[tuple[str, Callable[[RunConfig], RunConfig]]] = []
+    stripped = next(
+        (v.name for v in config.model.variants if v.stripped_multimodal), None
+    )
+    if (
+        stripped is not None
+        and not config.model.variant(g.weight_variant).stripped_multimodal
+        and config.training.images_per_row == 0
+    ):
+        candidates.append(
+            (
+                (
+                    "Skip the multimodal towers in the engine "
+                    "(strip_multimodal_towers=True; text-only envs)"
+                ),
+                _update("generation", weight_variant=stripped),
+            )
+        )
     if not g.enforce_eager:
         candidates.append(
             (
```

**File**: `agilerl-arena/agilerl/arena/memory/cli.py` (modified, +203/-133)
```diff
@@ -15,6 +15,7 @@
 import logging
 import math
 import sys
+from collections.abc import Callable
 from dataclasses import dataclass
 from pathlib import Path
 from typing import Any
@@ -36,13 +37,18 @@
     lookup_gpu,
     run_config_from_manifest,
 )
-from agilerl.arena.memory.resolve.engine import resolve_engine_tensor_parallel
-from agilerl.arena.memory.resources import TierCheck, check_tiers
+from agilerl.arena.memory.resources import (
+    TierCheck,
+    check_tiers,
+    engine_width,
+    engines_per_member,
+)
 from agilerl.arena.memory.solver import (
     INFERENCE_GPU_MEMORY_UTILIZATION,
     INFERENCE_MAX_NUM_SEQS,
     SOLVABLE_FIELDS,
     CannotSolve,
+    SolveResult,
     architectural_context_limit,
     inference_run_config,
     solve,
@@ -55,7 +61,6 @@
     ModelArch,
     ModelSpec,
     RunConfig,
-    TrainingSettings,
 )
 from agilerl.arena.models.algorithms.rollout_llm import RolloutLLMSpec
 from agilerl.arena.models.manifest import TrainingManifest
@@ -328,6 +333,41 @@ def _resolve_device(
     return None
 
 
+def _allocation_layout(
+    manifest: TrainingManifest, num_gpus: int | None, device: DeviceSpec
+) -> tuple[int | None, int | None]:
+    """Engine width and engines per member the run starts on ``num_gpus``; ``None`` reads the manifest.
+
+    :raises ValueError: The run picks them from a GPU count and ``num_gpus``
+        is unset, or the node has too few GPUs.
+    """
+    if num_gpus is not None:
+        width = engine_width(manifest, num_gpus, device)
+        return width, engines_per_member(manifest.training, num_gpus, width)
+    spec = manifest.algorithm
+    if not isinstance(spec, RolloutLLMSpec) or spec.vllm_config is None:
+        return None, None
+    vllm = spec.vllm_config
+    training = manifest.training
+    if vllm.tensor_parallel_size is None:
+        msg = (
+            "tensor_parallel_size is unset, so the run picks it from the node's "
+            "GPUs; pass --num-gpus."
+        )
+        raise ValueError(msg)
+    if (
+        training.async_rollout
+        and training.rollout_engines_per_agent == "auto"
+        and vllm.max_num_seqs is None
+    ):
+        msg = (
+            "max_num_seqs is unset with auto rollout engines, so the run splits "
+            "it across the engines the node's GPUs give; pass --num-gpus."
+        )
+        raise ValueError(msg)
+    return None, None
+
+
 @click.group("memory")
 def memory_group() -> None:
     """Estimate GPU memory, or solve one setting against a card."""
@@ -357,6 +397,15 @@ def memory_group() -> None:
     default=None,
     help="Rollout-engine GPU memory in GiB for async manifests.",
 )
+@click.option(
+    "--num-gpus",
+    type=click.IntRange(min=1),
+    default=None,
+    help=(
+        "GPUs on the node the run gets (the tier's num_gpus). Needed when the "
+        "run picks tensor_parallel_size or max_num_seqs from it."
+    ),
+)
 @click.option(
     "--config",
     "config_path",
@@ -382,6 +431,7 @@ def memory_estimate(
     device_gb: float | None,
     gen_gpu: str | None,
     gen_device_gb: float | None,
+    num_gpus: int | None,
     config_path: str | None,
     as_json: bool,
     no_color: bool,
@@ -405,6 +455,7 @@ def memory_estimate(
             tiers=tiers,
             gen_gpu=gen_gpu,
             gen_device_gb=gen_device_gb,
+            num_gpus=num_gpus,
             config_path=config_path,
             as_json=as_json,
             no_color=no_color,
@@ -420,6 +471,7 @@ def main(
     tiers: list[dict[str, Any]] | None = None,
     gen_gpu: str | None = None,
     gen_device_gb: float | None = None,
+    num_gpus: int | None = None,
     config_path: str | None = None,
     as_json: bool = False,
     no_color: bool = False,
@@ -428,6 +480,7 @@ def main(
 
     :param tiers: Resource tiers to pick the cheapest fitting one from when
         neither ``gpu`` nor ``device_gb`` is given.
+    :param num_gpus: GPUs on the node, for the engine layout the run picks.
     """
     try:
         device = _resolve_device(
@@ -449,6 +502,12 @@ def main(
     if device is None and gen_device is not None:
         print("--gen-gpu/--gen-device-gb needs --gpu or --device-gb.", file=sys.stderr)
         return EXIT_USAGE
+    if device is None and num_gpus is not None:
+        print(
+            "--num-gpus needs --gpu or --device-gb; a resource tier names its own.",
+            file=sys.stderr,
+        )
+        return EXIT_USAGE
 
     try:
         manifest = TrainingManifest.get_validated(manifest_path, mode="python")
@@ -479,64 +538,33 @@ def main(
             file=sys.stderr,
         )
 
-    scored_width: int | None = None
-    unresolved = (
-        isinstance(spec, RolloutLLMSpec)
-        and spec.vllm_config is not None
-        and spec.vllm_config.tensor_parallel_size is None
-    )
-
-    def build_config(train_device: DeviceSpec) -> RunConfig:
+    def build_config(
+        train_device: DeviceSpec, width: int | None, engines: int
```

**File**: `agilerl-arena/agilerl/arena/memory/estimator.py` (modified, +260/-130)
```diff
@@ -16,6 +16,7 @@
 from pydantic import BaseModel, ConfigDict
 
 import agilerl.arena.memory.formulas as formulas
+import agilerl.arena.memory.vision as vision
 from agilerl.arena.memory.breakdown import MemoryComponent, PhaseBreakdown
 from agilerl.arena.memory.formulas import geometry_gap_warning
 from agilerl.arena.memory.resolve.chunk import resolve_chunk_rows
@@ -33,6 +34,10 @@
     RunConfig,
     TrainingSettings,
 )
+from agilerl.arena.memory.trainer_residency import (
+    trainer_allocator_slack,
+    trainer_base_bytes,
+)
 from agilerl.arena.models.fsdp import FSDPConfig
 
 
@@ -80,24 +85,39 @@ def engine_terms(
         if settings.weight_quantization == "fp8"
         else DTYPE_BYTES[settings.weight_dtype]
     )
-    weights = int(weight_elems / DTYPE_BYTES[settings.weight_dtype] * weight_byte / tp)
-    terms = {
-        "weights": weights,
-        "startup_peak": formulas.block_recompute_bytes(
+    unsharded_weights = weight_elems / DTYPE_BYTES[settings.weight_dtype] * weight_byte
+    weights = int(unsharded_weights / tp)
+    decoder_startup = (
+        formulas.block_recompute_bytes(
             arch,
             1,
             batched_tokens,
             act_bytes,
             engine_forward=True,
         )
-        + sampler,
+        + sampler
+    )
+    terms = {
+        "weights": weights,
+        "startup_peak": _with_encoder_profile(
+            model, settings, batched_tokens, decoder_startup
+        ),
         "cuda_graphs": 0 if settings.enforce_eager else formulas.CUDA_GRAPH_POOL_BYTES,
         "lora_slots": int(
             settings.max_loras
             * formulas.lora_param_count(arch, settings.max_lora_rank)
             * act_bytes
             / tp
-        ),
+        )
+        + settings.max_loras
+        * formulas.engine_expert_lora_param_count(
+            arch,
+            settings.max_lora_rank,
+            tp,
+            packed_3d=arch.vllm_3d_moe_lora or settings.lora_packed_target_matrices > 0,
+        )
+        * act_bytes,
+        "engine_runtime": int(formulas.ENGINE_RUNTIME_FRACTION * unsharded_weights),
         "kv_demand": _kv_demand_per_rank(arch, settings),
         "mamba_state": formulas.mamba_state_bytes(
             arch,
@@ -109,6 +129,35 @@ def engine_terms(
     return terms, batched_tokens, sampler
 
 
+def _with_encoder_profile(
+    model: ModelSpec,
+    settings: GenerationSettings,
+    batched_tokens: int,
+    decoder_bytes: int,
+) -> int:
+    """Activation peak of a decoder pass that follows vLLM's maximum-image encode.
+
+    :param batched_tokens: The engine's resolved scheduler-step token cap.
+    :param decoder_bytes: Decoder activation and sampler bytes of the pass.
+    """
+    if model.variant(settings.weight_variant).stripped_multimodal:
+        return decoder_bytes
+    items = vision.encoder_profile_items(
+        model.arch,
+        batched_tokens,
+        settings.max_num_seqs,
+        settings.max_model_len,
+        settings.max_images_per_prompt,
+    )
+    encoder, outputs = vision.encoder_profile_bytes(
+        model.arch,
+        DTYPE_BYTES[settings.weight_dtype],
+        settings.tensor_parallel_size,
+        items,
+    )
+    return max(decoder_bytes + outputs, encoder)
+
+
 def _kv_demand_per_rank(arch: ModelArch, settings: GenerationSettings) -> int:
     """KV bytes on one engine rank, replicating heads when TP exceeds them."""
     demand = formulas.kv_cache_demand_bytes(
@@ -257,7 +306,8 @@ def estimate_generation(
     lora_slots = terms["lora_slots"]
     kv_demand = terms["kv_demand"]
     mamba_state = terms["mamba_state"]
-    non_kv = weights + startup_peak + graphs + lora_slots + mamba_state
+    engine_runtime = terms["engine_runtime"]
+    non_kv = weights + startup_peak + graphs + lora_slots + mamba_state + engine_runtime
     kv_pool = (
         settings.kv_cache_memory_bytes
         if settings.kv_cache_memory_bytes is not None
@@ -285,15 +335,18 @@ def estimate_generation(
     )
     runtime_tokens = min(settings.concurrency * settings.prompt_len, batched_tokens)
     job_overhead = formulas.JOB_OVERHEAD_BYTES if orchestrated else 0
-    runtime_activation = (
+    runtime_activation = _with_encoder_profile(
+        model,
+        settings,
+        batched_tokens,
         formulas.block_recompute_bytes(
             arch,
             1,
             runtime_tokens,
             act_bytes,
             engine_forward=True,
         )
-        + sampler
+        + sampler,
     )
     components = (
         MemoryComponent(
@@ -362,10 +415,11 @@ def estimate_generation(
         MemoryComponent(
             key="overhead",
             label="Overhead (CUDA context, runtime)",
-            n_bytes=max(int(device.context_bytes + job_overhead), 0),
+            n_bytes=max(int(device.context_bytes + job_overhead + engine_runtime), 0),
             detail={
                 "cuda_context": int(device.context_bytes),
                 "job_overhead":
```

**File**: `agilerl-arena/agilerl/arena/memory/formulas.py` (modified, +287/-32)
```diff
@@ -26,6 +26,14 @@
 # enforce_eager. It cancels in the generation total: subtracted from the KV
 # budget, added back as residency.
 CUDA_GRAPH_POOL_BYTES = 256 * MiB
+# vLLM's non-torch memory (kernel workspaces, loaded kernels, NCCL), as a share
+# of the unsharded engine weights, charged on every rank. vLLM counts it inside
+# the gpu_memory_utilization budget. Qwen3.6-35B-A3B on A100 80GB under vLLM
+# 0.32 logged 2.49 GiB at TP=1 and 2.31 GiB at TP=2 (3.8% and 3.5% of 65.4 GiB),
+# so it does not shrink with TP; the L4 KV pools of Qwen3-4B and granite-3.1
+# cap it near 3.6%. Fit only on vLLM 0.32, those three models (3B to 35B
+# weights) and TP 1 to 2; larger models and wider TP are extrapolated.
+ENGINE_RUNTIME_FRACTION = 0.036
 # Bytes per LoRA parameter under flat data parallel. PEFT
 # ``autocast_adapter_dtype=True`` stores adapters and their gradients in
 # fp32. AdamW keeps two fp32 moments per parameter.
@@ -46,15 +54,28 @@
 # over 64-1024 MiB; the H100 80GB VWA busiest rank rose 0.69 GiB from 256 to
 # 512 MiB. 0.45 keeps the estimate at or above the H100 peak at 512 MiB.
 ROUTED_CHUNK_LIVE_FRACTION = 0.45
+# Chunk-sized buffers the sorted path's contracted expert LoRA keeps live in
+# the MoE backward (the up-projection output, its gradient and their casts).
+# granite-3.1-3b-a800m FSDP: 4 puts the L4 512 MiB rows at -2.5%/-1.6% and the
+# A100 rows at +0.8% to +2.4%; 4.5 pushes A100 past +4%.
+CONTRACTED_CHUNK_LIVE_MULTIPLE = 4
 
 # PyTorch caching-allocator slack: reserved above allocated.
 # Charged on the torch-side subtotal. Training only: generation sits in
 # vLLM's CuMem pool, reserved up front at ``gpu_memory_utilization``.
 ALLOCATOR_RESERVE_FRACTION = 0.07
-# Flat data parallel keeps an all-reduce buffer. FSDP pools all-gather and
-# reduce-scatter blocks per stream, so it reserves a larger share.
+# Flat data parallel keeps an all-reduce buffer.
 ALLOCATOR_RESERVE_FRACTION_DATA_PARALLEL = 0.054
-ALLOCATOR_RESERVE_FRACTION_FSDP = 0.069
+# FSDP compute stream; the all-gather stream's pool is charged separately
+# (:func:`fsdp_gather_pool_params`). Blocks without fp32 temporaries free
+# bf16 tensors the next activations reuse: dense Qwen, Nemotron-H and
+# LLMPPO rows on A100 and L4 left 0-2.3% of allocated free.
+ALLOCATOR_RESERVE_FRACTION_FSDP = 0.02
+# Stock fp32 RMSNorm temporaries leave hidden-sized holes: granite-3.1,
+# granite-4.0 and Gemma 4 rows left 2-11% free, most at long context. EP
+# dispatch buffers change size with routing; Super-VL A100 rank-0 peaks
+# need 0.064.
+ALLOCATOR_RESERVE_FRACTION_FSDP_MIXED_SIZES = 0.064
 # Largest share by which a measured peak exceeded the estimate on the 4-GPU
 # grids. A GPU recommendation keeps this share of usable memory free.
 MAX_UNDERPREDICTION = 0.089
@@ -66,10 +87,19 @@ def recommendation_fits(predicted_bytes: int, usable_bytes: int) -> bool:
 
 
 def allocator_reserve_bytes(
-    allocated_bytes: float, n_ranks: int = 1, sharded: bool = False
+    allocated_bytes: float,
+    n_ranks: int = 1,
+    sharded: bool = False,
+    mixed_sizes: bool = False,
 ) -> float:
-    """Caching-allocator reserved-but-unallocated bytes."""
-    if sharded:
+    """Caching-allocator reserved-but-unallocated bytes on the compute stream.
+
+    :param mixed_sizes: The step frees tensors the next activations do not
+        fit (fp32 norm temporaries, expert-parallel dispatch buffers).
+    """
+    if sharded and mixed_sizes:
+        fraction = ALLOCATOR_RESERVE_FRACTION_FSDP_MIXED_SIZES
+    elif sharded:
         fraction = ALLOCATOR_RESERVE_FRACTION_FSDP
     elif n_ranks > 1:
         fraction = ALLOCATOR_RESERVE_FRACTION_DATA_PARALLEL
@@ -270,6 +300,34 @@ def packed_lora_param_count(arch: ModelArch, rank: int, n_matrices: int) -> int:
     return int(arch.moe_layers * n_matrices * per_matrix)
 
 
+def engine_expert_lora_param_count(
+    arch: ModelArch, rank: int, tensor_parallel: int, packed_3d: bool
+) -> int:
+    """Per-rank parameters of one vLLM fused-MoE LoRA slot.
+
+    :param arch: Model architecture.
+    :param rank: Engine LoRA rank.
+    :param tensor_parallel: Engine tensor-parallel width.
+    :param packed_3d: The engine uses the 3D expert layout.
+    :return: Slot parameters on one rank; 0 for a dense model.
+    """
+    n_experts = arch.n_experts
+    if n_experts is None or n_experts <= 1:
+        return 0
+    h = arch.expert_width
+    # vLLM wraps every fused-MoE layer once LoRA is on, whatever the adapter
+    # targets: w13 and w2 A/B stacks over all experts, intermediate dim TP-sharded.
+    inter = (arch.expert_intermediate_size or arch.intermediate_size) // tensor_parallel
+    # The 3D layout packs gate and up into one w13 slice; the 2D layout keeps
+    # one slice each when the MLP is gated.
+    if packed_3d:
+        per_expert = 2 * h + 3 * inter
+    else:
+        slices = 2 if arch.gated_mlp else 1
+        per_expert = slices * h + h + (slices + 1) * inter
+    return int(arch.moe_layers * n_e
```

**File**: `agilerl-arena/agilerl/arena/memory/manifest.py` (modified, +94/-35)
```diff
@@ -52,7 +52,11 @@
 from agilerl.arena.models.algorithms.grpo import GRPOSpec
 from agilerl.arena.models.algorithms.llmppo import LLMPPOSpec
 from agilerl.arena.models.algorithms.llmreinforce import LLMREINFORCESpec
-from agilerl.arena.models.algorithms.rollout_llm import RolloutLLMSpec
+from agilerl.arena.models.algorithms.rollout_llm import (
+    RolloutLLMSpec,
+    records_sampling_supports,
+)
+from agilerl.arena.models.env import LLMEnvSpec
 from agilerl.arena.models.manifest import TrainingManifest
 from agilerl.arena.models.model_info import SUPPORTED_MODEL_INFO
 from agilerl.arena.models.networks import LoraConfigDict, VLLMConfig
@@ -75,6 +79,12 @@
     {"q_proj", "k_proj", "v_proj", "o_proj", "qkv_proj", "query", "key", "value"}
 )
 
+# The engine variant drops the multimodal towers; a model without towers sizes it as base.
+MANIFEST_WEIGHT_VARIANTS = (
+    WeightVariant(),
+    WeightVariant(name="engine", stripped_multimodal=True),
+)
+
 # Must match max_num_batched_tokens in the framework's FAMILY_RUNTIME_CONFIGS.
 FAMILY_MAX_NUM_BATCHED_TOKENS: dict[str, int] = {
     "nemotron_h": 8192,
@@ -105,6 +115,8 @@ def device_spec(self) -> DeviceSpec:
 # The accelerators Arena resource classes are built from, in match order —
 # longer tokens first, because "A100" contains "A10" and "L40S" contains
 # "L4". Matched against the tier's ``gpu_type`` after normalisation.
+# ``total_gib`` is CUDA-visible memory (``torch.cuda.mem_get_info`` total):
+# measured on A100-80 and L4, nominal on the rest.
 GPU_CATALOGUE: tuple[tuple[str, GpuInfo], ...] = (
     ("H200", GpuInfo(name="NVIDIA H200", total_gib=141, cc_major=9, cc_minor=0)),
     (
@@ -113,15 +125,15 @@ def device_spec(self) -> DeviceSpec:
     ),
     (
         "A100-80",
-        GpuInfo(name="NVIDIA A100-SXM4-80GB", total_gib=80, cc_major=8, cc_minor=0),
+        GpuInfo(name="NVIDIA A100-SXM4-80GB", total_gib=79.25, cc_major=8, cc_minor=0),
     ),
     (
         "A100",
         GpuInfo(name="NVIDIA A100-SXM4-40GB", total_gib=40, cc_major=8, cc_minor=0),
     ),
     ("A10", GpuInfo(name="NVIDIA A10G", total_gib=24, cc_major=8, cc_minor=6)),
     ("L40", GpuInfo(name="NVIDIA L40S", total_gib=48, cc_major=8, cc_minor=9)),
-    ("L4", GpuInfo(name="NVIDIA L4", total_gib=24, cc_major=8, cc_minor=9)),
+    ("L4", GpuInfo(name="NVIDIA L4", total_gib=22.03, cc_major=8, cc_minor=9)),
     ("T4", GpuInfo(name="Tesla T4", total_gib=16, cc_major=7, cc_minor=5)),
     (
         "V100",
@@ -332,17 +344,23 @@ def check_fp8_moe_backend_for_device(
 
 
 def _max_num_seqs(
-    manifest: TrainingManifest, spec: LLMAlgorithmSpec, vllm: VLLMConfig
+    manifest: TrainingManifest,
+    spec: LLMAlgorithmSpec,
+    vllm: VLLMConfig,
+    rollout_engines: int | None,
 ) -> int:
     """The manifest's ``max_num_seqs``, else sequences one engine decodes.
 
-    ``auto`` counts as one engine.
+    Without ``rollout_engines``, ``auto`` counts as one engine.
     """
     training = manifest.training
     prompts = 0
     if vllm.max_num_seqs is None and training.async_rollout:
         engines = training.rollout_engines_per_agent
-        n_engines = 1 if engines == "auto" else int(engines)
+        if rollout_engines is not None:
+            n_engines = rollout_engines
+        else:
+            n_engines = 1 if engines == "auto" else int(engines)
         # Async validation sets an unset rollout_batch_size to 1.
         rollout_batch_size = int(training.rollout_batch_size or 1)
         prompts = prompts_per_engine(rollout_batch_size, n_engines)
@@ -367,15 +385,9 @@ def _max_num_batched_tokens(spec: LLMAlgorithmSpec, vllm: VLLMConfig) -> int | N
 def _resolve_vllm(spec: LLMAlgorithmSpec) -> VLLMConfig:
     """The engine config the run starts, checked against what this estimator sizes."""
     # SFT and DPO start no engine; their generation bar is ignored.
-    if not isinstance(spec, RolloutLLMSpec):
+    if not isinstance(spec, RolloutLLMSpec) or spec.vllm_config is None:
         return VLLMConfig()
     vllm = spec.vllm_config
-    if vllm is None:
-        msg = (
-            f"{spec.name} names no vllm_config; this estimator sizes vLLM rollout "
-            "only, so name the rollout engine config."
-        )
-        raise ValueError(msg)
     model = vllm.vllm_model_name_or_path
     if model is not None and model != spec.pretrained_model_name_or_path:
         msg = (
@@ -439,12 +451,35 @@ def _reject_unbounded_liger_loss(spec: LLMAlgorithmSpec) -> None:
         raise ValueError(msg)
 
 
+def image_inputs(manifest: TrainingManifest) -> tuple[int, int, int]:
+    """Images per completion row and the size the environment renders them at.
+
+    :param manifest: Validated manifest.
+    :return: ``(images_per_row, width, height)``; zeros without image fields.
+    """
+    env = manifest.environment
+    if not isinstance(env, LLMEnvSpec) or not (
+        env.screenshot_field or env.goal_images_field
+    ):
+        return 0, 0, 0
+    # BrowserGym
```

**File**: `agilerl-arena/agilerl/arena/memory/resolve/engine.py` (modified, +14/-17)
```diff
@@ -7,15 +7,12 @@
 from typing import Literal
 
 from agilerl.arena.memory.estimator import estimate_generation, generation_can_serve
-from agilerl.arena.memory.manifest import generation_settings_from_manifest
-from agilerl.arena.memory.solver import solve
-from agilerl.arena.memory.specs import (
-    DeviceSpec,
-    ModelArch,
-    ModelSpec,
-    RunConfig,
-    WeightVariant,
+from agilerl.arena.memory.manifest import (
+    MANIFEST_WEIGHT_VARIANTS,
+    generation_settings_from_manifest,
 )
+from agilerl.arena.memory.solver import solve
+from agilerl.arena.memory.specs import DeviceSpec, MiB, ModelArch, ModelSpec, RunConfig
 from agilerl.arena.models.algorithms.rollout_llm import RolloutLLMSpec
 from agilerl.arena.models.manifest import TrainingManifest
 from agilerl.arena.models.model_info import SUPPORTED_MODEL_INFO
@@ -84,28 +81,26 @@ def resolve_engine_tensor_parallel(
     if not candidates:
         return None
 
-    settings = generation_settings_from_manifest(
-        manifest, tensor_parallel_size=candidates[0][0]
-    )
     counted = info.inspected["num_params"]
     n_params = counted if isinstance(counted, int) else None
-    variants = [WeightVariant()]
-    if settings.weight_variant == "engine":
-        variants.append(WeightVariant(name="engine", stripped_multimodal=True))
     model = ModelSpec(
         model_id=hub_id,
         arch=ModelArch.from_hf_config(info.config),
         n_params=n_params,
-        variants=tuple(variants),
+        variants=MANIFEST_WEIGHT_VARIANTS,
     )
     pinned = "max_num_seqs" in vllm.model_fields_set
+    # The predicted KV pool runs 0.01-0.44 GiB above vLLM 0.32's measured pool
+    # (L4 drift rows; Qwen3.6-35B-A3B on A100 at TP=1 and 2), and vLLM preempts
+    # once demand passes the pool, so a width must clear demand by this much.
+    kv_margin = 512 * MiB
 
     def resident_sequences(width: int, engines: int) -> int:
         trial = generation_settings_from_manifest(manifest, tensor_parallel_size=width)
         try:
             if pinned:
                 breakdown = estimate_generation(model, device, trial)
-                if not generation_can_serve(breakdown):
+                if not generation_can_serve(breakdown, kv_margin):
                     return 0
                 return engines * trial.max_num_seqs
             run = RunConfig(
@@ -114,7 +109,9 @@ def resident_sequences(width: int, engines: int) -> int:
                 gen_device=device,
                 generation=trial,
             )
-            solved = solve(run, "max_num_seqs", phases=("generation",))
+            solved = solve(
+                run, "max_num_seqs", phases=("generation",), kv_margin_bytes=kv_margin
+            )
         except ValueError:
             # Illegal Mamba TP widths raise; a width that cannot be solved scores 0.
             return 0
```

---

### Incident Patch 2: `3fdcd9e1` (2026-10-22)
**Commit Message**: fix(fsdp): do not save the routed EP counts copy in packed-expert block checkpoints

Selective checkpointing on packed-expert blocks saves every device-to-host copy. Routed expert-parallel counts skip that copy on recompute, so the next host copy (grouped-matmul fallback `.tolist()`, or actor/critic adapter ids) replayed a stale counts tensor and crashed with `split_with_sizes(): found element of type list at pos 0`.

The routed counts copy is now flagged and not saved, so the saved copies stay in order and the recompute adds no host syncs. This hits expert-parallel training with gradient checkpointing on packed-expert blocks when the grouped-matmul fallback runs (GPUs other than compute capability 9/10, non-bf16, or unaligned sizes) or with actor/critic rows. Peak GPU memory is unchanged.

Hub-RevId: df07464da57ffa625f40299296e14b151df08e8c

**File**: `agilerl/distributed/ep_forward.py` (modified, +8/-0)
```diff
@@ -349,6 +349,12 @@ def __exit__(self, *_exc: object) -> None:
     "routed_counts_scope", default=None
 )
 
+# Set while a routed EP call copies its counts to host. The recompute replays
+# those counts without the copy, so a checkpoint must not save it.
+COPYING_ROUTED_COUNTS: ContextVar[bool] = ContextVar(
+    "copying_routed_counts", default=False
+)
+
 
 def routed_counts_contexts() -> tuple[RoutedCountsScope, RoutedCountsScope]:
     """``checkpoint`` ``context_fn``: the recompute reuses the forward's routed EP counts.
@@ -377,7 +383,9 @@ def _routed_counts(send: torch.Tensor, exchange: TokenExchange) -> RoutedCounts:
         )
         return recorded
     received = exchange_expert_counts(send, exchange.ep_group, exchange.ep_degree)
+    copying = COPYING_ROUTED_COUNTS.set(True)
     send_lists, received_lists = torch.stack((send, received)).tolist()
+    COPYING_ROUTED_COUNTS.reset(copying)
     counts = RoutedCounts(send, received, send_lists, received_lists)
     if scope is not None:
         scope.calls.append(counts)
```

**File**: `agilerl/distributed/expert_parallel.py` (modified, +2/-0)
```diff
@@ -34,6 +34,7 @@
     token_dispatch,
 )
 from agilerl.distributed.ep_forward import (
+    COPYING_ROUTED_COUNTS,
     ROUTED_COUNTS_SCOPE,
     CombinedBlock,
     DispatchedBlock,
@@ -75,6 +76,7 @@
 from agilerl.lora.fused import patch_lora_for_fused_forward
 
 __all__ = [
+    "COPYING_ROUTED_COUNTS",
     "ROUTED_COUNTS_SCOPE",
     "AllToAllCtx",
     "AllToAllVar",
```

**File**: `agilerl/distributed/fsdp_blocks.py` (modified, +8/-1)
```diff
@@ -35,6 +35,7 @@
 from agilerl.architectures.nemotron_h.mamba import block_type_mask_mapping
 from agilerl.arena.models.fsdp import FSDPConfig
 from agilerl.distributed.expert_parallel import (
+    COPYING_ROUTED_COUNTS,
     iter_packed_expert_modules,
     routed_counts_contexts,
 )
@@ -449,7 +450,12 @@ def _save_routing_policy(
     """Keep router ``topk`` and device-to-host copies from forward; recompute the rest.
 
     A recomputed router can pick other experts, which changes dispatch shapes
-    and the all-to-all splits every expert-parallel peer expects.
+    and the all-to-all splits every expert-parallel peer expects. Saved host
+    copies spare the recompute a host sync each.
+
+    Saved outputs replay in forward order per op, so a saved op must run the
+    same number of times in the recompute. The routed EP count copy runs only
+    in forward, so it is not saved.
     """
     if op.overloadpacket is torch.ops.aten.topk:
         return CheckpointPolicy.MUST_SAVE
@@ -458,6 +464,7 @@ def _save_routing_policy(
         op.overloadpacket is torch.ops.aten._to_copy
         and isinstance(device, torch.device)
         and device.type == "cpu"
+        and not COPYING_ROUTED_COUNTS.get()
     ):
         return CheckpointPolicy.MUST_SAVE
     return CheckpointPolicy.PREFER_RECOMPUTE
```

**File**: `tests/test_utils/test_fsdp_routed_expert_chunks.py` (modified, +69/-2)
```diff
@@ -14,17 +14,26 @@
 import torch.distributed as dist
 from peft import LoraConfig, get_peft_model
 from torch import nn
-from torch.utils.checkpoint import CheckpointPolicy
+from torch.utils.checkpoint import CheckpointPolicy, checkpoint
 from transformers import NemotronHConfig, NemotronHForCausalLM
 
 from agilerl.distributed import FSDPConfig, init_distributed
+from agilerl.distributed.ep_forward import (
+    COPYING_ROUTED_COUNTS,
+    TokenExchange,
+    _routed_counts,
+)
 from agilerl.distributed.fsdp import materialize_fsdp2_from_cpu_state
-from agilerl.distributed.fsdp_blocks import _save_routing_policy
+from agilerl.distributed.fsdp_blocks import (
+    _block_checkpoint_contexts,
+    _save_routing_policy,
+)
 from agilerl.lora.fused import patch_lora_for_fused_forward
 from agilerl.lora.moe import (
     RoutedExpertsLoraWrapper,
     upgrade_moe_param_wrappers,
 )
+from agilerl.lora.moe.grouped_gemm import expert_row_counts
 
 VOCAB = 64
 
@@ -113,12 +122,70 @@ def test_saves_cpu_device_copy(self) -> None:
 
         assert policy is CheckpointPolicy.MUST_SAVE
 
+    def test_recomputes_routed_counts_copy(self) -> None:
+        copying = COPYING_ROUTED_COUNTS.set(True)
+
+        policy = _save_routing_policy(
+            None,
+            torch.ops.aten._to_copy.default,
+            device=torch.device("cpu"),
+        )
+
+        COPYING_ROUTED_COUNTS.reset(copying)
+        assert policy is CheckpointPolicy.PREFER_RECOMPUTE
+
     def test_recomputes_other_ops(self) -> None:
         policy = _save_routing_policy(None, torch.ops.aten.add.Tensor)
 
         assert policy is CheckpointPolicy.PREFER_RECOMPUTE
 
 
+class TestBlockCheckpointContexts:
+    @pytest.mark.usefixtures("world_size_one")
+    def test_recompute_matches_forward_after_routed_counts_copy(
+        self, monkeypatch: pytest.MonkeyPatch
+    ) -> None:
+        # Arrange
+        tolist = torch.Tensor.tolist
+        # CUDA ``.tolist()`` copies to host through ``_to_copy``; CPU tensors skip it.
+        monkeypatch.setattr(
+            torch.Tensor,
+            "tolist",
+            lambda t: tolist(
+                torch.ops.aten._to_copy.default(t, device=torch.device("cpu"))
+            ),
+        )
+        exchange = TokenExchange(dist.group.WORLD, 1, 1, None, 1 << 20)
+        torch.manual_seed(0)
+        weight = torch.randn(4, 3, requires_grad=True)
+        hidden = torch.randn(5, 4)
+        splits = torch.tensor([2, 3])
+
+        def block(x: torch.Tensor) -> torch.Tensor:
+            scores, experts = (x @ weight).topk(2, -1)
+            send = expert_row_counts(experts.reshape(-1), 3).unsqueeze(0)
+            _routed_counts(send, exchange)
+            chunks = scores.split(splits.tolist())
+            return torch.cat([chunk.pow(i + 2) for i, chunk in enumerate(chunks)])
+
+        upstream = torch.randn(5, 2)
+        (block(hidden) * upstream).sum().backward()
+        expected = weight.grad.clone()
+        weight.grad = None
+
+        # Act
+        out = checkpoint(
+            block,
+            hidden,
+            use_reentrant=False,
+            context_fn=_block_checkpoint_contexts(True),
+        )
+        (out * upstream).sum().backward()
+
+        # Assert
+        assert torch.equal(weight.grad, expected)
+
+
 class TestMaterializeFsdp2FromCpuStateRoutedExpertChunks:
     @pytest.mark.usefixtures("world_size_one")
     def test_sets_the_chunk_budget_on_every_routed_wrapper(self) -> None:
```

---

### Incident Patch 3: `790304b0` (2026-10-27)
**Commit Message**: fix: save router top-k for checkpointed gpt-oss blocks

Activation checkpointing saves each MoE router's top-k so backward replays the forward routing. Blocks with the transposed packed-expert layout (gpt-oss) were not detected, so their router was recomputed in backward. A token that switches expert then changes the expert loop shapes and raises `CheckpointError`, or silently uses different routing when shapes happen to match.

Router saving now covers every packed-expert layout.

Hub-RevId: 9e2302b09457de96ced028c99a297a3d761b3528

**File**: `agilerl/distributed/fsdp_blocks.py` (modified, +3/-1)
```diff
@@ -628,7 +628,9 @@ def apply_fsdp2(
     for block in blocks:
         unit = block
         if id(block) in checkpointed:
-            save_router = bool(iter_packed_expert_modules(block))
+            save_router = any(
+                is_packed_experts_module(module) for module in block.modules()
+            )
             if save_router:
                 patch_moe_routers(block)
             unit = checkpoint_wrapper(
```

**File**: `tests/test_utils/test_fsdp_blocks.py` (added, +195/-0)
```diff
@@ -0,0 +1,195 @@
+# Copyright 2026 AgileRL
+# SPDX-License-Identifier: Apache-2.0
+
+"""Router top-k replay in activation-checkpointed gpt-oss blocks."""
+
+from __future__ import annotations
+
+import os
+import sys
+from collections.abc import Generator
+
+import pytest
+import torch
+import torch.distributed as dist
+import torch.nn.functional as F
+from peft import LoraConfig, get_peft_model
+from torch import nn
+from torch.distributed.tensor import DTensor
+from torch.utils.checkpoint import CheckpointError, checkpoint
+from transformers import GptOssConfig, GptOssForCausalLM
+from transformers.models.gpt_oss.modeling_gpt_oss import GptOssTopKRouter
+
+from agilerl.distributed import FSDPConfig, init_distributed
+from agilerl.distributed.fsdp_blocks import _block_checkpoint_contexts, apply_fsdp2
+from agilerl.lora.moe import upgrade_moe_param_wrappers
+
+VOCAB = 64
+HIDDEN = 32
+
+
+class DriftingRouter(GptOssTopKRouter):
+    """gpt-oss router sending tokens to experts 0-1, but token 0 to 2-3 on odd calls."""
+
+    def __init__(self, config: GptOssConfig) -> None:
+        super().__init__(config)
+        self.calls = 0
+
+    def forward(
+        self, hidden_states: torch.Tensor
+    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
+        odd = self.calls % 2
+        self.calls += 1
+        # Same ops every call: selective checkpointing replays saved ops by order.
+        drift = torch.zeros(hidden_states.shape[0], self.num_experts)
+        drift[:, :2] = 100.0
+        drift[0, :2] = 100.0 * (1 - odd)
+        drift[0, 2:] = 100.0 * odd
+        router_logits = F.linear(hidden_states, self.weight, self.bias) + drift
+        top_value, router_indices = torch.topk(router_logits, self.top_k, dim=-1)
+        router_scores = F.softmax(top_value, dim=1, dtype=top_value.dtype)
+        return router_logits, router_scores, router_indices
+
+
+def tiny_gpt_oss_with_lora() -> nn.Module:
+    """Two-layer gpt-oss with drifting routers, attention and packed-expert LoRA, fp32."""
+    config = GptOssConfig(
+        vocab_size=VOCAB,
+        hidden_size=HIDDEN,
+        intermediate_size=16,
+        num_hidden_layers=2,
+        num_attention_heads=2,
+        num_key_value_heads=1,
+        head_dim=16,
+        num_local_experts=4,
+        num_experts_per_tok=2,
+        layer_types=["full_attention", "full_attention"],
+        max_position_embeddings=64,
+        use_cache=False,
+        attn_implementation="eager",
+    )
+    torch.manual_seed(0)
+    model = GptOssForCausalLM(config).float()
+    for layer in model.model.layers:
+        router = DriftingRouter(config)
+        router.load_state_dict(layer.mlp.router.state_dict())
+        layer.mlp.router = router
+    model = get_peft_model(
+        model,
+        LoraConfig(
+            r=4,
+            lora_alpha=8,
+            target_modules=["q_proj", "o_proj"],
+            target_parameters=["mlp.experts.gate_up_proj", "mlp.experts.down_proj"],
+        ),
+    )
+    torch.manual_seed(1)
+    for name, param in model.named_parameters():
+        if "lora_B" in name:
+            nn.init.normal_(param, std=0.1)
+    upgrade_moe_param_wrappers(model)
+    return model
+
+
+def tiny_gpt_oss_mlp_with_lora() -> nn.Module:
+    """First-layer MoE MLP of :func:`tiny_gpt_oss_with_lora`."""
+    return tiny_gpt_oss_with_lora().get_submodule("base_model.model.model.layers.0.mlp")
+
+
+def trainable_grads(module: nn.Module) -> dict[str, torch.Tensor]:
+    """Full gradient of each trainable parameter, keyed by its unwrapped name."""
+    return {
+        name.replace("_checkpoint_wrapped_module.", ""): param.grad.full_tensor()
+        if isinstance(param.grad, DTensor)
+        else param.grad
+        for name, param in module.named_parameters()
+        if param.requires_grad
+    }
+
+
+@pytest.fixture
+def world_size_one(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
+    """Single-process gloo group so FSDP2 can shard on CPU."""
+    if sys.platform == "win32":
+        pytest.skip("torch gloo process groups are unsupported on Windows wheels")
+    monkeypatch.setenv("RANK", "0")
+    monkeypatch.setenv("LOCAL_RANK", "0")
+    monkeypatch.setenv("WORLD_SIZE", "1")
+    monkeypatch.setenv("MASTER_ADDR", "localhost")
+    monkeypatch.setenv("MASTER_PORT", str(29750 + os.getpid() % 100))
+    # FSDP2's default mesh uses the host accelerator; shard on CPU everywhere.
+    monkeypatch.setattr(torch._C, "_get_accelerator", lambda: torch.device("cpu"))
+    assert init_distributed() is True
+    yield
+    dist.destroy_process_group()
+
+
+class TestBlockCheckpointContexts:
+    def test_saved_router_topk_keeps_gpt_oss_forward_routing(self) -> None:
+        # Arrange
+        reference = tiny_gpt_oss_mlp_with_lora()
+        mlp = tiny_gpt_oss_mlp_with_lora()
+        torch.manual_seed(2)
+        hidden = torch.randn(2, 6, HIDDEN)
+        upstream = torch.randn(2, 6, HIDDEN)
+        reference_hidden = hidden
```

#### Recent Merged Pull Requests:
- **PR #707** (2026-10-20): fix: make the MADDPG and MATD3 PettingZoo tutorials run end to end (@vishwagw)
- **PR #705** (closed): chore(deps): bump the uv group across 1 directory with 4 updates (@dependabot[bot])
- **PR #704** (closed): Chore(deps): Bump torch from 2.11.0 to 2.13.0 in the uv group across 1 directory (@dependabot[bot])
- **PR #702** (closed): Chore(deps): Bump torch from 2.11.0 to 2.13.0 in the uv group across 1 directory (@dependabot[bot])
- **PR #701** (2026-08-26): chore: raise llm extra vLLM floor to 0.26 (@agilerl-hub-sync[bot])
- **PR #700** (2026-08-26): ci: run Linux, macOS, Windows, ty, and CodeQL from one CI workflow (@agilerl-hub-sync[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. MoE routers under activation checkpointing, vision models, FSDP2, rollout logpro

**RULE**:
When implementing operations in `agilerl-arena/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in AgileRL/AgileRL. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c2b3e348`: MoE routers under activation checkpointing, vision models, FSDP2, rollout logprobs and memory estimates. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `agilerl-arena/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
# An unset engine width or max_num_seqs is resolved from the node's GPUs:
arena memory estimate path/to/manifest.yaml --gpu "NVIDIA L4" --num-gpus 4

```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c2b3e348` are properly handled with clean fallback behavior.
