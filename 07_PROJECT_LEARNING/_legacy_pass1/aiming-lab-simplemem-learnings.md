# Forensic Learning Record (Deep Inspection): aiming-lab/SimpleMem

> **Canonical Artifact**: `07_PROJECT_LEARNING/aiming-lab-simplemem-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/aiming-lab/SimpleMem](https://github.com/aiming-lab/SimpleMem))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:02:06.346Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `aiming-lab/SimpleMem`
- **Description**: [ICML'26] SimpleMem: Efficient Lifelong Memory for LLM Agents — Text & Multimodal
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 3822 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `EvolveMem/evolvemem/__init__.py`
```
"""
EvolveMem — Self-Evolving Memory Architecture for LLM Agents.

A four-layer memory system with typed knowledge representation, adaptive
retrieval policy, replay-based offline evaluation, and promotion-gated
self-evolution — all backed by SQLite + FTS5.
"""

from .candidate import generate_policy_candidates
from .consolidator import MemoryConsolidator
from .diagnosis import DiagnosisReport, MemoryDiagnostics, QAResult
from .evolution import EvolutionConfig, EvolutionEngine, EvolutionResult
from .extractor import ExtractionConfig, MemoryExtractor
from .manager import MemoryManager
from .models import MemoryQuery, MemoryStatus, MemoryType, MemoryUnit
from .multi_retriever import (
    MultiViewIndex,
    RetrievalConfig,
    RetrievedMemory,
    format_context,
    retrieve_multiview,
)
from .promotion import MemoryPromotionCriteria, should_promote
from .replay import (
    MemoryReplayEvaluator,
    MemoryReplaySample,
    load_replay_samples,
    run_policy_candidate_replay,
)
from .scope import derive_memory_scope
from .self_upgrade import MemorySelfUpgradeOrchestrator
from .store import MemoryStore
from .telemetry import MemoryTelemetryStore
from .upgrade_worker import MemoryUpgradeWorker

__all__ = [
    # Core
    "MemoryManager",
    "MemoryStore",
    "MemoryConsolidator",
    "MemoryQuery",
    "MemoryStatus",
    "MemoryType",
    "MemoryUnit",
    "MemoryTelemetryStore",
    # Self-Evolution (NEW)
    "EvolutionEngine",
    "EvolutionConfig",
    "EvolutionResult",
    "MemoryExtractor",
    "ExtractionConfig",
    "MemoryDiagnostics",
    "DiagnosisReport",
    "QAResult",
    # Multi-View Retrieval (NEW)
    "MultiViewIndex",
    "RetrievalConfig",
    "RetrievedMemory",
    "retrieve_multiview",
    "format_context",
    # Policy Evolution
    "MemoryPromotionCriteria",
    "should_promote",
    "MemoryReplayEvaluator",
    "MemoryReplaySample",
    "load_replay_samples",
    "run_policy_candidate_replay",
    "MemorySelfUpgradeOrchestrator",
    "MemoryUpgradeWorker",
    "derive_memory_scope",
    "generate_policy_candidates",
]

```

### Core Architecture Module: `EvolveMem/evolvemem/benchmarks/__init__.py`
```
"""Benchmark adapters — map heterogeneous benchmark data into a unified
`BenchmarkSample` format consumed by `EvolutionEngine`.

Each adapter provides:
  - load(...) -> list[BenchmarkSample]
  - scoring_fn(prediction, reference, qa_meta) -> float  (bounded [0,1])
  - answer_prompt(question, context, qa_meta) -> str     (format-specific)

The engine calls these via the `BenchmarkAdapter` protocol; adding a new
benchmark means adding a file here, not touching the core engine.
"""

from .base import (
    BenchmarkAdapter,
    BenchmarkSample,
    QuestionMeta,
    register_adapter,
    get_adapter,
)
from .locomo import LoCoMoAdapter
from .longmemeval import LongMemEvalAdapter
from .membench import MemBenchAdapter

# Registry — populated on import
register_adapter("locomo", LoCoMoAdapter)
register_adapter("longmemeval", LongMemEvalAdapter)
register_adapter("membench", MemBenchAdapter)

__all__ = [
    "BenchmarkAdapter",
    "BenchmarkSample",
    "QuestionMeta",
    "LoCoMoAdapter",
    "LongMemEvalAdapter",
    "MemBenchAdapter",
    "get_adapter",
    "register_adapter",
]

```

### Core Architecture Module: `EvolveMem/evolvemem/benchmarks/base.py`
```
"""Base interfaces for benchmark adapters.

All benchmarks speak the same language to `EvolutionEngine`:
  - sessions: list[(session_id, date_str, turns)], turn = {speaker, text, ...}
  - qa_pairs: list[dict] with 'question', 'answer', 'category' (int), plus
              adapter-specific extras under 'meta'
  - scoring_fn: (pred, ref, qa) -> float
  - answer_prompt_builder: (question, context, qa) -> list[{role, content}]
"""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Protocol

_REGISTRY: dict[str, type["BenchmarkAdapter"]] = {}


def register_adapter(name: str, cls: type["BenchmarkAdapter"]) -> None:
    _REGISTRY[name] = cls


def get_adapter(name: str) -> "BenchmarkAdapter":
    if name not in _REGISTRY:
        raise KeyError(
            f"unknown benchmark '{name}'. known={list(_REGISTRY)}"
        )
    return _REGISTRY[name]()


@dataclass
class QuestionMeta:
    """Adapter-specific metadata that travels with each QA pair."""
    qid: str = ""
    qtype: str = ""
    extras: dict[str, Any] = field(default_factory=dict)


@dataclass
class BenchmarkSample:
    """One evaluation unit: a set of sessions + its QA pairs.

    For LoCoMo each conversation is one sample.
    For LongMemEval each question+haystack is one sample.
    For MemBench each tid is one sample.
    """
    sample_id: str
    sessions: list[tuple[str, str, list[dict]]]
    qa_pairs: list[dict]  # each: {question, answer, category, meta:QuestionMeta}
    benchmark: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


class BenchmarkAdapter(ABC):
    """Adapter that normalizes one benchmark to the common format."""

    name: str = "abstract"
    primary_metric: str = "f1"  # used by evolution decisions

    # Optional label for subcategory dimension(s) to aggregate on. Most
    # benchmarks have a single dimension (category/qtype) but MemBench has
    # two (agent × category). Set to list of meta.extras keys plus "category".
    subcategory_keys: tuple[str, ...] = ("category",)

    @abstractmethod
    def load(self, path: str, **kwargs) -> list[BenchmarkSample]:
        """Load raw data from `path` into a list of BenchmarkSample."""
        raise NotImplementedError

    @abstractmethod
    def score(self, prediction: str, reference: str, qa: dict) -> float:
        """Score one prediction in [0,1] — the primary metric."""
        raise NotImplementedError

    def score_all(
        self,
        prediction: str,
        reference: str,
        qa: dict,
    ) -> dict[str, float | None]:
        """Compute the full metric bundle for this benchmark. Subclasses
        override. Default = single-entry {primary_metric: self.score(...)}.
        """
        return {self.primary_metric: self.score(prediction, reference, qa)}

    def subcategory_of(self, qa: dict) -> tuple[str, ...]:
        """Return the subcategory tuple used for per-subcategory aggregation.

        Looks up `subcategory_keys` on the QA meta; falls back to top-level
        `category` if the key isn't present.
        """
        parts: list[str] = []
        meta = qa.get("meta") or {}
        extras = meta.get("extras") if isinstance(meta, dict) else {}
        for k in self.subcategory_keys:
            if k == "category":
                parts.append(str(qa.get("category", 0)))
            elif isinstance(meta, dict) and k in meta:
                parts.append(str(meta[k]))
            elif isinstance(extras, dict) and k in extras:
                parts.append(str(extras[k]))
            else:
                parts.append("")
        return tuple(parts)

    def build_answer_prompt(
        self,
        question: str,
        context: str,
        qa: dict,
    ) -> tuple[str, str]:
        """Return (system, user) prompt for answering one question.
        Default = token-F1-friendly concise style; override per benchmark.
        """
        system = (
            "Professional Q&A assistant. Concise answers grounded in context. "
            "JSON output only."
        )
        user = (
            f"Question: {question}\n\n"
            f"Context:\n{context}\n\n"
            "Rules:\n"
            "1. Answer in 1-10 words. Use exact words from context.\n"
            "2. Be specific (e.g., 'Sweden', not 'her country').\n"
            "3. Return JSON: {\"reasoning\":\"brief\",\"answer\":\"concise\"}"
        )
        return system, user

    def canonical_category(self, qa: dict) -> int:
        """Map adapter-specific qtype to a small int category for diagnostics."""
        return int(qa.get("category", 0))


# ---- Reusable scoring primitives ----

_PUNCT_RE = re.compile(r"[^a-z0-9\s]")


_NUMBER_WORDS = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
    "ten": "10", "eleven": "11", "twelve": "12", "thirteen": "13",
    "fourteen": "14", "fifteen": "15", "sixteen": "16", "seventeen": "17",
    "eighteen": "18", "nineteen": "19", "twenty": "20",
    "once": "1", "twice": "2", "thrice": "3", "single": "1", "double": "2",
    "first": "1", "second": "2", "third": "3", "fourth": "4", "fifth": "5",
}


def _normalize_numbers(tokens: list[str]) -> list[str]:
    """Map number-words to digit form so 'twice' and '2' token-match."""
    return [_NUMBER_WORDS.get(t, t) for t in tokens]


def _tokenize(s: str) -> list[str]:
    return _normalize_numbers(
        _PUNCT_RE.sub(" ", str(s).lower()).split()
    )


def token_f1(prediction: str, reference: str) -> float:
    p, r = _tokenize(prediction), _tokenize(reference)
    if not p or not r:
        return 0.0
    rc = list(r)
    c = 0
    for t in p:
        if t in rc:
            c += 1
            rc.remove(t)
    if c == 0:
        return 0.0
    pr = c / len(p)
    rec = c / len(r)
    return 2 * pr * rec / (pr + rec)


def multiple_choice_match(prediction: str, ground_truth_letter: str) -> float:
    """Match a predicted multiple-choice letter/answer against the gold letter.

    Accepts:
      - bare letter ("A", "B)", "(C)", "The answer is D")
      - the full answer text (match by exact substring of any choice)
    Returns 1.0 on match, 0.0 otherwise.
    """
    gt = str(ground_truth_letter).strip().upper()
    if not gt:
        return 0.0
    pred = str(prediction).strip()
    if not pred:
        return 0.0
    # Case 1: first alphabetic letter mentioned inside a word-boundary/paren
    m = re.search(r"(?:^|[^A-Za-z])([A-Z])(?:[^A-Za-z]|$)", pred.upper())
    if m and m.group(1) == gt:
        return 1.0
    return 0.0


def accuracy_with_choices(
    prediction: str,
    gt_letter: str,
    choices: dict[str, str],
) -> float:
    """MCQ accuracy that also accepts prediction of the full answer text."""
    if multiple_choice_match(prediction, gt_letter) > 0:
        return 1.0
    gt_text = choices.get(gt_letter, "")
    if gt_text:
        pred_tokens = set(_tokenize(prediction))
        gt_tokens = set(_tokenize(gt_text))
        if gt_tokens and pred_tokens >= gt_tokens:
            return 1.0
    return 0.0

```

### Core Architecture Module: `EvolveMem/evolvemem/benchmarks/locomo.py`
```
"""LoCoMo benchmark adapter.

Data: data/locomo10.json — 10 conversations, 1986 QA pairs, categories 1–5.
Scoring: token-level F1 (matches SimpleMem paper setting).
"""

from __future__ import annotations

import json
from typing import Any

from .base import (
    BenchmarkAdapter,
    BenchmarkSample,
    QuestionMeta,
    token_f1,
)
from .metrics import compute_text_metrics


class LoCoMoAdapter(BenchmarkAdapter):
    name = "locomo"
    primary_metric = "f1"
    subcategory_keys = ("category",)

    def score_all(self, prediction: str, reference: str, qa: dict) -> dict:
        return compute_text_metrics(prediction, str(reference), want_sbert=False)

    def load(
        self,
        path: str,
        *,
        sample_indices: list[int] | None = None,
        max_qa: int | None = None,
    ) -> list[BenchmarkSample]:
        with open(path) as f:
            raw = json.load(f)
        if sample_indices is None:
            sample_indices = list(range(len(raw)))

        samples: list[BenchmarkSample] = []
        for si in sample_indices:
            s = raw[si]
            conv = s["conversation"]
            speaker_a = conv.get("speaker_a", "A")
            speaker_b = conv.get("speaker_b", "B")

            session_keys = sorted(
                [
                    k for k in conv
                    if k.startswith("session_") and not k.endswith("_date_time")
                ],
                key=lambda x: int(x.split("_")[1]),
            )
            sessions = []
            for sk in session_keys:
                date_str = conv.get(f"{sk}_date_time", "")
                turns_raw = conv[sk]
                if isinstance(turns_raw, str):
                    try:
                        turns = json.loads(turns_raw)
                    except json.JSONDecodeError:
                        turns = []
                elif isinstance(turns_raw, list):
                    turns = turns_raw
                else:
                    turns = []
                sessions.append((sk, date_str, turns))

            qa_pairs = []
            for qi, qa in enumerate(s.get("qa", [])):
                ref = qa.get("answer") or qa.get("adversarial_answer", "")
                extras = {
                    "evidence": qa.get("evidence", []),
                    "adversarial_answer": qa.get("adversarial_answer"),
                }
                qa_pairs.append({
                    "question": qa["question"],
                    "answer": ref,
                    "category": int(qa.get("category", 0)),
                    "meta": QuestionMeta(
                        qid=f"{s.get('sample_id', si)}-{qi}",
                        qtype=f"cat{qa.get('category', 0)}",
                        extras=extras,
                    ).__dict__,
                })

            if max_qa is not None:
                qa_pairs = qa_pairs[:max_qa]

            samples.append(BenchmarkSample(
                sample_id=str(s.get("sample_id", si)),
                sessions=sessions,
                qa_pairs=qa_pairs,
                benchmark=self.name,
                metadata={
                    "speaker_a": speaker_a,
                    "speaker_b": speaker_b,
                    "n_sessions": len(sessions),
                },
            ))
        return samples

    def score(self, prediction: str, reference: str, qa: dict) -> float:
        return token_f1(prediction, reference)

    def build_answer_prompt(
        self,
        question: str,
        context: str,
        qa: dict,
    ) -> tuple[str, str]:
        """Per-category prompt, gated by evolvable RetrievalConfig flags.

        The framework's answer-prompt surface is itself an evolvable
        action: each `locomo_cat{N}_*` flag (attached to qa via
        `_ret_config_flags` by the engine) turns on a stricter,
        gold-aligned prompt for that category. With all flags off (the
        weak initial), the prompt is the original concise default -- so
        the legacy evolution trajectory is preserved and the diagnosis
        LLM must explicitly propose a flag when it observes matching
        failures in raw_results.jsonl.
        """
        category = int(qa.get("category", 0))
        flags = qa.get("_ret_config_flags") or {}

        system = (
            "Professional Q&A assistant. Concise answers grounded in context. "
            "JSON output only."
        )

        # ── Cat 5: Adversarial ───────────────────────────────────────
        if category == 5:
            extras = (qa.get("meta") or {}).get("extras") or {}
            adv = extras.get("adversarial_answer")
            use_mcq = bool(flags.get("locomo_cat5_mcq")) and bool(adv)
            if use_mcq:
                opt_a = "Not mentioned in the conversation"
                opt_b = str(adv).strip()
                import hashlib
                if int(hashlib.md5(question.encode()).hexdigest(), 16) % 2 == 0:
                    opt_a, opt_b = opt_b, opt_a
                user = (
                    "This is an ADVERSARIAL-NAME-SWAP question. The person "
                    "name in the question has been DELIBERATELY SWAPPED. "
                    "One option is the swap trap ('Not mentioned in the "
                    "conversation') and the other is a concrete factual "
                    "claim about a topic that appears in the conversation.\n\n"
                    f"Question: {question}\n\nContext:\n{context}\n\n"
                    f"Option A: {opt_a}\n"
                    f"Option B: {opt_b}\n\n"
                    "Step-by-step approach:\n"
                    "1. Identify the TOPIC / EVENT / ACTIVITY in the "
                    "concrete option (ignore ALL person names).\n"
                    "2. Scan EVERY context snippet for ANY mention of that "
                    "topic, event, or activity.\n"
                    "3. If ANY context snippet discusses the topic (even "
                    "attributed to a DIFFERENT person, or paraphrased, or "
                    "in a different session) -> pick the CONCRETE option.\n"
                    "4. ONLY pick 'Not mentioned in the conversation' when "
                    "ZERO context snippets relate to the topic.\n\n"
                    "Critical rules:\n"
                    "- The context may attribute the topic to a DIFFERENT "
                    "person than the question asks about. This is expected "
                    "(name-swap). It still counts as the topic being "
                    "mentioned. Pick the concrete option.\n"
                    "- When in doubt, ALWAYS prefer the concrete option. "
                    "'Not mentioned' is correct ONLY for topics completely "
                    "absent from all context.\n"
                    "- Output the chosen option's FULL TEXT verbatim in "
                    "the 'answer' field (do NOT output 'A' or 'B').\n"
                    "Return JSON: {\"reasoning\":\"brief topic scan\","
                    "\"answer\":\"<full chosen option text>\"}"
                )
            else:
                # Legacy: name-swap-aware generation (original weak behaviour)
                user = (
                    "Answer based on the context.\n\n"
                    "IMPORTANT: This question may deliberately swap person "
                    "names. The CONTEXT contains the TRUE information; answer "
                    "based on the context even if the question names seem off.\n\n"
                    f"Question: {question}\n\nContext:\n{context}\n\n"
                    "Rules:\n"
                    "1. ALWAYS provide a substantive answer; never 'not specified'.\n"
                    "2. Answer in 1-5 words using exact facts from context.\n"
                    "Return JSON: {\"reasoning\":\"brief\",\"answer\":\"concise\"}"
                )
            return system, user

        # ── Cat 1: SingleHop (strict format gated by flag) ──────────
        if category == 1 and flags.get("locomo
```

### Core Architecture Module: `EvolveMem/evolvemem/benchmarks/longmemeval.py`
```
"""LongMemEval adapter (ICLR 2025, arXiv 2410.10813).

Data: data/longmemeval/longmemeval_{oracle,s,m}.json — 500 questions each.
  - oracle: only the gold sessions present (easiest)
  - s: ~50 sessions haystack
  - m: ~500 sessions haystack

Schema: list of records, each:
  {question_id, question_type, question, answer, question_date,
   haystack_dates, haystack_session_ids, haystack_sessions, answer_session_ids}

  haystack_sessions: list of session-transcripts, each a list of
      {role: user|assistant, content, has_answer}

Each record maps to one BenchmarkSample (sessions from its own haystack,
one QA pair).

Scoring: token-level F1 against gold answer.
  (LongMemEval paper uses GPT-4-judge; we implement both — default F1 for
   cheap iteration, LLM-judge available when needed.)

Question-type -> canonical category mapping:
  temporal-reasoning -> 2 (Temporal)
  multi-session     -> 3 (MultiHop)
  knowledge-update  -> 4 (OpenDomain-ish; knowledge updates over time)
  single-session-user        -> 1 (SingleHop)
  single-session-assistant   -> 1
  single-session-preference  -> 1
"""

from __future__ import annotations

import json
from typing import Any

from .base import (
    BenchmarkAdapter,
    BenchmarkSample,
    QuestionMeta,
    token_f1,
)
from .metrics import compute_text_metrics, llm_judge

_QTYPE_TO_CAT = {
    "temporal-reasoning": 2,
    "multi-session": 3,
    "knowledge-update": 4,
    "single-session-user": 1,
    "single-session-assistant": 1,
    "single-session-preference": 1,
}


def _turns_from_session(session: list[dict]) -> list[dict]:
    """Convert LongMemEval session turns to EvolveMem's {speaker, text}."""
    out = []
    for t in session:
        role = t.get("role", "user")
        speaker = "User" if role == "user" else "Assistant"
        out.append({
            "speaker": speaker,
            "text": t.get("content", ""),
            "has_answer": t.get("has_answer", False),
        })
    return out


class LongMemEvalAdapter(BenchmarkAdapter):
    name = "longmemeval"
    primary_metric = "f1"
    subcategory_keys = ("qtype",)

    # Optionally attach an llm_call at run-time to enable llm_judge in score_all
    llm_judge_call: Any = None

    def score_all(self, prediction: str, reference: str, qa: dict) -> dict:
        m = compute_text_metrics(prediction, str(reference), want_sbert=False)
        if self.llm_judge_call is not None:
            v = llm_judge(
                prediction, str(reference),
                qa.get("question", ""), self.llm_judge_call,
            )
            if v is not None:
                m["llm_judge"] = v
        return m

    def load(
        self,
        path: str,
        *,
        max_samples: int | None = None,
        qtype_filter: list[str] | None = None,
        stratify: bool = False,
        seed: int = 42,
    ) -> list[BenchmarkSample]:
        with open(path) as f:
            raw = json.load(f)

        if qtype_filter:
            raw = [r for r in raw if r.get("question_type") in qtype_filter]

        if max_samples is not None:
            if stratify:
                # Evenly distribute across qtypes; the oracle file is sorted
                # by qtype so naive head-slice biases to one class.
                import random
                rng = random.Random(seed)
                from collections import defaultdict
                by_q: dict[str, list] = defaultdict(list)
                for r in raw:
                    by_q[r.get("question_type", "")].append(r)
                per = max(1, max_samples // max(1, len(by_q)))
                picked: list = []
                for q, items in by_q.items():
                    rng.shuffle(items)
                    picked.extend(items[:per])
                # Top up to exactly max_samples if needed (extras from largest qtypes)
                extras_pool = [r for q, items in by_q.items() for r in items[per:]]
                rng.shuffle(extras_pool)
                if len(picked) < max_samples:
                    picked.extend(extras_pool[: max_samples - len(picked)])
                raw = picked[:max_samples]
            else:
                raw = raw[:max_samples]

        samples: list[BenchmarkSample] = []
        for r in raw:
            sessions_raw = r.get("haystack_sessions", [])
            session_ids = r.get("haystack_session_ids", [])
            session_dates = r.get("haystack_dates", [])

            sessions = []
            for idx, ses in enumerate(sessions_raw):
                sid = session_ids[idx] if idx < len(session_ids) else f"sess_{idx}"
                date_str = session_dates[idx] if idx < len(session_dates) else ""
                sessions.append((sid, date_str, _turns_from_session(ses)))

            qtype = r.get("question_type", "")
            qa_pairs = [{
                "question": r["question"],
                "answer": r.get("answer", ""),
                "category": _QTYPE_TO_CAT.get(qtype, 0),
                "meta": QuestionMeta(
                    qid=r.get("question_id", ""),
                    qtype=qtype,
                    extras={
                        "question_date": r.get("question_date", ""),
                        "answer_session_ids": r.get("answer_session_ids", []),
                    },
                ).__dict__,
            }]

            samples.append(BenchmarkSample(
                sample_id=r.get("question_id", ""),
                sessions=sessions,
                qa_pairs=qa_pairs,
                benchmark=self.name,
                metadata={"qtype": qtype, "n_sessions": len(sessions)},
            ))
        return samples

    def score(self, prediction: str, reference: str, qa: dict) -> float:
        return token_f1(prediction, reference)

    def build_answer_prompt(
        self,
        question: str,
        context: str,
        qa: dict,
    ) -> tuple[str, str]:
        meta = qa.get("meta", {}) or {}
        qtype = meta.get("qtype", "")
        extras = meta.get("extras", {}) if isinstance(meta, dict) else {}
        question_date = (extras or {}).get("question_date", "")

        system = (
            "You are a personal memory assistant answering a user's question "
            "based on past conversation snippets. Answer concisely and "
            "specifically. JSON output only."
        )
        date_prefix = (
            f"(The question is asked on {question_date}.)\n\n" if question_date else ""
        )
        if qtype == "temporal-reasoning":
            rule = (
                "This is a TEMPORAL question. Pay attention to dates in the "
                "context. Prefer the most recent relevant event."
            )
        elif qtype == "knowledge-update":
            rule = (
                "This is a KNOWLEDGE-UPDATE question. The user's situation "
                "may have changed over time — use the LATEST stated fact."
            )
        elif qtype == "multi-session":
            rule = (
                "This is a MULTI-SESSION AGGREGATION question. It typically "
                "asks HOW MANY / HOW MUCH / HOW OLD — the answer is almost "
                "always a single number. Carefully enumerate the relevant "
                "items across ALL sessions (do NOT double-count, do NOT miss "
                "any), then output ONLY the final integer or a compact numeric "
                "phrase. Examples of correct forms: '3', '43', '33 years'. "
                "Do NOT write prose like 'Three plants' or 'about 42' — "
                "write digits. If the question asks a count, output the count "
                "as an Arabic numeral only."
            )
        elif qtype == "single-session-preference":
            rule = (
                "Report the USER'S stated preference exactly as they expressed "
                "it (e.g., a color, a brand name, a style)."
            )
        else:
            rule = (
                "Answer using exact facts from the context. Be specific."
 
```

### Core Architecture Module: `EvolveMem/evolvemem/benchmarks/membench.py`
```
"""MemBench adapter (arXiv 2506.21605, ACL Findings 2025).

Data: data/membench/repo/MemData/{FirstAgent,ThirdAgent}/<category>.json
Each file: { topic: [ {tid, message_list, QA}, ... ] }
  - message_list: list of sessions, each a list of turns:
        {sid, user_message, assistant_message, time, place}
  - QA: single dict {qid, question, answer, target_step_id, choices, ground_truth, time}

Scoring: multiple-choice accuracy. `ground_truth` is the letter (A-D).

Categories (per paper):
  LowLevel (Participation-Factual):    simple, comparative, aggregative,
                                       conditional, knowledge_update,
                                       post_processing, noisy
  HighLevel (Participation-Reflective): highlevel
  Receptive (ThirdAgent overhearing):  same names under ThirdAgent/
  FirstAgent _rec variants             (optional, paper's receptive w/ history)
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from .base import (
    BenchmarkAdapter,
    BenchmarkSample,
    QuestionMeta,
    accuracy_with_choices,
)
from .metrics import compute_mcq_metrics

LOWLEVEL_CATS = [
    "simple", "comparative", "aggregative", "conditional",
    "knowledge_update", "post_processing", "noisy",
]
HIGHLEVEL_CATS = ["highlevel"]

# Canonical category id for diagnostics (small-int space distinct from LoCoMo's 1-5)
_CAT_ID = {
    "simple": 11,
    "comparative": 12,
    "aggregative": 13,
    "conditional": 14,
    "knowledge_update": 15,
    "post_processing": 16,
    "noisy": 17,
    "highlevel": 18,
    "highlevel_rec": 19,
    "lowlevel_rec": 20,
    "RecMultiSession": 21,
}


def _turns_from_session(session_raw: list[dict]) -> list[dict]:
    """A MemBench session stores paired user/assistant messages per turn.
    We split them into two EvolveMem turns per original turn.
    """
    turns = []
    for msg in session_raw:
        time_str = msg.get("time", "")
        place = msg.get("place", "")
        prefix = ""
        if time_str or place:
            prefix = f"[{time_str}" + (f" @ {place}" if place else "") + "] "
        if msg.get("user_message"):
            turns.append({
                "speaker": "User",
                "text": prefix + msg["user_message"],
            })
        if msg.get("assistant_message"):
            turns.append({
                "speaker": "Assistant",
                "text": prefix + msg["assistant_message"],
            })
    return turns


class MemBenchAdapter(BenchmarkAdapter):
    name = "membench"
    primary_metric = "accuracy"
    # Use qtype (string category name e.g. "simple"/"highlevel") not the int id
    subcategory_keys = ("agent", "qtype", "topic")

    def score_all(self, prediction: str, reference: str, qa: dict) -> dict:
        meta = qa.get("meta", {}) or {}
        extras = meta.get("extras", {}) if isinstance(meta, dict) else {}
        choices = (extras or {}).get("choices", {}) or {}
        gt = (extras or {}).get("ground_truth", "") or reference
        return compute_mcq_metrics(prediction, gt, choices)

    def load(
        self,
        path: str,
        *,
        agent: str = "FirstAgent",          # or "ThirdAgent"
        categories: list[str] | None = None,  # e.g. ["simple", "comparative"]
        topics: list[str] | None = None,      # filter to specific topics
        max_samples_per_file: int | None = None,
    ) -> list[BenchmarkSample]:
        """
        Args:
            path: base data dir, e.g. `data/membench/repo/MemData`.
            agent: `FirstAgent` or `ThirdAgent`.
            categories: subset of filenames (without `.json`); default = all 7
                        LowLevel categories (comparable with paper main table).
            topics: optional filter within each file's topic dict.
            max_samples_per_file: cap per-file for quick sanity runs.
        """
        agent_dir = os.path.join(path, agent)
        if not os.path.isdir(agent_dir):
            raise FileNotFoundError(agent_dir)

        if categories is None:
            categories = LOWLEVEL_CATS
        samples: list[BenchmarkSample] = []

        for cat in categories:
            fp = os.path.join(agent_dir, f"{cat}.json")
            if not os.path.exists(fp):
                continue
            with open(fp) as f:
                blob = json.load(f)
            for topic, records in blob.items():
                if topics and topic not in topics:
                    continue
                if max_samples_per_file is not None:
                    records = records[:max_samples_per_file]
                for rec in records:
                    tid = rec.get("tid", 0)
                    ml = rec.get("message_list", [])
                    sessions = []
                    for si, ses in enumerate(ml):
                        sid = f"{cat}_{topic}_{tid}_s{si}"
                        turns = _turns_from_session(ses)
                        # Use the first turn's time as the session date marker
                        date_str = ""
                        if ses and ses[0].get("time"):
                            date_str = ses[0]["time"]
                        sessions.append((sid, date_str, turns))

                    qa = rec.get("QA") or {}
                    if not qa:
                        continue
                    qa_pairs = [{
                        "question": qa.get("question", ""),
                        "answer": qa.get("answer", ""),
                        "category": _CAT_ID.get(cat, 0),
                        "meta": QuestionMeta(
                            qid=f"{agent}/{cat}/{topic}/{tid}",
                            qtype=cat,
                            extras={
                                "topic": topic,
                                "agent": agent,
                                "choices": qa.get("choices", {}),
                                "ground_truth": qa.get("ground_truth", ""),
                                "target_step_id": qa.get("target_step_id", []),
                                "question_time": qa.get("time", ""),
                            },
                        ).__dict__,
                    }]
                    samples.append(BenchmarkSample(
                        sample_id=f"{agent}_{cat}_{topic}_{tid}",
                        sessions=sessions,
                        qa_pairs=qa_pairs,
                        benchmark=self.name,
                        metadata={
                            "agent": agent, "category": cat, "topic": topic,
                            "n_sessions": len(sessions),
                        },
                    ))
        return samples

    def score(self, prediction: str, reference: str, qa: dict) -> float:
        meta = qa.get("meta", {}) or {}
        extras = meta.get("extras", {}) if isinstance(meta, dict) else {}
        choices = (extras or {}).get("choices", {})
        gt_letter = (extras or {}).get("ground_truth", "") or reference
        return accuracy_with_choices(prediction, gt_letter, choices)

    def build_answer_prompt(
        self,
        question: str,
        context: str,
        qa: dict,
    ) -> tuple[str, str]:
        meta = qa.get("meta", {}) or {}
        extras = meta.get("extras", {}) if isinstance(meta, dict) else {}
        choices = (extras or {}).get("choices", {}) or {}
        qtype = meta.get("qtype", "") if isinstance(meta, dict) else ""
        choices_text = "\n".join(
            f"  {letter}) {text}" for letter, text in sorted(choices.items())
        )
        system = (
            "You are a memory-grounded multiple-choice question answerer. "
            "You MUST pick exactly ONE letter (A/B/C/D). JSON only."
        )

        cat_hint = ""
        if qtype == "aggregative":
            cat_hint = (
                "\nThis is an AGGREGATION/COUNTING question. Before picking "
                "an answer:\n"
                "  a) List EVERY entity in the context t
```

### Core Architecture Module: `EvolveMem/evolvemem/benchmarks/metrics.py`
```
"""Multi-metric evaluation utilities for all benchmarks.

Each metric is optional — if the required library is missing, that metric
yields None (recorded explicitly so we know it's missing vs. zero).

Primary/heavyweight metrics (BERTScore, METEOR, SBERT) are opt-in because
they slow per-question eval by 100–1000× compared to F1.

Benchmark adapters declare which metrics they compute by overriding
`BenchmarkAdapter.all_metrics`.
"""

from __future__ import annotations

import math
import re
from functools import lru_cache
from typing import Any, Callable

_WORD_RE = re.compile(r"[A-Za-z0-9]+")


def _tok(text: str) -> list[str]:
    return [w.lower() for w in _WORD_RE.findall(str(text or ""))]


# ── Core text metrics (stdlib-only fallbacks) ──

def f1_token(pred: str, ref: str) -> float:
    """Token-overlap F1 (set-based, matches SimpleMem paper)."""
    p, r = set(_tok(pred)), set(_tok(ref))
    if not p or not r:
        return 0.0
    common = p & r
    if not common:
        return 0.0
    precision = len(common) / len(p)
    recall = len(common) / len(r)
    return 2 * precision * recall / (precision + recall)


def f1_multiset(pred: str, ref: str) -> float:
    """Token-overlap F1, multiset (matches older EvolveMem evolution.py)."""
    p, r = _tok(pred), _tok(ref)
    if not p or not r:
        return 0.0
    rc = list(r)
    c = 0
    for t in p:
        if t in rc:
            c += 1
            rc.remove(t)
    if c == 0:
        return 0.0
    precision = c / len(p)
    recall = c / len(r)
    return 2 * precision * recall / (precision + recall)


def exact_match(pred: str, ref: str) -> float:
    return 1.0 if _tok(pred) == _tok(ref) else 0.0


def contains_match(pred: str, ref: str) -> float:
    """1.0 if reference tokens are all contained in prediction."""
    p, r = set(_tok(pred)), set(_tok(ref))
    if not r:
        return 0.0
    return 1.0 if r <= p else 0.0


def _ngrams(tokens: list[str], n: int) -> list[tuple]:
    return [tuple(tokens[i : i + n]) for i in range(0, max(0, len(tokens) - n + 1))]


def bleu_n(pred: str, ref: str, n: int = 1) -> float:
    """Smoothed BLEU-n without nltk dependency. Brevity penalty applied."""
    p_toks = _tok(pred)
    r_toks = _tok(ref)
    if not p_toks or not r_toks:
        return 0.0
    p_ng = _ngrams(p_toks, n)
    r_ng = _ngrams(r_toks, n)
    if not p_ng:
        return 0.0
    from collections import Counter
    rc = Counter(r_ng)
    clipped = 0
    pc = Counter()
    for g in p_ng:
        pc[g] += 1
    for g, cnt in pc.items():
        clipped += min(cnt, rc.get(g, 0))
    # smoothing: add 1/(2^k) where k is number of zero n-gram overlaps
    if clipped == 0:
        clipped = 0.5
    precision = clipped / len(p_ng)
    # brevity penalty
    bp = 1.0 if len(p_toks) >= len(r_toks) else math.exp(1 - len(r_toks) / max(1, len(p_toks)))
    return precision * bp


def rouge_l(pred: str, ref: str) -> float:
    """ROUGE-L F-score via LCS."""
    p, r = _tok(pred), _tok(ref)
    if not p or not r:
        return 0.0
    # LCS table
    m, n = len(p), len(r)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if p[i - 1] == r[j - 1]:
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])
    lcs = dp[m][n]
    if lcs == 0:
        return 0.0
    precision = lcs / m
    recall = lcs / n
    return 2 * precision * recall / (precision + recall)


# ── Optional heavyweight metrics (lazy imports) ──

@lru_cache(maxsize=1)
def _sbert():
    try:
        from sentence_transformers import SentenceTransformer
        return SentenceTransformer("all-MiniLM-L6-v2")
    except Exception:
        return None


def sbert_similarity(pred: str, ref: str) -> float | None:
    model = _sbert()
    if model is None or not pred or not ref:
        return None
    try:
        a = model.encode([pred], normalize_embeddings=True)
        b = model.encode([ref], normalize_embeddings=True)
        return float((a @ b.T)[0][0])
    except Exception:
        return None


def rougel_scorer(pred: str, ref: str) -> float | None:
    try:
        from rouge_score import rouge_scorer
        s = rouge_scorer.RougeScorer(["rougeL"], use_stemmer=True).score(ref, pred)
        return float(s["rougeL"].fmeasure)
    except Exception:
        return None


# ── MCQ metrics ──

_LETTER_RE = re.compile(r"(?:^|[^A-Za-z])([A-D])(?:[^A-Za-z]|$)")


def mcq_accuracy(pred: str, gt_letter: str) -> float:
    gt = str(gt_letter).strip().upper()
    if not gt:
        return 0.0
    m = _LETTER_RE.search(str(pred).upper())
    return 1.0 if (m and m.group(1) == gt) else 0.0


def mcq_accuracy_with_text(pred: str, gt_letter: str, choices: dict[str, str]) -> float:
    """MCQ accuracy that also accepts full answer text (partial credit)."""
    if mcq_accuracy(pred, gt_letter) > 0:
        return 1.0
    gt_text = choices.get(gt_letter, "") if isinstance(choices, dict) else ""
    if not gt_text:
        return 0.0
    pt = set(_tok(pred))
    gt_t = set(_tok(gt_text))
    if not gt_t:
        return 0.0
    return 1.0 if gt_t <= pt else 0.0


# ── LLM-as-judge (LongMemEval style, optional) ──

JUDGE_PROMPT = """You are a strict grader. Given a question, a gold answer, and a predicted answer, decide if the prediction is correct.

Question: {question}
Gold answer: {reference}
Predicted answer: {prediction}

Return ONLY one token: YES if the prediction conveys the same factual content as the gold answer (minor paraphrase ok), otherwise NO."""


def llm_judge(
    prediction: str,
    reference: str,
    question: str,
    llm_call: Callable | None,
) -> float | None:
    if llm_call is None:
        return None
    try:
        resp = llm_call(
            [
                {"role": "system", "content": "You are a strict grader. Answer YES or NO only."},
                {"role": "user", "content": JUDGE_PROMPT.format(
                    question=question, reference=reference, prediction=prediction,
                )},
            ],
            8, 0.0,
        )
        if not resp:
            return None
        return 1.0 if "yes" in resp.strip().lower() else 0.0
    except Exception:
        return None


# ── Bundles by benchmark ──

def compute_text_metrics(pred: str, ref: str, want_sbert: bool = False) -> dict[str, float]:
    """Cheap-to-compute text metrics always runnable."""
    out = {
        "f1": f1_multiset(pred, ref),
        "f1_set": f1_token(pred, ref),
        "exact_match": exact_match(pred, ref),
        "contains": contains_match(pred, ref),
        "rouge_l": rouge_l(pred, ref),
        "bleu_1": bleu_n(pred, ref, n=1),
        "bleu_4": bleu_n(pred, ref, n=4),
    }
    rs = rougel_scorer(pred, ref)
    if rs is not None:
        out["rouge_l_official"] = rs
    if want_sbert:
        sb = sbert_similarity(pred, ref)
        if sb is not None:
            out["sbert_sim"] = sb
    return out


def compute_mcq_metrics(pred: str, gt_letter: str, choices: dict) -> dict[str, float]:
    return {
        "accuracy": mcq_accuracy(pred, gt_letter),
        "accuracy_text": mcq_accuracy_with_text(pred, gt_letter, choices or {}),
    }

```

### Core Architecture Module: `EvolveMem/evolvemem/candidate.py`
```
from __future__ import annotations

from dataclasses import replace

from .policy_store import MemoryPolicyState


def generate_policy_candidates(current: MemoryPolicyState) -> list[MemoryPolicyState]:
    """Generate a small bounded candidate set around the current live policy.

    Varies retrieval mode, injection budget, and retrieval weight parameters
    to produce diverse but bounded candidates.
    """
    candidates: list[MemoryPolicyState] = []
    seen: set[tuple] = set()

    # Phase 1: Vary mode, units, and tokens (original grid).
    for retrieval_mode in _candidate_modes(current.retrieval_mode):
        for units in _candidate_units(current.max_injected_units):
            for tokens in _candidate_tokens(current.max_injected_tokens):
                candidate = replace(
                    current,
                    retrieval_mode=retrieval_mode,
                    max_injected_units=units,
                    max_injected_tokens=tokens,
                    notes=list(current.notes) + ["candidate_generated"],
                )
                key = _candidate_key(candidate)
                if key in seen:
                    continue
                seen.add(key)
                candidates.append(candidate)

    # Phase 2: Vary weight parameters around current values.
    weight_variants = _candidate_weight_variants(current)
    for variant in weight_variants:
        key = _candidate_key(variant)
        if key in seen:
            continue
        seen.add(key)
        candidates.append(variant)

    return candidates


def _candidate_key(candidate: MemoryPolicyState) -> tuple:
    return (
        candidate.retrieval_mode,
        candidate.max_injected_units,
        candidate.max_injected_tokens,
        round(candidate.keyword_weight, 2),
        round(candidate.metadata_weight, 2),
        round(candidate.importance_weight, 2),
        round(candidate.recency_weight, 2),
    )


def _candidate_modes(current_mode: str) -> list[str]:
    modes = [current_mode]
    if current_mode == "keyword":
        modes.append("hybrid")
    elif current_mode == "hybrid":
        modes.extend(["keyword", "embedding"])
    elif current_mode == "embedding":
        modes.append("hybrid")
    return modes


def _candidate_units(current_units: int) -> list[int]:
    values = {max(4, current_units - 2), current_units, min(10, current_units + 2)}
    return sorted(values)


def _candidate_tokens(current_tokens: int) -> list[int]:
    values = {max(400, current_tokens - 200), current_tokens, min(1400, current_tokens + 200)}
    return sorted(values)


def _candidate_weight_variants(current: MemoryPolicyState) -> list[MemoryPolicyState]:
    """Generate weight-variant candidates by perturbing retrieval weights."""
    variants: list[MemoryPolicyState] = []

    # Vary keyword weight.
    for delta in [-0.2, 0.2]:
        kw = _clamp(current.keyword_weight + delta, 0.3, 2.0)
        if round(kw, 2) != round(current.keyword_weight, 2):
            variants.append(replace(
                current,
                keyword_weight=round(kw, 2),
                notes=list(current.notes) + ["candidate_generated", "keyword_weight_variant"],
            ))

    # Vary metadata weight.
    for delta in [-0.15, 0.15]:
        mw = _clamp(current.metadata_weight + delta, 0.1, 1.0)
        if round(mw, 2) != round(current.metadata_weight, 2):
            variants.append(replace(
                current,
                metadata_weight=round(mw, 2),
                notes=list(current.notes) + ["candidate_generated", "metadata_weight_variant"],
            ))

    # Vary importance weight.
    for delta in [-0.15, 0.15]:
        iw = _clamp(current.importance_weight + delta, 0.1, 1.0)
        if round(iw, 2) != round(current.importance_weight, 2):
            variants.append(replace(
                current,
                importance_weight=round(iw, 2),
                notes=list(current.notes) + ["candidate_generated", "importance_weight_variant"],
            ))

    # Vary recency weight.
    for delta in [-0.1, 0.1]:
        rw = _clamp(current.recency_weight + delta, 0.0, 0.8)
        if round(rw, 2) != round(current.recency_weight, 2):
            variants.append(replace(
                current,
                recency_weight=round(rw, 2),
                notes=list(current.notes) + ["candidate_generated", "recency_weight_variant"],
            ))

    return variants


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #76** (2026-07-24): **refactor: extract vector store backend interface**
  *Symptoms*: ## Summary  - introduce a provider-neutral `VectorStoreBackend` contract covering insertion, semantic search, full-text search, structured filtering, counting, enumeration, optimization, and clearing - move the existing LanceDB dense search, Tantivy/native FTS, and structured SQL filtering behavior into the default `LanceDBVectorStoreBackend` - keep embedding generation in the `VectorStore` facade and let a backend factory receive the resolved vector dimension - add focused contract tests with both the real LanceDB backend and a custom in-memory backend that owns all three retrieval paths  ## Rationale  The earlier dense-only boundary still left keyword search, structured retrieval, and empty-store checks tied directly to LanceDB. A second provider would therefore have needed to dual-write every record into LanceDB, creating hidden coupling and synchronization risk. This broader boundary makes one backend responsible for the complete multi-view index while keeping SimpleMem's existing hybrid retrieval orchestration unchanged.  ## Scope  This remains the abstraction-only first step discussed in #72. It adds no new storage provider, dependency, configuration key, or default behavior change. LanceDB and Tantivy remain the default implementation.  ## Validation  - `python -m pytest tests/test_vector_store_backend.py -q` — 8 passed - `ruff check` and `ruff format --check` on all changed Python files - `python -m compileall -q simplemem/core/database tests/test_vector_store_backend
  **Post-Mortem & Fix Analysis**:
  > Hi @Jiaaqiliu, I updated this PR after tracing the follow-up provider path more deeply. A dense-only boundary would still leave FTS, structured retrieval, empty-store checks, and lifecycle operations tied directly to LanceDB, so an external provider would need hidden dual writes and synchronization.  The PR now extracts a complete `VectorStoreBackend` covering semantic, keyword/FTS, structured retrieval, and lifecycle operations. `LanceDBVectorStoreBackend` preserves the current LanceDB/Tantivy behavior as the default, and SimpleMem's existing hybrid retrieval orchestration is unchanged.  Validation now includes 8 focused tests, a custom backend test proving all three retrieval paths work without creating a LanceDB store, and a real hosted embedding/completion end-to-end run. A review when you have a chance would be appreciated.
  > Merged — thanks, this is exactly the scoped first step we discussed in #72, and the execution is clean.  I verified it rather than taking the "no behavior change" claim on faith. What I checked:  **Behavior parity.** I built a differential harness that drives the public `VectorStore` API with a deterministic 3-dim embedder and ran it on `main` and on this branch: `semantic_search`, `keyword_search`, `structured_search` (persons / location / entities / timestamp range / no-filter), and `get_all_entries`. Results are byte-identical across both branches. The only diff in the whole output was the ordering of two informational log lines, because the FTS index is now created at a slightly different point.  **Security posture.** `simplemem/core/database/vector_store.py` had a filter-injection fix landed recently (#53), and a 194-line rewrite of that file was the thing I most wanted to confirm didn't regress. It doesn't — and it's actually tightened. `persons`, `entities` and the timestamp bou

- **Issue #74** (2026-07-22): **基于qwen2.5-3B的SimpleMem复现效果疑问**
  *Symptoms*: 作者您好， 最近在复现SimpleMem，LLM采用的qwen2.5-3B，滑动窗口按照论文中实现细节设置的W=20，k=20。 但是，实际复现出的效果和论文中的差距较大。请问是复现的过程中，哪个超参数设置或者步骤有问题吗？ 最后，十分感谢您的开源，静候您的回复。 <img width="307" height="112" alt="Image" src="https://github.com/user-attachments/assets/1806e153-ef0f-4915-b281-1e24a23f24f5" /> 

- **Issue #73** (2026-07-18): **docs: fix PACKAGE_USAGE.md to match current public API**
  *Symptoms*: ### What  `docs/PACKAGE_USAGE.md` documented a public API that no longer exists. Every code sample imported `SimpleMemSystem`, `SimpleMemConfig`, `set_config`, `create_system`, `Dialogue` and `MemoryEntry` straight from the top-level `simplemem` package, but the package now exports only:  ```python __all__ = ["SimpleMem", "create", "list_modes", "optimize", "Config", "load_config"] ```  So the guide first example (`from simplemem import SimpleMemSystem`) raises `ImportError`, and the `SimpleMemConfig` / `set_config` configuration pattern is gone entirely.  The Environment Variables section also listed variables the package never reads (`SIMPLEMEM_MODEL`, `SIMPLEMEM_EMBEDDING_MODEL`, `SIMPLEMEM_DB_PATH`). The settings loader (`simplemem/core/settings.py`) actually resolves `LLM_MODEL`, `EMBEDDING_MODEL` and `LANCEDB_PATH`.  ### Changes  - Rewrite all snippets to the current API: `SimpleMem()` (auto mode) and `create(mode="text"|"omni", ...)`. - Replace the removed `SimpleMemConfig` / `set_config` section with the real configuration model (constructor kwargs, `config.py`, env vars) and document the resolution order. - Fix the environment-variable table to the names actually honored by `settings.py`. - Point `Dialogue` / `MemoryEntry` imports at `simplemem.core.models.memory_entry`. - Keep the optimized-retrieval flow (`optimize` -> `Config` -> `load_config`) consistent with the README.  Docs-only; no code changes.

- **Issue #72** (2026-07-18): **Proposal: pluggable dense vector backend and optional Milvus support**
  *Symptoms*: Hi maintainers,  I was looking at SimpleMem's database layer and noticed that the current `VectorStore` path appears to combine dense vector search, full-text search, and structured metadata handling around LanceDB / Tantivy / SQL metadata.  Would you be open to a pluggable vector-storage boundary so users can keep the SimpleMem APIs while choosing a different dense vector backend, such as Milvus?  A possible scoped shape:  1. Keep the current LanceDB/Tantivy path as the default implementation. 2. Split a narrow dense-vector backend contract from the higher-level memory/search logic. 3. Add an optional Milvus backend for dense vector storage and retrieval. 4. Keep structured metadata and FTS behavior aligned with the current product semantics. 5. Support Milvus Lite for local development and Milvus server / Zilliz Cloud for larger deployments. 6. Add focused tests for insert/search/filter behavior and score ordering.  Would this kind of backend abstraction be a good fit for SimpleMem, or is the current storage design intended to stay tightly coupled to LanceDB/Tantivy?
  **Post-Mortem & Fix Analysis**:
  > Thanks for the thoughtful proposal — this is a reasonable direction.  You're reading the current design correctly: the storage layer is presently coupled to LanceDB (dense vectors + FTS) with structured metadata handled around it, rather than sitting behind a narrow, swappable dense-vector contract. There's nothing philosophically opposed to a pluggable backend; the current coupling is just how it grew, not a deliberate lock-in.  The scoped shape you outlined is sensible — in particular:  1. Keep the LanceDB/Tantivy path as the default. 2. Extract a small dense-vector backend interface (insert / search / filter / score-ordering) from the higher-level memory + hybrid-retrieval logic. 3. Add an optional Milvus backend (Milvus Lite for local, server/Zilliz for scale) behind that interface. 4. Keep structured metadata + FTS semantics aligned with today's behavior.  The main things I'd want to preserve are (a) the hybrid retrieval semantics (vector + keyword + structured filters must stay c

- **Issue #71** (2026-07-18): **Add Requesty as an LLM provider**
  *Symptoms*: Adds Requesty as an LLM/embedding provider alongside the existing OpenRouter and Ollama integrations.  Requesty (https://router.requesty.ai/v1) is an OpenAI-compatible router, so the integration mirrors the existing OpenRouter provider: - New `RequestyClient` / `RequestyClientManager` in `server/integrations/requesty.py` (async httpx client, `Bearer REQUESTY_API_KEY` auth, same `provider/model` naming e.g. `openai/gpt-4.1-mini`, same JSON-extraction helpers). `verify_api_key` uses the OpenAI-compatible `/models` endpoint. - Registered in `integrations/__init__.py` exports, `config/settings.py` (`LLM_PROVIDER=requesty`, `REQUESTY_BASE_URL`, default https://router.requesty.ai/v1), and the `http_server` client-manager factory + `/api/auth/register` validation branch. - Added a synchronous skill util (`SKILL/simplemem-skill/src/utils/requesty.py`) and `references/requesty-guide.md` mirroring the OpenRouter skill files. - Documented in `.env.example`, README, and the skill READMEs. - Changes are applied to both the top-level `MCP/` + `SKILL/` trees and their `simplemem/integrations/` mirrors to keep them in sync.  Set `LLM_PROVIDER=requesty` and register with a Requesty API key (https://app.requesty.ai/api-keys) to use it. Docs: https://docs.requesty.ai  Verification: - `py_compile` passes on all new/edited Python files. - Live test against https://router.requesty.ai/v1 through the new `RequestyClient`: `verify_api_key()` returned True, and `chat_completion(openai/gpt-4o-mini)` re

- **Issue #70** (2026-07-24): **Mcp for omnisimplemem**
  *Symptoms*: Any update on omnisimplemem for all mcp tool update? 
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for the interest.  Could you say a bit more about what you're after? To clarify the current state:  - The MCP server (multi-tenant memory over Streamable HTTP + a legacy SSE transport) lives under `MCP/` and its mirror `simplemem/integrations/`, and exposes the memory tools (`memory_add`, `memory_query`, etc.). - `OmniSimpleMem/` is the multimodal (text/image) memory package.  If you're asking for the full Omni/multimodal memory pipeline to be exposed through the MCP tool interface (i.e. multimodal `memory_add`/`memory_query` over MCP), that isn't wired up yet. If that's the ask, let me know your concrete use case and I'll track it as a feature request — otherwise, please share which specific tools you need and I'm happy to point you to the right entry points. 
  > Thanks for your reponse. I have been waiting for the full mcp version of omnisimplemem as currently multi modal are python only. I have been waiting for full mcp support for it with url support for minio and s3 and Google drive direct link sipport and file upload as input for image, audio, video and doc for memory and seperate isolated memory cluster for agents. And advance mem search to segmenting object, characters etc in multiframe image like segment anything meta to map graph search for similar objects, person etc from image search. Along with art style search to know like retro, anime etc. Similarly advance audio search and video search.   In previous version I had worked on sampling In my custom simplemem but have been eagerly waiting for full mcp support with these features. 
  > Any update? 

- **Issue #69** (2026-07-18): **Question about the "Omni" claim: how were audio/video modules actually discovered and evaluated without corresponding benchmarks?**
  *Symptoms*: Hi, Omini-SimpleMem Team:   The paper claims support for text, image, audio and video memory. However, the reported benchmarks (LoCoMo and Mem-Gallery) appear to evaluate only text and image modalities. How were the audio and video components optimized and validated during the autoresearch process?  Thanks!
  **Post-Mortem & Fix Analysis**:
  > Good question, and a fair one to ask.  To be precise about what is and isn't benchmarked:  - **Architecturally**, the system defines all four modalities (`ModalityType.TEXT/IMAGE/AUDIO/VIDEO`) and has the corresponding ingestion machinery — e.g. entropy-based triggers for audio and visual streams (`triggers/audio_trigger.py`, `triggers/visual_trigger.py`) and a Whisper-based transcription path in the config. So the pipeline can ingest and store audio/video-derived memory units. - **Quantitatively**, the reported benchmarks (LoCoMo and Mem-Gallery) exercise the **text and image** modalities. There isn't a corresponding audio/video benchmark in the repo, and I don't want to claim quantitative validation we didn't run — the audio/video support is architectural/qualitative at this point, not something with head-to-head benchmark numbers behind it.  I think the honest fix here is documentation: I'll make the README clear about which modalities have quantitative benchmark results versus whic
  > Thanks for your clarification! 

- **Issue #68** (2026-07-18): **Doubt about Omini-SimpleMem SOTA adapters cheating Mem-Gallery with category-conditioned retrieval routing**
  *Symptoms*: Thanks for your impressive work!    Several high-scoring Mem-Gallery reproductions (e.g., Omni-SimpleMem) route retrieval differently per task category. Questions carry oracle labels such as `[FR]`, `[TR]`, `[KR]` (or equivalent category metadata). Adapters parse these labels and apply **hard-coded, category-specific retrieval rules** on top of the memory backend.  This is not general-purpose memory retrieval — it is **benchmark-tuned routing that requires knowing the task type at test time**. Reported F1 numbers may therefore overstate deployable memory capability.  The adapter applies the following rules (example: Omni-SimpleMem `benchmarks/memgallery/adapter.py`): | Category | Heuristic behavior | |----------|-------------------| | **FR** | Larger `top_k` (30; up to 40 for “list all / how many” questions) | | **KR** |  extra BM25 merge to surface both old and updated facts | | **TR / CD** | Post-retrieval **chronological reordering** by `session_id` + `dialogue_id` | | **VS / VR** | Separate visual path using an **image catalog BM25** over caption text | | **TTL** | Additional image-catalog lookup when `image_caption:` appears in the query |  Please clarify whether category-conditioned retrieval is part of the intended Omini-SimpleMem design. If not, please: 1. Document this behavior explicitly in the benchmark README 2. Report scores without category-aware retrieval routing  Looking forward to your reply! @Jiaaqiliu 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed and fair critique — I want to answer it straight rather than defensively.  You've described the current `benchmarks/memgallery/adapter.py` accurately. It does parse the category markers from the questions (`[FR]`, `[TR]`, `[KR]`, `[VS]`, `[VR]`, `[CD]`, `[TTL]`, etc.) and apply category-conditioned retrieval on top of the memory backend, specifically:  - category-dependent `top_k` (`_get_dynamic_top_k`, with a larger budget for `FR`, and up to 40 for "list all / how many" questions), - an extra BM25 merge for `KR` (and for `FR` list questions), - a separate image-catalog BM25 path for `VS`/`VR`, - and category-influenced handling for the time/detail categories.  So your core observation is correct: as written, that adapter uses the task-category label at retrieval time, which means those specific numbers reflect category-aware routing rather than a single category-agnostic retrieval policy. That's an important distinction for anyone interpreting the scores, and 

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

### Incident Patch 1: `836ce971` (2026-07-24)
**Commit Message**: feat(omni): add MCP server for Omni-SimpleMem multimodal memory (#70)

Exposes the Omni-Memory pipeline to any MCP client over the stdio transport,
so the multimodal memory is no longer reachable only from Python.

Tools (12): omni_add_text / omni_add_image / omni_add_audio / omni_add_video /
omni_add_document, omni_query / omni_answer, plus omni_stats, omni_list_events,
omni_consolidate, omni_list_namespaces and omni_delete_namespace.

Highlights:
- Isolated per-agent memory clusters. Every tool takes an optional 'namespace';
  each one gets its own storage, MAU store, vector index and event store.
  Namespace names are validated so they cannot traverse the filesystem.
  Orchestrators load lazily behind an LRU cache and reload transparently.
- Media references resolve from local paths, file://, http(s)://, Google Drive
  share links, s3:// (S3 or MinIO via S3_ENDPOINT_URL) and gs://, with a
  download size cap and an option to disable remote fetching entirely.
- Documents (.txt/.md/.json/.csv/.yaml/.pdf/.docx) are text-extracted and stored.
- Media type is validated before ingestion, so passing a .txt to the video tool
  errors instead of storing a meaningless memory unit.
- The s

**File**: `OmniSimpleMem/README.md` (modified, +21/-0)
```diff
@@ -91,12 +91,33 @@ python examples/api_server.py
 
 </details>
 
+<details>
+<summary>🔌 MCP Server (use Omni-SimpleMem from any MCP client)</summary>
+
+Expose multimodal memory to Claude Desktop or any MCP client over stdio:
+
+```bash
+python -m omni_mcp --data-dir ~/.omni_simplemem/mcp
+```
+
+Provides 12 tools — `omni_add_text` / `omni_add_image` / `omni_add_audio` /
+`omni_add_video` / `omni_add_document`, `omni_query` / `omni_answer`, plus
+namespace management. Media arguments accept local paths, `http(s)://`, Google
+Drive share links, `s3://` (S3 or MinIO) and `gs://`. Every tool takes an
+optional `namespace` giving each agent a fully isolated memory cluster.
+
+See [`omni_mcp/README.md`](omni_mcp/README.md) for setup, tool reference and
+configuration.
+
+</details>
+
 <details>
 <summary>📝 More examples</summary>
 
 - [`examples/quickstart.py`](examples/quickstart.py) — Basic text memory
 - [`examples/multimodal_memory.py`](examples/multimodal_memory.py) — Multimodal content
 - [`examples/api_server.py`](examples/api_server.py) — FastAPI REST server
+- [`omni_mcp/`](omni_mcp/) — MCP server (multimodal memory over stdio)
 
 </details>
 
```

**File**: `OmniSimpleMem/omni_mcp/README.md` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+# Omni-SimpleMem MCP Server
+
+Exposes the Omni-SimpleMem multimodal memory pipeline (text, image, audio, video,
+documents) to any MCP client over the **stdio transport**, with **isolated
+per-agent memory namespaces**.
+
+This complements the existing text-oriented MCP server under `MCP/`: that one is
+a multi-tenant HTTP service, this one is a local stdio server built directly on
+`OmniMemoryOrchestrator`, so it can reach the multimodal processors and the local
+filesystem (needed for image/audio/video/document ingestion).
+
+## Install
+
+```bash
+cd OmniSimpleMem
+pip install -r requirements.txt          # core Omni-Memory dependencies
+
+# Optional, only if you use the matching feature:
+pip install boto3                        # s3:// (AWS S3 or MinIO)
+pip install google-cloud-storage         # gs:// (Google Cloud Storage)
+pip install pypdf                        # .pdf documents
+pip install python-docx                  # .docx documents
+```
+
+## Run
+
+```bash
+python -m omni_mcp --data-dir ~/.omni_simplemem/mcp
+```
+
+The server speaks newline-delimited JSON-RPC 2.0 on stdin/stdout. It is normally
+launched by an MCP client rather than by hand.
+
+### Claude Desktop
+
+Add to `claude_desktop_config.json`:
+
+```json
+{
+  "mcpServers": {
+    "omni-simplemem": {
+      "command": "python",
+      "args": ["-m", "omni_mcp", "--data-dir", "~/.omni_simplemem/mcp"],
+      "cwd": "/absolute/path/to/SimpleMem/OmniSimpleMem",
+      "env": {
+        "OPENAI_API_KEY": "sk-...",
+        "PYTHONPATH": "/absolute/path/to/SimpleMem/OmniSimpleMem"
+      }
+    }
+  }
+}
+```
+
+## Tools
+
+| Tool | Purpose |
+|------|---------|
+| `omni_add_text` | Store text as an atomic memory unit |
+| `omni_add_image` | Store an image (captioned + embedded, entropy-triggered) |
+| `omni_add_audio` | Store audio (transcribed, VAD-triggered) |
+| `omni_add_video` | Store a video (only visually significant frames) |
+| `omni_add_document` | Extract text from `.txt/.md/.json/.csv/.yaml/.pdf/.docx` and store it |
+| `omni_query` | Retrieve relevant memory summaries |
+| `omni_answer` | Retrieval-augmented answer over memory |
+| `omni_stats` | Memory statistics for a namespace |
+| `omni_list_events` | List event nodes (grouped memories) |
+| `omni_consolidate` | Run importance-based consolidation |
+| `omni_list_namespaces` | List all isolated memory clusters |
+| `omni_delete_namespace` | Permanently delete a namespace (needs `confirm: true`) |
+
+### Isolated memory clusters
+
+Every tool takes an optional `namespace`. Each namespace is a **fully separate
+memory cluster** — its own storage directory, MAU store, vector index and event
+store — so multiple agents can share one server without seeing each other's
+memories.
+
+```jsonc
+{"name": "omni_add_text",
+ "arguments": {"text": "Design review moved to Friday.", "namespace": "agent_planner"}}
+```
+
+Namespace names are restricted to `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`; anything
+that could traverse the filesystem (`../`, `/`, absolute paths) is rejected.
+
+Orchestrators are loaded lazily and kept in an LRU cache
+(`--max-open-namespaces`, default 8); evicted namespaces are saved to disk and
+transparently reloaded on next use.
+
+### Media references
+
+Any media argument accepts:
+
+| Form | Example |
+|------|---------|
+| Local path | `/data/photo.png` |
+| File URI | `file:///data/photo.png` |
+| HTTP(S) | `https://example.com/clip.mp4` |
+| Google Drive share link | `https://drive.google.com/file/d/<id>/view` |
+| S3 / MinIO | `s3://bucket/key` |
+| Google Cloud Storage | `gs://bucket/object` |
+
+For **MinIO** (or any S3-compatible store) set the endpoint and credentials in
+the server's environment:
+
+```bash
+export S3_ENDPOINT_URL=https://minio.internal:9000
+export AWS_ACCESS_KEY_ID=...
+export AWS_SECRET_ACCESS_KEY=...
+```
+
+Remote objects are downloaded to a temp file, ingested, then deleted. Local
+files are never modified or removed.
+
+## Config
```

**File**: `OmniSimpleMem/omni_mcp/__init__.py` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+"""
+Omni-SimpleMem MCP server.
+
+Exposes the Omni-Memory multimodal memory pipeline (text, image, audio, video,
+documents) to any MCP client over the stdio transport, with isolated per-agent
+memory namespaces.
+
+Run it with::
+
+    python -m omni_mcp --data-dir ~/.omni_simplemem/mcp
+"""
+
+from .media import MediaError, resolve_media
+from .namespaces import DEFAULT_NAMESPACE, NamespaceError, NamespaceManager
+from .server import OmniMCPServer, main
+from .tools import ToolExecutor, tool_definitions
+
+__version__ = "1.0.0"
+
+__all__ = [
+    "OmniMCPServer",
+    "NamespaceManager",
+    "NamespaceError",
+    "DEFAULT_NAMESPACE",
+    "ToolExecutor",
+    "tool_definitions",
+    "resolve_media",
+    "MediaError",
+    "main",
+]
```

**File**: `OmniSimpleMem/omni_mcp/__main__.py` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+"""Entry point so the server can be started with ``python -m omni_mcp``."""
+
+from .server import main
+
+if __name__ == "__main__":
+    raise SystemExit(main())
```

**File**: `OmniSimpleMem/omni_mcp/media.py` (added, +362/-0)
```diff
@@ -0,0 +1,362 @@
+"""
+Media resolution for the Omni-SimpleMem MCP server.
+
+Turns a user-supplied media reference into a local file path that the
+Omni-Memory processors can consume. Supported reference forms:
+
+    /abs/path/img.png            local file
+    file:///abs/path/img.png     local file (URI form)
+    https://host/img.png         HTTP(S) download
+    https://drive.google.com/... Google Drive share link (converted to direct download)
+    s3://bucket/key              S3 / MinIO / any S3-compatible endpoint (boto3)
+    gs://bucket/key              Google Cloud Storage
+
+Remote backends are imported lazily so the server runs without boto3 or
+google-cloud-storage installed; a missing backend produces a clear,
+actionable error instead of an import crash at startup.
+"""
+
+from __future__ import annotations
+
+import os
+import re
+import shutil
+import tempfile
+from dataclasses import dataclass
+from pathlib import Path
+from typing import Optional
+from urllib.parse import urlparse, parse_qs
+
+# Maximum number of bytes we will pull from a remote source. Guards against a
+# mistyped URL streaming a multi-GB object into the agent's temp dir.
+DEFAULT_MAX_BYTES = 512 * 1024 * 1024  # 512 MB
+DEFAULT_TIMEOUT = 60  # seconds
+
+
+class MediaError(Exception):
+    """Raised when a media reference cannot be resolved."""
+
+
+@dataclass
+class ResolvedMedia:
+    """A media reference resolved to a local file."""
+
+    path: str
+    source: str
+    is_temporary: bool
+
+    def cleanup(self) -> None:
+        """Delete the file if we created it in a temp dir."""
+        if self.is_temporary:
+            try:
+                os.unlink(self.path)
+            except OSError:
+                pass
+
+
+def _max_bytes() -> int:
+    raw = os.getenv("OMNI_MCP_MAX_DOWNLOAD_BYTES")
+    if raw:
+        try:
+            return int(raw)
+        except ValueError:
+            pass
+    return DEFAULT_MAX_BYTES
+
+
+def _remote_enabled() -> bool:
+    """Remote fetching can be disabled entirely for locked-down deployments."""
+    return os.getenv("OMNI_MCP_DISABLE_REMOTE", "").strip().lower() not in ("1", "true", "yes")
+
+
+def _tempfile_for(suffix: str) -> str:
+    fd, path = tempfile.mkstemp(prefix="omni_mcp_", suffix=suffix)
+    os.close(fd)
+    return path
+
+
+def _suffix_from(name: str, default: str = "") -> str:
+    suffix = Path(urlparse(name).path).suffix
+    return suffix or default
+
+
+# --- Google Drive -----------------------------------------------------------
+
+_GDRIVE_FILE_RE = re.compile(r"/file/d/([A-Za-z0-9_-]+)")
+
+
+def _gdrive_direct_url(url: str) -> Optional[str]:
+    """Convert a Google Drive share link into a direct-download URL."""
+    parsed = urlparse(url)
+    if "drive.google.com" not in parsed.netloc and "docs.google.com" not in parsed.netloc:
+        return None
+
+    match = _GDRIVE_FILE_RE.search(parsed.path)
+    file_id = match.group(1) if match else None
+    if not file_id:
+        file_id = (parse_qs(parsed.query).get("id") or [None])[0]
+    if not file_id:
+        return None
+    return f"https://drive.google.com/uc?export=download&id={file_id}"
+
+
+# --- Backends ---------------------------------------------------------------
+
+def _fetch_http(url: str) -> ResolvedMedia:
+    try:
+        import requests
+    except ImportError as exc:  # pragma: no cover - requests is a base dependency
+        raise MediaError("HTTP downloads require the 'requests' package.") from exc
+
+    direct = _gdrive_direct_url(url)
+    target = direct or url
+
+    limit = _max_bytes()
+    try:
+        response = requests.get(target, stream=True, timeout=DEFAULT_TIMEOUT, allow_redirects=True)
+        response.raise_for_status()
+    except Exception as exc:
+        raise MediaError(f"Failed to download {url}: {exc}") from exc
+
+    suffix = _suffix_from(target)
+    if not suffix:
+        content_type = (response.headers.get("content-type") or "").split(";")[0].strip()

```

---

### Incident Patch 2: `8cd1bcac` (2026-07-18)
**Commit Message**: security: drop unused vulnerable langchain-openai dependency (#57)

langchain-openai==1.1.0 carried a known SSRF/DNS-rebinding advisory but is
not imported anywhere in the codebase and is not a transitive dependency
of any package we use, so it added attack surface for no benefit. Remove
the pin to eliminate the advisory.

**File**: `requirements.txt` (modified, +0/-1)
```diff
@@ -55,7 +55,6 @@ lancedb==0.25.3
 langchain==1.1.0
 langchain-anthropic==1.2.0
 langchain-core==1.1.0
-langchain-openai==1.1.0
 langgraph==1.0.4
 langgraph-checkpoint==3.0.1
 langgraph-prebuilt==1.0.5
```

---

### Incident Patch 3: `3792908b` (2026-07-18)
**Commit Message**: security: never combine wildcard CORS origin with credentials (#51)

allow_origins=['*'] together with allow_credentials=True let any site
make credentialed cross-origin calls (Starlette reflects the Origin).
Make origins configurable via CORS_ALLOWED_ORIGINS: with the default
wildcard, credentials are now disabled; credentials are only enabled when
an explicit origin allow-list is provided.

**File**: `MCP/server/http_server.py` (modified, +19/-2)
```diff
@@ -282,10 +282,27 @@ async def lifespan(app: FastAPI):
     lifespan=lifespan,
 )
 
+# CORS configuration.
+#
+# Combining a wildcard origin ("*") with allow_credentials=True is invalid per
+# the CORS spec (browsers reject it) and, when Starlette reflects the request
+# Origin, it effectively lets any site make credentialed cross-origin calls.
+# To avoid that, credentials are only enabled when an explicit allow-list of
+# origins is configured via CORS_ALLOWED_ORIGINS (comma-separated). With the
+# default wildcard, credentials are disabled so cross-origin credential theft
+# is not possible.
+_cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "*").strip()
+if _cors_origins_env == "*":
+    _cors_allow_origins = ["*"]
+    _cors_allow_credentials = False
+else:
+    _cors_allow_origins = [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
+    _cors_allow_credentials = True
+
 app.add_middleware(
     CORSMiddleware,
-    allow_origins=["*"],
-    allow_credentials=True,
+    allow_origins=_cors_allow_origins,
+    allow_credentials=_cors_allow_credentials,
     allow_methods=["*"],
     allow_headers=["*"],
 )
```

**File**: `simplemem/integrations/server/http_server.py` (modified, +19/-2)
```diff
@@ -282,10 +282,27 @@ async def lifespan(app: FastAPI):
     lifespan=lifespan,
 )
 
+# CORS configuration.
+#
+# Combining a wildcard origin ("*") with allow_credentials=True is invalid per
+# the CORS spec (browsers reject it) and, when Starlette reflects the request
+# Origin, it effectively lets any site make credentialed cross-origin calls.
+# To avoid that, credentials are only enabled when an explicit allow-list of
+# origins is configured via CORS_ALLOWED_ORIGINS (comma-separated). With the
+# default wildcard, credentials are disabled so cross-origin credential theft
+# is not possible.
+_cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "*").strip()
+if _cors_origins_env == "*":
+    _cors_allow_origins = ["*"]
+    _cors_allow_credentials = False
+else:
+    _cors_allow_origins = [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
+    _cors_allow_credentials = True
+
 app.add_middleware(
     CORSMiddleware,
-    allow_origins=["*"],
-    allow_credentials=True,
+    allow_origins=_cors_allow_origins,
+    allow_credentials=_cors_allow_credentials,
     allow_methods=["*"],
     allow_headers=["*"],
 )
```

---

### Incident Patch 4: `9a11b0ad` (2026-07-18)
**Commit Message**: security: warn when default JWT/encryption secrets are in use (#50)

The MCP server shipped with hardcoded default JWT and API-key encryption
secrets. Deploying without overriding them lets anyone read the source,
forge tokens and decrypt stored keys. Emit a prominent startup warning
(stderr + warnings) when either default is still active, so operators are
told to set JWT_SECRET_KEY / ENCRYPTION_KEY before exposing the server.
Kept non-fatal to avoid breaking local development.

**File**: `MCP/config/settings.py` (modified, +23/-0)
```diff
@@ -3,6 +3,8 @@
 """
 
 import os
+import sys
+import warnings
 from pathlib import Path
 from dataclasses import dataclass, field
 from typing import Optional
@@ -130,6 +132,27 @@ def __post_init__(self):
                 "In Docker, use a named volume for data (see docker-compose.yml) or ensure the mounted dir is writable by the container user."
             ) from e
 
+        # Warn loudly if the built-in default secrets are still in use. These
+        # defaults are only meant for local development; running with them in a
+        # shared/production deployment lets anyone who reads the source forge
+        # JWT tokens or decrypt stored API keys.
+        _default_jwt = "simplemem-secret-key-change-in-production"
+        _default_enc = "simplemem-encryption-key-32bytes!"
+        insecure = []
+        if self.jwt_secret_key == _default_jwt:
+            insecure.append("JWT_SECRET_KEY")
+        if self.encryption_key == _default_enc:
+            insecure.append("ENCRYPTION_KEY")
+        if insecure:
+            msg = (
+                "SECURITY WARNING: using built-in default value(s) for "
+                f"{', '.join(insecure)}. Set {' and '.join(insecure)} to strong, "
+                "unique secret(s) via environment variables before exposing this "
+                "server to any untrusted network."
+            )
+            warnings.warn(msg, stacklevel=2)
+            print(f"[SimpleMem] {msg}", file=sys.stderr)
+
 
 @lru_cache()
 def get_settings() -> Settings:
```

**File**: `simplemem/integrations/config/settings.py` (modified, +23/-0)
```diff
@@ -3,6 +3,8 @@
 """
 
 import os
+import sys
+import warnings
 from pathlib import Path
 from dataclasses import dataclass, field
 from typing import Optional
@@ -130,6 +132,27 @@ def __post_init__(self):
                 "In Docker, use a named volume for data (see docker-compose.yml) or ensure the mounted dir is writable by the container user."
             ) from e
 
+        # Warn loudly if the built-in default secrets are still in use. These
+        # defaults are only meant for local development; running with them in a
+        # shared/production deployment lets anyone who reads the source forge
+        # JWT tokens or decrypt stored API keys.
+        _default_jwt = "simplemem-secret-key-change-in-production"
+        _default_enc = "simplemem-encryption-key-32bytes!"
+        insecure = []
+        if self.jwt_secret_key == _default_jwt:
+            insecure.append("JWT_SECRET_KEY")
+        if self.encryption_key == _default_enc:
+            insecure.append("ENCRYPTION_KEY")
+        if insecure:
+            msg = (
+                "SECURITY WARNING: using built-in default value(s) for "
+                f"{', '.join(insecure)}. Set {' and '.join(insecure)} to strong, "
+                "unique secret(s) via environment variables before exposing this "
+                "server to any untrusted network."
+            )
+            warnings.warn(msg, stacklevel=2)
+            print(f"[SimpleMem] {msg}", file=sys.stderr)
+
 
 @lru_cache()
 def get_settings() -> Settings:
```

---

### Incident Patch 5: `80e3ebb4` (2026-07-18)
**Commit Message**: security: escape person/entity/timestamp filters in structured_search (#53)

structured_search interpolated person and entity names straight into the
LanceDB where() clause, letting a crafted name (e.g. "Alice')) OR true--")
break out of make_array() and bypass the filter to leak all rows. Apply
the same single-quote escaping already used for the location field to
persons, entities and timestamp bounds.

**File**: `SKILL/simplemem-skill/src/database/vector_store.py` (modified, +4/-2)
```diff
@@ -213,19 +213,21 @@ def structured_search(
             conditions = []
 
             if persons:
-                values = ", ".join([f"'{p}'" for p in persons])
+                values = ", ".join(["'" + str(p).replace("'", "''") + "'" for p in persons])
                 conditions.append(f"array_has_any(persons, make_array({values}))")
 
             if location:
                 safe_location = location.replace("'", "''")
                 conditions.append(f"location LIKE '%{safe_location}%'")
 
             if entities:
-                values = ", ".join([f"'{e}'" for e in entities])
+                values = ", ".join(["'" + str(e).replace("'", "''") + "'" for e in entities])
                 conditions.append(f"array_has_any(entities, make_array({values}))")
 
             if timestamp_range:
                 start_time, end_time = timestamp_range
+                start_time = str(start_time).replace("'", "''")
+                end_time = str(end_time).replace("'", "''")
                 conditions.append(f"timestamp >= '{start_time}' AND timestamp <= '{end_time}'")
 
             where_clause = " AND ".join(conditions)
```

**File**: `simplemem/core/database/vector_store.py` (modified, +4/-2)
```diff
@@ -204,19 +204,21 @@ def structured_search(
             conditions = []
 
             if persons:
-                values = ", ".join([f"'{p}'" for p in persons])
+                values = ", ".join(["'" + str(p).replace("'", "''") + "'" for p in persons])
                 conditions.append(f"array_has_any(persons, make_array({values}))")
 
             if location:
                 safe_location = location.replace("'", "''")
                 conditions.append(f"location LIKE '%{safe_location}%'")
 
             if entities:
-                values = ", ".join([f"'{e}'" for e in entities])
+                values = ", ".join(["'" + str(e).replace("'", "''") + "'" for e in entities])
                 conditions.append(f"array_has_any(entities, make_array({values}))")
 
             if timestamp_range:
                 start_time, end_time = timestamp_range
+                start_time = str(start_time).replace("'", "''")
+                end_time = str(end_time).replace("'", "''")
                 conditions.append(f"timestamp >= '{start_time}' AND timestamp <= '{end_time}'")
 
             where_clause = " AND ".join(conditions)
```

**File**: `simplemem/integrations/simplemem-skill/src/database/vector_store.py` (modified, +4/-2)
```diff
@@ -213,19 +213,21 @@ def structured_search(
             conditions = []
 
             if persons:
-                values = ", ".join([f"'{p}'" for p in persons])
+                values = ", ".join(["'" + str(p).replace("'", "''") + "'" for p in persons])
                 conditions.append(f"array_has_any(persons, make_array({values}))")
 
             if location:
                 safe_location = location.replace("'", "''")
                 conditions.append(f"location LIKE '%{safe_location}%'")
 
             if entities:
-                values = ", ".join([f"'{e}'" for e in entities])
+                values = ", ".join(["'" + str(e).replace("'", "''") + "'" for e in entities])
                 conditions.append(f"array_has_any(entities, make_array({values}))")
 
             if timestamp_range:
                 start_time, end_time = timestamp_range
+                start_time = str(start_time).replace("'", "''")
+                end_time = str(end_time).replace("'", "''")
                 conditions.append(f"timestamp >= '{start_time}' AND timestamp <= '{end_time}'")
 
             where_clause = " AND ".join(conditions)
```

---

### Incident Patch 6: `49152d55` (2026-07-18)
**Commit Message**: security: use ast.literal_eval instead of eval for benchmark data (#52)

The MMLongBench-Doc loader parsed evidence_pages/evidence_sources with
eval(), which executes arbitrary code if the dataset is tampered with.
Switch to ast.literal_eval(), which only parses Python literals. The
surrounding try/except still falls back to [] on malformed input, so
behavior for valid data is unchanged.

**File**: `OmniSimpleMem/omni_memory/evaluation/benchmarks.py` (modified, +3/-2)
```diff
@@ -9,6 +9,7 @@
 """
 
 import logging
+import ast
 import json
 import time
 from pathlib import Path
@@ -1032,15 +1033,15 @@ def load_data(self) -> None:
             evidence_pages = item.get("evidence_pages", "[]")
             if isinstance(evidence_pages, str):
                 try:
-                    evidence_pages = eval(evidence_pages)
+                    evidence_pages = ast.literal_eval(evidence_pages)
                 except:
                     evidence_pages = []
             
             # Parse evidence_sources (can be string or list)
             evidence_sources = item.get("evidence_sources", "[]")
             if isinstance(evidence_sources, str):
                 try:
-                    evidence_sources = eval(evidence_sources)
+                    evidence_sources = ast.literal_eval(evidence_sources)
                 except:
                     evidence_sources = []
             
```

**File**: `simplemem/multimodal/evaluation/benchmarks.py` (modified, +3/-2)
```diff
@@ -9,6 +9,7 @@
 """
 
 import logging
+import ast
 import json
 import time
 from pathlib import Path
@@ -1032,15 +1033,15 @@ def load_data(self) -> None:
             evidence_pages = item.get("evidence_pages", "[]")
             if isinstance(evidence_pages, str):
                 try:
-                    evidence_pages = eval(evidence_pages)
+                    evidence_pages = ast.literal_eval(evidence_pages)
                 except:
                     evidence_pages = []
             
             # Parse evidence_sources (can be string or list)
             evidence_sources = item.get("evidence_sources", "[]")
             if isinstance(evidence_sources, str):
                 try:
-                    evidence_sources = eval(evidence_sources)
+                    evidence_sources = ast.literal_eval(evidence_sources)
                 except:
                     evidence_sources = []
             
```

---

### Incident Patch 7: `05c7c42b` (2026-07-18)
**Commit Message**: fix(omni): add missing omni_memory.core.config module (#49)

The omni_memory package (and its tests/examples) import
`from omni_memory.core.config import OmniMemoryConfig`, but the module
file was missing, so `import omni_memory` failed with ModuleNotFoundError.
Restore config.py (mirrors simplemem/multimodal/core/config.py) with the
lazy evolution import pointed at the omni_memory namespace.

**File**: `OmniSimpleMem/omni_memory/core/config.py` (added, +236/-0)
```diff
@@ -0,0 +1,236 @@
+"""
+Configuration management for Omni-Memory system.
+"""
+
+import os
+from dataclasses import dataclass, field
+from typing import Optional, Dict, Any
+from pathlib import Path
+import json
+
+
+@dataclass
+class EntropyTriggerConfig:
+    """Configuration for modal entropy triggers."""
+
+    # Visual trigger settings
+    visual_similarity_threshold_high: float = 0.9  # Above this = static, discard
+    visual_similarity_threshold_low: float = 0.7   # Below this = significant change, trigger
+    visual_encoder: str = "clip"  # Options: clip, siglip, dinov2
+    visual_model_name: str = "UCSC-VLAA/openvision-vit-large-patch14-224"
+
+    # Audio trigger settings
+    audio_energy_threshold: float = 0.01  # Minimum energy to consider
+    audio_vad_threshold: float = 0.5      # Voice activity detection threshold
+    audio_min_speech_duration_ms: int = 500  # Minimum speech duration to trigger
+
+    # General settings
+    enable_visual_trigger: bool = True
+    enable_audio_trigger: bool = True
+
+
+@dataclass
+class StorageConfig:
+    """Configuration for storage management."""
+
+    # Base directories
+    base_dir: str = "./omni_memory_data"
+    cold_storage_dir: str = "./omni_memory_data/cold_storage"
+    index_dir: str = "./omni_memory_data/index"
+
+    # Storage backends
+    use_s3: bool = False
+    s3_bucket: Optional[str] = None
+    s3_prefix: str = "omni_memory/"
+
+    # File organization
+    organize_by_date: bool = True
+    organize_by_modality: bool = True
+
+    # Cleanup settings
+    max_storage_gb: float = 100.0
+    auto_cleanup_enabled: bool = False
+
+
+@dataclass
+class RetrievalConfig:
+    """Configuration for pyramid retrieval system."""
+
+    # Coarse retrieval (Step 1)
+    default_top_k: int = 10
+    max_summaries_in_context: int = 20
+
+    # Fine retrieval (Step 2)
+    max_expanded_items: int = 5
+    max_raw_content_tokens: int = 2000
+
+    # Token budgets
+    summary_token_budget: int = 500
+    details_token_budget: int = 1500
+    evidence_token_budget: int = 3000
+
+    # Retrieval modes
+    enable_hybrid_search: bool = True
+    enable_graph_traversal: bool = True
+
+    # Expansion settings
+    auto_expand_threshold: float = 0.85  # Auto-expand if relevance > threshold
+
+
+@dataclass
+class EmbeddingConfig:
+    """Configuration for embedding models."""
+
+    model_name: str = "text-embedding-3-small"
+    embedding_dim: int = 1536
+    batch_size: int = 32
+
+    # For visual embeddings
+    visual_embedding_model: str = "UCSC-VLAA/openvision-vit-large-patch14-224"
+    visual_embedding_dim: int = 768
+
+    def apply_backend_preset(self, preset: str) -> None:
+        """Apply a named visual embedding preset."""
+        presets = {
+            "openvision": ("UCSC-VLAA/openvision-vit-base-patch16-224", 768),
+            "openvision-large": ("UCSC-VLAA/openvision-vit-large-patch14-224", 768),
+            "openvision-large-336": ("UCSC-VLAA/openvision-vit-large-patch14-336", 768),
+            "openvision-huge": ("UCSC-VLAA/openvision-vit-huge-patch14-224", 1024),
+        }
+        if preset in presets:
+            self.visual_embedding_model, self.visual_embedding_dim = presets[preset]
+
+
+@dataclass
+class LLMConfig:
+    """Configuration for LLM interactions."""
+
+    # API settings
+    api_base_url: Optional[str] = None
+    api_key: Optional[str] = None
+
+    # Model selection
+    summary_model: str = "gpt-4o-mini"
+    query_model: str = "gpt-4o-mini"
+    caption_model: str = "gpt-4o"
+
+    # Generation settings
+    temperature: float = 0.0
+    max_tokens: int = 1000
+
+    # Whisper settings
+    whisper_model: str = "whisper-1"
+
+
+@dataclass
+class EventConfig:
+    """Configuration for event management."""
+
+    # Event creation
+    auto_create_events: bool = True
+    event_time_window_seconds: float = 300.0  # 5 minutes default
+    min_maus_per_event: int = 1
+
+    # Event summarization
+    summarize_on_close: bool
```

---

### Incident Patch 8: `f6dded53` (2026-07-18)
**Commit Message**: Merge pull request #56 from msaidbilgehan/fix/keyword-search-numpy-truth-value

fix: avoid numpy truth-value ambiguity in keyword/structured search

**File**: `MCP/server/database/vector_store.py` (modified, +6/-3)
```diff
@@ -190,7 +190,8 @@ async def keyword_search(
             scores = []
             for idx, row in df.iterrows():
                 score = 0
-                entry_keywords = set(k.lower() for k in (row["keywords"] or []))
+                row_keywords = row["keywords"] if row["keywords"] is not None else []
+                entry_keywords = set(k.lower() for k in row_keywords)
                 entry_text = row["lossless_restatement"].lower()
 
                 for kw in keywords:
@@ -267,7 +268,8 @@ async def structured_search(
             if persons:
                 persons_lower = set(p.lower() for p in persons)
                 for i, row in df.iterrows():
-                    row_persons = set(p.lower() for p in (row["persons"] or []))
+                    persons_val = row["persons"] if row["persons"] is not None else []
+                    row_persons = set(p.lower() for p in persons_val)
                     if not persons_lower.intersection(row_persons):
                         mask[i] = False
 
@@ -284,7 +286,8 @@ async def structured_search(
                 entities_lower = set(e.lower() for e in entities)
                 for i, row in df.iterrows():
                     if mask[i]:
-                        row_entities = set(e.lower() for e in (row["entities"] or []))
+                        entities_val = row["entities"] if row["entities"] is not None else []
+                        row_entities = set(e.lower() for e in entities_val)
                         if not entities_lower.intersection(row_entities):
                             mask[i] = False
 
```

---

### Incident Patch 9: `27d06beb` (2026-07-18)
**Commit Message**: Merge pull request #73 from FBISiri/docs/fix-package-usage-api

docs: fix PACKAGE_USAGE.md to match current public API

**File**: `docs/PACKAGE_USAGE.md` (modified, +248/-183)
```diff
@@ -2,6 +2,10 @@
 
 This guide provides comprehensive documentation for using SimpleMem as a pip-installable Python package.
 
+> **Public API.** The package exposes a small, stable surface:
+> `SimpleMem`, `create`, `list_modes`, `optimize`, `Config`, and `load_config`
+> (see `simplemem.__all__`). All examples below use these names.
+
 ---
 
 ## Table of Contents
@@ -62,195 +66,264 @@ pip install simplemem[all]
 ### Minimal Example
 
 ```python
-from simplemem import SimpleMemSystem
+from simplemem import SimpleMem
 
-# Initialize the system with your API key
-system = SimpleMemSystem(
-    api_key="your-openai-api-key",
-    clear_db=True  # Start fresh
-)
+# Initialize the system. mode="auto" (default): the backend is chosen
+# by the first method you call — add_dialogue() selects the text backend.
+mem = SimpleMem()
 
 # Add dialogues with timestamps
-system.add_dialogue("Alice", "Let's meet at Starbucks tomorrow at 2pm", "2025-01-15T14:30:00")
-system.add_dialogue("Bob", "Sure, I'll bring the report", "2025-01-15T14:31:00")
+mem.add_dialogue("Alice", "Let's meet at Starbucks tomorrow at 2pm", "2025-01-15T14:30:00")
+mem.add_dialogue("Bob", "Sure, I'll bring the report", "2025-01-15T14:31:00")
 
 # Finalize memory encoding
-system.finalize()
+mem.finalize()
 
 # Query the memory
-answer = system.ask("When and where will Alice and Bob meet?")
+answer = mem.ask("When and where will Alice and Bob meet?")
 print(answer)
 # Output: "Alice and Bob will meet at Starbucks on January 16, 2025 at 2:00 PM"
 ```
 
+Provide the API key via the `OPENAI_API_KEY` environment variable, a top-level
+`config.py` (see [`config.py.example`](../config.py.example)), or by passing it
+explicitly (see [Using Custom LLM Endpoints](#using-custom-llm-endpoints)).
+
 ### Using Environment Variables
 
 ```python
 import os
-from simplemem import SimpleMemSystem
+from simplemem import SimpleMem
 
 # Set API key via environment variable
 os.environ["OPENAI_API_KEY"] = "your-api-key"
 
-# Initialize without explicit api_key parameter
-system = SimpleMemSystem(clear_db=True)
+# Initialize (reads OPENAI_API_KEY from the environment)
+mem = SimpleMem()
 ```
 
+### Choosing a Backend Explicitly
+
+`SimpleMem()` auto-selects a backend, but you can request one directly with
+`create()`:
+
+```python
+from simplemem import create, list_modes
+
+# Single-modal text memory
+mem = create(mode="text", clear_db=True)
+
+# Multimodal memory (text, image, audio, video)
+mem = create(mode="omni", data_dir="./my_memory")
+
+# Inspect the available backends
+print(list_modes())
+# {'text': 'Single-modal text memory ...', 'omni': 'Multimodal memory ...'}
+```
+
+`create(mode="text", ...)` returns the text memory system directly, exposing the
+full text API (`add_dialogue`, `add_dialogues`, `finalize`, `ask`,
+`get_all_memories`, `print_memories`).
+
 ---
 
 ## Configuration
 
-SimpleMem offers flexible configuration through three priority levels:
+SimpleMem resolves runtime settings in the following order (highest priority first):
+
+1. **Constructor parameters** passed to `SimpleMem(...)` / `create(...)`
+2. **A top-level `config.py`** on the Python path (copy from `config.py.example`)
+3. **Environment variables** of the same name (e.g. `OPENAI_API_KEY`, `LLM_MODEL`)
+4. **Built-in defaults**
 
-1. **Constructor Parameters** (highest priority)
-2. **Environment Variables**
-3. **Default Values** (lowest priority)
+### Using `config.py`
 
-### Using SimpleMemConfig
+The simplest way to configure a local checkout is to copy the template and edit it:
+
+```bash
+cp config.py.example config.py
+# Edit config.py with your API key, base URL, and model preferences
+```
 
 ```python
-from simplemem import SimpleMemConfig, set_config, SimpleMemSystem
-
-# Create custom configuration
-config = SimpleMemConfig(
-    openai_api_key="your-api-key",
-    llm_model="gpt-4.1-mini",
-    embedding_model="Qwen/Qwen3-Embedding-0.6B",
-    lancedb_path="./my_memory_db",
+# config.py
+OPENA
```

---

### Incident Patch 10: `e8c35a06` (2026-05-21)
**Commit Message**: docs: move SimpleMem text-memory deep-dive to docs/text-memory.md

Makes the three pillars symmetric: each now links from the Overview to its own
detailed doc (SimpleMem -> docs/text-memory.md, Omni -> OmniSimpleMem/,
EvolveMem -> EvolveMem/), instead of SimpleMem alone keeping a long deep-dive
section inline. Main README drops to the conceptual Overview plus Results;
removed the now-dead TOC entry.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>

**File**: `README.md` (modified, +1/-77)
```diff
@@ -133,7 +133,6 @@
 - [🚀 Quick Start](#-quick-start)
 - [🌟 Overview](#-overview)
 - [📈 Results](#-results)
-- [📝 SimpleMem: Text Memory](#-simplemem-text-memory)
 - [📦 Installation](#-installation)
 - [🐳 Docker](#-run-with-docker)
 - [🔌 MCP Server](#-mcp-server-text-memory)
@@ -292,7 +291,7 @@ Most memory systems force a bad trade-off. They either passively accumulate raw
 | **2. Online Semantic Synthesis** | Merges related context within a session into unified abstract representations, removing redundancy as memory is built rather than at query time. |
 | **3. Intent-Aware Retrieval Planning** | Infers the search intent behind a query to decide *what* to retrieve and assemble a precise, compact context. |
 
-On the LoCoMo benchmark this delivers a 26.4% average F1 gain over prior systems while cutting inference-time token consumption by roughly 30x.
+On the LoCoMo benchmark this delivers a 26.4% average F1 gain over prior systems while cutting inference-time token consumption by roughly 30x. Mechanism details (hybrid index layers, compression examples, retrieval planning): [**SimpleMem text memory →**](docs/text-memory.md).
 
 ### 🧠 Omni-SimpleMem: multimodal memory (text, image, audio, video)
 
@@ -393,81 +392,6 @@ EvolveMem closes a blind spot shared by almost every memory system: the stored c
 
 ---
 
-## 📝 SimpleMem: Text Memory
-
-### 1️⃣ Semantic Structured Compression
-
-SimpleMem applies an **implicit semantic density gating** mechanism integrated into the LLM generation process to filter redundant interaction content. The system reformulates raw dialogue streams into **compact memory units** — self-contained facts with resolved coreferences and absolute timestamps. Each unit is indexed through three complementary representations for flexible retrieval:
-
-<div align="center">
-
-| 🔍 Layer | 📊 Type | 🎯 Purpose | 🛠️ Implementation |
-|---------|---------|------------|-------------------|
-| **Semantic** | Dense | Conceptual similarity | Vector embeddings (1024-d) |
-| **Lexical** | Sparse | Exact term matching | BM25-style keyword index |
-| **Symbolic** | Metadata | Structured filtering | Timestamps, entities, persons |
-
-</div>
-
-**✨ Example Transformation:**
-```diff
-- Input:  "He'll meet Bob tomorrow at 2pm"  [❌ relative, ambiguous]
-+ Output: "Alice will meet Bob at Starbucks on 2025-11-16T14:00:00"  [✅ absolute, atomic]
-```
-
----
-
-### 2️⃣ Online Semantic Synthesis
-
-Unlike traditional systems that rely on asynchronous background maintenance, SimpleMem performs synthesis **on-the-fly during the write phase**. Related memory units are synthesized into higher-level abstract representations within the current session scope, allowing repetitive or structurally similar experiences to be **denoised and compressed immediately**.
-
-**✨ Example Synthesis:**
-```diff
-- Fragment 1: "User wants coffee"
-- Fragment 2: "User prefers oat milk"
-- Fragment 3: "User likes it hot"
-+ Consolidated: "User prefers hot coffee with oat milk"
-```
-
-This proactive synthesis ensures the memory topology remains compact and free of redundant fragmentation.
-
----
-
-### 3️⃣ Intent-Aware Retrieval Planning
-
-Instead of fixed-depth retrieval, SimpleMem leverages the reasoning capabilities of the LLM to generate a **comprehensive retrieval plan**. Given a query, the planning module infers **latent search intent** to dynamically determine retrieval scope and depth:
-
-$$\{ q_{\text{sem}}, q_{\text{lex}}, q_{\text{sym}}, d \} \sim \mathcal{P}(q, H)$$
-
-The system then executes **parallel multi-view retrieval** across semantic, lexical, and symbolic indexes, and merges results through ID-based deduplication:
-
-<table>
-<tr>
-<td width="50%">
-
-**🔹 Simple Queries**
-- Direct fact lookup via single memory unit
-- Minimal retrieval depth
-- Fast response time
-
-</td>
-<td width="50%">
-
-**🔸 Complex Queries**
-- Aggregation across multiple events
-- Expanded retrieval depth
-- Comprehensive coverage
-
-</td>
-</tr>
-<
```

**File**: `docs/text-memory.md` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+# SimpleMem: Text Memory
+
+How the text backend turns raw dialogue into compact, retrievable memory. For the high-level summary and where this fits the unified package, see the [main README Overview](../README.md#-overview).
+
+## 1. Semantic Structured Compression
+
+SimpleMem applies an **implicit semantic density gating** mechanism integrated into the LLM generation process to filter redundant interaction content. The system reformulates raw dialogue streams into **compact memory units**, self-contained facts with resolved coreferences and absolute timestamps. Each unit is indexed through three complementary representations for flexible retrieval:
+
+| 🔍 Layer | 📊 Type | 🎯 Purpose | 🛠️ Implementation |
+|---------|---------|------------|-------------------|
+| **Semantic** | Dense | Conceptual similarity | Vector embeddings (1024-d) |
+| **Lexical** | Sparse | Exact term matching | BM25-style keyword index |
+| **Symbolic** | Metadata | Structured filtering | Timestamps, entities, persons |
+
+**Example transformation:**
+
+```diff
+- Input:  "He'll meet Bob tomorrow at 2pm"  [relative, ambiguous]
++ Output: "Alice will meet Bob at Starbucks on 2025-11-16T14:00:00"  [absolute, atomic]
+```
+
+## 2. Online Semantic Synthesis
+
+Unlike traditional systems that rely on asynchronous background maintenance, SimpleMem performs synthesis **on-the-fly during the write phase**. Related memory units are synthesized into higher-level abstract representations within the current session scope, allowing repetitive or structurally similar experiences to be **denoised and compressed immediately**.
+
+**Example synthesis:**
+
+```diff
+- Fragment 1: "User wants coffee"
+- Fragment 2: "User prefers oat milk"
+- Fragment 3: "User likes it hot"
++ Consolidated: "User prefers hot coffee with oat milk"
+```
+
+This proactive synthesis keeps the memory topology compact and free of redundant fragmentation.
+
+## 3. Intent-Aware Retrieval Planning
+
+Instead of fixed-depth retrieval, SimpleMem leverages the reasoning capabilities of the LLM to generate a **comprehensive retrieval plan**. Given a query, the planning module infers **latent search intent** to dynamically determine retrieval scope and depth:
+
+$$\{ q_{\text{sem}}, q_{\text{lex}}, q_{\text{sym}}, d \} \sim \mathcal{P}(q, H)$$
+
+The system then executes **parallel multi-view retrieval** across semantic, lexical, and symbolic indexes, and merges results through ID-based deduplication:
+
+| 🔹 Simple Queries | 🔸 Complex Queries |
+|:--|:--|
+| Direct fact lookup via single memory unit | Aggregation across multiple events |
+| Minimal retrieval depth | Expanded retrieval depth |
+| Fast response time | Comprehensive coverage |
+
+**Result:** 43.24% F1 score with **30x fewer tokens** than full-context methods.
```

#### Recent Merged Pull Requests:
- **PR #76** (2026-07-24): refactor: extract vector store backend interface (@zc277584121)
- **PR #73** (2026-07-18): docs: fix PACKAGE_USAGE.md to match current public API (@FBISiri)
- **PR #71** (2026-07-18): Add Requesty as an LLM provider (@Thibaultjaigu)
- **PR #66** (closed): feat: add PostgreSQL/pgvector storage backend (@isc-tdyar)
- **PR #65** (closed): feat: add PostgreSQL/pgvector storage backend (@isc-tdyar)
- **PR #56** (2026-07-18): fix: avoid numpy truth-value ambiguity in keyword/structured search (@msaidbilgehan)
- **PR #39** (2026-02-26): feat: Add Docker support with configuration files and documentation (@pmzi)
- **PR #38** (2026-02-19): feat: Implement window overlap and online semantic synthesis (Stage 2) (@akatekhanh)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
