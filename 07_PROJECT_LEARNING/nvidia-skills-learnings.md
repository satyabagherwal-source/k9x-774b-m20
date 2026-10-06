# Forensic Learning Record (Deep Inspection): NVIDIA/skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/nvidia-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NVIDIA/skills](https://github.com/NVIDIA/skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:15:19.025Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA/skills`
- **Description**: Agent Skills for NVIDIA products — install into Claude Code, Codex, and other coding agents to run Physical AI, robotics, simulation, CUDA, and RAG workflows end to end.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3525 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `skills/bionemo-kermt-add-cmim-pretrain/scripts/_utils.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Shared utilities for the agent scripts.

Kept intentionally small — only logic that appears (or would otherwise be
duplicated) in two or more `scripts/*.py` modules. Each script
maintains its own primary CLI + main flow.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import os
import pickle
import re
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any


# Conventional pretrain vocab filename stems. Used by prepare_data.py +
# upgrade_to_hybrid.py + the README "Released models" bundling docs +
# the test helpers. Centralized here so a future rename only touches one
# spot.
PRETRAIN_VOCAB_STEMS = {
    "atom":   "pretrain_atom_vocab",
    "bond":   "pretrain_bond_vocab",
    "smiles": "pretrain_smiles_vocab",
}


def resolve_kermt_repo() -> Path:
    """Find the runtime checkout independently of the installed skill location.

    An explicit KERMT_REPO takes precedence. In a repository checkout, walking
    up from this helper or the working directory also supports local use.
    """
    explicit = os.environ.get("KERMT_REPO")
    if explicit:
        candidates = [Path(explicit).expanduser().resolve()]
    else:
        candidates = []
        for start in (Path(__file__).resolve().parent, Path.cwd()):
            candidates.extend((start, *start.parents))
    for candidate in candidates:
        if (candidate / "main.py").is_file() and (candidate / "kermt").is_dir():
            return candidate
    raise FileNotFoundError(
        "KERMT checkout not found. Set KERMT_REPO to the checkout containing "
        "main.py and kermt/; the installed skill directory is separate."
    )


def load_json(path: Path, *, name: str) -> dict[str, Any]:
    """Load a JSON file with consistent error messages.

    `name` is a human-readable label for the document (e.g. "prepare_data.json")
    so the error tells the user which schema we expected at that path.
    """
    if not path.is_file():
        raise FileNotFoundError(f"{name} not found at {path}")
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise ValueError(f"{name} at {path} is not valid JSON: {exc}") from exc


def count_vocab_entries(vocab_path: Path) -> int:
    """Return the number of entries in a KERMT vocab file.

    Handles three layouts:
      - JSON with `{stoi: {token: idx}, ...}` (MolVocab.save_vocab default)
      - JSON as a raw `{token: idx}` dict (legacy / hand-edited)
      - Legacy MolVocab / SMILESVocab pickles, read as inert vocabulary state.

    The pickle reader accepts only the known vocabulary containers and their
    Counter/regex metadata. It cannot import arbitrary classes or run reducers
    supplied by the artifact, and it never falls back to an unrestricted loader.
    """
    if vocab_path.suffix == ".json":
        data = json.loads(vocab_path.read_text())
        if isinstance(data, dict) and "stoi" in data:
            return len(data["stoi"])
        if isinstance(data, dict):
            return len(data)
        raise ValueError(f"unsupported JSON vocab shape at {vocab_path}: {type(data).__name__}")

    with vocab_path.open("rb") as f:
        data = _VocabUnpickler(f).load()
    if isinstance(data, _VocabState) and isinstance(data.stoi, dict):
        return len(data.stoi)
    if isinstance(data, (dict, list, tuple)):
        return len(data)
    raise ValueError(f"could not count entries in {vocab_path}")


class _VocabState:
    """Data-only stand-in: counting tokens does not require tokenizer methods."""


class _VocabUnpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str) -> Any:
        if module in {"kermt.data.torchvocab", "grover.data.torchvocab"} and name in {
            "TorchVocab", "MolVocab", "SMILESVocab",
        }:
            return _VocabState
        if (module, name) == ("collections", "Counter"):
            return Counter
        if (module, name) == ("re", "_compile"):
            return re.compile
        raise pickle.UnpicklingError(f"unsupported vocabulary object: {module}.{name}")


def load_checkpoint(path: Path | str) -> dict[str, Any]:
    """Read KERMT tensors and known metadata with PyTorch's restricted loader.

    Saved arguments use argparse.Namespace; finetuned checkpoints also contain
    numeric NumPy scaler arrays. Explicit globals cover those formats, including
    NumPy 1/2 module names, without accepting artifact-selected imports.
    """
    import numpy as np
    import torch

    multiarray = np._core.multiarray if hasattr(np, "_core") else np.core.multiarray
    allowed = [argparse.Namespace, np.ndarray, np.dtype]
    for module in ("numpy.core.multiarray", "numpy._core.multiarray"):
        allowed.extend([
            (multiarray._reconstruct, f"{module}._reconstruct"),
            (multiarray.scalar, f"{module}.scalar"),
        ])
    allowed.extend(type(np.dtype(name)) for name in (
        "bool", "int8", "int16", "int32", "int64", "uint8", "uint16", "uint32", "uint64",
        "float16", "float32", "float64",
    ))
    with torch.serialization.safe_globals(allowed):
        return torch.load(path, map_location="cpu", weights_only=True)


def runner_environment(repo: Path, *, wandb: bool = False) -> dict[str, str]:
    """Forward named runtime settings, keeping unrelated credentials out of jobs.

    W&B credentials/settings are included only for an explicitly enabled W&B
    run. Hugging Face authentication belongs to the separate download helper.
    """
    names = (
        "PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "LC_CTYPE", "TZ",
        "LD_LIBRARY_PATH", "LIBRARY_PATH", "CUDA_HOME", "CUDA_PATH", "PYTHONPATH",
        "PYTHONDONTWRITEBYTECODE", "PYTHONUNBUFFERED", "PYTHONWARNINGS",
        "CUDA_VISIBLE_DEVICES", "CUDA_DEVICE_ORDER", "CUDA_LAUNCH_BLOCKING", "NVIDIA_VISIBLE_DEVICES",
        "NVIDIA_DRIVER_CAPABILITIES", "CUBLAS_WORKSPACE_CONFIG", "OMP_NUM_THREADS",
        "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS",
        "PYTORCH_CUDA_ALLOC_CONF", "PYTORCH_ALLOC_CONF", "PYTORCH_NO_CUDA_MEMORY_CACHING",
        "TORCH_CPP_LOG_LEVEL", "TORCH_DISTRIBUTED_DEBUG", "NCCL_DEBUG", "NCCL_SOCKET_IFNAME",
        "NCCL_IB_DISABLE", "NCCL_P2P_DISABLE", "NCCL_SHM_DISABLE", "GLOO_SOCKET_IFNAME",
        "MASTER_ADDR", "MASTER_PORT",
        "KERMT_REPO", "KERMT_REPO_COMMIT", "KERMT_REPO_DIRTY",
        "SSL_CERT_FILE", "REQUESTS_CA_BUNDLE",
    )
    if wandb:
        names += (
            "WANDB_API_KEY", "WANDB_BASE_URL", "WANDB_MODE", "WANDB_DIR", "WANDB_ENTITY",
            "WANDB_PROJECT", "WANDB_RUN_ID", "WANDB_RESUME", "WANDB_CACHE_DIR",
            "WANDB_CONFIG_DIR", "WANDB_DATA_DIR", "WANDB_DISABLED",
        )
    env = {name: value for name in names if (value := os.environ.get(name)) is not None}
    env["PYTHONPATH"] = os.pathsep.join(filter(None, (str(repo), env.get("PYTHONPATH"))))
    return env


def validate_vocab_file(vocab_path: Path, *, kind: str) -> None:
    """Verify a user-provided vocab file is loadable BEFORE copying it into a
    run directory. Raises ValueError on failure with a clear, user-facing message.

    `kind` is one of {"atom", "bond", "smiles"} — used only in the error message
    so the user knows which file is wrong.
    """
    if not vocab_path.is_file():
        raise FileNotFoundError(f"{kind} vocab file not found: {vocab_path}")
    try:
        n = count_vocab_entries(vocab_path)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(
            f"{kind} vocab file {vocab_path} is not loadable as a KERMT vocab "
            f"({type(exc).__name__}: {exc}). Expected a MolVocab JSON or pickle "
            f"(or a SMILESVocab pickle for the smiles vocab)."
        ) from exc
    if n <= 0:
        raise ValueError(f"{kind} vocab file {vocab_path} contains zero entries")


# ---------------------------------------------------------------------------
# Runner-shared helpers (run.json manifest fields)
# ---------------------------------------------------------------------------

def git_commit_with_env_override(repo: Path) -> tuple[str, bool]:
    """Returns (commit_sha, dirty_tree). Honors `KERMT_REPO_COMMIT` /
    `KERMT_REPO_DIRTY` env vars first — set by `scripts/kermt_container.sh`
    from the host before launching docker (necessary because `git -C /workspace`
    inside the container fails due to bind-mount ownership). Falls back to the
    in-container git probe when the env vars aren't set."""
    env_commit = os.environ.get("KERMT_REPO_COMMIT")
    if env_commit:
        env_dirty = os.environ.get("KERMT_REPO_DIRTY", "false").strip().lower() == "true"
        return env_commit, env_dirty
    try:
        sha = subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        diff = subprocess.run(
            ["git", "-C", str(repo), "status", "--porcelain"],
            capture_output=True, text=True, check=True,
        )
        return sha, bool(diff.stdout.strip())
    except Exception:
        return "unknown", False


def docker_image_digest(tag: str) -> str | None:
    """Return the docker image's content-addressable Id (sha256:…) for the given
    tag, or None if docker isn't available / the image isn't local."""
    try:
        r = subprocess.run(
            ["docker", "image", "inspect", tag, "--format", "{{.Id}}"],
            capture_output=True, text=True,
        )
        if r.returncode == 0:
            return r.stdout.strip()
    except FileNotFoundError:
        pass
    return None


def format_cmd_replay(argv: list[str], *, env: dict[str, str] | None = None) -> str:
    """Render a copy-pasteable env-prefix + command for the cmd_replay manifest
   
```

### Core Architecture Module: `skills/bionemo-kermt-continue-pretrain/scripts/_utils.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Shared utilities for the agent scripts.

Kept intentionally small — only logic that appears (or would otherwise be
duplicated) in two or more `scripts/*.py` modules. Each script
maintains its own primary CLI + main flow.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import os
import pickle
import re
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any


# Conventional pretrain vocab filename stems. Used by prepare_data.py +
# upgrade_to_hybrid.py + the README "Released models" bundling docs +
# the test helpers. Centralized here so a future rename only touches one
# spot.
PRETRAIN_VOCAB_STEMS = {
    "atom":   "pretrain_atom_vocab",
    "bond":   "pretrain_bond_vocab",
    "smiles": "pretrain_smiles_vocab",
}


def resolve_kermt_repo() -> Path:
    """Find the runtime checkout independently of the installed skill location.

    An explicit KERMT_REPO takes precedence. In a repository checkout, walking
    up from this helper or the working directory also supports local use.
    """
    explicit = os.environ.get("KERMT_REPO")
    if explicit:
        candidates = [Path(explicit).expanduser().resolve()]
    else:
        candidates = []
        for start in (Path(__file__).resolve().parent, Path.cwd()):
            candidates.extend((start, *start.parents))
    for candidate in candidates:
        if (candidate / "main.py").is_file() and (candidate / "kermt").is_dir():
            return candidate
    raise FileNotFoundError(
        "KERMT checkout not found. Set KERMT_REPO to the checkout containing "
        "main.py and kermt/; the installed skill directory is separate."
    )


def load_json(path: Path, *, name: str) -> dict[str, Any]:
    """Load a JSON file with consistent error messages.

    `name` is a human-readable label for the document (e.g. "prepare_data.json")
    so the error tells the user which schema we expected at that path.
    """
    if not path.is_file():
        raise FileNotFoundError(f"{name} not found at {path}")
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise ValueError(f"{name} at {path} is not valid JSON: {exc}") from exc


def count_vocab_entries(vocab_path: Path) -> int:
    """Return the number of entries in a KERMT vocab file.

    Handles three layouts:
      - JSON with `{stoi: {token: idx}, ...}` (MolVocab.save_vocab default)
      - JSON as a raw `{token: idx}` dict (legacy / hand-edited)
      - Legacy MolVocab / SMILESVocab pickles, read as inert vocabulary state.

    The pickle reader accepts only the known vocabulary containers and their
    Counter/regex metadata. It cannot import arbitrary classes or run reducers
    supplied by the artifact, and it never falls back to an unrestricted loader.
    """
    if vocab_path.suffix == ".json":
        data = json.loads(vocab_path.read_text())
        if isinstance(data, dict) and "stoi" in data:
            return len(data["stoi"])
        if isinstance(data, dict):
            return len(data)
        raise ValueError(f"unsupported JSON vocab shape at {vocab_path}: {type(data).__name__}")

    with vocab_path.open("rb") as f:
        data = _VocabUnpickler(f).load()
    if isinstance(data, _VocabState) and isinstance(data.stoi, dict):
        return len(data.stoi)
    if isinstance(data, (dict, list, tuple)):
        return len(data)
    raise ValueError(f"could not count entries in {vocab_path}")


class _VocabState:
    """Data-only stand-in: counting tokens does not require tokenizer methods."""


class _VocabUnpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str) -> Any:
        if module in {"kermt.data.torchvocab", "grover.data.torchvocab"} and name in {
            "TorchVocab", "MolVocab", "SMILESVocab",
        }:
            return _VocabState
        if (module, name) == ("collections", "Counter"):
            return Counter
        if (module, name) == ("re", "_compile"):
            return re.compile
        raise pickle.UnpicklingError(f"unsupported vocabulary object: {module}.{name}")


def load_checkpoint(path: Path | str) -> dict[str, Any]:
    """Read KERMT tensors and known metadata with PyTorch's restricted loader.

    Saved arguments use argparse.Namespace; finetuned checkpoints also contain
    numeric NumPy scaler arrays. Explicit globals cover those formats, including
    NumPy 1/2 module names, without accepting artifact-selected imports.
    """
    import numpy as np
    import torch

    multiarray = np._core.multiarray if hasattr(np, "_core") else np.core.multiarray
    allowed = [argparse.Namespace, np.ndarray, np.dtype]
    for module in ("numpy.core.multiarray", "numpy._core.multiarray"):
        allowed.extend([
            (multiarray._reconstruct, f"{module}._reconstruct"),
            (multiarray.scalar, f"{module}.scalar"),
        ])
    allowed.extend(type(np.dtype(name)) for name in (
        "bool", "int8", "int16", "int32", "int64", "uint8", "uint16", "uint32", "uint64",
        "float16", "float32", "float64",
    ))
    with torch.serialization.safe_globals(allowed):
        return torch.load(path, map_location="cpu", weights_only=True)


def runner_environment(repo: Path, *, wandb: bool = False) -> dict[str, str]:
    """Forward named runtime settings, keeping unrelated credentials out of jobs.

    W&B credentials/settings are included only for an explicitly enabled W&B
    run. Hugging Face authentication belongs to the separate download helper.
    """
    names = (
        "PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "LC_CTYPE", "TZ",
        "LD_LIBRARY_PATH", "LIBRARY_PATH", "CUDA_HOME", "CUDA_PATH", "PYTHONPATH",
        "PYTHONDONTWRITEBYTECODE", "PYTHONUNBUFFERED", "PYTHONWARNINGS",
        "CUDA_VISIBLE_DEVICES", "CUDA_DEVICE_ORDER", "CUDA_LAUNCH_BLOCKING", "NVIDIA_VISIBLE_DEVICES",
        "NVIDIA_DRIVER_CAPABILITIES", "CUBLAS_WORKSPACE_CONFIG", "OMP_NUM_THREADS",
        "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS",
        "PYTORCH_CUDA_ALLOC_CONF", "PYTORCH_ALLOC_CONF", "PYTORCH_NO_CUDA_MEMORY_CACHING",
        "TORCH_CPP_LOG_LEVEL", "TORCH_DISTRIBUTED_DEBUG", "NCCL_DEBUG", "NCCL_SOCKET_IFNAME",
        "NCCL_IB_DISABLE", "NCCL_P2P_DISABLE", "NCCL_SHM_DISABLE", "GLOO_SOCKET_IFNAME",
        "MASTER_ADDR", "MASTER_PORT",
        "KERMT_REPO", "KERMT_REPO_COMMIT", "KERMT_REPO_DIRTY",
        "SSL_CERT_FILE", "REQUESTS_CA_BUNDLE",
    )
    if wandb:
        names += (
            "WANDB_API_KEY", "WANDB_BASE_URL", "WANDB_MODE", "WANDB_DIR", "WANDB_ENTITY",
            "WANDB_PROJECT", "WANDB_RUN_ID", "WANDB_RESUME", "WANDB_CACHE_DIR",
            "WANDB_CONFIG_DIR", "WANDB_DATA_DIR", "WANDB_DISABLED",
        )
    env = {name: value for name in names if (value := os.environ.get(name)) is not None}
    env["PYTHONPATH"] = os.pathsep.join(filter(None, (str(repo), env.get("PYTHONPATH"))))
    return env


def validate_vocab_file(vocab_path: Path, *, kind: str) -> None:
    """Verify a user-provided vocab file is loadable BEFORE copying it into a
    run directory. Raises ValueError on failure with a clear, user-facing message.

    `kind` is one of {"atom", "bond", "smiles"} — used only in the error message
    so the user knows which file is wrong.
    """
    if not vocab_path.is_file():
        raise FileNotFoundError(f"{kind} vocab file not found: {vocab_path}")
    try:
        n = count_vocab_entries(vocab_path)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(
            f"{kind} vocab file {vocab_path} is not loadable as a KERMT vocab "
            f"({type(exc).__name__}: {exc}). Expected a MolVocab JSON or pickle "
            f"(or a SMILESVocab pickle for the smiles vocab)."
        ) from exc
    if n <= 0:
        raise ValueError(f"{kind} vocab file {vocab_path} contains zero entries")


# ---------------------------------------------------------------------------
# Runner-shared helpers (run.json manifest fields)
# ---------------------------------------------------------------------------

def git_commit_with_env_override(repo: Path) -> tuple[str, bool]:
    """Returns (commit_sha, dirty_tree). Honors `KERMT_REPO_COMMIT` /
    `KERMT_REPO_DIRTY` env vars first — set by `scripts/kermt_container.sh`
    from the host before launching docker (necessary because `git -C /workspace`
    inside the container fails due to bind-mount ownership). Falls back to the
    in-container git probe when the env vars aren't set."""
    env_commit = os.environ.get("KERMT_REPO_COMMIT")
    if env_commit:
        env_dirty = os.environ.get("KERMT_REPO_DIRTY", "false").strip().lower() == "true"
        return env_commit, env_dirty
    try:
        sha = subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        diff = subprocess.run(
            ["git", "-C", str(repo), "status", "--porcelain"],
            capture_output=True, text=True, check=True,
        )
        return sha, bool(diff.stdout.strip())
    except Exception:
        return "unknown", False


def docker_image_digest(tag: str) -> str | None:
    """Return the docker image's content-addressable Id (sha256:…) for the given
    tag, or None if docker isn't available / the image isn't local."""
    try:
        r = subprocess.run(
            ["docker", "image", "inspect", tag, "--format", "{{.Id}}"],
            capture_output=True, text=True,
        )
        if r.returncode == 0:
            return r.stdout.strip()
    except FileNotFoundError:
        pass
    return None


def format_cmd_replay(argv: list[str], *, env: dict[str, str] | None = None) -> str:
    """Render a copy-pasteable env-prefix + command for the cmd_replay manifest
   
```

### Core Architecture Module: `skills/bionemo-kermt-embed/scripts/_utils.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Shared utilities for the agent scripts.

Kept intentionally small — only logic that appears (or would otherwise be
duplicated) in two or more `scripts/*.py` modules. Each script
maintains its own primary CLI + main flow.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import os
import pickle
import re
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any


# Conventional pretrain vocab filename stems. Used by prepare_data.py +
# upgrade_to_hybrid.py + the README "Released models" bundling docs +
# the test helpers. Centralized here so a future rename only touches one
# spot.
PRETRAIN_VOCAB_STEMS = {
    "atom":   "pretrain_atom_vocab",
    "bond":   "pretrain_bond_vocab",
    "smiles": "pretrain_smiles_vocab",
}


def resolve_kermt_repo() -> Path:
    """Find the runtime checkout independently of the installed skill location.

    An explicit KERMT_REPO takes precedence. In a repository checkout, walking
    up from this helper or the working directory also supports local use.
    """
    explicit = os.environ.get("KERMT_REPO")
    if explicit:
        candidates = [Path(explicit).expanduser().resolve()]
    else:
        candidates = []
        for start in (Path(__file__).resolve().parent, Path.cwd()):
            candidates.extend((start, *start.parents))
    for candidate in candidates:
        if (candidate / "main.py").is_file() and (candidate / "kermt").is_dir():
            return candidate
    raise FileNotFoundError(
        "KERMT checkout not found. Set KERMT_REPO to the checkout containing "
        "main.py and kermt/; the installed skill directory is separate."
    )


def load_json(path: Path, *, name: str) -> dict[str, Any]:
    """Load a JSON file with consistent error messages.

    `name` is a human-readable label for the document (e.g. "prepare_data.json")
    so the error tells the user which schema we expected at that path.
    """
    if not path.is_file():
        raise FileNotFoundError(f"{name} not found at {path}")
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise ValueError(f"{name} at {path} is not valid JSON: {exc}") from exc


def count_vocab_entries(vocab_path: Path) -> int:
    """Return the number of entries in a KERMT vocab file.

    Handles three layouts:
      - JSON with `{stoi: {token: idx}, ...}` (MolVocab.save_vocab default)
      - JSON as a raw `{token: idx}` dict (legacy / hand-edited)
      - Legacy MolVocab / SMILESVocab pickles, read as inert vocabulary state.

    The pickle reader accepts only the known vocabulary containers and their
    Counter/regex metadata. It cannot import arbitrary classes or run reducers
    supplied by the artifact, and it never falls back to an unrestricted loader.
    """
    if vocab_path.suffix == ".json":
        data = json.loads(vocab_path.read_text())
        if isinstance(data, dict) and "stoi" in data:
            return len(data["stoi"])
        if isinstance(data, dict):
            return len(data)
        raise ValueError(f"unsupported JSON vocab shape at {vocab_path}: {type(data).__name__}")

    with vocab_path.open("rb") as f:
        data = _VocabUnpickler(f).load()
    if isinstance(data, _VocabState) and isinstance(data.stoi, dict):
        return len(data.stoi)
    if isinstance(data, (dict, list, tuple)):
        return len(data)
    raise ValueError(f"could not count entries in {vocab_path}")


class _VocabState:
    """Data-only stand-in: counting tokens does not require tokenizer methods."""


class _VocabUnpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str) -> Any:
        if module in {"kermt.data.torchvocab", "grover.data.torchvocab"} and name in {
            "TorchVocab", "MolVocab", "SMILESVocab",
        }:
            return _VocabState
        if (module, name) == ("collections", "Counter"):
            return Counter
        if (module, name) == ("re", "_compile"):
            return re.compile
        raise pickle.UnpicklingError(f"unsupported vocabulary object: {module}.{name}")


def load_checkpoint(path: Path | str) -> dict[str, Any]:
    """Read KERMT tensors and known metadata with PyTorch's restricted loader.

    Saved arguments use argparse.Namespace; finetuned checkpoints also contain
    numeric NumPy scaler arrays. Explicit globals cover those formats, including
    NumPy 1/2 module names, without accepting artifact-selected imports.
    """
    import numpy as np
    import torch

    multiarray = np._core.multiarray if hasattr(np, "_core") else np.core.multiarray
    allowed = [argparse.Namespace, np.ndarray, np.dtype]
    for module in ("numpy.core.multiarray", "numpy._core.multiarray"):
        allowed.extend([
            (multiarray._reconstruct, f"{module}._reconstruct"),
            (multiarray.scalar, f"{module}.scalar"),
        ])
    allowed.extend(type(np.dtype(name)) for name in (
        "bool", "int8", "int16", "int32", "int64", "uint8", "uint16", "uint32", "uint64",
        "float16", "float32", "float64",
    ))
    with torch.serialization.safe_globals(allowed):
        return torch.load(path, map_location="cpu", weights_only=True)


def runner_environment(repo: Path, *, wandb: bool = False) -> dict[str, str]:
    """Forward named runtime settings, keeping unrelated credentials out of jobs.

    W&B credentials/settings are included only for an explicitly enabled W&B
    run. Hugging Face authentication belongs to the separate download helper.
    """
    names = (
        "PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "LC_CTYPE", "TZ",
        "LD_LIBRARY_PATH", "LIBRARY_PATH", "CUDA_HOME", "CUDA_PATH", "PYTHONPATH",
        "PYTHONDONTWRITEBYTECODE", "PYTHONUNBUFFERED", "PYTHONWARNINGS",
        "CUDA_VISIBLE_DEVICES", "CUDA_DEVICE_ORDER", "CUDA_LAUNCH_BLOCKING", "NVIDIA_VISIBLE_DEVICES",
        "NVIDIA_DRIVER_CAPABILITIES", "CUBLAS_WORKSPACE_CONFIG", "OMP_NUM_THREADS",
        "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS",
        "PYTORCH_CUDA_ALLOC_CONF", "PYTORCH_ALLOC_CONF", "PYTORCH_NO_CUDA_MEMORY_CACHING",
        "TORCH_CPP_LOG_LEVEL", "TORCH_DISTRIBUTED_DEBUG", "NCCL_DEBUG", "NCCL_SOCKET_IFNAME",
        "NCCL_IB_DISABLE", "NCCL_P2P_DISABLE", "NCCL_SHM_DISABLE", "GLOO_SOCKET_IFNAME",
        "MASTER_ADDR", "MASTER_PORT",
        "KERMT_REPO", "KERMT_REPO_COMMIT", "KERMT_REPO_DIRTY",
        "SSL_CERT_FILE", "REQUESTS_CA_BUNDLE",
    )
    if wandb:
        names += (
            "WANDB_API_KEY", "WANDB_BASE_URL", "WANDB_MODE", "WANDB_DIR", "WANDB_ENTITY",
            "WANDB_PROJECT", "WANDB_RUN_ID", "WANDB_RESUME", "WANDB_CACHE_DIR",
            "WANDB_CONFIG_DIR", "WANDB_DATA_DIR", "WANDB_DISABLED",
        )
    env = {name: value for name in names if (value := os.environ.get(name)) is not None}
    env["PYTHONPATH"] = os.pathsep.join(filter(None, (str(repo), env.get("PYTHONPATH"))))
    return env


def validate_vocab_file(vocab_path: Path, *, kind: str) -> None:
    """Verify a user-provided vocab file is loadable BEFORE copying it into a
    run directory. Raises ValueError on failure with a clear, user-facing message.

    `kind` is one of {"atom", "bond", "smiles"} — used only in the error message
    so the user knows which file is wrong.
    """
    if not vocab_path.is_file():
        raise FileNotFoundError(f"{kind} vocab file not found: {vocab_path}")
    try:
        n = count_vocab_entries(vocab_path)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(
            f"{kind} vocab file {vocab_path} is not loadable as a KERMT vocab "
            f"({type(exc).__name__}: {exc}). Expected a MolVocab JSON or pickle "
            f"(or a SMILESVocab pickle for the smiles vocab)."
        ) from exc
    if n <= 0:
        raise ValueError(f"{kind} vocab file {vocab_path} contains zero entries")


# ---------------------------------------------------------------------------
# Runner-shared helpers (run.json manifest fields)
# ---------------------------------------------------------------------------

def git_commit_with_env_override(repo: Path) -> tuple[str, bool]:
    """Returns (commit_sha, dirty_tree). Honors `KERMT_REPO_COMMIT` /
    `KERMT_REPO_DIRTY` env vars first — set by `scripts/kermt_container.sh`
    from the host before launching docker (necessary because `git -C /workspace`
    inside the container fails due to bind-mount ownership). Falls back to the
    in-container git probe when the env vars aren't set."""
    env_commit = os.environ.get("KERMT_REPO_COMMIT")
    if env_commit:
        env_dirty = os.environ.get("KERMT_REPO_DIRTY", "false").strip().lower() == "true"
        return env_commit, env_dirty
    try:
        sha = subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        diff = subprocess.run(
            ["git", "-C", str(repo), "status", "--porcelain"],
            capture_output=True, text=True, check=True,
        )
        return sha, bool(diff.stdout.strip())
    except Exception:
        return "unknown", False


def docker_image_digest(tag: str) -> str | None:
    """Return the docker image's content-addressable Id (sha256:…) for the given
    tag, or None if docker isn't available / the image isn't local."""
    try:
        r = subprocess.run(
            ["docker", "image", "inspect", tag, "--format", "{{.Id}}"],
            capture_output=True, text=True,
        )
        if r.returncode == 0:
            return r.stdout.strip()
    except FileNotFoundError:
        pass
    return None


def format_cmd_replay(argv: list[str], *, env: dict[str, str] | None = None) -> str:
    """Render a copy-pasteable env-prefix + command for the cmd_replay manifest
   
```

### Core Architecture Module: `skills/bionemo-kermt-finetune/scripts/_utils.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Shared utilities for the agent scripts.

Kept intentionally small — only logic that appears (or would otherwise be
duplicated) in two or more `scripts/*.py` modules. Each script
maintains its own primary CLI + main flow.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import os
import pickle
import re
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any


# Conventional pretrain vocab filename stems. Used by prepare_data.py +
# upgrade_to_hybrid.py + the README "Released models" bundling docs +
# the test helpers. Centralized here so a future rename only touches one
# spot.
PRETRAIN_VOCAB_STEMS = {
    "atom":   "pretrain_atom_vocab",
    "bond":   "pretrain_bond_vocab",
    "smiles": "pretrain_smiles_vocab",
}


def resolve_kermt_repo() -> Path:
    """Find the runtime checkout independently of the installed skill location.

    An explicit KERMT_REPO takes precedence. In a repository checkout, walking
    up from this helper or the working directory also supports local use.
    """
    explicit = os.environ.get("KERMT_REPO")
    if explicit:
        candidates = [Path(explicit).expanduser().resolve()]
    else:
        candidates = []
        for start in (Path(__file__).resolve().parent, Path.cwd()):
            candidates.extend((start, *start.parents))
    for candidate in candidates:
        if (candidate / "main.py").is_file() and (candidate / "kermt").is_dir():
            return candidate
    raise FileNotFoundError(
        "KERMT checkout not found. Set KERMT_REPO to the checkout containing "
        "main.py and kermt/; the installed skill directory is separate."
    )


def load_json(path: Path, *, name: str) -> dict[str, Any]:
    """Load a JSON file with consistent error messages.

    `name` is a human-readable label for the document (e.g. "prepare_data.json")
    so the error tells the user which schema we expected at that path.
    """
    if not path.is_file():
        raise FileNotFoundError(f"{name} not found at {path}")
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise ValueError(f"{name} at {path} is not valid JSON: {exc}") from exc


def count_vocab_entries(vocab_path: Path) -> int:
    """Return the number of entries in a KERMT vocab file.

    Handles three layouts:
      - JSON with `{stoi: {token: idx}, ...}` (MolVocab.save_vocab default)
      - JSON as a raw `{token: idx}` dict (legacy / hand-edited)
      - Legacy MolVocab / SMILESVocab pickles, read as inert vocabulary state.

    The pickle reader accepts only the known vocabulary containers and their
    Counter/regex metadata. It cannot import arbitrary classes or run reducers
    supplied by the artifact, and it never falls back to an unrestricted loader.
    """
    if vocab_path.suffix == ".json":
        data = json.loads(vocab_path.read_text())
        if isinstance(data, dict) and "stoi" in data:
            return len(data["stoi"])
        if isinstance(data, dict):
            return len(data)
        raise ValueError(f"unsupported JSON vocab shape at {vocab_path}: {type(data).__name__}")

    with vocab_path.open("rb") as f:
        data = _VocabUnpickler(f).load()
    if isinstance(data, _VocabState) and isinstance(data.stoi, dict):
        return len(data.stoi)
    if isinstance(data, (dict, list, tuple)):
        return len(data)
    raise ValueError(f"could not count entries in {vocab_path}")


class _VocabState:
    """Data-only stand-in: counting tokens does not require tokenizer methods."""


class _VocabUnpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str) -> Any:
        if module in {"kermt.data.torchvocab", "grover.data.torchvocab"} and name in {
            "TorchVocab", "MolVocab", "SMILESVocab",
        }:
            return _VocabState
        if (module, name) == ("collections", "Counter"):
            return Counter
        if (module, name) == ("re", "_compile"):
            return re.compile
        raise pickle.UnpicklingError(f"unsupported vocabulary object: {module}.{name}")


def load_checkpoint(path: Path | str) -> dict[str, Any]:
    """Read KERMT tensors and known metadata with PyTorch's restricted loader.

    Saved arguments use argparse.Namespace; finetuned checkpoints also contain
    numeric NumPy scaler arrays. Explicit globals cover those formats, including
    NumPy 1/2 module names, without accepting artifact-selected imports.
    """
    import numpy as np
    import torch

    multiarray = np._core.multiarray if hasattr(np, "_core") else np.core.multiarray
    allowed = [argparse.Namespace, np.ndarray, np.dtype]
    for module in ("numpy.core.multiarray", "numpy._core.multiarray"):
        allowed.extend([
            (multiarray._reconstruct, f"{module}._reconstruct"),
            (multiarray.scalar, f"{module}.scalar"),
        ])
    allowed.extend(type(np.dtype(name)) for name in (
        "bool", "int8", "int16", "int32", "int64", "uint8", "uint16", "uint32", "uint64",
        "float16", "float32", "float64",
    ))
    with torch.serialization.safe_globals(allowed):
        return torch.load(path, map_location="cpu", weights_only=True)


def runner_environment(repo: Path, *, wandb: bool = False) -> dict[str, str]:
    """Forward named runtime settings, keeping unrelated credentials out of jobs.

    W&B credentials/settings are included only for an explicitly enabled W&B
    run. Hugging Face authentication belongs to the separate download helper.
    """
    names = (
        "PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "LC_CTYPE", "TZ",
        "LD_LIBRARY_PATH", "LIBRARY_PATH", "CUDA_HOME", "CUDA_PATH", "PYTHONPATH",
        "PYTHONDONTWRITEBYTECODE", "PYTHONUNBUFFERED", "PYTHONWARNINGS",
        "CUDA_VISIBLE_DEVICES", "CUDA_DEVICE_ORDER", "CUDA_LAUNCH_BLOCKING", "NVIDIA_VISIBLE_DEVICES",
        "NVIDIA_DRIVER_CAPABILITIES", "CUBLAS_WORKSPACE_CONFIG", "OMP_NUM_THREADS",
        "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS",
        "PYTORCH_CUDA_ALLOC_CONF", "PYTORCH_ALLOC_CONF", "PYTORCH_NO_CUDA_MEMORY_CACHING",
        "TORCH_CPP_LOG_LEVEL", "TORCH_DISTRIBUTED_DEBUG", "NCCL_DEBUG", "NCCL_SOCKET_IFNAME",
        "NCCL_IB_DISABLE", "NCCL_P2P_DISABLE", "NCCL_SHM_DISABLE", "GLOO_SOCKET_IFNAME",
        "MASTER_ADDR", "MASTER_PORT",
        "KERMT_REPO", "KERMT_REPO_COMMIT", "KERMT_REPO_DIRTY",
        "SSL_CERT_FILE", "REQUESTS_CA_BUNDLE",
    )
    if wandb:
        names += (
            "WANDB_API_KEY", "WANDB_BASE_URL", "WANDB_MODE", "WANDB_DIR", "WANDB_ENTITY",
            "WANDB_PROJECT", "WANDB_RUN_ID", "WANDB_RESUME", "WANDB_CACHE_DIR",
            "WANDB_CONFIG_DIR", "WANDB_DATA_DIR", "WANDB_DISABLED",
        )
    env = {name: value for name in names if (value := os.environ.get(name)) is not None}
    env["PYTHONPATH"] = os.pathsep.join(filter(None, (str(repo), env.get("PYTHONPATH"))))
    return env


def validate_vocab_file(vocab_path: Path, *, kind: str) -> None:
    """Verify a user-provided vocab file is loadable BEFORE copying it into a
    run directory. Raises ValueError on failure with a clear, user-facing message.

    `kind` is one of {"atom", "bond", "smiles"} — used only in the error message
    so the user knows which file is wrong.
    """
    if not vocab_path.is_file():
        raise FileNotFoundError(f"{kind} vocab file not found: {vocab_path}")
    try:
        n = count_vocab_entries(vocab_path)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(
            f"{kind} vocab file {vocab_path} is not loadable as a KERMT vocab "
            f"({type(exc).__name__}: {exc}). Expected a MolVocab JSON or pickle "
            f"(or a SMILESVocab pickle for the smiles vocab)."
        ) from exc
    if n <= 0:
        raise ValueError(f"{kind} vocab file {vocab_path} contains zero entries")


# ---------------------------------------------------------------------------
# Runner-shared helpers (run.json manifest fields)
# ---------------------------------------------------------------------------

def git_commit_with_env_override(repo: Path) -> tuple[str, bool]:
    """Returns (commit_sha, dirty_tree). Honors `KERMT_REPO_COMMIT` /
    `KERMT_REPO_DIRTY` env vars first — set by `scripts/kermt_container.sh`
    from the host before launching docker (necessary because `git -C /workspace`
    inside the container fails due to bind-mount ownership). Falls back to the
    in-container git probe when the env vars aren't set."""
    env_commit = os.environ.get("KERMT_REPO_COMMIT")
    if env_commit:
        env_dirty = os.environ.get("KERMT_REPO_DIRTY", "false").strip().lower() == "true"
        return env_commit, env_dirty
    try:
        sha = subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        diff = subprocess.run(
            ["git", "-C", str(repo), "status", "--porcelain"],
            capture_output=True, text=True, check=True,
        )
        return sha, bool(diff.stdout.strip())
    except Exception:
        return "unknown", False


def docker_image_digest(tag: str) -> str | None:
    """Return the docker image's content-addressable Id (sha256:…) for the given
    tag, or None if docker isn't available / the image isn't local."""
    try:
        r = subprocess.run(
            ["docker", "image", "inspect", tag, "--format", "{{.Id}}"],
            capture_output=True, text=True,
        )
        if r.returncode == 0:
            return r.stdout.strip()
    except FileNotFoundError:
        pass
    return None


def format_cmd_replay(argv: list[str], *, env: dict[str, str] | None = None) -> str:
    """Render a copy-pasteable env-prefix + command for the cmd_replay manifest
   
```

### Core Architecture Module: `skills/bionemo-kermt-infer/scripts/_utils.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Shared utilities for the agent scripts.

Kept intentionally small — only logic that appears (or would otherwise be
duplicated) in two or more `scripts/*.py` modules. Each script
maintains its own primary CLI + main flow.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import os
import pickle
import re
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any


# Conventional pretrain vocab filename stems. Used by prepare_data.py +
# upgrade_to_hybrid.py + the README "Released models" bundling docs +
# the test helpers. Centralized here so a future rename only touches one
# spot.
PRETRAIN_VOCAB_STEMS = {
    "atom":   "pretrain_atom_vocab",
    "bond":   "pretrain_bond_vocab",
    "smiles": "pretrain_smiles_vocab",
}


def resolve_kermt_repo() -> Path:
    """Find the runtime checkout independently of the installed skill location.

    An explicit KERMT_REPO takes precedence. In a repository checkout, walking
    up from this helper or the working directory also supports local use.
    """
    explicit = os.environ.get("KERMT_REPO")
    if explicit:
        candidates = [Path(explicit).expanduser().resolve()]
    else:
        candidates = []
        for start in (Path(__file__).resolve().parent, Path.cwd()):
            candidates.extend((start, *start.parents))
    for candidate in candidates:
        if (candidate / "main.py").is_file() and (candidate / "kermt").is_dir():
            return candidate
    raise FileNotFoundError(
        "KERMT checkout not found. Set KERMT_REPO to the checkout containing "
        "main.py and kermt/; the installed skill directory is separate."
    )


def load_json(path: Path, *, name: str) -> dict[str, Any]:
    """Load a JSON file with consistent error messages.

    `name` is a human-readable label for the document (e.g. "prepare_data.json")
    so the error tells the user which schema we expected at that path.
    """
    if not path.is_file():
        raise FileNotFoundError(f"{name} not found at {path}")
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise ValueError(f"{name} at {path} is not valid JSON: {exc}") from exc


def count_vocab_entries(vocab_path: Path) -> int:
    """Return the number of entries in a KERMT vocab file.

    Handles three layouts:
      - JSON with `{stoi: {token: idx}, ...}` (MolVocab.save_vocab default)
      - JSON as a raw `{token: idx}` dict (legacy / hand-edited)
      - Legacy MolVocab / SMILESVocab pickles, read as inert vocabulary state.

    The pickle reader accepts only the known vocabulary containers and their
    Counter/regex metadata. It cannot import arbitrary classes or run reducers
    supplied by the artifact, and it never falls back to an unrestricted loader.
    """
    if vocab_path.suffix == ".json":
        data = json.loads(vocab_path.read_text())
        if isinstance(data, dict) and "stoi" in data:
            return len(data["stoi"])
        if isinstance(data, dict):
            return len(data)
        raise ValueError(f"unsupported JSON vocab shape at {vocab_path}: {type(data).__name__}")

    with vocab_path.open("rb") as f:
        data = _VocabUnpickler(f).load()
    if isinstance(data, _VocabState) and isinstance(data.stoi, dict):
        return len(data.stoi)
    if isinstance(data, (dict, list, tuple)):
        return len(data)
    raise ValueError(f"could not count entries in {vocab_path}")


class _VocabState:
    """Data-only stand-in: counting tokens does not require tokenizer methods."""


class _VocabUnpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str) -> Any:
        if module in {"kermt.data.torchvocab", "grover.data.torchvocab"} and name in {
            "TorchVocab", "MolVocab", "SMILESVocab",
        }:
            return _VocabState
        if (module, name) == ("collections", "Counter"):
            return Counter
        if (module, name) == ("re", "_compile"):
            return re.compile
        raise pickle.UnpicklingError(f"unsupported vocabulary object: {module}.{name}")


def load_checkpoint(path: Path | str) -> dict[str, Any]:
    """Read KERMT tensors and known metadata with PyTorch's restricted loader.

    Saved arguments use argparse.Namespace; finetuned checkpoints also contain
    numeric NumPy scaler arrays. Explicit globals cover those formats, including
    NumPy 1/2 module names, without accepting artifact-selected imports.
    """
    import numpy as np
    import torch

    multiarray = np._core.multiarray if hasattr(np, "_core") else np.core.multiarray
    allowed = [argparse.Namespace, np.ndarray, np.dtype]
    for module in ("numpy.core.multiarray", "numpy._core.multiarray"):
        allowed.extend([
            (multiarray._reconstruct, f"{module}._reconstruct"),
            (multiarray.scalar, f"{module}.scalar"),
        ])
    allowed.extend(type(np.dtype(name)) for name in (
        "bool", "int8", "int16", "int32", "int64", "uint8", "uint16", "uint32", "uint64",
        "float16", "float32", "float64",
    ))
    with torch.serialization.safe_globals(allowed):
        return torch.load(path, map_location="cpu", weights_only=True)


def runner_environment(repo: Path, *, wandb: bool = False) -> dict[str, str]:
    """Forward named runtime settings, keeping unrelated credentials out of jobs.

    W&B credentials/settings are included only for an explicitly enabled W&B
    run. Hugging Face authentication belongs to the separate download helper.
    """
    names = (
        "PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "LC_CTYPE", "TZ",
        "LD_LIBRARY_PATH", "LIBRARY_PATH", "CUDA_HOME", "CUDA_PATH", "PYTHONPATH",
        "PYTHONDONTWRITEBYTECODE", "PYTHONUNBUFFERED", "PYTHONWARNINGS",
        "CUDA_VISIBLE_DEVICES", "CUDA_DEVICE_ORDER", "CUDA_LAUNCH_BLOCKING", "NVIDIA_VISIBLE_DEVICES",
        "NVIDIA_DRIVER_CAPABILITIES", "CUBLAS_WORKSPACE_CONFIG", "OMP_NUM_THREADS",
        "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS",
        "PYTORCH_CUDA_ALLOC_CONF", "PYTORCH_ALLOC_CONF", "PYTORCH_NO_CUDA_MEMORY_CACHING",
        "TORCH_CPP_LOG_LEVEL", "TORCH_DISTRIBUTED_DEBUG", "NCCL_DEBUG", "NCCL_SOCKET_IFNAME",
        "NCCL_IB_DISABLE", "NCCL_P2P_DISABLE", "NCCL_SHM_DISABLE", "GLOO_SOCKET_IFNAME",
        "MASTER_ADDR", "MASTER_PORT",
        "KERMT_REPO", "KERMT_REPO_COMMIT", "KERMT_REPO_DIRTY",
        "SSL_CERT_FILE", "REQUESTS_CA_BUNDLE",
    )
    if wandb:
        names += (
            "WANDB_API_KEY", "WANDB_BASE_URL", "WANDB_MODE", "WANDB_DIR", "WANDB_ENTITY",
            "WANDB_PROJECT", "WANDB_RUN_ID", "WANDB_RESUME", "WANDB_CACHE_DIR",
            "WANDB_CONFIG_DIR", "WANDB_DATA_DIR", "WANDB_DISABLED",
        )
    env = {name: value for name in names if (value := os.environ.get(name)) is not None}
    env["PYTHONPATH"] = os.pathsep.join(filter(None, (str(repo), env.get("PYTHONPATH"))))
    return env


def validate_vocab_file(vocab_path: Path, *, kind: str) -> None:
    """Verify a user-provided vocab file is loadable BEFORE copying it into a
    run directory. Raises ValueError on failure with a clear, user-facing message.

    `kind` is one of {"atom", "bond", "smiles"} — used only in the error message
    so the user knows which file is wrong.
    """
    if not vocab_path.is_file():
        raise FileNotFoundError(f"{kind} vocab file not found: {vocab_path}")
    try:
        n = count_vocab_entries(vocab_path)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(
            f"{kind} vocab file {vocab_path} is not loadable as a KERMT vocab "
            f"({type(exc).__name__}: {exc}). Expected a MolVocab JSON or pickle "
            f"(or a SMILESVocab pickle for the smiles vocab)."
        ) from exc
    if n <= 0:
        raise ValueError(f"{kind} vocab file {vocab_path} contains zero entries")


# ---------------------------------------------------------------------------
# Runner-shared helpers (run.json manifest fields)
# ---------------------------------------------------------------------------

def git_commit_with_env_override(repo: Path) -> tuple[str, bool]:
    """Returns (commit_sha, dirty_tree). Honors `KERMT_REPO_COMMIT` /
    `KERMT_REPO_DIRTY` env vars first — set by `scripts/kermt_container.sh`
    from the host before launching docker (necessary because `git -C /workspace`
    inside the container fails due to bind-mount ownership). Falls back to the
    in-container git probe when the env vars aren't set."""
    env_commit = os.environ.get("KERMT_REPO_COMMIT")
    if env_commit:
        env_dirty = os.environ.get("KERMT_REPO_DIRTY", "false").strip().lower() == "true"
        return env_commit, env_dirty
    try:
        sha = subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        diff = subprocess.run(
            ["git", "-C", str(repo), "status", "--porcelain"],
            capture_output=True, text=True, check=True,
        )
        return sha, bool(diff.stdout.strip())
    except Exception:
        return "unknown", False


def docker_image_digest(tag: str) -> str | None:
    """Return the docker image's content-addressable Id (sha256:…) for the given
    tag, or None if docker isn't available / the image isn't local."""
    try:
        r = subprocess.run(
            ["docker", "image", "inspect", tag, "--format", "{{.Id}}"],
            capture_output=True, text=True,
        )
        if r.returncode == 0:
            return r.stdout.strip()
    except FileNotFoundError:
        pass
    return None


def format_cmd_replay(argv: list[str], *, env: dict[str, str] | None = None) -> str:
    """Render a copy-pasteable env-prefix + command for the cmd_replay manifest
   
```

### Core Architecture Module: `skills/bionemo-kermt-pretrain-scratch/scripts/_utils.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Shared utilities for the agent scripts.

Kept intentionally small — only logic that appears (or would otherwise be
duplicated) in two or more `scripts/*.py` modules. Each script
maintains its own primary CLI + main flow.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
import os
import pickle
import re
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any


# Conventional pretrain vocab filename stems. Used by prepare_data.py +
# upgrade_to_hybrid.py + the README "Released models" bundling docs +
# the test helpers. Centralized here so a future rename only touches one
# spot.
PRETRAIN_VOCAB_STEMS = {
    "atom":   "pretrain_atom_vocab",
    "bond":   "pretrain_bond_vocab",
    "smiles": "pretrain_smiles_vocab",
}


def resolve_kermt_repo() -> Path:
    """Find the runtime checkout independently of the installed skill location.

    An explicit KERMT_REPO takes precedence. In a repository checkout, walking
    up from this helper or the working directory also supports local use.
    """
    explicit = os.environ.get("KERMT_REPO")
    if explicit:
        candidates = [Path(explicit).expanduser().resolve()]
    else:
        candidates = []
        for start in (Path(__file__).resolve().parent, Path.cwd()):
            candidates.extend((start, *start.parents))
    for candidate in candidates:
        if (candidate / "main.py").is_file() and (candidate / "kermt").is_dir():
            return candidate
    raise FileNotFoundError(
        "KERMT checkout not found. Set KERMT_REPO to the checkout containing "
        "main.py and kermt/; the installed skill directory is separate."
    )


def load_json(path: Path, *, name: str) -> dict[str, Any]:
    """Load a JSON file with consistent error messages.

    `name` is a human-readable label for the document (e.g. "prepare_data.json")
    so the error tells the user which schema we expected at that path.
    """
    if not path.is_file():
        raise FileNotFoundError(f"{name} not found at {path}")
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise ValueError(f"{name} at {path} is not valid JSON: {exc}") from exc


def count_vocab_entries(vocab_path: Path) -> int:
    """Return the number of entries in a KERMT vocab file.

    Handles three layouts:
      - JSON with `{stoi: {token: idx}, ...}` (MolVocab.save_vocab default)
      - JSON as a raw `{token: idx}` dict (legacy / hand-edited)
      - Legacy MolVocab / SMILESVocab pickles, read as inert vocabulary state.

    The pickle reader accepts only the known vocabulary containers and their
    Counter/regex metadata. It cannot import arbitrary classes or run reducers
    supplied by the artifact, and it never falls back to an unrestricted loader.
    """
    if vocab_path.suffix == ".json":
        data = json.loads(vocab_path.read_text())
        if isinstance(data, dict) and "stoi" in data:
            return len(data["stoi"])
        if isinstance(data, dict):
            return len(data)
        raise ValueError(f"unsupported JSON vocab shape at {vocab_path}: {type(data).__name__}")

    with vocab_path.open("rb") as f:
        data = _VocabUnpickler(f).load()
    if isinstance(data, _VocabState) and isinstance(data.stoi, dict):
        return len(data.stoi)
    if isinstance(data, (dict, list, tuple)):
        return len(data)
    raise ValueError(f"could not count entries in {vocab_path}")


class _VocabState:
    """Data-only stand-in: counting tokens does not require tokenizer methods."""


class _VocabUnpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str) -> Any:
        if module in {"kermt.data.torchvocab", "grover.data.torchvocab"} and name in {
            "TorchVocab", "MolVocab", "SMILESVocab",
        }:
            return _VocabState
        if (module, name) == ("collections", "Counter"):
            return Counter
        if (module, name) == ("re", "_compile"):
            return re.compile
        raise pickle.UnpicklingError(f"unsupported vocabulary object: {module}.{name}")


def load_checkpoint(path: Path | str) -> dict[str, Any]:
    """Read KERMT tensors and known metadata with PyTorch's restricted loader.

    Saved arguments use argparse.Namespace; finetuned checkpoints also contain
    numeric NumPy scaler arrays. Explicit globals cover those formats, including
    NumPy 1/2 module names, without accepting artifact-selected imports.
    """
    import numpy as np
    import torch

    multiarray = np._core.multiarray if hasattr(np, "_core") else np.core.multiarray
    allowed = [argparse.Namespace, np.ndarray, np.dtype]
    for module in ("numpy.core.multiarray", "numpy._core.multiarray"):
        allowed.extend([
            (multiarray._reconstruct, f"{module}._reconstruct"),
            (multiarray.scalar, f"{module}.scalar"),
        ])
    allowed.extend(type(np.dtype(name)) for name in (
        "bool", "int8", "int16", "int32", "int64", "uint8", "uint16", "uint32", "uint64",
        "float16", "float32", "float64",
    ))
    with torch.serialization.safe_globals(allowed):
        return torch.load(path, map_location="cpu", weights_only=True)


def runner_environment(repo: Path, *, wandb: bool = False) -> dict[str, str]:
    """Forward named runtime settings, keeping unrelated credentials out of jobs.

    W&B credentials/settings are included only for an explicitly enabled W&B
    run. Hugging Face authentication belongs to the separate download helper.
    """
    names = (
        "PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "LC_CTYPE", "TZ",
        "LD_LIBRARY_PATH", "LIBRARY_PATH", "CUDA_HOME", "CUDA_PATH", "PYTHONPATH",
        "PYTHONDONTWRITEBYTECODE", "PYTHONUNBUFFERED", "PYTHONWARNINGS",
        "CUDA_VISIBLE_DEVICES", "CUDA_DEVICE_ORDER", "CUDA_LAUNCH_BLOCKING", "NVIDIA_VISIBLE_DEVICES",
        "NVIDIA_DRIVER_CAPABILITIES", "CUBLAS_WORKSPACE_CONFIG", "OMP_NUM_THREADS",
        "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS", "NUMEXPR_NUM_THREADS",
        "PYTORCH_CUDA_ALLOC_CONF", "PYTORCH_ALLOC_CONF", "PYTORCH_NO_CUDA_MEMORY_CACHING",
        "TORCH_CPP_LOG_LEVEL", "TORCH_DISTRIBUTED_DEBUG", "NCCL_DEBUG", "NCCL_SOCKET_IFNAME",
        "NCCL_IB_DISABLE", "NCCL_P2P_DISABLE", "NCCL_SHM_DISABLE", "GLOO_SOCKET_IFNAME",
        "MASTER_ADDR", "MASTER_PORT",
        "KERMT_REPO", "KERMT_REPO_COMMIT", "KERMT_REPO_DIRTY",
        "SSL_CERT_FILE", "REQUESTS_CA_BUNDLE",
    )
    if wandb:
        names += (
            "WANDB_API_KEY", "WANDB_BASE_URL", "WANDB_MODE", "WANDB_DIR", "WANDB_ENTITY",
            "WANDB_PROJECT", "WANDB_RUN_ID", "WANDB_RESUME", "WANDB_CACHE_DIR",
            "WANDB_CONFIG_DIR", "WANDB_DATA_DIR", "WANDB_DISABLED",
        )
    env = {name: value for name in names if (value := os.environ.get(name)) is not None}
    env["PYTHONPATH"] = os.pathsep.join(filter(None, (str(repo), env.get("PYTHONPATH"))))
    return env


def validate_vocab_file(vocab_path: Path, *, kind: str) -> None:
    """Verify a user-provided vocab file is loadable BEFORE copying it into a
    run directory. Raises ValueError on failure with a clear, user-facing message.

    `kind` is one of {"atom", "bond", "smiles"} — used only in the error message
    so the user knows which file is wrong.
    """
    if not vocab_path.is_file():
        raise FileNotFoundError(f"{kind} vocab file not found: {vocab_path}")
    try:
        n = count_vocab_entries(vocab_path)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(
            f"{kind} vocab file {vocab_path} is not loadable as a KERMT vocab "
            f"({type(exc).__name__}: {exc}). Expected a MolVocab JSON or pickle "
            f"(or a SMILESVocab pickle for the smiles vocab)."
        ) from exc
    if n <= 0:
        raise ValueError(f"{kind} vocab file {vocab_path} contains zero entries")


# ---------------------------------------------------------------------------
# Runner-shared helpers (run.json manifest fields)
# ---------------------------------------------------------------------------

def git_commit_with_env_override(repo: Path) -> tuple[str, bool]:
    """Returns (commit_sha, dirty_tree). Honors `KERMT_REPO_COMMIT` /
    `KERMT_REPO_DIRTY` env vars first — set by `scripts/kermt_container.sh`
    from the host before launching docker (necessary because `git -C /workspace`
    inside the container fails due to bind-mount ownership). Falls back to the
    in-container git probe when the env vars aren't set."""
    env_commit = os.environ.get("KERMT_REPO_COMMIT")
    if env_commit:
        env_dirty = os.environ.get("KERMT_REPO_DIRTY", "false").strip().lower() == "true"
        return env_commit, env_dirty
    try:
        sha = subprocess.run(
            ["git", "-C", str(repo), "rev-parse", "HEAD"],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        diff = subprocess.run(
            ["git", "-C", str(repo), "status", "--porcelain"],
            capture_output=True, text=True, check=True,
        )
        return sha, bool(diff.stdout.strip())
    except Exception:
        return "unknown", False


def docker_image_digest(tag: str) -> str | None:
    """Return the docker image's content-addressable Id (sha256:…) for the given
    tag, or None if docker isn't available / the image isn't local."""
    try:
        r = subprocess.run(
            ["docker", "image", "inspect", tag, "--format", "{{.Id}}"],
            capture_output=True, text=True,
        )
        if r.returncode == 0:
            return r.stdout.strip()
    except FileNotFoundError:
        pass
    return None


def format_cmd_replay(argv: list[str], *, env: dict[str, str] | None = None) -> str:
    """Render a copy-pasteable env-prefix + command for the cmd_replay manifest
   
```

### Core Architecture Module: `skills/deepstream-import-vision-model/scripts/report/render-mermaid-for-pdf.py`
```
#!/usr/bin/env python3

# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Expand ```mermaid ... ``` blocks in a Markdown file into PNG images via mmdc,
producing a new .md suitable for pandoc -> PDF. Does not modify the source file.

Full PDF pipeline (see docs/md-to-pdf.sh and docs/build-pdf.sh):
  1. This script: Mermaid -> PNG under docs/mermaid_pdf/<stem>/, replace blocks with ![...](...) links.
  2. pandoc --from=gfm --listings --lua-filter=pandoc-wrap-tables.lua
     --include-in-header=latex-pdf-wrap.tex --pdf-engine=pdflatex

Use --listings (not --highlight-style): default highlighted Verbatim splits code into
unbreakable tokens and overflows the page. The Lua filter wraps pipe tables and long
path-like inline code; CodeBlock text is normalized for pdflatex (Unicode quotes, etc.).
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path

MERMAID_BLOCK = re.compile(
    r"^```mermaid\s*\n(.*?)^```\s*$",
    re.MULTILINE | re.DOTALL,
)


def render_one(
    mmdc: str,
    body: str,
    out_png: Path,
    width: int,
    scale: float,
    puppeteer_config: Path | None,
) -> None:
    out_png.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_png.with_suffix(".mmd")
    tmp.write_text(body.strip() + "\n", encoding="utf-8")
    cmd = [
        mmdc,
        "-i",
        str(tmp),
        "-o",
        str(out_png),
        "-e",
        "png",
        "-b",
        "white",
        "-w",
        str(width),
        "-s",
        str(scale),
        "-q",
    ]
    if puppeteer_config is not None:
        cmd.extend(["-p", str(puppeteer_config)])
    r = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        shell=False,
        timeout=120,
    )
    tmp.unlink(missing_ok=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr or r.stdout or "mmdc failed\n")
        raise RuntimeError(f"mmdc failed with code {r.returncode}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("source", type=Path, help="Input .md path")
    ap.add_argument("output", type=Path, help="Output .md path")
    ap.add_argument(
        "--img-dir",
        type=Path,
        default=None,
        help="Directory for PNGs (default: next to output, mermaid_pdf/)",
    )
    ap.add_argument("--mmdc", default="mmdc", help="Path to mmdc binary")
    ap.add_argument("--width", type=int, default=1100)
    ap.add_argument("--scale", type=float, default=1.5)
    ap.add_argument(
        "--puppeteer-config",
        type=Path,
        default=None,
        help="JSON for Puppeteer (default: mermaid-puppeteer.json next to this script)",
    )
    args = ap.parse_args()
    # Optional: MERMAID_PDF_WIDTH / MERMAID_PDF_SCALE (e.g. build-pdf.sh for design doc)
    if os.environ.get("MERMAID_PDF_WIDTH"):
        args.width = int(os.environ["MERMAID_PDF_WIDTH"])
    if os.environ.get("MERMAID_PDF_SCALE"):
        args.scale = float(os.environ["MERMAID_PDF_SCALE"])

    script_dir = Path(__file__).resolve().parent

    # Two vetted Puppeteer configs ship alongside this script:
    #   - mermaid-puppeteer.json       : Chromium sandbox enabled. Used for
    #                                    non-root execution (the secure
    #                                    default for laptops, CI runners that
    #                                    run as a non-root user, etc.).
    #   - mermaid-puppeteer-root.json  : --no-sandbox / --disable-setuid-sandbox.
    #                                    Used only when this script runs as
    #                                    uid 0, because Chromium refuses to
    #                                    start with the setuid sandbox enabled
    #                                    when running as root (common inside
    #                                    container build environments).
    # Both configs also pass --disable-dev-shm-usage, which is a stability
    # workaround for small /dev/shm in containers (not a security flag).
    #
    # Selection is driven by the effective uid, never by user input. Any
    # --puppeteer-config that doesn't resolve to one of these two shipped
    # files is rejected. This prevents an attacker-supplied config from
    # introducing extra dangerous flags such as --remote-debugging-port
    # (would expose a control channel to the headless browser) or
    # --load-extension (would let arbitrary JS run in Chromium).
    sandboxed_pc = script_dir / "mermaid-puppeteer.json"
    root_pc = script_dir / "mermaid-puppeteer-root.json"

    is_root = hasattr(os, "geteuid") and os.geteuid() == 0
    default_pc = root_pc if is_root else sandboxed_pc

    allowed = {p.resolve() for p in (sandboxed_pc, root_pc) if p.exists()}
    if args.puppeteer_config is not None:
        requested = args.puppeteer_config.resolve()
        if requested not in allowed:
            sys.stderr.write(
                "Refusing --puppeteer-config: only the shipped configs are "
                f"allowed ({sandboxed_pc.name}, {root_pc.name}). "
                f"Got: {requested}\n"
            )
            sys.exit(2)
        default_pc = args.puppeteer_config

    puppeteer_config = default_pc if default_pc.is_file() else None
    if puppeteer_config is not None:
        uid_str = str(os.geteuid()) if hasattr(os, "geteuid") else "n/a"
        sys.stderr.write(
            f"[render-mermaid-for-pdf] using puppeteer config: "
            f"{puppeteer_config.name} (uid={uid_str})\n"
        )

    # Validate source path exists and is a regular file
    if not args.source.is_file():
        sys.stderr.write(f"ERROR: source markdown not found: {args.source}\n")
        sys.exit(1)

    text = args.source.read_text(encoding="utf-8")
    img_dir = args.img_dir
    if img_dir is None:
        img_dir = args.output.parent / "mermaid_pdf"

    n = 0

    out_parent = args.output.parent.resolve()

    def repl(m: re.Match[str]) -> str:
        nonlocal n
        n += 1
        body = m.group(1)
        png_name = f"diagram_{n:02d}.png"
        out_png = img_dir / png_name
        render_one(
            args.mmdc,
            body,
            out_png,
            args.width,
            args.scale,
            puppeteer_config,
        )
        try:
            rel_to_md = out_png.resolve().relative_to(out_parent)
        except ValueError:
            # --img-dir is outside the output directory; fall back to os.path.relpath
            rel_to_md = Path(os.path.relpath(out_png.resolve(), out_parent))
        return f"\n![Mermaid diagram {n}]({rel_to_md.as_posix()})\n"

    new_text, count = MERMAID_BLOCK.subn(repl, text)
    args.output.write_text(new_text, encoding="utf-8")
    if count:
        print(f"Rendered {count} Mermaid diagram(s) into {img_dir}", file=sys.stderr)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `skills/deepstream-sop/references/utils_reference.py`
```
################################################################################
# SPDX-FileCopyrightText: Copyright (c) 2025-2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
################################################################################

import asyncio
import logging
import os
import sys
import threading
import time
from concurrent.futures import Future
from enum import Enum
from typing import Any, Coroutine, Dict, Optional

from . import ds_logger

logger = ds_logger.get_logger(__name__)

# TimeMeasure should support with statement
# TimeMeasure should support elapsed_time method
# TimeMeasure should support reset method
# TimeMeasure should support get_elapsed_time method


class TimeMeasure:
    def __init__(self, text: str = ""):
        self._text = text
        self._lock = threading.Lock()
        self._execute_done_time = None
        self._1st_execute_done_time = None
        self.reset()

    def __enter__(self):
        """Support for context manager (with statement)"""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Support for context manager (with statement)"""
        return False

    @property
    def elapsed_time(self):
        """Get elapsed time since start or last reset"""
        return time.time() - self._start_time

    @property
    def start_time(self):
        return self._start_time

    def now(self):
        return time.time()

    def reset(self):
        """Reset the timer to current time"""
        self._start_time = time.time()
        self.last_execute_time = self._start_time

    def log_elapsed_time(self, message):
        logger.info(f"{self._text} {message} in {self.elapsed_time:.3f} seconds")

    def update_execute_time(self):
        with self._lock:
            self._execute_done_time = time.time()
            if self._1st_execute_done_time is None:
                self._1st_execute_done_time = self._execute_done_time

    @property
    def total_execute_time(self):
        """Get execution time since start or last reset"""
        with self._lock:
            if self._execute_done_time is None:
                return None
            return self._execute_done_time - self._start_time

    @property
    def first_execute_time(self):
        """Get execution time since start or last reset"""
        with self._lock:
            if self._1st_execute_done_time is None:
                return None
            return self._1st_execute_done_time - self._start_time


class SafeThreadEventLoop:
    def __init__(self):
        self._event_loop = asyncio.new_event_loop()

        def exception_handler(loop, context):
            """Handle exceptions in the event loop."""
            exception = context.get("exception")
            message = context.get("message", "Unhandled exception in event loop")
            logger.error(f"Event loop exception: {message}", exc_info=exception)

        def loop_thread():
            asyncio.set_event_loop(self._event_loop)
            self._event_loop.set_exception_handler(exception_handler)
            self._event_loop.run_forever()

        self._thread = threading.Thread(target=loop_thread, daemon=True)
        self._thread.start()

    def __del__(self):
        self.close()

    def run_coroutine_threadsafe(self, coroutine: Coroutine) -> Future:
        return asyncio.run_coroutine_threadsafe(coroutine, self._event_loop)

    @property
    def event_loop(self):
        return self._event_loop

    def close(self):
        if self._thread is not None and self._thread.is_alive():
            self._event_loop.call_soon_threadsafe(self._event_loop.stop)
            self._thread.join()
            self._event_loop = None
            self._thread = None


def get_media_info_gst(uri_or_file: str, username="", password=""):
    import gi

    gi.require_version("Gst", "1.0")
    gi.require_version("GstPbutils", "1.0")
    from gi.repository import Gst, GstPbutils  # noqa: E402

    Gst.init(None)

    uri_or_file = str(uri_or_file)

    if uri_or_file.startswith("rtsp://") or uri_or_file.startswith("file://"):
        uri = uri_or_file
    else:
        uri = "file://" + os.path.abspath(str(uri_or_file))

    def select_stream(source, idx, caps):
        if "audio" in caps.to_string():
            return False
        return True

    def source_setup(discoverer, source):
        if uri.startswith("rtsp://"):
            source.connect("select-stream", select_stream)
            source.set_property("timeout", 1000000)
            if username and password:
                source.set_property("user-id", username)
                source.set_property("user-pw", password)

    discoverer = GstPbutils.Discoverer()
    discoverer.connect("source-setup", source_setup)

    try:
        file_info = discoverer.discover_uri(uri)
    except gi.repository.GLib.GError as e:
        logger.exception(f"Unsupported file type - {uri} Error:{e}")
        raise e
    for stream_info in file_info.get_stream_list():
        if isinstance(stream_info, GstPbutils.DiscovererVideoInfo):
            video_duration_sec = float(file_info.get_duration()) / 1e9
            video_codec = str(GstPbutils.pb_utils_get_codec_description(stream_info.get_caps()))
            video_width = int(stream_info.get_width())
            video_height = int(stream_info.get_height())
            video_fps = float(stream_info.get_framerate_num() / stream_info.get_framerate_denom())
            is_image = bool(stream_info.is_image())
            return video_duration_sec, video_fps, video_width, video_height
    logger.error(f"uri path: {uri} is not a video file")
    raise Exception(f"uri path: {uri} is not a video file")

```

### Core Architecture Module: `skills/isaac-mission-control-showcase/scripts/run_state.py`
```
#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Durable per-run state for the showcase.

A run writes one manifest early and updates it at every lifecycle transition, so
an interrupted run can still be described and stopped precisely. Cleanup reads
the manifest instead of guessing which containers or processes belong to the
run, which keeps a stop scoped to resources this run recorded.

Motion evidence is recorded when it is observed. A later status command loads
that record rather than resampling a stationary robot and concluding the robot
never moved.
"""

import json
import os
import tempfile
from pathlib import Path

MANIFEST_NAME = "run-manifest.json"
RESULT_NAME = "run-result.json"
MANIFEST_SCHEMA = "mission-control-showcase/run-manifest@1"
RESULT_SCHEMA = "mission-control-showcase/run-result@1"

# Lifecycle states, in order. A run only moves forward.
STATES = (
    "initializing",
    "preflight",
    "starting-cloud",
    "starting-isaac",
    "starting-carter",
    "ready",
    "mission-running",
    "accepted",
    "failed",
    "stopped",
)


def _atomic_write(path: Path, payload: dict) -> None:
    """Write JSON so a reader never observes a partial manifest."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(payload, stream, indent=2, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, path)
        dir_fd = os.open(str(path.parent), os.O_RDONLY)
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    except BaseException:
        Path(tmp).unlink(missing_ok=True)
        raise


def manifest_path(work_dir) -> Path:
    return Path(work_dir) / MANIFEST_NAME


def result_path(work_dir) -> Path:
    return Path(work_dir) / RESULT_NAME


def load(work_dir) -> dict:
    """Return the manifest, or an empty dict when the run has none."""
    path = manifest_path(work_dir)
    if not path.is_file():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def initialize(work_dir, **fields) -> dict:
    """Create the manifest at the start of a run. Never clobbers evidence."""
    existing = load(work_dir)
    manifest = {
        "schema": MANIFEST_SCHEMA,
        "state": "initializing",
        "work_dir": str(work_dir),
        "containers": [],
        "isaac": {},
        "ports": {},
        "evidence": {},
        "motion": {},
        "acceptance": {},
    }
    manifest.update(existing)
    manifest.update({k: v for k, v in fields.items() if v is not None})
    manifest.setdefault("run_id", Path(work_dir).name)
    _atomic_write(manifest_path(work_dir), manifest)
    return manifest


VERDICT_STATES = frozenset({"accepted", "failed"})


def _check_transition(current, requested) -> None:
    """Reject a lifecycle write that would lose or contradict the record.

    STATES is ordered and a run only moves forward. Re-writing the current
    state is allowed so callers stay idempotent. Cleanup is always allowed:
    "stopped" is reachable from any state, because a run is routinely stopped
    after it was accepted or failed. What is refused is overwriting a recorded
    verdict with anything other than cleanup, resuming from "stopped", and
    moving backward through the startup stages, each of which would corrupt
    the record that run-status and cleanup read.
    """
    if requested is None:
        return
    if requested not in STATES:
        raise ValueError(f"unknown lifecycle state: {requested}")
    if current is None or current == requested:
        return
    if current not in STATES:
        raise ValueError(f"unknown recorded lifecycle state: {current}")
    if requested == "stopped":
        return
    if current == "stopped":
        raise ValueError(f"cannot resume a stopped run as {requested!r}")
    if current in VERDICT_STATES:
        raise ValueError(
            f"cannot overwrite recorded verdict {current!r} with {requested!r}"
        )
    if STATES.index(requested) < STATES.index(current):
        raise ValueError(
            f"cannot move lifecycle state backward: {current!r} -> {requested!r}"
        )


def update(work_dir, **fields) -> dict:
    """Merge fields into the manifest atomically, enforcing the lifecycle."""
    manifest = load(work_dir) or {"schema": MANIFEST_SCHEMA, "work_dir": str(work_dir)}
    _check_transition(manifest.get("state"), fields.get("state"))
    for key, value in fields.items():
        if value is None:
            continue
        if isinstance(value, dict) and isinstance(manifest.get(key), dict):
            manifest[key] = {**manifest[key], **value}
        else:
            manifest[key] = value
    _atomic_write(manifest_path(work_dir), manifest)
    return manifest


def set_state(work_dir, state: str) -> dict:
    if state not in STATES:
        raise ValueError(f"unknown lifecycle state: {state}")
    return update(work_dir, state=state)


def add_container(work_dir, name: str) -> dict:
    """Record a container this run owns. Only recorded names may be stopped."""
    manifest = load(work_dir)
    names = list(manifest.get("containers") or [])
    if name and name not in names:
        names.append(name)
    return update(work_dir, containers=names)


def record_motion(work_dir, evidence: dict) -> dict:
    """Persist motion evidence, never downgrading a confirmed observation.

    Motion is monotonic: a robot that moved cannot later have not moved. A
    stationary follow-up sample may raise the maxima but must not clear
    `motion_confirmed` or discard the pose that proved it.
    """
    manifest = load(work_dir)
    prior = manifest.get("motion") or {}
    merged = {**prior, **{k: v for k, v in evidence.items() if v is not None}}
    merged["max_translation_m"] = max(
        float(prior.get("max_translation_m") or 0.0),
        float(evidence.get("max_translation_m") or 0.0),
    )
    merged["max_heading_rad"] = max(
        float(prior.get("max_heading_rad") or 0.0),
        float(evidence.get("max_heading_rad") or 0.0),
    )
    merged["motion_confirmed"] = bool(
        prior.get("motion_confirmed") or evidence.get("motion_confirmed")
    )
    if prior.get("moving_pose") is not None:
        merged["moving_pose"] = prior["moving_pose"]
    return update(work_dir, motion=merged)


def motion_status(work_dir, sampled: dict | None = None) -> dict:
    """Classify motion, separating a quiet sample from an absence of evidence.

    Returns one of:
      confirmed-historical  evidence recorded earlier proves motion
      confirmed-sample      this sample alone proves motion
      none-observed         a sample ran and saw no motion, no prior evidence
      no-evidence           nothing has ever been observed
    """
    stored = (load(work_dir) or {}).get("motion") or {}
    if stored.get("motion_confirmed"):
        return {
            "verdict": "confirmed-historical",
            "motion_confirmed": True,
            "source": "run-manifest",
            "max_translation_m": stored.get("max_translation_m"),
            "max_heading_rad": stored.get("max_heading_rad"),
        }
    if sampled and sampled.get("motion_confirmed"):
        return {
            "verdict": "confirmed-sample",
            "motion_confirmed": True,
            "source": "live-sample",
            "max_translation_m": sampled.get("max_translation_m"),
            "max_heading_rad": sampled.get("max_heading_rad"),
        }
    if sampled is not None:
        return {
            "verdict": "none-observed",
            "motion_confirmed": False,
            "source": "live-sample",
            "detail": "no motion during this sample; no earlier evidence recorded",
        }
    return {
        "verdict": "no-evidence",
        "motion_confirmed": False,
        "source": "none",
        "detail": "no motion evidence has been recorded for this run",
    }


def record_isaac_exit(work_dir, pid, returncode, reason: str) -> dict:
    """Record an observed Isaac Sim exit. Absence of this means 'not observed'."""
    return update(
        work_dir,
        isaac={
            "pid": pid,
            "exit_status": returncode,
            "exit_reason": reason,
            "running": False,
        },
    )


def write_result(work_dir, **fields) -> Path:
    """Emit the machine-readable acceptance artifact for this run."""
    manifest = load(work_dir)
    motion = manifest.get("motion") or {}
    result = {
        "schema": RESULT_SCHEMA,
        "run_id": manifest.get("run_id"),
        "work_dir": str(work_dir),
        "mission_id": manifest.get("mission_id"),
        "started_at": manifest.get("started_at"),
        "state": manifest.get("state"),
        "map": manifest.get("map"),
        "robot": manifest.get("robot"),
        "ports": manifest.get("ports"),
        "ros_domain_id": manifest.get("ros_domain_id"),
        "compose_project": manifest.get("compose_project"),
        "containers": manifest.get("containers"),
        "isaac": manifest.get("isaac"),
        "evidence": manifest.get("evidence"),
        "motion": {
            "initial_pose": motion.get("initial_pose"),
            "moving_pose": motion.get("moving_pose"),
            "final_pose": motion.get("final_pose"),
            "max_translation_m": motion.get("max_translation_m"),
            "max_heading_rad": motion.get("max_heading_rad"),
            "motion_confirmed": bool(motion.get("motion_confirmed")),
        },
        "acceptance": manifest.get("acceptance"),
    }
    result.update({k: v for k, v in fields.items() if v is not None})
    path = result_path(work_dir)
    _at
```

### Core Architecture Module: `skills/nv-generate-ct-rflow/scripts/wrapper_utils.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Local helpers for NV-Generate-CTMR wrapper scripts.

This module deliberately does not import `eval_engine`. Skill scripts must
remain portable in environments where only the upstream tool and Python
dependencies are installed.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path
from typing import Any


def sha256_file(path: Path, chunk: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            buf = f.read(chunk)
            if not buf:
                break
            h.update(buf)
    return h.hexdigest()


def file_sha256_safe(path: Path) -> str:
    if not path.is_file():
        return ""
    try:
        return sha256_file(path)
    except Exception:
        return ""


def git_commit(root: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=str(root),
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if out.returncode == 0:
            return out.stdout.strip()
    except Exception:
        pass
    return ""


def tail(s: str, n_chars: int = 4000) -> str:
    if len(s) <= n_chars:
        return s
    return "..." + s[-n_chars:]


def emit(payload: dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(payload, indent=2))
    sys.stdout.flush()

```

### Core Architecture Module: `skills/nvflare-convert-pytorch/evals/files/state-mismatch-pt/model.py`
```
# Copyright (c) 2026, NVIDIA CORPORATION.  All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import torch.nn as nn


class Classifier(nn.Module):
    def __init__(self, input_size=4, num_classes=2):
        super().__init__()
        self.classifier = nn.Linear(input_size, num_classes)

    def forward(self, features):
        return self.classifier(features)

```

### Core Architecture Module: `skills/nvflare-convert-pytorch/evals/files/state-mismatch-pt/train.py`
```
# Copyright (c) 2026, NVIDIA CORPORATION.  All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from model import Classifier


def build_model():
    return Classifier(input_size=4, num_classes=2)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #255** (2026-06-09): **VSS SKILL cannot download docker Images**
  *Symptoms*: ### Description  I tried to use the SKILL for VSS-deploy. In the skill, it deploy VSS based on v3.2. While for the VSS repo, the main branch only have v3.1 In branch release/v3.2, 2 docker images cannot be downloaded  <img width="1706" height="226" alt="Image" src="https://github.com/user-attachments/assets/2714ec32-b7cf-4930-9c9a-a97ad6e9bc5f" />  ### Reproduction Steps  install the skills, and Ask agent to deploy vss 3d. I use cursor  ### Affected Skill (if applicable)  _No response_  ### Agent Client  Claude Code CLI  ### Environment  Ubuntu 24.04 Cursor + GPT 5.5  ### Logs / Error Output  ```shell <img width="1706" height="226" alt="Image" src="https://github.com/user-attachments/assets/fc1d41c4-75fe-4087-95a5-e88a099d5b5e" /> ```  ### Checklist  - [x] I confirmed this bug is reproducible - [x] I searched existing issues and this is not a duplicate
  **Post-Mortem & Fix Analysis**:
  > Hi @ly01325, thanks for the detailed repro and screenshots.  One thing on routing: this catalog repo (`NVIDIA/skills`) is a downstream mirror that auto-syncs from each source product repo. The `vss-deploy-*` skills live upstream in `NVIDIA-AI-Blueprints/video-search-and-summarization`. The v3.2 reference and the broken image pulls need to be fixed there, and the catalog will pick up the corrected content on the next sync.  Could you re-file this against `NVIDIA-AI-Blueprints/video-search-and-summarization`? Tagging @zac-wang-nv and @hugoverjus for visibility — the VSS team is actively iterating on these skills today, so this report is well-timed.  Closing here since we can't fix it from the catalog. Happy to re-engage once it's filed upstream.

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

### Incident Patch 1: `f7c8a88e` (2026-09-15)
**Commit Message**: fix(metadata): exempt validation_status from the null-regression guard

SkillEvaluator 1.5.x stopped emitting the "- Validation status: `passed`"
line that aggregate_benchmarks.py reads, so every skill that re-signs adds
one null and the guard refuses to write benchmarks.json.

This blocked Generate Skill Metadata on main from 2026-09-15 18:14Z onward:
the sync that landed 10 BioNeMo KERMT/FoundationPose skills plus a re-signed
nemotron-speech took the count 248 -> 259 and failed on every hourly run,
recorded in #569.

Treated as a migrating field rather than derived from another value. The line
carries exactly one value -- all 96 cards that still emit it say `passed` --
so it distinguishes nothing, and those 96 are precisely the cards last signed
before 1.5.4 (the same set still carrying the internal CI image path). The
field therefore reaches zero on its own as those teams re-sign, and inferring
it from the verdict or the Tier 1 row would assert something the original
line never claimed.

Every other field stays guarded; the drift is still reported as a note.

Signed-off-by: Moshe Abramovitch <[REDACTED_EMAIL]>

**File**: `.github/scripts/aggregate_benchmarks.py` (modified, +20/-1)
```diff
@@ -99,7 +99,26 @@
 #
 # Remove this once SkillEvaluator emits the threshold as a real per-run field
 # and the parser reads it again.
-MIGRATING_FIELDS = {"pass_threshold_pct"}
+#
+# ---
+#
+# validation_status is read from the "- Validation status: `passed`" line that
+# v1/v2 cards carry and SkillEvaluator 1.5.x dropped. It is the same shape of
+# change as pass_threshold_pct above, and it fired on 2026-09-15: the sync that
+# landed 10 BioNeMo KERMT/FoundationPose skills plus a re-signed nemotron-speech
+# took validation_status from 248 to 259 nulls and blocked the regeneration on
+# every hourly run until this exemption.
+#
+# Worth recording why this is not worth deriving from another field: the line
+# carries exactly one value. All 96 cards that still emit it say `passed`, and
+# none has ever said anything else, so it distinguishes nothing. Those 96 are
+# also precisely the 96 cards still carrying the internal CI image path, i.e.
+# the set last signed before 1.5.4 — so the field reaches zero on its own as
+# those teams re-sign, and inferring it from the verdict or the Tier 1 row
+# would assert something the original line never claimed.
+#
+# Remove this once no card emits the line and the field is dropped outright.
+MIGRATING_FIELDS = {"pass_threshold_pct", "validation_status"}
 
 
 def parse_uplift(raw):
```

---

### Incident Patch 2: `d61fde1e` (2026-09-11)
**Commit Message**: physical-ai-neural-reconstruction: fix NRE image tag references

The skill pins NRE as `release_26.04` and the troubleshooting table points
at that value, but the GA channel on NGC publishes the tags 26.04.01, 26.04,
26 and latest — `docker pull nvcr.io/nvidia/nre/nre-ga:release_26.04` fails
with "manifest unknown" even for entitled accounts. Clarify that
`release_26.04` is the release name, list the real tags, and extend the
troubleshooting row so the error is diagnosed correctly.

Verified against https://catalog.ngc.nvidia.com/orgs/nvidia/teams/nre/containers/nre-ga/tags
(26.04.01 published 2026-08-07).

Signed-off-by: ivonajambrecic <[REDACTED_EMAIL]>

**File**: `skills/physical-ai-neural-reconstruction/SKILL.md` (modified, +4/-3)
```diff
@@ -38,7 +38,7 @@ metadata:
         folder: nre/
         upstream: nvcr.io/nvidia/nre/nre-ga
         tools_container: nvcr.io/nvidia/nre/nre-tools-ga
-        release_tag: release_26.04
+        release_tag: "26.04"  # NRE release; NGC image tags are 26.04.01 / 26.04 / 26 / latest (not `release_26.04`)
       - name: asset-harvester
         skill_repo: https://github.com/NVIDIA/asset-harvester
         skill_path: skills/asset-harvester/
@@ -187,7 +187,7 @@ product repo.
 |------|-----------------|--------------|
 | `physical-ai-datasets` | `skills/physical-ai-datasets/` | Catalog and download recipes for every NVIDIA Physical AI dataset on Hugging Face (driving, robotics, manipulation, NuRec scenes, benchmarks). |
 | `ncore` | `skills/ncore/` | Converts any sensor recording to NCore V4 (the format NRE needs), upstream release `2026.04`. Also covers writing a new converter. |
-| `nre` | `skills/nre/` | The Neural Reconstruction Engine itself (`nvcr.io/nvidia/nre/nre-ga`, `nvcr.io/nvidia/nre/nre-tools-ga`, NRE `release_26.04`). Trains, performs carline adaptation, renders (locally, via warm `serve-grpc` + thin Python client / `batch_render_rgb`, or to an external simulator), exports meshes / point clouds / depth, edits actors, evaluates quality. |
+| `nre` | `skills/nre/` | The Neural Reconstruction Engine itself (`nvcr.io/nvidia/nre/nre-ga`, `nvcr.io/nvidia/nre/nre-tools-ga`, NRE 26.04 — image tags `26.04.01` / `26.04` / `latest`). Trains, performs carline adaptation, renders (locally, via warm `serve-grpc` + thin Python client / `batch_render_rgb`, or to an external simulator), exports meshes / point clouds / depth, edits actors, evaluates quality. |
 | `asset-harvester` | [`NVIDIA/asset-harvester`](https://github.com/NVIDIA/asset-harvester) → `skills/asset-harvester/` | Open-source Apache-2.0 pipeline (SparseViewDiT + TokenGS) that extracts individual 3D objects from sparse views in a driving clip and saves them as `.ply` Gaussian splats, optionally emitting `metadata.yaml` for the NuRec handoff. |
 | `nurec-fixer` | `skills/nurec-fixer/` | Standalone NVIDIA **DiffusionHarmonizer** workflow — public successor to the older Fixer / Difix3D+ recipes — that cleans rendered frames, harmonizes inserted actors, evaluates PSNR/LPIPS, and optionally fine-tunes the model. |
 
@@ -283,7 +283,8 @@ Companion files (`references/`, `scripts/`, `assets/`) ship inside
   or fixes on previously rendered frames.
 - Do not invent NRE / NCore / DiffusionHarmonizer commands from
   memory. Re-read the upstream sibling skill — versions move fast
-  (NRE `release_26.04` and NCore `2026.04` are the current pins).
+  (NRE 26.04 — pull `nvcr.io/nvidia/nre/nre-ga:26.04.01` or `:26.04`; the release name
+  `release_26.04` is not a valid image tag — and NCore `2026.04` are the current pins).
 - This router does not deploy infrastructure. Route AKS / OSMO /
   NIM Operator setup to
   `physical-ai-infrastructure-setup-and-resilient-scaling`.
```

**File**: `skills/physical-ai-neural-reconstruction/references/maintenance.md` (modified, +2/-1)
```diff
@@ -15,7 +15,8 @@ sibling skills:
    still match each sibling's frontmatter `metadata:` block:
    - `ncore` — <https://github.com/NVIDIA/ncore>, release `2026.04`
    - `nre` — `nvcr.io/nvidia/nre/nre-ga` +
-     `nvcr.io/nvidia/nre/nre-tools-ga`, NRE `release_26.04`
+     `nvcr.io/nvidia/nre/nre-tools-ga`, NRE 26.04 (image tags `26.04.01` / `26.04` / `latest`;
+     the release name `release_26.04` is not an image tag)
    - `asset-harvester` — <https://github.com/NVIDIA/asset-harvester>,
      `nvidia/asset-harvester` on Hugging Face. The **skill itself** now
      ships from that repo too (`skills/asset-harvester/`).
```

**File**: `skills/physical-ai-neural-reconstruction/references/troubleshooting.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ that skill, not here.
 | `test -f .../.agents/skills/SKILL.md` fails | Wrong upstream path — the index lives at `skills/nurec-index/` | Use the `skills/nurec-index/` path (or the `.agents/skills/` symlink alias) |
 | `403`/`401` pulling `nvidia/PhysicalAI-*` from HF | Gated license not accepted, or `HF_TOKEN` unset / wrong scope | Accept the gated license on Hugging Face, then `hf auth login` with a token that has `read` access |
 | `denied: requested access to the resource is denied` from `nvcr.io/nvidia/nre/*` | Missing or expired NGC key | `docker login nvcr.io` with `$oauthtoken` / `${NGC_CLI_API_KEY:-$NGC_API_KEY}`; rotate at `org.ngc.nvidia.com/setup/api-key` if needed |
-| `manifest unknown` / `not found` pulling an NRE image | Pulling the legacy un-suffixed name or a tag that channel never published | Pull the GA names `nvcr.io/nvidia/nre/nre-ga:latest` and `nvcr.io/nvidia/nre/nre-tools-ga:latest` |
+| `manifest unknown` / `not found` pulling an NRE image | Pulling the legacy un-suffixed name, or a release *name* used as a tag (e.g. `:release_26.04` — the GA channel publishes `26.04.01`, `26.04`, `26`, `latest`) | Pull the GA names with a published tag: `nvcr.io/nvidia/nre/nre-ga:26.04.01` (or `:latest`) and `nvcr.io/nvidia/nre/nre-tools-ga:latest`; list tags on the NGC catalog page for `nvidia/nre/nre-ga` |
 | `--renderer` or `export-custom-rig-trajectory` rejected as unknown | Cached image is older than `26.04` / `26.03` | Pull a `26.04+` GA image; `--image-format jpeg` works on every family, so don't fall back to PNG |
 | NRE refuses to load a clip ("not valid NCore V4") | Recording was not converted | Run the `ncore` skill before invoking `nre` |
 | `serve-grpc` cold-start latency dominates a Python loop | One-shot Docker invocation per render | Use the `nre` warm `serve-grpc` + thin Python client (`batch_render_rgb`) recipe; the warm fast path needs a `26.04+` image |
```

#### Recent Merged Pull Requests:
- **PR #663** (2026-10-02): chore(metadata): regenerate metadata.json, skills.sh.json, benchmarks.json, and versions.json (@github-actions[bot])
- **PR #662** (2026-10-02): chore: sync skills (Digital Health) (@github-actions[bot])
- **PR #661** (2026-10-02): chore(metadata): regenerate metadata.json, skills.sh.json, benchmarks.json, and versions.json (@github-actions[bot])
- **PR #660** (2026-10-02): added ambient-healthcare-agent-with-nemotron-voice-agent to component… (@jin-nvidia)
- **PR #659** (2026-10-02): chore: sync skills (NVIDIA Broadcast) (@github-actions[bot])
- **PR #658** (2026-10-02): chore(metadata): regenerate metadata.json, skills.sh.json, benchmarks.json, and versions.json (@github-actions[bot])
- **PR #656** (2026-10-02): register new component (@sahils-collab)
- **PR #655** (closed): add NVIDIA App component to catalog (@sahils-collab)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
