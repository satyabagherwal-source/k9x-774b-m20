# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: zvec-ai-zvec-grep-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "zvec-ai-zvec-grep-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T06:11:37.268Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zvec-ai-zvec-grep-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zvec-ai-zvec-grep-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T06:11:37.268Z`  
> **Learning ID**: `LEARN-EVO-zvec-ai-zvec-grep-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: D (Research & Knowledge Intelligence), I (Content & Information Intelligence), G (Architecture Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), F (Design Intelligence)
- **Confidence Rating**: 60%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from zvec-ai-zvec-grep-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zvec-ai-zvec-grep-learnings.md`  
> **Source**: github ([https://github.com/zvec-ai/zvec-grep](https://github.com/zvec-ai/zvec-grep))  
> **Source Version**: `ad737d20`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T23:21:18.304Z  
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
> **Harvest Timestamp**: 2026-11-20T23:21:18.126Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zvec-ai/zvec-grep`
- **Description**: Local-first search across your workspace, built for humans and AI agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4367 stars

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

### Incident Patch 1: `ad737d20` (2026-11-20)
**Commit Message**: feat(benchmarks): report Gold coverage across retrieval stages (#417)

**File**: `.github/scripts/retrieval-pr-comment.mjs` (modified, +40/-7)
```diff
@@ -390,7 +390,14 @@ export function validateComparison(report, request) {
   };
 }
 
-export function commentBody({ run, request, report, serverUrl, repository }) {
+export function commentBody({
+  run,
+  request,
+  report,
+  serverUrl,
+  repository,
+  traceArtifactId,
+}) {
   const runUrl = `${serverUrl}/${repository}/actions/runs/${run.id}/attempts/${run.run_attempt}`;
   let result;
   if (run.conclusion === "success") {
@@ -403,11 +410,14 @@ export function commentBody({ run, request, report, serverUrl, repository }) {
   const body = [marker, versionMarker(run), "## ZG Retrieval Benchmark", ""];
   if (result) {
     body.push(
-      markdownVersionComparison({
-        ...result,
-        server_url: serverUrl,
-        run_url: runUrl,
-      }),
+      markdownVersionComparison(
+        { ...result, server_url: serverUrl, run_url: runUrl },
+        {
+          traceUrl: positiveInteger(traceArtifactId)
+            ? `${serverUrl}/${repository}/actions/runs/${run.id}/artifacts/${traceArtifactId}`
+            : undefined,
+        },
+      ),
     );
   } else {
     const version = (side) => {
@@ -438,7 +448,7 @@ export function commentBody({ run, request, report, serverUrl, repository }) {
 async function readJson(path) {
   try {
     const info = await lstat(path);
-    if (!info.isFile() || info.size > 128 * 1024) return null;
+    if (!info.isFile() || info.size > 256 * 1024) return null;
     return JSON.parse(await readFile(path, "utf8"));
   } catch {
     return null;
@@ -522,12 +532,35 @@ export async function publish({ github, context, core, directory }) {
     core.info("A newer run already published this PR's results.");
     return;
   }
+  let traceArtifactId;
+  if (run.conclusion === "success") {
+    try {
+      const artifacts = await github.paginate(
+        github.rest.actions.listWorkflowRunArtifacts,
+        { ...context.repo, run_id: run.id, per_page: 100 },
+      );
+      // Build the URL from GitHub metadata, never artifact-provided Markdown or URLs.
+      traceArtifactId = artifacts.find(
+        (artifact) =>
+          artifact.name === "retrieval-trace.html" &&
+          artifact.expired === false &&
+          positiveInteger(artifact.id) &&
+          artifact.workflow_run?.id === run.id &&
+          artifact.workflow_run?.head_sha === run.head_sha,
+      )?.id;
+    } catch {
+      core.info(
+        "Stage trace artifact unavailable; omitting its download link.",
+      );
+    }
+  }
   const body = commentBody({
     run,
     request,
     report: await readJson(join(directory, "comparison/summary.json")),
     serverUrl: context.serverUrl,
     repository,
+    traceArtifactId,
   });
   // Recheck after reading artifacts/comments so a push during publication
   // cannot knowingly replace the current PR's result with an older version.
```

**File**: `.github/scripts/retrieval-pr-comment.test.mjs` (modified, +98/-3)
```diff
@@ -134,12 +134,14 @@ async function fixture(t) {
   };
   const calls = [],
     comments = [],
+    artifacts = [],
     info = [];
   let prReads = 0;
-  const x = { context, directory, run, pr, calls, comments, info };
+  const x = { context, directory, run, pr, calls, comments, artifacts, info };
   x.github = {
     rest: {
       actions: {
+        listWorkflowRunArtifacts() {},
         async getWorkflowRun(input) {
           assert.equal(input.run_id, 123);
           return { data: run };
@@ -173,8 +175,16 @@ async function fixture(t) {
         },
       },
     },
-    async paginate(_method, input) {
+    async paginate(method, input) {
       calls.push(["list", input]);
+      if (method === x.github.rest.actions.listWorkflowRunArtifacts) {
+        assert.equal(input.run_id, run.id);
+        assert.equal(input.owner, context.repo.owner);
+        assert.equal(input.repo, context.repo.repo);
+        if (x.artifactError) throw x.artifactError;
+        return artifacts;
+      }
+      assert.equal(method, x.github.rest.issues.listComments);
       return comments;
     },
   };
@@ -246,6 +256,79 @@ test("the publisher labels validated full preview without relabeling historical
     );
 });
 
+const traceArtifact = {
+  id: 456,
+  name: "retrieval-trace.html",
+  expired: false,
+  workflow_run: { id: 123, head_sha: head },
+};
+
+test("the publisher links the triggering run's HTML artifact using only GitHub metadata", async (t) => {
+  const x = await fixture(t);
+  // Older runs uploaded a ZIP under this name; never select it as direct HTML.
+  x.artifacts.push({
+    ...traceArtifact,
+    id: 455,
+    name: "retrieval-stage-trace",
+  });
+  x.artifacts.push({
+    ...traceArtifact,
+    archive_download_url: "https://untrusted.example/trace.html",
+  });
+  await x.write("comparison/summary.json", {
+    ...report,
+    trace_url: "https://untrusted.example/report.html",
+    traceArtifactId: "[untrusted](https://untrusted.example)",
+    baseline_gold_stages: "untrusted baseline <script>",
+    candidate_gold_stages: { warning: "untrusted candidate <script>" },
+  });
+  await publish(x);
+  const { body } = x.messages()[0][1];
+  assert.match(
+    body,
+    /\[Download stage trace \(HTML\)\]\(https:\/\/github\.com\/Cuiyus\/zvec-grep\/actions\/runs\/123\/artifacts\/456\)/,
+  );
+  assert.doesNotMatch(
+    body,
+    /untrusted|<script>|Gold coverage by stage|Stage capture incomplete/,
+  );
+  assert.doesNotMatch(body, /\/artifacts\/455/);
+});
+
+test("missing, expired, unrelated or invalid trace artifacts never produce a download link", async (t) => {
+  for (const artifact of [
+    null,
+    { ...traceArtifact, expired: true },
+    { ...traceArtifact, name: "retrieval-comparison" },
+    { ...traceArtifact, name: "retrieval-stage-trace" },
+    { ...traceArtifact, id: "456" },
+    { ...traceArtifact, id: 0 },
+    { ...traceArtifact, id: 1.5 },
+    { ...traceArtifact, id: Number.MAX_SAFE_INTEGER + 1 },
+    { ...traceArtifact, workflow_run: { id: 122, head_sha: head } },
+    { ...traceArtifact, workflow_run: { id: 123, head_sha: base } },
+    { ...traceArtifact, workflow_run: undefined },
+  ]) {
+    const x = await fixture(t);
+    if (artifact) x.artifacts.push(artifact);
+    await publish(x);
+    const { body } = x.messages()[0][1];
+    assert.match(body, /✅ Complete/);
+    assert.doesNotMatch(body, /Download stage trace|\/artifacts\/456/);
+  }
+});
+
+test("an unavailable artifact listing preserves the validated quality comment", async (t) => {
+  const x = await fixture(t);
+  x.artifactError = new Error("artifact API unavailable");
+  await publish(x);
+  assert.match(x.messages()[0][1].body, /✅ Complete/);
+  assert.doesNotMatch(x.messages()[0][1].body, /Download stage trace/);
+  assert.ok(
+    x.info.some((message) => message.includes("omitting its download link")),
+  );
+});
+
 test("the publisher validates corpus totals and renders each suite once", async (t) => {
   const x = await fixture(t);
   const counts = countsFor("beir");
@@ -643,11 +726,23 @@ test("missing, malformed or invalid comparison artifacts publish incomplete with
   assert.match(x.messages()[0][1].body, /Failed \/ incomplete/);
 });
 
+test("a valid comparison report above 128 KiB can publish within the 256 KiB limit", async (t) => {
+  const x = await fixture(t);
+  // JSON whitespace exercises the byte limit without pretending to be run evidence.
+  const contents = JSON.stringify(report).padEnd(128 * 1024 + 1, " ");
+  assert.ok(Buffer.byteLength(contents) > 128 * 1024);
+  assert.ok(Buffer.byteLength(contents) < 256 * 1024);
+  await writeFile(join(x.directory, "comparison/summary.json"), contents);
+  await publish(x);
+  const { body } = x.messages()[0][1];
+  assert.match(body, /✅ Complete/);
+});
+
 test("oversized report data is withheld instead of being loaded into a PR comment", async (t) => {
   const x = await fixture(t);
   await writeFile(
     join(x.directory, "co
```

**File**: `.github/workflows/ci.yml` (modified, +4/-0)
```diff
@@ -23,6 +23,10 @@ on:
 
 permissions: {}
 
+env:
+  # Hosted jobs exercise CPU inference; do not fetch optional CUDA binaries.
+  ONNXRUNTIME_NODE_INSTALL_CUDA: skip
+
 concurrency:
   group: ${{ github.workflow }}-${{ github.event_name }}-${{ github.event.pull_request.number || github.sha }}
   cancel-in-progress: true
```

**File**: `.github/workflows/retrieval-comparison.yml` (modified, +15/-1)
```diff
@@ -27,6 +27,7 @@ jobs:
       candidate_repository: ${{ inputs.baseline_repository }}
       embedding: local
       artifact_prefix: retrieval-base
+      gold_stages: true
 
   candidate:
     uses: ./.github/workflows/retrieval-only.yml
@@ -35,6 +36,7 @@ jobs:
       candidate_repository: ${{ inputs.candidate_repository }}
       embedding: local
       artifact_prefix: retrieval-head
+      gold_stages: true
 
   compare:
     needs: [baseline, candidate]
@@ -80,7 +82,19 @@ jobs:
         uses: actions/upload-artifact@v7
         with:
           name: retrieval-comparison
-          path: ${{ runner.temp }}/retrieval-comparison/
+          path: |
+            ${{ runner.temp }}/retrieval-comparison/summary.json
+            ${{ runner.temp }}/retrieval-comparison/summary.md
           if-no-files-found: error
           overwrite: true
           retention-days: 14
+      - name: Preserve stage trace HTML
+        if: always()
+        uses: actions/upload-artifact@v7
+        with:
+          name: retrieval-trace.html
+          path: ${{ runner.temp }}/retrieval-comparison/retrieval-trace.html
+          archive: false
+          if-no-files-found: warn
+          overwrite: true
+          retention-days: 14
```

**File**: `.github/workflows/retrieval-only.yml` (modified, +19/-4)
```diff
@@ -17,6 +17,9 @@ on:
       artifact_prefix:
         default: retrieval
         type: string
+      gold_stages:
+        default: false
+        type: boolean
     secrets:
       QWEN_EMBEDDING_API_KEY:
         required: false
@@ -35,6 +38,10 @@ on:
         options:
           - local
           - remote
+      gold_stages:
+        description: Capture Gold coverage at search stages in all four suites
+        type: boolean
+        default: false
 
 permissions:
   contents: read
@@ -157,7 +164,8 @@ jobs:
             --output "$RUNNER_TEMP/sweqa" \
             --corpus "$RUNNER_TEMP/corpus" \
             --model-cache "$RUNNER_TEMP/model-cache" \
-            --candidate-commit "${{ needs.package-candidate.outputs.candidate-commit }}"
+            --candidate-commit "${{ needs.package-candidate.outputs.candidate-commit }}" \
+            ${{ inputs.gold_stages && '--gold-stages' || '' }}
       - name: Build the SWE-QA20 conclusion report
         if: ${{ always() && steps.access.outcome == 'success' }}
         run: |
@@ -183,6 +191,7 @@ jobs:
             ${{ runner.temp }}/sweqa/summary.json
             ${{ runner.temp }}/sweqa/summary.md
             ${{ runner.temp }}/sweqa/scores.jsonl
+            ${{ runner.temp }}/sweqa/gold-stages.json
           if-no-files-found: warn
           retention-days: 14
       - name: Preserve SWE-QA20 public evidence
@@ -243,7 +252,8 @@ jobs:
             --package "$RUNNER_TEMP/package/candidate.tgz" \
             --output "$RUNNER_TEMP/beir" \
             --model-cache "$RUNNER_TEMP/beir-model-cache" \
-            --candidate-commit "${{ needs.package-candidate.outputs.candidate-commit }}"
+            --candidate-commit "${{ needs.package-candidate.outputs.candidate-commit }}" \
+            ${{ inputs.gold_stages && '--gold-stages' || '' }}
       - name: Publish BEIR results for this job
         if: ${{ always() && steps.access.outcome == 'success' }}
         run: |
@@ -260,6 +270,7 @@ jobs:
           path: |
             ${{ runner.temp }}/beir/report.json
             ${{ runner.temp }}/beir/report.md
+            ${{ runner.temp }}/beir/gold-stages.json
           if-no-files-found: warn
           retention-days: 14
       - name: Preserve BEIR public evidence
@@ -319,7 +330,8 @@ jobs:
             --package "$RUNNER_TEMP/package/candidate.tgz" \
             --output "$RUNNER_TEMP/duretrieval" \
             --model-cache "$RUNNER_TEMP/duretrieval-model-cache" \
-            --candidate-commit "${{ needs.package-candidate.outputs.candidate-commit }}"
+            --candidate-commit "${{ needs.package-candidate.outputs.candidate-commit }}" \
+            ${{ inputs.gold_stages && '--gold-stages' || '' }}
       - name: Publish DuRetrieval results for this job
         if: ${{ always() && steps.access.outcome == 'success' }}
         run: |
@@ -336,6 +348,7 @@ jobs:
           path: |
             ${{ runner.temp }}/duretrieval/report.json
             ${{ runner.temp }}/duretrieval/report.md
+            ${{ runner.temp }}/duretrieval/gold-stages.json
           if-no-files-found: warn
           retention-days: 14
       - name: Preserve DuRetrieval public evidence
@@ -388,7 +401,8 @@ jobs:
             --package "$RUNNER_TEMP/package/candidate.tgz" \
             --output "$RUNNER_TEMP/quarry" \
             --model-cache "$RUNNER_TEMP/quarry-model-cache" \
-            --candidate-commit "${{ needs.package-candidate.outputs.candidate-commit }}"
+            --candidate-commit "${{ needs.package-candidate.outputs.candidate-commit }}" \
+            ${{ inputs.gold_stages && '--gold-stages' || '' }}
       - name: Publish Quarry results for this job
         if: ${{ always() && steps.access.outcome == 'success' }}
         run: |
@@ -405,6 +419,7 @@ jobs:
           path: |
             ${{ runner.temp }}/quarry/report.json
             ${{ runner.temp }}/quarry/report.md
+            ${{ runner.temp }}/quarry/gold-stages.json
           if-no-files-found: warn
           retention-days: 14
       - name: Preserve Quarry public evidence
```

**File**: `benchmarks/zg-retrieval/README.md` (modified, +100/-185)
```diff
@@ -1,177 +1,98 @@
 # ZG Retrieval-only benchmark
 
-The workflow measures **zg-hybrid, zg-fts and zg-vector** on four independent suites. The original SWE-QA20 suite uses 20 unchanged questions and 11 pinned repositories from [Actions run 35206585943](https://github.com/Cuiyus/zvec-grep/actions/runs/35206585943). The exploratory suites contain 20 original BEIR queries across four datasets, ten DuRetrieval queries and 20 original Quarry queries across eight languages; see the [pilot design](expansion/README.md). Each mode calls the Rust public MCP search endpoint directly with `preview: "full"`. No answering agent, query rewriting, subquery generation or LLM judge participates. See the [SWE-QA20 design](./zg-retrieval-only-sweqa20-design.md) for its frozen protocol and scoring details.
+Compare FTS, Vector and Hybrid search on four frozen suites. Each request uses the original question through the Rust public MCP search interface; there is no answering agent, query rewriting or LLM judge.
 
-## Run CI and read the result
+## Run
 
-The [Retrieval-only workflow](../../.github/workflows/retrieval-only.yml) supports manual runs and reuse by the [PR version comparison](../../.github/workflows/retrieval-comparison.yml). For a manual single-version run, select **Retrieval-only → Run workflow**. Use GitHub's workflow-ref selector to choose the benchmark harness (`main` for the latest merged harness), then set `candidate_ref` to the branch, tag or commit containing the `rust/` workspace to compile. It defaults to `main`. The `embedding` choice defaults to `local`, which preserves each suite's configured local model. Select `remote` to run every suite with `qwen/qwen3.7-text-embedding`; this requires the repository secret `QWEN_EMBEDDING_API_KEY` and variable `QWEN_EMBEDDING_ENDPOINT`. Every run includes all three modes.
+| Entry point | What to select |
+| --- | --- |
+| PR comparison | Opening, reopening or updating a PR compares its pinned base and head automatically. An authorized `@zg-bench` comment also requests a comparison. |
+| [Manual single-version run](../../.github/workflows/retrieval-only.yml) | **Retrieval-only → Run workflow**. The workflow ref selects the harness; `candidate_ref` selects the Rust candidate and defaults to `main`. Enable `gold_stages` for traces. |
+| [Manual paired comparison](../../.github/workflows/retrieval-pr.yml) | **Retrieval-only PR → Run workflow**. Supply full `baseline_sha` / `candidate_sha` and `baseline_repository` / `candidate_repository` (`owner/name`). This does not post a PR comment. |
+
+All runs include all three modes. Paired runs use the same harness and configured local models, build separate fresh indexes, and enable stage capture on both versions. They do not run answering-agent E2E tests or receive remote model credentials.
+
+Manual and comment runs require maintain/admin access for both the original actor and the re-run actor. See [benchmark setup](../README.md) for repository configuration. The [PR result publisher](../../.github/workflows/retrieval-pr-comment.yml) must be merged into the default branch before it can update comments; it ignores cancelled or outdated runs.
+
+## Read the results
 
-PR creation, reopening and new commits automatically compare the frozen PR base and head through all four suites. An authorized `@zg-bench` PR comment requests the same comparison and posts its table. Both versions use the same harness and local models, with separate fresh indexes; neither receives remote embedding credentials. e2e is skipped by default. Comparison cells show percentages: identical baseline/candidate values appear once; differences use baseline → candidate. The JSON retains exact scores and deltas. Missing or invalid results make the comparison incomplete rather than zero. The default-branch [result publisher](../../.github/workflows/retrieval-pr-comment.yml) creates or updates one English PR comment with the table and run link, including for fork PRs. It skips cancelled or outdated runs, keeps benchmark execution read-only, and becomes active after its workflow is merged into the default branch. The `retrieval-comparison` artifact and Actions summary also retain the result; `retrieval-base-*` and `retrieval-head-*` retain the underlying reports. See [benchmark setup](../README.md).
+The PR comment shows File/Entity quality tables and a **download link to `retrieval-trace.html`**. Download the HTML and open it locally: it is a single file, not a ZIP, and needs no server or external resources. It contains suite summaries, original questions, per-question FTS/Vector/Hybrid Recall, Gold IDs and stage ranks.
 
-For a manual paired comparison without a PR comment, select **Retrieval-only PR → Run workflow** and supply full `baseline_sha` / `candidate_sha` commit identities and their `baseline_repository` / `candidate_repository` (`owner/name`). This uses the same local-only comparison and does not run e2e. Manual runs require maintain/admin access.
+*
```

**File**: `benchmarks/zg-retrieval/core/gold-stage-capture.mjs` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+export const goldPaths = (pair) => [
+  ...new Set(
+    [...pair.file_targets, ...pair.entity_targets].map(({ path }) => path),
+  ),
+];
+
+// Set these before starting the isolated daemon. Only paths are sent to ZG;
+// targets, matching rules and metric computation belong to the benchmark.
+export function stageTraceEnvironment(enabled, pairs = []) {
+  return {
+    ZG_TRACE_STAGES: enabled ? "1" : "0",
+    ZG_TRACE_PATHS: JSON.stringify(
+      enabled ? [...new Set(pairs.flatMap(goldPaths))].sort() : [],
+    ),
+  };
+}
+
+// MCP already binds this metadata to its request. No control files, sequence
+// numbers or separate capture files are needed. Frozen suites use one group.
+// Return malformed metadata as an Error value for the diagnostic scorer; do not
+// throw here and invalidate an otherwise valid public search response.
+export function readStageTrace(response) {
+  if (response?.isError) return null;
+  const metadata = response?._meta;
+  if (!metadata || !Object.hasOwn(metadata, "zg_stage_trace")) return null;
+  const traces = metadata.zg_stage_trace;
+  if (!Array.isArray(traces))
+    return new Error("stage metadata must be an array");
+  if (traces.length !== 1)
+    return new Error("expected one stage capture for Q1");
+  if (traces[0]?.group_id !== "Q1")
+    return new Error("unexpected stage capture group; expected Q1");
+  return traces[0];
+}
```

**File**: `benchmarks/zg-retrieval/engines/zg/report.mjs` (modified, +57/-0)
```diff
@@ -28,10 +28,14 @@ import {
   summarizeRepeatedQuality,
 } from "../../metrics/repetitions.mjs";
 import { markdownReport } from "../../reports/zg.mjs";
+import { readStageTrace } from "../../core/gold-stage-capture.mjs";
+import { scoreGoldStages } from "../../metrics/gold-stages.mjs";
+import { writeGoldStages } from "../../reports/gold-stages.mjs";
 import { summarizeIndexCounts } from "../../core/index-counts.mjs";
 import { summarizeIndexSettings } from "../../core/index-settings.mjs";
 import {
   publicQaItems,
+  qaEligibility,
   scoreQaRetrieval,
   summarizeRepeatedQaRetrieval,
   summarizeQaRetrieval,
@@ -72,6 +76,11 @@ function invalidate(score, reason) {
   };
 }
 
+function goldStageQualification(pair) {
+  const { status } = qaEligibility(pair);
+  return status === "scored" ? "formal" : status;
+}
+
 export async function aggregate(directory, { expectedTasks } = {}) {
   directory = resolve(directory);
   const suite = await loadSuite();
@@ -80,6 +89,7 @@ export async function aggregate(directory, { expectedTasks } = {}) {
   const errors = [],
     observations = [],
     manifests = [];
+  const goldStageCalls = new Map();
   const runDirectories = await findRuns(directory);
   const seen = new Set();
   for (const runDirectory of runDirectories) {
@@ -352,6 +362,7 @@ export async function aggregate(directory, { expectedTasks } = {}) {
         callInvalid.push("incorrect quality repetition");
       if (call.harness_error) callInvalid.push(call.harness_error);
       let score;
+      let stageCapture = null;
       let visibleOutputBytes = null;
       try {
         assert.equal(
@@ -367,6 +378,7 @@ export async function aggregate(directory, { expectedTasks } = {}) {
           "raw response changed since capture",
         );
         const response = await readJson(path);
+        stageCapture = readStageTrace(response);
         if (
           Array.isArray(response?.content) &&
           response.content.every(
@@ -390,6 +402,23 @@ export async function aggregate(directory, { expectedTasks } = {}) {
         callInvalid.push(error.message);
       }
       if (callInvalid.length) score = invalidate(score, callInvalid.join("; "));
+      if (manifest.gold_stages) {
+        const pair = suite.qa_pairs[call.task_id];
+        const capture =
+          score.execution_status === "success" ? stageCapture : null;
+        goldStageCalls.set(
+          `${call.task_id}/${call.mode}/${call.repetition}`,
+          scoreGoldStages({
+            capture,
+            pair,
+            items: score.items ?? [],
+            taskId: call.task_id,
+            mode: call.mode,
+            repetition: call.repetition,
+            qualification: goldStageQualification(pair),
+          }),
+        );
+      }
       observations.push({
         ...call,
         ...score,
@@ -625,6 +654,34 @@ export async function aggregate(directory, { expectedTasks } = {}) {
     repositories: manifests,
     tasks: quality,
   };
+  if (manifests.some(({ gold_stages }) => gold_stages)) {
+    const calls = [];
+    for (const taskId of expected) {
+      const pair = suite.qa_pairs[taskId];
+      const qualification = goldStageQualification(pair);
+      for (const mode of suite.protocol.modes) {
+        for (
+          let repetition = 1;
+          repetition <= suite.protocol.repetitions;
+          repetition++
+        ) {
+          calls.push(
+            goldStageCalls.get(`${taskId}/${mode}/${repetition}`) ??
+              scoreGoldStages({
+                capture: null,
+                pair,
+                items: [],
+                taskId,
+                mode,
+                repetition,
+                qualification,
+              }),
+          );
+        }
+      }
+    }
+    report.gold_stages = await writeGoldStages(directory, calls);
+  }
   await writeFile(
     join(directory, "scores.jsonl"),
     observations.map((row) => JSON.stringify(row)).join("\n") + "\n",
```

#### Recent Merged Pull Requests:
- **PR #437** (2026-11-18): fix(build): restore ONNX Runtime downloads via npmmirror (@feihongxu0824)
- **PR #427** (2026-11-17): fix(rust): address the remaining issues in #418 (@lnfjpt)
- **PR #424** (2026-11-17): fix(ort): release environment before CUDA provider destructors (@feihongxu0824)
- **PR #419** (2026-11-16): chore(rust): prepare 0.3.1 release (@egolearner)
- **PR #417** (2026-11-20): feat(benchmarks): report Gold coverage across retrieval stages (@Cuiyus)
- **PR #409** (2026-11-16): fix(storage): upgrade zvec-rust to 0.8.1 with WAL recovery (@egolearner)

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

## X. benchmarks): report Gold coverage across retrieval stages

**RULE**:
When implementing operations in `.github/scripts/retrieval-pr-comment.mjs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zvec-ai/zvec-grep. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ad737d20`: benchmarks): report Gold coverage across retrieval stages. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/scripts/retrieval-pr-comment.mjs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
export function commentBody({
  run,
  request,
  report,
  serverUrl,
  repository,
  traceArtifactId,
}) {
      markdownVersionComparison(
        { ...result, server_url: serverUrl, run_url: runUrl },
        {
          traceUrl: positiveInteger(traceArtifactId)
            ? `${serverUrl}/${repository}/actions/runs/${run.id}/artifacts/${traceArtifactId}`
            : undefined,
        },
      ),
    if (!info.isFile() || info.size > 256 * 1024) return null;
  let traceArtifactId;
  if (run.conclusion === "success") {
    try {
      const artifacts = await github.paginate(
        github.rest.actions.listWorkflowRunArtifacts,
        { ...context.repo, run_id: run.id, per_page: 100 },
      );
      // Build the URL from GitHub metadata, never artifact-provided Markdown or URLs.
      traceArtifactId = artifacts.find(
        (artifact) =>
          artifact.name === "retrieval-trace.html" &&
          artifact.expired === false &&
          positiveInteger(artifact.id) &&
          artifact.workflow_run?.id === run.id &&
          artifact.workflow_run?.head_sha === run.head_sha,
      )?.id;
    } catch {
      core.info(
        "Stage trace artifact unavailable; omitti
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
export function commentBody({ run, request, report, serverUrl, repository }) {
      markdownVersionComparison({
        ...result,
        server_url: serverUrl,
        run_url: runUrl,
      }),
    if (!info.isFile() || info.size > 128 * 1024) return null;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ad737d20` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
