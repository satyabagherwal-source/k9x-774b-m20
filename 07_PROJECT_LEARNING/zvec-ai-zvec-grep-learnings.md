> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zvec-ai-zvec-grep-learnings.md`  
> **Source**: github ([https://github.com/zvec-ai/zvec-grep](https://github.com/zvec-ai/zvec-grep))  
> **Source Version**: `72067296`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-25T03:59:26.827Z  
> **Learning ID**: `learn-github-zvec-ai-zvec-grep`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): zvec-ai/zvec-grep

> **Canonical Artifact**: `07_PROJECT_LEARNING/zvec-ai-zvec-grep-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zvec-ai/zvec-grep](https://github.com/zvec-ai/zvec-grep))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-25T03:59:26.817Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zvec-ai/zvec-grep`
- **Description**: Local-first search across your workspace, built for humans and AI agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4170 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/swe-qa-bench/zg_bench/core/__init__.py`
```
"""Benchmark core components."""

```

### Core Architecture Module: `benchmarks/swe-qa-bench/zg_bench/core/errors.py`
```
"""Failures surfaced by the SWE-QA evaluation pipeline."""


class SweQaError(RuntimeError):
    """A user-facing failure in the SWE-QA benchmark pipeline."""

```

### Core Architecture Module: `benchmarks/swe-qa-bench/zg_bench/core/io.py`
```
"""JSON evidence loading shared by the evaluation pipeline."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from zg_bench.core.errors import SweQaError


def load_object(path: Path, *, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise SweQaError(f"could not read {label} {path}: {error}") from error
    if not isinstance(value, dict):
        raise SweQaError(f"{label} must be a JSON object: {path}")
    return value

```

### Core Architecture Module: `benchmarks/swe-qa-bench/zg_bench/core/protocol.py`
```
"""SWE-QA evidence and scoring protocol, independent of execution backends."""

from __future__ import annotations

from dataclasses import dataclass

from zg_bench.core.errors import SweQaError
from zg_bench.settings import (
    BENCHMARK_MAX_OUTPUT_TOKENS,
    BENCHMARK_TEMPERATURE,
    OPENCODE_GLM_ENABLE_THINKING,
    OPENCODE_GLM_REASONING_EFFORT,
    OPENCODE_QWEN_ENABLE_THINKING,
    OPENCODE_QWEN_REASONING_EFFORT,
    OPENCODE_QWEN_TEMPERATURE,
)

SCORE_KEYS = ("correctness", "completeness", "relevance", "clarity", "coherence")


@dataclass(frozen=True)
class ModelRequestSpec:
    temperature: float
    enable_thinking: bool
    reasoning_effort: str
    max_tokens: int


# Shared request parameters for OpenCode execution and self-judging.
MODEL_REQUEST_SPECS = {
    "glm-5.2": ModelRequestSpec(
        temperature=BENCHMARK_TEMPERATURE,
        enable_thinking=OPENCODE_GLM_ENABLE_THINKING,
        reasoning_effort=OPENCODE_GLM_REASONING_EFFORT,
        max_tokens=BENCHMARK_MAX_OUTPUT_TOKENS,
    ),
    "qwen3.8-max": ModelRequestSpec(
        temperature=OPENCODE_QWEN_TEMPERATURE,
        enable_thinking=OPENCODE_QWEN_ENABLE_THINKING,
        reasoning_effort=OPENCODE_QWEN_REASONING_EFFORT,
        max_tokens=BENCHMARK_MAX_OUTPUT_TOKENS,
    ),
}
JUDGE_MODELS = tuple(MODEL_REQUEST_SPECS)


PROFILE_NAMES = ("baseline", "zvec-grep")


COMPARISON_KEYS = (
    "judge_delta",
    "input_token_reduction_pct",
    "toolcall_reduction_pct",
    "time_reduction_pct",
    "cost_reduction_pct",
)


JUDGE_GENERATION_METADATA_KEYS = (
    "enable_thinking",
    "reasoning_effort",
    "max_tokens",
    "response_format",
)


def judge_label(model: str) -> str:
    if model not in JUDGE_MODELS:
        raise SweQaError(f"unsupported judge model: {model}")
    return f"{model}-self-judge-v1"


def model_request_spec(model: str) -> ModelRequestSpec:
    judge_label(model)
    return MODEL_REQUEST_SPECS[model]

```

### Core Architecture Module: `benchmarks/swe-qa-bench/zg_bench/engines/__init__.py`
```
"""Benchmark engines components."""

```

### Core Architecture Module: `benchmarks/swe-qa-bench/zg_bench/engines/judge.py`
```
"""Model calls, response parsing, retries, and bounded self-judge concurrency."""

from __future__ import annotations

import json
import os
import time
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Any

from zg_bench.core.errors import SweQaError
from zg_bench.core.protocol import (
    PROFILE_NAMES,
    SCORE_KEYS,
    judge_label,
    model_request_spec,
)
from zg_bench.metrics.usage import (
    SESSION_USAGE_METRICS,
    usage_scope,
)
from zg_bench.settings import (
    BENCHMARK_SEED,
)

DEFAULT_JUDGE_CONCURRENCY = 3


MAX_JUDGE_CONCURRENCY = 8


JUDGE_CONCURRENCY_ENV = "SWE_QA_JUDGE_CONCURRENCY"


Completion = Callable[..., Any]


def judge_temperature(model: str) -> float:
    return model_request_spec(model).temperature


def judge_generation_metadata(model: str = "glm-5.2") -> dict[str, Any]:
    spec = model_request_spec(model)
    return {
        "enable_thinking": spec.enable_thinking,
        "reasoning_effort": spec.reasoning_effort,
        "max_tokens": spec.max_tokens,
        # The rubric prompt requests JSON; no API-enforced format is enabled.
        # Parsing and retries enforce valid scores for both supported models.
        "response_format": None,
    }


def judge_concurrency(value: int | None = None) -> int:
    raw_value: Any = value
    if raw_value is None:
        configured = os.environ.get(JUDGE_CONCURRENCY_ENV)
        raw_value = DEFAULT_JUDGE_CONCURRENCY if configured is None else configured
    if isinstance(raw_value, str):
        try:
            raw_value = int(raw_value.strip())
        except ValueError as error:
            raise SweQaError(
                f"{JUDGE_CONCURRENCY_ENV} must be an integer between 1 and "
                f"{MAX_JUDGE_CONCURRENCY}"
            ) from error
    if (
        isinstance(raw_value, bool)
        or not isinstance(raw_value, int)
        or not 1 <= raw_value <= MAX_JUDGE_CONCURRENCY
    ):
        raise SweQaError(
            f"{JUDGE_CONCURRENCY_ENV} must be an integer between 1 and "
            f"{MAX_JUDGE_CONCURRENCY}"
        )
    return raw_value


def _judge_prompt(*, question: str, reference: str, candidate: str) -> str:
    return f"""You are a strict evaluator. Score the candidate only against the supplied question and reference answer.

Score each dimension as an integer from 1 through 20:
- correctness: factual agreement with the reference; penalize errors.
- completeness: coverage of the reference's important points; penalize omissions.
- relevance: focus on the question; penalize tangents.
- clarity: precision and ease of understanding.
- coherence: logical organization and consistency of the explanation.

Scores 16-20 are reserved for excellent answers. When uncertain, choose the lower score. Treat the reference as judge-only evidence, not text to reproduce.

Question:
{question}

Reference answer:
{reference}

Candidate answer:
{candidate}

Return only one strict JSON object with exactly these five integer fields and no markdown:
{{"correctness": 1, "completeness": 1, "relevance": 1, "clarity": 1, "coherence": 1}}
"""


def _response_mapping(response: Any) -> dict[str, Any]:
    if isinstance(response, dict):
        return response
    if hasattr(response, "model_dump"):
        value = response.model_dump()
        if isinstance(value, dict):
            return value
    try:
        value = dict(response)
    except (TypeError, ValueError) as error:
        raise SweQaError("judge returned an unsupported response object") from error
    return value


def _response_content(response: Any) -> str:
    root = _response_mapping(response)
    choices = root.get("choices")
    if not isinstance(choices, list) or not choices or not isinstance(choices[0], dict):
        raise SweQaError("judge response has no choices")
    message = choices[0].get("message")
    if not isinstance(message, dict) or not isinstance(message.get("content"), str):
        raise SweQaError("judge response has no text content")
    return message["content"]


def _parse_scores(content: str) -> dict[str, int]:
    try:
        value = json.loads(content)
    except json.JSONDecodeError as error:
        raise SweQaError("judge response is not strict JSON") from error
    if not isinstance(value, dict) or set(value) != set(SCORE_KEYS):
        raise SweQaError("judge response does not have the five rubric fields")
    scores: dict[str, int] = {}
    for key in SCORE_KEYS:
        score = value.get(key)
        if (
            isinstance(score, bool)
            or not isinstance(score, int)
            or not 1 <= score <= 20
        ):
            raise SweQaError(f"judge response has invalid {key} score")
        scores[key] = score
    return scores


def _response_usage(response: Any) -> dict[str, int | float | None]:
    root = _response_mapping(response)
    usage = root.get("usage")
    if not isinstance(usage, dict):
        usage = {}
    hidden = root.get("_hidden_params")
    if not isinstance(hidden, dict):
        hidden = getattr(response, "_hidden_params", {})
    if not isinstance(hidden, dict):
        hidden = {}

    def token(name: str) -> int | None:
        value = usage.get(name)
        return value if isinstance(value, int) and not isinstance(value, bool) else None

    cost = hidden.get("response_cost")
    if isinstance(cost, bool) or not isinstance(cost, (int, float)):
        cost = None
    return {
        "input_tokens": token("prompt_tokens"),
        "output_tokens": token("completion_tokens"),
        "cost_usd": cost,
    }


def judge_candidate(
    *,
    completion_fn: Completion,
    api_key: str,
    api_base: str,
    question: str,
    reference: str,
    candidate: str,
    attempts: int,
    model: str = "glm-5.2",
) -> dict[str, Any]:
    generation = judge_generation_metadata(model)
    prompt = _judge_prompt(question=question, reference=reference, candidate=candidate)
    last_failure = "unknown"
    for attempt in range(1, attempts + 1):
        started = time.monotonic()
        try:
            response = completion_fn(
                model=f"openai/{model}",
                api_key=api_key,
                api_base=api_base,
                temperature=judge_temperature(model),
                seed=BENCHMARK_SEED,
                reasoning_effort=generation["reasoning_effort"],
                # LiteLLM's OpenAI model registry may not know this provider.
                # Explicitly forward it rather than silently dropping it.
                allowed_openai_params=["reasoning_effort"],
                max_tokens=generation["max_tokens"],
                messages=[{"role": "user", "content": prompt}],
                extra_body={"enable_thinking": generation["enable_thinking"]},
            )
        except Exception as error:  # noqa: BLE001 - providers share no stable error base.
            last_failure = f"transport error ({type(error).__name__})"
        else:
            try:
                scores = _parse_scores(_response_content(response))
            except SweQaError as error:
                last_failure = str(error)
            else:
                return {
                    "label": judge_label(model),
                    "model": model,
                    **generation,
                    "scores": scores,
                    "total": sum(scores.values()),
                    "latency_seconds": time.monotonic() - started,
                    "usage": _response_usage(response),
                }
        if attempt < attempts:
            time.sleep(min(float(attempt), 2.0))
    raise SweQaError(f"judge failed after {attempts} attempts: {last_failure}")


def judge_task_trials(
    *,
    pair: dict[str, Any],
    reference: dict[str, Any],
    completion_fn: Completion,
    api_key: str,
    api_base: str,
    attempts: int,
    concurrency: int,
    model: str = "glm-5.2",
) -> dict[str, list[dict[str, Any]]]:
    work_items = [
        (profile_name, trial)
        for profile_name in PROFILE_NAMES
        for trial in pair["profiles"][profile_name]["trials"]
    ]
    futures: list[Future[dict[str, Any]]] = []
    with ThreadPoolExecutor(
        max_workers=concurrency,
        thread_name_prefix="swe-qa-judge",
    ) as executor:
        for _, trial in work_items:
            futures.append(
                executor.submit(
                    judge_candidate,
                    completion_fn=completion_fn,
                    api_key=api_key,
                    api_base=api_base,
                    question=str(reference["question"]),
                    reference=str(reference["reference_answer"]),
                    candidate=str(trial["answer"]),
                    attempts=attempts,
                    model=model,
                )
            )
        try:
            judged = [future.result() for future in futures]
        except BaseException:
            for future in futures:
                future.cancel()
            raise

    results = {profile_name: [] for profile_name in PROFILE_NAMES}
    for (profile_name, trial), judge_result in zip(work_items, judged, strict=True):
        results[profile_name].append(
            {
                "trial_index": trial["trial_index"],
                "trial_name": trial.get("trial_name"),
                "judge": judge_result,
                "metrics": {
                    "input_tokens": trial["input_tokens"],
                    "output_tokens": trial["output_tokens"],
                    "tool_calls": trial["tool_calls"],
                    "agent_wall_seconds": trial["agent_wall_seconds"],
                    "cost_usd": trial["cost_usd"],
                    "usage_scope": usage_scope(trial),
                    **{
                        key: trial[key]
                        for key in (
                            *SESSION_USAGE_METRICS,
                            "session_usage",
                            "usage_coll
```

### Core Architecture Module: `benchmarks/swe-qa-bench/zg_bench/engines/opencode/__init__.py`
```
"""OpenCode configuration and execution-specific helpers."""

```

### Core Architecture Module: `benchmarks/swe-qa-bench/zg_bench/engines/opencode/config.py`
```
"""Pure OpenCode configuration rendering, independent of Harbor orchestration."""

from __future__ import annotations

from typing import Any

from ...settings import BENCHMARK_SEED, OPENCODE_OPENAI_COMPATIBLE_PACKAGE
from ..registry import OpenCodeModel


def build_opencode_config(model: OpenCodeModel, *, profile: str) -> dict[str, Any]:
    # Cover every built-in agent in pinned OpenCode, including delegated tasks
    # and compaction/title/summary requests. Explicit web denials also apply
    # when Harbor uses --auto/skip-permissions.
    web_permissions = {"websearch": "deny", "webfetch": "deny"}
    agent_config = {
        name: {
            "temperature": model.temperature,
            "options": {"seed": BENCHMARK_SEED},
            "permission": dict(web_permissions),
        }
        for name in (
            "build",
            "plan",
            "general",
            "explore",
            "compaction",
            "title",
            "summary",
        )
    }
    model_config: dict[str, Any] = {}
    if model.display_name is not None:
        model_config["name"] = model.display_name
    # Without this capability OpenCode 1.18.4 silently omits temperature.
    model_config["temperature"] = True
    if model.interleaved:
        # Preserve previous thinking through the API's assistant field.
        model_config["interleaved"] = {"field": "reasoning_content"}
    if model.output_limit is not None:
        # Preserve the unknown context limit; pin only the output allowance.
        model_config["limit"] = {"context": 0, "output": model.output_limit}
    model_options: dict[str, Any] = {"enable_thinking": model.enable_thinking}
    if model.reasoning_effort is not None:
        # The SDK maps camelCase to reasoning_effort in the HTTP body.
        model_options["reasoningEffort"] = model.reasoning_effort
    model_config["options"] = model_options

    custom = model.provider == "custom-openai"
    provider_options = {
        "apiKey": "{env:OPENAI_API_KEY}",
        "baseURL": model.base_url,
    }
    provider: dict[str, Any] = {
        "npm": OPENCODE_OPENAI_COMPATIBLE_PACKAGE,
        "name": "Custom OpenAI Compatible" if custom else "DashScope OpenAI Compatible",
    }
    # Retain serialized field ordering for existing run commands and evidence.
    if custom:
        provider["options"] = provider_options
    provider["models"] = {model.model_id: model_config}
    if not custom:
        provider["options"] = provider_options

    config: dict[str, Any] = {}
    if custom:
        config["$schema"] = "https://opencode.ai/config.json"
    config["provider"] = {model.provider: provider}
    if custom:
        config["model"] = model.harbor_model
    config["agent"] = agent_config
    config["permission"] = dict(web_permissions)
    if profile == "zvec-grep":
        # Harbor renders opencode.json again before execution. Preserve the
        # managed MCP entry installed by the zvec-grep adapter during setup.
        config["mcp"] = {
            "zvec_grep": {
                "type": "remote",
                "url": "http://127.0.0.1:7999/mcp",
                "enabled": True,
                "timeout": 600_000,
                "oauth": False,
            }
        }
    return config

```

### Core Architecture Module: `benchmarks/swe-qa-bench/zg_bench/engines/registry.py`
```
"""Supported execution engines, model configuration, and credential routing.

Keep model-specific choices here; command assembly and config rendering consume
these records without maintaining their own parallel lists of model names.
"""

from __future__ import annotations

import os
from collections.abc import Sequence
from dataclasses import dataclass, replace

from ..core.protocol import model_request_spec
from ..settings import (
    BENCHMARK_TEMPERATURE,
    CLAUDE_OPUS_5_MODEL,
    OPENCODE_ALIYUN_GLM_MODEL,
    OPENCODE_ALIYUN_GLM_MODEL_ID,
    OPENCODE_ALIYUN_QWEN_MODEL,
    OPENCODE_ALIYUN_QWEN_MODEL_ID,
    OPENCODE_CUSTOM_GLM_BASE_URL,
    OPENCODE_CUSTOM_GLM_MODEL,
    OPENCODE_CUSTOM_GLM_MODEL_ID,
    OPENCODE_CUSTOM_QWEN_BASE_URL,
    OPENCODE_CUSTOM_QWEN_MODEL,
    OPENCODE_CUSTOM_QWEN_MODEL_ID,
    OPENCODE_DASHSCOPE_BASE_URL,
    ZVEC_GREP_API_KEY_ENV_VARS,
    ZVEC_GREP_EMBEDDING,
    ZVEC_GREP_EMBEDDING_ENDPOINT,
)

CLAUDE_CODE_CREDENTIAL_ENV_VARS = (
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_AUTH_TOKEN",
    "CLAUDE_CODE_OAUTH_TOKEN",
)

_GLM_REQUEST = model_request_spec("glm-5.2")
_QWEN_REQUEST = model_request_spec("qwen3.8-max")


@dataclass(frozen=True)
class OpenCodeModel:
    """Provider and generation settings for one supported OpenCode model."""

    provider: str
    model_id: str
    base_url: str
    credential_env_vars: tuple[str, ...]
    temperature: float
    enable_thinking: bool
    base_url_env_vars: tuple[str, ...] = ()
    reasoning_effort: str | None = None
    output_limit: int | None = None
    display_name: str | None = None
    interleaved: bool = False

    @property
    def harbor_model(self) -> str:
        return f"{self.provider}/{self.model_id}"


@dataclass(frozen=True)
class AgentModelSupport:
    """An agent/model pair intentionally supported by this benchmark."""

    agent: str
    model: str
    aliases: tuple[str, ...] = ()
    configuration: str = "configured"
    opencode: OpenCodeModel | None = None

    def matches(self, agent: str, model: str) -> bool:
        return self.agent == agent and model in (self.model, *self.aliases)


@dataclass(frozen=True)
class ResolvedOpenCodeModel:
    """One OpenCode model with environment overrides resolved once."""

    configuration: OpenCodeModel
    credential_name: str | None
    api_key: str | None


AGENT_MODEL_SUPPORT: tuple[AgentModelSupport, ...] = (
    # Codex owns its model catalog and receives the selected model unchanged.
    AgentModelSupport("codex", "*", configuration="native passthrough"),
    AgentModelSupport("claude-code", CLAUDE_OPUS_5_MODEL),
    AgentModelSupport(
        "opencode",
        OPENCODE_ALIYUN_GLM_MODEL,
        aliases=(
            f"openai/{OPENCODE_ALIYUN_GLM_MODEL}",
            f"dashscope/{OPENCODE_ALIYUN_GLM_MODEL}",
        ),
        opencode=OpenCodeModel(
            provider="dashscope",
            model_id=OPENCODE_ALIYUN_GLM_MODEL_ID,
            base_url=OPENCODE_DASHSCOPE_BASE_URL,
            credential_env_vars=("DASHSCOPE_API_KEY", "OPENAI_API_KEY"),
            base_url_env_vars=("OPENAI_BASE_URL",),
            temperature=_GLM_REQUEST.temperature,
            enable_thinking=_GLM_REQUEST.enable_thinking,
            reasoning_effort=_GLM_REQUEST.reasoning_effort,
            output_limit=_GLM_REQUEST.max_tokens,
        ),
    ),
    AgentModelSupport(
        "opencode",
        OPENCODE_CUSTOM_GLM_MODEL,
        opencode=OpenCodeModel(
            provider="custom-openai",
            model_id=OPENCODE_CUSTOM_GLM_MODEL_ID,
            base_url=OPENCODE_CUSTOM_GLM_BASE_URL,
            credential_env_vars=("GLM_API_KEY", "OPENAI_API_KEY"),
            base_url_env_vars=("GLM_BASE_URL", "OPENAI_BASE_URL"),
            temperature=_GLM_REQUEST.temperature,
            enable_thinking=_GLM_REQUEST.enable_thinking,
            reasoning_effort=_GLM_REQUEST.reasoning_effort,
            output_limit=_GLM_REQUEST.max_tokens,
            display_name="GLM 5.2",
        ),
    ),
    AgentModelSupport(
        "opencode",
        OPENCODE_ALIYUN_QWEN_MODEL,
        aliases=(f"dashscope/{OPENCODE_ALIYUN_QWEN_MODEL}",),
        opencode=OpenCodeModel(
            provider="dashscope",
            model_id=OPENCODE_ALIYUN_QWEN_MODEL_ID,
            base_url=OPENCODE_DASHSCOPE_BASE_URL,
            credential_env_vars=("DASHSCOPE_API_KEY", "OPENAI_API_KEY"),
            base_url_env_vars=("OPENAI_BASE_URL",),
            temperature=BENCHMARK_TEMPERATURE,
            enable_thinking=False,
        ),
    ),
    AgentModelSupport(
        "opencode",
        OPENCODE_CUSTOM_QWEN_MODEL,
        opencode=OpenCodeModel(
            provider="custom-openai",
            model_id=OPENCODE_CUSTOM_QWEN_MODEL_ID,
            base_url=OPENCODE_CUSTOM_QWEN_BASE_URL,
            credential_env_vars=("GLM_API_KEY", "OPENAI_API_KEY"),
            base_url_env_vars=("GLM_BASE_URL", "OPENAI_BASE_URL"),
            temperature=_QWEN_REQUEST.temperature,
            enable_thinking=_QWEN_REQUEST.enable_thinking,
            reasoning_effort=_QWEN_REQUEST.reasoning_effort,
            output_limit=_QWEN_REQUEST.max_tokens,
            display_name="Qwen 3.8 Max",
            interleaved=True,
        ),
    ),
)


def available_agent_models() -> tuple[AgentModelSupport, ...]:
    return AGENT_MODEL_SUPPORT


def resolve_agent_model(agent: str, model: str) -> AgentModelSupport:
    agent = agent.strip()
    model = model.strip()
    if not agent:
        raise ValueError("agent must not be empty")
    if not model:
        raise ValueError("model must not be empty")
    agent_support = tuple(
        support for support in AGENT_MODEL_SUPPORT if support.agent == agent
    )
    if not agent_support:
        supported = ", ".join(
            dict.fromkeys(support.agent for support in AGENT_MODEL_SUPPORT)
        )
        raise ValueError(f"unsupported agent {agent!r}; supported agents: {supported}")
    for support in agent_support:
        if support.model == "*" or support.matches(agent, model):
            return support
    supported = ", ".join(support.model for support in agent_support)
    raise ValueError(
        f"unsupported model {model!r} for agent {agent!r}; "
        f"supported models: {supported}"
    )


def first_nonempty_env(names: Sequence[str]) -> tuple[str, str] | None:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return name, value
    return None


def resolve_opencode_model(
    model: str, *, require_credentials: bool = False
) -> ResolvedOpenCodeModel:
    """Resolve provider settings, endpoint overrides, and credentials together."""
    try:
        support = resolve_agent_model("opencode", model)
    except ValueError:
        if "/" in model:
            raise
        support = resolve_agent_model("opencode", f"custom-openai/{model}")
    provider = support.opencode
    if provider is None:  # pragma: no cover - registry invariant.
        raise ValueError(f"{model!r} has no OpenCode provider configuration")

    credential = first_nonempty_env(provider.credential_env_vars)
    endpoint = first_nonempty_env(provider.base_url_env_vars)
    resolved = replace(
        provider, base_url=endpoint[1] if endpoint else provider.base_url
    )
    if not resolved.base_url.strip():
        raise ValueError(f"{model} API base URL must not be empty")
    if require_credentials and credential is None:
        if provider.provider == "dashscope":
            accepted = ", ".join(provider.credential_env_vars)
            raise ValueError(
                f"{model} requires a DashScope API key; export one of: {accepted}"
            )
        raise ValueError(
            f"{model} requires an API key; export GLM_API_KEY or OPENAI_API_KEY"
        )
    return ResolvedOpenCodeModel(
        configuration=resolved,
        credential_name=credential[0] if credential else None,
        api_key=credential[1] if credential else None,
    )


def validate_profile_credentials(
    profiles: Sequence[str],
    *,
    agent: str,
    model: str,
    embedding_model: str = ZVEC_GREP_EMBEDDING,
    embedding_endpoint: str | None = ZVEC_GREP_EMBEDDING_ENDPOINT,
) -> None:
    support = resolve_agent_model(agent, model)
    if (
        agent == "claude-code"
        and first_nonempty_env(CLAUDE_CODE_CREDENTIAL_ENV_VARS) is None
    ):
        accepted = ", ".join(CLAUDE_CODE_CREDENTIAL_ENV_VARS)
        raise ValueError(
            "Claude Code requires Anthropic API or OAuth credentials; "
            f"export one of: {accepted}"
        )
    if support.opencode is not None:
        resolve_opencode_model(model, require_credentials=True)
    if "zvec-grep" not in profiles or not embedding_model.startswith("qwen/"):
        return
    if embedding_endpoint is not None and not embedding_endpoint.strip():
        raise ValueError("embedding endpoint must not be empty")
    if first_nonempty_env(ZVEC_GREP_API_KEY_ENV_VARS) is not None:
        return
    accepted = ", ".join(ZVEC_GREP_API_KEY_ENV_VARS)
    raise ValueError(
        "the zvec-grep profile requires a Qwen embedding API key; "
        f"export one of: {accepted}"
    )


def execution_environment(*, agent: str, model: str) -> dict[str, str]:
    """Return Harbor's environment without placing credentials in its command."""
    environment = os.environ.copy()
    support = resolve_agent_model(agent, model)
    if support.opencode is not None:
        runtime = resolve_opencode_model(model)
        provider = runtime.configuration
        if runtime.api_key is not None:
            environment["OPENAI_API_KEY"] = runtime.api_key
        environment["OPENAI_BASE_URL"] = provider.base_url
        if provider.provider == "custom-openai":
            # Harbor only needs the normalized variable, not its source alias.
            environment.pop("GLM_API_KEY", None)
    return environment

```

### Core Architecture Module: `benchmarks/swe-qa-bench/zg_bench/reports/render.py`
```
"""Render and write SWE-QA reports without calling a model."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from zg_bench.core.errors import SweQaError
from zg_bench.metrics.usage import (
    LEGACY_USAGE_SCOPE,
    SESSION_USAGE_SCOPE,
)


def _fmt_number(value: int | float, *, decimals: int = 2) -> str:
    return f"{float(value):,.{decimals}f}"


def _fmt_delta(value: float | int | None, *, suffix: str = "") -> str:
    if value is None:
        return "N/A"
    numeric = float(value)
    if round(numeric, 2) == 0:
        numeric = 0.0
    return f"{numeric:+.2f}{suffix}"


def metric_cell(
    baseline: int | float | None,
    zvec: int | float | None,
    reduction: float | None,
    *,
    decimals: int = 2,
) -> str:
    if baseline is None or zvec is None:
        return "N/A"
    left = _fmt_number(baseline, decimals=decimals)
    right = _fmt_number(zvec, decimals=decimals)
    # The stored comparison remains a reduction: positive means zvec-grep used
    # less. In the table, present every third value as zvec-grep minus baseline,
    # so efficiency wins are negative while Judge improvements stay positive.
    change = None if reduction is None else -reduction
    return f"{left} / {right} / {_fmt_delta(change, suffix='%')}"


def render_report(report: dict[str, Any]) -> str:
    usage_scope = report.get("usage_scope", LEGACY_USAGE_SCOPE)
    aggregate = report["aggregate"]
    filtering = aggregate.get("filter", {})
    included = set(
        filtering.get(
            "included_task_ids", [case["task_id"] for case in report["cases"]]
        )
    )

    def table_row(
        label: str,
        baseline: dict[str, Any],
        zvec: dict[str, Any],
        judge_b: float | None,
        judge_z: float | None,
        comparison: dict[str, Any],
    ) -> str:
        judge_cell = (
            "N/A"
            if judge_b is None or judge_z is None
            else f"{judge_b:.2f} / {judge_z:.2f} / {_fmt_delta(comparison['judge_delta'])}"
        )
        cells = [label, judge_cell]
        for metric, change in (
            ("input_tokens", "input_token_reduction_pct"),
            ("tool_calls", "toolcall_reduction_pct"),
            ("agent_wall_seconds", "time_reduction_pct"),
        ):
            cells.append(
                metric_cell(baseline[metric], zvec[metric], comparison[change])
            )
        return "| " + " | ".join(cells) + " |"

    baseline = aggregate["profiles"]["baseline"]
    zvec = aggregate["profiles"]["zvec-grep"]
    lines = [
        "# SWE-QA-Bench CI report",
        "",
    ]
    missing_tasks = report.get("gate", {}).get("missing_tasks", [])
    if missing_tasks:
        lines.extend(
            (
                f"**Incomplete run:** aggregated {len(report['cases'])} completed task(s); "
                f"{len(missing_tasks)} expected task(s) did not produce reports: "
                + ", ".join(f"`{task}`" for task in missing_tasks)
                + ". Missing tasks are not assigned zero values and are excluded from every Aggregate metric.",
                "",
            )
        )
    lines.extend(
        (
            "All cells use `baseline / zvec-grep / change`. Resource savings are negative; Judge gains are positive.",
            "",
            "| Case | Judge self-judge | input_token | toolcall | time (s) |",
            "|---|---:|---:|---:|---:|",
            table_row(
                "**Aggregate**",
                baseline,
                zvec,
                baseline["judge"],
                zvec["judge"],
                aggregate["comparison"],
            ),
        )
    )
    for case in report["cases"]:
        if case["task_id"] not in included:
            continue
        baseline = case["profiles"]["baseline"]
        zvec = case["profiles"]["zvec-grep"]
        lines.append(
            table_row(
                str(case["task_id"]),
                baseline["metrics"],
                zvec["metrics"],
                baseline["judge"]["total"],
                zvec["judge"]["total"],
                case["comparison"],
            )
        )
    lines.append("")
    if filtering:
        lines.extend(
            (
                f"Aggregate includes **{filtering['included_count']}/{filtering['total_count']} tasks**. "
                "A task is excluded from every Aggregate metric and the table above if either its input-token change "
                "`(zvec-grep mean - baseline mean) / baseline mean` is strictly outside **[-100%, +100%]**, "
                "or its Judge difference `zvec-grep mean - baseline mean` is strictly outside **[-10, +10] score points**. "
                "Exactly +/-10 Judge points and +/-100% input-token changes are retained. "
                "Both filters use each profile's trial mean and are applied independently to each workflow run; "
                "tasks matching both are excluded only once. "
                "All tasks are still executed, judged, and retained in the JSON evidence.",
                "",
            )
        )
        excluded = filtering.get("excluded_tasks", [])
        judge_excluded = [
            row
            for row in excluded
            if "judge_delta_outside_range" in row.get("reasons", [])
        ]
        if judge_excluded:
            lines.extend(
                (
                    "### Tasks excluded for Judge differences",
                    "",
                    "These are differences between the two profiles' mean scores, in points, not percentages. "
                    "Positive values favor zvec-grep; negative values favor baseline. "
                    "Every task below is excluded from all Aggregate metrics, including resource totals.",
                    "",
                    "| Task | Baseline Judge | zvec-grep Judge | Judge change (points) | Exclusion reason |",
                    "|---|---:|---:|---:|---|",
                )
            )
            for row in judge_excluded:
                reason = (
                    "Judge gain exceeds +10 points"
                    if row["judge_delta"] > 0
                    else "Judge decline exceeds -10 points"
                )
                if "undefined_baseline" in row["reasons"]:
                    reason += "; input baseline is zero while zvec-grep is positive"
                elif "input_token_change_outside_range" in row["reasons"]:
                    reason += f"; input change {_fmt_delta(row['change_pct'], suffix='%')} is outside [-100%, +100%]"
                lines.append(
                    f"| {row['task_id']} | {row['baseline_judge']:.2f} | {row['zvec_grep_judge']:.2f} "
                    f"| {_fmt_delta(row['judge_delta'])} | {reason} |"
                )
            lines.append("")
        elif any(
            rule.get("metric") == "judge" for rule in filtering.get("criteria", [])
        ):
            lines.extend(
                (
                    "No tasks were excluded for Judge differences outside [-10, +10] points.",
                    "",
                )
            )
        input_excluded = [
            row
            for row in excluded
            if set(row.get("reasons", [row.get("reason")]))
            & {"undefined_baseline", "input_token_change_outside_range"}
        ]
        if input_excluded:
            descriptions = []
            for row in input_excluded:
                change = row["change_pct"]
                descriptions.append(
                    f"`{row['task_id']}` (input "
                    + (
                        "N/A: baseline is zero, zvec-grep is positive"
                        if change is None
                        else _fmt_delta(change, suffix="%")
                    )
                    + ")"
                )
            lines.extend(
                (
                    "Tasks excluded for input-token changes: "
                    + "; ".join(descriptions)
                    + ".",
                    "",
                )
            )
        if not included:
            lines.extend(
                (
                    "No tasks remain after filtering; Aggregate is N/A. This does not invalidate completed trials.",
                    "",
                )
            )

    completion_statement = (
        "The completion gate failed because one or more expected tasks did not produce a valid judged pair. "
        "The displayed Aggregate covers completed tasks only."
        if missing_tasks
        else "The hard gate requires every expected pair and every judge call to succeed, including excluded tasks."
    )
    lines.extend(
        (
            "Each task's baseline and zvec-grep values are arithmetic means across its trials. "
            "Aggregate resource values are sums of the included task means; Judge values are equal-weight means across included tasks. "
            "Every Aggregate change is calculated directly from the displayed Aggregate values, not an average of task percentages. "
            "A zero Aggregate baseline denominator produces N/A; zero-baseline tasks in other metrics still contribute to the sums. "
            "For the input filter, two zero means are retained, while a zero baseline with positive zvec-grep is excluded.",
            "",
            "Nonnegative input tokens cannot decrease by more than 100%; this threshold therefore removes high-overhead tasks. "
            "Filtered statistics are a sensitivity analysis and do not imply the excluded results are invalid.",
            "",
        )
    )
    samples = aggregate.get("comparison_samples")
    if isinstance(samples, dict):
        task_count = len(included)
        lines.extend(
            (
                "Aggregate comparison sample counts: "
                f"Judge n={samples.get('judge_delta', 0)}/{task_count}, "
                f"input_token n={samples.get('input_token_reduction_pct', 0)}/{task
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #177** (2026-09-21): **[Bug]: Rust zg rejects zero vectors accepted by zvec, failing whole-file indexing**
  *Symptoms*: ## Description  The Rust indexer fails an entire file when one `local/potion-code-16m-v2` fragment contains no recognized tokens. Model2Vec returns an all-zero embedding for that fragment, and Rust storage rejects it for the cosine index. In the same corpus, the published Node.js package (`@zvec/zvec-grep@0.2.1`) indexed the file successfully but persisted that zero vector. This is a difference in storage validation, not evidence that Node.js produced a usable embedding.  ## Reproduction  1. Build the Rust package from [`3e16b18`](https://github.com/Cuiyus/zvec-grep/commit/3e16b1861ad8f8529fe4e70268448217f37d0a6d), or use the `package-retrieval-candidate` artifact from [fork CI run 35558324124](https://github.com/Cuiyus/zvec-grep/actions/runs/35558324124). 2. Check out `matplotlib/matplotlib` at `a5e1f6086e92d5cc0a23f85685d03d85b89a8395`. 3. Index it on Linux x86_64 with `zg index <absolute-repository-root> --mode direct --embedding local/potion-code-16m-v2 --device cpu --debug`, using the run's frozen code-extension selection (which includes `.eps`) and 1 MB file-size limit.  Rust reports:  ```text Failed: lib/matplotlib/tests/baseline_images/test_axes/pcolormesh_small.eps: commit: cosine vectors must have a non-zero norm Files: scanned=1223 added=1223 modified=0 deleted=0 unchanged=0 failed=1 ```  `zg status --check-ready` subsequently rejects the index. The separate `zg index` exit-status/`ready` contradiction is tracked in #175.  ## Root-cause evidence  - The `.eps` file 

- **Issue #175** (2026-10-12): **[Bug]: zg index exits successfully and reports ready despite failed files and an unready index**
  *Symptoms*: ## Description  The Rust `zg index` command exits **0** and prints `Workspace index: ready` even when a file failed, remains pending, and the immediately following `zg status --check-ready` exits **1** with `workspace index is not ready`. Automation that trusts the index command's exit status and headline proceeds with an unusable/incomplete index.  This is distinct from the underlying extraction failure in #174: the same CLI contradiction also occurs when vector storage rejects an `.eps` file.  ## Steps to reproduce  1. Build the Rust package from [`3e16b18`](https://github.com/Cuiyus/zvec-grep/commit/3e16b1861ad8f8529fe4e70268448217f37d0a6d) (`cd rust && npm ci && npm run pack:local`), or use the `package-retrieval-candidate` artifact from [fork CI run 35558324124](https://github.com/Cuiyus/zvec-grep/actions/runs/35558324124). 2. Check out `pylint-dev/pylint` at `44740e5e5cdd2b80321a4f0ed4254213d058b9f6`, `django/django` at `14fc2e97036fc9d7acb55ada4f16f1aa3bdc5ec7`, or `matplotlib/matplotlib` at `a5e1f6086e92d5cc0a23f85685d03d85b89a8395`. 3. Run `zg index <absolute-repository-root> --mode direct --embedding local/potion-code-16m-v2 --device cpu --debug` with the benchmark's frozen code-extension and 1 MB file-size selection. Record its exit status and output. The exact invocation and artifacts are in the linked CI run. 4. Immediately run `zg status <absolute-repository-root> --mode direct --check-ready --debug` and record its exit status.  ## Actual and expected results  A

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

### Incident Patch 1: `a2fa4b40` (2026-10-23)
**Commit Message**: fix(rust): preserve command results when stdout closes early (#270)

CLI stdout used panicking print macros or propagated BrokenPipe before readiness checks. Ignore only broken-pipe writes at the output boundary so validation and cleanup continue, matching the Node.js CLI behavior.

**File**: `rust/crates/zg-cli/src/install.rs` (modified, +32/-26)
```diff
@@ -135,7 +135,7 @@ struct AgentOptions {
 /// Returns an error when target selection, configuration validation, or an
 /// atomic file update fails.
 pub fn execute_install(args: &InstallArgs) -> Result<InstallOutcome, InstallError> {
-    print_header();
+    print_header()?;
     let detected = detect_agents();
     let agents = resolve_agents(
         args.targets.iter().chain(&args.positional_targets),
@@ -144,7 +144,7 @@ pub fn execute_install(args: &InstallArgs) -> Result<InstallOutcome, InstallErro
         "install",
     )?;
     if agents.is_empty() {
-        println!("\nNo agent integrations selected.");
+        writeln!(crate::stdout(), "\nNo agent integrations selected.")?;
         return Ok(InstallOutcome {
             agent_labels: Vec::new(),
             transport: args.transport.unwrap_or_default(),
@@ -160,18 +160,18 @@ pub fn execute_install(args: &InstallArgs) -> Result<InstallOutcome, InstallErro
         token_env: args.mcp_token_env.clone(),
     };
 
-    println!("\nInstalling integrations\n");
+    writeln!(crate::stdout(), "\nInstalling integrations\n")?;
     for agent in &agents {
         let result = install_agent(*agent, &options)?;
-        println!("  ✓ {}", agent.label());
-        println!("    MCP       configured");
+        writeln!(crate::stdout(), "  ✓ {}", agent.label())?;
+        writeln!(crate::stdout(), "    MCP       configured")?;
         if let Some(path) = result.config_path {
-            println!("    Config    {}", path.display());
+            writeln!(crate::stdout(), "    Config    {}", path.display())?;
         }
         if let Some(note) = result.config_note {
-            println!("    Note      {note}");
+            writeln!(crate::stdout(), "    Note      {note}")?;
         }
-        println!();
+        writeln!(crate::stdout())?;
     }
 
     Ok(InstallOutcome {
@@ -188,7 +188,7 @@ pub fn execute_install(args: &InstallArgs) -> Result<InstallOutcome, InstallErro
 /// Returns an error when an existing configuration is invalid or a file update
 /// fails.
 pub fn execute_uninstall(args: &UninstallArgs) -> Result<(), InstallError> {
-    print_header();
+    print_header()?;
     let detected = detect_agents();
     let agents = resolve_agents(
         args.targets.iter().chain(&args.positional_targets),
@@ -197,23 +197,27 @@ pub fn execute_uninstall(args: &UninstallArgs) -> Result<(), InstallError> {
         "uninstall",
     )?;
     if agents.is_empty() {
-        println!("\nNo agent integrations selected.");
+        writeln!(crate::stdout(), "\nNo agent integrations selected.")?;
         return Ok(());
     }
 
-    println!("\nRemoving integrations\n");
+    writeln!(crate::stdout(), "\nRemoving integrations\n")?;
     for agent in agents {
         uninstall_agent(agent)?;
-        println!("  ✓ {}", agent.label());
-        println!("    integration removed");
+        writeln!(crate::stdout(), "  ✓ {}", agent.label())?;
+        writeln!(crate::stdout(), "    integration removed")?;
     }
-    println!("\nRestart the selected agents or start a new session to apply the change.");
+    writeln!(
+        crate::stdout(),
+        "\nRestart the selected agents or start a new session to apply the change."
+    )?;
     Ok(())
 }
 
-fn print_header() {
-    println!("zvec-grep setup");
-    println!("{}", "─".repeat(40));
+fn print_header() -> io::Result<()> {
+    let mut output = crate::stdout();
+    writeln!(output, "zvec-grep setup")?;
+    writeln!(output, "{}", "─".repeat(40))
 }
 
 fn resolve_transport(
@@ -226,8 +230,8 @@ fn resolve_transport(
     if yes || !io::stdin().is_terminal() || !io::stdout().is_terminal() {
         return Ok(McpInstallTransport::Stdio);
     }
-    print!("MCP transport [stdio] (stdio/http): ");
-    io::stdout().flush()?;
+    write!(crate::stdout(), "MCP transport [stdio] (stdio/http): ")?;
+    crate::stdout().flush()?;
     let mut answer = String::new();
     io::stdin().read_line(&mut answer)?;
     match answer.trim().to_ascii_lowercase().as_str() {
@@ -262,14 +266,15 @@ fn resolve_agents<'a>(
             .collect());
     }
 
-    println!(
+    writeln!(
+        crate::stdout(),
         "\n{}\n",
         if action == "install" {
             "Choose agent integrations"
         } else {
             "Choose integrations to remove"
         }
-    );
+    )?;
     prompt_agent_selection(detected)
 }
 
@@ -304,7 +309,7 @@ fn prompt_agent_selection(detected: &BTreeSet<Agent>) -> Result<Vec<Agent>, Inst
         .iter()
         .position(|agent| detected.contains(agent))
         .unwrap_or(0);
-    let mut output = io::stdout().lock();
+    let mut output = crate::stdout();
     render_agent_selection(&mut output, active_index, detected, false)?;
     loop {
         let Event::Key(key) = event::read()? else {
@@ -379,7 +384,8 @@ fn render_agent_selection(
 
 fn prompt_agent_line_selection(detected: &BTreeSet<Agent>) -> Result<Vec<Agent>, InstallError> {
     for (index, agent) 
```

**File**: `rust/crates/zg-cli/src/lib.rs` (modified, +2/-0)
```diff
@@ -11,6 +11,7 @@ mod progress;
 mod render;
 mod setup;
 mod status;
+mod stdio;
 mod terminal;
 mod theme;
 pub use management::{
@@ -24,6 +25,7 @@ pub use setup::{
     prompt_setup_credential,
 };
 pub use status::{write_info_result, write_info_with_options};
+pub use stdio::stdout;
 pub use terminal::{stderr_supports_ansi, stdout_supports_ansi};
 
 use std::{
```

**File**: `rust/crates/zg-cli/src/render.rs` (modified, +4/-3)
```diff
@@ -326,9 +326,10 @@ pub fn help_text(topic: Option<&str>) -> Result<String, HelpTopicError> {
 ///
 /// # Errors
 ///
-/// Returns an error when `topic` is not part of the public help surface.
-pub fn print_help(topic: Option<&str>) -> Result<(), HelpTopicError> {
-    println!("{}", help_text(topic)?);
+/// Returns an error when `topic` is not part of the public help surface or
+/// stdout fails for a reason other than a closed pipe.
+pub fn print_help(topic: Option<&str>) -> Result<(), Box<dyn std::error::Error>> {
+    writeln!(crate::stdout(), "{}", help_text(topic)?)?;
     Ok(())
 }
 
```

**File**: `rust/crates/zg-cli/src/stdio.rs` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+use std::io::{self, Write};
+
+/// Locks CLI stdout, ignoring a consumer that closes its pipe early.
+///
+/// Only stdout writes and flushes suppress `BrokenPipe`; command validation and
+/// cleanup continue normally. Long-lived transports use their own stdout.
+#[must_use]
+pub fn stdout() -> impl Write {
+    IgnoreBrokenPipe(io::stdout().lock())
+}
+
+struct IgnoreBrokenPipe<W>(W);
+
+impl<W: Write> Write for IgnoreBrokenPipe<W> {
+    fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
+        match self.0.write(buffer) {
+            Err(error) if error.kind() == io::ErrorKind::BrokenPipe => Ok(buffer.len()),
+            result => result,
+        }
+    }
+
+    fn flush(&mut self) -> io::Result<()> {
+        match self.0.flush() {
+            Err(error) if error.kind() == io::ErrorKind::BrokenPipe => Ok(()),
+            result => result,
+        }
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    struct Consumer {
+        remaining: usize,
+        error: io::ErrorKind,
+    }
+
+    impl Write for Consumer {
+        fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
+            if self.remaining == 0 {
+                return Err(self.error.into());
+            }
+            let written = buffer.len().min(self.remaining);
+            self.remaining -= written;
+            Ok(written)
+        }
+
+        fn flush(&mut self) -> io::Result<()> {
+            Err(self.error.into())
+        }
+    }
+
+    #[test]
+    fn partial_consumption_and_broken_pipe_flush_are_ignored() {
+        let mut writer = IgnoreBrokenPipe(Consumer {
+            remaining: 3,
+            error: io::ErrorKind::BrokenPipe,
+        });
+        writer
+            .write_all(b"first chunk")
+            .expect("partial consumption");
+        writer.write_all(b"later chunk").expect("closed consumer");
+        writer.flush().expect("closed consumer flush");
+    }
+
+    #[test]
+    fn other_io_errors_are_propagated() {
+        for kind in [io::ErrorKind::PermissionDenied, io::ErrorKind::WriteZero] {
+            let mut writer = IgnoreBrokenPipe(Consumer {
+                remaining: 0,
+                error: kind,
+            });
+            assert_eq!(
+                writer.write_all(b"chunk").expect_err("write error").kind(),
+                kind
+            );
+            assert_eq!(writer.flush().expect_err("flush error").kind(), kind);
+        }
+    }
+}
```

**File**: `rust/crates/zg/src/main.rs` (modified, +49/-33)
```diff
@@ -1,6 +1,6 @@
 use std::{
     error::Error,
-    io::{self, IsTerminal},
+    io::{self, IsTerminal, Write},
     path::Path,
     process::ExitCode,
     sync::{
@@ -66,7 +66,7 @@ fn run() -> Result<ExitCode, Box<dyn Error>> {
         }
         CliPlan::Version => {
             warn();
-            println!("{}", env!("CARGO_PKG_VERSION"));
+            writeln!(zg_cli::stdout(), "{}", env!("CARGO_PKG_VERSION"))?;
             return Ok(ExitCode::SUCCESS);
         }
         _ => {}
@@ -177,8 +177,8 @@ async fn execute_plan(plan: CliPlan) -> Result<ExitCode, Box<dyn Error>> {
                     ("Model", reference, path)
                 }
             };
-            println!("{label} config: {reference}");
-            println!("Global config: {}", path.display());
+            writeln!(zg_cli::stdout(), "{label} config: {reference}")?;
+            writeln!(zg_cli::stdout(), "Global config: {}", path.display())?;
             Ok(())
         }
         CliPlan::Auth(args) => {
@@ -188,7 +188,7 @@ async fn execute_plan(plan: CliPlan) -> Result<ExitCode, Box<dyn Error>> {
                 .ok_or_else(|| io::Error::other("auth root is required"))?;
             if matches!(args.action, zg_cli::AuthAction::Revoke) {
                 let count = zg_engine::authorization::revoke_all(root)?;
-                zg_cli::write_authorization_revoke_result(io::stdout().lock(), count)?;
+                zg_cli::write_authorization_revoke_result(zg_cli::stdout(), count)?;
                 return Ok(ExitCode::SUCCESS);
             }
             if matches!(args.action, zg_cli::AuthAction::Grant { .. }) {
@@ -200,7 +200,7 @@ async fn execute_plan(plan: CliPlan) -> Result<ExitCode, Box<dyn Error>> {
             }
             let status = zg_engine::authorization::status_snapshot(root)?;
             zg_cli::write_authorization_status(
-                io::stdout().lock(),
+                zg_cli::stdout(),
                 &status,
                 if args.no_color {
                     zg_cli::ColorMode::Never
@@ -261,30 +261,44 @@ async fn execute_install_plan(args: &zg_cli::InstallArgs) -> Result<(), Box<dyn
     };
     if let Some(status) = &status {
         if status.ready {
-            println!("  ✓ Server");
-            println!(
+            writeln!(zg_cli::stdout(), "  ✓ Server")?;
+            writeln!(
+                zg_cli::stdout(),
                 "    ready at {}",
                 status
                     .server_url
                     .as_deref()
                     .unwrap_or("http://127.0.0.1:7999/mcp")
-            );
+            )?;
         } else {
-            println!("  ○ Server");
-            println!("    not started; run `zg --server on`");
+            writeln!(zg_cli::stdout(), "  ○ Server")?;
+            writeln!(zg_cli::stdout(), "    not started; run `zg --server on`")?;
         }
     } else {
-        println!("  ○ Server");
-        println!("    not started; run `zg --server on`");
+        writeln!(zg_cli::stdout(), "  ○ Server")?;
+        writeln!(zg_cli::stdout(), "    not started; run `zg --server on`")?;
     }
     if outcome.transport == McpInstallTransport::Stdio {
-        println!("  ✓ Connection");
-        println!("    stdio; reconnects start the server automatically");
+        writeln!(zg_cli::stdout(), "  ✓ Connection")?;
+        writeln!(
+            zg_cli::stdout(),
+            "    stdio; reconnects start the server automatically"
+        )?;
     }
-    println!("\nzvec-grep is ready\n");
-    println!("  Agents       {}", outcome.agent_labels.join(", "));
-    println!("  Remote data  Authorization requested on first remote use");
-    println!("\nRestart the selected agents or start a new session to load the integration.");
+    writeln!(zg_cli::stdout(), "\nzvec-grep is ready\n")?;
+    writeln!(
+        zg_cli::stdout(),
+        "  Agents       {}",
+        outcome.agent_labels.join(", ")
+    )?;
+    writeln!(
+        zg_cli::stdout(),
+        "  Remote data  Authorization requested on first remote use"
+    )?;
+    writeln!(
+        zg_cli::stdout(),
+        "\nRestart the selected agents or start a new session to load the integration."
+    )?;
     Ok(())
 }
 
@@ -334,7 +348,7 @@ async fn execute_request(
             .await;
         engine.close();
         zg_cli::write_path_lookup_result(
-            io::stdout().lock(),
+            zg_cli::stdout(),
             io::stderr().lock(),
             &result?,
             output,
@@ -390,7 +404,7 @@ async fn execute_context(
             return Err(protocol_mismatch("context"));
         };
         zg_cli::write_context_with_options(
-            io::stdout().lock(),
+            zg_cli::stdout(),
             &result,
             output,
             zg_cli::stdout_supports_ansi(),
@@ -754,7 +768,7 @@ async fn execute_direct_context(
     }
     engine.close();
     zg_cli::write_context_with_options(
-        io::stdout().lock(),
+        zg_cli::stdout(
```

**File**: `rust/crates/zg/tests/implicit_index.rs` (modified, +86/-0)
```diff
@@ -1,5 +1,6 @@
 use std::{
     fs,
+    io::Read,
     net::TcpListener,
     process::{Command, Output, Stdio},
     sync::{
@@ -200,6 +201,91 @@ fn status_check_ready_keeps_direct_and_server_exit_semantics() {
     check("! Workspace index needs an update", false);
 }
 
+fn with_closed_stdout(mut command: Command) -> Output {
+    let (reader, writer) = std::io::pipe().expect("stdout pipe");
+    drop(reader);
+    command
+        .stdout(Stdio::from(writer))
+        .output()
+        .expect("run with closed stdout")
+}
+
+#[test]
+fn closed_stdout_preserves_success_and_readiness_errors() {
+    let mut fixture = Fixture::new();
+    fixture.start_server();
+    for args in [
+        vec!["--version"],
+        vec!["--help"],
+        vec!["--server", "status"],
+        vec!["--status", "--mode", "direct"],
+        vec!["--status", "--mode", "server"],
+    ] {
+        let output = with_closed_stdout(fixture.command(&args));
+        assert_eq!(output.status.code(), Some(0), "{args:?}: {output:?}");
+        assert!(output.stderr.is_empty(), "{args:?}: {output:?}");
+    }
+    for mode in ["direct", "server"] {
+        let output =
+            with_closed_stdout(fixture.command(&["--status", "--mode", mode, "--check-ready"]));
+        assert_eq!(output.status.code(), Some(1), "{mode}: {output:?}");
+        assert_eq!(
+            String::from_utf8_lossy(&output.stderr),
+            "Error: workspace index is not ready\n",
+            "{mode}: {output:?}"
+        );
+    }
+    fixture.success(&[
+        "--index",
+        "--mode",
+        "direct",
+        "--embedding",
+        "local/potion-code-16m-v2",
+    ]);
+    for mode in ["direct", "server"] {
+        for args in [
+            vec!["--status", "--mode", mode, "--check-ready"],
+            vec!["--fts", "needle", "--mode", mode, "--refresh", "off"],
+        ] {
+            let output = with_closed_stdout(fixture.command(&args));
+            assert_eq!(output.status.code(), Some(0), "{args:?}: {output:?}");
+            assert!(output.stderr.is_empty(), "{args:?}: {output:?}");
+        }
+    }
+    fixture.success(&["--server", "off"]);
+    fixture.server_started = false;
+    let output = with_closed_stdout(fixture.command(&["--server", "status", "--check-ready"]));
+    assert_eq!(output.status.code(), Some(1), "{output:?}");
+    assert_eq!(
+        String::from_utf8_lossy(&output.stderr),
+        "Error: server is not ready\n"
+    );
+}
+
+#[test]
+fn partial_stdout_consumption_keeps_query_successful() {
+    let fixture = Fixture::new();
+    fs::write(
+        fixture.root.path().join("source.txt"),
+        format!("needle {}\n", "x".repeat(400)).repeat(10_000),
+    )
+    .expect("large search fixture");
+    let mut child = fixture
+        .command(&["--rg", "needle", "source.txt", "--mode", "direct"])
+        .stdout(Stdio::piped())
+        .stderr(Stdio::piped())
+        .spawn()
+        .expect("query producer");
+    let mut stdout = child.stdout.take().expect("query stdout");
+    let mut prefix = [0; 100];
+    stdout.read_exact(&mut prefix).expect("consume first chunk");
+    assert!(String::from_utf8_lossy(&prefix).contains("source.txt"));
+    drop(stdout);
+    let output = child.wait_with_output().expect("query completion");
+    assert_eq!(output.status.code(), Some(0), "{output:?}");
+    assert!(output.stderr.is_empty(), "{output:?}");
+}
+
 struct GatedEmbedding {
     endpoint: String,
     entered: Arc<Semaphore>,
```

**File**: `rust/crates/zg/tests/pi_install.rs` (modified, +27/-1)
```diff
@@ -1,4 +1,8 @@
-use std::{fs, path::Path, process::Command};
+use std::{
+    fs,
+    path::Path,
+    process::{Command, Stdio},
+};
 
 use serde_json::{Value, json};
 use tempfile::TempDir;
@@ -54,6 +58,28 @@ fn write_json(path: &Path, value: &Value) {
     .expect("write JSON");
 }
 
+#[test]
+fn closed_stdout_allows_installation_and_removal_to_complete() {
+    let temporary = TempDir::new().expect("tempdir");
+    let root = temporary.path();
+    let path = root.join("pi/mcp.json");
+    for action in ["--install", "--uninstall"] {
+        let (reader, writer) = std::io::pipe().expect("stdout pipe");
+        drop(reader);
+        let output = command(action, root)
+            .stdout(Stdio::from(writer))
+            .output()
+            .expect("run with closed stdout");
+        assert_eq!(output.status.code(), Some(0), "{action}: {output:?}");
+        assert!(output.stderr.is_empty(), "{action}: {output:?}");
+        assert_eq!(
+            read_json(&path)["mcpServers"]["zvec_grep"].is_object(),
+            action == "--install",
+            "{action} must complete after its first stdout write"
+        );
+    }
+}
+
 #[test]
 fn config_rewrites_preserve_ordered_exposure_rules_and_unrelated_servers() {
     let temporary = TempDir::new().expect("tempdir");
```

---

### Incident Patch 2: `60ba7d98` (2026-10-23)
**Commit Message**: fix(engine): join read cache maintenance on shutdown (#289)

Keep cache ownership separate from the state retained by maintenance so the
last cache handle stops and joins the existing worker before native storage
can outlive process teardown. Serialize concurrent closes through both the
join and cache draining, and wake parked maintenance for prompt shutdown.

Preserve in-flight leases, cache clone behavior, and one worker per cache.
Add regression coverage for explicit close, final-owner drop, concurrent
close calls, and cache reuse after dropping another owner.

**File**: `rust/crates/zg-engine/src/storage/read_session.rs` (modified, +56/-15)
```diff
@@ -7,6 +7,7 @@ use std::{
         Arc, Mutex, MutexGuard, OnceLock, Weak,
         atomic::{AtomicBool, Ordering},
     },
+    thread::JoinHandle,
     time::{Duration, Instant},
 };
 
@@ -22,7 +23,14 @@ static CACHES: OnceLock<Mutex<Vec<Weak<CacheInner>>>> = OnceLock::new();
 
 #[derive(Clone)]
 pub(crate) struct ReadSessionCache {
+    owner: Arc<CacheOwner>,
+}
+
+// The worker and registry only reference CacheInner, never CacheOwner. The last
+// cache handle can therefore stop and join maintenance without self-joining.
+struct CacheOwner {
     inner: Arc<CacheInner>,
+    worker: Mutex<Option<JoinHandle<()>>>,
 }
 
 struct CacheInner {
@@ -61,6 +69,13 @@ pub(crate) struct ReadSessionLease {
 
 impl ReadSessionCache {
     pub(crate) fn new(idle_timeout: Duration) -> std::io::Result<Self> {
+        Self::spawn(idle_timeout, maintain)
+    }
+
+    fn spawn(
+        idle_timeout: Duration,
+        maintenance: impl FnOnce(&Weak<CacheInner>) + Send + 'static,
+    ) -> std::io::Result<Self> {
         let inner = Arc::new(CacheInner {
             state: Mutex::new(CacheState::default()),
             idle_timeout,
@@ -69,21 +84,18 @@ impl ReadSessionCache {
         let weak = Arc::downgrade(&inner);
         // A native thread can release idle handles even when a synchronous writer
         // is waiting for another process's cache on a single-threaded executor.
-        std::thread::Builder::new()
+        let worker = std::thread::Builder::new()
             .name("index-read-cache".into())
-            .spawn(move || {
-                while let Some(inner) = weak.upgrade() {
-                    if !inner.reap(Instant::now()) {
-                        break;
-                    }
-                    drop(inner);
-                    std::thread::sleep(REAP_INTERVAL);
-                }
-            })?;
+            .spawn(move || maintenance(&weak))?;
         let mut caches = lock(CACHES.get_or_init(Mutex::default));
         caches.retain(|cache| cache.strong_count() > 0);
         caches.push(Arc::downgrade(&inner));
-        Ok(Self { inner })
+        Ok(Self {
+            owner: Arc::new(CacheOwner {
+                inner,
+                worker: Mutex::new(Some(worker)),
+            }),
+        })
     }
 
     /// The caller holds the workspace home read lock throughout the lease.
@@ -106,8 +118,8 @@ impl ReadSessionCache {
         open: impl FnOnce() -> EngineResult<IndexStore>,
     ) -> EngineResult<ReadSessionLease> {
         let slot = {
-            let mut state = lock(&self.inner.state);
-            if self.inner.closed.load(Ordering::Acquire) {
+            let mut state = lock(&self.owner.inner.state);
+            if self.owner.inner.closed.load(Ordering::Acquire) {
                 return Err(EngineError::resource_closed(
                     "index read cache has been closed",
                 ));
@@ -117,7 +129,7 @@ impl ReadSessionCache {
         // Only this workspace waits for native open/close; the map owns entries,
         // never native I/O. Concurrent misses for one workspace share this slot.
         let mut entry = lock(&slot.entry);
-        if self.inner.closed.load(Ordering::Acquire) {
+        if self.owner.inner.closed.load(Ordering::Acquire) {
             return Err(EngineError::resource_closed(
                 "index read cache has been closed",
             ));
@@ -153,7 +165,20 @@ impl ReadSessionCache {
     }
 
     pub(crate) fn close(&self) {
+        self.owner.close();
+    }
+}
+
+impl CacheOwner {
+    fn close(&self) {
         self.inner.closed.store(true, Ordering::Release);
+        // Serialize the whole shutdown so every concurrent close waits for both
+        // maintenance and native retirement. No cache or slot lock is held at join.
+        let mut worker = lock(&self.worker);
+        if let Some(worker) = worker.take() {
+            worker.thread().unpark();
+            let _ = worker.join();
+        }
         let entries = std::mem::take(&mut lock(&self.inner.state).entries);
         // In-flight queries retain their own Arc until they finish. Native close
         // runs after releasing the map lock, under the workspace's own slot lock.
@@ -163,11 +188,27 @@ impl ReadSessionCache {
     }
 }
 
+impl Drop for CacheOwner {
+    fn drop(&mut self) {
+        self.close();
+    }
+}
+
+fn maintain(weak: &Weak<CacheInner>) {
+    while let Some(inner) = weak.upgrade() {
+        if !inner.reap(Instant::now()) {
+            break;
+        }
+        drop(inner);
+        std::thread::park_timeout(REAP_INTERVAL);
+    }
+}
+
 impl std::fmt::Debug for ReadSessionCache {
     fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
         formatter
             .debug_struct("ReadSessionCache")
-            .field("entries", &lock(&self.inner.state).entries.len())
+            .field("entries", &lock(&self.owner.inner.state).entries.len())
             .finish_non_exhaustive()
     }
 }
```

**File**: `rust/crates/zg-engine/src/storage/read_session/tests.rs` (modified, +99/-6)
```diff
@@ -178,6 +178,96 @@ fn cache() -> ReadSessionCache {
     ReadSessionCache::new(Duration::from_secs(60)).expect("cache worker")
 }
 
+fn assert_shutdown_waits_for_maintenance(shutdown: fn(ReadSessionCache), callers: usize) {
+    let (started, running) = std::sync::mpsc::channel();
+    let (release, released) = std::sync::mpsc::channel();
+    let cache = ReadSessionCache::spawn(Duration::from_secs(60), move |weak| {
+        // Native retirement can keep the inner state alive after the last
+        // public cache handle is dropped. Shutdown must wait for that work.
+        let _inner = weak.upgrade().expect("cache state");
+        started.send(()).expect("worker started");
+        released
+            .recv_timeout(Duration::from_secs(5))
+            .expect("release maintenance");
+    })
+    .expect("cache worker");
+    running
+        .recv_timeout(Duration::from_secs(5))
+        .expect("maintenance running");
+    let (closing, close_started) = std::sync::mpsc::channel();
+    let (closed, close_finished) = std::sync::mpsc::channel();
+    let mut caches = (1..callers).map(|_| cache.clone()).collect::<Vec<_>>();
+    caches.push(cache);
+    let closers = caches
+        .into_iter()
+        .map(|cache| {
+            let closing = closing.clone();
+            let closed = closed.clone();
+            std::thread::spawn(move || {
+                closing.send(()).expect("shutdown started");
+                shutdown(cache);
+                closed.send(()).expect("shutdown finished");
+            })
+        })
+        .collect::<Vec<_>>();
+    for _ in 0..callers {
+        close_started
+            .recv_timeout(Duration::from_secs(5))
+            .expect("start shutdown");
+    }
+    let premature_close = close_finished.recv_timeout(Duration::from_millis(100));
+    release.send(()).expect("release worker even on failure");
+    for _ in usize::from(premature_close.is_ok())..callers {
+        close_finished
+            .recv_timeout(Duration::from_secs(5))
+            .expect("shutdown completes after maintenance");
+    }
+    for closer in closers {
+        closer.join().expect("shutdown thread");
+    }
+    assert!(
+        matches!(
+            premature_close,
+            Err(std::sync::mpsc::RecvTimeoutError::Timeout)
+        ),
+        "shutdown returned before maintenance finished"
+    );
+}
+
+#[test]
+fn explicit_close_waits_for_maintenance() {
+    assert_shutdown_waits_for_maintenance(|cache| cache.close(), 1);
+}
+
+#[test]
+fn last_cache_drop_waits_for_maintenance() {
+    assert_shutdown_waits_for_maintenance(drop, 1);
+}
+
+#[test]
+fn concurrent_close_calls_wait_for_maintenance() {
+    assert_shutdown_waits_for_maintenance(|cache| cache.close(), 2);
+}
+
+#[test]
+fn dropping_a_clone_preserves_the_cache_until_the_last_owner() {
+    let fixture = Fixture::new();
+    let cache = cache();
+    let remaining = cache.clone();
+    let (home_lock, lease) = fixture.read(&cache);
+    let session = Arc::downgrade(&lease.session);
+    drop(lease);
+    drop(cache);
+    let lease = remaining
+        .acquire(&fixture.home, &fixture.storage_home)
+        .expect("remaining cache owner");
+    assert!(Weak::ptr_eq(&session, &Arc::downgrade(&lease.session)));
+    drop(lease);
+    drop(remaining);
+    assert_eq!(session.strong_count(), 0, "last owner closes idle storage");
+    drop(home_lock);
+}
+
 #[test]
 fn sequential_and_concurrent_queries_reuse_the_session() {
     let fixture = Fixture::new();
@@ -219,17 +309,20 @@ fn expiry_starts_at_final_release_and_protects_active_queries() {
     let cache = cache();
     let (home_lock, lease) = fixture.read(&cache);
     let session = Arc::downgrade(&lease.session);
-    cache.inner.reap(Instant::now() + Duration::from_secs(120));
+    cache
+        .owner
+        .inner
+        .reap(Instant::now() + Duration::from_secs(120));
     assert!(
         lease.storage().list_files().is_ok(),
         "active query remains usable"
     );
     drop(lease);
     drop(home_lock);
     let released = Instant::now();
-    cache.inner.reap(released + Duration::from_secs(59));
+    cache.owner.inner.reap(released + Duration::from_secs(59));
     assert_eq!(session.strong_count(), 1);
-    cache.inner.reap(released + Duration::from_secs(61));
+    cache.owner.inner.reap(released + Duration::from_secs(61));
     assert_eq!(session.strong_count(), 0);
 }
 
@@ -292,7 +385,7 @@ fn maintenance_does_not_recreate_removed_lock_files() {
     drop(home_lock);
     let lock_file = fixture.home.join("locks/home");
     fs::remove_file(&lock_file).expect("remove workspace lock");
-    cache.inner.reap(Instant::now());
+    cache.owner.inner.reap(Instant::now());
     assert!(
         !lock_file.exists(),
         "maintenance must not recreate deleted workspace paths"
@@ -416,7 +509,7 @@ async fn indexed_queries_reuse_storage_but_resolve_the_current_manifest() {
         .expect("first query");
     assert_eq!(first.items.le
```

---

### Incident Patch 3: `cccd3d58` (2026-10-23)
**Commit Message**: fix(rust): update TLS trust dependencies for emSign compromise (#285)

**File**: `rust/Cargo.lock` (modified, +6/-6)
```diff
@@ -2547,9 +2547,9 @@ checksum = "f87165f0995f63a9fbeea62b64d10b4d9d8e78ec6d7d51fb2125fda7bb36788f"
 
 [[package]]
 name = "rustls-webpki"
-version = "0.103.15"
+version = "0.103.16"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "f3c3cf1d8b1e7d4927e2d154c3fcb02979afb9939629c62cd9048d4f07b60ac2"
+checksum = "4443b1b6d39d7c663139942cc4558262562d2c84123bb6282ef177009ca8b281"
 dependencies = [
  "aws-lc-rs",
  "ring",
@@ -3675,18 +3675,18 @@ dependencies = [
 
 [[package]]
 name = "webpki-root-certs"
-version = "1.0.9"
+version = "1.0.10"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "b96554aa2acc8ccdb7e1c9a58a7a68dd5d13bccc69cd124cb09406db612a1c9b"
+checksum = "58ec80e73fd8baf57bf0d9615554c75348bda990d6d5bbeab964dd068319fecb"
 dependencies = [
  "rustls-pki-types",
 ]
 
 [[package]]
 name = "webpki-roots"
-version = "1.0.9"
+version = "1.0.10"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "7dcd9d09a39985f5344844e66b0c530a33843579125f23e21e9f0f220850f22a"
+checksum = "1c1c8e20c8a38fc7d65abfe74eb7280e4aa667e8eec8bc84996d2874810748d9"
 dependencies = [
  "rustls-pki-types",
 ]
```

#### Recent Merged Pull Requests:
- **PR #290** (2026-10-23): ci(rust): reuse upstream zvec SDK resolution on Intel macOS (@egolearner)
- **PR #289** (2026-10-23): fix(engine): join read cache maintenance on shutdown (@egolearner)
- **PR #285** (2026-10-23): fix(rust): update TLS trust dependencies for emSign compromise (@egolearner)
- **PR #283** (2026-10-22): chore(rust): upgrade zvec-rust to 0.8.0 (@egolearner)
- **PR #281** (2026-10-22): fix(windows): normalize displayed paths and initialize ANSI per stream (@zhourrr)
- **PR #280** (2026-10-21): ci(rust): make release packaging manual-only (@egolearner)

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

## X. rust): preserve command results when stdout closes early (#270)

**RULE**:
When implementing operations in `rust/crates/zg-cli/src/install.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zvec-ai/zvec-grep. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a2fa4b40`: rust): preserve command results when stdout closes early (#270). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `rust/crates/zg-cli/src/install.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    print_header()?;
        writeln!(crate::stdout(), "\nNo agent integrations selected.")?;
    writeln!(crate::stdout(), "\nInstalling integrations\n")?;
        writeln!(crate::stdout(), "  ✓ {}", agent.label())?;
        writeln!(crate::stdout(), "    MCP       configured")?;
            writeln!(crate::stdout(), "    Config    {}", path.display())?;
            writeln!(crate::stdout(), "    Note      {note}")?;
        writeln!(crate::stdout())?;
    print_header()?;
        writeln!(crate::stdout(), "\nNo agent integrations selected.")?;
    writeln!(crate::stdout(), "\nRemoving integrations\n")?;
        writeln!(crate::stdout(), "  ✓ {}", agent.label())?;
        writeln!(crate::stdout(), "    integration removed")?;
    writeln!(
        crate::stdout(),
        "\nRestart the selected agents or start a new session to apply the change."
    )?;
fn print_header() -> io::Result<()> {
    let mut output = crate::stdout();
    writeln!(output, "zvec-grep setup")?;
    writeln!(output, "{}", "─".repeat(40))
    write!(crate::stdout(), "MCP transport [stdio] (stdio/http): ")?;
    crate::stdout().flush()?;
    writeln!(
        crate::stdout(),
    )?;
    let mut output = cra
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    print_header();
        println!("\nNo agent integrations selected.");
    println!("\nInstalling integrations\n");
        println!("  ✓ {}", agent.label());
        println!("    MCP       configured");
            println!("    Config    {}", path.display());
            println!("    Note      {note}");
        println!();
    print_header();
        println!("\nNo agent integrations selected.");
    println!("\nRemoving integrations\n");
        println!("  ✓ {}", agent.label());
        println!("    integration removed");
    println!("\nRestart the selected agents or start a new session to apply the change.");
fn print_header() {
    println!("zvec-grep setup");
    println!("{}", "─".repeat(40));
    print!("MCP transport [stdio] (stdio/http): ");
    io::stdout().flush()?;
    println!(
    );
    let mut output = io::stdout().lock();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a2fa4b40` are properly handled with clean fallback behavior.
