# Forensic Learning Record (Deep Inspection): Toni-SM/skrl

> **Canonical Artifact**: `07_PROJECT_LEARNING/toni-sm-skrl-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Toni-SM/skrl](https://github.com/Toni-SM/skrl))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:21:03.884Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Toni-SM/skrl`
- **Description**: Modular Reinforcement Learning (RL) library (implemented in PyTorch, JAX, and NVIDIA Warp) with support for Gymnasium/Gym, NVIDIA Isaac Lab, MuJoCo Playground and other environments
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1098 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/utils/tensorboard_file_iterator.py`
```
import matplotlib.pyplot as plt

import numpy as np

from skrl.utils import postprocessing


labels = []
rewards = []

# load the TensorBoard files and iterate over them (tag: "Reward / Total reward (mean)")
tensorboard_iterator = postprocessing.TensorboardFileIterator(
    "runs/*/events.out.tfevents.*", tags=["Reward / Total reward (mean)"]
)
for dirname, data in tensorboard_iterator:
    rewards.append(data["Reward / Total reward (mean)"])
    labels.append(dirname)

# convert to numpy arrays and compute mean and std
rewards = np.array(rewards)
mean = np.mean(rewards[:, :, 1], axis=0)
std = np.std(rewards[:, :, 1], axis=0)

# create two subplots (one for each reward and one for the mean)
fig, ax = plt.subplots(1, 2, figsize=(15, 5))

# plot the rewards for each experiment
for reward, label in zip(rewards, labels):
    ax[0].plot(reward[:, 0], reward[:, 1], label=label)

ax[0].set_title("Total reward (for each experiment)")
ax[0].set_xlabel("Timesteps")
ax[0].set_ylabel("Reward")
ax[0].grid(True)
ax[0].legend()

# plot the mean and std (across experiments)
ax[1].fill_between(rewards[0, :, 0], mean - std, mean + std, alpha=0.5, label="std")
ax[1].plot(rewards[0, :, 0], mean, label="mean")

ax[1].set_title("Total reward (mean and std of all experiments)")
ax[1].set_xlabel("Timesteps")
ax[1].set_ylabel("Reward")
ax[1].grid(True)
ax[1].legend()

# show and save the figure
plt.show()
plt.savefig("total_reward.png")

```

### Core Architecture Module: `skrl/utils/__init__.py`
```
from __future__ import annotations

import os
import random
import sys
import time

import numpy as np

from skrl import config, logger


def set_seed(seed: int | None = None, deterministic: bool = False) -> int:
    """Set the seed for the random number generators.

    .. note::

        In distributed runs, the worker/process seed will be incremented (counting from the defined value)
        according to its rank.

    .. warning::

        Due to NumPy's legacy seeding constraint the seed must be between 0 and 2**32 - 1.
        Otherwise a NumPy exception (``ValueError: Seed must be between 0 and 2**32 - 1``) will be raised.

    Modified packages:

    - ``random``
    - ``numpy``
    - ``torch`` (if available)
    - ``skrl`` (PRNG keys: ``config.torch.key``, ``config.jax.key``, ``config.warp.key``)

    Example:

    .. code-block:: python

        # fixed seed
        >>> from skrl.utils import set_seed
        >>> set_seed(42)
        [skrl:INFO] Seed: 42
        42

        # random seed
        >>> from skrl.utils import set_seed
        >>> set_seed()
        [skrl:INFO] Seed: 1776118066
        1776118066

        # enable deterministic. The following environment variables should be established:
        # - CUDA 10.1: CUDA_LAUNCH_BLOCKING=1
        # - CUDA 10.2 or later: CUBLAS_WORKSPACE_CONFIG=:16:8 or CUBLAS_WORKSPACE_CONFIG=:4096:8
        >>> from skrl.utils import set_seed
        >>> set_seed(42, deterministic=True)
        [skrl:INFO] Seed: 42
        [skrl:WARNING] PyTorch/cuDNN deterministic algorithms are enabled. This may affect performance
        42

    :param seed: The seed to set. If ``None``, a random seed will be generated.
    :param deterministic: Whether PyTorch is configured to use deterministic algorithms.
        The following environment variables should be established for CUDA 10.1 (``CUDA_LAUNCH_BLOCKING=1``)
        and for CUDA 10.2 or later (``CUBLAS_WORKSPACE_CONFIG=:16:8`` or ``CUBLAS_WORKSPACE_CONFIG=:4096:8``).
        See PyTorch `Reproducibility <https://pytorch.org/docs/stable/notes/randomness.html>`_ for details.

    :return: Seed.
    """
    # generate a random seed
    if seed is None:
        try:
            seed = int.from_bytes(os.urandom(4), byteorder=sys.byteorder)
        except NotImplementedError:
            seed = int(time.time() * 1000)
        seed %= 2**31  # NumPy's legacy seeding seed must be between 0 and 2**32 - 1
    seed = int(seed)

    # set different seeds in distributed runs
    if config.torch.is_distributed:
        seed += config.torch.rank
    if config.jax.is_distributed:
        seed += config.jax.rank

    logger.info(f"Seed: {seed}")

    # python / numpy
    os.environ["PYTHONHASHSEED"] = str(seed)
    random.seed(seed)
    np.random.seed(seed)

    # torch
    try:
        import torch

        torch.manual_seed(seed)
        torch.cuda.manual_seed(seed)
        torch.cuda.manual_seed_all(seed)
        if deterministic:
            # On CUDA 10.1, set environment variable CUDA_LAUNCH_BLOCKING=1
            # On CUDA 10.2 or later, set environment variable CUBLAS_WORKSPACE_CONFIG=:16:8 or CUBLAS_WORKSPACE_CONFIG=:4096:8
            os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
            torch.backends.cudnn.benchmark = False
            torch.backends.cudnn.deterministic = True
            torch.use_deterministic_algorithms(True)
            logger.warning("PyTorch/cuDNN deterministic algorithms are enabled. This may affect performance")
        else:
            torch.backends.cudnn.benchmark = True
            torch.backends.cudnn.deterministic = False
    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"PyTorch seeding error: {e}")

    # framework PRNG key
    config.torch.key = seed
    config.jax.key = seed
    config.warp.key = seed

    return seed


class ScopedTimer:
    """Scoped timer that can be used to time the execution of a block of code."""

    def __enter__(self):
        self._elapsed_time = None
        self._start_time = time.time()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self._elapsed_time = time.time() - self._start_time

    @property
    def elapsed_time(self) -> float:
        """Elapsed time (in seconds).

        .. note::

            If called within the scope of the context manager, the elapsed time is updated to reflect the time
            spent within the scope. If called outside the context manager scope, the elapsed time is fixed to
            the time at which the context manager was exited.

        :return: Elapsed time in seconds.
        """
        if self._elapsed_time is None:
            return time.time() - self._start_time
        return self._elapsed_time

    @property
    def elapsed_time_ms(self) -> float:
        """Elapsed time (in milliseconds).

        .. note::

            If called within the scope of the context manager, the elapsed time is updated to reflect the time
            spent within the scope. If called outside the context manager scope, the elapsed time is fixed to
            the time at which the context manager was exited.

        :return: Elapsed time in milliseconds.
        """
        if self._elapsed_time is None:
            return (time.time() - self._start_time) * 1000
        return self._elapsed_time * 1000

```

### Core Architecture Module: `skrl/utils/framework/warp/__init__.py`
```
from .math import *
from .ops import *

```

### Core Architecture Module: `skrl/utils/framework/warp/math.py`
```
from __future__ import annotations

from typing import Any

import numpy as np
import warp as wp


__all__ = [
    "scalar_mul",
    "elu",
    "leaky_relu",
    "relu",
    "selu",
    "sigmoid",
    "softplus",
    "softsign",
    "tanh",
    "mean",
    "var",
    "std",
]


def scalar_mul(array: wp.array, scalar: int | float, inplace: bool = False) -> wp.array:
    output = (
        array
        if inplace
        else wp.empty(array.shape, dtype=array.dtype, device=array.device, requires_grad=array.requires_grad)
    )
    wp.launch(_scalar_mul, dim=array.shape, inputs=[output, array, scalar], device=array.device)
    return output


def mean(array: wp.array, *, dtype: type = wp.float32) -> wp.array:
    output = wp.zeros((1,), dtype=dtype, device=array.device, requires_grad=array.requires_grad)
    wp.launch(
        _MEAN[array.ndim],
        dim=array.shape,
        inputs=[array, np.prod(array.shape).item()],
        outputs=[output],
        device=array.device,
    )
    return output


def var(array: wp.array, *, dtype: type = wp.float32, correction: int = 1) -> wp.array:
    output = wp.zeros((1,), dtype=dtype, device=array.device, requires_grad=array.requires_grad)
    wp.launch(
        _VAR[array.ndim],
        dim=array.shape,
        inputs=[array, mean(array, dtype=dtype), np.prod(array.shape).item() - correction],
        outputs=[output],
        device=array.device,
    )
    return output


def std(array: wp.array, *, dtype: type = wp.float32, correction: int = 1) -> wp.array:
    _var = var(array, dtype=dtype, correction=correction)
    output = wp.zeros((1,), dtype=dtype, device=array.device, requires_grad=True) if array.requires_grad else _var
    wp.launch(_std, dim=1, inputs=[_var], outputs=[output], device=array.device)
    return output


def elu(array: wp.array, *, alpha: float = 1.0, inplace: bool = False) -> wp.array:
    output = array if inplace else wp.empty(array.shape, dtype=array.dtype, requires_grad=array.requires_grad)
    wp.launch(_ELU[array.ndim], dim=array.shape, inputs=[array, alpha], outputs=[output], device=array.device)
    return output


def leaky_relu(array: wp.array, *, negative_slope: float = 0.01, inplace: bool = False) -> wp.array:
    output = array if inplace else wp.empty(array.shape, dtype=array.dtype, requires_grad=array.requires_grad)
    wp.launch(
        _LEAKY_RELU[array.ndim], dim=array.shape, inputs=[array, negative_slope], outputs=[output], device=array.device
    )
    return output


def relu(array: wp.array, *, inplace: bool = False) -> wp.array:
    output = array if inplace else wp.empty(array.shape, dtype=array.dtype, requires_grad=array.requires_grad)
    wp.launch(_RELU[array.ndim], dim=array.shape, inputs=[array], outputs=[output], device=array.device)
    return output


def selu(array: wp.array, *, inplace: bool = False) -> wp.array:
    output = array if inplace else wp.empty(array.shape, dtype=array.dtype, requires_grad=array.requires_grad)
    wp.launch(_SELU[array.ndim], dim=array.shape, inputs=[array], outputs=[output], device=array.device)
    return output


def sigmoid(array: wp.array, *, inplace: bool = False) -> wp.array:
    output = array if inplace else wp.empty(array.shape, dtype=array.dtype, requires_grad=array.requires_grad)
    wp.launch(_SIGMOID[array.ndim], dim=array.shape, inputs=[array], outputs=[output], device=array.device)
    return output


def softplus(array: wp.array, *, inplace: bool = False) -> wp.array:
    output = array if inplace else wp.empty(array.shape, dtype=array.dtype, requires_grad=array.requires_grad)
    wp.launch(_SOFTPLUS[array.ndim], dim=array.shape, inputs=[array], outputs=[output], device=array.device)
    return output


def softsign(array: wp.array, *, inplace: bool = False) -> wp.array:
    output = array if inplace else wp.empty(array.shape, dtype=array.dtype, requires_grad=array.requires_grad)
    wp.launch(_SOFTSIGN[array.ndim], dim=array.shape, inputs=[array], outputs=[output], device=array.device)
    return output


def tanh(array: wp.array, *, inplace: bool = False) -> wp.array:
    output = array if inplace else wp.empty(array.shape, dtype=array.dtype, requires_grad=array.requires_grad)
    wp.launch(_TANH[array.ndim], dim=array.shape, inputs=[array], outputs=[output], device=array.device)
    return output


# Warp functions


@wp.func
def _f_elu(x: Any, alpha: Any):
    if x >= type(x)(0.0):
        return x
    else:
        return type(x)(alpha) * (wp.exp(x) - type(x)(1.0))


@wp.func
def _f_leaky_relu(x: Any, negative_slope: Any):
    if x >= type(x)(0.0):
        return x
    else:
        return type(x)(negative_slope) * x


@wp.func
def _f_relu(x: Any):
    return wp.max(x, type(x)(0.0))


@wp.func
def _f_selu(x: Any):
    alpha = type(x)(1.6732632423543772848170429916717)
    scale = type(x)(1.0507009873554804934193349852946)
    return scale * _f_elu(x, alpha)


@wp.func
def _f_sigmoid(x: Any):
    return type(x)(1.0) / (type(x)(1.0) + wp.exp(-x))


@wp.func
def _f_softplus(x: Any):
    return wp.log(type(x)(1.0) + wp.exp(x))


@wp.func
def _f_softsign(x: Any):
    return x / (type(x)(1.0) + wp.abs(x))


@wp.func
def _f_tanh(x: Any):
    return wp.tanh(x)


# Warp kernels


@wp.kernel
def _mean_1d(src: wp.array(ndim=1), n: int, dst: wp.array(ndim=1)):
    i = wp.tid()
    wp.atomic_add(dst, 0, dst.dtype(src[i]) / dst.dtype(n))


@wp.kernel
def _mean_2d(src: wp.array(ndim=2), n: int, dst: wp.array(ndim=1)):
    i, j = wp.tid()
    wp.atomic_add(dst, 0, dst.dtype(src[i, j]) / dst.dtype(n))


@wp.kernel
def _mean_3d(src: wp.array(ndim=3), n: int, dst: wp.array(ndim=1)):
    i, j, k = wp.tid()
    wp.atomic_add(dst, 0, dst.dtype(src[i, j, k]) / dst.dtype(n))


@wp.kernel
def _mean_4d(src: wp.array(ndim=4), n: int, dst: wp.array(ndim=1)):
    i, j, k, l = wp.tid()
    wp.atomic_add(dst, 0, dst.dtype(src[i, j, k, l]) / dst.dtype(n))


_MEAN = [None, _mean_1d, _mean_2d, _mean_3d, _mean_4d]


@wp.kernel
def _var_1d(src: wp.array(ndim=1), mean: wp.array(ndim=1), n: int, dst: wp.array(ndim=1)):
    i = wp.tid()
    wp.atomic_add(dst, 0, wp.pow(dst.dtype(src[i]) - mean[0], 2.0) / dst.dtype(n))


@wp.kernel
def _var_2d(src: wp.array(ndim=2), mean: wp.array(ndim=1), n: int, dst: wp.array(ndim=1)):
    i, j = wp.tid()
    wp.atomic_add(dst, 0, wp.pow(dst.dtype(src[i, j]) - mean[0], 2.0) / dst.dtype(n))


@wp.kernel
def _var_3d(src: wp.array(ndim=3), mean: wp.array(ndim=1), n: int, dst: wp.array(ndim=1)):
    i, j, k = wp.tid()
    wp.atomic_add(dst, 0, wp.pow(dst.dtype(src[i, j, k]) - mean[0], 2.0) / dst.dtype(n))


@wp.kernel
def _var_4d(src: wp.array(ndim=4), mean: wp.array(ndim=1), n: int, dst: wp.array(ndim=1)):
    i, j, k, l = wp.tid()
    wp.atomic_add(dst, 0, wp.pow(dst.dtype(src[i, j, k, l]) - mean[0], 2.0) / dst.dtype(n))


_VAR = [None, _var_1d, _var_2d, _var_3d, _var_4d]


@wp.kernel
def _elu_1d(src: wp.array(ndim=1), alpha: Any, dst: wp.array(ndim=1)):
    i = wp.tid()
    dst[i] = _f_elu(src[i], alpha)


@wp.kernel
def _elu_2d(src: wp.array(ndim=2), alpha: Any, dst: wp.array(ndim=2)):
    i, j = wp.tid()
    dst[i, j] = _f_elu(src[i, j], alpha)


@wp.kernel
def _elu_3d(src: wp.array(ndim=3), alpha: Any, dst: wp.array(ndim=3)):
    i, j, k = wp.tid()
    dst[i, j, k] = _f_elu(src[i, j, k], alpha)


@wp.kernel
def _elu_4d(src: wp.array(ndim=4), alpha: Any, dst: wp.array(ndim=4)):
    i, j, k, l = wp.tid()
    dst[i, j, k, l] = _f_elu(src[i, j, k, l], alpha)


@wp.kernel
def _leaky_relu_1d(src: wp.array(ndim=1), negative_slope: Any, dst: wp.array(ndim=1)):
    i = wp.tid()
    dst[i] = _f_leaky_relu(src[i], negative_slope)


@wp.kernel
def _leaky_relu_2d(src: wp.array(ndim=2), negative_slope: Any, dst: wp.array(ndim=2)):
    i, j = wp.tid()
    dst[i, j] = _f_leaky_relu(src[i, j], negative_slope)


@wp.kernel
def _leaky_relu_3d(src: wp.array(ndim=3), negative_slope: Any, dst: wp.array(ndim=3)):
    i, j, k = wp.tid()
    dst[i, j, k] = _f_leaky_relu(src[i, j, k], negative_slope)


@wp.kernel
def _leaky_relu_4d(src: wp.array(ndim=4), negative_slope: Any, dst: wp.array(ndim=4)):
    i, j, k, l = wp.tid()
    dst[i, j, k, l] = _f_leaky_relu(src[i, j, k, l], negative_slope)


@wp.kernel
def _relu_1d(src: wp.array(ndim=1), dst: wp.array(ndim=1)):
    i = wp.tid()
    dst[i] = _f_relu(src[i])


@wp.kernel
def _relu_2d(src: wp.array(ndim=2), dst: wp.array(ndim=2)):
    i, j = wp.tid()
    dst[i, j] = _f_relu(src[i, j])


@wp.kernel
def _relu_3d(src: wp.array(ndim=3), dst: wp.array(ndim=3)):
    i, j, k = wp.tid()
    dst[i, j, k] = _f_relu(src[i, j, k])


@wp.kernel
def _relu_4d(src: wp.array(ndim=4), dst: wp.array(ndim=4)):
    i, j, k, l = wp.tid()
    dst[i, j, k, l] = _f_relu(src[i, j, k, l])


@wp.kernel
def _selu_1d(src: wp.array(ndim=1), dst: wp.array(ndim=1)):
    i = wp.tid()
    dst[i] = _f_selu(src[i])


@wp.kernel
def _selu_2d(src: wp.array(ndim=2), dst: wp.array(ndim=2)):
    i, j = wp.tid()
    dst[i, j] = _f_selu(src[i, j])


@wp.kernel
def _selu_3d(src: wp.array(ndim=3), dst: wp.array(ndim=3)):
    i, j, k = wp.tid()
    dst[i, j, k] = _f_selu(src[i, j, k])


@wp.kernel
def _selu_4d(src: wp.array(ndim=4), dst: wp.array(ndim=4)):
    i, j, k, l = wp.tid()
    dst[i, j, k, l] = _f_selu(src[i, j, k, l])


@wp.kernel
def _sigmoid_1d(src: wp.array(ndim=1), dst: wp.array(ndim=1)):
    i = wp.tid()
    dst[i] = _f_sigmoid(src[i])


@wp.kernel
def _sigmoid_2d(src: wp.array(ndim=2), dst: wp.array(ndim=2)):
    i, j = wp.tid()
    dst[i, j] = _f_sigmoid(src[i, j])


@wp.kernel
def _sigmoid_3d(src: wp.array(ndim=3), dst: wp.array(ndim=3)):
    i, j, k = wp.tid()
    dst[i, j, k] = _f_sigmoid(src[i, j, k])


@wp.kernel
def _sigmoid_4d(src: wp.array(ndim=4), dst: wp.array(ndim=4)):
    i, j, k, l = wp.tid()
    dst[i, j, k, l] = _f_sigmoid(src[i, j, k, l])


@wp.kernel
def _softplus_1d(src: wp.array(ndim=1), dst: wp.array(ndim=1)):
    i = wp.tid()
    dst[i] = _f_softplus(src[i])


@wp.kernel
def _softplus_2d(src: wp.array(ndim=2), dst: wp.array(ndim=2)):
    i, j = 
```

### Core Architecture Module: `skrl/utils/framework/warp/ops.py`
```
from __future__ import annotations

import warp as wp


__all__ = ["clamp", "concatenate", "convert_to_numpy_in_place", "type_cast"]


@wp.kernel
def _clamp_1d(src: wp.array(ndim=1), min: wp.array(ndim=1), max: wp.array(ndim=1), dst: wp.array(ndim=1)):
    i = wp.tid()
    dst[i] = wp.clamp(src[i], src.dtype(min[i]), src.dtype(max[i]))


@wp.kernel
def _clamp_2d(src: wp.array(ndim=2), min: wp.array(ndim=1), max: wp.array(ndim=1), dst: wp.array(ndim=2)):
    i, j = wp.tid()
    dst[i, j] = wp.clamp(src[i, j], src.dtype(min[j]), src.dtype(max[j]))


@wp.kernel
def _clamp_3d(src: wp.array(ndim=3), min: wp.array(ndim=1), max: wp.array(ndim=1), dst: wp.array(ndim=3)):
    i, j, k = wp.tid()
    dst[i, j, k] = wp.clamp(src[i, j, k], src.dtype(min[k]), src.dtype(max[k]))


@wp.kernel
def _clamp_4d(src: wp.array(ndim=4), min: wp.array(ndim=1), max: wp.array(ndim=1), dst: wp.array(ndim=4)):
    i, j, k, l = wp.tid()
    dst[i, j, k, l] = wp.clamp(src[i, j, k, l], src.dtype(min[l]), src.dtype(max[l]))


_clamp = [None, _clamp_1d, _clamp_2d, _clamp_3d, _clamp_4d]


def clamp(array: wp.array, *, min: wp.array, max: wp.array, inplace: bool = False) -> wp.array:
    output = array if inplace else wp.empty_like(array)
    wp.launch(_clamp[array.ndim], dim=array.shape, inputs=[array, min, max], outputs=[output], device=array.device)
    return output


def concatenate(arrays: list[wp.array], *, axis: int = -1, dtype: type | None = None) -> wp.array:
    reference = arrays[0]
    dtype = reference.dtype if dtype is None else dtype
    shape = (reference.shape[0], sum([array.shape[1] for array in arrays]))
    output = wp.empty(shape, dtype=dtype, device=reference.device, requires_grad=reference.requires_grad)
    index = 0
    for array in arrays:
        next_index = index + array.shape[1]
        wp.copy(output[:, index:next_index], type_cast(array, dtype))
        index = next_index
    return output


def convert_to_numpy_in_place(src):
    if isinstance(src, dict):
        for k, v in src.items():
            if isinstance(v, wp.array):
                src[k] = v.numpy()
            elif isinstance(v, dict):
                convert_to_numpy_in_place(v)
    elif isinstance(src, wp.array):
        return src.numpy()
    return src


def type_cast(array: wp.array, dtype: type) -> wp.array:
    if array.dtype == dtype:
        return array
    output = wp.empty(array.shape, dtype=dtype, device=array.device, requires_grad=array.requires_grad)
    wp.launch(_TYPE_CAST[array.ndim], dim=array.shape, inputs=[array], outputs=[output], device=array.device)
    return output


@wp.kernel(enable_backward=False)
def _type_cast_1d(src: wp.array(ndim=1), dst: wp.array(ndim=1)):
    i = wp.tid()
    dst[i] = dst.dtype(src[i])


@wp.kernel(enable_backward=False)
def _type_cast_2d(src: wp.array(ndim=2), dst: wp.array(ndim=2)):
    i, j = wp.tid()
    dst[i, j] = dst.dtype(src[i, j])


@wp.kernel(enable_backward=False)
def _type_cast_3d(src: wp.array(ndim=3), dst: wp.array(ndim=3)):
    i, j, k = wp.tid()
    dst[i, j, k] = dst.dtype(src[i, j, k])


@wp.kernel(enable_backward=False)
def _type_cast_4d(src: wp.array(ndim=4), dst: wp.array(ndim=4)):
    i, j, k, l = wp.tid()
    dst[i, j, k, l] = dst.dtype(src[i, j, k, l])


_TYPE_CAST = [None, _type_cast_1d, _type_cast_2d, _type_cast_3d, _type_cast_4d]

```

### Core Architecture Module: `skrl/utils/huggingface.py`
```
from __future__ import annotations

from skrl import __version__, logger


def download_model_from_huggingface(repo_id: str, filename: str = "agent.pt") -> str:
    """Download a model from Hugging Face Hub.

    :param repo_id: Hugging Face user or organization name and a repo name separated by a ``/``.
    :param filename: The name of the model file in the repo.

    :return: Local path of file or if networking is off, last version of file cached on disk.

    :raises ImportError: The Hugging Face Hub package (huggingface-hub) is not installed.
    :raises huggingface_hub.utils._errors.HfHubHTTPError: Any HTTP error raised in Hugging Face Hub.

    Example:

    .. code-block:: python

        # download trained agent from the skrl organization (https://huggingface.co/skrl)
        >>> from skrl.utils.huggingface import download_model_from_huggingface
        >>> download_model_from_huggingface("skrl/OmniIsaacGymEnvs-Cartpole-PPO")
        '/home/user/.cache/huggingface/hub/models--skrl--OmniIsaacGymEnvs-Cartpole-PPO/snapshots/892e629903de6bf3ef102ae760406a5dd0f6f873/agent.pt'

        # download model (e.g. "policy.pth") from another user/organization (e.g. "org/ddpg-Pendulum-v1")
        >>> from skrl.utils.huggingface import download_model_from_huggingface
        >>> download_model_from_huggingface("org/ddpg-Pendulum-v1", "policy.pth")
        '/home/user/.cache/huggingface/hub/models--org--ddpg-Pendulum-v1/snapshots/b44ee96f93ff2e296156b002a2ca4646e197ba32/policy.pth'
    """
    logger.info(f"Downloading model from Hugging Face Hub: {repo_id}/{filename}")
    try:
        import huggingface_hub
    except ImportError:
        logger.error("Hugging Face Hub package is not installed. Use 'pip install huggingface-hub' to install it")
        huggingface_hub = None

    if huggingface_hub is None:
        raise ImportError("Hugging Face Hub package is not installed. Use 'pip install huggingface-hub' to install it")

    # download and cache the model from Hugging Face Hub
    return huggingface_hub.hf_hub_download(
        repo_id=repo_id, filename=filename, library_name="skrl", library_version=__version__
    )

```

### Core Architecture Module: `skrl/utils/model_instantiators/jax/__init__.py`
```
from skrl.utils.model_instantiators.jax.categorical import categorical_model
from skrl.utils.model_instantiators.jax.deterministic import deterministic_model
from skrl.utils.model_instantiators.jax.gaussian import gaussian_model
from skrl.utils.model_instantiators.jax.multicategorical import multicategorical_model

```

### Core Architecture Module: `skrl/utils/model_instantiators/jax/categorical.py`
```
from __future__ import annotations

from typing import Any

import textwrap
import gymnasium

import flax.linen as nn  # noqa
import jax
import jax.numpy as jnp  # noqa

from skrl.models.jax import CategoricalMixin  # noqa
from skrl.models.jax import Model  # noqa
from skrl.utils.model_instantiators.jax.common import one_hot_encoding  # noqa
from skrl.utils.model_instantiators.jax.common import generate_containers
from skrl.utils.spaces.jax import unflatten_tensorized_space  # noqa


def categorical_model(
    *,
    observation_space: gymnasium.Space | None = None,
    state_space: gymnasium.Space | None = None,
    action_space: gymnasium.Space | None = None,
    device: str | jax.Device | None = None,
    unnormalized_log_prob: bool = True,
    network: list[dict[str, Any]] = [],
    output: str | list[str] = "",
    return_source: bool = False,
) -> Model | str:
    """Instantiate a :class:`~skrl.models.jax.categorical.CategoricalMixin`-based model.

    :param observation_space: Observation space. The ``num_observations`` property will contain the size of the space.
    :param state_space: State space. The ``num_states`` property will contain the size of the space.
    :param action_space: Action space. The ``num_actions`` property will contain the size of the space.
    :param device: Data allocation and computation device. If not specified, the default device will be used.
    :param unnormalized_log_prob: Flag to indicate how to the model's output will be interpreted.
        If True, the model's output is interpreted as unnormalized log probabilities (it can be any real number),
        otherwise as normalized probabilities (the output must be non-negative, finite and have a non-zero sum).
    :param network: Network definition.
    :param output: Output expression.
    :param return_source: Whether to return the source string containing the model class used to
        instantiate the model rather than the model instance.

    :return: Categorical model instance or definition source (if ``return_source`` is True).
    """
    # parse model definition
    containers, output = generate_containers(network, output, embed_output=True, indent=1)

    # network definitions
    networks = []
    forward: list[str] = []
    for container in containers:
        networks.append(f'self.{container["name"]}_container = {container["sequential"]}')
        forward.append(f'{container["name"]} = self.{container["name"]}_container({container["input"]})')
    # process output
    if output["modules"]:
        networks.append(f'self.output_layer = {output["modules"][0]}')
        forward.append(f'output = self.output_layer({container["name"]})')
    if output["output"]:
        forward.append(f'output = {output["output"]}')
    else:
        forward[-1] = forward[-1].replace(f'{container["name"]} =', "output =", 1)

    # build substitutions and indent content
    networks = textwrap.indent("\n".join(networks), prefix=" " * 8)[8:]
    forward = textwrap.indent("\n".join(forward), prefix=" " * 8)[8:]

    template = f"""class CategoricalModel(CategoricalMixin, Model):
    def __init__(self, observation_space, state_space, action_space, device=None, unnormalized_log_prob=True, role="", **kwargs):
        Model.__init__(
            self,
            observation_space=observation_space,
            state_space=state_space,
            action_space=action_space,
            device=device,
            **kwargs,
        )
        CategoricalMixin.__init__(self, unnormalized_log_prob=unnormalized_log_prob, role=role)

    def setup(self):
        {networks}

    def __call__(self, inputs, role=""):
        observations = unflatten_tensorized_space(self.observation_space, inputs.get("observations"))
        states = unflatten_tensorized_space(self.state_space, inputs.get("states"))
        taken_actions = unflatten_tensorized_space(self.action_space, inputs.get("taken_actions"))
        {forward}
        return output, {{}}
    """
    # return source
    if return_source:
        return template

    # instantiate model
    _locals = {}
    exec(template, globals(), _locals)
    return _locals["CategoricalModel"](
        observation_space=observation_space,
        state_space=state_space,
        action_space=action_space,
        device=device,
        unnormalized_log_prob=unnormalized_log_prob,
    )

```

### Core Architecture Module: `skrl/utils/model_instantiators/jax/common.py`
```
from __future__ import annotations

from typing import Any

import ast
from gymnasium import spaces

import jax
import jax.nn as jnn
import jax.numpy as jnp


def one_hot_encoding(space: spaces.Space, x: jax.Array) -> jax.Array:
    """One-hot encode a tensorized Discrete or MultiDiscrete space.

    :param space: Gymnasium space.
    :param x: Tensorized sample/value of the given space.

    :return: One-hot encoded tensor.
    """
    if isinstance(space, spaces.Discrete):
        return jnn.one_hot(x[:, 0], space.n, dtype=jnp.float32)
    elif isinstance(space, spaces.MultiDiscrete):
        return jnp.concatenate(
            [jnn.one_hot(x[:, i], space.nvec[i], dtype=jnp.float32) for i in range(space.nvec.shape[0])],
            axis=1,
        )
    else:
        raise ValueError(f"Unsupported space ({space})")


def _get_activation_function(activation: str | None) -> str | None:
    """Get the activation function.

    Supported activation functions:

    - "elu"
    - "leaky_relu"
    - "relu"
    - "selu"
    - "sigmoid"
    - "softmax"
    - "softplus"
    - "softsign"
    - "tanh"

    :param activation: Activation function name.

    :return: Activation function or ``None`` if the activation is not supported.
    """
    activations = {
        "elu": "nn.elu",
        "leaky_relu": "nn.leaky_relu",
        "relu": "nn.relu",
        "selu": "nn.selu",
        "sigmoid": "nn.sigmoid",
        "softmax": "nn.softmax",
        "softplus": "nn.softplus",
        "softsign": "nn.soft_sign",
        "tanh": "nn.tanh",
    }
    return activations.get(activation.lower() if type(activation) is str else activation, None)


def _parse_input(source: str) -> str:
    """Parse a network input expression by replacing substitutions and applying operations.

    :param source: Input expression.

    :return: Parsed network input.
    """

    class NodeTransformer(ast.NodeTransformer):
        def visit_Call(self, node: ast.Call):
            if isinstance(node.func, ast.Name):
                # operation: concatenate
                if node.func.id == "concatenate":
                    node.func = ast.Attribute(value=ast.Name("jnp"), attr="concatenate")
                    node.keywords = [ast.keyword(arg="axis", value=ast.Constant(value=-1))]
                # operation: permute
                elif node.func.id == "permute":
                    node.func = ast.Attribute(value=ast.Name("jnp"), attr="permute_dims")
            return node

    # apply operations by modifying the source syntax grammar
    tree = ast.parse(source)
    NodeTransformer().visit(tree)
    source = ast.unparse(tree)
    # enum substitutions
    source = source.replace("OBSERVATION_SPACE", "self.observation_space")
    source = source.replace("STATE_SPACE", "self.state_space")
    source = source.replace("ACTION_SPACE", "self.action_space")
    source = source.replace("OBSERVATIONS", "observations")
    source = source.replace("STATES", "states")
    source = source.replace("ACTIONS", "taken_actions")
    return source


def _parse_output(source: str | list[str]) -> tuple[str | list[str], list[str], int]:
    """Parse the network output expression by replacing substitutions and applying operations.

    :param source: Output expression.

    :return: Tuple with the parsed network output, generated modules and output size/shape.
    """

    class NodeTransformer(ast.NodeTransformer):
        def visit_Call(self, node: ast.Call):
            if isinstance(node.func, ast.Name):
                # operation: concatenate
                if node.func.id == "concatenate":
                    node.func = ast.Attribute(value=ast.Name("jnp"), attr="concatenate")
                    node.keywords = [ast.keyword(arg="axis", value=ast.Constant(value=-1))]
                else:
                    # activation functions
                    activation = _get_activation_function(node.func.id)
                    if activation:
                        node.func = ast.Attribute(value=ast.Name("nn"), attr=activation.replace("nn.", ""))
            return node

    size = get_num_units("ACTIONS")
    modules = []
    if type(source) is str:
        # enum substitutions
        token = "ACTIONS" if "ACTIONS" in source else None
        token = "ONE" if "ONE" in source else token
        if token:
            size = get_num_units(token)
            modules = [f"nn.Dense(features={get_num_units(token)})"]
            source = source.replace(token, "PLACEHOLDER")
        # apply operations by modifying the source syntax grammar
        tree = ast.parse(source)
        NodeTransformer().visit(tree)
        source = ast.unparse(tree)
    elif type(source) in [list, tuple]:
        raise NotImplementedError
    else:
        raise ValueError(f"Invalid or unsupported network output definition: {source}")
    return source, modules, size


def _generate_modules(layers: list[str], activations: list[str] | str) -> list[str]:
    """Generate network modules.

    :param layers: Layer definitions.
    :param activations: Activation function definitions applied after each layer (except ``flatten`` layers).
        If a single activation function is specified (str or list), it will be applied after each layer.

    :return: A list of generated modules.
    """
    # expand activations
    if type(activations) is str:
        activations = [activations] * len(layers)
    elif type(activations) is list:
        if not len(activations):
            activations = [""] * len(layers)
        elif len(activations) == 1:
            activations = activations * len(layers)
        elif len(activations) == len(layers):
            pass
        else:
            # TODO: check the length of activations
            raise NotImplementedError(f"Activations length ({len(activations)}) don't match layers ({len(layers)})")

    modules = []
    for layer, activation in zip(layers, activations):
        # single-values cases
        # linear (as number)
        if type(layer) in [int, float]:  # TODO: support token, e.g.: - ACTIONS??
            layer = {"linear": layer}
        # flatten (as string)
        elif type(layer) is str:
            layer = {"flatten": {}}

        # parse layer
        if type(layer) is dict:
            layer_type = next(iter(layer.keys())).lower()
            # linear
            if layer_type == "linear":
                cls = "nn.Dense"
                kwargs = layer[layer_type]
                if type(kwargs) in [int, float]:
                    kwargs = {"features": int(kwargs)}
                elif type(kwargs) is list:
                    kwargs = {k: v for k, v in zip(["features", "use_bias"][: len(kwargs)], kwargs)}
                elif type(kwargs) is dict:
                    if "in_features" in kwargs:
                        del kwargs["in_features"]
                    mapping = {
                        "out_features": "features",
                        "bias": "use_bias",
                    }
                    kwargs = {mapping.get(k, k): v for k, v in kwargs.items()}
                    kwargs["features"] = get_num_units(kwargs["features"])
                else:
                    raise ValueError(f"Invalid or unsupported 'linear' layer definition: {kwargs}")
            # convolutional 2D
            elif layer_type == "conv2d":
                cls = "nn.Conv"
                kwargs = layer[layer_type]
                if type(kwargs) is list:
                    kwargs = {
                        k: v
                        for k, v in zip(
                            ["features", "kernel_size", "strides", "padding", "use_bias"][: len(kwargs)], kwargs
                        )
                    }
                elif type(kwargs) is dict:
                    if "in_channels" in kwargs:
                        del kwargs["in_channels"]
                    mapping = {
                        "out_channels": "features",
                        "stride": "strides",
                        "bias": "use_bias",
                    }
                    kwargs = {mapping.get(k, k): f'"{v.upper()}"' if type(v) is str else v for k, v in kwargs.items()}
                else:
                    raise ValueError(f"Invalid or unsupported 'conv2d' layer definition: {kwargs}")
            # flatten
            elif layer_type == "flatten":
                cls = "lambda x: jnp.reshape(x, (x.shape[0], -1))"
                kwargs = None
                activation = ""  # don't add activation after flatten layer
            else:
                raise ValueError(f"Invalid or unsupported layer: {layer_type}")
        else:
            raise ValueError(f"Invalid or unsupported layer definition: {layer}")
        # define layer and activation function
        if kwargs is None:
            modules.append(f"{cls}")
        else:
            kwargs = ", ".join([f"{k}={v}" for k, v in kwargs.items()])
            modules.append(f"{cls}({kwargs})")
        activation = _get_activation_function(activation)
        if activation:
            modules.append(activation)
    return modules


def get_num_units(token: str | Any) -> str | Any:
    """Get the number of units/features a token represents.

    :param token: Token.

    :return: Number of units/features a token represents. If the token is unknown, its value will be returned as it.
    """
    num_units = {
        "ONE": "1",
        "NUM_OBSERVATIONS": "self.num_observations",
        "NUM_STATES": "self.num_states",
        "NUM_ACTIONS": "self.num_actions",
        "OBSERVATIONS": "self.num_observations",
        "STATES": "self.num_states",
        "ACTIONS": "self.num_actions",
    }
    token_as_str = str(token)
    if token_as_str in num_units:
        return num_units[token_as_str]
    return token


def generate_containers(
    network: list[dict[str, Any]], output: str | list[str], embed_output: bool = True, indent: int = -1
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Generate ne
```

### Core Architecture Module: `skrl/utils/model_instantiators/jax/deterministic.py`
```
from __future__ import annotations

from typing import Any

import textwrap
import gymnasium

import flax.linen as nn  # noqa
import jax
import jax.numpy as jnp  # noqa

from skrl.models.jax import DeterministicMixin  # noqa
from skrl.models.jax import Model  # noqa
from skrl.utils.model_instantiators.jax.common import one_hot_encoding  # noqa
from skrl.utils.model_instantiators.jax.common import generate_containers
from skrl.utils.spaces.jax import unflatten_tensorized_space  # noqa


def deterministic_model(
    *,
    observation_space: gymnasium.Space | None = None,
    state_space: gymnasium.Space | None = None,
    action_space: gymnasium.Space | None = None,
    device: str | jax.Device | None = None,
    clip_actions: bool = False,
    network: list[dict[str, Any]] = [],
    output: str | list[str] = "",
    return_source: bool = False,
) -> Model | str:
    """Instantiate a :class:`~skrl.models.jax.deterministic.DeterministicMixin`-based model.

    :param observation_space: Observation space. The ``num_observations`` property will contain the size of the space.
    :param state_space: State space. The ``num_states`` property will contain the size of the space.
    :param action_space: Action space. The ``num_actions`` property will contain the size of the space.
    :param device: Data allocation and computation device. If not specified, the default device will be used.
    :param clip_actions: Flag to indicate whether the actions should be clipped to the action space.
    :param network: Network definition.
    :param output: Output expression.
    :param return_source: Whether to return the source string containing the model class used to
        instantiate the model rather than the model instance.

    :return: Deterministic model instance or definition source (if ``return_source`` is True).
    """
    # parse model definition
    containers, output = generate_containers(network, output, embed_output=True, indent=1)

    # network definitions
    networks = []
    forward: list[str] = []
    for container in containers:
        networks.append(f'self.{container["name"]}_container = {container["sequential"]}')
        forward.append(f'{container["name"]} = self.{container["name"]}_container({container["input"]})')
    # process output
    if output["modules"]:
        networks.append(f'self.output_layer = {output["modules"][0]}')
        forward.append(f'output = self.output_layer({container["name"]})')
    if output["output"]:
        forward.append(f'output = {output["output"]}')
    else:
        forward[-1] = forward[-1].replace(f'{container["name"]} =', "output =", 1)

    # build substitutions and indent content
    networks = textwrap.indent("\n".join(networks), prefix=" " * 8)[8:]
    forward = textwrap.indent("\n".join(forward), prefix=" " * 8)[8:]

    template = f"""class DeterministicModel(DeterministicMixin, Model):
    def __init__(self, observation_space, state_space, action_space, device=None, clip_actions=False, role="", **kwargs):
        Model.__init__(
            self,
            observation_space=observation_space,
            state_space=state_space,
            action_space=action_space,
            device=device,
            **kwargs,
        )
        DeterministicMixin.__init__(self, clip_actions=clip_actions, role=role)

    def setup(self):
        {networks}

    def __call__(self, inputs, role=""):
        observations = unflatten_tensorized_space(self.observation_space, inputs.get("observations"))
        states = unflatten_tensorized_space(self.state_space, inputs.get("states"))
        taken_actions = unflatten_tensorized_space(self.action_space, inputs.get("taken_actions"))
        {forward}
        return output, {{}}
    """
    # return source
    if return_source:
        return template

    # instantiate model
    _locals = {}
    exec(template, globals(), _locals)
    return _locals["DeterministicModel"](
        observation_space=observation_space,
        state_space=state_space,
        action_space=action_space,
        device=device,
        clip_actions=clip_actions,
    )

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #435** (2026-05-03): **Performance difference of skrl compared to sb3 and rsl_rl**
  *Symptoms*:  ### Discussed in https://github.com/Toni-SM/skrl/discussions/416  <div type='discussions-op-text'>  <sup>Originally posted by **glmzsemanur** February 25, 2026</sup> Hi everyone,  I am relatively new to Isaac Lab and skrl, so I apologize if I've missed something fundamental. I am currently working on a robotics project at my university and have encountered a consistent performance divergence based on the hardware used.  Environment:  Task: Isaac-Velocity-Flat-Unitree-A1-v0  Library: skrl (PPO)  Hardware 1: RTX 5090 (Lab machine) - Works perfectly (Walks). Hardware 2: RTX 5070 Ti (Personal machine) - Converges to "standing still."  OS: Ubuntu 22.04 Isaac Sim 5.1.0  The Issue: Using identical configurations (the original task -no modifications), seeds, and environment counts (4096), the agent on the RTX 5090 learns a stable gait. However, on my RTX 5070 Ti, the agent consistently falls into a local minimum where it prefers to stand still. I checked the training process and the robot is able to take actions, but prefers not to as training progresses.  Key Observations:  Cross-Library Check: On the same 5070 Ti machine, rsl_rl and SB3 both successfully train walking policies for this task. (both with isaaclab_tasks and with robotlab_tasks) Inference Check: I loaded the weights trained on the 5090 onto the 5070 Ti machine, and the robot walks perfectly.  Attempted Fixes: I have tried adjusting hyperparameters, but the behavior persists on the 5070 Ti. I hav

- **Issue #432** (2026-09-10): **Model Instantiator bugged if "concatenate" in output**
  *Symptoms*: ### Description  The model instantiators are bugged if you try to use "concatenate" in the output definition of a model. The documentation clearly states that this should be possible for inputs and outputs.   Below is an example for a failing instatiator.  ``` source = gaussian_model(         observation_space=obs_space,         action_space=act_space,         network=network,         output="concatenate([head_a, head_b])",         return_source=True,     ) ``` Minimal reproduction of the bug in skrl's model instantiator output parser:  [skrl_concat_output_bug.py](https://github.com/user-attachments/files/27163414/skrl_concat_output_bug.py)  Root cause: In `_parse_output` (common.py), the `visit_Call` method of the NodeTransformer replaces `node.func` with an `ast.Attribute` node when it encounters `concatenate`, but then falls through to the activation function check which assumes `node.func` is still an `ast.Name` (i.e. has `.id`).  Compare with `_parse_input`, which handles `concatenate` correctly by returning early before any activation logic.  **Fix**: Add `else` to the activation check only runs when the concatenate branch did not fire.   Error Log: ``` File "/home/jules/thesis/scripts/skrl/train.py", line 273, in main     runner = Runner(env, agent_cfg)              ^^^^^^^^^^^^^^^^^^^^^^   File "/home/jules/IsaacLab/lab_env/lib/python3.11/site-packages/skrl/utils/runner/torch/runner.py", line 33, in __init__     self._models = self._generate_models(self._env, copy.dee

- **Issue #425** (2026-09-11): **Critic grad in the JAX implementation of the SAC algorithm**
  *Symptoms*:  ### Discussed in https://github.com/Toni-SM/skrl/discussions/424  <div type='discussions-op-text'>  <sup>Originally posted by **MorningFrog** April  9, 2026</sup> In the JAX implementation of the SAC algorithm (`skrl/agents/jax/sac/sac.py`), the `_update_critic` function returns only a single `grad`, which is then used to update both critic networks.  Source code:  ```python # https://jax.readthedocs.io/en/latest/faq.html#strategy-1-jit-compiled-helper-function @functools.partial(jax.jit, static_argnames=("critic_1_act", "critic_2_act")) def _update_critic(     critic_1_act,     critic_1_state_dict,     critic_2_act,     critic_2_state_dict,     target_q1_values: jax.Array,     target_q2_values: jax.Array,     entropy_coefficient,     next_log_prob,     inputs: dict[str, jax.Array],     sampled_rewards: jax.Array,     sampled_terminated: jax.Array,     discount_factor: float, ):     # compute target values     target_q_values = jnp.minimum(target_q1_values, target_q2_values) - entropy_coefficient * next_log_prob     target_values = sampled_rewards + discount_factor * jnp.logical_not(sampled_terminated) * target_q_values      # compute critic loss     def _critic_loss(params, critic_act, role):         critic_values, _ = critic_act(inputs, role=role, params=params)         critic_loss = ((critic_values - target_values) ** 2).mean()         return critic_loss, critic_values      (critic_1_loss, critic_1_values), grad = jax.value_and_grad(_critic_

- **Issue #373** (2026-04-10): **Recursion error due to Trainer string method**
  *Symptoms*: ### Description  When printing the trainer, for instance `print(runner.trainer)`, there is a recursion error: ```     string = f"Trainer: {self}"              ^^^^^^^^^^^^^^^^^^   [Previous line repeated 326 more times] RecursionError: maximum recursion depth exceeded while getting the str of an object ```  This is due to the fact that the __str__ method refers to itself ```     def __str__(self) -> str:         string = f"Trainer: {self}" ```  ### What skrl version are you using?  1.4.3  ### What ML framework/library version are you using?  Pytorch  ### Additional system information  Ubuntu 22
  **Post-Mortem & Fix Analysis**:
  > Fixed with #374 
  > seeing a recursion error when printing the trainer object (e.g., print(runner.trainer)) in skrl 1.4.3. The issue appears to come from the __str__ implementation referencing self inside the f-string: def __str__(self) -> str:     string = f"Trainer: {self}"This causes __str__ to call itself recursively until the recursion limit is hit. Referencing specific attributes or avoiding {self} inside __str__ should resolve it. The issue reproduces consistently on Ubuntu 22 with PyTorch. 

- **Issue #370** (2026-05-09): **Min total reward logging to tensorboard is consistently 0**
  *Symptoms*: ### Description  I am developing a PPO agent in isaac lab. The robot is meant to follow some waypoints and it gets a +0.1 reward every time it gets to one. I have placed a waypoint at the robot spawn position and, by printing, I know for a fact that the min total reward for each episode is 0.1. On tensorboard this value is constantly 0 tho. I tested with training with just one environment and it correctly shows 0.1 but as soon as I move to 2 envs it gets back to 0. I suspect there is something wrong with the resetting of the buffer for the total reward but I could be wrong  ### What skrl version are you using?  1.4.3  ### What ML framework/library version are you using?  IsaacLab  ### Additional system information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi @PaoloGinefra   Mmmm, could you share a link to your task or a way to repro it?
  > Hi @Toni-SM This is linked to wrong indexing ``self._cumulative_timesteps[finished_episodes]`` when ``as_tuple=False`` is used. Related issue gives more details, https://github.com/Toni-SM/skrl/issues/289#issuecomment-4411715073 https://github.com/Toni-SM/skrl/blob/04e43b5e60d2aa9460d247fccaa46178b141a5e0/skrl/agents/torch/base.py#L367-L376  To reproduce run examples, ````python python3 examples/gymnasium/torch_gymnasium_cartpole_dqn.py --num_envs 500 --seed 42 --headless  tensorboard --logdir ./runs/ ```` Open tensorboard, see ``Episode / Total timesteps (min)`` remains always at 0 or a very low value.

- **Issue #353** (2025-08-14): **Large discrepancies between observation sent to gymnasium and  the one received by the model. skrl 1.4.3**
  *Symptoms*: ### Description  Hello,   I observe large discrepancies between the observation sent to the gym interface and the one received by the model.   Please find the code of my model and the result   ```     def compute(self, inputs, role):         if role == "policy":             states = inputs["states"]             space = self.tensor_to_space(states, self.observation_space)             fmap = space["fmap"]             vis = fmap.permute(0, 3, 1, 2)             #print("fmap: " + str(fmap))             print("tool model: " + str(space["tool"]))             tool_obs = space["tool"]             vis.to(self.device)             tool_obs.to(self.device)             ft = self.feature_extractor(vis)             self._shared_output = torch.cat([ft,tool_obs.view(states.shape[0], -1)], dim = -1)             output = torch.tanh(self.policy_layer(self._shared_output))             return output, self.log_std_parameter, {}          elif role == "value":             if self._shared_output == None:                  states = inputs["states"]                 space = self.tensor_to_space(states, self.observation_space)                 fmap = space["fmap"]                 vis = fmap.permute(0, 3, 1, 2)                 tool_obs = space["tool"]                 vis.to(self.device)                 tool_obs.to(self.device)                 ft = self.feature_extractor(vis)                 shared_output = torch.cat([ft,tool_obs.view(states.shape[0], -1)], dim = -1)             else:                  shared_o
  **Post-Mortem & Fix Analysis**:
  > Please ignore this issue, this was cause by the standard running scaler preprocessor 

- **Issue #331** (2026-05-09): **PPO Performance Degredation from 1.4.0 to 1.4.3**
  *Symptoms*: ### Description  Hey there!  Just wanted to report on something I am observing, and perhaps gain some understanding as to why this is happening.  I am using SKRL with IsaacLab:  - previously I was using SKRL 1.4.0 and an older version of IsaacLab (1.4) - now I am using SKRL 1.4.3 with the latest version of IsaacLab  I am noticing a large difference in the performance of PPO on a certain task. I would love some insight into if this difference comes from the SKRL update, or not.  The first image (light blue line) shows the results of PPO on the task `Isaac-Ant-v0` using my previous configuration (SKRL 1.4.0)  The second image (dark blue line) shows the results of PPO on the task `Isaac-Ant-v0` using my current configuration (SKRL 1.4.3)  ![Image](https://github.com/user-attachments/assets/93354c80-f21c-4a72-b600-f99888f46cca)  ![Image](https://github.com/user-attachments/assets/b8ea8392-51f7-43a8-bd86-1606ffd96d9f)  Looking forward to discussing this, Thanks!!!  P.S. If this is not an issue but rather something else, please let me know and happy to change this. 
  **Post-Mortem & Fix Analysis**:
  > After the different versions are updated, the default parameters may change, and the logic of some switches may also be altered. You can check the default parameter settings or some switch logic. For example, in version 1.4.3： ``` if self._clip_predicted_values:     predicted_values = sampled_values + torch.clip(         predicted_values - sampled_values, min=-self._value_clip, max=self._value_clip     ) ``` But in version 2.0.0: ``` if self.cfg.value_clip > 0:     predicted_values = sampled_values + torch.clip(         predicted_values - sampled_values, min=-self.cfg.value_clip, max=self.cfg.value_clip     ) ``` You can check if any of these settings have been changed. It might be helpful. However, it is worth noting that after upgrading the version from 1.4.3 to 2.0.0, I also noticed a decrease in performance. And I have checked the default settings, but couldn't find any issue causing this problem.
  > Hi @fl1ps1de5 and @Wangzai-hub   https://github.com/Toni-SM/skrl/pull/434 improves the robustness and learning capabilities of on-policy algorithms:   - Sample data from memory using per-epoch mini-batch shuffling   - Sum-reduce policy entropy to prevent collapse into near-deterministic stand still behavior

- **Issue #311** (2026-05-09): **Sequential memory sampling**
  *Symptoms*: ### Description  Hi,  In the PPO implementation, the update uses minibatches from `sample_all` function of `Memory` which are sequentially sampled e.g. [1,2,3,4,5,6......].  https://github.com/Toni-SM/skrl/blob/main/skrl/memories/torch/base.py#L327C9-L327C19  Was this intentional? I thought the sampling should be random, to avoid temporal correlations in the data e.g. [point 6](https://iclr-blog-track.github.io/2022/03/25/ppo-implementation-details/)  I'm seeing minor improvements in my particular environment, but have not run conclusive multiseed tests. ``` if random:      indexes = RandomSampler(indexes)  batches = BatchSampler(indexes, batch_size=len(indexes) // mini_batches, drop_last=True) ``` Just a heads up!  ### What skrl version are you using?  ---  ### What ML framework/library version are you using?  _No response_  ### Additional system information  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi, quick question regarding PPO minibatch sampling. In the current implementation, sample_all() returns sequential indices which are then passed directly to BatchSampler, resulting in temporally ordered minibatches (e.g., [1,2,3,4,...]).  Was this intentional? I was expecting the indices to be shuffled prior to minibatching to reduce temporal correlations, as is common in many PPO implementations. I experimented with wrapping the indices in a RandomSampler before batching and observed minor improvements in my environment (not yet validated with multi-seed runs).  Just wanted to flag this and ask if the sequential sampling is by design or if randomization is expected to be handled elsewhere. 
  > Hi @elle-miller and @MillingsMethod   https://github.com/Toni-SM/skrl/pull/434 improves the robustness and learning capabilities of on-policy algorithms:   - Sample data from memory using per-epoch mini-batch shuffling   - Sum-reduce policy entropy to prevent collapse into near-deterministic stand still behavior
  > Hey @Toni-SM, thanks for incorporating the sample fix & letting me know about the sum-reduce entropy... the stand-still behaviour was a long-time quirk I wondered about, great to have the fix 😄 

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

### Incident Patch 1: `2ec6ee16` (2026-10-01)
**Commit Message**: Fix Warp-implementation bugs (#462)

**File**: `.github/ISSUE_TEMPLATE/bug_report.yaml` (modified, +2/-1)
```diff
@@ -31,6 +31,7 @@ body:
     description: The skrl version can be obtained with the command `pip show skrl`.
     options:
       - ---
+      - 2.1.0
       - 2.0.0
       - 1.4.3
       - 1.4.2
@@ -54,7 +55,7 @@ body:
       Versions can be retrieved using the following commands:
       * PyTorch: `pip show torch`
       * JAX: `pip show jax jaxlib flax optax`
-      * Warp: `pip show warp-lang`
+      * Warp: `pip show warp-lang warp-nn`
     placeholder: PyTorch, JAX/Flax/Optax, Warp versions
 - type: input
   attributes:
```

**File**: `.github/workflows/tests-warp.yml` (modified, +3/-3)
```diff
@@ -60,7 +60,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet "numpy<2.0" warp-lang==1.12
+        python -m pip install --quiet "numpy<2.0" warp-lang==1.15 warp-nn==0.4
         python -m pip install --quiet -e .[warp]
         python -m pip install --quiet -e .[tests]
         python -m pip list
@@ -111,7 +111,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet "numpy<2.0" warp-lang==1.12
+        python -m pip install --quiet "numpy<2.0" warp-lang==1.15 warp-nn==0.4
         python -m pip install --quiet -e .[warp]
         python -m pip install --quiet -e .[tests]
         python -m pip list
@@ -157,7 +157,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet "numpy<2.0" warp-lang==1.12
+        python -m pip install --quiet "numpy<2.0" warp-lang==1.15 warp-nn==0.4
         python -m pip install --quiet -e .[warp]
         python -m pip install --quiet -e .[tests]
         python -m pip list
```

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -2,6 +2,13 @@
 
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 
+## [Unreleased]
+### Fixed
+- Fix Warp PPO agent's update not preprocessing sampled observations/states after the first learning epoch
+- Fix Warp Gaussian model sampling actions with twice the standard deviation
+- Fix Warp Gaussian model's wrong (and non-deterministic) log standard deviation gradients
+- Fix Warp Gaussian model's log-probability shape when `reduction="none"`
+
 ## [2.1.0] - 2026-05-10
 ### Changed
 - Improving the robustness and learning capabilities of on-policy algorithms:
```

**File**: `docs/source/intro/installation.rst` (modified, +2/-2)
```diff
@@ -29,8 +29,8 @@ Dependencies
       - `jax <https://jax.readthedocs.io>`_ / `jaxlib <https://jax.readthedocs.io>`_ ``>= 0.4.31``
         |br| `flax <https://flax.readthedocs.io>`_ ``>= 0.9.0``
         |br| `optax <https://optax.readthedocs.io>`_
-      - `warp-lang <https://nvidia.github.io/warp>`_ ``>= 1.12``
-        |br| `warp-nn <https://nvidia.github.io/warp-nn>`_ ``>= 0.1``
+      - `warp-lang <https://nvidia.github.io/warp>`_ ``>= 1.15``
+        |br| `warp-nn <https://nvidia.github.io/warp-nn>`_ ``>= 0.4``
 
 .. warning::
 
```

**File**: `pyproject.toml` (modified, +4/-4)
```diff
@@ -38,17 +38,17 @@ jax = [
   "optax",
 ]
 warp = [
-  "warp-lang>=1.12",
-  "warp-nn>=0.1",
+  "warp-lang>=1.15",
+  "warp-nn>=0.4",
 ]
 all = [
   "torch>=1.11",
   "jax>=0.4.31",
   "jaxlib>=0.4.31",
   "flax>=0.9.0",
   "optax",
-  "warp-lang>=1.12",
-  "warp-nn>=0.1",
+  "warp-lang>=1.15",
+  "warp-nn>=0.4",
 ]
 tests = [
   "pytest",
```

**File**: `skrl/agents/warp/ppo/ppo.py` (modified, +2/-8)
```diff
@@ -513,14 +513,8 @@ def update(self, *, timestep: int, timesteps: int) -> None:
             ):
 
                 inputs = {
-                    "observations": (
-                        sampled_observations
-                        if epoch
-                        else self._observation_preprocessor(sampled_observations, train=True, inplace=True)
-                    ),
-                    "states": (
-                        sampled_states if epoch else self._state_preprocessor(sampled_states, train=True, inplace=True)
-                    ),
+                    "observations": self._observation_preprocessor(sampled_observations, train=not epoch),
+                    "states": self._state_preprocessor(sampled_states, train=not epoch),
                 }
 
                 # compute loss
```

**File**: `skrl/models/warp/base.py` (modified, +1/-3)
```diff
@@ -49,8 +49,6 @@ def __init__(
         self.num_states = compute_space_size(state_space)
         self.num_actions = compute_space_size(action_space)
 
-        self.training = False
-
     def init_state_dict(self, inputs: dict[str, Any] = {}, *, role: str = "") -> None:
         """Initialize lazy modules' parameters.
 
@@ -280,7 +278,7 @@ def enable_training_mode(self, enabled: bool = True) -> None:
         :param enabled: True to enable the training mode, False to enable the evaluation mode.
             See :py:meth:`torch.nn.Module.train` for more details.
         """
-        self.training = enabled
+        self.train(enabled)
 
     def save(self, path: str, *, state_dict: dict[str, Any] | None = None) -> None:
         """Save the model to the specified path.
```

**File**: `skrl/models/warp/gaussian.py` (modified, +14/-10)
```diff
@@ -52,39 +52,43 @@ def _gaussian(
         loc_ij = wp.clamp(loc_ij, min_mean_actions[j], max_mean_actions[j])
     loc_out[i, j] = loc_ij
     # clip log standard deviations and compute distribution parameters
-    scale[j] = wp.exp(wp.clamp(log_std[j], min_log_std, max_log_std))
+    # - keep the scale in a local variable: reading back an array written by the same kernel breaks the gradients
+    # - write the scale output from a single thread: otherwise its adjoint is accumulated once per thread (sample)
+    scale_j = wp.exp(wp.clamp(log_std[j], min_log_std, max_log_std))
+    if i == 0:
+        scale[j] = scale_j
     # sample actions
     if min_actions:
-        actions[i, j] = wp.clamp(2.0 * wp.randn(subkey) * scale[j] + loc_ij, min_actions[j], max_actions[j])
+        actions[i, j] = wp.clamp(wp.randn(subkey) * scale_j + loc_ij, min_actions[j], max_actions[j])
     else:
-        actions[i, j] = 2.0 * wp.randn(subkey) * scale[j] + loc_ij
+        actions[i, j] = wp.randn(subkey) * scale_j + loc_ij
     # log of the probability density function
     if taken_actions:
         # mean
         if reduction == 0:
-            wp.atomic_add(log_prob[i], 0, _log_prob(taken_actions[i, j], loc_ij, scale[j]) / m)
+            wp.atomic_add(log_prob[i], 0, _log_prob(taken_actions[i, j], loc_ij, scale_j) / m)
         # sum
         elif reduction == 1:
-            wp.atomic_add(log_prob[i], 0, _log_prob(taken_actions[i, j], loc_ij, scale[j]))
+            wp.atomic_add(log_prob[i], 0, _log_prob(taken_actions[i, j], loc_ij, scale_j))
         # prod
         elif reduction == 2:
             pass  # TODO: implement prod
         # none
         else:
-            log_prob[i, j] = _log_prob(taken_actions[i, j], loc_ij, scale[j])
+            log_prob[i, j] = _log_prob(taken_actions[i, j], loc_ij, scale_j)
     else:
         # mean
         if reduction == 0:
-            wp.atomic_add(log_prob[i], 0, _log_prob(actions[i, j], loc_ij, scale[j]) / m)
+            wp.atomic_add(log_prob[i], 0, _log_prob(actions[i, j], loc_ij, scale_j) / m)
         # sum
         elif reduction == 1:
-            wp.atomic_add(log_prob[i], 0, _log_prob(actions[i, j], loc_ij, scale[j]))
+            wp.atomic_add(log_prob[i], 0, _log_prob(actions[i, j], loc_ij, scale_j))
         # prod
         elif reduction == 2:
             pass  # TODO: implement prod
         # none
         else:
-            log_prob[i, j] = _log_prob(actions[i, j], loc_ij, scale[j])
+            log_prob[i, j] = _log_prob(actions[i, j], loc_ij, scale_j)
 
 
 @wp.kernel
@@ -166,7 +170,7 @@ def act(self, inputs: dict[str, Any], *, role: str = "") -> tuple[wp.array, dict
         shape = mean_actions.shape
         mean_actions_clipped = wp.empty(shape=shape, dtype=wp.float32, device=self.device, requires_grad=True)
         actions = wp.empty(shape=shape, dtype=wp.float32, device=self.device, requires_grad=True)
-        if self._g_reduction == "none":
+        if self._g_reduction == 3:  # none
             log_prob = wp.zeros(shape=shape, dtype=wp.float32, device=self.device, requires_grad=True)
         else:
             log_prob = wp.zeros(shape=(shape[0], 1), dtype=wp.float32, device=self.device, requires_grad=True)
```

---

### Incident Patch 2: `83c68a77` (2026-09-10)
**Commit Message**: Add else branch to avoid model instantiators' concatenate bug (#433)

**File**: `skrl/utils/model_instantiators/jax/common.py` (modified, +5/-4)
```diff
@@ -111,10 +111,11 @@ def visit_Call(self, node: ast.Call):
                 if node.func.id == "concatenate":
                     node.func = ast.Attribute(value=ast.Name("jnp"), attr="concatenate")
                     node.keywords = [ast.keyword(arg="axis", value=ast.Constant(value=-1))]
-                # activation functions
-                activation = _get_activation_function(node.func.id)
-                if activation:
-                    node.func = ast.Attribute(value=ast.Name("nn"), attr=activation.replace("nn.", ""))
+                else:
+                    # activation functions
+                    activation = _get_activation_function(node.func.id)
+                    if activation:
+                        node.func = ast.Attribute(value=ast.Name("nn"), attr=activation.replace("nn.", ""))
             return node
 
     size = get_num_units("ACTIONS")
```

**File**: `skrl/utils/model_instantiators/torch/common.py` (modified, +5/-4)
```diff
@@ -111,10 +111,11 @@ def visit_Call(self, node: ast.Call):
                 if node.func.id == "concatenate":
                     node.func = ast.Attribute(value=ast.Name("torch"), attr="cat")
                     node.keywords = [ast.keyword(arg="dim", value=ast.Constant(value=1))]
-                # activation functions
-                activation = _get_activation_function(node.func.id, as_module=False)
-                if activation:
-                    node.func = ast.Attribute(value=ast.Name("nn"), attr=activation)
+                else:
+                    # activation functions
+                    activation = _get_activation_function(node.func.id, as_module=False)
+                    if activation:
+                        node.func = ast.Attribute(value=ast.Name("nn"), attr=activation)
             return node
 
     size = get_num_units("ACTIONS")
```

**File**: `skrl/utils/model_instantiators/warp/common.py` (modified, +5/-4)
```diff
@@ -105,10 +105,11 @@ def visit_Call(self, node: ast.Call):
                 if node.func.id == "concatenate":
                     node.func = ast.Attribute(value=ast.Name("warp_utils"), attr="concatenate")
                     node.keywords = [ast.keyword(arg="axis", value=ast.Constant(value=1))]
-                # activation functions
-                activation = _get_activation_function(node.func.id, as_module=False)
-                if activation:
-                    node.func = ast.Attribute(value=ast.Name("nn"), attr=activation)
+                else:
+                    # activation functions
+                    activation = _get_activation_function(node.func.id, as_module=False)
+                    if activation:
+                        node.func = ast.Attribute(value=ast.Name("nn"), attr=activation)
             return node
 
     size = get_num_units("ACTIONS")
```

---

### Incident Patch 3: `e4358fa3` (2026-09-10)
**Commit Message**: Fix JAX's test minimum requirements for Gymnasium environments (#452)

**File**: `.github/workflows/tests-jax.yml` (modified, +3/-6)
```diff
@@ -60,8 +60,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet "numpy<2.0"  # 1.19.3
-        python -m pip install --quiet jax==0.4.31 jaxlib==0.4.31 flax==0.9.0 optax
+        python -m pip install --quiet "numpy<2.0" jax==0.4.31 jaxlib==0.4.31 flax==0.9.0 optax
         python -m pip install --quiet -e .[jax]
         python -m pip install --quiet -e .[tests]
         python -m pip list
@@ -121,8 +120,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet "numpy<2.0"  # 1.19.3
-        python -m pip install --quiet jax==0.4.31 jaxlib==0.4.31 flax==0.9.0 optax
+        python -m pip install --quiet "numpy<2.0" jax==0.4.31 jaxlib==0.4.31 flax==0.9.0 optax
         python -m pip install --quiet -e .[jax]
         python -m pip install --quiet -e .[tests]
         python -m pip list
@@ -178,8 +176,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet "numpy<2.0"  # 1.19.3
-        python -m pip install --quiet jax==0.4.31 jaxlib==0.4.31 flax==0.9.0 optax
+        python -m pip install --quiet "numpy<2.0" jax==0.4.31 jaxlib==0.4.31 flax==0.9.0 optax
         python -m pip install --quiet -e .[jax]
         python -m pip install --quiet -e .[tests]
         python -m pip list
```

**File**: `.github/workflows/tests-torch.yml` (modified, +6/-12)
```diff
@@ -60,8 +60,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet "numpy<2.0"  # 1.19.3
-        python -m pip install --quiet torch==1.11
+        python -m pip install --quiet "numpy<2.0" torch==1.11
         python -m pip install --quiet -e .[torch]
         python -m pip install --quiet -e .[tests]
         python -m pip list
@@ -121,8 +120,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet "numpy<2.0"  # 1.19.3
-        python -m pip install --quiet torch==1.11
+        python -m pip install --quiet "numpy<2.0" torch==1.11
         python -m pip install --quiet -e .[torch]
         python -m pip install --quiet -e .[tests]
         python -m pip list
@@ -177,8 +175,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet "numpy<2.0"  # 1.19.3
-        python -m pip install --quiet torch==1.11
+        python -m pip install --quiet "numpy<2.0" torch==1.11
         python -m pip install --quiet -e .[torch]
         python -m pip install --quiet -e .[tests]
         python -m pip list
@@ -238,8 +235,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet numpy
-        python -m pip install --quiet torch
+        python -m pip install --quiet numpy torch
         python -m pip install --quiet -e .[torch]
         python -m pip install --quiet -e .[tests]
         python -m pip list
@@ -303,8 +299,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet numpy
-        python -m pip install --quiet torch
+        python -m pip install --quiet numpy torch
         python -m pip install --quiet -e .[torch]
         python -m pip install --quiet -e .[tests]
         python -m pip list
@@ -364,8 +359,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet numpy
-        python -m pip install --quiet torch
+        python -m pip install --quiet numpy torch
         python -m pip install --quiet -e .[torch]
         python -m pip install --quiet -e .[tests]
         python -m pip list
```

**File**: `.github/workflows/tests-warp.yml` (modified, +3/-6)
```diff
@@ -60,8 +60,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet "numpy<2.0"  # 1.19.3
-        python -m pip install --quiet warp-lang==1.12
+        python -m pip install --quiet "numpy<2.0" warp-lang==1.12
         python -m pip install --quiet -e .[warp]
         python -m pip install --quiet -e .[tests]
         python -m pip list
@@ -112,8 +111,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet "numpy<2.0"  # 1.19.3
-        python -m pip install --quiet warp-lang==1.12
+        python -m pip install --quiet "numpy<2.0" warp-lang==1.12
         python -m pip install --quiet -e .[warp]
         python -m pip install --quiet -e .[tests]
         python -m pip list
@@ -159,8 +157,7 @@ jobs:
     - name: Install dependencies
       run: |
         python -m pip install --quiet --upgrade pip
-        python -m pip install --quiet "numpy<2.0"  # 1.19.3
-        python -m pip install --quiet warp-lang==1.12
+        python -m pip install --quiet "numpy<2.0" warp-lang==1.12
         python -m pip install --quiet -e .[warp]
         python -m pip install --quiet -e .[tests]
         python -m pip list
```

**File**: `skrl/envs/wrappers/jax/gymnasium_envs.py` (modified, +9/-0)
```diff
@@ -2,6 +2,15 @@
 
 from typing import Any
 
+
+# hack to fix: module 'numpy' has no attribute 'bool8'
+try:
+    import numpy as np
+
+    np.bool8
+except AttributeError:
+    np.bool8 = np.bool
+
 import gymnasium
 
 import jax
```

**File**: `skrl/envs/wrappers/torch/gymnasium_envs.py` (modified, +9/-0)
```diff
@@ -2,6 +2,15 @@
 
 from typing import Any
 
+
+# hack to fix: module 'numpy' has no attribute 'bool8'
+try:
+    import numpy as np
+
+    np.bool8
+except AttributeError:
+    np.bool8 = np.bool
+
 import gymnasium
 
 import torch
```

---

### Incident Patch 4: `94fef811` (2026-05-09)
**Commit Message**: Fix the indexing of finished episodes for cumulative rewards and timestep tracking (#439)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 
 ### Fixed
 - Fix time limits handling of truncation signals in on-policy agents/multi-agents
+- Fix the indexing of finished episodes for cumulative rewards and timestep tracking
 
 ## [2.0.0] - 2026-04-08
 
```

**File**: `skrl/agents/jax/base.py` (modified, +2/-2)
```diff
@@ -376,8 +376,8 @@ def record_transition(
             if finished_episodes.size:
 
                 # storage cumulative rewards and timesteps
-                self._track_rewards.extend(self._cumulative_rewards[finished_episodes][:, 0].reshape(-1).tolist())
-                self._track_timesteps.extend(self._cumulative_timesteps[finished_episodes][:, 0].reshape(-1).tolist())
+                self._track_rewards.extend(self._cumulative_rewards[finished_episodes].tolist())
+                self._track_timesteps.extend(self._cumulative_timesteps[finished_episodes].tolist())
 
                 # reset the cumulative rewards and timesteps
                 self._cumulative_rewards[finished_episodes] = 0
```

**File**: `skrl/agents/torch/base.py` (modified, +3/-3)
```diff
@@ -364,12 +364,12 @@ def record_transition(
             self._cumulative_timesteps.add_(1)
 
             # check ended episodes
-            finished_episodes = (terminated + truncated).nonzero(as_tuple=False)
+            finished_episodes = (terminated + truncated).nonzero(as_tuple=True)[0]
             if finished_episodes.numel():
 
                 # storage cumulative rewards and timesteps
-                self._track_rewards.extend(self._cumulative_rewards[finished_episodes][:, 0].reshape(-1).tolist())
-                self._track_timesteps.extend(self._cumulative_timesteps[finished_episodes][:, 0].reshape(-1).tolist())
+                self._track_rewards.extend(self._cumulative_rewards[finished_episodes].tolist())
+                self._track_timesteps.extend(self._cumulative_timesteps[finished_episodes].tolist())
 
                 # reset the cumulative rewards and timesteps
                 self._cumulative_rewards[finished_episodes] = 0
```

**File**: `skrl/agents/warp/base.py` (modified, +2/-2)
```diff
@@ -354,8 +354,8 @@ def record_transition(
             if finished_episodes.size:
 
                 # storage cumulative rewards and timesteps
-                self._track_rewards.extend(self._cumulative_rewards[finished_episodes][:, 0].reshape(-1).tolist())
-                self._track_timesteps.extend(self._cumulative_timesteps[finished_episodes][:, 0].reshape(-1).tolist())
+                self._track_rewards.extend(self._cumulative_rewards[finished_episodes].tolist())
+                self._track_timesteps.extend(self._cumulative_timesteps[finished_episodes].tolist())
 
                 # reset the cumulative rewards and timesteps
                 self._cumulative_rewards[finished_episodes] = 0
```

**File**: `skrl/multi_agents/jax/base.py` (modified, +2/-2)
```diff
@@ -423,8 +423,8 @@ def record_transition(
             if finished_episodes.size:
 
                 # storage cumulative rewards and timesteps
-                self._track_rewards.extend(self._cumulative_rewards[finished_episodes][:, 0].reshape(-1).tolist())
-                self._track_timesteps.extend(self._cumulative_timesteps[finished_episodes][:, 0].reshape(-1).tolist())
+                self._track_rewards.extend(self._cumulative_rewards[finished_episodes].tolist())
+                self._track_timesteps.extend(self._cumulative_timesteps[finished_episodes].tolist())
 
                 # reset the cumulative rewards and timesteps
                 self._cumulative_rewards[finished_episodes] = 0
```

**File**: `skrl/multi_agents/torch/base.py` (modified, +4/-4)
```diff
@@ -405,13 +405,13 @@ def record_transition(
 
             # check ended episodes
             finished_episodes = (next(iter(terminated.values())) + next(iter(truncated.values()))).nonzero(
-                as_tuple=False
-            )
+                as_tuple=True
+            )[0]
             if finished_episodes.numel():
 
                 # storage cumulative rewards and timesteps
-                self._track_rewards.extend(self._cumulative_rewards[finished_episodes][:, 0].reshape(-1).tolist())
-                self._track_timesteps.extend(self._cumulative_timesteps[finished_episodes][:, 0].reshape(-1).tolist())
+                self._track_rewards.extend(self._cumulative_rewards[finished_episodes].tolist())
+                self._track_timesteps.extend(self._cumulative_timesteps[finished_episodes].tolist())
 
                 # reset the cumulative rewards and timesteps
                 self._cumulative_rewards[finished_episodes] = 0
```

---

### Incident Patch 5: `d11cadb8` (2026-05-09)
**Commit Message**: Fix variable name from 'memory' to 'memories' (#430)

**File**: `docs/source/snippets/multi_agents_basic_usage.py` (modified, +4/-4)
```diff
@@ -18,7 +18,7 @@
 agent = IPPO(
     possible_agents=env.possible_agents,
     models=models,
-    memory=memories,  # only required during training
+    memories=memories,  # only required during training
     cfg=cfg_agent,
     observation_spaces=env.observation_spaces,
     state_spaces=env.state_spaces,
@@ -48,7 +48,7 @@
 agent = IPPO(
     possible_agents=env.possible_agents,
     models=models,
-    memory=memories,  # only required during training
+    memories=memories,  # only required during training
     cfg=cfg_agent,
     observation_spaces=env.observation_spaces,
     state_spaces=env.state_spaces,
@@ -78,7 +78,7 @@
 agent = MAPPO(
     possible_agents=env.possible_agents,
     models=models,
-    memory=memories,  # only required during training
+    memories=memories,  # only required during training
     cfg=cfg_agent,
     observation_spaces=env.observation_spaces,
     state_spaces=env.state_spaces,
@@ -108,7 +108,7 @@
 agent = MAPPO(
     possible_agents=env.possible_agents,
     models=models,
-    memory=memories,  # only required during training
+    memories=memories,  # only required during training
     cfg=cfg_agent,
     observation_spaces=env.observation_spaces,
     state_spaces=env.state_spaces,
```

---

### Incident Patch 6: `04e43b5e` (2026-05-06)
**Commit Message**: Fix time limits handling of truncation signals in on-policy agents/multi-agents (#438)

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -9,6 +9,9 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
   - Sum-reduce policy entropy to prevent collapse into near-deterministic stand still behavior
 - Set the random memory `replacement` argument to false by default
 
+### Fixed
+- Fix time limits handling of truncation signals in on-policy agents/multi-agents
+
 ## [2.0.0] - 2026-04-08
 
 Summary of the most relevant features:
```

**File**: `skrl/__init__.py` (modified, +5/-5)
```diff
@@ -353,8 +353,8 @@ def __init__(self) -> None:
                     wp.init()
 
             @staticmethod
-            def parse_device(device: str | "warp.context.Device" | None) -> "warp.context.Device":
-                """Parse the input device and return a :py:class:`~warp.context.Device` instance.
+            def parse_device(device: str | "warp.Device" | None) -> "warp.Device":
+                """Parse the input device and return a :py:class:`~warp.Device` instance.
 
                 :param device: Device specification. If the specified device is ``None`` or it cannot be resolved,
                     the default available device will be returned instead.
@@ -363,7 +363,7 @@ def parse_device(device: str | "warp.context.Device" | None) -> "warp.context.De
                 """
                 import warp as wp
 
-                if isinstance(device, wp.context.Device):
+                if isinstance(device, wp.Device):
                     return device
                 elif isinstance(device, str):
                     try:
@@ -373,7 +373,7 @@ def parse_device(device: str | "warp.context.Device" | None) -> "warp.context.De
                 return wp.get_device()
 
             @property
-            def device(self) -> "warp.context.Device":
+            def device(self) -> "warp.Device":
                 """Default device.
 
                 The default device, unless specified, is ``cuda`` if CUDA is available, ``cpu`` otherwise.
@@ -382,7 +382,7 @@ def device(self) -> "warp.context.Device":
                 return self._device
 
             @device.setter
-            def device(self, device: str | "warp.context.Device") -> None:
+            def device(self, device: str | "warp.Device") -> None:
                 self._device = device
 
             @property
```

**File**: `skrl/agents/jax/a2c/a2c.py` (modified, +21/-10)
```diff
@@ -21,27 +21,27 @@
 
 
 # https://jax.readthedocs.io/en/latest/faq.html#strategy-1-jit-compiled-helper-function
-@jax.jit
+@functools.partial(jax.jit, static_argnames=("time_limit_bootstrap",))
 def _compute_gae(
     rewards: jax.Array,
     terminated: jax.Array,
+    truncated: jax.Array,
     values: jax.Array,
-    next_values: jax.Array,
+    last_values: jax.Array,
     discount_factor: float = 0.99,
     lambda_coefficient: float = 0.95,
+    time_limit_bootstrap: bool = False,
 ) -> jax.Array:
     advantage = 0
     advantages = jnp.zeros_like(rewards)
-    not_terminated = jnp.logical_not(terminated)
+    not_done = jnp.logical_not(jnp.logical_or(terminated, truncated) if time_limit_bootstrap else terminated)
     memory_size = rewards.shape[0]
 
     # advantages computation
     for i in reversed(range(memory_size)):
-        next_values = values[i + 1] if i < memory_size - 1 else next_values
+        next_values = values[i + 1] if i < memory_size - 1 else last_values
         advantage = (
-            rewards[i]
-            - values[i]
-            + discount_factor * not_terminated[i] * (next_values + lambda_coefficient * advantage)
+            rewards[i] - values[i] + discount_factor * not_done[i] * (next_values + lambda_coefficient * advantage)
         )
         advantages = advantages.at[i].set(advantage)
     # returns computation
@@ -226,6 +226,7 @@ def init(self, *, trainer_cfg: dict[str, Any] | None = None) -> None:
             self.memory.create_tensor(name="actions", size=self.action_space, dtype=jnp.float32)
             self.memory.create_tensor(name="rewards", size=1, dtype=jnp.float32)
             self.memory.create_tensor(name="terminated", size=1, dtype=jnp.int8)
+            self.memory.create_tensor(name="truncated", size=1, dtype=jnp.int8)
             self.memory.create_tensor(name="log_prob", size=1, dtype=jnp.float32)
             self.memory.create_tensor(name="values", size=1, dtype=jnp.float32)
             self.memory.create_tensor(name="returns", size=1, dtype=jnp.float32)
@@ -330,8 +331,15 @@ def record_transition(
                 rewards = self.cfg.rewards_shaper(rewards, timestep, timesteps)
 
             # time-limit (truncation) bootstrapping
-            if self.cfg.time_limit_bootstrap:
-                rewards += self.cfg.discount_factor * self._current_values * truncated
+            if self.cfg.time_limit_bootstrap and truncated.any():
+                inputs = {
+                    "observations": self._observation_preprocessor(next_observations),
+                    "states": self._state_preprocessor(next_states),
+                }
+                next_values, _ = self.value.act(inputs, role="value")
+                next_values = self._value_preprocessor(next_values, inverse=True)
+
+                rewards += self.cfg.discount_factor * next_values * truncated
 
             # storage transition in memory
             self.memory.add_samples(
@@ -340,6 +348,7 @@ def record_transition(
                 actions=actions,
                 rewards=rewards,
                 terminated=terminated,
+                truncated=truncated,
                 log_prob=self._current_log_prob,
                 values=self._current_values,
             )
@@ -390,10 +399,12 @@ def update(self, *, timestep: int, timesteps: int) -> None:
         returns, advantages = _compute_gae(
             rewards=self.memory.get_tensor_by_name("rewards"),
             terminated=self.memory.get_tensor_by_name("terminated"),
+            truncated=self.memory.get_tensor_by_name("truncated"),
             values=values,
-            next_values=last_values,
+            last_values=last_values,
             discount_factor=self.cfg.discount_factor,
             lambda_coefficient=self.cfg.gae_lambda,
+            time_limit_bootstrap=self.cfg.time_limit_bootstrap,
         )
 
         self.memory.set_tensor_by_name("values", self._value_preprocessor(values, train=True))
```

**File**: `skrl/agents/jax/ppo/ppo.py` (modified, +21/-10)
```diff
@@ -21,27 +21,27 @@
 
 
 # https://jax.readthedocs.io/en/latest/faq.html#strategy-1-jit-compiled-helper-function
-@jax.jit
+@functools.partial(jax.jit, static_argnames=("time_limit_bootstrap",))
 def _compute_gae(
     rewards: jax.Array,
     terminated: jax.Array,
+    truncated: jax.Array,
     values: jax.Array,
-    next_values: jax.Array,
+    last_values: jax.Array,
     discount_factor: float = 0.99,
     lambda_coefficient: float = 0.95,
+    time_limit_bootstrap: bool = False,
 ) -> jax.Array:
     advantage = 0
     advantages = jnp.zeros_like(rewards)
-    not_terminated = jnp.logical_not(terminated)
+    not_done = jnp.logical_not(jnp.logical_or(terminated, truncated) if time_limit_bootstrap else terminated)
     memory_size = rewards.shape[0]
 
     # advantages computation
     for i in reversed(range(memory_size)):
-        next_values = values[i + 1] if i < memory_size - 1 else next_values
+        next_values = values[i + 1] if i < memory_size - 1 else last_values
         advantage = (
-            rewards[i]
-            - values[i]
-            + discount_factor * not_terminated[i] * (next_values + lambda_coefficient * advantage)
+            rewards[i] - values[i] + discount_factor * not_done[i] * (next_values + lambda_coefficient * advantage)
         )
         advantages = advantages.at[i].set(advantage)
     # returns computation
@@ -241,6 +241,7 @@ def init(self, *, trainer_cfg: dict[str, Any] | None = None) -> None:
             self.memory.create_tensor(name="actions", size=self.action_space, dtype=jnp.float32)
             self.memory.create_tensor(name="rewards", size=1, dtype=jnp.float32)
             self.memory.create_tensor(name="terminated", size=1, dtype=jnp.int8)
+            self.memory.create_tensor(name="truncated", size=1, dtype=jnp.int8)
             self.memory.create_tensor(name="log_prob", size=1, dtype=jnp.float32)
             self.memory.create_tensor(name="values", size=1, dtype=jnp.float32)
             self.memory.create_tensor(name="returns", size=1, dtype=jnp.float32)
@@ -345,8 +346,15 @@ def record_transition(
                 rewards = self.cfg.rewards_shaper(rewards, timestep, timesteps)
 
             # time-limit (truncation) bootstrapping
-            if self.cfg.time_limit_bootstrap:
-                rewards += self.cfg.discount_factor * self._current_values * truncated
+            if self.cfg.time_limit_bootstrap and truncated.any():
+                inputs = {
+                    "observations": self._observation_preprocessor(next_observations),
+                    "states": self._state_preprocessor(next_states),
+                }
+                next_values, _ = self.value.act(inputs, role="value")
+                next_values = self._value_preprocessor(next_values, inverse=True)
+
+                rewards += self.cfg.discount_factor * next_values * truncated
 
             # storage transition in memory
             self.memory.add_samples(
@@ -355,6 +363,7 @@ def record_transition(
                 actions=actions,
                 rewards=rewards,
                 terminated=terminated,
+                truncated=truncated,
                 log_prob=self._current_log_prob,
                 values=self._current_values,
             )
@@ -405,10 +414,12 @@ def update(self, *, timestep: int, timesteps: int) -> None:
         returns, advantages = _compute_gae(
             rewards=self.memory.get_tensor_by_name("rewards"),
             terminated=self.memory.get_tensor_by_name("terminated"),
+            truncated=self.memory.get_tensor_by_name("truncated"),
             values=values,
-            next_values=last_values,
+            last_values=last_values,
             discount_factor=self.cfg.discount_factor,
             lambda_coefficient=self.cfg.gae_lambda,
+            time_limit_bootstrap=self.cfg.time_limit_bootstrap,
         )
 
         self.memory.set_tensor_by_name("values", self._value_preprocessor(values, train=True))
```

**File**: `skrl/agents/jax/rpo/rpo.py` (modified, +22/-10)
```diff
@@ -21,27 +21,27 @@
 
 
 # https://jax.readthedocs.io/en/latest/faq.html#strategy-1-jit-compiled-helper-function
-@jax.jit
+@functools.partial(jax.jit, static_argnames=("time_limit_bootstrap",))
 def _compute_gae(
     rewards: jax.Array,
     terminated: jax.Array,
+    truncated: jax.Array,
     values: jax.Array,
-    next_values: jax.Array,
+    last_values: jax.Array,
     discount_factor: float = 0.99,
     lambda_coefficient: float = 0.95,
+    time_limit_bootstrap: bool = False,
 ) -> jax.Array:
     advantage = 0
     advantages = jnp.zeros_like(rewards)
-    not_terminated = jnp.logical_not(terminated)
+    not_done = jnp.logical_not(jnp.logical_or(terminated, truncated) if time_limit_bootstrap else terminated)
     memory_size = rewards.shape[0]
 
     # advantages computation
     for i in reversed(range(memory_size)):
-        next_values = values[i + 1] if i < memory_size - 1 else next_values
+        next_values = values[i + 1] if i < memory_size - 1 else last_values
         advantage = (
-            rewards[i]
-            - values[i]
-            + discount_factor * not_terminated[i] * (next_values + lambda_coefficient * advantage)
+            rewards[i] - values[i] + discount_factor * not_done[i] * (next_values + lambda_coefficient * advantage)
         )
         advantages = advantages.at[i].set(advantage)
     # returns computation
@@ -241,6 +241,7 @@ def init(self, *, trainer_cfg: dict[str, Any] | None = None) -> None:
             self.memory.create_tensor(name="actions", size=self.action_space, dtype=jnp.float32)
             self.memory.create_tensor(name="rewards", size=1, dtype=jnp.float32)
             self.memory.create_tensor(name="terminated", size=1, dtype=jnp.int8)
+            self.memory.create_tensor(name="truncated", size=1, dtype=jnp.int8)
             self.memory.create_tensor(name="log_prob", size=1, dtype=jnp.float32)
             self.memory.create_tensor(name="values", size=1, dtype=jnp.float32)
             self.memory.create_tensor(name="returns", size=1, dtype=jnp.float32)
@@ -346,8 +347,16 @@ def record_transition(
                 rewards = self.cfg.rewards_shaper(rewards, timestep, timesteps)
 
             # time-limit (truncation) bootstrapping
-            if self.cfg.time_limit_bootstrap:
-                rewards += self.cfg.discount_factor * self._current_values * truncated
+            if self.cfg.time_limit_bootstrap and truncated.any():
+                inputs = {
+                    "observations": self._observation_preprocessor(next_observations),
+                    "states": self._state_preprocessor(next_states),
+                    "alpha": self.cfg.alpha,
+                }
+                next_values, _ = self.value.act(inputs, role="value")
+                next_values = self._value_preprocessor(next_values, inverse=True)
+
+                rewards += self.cfg.discount_factor * next_values * truncated
 
             # storage transition in memory
             self.memory.add_samples(
@@ -356,6 +365,7 @@ def record_transition(
                 actions=actions,
                 rewards=rewards,
                 terminated=terminated,
+                truncated=truncated,
                 log_prob=self._current_log_prob,
                 values=self._current_values,
             )
@@ -407,10 +417,12 @@ def update(self, *, timestep: int, timesteps: int) -> None:
         returns, advantages = _compute_gae(
             rewards=self.memory.get_tensor_by_name("rewards"),
             terminated=self.memory.get_tensor_by_name("terminated"),
+            truncated=self.memory.get_tensor_by_name("truncated"),
             values=values,
-            next_values=last_values,
+            last_values=last_values,
             discount_factor=self.cfg.discount_factor,
             lambda_coefficient=self.cfg.gae_lambda,
+            time_limit_bootstrap=self.cfg.time_limit_bootstrap,
         )
 
         self.memory.set_tensor_by_name("values", self._value_preprocessor(values, train=True))
```

**File**: `skrl/agents/torch/a2c/a2c.py` (modified, +24/-10)
```diff
@@ -24,34 +24,36 @@ def compute_gae(
     *,
     rewards: torch.Tensor,
     terminated: torch.Tensor,
+    truncated: torch.Tensor,
     values: torch.Tensor,
-    next_values: torch.Tensor,
+    last_values: torch.Tensor,
     discount_factor: float = 0.99,
     lambda_coefficient: float = 0.95,
+    time_limit_bootstrap: bool = False,
 ) -> torch.Tensor:
     """Compute the Generalized Advantage Estimator (GAE).
 
     :param rewards: Rewards obtained by the agent.
     :param terminated: Signals to indicate that episodes have ended.
+    :param truncated: Signals to indicate that episodes have been truncated.
     :param values: Values obtained by the agent.
-    :param next_values: Next values obtained by the agent.
+    :param last_values: Last values obtained by the agent.
     :param discount_factor: Discount factor.
     :param lambda_coefficient: Lambda coefficient.
+    :param time_limit_bootstrap: Whether to use time-limit (truncation) bootstrapping.
 
     :return: Generalized Advantage Estimator.
     """
     advantage = 0
     advantages = torch.zeros_like(rewards)
-    not_terminated = terminated.logical_not()
+    not_done = ((terminated | truncated) if time_limit_bootstrap else terminated).logical_not()
     memory_size = rewards.shape[0]
 
     # advantages computation
     for i in reversed(range(memory_size)):
-        next_values = values[i + 1] if i < memory_size - 1 else next_values
+        next_values = values[i + 1] if i < memory_size - 1 else last_values
         advantage = (
-            rewards[i]
-            - values[i]
-            + discount_factor * not_terminated[i] * (next_values + lambda_coefficient * advantage)
+            rewards[i] - values[i] + discount_factor * not_done[i] * (next_values + lambda_coefficient * advantage)
         )
         advantages[i] = advantage
     # returns computation
@@ -176,6 +178,7 @@ def init(self, *, trainer_cfg: dict[str, Any] | None = None) -> None:
             self.memory.create_tensor(name="actions", size=self.action_space, dtype=torch.float32)
             self.memory.create_tensor(name="rewards", size=1, dtype=torch.float32)
             self.memory.create_tensor(name="terminated", size=1, dtype=torch.bool)
+            self.memory.create_tensor(name="truncated", size=1, dtype=torch.bool)
             self.memory.create_tensor(name="log_prob", size=1, dtype=torch.float32)
             self.memory.create_tensor(name="values", size=1, dtype=torch.float32)
             self.memory.create_tensor(name="returns", size=1, dtype=torch.float32)
@@ -276,8 +279,16 @@ def record_transition(
                 rewards = self.cfg.rewards_shaper(rewards, timestep, timesteps)
 
             # time-limit (truncation) bootstrapping
-            if self.cfg.time_limit_bootstrap:
-                rewards += self.cfg.discount_factor * self._current_values * truncated
+            if self.cfg.time_limit_bootstrap and truncated.any():
+                with torch.no_grad():
+                    inputs = {
+                        "observations": self._observation_preprocessor(next_observations),
+                        "states": self._state_preprocessor(next_states),
+                    }
+                    next_values, _ = self.value.act(inputs, role="value")
+                    next_values = self._value_preprocessor(next_values, inverse=True)
+
+                rewards += self.cfg.discount_factor * next_values * truncated
 
             # storage transition in memory
             self.memory.add_samples(
@@ -286,6 +297,7 @@ def record_transition(
                 actions=actions,
                 rewards=rewards,
                 terminated=terminated,
+                truncated=truncated,
                 log_prob=self._current_log_prob,
                 values=self._current_values,
             )
@@ -337,10 +349,12 @@ def update(self, *, timestep: int, timesteps: int) -> None:
         returns, advantages = compute_gae(
             rewards=self.memory.get_tensor_by_name("rewards"),
             terminated=self.memory.get_tensor_by_name("terminated"),
+            truncated=self.memory.get_tensor_by_name("truncated"),
             values=values,
-            next_values=last_values,
+            last_values=last_values,
             discount_factor=self.cfg.discount_factor,
             lambda_coefficient=self.cfg.gae_lambda,
+            time_limit_bootstrap=self.cfg.time_limit_bootstrap,
         )
 
         self.memory.set_tensor_by_name("values", self._value_preprocessor(values, train=True))
```

**File**: `skrl/agents/torch/amp/amp.py` (modified, +39/-22)
```diff
@@ -25,33 +25,36 @@ def compute_gae(
     *,
     rewards: torch.Tensor,
     terminated: torch.Tensor,
+    truncated: torch.Tensor,
     values: torch.Tensor,
-    next_values: torch.Tensor,
+    last_values: torch.Tensor,
     discount_factor: float = 0.99,
     lambda_coefficient: float = 0.95,
+    time_limit_bootstrap: bool = False,
 ) -> torch.Tensor:
     """Compute the Generalized Advantage Estimator (GAE).
 
     :param rewards: Rewards obtained by the agent.
     :param terminated: Signals to indicate that episodes have ended.
+    :param truncated: Signals to indicate that episodes have been truncated.
     :param values: Values obtained by the agent.
-    :param next_values: Next values obtained by the agent.
+    :param last_values: Last values obtained by the agent.
     :param discount_factor: Discount factor.
     :param lambda_coefficient: Lambda coefficient.
+    :param time_limit_bootstrap: Whether to use time-limit (truncation) bootstrapping.
 
     :return: Generalized Advantage Estimator.
     """
     advantage = 0
     advantages = torch.zeros_like(rewards)
-    not_terminated = terminated.logical_not()
+    not_done = ((terminated | truncated) if time_limit_bootstrap else terminated).logical_not()
     memory_size = rewards.shape[0]
 
     # advantages computation
     for i in reversed(range(memory_size)):
+        next_values = values[i + 1] if i < memory_size - 1 else last_values
         advantage = (
-            rewards[i]
-            - values[i]
-            + discount_factor * (next_values[i] + lambda_coefficient * not_terminated[i] * advantage)
+            rewards[i] - values[i] + discount_factor * not_done[i] * (next_values + lambda_coefficient * advantage)
         )
         advantages[i] = advantage
     # returns computation
@@ -203,12 +206,12 @@ def init(self, *, trainer_cfg: dict[str, Any] | None = None) -> None:
             self.memory.create_tensor(name="actions", size=self.action_space, dtype=torch.float32)
             self.memory.create_tensor(name="rewards", size=1, dtype=torch.float32)
             self.memory.create_tensor(name="terminated", size=1, dtype=torch.bool)
+            self.memory.create_tensor(name="truncated", size=1, dtype=torch.bool)
             self.memory.create_tensor(name="log_prob", size=1, dtype=torch.float32)
             self.memory.create_tensor(name="values", size=1, dtype=torch.float32)
             self.memory.create_tensor(name="returns", size=1, dtype=torch.float32)
             self.memory.create_tensor(name="advantages", size=1, dtype=torch.float32)
             self.memory.create_tensor(name="amp_observations", size=self.amp_observation_space, dtype=torch.float32)
-            self.memory.create_tensor(name="next_values", size=1, dtype=torch.float32)
 
         self._tensors_names = [
             "observations",
@@ -231,6 +234,8 @@ def init(self, *, trainer_cfg: dict[str, Any] | None = None) -> None:
                 self.motion_dataset.add_samples(observations=self.collect_reference_motions(self.cfg.amp_batch_size))
 
         # create temporary variables needed for storage and computation
+        self._current_next_observations = None
+        self._current_next_states = None
         self._current_log_prob = None
         self._current_values = None
         self._rollout = 0
@@ -313,36 +318,37 @@ def record_transition(
         )
 
         if self.training:
+            self._current_next_observations = next_observations
+            self._current_next_states = next_states
             amp_observations = infos["amp_obs"]
 
             # reward shaping
             if self.cfg.rewards_shaper is not None:
                 rewards = self.cfg.rewards_shaper(rewards, timestep, timesteps)
 
             # time-limit (truncation) bootstrapping
-            if self.cfg.time_limit_bootstrap:
-                rewards += self.cfg.discount_factor * self._current_values * truncated
-
-            # compute next values
-            with torch.autocast(device_type=self._device_type, enabled=self.cfg.mixed_precision):
-                inputs = {
-                    "observations": self._observation_preprocessor(next_observations),
-                    "states": self._state_preprocessor(next_states),
-                }
-                next_values, _ = self.value.act(inputs, role="value")
-                next_values = self._value_preprocessor(next_values, inverse=True)
-                next_values *= terminated.view(-1, 1).logical_not()
+            if self.cfg.time_limit_bootstrap and truncated.any():
+                with torch.no_grad():
+                    inputs = {
+                        "observations": self._observation_preprocessor(next_observations),
+                        "states": self._state_preprocessor(next_states),
+                    }
+                    next_values, _ = self.value.act(inputs, role="value")
+                    next_values = self._value_preprocessor(next_values, inverse=True)
+
+          
```

**File**: `skrl/agents/torch/ppo/ppo.py` (modified, +24/-10)
```diff
@@ -24,34 +24,36 @@ def compute_gae(
     *,
     rewards: torch.Tensor,
     terminated: torch.Tensor,
+    truncated: torch.Tensor,
     values: torch.Tensor,
-    next_values: torch.Tensor,
+    last_values: torch.Tensor,
     discount_factor: float = 0.99,
     lambda_coefficient: float = 0.95,
+    time_limit_bootstrap: bool = False,
 ) -> torch.Tensor:
     """Compute the Generalized Advantage Estimator (GAE).
 
     :param rewards: Rewards obtained by the agent.
     :param terminated: Signals to indicate that episodes have ended.
+    :param truncated: Signals to indicate that episodes have been truncated.
     :param values: Values obtained by the agent.
-    :param next_values: Next values obtained by the agent.
+    :param last_values: Last values obtained by the agent.
     :param discount_factor: Discount factor.
     :param lambda_coefficient: Lambda coefficient.
+    :param time_limit_bootstrap: Whether to use time-limit (truncation) bootstrapping.
 
     :return: Generalized Advantage Estimator.
     """
     advantage = 0
     advantages = torch.zeros_like(rewards)
-    not_terminated = terminated.logical_not()
+    not_done = ((terminated | truncated) if time_limit_bootstrap else terminated).logical_not()
     memory_size = rewards.shape[0]
 
     # advantages computation
     for i in reversed(range(memory_size)):
-        next_values = values[i + 1] if i < memory_size - 1 else next_values
+        next_values = values[i + 1] if i < memory_size - 1 else last_values
         advantage = (
-            rewards[i]
-            - values[i]
-            + discount_factor * not_terminated[i] * (next_values + lambda_coefficient * advantage)
+            rewards[i] - values[i] + discount_factor * not_done[i] * (next_values + lambda_coefficient * advantage)
         )
         advantages[i] = advantage
     # returns computation
@@ -176,6 +178,7 @@ def init(self, *, trainer_cfg: dict[str, Any] | None = None) -> None:
             self.memory.create_tensor(name="actions", size=self.action_space, dtype=torch.float32)
             self.memory.create_tensor(name="rewards", size=1, dtype=torch.float32)
             self.memory.create_tensor(name="terminated", size=1, dtype=torch.bool)
+            self.memory.create_tensor(name="truncated", size=1, dtype=torch.bool)
             self.memory.create_tensor(name="log_prob", size=1, dtype=torch.float32)
             self.memory.create_tensor(name="values", size=1, dtype=torch.float32)
             self.memory.create_tensor(name="returns", size=1, dtype=torch.float32)
@@ -276,8 +279,16 @@ def record_transition(
                 rewards = self.cfg.rewards_shaper(rewards, timestep, timesteps)
 
             # time-limit (truncation) bootstrapping
-            if self.cfg.time_limit_bootstrap:
-                rewards += self.cfg.discount_factor * self._current_values * truncated
+            if self.cfg.time_limit_bootstrap and truncated.any():
+                with torch.no_grad():
+                    inputs = {
+                        "observations": self._observation_preprocessor(next_observations),
+                        "states": self._state_preprocessor(next_states),
+                    }
+                    next_values, _ = self.value.act(inputs, role="value")
+                    next_values = self._value_preprocessor(next_values, inverse=True)
+
+                rewards += self.cfg.discount_factor * next_values * truncated
 
             # storage transition in memory
             self.memory.add_samples(
@@ -286,6 +297,7 @@ def record_transition(
                 actions=actions,
                 rewards=rewards,
                 terminated=terminated,
+                truncated=truncated,
                 log_prob=self._current_log_prob,
                 values=self._current_values,
             )
@@ -337,10 +349,12 @@ def update(self, *, timestep: int, timesteps: int) -> None:
         returns, advantages = compute_gae(
             rewards=self.memory.get_tensor_by_name("rewards"),
             terminated=self.memory.get_tensor_by_name("terminated"),
+            truncated=self.memory.get_tensor_by_name("truncated"),
             values=values,
-            next_values=last_values,
+            last_values=last_values,
             discount_factor=self.cfg.discount_factor,
             lambda_coefficient=self.cfg.gae_lambda,
+            time_limit_bootstrap=self.cfg.time_limit_bootstrap,
         )
 
         self.memory.set_tensor_by_name("values", self._value_preprocessor(values, train=True))
```

---

### Incident Patch 7: `6506eaed` (2026-05-03)
**Commit Message**: Set the random memory `replacement` argument to false by default (#436)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - Improving the robustness and learning capabilities of on-policy algorithms:
   - Sample data from memory using per-epoch mini-batch shuffling
   - Sum-reduce policy entropy to prevent collapse into near-deterministic stand still behavior
+- Set the random memory `replacement` argument to false by default
 
 ## [2.0.0] - 2026-04-08
 
```

**File**: `skrl/memories/jax/random.py` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ def __init__(
         export: bool = False,
         export_format: Literal["pt", "npz", "csv"] = "pt",
         export_directory: str = "",
-        replacement: bool = True,
+        replacement: bool = False,
     ) -> None:
         """Random sampling memory (sample a batch from memory randomly).
 
```

**File**: `skrl/memories/torch/random.py` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ def __init__(
         export: bool = False,
         export_format: Literal["pt", "npz", "csv"] = "pt",
         export_directory: str = "",
-        replacement: bool = True,
+        replacement: bool = False,
     ) -> None:
         """Random sampling memory (sample a batch from memory randomly).
 
```

**File**: `skrl/memories/warp/random.py` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ def __init__(
         export: bool = False,
         export_format: Literal["pt", "npz", "csv"] = "pt",
         export_directory: str = "",
-        replacement: bool = True,
+        replacement: bool = False,
     ) -> None:
         """Random sampling memory (sample a batch from memory randomly).
 
```

---

### Incident Patch 8: `22bb9dbd` (2026-04-03)
**Commit Message**: Fix setuptools package discovery (#421)

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -67,7 +67,7 @@ tests = [
 
 [tool.setuptools.packages.find]
 where = ["."]
-include = ["skrl"]
+include = ["skrl*"]
 
 
 [tool.black]
```

---

### Incident Patch 9: `5a078cff` (2026-01-15)
**Commit Message**: Add `render_interval` option to trainers to specify the rendering interval for the environments (#408)

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 - Add wrapper for ManiSkill environments
 - Add Tabular model instantiator (epsilon-greedy variant)
 - Add `clip_mean_actions` parameter to Gaussian and Multivariate Gaussian models
+- Add `render_interval` option to trainers to specify the rendering interval for the environments
 - Add `compute_space_limits` space utility to get Gymnasium spaces' limits
 - Add `ScopedTimer` utils to measure code execution time
 - Add `SummaryWriter` implementation to log data to TensorBoard without relying on third-party libraries
```

**File**: `examples/playground/jax_playground_cartpole_balance_ppo.py` (modified, +1/-1)
```diff
@@ -156,7 +156,7 @@ def __call__(self, inputs, role):
 
 
 # configure and instantiate the RL trainer
-cfg_trainer = {"timesteps": 16000, "headless": args.headless}
+cfg_trainer = {"timesteps": 16000, "headless": args.headless, "render_interval": 3}
 trainer = SequentialTrainer(cfg=cfg_trainer, env=env, agents=agent)
 
 if args.checkpoint:
```

**File**: `examples/playground/torch_playground_cartpole_balance_ppo.py` (modified, +1/-1)
```diff
@@ -150,7 +150,7 @@ def compute(self, inputs, role):
 
 
 # configure and instantiate the RL trainer
-cfg_trainer = {"timesteps": 16000, "headless": args.headless}
+cfg_trainer = {"timesteps": 16000, "headless": args.headless, "render_interval": 3}
 trainer = SequentialTrainer(cfg=cfg_trainer, env=env, agents=agent)
 
 if args.checkpoint:
```

**File**: `examples/playground/warp_playground_cartpole_balance_ppo.py` (modified, +1/-1)
```diff
@@ -153,7 +153,7 @@ def compute(self, inputs, role):
 
 
 # configure and instantiate the RL trainer
-cfg_trainer = {"timesteps": 16000, "headless": args.headless}
+cfg_trainer = {"timesteps": 16000, "headless": args.headless, "render_interval": 3}
 trainer = SequentialTrainer(cfg=cfg_trainer, env=env, agents=agent)
 
 if args.checkpoint:
```

**File**: `skrl/trainers/jax/base.py` (modified, +5/-2)
```diff
@@ -44,6 +44,9 @@ class TrainerCfg(ABC):
     headless: bool = False
     """Whether to run in headless mode (do not call ``env.render()``)."""
 
+    render_interval: int = 1
+    """Interval (in timesteps) for rendering the environments. Only effective if ``headless`` is False."""
+
     disable_progressbar: bool | None = False
     """Whether to disable the progressbar. If None, disable on non-TTY."""
 
@@ -214,7 +217,7 @@ def train(self) -> None:
                     self.agents.track_data("Stats / Env stepping time (ms)", timer.elapsed_time_ms)
 
                 # render the environments
-                if not self.cfg.headless:
+                if not self.cfg.headless and not timestep % self.cfg.render_interval:
                     self.env.render()
 
                 # record the environments' transitions
@@ -302,7 +305,7 @@ def eval(self) -> None:
                     self.agents.track_data("Stats / Env stepping time (ms)", timer.elapsed_time_ms)
 
                 # render the environments
-                if not self.cfg.headless:
+                if not self.cfg.headless and not timestep % self.cfg.render_interval:
                     self.env.render()
 
                 # record the environments' transitions
```

**File**: `skrl/trainers/jax/sequential.py` (modified, +2/-2)
```diff
@@ -113,7 +113,7 @@ def train(self) -> None:
                         agent.track_data("Stats / Env stepping time (ms)", elapsed_time_ms)
 
                 # render the environments
-                if not self.cfg.headless:
+                if not self.cfg.headless and not timestep % self.cfg.render_interval:
                     self.env.render()
 
                 # record the environments' transitions
@@ -204,7 +204,7 @@ def eval(self) -> None:
                         agent.track_data("Stats / Env stepping time (ms)", elapsed_time_ms)
 
                 # render the environments
-                if not self.cfg.headless:
+                if not self.cfg.headless and not timestep % self.cfg.render_interval:
                     self.env.render()
 
                 # write data to TensorBoard
```

**File**: `skrl/trainers/jax/step.py` (modified, +2/-2)
```diff
@@ -134,7 +134,7 @@ def train(
                     agent.track_data("Stats / Env stepping time (ms)", elapsed_time_ms)
 
             # render the environments
-            if not self.cfg.headless:
+            if not self.cfg.headless and not timestep % self.cfg.render_interval:
                 self.env.render()
 
             # record the environments' transitions
@@ -252,7 +252,7 @@ def eval(
                     agent.track_data("Stats / Env stepping time (ms)", elapsed_time_ms)
 
             # render the environments
-            if not self.cfg.headless:
+            if not self.cfg.headless and not timestep % self.cfg.render_interval:
                 self.env.render()
 
             # write data to TensorBoard
```

**File**: `skrl/trainers/torch/base.py` (modified, +5/-2)
```diff
@@ -45,6 +45,9 @@ class TrainerCfg(ABC):
     headless: bool = False
     """Whether to run in headless mode (do not call ``env.render()``)."""
 
+    render_interval: int = 1
+    """Interval (in timesteps) for rendering the environments. Only effective if ``headless`` is False."""
+
     disable_progressbar: bool | None = False
     """Whether to disable the progressbar. If None, disable on non-TTY."""
 
@@ -215,7 +218,7 @@ def train(self) -> None:
                     self.agents.track_data("Stats / Env stepping time (ms)", timer.elapsed_time_ms)
 
                 # render the environments
-                if not self.cfg.headless:
+                if not self.cfg.headless and not timestep % self.cfg.render_interval:
                     self.env.render()
 
                 # record the environments' transitions
@@ -309,7 +312,7 @@ def eval(self) -> None:
                     self.agents.track_data("Stats / Env stepping time (ms)", timer.elapsed_time_ms)
 
                 # render the environments
-                if not self.cfg.headless:
+                if not self.cfg.headless and not timestep % self.cfg.render_interval:
                     self.env.render()
 
                 # record the environments' transitions
```

---

### Incident Patch 10: `5b05f10f` (2025-12-27)
**Commit Message**: Fix the randomness of the environments by seeding right after initialization (on the first reset) (#406)

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
 ### Fixed
 - Add entropy loss to the policy loss for on-policy agents/mulit-agents in JAX
 - Fix time limits handling for termination and truncation signals
-- Fix the randomness of Gymnasium/Gym and PettingZoo environments by seeding right after initialization
+- Fix the randomness of the environments by seeding right after initialization (on the first reset)
 
 ### Removed
 - Remove NumPy backend for JAX implementation
```

**File**: `skrl/agents/warp/sac/sac.py` (modified, +2/-2)
```diff
@@ -470,7 +470,7 @@ def update(self, *, timestep: int, timesteps: int) -> None:
                 tape.zero()
 
                 # compute entropy coefficient
-                self._entropy_coefficient = np.exp(self.log_entropy_coefficient.numpy())
+                self._entropy_coefficient = np.exp(self.log_entropy_coefficient.numpy()).item()
 
             # update target networks
             self.target_critic_1.update_parameters(self.critic_1, polyak=self.cfg.polyak)
@@ -500,7 +500,7 @@ def update(self, *, timestep: int, timesteps: int) -> None:
 
             if self.cfg.learn_entropy:
                 self.track_data("Loss / Entropy loss", self._entropy_loss.numpy().item())
-                self.track_data("Coefficient / Entropy coefficient", self._entropy_coefficient.item())
+                self.track_data("Coefficient / Entropy coefficient", self._entropy_coefficient)
 
             if self.policy_scheduler:
                 self.track_data("Learning / Policy learning rate", self.policy_learning_rate)
```

**File**: `skrl/envs/wrappers/jax/isaaclab_envs.py` (modified, +14/-7)
```diff
@@ -18,7 +18,7 @@
 else:
     from skrl.utils.spaces.torch import flatten_tensorized_space, tensorize_space, unflatten_tensorized_space
 
-from skrl import logger
+from skrl import config, logger
 from skrl.envs.wrappers.jax.base import MultiAgentEnvWrapper, Wrapper
 
 
@@ -49,12 +49,15 @@ def __init__(self, env: Any) -> None:
         """
         super().__init__(env)
 
-        self._env_device = torch.device(self._unwrapped.device)
+        self._seed = np.asarray(jax.device_get(config.jax.key)).sum().item()
         self._reset_once = True
         self._observations = None
         self._states = None
         self._info = {}
 
+        if self._unwrapped:
+            self._env_device = torch.device(self._unwrapped.device)
+
     @property
     def state_space(self) -> gymnasium.Space | None:
         """State space."""
@@ -90,8 +93,7 @@ def step(self, actions: jax.Array) -> tuple[jax.Array, jax.Array, jax.Array, jax
 
         :return: Observation, reward, terminated, truncated, info.
         """
-        actions = _jax2torch(actions, self._env_device)
-        actions = unflatten_tensorized_space(self.action_space, actions)
+        actions = unflatten_tensorized_space(self.action_space, _jax2torch(actions, self._env_device))
 
         with torch.no_grad():
             observations, reward, terminated, truncated, self._info = self._env.step(actions)
@@ -126,14 +128,15 @@ def reset(self) -> tuple[jax.Array, dict[str, Any]]:
         :return: Observation, info.
         """
         if self._reset_once:
-            observations, self._info = self._env.reset()
+            observations, self._info = self._env.reset(seed=self._seed)
             self._observations = _torch2jax(
                 flatten_tensorized_space(tensorize_space(self.observation_space, observations["policy"]))
             )
             states = observations.get("critic", None)
             if states is not None:
                 self._states = _torch2jax(flatten_tensorized_space(tensorize_space(self.state_space, states)))
             self._reset_once = False
+            self._seed = None
         return self._observations, self._info
 
     def render(self, *args, **kwargs) -> None:
@@ -153,11 +156,14 @@ def __init__(self, env: Any) -> None:
         """
         super().__init__(env)
 
-        self._env_device = torch.device(self._unwrapped.device)
+        self._seed = np.asarray(jax.device_get(config.jax.key)).sum().item()
         self._reset_once = True
         self._observations = None
         self._info = {}
 
+        if self._unwrapped:
+            self._env_device = torch.device(self._unwrapped.device)
+
     def step(
         self, actions: dict[str, jax.Array]
     ) -> tuple[dict[str, jax.Array], dict[str, jax.Array], dict[str, jax.Array], dict[str, jax.Array], dict[str, Any]]:
@@ -191,13 +197,14 @@ def reset(self) -> tuple[dict[str, jax.Array], dict[str, Any]]:
         :return: Observation, info.
         """
         if self._reset_once:
-            observations, self._info = self._env.reset()
+            observations, self._info = self._env.reset(seed=self._seed)
             observations = {
                 k: flatten_tensorized_space(tensorize_space(self.observation_spaces[k], v))
                 for k, v in observations.items()
             }
             self._observations = {uid: _torch2jax(value) for uid, value in observations.items()}
             self._reset_once = False
+            self._seed = None
         return self._observations, self._info
 
     def state(self) -> dict[jax.Array | None]:
```

**File**: `skrl/envs/wrappers/jax/mani_skill_envs.py` (modified, +5/-5)
```diff
@@ -18,7 +18,7 @@
 else:
     from skrl.utils.spaces.torch import flatten_tensorized_space, tensorize_space, unflatten_tensorized_space
 
-from skrl import logger
+from skrl import config, logger
 from skrl.envs.wrappers.jax.base import Wrapper
 
 
@@ -49,6 +49,7 @@ def __init__(self, env: Any) -> None:
         """
         super().__init__(env)
 
+        self._seed = np.asarray(jax.device_get(config.jax.key)).sum().item()
         self._reset_once = True
         self._observations = None
         self._states = None
@@ -92,12 +93,10 @@ def step(self, actions: jax.Array) -> tuple[jax.Array, jax.Array, jax.Array, jax
 
         :return: Observation, reward, terminated, truncated, info.
         """
-        actions = _jax2torch(actions, self._env_device)
-        actions = unflatten_tensorized_space(self.action_space, actions)
+        actions = unflatten_tensorized_space(self.action_space, _jax2torch(actions, self._env_device))
 
         with torch.no_grad():
             observations, reward, terminated, truncated, self._info = self._env.step(actions)
-
             # auto-reset environments
             dones = (terminated | truncated).flatten()
             if dones.any():
@@ -129,11 +128,12 @@ def reset(self) -> tuple[jax.Array, dict[str, Any]]:
         :return: Observation, info.
         """
         if self._reset_once:
-            observations, self._info = self._env.reset()
+            observations, self._info = self._env.reset(seed=self._seed)
             self._observations = _torch2jax(
                 flatten_tensorized_space(tensorize_space(self.observation_space, observations))
             )
             self._reset_once = False
+            self._seed = None
         return self._observations, self._info
 
     def render(self, *args, **kwargs) -> None:
```

**File**: `skrl/envs/wrappers/torch/isaaclab_envs.py` (modified, +11/-4)
```diff
@@ -6,6 +6,7 @@
 
 import torch
 
+from skrl import config
 from skrl.envs.wrappers.torch.base import MultiAgentEnvWrapper, Wrapper
 from skrl.utils.spaces.torch import flatten_tensorized_space, tensorize_space, unflatten_tensorized_space
 
@@ -18,6 +19,7 @@ def __init__(self, env: Any) -> None:
         """
         super().__init__(env)
 
+        self._seed = config.torch.key
         self._reset_once = True
         self._observations = None
         self._states = None
@@ -59,7 +61,8 @@ def step(self, actions: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch
         :return: Observation, reward, terminated, truncated, info.
         """
         actions = unflatten_tensorized_space(self.action_space, actions)
-        observations, reward, terminated, truncated, self._info = self._env.step(actions)
+        with torch.no_grad():
+            observations, reward, terminated, truncated, self._info = self._env.step(actions)
         self._observations = flatten_tensorized_space(tensorize_space(self.observation_space, observations["policy"]))
         states = observations.get("critic", None)
         if states is not None:
@@ -79,14 +82,15 @@ def reset(self) -> tuple[torch.Tensor, dict[str, Any]]:
         :return: Observation, info.
         """
         if self._reset_once:
-            observations, self._info = self._env.reset()
+            observations, self._info = self._env.reset(seed=self._seed)
             self._observations = flatten_tensorized_space(
                 tensorize_space(self.observation_space, observations["policy"])
             )
             states = observations.get("critic", None)
             if states is not None:
                 self._states = flatten_tensorized_space(tensorize_space(self.state_space, states))
             self._reset_once = False
+            self._seed = None
         return self._observations, self._info
 
     def render(self, *args, **kwargs) -> None:
@@ -106,6 +110,7 @@ def __init__(self, env: Any) -> None:
         """
         super().__init__(env)
 
+        self._seed = config.torch.key
         self._reset_once = True
         self._observations = None
         self._info = {}
@@ -124,7 +129,8 @@ def step(self, actions: dict[str, torch.Tensor]) -> tuple[
         :return: Observation, reward, terminated, truncated, info.
         """
         actions = {k: unflatten_tensorized_space(self.action_spaces[k], v) for k, v in actions.items()}
-        observations, rewards, terminated, truncated, self._info = self._env.step(actions)
+        with torch.no_grad():
+            observations, rewards, terminated, truncated, self._info = self._env.step(actions)
         self._observations = {
             k: flatten_tensorized_space(tensorize_space(self.observation_spaces[k], v)) for k, v in observations.items()
         }
@@ -142,12 +148,13 @@ def reset(self) -> tuple[dict[str, torch.Tensor], dict[str, Any]]:
         :return: Observation, info.
         """
         if self._reset_once:
-            observations, self._info = self._env.reset()
+            observations, self._info = self._env.reset(seed=self._seed)
             self._observations = {
                 k: flatten_tensorized_space(tensorize_space(self.observation_spaces[k], v))
                 for k, v in observations.items()
             }
             self._reset_once = False
+            self._seed = None
         return self._observations, self._info
 
     def state(self) -> dict[str, torch.Tensor | None]:
```

**File**: `skrl/envs/wrappers/torch/mani_skill_envs.py` (modified, +11/-7)
```diff
@@ -6,6 +6,7 @@
 
 import torch
 
+from skrl import config
 from skrl.envs.wrappers.torch.base import Wrapper
 from skrl.utils.spaces.torch import flatten_tensorized_space, tensorize_space, unflatten_tensorized_space
 
@@ -18,6 +19,7 @@ def __init__(self, env: Any) -> None:
         """
         super().__init__(env)
 
+        self._seed = config.torch.key
         self._reset_once = True
         self._observations = None
         self._states = None
@@ -59,13 +61,14 @@ def step(self, actions: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch
         :return: Observation, reward, terminated, truncated, info.
         """
         actions = unflatten_tensorized_space(self.action_space, actions)
-        observations, reward, terminated, truncated, self._info = self._env.step(actions)
 
-        # auto-reset environments
-        dones = (terminated | truncated).flatten()
-        if dones.any():
-            env_idx = torch.arange(self.num_envs, device=dones.device)[dones]
-            observations, self._info = self._env.reset(options={"env_idx": env_idx})
+        with torch.no_grad():
+            observations, reward, terminated, truncated, self._info = self._env.step(actions)
+            # auto-reset environments
+            dones = (terminated | truncated).flatten()
+            if dones.any():
+                env_idx = torch.arange(self.num_envs, device=dones.device)[dones]
+                observations, self._info = self._env.reset(options={"env_idx": env_idx})
 
         self._observations = flatten_tensorized_space(tensorize_space(self.observation_space, observations))
         return self._observations, reward.view(-1, 1), terminated.view(-1, 1), truncated.view(-1, 1), self._info
@@ -83,9 +86,10 @@ def reset(self) -> tuple[torch.Tensor, dict[str, Any]]:
         :return: Observation, info.
         """
         if self._reset_once:
-            observations, self._info = self._env.reset()
+            observations, self._info = self._env.reset(seed=self._seed)
             self._observations = flatten_tensorized_space(tensorize_space(self.observation_space, observations))
             self._reset_once = False
+            self._seed = None
         return self._observations, self._info
 
     def render(self, *args, **kwargs) -> None:
```

**File**: `skrl/envs/wrappers/warp/isaaclab_envs.py` (modified, +18/-10)
```diff
@@ -11,8 +11,11 @@
     import torch
 except:
     pass  # TODO: show warning message
+else:
+    from skrl.utils.spaces.torch import flatten_tensorized_space, tensorize_space, unflatten_tensorized_space
+
+from skrl import config
 from skrl.envs.wrappers.warp.base import Wrapper
-from skrl.utils.spaces.warp import flatten_tensorized_space, tensorize_space, unflatten_tensorized_space
 
 
 class IsaacLabWrapper(Wrapper):
@@ -23,6 +26,7 @@ def __init__(self, env: Any) -> None:
         """
         super().__init__(env)
 
+        self._seed = config.warp.key
         self._reset_once = True
         self._observations = None
         self._states = None
@@ -63,15 +67,18 @@ def step(self, actions: wp.array) -> tuple[wp.array, wp.array, wp.array, wp.arra
 
         :return: Observation, reward, terminated, truncated, info.
         """
-        actions = unflatten_tensorized_space(self.action_space, actions)
+        actions = unflatten_tensorized_space(self.action_space, wp.to_torch(actions))
+
         with torch.no_grad():
-            observations, reward, terminated, truncated, self._info = self._env.step(wp.to_torch(actions))
-        self._observations = flatten_tensorized_space(
-            tensorize_space(self.observation_space, wp.from_torch(observations["policy"]))
+            observations, reward, terminated, truncated, self._info = self._env.step(actions)
+
+        self._observations = wp.from_torch(
+            flatten_tensorized_space(tensorize_space(self.observation_space, observations["policy"]))
         )
         states = observations.get("critic", None)
         if states is not None:
-            self._states = flatten_tensorized_space(tensorize_space(self.state_space, wp.from_torch(states)))
+            self._states = wp.from_torch(flatten_tensorized_space(tensorize_space(self.state_space, states)))
+
         return (
             self._observations,
             wp.from_torch(reward.view(-1, 1)),
@@ -93,14 +100,15 @@ def reset(self) -> tuple[wp.array, Any]:
         :return: Observation, info.
         """
         if self._reset_once:
-            observations, self._info = self._env.reset()
-            self._observations = flatten_tensorized_space(
-                tensorize_space(self.observation_space, wp.from_torch(observations["policy"]))
+            observations, self._info = self._env.reset(seed=self._seed)
+            self._observations = wp.from_torch(
+                flatten_tensorized_space(tensorize_space(self.observation_space, observations["policy"]))
             )
             states = observations.get("critic", None)
             if states is not None:
-                self._states = flatten_tensorized_space(tensorize_space(self.state_space, wp.from_torch(states)))
+                self._states = wp.from_torch(flatten_tensorized_space(tensorize_space(self.state_space, states)))
             self._reset_once = False
+            self._seed = None
         return self._observations, self._info
 
     def render(self, *args, **kwargs) -> None:
```

**File**: `skrl/envs/wrappers/warp/mani_skill_envs.py` (modified, +21/-15)
```diff
@@ -11,8 +11,11 @@
     import torch
 except:
     pass  # TODO: show warning message
+else:
+    from skrl.utils.spaces.torch import flatten_tensorized_space, tensorize_space, unflatten_tensorized_space
+
+from skrl import config
 from skrl.envs.wrappers.warp.base import Wrapper
-from skrl.utils.spaces.warp import flatten_tensorized_space, tensorize_space, unflatten_tensorized_space
 
 
 class ManiSkillWrapper(Wrapper):
@@ -23,6 +26,7 @@ def __init__(self, env: Any) -> None:
         """
         super().__init__(env)
 
+        self._seed = config.warp.key
         self._reset_once = True
         self._observations = None
         self._states = None
@@ -63,19 +67,20 @@ def step(self, actions: wp.array) -> tuple[wp.array, wp.array, wp.array, wp.arra
 
         :return: Observation, reward, terminated, truncated, info.
         """
-        actions = unflatten_tensorized_space(self.action_space, actions)
-        with torch.no_grad():
-            observations, reward, terminated, truncated, self._info = self._env.step(wp.to_torch(actions))
-
-        # auto-reset environments
-        dones = (terminated | truncated).flatten()
-        if dones.any():
-            env_idx = torch.arange(self.num_envs, device=dones.device)[dones]
-            observations, self._info = self._env.reset(options={"env_idx": env_idx})
+        actions = unflatten_tensorized_space(self.action_space, wp.to_torch(actions))
 
-        self._observations = flatten_tensorized_space(
-            tensorize_space(self.observation_space, wp.from_torch(observations))
+        with torch.no_grad():
+            observations, reward, terminated, truncated, self._info = self._env.step(actions)
+            # auto-reset environments
+            dones = (terminated | truncated).flatten()
+            if dones.any():
+                env_idx = torch.arange(self.num_envs, device=dones.device)[dones]
+                observations, self._info = self._env.reset(options={"env_idx": env_idx})
+
+        self._observations = wp.from_torch(
+            flatten_tensorized_space(tensorize_space(self.observation_space, observations))
         )
+
         return (
             self._observations,
             wp.from_torch(reward.view(-1, 1)),
@@ -97,11 +102,12 @@ def reset(self) -> tuple[wp.array, Any]:
         :return: Observation, info.
         """
         if self._reset_once:
-            observations, self._info = self._env.reset()
-            self._observations = flatten_tensorized_space(
-                tensorize_space(self.observation_space, wp.from_torch(observations))
+            observations, self._info = self._env.reset(seed=self._seed)
+            self._observations = wp.from_torch(
+                flatten_tensorized_space(tensorize_space(self.observation_space, observations))
             )
             self._reset_once = False
+            self._seed = None
         return self._observations, self._info
 
     def render(self, *args, **kwargs) -> None:
```

---

### Incident Patch 11: `8d8cbcb3` (2025-12-06)
**Commit Message**: Fix KL Adaptive learning rate scheduler detection when stepping the scheduler (#401)

**File**: `skrl/agents/jax/a2c/a2c.py` (modified, +9/-3)
```diff
@@ -175,12 +175,18 @@ def __init__(
             self.checkpoint_modules["value_optimizer"] = self.value_optimizer
             # - learning rate schedulers
             self.policy_scheduler = self.cfg.learning_rate_scheduler[0]
+            self.policy_scheduler_type = None
             if self.policy_scheduler is not None:
+                if "kladaptive" in self.policy_scheduler.__qualname__.lower().replace("_", ""):
+                    self.policy_scheduler_type = KLAdaptiveLR
                 self.policy_scheduler = self.cfg.learning_rate_scheduler[0](
                     **self.cfg.learning_rate_scheduler_kwargs[0]
                 )
             self.value_scheduler = self.cfg.learning_rate_scheduler[1]
+            self.value_scheduler_type = None
             if self.value_scheduler is not None:
+                if "kladaptive" in self.value_scheduler.__qualname__.lower().replace("_", ""):
+                    self.value_scheduler_type = KLAdaptiveLR
                 self.value_scheduler = self.cfg.learning_rate_scheduler[1](**self.cfg.learning_rate_scheduler_kwargs[1])
 
         # set up preprocessors
@@ -456,21 +462,21 @@ def update(self, *, timestep: int, timesteps: int) -> None:
 
         # update learning rate
         # - compute KL for KL adaptive learning rate scheduler
-        if self.policy_scheduler is KLAdaptiveLR or self.value_scheduler is KLAdaptiveLR:
+        if self.policy_scheduler_type is KLAdaptiveLR or self.value_scheduler_type is KLAdaptiveLR:
             kl = np.mean(kl_divergences)
             # reduce (collect from all workers/processes) KL in distributed runs
             if config.jax.is_distributed:
                 kl = jax.pmap(lambda x: jax.lax.psum(x, "i"), axis_name="i")(kl.reshape(1)).item()
                 kl /= config.jax.world_size
         # - policy learning rate
         if self.policy_scheduler:
-            if self.policy_scheduler is KLAdaptiveLR:
+            if self.policy_scheduler_type is KLAdaptiveLR:
                 self.policy_learning_rate = self.policy_scheduler(timestep, lr=self.policy_learning_rate, kl=kl)
             else:
                 self.policy_learning_rate *= self.policy_scheduler(timestep)
         # - value learning rate
         if self.value_scheduler:
-            if self.value_scheduler is KLAdaptiveLR:
+            if self.value_scheduler_type is KLAdaptiveLR:
                 self.value_learning_rate = self.value_scheduler(timestep, lr=self.value_learning_rate, kl=kl)
             else:
                 self.value_learning_rate *= self.value_scheduler(timestep)
```

**File**: `skrl/agents/jax/ppo/ppo.py` (modified, +9/-3)
```diff
@@ -190,12 +190,18 @@ def __init__(
             self.checkpoint_modules["value_optimizer"] = self.value_optimizer
             # - learning rate schedulers
             self.policy_scheduler = self.cfg.learning_rate_scheduler[0]
+            self.policy_scheduler_type = None
             if self.policy_scheduler is not None:
+                if "kladaptive" in self.policy_scheduler.__qualname__.lower().replace("_", ""):
+                    self.policy_scheduler_type = KLAdaptiveLR
                 self.policy_scheduler = self.cfg.learning_rate_scheduler[0](
                     **self.cfg.learning_rate_scheduler_kwargs[0]
                 )
             self.value_scheduler = self.cfg.learning_rate_scheduler[1]
+            self.value_scheduler_type = None
             if self.value_scheduler is not None:
+                if "kladaptive" in self.value_scheduler.__qualname__.lower().replace("_", ""):
+                    self.value_scheduler_type = KLAdaptiveLR
                 self.value_scheduler = self.cfg.learning_rate_scheduler[1](**self.cfg.learning_rate_scheduler_kwargs[1])
 
         # set up preprocessors
@@ -488,21 +494,21 @@ def update(self, *, timestep: int, timesteps: int) -> None:
 
             # update learning rate
             # - compute KL for KL adaptive learning rate scheduler
-            if self.policy_scheduler is KLAdaptiveLR or self.value_scheduler is KLAdaptiveLR:
+            if self.policy_scheduler_type is KLAdaptiveLR or self.value_scheduler_type is KLAdaptiveLR:
                 kl = np.mean(kl_divergences)
                 # reduce (collect from all workers/processes) KL in distributed runs
                 if config.jax.is_distributed:
                     kl = jax.pmap(lambda x: jax.lax.psum(x, "i"), axis_name="i")(kl.reshape(1)).item()
                     kl /= config.jax.world_size
             # - policy learning rate
             if self.policy_scheduler:
-                if self.policy_scheduler is KLAdaptiveLR:
+                if self.policy_scheduler_type is KLAdaptiveLR:
                     self.policy_learning_rate = self.policy_scheduler(timestep, lr=self.policy_learning_rate, kl=kl)
                 else:
                     self.policy_learning_rate *= self.policy_scheduler(timestep)
             # - value learning rate
             if self.value_scheduler:
-                if self.value_scheduler is KLAdaptiveLR:
+                if self.value_scheduler_type is KLAdaptiveLR:
                     self.value_learning_rate = self.value_scheduler(timestep, lr=self.value_learning_rate, kl=kl)
                 else:
                     self.value_learning_rate *= self.value_scheduler(timestep)
```

**File**: `skrl/agents/jax/rpo/rpo.py` (modified, +9/-3)
```diff
@@ -190,12 +190,18 @@ def __init__(
             self.checkpoint_modules["value_optimizer"] = self.value_optimizer
             # - learning rate schedulers
             self.policy_scheduler = self.cfg.learning_rate_scheduler[0]
+            self.policy_scheduler_type = None
             if self.policy_scheduler is not None:
+                if "kladaptive" in self.policy_scheduler.__qualname__.lower().replace("_", ""):
+                    self.policy_scheduler_type = KLAdaptiveLR
                 self.policy_scheduler = self.cfg.learning_rate_scheduler[0](
                     **self.cfg.learning_rate_scheduler_kwargs[0]
                 )
             self.value_scheduler = self.cfg.learning_rate_scheduler[1]
+            self.value_scheduler_type = None
             if self.value_scheduler is not None:
+                if "kladaptive" in self.value_scheduler.__qualname__.lower().replace("_", ""):
+                    self.value_scheduler_type = KLAdaptiveLR
                 self.value_scheduler = self.cfg.learning_rate_scheduler[1](**self.cfg.learning_rate_scheduler_kwargs[1])
 
         # set up preprocessors
@@ -492,21 +498,21 @@ def update(self, *, timestep: int, timesteps: int) -> None:
 
             # update learning rate
             # - compute KL for KL adaptive learning rate scheduler
-            if self.policy_scheduler is KLAdaptiveLR or self.value_scheduler is KLAdaptiveLR:
+            if self.policy_scheduler_type is KLAdaptiveLR or self.value_scheduler_type is KLAdaptiveLR:
                 kl = np.mean(kl_divergences)
                 # reduce (collect from all workers/processes) KL in distributed runs
                 if config.jax.is_distributed:
                     kl = jax.pmap(lambda x: jax.lax.psum(x, "i"), axis_name="i")(kl.reshape(1)).item()
                     kl /= config.jax.world_size
             # - policy learning rate
             if self.policy_scheduler:
-                if self.policy_scheduler is KLAdaptiveLR:
+                if self.policy_scheduler_type is KLAdaptiveLR:
                     self.policy_learning_rate = self.policy_scheduler(timestep, lr=self.policy_learning_rate, kl=kl)
                 else:
                     self.policy_learning_rate *= self.policy_scheduler(timestep)
             # - value learning rate
             if self.value_scheduler:
-                if self.value_scheduler is KLAdaptiveLR:
+                if self.value_scheduler_type is KLAdaptiveLR:
                     self.value_learning_rate = self.value_scheduler(timestep, lr=self.value_learning_rate, kl=kl)
                 else:
                     self.value_learning_rate *= self.value_scheduler(timestep)
```

**File**: `skrl/agents/warp/ppo/ppo.py` (modified, +5/-2)
```diff
@@ -12,6 +12,7 @@
 from skrl.memories.warp import Memory
 from skrl.models.warp import Model
 from skrl.resources.optimizers.warp import Adam
+from skrl.resources.schedulers.warp import KLAdaptiveLR
 from skrl.utils import ScopedTimer
 
 from .ppo_cfg import PPO_CFG
@@ -224,8 +225,10 @@ def __init__(
             # self.checkpoint_modules["optimizer"] = self.optimizer
             # - learning rate schedulers
             self.scheduler = self.cfg.learning_rate_scheduler[0]
+            self.scheduler_type = None
             if self.scheduler is not None:
-                self.scheduler_name = self.scheduler.__qualname__.lower()
+                if "kladaptive" in self.scheduler.__qualname__.lower().replace("_", ""):
+                    self.scheduler_type = KLAdaptiveLR
                 self.scheduler = self.cfg.learning_rate_scheduler[0](**self.cfg.learning_rate_scheduler_kwargs[0])
 
             # training variables
@@ -573,7 +576,7 @@ def update(self, *, timestep: int, timesteps: int) -> None:
 
             # update learning rate
             if self.scheduler:
-                if self.scheduler_name in ["kl_adaptive", "kladaptivelr"]:
+                if self.scheduler_type is KLAdaptiveLR:
                     kl = np.mean(kl_divergences)
                     self.learning_rate = self.scheduler(timestep, lr=self.learning_rate, kl=kl)
                 else:
```

**File**: `skrl/multi_agents/jax/ippo/ippo.py` (modified, +10/-3)
```diff
@@ -176,6 +176,7 @@ def __init__(
         # set up optimizer and learning rate scheduler
         self.policy_optimizer, self.value_optimizer = {}, {}
         self.policy_scheduler, self.value_scheduler = {}, {}
+        self.policy_scheduler_type, self.value_scheduler_type = {}, {}
         self.policy_learning_rate, self.value_learning_rate = {}, {}
         for uid in self.possible_agents:
             if self.policies[uid] is not None and self.values[uid] is not None:
@@ -198,12 +199,18 @@ def __init__(
                 self.checkpoint_modules[uid]["value_optimizer"] = self.value_optimizer[uid]
                 # - learning rate schedulers
                 self.policy_scheduler[uid] = self.cfg.learning_rate_scheduler[uid][0]
+                self.policy_scheduler_type[uid] = None
                 if self.policy_scheduler[uid] is not None:
+                    if "kladaptive" in self.policy_scheduler[uid].__qualname__.lower().replace("_", ""):
+                        self.policy_scheduler_type[uid] = KLAdaptiveLR
                     self.policy_scheduler[uid] = self.cfg.learning_rate_scheduler[uid][0](
                         **self.cfg.learning_rate_scheduler_kwargs[uid][0]
                     )
                 self.value_scheduler[uid] = self.cfg.learning_rate_scheduler[uid][1]
+                self.value_scheduler_type[uid] = None
                 if self.value_scheduler[uid] is not None:
+                    if "kladaptive" in self.value_scheduler[uid].__qualname__.lower().replace("_", ""):
+                        self.value_scheduler_type[uid] = KLAdaptiveLR
                     self.value_scheduler[uid] = self.cfg.learning_rate_scheduler[uid][1](
                         **self.cfg.learning_rate_scheduler_kwargs[uid][1]
                     )
@@ -528,23 +535,23 @@ def update(self, *, timestep: int, timesteps: int, uid: str) -> None:
 
             # update learning rate
             # - compute KL for KL adaptive learning rate scheduler
-            if self.policy_scheduler is KLAdaptiveLR or self.value_scheduler is KLAdaptiveLR:
+            if self.policy_scheduler_type[uid] is KLAdaptiveLR or self.value_scheduler_type[uid] is KLAdaptiveLR:
                 kl = np.mean(kl_divergences)
                 # reduce (collect from all workers/processes) KL in distributed runs
                 if config.jax.is_distributed:
                     kl = jax.pmap(lambda x: jax.lax.psum(x, "i"), axis_name="i")(kl.reshape(1)).item()
                     kl /= config.jax.world_size
             # - policy learning rate
             if self.policy_scheduler[uid]:
-                if self.policy_scheduler[uid] is KLAdaptiveLR:
+                if self.policy_scheduler_type[uid] is KLAdaptiveLR:
                     self.policy_learning_rate[uid] = self.policy_scheduler[uid](
                         timestep, lr=self.policy_learning_rate[uid], kl=kl
                     )
                 else:
                     self.policy_learning_rate[uid] *= self.policy_scheduler[uid](timestep)
             # - value learning rate
             if self.value_scheduler[uid]:
-                if self.value_scheduler[uid] is KLAdaptiveLR:
+                if self.value_scheduler_type[uid] is KLAdaptiveLR:
                     self.value_learning_rate[uid] = self.value_scheduler[uid](
                         timestep, lr=self.value_learning_rate[uid], kl=kl
                     )
```

**File**: `skrl/multi_agents/jax/mappo/mappo.py` (modified, +10/-3)
```diff
@@ -177,6 +177,7 @@ def __init__(
         # set up optimizer and learning rate scheduler
         self.policy_optimizer, self.value_optimizer = {}, {}
         self.policy_scheduler, self.value_scheduler = {}, {}
+        self.policy_scheduler_type, self.value_scheduler_type = {}, {}
         self.policy_learning_rate, self.value_learning_rate = {}, {}
         for uid in self.possible_agents:
             if self.policies[uid] is not None and self.values[uid] is not None:
@@ -199,12 +200,18 @@ def __init__(
                 self.checkpoint_modules[uid]["value_optimizer"] = self.value_optimizer[uid]
                 # - learning rate schedulers
                 self.policy_scheduler[uid] = self.cfg.learning_rate_scheduler[uid][0]
+                self.policy_scheduler_type[uid] = None
                 if self.policy_scheduler[uid] is not None:
+                    if "kladaptive" in self.policy_scheduler[uid].__qualname__.lower().replace("_", ""):
+                        self.policy_scheduler_type[uid] = KLAdaptiveLR
                     self.policy_scheduler[uid] = self.cfg.learning_rate_scheduler[uid][0](
                         **self.cfg.learning_rate_scheduler_kwargs[uid][0]
                     )
                 self.value_scheduler[uid] = self.cfg.learning_rate_scheduler[uid][1]
+                self.value_scheduler_type[uid] = None
                 if self.value_scheduler[uid] is not None:
+                    if "kladaptive" in self.value_scheduler[uid].__qualname__.lower().replace("_", ""):
+                        self.value_scheduler_type[uid] = KLAdaptiveLR
                     self.value_scheduler[uid] = self.cfg.learning_rate_scheduler[uid][1](
                         **self.cfg.learning_rate_scheduler_kwargs[uid][1]
                     )
@@ -529,23 +536,23 @@ def update(self, *, timestep: int, timesteps: int, uid: str) -> None:
 
             # update learning rate
             # - compute KL for KL adaptive learning rate scheduler
-            if self.policy_scheduler is KLAdaptiveLR or self.value_scheduler is KLAdaptiveLR:
+            if self.policy_scheduler_type[uid] is KLAdaptiveLR or self.value_scheduler_type[uid] is KLAdaptiveLR:
                 kl = np.mean(kl_divergences)
                 # reduce (collect from all workers/processes) KL in distributed runs
                 if config.jax.is_distributed:
                     kl = jax.pmap(lambda x: jax.lax.psum(x, "i"), axis_name="i")(kl.reshape(1)).item()
                     kl /= config.jax.world_size
             # - policy learning rate
             if self.policy_scheduler[uid]:
-                if self.policy_scheduler[uid] is KLAdaptiveLR:
+                if self.policy_scheduler_type[uid] is KLAdaptiveLR:
                     self.policy_learning_rate[uid] = self.policy_scheduler[uid](
                         timestep, lr=self.policy_learning_rate[uid], kl=kl
                     )
                 else:
                     self.policy_learning_rate[uid] *= self.policy_scheduler[uid](timestep)
             # - value learning rate
             if self.value_scheduler[uid]:
-                if self.value_scheduler[uid] is KLAdaptiveLR:
+                if self.value_scheduler_type[uid] is KLAdaptiveLR:
                     self.value_learning_rate[uid] = self.value_scheduler[uid](
                         timestep, lr=self.value_learning_rate[uid], kl=kl
                     )
```

**File**: `skrl/resources/noises/jax/gaussian.py` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 @partial(jax.jit, static_argnames=("shape"))
 def _sample(mean, std, key, iterator, shape):
     subkey = jax.random.fold_in(key, iterator)
-    return jax.random.normal(subkey, shape) * std + mean
+    return 2.0 * jax.random.normal(subkey, shape) * std + mean
 
 
 class GaussianNoise(Noise):
```

**File**: `skrl/resources/noises/jax/ornstein_uhlenbeck.py` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 @partial(jax.jit, static_argnames=("shape"))
 def _sample(theta, sigma, state, mean, std, key, iterator, shape):
     subkey = jax.random.fold_in(key, iterator)
-    return state * theta + sigma * (jax.random.normal(subkey, shape) * std + mean)
+    return state * theta + sigma * (2.0 * jax.random.normal(subkey, shape) * std + mean)
 
 
 class OrnsteinUhlenbeckNoise(Noise):
```

---

### Incident Patch 12: `2b935217` (2025-10-15)
**Commit Message**: Add support for running job for latest requirements manually

**File**: `.github/workflows/tests-jax.yml` (modified, +4/-3)
```diff
@@ -10,6 +10,7 @@ on:
     paths: [ 'skrl/**', 'tests/**' ]
   schedule:
     - cron: "9 9 * * 6"  # every Saturday at 9:09 UTC
+  workflow_dispatch:
 
 defaults:
   run:
@@ -24,7 +25,7 @@ jobs:
   jax-minimum-components:
     name: Minimum requirements (components)
     runs-on: ubuntu-22.04
-    if: github.event.pull_request.draft == false
+    if: github.event.pull_request.draft == false && github.event_name != 'workflow_dispatch'
     steps:
     # setup
     - uses: actions/checkout@v4
@@ -76,7 +77,7 @@ jobs:
   jax-minimum-envs:
     name: Minimum requirements (envs)
     runs-on: ubuntu-22.04
-    if: github.event.pull_request.draft == false
+    if: github.event.pull_request.draft == false && github.event_name != 'workflow_dispatch'
     steps:
     # setup
     - uses: actions/checkout@v4
@@ -127,7 +128,7 @@ jobs:
   jax-minimum-utils:
     name: Minimum requirements (utils)
     runs-on: ubuntu-22.04
-    if: github.event.pull_request.draft == false
+    if: github.event.pull_request.draft == false && github.event_name != 'workflow_dispatch'
     steps:
     # setup
     - uses: actions/checkout@v4
```

**File**: `.github/workflows/tests-torch.yml` (modified, +4/-3)
```diff
@@ -10,6 +10,7 @@ on:
     paths: [ 'skrl/**', 'tests/**' ]
   schedule:
     - cron: "9 9 * * 6"  # every Saturday at 9:09 UTC
+  workflow_dispatch:
 
 defaults:
   run:
@@ -24,7 +25,7 @@ jobs:
   torch-minimum-components:
     name: Minimum requirements (components)
     runs-on: ubuntu-22.04
-    if: github.event.pull_request.draft == false
+    if: github.event.pull_request.draft == false && github.event_name != 'workflow_dispatch'
     steps:
     # setup
     - uses: actions/checkout@v4
@@ -76,7 +77,7 @@ jobs:
   torch-minimum-envs:
     name: Minimum requirements (envs)
     runs-on: ubuntu-22.04
-    if: github.event.pull_request.draft == false
+    if: github.event.pull_request.draft == false && github.event_name != 'workflow_dispatch'
     steps:
     # setup
     - uses: actions/checkout@v4
@@ -131,7 +132,7 @@ jobs:
   torch-minimum-utils:
     name: Minimum requirements (utils)
     runs-on: ubuntu-22.04
-    if: github.event.pull_request.draft == false
+    if: github.event.pull_request.draft == false && github.event_name != 'workflow_dispatch'
     steps:
     # setup
     - uses: actions/checkout@v4
```

**File**: `.github/workflows/tests-warp.yml` (modified, +4/-3)
```diff
@@ -10,6 +10,7 @@ on:
     paths: [ 'skrl/**', 'tests/**' ]
   schedule:
     - cron: "9 9 * * 6"  # every Saturday at 9:09 UTC
+  workflow_dispatch:
 
 defaults:
   run:
@@ -24,7 +25,7 @@ jobs:
   warp-minimum-components:
     name: Minimum requirements (components)
     runs-on: ubuntu-22.04
-    if: github.event.pull_request.draft == false
+    if: github.event.pull_request.draft == false && github.event_name != 'workflow_dispatch'
     steps:
     # setup
     - uses: actions/checkout@v4
@@ -76,7 +77,7 @@ jobs:
   warp-minimum-envs:
     name: Minimum requirements (envs)
     runs-on: ubuntu-22.04
-    if: github.event.pull_request.draft == false
+    if: github.event.pull_request.draft == false && github.event_name != 'workflow_dispatch'
     steps:
     # setup
     - uses: actions/checkout@v4
@@ -112,7 +113,7 @@ jobs:
   warp-minimum-utils:
     name: Minimum requirements (utils)
     runs-on: ubuntu-22.04
-    if: github.event.pull_request.draft == false
+    if: github.event.pull_request.draft == false && github.event_name != 'workflow_dispatch'
     steps:
     # setup
     - uses: actions/checkout@v4
```

---

### Incident Patch 13: `c581ec3f` (2025-10-11)
**Commit Message**: Apply training __str__ fixing to jax and warp implementations

**File**: `skrl/trainers/jax/base.py` (modified, +1/-1)
```diff
@@ -111,7 +111,7 @@ def __str__(self) -> str:
 
         :return: Representation of the trainer as string.
         """
-        string = f"Trainer: {self}"
+        string = f"Trainer: {type(self).__name__}"
         string += f"\n  |-- Number of parallelizable environments: {self.env.num_envs}"
         string += f"\n  |-- Number of simultaneous agents: {self.num_simultaneous_agents}"
         string += "\n  |-- Agents and scopes:"
```

**File**: `skrl/trainers/warp/base.py` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ def __str__(self) -> str:
 
         :return: Representation of the trainer as string.
         """
-        string = f"Trainer: {self}"
+        string = f"Trainer: {type(self).__name__}"
         string += f"\n  |-- Number of parallelizable environments: {self.env.num_envs}"
         string += f"\n  |-- Number of simultaneous agents: {self.num_simultaneous_agents}"
         string += "\n  |-- Agents and scopes:"
```

---

### Incident Patch 14: `735df49b` (2025-09-29)
**Commit Message**: Fix torch/jax-minimum-envs

**File**: `.github/workflows/tests-jax.yml` (modified, +1/-1)
```diff
@@ -111,7 +111,7 @@ jobs:
         pytest tests/envs/wrappers/jax/test_pettingzoo_envs.py
     - name: Run tests (Brax)
       run: |
-        python -m pip install --quiet brax==0.9.3 mujoco==3.0.0
+        python -m pip install --quiet brax==0.12.0 mujoco==3.2.6
         python -m pip list
         pytest tests/envs/wrappers/jax/test_brax_envs.py
     - name: Run tests (Isaac Lab)
```

**File**: `.github/workflows/tests-torch.yml` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ jobs:
         pytest tests/envs/wrappers/torch/test_deepmind_envs.py
     - name: Run tests (Brax)
       run: |
-        python -m pip install --quiet brax==0.9.3 mujoco==3.0.0
+        python -m pip install --quiet brax==0.12.0 mujoco==3.2.6
         python -m pip list
         pytest tests/envs/wrappers/torch/test_brax_envs.py
 
```

---

### Incident Patch 15: `603fbc71` (2025-09-29)
**Commit Message**: Fix torch-minimum-utils

**File**: `tests/utils/model_instantiators/torch/test_models.py` (modified, +1/-1)
```diff
@@ -417,7 +417,7 @@ def test_tabular_model(capsys, device):
     model.to(device=config.torch.parse_device(device))
 
     inputs = _sample_inputs("OBSERVATIONS", observation_space, device)
-    inputs["observations"] = inputs["observations"].to(dtype=torch.int32)
+    inputs["observations"] = inputs["observations"].to(dtype=torch.int64)
     output = model.act(inputs)
     assert len(output) == 2
     assert output[0].shape == (10, 1)
```

#### Recent Merged Pull Requests:
- **PR #462** (2026-10-01): Fix Warp-implementation bugs (@Toni-SM)
- **PR #461** (closed): Preserve discrete space metadata during Gym conversion (@betacatsling)
- **PR #459** (closed): Retain remainder transitions when sampling all memory (@betacatsling)
- **PR #457** (2026-09-14): Preserve existing replay tensors when adding fields (@betacatsling)
- **PR #455** (closed): Reset multi-agent environments after the last agent finishes (@betacatsling)
- **PR #454** (closed): Advance space random state when sampling batches (@betacatsling)
- **PR #452** (2026-09-10): Fix JAX's test minimum requirements for Gymnasium environments (@Toni-SM)
- **PR #444** (closed): Fix reward tracking double-mean: record per-episode stats only on episode completion (@darshmenon)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
