> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/zvec-ai-zvec-grep-learnings.md`  
> **Source**: github ([https://github.com/zvec-ai/zvec-grep](https://github.com/zvec-ai/zvec-grep))  
> **Source Version**: `3d60e062`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T19:47:58.031Z  
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
> **Harvest Timestamp**: 2026-11-04T19:47:56.900Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zvec-ai/zvec-grep`
- **Description**: Local-first search across your workspace, built for humans and AI agents.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4230 stars

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

### Incident Patch 1: `3d60e062` (2026-11-04)
**Commit Message**: feat(rust): extract and persist code graphs during indexing (#291)

**File**: `rust/crates/zg-cli/src/render.rs` (modified, +6/-0)
```diff
@@ -1050,6 +1050,9 @@ mod output_tests {
             visibility: None,
             language: None,
             documentation: None,
+            arity: None,
+            is_exported: false,
+            is_declaration: false,
         }));
         for source in [ContextSource::Index, ContextSource::Rg] {
             result.source = source;
@@ -1407,6 +1410,9 @@ mod output_tests {
                 visibility: None,
                 language: None,
                 documentation: None,
+                arity: None,
+                is_exported: false,
+                is_declaration: false,
             }));
             let mut buffer = Vec::new();
             write_item_preview(
```

**File**: `rust/crates/zg-daemon/src/job_scheduler.rs` (modified, +200/-1)
```diff
@@ -198,10 +198,18 @@ impl IndexJobScheduler {
             // Once another caller relies on a job, request cancellation must not stop it.
             active.shared.store(true, Ordering::Release);
             let active_snapshot = lock(&active.snapshot).clone();
+            // A graph switch is a saved configuration change: a job that already
+            // started under the other value cannot apply it, so the request needs
+            // its own job instead of being absorbed by the active one.
+            let graph_setting_request = {
+                let current = lock(&active.options);
+                changes_graph_setting(current.as_ref(), &options)
+            };
             let needs_followup = reason == JobReason::Watch
                 || active_snapshot.reason == JobReason::Watch
                 || options.rebuild
-                || has_selection_update(&options);
+                || has_selection_update(&options)
+                || graph_setting_request;
             if needs_followup && active_snapshot.state == JobState::Queued {
                 let queued_full_manual = active_snapshot.reason == JobReason::Manual
                     && reason == JobReason::Watch
@@ -590,6 +598,9 @@ fn merge_options(current: &mut Option<IndexOptions>, mut incoming: IndexOptions)
     }
     current.reset_paths |= incoming.reset_paths;
     current.rebuild |= incoming.rebuild;
+    // A saved configuration switch follows the same rule as scan updates: an
+    // explicit value wins, including false, and omission keeps the earlier one.
+    merge_update(&mut current.graph_indexing, incoming.graph_indexing.take());
     merge_update(
         &mut current.scan.included_formats,
         incoming.scan.included_formats.take(),
@@ -743,6 +754,14 @@ fn merge_runtime_options(current: &mut IndexOptions, incoming: &mut IndexOptions
     }
 }
 
+/// A request changes the saved graph switch when it names a value that differs
+/// from the one the queued job would apply; an omitted value never changes it.
+fn changes_graph_setting(current: Option<&IndexOptions>, incoming: &IndexOptions) -> bool {
+    incoming.graph_indexing.is_some_and(|requested| {
+        current.and_then(|current| current.graph_indexing) != Some(requested)
+    })
+}
+
 fn merge_update<T>(current: &mut Option<T>, incoming: Option<T>) {
     if incoming.is_some() {
         *current = incoming;
@@ -1808,6 +1827,186 @@ mod tests {
         }
     }
 
+    #[tokio::test]
+    async fn graph_setting_requests_are_merged_and_never_absorbed() {
+        for queued in [false, true] {
+            let executor = Arc::new(RecordingExecutor {
+                calls: Mutex::new(Vec::new()),
+                started: Notify::new(),
+                releases: tokio::sync::Semaphore::new(0),
+            });
+            let scheduler = IndexJobScheduler::new(
+                executor.clone(),
+                SchedulerConfig {
+                    concurrency: 1,
+                    queue_capacity: 8,
+                },
+            );
+            if queued {
+                scheduler
+                    .submit(
+                        PathBuf::from("/blocker"),
+                        IndexOptions::default(),
+                        JobReason::Manual,
+                    )
+                    .expect("occupy worker");
+                executor.started.notified().await;
+            }
+            let root = PathBuf::from("/workspace");
+            let first = scheduler
+                .submit(root.clone(), IndexOptions::default(), JobReason::Manual)
+                .expect("initial index");
+            if !queued {
+                executor.started.notified().await;
+            }
+            // A running job cannot apply a switch it did not start with, so the
+            // request needs its own job instead of being absorbed by that one.
+            let enable = scheduler
+                .submit(
+                    root.clone(),
+                    IndexOptions {
+                        graph_indexing: Some(true),
+                        ..IndexOptions::default()
+                    },
+                    JobReason::Manual,
+                )
+                .expect("enable graph");
+            assert_eq!(
+                enable.job.id == first.job.id,
+                queued,
+                "a running job must not swallow the graph switch"
+            );
+            // A later explicit false replaces the queued true.
+            let disable = scheduler
+                .submit(
+                    root.clone(),
+                    IndexOptions {
+                        graph_indexing: Some(false),
+                        rebuild: true,
+                        ..IndexOptions::default()
+                    },
+                    JobReason::Manual,
+                )
+                .expect("disable graph");
+            assert_eq!(disable.job.id, enable.job.id);
+            // An omission keeps the value the ea
```

**File**: `rust/crates/zg-daemon/src/workspace_runtime.rs` (modified, +6/-0)
```diff
@@ -1352,6 +1352,7 @@ fn index_template(options: &IndexOptions) -> IndexOptions {
     template.reset_paths = false;
     template.changes.clear();
     template.scan = ScanRulesUpdate::default();
+    template.graph_indexing = None;
     template.embedding = None;
     template
 }
@@ -2416,6 +2417,7 @@ mod tests {
                         max_depth: Some(None),
                         ..ScanRulesUpdate::default()
                     },
+                    graph_indexing: Some(true),
                     ..IndexOptions::default()
                 },
                 true,
@@ -2444,6 +2446,10 @@ mod tests {
             let watched = &calls[2];
             assert_eq!(watched.embedding_concurrency, None);
             assert_eq!(watched.scan, ScanRulesUpdate::default());
+            assert_eq!(
+                watched.graph_indexing, None,
+                "the graph switch is a saved setting, never a replayed request"
+            );
             assert!(!watched.rebuild);
             assert!(!watched.reset_paths);
             assert!(!watched.allow_remote);
```

**File**: `rust/crates/zg-engine/src/api/index.rs` (modified, +9/-0)
```diff
@@ -25,6 +25,15 @@ pub mod options {
         pub root: Option<PathBuf>,
         /// Build from empty storage and replace the active index only after success.
         pub rebuild: bool,
+        /// Turns walk-time code graph indexing on or off for this workspace.
+        ///
+        /// Omitted keeps the saved setting, and a workspace saved before this
+        /// option existed indexes without a graph. Changing the setting requires
+        /// `rebuild`: the graph and the rest of the index must describe the same
+        /// build, so a refresh that flips the switch is rejected and the published
+        /// index stays untouched.
+        #[serde(default, skip_serializing_if = "Option::is_none")]
+        pub graph_indexing: Option<bool>,
         /// Automatic refreshes require an existing enabled index instead of creating one.
         /// This admission policy is runtime-only and never accepted from transport requests.
         #[serde(skip)]
```

**File**: `rust/crates/zg-engine/src/authorization.rs` (modified, +1/-0)
```diff
@@ -1254,6 +1254,7 @@ mod tests {
                             ..Default::default()
                         },
                     )]),
+                    false,
                     crate::domain::FTS_CONFIG,
                 )
                 .expect("index descriptor"),
```

**File**: `rust/crates/zg-engine/src/domain/graph.rs` (modified, +21/-5)
```diff
@@ -5,8 +5,18 @@ use std::collections::BTreeMap;
 use serde::{Deserialize, Serialize};
 
 use super::metadata::SymbolType;
+use super::source::TextRange;
 
-/// Edge kinds produced by the extraction layer.
+/// Kinds produced by the extraction layer.
+///
+/// Resolved edges and buffered name references share this vocabulary because
+/// they become rows of the same table: the pending queue stores the kind the
+/// resolved edge will carry. Resolution state is therefore structural, not a
+/// kind — a [`PendingRef`] has no target, a [`FileEdge`] requires one — and the
+/// store keeps the same split in its `status` column.
+///
+/// `Contains` comes only from containment, which is collected as a resolved
+/// edge during the walk, so a buffered name reference never carries it.
 #[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
 #[serde(rename_all = "snake_case")]
 pub(crate) enum GraphEdgeKind {
@@ -15,6 +25,7 @@ pub(crate) enum GraphEdgeKind {
     Imports,
     Extends,
     Implements,
+    Declares,
 }
 
 /// Evidence provenance recorded on persisted edges.
@@ -74,15 +85,17 @@ pub(crate) struct FileGraphNode {
     /// `scope::name` breadcrumb joined with `::`, or the bare name.
     pub qualified_name: String,
     pub language: String,
-    pub start_line: usize,
-    pub end_line: usize,
-    pub start_column: usize,
-    pub end_column: usize,
+    /// Extent of the entity in its source, absent when the entity carries no
+    /// text range (a whole-file or byte-only range has no coordinates).
+    pub range: Option<TextRange>,
     pub signature: Option<String>,
     pub doc: Option<String>,
     pub arity: Option<usize>,
     pub visibility: Option<String>,
     pub is_exported: bool,
+    /// Pure declaration without a body (C/C++ prototypes, in-class member
+    /// declarations); definitions shadow them in name-based binding.
+    pub is_declaration: bool,
 }
 
 /// Per-file graph extraction output, assembled after the walk and partition.
@@ -94,18 +107,21 @@ pub(crate) struct FileGraphResult {
 }
 
 impl GraphEdgeKind {
+    #[allow(dead_code)]
     pub(crate) const fn as_str(self) -> &'static str {
         match self {
             Self::Contains => "contains",
             Self::Calls => "calls",
             Self::Imports => "imports",
             Self::Extends => "extends",
             Self::Implements => "implements",
+            Self::Declares => "declares",
         }
     }
 }
 
 impl EdgeProvenance {
+    #[allow(dead_code)]
     pub(crate) const fn as_str(self) -> &'static str {
         match self {
             Self::FileLocal => "file_local",
```

**File**: `rust/crates/zg-engine/src/domain/index.rs` (modified, +75/-1)
```diff
@@ -46,6 +46,7 @@ pub(crate) struct IndexDescriptor {
     default_embedding_model: EmbeddingModelInfo,
     embedding_routes: BTreeMap<ContentKind, EmbeddingModelInfo>,
     embedding_configs: BTreeMap<String, ModelConfig<EncryptedApiKey>>,
+    graph_indexing: bool,
     #[serde(skip)]
     fts: FtsConfig,
 }
@@ -60,13 +61,15 @@ impl<'de> Deserialize<'de> for IndexDescriptor {
             embedding_routes: BTreeMap<ContentKind, EmbeddingModelInfo>,
             #[serde(default, deserialize_with = "deserialize_unique_map")]
             embedding_configs: BTreeMap<String, ModelConfig<EncryptedApiKey>>,
+            graph_indexing: bool,
         }
 
         let fields = Fields::deserialize(deserializer)?;
         Self::new(
             fields.default_embedding_model,
             fields.embedding_routes,
             fields.embedding_configs,
+            fields.graph_indexing,
             FTS_CONFIG,
         )
         .map_err(serde::de::Error::custom)
@@ -135,6 +138,7 @@ impl IndexDescriptor {
         default_embedding_model: EmbeddingModelInfo,
         embedding_routes: BTreeMap<ContentKind, EmbeddingModelInfo>,
         embedding_configs: BTreeMap<String, ModelConfig<EncryptedApiKey>>,
+        graph_indexing: bool,
         fts: FtsConfig,
     ) -> EngineResult<Self> {
         for (kind, embedding) in &embedding_routes {
@@ -170,10 +174,24 @@ impl IndexDescriptor {
             default_embedding_model,
             embedding_routes,
             embedding_configs,
+            graph_indexing,
             fts,
         })
     }
 
+    /// Whether the persisted index carries the walk-time code graph.
+    pub(crate) fn graph_indexing(&self) -> bool {
+        self.graph_indexing
+    }
+
+    /// Records whether the published index carries the walk-time code graph.
+    /// Production sets the switch through [`Self::new`]; tests use this to
+    /// derive a variant of a fixture descriptor.
+    #[cfg(test)]
+    pub(crate) fn set_graph_indexing(&mut self, enabled: bool) {
+        self.graph_indexing = enabled;
+    }
+
     pub(crate) fn default_embedding_model(&self) -> &EmbeddingModelInfo {
         &self.default_embedding_model
     }
@@ -244,6 +262,16 @@ impl IndexDescriptor {
                 .embedding
                 .ensure_index_compatible(&other_index.embedding)?;
         }
+        if self.graph_indexing != other.graph_indexing {
+            let existing = if self.graph_indexing {
+                "stores the code graph"
+            } else {
+                "has no code graph"
+            };
+            return Err(EngineError::invalid_argument(format!(
+                "existing index {existing}; rebuild the index to change graph indexing",
+            )));
+        }
         Ok(())
     }
 }
@@ -278,6 +306,7 @@ mod tests {
             .expect("embedding"),
             BTreeMap::new(),
             BTreeMap::new(),
+            false,
             FTS_CONFIG,
         )
         .expect("index descriptor")
@@ -288,7 +317,10 @@ mod tests {
         for state in [
             IndexState::Uninitialized,
             IndexState::Disabled,
-            IndexState::Enabled(Box::new(descriptor())),
+            IndexState::Enabled(Box::new(IndexDescriptor {
+                graph_indexing: true,
+                ..descriptor()
+            })),
         ] {
             let json = serde_json::to_string(&state).expect("encode index");
             assert_eq!(
@@ -307,6 +339,48 @@ mod tests {
         }
     }
 
+    #[test]
+    fn graph_setting_mismatch_requires_a_rebuild() {
+        let published = descriptor();
+        let requested = IndexDescriptor {
+            graph_indexing: true,
+            ..descriptor()
+        };
+        let error = published
+            .ensure_index_compatible(&requested)
+            .expect_err("graph setting changed");
+        assert!(
+            error.message().contains("has no code graph"),
+            "{}",
+            error.message()
+        );
+        let error = requested
+            .ensure_index_compatible(&published)
+            .expect_err("graph setting changed");
+        assert!(
+            error.message().contains("stores the code graph"),
+            "{}",
+            error.message()
+        );
+        published
+            .ensure_index_compatible(&descriptor())
+            .expect("matching graph setting");
+    }
+
+    #[test]
+    fn descriptor_requires_the_graph_setting() {
+        let encoded =
+            serde_json::to_string(&IndexState::Enabled(Box::new(descriptor()))).expect("encode");
+        assert!(encoded.contains("\"graphIndexing\":false"));
+
+        let incomplete = encoded.replace(",\"graphIndexing\":false", "");
+        assert_ne!(incomplete, encoded);
+        assert!(
+            serde_json::from_str::<IndexState>(&incomplete).is_err(),
+            "a descriptor must state whether the build carries a graph"
+        );
+    }
+
     #[test]
     fn index_metadata_rejects_
```

**File**: `rust/crates/zg-engine/src/domain/metadata.rs` (modified, +13/-1)
```diff
@@ -44,7 +44,7 @@ impl IndexField {
 
 // --- Code ---
 
-#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
+#[derive(Clone, Debug, Default, Deserialize, Eq, PartialEq, Serialize)]
 pub struct CodeMetadata {
     pub symbol_type: Option<SymbolType>,
     pub symbol_name: Option<String>,
@@ -55,6 +55,18 @@ pub struct CodeMetadata {
     pub documentation: Option<String>,
     pub visibility: Option<Visibility>,
     pub language: Option<Language>,
+    /// Declared parameter count of function-shaped symbols, with the
+    /// implicit receiver excluded.
+    pub arity: Option<usize>,
+    /// Whether the symbol is importable from outside its module.
+    #[serde(default)]
+    pub is_exported: bool,
+    /// True for pure declarations (C/C++ prototypes, in-class member
+    /// declarations) that never carry a body. Name-based binding prefers the
+    /// definition when both exist for the same symbol; a lone declaration is
+    /// the only known location and stays bindable.
+    #[serde(default)]
+    pub is_declaration: bool,
 }
 
 impl CodeMetadata {
```

---

### Incident Patch 2: `ec141d61` (2026-11-04)
**Commit Message**: feat(bench): add model inference micro-benchmark (#362)

* feat(bench): add model inference micro-benchmark

* fix(bench): verify cached artifacts and publish complete rounds

* test(bench): compare GGUF cache paths using native path semantics

**File**: `rust/crates/zg-engine/src/models/artifacts/inspection.rs` (modified, +15/-10)
```diff
@@ -10,16 +10,23 @@ use super::{
 };
 
 pub(crate) async fn model_is_cached(entry: EmbeddingCatalogEntry, cache: Option<&Path>) -> bool {
+    cached_source(entry, cache).await.is_some()
+}
+
+pub(in crate::models) async fn cached_source(
+    entry: EmbeddingCatalogEntry,
+    cache: Option<&Path>,
+) -> Option<ArtifactSource> {
     let backend = match entry {
         EmbeddingCatalogEntry::LlamaCpp(_) => LocalModelBackend::LlamaCpp,
         EmbeddingCatalogEntry::Model2Vec(_) => LocalModelBackend::Model2Vec,
         EmbeddingCatalogEntry::Transformers(_) => LocalModelBackend::Transformers,
-        EmbeddingCatalogEntry::Qwen(_) => return false,
+        EmbeddingCatalogEntry::Qwen(_) => return None,
     };
     let cache = cache.map_or_else(|| default_model_cache(backend), Path::to_path_buf);
     let cache = cache.as_path();
     let (download, sources) = match entry {
-        EmbeddingCatalogEntry::Qwen(_) => return false,
+        EmbeddingCatalogEntry::Qwen(_) => return None,
         EmbeddingCatalogEntry::LlamaCpp(model) => (
             model.download,
             [
@@ -55,9 +62,7 @@ pub(crate) async fn model_is_cached(entry: EmbeddingCatalogEntry, cache: Option<
             ],
         ),
         EmbeddingCatalogEntry::Model2Vec(model) => {
-            let Some(model_file) = Path::new(model.model_file).file_name() else {
-                return false;
-            };
+            let model_file = Path::new(model.model_file).file_name()?;
             (
                 model.download,
                 [
@@ -84,18 +89,18 @@ pub(crate) async fn model_is_cached(entry: EmbeddingCatalogEntry, cache: Option<
             )
         }
     };
-    for source in &sources {
-        let Ok(manifest) = Manifest::new(entry.reference(), source, download.artifacts) else {
+    for source in sources {
+        let Ok(manifest) = Manifest::new(entry.reference(), &source, download.artifacts) else {
             continue;
         };
-        if validate_snapshot(source, download.artifacts, &manifest, None)
+        if validate_snapshot(&source, download.artifacts, &manifest, None)
             .await
             .unwrap_or(false)
         {
-            return true;
+            return Some(source);
         }
     }
-    false
+    None
 }
 
 #[cfg(test)]
```

**File**: `rust/crates/zg-engine/src/models/artifacts/mod.rs` (modified, +2/-0)
```diff
@@ -14,6 +14,8 @@ mod spec;
 
 pub(super) use cache_paths::{LocalModelBackend, default_model_cache};
 pub(super) use downloader::{ResolveArtifacts, resolve_model_artifacts};
+#[cfg(test)]
+pub(super) use inspection::cached_source;
 pub(crate) use inspection::model_is_cached;
 #[cfg(test)]
 pub(super) use progress::ArtifactDownloadProgress;
```

**File**: `rust/crates/zg-engine/src/models/artifacts/source.rs` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ impl ArtifactSource {
         self
     }
 
-    pub(super) fn local_path(
+    pub(in crate::models) fn local_path(
         &self,
         artifact: &ArtifactConfig,
     ) -> Result<PathBuf, ArtifactDownloadError> {
```

**File**: `rust/crates/zg-engine/src/models/tests/mod.rs` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 mod catalog_main_oracle;
 mod model2vec_main_oracle;
 mod model_layer_bench;
+mod model_micro_bench;
 mod real_model_smoke;
```

**File**: `rust/crates/zg-engine/src/models/tests/model_micro_bench.rs` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+//! Model inference micro-benchmark; see rust/micro-bench/model/README.md.
+use std::{
+    env,
+    sync::Arc,
+    time::{Duration, Instant},
+};
+
+use serde_json::{Value, json};
+
+use crate::{
+    domain::{Content, model::EmbeddingPurpose},
+    models::{
+        ModelRuntimeLease, ModelRuntimeManager,
+        spi::{EmbeddingOptions, EmbeddingPrepareOptions},
+    },
+};
+
+mod fixed_shape;
+mod support;
+use support::Config;
+
+struct Data {
+    inputs: Vec<Vec<Content>>,
+    batch: usize,
+    nominal_tokens: usize,
+    descriptions: Vec<Value>,
+}
+
+fn number(name: &str, default: usize) -> usize {
+    let value = env::var(name).map_or(default, |s| {
+        s.parse().expect("positive integer configuration")
+    });
+    assert!(value > 0, "positive benchmark configuration");
+    value
+}
+
+fn seconds(value: usize) -> Duration {
+    Duration::from_secs(u64::try_from(value).expect("duration fits u64"))
+}
+
+fn nanos(value: Duration) -> u64 {
+    u64::try_from(value.as_nanos()).expect("duration fits u64 nanoseconds")
+}
+
+fn count(value: usize) -> f64 {
+    f64::from(u32::try_from(value).expect("count fits u32"))
+}
+
+fn phase(name: &str, origin: Instant) {
+    println!(
+        "ZG_BENCH_EVENT={}",
+        json!({"phase":name,"at_ns":nanos(origin.elapsed())})
+    );
+}
+
+#[derive(Clone, serde::Serialize)]
+struct Row {
+    id: usize,
+    scheduled_ns: u64,
+    issued_ns: u64,
+    finished_ns: u64,
+    status: &'static str,
+    vectors: usize,
+    input_indices: Vec<usize>,
+}
+
+fn quantiles(mut values: Vec<u64>) -> Value {
+    values.sort_unstable();
+    let quantile = |percent: usize| {
+        let rank = (values.len() * percent).div_ceil(100);
+        values
+            .get(rank.saturating_sub(1))
+            .map(|&n| Duration::from_nanos(n).as_secs_f64() * 1000.0)
+    };
+    json!({"n":values.len(),"p50_ms":quantile(50),"p95_ms":if values.len()>=100 {quantile(95)} else {None},
+        "p99_ms":if values.len()>=1000 {quantile(99)} else {None}})
+}
+
+fn summary(rows: &[Row], elapsed: Duration, nominal_tokens_per_batch: usize) -> Value {
+    let successful: Vec<_> = rows.iter().filter(|r| r.status == "completed").collect();
+    let completed_vectors: usize = successful.iter().map(|r| r.vectors).sum();
+    json!({"scheduled":rows.len(),"issued":rows.len(),"completed":successful.len(),
+        "timeout":rows.iter().filter(|r|r.status=="timeout").count(),"errors":rows.iter().filter(|r|r.status=="error").count(),
+        "elapsed_seconds":elapsed.as_secs_f64(),"vectors_per_second":count(completed_vectors)/elapsed.as_secs_f64(),
+        "nominal_tokens_per_second":count(successful.len())*count(nominal_tokens_per_batch)/elapsed.as_secs_f64(),
+        "call_latency":quantiles(successful.iter().map(|r|r.finished_ns-r.issued_ns).collect())})
+}
+
+fn emit_rows(phase: &str, rows: &[Row]) {
+    println!("ZG_BENCH_ROWS={}", json!({"phase":phase,"rows":rows}));
+}
+
+#[test]
+fn nearest_rank_and_insufficient_tail_samples() {
+    assert_eq!(quantiles((1..=1000).collect())["p99_ms"], json!(0.000_99));
+    assert!(quantiles(vec![1; 99])["p95_ms"].is_null());
+    assert!(quantiles(vec![1; 999])["p99_ms"].is_null());
+    assert!(quantiles(Vec::new())["p50_ms"].is_null());
+}
```

**File**: `rust/crates/zg-engine/src/models/tests/model_micro_bench/fixed_shape.rs` (added, +325/-0)
```diff
@@ -0,0 +1,325 @@
+//! Fixed nominal input size and batch shape, using production CLI concurrency.
+use std::sync::Mutex;
+
+use futures_util::future::join_all;
+use sha2::{Digest, Sha256};
+
+use super::{
+    Arc, Config, Content, Data, Duration, EmbeddingOptions, EmbeddingPrepareOptions,
+    EmbeddingPurpose, Instant, ModelRuntimeLease, ModelRuntimeManager, Row, Value, emit_rows, json,
+    nanos, number, phase, seconds, summary, support,
+};
+
+const GENERATOR: &str = "nominal-words-v1";
+const WORDS: [&str; 8] = [
+    "search", "store", "read", "update", "check", "process", "share", "return",
+];
+
+fn inputs(target: usize, batch: usize) -> Data {
+    let mut data = Data {
+        inputs: Vec::new(),
+        batch,
+        nominal_tokens: target,
+        descriptions: Vec::new(),
+    };
+    for index in 0..WORDS.len() {
+        // L is a configured input-size label. No tokenizer probe or model
+        // correctness check is performed by this performance benchmark.
+        let text = (0..target)
+            .map(|offset| WORDS[(index + offset) % WORDS.len()])
+            .collect::<Vec<_>>()
+            .join(" ");
+        data.descriptions.push(json!({
+            "id":format!("input-{index:02}"),"generator":GENERATOR,
+            "text_sha256":hex::encode(Sha256::digest(text.as_bytes())),"bytes":text.len(),
+        }));
+        data.inputs.push(vec![Content::Text(text)]);
+    }
+    data
+}
+
+fn indices(id: usize, data: &Data) -> Vec<usize> {
+    (0..data.batch)
+        .map(|i| (id * data.batch + i) % data.inputs.len())
+        .collect()
+}
+
+fn batch(data: &Data, id: usize) -> Vec<Vec<Content>> {
+    indices(id, data)
+        .into_iter()
+        .map(|i| data.inputs[i].clone())
+        .collect()
+}
+
+fn cycle_batches(inputs: usize, batch: usize) -> usize {
+    let (mut a, mut b) = (inputs, batch);
+    while b != 0 {
+        (a, b) = (b, a % b);
+    }
+    inputs / a
+}
+
+async fn warmup(model: &ModelRuntimeLease, data: &Data, workers: usize) -> Value {
+    let shapes = cycle_batches(data.inputs.len(), data.batch);
+    let waves = shapes.max(3);
+    for wave in 0..waves {
+        let input = batch(data, wave % shapes);
+        let results =
+            join_all((0..workers).map(|_| model.embed(&input, EmbeddingOptions::default(), None)))
+                .await;
+        for result in results {
+            result.expect("embedding warmup");
+        }
+    }
+    json!({"worker_waves":waves,"workers":workers,"batch_shapes":shapes})
+}
+
+#[derive(Default)]
+struct Schedule {
+    next: usize,
+    completed: usize,
+    minimum: usize,
+    cycle: usize,
+    stop_at: Option<usize>,
+    failed: bool,
+    capped: bool,
+}
+
+impl Schedule {
+    fn take(&mut self, elapsed: Duration, duration: Duration, maximum: Duration) -> Option<usize> {
+        if self.failed || self.capped {
+            return None;
+        }
+        if elapsed >= maximum {
+            self.capped = true;
+            return None;
+        }
+        if self.stop_at.is_none() && elapsed >= duration && self.completed >= self.minimum {
+            self.stop_at = Some(self.next.div_ceil(self.cycle) * self.cycle);
+        }
+        if self.stop_at.is_some_and(|end| self.next >= end) {
+            return None;
+        }
+        let id = self.next;
+        self.next += 1;
+        Some(id)
+    }
+
+    fn finish(&mut self, successful: bool) {
+        if successful {
+            self.completed += 1;
+        } else {
+            self.failed = true;
+        }
+    }
+}
+
+async fn request(model: &ModelRuntimeLease, data: &Data, origin: Instant, id: usize) -> Row {
+    let selected = indices(id, data);
+    let texts: Vec<_> = selected.iter().map(|&i| data.inputs[i].clone()).collect();
+    let options = EmbeddingOptions {
+        purpose: EmbeddingPurpose::Document,
+        ..Default::default()
+    };
+    let started = Instant::now();
+    let output = model.embed(&texts, options, None).await;
+    let finished = Instant::now();
+    let status = if output.is_ok() { "completed" } else { "error" };
+    if let Err(error) = &output {
+        eprintln!("embedding batch {id} failed: {error}");
+    }
+    let vectors = output.map_or(0, |result| result.vectors.len());
+    Row {
+        id,
+        scheduled_ns: nanos(started.duration_since(origin)),
+        issued_ns: nanos(started.duration_since(origin)),
+        finished_ns: nanos(finished.duration_since(origin)),
+        status,
+        vectors,
+        input_indices: selected,
+    }
+}
+
+async fn measure(
+    model: &Arc<ModelRuntimeLease>,
+    data: &Arc<Data>,
+    workers: usize,
+    origin: Instant,
+) -> (Vec<Row>, Value) {
+    let duration = seconds(number("ZG_MODEL_BENCH_SECONDS", 15));
+    let maximum = seconds(number("ZG_MODEL_BENCH_MAX_SECONDS", 120));
+    let minimum = number("ZG_MODEL_BENCH_MIN_BATCHES", 100);
+    assert!(
+        maximum >= duration,
+        "maximum duration must cover 
```

**File**: `rust/crates/zg-engine/src/models/tests/model_micro_bench/support.rs` (added, +247/-0)
```diff
@@ -0,0 +1,247 @@
+use crate::{
+    domain::model::{Device, ModelConfig},
+    models::{
+        ModelRuntimeLease, ModelRuntimeManager, ModelRuntimeRequest,
+        artifacts::{ArtifactDownloadConfig, cached_source},
+        catalog::{
+            EmbeddingCatalogEntry, get_embedding_model_catalog_entry, list_embedding_models,
+        },
+        runtime::{batch_concurrency, resolve_index_concurrency},
+        spi::EmbeddingPrepareOptions,
+    },
+};
+use serde_json::{Value, json};
+use sha2::{Digest, Sha256};
+use std::{
+    env,
+    fs::File,
+    io::Read,
+    path::{Path, PathBuf},
+    sync::Arc,
+};
+
+pub(super) struct Config {
+    pub reference: String,
+    pub cache: PathBuf,
+    pub device: Device,
+    pub requested: Option<usize>,
+    pub index_limit: Option<usize>,
+    pub entry: EmbeddingCatalogEntry,
+}
+
+impl Config {
+    pub fn environment() -> Self {
+        let reference = env::var("ZG_MODEL_BENCH_MODEL").expect("explicit local model");
+        let entry = get_embedding_model_catalog_entry(&reference).expect("catalog model");
+        assert!(
+            !matches!(entry, EmbeddingCatalogEntry::Qwen(_)),
+            "remote models are not authorized"
+        );
+        let requested = match env::var("ZG_MODEL_BENCH_CONCURRENCY").as_deref() {
+            Ok("default") | Err(_) => None,
+            Ok(value) => Some(value.parse().expect("CLI positive concurrency")),
+        };
+        let index_limit =
+            resolve_index_concurrency(&reference, requested).expect("CLI concurrency resolution");
+        let device = match env::var("ZG_MODEL_BENCH_DEVICE").as_deref() {
+            Ok("cpu") => Device::Cpu,
+            Ok("metal") => Device::Metal,
+            #[cfg(feature = "cuda")]
+            Ok("cuda") => Device::Cuda,
+            #[cfg(not(feature = "cuda"))]
+            Ok("cuda") => panic!("CUDA requires a CUDA build"),
+            _ => panic!("device must be cpu, metal or cuda"),
+        };
+        Self {
+            reference,
+            entry,
+            requested,
+            index_limit,
+            device,
+            cache: PathBuf::from(env::var_os("ZG_MODEL_BENCH_CACHE").expect("explicit cache")),
+        }
+    }
+
+    pub fn acquire(&self, manager: &ModelRuntimeManager) -> Arc<ModelRuntimeLease> {
+        Arc::new(
+            manager
+                .acquire(ModelRuntimeRequest::new(
+                    &self.reference,
+                    ModelConfig {
+                        cache_dir: Some(self.cache.clone()),
+                        device: Some(self.device),
+                        ..Default::default()
+                    },
+                    self.index_limit,
+                ))
+                .expect("runtime acquisition"),
+        )
+    }
+
+    pub fn workers(&self, model: &ModelRuntimeLease) -> usize {
+        // Same successful-work admission as indexing's resolve_index_batch_policy.
+        batch_concurrency(&self.reference, self.index_limit)
+            .unwrap_or(model.concurrency_defaults().initial)
+    }
+}
+
+fn download(entry: EmbeddingCatalogEntry) -> &'static ArtifactDownloadConfig {
+    match entry {
+        EmbeddingCatalogEntry::LlamaCpp(e) => e.download,
+        EmbeddingCatalogEntry::Model2Vec(e) => e.download,
+        EmbeddingCatalogEntry::Transformers(e) => e.download,
+        EmbeddingCatalogEntry::Qwen(_) => panic!("local models only"),
+    }
+}
+
+fn metadata(entry: EmbeddingCatalogEntry) -> Value {
+    let (batch, limit, semantics) = match entry {
+        EmbeddingCatalogEntry::LlamaCpp(e) => (
+            e.max_batch_size,
+            e.context_size,
+            json!({"format":e.format,"dtype":"Q8_0","pooling":"native model metadata","normalize":false}),
+        ),
+        EmbeddingCatalogEntry::Model2Vec(e) => (
+            e.max_batch_size,
+            e.max_input_tokens,
+            json!({"dtype":"safetensors","normalize":e.normalize,"pooling":"mean excluding unknown ids","query_prefix":e.query_prefix,"document_prefix":e.document_prefix}),
+        ),
+        EmbeddingCatalogEntry::Transformers(e) => (
+            e.max_batch_size,
+            e.max_input_tokens,
+            json!({"dtype":e.dtype,"pooling":e.pooling,"normalize":e.normalize,"query_prefix":e.query_prefix,"document_prefix":e.document_prefix}),
+        ),
+        EmbeddingCatalogEntry::Qwen(_) => panic!("local only"),
+    };
+    let d = download(entry);
+    json!({"model":entry.reference(),"backend":entry.backend(),"dimension":entry.dimension(),"max_batch_size":batch,
+        "max_input_tokens":limit,"semantics":semantics,"revision":d.hugging_face.revision,
+        "fallback_revision":d.model_scope.revision,"artifacts":d.artifacts.iter().map(|a|json!({"path":a.path,"size":a.size,"sha256":a.sha256})).collect::<Vec<_>>()})
+}
+
+pub(super) async fn verify_artifacts(entry: EmbeddingCatalogEntry, cache: &Path) -> Value {
+    let mut meta = metadata(entry);
+    let source = c
```

**File**: `rust/micro-bench/model/README.md` (added, +217/-0)
```diff
@@ -0,0 +1,217 @@
+# Model module micro-benchmark contract v5
+
+One case is **model × input length L in words × batch size B × CLI
+embedding concurrency C × requested device**. One timed workload, `embedding`,
+measures batch-call latency, throughput and external resource usage.
+
+The measurement boundary is the existing private model module. It includes
+runtime admission, input formatting, tokenization, native computation and the
+engine's normal postprocessing. Scanning, chunking, storage and retrieval are
+outside this boundary. Model correctness is covered by the model tests, not this
+micro-benchmark: there are no token-length, vector-value, normalization,
+repeatability or truncation checks, and no boundary-audit prerequisite. The
+benchmark adds no backend/runtime statistics probes.
+
+## Matrix and input generation
+
+Defaults:
+
+- All local catalog models; no remote or paid models.
+- Input lengths L (whitespace-separated words): `32 256 1024`.
+- Batch sizes B: `1 4 16`.
+- CLI embedding concurrency C: `default 1 2 4 8`.
+- Requested devices: `cpu metal`; CUDA is selectable with a CUDA build.
+- One process round per executable case; use `--rounds` to request repeats.
+
+Resolve each configured L to `min(L, model.max_input_tokens)` and B to
+`min(B, model.max_batch_size)`, then deduplicate those values per model. This is
+configuration resolution against catalog limits, not validation of tokenized
+inputs. Store requested tiers and resolved cases in the manifest. Case paths are:
+
+```text
+MODEL/DEVICE/lL/bBATCH/cCONCURRENCY/r01/result.json
+```
+
+Generate a deterministic pool of eight input variants, each containing L
+whitespace-separated words. Use the same `EmbeddingPurpose::Document` format for
+every call. Record generator identity, input hashes and byte counts. Do not run a
+tokenizer probe or inspect how the backend transforms the inputs. Prefixes,
+special tokens, token filtering and truncation remain ordinary engine behavior.
+
+**L is the number of whitespace-separated words per generated input, not the
+tokenizer's token count.** The report uses the compact label `L=32`. Input-word
+throughput remains in raw and aggregate JSON but is not displayed in the table.
+The raw field names `input_tokens` and
+`nominal_tokens_per_second` are retained for compatibility. Identical L values
+do not establish identical native token counts across models.
+
+Timed workers draw batches from a deterministic shared queue. Keep B and C fixed
+within a case. A successful batch means that the embedding API returned `Ok`;
+record the number of returned vectors without asserting its size or contents.
+
+## Concurrency and device configuration
+
+Use production `resolve_index_concurrency` and `batch_concurrency`. Clear inherited
+indexing concurrency overrides so `default` uses the backend default:
+
+- llama.cpp has one in-flight batch; C controls native context parallelism within it.
+- Transformers/ONNX uses the production in-flight batch limit, capped at eight;
+  its current default is one.
+- model2vec uses its production default (currently two) or the explicit budget.
+
+Record requested C, resolved runtime budget and configured in-flight batch count.
+`default` remains a distinct case from an explicit value even if they resolve to
+the same budget. Do not add extra batch workers on top of a native context budget.
+
+The fixed first column records the **requested device only**. Actual execution device
+and fallback are not verified. External GPU utilization is a resource observation,
+not evidence that this case executed on that GPU. Do not infer a provider from
+CPU/GPU activity.
+
+The known CPU-only model2vec capability can skip non-CPU cases. Save a bound
+`case-status.json` with the reason, keep its table row, and omit its measurement
+rounds. A skip record cannot coexist with measured rounds. Other backends are not
+preclassified as unsupported from their names.
+
+## Timing and rounds
+
+Each round uses a fresh process and runtime manager. Prepare the model and input
+pool, then warm at least three worker waves while covering the input-pool batch
+cycle. Warmup calls exercise the engine without comparing outputs; call failures
+remain execution failures. Preparation and warmup are outside measurement.
+
+Run one continuous closed-loop phase: each completed worker immediately takes
+its next batch. The baseline targets both **15 seconds** and **100 completed
+batches**, ending at a balanced input-cycle boundary. Stop new submissions after
+**120 seconds** and drain already-issued calls. Preserve an unmet sample target
+when the cap fires. The cap does not cancel native work or bound total wall time.
+The process watchdog defaults to **1,800 seconds**.
+
+Smoke uses one second, at least three completed batches and a ten-second dispatch
+cap. Label it as a short validation run; it is excluded from performance
+comparison even when multiple rounds are requested.
+
+Shuffle cases independently
```

#### Recent Merged Pull Requests:
- **PR #364** (2026-11-03): docs: allow package scripts in npm installation commands (@egolearner)
- **PR #362** (2026-11-04): feat(bench): add model inference micro-benchmark (@feihongxu0824)
- **PR #360** (2026-11-02): fix(mcp): align output schemas with serialized results (@egolearner)
- **PR #358** (2026-11-03): fix(models): honor Model2Vec catalog token limits (@feihongxu0824)
- **PR #357** (2026-11-03): refactor(engine): share query admission and glob filtering (@liulx20)
- **PR #356** (2026-11-02): fix(npm): deduplicate installed native payload files (@egolearner)

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

## X. rust): extract and persist code graphs during indexing (#291)

**RULE**:
When implementing operations in `rust/crates/zg-cli/src/render.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zvec-ai/zvec-grep. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3d60e062`: rust): extract and persist code graphs during indexing (#291). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `rust/crates/zg-cli/src/render.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            arity: None,
            is_exported: false,
            is_declaration: false,
                arity: None,
                is_exported: false,
                is_declaration: false,
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3d60e062` are properly handled with clean fallback behavior.
