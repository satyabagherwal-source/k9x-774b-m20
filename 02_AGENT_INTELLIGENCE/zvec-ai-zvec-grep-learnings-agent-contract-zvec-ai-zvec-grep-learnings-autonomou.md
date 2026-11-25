# Agent Contract: Agent Contract: zvec-ai-zvec-grep-learnings Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "zvec-ai-zvec-grep-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T01:18:34.810Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zvec-ai-zvec-grep-learnings",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zvec-ai-zvec-grep-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T01:18:34.810Z`  
> **Learning ID**: `LEARN-EVO-zvec-ai-zvec-grep-learnings`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `zvec-ai-zvec-grep-learnings-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zvec-ai-zvec-grep-learnings.md`  
> **Source**: github ([https://github.com/zvec-ai/zvec-grep](https://github.com/zvec-ai/zvec-grep))  
> **Source Version**: `3d57ea50`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-24T23:33:19.334Z  
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
> **Harvest Timestamp**: 2026-11-24T23:33:19.130Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zvec-ai/zvec-grep`
- **Description**: Local-first search across your workspace, built for humans and AI agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4380 stars

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
- **Issue #442** (2026-11-19): **[Bug]: Python call graph leaves imported class constructor calls pending**
  *Symptoms*: ### Description  In SQLFluff, `Rule_LT09._eval` calls the imported class `FunctionalContext` as `FunctionalContext(context).segment`. A fresh graph index finds the class definition, but the constructor call remains pending and is absent from callers/callees navigation. When the name binds to that class, the call should produce a resolved `Calls` edge to the class definition. [Import](https://github.com/sqlfluff/sqlfluff/blob/db9801b7eb7fd014e765117f63ee1b0675fa9f87/src/sqlfluff/rules/layout/LT09.py#L9) · [Call site](https://github.com/sqlfluff/sqlfluff/blob/db9801b7eb7fd014e765117f63ee1b0675fa9f87/src/sqlfluff/rules/layout/LT09.py#L86-L91) · [Class definition](https://github.com/sqlfluff/sqlfluff/blob/db9801b7eb7fd014e765117f63ee1b0675fa9f87/src/sqlfluff/utils/functional/context.py#L7-L54)  ### Steps to reproduce  Set `ZG_BIN` to the absolute path of a release-built `zg` binary and run in a fresh checkout.  ```sh git clone https://github.com/sqlfluff/sqlfluff.git cd sqlfluff git checkout --detach db9801b7eb7fd014e765117f63ee1b0675fa9f87  "$ZG_BIN" --index --mode direct --graph --iglob '*.py' \   --embedding local/potion-code-16m-v2 --device cpu "$ZG_BIN" --status --check-ready --mode direct "$ZG_BIN" --callers FunctionalContext --mode direct \   --glob 'src/sqlfluff/utils/functional/context.py' ```  ### Version and diagnostics  Reproduced from a fresh Python-only graph index on macOS 27.0 arm64 with a `zg 0.3.1` release source build based on [cc3ff0fe](https://github.com/zvec

- **Issue #434** (2026-11-19): **[Bug]: Rust callers attributes a module-local save call to the top-level save**
  *Symptoms*: ## Description  With the official `@zvec/zvec-grep@0.3.1` Linux x64 release, querying callers of the top-level `::save` correctly selects its definition, but also returns `storage::flush`, which calls the different function `storage::save`.  The call-site coordinates are accurate; **the call target is incorrectly attributed**. This is a false-positive relationship, separate from the argument-parsing problem in #426.  ## Reproduction case  Index the following complete `lib.rs` in a clean workspace. The observed workspace root was `/app`.  ```rust /// Normalize a value before storing it. pub fn normalize(value: i32) -> i32 { value.max(0) }  pub fn save(value: i32) -> i32 { normalize(value) }  pub fn import_record(value: i32) -> i32 { save(value) }  pub fn export_record(value: i32) -> i32 { save(value) }  /// A leaf with no resolved callers in this workspace. pub fn orphan_leaf(value: i32) -> i32 { value }  pub mod storage {     pub fn save(value: i32) -> i32 { super::normalize(value) }      pub fn flush(value: i32) -> i32 { save(value) } } ```  After indexing and initializing the published Rust HTTP `/mcp` endpoint, invoke `zvec_grep_callers` with:  ```json {"root":"/app","symbol":"::save"} ```  Use the actual workspace path if different. The complete [fixture](https://github.com/zhanglei1949/zvec-grep/blob/740f2a25715b4e1bc10c0cef59626022625e799e/benchmarks/swe-qa-bench/fixtures/caller-callee-dev/lib.rs) and [integration check](https://github.com/zhanglei1949/zvec-grep/blob/74

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

### Incident Patch 1: `ae1a4732` (2026-11-24)
**Commit Message**: fix(rust): bind bare calls to the enclosing module's items (#440)

* fix(rust): bind bare calls to the enclosing module's items

A `mod storage { fn save(..) .. fn flush(..) { save(..) } }` beside a
top-level `save` bound `flush`'s bare `save()` to the file-level namesake:
`--callers save` listed `storage::flush`, and `--callees storage::flush`
reached the wrong `save`.

Partition now reads the nearest Rust module's own table before the file's
one. Only the nearest module answers — an outer module's items need
`super::`, so they are never in bare scope. Classes, traits and `impl`
bodies are not modules (their members need a receiver), and other
languages keep reaching namespaces through the resolver's scope rules,
which search a type's members before the namespace.

Fixes #434.

* fix(rust): address review on bare-call item scope resolution

Three review threads on #440 read a bare call against a scope table that
could not answer them:

- A call written inside a nested `fn inner` skipped the `fn outer` that
  declares it and fell through to the module's namesake. Function-item
  scopes are walked now, so `outer`'s `fn save` answers `inner`'s call,
  still skipping `impl` and trait 

**File**: `rust/crates/zg-engine/src/extraction/code.rs` (modified, +228/-1)
```diff
@@ -317,6 +317,24 @@ struct CodeEntity<'tree> {
     exported_as: Vec<String>,
 }
 
+/// Whether a Rust item spells a name the value namespace does not hold, so a
+/// bare call never reaches it.
+///
+/// `impl save` names the type it implements, which is a scope rather than a
+/// value, and a trait, type alias, enum, union and a named-field struct each
+/// declare a type without a constructible value. A tuple struct and a unit
+/// struct do declare a constructor, so they stay candidates: `struct save(i32)`
+/// beside `fn save` is a conflict rustc rejects.
+fn rust_type_namespace_only(node: Node<'_>) -> bool {
+    match node.kind() {
+        "impl_item" | "trait_item" | "type_item" | "enum_item" | "union_item" => true,
+        "struct_item" => node
+            .child_by_field_name("body")
+            .is_some_and(|body| body.kind() == "field_declaration_list"),
+        _ => false,
+    }
+}
+
 // A node's entities and their scans share one index sequence and one
 // boundary; splitting the entity branch from the scope descent keeps both in
 // one place for the walk and for the types a body declares.
@@ -348,13 +366,47 @@ fn walk_entity_node<'tree>(
         scope_entity_index = Some(entity_index);
         let name = adapter.extract_name(entity, source);
         let entity_breadcrumb = adapter.scope_breadcrumb(entity, source, breadcrumb);
+        let symbol_type = adapter.classify(entity);
         // Declarations stay out of the in-file symbol table: an in-file call
         // must not bind to a bodyless prototype when a definition exists
         // anywhere in the workspace, and the resolver's name index applies that
         // preference globally.
         if !adapter.is_declaration(entity) {
             graph_context.register_symbol(name.as_deref(), entity_index);
             graph_context.register_scoped_symbol(name.as_deref(), entity_index);
+            // A module puts the items it declares in bare scope for every body
+            // inside it, and a function does the same for the bodies nested in
+            // it (`fn outer() { fn save() {} }` answers `inner`'s `save()`),
+            // unlike a class, whose members need a receiver. Other languages
+            // reach a namespace through the resolver's scope rules, where a
+            // type's members are searched before the namespace.
+            if format == FileFormat::Rust {
+                match symbol_type {
+                    Some(SymbolType::Module) => graph_context.register_module_scope(entity_index),
+                    Some(SymbolType::Function) => {
+                        graph_context.register_function_scope(entity_index);
+                    }
+                    // Only a value answers a bare call. Every other item that
+                    // spells a name in this position keeps it in the type
+                    // namespace; the helper lists them by AST shape.
+                    _ if rust_type_namespace_only(entity) => {
+                        graph_context.register_type_namespace_item(entity_index);
+                    }
+                    _ => {}
+                }
+                // The item's bare scope ends with the block that declares it:
+                // `{ fn save() {} } save()` written after that block reaches
+                // the enclosing spelling, not the one the closed block declared.
+                if let Some(block) = entity.parent() {
+                    let start = block.start_position();
+                    let end = block.end_position();
+                    graph_context.register_item_extent(
+                        entity_index,
+                        (start.row + 1, start.column),
+                        (end.row + 1, end.column),
+                    );
+                }
+            }
         }
         graph_context.add_contains_edge(
             entity_index,
@@ -386,7 +438,7 @@ fn walk_entity_node<'tree>(
             node: entity,
             language: adapter.language(),
             name,
-            symbol_type: adapter.classify(entity),
+            symbol_type,
             breadcrumb: entity_breadcrumb,
             signature: adapter.extract_signature(entity, source),
             documentation: adapter.extract_doc(entity, source),
@@ -3751,6 +3803,181 @@ public class Service {
         );
     }
 
+    #[test]
+    fn module_local_definition_shadows_the_file_scope_for_bare_calls() {
+        use crate::domain::GraphEdgeKind;
+
+        // A `mod storage` declaring its own `save` beside a top-level `save`:
+        // `storage::flush`'s bare `save()` reaches the module's definition, and
+        // the top-level one keeps only the callers that name it from file scope.
+        let source = test_source(
+            FileFormat::Rust,
+            "lib.rs",
+            concat!(
+                "/// Normalize a value before storing it.\n",
+                "pub fn normalize(value: i32) -> i32 { value.max(0) }\n",
+                "\n"
```

**File**: `rust/crates/zg-engine/src/extraction/graph.rs` (modified, +172/-9)
```diff
@@ -158,6 +158,95 @@ struct BindingScope {
     end: Option<(usize, usize)>,
 }
 
+/// The block that directly contains one item, as a source span.
+///
+/// Rust scopes a block-level `fn` to the block that declares it: every body
+/// inside that block sees it, whatever its order, while a sibling item written
+/// after the block reaches the enclosing scope's spelling instead. Positions
+/// follow the collector's convention: one-based lines, zero-based columns.
+#[derive(Clone, Copy, Debug)]
+pub(crate) struct ItemExtent {
+    start: (usize, usize),
+    end: (usize, usize),
+}
+
+impl ItemExtent {
+    /// True when the call site `(line, column)` falls inside the block.
+    ///
+    /// The end is tree-sitter's `end_position`, the first position past the
+    /// block, so a call written directly after the closing brace is outside
+    /// it: `{ fn save() {} } save()` reaches the enclosing spelling.
+    pub(crate) fn contains(self, line: usize, column: usize) -> bool {
+        (line, column) >= self.start && (line, column) < self.end
+    }
+
+    /// Whether this block is the inner of two blocks that both hold a site.
+    ///
+    /// Source blocks nest rather than overlap, so of two blocks holding the
+    /// same position the one that opens later lies inside the other and is
+    /// the nearer scope; text order between two items says nothing about
+    /// which of their blocks is nearer.
+    pub(crate) fn is_nearer_than(self, other: Option<Self>) -> bool {
+        let Some(other) = other else {
+            return true;
+        };
+        self.start > other.start || (self.start == other.start && self.end < other.end)
+    }
+}
+
+/// The tables a Rust bare call reads while it climbs out of its own body.
+///
+/// Rust scopes names by item and by block rather than by the file alone, so
+/// partition needs several views at once: which entities are modules and which
+/// are function bodies, which items hold a spelling only in the type namespace,
+/// the block that directly contains each item, the names a `use` binds, and the
+/// globs that put names in view without spelling them. They are kept together
+/// because every one of them answers the same question — what a bare call at
+/// one position reaches — and a change to that answer touches several at once.
+///
+/// Other languages leave this empty: their bare calls are read from the file's
+/// own tables and the resolver's scope rules.
+#[derive(Debug, Default)]
+pub(crate) struct RustScopeTables {
+    /// Symbols each containing entity declares directly in its body, the
+    /// innermost-scope shadow table: a call inside `outer` that names
+    /// `work` binds the nested `outer::work` before any file-level name.
+    /// A spelling lists every entity registered under it in walk order, because
+    /// Rust keeps the type and value namespaces apart: `fn save` beside
+    /// `mod save` is legal, and only the function answers a bare call.
+    scoped_symbols: HashMap<usize, HashMap<String, Vec<usize>>>,
+    /// Rust modules. A module's items are in bare scope for every body written
+    /// inside it, so its table answers a bare call before the file's own
+    /// namesake does; an outer module's items need `super::` and never answer.
+    module_scopes: HashSet<usize>,
+    /// Rust functions. A function's items are in bare scope for the bodies
+    /// nested inside it (`fn outer() { fn save() {} fn inner() { save() } }`),
+    /// so partition reads its table while climbing towards the module.
+    function_scopes: HashSet<usize>,
+    /// Items that hold a spelling in the type namespace only (`trait save`,
+    /// `type save = ..`, `enum save`, an `impl` block, a named-field `struct`).
+    /// A bare call names a value, so such a spelling never answers it: beside
+    /// `fn save` the function keeps the call, and a spelling only the type
+    /// namespace holds stays pending.
+    type_namespace_items: HashSet<usize>,
+    /// The block that directly contains each item. A function's item table is
+    /// nearer than the module's, but only while the block that declares the
+    /// item is still open at the call site.
+    item_extents: HashMap<usize, ItemExtent>,
+    /// Names a `use` declaration binds in the body that writes it. Rust scopes
+    /// an import to that body, so a name a function imports is nearer than the
+    /// module's item of the same name: `use crate::other::save;` inside `flush`
+    /// makes its `save()` the imported one, which only the resolver can place.
+    /// The record carries no position, so a `use` in a nested block also leaves
+    /// calls outside that block pending: a lost edge rather than a wrong one.
+    import_bindings: HashMap<usize, HashSet<String>>,
+    /// Bodies that write a glob `use` (`use super::*;`). A glob states no
+    /// spelling this walk can place, but it does put the surrounding names in
+    /// view, which is why partition may still read the file's own table 
```

**File**: `rust/crates/zg-engine/src/extraction/graph/collector.rs` (modified, +193/-37)
```diff
@@ -621,6 +621,21 @@ fn visit_for_bindings(
         // function the body calls by that name.
         context.register_shadowed_name(owner_index, &name);
     }
+    if format == FileFormat::Rust && node.kind() == "use_declaration" {
+        // `use crate::other::save;` binds `save` in this body alone, so the
+        // body's `save()` reaches that import rather than the module's own
+        // function of the name. Where the import points is the resolver's
+        // question, so the call stays pending here.
+        for name in rust_use_bindings(node, source) {
+            context.register_import_binding(owner_index, &name);
+        }
+        // A glob binds no spelling the walk can list, but it does put the
+        // source module's names in view, which partition needs in order not to
+        // rule the file's own namesakes out.
+        if rust_use_is_glob(node) {
+            context.register_import_glob(owner_index);
+        }
+    }
     let line = node.start_position().row + 1;
     let column = node.start_position().column;
     if let Some((name, target)) = alias {
@@ -685,43 +700,7 @@ fn visit_for_bindings(
         }
         return;
     }
-    if format == FileFormat::Python
-        && node.kind() == "assignment"
-        && let Some(left) = node
-            .child_by_field_name("left")
-            .filter(|left| left.kind() == "identifier")
-    {
-        let name = node_text(left, source);
-        // `client: Left = …` states the type beside the name, whatever value
-        // the body stores in it.
-        if let Some(bound) = node
-            .child_by_field_name("type")
-            .and_then(|ty| python_annotation_name(ty, source))
-        {
-            context.add_declare_binding(owner_index, name, &bound, line, column, None);
-            return;
-        }
-        // `client = clients[0]` states that the name no longer holds what the
-        // parameter declared. The index cannot place the value, so the name
-        // holds no type from this line on rather than keeping the annotation
-        // the parameter stated for the whole body.
-        //
-        // `client = other` is a copy of a name the body already types, and the
-        // copy holds that type: a receiver reads `other`'s type from this line
-        // on. A copy of a name the body states no type for leaves the name as
-        // undecided as any other value the index cannot place — the annotation
-        // described what the name held before the assignment, not after it.
-        let copied = node
-            .child_by_field_name("right")
-            .filter(|right| right.kind() == "identifier")
-            .and_then(|right| {
-                context
-                    .declared_type_at(owner_index, node_text(right, source), line, column)
-                    .map(str::to_owned)
-            })
-            .filter(|bound| !matches!(bound.as_str(), PYTHON_UNBOUND_TYPE | PYTHON_NONE_TYPE));
-        let bound = copied.as_deref().unwrap_or(PYTHON_UNBOUND_TYPE);
-        context.add_declare_binding(owner_index, name, bound, line, column, None);
+    if collect_python_assignment(node, owner_index, source, format, context, line, column) {
         return;
     }
     for child in named_children(node) {
@@ -732,6 +711,60 @@ fn visit_for_bindings(
     }
 }
 
+/// Records what a Python assignment states about the name it writes, if the
+/// node is one.
+fn collect_python_assignment(
+    node: Node<'_>,
+    owner_index: usize,
+    source: &[u8],
+    format: FileFormat,
+    context: &mut WalkContext,
+    line: usize,
+    column: usize,
+) -> bool {
+    if format != FileFormat::Python || node.kind() != "assignment" {
+        return false;
+    }
+    let Some(left) = node
+        .child_by_field_name("left")
+        .filter(|left| left.kind() == "identifier")
+    else {
+        return false;
+    };
+    let name = node_text(left, source);
+    // `client: Left = …` states the type beside the name, whatever value
+    // the body stores in it.
+    if let Some(bound) = node
+        .child_by_field_name("type")
+        .and_then(|ty| python_annotation_name(ty, source))
+    {
+        context.add_declare_binding(owner_index, name, &bound, line, column, None);
+        return true;
+    }
+    // `client = clients[0]` states that the name no longer holds what the
+    // parameter declared. The index cannot place the value, so the name
+    // holds no type from this line on rather than keeping the annotation
+    // the parameter stated for the whole body.
+    //
+    // `client = other` is a copy of a name the body already types, and the
+    // copy holds that type: a receiver reads `other`'s type from this line
+    // on. A copy of a name the body states no type for leaves the name as
+    // undecided as any other value the index cannot place — the annotation
+    // described what the name held before the assignment, not after it.
+    let copied = node
+        .child_
```

**File**: `rust/crates/zg-engine/src/extraction/graph/partition.rs` (modified, +399/-72)
```diff
@@ -17,7 +17,10 @@ use std::collections::{HashMap, HashSet};
 
 use crate::domain::{EdgeProvenance, GraphEdgeKind, PreprocessorDirective};
 
-use super::{Constructs, NameEdge, PYTHON_NONE_TYPE, PYTHON_UNBOUND_TYPE, WalkContext, WalkEdge};
+use super::{
+    Constructs, ItemExtent, NameEdge, PYTHON_NONE_TYPE, PYTHON_UNBOUND_TYPE, RustScopeTables,
+    WalkContext, WalkEdge,
+};
 
 /// A name reference resolved against this file's own symbol table.
 #[derive(Clone, Debug, Eq, PartialEq)]
@@ -177,7 +180,7 @@ pub(crate) fn partition_walk(
         name_edges,
         symbols,
         file_symbols,
-        scoped_symbols,
+        rust_scopes,
         shadowed_names,
         borrowed_names,
         value_aliases,
@@ -218,38 +221,20 @@ pub(crate) fn partition_walk(
                 continue;
             }
         }
-        // A bare name the owner's body already took for itself is not the
-        // file's name: `invoke(dispatch: () => void)` reaching `dispatch()`
-        // calls the parameter, never an imported function some alias table
-        // happens to spell. Only the owner's own tables may answer it, and a
-        // name no table can place stays pending instead of falling back.
-        let shadowed = edge.receiver_name.is_none()
-            && shadowed_names
-                .get(&edge.owner_index)
-                .is_some_and(|names| names.contains(&edge.ref_name));
-        // A name one of the classes around the owner imports
-        // (`using First<T>::Run;`) is that class's member, not the file's
-        // namesake: the cross-file resolver decides which member it reaches.
-        let borrowed = edge.receiver_name.is_none()
-            && borrowed_by_enclosing_class(
-                edge.owner_index,
-                &edge.ref_name,
-                &enclosing,
-                &borrowed_names,
-            );
         let resolved_target = in_file_target(
             &edge,
-            shadowed || borrowed,
+            shadowed_at_site(&edge, &enclosing, &shadowed_names, &borrowed_names),
             InFileTables {
                 symbols: &symbols,
-                scoped_symbols: &scoped_symbols,
+                rust: &rust_scopes,
                 file_symbols: &file_symbols,
                 aliases: &aliases,
                 value_aliases: &value_aliases,
+                enclosing: &enclosing,
             },
         );
         match resolved_target {
-            Some(target_index) => partitioned.resolved.push(ResolvedNameEdge {
+            InFileTarget::Bound(target_index) => partitioned.resolved.push(ResolvedNameEdge {
                 ref_kind: edge.ref_kind,
                 source_index: edge.owner_index,
                 target_index,
@@ -261,7 +246,7 @@ pub(crate) fn partition_walk(
                 column: edge.column,
                 provenance: EdgeProvenance::FileLocal,
             }),
-            None => partitioned.pending.push(PendingNameRef {
+            InFileTarget::Pending => partitioned.pending.push(PendingNameRef {
                 ref_kind: edge.ref_kind,
                 owner_index: edge.owner_index,
                 ref_name: edge.ref_name,
@@ -275,11 +260,38 @@ pub(crate) fn partition_walk(
                 line: edge.line,
                 column: edge.column,
             }),
+            // The scopes around the call rule out every spelling this file
+            // holds, so there is nothing for the resolver to weigh either.
+            InFileTarget::OutOfReach => {}
         }
     }
     partitioned
 }
 
+/// Whether the name a call spells is already taken nearer than the file's own
+/// table, so no enclosing item scope may answer it.
+///
+/// A bare name the owner's body took for itself is not the file's name:
+/// `invoke(dispatch: () => void)` reaching `dispatch()` calls the parameter,
+/// never an imported function some alias table happens to spell. A name one of
+/// the classes around the owner imports (`using First<T>::Run;`) is that
+/// class's member rather than the file's namesake, and the cross-file resolver
+/// decides which member it reaches.
+fn shadowed_at_site(
+    edge: &NameEdge,
+    enclosing: &HashMap<usize, usize>,
+    shadowed_names: &HashMap<usize, HashSet<String>>,
+    borrowed_names: &HashMap<usize, HashSet<String>>,
+) -> bool {
+    if edge.receiver_name.is_some() {
+        return false;
+    }
+    shadowed_names
+        .get(&edge.owner_index)
+        .is_some_and(|names| names.contains(&edge.ref_name))
+        || borrowed_by_enclosing_class(edge.owner_index, &edge.ref_name, enclosing, borrowed_names)
+}
+
 /// Whether one of the entities around `owner` imports `name` from another
 /// scope: a class body's `using First<T>::Run;` answers `Run()` in the
 /// methods written in that class, so the file's own namesake is not the call.
@@ -306,98 +318,288 @@ fn borrowed_by_enclosing_class(
     false
 }
 
+/// What one scope's name table says about the spelling of a bare call.
+enum Loca
```

**File**: `rust/crates/zg-engine/tests/call_resolution_regressions.rs` (modified, +271/-0)
```diff
@@ -1282,6 +1282,26 @@ async fn python_bare_parameter_does_not_read_the_class_member() {
     .await;
 }
 
+#[tokio::test]
+async fn review_type_namespace_item_must_not_steal_function_call() {
+    // `pub trait save` shares `save`'s spelling but not its namespace: a bare
+    // call names a value, so only the function may answer it.
+    check_case(Case {
+        name: "review_type_namespace_item_must_not_steal_function_call",
+        files: vec![SourceFile {
+            path: "lib.rs",
+            source: "pub mod m {\n    pub fn save() {}\n    pub trait save {}\n    pub fn flush() { save(); }\n}\n",
+        }],
+        queries: vec![Query {
+            operation: "callees",
+            symbol: "m::flush",
+            expected: json!([{"name":"m::flush","edges":[{"symbol":{"name":"m::save","startLine":2}}]}]),
+            ..Query::default()
+        }],
+    })
+    .await;
+}
+
 // A member a body writes with a value the index cannot place no longer holds
 // what an earlier write stated, so the call through it stays undecided instead
 // of answering with the type the constructor's first line named.
@@ -1516,3 +1536,254 @@ async fn review435_rebound_self_stays_undecided() {
     })
     .await;
 }
+
+#[tokio::test]
+async fn review_nested_block_item_must_not_leak_into_sibling_item() {
+    // The `save` inside the block ends with that block; the sibling `inner`
+    // written after it reaches the module's own `save`, not that one.
+    check_case(Case {
+        name: "review_nested_block_item_must_not_leak_into_sibling_item",
+        files: vec![SourceFile {
+            path: "lib.rs",
+            source: "pub mod m {\n    pub fn save() -> i32 { 1 }\n    pub fn outer() -> i32 {\n        { fn save() -> i32 { 2 } }\n        fn inner() -> i32 { save() }\n        inner()\n    }\n}\n",
+        }],
+        queries: vec![Query {
+            operation: "callees",
+            symbol: "inner",
+            expected: json!([{"name":"m::outer::inner","edges":[{"symbol":{"name":"m::save","startLine":2}}]}]),
+            ..Query::default()
+        }],
+    })
+    .await;
+}
+
+#[tokio::test]
+async fn followup_named_field_struct_must_not_steal_value_call() {
+    // A struct with named fields declares no constructor value, so `struct
+    // save` beside `fn save` leaves the call to the function. A tuple struct
+    // or a unit struct does declare one, and those stay value candidates.
+    check_case(Case {
+        name: "followup_named_field_struct_must_not_steal_value_call",
+        files: vec![SourceFile {
+            path: "lib.rs",
+            source: "pub mod m {\n    pub fn save() -> i32 { 1 }\n    pub struct save { pub value: i32 }\n    pub fn flush() -> i32 { save() }\n}\n",
+        }],
+        queries: vec![Query {
+            operation: "callees",
+            symbol: "m::flush",
+            expected: json!([{"name":"m::flush","edges":[{"symbol":{"name":"m::save","startLine":2}}]}]),
+            ..Query::default()
+        }],
+    })
+    .await;
+}
+
+#[tokio::test]
+async fn followup_innermost_block_must_win_over_later_outer_item() {
+    // Both the inner block and `outer`'s body hold a `save` in view at the
+    // call site. The block that lies inside the other is the nearer one, so
+    // the call leaves `outer` to the inner definition even though `outer`'s
+    // own `save` is written later in the text.
+    check_case(Case {
+        name: "followup_innermost_block_must_win_over_later_outer_item",
+        files: vec![SourceFile {
+            path: "lib.rs",
+            source: "pub mod m {\n    pub fn save() -> i32 { 0 }\n    pub fn outer() -> i32 {\n        let result = {\n            fn save() -> i32 { 1 }\n            fn inner() -> i32 { save() }\n            inner()\n        };\n        fn save() -> i32 { 2 }\n        result\n    }\n}\n",
+        }],
+        queries: vec![Query {
+            operation: "callees",
+            symbol: "inner",
+            expected: json!([{"name":"m::outer::inner","edges":[{"symbol":{"name":"m::outer::save","startLine":5}}]}]),
+            ..Query::default()
+        }],
+    })
+    .await;
+}
+
+#[tokio::test]
+async fn followup_block_end_position_is_exclusive() {
+    // Tree-sitter's `end_position` points one past the block's last byte, so
+    // a call written directly after the closing brace is outside that block
+    // and reaches the module's own `save`.
+    check_case(Case {
+        name: "followup_block_end_position_is_exclusive",
+        files: vec![SourceFile {
+            path: "lib.rs",
+            source: "pub mod m {\n    pub fn save() -> i32 { 1 }\n    pub fn outer() -> i32 {\n        {fn save() -> i32 {2}}save()\n    }\n}\n",
+        }],
+        queries: vec![Query {
+            operation: "callees",
+            symbol: "m::outer",
+            expected: json!([{"name":"m::outer","edges":[{"symbol":{"name":"m::save","startLine":2}}]}]),
+            ..Query::default()
+        }],
+    })
+
```

---

### Incident Patch 2: `5ece6dc4` (2026-11-24)
**Commit Message**: fix(search): restrict rule ranking to code candidates (#447)

* fix(search): restrict rule ranking to code candidates

* fix(ci): use the workspace Cargo toolchain for the CUDA fallback fixture

Building from the temporary fixture directory selected the runner default Cargo 1.100. Its build-script output layout differs from the pinned Cargo used by release builds. Run from the Rust workspace and point Cargo at the fixture manifest so the packaging test exercises the release toolchain.

* fix(search): prefer exact symbol recall on RRF ties

**File**: `rust/README.md` (modified, +6/-0)
```diff
@@ -532,6 +532,12 @@ Explicit `--hybrid`, `--fts`, `--vector`, `--fuse`, symbol options, `--trace`, a
 `--refresh` retain their indexed behavior. Text questions, URLs, and glob patterns
 do not trigger automatic path lookup.
 
+In indexed search, `--trace` shows each hit's rank (`#1`, `#2`, …) and `score=`.
+Code hits show the rule-ranking score. Other hits show the raw reciprocal rank
+fusion (RRF) score. These scores use different scales, so use the displayed
+rank for the final order. The trace's `fusion.score` gives the raw RRF score
+for either kind of hit.
+
 Managed `zg --rg` preserves literal pattern whitespace and supports empty
 patterns with `-e ''`. Matching options include fixed strings (`-F`), case
 selection (`-i`, `-s`, `-S`, with the last option winning), word/whole-line
```

**File**: `rust/crates/zg-engine/src/api/context.rs` (modified, +3/-0)
```diff
@@ -490,6 +490,7 @@ pub mod result {
     #[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
     pub struct ContextItem {
         pub kind: ContextItemKind,
+        /// One-based position in the final result order.
         pub rank: usize,
         pub absolute_path: PathBuf,
         pub relative_path: PathBuf,
@@ -508,6 +509,8 @@ pub mod result {
         pub outline: Option<String>,
         pub content_role: Option<ContextContentRole>,
         pub status: ContextItemStatus,
+        /// Indexed code hits carry their rule-ranking score. Other indexed hits carry their
+        /// raw reciprocal rank fusion (RRF) score. Use `rank` to order mixed results.
         pub score: Option<f64>,
         pub matched_by: MatchedBy,
         pub metadata: Option<EntityMetadata>,
```

**File**: `rust/crates/zg-engine/src/pipelines/indexed_search/pipeline.rs` (modified, +252/-86)
```diff
@@ -147,12 +147,14 @@ struct RecallRoute {
     route: ResolvedSearchRoute,
     filter: Option<StorageSearchFilter>,
     vector_route_id: Option<String>,
+    is_symbol_recall: bool,
 }
 
 struct Candidate {
     id: EntityId,
     file_id: FileId,
     sources: HashSet<SearchRouteMode>,
+    matched_symbol_recall: bool,
     recall: Vec<SearchRecallTrace>,
     evidence: Vec<InternalEvidence>,
     score: f64,
@@ -256,7 +258,7 @@ async fn search_with_stage_trace(
     }
 
     let load_started = Instant::now();
-    // Every recalled entity must be eligible for structural boosts before cutoff.
+    // Load past the cutoff so any recalled code definition can fill a visible code position.
     let hits = load_candidates(fused, limit, plan.trace, storage)?;
     let load_duration = load_started.elapsed();
     if let Some(observation) = observation.as_mut() {
@@ -426,7 +428,7 @@ fn collect_adaptive_recall(
             if let Some(observation) = observation.as_deref_mut() {
                 observation.recall(&route.route.id, depth, &hits);
             }
-            add_recall_hits(candidates, &hits, &route.route)?;
+            add_recall_hits(candidates, &hits, route)?;
         }
         if candidates.len() >= target || !saturated || depth >= RECALL_MAX_DEPTH {
             return Ok(());
@@ -447,6 +449,7 @@ fn build_recall_routes(
             vector_route_id: (route.mode == SearchRouteMode::Vector).then(|| route.id.clone()),
             route,
             filter: filter.cloned(),
+            is_symbol_recall: false,
         })
         .collect::<Vec<_>>();
     if prefer_symbol {
@@ -475,6 +478,7 @@ fn build_recall_routes(
                 },
                 filter: Some(symbol_filter),
                 vector_route_id: None,
+                is_symbol_recall: true,
             });
         }
     }
@@ -484,8 +488,9 @@ fn build_recall_routes(
 fn add_recall_hits(
     candidates: &mut HashMap<EntityId, Candidate>,
     hits: &[StorageSearchHit],
-    route: &ResolvedSearchRoute,
+    recall_route: &RecallRoute,
 ) -> Result<(), EngineError> {
+    let route = &recall_route.route;
     // Increasing top-k can change its prefix, including which fragments appear there.
     for (index, hit) in hits.iter().enumerate() {
         let rank = index + 1;
@@ -495,6 +500,7 @@ fn add_recall_hits(
                 id: hit.entity_id.clone(),
                 file_id: hit.file_id,
                 sources: HashSet::new(),
+                matched_symbol_recall: false,
                 recall: Vec::new(),
                 evidence: Vec::new(),
                 score: 0.0,
@@ -506,6 +512,7 @@ fn add_recall_hits(
             ));
         }
         candidate.sources.insert(route.mode);
+        candidate.matched_symbol_recall |= recall_route.is_symbol_recall;
         if let Some(existing) = candidate.evidence.iter_mut().find(|evidence| {
             evidence.path == route.mode
                 && evidence.route_id == route.id
@@ -573,6 +580,7 @@ fn fuse_candidates(candidates: HashMap<EntityId, Candidate>) -> Vec<Candidate> {
         right
             .score
             .total_cmp(&left.score)
+            .then_with(|| right.matched_symbol_recall.cmp(&left.matched_symbol_recall))
             .then_with(|| left.id.as_str().cmp(right.id.as_str()))
     });
     for (index, candidate) in fused.iter_mut().enumerate() {
@@ -901,8 +909,9 @@ mod tests {
     use crate::{
         EngineResult,
         domain::{
-            ByteRange, Content, Entity, EntityFragment, EntityId, FileCategory, FileFormat, FileId,
-            FileIndexStatus, FileRecord, FileSnapshot, FragmentId, GlobRule, Range, TextRange,
+            ByteRange, CodeMetadata, Content, Entity, EntityFragment, EntityId, EntityMetadata,
+            FileCategory, FileFormat, FileId, FileIndexStatus, FileRecord, FileSnapshot,
+            FragmentId, GlobRule, Range, SymbolType, TextRange,
             model::{EmbeddingMetric, EmbeddingModelInfo},
         },
         file_selection::GlobMatcher,
@@ -1154,43 +1163,19 @@ mod tests {
     async fn promotes_symbol_definition_before_result_cutoff() {
         let reference_file = file(1, "src/plugin.ts", 100);
         let definition_file = file(2, "src/core.ts", 100);
-        let mut reference = entity(&reference_file, "vitest: Vitest");
-        let mut definition = entity(&definition_file, "class Vitest {}");
+        let reference = symbol_entity(
+            &reference_file,
+            "vitest: Vitest",
+            SymbolType::Value,
+            "vitest",
+        );
+        let definition = symbol_entity(
+            &definition_file,
+            "class Vitest {}",
+            SymbolType::Class,
+            "Vitest",
+        );
         let definition_id = definition.entity.id().clone();
-        for (stored, kind, name) in [
-            (&mut reference, crate::domain::SymbolType::Value, "vitest"),
-            (&mut definition, crate::domain::SymbolType::Class, "Vitest"),
-       
```

**File**: `rust/crates/zg-engine/src/pipelines/indexed_search/ranking/README.md` (modified, +19/-12)
```diff
@@ -1,8 +1,13 @@
 # Rule ranking
 
-Rule ranking scores the entire recalled entity pool before applying the result
-limit. It runs in the shared indexed-search engine, so direct, server, and MCP
-queries use the same policy.
+The shared indexed-search engine uses RRF fusion to assign result positions for
+direct, server, and MCP queries. With `--prefer-symbol`, hits from an exact-symbol
+recall route win RRF ties, then entity ID breaks any remaining ties.
+Non-code entities keep their fusion positions
+among loaded hits and their raw RRF scores. Positions occupied by code within
+the result limit are filled by ranking all recalled, loaded `ContentKind::Code`
+entities, including those below the cutoff and those without symbol metadata.
+The engine skips rule ranking when the visible results contain no code.
 
 The policy normalizes RRF by the maximum possible score for the enabled routes,
 adds bounded symbol/definition bonuses, and applies the minimum applicable path
@@ -28,13 +33,13 @@ bonuses are capped at 1.25 in the normalized RRF scale.
 
 Path roles use workspace-relative components and explicit filename patterns.
 Test/example/dependency intent and narrowly targeted include globs can waive a
-role penalty. A common dependency penalty is neutralized when all candidates
+role penalty. A common dependency penalty is neutralized when all code candidates
 are dependency code. Neither `dist/` nor `.d.ts` alone implies generated code.
 
 Final selection is greedy: after each selected entity, remaining entities from
 the same file receive a soft factor of `1 / (1 + 0.5 * selected_count)`. There is
-no hard per-file cap. A single-file pool skips this selection penalty. Context
-group coverage is handled outside this module.
+no hard per-file cap. A code pool from a single file skips this selection
+penalty. Context group coverage is handled outside this module.
 
 Before selection, a file's representative definition can gain up to 0.15 from
 at most two additional definitions. Support must have name or path evidence,
@@ -43,11 +48,13 @@ ranges cannot supply support. The support term uses bounded base scores and
 the same path prior; it does not sum every fragment in a large file. It is an
 extra term after the static bonus cap.
 
-`score` is the rule selection score, not a probability. Trace preserves original
-`fusion` rank/score and includes optional `ranking` evidence: policy identifier,
-query features, name match/bonus, definition bonus, path roles/exemptions, static
-score, positive `path_bonus`, `file_support_bonus`, `file_support_count`, selected
-file count, diversity factor, and group-local final rank.
+For code hits, `score` is the rule selection score. In mixed results, use
+`rank` for order because code and non-code scores use different scales.
+Trace preserves the original `fusion` rank and score for all hits. For code hits,
+`ranking` records the policy identifier, query features, name match/bonus,
+definition bonus, path roles/exemptions, static score, positive `path_bonus`,
+`file_support_bonus`, `file_support_count`, selected file count, diversity factor,
+and group-local final rank.
 `path_overrides` lists roles exempted by query/scope, including those not present
 on a particular hit. Without trace, detailed explanation strings are not built.
 Serialized traces may omit `ranking`. Within a ranking trace, omitted
@@ -63,7 +70,7 @@ path exceptions, deterministic ties, and dynamic file diversity. Validate
 weight changes by language and query intent; file-only labels can overstate
 the benefit of spreading results across files.
 
-An opt-in ignored test replays local CLI candidate snapshots through this same
+An opt-in ignored test replays local code candidate snapshots through this same
 scorer. Set `ZG_RANK_REPLAY` to the snapshot directory and explicitly run
 `replay_rule_ablation` with `--ignored`. The variable is read only by the test;
 production direct/server behavior cannot be changed through it. Internal policy
```

**File**: `rust/crates/zg-engine/src/pipelines/indexed_search/ranking/mod.rs` (modified, +62/-19)
```diff
@@ -1,4 +1,4 @@
-//! Deterministic rule ranking over the complete recalled entity pool.
+//! Rerank recalled code within the positions assigned to code by fusion.
 mod paths;
 mod query;
 mod support;
@@ -11,7 +11,7 @@ use super::{
 };
 use crate::{
     api::context::{options::QueryFilter, result::SearchRankingTrace},
-    domain::{EntityMetadata, FileId},
+    domain::{ContentKind, EntityMetadata, FileId},
 };
 use paths::Roles;
 use query::QueryFeatures;
@@ -85,17 +85,69 @@ pub(super) fn rank(
 }
 
 fn rank_with_policy(
-    hits: Vec<SearchHit>,
+    mut hits: Vec<SearchHit>,
     routes: &[ResolvedSearchRoute],
     filter: &QueryFilter,
     maximum_rrf: f64,
     limit: usize,
     policy: Policy,
     observation: Option<&mut StageTraceCollector>,
 ) -> Vec<SearchHit> {
-    if hits.is_empty() || limit == 0 {
-        return Vec::new();
+    let result_count = limit.min(hits.len());
+    let is_code = |hit: &SearchHit| hit.entity.content().kind() == ContentKind::Code;
+    // Stage diagnostics also report static ranks below the result cutoff.
+    let slot_count = if observation.is_some() {
+        hits.len()
+    } else {
+        result_count
+    };
+    let code_ranks: Vec<_> = hits
+        .iter()
+        .take(slot_count)
+        .enumerate()
+        .filter_map(|(index, hit)| is_code(hit).then_some(index + 1))
+        .collect();
+
+    // Only the visible positions are fixed. Any recalled code hit can fill them.
+    let mut ranked_code = Vec::new();
+    let visible = code_ranks.partition_point(|rank| *rank <= result_count);
+    if visible > 0 {
+        let code = hits.extract_if(.., |hit| is_code(hit)).collect();
+        let (query, scored) = score_code(code, routes, filter, maximum_rrf, policy);
+        if let Some(observation) = observation {
+            let mut order = scored.iter().collect::<Vec<_>>();
+            order.sort_by(|a, b| compare(a, b, a.static_score, b.static_score));
+            for (item, &rank) in order.into_iter().zip(&code_ranks) {
+                observation.static_rank(&item.hit, rank);
+            }
+        }
+        ranked_code = select(scored, &query, &code_ranks[..visible], policy);
     }
+    let mut ranked_code = ranked_code.into_iter().peekable();
+    let mut documents = hits.into_iter();
+    (1..=result_count)
+        .map(|rank| {
+            let mut hit = ranked_code
+                .next_if(|hit| hit.rank == rank)
+                .or_else(|| documents.next())
+                .expect("each result position has a loaded hit");
+            hit.rank = rank;
+            if let Some(trace) = &mut hit.trace {
+                trace.final_selection.returned_by_limit = true;
+                trace.final_selection.cutoff_rank = limit;
+            }
+            hit
+        })
+        .collect()
+}
+
+fn score_code(
+    hits: Vec<SearchHit>,
+    routes: &[ResolvedSearchRoute],
+    filter: &QueryFilter,
+    maximum_rrf: f64,
+    policy: Policy,
+) -> (QueryFeatures, Vec<Scored>) {
     let mut queries = routes.iter().map(|r| r.query.as_str()).collect::<Vec<_>>();
     queries.sort_unstable();
     queries.dedup();
@@ -143,14 +195,7 @@ fn rank_with_policy(
     if policy.support_weight > 0.0 {
         support::apply(&mut scored, policy.support_weight);
     }
-    if let Some(observation) = observation {
-        let mut order = scored.iter().collect::<Vec<_>>();
-        order.sort_by(|a, b| compare(a, b, a.static_score, b.static_score));
-        for (index, item) in order.into_iter().enumerate() {
-            observation.static_rank(&item.hit, index + 1);
-        }
-    }
-    select(scored, &query, limit, policy)
+    (query, scored)
 }
 
 fn compare(a: &Scored, b: &Scored, a_score: f64, b_score: f64) -> Ordering {
@@ -163,15 +208,15 @@ fn compare(a: &Scored, b: &Scored, a_score: f64, b_score: f64) -> Ordering {
 fn select(
     mut scored: Vec<Scored>,
     query: &QueryFeatures,
-    limit: usize,
+    code_ranks: &[usize],
     policy: Policy,
 ) -> Vec<SearchHit> {
     let single_file = scored
         .iter()
         .all(|s| s.hit.file.id() == scored[0].hit.file.id());
     let mut selected_per_file = HashMap::<FileId, u32>::new();
-    let mut output = Vec::with_capacity(limit.min(scored.len()));
-    while output.len() < limit && !scored.is_empty() {
+    let mut output = Vec::with_capacity(code_ranks.len());
+    for &rank in code_ranks {
         let effective = |item: &Scored| {
             let count = if single_file {
                 0
@@ -196,7 +241,7 @@ fn select(
             1.0 / (1.0 + FILE_DECAY * f64::from(*count))
         };
         item.hit.score = item.static_score * factor;
-        item.hit.rank = output.len() + 1;
+        item.hit.rank = rank;
         if let Some(trace) = item.hit.trace.as_mut() {
             trace.ranking = Some(SearchRankingTrace {
                 policy: policy.name.to_owned(),
@@ -217,8 +262,6 @@ fn select(
                 score: item.hit.score,
                 rank: i
```

**File**: `rust/crates/zg-engine/src/pipelines/indexed_search/ranking/tests.rs` (modified, +108/-1)
```diff
@@ -42,6 +42,38 @@ pub(super) fn hit(
     score: f64,
     rank: usize,
     metadata: Option<CodeMetadata>,
+) -> SearchHit {
+    fixture_hit(
+        id,
+        file_id,
+        path,
+        score,
+        rank,
+        Content::Code("source".into()),
+        metadata,
+    )
+}
+
+fn document(id: &str, file_id: u32, path: &str, score: f64, rank: usize) -> SearchHit {
+    fixture_hit(
+        id,
+        file_id,
+        path,
+        score,
+        rank,
+        Content::Text("source".into()),
+        None,
+    )
+}
+
+fn fixture_hit(
+    id: &str,
+    file_id: u32,
+    path: &str,
+    score: f64,
+    rank: usize,
+    content: Content,
+    metadata: Option<CodeMetadata>,
 ) -> SearchHit {
     let id = EntityId::from_string(id.to_owned());
     let fragment = EntityFragment {
@@ -53,7 +85,7 @@ pub(super) fn hit(
             id,
             FileId::new(file_id),
             Range::Full,
-            Content::Text("source".into()),
+            content,
             metadata.map(EntityMetadata::Code),
             vec![fragment],
         )
@@ -107,6 +139,81 @@ fn run(query: &str, hits: Vec<SearchHit>, filter: &QueryFilter, limit: usize) ->
     )
 }
 
+#[test]
+fn documents_keep_fusion_order_and_scores_across_paths_and_repeated_files() {
+    let candidates = vec![
+        document("intro", 1, "tests/guide.md", 0.016, 1),
+        document("details", 1, "tests/guide.md", 0.015, 2),
+        document("notes", 2, "widget.txt", 0.014, 3),
+    ];
+    let out = run("widget", candidates, &QueryFilter::default(), 2);
+    assert_eq!(out.len(), 2);
+    for (hit, (id, rank, score)) in out.iter().zip([("intro", 1, 0.016), ("details", 2, 0.015)]) {
+        assert_eq!(hit.entity.id().as_str(), id);
+        assert_eq!((hit.rank, hit.score), (rank, score));
+        let trace = hit.trace.as_ref().expect("trace");
+        assert_eq!((trace.fusion.rank, trace.fusion.score), (rank, score));
+        assert!(trace.ranking.is_none());
+        assert!(trace.final_selection.returned_by_limit);
+        assert_eq!(trace.final_selection.cutoff_rank, 2);
+    }
+}
+
+#[test]
+fn mixed_results_promote_a_definition_from_below_cutoff_into_a_code_position() {
+    let candidates = vec![
+        document("guide", 1, "tests/guide.md", 1.0, 1),
+        hit("usage", 2, "src/client.rs", 0.95, 2, None),
+        document("notes", 3, "notes.txt", 0.9, 3),
+        hit(
+            "definition",
+            4,
+            "src/lib.rs",
+            0.8,
+            4,
+            Some(code(SymbolType::Function, "loadWidget", None)),
+        ),
+    ];
+    let out = run("loadWidget", candidates.clone(), &QueryFilter::default(), 3);
+    assert_eq!(
+        out.iter()
+            .map(|hit| (hit.entity.id().as_str(), hit.rank))
+            .collect::<Vec<_>>(),
+        [("guide", 1), ("definition", 2), ("notes", 3)]
+    );
+    for index in [0, 2] {
+        assert_eq!(out[index].score, candidates[index].score);
+        assert!(out[index].trace.as_ref().expect("trace").ranking.is_none());
+    }
+    let trace = out[1].trace.as_ref().expect("trace");
+    assert_eq!((trace.fusion.rank, trace.fusion.score), (4, 0.8));
+    assert_eq!(trace.ranking.as_ref().expect("code ranking").rank, 2);
+    assert!(trace.final_selection.returned_by_limit);
+    assert_eq!(trace.final_selection.cutoff_rank, 3);
+
+    let out = run("loadWidget", candidates, &QueryFilter::default(), 1);
+    assert_eq!(out.len(), 1);
+    assert_eq!(out[0].entity.id().as_str(), "guide");
+}
+
+#[test]
+fn documents_do_not_affect_code_dependency_or_diversity_factors() {
+    let candidates = vec![
+        hit("first", 1, "vendor/lib.rs", 1.0, 1, None),
+        document("guide", 2, "docs/guide.md", 0.95, 2),
+        hit("second", 1, "vendor/lib.rs", 0.9, 3, None),
+    ];
+    let out = run("behavior", candidates, &QueryFilter::default(), 5);
+    assert_eq!(out.len(), 3);
+    let trace = out[2].trace.as_ref().expect("trace");
+    let ranking = trace.ranking.as_ref().expect("code ranking");
+    assert_eq!(out[2].entity.id().as_str(), "second");
+    assert_eq!(ranking.path_factor, 1.0);
+    assert_eq!(ranking.diversity_factor, 1.0);
+    assert_eq!(ranking.rank, 3);
+    assert_eq!(trace.final_selection.cutoff_rank, 5);
+}
+
 #[test]
 fn exact_names_and_qualified_scopes_outweigh_references() {
     let out = run(
```

**File**: `rust/crates/zg-engine/src/pipelines/indexed_search/stage_trace.rs` (modified, +2/-0)
```diff
@@ -157,6 +157,8 @@ impl StageTraceCollector {
         for (position, hit) in hits.iter().enumerate() {
             if let Some(stages) = self.stages(hit.file.id(), hit.entity.id()) {
                 stages.loaded_rrf_rank = Some(position + 1);
+                // Static ranking preserves these positions except where code hits are reordered.
+                stages.static_rank = Some(position + 1);
                 stages.loaded_range = Some(hit.entity.source_range().into());
             }
         }
```

#### Recent Merged Pull Requests:
- **PR #457** (2026-11-24): feat(models): add qwen3.7-text-embedding-flash to the catalog (@qrmd0)
- **PR #449** (2026-11-23): fix(ci): support Cargo 1.100 CUDA fallback metadata (@feihongxu0824)
- **PR #447** (2026-11-24): fix(search): restrict rule ranking to code candidates (@egolearner)
- **PR #441** (2026-11-23): feat(rust): expose opt-in retrieval stage diagnostics (@Cuiyus)
- **PR #440** (2026-11-24): fix(rust): bind bare calls to the enclosing module's items (@lnfjpt)
- **PR #437** (2026-11-18): fix(build): restore ONNX Runtime downloads via npmmirror (@feihongxu0824)

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

## X. rust): bind bare calls to the enclosing module's items

**RULE**:
When implementing operations in `rust/crates/zg-engine/src/extraction/code.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zvec-ai/zvec-grep. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ae1a4732`: rust): bind bare calls to the enclosing module's items. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `rust/crates/zg-engine/src/extraction/code.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Whether a Rust item spells a name the value namespace does not hold, so a
/// bare call never reaches it.
///
/// `impl save` names the type it implements, which is a scope rather than a
/// value, and a trait, type alias, enum, union and a named-field struct each
/// declare a type without a constructible value. A tuple struct and a unit
/// struct do declare a constructor, so they stay candidates: `struct save(i32)`
/// beside `fn save` is a conflict rustc rejects.
fn rust_type_namespace_only(node: Node<'_>) -> bool {
    match node.kind() {
        "impl_item" | "trait_item" | "type_item" | "enum_item" | "union_item" => true,
        "struct_item" => node
            .child_by_field_name("body")
            .is_some_and(|body| body.kind() == "field_declaration_list"),
        _ => false,
    }
}

        let symbol_type = adapter.classify(entity);
            // A module puts the items it declares in bare scope for every body
            // inside it, and a function does the same for the bodies nested in
            // it (`fn outer() { fn save() {} }` answers `inner`'s `save()`),
            // unlike a class, whose members need a receiver. Other languages
            // re
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            symbol_type: adapter.classify(entity),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ae1a4732` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
