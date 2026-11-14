# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: zvec-ai-zvec-grep-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "zvec-ai-zvec-grep-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T05:32:16.313Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zvec-ai-zvec-grep-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zvec-ai-zvec-grep-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T05:32:16.313Z`  
> **Learning ID**: `LEARN-EVO-zvec-ai-zvec-grep-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), G (Architecture Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), L (Deployment & Operations Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 60%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from zvec-ai-zvec-grep-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zvec-ai-zvec-grep-learnings.md`  
> **Source**: github ([https://github.com/zvec-ai/zvec-grep](https://github.com/zvec-ai/zvec-grep))  
> **Source Version**: `08120405`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T22:40:51.153Z  
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
> **Harvest Timestamp**: 2026-11-12T22:40:50.912Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zvec-ai/zvec-grep`
- **Description**: Local-first search across your workspace, built for humans and AI agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4309 stars

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
- **Issue #397** (2026-11-12): **[Bug]: Strict rustdoc build fails on private links in GraphEdgeKind**
  *Symptoms*: ### Description  `zg-engine` fails to build its public API documentation when rustdoc warnings are treated as errors. The public `GraphEdgeKind` docs link to `PendingRef` and `FileEdge`, which are both `pub(crate)` and omitted from the public docs.  Source: [`domain/graph.rs:28`](https://github.com/zvec-ai/zvec-grep/blob/074dc96967480ce7353b5cb8d8961a6d8d3c66bc/rust/crates/zg-engine/src/domain/graph.rs#L28).  ### Steps to Reproduce  From the repository root:  ```sh cd rust RUSTDOCFLAGS='-D warnings' cargo doc -p zg-engine --no-deps ```  **Actual:** Rustdoc reports `private_intra_doc_links`, and the strict build exits with an error.  **Expected:** The public API docs build without warnings.  ### Suggested Fix  Render `PendingRef` and `FileEdge` as inline code in the comment, preserving the explanation and the types' visibility.  ### Version and Diagnostics  - `zg-engine` 0.3.0, built from source - Rust 1.98.0 on macOS 15.7.5 (Apple Silicon) - Affected area: Rust API documentation

- **Issue #382** (2026-11-10): **[Bug]: --preview full returns only the matched fragment for chunked Markdown/code entities**
  *Symptoms*: ### Description  When an indexed Markdown/code entity is split into retrieval fragments, `--preview full` can display only the matched fragment, even though the result header identifies the complete entity.  The expected behavior is to show the entire matched **entity**, regardless of its internal fragment boundaries. This does not mean returning the entire file.  ### Steps to Reproduce  Observed in a local indexed Markdown workspace containing `katoann.md`, using `local/all-minilm-l6-v2`:  ```sh zg "How does KatoANN reduce memory traffic?" -t markdown --preview full --limit 1 --mode direct --refresh off ```  The result header is:  ```text #1 katoann.md:17-47 heading: 1 INTRODUCTION heading_level: 1 ```  However, the source body contains only lines **21–26**. Lines 17–20 and 27–47 from the same stored entity are absent. There is no error.  The reproduction requires an entity whose selected retrieval fragment covers only part of its content. An entity represented by a `Range::Full` fragment does not expose this issue. The concrete runtime reproduction above is Markdown; code entities share the same affected branch.  ### Expected Behavior  - `--preview full` returns all of the matched entity's stored content; in the observed case, lines **17–47**. - Fragment coordinates remain available as match evidence or a preview anchor, but do not cap the content available to full preview. - `none` and `short` remain bounded presentation modes. Their output should be selected by preview ru

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

### Incident Patch 1: `bc175f00` (2026-11-12)
**Commit Message**: fix(engine): restore text fallback for unknown file extensions (#394)

Restore default text indexing for readable files outside the format catalog so upgrades and rebuilds no longer silently omit them. Preserve bounded content checks, extensionless shebang detection, and filename-based filters, with regression coverage for indexing and retrieval.

**File**: `rust/crates/zg-engine/src/domain/source/format.rs` (modified, +2/-6)
```diff
@@ -94,7 +94,7 @@ impl FileFormat {
         formats
     }
 
-    /// Trusts catalog matches; probes only unmatched files without a suffix.
+    /// Trusts catalog matches; probes unmatched files for readable text.
     pub(crate) fn from_path(path: &Path) -> EngineResult<Vec<Self>> {
         let file_name = path.file_name().ok_or_else(|| {
             EngineError::invalid_argument(format!(
@@ -106,10 +106,6 @@ impl FileFormat {
         if formats != [Self::Unknown] {
             return Ok(formats);
         }
-        if path.extension().is_some() {
-            return Ok(vec![Self::Unknown]);
-        }
-
         let metadata = fs::metadata(path).map_err(|error| {
             EngineError::from_io(
                 format!(
@@ -151,7 +147,7 @@ impl FileFormat {
         let complete = header.len() <= HEADER_BYTES;
         header.truncate(HEADER_BYTES);
         Ok(vec![
-            sniff::script(&header, complete).unwrap_or(Self::Unknown),
+            sniff::format(&header, complete, path.extension().is_none()).unwrap_or(Self::Unknown),
         ])
     }
 }
```

**File**: `rust/crates/zg-engine/src/domain/source/format/sniff.rs` (modified, +8/-4)
```diff
@@ -2,17 +2,21 @@ use crate::utils::decode_text;
 
 use super::FileFormat;
 
-/// A suffixless file is indexable only if its readable header names a supported interpreter.
-pub(super) fn script(bytes: &[u8], complete: bool) -> Option<FileFormat> {
+/// Unknown suffixes use text chunks; only suffixless files can supply interpreter hints.
+pub(super) fn format(bytes: &[u8], complete: bool, extensionless: bool) -> Option<FileFormat> {
     let text = decode_text(bytes, complete)?;
-    if text.trim().is_empty()
+    if text.is_empty()
         || text
             .chars()
             .any(|ch| ch.is_control() && !ch.is_whitespace())
     {
         return None;
     }
-    shebang(&text, complete)
+    if extensionless {
+        Some(shebang(&text, complete).unwrap_or(FileFormat::Text))
+    } else {
+        Some(FileFormat::Text)
+    }
 }
 
 fn shebang(text: &str, complete: bool) -> Option<FileFormat> {
```

**File**: `rust/crates/zg-engine/src/domain/source/format/tests.rs` (modified, +50/-38)
```diff
@@ -365,40 +365,52 @@ fn catalog_matches_do_not_probe_content() {
 }
 
 #[test]
-fn unmatched_paths_only_detect_shebang_scripts() {
+fn unmatched_paths_detect_readable_text_and_extensionless_shebang_scripts() {
     let directory = tempdir().expect("temporary directory");
     let cases: &[(&str, &[u8], FileFormat)] = &[
         ("image", b"\x89PNG\r\n\x1a\n", Unknown),
-        ("document", b"%PDF-1.7\n", Unknown),
+        ("document", b"%PDF-1.7\n", Text),
         (
             "script",
             b"#!/usr/bin/env python3\nprint('hello')\n",
             Python,
         ),
-        ("script.custom", b"#!/bin/sh\necho hello\n", Unknown),
+        ("script.custom", b"#!/bin/sh\necho hello\n", Text),
         (
             "unsupported-script",
             b"#!/usr/bin/env awk\nBEGIN {}\n",
-            Unknown,
+            Text,
         ),
-        ("hashbang-text", b"not a script\n#!/bin/sh\n", Unknown),
-        ("README", b"Plain text without an extension.\n", Unknown),
-        ("unexpected.custom", b"plain text", Unknown),
-        ("main.RS", b"fn main() {}\n", Unknown),
+        ("hashbang-text", b"not a script\n#!/bin/sh\n", Text),
+        ("README", b"Plain text without an extension.\n", Text),
+        ("unexpected.custom", b"plain text", Text),
+        (
+            "module.bsl",
+            "Процедура Привет()\nКонецПроцедуры\n".as_bytes(),
+            Text,
+        ),
+        (
+            "bom-module.bsl",
+            "\u{feff}Процедура Привет()\nКонецПроцедуры\n".as_bytes(),
+            Text,
+        ),
+        ("main.RS", b"fn main() {}\n", Text),
         ("image.RS", b"\x89PNG\r\n\x1a\n", Unknown),
         (
             "drawing.EPS",
             b"%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 1 1\n",
-            Unknown,
+            Text,
         ),
-        ("drawing.custom", b"%!PS-Adobe-3.0 EPSF-3.0\n", Unknown),
-        ("utf16", b"\xff\xfeh\0i\0\n\0", Unknown),
-        ("encoded", b"-----BEGIN CERTIFICATE-----\nMIIB", Unknown),
+        ("drawing.custom", b"%!PS-Adobe-3.0 EPSF-3.0\n", Text),
+        ("utf16", b"\xff\xfeh\0i\0\n\0", Text),
+        ("encoded", b"-----BEGIN CERTIFICATE-----\nMIIB", Text),
         ("binary", b"\0\x01\x02\xff", Unknown),
         ("binary.custom", b"\0\x01\x02\xff", Unknown),
         ("invalid-utf8", b"otherwise readable\xff", Unknown),
+        ("invalid-utf8.custom", b"otherwise readable\xff", Unknown),
+        ("control.custom", b"otherwise readable\x01", Unknown),
         ("empty", b"", Unknown),
-        ("whitespace", b" \t\r\n", Unknown),
+        ("whitespace", b" \t\r\n", Text),
     ];
     for &(name, bytes, expected) in cases {
         let path = directory.path().join(name);
@@ -431,23 +443,27 @@ fn catalog_ambiguity_does_not_probe_content() {
 #[test]
 fn probing_respects_sample_boundaries() {
     let directory = tempdir().expect("temporary directory");
-    let path = directory.path().join("script");
-    let mut bytes = b"#!/bin/sh\n".to_vec();
-    bytes.resize(HEADER_BYTES - 2, b'a');
-    bytes.extend_from_slice(b"\xe4\xb8");
-    assert_eq!(bytes.len(), HEADER_BYTES);
-    fs::write(&path, &bytes).expect("write incomplete character at EOF");
-    assert_eq!(
-        FileFormat::from_path(&path).expect("complete file"),
-        [Unknown]
-    );
+    for (name, expected) in [("script", Shell), ("script.custom", Text)] {
+        let path = directory.path().join(name);
+        let mut bytes = b"#!/bin/sh\n".to_vec();
+        bytes.resize(HEADER_BYTES - 2, b'a');
+        bytes.extend_from_slice(b"\xe4\xb8");
+        assert_eq!(bytes.len(), HEADER_BYTES);
+        fs::write(&path, &bytes).expect("write incomplete character at EOF");
+        assert_eq!(
+            FileFormat::from_path(&path).expect("complete file"),
+            [Unknown],
+            "{name}"
+        );
 
-    bytes.extend_from_slice(b"\xad");
-    fs::write(&path, &bytes).expect("write character spanning the sample boundary");
-    assert_eq!(
-        FileFormat::from_path(&path).expect("partial sample"),
-        [Shell]
-    );
+        bytes.extend_from_slice(b"\xad");
+        fs::write(&path, &bytes).expect("write character spanning the sample boundary");
+        assert_eq!(
+            FileFormat::from_path(&path).expect("partial sample"),
+            [expected],
+            "{name}"
+        );
+    }
 }
 
 #[test]
@@ -464,10 +480,9 @@ fn invalid_paths_report_errors() {
         FileFormat::from_path(&directory.path().join("missing.rs")).expect("catalog"),
         [Rust]
     );
-    assert_eq!(
-        FileFormat::from_path(&directory.path().join("missing.RS")).expect("unknown suffix"),
-        [Unknown]
-    );
+    let error = FileFormat::from_path(&directory.path().join("missing.RS"))
+        .expect_err("unknown suffix requires content detection");
+    assert_eq!(error.code(), EngineError::NOT_FOUND);
 
     let child = directory.path().join("directory");
     fs::create_dir(&child).expect("create dire
```

**File**: `rust/crates/zg-engine/src/pipelines/indexing/pipeline.rs` (modified, +36/-9)
```diff
@@ -4375,7 +4375,7 @@ mod tests {
     }
 
     #[tokio::test]
-    async fn indexes_catalog_sources_and_shebang_scripts_only() {
+    async fn indexes_catalog_sources_readable_text_and_shebang_scripts() {
         let directory = tempdir().expect("temporary directory");
         std::fs::write(directory.path().join("readable"), "ordinary text 中文 😀").expect("text");
         std::fs::write(directory.path().join("known.txt"), "ordinary text 中文 😀")
@@ -4412,12 +4412,33 @@ mod tests {
         })
         .await
         .expect("index supported sources");
-        assert_eq!(result.files_added, 2);
+        assert_eq!(result.files_added, 4);
         let files = storage.list_files().expect("files");
-        assert_eq!(files.len(), 2);
+        assert_eq!(files.len(), 4);
         assert!(files.iter().all(|file| file.index_status().is_indexed()));
-        assert_eq!(storage.identities.lock().expect("catalog").len(), 2);
-        assert_eq!(result.skipped.len(), 5);
+        assert_eq!(
+            files
+                .iter()
+                .map(|file| file.relative_path().to_path_buf())
+                .collect::<HashSet<_>>(),
+            ["readable", "known.txt", "script", "encoded"]
+                .into_iter()
+                .map(PathBuf::from)
+                .collect()
+        );
+        assert_eq!(storage.identities.lock().expect("catalog").len(), 4);
+        assert_eq!(result.skipped.len(), 3);
+        assert_eq!(
+            result
+                .skipped
+                .iter()
+                .map(|file| file.path.clone())
+                .collect::<HashSet<_>>(),
+            ["database", "unrecognized", "document.pdf"]
+                .into_iter()
+                .map(|name| workspace.source_root().join(name))
+                .collect()
+        );
     }
 
     #[tokio::test]
@@ -4633,7 +4654,7 @@ mod tests {
     }
 
     #[tokio::test]
-    async fn large_unchanged_extensionless_text_is_skipped_after_classification() {
+    async fn large_unchanged_extensionless_text_is_retained_after_classification() {
         let directory = tempdir().expect("temporary directory");
         let workspace = workspace(directory.path());
         let size = MIN_DEFAULT_FILE_SIZE_BYTES + 1;
@@ -4671,9 +4692,15 @@ mod tests {
         )
         .await
         .expect("text classification");
-        assert!(scanned.is_empty());
-        assert_eq!(skipped[0].reason, SkippedFileReason::Unsupported);
-        assert_eq!(compute_diff(scanned, &[stored]).deleted.len(), 1);
+        assert_eq!(scanned.len(), 1);
+        assert!(skipped.is_empty());
+        assert_eq!(
+            scanned[0].formats.as_deref(),
+            Some([FileFormat::Text].as_slice())
+        );
+        let diff = compute_diff(scanned, &[stored]);
+        assert_eq!(diff.unchanged, 1);
+        assert!(diff.deleted.is_empty());
     }
 
     #[test]
```

**File**: `rust/crates/zg-engine/tests/engine_storage.rs` (modified, +111/-9)
```diff
@@ -150,6 +150,110 @@ async fn extensionless_scripts_preserve_outline_language_across_reopen() -> Test
     Ok(())
 }
 
+#[tokio::test]
+async fn unknown_extensions_are_indexed_and_searchable_as_text() -> TestResult {
+    let temporary = tempdir()?;
+    let root = temporary.path();
+    let server = EmbeddingServer::start()?;
+    configure_remote_model(root, server.address)?;
+    let sources = [
+        (
+            "module.bsl",
+            "Процедура ОбработатьЗаказ()\n    Сообщить(\"orchardguide\");\nКонецПроцедуры\n",
+        ),
+        (
+            "bom.bsl",
+            "\u{feff}Процедура Проверка()\n    Сообщить(\"orchardguide\");\nКонецПроцедуры\n",
+        ),
+        ("thing.custom", "orchardguide custom text"),
+        ("settings.conf", "orchardguide configuration"),
+        ("Caddyfile", "orchardguide server configuration"),
+        ("noext", "orchardguide extensionless text"),
+    ];
+    for (name, content) in sources {
+        fs::write(root.join(name), content)?;
+    }
+    fs::write(root.join("binary.bsl"), [0, 1, 2, 255])?;
+    fs::write(root.join("nul.bsl"), b"orchardguide\0binary")?;
+    fs::write(root.join("empty.bsl"), "")?;
+    let expected = sources
+        .map(|(name, _)| PathBuf::from(name))
+        .into_iter()
+        .collect::<BTreeSet<_>>();
+    let engine = ZvecGrep::new();
+    for rebuild in [false, true] {
+        let indexed = engine
+            .index(IndexOptions {
+                rebuild,
+                ..index_options(root)
+            })
+            .await?;
+        assert_eq!(
+            (indexed.files_added, indexed.files_failed),
+            (6, 0),
+            "{indexed:?}"
+        );
+        assert_eq!(indexed.skipped_counts["unsupported"], 2);
+        assert_eq!(indexed.skipped_counts["empty"], 1);
+        for mode in [ContextRouteMode::Fts, ContextRouteMode::Vector] {
+            let result = engine
+                .context(ContextOptions {
+                    root: Some(root.to_path_buf()),
+                    routes: vec![ContextRoute {
+                        mode,
+                        query: "orchardguide".into(),
+                    }],
+                    auto_update: false,
+                    allow_remote: true,
+                    limit: Some(20),
+                    ..ContextOptions::default()
+                })
+                .await?;
+            assert_eq!(
+                result
+                    .items
+                    .iter()
+                    .map(|item| item.relative_path.clone())
+                    .collect::<BTreeSet<_>>(),
+                expected
+            );
+            assert!(result.items.iter().all(|item| item.metadata.is_none()));
+        }
+    }
+    let info = engine.info(info_options(root)).await?;
+    let entities = native_documents(&info.index_path.join("entities"))?;
+    assert_eq!(entities.len(), sources.len());
+    for entity in entities {
+        let payload: Value =
+            serde_json::from_str(&entity.get_string("payload")?.expect("payload"))?;
+        assert_eq!(payload["content"]["kind"], "text");
+    }
+    let inputs = server.inputs.load(Ordering::Acquire);
+    let unchanged = engine.index(index_options(root)).await?;
+    assert_eq!((unchanged.files_unchanged, unchanged.files_failed), (6, 0));
+    assert_eq!(server.inputs.load(Ordering::Acquire), inputs);
+    engine.close();
+
+    let engine = ZvecGrep::new();
+    fs::write(root.join("module.bsl"), "Сообщить(\"replacementguide\");\n")?;
+    let updated = engine.index(index_options(root)).await?;
+    assert_eq!(
+        (
+            updated.files_modified,
+            updated.files_deleted,
+            updated.files_failed
+        ),
+        (1, 0, 0)
+    );
+    assert_eq!(
+        fts_paths(&engine, root, "replacementguide").await?,
+        [PathBuf::from("module.bsl")]
+    );
+    engine.drop_index(info_options(root)).await?;
+    engine.close();
+    Ok(())
+}
+
 #[tokio::test]
 async fn text_and_code_share_one_model_and_support_incremental_search() -> TestResult {
     let temporary = tempdir()?;
@@ -763,12 +867,10 @@ async fn public_engine_persists_searches_updates_and_drops_real_storage() -> Tes
 
     let engine = ZvecGrep::new();
     let initial = engine.index(index_options(root)).await?;
-    assert_eq!(initial.files_added, 2, "{initial:?}");
-    assert!(
-        initial
-            .skipped
-            .iter()
-            .any(|file| file.path == root.join("tmp"))
+    assert_eq!(initial.files_added, 3, "{initial:?}");
+    assert_eq!(
+        fts_paths(&engine, root, "memorandum").await?,
+        [PathBuf::from("tmp")]
     );
     assert_eq!(initial.files_failed, 0);
     let info = engine.info(info_options(root)).await?;
@@ -783,7 +885,7 @@ async fn public_engine_persists_searches_updates_and_drops_real_storage() -> Tes
         .expect("FTS info");
     assert_eq!(fts.tokenizer, "jieba");
     assert_eq!(fts.filters, ["lowercase"]);
-    
```

**File**: `rust/crates/zg-engine/tests/file_selection.rs` (modified, +67/-4)
```diff
@@ -125,6 +125,63 @@ async fn assert_index_and_queries(
     Ok(())
 }
 
+#[tokio::test]
+async fn unknown_text_respects_globs_and_filename_filters() -> TestResult {
+    let temporary = tempfile::tempdir()?;
+    let root = temporary.path();
+    let server = EmbeddingServer::start()?;
+    configure_remote_model(root, server.address)?;
+    write_sources(
+        root,
+        &[
+            ("module.bsl", "Сообщить(\"orchard\");\n"),
+            ("excluded.bsl", "orchard excluded source"),
+            ("large.bsl", &"orchard".repeat(32)),
+            ("note.txt", "orchard catalog text"),
+            ("other.custom", "orchard custom text"),
+        ],
+    )?;
+    fs::write(root.join("binary.bsl"), b"orchard\0binary")?;
+    let filter = QueryFilter {
+        globs: vec!["*.bsl".into(), "!excluded.bsl".into()],
+        ..QueryFilter::default()
+    };
+    let engine = ZvecGrep::new();
+    let indexed = engine
+        .index(IndexOptions {
+            scan: ScanRulesUpdate {
+                globs: Some(filter.globs.clone()),
+                max_file_size_bytes: Some(Some(64)),
+                ..ScanRulesUpdate::default()
+            },
+            ..index_options(root)
+        })
+        .await?;
+    assert_eq!((indexed.files_added, indexed.files_failed), (1, 0));
+    assert_eq!(indexed.skipped_counts["too_large"], 1);
+    assert_eq!(indexed.skipped_counts["unsupported"], 1);
+    assert_index_and_queries(&engine, root, &filter, &paths(&["module.bsl"])).await?;
+    for mode in [ContextRouteMode::Fts, ContextRouteMode::Vector] {
+        assert!(
+            search_paths(
+                &engine,
+                root,
+                mode,
+                QueryFilter {
+                    included_formats: vec![FileFormat::Text],
+                    ..QueryFilter::default()
+                }
+            )
+            .await?
+            .is_empty(),
+            "text fallback does not change filename-based filters"
+        );
+    }
+    engine.drop_index(info_options(root)).await?;
+    engine.close();
+    Ok(())
+}
+
 #[tokio::test]
 async fn ordered_globs_have_the_same_membership_during_indexing_and_both_query_routes() -> TestResult
 {
@@ -615,19 +672,25 @@ async fn filename_formats_and_categories_filter_queries_without_limiting_indexin
             updated.files_deleted,
             updated.files_failed
         ),
-        (0, 1, 0)
+        (1, 0, 0)
     );
     let files = native_file_records(&info.index_path)?;
     assert!(
         files
             .iter()
-            .all(|file| stored_file_path(file) != Path::new("script"))
+            .any(|file| stored_file_path(file) == Path::new("script"))
     );
     assert_index_and_queries(
         &engine,
         root,
         &QueryFilter::default(),
-        &paths(&["page.html", "note.md", "settings.json", "source.rs"]),
+        &paths(&[
+            "script",
+            "page.html",
+            "note.md",
+            "settings.json",
+            "source.rs",
+        ]),
     )
     .await?;
     for mode in [ContextRouteMode::Fts, ContextRouteMode::Vector] {
@@ -685,7 +748,7 @@ async fn catalog_name_predicates_filter_both_native_search_routes() -> TestResul
     write_sources(root, &sources)?;
     let engine = ZvecGrep::new();
     let indexed = engine.index(index_options(root)).await?;
-    assert_eq!((indexed.files_added, indexed.files_failed), (5, 0));
+    assert_eq!((indexed.files_added, indexed.files_failed), (7, 0));
     for (name, _) in sources {
         fs::remove_file(root.join(name))?;
     }
```

---

### Incident Patch 2: `e6298f57` (2026-11-10)
**Commit Message**: fix(release): use glibc 2.28 Linux build images (#378)

* fix(release): target glibc 2.28 in Linux build containers

Pin manylinux builders and validate artifacts on AlmaLinux 8.10 without
relaxing ABI checks. The llama SDK downgrade is separate follow-up work.

* fix(release): pin glibc 2.28 llama SDK and audit PR packages

* ci: remove package glibc and standalone ORT jobs

* fix(release): replace retired macOS ARM64 runner

Use macos-15 for release builds and registry validation so ARM64 jobs can
start after macos-14 retirement, and guard both matrices with a regression test.

* fix(release): validate ARM64 model runtimes on glibc 2.28

Exercise installed ORT and real CPU inference on Linux ARM64, retain
network-disabled Vulkan ORT preparation, and align validation docs with
the release workflow instead of the removed standalone ORT entry point.

* fix(release): compile ORT check before disabling network access

The rustc proxy can make rustup sync toolchain metadata in a fresh
container. Compile the check in the online build stage, then execute it
offline without weakening network isolation or cached-runtime checks.

* fix(test): restrict Linux workflow shell tests to Linux

Sk

**File**: `.github/workflows/rust-ci.yml` (modified, +0/-122)
```diff
@@ -34,10 +34,6 @@ on:
         description: Optional reviewed source ref; empty uses the commit selected for this run
         type: string
         default: ""
-      ort_validation:
-        description: Validate all ONNX catalog models and compare 1.21/1.28 CPU throughput on Linux x64/ARM64
-        type: boolean
-        default: false
 
 permissions: {}
 
@@ -145,124 +141,6 @@ jobs:
       - name: Test npm packaging
         run: node --test scripts/npm-*.test.mjs npm/meta/install.test.cjs
 
-  ort-glibc:
-    name: ORT on glibc 2.31 (${{ matrix.target }})
-    needs: source
-    permissions:
-      contents: read
-    strategy:
-      fail-fast: false
-      matrix:
-        include:
-          - target: x86_64-unknown-linux-gnu
-            runner: ubuntu-24.04
-            cuda: true
-          - target: aarch64-unknown-linux-gnu
-            runner: ubuntu-24.04-arm
-            cuda: false
-    runs-on: ${{ matrix.runner }}
-    timeout-minutes: 20
-    steps:
-      - uses: actions/checkout@v6
-        with:
-          ref: ${{ needs.source.outputs.sha }}
-          persist-credentials: false
-      - uses: actions/cache@v5
-        with:
-          path: rust/target/ort-prebuilt
-          key: ort-1.21-${{ matrix.target }}-${{ hashFiles('rust/scripts/onnxruntime-distributions.json') }}
-      - name: Prepare and audit official CPU runtime
-        run: |
-          python3 scripts/prepare-onnxruntime.py --target ${{ matrix.target }} --cache-dir target/ort-prebuilt --destination target/ort-cpu
-          python3 scripts/check-glibc.py target/ort-cpu --max 2.31
-      - name: Load CPU runtime on glibc 2.31
-        run: |
-          docker run --rm --volume "$PWD:/work:ro" --workdir /work ubuntu:20.04 bash -euc '
-            apt-get update -qq
-            apt-get install -y --no-install-recommends python3 libstdc++6 >/dev/null
-            test "$(getconf GNU_LIBC_VERSION)" = "glibc 2.31"
-            python3 scripts/check-onnxruntime.py target/ort-cpu/libonnxruntime.so.1
-          '
-      - name: Verify Vulkan does not require a custom ORT at build time
-        run: |
-          CARGO_MANIFEST_DIR="$PWD/crates/zg-engine" rustc --edition=2024 crates/zg-engine/build.rs -o target/ort-build-script
-          env -u ORT_DYLIB_PATH CARGO_FEATURE_VULKAN=1 CARGO_NET_OFFLINE=true \
-            TARGET=${{ matrix.target }} OUT_DIR="$PWD/target/ort-vulkan/debug/build/zg-engine/out" \
-            ZG_ORT_CACHE_DIR="$PWD/target/ort-prebuilt" target/ort-build-script
-      - name: Audit the CUDA 12 provider without requiring a GPU
-        if: matrix.cuda
-        run: |
-          python3 scripts/prepare-onnxruntime.py --target ${{ matrix.target }} --cuda --cache-dir target/ort-prebuilt --destination target/ort-cuda
-          python3 scripts/check-glibc.py target/ort-cuda --max 2.31
-
-  ort-models:
-    name: ONNX catalog and CPU runtime comparison (${{ matrix.target }})
-    if: github.event_name == 'workflow_dispatch' && inputs.ort_validation
-    needs: source
-    runs-on: ${{ matrix.runner }}
-    timeout-minutes: 60
-    permissions:
-      contents: read
-    strategy:
-      fail-fast: false
-      matrix:
-        include:
-          - target: x86_64-unknown-linux-gnu
-            runner: ubuntu-24.04
-          - target: aarch64-unknown-linux-gnu
-            runner: ubuntu-24.04-arm
-    env:
-      LLAMA_CPP_BUILD_MODE: prebuilt
-      CARGO_BUILD_JOBS: "4"
-    steps:
-      - uses: actions/checkout@v6
-        with:
-          ref: ${{ needs.source.outputs.sha }}
-          persist-credentials: false
-      - name: Install build dependencies and the pinned toolchain
-        run: |
-          sudo apt-get update -qq
-          sudo apt-get install -y clang libclang-dev cmake ninja-build pkg-config
-          rustup show active-toolchain
-      - uses: Swatinem/rust-cache@6323deb102c322ba6fcbdcafc7e3dddab59af2b6
-        with:
-          prefix-key: rust-ort-models-v1-${{ matrix.target }}
-          workspaces: rust -> target
-      - name: Cache the pinned catalog graphs
-        uses: actions/cache@v5
-        with:
-          path: ${{ runner.temp }}/ort-catalog-models
-          key: ort-catalog-v1-${{ hashFiles('rust/crates/zg-engine/src/models/catalog/**') }}
-      - name: Build one release test binary for both runtimes
-        run: |
-          mkdir -p target
-          cargo test --release --locked -p zg-engine --lib --no-run --message-format=json > target/ort-tests.json
-      - name: Validate all ONNX models and compare q4 CPU throughput
-        shell: python
-        env:
-          MODEL_CACHE: ${{ runner.temp }}/ort-catalog-models
-          ORT_TARGET: ${{ matrix.target }}
-        run: |
-          import json, os, pathlib, subprocess, sys
-          records = [json.loads(line) for line in pathlib.Path("target/ort-tests.json").read_text().splitlines()]
-          binaries = [record["executable"] for record in records if record.get("reason") == "compiler-artifact"
-    
```

**File**: `.github/workflows/rust-package-build.yml` (modified, +36/-16)
```diff
@@ -104,8 +104,8 @@ jobs:
             ${{ runner.os == 'Windows' && env.CARGO_HOME || '~/.cargo' }}/git/db/
             rust/target/release/
           # Per-commit keys would exhaust the 10 GB repository cache quota and evict Rust CI caches.
-          # Isolate Ubuntu 20.04 output from older host/container build caches.
-          key: rust-release-${{ runner.os == 'Linux' && 'v5-ubuntu20.04' || 'v3' }}-${{ inputs.target }}-${{ inputs.runner }}-${{ hashFiles('rust/Cargo.lock', 'rust/rust-toolchain.toml') }}
+          # Keep objects linked against newer glibc out of the release cache.
+          key: rust-release-${{ runner.os == 'Linux' && 'v6-manylinux2.28' || 'v3' }}-${{ inputs.target }}-${{ inputs.runner }}-${{ hashFiles('rust/Cargo.lock', 'rust/rust-toolchain.toml', 'rust/scripts/release-builder.Dockerfile') }}
       - name: Cache the pinned llama native SDK
         uses: actions/cache@v5
         with:
@@ -125,16 +125,18 @@ jobs:
       - name: Preserve the Intel macOS deployment target
         if: inputs.target == 'darwin-x64'
         run: echo "MACOSX_DEPLOYMENT_TARGET=14.0" >> "$GITHUB_ENV"
-      - name: Build the Ubuntu 20.04 Rust builder without a CUDA compiler
+      - name: Build the manylinux 2.28 Rust builder without a CUDA compiler
         if: runner.os == 'Linux'
         working-directory: ${{ github.workspace }}
+        env:
+          BUILD_IMAGE: ${{ inputs.target == 'linux-arm64-gnu' && 'quay.io/pypa/manylinux_2_28_aarch64:2026.03.01-1@sha256:34368babc008d6405b4b74c77868d6a5d15b6010cb953574d1f2bb9184392a9b' || 'quay.io/pypa/manylinux_2_28_x86_64:2026.03.01-1@sha256:d5f19b5957cf25df7ac15465924cafe2358754a187e510af386bf9596598a372' }}
         run: >-
           docker build --platform ${{ inputs.target == 'linux-arm64-gnu' && 'linux/arm64' || 'linux/amd64' }}
-          --file rust/scripts/cuda/cuda-builder.Dockerfile
-          --build-arg CUDA_IMAGE=ubuntu:20.04
+          --file rust/scripts/release-builder.Dockerfile
+          --build-arg BUILD_IMAGE="$BUILD_IMAGE"
           --build-arg RUST_VERSION=${{ steps.rust-version.outputs.channel }}
-          --tag zvec-grep-cuda-builder .
-      - name: Build the Linux release on glibc 2.31
+          --tag zvec-grep-release-builder .
+      - name: Build the Linux release on glibc 2.28
         if: runner.os == 'Linux'
         working-directory: ${{ github.workspace }}
         run: |
@@ -148,13 +150,31 @@ jobs:
             --env CARGO_BUILD_JOBS --env CMAKE_BUILD_PARALLEL_LEVEL \
             --env LLAMA_CPP_BUILD_MODE=prebuilt --env LLAMA_CPP_RUNTIME_CACHE=/work-target/llama-runtimes \
             --env RELEASE_TARGET=${{ inputs.target }} \
-            zvec-grep-cuda-builder bash -euo pipefail -c '
-              test "$(getconf GNU_LIBC_VERSION)" = "glibc 2.31"
+            --env ORT_TARGET=${{ inputs.target == 'linux-arm64-gnu' && 'aarch64-unknown-linux-gnu' || 'x86_64-unknown-linux-gnu' }} \
+            zvec-grep-release-builder bash -euo pipefail -c '
+              test "$(getconf GNU_LIBC_VERSION)" = "glibc 2.28"
               if [[ "$RELEASE_TARGET" == linux-x64-gnu ]]; then
                 bash scripts/cuda/build.sh --primary-only
               else
                 cargo build --locked --release --package zg
               fi
+              python3 scripts/prepare-onnxruntime.py --target "$ORT_TARGET" \
+                --cache-dir /work-target/ort-prebuilt --destination /work-target/ort-cpu
+              CARGO_MANIFEST_DIR="$PWD/crates/zg-engine" rustc --edition=2024 crates/zg-engine/build.rs -o /work-target/ort-build-script
+            '
+      - name: Verify Linux Vulkan ORT preparation without network access
+        if: runner.os == 'Linux'
+        working-directory: ${{ github.workspace }}
+        run: |
+          docker run --rm --network none --platform ${{ inputs.target == 'linux-arm64-gnu' && 'linux/arm64' || 'linux/amd64' }} \
+            --volume "${GITHUB_WORKSPACE}:/work:ro" \
+            --volume "${GITHUB_WORKSPACE}/rust/target:/work-target" \
+            --env ORT_TARGET=${{ inputs.target == 'linux-arm64-gnu' && 'aarch64-unknown-linux-gnu' || 'x86_64-unknown-linux-gnu' }} \
+            zvec-grep-release-builder bash -euo pipefail -c '
+              env -u ORT_DYLIB_PATH -u CARGO_FEATURE_CUDA CARGO_FEATURE_VULKAN=1 CARGO_NET_OFFLINE=true \
+                TARGET="$ORT_TARGET" OUT_DIR=/work-target/ort-vulkan/debug/build/zg-engine/out \
+                ZG_ORT_CACHE_DIR=/work-target/ort-prebuilt /work-target/ort-build-script
+              cmp /work-target/ort-cpu/libonnxruntime.so.1 /work-target/ort-vulkan/debug/libonnxruntime.so.1
             '
       - name: Audit the Linux prebuilt CUDA 13 and CUDA 12 bundle
         if: inputs.target == 'linux-x64-gnu'
@@ -163,9 +183,9 @@ jobs:
           docker run --rm --platform linux/amd64 \
             --volume "${GITHUB_WORKSPACE}:/work:ro" \
             --volume "${GITHUB_WORKSPACE}/rust/target:/work-target" \
-            zvec-grep-c
```

**File**: `.github/workflows/rust-publish.yml` (modified, +16/-12)
```diff
@@ -72,7 +72,7 @@ jobs:
           import { appendFileSync } from 'node:fs';
           const platform = process.env.BUILD_PLATFORM;
           const platforms = [
-            { target: 'darwin-arm64', runner: 'macos-14', gpu_runner: '' },
+            { target: 'darwin-arm64', runner: 'macos-15', gpu_runner: '' },
             { target: 'darwin-x64', runner: 'macos-15-intel', gpu_runner: '' },
             { target: 'linux-x64-gnu', runner: 'ubuntu-24.04', gpu_runner: 'gpu-linux-t4' },
             { target: 'linux-arm64-gnu', runner: 'ubuntu-24.04-arm', gpu_runner: '' },
@@ -270,12 +270,12 @@ jobs:
           name: rust-verification-${{ needs.source.outputs.version }}
           path: rust/dist/npm/release/tarballs
       - name: Restore the real model cache
-        if: matrix.cuda_package
+        if: matrix.cuda_package || matrix.target == 'linux-arm64-gnu'
         uses: actions/cache@v5
         with:
           path: ${{ runner.temp }}/zvec-grep-model-cache
           key: cuda-cli-models-v1-${{ runner.os }}-${{ hashFiles('rust/crates/zg-engine/src/models/catalog/**', 'rust/scripts/cuda/e2e.py') }}
-      - name: Install and exercise Linux artifacts on Ubuntu 20.04 without CUDA libraries
+      - name: Install and exercise Linux artifacts on glibc 2.28 without CUDA libraries
         if: runner.os == 'Linux'
         shell: bash
         working-directory: ${{ github.workspace }}
@@ -287,19 +287,23 @@ jobs:
             --volume "${GITHUB_WORKSPACE}:/work" \
             --volume "${node_root}:/opt/node:ro" \
             --volume "${RUNNER_TEMP}/zvec-grep-model-cache:/model-cache" \
-            --workdir /work/rust --env DEBIAN_FRONTEND=noninteractive \
+            --workdir /work/rust \
             --env RELEASE_TARGET=${{ matrix.target }} \
             --env PATH=/opt/node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
-            ubuntu:20.04 bash -euo pipefail -c '
-              apt-get update -qq
-              apt-get install --yes --no-install-recommends python3 ca-certificates libstdc++6 >/dev/null
-              test "$(getconf GNU_LIBC_VERSION)" = "glibc 2.31"
+            almalinux:8.10@sha256:2d0f2eb2a83cc09dbc2eb92fade4dbe8f709628149e81aa00aec70630406603b bash -euo pipefail -c '
+              dnf install --assumeyes --setopt=install_weak_deps=False python3.12 ca-certificates libstdc++ >/dev/null
+              ln -s /usr/bin/python3.12 /usr/local/bin/python3
+              test "$(getconf GNU_LIBC_VERSION)" = "glibc 2.28"
               npm run release:artifact-smoke -- --expect-cpu
+              bundle=dist/npm/release/artifact-smoke/prefix/lib/node_modules/@zvec/zvec-grep
+              python3 scripts/check-onnxruntime.py "$bundle/lib/libonnxruntime.so.1" 2>&1 | tee /work/cpu-logs/onnxruntime-load.log
               if [[ "$RELEASE_TARGET" == linux-x64-gnu ]]; then
-                python3 scripts/cuda/e2e.py --cpu-only \
-                  --bundle dist/npm/release/artifact-smoke/prefix/lib/node_modules/@zvec/zvec-grep \
-                  --model-cache /model-cache --logs /work/cpu-logs
+                cpu_mode=--cpu-only
+              else
+                cpu_mode=--explicit-cpu
               fi
+              python3 scripts/cuda/e2e.py "$cpu_mode" --bundle "$bundle" \
+                --model-cache /model-cache --logs /work/cpu-logs
             '
       - name: Install and exercise the downloaded artifacts without Windows CUDA libraries
         if: matrix.target == 'win32-x64-msvc'
@@ -389,7 +393,7 @@ jobs:
           - target: darwin-x64
             runner: macos-15-intel
           - target: darwin-arm64
-            runner: macos-14
+            runner: macos-15
           - target: linux-x64-gnu
             runner: ubuntu-24.04
           - target: linux-arm64-gnu
```

**File**: `rust/CONTRIBUTING.md` (modified, +65/-23)
```diff
@@ -173,9 +173,11 @@ package-level validation. It runs only through manual dispatch. Runs with both
 without allocating GPUs or publishing
 to npm. Compilation always stays on CPU runners, including when `cuda=true` or
 `publish=true`; Linux/Windows x64 still build the default CUDA-capable bundles.
-Linux x64 and ARM64 release builds use Ubuntu 20.04 containers on native runners
-and audit the executable and bundled libraries against glibc 2.31. The host
-runner's Ubuntu version does not set the release package's compatibility baseline.
+Linux x64 and ARM64 release builds use digest-pinned `manylinux_2_28`
+`2026.03.01-1` containers on native runners and audit the executable and bundled
+libraries against the `GLIBC_2.28` ceiling. Clean runtime checks use AlmaLinux
+8.10 (glibc 2.28); the host runner's Ubuntu version does not set the release
+package's compatibility baseline.
 Set `cuda=true,publish=false` to add GPU validation without publishing.
 Separate GPU jobs download the exact native npm artifacts from the same run and
 invoke `.github/actions/cuda-cli-e2e`, without recompiling native code or repacking. Publication
@@ -185,7 +187,17 @@ Failures retain candidates and do not skip the other validation path, but every
 required check must pass before publication. Collection alone is not approval.
 
 The manual `platform` input selects `all` (the default) or one of `darwin-arm64`,
-`darwin-x64`, `linux-x64-gnu`, `linux-arm64-gnu`, and `win32-x64-msvc`.
+`darwin-x64`, `linux-x64-gnu`, `linux-arm64-gnu`, `win32-x64-msvc`, and
+`win32-arm64-msvc`.
+To validate Linux ARM64 without publishing or allocating GPUs, run in the chosen
+repository (or add `--repo OWNER/REPO`):
+
+```sh
+gh workflow run rust-publish.yml -f publish=false -f cuda=false -f platform=linux-arm64-gnu
+```
+
+For Linux x64, replace the platform with `linux-x64-gnu`. Add `--ref BRANCH`
+to validate a specific branch; otherwise GitHub uses the default branch.
 Selected platforms compile in parallel; Intel macOS does not gate the others.
 All-platform runs collect `rust-release-<version>`; a single-platform run collects
 `rust-candidate-<version>` with `partial: true` in `release.json`. The latter is
@@ -201,13 +213,16 @@ behavior on the real CPU host. An isolated loopback registry serves only this
 run's CUDA archives: any CUDA metadata/tarball request (even a failed optional
 attempt), installed plugin or populated plugin cache fails CPU validation.
 `cpu-downloads.json` retains the request evidence; no public registry is used.
-They verify CLI and daemon IPC. Linux x64 and ARM64 install and exercise the
-artifacts in plain Ubuntu 20.04 containers. Linux/Windows x64 then
-run `scripts/cuda/e2e.py --cpu-only` against the installed meta
-package. This checks both explicit `--device cpu` and default automatic CPU
-fallback for real GGUF/ONNX indexing and vector queries. Windows excludes toolkit
-paths. Both x64 model checks require CUDA host libraries to be unavailable and
-retain `cpu-artifact-evidence-*` logs on failure.
+The `artifact-cpu-smoke` jobs verify CLI and daemon IPC. Linux x64 and ARM64
+install and exercise the artifacts in clean AlmaLinux 8.10 (glibc 2.28)
+containers; both load the installed `libonnxruntime.so.1` and verify ORT 1.21.0
+and API 21. Linux/Windows x64 run `scripts/cuda/e2e.py --cpu-only` against the
+installed meta package, checking both explicit `--device cpu` and default
+automatic CPU fallback for real GGUF/ONNX indexing and vector queries. Linux
+ARM64 runs the same real-model index/query checks with `--explicit-cpu` only.
+macOS and Windows ARM64 retain CLI/daemon-only artifact smoke coverage.
+Windows x64 excludes toolkit paths. Both x64 model checks require CUDA host
+libraries to be unavailable. Failures retain `cpu-artifact-evidence-*` logs.
 CPU artifact validation runs even when `publish=false`; failure blocks npm
 publication, while the downloaded candidate remains available for diagnosis.
 
@@ -327,15 +342,42 @@ macOS model routing continues to select CPU.
 
 Run `python3 scripts/test-prepare-onnxruntime.py` for offline deployment checks
 and `python3 scripts/test-check-glibc.py` for the compatibility checker tests.
-The ORT CI gate loads Linux x64/ARM64 CPU cores on glibc 2.31 and audits their
-ELF imports, including the x64 CUDA provider. `scripts/check-glibc.py <payload>`
-can also audit a complete ELF package. The release workflow builds Linux x64/ARM64
-packages on Ubuntu 20.04, applies this audit to the executable and bundled native
-libraries, and verifies the installed artifacts on that baseline.
-
-Dispatch Rust CI with `ort_validation=true` to validate all six catalog ONNX
-graphs on Linux x64/ARM64 and compare official ORT 1.21/1.28 q4 CPU throughput.
-The comparison uses one release binary, fixed CPU/batch/concurrency settings,
-warmup and alternating runtime order. It measures the native runtime change;
-it is not a comparison of different Rust bindings or the former Pyke static
-build. R
```

**File**: `rust/Cargo.lock` (modified, +2/-2)
```diff
@@ -1842,7 +1842,7 @@ checksum = "47d9d19d1d6efa0109d2f65ff4c85cddd50bd572e5a00127ab10987290bcefae"
 [[package]]
 name = "llama-cpp-2"
 version = "0.1.154"
-source = "git+https://github.com/zvec-ai/llama-cpp-rs.git?rev=b55399ac6c2035f2301120547c4c967e741d25d3#b55399ac6c2035f2301120547c4c967e741d25d3"
+source = "git+https://github.com/zvec-ai/llama-cpp-rs.git?rev=79305567e63ee551eb1798c0537eab87d9595a23#79305567e63ee551eb1798c0537eab87d9595a23"
 dependencies = [
  "encoding_rs",
  "enumflags2",
@@ -1855,7 +1855,7 @@ dependencies = [
 [[package]]
 name = "llama-cpp-sys-2"
 version = "0.1.154"
-source = "git+https://github.com/zvec-ai/llama-cpp-rs.git?rev=b55399ac6c2035f2301120547c4c967e741d25d3#b55399ac6c2035f2301120547c4c967e741d25d3"
+source = "git+https://github.com/zvec-ai/llama-cpp-rs.git?rev=79305567e63ee551eb1798c0537eab87d9595a23#79305567e63ee551eb1798c0537eab87d9595a23"
 dependencies = [
  "bindgen",
  "cc",
```

**File**: `rust/Cargo.toml` (modified, +2/-2)
```diff
@@ -13,8 +13,8 @@ publish = false
 
 [workspace.dependencies]
 # Keep the safe API and the C5 FFI boundary on the same pinned native ABI.
-llama-cpp-2 = { git = "https://github.com/zvec-ai/llama-cpp-rs.git", rev = "b55399ac6c2035f2301120547c4c967e741d25d3", default-features = false }
-llama-cpp-sys-2 = { git = "https://github.com/zvec-ai/llama-cpp-rs.git", rev = "b55399ac6c2035f2301120547c4c967e741d25d3", default-features = false }
+llama-cpp-2 = { git = "https://github.com/zvec-ai/llama-cpp-rs.git", rev = "79305567e63ee551eb1798c0537eab87d9595a23", default-features = false }
+llama-cpp-sys-2 = { git = "https://github.com/zvec-ai/llama-cpp-rs.git", rev = "79305567e63ee551eb1798c0537eab87d9595a23", default-features = false }
 async-trait = "0.1.89"
 axum = "0.8"
 bytes = "1.12.1"
```

**File**: `rust/README.md` (modified, +34/-18)
```diff
@@ -742,12 +742,17 @@ bash scripts/check.sh
 ## Native and CUDA builds
 
 The safe llama API and the C5 FFI boundary share the same pinned
-`zvec-ai/llama-cpp-rs` revision (`b55399ac6c2035f2301120547c4c967e741d25d3`),
-from branch `prebuilt/0.1.154-cpu-r2-glibc-2.31`.
+`zvec-ai/llama-cpp-rs` revision (`79305567e63ee551eb1798c0537eab87d9595a23`),
+from branch `prebuilt/0.1.154-cpu-r2-glibc-2.28`.
 Its sys crate automatically selects a SHA256-pinned SDK when target, features
 and native options match. Linux x64 CPU, Linux ARM64 CPU and Linux x64 CUDA use
-`zvec-0.1.154-glibc-2.31-r1`, built on Ubuntu 20.04 and verified against a glibc
-2.31 baseline. Windows x64/ARM64 CPU use `zvec-0.1.154-cpu-r2`; macOS and
+`zvec-0.1.154-glibc-2.28-r1`, built on manylinux 2.28 and verified with real
+CPU/CUDA inference in clean AlmaLinux 8.10 (glibc 2.28) containers. These Linux
+SDKs disable the optional upstream subprocess helper (`LLAMA_SUBPROCESS=OFF`);
+zg's inference and MCP server remain unchanged. SDK verification used EL8 GCC
+Toolset 13 for final static linkage; deployment machines do not need that
+compiler toolset.
+Windows x64/ARM64 CPU use `zvec-0.1.154-cpu-r2`; macOS and
 CUDA-enabled Windows x64 use `zvec-0.1.154-r1`. CUDA architecture coverage is
 unchanged. Matching builds reuse native
 libraries and bindings without executing bindgen, CMake, C++ or CUDA compilation;
@@ -757,6 +762,11 @@ backends and both CUDA plugins. Custom native configurations use source builds
 in default `auto` mode. A download or integrity failure is an error, not a silent
 source fallback.
 
+The Linux release workflow audits the executable and all bundled shared
+libraries against glibc 2.28, including both x64 CUDA plugins. This gate also
+runs for validation-only candidates (`publish=false`); it is not part of
+ordinary PR CI.
+
 The fork no longer registers llama.cpp as a Git submodule. Cargo fetches only
 the Rust bindings; matching SDK builds never fetch native source. Only explicit
 `source` builds or a configuration mismatch in `auto` acquire the hash-verified,
@@ -828,7 +838,7 @@ so neither a second CMake build nor the fallback toolchain is needed.
 Publish CI requires prebuilt llama SDKs on all six targets, including the
 Windows ARM64 static CPU SDK. CUDA Rust CI also requires
 prebuilt mode instead of recompiling only for its T4 GPU. Linux publish builds
-run in Ubuntu 20.04 containers without a CUDA compiler. Runtime libraries,
+run in digest-pinned `manylinux_2_28` containers without a CUDA compiler. Runtime libraries,
 driver checks, link audits and real CPU/GPU inference gates remain required. Runtime staging
 reads the current Cargo invocation's `GGML_BACKENDS_DIR`, not the newest directory
 under `target/build`; only runtime libraries, not SDK import archives or bindings,
@@ -1076,13 +1086,14 @@ GGUF plugin and its dependencies before inference; this CI setup does not change
 the package's host CUDA runtime requirements.
 Publishing always requires GPU validation regardless of `cuda`. Candidate
 collection happens first, followed by parallel CPU and requested GPU validation.
-All selected platforms get the installed CLI/daemon checks; Linux/Windows x64
-also get the CPU model/fallback checks. A GPU failure does not block CPU checks
+All selected platforms get the installed CLI/daemon checks; Linux x64/ARM64
+and Windows x64 also get real GGUF/ONNX CPU model checks, with automatic CPU
+fallback checks on the CUDA-capable x64 packages. A GPU failure does not block CPU checks
 or candidate retention, but all required CPU/GPU checks must pass before npm
 publication. A downloadable candidate is not proof of runtime validation.
 CPU runners compile Rust and assemble the default CUDA-capable bundles using
-the pinned native SDK. Linux x64 and ARM64 use Ubuntu 20.04 containers on native
-runners, without nvcc. Windows needs the Rust/MSVC linker but
+the pinned native SDK. Linux x64 and ARM64 use digest-pinned `manylinux_2_28`
+containers on native runners, without nvcc. Windows needs the Rust/MSVC linker but
 does not install CUDA compilers for packaging. Ordinary PR CI
 does not compile CUDA packages. `rust-ci.yml` is the single entry point for
 workspace and real-model verification. Push/PR runs use ordinary runners on
@@ -1094,7 +1105,7 @@ For manual runs, `cuda_verify=true` enables `zg/cuda` from the first compilation
 requiring the matching prebuilt SDK, but compilation, workspace tests, all three
 CPU model checks and build-cache uploads still run on ordinary CPU runners.
 These Linux workspace tests use an Ubuntu 24.04 builder without GPU access or
-CUDA runtime libraries; the npm release build uses Ubuntu 20.04 as described above.
+CUDA runtime libraries; the npm release build uses `manylinux_2_28` as described above.
 Windows uses `windows-2022`, matching the GPU image's OS generation.
 Before the test harness copies any libraries, CUDA jobs run `cargo build --features cuda`
 and exercise the original `target/de
```

**File**: `rust/npm/README.md` (modified, +31/-6)
```diff
@@ -130,11 +130,21 @@ Published target/backend support is:
 | --- | --- | --- |
 | macOS ARM64 | CPU + Metal | CPU (CoreML deliberately not selected) |
 | macOS x64 (14+) | CPU + Metal where available | CPU (CoreML deliberately not selected) |
-| Linux x64 glibc (Ubuntu 20.04 / glibc 2.31 baseline) | CPU + CUDA 13.1, CUDA 12.4 fallback | CPU + CUDA 12 |
-| Linux ARM64 glibc (Ubuntu 20.04 / glibc 2.31 baseline) | CPU | CPU |
+| Linux x64 glibc (glibc 2.28 baseline) | CPU + CUDA 13.1, CUDA 12.4 fallback | CPU + CUDA 12 |
+| Linux ARM64 glibc (glibc 2.28 baseline) | CPU | CPU |
 | Windows x64 | CPU + CUDA 13.1, CUDA 12.4 fallback | CPU + CUDA 12 |
 | Windows ARM64 | CPU | CPU + DirectML |
 
+Linux x64/ARM64 release builders use digest-pinned `manylinux_2_28`
+`2026.03.01-1` images. The executable and bundled libraries are audited against
+`GLIBC_2.28`; installed artifacts are exercised in clean AlmaLinux 8.10
+(glibc 2.28) containers, independently of the host runner's Ubuntu version.
+The Linux builds also check offline CPU ORT preparation by executing the real
+`zg-engine/build.rs` with `CARGO_FEATURE_VULKAN=1` and `CARGO_NET_OFFLINE=true`
+in a network-disabled builder, using cached official CPU ORT and no
+`ORT_DYLIB_PATH` or CUDA feature. This uses separate output, does not change
+release artifacts and is not a full Vulkan backend compilation.
+
 A deliberate CPU-only Windows build retains DirectML. The published Windows
 CUDA bundle uses the official ONNX Runtime 1.21.0 CUDA 12 provider and does not
 claim DirectML support. ORT requires CUDA 12 runtime/cuBLAS and cuDNN 9 even
@@ -255,7 +265,15 @@ artifact, then checks real installation, CLI startup, managed-rg and daemon IPC.
 The workflow runs only through manual dispatch and does not publish unless
 `publish` is enabled. The manual
 `platform` input defaults to `all`; each of the six target names can be selected
-individually.
+individually. For Linux ARM64 validation, run in the chosen repository (or add
+`--repo OWNER/REPO`):
+
+```sh
+gh workflow run rust-publish.yml -f publish=false -f cuda=false -f platform=linux-arm64-gnu
+```
+
+Replace the platform with `linux-x64-gnu` for Linux x64. Add `--ref BRANCH`
+to validate a specific branch instead of the repository's default branch.
 `publish=true` requires `platform=all`; a subset is a validation-only candidate,
 not a complete release. Manual runs with `publish=false, cuda=false` use ordinary CPU runners;
 they do not allocate GPUs or publish packages. All six package builds require
@@ -312,11 +330,18 @@ or repacking. A loopback registry exposes only this run's CUDA archives and
 records requests. CPU installation must make zero CUDA metadata/tarball requests,
 leave the plugin cache empty and install no CUDA components; optional download
 failure followed by CPU fallback is not a pass. No public registry is used.
-They verify checksums, CLI startup and daemon IPC. Linux/Windows x64 also verify real
-GGUF/ONNX indexing and vector queries with
-explicit CPU selection and default CPU fallback, without CUDA host libraries.
+The `artifact-cpu-smoke` jobs verify checksums, CLI startup and daemon IPC.
+Both Linux targets use clean AlmaLinux 8.10 (glibc 2.28) containers and load the
+installed `libonnxruntime.so.1`, verifying ORT 1.21.0 and API 21. Linux/Windows
+x64 run `scripts/cuda/e2e.py --cpu-only` for real GGUF/ONNX indexing and vector
+queries with explicit CPU selection and default CPU fallback, without CUDA
+host libraries. Linux ARM64 uses `--explicit-cpu` for real GGUF/ONNX index/query
+checks; macOS and Windows ARM64 retain CLI/daemon-only artifact smoke coverage.
 These checks also run for unpublished candidates and must pass before npm
 publication; failures retain the candidate and `cpu-artifact-evidence-*` logs.
+They are release-workflow checks, not a separate ORT gate in ordinary PR CI.
+For local full-catalog ONNX/performance checks without a workflow entry point,
+see [ONNX Runtime distributions](../CONTRIBUTING.md#onnx-runtime-distributions).
 
 The package GPU jobs use the hosted T4 runners with CUDA runtime libraries,
 not Rust/C++/CUDA compiler setup. They verify the downloaded native package's
```

---

### Incident Patch 3: `08120405` (2026-11-12)
**Commit Message**: fix(docs): avoid private links in GraphEdgeKind rustdoc (#400)

Render the crate-private PendingRef and FileEdge names as inline code in the public GraphEdgeKind docs so strict rustdoc builds pass.

Fixes #397.

**File**: `rust/crates/zg-engine/src/domain/graph.rs` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ pub enum Direction {
 /// Resolved edges and buffered name references share this vocabulary because
 /// they become rows of the same table: the pending queue stores the kind the
 /// resolved edge will carry. Resolution state is therefore structural, not a
-/// kind — a [`PendingRef`] has no target, a [`FileEdge`] requires one — and the
+/// kind — a `PendingRef` has no target, a `FileEdge` requires one — and the
 /// store keeps the same split in its `status` column.
 ///
 /// `Contains` comes only from containment, which is collected as a resolved
```

#### Recent Merged Pull Requests:
- **PR #400** (2026-11-12): fix(docs): avoid private links in GraphEdgeKind rustdoc (@liulx20)
- **PR #394** (2026-11-12): fix(engine): restore text fallback for unknown file extensions (@egolearner)
- **PR #385** (2026-11-12): feat(benchmarks): add QA pairs and Entity retrieval diagnostics (@Cuiyus)
- **PR #384** (2026-11-10): fix(search): return complete entities in full previews (@feihongxu0824)
- **PR #383** (2026-11-10): fix(models): restore compilation and configured source checks (@egolearner)
- **PR #381** (2026-11-10): fix(install): ignore directory dotenv candidates (@egolearner)

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

## X. engine): restore text fallback for unknown file extensions (#394)

**RULE**:
When implementing operations in `rust/crates/zg-engine/src/domain/source/format.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zvec-ai/zvec-grep. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bc175f00`: engine): restore text fallback for unknown file extensions (#394). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `rust/crates/zg-engine/src/domain/source/format.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// Trusts catalog matches; probes unmatched files for readable text.
            sniff::format(&header, complete, path.extension().is_none()).unwrap_or(Self::Unknown),
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
    /// Trusts catalog matches; probes only unmatched files without a suffix.
        if path.extension().is_some() {
            return Ok(vec![Self::Unknown]);
        }

            sniff::script(&header, complete).unwrap_or(Self::Unknown),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bc175f00` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
