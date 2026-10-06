# Forensic Learning Record (Deep Inspection): 2noise/ChatTTS

> **Canonical Artifact**: `07_PROJECT_LEARNING/2noise-chattts-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/2noise/ChatTTS](https://github.com/2noise/ChatTTS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:57:25.926Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `2noise/ChatTTS`
- **Description**: A generative speech model for daily dialogue.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 39885 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ChatTTS/core.py`
```
import os
import re
import logging
import tempfile
from dataclasses import dataclass, asdict
from typing import Literal, Optional, List, Tuple, Dict, Union
from json import load
from pathlib import Path

import numpy as np
import torch
from vocos import Vocos
from vocos.pretrained import instantiate_class
from huggingface_hub import snapshot_download

from .config import Config
from .model import DVAE, Embed, GPT, gen_logits, Tokenizer, Speaker
from .utils import (
    load_safetensors,
    check_all_assets,
    download_all_assets,
    select_device,
    get_latest_modified_file,
    del_all,
)
from .utils import logger as utils_logger
from .utils import FileLike

from .norm import Normalizer


class Chat:
    def __init__(self, logger=logging.getLogger(__name__)):
        self.logger = logger
        utils_logger.set_logger(logger)

        self.config = Config()

        self.normalizer = Normalizer(
            os.path.join(os.path.dirname(__file__), "res", "homophones_map.json"),
            logger,
        )
        with open(
            os.path.join(os.path.dirname(__file__), "res", "sha256_map.json")
        ) as f:
            self.sha256_map: Dict[str, str] = load(f)

        self.context = GPT.Context()

    def has_loaded(self, use_decoder=False):
        not_finish = False
        check_list = ["vocos", "gpt", "tokenizer", "embed"]

        if use_decoder:
            check_list.append("decoder")
        else:
            check_list.append("dvae")

        for module in check_list:
            if not hasattr(self, module):
                self.logger.warning(f"{module} not initialized.")
                not_finish = True

        return not not_finish

    def download_models(
        self,
        source: Literal["huggingface", "local", "custom"] = "local",
        force_redownload=False,
        custom_path: Optional[FileLike] = None,
    ) -> Optional[str]:
        if source == "local":
            download_path = custom_path if custom_path is not None else os.getcwd()
            if (
                not check_all_assets(Path(download_path), self.sha256_map, update=True)
                or force_redownload
            ):
                with tempfile.TemporaryDirectory() as tmp:
                    download_all_assets(tmpdir=tmp, homedir=download_path)
                if not check_all_assets(
                    Path(download_path), self.sha256_map, update=False
                ):
                    self.logger.error(
                        "download to local path %s failed.", download_path
                    )
                    return None
        elif source == "huggingface":
            try:
                download_path = (
                    get_latest_modified_file(
                        os.path.join(
                            os.getenv(
                                "HF_HOME", os.path.expanduser("~/.cache/huggingface")
                            ),
                            "hub/models--2Noise--ChatTTS/snapshots",
                        )
                    )
                    if custom_path is None
                    else get_latest_modified_file(
                        os.path.join(custom_path, "models--2Noise--ChatTTS/snapshots")
                    )
                )
            except:
                download_path = None
            if download_path is None or force_redownload:
                self.logger.log(
                    logging.INFO,
                    f"download from HF: https://huggingface.co/2Noise/ChatTTS",
                )
                try:
                    download_path = snapshot_download(
                        repo_id="2Noise/ChatTTS",
                        allow_patterns=["*.yaml", "*.json", "*.safetensors"],
                        cache_dir=custom_path,
                        force_download=force_redownload,
                    )
                except:
                    download_path = None
                else:
                    self.logger.log(
                        logging.INFO,
                        f"load latest snapshot from cache: {download_path}",
                    )
        elif source == "custom":
            self.logger.log(logging.INFO, f"try to load from local: {custom_path}")
            if not check_all_assets(Path(custom_path), self.sha256_map, update=False):
                self.logger.error("check models in custom path %s failed.", custom_path)
                return None
            download_path = custom_path

        if download_path is None:
            self.logger.error("Model download failed")
            return None

        return download_path

    def load(
        self,
        source: Literal["huggingface", "local", "custom"] = "local",
        force_redownload=False,
        compile: bool = False,
        custom_path: Optional[FileLike] = None,
        device: Optional[torch.device] = None,
        coef: Optional[str] = None,
        use_flash_attn=False,
        use_vllm=False,
        experimental: bool = False,
        enable_cache=True,
    ) -> bool:
        download_path = self.download_models(source, force_redownload, custom_path)
        if download_path is None:
            return False
        return self._load(
            device=device,
            compile=compile,
            coef=coef,
            use_flash_attn=use_flash_attn,
            use_vllm=use_vllm,
            experimental=experimental,
            enable_cache=enable_cache,
            **{
                k: os.path.join(download_path, v)
                for k, v in asdict(self.config.path).items()
            },
        )

    def unload(self):
        logger = self.logger
        self.normalizer.destroy()
        del self.normalizer
        del self.sha256_map
        del_list = ["vocos", "gpt", "decoder", "dvae", "tokenizer", "embed"]
        for module in del_list:
            if hasattr(self, module):
                delattr(self, module)
        self.__init__(logger)

    def sample_random_speaker(self) -> str:
        return self.speaker.sample_random()

    def sample_audio_speaker(self, wav: Union[np.ndarray, torch.Tensor]) -> str:
        return self.speaker.encode_prompt(self.dvae.sample_audio(wav))

    @dataclass(repr=False, eq=False)
    class RefineTextParams:
        prompt: str = ""
        top_P: float = 0.7
        top_K: int = 20
        temperature: float = 0.7
        repetition_penalty: float = 1.0
        max_new_token: int = 384
        min_new_token: int = 0
        show_tqdm: bool = True
        ensure_non_empty: bool = True
        manual_seed: Optional[int] = None

    @dataclass(repr=False, eq=False)
    class InferCodeParams(RefineTextParams):
        prompt: str = "[speed_5]"
        spk_emb: Optional[str] = None
        spk_smp: Optional[str] = None
        txt_smp: Optional[str] = None
        temperature: float = 0.3
        repetition_penalty: float = 1.05
        max_new_token: int = 2048
        stream_batch: int = 24
        stream_speed: int = 12000
        pass_first_n_batches: int = 2

    def infer(
        self,
        text,
        stream=False,
        lang=None,
        skip_refine_text=False,
        refine_text_only=False,
        use_decoder=True,
        do_text_normalization=True,
        do_homophone_replacement=True,
        split_text=True,
        max_split_batch=4,
        params_refine_text=RefineTextParams(),
        params_infer_code=InferCodeParams(),
    ):
        self.context.set(False)

        if split_text and isinstance(text, str):
            if "\n" in text:
                text = text.split("\n")
            else:
                text = re.split(r"(?<=。)|(?<=\.\s)", text)
                nt = []
                if isinstance(text, list):
                    for t in text:
                        if t:
                            nt.append(t)
                    text = nt
                else:
                    text = [text]
            self.logger.info("split text into %d parts", len(text))
            self.logger.debug("%s", str(text))

        if len(text) == 0:
            return []

        res_gen = self._infer(
            text,
            stream,
            lang,
            skip_refine_text,
            refine_text_only,
            use_decoder,
            do_text_normalization,
            do_homophone_replacement,
            split_text,
            max_split_batch,
            params_refine_text,
            params_infer_code,
        )
        if stream:
            return res_gen
        elif not refine_text_only:
            stripped_wavs = []
            thr = np.float32(1e-5)
            for wavs in res_gen:
                for wav in wavs:
                    stripped_wavs.append(wav[np.abs(wav) > thr])
            if split_text:
                return [np.concatenate(stripped_wavs)]
            return stripped_wavs
        else:
            return next(res_gen)

    def interrupt(self):
        self.context.set(True)

    @torch.no_grad()
    def _load(
        self,
        vocos_ckpt_path: str = None,
        dvae_ckpt_path: str = None,
        gpt_ckpt_path: str = None,
        embed_path: str = None,
        decoder_ckpt_path: str = None,
        tokenizer_path: str = None,
        device: Optional[torch.device] = None,
        compile: bool = False,
        coef: Optional[str] = None,
        use_flash_attn=False,
        use_vllm=False,
        experimental: bool = False,
        enable_cache=True,
    ):
        if device is None:
            device = select_device(experimental=experimental)
            self.logger.info("use device %s", str(device))
        self.device = device
        self.device_gpt = device if "mps" not in str(device) else torch.device("cpu")
        self.compile = compile

        feature_extractor = instantiate_class(
            args=(), init=asdict(self.config.vocos.feature_extractor)
        )
        backbone = instantiate_class(args=(), init=asdict(self.config.vocos.backbone))
    
```

### Core Architecture Module: `ChatTTS/model/velocity/llm_engine.py`
```
import copy
from collections import defaultdict
import os
import time
from typing import TYPE_CHECKING, Any, Dict, Iterable, List, Optional, Tuple, Union

from vllm.config import CacheConfig, ModelConfig, ParallelConfig, SchedulerConfig
from .scheduler import Scheduler, SchedulerOutputs
from .configs import EngineArgs
from vllm.engine.metrics import record_metrics
from vllm.engine.ray_utils import RayWorkerVllm, initialize_cluster, ray
from vllm.logger import init_logger
from .output import RequestOutput
from .sampling_params import SamplingParams
from .sequence import (
    SamplerOutput,
    Sequence,
    SequenceGroup,
    SequenceGroupOutput,
    SequenceOutput,
    SequenceStatus,
)
from vllm.transformers_utils.tokenizer import detokenize_incrementally, get_tokenizer
from vllm.utils import Counter, set_cuda_visible_devices, get_ip, get_open_port
import numpy as np

if ray:
    from ray.util.scheduling_strategies import PlacementGroupSchedulingStrategy

if TYPE_CHECKING:
    from ray.util.placement_group import PlacementGroup

logger = init_logger(__name__)

_LOGGING_INTERVAL_SEC = 5


class LLMEngine:
    """An LLM engine that receives requests and generates texts.

    This is the main class for the vLLM engine. It receives requests
    from clients and generates texts from the LLM. It includes a tokenizer, a
    language model (possibly distributed across multiple GPUs), and GPU memory
    space allocated for intermediate states (aka KV cache). This class utilizes
    iteration-level scheduling and efficient memory management to maximize the
    serving throughput.

    The `LLM` class wraps this class for offline batched inference and the
    `AsyncLLMEngine` class wraps this class for online serving.

    NOTE: The config arguments are derived from the `EngineArgs` class. For the
    comprehensive list of arguments, see `EngineArgs`.

    Args:
        model_config: The configuration related to the LLM model.
        cache_config: The configuration related to the KV cache memory
            management.
        parallel_config: The configuration related to distributed execution.
        scheduler_config: The configuration related to the request scheduler.
        placement_group: Ray placement group for distributed execution.
            Required for distributed execution.
        log_stats: Whether to log statistics.
    """

    def __init__(
        self,
        model_config: ModelConfig,
        cache_config: CacheConfig,
        parallel_config: ParallelConfig,
        scheduler_config: SchedulerConfig,
        placement_group: Optional["PlacementGroup"],
        post_model_path: str,
        log_stats: bool,
    ) -> None:
        logger.info(
            "Initializing an LLM engine with config: "
            f"model={model_config.model!r}, "
            f"tokenizer={model_config.tokenizer!r}, "
            f"tokenizer_mode={model_config.tokenizer_mode}, "
            f"revision={model_config.revision}, "
            f"tokenizer_revision={model_config.tokenizer_revision}, "
            f"trust_remote_code={model_config.trust_remote_code}, "
            f"dtype={model_config.dtype}, "
            f"max_seq_len={model_config.max_model_len}, "
            f"download_dir={model_config.download_dir!r}, "
            f"load_format={model_config.load_format}, "
            f"tensor_parallel_size={parallel_config.tensor_parallel_size}, "
            f"quantization={model_config.quantization}, "
            f"enforce_eager={model_config.enforce_eager}, "
            f"seed={model_config.seed}), "
            f"post_model_path={post_model_path!r}"
        )
        # TODO(woosuk): Print more configs in debug mode.

        self.model_config = model_config
        self.cache_config = cache_config
        self.parallel_config = parallel_config
        self.scheduler_config = scheduler_config
        self.log_stats = log_stats
        self._verify_args()
        self.post_model_path = post_model_path
        self.seq_counter = Counter()

        # Create the parallel GPU workers.
        if self.parallel_config.worker_use_ray:
            # Disable Ray usage stats collection.
            ray_usage = os.environ.get("RAY_USAGE_STATS_ENABLED", "0")
            if ray_usage != "1":
                os.environ["RAY_USAGE_STATS_ENABLED"] = "0"
            self._init_workers_ray(placement_group)
        else:
            self._init_workers()

        # Profile the memory usage and initialize the cache.
        self._init_cache()

        # Create the scheduler.
        self.scheduler = Scheduler(scheduler_config, cache_config)

        # Logging.
        self.last_logging_time = 0.0
        # List of (timestamp, num_tokens)
        self.num_prompt_tokens: List[Tuple[float, int]] = []
        # List of (timestamp, num_tokens)
        self.num_generation_tokens: List[Tuple[float, int]] = []

    def _init_workers(self):
        # Lazy import the Worker to avoid importing torch.cuda/xformers
        # before CUDA_VISIBLE_DEVICES is set in the Worker
        from .worker import Worker

        assert (
            self.parallel_config.world_size == 1
        ), "Ray is required if parallel_config.world_size > 1."

        self.workers: List[Worker] = []
        distributed_init_method = f"tcp://{get_ip()}:{get_open_port()}"
        self.driver_worker = Worker(
            self.model_config,
            self.parallel_config,
            self.scheduler_config,
            local_rank=0,
            rank=0,
            distributed_init_method=distributed_init_method,
            is_driver_worker=True,
            post_model_path=self.post_model_path,
        )
        self._run_workers("init_model")
        self._run_workers("load_model")

    def _init_workers_ray(self, placement_group: "PlacementGroup", **ray_remote_kwargs):
        if self.parallel_config.tensor_parallel_size == 1:
            num_gpus = self.cache_config.gpu_memory_utilization
        else:
            num_gpus = 1

        self.driver_dummy_worker: RayWorkerVllm = None
        self.workers: List[RayWorkerVllm] = []

        driver_ip = get_ip()
        for bundle_id, bundle in enumerate(placement_group.bundle_specs):
            if not bundle.get("GPU", 0):
                continue
            scheduling_strategy = PlacementGroupSchedulingStrategy(
                placement_group=placement_group,
                placement_group_capture_child_tasks=True,
                placement_group_bundle_index=bundle_id,
            )
            worker = ray.remote(
                num_cpus=0,
                num_gpus=num_gpus,
                scheduling_strategy=scheduling_strategy,
                **ray_remote_kwargs,
            )(RayWorkerVllm).remote(self.model_config.trust_remote_code)

            worker_ip = ray.get(worker.get_node_ip.remote())
            if worker_ip == driver_ip and self.driver_dummy_worker is None:
                # If the worker is on the same node as the driver, we use it
                # as the resource holder for the driver process.
                self.driver_dummy_worker = worker
            else:
                self.workers.append(worker)

        if self.driver_dummy_worker is None:
            raise ValueError(
                "Ray does not allocate any GPUs on the driver node. Consider "
                "adjusting the Ray placement group or running the driver on a "
                "GPU node."
            )

        driver_node_id, driver_gpu_ids = ray.get(
            self.driver_dummy_worker.get_node_and_gpu_ids.remote()
        )
        worker_node_and_gpu_ids = ray.get(
            [worker.get_node_and_gpu_ids.remote() for worker in self.workers]
        )

        node_workers = defaultdict(list)
        node_gpus = defaultdict(list)

        node_workers[driver_node_id].append(0)
        node_gpus[driver_node_id].extend(driver_gpu_ids)
        for i, (node_id, gpu_ids) in enumerate(worker_node_and_gpu_ids, start=1):
            node_workers[node_id].append(i)
            node_gpus[node_id].extend(gpu_ids)
        for node_id, gpu_ids in node_gpus.items():
            node_gpus[node_id] = sorted(gpu_ids)

        # Set CUDA_VISIBLE_DEVICES for the driver.
        set_cuda_visible_devices(node_gpus[driver_node_id])
        for worker, (node_id, _) in zip(self.workers, worker_node_and_gpu_ids):
            worker.set_cuda_visible_devices.remote(node_gpus[node_id])

        distributed_init_method = f"tcp://{driver_ip}:{get_open_port()}"

        # Lazy import the Worker to avoid importing torch.cuda/xformers
        # before CUDA_VISIBLE_DEVICES is set in the Worker
        from vllm.worker.worker import Worker

        # Initialize torch distributed process group for the workers.
        model_config = copy.deepcopy(self.model_config)
        parallel_config = copy.deepcopy(self.parallel_config)
        scheduler_config = copy.deepcopy(self.scheduler_config)

        for rank, (worker, (node_id, _)) in enumerate(
            zip(self.workers, worker_node_and_gpu_ids), start=1
        ):
            local_rank = node_workers[node_id].index(rank)
            worker.init_worker.remote(
                lambda rank=rank, local_rank=local_rank: Worker(
                    model_config,
                    parallel_config,
                    scheduler_config,
                    local_rank,
                    rank,
                    distributed_init_method,
                )
            )

        driver_rank = 0
        driver_local_rank = node_workers[driver_node_id].index(driver_rank)
        self.driver_worker = Worker(
            model_config,
            parallel_config,
            scheduler_config,
            driver_local_rank,
            driver_rank,
            distributed_init_method,
            is_driver_worker=True,
        )

        self._run_workers("init_model")
        self._run_workers(
            "load_model",
            max_concurrent_workers=self.parallel_config.max_parallel_loading_workers,
 
```

### Core Architecture Module: `ChatTTS/model/velocity/worker.py`
```
"""A GPU worker class."""

import os
from typing import Dict, List, Optional, Tuple

import torch
import torch.distributed

from vllm.config import CacheConfig, ModelConfig, ParallelConfig, SchedulerConfig
from vllm.model_executor import set_random_seed
from vllm.model_executor.parallel_utils.communication_op import broadcast_object_list
from vllm.model_executor.parallel_utils.parallel_state import initialize_model_parallel
from vllm.sequence import SamplerOutput, SequenceGroupMetadata
from vllm.worker.cache_engine import CacheEngine

from .model_runner import ModelRunner


class Worker:
    """A worker class that executes (a partition of) the model on a GPU.

    Each worker is associated with a single GPU. The worker is responsible for
    maintaining the KV cache and executing the model on the GPU. In case of
    distributed inference, each worker is assigned a partition of the model.
    """

    def __init__(
        self,
        model_config: ModelConfig,
        parallel_config: ParallelConfig,
        scheduler_config: SchedulerConfig,
        local_rank: int,
        rank: int,
        distributed_init_method: str,
        post_model_path: str,
        is_driver_worker: bool = False,
    ) -> None:
        self.model_config = model_config
        self.parallel_config = parallel_config
        self.scheduler_config = scheduler_config
        self.local_rank = local_rank
        self.rank = rank
        self.distributed_init_method = distributed_init_method
        self.is_driver_worker = is_driver_worker
        self.post_model_path = post_model_path

        if self.is_driver_worker:
            assert self.rank == 0, "The driver worker must have rank 0."

        self.model_runner = ModelRunner(
            model_config,
            parallel_config,
            scheduler_config,
            is_driver_worker,
            post_model_path,
        )
        # Uninitialized cache engine. Will be initialized by
        # self.init_cache_engine().
        self.cache_config = None
        self.cache_engine = None
        self.cache_events = None
        self.gpu_cache = None

    def init_model(self) -> None:
        # torch.distributed.all_reduce does not free the input tensor until
        # the synchronization point. This causes the memory usage to grow
        # as the number of all_reduce calls increases. This env var disables
        # this behavior.
        # Related issue:
        # https://discuss.pytorch.org/t/cuda-allocation-lifetime-for-inputs-to-distributed-all-reduce/191573
        os.environ["TORCH_NCCL_AVOID_RECORD_STREAMS"] = "1"

        # This env var set by Ray causes exceptions with graph building.
        os.environ.pop("NCCL_ASYNC_ERROR_HANDLING", None)
        self.device = torch.device(f"cuda:{self.local_rank}")
        torch.cuda.set_device(self.device)

        _check_if_gpu_supports_dtype(self.model_config.dtype)

        # Initialize the distributed environment.
        _init_distributed_environment(
            self.parallel_config, self.rank, self.distributed_init_method
        )

        # Initialize the model.
        set_random_seed(self.model_config.seed)

    def load_model(self):
        self.model_runner.load_model()

    @torch.inference_mode()
    def profile_num_available_blocks(
        self,
        block_size: int,
        gpu_memory_utilization: float,
        cpu_swap_space: int,
    ) -> Tuple[int, int]:
        # Profile the memory usage of the model and get the maximum number of
        # cache blocks that can be allocated with the remaining free memory.
        torch.cuda.empty_cache()

        # Execute a forward pass with dummy inputs to profile the memory usage
        # of the model.
        self.model_runner.profile_run()

        # Calculate the number of blocks that can be allocated with the
        # profiled peak memory.
        torch.cuda.synchronize()
        free_gpu_memory, total_gpu_memory = torch.cuda.mem_get_info()
        peak_memory = total_gpu_memory - free_gpu_memory

        cache_block_size = CacheEngine.get_cache_block_size(
            block_size, self.model_config, self.parallel_config
        )
        num_gpu_blocks = int(
            (total_gpu_memory * gpu_memory_utilization - peak_memory)
            // cache_block_size
        )
        num_cpu_blocks = int(cpu_swap_space // cache_block_size)
        num_gpu_blocks = max(num_gpu_blocks, 0)
        num_cpu_blocks = max(num_cpu_blocks, 0)
        torch.cuda.empty_cache()
        return num_gpu_blocks, num_cpu_blocks

    def init_cache_engine(self, cache_config: CacheConfig) -> None:
        self.cache_config = cache_config
        self.cache_engine = CacheEngine(
            self.cache_config, self.model_config, self.parallel_config
        )
        self.cache_events = self.cache_engine.events
        self.gpu_cache = self.cache_engine.gpu_cache
        self.model_runner.set_block_size(self.cache_engine.block_size)

    def warm_up_model(self) -> None:
        if not self.model_config.enforce_eager:
            self.model_runner.capture_model(self.gpu_cache)
        # Reset the seed to ensure that the random state is not affected by
        # the model initialization and profiling.
        set_random_seed(self.model_config.seed)

    def cache_swap(
        self,
        blocks_to_swap_in: Dict[int, int],
        blocks_to_swap_out: Dict[int, int],
        blocks_to_copy: Dict[int, List[int]],
    ) -> None:
        # Issue cache operations.
        issued_cache_op = False
        if blocks_to_swap_in:
            self.cache_engine.swap_in(blocks_to_swap_in)
            issued_cache_op = True
        if blocks_to_swap_out:
            self.cache_engine.swap_out(blocks_to_swap_out)
            issued_cache_op = True
        if blocks_to_copy:
            self.cache_engine.copy(blocks_to_copy)
            issued_cache_op = True

        cache_events = self.cache_events if issued_cache_op else None

        # Wait for cache operations to finish.
        # TODO(woosuk): Profile swapping overhead and optimize if needed.
        if cache_events is not None:
            for event in cache_events:
                event.wait()

    @torch.inference_mode()
    def execute_model(
        self,
        seq_group_metadata_list: Optional[List[SequenceGroupMetadata]] = None,
        blocks_to_swap_in: Optional[Dict[int, int]] = None,
        blocks_to_swap_out: Optional[Dict[int, int]] = None,
        blocks_to_copy: Optional[Dict[int, List[int]]] = None,
    ) -> Optional[SamplerOutput]:
        if self.is_driver_worker:
            assert seq_group_metadata_list is not None
            num_seq_groups = len(seq_group_metadata_list)
            assert blocks_to_swap_in is not None
            assert blocks_to_swap_out is not None
            assert blocks_to_copy is not None
            block_swapping_info = [
                blocks_to_swap_in,
                blocks_to_swap_out,
                blocks_to_copy,
            ]
            broadcast_object_list([num_seq_groups] + block_swapping_info, src=0)
        else:
            # num_seq_groups, blocks_to_swap_in, blocks_to_swap_out,
            # blocks_to_copy (4 elements)
            recv_data = [None] * 4
            broadcast_object_list(recv_data, src=0)
            num_seq_groups = recv_data[0]
            block_swapping_info = recv_data[1:]

        self.cache_swap(*block_swapping_info)

        # If there is no input, we don't need to execute the model.
        if num_seq_groups == 0:
            return {}

        output = self.model_runner.execute_model(
            seq_group_metadata_list, self.gpu_cache
        )
        return output


def _init_distributed_environment(
    parallel_config: ParallelConfig,
    rank: int,
    distributed_init_method: Optional[str] = None,
) -> None:
    """Initialize the distributed environment."""
    if torch.distributed.is_initialized():
        torch_world_size = torch.distributed.get_world_size()
        if torch_world_size != parallel_config.world_size:
            raise RuntimeError(
                "torch.distributed is already initialized but the torch world "
                "size does not match parallel_config.world_size "
                f"({torch_world_size} vs. {parallel_config.world_size})."
            )
    elif not distributed_init_method:
        raise ValueError(
            "distributed_init_method must be set if torch.distributed "
            "is not already initialized"
        )
    else:
        torch.distributed.init_process_group(
            backend="nccl",
            world_size=parallel_config.world_size,
            rank=rank,
            init_method=distributed_init_method,
        )

    # A small all_reduce for warmup.
    torch.distributed.all_reduce(torch.zeros(1).cuda())
    initialize_model_parallel(
        parallel_config.tensor_parallel_size, parallel_config.pipeline_parallel_size
    )


def _check_if_gpu_supports_dtype(torch_dtype: torch.dtype):
    # Check if the GPU supports the dtype.
    if torch_dtype == torch.bfloat16:
        compute_capability = torch.cuda.get_device_capability()
        if compute_capability[0] < 8:
            gpu_name = torch.cuda.get_device_name()
            raise ValueError(
                "Bfloat16 is only supported on GPUs with compute capability "
                f"of at least 8.0. Your {gpu_name} GPU has compute capability "
                f"{compute_capability[0]}.{compute_capability[1]}."
            )

```

### Core Architecture Module: `ChatTTS/utils/__init__.py`
```
from .dl import check_all_assets, download_all_assets
from .gpu import select_device
from .io import load_safetensors, get_latest_modified_file, del_all, FileLike
from .log import logger

```

### Core Architecture Module: `ChatTTS/utils/dl.py`
```
import os
from pathlib import Path
import hashlib
import requests
from io import BytesIO
from typing import Dict, Tuple, Optional
from mmap import mmap, ACCESS_READ

from .log import logger


def sha256(fileno: int) -> str:
    data = mmap(fileno, 0, access=ACCESS_READ)
    h = hashlib.sha256(data).hexdigest()
    del data
    return h


def check_model(
    dir_name: Path, model_name: str, hash: str, remove_incorrect=False
) -> bool:
    target = dir_name / model_name
    relname = target.as_posix()
    logger.get_logger().debug(f"checking {relname}...")
    if not os.path.exists(target):
        logger.get_logger().info(f"{target} not exist.")
        return False
    with open(target, "rb") as f:
        digest = sha256(f.fileno())
        bakfile = f"{target}.bak"
        if digest != hash:
            logger.get_logger().warning(f"{target} sha256 hash mismatch.")
            logger.get_logger().info(f"expected: {hash}")
            logger.get_logger().info(f"real val: {digest}")
            if remove_incorrect:
                if not os.path.exists(bakfile):
                    os.rename(str(target), bakfile)
                else:
                    os.remove(str(target))
            return False
        if remove_incorrect and os.path.exists(bakfile):
            os.remove(bakfile)
    return True


def check_folder(
    base_dir: Path,
    *innder_dirs: str,
    names: Tuple[str],
    sha256_map: Dict[str, str],
    update=False,
) -> bool:
    key = "sha256_"
    current_dir = base_dir
    for d in innder_dirs:
        current_dir /= d
        key += f"{d}_"

    for model in names:
        menv = model.replace(".", "_")
        if not check_model(current_dir, model, sha256_map[f"{key}{menv}"], update):
            return False
    return True


def check_all_assets(base_dir: Path, sha256_map: Dict[str, str], update=False) -> bool:
    logger.get_logger().info("checking assets...")

    if not check_folder(
        base_dir,
        "asset",
        names=(
            "Decoder.safetensors",
            "DVAE.safetensors",
            "Embed.safetensors",
            "Vocos.safetensors",
        ),
        sha256_map=sha256_map,
        update=update,
    ):
        return False

    if not check_folder(
        base_dir,
        "asset",
        "gpt",
        names=(
            "config.json",
            "model.safetensors",
        ),
        sha256_map=sha256_map,
        update=update,
    ):
        return False

    if not check_folder(
        base_dir,
        "asset",
        "tokenizer",
        names=(
            "special_tokens_map.json",
            "tokenizer_config.json",
            "tokenizer.json",
        ),
        sha256_map=sha256_map,
        update=update,
    ):
        return False

    logger.get_logger().info("all assets are already latest.")
    return True


def download_and_extract_tar_gz(
    url: str, folder: str, headers: Optional[Dict[str, str]] = None
):
    import tarfile

    logger.get_logger().info(f"downloading {url}")
    response = requests.get(url, headers=headers, stream=True, timeout=(10, 3))
    with BytesIO() as out_file:
        out_file.write(response.content)
        out_file.seek(0)
        logger.get_logger().info(f"downloaded.")
        with tarfile.open(fileobj=out_file, mode="r:gz") as tar:
            tar.extractall(folder)
        logger.get_logger().info(f"extracted into {folder}")


def download_and_extract_zip(
    url: str, folder: str, headers: Optional[Dict[str, str]] = None
):
    import zipfile

    logger.get_logger().info(f"downloading {url}")
    response = requests.get(url, headers=headers, stream=True, timeout=(10, 3))
    with BytesIO() as out_file:
        out_file.write(response.content)
        out_file.seek(0)
        logger.get_logger().info(f"downloaded.")
        with zipfile.ZipFile(out_file) as zip_ref:
            zip_ref.extractall(folder)
        logger.get_logger().info(f"extracted into {folder}")


def download_all_assets(tmpdir: str, homedir: str, version="0.2.11"):
    import subprocess
    import platform

    archs = {
        "aarch64": "arm64",
        "armv8l": "arm64",
        "arm64": "arm64",
        "x86": "386",
        "i386": "386",
        "i686": "386",
        "386": "386",
        "x86_64": "amd64",
        "x64": "amd64",
        "amd64": "amd64",
    }
    system_type = platform.system().lower()
    architecture = platform.machine().lower()
    is_win = system_type == "windows"

    architecture = archs.get(architecture, None)
    if not architecture:
        logger.get_logger().error(f"architecture {architecture} is not supported")
        exit(1)

    BASE_URL = "https://github.com/fumiama/RVC-Models-Downloader/releases/download/"
    suffix = "zip" if is_win else "tar.gz"
    RVCMD_URL = BASE_URL + f"v{version}/rvcmd_{system_type}_{architecture}.{suffix}"
    cmdfile = os.path.join(tmpdir, "rvcmd")
    if is_win:
        download_and_extract_zip(RVCMD_URL, tmpdir)
        cmdfile += ".exe"
    else:
        download_and_extract_tar_gz(RVCMD_URL, tmpdir)
        os.chmod(cmdfile, 0o755)
    subprocess.run([cmdfile, "-notui", "-w", "0", "-H", homedir, "assets/chtts"])

```

### Core Architecture Module: `ChatTTS/utils/gpu.py`
```
import importlib.util

import torch

try:
    import torch_npu
except ImportError:
    pass

from .log import logger


def select_device(min_memory=2047, experimental=False):
    has_cuda = torch.cuda.is_available()
    if has_cuda or _is_torch_npu_available():
        provider = torch.cuda if has_cuda else torch.npu
        """
        Using Ascend NPU to accelerate the process of inferencing when GPU is not found.
        """
        dev_idx = 0
        max_free_memory = -1
        for i in range(provider.device_count()):
            props = provider.get_device_properties(i)
            free_memory = props.total_memory - provider.memory_reserved(i)
            if max_free_memory < free_memory:
                dev_idx = i
                max_free_memory = free_memory
        free_memory_mb = max_free_memory / (1024 * 1024)
        if free_memory_mb < min_memory:
            logger.get_logger().warning(
                f"{provider.device(dev_idx)} has {round(free_memory_mb, 2)} MB memory left. Switching to CPU."
            )
            device = torch.device("cpu")
        else:
            device = provider._get_device(dev_idx)
    elif torch.backends.mps.is_available():
        """
        Currently MPS is slower than CPU while needs more memory and core utility,
        so only enable this for experimental use.
        """
        if experimental:
            # For Apple M1/M2 chips with Metal Performance Shaders
            logger.get_logger().warning("experimental: found apple GPU, using MPS.")
            device = torch.device("mps")
        else:
            logger.get_logger().info("found Apple GPU, but use CPU.")
            device = torch.device("cpu")
    elif importlib.util.find_spec("torch_directml") is not None:
        """
        Currently DML is under developing and may output wrong result,
        so only enable this for experimental use.
        """
        if experimental:
            logger.get_logger().warning("experimental: using DML.")
            import torch_directml

            device = torch_directml.device(torch_directml.default_device())
        else:
            logger.get_logger().info("found DML, but use CPU.")
            device = torch.device("cpu")
    else:
        logger.get_logger().warning("no GPU or NPU found, use CPU instead")
        device = torch.device("cpu")

    return device


def _is_torch_npu_available():
    try:
        # will raise a AttributeError if torch_npu is not imported or a RuntimeError if no NPU found
        _ = torch.npu.device_count()
        return torch.npu.is_available()
    except (AttributeError, RuntimeError):
        return False

```

### Core Architecture Module: `ChatTTS/utils/io.py`
```
import os
import logging
from typing import Union, IO
from dataclasses import is_dataclass

from safetensors import safe_open
import torch

from .log import logger

if hasattr(torch.serialization, "FILE_LIKE"):
    FileLike = torch.serialization.FILE_LIKE
elif hasattr(torch.types, "FILE_LIKE"):
    FileLike = torch.types.FileLike
else:
    FileLike = Union[str, os.PathLike, IO[bytes]]


@torch.inference_mode()
def load_safetensors(filename: str):
    state_dict_tensors = {}
    with safe_open(filename, framework="pt") as f:
        for k in f.keys():
            state_dict_tensors[k] = f.get_tensor(k)
    return state_dict_tensors


def get_latest_modified_file(directory):

    files = [os.path.join(directory, f) for f in os.listdir(directory)]
    if not files:
        logger.get_logger().log(
            logging.WARNING, f"no files found in the directory: {directory}"
        )
        return None
    latest_file = max(files, key=os.path.getmtime)

    return latest_file


def del_all(d: Union[dict, list]):
    if is_dataclass(d):
        for k in list(vars(d).keys()):
            x = getattr(d, k)
            if isinstance(x, dict) or isinstance(x, list) or is_dataclass(x):
                del_all(x)
            del x
            delattr(d, k)
    elif isinstance(d, dict):
        lst = list(d.keys())
        for k in lst:
            x = d.pop(k)
            if isinstance(x, dict) or isinstance(x, list) or is_dataclass(x):
                del_all(x)
            del x
    elif isinstance(d, list):
        while len(d):
            x = d.pop()
            if isinstance(x, dict) or isinstance(x, list) or is_dataclass(x):
                del_all(x)
            del x
    else:
        del d

```

### Core Architecture Module: `ChatTTS/utils/log.py`
```
import logging
from pathlib import Path


class Logger:
    def __init__(self, logger=logging.getLogger(Path(__file__).parent.name)):
        self.logger = logger

    def set_logger(self, logger: logging.Logger):
        self.logger = logger

    def get_logger(self) -> logging.Logger:
        return self.logger


logger = Logger()

```

### Core Architecture Module: `ChatTTS/__init__.py`
```
from .core import Chat

```

### Core Architecture Module: `ChatTTS/config/__init__.py`
```
from .config import Config

```

### Core Architecture Module: `ChatTTS/config/config.py`
```
from dataclasses import dataclass


@dataclass(repr=False, eq=False)
class Path:
    vocos_ckpt_path: str = "asset/Vocos.safetensors"
    dvae_ckpt_path: str = "asset/DVAE.safetensors"
    gpt_ckpt_path: str = "asset/gpt"
    decoder_ckpt_path: str = "asset/Decoder.safetensors"
    tokenizer_path: str = "asset/tokenizer"
    embed_path: str = "asset/Embed.safetensors"


@dataclass(repr=False, eq=False)
class Decoder:
    idim: int = 384
    odim: int = 384
    hidden: int = 512
    n_layer: int = 12
    bn_dim: int = 128


@dataclass(repr=False, eq=False)
class VQ:
    dim: int = 1024
    levels: tuple = (5, 5, 5, 5)
    G: int = 2
    R: int = 2


@dataclass(repr=False, eq=False)
class DVAE:
    encoder: Decoder = Decoder(
        idim=512,
        odim=1024,
        hidden=256,
        n_layer=12,
        bn_dim=128,
    )
    decoder: Decoder = Decoder(
        idim=512,
        odim=512,
        hidden=256,
        n_layer=12,
        bn_dim=128,
    )
    vq: VQ = VQ()


@dataclass(repr=False, eq=False)
class GPT:
    hidden_size: int = 768
    intermediate_size: int = 3072
    num_attention_heads: int = 12
    num_hidden_layers: int = 20
    use_cache: bool = False
    max_position_embeddings: int = 4096

    spk_emb_dim: int = 192
    spk_KL: bool = False
    num_audio_tokens: int = 626
    num_text_tokens: int = 21178
    num_vq: int = 4


@dataclass(repr=False, eq=False)
class Embed:
    hidden_size: int = 768
    num_audio_tokens: int = 626
    num_text_tokens: int = 21178
    num_vq: int = 4


@dataclass(repr=False, eq=False)
class FeatureExtractorInitArgs:
    sample_rate: int = 24000
    n_fft: int = 1024
    hop_length: int = 256
    n_mels: int = 100
    padding: str = "center"


@dataclass(repr=False, eq=False)
class FeatureExtractor:
    class_path: str = "vocos.feature_extractors.MelSpectrogramFeatures"
    init_args: FeatureExtractorInitArgs = FeatureExtractorInitArgs()


@dataclass(repr=False, eq=False)
class BackboneInitArgs:
    input_channels: int = 100
    dim: int = 512
    intermediate_dim: int = 1536
    num_layers: int = 8


@dataclass(repr=False, eq=False)
class Backbone:
    class_path: str = "vocos.models.VocosBackbone"
    init_args: BackboneInitArgs = BackboneInitArgs()


@dataclass(repr=False, eq=False)
class FourierHeadInitArgs:
    dim: int = 512
    n_fft: int = 1024
    hop_length: int = 256
    padding: str = "center"


@dataclass(repr=False, eq=False)
class FourierHead:
    class_path: str = "vocos.heads.ISTFTHead"
    init_args: FourierHeadInitArgs = FourierHeadInitArgs()


@dataclass(repr=False, eq=False)
class Vocos:
    feature_extractor: FeatureExtractor = FeatureExtractor()
    backbone: Backbone = Backbone()
    head: FourierHead = FourierHead()


@dataclass(repr=False, eq=False)
class Config:
    path: Path = Path()
    decoder: Decoder = Decoder()
    dvae: DVAE = DVAE()
    gpt: GPT = GPT()
    embed: Embed = Embed()
    vocos: Vocos = Vocos()
    spk_stat: str = (
        "愐穤巩噅廷戇笉屈癐媄垹垧帶爲漈塀殐慄亅倴庲舴猂瑈圐狴夥圓帍戛挠腉耐劤坽喳幾战謇聀崒栄呥倸庭燡欈杁襐褄乭埗幺爃弔摁斐捔兕佖廐舏竾豃磐姓趡佄幒爚欄豄讐皳訵仩帆投謌荃蝐叄圝伆幦抂茁呄掑斃讹傮庞爣蜀橁偐祄亥兡常爂欍扉丐浔佱僈強払伅扂蛐徴憍傞巀戺欀艂琐嗴啥値彷刂權穈扒卤俔贲庛初笂卄贐枴仭亁庛剎猢扃缐趤刁偵幪舏伌煁婐潤晍位弾舙茥穁葏蠣訑企庤刊笍橁溑僔云偁庯戚伍潉膐脴僵噔廃艅匊祂唐憴壝嗙席爥欁虁谐牴帽势弿牳蜁兀蛐傄喩丿帔刔圆衁廐罤庁促帙劢伈汄樐檄勵伴弝舑欍罅虐昴劭勅帜刼朊蕁虐蓴樑伫幨扑謪剀堐稴丵伱弐舮諸赁習俔容厱幫牶謃孄糐答嗝僊帜燲笄終瀒判久僤帘爴茇千孑冄凕佳引扐蜁歁缏裄剽儺恘爋朏眿廐呄塍嘇幻爱茠詁訐剴唭俐幾戊欀硁菐贄楕偒巡爀弎屄莐睳賙凶彎刅漄區唐溴剑劋庽舽猄煃跐夔惥伾庮舎伈罁垑坄怅业怯刁朇獁嶏覔坩俳巶爜朐潁崐萄俹凛常爺笌穀聐此夡倛帡刀匉終窏舣販侽怿扉伥贿憐忓謩姆幌犊漂慆癒却甝兎帼戏欅詂浐朔仹壭帰臷弎恇菐獤帡偖帘爞伅腂皐纤囅充幓戠伥灂丐訤戱倱弋爮嬌癁恐孄侥劬忶刓國詀桒古偩嘄庬戚茝赂监燤嘑勌幦舽持呂諐棤姑再底舡笍艃瀐孴倉傔弋爔猠乁濑塄偽嘧恂舛缇襃厐窴仡刱忕別漇穁岏缴廽价庌爊謈硄讑惤倁儂庭爋伇蝂嶐莔摝傠库刞茄歃戏薤伍伯廮创笠塄熐兴勽俄帅剉最腀砐敤卝侍弆戺朒虃旐蚄梕亖幔牻朣扅贐玔堝噅帡剌圅摀崐彤流僳庙爖嬇啁渐悤堁丛幆刧挜彃悐幤刹嚟恕芁看聀摐焔向乁帖爭欁癃糒圄弙佱廜戤謍婀咐昴焍亩廦艏拼謿芐癤怹兽幸舳朇畁喐稔毝丼弈懲挀譂勑哴啁伎常舭笯晁堑俄叩剔廟爍欦絁夒伤休傑廳戌蜅潆癐彴摑勯床刽欅艁砐忄搉从廡舊猥潂唐委仱僜廼爤朄呃弐礔滵垓幩爄挂筁乐籤刕凟幵爠弉癅乑吴勥伖帪舩茆婁碐幤叭乢巜艳猁桀桐啄唩俊幍舮猀艅焐螔琽亀帋爜缅噃咐斤喩予幩爛笆摀浐猴依侹幃刕園慄蛐栤澹仑座爼謉桃慐浔斕偻幛懰嬓衁愐氄悅仿应芔漄衃敐謤傁匩幹抃圉癄廐裄屵噉幍利謍聂搐蛔嚙坍怗舁圐畃膐栄刵东巆戤諾呃偑媤嗨跞忶爝眄祂朒嶔僭劉忾刐匋癄袐翴珅僷廲芄茈恈皐擄崑伄廉牍匃剃犏澤唑丄庺戃伃煀某杄偙亽帴切缌罄挐尴噙倰带舞漄橄塐糴俩僯帀般漀坂栐更両俇廱舌猁慂拐偤嶱卶应刪眉獁茐伔嘅偺帟舊漂恀栐暄喡乞庙舆匂敀潑恔劑侖延戦盽怶唯慳蝘蟃孫娎益袰玍屃痶翮笪儚裀倹椌玻翀詵筽舘惯堿某侰晈藏缮詗廦夸妎瑻瀒裔媀憞唃冶璭狻渠荑奬熹茅愺氰菣滠翦岓褌泣崲嚭欓湒聙宺爄蛅愸庍匃帆誔穮懌蓪玷澌氋抌訙屌臞廛玸听屺希疭孝凂紋新煎彃膲跱尪懁眆窴珏卓揨菸紭概囥显壌榄垫嘮嬭覤媸侵佮烒耸觌婀秋狃帹葯訤桜糨笾腢伀肶悍炂艤禖岅臺惘梷瞍友盁佨岧憳瓧嘴汬藊愌蘤嶠硴绤蜲襏括勾谂縨妥蓪澭竭萢藜纞糲煮愆瀯孯琓罂諺塿燗狟弙衯揻縷丱糅臄梱瀮杰巳猙亊符胠匃泀廏圃膂蒃籏礩岈簹缌劺燲褡孓膜拔蠿觮呋煣厌尷熜論弲牭紫寊誃紀橴賬傸箍弚窃侫簲慯烣渽祌壓媥噜夽夛諛玹疮禄冪謇媽衤盰缺繑薫兾萧嵱打滽箺嚯凣狢蠜崼覽烸簶盯籓摀苶峸懗泲涻凮愳緗剋笔懆廡瞿椏礤惐藥崍腈烄伹亯昣翬褍絋桫僨吨莌丛矄蜞娈憊苆塁蓏嚢嫼绻崱婋囱蠸篯晣芀繼索兓僖誹岯圪褰蠇唓妷胅巁渮砛傈蝷嵚冃購赁峍裋荂舾符熻岳墩寮粃凲袑彚太绲头摯繳狁俥籌冝諝註坎幫擤詒宒凕賐唶梎噔弼課屿覍囨焬櫱撪蝮蝬簸懰櫫涺嵍睻屪翔峞慘滟熲昱军烊舿尦舄糖奁溏凂彆蝲糴禍困皻灏牋睒诙嶱臀开蓈眎腼丢纻廏憤嫖暭袭崲肸螛妒榗紉谨窮袃瑠聍绊腆亿冲葐喋縔詖岑兾给堸赏旻桀蛨媆訂峦紷敯囬偐筨岸焸拭笵殒哜墒萍屓娓諙械臮望摰芑寭准僞谹氍旋憢菮屃划欣瘫谎蘻哐繁籥禦僿誵皯墓燀縿笞熦绗稹榎矻綞蓓帡戓沺区才畃洊詪糐裶盰窶耎偌劂誐庩惝滜沺哮呃煐譠崄槀猄肼蔐擋湌蠺篃恥諌瞦宍堫挪裕崑慩狲悠煋仛愞砈粵八棁害楐妋萔貨尵奂苰怫誎傫岆蕯屇脉夈仆茎刓繸芺壸碗曛汁戭炻獻凉媁兎狜爴怰賃纎袏娷禃蓥膹薪渻罸窿粫凾褄舺窮墫干苊繁冏僮訸夯绛蓪虛羽慲烏憷趎睊蠰莍塞成廎盁欏喓蜮譤崆楁囘矇薭伣艘虝帴奮苢渶虎暣翐蝃尾稈糶瀴罐嵚氮葯笫慐棌悶炯竻爅们媡姢嫺窷刮歫劈裩屬椕賑蜹薊刲義哯尗褦瓀稾礋揣窼舫尋姁椄侸嗫珺修纘媃腽蛛稹梭呛瀈蘟縀礉論夵售主梮蠉娅娭裀誼嶭観枳倊簈褃擞綿催瞃溶苊笛襹櫲盅六囫獩佃粨慯瓢眸旱荃婨蔞岋祗墼焻网牻琖詆峋秉胳媴袭澓賢経稟壩胫碯偏囫嶎纆窈槊賐撹璬莃缘誾宭愊眗喷监劋萘訯總槿棭戾墮犄恌縈簍樥蛔杁袭嫛憫倆篏墵賈羯茎觳蒜致娢慄勒覸蘍曲栂葭宆妋皽缽免盳猼蔂糥觧烳檸佯憓煶蔐筼种繷琲膌塄剰讎対腕棥渽忲俛浪譬秛惛壒嘸淫冻曄睻砃奫貯庴爅粓脮脡娎妖峵蘲討惋泊蠀㴆"
    )

```

### Core Architecture Module: `ChatTTS/model/__init__.py`
```
from .dvae import DVAE
from .embed import Embed
from .gpt import GPT
from .processors import gen_logits
from .speaker import Speaker
from .tokenizer import Tokenizer

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #991** (2026-04-10): **fix: add missing parentheses to @torch.inference_mode decorator**
  *Symptoms*: In `ChatTTS/model/tokenizer.py`, the `decode` method uses `@torch.inference_mode` without parentheses, while the `encode` method (and every other usage across the codebase) correctly uses `@torch.inference_mode()`.  Without parentheses, `torch.inference_mode` is applied as a raw class rather than as a decorator factory. This means the `decode` method gets replaced by the `torch.inference_mode` context manager object itself, instead of being wrapped with inference mode enabled. As a result, calling `decode` won't actually perform any decoding — it silently returns the context manager.  This patch adds the missing `()` to match the rest of the codebase and restore correct behavior.

- **Issue #987** (2026-04-10): **AttributeError: BertTokenizer has no attribute encode_plus**
  *Symptoms*: After running `python .\examples\web\webui.py`, then click on the Generate button, error shows: 下载运行 `python .\examples\web\webui.py` 后点击 Generate 按钮后就发生了下面的错误 ``` (.venv) PS C:\Users\Inch\PycharmProjects\ChatTTS> python .\examples\web\webui.py [+0800 20260207 16:47:57] [WARN]  WebUI  | funcs | no ffmpeg installed, use wav file output [+0800 20260207 16:47:57] [INFO]  WebUI  | webui | loading ChatTTS model... [+0800 20260207 16:47:57] [INFO] ChatTTS | dl | checking assets... [+0800 20260207 16:47:58] [INFO] ChatTTS | dl | all assets are already latest. [+0800 20260207 16:47:58] [WARN] ChatTTS | gpu | no GPU or NPU found, use CPU instead [+0800 20260207 16:47:58] [INFO] ChatTTS | core | use device cpu [+0800 20260207 16:47:58] [INFO] ChatTTS | core | vocos loaded. [+0800 20260207 16:47:58] [INFO] ChatTTS | core | dvae loaded. [+0800 20260207 16:47:58] [INFO] ChatTTS | core | embed loaded. Loading weights: 100%|████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 182/182 [00:00<00:00, 2281.98it/s, Materializing param=norm.weight] [+0800 20260207 16:47:58] [INFO] ChatTTS | core | gpt loaded. [+0800 20260207 16:47:58] [INFO] ChatTTS | core | speaker loaded. [+0800 20260207 16:47:59] [INFO] ChatTTS | core | decoder loaded. [+0800 20260207 16:47:59] [INFO] ChatTTS | core | tokenizer loaded. [+0800 20260207 16:47:59] [WA
  **Post-Mortem & Fix Analysis**:
  > Maybe your transformers version is too new. Try installing an older version
  > Try "_encode_plus", it work for me.
  > 固定一下依赖包的版本就可以用了  ```[project] name = "huisheng" version = "0.1.0" description = "Add your description here" readme = "README.md" requires-python = ">=3.12" dependencies = [     "chattts>=0.2.4",     "requests>=2.32.5",     "torch==2.4.*",     "torchaudio==2.4.*",     "transformers==4.46.3", ] ````  ```python import ChatTTS import torch import torchaudio import numpy as np from scipy.io import wavfile  chat = ChatTTS.Chat() chat.load(compile=False)  # Set to True for better performance  # 换成你要合成的真实文本 texts = ["你好，这是第一句。", "这是第二句测试音频导出。"]  wavs = chat.infer(texts)  for i, wav in enumerate(wavs):     output_path = f"basic_output{i}.wav"      # ChatTTS 通常返回 float32 numpy，范围约在 [-1, 1]     wav_np = np.asarray(wav, dtype=np.float32)     wav_tensor = torch.from_numpy(wav_np).unsqueeze(0)  # [1, T]      try:         # 显式指定 format，避免 backend 无法推断         torchaudio.save(output_path, wav_tensor, 24000, format="wav")     except Exception:         # 兜底：用 scipy 写 wav（16-bit PCM）         wav_int16 = 

- **Issue #955** (2025-11-27): **RuntimeError: narrow(): length must be non-negative.**
  *Symptoms*: main分支和dev分支都会出现下面的问题。  text:   0%|▏                                                                           | 1/384(max) [00:00,  5.46it/s]Traceback (most recent call last):   File "/home/ubuntu/code/ChatTTS/r.py", line 16, in <module>     wavs = chat.infer(texts, use_decoder=True)            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/home/ubuntu/code/ChatTTS/ChatTTS/core.py", line 263, in infer     for wavs in res_gen:   File "/home/ubuntu/code/ChatTTS/ChatTTS/core.py", line 420, in _infer     refined = self._refine_text(               ^^^^^^^^^^^^^^^^^^   File "/home/ubuntu/miniconda3/envs/chattts/lib/python3.11/site-packages/torch/utils/_contextlib.py", line 116, in decorate_context     return func(*args, **kwargs)            ^^^^^^^^^^^^^^^^^^^^^   File "/home/ubuntu/code/ChatTTS/ChatTTS/core.py", line 730, in _refine_text     result = next(              ^^^^^   File "/home/ubuntu/miniconda3/envs/chattts/lib/python3.11/site-packages/torch/utils/_contextlib.py", line 36, in generator_context     response = gen.send(None)                ^^^^^^^^^^^^^^   File "/home/ubuntu/code/ChatTTS/ChatTTS/model/gpt.py", line 396, in generate     model_input = self._prepare_generation_inputs(                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/home/ubuntu/miniconda3/envs/chattts/lib/python3.11/site-packages/torch/utils/_contextlib.py", line 116, in decorate_context     return func(*args, **kwargs)            ^^^^^^^^^^^^^^^^^^^^^   File "/home/ubuntu/code/ChatTTS/ChatTTS/mod
  **Post-Mortem & Fix Analysis**:
  > <img width="1050" height="369" alt="Image" src="https://github.com/user-attachments/assets/f498d9cd-2ffa-4732-829a-0c9ed5a7e3cd" />
  > I got the same issue and fix it. You can try to downgrade transformers==4.53.2
  > > I got the same issue and fix it. You can try to downgrade transformers==4.53.2  @aef5748  Thanks for the suggestion! Downgrading to transformers==4.53.2 worked for me as well. It saved me a lot of time.  

- **Issue #933** (2025-06-19): **AttributeError: module 'torch.serialization' has no attribute 'FILE_LIKE'**
  *Symptoms*:  Hi,  I'm on python 3.13 and installed ChatTTS and its requirments.txt ... via the Pycharm packages repository (PIP)  Everything installed with no errors.  But when I run the main webpages basic example code ... in python. ```  import ChatTTS import torch import torchaudio  chat = ChatTTS.Chat() chat.load(compile=False) # Set to True for better performance  texts = ["PUT YOUR 1st TEXT HERE", "PUT YOUR 2nd TEXT HERE"]  wavs = chat.infer(texts)  for i in range(len(wavs)):     """     In some versions of torchaudio, the first line works but in other versions, so does the second line.     """     try:         torchaudio.save(f"basic_output{i}.wav", torch.from_numpy(wavs[i]).unsqueeze(0), 24000)     except:         torchaudio.save(f"basic_output{i}.wav", torch.from_numpy(wavs[i]), 24000)  ```  It returns the following error,  ``` Traceback (most recent call last):   File "D:\GOOD\Coding\.Coding_Projects\Composite_media\Text to Speech\Audiobook_Maker\test3.py", line 8, in <module>     import ChatTTS   File "C:\Users\User\AppData\Local\Programs\Python\Python313\Lib\site-packages\ChatTTS\__init__.py", line 1, in <module>     from .core import Chat   File "C:\Users\User\AppData\Local\Programs\Python\Python313\Lib\site-packages\ChatTTS\core.py", line 17, in <module>     from .model import DVAE, Embed, GPT, gen_logits, Tokenizer, Speaker   File "C:\Users\User\AppData\Local\Programs\Python\Python313\Lib\site-packages\ChatTTS\model\__init__.py", line 6, in <module>     from .tokenizer imp
  **Post-Mortem & Fix Analysis**:
  > the same problem and my way is change torch>=2.1.0 to torch==2.5.0,its solved, but i dont know what happed.
  > In newer versions of PyTorch, FILE_LIKE has been changed to FileLike. Consider downgrading to an earlier version.
  > Ok thank you! We will wait for the update

- **Issue #932** (2025-05-06): **module 'torch.serialization' has no attribute 'FILE_LIKE''**
  *Symptoms*: AttributeError: module 'torch.serialization' has no attribute 'FILE_LIKE'' #930

- **Issue #924** (2025-06-08): **运行colab里的配置出错ValueError: numpy.dtype size changed, may indicate binary incompatibility. Expected 96 from C header, got 88 from PyObject**
  *Symptoms*: 在colab里的配置在`Import Packages`运行后出现 ``` ValueError                                Traceback (most recent call last) [<ipython-input-9-2c663eac4724>](https://localhost:8080/#) in <cell line: 0>()       1 import torch       2  ----> 3 torch._dynamo.config.cache_size_limit = 64       4 torch._dynamo.config.suppress_errors = True       5 torch.set_float32_matmul_precision("high")  15 frames [/usr/local/lib/python3.11/dist-packages/numpy/random/_pickle.py](https://localhost:8080/#) in <module> ----> 1 from .mtrand import RandomState       2 from ._philox import Philox       3 from ._pcg64 import PCG64, PCG64DXSM       4 from ._sfc64 import SFC64       5   numpy/random/mtrand.pyx in init numpy.random.mtrand()  ValueError: numpy.dtype size changed, may indicate binary incompatibility. Expected 96 from C header, got 88 from PyObject ```
  **Post-Mortem & Fix Analysis**:
  > 也许是numpy版本问题。
  > This issue was closed because it has been inactive for 15 days since being marked as stale.

- **Issue #900** (2025-02-18): **windows11 python3.11生成语音时报错 The expanded size of the tensor (42) must match the existing size (41) at non-singleton dimension 3.  Target sizes: [2, 12, 1, 42].  Tensor sizes: [2, 1, 1, 41]**
  *Symptoms*: ``` [INFO] #2 download copy: '[asset/gpt/config.json asset/gpt/model.safetensors]'. [WARNING] #2.2 skip exist file D:\software\ChatTTS/asset/gpt/model.safetensors [WARNING] #2.1 skip exist file D:\software\ChatTTS/asset/gpt/config.json [INFO] #3 open target folder 'D:\software\ChatTTS/asset/tokenizer'. [INFO] #3 download copy: '[asset/tokenizer/special_tokens_map.json asset/tokenizer/tokenizer_config.json asset/tokenizer/tokenizer.json]'. [WARNING] #3.3 skip exist file D:\software\ChatTTS/asset/tokenizer/tokenizer.json [WARNING] #3.1 skip exist file D:\software\ChatTTS/asset/tokenizer/special_tokens_map.json [WARNING] #3.2 skip exist file D:\software\ChatTTS/asset/tokenizer/tokenizer_config.json [INFO] all download tasks finished. [+0800 20250218 11:39:50] [INFO] ChatTTS | dl | checking assets... [+0800 20250218 11:39:51] [INFO] ChatTTS | dl | all assets are already latest. [+0800 20250218 11:39:51] [INFO] ChatTTS | core | use device cuda:0 [+0800 20250218 11:39:51] [INFO] ChatTTS | core | vocos loaded. [+0800 20250218 11:39:52] [INFO] ChatTTS | core | dvae loaded. [+0800 20250218 11:39:52] [INFO] ChatTTS | core | embed loaded. [+0800 20250218 11:39:52] [INFO] ChatTTS | core | gpt loaded. [+0800 20250218 11:39:52] [INFO] ChatTTS | core | speaker loaded. [+0800 20250218 11:39:52] [INFO] ChatTTS | core | decoder loaded. [+0800 20250218 11:39:52] [INFO] ChatTTS | core | tokenizer loaded. [+0800 20250218 11:39:52] [WARN]  WebUI  | funcs | Package nemo_text_processing not found! [
  **Post-Mortem & Fix Analysis**:
  > fixed.

- **Issue #788** (2024-10-21): **Fix for Ascend NPU when using ChatTTS to sample the voice of a real speaker**
  *Symptoms*: # What does this PR do?  ## Overview  This PR is a bugfix for Ascend NPU when using ChatTTS to sample the voice of a real speaker.  ## Environment  - OS: ubuntu 20.04 - NPU: Atlas 300T A2 - CANN: 8.0.RC2 - torch-npu: 2.1.0.post6 - torch: 2.1.0  ## Problem  Complex dtype used in the process of computing MelSpectrogram is not supported in `torch_npu` now, and we could get a error when sampling the voice of a real speaker.  ![bug_1](https://github.com/user-attachments/assets/002bbb64-fd2a-40e7-8755-e74bc96dadb1)  The logs are showed below:  ```bash [+0000 20241016 12:19:06] [WARN]  WebUI  | funcs | no ffmpeg installed, use wav file output [+0000 20241016 12:19:06] [INFO]  WebUI  | webui | loading ChatTTS model... [+0000 20241016 12:19:06] [INFO] ChatTTS | dl | checking assets... /home/sss/bin/miniconda/miniconda3/envs/chattts_2/lib/python3.10/site-packages/gradio/analytics.py:106: UserWarning: IMPORTANT: You are using gradio version 4.44.0, however version 5.0.1 is available, please upgrade.  --------   warnings.warn( [+0000 20241016 12:19:10] [INFO] ChatTTS | dl | all assets are already latest. [W compiler_depend.ts:623] Warning: expandable_segments currently defaults to false. You can enable this feature by `export PYTORCH_NPU_ALLOC_CONF = expandable_segments:True`. (function operator()) [+0000 20241016 12:19:16] [INFO] ChatTTS | core | use device npu:0 /home/sss/bin/miniconda/miniconda3/envs/chattts_2/lib/python3.10/site-packages/torch/_utils.p
  **Post-Mortem & Fix Analysis**:
  > 已修改😄， @fumiama 

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

### Incident Patch 1: `857d3b73` (2026-04-10)
**Commit Message**: fix(tokenizer): keep tracking with latest transformers

**File**: `ChatTTS/model/tokenizer.py` (modified, +2/-1)
```diff
@@ -53,7 +53,8 @@ def encode(
 
         # avoid random speaker embedding of tokenizer in the other dims
         for t in text:
-            x = self._tokenizer.encode_plus(
+            encode_plus = self._tokenizer.encode_plus if hasattr(self._tokenizer, "encode_plus") else self._tokenizer._encode_plus
+            x = encode_plus(
                 t, return_tensors="pt", add_special_tokens=False, padding=True
             )
             input_ids_lst.append(x["input_ids"].squeeze_(0))
```

---

### Incident Patch 2: `cc212dbb` (2026-04-10)
**Commit Message**: fix: requirements.txt missed dep requests (#986)

Co-authored-by: fumiama <[REDACTED_EMAIL]>

**File**: `.github/workflows/unitest.yml` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ jobs:
         uses: actions/setup-python@v5
         with:
           python-version: ${{ matrix.python-version }}
+          cache: 'pip'
 
       - name: Install Dependents
         run: |
```

**File**: `requirements.txt` (modified, +1/-0)
```diff
@@ -14,3 +14,4 @@ WeTextProcessing; sys_platform == 'linux'
 nemo_text_processing; sys_platform == 'linux'
 av
 pydub
+requests
```

---

### Incident Patch 3: `c2fd8267` (2026-04-10)
**Commit Message**: fix: add missing parentheses to @torch.inference_mode decorator (#991)

**File**: `ChatTTS/model/tokenizer.py` (modified, +1/-1)
```diff
@@ -125,7 +125,7 @@ def encode(
 
         return new_input_ids, attention_mask, text_mask
 
-    @torch.inference_mode
+    @torch.inference_mode()
     def decode(
         self,
         sequences: Union[List[int], List[List[int]]],
```

**File**: `ChatTTS/model/velocity/configs.py` (modified, +0/-1)
```diff
@@ -12,7 +12,6 @@
 import dataclasses
 from dataclasses import dataclass
 
-
 logger = init_logger(__name__)
 
 _GB = 1 << 30
```

**File**: `ChatTTS/model/velocity/llama.py` (modified, +1/-0)
```diff
@@ -21,6 +21,7 @@
 # See the License for the specific language governing permissions and
 # limitations under the License.
 """Inference-only LLaMA model compatible with HuggingFace weights."""
+
 from typing import Any, Dict, List, Optional, Tuple
 
 import torch
```

**File**: `ChatTTS/model/velocity/llm_engine.py` (modified, +1/-1)
```diff
@@ -741,7 +741,7 @@ def _log_system_stats(
 
     def _decode_sequence(self, seq: Sequence, prms: SamplingParams) -> None:
         """Decodes the new token for a sequence."""
-        (new_tokens, new_output_text, prefix_offset, read_offset) = (
+        new_tokens, new_output_text, prefix_offset, read_offset = (
             detokenize_incrementally(
                 self.tokenizer,
                 all_input_ids=seq.get_token_ids(),
```

**File**: `ChatTTS/model/velocity/model_runner.py` (modified, +2/-2)
```diff
@@ -360,11 +360,11 @@ def prepare_input_tensors(
             is_prompt = seq_group_metadata_list[0].is_prompt
             # Prepare input tensors.
             if is_prompt:
-                (input_tokens, input_positions, input_metadata, prompt_lens) = (
+                input_tokens, input_positions, input_metadata, prompt_lens = (
                     self._prepare_prompt(seq_group_metadata_list)
                 )
             else:
-                (input_tokens, input_positions, input_metadata) = self._prepare_decode(
+                input_tokens, input_positions, input_metadata = self._prepare_decode(
                     seq_group_metadata_list
                 )
                 prompt_lens = []
```

**File**: `examples/api/main.py` (modified, +0/-1)
```diff
@@ -6,7 +6,6 @@
 from fastapi import FastAPI
 from fastapi.responses import StreamingResponse
 
-
 if sys.platform == "darwin":
     os.environ["PYTORCH_ENABLE_MPS_FALLBACK"] = "1"
 
```

**File**: `examples/onnx/modeling_llama.py` (modified, +1/-1)
```diff
@@ -21,6 +21,7 @@
 PyTorch LLaMA model.
 Copied from https://github.com/sophgo/LLM-TPU/blob/main/models/Llama2/compile/files/llama-2-7b-chat-hf/modeling_llama.py
 """
+
 import math
 from typing import List, Optional, Tuple, Union
 
@@ -45,7 +46,6 @@
 )
 from transformers.models.llama.configuration_llama import LlamaConfig
 
-
 logger = logging.get_logger(__name__)
 
 _CONFIG_FOR_DOC = "LlamaConfig"
```

**File**: `tools/audio/av.py` (modified, +0/-1)
```diff
@@ -7,7 +7,6 @@
 from av.audio.resampler import AudioResampler
 import numpy as np
 
-
 video_format_dict: Dict[str, str] = {
     "m4a": "mp4",
 }
```

---

### Incident Patch 4: `a2b36dbf` (2025-11-26)
**Commit Message**: fix(gpt): narrow(): length must be non-negative

fix #955

**File**: `.github/workflows/checksum.yml` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ jobs:
 
       - name: Run RVC-Models-Downloader
         run: |
-          wget https://github.com/fumiama/RVC-Models-Downloader/releases/download/v0.2.10/rvcmd_linux_amd64.deb
+          wget https://github.com/fumiama/RVC-Models-Downloader/releases/download/v0.2.11/rvcmd_linux_amd64.deb
           sudo apt -y install ./rvcmd_linux_amd64.deb
           rm -f ./rvcmd_linux_amd64.deb
           rvcmd -notrs -w 1 -notui assets/chtts
```

**File**: `ChatTTS/model/gpt.py` (modified, +23/-19)
```diff
@@ -162,7 +162,7 @@ def to(self, device: torch.device, dtype: torch.dtype):
     def _prepare_generation_inputs(
         self,
         input_ids: torch.Tensor,
-        past_key_values: Optional[Tuple[Tuple[torch.FloatTensor]]] = None,
+        past_key_values: Optional[Union[Tuple[Tuple[torch.FloatTensor]], Cache]] = None,
         attention_mask: Optional[torch.Tensor] = None,
         inputs_embeds: Optional[torch.Tensor] = None,
         cache_position: Optional[torch.Tensor] = None,
@@ -180,28 +180,30 @@ def _prepare_generation_inputs(
             has_static_cache = past_key_values is not None
 
         past_length = 0
+        max_cache_length = None
+        cache_length = 0
         if past_key_values is not None:
             if isinstance(past_key_values, Cache):
-                past_length = (
-                    int(cache_position[0])
-                    if cache_position is not None
-                    else past_key_values.get_seq_length()
-                )
-                try:
-                    max_cache_length = past_key_values.get_max_cache_shape()
-                except:
-                    max_cache_length = (
-                        past_key_values.get_max_length()
-                    )  # deprecated in transformers 4.48
-                cache_length = (
-                    past_length
-                    if max_cache_length is None
-                    else min(max_cache_length, past_length)
-                )
+                if past_key_values.layers and len(past_key_values.layers):
+                    past_length = (
+                        int(cache_position[0])
+                        if cache_position is not None
+                        else past_key_values.get_seq_length()
+                    )
+                    try:
+                        max_cache_length = past_key_values.get_max_cache_shape()
+                    except:
+                        max_cache_length = (
+                            past_key_values.get_max_length()
+                        )  # deprecated in transformers 4.48
+                    cache_length = (
+                        past_length
+                        if max_cache_length is None
+                        else min(max_cache_length, past_length)
+                    )
             # TODO joao: remove this `else` after `generate` prioritizes `Cache` objects
             else:
                 cache_length = past_length = past_key_values[0][0].shape[2]
-                max_cache_length = None
 
             # Keep only the unprocessed tokens:
             # 1 - If the length of the attention_mask exceeds the length of input_ids, then we are in a setting where
@@ -224,11 +226,13 @@ def _prepare_generation_inputs(
             # If we are about to go beyond the maximum cache length, we need to crop the input attention mask.
             if (
                 max_cache_length is not None
+                and max_cache_length > 0
                 and attention_mask is not None
                 and cache_length + input_ids.shape[1] > max_cache_length
             ):
+                start_pos = attention_mask.shape[1] - max_cache_length
                 attention_mask = attention_mask.narrow(
-                    1, -max_cache_length, max_cache_length
+                    1, start_pos, max_cache_length
                 )
 
         if attention_mask is not None and position_ids is None:
```

**File**: `ChatTTS/utils/dl.py` (modified, +13/-54)
```diff
@@ -143,15 +143,7 @@ def download_and_extract_zip(
         logger.get_logger().info(f"extracted into {folder}")
 
 
-def download_dns_yaml(url: str, folder: str, headers: Dict[str, str]):
-    logger.get_logger().info(f"downloading {url}")
-    response = requests.get(url, headers=headers, stream=True, timeout=(100, 3))
-    with open(os.path.join(folder, "dns.yaml"), "wb") as out_file:
-        out_file.write(response.content)
-        logger.get_logger().info(f"downloaded into {folder}")
-
-
-def download_all_assets(tmpdir: str, homedir: str, version="0.2.10"):
+def download_all_assets(tmpdir: str, homedir: str, version="0.2.11"):
     import subprocess
     import platform
 
@@ -175,48 +167,15 @@ def download_all_assets(tmpdir: str, homedir: str, version="0.2.10"):
     if not architecture:
         logger.get_logger().error(f"architecture {architecture} is not supported")
         exit(1)
-    try:
-        BASE_URL = "https://github.com/fumiama/RVC-Models-Downloader/releases/download/"
-        suffix = "zip" if is_win else "tar.gz"
-        RVCMD_URL = BASE_URL + f"v{version}/rvcmd_{system_type}_{architecture}.{suffix}"
-        cmdfile = os.path.join(tmpdir, "rvcmd")
-        if is_win:
-            download_and_extract_zip(RVCMD_URL, tmpdir)
-            cmdfile += ".exe"
-        else:
-            download_and_extract_tar_gz(RVCMD_URL, tmpdir)
-            os.chmod(cmdfile, 0o755)
-        subprocess.run([cmdfile, "-notui", "-w", "0", "-H", homedir, "assets/chtts"])
-    except Exception:
-        BASE_URL = (
-            "https://gitea.seku.su/fumiama/RVC-Models-Downloader/releases/download/"
-        )
-        suffix = "zip" if is_win else "tar.gz"
-        RVCMD_URL = BASE_URL + f"v{version}/rvcmd_{system_type}_{architecture}.{suffix}"
-        download_dns_yaml(
-            "https://gitea.seku.su/fumiama/RVC-Models-Downloader/raw/branch/main/dns.yaml",
-            tmpdir,
-            headers={
-                "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0"
-            },
-        )
-        cmdfile = os.path.join(tmpdir, "rvcmd")
-        if is_win:
-            download_and_extract_zip(RVCMD_URL, tmpdir)
-            cmdfile += ".exe"
-        else:
-            download_and_extract_tar_gz(RVCMD_URL, tmpdir)
-            os.chmod(cmdfile, 0o755)
-        subprocess.run(
-            [
-                cmdfile,
-                "-notui",
-                "-w",
-                "0",
-                "-dns",
-                os.path.join(tmpdir, "dns.yaml"),
-                "-H",
-                homedir,
-                "assets/chtts",
-            ]
-        )
+
+    BASE_URL = "https://github.com/fumiama/RVC-Models-Downloader/releases/download/"
+    suffix = "zip" if is_win else "tar.gz"
+    RVCMD_URL = BASE_URL + f"v{version}/rvcmd_{system_type}_{architecture}.{suffix}"
+    cmdfile = os.path.join(tmpdir, "rvcmd")
+    if is_win:
+        download_and_extract_zip(RVCMD_URL, tmpdir)
+        cmdfile += ".exe"
+    else:
+        download_and_extract_tar_gz(RVCMD_URL, tmpdir)
+        os.chmod(cmdfile, 0o755)
+    subprocess.run([cmdfile, "-notui", "-w", "0", "-H", homedir, "assets/chtts"])
```

**File**: `examples/web/webui.py` (modified, +4/-4)
```diff
@@ -116,14 +116,14 @@ def main():
             spk_emb_text = gr.Textbox(
                 label="Speaker Embedding",
                 max_lines=3,
-                show_copy_button=True,
+                buttons=["copy"],
                 interactive=True,
                 scale=2,
             )
             dvae_coef_text = gr.Textbox(
                 label="DVAE Coefficient",
                 max_lines=3,
-                show_copy_button=True,
+                buttons=["copy"],
                 interactive=True,
                 scale=2,
             )
@@ -161,7 +161,7 @@ def main():
         text_output = gr.Textbox(
             label="Output Text",
             interactive=False,
-            show_copy_button=True,
+            buttons=["copy"],
         )
 
         sample_audio_input.change(
@@ -279,7 +279,7 @@ def make_audio(autoplay, stream):
         server_port=args.server_port,
         root_path=args.root_path,
         inbrowser=True,
-        show_api=False,
+        footer_links=['api', 'gradio', 'settings'],
     )
 
 
```

---

### Incident Patch 5: `b17d3c26` (2025-11-26)
**Commit Message**: docs: fix typos (#972)

Found via `codespell -S docs,*.ipynb -L thre,te,erro` and `typos
--hidden --format brief`

**File**: `ChatTTS/model/velocity/block_manager.py` (modified, +1/-1)
```diff
@@ -156,7 +156,7 @@ def append_slot(self, seq: Sequence) -> Optional[Tuple[int, int]]:
                 self.block_sliding_window
                 and len(block_table) >= self.block_sliding_window
             ):
-                # re-use a block
+                # reuse a block
                 block_table.append(
                     block_table[len(block_table) % self.block_sliding_window]
                 )
```

**File**: `ChatTTS/model/velocity/model_runner.py` (modified, +6/-6)
```diff
@@ -401,9 +401,9 @@ def get_size_or_none(x: Optional[torch.Tensor]):
                 broadcast(input_metadata.block_tables, src=0)
             broadcast(sampling_metadata.selected_token_indices, src=0)
         else:
-            receving_list = [None]
-            broadcast_object_list(receving_list, src=0)
-            py_data = receving_list[0]
+            receiving_list = [None]
+            broadcast_object_list(receiving_list, src=0)
+            py_data = receiving_list[0]
             input_tokens = torch.empty(
                 *py_data["input_tokens_size"], dtype=torch.long, device="cuda"
             )
@@ -505,9 +505,9 @@ def execute_model(
             model_executable = self.model
 
         infer_text = sampling_metadata.seq_groups[0][1].infer_text
-        temperture = sampling_metadata.seq_groups[0][1].temperature
+        temperature = sampling_metadata.seq_groups[0][1].temperature
         if not infer_text:
-            temperture = torch.tensor(temperture).to(input_tokens.device)
+            temperature = torch.tensor(temperature).to(input_tokens.device)
         logits_processors, logits_warpers = sampling_metadata.seq_groups[0][
             1
         ].logits_processors
@@ -553,7 +553,7 @@ def execute_model(
             ),
             hidden_states=hidden_states,
             infer_text=infer_text,
-            temperature=temperture,
+            temperature=temperature,
             logits_processors=logits_processors,
             logits_warpers=logits_warpers,
             min_new_token=min_new_token,
```

**File**: `ChatTTS/model/velocity/output.py` (modified, +2/-2)
```diff
@@ -107,14 +107,14 @@ def from_seq_group(cls, seq_group: SequenceGroup) -> "RequestOutput":
                 # always has the logprobs of the sampled tokens even if the
                 # logprobs are not requested.
                 logprobs = None
-            finshed_reason = SequenceStatus.get_finished_reason(seq.status)
+            finished_reason = SequenceStatus.get_finished_reason(seq.status)
             output = CompletionOutput(
                 seqs.index(seq),
                 seq.output_text,
                 seq.get_output_token_ids(),
                 seq.get_cumulative_logprob(),
                 logprobs,
-                finshed_reason,
+                finished_reason,
                 seq.data.hidden_states,
             )
             outputs.append(output)
```

**File**: `ChatTTS/model/velocity/scheduler.py` (modified, +1/-1)
```diff
@@ -128,7 +128,7 @@ def get_num_unfinished_seq_groups(self) -> int:
         return len(self.waiting) + len(self.running) + len(self.swapped)
 
     def _schedule(self) -> SchedulerOutputs:
-        # Blocks that need to be swaped or copied before model execution.
+        # Blocks that need to be swapped or copied before model execution.
         blocks_to_swap_in: Dict[int, int] = {}
         blocks_to_swap_out: Dict[int, int] = {}
         blocks_to_copy: Dict[int, List[int]] = {}
```

**File**: `ChatTTS/utils/gpu.py` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ def select_device(min_memory=2047, experimental=False):
         """
         if experimental:
             # For Apple M1/M2 chips with Metal Performance Shaders
-            logger.get_logger().warning("experimantal: found apple GPU, using MPS.")
+            logger.get_logger().warning("experimental: found apple GPU, using MPS.")
             device = torch.device("mps")
         else:
             logger.get_logger().info("found Apple GPU, but use CPU.")
```

**File**: `examples/web/funcs.py` (modified, +2/-2)
```diff
@@ -102,7 +102,7 @@ def reload_chat(coef: Optional[str]) -> str:
     chat.unload()
     gr.Info("Model unloaded.")
     if len(coef) != 230:
-        gr.Warning("Ingore invalid DVAE coefficient.")
+        gr.Warning("Ignore invalid DVAE coefficient.")
         coef = None
     try:
         global custom_path
@@ -111,7 +111,7 @@ def reload_chat(coef: Optional[str]) -> str:
         raise gr.Error(str(e))
     if not ret:
         raise gr.Error("Unable to load model.")
-    gr.Info("Reload succeess.")
+    gr.Info("Reload success.")
     return chat.coef
 
 
```

---

### Incident Patch 6: `8c0707ba` (2025-05-06)
**Commit Message**: fix: module 'torch.serialization' has no attribute 'FILE_LIKE'' (#932)

Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>
Co-authored-by: 源文雨 <[REDACTED_EMAIL]>

**File**: `ChatTTS/core.py` (modified, +3/-2)
```diff
@@ -24,6 +24,7 @@
     del_all,
 )
 from .utils import logger as utils_logger
+from .utils import FileLike
 
 from .norm import Normalizer
 
@@ -66,7 +67,7 @@ def download_models(
         self,
         source: Literal["huggingface", "local", "custom"] = "local",
         force_redownload=False,
-        custom_path: Optional[torch.serialization.FILE_LIKE] = None,
+        custom_path: Optional[FileLike] = None,
     ) -> Optional[str]:
         if source == "local":
             download_path = custom_path if custom_path is not None else os.getcwd()
@@ -138,7 +139,7 @@ def load(
         source: Literal["huggingface", "local", "custom"] = "local",
         force_redownload=False,
         compile: bool = False,
-        custom_path: Optional[torch.serialization.FILE_LIKE] = None,
+        custom_path: Optional[FileLike] = None,
         device: Optional[torch.device] = None,
         coef: Optional[torch.Tensor] = None,
         use_flash_attn=False,
```

**File**: `ChatTTS/model/tokenizer.py` (modified, +2/-2)
```diff
@@ -10,13 +10,13 @@
 import torch
 from transformers import BertTokenizerFast
 
-from ..utils import del_all
+from ..utils import del_all, FileLike
 
 
 class Tokenizer:
     def __init__(
         self,
-        tokenizer_path: torch.serialization.FILE_LIKE,
+        tokenizer_path: FileLike,
     ):
         """
         tokenizer: BertTokenizerFast = torch.load(
```

**File**: `ChatTTS/utils/__init__.py` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 from .dl import check_all_assets, download_all_assets
 from .gpu import select_device
-from .io import load_safetensors, get_latest_modified_file, del_all
+from .io import load_safetensors, get_latest_modified_file, del_all, FileLike
 from .log import logger
```

**File**: `ChatTTS/utils/io.py` (modified, +8/-1)
```diff
@@ -1,13 +1,20 @@
 import os
 import logging
-from typing import Union
+from typing import Union, IO
 from dataclasses import is_dataclass
 
 from safetensors import safe_open
 import torch
 
 from .log import logger
 
+if hasattr(torch.serialization, "FILE_LIKE"):
+    FileLike = torch.serialization.FILE_LIKE
+elif hasattr(torch.types, "FILE_LIKE"):
+    FileLike = torch.types.FileLike
+else:
+    FileLike = Union[str, os.PathLike, IO[bytes]]
+
 
 @torch.inference_mode()
 def load_safetensors(filename: str):
```

---

### Incident Patch 7: `a5009112` (2025-02-18)
**Commit Message**: fix(gpt): drop deprecation usage of get_max_length()

**File**: `ChatTTS/model/gpt.py` (modified, +4/-1)
```diff
@@ -187,7 +187,10 @@ def _prepare_generation_inputs(
                     if cache_position is not None
                     else past_key_values.get_seq_length()
                 )
-                max_cache_length = past_key_values.get_max_length()
+                try:
+                    max_cache_length = past_key_values.get_max_cache_shape()
+                except:
+                    max_cache_length = past_key_values.get_max_length() # deprecated in transformers 4.48
                 cache_length = (
                     past_length
                     if max_cache_length is None
```

---

### Incident Patch 8: `af1c8f7d` (2025-01-19)
**Commit Message**: fix: missing module name "tools.audio" (#880)

fix #736 fix #820 fix #844

**File**: `examples/web/funcs.py` (modified, +4/-0)
```diff
@@ -4,6 +4,10 @@
 
 import gradio as gr
 
+import sys
+
+sys.path.append("..")
+sys.path.append("../..")
 from tools.audio import float_to_int16, has_ffmpeg_installed, load_audio
 from tools.logger import get_logger
 
```

---

### Incident Patch 9: `b5e452e3` (2025-01-13)
**Commit Message**: fix(core): split error on single sentence

**File**: `ChatTTS/core.py` (modified, +8/-5)
```diff
@@ -225,12 +225,15 @@ def infer(
             if "\n" in text:
                 text = text.split("\n")
             else:
-                text = re.split(r"(?<=[。(.\s)])", text)
+                text = re.split(r"(?<=。)|(?<=\.\s)", text)
                 nt = []
-                for t in text:
-                    if t:
-                        nt.append(t)
-                text = nt
+                if isinstance(text, list):
+                    for t in text:
+                        if t:
+                            nt.append(t)
+                    text = nt
+                else:
+                    text = [text]
             self.logger.info("split text into %d parts", len(text))
             self.logger.debug("%s", str(text))
 
```

---

### Incident Patch 10: `25cf2bcc` (2025-01-07)
**Commit Message**: chore: fix test

**File**: `tests/#511.py` (modified, +1/-0)
```diff
@@ -41,6 +41,7 @@
 wavs = chat.infer(
     texts,
     skip_refine_text=True,
+    split_text=False,
     params_infer_code=params_infer_code,
 )
 
```

**File**: `tests/#588.py` (modified, +1/-0)
```diff
@@ -29,6 +29,7 @@
     texts,
     refine_text_only=True,
     stream=False,
+    split_text=False,
     params_refine_text=ChatTTS.Chat.RefineTextParams(show_tqdm=False),
 )
 
```

---

### Incident Patch 11: `9bc3c426` (2025-01-07)
**Commit Message**: chore: fix test

**File**: `tests/#655.py` (modified, +1/-0)
```diff
@@ -38,6 +38,7 @@
         prompt="[oral_2][laugh_0][break_6]",
         manual_seed=12345,
     ),
+    split_text=False,
 )
 if (
     refined_text[0]
```

---

### Incident Patch 12: `aaea2ae2` (2025-01-07)
**Commit Message**: fix: allow not params refine text, and load normalizers to handle chinese numbers (#865)

**File**: `examples/api/main.py` (modified, +15/-3)
```diff
@@ -23,7 +23,10 @@
 
 
 from pydantic import BaseModel
-
+from fastapi.exceptions import RequestValidationError
+from fastapi.responses import JSONResponse
+from tools.normalizer.en import normalizer_en_nemo_text
+from tools.normalizer.zh import normalizer_zh_tn
 
 logger = get_logger("Command")
 
@@ -35,14 +38,23 @@ async def startup_event():
     global chat
 
     chat = ChatTTS.Chat(get_logger("ChatTTS"))
+    chat.normalizer.register("en", normalizer_en_nemo_text())
+    chat.normalizer.register("zh", normalizer_zh_tn())
+    
     logger.info("Initializing ChatTTS...")
-    if chat.load():
+    if chat.load(source="huggingface"):
         logger.info("Models loaded successfully.")
     else:
         logger.error("Models load failed.")
         sys.exit(1)
 
 
+@app.exception_handler(RequestValidationError)
+async def validation_exception_handler(request, exc: RequestValidationError):
+    logger.error(f"Validation error: {exc.errors()}")
+    return JSONResponse(status_code=422, content={"detail": exc.errors()})
+
+
 class ChatTTSParams(BaseModel):
     text: list[str]
     stream: bool = False
@@ -52,7 +64,7 @@ class ChatTTSParams(BaseModel):
     use_decoder: bool = True
     do_text_normalization: bool = True
     do_homophone_replacement: bool = False
-    params_refine_text: ChatTTS.Chat.RefineTextParams
+    params_refine_text: ChatTTS.Chat.RefineTextParams = None
     params_infer_code: ChatTTS.Chat.InferCodeParams
 
 
```

---

### Incident Patch 13: `00c56ee6` (2024-11-28)
**Commit Message**: fix(tools): load audio close file after reading

**File**: `tools/audio/av.py` (modified, +33/-11)
```diff
@@ -42,36 +42,53 @@ def wav2(i: BytesIO, o: BufferedWriter, format: str):
 
 def load_audio(
         file: Union[str, BytesIO, Path],
-        sr: Optional[int]=None,
-        format: Optional[str]=None,
-        mono=True
+        sr: Optional[int] = None,
+        format: Optional[str] = None,
+        mono=True,
     ) -> Union[np.ndarray, Tuple[np.ndarray, int]]:
     """
     https://github.com/fumiama/Retrieval-based-Voice-Conversion-WebUI/blob/412a9950a1e371a018c381d1bfb8579c4b0de329/infer/lib/audio.py#L39
     """
-    if (isinstance(file, str) and not Path(file).exists()) or (isinstance(file, Path) and not file.exists()):
+    if (isinstance(file, str) and not Path(file).exists()) or (
+        isinstance(file, Path) and not file.exists()
+    ):
         raise FileNotFoundError(f"File not found: {file}")
     rate = 0
 
     container = av.open(file, format=format)
     audio_stream = next(s for s in container.streams if s.type == "audio")
     channels = 1 if audio_stream.layout == "mono" else 2
     container.seek(0)
-    resampler = AudioResampler(format="fltp", layout=audio_stream.layout, rate=sr) if sr is not None else None
+    resampler = (
+        AudioResampler(format="fltp", layout=audio_stream.layout, rate=sr)
+        if sr is not None
+        else None
+    )
 
     # Estimated maximum total number of samples to pre-allocate the array
     # AV stores length in microseconds by default
-    estimated_total_samples = int(container.duration * sr // 1_000_000) if sr is not None else 48000
-    decoded_audio = np.zeros(estimated_total_samples + 1 if channels == 1 else (channels, estimated_total_samples + 1), dtype=np.float32)
+    estimated_total_samples = (
+        int(container.duration * sr // 1_000_000) if sr is not None else 48000
+    )
+    decoded_audio = np.zeros(
+        (
+            estimated_total_samples + 1
+            if channels == 1
+            else (channels, estimated_total_samples + 1)
+        ),
+        dtype=np.float32,
+    )
 
     offset = 0
 
     def process_packet(packet: List[AudioFrame]):
         frames_data = []
         rate = 0
         for frame in packet:
-            frame.pts = None  # 清除时间戳，避免重新采样问题
-            resampled_frames = resampler.resample(frame) if resampler is not None else [frame]
+            # frame.pts = None  # 清除时间戳，避免重新采样问题
+            resampled_frames = (
+                resampler.resample(frame) if resampler is not None else [frame]
+            )
             for resampled_frame in resampled_frames:
                 frame_data = resampled_frame.to_ndarray()
                 rate = resampled_frame.rate
@@ -83,16 +100,21 @@ def frame_iter(container):
             yield p.decode()
 
     for r, frames_data in map(process_packet, frame_iter(container)):
-        if not rate: rate = r
+        if not rate:
+            rate = r
         for frame_data in frames_data:
             end_index = offset + len(frame_data[0])
 
             # 检查 decoded_audio 是否有足够的空间，并在必要时调整大小
             if end_index > decoded_audio.shape[1]:
-                decoded_audio = np.resize(decoded_audio, (decoded_audio.shape[0], end_index*4))
+                decoded_audio = np.resize(
+                    decoded_audio, (decoded_audio.shape[0], end_index * 4)
+                )
 
             np.copyto(decoded_audio[..., offset:end_index], frame_data)
             offset += len(frame_data[0])
+    
+    container.close()
 
     # Truncate the array to the actual size
     decoded_audio = decoded_audio[..., :offset]
```

---

### Incident Patch 14: `0ec82fef` (2024-10-21)
**Commit Message**: fix(npu): ascend sampling real speaker (#788)

Co-authored-by: shanshan shen <[REDACTED_EMAIL]>

**File**: `ChatTTS/core.py` (modified, +4/-2)
```diff
@@ -268,17 +268,19 @@ def _load(
         self.vocos = vocos
         self.logger.log(logging.INFO, "vocos loaded.")
 
+        # computation of MelSpectrogram on npu is not support now, use cpu fallback.
+        dvae_device = torch.device("cpu") if "npu" in str(self.device) else device
         dvae = DVAE(
             decoder_config=asdict(self.config.dvae.decoder),
             encoder_config=asdict(self.config.dvae.encoder),
             vq_config=asdict(self.config.dvae.vq),
             dim=self.config.dvae.decoder.idim,
             coef=coef,
-            device=device,
+            device=dvae_device,
         )
         coef = str(dvae)
         assert dvae_ckpt_path, "dvae_ckpt_path should not be None"
-        dvae.load_pretrained(dvae_ckpt_path, device)
+        dvae.load_pretrained(dvae_ckpt_path, dvae_device)
         self.dvae = dvae.eval()
         self.logger.log(logging.INFO, "dvae loaded.")
 
```

---

### Incident Patch 15: `799d6339` (2024-10-17)
**Commit Message**: chore(webui): remove redundant default=None

**File**: `examples/web/webui.py` (modified, +3/-3)
```diff
@@ -248,12 +248,12 @@ def make_audio(autoplay, stream):
         "--server_name", type=str, default="0.0.0.0", help="server name"
     )
     parser.add_argument("--server_port", type=int, default=8080, help="server port")
-    parser.add_argument("--root_path", type=str, default=None, help="root path")
+    parser.add_argument("--root_path", type=str, help="root path")
     parser.add_argument(
-        "--custom_path", type=str, default=None, help="custom model path"
+        "--custom_path", type=str, help="custom model path"
     )
     parser.add_argument(
-        "--coef", type=str, default=None, help="custom dvae coefficient"
+        "--coef", type=str, help="custom dvae coefficient"
     )
     args = parser.parse_args()
 
```

#### Recent Merged Pull Requests:
- **PR #994** (2026-04-10): chore(format): run black on dev (@github-actions[bot])
- **PR #993** (closed): chore(deps): pin transformers range and add torchcodec (@HuiTurn)
- **PR #992** (closed): fix: add missing parentheses to @torch.inference_mode decorator (@Jah-yee)
- **PR #991** (2026-04-10): fix: add missing parentheses to @torch.inference_mode decorator (@jnMetaCode)
- **PR #990** (closed): docs(cn): fix basic usage example to match English README (@Br1an67)
- **PR #989** (closed): fix: replace 6 bare except clauses with except Exception (@haosenwang1018)
- **PR #986** (2026-04-10): fix: requirements.txt missed dep requests (@faalkor)
- **PR #981** (2026-01-18): chore(format): run black on dev (@github-actions[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
