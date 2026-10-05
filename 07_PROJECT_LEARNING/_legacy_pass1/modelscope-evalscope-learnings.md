# Forensic Learning Record (Deep Inspection): modelscope/evalscope

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelscope-evalscope-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelscope/evalscope](https://github.com/modelscope/evalscope))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:06:30.897Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelscope/evalscope`
- **Description**: A streamlined and customizable framework for efficient large model (LLM, VLM, AIGC) evaluation and performance benchmarking.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3495 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `evalscope/__init__.py`
```
# Copyright (c) Alibaba, Inc. and its affiliates.
from evalscope import agent, benchmarks  # noqa: F401  # registered agent strategies; benchmark discovery
from evalscope.config import TaskConfig

# Importing the names (rather than `import *`) is what keeps `evalscope.evaluator`
# pointing at the subpackage: a star import would rebind it to the inner
# `evalscope.evaluator.evaluator` module and hide the sibling submodules.
from evalscope.evaluator import (  # registered evaluators
    BatchReviewer,
    DefaultEvaluator,
    ExecutionTracker,
    PerfCollector,
)
from evalscope.filters import extraction, selection  # registered filters
from evalscope.metrics import aggregators, audio, nlp, vision  # noqa: F401  # registered metrics & aggregators
from evalscope.models import model_apis  # need for register model apis
from evalscope.run import run_task

from .version import __release_datetime__, __version__

```

### Core Architecture Module: `evalscope/agent/__init__.py`
```
"""Concrete implementations of the Agent evaluation framework.

Package layout mirrors ``evalscope/api/agent``:

* ``strategies/``    - registered :class:`AgentStrategy` subclasses
* ``environments/``  - registered :class:`AgentEnvironment` subclasses (T2+)
* ``tools/``         - registered tool handlers (T2+)

Registries themselves live in :mod:`evalscope.api.registry`.  Importing
this package only triggers the ``@register_*`` decorators in the
submodules below.
"""

# Trigger tool handler registration (T2).
# Trigger environment registration (T2).
# Trigger strategy registration.
from . import (
    environments,  # noqa: F401
    strategies,  # noqa: F401
    tools,  # noqa: F401
)

__all__ = []

```

### Core Architecture Module: `evalscope/agent/environments/__init__.py`
```
"""Registered AgentEnvironment implementations.

Importing this package triggers ``@register_environment`` decorators in the
submodules below. The registry itself lives in
:mod:`evalscope.api.registry`.
"""

from .enclave import EnclaveAgentEnvironment
from .local import LocalAgentEnvironment, TemporaryLocalAgentEnvironment

__all__ = ['EnclaveAgentEnvironment', 'LocalAgentEnvironment', 'TemporaryLocalAgentEnvironment']

```

### Core Architecture Module: `evalscope/agent/environments/enclave.py`
```
"""Unified per-sample agent environment backed by ms_enclave.

``EnclaveAgentEnvironment`` is the single implementation powering the
``enclave`` / ``docker`` / ``volcengine`` registry aliases, supporting any
engine understood by :class:`evalscope.api.sandbox.SandboxEngine`.

Per-sample lifecycle:

1. First :meth:`exec` call asks :class:`SandboxService` for a
   :class:`SandboxHandle` (``manager.create_sandbox``).
2. The sandbox persists for the duration of the sample.
3. :meth:`close` (called by the ``AgentAdapter`` ``finally`` block) releases
   the sandbox via ``SandboxHandle.close()``.

The underlying ``SandboxManager`` is **not** owned by the environment – it
lives in the process-wide :class:`SandboxService` and is stopped by the
shared ``atexit`` hook.
"""

from __future__ import annotations

import re
import shlex
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Union

from evalscope.api.agent import AgentEnvironment
from evalscope.api.agent.types import ExecResult
from evalscope.api.registry import register_environment
from evalscope.api.sandbox import (
    SandboxEngine,
    SandboxHandle,
    build_sandbox_config,
    get_sandbox_service,
    merge_sandbox_config_dicts,
    resolve_engine,
)
from evalscope.utils.import_utils import check_import
from evalscope.utils.logger import get_logger

logger = get_logger()

_DEFAULT_DOCKER_IMAGE = 'python:3.11-slim'
_DEFAULT_WORKDIR = '/workspace'
_DEFAULT_TOOLS: List[str] = ['shell_executor', 'python_executor']
_DEFAULT_INTERPRETER: List[str] = ['bash', '-c']
_ENV_KEY_PATTERN = r'[A-Za-z_][A-Za-z0-9_]*'
_POSIX_SHELL_EXECUTABLES = frozenset({'ash', 'bash', 'dash', 'ksh', 'sh', 'zsh'})


def _unwrap_bash_c(cmd: Any) -> Optional[str]:
    """Return the payload for common bash-tool wrappers."""
    if not isinstance(cmd, (list, tuple)) or len(cmd) != 3:
        return None
    executable, flag, command = cmd
    if executable not in {'bash', '/bin/bash'} or flag != '-c' or not isinstance(command, str):
        return None
    return command


def _interpreter_is_bash(interpreter: Sequence[str]) -> bool:
    return _interpreter_basename(interpreter) == 'bash'


def _interpreter_basename(interpreter: Sequence[str]) -> str:
    """Executable name of the interpreter, with any container path stripped."""
    return interpreter[0].rsplit('/', 1)[-1]


def _interpreter_is_posix_shell(interpreter: Sequence[str]) -> bool:
    """Whether the interpreter speaks POSIX shell command language.

    Gates the ``printf ... | ( ... )`` rendering used to supply stdin, which
    is plain POSIX syntax rather than a bash extension. Verified against
    bash, sh, dash, ksh and zsh; ``ash`` is included as the busybox sh that
    slim container images ship.
    """
    return _interpreter_basename(interpreter) in _POSIX_SHELL_EXECUTABLES


def _render_env_exports(env: Dict[str, str]) -> str:
    exports = []
    for raw_key, raw_value in env.items():
        key = str(raw_key)
        if not re.fullmatch(_ENV_KEY_PATTERN, key):
            raise ValueError(f'Invalid environment variable name: {key!r}')
        exports.append(f'export {key}={shlex.quote(str(raw_value))};')
    return ' '.join(exports)


def _render_command(
    cmd: List[str],
    *,
    interpreter: Sequence[str],
    cwd: Optional[str],
    env: Optional[Dict[str, str]],
    stdin: Optional[str] = None,
) -> str:
    unwrapped_command = _unwrap_bash_c(cmd) if _interpreter_is_bash(interpreter) else None
    if unwrapped_command is not None:
        command = unwrapped_command
    elif isinstance(cmd, list):
        command = ' '.join(shlex.quote(c) for c in cmd)
    else:
        command = str(cmd)
    if cwd:
        command = f'cd {shlex.quote(cwd)} && {command}'
    if env:
        prefix = _render_env_exports(env)
        command = f'{prefix} {command}' if prefix else command
    if stdin is not None:
        if not _interpreter_is_posix_shell(interpreter):
            raise NotImplementedError(
                f'EnclaveAgentEnvironment cannot supply stdin through interpreter {list(interpreter)!r}; '
                f'it is rendered as a shell pipeline, which needs one of '
                f'{sorted(_POSIX_SHELL_EXECUTABLES)}. Use a shell interpreter or pass the payload '
                'inside the command instead.'
            )
        # ms_enclave's shell_executor takes a command and no stdin, so the
        # payload is piped in by the shell instead. The subshell keeps the
        # pipe attached to the whole command: without it a rendered
        # ``cd /w && foo`` would feed ``cd`` rather than ``foo``.
        command = f'printf %s {shlex.quote(stdin)} | ( {command} )'
    return command


def _returncode_from_status(status: Any, stderr: str, timed_out: bool, success_status: Any) -> int:
    if status == success_status:
        return 0
    if timed_out:
        return -1
    match = re.search(r'exit code (\d+)', stderr)
    return int(match.group(1)) if match else 1


@register_environment(['enclave', 'docker', 'volcengine'])
class EnclaveAgentEnvironment(AgentEnvironment):
    """Per-sample sandbox via :class:`SandboxService`.

    Parameters
    ----------
    engine:
        ``'docker'`` | ``'volcengine'`` (or any alias accepted by
        :func:`resolve_engine`).  Defaults to ``'docker'``.
    sandbox_config:
        Raw dict used to build the engine-specific ``SandboxConfig``.  For
        ``docker`` this corresponds to the fields of
        ``ms_enclave.sandbox.model.DockerSandboxConfig``; for ``volcengine``
        to ``VolcengineSandboxConfig``.
    manager_config:
        Raw dict passed through to the ms_enclave manager constructor
        (e.g. ``base_url`` / ``region`` / credentials).
    timeout:
        Default command timeout (seconds) used when :meth:`exec` is called
        without an explicit timeout. ``None`` uses the runtime default.
    interpreter:
        Command interpreter argv prefix. The rendered command string is
        appended as the final argument. Defaults to ``['bash', '-c']`` for
        backward compatibility; benchmark adapters may use ``['bash', '-lc']``
        when login-shell initialization is required.
    """

    name: str = 'enclave'

    def __init__(
        self,
        *,
        engine: Union[str, SandboxEngine] = SandboxEngine.DOCKER,
        sandbox_config: Optional[Dict[str, Any]] = None,
        manager_config: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = None,
        interpreter: Optional[Sequence[str]] = None,
        **_: Any,
    ) -> None:
        # ms_enclave is mandatory for this environment. Fail fast at construction
        # time so missing-dependency errors don't surface as opaque tool errors
        # inside the agent loop (which the model interprets as a broken sandbox).
        check_import('ms_enclave', extra='sandbox', raise_error=True, feature_name='EnclaveAgentEnvironment')

        self._engine: SandboxEngine = resolve_engine(engine)
        self._timeout = 60.0 if timeout is None else float(timeout)
        if isinstance(interpreter, str):
            raise TypeError(
                'EnclaveAgentEnvironment.interpreter must be a non-empty sequence of non-empty strings, '
                'not a single string.'
            )
        self._interpreter: List[str] = list(_DEFAULT_INTERPRETER if interpreter is None else interpreter)
        invalid_interpreter = not self._interpreter or any(
            not isinstance(part, str) or not part for part in self._interpreter
        )
        if invalid_interpreter:
            raise ValueError('EnclaveAgentEnvironment.interpreter must be a non-empty sequence of non-empty strings.')
        self._manager_config: Dict[str, Any] = dict(manager_config or {})
        self._sandbox_config_dict: Dict[str, Any] = self._apply_engine_defaults(dict(sandbox_config or {}))
        self._handle: Optional[SandboxHandle] = None

    # -----------------------------------------------
```

### Core Architecture Module: `evalscope/agent/environments/local.py`
```
"""Local subprocess environment for development and testing.

Runs commands on the host OS via ``asyncio.create_subprocess_exec``.
No container isolation - suitable only for development and CI tests.
"""

import asyncio
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from evalscope.api.agent import AgentEnvironment
from evalscope.api.agent.types import ExecResult
from evalscope.api.registry import register_environment
from evalscope.utils.logger import get_logger

logger = get_logger()


@register_environment('local')
class LocalAgentEnvironment(AgentEnvironment):
    """Per-sample local subprocess environment.

    Executes commands as direct subprocesses on the host OS.
    Intended for **development and testing only** - no filesystem isolation.
    """

    name: str = 'local'

    def __init__(
        self,
        *,
        working_dir: Optional[str] = None,
        env_vars: Optional[Dict[str, str]] = None,
        **_: Any,
    ) -> None:
        self._working_dir = working_dir
        self._env_vars: Dict[str, str] = env_vars or {}

    async def exec(
        self,
        cmd: List[str],
        *,
        cwd: Optional[str] = None,
        input: Optional[str] = None,
        timeout: Optional[float] = None,
        env: Optional[Dict[str, str]] = None,
    ) -> ExecResult:
        effective_cwd = cwd or self._working_dir
        if self._env_vars or env:
            merged_env = {**os.environ, **self._env_vars, **(env or {})}
        else:
            merged_env = None

        loop = asyncio.get_running_loop()
        started = loop.time()

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            # Without an explicit stdin the child inherits the evaluator's own,
            # so a model-generated command that reads stdin blocks on the
            # operator's terminal (and can swallow their keystrokes) until the
            # tool timeout fires. Nothing in a sandbox should be able to read
            # from there; DEVNULL makes such a command see EOF and fail fast.
            stdin=asyncio.subprocess.PIPE if input is not None else asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=effective_cwd,
            env=merged_env,
        )
        try:
            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(input.encode('utf-8') if input is not None else None),
                timeout=timeout,
            )
            duration = loop.time() - started
            return ExecResult(
                returncode=proc.returncode or 0,
                stdout=stdout_bytes.decode('utf-8', errors='replace'),
                stderr=stderr_bytes.decode('utf-8', errors='replace'),
                duration=duration,
            )
        except asyncio.TimeoutError:
            proc.terminate()
            try:
                await asyncio.wait_for(proc.wait(), timeout=3.0)
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
            return ExecResult(returncode=-1, timed_out=True)

    async def close(self) -> None:
        """No external resources to release."""

    async def put_dir(self, source_dir: str | Path, target_dir: str) -> None:
        """Copy a host directory into a local target directory."""
        source = Path(source_dir).expanduser()
        if not source.is_dir():
            raise FileNotFoundError(f'put_dir source is not a directory: {source}')
        target = Path(target_dir).expanduser()
        target.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source, target, dirs_exist_ok=True)


class TemporaryLocalAgentEnvironment(LocalAgentEnvironment):
    """Local environment backed by a temporary working directory."""

    def __init__(
        self,
        sample_id: Any = None,
        *,
        prefix: str = 'evalscope-local-',
        env_vars: Optional[Dict[str, str]] = None,
    ) -> None:
        raw_sample_id = 'sample' if sample_id is None else str(sample_id)
        safe_id = ''.join(char if char.isalnum() else '-' for char in raw_sample_id)[:64]
        self._temporary_directory = tempfile.TemporaryDirectory(prefix=f'{prefix}{safe_id}-')
        super().__init__(working_dir=self._temporary_directory.name, env_vars=env_vars)

    @property
    def working_dir(self) -> Path:
        return Path(self._temporary_directory.name)

    async def close(self) -> None:
        await super().close()
        self._temporary_directory.cleanup()


__all__ = ['LocalAgentEnvironment', 'TemporaryLocalAgentEnvironment']

```

### Core Architecture Module: `evalscope/agent/external/__init__.py`
```
"""External agent integration (HTTP bridge + runner).

Drives third-party agent CLIs (claude-code, codex, opencode, ...) inside a
sandbox while routing their LLM calls through an in-process reverse proxy
that forwards to EvalScope's model layer.  The bridge captures the full
LLM request/response stream into the shared :class:`AgentTrace` format
(same one populated by :class:`AgentLoop` for native runs).
"""

from evalscope.api.registry import RUNNER_REGISTRY, get_runner, list_runners, register_runner

from . import runners as _runners  # noqa: F401  (side-effect: registers built-in runners)
from .config import BridgeConfig, ExternalAgentConfig, ExternalAgentFramework
from .runners.base import AgentRunner, AgentRunResult, BridgeEndpoint, ExternalAgentTask

__all__ = [
    'AgentRunResult',
    'AgentRunner',
    'BridgeConfig',
    'BridgeEndpoint',
    'ExternalAgentConfig',
    'ExternalAgentFramework',
    'ExternalAgentTask',
    'RUNNER_REGISTRY',
    'get_runner',
    'list_runners',
    'register_runner',
]

```

### Core Architecture Module: `evalscope/agent/external/adapter.py`
```
"""Glue between :class:`DefaultDataAdapter` and the bridge / runner stack.

The adapter layer is intentionally a single function (no wrapper class) so
that the branch added to ``DefaultDataAdapter._on_inference`` stays narrow
and every benchmark gets external-agent support for free.

``AgentLoopAdapter`` benchmarks (e.g. SWE-bench Pro) reach the same entry
point but pass an ``environment_override`` produced by their per-sample
``build_environment(sample)``, plus a ``post_run_hook`` that recovers the
benchmark's prediction artifact (e.g. ``git diff``) from the sandbox
before it is closed.
"""

import platform
import time
from typing import TYPE_CHECKING, Any, Awaitable, Callable, Dict, Optional

from evalscope.agent.skills import (
    DEFAULT_SKILLS_INSTALL_DIR,
    ResolvedSkills,
    format_skills_prompt,
    resolve_agent_skills,
)
from evalscope.api.agent import AgentEnvironment, AgentTrace
from evalscope.api.evaluator import InferenceResult
from evalscope.api.messages import ChatMessageAssistant, ChatMessageSystem, ChatMessageUser
from evalscope.api.model import Model, ModelOutput
from evalscope.api.model.model_output import ChatCompletionChoice
from evalscope.api.registry import get_environment
from evalscope.utils.asyncio_runtime import AsyncioLoopRunner
from evalscope.utils.logger import get_logger

from .bridge import ModelProxyServer
from .bridge.server import DOCKER_ENV_NAMES
from .config import ExternalAgentConfig
from .runners import AgentRunResult, ExternalAgentTask, RunnerTimeoutError, get_runner

if TYPE_CHECKING:
    from evalscope.api.dataset import Sample

logger = get_logger()

#: Type alias for the optional post-run extraction hook. Receives the
#: still-open environment, the runner result, and the sample; returns the
#: prediction string used for ``InferenceResult.output``.
PostRunHook = Callable[[AgentEnvironment, AgentRunResult, 'Sample'], Awaitable[str]]


def run_external_agent(
    config: ExternalAgentConfig,
    model: Model,
    sample: 'Sample',
    *,
    environment_override: Optional[AgentEnvironment] = None,
    instruction_override: Optional[str] = None,
    post_run_hook: Optional[PostRunHook] = None,
    close_environment: bool = True,
) -> InferenceResult:
    """Synchronously drive one sample through an external agent runner.

    Returns an :class:`InferenceResult` whose ``output`` text is the
    agent's final stdout (or ``post_run_hook`` return value when set),
    ``messages`` is the bridge-reconstructed transcript, and ``trace``
    is the shared :class:`AgentTrace` (same shape as native AgentLoop
    runs, distinguished by ``framework``).

    Parameters
    ----------
    environment_override:
        Pre-built :class:`AgentEnvironment` from the caller. When set,
        ``config.environment`` / ``config.environment_extra`` are ignored
        — used by :class:`AgentLoopAdapter` benchmarks that need a
        per-sample sandbox (e.g. SWE-bench Pro's per-instance image).
    instruction_override:
        Replaces the default ``sample.input``-derived instruction. Used
        by adapters with a richer per-sample template (e.g. SWE-bench
        Pro's ``INSTANCE_TEMPLATE``).
    post_run_hook:
        Optional ``async (env, run_result, sample) -> str`` callback
        invoked inside the environment context, before close. Its return
        value replaces ``run_result.output`` as the InferenceResult text
        — the typical use is ``extract_patch(env, cwd)`` for SWE-bench
        adapters that recover a ``git diff`` from the working tree.
    close_environment:
        Whether this function owns and closes the environment. Set to
        ``False`` when passing a caller-owned ``environment_override`` that
        must remain open after the external runner finishes.

    Uses :class:`AsyncioLoopRunner` to submit the coroutine to the calling
    thread's long-lived background loop.  That loop is reused across
    samples so the :class:`ModelProxyServer` singleton (which binds to it)
    only spins up once per worker thread instead of once per sample.
    """
    if environment_override is None and not close_environment:
        raise ValueError('close_environment=False requires environment_override')

    instruction = instruction_override if instruction_override is not None else _instruction_from_sample(sample)
    skills = resolve_agent_skills(
        sample_metadata=sample.metadata,
        config_skills_dir=config.skills_dir,
        prompt_base_dir=DEFAULT_SKILLS_INSTALL_DIR,
        install_paths=[DEFAULT_SKILLS_INSTALL_DIR],
    )
    if config.skill_prompt_nudge and skills.enabled:
        nudge = format_skills_prompt(skills.skills)
        if nudge:
            instruction = f'{nudge}\n\n{instruction}'
    return AsyncioLoopRunner.run(
        _run_async(
            config=config,
            model=model,
            sample=sample,
            instruction=instruction,
            skills=skills,
            environment_override=environment_override,
            post_run_hook=post_run_hook,
            close_environment=close_environment,
        )
    )


async def _run_async(
    config: ExternalAgentConfig,
    model: Model,
    sample: 'Sample',
    instruction: str,
    skills: ResolvedSkills,
    environment_override: Optional[AgentEnvironment],
    post_run_hook: Optional[PostRunHook],
    close_environment: bool,
) -> InferenceResult:
    runner_cls = get_runner(config.framework)
    runner_kwargs = dict(config.kwargs)
    runner_kwargs.setdefault('model_name', getattr(model, 'name', '') or '')
    runner = runner_cls(**runner_kwargs)

    if environment_override is not None:
        env: AgentEnvironment = environment_override
    else:
        env_cls = get_environment(config.environment)
        env = env_cls(**config.environment_extra)

    # Resolve env *before* starting the bridge so a dockerized env can
    # force the bind to 0.0.0.0 — otherwise the bridge would listen on
    # 127.0.0.1 inside the host and the agent inside the container would
    # see "connection refused" with no useful diagnostic.
    env_name = getattr(env, 'name', '') or ''
    is_docker_env = env_name in DOCKER_ENV_NAMES
    proxy_host = '0.0.0.0' if is_docker_env else config.bridge.proxy_host

    if is_docker_env and platform.system() == 'Linux':
        _maybe_inject_host_gateway(env)

    proxy = await ModelProxyServer.get_or_start(
        host=proxy_host,
        port=config.bridge.proxy_port,
    )

    async with proxy.trial_session(model=model, framework=config.framework) as session:
        task = ExternalAgentTask(
            instruction=instruction,
            timeout=config.timeout,
            metadata={
                'sample_id': getattr(sample, 'id', None),
                'agent_skills': skills.model_dump(),
            },
        )

        async def run_in_environment() -> str:
            session.recorder.record_run_start(
                framework=config.framework,
                cmd_summary=runner_cls.__name__,
            )
            run_started = time.monotonic()
            run_error: Optional[str] = None
            run_returncode = -1
            run_timed_out = False
            try:
                await runner.setup(env)
                result = await runner.run(
                    task=task,
                    env=env,
                    bridge=session.endpoint_view(for_env=env),
                )
                run_returncode = int(result.metrics.get('returncode', 0))
            except RunnerTimeoutError as exc:
                run_error = repr(exc)
                run_timed_out = True
                raise
            except Exception as exc:
                run_error = repr(exc)
                raise
            finally:
                session.recorder.record_run_end(
                    returncode=run_returncode,
                    timed_out=run_timed_out,
                    wall_time=time.monotonic() - run_started,
                    error=run_error,
       
```

### Core Architecture Module: `evalscope/agent/external/bridge/__init__.py`
```
"""HTTP reverse-proxy bridge.

Listens on a local port and translates inbound Anthropic / OpenAI / Gemini
requests into calls on EvalScope's ``Model.generate_async``, then translates
the ``ModelOutput`` back into the agent's expected response format.  Each
request is keyed by ``trial_id`` so multiple concurrent samples can share
a single proxy instance.
"""

from .server import ModelProxyServer, TrialSession

__all__ = ['ModelProxyServer', 'TrialSession']

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1608** (2026-08-21): **fix(terminal-bench): prevent infrastructure failures from becoming valid scores**
  *Symptoms*: ## Background  External users running EvalScope 1.10.0 for Terminal-Bench 2.0 reported several reliability and reproducibility problems after six full 89-task runs. We audited the report against v1.10.0, current `main`, and Harbor 0.8.x.  The core invariant is: **only a completed benchmark verdict with a valid reward may affect a model score; infrastructure, harness, verifier, or result-contract failures must be visible and excluded when `ignore_errors=True`, not silently converted to 0.**  ## Confirmed findings  ### P0: Terminal-Bench infrastructure failures are scored as zero  `terminal_bench_adapter.match_score()` currently defaults missing/unreadable `verifier_result.rewards.reward` to `0`. Harbor persists an `exception_info` and may leave `verifier_result` / `rewards` as `null` when Docker, network, disk, or verifier execution fails. The adapter therefore emits a normal `acc=0` score and keeps the sample in the denominator even when the model was never called.  Expected behavior:  - Validate Harbor trial results before scoring. - A valid score requires no trial exception and a finite numeric `verifier_result.rewards.reward` in the benchmark range. - Missing, malformed, or invalid reward data raises a sample execution error with trial URI and concise exception context. - Do not use a broad `except: reward = 0`.  ### P0: `--ignore-errors` does not disclose incomplete evaluation  The evaluator logs a failed work item then skips it when `ignore_errors=True`; the final report

- **Issue #994** (2025-11-27): **aarch64的支持**
  *Symptoms*: ## 自查清单  在提交 issue 之前，请确保您已完成以下步骤: - [x] 我已仔细阅读了[相关使用说明文档](https://evalscope.readthedocs.io/zh-cn/latest/get_started/parameters.html) - [x] 我已查看了[常见问题解答](https://evalscope.readthedocs.io/zh-cn/latest/get_started/faq.html) - [x] 我已搜索并查看了现有的 issues，确认这不是一个重复的问题  ## 问题描述 采用pip install ".[all]"时发现不支持arm平台的安装，原因在于ms-vlmeval依赖的decord没有arm平台的whl。现在的vlmeval已经不再强制依赖decord，我可以手动安装vlmeval。可是，观察文档我发现，evalscope依赖的ms-vlmeval是经过定制的，这就意味着我必须安装你们发布的ms-vlmeval才能使用evalscope评估vlm。什么时候可以避免强制依赖decord呢？ <img width="750" height="235" alt="Image" src="https://github.com/user-attachments/assets/dc0d5e77-42bf-45cd-917c-884e8ca44652" />  ## EvalScope 版本（必填） master分支clone后本地构建  ## 使用的工具 - [x] Native / 原生框架 - [ ] Opencompass backend - [x] VLMEvalKit backend - [ ] RAGEval backend - [ ] Perf / 模型推理压测工具 - [ ] Arena / 竞技场模式  ## 执行的代码或指令  请提供您执行的主要代码或指令。  ## 错误日志  请粘贴完整的错误日志或控制台输出。  ## 运行环境  - 操作系统：linux，aarch64 - Python版本：  ## 其他信息  如果有其他相关信息，请在此处提供。 
  **Post-Mortem & Fix Analysis**:
  > 问题已修复，更新了ms-vlmeval 的版本，移除了decord依赖

- **Issue #981** (2025-11-18): **[BUG] `KeyError: 'delta'` when perf local OpenAI server with `stream=True`**
  *Symptoms*: ## 自查清单  在提交 issue 之前，请确保您已完成以下步骤: - [x] 我已仔细阅读了[相关使用说明文档](https://evalscope.readthedocs.io/zh-cn/latest/get_started/parameters.html) - [x] 我已查看了[常见问题解答](https://evalscope.readthedocs.io/zh-cn/latest/get_started/faq.html) - [x] 我已搜索并查看了现有的 issues，确认这不是一个重复的问题  ## 问题描述  请简要描述您遇到的问题。  ## EvalScope 版本（必填） v1.2.0 ## 使用的工具 - [ ] Native / 原生框架 - [ ] Opencompass backend - [ ] VLMEvalKit backend - [ ] RAGEval backend - [x] Perf / 模型推理压测工具 - [ ] Arena / 竞技场模式  ## 执行的代码或指令  ```bash evalscope perf \   --api openai \   --url "$API_URL"/v1/completions \   --api-key "$API_KEY" \   --model "$MODEL" \   --outputs-dir evalscope/perf/${MODEL} \   --log-every-n-query 5 \   --connect-timeout 6000 \   --read-timeout 6000 \   --number 20 \   --parallel 1 \   --sleep-interval 3 \   --max-tokens 2048 \   --min-tokens 2048 \   --dataset speed_benchmark \   --stream \   --extra-args '{"ignore_eos": true}' \   --seed 6611 \   --debug  ```  ## 错误日志  ``` 2025-11-17 14:00:52 - evalscope - default_api.py - process_request - 212 - ERROR: Traceback (most recent call last):   File "/opt/miniconda3/envs/llm/lib/python3.10/site-packages/evalscope/perf/plugin/api/default_api.py", line 123, in process_request     content = choices[0]['delta'].get('content') KeyError: 'delta'  2025-11-17 14:00:52 - evalscope - http_client.py - test_connection - 129 - WARNING: Retrying... <Traceback (most recent call last):   File "/opt/miniconda3/envs/llm/lib/python3.10/site-packages/evalscope/perf/plugin/api/default_api.py", line
  **Post-Mortem & Fix Analysis**:
  > 当endpoint换成`/v1/chat/completions`，会遇到  422: Unprocessable Entity 
  > main分支已修复该问题，可以在试试
  > > main分支已修复该问题，可以在试试  今天用evalscope怎么突然有这个问题了，版本是1.2.0，之前用的也是这个版本没这个问题，我都是用pip下载的

- **Issue #946** (2025-11-04): **AI-ModelScope/SimpleQA 题数不对**
  *Symptoms*: ## 自查清单  在提交 issue 之前，请确保您已完成以下步骤: - [x] 我已仔细阅读了[相关使用说明文档](https://evalscope.readthedocs.io/zh-cn/latest/get_started/parameters.html) - [x] 我已查看了[常见问题解答](https://evalscope.readthedocs.io/zh-cn/latest/get_started/faq.html) - [x] 我已搜索并查看了现有的 issues，确认这不是一个重复的问题  ## 问题描述  simpleqa使用的数据集AI-ModelScope/SimpleQA，题目`4321`，官方数据集`4326`，得看下少了哪些题目？  官方数据集： https://github.com/openai/simple-evals/blob/ee3b0318d8d1d9d72755a4120879be65f7c07e9e/simpleqa_eval.py#L102C14-L102C92  ## EvalScope 版本（必填） v0.xx.x  ## 使用的工具 - [ ] Native / 原生框架 - [ ] Opencompass backend - [ ] VLMEvalKit backend - [ ] RAGEval backend - [ ] Perf / 模型推理压测工具 - [ ] Arena / 竞技场模式  ## 执行的代码或指令  请提供您执行的主要代码或指令。  ## 错误日志  请粘贴完整的错误日志或控制台输出。  ## 运行环境  - 操作系统： - Python版本：  ## 其他信息  如果有其他相关信息，请在此处提供。 
  **Post-Mortem & Fix Analysis**:
  > @Yunnglin 
  > 这个问题我处理一下，得更新数据集
  > 该问题已修复

- **Issue #915** (2026-06-02): **自定义数据集运行报参数错误**
  *Symptoms*: ## 自查清单  在提交 issue 之前，请确保您已完成以下步骤: - [X] 我已仔细阅读了[相关使用说明文档](https://evalscope.readthedocs.io/zh-cn/latest/get_started/parameters.html) - [X] 我已查看了[常见问题解答](https://evalscope.readthedocs.io/zh-cn/latest/get_started/faq.html) - [ ] 我已搜索并查看了现有的 issues，确认这不是一个重复的问题  ## 问题描述  请简要描述您遇到的问题。  ## EvalScope 版本（必填） v1.1.0  ## 使用的工具 - [ ] Native / 原生框架 - [ ] Opencompass backend - [ ] VLMEvalKit backend - [X] RAGEval backend - [ ] Perf / 模型推理压测工具 - [ ] Arena / 竞技场模式  ## 执行的代码或指令 from evalscope.run import run_task  task_cfg = {     "work_dir": "outputs",     "eval_backend": "RAGEval",     "eval_config": {         "tool": "MTEB",         "model": [             {                 "model_name": "youtu-embedding",                 "api_base": "http://192.168.0.147:10600/v1",                 "api_key": "123",                 "dimensions": 2048,                 "encode_kwargs": {                     "batch_size": 128,                 },             }         ],         "eval": {             "tasks": ["CustomRetrieval"],             "dataset_path": "/study_project/evalscope/embedding_test/retrieval_data",             "verbosity": 2,             "overwrite_results": True,             "limits": 500,         },     }, } run_task(task_cfg=task_cfg)    ## 错误日志 Traceback (most recent call last):   File "/DATA/LLM/gaojiale/study_project/evalscope/embedding_test/embedding_test.py", line 28, in <module>     run_task(task_cfg=task_cfg)   File "/DATA/LLM/gaojiale/miniconda/envs/eval/lib/python3.10/site-packages
  **Post-Mortem & Fix Analysis**:
  > 遇到相同的问题
  > Opened #1390 to address this.  What changed: - RAGEval/MTEB result summaries now use metadata from the task objects that were actually evaluated, instead of asking `TaskResult.task_type` to look the task up again in the upstream MTEB registry. - This covers `CustomRetrieval` and other EvalScope-managed custom MTEB tasks, where the task exists in EvalScope but not necessarily in MTEB's global registry. - Added a safe fallback so summary rendering does not crash if a result has no matching task metadata. - Added regression coverage for the `CustomRetrieval` failure mode where `TaskResult.task_type` raises `KeyError`.  Validation passed: - RAGEval/MTEB custom task result-summary regression tests. - Python compilation check for the changed summary code and new test. - Whitespace diff check. - Existing MTEB integration tests collect successfully with level-0 tests skipped.

- **Issue #859** (2026-07-08): **ValueError: No nodes that satisfied the given filer. Try changing the filter.**
  *Symptoms*: ## 自查清单  在提交 issue 之前，请确保您已完成以下步骤: - [√] 我已仔细阅读了[相关使用说明文档](https://evalscope.readthedocs.io/zh-cn/latest/get_started/parameters.html) - [√] 我已查看了[常见问题解答](https://evalscope.readthedocs.io/zh-cn/latest/get_started/faq.html) - [√] 我已搜索并查看了现有的 issues，确认这不是一个重复的问题  ## 问题描述  用ragas生成测试数据集时报错ValueError: No nodes that satisfied the given filer. Try changing the filter.     ## EvalScope 版本（必填）  v1.0.2  ## 使用的工具  RAGAS v0.2.14  ## 执行的代码或指令  from evalscope.run import run_task from evalscope.utils.logger import get_logger  generate_testset_task_cfg = {     "eval_backend": "RAGEval",      "eval_config": {         "tool": "RAGAS",         "testset_generation": {             "docs": ["**.txt"],              "test_size": 10,             "output_file": "outputs/test1/qwen_testset.json",             "knowledge_graph": "outputs/test1/qwen_knowledge_graph.json",             "generator_llm": {                 "model_name": "qwen2.5-vl-72b-instruct",                 "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",                 "api_key": "*****",                 "generation_config": {                     "temperature": 0.7,                     "max_tokens": 1024                   }             },                          "embeddings": {                 "model_name": "Qwen3-Embedding-0.6B",                   "api_base": "******",                 "api_key": "EMPTY",                   "dimension": 1024             },             "language": "chinese"           }     }, }  logger = 
  **Post-Mortem & Fix Analysis**:
  > PR #1383 已合并，将 RAGAS 升级到 0.4.x 并对 RAG eval 模块做了重构。该 issue 涉及 RAGAS testset generation 中 persona 节点过滤的报错（`No nodes that satisfied the given filter`），属于 RAGAS 内部 KG 节点筛选逻辑问题，需要在新版本上验证。  请从最新 main 分支安装后再次尝试，并反馈是否仍能复现。如新版本仍有问题，我们会进一步跟进。
  > This issue was reported against the legacy RAGEval / RAGAS 0.2.x path.  RAG evaluation has been refactored in PR #1383, and RAGAS has been upgraded to the 0.4.x series. The original error (`No nodes that satisfied the given filter`) is related to RAGAS testset generation / KG node filtering in the old stack, so the first step is to verify with the latest main branch.  Closing this for now as a legacy RAGEval issue. If it can still be reproduced on the latest main branch, please reopen with:  1. EvalScope commit / version 2. RAGAS version 3. Full config 4. Minimal docs sample 5. Complete traceback  We'll continue from there if the issue still exists. 

- **Issue #856** (2025-09-29): **BFCL-v3数据集type字段解析错误**
  *Symptoms*: ## 自查清单  在提交 issue 之前，请确保您已完成以下步骤: - [x] 我已仔细阅读了[相关使用说明文档](https://evalscope.readthedocs.io/zh-cn/latest/get_started/parameters.html) - [x] 我已查看了[常见问题解答](https://evalscope.readthedocs.io/zh-cn/latest/get_started/faq.html) - [x] 我已搜索并查看了现有的 issues，确认这不是一个重复的问题  ## 问题描述  对bfcl_v3进行评估之后会出现如下的报错：  ``` prediction failed: due to 1 validation error for ToolInfo parameters.properties.exclusion   Value error, Unsupported type: {'type': 'string', 'description': 'The type of the exclusion e.g window, door etc.'} for Python to JSON conversion. [type=value_error, input_value={'type': 'object', 'prope...sion if not specified.'}, input_type=dict] ```  在bfcl_v3中会有多条数据会引起上述的报错，以其中的某条数据为例进行说明。数据内容如下：  ``` {   "id": "simple_260",   ... ...   "tools": [     {       "type": "function",       "function": {         "name": "paint_requirement_calculate",         "description": "Calculate the amount of paint required to paint a given area. Account for coverage efficiency of the paint and exclusions (like windows). Note that the provided function is in Python 3 syntax.",         "parameters": {           "type": "object",           "properties": {             "area": {               "type": "object",               "properties": {                 "width": {                   "type": "integer",                   "description": "The width of the area to be painted in feet."                 },                 "height": {                   "type": "integer",                   "description": "The height of 
  **Post-Mortem & Fix Analysis**:
  > 感谢你的反馈，我修复一下
  > 已修复，可以用main分支代码试试
  > 测试没问题了，感谢🙏

- **Issue #844** (2025-09-28): **TaskConfig 导出 yaml 文件失败**
  *Symptoms*: ## 自查清单  在提交 issue 之前，请确保您已完成以下步骤: - [√] 我已仔细阅读了[相关使用说明文档](https://evalscope.readthedocs.io/zh-cn/latest/get_started/parameters.html) - [√] 我已查看了[常见问题解答](https://evalscope.readthedocs.io/zh-cn/latest/get_started/faq.html) - [√] 我已搜索并查看了现有的 issues，确认这不是一个重复的问题  ## 问题描述  在 ms-swift 中使用 evalscope 做训练时的评估工具时，发现 TaskConfig 导出 yaml 失败。  ## EvalScope 版本（必填） v1.0.1 （ms-swift version: v3.9.0dev0）  ## 使用的工具 - [√] Native / 原生框架 - [ ] Opencompass backend - [ ] VLMEvalKit backend - [ ] RAGEval backend - [ ] Perf / 模型推理压测工具 - [ ] Arena / 竞技场模式  ## 执行的代码或指令  ```bash PROJECT_NAME=sft MODEL_NAME=qwen2_5_05b MODEL_PATH="Qwen/Qwen2.5-0.5B-Instruct"  EXP_NAME=test  TRAIN_TYPE=full TRAIN_DATASET_PATH="AI-ModelScope/alpaca-gpt4-data-zh#100" OUTPUT_DIR=outputs/ms-swift  CUDA_VISIBLE_DEVICES=0 \ swift sft \     --model $MODEL_PATH \     --model_type qwen2_5 \     --train_type $TRAIN_TYPE \     --dataset $TRAIN_DATASET_PATH \     --torch_dtype bfloat16 \     --num_train_epochs 2 \     --per_device_train_batch_size 8 \     --per_device_eval_batch_size 8 \     --learning_rate 1e-4 \     --gradient_accumulation_steps 2 \     --eval_strategy "steps" \     --eval_steps 2 \     --eval_use_evalscope \     --eval_dataset "gsm8k" \     --eval_dataset_args '{"gsm8k": {"few_shot_num": 0}}' \     --eval_generation_config '{"max_tokens": 512, "temperature": 0}' \     --eval_limit 10 \     --extra_eval_args '{"ignore_errors": true}' \     --save_steps 50 \     --save_total_limit 100 \     --logging_steps 1 \     -
  **Post-Mortem & Fix Analysis**:
  > 这部分已在ms-swift中修复  > 感谢你的反馈！我们将关闭此问题。如果您有任何疑问，请随时重新打开它。如果EvalScope对您有所帮助，欢迎给我们点个STAR以示支持，谢谢！

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

### Incident Patch 1: `cfb9af39` (2026-09-30)
**Commit Message**: fix(web): localize version badge tooltip (#1796)

**File**: `evalscope/web/src/components/nav/TopNav.tsx` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ export default function TopNav() {
               Eval<span className="text-[var(--accent)]">Scope</span>
             </span>
             {config?.version && (
-              <Badge title={`EvalScope version ${config.version}`}>
+              <Badge title={t('common.evalScopeVersion', { version: config.version })}>
                 v{config.version}
               </Badge>
             )}
```

**File**: `evalscope/web/src/i18n/translations/common.ts` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@ export const en: Dict = {
   all: 'All',
   openNewTab: 'Open in New Tab',
   github: 'Star on GitHub',
+  evalScopeVersion: 'EvalScope version ${version}',
   stop: 'Stop',
   retry: 'Retry',
   cancel: 'Cancel',
@@ -20,6 +21,7 @@ export const zh: Dict = {
   all: '全部',
   openNewTab: '在新标签页打开',
   github: 'GitHub 加星',
+  evalScopeVersion: 'EvalScope 版本 ${version}',
   stop: '停止',
   retry: '重试',
   cancel: '取消',
```

---

### Incident Patch 2: `1bb1accb` (2026-09-30)
**Commit Message**: fix(models): preserve Anthropic image URL sources (#1764)

Signed-off-by: git-jxj <65210887+git-jxj@users.noreply.github.com>

**File**: `evalscope/models/utils/anthropic.py` (modified, +4/-1)
```diff
@@ -122,8 +122,11 @@ def anthropic_chat_tool_choice(tool_choice: ToolChoice) -> ToolChoiceParam:
 
 def anthropic_image_block_param(image: str) -> ImageBlockParam:
     """Convert image path/URL to Anthropic ImageBlockParam."""
+    if is_http_url(image):
+        return ImageBlockParam(type='image', source=dict(type='url', url=image))
+
     # Resolve to data URI if needed
-    if not is_http_url(image) and not image.startswith('data:'):
+    if not image.startswith('data:'):
         image = file_as_data_uri(image)
 
     # Get media type and base64 content
```

**File**: `tests/models/test_anthropic_images.py` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import base64
+from pathlib import Path
+
+import pytest
+
+from evalscope.api.messages import ChatMessageUser, ContentImage
+
+
+@pytest.mark.parametrize('scheme', ['http', 'https'])
+def test_image_urls_are_sent_as_url_sources(scheme: str) -> None:
+    pytest.importorskip('anthropic')
+    from evalscope.models.utils.anthropic import anthropic_chat_messages
+
+    url = f'{scheme}://example.com/image.png?version=1'
+    _, messages = anthropic_chat_messages(
+        [ChatMessageUser(content=[ContentImage(image=url, internal={'anthropic': {'cache_control': {'type': 'ephemeral'}}})])]
+    )
+
+    assert messages[0]['content'] == [
+        {'type': 'image', 'source': {'type': 'url', 'url': url}, 'cache_control': {'type': 'ephemeral'}}
+    ]
+
+
+@pytest.mark.parametrize('source_kind', ['path', 'data_uri'])
+def test_local_images_remain_base64_sources(source_kind: str, tmp_path: Path) -> None:
+    pytest.importorskip('anthropic')
+    from evalscope.models.utils.anthropic import anthropic_chat_messages
+
+    image_data = base64.b64decode(
+        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
+    )
+    encoded = base64.b64encode(image_data).decode('ascii')
+    if source_kind == 'path':
+        image_path = tmp_path / 'image.png'
+        image_path.write_bytes(image_data)
+        source = str(image_path)
+    else:
+        source = f'data:image/png;base64,{encoded}'
+
+    _, messages = anthropic_chat_messages([ChatMessageUser(content=[ContentImage(image=source)])])
+
+    assert messages[0]['content'] == [
+        {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/png', 'data': encoded}}
+    ]
```

---

### Incident Patch 3: `a827b17b` (2026-09-30)
**Commit Message**: fix(tools): preserve literal values in JSON schemas (#1765)

Signed-off-by: git-jxj <65210887+git-jxj@users.noreply.github.com>

**File**: `evalscope/utils/json_schema.py` (modified, +10/-18)
```diff
@@ -61,26 +61,18 @@ class JSONSchema(BaseModel):
     """Required fields for object parameters."""
 
     @model_validator(mode='before')
-    def convert_type_before_validation(cls, values):
+    def convert_type_before_validation(cls, values: Any) -> Any:
         values = deepcopy(values)
 
-        def recursive_convert_type(obj):
-            if isinstance(obj, dict):
-                # Convert 'type' field if it's a string
-                if 'type' in obj and isinstance(obj['type'], str):
-                    try:
-                        obj['type'] = python_type_to_json_type(obj['type'])
-                    except ValueError:
-                        # If conversion fails, leave it as is
-                        pass
-                # Recursively process nested structures
-                for k, v in obj.items():
-                    obj[k] = recursive_convert_type(v)
-            elif isinstance(obj, list):
-                return [recursive_convert_type(item) for item in obj]
-            return obj
-
-        return recursive_convert_type(values)
+        # Nested schema fields are validated as JSONSchema instances themselves.
+        # Recursing through arbitrary dictionaries would also rewrite literal
+        # values in defaults and enums that happen to contain a 'type' key.
+        if isinstance(values, dict) and isinstance(values.get('type'), str):
+            try:
+                values['type'] = python_type_to_json_type(values['type'])
+            except ValueError:
+                pass
+        return values
 
 
 def json_schema(t: Type[Any]) -> JSONSchema:
```

**File**: `tests/utils/test_json_schema.py` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+from copy import deepcopy
+from typing import Dict
+
+import pytest
+from pydantic import BaseModel
+
+from evalscope.api.tool.tool_info import parse_tool_info
+from evalscope.utils.json_schema import JSONSchema
+
+
+@pytest.mark.parametrize('keyword', ['default', 'enum'])
+def test_schema_conversion_preserves_literal_values(keyword: str) -> None:
+    literal = {'type': 'str', 'nested': [{'type': 'int'}]}
+    value = [literal] if keyword == 'enum' else literal
+    raw = {'type': 'dict', keyword: value}
+    original = deepcopy(raw)
+
+    schema = JSONSchema.model_validate(raw)
+
+    assert schema.type == 'object'
+    assert getattr(schema, keyword) == value
+    assert raw == original
+
+
+@pytest.mark.parametrize(
+    'nested',
+    [
+        {'properties': {'payload': {'type': 'dict', 'default': {'type': 'str'}}}},
+        {'items': {'type': 'dict', 'default': {'type': 'str'}}},
+        {'additionalProperties': {'type': 'dict', 'default': {'type': 'str'}}},
+        {'anyOf': [{'type': 'dict', 'default': {'type': 'str'}}]},
+    ],
+)
+def test_schema_conversion_still_normalizes_nested_schema_types(nested: dict) -> None:
+    schema = JSONSchema.model_validate(nested).model_dump(exclude_none=True)
+    child = next(iter(schema.values()))
+    if 'properties' in schema:
+        child = child['payload']
+    elif 'anyOf' in schema:
+        child = child[0]
+
+    assert child['type'] == 'object'
+    assert child['default'] == {'type': 'str'}
+
+
+class Payload(BaseModel):
+    options: Dict[str, str] = {'type': 'str'}
+
+
+def test_tool_schema_preserves_pydantic_field_defaults() -> None:
+    def tool(payload: Payload) -> str:
+        """Accept a payload."""
+        return payload.options['type']
+
+    info = parse_tool_info(tool)
+
+    assert info.parameters.properties['payload'].properties['options'].default == {'type': 'str'}
```

---

### Incident Patch 4: `57d299e4` (2026-09-30)
**Commit Message**: fix(perf): include response bodies in embedding and rerank latency (#1763)

**File**: `evalscope/perf/plugin/api/openai_embedding_api.py` (modified, +5/-5)
```diff
@@ -169,11 +169,6 @@ async def process_request(self, client_session, url: str, headers: Dict, body: D
 
         try:
             async with client_session.post(url=url, data=data, headers=headers) as response:
-                timestamp = time.perf_counter()
-                output.completed_time = timestamp
-                output.query_latency = timestamp - st
-                output.first_chunk_latency = output.query_latency
-
                 if response.status == 200:
                     try:
                         payload = await response.json()
@@ -210,6 +205,11 @@ async def process_request(self, client_session, url: str, headers: Dict, body: D
                             output.error = response.reason or ''
                     output.success = False
 
+                timestamp = time.perf_counter()
+                output.completed_time = timestamp
+                output.query_latency = timestamp - st
+                output.first_chunk_latency = output.query_latency
+
         except Exception:
             output.success = False
             exc_info = sys.exc_info()
```

**File**: `evalscope/perf/plugin/api/openai_rerank_api.py` (modified, +5/-5)
```diff
@@ -189,11 +189,6 @@ async def process_request(self, client_session, url: str, headers: Dict, body: D
 
         try:
             async with client_session.post(url=url, data=data, headers=headers) as response:
-                timestamp = time.perf_counter()
-                output.completed_time = timestamp
-                output.query_latency = timestamp - st
-                output.first_chunk_latency = output.query_latency
-
                 if response.status == 200:
                     try:
                         payload = await response.json()
@@ -232,6 +227,11 @@ async def process_request(self, client_session, url: str, headers: Dict, body: D
                             output.error = response.reason or ''
                     output.success = False
 
+                timestamp = time.perf_counter()
+                output.completed_time = timestamp
+                output.query_latency = timestamp - st
+                output.first_chunk_latency = output.query_latency
+
         except Exception:
             output.success = False
             exc_info = sys.exc_info()
```

**File**: `tests/perf/test_embedding_rerank_latency.py` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+"""Embedding and rerank latency includes reading the complete response body."""
+
+import asyncio
+import json
+import time
+
+import aiohttp
+import pytest
+from aiohttp import web
+from aiohttp.test_utils import TestServer
+
+from evalscope.perf.arguments import Arguments
+from evalscope.perf.plugin.api.base import ApiPluginBase
+from evalscope.perf.plugin.api.openai_embedding_api import OpenaiEmbeddingPlugin
+from evalscope.perf.plugin.api.openai_rerank_api import OpenaiRerankPlugin
+from evalscope.perf.utils.benchmark_util import BenchmarkData, MetricsAccumulator
+
+
+@pytest.mark.parametrize('plugin_type', [OpenaiEmbeddingPlugin, OpenaiRerankPlugin])
+@pytest.mark.parametrize('status', [200, 500])
+@pytest.mark.parametrize('content_type', ['application/json', 'text/plain'])
+def test_latency_includes_response_body(
+    plugin_type: type[ApiPluginBase], status: int, content_type: str
+) -> None:
+    async def run() -> tuple[BenchmarkData, ApiPluginBase, float]:
+        body_sent_at = 0.0
+        payload = {
+            'data': [{'embedding': [0.1, 0.2]}],
+            'results': [{'index': 0, 'relevance_score': 0.9}],
+            'usage': {'prompt_tokens': 10, 'total_tokens': 10},
+        }
+
+        async def handle(request: web.Request) -> web.StreamResponse:
+            nonlocal body_sent_at
+            await request.read()
+            response = web.StreamResponse(status=status, headers={'Content-Type': content_type})
+            await response.prepare(request)
+            # Flush the headers separately, as a server/proxy may do while a
+            # large embedding response is still being generated or transferred.
+            await asyncio.sleep(0.05)
+            body_sent_at = time.perf_counter()
+            await response.write(json.dumps(payload).encode())
+            await response.write_eof()
+            return response
+
+        app = web.Application()
+        app.router.add_post('/', handle)
+        plugin = plugin_type(Arguments(model='test-model'))
+        async with TestServer(app) as server:
+            async with aiohttp.ClientSession() as session:
+                output = await plugin.process_request(session, str(server.make_url('/')), {}, {})
+        return output, plugin, body_sent_at
+
+    output, plugin, body_sent_at = asyncio.run(run())
+
+    assert output.success is (status == 200)
+    assert output.completed_time >= body_sent_at
+    assert output.query_latency == pytest.approx(output.completed_time - output.start_time)
+    assert output.first_chunk_latency == output.query_latency
+
+    accumulator = MetricsAccumulator()
+    accumulator.update(output, plugin)
+    assert accumulator.wall_time >= body_sent_at - output.start_time
```

---

### Incident Patch 5: `6f1400f1` (2026-09-29)
**Commit Message**: fix(perf): tolerate non-JSON SSE terminators; route per-turn max_tokens per protocol (#1791)

* fix(perf): skip non-JSON SSE payloads instead of failing the request

Some OpenAI-compatible providers end an SSE stream with a non-JSON
sentinel other than "data: [DONE]" (or send no sentinel at all). The
streaming loops in DefaultApiPlugin.process_request and
OpenAIResponsesPlugin.process_request ran json.loads on every non-"[DONE]"
payload, so such a sentinel raised JSONDecodeError and marked the whole
request success=False, making the benchmark unusable.

Skip any SSE payload that is not valid JSON in both loops. Stream
termination is already signalled by the connection closing, so no
terminator string needs to be recognized; this also removes the two
hardcoded "[DONE]" checks.

Add end-to-end tests through process_request for both the openai and
openai_responses paths using a non-JSON sentinel.

Fixes #974

* fix(perf): route per-turn max_tokens through a protocol-aware hook

MultiTurnStrategy._worker wrote the per-turn output cap as a top-level
request['max_tokens'] for every protocol. Only OpenAI Chat reads that key:
DashScope expects parameters.max_tokens and OpenAI Responses exp

**File**: `docs/en/user_guides/stress_test/custom.md` (modified, +3/-0)
```diff
@@ -47,6 +47,9 @@ Currently, `openai` and `dashscope` are built-in and supported. To extend an API
 - process_request(...) -> BenchmarkData  
   Send the request, and gather the responses and latency data. If your custom API is compatible with OpenAI (using JSON + SSE), inheriting from `DefaultApiPlugin` is recommended. You can reuse its HTTP and streaming functionalities and only need to implement `build_request` and `parse_responses`.
 
+- set_request_max_tokens(request, max_tokens) -> None (optional)  
+  Route the per-request output cap to where your protocol expects it. Defaults to a top-level `max_tokens`; override it if your API nests or renames the cap (e.g. DashScope uses `parameters.max_tokens`, OpenAI Responses uses `max_output_tokens`). Multi-turn per-turn caps are applied through this hook, so an incorrect override leaves them silently ignored.
+
 Example: Minimum implementation by inheriting `DefaultApiPlugin` (recommended)
 
 ```python
```

**File**: `docs/zh/user_guides/stress_test/custom.md` (modified, +3/-0)
```diff
@@ -47,6 +47,9 @@ for row in rows:
 - process_request(...) -> BenchmarkData  
   发送请求并收集响应与时延数据。若自定义 API 与 OpenAI 兼容（JSON + SSE），推荐继承 `DefaultApiPlugin` 直接复用其 HTTP 与流式处理逻辑，仅需实现 `build_request`、`parse_responses`。
 
+- set_request_max_tokens(request, max_tokens) -> None （可选）  
+  将每请求的输出上限写到你的协议所期望的位置。默认写顶层 `max_tokens`；若你的 API 将其嵌套或改名（如 DashScope 用 `parameters.max_tokens`、OpenAI Responses 用 `max_output_tokens`），则需覆写。多轮的逐轮上限经此钩子写入，覆写不正确会导致其被静默忽略。
+
 示例：继承 `DefaultApiPlugin` 最小实现（推荐）
 
 ```python
```

**File**: `evalscope/perf/core/strategies/multi_turn.py` (modified, +1/-1)
```diff
@@ -158,7 +158,7 @@ async def _worker(self, worker_id: int) -> None:
                     )
                     break
                 if turn.max_tokens is not None:
-                    request['max_tokens'] = turn.max_tokens
+                    self.api_plugin.set_request_max_tokens(request, turn.max_tokens)
                 benchmark_data = await self.client.post(request)
 
                 # Inject multi-turn specific metadata.
```

**File**: `evalscope/perf/plugin/api/base.py` (modified, +4/-0)
```diff
@@ -69,6 +69,10 @@ def build_request(self, messages: Union[List[Dict], str], param: Optional[Argume
         """
         raise NotImplementedError
 
+    def set_request_max_tokens(self, request: Dict, max_tokens: int) -> None:
+        """Set the per-request output token cap where this protocol expects it."""
+        request['max_tokens'] = max_tokens
+
     @abstractmethod
     def parse_responses(self, responses: List[Dict], request: str = None, **kwargs: Any) -> Tuple[int, int]:
         """Parser responses and return number of request and response tokens.
```

**File**: `evalscope/perf/plugin/api/dashscope_api.py` (modified, +3/-0)
```diff
@@ -76,6 +76,9 @@ def __compose_query_from_parameter(self, payload: Dict, param: Arguments):
             payload['parameters']['top_p'] = param.top_p
         return payload
 
+    def set_request_max_tokens(self, request: Dict, max_tokens: int) -> None:
+        request.setdefault('parameters', {})['max_tokens'] = max_tokens
+
     def parse_responses(self, responses, **kwargs) -> Dict:
         """Parser responses and return number of request and response tokens.
 
```

---

### Incident Patch 6: `da8c5f91` (2026-09-29)
**Commit Message**: fix(perf): keep a rerank request successful when the top score is not a number (#1760)

Guard the rerank summary format so a null/non-numeric top score can't fail an HTTP 200 request, and add regression tests.

**File**: `evalscope/perf/plugin/api/openai_rerank_api.py` (modified, +4/-2)
```diff
@@ -204,10 +204,12 @@ async def process_request(self, client_session, url: str, headers: Dict, body: D
                         # Extract rerank results info
                         results = payload.get('results', [])
                         if results:
-                            # Log the top result info
+                            # Log the top result info. The score is server-controlled and may be
+                            # null/non-numeric; guard the format so this line never fails the request.
                             top_result = results[0]
                             score = top_result.get('relevance_score', top_result.get('score', 0))
-                            output.generated_text = f'top_score={score:.4f}, num_results={len(results)}'
+                            score_text = f'{score:.4f}' if isinstance(score, (int, float)) else str(score)
+                            output.generated_text = f'top_score={score_text}, num_results={len(results)}'
 
                         if usage := payload.get('usage'):
                             output.prompt_tokens = usage.get('prompt_tokens') or usage.get('total_tokens', 0)
```

**File**: `tests/perf/test_rerank_process_request.py` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+# Copyright (c) Alibaba, Inc. and its affiliates.
+"""Unit tests for ``OpenaiRerankPlugin.process_request``.
+
+The rerank summary line (``top_score=...``) is built inside the same
+``try`` block whose handler marks a request as failed, so a score that
+cannot be formatted with ``:.4f`` used to turn a perfectly good HTTP 200
+into a failed benchmark request.  The score is copied verbatim out of the
+server's JSON and is never validated, so it can be ``null`` or a string.
+"""
+import unittest
+from typing import Any, Dict
+from unittest.mock import AsyncMock, MagicMock
+
+from evalscope.perf.arguments import Arguments
+from evalscope.perf.plugin.api.openai_rerank_api import OpenaiRerankPlugin
+
+
+def _session_returning(payload: Dict[str, Any]) -> MagicMock:
+    """Build a mock aiohttp session whose POST answers HTTP 200 with ``payload``."""
+    response = MagicMock()
+    response.status = 200
+    response.json = AsyncMock(return_value=payload)
+    response.__aenter__.return_value = response
+    client_session = MagicMock()
+    client_session.post.return_value = response
+    return client_session
+
+
+class TestRerankProcessRequest(unittest.IsolatedAsyncioTestCase):
+
+    async def _run(self, payload: Dict[str, Any]) -> Any:
+        plugin = OpenaiRerankPlugin(Arguments(model='test-rerank'))
+        return await plugin.process_request(
+            _session_returning(payload), 'http://localhost/v1/rerank', {}, {'query': 'q', 'documents': ['a']}
+        )
+
+    async def test_numeric_score_is_summarized(self) -> None:
+        """Control case: a normal response keeps its four-decimal summary."""
+        output = await self._run({
+            'results': [{'index': 0, 'relevance_score': 0.8421}, {'index': 1, 'relevance_score': 0.1}],
+            'usage': {'prompt_tokens': 21, 'total_tokens': 21},
+        })
+
+        self.assertTrue(output.success)
+        self.assertEqual(output.generated_text, 'top_score=0.8421, num_results=2')
+        self.assertEqual(output.prompt_tokens, 21)
+
+    async def test_score_key_fallback_is_summarized(self) -> None:
+        """Servers that name the field ``score`` keep the same summary."""
+        output = await self._run({'results': [{'index': 0, 'score': 0.5}], 'usage': {'total_tokens': 12}})
+
+        self.assertTrue(output.success)
+        self.assertEqual(output.generated_text, 'top_score=0.5000, num_results=1')
+
+    async def test_null_score_still_counts_as_a_successful_request(self) -> None:
+        """``relevance_score: null`` must not fail an HTTP 200 request."""
+        payload = {
+            'results': [{'index': 3, 'relevance_score': None}, {'index': 0, 'relevance_score': 0.91}],
+            'usage': {'prompt_tokens': 37, 'total_tokens': 37},
+        }
+
+        output = await self._run(payload)
+
+        self.assertTrue(output.success)
+        self.assertIsNone(output.error)
+        self.assertEqual(output.generated_text, 'top_score=None, num_results=2')
+        self.assertEqual(output.prompt_tokens, 37)
+        self.assertEqual(output.response_messages, [payload])
+
+    async def test_non_numeric_score_still_counts_as_a_successful_request(self) -> None:
+        """A stringified score must not fail an HTTP 200 request either."""
+        output = await self._run({'results': [{'index': 0, 'relevance_score': '0.9312'}]})
+
+        self.assertTrue(output.success)
+        self.assertIsNone(output.error)
+        self.assertEqual(output.generated_text, 'top_score=0.9312, num_results=1')
+
+
+if __name__ == '__main__':
+    unittest.main()
```

---

### Incident Patch 7: `3a2936c0` (2026-09-29)
**Commit Message**: fix(multi-choice): accept spaces between labels in Chinese multi-select answers (#1789)

_PLAIN_LABEL_ZH_RE stopped at the first space, so '答案：A, C' and
'答案：A C' were read as 'A'. The English pattern already allows spaces,
and _label_prefix still trims any prose after the labels.

**File**: `evalscope/utils/multi_choices.py` (modified, +1/-1)
```diff
@@ -163,7 +163,7 @@ def format_example(
 _BRACKETED_LABEL_RE = re.compile(r'[\(\[（【]\s*([A-Za-z\d](?:\s*[,，/、]\s*[A-Za-z\d])*)\s*[\)\]）】]')
 
 _PLAIN_LABEL_RE = re.compile(r'([A-Za-z\d][A-Za-z\d ,/、]*)')
-_PLAIN_LABEL_ZH_RE = re.compile(r'([A-Za-z0-9][A-Za-z0-9,，/、]*)')
+_PLAIN_LABEL_ZH_RE = re.compile(r'([A-Za-z0-9][A-Za-z0-9 ,，/、]*)')
 
 _LABEL_TOKEN_RE = re.compile(r'[A-Za-z\d]+')
 
```

**File**: `tests/test_multi_choices.py` (modified, +14/-0)
```diff
@@ -137,6 +137,20 @@ def test_parse_answers_zh_multiple_correct_slash_and_ideographic_comma() -> None
     assert parse_answers_zh(_make_state('推理过程\n答案：A，C'), multiple_correct=True) == {'A', 'C'}
 
 
+def test_parse_answers_zh_multiple_correct_space_separated() -> None:
+    """A space between labels ('A, C', 'A C') does not end a Chinese multi-select answer.
+
+    The English plain-label pattern already allows spaces; the Chinese one stopped at the
+    first space, so '答案：A, C' was read as 'A' and a correct answer was scored as wrong.
+    """
+    assert parse_answers_zh(_make_state('推理过程\n答案：A, C'), multiple_correct=True) == {'A', 'C'}
+    assert parse_answers_zh(_make_state('推理过程\n答案：A C'), multiple_correct=True) == {'A', 'C'}
+    assert parse_answers_zh(_make_state('推理过程\n答案：A, B, D'), multiple_correct=True) == {'A', 'B', 'D'}
+    # Prose after the labels still ends the answer.
+    assert parse_answers_zh(_make_state('推理过程\n答案：A, C 是正确的'), multiple_correct=True) == {'A', 'C'}
+    assert parse_answers_zh(_make_state('推理过程\n答案：B because C is wrong')) == {'B'}
+
+
 def test_parse_answers_ignores_bracketed_prose() -> None:
     """Only label-shaped bracket contents may be read as an answer."""
     assert parse_answers(_make_state('ANSWER: (see the diagram above)')).isdisjoint(set('ABCD'))
```

---

### Incident Patch 8: `3e9195d4` (2026-09-29)
**Commit Message**: fix(hallusion_bench): align fAcc/qAcc grouping with official evaluation (#1769)

* fix(hallusion_bench): align fAcc/qAcc grouping with official evaluation

The figure-level (fAcc) and question-pair (qAcc) grouping in
`HallusionBenchAdapter.aggregate_scores` deviated from the official
HallusionBench evaluation in two ways, corrupting both metrics on the
default dataset:

1. The grouping key was `f'{subcategory}_{set_id}_{group_id}'`, omitting
   `category`. HallusionBench's two categories (VD/VS) reuse the same
   subcategory/set_id/figure_id/question_id numbering, so distinct
   figures/questions from different categories were merged into one group.
   In the official data (1129 records) this collides 27 figure keys and 26
   question keys across VD/VS (e.g. `ocr_0_0`, `chart_0_1` exist under both).

2. Figure-level accuracy counted VS "no-figure" records (`figure_id == 0`).
   The official eval skips these for fAcc as they carry no figure to
   attribute a group to. The default data has 178 such VS records.

Both diverge from the reference implementation
(https://github.com/tianyi-lab/HallusionBench `utils.py`,
`get_eval_fig` / `get_eval_pair_all`), which key on
`category_subcateg

**File**: `evalscope/benchmarks/hallusion_bench/hallusion_bench_adapter.py` (modified, +13/-3)
```diff
@@ -60,6 +60,7 @@
         aggregation='mean',
         eval_split='image',
         prompt_template='{question}\nPlease answer YES or NO without an explanation.',
+        evaluation_version='v1.1',
     )
 )
 class HallusionBenchAdapter(VisionLanguageAdapter):
@@ -114,13 +115,22 @@ def compute_group_accuracy(scores: List[SampleScore], group_type: str):
             groups = defaultdict(list)
             for ss in scores:
                 md = ss.sample_metadata
+                category = md.get('category')
                 subcategory = md.get('subcategory')
                 set_id = md.get('set_id')
-                group_id = md.get('figure_id') if group_type == 'figure' else md.get('question_id')
-                if subcategory is None or set_id is None or group_id is None:
+                figure_id = md.get('figure_id')
+                group_id = figure_id if group_type == 'figure' else md.get('question_id')
+                if category is None or subcategory is None or set_id is None or group_id is None:
                     # Skip incomplete records for this grouping
                     continue
-                key = f'{subcategory}_{set_id}_{group_id}'
+                # Official HallusionBench excludes VS "no-figure" records (figure_id == 0)
+                # from figure-level accuracy: they carry no figure to attribute a group to.
+                if group_type == 'figure' and str(category) == 'VS' and str(figure_id) == '0':
+                    continue
+                # The grouping key must include category. VD and VS reuse the same
+                # subcategory/set_id/figure_id/question_id numbering, so dropping category
+                # merges distinct figures/questions across categories and corrupts the metric.
+                key = f'{category}_{subcategory}_{set_id}_{group_id}'
                 groups[key].append(ss.score.main_value)
             if not groups:
                 return 0.0, 0
```

**File**: `tests/benchmark/test_hallusion_bench.py` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+"""Regression tests for HallusionBench figure/question grouping.
+
+These mirror the official HallusionBench evaluation
+(https://github.com/tianyi-lab/HallusionBench, ``utils.py``):
+
+- The figure-level (``fAcc``) and question-pair (``qAcc``) grouping keys join
+  ``category`` with ``subcategory`` / ``set_id`` / ``figure_id`` / ``question_id``.
+  The two categories (``VD`` / ``VS``) reuse the same
+  subcategory/set_id/figure_id/question_id numbering (e.g. ``ocr_0_0`` and
+  ``chart_0_1`` both appear under VD *and* VS), so dropping ``category`` merges
+  distinct figures/questions across categories.
+- Figure-level accuracy skips VS "no-figure" records (``figure_id == 0``).
+"""
+
+from typing import List
+
+from evalscope.api.metric.scorer import SampleScore, Score
+from evalscope.api.registry import BENCHMARK_REGISTRY
+from evalscope.benchmarks.hallusion_bench.hallusion_bench_adapter import HallusionBenchAdapter
+
+
+def _adapter() -> HallusionBenchAdapter:
+    return HallusionBenchAdapter(benchmark_meta=BENCHMARK_REGISTRY['hallusion_bench'])
+
+
+def _sample_score(category, subcategory, set_id, figure_id, question_id, acc) -> SampleScore:
+    return SampleScore(
+        score=Score(value={'acc': acc}, main_score_name='acc'),
+        sample_metadata={
+            'category': category,
+            'subcategory': subcategory,
+            'set_id': set_id,
+            'figure_id': figure_id,
+            'question_id': question_id,
+        },
+    )
+
+
+def _overall(scores: List[SampleScore]):
+    aggregates = _adapter().aggregate_scores(scores)
+    return {
+        agg.dimensions['target']: (round(agg.score, 4), agg.num)
+        for agg in aggregates
+        if agg.dimensions.get('level') == 'overall'
+    }
+
+
+def test_grouping_key_separates_categories():
+    """VD and VS share figure_id/question_id numbering; they must not be merged.
+
+    Both records here use ``figure_id == '1'`` so the VS "no-figure" skip does not
+    apply, isolating the effect of the ``category`` component of the key. Without
+    ``category`` in the key both rows collapse into a single ``chart_0_1`` group
+    that is neither all-correct (fAcc/qAcc = 0.0); with it they form two groups,
+    one correct (fAcc/qAcc = 0.5).
+    """
+    scores = [
+        _sample_score('VD', 'chart', '0', '1', '1', 1),
+        _sample_score('VS', 'chart', '0', '1', '1', 0),
+    ]
+
+    overall = _overall(scores)
+
+    assert overall['answer'] == (0.5, 2)
+    assert overall['figure'] == (0.5, 2)
+    assert overall['question'] == (0.5, 2)
+
+
+def test_figure_accuracy_skips_vs_no_figure_records():
+    """VS records with ``figure_id == '0'`` carry no figure and are excluded from fAcc.
+
+    They still count toward answer-level (aAcc) and question-level (qAcc) accuracy.
+    """
+    scores = [
+        _sample_score('VD', 'ocr', '0', '1', '0', 1),  # real figure, correct
+        _sample_score('VS', 'ocr', '5', '0', '0', 0),  # no figure (figure_id == 0), wrong
+    ]
+
+    overall = _overall(scores)
+
+    # answer- and question-level accuracy see both records.
+    assert overall['answer'] == (0.5, 2)
+    assert overall['question'] == (0.5, 2)
+    # figure-level accuracy drops the VS no-figure record, leaving one correct figure.
+    assert overall['figure'] == (1.0, 1)
```

---

### Incident Patch 9: `e7c07b36` (2026-09-29)
**Commit Message**: fix(ifbench): guard StopWordPercentageChecker against word-less responses (#1761)

StopWordPercentageChecker.check_following computes
(num_stopwords / num_words) * 100 without checking num_words. A model
response that contains no word tokens (only punctuation, symbols, emoji,
or whitespace, e.g. "...", "---", "😀") makes count_words return 0 and
raises ZeroDivisionError.

In the strict/loose scoring paths the raw response and its markdown- and
line-stripped variants are passed through, and any of these can reduce to
a word-less string. The exception is caught in IFBenchAdapter.match_score
and wipes the whole sample's score to {}, discarding the results of every
other instruction on that prompt and corrupting the aggregate.

Restore the upstream IFBench guard (return False when num_words == 0) and
add regression tests covering punctuation/symbol/emoji/whitespace-only
responses.

**File**: `evalscope/benchmarks/ifbench/instructions.py` (modified, +2/-0)
```diff
@@ -204,6 +204,8 @@ def get_instruction_args_keys(self):
     def check_following(self, value):
         """Checks if the response contains the expected percentage of stop words."""
         num_words = instructions_util.count_words(value)
+        if num_words == 0:
+            return False
         num_stopwords = instructions_util.count_stopwords(value)
         stopword_percentage = (num_stopwords / num_words) * 100
         return stopword_percentage <= self._percentage
```

**File**: `tests/benchmark/test_ifbench_instructions.py` (modified, +30/-0)
```diff
@@ -9,6 +9,7 @@
     PersonNameCountChecker,
     RepeatSpanChecker,
     SentenceAlphabetChecker,
+    StopWordPercentageChecker,
     WordsPositionChecker,
 )
 
@@ -174,3 +175,32 @@ def test_repeat_span_uses_word_indices() -> None:
     assert checker.check_following('The walls are solid but the stones are') is True
     assert checker.check_following('The walls are solid') is False
     assert checker.check_following('The wall') is False
+
+
+@pytest.mark.parametrize(
+    'response',
+    [
+        '...',
+        '!!!',
+        '---',
+        '***',
+        '😀😀😀',
+        '   ',
+    ],
+)
+def test_stop_word_percentage_handles_responses_without_words(response: str) -> None:
+    # Responses that contain no word tokens (punctuation/symbol/emoji/whitespace only)
+    # used to raise ZeroDivisionError from ``num_stopwords / num_words``. Upstream IFBench
+    # guards this by returning False, which we restore here.
+    checker = StopWordPercentageChecker('ratio:stop_words')
+    checker.build_description(percentage=50)
+
+    assert checker.check_following(response) is False
+
+
+def test_stop_word_percentage_still_scores_normal_responses() -> None:
+    checker = StopWordPercentageChecker('ratio:stop_words')
+    checker.build_description(percentage=100)
+
+    # A normal response with words should be scored without raising.
+    assert checker.check_following('The quick brown fox jumps over the lazy dog.') is True
```

---

### Incident Patch 10: `f8353770` (2026-09-29)
**Commit Message**: fix(bbh): keep brackets in free-form targets such as dyck_languages (#1773)

BBHAdapter.record_to_sample strips "(" and ")" from every target, to turn
"(A)" into "A" for the multiple-choice subsets. It also runs on the
free-form subsets, where brackets can be the answer: dyck_languages asks
the model to close a bracket sequence, and 119 of its 250 targets contain
"(" or ")". For those rows the stored target is the answer with its round
brackets deleted:

- ") ]" becomes "]", so the correct answer ") ]" scores 0 and the wrong
  answer "]" scores 1;
- ")" becomes "", which Target drops, so 39 rows get no reference and are
  excluded from scoring.

Strip the brackets only for MULTIPLE_CHOICE_LIST subsets. No other subset
is affected: running the adapter's own record_to_sample and
calculate_metrics over the BBH test rows (SaylorTwift/bbh) with the gold
answer as the completion, all 26 other subsets already score 6261/6261
and still do, while dyck_languages goes from 131 correct / 80 wrong /
39 excluded to 250/250. The wrong answers that scored 1 before (the gold
with its round brackets removed, 70 rows) now score 0.

Raise evaluation_version to v1.1 (AGENTS.md: choice/target mapping
ch

**File**: `evalscope/benchmarks/bbh/bbh_adapter.py` (modified, +4/-1)
```diff
@@ -107,6 +107,7 @@
         train_split=None,
         eval_split='test',
         metric_list=['acc'],
+        evaluation_version='v1.1',
         prompt_template=PROMPT_TEMPLATE,
         few_shot_prompt_template=FEWSHOT_TEMPLATE,
     )
@@ -121,13 +122,15 @@ def __init__(self, **kwargs):
 
     def record_to_sample(self, record: Dict[str, Any]) -> Sample:
         input = record['input']
-        target = record['target'].replace('(', '').replace(')', '').strip()  # Clean up the target answer
+        target = record['target'].strip()
 
         # Determine task type based on subset name
         task_type = None
         subset_name = self.current_subset_name
         if subset_name in MULTIPLE_CHOICE_LIST:
             task_type = MULTIPLE_CHOICE
+            # '(A)' -> 'A'. Free-form targets keep their brackets: in dyck_languages they are the answer.
+            target = target.replace('(', '').replace(')', '').strip()
         elif subset_name in FREE_FORM_LIST:
             task_type = FREE_FORM
 
```

**File**: `tests/benchmark/test_bbh_targets.py` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+import pytest
+
+from evalscope.api.registry import BENCHMARK_REGISTRY, get_benchmark
+from evalscope.benchmarks.bbh.bbh_adapter import FREE_FORM, MULTIPLE_CHOICE, BBHAdapter
+
+
+def test_bbh_evaluation_version_reflects_target_change() -> None:
+    metadata = BENCHMARK_REGISTRY['bbh']
+
+    assert metadata.data_adapter is BBHAdapter
+    assert metadata.evaluation_version == 'v1.1'
+
+
+def _sample(subset: str, target: str):
+    adapter = get_benchmark('bbh')
+    adapter.current_subset_name = subset
+    return adapter, adapter.record_to_sample({'input': 'Question?', 'target': target})
+
+
+@pytest.mark.parametrize('target', [') ]', ')', '> ) )', '] ) } >'])
+def test_dyck_target_keeps_its_brackets(target: str) -> None:
+    adapter, sample = _sample('dyck_languages', target)
+
+    assert sample.target == target
+    assert sample.metadata['task_type'] == FREE_FORM
+
+
+def test_dyck_correct_answer_matches_target() -> None:
+    adapter, sample = _sample('dyck_languages', ') ]')
+    extracted = adapter._extract_ff_answer('So we need ")", "]". So the answer is ) ].')
+
+    assert extracted == sample.target
+
+
+def test_multiple_choice_target_is_the_bare_letter() -> None:
+    _, sample = _sample('date_understanding', '(B)')
+
+    assert sample.target == 'B'
+    assert sample.metadata['task_type'] == MULTIPLE_CHOICE
```

#### Recent Merged Pull Requests:
- **PR #1796** (2026-09-30): fix(web): localize version badge tooltip (@git-jxj)
- **PR #1792** (closed): fix(perf): decide SSE stream end by payload shape, not a sentinel literal (@Bruce-Yii)
- **PR #1791** (2026-09-29): fix(perf): tolerate non-JSON SSE terminators; route per-turn max_tokens per protocol (@Yunnglin)
- **PR #1790** (2026-09-29): fix(perf): stop perf/detail 500 for runs without PD metrics (@Yunnglin)
- **PR #1789** (2026-09-29): fix(multi-choice): accept spaces between labels in Chinese multi-select answers (@RizgarOzan)
- **PR #1788** (closed): fix(perf): leave unrecorded optional metrics out of perf detail rows (@RizgarOzan)
- **PR #1787** (closed): feat(perf): per-turn max_tokens and system prompt override for multi-turn benchmarks (@Bruce-Yii)
- **PR #1785** (2026-09-28): feat(math): unify mathematical scoring with Math-Verify (@Yunnglin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
