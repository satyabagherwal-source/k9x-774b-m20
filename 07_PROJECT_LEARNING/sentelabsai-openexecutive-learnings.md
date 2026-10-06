# Forensic Learning Record (Deep Inspection): SenteLabsAI/OpenExecutive

> **Canonical Artifact**: `07_PROJECT_LEARNING/sentelabsai-openexecutive-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SenteLabsAI/OpenExecutive](https://github.com/SenteLabsAI/OpenExecutive))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:00:36.194Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SenteLabsAI/OpenExecutive`
- **Description**: AI-powered virtual executive team — a single coherent executive persona backed by 8 specialist agents (FastAPI + Next.js).
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 5501 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/core/openexecutive/agents/alert_review.py`
```
"""Alert review agent: verdict + recommended move per open alert.

Structured-output utility agent (same shape as :mod:`agents.triage`): one
forced tool call, never raises. It never mutates state — the policy code in
:mod:`alerts.review` reads the verdicts and executes moves within authority.
"""
from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from openexecutive.agents.base import BaseAgent
from openexecutive.providers import get_provider

logger = logging.getLogger(__name__)

_REVIEW_TIMEOUT = 90.0
_MAX_TOKENS = 4000

VERDICTS: frozenset[str] = frozenset({"relevant", "changed", "resolved", "stale"})
CONFIDENCES: frozenset[str] = frozenset({"high", "medium", "low"})
MOVES: frozenset[str] = frozenset({
    "none", "route", "nudge", "escalate", "draft", "suggest_workflow", "merge", "close",
})
SEVERITIES: frozenset[str] = frozenset({"low", "medium", "high", "urgent"})


class AlertVerdict(BaseModel):
    """One reviewed alert, as the model returned it (coerced, bounded)."""

    model_config = ConfigDict(extra="ignore")

    alert_id: int
    verdict: str = "relevant"
    confidence: str = "low"
    evidence: str = ""
    # The server-supplied evidence id (S1 / R2 / A3) a closing verdict cites.
    evidence_ref: str = ""
    note: str = ""
    why_now: str = ""
    due_at: str | None = None
    recommended_move: str = "none"
    target_person_id: int | None = None
    superseded_by_alert_id: int | None = None
    headline: str | None = None
    body: str | None = None
    severity: str | None = None
    draft_title: str = ""
    draft_document: str = ""
    workflow_name: str = ""
    message: str = ""
    raw: dict[str, Any] = Field(default_factory=dict, exclude=True)


REVIEW_TOOL: dict[str, Any] = {
    "name": "emit_alert_reviews",
    "description": (
        "Emit the review for every alert in the batch. Always call this tool; "
        "never reply in plain text."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "reviews": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "alert_id": {"type": "integer"},
                        "verdict": {
                            "type": "string",
                            "enum": sorted(VERDICTS),
                        },
                        "confidence": {"type": "string", "enum": sorted(CONFIDENCES)},
                        "evidence": {
                            "type": "string",
                            "description": (
                                "The specific evidence item you rely on (quote it). "
                                "Required for resolved / stale."
                            ),
                        },
                        "evidence_ref": {
                            "type": "string",
                            "description": (
                                "The bracketed id of the evidence item you rely on, exactly as "
                                "shown in the alert block (e.g. 'S1', 'R2', 'A3'). REQUIRED for "
                                "resolved / stale — a close without a valid ref is not applied."
                            ),
                        },
                        "note": {
                            "type": "string",
                            "description": "<=160 chars: what changed since the principal last looked.",
                        },
                        "why_now": {"type": "string", "description": "<=80 chars, only under time pressure."},
                        "due_at": {"type": "string", "description": "ISO 8601 UTC deadline, if one exists."},
                        "recommended_move": {"type": "string", "enum": sorted(MOVES)},
                        "target_person_id": {"type": "integer"},
                        "superseded_by_alert_id": {"type": "integer"},
                        "headline": {"type": "string"},
                        "body": {"type": "string"},
                        "severity": {"type": "string", "enum": sorted(SEVERITIES)},
                        "draft_title": {"type": "string"},
                        "draft_document": {"type": "string"},
                        "workflow_name": {"type": "string"},
                        "message": {"type": "string", "description": "The DM text for route / nudge."},
                    },
                    "required": ["alert_id", "verdict", "confidence", "note", "recommended_move"],
                },
            },
        },
        "required": ["reviews"],
    },
}


def _coerce_int(value: Any) -> int | None:
    try:
        return int(value) if value is not None and value != "" else None
    except (TypeError, ValueError):
        return None


def parse_verdicts(raw: Any) -> list[AlertVerdict]:
    """Tolerantly coerce the tool input into verdicts; drops malformed entries."""
    out: list[AlertVerdict] = []
    entries = raw.get("reviews") if isinstance(raw, dict) else None
    if not isinstance(entries, list):
        return out
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        alert_id = _coerce_int(entry.get("alert_id"))
        if alert_id is None:
            continue
        verdict = str(entry.get("verdict") or "relevant").lower()
        confidence = str(entry.get("confidence") or "low").lower()
        move = str(entry.get("recommended_move") or "none").lower()
        severity_raw = entry.get("severity")
        severity = str(severity_raw).lower() if severity_raw else None
        out.append(AlertVerdict(
            alert_id=alert_id,
            verdict=verdict if verdict in VERDICTS else "relevant",
            confidence=confidence if confidence in CONFIDENCES else "low",
            evidence=str(entry.get("evidence") or "")[:600],
            evidence_ref=str(entry.get("evidence_ref") or "")[:8],
            note=str(entry.get("note") or "")[:160],
            why_now=str(entry.get("why_now") or "")[:80],
            due_at=(str(entry.get("due_at")) if entry.get("due_at") else None),
            recommended_move=move if move in MOVES else "none",
            target_person_id=_coerce_int(entry.get("target_person_id")),
            superseded_by_alert_id=_coerce_int(entry.get("superseded_by_alert_id")),
            headline=(str(entry["headline"])[:200] if entry.get("headline") else None),
            body=(str(entry["body"])[:4000] if entry.get("body") else None),
            severity=severity if severity in SEVERITIES else None,
            draft_title=str(entry.get("draft_title") or "")[:160],
            draft_document=str(entry.get("draft_document") or "")[:8000],
            workflow_name=str(entry.get("workflow_name") or "")[:64],
            message=str(entry.get("message") or "")[:1500],
            raw=entry,
        ))
    return out


class AlertReviewAgent(BaseAgent):
    name = "alert_review"
    domain = "alert_review"

    @property
    def model(self) -> str:  # type: ignore[override]
        # Cheap and fast, like triage — this runs on every open alert a few
        # times a day. Uses the configured routing model so an Anthropic-free
        # deployment routes it to its local / OpenRouter model too.
        from openexecutive.config import get_settings

        return get_settings().routing_model

    def get_system_prompt(self) -> str:
        from openexecutive.prompts.alert_review_prompt import ALERT_REVIEW_PROMPT

        return ALERT_REVIEW_PROMPT

    async def review(self, batch_context: str) -> list[AlertVerdict]:
        """Return verdicts for one batch; empty on any failure (never raises)."""
        provider = get_provider(self.effective_model())
        try:
            message = await provider.messages_create(
                model=self.effective_model(),
                max_tokens=_MAX_TOKENS,
                timeout=_REVIEW_TIMEOUT,
                system=self.effective_system_prompt(),
                tools=[REVIEW_TOOL],
                tool_choice={"type": "tool", "name": "emit_alert_reviews"},
                messages=[{"role": "user", "content": batch_context}],
            )
        except Exception:
            logger.exception("alert_review: model call failed — no verdicts this batch")
            return []
        for block in getattr(message, "content", []) or []:
            if getattr(block, "type", "") == "tool_use" and getattr(block, "name", "") == "emit_alert_reviews":
                return parse_verdicts(getattr(block, "input", {}))
        logger.warning("alert_review: model returned no tool_use — no verdicts this batch")
        return []


__all__ = [
    "MOVES",
    "REVIEW_TOOL",
    "VERDICTS",
    "AlertReviewAgent",
    "AlertVerdict",
    "parse_verdicts",
]

```

### Core Architecture Module: `packages/core/openexecutive/agents/base.py`
```
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any, Literal

from openexecutive.audit.usage import log_model_usage
from openexecutive.config import get_settings
from openexecutive.providers import get_provider, model_supports_deep_reasoning

_SPECIALIST_TIMEOUT = 180.0

logger = logging.getLogger(__name__)


AgentVisibility = Literal["core", "internal"]


class BaseAgent(ABC):
    name: str
    domain: str
    model: str
    use_deep_reasoning: bool = False
    # "core": an agent a user would recognise (the Executive and the domain
    # specialists), listed in the Agent Council's simple view. "internal":
    # triage and the helper agents, shown only under "Show all agents".
    visibility: AgentVisibility = "internal"

    @abstractmethod
    def get_system_prompt(self) -> str: ...

    def base_system_prompt(self) -> str:
        """The built-in prompt, or the Council's replacement for it."""
        from openexecutive.agents.overrides import get_override

        ov = get_override(self.name)
        if ov is not None and ov.prompt is not None:
            return ov.prompt
        return self.get_system_prompt()

    def effective_system_prompt(self) -> str:
        """System prompt as sent: the base prompt plus any additional
        instructions saved in the Council."""
        from openexecutive.agents.overrides import append_instructions, get_override

        ov = get_override(self.name)
        return append_instructions(
            self.base_system_prompt(), ov.instructions if ov is not None else None
        )

    def effective_model(self) -> str:
        from openexecutive.agents.overrides import get_override

        ov = get_override(self.name)
        if ov is not None and ov.model is not None:
            return ov.model
        return self.model

    def effective_use_deep_reasoning(self) -> bool:
        from openexecutive.agents.overrides import get_override

        ov = get_override(self.name)
        if ov is not None and ov.use_deep_reasoning is not None:
            return ov.use_deep_reasoning
        return self.use_deep_reasoning

    async def analyze(
        self,
        query: str,
        context: str = "",
        retrieved_knowledge: str = "",
        episodic_context: str = "",
        failure_cases: str = "",
        department_memory: str = "",
        *,
        company_stage: str = "",
        principal_role: str = "",
        standing_facts: str = "",
        system_prompt_override: str | None = None,
        model_override: str | None = None,
        deep_reasoning_override: bool | None = None,
        actor: str = "specialist",
    ) -> str:
        """Run one prose specialist call and return its text.

        Every call records a ``cache_event`` usage row under ``actor``, so
        the call counts toward the session cost summary and ``/audit/usage``
        like every other model call. The router sets ``actor`` per path
        (``specialist`` for chat-turn consults, ``specialist_workflow`` for
        workflow steps); the Council test box passes ``agent_test``.
        """
        settings = get_settings()

        # Resolution order: explicit kwarg (for sandbox/test calls) → DB
        # override → class default. Keeping the override read inside this
        # method means a fresh DB row takes effect on the next request
        # without any process restart.
        system_prompt = (
            system_prompt_override
            if system_prompt_override is not None
            else self.effective_system_prompt()
        )
        model = (
            model_override
            if model_override is not None
            else self.effective_model()
        )
        use_deep = (
            deep_reasoning_override
            if deep_reasoning_override is not None
            else self.effective_use_deep_reasoning()
        )

        user_content = query
        if context:
            user_content = f"<conversation_context>\n{context}\n</conversation_context>\n\n{query}"
        if retrieved_knowledge:
            user_content = (
                f"<relevant_knowledge>\n{retrieved_knowledge}\n</relevant_knowledge>\n\n{user_content}"
            )
        if failure_cases:
            user_content = (
                f"<failure_cases>\n{failure_cases}\n</failure_cases>\n\n{user_content}"
            )
        if episodic_context:
            user_content = (
                f"<past_decisions>\n{episodic_context}\n</past_decisions>\n\n{user_content}"
            )
        if standing_facts:
            # The principal's kept corrections (memory.facts), next to the
            # institutional memory it overrides. User turn, never the cached
            # specialist system prompt.
            user_content = (
                f"<standing_facts>\n{standing_facts}\n</standing_facts>\n\n{user_content}"
            )
        if department_memory:
            # Placed adjacent to past_decisions so the specialist sees both
            # forms of institutional context together: the structured ledger
            # (past_decisions, from SQL) and the dept peer's synthesized
            # voice (department_memory, from Honcho). Order is intentional —
            # past_decisions stays closest to the query for cache stability
            # across turns; department_memory wraps it.
            user_content = (
                f"<department_memory>\n{department_memory}\n</department_memory>\n\n{user_content}"
            )
        # Solo mode: what the principal does (kind, title, remit —
        # router.principal_role_context). A VP inside a large company and a
        # business owner need different advice for the same question; the
        # tag rides in the USER turn for the same cache reason as the stage
        # below, which sits just outside it.
        role = principal_role.strip()
        if role:
            user_content = f"<principal_role>\n{role}\n</principal_role>\n\n{user_content}"
        # The company's stage, from the profile. Specialists never see the
        # company profile — it lives in the Executive's cached system block —
        # and stage changes which benchmarks apply (venture metrics mislead a
        # bootstrapped business). It rides in the USER turn, outermost, so the
        # specialist's cached system prompt stays byte-identical whatever the
        # profile says. Collapsed to one line: it is free text.
        stage = " ".join(company_stage.split())
        if stage:
            user_content = f"<company_stage>\n{stage}\n</company_stage>\n\n{user_content}"

        create_kwargs: dict = {
            "model": model,
            "max_tokens": 4096,
            # Per-request timeout — keeps cancellation semantics aligned with
            # the previous per-client timeout, but the provider singleton no
            # longer needs to recreate the SDK client to set it.
            "timeout": _SPECIALIST_TIMEOUT,
            "system": [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            "messages": [{"role": "user", "content": user_content}],
        }

        if use_deep and model_supports_deep_reasoning(model):
            # Adaptive thinking with effort capped via
            # output_config.effort. Default "low" — adaptive at default
            # effort routinely burned 20k+ thinking tokens. "low" still
            # leaves room for nuanced reasoning while being ~3x faster.
            # Tune via SPECIALIST_EFFORT (low / medium / high / xhigh / max).
            create_kwargs["thinking"] = {"type": "adaptive"}
            create_kwargs["output_config"] = {"effort": settings.specialist_effort}
            create_kwargs["max_tokens"] = 16000

        # Resolve provider per-call by model so a Council UI override that
        # flips this agent to a non-Anthropic slug routes correctly. Today
        # the registry always returns the Anthropic provider; OpenRouter
        # wiring lands in the next commit.
        provider = get_provider(model)
        message = await provider.messages_create(**create_kwargs)
        log_model_usage(message, model=model, actor=actor)

        text_blocks = [b for b in message.content if b.type == "text"]
        if not text_blocks:
            # A reasoning model can spend the whole max_tokens budget thinking
            # and return no text; the Executive would then synthesize as if
            # this specialist had nothing to say. Make that visible.
            logger.warning(
                "specialist %s (%s) returned no text block (stop_reason=%s, "
                "deep_reasoning=%s); its analysis will be empty",
                self.name,
                model,
                getattr(message, "stop_reason", None),
                use_deep,
            )
        return text_blocks[0].text if text_blocks else ""

    async def analyze_with_tools(
        self,
        user_content: str,
        *,
        tools: list[dict[str, Any]],
        system_addendum: str = "",
        max_tokens: int = 4096,
        timeout_seconds: float = _SPECIALIST_TIMEOUT,
        model_override: str | None = None,
        deep_reasoning_override: bool | None = None,
        actor: str = "specialist_tools",
    ) -> Any:
        """Tool-use variant of ``analyze`` — returns the raw provider Message.

        Used by workflows that need structured output from a specialist
        (e.g. the watchlist research workflow's
        ``propose_watchlist_entries`` tool). Differs from ``analyze``:

          - ``tools`` is required; the model is expected to call one of
            them rather than emit prose.
          - The user_content is passed verbatim — no
            ``<conversation_context>`` / ``<retrieved_knowledge>`` /
            ``<past_decisions>`` wrappers (those are chat-time
            primitives). The caller ow
```

### Core Architecture Module: `packages/core/openexecutive/agents/board_comms.py`
```
from openexecutive.agents.base import BaseAgent
from openexecutive.config import get_settings


class BoardCommsAgent(BaseAgent):
    name = "board_comms"
    domain = "board"
    visibility = "core"
    use_deep_reasoning = True

    @property
    def model(self) -> str:  # type: ignore[override]
        return get_settings().deep_reasoning_model

    def get_system_prompt(self) -> str:
        from openexecutive.prompts.domain_prompts import BOARD_COMMS_PROMPT

        return BOARD_COMMS_PROMPT

```

### Core Architecture Module: `packages/core/openexecutive/agents/engagement_intake.py`
```
"""Engagement Intake — the LLM that drafts a REAL client company from notes.

The grounded sibling of ``fixture_generator``: same bundle schema, same
referential-integrity rules, opposite epistemics — the fixture author invents
a plausible fictional company, while this agent models an actual client
strictly from the intake material it is given (call notes, website copy, a
brief). Output lands as a *client slot* seed (see ``openexecutive.clients``),
not in the demo fixture library.

Exposed through the Agent Council (model switchable, prompt editable) but
OUTSIDE ``SPECIALIST_REGISTRY`` so the Executive cannot call it via
``consult_specialist`` — mirroring ``fixture_generator``.
"""
from __future__ import annotations

from openexecutive.agents.base import BaseAgent
from openexecutive.config import get_settings

ENGAGEMENT_INTAKE_AGENT_ID = "engagement_intake"

# Persona + hard rules. Kept here (not in fixtures/generator.py) so the
# Council prompt editor edits this text and there is no import cycle.
ENGAGEMENT_INTAKE_SYSTEM = (
    "You are an engagement intake analyst for Open Executive. Given intake "
    "material about a REAL client company — call notes, a brief, website copy, "
    "an email thread — you model that company and emit it via the emit_fixture "
    "tool so a new client engagement can be set up. You are doing extraction "
    "and conservative structuring, NOT creative writing.\n\n"
    "Grounding rules (these override everything else):\n"
    "- Extract, don't invent: every fact in your output must trace to the "
    "intake material. When something is not stated, leave the field null or "
    "empty — NEVER estimate or fabricate numbers (ARR, burn, headcount, "
    "founding year).\n"
    "- People: include only people actually named in the material. Exactly one "
    "person has is_principal=true — the founder/CEO if named, otherwise the "
    "primary contact for the engagement.\n"
    "- Departments: model only functions the material supports (stated teams, "
    "named leaders, obvious core functions of the described business). Use "
    "authority_level=propose_only unless the material says otherwise.\n"
    "- Docs (3-6, Markdown): engagement working documents, not fictional "
    "knowledge — an intake brief (what we know), a current-state summary, a "
    "stakeholder map, and an open-questions / information-gaps list. Every "
    "unknown that matters becomes an explicit open question.\n"
    "- Memory: seed only decisions, initiatives, and prior advice the material "
    "actually states. Empty lists are fine. Add an alert only for something "
    "the material flags as time-sensitive.\n\n"
    "Structural rules:\n"
    "- Every department's head_person_name MUST exactly match a person's "
    "full_name; omit head_person_name when no leader is named.\n"
    "- Every alert's routed_to_person MUST exactly match a person's full_name.\n"
    "- Department slugs are lowercase; people's department_slugs reference them.\n"
    "- NEVER include email addresses or chat handles, even if present in the "
    "material — contacts are added deliberately later, never auto-imported.\n"
    "- Numbers are numbers, not strings."
)


class EngagementIntakeAgent(BaseAgent):
    name = ENGAGEMENT_INTAKE_AGENT_ID
    domain = "clients"
    use_deep_reasoning = False

    @property
    def model(self) -> str:  # type: ignore[override]
        # Read at access time so settings changes flow through. Same pattern
        # as FixtureGeneratorAgent.
        return get_settings().default_model

    def get_system_prompt(self) -> str:
        return ENGAGEMENT_INTAKE_SYSTEM

```

### Core Architecture Module: `packages/core/openexecutive/agents/executive_proxy.py`
```
"""Thin BaseAgent subclass so the Executive can participate in the Agent Council.

The ExecutiveProxy is NOT registered in SPECIALIST_REGISTRY and is never used for
routing. Its only purpose is to give the agents API route a uniform interface for
building AgentMeta / AgentDetail and to surface effective_*() override resolution
for the Executive's prompt and model.

The test-box endpoint calls proxy.analyze() directly — this makes a single-turn
completion, which is the correct "does this prompt produce sensible output?" check.
"""
from __future__ import annotations

from openexecutive.agents.base import BaseAgent


class ExecutiveProxy(BaseAgent):
    name = "executive"
    domain = "orchestration"
    visibility = "core"
    model = "claude-sonnet-5"  # matches DEFAULT_MODEL default
    use_deep_reasoning = False

    def get_system_prompt(self) -> str:
        # The built-in persona for this install's workspace mode (team / solo).
        from openexecutive.memory.workspace_settings import get_workspace
        from openexecutive.prompts.executive_persona import default_persona

        return default_persona(get_workspace().mode)

```

### Core Architecture Module: `packages/core/openexecutive/agents/finance.py`
```
from openexecutive.agents.base import BaseAgent
from openexecutive.config import get_settings


class FinanceAgent(BaseAgent):
    name = "cfo"
    domain = "finance"
    visibility = "core"
    use_deep_reasoning = True

    @property
    def model(self) -> str:  # type: ignore[override]
        return get_settings().deep_reasoning_model

    def get_system_prompt(self) -> str:
        from openexecutive.prompts.domain_prompts import CFO_PROMPT

        return CFO_PROMPT

```

### Core Architecture Module: `packages/core/openexecutive/agents/fixture_generator.py`
```
"""Fixture Generator — the LLM that authors company simulator fixtures.

Exposed through the Agent Council (like ``quality_judge`` / ``utility_fast``)
so its model can be switched in the UI and routed through OpenRouter, and its
system prompt edited per-deployment — but it lives OUTSIDE
``SPECIALIST_REGISTRY`` so the Executive cannot call it via the
``consult_specialist`` tool. ``openexecutive.fixtures.generator`` reads
``effective_model`` / ``effective_system_prompt`` at the start of every
generation, so Council edits take effect on the next request without a restart.
"""
from __future__ import annotations

from openexecutive.agents.base import BaseAgent
from openexecutive.config import get_settings

FIXTURE_GENERATOR_AGENT_ID = "fixture_generator"

# The author persona + hard rules. Kept here (not in fixtures/generator.py) so
# the Council prompt editor edits this text and there is no import cycle
# between the agent and the generator module.
FIXTURE_GENERATOR_SYSTEM = (
    "You are a fixture author for the Open Executive company simulator. Given a "
    "scenario description, you design a realistic, internally consistent fictional "
    "company and emit it via the emit_fixture tool. The company should feel like a "
    "real operating business: a coherent profile, a small leadership team, an org of "
    "departments with charters and goals, seeded history (decisions, initiatives, "
    "prior advice) and a few briefing alerts, plus 5-7 short knowledge docs.\n\n"
    "Hard rules:\n"
    "- Every department's head_person_name MUST exactly match a person's full_name.\n"
    "- Every alert's routed_to_person MUST exactly match a person's full_name.\n"
    "- Exactly one person has is_principal=true (the founder/CEO).\n"
    "- Department slugs are lowercase; people's department_slugs reference them.\n"
    "- NEVER invent email addresses or chat handles — omit all contact fields.\n"
    "- Numbers (ARR, burn, headcount) are numbers, not strings.\n"
    "- Make it specific and plausible: name real competitors/regulations where apt."
)


class FixtureGeneratorAgent(BaseAgent):
    name = FIXTURE_GENERATOR_AGENT_ID
    domain = "fixtures"
    use_deep_reasoning = False

    @property
    def model(self) -> str:  # type: ignore[override]
        # Read at access time so settings changes flow through. Same pattern
        # as QualityJudgeAgent / FinanceAgent.
        return get_settings().default_model

    def get_system_prompt(self) -> str:
        return FIXTURE_GENERATOR_SYSTEM

```

### Core Architecture Module: `packages/core/openexecutive/agents/hr_talent.py`
```
from openexecutive.agents.base import BaseAgent
from openexecutive.config import get_settings


class HRAgent(BaseAgent):
    name = "chro"
    domain = "hr"
    visibility = "core"

    @property
    def model(self) -> str:  # type: ignore[override]
        return get_settings().default_model

    def get_system_prompt(self) -> str:
        from openexecutive.prompts.domain_prompts import CHRO_PROMPT

        return CHRO_PROMPT

```

### Core Architecture Module: `packages/core/openexecutive/agents/legal.py`
```
from openexecutive.agents.base import BaseAgent
from openexecutive.config import get_settings


class LegalAgent(BaseAgent):
    name = "gc"
    domain = "legal"
    visibility = "core"
    use_deep_reasoning = True

    @property
    def model(self) -> str:  # type: ignore[override]
        return get_settings().deep_reasoning_model

    def get_system_prompt(self) -> str:
        from openexecutive.prompts.domain_prompts import GC_PROMPT

        return GC_PROMPT

```

### Core Architecture Module: `packages/core/openexecutive/agents/marketing.py`
```
from openexecutive.agents.base import BaseAgent
from openexecutive.config import get_settings


class MarketingAgent(BaseAgent):
    name = "cmo"
    domain = "marketing"
    visibility = "core"

    @property
    def model(self) -> str:  # type: ignore[override]
        return get_settings().default_model

    def get_system_prompt(self) -> str:
        from openexecutive.prompts.domain_prompts import CMO_PROMPT

        return CMO_PROMPT

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #317** (2026-10-01): **[Bug]  Narrative cache test passes raw today_data dict to rendered-context hash**
  *Symptoms*: Describe the bug  The upstream test_hash_changes_when_talent_pipeline_changes test passes a raw today_data dictionary to build_narrative_input_hash(), even though the function now requires the rendered context string.  The implementation intentionally rejects dictionaries with a TypeError, so the upstream test suite fails as written.  To reproduce  Steps to reproduce the behavior:  Check out origin/main. From packages/core, run: uv run pytest tests/unit/test_briefing_narrative_cache.py  The test test_hash_changes_when_talent_pipeline_changes fails because it calls: narrative_cache.build_narrative_input_hash(base)  where base is a dictionary.  build_narrative_input_hash() expects the rendered context string instead. Expected behavior  The test should pass the same rendered context that the narrative system provides to build_narrative_input_hash().  For example:  assert narrative_cache.build_narrative_input_hash(_ctx(base)) != narrative_cache.build_narrative_input_hash(_ctx(changed))  The implementation's rendered-context API should remain unchanged; the test should be updated to match it.  Environment  How you're running it: self-hosted/local development OS: macOS Python version (python --version): Python 3.12.2 Relevant config (model overrides, enabled integrations) — do not paste secrets:  No special configuration required to reproduce this issue.  Logs / output  E TypeError: build_narrative_input_hash takes the RENDERED context string E (see today._narrative_context), not d
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report and the repro steps.  I couldn't reproduce this on `main`. `test_hash_changes_when_talent_pipeline_changes` isn't in `tests/unit/test_briefing_narrative_cache.py` there. It was removed in #116, along with the rest of the talent pipeline vertical.  The rendered-context check that raises this `TypeError` came later, in #148. Because the test was already gone by then, `main` never had the two together. Every remaining hash test on `main` goes through `_ctx(...)`, and `test_hash_refuses_a_today_data_dict` covers the dict case.  Are you running a fork or branch that still has the talent pipeline? If so, your fix is the right one there: pass `_ctx(base)` and `_ctx(changed)`, or drop the test if you've removed the talent feature too.  I'm closing this as not reproducible on `main`. If you can reproduce it on a clean checkout of `main`, please reopen.

- **Issue #316** (2026-10-01): **[Bug] The /documents API rejects .xlsx files as an unsupported file type**
  *Symptoms*: Describe the bug The /documents API rejects .xlsx files as an unsupported file type, even though OpenExecutive already has Excel (.xlsx and .xlsm) document extraction implemented in knowledge/loader.py.  The current document upload endpoint's allowed file extensions do not include .xlsx or .xlsm, preventing users from uploading Excel documents through the API.  To reproduce Steps to reproduce the behavior:  Start the OpenExecutive backend locally. Set BACKEND_SHARED_SECRET and authenticate the API request using the x-api-key header. Attempt to upload an .xlsx file using the /documents endpoint: curl -X POST http://localhost:8000/documents \   -H "x-api-key: $BACKEND_SHARED_SECRET" \   -F "file=@test.xlsx" \   -F "domain=strategy" The API rejects the file with an unsupported file type error.  Expected behavior An .xlsx file should be accepted by the /documents endpoint and passed to the existing Excel document extraction functionality.  The document loader already supports .xlsx and .xlsm files, so the upload endpoint should allow those extensions.  Environment How you're running it: Self-hosted/local development OS: macOS Python version (python --version): Python 3.12 Relevant config (model overrides, enabled integrations) — do not paste secrets: Local OpenExecutive API running on http://localhost:8000. BACKEND_SHARED_SECRET authentication is enabled. Logs / output {"detail":"Unsupported file type: .xlsx. Allowed: .txt, .md, .doc, .pdf, .docx"} The relevant code in packages/c
  **Post-Mortem & Fix Analysis**:
  > Thanks for the clear report, @dmccoy26. Fixed in #318: `/documents` and the Knowledge page now accept `.xlsx`, `.xlsm` and `.csv`. Legacy `.xls` is still unsupported, since the parser can't read it.  --- _Generated by [Claude Code](https://claude.ai/code)_

- **Issue #315** (2026-10-01): **[Bug]  The Slack integration drops inbound messages silently across multiple independent gates.**
  *Symptoms*: Describe the bug The Slack integration drops inbound messages silently across multiple independent gates. When a message is dropped, the sender gets no signal at all — no reply, no ephemeral message, nothing. "The bot is ignoring me" is indistinguishable from "the bot never saw my message." Some paths write audit log rows, but nothing is user-facing.  Code inspection of packages/core/openexecutive/integrations/slack_bot.py (main @ https://github.com/nemsoft-eu/OpenExecutive/commit/eb230cc759d1cd9eb84ac56a2a88060cb639ef4d) surfaced four independent silent-drop paths:  Roster gate — any message from a Slack user with no matching slack_user_id on a non-archived Person row is dropped (rejected_unknown_sender, ~L703–721). Slack has no env allowlist, so this is the only access control, and a misconfigured roster looks exactly like a dead bot.  Response gate — non-mention messages in threads the bot has previously replied in go through response_gate.should_respond; a NO decision silently skips the message (skipped_gate, ~L765–804). False negatives are invisible to the sender.  Thread-history fetch timeout — conversations_replies has a 5s bound, and on timeout the message is deliberately discarded ("a slow Slack API should cost one missed continuation", ~L622–642). On a slow connection, continuations vanish without a trace.  Startup auth_test() failure — if the bot's user ID can't be resolved at boot, thread auto-continuation is disabled while mentions/DMs keep working (~L477–493). T
  **Post-Mortem & Fix Analysis**:
  > Thanks for report. I went through each case against current `main`.   **A. Unknown sender: already fixed on `main`.** Since #273, a message from someone not on the People roster is no longer just dropped. When they DM the bot or @-mention it, the message is held for the owner to approve, and the sender is told it arrived. In a DM that's a normal reply, and in a channel it's an ephemeral message only they can see. Once the owner adds them, the held message is processed. Two cases still stay silent on purpose: thread replies that don't @-mention the bot (the bot wasn't addressed).  **B. Response gate: audited today, and we could add a visible signal.** A skip is recorded in the audit log as an `integration_inbound` row with `outcome: skipped_gate` and the gate's reason, so it's queryable on the `/audit` page. You're right that the sender doesn't see anything, though. We could have the bot add a 👀 reaction to messages it skips, so it's clear the message was read and the sender knows to @

- **Issue #136** (2026-09-19): **[Bug] Slack approval cannot complete briefing action**
  *Symptoms*: [bug] Slack approval cannot complete briefing action  Describe the bug  Open Executive's Slack integration appears to request user approval for actions that can currently only be approved through the web application's Briefing page.  During a Slack conversation, Open Executive asked the user to confirm a scheduled morning briefing test and specifically asked whether it should be sent to Slack. The user provided the requested confirmation and additional clarification through Slack.  However, after the user supplied the required information, Open Executive returned:  I encountered an error processing your request. Please try again.  The current approval workflow appears to exist only on the Briefing page, while the Slack assistant is nevertheless presenting the interaction as though approval can be provided directly through Slack.  This creates a mismatch between the capabilities presented by the Slack assistant and the approval functionality actually available in the application.  To reproduce  Steps to reproduce the behavior:  1. Use the Open Executive Slack integration. 2. Ask about scheduling/testing a morning briefing. 3. Allow Open Executive to ask for confirmation/approval. 4. Respond to the approval request directly in Slack. 5. Clarify any additional information requested by the assistant, such as:     * The request is a morning briefing.    * It is a test.    * The standard briefing should be used.    * The result should be sent to Slack. 6. Observe that Open Executiv

- **Issue #132** (2026-09-17): **[Bug]  ALLOWED_EMAILS overridden by backend roster**
  *Symptoms*: ## Describe the bug  The `ALLOWED_EMAILS` configuration is overridden when the backend contains existing Person records with email addresses.  I configured an email address in `ALLOWED_EMAILS`. After existing Person records with different email addresses were present in the backend, the configured email was no longer allowed to authenticate.  The `ALLOWED_EMAILS` value itself was not changed, but the backend roster effectively took precedence over it.  ## To reproduce  1. Configure `ALLOWED_EMAILS` with an email address. 2. Start OpenExecutive. 3. Have the backend contain one or more Person records with email addresses. 4. Attempt to authenticate using the email configured in `ALLOWED_EMAILS`. 5. Authentication is rejected because the email is not present in the backend roster. 6. Inspect `/auth/allowed-emails` and observe that only the backend Person emails are returned.  ## Expected behavior  An email explicitly configured in `ALLOWED_EMAILS` should remain authorized even when additional Person records exist in the backend.  Adding Person records with other email addresses should not cause an existing `ALLOWED_EMAILS` entry to lose access.  If the backend roster is intentionally supposed to replace `ALLOWED_EMAILS` once it contains email addresses, this behavior should be clearly documented and there should be an obvious mechanism for adding additional authorized users.  ## Environment  * How you're running it: `make dev` * OS: macOS * Deployment: self-hosted/local * Authen

- **Issue #131** (2026-09-17): **[Bug]  Slack bot does not start with the standard make dev startup**
  *Symptoms*: ## Describe the bug  The Slack Socket Mode integration does not start automatically when OpenExecutive is launched using the standard `make dev` command.  The Slack bot can be started manually with:  python -m openexecutive.integrations.slack_bot  and works correctly, including receiving DMs and channel mentions and generating responses. However, the normal `make dev` startup launches the FastAPI backend and Next.js UI without starting the Slack Socket Mode listener.  The Slack integration already has `run_slack_bot()` and Socket Mode support, but it was not connected to the FastAPI application's startup/lifespan process.  ## To reproduce  Steps to reproduce the behavior:  1. Configure valid SLACK_BOT_TOKEN and SLACK_APP_TOKEN values in the OpenExecutive environment. 2. Start OpenExecutive using the standard development command:  make dev  3. Confirm that the FastAPI backend and Next.js UI start successfully. 4. Send a DM or @mention to the OpenExecutive Slack bot. 5. Observe that the Slack bot does not respond because the Socket Mode listener was not started by make dev.  For comparison, stop the application and run:  cd packages/core source .venv/bin/activate python -m openexecutive.integrations.slack_bot  The Slack bot then starts successfully and responds to Slack messages.  ## Expected behavior  When valid Slack credentials are configured, running make dev should start the Slack Socket Mode listener along with the rest of the OpenExecutive application.  The Slack integra
  **Post-Mortem & Fix Analysis**:
  > Thanks.  Nice catch, one of the first integrations and that got overlooked. Ill put up the fix.

- **Issue #128** (2026-09-17): **[Bug]  Anthropic workspace-scoped API keys cause chat requests to fail**
  *Symptoms*: ## Describe the bug  When running OpenExecutive locally with an Anthropic API key that is not scoped to a specific workspace, chat requests fail with an Anthropic HTTP 400 error.  The OpenExecutive frontend successfully authenticates, the backend proxy works, and the chat endpoint initially returns HTTP 200 because it is an SSE/streaming endpoint. However, when the backend attempts to initiate the Anthropic streaming request, Anthropic rejects the request because the required `anthropic-workspace-id` header is missing.  The frontend displays:  ```text Something went wrong: An internal error occurred. Please try again. ```  The underlying backend error indicates:  ```text This API key is not scoped to a workspace, so this request must include the anthropic-workspace-id header with the ID of the workspace to use. ```  The issue was resolved by adding an optional `ANTHROPIC_WORKSPACE_ID` configuration value and passing it to the Anthropic SDK as the `anthropic-workspace-id` header.  ## To reproduce  Steps to reproduce the behavior:  1. Clone and configure OpenExecutive for a local/self-hosted installation. 2. Configure an Anthropic API key that is not scoped to a specific workspace. 3. Configure the application to use an Anthropic Claude model. 4. Start the OpenExecutive backend with Uvicorn. 5. Start the Next.js frontend with `npm run dev`. 6. Log into the application using the configured authentication provider. 7. Send a chat message. 8. The frontend successfully sends the re

- **Issue #125** (2026-09-17): **[Bug] The readme does not match first time install process**
  *Symptoms*: ## Describe the bug The readme does not match the first time install instructions **make dev**   reported -f not expected  **cd packages/core** good  **uv sync** good. Lots installed  **source .venv/bin/activate** source : The term 'source' is not recognized as the name of a cmdlet, function, script file, or operable program.  **uvicorn openexecutive.api.main:app --reload --port 8000** uvicorn : The term 'uvicorn' is not recognized as the name of a cmdlet, function, script file, or operable program.   A clear and concise description of what the bug is.  ## To reproduce  Steps to reproduce the behavior:  1. Follow the instructions in the readme to the letter  ## Expected behavior Install would succede.   What you expected to happen instead. See above  ## Environment  - How you're running it: [ `make dev`] - OS: Windows 11 - Python version (`python --version`): Python 3.14.5 - Relevant config (model overrides, enabled integrations) — **do not paste secrets**:  ## Logs / output  ``` Paste relevant logs or error output here (redact any secrets or personal data). ```  ## Additional context  Anything else that might help us diagnose the issue. 
  **Post-Mortem & Fix Analysis**:
  > appears to resolve when running under a bash shell rather than PowerShell. **make dev SHELL="C:/Program Files/Git/bin/sh.exe"**

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

### Incident Patch 1: `639f968d` (2026-10-06)
**Commit Message**: feat(ui): play the Council Consult animation while the Executive works (#368)

<!-- ccr-projects-attribution: {"github_login":"johnrufusone"} -->
_Requested by **Rufus** · [project
thread](https://claude.ai/code/project/chan_01KdjdZHJtboAfcbRxDQxY2F?thread=cmsg_01KdjdZHJtboAfcbRxDQxY2FFmJkFyqzitEmZDCxV8fk4N)_

## Problem

Before: while the Executive works on a reply, chat and Ask OE show three
generic bouncing dots next to the still Council logo.

After: the Council logo plays Consult. A line reaches from the Executive
to each specialist in turn and lights it up, then lets go. Before any
reply text arrives, the Executive's avatar in chat plays it. Once text
is streaming, a small Council mark in the status row replaces the dots
when the turn stalls (chat and Ask OE). With reduced motion it is the
still logo.

## Approach

- `CouncilMark` / `BrandMark` take a `consulting` prop that adds the
five spokes and the animation classes. The seat positions are now one
`SEATS` list, so the spokes always meet the dots.
- The keyframes live in `globals.css`. The base styles are the still
mark, so `prefers-reduced-motion` just switches the animation off.
- `TurnStatusRow` shows the small mark ins

**File**: `packages/ui/src/app/globals.css` (modified, +45/-0)
```diff
@@ -103,6 +103,51 @@
   }
 }
 
+/* Consult: the Council mark while the Executive works on a reply (CouncilMark
+ * with `consulting`). A line reaches from the Executive to each specialist in
+ * turn and lights it up, then lets go; the loop starts again from the still
+ * mark. The base styles below are that still mark, so with reduced motion
+ * (animation: none) nothing is dimmed and no line shows. */
+.council-consult circle {
+  transform-box: fill-box;
+  transform-origin: center;
+}
+.council-consult .council-spoke {
+  stroke-width: 2.5;
+  stroke-linecap: round;
+  stroke-dasharray: 18;
+  stroke-dashoffset: 18;
+  opacity: 0;
+  animation: council-spoke 3.6s ease-out infinite both;
+}
+.council-consult .council-seat {
+  animation: council-seat 3.6s ease-out infinite both;
+}
+.council-consult .council-core {
+  animation: council-core 3.6s ease-in-out infinite both;
+}
+@keyframes council-spoke {
+  0% { stroke-dashoffset: 18; opacity: 0.85; }
+  14%, 62% { stroke-dashoffset: 0; opacity: 0.85; }
+  80%, 100% { stroke-dashoffset: 0; opacity: 0; }
+}
+@keyframes council-seat {
+  0% { opacity: 0.45; transform: scale(1); }
+  8% { opacity: 1; transform: scale(1.28); }
+  20%, 62% { opacity: 1; transform: scale(1); }
+  80%, 100% { opacity: 0.45; transform: scale(1); }
+}
+@keyframes council-core {
+  0%, 100% { transform: scale(1); }
+  70% { transform: scale(1.14); }
+  78% { transform: scale(1); }
+}
+@media (prefers-reduced-motion: reduce) {
+  .council-consult * {
+    animation: none !important;
+  }
+}
+
 /* Respect user motion preferences. */
 @media (prefers-reduced-motion: reduce) {
   *,
```

**File**: `packages/ui/src/components/BrandMark.tsx` (modified, +58/-11)
```diff
@@ -12,28 +12,75 @@ const MARK_CLASSES: Record<BrandMarkSize, string> = {
   lg: "w-8 h-8 text-white",
 };
 
-/** The Council mark alone: the Executive in the middle, five specialists around it. */
-export function CouncilMark({ className = "" }: { className?: string }) {
+// The five specialists' seats around the Executive at (24, 24).
+const SEATS: ReadonlyArray<readonly [number, number]> = [
+  [24, 6.5],
+  [40.6, 18.6],
+  [34.3, 38.2],
+  [13.7, 38.2],
+  [7.4, 18.6],
+];
+
+/**
+ * The Council mark alone: the Executive in the middle, five specialists around it.
+ *
+ * `consulting` plays the Consult animation (globals.css): a line reaches from
+ * the Executive to each specialist in turn and lights it up, then lets go.
+ * Used while the Executive is working on a reply; with reduced motion it is
+ * the still mark.
+ */
+export function CouncilMark({
+  className = "",
+  consulting = false,
+}: {
+  className?: string;
+  consulting?: boolean;
+}) {
   return (
-    <svg viewBox="0 0 48 48" fill="currentColor" className={className} aria-hidden>
-      <circle cx="24" cy="24" r="7.5" />
-      <circle cx="24" cy="6.5" r="4" />
-      <circle cx="40.6" cy="18.6" r="4" />
-      <circle cx="34.3" cy="38.2" r="4" />
-      <circle cx="13.7" cy="38.2" r="4" />
-      <circle cx="7.4" cy="18.6" r="4" />
+    <svg
+      viewBox="0 0 48 48"
+      fill="currentColor"
+      className={`${consulting ? "council-consult overflow-visible " : ""}${className}`}
+      aria-hidden
+    >
+      {consulting &&
+        SEATS.map(([x, y], i) => (
+          <line
+            key={`l${i}`}
+            className="council-spoke"
+            x1="24"
+            y1="24"
+            x2={x}
+            y2={y}
+            stroke="currentColor"
+            style={{ animationDelay: `${i * 0.18}s` }}
+          />
+        ))}
+      {SEATS.map(([x, y], i) => (
+        <circle
+          key={`s${i}`}
+          className={consulting ? "council-seat" : undefined}
+          cx={x}
+          cy={y}
+          r="4"
+          style={consulting ? { animationDelay: `${i * 0.18 + 0.25}s` } : undefined}
+        />
+      ))}
+      <circle className={consulting ? "council-core" : undefined} cx="24" cy="24" r="7.5" />
     </svg>
   );
 }
 
 interface BrandMarkProps {
   size?: BrandMarkSize;
+  /** Play the Consult animation, while the Executive is working on a reply. */
+  consulting?: boolean;
 }
 
-export default function BrandMark({ size = "sm" }: BrandMarkProps) {
+export default function BrandMark({ size = "sm", consulting = false }: BrandMarkProps) {
   return (
     <div className={BOX_CLASSES[size]} aria-hidden>
-      <CouncilMark className={MARK_CLASSES[size]} />
+      <CouncilMark className={MARK_CLASSES[size]} consulting={consulting} />
     </div>
   );
 }
```

**File**: `packages/ui/src/components/Chat.tsx` (modified, +2/-2)
```diff
@@ -667,11 +667,11 @@ export default function Chat({ onDebugEvent, initialMessages, initialSessionId,
               {status.show && !streamingContent && (
                 <div className="flex gap-4 mb-8">
                   <div className="flex-shrink-0 mt-1">
-                    <BrandMark size="md" />
+                    <BrandMark size="md" consulting />
                   </div>
                   <div className="flex-1 pt-1.5">
                     <div className="text-xs text-fg-muted mb-3 font-medium tracking-wide uppercase">Executive</div>
-                    <TurnStatusRow status={status} committeePhase={committeePhase} />
+                    <TurnStatusRow status={status} committeePhase={committeePhase} showMark={false} />
                   </div>
                 </div>
               )}
```

**File**: `packages/ui/src/components/TurnStatusRow.tsx` (modified, +7/-10)
```diff
@@ -1,6 +1,7 @@
 "use client";
 
 import { useEffect, useState } from "react";
+import { CouncilMark } from "./BrandMark";
 import CommitteePhaseIndicator from "./CommitteePhaseIndicator";
 import type { CommitteePhase } from "@/lib/api";
 import type { TurnStatus } from "@/lib/turnStatus";
@@ -39,24 +40,20 @@ export function useTurnClock(isLoading: boolean) {
   };
 }
 
+// `showMark` is off where the Executive's avatar beside the row already plays
+// the Consult animation, so the turn doesn't show it twice.
 export default function TurnStatusRow({
   status,
   committeePhase,
+  showMark = true,
 }: {
   status: TurnStatus;
   committeePhase: CommitteePhase | null;
+  showMark?: boolean;
 }) {
   return (
-    <div className="flex items-center gap-2 flex-wrap">
-      <div className="flex gap-1.5" aria-label="Thinking">
-        {[0, 1, 2].map((i) => (
-          <div
-            key={i}
-            className="w-1.5 h-1.5 bg-fg-muted rounded-full animate-bounce motion-reduce:animate-none"
-            style={{ animationDelay: `${i * 0.15}s` }}
-          />
-        ))}
-      </div>
+    <div className="flex items-center gap-2 flex-wrap" aria-label="Thinking">
+      {showMark && <CouncilMark consulting className="w-4 h-4 text-accent" />}
       {committeePhase ? (
         <CommitteePhaseIndicator phase={committeePhase} />
       ) : status.label ? (
```

---

### Incident Patch 2: `8c15b9d8` (2026-10-05)
**Commit Message**: fix(people): point roster emails at Home and name who a reply is about (#366)

## Problem

When someone new writes in, the roster-request email and chat prompt
tell the principal to use "the card on your Today page". The briefing
now lives on Home, and /today only redirects there. The email that
confirms an answer is titled "Re: roster request 42", which is an
internal record number.

## Approach

The prompts now say "the card on your Home page". The confirmation
subject is now "Re: Who is <name>?", which matches the question email it
answers. A test asserts the new subject.

Arch-Docs: n/a - wording of user-facing messages only

## Checklist

- [x] Working implementation, no stubs or TODO placeholders
- [x] Tests added/updated for new behavior
- [x] `ruff check` and `mypy` pass
- [ ] UI builds if touched (not touched)
- [ ] Eval scenarios added for a new agent or prompt change (not
applicable)
- [x] Architecture docs updated if a documented topic changed (waived:
wording only)
- [x] No secrets, credentials, or personal data committed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

---
_Generated by [Claude
Code](https://claude.ai/code/session_01GDVXGBbCWsRmwAqcKo

**File**: `packages/core/openexecutive/integrations/roster_intake.py` (modified, +12/-7)
```diff
@@ -252,15 +252,20 @@ def _chat_prompt(request: rr.RosterRequest, acknowledged: bool = True) -> str:
         "they said.\n"
         f"Tell me who {who} is and I'll add them — for example \"that's Annamarie, "
         "add her to the team\", \"add them as a contact\", \"that's <someone already "
-        "on the People list>\", or \"ignore\". The card on your Today page works too."
+        "on the People list>\", or \"ignore\". The card on your Home page works too."
     )
 
 
+def _subject_who(request: rr.RosterRequest) -> str:
+    """Who a request is about, safe for a Subject line: the name comes from the
+    unknown sender, so line breaks are collapsed and its length capped."""
+    return " ".join((request.display_name or request.channel_ref).split())[:80]
+
+
 def _email_prompt(
     request: rr.RosterRequest, token: str, acknowledged: bool = True,
 ) -> tuple[str, str]:
-    subject_who = request.display_name or request.channel_ref
-    subject = f"Who is {subject_who}? [{token}]"
+    subject = f"Who is {_subject_who(request)}? [{token}]"
     body = (
         f"{rr.describe(request)}.\n\n"
         f"{_told(acknowledged)}. I haven't replied to what they said.\n\n"
@@ -270,7 +275,7 @@ def _email_prompt(
         "  - \"Add them as a contact\"\n"
         "  - \"That's <someone already on the People list>\"\n"
         "  - \"Ignore\"\n\n"
-        "Or use the card on your Today page.\n\n"
+        "Or use the card on your Home page.\n\n"
         f"(Reference {token} — keep it in your reply. It works once.)"
     )
     return subject, body
@@ -660,15 +665,15 @@ async def _apply_answer(request: rr.RosterRequest, text: str, *, via: str) -> st
         if ambiguous:
             return (
                 f"More than one person on your People list is called {name}, so "
-                "they're still waiting. Use the full name, or the card on your Today page."
+                "they're still waiting. Use the full name, or the card on your Home page."
             )
         if person is not None and person.id is not None:
             await answer(request.id, "link", via=via, link_person_id=person.id)
             return f"Done — {rr.channel_label(request.channel)} {request.channel_ref} is now {person.full_name}'s."
         if decision == "link":
             return (
                 f"I couldn't find {name or 'that person'} on your People list, so "
-                "they're still waiting. Use their full name, or the card on your Today page."
+                "they're still waiting. Use their full name, or the card on your Home page."
             )
         full_name = name or request.display_name
         if not full_name:
@@ -690,7 +695,7 @@ async def _reply_to_principal(gateway: Any, to: str, request: rr.RosterRequest,
     try:
         with set_session(None):
             await send_from_executive(
-                gateway, to=to, subject=f"Re: roster request {request.id}", body=text,
+                gateway, to=to, subject=f"Re: Who is {_subject_who(request)}?", body=text,
             )
     except Exception:
         logger.warning("roster_intake: replying to the principal failed", exc_info=True)
```

**File**: `packages/core/tests/unit/test_roster_intake.py` (modified, +10/-0)
```diff
@@ -433,6 +433,16 @@ def test_the_principal_adds_them_by_email(pending: tuple[rr.RosterRequest, str])
     # The parser reads the principal's own words, not the quoted request.
     assert seen == ["That's Annamarie Chen, add her"]
     assert sent.await_args.args[1]["arguments"]["to"] == OWNER
+    # The confirmation names who it is about, not an internal record number.
+    assert sent.await_args.args[1]["arguments"]["subject"] == f"Re: Who is {req.display_name}?"
+
+
+def test_the_subject_names_who_safely_even_without_a_display_name() -> None:
+    no_name = SimpleNamespace(display_name="", channel_ref="new@example.com")
+    assert roster_intake._subject_who(no_name) == "new@example.com"  # type: ignore[arg-type]
+    hostile = SimpleNamespace(display_name="Bob\r\nBcc: x@example.com" + "y" * 200, channel_ref="r")
+    who = roster_intake._subject_who(hostile)  # type: ignore[arg-type]
+    assert "\r" not in who and "\n" not in who and len(who) == 80
 
 
 def test_this_is_someone_on_the_list_links_them(pending: tuple[rr.RosterRequest, str], roster: SimpleNamespace) -> None:
```

---

### Incident Patch 3: `81458559` (2026-10-05)
**Commit Message**: fix(delegation): let the email's own greeting decide who a group email asks (#365)

<!-- ccr-projects-attribution: {"github_login":"johnrufusone"} -->
_Requested by **Rufus** · [project
thread](https://claude.ai/code/project/chan_01KdjdZHJtboAfcbRxDQxY2F?thread=cmsg_01KdjdZHJtboAfcbRxDQxY2FAUGXzKXh44RegqKUbRWQKN)_

## Problem

The inbox watcher still drafts a reply to group mail that greets a
colleague by name. For example, "Good morning, Priya, could you please
sign the amendment?" goes to the person and Priya. The person is in To,
and the classifier's single `asked_of_them` answer came back true on
every re-run. Since #343 relied on that answer alone, the draft went
through.

## Approach

- The classifier now also returns `asked_names`, the names the email
greets or asks by name.
- Code matches those names against the person's name with `names_them`.
A match means equal name parts, or a prefix of at least three letters.
- When the email names anyone, the name match decides. `asked_of_them`
only decides when the email names nobody.
- Mail sent to the person alone, and the Cc-only rule, work as before.

## Checklist

- [x] Working implementation — no stubs or TODO placeholders
- [x

**File**: `packages/core/openexecutive/architecture/architecture-facts.yaml` (modified, +9/-3)
```diff
@@ -8923,9 +8923,15 @@ delegation:
     fyi, thanks, pitch, notification, newsletter, phishing and other never
     get one, and any failure or malformed answer means none.
     A group email (anyone else in To or Cc besides the sender and the
-    Executive) is drafted for only when the person is in To and the
-    classifier's asked_of_them is true: it names or greets them, not someone
-    else by name or the group at large. The classifier is told the person's
+    Executive) is drafted for only when the person is in To and the email
+    asks them themselves. The classifier lists the names the email greets or
+    asks by name (asked_names) and code matches them against the person's
+    name (inbox_classifier.names_them, whole name parts only, so "Alexis"
+    never counts for "Alex" and a nickname misses), so mail that greets someone else is
+    never theirs even when the model's overall asked_of_them says it is (a
+    real miss: "Good morning, <colleague>, could you sign ..." to the person
+    and that colleague). Only when it names nobody does asked_of_them decide,
+    false for the group at large. The classifier is told the person's
     name, To or Cc, and how many others; a Cc-only person never gets a
     draft. Recorded not_needed / asks_someone_else.
   inbox_drafting: |
```

**File**: `packages/core/openexecutive/architecture/prebuilt/delegation.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "delegation",
   "title": "Act as Me (Delegation)",
-  "markdown": "The **delegation** module (`openexecutive.delegation`) is **Act as me**: the one place the Executive writes *as* a person instead of as itself. Everywhere else it has its own Google account and bots and signs as itself. Here — when the person asks, or, with a second switch, for mail in their inbox that needs them — it writes an email in their voice and saves it as a **draft in their own mailbox** — Gmail or Outlook — for them to review and send. The one thing it ever sends is one of those inbox drafts, exactly as it is in their mailbox: when the person taps **Send** on its card, or, with a third switch, **Handle it for me**, on its own when plain-code rules allow it (below); chat never sends. The principal can turn it on for themselves, and so can each team member once the owner lets them. It is off by default, and off changes nothing: the prompts, tool lists and prompt caches are byte-identical to an install without it.\n\n## Who can have it, and when it is offered\n\n`delegation.settings.can_delegate(person)` is the single rule for who may turn it on: the principal (a non-archived team member flagged `is_principal`), and any other non-archived team member — never a contact — once team members may have it (`team_members_enabled`). That takes two things: the install allows it (`DELEGATION_TEAM_MEMBERS`, default off, which offers the owner the switch) and the owner turned on **Let team members use it** (`PUT /delegation/team`, principal only, one row in `delegation_team`). Turning the owner's switch off takes it away from every team member from their next message, and their inbox watchers stop at their next check; their own switches, drafts and cards are kept. Everything is keyed by `person_id`. A person turns it on for themselves (`PUT /delegation`); nobody turns it on for anyone else. The setting is one row per person in `delegation_settings`, and a missing, unreadable or zero row all mean off.\n\nAt the start of every chat turn (`Executive.stream_chat` and the committee path) `pin_turn_delegation(session, speaker_text)` runs next to the workspace-mode pin and records a `TurnDelegation` on the session. `ghostwrite_email` is **offered** only when all of these hold:\n\n- the speaker may have it and turned it on — read fresh every turn, so turning it off applies from the next message;\n- the speaker is on a surface that verified it is them — the principal through `people_tools.is_principal_on_verified_surface`, a team member through `teammate_on_verified_surface` (the web app signed in, their own Slack or Discord, never an email turn) — and a web turn also carried a signed-in caller (`Session.web_caller_signed_in`, set from `x-caller-email`) or runs under local login — a request with no caller header is not a sign-in and never gets it (whoever holds the shared secret is trusted as the UI proxy that stamps that header, as on every principal-only route);\n- the conversation is private to the speaker: the web chat, a Slack or Discord DM, or a verified private Telegram chat — never a shared channel or thread, where the draft's preview or the matching threads would be posted for everyone and other people's messages sit in the model's context;\n- the turn is neither unattended (the scheduler's proactive run) nor private to the principal (the email poller's turns), so inbound text can never reach it. The MCP server, workflows, reflection and research never carry it at all.\n\nThe mailbox connection is deliberately **not** part of the offer: the handler checks it on every call and says how to fix it, so the cached tool prefix never flips when a token lapses. The pin lives in a context variable for the turn's task as well as on the session, so two turns running at once on one session (a second browser tab) each read their own. It also carries the speaker's own words for the turn (a new email may go to an address they just typed — the turn's message joins the history only once the turn ends), a per-turn draft count, and `touched_mail` (see Privacy). `own_words` reads those words back for every own-words check (addresses here, facts and task assignments elsewhere): it first removes the hydrated `<outbound_reply_context>` backstory by its exact, anchored shape, so a look-alike closing tag quoted inside it cannot pass the rest off as the speaker's, then drops other adapter tag blocks, and returns nothing for a message carrying an attachment.\n\n## The tool: `ghostwrite_email`\n\nIt lives in its own registry (`orchestrator.delegation_tools.DELEGATION_TOOLS` / `DELEGATION_TOOL_HANDLERS`), **never** `_ALL_SKILL_TOOLS`, so no other toolkit can carry it. On a turn it is offered to, the agent loop adds it to the pool *before* the sort and builds that turn's handler map from both registries; on any other turn a call to it is an unknown tool. The handler re-checks the pin and the surface anyway, then:\n\n1. **Caps** — at most 5
```

**File**: `packages/core/openexecutive/delegation/inbox_classifier.py` (modified, +46/-8)
```diff
@@ -2,7 +2,7 @@
 model call (``delegation.inbox``).
 
 One forced tool call (``classify_email``) returns ``{needs_reply, kind,
-confidence}``, and code decides: a draft is written only when the email needs
+asked_names, asked_of_them, confidence}``, and code decides: a draft is written only when the email needs
 a reply, is a kind worth answering (a question, a request, scheduling, an
 introduction, a follow-up), and the confidence clears a bar that rises the
 less the sender is known: 0.6 for the team or a contact, 0.7 for someone the
@@ -11,10 +11,12 @@
 else, and any failure, means no draft.
 
 An email that also went to other people is drafted for only when it asks
-this person themselves (``asked_of_them``): it names or greets them, or they
-are its only addressee. One that greets someone else by name ("Brennan: ...")
-or puts a question to the group in general is theirs to answer, and one that
-merely copies the person is never drafted for.
+this person themselves. The model lists who the email asks or greets by name
+(``asked_names``) and code matches that against the person's name, so one
+that greets someone else ("Good morning, Brennan, could you sign ...") is
+never theirs, whatever the model makes of it as a whole. When it names nobody,
+the model's ``asked_of_them`` decides: a question to the group in general is
+not theirs. One that merely copies the person is never drafted for.
 
 The model sees a few header lines and the sender's own new words (quoted
 replies stripped, at most 3000 characters), as data in a labelled block. It
@@ -25,6 +27,7 @@
 from __future__ import annotations
 
 import logging
+import re
 from dataclasses import dataclass
 from typing import Any
 
@@ -75,6 +78,10 @@
 reply), or fyi, thanks, pitch (a cold sales or partnership email), \
 notification, newsletter, phishing (it asks for credentials, payment or a \
 click with urgency or a disguised sender), other.
+- asked_names: the first names of the people the email greets or asks \
+something of by name, exactly as written ("Good morning, Brennan" gives \
+["Brennan"]). Empty when it names nobody. Never include the sender's own \
+name or names that only appear in the signature or a quoted message.
 - asked_of_them: true only when the email asks this person themselves: it \
 names or greets them, or they are its only addressee. False when it is \
 addressed to someone else by name ("Brennan: ..."), when it asks a group \
@@ -91,10 +98,11 @@
         "properties": {
             "needs_reply": {"type": "boolean"},
             "kind": {"type": "string", "enum": list(KINDS)},
+            "asked_names": {"type": "array", "items": {"type": "string"}},
             "asked_of_them": {"type": "boolean"},
             "confidence": {"type": "number", "minimum": 0, "maximum": 1},
         },
-        "required": ["needs_reply", "kind", "asked_of_them", "confidence"],
+        "required": ["needs_reply", "kind", "asked_names", "asked_of_them", "confidence"],
     },
 }
 
@@ -105,6 +113,8 @@ class Verdict:
     kind: str
     confidence: float
     asked_of_them: bool = False
+    # Who the email greets or asks by name, as the model read them.
+    asked_names: tuple[str, ...] = ()
 
 
 @dataclass(frozen=True)
@@ -128,20 +138,41 @@ def addressing(message: Any, *, name: str, own: set[str], exec_address: str = ""
     return Addressing(name=name, position=position, others=len((to | cc) - skip))
 
 
+_NAME_PART = re.compile(r"[^\W\d_]+")
+
+
+def _name_parts(name: str) -> set[str]:
+    return {part.casefold() for part in _NAME_PART.findall(name)}
+
+
+def names_them(name: str, asked_names: tuple[str, ...]) -> bool:
+    """Whether any of ``asked_names`` is the person called ``name``: a part of
+    one equals a part of their name. Only exact parts count, so "Alexis" never
+    stands for "Alex"; a nickname the email uses ("Rob" for Robert) misses, and
+    a miss means no draft, the safe side."""
+    theirs = _name_parts(name)
+    return any(_name_parts(asked) & theirs for asked in asked_names)
+
+
 def wants_draft(verdict: Verdict, relation: str, addressed: Addressing | None = None) -> bool:
     """Whether code drafts a reply for ``verdict`` from a sender of this
     ``relation`` (unknown relations get the stranger's bar). With
     ``addressed``, the person must be in To (only copied, it is never theirs
     to answer), and an email that also went to others must ask them
-    themselves."""
+    themselves: it names them, or it names nobody and the model judged it
+    theirs."""
     bar = THRESHOLDS.get(relation, THRESHOLDS["stranger"])
     if not (verdict.needs_reply and verdict.kind in DRAFT_KINDS and verdict.confidence >= bar):
         return False
     if addressed is None:
         return True
     if addressed.position != "to":
         return False
-    return addressed.others == 0 or verdict.asked_of_them
+    if addressed.others == 0:
+        return True
+    if verdict.asked_names:
+        return names_them(add
```

**File**: `packages/core/openexecutive/evals/_scenarios/delegation_inbox_010.yaml` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+id: delegation_inbox_010
+domain: delegation
+type: inbox
+description: "Inbox watcher: an outside contact writes to the person and a colleague, copies two of their own team, says good morning to the colleague by name and asks for a signature. The colleague is asked, so nothing is drafted for the person."
+inbox:
+  person:
+    full_name: Olivia Owner
+    email: olivia@fernway.example
+  relation: contact
+  expect: no_draft
+  thread:
+    id: t-amendment
+    subject: Second amendment to the purchase agreement
+    messages:
+      - from: "Dana Pruitt <dana@harrowfield.example>"
+        to: ["priya@fernway.example", "olivia@fernway.example"]
+        cc: ["lee@harrowfield.example", "sam@harrowfield.example"]
+        text: |
+          Good morning,  Priya,
+
+          Hope you're doing well!
+
+          Could you please sign the Second Amended Purchase and Sale Agreement?
+
+          Thank you!
+
+          Dana Pruitt
+          Harrowfield Partners
```

**File**: `packages/core/tests/unit/test_delegation_inbox.py` (modified, +48/-0)
```diff
@@ -508,6 +508,54 @@ def test_someone_only_copied_never_gets_a_draft() -> None:
     assert ic.wants_draft(verdict, "team", ic.Addressing(name="Olivia", position="", others=0)) is False
 
 
+def test_a_name_the_email_greets_decides_over_the_models_judgement() -> None:
+    # The model said "asks them" for mail that greets a colleague: code goes
+    # by the names.
+    to_them = ic.Addressing(name="Olivia Owner", position="to", others=3)
+    greets_priya = ic.Verdict(True, "request", 0.95, asked_of_them=True, asked_names=("Priya",))
+    assert ic.wants_draft(greets_priya, "contact", to_them) is False
+    greets_both = ic.Verdict(True, "request", 0.95, asked_of_them=False, asked_names=("Priya", "Olivia"))
+    assert ic.wants_draft(greets_both, "contact", to_them) is True
+    # Names nobody: the model's judgement stands.
+    nobody = ic.Verdict(True, "request", 0.95, asked_of_them=True)
+    assert ic.wants_draft(nobody, "contact", to_them) is True
+    assert ic.wants_draft(ic.Verdict(True, "request", 0.95), "contact", to_them) is False
+    # Mail to them alone needs no name.
+    alone = ic.Addressing(name="Olivia Owner", position="to", others=0)
+    assert ic.wants_draft(greets_priya, "contact", alone) is True
+
+
+def test_names_them_matches_whole_name_parts_only() -> None:
+    assert ic.names_them("Olivia Owner", ("olivia",))
+    assert ic.names_them("Olivia Owner", ("Ms. Owner",))
+    # A colleague whose name starts with theirs is someone else.
+    assert ic.names_them("Alex Owner", ("Alexis",)) is False
+    assert ic.names_them("Alexis Owner", ("Alex",)) is False
+    # A nickname misses, which means no draft: the safe side.
+    assert ic.names_them("Robert Lane", ("Rob",)) is False
+    assert ic.names_them("Olivia Owner", ("Priya",)) is False
+    assert ic.names_them("", ("Olivia",)) is False
+
+
+def test_asked_names_are_read_defensively(monkeypatch: pytest.MonkeyPatch) -> None:
+    async def says(model: str, turn: str) -> dict[str, Any]:
+        return {
+            "needs_reply": True, "kind": "question", "asked_of_them": True, "confidence": 0.9,
+            "asked_names": ["Priya", 7, "  ", "x" * 200],
+        }
+
+    monkeypatch.setattr(ic, "_call_model", says)
+    verdict = asyncio.run(ic.classify(_msg("m1", "t1"), relation="team"))
+    assert verdict is not None and verdict.asked_names == ("Priya", "x" * 80)
+
+    async def malformed(model: str, turn: str) -> dict[str, Any]:
+        return {"needs_reply": True, "kind": "question", "confidence": 0.9, "asked_names": "Priya"}
+
+    monkeypatch.setattr(ic, "_call_model", malformed)
+    verdict = asyncio.run(ic.classify(_msg("m1", "t1"), relation="team"))
+    assert verdict is not None and verdict.asked_names == ()
+
+
 def test_mail_to_the_executive_that_copies_them_gets_no_draft(
     db: Path, owner: Any, models: dict[str, Any]
 ) -> None:
```

---

### Incident Patch 4: `4cd1136e` (2026-10-05)
**Commit Message**: fix(ui): keep the watch list page from scrolling the whole screen on phones (#363)

## Problem

On a phone, scrolling the watch list could slide the whole app up the
screen, header and bottom tab bar included, and leave a blank gap below.
Each watch card's hidden On/Off label (`sr-only`, so absolutely
positioned) had no positioned ancestor, so it was placed against the
page body below the screen and made the page taller than the viewport.

## Approach

Make the switch's wrapper `relative`, so the label stays inside its
card. At 390x844 with three watches, the page's scroll height goes from
1531px to 844px. The other main pages already measure 844px.

Arch-Docs: n/a - layout fix, no documented topic changes

## Checklist

- [x] Working implementation — no stubs or TODO placeholders
- [ ] Tests added/updated for new behavior (not added; one CSS class,
checked by measuring the page in a phone-sized browser)
- [ ] `ruff check` and `mypy` pass (not applicable, no Python)
- [x] UI builds if touched
- [ ] Eval scenarios added for a new agent or prompt change (not
applicable)
- [x] Architecture docs updated if a documented topic changed (waived
above)
- [x] No secrets, credentials, or pers

**File**: `packages/ui/src/app/watchlist/page.tsx` (modified, +1/-1)
```diff
@@ -207,7 +207,7 @@ function WatchCard({
           {isResearch && " · added by the Executive"}
         </div>
       </Link>
-      <div className="flex flex-shrink-0 items-center gap-1 pt-1">
+      <div className="relative flex flex-shrink-0 items-center gap-1 pt-1">
         <span className="sr-only">{item.enabled ? "On" : "Off"}</span>
         {/* The label pads the small switch out to a 40px tap target. */}
         <label className="inline-flex h-10 w-12 cursor-pointer items-center justify-center">
```

---

### Incident Patch 5: `f1988d65` (2026-10-05)
**Commit Message**: fix(ui): hide the Always asks first switches while Take the lead is off (#360)

<!-- ccr-projects-attribution: {"github_login":"johnrufusone"} -->
_Requested by **Rufus** · [project
thread](https://claude.ai/code/project/chan_01KdjdZHJtboAfcbRxDQxY2F?thread=cmsg_01KdjdZHJtboAfcbRxDQxY2FRQPW7XNfew1GNe95f43DZ1)_

## Problem

With Take the lead off, Settings → Your Executive still shows the
department note and all six Always asks first switches, turned on. They
look active, but they only gate the Executive's unattended actions while
Take the lead is on (`take_the_lead.check` runs only behind
`executive_on()`).

## Approach

Show the department note and the Always asks first list only while Take
the lead is on. Company rules stay visible either way, because they also
hold back everyone's Take the lead as you replies (`reply_hit`). Saved
switch values are untouched and reappear when it's turned back on.

## Checklist

- [x] Working implementation — no stubs or TODO placeholders
- [ ] Tests added/updated for new behavior (UI visibility only; no
component test harness)
- [x] `ruff check` and `mypy` pass (no Python changed)
- [x] UI builds if touched (`eslint` and `tsc --noEmit` clean)
- [

**File**: `packages/ui/src/components/settings/TakeTheLeadCard.tsx` (modified, +39/-33)
```diff
@@ -15,8 +15,10 @@ import {
 
 // Take the lead as the Executive (GET/PUT /take-the-lead), the owner's
 // alone: its unattended runs act on what they find, behind the gate. The six
-// "Always asks first" kinds each have a switch; the company's rules always
-// hold. Anyone else (the route answers 403) sees only who can turn it on.
+// "Always asks first" kinds each have a switch, shown only while it's on (they
+// gate nothing else). The company's rules always hold, for everyone's Take the
+// lead as you too, so they stay. Anyone else (the route answers 403) sees only
+// who can turn it on.
 export default function TakeTheLeadCard() {
   const [lead, setLead] = useState<TakeTheLead | null>(null);
   const [state, setState] = useState<"loading" | "hidden" | "ready" | "error">("loading");
@@ -88,37 +90,41 @@ export default function TakeTheLeadCard() {
       }
     >
       <div className="flex flex-col gap-5">
-        <p className="rounded-xl bg-surface-overlay/60 px-4 py-3 text-sm leading-relaxed text-fg-muted">
-          Department approval levels still apply. A department on Proposes still sends its meetings to its head for a
-          yes. Set a department to Acts on its own to let it book without asking.
-        </p>
-        <div>
-          <h3 className="text-[15px] font-semibold text-fg">Always asks first</h3>
-          <p className="mt-1 text-sm text-fg-muted">
-            These wait for you, or for whoever approves that area (like spending or hiring), with a card on Today.
-          </p>
-          <ul className="mt-3 flex flex-col divide-y divide-line rounded-xl border border-line">
-            {lead.ask_first.map((item) => {
-              const id = `ask-first-${item.kind}`;
-              return (
-                <li key={item.kind} className="flex min-h-touch items-center justify-between gap-3 px-4 py-2">
-                  <span className="min-w-0">
-                    <span id={id} className="block text-[15px]">
-                      {item.label}
-                    </span>
-                    <span className="mt-0.5 block text-[13px] leading-snug text-fg-muted">{item.hint}</span>
-                  </span>
-                  <Switch
-                    checked={item.on}
-                    onChange={() => void save({ ask_first: { [item.kind]: !item.on } })}
-                    disabled={busy}
-                    labelledBy={id}
-                  />
-                </li>
-              );
-            })}
-          </ul>
-        </div>
+        {lead.enabled && (
+          <>
+            <p className="rounded-xl bg-surface-overlay/60 px-4 py-3 text-sm leading-relaxed text-fg-muted">
+              Department approval levels still apply. A department on Proposes still sends its meetings to its head for
+              a yes. Set a department to Acts on its own to let it book without asking.
+            </p>
+            <div>
+              <h3 className="text-[15px] font-semibold text-fg">Always asks first</h3>
+              <p className="mt-1 text-sm text-fg-muted">
+                These wait for you, or for whoever approves that area (like spending or hiring), with a card on Today.
+              </p>
+              <ul className="mt-3 flex flex-col divide-y divide-line rounded-xl border border-line">
+                {lead.ask_first.map((item) => {
+                  const id = `ask-first-${item.kind}`;
+                  return (
+                    <li key={item.kind} className="flex min-h-touch items-center justify-between gap-3 px-4 py-2">
+                      <span className="min-w-0">
+                        <span id={id} className="block text-[15px]">
+                          {item.label}
+                        </span>
+                        <span className="mt-0.5 block text-[13px] leading-snug text-fg-muted">{item.hint}</span>
+                      </span>
+                      <Switch
+                        checked={item.on}
+                        onChange={() => void save({ ask_first: { [item.kind]: !item.on } })}
+                        disabled={busy}
+                        labelledBy={id}
+                      />
+                    </li>
+                  );
+                })}
+              </ul>
+            </div>
+          </>
+        )}
         <div>
           <h3 className="text-[15px] font-semibold text-fg">Company rules</h3>
           <p className="mt-1 mb-3 text-sm text-fg-muted">
```

---

### Incident Patch 6: `dad73842` (2026-10-05)
**Commit Message**: feat(ui): move your own memory card to Settings as About you (#359)

<!-- ccr-projects-attribution: {"github_login":"johnrufusone"} -->
_Requested by **Rufus** · [project
thread](https://claude.ai/code/project/chan_01KdjdZHJtboAfcbRxDQxY2F?thread=cmsg_01KdjdZHJtboAfcbRxDQxY2FSKjsv31S5bitwLK5oaz1Fv)_

## Problem

Each person now sees only their own peer-memory card, so the People tab
on Pulse → Memory always says "People 1" and sits among the company's
memory. The card also shows raw text: "ATTRIBUTE:" prefixes, a "peer 3"
tag, and notes that name you by number ("3 asked …").

## Approach

- The card moves to **Settings → About you** (`/settings/memory`),
titled "What the Executive knows about you": Your profile and notes
first, then the Keep track of what happens switch and How long notes
last, which already lived there. The tile and breadcrumb now say About
you, with a person icon.
- Profile lines drop the category tag, and `Label: value` lines show as
labelled rows. Notes use the person's first name instead of the peer id
and drop the leading "On YYYY-MM-DD,". This is display-only
(`lib/aboutYou.ts`), and the API is unchanged.
- Pulse drops the People tab and no longer counts pee

**File**: `packages/core/openexecutive/architecture/architecture-facts.yaml` (modified, +12/-10)
```diff
@@ -2924,8 +2924,8 @@ peer_memory:
       per probe).
     people_overview: |
       ``GET /memories/people?recent=N`` (``honcho_client.people_overview``)
-      — what peer memory knows about the caller, for the Pulse page's
-      People tab: only the caller's own entry, the principal included (a
+      — what peer memory knows about the caller, for the Your profile
+      card on Settings → About you (/settings/memory): only the caller's own entry, the principal included (a
       caller off the roster sees none; /conclusions 404s for anyone else). Read-only, no LLM call: one ``peers()`` listing
       (every page, under one 15 s clock — the SDK walk is otherwise bounded
       only per request), then per matched person (at most 8 in flight, each
@@ -2938,18 +2938,20 @@ peer_memory:
       get-or-create POST and a read must not mint peers for people who
       have never talked; the ``executive`` and ``department_*`` peers and
       archived people are skipped. Every line, timestamps included, passes
-      ``_block_safe_line``. The UI shares one in-flight request between the
-      header and the tab.
+      ``_block_safe_line``. Reads close together in the UI share one
+      in-flight request.
       Response ``{status: ok|disabled|error, people: [{person_id,
       full_name, is_principal, card, conclusion_count, last_observed_at,
       recent: [{content, created_at}], error}], conclusion_total}``; one
       person's failure or timeout sets that entry's ``error`` and leaves
       the rest intact. One ``peer_memory`` row per call, ``op=overview``,
-      ``person_id`` null, ``details.people / conclusions / errors``. The
-      Pulse header adds ``conclusion_total`` to its Memories tile (hint
-      names the peer-note share; fetched apart from the gating batch so
-      the strip never waits on Honcho); the UI hides the tab when
-      ``status`` is ``disabled``. Peers match only an id spelled exactly
+      ``person_id`` null, ``details.people / conclusions / errors``. Pulse
+      neither shows nor counts peer notes (each person sees only their
+      own, so it is a page about them, not a list of people); the UI hides
+      the card when ``status`` is ``disabled``. The card drops the
+      memory service's category tags (``ATTRIBUTE:`` …) from card lines and
+      shows the person's first name in place of their bare peer id in
+      notes, display-only (ui ``lib/aboutYou.ts``). Peers match only an id spelled exactly
       as OE writes it, once per person; within the newest page the
       conclusions are ordered by instant (never by the rendered string,
       which is not chronological across offsets); card elements and
@@ -2962,7 +2964,7 @@ peer_memory:
       ``GET /memories/people/{person_id}/conclusions?page=&size=``
       (``honcho_client.person_conclusions``) — every self-conclusion about
       one person, newest first, one page at a time (``size`` 1–100, default
-      50). The People tab renders each person as a card whose notes pane is
+      50). The About you card's notes pane is
       seeded from the overview's ``recent`` and, on "Show all", reads this
       page by page as the pane scrolls. The peer is found through the same
       ``peers()`` listing as the overview (shared ``_matched_peers``), never
```

**File**: `packages/core/openexecutive/architecture/prebuilt/memory.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "memory",
   "title": "Memory System",
-  "markdown": "The Executive's durable memory is an episodic SQLite store at `./episodic_memory.db`, managed by `openexecutive.memory.episodic`. It holds four tables:\n\n- `decisions` — choices made, with `domain`, `summary`, `rationale`, `outcome`, and `tags`. `outcome` is filled in when the principal says how a decision turned out — the `record_decision_outcome` chat tool (principal on a verified surface only) or the Memories page. The weekly review reads this table twice: the week's decisions (`decisions_since`) and up to three older than 30 days with no outcome yet (`decisions_awaiting_outcome`), which it asks about.\n- `initiatives` — tracked efforts with a `status` and `summary` (idempotent upserts).\n- `advice_given` — query/advice pairs per domain.\n- `scheduled_actions` — a dispatch queue, treated separately from recall memory. `cancel_scheduled_action` guards its UPDATE on `status = 'pending'`, so a cancel never overwrites a row the scheduler claimed a moment earlier.\n\n### What gets extracted, and when\n\n`episodic.extract_and_store` runs after a turn and asks a utility-fast model for decisions, initiatives and advice. Every candidate must carry a `user_commitment_quote` that appears verbatim in the principal's own message (`_is_valid_user_commitment`) — the turn's speaker text (`memory_text` when the entry point supplies one, else the prompt), so a quoted Executive email or a briefing card's body inside the prompt cannot satisfy it — the model has repeatedly tried to log the Executive's *recommendations* as the user's commitments, and that quote is the hard gate against it.\n\nA turn reaches the extractor if `should_extract(speaker_text, session=...)` is true, which means only that the principal said something on a surface that proved it was them — there is deliberately **no length floor**. There used to be one, on the combined user+assistant length, and on a live tenant it selected almost exactly the wrong turns: 9 of 16 exchanges were blocked, and the 9 held every instruction the principal gave, while the 7 admitted were long analytical exchanges with no commitment in them. The extractor ran 13 times and stored nothing.\n\nMoving that floor to the user's side would relocate the bug, not fix it. The canonical executive decision is a long analysis answered with \"Approve option B.\" (17 chars) or \"Do B.\" (5), and any floor high enough to skip \"Done\" (4) also skips those — \"Do B.\" and \"Done\" differ by one character and mean opposite things. Length cannot separate a decision from an acknowledgement; the verbatim-quote check can, so `_is_valid_user_commitment` is the gate that decides. The price is one utility-fast call on turns that propose nothing.\n\nThat quote check is only meaningful when `user_message` holds the **principal's** words, and on a chat channel it does not — `Executive.chat()` is reached from Slack, Discord, Telegram, Google Chat and the email poller. A teammate's line would be written to `decisions` with no speaker attached, indistinguishable from the principal's own; an inbound email body is text the sender chose, so a self-quote is free. Removing the length floor is what makes this bite — short channel traffic used to fall under it incidentally — so `should_extract` asks the untrusted-content policy (`orchestrator.content_trust.principal_speaking`) whether the principal is speaking. It names the principal's surfaces rather than inferring them: the web chat (signed in as the principal — or, on an install with no principal on the People page yet, a request that carried no sign-in; a signed-in email on nobody's entry, such as an archived teammate still allowed to sign in, is not the principal), the CLI (`Session.from_cli`), the principal's own Slack or Discord or a private Telegram chat with a valid webhook secret (`people_tools.is_principal_on_verified_surface`), and email from the principal's primary address that Gmail's own `Authentication-Results` marks `dmarc=pass` (`Session.email_authenticated`). Everything else fails closed: a teammate (on the web too), an unrostered sender, the principal's address on mail Gmail did not authenticate, Google Chat, the MCP server (its caller names themselves), unattended runs, and an unreadable roster. The rule used to be \"no `origin_channel` means the principal's own surface\", and the email poller left `origin_channel` empty, so every stranger's email ran through the extractor with its body — headers, quoted chain and all — as the principal's words, and whatever it stored rendered on every later turn. The poller now tags its sessions `origin_channel=\"email\"`, and the gate no longer reads an empty channel as trust.\n\nThe extractor also reads only the words **outside** every `<untrusted_content>` block (`schedule_extraction` runs `content_trust.strip_untrusted` first): an attached document's text is inlined in that block, so a sentence the principal did n
```

**File**: `packages/core/openexecutive/architecture/prebuilt/peer_memory.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "peer_memory",
   "title": "Peer Memory (Person + Department)",
-  "markdown": "An external, peer-keyed memory layer gives the Executive durable cross-channel recall, sitting on top of Honcho via `openexecutive.memory.honcho_client`. The `HONCHO_ENABLED` env var gates it; when false every entry point short-circuits with `outcome=disabled` and behavior matches the pre-Honcho posture.\n\n### Two scopes\n\n- **Per-person**, keyed by `Person.id` — a user chatting from Discord, Telegram, email, or web is one peer card, so facts shared in any channel surface in the others. Each entry point resolves the caller to a `Person.id` (channel-ID lookups for adapters; `x-caller-email` for web).\n- **Per-department**, keyed by `department_<slug>` — each department accumulates an institutional voice from dept-scoped decisions, advice, committee outcomes, and dept-bound specialist turns.\n\n### Private to the principal\n\nThe principal's contacts are private to them (see Org), and two rules keep them out of shared memory. A turn about the principal's private mail (`Session.private_to_principal`: mail from a contact, or mail the principal forwarded) writes nothing to peer or department memory — its reply summarises that mail. And the principal's own peer memory, drawn from all their conversations, answers only the principal: `ask_about_person` with `person_id` = the principal returns the empty \"no data\" answer on any turn but the principal's own verified one (a teammate's own view of the principal, `target_person_id` = the principal, is the teammate's memory and still answers), and `GET /memories/people` / `/conclusions` show each caller only their own entry (see below).\n\n### Flow\n\n`prefetch` runs once per turn and injects a `<peer_memory>` block into the user turn (empty on timeout or error). `HONCHO_PREFETCH_MODE` picks how the block is produced. `representation` (the default) reads the person's peer card and the derived conclusions most relevant to the inbound message straight from Honcho (`peer.context(search_query=…)`, `HONCHO_PREFETCH_MAX_CONCLUSIONS` of them, default 20): a GET with no LLM behind it, about 100 ms self-hosted. The block keeps whole lines only, up to a size cap (a line that does not fit is dropped, never cut), strips control characters and defangs a literal closing tag, since conclusions derive from text anyone who can email the Executive wrote. A person Honcho knows nothing about yet yields no block and an `empty` audit outcome. `dialectic` asks Honcho's chat endpoint with the message as the question and injects the synthesized prose (an LLM call, seconds), where `reasoning_level` trades latency for depth. The mode applies to every per-person prefetch, committee turns included. Only `prefetch_department` (one dialectic question per consulted specialist that maps to a department, yielding `<department_memory>`) and the `ask_about_person` tool always use the chat endpoint: they are deliberate questions off the inline path, the split Honcho's own guidance draws between `context()` for per-turn grounding and `chat()` for reasoned answers. After the response, `sync_turn` and `sync_department_turn` persist the exchange as fire-and-forget background tasks that never block the user. The Executive's reply is written under an `executive` peer resolved with `observe_me=false`: the person's representation sees both sides of the exchange, but Honcho no longer derives a representation of the Executive itself, which nothing read and which is where a person's words were occasionally misattributed to the Executive. Both record the person's words only. Honcho derives facts about a person from everything posted under their peer, so a turn whose prompt carries text the person did not write passes `memory_text` to `Executive.chat` / `stream_chat` / `stream_chat_with_committee`, and that — not the prompt — is what both syncs post: an inbound email records the sender's new text, the attachment filenames and its subject unless that is a reply's or forward's (`Re:`, `Fwd:`, `AW:`, `SV:`, `Re[2]:`, `[EXT] Re:` … — the earlier message's subject, often the Executive's own) (never the \"You have an inbound email\" framing, the headers with the Executive's own address in `To:`, the `[POLICY]` notice or the quoted chain, which held the Executive's own earlier email and taught Honcho that the sender *was* the Executive); a web upload records the typed text and filenames, not the extracted document text; a briefing handoff records a short line of what the user asked, phrased as the user speaking and ended before the headline, which follows on its own line (\"Let's discuss this flagged artifact.\" / \"I approve this proposal.\" — an \"Asked to …\" line came back as \"<user> was asked to …\", and a \"?\" in a headline inside the sentence voided the extraction quote); approve-with-edits records the same short line without the edited text, which starts as the Executive's card body and is often sent
```

**File**: `packages/core/openexecutive/memory/honcho_client.py` (modified, +1/-1)
```diff
@@ -2461,7 +2461,7 @@ class PersonConclusionsPage(BaseModel):
 
 async def person_conclusions(person_id: int, *, page: int, size: int) -> PersonConclusionsPage | None:
     """One page of everything peer memory has concluded about one person,
-    newest first — the People tab's "show all" reads it page by page.
+    newest first — the About you card's "show all" reads it page by page.
 
     ``None`` when the person is not an active rostered person or has no peer
     yet (the route answers 404). The peer is found through the workspace
```

**File**: `packages/core/tests/unit/test_memories_people_route.py` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 """GET /memories/people — what peer memory knows about each rostered person.
 
-The Pulse page's People tab reads this. It must never create peers (a
+Settings → About you reads this. It must never create peers (a
 read-only page minting Honcho peers for people who have never talked would be
 a side effect nobody asked for), must skip the non-person peers that share
 the workspace, and must keep one person's failure from hiding the others.
```

**File**: `packages/ui/scripts/aboutYou.test.mjs` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { cardEntry, noteAboutYou } from "../src/lib/aboutYou.ts";
+
+test("a tagged pair becomes a labelled row", () => {
+  assert.deepEqual(cardEntry("ATTRIBUTE: Email: ada@example.com"), {
+    label: "Email",
+    value: "ada@example.com",
+  });
+  assert.deepEqual(cardEntry("ATTRIBUTE: Phone: 555-0100"), { label: "Phone", value: "555-0100" });
+});
+
+test("a tagged sentence loses only its tag", () => {
+  assert.deepEqual(cardEntry("ATTRIBUTE: Works in Operations at Northwind Supply"), {
+    label: null,
+    value: "Works in Operations at Northwind Supply",
+  });
+  assert.deepEqual(cardEntry("RELATIONSHIP: Reports to the CFO"), { label: null, value: "Reports to the CFO" });
+});
+
+test("untagged lines and links stay as written", () => {
+  assert.deepEqual(cardEntry("Prefers short answers"), { label: null, value: "Prefers short answers" });
+  assert.deepEqual(cardEntry("https://example.com/a"), { label: null, value: "https://example.com/a" });
+  // A long lead-in before a colon is a sentence, not a label.
+  const long = "Said in the Monday meeting that the plan was: ship it";
+  assert.deepEqual(cardEntry(long), { label: null, value: long });
+});
+
+test("notes name the person instead of their peer id", () => {
+  assert.equal(
+    noteAboutYou("On 2026-10-01, peer 3 referenced a 'Harbor Point' document", 3, "Ada Lovelace"),
+    "Ada referenced a 'Harbor Point' document",
+  );
+  assert.equal(noteAboutYou("3 asked what the discussion is about", 3, "Ada Lovelace"), "Ada asked what the discussion is about");
+  assert.equal(noteAboutYou("3's team owns the budget", 3, "Ada Lovelace"), "Ada's team owns the budget");
+  assert.equal(noteAboutYou("Prefers that peer_3 sees numbers first", 3, "Ada"), "Prefers that Ada sees numbers first");
+});
+
+test("other numbers and other people are left alone", () => {
+  assert.equal(noteAboutYou("30 brokers were asked about tiers", 3, "Ada"), "30 brokers were asked about tiers");
+  assert.equal(noteAboutYou("peer 31 asked about a proposal", 3, "Ada"), "Peer 31 asked about a proposal");
+  assert.equal(noteAboutYou("Asked for 3 quotes", 3, "Ada"), "Asked for 3 quotes");
+});
```

**File**: `packages/ui/scripts/navConfig.test.mjs` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@ test("the Settings hub: one tile per page, each with its own route", () => {
     [
       "Your Executive → /settings/executive",
       "Act as me → /settings/act-as-me",
-      "Memory → /settings/memory",
+      "About you → /settings/memory",
       "Workspace → /settings/workspace",
       "Advanced → /settings/advanced",
       "About → /settings/about",
```

**File**: `packages/ui/src/app/settings/memory/page.tsx` (modified, +8/-4)
```diff
@@ -1,17 +1,21 @@
 "use client";
 
+import AboutYouCard from "@/components/settings/AboutYouCard";
 import { CompanyRetentionCard, KeepTrackCard } from "@/components/settings/HistorySettings";
 import SettingsSubpage from "@/components/settings/SettingsSubpage";
 
-// Settings → Memory: Always in the loop. Each person's own "Keep track of what
-// happens" switch, and how long notes last for everyone.
+// Settings → About you: everything the Executive keeps about the signed-in
+// person, which only they see. What peer memory has learned about them
+// (their profile and notes), then Always in the loop: their own "Keep track
+// of what happens" switch, and how long notes last for everyone.
 export default function MemorySettingsPage() {
   return (
     <SettingsSubpage
-      title="Memory"
-      description="The Executive can keep private notes of what you tell it in chat and in replies you send, so it can remind you later. Each person sees only their own."
+      title="What the Executive knows about you"
+      description="What it has learned from talking with you, and the private notes it keeps of what you tell it. Each person sees only their own."
     >
       <div className="space-y-4">
+        <AboutYouCard />
         <KeepTrackCard />
         <CompanyRetentionCard />
       </div>
```

---

### Incident Patch 7: `7a278fae` (2026-10-05)
**Commit Message**: fix(ui): put Dismiss and Edit in Gmail beside Send on reply cards (#358)

## Problem

On a reply card, Dismiss and Edit in Gmail were hidden in a ⋯ menu right
next to Send. To dismiss a draft you aimed next to Send, which made Send
easy to hit by mistake. On a phone the menu could also open off the left
edge of the screen.

## Approach

Both actions are now buttons in the row: Send, Edit in Gmail (or
Outlook), and Dismiss set apart on the right. Send still asks who the
draft goes to before anything goes out.

## Checklist

- [x] tsc, eslint (0 errors), `npm test` (291 passed)
- [x] Checked on a phone screenshot in light and dark
- [x] Arch-Docs: n/a - button layout only

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/ui/src/components/RepliesWaiting.tsx` (modified, +17/-12)
```diff
@@ -2,8 +2,7 @@
 
 import { useCallback, useEffect, useState } from "react";
 
-import Button from "@/components/ui/Button";
-import OverflowMenu from "@/components/ui/OverflowMenu";
+import Button, { buttonClass } from "@/components/ui/Button";
 import {
   dismissReplyCard,
   getReplyCards,
@@ -31,7 +30,7 @@ import FeatureName from "@/components/FeatureName";
 // draft, what it leaves you to decide and anything to check. Send (the
 // card's primary) sends that draft from your Gmail exactly as it is there,
 // after you confirm who it goes to; Edit in Gmail and Dismiss (deletes it
-// unless you edited it) are in its ⋯ menu. GET /delegation/replies answers
+// unless you edited it) are their own buttons beside it. GET /delegation/replies answers
 // only the owner, so nothing shows for everyone else, on a backend without
 // it, and when nothing is waiting.
 
@@ -289,15 +288,21 @@ export function ReplyCardItem({
           >
             {busy ? step.label : "Send"}
           </Button>
-          <OverflowMenu
-            label="More actions for this reply"
-            items={[
-              ...(gmailLink
-                ? [{ label: `Edit in ${mailbox}`, href: gmailLink, external: true }]
-                : []),
-              { label: "Dismiss", onSelect: () => void dismiss(), disabled: busy },
-            ]}
-          />
+          {gmailLink && (
+            <a
+              href={gmailLink}
+              target="_blank"
+              rel="noopener noreferrer"
+              className={buttonClass("secondary")}
+            >
+              Edit in {mailbox}
+            </a>
+          )}
+          {/* Dismiss is its own button, set apart on the right, so it's never
+              hunted for in a menu next to Send. */}
+          <Button variant="ghost" className="ml-auto" onClick={() => void dismiss()} disabled={busy}>
+            Dismiss
+          </Button>
         </div>
       )}
       {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
```

---

### Incident Patch 8: `d46eee56` (2026-10-04)
**Commit Message**: fix(ui): harden the UI for phones, readability and plain wording (#357)

## Problem

A screen-by-screen review of the app on phone and desktop, day and
night, turned up a set of rough edges:
- Settings tile text ran past its card on desktop, and on phones the
status was cut off.
- Switches were 36×20 px with a nearly invisible Off state.
- The Ask OE button was low-contrast in day mode, and its lightning icon
also stood for Pulse and Token usage.
- Home reply cards buried Send under the full sender address and the
whole draft.
- The avatar showed "JO" for Jordan Avery.
- Agent Council had no way back to Settings.
- Customized agents wore a warning-orange dot.
- Model IDs and terms like "specialist consult", "fixtures" and "in
flight" appeared on owner-facing screens.
- Sign-in showed an active Google button when Google sign-in wasn't set
up.
- The Handle it for me steps reused "Take the lead" and "Balanced",
which already name other things.

## Approach

UI only. No API, schema or stored-value change.
- **Type and identity:**
- Headings in a display face (Bricolage Grotesque) for the product name,
page titles and section headings. Small card titles keep the body face.
  - A Council

**File**: `packages/core/openexecutive/architecture/prebuilt/delegation.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "delegation",
   "title": "Act as Me (Delegation)",
-  "markdown": "The **delegation** module (`openexecutive.delegation`) is **Act as me**: the one place the Executive writes *as* a person instead of as itself. Everywhere else it has its own Google account and bots and signs as itself. Here — when the person asks, or, with a second switch, for mail in their inbox that needs them — it writes an email in their voice and saves it as a **draft in their own mailbox** — Gmail or Outlook — for them to review and send. The one thing it ever sends is one of those inbox drafts, exactly as it is in their mailbox: when the person taps **Send** on its card, or, with a third switch, **Handle it for me**, on its own when plain-code rules allow it (below); chat never sends. The principal can turn it on for themselves, and so can each team member once the owner lets them. It is off by default, and off changes nothing: the prompts, tool lists and prompt caches are byte-identical to an install without it.\n\n## Who can have it, and when it is offered\n\n`delegation.settings.can_delegate(person)` is the single rule for who may turn it on: the principal (a non-archived team member flagged `is_principal`), and any other non-archived team member — never a contact — once team members may have it (`team_members_enabled`). That takes two things: the install allows it (`DELEGATION_TEAM_MEMBERS`, default off, which offers the owner the switch) and the owner turned on **Let team members use it** (`PUT /delegation/team`, principal only, one row in `delegation_team`). Turning the owner's switch off takes it away from every team member from their next message, and their inbox watchers stop at their next check; their own switches, drafts and cards are kept. Everything is keyed by `person_id`. A person turns it on for themselves (`PUT /delegation`); nobody turns it on for anyone else. The setting is one row per person in `delegation_settings`, and a missing, unreadable or zero row all mean off.\n\nAt the start of every chat turn (`Executive.stream_chat` and the committee path) `pin_turn_delegation(session, speaker_text)` runs next to the workspace-mode pin and records a `TurnDelegation` on the session. `ghostwrite_email` is **offered** only when all of these hold:\n\n- the speaker may have it and turned it on — read fresh every turn, so turning it off applies from the next message;\n- the speaker is on a surface that verified it is them — the principal through `people_tools.is_principal_on_verified_surface`, a team member through `teammate_on_verified_surface` (the web app signed in, their own Slack or Discord, never an email turn) — and a web turn also carried a signed-in caller (`Session.web_caller_signed_in`, set from `x-caller-email`) or runs under local login — a request with no caller header is not a sign-in and never gets it (whoever holds the shared secret is trusted as the UI proxy that stamps that header, as on every principal-only route);\n- the conversation is private to the speaker: the web chat, a Slack or Discord DM, or a verified private Telegram chat — never a shared channel or thread, where the draft's preview or the matching threads would be posted for everyone and other people's messages sit in the model's context;\n- the turn is neither unattended (the scheduler's proactive run) nor private to the principal (the email poller's turns), so inbound text can never reach it. The MCP server, workflows, reflection and research never carry it at all.\n\nThe mailbox connection is deliberately **not** part of the offer: the handler checks it on every call and says how to fix it, so the cached tool prefix never flips when a token lapses. The pin lives in a context variable for the turn's task as well as on the session, so two turns running at once on one session (a second browser tab) each read their own. It also carries the speaker's own words for the turn (a new email may go to an address they just typed — the turn's message joins the history only once the turn ends), a per-turn draft count, and `touched_mail` (see Privacy). `own_words` reads those words back for every own-words check (addresses here, facts and task assignments elsewhere): it first removes the hydrated `<outbound_reply_context>` backstory by its exact, anchored shape, so a look-alike closing tag quoted inside it cannot pass the rest off as the speaker's, then drops other adapter tag blocks, and returns nothing for a message carrying an attachment.\n\n## The tool: `ghostwrite_email`\n\nIt lives in its own registry (`orchestrator.delegation_tools.DELEGATION_TOOLS` / `DELEGATION_TOOL_HANDLERS`), **never** `_ALL_SKILL_TOOLS`, so no other toolkit can carry it. On a turn it is offered to, the agent loop adds it to the pool *before* the sort and builds that turn's handler map from both registries; on any other turn a call to it is an unknown tool. The handler re-checks the pin and the surface anyway, then:\n\n1. **Caps** — at most 5
```

**File**: `packages/core/openexecutive/delegation/handle_it.py` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ class Rules:
 
 # What each refusal tells the person on the card.
 REASONS: dict[str, str] = {
-    "level": "Handle it for me asks you about email from people you don't know yet (Bold sends those).",
+    "level": "Handle it for me asks you about email from people you don't know yet (Most mail sends those).",
     "signing_off": "Sending on its own needs signed sign-ins on this server.",
     "sender_unverified": "Your mail service couldn't confirm who sent it.",
     "unsure": "It wasn't sure enough this needs only a simple reply.",
```

**File**: `packages/ui/scripts/briefingSummary.test.mjs` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ test("the summary leads with what needs you, then what was handled", () => {
   const parts = briefingSummary({ ...zero, needsYou: 3, handledOvernight: 12, inFlight: 7, deptAtRisk: 1 });
   assert.deepEqual(
     parts.map((p) => p.text),
-    ["3 things need you", "The Executive handled 12 overnight", "1 department at risk", "7 in flight"],
+    ["3 things need you", "The Executive handled 12 overnight", "1 department at risk", "7 under way"],
   );
   assert.deepEqual(parts[0].target, { kind: "needsYou" });
   assert.deepEqual(parts[1].target, { kind: "panel", panel: "handled" });
```

**File**: `packages/ui/scripts/initials.test.mjs` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import { initials } from "../src/lib/initials.ts";
+
+test("initials take the first and last name's first letters", () => {
+  assert.equal(initials("Jordan Avery"), "JA");
+  assert.equal(initials("Mary Ann van der Berg"), "MB");
+  assert.equal(initials("  dana  park "), "DP");
+});
+
+test("a single name gives its first two letters", () => {
+  assert.equal(initials("Jordan"), "JO");
+  assert.equal(initials("Ö"), "Ö");
+});
+
+test("an email uses its local part, split on dots, dashes and underscores", () => {
+  assert.equal(initials("jordan.avery@example.com"), "JA");
+  assert.equal(initials("jordan@example.com"), "JO");
+  assert.equal(initials("j_avery@example.com"), "JA");
+});
+
+test("nothing usable gives a question mark", () => {
+  assert.equal(initials(""), "?");
+  assert.equal(initials("  "), "?");
+});
```

**File**: `packages/ui/scripts/replyCards.test.mjs` (modified, +16/-0)
```diff
@@ -9,6 +9,8 @@ import {
   sendLeftNothing,
   sendQuestion,
   senderLine,
+  senderShort,
+  draftIsLong,
 } from "../src/lib/replyCards.ts";
 
 test("relationLabel names who the sender is, and nothing for an unknown relation", () => {
@@ -33,6 +35,20 @@ test("senderLine shows the name and address, or the address alone", () => {
   assert.equal(senderLine({ from_name: "  ", from_email: "dana@x.example" }), "dana@x.example");
 });
 
+test("senderShort keeps the domain beside the name, and the full address unless confirmed", () => {
+  const card = { from_name: "Dana Park", from_email: "dana@d4na-park.example" };
+  assert.equal(senderShort({ ...card, sender_verified: true }), "Dana Park · @d4na-park.example");
+  assert.equal(senderShort({ ...card, sender_verified: false }), "Dana Park <dana@d4na-park.example>");
+  assert.equal(senderShort(card), "Dana Park <dana@d4na-park.example>");
+  assert.equal(senderShort({ from_name: " ", from_email: "dana@x.example", sender_verified: true }), "dana@x.example");
+});
+
+test("draftIsLong clamps drafts past 280 characters or 5 lines", () => {
+  assert.equal(draftIsLong("Thanks, Thursday works."), false);
+  assert.equal(draftIsLong("x".repeat(281)), true);
+  assert.equal(draftIsLong("a\nb\nc\nd\ne\nf"), true);
+});
+
 test("safeGmailLink keeps only a link into Gmail", () => {
   const link = "https://mail.google.com/mail/u/?authuser=o%40x.example#all/18c2";
   assert.equal(safeGmailLink(link), link);
```

**File**: `packages/ui/src/app/audit/page.tsx` (modified, +1/-1)
```diff
@@ -459,7 +459,7 @@ function AuditPageInner() {
             <div className="min-w-0">
               <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">Audit log</h1>
               <p className="mt-1 text-[15px] text-fg-muted">
-                Every chat turn, specialist consult, tool call and scheduled action, newest first.
+                Each chat, each question passed to an expert, each tool used and each scheduled job, newest first.
               </p>
             </div>
             <Link href="/audit/usage" className={buttonClass("secondary", "sm")}>
```

**File**: `packages/ui/src/app/audit/usage/page.tsx` (modified, +1/-1)
```diff
@@ -129,7 +129,7 @@ export default function TokenUsagePage() {
             </Link>
           </div>
           <p className="mt-1 text-sm text-fg-muted">
-            Aggregate token usage and cost across all sessions, summed from the
+            What the AI has cost across every conversation, added up from the
             audit log. Days are UTC. Cost is the actual OpenRouter charge captured
             per call — it accrues from when cost tracking went live, so calls
             logged before then count tokens but $0.
```

**File**: `packages/ui/src/app/council/page.tsx` (modified, +12/-4)
```diff
@@ -1,6 +1,7 @@
 "use client";
 
 import Link from "next/link";
+import Icon from "@/components/Icon";
 import { useCallback, useEffect, useId, useMemo, useState } from "react";
 
 import {
@@ -565,6 +566,13 @@ export default function CouncilPage() {
     <div className="flex-1 min-h-0 min-w-0 overflow-y-auto bg-surface text-fg">
       <div className="max-w-5xl mx-auto px-4 py-6 sm:px-8 sm:py-10 space-y-6">
         <div>
+          <Link
+            href="/settings/advanced"
+            className="-ml-2 mb-2 inline-flex min-h-touch items-center gap-1.5 rounded-lg px-2 text-[15px] text-fg-muted hover:text-fg hover:bg-surface-overlay transition-colors"
+          >
+            <Icon name="arrow-left" size="w-4 h-4" />
+            Advanced
+          </Link>
           <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">Agent Council</h1>
           <p className="mt-2 text-[15px] text-fg-muted">
             Pick how thorough answers should be and add instructions for any agent. Open an
@@ -585,7 +593,7 @@ export default function CouncilPage() {
               <h2 className="text-lg font-semibold text-fg">Quality</h2>
               {presets.active === null && (
                 <span
-                  className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20"
+                  className="text-[10px] uppercase tracking-widest px-2 py-1 rounded bg-accent/10 text-accent border border-accent/20"
                   title={`${presets.custom_agents.length} agent(s) differ from ${basePresetLabel ?? "the preset"}`}
                 >
                   Custom
@@ -616,7 +624,7 @@ export default function CouncilPage() {
                     </span>
                     <span className="block text-sm text-fg-muted mt-1 leading-relaxed">{p.description}</span>
                     {p.model && (
-                      <span className="block text-[11px] text-fg-subtle mt-2 font-mono">{p.model}</span>
+                      <span className="block text-[13px] text-fg-subtle mt-2">Uses {shortModelName(p.model)}</span>
                     )}
                   </button>
                 );
@@ -676,7 +684,7 @@ export default function CouncilPage() {
                         <span
                           aria-hidden="true"
                           className={`inline-block h-2 w-2 flex-shrink-0 rounded-full ${
-                            status === "default" ? "bg-emerald-500" : "bg-amber-500"
+                            status === "default" ? "bg-emerald-500" : "bg-accent"
                           }`}
                         />
                         {status === "instructions" ? (
@@ -768,7 +776,7 @@ export default function CouncilPage() {
                     : ` · domains: ${detail.domains.join(", ") || "—"}`}
                 </p>
                 {detail.has_override && (
-                  <span className="text-[11px] uppercase tracking-widest px-2 py-1 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
+                  <span className="text-[11px] uppercase tracking-widest px-2 py-1 rounded-md bg-accent/10 text-accent border border-accent/20">
                     Customized
                   </span>
                 )}
```

---

### Incident Patch 9: `cbaad6fc` (2026-10-03)
**Commit Message**: fix(artifacts): keep each document private to the person who made it (#351)

<!-- ccr-projects-attribution: {"github_login":"johnrufusone"} -->
_Requested by **Rufus** · [project
thread](https://claude.ai/code/project/chan_01KdjdZHJtboAfcbRxDQxY2F?thread=cmsg_01KdjdZHJtboAfcbRxDQxY2FE5QCp6s1pH8x11NjZcwMLW)_

## Problem

Drafted documents and workflow outputs are kept per workspace. Anyone
signed in can see a document someone else's chat produced, and so can
the Executive in their chats. That includes the Artifacts page,
`list_artifacts` / `get_artifact`, links, recall, Today and the audit
log. Private information can leak this way.

## Approach

- **Drafts:** a drafted document (`alerts.owner_person_id`) belongs to
the person whose conversation made it, and only they see it. That
includes the principal, who does not see a teammate's drafts. Existing
drafts go to the person they were routed to.
- **Runs:** a run started by hand (from the Jobs page, `run_workflow` or
research) belongs to its starter (`workflow_runs.owner_person_id`).
Scheduled and system runs stay shared with the team.
- **One rule everywhere:** every read goes through a single `Viewer`.
That covers the API routes, c

**File**: `packages/core/openexecutive/alerts/lifecycle.py` (modified, +7/-1)
```diff
@@ -29,7 +29,7 @@
 from datetime import UTC, datetime, timedelta
 from pathlib import Path
 
-from openexecutive.alerts.models import Alert
+from openexecutive.alerts.models import Alert, visible_alert
 
 logger = logging.getLogger(__name__)
 
@@ -155,9 +155,14 @@ def list_live_alerts(
     db_path: Path | None = None,
     *,
     now: datetime | None = None,
+    viewer: object | None = None,
 ) -> list[Alert]:
     """``unread`` alerts that are still live: not past TTL, not snoozed.
 
+    A drafted artifact is its owner's alone (``models.visible_alert``): it is
+    kept only for the ``viewer`` it belongs to, and left out with no viewer —
+    the board the review, the reflection and the shared digests read.
+
     Newest first, like ``store.list_alerts``. This is the read every
     user-facing surface shares; the sweep merely persists what this view
     already hides, so the two can never disagree.
@@ -174,6 +179,7 @@ def list_live_alerts(
         a for a in rows
         if not is_expired(a, now, monitoring_days=monitoring_days, action_days=action_days)
         and not _is_snoozed(a, now)
+        and visible_alert(a, viewer)
     ]
     return live[:limit]
 
```

**File**: `packages/core/openexecutive/alerts/models.py` (modified, +36/-0)
```diff
@@ -20,6 +20,39 @@ def is_private_alert(alert: object) -> bool:
     return any(str(t).lower() == PRIVATE_ALERT_TAG for t in tags)
 
 
+# Source of a document the Executive published (`draft_artifact`). Each one
+# is its owner's alone (``owner_person_id``; none = the principal's): it never
+# reaches a surface that serves anyone else (see ``artifact_visible_to``).
+ARTIFACT_SOURCE = "artifact"
+
+
+def artifact_visible_to(
+    owner_person_id: int | None, person_id: int | None, *, is_principal: bool
+) -> bool:
+    """Whether the person ``person_id`` (``is_principal`` when they are the
+    principal) may see a drafted artifact owned by ``owner_person_id``. Not
+    even the principal sees a teammate's."""
+    if owner_person_id is None:
+        return is_principal
+    return person_id is not None and person_id == owner_person_id
+
+
+def visible_alert(alert: object, viewer: object | None) -> bool:
+    """Whether ``alert`` may be shown to ``viewer`` (anything with
+    ``person_id`` and ``is_principal``, e.g. ``artifact_records.Viewer``).
+    Every alert but a drafted artifact may; an artifact only to its owner,
+    and to no one when there is no viewer (a surface shared by everyone)."""
+    if getattr(alert, "source", None) != ARTIFACT_SOURCE:
+        return True
+    if viewer is None:
+        return False
+    return artifact_visible_to(
+        getattr(alert, "owner_person_id", None),
+        getattr(viewer, "person_id", None),
+        is_principal=bool(getattr(viewer, "is_principal", False)),
+    )
+
+
 class AlertSeverity(StrEnum):
     LOW = "low"
     MEDIUM = "medium"
@@ -159,6 +192,9 @@ class Alert(BaseModel):
     artifact_link_label: str | None = None
     # Composite id ('alert:<n>' / 'run:<hex>') of the version this revised.
     supersedes_id: str | None = None
+    # Whose document a drafted artifact is (orchestrator/artifact_records.py);
+    # NULL on a draft = the principal's. Unused on every other source.
+    owner_person_id: int | None = None
 
 
 class UserPreferences(BaseModel):
```

**File**: `packages/core/openexecutive/alerts/pipeline.py` (modified, +2/-1)
```diff
@@ -172,7 +172,8 @@ async def evaluate_and_dispatch(
             "dedup_key": a.dedup_key,
             "topic_tags": a.topic_tags,
         }
-        for a in store.recent_alerts(limit=20, db_path=path)
+        # Never anyone's drafted documents: they are their owners' alone.
+        for a in store.recent_alerts(limit=20, db_path=path, exclude_source="artifact")
     ]
     try:
         initiatives = get_active_initiatives()
```

**File**: `packages/core/openexecutive/alerts/review.py` (modified, +12/-6)
```diff
@@ -901,14 +901,20 @@ async def _apply_draft(ctx: _MoveContext) -> None:
         ctx.label = "drafted"
         return  # the artifact already sits in the queue — never draft it twice
     try:
+        from openexecutive.orchestrator.artifact_records import (
+            pinned_viewer,
+            principal_viewer,
+        )
         from openexecutive.orchestrator.artifact_tools import handle_draft_artifact
 
-        result = json.loads(await handle_draft_artifact({
-            "title": v.draft_title,
-            "document": v.draft_document,
-            "why_interesting": (ctx.note or f"Drafted from alert: {alert.headline[:100]}")[:300],
-            "severity": alert.severity,
-        }))
+        # The review drafts for the principal: the document is theirs.
+        with pinned_viewer(principal_viewer()):
+            result = json.loads(await handle_draft_artifact({
+                "title": v.draft_title,
+                "document": v.draft_document,
+                "why_interesting": (ctx.note or f"Drafted from alert: {alert.headline[:100]}")[:300],
+                "severity": alert.severity,
+            }))
     except Exception:
         logger.exception("alert_review: draft failed for alert %d", ctx.alert_id)
         return
```

**File**: `packages/core/openexecutive/alerts/store.py` (modified, +39/-4)
```diff
@@ -8,6 +8,7 @@
 from contextlib import contextmanager
 from datetime import UTC, datetime
 from pathlib import Path
+from typing import Any
 
 from openexecutive.alerts.models import (
     Alert,
@@ -93,13 +94,24 @@ def initialize_db(db_path: Path | None = None) -> None:
             ("artifact_url", "TEXT"),
             ("artifact_link_label", "TEXT"),
             ("supersedes_id", "TEXT"),
+            # Whose document a drafted artifact is: the person whose
+            # conversation published it (orchestrator/artifact_records.py).
+            # NULL on a draft = the principal's.
+            ("owner_person_id", "INTEGER"),
         ):
             if col not in existing:
                 try:
                     conn.execute(f"ALTER TABLE alerts ADD COLUMN {col} {ddl}")
                 except sqlite3.OperationalError as exc:
                     if "duplicate column" not in str(exc).lower():
                         raise
+        if "owner_person_id" not in existing:
+            # Drafts written before ownership went to the principal's queue:
+            # whoever they were routed to keeps them.
+            conn.execute(
+                "UPDATE alerts SET owner_person_id = routed_to_person_id "
+                "WHERE source = 'artifact' AND owner_person_id IS NULL"
+            )
         conn.executescript("""
 
             CREATE TABLE IF NOT EXISTS mute_topics (
@@ -148,6 +160,7 @@ def insert_alert(
     artifact_url: str | None = None,
     artifact_link_label: str | None = None,
     supersedes_id: str | None = None,
+    owner_person_id: int | None = None,
     db_path: Path | None = None,
 ) -> int | None:
     """Insert a new alert. Returns alert id, or None if a duplicate was skipped."""
@@ -158,8 +171,9 @@ def insert_alert(
             INSERT OR IGNORE INTO alerts
                 (external_id, source, severity, headline, body, suggested_action,
                  topic_tags, dedup_key, status, created_at, routed_to_person_id,
-                 artifact_format, artifact_url, artifact_link_label, supersedes_id)
-            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unread', ?, ?, ?, ?, ?, ?)
+                 artifact_format, artifact_url, artifact_link_label, supersedes_id,
+                 owner_person_id)
+            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'unread', ?, ?, ?, ?, ?, ?, ?)
             """,
             (
                 external_id,
@@ -176,6 +190,7 @@ def insert_alert(
                 artifact_url,
                 artifact_link_label,
                 supersedes_id,
+                owner_person_id,
             ),
         )
         if cursor.rowcount == 0:
@@ -287,7 +302,12 @@ def recent_alerts(
 
 
 def list_artifact_alerts(
-    limit: int = 200, db_path: Path | None = None, archived: bool = False
+    limit: int = 200,
+    db_path: Path | None = None,
+    archived: bool = False,
+    *,
+    owner_person_id: int | None,
+    include_unowned: bool = False,
 ) -> list[Alert]:
     """Alerts authored via `draft_artifact` (source='artifact'), newest first.
 
@@ -296,20 +316,35 @@ def list_artifact_alerts(
     out of the `/today` queue — surfacing it is the whole point of the
     Artifacts section (the row persists; `set_status` never deletes it).
 
+    Only one person's drafts: those `owner_person_id` owns, plus the ones
+    with no owner when `include_unowned` (the principal's, see
+    `orchestrator/artifact_records.py`). No owner and no unowned is nothing.
+
     `archived` selects which slice to return: the default (False) lists only
     active artifacts (`archived_at IS NULL`); True lists only archived ones,
     so the gallery's Active / Archived views are clean swaps, not supersets.
     """
     if not _resolve_db_path(db_path).exists():
         return []
+    owners: list[str] = []
+    params: list[Any] = []
+    if owner_person_id is not None:
+        owners.append("owner_person_id = ?")
+        params.append(owner_person_id)
+    if include_unowned:
+        owners.append("owner_person_id IS NULL")
+    if not owners:
+        return []
     archived_clause = (
         "AND archived_at IS NOT NULL" if archived else "AND archived_at IS NULL"
     )
+    params.append(limit)
     with _get_conn(db_path) as conn:
         rows = conn.execute(
             f"SELECT * FROM alerts WHERE source = 'artifact' {archived_clause} "
+            f"AND ({' OR '.join(owners)}) "
             "ORDER BY created_at DESC LIMIT ?",
-            (limit,),
+            params,
         ).fetchall()
     return [_row_to_alert(r) for r in rows]
 
```

**File**: `packages/core/openexecutive/api/routes/alerts.py` (modified, +15/-3)
```diff
@@ -6,7 +6,7 @@
 from pydantic import BaseModel, Field
 
 from openexecutive.alerts import lifecycle, store
-from openexecutive.alerts.models import Alert, is_private_alert
+from openexecutive.alerts.models import Alert, is_private_alert, visible_alert
 
 # The standalone alerts UI (panel, live toast stream, mute/severity settings,
 # feedback) was removed — those items now surface only through the briefing
@@ -20,13 +20,25 @@
 
 def _visible_alert(alert_id: int, request: Request) -> Alert:
     """The alert, or 404 — also for one private to the principal when the
-    caller is someone else, so its existence is not revealed either."""
+    caller is someone else, and for a drafted artifact that isn't the
+    caller's, so its existence is not revealed either."""
     existing = store.get_alert(alert_id)
-    if existing is None or (is_private_alert(existing) and not _caller_is_principal(request)):
+    if (
+        existing is None
+        or (is_private_alert(existing) and not _caller_is_principal(request))
+        or not visible_alert(existing, _caller_viewer(request))
+    ):
         raise HTTPException(status_code=404, detail="Alert not found")
     return existing
 
 
+def _caller_viewer(request: Request) -> object:
+    from openexecutive.api.routes.chat import _resolve_caller_person_id
+    from openexecutive.orchestrator.artifact_records import viewer_for_person
+
+    return viewer_for_person(_resolve_caller_person_id(request))
+
+
 def _caller_is_principal(request: Request) -> bool:
     from openexecutive.api.routes.people import caller_is_principal
 
```

**File**: `packages/core/openexecutive/api/routes/artifacts.py` (modified, +36/-17)
```diff
@@ -20,6 +20,11 @@
 archived ones. Every route refuses non-artifact alert ids — these routes
 must not become general alert/run readers or mutators.
 
+Every route answers for the signed-in caller (`chat._resolve_caller_person_id`)
+and sees only what they may (`artifact_records` module docstring): their own
+drafts and runs, and the team's scheduled ones. Anyone else's answers 404, as
+a missing one does.
+
 Downloads are always served as attachments with `nosniff` and a sandbox CSP,
 so an HTML artifact never renders on the app's origin (the UI shows it in a
 sandboxed iframe instead).
@@ -38,17 +43,19 @@
 from collections.abc import Callable
 from typing import Annotated, Literal
 
-from fastapi import APIRouter, HTTPException, Query, Response
+from fastapi import APIRouter, HTTPException, Query, Request, Response
 from pydantic import BaseModel
 
 from openexecutive.orchestrator.artifact_formats import get_format
 from openexecutive.orchestrator.artifact_records import (
     ArtifactNotFound,
     ArtifactRecord,
     MalformedArtifactId,
+    Viewer,
     artifact_downloads,
     load_artifact,
     render_artifact_file,
+    viewer_for_person,
 )
 from openexecutive.orchestrator.artifact_records import (
     delete_artifact as delete_artifact_record,
@@ -101,32 +108,34 @@ class ArtifactDetail(ArtifactSummary):
 
 @router.get("/artifacts")
 async def list_artifacts(
-    limit: int = _DEFAULT_LIMIT, archived: bool = False
+    request: Request, limit: int = _DEFAULT_LIMIT, archived: bool = False
 ) -> dict[str, list[ArtifactSummary]]:
-    """Unified, newest-first list of every artifact the Executive produced.
+    """Unified, newest-first list of the artifacts the caller may see.
 
     Defaults to active artifacts; `?archived=true` returns only archived ones
     (the gallery's Active / Archived views are clean swaps, not supersets).
     """
-    records = list_artifact_records(limit, archived=archived)
+    records = list_artifact_records(limit, viewer=_viewer(request), archived=archived)
     return {"artifacts": [_summary(r) for r in records]}
 
 
 @router.get("/artifacts/{composite_id}")
-async def get_artifact(composite_id: str) -> ArtifactDetail:
+async def get_artifact(composite_id: str, request: Request) -> ArtifactDetail:
     """One artifact with its displayable body, addressed by composite id."""
-    rec = _load(composite_id)
+    rec = _load(composite_id, request)
     stored = rec.stored or ""
     body = stored if rec.format == "html" else get_format(rec.format).display(stored)
     return ArtifactDetail(**_summary(rec).model_dump(), body=body, rationale=rec.rationale)
 
 
 @router.get("/artifacts/{composite_id}/download")
 async def download_artifact(
-    composite_id: str, as_: Annotated[str | None, Query(alias="as")] = None
+    composite_id: str,
+    request: Request,
+    as_: Annotated[str | None, Query(alias="as")] = None,
 ) -> Response:
     """The artifact as a file. `?as=docx` exports a Markdown artifact to Word."""
-    rec = _load(composite_id)
+    rec = _load(composite_id, request)
     try:
         file = render_artifact_file(rec, as_)
     except ArtifactNotFound as exc:
@@ -149,32 +158,35 @@ async def download_artifact(
 
 
 @router.post("/artifacts/{composite_id}/archive")
-async def archive_artifact(composite_id: str) -> dict[str, str]:
+async def archive_artifact(composite_id: str, request: Request) -> dict[str, str]:
     """Soft-hide an artifact (reversible). Drops it from the default list and
     from the Executive's recall (knowledge index)."""
-    rec = _mutate(lambda: set_artifact_archived(composite_id, archived=True))
+    viewer = _viewer(request)
+    rec = _mutate(lambda: set_artifact_archived(composite_id, archived=True, viewer=viewer))
     from openexecutive.orchestrator.artifact_tools import unindex_artifact
 
     await unindex_artifact(rec.id)
     return {"status": "archived", "id": composite_id}
 
 
 @router.post("/artifacts/{composite_id}/restore")
-async def restore_artifact(composite_id: str) -> dict[str, str]:
+async def restore_artifact(composite_id: str, request: Request) -> dict[str, str]:
     """Un-archive an artifact, returning it to the active list and, for a
     drafted artifact, to the knowledge index."""
-    rec = _mutate(lambda: set_artifact_archived(composite_id, archived=False))
+    viewer = _viewer(request)
+    rec = _mutate(lambda: set_artifact_archived(composite_id, archived=False, viewer=viewer))
     if rec.kind == "draft" and rec.stored:
         from openexecutive.orchestrator.artifact_tools import index_artifact
 
-        await index_artifact(rec.id, rec.title, rec.format, rec.stored)
+        await index_artifact(rec.id, rec.title, rec.format, rec.stored, rec.owner_person_id)
     return {"status": "restored", "id": composite_id}
 
 
 @router.delete("/artifacts/{composite_id}")
-async def delete_artifact(composite_id: str) -> dict[str, str]:
+async def delete_artifact(composite_id: str, request: Request) -> d
```

**File**: `packages/core/openexecutive/api/routes/chat.py` (modified, +10/-0)
```diff
@@ -884,6 +884,9 @@ async def _do_briefing() -> str:
         # return_exceptions=True so a digest raising never discards the others —
         # each formatter already swallows its own errors, this just guards the
         # to_thread wrappers themselves.
+        # This turn's speaker, not whoever spoke last in this session: the
+        # digest shows a drafted document's card only to its owner.
+        session.caller_person_id = caller_person_id
         results = await asyncio.gather(
             asyncio.to_thread(render_and_trust, session),
             return_exceptions=True,
@@ -944,9 +947,16 @@ async def _do_prefetch() -> str:
     # all raise, and the entry would otherwise be stranded until the registry
     # cap evicted it.
     try:
+        from openexecutive.orchestrator.artifact_records import (
+            pinned_viewer,
+            viewer_for_person,
+        )
+
         with (
             principal_turn_rows(principal_turn),
             rows_for_person(caller_person_id) if kept_private else contextlib.nullcontext(),
+            # The session isn't bound yet: recall the speaker's own documents.
+            pinned_viewer(viewer_for_person(caller_person_id)),
         ):
             (
                 retrieved_context, episodic_context, peer_memory_context, briefing_context,
```

---

### Incident Patch 10: `a5b399d1` (2026-10-03)
**Commit Message**: feat(memory): bring Always in the loop notes into the owner's briefs and remind when due (#348)

## Problem

Always in the loop notes could only be read back by asking in a private
chat. The owner's morning brief and evening digest never mentioned what
they had promised, and nobody was reminded when a promise made by email
fell due.

## Approach

- **Morning brief:** a FROM YOUR NOTES — DUE SOON block lists what the
owner promised, agreed to or asked for, from a week overdue to a week
ahead. Both standalone prompts turn it into a **From your notes**
section.
- **End-of-day digest:** a FROM YOUR NOTES — TODAY block covers what the
owner committed to since the last digest, plus what is due tomorrow
(`memory/history_brief.py`).
- **Who sees the notes:** they appear only in a brief the scheduler
sends to the owner alone (`PRINCIPAL_DELIVERY`), only with the owner's
switch on, and never a teammate's notes. A run that uses them is marked
`private_to_principal`, so the shared run history stores no text, and
the notes move the brief's fingerprint.
- **Due-today reminders** (`memory/history_reminders.py`, called from
the scheduler tick between 09:00 and 18:00 local):
- They cover only promi

**File**: `README.md` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ Synthesized executive response
 
 **Episodic memory** — After every response, a background `claude-haiku-4-5` pass extracts key decisions, initiatives, and advice into SQLite. The next session opens with a `<past_decisions>` block so the Executive remembers what it recommended last month.
 
-**Always in the loop** — Each person can turn on "Keep track of what happens" (Settings → Memory). The Executive then keeps private, dated notes of what they said, in chat where it can confirm it's them (the web app signed in, their own Slack or Discord, Telegram with a webhook secret) and in Act as me replies they send. Every note rests on their own words, checked word for word. Only they see it, in Memories → History, where they can correct, pin or forget it. Notes are read back only to them, in a private chat, and expire after 90 days by default (the owner can change this). It needs no setup and no extra service.
+**Always in the loop** — Each person can turn on "Keep track of what happens" (Settings → Memory). The Executive then keeps private, dated notes of what they said, in chat where it can confirm it's them (the web app signed in, their own Slack or Discord, Telegram with a webhook secret) and in Act as me replies they send. Every note rests on their own words, checked word for word. Only they see it, in Memories → History, where they can correct, pin or forget it. Notes are read back only to them, in a private chat, and expire after 90 days by default (the owner can change this). The owner's morning brief and evening digest include what the owner's own notes say is due, and anyone with notes on gets a short reminder on the day something they promised by email is due. It needs no setup and no extra service.
 
 **Scheduler** — A built-in job runner claims due actions via `UPDATE … RETURNING` to prevent double-firing. The API must run as a single instance; do not horizontally scale it without gating the scheduler first.
 
```

**File**: `packages/core/openexecutive/architecture/architecture-facts.yaml` (modified, +22/-2)
```diff
@@ -2434,7 +2434,8 @@ memory:
 
   always_in_the_loop: |
     Always in the loop (memory.history, memory.history_notes,
-    memory.history_chat, orchestrator.history_tools, api/routes/history.py):
+    memory.history_chat, memory.history_brief, memory.history_reminders,
+    orchestrator.history_tools, api/routes/history.py):
     private, dated notes of what a person said. Two sources: a reply the
     person approved and sent through Act as me (delegation.reply_send starts
     history_notes.note_sent_reply in the background after the send), and what
@@ -2488,7 +2489,26 @@ memory:
       memory, the lockdown from that round), and marks the conversation
       mail_private so later turns start the same way and, for a team
       member, the principal can't open it.
-    - Notes never feed Honcho, episodic extraction or standing facts. The five
+    - recall_history takes due=true to list only dated notes, a week overdue
+      to two weeks ahead, soonest first ("what's due today?").
+    - The owner's briefs read the owner's own notes (memory.history_brief):
+      the morning brief a FROM YOUR NOTES - DUE SOON block, the end-of-day
+      digest a FROM YOUR NOTES - TODAY block. Only on the scheduler's
+      delivery (PRINCIPAL_DELIVERY), never a chat run (its tool result
+      reaches the shared audit row and Honcho), only with the switch on,
+      never a teammate's notes. A run that used any is private_to_principal
+      (the run history keeps PRIVATE_RUN_ARTIFACT) and the note ids with
+      their state enter the fingerprint.
+    - Due-today reminders (memory.history_reminders, from the scheduler
+      tick, 09:00 to 18:00 local) cover only promises made by email
+      (approved_reply): chat promises are already open loops the nudge
+      engine chases. The message says how many, never what or to whom; the
+      senders' audit rows are private to the person (rows_for_person) and
+      stay off the activity rail. The person asks for the detail in a
+      private chat. Sent to their own DM, private Telegram chat (delivery_order
+      skips group ids, for the briefs too) or email (runner.deliver_to_person),
+      one try a day per person (history_reminders, claimed, never released).
+    - Notes never feed Honcho, episodic extraction or standing facts. The six
       history_* tables swap with client slots and the factory reset clears them.
 
 peer_memory:
```

**File**: `packages/core/openexecutive/architecture/prebuilt/agents.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "agents",
   "title": "Agent Council",
-  "markdown": "The Executive (`openexecutive.orchestrator.executive.Executive`) is a single coherent persona that fans out to specialist sub-agents via Anthropic tool use. Each specialist subclasses `openexecutive.agents.base.BaseAgent`, carrying a `name`, `domain`, and `model`, and exposes `analyze(...)`, which wraps the question in user-turn context and calls Claude through the per-call provider. That context is per call and never cached: `<company_stage>` (the stage from the company profile — specialists never see the profile itself), in solo mode `<principal_role>` (what kind of principal the advice is for, in plain words, with their title and remit — `router.principal_role_context`), `<department_memory>`, `<past_decisions>`, `<failure_cases>`, `<relevant_knowledge>` and `<conversation_context>`, outermost first. The specialist's own system prompt is a static domain constant under one `cache_control` block, so it stays byte-identical across companies and profile edits. A chat turn takes the stage from its session's profile (the one the Executive reasons over, and the one an eval scenario injects); workflow steps and the MCP server's `consult_specialist` read it fresh from the profile on disk. The role tag follows the turn's mode: a chat turn pins the role on its session with the mode (`pin_turn_principal_role`: the session's `principal_role` override, else the workspace settings) and sends it in solo and nothing in team, so the org block, every specialist in the turn and any workflow the turn starts see the same role; callers with no chat turn read it fresh (`load_principal_role`: the current session's mode and role, else the workspace's), and a failed read sends no tag rather than failing the consult. The CFO, CSO and sales prompts key their advice on it: for a bootstrapped, self-funded or solo company they drop venture fundraising benchmarks and work from cash, and raise only if the founder wants to.\n\nRouting uses one `consult_specialist` tool. Beside it the Executive carries its skill tools (`search_skills`, `load_skill`, `create_skill`, `update_skill`, `delete_skill` — shown to users as **playbooks**; `create_skill` / `update_skill` / `delete_skill` never change the library — they save a draft (`knowledge/skill_drafts.py`) that a person approves on the Playbooks tab, and the reply links to it; `update_skill` / `delete_skill` (and `create_skill`, for a name a workflow still follows) refuse any built-in name (including a company's customized copy) and any company playbook a workflow (even a switched-off custom one) follows — workflows read playbooks at run time, approved scheduled ones included, and this loop also runs on inbound email and chat, so only a person on the Playbooks tab can change what a workflow follows; a hidden built-in is invisible to search and load; each `search_skills` hit lists the `workflows` that follow it, and the persona routes \"the finished deliverable\" to that workflow and quick or partial asks to the playbook inline); Tool calls made while proactive work is tagged (scheduler dispatch, reflection, research, alert review) feed the Attunement outcome ledger. Goals have three tools: `list_department_goals`, `update_department_goal` (progress the user reports) and `create_goal` (a new goal the principal states, filed under an area by slug or title and creating the area when none matches — see Org). `create_goal` runs only for the principal on a verified surface, and no unattended run is offered it: the tools in `schedule_tools.UNATTENDED_WITHHELD_TOOLS` are dropped from reflection's and research's toolkits by `unattended_toolkit`, and from the chat loop when its Session is marked `unattended` — the scheduler's PROACTIVE TRIGGER run, whose prompt quotes stored intent text; a call the model emits anyway gets an error tool_result. `record_decision_outcome` records how a past decision turned out — the weekly review lists decisions older than 30 days with no outcome as `[decision N]` — writing `decisions.outcome` (`episodic.update_decision`) and auditing the rationale; it has `create_goal`'s gate (the principal on a verified surface only; everyone else gets an audited refusal) and is in `UNATTENDED_WITHHELD_TOOLS` too. A missing or unknown id returns the decisions still waiting on an outcome, so the model can retry with the right one. Its schema is static; the solo persona has one line on it, and team mode learns it from the tool description, so the team persona is byte-identical. Attunement adds `list_open_loops` (what a person owes — everyone's for the principal only in a private conversation, otherwise the caller's own) and `close_open_loop`, which only closes a loop when the turn's resolved speaker is the principal or the loop's owner — an unrostered sender, a signed-in web user not on the roster, and unattended sessions are refused. `assign_open_loop` opens one on request (\"ask Ben to send me the Q
```

**File**: `packages/core/openexecutive/architecture/prebuilt/memory.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "memory",
   "title": "Memory System",
-  "markdown": "The Executive's durable memory is an episodic SQLite store at `./episodic_memory.db`, managed by `openexecutive.memory.episodic`. It holds four tables:\n\n- `decisions` — choices made, with `domain`, `summary`, `rationale`, `outcome`, and `tags`. `outcome` is filled in when the principal says how a decision turned out — the `record_decision_outcome` chat tool (principal on a verified surface only) or the Memories page. The weekly review reads this table twice: the week's decisions (`decisions_since`) and up to three older than 30 days with no outcome yet (`decisions_awaiting_outcome`), which it asks about.\n- `initiatives` — tracked efforts with a `status` and `summary` (idempotent upserts).\n- `advice_given` — query/advice pairs per domain.\n- `scheduled_actions` — a dispatch queue, treated separately from recall memory. `cancel_scheduled_action` guards its UPDATE on `status = 'pending'`, so a cancel never overwrites a row the scheduler claimed a moment earlier.\n\n### What gets extracted, and when\n\n`episodic.extract_and_store` runs after a turn and asks a utility-fast model for decisions, initiatives and advice. Every candidate must carry a `user_commitment_quote` that appears verbatim in the principal's own message (`_is_valid_user_commitment`) — the turn's speaker text (`memory_text` when the entry point supplies one, else the prompt), so a quoted Executive email or a briefing card's body inside the prompt cannot satisfy it — the model has repeatedly tried to log the Executive's *recommendations* as the user's commitments, and that quote is the hard gate against it.\n\nA turn reaches the extractor if `should_extract(speaker_text, session=...)` is true, which means only that the principal said something on a surface that proved it was them — there is deliberately **no length floor**. There used to be one, on the combined user+assistant length, and on a live tenant it selected almost exactly the wrong turns: 9 of 16 exchanges were blocked, and the 9 held every instruction the principal gave, while the 7 admitted were long analytical exchanges with no commitment in them. The extractor ran 13 times and stored nothing.\n\nMoving that floor to the user's side would relocate the bug, not fix it. The canonical executive decision is a long analysis answered with \"Approve option B.\" (17 chars) or \"Do B.\" (5), and any floor high enough to skip \"Done\" (4) also skips those — \"Do B.\" and \"Done\" differ by one character and mean opposite things. Length cannot separate a decision from an acknowledgement; the verbatim-quote check can, so `_is_valid_user_commitment` is the gate that decides. The price is one utility-fast call on turns that propose nothing.\n\nThat quote check is only meaningful when `user_message` holds the **principal's** words, and on a chat channel it does not — `Executive.chat()` is reached from Slack, Discord, Telegram, Google Chat and the email poller. A teammate's line would be written to `decisions` with no speaker attached, indistinguishable from the principal's own; an inbound email body is text the sender chose, so a self-quote is free. Removing the length floor is what makes this bite — short channel traffic used to fall under it incidentally — so `should_extract` asks the untrusted-content policy (`orchestrator.content_trust.principal_speaking`) whether the principal is speaking. It names the principal's surfaces rather than inferring them: the web chat (signed in as the principal — or, on an install with no principal on the People page yet, a request that carried no sign-in; a signed-in email on nobody's entry, such as an archived teammate still allowed to sign in, is not the principal), the CLI (`Session.from_cli`), the principal's own Slack or Discord or a private Telegram chat with a valid webhook secret (`people_tools.is_principal_on_verified_surface`), and email from the principal's primary address that Gmail's own `Authentication-Results` marks `dmarc=pass` (`Session.email_authenticated`). Everything else fails closed: a teammate (on the web too), an unrostered sender, the principal's address on mail Gmail did not authenticate, Google Chat, the MCP server (its caller names themselves), unattended runs, and an unreadable roster. The rule used to be \"no `origin_channel` means the principal's own surface\", and the email poller left `origin_channel` empty, so every stranger's email ran through the extractor with its body — headers, quoted chain and all — as the principal's words, and whatever it stored rendered on every later turn. The poller now tags its sessions `origin_channel=\"email\"`, and the gate no longer reads an empty channel as trust.\n\nThe extractor also reads only the words **outside** every `<untrusted_content>` block (`schedule_extraction` runs `content_trust.strip_untrusted` first): an attached document's text is inlined in that block, so a sentence the principal did n
```

**File**: `packages/core/openexecutive/architecture/prebuilt/scheduler.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "scheduler",
   "title": "Scheduler & Cadences",
-  "markdown": "The scheduler is an asyncio task started in the FastAPI lifespan (`openexecutive.scheduler.runner.run_scheduler`). It polls every 30s and reads due rows from `scheduled_actions` (in `episodic_memory.db`). The due query uses `claim_due_actions`, an UPDATE…RETURNING claim, so each row fires at most once per process — this assumes a single scheduler instance per database. Each due row runs in its own task, started with no audit scope (`audit.context.unscoped_audit_rows`): a scheduled action is unattended and never part of the turn that scheduled it, so its audit rows follow the ordinary rule. Polls are gated on an active company profile via `_company_profile_active()`; before onboarding, due rows stay `pending`.\n\n### Operator pause\n\nA global pause switch (`openexecutive.scheduler.pause`, one row in the `executive_control` table) stops everything the Executive starts on its own. It is the first check of every scheduler tick: while paused the tick does nothing — no alert/watchlist sweep, no claim — so due rows stay `pending` and fire on the first tick after resume. Actions already claimed when the pause lands run to completion; pausing holds work, it never cancels it. The same check gates the Gmail poller (the inbox is left unread) and the workflow resumer (no `wait_for_human` timeouts or resumes, and `apply_resolution` records a reply without kicking the run). Inbound conversations — web chat, Slack, Discord, Telegram, Google Chat — are deliberately not gated. The switch is set from the sidebar, the paused banner or Settings in the UI, or via `POST /executive/pause` / `POST /executive/resume`; each flip writes an `executive_paused` / `executive_resumed` audit row. Any signed-in caller may pause (it only holds work); resuming releases every held action at once, so it is the principal's alone (open only while no principal is on the roster). The state persists across restarts (boot logs a warning while paused) and across client-slot switches. `is_paused()` is read-only: a DB file or table that does not exist yet reads as \"running\", but a read error on an existing DB reads as \"paused\" — the brake fails closed, so a storage fault holds work rather than silently releasing it while the UI still shows \"paused\" (the UI shows \"status unknown\" when it cannot read the state).\n\n### Liveness heartbeat\n\nEvery tick ends by recording when it finished and what it did — `ran`, `paused`, `waiting_for_company`, `rotating`, or `failed` when the tick raised — and `run_scheduler` notes when it started. `scheduler_heartbeat()` returns both; they live in process memory, not the database. Settings → Setup status (`GET /setup/status`) reads them: no start means the task isn't running; no tick five minutes after starting, or none for three poll intervals (at least 90 s), means the loop has stopped; `failed` and `waiting_for_company` get their own light. Liveness is judged before the pause switch, because a paused scheduler still ticks: one that has stopped shows as stopped, where the Resume button wouldn't help. A restart clears the previous run's last tick. Due actions run as their own tasks, so a slow brief never ages the heartbeat.\n\n### Cadence DSL\n\n`openexecutive.departments.cadence` supports, all in UTC for department and workflow cadences:\n\n- `daily@HH:MM`\n- `weekly@DOW@HH:MM` or `weekly@DOW-HH:MM` (DOW is a 3-letter day, e.g. `weekly@thu@09:00`)\n- `quarterly@DD-HH:MM`\n\n`PATCH /departments/{slug}` rejects a spec that does not parse (bad format, unknown DOW, out-of-range time) with a 422 naming the valid formats, so a typo is caught at save time instead of silently never firing. An empty spec means no cadence.\n\nWhen a department cadence is due, the runner invokes the `department_check_in` workflow and chains the following occurrence via `cadence.enqueue_next()`. The fire is not passed through the authority gate: the check-in sends nothing (it grades Goals, writes one audit row and a Honcho note), and every action it proposes carries its own `gate_action` verdict in the report. Before creating a run the runner applies a skip rule (`department_check_in.needs_check_in`): the check-in is skipped when the department has no specialist agent, has no Goals, or nothing is new since its Goals were last reviewed — no decision or audit row tagged to the department (the check-in's own review row aside) since the oldest Goal's `last_reviewed_at`, and no Goal edited after it was graded. A Goal never reviewed always runs it. A skip leaves no run in the activity rail, is recorded as `cancelled` with its reason (`skipped: …` in `last_error`) rather than `done` — a done cadence row means \"the check-in ran\" to the nudge engine — and still chains the next occurrence; so does a check-in that fails once its retries are spent, so one broken department does not fall out of the daily cycle. Chaining is idempotent: while a next occu
```

**File**: `packages/core/openexecutive/architecture/prebuilt/schemas.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "schemas",
   "title": "Data Schemas",
-  "markdown": "The shapes below are the load-bearing data structures: episodic SQLite tables (in `episodic_memory.db`) and the Pydantic models for departments and people.\n\n### Episodic tables\n\n| Table | Key columns |\n|---|---|\n| `decisions` | `id`, `timestamp`, `domain`, `summary`, `rationale`, `outcome`, `tags`, `department`, `session_id` |\n| `initiatives` | `id`, `title`, `status`, `created_at`, `updated_at`, `summary`, `department` |\n| `advice_given` | `id`, `timestamp`, `domain`, `query_summary`, `advice_summary`, `department`, `session_id` |\n| `facts` | `id`, `kind` (fact / correction / profile), `subject`, `subject_key`, `statement`, `previous_statement`, `source_quote`, `source_channel`, `session_id`, `turn_id`, `recorded_by_person_id`, `created_at`, `status` (active / superseded / retired), `superseded_by`, `retired_at`, `retired_reason` |\n| `scheduled_actions` | `id`, `created_at`, `run_at`, `channel`, `channel_ref`, `intent_text`, `status`, `attempts`, `kind`, `department`, `assigned_to_person_id`, `awaiting_response_since`, `scope_key`, `required_scope` |\n| `outbound_context` | `id`, `created_at`, `channel`, `channel_ref`, `recipient_person_id`, `outbound_text`, `originating_session_id`, `outbound_message_id`, `consumed_at`, `status` |\n| `session_drive_files` | (`session_id`, `person_id`, `file_id`) PK, `name`, `mime_type`, `link`, `summary` (first 600 chars of an opened file), `opened`, `found_by` (the search query), `first_seen_at`, `last_seen_at` — Drive files a conversation found or opened (`memory.drive_reads`) |\n| `session_drive_searches` | `id`, `session_id`, `person_id`, `query`, `result_count`, `searched_at` — every Drive search a conversation ran |\n| `chat_messages` | `id`, `session_id`, `role`, `content`, `created_at`, `action_chips`, `stopped`, `sender_person_id`, `feedback`, `feedback_note`, `feedback_by_person_id`, `sources` (JSON `{sources: [{kind, title, url}], unavailable: [area]}` — what an assistant reply looked at and which areas it left out; NULL on older rows) |\n| `attunement_usage` | `day` (PK, UTC date), `calls` — the per-day ceiling on open-loop extraction model calls |\n| `attunement_profiles` | `person_id` (PK), `rules` (JSON: up to 4 `{text, basis, evidence}`), `locked`, `updated_at`, `updated_by`, `last_pass_at`, `pass_day`, `passes_today`, `last_message_id` — per-person working style plus pass pacing |\n| `attunement_profile_history` | `id`, `person_id`, `created_at`, `rules`, `locked`, `updated_by` — every change to a working style |\n| `proactive_outcomes` | `id`, `created_at`, `person_id`, `source`, `ref`, `channel`, `channel_ref`, `outbound_context_id`, `outcome` (`replied` / `acted` / `ignored` / `void`, NULL while open), `resolved_at` — one row per proactive DM (Attunement outcome ledger) |\n| `delegation_settings` | `person_id` (PK), `enabled` (default 0), `updated_at`, `updated_by` — Act as me, per person; no row means off |\n| `history_notes` | `id`, `person_id`, `visibility` (`private`), `source` (`approved_reply`), `channel` (`email`), `conversation_key` (a hash of the channel and thread, never the thread id), `counterpart`, `subject`, `kind` (`promised` / `agreed` / `declined` / `answered` / `asked` / `shared`), `summary`, `quote` (the person's own words), `due_date`, `trust`, `occurred_at`, `created_at`, `expires_at` (NULL: until forgotten), `pinned`, `correction`, `corrected_at`, `kept_from` (when the retention clock started: NULL means `occurred_at`; an unpin restarts it) — Always in the loop, one row per note |\n| `history_settings` | `id` (1), `retention_days` (NULL: until forgotten; no row means 90), `updated_at`, `updated_by` — the company retention |\n| `history_person_settings` | `person_id` (PK), `reply_notes` (default 0), `retention_days` (NULL: the company's), `updated_at`, `updated_by` |\n| `history_excluded` | `person_id`, `conversation_key` (PK together), `created_at` — conversations a person asked not to remember |\n| `history_chat_passes` | `person_id`, `day` (PK together, UTC `YYYY-MM-DD`), `passes` — note passes run on a person's chat messages that day, against the daily cap; older days pruned on write |\n| `delegation_voice` | `person_id` (PK), `profile` (JSON: `greetings` per audience, `sign_off`, `signature`, `length`, `formality`, up to 8 `habits`, up to 6 `avoid`, up to 3 `exemplars`), `locked`, `learned_at`, `sample_count`, `updated_at`, `updated_by` — \"How I write\" |\n| `delegation_voice_history` | `id`, `person_id`, `created_at`, `profile`, `locked`, `updated_by` — every change to a writing profile |\n| `delegation_drafts` | `id`, `person_id`, `source` (`chat` \\| `inbox`), `thread_id`, `draft_id`, `message_id`, `sent_message_id`, `created_at` — one row of ids per draft Act as me saved in someone's Gmail (no address, subject or text): the daily limit counts it, and \"How I write\" skips a chat draft's thread and a sent draft's message |\
```

**File**: `packages/core/openexecutive/architecture/prebuilt/today.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "today",
   "title": "Today / Morning Brief",
-  "markdown": "`openexecutive.api.routes.today` serves the morning brief — a one-screen, read-only view of what is happening across the org. It is the default landing surface (the Next.js root renders `<Briefing>`). Every signed-in page shares one sidebar (`AppSidebar`). Its Recent list is capped at the 7 newest web chats. The full history, including Slack, Telegram and Discord conversations (recognised by their session-id prefix), lives on `/chats`. A chat opens from any page through `/?session=<id>`.\n\n`GET /today` returns `TodayResponse` assembled by `_build_today()`, which is synchronous and caller-agnostic:\n\n- **`departments`** — per-department goal health, rolling up each department's goal counts (`total`, `at_risk`, `off_track`) plus its awaiting-workflow count, and `attention_goals`: the actual off-track/at-risk goals (worst first, capped at 3) with `key_result`, `current`, `target`, and `status`, so the briefing's Department card shows *which* goal is off and how far without a click. Empty for healthy/inactive departments.\n- **Private cards.** An alert tagged `private:principal` (`alerts.models.PRIVATE_ALERT_TAG` — raised on a turn about mail from one of the principal's contacts or mail they forwarded, or a meeting proposal with a contact) is in `proposals` only when the caller is the principal. `_build_today` leaves it out by default, so the end-of-day digest, the reflection and Discord's `/today` never see it, and the morning brief reads it only on a run for the principal (the scheduler's, or the principal's own verified chat turn in a conversation only they can read — see Workflows). The narrative is written from one only in the principal's own `principal` scope, which nobody else is served; the shared `company` scope an unresolved caller gets, and a teammate's scope, never are. The activity rail skips it, and the chat digest includes it only on the principal's own verified turn.\n- **Roster-request cards.** When someone not on the People list writes in (see Org and Integrations), `people.roster_requests.surface_card` raises an alert of source `roster_request` (medium, tagged `roster_request:<id>` and `private:principal`, routed to the principal), so it follows every private-card rule above. `GET /today` attaches `roster_request` to that proposal (`_roster_request_card`: channel, address or account id, the sender's sanitised and unverified name, profile email, company-domain flag, suggested kind and person, message count, whether they were acknowledged, first seen, and the held messages' first lines) while the request is still pending. The Briefing renders it as its own card (`RosterRequestCard`: add as a new person with a name and an explicit team/contact choice — pre-filled as team on a company domain — or \"someone already on the list\", with a replace-account option for a chat id, or Ignore), which calls `/people/requests/{id}` directly and never hands off to chat, so what a stranger wrote never seeds a turn. The card is kept out of everything that could close it without answering it or put the stranger's words in front of a model: the narrative (`_action_proposals` drops it), the chat's open-alert digest (`<briefing>` — the principal's verified turn gets a separate `<roster_requests>` block instead; see Agents), `ack_alert`, a single ack (`POST /alerts/{id}/ack` is a 409), the \"Dismiss N older than 7 days\" count and the server's bulk ack, reopen, the TTL sweep and the alert review (`roster_request` is in `lifecycle.TTL_EXEMPT_SOURCES`). It ends when the request does: answered (`ack`, or `dismissed` on a decline) or expired after `ROSTER_REQUEST_TTL_DAYS`.\n- **`people`** — an attention-ranked roster of the **team** (the principal's contacts are never listed, and get no insight note). Each person carries `awaiting_action` count, soonest SLA, a `status` (`on_leave` / `needs_reply` / `awaiting` / `clear`), reachability, `overdue`, a server `priority` sort key, and a cached one-line `insight`. Sorted by `(-priority, full_name)`. Stale insight notes are regenerated in the background only when the roster has more than one person: the UI shows the People sidebar only for more than one, so a one-person install (solo, or a team before anyone else is added) does not pay a daily model and peer-memory call for a note nobody sees. Cached notes are still served.\n- **`proposals`** — the *live* unread alerts (workflow approvals, triage-classified inbound, Executive signals, flagged artifacts, and gated calendar bookings; an artifact carries `artifact_format` / `artifact_url` and a `body` already rendered to Markdown for its format, so the card badges it as a web page, Word doc, spreadsheet or link and offers *Open artifact*): unread, inside their category TTL, not snoozed — see *Alert lifecycle* below. Each carries `score`, `category` (`action` vs `monitoring`), `surfaced_reason` from `openexecutive.briefing.ranking`,
```

**File**: `packages/core/openexecutive/briefing/brief_state.py` (modified, +6/-1)
```diff
@@ -355,6 +355,7 @@ def build_brief_fingerprint(
     live_keys: dict[str, Any] | None = None,
     reflection_flags: str = "",
     teammate_changes: str = "",
+    owner_notes: list[Any] | None = None,
 ) -> str:
     """Stable hash of everything the brief would say. Deliberately free of
     dates and timestamps so an unchanged day yields the same fingerprint
@@ -378,7 +379,9 @@ def build_brief_fingerprint(
     only when non-empty, so a caller that passes neither keeps its old
     fingerprint. So is ``teammate_changes`` (the TEAMMATE CORRECTIONS block):
     a correction a teammate made since the last brief un-suppresses it, since
-    the principal hears of it nowhere else."""
+    the principal hears of it nowhere else. ``owner_notes`` (the FROM YOUR
+    NOTES keys, ``history_brief.NotesBlock.keys``: note ids and states, no
+    dates) likewise, only when non-empty."""
     new, carried = split_proposals(today_data.get("proposals", []), since)
     payload = {
         "new": sorted(int(p.get("alert_id") or 0) for p in new),
@@ -428,6 +431,8 @@ def build_brief_fingerprint(
         payload["reflection_flags"] = reflection_flags
     if teammate_changes:
         payload["teammate_changes"] = teammate_changes
+    if owner_notes:
+        payload["owner_notes"] = [list(k) if isinstance(k, tuple) else k for k in owner_notes]
     blob = json.dumps(payload, sort_keys=True, default=str)
     return hashlib.sha256(blob.encode("utf-8")).hexdigest()
 
```

---

### Incident Patch 11: `58617e5c` (2026-10-03)
**Commit Message**: docs: describe Always in the loop in the README (#347)

## Problem

The README doesn't mention Always in the loop (private notes of what
each person said), and it says nothing about who can see what the
Executive keeps about a person.

## Approach

- A short Architecture paragraph covering what is noted, from where, who
sees it, and how long it lasts.
- The Honcho row now says each person sees only their own card.
- One line in Privacy: what the Executive keeps about a person is shown
only to that person, the owner included.

## Checklist

- [x] Working implementation — no stubs or TODO placeholders
- [ ] Tests added/updated for new behavior (`pytest
packages/core/tests/unit/`)
- [ ] `ruff check` and `mypy` pass (`make lint`)
- [ ] UI builds if touched (`cd packages/ui && npm run build`)
- [ ] Eval scenarios added for a new agent or prompt change (if
applicable)
- [ ] Architecture docs updated if a documented topic changed
      (see the "Architecture Docs" section in `CLAUDE.md`)
- [x] No secrets, credentials, or personal data committed

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_019dn1iBc6DwUwEutKEzadSN

---
_Generated by [Clau

**File**: `README.md` (modified, +5/-1)
```diff
@@ -52,6 +52,8 @@ Synthesized executive response
 
 **Episodic memory** — After every response, a background `claude-haiku-4-5` pass extracts key decisions, initiatives, and advice into SQLite. The next session opens with a `<past_decisions>` block so the Executive remembers what it recommended last month.
 
+**Always in the loop** — Each person can turn on "Keep track of what happens" (Settings → Memory). The Executive then keeps private, dated notes of what they said, in chat where it can confirm it's them (the web app signed in, their own Slack or Discord, Telegram with a webhook secret) and in Act as me replies they send. Every note rests on their own words, checked word for word. Only they see it, in Memories → History, where they can correct, pin or forget it. Notes are read back only to them, in a private chat, and expire after 90 days by default (the owner can change this). It needs no setup and no extra service.
+
 **Scheduler** — A built-in job runner claims due actions via `UPDATE … RETURNING` to prevent double-firing. The API must run as a single instance; do not horizontally scale it without gating the scheduler first.
 
 **Prompt caching** — The system prompt is structured so the Executive persona, company profile, and knowledge index are cached separately (up to 85% cache hit rate after the first few turns). No dynamic content ever goes in a cached block.
@@ -430,7 +432,7 @@ the app refuses to start.
 | `LOCAL_MODELS` | No | — | Comma-separated local model slugs to surface in the Council UI and route locally, e.g. `llama3.3,qwen2.5` |
 | `LOCAL_TIMEOUT_S` | No | `300` | Per-call timeout for local generation, in seconds |
 | `LOCAL_REASONING_EFFORT` | No | — | `reasoning_effort` sent on every local request: `none`, `minimal`, `low`, `medium` or `high`. Set it for thinking-only models (GLM on Fireworks) that otherwise spend the whole token budget reasoning |
-| `HONCHO_ENABLED` | No | `false` | Per-person memory layer ([honcho.dev](https://honcho.dev)) — a peer card shared across all channels |
+| `HONCHO_ENABLED` | No | `false` | Per-person memory layer ([honcho.dev](https://honcho.dev)) — a peer card shared across all channels; on the Memories page each person sees only their own |
 | `HONCHO_API_KEY` | No | — | Required when `HONCHO_ENABLED=true` |
 | `HONCHO_BASE_URL` | No | — | Self-hosted Honcho endpoint |
 | `ENABLE_WEB_SEARCH` | No | `true`² | Let the Executive and specialists answer with live web results (news, market data, competitor moves) alongside your uploaded documents |
@@ -540,6 +542,8 @@ pytest packages/core/tests/unit/ -v
 
 Everything in `company/` is gitignored — the profile YAML, uploaded documents, and the ChromaDB vector store. None of this leaves your local machine (or your own volume in cloud deployments) except as part of prompts sent to the Anthropic API. Anthropic does not train on API data.
 
+Inside the app, what the Executive keeps about a person is theirs: Always in the loop notes and the peer memory card are shown only to that person, the owner included.
+
 ## Contributing
 
 See [.github/CONTRIBUTING.md](.github/CONTRIBUTING.md). All PRs must include:
```

---

### Incident Patch 12: `eebda072` (2026-10-03)
**Commit Message**: feat(memory): keep notes of what people say in chat (#346)

## Problem

Always in the loop only noted replies sent through Act as me. What
people tell the Executive in chat (the web chat, Slack, Discord,
Telegram) was never noted, and only someone with Act as me could turn
the switch on at all. Separately, the Pulse People tab showed every
teammate's peer-memory card to anyone signed in.

## Approach

- After each chat turn (single voice and committee),
`memory.history_chat` takes private notes from what the speaker typed.
It does this only when they turned "Keep track of what happens" on and
the surface verified them: the web chat signed in, their own Slack or
Discord, a private Telegram chat behind a valid webhook secret, or a
channel whose adapter sets the new `Session.speaker_verified`. It reads
only their own words, never the reply or anyone else's message, and
never a turn that touched their mailbox. Notes pass the same
`check_note` gate as email notes. Messages under 40 characters are
skipped, and each person gets at most 40 passes a day, counted in the
company DB.
- Any team member on the People list may turn it on; Act as me isn't
needed. Recall reads notes only in a priva

**File**: `packages/core/openexecutive/api/routes/episodic.py` (modified, +27/-22)
```diff
@@ -36,6 +36,7 @@
     PERSON_CONCLUSIONS_MAX_PAGE,
     PeopleMemory,
     PersonConclusionsPage,
+    PersonMemory,
     people_overview,
     person_conclusions,
 )
@@ -379,33 +380,38 @@ def _caller_is_principal(request: Request) -> bool:
     return caller_is_principal(request)
 
 
-def _is_principal_id(person_id: int) -> bool:
-    """Whether ``person_id`` is a principal row. Fails closed (True): an
-    unreadable roster must not open the principal's memory to others."""
-    try:
-        from openexecutive.people.store import get_person
+def _viewer(request: Request) -> int | None:
+    """The caller's own People entry, or None (signed in but not on the
+    roster, a service call, an unreadable roster)."""
+    from openexecutive.api.routes.chat import _resolve_caller_person_id
 
-        person = get_person(person_id)
+    try:
+        return _resolve_caller_person_id(request)
     except Exception:
-        return True
-    return bool(person is not None and person.is_principal)
+        logger.exception("memories: caller lookup failed — showing no one's peer memory")
+        return None
+
+
+def _own_entries(people: list[PersonMemory], viewer: int | None) -> list[PersonMemory]:
+    """The caller's own entry alone. Nobody sees another person's, the
+    principal included: peer memory is drawn from each person's own
+    conversations."""
+    return [p for p in people if viewer is not None and p.person_id == viewer]
 
 
 @router.get("/memories/people", response_model=PeopleMemory)
 async def list_people_memory(
     request: Request, recent: int = Query(5, ge=1, le=50)
 ) -> PeopleMemory:
-    """What peer memory knows about each rostered person: card, conclusion
-    count, last-learned time and the ``recent`` newest conclusions. Read-only
-    and LLM-free; ``status`` is ``disabled`` when peer memory is off.
+    """What peer memory knows about the caller: card, conclusion count,
+    last-learned time and the ``recent`` newest conclusions. Read-only and
+    LLM-free; ``status`` is ``disabled`` when peer memory is off.
 
-    The principal's own entry is shown to the principal only: it is drawn
-    from all their conversations, including about their contacts, which are
-    private to them."""
+    Only the caller's own entry: peer memory is drawn from each person's own
+    conversations, so nobody else's is shown, the principal included. A
+    caller who isn't on the roster sees none."""
     overview = await people_overview(recent=recent)
-    if _caller_is_principal(request):
-        return overview
-    people = [p for p in overview.people if not p.is_principal]
+    people = _own_entries(overview.people, _viewer(request))
     return overview.model_copy(update={
         "people": people,
         "conclusion_total": sum(p.conclusion_count for p in people),
@@ -419,12 +425,11 @@ async def list_person_conclusions(
     page: int = Query(1, ge=1),
     size: int = Query(50, ge=1, le=PERSON_CONCLUSIONS_MAX_PAGE),
 ) -> PersonConclusionsPage:
-    """One page of every conclusion peer memory holds about one person,
+    """One page of every conclusion peer memory holds about the caller,
     newest first. Read-only and LLM-free; 404 when the person is not on the
-    roster or peer memory has no peer for them yet — and, for anyone but
-    the principal, for the principal (their memory covers their contacts,
-    which are private to them)."""
-    if _is_principal_id(person_id) and not _caller_is_principal(request):
+    roster or peer memory has no peer for them yet, and for anyone but the
+    caller themselves, exactly as for an id that does not exist."""
+    if _viewer(request) != person_id:
         raise HTTPException(status_code=404, detail="Person not found in peer memory")
     result = await person_conclusions(person_id, page=page, size=size)
     if result is None:
```

**File**: `packages/core/openexecutive/api/routes/history.py` (modified, +8/-4)
```diff
@@ -61,8 +61,11 @@ class HistoryOut(BaseModel):
     effective_retention_days: int | None
     company_retention_days: int | None
     retention_choices: list[int | None]
-    # Whether they may turn reply notes on (they can use Act as me) and set
+    # Whether they may turn "Keep track of what happens" on (a team member on
+    # the People list), whether notes from their email replies can come too
+    # (they can use Act as me, which writes them), and whether they may set
     # the company retention (they are the principal).
+    can_keep_notes: bool
     can_note_replies: bool
     can_set_company_retention: bool
 
@@ -147,6 +150,7 @@ def _state(person: Person, query: str | None = None) -> HistoryOut:
         effective_retention_days=history.effective_retention(person.id),
         company_retention_days=history.company_retention(),
         retention_choices=list(history.RETENTION_CHOICES),
+        can_keep_notes=history.can_keep_notes(person),
         can_note_replies=_can_note_replies(person),
         can_set_company_retention=bool(person.is_principal),
     )
@@ -169,10 +173,10 @@ async def update_history_settings(request: Request, body: SettingsUpdate) -> His
     # half the request applied.
     if company_change and not person.is_principal:
         raise _refuse(403, "principal_only", "Only the account owner can change how long notes last for everyone.")
-    if own_change and body.reply_notes and not _can_note_replies(person):
+    if own_change and body.reply_notes and not history.can_keep_notes(person):
         raise _refuse(
-            403, "not_available_yet",
-            "Notes from your replies need Act as me, which isn't available to you here.",
+            403, "not_available",
+            "Notes are kept for team members on the People list.",
         )
     try:
         company = (
```

**File**: `packages/core/openexecutive/architecture/architecture-facts.yaml` (modified, +34/-10)
```diff
@@ -2434,11 +2434,33 @@ memory:
 
   always_in_the_loop: |
     Always in the loop (memory.history, memory.history_notes,
-    orchestrator.history_tools, api/routes/history.py): private, dated notes of
-    what a person told people by email. Phase 1 has one source: a reply the
+    memory.history_chat, orchestrator.history_tools, api/routes/history.py):
+    private, dated notes of what a person said. Two sources: a reply the
     person approved and sent through Act as me (delegation.reply_send starts
-    history_notes.note_sent_reply in the background after the send). Why it is
-    shaped this way:
+    history_notes.note_sent_reply in the background after the send), and what
+    they type to the Executive in a chat where it knows it is them (the
+    post-turn block of stream_chat and stream_chat_with_committee calls
+    history_chat.schedule_chat_notes). Why it is shaped this way:
+    - One switch (history_person_settings.reply_notes, the name kept from
+      phase 1) covers every channel. Any team member on the People list may
+      turn it on (history.can_keep_notes); email notes still only come
+      through Act as me.
+    - Chat notes read only own_words(speaker_text) of a verified speaker:
+      caller_person_id is them, not unattended, private_to_principal, an
+      email turn or an eval override, on the web chat signed in (or local
+      login), their own Slack or Discord, a private Telegram chat with a
+      valid webhook secret, or a channel whose adapter set
+      Session.speaker_verified. Session.speaker_verified and
+      Session.private_chat are read only by Always in the loop, never as a
+      grant for anything else. Never another person's words, never the reply,
+      never a turn that touched the speaker's mailbox.
+    - Paced: messages under MIN_CHARS (40) are skipped and each person gets at
+      most MAX_PASSES_PER_DAY (40) passes a day, counted in the company DB
+      (history_chat_passes, history.take_pass) so the cap holds across
+      workers and restarts. CHAT_PROMPT says requests to the assistant, questions and
+      small talk are not notes; check_note runs with the message as body and
+      allowed words. Shared threads are noted too, but read back only in a
+      private chat.
     - Notes record events, never instructions. Code sets trust, visibility
       and the checks; the model writes only the summary sentence.
     - The note-taker reads only the person's own sent words
@@ -2459,13 +2481,14 @@ memory:
       history_excluded so it is never noted again. Conversations are keyed by
       a hash of channel and thread id.
     - recall_history is offered only when history_tools.recall_person finds
-      the speaker verified on a private surface, attended, not
-      private_to_principal, no eval override, with their switch on. Recall
+      the speaker verified (history_chat.verified_speaker), able to keep
+      notes, in a private chat (history_chat.private_chat, or
+      Session.private_chat), with their switch on. Act as me isn't needed. Recall
       sets touched_mail first, for the principal too (private rows, no
       memory, the lockdown from that round), and marks the conversation
       mail_private so later turns start the same way and, for a team
       member, the principal can't open it.
-    - Notes never feed Honcho, episodic extraction or standing facts. The four
+    - Notes never feed Honcho, episodic extraction or standing facts. The five
       history_* tables swap with client slots and the factory reset clears them.
 
 peer_memory:
@@ -2849,8 +2872,9 @@ peer_memory:
       per probe).
     people_overview: |
       ``GET /memories/people?recent=N`` (``honcho_client.people_overview``)
-      — what peer memory knows about each rostered person, for the Pulse
-      page's People tab. Read-only, no LLM call: one ``peers()`` listing
+      — what peer memory knows about the caller, for the Pulse page's
+      People tab: only the caller's own entry, the principal included (a
+      caller off the roster sees none; /conclusions 404s for anyone else). Read-only, no LLM call: one ``peers()`` listing
       (every page, under one 15 s clock — the SDK walk is otherwise bounded
       only per request), then per matched person (at most 8 in flight, each
       under the unscaled prefetch budget, because the reads share the
@@ -3708,7 +3732,7 @@ people:
     nothing to peer or department memory, and the principal's own peer
     memory answers only the principal (`ask_about_person` returns the empty
     answer on anyone else's turn; `/memories/people` and `/conclusions`
-    leave the principal out for anyone else). Still open: a row on the
+    show each caller only their own entry, the principal included). Still open: a row on the
     principal's own turn that names a contact some other way than their
     address, full name, person id or chat id (a first name, a nickname)
     is not recognised and stays readable by everyone.
```

**File**: `packages/core/openexecutive/architecture/prebuilt/agents.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "agents",
   "title": "Agent Council",
-  "markdown": "The Executive (`openexecutive.orchestrator.executive.Executive`) is a single coherent persona that fans out to specialist sub-agents via Anthropic tool use. Each specialist subclasses `openexecutive.agents.base.BaseAgent`, carrying a `name`, `domain`, and `model`, and exposes `analyze(...)`, which wraps the question in user-turn context and calls Claude through the per-call provider. That context is per call and never cached: `<company_stage>` (the stage from the company profile — specialists never see the profile itself), in solo mode `<principal_role>` (what kind of principal the advice is for, in plain words, with their title and remit — `router.principal_role_context`), `<department_memory>`, `<past_decisions>`, `<failure_cases>`, `<relevant_knowledge>` and `<conversation_context>`, outermost first. The specialist's own system prompt is a static domain constant under one `cache_control` block, so it stays byte-identical across companies and profile edits. A chat turn takes the stage from its session's profile (the one the Executive reasons over, and the one an eval scenario injects); workflow steps and the MCP server's `consult_specialist` read it fresh from the profile on disk. The role tag follows the turn's mode: a chat turn pins the role on its session with the mode (`pin_turn_principal_role`: the session's `principal_role` override, else the workspace settings) and sends it in solo and nothing in team, so the org block, every specialist in the turn and any workflow the turn starts see the same role; callers with no chat turn read it fresh (`load_principal_role`: the current session's mode and role, else the workspace's), and a failed read sends no tag rather than failing the consult. The CFO, CSO and sales prompts key their advice on it: for a bootstrapped, self-funded or solo company they drop venture fundraising benchmarks and work from cash, and raise only if the founder wants to.\n\nRouting uses one `consult_specialist` tool. Beside it the Executive carries its skill tools (`search_skills`, `load_skill`, `create_skill`, `update_skill`, `delete_skill` — shown to users as **playbooks**; `create_skill` / `update_skill` / `delete_skill` never change the library — they save a draft (`knowledge/skill_drafts.py`) that a person approves on the Playbooks tab, and the reply links to it; `update_skill` / `delete_skill` (and `create_skill`, for a name a workflow still follows) refuse any built-in name (including a company's customized copy) and any company playbook a workflow (even a switched-off custom one) follows — workflows read playbooks at run time, approved scheduled ones included, and this loop also runs on inbound email and chat, so only a person on the Playbooks tab can change what a workflow follows; a hidden built-in is invisible to search and load; each `search_skills` hit lists the `workflows` that follow it, and the persona routes \"the finished deliverable\" to that workflow and quick or partial asks to the playbook inline); Tool calls made while proactive work is tagged (scheduler dispatch, reflection, research, alert review) feed the Attunement outcome ledger. Goals have three tools: `list_department_goals`, `update_department_goal` (progress the user reports) and `create_goal` (a new goal the principal states, filed under an area by slug or title and creating the area when none matches — see Org). `create_goal` runs only for the principal on a verified surface, and no unattended run is offered it: the tools in `schedule_tools.UNATTENDED_WITHHELD_TOOLS` are dropped from reflection's and research's toolkits by `unattended_toolkit`, and from the chat loop when its Session is marked `unattended` — the scheduler's PROACTIVE TRIGGER run, whose prompt quotes stored intent text; a call the model emits anyway gets an error tool_result. `record_decision_outcome` records how a past decision turned out — the weekly review lists decisions older than 30 days with no outcome as `[decision N]` — writing `decisions.outcome` (`episodic.update_decision`) and auditing the rationale; it has `create_goal`'s gate (the principal on a verified surface only; everyone else gets an audited refusal) and is in `UNATTENDED_WITHHELD_TOOLS` too. A missing or unknown id returns the decisions still waiting on an outcome, so the model can retry with the right one. Its schema is static; the solo persona has one line on it, and team mode learns it from the tool description, so the team persona is byte-identical. Attunement adds `list_open_loops` (what a person owes — everyone's for the principal only in a private conversation, otherwise the caller's own) and `close_open_loop`, which only closes a loop when the turn's resolved speaker is the principal or the loop's owner — an unrostered sender, a signed-in web user not on the roster, and unattended sessions are refused. `assign_open_loop` opens one on request (\"ask Ben to send me the Q
```

**File**: `packages/core/openexecutive/architecture/prebuilt/caching.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "caching",
   "title": "Prompt Caching",
-  "markdown": "The Executive system prompt is partitioned for Anthropic prompt caching by `openexecutive.prompts.cache_manager.build_system_blocks`. It emits at most two `cache_control` blocks, consolidated down from four to stay within Anthropic's 4-block API limit alongside the tool definitions and the agent loop's intra-turn marker.\n\n- **Block 0 — persona + knowledge (1h TTL, always present):** the executive persona constant — `EXECUTIVE_PERSONA_PROMPT` for a team, `EXECUTIVE_PERSONA_SOLO_PROMPT` in solo mode — or an admin override, which wins as-is in either mode, with the `{VOICE_PERSONA}` substitution, then the admin's Council **additional instructions** for the Executive (`persona_instructions`, wrapped in `<additional_instructions>`; blank leaves the block byte-identical, and like the override it changes only on save), conditional `WEB_SEARCH_ADDENDUM` / `MCP_ADDENDUM`, the identity addendum (exec name/email, impersonation guard), the *Connected Systems* section, the constant `DELEGATION_ADDENDUM` while anyone on the install has Act as me on, the timezone addendum, and `KNOWLEDGE_INDEX_SUMMARY`. The timezone addendum names the user's zone, read fresh on every build from the workspace settings (`memory.workspace_settings.get_user_timezone`: the workspace's zone, else `USER_TIMEZONE`, else UTC). Every component is a constant or changes only when an admin or the user changes a setting, so the TTL is long. Setting a new time zone changes the addendum, so the 1h block misses once on that change and is warm again from the next turn — accepted, since a stale zone would mis-schedule follow-ups. Act as me works the same way: its addendum is keyed on the install-level setting (`delegation.settings.block0_delegation_on`), never on the turn or the speaker, so switching it on or off misses the 1h block once; off, block 0 is byte-identical to an install without the feature.\n  The *Connected Systems* section (`prompts.connected_systems.render_connected_systems`) tells the model what is connected so it never has to discover it: Google Workspace on or off (on only when `google_workspace` is among the servers the running gateway started with, `MCPGateway.server_names`, so a gateway that failed to start never reads as connected), and when on, how to act from its own account plus the pinned Google tool names by service (`GOOGLE_TOOL_MANIFEST`: Gmail, Calendar, Drive, Docs, Sheets, as workspace-mcp 1.29.0 names them) to call directly; any other configured MCP servers by name (`_comment` keys skipped); Slack / Discord / Telegram / Google Chat on or off from their settings (names only, never a token); Notion knowledge sync; a Confluence knowledge sync line only when that sync is on (a setting, so constant per deployment); and one constant Act as me line that points at `DELEGATION_ADDENDUM`, so switching Act as me still changes block 0 by that addendum alone. The \"never ask which address to send from\" guidance lives here now, shown only while Google is connected; the identity addendum keeps the name, address and impersonation guard. Every input is fixed per process and the output is sorted, so block 0 stays warm; it is appended even under a persona override. It replaces what the model used to learn from `search_tools`, an uncached proxy whose results were gone by the next turn.\n- **Block 1 — company + org (5m TTL, only if non-empty):** `company_profile.to_prompt_block()` plus `render_org_block(mode=…)` — for a team: departments, heads, principals, charters and the People roster; in solo: the principal's own line, their role lines when set (a static lead-in marking the role private to the principal, then kind in plain words, title, reports to, remit, measured on — from the role pinned for the turn: the workspace settings, or a session's `principal_role` override), and their goals grouped by area. The role is set once per install and changes only when the principal edits it, so it is as stable as the rest of the block. Shorter TTL so org edits propagate quickly. The principal's contacts are private to them, so `build_system_blocks(include_contacts=...)` adds the `## Contacts` section, after the team or solo block, only on the principal's own verified turn (`executive._contacts_in_prompt`). That gives block 1 exactly two stable variants per mode — with and without contacts — and never anything per-request; every other turn's block is byte-identical to an install with no contacts.\n\n## Solo mode: one prefix per mode\n\nSolo mode — one person using Open Executive for themselves — changes three cached parts, all resolved **once per turn** by `pin_turn_workspace_mode(session)` (the session's override, else the workspace setting) so they always agree: the block-0 persona, the block-1 org block, and the tool list, which drops `send_company_broadcast`, `send_department_message` and `set_department_head` *before* the sort, so it stays sorted and keep
```

**File**: `packages/core/openexecutive/architecture/prebuilt/delegation.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "delegation",
   "title": "Act as Me (Delegation)",
-  "markdown": "The **delegation** module (`openexecutive.delegation`) is **Act as me**: the one place the Executive writes *as* a person instead of as itself. Everywhere else it has its own Google account and bots and signs as itself. Here — when the person asks, or, with a second switch, for mail in their inbox that needs them — it writes an email in their voice and saves it as a **draft in their own mailbox** — Gmail or Outlook — for them to review and send. The one thing it ever sends is one of those inbox drafts, exactly as it is in their mailbox, when the person taps **Send** on its card; chat never sends. The principal can turn it on for themselves, and so can each team member once the owner lets them. It is off by default, and off changes nothing: the prompts, tool lists and prompt caches are byte-identical to an install without it.\n\n## Who can have it, and when it is offered\n\n`delegation.settings.can_delegate(person)` is the single rule for who may turn it on: the principal (a non-archived team member flagged `is_principal`), and any other non-archived team member — never a contact — once team members may have it (`team_members_enabled`). That takes two things: the install allows it (`DELEGATION_TEAM_MEMBERS`, default off, which offers the owner the switch) and the owner turned on **Let team members use it** (`PUT /delegation/team`, principal only, one row in `delegation_team`). Turning the owner's switch off takes it away from every team member from their next message, and their inbox watchers stop at their next check; their own switches, drafts and cards are kept. Everything is keyed by `person_id`. A person turns it on for themselves (`PUT /delegation`); nobody turns it on for anyone else. The setting is one row per person in `delegation_settings`, and a missing, unreadable or zero row all mean off.\n\nAt the start of every chat turn (`Executive.stream_chat` and the committee path) `pin_turn_delegation(session, speaker_text)` runs next to the workspace-mode pin and records a `TurnDelegation` on the session. `ghostwrite_email` is **offered** only when all of these hold:\n\n- the speaker may have it and turned it on — read fresh every turn, so turning it off applies from the next message;\n- the speaker is on a surface that verified it is them — the principal through `people_tools.is_principal_on_verified_surface`, a team member through `teammate_on_verified_surface` (the web app signed in, their own Slack or Discord, never an email turn) — and a web turn also carried a signed-in caller (`Session.web_caller_signed_in`, set from `x-caller-email`) or runs under local login — a request with no caller header is not a sign-in and never gets it (whoever holds the shared secret is trusted as the UI proxy that stamps that header, as on every principal-only route);\n- the conversation is private to the speaker: the web chat, a Slack or Discord DM, or a verified private Telegram chat — never a shared channel or thread, where the draft's preview or the matching threads would be posted for everyone and other people's messages sit in the model's context;\n- the turn is neither unattended (the scheduler's proactive run) nor private to the principal (the email poller's turns), so inbound text can never reach it. The MCP server, workflows, reflection and research never carry it at all.\n\nThe mailbox connection is deliberately **not** part of the offer: the handler checks it on every call and says how to fix it, so the cached tool prefix never flips when a token lapses. The pin lives in a context variable for the turn's task as well as on the session, so two turns running at once on one session (a second browser tab) each read their own. It also carries the speaker's own words for the turn (a new email may go to an address they just typed — the turn's message joins the history only once the turn ends), a per-turn draft count, and `touched_mail` (see Privacy). `own_words` reads those words back for every own-words check (addresses here, facts and task assignments elsewhere): it first removes the hydrated `<outbound_reply_context>` backstory by its exact, anchored shape, so a look-alike closing tag quoted inside it cannot pass the rest off as the speaker's, then drops other adapter tag blocks, and returns nothing for a message carrying an attachment.\n\n## The tool: `ghostwrite_email`\n\nIt lives in its own registry (`orchestrator.delegation_tools.DELEGATION_TOOLS` / `DELEGATION_TOOL_HANDLERS`), **never** `_ALL_SKILL_TOOLS`, so no other toolkit can carry it. On a turn it is offered to, the agent loop adds it to the pool *before* the sort and builds that turn's handler map from both registries; on any other turn a call to it is an unknown tool. The handler re-checks the pin and the surface anyway, then:\n\n1. **Caps** — at most 5 drafts per turn, and `DELEGATION_MAX_DRAFTS_PER_DAY` (default 50, at most 1000) per person per UT
```

**File**: `packages/core/openexecutive/architecture/prebuilt/memory.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "memory",
   "title": "Memory System",
-  "markdown": "The Executive's durable memory is an episodic SQLite store at `./episodic_memory.db`, managed by `openexecutive.memory.episodic`. It holds four tables:\n\n- `decisions` — choices made, with `domain`, `summary`, `rationale`, `outcome`, and `tags`. `outcome` is filled in when the principal says how a decision turned out — the `record_decision_outcome` chat tool (principal on a verified surface only) or the Memories page. The weekly review reads this table twice: the week's decisions (`decisions_since`) and up to three older than 30 days with no outcome yet (`decisions_awaiting_outcome`), which it asks about.\n- `initiatives` — tracked efforts with a `status` and `summary` (idempotent upserts).\n- `advice_given` — query/advice pairs per domain.\n- `scheduled_actions` — a dispatch queue, treated separately from recall memory. `cancel_scheduled_action` guards its UPDATE on `status = 'pending'`, so a cancel never overwrites a row the scheduler claimed a moment earlier.\n\n### What gets extracted, and when\n\n`episodic.extract_and_store` runs after a turn and asks a utility-fast model for decisions, initiatives and advice. Every candidate must carry a `user_commitment_quote` that appears verbatim in the principal's own message (`_is_valid_user_commitment`) — the turn's speaker text (`memory_text` when the entry point supplies one, else the prompt), so a quoted Executive email or a briefing card's body inside the prompt cannot satisfy it — the model has repeatedly tried to log the Executive's *recommendations* as the user's commitments, and that quote is the hard gate against it.\n\nA turn reaches the extractor if `should_extract(speaker_text, session=...)` is true, which means only that the principal said something on a surface that proved it was them — there is deliberately **no length floor**. There used to be one, on the combined user+assistant length, and on a live tenant it selected almost exactly the wrong turns: 9 of 16 exchanges were blocked, and the 9 held every instruction the principal gave, while the 7 admitted were long analytical exchanges with no commitment in them. The extractor ran 13 times and stored nothing.\n\nMoving that floor to the user's side would relocate the bug, not fix it. The canonical executive decision is a long analysis answered with \"Approve option B.\" (17 chars) or \"Do B.\" (5), and any floor high enough to skip \"Done\" (4) also skips those — \"Do B.\" and \"Done\" differ by one character and mean opposite things. Length cannot separate a decision from an acknowledgement; the verbatim-quote check can, so `_is_valid_user_commitment` is the gate that decides. The price is one utility-fast call on turns that propose nothing.\n\nThat quote check is only meaningful when `user_message` holds the **principal's** words, and on a chat channel it does not — `Executive.chat()` is reached from Slack, Discord, Telegram, Google Chat and the email poller. A teammate's line would be written to `decisions` with no speaker attached, indistinguishable from the principal's own; an inbound email body is text the sender chose, so a self-quote is free. Removing the length floor is what makes this bite — short channel traffic used to fall under it incidentally — so `should_extract` asks the untrusted-content policy (`orchestrator.content_trust.principal_speaking`) whether the principal is speaking. It names the principal's surfaces rather than inferring them: the web chat (signed in as the principal — or, on an install with no principal on the People page yet, a request that carried no sign-in; a signed-in email on nobody's entry, such as an archived teammate still allowed to sign in, is not the principal), the CLI (`Session.from_cli`), the principal's own Slack or Discord or a private Telegram chat with a valid webhook secret (`people_tools.is_principal_on_verified_surface`), and email from the principal's primary address that Gmail's own `Authentication-Results` marks `dmarc=pass` (`Session.email_authenticated`). Everything else fails closed: a teammate (on the web too), an unrostered sender, the principal's address on mail Gmail did not authenticate, Google Chat, the MCP server (its caller names themselves), unattended runs, and an unreadable roster. The rule used to be \"no `origin_channel` means the principal's own surface\", and the email poller left `origin_channel` empty, so every stranger's email ran through the extractor with its body — headers, quoted chain and all — as the principal's words, and whatever it stored rendered on every later turn. The poller now tags its sessions `origin_channel=\"email\"`, and the gate no longer reads an empty channel as trust.\n\nThe extractor also reads only the words **outside** every `<untrusted_content>` block (`schedule_extraction` runs `content_trust.strip_untrusted` first): an attached document's text is inlined in that block, so a sentence the principal did n
```

**File**: `packages/core/openexecutive/architecture/prebuilt/peer_memory.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "peer_memory",
   "title": "Peer Memory (Person + Department)",
-  "markdown": "An external, peer-keyed memory layer gives the Executive durable cross-channel recall, sitting on top of Honcho via `openexecutive.memory.honcho_client`. The `HONCHO_ENABLED` env var gates it; when false every entry point short-circuits with `outcome=disabled` and behavior matches the pre-Honcho posture.\n\n### Two scopes\n\n- **Per-person**, keyed by `Person.id` — a user chatting from Discord, Telegram, email, or web is one peer card, so facts shared in any channel surface in the others. Each entry point resolves the caller to a `Person.id` (channel-ID lookups for adapters; `x-caller-email` for web).\n- **Per-department**, keyed by `department_<slug>` — each department accumulates an institutional voice from dept-scoped decisions, advice, committee outcomes, and dept-bound specialist turns.\n\n### Private to the principal\n\nThe principal's contacts are private to them (see Org), and two rules keep them out of shared memory. A turn about the principal's private mail (`Session.private_to_principal`: mail from a contact, or mail the principal forwarded) writes nothing to peer or department memory — its reply summarises that mail. And the principal's own peer memory, drawn from all their conversations, answers only the principal: `ask_about_person` with `person_id` = the principal returns the empty \"no data\" answer on any turn but the principal's own verified one (a teammate's own view of the principal, `target_person_id` = the principal, is the teammate's memory and still answers), and `GET /memories/people` / `/conclusions` leave the principal out for anyone else.\n\n### Flow\n\n`prefetch` runs once per turn and injects a `<peer_memory>` block into the user turn (empty on timeout or error). `HONCHO_PREFETCH_MODE` picks how the block is produced. `representation` (the default) reads the person's peer card and the derived conclusions most relevant to the inbound message straight from Honcho (`peer.context(search_query=…)`, `HONCHO_PREFETCH_MAX_CONCLUSIONS` of them, default 20): a GET with no LLM behind it, about 100 ms self-hosted. The block keeps whole lines only, up to a size cap (a line that does not fit is dropped, never cut), strips control characters and defangs a literal closing tag, since conclusions derive from text anyone who can email the Executive wrote. A person Honcho knows nothing about yet yields no block and an `empty` audit outcome. `dialectic` asks Honcho's chat endpoint with the message as the question and injects the synthesized prose (an LLM call, seconds), where `reasoning_level` trades latency for depth. The mode applies to every per-person prefetch, committee turns included. Only `prefetch_department` (one dialectic question per consulted specialist that maps to a department, yielding `<department_memory>`) and the `ask_about_person` tool always use the chat endpoint: they are deliberate questions off the inline path, the split Honcho's own guidance draws between `context()` for per-turn grounding and `chat()` for reasoned answers. After the response, `sync_turn` and `sync_department_turn` persist the exchange as fire-and-forget background tasks that never block the user. The Executive's reply is written under an `executive` peer resolved with `observe_me=false`: the person's representation sees both sides of the exchange, but Honcho no longer derives a representation of the Executive itself, which nothing read and which is where a person's words were occasionally misattributed to the Executive. Both record the person's words only. Honcho derives facts about a person from everything posted under their peer, so a turn whose prompt carries text the person did not write passes `memory_text` to `Executive.chat` / `stream_chat` / `stream_chat_with_committee`, and that — not the prompt — is what both syncs post: an inbound email records the sender's new text, the attachment filenames and its subject unless that is a reply's or forward's (`Re:`, `Fwd:`, `AW:`, `SV:`, `Re[2]:`, `[EXT] Re:` … — the earlier message's subject, often the Executive's own) (never the \"You have an inbound email\" framing, the headers with the Executive's own address in `To:`, the `[POLICY]` notice or the quoted chain, which held the Executive's own earlier email and taught Honcho that the sender *was* the Executive); a web upload records the typed text and filenames, not the extracted document text; a briefing handoff records a short line of what the user asked, phrased as the user speaking and ended before the headline, which follows on its own line (\"Let's discuss this flagged artifact.\" / \"I approve this proposal.\" — an \"Asked to …\" line came back as \"<user> was asked to …\", and a \"?\" in a headline inside the sentence voided the extraction quote); approve-with-edits records the same short line without the edited text, which starts as the Executive's card body and is often sent unchanged
```

---

### Incident Patch 13: `29de6ca9` (2026-10-03)
**Commit Message**: feat(ui): move the Agent Council's Advanced toggle into the agent panel (#345)

<!-- ccr-projects-attribution: {"github_login":"johnrufusone"} -->
_Requested by **Rufus** · [project
thread](https://claude.ai/code/project/chan_01KdjdZHJtboAfcbRxDQxY2F?thread=cmsg_01KdjdZHJtboAfcbRxDQxY2FBUmUTi6o1odkB81U571tkb)_

## Problem

The Agent Council page has an Advanced button in its header, but on the
page itself it only shows a few more agents. What it really changes is
the agent panel, so it sits in the wrong place.

## Approach

- The page header loses the toggle. The page always shows Quality, Voice
and Your agents, with "Show all agents" revealing the helper agents.
- Each agent's panel opens in the simple editor and has an **Advanced
settings** button. That button widens the panel to the full tabs;
**Simple view** goes back. The choice is still remembered per browser
under the same key, and a draft survives switching.
- Helper agents with no instructions to edit (fast model, research
model) open straight in the tabbed editor.
- Listing and panel-mode logic moved to `lib/councilCards.ts` with node
tests. The guide and the voice picker's hint are updated.

## Checklist

- [x] Working i

**File**: `packages/core/openexecutive/guide/prebuilt/council.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "council",
   "title": "Agent Council",
-  "markdown": "**What it is:** The configuration hub for the specialists behind the Executive — the place to tune how each one thinks and how the Executive sounds.\n\n**What it does:**\n\n- Pick any agent and add instructions, or override its role, system prompt, model, or deep-reasoning toggle.\n- Set the Executive's **voice persona** — the tone it speaks to you in.\n- Test a draft configuration with a one-off query before committing.\n- View version history and roll back, or reset an agent to its built-in default.\n\n**How to use:**\n\n1. Open **Settings → Advanced → Agent Council**. It opens in a simple view: **Quality** at the top sets every agent's model and deep reasoning at once. Under **Your agents**, each main agent is a card with its area and model; an amber dot and **Has your instructions** mean you've already changed it. Click a card to open that agent in a panel with its **Additional instructions**, then click **Save** (or **Cancel**). **Show all agents** lists the internal ones too.\n2. For everything else, click **Advanced** at the top (the browser remembers it; **Back to simple view** returns). Click an agent's card; its panel splits the settings into tabs — **Model**, **Instructions**, **Prompt**, **Test** and **History**:\n   - **Role** — its one-line job description.\n   - **Model** — provider and model; the default is marked *(default)*.\n   - **Deep reasoning** — slower, more thorough thinking (not available on Haiku models).\n   - **Additional instructions** — a few lines added after its built-in prompt, such as \"Quote figures in EUR\". The agent keeps getting improvements to its built-in prompt. Clear the box to remove them.\n   - **System prompt** — its full instructions. Editing it replaces the built-in prompt, so later improvements to it won't reach this agent; prefer **Additional instructions** when you can. **Restore default prompt in editor** brings the original back.\n   - **Research focus** — specialists only.\n3. Try it before saving: on the **Test** tab, under **Test this draft**, type a question and click **Run test**. It uses your unsaved settings and changes nothing.\n4. Click **Save** at the bottom of the panel. The change applies on the next call.\n5. To undo, choose **Reset to default** in the **⋯** menu at the bottom of the agent's panel, or open the **History** tab and click **Restore** on an earlier version.\n\n*Change the Executive's voice:* pick one under **Voice** on **Settings → Your Executive**. To write your own, open the Council's **Advanced** view, click the **Executive** card and open the **Prompt** tab: **Voice Persona** there has the **Active persona** (save it with the main **Save**), and **+ New**, which asks for a display name and a persona body — then click **Create** — or **Duplicate** an existing persona and edit the copy.\n\n**Example persona body:**\n\n```\n- Direct and brief; lead with the recommendation, then the reasoning\n- Plain English, no jargon or buzzwords\n- Numbers over adjectives\n- End with the one decision you need from me\n```\n\n*Note: changes take effect on the next call — no restart needed. This is a power-user surface under Settings.*",
+  "markdown": "**What it is:** The configuration hub for the specialists behind the Executive — the place to tune how each one thinks and how the Executive sounds.\n\n**What it does:**\n\n- Pick any agent and add instructions, or override its role, system prompt, model, or deep-reasoning toggle.\n- Set the Executive's **voice persona** — the tone it speaks to you in.\n- Test a draft configuration with a one-off query before committing.\n- View version history and roll back, or reset an agent to its built-in default.\n\n**How to use:**\n\n1. Open **Settings → Advanced → Agent Council**. **Quality** at the top sets every agent's model and deep reasoning at once. Under **Your agents**, each main agent is a card with its area and model; an amber dot and **Has your instructions** mean you've already changed it. **Show all agents** lists the internal and helper agents too (**Show fewer agents** hides them again). Click a card to open that agent in a panel with its **Additional instructions**, then click **Save** (or **Cancel**).\n2. For everything else, click **Advanced settings** at the top of the agent's panel (the browser remembers it for every agent; **Simple view** returns, and unsaved edits carry over). The helper agents that are only a model setting (the fast utility model and the research model) always open here. The panel widens and splits the settings into tabs — **Model**, **Instructions**, **Prompt**, **Test** and **History**:\n   - **Role** — its one-line job description.\n   - **Model** — provider and model; the default is marked *(default)*.\n   - **Deep reasoning** — slower, more thorough thinking (not available on Haiku models).\n   - **Additional instructions** — a few lines added after its built-in prompt,
```

**File**: `packages/ui/scripts/councilCards.test.mjs` (modified, +28/-0)
```diff
@@ -4,7 +4,10 @@ import {
   agentArea,
   agentCardStatus,
   agentDisplayName,
+  agentHasNoInstructions,
   agentInitials,
+  listedAgents,
+  panelOpensAdvanced,
   shortModelName,
 } from "../src/lib/councilCards.ts";
 
@@ -53,3 +56,28 @@ test("status: instructions, custom model or default", () => {
   assert.equal(agentCardStatus(true, ["model", "use_deep_reasoning"], false), "default");
   assert.equal(agentCardStatus(true, ["model"], true), "custom-model");
 });
+
+test("listed agents: core ones first, every agent once shown all", () => {
+  const agents = [
+    { name: "executive", visibility: "core" },
+    { name: "cfo", visibility: "core" },
+    { name: "triage", visibility: "internal" },
+    { name: "utility_fast", visibility: "internal" },
+    { name: "research", visibility: "internal" },
+  ];
+  assert.deepEqual(listedAgents(agents, false).map((a) => a.name), ["executive", "cfo"]);
+  assert.deepEqual(
+    listedAgents(agents, true).map((a) => a.name),
+    ["executive", "cfo", "triage", "utility_fast", "research"],
+  );
+});
+
+test("panel mode: helper agents always open the full editor", () => {
+  assert.equal(agentHasNoInstructions("utility_fast"), true);
+  assert.equal(agentHasNoInstructions("research"), true);
+  assert.equal(agentHasNoInstructions("cfo"), false);
+  assert.equal(panelOpensAdvanced("cfo", false), false);
+  assert.equal(panelOpensAdvanced("cfo", true), true);
+  assert.equal(panelOpensAdvanced("utility_fast", false), true);
+  assert.equal(panelOpensAdvanced("research", false), true);
+});
```

**File**: `packages/ui/src/app/council/page.tsx` (modified, +72/-64)
```diff
@@ -37,7 +37,10 @@ import {
   agentArea,
   agentCardStatus,
   agentDisplayName,
+  agentHasNoInstructions,
   agentInitials,
+  listedAgents as listAgentsShown,
+  panelOpensAdvanced,
   shortModelName,
 } from "@/lib/councilCards";
 
@@ -108,7 +111,9 @@ function personaOption(p: PersonaMeta) {
   );
 }
 
-// Remembers, per browser, that the owner prefers the full editor.
+// Remembers, per browser, that the owner prefers the agent panel's full
+// editor. The key predates the panel toggle (it was the page's Advanced
+// view), so returning owners keep their choice.
 const ADVANCED_KEY = "oe.council.advanced";
 
 // The full editor's tabs for the selected agent. Each shows only where the
@@ -181,14 +186,13 @@ export default function CouncilPage() {
   const [tab, setTab] = useState<EditorTab>("model");
 
   const [presets, setPresets] = useState<QualityPresets | null>(null);
-  // The Council opens in its simple view: Quality and the core agents with
-  // their additional instructions (the voice is chosen in Settings → Your
-  // Executive). "Show all agents" lists the
-  // internal ones too; "Advanced" opens the full editor, and this browser
+  // The Council shows Quality and the core agents (the voice is chosen in
+  // Settings → Your Executive). "Show all agents" lists the internal and
+  // helper ones too. An agent's panel opens on its additional instructions;
+  // "Advanced settings" in the panel opens the full editor, and this browser
   // remembers that choice.
   const [showAll, setShowAll] = useState(false);
-  const [advanced, setAdvanced] = useState(false);
-  const simple = !advanced;
+  const [prefersAdvanced, setPrefersAdvanced] = useState(false);
   const [applyingPreset, setApplyingPreset] = useState<QualityPresetId | null>(null);
 
   const [saving, setSaving] = useState(false);
@@ -249,15 +253,17 @@ export default function CouncilPage() {
 
   useEffect(() => {
     try {
-      if (window.localStorage.getItem(ADVANCED_KEY) === "1") setAdvanced(true);
+      if (window.localStorage.getItem(ADVANCED_KEY) === "1") setPrefersAdvanced(true);
     } catch {
-      // Storage can be blocked; the page then opens in the simple view.
+      // Storage can be blocked; panels then open in the simple editor.
     }
   }, []);
 
-  const toggleAdvanced = () => {
-    const next = !advanced;
-    setAdvanced(next);
+  // The open panel's mode. A helper agent has only the full editor.
+  const advanced = selected ? panelOpensAdvanced(selected, prefersAdvanced) : prefersAdvanced;
+
+  const setPanelAdvanced = (next: boolean) => {
+    setPrefersAdvanced(next);
     try {
       window.localStorage.setItem(ADVANCED_KEY, next ? "1" : "0");
     } catch {
@@ -278,7 +284,7 @@ export default function CouncilPage() {
       .catch(() => {});
   };
 
-  const listedAgents = simple && !showAll ? agents.filter((a) => a.visibility === "core") : agents;
+  const listedAgents = listAgentsShown(agents, showAll);
 
   useEffect(() => {
     if (selected) loadDetail(selected);
@@ -522,7 +528,7 @@ export default function CouncilPage() {
         .filter(Boolean)
         .join(" · ")
     : undefined;
-  const noInstructions = detail?.name === "utility_fast" || detail?.name === "research";
+  const noInstructions = detail ? agentHasNoInstructions(detail.name) : false;
 
   const saveButton = (
     <Button variant="primary" onClick={handleSave} disabled={saving || !dirty || !detail}>
@@ -559,16 +565,11 @@ export default function CouncilPage() {
     <div className="flex-1 min-h-0 min-w-0 overflow-y-auto bg-surface text-fg">
       <div className="max-w-5xl mx-auto px-4 py-6 sm:px-8 sm:py-10 space-y-6">
         <div>
-          <div className="flex items-start justify-between gap-4">
-            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">Agent Council</h1>
-            <Button variant="secondary" size="sm" onClick={toggleAdvanced}>
-              {advanced ? "Back to simple view" : "Advanced"}
-            </Button>
-          </div>
+          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">Agent Council</h1>
           <p className="mt-2 text-[15px] text-fg-muted">
-            {simple
-              ? "Pick how thorough answers should be and add instructions for any agent. Changes apply on the next message."
-              : "Edit each specialist’s prompt, model, and behavior. Changes apply on the next specialist call — no restart needed. Resetting restores the built-in defaults."}
+            Pick how thorough answers should be and add instructions for any agent. Open an
+            agent&apos;s Advanced settings to change its model, prompt and more. Changes apply on
+            the next message.
           </p>
         </div>
 
@@ -628,19 +629,17 @@ export default function CouncilPage() {
           </section>
         )}
 
-        {simple && (
-          <Link
-            href="/settings/executive"
-            className="group flex items-center just
```

**File**: `packages/ui/src/components/executive/VoicePicker.tsx` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ export default function VoicePicker({ variant, onDone }: Props) {
         <p className="mt-3 text-sm text-fg-subtle">
           {saving
             ? "Saving…"
-            : "Applies from the next message. Custom voices are made under Agent Council → Advanced."}
+            : "Applies from the next message. Custom voices are made in Agent Council → Executive → Advanced settings."}
         </p>
       )}
 
```

**File**: `packages/ui/src/lib/councilCards.ts` (modified, +25/-0)
```diff
@@ -117,3 +117,28 @@ export function agentCardStatus(
   if (overriddenFields.some((f) => !PRESET_FIELDS.has(f))) return "instructions";
   return differsFromPreset ? "custom-model" : "default";
 }
+
+/**
+ * The agents "Your agents" lists: the core ones, or every agent (the
+ * internal and helper ones too) once the owner clicks "Show all agents".
+ */
+export function listedAgents<T extends { visibility: string }>(agents: readonly T[], showAll: boolean): T[] {
+  return showAll ? [...agents] : agents.filter((a) => a.visibility === "core");
+}
+
+// The helper agents that are only a model setting: they have no instructions
+// to edit, so the simple editor has nothing for them.
+const MODEL_ONLY_AGENTS = new Set(["utility_fast", "research"]);
+
+/** True for a helper agent with no instructions to edit (only a model). */
+export function agentHasNoInstructions(name: string): boolean {
+  return MODEL_ONLY_AGENTS.has(name);
+}
+
+/**
+ * Whether the agent panel shows the full tabbed editor: when this browser
+ * prefers it, and always for a helper agent, whose settings live only there.
+ */
+export function panelOpensAdvanced(name: string, prefersAdvanced: boolean): boolean {
+  return prefersAdvanced || agentHasNoInstructions(name);
+}
```

---

### Incident Patch 14: `870ff2b1` (2026-10-03)
**Commit Message**: feat(ui): add the History tab and settings for Always in the loop (#344)

## Problem

The notes Always in the loop keeps from replies people approve and send
(#342) had no screens. Nobody could see their notes, correct, pin or
forget them, turn the feature on, or set how long notes last.

## Approach

- **History** is the last tab in Pulse → Memory. It shows only the
signed-in person's own notes, with search. Each row's menu has Correct
(a side panel), Pin, Don't remember this and Forget. The tab is hidden
for anyone with no notes to see.
- **Settings → Act as me** gets "Keep track of what happens": the
person's switch, plus an optional shorter time for their own notes.
- **Settings → Memory** is a new tile and page for how long notes last
for everyone. The owner changes it; everyone else sees it read-only.
- The pure wording helpers live in `lib/history.ts` and have tests in
`scripts/history.test.mjs`.
- The memory architecture section now describes the screens.

## Checklist

- [x] Working implementation — no stubs or TODO placeholders
- [x] Tests added/updated for new behavior (`scripts/history.test.mjs`,
`navConfig.test.mjs`)
- [x] `ruff check` and `mypy` pass (`make lint`)
- [

**File**: `packages/core/openexecutive/architecture/prebuilt/memory.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "memory",
   "title": "Memory System",
-  "markdown": "The Executive's durable memory is an episodic SQLite store at `./episodic_memory.db`, managed by `openexecutive.memory.episodic`. It holds four tables:\n\n- `decisions` — choices made, with `domain`, `summary`, `rationale`, `outcome`, and `tags`. `outcome` is filled in when the principal says how a decision turned out — the `record_decision_outcome` chat tool (principal on a verified surface only) or the Memories page. The weekly review reads this table twice: the week's decisions (`decisions_since`) and up to three older than 30 days with no outcome yet (`decisions_awaiting_outcome`), which it asks about.\n- `initiatives` — tracked efforts with a `status` and `summary` (idempotent upserts).\n- `advice_given` — query/advice pairs per domain.\n- `scheduled_actions` — a dispatch queue, treated separately from recall memory. `cancel_scheduled_action` guards its UPDATE on `status = 'pending'`, so a cancel never overwrites a row the scheduler claimed a moment earlier.\n\n### What gets extracted, and when\n\n`episodic.extract_and_store` runs after a turn and asks a utility-fast model for decisions, initiatives and advice. Every candidate must carry a `user_commitment_quote` that appears verbatim in the principal's own message (`_is_valid_user_commitment`) — the turn's speaker text (`memory_text` when the entry point supplies one, else the prompt), so a quoted Executive email or a briefing card's body inside the prompt cannot satisfy it — the model has repeatedly tried to log the Executive's *recommendations* as the user's commitments, and that quote is the hard gate against it.\n\nA turn reaches the extractor if `should_extract(speaker_text, session=...)` is true, which means only that the principal said something on a surface that proved it was them — there is deliberately **no length floor**. There used to be one, on the combined user+assistant length, and on a live tenant it selected almost exactly the wrong turns: 9 of 16 exchanges were blocked, and the 9 held every instruction the principal gave, while the 7 admitted were long analytical exchanges with no commitment in them. The extractor ran 13 times and stored nothing.\n\nMoving that floor to the user's side would relocate the bug, not fix it. The canonical executive decision is a long analysis answered with \"Approve option B.\" (17 chars) or \"Do B.\" (5), and any floor high enough to skip \"Done\" (4) also skips those — \"Do B.\" and \"Done\" differ by one character and mean opposite things. Length cannot separate a decision from an acknowledgement; the verbatim-quote check can, so `_is_valid_user_commitment` is the gate that decides. The price is one utility-fast call on turns that propose nothing.\n\nThat quote check is only meaningful when `user_message` holds the **principal's** words, and on a chat channel it does not — `Executive.chat()` is reached from Slack, Discord, Telegram, Google Chat and the email poller. A teammate's line would be written to `decisions` with no speaker attached, indistinguishable from the principal's own; an inbound email body is text the sender chose, so a self-quote is free. Removing the length floor is what makes this bite — short channel traffic used to fall under it incidentally — so `should_extract` asks the untrusted-content policy (`orchestrator.content_trust.principal_speaking`) whether the principal is speaking. It names the principal's surfaces rather than inferring them: the web chat (signed in as the principal — or, on an install with no principal on the People page yet, a request that carried no sign-in; a signed-in email on nobody's entry, such as an archived teammate still allowed to sign in, is not the principal), the CLI (`Session.from_cli`), the principal's own Slack or Discord or a private Telegram chat with a valid webhook secret (`people_tools.is_principal_on_verified_surface`), and email from the principal's primary address that Gmail's own `Authentication-Results` marks `dmarc=pass` (`Session.email_authenticated`). Everything else fails closed: a teammate (on the web too), an unrostered sender, the principal's address on mail Gmail did not authenticate, Google Chat, the MCP server (its caller names themselves), unattended runs, and an unreadable roster. The rule used to be \"no `origin_channel` means the principal's own surface\", and the email poller left `origin_channel` empty, so every stranger's email ran through the extractor with its body — headers, quoted chain and all — as the principal's words, and whatever it stored rendered on every later turn. The poller now tags its sessions `origin_channel=\"email\"`, and the gate no longer reads an empty channel as trust.\n\nThe extractor also reads only the words **outside** every `<untrusted_content>` block (`schedule_extraction` runs `content_trust.strip_untrusted` first): an attached document's text is inlined in that block, so a sentence the principal did n
```

**File**: `packages/ui/scripts/history.test.mjs` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+import {
+  counterpartName,
+  kindLabel,
+  noteExpiry,
+  noteText,
+  noteWhere,
+  personRetentionChoices,
+  retentionLabel,
+} from "../src/lib/history.ts";
+
+const CHOICES = [30, 90, 365, null];
+
+test("retention reads as people say it", () => {
+  assert.equal(retentionLabel(30), "30 days");
+  assert.equal(retentionLabel(365), "1 year");
+  assert.equal(retentionLabel(null), "until forgotten");
+});
+
+test("a person may only pick the company default or something shorter", () => {
+  assert.deepEqual(personRetentionChoices(CHOICES, 90), [null, 30]);
+  assert.deepEqual(personRetentionChoices(CHOICES, 30), [null]);
+  assert.deepEqual(personRetentionChoices(CHOICES, 365), [null, 30, 90]);
+  // Kept until forgotten for the company: every length is shorter.
+  assert.deepEqual(personRetentionChoices(CHOICES, null), [null, 30, 90, 365]);
+  // Their own choice stays on offer, even once the company's caught up with it.
+  assert.deepEqual(personRetentionChoices(CHOICES, 30, 30), [null, 30]);
+  assert.deepEqual(personRetentionChoices(CHOICES, 90, 30), [null, 30]);
+});
+
+test("a note names who it was with, never the bare address when there's a name", () => {
+  assert.equal(counterpartName("Dana Lee <dana@acme.example>"), "Dana Lee");
+  assert.equal(counterpartName('"Lee, Dana" <dana@acme.example>'), "Lee, Dana");
+  assert.equal(counterpartName("dana@acme.example"), "dana@acme.example");
+  assert.equal(counterpartName("<dana@acme.example>"), "dana@acme.example");
+  assert.equal(noteWhere({ channel: "email", counterpart: "Dana Lee <dana@acme.example>" }), "Email with Dana Lee");
+  assert.equal(noteWhere({ channel: "email", counterpart: "" }), "Email");
+});
+
+test("their correction replaces the note's words", () => {
+  assert.equal(noteText({ summary: "Promised Friday.", correction: null }), "Promised Friday.");
+  assert.equal(noteText({ summary: "Promised Friday.", correction: "Promised Monday." }), "Promised Monday.");
+  assert.equal(noteText({ summary: "Promised Friday.", correction: "  " }), "Promised Friday.");
+});
+
+test("each note says when it goes", () => {
+  assert.equal(noteExpiry({ pinned: true, expires_at: null }), "Pinned: kept until you forget it");
+  assert.equal(noteExpiry({ pinned: false, expires_at: null }), "Kept until you forget it");
+  assert.equal(noteExpiry({ pinned: false, expires_at: "2026-12-30T09:00:00+00:00" }), "Forgotten on 2026-12-30");
+  assert.equal(kindLabel("promised"), "Promised");
+});
```

**File**: `packages/ui/scripts/navConfig.test.mjs` (modified, +2/-0)
```diff
@@ -183,6 +183,7 @@ test("the Settings hub: one tile per page, each with its own route", () => {
     [
       "Your Executive → /settings/executive",
       "Act as me → /settings/act-as-me",
+      "Memory → /settings/memory",
       "Workspace → /settings/workspace",
       "Advanced → /settings/advanced",
       "About → /settings/about",
@@ -202,6 +203,7 @@ test("old /settings#anchors land on the matching page", () => {
   assert.equal(to("#executive"), "/settings/executive");
   assert.equal(to("#workspace"), "/settings/workspace");
   assert.equal(to("act-as-me"), "/settings/act-as-me");
+  assert.equal(to("#memory"), "/settings/memory");
   assert.equal(to("#tools"), "/settings/advanced");
   for (const g of ADVANCED_GROUPS) assert.equal(to(`#tools-${g.key}`), "/settings/advanced");
   assert.equal(to("#about"), "/settings/about");
```

**File**: `packages/ui/src/app/settings/act-as-me/page.tsx` (modified, +2/-1)
```diff
@@ -3,7 +3,8 @@
 import ActAsMeCard, { ACT_AS_ME_INTRO } from "@/components/settings/ActAsMeCard";
 import SettingsSubpage from "@/components/settings/SettingsSubpage";
 
-// Settings → Act as me: drafts written as you, in your own mailbox.
+// Settings → Act as me: drafts written as you, in your own mailbox, and
+// whether the Executive keeps notes of the replies you send.
 export default function ActAsMeSettingsPage() {
   return (
     <SettingsSubpage title="Act as me" description={ACT_AS_ME_INTRO}>
```

**File**: `packages/ui/src/app/settings/memory/page.tsx` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+"use client";
+
+import { CompanyRetentionCard } from "@/components/settings/HistorySettings";
+import SettingsSubpage from "@/components/settings/SettingsSubpage";
+
+// Settings → Memory: how long the private notes Always in the loop keeps last.
+export default function MemorySettingsPage() {
+  return (
+    <SettingsSubpage
+      title="Memory"
+      description="The Executive keeps private notes of what people said in replies they approved and sent, so it can remind them later. Each person sees only their own."
+    >
+      <CompanyRetentionCard />
+    </SettingsSubpage>
+  );
+}
```

**File**: `packages/ui/src/app/settings/page.tsx` (modified, +33/-4)
```diff
@@ -15,11 +15,20 @@ import {
   type SettingsPageId,
 } from "@/components/shell/navConfig";
 import { useWorkspace } from "@/components/workspace/WorkspaceContext";
-import { getAgentDetail, getDelegation, getVersion, listPersonas, type DelegationSettings } from "@/lib/api";
+import {
+  getAgentDetail,
+  getDelegation,
+  getHistory,
+  getVersion,
+  listPersonas,
+  type DelegationSettings,
+  type HistoryState,
+} from "@/lib/api";
+import { retentionLabel } from "@/lib/history";
 import { versionNotice } from "@/lib/versionNotice";
 
 // Settings — a hub of tiles, one per page (SETTINGS_PAGES): Your Executive,
-// Act as me, Workspace, Advanced and About. Each tile says what's on its page
+// Act as me, Memory, Workspace, Advanced and About. Each tile says what's on its page
 // and, where it's cheap to know, how things stand right now. The one-page
 // Settings this replaces used anchors (`/settings#workspace`); a link that
 // still carries one is sent on to the matching page.
@@ -54,7 +63,12 @@ export default function SettingsPage() {
   const statuses = useTileStatuses();
   // Act as me has a tile only for someone who can have it (GET /delegation
   // answers null for everyone else).
-  const pages = SETTINGS_PAGES.filter((p) => p.id !== "act-as-me" || statuses.actAsMeOffered);
+  // Memory, only for someone with notes to keep (GET /memories/history
+  // answers null for anyone not signed in or not on the People list).
+  const pages = SETTINGS_PAGES.filter(
+    (p) =>
+      (p.id !== "act-as-me" || statuses.actAsMeOffered) && (p.id !== "memory" || statuses.memoryOffered),
+  );
 
   if (hash === null || target) return <main className="flex-1" />;
 
@@ -122,12 +136,14 @@ function SettingsTile({ page, status }: { page: SettingsPageDef; status?: TileSt
 function useTileStatuses(): {
   byPage: Partial<Record<SettingsPageId, TileStatus>>;
   actAsMeOffered: boolean;
+  memoryOffered: boolean;
 } {
   const { status: run, unknown } = useExecutiveStatus();
   const { mode, effectiveTimezone, loading: workspaceLoading } = useWorkspace();
   const [voice, setVoice] = useState<string | null>(null);
   const [delegation, setDelegation] = useState<DelegationSettings | null | "error">(null);
   const [version, setVersion] = useState<TileStatus | null>(null);
+  const [history, setHistory] = useState<HistoryState | null | "error">(null);
 
   useEffect(() => {
     const ctrl = new AbortController();
@@ -143,6 +159,11 @@ function useTileStatuses(): {
       .catch((err) => {
         if ((err as Error)?.name !== "AbortError") setDelegation("error");
       });
+    getHistory(undefined, ctrl.signal)
+      .then((h) => setHistory(h))
+      .catch((err) => {
+        if ((err as Error)?.name !== "AbortError") setHistory("error");
+      });
     getVersion(ctrl.signal)
       .then((v) => {
         const notice = versionNotice(v);
@@ -179,6 +200,14 @@ function useTileStatuses(): {
         : { text: "Mailbox not connected", tone: "warn" };
   }
 
+  if (history && history !== "error") {
+    const days = history.company_retention_days;
+    byPage.memory = {
+      text: days === null ? "Notes kept until forgotten" : `Notes last ${retentionLabel(days)}`,
+      tone: "none",
+    };
+  }
+
   if (!workspaceLoading) {
     byPage.workspace = {
       text: [MODE_LABEL[mode], effectiveTimezone].filter(Boolean).join(" · "),
@@ -189,5 +218,5 @@ function useTileStatuses(): {
   byPage.advanced = { text: `${ADVANCED_ITEMS.length} tools for power users`, tone: "none" };
   if (version) byPage.about = version;
 
-  return { byPage, actAsMeOffered: delegation !== null };
+  return { byPage, actAsMeOffered: delegation !== null, memoryOffered: history !== null };
 }
```

**File**: `packages/ui/src/components/memories/HistoryTab.tsx` (added, +335/-0)
```diff
@@ -0,0 +1,335 @@
+"use client";
+
+import Link from "next/link";
+import { useCallback, useEffect, useRef, useState } from "react";
+
+import Button from "@/components/ui/Button";
+import OverflowMenu from "@/components/ui/OverflowMenu";
+import SidePanel from "@/components/ui/SidePanel";
+import {
+  forgetHistoryConversation,
+  forgetHistoryNote,
+  getHistory,
+  updateHistoryNote,
+  type HistoryNote,
+  type HistoryState,
+} from "@/lib/api";
+import { kindLabel, noteExpiry, noteText, noteWhere } from "@/lib/history";
+import { EmptyState, formatDate } from "./shared";
+
+// History — Always in the loop. The signed-in person's own private notes of
+// what they said in replies they approved and sent. Only they see them (the
+// owner included); here they correct, pin and forget them, or ask the
+// Executive not to remember a conversation at all.
+
+const SEARCH_DELAY_MS = 300;
+
+export default function HistoryTab({
+  onCount,
+  onAvailable,
+}: {
+  onCount: (n: number | null) => void;
+  /** false when this viewer has no notes to see; the tab then goes away. */
+  onAvailable: (available: boolean) => void;
+}) {
+  const [state, setState] = useState<HistoryState | null>(null);
+  const [loading, setLoading] = useState(true);
+  const [failed, setFailed] = useState(false);
+  const [query, setQuery] = useState("");
+  const [correcting, setCorrecting] = useState<HistoryNote | null>(null);
+  // Only the newest read may land: an older one (a reload after a pin, a
+  // search the person has since typed past) must not overwrite it.
+  const latest = useRef(0);
+
+  const refresh = useCallback(
+    async (q: string, signal?: AbortSignal) => {
+      const mine = ++latest.current;
+      setFailed(false);
+      try {
+        const next = await getHistory(q, signal);
+        if (mine !== latest.current) return;
+        onAvailable(next !== null);
+        setState(next);
+        // The badge counts every note, not just the ones a search found.
+        if (!q.trim()) onCount(next ? next.notes.length : null);
+      } catch (err) {
+        if ((err as Error)?.name === "AbortError" || mine !== latest.current) return;
+        setFailed(true);
+        onCount(null);
+      } finally {
+        // An aborted or superseded read leaves the newer one to finish loading.
+        if (mine === latest.current) setLoading(false);
+      }
+    },
+    [onCount, onAvailable],
+  );
+
+  useEffect(() => {
+    const ctrl = new AbortController();
+    const timer = setTimeout(() => void refresh(query, ctrl.signal), query ? SEARCH_DELAY_MS : 0);
+    return () => {
+      clearTimeout(timer);
+      ctrl.abort();
+    };
+  }, [query, refresh]);
+
+  const reload = useCallback(() => refresh(query), [refresh, query]);
+
+  const act = useCallback(
+    async (run: () => Promise<unknown>, failure: string) => {
+      try {
+        await run();
+      } catch (err) {
+        window.alert(err instanceof Error ? err.message : failure);
+        return;
+      }
+      void reload();
+    },
+    [reload],
+  );
+
+  if (loading) return <div className="text-fg-muted text-[15px] py-4">Loading…</div>;
+  const failure = (
+    <div className="text-fg-muted text-sm py-3">
+      Couldn&apos;t load your notes.{" "}
+      <button onClick={() => void reload()} className="font-medium text-accent hover:underline">
+        Try again
+      </button>
+    </div>
+  );
+  // A failed first read has nothing to show; a later one keeps the search box
+  // and the notes already on screen.
+  if (!state) return failed ? failure : null;
+
+  const empty = state.notes.length === 0 && !query.trim();
+  return (
+    <div className="py-3">
+      {empty ? (
+        <HistoryEmpty state={state} />
+      ) : (
+        <>
+          <input
+            type="search"
+            value={query}
+            onChange={(e) => setQuery(e.target.value)}
+            placeholder="Search your notes"
+            aria-label="Search your notes"
+            className="w-full bg-surface border border-line rounded-xl px-3 py-2.5 text-[15px] text-fg focus:outline-none focus:ring-2 focus:ring-accent/40"
+          />
+          {failed && failure}
+          {state.notes.length === 0 ? (
+            <EmptyState message="No notes match." />
+          ) : (
+            <div className="mt-1 divide-y divide-line">
+              {state.notes.map((note) => (
+                <NoteRow
+                  key={note.id}
+                  note={note}
+                  onCorrect={() => setCorrecting(note)}
+                  onPin={() =>
+                    void act(() => updateHistoryNote(note.id, { pinned: !note.pinned }), "Couldn't change the note.")
+                  }
+                  onForget={() => {
+                    if (!window.confirm("Forget this note? This cannot be undone.")) return;
+                    void act(() => forgetHistoryNote(note.id), "Couldn't forget the note.");
+                  }}
+                  onDontRemember
```

**File**: `packages/ui/src/components/memories/MemorySection.tsx` (modified, +27/-7)
```diff
@@ -24,11 +24,19 @@ import Button from "@/components/ui/Button";
 import OverflowMenu from "@/components/ui/OverflowMenu";
 import SectionTabs from "@/components/ui/SectionTabs";
 import CorrectionsTab from "./CorrectionsTab";
+import HistoryTab from "./HistoryTab";
 import { DOMAINS, STATUSES, EmptyState, formatDate } from "./shared";
 
-type MemoryTab = "decisions" | "initiatives" | "advice" | "corrections" | "people";
+type MemoryTab = "decisions" | "initiatives" | "advice" | "corrections" | "people" | "history";
 
-export const MEMORY_TABS: readonly MemoryTab[] = ["decisions", "initiatives", "advice", "corrections", "people"];
+export const MEMORY_TABS: readonly MemoryTab[] = [
+  "decisions",
+  "initiatives",
+  "advice",
+  "corrections",
+  "people",
+  "history",
+];
 
 const MEMORY_EMPTY = "No memories yet — they're extracted automatically after chats.";
 const PEOPLE_EMPTY =
@@ -51,11 +59,15 @@ export default function MemorySection() {
     advice: null,
     corrections: null,
     people: null,
+    history: null,
   });
   // Peer memory is optional: until its status is known the People tab shows
   // (so the bar does not jump on installs that have it); once the backend says
   // "disabled" the tab goes away for good.
   const [peopleEnabled, setPeopleEnabled] = useState<boolean | null>(null);
+  // History (Always in the loop) is the signed-in person's own notes: it goes
+  // away for anyone with none to see (not signed in, not on the roster).
+  const [historyEnabled, setHistoryEnabled] = useState<boolean | null>(null);
   // Stable per-tab callbacks — these are passed to the (always-mounted) tabs as
   // `onCount`, which lives in each tab's `refresh` useCallback deps. They MUST
   // keep a constant identity across renders, or the tab's refresh→useEffect
@@ -72,14 +84,20 @@ export default function MemorySection() {
     (n: number | null) => setCounts((c) => ({ ...c, people: n })),
     [],
   );
+  const onCountHistory = useCallback(
+    (n: number | null) => setCounts((c) => ({ ...c, history: n })),
+    [],
+  );
+  const onHistoryAvailable = useCallback((available: boolean) => setHistoryEnabled(available), []);
   const onPeopleStatus = useCallback(
     (s: PeopleMemory["status"]) => setPeopleEnabled(s !== "disabled"),
     [],
   );
 
   useEffect(() => {
     if (peopleEnabled === false && tab === "people") setTab("decisions");
-  }, [peopleEnabled, tab]);
+    if (historyEnabled === false && tab === "history") setTab("decisions");
+  }, [peopleEnabled, historyEnabled, tab]);
 
   // `/memories?tab=corrections` (the chat chip after remember_fact) opens
   // that tab. Read once on mount from the URL, so the page needs no Suspense
@@ -89,10 +107,9 @@ export default function MemorySection() {
     if (wanted && (MEMORY_TABS as readonly string[]).includes(wanted)) setTab(wanted as MemoryTab);
   }, []);
 
-  const tabs: MemoryTab[] =
-    peopleEnabled === false
-      ? MEMORY_TABS.filter((t) => t !== "people")
-      : [...MEMORY_TABS];
+  const tabs: MemoryTab[] = MEMORY_TABS.filter(
+    (t) => !(t === "people" && peopleEnabled === false) && !(t === "history" && historyEnabled === false),
+  );
 
   return (
     <div>
@@ -125,6 +142,9 @@ export default function MemorySection() {
         <div className={tab === "people" ? "" : "hidden"}>
           <PeopleTab onCount={onCountPeople} onStatus={onPeopleStatus} />
         </div>
+        <div className={tab === "history" ? "" : "hidden"}>
+          <HistoryTab onCount={onCountHistory} onAvailable={onHistoryAvailable} />
+        </div>
       </div>
     </div>
   );
```

---

### Incident Patch 15: `3155921a` (2026-10-03)
**Commit Message**: feat(ui): simplify every screen with a six-place menu and focused pages (#341)

<!-- ccr-projects-attribution: {"github_login":"johnrufusone"} -->
_Requested by **Rufus** · [project
thread](https://claude.ai/code/project/chan_01KdjdZHJtboAfcbRxDQxY2F?thread=cmsg_01KdjdZHJtboAfcbRxDQxY2FBUmUTi6o1odkB81U571tkb)_

## Problem

Every screen shows too much at once: a long sidebar with recent chats,
many equal-weight buttons per card, hover-only actions that are
invisible on touch, and long single-page forms. The app is hard to scan
and feels dated.

## Approach

One job per screen, one primary button per card, rarer actions in a ⋯
menu, nothing removed.

- Navigation: sidebar is New chat + six places (Home, Chats, Work,
Company, Knowledge, Pulse) + Settings; hubs show tabs (Work: Workflows ·
Documents · Watch list; Company: People · Goals · Departments ·
Profile). Phone bar: Home, Chats, New chat, Work, Company. Account menu
holds User Guide, Pause/resume, Sign out.
- Shared pieces in `components/ui/`: `Button`, `OverflowMenu`,
`SidePanel`, `HubTabs`, `SectionTabs`. Geist font, 44px controls, larger
type.
- Home: greeting, summary, Ask box, "Needs you" cards, count tiles that
open side p

**File**: `packages/core/openexecutive/architecture/prebuilt/peer_memory.json` (modified, +1/-1)
```diff
@@ -2,6 +2,6 @@
   "section_id": "peer_memory",
   "title": "Peer Memory (Person + Department)",
   "markdown": "An external, peer-keyed memory layer gives the Executive durable cross-channel recall, sitting on top of Honcho via `openexecutive.memory.honcho_client`. The `HONCHO_ENABLED` env var gates it; when false every entry point short-circuits with `outcome=disabled` and behavior matches the pre-Honcho posture.\n\n### Two scopes\n\n- **Per-person**, keyed by `Person.id` — a user chatting from Discord, Telegram, email, or web is one peer card, so facts shared in any channel surface in the others. Each entry point resolves the caller to a `Person.id` (channel-ID lookups for adapters; `x-caller-email` for web).\n- **Per-department**, keyed by `department_<slug>` — each department accumulates an institutional voice from dept-scoped decisions, advice, committee outcomes, and dept-bound specialist turns.\n\n### Private to the principal\n\nThe principal's contacts are private to them (see Org), and two rules keep them out of shared memory. A turn about the principal's private mail (`Session.private_to_principal`: mail from a contact, or mail the principal forwarded) writes nothing to peer or department memory — its reply summarises that mail. And the principal's own peer memory, drawn from all their conversations, answers only the principal: `ask_about_person` with `person_id` = the principal returns the empty \"no data\" answer on any turn but the principal's own verified one (a teammate's own view of the principal, `target_person_id` = the principal, is the teammate's memory and still answers), and `GET /memories/people` / `/conclusions` leave the principal out for anyone else.\n\n### Flow\n\n`prefetch` runs once per turn and injects a `<peer_memory>` block into the user turn (empty on timeout or error). `HONCHO_PREFETCH_MODE` picks how the block is produced. `representation` (the default) reads the person's peer card and the derived conclusions most relevant to the inbound message straight from Honcho (`peer.context(search_query=…)`, `HONCHO_PREFETCH_MAX_CONCLUSIONS` of them, default 20): a GET with no LLM behind it, about 100 ms self-hosted. The block keeps whole lines only, up to a size cap (a line that does not fit is dropped, never cut), strips control characters and defangs a literal closing tag, since conclusions derive from text anyone who can email the Executive wrote. A person Honcho knows nothing about yet yields no block and an `empty` audit outcome. `dialectic` asks Honcho's chat endpoint with the message as the question and injects the synthesized prose (an LLM call, seconds), where `reasoning_level` trades latency for depth. The mode applies to every per-person prefetch, committee turns included. Only `prefetch_department` (one dialectic question per consulted specialist that maps to a department, yielding `<department_memory>`) and the `ask_about_person` tool always use the chat endpoint: they are deliberate questions off the inline path, the split Honcho's own guidance draws between `context()` for per-turn grounding and `chat()` for reasoned answers. After the response, `sync_turn` and `sync_department_turn` persist the exchange as fire-and-forget background tasks that never block the user. The Executive's reply is written under an `executive` peer resolved with `observe_me=false`: the person's representation sees both sides of the exchange, but Honcho no longer derives a representation of the Executive itself, which nothing read and which is where a person's words were occasionally misattributed to the Executive. Both record the person's words only. Honcho derives facts about a person from everything posted under their peer, so a turn whose prompt carries text the person did not write passes `memory_text` to `Executive.chat` / `stream_chat` / `stream_chat_with_committee`, and that — not the prompt — is what both syncs post: an inbound email records the sender's new text, the attachment filenames and its subject unless that is a reply's or forward's (`Re:`, `Fwd:`, `AW:`, `SV:`, `Re[2]:`, `[EXT] Re:` … — the earlier message's subject, often the Executive's own) (never the \"You have an inbound email\" framing, the headers with the Executive's own address in `To:`, the `[POLICY]` notice or the quoted chain, which held the Executive's own earlier email and taught Honcho that the sender *was* the Executive); a web upload records the typed text and filenames, not the extracted document text; a briefing handoff records a short line of what the user asked, phrased as the user speaking and ended before the headline, which follows on its own line (\"Let's discuss this flagged artifact.\" / \"I approve this proposal.\" — an \"Asked to …\" line came back as \"<user> was asked to …\", and a \"?\" in a headline inside the sentence voided the extraction quote); approve-with-edits records the same short line without the edited text, which starts as the Executive's card body and is often sent unchanged, n
```

**File**: `packages/core/openexecutive/guide/prebuilt/artifacts.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "artifacts",
   "title": "Documents",
-  "markdown": "**What it is:** Your library of finished deliverables — memos, web pages, Word documents, spreadsheets, links to things the Executive created in your own apps, and the outputs of workflow runs — in one place.\n\n**What it does:**\n\n- See all active documents, filtered by kind (drafts vs workflow outputs). Anything that isn't plain text shows a small badge: *Web page*, *Word document*, *Spreadsheet*, or the app a link opens.\n- Open any document to read it. Web pages display in a locked-down frame that can't run scripts or load anything from the internet; spreadsheets show as tables; links open straight into the app they live in.\n- Download it in its own format (.md, .html, .docx, .xlsx). Any Markdown document — including every workflow output — can also be downloaded as a Word file.\n- **Send it to someone**: ask the Executive to share a document with a person. It messages them the title and a link on their usual channel (the link opens in Open Executive, so it's for people who have access), or — if Google Workspace is connected — emails the file itself as an attachment (Word, Excel, web page or Markdown).\n- **Revise in chat**: opens a new chat about that document. The Executive rereads it, writes the new version, and archives the old one; the new version links back to the one it replaced.\n- The Executive remembers what it has written: it can list and reread its documents, and past documents surface in its answers when relevant.\n- Archive a document to tuck it away (with a quick undo) and restore it later.\n- Permanently delete one when you're sure, with a confirmation step.\n- Switch between **Active** and **Archived** views.\n\n**How to use:**\n\n1. Get something in here. Ask the Executive for a deliverable and say the format if you care — *\"as a Word doc\"*, *\"as a spreadsheet\"*, *\"as a one-page web page\"*, or *\"in my Google Sheets / Notion / OneDrive\"*. When you ask, it always publishes the result and replies with a link. For your own apps it uses whatever you've connected; with nothing connected it makes the file itself. It also drafts things unprompted when a finding is worth your time. Drafts appear as a card in the Briefing's **Needs you** lane, and every workflow run adds its output here automatically.\n2. Open **Documents** in the sidebar. Filter by **Drafts** or **Workflows**, and switch between **Active** and **Archived**.\n3. Click a document to read it; use **Copy** or a **Download** button to take it elsewhere, or **Revise in chat** to ask for changes.\n4. Hover over a row to **Archive** it (an **Undo** appears for a moment), **Restore** it from the Archived view, or **Delete permanently** (you'll be asked to confirm).\n\n**Example:** *\"Put the vendor pricing comparison in a spreadsheet for me.\"* A spreadsheet lands in **Needs you** and in **Documents**, previewed as tables with a **Download .xlsx** button. Later: *\"Add a column for contract length to that pricing spreadsheet\"* — the Executive rereads it, publishes the revised version, and archives the first one.\n\n*Note: archiving is a soft-delete — nothing is lost until you explicitly delete it.*",
+  "markdown": "**What it is:** Your library of finished deliverables — memos, web pages, Word documents, spreadsheets, links to things the Executive created in your own apps, and the outputs of workflow runs — in one place.\n\n**What it does:**\n\n- See all active documents, filtered by kind (**Drafts** vs **Workflows** outputs). Anything that isn't plain text shows a small badge: *Web page*, *Word document*, *Spreadsheet*, or the app a link opens.\n- Open any document to read it. Web pages display in a locked-down frame that can't run scripts or load anything from the internet; spreadsheets show as tables; links open straight into the app they live in.\n- Download it in its own format (.md, .html, .docx, .xlsx). Any Markdown document — including every workflow output — can also be downloaded as a Word file.\n- **Send it to someone**: ask the Executive to share a document with a person. It messages them the title and a link on their usual channel (the link opens in Open Executive, so it's for people who have access), or — if Google Workspace is connected — emails the file itself as an attachment (Word, Excel, web page or Markdown).\n- **Revise in chat**: opens a new chat about that document. The Executive rereads it, writes the new version, and archives the old one; the new version links back to the one it replaced.\n- The Executive remembers what it has written: it can list and reread its documents, and past documents surface in its answers when relevant.\n- Archive a document to tuck it away (with a quick undo) and restore it later.\n- Permanently delete one when you're sure, with a confirmation step.\n- Switch between active and archived documents from the **⋯** next to the filter.\n\n**How to use:**\n\n1. Get something in here. Ask the 
```

**File**: `packages/core/openexecutive/guide/prebuilt/ask_oe.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "ask_oe",
   "title": "Ask OE",
-  "markdown": "**What it is:** A page-aware assistant panel docked on the right of every screen (except the chat home, which *is* the chat). Open it with the **Ask OE** button in the top bar or **Ctrl/Cmd + .** — it's the same Executive you talk to in chat, but it knows what page you're looking at.\n\n**What it does:**\n\n- **Explains the current page.** Ask \"what does this page do?\" or \"what does authority scope mean?\" and the answer is grounded in this guide's section for the page you're on.\n- **Fills forms for you.** On a screen with a form (the workflow builder, the Add-person dialog, the company profile), describe what you want in plain language and the suggested values land directly in the form, highlighted so you can see what came from the Executive.\n- **You always click Save.** Ask OE never submits a form. Suggested values are just that — review them, edit anything, and save through the form's normal button. An **Undo** on the proposal card restores what was there before, and a highlight clears the moment you edit that field yourself.\n\n**How to use:**\n\n1. On any page, click **Ask OE** in the top bar or press **Ctrl/Cmd + .** (press it again to close).\n2. Ask about the page — \"what's the difference between Flag and Reject here?\" — or, on a form page, describe what you want filled in.\n3. Check the highlighted fields. Edit anything that's off, then click the form's own **Save** / **Create** button. Click **Undo** on the proposal card to put the form back as it was.\n4. Click **New conversation** in the panel header to start fresh.\n\n**Where it works:** every page inside the app shell. Form-filling is wired into the workflow builder (**Workflows → + New workflow**), the **Add person** dialog, and the **Company profile**; other pages get the explain tier, with form support arriving screen by screen.\n\n**Example:** on **Workflows → + New workflow**, open Ask OE and type *\"create a weekly Monday 9am competitor watch where the CMO checks our top three competitors for pricing and product changes, and send it to me\"*. The name, steps and schedule fill in; you review them and click **Create workflow**.\n\n**Good to know:** panel conversations are normal chat sessions — they appear in your session history and the audit log like any other turn.",
+  "markdown": "**What it is:** A page-aware assistant panel docked on the right of every screen (except the chat home, which *is* the chat). Open it with the **Ask OE** button in the top bar or **Ctrl/Cmd + .** — it's the same Executive you talk to in chat, but it knows what page you're looking at.\n\n**What it does:**\n\n- **Explains the current page.** Ask \"what does this page do?\" or \"what does authority scope mean?\" and the answer is grounded in this guide's section for the page you're on.\n- **Fills forms for you.** On a screen with a form (the workflow builder, the Add-person dialog, the company profile), describe what you want in plain language and the suggested values land directly in the form, highlighted so you can see what came from the Executive.\n- **You always click Save.** Ask OE never submits a form. Suggested values are just that — review them, edit anything, and save through the form's normal button. An **Undo** on the proposal card restores what was there before, and a highlight clears the moment you edit that field yourself.\n\n**How to use:**\n\n1. On any page, click **Ask OE** in the top bar or press **Ctrl/Cmd + .** (press it again to close).\n2. Ask about the page — \"what's the difference between Flag and Reject here?\" — or, on a form page, describe what you want filled in.\n3. Check the highlighted fields. Edit anything that's off, then click the form's own **Save** / **Create** button. Click **Undo** on the proposal card to put the form back as it was.\n4. Click **New conversation** in the panel header to start fresh.\n\n**Where it works:** every page inside the app shell. Form-filling is wired into the workflow builder (**Work → Workflows**, then **New workflow** in the **⋯** beside **Start**), the **Add person** dialog, and the **Company profile**; other pages get the explain tier, with form support arriving screen by screen.\n\n**Example:** on the workflow builder (**New workflow** in the **⋯** beside **Start** on **Workflows**), open Ask OE and type *\"create a weekly Monday 9am competitor watch where the CMO checks our top three competitors for pricing and product changes, and send it to me\"*. The name, steps and schedule fill in; you review them and click **Create workflow**.\n\n**Good to know:** panel conversations are normal chat sessions — they appear in your session history and the audit log like any other turn.",
   "mermaid": null,
-  "generated_at": "2026-09-23T00:00:00+00:00"
+  "generated_at": "2026-10-03T12:00:00Z"
 }
```

**File**: `packages/core/openexecutive/guide/prebuilt/audit.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "audit",
   "title": "Audit Log",
-  "markdown": "**What it is:** A searchable, append-only record of everything the system did — every chat turn, specialist consult, tool call, alert, scheduled action, and inbound integration.\n\n**What it does:**\n\n- Filter events by type, session, date, or free-text search.\n- Open any event to see its full payload — the message, tool input, and result.\n- View a per-session flow chart showing what led to what.\n- See cost and token summaries for each session.\n\n**How to use:**\n\n1. Open **Settings → Audit log**. It opens on **Sessions** — one card per conversation.\n2. Click **Open flow chart →** on a session to see it step by step. Click any node to see exactly what the agent saw and did; the side drawer shows the full payload, with **Copy**.\n3. Switch to **Events** for the raw list, and click a row for its full payload. Clicking a session id filters to that session.\n4. Narrow things down with **Search summary…**, the event-type dropdown, **Session id**, and **From / Until**. **Clear filters** resets them.\n\n**Example:** *\"Why did the Executive message our vendor on Tuesday?\"* — search for the vendor's name, set **From / Until** to Tuesday, then open that session's flow chart and follow it from the inbound message to the outbound send.\n\n*Note: the log is immutable — it's the trail for understanding (and trusting) what the Executive did.*",
+  "markdown": "**What it is:** A searchable, append-only record of everything the system did — every chat turn, specialist consult, tool call, alert, scheduled action, and inbound integration.\n\n**What it does:**\n\n- Filter events by type, session, date, or free-text search.\n- Open any event to see its full payload — the message, tool input, and result.\n- View a per-session flow chart showing what led to what.\n- See cost and token summaries for each session.\n\n**How to use:**\n\n1. Open **Settings → Advanced → Audit log**. It opens on **Sessions** — one card per conversation.\n2. Click **Open flow chart →** on a session to see it step by step. Click any node to see exactly what the agent saw and did; the side drawer shows the full payload, with **Copy**.\n3. Switch to **Events** for the raw list, and click a row for its full payload. Clicking a session id filters to that session.\n4. Narrow things down with **Search summary…**, the event-type dropdown, **Session id**, and **From / Until**. **Clear filters** resets them.\n\n**Example:** *\"Why did the Executive message our vendor on Tuesday?\"* — search for the vendor's name, set **From / Until** to Tuesday, then open that session's flow chart and follow it from the inbound message to the outbound send.\n\n*Note: the log is immutable — it's the trail for understanding (and trusting) what the Executive did.*",
   "mermaid": null,
-  "generated_at": "2026-09-23T00:00:00+00:00"
+  "generated_at": "2026-10-03T12:00:00Z"
 }
```

**File**: `packages/core/openexecutive/guide/prebuilt/chat.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "chat",
   "title": "Chat & Briefing",
-  "markdown": "**What it is:** The home surface where you talk to the Executive in plain language. It opens on a *briefing* — a quick read of what's happened across the company — and you drop into a chat whenever you want to ask or decide something.\n\n**What it does:**\n\n- Hold a natural conversation with the Executive, which quietly pulls in whichever specialists a question needs.\n- Keep separate chat sessions with full history, so you can pick up where you left off.\n- Attach files to a message — up to 5 per turn, 20 MB each (images, PDF, Word, text, Markdown, CSV) — for the Executive to read alongside your knowledge base.\n- Stop a reply while it is still coming — whatever has been written is kept and marked *Stopped by you*, so you can redirect without waiting the answer out. (Escape works too.)\n- Toggle **Committee** on a question that matters: a slower pass where reviewers challenge the draft answer before you see it.\n- Continue any briefing item straight into a chat thread, with the context already filled in.\n- Open **Agent activity** in the top bar to watch what's happening behind a reply — which specialists were consulted and which tools ran.\n- See what an answer drew on: click **Sources** under a reply to list the documents and web pages it looked at — your own documents, the built-in knowledge and any web pages — with links where there are any.\n\n**How to use:**\n\n1. Click **New chat** in the sidebar. (Click **Briefing** any time to get back to the briefing.)\n2. Type your question and press **Enter** to send — **Shift + Enter** starts a new line. When the box is empty, a greyed-out suggested follow-up may appear; press **Tab** or **→** to use it.\n3. To include a file, click the paperclip next to the message box and pick up to 5 files. (Drag-and-drop isn't supported in chat.) Attachments are read for that conversation only — to make a document permanently available, upload it to the Knowledge Base.\n4. For a decision that matters, click the **Committee** pill next to Send *before* sending. It applies to that one message; you'll see *Drafting → Committee review → Revising* while it works.\n5. Changed your mind mid-answer? Click the stop button (it replaces Send while a reply is streaming) or press **Esc**.\n6. Rate a reply with 👍 / 👎, and find old conversations under **Recent** in the sidebar (it has a search box).\n7. If part of an answer couldn't be completed — say the finance side — you still get the rest, with a short note under it. Ask again to fill in the missing part.\n\n**Example prompts:**\n\n- \"Here's our Q3 board deck — what questions should I expect from the board?\" *(with the PDF attached)*\n- \"Should we raise prices 10% for new customers? I want the finance and marketing view.\" *(with Committee on)*\n- \"What changed across the company this week that I should know about?\"\n\n*Tip: this is the front door — almost everything else in the app is something the Executive references or acts on from here.*",
+  "markdown": "**What it is:** Where you talk to the Executive in plain language. The app opens on **Home** — a quick read of what's happened across the company and what needs you — and you drop into a chat whenever you want to ask or decide something.\n\n**What it does:**\n\n- Hold a natural conversation with the Executive, which quietly pulls in whichever specialists a question needs.\n- Keep separate chat sessions with full history, so you can pick up where you left off.\n- Attach files to a message — up to 5 per turn, 20 MB each (images, PDF, Word, text, Markdown, CSV) — for the Executive to read alongside your knowledge base.\n- Stop a reply while it is still coming — whatever has been written is kept and marked *Stopped by you*, so you can redirect without waiting the answer out. (Escape works too.)\n- Turn on **Committee review** for a question that matters: a slower pass where reviewers challenge the draft answer before you see it.\n- Continue any item on Home straight into a chat thread, with the context already filled in.\n- Choose **Show agent activity** in the **⋯** menu at the top right to watch what's happening behind a reply — which specialists were consulted and which tools ran.\n- See what an answer drew on: click **Sources** under a reply to list the documents and web pages it looked at — your own documents, the built-in knowledge and any web pages — with links where there are any.\n\n**How to use:**\n\n1. Click **New chat** at the top of the sidebar (on a phone, **New chat** in the middle of the bar at the bottom), or type into the **Ask your Executive anything…** box on Home. Click **Home** any time to get back.\n2. Type your question and press **Enter** to send — **Shift + Enter** starts a new line. When the box is empty, a greyed-out suggested follow-up may appear; press **Tab** or **→** to use it.\n3. To include a file, click the **+** next to the message box, choose **Att
```

**File**: `packages/core/openexecutive/guide/prebuilt/clients.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "clients",
   "title": "Client Companies",
-  "markdown": "**What it is:** Multi-client mode for fractional work. Each client is a named **slot** holding a complete, separate company — profile, people, chats, memory, watchlist, everything — and you switch the live workspace between them.\n\n**What it does:**\n\n- Create a client by snapshotting the current company, starting blank, or having AI draft one from your intake notes and attachments.\n- Activate a slot to make it the live company; the previous client's full state is saved back to its slot first.\n- Keep **engagement metadata** on every slot — your role (e.g. Fractional CFO), status, retainer, primary contact, and renewal date — visible across all clients.\n- Get renewal reminders even for clients that are parked.\n\n**How to use:**\n\n1. Open **Settings → Client Companies**.\n2. Add a client, one of three ways:\n   - **New client** → enter a name → **From current company** (captures what's live now) → **Create**.\n   - **New client** → **Blank (onboard fresh)** → **Create**, then **Activate** it and run onboarding.\n   - **New client from intake notes** → paste your notes and attach any files → **Draft client** → check it → **Create & activate** (or **Create client** to park it).\n3. Click **Activate** on a client to switch to it. The current client is saved back to its slot first; **Save now** saves it on demand.\n4. Click **Engagement details** to record your role, status, renewal date, retainer, primary contact and notes, then **Save details**.\n\n**Example intake notes:** *\"Kickoff call with Meridian Solar — 120-person residential installer in Arizona, $38M revenue, PE-backed since 2024. I'm their fractional CFO, 10 hours a week, $8K/month retainer, renewal in March. Priorities: 13-week cash forecast and a lender-ready model.\"*\n\n*Note: switching clients swaps the whole working state, so nothing leaks between engagements. Switching is disabled while a simulator company is loaded — unload it first. Single-company users can ignore this screen entirely.*",
+  "markdown": "**What it is:** Multi-client mode for fractional work. Each client is a named **slot** holding a complete, separate company — profile, people, chats, memory, watchlist, everything — and you switch the live workspace between them.\n\n**What it does:**\n\n- Create a client by snapshotting the current company, starting blank, or having AI draft one from your intake notes and attachments.\n- Activate a slot to make it the live company; the previous client's full state is saved back to its slot first.\n- Keep **engagement metadata** on every slot — your role (e.g. Fractional CFO), status, retainer, primary contact, and renewal date — visible across all clients.\n- Get renewal reminders even for clients that are parked.\n\n**How to use:**\n\n1. Open **Settings → Advanced → Client Companies**.\n2. Add a client, one of three ways:\n   - **New client** → **From a company** → enter a name → **From current company** (captures what's live now) → **Create**.\n   - **New client** → **From a company** → **Blank (onboard fresh)** → **Create**, then **Activate** it and run onboarding.\n   - **New client** → **From intake notes** → paste your notes and attach any files → **Draft client** → check it → **Create & activate** (or **Create client** to park it).\n3. Click **Activate** on a client to switch to it. The current client is saved back to its slot first; **Save now** saves it on demand.\n4. Choose **Engagement details** in a client's **⋯** menu to record your role, status, renewal date, retainer, primary contact and notes, then **Save details**.\n\n**Example intake notes:** *\"Kickoff call with Meridian Solar — 120-person residential installer in Arizona, $38M revenue, PE-backed since 2024. I'm their fractional CFO, 10 hours a week, $8K/month retainer, renewal in March. Priorities: 13-week cash forecast and a lender-ready model.\"*\n\n*Note: switching clients swaps the whole working state, so nothing leaks between engagements. Switching is disabled while a simulator company is loaded — unload it first. Single-company users can ignore this screen entirely.*",
   "mermaid": null,
-  "generated_at": "2026-09-23T00:00:00+00:00"
+  "generated_at": "2026-10-03T12:00:00Z"
 }
```

**File**: `packages/core/openexecutive/guide/prebuilt/company_profile.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "company_profile",
   "title": "Company Profile & Onboarding",
-  "markdown": "**What it is:** Your company's identity and strategy — mission, market, competitors, financials, and org structure — that grounds everything the Executive says.\n\n**What it does:**\n\n- **Describe your business in your own words** the first time — paste a paragraph, or attach a deck or one-pager. The Executive asks a few follow-up questions, then shows you a filled-in draft profile, team list, and departments.\n- Review and edit that draft before anything is saved; nothing is written until you hit save. Prefer a form? A step-by-step version is linked at the bottom of the setup screen.\n- View and edit every section of the profile inline, any time afterward.\n- Feed this context to all specialists so advice fits *your* company, not a generic one.\n- Kick off background research after setup to suggest things worth watching.\n\n**How to use:**\n\n*First-time setup*\n\n1. Click **Set up company** in the sidebar (or **Set up profile →** on the banner in chat).\n2. Describe your business — what you do, who you sell to, roughly how big you are. Optionally **Attach files** (up to 8: a deck, one-pager, or spreadsheet). Click **Get started**.\n3. Answer the follow-up questions (up to 8), or click **Skip ahead — draft my profile now**.\n4. On **Here's what I understood**, edit the profile, **Your team**, and **Departments**. Make sure exactly one person is marked as you. Check **Your sign-in email**: it's filled in with the account you're signed in with, and it's how the Executive knows the person marked as you is you — change it if you're setting this up for someone else. Click **Save & finish setup** — or **Not quite — ask me more questions**.\n\nPrefer filling in fields? Click **Prefer a form? Use the step-by-step version** for a 12-step wizard.\n\n*Afterwards*\n\n- Open **Company profile**, click **Edit** on any section (Company Basics, Mission & Vision, Target Customer, Competitive Landscape, Strategic Priorities, Financials, and more), make your changes, and click **Save**. List fields take one item per line.\n- **Re-run setup →** takes you back through the conversation. Only the current owner can mark someone else as \"This is me\" when re-running it, because saving makes that person the owner.\n- Ask OE can fill in profile sections for you — you still click **Save**.\n\n**Example description:** *\"We're Northwind Tools — a 40-person B2B SaaS company selling inventory software to independent hardware stores in the US. About $6M ARR, growing 60% a year, Series A last spring. Our main competitors are Lightspeed and spreadsheets. This year's priorities are launching in Canada and getting net revenue retention above 110%.\"*\n\n*Note: until a profile exists, the app nudges you to set one up — it's the foundation the rest builds on.*",
+  "markdown": "**What it is:** Your company's identity and strategy — mission, market, competitors, financials, and org structure — that grounds everything the Executive says.\n\n**What it does:**\n\n- **Describe your business in your own words** the first time — paste a paragraph, or attach a deck or one-pager. The Executive asks a few follow-up questions, then shows you a filled-in draft profile, team list, and departments.\n- Review and edit that draft before anything is saved; nothing is written until you hit save. Prefer a form? A step-by-step version is linked at the bottom of the setup screen.\n- View and edit every section of the profile inline, any time afterward.\n- Feed this context to all specialists so advice fits *your* company, not a generic one.\n- Kick off background research after setup to suggest things worth watching.\n\n**How to use:**\n\n*First-time setup*\n\n1. Open **Company** in the sidebar and pick the **Set up company** tab (or click **Set up profile →** on the banner in chat).\n2. Describe your business — what you do, who you sell to, roughly how big you are. Optionally **Attach files** (up to 8: a deck, one-pager, or spreadsheet). Click **Get started**.\n3. Answer the follow-up questions (up to 8), or click **Skip ahead — draft my profile now**.\n4. On **Here's what I understood**, edit the profile, **Your team**, and **Departments**. Make sure exactly one person is marked as you. Check **Your sign-in email**: it's filled in with the account you're signed in with, and it's how the Executive knows the person marked as you is you — change it if you're setting this up for someone else. Click **Save & finish setup** — or **Not quite — ask me more questions**.\n\nPrefer filling in fields? Click **Prefer a form? Use the step-by-step version** for a 12-step wizard.\n\n*Afterwards*\n\n- Open **Company** in the sidebar and pick the **Company profile** tab, click **Edit** on any section (Company Basics, Mission & Vision, Target Customer, Competitive Landscape, Strategic Priorities, Financials, and more), make your changes, and click **Save**. List fie
```

**File**: `packages/core/openexecutive/guide/prebuilt/council.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "section_id": "council",
   "title": "Agent Council",
-  "markdown": "**What it is:** The configuration hub for the specialists behind the Executive — the place to tune how each one thinks and how the Executive sounds.\n\n**What it does:**\n\n- Pick any agent and add instructions, or override its role, system prompt, model, or deep-reasoning toggle.\n- Set the Executive's **voice persona** — the tone it speaks to you in.\n- Test a draft configuration with a one-off query before committing.\n- View version history and roll back, or reset an agent to its built-in default.\n\n**How to use:**\n\n1. Open **Settings → Agent Council** and pick an agent from the list. An amber dot means it's already been customized.\n2. Change what you need:\n   - **Role** — its one-line job description.\n   - **Model** — provider and model; the default is marked *(default)*.\n   - **Deep reasoning** — slower, more thorough thinking (not available on Haiku models).\n   - **Additional instructions** — a few lines added after its built-in prompt, such as \"Quote figures in EUR\". The agent keeps getting improvements to its built-in prompt. Clear the box to remove them.\n   - **System prompt** — its full instructions. Editing it replaces the built-in prompt, so later improvements to it won't reach this agent; prefer **Additional instructions** when you can. **Restore default prompt in editor** brings the original back.\n   - **Research focus** — specialists only.\n3. Try it before saving: in **Test this draft**, type a question and click **Run test**. It uses your unsaved settings and changes nothing.\n4. Click **Save**. The change applies on the next call.\n5. To undo, click **Reset to default**, or open **Version history** and click **Restore** on an earlier version.\n\n*Change the Executive's voice:* select the Executive and scroll to **Voice Persona**. Choose an **Active persona** and click the main **Save**. To write your own, click **+ New**, give it a display name and a persona body, and click **Create** — or **Duplicate** an existing persona and edit the copy.\n\n**Example persona body:**\n\n```\n- Direct and brief; lead with the recommendation, then the reasoning\n- Plain English, no jargon or buzzwords\n- Numbers over adjectives\n- End with the one decision you need from me\n```\n\n*Note: changes take effect on the next call — no restart needed. This is a power-user surface under Settings.*",
+  "markdown": "**What it is:** The configuration hub for the specialists behind the Executive — the place to tune how each one thinks and how the Executive sounds.\n\n**What it does:**\n\n- Pick any agent and add instructions, or override its role, system prompt, model, or deep-reasoning toggle.\n- Set the Executive's **voice persona** — the tone it speaks to you in.\n- Test a draft configuration with a one-off query before committing.\n- View version history and roll back, or reset an agent to its built-in default.\n\n**How to use:**\n\n1. Open **Settings → Advanced → Agent Council**. It opens in a simple view: **Quality** at the top sets every agent's model and deep reasoning at once. Under **Your agents**, each main agent is a card with its area and model; an amber dot and **Has your instructions** mean you've already changed it. Click a card to open that agent in a panel with its **Additional instructions**, then click **Save** (or **Cancel**). **Show all agents** lists the internal ones too.\n2. For everything else, click **Advanced** at the top (the browser remembers it; **Back to simple view** returns). Click an agent's card; its panel splits the settings into tabs — **Model**, **Instructions**, **Prompt**, **Test** and **History**:\n   - **Role** — its one-line job description.\n   - **Model** — provider and model; the default is marked *(default)*.\n   - **Deep reasoning** — slower, more thorough thinking (not available on Haiku models).\n   - **Additional instructions** — a few lines added after its built-in prompt, such as \"Quote figures in EUR\". The agent keeps getting improvements to its built-in prompt. Clear the box to remove them.\n   - **System prompt** — its full instructions. Editing it replaces the built-in prompt, so later improvements to it won't reach this agent; prefer **Additional instructions** when you can. **Restore default prompt in editor** brings the original back.\n   - **Research focus** — specialists only.\n3. Try it before saving: on the **Test** tab, under **Test this draft**, type a question and click **Run test**. It uses your unsaved settings and changes nothing.\n4. Click **Save** at the bottom of the panel. The change applies on the next call.\n5. To undo, choose **Reset to default** in the **⋯** menu at the bottom of the agent's panel, or open the **History** tab and click **Restore** on an earlier version.\n\n*Change the Executive's voice:* pick one under **Voice** on **Settings → Your Executive**. To write your own, open the Council's **Advanced** view, click the **Exe
```

#### Recent Merged Pull Requests:
- **PR #369** (2026-10-05): docs(readme): play the new tour video (@johnrufusone)
- **PR #368** (2026-10-06): feat(ui): play the Council Consult animation while the Executive works (@johnrufusone)
- **PR #366** (2026-10-05): fix(people): point roster emails at Home and name who a reply is about (@johnrufusone)
- **PR #365** (2026-10-05): fix(delegation): let the email's own greeting decide who a group email asks (@johnrufusone)
- **PR #364** (2026-10-05): feat(workflows): let the morning reflection search the knowledge base (@johnrufusone)
- **PR #363** (2026-10-05): fix(ui): keep the watch list page from scrolling the whole screen on phones (@johnrufusone)
- **PR #362** (2026-10-05): feat(delegation): let people describe how they write in their own words (@johnrufusone)
- **PR #360** (2026-10-05): fix(ui): hide the Always asks first switches while Take the lead is off (@johnrufusone)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
