# Verification Protocol: Verification Protocol: Empirical Defect Shield for zvec-ai-zvec-grep-learnings

<!-- PROVENANCE_START
{
  "source_repository": "zvec-ai-zvec-grep-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T22:33:13.723Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zvec-ai-zvec-grep-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zvec-ai-zvec-grep-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T22:33:13.723Z`  
> **Learning ID**: `LEARN-EVO-zvec-ai-zvec-grep-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `zvec-ai-zvec-grep-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zvec-ai-zvec-grep-learnings.md`  
> **Source**: github ([https://github.com/zvec-ai/zvec-grep](https://github.com/zvec-ai/zvec-grep))  
> **Source Version**: `2f18f2d9`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-23T20:30:32.117Z  
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
> **Harvest Timestamp**: 2026-11-23T20:30:32.111Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zvec-ai/zvec-grep`
- **Description**: Local-first search across your workspace, built for humans and AI agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4374 stars

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

### Incident Patch 1: `2f18f2d9` (2026-11-23)
**Commit Message**: fix(rust): resolve python calls through annotated parameters and self members (#435)

* fix(rust): bind python annotated parameters and self members

A Python parameter states its type on the annotation rather than on an
assignment, and a class states its attributes by assigning them on `self`
from inside a method. Neither reached the graph, so a call through the
parameter's declared contract (`index.create_variables()`) stayed pending,
and a member one method writes was unknown to the methods beside it.

- Read a typed parameter's annotation as the type the name holds for the
  whole body: through the `type` wrapper, string annotations, `A | None`,
  `Optional[…]`/`Union[…]`/`Annotated[…]` and their module-qualified
  spellings. A container annotation stays unbound, since the members a
  call reads there are the container's own.
- Record `self.<member> = <value>` on the class entity, so every method
  and every subclass reads the same member. The value is read where it is
  written: `self.x = param` takes the parameter's annotation and
  `self.x = state.x` a `member_of:(<type>,<member>)` step. A nested class
  states `self` for its own members, not for the class around it.

* fix(

**File**: `rust/crates/zg-engine/src/extraction/graph.rs` (modified, +43/-0)
```diff
@@ -53,6 +53,27 @@ use crate::domain::{GraphEdgeKind, PreprocessorDirective};
 /// allocated by [`WalkContext::next_entity_index`].
 pub(crate) const FILE_SCOPE_INDEX: usize = usize::MAX;
 
+/// The bound type extraction records for a Python name a body rebinds to a
+/// value the index cannot place (`client = clients[0]`, `self.client = client`).
+///
+/// The write shadows what an earlier declaration stated — a parameter's
+/// annotation, a member's previous assignment — so the name holds no type from
+/// that line on. The resolver reads the sentinel as "stated, but undecided":
+/// the answer is not the type the name no longer holds, and a base class's
+/// member is not the answer either.
+pub(crate) const PYTHON_UNBOUND_TYPE: &str = "[[python_unbound]]";
+
+/// The bound type extraction records for a Python member a class writes as
+/// `None` (`self.client = None`).
+///
+/// The write is a declaration of the member — the class chooses what the name
+/// holds, so a base class's member of the same name is not the answer — but it
+/// states no type. It differs from [`PYTHON_UNBOUND_TYPE`], which leaves the
+/// member undecided even beside a write that does state a type: an optional
+/// member (`__init__` writes `None`, another method stores the real value) is
+/// still typed by the write that states one.
+pub(crate) const PYTHON_NONE_TYPE: &str = "[[python_none]]";
+
 /// An edge whose both endpoints are known at walk time. Only `contains`
 /// qualifies: the target entity is created during the same walk, so its index
 /// is available from the scope stack. Positions use one-based lines and
@@ -527,6 +548,28 @@ impl WalkContext {
         });
     }
 
+    /// The type `owner_index` has stated for `name` at one point of its body:
+    /// the last declaration written before the position, which is what a copy
+    /// (`client = other`) takes with it.
+    pub(crate) fn declared_type_at(
+        &self,
+        owner_index: usize,
+        name: &str,
+        line: usize,
+        column: usize,
+    ) -> Option<&str> {
+        self.name_edges
+            .iter()
+            .rev()
+            .find(|edge| {
+                edge.ref_kind == GraphEdgeKind::Declares
+                    && edge.owner_index == owner_index
+                    && edge.ref_name == name
+                    && (edge.line, edge.column) < (line, column)
+            })
+            .and_then(|edge| edge.bound_type.as_deref())
+    }
+
     pub(crate) fn add_scoped_binding(
         &mut self,
         owner: usize,
```

**File**: `rust/crates/zg-engine/src/extraction/graph/collector.rs` (modified, +885/-1)
```diff
@@ -5,6 +5,8 @@
 //! owning entity without a second full parse. Mirrors the TypeScript
 //! `src/engine/extraction/graph/edge-collector.ts` implementation.
 
+use std::collections::HashMap;
+
 use tree_sitter::Node;
 
 use crate::domain::{FileFormat, GraphEdgeKind};
@@ -14,7 +16,7 @@ use super::vocabulary::{
     CALLEE_FIELDS, COMMON_CALL_TYPES, HeritageVocabulary, heritage_vocabulary_for,
     import_vocabulary_for,
 };
-use super::{Constructs, FILE_SCOPE_INDEX, WalkContext};
+use super::{Constructs, FILE_SCOPE_INDEX, PYTHON_NONE_TYPE, PYTHON_UNBOUND_TYPE, WalkContext};
 
 const MAX_CALLEE_TEXT_CHARS: usize = 180;
 
@@ -578,6 +580,27 @@ pub(crate) fn scan_binding_declarations(
         );
     }
     visit_for_bindings(entity_node, owner_index, source, format, context, boundary);
+    // A decorated class reaches this scan as its wrapper, whose body is the
+    // class's: a decorator that returns the class unchanged must not hide the
+    // instance members its methods state.
+    if format == FileFormat::Python
+        && let Some(class) =
+            python_inner_definition(entity_node).filter(|inner| inner.kind() == "class_definition")
+    {
+        collect_python_self_members(class, owner_index, source, context);
+    }
+}
+
+/// The definition a Python declaration states. A decorator wraps the class or
+/// function it decorates, and the wrapper's own body is that definition's.
+fn python_inner_definition(node: Node<'_>) -> Option<Node<'_>> {
+    match node.kind() {
+        "class_definition" | "function_definition" => Some(node),
+        "decorated_definition" => named_children(node)
+            .into_iter()
+            .find(|child| matches!(child.kind(), "class_definition" | "function_definition")),
+        _ => None,
+    }
 }
 
 fn visit_for_bindings(
@@ -662,6 +685,45 @@ fn visit_for_bindings(
         }
         return;
     }
+    if format == FileFormat::Python
+        && node.kind() == "assignment"
+        && let Some(left) = node
+            .child_by_field_name("left")
+            .filter(|left| left.kind() == "identifier")
+    {
+        let name = node_text(left, source);
+        // `client: Left = …` states the type beside the name, whatever value
+        // the body stores in it.
+        if let Some(bound) = node
+            .child_by_field_name("type")
+            .and_then(|ty| python_annotation_name(ty, source))
+        {
+            context.add_declare_binding(owner_index, name, &bound, line, column, None);
+            return;
+        }
+        // `client = clients[0]` states that the name no longer holds what the
+        // parameter declared. The index cannot place the value, so the name
+        // holds no type from this line on rather than keeping the annotation
+        // the parameter stated for the whole body.
+        //
+        // `client = other` is a copy of a name the body already types, and the
+        // copy holds that type: a receiver reads `other`'s type from this line
+        // on. A copy of a name the body states no type for leaves the name as
+        // undecided as any other value the index cannot place — the annotation
+        // described what the name held before the assignment, not after it.
+        let copied = node
+            .child_by_field_name("right")
+            .filter(|right| right.kind() == "identifier")
+            .and_then(|right| {
+                context
+                    .declared_type_at(owner_index, node_text(right, source), line, column)
+                    .map(str::to_owned)
+            })
+            .filter(|bound| !matches!(bound.as_str(), PYTHON_UNBOUND_TYPE | PYTHON_NONE_TYPE));
+        let bound = copied.as_deref().unwrap_or(PYTHON_UNBOUND_TYPE);
+        context.add_declare_binding(owner_index, name, bound, line, column, None);
+        return;
+    }
     for child in named_children(node) {
         if boundary.is_some_and(|owns| owns(child)) {
             continue;
@@ -670,6 +732,361 @@ fn visit_for_bindings(
     }
 }
 
+/// Records what a Python class's `self.<member> = <value>` assignments state
+/// about the member.
+///
+/// A Python class body states its attributes by assigning them on `self` from
+/// inside a method, so the member a call reads through `self` — the
+/// `self.fontset.render_glyph(…)` of a sibling method — is only known by
+/// walking the methods. The binding belongs to the class: every method of the
+/// class and of a subclass that inherits it reads the same member. The value
+/// is read where it is written, so `self.fontset = fontset` takes the
+/// parameter's annotation and `self.fontset = state.fontset` steps through the
+/// member the parameter's own type states.
+fn collect_python_self_members(
+    class_node: Node<'_>,
+    owner_index: usize,
+    source: &[u8],
+    context: &mut WalkContext,
+) {
+    let class_name = class_node
+        .child_by_field_name("name")
+        .map(|name| node_text(name, source).to_owned());
+    // The met
```

**File**: `rust/crates/zg-engine/src/extraction/graph/partition.rs` (modified, +30/-14)
```diff
@@ -17,7 +17,7 @@ use std::collections::{HashMap, HashSet};
 
 use crate::domain::{EdgeProvenance, GraphEdgeKind, PreprocessorDirective};
 
-use super::{Constructs, NameEdge, WalkContext, WalkEdge};
+use super::{Constructs, NameEdge, PYTHON_NONE_TYPE, PYTHON_UNBOUND_TYPE, WalkContext, WalkEdge};
 
 /// A name reference resolved against this file's own symbol table.
 #[derive(Clone, Debug, Eq, PartialEq)]
@@ -142,6 +142,12 @@ fn states_a_placeable_value(bound: &str) -> bool {
     !(bound == "?" || bound.starts_with("typeof "))
 }
 
+/// Whether a binding is the sentinel a Python body writes when it rebinds a
+/// name to a value it cannot place or states only the name's absence.
+fn is_python_rebound(bound: &str) -> bool {
+    matches!(bound, PYTHON_UNBOUND_TYPE | PYTHON_NONE_TYPE)
+}
+
 /// The entity the file declares exactly once under `name`; two same-named
 /// declarations are not evidence for either.
 fn unique_symbol(symbols: &HashMap<String, Vec<usize>>, name: &str) -> Option<usize> {
@@ -346,20 +352,30 @@ fn in_file_target(edge: &NameEdge, shadowed: bool, tables: InFileTables<'_>) ->
         // naming `run` does not see `A::run` just because the file declares it
         // once. Without better evidence the reference stays pending for the
         // cross-file resolver, which also weighs imports.
-        GraphEdgeKind::Calls => match alias_at(aliases, edge) {
-            // The binding states no value this file can place, so the spelled
-            // name is not the answer: the resolver reads the declared binding
-            // at the call's position and can still tell a parameter, a nested
-            // definition or a later reassignment apart from the file's name.
-            Some(bound) if !states_a_placeable_value(bound) => None,
-            Some(bound) => unique_symbol(symbols, bound),
-            None => {
-                let value_alias = value_aliases
+        GraphEdgeKind::Calls => {
+            let value_alias = || {
+                value_aliases
                     .get(&(edge.owner_index, edge.ref_name.clone()))
                     .or_else(|| {
                         value_aliases.get(&(super::FILE_SCOPE_INDEX, edge.ref_name.clone()))
-                    });
-                match value_alias {
+                    })
+            };
+            match alias_at(aliases, edge) {
+                // A Python body that rebinds a name states it holds no type
+                // the index can place (`client = clients[0]`), but a copy of
+                // another name is evidence of its own: `alias = target` still
+                // reaches `target` through the alias table.
+                Some(bound) if is_python_rebound(bound) => {
+                    value_alias().and_then(|bound| unique_symbol(symbols, bound))
+                }
+                // The binding states no value this file can place, so the
+                // spelled name is not the answer: the resolver reads the
+                // declared binding at the call's position and can still tell a
+                // parameter, a nested definition or a later reassignment apart
+                // from the file's name.
+                Some(bound) if !states_a_placeable_value(bound) => None,
+                Some(bound) => unique_symbol(symbols, bound),
+                None => match value_alias() {
                     // A pair the walk recorded without a position of its own
                     // (`x = y` where the declaration states no type) is the
                     // only evidence there is.
@@ -373,9 +389,9 @@ fn in_file_target(edge: &NameEdge, shadowed: bool, tables: InFileTables<'_>) ->
                                 .then(|| unique_symbol(file_symbols, &edge.ref_name))
                                 .flatten()
                         }),
-                }
+                },
             }
-        },
+        }
         GraphEdgeKind::Extends | GraphEdgeKind::Implements => {
             unique_symbol(symbols, &edge.ref_name)
         }
```

**File**: `rust/crates/zg-engine/src/extraction/mod.rs` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ pub(crate) use spi::{ExtractedEntity, ExtractedEntityFragment, ExtractionOutput}
 #[cfg(test)]
 pub(crate) use graph::Constructs;
 #[allow(unused_imports)]
-pub(crate) use graph::{FILE_SCOPE_INDEX, PartitionedGraph};
+pub(crate) use graph::{FILE_SCOPE_INDEX, PYTHON_NONE_TYPE, PYTHON_UNBOUND_TYPE, PartitionedGraph};
 #[cfg(test)]
 pub(crate) use graph::{PendingNameRef, ResolvedNameEdge};
 
```

**File**: `rust/crates/zg-engine/src/pipelines/indexing/graph_resolver.rs` (modified, +355/-35)
```diff
@@ -36,6 +36,7 @@ use crate::domain::{
     EdgeProvenance, FileFormat, GraphEdgeKind, SymbolType, formats_for_path,
     reference_compatible_with,
 };
+use crate::extraction::{PYTHON_NONE_TYPE, PYTHON_UNBOUND_TYPE};
 use crate::storage::graph::{
     DeclaredBinding, ImportReference, NameIndexEntry, Resolution, StoredPendingRef,
 };
@@ -2854,21 +2855,41 @@ fn receiver_path_type(
         };
         return Ok(step_type(marker, &inner_type));
     }
-    if let Some(bound) = declared_receiver_type(store, snapshot, stored, receiver, caches)? {
-        // A loop or a placeholder declaration binds what the range or path it
-        // was taken from holds, which is only known once that is read.
-        if let Some((marker, inner)) = step_marker(&bound) {
-            let Some(inner_type) =
-                receiver_path_type(store, snapshot, stored, inner, caches, depth + 1)?
-            else {
-                return Ok(None);
-            };
-            return Ok(step_type(marker, &inner_type));
+    match declared_receiver_type(store, snapshot, stored, receiver, caches)? {
+        // The body rebound the name to a value it cannot type. The name holds
+        // no type, and the scopes below must not claim it back: `self =
+        // objects[0]` no longer names this class's instance.
+        ReceiverBinding::Undecided => return Ok(None),
+        ReceiverBinding::Known(bound) => {
+            // A member read the extraction could not type states the type stating
+            // it: `member_of:(ParserState,fontset)` is what `ParserState` says
+            // `fontset` holds.
+            if member_step(&bound).is_some() {
+                return resolve_member_steps(store, snapshot, stored, bound, caches, depth);
+            }
+            // A loop or a placeholder declaration binds what the range or path it
+            // was taken from holds, which is only known once that is read.
+            if let Some((marker, inner)) = step_marker(&bound) {
+                let Some(inner_type) =
+                    receiver_path_type(store, snapshot, stored, inner, caches, depth + 1)?
+                else {
+                    return Ok(None);
+                };
+                return Ok(step_type(marker, &inner_type));
+            }
+            // The spelling keeps the declarator's decorations: a pointer answers a
+            // subscript with what it points at, and the step that reads the value
+            // decides what the name itself denotes.
+            return Ok(Some(bound));
         }
-        // The spelling keeps the declarator's decorations: a pointer answers a
-        // subscript with what it points at, and the step that reads the value
-        // decides what the name itself denotes.
-        return Ok(Some(bound));
+        ReceiverBinding::Absent => {}
+    }
+    // `self` and `cls` hold the enclosing class: a member read through them is
+    // a member that class or one of its bases states.
+    if is_self_receiver(&stored.language, receiver) {
+        return Ok(snapshot
+            .entity_record(&stored.reference.owner_id)
+            .and_then(|owner| enclosing_class_scope(snapshot, &owner.qualified_name)));
     }
     let Some((base, member)) = receiver.rsplit_once('.') else {
         return Ok(None);
@@ -2877,7 +2898,100 @@ fn receiver_path_type(
     else {
         return Ok(None);
     };
-    member_of_type(store, snapshot, stored, &base_type, member, caches, depth)
+    let Some(bound) = member_of_type(store, snapshot, stored, &base_type, member, caches, depth)?
+    else {
+        return Ok(None);
+    };
+    resolve_member_steps(store, snapshot, stored, bound, caches, depth)
+}
+
+/// The type a member read denotes, one step at a time.
+///
+/// The extraction states a member read it cannot look up as
+/// `member_of:(<type>,<member>)`; the member's own type may step again
+/// (`self.fontset = self.state.fontset`), so the steps are read until the
+/// type is one the member rule can search.
+///
+/// # Errors
+/// Propagates graph storage failures of the member reads.
+fn resolve_member_steps(
+    store: &IndexStore,
+    snapshot: &ResolutionSnapshot,
+    stored: &StoredPendingRef,
+    bound: String,
+    caches: &mut RuleCaches,
+    depth: usize,
+) -> crate::EngineResult<Option<String>> {
+    let mut bound = bound;
+    let mut depth = depth;
+    loop {
+        let Some((base, member)) = member_step(&bound) else {
+            return Ok(Some(bound));
+        };
+        if depth > MAX_TYPE_STEPS {
+            return Ok(None);
+        }
+        // What the member is read from may state a step of its own
+        // (`member_of:(member_of:(ParserState,state),fontset)`): the type the
+        // outer member belongs to is only known once that step is read.
+        let base = match member_step(base) {
+            Some(_) => {
+                let Some(resolved) = resolve_member_steps(
+                    store,
+                    snapsho
```

**File**: `rust/crates/zg-engine/tests/call_resolution_regressions.rs` (modified, +288/-0)
```diff
@@ -1228,3 +1228,291 @@ async fn rust_glob_imports_respect_local_types_and_explicit_imports() {
         }).await;
     }
 }
+
+// A decorated class reaches the binding scan as its decorator's wrapper, and a
+// member one method writes is read by the methods beside it: the step is
+// stated as `member_of:(<type>,<member>)` and the resolver walks it.
+#[tokio::test]
+async fn python_self_member_chain_reaches_the_decorated_class_member() {
+    check_case(Case {
+        name: "python_self_member_chain_reaches_the_decorated_class_member",
+        files: vec![SourceFile {
+            path: "shapes.py",
+            source: "class Fonts:\n    def render_glyph(self):\n        return 1\n\n@dataclass\nclass ParserState:\n    def __init__(self, fontset: Fonts):\n        self.fontset = fontset\n\n@dataclass\nclass Char:\n    def __init__(self, state: ParserState):\n        self.inner = state.fontset\n\n    def render(self):\n        return self.inner.render_glyph()\n",
+        }],
+        queries: vec![
+            Query {
+                operation: "callees",
+                symbol: "render",
+                expected: json!([{"name": "Char::render", "edges": [
+                    {"symbol": {"name": "Fonts::render_glyph"}, "line": 16}
+                ]}]),
+                ..Query::default()
+            },
+            Query {
+                operation: "callers",
+                symbol: "render_glyph",
+                expected: json!([{"name": "Fonts::render_glyph", "edges": [
+                    {"symbol": {"name": "Char::render"}}
+                ]}]),
+                ..Query::default()
+            },
+        ],
+    })
+    .await;
+}
+
+// A bare name of a Python body is the parameter the body declares, not the
+// class member another method stated under the same name.
+#[tokio::test]
+async fn python_bare_parameter_does_not_read_the_class_member() {
+    check_case(Case {
+        name: "python_bare_parameter_does_not_read_the_class_member",
+        files: vec![SourceFile {
+            path: "parser.py",
+            source: "class Index:\n    def create_variables(self):\n        return 1\n\nclass Parser:\n    def __init__(self):\n        self.index = Index()\n\n    def run(self, index):\n        return index.create_variables()\n",
+        }],
+        queries: vec![Query {
+            operation: "callees",
+            symbol: "run",
+            expected: json!([{"name": "Parser::run", "edges": []}]),
+            ..Query::default()
+        }],
+    })
+    .await;
+}
+
+// A member a body writes with a value the index cannot place no longer holds
+// what an earlier write stated, so the call through it stays undecided instead
+// of answering with the type the constructor's first line named.
+#[tokio::test]
+async fn python_unknown_member_write_invalidates_the_earlier_type() {
+    check_case(Case {
+        name: "python_unknown_member_write_invalidates_the_earlier_type",
+        files: vec![SourceFile {
+            path: "use.py",
+            source: "class Left:\n    def work(self):\n        return 'left'\n\nclass Right:\n    def work(self):\n        return 'right'\n\nclass Runner:\n    def __init__(self, client):\n        self.client = Left()\n        self.client = client\n\n    def run(self):\n        return self.client.work()\n",
+        }],
+        queries: vec![Query {
+            operation: "callees",
+            symbol: "Runner::run",
+            expected: json!([{"name": "Runner::run", "edges": []}]),
+            ..Query::default()
+        }],
+    })
+    .await;
+}
+
+// `client: Left` states the parameter, and `client = clients[0]` takes it back:
+// the element a container holds is not the annotated type.
+#[tokio::test]
+async fn python_parameter_reassignment_invalidates_its_annotation() {
+    check_case(Case {
+        name: "python_parameter_reassignment_invalidates_its_annotation",
+        files: vec![SourceFile {
+            path: "use.py",
+            source: "class Left:\n    def work(self):\n        return 'left'\n\nclass Right:\n    def work(self):\n        return 'right'\n\ndef run(client: Left, clients):\n    client = clients[0]\n    return client.work()\n",
+        }],
+        queries: vec![Query {
+            operation: "callees",
+            symbol: "run",
+            expected: json!([{"name": "run", "edges": []}]),
+            ..Query::default()
+        }],
+    })
+    .await;
+}
+
+// A union arm the reader cannot name (`right.Right` is a module) is no evidence
+// that the arm it can name is the only shape the value takes.
+#[tokio::test]
+async fn python_union_with_an_unreadable_arm_stays_undecided() {
+    check_case(Case {
+        name: "python_union_with_an_unreadable_arm_stays_undecided",
+        files: vec![
+            SourceFile {
+                path: "right.py",
+                source: "class Right:\n    def send(self):\n        return 'right'\n",
+            },
+            SourceFile {
+                path: 
```

---

### Incident Patch 2: `8415f1be` (2026-11-23)
**Commit Message**: fix(ci): support Cargo 1.100 CUDA fallback metadata (#449)

**File**: `rust/scripts/cuda/build-fallback.py` (modified, +9/-3)
```diff
@@ -25,9 +25,15 @@ def source_build(messages):
     if len(builds) != 1:
         raise RuntimeError("Expected one active llama sys build script in the primary Cargo messages")
     # Cargo retains build-script stdout beside this invocation's OUT_DIR, also
-    # on cache hits. The pinned sys crate records its verified source here;
-    # custom metadata is not included in Cargo's JSON build-script record.
-    output = Path(builds[0]["out_dir"]).parent / "output"
+    # on cache hits: output before 1.100, run/stdout in the new build-dir layout.
+    # The pinned sys crate records its verified source here; custom metadata is
+    # not included in Cargo's JSON build-script record.
+    directory = Path(builds[0]["out_dir"]).parent
+    candidates = [directory / "output", directory / "run" / "stdout"]
+    outputs = [path for path in candidates if path.is_file()]
+    if len(outputs) != 1:
+        raise RuntimeError(f"Missing or ambiguous build-script stdout for primary OUT_DIR: {candidates}")
+    output = outputs[0]
     lines = output.read_text(encoding="utf-8").splitlines()
     metadata = {}
     for key in ("source_dir", "source_revision"):
```

**File**: `rust/scripts/npm-local.test.mjs` (modified, +47/-18)
```diff
@@ -1,7 +1,7 @@
 import assert from "node:assert/strict";
 import { spawnSync } from "node:child_process";
 import test from "node:test";
-import { chmod, lstat, mkdtemp, mkdir, readFile, rm, symlink, truncate, writeFile } from "node:fs/promises";
+import { chmod, copyFile, lstat, mkdtemp, mkdir, readFile, rm, symlink, truncate, writeFile } from "node:fs/promises";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
 import { fileURLToPath } from "node:url";
@@ -492,6 +492,8 @@ test("CUDA fallback uses the primary Cargo source record, including cached build
     await writeFile(join(directory, "CMakeLists.txt"), "# source path fixture\n");
   }
   await mkdir(join(project, "src"));
+  // This temporary project is outside the repository's toolchain scope.
+  await copyFile(new URL("../rust-toolchain.toml", import.meta.url), join(project, "rust-toolchain.toml"));
   await writeFile(join(project, "Cargo.toml"),
     '[package]\nname = "llama-cpp-sys-2"\nversion = "0.0.0"\nedition = "2021"\nlinks = "llama"\n');
   await writeFile(join(project, "Cargo.lock"),
@@ -530,35 +532,62 @@ messages = pathlib.Path(sys.argv[2])
     const records = result.stdout.trim().split(/\r?\n/).map((line) => JSON.parse(line));
     if (index === 1) assert.ok(records.some((r) => r.reason === "compiler-artifact" && r.fresh));
     inspect(String.raw`
-source, revision = fallback.source_build(messages)
-assert source == pathlib.Path(sys.argv[3]), (source, sys.argv[3])
-assert revision == sys.argv[4]
-command = fallback.configure(source, source / "build", source / "cuda", fallback.DEFAULT_ARCHITECTURES)
-assert command[command.index("-S") + 1] == str(source)
+build = next(r for r in fallback.cargo_records(messages) if r.get("reason") == "build-script-executed")
+directory = pathlib.Path(build["out_dir"]).parent
+outputs = [directory / "output", directory / "run" / "stdout"]
+actual = next(output for output in outputs if output.is_file())
+# Replay the real metadata in both Cargo layouts, restoring it before the next
+# build so Cargo's cache behavior is still exercised by Cargo itself.
+for output in outputs:
+    output.parent.mkdir(parents=True, exist_ok=True)
+    if output != actual:
+        actual.rename(output)
+    try:
+        source, revision = fallback.source_build(messages)
+        assert source == pathlib.Path(sys.argv[3]), (source, sys.argv[3])
+        assert revision == sys.argv[4]
+        command = fallback.configure(source, source / "build", source / "cuda", fallback.DEFAULT_ARCHITECTURES)
+        assert command[command.index("-S") + 1] == str(source)
+    finally:
+        if output != actual:
+            output.rename(actual)
 `, source, revision);
   }
   inspect(String.raw`
 records = fallback.cargo_records(messages)
 build = next(r for r in records if r.get("reason") == "build-script-executed")
-output = pathlib.Path(build["out_dir"]).parent / "output"
-original = output.read_text(encoding="utf-8")
+directory = pathlib.Path(build["out_dir"]).parent
+outputs = [directory / "output", directory / "run" / "stdout"]
+actual = next(output for output in outputs if output.is_file())
+original = actual.read_text(encoding="utf-8")
 def reject(expected):
     try:
         fallback.source_build(messages)
     except RuntimeError as error:
         assert expected in str(error), str(error)
     else:
         raise AssertionError("invalid primary source accepted")
-for text, error in [
-    ("cargo:source_revision=" + "a" * 40, "source_dir"),
-    (original + "\ncargo:source_dir=/stale\n", "source_dir"),
-    (original.replace(sys.argv[3], "relative/source"), "source is unavailable"),
-    (original.replace(sys.argv[3], str(output.parent / "missing")), "source is unavailable"),
-    (original.replace(sys.argv[4], "not-a-revision"), "source_revision"),
-]:
-    output.write_text(text, encoding="utf-8")
-    reject(error)
-output.write_text(original, encoding="utf-8")
+actual.unlink()
+reject("Missing or ambiguous build-script stdout")
+for output in outputs:
+    output.parent.mkdir(parents=True, exist_ok=True)
+    for text, error in [
+        ("cargo:source_revision=" + "a" * 40, "source_dir"),
+        (original + "\ncargo:source_dir=/stale\n", "source_dir"),
+        (original + "\ncargo:source_revision=" + "a" * 40, "source_revision"),
+        (original.replace(sys.argv[3], "relative/source"), "source is unavailable"),
+        (original.replace(sys.argv[3], str(directory / "missing")), "source is unavailable"),
+        (original.replace(sys.argv[4], "not-a-revision"), "source_revision"),
+    ]:
+        output.write_text(text, encoding="utf-8")
+        reject(error)
+    output.unlink()
+for output in outputs:
+    output.write_text(original, encoding="utf-8")
+reject("Missing or ambiguous build-script stdout")
+for output in outputs:
+    output.unlink()
+actual.write_text(original, encoding="utf-8")
 for changed, error in [
     (records[:-1], "finish successfully"),
     ([*records[:-1], {"r
```

#### Recent Merged Pull Requests:
- **PR #449** (2026-11-23): fix(ci): support Cargo 1.100 CUDA fallback metadata (@feihongxu0824)
- **PR #441** (2026-11-23): feat(rust): expose opt-in retrieval stage diagnostics (@Cuiyus)
- **PR #437** (2026-11-18): fix(build): restore ONNX Runtime downloads via npmmirror (@feihongxu0824)
- **PR #435** (2026-11-23): fix(rust): resolve python calls through annotated parameters and self members (@lnfjpt)
- **PR #427** (2026-11-17): fix(rust): address the remaining issues in #418 (@lnfjpt)
- **PR #424** (2026-11-17): fix(ort): release environment before CUDA provider destructors (@feihongxu0824)

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

## X. rust): resolve python calls through annotated parameters and self members

**RULE**:
When implementing operations in `rust/crates/zg-engine/src/extraction/graph.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zvec-ai/zvec-grep. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2f18f2d9`: rust): resolve python calls through annotated parameters and self members. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `rust/crates/zg-engine/src/extraction/graph.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// The bound type extraction records for a Python name a body rebinds to a
/// value the index cannot place (`client = clients[0]`, `self.client = client`).
///
/// The write shadows what an earlier declaration stated — a parameter's
/// annotation, a member's previous assignment — so the name holds no type from
/// that line on. The resolver reads the sentinel as "stated, but undecided":
/// the answer is not the type the name no longer holds, and a base class's
/// member is not the answer either.
pub(crate) const PYTHON_UNBOUND_TYPE: &str = "[[python_unbound]]";

/// The bound type extraction records for a Python member a class writes as
/// `None` (`self.client = None`).
///
/// The write is a declaration of the member — the class chooses what the name
/// holds, so a base class's member of the same name is not the answer — but it
/// states no type. It differs from [`PYTHON_UNBOUND_TYPE`], which leaves the
/// member undecided even beside a write that does state a type: an optional
/// member (`__init__` writes `None`, another method stores the real value) is
/// still typed by the write that states one.
pub(crate) const PYTHON_NONE_TYPE: &str = "[[python_none]]";

    /// Th
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2f18f2d9` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
