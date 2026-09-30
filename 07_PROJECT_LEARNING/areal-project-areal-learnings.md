# Forensic Learning Record (Deep Inspection): areal-project/AReaL

> **Canonical Artifact**: `07_PROJECT_LEARNING/areal-project-areal-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/areal-project/AReaL](https://github.com/areal-project/AReaL))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:37:48.055Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `areal-project/AReaL`
- **Description**: The RL Bridge for LLM-based Agent Applications. Made Simple & Flexible.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 5806 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/review-pr/sync_review_pr_refs.py`
```
#!/usr/bin/env python3
"""Sync review-pr reference data from canonical .agents files.

Canonical source:
  - .agents/skills/review-pr/references/review-pr-domains-and-signals.md
  - .agents/skills/review-pr/references/review-pr-templates.md

Derived targets:
  - .opencode/data/review-pr-domains-and-signals.md
  - .opencode/data/review-pr-templates.md
  - .claude/data/review-pr-domains-and-signals.md
  - .claude/data/review-pr-templates.md

Usage:
  python .agents/skills/review-pr/sync_review_pr_refs.py --write
  python .agents/skills/review-pr/sync_review_pr_refs.py --check
"""

from __future__ import annotations

import difflib
import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

Transform = Callable[[str], str]


@dataclass(frozen=True)
class SyncSpec:
    src: Path
    dst: Path
    transform: Transform


def transform_for_opencode(text: str) -> str:
    return text.replace(
        "`.agents/skills/review-pr/SKILL.md`", "`.opencode/command/review-pr.md`"
    )


def transform_for_claude(text: str) -> str:
    out = text
    out = out.replace(
        "`.agents/skills/review-pr/SKILL.md`", "`.claude/commands/review-pr.md`"
    )
    return out


def find_repo_root(start: Path) -> Path:
    cur = start.resolve()
    for parent in [cur, *cur.parents]:
        if (parent / ".git").exists():
            return parent
    raise RuntimeError("Unable to locate repository root (missing .git)")


def normalized(text: str) -> str:
    norm = text.replace("\r\n", "\n").replace("\r", "\n")
    if not norm.endswith("\n"):
        norm += "\n"
    return norm


def sync_one(spec: SyncSpec, check_only: bool) -> tuple[bool, str]:
    try:
        source_text = normalized(spec.src.read_text(encoding="utf-8"))
    except OSError as exc:
        raise RuntimeError(f"Cannot read canonical source: {spec.src}") from exc
    expected = normalized(spec.transform(source_text))

    existing = ""
    if spec.dst.exists():
        try:
            existing = normalized(spec.dst.read_text(encoding="utf-8"))
        except OSError as exc:
            raise RuntimeError(f"Cannot read sync target: {spec.dst}") from exc

    if existing == expected:
        return False, ""

    if check_only:
        diff = "".join(
            difflib.unified_diff(
                existing.splitlines(keepends=True),
                expected.splitlines(keepends=True),
                fromfile=str(spec.dst),
                tofile=f"{spec.dst} (expected)",
            )
        )
        return True, diff

    spec.dst.parent.mkdir(parents=True, exist_ok=True)
    try:
        _ = spec.dst.write_text(expected, encoding="utf-8")
    except OSError as exc:
        raise RuntimeError(f"Cannot write sync target: {spec.dst}") from exc
    return True, ""


def build_specs(repo_root: Path) -> list[SyncSpec]:
    canonical_dir = repo_root / ".agents/skills/review-pr/references"
    domains_and_signals = canonical_dir / "review-pr-domains-and-signals.md"
    templates = canonical_dir / "review-pr-templates.md"

    return [
        SyncSpec(
            domains_and_signals,
            repo_root / ".opencode/data/review-pr-domains-and-signals.md",
            transform_for_opencode,
        ),
        SyncSpec(
            templates,
            repo_root / ".opencode/data/review-pr-templates.md",
            transform_for_opencode,
        ),
        SyncSpec(
            domains_and_signals,
            repo_root / ".claude/data/review-pr-domains-and-signals.md",
            transform_for_claude,
        ),
        SyncSpec(
            templates,
            repo_root / ".claude/data/review-pr-templates.md",
            transform_for_claude,
        ),
    ]


def parse_mode(argv: list[str]) -> str:
    if "-h" in argv or "--help" in argv:
        print("usage: sync_review_pr_refs.py [--write | --check]")
        print()
        print("Sync /review-pr reference files across platforms")
        print()
        print("options:")
        print("  --write     Write derived files")
        print("  --check     Check derived files are up to date")
        raise SystemExit(0)

    modes = [arg for arg in argv if arg in {"--write", "--check"}]
    if len(modes) != 1:
        print(
            "error: exactly one mode is required: --write or --check", file=sys.stderr
        )
        raise SystemExit(2)
    return modes[0]


def main() -> int:
    mode = parse_mode(sys.argv[1:])
    check_only = mode == "--check"
    write_mode = mode == "--write"
    repo_root = find_repo_root(Path(__file__))
    specs = build_specs(repo_root)

    changed_any = False
    diffs: list[str] = []

    for spec in specs:
        changed, diff = sync_one(spec, check_only=check_only)
        changed_any = changed_any or changed
        if changed and check_only and diff:
            diffs.append(diff)
        if changed and write_mode:
            print(f"updated: {spec.dst}")
        if not changed and write_mode:
            print(f"up-to-date: {spec.dst}")

    if check_only:
        if changed_any:
            print(
                "/review-pr reference files are out of sync. Run with --write.",
                file=sys.stderr,
            )
            for d in diffs:
                print(d, file=sys.stderr)
            return 1
        print("/review-pr reference files are in sync.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `areal/__init__.py`
```
# SPDX-License-Identifier: Apache-2.0

"""AReaL: A Large-Scale Asynchronous Reinforcement Learning System for Language Reasoning"""

from .version import __version__  # noqa

from .infra import (
    RolloutController,
    StalenessManager,
    TrainController,
    WorkflowExecutor,
    current_platform,
    workflow_context,
)


def __getattr__(name: str):
    if name in ("DPOTrainer", "PPOTrainer", "RWTrainer", "SFTTrainer"):
        from .trainer import DPOTrainer, PPOTrainer, RWTrainer, SFTTrainer

        _map = {
            "DPOTrainer": DPOTrainer,
            "PPOTrainer": PPOTrainer,
            "RWTrainer": RWTrainer,
            "SFTTrainer": SFTTrainer,
        }
        globals().update(_map)
        return _map[name]
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "DPOTrainer",
    "PPOTrainer",
    "RolloutController",
    "RWTrainer",
    "SFTTrainer",
    "StalenessManager",
    "TrainController",
    "WorkflowExecutor",
    "current_platform",
    "workflow_context",
]

```

### Core Architecture Module: `areal/api/__init__.py`
```
# SPDX-License-Identifier: Apache-2.0

__all__ = [
    "RolloutWorkflow",
    "AsyncRewardWrapper",
    "TrainEngine",
    "InferenceEngine",
    "Scheduler",
    "Worker",
    "Job",
    "AllocationType",
    "ModelAllocation",
    "ParallelStrategy",
    "FSDPParallelStrategy",
    "MegatronParallelStrategy",
    "ModelRequest",
    "ModelResponse",
    "WeightUpdateMeta",
    "SaveLoadMeta",
    "StepInfo",
    "FinetuneSpec",
    "ParamSpec",
    "RolloutStat",
    "LocalInfServerInfo",
    "WorkflowLike",
    "AgentWorkflow",
]

_LAZY_IMPORTS = {
    "TrainEngine": "areal.api.engine_api",
    "InferenceEngine": "areal.api.engine_api",
    "Scheduler": "areal.api.scheduler_api",
    "Worker": "areal.api.scheduler_api",
    "Job": "areal.api.scheduler_api",
    "AllocationType": "areal.api.alloc_mode",
    "ModelAllocation": "areal.api.alloc_mode",
    "ParallelStrategy": "areal.api.alloc_mode",
    "FSDPParallelStrategy": "areal.api.alloc_mode",
    "MegatronParallelStrategy": "areal.api.alloc_mode",
    "ModelRequest": "areal.api.io_struct",
    "ModelResponse": "areal.api.io_struct",
    "WeightUpdateMeta": "areal.api.io_struct",
    "SaveLoadMeta": "areal.api.io_struct",
    "StepInfo": "areal.api.io_struct",
    "FinetuneSpec": "areal.api.io_struct",
    "ParamSpec": "areal.api.io_struct",
    "RolloutStat": "areal.api.io_struct",
    "LocalInfServerInfo": "areal.api.io_struct",
    "WorkflowLike": "areal.api.workflow_api",
    "AgentWorkflow": "areal.api.workflow_api",
    "AsyncRewardWrapper": "areal.api.reward_api",
    "RolloutWorkflow": "areal.api.workflow_api",
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

### Core Architecture Module: `areal/api/alloc_mode.py`
```
# SPDX-License-Identifier: Apache-2.0

import enum
import math
from dataclasses import dataclass, field
from typing import Literal

from lark import Lark, Transformer

from areal.api.cli_args import SchedulingStrategy, SchedulingStrategyType
from areal.utils import logging

logger = logging.getLogger("AllocMode")


class AllocationType(enum.Enum):
    """Backward Compatible: Type of resource allocation strategy."""

    COLOCATE = 0  # Shared resources between training and inference (including SFT/training-only)
    DECOUPLED_TRAIN = 1  # Separate resources for training and inference
    LLM_SERVER_ONLY = 2  # Inference-only allocation


class AllocationValidationError(Exception):
    """Raised when allocation mode validation fails."""


class InvalidAllocationModeError(Exception):
    """Legacy exception for backward compatibility with existing code."""


@dataclass
class ParallelStrategy:
    """5D parallel strategy supporting tensor, pipeline, data, context, and expert parallelism.

    This class represents a comprehensive parallelization strategy for distributed ML workloads,
    particularly designed for large language models and mixture-of-experts architectures.

    The five dimensions of parallelism are:
    - Tensor parallelism: Splits individual operations (like matrix multiplications) across devices
    - Pipeline parallelism: Splits model layers across devices in a pipeline fashion
    - Data parallelism: Replicates the model and splits data across devices
    - Context parallelism: Splits sequence length across devices (attention-specific)
    - Expert parallelism: Splits experts in MoE models across devices

    For implementation details, refer to:
    https://github.com/NVIDIA/Megatron-LM/tree/main/megatron/core/transformer/moe#moe-parallel-folding

    Args:
        tensor_parallel_size: Number of devices for tensor model parallelism (default: 1)
        pipeline_parallel_size: Number of pipeline parallel stages (default: 1)
        data_parallel_size: Number of data parallel replicas for ZeRO optimization (default: 1)
        context_parallel_size: Number of devices for context parallelism in attention modules (default: 1)
        expert_parallel_size: Number of devices for expert parallelism in MoE models (default: 1)
        expert_tensor_parallel_size: Tensor parallelism size specifically for expert modules (default: 1)

    Note:
        - Context parallelism is only effective for attention modules
        - Expert parallelism is only effective for MoE (Mixture of Experts) modules
    """

    tensor_parallel_size: int = field(
        default=1, metadata={"help": "Size of tensor-model parallelism"}
    )
    pipeline_parallel_size: int = field(
        default=1, metadata={"help": "Number of pipeline parallel stages"}
    )
    data_parallel_size: int = field(
        default=1, metadata={"help": "Data parallelism size for ZeRO optimization"}
    )
    context_parallel_size: int = field(
        default=1,
        metadata={
            "help": "Context parallelism size for attention modules. "
            "Note that context parallelism is only effective for attention modules."
        },
    )
    expert_parallel_size: int = field(
        default=1,
        metadata={
            "help": "Expert parallelism size for MoE models. "
            "Note that expert parallelism is only effective for expert modules."
        },
    )
    expert_tensor_parallel_size: int = field(
        default=1,
        metadata={
            "help": "Tensor parallelism size for expert modules. "
            "By default, it is 1 which disables expert tensor parallelism."
        },
    )

    def __post_init__(self):
        """Initialize computed properties and validate configuration."""
        if self.expert_parallel_size > 1:
            # Calculate expert model parallel size for validation
            self.expert_model_parallel_size = (
                self.pipeline_parallel_size
                * self.expert_tensor_parallel_size
                * self.expert_parallel_size
            )

            # Validate that world size is divisible by expert model parallel size
            assert self.world_size % self.expert_model_parallel_size == 0, (
                f"Expert model parallel size {self.expert_model_parallel_size} "
                f"cannot divide world size {self.world_size}."
            )

    @property
    def expert_data_parallel_size(self) -> int:
        """Data parallelism size for expert modules in MoE models."""
        if not hasattr(self, "expert_model_parallel_size"):
            return self.data_parallel_size
        return self.world_size // self.expert_model_parallel_size

    # Abbreviated properties for convenience
    @property
    def tp_size(self) -> int:
        """Tensor parallelism size (abbreviated)."""
        return self.tensor_parallel_size

    @property
    def pp_size(self) -> int:
        """Pipeline parallelism size (abbreviated)."""
        return self.pipeline_parallel_size

    @property
    def dp_size(self) -> int:
        """Data parallelism size (abbreviated)."""
        return self.data_parallel_size

    @property
    def cp_size(self) -> int:
        """Context parallelism size (abbreviated)."""
        return self.context_parallel_size

    @property
    def ep_size(self) -> int:
        """Expert parallelism size (abbreviated)."""
        return self.expert_parallel_size

    @property
    def etp_size(self) -> int:
        """Expert tensor parallelism size (abbreviated)."""
        return self.expert_tensor_parallel_size

    @property
    def edp_size(self) -> int:
        """Expert data parallelism size (abbreviated)."""
        return self.expert_data_parallel_size

    @property
    def world_size(self) -> int:
        """Total number of devices required for this parallelization strategy."""
        return (
            self.data_parallel_size
            * self.context_parallel_size
            * self.tensor_parallel_size
            * self.pipeline_parallel_size
        )

    def __str__(self):
        """String representation showing all non-default parallelism dimensions."""
        parts = [
            f"tp={self.tensor_parallel_size}",
            f"pp={self.pipeline_parallel_size}",
            f"dp={self.data_parallel_size}",
        ]

        if self.context_parallel_size > 1:
            parts.append(f"cp={self.context_parallel_size}")
        if self.expert_parallel_size > 1:
            parts.append(f"ep={self.expert_parallel_size}")
            if self.expert_tensor_parallel_size != 1:
                parts.append(f"ep_tp={self.expert_tensor_parallel_size}")

        return f"Parallel({','.join(parts)})"

    @staticmethod
    def parallelism_eq(this, other):
        """Compare two parallelism configurations for equality.

        Args:
            this: First ParallelStrategy to compare
            other: Second ParallelStrategy to compare

        Returns:
            bool: True if all parallelism dimensions match

        Note:
            Implemented as static method to avoid OmegaConf compatibility issues.
        """
        return (
            (this.tensor_parallel_size == other.tensor_parallel_size)
            and (this.pipeline_parallel_size == other.pipeline_parallel_size)
            and (this.data_parallel_size == other.data_parallel_size)
            and (this.context_parallel_size == other.context_parallel_size)
            and (this.expert_parallel_size == other.expert_parallel_size)
            and (this.expert_tensor_parallel_size == other.expert_tensor_parallel_size)
        )


@dataclass
class FSDPParallelStrategy(ParallelStrategy):
    """FSDP parallel strategy."""

    @staticmethod
    def parallelism_eq(this, other):
        """Compare FSDP parallelism configurations."""
        return ParallelStrategy.parallelism_eq(this, other)


@dataclass
class MegatronParallelStrategy(ParallelStrategy):
    """Megatron parallel strategy with additional se
```

### Core Architecture Module: `areal/api/cli_args.py`
```
# SPDX-License-Identifier: Apache-2.0

import argparse
import json
import math
import os
import re
import warnings
from dataclasses import MISSING as dataclass_missing
from dataclasses import asdict, dataclass, field, fields
from enum import Enum
from pathlib import Path
from typing import TYPE_CHECKING, Any, ClassVar, TypeVar

import uvloop
import yaml
from hydra import compose as hydra_compose
from hydra import initialize as hydra_init
from hydra.core.global_hydra import GlobalHydra
from omegaconf import MISSING, DictConfig, OmegaConf

from areal.engine.fsdp_utils.attn_impl import (
    BUILTIN_ATTN_IMPLS,
    get_attn_impl_validation_error,
    is_valid_attn_impl,
)
from areal.utils import logging, name_resolve, pkg_version
from areal.utils.config_utils import redact_sensitive_config
from areal.utils.constants import (
    PROX_LOGP_METHOD_RECOMPUTE,
    PROX_LOGP_METHODS_ALL,
)
from areal.utils.seqpack import PACKING_ALGORITHMS

if TYPE_CHECKING:
    from transformers import PreTrainedTokenizerFast

uvloop.install()

logger = logging.getLogger("CLIArgs")

ConfigT = TypeVar("ConfigT")


@dataclass
class NormConfig:
    """Configuration for reward/advantage normalization."""

    mean_level: str | None = field(
        default="batch",
        metadata={
            "help": "Mean level for normalization. None for no mean normalization.",
            "choices": ["batch", "group", None],
        },
    )
    mean_leave1out: bool = field(
        default=False,
        metadata={"help": "Whether to use leave-one-out average."},
    )
    std_level: str | None = field(
        default="batch",
        metadata={
            "help": "Standard deviation level for normalization. None for no std normalization.",
            "choices": ["batch", "group", None],
        },
    )
    std_unbiased: bool = field(
        default=True,
        metadata={
            "help": "Whether to use unbiased standard deviation computation. Defaults to True (changed from False in v0.3.4)."
        },
    )
    eps: float = field(
        default=1e-5,
        metadata={
            "help": "The eps when dividing by standard deviation to avoid numerical issues."
        },
    )
    group_size: int = field(
        default=1, metadata={"help": "Group size for group-level normalization"}
    )

    @property
    def uses_group_statistics(self) -> bool:
        """Whether normalization derives statistics from prompt groups."""
        return self.mean_level == "group" or self.std_level == "group"

    def __post_init__(self):
        """Validate normalization configuration."""
        valid_levels = {"batch", "group", None}
        if self.mean_level not in valid_levels:
            raise ValueError(
                f"mean_level must be 'batch', 'group' or None, got {self.mean_level}"
            )
        if self.std_level not in valid_levels:
            raise ValueError(
                f"std_level must be 'batch', 'group', or None, got {self.std_level}"
            )
        if (
            self.mean_level == "group" or self.std_level == "group"
        ) and self.group_size < 1:
            raise ValueError(
                f"group_size must be a positive integer when using group normalization, got {self.group_size}"
            )


@dataclass
class MicroBatchSpec:
    """Specification for splitting micro-batches during training."""

    n_mbs: int | None = field(
        default=1,
        metadata={
            "help": "Number of micro-batches (or minimum number if max_tokens_per_mb is set). Used when max_tokens_per_mb is None or as minimum count",
        },
    )
    granularity: int = field(
        default=1,
        metadata={
            "help": "Granularity of each micro-batch. Adjacent sequences are grouped by this size when dividing microbatches.",
        },
    )
    max_tokens_per_mb: int | None = field(
        default=None,
        metadata={
            "help": "Maximum tokens per micro-batch for each forward pass. When set, n_mbs becomes the minimum number of micro-batches.",
        },
    )
    n_mbs_divisor: int = field(
        default=1,
        metadata={
            "help": "Divisor for the number of micro-batches. The final number of micro-batches will be adjusted to be divisible by this value.",
        },
    )
    packing_algorithm: str = field(
        default="ffd",
        metadata={
            "help": (
                "Sequence packing algorithm for micro-batch allocation. "
                "Supported values: 'ffd' (First Fit Decreasing, default), "
                "'kk' (Karmarkar-Karp, better balance but slightly slower). "
                "KK is recommended when workload balance across DP ranks is "
                "critical (e.g., large-scale RL training with variable-length sequences)."
            ),
            "choices": ["ffd", "kk"],
        },
    )

    def __post_init__(self):
        """Validate packing algorithm configuration."""
        if self.packing_algorithm not in PACKING_ALGORITHMS:
            raise ValueError(
                f"packing_algorithm must be one of {sorted(PACKING_ALGORITHMS)}, "
                f"got '{self.packing_algorithm}'"
            )

    @classmethod
    def new(cls, mb_spec: "MicroBatchSpec", **kwargs):
        """Create new spec with updated fields while maintaining Omegaconf compatibility."""
        fields = dict(
            n_mbs=mb_spec.n_mbs,
            granularity=mb_spec.granularity,
            max_tokens_per_mb=mb_spec.max_tokens_per_mb,
            n_mbs_divisor=mb_spec.n_mbs_divisor,
            packing_algorithm=mb_spec.packing_algorithm,
        )
        fields.update(kwargs)
        return cls(**fields)


@dataclass
class GenerationHyperparameters:
    """Controls text generation behavior for rollout."""

    n_samples: int = field(
        default=1, metadata={"help": "Number of sequences to generate per prompt."}
    )
    max_new_tokens: int = field(
        default=16384, metadata={"help": "Maximum number of tokens to generate."}
    )
    min_new_tokens: int = field(
        default=0, metadata={"help": "Minimum number of tokens to generate."}
    )
    max_tokens: int = field(
        default=32768,
        metadata={
            "help": "Maximum number of tokens including prompt and generated tokens."
        },
    )
    greedy: bool = field(
        default=False,
        metadata={"help": "Whether to use greedy decoding (max probability)."},
    )
    top_p: float = field(
        default=1.0,
        metadata={"help": "Nucleus sampling probability threshold (0.0, 1.0]."},
    )
    top_k: int = field(
        default=int(1e8),
        metadata={"help": "Number of highest probability tokens to consider."},
    )
    temperature: float = field(
        default=1.0,
        metadata={"help": "Sampling temperature. Higher values increase diversity."},
    )
    stop_token_ids: list[int] = field(
        default_factory=list,
        metadata={"help": "Stop generation when encountering these token IDs."},
    )
    ignore_eos: bool = field(
        default=False,
        metadata={"help": "Do not stop generation when EOS is encountered."},
    )
    skip_special_tokens: bool = field(
        default=True,
        metadata={"help": "Skip special tokens when decoding/displaying outputs."},
    )
    stop: list[str] | None = field(
        default=None,
        metadata={
            "help": "One or multiple stop words. Generation will stop if one of these words is sampled."
        },
    )
    frequency_penalty: float = field(
        default=0.0,
        metadata={
            "help": (
                "Penalizes tokens based on their frequency in generation so far. "
                "Must be between -2 and 2 where negative numbers encourage repetition."
            )
        },
    )
    seed: int | None = field(
        default=None,
        metadata={
            "help": "Per-request sampling seed sent to the inference backend. Leave "
            "unset for gr
```

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
        workflow_kwargs : dict[str, Any
```

### Core Architecture Module: `areal/api/io_struct.py`
```
# SPDX-License-Identifier: Apache-2.0

import copy
import math
import os
import subprocess
import uuid
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Literal, Optional

import numpy as np
import torch
import torch.distributed as dist
from PIL.Image import Image as ImageObject
from transformers import PreTrainedTokenizerFast

from areal.api.alloc_mode import ModelAllocation
from areal.api.cli_args import GenerationHyperparameters
from areal.infra.platforms import current_platform
from areal.utils import logging

if TYPE_CHECKING:
    from transformers import AutoProcessor

logger = logging.getLogger("IOStruct")


@dataclass
class ModelRequest:
    rid: str = field(default_factory=lambda: str(uuid.uuid4()))
    input_ids: list[int] = field(default_factory=list)
    gconfig: GenerationHyperparameters = field(
        default_factory=GenerationHyperparameters
    )
    metadata: dict[str, Any] = field(default_factory=dict)
    # tokenizer is used for encode-decode in the inference engine
    tokenizer: PreTrainedTokenizerFast | None = None

    # vlm
    image_data: list[str] | None = field(default_factory=list)
    processor: Optional["AutoProcessor"] = None

    # vlm+vllm:
    vision_msg_vllm: list | None = None

    def copy(self):
        return ModelRequest(
            rid=self.rid,
            input_ids=self.input_ids.copy(),
            gconfig=self.gconfig.new(),
            metadata=self.metadata.copy(),
            tokenizer=self.tokenizer,
            image_data=self.image_data.copy() if self.image_data is not None else None,
            processor=self.processor,
            vision_msg_vllm=(
                self.vision_msg_vllm.copy()
                if self.vision_msg_vllm is not None
                else None
            ),
        )


@dataclass
class ModelResponse:
    # outputs
    input_tokens: list[int] = field(default_factory=list)
    output_tokens: list[int] = field(default_factory=list)
    output_logprobs: list[float] = field(default_factory=list)
    output_versions: list[int] = field(default_factory=list)
    stop_reason: Literal["length", "stop", "tool_calls", "abort"] = "stop"
    # tokenizer is used for encode-decode in the inference engine
    tokenizer: PreTrainedTokenizerFast | None = None

    # vlm
    input_images: list[ImageObject | str] = field(default_factory=list)
    processor: Optional["AutoProcessor"] = None

    # statistics
    latency: float = float("inf")
    ttft: float = float("inf")  # Time to first token
    itl: list[float] = field(default_factory=list)  # List of inter-token latencies

    # MoE routing (only populated when return_routed_experts=True)
    routed_experts: np.ndarray | None = None

    @property
    def input_len(self) -> int:
        return len(self.input_tokens)

    @property
    def output_len(self) -> int:
        return len(self.output_tokens)

    @property
    def end_with_stop(self) -> bool:
        if self.tokenizer is None:
            raise ValueError("tokenizer is None, cannot check end_with_stop")
        eos_id = self.tokenizer.eos_token_id
        pad_id = self.tokenizer.pad_token_id
        if len(self.output_tokens) == 0:
            return False
        last_token = self.output_tokens[-1]
        return (eos_id is not None and last_token == eos_id) or (
            pad_id is not None and last_token == pad_id
        )

    @property
    def output_tokens_without_stop(self) -> list[int]:
        if self.tokenizer is None:
            raise ValueError("tokenizer is None, cannot get output_tokens_without_stop")
        if self.stop_reason not in ["length", "abort"] and self.output_tokens:
            if not self.end_with_stop:
                raise ValueError(
                    f"output_tokens does not end with eos or pad token, it ends with {self.output_tokens[-1]}, but stop_reason is {self.stop_reason}"
                )
            pad_or_eos_len = 0
            eos_id = self.tokenizer.eos_token_id
            pad_id = self.tokenizer.pad_token_id
            stop_tokens = {eos_id, pad_id}
            stop_tokens.discard(None)
            for tok in reversed(self.output_tokens):
                if tok in stop_tokens:
                    pad_or_eos_len += 1
                else:
                    break
            if pad_or_eos_len == len(self.output_tokens):
                raise ValueError(
                    "All output_tokens are EOS or PAD tokens; cannot strip stop tokens without removing entire output."
                )
            return self.output_tokens[:-pad_or_eos_len]
        return self.output_tokens


@dataclass
class FinetuneSpec:
    total_train_epochs: int
    dataset_size: int
    train_batch_size: int

    @property
    def total_train_steps(self):
        # assuming drop_last
        return self.total_train_epochs * (self.dataset_size // self.train_batch_size)

    @property
    def steps_per_epoch(self):
        return self.dataset_size // self.train_batch_size


@dataclass
class ParamSpec:
    name: str
    shape: tuple
    dtype: str

    @property
    def size(self) -> int:
        """Param bytes"""
        return getattr(torch, self.dtype).itemsize * np.prod(self.shape)


def get_versioned_lora_name(lora_name: str, version: int) -> str:
    """Get versioned LoRA adapter name (e.g., 'lora-v1')."""
    return f"{lora_name}-v{version}"


def detect_image_mime(base64_data: str) -> str:
    """Detect image MIME type from the first bytes of base64-encoded data.

    Examines base64 magic byte prefixes to determine the actual image format.
    """
    if base64_data.startswith("iVBOR"):  # PNG: \x89PNG
        return "image/png"
    if base64_data.startswith("/9j/"):  # JPEG: \xff\xd8\xff
        return "image/jpeg"
    if base64_data.startswith("R0lGOD"):  # GIF: GIF8
        return "image/gif"
    if base64_data.startswith("UklGR"):  # WebP: RIFF
        return "image/webp"
    return "image/jpeg"


@dataclass
class WeightUpdateMeta:
    type: Literal["disk", "xccl", "awex"]
    path: str | None = None
    gen_allocation: ModelAllocation | None = None

    nccl_master_address: str | None = None
    nccl_master_port: int | None = None
    nccl_group_name: str | None = None
    weight_chunked_mem_mb: int = 1024

    use_lora: bool = False
    lora_name: str = ""
    lora_int_id: int = 0
    base_model_name: str = ""
    peft_config: dict = field(default_factory=dict)
    # Number of recent LoRA adapter versions to keep loaded on the inference
    # server. Older versions are unloaded to bound memory; 0 disables cleanup.
    lora_keep_versions: int = 0

    clear_checkpoint_after_load: bool = True

    version: int | None = None

    def with_version(self, version: int) -> "WeightUpdateMeta":
        """Return a copy of this meta with versioned path.

        Changes path from 'weight_update' to 'weight_update_v{version}'.
        """
        if version < 0:
            raise ValueError(f"version must be non-negative, got {version}")
        new_meta = copy.copy(self)
        new_meta.version = version
        if self.path is not None:
            base_dir = os.path.dirname(self.path)
            new_meta.path = os.path.join(base_dir, f"weight_update_v{version}")
        return new_meta

    @classmethod
    def from_disk(
        cls,
        experiment_name: str,
        trial_name: str,
        file_root: str,
        name: str = "default",
        use_lora: bool = False,
        clear_checkpoint_after_load: bool = True,
        lora_name: str = "",
        lora_int_id: int = 1,
        base_model_name: str = "",
        lora_keep_versions: int = 0,
    ) -> "WeightUpdateMeta":
        from areal.utils.saver import Saver

        path = os.path.join(
            Saver.get_model_save_root(experiment_name, trial_name, file_root, name),
            "weight_update",
        )
        return cls(
            type="disk",
            path=path,
            use_lora=use_lora,
            clear_checkpoint_after_load=
```

### Core Architecture Module: `areal/api/reward_api.py`
```
# SPDX-License-Identifier: Apache-2.0

import asyncio
import atexit
import os
import threading
from collections.abc import Callable
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool
from functools import partial

from areal.utils import logging

logger = logging.getLogger("RewardAPI")


def _get_device_count_safely() -> int:
    """
    Safely get device count without initializing CUDA context.
    """
    gpu_types = ["nvidia", "davinci"]
    try:
        if os.path.exists("/dev"):
            for gpu_type in gpu_types:
                devices = [
                    f
                    for f in os.listdir("/dev")
                    if f.startswith(gpu_type) and f[len(gpu_type) :].isdigit()
                ]
                if devices:
                    return len(devices)
    except (OSError, ValueError) as e:
        # /dev doesn't exist or can't read (e.g., Windows, macOS)
        logger.debug(f"Could not read device list from /dev, using fallback: {e}")

    # Fallback: assume 8 devices for cautious max_workers calculation
    return 8


def reward_fn(
    prompt: str,
    completions: str,
    prompt_ids: list[int],
    completion_ids: list[int],
    **kwargs,
):
    """This function is a placeholder for the reward function that will be used in the RLVR pipeline.

    In general, there's no restriction on the signature and implementation of this function in customized rollout workflows.
    It would be convinent to follow this signature and directly use it in our predefined rollout workflows.

    :param prompt: The string representing the task to be completed.
    :param completions: The string representing the trajectory generated by the model.
    :param prompt_ids: The token IDs of the prompt.
    :param completion_ids: The token IDs of the trajectory generated by the model.
    :param kwargs: Other attributes of the data in the dataset, such as solutions, input_outputs, etc.
        Any other attributes in the dataset will be passed as keyword arguments to this function.
    :rtype: float
    """


class AsyncRewardWrapper:
    """Wraps a synchronous reward function for async execution with timeout and retries.

    Executors are shared by ``max_workers`` key and cleaned up via ``atexit``.
    Includes automatic recovery from broken process pools.

    The reward function and its arguments must be picklable since they
    are dispatched to worker processes via ``ProcessPoolExecutor``.
    """

    _executors: dict[int, ProcessPoolExecutor] = {}
    _lock = threading.Lock()
    _atexit_registered = False

    def __init__(
        self,
        reward_fn: Callable,
        timeout_seconds: float = 15,
        max_workers: int | None = None,
        max_retries: int = 3,
    ):
        self.reward_fn = reward_fn
        self.timeout_seconds = timeout_seconds
        if max_workers is None:
            cpu_count = os.cpu_count() or 1
            device_count = _get_device_count_safely()
            max_workers = max((cpu_count // device_count) // 2, 1)
        self.max_workers = max_workers
        self.max_retries = max_retries
        self._executor_key = max_workers

        with self._lock:
            if self._executor_key not in self._executors:
                self._executors[self._executor_key] = ProcessPoolExecutor(
                    max_workers=max_workers
                )
            if not AsyncRewardWrapper._atexit_registered:
                atexit.register(AsyncRewardWrapper._atexit_shutdown_all)
                AsyncRewardWrapper._atexit_registered = True

    @classmethod
    def _atexit_shutdown_all(cls):
        """Shut down all executors before ``_python_exit`` to prevent
        worker processes deadlocking in ``_finalize_join``.
        Must use ``wait=True`` so the result queue is fully drained.
        """
        with cls._lock:
            for executor in cls._executors.values():
                try:
                    executor.shutdown(wait=True, cancel_futures=True)
                except Exception as e:
                    logger.warning(f"Error shutting down executor at exit: {e}")
            cls._executors.clear()

    @classmethod
    def _recreate_executor(
        cls,
        executor_key: int,
        max_workers: int,
        broken: ProcessPoolExecutor,
    ) -> ProcessPoolExecutor | None:
        with cls._lock:
            current = cls._executors.get(executor_key)
            if current is not broken:
                return current
            try:
                broken.shutdown(wait=False)
            except Exception as e:
                logger.warning(f"Error shutting down broken executor: {e}")
            try:
                new_executor = ProcessPoolExecutor(max_workers=max_workers)
            except Exception:
                logger.exception("Failed to create replacement ProcessPoolExecutor")
                cls._executors.pop(executor_key, None)
                return None
            cls._executors[executor_key] = new_executor
            logger.info(f"Recreated ProcessPoolExecutor with {max_workers} workers")
            return new_executor

    async def __call__(self, *args, **kwargs) -> float:
        for attempt in range(self.max_retries + 1):
            executor = self._executors.get(self._executor_key)
            if executor is None:
                raise RuntimeError("ProcessPoolExecutor has been shut down")

            is_last = attempt == self.max_retries
            try:
                future = asyncio.get_running_loop().run_in_executor(
                    executor,
                    partial(self.reward_fn, *args, **kwargs),
                )
                return await asyncio.wait_for(future, timeout=self.timeout_seconds)
            except TimeoutError:
                logger.warning(
                    f"Computing reward timeout after {self.timeout_seconds}s "
                    f"(attempt {attempt + 1}/{self.max_retries + 1}). "
                    f"{'Returning 0.' if is_last else 'Retrying...'}"
                )
                if is_last:
                    return 0.0
            except BrokenProcessPool:
                logger.warning(
                    f"ProcessPoolExecutor broken (attempt {attempt + 1}/{self.max_retries + 1}). "
                    "Attempting to recreate..."
                )
                if is_last:
                    raise
                if (
                    self._recreate_executor(
                        self._executor_key, self.max_workers, executor
                    )
                    is None
                ):
                    raise
            except Exception:
                logger.exception(
                    f"Reward computation error (attempt {attempt + 1}/{self.max_retries + 1})"
                )
                if is_last:
                    raise

        return 0.0

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #1439** (2026-07-08): **[BUG] NCCL timeout during weight synchronization on A800 with AReaL ControllerV2**
  *Symptoms*: ## Checklist  - [x] The error occurs when using our provided Docker image. - [x] I can consistently reproduce the bug across multiple trials or random seeds. - [x] If the error causes experiment abortion, I've verified that this error is the root   cause, not a secondary error caused by peer workers.  ## Detailed Information  ### Describe the bug  ControllerV2 supports only the awex weight synchronization mode.(`areal/trainer/rl_trainer.py: 327`) ```python if self.config.actor._version == "v2":     awex_kwargs: dict[str, Any] = {}     if config.actor.use_lora:         awex_kwargs.update(             {                 "use_lora": config.actor.use_lora,                 "lora_name": config.gconfig.lora_name,                 "base_model_name": config.actor.path,             }         )     self.weight_update_meta = WeightUpdateMeta.from_awex(**awex_kwargs) elif self.config.actor.weight_update_mode == "disk": ``` When four GPUs are used to run GRPO on Qwen3-4B, an NCCL deadlock timeout occurs during the weight synchronization phase. It seems that the Inference Worker did not enter the RECV state. As a result, the Training Worker was always in the SEND waiting state. After the maximum NCCL time (30 minutes) was exceeded, an error was reported. (I'm not sure about this.)  ### Expected behavior  The Qwen3-4B GRPO training can be successfully executed using the Controller V2 and SGlang backends（GPU）.  ### Full logs ``` [rank0]:[E617 08:23:47.299387229 ProcessGroupNCCL.cpp:683]  [Rank 
  **Post-Mortem & Fix Analysis**:
  > I found a second, deterministic transport-selection failure while investigating this issue. It does not require waiting for the NCCL timeout:  - `PPOTrainer._validate_cfg()` requires `actor.weight_update_mode=disk` when the actor   and rollout are colocated. - For v2 controllers with a full-parameter actor, the later dispatch ignores that   validated value and always builds `WeightUpdateMeta.from_awex()`. - The v2 gateway already has a full-model disk branch (`save` on train workers followed   by `/update_weights_from_disk` on inference workers), so the requested transport is   implemented but unreachable from `PPOTrainer`.  In other words, a full-parameter v2 configuration can pass the explicit disk requirement and then silently enter the AWEX/NCCL path anyway. A focused unit reproduction gets `awex` where `disk` was configured.  I am preparing a small regression-tested patch for this explicit-disk selection case. It will preserve AWEX as the default for non-LoRA v2 runs, so it should
  > I opened draft PR #1472 with the focused fix described above.  Scope note: the PR enables explicit full-model disk updates only for non-colocated, local SGLang v2 runs. It also makes failures fail closed and fixes versioned checkpoint path/cleanup handling. It does not claim to fix the AWEX timeout itself or enable v2 single-GPU colocation. 
  > Good catch, we will address this issue as soon as possible.  BTW, 问题可能出在FSDP + awex上，The issue might be with FSDP + awex. After changing actor.backend to `megatron:d2`, the training can proceed normally.

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

Signed-off-by: Mohammad Hijjawi <mohammad.hijjawi1997@gmail.com>

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
+    assert empty_cache.call_count == int(device == "cuda"
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
+    if callab
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

---

### Incident Patch 4: `3c4be16b` (2026-09-22)
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
+  
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
+    
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

### Incident Patch 5: `a00e8c22` (2026-09-22)
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

### Incident Patch 6: `379abffe` (2026-09-22)
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

### Incident Patch 7: `caa613c9` (2026-09-21)
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

Signed-off-by: 杨博 <yb550079@antgroup.com>

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

---

### Incident Patch 8: `b4b1439a` (2026-09-21)
**Commit Message**: fix(utils): honor custom IPv6 probe addresses (#1740)

Resolve the configured probe host before route detection so IPv6-only environments do not silently fall back to an unrelated hardcoded endpoint.

Signed-off-by: Andrew9603 <Andrew9603@users.noreply.github.com>
Co-authored-by: Andrew9603 <Andrew9603@users.noreply.github.com>

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

### Incident Patch 9: `44233e5c` (2026-09-21)
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

### Incident Patch 10: `574bc6a7` (2026-09-21)
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
                     _on
```

#### Recent Merged Pull Requests:
- **PR #1764** (closed): feat(trainer): support DTA tree training on Ascend NPU (@262913)
- **PR #1758** (2026-09-27): fix(dataset): drop ViRL39K rows with unextractable boxed answers (@MohammadHijjawi97)
- **PR #1756** (2026-09-24): fix: reclaim training caches and bind NUMA by CUDA UUID (@dingzhiqiang)
- **PR #1754** (2026-09-30): refactor(awex-colocate): remove patch awex and peft colocate flow (@PrometheusComing)
- **PR #1753** (closed): test: align full-suite CI fixtures with current contracts (@sitabulaixizawaluduo)
- **PR #1750** (2026-09-26): feat(reward): preserve episode outcomes and support mean-only groups (@dingzhiqiang)
- **PR #1749** (2026-09-23): fix(engine): preserve colocate state across offload and recovery (@dingzhiqiang)
- **PR #1748** (2026-09-22): fix(examples): reject generic GameAgent response failures (@Le8r0nJames)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
