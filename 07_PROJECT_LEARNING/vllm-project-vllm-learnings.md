# Forensic Learning Record (Deep Inspection): vllm-project/vllm

> **Canonical Artifact**: `07_PROJECT_LEARNING/vllm-project-vllm-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/vllm-project/vllm](https://github.com/vllm-project/vllm))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:21:00.873Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `vllm-project/vllm`
- **Description**: A high-throughput and memory-efficient inference and serving engine for LLMs
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 93219 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/benchmark_hidden_state_extraction.py`
```
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
"""Benchmark hidden state extraction throughput.

Measures two modes:
  1. Baseline: bulk inference with max_tokens=1, no extraction.
  2. Extract:  async hidden state extraction via ExampleHiddenStatesConnector
               with N concurrent clients, each consuming hidden states as
               soon as their request finishes (overlapping I/O with generation).

Reports tokens/s and prompts/s for each mode.

Usage:
  python benchmarks/benchmark_hidden_state_extraction.py \
      --model Qwen/Qwen3-0.6B \
      --num-prompts 64 \
      --num-clients 8 \
      --prompt-len 8192 \
      --layers 1 2 3 4
"""

import argparse
import asyncio
import time
from concurrent.futures import ThreadPoolExecutor

import torch
from transformers import AutoConfig

from vllm import LLM, SamplingParams
from vllm.config.kv_transfer import KVTransferConfig
from vllm.distributed.kv_transfer.kv_connector.v1 import (
    example_hidden_states_connector,
)
from vllm.engine.arg_utils import AsyncEngineArgs
from vllm.sampling_params import RequestOutputKind
from vllm.v1.engine.async_llm import AsyncLLM


def _make_profiler_config(profile_dir: str) -> dict:
    """Build a profiler_config dict for torch profiling."""
    return {
        "profiler": "torch",
        "torch_profiler_dir": profile_dir,
        "torch_profiler_with_stack": True,
    }


def make_random_prompts(
    num_prompts: int, prompt_len: int, vocab_size: int, seed: int = 42
) -> list[list[int]]:
    """Generate lists of random token IDs."""
    # Set seed for reproducibility
    torch.manual_seed(seed)
    return [
        torch.randint(0, vocab_size, (prompt_len,)).tolist() for _ in range(num_prompts)
    ]


def consume_hidden_states(path: str) -> float:
    """Load hidden states from disk and compute per-position mean.

    Returns a single float: the grand mean of all hidden state values.
    This forces the benchmark to actually read and reduce the data.

    Uses :func:`load_hidden_states` which acquires a shared flock,
    blocking (without polling) until the async writer releases its
    exclusive lock.
    """
    obj = example_hidden_states_connector.load_hidden_states(path)
    hs = obj["hidden_states"]
    total = hs.mean().item()

    example_hidden_states_connector.cleanup_hidden_states(path)

    return total


def run_baseline(
    model: str,
    prompts: list[list[int]],
    extra_args: dict,
    profile_dir: str | None = None,
) -> dict:
    """Baseline: bulk inference, no hidden state extraction."""
    if profile_dir:
        extra_args = {
            **extra_args,
            "profiler_config": _make_profiler_config(profile_dir),
        }
    llm = LLM(
        model=model,
        enable_prefix_caching=False,
        **extra_args,
    )
    sampling_params = SamplingParams(max_tokens=1)
    prompt_inputs = [{"prompt_token_ids": p} for p in prompts]

    # Warmup
    llm.generate(prompt_inputs[:4], sampling_params, use_tqdm=False)

    if profile_dir:
        llm.start_profile()

    t0 = time.perf_counter()
    outputs = llm.generate(prompt_inputs, sampling_params, use_tqdm=True)
    elapsed = time.perf_counter() - t0

    if profile_dir:
        llm.stop_profile()

    total_prompt_tokens = sum(len(o.prompt_token_ids) for o in outputs)
    num_prompts = len(outputs)

    del llm
    torch.accelerator.empty_cache()

    return {
        "mode": "baseline",
        "elapsed_s": elapsed,
        "num_prompts": num_prompts,
        "total_prompt_tokens": total_prompt_tokens,
        "tokens_per_s": total_prompt_tokens / elapsed,
        "prompts_per_s": num_prompts / elapsed,
    }


# ---- Async extraction benchmark ----


async def _client_loop(
    engine: AsyncLLM,
    prompt_queue: asyncio.Queue,
    consume_pool: ThreadPoolExecutor,
    results: list[dict],
    client_id: int,
):
    """A single async client: pulls prompts, submits to engine, consumes
    hidden states as soon as each request finishes."""
    loop = asyncio.get_event_loop()
    while True:
        item = await prompt_queue.get()
        if item is None:
            prompt_queue.task_done()
            break
        idx, token_ids = item

        request_id = f"req-{idx}"
        sampling_params = SamplingParams(
            max_tokens=1,
            output_kind=RequestOutputKind.FINAL_ONLY,
        )

        final_output = None
        async for output in engine.generate(
            request_id=request_id,
            prompt={"prompt_token_ids": token_ids},
            sampling_params=sampling_params,
        ):
            if output.finished:
                final_output = output

        # Consume hidden states on a thread (disk I/O)
        path = final_output.kv_transfer_params["hidden_states_path"]
        mean_val = await loop.run_in_executor(consume_pool, consume_hidden_states, path)
        num_tokens = len(final_output.prompt_token_ids)

        results.append(
            {
                "request_id": request_id,
                "num_prompt_tokens": num_tokens,
                "mean_hidden_value": mean_val,
            }
        )
        prompt_queue.task_done()


async def _run_extraction_async(
    model: str,
    prompts: list[list[int]],
    num_clients: int,
    layers: list[int],
    tmpdir: str,
    extra_args: dict,
    profile_dir: str | None = None,
) -> dict:
    if profile_dir:
        extra_args = {
            **extra_args,
            "profiler_config": _make_profiler_config(profile_dir),
        }
    engine_args = AsyncEngineArgs(
        model=model,
        enable_prefix_caching=False,
        max_num_batched_tokens=40960,
        max_model_len=40960,
        speculative_config={
            "method": "extract_hidden_states",
            "num_speculative_tokens": 1,
            "draft_model_config": {
                "hf_config": {
                    "eagle_aux_hidden_state_layer_ids": layers,
                },
            },
        },
        kv_transfer_config=KVTransferConfig(
            kv_connector="ExampleHiddenStatesConnector",
            kv_role="kv_producer",
            kv_connector_extra_config={
                "shared_storage_path": tmpdir,
            },
        ),
        **extra_args,
    )
    engine = AsyncLLM.from_engine_args(engine_args)

    try:
        # Warmup: run a few prompts sequentially, cleaning up generated files
        for i in range(min(4, len(prompts))):
            sp = SamplingParams(max_tokens=1, output_kind=RequestOutputKind.FINAL_ONLY)
            final_output = None
            async for output in engine.generate(
                request_id=f"warmup-{i}",
                prompt={"prompt_token_ids": prompts[i]},
                sampling_params=sp,
            ):
                if output.finished:
                    final_output = output
            if final_output and final_output.kv_transfer_params:
                path = final_output.kv_transfer_params.get("hidden_states_path")
                if path:
                    example_hidden_states_connector.cleanup_hidden_states(path)

        if profile_dir:
            await engine.start_profile()

        # Fill prompt queue
        prompt_queue: asyncio.Queue = asyncio.Queue()
        for idx, token_ids in enumerate(prompts):
            prompt_queue.put_nowait((idx, token_ids))
        # Sentinel per client
        for _ in range(num_clients):
            prompt_queue.put_nowait(None)

        results: list[dict] = []
        consume_pool = ThreadPoolExecutor(max_workers=num_clients)

        t0 = time.perf_counter()
        tasks = [
            asyncio.create_task(
                _client_loop(engine, prompt_queue, consume_pool, results, i)
            )
            for i in range(num_clients)
        ]
        await asyncio.gather(*tasks)
        elapsed = time.perf_counter() - t0

        consume_pool.shutdown(wait=True)

        if profile_dir:
            await engine.stop_profile()

        total_prompt_tokens = sum(r["num_prompt_tokens"] for r in results)
        num_prompts = len(results)
        mean_hidden = sum(r["mean_hidden_value"] for r in results) / max(
            len(results), 1
        )

        return {
            "mode": "extract",
            "elapsed_s": elapsed,
            "num_prompts": num_prompts,
            "total_prompt_tokens": total_prompt_tokens,
            "tokens_per_s": total_prompt_tokens / elapsed,
            "prompts_per_s": num_prompts / elapsed,
            "mean_hidden_value": mean_hidden,
        }
    finally:
        engine.shutdown()


def run_extraction(
    model: str,
    prompts: list[list[int]],
    num_clients: int,
    layers: list[int],
    extra_args: dict,
    profile_dir: str | None = None,
) -> dict:
    return asyncio.run(
        _run_extraction_async(
            model,
            prompts,
            num_clients,
            layers,
            "/dev/shm",
            extra_args,
            profile_dir=profile_dir,
        )
    )


def print_results(results: dict):
    mode = results["mode"]
    print(f"\n{'=' * 60}")
    print(f"  {mode.upper()} RESULTS")
    print(f"{'=' * 60}")
    print(f"  Prompts:             {results['num_prompts']}")
    print(f"  Total prompt tokens: {results['total_prompt_tokens']:,}")
    print(f"  Wall time:           {results['elapsed_s']:.2f}s")
    print(f"  Tokens/s:            {results['tokens_per_s']:,.0f}")
    print(f"  Prompts/s:           {results['prompts_per_s']:.2f}")
    if mode == "extract":
        print(f"  Mean hidden value:   {results['mean_hidden_value']:.6f}")
    print(f"{'=' * 60}\n")


def main():
    parser = argparse.ArgumentParser(
        description="Benchmark hidden state extraction throughput"
    )
    parser.add_argument("--model", type=str, required=True)
    parser.add_argument("--num-prompts", type=int, default=64)
    parser.add_argument("--num-clients", type=int, default=8)
    parser.add_argument("
```

### Core Architecture Module: `benchmarks/benchmark_utils.py`
```
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
import time
from types import TracebackType


# Collect time and generate time metrics
#
# Example Usage:
#   collector = TimeCollector(TimeCollector.US)
#   for _ in range(total_iteration):
#      with collector:
#          ...
#   collector.dump_avg_max()
class TimeCollector:
    NS: int = 1
    US: int = NS * 1000
    MS: int = US * 1000
    S: int = MS * 1000

    def __init__(self, scale: int) -> None:
        self.cnt: int = 0
        self._sum: int = 0
        self._max: int | None = None
        self.scale = scale
        self.start_time: int = time.monotonic_ns()

    def collect(self, v: int) -> None:
        self.cnt += 1
        self._sum += v
        if self._max is None:
            self._max = v
        else:
            self._max = max(self._max, v)

    def avg(self) -> float | str:
        return self._sum * 1.0 / self.cnt / self.scale if self.cnt > 0 else "N/A"

    def max(self) -> float | str:
        return self._max / self.scale if self._max else "N/A"

    def dump_avg_max(self) -> list[float | str]:
        return [self.avg(), self.max()]

    def __enter__(self) -> None:
        self.start_time = time.monotonic_ns()

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        exc_traceback: TracebackType | None,
    ) -> None:
        self.collect(time.monotonic_ns() - self.start_time)

```

### Core Architecture Module: `benchmarks/fused_kernels/merge_attn_states_benchmarks.py`
```
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
"""Benchmark: Fused FP8 output quantization in merge_attn_states.

Compares fused vs unfused approaches for producing FP8-quantized merged
attention output:
  1. Fused CUDA     -- single CUDA kernel (merge + FP8 quant)
  2. Fused Triton   -- single Triton kernel (merge + FP8 quant)
  3. Unfused CUDA   -- CUDA merge + torch.compiled FP8 quant
  4. Unfused Triton  -- Triton merge + torch.compiled FP8 quant

Usage:
    python benchmarks/fused_kernels/merge_attn_states_benchmarks.py
    python benchmarks/fused_kernels/merge_attn_states_benchmarks.py --tp 1 4 8
    python benchmarks/fused_kernels/merge_attn_states_benchmarks.py --dtype bfloat16
"""

import argparse
import itertools

import torch

from vllm._custom_ops import merge_attn_states as merge_attn_states_cuda
from vllm.benchmarks.lib.utils import default_vllm_config
from vllm.model_executor.layers.quantization.input_quant_fp8 import QuantFP8
from vllm.model_executor.layers.quantization.utils.quant_utils import GroupShape
from vllm.platforms import current_platform
from vllm.triton_utils import triton
from vllm.v1.attention.ops.triton_merge_attn_states import (
    merge_attn_states as merge_attn_states_triton,
)

# ---------------------------------------------------------------------------
# Configuration defaults
# ---------------------------------------------------------------------------

NUM_TOKENS_LIST = [1, 16, 64, 256, 1024, 4096]

# (label, num_heads, head_size) — num_heads is for TP=1
HEAD_CONFIGS = [
    ("DeepSeek-V3 MLA", 128, 128),
    ("Llama-70B", 64, 128),
    ("Llama-8B", 32, 128),
]

TP_SIZES = [1, 2, 4, 8]

INPUT_DTYPES = [torch.float32, torch.float16, torch.bfloat16]

QUANTILES = [0.5, 0.2, 0.8]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def short_dtype(dtype: torch.dtype) -> str:
    return str(dtype).removeprefix("torch.")


def make_inputs(
    num_tokens: int,
    num_heads: int,
    head_size: int,
    dtype: torch.dtype,
):
    """Create random prefix/suffix outputs and LSEs."""
    prefix_output = torch.randn(
        (num_tokens, num_heads, head_size), dtype=dtype, device="cuda"
    )
    suffix_output = torch.randn(
        (num_tokens, num_heads, head_size), dtype=dtype, device="cuda"
    )
    prefix_lse = torch.randn(num_heads, num_tokens, dtype=torch.float32, device="cuda")
    suffix_lse = torch.randn(num_heads, num_tokens, dtype=torch.float32, device="cuda")
    # Sprinkle some inf values to exercise edge-case paths
    mask = torch.rand(num_heads, num_tokens, device="cuda") < 0.05
    prefix_lse[mask] = float("inf")
    mask2 = torch.rand(num_heads, num_tokens, device="cuda") < 0.05
    suffix_lse[mask2] = float("inf")
    return prefix_output, suffix_output, prefix_lse, suffix_lse


def build_configs(head_configs, num_tokens_list, input_dtypes, tp_sizes):
    """Build (num_tokens, num_heads, head_size, dtype_str) config tuples,
    applying TP division to num_heads and skipping invalid combos."""
    configs = []
    for (_, nh, hs), nt, dtype, tp in itertools.product(
        head_configs, num_tokens_list, input_dtypes, tp_sizes
    ):
        nh_tp = nh // tp
        if nh_tp >= 1:
            configs.append((nt, nh_tp, hs, short_dtype(dtype)))
    return configs


def parse_args():
    parser = argparse.ArgumentParser(
        description="Benchmark merge_attn_states fused FP8 quantization"
    )
    parser.add_argument(
        "--num-tokens",
        type=int,
        nargs="+",
        default=None,
        help=f"Override token counts (default: {NUM_TOKENS_LIST})",
    )
    parser.add_argument(
        "--tp",
        type=int,
        nargs="+",
        default=None,
        help=f"TP sizes to simulate (divides num_heads) (default: {TP_SIZES})",
    )
    parser.add_argument(
        "--dtype",
        type=str,
        nargs="+",
        default=None,
        help="Input dtypes (e.g. bfloat16 float16 float32). "
        f"Default: {[short_dtype(d) for d in INPUT_DTYPES]}",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Parse args and build configs before decorators
# ---------------------------------------------------------------------------

args = parse_args()

num_tokens_list = args.num_tokens if args.num_tokens else NUM_TOKENS_LIST
tp_sizes = args.tp if args.tp else TP_SIZES

if args.dtype:
    from vllm.utils.torch_utils import STR_DTYPE_TO_TORCH_DTYPE

    input_dtypes = [STR_DTYPE_TO_TORCH_DTYPE[d] for d in args.dtype]
else:
    input_dtypes = INPUT_DTYPES

configs = build_configs(HEAD_CONFIGS, num_tokens_list, input_dtypes, tp_sizes)

torch._dynamo.config.recompile_limit = 8888


# ---------------------------------------------------------------------------
# Benchmark function
# ---------------------------------------------------------------------------


@triton.testing.perf_report(
    triton.testing.Benchmark(
        x_names=["num_tokens", "num_heads", "head_size", "dtype_str"],
        x_vals=configs,
        line_arg="provider",
        line_vals=["fused_cuda", "fused_triton", "unfused_cuda", "unfused_triton"],
        line_names=["Fused CUDA", "Fused Triton", "Unfused CUDA", "Unfused Triton"],
        styles=[("blue", "-"), ("green", "-"), ("blue", "--"), ("green", "--")],
        ylabel="us",
        plot_name="merge_attn_states FP8 (fused vs unfused)",
        args={},
    )
)
@default_vllm_config()
def benchmark(num_tokens, num_heads, head_size, dtype_str, provider):
    input_dtype = getattr(torch, dtype_str)
    fp8_dtype = current_platform.fp8_dtype()
    prefix_out, suffix_out, prefix_lse, suffix_lse = make_inputs(
        num_tokens, num_heads, head_size, input_dtype
    )
    output_scale = torch.tensor([0.1], dtype=torch.float32, device="cuda")

    if provider == "fused_cuda":
        output = torch.empty(
            (num_tokens, num_heads, head_size), dtype=fp8_dtype, device="cuda"
        )
        fn = lambda: merge_attn_states_cuda(
            output,
            prefix_out,
            prefix_lse,
            suffix_out,
            suffix_lse,
            output_scale=output_scale,
        )
    elif provider == "fused_triton":
        output = torch.empty(
            (num_tokens, num_heads, head_size), dtype=fp8_dtype, device="cuda"
        )
        fn = lambda: merge_attn_states_triton(
            output,
            prefix_out,
            prefix_lse,
            suffix_out,
            suffix_lse,
            output_scale=output_scale,
        )
    elif provider == "unfused_cuda":
        merge_buf = torch.empty(
            (num_tokens, num_heads, head_size), dtype=input_dtype, device="cuda"
        )
        quant_fp8 = QuantFP8(
            static=True,
            group_shape=GroupShape.PER_TENSOR,
            column_major_scales=False,
        )
        quant_input = merge_buf.view(-1, head_size)
        compiled_quant = torch.compile(
            quant_fp8.forward_native, fullgraph=True, dynamic=False
        )

        def unfused_fn():
            merge_attn_states_cuda(
                merge_buf, prefix_out, prefix_lse, suffix_out, suffix_lse
            )
            compiled_quant(quant_input, output_scale)

        fn = unfused_fn
    else:  # unfused_triton
        merge_buf = torch.empty(
            (num_tokens, num_heads, head_size), dtype=input_dtype, device="cuda"
        )
        quant_fp8 = QuantFP8(
            static=True,
            group_shape=GroupShape.PER_TENSOR,
            column_major_scales=False,
        )
        quant_input = merge_buf.view(-1, head_size)
        compiled_quant = torch.compile(
            quant_fp8.forward_native, fullgraph=True, dynamic=False
        )

        def unfused_fn():
            merge_attn_states_triton(
                merge_buf, prefix_out, prefix_lse, suffix_out, suffix_lse
            )
            compiled_quant(quant_input, output_scale)

        fn = unfused_fn

    ms, min_ms, max_ms = triton.testing.do_bench_cudagraph(fn, quantiles=QUANTILES)
    return 1000 * ms, 1000 * max_ms, 1000 * min_ms  # us


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main():
    device_name = current_platform.get_device_name()
    print(f"Device: {device_name}")
    print(f"Token counts: {num_tokens_list}")
    print(f"TP sizes: {tp_sizes}")
    print(f"Input dtypes: {[short_dtype(d) for d in input_dtypes]}")
    print(f"Head configs: {[(c[0], c[1], c[2]) for c in HEAD_CONFIGS]}")
    benchmark.run(print_data=True)


if __name__ == "__main__":
    with torch.inference_mode():
        main()

```

### Core Architecture Module: `benchmarks/kernels/benchmark_selective_state_update.py`
```
#!/usr/bin/env python3
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
"""Benchmark and tuning script for the Mamba selective_state_update kernel.

Mirrors the fused MoE tuning workflow: sweeps (BLOCK_SIZE_M, num_warps) across
an effective_batch grid for a given (headdim, dstate, ngroups, cache_dtype) and
saves the best config per effective_batch to JSON. Generated configs are picked
up by selective_state_update at runtime.

Usage:
    python -m benchmarks.kernels.benchmark_selective_state_update \
        --all-dstates --save-configs --compare
"""

import argparse
import json
import os
import sys
from io import StringIO
from itertools import product
from typing import Any

import torch

from tests.kernels.mamba.utils import selective_state_update_ref
from vllm.model_executor.layers.mamba.ops.mamba_ssm import (
    _CONFIGS_DIR,
    _canonical_cache_dtype,
    _get_default_ssm_launch_config,
    get_ssm_config_file_name,
    get_ssm_device_name,
    override_ssm_config,
    selective_state_update,
)
from vllm.platforms import current_platform
from vllm.triton_utils import triton

# bf16 shares configs with fp16 - same bit width.
_SSM_CACHE_DTYPE_MAP: dict[str, torch.dtype] = {
    "float32": torch.float32,
    "float16": torch.float16,
    "bfloat16": torch.float16,
}

_RESULTS_DIR = os.path.dirname(os.path.realpath(__file__))

# ---------------------------------------------------------------------------
# Tuning search space
# ---------------------------------------------------------------------------

_BSM_CHOICES_ALL = [4, 8, 16, 32, 64, 128, 256]

NUM_WARPS_CHOICES = [1, 2, 4, 8]


def _block_size_m_choices(headdim: int) -> list[int]:
    """BLOCK_SIZE_M candidates worth sweeping for a given headdim.

    BLOCK_SIZE_M > next_pow2(headdim) wastes >=50% of each tile via masking
    (offs_m >= dim rows are zeroed out), so we cap the sweep there.
    """
    ceiling = 1
    while ceiling < headdim:
        ceiling <<= 1
    return [b for b in _BSM_CHOICES_ALL if b <= ceiling]


# Default deployment shapes. effective_batch = batch * nheads scales the
# kernel grid, so configs transfer across (model, TP) combos sharing
# (headdim, dstate, cache_dtype).
DEFAULT_BATCH_SIZES = [1, 8, 16, 32, 64, 128, 256, 512, 1024, 1536, 2048]
DEFAULT_NHEADS = [128, 256]

ALL_DSTATES = [16, 32, 64, 128, 256]

# Default tuning shape — matches Nemotron-3-Super and Nemotron-3-Nano Mamba layers.
# Override with CLI flags for other architectures.
DEFAULT_HEADDIM = 64
DEFAULT_NGROUPS = 8


# ---------------------------------------------------------------------------
# Benchmark helper
# ---------------------------------------------------------------------------


def _make_inputs(
    batch: int,
    nheads: int,
    dim: int,
    dstate: int,
    ngroups: int,
    dtype: torch.dtype,
    state_dtype: torch.dtype | None = None,
):
    if state_dtype is None:
        state_dtype = dtype
    device = current_platform.device_type
    state = torch.randn(batch, nheads, dim, dstate, dtype=state_dtype, device=device)
    x = torch.randn(batch, nheads, dim, dtype=dtype, device=device)
    dt = torch.randn(batch, nheads, dim, dtype=dtype, device=device)
    A = -torch.rand(nheads, dim, dstate, dtype=torch.float32, device=device)
    B = torch.randn(batch, ngroups, dstate, dtype=dtype, device=device)
    C = torch.randn(batch, ngroups, dstate, dtype=dtype, device=device)
    D = torch.randn(nheads, dim, dtype=dtype, device=device)
    dt_bias = torch.randn(nheads, dim, dtype=dtype, device=device)
    out = torch.zeros(batch, nheads, dim, dtype=dtype, device=device)
    return state, x, dt, A, B, C, D, dt_bias, out


def benchmark_config(
    batch: int,
    nheads: int,
    dim: int,
    dstate: int,
    ngroups: int,
    block_size_m: int,
    num_warps_val: int,
    dtype: torch.dtype,
    state_dtype: torch.dtype | None = None,
    num_iters: int = 100,
    num_warmup: int = 20,
    graph_batch_size: int = 10,
) -> float | None:
    """Time one (BLOCK_SIZE_M, num_warps) config for selective_state_update.
    Returns elapsed time in microseconds, or None on error.

    Uses accelerator graph capture-and-replay to isolate kernel time from
    Python eager-mode dispatch / kwarg-resolution overhead, mirroring the
    timing methodology in benchmarks/kernels/benchmark_moe.py.
    """
    state, x, dt, A, B, C, D, dt_bias, out = _make_inputs(
        batch, nheads, dim, dstate, ngroups, dtype, state_dtype=state_dtype
    )

    def _call_kernel() -> None:
        selective_state_update(
            state,
            x,
            dt,
            A,
            B,
            C,
            D=D,
            z=None,
            dt_bias=dt_bias,
            dt_softplus=True,
            out=out,
        )

    try:
        with override_ssm_config((block_size_m, num_warps_val)):
            # Eager-mode warmup: triggers Triton autotune / JIT, primes caches.
            for _ in range(num_warmup):
                _call_kernel()
            torch.accelerator.synchronize()

            # Capture graph_batch_size invocations into a device graph so the
            # timed region runs without Python dispatch overhead per call.
            # Capture via graph(), not the graph object: CUDA needs a side stream.
            graph = (
                torch.cuda.CUDAGraph()
                if current_platform.is_cuda_alike()
                else torch.xpu.XPUGraph()
            )
            with current_platform.graph(graph):
                for _ in range(graph_batch_size):
                    _call_kernel()
            torch.accelerator.synchronize()

            # Warmup graph replays (let the runtime stabilize).
            for _ in range(5):
                graph.replay()
            torch.accelerator.synchronize()

            start = torch.Event(enable_timing=True)
            end = torch.Event(enable_timing=True)
            latencies: list[float] = []
            for _ in range(num_iters):
                start.record()
                graph.replay()
                end.record()
                end.synchronize()
                latencies.append(start.elapsed_time(end))
            graph.reset()
        # elapsed_time returns ms; each replay runs graph_batch_size kernels,
        # so divide by (num_iters * graph_batch_size) and convert ms -> us.
        return sum(latencies) / (num_iters * graph_batch_size) * 1000
    except Exception as e:
        if "OutOfResources" not in str(e):
            print(
                f"    Warning: config M={block_size_m},w={num_warps_val} "
                f"raised {type(e).__name__}: {e}"
            )
        return None


# ---------------------------------------------------------------------------
# Tuning loop
# ---------------------------------------------------------------------------


# CUDA grid Y/Z dim limit — both `batch` and `nheads` must fit individually.
_CUDA_MAX_GRID_DIM = 65535

# Above this, kernel state-offset arithmetic (batch * nheads * headdim * dstate)
# overflows int32 and the launch raises cudaErrorIllegalAddress.
# 262144 covers Nemotron Super TP1 BS=2048.
_MAX_EFFECTIVE_BATCH = 262144


def expand_batch_x_nheads(
    batch_sizes: list[int],
    nheads_list: list[int],
    ngroups: int,
) -> list[tuple[int, int, int]]:
    """Cross-product batch_sizes × nheads_list → sorted [(effective_batch,
    batch, nheads)], deduped by effective_batch. Filters pairs that exceed
    the CUDA grid dim limit, the effective_batch ceiling, or where nheads is
    not a positive multiple of ngroups.
    """
    seen: dict[int, tuple[int, int]] = {}
    skipped_grid: list[tuple[int, int]] = []
    skipped_ngroups: list[tuple[int, int]] = []
    skipped_eb: list[tuple[int, int]] = []
    for b, n in product(batch_sizes, nheads_list):
        if b <= 0 or n <= 0:
            continue
        if b > _CUDA_MAX_GRID_DIM or n > _CUDA_MAX_GRID_DIM:
            skipped_grid.append((b, n))
            continue
        if n % ngroups != 0:
            skipped_ngroups.append((b, n))
            continue
        if b * n > _MAX_EFFECTIVE_BATCH:
            skipped_eb.append((b, n))
            continue
        seen.setdefault(b * n, (b, n))
    if skipped_grid:
        print(
            f"  Note: skipping (batch, nheads) pairs exceeding CUDA grid dim "
            f"{_CUDA_MAX_GRID_DIM}: {skipped_grid}"
        )
    if skipped_ngroups:
        print(
            f"  Note: skipping (batch, nheads) pairs where nheads % ngroups != 0 "
            f"for ngroups={ngroups}: {skipped_ngroups}"
        )
    if skipped_eb:
        print(
            f"  Note: skipping (batch, nheads) pairs whose effective_batch "
            f"exceeds {_MAX_EFFECTIVE_BATCH}: {skipped_eb}"
        )
    return sorted((eb, b, n) for eb, (b, n) in seen.items())


def tune_dstate(
    dstate: int,
    headdim: int,
    ngroups: int,
    dtype: torch.dtype,
    num_iters: int,
    verbose: bool,
    active: list[tuple[int, int, int]],
    state_dtype: torch.dtype | None = None,
) -> tuple[dict[int, dict], dict[int, dict[tuple[int, int], float]]]:
    """For each (effective_batch, batch, nheads) in *active*, sweep
    (BLOCK_SIZE_M, num_warps) and return
    ({effective_batch: best_config}, {effective_batch: {(bsm, nw): us}}).
    The second map is the full timing grid, used downstream so we don't
    re-measure the same config in the comparison phase.
    """
    best_per_eb: dict[int, dict] = {}
    timings: dict[int, dict[tuple[int, int], float]] = {}

    print(f"\n{'=' * 74}")
    effective_state_dtype = state_dtype if state_dtype is not None else dtype
    print(
        f"Tuning  headdim={headdim}  dstate={dstate}  ngroups={ngroups}  "
        f"dtype={dtype}  ssm_cache_dtype={effective_state_dtype}"
    )
    print(f"{'=' * 74}")

    bsm_choices = _block_size_m_choices(headdim)
    print(f"BSM candidates (capped at next_pow2(headdim={headdim})): {bsm_choices}")

    hdr = f"{'EffBat
```

### Core Architecture Module: `benchmarks/kernels/utils.py`
```
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project

import dataclasses
from collections.abc import Callable, Iterable
from typing import Any

import torch
import torch.utils.benchmark as TBenchmark
from torch.utils.benchmark import Measurement as TMeasurement


@dataclasses.dataclass
class CudaGraphBenchParams:
    num_ops_in_cuda_graph: int


@dataclasses.dataclass
class ArgPool:
    """When some argument of the benchmarking function is annotated with this type,
    the benchmarking class (BenchMM) will collapse the argument to a pick a
    single value from the given list of values, during function invocation.
    For every invocation during a benchmarking run, it will choose a
    different value from the list.
    """

    values: Iterable[Any]

    def __getitem__(self, index):
        return self.values[index]


class Bench:
    class ArgsIterator:
        def __init__(self, args_list, kwargs_list):
            assert len(args_list) == len(kwargs_list)
            self.args_list = args_list
            self.kwargs_list = kwargs_list
            self.n = len(self.args_list)
            self.idx = 0

        def __next__(self):
            while True:
                yield (self.args_list[self.idx], self.kwargs_list[self.idx])
                self.idx += 1
                self.idx = self.idx % self.n

        def reset(self):
            self.idx = 0

        @property
        def n_args(self):
            return self.n

    def __init__(
        self,
        cuda_graph_params: CudaGraphBenchParams | None,
        label: str,
        sub_label: str,
        description: str,
        fn: Callable,
        *args,
        **kwargs,
    ):
        self.cuda_graph_params = cuda_graph_params
        self.use_cuda_graph = self.cuda_graph_params is not None
        self.label = label
        self.sub_label = sub_label
        self.description = description
        self.fn = fn

        # Process args
        self._args = args
        self._kwargs = kwargs
        self.args_list, self.kwargs_list = self.collapse_argpool(*args, **kwargs)
        self.args_iterator = self.ArgsIterator(self.args_list, self.kwargs_list)

        # Cudagraph runner
        self.g = None
        if self.use_cuda_graph:
            self.g = self.get_cuda_graph_runner()

        # benchmark run params
        self.min_run_time = 1

    def collapse_argpool(self, *args, **kwargs):
        argpool_args = [arg for arg in args if isinstance(arg, ArgPool)] + [
            arg for arg in kwargs.values() if isinstance(arg, ArgPool)
        ]
        if len(argpool_args) == 0:
            return [args], [kwargs]

        # Make sure all argpools are of the same size
        argpool_size = len(argpool_args[0].values)
        assert all([argpool_size == len(arg.values) for arg in argpool_args])

        # create copies of the args
        args_list = []
        kwargs_list = []
        for _ in range(argpool_size):
            args_list.append(args)
            kwargs_list.append(kwargs.copy())

        for i in range(argpool_size):
            # collapse args; Just pick the ith value
            args_list[i] = tuple(
                [arg[i] if isinstance(arg, ArgPool) else arg for arg in args_list[i]]
            )

            # collapse kwargs
            kwargs_i = kwargs_list[i]
            arg_pool_keys = [k for k, v in kwargs_i.items() if isinstance(v, ArgPool)]
            for k in arg_pool_keys:
                # again just pick the ith value
                kwargs_i[k] = kwargs_i[k][i]
            kwargs_list[i] = kwargs_i

        return args_list, kwargs_list

    def get_cuda_graph_runner(self):
        assert self.use_cuda_graph
        assert self.args_iterator is not None

        num_graph_ops = self.cuda_graph_params.num_ops_in_cuda_graph

        # warmup
        args_it = self.args_iterator.__next__()
        for _ in range(2):
            args, kwargs = next(args_it)
            self.fn(*args, **kwargs)

        self.args_iterator.reset()
        args_it = self.args_iterator.__next__()
        stream = torch.cuda.Stream()
        with torch.cuda.stream(stream):
            g = torch.cuda.CUDAGraph()
            with torch.cuda.graph(g):
                for _ in range(num_graph_ops):
                    args, kwargs = next(args_it)
                    self.fn(*args, **kwargs)
        return g

    def run_cudagrah(self) -> TMeasurement:
        assert self.use_cuda_graph
        globals = {"g": self.g}

        return TBenchmark.Timer(
            stmt="g.replay()",
            globals=globals,
            label=(
                f"{self.label}"
                f" | cugraph {self.cuda_graph_params.num_ops_in_cuda_graph} ops"
            ),
            sub_label=self.sub_label,
            description=self.description,
        ).blocked_autorange(min_run_time=self.min_run_time)

    def run_eager(self) -> TMeasurement:
        setup = None
        stmt = None
        globals = None

        has_arg_pool = self.args_iterator.n_args > 1
        if has_arg_pool:
            setup = """
                    args_iterator.reset()
                    args_it = args_iterator.__next__()
                    """
            stmt = """
                    args, kwargs = next(args_it)
                    fn(*args, **kwargs)
                    """
            globals = {"fn": self.fn, "args_iterator": self.args_iterator}
        else:
            # no arg pool. Just use the args and kwargs directly
            self.args_iterator.reset()
            args_it = self.args_iterator.__next__()
            args, kwargs = next(args_it)

            setup = ""
            stmt = """
                    fn(*args, **kwargs)
                   """
            globals = {"fn": self.fn, "args": args, "kwargs": kwargs}

        return TBenchmark.Timer(
            stmt=stmt,
            setup=setup,
            globals=globals,
            label=self.label,
            sub_label=self.sub_label,
            description=self.description,
        ).blocked_autorange(min_run_time=self.min_run_time)

    def run(self) -> TMeasurement:
        timer = None
        if self.use_cuda_graph:  # noqa SIM108
            timer = self.run_cudagrah()
        else:
            timer = self.run_eager()
        if not timer.meets_confidence() or timer.has_warnings:
            print("Doesn't meet confidence - re-running bench ...")
            return self.run()
        return timer

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type:
            print(f"exc type {exc_type}")
            print(f"exc value {exc_value}")
            print(f"exc traceback {traceback}")

```

### Core Architecture Module: `benchmarks/multi_turn/bench_utils.py`
```
# SPDX-License-Identifier: Apache-2.0
# SPDX-FileCopyrightText: Copyright contributors to the vLLM project
import logging
from enum import Enum


class Color(Enum):
    RED = "\033[91m"
    GREEN = "\033[92m"
    BLUE = "\033[94m"
    PURPLE = "\033[95m"
    CYAN = "\033[96m"
    YELLOW = "\033[93m"
    RESET = "\033[0m"

    def __str__(self):
        return self.value


TEXT_SEPARATOR = "-" * 100

# Configure the logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] - %(message)s",
    datefmt="%d-%m-%Y %H:%M:%S",
)
logger = logging.getLogger(__name__)

```

### Core Architecture Module: `csrc/core/registration.h`
```
#pragma once

#include <Python.h>

#define _CONCAT(A, B) A##B
#define CONCAT(A, B) _CONCAT(A, B)

#define _STRINGIFY(A) #A
#define STRINGIFY(A) _STRINGIFY(A)

// A version of the TORCH_LIBRARY macro that expands the NAME, i.e. so NAME
// could be a macro instead of a literal token.
#define TORCH_LIBRARY_EXPAND(NAME, MODULE) TORCH_LIBRARY(NAME, MODULE)

// A version of the TORCH_LIBRARY_IMPL macro that expands the NAME, i.e. so NAME
// could be a macro instead of a literal token.
#define TORCH_LIBRARY_IMPL_EXPAND(NAME, DEVICE, MODULE) \
  TORCH_LIBRARY_IMPL(NAME, DEVICE, MODULE)

// REGISTER_EXTENSION allows the shared library to be loaded and initialized
// via python's import statement.
#define REGISTER_EXTENSION(NAME)                                               \
  PyMODINIT_FUNC CONCAT(PyInit_, NAME)() {                                     \
    static struct PyModuleDef module = {PyModuleDef_HEAD_INIT,                 \
                                        STRINGIFY(NAME), nullptr, 0, nullptr}; \
    return PyModule_Create(&module);                                           \
  }

```

### Core Architecture Module: `csrc/cpu/utils.cpp`
```
#ifndef VLLM_NUMA_DISABLED
  #include <numa.h>
  #include <unistd.h>
  #include <string>
  #include <sched.h>
#endif
#if __GLIBC__ == 2 && __GLIBC_MINOR__ < 30
  #include <unistd.h>
  #include <sys/syscall.h>
  #define gettid() syscall(SYS_gettid)
#endif

#include "cpu/utils.hpp"

#ifdef VLLM_NUMA_DISABLED
void init_cpu_memory_env(std::vector<int64_t> node_ids) {}
#else
void init_cpu_memory_env(std::vector<int64_t> node_ids) {
  // Memory node binding
  if (numa_available() != -1) {
    // Concatenate all node_ids into a single comma-separated string
    if (!node_ids.empty()) {
      std::string node_ids_str;
      for (const int node_id : node_ids) {
        if (!node_ids_str.empty()) {
          node_ids_str += ",";
        }
        node_ids_str += std::to_string(node_id);
      }

      bitmask* mask = numa_parse_nodestring(node_ids_str.c_str());
      bitmask* src_mask = numa_get_mems_allowed();

      int pid = getpid();

      if (mask && src_mask) {
        // move all existing pages to the specified numa node.
        *(src_mask->maskp) = *(src_mask->maskp) ^ *(mask->maskp);
        int page_num = numa_migrate_pages(pid, src_mask, mask);
        if (page_num == -1) {
          TORCH_WARN("numa_migrate_pages failed. errno: " +
                     std::to_string(errno));
        }

        // Restrict memory allocation to the selected NUMA node(s).
        // Enhances memory locality for the threads bound to those NUMA CPUs.
        if (node_ids.size() > 1) {
          errno = 0;
          numa_set_interleave_mask(mask);
          if (errno != 0) {
            TORCH_WARN("numa_set_interleave_mask failed. errno: " +
                       std::to_string(errno));
          } else {
            TORCH_WARN(
                "NUMA binding: Using INTERLEAVE policy for memory "
                "allocation across multiple NUMA nodes (nodes: " +
                node_ids_str +
                "). Memory allocations will be "
                "interleaved across the specified NUMA nodes.");
          }
        } else {
          errno = 0;
          numa_set_membind(mask);
          if (errno != 0) {
            TORCH_WARN("numa_set_membind failed. errno: " +
                       std::to_string(errno));
          } else {
            TORCH_WARN(
                "NUMA binding: Using MEMBIND policy for memory "
                "allocation on the NUMA nodes (" +
                node_ids_str +
                "). Memory allocations will be "
                "strictly bound to these NUMA nodes.");
          }
        }

        numa_set_strict(1);

        numa_free_nodemask(mask);
        numa_free_nodemask(src_mask);
      } else {
        TORCH_WARN(
            "numa_parse_nodestring or numa_get_run_node_mask failed. errno: " +
            std::to_string(errno));
      }
    }
  }
}
#endif  // VLLM_NUMA_DISABLED

namespace cpu_utils {
ScratchPadManager::ScratchPadManager() : size_(0), ptr_(nullptr) {
  this->realloc(allocation_unit * 128);
}

void ScratchPadManager::realloc(size_t new_size) {
  new_size = round(new_size);
  if (new_size > size_) {
    void* new_ptr = std::aligned_alloc(64, new_size);
    TORCH_CHECK(new_ptr != nullptr,
                "ScratchPadManager: aligned_alloc failed for size ", new_size);
    if (ptr_ != nullptr) {
      std::free(ptr_);
    }
    ptr_ = new_ptr;
    size_ = new_size;
  }
}

ScratchPadManager* ScratchPadManager::get_scratchpad_manager() {
  static ScratchPadManager manager;
  return &manager;
}
}  // namespace cpu_utils

void compute_slot_mapping_kernel_impl(const torch::Tensor query_start_loc,
                                      const torch::Tensor positions,
                                      const torch::Tensor block_table,
                                      torch::Tensor slot_mapping,
                                      const int64_t block_size) {
  const int32_t req_num = query_start_loc.size(0) - 1;
  const int64_t block_table_stride = block_table.stride(0);

  const int32_t* __restrict__ query_start_loc_ptr =
      query_start_loc.data_ptr<int32_t>();
  const int64_t* __restrict__ positions_ptr = positions.data_ptr<int64_t>();
  const int32_t* __restrict__ blocktable_ptr = block_table.data_ptr<int32_t>();
  int64_t* __restrict__ slot_mapping_ptr = slot_mapping.data_ptr<int64_t>();

#pragma omp parallel for
  for (int32_t req_idx = 0; req_idx < req_num; ++req_idx) {
    int32_t token_start_idx = query_start_loc_ptr[req_idx];
    int32_t token_end_idx = query_start_loc_ptr[req_idx + 1];
    int32_t token_num = token_end_idx - token_start_idx;
    const int64_t* __restrict__ curr_position_ptr =
        positions_ptr + token_start_idx;
    int64_t* __restrict__ curr_slot_mapping_ptr =
        slot_mapping_ptr + token_start_idx;
    const int32_t* __restrict__ curr_block_table_ptr =
        blocktable_ptr + req_idx * block_table_stride;

    for (int32_t token_idx = 0; token_idx < token_num; ++token_idx) {
      int64_t token_position = curr_position_ptr[token_idx];
      int64_t block_id = curr_block_table_ptr[token_position / block_size];
      curr_slot_mapping_ptr[token_idx] =
          block_id * block_size + token_position % block_size;
    }
  }
}

```

### Core Architecture Module: `csrc/cuda_utils.h`
```
#pragma once

#include <stdio.h>

#if defined(__HIPCC__)
  #define HOST_DEVICE_INLINE __host__ __device__
  #define DEVICE_INLINE __device__
  #define HOST_INLINE __host__
#elif defined(__CUDACC__) || defined(_NVHPC_CUDA)
  #define HOST_DEVICE_INLINE __host__ __device__ __forceinline__
  #define DEVICE_INLINE __device__ __forceinline__
  #define HOST_INLINE __host__ __forceinline__
#else
  #define HOST_DEVICE_INLINE inline
  #define DEVICE_INLINE inline
  #define HOST_INLINE inline
#endif

#define CUDA_CHECK(cmd)                                             \
  do {                                                              \
    cudaError_t e = cmd;                                            \
    if (e != cudaSuccess) {                                         \
      printf("Failed: Cuda error %s:%d '%s'\n", __FILE__, __LINE__, \
             cudaGetErrorString(e));                                \
      exit(EXIT_FAILURE);                                           \
    }                                                               \
  } while (0)

int64_t get_device_attribute(int64_t attribute, int64_t device_id);

int64_t get_max_shared_memory_per_block_device_attribute(int64_t device_id);

namespace cuda_utils {

template <typename T>
HOST_DEVICE_INLINE constexpr std::enable_if_t<std::is_integral_v<T>, T>
ceil_div(T a, T b) {
  return (a + b - 1) / b;
}

};  // namespace cuda_utils
```

### Core Architecture Module: `csrc/dispatch_utils.h`
```
/*
 * Adapted from
 * https://github.com/pytorch/pytorch/blob/v2.0.1/aten/src/ATen/Dispatch.h
 */
#pragma once

#include <torch/all.h>

// Need a special dispatch case macro since we will nest the FP8 dispatch.
// Instead of the usual 'scalar_t', this names the dispatched type 'fp8_t'.
#define AT_DISPATCH_FP8_CASE(enum_type, ...) \
  AT_PRIVATE_CASE_TYPE_USING_HINT(enum_type, fp8_t, __VA_ARGS__)

#define VLLM_DISPATCH_CASE_FLOATING_TYPES(...)         \
  AT_DISPATCH_CASE(at::ScalarType::Float, __VA_ARGS__) \
  AT_DISPATCH_CASE(at::ScalarType::Half, __VA_ARGS__)  \
  AT_DISPATCH_CASE(at::ScalarType::BFloat16, __VA_ARGS__)

#define VLLM_DISPATCH_FLOATING_TYPES(TYPE, NAME, ...) \
  AT_DISPATCH_SWITCH(TYPE, NAME, VLLM_DISPATCH_CASE_FLOATING_TYPES(__VA_ARGS__))

#define VLLM_DISPATCH_CASE_HALF_TYPES(...)            \
  AT_DISPATCH_CASE(at::ScalarType::Half, __VA_ARGS__) \
  AT_DISPATCH_CASE(at::ScalarType::BFloat16, __VA_ARGS__)

#define VLLM_DISPATCH_HALF_TYPES(TYPE, NAME, ...) \
  AT_DISPATCH_SWITCH(TYPE, NAME, VLLM_DISPATCH_CASE_HALF_TYPES(__VA_ARGS__))

// ROCm devices might use either fn or fnuz, so set up dispatch table for both.
// A host-based check at runtime will create a preferred FP8 type for ROCm
// such that the correct kernel is dispatched.
#ifdef USE_ROCM
  #define VLLM_DISPATCH_CASE_FP8_TYPES(...)                          \
    AT_DISPATCH_FP8_CASE(at::ScalarType::Float8_e4m3fn, __VA_ARGS__) \
    AT_DISPATCH_FP8_CASE(at::ScalarType::Float8_e4m3fnuz, __VA_ARGS__)

  #define VLLM_DISPATCH_CASE_QUANT_TYPES(...)                      \
    AT_DISPATCH_CASE(at::ScalarType::Float8_e4m3fn, __VA_ARGS__)   \
    AT_DISPATCH_CASE(at::ScalarType::Float8_e4m3fnuz, __VA_ARGS__) \
    AT_DISPATCH_CASE(at::ScalarType::Char, __VA_ARGS__)
#else
  #define VLLM_DISPATCH_CASE_FP8_TYPES(...) \
    AT_DISPATCH_FP8_CASE(at::ScalarType::Float8_e4m3fn, __VA_ARGS__)

  #define VLLM_DISPATCH_CASE_QUANT_TYPES(...)                    \
    AT_DISPATCH_CASE(at::ScalarType::Float8_e4m3fn, __VA_ARGS__) \
    AT_DISPATCH_CASE(at::ScalarType::Char, __VA_ARGS__)
#endif

// When using this dispatch macro, the type is 'fp8_t' not 'scalar_t'.
// See AT_DISPATCH_FP8_CASE above.
#define VLLM_DISPATCH_FP8_TYPES(TYPE, NAME, ...) \
  AT_DISPATCH_SWITCH(TYPE, NAME, VLLM_DISPATCH_CASE_FP8_TYPES(__VA_ARGS__))

#define VLLM_DISPATCH_QUANT_TYPES(TYPE, NAME, ...) \
  AT_DISPATCH_SWITCH(TYPE, NAME, VLLM_DISPATCH_CASE_QUANT_TYPES(__VA_ARGS__))

#define VLLM_DISPATCH_CASE_FLOATING_AND_BYTE_TYPES(...)   \
  AT_DISPATCH_CASE(at::ScalarType::Float, __VA_ARGS__)    \
  AT_DISPATCH_CASE(at::ScalarType::Half, __VA_ARGS__)     \
  AT_DISPATCH_CASE(at::ScalarType::BFloat16, __VA_ARGS__) \
  AT_DISPATCH_CASE(at::ScalarType::Byte, __VA_ARGS__)

#define VLLM_DISPATCH_FLOATING_AND_BYTE_TYPES(TYPE, NAME, ...) \
  AT_DISPATCH_SWITCH(TYPE, NAME,                               \
                     VLLM_DISPATCH_CASE_FLOATING_AND_BYTE_TYPES(__VA_ARGS__))

#define VLLM_DISPATCH_CASE_INTEGRAL_TYPES(...)         \
  AT_DISPATCH_CASE(at::ScalarType::Byte, __VA_ARGS__)  \
  AT_DISPATCH_CASE(at::ScalarType::Char, __VA_ARGS__)  \
  AT_DISPATCH_CASE(at::ScalarType::Short, __VA_ARGS__) \
  AT_DISPATCH_CASE(at::ScalarType::Int, __VA_ARGS__)   \
  AT_DISPATCH_CASE(at::ScalarType::Long, __VA_ARGS__)

#define VLLM_DISPATCH_CASE_INTEGRAL_AND_UNSIGNED_TYPES(...) \
  AT_DISPATCH_CASE(at::ScalarType::Byte, __VA_ARGS__)       \
  AT_DISPATCH_CASE(at::ScalarType::Char, __VA_ARGS__)       \
  AT_DISPATCH_CASE(at::ScalarType::Short, __VA_ARGS__)      \
  AT_DISPATCH_CASE(at::ScalarType::Int, __VA_ARGS__)        \
  AT_DISPATCH_CASE(at::ScalarType::Long, __VA_ARGS__)       \
  AT_DISPATCH_CASE(at::ScalarType::UInt16, __VA_ARGS__)     \
  AT_DISPATCH_CASE(at::ScalarType::UInt32, __VA_ARGS__)     \
  AT_DISPATCH_CASE(at::ScalarType::UInt64, __VA_ARGS__)

#define VLLM_DISPATCH_INTEGRAL_TYPES(TYPE, NAME, ...) \
  AT_DISPATCH_SWITCH(TYPE, NAME, VLLM_DISPATCH_CASE_INTEGRAL_TYPES(__VA_ARGS__))

#define VLLM_DISPATCH_INTEGRAL_AND_UNSIGNED_TYPES(TYPE, NAME, ...) \
  AT_DISPATCH_SWITCH(                                              \
      TYPE, NAME, VLLM_DISPATCH_CASE_INTEGRAL_AND_UNSIGNED_TYPES(__VA_ARGS__))

#define VLLM_DISPATCH_VEC_SIZE(VEC_SIZE, ...) \
  switch (VEC_SIZE) {                         \
    case 16: {                                \
      constexpr int vec_size = 16;            \
      __VA_ARGS__();                          \
      break;                                  \
    }                                         \
    case 8: {                                 \
      constexpr int vec_size = 8;             \
      __VA_ARGS__();                          \
      break;                                  \
    }                                         \
    case 4: {                                 \
      constexpr int vec_size = 4;             \
      __VA_ARGS__();                          \
      break;                                  \
    }                                         \
    case 2: {                                 \
      constexpr int vec_size = 2;             \
      __VA_ARGS__();                          \
      break;                                  \
    }                                         \
    default: {                                \
      constexpr int vec_size = 1;             \
      __VA_ARGS__();                          \
      break;                                  \
    }                                         \
  }

#define VLLM_DISPATCH_BOOL(expr, const_expr, ...) \
  if (expr) {                                     \
    constexpr bool const_expr = true;             \
    __VA_ARGS__();                                \
  } else {                                        \
    constexpr bool const_expr = false;            \
    __VA_ARGS__();                                \
  }

#define VLLM_DISPATCH_GROUP_SIZE(group_size, const_group_size, ...) \
  if (group_size == 128) {                                          \
    constexpr int const_group_size = 128;                           \
    __VA_ARGS__();                                                  \
  } else if (group_size == 64) {                                    \
    constexpr int const_group_size = 64;                            \
    __VA_ARGS__();                                                  \
  }

#define VLLM_DISPATCH_RANK234(NUM_DIMS, ...)                                   \
  switch (NUM_DIMS) {                                                          \
    case 2: {                                                                  \
      constexpr int tensor_rank = 2;                                           \
      __VA_ARGS__();                                                           \
      break;                                                                   \
    }                                                                          \
    case 3: {                                                                  \
      constexpr int tensor_rank = 3;                                           \
      __VA_ARGS__();                                                           \
      break;                                                                   \
    }                                                                          \
    case 4: {                                                                  \
      constexpr int tensor_rank = 4;                                           \
      __VA_ARGS__();                                                           \
      break;                                                                   \
    }                                                                          \
    default:                                                                   \
      TORCH_CHECK(false, "Expects rank 2, 3 or 4 tensors but got ", NUM_DIMS); \
  }

```

### Core Architecture Module: `csrc/libtorch_stable/dispatch_utils.h`
```
/*
 * Stable ABI compatible dispatch utilities for vLLM.
 * Adapted from dispatch_utils.h to use PyTorch's header-only (THO_*) macros
 * instead of the ATen (AT_*) macros.
 *
 * These macros use:
 * - THO_DISPATCH_SWITCH instead of AT_DISPATCH_SWITCH
 * - THO_DISPATCH_CASE instead of AT_DISPATCH_CASE
 * - torch::headeronly::ScalarType instead of at::ScalarType
 *
 * Add more macros here as needed when migrating additional kernels.
 */
#pragma once

#include <torch/headeronly/core/Dispatch.h>
#include <torch/headeronly/core/ScalarType.h>
#include <torch/headeronly/util/Exception.h>

// Need a special dispatch case macro since we will nest the FP8 dispatch.
// Instead of the usual 'scalar_t', this names the dispatched type 'fp8_t'.
#define VLLM_STABLE_DISPATCH_FP8_CASE(enum_type, ...) \
  THO_PRIVATE_CASE_TYPE_USING_HINT(enum_type, fp8_t, __VA_ARGS__)

// Same idea, for dispatching on an int32/int64 index tensor (e.g. topk_ids)
// nested inside a value-type dispatch. Named 'idx_t' instead of 'scalar_t'.
#define VLLM_STABLE_DISPATCH_IDX_CASE(enum_type, ...) \
  THO_PRIVATE_CASE_TYPE_USING_HINT(enum_type, idx_t, __VA_ARGS__)

#define VLLM_STABLE_DISPATCH_CASE_IDX_TYPES(...)                     \
  VLLM_STABLE_DISPATCH_IDX_CASE(torch::headeronly::ScalarType::Int,  \
                                __VA_ARGS__)                         \
  VLLM_STABLE_DISPATCH_IDX_CASE(torch::headeronly::ScalarType::Long, \
                                __VA_ARGS__)

#define VLLM_STABLE_DISPATCH_IDX_TYPES(TYPE, NAME, ...) \
  THO_DISPATCH_SWITCH(TYPE, NAME,                       \
                      VLLM_STABLE_DISPATCH_CASE_IDX_TYPES(__VA_ARGS__))

#define VLLM_STABLE_DISPATCH_CASE_FLOATING_TYPES(...)                  \
  THO_DISPATCH_CASE(torch::headeronly::ScalarType::Float, __VA_ARGS__) \
  THO_DISPATCH_CASE(torch::headeronly::ScalarType::Half, __VA_ARGS__)  \
  THO_DISPATCH_CASE(torch::headeronly::ScalarType::BFloat16, __VA_ARGS__)

#define VLLM_STABLE_DISPATCH_FLOATING_TYPES(TYPE, NAME, ...) \
  THO_DISPATCH_SWITCH(TYPE, NAME,                            \
                      VLLM_STABLE_DISPATCH_CASE_FLOATING_TYPES(__VA_ARGS__))

#define VLLM_STABLE_DISPATCH_CASE_INTEGRAL_TYPES(...)                  \
  THO_DISPATCH_CASE(torch::headeronly::ScalarType::Byte, __VA_ARGS__)  \
  THO_DISPATCH_CASE(torch::headeronly::ScalarType::Char, __VA_ARGS__)  \
  THO_DISPATCH_CASE(torch::headeronly::ScalarType::Short, __VA_ARGS__) \
  THO_DISPATCH_CASE(torch::headeronly::ScalarType::Int, __VA_ARGS__)   \
  THO_DISPATCH_CASE(torch::headeronly::ScalarType::Long, __VA_ARGS__)

#define VLLM_STABLE_DISPATCH_CASE_INTEGRAL_AND_UNSIGNED_TYPES(...)      \
  VLLM_STABLE_DISPATCH_CASE_INTEGRAL_TYPES(__VA_ARGS__)                 \
  THO_DISPATCH_CASE(torch::headeronly::ScalarType::UInt16, __VA_ARGS__) \
  THO_DISPATCH_CASE(torch::headeronly::ScalarType::UInt32, __VA_ARGS__) \
  THO_DISPATCH_CASE(torch::headeronly::ScalarType::UInt64, __VA_ARGS__)

#define VLLM_STABLE_DISPATCH_INTEGRAL_TYPES(TYPE, NAME, ...) \
  THO_DISPATCH_SWITCH(TYPE, NAME,                            \
                      VLLM_STABLE_DISPATCH_CASE_INTEGRAL_TYPES(__VA_ARGS__))

#define VLLM_STABLE_DISPATCH_INTEGRAL_AND_UNSIGNED_TYPES(TYPE, NAME, ...) \
  THO_DISPATCH_SWITCH(                                                    \
      TYPE, NAME,                                                         \
      VLLM_STABLE_DISPATCH_CASE_INTEGRAL_AND_UNSIGNED_TYPES(__VA_ARGS__))

// FP8 type dispatch - ROCm uses FNUZ format, CUDA uses OCP format
#ifdef USE_ROCM
  #define VLLM_STABLE_DISPATCH_CASE_FP8_TYPES(...)                 \
    VLLM_STABLE_DISPATCH_FP8_CASE(                                 \
        torch::headeronly::ScalarType::Float8_e4m3fn, __VA_ARGS__) \
    VLLM_STABLE_DISPATCH_FP8_CASE(                                 \
        torch::headeronly::ScalarType::Float8_e4m3fnuz, __VA_ARGS__)
#else
  #define VLLM_STABLE_DISPATCH_CASE_FP8_TYPES(...) \
    VLLM_STABLE_DISPATCH_FP8_CASE(                 \
        torch::headeronly::ScalarType::Float8_e4m3fn, __VA_ARGS__)
#endif

// When using this dispatch macro, the type is 'fp8_t' not 'scalar_t'.
// See VLLM_STABLE_DISPATCH_FP8_CASE above.
#define VLLM_STABLE_DISPATCH_FP8_TYPES(TYPE, NAME, ...) \
  THO_DISPATCH_SWITCH(TYPE, NAME,                       \
                      VLLM_STABLE_DISPATCH_CASE_FP8_TYPES(__VA_ARGS__))

// Half types dispatch (Half + BFloat16)
#define VLLM_STABLE_DISPATCH_CASE_HALF_TYPES(...)                     \
  THO_DISPATCH_CASE(torch::headeronly::ScalarType::Half, __VA_ARGS__) \
  THO_DISPATCH_CASE(torch::headeronly::ScalarType::BFloat16, __VA_ARGS__)

#define VLLM_STABLE_DISPATCH_HALF_TYPES(TYPE, NAME, ...) \
  THO_DISPATCH_SWITCH(TYPE, NAME,                        \
                      VLLM_STABLE_DISPATCH_CASE_HALF_TYPES(__VA_ARGS__))

// Quant type dispatch (FP8 + INT8)
#ifdef USE_ROCM
  #define VLLM_STABLE_DISPATCH_CASE_QUANT_TYPES(...)                  \
    THO_DISPATCH_CASE(torch::headeronly::ScalarType::Float8_e4m3fn,   \
                      __VA_ARGS__)                                    \
    THO_DISPATCH_CASE(torch::headeronly::ScalarType::Float8_e4m3fnuz, \
                      __VA_ARGS__)                                    \
    THO_DISPATCH_CASE(torch::headeronly::ScalarType::Char, __VA_ARGS__)
#else
  #define VLLM_STABLE_DISPATCH_CASE_QUANT_TYPES(...)                \
    THO_DISPATCH_CASE(torch::headeronly::ScalarType::Float8_e4m3fn, \
                      __VA_ARGS__)                                  \
    THO_DISPATCH_CASE(torch::headeronly::ScalarType::Char, __VA_ARGS__)
#endif

#define VLLM_STABLE_DISPATCH_QUANT_TYPES(TYPE, NAME, ...) \
  THO_DISPATCH_SWITCH(TYPE, NAME,                         \
                      VLLM_STABLE_DISPATCH_CASE_QUANT_TYPES(__VA_ARGS__))

// Group size dispatch (pure C++ if/else, no ATen dependency)
#define VLLM_STABLE_DISPATCH_GROUP_SIZE(group_size, const_group_size, ...) \
  if (group_size == 128) {                                                 \
    constexpr int const_group_size = 128;                                  \
    __VA_ARGS__();                                                         \
  } else if (group_size == 64) {                                           \
    constexpr int const_group_size = 64;                                   \
    __VA_ARGS__();                                                         \
  }

// Boolean dispatch
#define VLLM_STABLE_DISPATCH_BOOL(expr, const_expr, ...) \
  if (expr) {                                            \
    constexpr bool const_expr = true;                    \
    __VA_ARGS__();                                       \
  } else {                                               \
    constexpr bool const_expr = false;                   \
    __VA_ARGS__();                                       \
  }

// Vec size dispatch (pure C++ switch, no ATen dependency)
#define VLLM_STABLE_DISPATCH_VEC_SIZE(VEC_SIZE, ...) \
  switch (VEC_SIZE) {                                \
    case 16: {                                       \
      constexpr int vec_size = 16;                   \
      __VA_ARGS__();                                 \
      break;                                         \
    }                                                \
    case 8: {                                        \
      constexpr int vec_size = 8;                    \
      __VA_ARGS__();                                 \
      break;                                         \
    }                                                \
    case 4: {                                        \
      constexpr int vec_size = 4;                    \
      __VA_ARGS__();                                 \
      break;                                         \
    }                                                \
    case 2: {                                        \
      constexpr int vec_size = 2;                    \
      __VA_ARGS__();                                 \
      break;                                         \
    }                                                \
    default: {                                       \
      constexpr int vec_size = 1;                    \
      __VA_ARGS__();                                 \
      break;                                         \
    }                                                \
  }

// Tensor rank dispatch (2D, 3D, 4D)
#define VLLM_STABLE_DISPATCH_RANK234(NUM_DIMS, ...)                          \
  switch (NUM_DIMS) {                                                        \
    case 2: {                                                                \
      constexpr int tensor_rank = 2;                                         \
      __VA_ARGS__();                                                         \
      break;                                                                 \
    }                                                                        \
    case 3: {                                                                \
      constexpr int tensor_rank = 3;                                         \
      __VA_ARGS__();                                                         \
      break;                                                                 \
    }                                                                        \
    case 4: {                                                                \
      constexpr int tensor_rank = 4;                                         \
      __VA_ARGS__();                                                         \
      break;                                                                 \
    }                                                                        \
    default:                                                                 \
      STD_TORCH_CHECK(                                                       \
          false, "Expects rank 2, 3 or 4 tensors but g
```

### Core Architecture Module: `csrc/libtorch_stable/launch_bounds_utils.h`
```
#pragma once

#include <cuda_runtime_api.h>
#include <algorithm>

// maximum blocks per SM cap
#ifndef VLLM_LAUNCH_BLOCKS_CAP
  #define VLLM_LAUNCH_BLOCKS_CAP 4
#endif

// Compile-time estimate of max threads per SM for launch bounds.
// Families: 1024, 1536, 2048 threads/SM.
#ifndef VLLM_MAX_THREADS_PER_SM
  #ifdef __CUDA_ARCH__

    /* 1024 thr/SM: Turing (sm_75) */
    #if (__CUDA_ARCH__ == 750)
      #define VLLM_MAX_THREADS_PER_SM 1024

    /* 1536 thr/SM: Ampere GA10x (sm_86/87), Ada (sm_89),
        GB20x consumer (sm_120/121), Thor (sm_101 or sm_110) */
    #elif (__CUDA_ARCH__ == 860) || (__CUDA_ARCH__ == 870) || \
        (__CUDA_ARCH__ == 890) || (__CUDA_ARCH__ == 1010) ||  \
        (__CUDA_ARCH__ == 1100) || (__CUDA_ARCH__ == 1200) || \
        (__CUDA_ARCH__ == 1210)
      #define VLLM_MAX_THREADS_PER_SM 1536

    /* 2048 thr/SM: Volta (sm_70/72), Ampere GA100 (sm_80),
        Hopper (sm_90), Blackwell (sm_100/103) */
    #elif (__CUDA_ARCH__ == 700) || (__CUDA_ARCH__ == 720) || \
        (__CUDA_ARCH__ == 800) || (__CUDA_ARCH__ == 900) ||   \
        (__CUDA_ARCH__ == 1000) || (__CUDA_ARCH__ == 1030)
      #define VLLM_MAX_THREADS_PER_SM 2048

    /* Fallback: use 2048 for unknown future CCs */
    #else
      #define VLLM_MAX_THREADS_PER_SM 2048
    #endif

  #else
  /* Host pass (no __CUDA_ARCH__): neutral default */
    #define VLLM_MAX_THREADS_PER_SM 2048
  #endif
#endif

// compute the number of blocks per SM to request in __launch_bounds__
#define VLLM_BLOCKS_DIV(VAL) (VLLM_MAX_THREADS_PER_SM / (VAL))
#define VLLM_CLAMP_BLOCKS_PER_SM(VAL) \
  (((VAL) <= 0)                       \
       ? 1                            \
       : (((VAL) < VLLM_LAUNCH_BLOCKS_CAP) ? (VAL) : VLLM_LAUNCH_BLOCKS_CAP))
#define VLLM_BLOCKS_PER_SM(BLOCK_THREADS) \
  VLLM_CLAMP_BLOCKS_PER_SM(VLLM_BLOCKS_DIV(BLOCK_THREADS))

// runtime-time helper to compute blocks/SM
static inline int vllm_runtime_blocks_per_sm(int block_threads) {
  int device = -1;
  cudaGetDevice(&device);
  int max_threads_per_sm = VLLM_MAX_THREADS_PER_SM;
  cudaDeviceGetAttribute(&max_threads_per_sm,
                         cudaDevAttrMaxThreadsPerMultiProcessor, device);
  int blocks = (block_threads > 0) ? (max_threads_per_sm / block_threads) : 1;
  return VLLM_CLAMP_BLOCKS_PER_SM(blocks);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #60037** (2026-10-05): **[Bugfix] Do not rebind torch.bmm when enabling batch invariance**
  *Symptoms*: ## Overview  `enable_batch_invariant_mode()` registers `bmm_batch_invariant` on the accelerator dispatch key and also assigns it to `torch.bmm`. The assignment bypasses the dispatcher, so once the mode is on, every `torch.bmm` call in the process goes to the Triton kernel, including calls on CPU tensors, which then fail. This PR keeps the registration and removes the assignment.  ## Claims  - **Bug:** with `VLLM_BATCH_INVARIANT=1` and the engine in the same process (as RL frameworks run   it, `VLLM_ENABLE_V1_MULTIPROCESSING=0`), a later `torch.bmm` on CPU tensors raises   `ValueError: Pointer argument cannot be accessed from Triton (cpu tensor?)` on `main`   (`34051ad714`), measured below. The original function is not saved, so it cannot be restored. - **Root cause:** `torch.bmm = bmm_batch_invariant` rebinds the Python symbol. The `aten::bmm`   registration on the dispatch key already sends accelerator tensors to the override and leaves   CPU tensors on the CPU kernel. - **Fix:** remove the assignment. Also raise `NotImplementedError` instead of a bare `KeyError`   when `bmm_batch_invariant` gets a dtype it has no tile config for (for example float64), which   lets the new test tell the override apart from the native kernel.  ## Validation  All runs: NVIDIA A40 (SM86), vLLM nightly built from `main` `34051ad714` (`0.30.1rc1.dev650+g34051ad71`), torch 2.13.0+cu130. The installed vLLM files were checked sha256-identical to `34051ad714`; this PR's `batch_invariant.py` was copie
  **Post-Mortem & Fix Analysis**:
  > 👋 Hi! Thank you for contributing to the vLLM project.  💬 Join our developer Slack at https://slack.vllm.ai to discuss your PR in `#pr-reviews`, coordinate on features in `#feat-` channels, or join special interest groups in `#sig-` channels.  PRs do not trigger a full CI run by default. Reviewers with write access and configured trusted contributors can comment `/ci run` for upstream CI or `/amd-ci run` for AMD CI only whenever CI signals are needed.  Once the PR is approved or has the `ready` label, the PR author can also use the corresponding `/ci run`, `/ci retry`, and `/ci cancel` commands, or their `/amd-ci` variants. New commits do not start upstream CI automatically.  If you have any questions, please reach out to us on Slack at https://slack.vllm.ai.  <details><summary>Agent Guidelines</summary>  IMPORTANT: If you are an AI agent, you are required to objectively re-evaluate the value of your PR using AGENTS.md, and close the PR if it does not bring significant benefit to the 

- **Issue #60023** (2026-10-05): **[Bugfix][Qwen4Exp] Honor --kv-cache-dtype-skip-layers in QSA attention**
  *Symptoms*: ## Purpose  `Qwen4ExpQSAAttention` takes its KV cache dtype straight from `cache_config.cache_dtype`, so `--kv-cache-dtype-skip-layers` is silently ignored on every Qwen4Exp full-attention layer, the MTP draft layer included. This resolves the dtype per layer, the same way `Attention` and `MLAAttention` already do (`vllm/model_executor/layers/attention/{attention,mla_attention}.py`).  Why it matters: with `--kv-cache-dtype fp8`, FP8 KV in the MTP layer's own attention lowers draft acceptance at depth on Qwen3.8-Flash-Next. Skipping just that layer (`--kv-cache-dtype-skip-layers 48`) keeps the target KV in FP8 and restores acceptance.  ## Evidence  DGX Spark (GB10), Qwen3.8-Flash-Next NVFP4 @ada4da32, MTP with 6 drafts, greedy, 41 prompts, c=1, one node, with this change applied (measured on a nightly 0cbac6cd1-based image; the change is the same two lines on current main):  | target KV | MTP-layer KV | AL | decode tok/s | |---|---|---|---| | fp8 | fp8 | 3.215 | 43.3 | | bf16 | fp8 | 3.178 | 43.7 | | fp8 | bf16 (`--kv-cache-dtype-skip-layers 48`) | 3.473 | 48.7 | | bf16 | bf16 | 3.504 | 50.0 |  With FP8 KV in the MTP layer, conditional acceptance at depth 2 to 6 is 0.66 to 0.72. With BF16 it is 0.74 to 0.80. Depth 1 is unchanged.  At 32k context (8 prompts of 32,928 tokens, 6 GiB KV), the skip costs 7% of the KV pool (211,502 to 196,608 tokens at 3 drafts). Converting the whole cache to BF16 costs 29%.  ## Duplicate check  - PRs and issues searched: "kv-cache-dtype-skip-layers
  **Post-Mortem & Fix Analysis**:
  > /ci run
  > ✅ Triggered [Buildkite CI #92872](https://buildkite.com/vllm/ci/builds/92872) for commit `f02322058e80`.
  > <!-- ci-selector-shadow --> ### CI selector (shadow): 1 test steps (1 jobs) instead of 36 (51 jobs)  Shadow mode: this changes nothing about what CI runs. It shows what the evidence-based selector would pick for this PR, next to today's rules. [How it works](https://github.com/vllm-project/ci-infra/tree/main/buildkite/ci_selector).  **Feedback welcome:** reply here if it would skip a step this change needs, or runs something unrelated.  | steps (jobs) | Today's rules | Selector | Would skip | Would add | |---|---|---|---|---| | NVIDIA, CPU and others | 36 (51) | 1 (1) | 35 (50) | 0 (0) | | AMD mirrors | 33 (43) | 0 (0) | 33 (43) | 0 (0) |  <details><summary>Selector would run (1)</summary>  - `qwen4-exp-unit-tests` </details>  <details><summary>Would skip (today's rules run them) (35)</summary>  - `ascend-npu-test` - `basic-correctness` ×2 - `basic-correctness-cpu-offload` - `basic-correctness-cumem` - `basic-correctness-prefetch-offload` - `basic-correctness-sleep-mode` - `basic-model

- **Issue #59990** (2026-10-05): **[Bugfix] Fix Qwen4Exp PLE embedding rejecting INC (AutoRound) checkpoints**
  *Symptoms*:   ## Overview  Fixes #59798. `Intel/Qwen3.8-Flash-Next-W4A16-AutoRound` is an AutoRound checkpoint, which vLLM loads as `INCConfig`. It failed at model construction with `NotImplementedError: Qwen4Exp PLE embedding does not support quantization config INCConfig`. `Qwen4ExpPLEEmbeddingMethod.from_quant_config` now asks `INCConfig` whether the PLE layer is quantized. #59431 does the same for compressed-tensors.  ## Claims  - The command from the issue (TP=2, expert parallel) no longer raises. Both workers build the PLE n-gram table with `Qwen4ExpPLEUnquantizedEmbeddingMethod` (bf16), and model construction finishes. - The checkpoint's own INC metadata makes the choice: its `extra_config` has `".*ple.*": {"bits": 16, "data_type": "float"}`. If INC says the PLE layer is quantized, the old `NotImplementedError` is still raised, because there is no INC-quantized PLE format. - The branch is in `vllm/models/qwen4_exp/common/ngram_embedding.py`, so both the NVIDIA and the AMD Qwen4Exp paths get it. - A new unit test covers both cases.  ## Validation  Hardware: 2 × NVIDIA A100-SXM4-80GB. Before: commit `18f8f96025b556071eb627076f94df560fbd3a22`. After: this PR on top of that commit.  Reproducer, from the issue. No request is needed, because the crash happens at startup:  ```bash VLLM_ENGINE_READY_TIMEOUT_S=3600 vllm serve Intel/Qwen3.8-Flash-Next-W4A16-AutoRound \   --tensor-parallel-size 2 --enable-expert-parallel ```  | | Runs | Result | |---|---|---| | Befo
  **Post-Mortem & Fix Analysis**:
  > /ci run
  > ❌ This PR is 12 commits behind upstream `main`. Your branch must contain every commit currently on upstream `main`. No new CI build was started. Merge or rebase onto the latest `main`, then rerun `/ci run`. To test this branch at your own risk, use `/ci run --allow-stale`.  <!-- vllm-ci-command:5986152433 -->
  > /ci run

- **Issue #59975** (2026-10-05): **[Bugfix] Fix Mamba page size AssertionError with spec decoding on GraniteMoeHybrid, FalconH1 and Zamba2**
  *Symptoms*:   ## Overview  This fixes the `AssertionError` in `MambaSpec.page_size_bytes` that stops the engine at startup. It happens when `GraniteMoeHybridForCausalLM` (for example `ibm-granite/granite-4.0-h-tiny`) runs with speculative decoding and `num_speculative_tokens=2`. The config-time Mamba state shape now counts the speculative tokens, the same way the layer does. `FalconH1ForCausalLM` and `Zamba2ForCausalLM` had the same one-line gap and get the same fix.  Fixes #57721  ## Claims  - `ibm-granite/granite-4.0-h-tiny` with ngram speculative decoding and `num_speculative_tokens=2` now starts. Before this fix, it failed during KV cache setup with `AssertionError` at `vllm/v1/kv_cache_interface.py:1075`. - `GraniteMoeHybridForCausalLM`, `FalconH1ForCausalLM` and `Zamba2ForCausalLM` now pass `num_spec=vllm_config.num_speculative_tokens` in `get_mamba_state_shape_from_config`. `Mamba2ForCausalLM` and `NemotronHForCausalLM` already do this. - A new unit test checks the config-time shape of these three models when speculative tokens are set.  ## Validation  Setup: 1 × NVIDIA H100 80GB HBM3. vLLM at commit `18f8f96025b556071eb627076f94df560fbd3a22` (`0.30.1rc1.dev630+g18f8f9602`), editable install. This PR is one commit on top of that commit.  Reproducer (`repro.py`), from the issue:  ```python from vllm import LLM print('=== Starting LLM with num_speculative_tokens=2 ===') llm = LLM(     model='ibm-granite/granite-4.0-h-tiny',     max_model_len=4096,     specu
  **Post-Mortem & Fix Analysis**:
  > /ci run
  > ✅ Triggered [Buildkite CI #92849](https://buildkite.com/vllm/ci/builds/92849) for commit `a3c3236f1343`.
  > <!-- ci-selector-shadow --> ### CI selector (shadow): 14 test steps (40 jobs) instead of 62 (96 jobs)  Shadow mode: this changes nothing about what CI runs. It shows what the evidence-based selector would pick for this PR, next to today's rules. [How it works](https://github.com/vllm-project/ci-infra/tree/main/buildkite/ci_selector).  **Feedback welcome:** reply here if it would skip a step this change needs, or runs something unrelated.  | steps (jobs) | Today's rules | Selector | Would skip | Would add | |---|---|---|---|---| | NVIDIA, CPU and others | 62 (96) | 14 (40) | 53 (66) | 5 (10) | | AMD mirrors | 59 (88) | 8 (24) | 53 (66) | 2 (2) |  <details><summary>Selector would run (14)</summary>  - `arm-cpu-test` ×3 - `basic-models-tests-extra-initialization` ×14 - `cpu-language-generation-and-pooling-model-tests` ×3 - `cpu-multi-modal-model-tests-n` ×4 - `entrypoints-integration-api-server-generate` - `hybrid-ssm-nixlconnector-pd-accuracy-tests-4-gpus` - `hybrid-ssm-nixlconnector-pd-

- **Issue #59969** (2026-10-05): **[Bugfix][ROCm] Bound sparse indexer decode workspace at layer build time**
  *Symptoms*:   ## Overview  ROCm-only alternative to #58014 for #55132. The ROCm sparse-MLA indexer works out its decode-row bound when the layer is built and passes it to the ROCm ops, instead of reading the vLLM config during the profiling run. `gpu_worker.py` is not changed.  ## Claims  - The decode-logits workspace reserved during memory profiling is `max_num_seqs * (1 + num_speculative_tokens)` rows again, not `max_num_batched_tokens` rows. This covers the AITER FP8 indexer (`rocm_aiter_sparse_attn_indexer`) and the MXFP4 indexer (`rocm_mxfp4_sparse_attn_indexer` / `rocm_mxfp4_sparse_mqa_indexer`). - DeepSeek-V4.1-Flash on 8x MI355X at 1M context gets about 32 GiB more KV cache per GPU. - The CUDA path and shared worker / model-runner code are unchanged.  ## Validation  End-to-end on 8x MI355X (gfx950) with dummy weights:  ```bash VLLM_ROCM_USE_AITER=1 vllm serve deepseek-ai/DeepSeek-V4.1-Flash --load-format dummy -tp 8 \   --max-model-len 1048576 --max-num-seqs 16 --max-num-batched-tokens 8192 \   --attention-config '{"indexer_kv_dtype":"mxfp4"}' ```  | | Available KV cache memory (per GPU) | GPU KV cache size | |---|---|---| | main (`89439db727`) | 174.95 GiB | 90,340,997 tokens | | this PR | 206.92 GiB | 106,889,551 tokens |  The 31.97 GiB difference matches the expected saving: (8192 − 96) rows × 1M columns × 4 B ≈ 31.6 GiB. With the fix, 16 concurrent completions (prompts of 301–4801 tokens, 32 output tokens each) all finished with no workspace errors. That confirms the smaller 
  **Post-Mortem & Fix Analysis**:
  > This pull request has merge conflicts that must be resolved before it can be merged. Please rebase the PR, @Fangzhou-Ai.  https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/syncing-a-fork 

- **Issue #59955** (2026-10-05): **[Bugfix][Sampler] Do not use the FlashInfer sampler when has_flashinfer() is False**
  *Symptoms*: <!-- markdownlint-disable -->  ## Overview  `flashinfer_sampler_supported()` now returns False when `has_flashinfer()` does, so the sampler falls back to the native top-k/top-p path instead of JIT-compiling FlashInfer kernels that cannot be built.  Fixes #59954.  ## Claims  - Without `flashinfer-cubin`, and with `nvcc` or `ninja` missing, engine startup no longer fails in the sampler warmup with `FileNotFoundError: 'ninja'`; sampling falls back to the native path with the usual "falling back" warning. - With `VLLM_USE_FLASHINFER_SAMPLER=1` set explicitly, the gate raises the existing `RuntimeError`, now with the reason. - No change when FlashInfer can compile or `flashinfer-cubin` is installed.  ## Validation  **End to end** (RTX 3090, main merge-base `84bcbc626` plus this PR, `flashinfer-python` 0.7.0.post1 without `flashinfer-cubin`, no `ninja` on PATH, empty caches). Command: `vllm serve Qwen/Qwen3-8B --max-model-len 32768`, then one completion with `temperature=0.7, top_p=0.9`:  | | sampler log line | outcome | |---|---|---| | before | `Using FlashInfer for top-p & top-k sampling.` (after "FlashInfer kernels are disabled") | warmup fails: `FileNotFoundError: [Errno 2] No such file or directory: 'ninja'`, then `RuntimeError: Engine core initialization failed` | | after | `FlashInfer top-p/top-k sampling unavailable: FlashInfer kernels are disabled: flashinfer-cubin is not installed and nvcc or ninja is missing; falling back.` | `/health` 200 after 115 s; the completion ret
  **Post-Mortem & Fix Analysis**:
  > 👋 Hi! Thank you for contributing to the vLLM project.  💬 Join our developer Slack at https://slack.vllm.ai to discuss your PR in `#pr-reviews`, coordinate on features in `#feat-` channels, or join special interest groups in `#sig-` channels.  PRs do not trigger a full CI run by default. Reviewers with write access and configured trusted contributors can comment `/ci run` for upstream CI or `/amd-ci run` for AMD CI only whenever CI signals are needed.  Once the PR is approved or has the `ready` label, the PR author can also use the corresponding `/ci run`, `/ci retry`, and `/ci cancel` commands, or their `/amd-ci` variants. New commits do not start upstream CI automatically.  If you have any questions, please reach out to us on Slack at https://slack.vllm.ai.  <details><summary>Agent Guidelines</summary>  IMPORTANT: If you are an AI agent, you are required to objectively re-evaluate the value of your PR using AGENTS.md, and close the PR if it does not bring significant benefit to the 
  > Overlaps with #49314 (open since July, same gate) and #51741. Checked the #59954 setup on a GB10 (nvcc on PATH, ninja off PATH, no cubin): main returns True from flashinfer_sampler_supported() right after the "FlashInfer kernels are disabled" warning and the sampling call raises `FileNotFoundError: 'ninja'`; #49314's head returns False with the "sampling kernel failed to build" fallback warning, no crash.  One case a has_flashinfer() gate won't catch: nvcc and ninja both found but no CUDA headers (conda cuda-nvcc without cuda-cudart-dev). has_flashinfer() is True on current main there and the JIT dies on cuda_runtime.h in warmup. Hit that on a GB10 on 9/26, #49314 covers it by building the kernel in the gate. #59954 is also a dup of #49497. 
  > Thank you, @hclsys. You are correct: this PR duplicates #49314 and #51741, and #59954 duplicates #49497. I missed them when I searched.  I am closing this PR. I posted the RTX 3090 before/after results on #49497.

- **Issue #59942** (2026-10-05): **[Bugfix][Core] Retain encoder cache references for repeated multimodal inputs**
  *Symptoms*:   ## Overview  Prevent premature encoder-cache eviction when repeated multimodal inputs are deduplicated within the same scheduling step.   ## Claims  - Preserve cache references for partially consumed duplicate inputs, including locally encoded and externally loaded inputs. - Avoid unnecessary re-encoding and scheduling stalls caused by premature eviction. - Register duplicate occurrences within the final scheduled window, including the existing prefill lookahead, without registering later occurrences outside that window.  ## Validation  On upstream base `d61081dc3d`, using the existing development environment:  ```bash uv run --no-project --python /workspace/vllm/.venv/bin/python -m pytest \   tests/v1/core/test_scheduler.py \   tests/v1/core/test_async_scheduler.py \   tests/v1/core/test_encoder_cache_manager.py -q ```  Result: **241 passed, 2 failed**.  Both failures require multiple GPUs and also fail on the unchanged upstream base in the same single-GPU environment:  - `test_async_scheduling_pp_allows_rescheduling_with_output_placeholders` - `test_diffusion_read_deferral_keeps_a_longer_pp_wait`  The new parameterized regression test covers newly admitted and running requests, with local encoding and external cache loads. All four cases pass. It verifies that:  - a competing request cannot evict an input that still has a partially consumed duplicate; - no additional local encoding is scheduled; and - later unscheduled occurrences are not
  **Post-Mortem & Fix Analysis**:
  > 👋 Hi! Thank you for contributing to the vLLM project.  💬 Join our developer Slack at https://slack.vllm.ai to discuss your PR in `#pr-reviews`, coordinate on features in `#feat-` channels, or join special interest groups in `#sig-` channels.  PRs do not trigger a full CI run by default. Reviewers with write access and configured trusted contributors can comment `/ci run` for upstream CI or `/amd-ci run` for AMD CI only whenever CI signals are needed.  Once the PR is approved or has the `ready` label, the PR author can also use the corresponding `/ci run`, `/ci retry`, and `/ci cancel` commands, or their `/amd-ci` variants. New commits do not start upstream CI automatically.  If you have any questions, please reach out to us on Slack at https://slack.vllm.ai.  <details><summary>Agent Guidelines</summary>  IMPORTANT: If you are an AI agent, you are required to objectively re-evaluate the value of your PR using AGENTS.md, and close the PR if it does not bring significant benefit to the 
  > ✅ @bzsuni, CI is now available for this PR.  - `/ci run` starts upstream CI; `/amd-ci run` starts AMD CI only. - Your branch must contain every commit currently on its upstream target branch. Merge or rebase onto the latest target branch, then rerun the command. Append `--allow-stale` to a run command to test an outdated branch at your own risk. - `/ci retry` retries failed jobs in the CI build for the current PR head. If the current head has no CI build, it starts a new CI build for the current head containing only jobs that failed in the latest earlier CI build for this PR. - `/amd-ci retry` retries failed jobs in AMD CI for the current PR head. Use `/amd-ci run` when the current head has no AMD CI build. - `/ci cancel` cancels scheduled or running CI builds for this PR branch; `/amd-ci cancel` does the same for AMD CI only.  <!-- vllm-ci-authorized -->
  > /ci run

- **Issue #59876** (2026-10-04): **[Bug]: Multimodal chat requests silently drop all images when request-level chat_template_kwargs is present (v0.30.0, Gemma-4-26B-A4B)**
  *Symptoms*: ### Your current environment  vLLM version: 0.30.0 Model: Gemma-4-26B-A4B (NVFP4, ModelOpt quantization) GPU: NVIDIA RTX PRO 4500 Blackwell (32 GiB), driver 610.57.04 Deployment: official image docker.io/vllm/vllm-openai:v0.30.0, podman  ### 🐛 Describe the bug  Describe the bug  On /v1/chat/completions, the presence of any request-level chat_template_kwargs causes all images in the request to be silently dropped. The rendered prompt contains only the text portion (usage.prompt_tokens ≈ 20 instead of ≈ 276 for one image), the server returns 200 OK, and the model correctly reports that no image was provided. No error or warning is logged. The identical payload without chat_template_kwargs processes images normally.  To reproduce  Server: vllm serve /models/gemma-4-26b \   --served-model-name gemma-4-26b \   --max-model-len 262144 \   --trust-remote-code \   --enable-auto-tool-choice --tool-call-parser gemma4 --reasoning-parser gemma4 \   --gpu-memory-utilization 0.85 --kv-cache-dtype fp8 \   --limit-mm-per-prompt '{"image":3,"audio":0,"video":0}' \   --default-chat-template-kwargs '{"enable_thinking":true}'  Request A (control, works — images processed): {   "model": "gemma-4-26b",   "messages": [{"role": "user", "content": [     {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,<B64>"}},     {"type": "text", "text": "Describe this scene in detail."}   ]}],   "temperature": 0.7, "max_tokens": 4096 }  Result: usage.prompt_tokens: 276, image-grounded description
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this. Since prompt_tokens drops from ~276 to ~22 and the per-request kwargs duplicate the server default, the images look to be lost during chat preprocessing when request-level chat_template_kwargs are merged, before the template renders. I'll reproduce it at the rendering stage on CPU with a small multimodal model's processor (no GPU or weights needed), find where the multimodal content is dropped, and open a PR with a regression test that renders the same multimodal request with and without chat_template_kwargs and checks the image placeholders survive. @thorium115, if you can share whether the same thing happens with --default-chat-template-kwargs unset, that would help narrow it down.
  > Update: I couldn't reproduce this, and the evidence points away from my earlier guess that request-level `chat_template_kwargs` drop images during merging.  With the issue's server flags (gemma4 tool/reasoning parsers, `--limit-mm-per-prompt '{"image":3,"audio":0,"video":0}'`, `--default-chat-template-kwargs '{"enable_thinking":true}'`), the image is kept with and without request-level kwargs in every setup I tried, without loading weights:  - `render_chat` with `google/gemma-4-E2B-it` on main: 284 tokens with no kwargs, 284 with `enable_thinking: true`, 277 with `enable_thinking: false`, image kept in all three. - Same on v0.30.0: identical results. - `render_chat` with `google/gemma-4-26B-A4B-it` on main: 284 / 284 / 281, image kept. - `POST /v1/chat/completions/render` with 1 image: 284 / 284 / 277; with 3 images: 808 / 808 / 801.  In the code, request kwargs are a plain dict merge over the server defaults (`build_chat_params`, `ChatParams.with_defaults`), the content format is reso
  > Closing this as not-a-bug — the reported behavior was an artifact of our test harness, not vLLM. Apologies for the noise, and thank you for the investigation trail: the artifact checklist in your reply (raw payloads + integrity attestation) is precisely what exposed our own bug.  ## Root cause (ours)  The script that generated our reproduction payloads failed to forward the image arguments to the payload builder — a missing positional argument pass- through in the shell function. The "with image" payloads were silently emitted as text-only. Inspection of the stored payload files confirms: no `image_url` content parts in any of the originally failing payloads (payload sizes ~220 bytes vs ~24 KB expected for an embedded image; `prompt_tokens` 19–27 with the model correctly replying that no image was provided).  The 200 OK + "please provide the image" responses were the model accurately answering what it actually received.  ## Corrected reproduction (image verified present in all payloads

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

### Incident Patch 1: `d09ff776` (2026-10-05)
**Commit Message**: [Bugfix] Give each data-parallel engine its own global RNG streams (#59788)

Signed-off-by: aoshen02 <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `tests/utils_/test_torch_utils.py` (modified, +15/-0)
```diff
@@ -14,6 +14,7 @@
     is_lossless_cast,
     is_quantized_kv_cache,
     set_default_torch_dtype,
+    set_random_seed,
     set_torch_threads_for_runtime,
     startup_omp_num_threads,
 )
@@ -217,3 +218,17 @@ def test_async_tensor_h2d_staging(device):
         async_tensor_h2d([1, 2, 3], device=device, dtype=torch.int32),
         torch.tensor([1, 2, 3], dtype=torch.int32, device=device),
     )
+
+
+def test_set_random_seed_differs_per_data_parallel_index():
+    """Unseeded requests draw from the global RNGs; DP engines sharing the engine
+    seed must get distinct, reproducible streams, and index 0 keeps the seed."""
+
+    def draws(*args):
+        set_random_seed(*args)
+        return np.random.randint(2**31, size=4).tolist(), torch.rand(4).tolist()
+
+    assert draws(42, 0) == draws(42)
+    assert draws(42, 1) == draws(42, 1)
+    assert len({str(draws(42, i)) for i in range(4)}) == 4
+    assert draws(42, 1) != draws(43, 1)
```

**File**: `vllm/utils/torch_utils.py` (modified, +5/-1)
```diff
@@ -530,8 +530,12 @@ def kv_cache_dtype_str_to_dtype(
     return STR_DTYPE_TO_TORCH_DTYPE[kv_cache_dtype]
 
 
-def set_random_seed(seed: int | None) -> None:
+def set_random_seed(seed: int | None, data_parallel_index: int = 0) -> None:
     if seed is not None:
+        if data_parallel_index:
+            # DP engines share the seed but must not sample unseeded requests alike.
+            ss = np.random.SeedSequence((seed, data_parallel_index))
+            seed = int(ss.generate_state(1)[0])
         random.seed(seed)
         np.random.seed(seed)
         torch.manual_seed(seed)
```

**File**: `vllm/v1/worker/cpu_worker.py` (modified, +3/-1)
```diff
@@ -268,7 +268,9 @@ def compile_or_warm_up_model(self) -> CompilationTimes:
             self.model_runner.warming_up_model()
         # Reset the seed to ensure that the random state is not affected by
         # the model initialization and profiling.
-        set_random_seed(self.model_config.seed)
+        set_random_seed(
+            self.model_config.seed, self.parallel_config.data_parallel_index
+        )
         return CompilationTimes(
             language_model=self.compilation_config.compilation_time,
             encoder=self.compilation_config.encoder_compilation_time,
```

**File**: `vllm/v1/worker/gpu_worker.py` (modified, +3/-1)
```diff
@@ -1020,7 +1020,9 @@ def compile_or_warm_up_model(self) -> CompilationTimes:
 
         # Reset the seed to ensure that the random state is not affected by
         # the model initialization and profiling.
-        set_random_seed(self.model_config.seed)
+        set_random_seed(
+            self.model_config.seed, self.parallel_config.data_parallel_index
+        )
 
         # Eagerly trigger inductor's once-per-process lazy inits during
         # warmup (rather than on a later compile cache-miss at runtime).
```

---

### Incident Patch 2: `877ddcc4` (2026-10-05)
**Commit Message**: [Bugfix][Spec Decode] Reserve the bonus KV slot for fill-in DSpark (#59105)

Signed-off-by: Evgeny Savinov <[REDACTED_EMAIL]>
Co-authored-by: Codex <[REDACTED_EMAIL]>
Co-authored-by: Tomas Ruiz <[REDACTED_EMAIL]>

**File**: `tests/v1/worker/test_gpu_warmup_blocks.py` (modified, +24/-14)
```diff
@@ -314,24 +314,28 @@ def _step(num_new_tokens: int) -> None:
 
 
 @pytest.mark.parametrize(
-    ("method", "expected"),
+    ("method", "draft_hf_config", "expected"),
     [
-        ("eagle", NUM_SPEC_STEPS),
-        ("eagle3", NUM_SPEC_STEPS),
-        ("mtp", NUM_SPEC_STEPS),
-        ("dspark", NUM_SPEC_STEPS),
-        ("draft_model", NUM_SPEC_STEPS),
+        ("eagle", None, NUM_SPEC_STEPS),
+        ("eagle3", None, NUM_SPEC_STEPS),
+        ("mtp", None, NUM_SPEC_STEPS),
+        ("dspark", None, NUM_SPEC_STEPS),
+        ("dspark", {"sample_from_anchor": True}, NUM_SPEC_STEPS),
+        ("dspark", {"sample_from_anchor": False}, NUM_SPEC_STEPS + 1),
+        ("draft_model", None, NUM_SPEC_STEPS),
         # DFlash's in-fill decoding adds a query for the last sampled token.
-        ("dflash", NUM_SPEC_STEPS + 1),
-        ("ngram", 0),
-        ("ngram_gpu", 0),
-        ("medusa", 0),
-        ("mlp_speculator", 0),
-        ("suffix", 0),
-        ("extract_hidden_states", 0),
+        ("dflash", None, NUM_SPEC_STEPS + 1),
+        ("ngram", None, 0),
+        ("ngram_gpu", None, 0),
+        ("medusa", None, 0),
+        ("mlp_speculator", None, 0),
+        ("suffix", None, 0),
+        ("extract_hidden_states", None, 0),
     ],
 )
-def test_num_lookahead_tokens_per_method(method: str, expected: int):
+def test_num_lookahead_tokens_per_method(
+    method: str, draft_hf_config: dict | None, expected: int
+):
     """`VllmConfig.num_lookahead_tokens` is the single source of the reservation.
 
     Both the scheduler and the warmup read it, so a wrong answer here silently
@@ -350,6 +354,12 @@ class _Config:
     speculative_config = object.__new__(SpeculativeConfig)
     object.__setattr__(speculative_config, "method", method)
     object.__setattr__(speculative_config, "num_speculative_tokens", NUM_SPEC_STEPS)
+    hf_config = SimpleNamespace(**(draft_hf_config or {}))
+    object.__setattr__(
+        speculative_config,
+        "draft_model_config",
+        SimpleNamespace(hf_config=hf_config),
+    )
 
     config = _Config()
     config.speculative_config = speculative_config
```

**File**: `vllm/config/vllm.py` (modified, +7/-5)
```diff
@@ -640,13 +640,15 @@ def num_lookahead_tokens(self) -> int:
         speculative_config = self.speculative_config
         if speculative_config is None:
             return 0
-        if speculative_config.use_dflash():
-            # DFlash requires an extra lookahead slot since it uses in-fill-style
-            # decoding instead of standard next-token sampling, so it has a query
-            # for the last sampled token plus queries for each draft token.
+        dspark_fill_in = speculative_config.use_dspark() and not getattr(
+            speculative_config.draft_model_config.hf_config, "sample_from_anchor", True
+        )
+        if speculative_config.use_dflash() or dspark_fill_in:
+            # Fill-in drafting uses a bonus query plus one query per draft token.
+            # DSpark's anchor-sampling layout does not need the extra slot.
             return self.num_speculative_tokens + 1
         if speculative_config.use_eagle() or speculative_config.uses_draft_model():
-            # DSpark (covered by use_eagle) drafts a block of num_speculative_tokens
+            # Anchor-sampling DSpark drafts a block of num_speculative_tokens
             # query tokens in which the anchor itself is the first prediction
             # position (no separate bonus query), so it needs exactly
             # num_speculative_tokens lookahead slots.
```

---

### Incident Patch 3: `54d93af9` (2026-10-05)
**Commit Message**: [Bugfix][HiSparse] Reject cudagraph_mode=FULL at startup (#59688)

Signed-off-by: Matthew Bonanni <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `tests/test_config.py` (modified, +11/-0)
```diff
@@ -502,6 +502,17 @@ def test_hisparse_rejects_pipeline_parallelism(monkeypatch):
         )
 
 
+def test_hisparse_rejects_full_cudagraph_mode(monkeypatch):
+    monkeypatch.setattr(current_platform, "is_cuda", lambda: True)
+    monkeypatch.setattr(current_platform, "support_static_graph_mode", lambda: True)
+    monkeypatch.setattr("vllm.config.vllm.HAS_TRITON", True)
+    with pytest.raises(ValueError, match="does not support cudagraph_mode=FULL"):
+        VllmConfig(
+            attention_config=AttentionConfig(hisparse_config=HiSparseConfig()),
+            compilation_config=CompilationConfig(cudagraph_mode=CUDAGraphMode.FULL),
+        )
+
+
 def test_hisparse_rejects_disabled_hybrid_kv_cache_manager(monkeypatch):
     monkeypatch.setattr(current_platform, "is_cuda", lambda: True)
     monkeypatch.setattr("vllm.config.vllm.HAS_TRITON", True)
```

**File**: `vllm/config/vllm.py` (modified, +6/-0)
```diff
@@ -1836,6 +1836,12 @@ def has_blocked_weights():
                 raise ValueError(
                     "HiSparse does not support decode context parallelism."
                 )
+            if self.compilation_config.cudagraph_mode == CUDAGraphMode.FULL:
+                raise ValueError(
+                    "HiSparse does not support cudagraph_mode=FULL; use "
+                    "FULL_AND_PIECEWISE (the default), which captures FULL graphs "
+                    "for decode batches."
+                )
             if not self.scheduler_config.scheduler_reserve_full_isl:
                 # Without it, async loads admitted against free host blocks can
                 # each wait on host pages the others hold, and waiting requests
```

---

### Incident Patch 4: `87954c5b` (2026-10-05)
**Commit Message**: [CI/Build] Declare the video modality on the CohereCompass reference model (#60063)

Signed-off-by: Stefan Koncarevic <[REDACTED_EMAIL]>
Co-authored-by: Andreas Karatzas <[REDACTED_EMAIL]>

**File**: `tests/models/multimodal/generation/test_transformers_video.py` (modified, +4/-0)
```diff
@@ -36,6 +36,7 @@
             "<|VISION_START|><|VIDEO_PAD|><|VISION_END|>Describe this video."
             "<|END_OF_TURN_TOKEN|><|START_OF_TURN_TOKEN|><|CHATBOT_TOKEN|>"
         ),
+        "patch_hf_runner": model_utils.cohere_compass_patch_hf_runner,
     },
     "Qwen/Qwen2.5-VL-3B-Instruct": {
         "prompt": (
@@ -88,6 +89,9 @@ def test_transformers_video_generation(
         model_id, dtype="bfloat16", auto_cls=AutoModelForImageTextToText
     ) as hf_model:
         hf_model = model_utils.qwen3_vl_patch_hf_runner(hf_model)
+        patch_hf_runner = VIDEO_MODEL_SETTINGS[model_id].get("patch_hf_runner")
+        if patch_hf_runner is not None:
+            hf_model = patch_hf_runner(hf_model)
         hf_outputs = hf_model.generate_greedy_logprobs_limit(
             [prompt], 128, num_logprobs=10, videos=[video]
         )
```

**File**: `tests/models/multimodal/generation/vlm_utils/model_utils.py` (modified, +13/-0)
```diff
@@ -1111,6 +1111,19 @@ def processor(*args, videos=None, **kwargs):
     return hf_model
 
 
+def cohere_compass_patch_hf_runner(hf_model: HfRunner) -> HfRunner:
+    """Declare the video modality that CohereCompass omits upstream.
+
+    Without it ``generate`` leaves ``pixel_values_videos`` unconsumed and the
+    forward pass rejects it, see huggingface/transformers#49320. Drop this once
+    the pinned transformers declares the modality itself.
+    """
+    model = hf_model.model
+    if "video" not in model.input_modalities:
+        model.input_modalities = (*model.input_modalities, "video")
+    return hf_model
+
+
 def voxtral_patch_hf_runner(hf_model: "HfRunner") -> "HfRunner":
     """Patch HfRunner for Voxtral's conversation-based processor.
 
```

---

### Incident Patch 5: `528772a4` (2026-10-05)
**Commit Message**: [Bugfix][Core] Retain encoder cache references for repeated multimodal inputs (#59942)

Signed-off-by: bzsuni <[REDACTED_EMAIL]>
Signed-off-by: cjackal <[REDACTED_EMAIL]>
Co-authored-by: cjackal <[REDACTED_EMAIL]>

**File**: `tests/v1/core/test_scheduler.py` (modified, +27/-0)
```diff
@@ -688,6 +688,33 @@ def test_throttle_capacity_bound_guard_admits():
     assert "b" in output.num_scheduled_tokens
 
 
+def test_same_step_duplicate_encoder_input_stays_cached():
+    scheduler = create_scheduler(
+        model="llava-hf/llava-1.5-7b-hf",
+        max_num_batched_tokens=1024,
+        max_model_len=2048,
+    )
+    request = create_requests(
+        1,
+        num_tokens=2000,
+        req_ids=["repeated"],
+        mm_hashes_list=[["image", "image", "image"]],
+        mm_positions=[
+            [PlaceholderRange(offset=offset, length=576) for offset in (0, 600, 1300)]
+        ],
+    )[0]
+    scheduler.add_request(request)
+
+    output = scheduler.schedule()
+    assert output.scheduled_encoder_inputs == {request.request_id: [0]}
+    _model_output(scheduler, output, [[]])
+
+    # The second occurrence is partially consumed; the third is not scheduled.
+    cache = scheduler.encoder_cache_manager
+    assert cache.get_cached_input_ids(request) == {1}
+    assert "image" not in cache.freeable
+
+
 def test_no_mm_input_chunking():
     # Disable multimodal input chunking.
     scheduler = create_scheduler(
```

**File**: `vllm/v1/core/sched/scheduler.py` (modified, +38/-25)
```diff
@@ -709,13 +709,15 @@ def schedule(self, throttle_prefills: bool = False) -> SchedulerOutput:
             # Schedule encoder inputs.
             encoder_inputs_to_schedule = None
             external_load_encoder_input: list[int] = []
+            duplicate_encoder_inputs: list[int] = []
             new_encoder_compute_budget = encoder_compute_budget
             if request.has_encoder_inputs:
                 (
                     encoder_inputs_to_schedule,
                     num_new_tokens,
                     new_encoder_compute_budget,
                     external_load_encoder_input,
+                    duplicate_encoder_inputs,
                 ) = self._try_schedule_encoder_inputs(
                     request,
                     request.num_computed_tokens,
@@ -856,17 +858,13 @@ def schedule(self, throttle_prefills: bool = False) -> SchedulerOutput:
             # Encoder-related.
             if encoder_inputs_to_schedule:
                 scheduled_encoder_inputs[request_id] = encoder_inputs_to_schedule
-                # Allocate the encoder cache.
-                for i in encoder_inputs_to_schedule:
-                    self.encoder_cache_manager.allocate(request, i)
-                    if self.ec_connector is not None:
-                        self.ec_connector.update_state_after_alloc(request, i)
                 encoder_compute_budget = new_encoder_compute_budget
-            if external_load_encoder_input:
-                for i in external_load_encoder_input:
-                    self.encoder_cache_manager.allocate(request, i)
-                    if self.ec_connector is not None:
-                        self.ec_connector.update_state_after_alloc(request, i)
+            if encoder_inputs_to_schedule or external_load_encoder_input:
+                self._allocate_encoder_inputs(
+                    request,
+                    (encoder_inputs_to_schedule or []) + external_load_encoder_input,
+                    duplicate_encoder_inputs,
+                )
 
         # Record the LoRAs in scheduled_running_reqs
         scheduled_loras: set[int] = set()
@@ -1065,6 +1063,7 @@ def skip_request(from_queue: RequestQueue) -> None:
 
                 encoder_inputs_to_schedule = None
                 external_load_encoder_input = []
+                duplicate_encoder_inputs = []
                 new_encoder_compute_budget = encoder_compute_budget
                 pad_spec_decode = False
 
@@ -1166,6 +1165,7 @@ def skip_request(from_queue: RequestQueue) -> None:
                             num_new_tokens,
                             new_encoder_compute_budget,
                             external_load_encoder_input,
+                            duplicate_encoder_inputs,
                         ) = self._try_schedule_encoder_inputs(
                             request,
                             num_computed_tokens,
@@ -1335,18 +1335,14 @@ def skip_request(from_queue: RequestQueue) -> None:
                 # Encoder-related.
                 if encoder_inputs_to_schedule:
                     scheduled_encoder_inputs[request_id] = encoder_inputs_to_schedule
-                    # Allocate the encoder cache.
-                    for i in encoder_inputs_to_schedule:
-                        self.encoder_cache_manager.allocate(request, i)
-                        if self.ec_connector is not None:
-                            self.ec_connector.update_state_after_alloc(request, i)
                     encoder_compute_budget = new_encoder_compute_budget
-                # Allocate for external load encoder cache
-                if external_load_encoder_input:
-                    for i in external_load_encoder_input:
-                        self.encoder_cache_manager.allocate(request, i)
-                        if self.ec_connector is not None:
-                            self.ec_connector.update_state_after_alloc(request, i)
+                if encoder_inputs_to_schedule or external_load_encoder_input:
+                    self._allocate_encoder_inputs(
+                        request,
+                        (encoder_inputs_to_schedule or [])
+                        + external_load_encoder_input,
+                        duplicate_encoder_inputs,
+                    )
 
             # re-queue requests skipped in this pass ahead of older skipped items.
             if step_skipped_kv_holding:
@@ -1742,14 +1738,28 @@ def _reject_on_encoder_cache_embed_mismatch(
         self.encoder_cache_mismatch_reqs.add(request.request_id)
         return True
 
+    def _allocate_encoder_inputs(
+        self,
+        request: Request,
+        input_ids: list[int],
+        duplicate_input_ids: list[int],
+    ) -> None:
+        for input_id in input_ids:
+            self.encoder_cache_manager.allocate(request, input_id)
+            if self.ec_connector is not None:
+                self.ec_connector.update_state_after_alloc(request, input_id)
+
+        for input_id in duplicat
```

---

### Incident Patch 6: `edde9d2c` (2026-10-05)
**Commit Message**: Remove redundant dependency requirement for TPU (#59977)

Signed-off-by: Charles Li <[REDACTED_EMAIL]>

**File**: `requirements/tpu.txt` (modified, +0/-1)
```diff
@@ -9,7 +9,6 @@ wheel
 jinja2>=3.1.6
 ray[default]
 ray[data]
-setuptools==78.1.0
 setuptools-rust>=1.9.0
 nixl==0.3.0
 tpu-inference==0.30.0
```

---

### Incident Patch 7: `f2d8fbf4` (2026-10-05)
**Commit Message**: [CI/Build] Run the prefill token scoring test under batch invariance (#60056)

Signed-off-by: Stefan Koncarevic <[REDACTED_EMAIL]>

**File**: `tests/v1/sample/test_logprobs.py` (modified, +4/-0)
```diff
@@ -1407,6 +1407,10 @@ def test_prompt_logprobs_with_chunking_and_preemption():
 def test_prompt_logprob_token_ids_with_chunking_and_preemption(monkeypatch):
     """Per-row scores stay row-aligned across chunked prefill and preemption."""
     monkeypatch.setenv("VLLM_USE_V2_MODEL_RUNNER", "1")
+    # The ragged check below compares a second generate call against the first
+    # one. Default kernel selection varies between processes, which moves bf16
+    # logprob tails by up to 0.2; under this the two runs are bit-identical.
+    monkeypatch.setenv("VLLM_BATCH_INVARIANT", "1")
 
     prompts = [
         "The following numbers of the sequence "
```

---

### Incident Patch 8: `60932a64` (2026-10-05)
**Commit Message**: [Bugfix][Structured Output] Preserve literal values in Guidance disable_additional_properties (#58709)

Signed-off-by: Abhay Joshi <[REDACTED_EMAIL]>
Co-authored-by: Antigravity <[REDACTED_EMAIL]>
Co-authored-by: Artem Perevedentsev <[REDACTED_EMAIL]>

**File**: `tests/v1/structured_output/test_backend_guidance.py` (modified, +84/-1)
```diff
@@ -1,5 +1,6 @@
 # SPDX-License-Identifier: Apache-2.0
 # SPDX-FileCopyrightText: Copyright contributors to the vLLM project
+import json
 import time
 from concurrent.futures import Future
 
@@ -14,7 +15,10 @@
 from vllm.tokenizers import get_tokenizer
 from vllm.v1.request import Request
 from vllm.v1.structured_output import StructuredOutputManager
-from vllm.v1.structured_output.backend_guidance import GuidanceBackend
+from vllm.v1.structured_output.backend_guidance import (
+    GuidanceBackend,
+    process_for_additional_properties,
+)
 from vllm.v1.structured_output.backend_types import StructuredOutputOptions
 
 TOKENIZER = "openai-community/gpt2"
@@ -236,3 +240,82 @@ def test_mistral_tokenizer_compile_grammar(
     grammar = backend.compile_grammar(request_type, grammar_spec)
     assert grammar is not None
     assert not grammar.is_terminated()
+
+
+def test_process_for_additional_properties_preserves_literals() -> None:
+    """Literal values under const/enum/default/examples must not be rewritten
+    when they contain a 'properties' or 'patternProperties' key (#58695)."""
+    feature = {
+        "type": "Feature",
+        "geometry": None,
+        "properties": {"name": "HQ"},
+        "patternProperties": {"^x": "y"},
+    }
+    schema = {
+        "type": "object",
+        "properties": {
+            "const_field": {"const": feature},
+            "enum_field": {"enum": [feature]},
+            "default_field": {"type": "object", "default": feature},
+            "examples_field": {"type": "object", "examples": [feature]},
+            "properties": {"type": "string"},
+            "const": {
+                "type": "object",
+                "properties": {"id": {"type": "integer"}},
+            },
+        },
+        "$defs": {
+            "item": {
+                "type": "object",
+                "properties": {"label": {"type": "string"}},
+            }
+        },
+    }
+
+    processed = process_for_additional_properties(schema)
+
+    assert processed["additionalProperties"] is False
+    assert processed["$defs"]["item"]["additionalProperties"] is False
+    assert processed["properties"]["const"]["additionalProperties"] is False
+    assert "additionalProperties" not in processed["properties"]
+    assert processed["properties"]["const_field"]["const"] == feature
+    assert processed["properties"]["enum_field"]["enum"] == [feature]
+    assert processed["properties"]["default_field"]["default"] == feature
+    assert processed["properties"]["examples_field"]["examples"] == [feature]
+
+
+@pytest.mark.parametrize("keyword", ["const", "enum"])
+def test_disable_additional_properties_accepts_literal_with_properties_key(
+    keyword: str,
+) -> None:
+    """GuidanceBackend with disable_additional_properties=True must accept the
+    original literal value under const/enum and reject injected
+    additionalProperties (#58695)."""
+    feature = {"type": "Feature", "geometry": None, "properties": {"name": "HQ"}}
+    rewritten = {**feature, "additionalProperties": False}
+    schema = {keyword: feature if keyword == "const" else [feature]}
+
+    vllm_config = VllmConfig(
+        structured_outputs_config=StructuredOutputsConfig(
+            backend="guidance",
+            disable_additional_properties=True,
+        )
+    )
+    tokenizer = AutoTokenizer.from_pretrained(TOKENIZER)
+    backend = GuidanceBackend(
+        vllm_config,
+        tokenizer=tokenizer,
+        vocab_size=50257,
+    )
+    grammar = backend.compile_grammar(
+        StructuredOutputOptions.JSON,
+        json.dumps(schema),
+    )
+
+    valid_tokens = tokenizer.encode(json.dumps(feature)) + [tokenizer.eos_token_id]
+    rewritten_tokens = tokenizer.encode(json.dumps(rewritten)) + [
+        tokenizer.eos_token_id
+    ]
+
+    assert grammar.validate_tokens(valid_tokens) == valid_tokens
+    assert grammar.validate_tokens(rewritten_tokens) != rewritten_tokens
```

**File**: `vllm/v1/structured_output/backend_guidance.py` (modified, +45/-4)
```diff
@@ -34,17 +34,58 @@
 logger = init_logger(__name__)
 
 
+_SCHEMA_MAP_KEYWORDS = (
+    "properties",
+    "patternProperties",
+    "$defs",
+    "definitions",
+    "dependentSchemas",
+    "dependencies",
+)
+
+_SUBSCHEMA_KEYWORDS = (
+    "additionalProperties",
+    "unevaluatedProperties",
+    "propertyNames",
+    "contains",
+    "additionalItems",
+    "unevaluatedItems",
+    "not",
+    "if",
+    "then",
+    "else",
+    "contentSchema",
+    "items",
+    "prefixItems",
+    "allOf",
+    "anyOf",
+    "oneOf",
+)
+
+
 def _walk_json_for_additional_properties(data: object):
     if isinstance(data, dict):
-        for value in data.values():
-            _walk_json_for_additional_properties(value)
+        for key in _SCHEMA_MAP_KEYWORDS:
+            value = data.get(key)
+            if isinstance(value, dict):
+                for subschema in value.values():
+                    if isinstance(subschema, dict):
+                        _walk_json_for_additional_properties(subschema)
+
+        for key in _SUBSCHEMA_KEYWORDS:
+            value = data.get(key)
+            if isinstance(value, (dict, list)):
+                _walk_json_for_additional_properties(value)
+
         if "additionalProperties" not in data and (
-            "properties" in data or "patternProperties" in data
+            isinstance(data.get("properties"), dict)
+            or isinstance(data.get("patternProperties"), dict)
         ):
             data["additionalProperties"] = False
     elif isinstance(data, list):
         for item in data:
-            _walk_json_for_additional_properties(item)
+            if isinstance(item, dict):
+                _walk_json_for_additional_properties(item)
 
 
 def has_guidance_unsupported_json_features(schema: dict[str, Any]) -> bool:
```

---

### Incident Patch 9: `d0d6e5f3` (2026-10-05)
**Commit Message**: [Bugfix] Fix Mamba page size AssertionError with spec decoding on GraniteMoeHybrid, FalconH1 and Zamba2 (#59975)

Signed-off-by: Vadim Gimpelson <[REDACTED_EMAIL]>
Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `tests/v1/attention/test_attention_backends_selection.py` (modified, +43/-0)
```diff
@@ -13,7 +13,11 @@
 )
 from vllm.model_executor.layers.mamba.mamba_mixer import MambaMixer
 from vllm.model_executor.layers.mamba.mamba_mixer2 import MambaMixer2
+from vllm.model_executor.layers.mamba.mamba_utils import MambaStateShapeCalculator
 from vllm.model_executor.layers.mamba.short_conv import ShortConv
+from vllm.model_executor.models.falcon_h1 import FalconH1ForCausalLM
+from vllm.model_executor.models.granitemoehybrid import GraniteMoeHybridForCausalLM
+from vllm.model_executor.models.zamba2 import Zamba2ForCausalLM
 from vllm.v1.attention.backends.linear_attn import LinearAttentionBackend
 from vllm.v1.attention.backends.mamba1_attn import Mamba1AttentionBackend
 from vllm.v1.attention.backends.mamba2_attn import Mamba2AttentionBackend
@@ -47,6 +51,45 @@ def test_replayssm_does_not_reserve_speculative_state_blocks(
     assert spec.num_speculative_blocks == expected_blocks
 
 
+@pytest.mark.parametrize(
+    "model_cls", [FalconH1ForCausalLM, GraniteMoeHybridForCausalLM, Zamba2ForCausalLM]
+)
+def test_mamba2_config_state_shape_includes_speculative_tokens(model_cls):
+    """The config-time shape sizes the padded Mamba page, so it must match
+    MambaMixer2.get_state_shape, whose conv state grows with spec tokens."""
+    hf_config = SimpleNamespace(
+        hidden_size=128,
+        mamba_expand=2,
+        mamba_d_ssm=None,
+        mamba_n_groups=1,
+        mamba_ngroups=1,
+        mamba_n_heads=8,
+        n_mamba_heads=8,
+        mamba_d_head=32,
+        mamba_headdim=32,
+        mamba_d_state=16,
+        mamba_d_conv=4,
+    )
+    vllm_config = SimpleNamespace(
+        model_config=SimpleNamespace(hf_config=hf_config),
+        parallel_config=SimpleNamespace(tensor_parallel_size=1),
+        num_speculative_tokens=2,
+    )
+
+    assert model_cls.get_mamba_state_shape_from_config(
+        vllm_config
+    ) == MambaStateShapeCalculator.mamba2_state_shape(
+        tp_world_size=1,
+        intermediate_size=256,
+        n_groups=1,
+        num_heads=8,
+        head_dim=32,
+        state_size=16,
+        conv_kernel=4,
+        num_spec=2,
+    )
+
+
 @pytest.mark.parametrize(
     "layer_class, init_kwargs, expected_backend, expected_mamba_type",
     [
```

**File**: `vllm/model_executor/models/falcon_h1.py` (modified, +1/-0)
```diff
@@ -569,6 +569,7 @@ def get_mamba_state_shape_from_config(
             head_dim=hf_config.mamba_d_head,
             state_size=hf_config.mamba_d_state,
             conv_kernel=hf_config.mamba_d_conv,
+            num_spec=vllm_config.num_speculative_tokens,
         )
 
     @classmethod
```

**File**: `vllm/model_executor/models/granitemoehybrid.py` (modified, +1/-0)
```diff
@@ -647,6 +647,7 @@ def get_mamba_state_shape_from_config(
             head_dim=hf_config.mamba_d_head,
             state_size=hf_config.mamba_d_state,
             conv_kernel=hf_config.mamba_d_conv,
+            num_spec=vllm_config.num_speculative_tokens,
         )
 
     @classmethod
```

**File**: `vllm/model_executor/models/zamba2.py` (modified, +1/-0)
```diff
@@ -896,6 +896,7 @@ def get_mamba_state_shape_from_config(
             head_dim=hf_config.mamba_headdim,
             state_size=hf_config.mamba_d_state,
             conv_kernel=hf_config.mamba_d_conv,
+            num_spec=vllm_config.num_speculative_tokens,
         )
 
     @classmethod
```

---

### Incident Patch 10: `51eeb0c5` (2026-10-05)
**Commit Message**: [Bugfix] Load stacked expert weights for non-gated MoE (#59031)

Signed-off-by: Roi Koren <[REDACTED_EMAIL]>
Co-authored-by: mergify[bot] <37929162+mergify[bot]@users.noreply.github.com>

**File**: `tests/kernels/moe/test_moe_weight_loading_padded.py` (modified, +50/-2)
```diff
@@ -9,6 +9,8 @@
 correctly handles this mismatch.
 """
 
+from types import SimpleNamespace
+
 import pytest
 import torch
 
@@ -564,9 +566,11 @@ def _load(
         transposed=False,
         quant_method="tensor",
         layer_name="model.layers.0.mlp.experts",
+        is_gated=True,
     ):
         experts = torch.nn.Module()
         experts.layer_name = layer_name
+        experts.moe_config = SimpleNamespace(is_act_and_mul=is_gated)
         experts.get_expert_mapping = lambda **_: mapping
         experts.is_fused_checkpoint_transposed = transposed
         experts._orient_fused_weight = RoutedExperts._orient_fused_weight
@@ -593,7 +597,7 @@ def weight_loader(param, loaded_weight, shard_id, expert_id, **_):
             (("gate_proj", "down_proj", "up_proj"), ""),
             (("w1", "w2", "w3"), ""),
             (("up_proj", "down_proj", "up_proj"), ""),
-            (("up_proj", "down_proj", ""), ""),
+            (("up_proj", "down_proj", None), ""),
             (("gate_proj", "down_proj", "up_proj"), "base_layer."),
         ],
     )
@@ -609,7 +613,10 @@ def test_per_expert_weights_keep_all_physical_destinations(
         self, projs, lora_prefix, suffix, shape, dtype
     ):
         mapping = self._mapping(
-            projs, num_redundant_experts=4, lora_base_layer_prefix=lora_prefix
+            projs,
+            num_redundant_experts=4,
+            lora_base_layer_prefix=lora_prefix,
+            is_gated=projs[2] is not None,
         )
         for logical_id, physical_ids in [(1, (1, 17)), (10, (10,))]:
             for proj in dict.fromkeys(projs):
@@ -651,6 +658,47 @@ def test_per_expert_fused_gate_up_keeps_both_halves(
         for call, expected in zip(calls, weight.chunk(2) * 2):
             torch.testing.assert_close(call[3], expected, rtol=0, atol=0)
 
+    def test_non_gated_mapping_uses_stacked_up_proj_without_warning(self, caplog_vllm):
+        mapping = self._mapping(("up_proj", "down_proj", None), is_gated=False)
+        assert "Unexpected gate/up projection names" not in caplog_vllm.text
+        assert mapping[:2] == [
+            ("experts.w13_weight", "experts.up_proj", 0, "w1"),
+            ("experts.w2_weight", "experts.down_proj", 0, "w2"),
+        ]
+        assert mapping[2:] == [
+            (param, f"experts.{expert}.{proj}.", expert, shard)
+            for expert in range(16)
+            for param, proj, shard in (
+                ("experts.w13_", "up_proj", "w1"),
+                ("experts.w2_", "down_proj", "w2"),
+            )
+        ]
+
+    def test_gated_mapping_with_unknown_names_warns_and_skips_fused(self, caplog_vllm):
+        mapping = self._mapping(("fc1", "fc2", "fc3"))
+        assert "Unexpected gate/up projection names: fc1, fc3" in caplog_vllm.text
+        assert [name for _, name, _, _ in mapping[:3]] == [
+            "experts.0.fc1.",
+            "experts.0.fc2.",
+            "experts.0.fc3.",
+        ]
+
+    def test_stacked_non_gated_tensors_load_unsplit(self):
+        mapping = self._mapping(("up_proj", "down_proj", None), is_gated=False)
+        up_proj = torch.arange(16 * 4 * 3).reshape(16, 4, 3)
+        down_proj = torch.arange(16 * 3 * 4).reshape(16, 3, 4)
+        calls = self._load(
+            mapping,
+            [("up_proj", up_proj), ("down_proj", down_proj)],
+            is_gated=False,
+        )
+        assert [call[:3] for call in calls] == [
+            *(("w13_weight", "w1", expert) for expert in range(16)),
+            *(("w2_weight", "w2", expert) for expert in range(16)),
+        ]
+        for call, expected in zip(calls, [*up_proj, *down_proj]):
+            torch.testing.assert_close(call[3], expected, rtol=0, atol=0)
+
     @pytest.mark.parametrize(
         "suffix,quant_method,transposed",
         [
```

**File**: `vllm/lora/utils.py` (modified, +2/-4)
```diff
@@ -409,13 +409,11 @@ def process_packed_modules_mapping(
                 "experts.w3",
             ]
         elif (not model.is_3d_moe_weight) or force_2d_moe:
-            # Filter out malformed entries: non-gated MoE has empty
-            # ckpt_up_proj_name which results in weight_name containing ".."
-            # (e.g., "experts.0.." instead of "experts.0.layer_name.")
+            # Non-gated MoE yields two entries per expert (no w3); the
+            # manager pads them to triplets before packing.
             packed_modules_mapping["experts"] = [
                 weight_name.rstrip(".")
                 for _, weight_name, _, _ in get_moe_expert_mapping(model)
-                if ".." not in weight_name
             ]
 
         return packed_modules_mapping
```

**File**: `vllm/model_executor/layers/fused_moe/layer.py` (modified, +2/-2)
```diff
@@ -118,7 +118,7 @@ def FusedMoEFactory(
     has_bias: bool = False,
     is_sequence_parallel: bool = False,
     reduce_results: bool = True,
-    ckpt_names: tuple[str, str, str] = ("gate_proj", "down_proj", "up_proj"),
+    ckpt_names: tuple[str, str, str | None] = ("gate_proj", "down_proj", "up_proj"),
     is_fused_checkpoint_transposed: bool = False,
     n_shared_experts: int | None = None,
     fuse_shared_experts: bool = False,
@@ -442,7 +442,7 @@ def fused_moe_make_expert_params_mapping(
     model: torch.nn.Module,
     ckpt_gate_proj_name: str,
     ckpt_down_proj_name: str,
-    ckpt_up_proj_name: str,
+    ckpt_up_proj_name: str | None,
     num_experts: int,
     num_redundant_experts: int = 0,
     routed_experts_prefix: str = "routed_experts",
```

**File**: `vllm/model_executor/layers/fused_moe/routed_experts.py` (modified, +31/-7)
```diff
@@ -87,7 +87,7 @@ def __init__(
         expert_map_manager: ExpertMapManager,
         ckpt_gate_proj_name: str = "gate_proj",
         ckpt_down_proj_name: str = "down_proj",
-        ckpt_up_proj_name: str = "up_proj",
+        ckpt_up_proj_name: str | None = "up_proj",
         is_fused_checkpoint_transposed: bool = False,
         #
         # Extra params that are needed by quant_methods, pass along for now
@@ -114,6 +114,13 @@ def __init__(
         self.ckpt_gate_proj_name = ckpt_gate_proj_name
         self.ckpt_down_proj_name = ckpt_down_proj_name
         self.ckpt_up_proj_name = ckpt_up_proj_name
+        if moe_config.is_act_and_mul == (ckpt_up_proj_name is None):
+            raise ValueError(
+                f"{layer_name}: ckpt_up_proj_name={ckpt_up_proj_name!r} is "
+                f"inconsistent with activation {moe_config.activation.value!r}. "
+                "Gated MoE needs an up projection name; non-gated MoE must "
+                "pass None."
+            )
         self.is_fused_checkpoint_transposed = is_fused_checkpoint_transposed
         self.expert_map_manager = expert_map_manager
         self.hidden_size = moe_config.hidden_dim
@@ -971,7 +978,7 @@ def load_weights(
                         loaded_weight,
                         self.is_fused_checkpoint_transposed and uses_weight_layout,
                     )
-                    if shard_id in {"w1", "w3"}:
+                    if shard_id in {"w1", "w3"} and self.moe_config.is_act_and_mul:
                         # Repurpose expert_id for deconcatenating w1 and w3
                         experts_shard = fused_weight.chunk(2, dim=1)[expert_id]
                     else:
@@ -1029,14 +1036,15 @@ def get_expert_mapping(
             routed_experts_prefix="",
             lora_base_layer_prefix=self.lora_base_layer_prefix,
             include_fused=include_fused,
+            is_gated=moe_config.is_act_and_mul,
         )
 
     @staticmethod
     def make_expert_params_mapping(
         model: torch.nn.Module,
         ckpt_gate_proj_name: str,
         ckpt_down_proj_name: str,
-        ckpt_up_proj_name: str,
+        ckpt_up_proj_name: str | None,
         num_experts: int,
         num_redundant_experts: int = 0,
         routed_experts_prefix: str = "routed_experts",
@@ -1067,13 +1075,14 @@ def make_expert_params_mapping(
     def build_expert_params_mapping(
         ckpt_gate_proj_name: str,
         ckpt_down_proj_name: str,
-        ckpt_up_proj_name: str,
+        ckpt_up_proj_name: str | None,
         num_experts: int,
         num_redundant_experts: int = 0,
         routed_experts_prefix: str = "routed_experts",
         lora_base_layer_prefix: str = "",
         lora_base_layer_prefix_on_param_name: str = "",
         include_fused: bool = False,
+        is_gated: bool = True,
     ) -> list[tuple[str, str, int, str]]:
         """Create expert parameter mapping for weight loading with redundant experts.
 
@@ -1095,6 +1104,8 @@ def build_expert_params_mapping(
                 ``make_expert_params_mapping`` indexes the model-wide
                 ``params_dict`` (prefix included).
             include_fused: Prepend the fused pre-fused-checkpoint entries
+            is_gated: Whether w13 holds gate and up (gated activation) or a
+                single up projection. Selects the fused checkpoint layout.
             routed_experts_prefix: Prefix of the routed experts submodule
 
         Returns:
@@ -1129,7 +1140,13 @@ def build_expert_params_mapping(
         fused_mapping = []
         if include_fused:
             gate_up = None
-            if ckpt_gate_proj_name == "gate_proj" and ckpt_up_proj_name == "up_proj":
+            w13_shards: tuple[str, ...] = ("w1", "w3")
+            if not is_gated:
+                # Non-gated: the stacked checkpoint tensor is the up projection
+                # itself, nothing to split into gate and up.
+                gate_up = ckpt_gate_proj_name
+                w13_shards = ("w1",)
+            elif ckpt_gate_proj_name == "gate_proj" and ckpt_up_proj_name == "up_proj":
                 gate_up = "gate_up_proj"
             elif ckpt_gate_proj_name == "w1" and ckpt_up_proj_name == "w3":
                 gate_up = "w13"
@@ -1143,10 +1160,16 @@ def build_expert_params_mapping(
             if gate_up is not None:
                 fused_mapping = [
                     # (param_name, weight_name, expert_id, shard_id)
-                    (f"{w13}weight", f"experts.{gate_up}", 0, "w1"),
-                    (f"{w13}weight", f"experts.{gate_up}", 1, "w3"),
+                    # expert_id doubles as the chunk index when splitting w13.
+                    *(
+                        (f"{w13}weight", f"experts.{gate_up}", chunk, shard_id)
+                        for chunk, shard_id in enumerate(w13_shards)
+                    ),
                     (f"{w2}weight", f"experts.{ckpt_down_proj_name}", 0, "w2"),
                 ]
+            if gate_up is not None 
```

**File**: `vllm/model_executor/models/nemotron_h.py` (modified, +2/-2)
```diff
@@ -235,7 +235,7 @@ def __init__(
             intermediate_size=config.moe_intermediate_size,
             renormalize=config.norm_topk_prob,
             quant_config=quant_config,
-            ckpt_names=("up_proj", "down_proj", ""),
+            ckpt_names=("up_proj", "down_proj", None),
             use_grouped_topk=True,
             num_expert_group=config.n_group,
             topk_group=config.topk_group,
@@ -707,7 +707,7 @@ def get_expert_mapping(self) -> list[tuple[str, str, int, str]]:
                 self,
                 ckpt_gate_proj_name="up_proj",
                 ckpt_down_proj_name="down_proj",
-                ckpt_up_proj_name="",
+                ckpt_up_proj_name=None,
                 num_experts=self._get_max_n_routed_experts(),
                 num_redundant_experts=getattr(self, "num_redundant_experts", 0),
             )
```

**File**: `vllm/model_executor/models/nemotron_h_mtp.py` (modified, +1/-1)
```diff
@@ -444,7 +444,7 @@ def load_weights(self, weights: Iterable[tuple[str, torch.Tensor]]) -> set[str]:
                 self,
                 ckpt_gate_proj_name="up_proj",
                 ckpt_down_proj_name="down_proj",
-                ckpt_up_proj_name="",  # Empty - non-gated MoE
+                ckpt_up_proj_name=None,  # non-gated MoE
                 num_experts=num_experts,
                 num_redundant_experts=self.num_redundant_experts,
             )
```

---

### Incident Patch 11: `4ff028d7` (2026-10-05)
**Commit Message**: [Bugfix][Qwen4Exp] Honor --kv-cache-dtype-skip-layers in QSA attention (#60023)

Signed-off-by: Stefano Castagnetta <[REDACTED_EMAIL]>
Co-authored-by: Thien Tran <[REDACTED_EMAIL]>

**File**: `tests/models/qwen4_exp/test_qsa_reference.py` (modified, +14/-0)
```diff
@@ -15,6 +15,7 @@
 )
 from vllm.models.qwen4_exp.nvidia.ops import qsa as qsa_ops
 from vllm.models.qwen4_exp.nvidia.ops import qsa_indexer as qsa_indexer_ops
+from vllm.models.qwen4_exp.nvidia.qsa import qsa_kv_cache_dtype
 from vllm.platforms import current_platform
 from vllm.triton_utils import HAS_TRITON
 from vllm.v1.worker.utils import clear_layer_kv_caches
@@ -448,6 +449,19 @@ def test_qsa_ring_capacity_covers_one_speculative_step(
     assert spec.block_size == expected
 
 
+def test_qsa_kv_cache_dtype_honors_skip_layers() -> None:
+    """``--kv-cache-dtype-skip-layers`` keeps the listed QSA layers unquantized.
+
+    The MTP layer's own attention is the one that matters on Flash-Next: FP8
+    there cuts draft acceptance at depth while the target layers stay FP8.
+    """
+    cache_config = SimpleNamespace(cache_dtype="fp8", kv_cache_dtype_skip_layers=["48"])
+    assert qsa_kv_cache_dtype(cache_config, "mtp.layers.48.self_attn") == "auto"
+    assert qsa_kv_cache_dtype(cache_config, "model.layers.47.self_attn") == "fp8"
+    cache_config.kv_cache_dtype_skip_layers = []
+    assert qsa_kv_cache_dtype(cache_config, "mtp.layers.48.self_attn") == "fp8"
+
+
 @requires_qsa_kernels
 def test_qsa_compressed_metadata_keeps_dummy_slots_inert() -> None:
     device = torch.device("cuda")
```

**File**: `vllm/models/qwen4_exp/nvidia/qsa.py` (modified, +14/-3)
```diff
@@ -13,7 +13,7 @@
 
 from vllm.compilation.breakable_cudagraph import eager_break_during_capture
 from vllm.config import VllmConfig
-from vllm.config.cache import CacheDType
+from vllm.config.cache import CacheConfig, CacheDType
 from vllm.distributed import get_tensor_model_parallel_world_size
 from vllm.forward_context import get_forward_context
 from vllm.model_executor.layers.attention.attention import (
@@ -29,7 +29,11 @@
 from vllm.model_executor.layers.quantization import QuantizationConfig
 from vllm.model_executor.layers.rotary_embedding import MRotaryEmbedding, get_rope
 from vllm.model_executor.models.qwen3_next import Qwen3NextAttention
-from vllm.model_executor.models.utils import AutoWeightsLoader, WeightsMapper
+from vllm.model_executor.models.utils import (
+    AutoWeightsLoader,
+    WeightsMapper,
+    extract_layer_index,
+)
 from vllm.platforms import current_platform
 from vllm.platforms.interface import DeviceCapability
 from vllm.utils.torch_utils import (
@@ -125,6 +129,13 @@ def remap_shards():
         return super().load_weights(remap_shards())
 
 
+def qsa_kv_cache_dtype(cache_config: CacheConfig, prefix: str) -> CacheDType:
+    """The layer's KV cache dtype, honoring ``--kv-cache-dtype-skip-layers``."""
+    if str(extract_layer_index(prefix)) in cache_config.kv_cache_dtype_skip_layers:
+        return "auto"
+    return cache_config.cache_dtype
+
+
 class Qwen4ExpQSAMetadataBuilder(FlashAttentionMetadataBuilder):
     """Flash metadata supporting uniform decode and target-verify graphs."""
 
@@ -444,7 +455,7 @@ def __init__(
 
         self.layer_name = f"{prefix}.attn"
         self.attn_type = AttentionType.DECODER
-        self.kv_cache_dtype = cache_config.cache_dtype
+        self.kv_cache_dtype = qsa_kv_cache_dtype(cache_config, prefix)
         self.kv_cache_torch_dtype = kv_cache_dtype_str_to_dtype(
             self.kv_cache_dtype, model_config
         )
```

---

### Incident Patch 12: `710ac56e` (2026-10-05)
**Commit Message**: [Security] Restrict Pillow image formats on untrusted media paths (#60022)

Signed-off-by: Juan Pérez de Algaba <[REDACTED_EMAIL]>

**File**: `tests/multimodal/media/test_image.py` (modified, +74/-0)
```diff
@@ -1,11 +1,16 @@
 # SPDX-License-Identifier: Apache-2.0
 # SPDX-FileCopyrightText: Copyright contributors to the vLLM project
+import inspect
 from pathlib import Path
 
 import numpy as np
 import pytest
 from PIL import Image
 
+from vllm.multimodal.image import (
+    ALLOWED_IMAGE_FORMATS,
+    open_image,
+)
 from vllm.multimodal.media import ImageMediaIO
 
 pytestmark = pytest.mark.cpu_test
@@ -281,3 +286,72 @@ def test_image_pixel_limit_disabled(monkeypatch):
     image_io = ImageMediaIO()
     result = image_io.load_bytes(data)
     assert result.media.size == (1000, 1000)
+
+
+def test_image_media_io_rejects_postscript_payload():
+    """EPS/PostScript bytes must not reach an external renderer."""
+    import pybase64 as base64
+
+    eps = b"""%!PS-Adobe-3.0 EPSF-3.0
+%%BoundingBox: 0 0 10 10
+%%EndComments
+0 0 moveto 10 10 lineto stroke
+showpage
+"""
+    image_io = ImageMediaIO()
+    with pytest.raises(ValueError, match="Failed to load image"):
+        image_io.load_bytes(eps)
+
+    payload = base64.b64encode(eps).decode("ascii")
+    with pytest.raises(ValueError, match="Failed to load image"):
+        image_io.load_base64("image/png", payload)
+
+
+def test_image_media_io_accepts_common_raster_formats(tmp_path):
+    """Common Pillow-writable raster formats remain loadable."""
+    image_io = ImageMediaIO()
+    formats = (
+        ("PNG", "ok.png"),
+        ("JPEG", "ok.jpg"),
+        ("WEBP", "ok.webp"),
+        ("GIF", "ok.gif"),
+        ("BMP", "ok.bmp"),
+        ("TIFF", "ok.tiff"),
+        ("PPM", "ok.ppm"),
+        ("TGA", "ok.tga"),
+        ("DDS", "ok.dds"),
+        ("PCX", "ok.pcx"),
+        ("SGI", "ok.sgi"),
+        ("QOI", "ok.qoi"),
+        ("JPEG2000", "ok.jp2"),
+    )
+    for fmt, name in formats:
+        path = tmp_path / name
+        Image.new("RGB", (4, 4), (1, 2, 3)).save(path, format=fmt)
+        result = image_io.load_bytes(path.read_bytes())
+        assert result.media.size == (4, 4)
+
+
+def test_allowed_image_formats_exclude_external_renderer_plugins():
+    """Formats that shell out or use stubs stay off the allowlist."""
+    denied = {"EPS", "WMF", "BUFR", "GRIB", "HDF5", "MPEG"}
+    assert denied.isdisjoint(ALLOWED_IMAGE_FORMATS)
+
+
+def test_kimi_fused_vision_rejects_postscript_payload():
+    """Kimi fused vision must use the same image format allowlist."""
+    from vllm.transformers_utils.processors.kimi_k25_vision_fused import _to_pil
+
+    eps = b"""%!PS-Adobe-3.0 EPSF-3.0
+%%BoundingBox: 0 0 10 10
+%%EndComments
+0 0 moveto 10 10 lineto stroke
+showpage
+"""
+    with pytest.raises(Image.UnidentifiedImageError):
+        _to_pil(eps)
+
+
+def test_open_image_does_not_accept_format_override():
+    """The allowlist helper must not expose a formats override."""
+    assert "formats" not in inspect.signature(open_image).parameters
```

**File**: `vllm/multimodal/image.py` (modified, +55/-0)
```diff
@@ -2,9 +2,64 @@
 # SPDX-FileCopyrightText: Copyright contributors to the vLLM project
 
 import contextlib
+from typing import Any
 
 from PIL import Image, ImageOps
 
+# Formats accepted by Image.open for untrusted multimodal media.
+#
+# Audited against Pillow's registered open plugins (python -m PIL / Image.OPEN):
+# Allowed: native still-image / raster readers that decode in-process.
+# Denied:
+#   EPS — may invoke Ghostscript on untrusted PostScript
+#   WMF — Windows GDI / stub-handler path
+#   BUFR / GRIB / HDF5 — stub drivers requiring external handlers
+#   MPEG — identify-only; not a decodable still image
+ALLOWED_IMAGE_FORMATS: tuple[str, ...] = (
+    "AVIF",
+    "BLP",
+    "BMP",
+    "CUR",
+    "DCX",
+    "DDS",
+    "DIB",
+    "FITS",
+    "FLI",
+    "FTEX",
+    "GBR",
+    "GIF",
+    "ICNS",
+    "ICO",
+    "IM",
+    "IMT",
+    "IPTC",
+    "JPEG",
+    "JPEG2000",
+    "MCIDAS",
+    "MSP",
+    "PCD",
+    "PCX",
+    "PIXAR",
+    "PNG",
+    "PPM",
+    "PSD",
+    "QOI",
+    "SGI",
+    "SPIDER",
+    "SUN",
+    "TGA",
+    "TIFF",
+    "WEBP",
+    "XBM",
+    "XPM",
+    "XVTHUMB",
+)
+
+
+def open_image(fp: Any) -> Image.Image:
+    """Open image bytes/files with the serving format allowlist."""
+    return Image.open(fp, formats=ALLOWED_IMAGE_FORMATS)
+
 
 def rescale_image_size(
     image: Image.Image, size_factor: float, transpose: int = -1
```

**File**: `vllm/multimodal/media/image.py` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@
     safe_to_dense,
 )
 
-from ..image import convert_image_mode, normalize_image, rgba_to_rgb
+from ..image import convert_image_mode, normalize_image, open_image, rgba_to_rgb
 from .base import MediaIO, MediaWithBytes
 
 MAGIC_NUMPY_PREFIX = b"\x93NUMPY"  # https://numpy.org/devdocs/reference/generated/numpy.lib.format.html#format-version-1-0
@@ -78,7 +78,7 @@ def _convert_image_mode(
 
     def load_bytes(self, data: bytes) -> MediaWithBytes[Image.Image]:
         try:
-            image = Image.open(BytesIO(data))
+            image = open_image(BytesIO(data))
             w, h = image.size
             max_pixels = envs.VLLM_MAX_IMAGE_PIXELS
             if max_pixels > 0 and w * h > max_pixels:
```

**File**: `vllm/transformers_utils/processors/kimi_k25_vision_fused.py` (modified, +4/-3)
```diff
@@ -14,6 +14,7 @@
 from transformers.image_processing_utils import BaseImageProcessor, BatchFeature
 from transformers.utils import TensorType
 
+from vllm.multimodal.image import open_image
 from vllm.utils.import_utils import is_numba_available
 from vllm.utils.jit_monitor import numba_workqueue_threading_layer
 
@@ -151,10 +152,10 @@ def _to_pil(data: Any) -> Image.Image:
     if isinstance(data, str):
         if data.startswith("data:"):
             raw_base64 = data.split(",", 1)[1]
-            return Image.open(io.BytesIO(base64.b64decode(raw_base64))).convert("RGB")
-        return Image.open(data).convert("RGB")
+            return open_image(io.BytesIO(base64.b64decode(raw_base64))).convert("RGB")
+        return open_image(data).convert("RGB")
     if isinstance(data, bytes):
-        return Image.open(io.BytesIO(data)).convert("RGB")
+        return open_image(io.BytesIO(data)).convert("RGB")
     raise ValueError(f"Unsupported data type: {type(data)}")
 
 
```

---

### Incident Patch 13: `edca360f` (2026-10-05)
**Commit Message**: [Bugfix][Qwen4Exp] Load PLE tables unquantized under Quark checkpoints (#59443)

Signed-off-by: Mikko Tukiainen <[REDACTED_EMAIL]>
Co-authored-by: Cursor <[REDACTED_EMAIL]>
Co-authored-by: mergify[bot] <37929162+mergify[bot]@users.noreply.github.com>
Co-authored-by: TJian <[REDACTED_EMAIL]>

**File**: `tests/models/qwen4_exp/test_ple.py` (modified, +11/-0)
```diff
@@ -26,6 +26,7 @@
     ModelOptNvFp4Config,
 )
 from vllm.model_executor.layers.quantization.online.base import OnlineQuantizationConfig
+from vllm.model_executor.layers.quantization.quark.quark import QuarkConfig
 from vllm.models.qwen4_exp.amd import ple_layer as amd_ple_layer
 from vllm.models.qwen4_exp.amd.ple_layer import (
     Qwen4ExpPLELayer as Qwen4ExpPLELayerAMD,
@@ -585,6 +586,16 @@ def test_ple_embedding_respects_inc_layer_config() -> None:
         Qwen4ExpPLEEmbeddingMethod.from_quant_config(quant_config, prefix)
 
 
+def test_ple_embedding_is_unquantized_under_quark() -> None:
+    prefix = "model.layers.1.ple.ple_embedding.ngram_embedding"
+    quant_config = QuarkConfig({"exclude": [], "global_quant_config": {}})
+
+    assert isinstance(
+        Qwen4ExpPLEEmbeddingMethod.from_quant_config(quant_config, prefix),
+        Qwen4ExpPLEUnquantizedEmbeddingMethod,
+    )
+
+
 def test_ple_embedding_dtype_overrides_modelopt_exclusion() -> None:
     prefix = "model.layers.1.ple.ple_embedding.ngram_embedding"
     quant_config = ModelOptNvFp4Config(exclude_modules=[prefix])
```

**File**: `vllm/models/qwen4_exp/common/ngram_embedding.py` (modified, +4/-0)
```diff
@@ -32,6 +32,7 @@
     ModelOptMixedPrecisionConfig,
     ModelOptQuantConfigBase,
 )
+from vllm.model_executor.layers.quantization.quark.quark import QuarkConfig
 from vllm.model_executor.layers.quantization.utils.fp8_utils import (
     create_fp8_scale_parameter,
 )
@@ -196,6 +197,9 @@ def from_quant_config(
             and not quant_config.config_parser.resolve(None, prefix).quantized
         ):
             return Qwen4ExpPLEUnquantizedEmbeddingMethod()
+        # Quark quantizes only Linear and MoE layers; PLE tables stay BF16.
+        if isinstance(quant_config, QuarkConfig):
+            return Qwen4ExpPLEUnquantizedEmbeddingMethod()
         if not isinstance(quant_config, Fp8Config):
             raise NotImplementedError(
                 "Qwen4Exp PLE embedding does not support quantization config "
```

---

### Incident Patch 14: `b1401e0a` (2026-10-05)
**Commit Message**: [Bugfix][NIXL] Count heartbeats as remote engine activity (#59873)

Signed-off-by: Maroon Ayoub <[REDACTED_EMAIL]>

**File**: `tests/v1/kv_connector/unit/test_nixl_connector.py` (modified, +46/-0)
```diff
@@ -50,6 +50,7 @@
     NixlKVConnectorStats,
 )
 from vllm.distributed.kv_transfer.kv_connector.v1.nixl.metadata import (
+    HeartbeatInfo,
     RemoteMeta,
     ReqMeta,
     compute_nixl_compatibility_hash,
@@ -2700,6 +2701,51 @@ def test_engine_with_inflight_transfer_is_not_evicted(default_vllm_config, dist_
         assert mock_rem.call_count == 2
 
 
+@patch(
+    "vllm.distributed.kv_transfer.kv_connector.v1.nixl.base_worker.NixlWrapper",
+    FakeNixlWrapper,
+)
+def test_heartbeated_engine_is_not_evicted(default_vllm_config, dist_init, monkeypatch):
+    """Heartbeats keep a remote engine's NIXL state alive.
+
+    Requests waiting in the D scheduler issue no reads, but their engine is
+    heartbeated through its remote agents. If the TTL expires anyway, the
+    next heartbeat evicts the engine and starts a new handshake, which loads
+    every remote agent again.
+    """
+    from vllm.distributed.kv_transfer.kv_connector.v1.nixl import base_worker
+
+    worker, engine_id = _setup_worker_with_remote_engine(engine_ttl=10.0)
+    nixl_wrapper = worker.nixl_wrapper
+
+    now = {"t": 1000.0}
+    monkeypatch.setattr(base_worker.time, "perf_counter", lambda: now["t"])
+    worker._engine_last_active[engine_id] = now["t"]
+
+    metadata = NixlConnectorMetadata()
+    metadata.heartbeat_by_engine = {
+        engine_id: HeartbeatInfo(
+            req_ids={"remote-req"}, host="localhost", port=1234, tp_size=2
+        )
+    }
+
+    with (
+        patch.object(nixl_wrapper, "send_notif") as mock_send,
+        patch.object(nixl_wrapper, "remove_remote_agent") as mock_rem,
+        patch.object(worker, "_handshake_initiation_executor") as mock_executor,
+    ):
+        # One heartbeat every 5 s for twice the TTL, and no reads.
+        for _ in range(4):
+            now["t"] += 5.0
+            worker._send_heartbeats(metadata)
+
+    assert engine_id in worker._remote_agents
+    mock_rem.assert_not_called()
+    mock_executor.submit.assert_not_called()
+    # Every heartbeat reached both remote agents.
+    assert mock_send.call_count == 8
+
+
 @patch(
     "vllm.distributed.kv_transfer.kv_connector.v1.nixl.base_worker.NixlWrapper",
     FakeNixlWrapper,
```

**File**: `vllm/distributed/kv_transfer/kv_connector/v1/nixl/base_worker.py` (modified, +7/-1)
```diff
@@ -3236,6 +3236,9 @@ def _send_heartbeats(self, metadata: NixlConnectorMetadata) -> None:
             ):
                 continue  # handshake is still pending
 
+            # Refresh the TTL: a heartbeat means the router still paired this P-D,
+            # so requests are still waiting on this engine
+            self._engine_last_active[engine_id] = time.perf_counter()
             # Build the heartbeat message: "HB:req1,req2,..."
             hb_msg = ("HB:" + ",".join(hb_info.req_ids)).encode()
             for agent_name in self._remote_agents[engine_id].values():
@@ -3586,10 +3589,13 @@ def _evict_stale_engines(self) -> None:
         prevents us from using background threads, though memory usage is not guaranteed
         to be "optimal" until a new handshake is performed.
 
-        Engines with active transfers or pending handshakes cannot be stale:
+        Engines with active transfers, heartbeats or pending handshakes cannot
+        be stale:
         - Reads stamp _engine_last_active when they are issued, and engines a
           transfer is still reading from are held back explicitly, since the
           stamp is not refreshed while the read runs.
+        - Heartbeats stamp it too, so an engine stays registered while this
+          instance holds requests waiting on it.
         - Pending handshakes don't have an _engine_last_active entry yet
         """
         # NOTE (NickLucche): This does NOT currently prevent OOMing if a huge number
```

---

### Incident Patch 15: `ae53b068` (2026-10-05)
**Commit Message**: [Bugfix][GLM-5.3-Flash] Keep batch x heads out of gridDim.z in the GLM-5.3-Flash fused recurrent KDA kernel (#56974)

Signed-off-by: NolenLiang <[REDACTED_EMAIL]>
Co-authored-by: mergify[bot] <37929162+mergify[bot]@users.noreply.github.com>
Co-authored-by: Codex <[REDACTED_EMAIL]>

**File**: `tests/models/glm5next/test_kda_recurrent.py` (modified, +71/-0)
```diff
@@ -194,6 +194,77 @@ def test_fused_recurrent_kda_rejects_unaddressable_layouts():
             run_kernel(broken, state)
 
 
+@pytest.mark.skipif(
+    not current_platform.is_cuda(), reason="The large-grid fix is NVIDIA-only"
+)
+@pytest.mark.parametrize("num_seqs,num_heads", [(1024, 64), (2048, 48)])
+def test_fused_recurrent_kda_more_than_65535_programs(num_seqs: int, num_heads: int):
+    """Regression test for the launch grid.
+
+    GLM-5.3-Flash has 64 KDA value heads; at TP=1 (every DP rank) a decode
+    batch of 1024 sequences needs 1024 * 64 = 65536 (sequence, head)
+    programs. The kernel used to put that product into gridDim.z, whose CUDA
+    limit is 65535, so the launch failed with ``Triton Error [CUDA]: invalid
+    argument`` at CUDA-graph capture and DP deployments could not start. The
+    grid now carries the product in gridDim.x. Small head dims keep the test
+    cheap; the shape that matters is the number of programs. Every (sequence,
+    head) pair is independent, so the full batch must be bitwise identical to
+    the same batch run in two halves.
+    """
+    torch.manual_seed(0)
+    dev = torch.device("cuda")
+    head_dim = 16
+    pool = num_seqs + 8
+    q = torch.randn(1, num_seqs, num_heads, head_dim, device=dev, dtype=torch.bfloat16)
+    k = torch.randn_like(q)
+    v = torch.randn_like(q)
+    g = torch.randn_like(q)
+    beta = torch.randn(1, num_seqs, num_heads, device=dev, dtype=torch.bfloat16)
+    state = torch.randn(
+        pool, num_heads, head_dim, head_dim, device=dev, dtype=torch.float32
+    )
+    cu = torch.arange(0, num_seqs + 1, device=dev, dtype=torch.int32)
+    # slot 0 is NULL_BLOCK_ID and is skipped by the kernel: use slots 1..
+    idx = (torch.randperm(pool - 1, device=dev)[:num_seqs] + 1).to(torch.int32)
+    a_log = torch.randn(num_heads, device=dev, dtype=torch.float32)
+    g_bias = torch.randn(num_heads, head_dim, device=dev, dtype=torch.float32)
+
+    def run(sl: slice, cu_: torch.Tensor, st: torch.Tensor, out: torch.Tensor):
+        fused_recurrent_kda(
+            q=q[:, sl],
+            k=k[:, sl],
+            v=v[:, sl],
+            g=g[:, sl],
+            beta=beta[:, sl],
+            initial_state=st,
+            use_qk_l2norm_in_kernel=True,
+            cu_seqlens=cu_,
+            ssm_state_indices=idx[sl],
+            sigmoid_beta=True,
+            a_log=a_log,
+            g_bias=g_bias,
+            compute_gate=True,
+            lower_bound=-5.0,
+            out=out,
+        )
+
+    full_state = state.clone()
+    full_out = torch.zeros_like(k)
+    run(slice(0, num_seqs), cu, full_state, full_out)
+
+    half = num_seqs // 2
+    ref_state = state.clone()
+    ref_out = torch.zeros_like(k)
+    for s, e in ((0, half), (half, num_seqs)):
+        cu_h = torch.arange(0, e - s + 1, device=dev, dtype=torch.int32)
+        part = torch.zeros_like(k[:, s:e])
+        run(slice(s, e), cu_h, ref_state, part)
+        ref_out[:, s:e] = part
+    torch.accelerator.synchronize()
+    assert torch.equal(full_out, ref_out)
+    assert torch.equal(full_state, ref_state)
+
+
 @pytest.mark.parametrize("offset", [16, 144, 256])
 @pytest.mark.parametrize("dim_first", [False, True])
 @pytest.mark.parametrize("num_spec", [0, 3])
```

**File**: `vllm/models/glm5next/nvidia/ops/third_party/kda/fused_recurrent.py` (modified, +4/-2)
```diff
@@ -87,7 +87,7 @@ def fused_recurrent_gated_delta_rule_fwd_kernel(
     SAFE_GATE: tl.constexpr,  # bounded gate variant (only branch implemented)
     LOWER_BOUND: tl.constexpr,
 ):
-    i_k, i_v, i_nh = tl.program_id(0), tl.program_id(1), tl.program_id(2)
+    i_nh, i_v, i_k = tl.program_id(0), tl.program_id(1), tl.program_id(2)
     i_n, i_hv = i_nh // HV, i_nh % HV
     i_h = i_hv // (HV // H)
     if IS_VARLEN:
@@ -260,7 +260,9 @@ def fused_recurrent_gated_delta_rule_fwd(
     else:
         stride_indices_seq, stride_indices_tok = ssm_state_indices.stride()
 
-    grid = (NK, NV, N * HV)
+    # N * HV goes in gridDim.x: gridDim.z is capped at 65535 and batch x heads exceeds it
+    # (e.g. GLM-5.3-Flash at TP=1: 1024 x 64 = 65536 -> "invalid argument" at CUDA-graph capture).
+    grid = (N * HV, NV, NK)
     fused_recurrent_gated_delta_rule_fwd_kernel[grid](
         q=q,
         k=k,
```

**File**: `vllm/models/glm5next/nvidia/ops/third_party/kda/kernels.py` (modified, +3/-1)
```diff
@@ -95,7 +95,9 @@ def fused_recurrent_kda_fwd(
     else:
         stride_indices_seq, stride_indices_tok = ssm_state_indices.stride()
 
-    grid = (NK, NV, N * HV)
+    # N * HV goes in gridDim.x: gridDim.z is capped at 65535 and batch x heads exceeds it
+    # (e.g. GLM-5.3-Flash at TP=1: 1024 x 64 = 65536 -> "invalid argument" at CUDA-graph capture).
+    grid = (N * HV, NV, NK)
     fused_recurrent_gated_delta_rule_fwd_kernel[grid](
         q=q,
         k=k,
```

#### Recent Merged Pull Requests:
- **PR #60087** (closed): [Docs] Explain vllm-proto release history and wire compatibility (@alec-flowers)
- **PR #60065** (closed): [Docs] Clarify hybrid Mamba prefix-cache overhead (@linfordWu)
- **PR #60063** (2026-10-05): [CI/Build] Declare the video modality on the CohereCompass reference model (@stefankoncarevic)
- **PR #60060** (2026-10-05): [CI] Add CODEOWNERS for HiSparse (@MatthewBonanni)
- **PR #60058** (closed): Superseded: Clarify hybrid Mamba prefix-cache overhead (@linfordWu)
- **PR #60057** (closed): [Attention][MLA] Add DCP support to Triton sparse MLA (@andylolu2)
- **PR #60056** (2026-10-05): [CI/Build] Run the prefill token scoring test under batch invariance (@stefankoncarevic)
- **PR #60037** (closed): [Bugfix] Do not rebind torch.bmm when enabling batch invariance (@Mazukiri)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
