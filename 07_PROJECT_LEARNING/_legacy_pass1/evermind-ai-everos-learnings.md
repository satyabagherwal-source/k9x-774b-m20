# Forensic Learning Record (Deep Inspection): EverMind-AI/EverOS

> **Canonical Artifact**: `07_PROJECT_LEARNING/evermind-ai-everos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/EverMind-AI/EverOS](https://github.com/EverMind-AI/EverOS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:47:43.949Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `EverMind-AI/EverOS`
- **Description**: One portable memory layer for every AI agent: local-first, Markdown-native, user-owned, and self-evolving across apps, tools, and workflows.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 13313 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `benchmarks/adapters/__init__.py`
```
"""Dataset adapters, resolved by name.

``run.py`` never imports a specific adapter; it asks for one by ``--benchmark``. Adding
a benchmark means adding a module here and one line to the registry -- no change to the
pipeline.
"""

from __future__ import annotations

from types import ModuleType

from . import evermembench, locomo, longmemeval, subtlememory

_REGISTRY: dict[str, ModuleType] = {
    "locomo": locomo,
    "longmemeval": longmemeval,
    "evermembench": evermembench,
    "subtlememory": subtlememory,
}


def get(name: str) -> ModuleType:
    """Return the adapter module for ``name``, or raise with the valid choices."""
    try:
        return _REGISTRY[name]
    except KeyError:
        raise KeyError(
            f"unknown benchmark {name!r}; choices: {sorted(_REGISTRY)}"
        ) from None


def names() -> list[str]:
    return sorted(_REGISTRY)


__all__ = ["get", "names"]

```

### Core Architecture Module: `benchmarks/adapters/_profile.py`
```
"""Rendering the owner's profile into an answer prompt.

Shared because it was not: the renderer lived inside ``evermembench.py`` and every other
benchmark's context builder simply dropped the ``profiles`` argument. That made
``include_profile`` a no-op on three of the four benchmarks -- the server fetched the
profile, the harness threw it away, and two "profile on vs off" runs on LoCoMo and
LongMemEval therefore compared a configuration against itself. Their whole measured
difference (0.91 pp and 1.20 pp, McNemar p=0.10 and p=0.15) was decider nondeterminism.
"""

from __future__ import annotations

from collections.abc import Sequence

PROFILE_HEADING = "## User profile"
MEMORY_HEADING = "## Retrieved memories"


def render_profile_lines(profiles: Sequence[dict]) -> list[str]:
    """The profile as dash-prefixed lines, or empty when there is nothing to show.

    Reads both shapes the search response uses: a row wrapping ``profile_data``, and the
    profile object itself.
    """
    out: list[str] = []
    for prof in profiles or ():
        data = prof.get("profile_data") or prof
        summary = str(data.get("summary") or "").strip()
        if summary:
            out.append(f"- {summary}")
        for item in data.get("explicit_info") or []:
            if not isinstance(item, dict):
                continue
            cat = str(item.get("category") or "").strip()
            desc = str(item.get("description") or "").strip()
            if desc:
                out.append(f"- [{cat}] {desc}" if cat else f"- {desc}")
        for item in data.get("implicit_traits") or []:
            if not isinstance(item, dict):
                continue
            trait = str(item.get("trait") or item.get("name") or "").strip()
            basis = str(item.get("basis") or "").strip()
            if trait and basis:
                out.append(f"- [trait] {trait} -- {basis}")
            elif basis:
                out.append(f"- [trait] {basis}")
    return out


def with_profile_block(memories: str, profiles: Sequence[dict]) -> str:
    """Put the profile ahead of the rendered memories, as its own labelled section.

    Kept out of the memory list rather than prepended to it: a profile is standing
    context, with no timestamp to reason about and no session it belongs to. A model
    told to weigh recency would otherwise treat it as one more dated memory.

    Returns ``memories`` unchanged when there is no profile, which is what keeps every
    benchmark's prompt byte-identical to its reference harness while the flag is off.
    """
    lines = render_profile_lines(profiles)
    if not lines:
        return memories
    block = PROFILE_HEADING + "\n" + "\n".join(lines)
    if not memories:
        return block
    return f"{block}\n\n{MEMORY_HEADING}\n{memories}"

```

### Core Architecture Module: `benchmarks/adapters/base.py`
```
"""Dataset adapters: the one place a benchmark's own shape is allowed to live.

`run.py` drives ADD -> SEARCH -> ANSWER -> JUDGE and knows nothing about any particular
benchmark. Everything that differs between benchmarks answers four questions, and an
adapter is exactly those four answers:

  1. load_units()  -- how to read the conversations and questions off disk
  2. owner_of()    -- what memory owner a question's answer lives under. Owner naming is
                      decided when the store is BUILT, so this must reproduce the
                      builder's convention rather than invent one. Getting it wrong
                      returns zero episodes and scores 0% with no error anywhere.
  3. gold_of()     -- gold session ids, in the form THE STORE uses. Every benchmark
  cites
                      evidence differently (haystack positions, D<session>:<turn> dia
                      ids, original session names) and none of them matches the store
                      directly.
  4. judge_spec()  -- which judge, and the answer prompt it grades against. The hybrid
                      judge's leniency clauses are keyed to LongMemEval's categories and
                      would mis-fire on any other benchmark, so the judge belongs to the
                      adapter, not to a shared scoring layer.

Anything that is NOT one of those four belongs in run.py.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class DatasetAdapter(Protocol):
    """Four questions, one benchmark."""

    name: str

    def load_units(self, data_path: str) -> list[dict[str, Any]]:
        """Return one entry per conversation/topic, each carrying its own questions.

        The shape run.py consumes is ``{"index": int, "sessions": [...], "qa": [...]}``;
        an adapter is free to derive that however its source data is organised.
        """
        ...

    def owner_of(self, unit: dict[str, Any], eval_owner: str) -> str:
        """Memory owner id to query for this unit.

        ``eval_owner`` carries the config's preference where a benchmark has more than
        one candidate (LoCoMo has two speakers); benchmarks with a single owner per unit
        ignore it.
        """
        ...

    def gold_of(self, unit: dict[str, Any], qa: dict[str, Any]) -> set[str]:
        """Gold session ids for one question, already translated into store ids."""
        ...

    def sessions_of(self, unit: dict[str, Any]) -> list[dict[str, Any]]:
        """Ingestible sessions for the ADD stage.

        Each session is ``{"session_idx": int, "messages": [...], "timestamp_ms": int}``
        and each message carries ``speaker`` / ``text`` / ``dia_id``. Only the ADD stage
        needs this; a benchmark scored against a pre-built store never calls it.

        Splitting this out is what lets ADD run for anything other than LoCoMo: the
        loader used to read ``unit["conversation"]`` directly, so every other dataset
        died with ``KeyError: 'conversation'`` the moment ingestion started.
        """
        raise NotImplementedError

    def judge_spec(self) -> dict[str, Any]:
        """``{"judge": <name>, "answer_prompt": <template>}``.

        ``judge`` selects the grading function; ``answer_prompt`` is the template the
        answer model is given, because a judge's leniency assumes a particular answer
        protocol (e.g. the enumeration / temporal protocol LongMemEval's clauses
        expect).
        """
        ...

    def categories(self) -> dict[str, str]:
        """Category id -> human label, for per-category reporting.

        LoCoMo's mapping is counter-intuitive (cat1 = multi-hop, cat4 = single-hop) and
        this is the single place that fact is recorded.
        """
        ...


def normalize_speaker(name: str) -> str:
    """Make a speaker usable as a `sender_id`.

    The API validates sender_id against ``^[a-zA-Z0-9_.@+-]+$``, so any real name with a
    space ("Bo Chen") is rejected with a 422 -- after ADD has already paid for
    extraction on that batch. Collapsing the disallowed characters keeps names
    distinguishable without inventing an id mapping the gold would not recognise.
    """
    import re

    cleaned = re.sub(r"[^a-zA-Z0-9_.@+-]+", "_", str(name or "").strip())
    return cleaned.strip("_") or "speaker"


def leniency_clause(qa: dict[str, Any]) -> str:
    """Extra grading rule for this question, prepended to the judge prompt.

    There is one judge and one answer prompt in this harness -- no modes, no flags. What
    varies is only this clause, and each benchmark decides it from its OWN question
    metadata. That last part is the whole point: the original hybrid judge indexed
    LongMemEval's question types by conversation number, so pointing it at another
    dataset applied LongMemEval's clauses to unrelated questions. Deriving the clause
    from the question at hand cannot mis-fire, and a benchmark that defines none simply
    gets the plain judge.
    """
    return ""


# Every benchmark stamps its sessions with a real clock, in its own format. Ingesting a
# synthetic clock instead puts wrong timestamps on every episode, and those timestamps
# are rendered into the answer prompt -- which is what temporal questions are graded on.
_SESSION_TS_FORMATS = (
    "%I:%M %p on %d %B, %Y",  # LoCoMo / EverMemBench: "10:02 am on 4 March, 2025"
    "%Y/%m/%d (%a) %H:%M",  # LongMemEval haystack_dates: "2023/05/20 (Sat) 02:21"
)


def session_epoch_ms(raw: str) -> int | None:
    """Parse a session timestamp to epoch milliseconds, or None if unparseable.

    The wall clock is pinned to UTC whether or not the value carries an offset. Naive
    values need it for the reason everalgo's LoCoMo loader gives -- without an explicit
    zone the same dataset yields different epochs on machines in different zones.

    Values that DO carry an offset need it because of how the reference reaches them.
    Every reference harness reads a locomo-style conversion of its dataset, and that
    conversion renders the wall clock and drops the zone: SubtleMemory's raw
    ``2025-04-01T10:01:36+08:00`` arrives at the reference as
    ``"10:01 am on 1 April, 2025"``, which it then pins to UTC. Honouring the offset
    here instead moves every one of that dataset's 2364 sessions 8 hours earlier, and
    carries 397 of them into the previous UTC day. Session timestamps are rendered into
    the answer prompt and are what temporal questions are graded on, so the two must
    agree on the wall clock, not on the instant it denotes.
    """
    text = str(raw or "").strip()
    if not text:
        return None
    try:  # ISO-8601, possibly with an offset (SubtleMemory)
        dt = datetime.fromisoformat(text)
    except ValueError:
        dt = None
        for fmt in _SESSION_TS_FORMATS:
            try:
                dt = datetime.strptime(text, fmt)
                break
            except ValueError:
                continue
        if dt is None:
            return None
    # replace(), not astimezone(): the wall clock is the value, the offset is discarded.
    return int(dt.replace(tzinfo=UTC).timestamp() * 1000)

```

### Core Architecture Module: `benchmarks/adapters/evermembench.py`
```
"""EverMemBench adapter.

Owner is the topic id verbatim (``"01"`` .. ``"05"``), which is also the prefix the
store puts on its session names.

Gold is the hard part. The benchmark cites evidence as dia ids (``D581:4``) while the
store names sessions ``<topic>_<Group N>_<date>``. The bridge between them is the
converter's own flattening order: one session per NON-EMPTY (date, group) pair, dates
ascending, groups in numeric order ("Group 10" after "Group 2"), session index 1-based,
and the counter rolls back for a pair whose messages are all empty.

A constant offset in that walk still produces well-formed session ids, so the mapping is
validated by hit rate rather than by shape: real retrieval recalls 0.41 of this gold
against 0.014 for a same-size random draw from the same topic's session pool -- a 29x
separation. Reproduce that check after touching this function.
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import pathlib
import re
from collections.abc import Iterator
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

from ._profile import render_profile_lines, with_profile_block
from .base import session_epoch_ms

name = "evermembench"

# The dataset's raw release, needed only to recover session NAMES (the converted
# file keeps dia-ids). Read from the environment so this file names the input
# instead of carrying one machine's copy of it; `EVERMEMBENCH_RAW_ROOT` overrides,
# and the default is where the converter in this module puts it.
# `or`, not `.get(k, default)`: the shipped .env.example declares this key EMPTY so the
# default wins, and `.get` returns "" for a key that is set-but-empty. That made RAW_ROOT
# the empty string, so every path became "/01/dialogue.json" -- absolute, rooted at /.
RAW_ROOT = os.environ.get("EVERMEMBENCH_RAW_ROOT") or (
    "benchmarks/data/raw/EverMemBench-Dynamic"
)

# Only the three whose expansion is readable off the code itself (F=fact, SH/MH/TP).
# The dataset documents no names for the other six (MA_C / MA_P / MA_U / P_Skill /
# P_Style / P_Title) and its own analyzer reports them by code, splitting the id into
# major and minor (tools/analyze_results.py:27-36), so they print their code here too.
# Inventing prose for them is how the LoCoMo category labels came to be printed wrong.
_CATEGORIES = {"F_SH": "single-hop", "F_MH": "multi-hop", "F_TP": "temporal"}


def _group_order(group: str) -> int:
    m = re.search(r"(\d+)", group)
    return int(m.group(1)) if m else 0


def iter_raw_sessions(
    topic: str, raw_root: str | pathlib.Path
) -> Iterator[tuple[int, str, str, list[dict[str, Any]]]]:
    """Yield ``(session_index, date, group, messages)`` from the raw release.

    One session per non-empty (date, group) pair, ordered by date then by group
    NUMBER, numbered from 1. This is the whole of EverMemBench's session identity,
    and both readers of the raw release go through here: the converter that writes
    `evermembench.json`, and `_session_index_map`, which translates the gold
    session names the QA cites into the positional names the store uses.

    They used to spell the rule separately -- the converter numbering forward and
    rolling back on an all-blank session, this one skipping it up front. Equivalent
    on the released data (verified: 3,570 sessions either way), but a rule that
    decides gold alignment should not be written down twice, because the failure
    when they drift is silent: every session id shifts by one and gold matches the
    wrong session while every stage still reports success.
    """
    rows = json.loads(
        pathlib.Path(f"{raw_root}/{topic}/dialogue.json").read_text(encoding="utf-8")
    )
    idx = 0
    for row in sorted(rows, key=lambda r: r["date"]):
        date = row["date"]
        for group in sorted(row["dialogues"], key=_group_order):
            msgs = row["dialogues"][group]
            if not isinstance(msgs, list) or not msgs:
                continue  # a group can be null on a given date
            if not any((m.get("dialogue") or "") for m in msgs):
                continue  # present but entirely blank: carries no memory
            idx += 1
            yield idx, date, group, msgs


@lru_cache(maxsize=8)
def _session_index_map(topic: str, raw_root: str) -> tuple[tuple[int, str], ...]:
    return tuple(
        (idx, f"{topic}_{group.replace(' ', '_')}_{date}")
        for idx, date, group, _ in iter_raw_sessions(topic, raw_root)
    )


# Sessions are laid out one day apart, messages 30s apart. Only the ORDER is
# meaningful -- these benchmarks carry no per-message clock.
_BASE_TS_MS = 1_700_000_000_000


def load_units(data_path: str) -> list[dict[str, Any]]:
    with open(data_path, encoding="utf-8") as fh:
        data = json.load(fh)
    units = []
    for item in data:
        units.append(
            {
                "index": str(item["sample_id"]),
                "conversation": item.get("conversation") or {},
                "qa": [
                    {
                        "question": q.get("question", ""),
                        "answer": q.get("answer", ""),
                        "category": q.get("category", ""),
                        "question_id": q.get("question_id", ""),
                        "evidence": list(q.get("evidence") or []),
                        # A non-empty options dict makes this a multiple-choice
                        # question, which is asked with a different prompt and graded
                        # without an LLM. Dropping it turns 68% of the benchmark into
                        # open-ended questions nobody can answer.
                        "options": q.get("options") or None,
                        "question_type": (
                            "multiple_choice"
                            if isinstance(q.get("options"), dict) and q.get("options")
                            else "open_ended"
                        ),
                    }
                    for q in item.get("qa") or []
                ],
            }
        )
    return units


def owner_of(unit: dict[str, Any], eval_owner: str) -> str:
    return str(unit["index"])


def gold_of(unit: dict[str, Any], qa: dict[str, Any]) -> set[str]:
    imap = dict(_session_index_map(str(unit["index"]), RAW_ROOT))
    out: set[str] = set()
    for ev in qa.get("evidence") or []:
        m = re.match(r"D(\d+):", str(ev))
        if m and int(m.group(1)) in imap:
            out.add(imap[int(m.group(1))])
    return out


def judge_spec() -> dict[str, Any]:
    return {"judge": "base_contains", "answer_prompt": "default"}


def categories() -> dict[str, str]:
    return dict(_CATEGORIES)


def sessions_of(unit: dict) -> list[dict]:
    """Sessions come pre-flattened as session_<N> / session_<N>_date_time.

    The converter below already collapsed (date, group) pairs into that numbering
    and stamped every turn with its dia_id, which is exactly what gold_of() resolves
    against -- so this reads the converted structure rather than re-deriving the order.
    """
    conv = unit.get("conversation") or {}
    out: list[dict] = []
    idx = 1
    while True:
        key = f"session_{idx}"
        turns = conv.get(key)
        if turns is None:
            break
        # The converted data carries the real session clock as session_<N>_date_time, in
        # LoCoMo's format. Episode timestamps are rendered into the answer prompt, so a
        # synthetic offset would put every memory on the wrong date.
        base = session_epoch_ms(conv.get(f"{key}_date_time"))
        if base is None:
            base = _BASE_TS_MS + idx * 86_400_000
        msgs = [
            {
                # The raw name, not a sanitised one: run.py sends this as
                # sender_name, which the reference passes through verbatim
                # (everos_adapter.py:262). All 170 speakers here are "First Last",
             
```

### Core Architecture Module: `benchmarks/adapters/locomo.py`
```
"""LoCoMo adapter.

Owner naming reproduces how the stores were built: ``<speaker>_conv<index>``, lowercased
(e.g. ``caroline_conv0``). The store also decides the partition -- the shared stores
live under app/project ``default``/``default``, not under a per-run project -- which is
why run.py takes those as flags instead of deriving them from the run name.

Gold evidence is cited as ``D<session>:<turn>``; only the session part identifies a
store session, and the store names sessions ``locomo_conv<index>_s<session>``.

Category mapping is deliberately spelled out here because it is counter-intuitive and
has been misread before: **cat1 is multi-hop and cat4 is single-hop**, verified against
the per-question evidence counts rather than assumed from the numbering.
"""

from __future__ import annotations

import json
import re
from typing import Any

name = "locomo"

_CATEGORIES = {
    "1": "multi-hop",
    "2": "temporal",
    "3": "open-domain",
    "4": "single-hop",
}
# Category 5 (adversarial) is NOT evaluated: it asks about things the conversation never
# contains, so a correct answer is a refusal and the contains-judge cannot grade it. The
# file holds 1,986 questions; the 446 cat5 ones are dropped at load time, leaving 1,540
# (282 multi-hop + 321 temporal + 96 open-domain + 841 single-hop). run.py used to do
# this filtering itself; it belongs here, with the rest of what makes LoCoMo LoCoMo.
_EXCLUDED_CATEGORIES = {"5"}


def load_units(data_path: str) -> list[dict[str, Any]]:
    with open(data_path, encoding="utf-8") as fh:
        data = json.load(fh)
    units = []
    for i, item in enumerate(data):
        conv = item.get("conversation") or {}
        units.append(
            {
                "index": i,
                "conversation": conv,
                "speaker_a": conv.get("speaker_a", ""),
                "speaker_b": conv.get("speaker_b", ""),
                "qa": [
                    q
                    for q in (item.get("qa") or [])
                    if str(q.get("category")) not in _EXCLUDED_CATEGORIES
                ],
            }
        )
    return units


def owner_of(unit: dict[str, Any], eval_owner: str) -> str:
    speaker = unit["speaker_a"] if eval_owner == "speaker_a" else unit["speaker_b"]
    return f"{str(speaker).lower()}_conv{unit['index']}"


def sender_id_of(conv_index: int, speaker: str) -> str:
    """Owner each message is filed under: its own speaker, not the queried one.

    LoCoMo is graded from one speaker's partition but ingested per speaker, so a message
    from speaker_b belongs to speaker_b's owner. Filing everything under the queried
    owner puts both speakers' episodes in one partition and changes what retrieval sees.
    """
    return f"{str(speaker).lower()}_conv{conv_index}"


def gold_of(unit: dict[str, Any], qa: dict[str, Any]) -> set[str]:
    out: set[str] = set()
    for ev in qa.get("evidence") or []:
        m = re.match(r"D(\d+):", str(ev))
        if m:
            out.add(f"locomo_conv{unit['index']}_s{int(m.group(1))}")
    return out


def judge_spec() -> dict[str, Any]:
    # LoCoMo's published numbers use the plain contains-style judge with a majority
    # vote, not the category-clause hybrid judge (that one is LongMemEval-specific).
    return {"judge": "base_contains", "answer_prompt": "default"}


def categories() -> dict[str, str]:
    return dict(_CATEGORIES)


# Prompts for this benchmark. Byte-identical to the ones the published 90.58% was
# produced with; graded by the plain judge, with no extra rules.
ANSWER_PROMPT = """
You are an intelligent memory assistant tasked with retrieving accurate information from episodic memories.

# CONTEXT:
You have access to episodic memories from conversations between two speakers. These memories contain
timestamped information that may be relevant to answering the question.

# INSTRUCTIONS:
Your goal is to synthesize information from all relevant memories to provide a comprehensive and accurate answer.
You MUST follow a structured Chain-of-Thought process to ensure no details are missed.
Actively look for connections between people, places, and events to build a complete picture. Synthesize information from different memories to answer the user's question.
It is CRITICAL that you move beyond simple fact extraction and perform logical inference. When the evidence strongly suggests a connection, you must state that connection. Do not dismiss reasonable inferences as "speculation." Your task is to provide the most complete answer supported by the available evidence.

# CRITICAL REQUIREMENTS:
1. NEVER omit specific names - use "Amy's colleague Rob" not "a colleague"
2. ALWAYS include exact numbers, amounts, prices, percentages, dates, times
3. PRESERVE frequencies exactly - "every Tuesday and Thursday" not "twice a week"
4. MAINTAIN all proper nouns and entities as they appear
5. EXPLICITLY state confidence levels for inferences (High/Medium/Low)

# RESPONSE FORMAT (You MUST follow this structure):

## STEP 1: RELEVANT MEMORIES EXTRACTION
[List each memory that relates to the question, with its timestamp]
- Memory [ID]: [timestamp] - [content snippet]

## STEP 2: KEY INFORMATION IDENTIFICATION
[Extract ALL specific details from the memories]
- Names mentioned: [list all person names, place names, company names]
- Numbers/Quantities: [list all amounts, prices, percentages]
- Dates/Times: [list all temporal information]
- Frequencies: [list any recurring patterns]
- Other entities: [list brands, products, etc.]

## STEP 3: CROSS-MEMORY LINKING & INFERENCE
[Identify entities that appear in multiple memories and link related information. Make reasonable inferences when entities are strongly connected.]
- Shared entities: [list people, places, events mentioned across different memories]
- Connections found: [e.g., "Memory 1 mentions A moved from hometown -> Memory 2 mentions A's hometown is LA -> Therefore A moved from LA"]
- Inferences: [Connect the dots. Label confidence: (Confidence: High/Medium/Low)]

## STEP 4: TIME REFERENCE CALCULATION
[If applicable, convert relative time references using the timestamps]
- Original reference: [e.g., "last year" from May 2022]
- Calculation: [Show logic]
- Actual time: [e.g., "2021"]

## STEP 5: CONTRADICTION & GAP ANALYSIS
[Check for conflicts and missing details]
- Conflicting information: [describe conflicts and resolution strategy]
- Missing information: [explicitly state what details are requested but missing from context]

## STEP 6: DETAIL VERIFICATION CHECKLIST
- [ ] All person names included?
- [ ] All locations included?
- [ ] All numbers exact?
- [ ] All frequencies specific?
- [ ] All dates/times precise?
- [ ] All proper nouns preserved?

## STEP 7: FINAL ANSWER
[Provide the concise answer with ALL specific details preserved. Do not include the internal checklist in this section, just the final synthesized answer.]

---

{context}

{current_date_line}Question: {question}

Now, follow the Chain-of-Thought process above to answer the question:
"""

CONTEXT_TEMPLATE = """Episodes memories for conversation between {speaker_a} and {speaker_b}:

    {episodes}
"""

JUDGE_SYSTEM_PROMPT = "You are an expert grader that determines if answers to questions match a gold standard answer"

JUDGE_USER_PROMPT = """Your task is to label an answer to a question as 'CORRECT' or 'WRONG'. You will be given the following data:
    (1) a question (posed by one user to another user),
    (2) a 'gold' (ground truth) answer,
    (3) a generated answer
which you will score as CORRECT/WRONG.

The point of the question is to ask about something one user should know about the other user based on their prior conversations.
The gold answer will usually be a concise and short answer that includes the referenced topic, for example:
Question: Do you remember what I got the last time I went to Hawaii?
Gold answer: A shell necklace
The generated answer might be much longer, but you should be generous with your gr
```

### Core Architecture Module: `benchmarks/adapters/longmemeval.py`
```
"""LongMemEval adapter.

Reads the native ``longmemeval_s.json``. Earlier runs went through a LoCoMo-shaped
conversion and drove the LoCoMo runner with ``--data-path``; that flattening is what
this adapter replaces.

One question per conversation, and the owner is positional: ``longmemeval_<index>``.

Gold needs a translation the source does not spell out: the benchmark cites
``answer_session_ids``, which are ORIGINAL session names, while the store names sessions
by their POSITION in the haystack. The mapping is
``haystack_session_ids.index(answer_session_id)`` -> ``session_<k>``.

This is also the only benchmark whose judge applies category leniency clauses, so the
hybrid judge and the precise (enumeration / temporal) answer prompt are declared here
rather than shared -- using them on another benchmark mis-fires the clauses.
"""

from __future__ import annotations

import json
from typing import Any

from .base import session_epoch_ms

name = "longmemeval"

_CATEGORIES = {
    "single-session-user": "single-session-user",
    "single-session-assistant": "single-session-assistant",
    "single-session-preference": "single-session-preference",
    "multi-session": "multi-session",
    "temporal-reasoning": "temporal-reasoning",
    "knowledge-update": "knowledge-update",
}


# Sessions are laid out one day apart, messages 30s apart. Only the ORDER is
# meaningful -- these benchmarks carry no per-message clock.
_BASE_TS_MS = 1_700_000_000_000


def load_units(data_path: str) -> list[dict[str, Any]]:
    with open(data_path, encoding="utf-8") as fh:
        data = json.load(fh)
    units = []
    for i, q in enumerate(data):
        units.append(
            {
                "index": i,
                "haystack_session_ids": list(q.get("haystack_session_ids") or []),
                "haystack_sessions": list(q.get("haystack_sessions") or []),
                # sessions_of() reads these for the per-session timestamps; without them
                # every session gets a purely synthetic clock.
                "haystack_dates": list(q.get("haystack_dates") or []),
                "qa": [
                    {
                        "question": q.get("question", ""),
                        "answer": q.get("answer", ""),
                        "category": q.get("question_type", ""),
                        "question_id": q.get("question_id", ""),
                        "question_date": q.get("question_date", ""),
                        "answer_session_ids": list(q.get("answer_session_ids") or []),
                    }
                ],
            }
        )
    return units


def owner_of(unit: dict[str, Any], eval_owner: str) -> str:
    # One owner per question; eval_owner has no meaning here.
    return f"longmemeval_{unit['index']}"


# A question the judge could never read leaves the denominator rather than counting as
# wrong: the reference reports `100*correct/len(ok)` over the rows whose verdict is not
# None (rejudge_hybrid.py:77-79). The other three grade such a row wrong and keep it.
JUDGE_FAILURE_EXCLUDES_ROW = True


def parse_judge_label(content: str) -> str | None:
    """Read the judge's verdict the way this benchmark's harness reads it.

    The shared parser looks for a fenced block, then for a ``"label"`` object with no
    inner braces, and falls back to the whole reply. That is what LoCoMo's harness does
    and it is verified against it. This benchmark's harness takes the first ``{`` to the
    last ``}`` instead (reanswer_27b.py:56), which differs on a verdict carrying a brace
    inside a string -- the shared parser truncates that into invalid JSON, costing a
    retry and, if the judge repeats itself, the verdict.

    Returns None when no verdict could be read, which asks the judge again rather than
    recording a wrong answer.
    """
    i, j = content.find("{"), content.rfind("}")
    blob = content[i : j + 1] if i >= 0 and j > i else ""
    if not blob:
        return None
    try:
        label = json.loads(blob).get("label", "")
    except (json.JSONDecodeError, AttributeError):
        return None
    label = str(label).strip().upper()
    # The reference accepts only these two and asks again otherwise
    # (reanswer_dec_precise_hybrid.py:142); anything else is a reply it could not read,
    # not a verdict of wrong.
    return label if label in ("CORRECT", "WRONG") else None


def speakers_of(unit: dict[str, Any]) -> tuple[str, str]:
    """The speaker pair the answer prompt's context header names.

    The reference reads a locomo-style conversion whose speakers are
    ``user_<question_id>`` / ``assistant_<question_id>`` (reanswer_27b.py:64-65), so
    every one of the 500 prompts carries its own pair. Falling back to the owner id
    rendered "between longmemeval_0 and longmemeval_0" on all of them instead.
    """
    # The WHOLE question_id, not the part before the first underscore. 132 of the 500
    # ids carry one: 30 unanswerable questions end in `_abs`, and 102 begin `gpt4_`,
    # which truncation collapsed onto a single shared pair -- the opposite of the
    # per-question pair this exists to reproduce.
    qid = str((unit.get("qa") or [{}])[0].get("question_id") or "").strip()
    if not qid:
        return ("user", "assistant")
    return (f"user_{qid}", f"assistant_{qid}")


def gold_of(unit: dict[str, Any], qa: dict[str, Any]) -> set[str]:
    # First occurrence wins, matching the reference's list.index(). A plain dict
    # comprehension keeps the LAST, which mislabels the gold of every question whose
    # haystack repeats a session id.
    pos: dict[str, int] = {}
    for k, s in enumerate(unit["haystack_session_ids"]):
        pos.setdefault(s, k)
    return {f"session_{pos[a]}" for a in qa.get("answer_session_ids") or [] if a in pos}


def judge_spec() -> dict[str, Any]:
    return {"judge": "hybrid", "answer_prompt": "precise"}


def categories() -> dict[str, str]:
    return dict(_CATEGORIES)


def sessions_of(unit: dict) -> list[dict]:
    """One ingestible session per haystack session, in haystack order.

    Order is load-bearing: gold is cited as `answer_session_ids`, and the store names
    sessions positionally, so `session_<k>` must correspond to `haystack_sessions[k]` --
    the same mapping gold_of() inverts. Messages are {role, content}, not the
    {speaker, text} shape LoCoMo uses.
    """
    out: list[dict] = []
    sessions = unit.get("haystack_sessions") or []
    dates = unit.get("haystack_dates") or []
    for idx, msgs in enumerate(sessions):
        # The session's real timestamp, not a synthetic offset: episode timestamps are
        # rendered into the answer prompt and temporal questions are graded on them.
        base = session_epoch_ms(dates[idx] if idx < len(dates) else "")
        if base is None:
            base = _BASE_TS_MS + idx * 86_400_000
        turns = []
        for j, m in enumerate(msgs or []):
            text = (m or {}).get("content") or ""
            if not text:
                continue
            turns.append(
                {
                    "speaker": str(m.get("role") or "user"),
                    "text": text,
                    "dia_id": f"D{idx}:{j}",
                    "timestamp_ms": base + j * 30_000,
                }
            )
        if not turns:
            continue
        out.append(
            {
                "session_idx": idx,
                # Without this key run.py falls back to LoCoMo's `locomo_conv<i>_s<j>`
                # naming, so every session lands in the store under a name gold_of()
                # never produces: retrieval still works, but core/IR scores read a flat
                # zero.
                "session_id": f"session_{idx}",
                "messages": turns,
                "date": dates[idx] if idx < len(dates) else "",
            }
        )
    return out


# Prompts for this benchmark. The judge prompt carries LongMemEval's four official
# grading rules inline -- without 
```

### Core Architecture Module: `benchmarks/adapters/subtlememory.py`
```
"""SubtleMemory adapter.

Owner is the persona directory name (``persona_0`` .. ``persona_9``), and the store is
partitioned per persona rather than being one flat store, so a run reads ten stores.

Gold needs the same kind of translation as EverMemBench, for a different reason:
``bench_instances.json`` cites ORIGINAL session names
(``related-persona_0-related-export-<hash>-s1``) while the store names sessions
positionally (``session_<order>``). The ``order`` field in ``history_sessions.json`` is
the mapping. Its ``evidence`` field is empty, so ``session_ids`` is the only gold
signal.

Answers are a LIST of acceptable strings (``correct_answers``), joined for the judge.
"""

from __future__ import annotations

import json
import os
import pathlib
import re
from typing import Any

from ._profile import with_profile_block
from .base import session_epoch_ms

name = "subtlememory"

# The dataset directory. `BENCH_DATA_SUBTLEMEMORY` is the same variable
# `configs/subtlememory.toml` reads for `data_path`, so one value covers both.
# `or`, not `.get(k, default)`: a set-but-empty key returns "", not the default, and the
# shipped .env.example declares every path key empty on purpose.
DATA_DIR = os.environ.get("BENCH_DATA_SUBTLEMEMORY") or "benchmarks/data/subtlememory"


# Sessions are laid out one day apart, messages 30s apart. Only the ORDER is
# meaningful -- these benchmarks carry no per-message clock.
_BASE_TS_MS = 1_700_000_000_000


def load_units(data_path: str) -> list[dict[str, Any]]:
    root = pathlib.Path(data_path or DATA_DIR)
    # A wrong root used to produce zero units and no error: the `continue` below skips a
    # persona whose two files are absent, which is right for a partial download and wrong
    # for a path that does not exist at all. The run then scored 0/0 and reported a clean
    # finish. Fail here instead, naming the path, so the cause is the message.
    if not root.is_dir():
        raise FileNotFoundError(
            f"SubtleMemory data directory not found: {root} -- set BENCH_DATA_SUBTLEMEMORY "
            f"or pass --data-path"
        )
    units = []
    for i in range(10):
        base = root / f"persona_{i}"
        bi, hs = base / "bench_instances.json", base / "history_sessions.json"
        if not bi.exists() or not hs.exists():
            continue
        # original session name -> session_<order>, the store's positional naming
        _hs = json.loads(hs.read_text(encoding="utf-8"))
        real2pos = {
            str(x["session_id"]): f"session_{x['order']}"
            for x in _hs
            if x.get("session_id") is not None and x.get("order") is not None
        }
        qa = []
        for inst in json.loads(bi.read_text(encoding="utf-8")):
            gold = {real2pos.get(str(x)) for x in inst.get("session_ids") or []}
            gold.discard(None)
            for q in inst.get("qas") or []:
                ok = q.get("correct_answers") or []
                item = {
                    "question": str(q.get("query", "")),
                    "answer": " | ".join(str(x) for x in ok),
                    # The instance field is `relation_type`; there is no `type` key, and
                    # reading one silently made every category "" and erased the
                    # benchmark's per-relation breakdown.
                    "category": str(inst.get("relation_type", "")),
                    "gold_sessions": sorted(gold),
                }
                # The judge reads relation semantics, facts and both answer lists, so
                # the QA and its instance both contribute; the QA wins on shared keys.
                for src in (inst, q):
                    for k in _META_KEYS:
                        if src.get(k) is not None:
                            item[k] = src[k]
                qa.append(item)
        units.append({"sessions": _hs, "index": f"persona_{i}", "qa": qa})
    return units


def owner_of(unit: dict[str, Any], eval_owner: str) -> str:
    return str(unit["index"])


def gold_of(unit: dict[str, Any], qa: dict[str, Any]) -> set[str]:
    # Resolved at load time: the mapping needs history_sessions.json, which is read once
    # per persona rather than once per question.
    return set(qa.get("gold_sessions") or ())


def judge_spec() -> dict[str, Any]:
    return {"judge": "relation_aware", "answer_prompt": "v1_concise"}


def categories() -> dict[str, str]:
    return {}


def sessions_of(unit: dict) -> list[dict]:
    """Sessions ordered by the `order` field, which IS the store's positional index.

    gold_of() maps the benchmark's original session names onto `session_<order>`, so
    ingesting in any other order would silently break every gold lookup: the ids would
    still resolve, just to the wrong sessions.
    """
    out: list[dict] = []
    for sess in sorted(
        unit.get("sessions") or [], key=lambda s: int(s.get("order", 0))
    ):
        # The real session clock is `timestamp` (ISO-8601 with an offset). `date` does
        # not exist in this dataset, and reading it left every session on a synthetic
        # clock -- episode timestamps are rendered into the answer prompt, so they have
        # to be real.
        _order = int(sess.get("order", 0))
        base = session_epoch_ms(sess.get("timestamp"))
        if base is None:
            base = _BASE_TS_MS + _order * 86_400_000
        msgs = [
            {
                "speaker": str(m.get("role") or "user"),
                "text": m.get("content") or "",
                "dia_id": f"D{_order}:{j}",
                "timestamp_ms": base + j * 30_000,
            }
            for j, m in enumerate(sess.get("history") or [])
            if (m.get("content") or "")
        ]
        if msgs:
            # gold_of() emits `session_<order>`; without this key run.py falls back to
            # LoCoMo's naming and no gold id can ever match what the store holds.
            out.append(
                {
                    "session_idx": _order,
                    "session_id": f"session_{_order}",
                    "messages": msgs,
                    "date": str(sess.get("timestamp") or ""),
                }
            )
    return out


# =============================================================================
# Prompts, guidance tables and judge helpers -- verbatim from the benchmark's own
# harness (Evaluation/SubtleMemory/EverOS/legacy/test_subtlememory.py).
#
# SubtleMemory diverges from LoCoMo in all three graded stages, so none of LoCoMo's
# prompts apply here:
#   * answer  -- the official v1_concise prompt, not LoCoMo's chain-of-thought one
#   * judge   -- relation-aware: it reads relation type/subtype, the extracted facts,
#                the accepted and known-incorrect answer lists, and persona context
#   * context -- a numbered evidence list, with no speaker-pair scaffolding
# =============================================================================

ANSWER_PROMPT = """You are a helpful personal assistant. You are very good at distinguishing detailed conflicts and relationships in memory, then using those memories to answer questions or complete tasks.

# CONTEXT
{context}

# INSTRUCTIONS
- Answer the question or complete the user's requested task based on the provided context.
- First identify the information and details in the context that are useful for answering the question.
- If the useful information contains time-based updates, use the time mentioned by the user to decide which information applies.
- Some information may apply only in different situations, such as different ways of speaking in different professional roles.
- Some questions require using all useful information to provide a complete answer. In those cases, consider all relevant information when answering or completing the task.
- Do not treat the order of information in the context, or the chronological order of session timestamps, as proof that one piece of information is an update. The user may
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #333** (2026-09-09): **[Bug]: 为何配置文件里不给LLM设置超时时间？**
  *Symptoms*: ### Area  src/everos  ### What happened?  一次问答出现报错： <img width="748" height="474" alt="Image" src="https://github.com/user-attachments/assets/e1ac7590-6c2e-419c-a9e4-8ac9b9ac3fc7" />  **排查：** 1、curl测试模型是可以正常工作的 ---> 推出：everos内部LLM调用超时 2、配置文件.env中可以配置embedding、reranker的超时时间，但无法配置llm的超时时间。 <img width="885" height="813" alt="Image" src="https://github.com/user-attachments/assets/62286581-0c82-4bbe-afba-2c90438b3c53" />  **追溯源码：** LLM默认超时时间：60s <img width="1230" height="639" alt="Image" src="https://github.com/user-attachments/assets/2696aa3b-2454-4f5e-8ea3-979eb0245fc3" />  embedding默认超时时间：30s <img width="1150" height="541" alt="Image" src="https://github.com/user-attachments/assets/5c13d5f2-3438-4135-bf17-d40eebcf620b" />  **期望** 配置文件里也有LLM的超时时间参数  ### Steps to reproduce  No  ### Environment  _No response_  ### Logs or screenshots  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for flagging this. I checked the current 1.3.1 source on `main` (`5076683`), and the main application client now accepts a configurable LLM timeout.  You can add this to the existing `[llm]` section in your `everos.toml`, then restart EverOS:  ```toml [llm] timeout_seconds = 240 ```  Or set `EVEROS_LLM__TIMEOUT_SECONDS=240` in the environment of the process that starts EverOS. An exported environment value takes precedence over TOML. Putting it only in a `.env` file requires your launcher to load that file; Settings does not load it automatically.  I tested both configuration paths against the real client constructors: 180 seconds from the environment and 240 seconds from TOML reached the EverAlgo client, OpenAI SDK, and HTTPX timeouts. I also checked environment-over-TOML precedence, the 60-second default, and rejection of zero/negative values. No live model request was used, so this does not claim that the original endpoint error has been reproduced and eliminated.  Closing th

- **Issue #268** (2026-06-24): **[Bug]: always-injected memory-tools skill names two MCP tools (search_memories, get_memory) that do not exist; the real tool is evermem_search**
  *Symptoms*: **Area:** use-cases  ## What happened?  `use-cases/claude-code-plugin/skills/memory-tools.md` has `alwaysInclude: true`, so its guidance is injected into every plugin session. Under "## Available Tools" it lists:  - `search_memories` - `get_memory` ("Retrieve full details of a specific memory by ID")  Neither tool is implemented anywhere in the plugin slice. The MCP server (`mcp/server.js`, line 15) and `commands/ask.md` (line 18) expose exactly one tool: `evermem_search` (params: `query` required, `limit` default 10 / max 20). There is no get-by-id capability at all, so `get_memory` describes functionality that does not exist. The result is that the always-on instructions tell the agent to call tools the server will reject, and never mention the tool that actually works.  ## Steps to reproduce 1. Inspect the always-injected skill: `grep -n 'search_memories\\get_memory' use-cases/claude-code-plugin/skills/memory-tools.md` -> matches on lines 12-13. 2. Inspect the actual MCP tool surface: `grep -rn 'name:' use-cases/claude-code-plugin/mcp/server.js` -> only `evermem_search`. 3. Confirm no implementation of the named tools: `grep -rn 'search_memories\\get_memory' use-cases/claude-code-plugin/` -> only the skill doc; no server handler, no command. 4. In a plugin session, the agent (following the skill) attempts to call `search_memories` / `get_memory`; the MCP server has no such tools, so the calls cannot succeed, while `evermem_search` is never surfaced.  ## Expected vs actual 
  **Post-Mortem & Fix Analysis**:
  > Closing this as fixed. The current Claude Code plugin docs and command guidance now reference the actual MCP tool name, `evermem_search`, and no longer instruct users to call the old non-existent `search_memories` / `get_memory` tools.

- **Issue #223** (2026-05-26): **[Bug]: Running demo/extract_memory.py will throw an exception indicating that Field required**
  *Symptoms*: ### Area  methods/EverCore  ### What happened?  branch：main Running demo/extract_memory.py will throw an exception indicating that the parameter verification is invalid. I found the following bugs in the code. methods/EverCore/demo/extract_memory.py function convert_to_v1_message return {         "message_id": msg.get("message_id"),         "sender_id": msg.get("sender"),         "sender_name": msg.get("sender_name"),         "role": role,         "timestamp": timestamp_ms,         "type": msg.get("type", "text"),         "text": {"content": msg.get("content", "")},     }  but there is no parameter key "text" in define of /api/v1/memories, the correct as follow： {         "message_id": msg.get("message_id"),         "sender_id": msg.get("sender"),         "sender_name": msg.get("sender_name"),         "role": role,         "timestamp": timestamp_ms,         "type": msg.get("type", "text"),         "content": msg.get("content", ""),     }    ### Steps to reproduce  1. branch：main 2. Step 1,Start the API Server: uv run python src/run.py --port 1995 3. Step 2, Extract Memories: uv run python src/bootstrap.py demo/extract_memory.py 4. you will see below exception Failed: HTTP 422       {"code":"HTTP_ERROR","message":"Field required: messages -> 0 -> content","request_id":"b5f50f76-bf79-4a91-867a-bee5f321e395","timestamp":"2026-05-21T08:42:38.795336+00:00","path":"/api/v1/memories"}  ### Environment  _No response_  ### Logs or screenshots  Failed: HTTP 422 {"code":"HTTP_ERROR","me
  **Post-Mortem & Fix Analysis**:
  > 已定位并提交 demo-only 修复：#228  问题原因：`methods/EverCore/demo/extract_memory.py` 仍在发送旧格式：  ```json {"text": {"content": "..."}} ```  但当前 V1 `MessageItem` DTO 要求的是顶层 `content` 字段：  ```json {"content": "..."} ```  本地验证结果： - 旧 payload 会在 DTO 校验阶段失败：`messages.0.content Field required` - 新 payload 可以通过 `PersonalAddRequest` 校验，并被转换成 `ContentItem(type='text', text=...)` - 实际本地启动 EverCore 后，demo 请求已经不再触发这个 422；后续若返回 500，是进入业务逻辑后的 LLM endpoint 配置问题，和本 issue 的 payload bug 不是同一层  修复范围刻意保持在 demo：只更新 demo 发送的 payload，不改服务端 DTO 兼容逻辑。

- **Issue #79** (2026-03-03): **我发现触发边界的最后一条对话消息，会被丢失。这个需要怎么解决呢？**
  *Symptoms*: 我发现触发边界的最后一条对话消息，会被丢失。这个需要怎么解决呢？
  **Post-Mortem & Fix Analysis**:
  > 这个确实是个问题，怎么问题关闭了呢
  > 这个不是进入下一轮边界检测了吗。在那个pending msg里面

- **Issue #78** (2026-06-06): **[bug] Search API only uses memory_types[0], silently ignoring all other types**
  *Symptoms*: ## What broke?  The search API accepts a list of `memory_types`, but the retrieval logic only uses `memory_types[0]`. All other types in the list are silently ignored — they are never searched and no results are returned for them.  Additionally, if the first type happens to be one that the search backend doesn't support (e.g., `profile`, which is stored in MongoDB and only retrievable via the fetch API), the entire search errors out and returns 0 results.  ## Steps to Reproduce  **Case 1 — silent data loss (no error, but incomplete results):**  1. Start EverMemOS 2. Send: `GET /api/v1/memories/search?memory_types=episodic_memory,foresight&query=hello&retrieve_method=hybrid&top_k=5&user_id=test_user&group_id=test_user` 3. Only `episodic_memory` is searched. `foresight` is silently ignored — no warning, no error, no results.  **Case 2 — error when unsupported type is first:**  1. Send: `GET /api/v1/memories/search?memory_types=profile,episodic_memory,foresight&query=hello&retrieve_method=hybrid&top_k=5&user_id=test_user&group_id=test_user` 2. `profile` (not indexed in ES/Milvus) is taken as `memory_types[0]` → ERROR. `episodic_memory` and `foresight` are never searched. 0 results returned.  ## What did you expect?  - The search should iterate over all requested `memory_types` - For each type supported by ES/Milvus (`episodic_memory`, `foresight`, `event_log`), perform keyword + vector search - Skip types not supported by the search backend (e.g., `profile`) with an info log - M
  **Post-Mortem & Fix Analysis**:
  > Closing this as part of the EverOS 1.0 issue triage. This issue references the pre-1.0 API or retired infrastructure such as /api/v1/memories, /api/v3/agentic/*, MongoDB, Elasticsearch, Milvus, Redis, Kafka, longjob, or old memory type names. EverOS 1.0 uses POST /api/v1/memory/{add,flush,search,get} with Markdown + SQLite + LanceDB. Migration notes are tracked in PR #258: https://github.com/EverMind-AI/EverOS/pull/258. If the same behavior still occurs on current main with the 1.0 API, please open a fresh issue with a 1.0 repro.
  > Post-triage verification: keeping this closed because the 1.0 search contract no longer accepts a memory_types list that can silently ignore later values. Current POST /api/v1/memory/search chooses the owner track via user_id or agent_id and returns typed arrays: episodes, profiles, agent_cases, and agent_skills. Profile inclusion is explicit via include_profile.

- **Issue #73** (2026-06-06): **Cannot Reproduce LoCoMo Benchmark Results**
  *Symptoms*: # LoCoMo Benchmark Results - Significant Accuracy Gap  **Issue**: EverMemOS achieves 38.38% accuracy vs paper's claimed 93% on LoCoMo benchmark  ## Environment  - **OS**: Windows 10 - **Python**: 3.12.7 - **Docker**: 28.1.1 (MongoDB, Elasticsearch, Milvus, Redis) - **Dependencies**: `uv sync --group evaluation`  ## Configuration  **Models**: - LLM: `openai/gpt-4.1-mini` (OpenRouter, temp=0.3) - Embedding: `Qwen/Qwen3-Embedding-4B` (DeepInfra, dim=1024) - Reranker: `Qwen/Qwen3-Reranker-4B` (DeepInfra) - Search mode: `agentic`  ## Commands Run  ```bash # Start services docker-compose up -d  # Smoke test (30 questions, 10 messages/conv) uv run python -m evaluation.cli --dataset locomo --system evermemos --smoke  # Full conv-26 (152 questions, 419 messages) uv run python -m evaluation.cli --dataset locomo --system evermemos --from-conv 0 --to-conv 1 ```  ## Results  | Test | Messages | Questions | Accuracy | vs Paper | |------|----------|-----------|----------|----------| | **Paper (LoCoMo)** | All | 1,986 | **93.0%** | - | | **Smoke test** | 10/conv | 30 | 52.22% | -40.78% | | **Conv-26 (full)** | 419 | 152 | **38.38%** | **-54.62%** |  ### Category Breakdown (Smoke Test) - Single-hop: 41.67% (vs 96.08% in paper) - Multi-hop: 54.76% (vs 91.13% in paper) - Temporal: 66.67% (vs 89.72% in paper) - Open domain: 100% (vs 70.83% in paper)  ## Key Findings  1. **Performance degrades with more context**:    - 10 messages: 52.22%    - 419 messages: 38.38% (-13.84%)  2. **Only tested 1/10
  **Post-Mortem & Fix Analysis**:
  > Hey, thanks for the issue. We just ran the test and everything works as expected.   Do you want to join the Discord channel or WeChat group? We can talk about the way you tested it and make sure you used the right process so you get the same results we did.
  > I have the same config and also get bad test result
  > @conahpchen @wangyu-ustc Are you guys on our Discord or in our WeChat group? If you are, let's collaborate on that. We can arrange a session to talk about it, as I think there's something wrong with the process.

- **Issue #57** (2026-06-05): **STARTER_KIT.md  和 issue 入口 Discord  链接失效**
  *Symptoms*:  STARTER_KIT.md  和 issue 入口 Discord  链接失效
  **Post-Mortem & Fix Analysis**:
  > Fixed.

- **Issue #53** (2026-06-06): **中文环境下，MongoDB存储的数据都是英文，这个会影响记忆的提取吗？**
  *Symptoms*: 我浏览了下prompt，里面并没有对工作语言的说明，在记忆提取时，也没有语言的说明，在monogo存储的也是英文，请问这个设计意图是什么？
  **Post-Mortem & Fix Analysis**:
  > <img width="838" height="317" alt="Image" src="https://github.com/user-attachments/assets/4d57e66b-d2ff-4256-8a69-0c6ce8a6e55a" />
  > Closing this as part of the EverOS 1.0 issue triage. This issue references the pre-1.0 API or retired infrastructure such as /api/v1/memories, /api/v3/agentic/*, MongoDB, Elasticsearch, Milvus, Redis, Kafka, longjob, or old memory type names. EverOS 1.0 uses POST /api/v1/memory/{add,flush,search,get} with Markdown + SQLite + LanceDB. Migration notes are tracked in PR #258: https://github.com/EverMind-AI/EverOS/pull/258. If the same behavior still occurs on current main with the 1.0 API, please open a fresh issue with a 1.0 repro.

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

### Incident Patch 1: `6aff7351` (2026-09-30)
**Commit Message**: fix(knowledge): keep PATCH category moves inside knowledge/ (#469)

* fix(knowledge): keep PATCH category moves inside knowledge/

PATCH /knowledge/documents/{doc_id} sanitized the new category with a
private copy of the dirname rule that lacked the "." / ".." fallback, so
category_id ".." moved the document directory out of knowledge/ into
the project directory, where the md scan no longer finds it.

Route the category through the shared sanitize_dirname (the rule the
create path already uses, so "." / ".." fall back to "Others"), build
the target from the project's knowledge_dir, and assert the resolved
target stays inside it before any directory is created or moved. A
document an earlier move left outside knowledge/ is moved back on its
next category change.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* docs(security): refresh supported versions and define advisory scope

The supported-versions table still named 1.2.x as current; 1.4.x is the
live line. Also state where the advisory line sits: issues that let
untrusted input reach beyond what the caller can already touch get an
advisory, while issues a trusted caller can trigger only against its
own da

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -7,6 +7,17 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+
+- **Changing a knowledge document's category keeps it inside `knowledge/`.**
+  `PATCH /knowledge/documents/{doc_id}` with `category_id` set to `..` moved
+  the document's directory up into the project directory, where the markdown
+  scan no longer finds it. The category now goes through the same rule as
+  document creation, so `.` and `..` fall back to `Others`, and the move is
+  refused if its target would leave `knowledge/`. A document an earlier move
+  left outside is moved back on its next category change. Reported by
+  White0xdi3.
+
 ## [1.4.1] - 2026-09-24
 
 **A fresh install works again.** The `openai` SDK released its 3.x line on
```

**File**: `SECURITY.md` (modified, +9/-2)
```diff
@@ -7,8 +7,8 @@ not receive backports.
 
 | Version | Supported |
 |---------|-----------|
-| `1.2.x` (current) | ✅ |
-| `1.1.x` and older | ❌ — upgrade to the current line |
+| `1.4.x` (current) | ✅ |
+| `1.3.x` and older | ❌ — upgrade to the current line |
 
 ## Reporting a Vulnerability
 
@@ -58,3 +58,10 @@ following in mind:
   the providers you configure.
 - Memory content is stored as plaintext `.md` files; apply OS-level file
   permissions or disk encryption if your data is sensitive.
+- **What counts as a vulnerability.** An issue qualifies for a security
+  advisory when untrusted input (an ingested document, or a caller outside the
+  supported threat model) can reach data or files beyond what the API already
+  lets that caller touch — for example, writing outside the memory root. An
+  issue a trusted API caller can trigger only against data that same caller can
+  already modify or delete through the API is fixed as a hardening change and
+  noted in the release notes, without an advisory.
```

**File**: `src/everos/service/knowledge.py` (modified, +16/-19)
```diff
@@ -42,7 +42,7 @@
     TopicNotFoundError,
 )
 from everos.core.observability.logging import get_logger
-from everos.core.persistence import MemoryRoot
+from everos.core.persistence import MemoryRoot, sanitize_dirname
 from everos.core.persistence.markdown import dump_frontmatter, parse_frontmatter
 from everos.infra.persistence.index import Predicate, all_of, eq
 from everos.infra.persistence.markdown import (
@@ -727,25 +727,24 @@ async def _update_index_frontmatter(
     await apath.write_text(dump_frontmatter(fm) + body, encoding="utf-8")
 
 
-_DIR_SAFE = re.compile(r"[^\w\-.]", re.UNICODE)
-
-
-def _safe_category(raw: str) -> str:
-    """Sanitize category_id for use as a directory name component."""
-    slug = raw.replace(" ", "_")
-    slug = _DIR_SAFE.sub("", slug)[:50]
-    return slug or "Others"
-
-
 async def _move_doc_directory(
     memory_root: MemoryRoot,
-    old_md_path: str,
+    current: _ResolvedDoc,
     new_category: str,
 ) -> str:
-    """Move document directory to new category folder, return new md_path."""
-    old_index = memory_root.root / old_md_path
-    old_dir = old_index.parent
-    new_dir = old_dir.parent.parent / _safe_category(new_category) / old_dir.name
+    """Move document directory to new category folder, return new md_path.
+
+    The category becomes a directory segment through the same
+    ``sanitize_dirname`` rule the create path uses, so ``.``/``..`` fall back
+    to ``Others`` instead of walking out of ``knowledge/``. The resolved
+    target is then asserted to stay inside the project's knowledge directory
+    before any directory is created or moved.
+    """
+    knowledge_dir = memory_root.knowledge_dir(current.app_id, current.project_id)
+    old_dir = (memory_root.root / current.md_path).parent
+    new_dir = knowledge_dir / sanitize_dirname(new_category, "Others") / old_dir.name
+    if not new_dir.resolve().is_relative_to(knowledge_dir.resolve()):
+        raise PathTraversalError(f"category move target escapes knowledge/: {new_dir}")
     await anyio.Path(new_dir.parent).mkdir(parents=True, exist_ok=True)
     await anyio.to_thread.run_sync(shutil.move, str(old_dir), str(new_dir))
     new_index = new_dir / "index.md"
@@ -843,9 +842,7 @@ async def _apply_patch_writes(
     await _update_index_frontmatter(index_path, new_title, new_category)
 
     if new_category != current.category_id:
-        new_md_path = await _move_doc_directory(
-            memory_root, current.md_path, new_category
-        )
+        new_md_path = await _move_doc_directory(memory_root, current, new_category)
         new_doc_dir = memory_root.root / Path(new_md_path).parent
         await _update_topics_category(new_doc_dir, new_category)
 
```

**File**: `tests/unit/test_service/test_knowledge_crud.py` (modified, +85/-0)
```diff
@@ -16,6 +16,8 @@
 import pytest
 
 from everos.component.utils.datetime import get_utc_now
+from everos.core.errors import PathTraversalError
+from everos.core.persistence import MemoryRoot
 from everos.infra.persistence.sqlite.repos.knowledge import DocumentListPage
 from everos.infra.persistence.sqlite.tables.knowledge import (
     KnowledgeDocumentRow,
@@ -398,3 +400,86 @@ async def test_patch_document_not_found_raises() -> None:
 
         with pytest.raises(DocumentNotFoundError):
             await patch_document("d_missing", "app1", "proj1", title="New")
+
+
+# ── patch_document: category move containment ────────────────────────────────
+
+
+def _lay_out_doc(root: MemoryRoot, category: str) -> Path:
+    """Create ``knowledge/<category>/Doc_<id>/`` on disk; return the doc dir."""
+    doc_dir = root.knowledge_dir("app1", "proj1") / category / "Doc_d_testdoc00001"
+    doc_dir.mkdir(parents=True)
+    (doc_dir / "index.md").write_text("---\ntitle: Test Doc\n---\n")
+    (doc_dir / "1_intro.md").write_text("---\ncategory_id: Technology\n---\n")
+    return doc_dir
+
+
+async def _patch_category(root: MemoryRoot, md_path: str, category_id: str) -> None:
+    doc = _doc_row(md_path=md_path)
+    with (
+        patch(f"{_MOD}.MemoryRoot.resolve", return_value=root),
+        patch(f"{_MOD}.knowledge_document_repo") as mock_doc_repo,
+    ):
+        mock_doc_repo.get_by_doc_id = AsyncMock(return_value=doc)
+        mock_doc_repo.upsert_from_handler = AsyncMock(return_value=None)
+        await patch_document("d_testdoc00001", "app1", "proj1", category_id=category_id)
+
+
+@pytest.mark.parametrize(
+    ("category_id", "expected_dir"),
+    [("Research Notes", "Research_Notes"), ("..", "Others"), (".", "Others")],
+)
+async def test_patch_document_category_move_stays_in_knowledge(
+    tmp_path: Path, category_id: str, expected_dir: str
+) -> None:
+    """``.``/``..`` fall back to ``Others`` like the create path does."""
+    root = MemoryRoot(tmp_path)
+    doc_dir = _lay_out_doc(root, "Technology")
+    md_path = str((doc_dir / "index.md").relative_to(root.root))
+
+    await _patch_category(root, md_path, category_id)
+
+    knowledge_dir = root.knowledge_dir("app1", "proj1")
+    moved = knowledge_dir / expected_dir / "Doc_d_testdoc00001"
+    assert (moved / "index.md").is_file()
+    assert (moved / "1_intro.md").is_file()
+    assert not doc_dir.exists()
+    assert not (knowledge_dir.parent / "Doc_d_testdoc00001").exists()
+
+
+async def test_patch_document_category_move_repairs_escaped_doc(
+    tmp_path: Path,
+) -> None:
+    """A doc an earlier ``..`` move left outside ``knowledge/`` is moved back."""
+    root = MemoryRoot(tmp_path)
+    knowledge_dir = root.knowledge_dir("app1", "proj1")
+    knowledge_dir.mkdir(parents=True)
+    escaped = knowledge_dir.parent / "Doc_d_testdoc00001"
+    escaped.mkdir()
+    (escaped / "index.md").write_text("---\ntitle: Test Doc\n---\n")
+    md_path = str(
+        knowledge_dir.relative_to(root.root) / ".." / escaped.name / "index.md"
+    )
+
+    await _patch_category(root, md_path, "Science")
+
+    assert (knowledge_dir / "Science" / escaped.name / "index.md").is_file()
+    assert not escaped.exists()
+
+
+async def test_patch_document_category_move_rejects_escaping_target(
+    tmp_path: Path,
+) -> None:
+    """A category dir symlinked out of ``knowledge/`` trips the backstop."""
+    root = MemoryRoot(tmp_path)
+    doc_dir = _lay_out_doc(root, "Technology")
+    outside = tmp_path / "outside"
+    outside.mkdir()
+    (root.knowledge_dir("app1", "proj1") / "Others").symlink_to(outside)
+    md_path = str((doc_dir / "index.md").relative_to(root.root))
+
+    with pytest.raises(PathTraversalError):
+        await _patch_category(root, md_path, "..")
+
+    assert doc_dir.is_dir()
+    assert not any(outside.iterdir())
```

---

### Incident Patch 2: `462ebf9f` (2026-09-24)
**Commit Message**: fix(deps): pin openai below 3 so a fresh install can call the LLM

Squash merge of PR #468 (1.4.1).

**File**: `CHANGELOG.md` (modified, +22/-0)
```diff
@@ -7,6 +7,28 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [1.4.1] - 2026-09-24
+
+**A fresh install works again.** The `openai` SDK released its 3.x line on
+2026-09-24; an unconstrained install picked it up together with an httpx
+pre-release, and every LLM and embedding call failed before reaching the
+network. This release pins the SDK to the 2.x line the project is tested
+against. Nothing else changed since 1.4.0.
+
+### Fixed
+
+- **`openai` is pinned below 3.** Fresh installs from PyPI resolved
+  `openai 3.19.2`, whose client raises `AttributeError: module 'httpx' has no
+  attribute 'Timeout'` on every request, so memorize and hybrid / vector
+  search returned 500. Existing environments built from `uv.lock` were never
+  affected.
+
+### Upgrade
+
+- `pip install --upgrade everos` brings `openai` back to 2.x. If a fresh
+  install of 1.4.0 (or any earlier version) today shows the `httpx` error
+  above, upgrade to 1.4.1 or run `pip install "openai<3"`.
+
 ## [1.4.0] - 2026-09-24
 
 **EverOS runs natively on Windows, and dense search stops scanning the whole
```

**File**: `docs/openapi.json` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@
   "info": {
     "title": "everos",
     "description": "md-first memory extraction framework",
-    "version": "1.4.0"
+    "version": "1.4.1"
   },
   "paths": {
     "/health": {
```

**File**: `pyproject.toml` (modified, +4/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "everos"
-version = "1.4.0"
+version = "1.4.1"
 description = "EverOS — local-first markdown memory framework for AI agents and user chats; lightweight, dev-friendly, small-team"
 license = {text = "Apache-2.0"}
 readme = "README.md"
@@ -45,7 +45,9 @@ dependencies = [
     "greenlet>=3.0",              # Required by SQLAlchemy async
 
     # LLM & embedding (one provider per file pattern)
-    "openai>=1.0.0",
+    # <3: openai 3.x (2026-09-24) moved to the httpx 1.0 pre-release line and its
+    # client raises AttributeError on every request; 2.x is what the lock tests.
+    "openai>=1.0.0,<3",
 
     # Markdown / file system
     "PyYAML>=6.0",                # YAML frontmatter parsing
```

**File**: `uv.lock` (modified, +2/-2)
```diff
@@ -579,7 +579,7 @@ wheels = [
 
 [[package]]
 name = "everos"
-version = "1.4.0"
+version = "1.4.1"
 source = { editable = "." }
 dependencies = [
     { name = "aiosqlite" },
@@ -664,7 +664,7 @@ requires-dist = [
     { name = "jieba", specifier = ">=0.42.1,<1.0" },
     { name = "lancedb", specifier = ">=0.34.0,<0.35.0" },
     { name = "msvc-runtime", marker = "sys_platform == 'win32'", specifier = ">=14.44" },
-    { name = "openai", specifier = ">=1.0.0" },
+    { name = "openai", specifier = ">=1.0.0,<3" },
     { name = "opentelemetry-exporter-otlp-proto-http", marker = "extra == 'otel'", specifier = ">=1.27.0" },
     { name = "opentelemetry-sdk", marker = "extra == 'otel'", specifier = ">=1.27.0" },
     { name = "portalocker", specifier = ">=2.8.2" },
```

---

### Incident Patch 3: `8bb5c323` (2026-09-24)
**Commit Message**: fix(lancedb): translate the spill failure on the write path too

Squash merge of PR #465.

**File**: `src/everos/core/persistence/lancedb/repository.py` (modified, +20/-3)
```diff
@@ -224,11 +224,12 @@ def _remove_empty_index_dirs(
 retry clears. ``LanceError(IO): Execution error: Spill has sent an error`` is
 DataFusion's sort / merge spill to the OS temp dir failing mid-query; lancedb
 raises it as a bare ``RuntimeError``. Seen only on the Windows soak box under
-nine concurrent clients (187 / 180 / 34 times over three runs), never on an
+nine concurrent clients (187 / 180 / 34 / 42 times over four runs), never on an
 idle box, and the same row projected fine on the next attempt — yet the worker
 filed every one as unrecoverable, so ~200 md files per run needed a manual
-``cascade fix``. Match the exact phrase: a generic IO error (disk full, file
-gone) must stay permanent."""
+``cascade fix``. The traceback frames put it in ``merge_insert`` (the write
+path, under :meth:`_locked`); the read path is covered as well. Match the
+exact phrase: a generic IO error (disk full, file gone) must stay permanent."""
 
 
 def _is_transient_execution_error(exc: BaseException) -> bool:
@@ -390,6 +391,22 @@ async def _locked(self, budget: float, op: str) -> AsyncIterator[None]:
                 f"{op} on table {self.table_name!r} exceeded its "
                 f"{budget:g}s write-lock deadline"
             ) from exc
+        except RuntimeError as exc:
+            # The soak's spill failures came out of ``merge_insert`` (this
+            # path), not the reads: worker -> upsert -> execute_merge_insert.
+            # The write is idempotent by id, so a retry is the right answer.
+            if not _is_transient_execution_error(exc):
+                raise
+            logger.warning(
+                "lancedb_transient_execution_error",
+                table=self.table_name,
+                op=op,
+                error=str(exc)[:200],
+            )
+            raise VectorStoreBusyError(
+                f"{op} on table {self.table_name!r} hit a transient lance "
+                f"execution error: {exc}"
+            ) from exc
         else:
             held = time.monotonic() - (acquired_at or started)
             if held >= _SLOW_HOLD_LOG_SECONDS:
```

**File**: `tests/unit/test_core/test_persistence/test_lancedb/test_transient_execution_errors.py` (modified, +7/-0)
```diff
@@ -41,6 +41,13 @@ async def test_spill_failure_inside_a_read_becomes_a_busy_error() -> None:
             raise RuntimeError(_SPILL)
 
 
+async def test_spill_failure_inside_a_write_becomes_a_busy_error() -> None:
+    """The soak's spill failures came out of merge_insert (the write path)."""
+    with pytest.raises(VectorStoreBusyError, match="transient lance execution"):
+        async with _Repo()._locked(1.0, "upsert"):
+            raise RuntimeError(_SPILL)
+
+
 async def test_other_runtime_errors_still_propagate_unchanged() -> None:
     with pytest.raises(RuntimeError, match="No space left"):
         async with _Repo()._deadline(1.0, "find_where"):
```

---

### Incident Patch 4: `4fd34722` (2026-09-24)
**Commit Message**: fix(lancedb): treat a lance spill failure as retryable

Squash merge of PR #463.

**File**: `src/everos/core/persistence/lancedb/repository.py` (modified, +30/-0)
```diff
@@ -208,6 +208,23 @@ def _remove_empty_index_dirs(
     return removed
 
 
+_TRANSIENT_EXECUTION_MARKERS = ("Spill has sent an error",)
+"""Substrings of lance error messages that name a query-execution failure a
+retry clears. ``LanceError(IO): Execution error: Spill has sent an error`` is
+DataFusion's sort / merge spill to the OS temp dir failing mid-query; lancedb
+raises it as a bare ``RuntimeError``. Seen only on the Windows soak box under
+nine concurrent clients (187 / 180 / 34 times over three runs), never on an
+idle box, and the same row projected fine on the next attempt — yet the worker
+filed every one as unrecoverable, so ~200 md files per run needed a manual
+``cascade fix``. Match the exact phrase: a generic IO error (disk full, file
+gone) must stay permanent."""
+
+
+def _is_transient_execution_error(exc: BaseException) -> bool:
+    text = str(exc)
+    return any(marker in text for marker in _TRANSIENT_EXECUTION_MARKERS)
+
+
 class LanceRepoBase[T: BaseLanceTable]:
     """Generic CRUD repository for one LanceDB table.
 
@@ -296,6 +313,19 @@ async def _deadline(self, budget: float, op: str) -> AsyncIterator[None]:
             raise VectorStoreBusyError(
                 f"{op} on table {self.table_name!r} exceeded its {budget:g}s deadline"
             ) from exc
+        except RuntimeError as exc:
+            if not _is_transient_execution_error(exc):
+                raise
+            logger.warning(
+                "lancedb_transient_execution_error",
+                table=self.table_name,
+                op=op,
+                error=str(exc)[:200],
+            )
+            raise VectorStoreBusyError(
+                f"{op} on table {self.table_name!r} hit a transient lance "
+                f"execution error: {exc}"
+            ) from exc
 
     @asynccontextmanager
     async def _locked(self, budget: float, op: str) -> AsyncIterator[None]:
```

**File**: `tests/unit/test_core/test_persistence/test_lancedb/test_transient_execution_errors.py` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+"""A lance query-execution failure that a retry clears must reach the cascade
+worker as :class:`VectorStoreBusyError` (retried with backoff), not as a bare
+``RuntimeError`` (filed as unrecoverable, needing a manual ``cascade fix``).
+"""
+
+from __future__ import annotations
+
+from typing import ClassVar
+
+import pytest
+
+from everos.core.errors import VectorStoreBusyError
+from everos.core.persistence.lancedb import BaseLanceTable, LanceRepoBase
+from everos.core.persistence.lancedb import repository as repo_mod
+
+_SPILL = (
+    "lance error: LanceError(IO): Execution error: Spill has sent an error, "
+    "C:\\Users\\x\\everos-src\\.venv\\Lib\\site-packages\\lance\\..."
+)
+
+
+class _Note(BaseLanceTable):
+    TABLE_NAME: ClassVar[str] = "_note"
+    id: str
+
+
+class _Repo(LanceRepoBase[_Note]):
+    schema = _Note
+
+
+def test_only_the_spill_phrase_counts_as_transient() -> None:
+    assert repo_mod._is_transient_execution_error(RuntimeError(_SPILL))
+    assert not repo_mod._is_transient_execution_error(
+        RuntimeError("lance error: LanceError(IO): No space left on device")
+    )
+
+
+async def test_spill_failure_inside_a_read_becomes_a_busy_error() -> None:
+    with pytest.raises(VectorStoreBusyError, match="transient lance execution"):
+        async with _Repo()._deadline(1.0, "find_where"):
+            raise RuntimeError(_SPILL)
+
+
+async def test_other_runtime_errors_still_propagate_unchanged() -> None:
+    with pytest.raises(RuntimeError, match="No space left"):
+        async with _Repo()._deadline(1.0, "find_where"):
+            raise RuntimeError("lance error: LanceError(IO): No space left on device")
```

---

### Incident Patch 5: `401fbf8e` (2026-09-24)
**Commit Message**: fix(knowledge): delete the document directory even before it is indexed

Squash merge of PR #456.

**File**: `src/everos/service/knowledge.py` (modified, +42/-4)
```diff
@@ -508,7 +508,9 @@ async def delete_document(
 ) -> DeleteResult:
     """Remove a document directory; cascade handles SQLite/LanceDB cleanup.
 
-    Idempotent: returns ``deleted_topics=0`` when the document does not exist.
+    Idempotent: returns ``deleted_topics=0`` when neither the index nor the
+    disk has the document, and also when the directory was removed before the
+    cascade had indexed its topics.
 
     Args:
         doc_id: Document primary key.
@@ -519,12 +521,28 @@ async def delete_document(
         DeleteResult with the topic count that was present before deletion.
     """
     row = await knowledge_document_repo.get_by_doc_id(doc_id)
+    memory_root = MemoryRoot.resolve()
     if row is None:
-        return DeleteResult(doc_id=doc_id, deleted_topics=0)
+        # The index trails the markdown by seconds, so a document created a
+        # moment ago has a directory but no row yet. Deleting by the index
+        # alone leaves that directory behind for the cascade to index right
+        # back in, and the "deleted" document reappears. Markdown is the
+        # truth: find the directory by its name and count the topic files
+        # it holds, so the response says what was actually removed.
+        topic_count = await anyio.to_thread.run_sync(
+            _remove_unindexed_doc_dirs,
+            memory_root.knowledge_dir(app_id, project_id),
+            doc_id,
+        )
+        logger.info(
+            "document deleted",
+            doc_id=doc_id,
+            topic_count=topic_count,
+            indexed=False,
+        )
+        return DeleteResult(doc_id=doc_id, deleted_topics=topic_count)
 
     topic_count = await knowledge_topic_sqlite_repo.count_by_doc_id(doc_id)
-
-    memory_root = MemoryRoot.resolve()
     doc_dir = memory_root.root / Path(row.md_path).parent
     if await anyio.Path(doc_dir).is_dir():
         await anyio.to_thread.run_sync(shutil.rmtree, doc_dir)
@@ -537,6 +555,26 @@ async def delete_document(
     return DeleteResult(doc_id=doc_id, deleted_topics=topic_count)
 
 
+def _remove_unindexed_doc_dirs(knowledge_dir: Path, doc_id: str) -> int:
+    """Remove every ``knowledge/<category>/<title>_<doc_id>/`` directory.
+
+    Returns the number of topic files (``N_*.md``) that were on disk. The
+    directory name is compared literally — ``delete_document`` is a public
+    service function, so a caller-supplied ``doc_id`` must not act as a glob
+    pattern or a path; only the HTTP route validates the id's shape.
+    """
+    if not knowledge_dir.is_dir():
+        return 0
+    suffix = f"_{doc_id}"
+    topics = 0
+    for doc_dir in knowledge_dir.glob("*/*"):
+        if not doc_dir.is_dir() or not doc_dir.name.endswith(suffix):
+            continue
+        topics += sum(1 for _ in doc_dir.glob("[0-9]*.md"))
+        shutil.rmtree(doc_dir)
+    return topics
+
+
 async def replace_document(
     *,
     extractor: KnowledgeExtractor,
```

**File**: `tests/unit/test_service/test_knowledge_crud.py` (modified, +56/-1)
```diff
@@ -220,8 +220,11 @@ async def test_delete_document_success(tmp_path: Path) -> None:
     mock_anyio.to_thread.run_sync.assert_awaited_once()
 
 
-async def test_delete_document_idempotent() -> None:
+async def test_delete_document_idempotent(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
     """Returns deleted_topics=0 without error when document does not exist."""
+    monkeypatch.setenv("EVEROS_ROOT", str(tmp_path))
     with patch(f"{_MOD}.knowledge_document_repo") as mock_doc_repo:
         mock_doc_repo.get_by_doc_id = AsyncMock(return_value=None)
 
@@ -232,6 +235,58 @@ async def test_delete_document_idempotent() -> None:
     assert result.deleted_topics == 0
 
 
+async def test_delete_document_removes_dir_before_the_index_has_the_row(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    """A document created a moment ago has a directory but no SQLite row yet
+    (the cascade trails the markdown by seconds). Delete must still remove the
+    directory — and only that directory — and report the topic files it held.
+    """
+    monkeypatch.setenv("EVEROS_ROOT", str(tmp_path))
+    kdir = tmp_path / "app1" / "proj1" / "knowledge"
+    doc_dir = kdir / "Technology" / "Release_checklist_d_lagging00001"
+    doc_dir.mkdir(parents=True)
+    (doc_dir / "index.md").write_text("---\ndoc_id: d_lagging00001\n---\n")
+    (doc_dir / "1_before.md").write_text("# before\n")
+    (doc_dir / "2_after.md").write_text("# after\n")
+    sibling = kdir / "Technology" / "Other_notes_d_sibling000001"
+    sibling.mkdir()
+    (sibling / "index.md").write_text("---\ndoc_id: d_sibling000001\n---\n")
+    (kdir / ".taxonomy.md").write_text("# taxonomy\n")
+
+    with patch(f"{_MOD}.knowledge_document_repo") as mock_doc_repo:
+        mock_doc_repo.get_by_doc_id = AsyncMock(return_value=None)
+        result = await delete_document("d_lagging00001", "app1", "proj1")
+
+    assert result.deleted_topics == 2
+    assert not doc_dir.exists()
+    assert sibling.is_dir()
+    assert (kdir / ".taxonomy.md").exists()
+
+
+@pytest.mark.parametrize("doc_id", ["d_absent0000001", "*", "*/_original"])
+async def test_delete_document_unindexed_id_not_on_disk_removes_nothing(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, doc_id: str
+) -> None:
+    """No row and no directory for the id → nothing is touched, including
+    when the id looks like a glob pattern or a path: the name match is literal.
+    """
+    monkeypatch.setenv("EVEROS_ROOT", str(tmp_path))
+    kdir = tmp_path / "app1" / "proj1" / "knowledge"
+    sibling = kdir / "Technology" / "Other_notes_d_sibling000001"
+    sibling.mkdir(parents=True)
+    (sibling / "index.md").write_text("---\ndoc_id: d_sibling000001\n---\n")
+    (sibling / "_original").mkdir()
+
+    with patch(f"{_MOD}.knowledge_document_repo") as mock_doc_repo:
+        mock_doc_repo.get_by_doc_id = AsyncMock(return_value=None)
+        result = await delete_document(doc_id, "app1", "proj1")
+
+    assert result.deleted_topics == 0
+    assert (sibling / "index.md").exists()
+    assert (sibling / "_original").is_dir()
+
+
 # ── list_documents ────────────────────────────────────────────────────────────
 
 
```

---

### Incident Patch 6: `243bdddb` (2026-09-24)
**Commit Message**: fix(cli): refuse cascade sync while a server holds the memory root

Squash merge of PR #458.

**File**: `docs/cascade_runbook.md` (modified, +28/-17)
```diff
@@ -109,9 +109,10 @@ naturally.
 
 ## One-shot replay: `everos cascade sync [PATH]`
 
-Use this when the watcher missed an event (WSL mount, network share,
-external editor with no inotify) or when you want a deterministic
-flush before, say, a smoke test:
+Use this when no server is running and you want the index caught up
+with the markdown — after batch edits, before a smoke test, or on a
+mount where the watcher misses events (WSL mount, network share,
+external editor with no inotify) while the daemon is down:
 
 ```bash
 everos cascade sync                           # drain everything pending
@@ -120,10 +121,16 @@ everos cascade sync users/u1/episodes/X.md    # re-enqueue + drain
 
 The CLI builds the same `CascadeOrchestrator` as the daemon but only
 calls `sync_once` / `drain_once` — no watcher / scanner background task.
-Its drain still runs the same compaction + version-cleanup (`prune`) as
-the daemon, but `prune` uses `delete_unverified=False`, so it never
-deletes a file another process may be mid-commit on. Safe to run in
-parallel with a live `everos server`.
+It holds the OME lock for the whole run and **refuses to start (exit code
+3) while a server holds it**: two processes writing the same LanceDB
+tables cannot see each other's snapshot and both insert the row (4–5 %
+duplicate rows after a 10-hour soak with two concurrent `sync` processes
+next to a server). The same rule applies to `cascade fix --apply` and
+`cascade rebuild`; `cascade status` and `cascade fix` (listing) are
+read-only and work alongside a server. A running server projects every
+markdown change itself, so nothing is lost by waiting for it — unless it
+was started with `EVEROS_DISABLE_CASCADE=1` or has been quiesced, in
+which case stop it before syncing.
 
 ## Rebuild the index: `everos cascade rebuild`
 
@@ -135,12 +142,12 @@ everos cascade rebuild          # prompts for confirmation
 everos cascade rebuild --yes    # non-interactive
 ```
 
-> **Stop the `everos server` first.** Unlike `cascade sync`, rebuild
-> **drops and recreates** the active backend's tables or collections. A running
-> daemon holds
-> cached table handles that would keep pointing at (and writing to) the
-> dropped dataset, corrupting the rebuild. This is the one cascade
-> command that is **not** safe to run alongside a live server.
+> **Stop the `everos server` first.** Like every index-writing cascade
+> command, rebuild refuses to run while a server holds the memory root
+> (exit code 3) — and it has the strongest reason: it **drops and
+> recreates** the active backend's tables or collections. A running daemon
+> holds cached table handles that would keep pointing at (and writing to)
+> the dropped dataset, corrupting the rebuild.
 
 What it does, in order:
 
@@ -231,7 +238,10 @@ Workarounds:
 - Rely on the scanner — at default 30 s interval, throughput is
   bounded but eventually-consistent.
 - Drop the scan interval to ~5 s if the memory root is small.
-- Run `everos cascade sync` explicitly after batch edits.
+- With no server running, run `everos cascade sync` explicitly after batch
+  edits. A running server picks them up itself, and `sync` refuses to run
+  next to it (exit code 3): two processes writing the same index insert
+  rows twice.
 
 ### Daemon process crash mid-batch
 
@@ -373,6 +383,7 @@ is a deployment-side change with no schema work.
   in the entry inline. Tracked separately.
 - **Reference-file change detection (agent_skill)**: edits to
   `references/*.md` siblings won't trigger a re-index — only changes
-  to `SKILL.md` itself fire the watcher. Workaround: run
-  `everos cascade sync agents/<a>/skills/skill_<n>/SKILL.md` after
-  editing references.
+  to `SKILL.md` itself fire the watcher. Workaround: touch or re-save
+  `SKILL.md` so the watcher fires; with the server stopped,
+  `everos cascade sync agents/<a>/skills/skill_<n>/SKILL.md` re-enqueues
+  it directly.
```

**File**: `docs/how-memory-works.md` (modified, +2/-2)
```diff
@@ -263,8 +263,8 @@ Two paths, two guarantees:
 
 So a `/search` immediately after the `/flush` that produced a record may
 miss it. The markdown is durable regardless; index lag never loses data. If
-you need read-your-write, retry with backoff, or force the queue with
-`everos cascade sync`.
+you need read-your-write, retry with backoff (the running server is the
+only index writer; `everos cascade sync` is for when no server is running).
 
 Integrity is anchored by a few invariants (details in
 [storage_layout.md](storage_layout.md)): the frontmatter `id` /
```

**File**: `src/everos/entrypoints/cli/commands/cascade.py` (modified, +58/-21)
```diff
@@ -5,7 +5,7 @@
 
 - ``cascade sync [PATH]`` — flush the work queue. With ``PATH`` the
   command first force-enqueues that single file (used after a manual
-  md edit when waiting for the watcher is impractical), then drains.
+  md edit with no server running), then drains.
 - ``cascade status`` — print the queue + LSN summary that the daemon
   sees right now.
 - ``cascade fix`` — list every ``failed`` row. With ``--apply``, also
@@ -30,6 +30,7 @@
 from __future__ import annotations
 
 import asyncio
+import contextlib
 import enum
 import os
 from collections.abc import AsyncIterator
@@ -47,6 +48,7 @@
 from everos.core.persistence import MemoryRoot
 from everos.entrypoints.cli._log_setup import configure_cli_logging
 from everos.entrypoints.cli.commands._backfill_cmd import run_backfill
+from everos.infra.ome.exceptions import EngineLockHeldError
 from everos.infra.persistence.index import (
     connect,
     drop_business_tables,
@@ -61,6 +63,7 @@
 )
 from everos.memory.cascade import (
     CascadeOrchestrator,
+    hold_ome_lock,
     match_kind,
     ome_lock_is_free,
 )
@@ -136,15 +139,21 @@ def _apply_verbose_logging(verbose: bool | None) -> None:
 
 
 @asynccontextmanager
-async def _runtime(*, verify: bool = True, ensure: bool = True) -> AsyncIterator[None]:
+async def _runtime(
+    *, verify: bool = True, ensure: bool = True, exclusive: bool = False
+) -> AsyncIterator[None]:
     """Stand up sqlite + lancedb the same way the API lifespan would.
 
     The CLI uses the same lazy, process-wide singletons the API lifespan
     does. They are **per-process**: a running daemon has its own
-    connection and table-handle cache, so read/write traffic interleaves
-    safely, but a change to the table *set* made here (drop / recreate)
-    is invisible to the daemon's cached handles — which is why
-    ``rebuild`` refuses to run while a server holds the OME lock.
+    connection and table-handle cache, and reads its own LanceDB
+    snapshot. Reads interleave safely; writes do not — a second process
+    upserting the same table cannot see what the daemon just committed
+    (nor the other way round) and both insert the row, so every command
+    that writes the index (``sync``, ``fix --apply``, ``rebuild``) passes
+    ``exclusive=True`` and holds the OME lock for its whole run. Refused
+    with exit code 3 while a server (or another exclusive CLI phase) holds
+    it; a server starting meanwhile fails at its own lock instead.
 
     ``verify=False`` skips :func:`verify_business_schemas` — required by
     ``cascade rebuild``, whose whole purpose is to recover from a table
@@ -159,19 +168,39 @@ async def _runtime(*, verify: bool = True, ensure: bool = True) -> AsyncIterator
     Rebuild recreates the tables and their indexes itself after dropping,
     so skipping the pre-drop pass loses nothing.
     """
-    engine = get_engine()
-    async with engine.begin() as conn:
-        await conn.run_sync(SQLModel.metadata.create_all)
-    await connect()
-    if verify:
-        await verify_business_schemas()
-    if ensure:
-        await ensure_business_indexes()
+    lock = hold_ome_lock() if exclusive else contextlib.nullcontext()
     try:
-        yield
+        lock.__enter__()
+    except EngineLockHeldError:
+        typer.echo(
+            "error: another process holds this memory root's OME lock — a "
+            "running `everos server`\n"
+            "  (or another exclusive CLI phase). Two processes writing the "
+            "same index insert rows\n"
+            "  twice, so this command needs the root to itself. A server "
+            "projects markdown changes\n"
+            "  on its own unless it was started with EVEROS_DISABLE_CASCADE=1 "
+            "or quiesced; stop it\n"
+            "  first, then re-run.",
+            err=True,
+        )
+        raise typer.Exit(code=3) from None
+    try:
+        engine = get_engine()
+        async with engine.begin() as conn:
+            await co
```

**File**: `src/everos/memory/cascade/__init__.py` (modified, +2/-0)
```diff
@@ -21,6 +21,7 @@
 from ._backfill import BackfillPhase as BackfillPhase
 from ._backfill import BackfillPresenter as BackfillPresenter
 from ._backfill import NullBackfillPresenter as NullBackfillPresenter
+from ._backfill import hold_ome_lock as hold_ome_lock
 from ._backfill import ome_lock_is_free as ome_lock_is_free
 from .orchestrator import CascadeConfig as CascadeConfig
 from .orchestrator import CascadeHealth as CascadeHealth
@@ -38,6 +39,7 @@
     "CascadeOrchestrator",
     "KindSpec",
     "NullBackfillPresenter",
+    "hold_ome_lock",
     "match_kind",
     "ome_lock_is_free",
 ]
```

**File**: `src/everos/memory/cascade/_backfill.py` (modified, +28/-1)
```diff
@@ -25,9 +25,10 @@
 from __future__ import annotations
 
 import asyncio
+import contextlib
 import dataclasses
 import datetime as dt
-from collections.abc import Callable
+from collections.abc import Callable, Iterator
 from pathlib import Path
 from typing import Any, Protocol
 from uuid import uuid4
@@ -1095,6 +1096,32 @@ def _probe_ome_lock_available() -> bool:
         handle.close()
 
 
+@contextlib.contextmanager
+def hold_ome_lock() -> Iterator[None]:
+    """Hold the OME jobstore lock for the duration of a CLI write phase.
+
+    Same file and flags as :meth:`OfflineEngine._acquire_lock`, so a server
+    that starts meanwhile fails at startup with :class:`EngineLockHeldError`
+    instead of becoming a second index writer. Raises
+    :class:`EngineLockHeldError` when another process already holds it.
+    """
+    root = MemoryRoot.resolve()
+    lock_path = Path(str(root.ome_db) + ".lock")
+    lock_path.parent.mkdir(parents=True, exist_ok=True)
+    handle = open(lock_path, "a+")  # noqa: SIM115
+    try:
+        try:
+            portalocker.lock(handle, portalocker.LOCK_EX | portalocker.LOCK_NB)
+        except portalocker.LockException as exc:
+            raise EngineLockHeldError(f"another process holds {lock_path}") from exc
+        try:
+            yield
+        finally:
+            portalocker.unlock(handle)
+    finally:
+        handle.close()
+
+
 def _build_cluster_engine() -> OfflineEngine:
     """Construct (but do not start) the throw-away OME engine Phase 2 drives.
 
```

---

### Incident Patch 7: `732e0f4c` (2026-09-24)
**Commit Message**: fix(cascade): commit watcher upserts for a path in delivery order (#462)

Each watcher event schedules its own upsert coroutine on the loop, and each
upsert awaits the database, so two events for the same path could commit in
either order and the last committer won. Windows synthesises a 'created' for
every file under a freshly created parent directory, which hands the handler
the same file four or five times; on the Windows soak box one of those stale
duplicates committed after an atomic save's 'added' and put the first write's
mtime and lsn back on the row (test_atomic_replace_over_existing_target_keeps
_the_row_alive failed 1 run in 4, only there).

Serialise the upserts behind one asyncio.Lock per handler; tasks are created
in delivery order and the lock is FIFO, so the row ends with the last event.
The scanner's sweep still writes on its own path.

Verification: the new test fails against the previous watcher with
committed == [m2, m1]; passes with the lock. The six existing watcher tests
pass; lint-imports 4/4.

Co-authored-by: zhanghui <zhanghui@shanda.com>
Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>
Co-authored-by: KT <74288668+0xKT@users.noreply.github.com>

**File**: `src/everos/memory/cascade/watcher.py` (modified, +14/-1)
```diff
@@ -14,6 +14,7 @@
 from __future__ import annotations
 
 import asyncio
+from collections.abc import Awaitable
 from pathlib import Path
 
 from watchdog.events import FileMovedEvent, FileSystemEvent, FileSystemEventHandler
@@ -78,6 +79,14 @@ def __init__(
     ) -> None:
         self._memory_root = memory_root
         self._loop = loop
+        # Upserts for one path must commit in delivery order. Each one awaits
+        # the database, so left concurrent the last committer wins and a stale
+        # duplicate overwrites a newer row. Windows synthesises a ``created``
+        # for every file under a freshly created parent directory, handing the
+        # same file to this handler four or five times; on the soak box one of
+        # those duplicates landed after an atomic save's ``added`` and put the
+        # first write's mtime back on the row (1 run in 4).
+        self._in_order = asyncio.Lock()
 
     def on_created(self, event: FileSystemEvent) -> None:
         self._enqueue(event.src_path, "added")
@@ -124,10 +133,14 @@ def _enqueue(self, raw_path: str, change_type: str) -> None:
             return
         mtime = _safe_mtime(raw_path)
         asyncio.run_coroutine_threadsafe(
-            _enqueue_async(spec, rel, change_type, mtime),
+            self._serialised(_enqueue_async(spec, rel, change_type, mtime)),
             self._loop,
         )
 
+    async def _serialised(self, upsert: Awaitable[None]) -> None:
+        async with self._in_order:
+            await upsert
+
 
 async def _enqueue_async(
     spec: KindSpec, rel: str, change_type: str, mtime: float
```

**File**: `tests/unit/test_memory/test_cascade/test_watcher_upsert_order.py` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+"""Upserts for one path commit in delivery order.
+
+Windows synthesises a ``created`` for every file under a freshly created
+parent directory, so one ``mkdir -p`` + write hands the handler the same path
+four or five times. Each upsert awaits the database; run concurrently, the
+last committer wins, and on the Windows soak box a stale duplicate carrying
+the first write's mtime overwrote the row of an atomic save (1 run in 4).
+"""
+
+from __future__ import annotations
+
+import asyncio
+import os
+from pathlib import Path
+
+import pytest
+from watchdog.events import FileCreatedEvent
+
+from everos.core.persistence import MemoryRoot
+from everos.memory.cascade import watcher as watcher_mod
+from everos.memory.cascade.watcher import _Handler
+
+_M1 = 1_700_000_000
+_M2 = 1_700_000_060
+
+
+class _SlowFirstRepo:
+    """The first upsert commits 50 ms late; the row is whatever committed last."""
+
+    def __init__(self) -> None:
+        self.calls = 0
+        self.committed: list[float] = []
+
+    async def upsert(
+        self, md_path: str, *, kind: str, change_type: str, mtime: float
+    ) -> int:
+        self.calls += 1
+        if self.calls == 1:
+            await asyncio.sleep(0.05)
+        self.committed.append(mtime)
+        return self.calls
+
+
+async def test_duplicate_events_commit_in_delivery_order(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    repo = _SlowFirstRepo()
+    monkeypatch.setattr(watcher_mod, "md_change_state_repo", repo)
+    md = tmp_path.joinpath(
+        "default_app",
+        "default_project",
+        "users",
+        "u1",
+        "episodes",
+        "episode-2026-01-01.md",
+    )
+    md.parent.mkdir(parents=True)
+    md.write_text("v1", encoding="utf-8")
+    handler = _Handler(MemoryRoot(tmp_path), asyncio.get_running_loop())
+
+    os.utime(md, (_M1, _M1))
+    handler.on_created(FileCreatedEvent(str(md)))  # the synthetic duplicate
+    os.utime(md, (_M2, _M2))
+    handler.on_created(FileCreatedEvent(str(md)))  # the save that must win
+    await asyncio.sleep(0.2)
+
+    assert repo.committed == [_M1, _M2], (
+        "the stale duplicate committed after the newer event; the row now "
+        "carries the old mtime"
+    )
```

---

### Incident Patch 8: `5076683a` (2026-09-08)
**Commit Message**: fix(rerank): back off between retries instead of spinning (#441)

All three rerank providers retried 429 and 5xx responses with a bare
`continue`, so the entire retry budget was spent within milliseconds of
the first rejection. That is useless against a per-minute quota, which
is exactly what hosted rerank endpoints enforce: the caller burns three
attempts and still fails, while the window it needed to wait out had
barely started.

Observed while driving the LoCoMo agentic suite against a hosted rerank
endpoint — search requests failed outright with RerankServiceError while
the endpoint itself was healthy and merely pacing us.

Adds `_errors.backoff_sleep()` (exponential with full jitter, capped at
8s) and wires it into the vLLM, DeepInfra and DashScope retry loops. The
jitter keeps a batch of concurrent searches from re-colliding after they
trip the limit together. No behaviour change when the endpoint is
healthy: the sleep only runs on a retryable failure that will be retried.

Co-authored-by: zhanghui <zhanghui@shanda.com>
Co-authored-by: Claude Opus 5 (1M context) <noreply@anthropic.com>

**File**: `src/everos/component/rerank/_errors.py` (modified, +24/-1)
```diff
@@ -1,7 +1,10 @@
-"""Shared error construction for HTTP-based rerank providers."""
+"""Shared error construction and retry pacing for HTTP rerank providers."""
 
 from __future__ import annotations
 
+import asyncio
+import random
+
 import httpx
 
 from everos.core.observability.logging import get_logger
@@ -10,6 +13,26 @@
 
 logger = get_logger(__name__)
 
+_BACKOFF_BASE_SECONDS = 0.5
+_BACKOFF_CAP_SECONDS = 8.0
+
+
+async def backoff_sleep(attempt: int) -> None:
+    """Wait before the next retry of a 429 / 5xx rerank request.
+
+    Retrying with no delay is useless against a *per-minute* quota — the
+    whole budget burns in milliseconds and the caller still fails. Hosted
+    rerank routers enforce exactly that kind of quota, so the retry loop
+    has to actually wait. Exponential with full jitter, capped, to avoid a
+    thundering herd when a batch of concurrent searches trips the limit
+    together.
+
+    Args:
+        attempt: Zero-based index of the attempt that just failed.
+    """
+    delay = min(_BACKOFF_BASE_SECONDS * (2**attempt), _BACKOFF_CAP_SECONDS)
+    await asyncio.sleep(random.uniform(0, delay))
+
 
 def upstream_http_error(provider: str, response: httpx.Response) -> RerankServiceError:
     """Log the upstream response body and return a client-safe error.
```

**File**: `src/everos/component/rerank/dashscope_provider.py` (modified, +2/-0)
```diff
@@ -47,6 +47,7 @@
 
 import httpx
 
+from ._errors import backoff_sleep
 from .protocol import RerankError, RerankResult
 
 
@@ -160,6 +161,7 @@ async def _score_chunk(
                             f"DashScope rerank HTTP {response.status_code}: "
                             f"{response.text[:200]}"
                         )
+                    await backoff_sleep(attempt)
                     continue
                 raise RerankError(
                     f"DashScope rerank HTTP {response.status_code}: "
```

**File**: `src/everos/component/rerank/deepinfra_provider.py` (modified, +7/-1)
```diff
@@ -35,7 +35,12 @@
 
 import httpx
 
-from ._errors import retries_exhausted_error, transport_error, upstream_http_error
+from ._errors import (
+    backoff_sleep,
+    retries_exhausted_error,
+    transport_error,
+    upstream_http_error,
+)
 from .protocol import RerankResult, RerankServiceError
 
 # Qwen3-Reranker chat template. The DeepInfra inference API treats the reranker
@@ -160,6 +165,7 @@ async def _score_chunk(
                 if response.status_code >= 500 or response.status_code == 429:
                     if attempt == self._max_retries:
                         raise upstream_http_error("DeepInfra", response)
+                    await backoff_sleep(attempt)
                     continue
                 raise upstream_http_error("DeepInfra", response)
 
```

**File**: `src/everos/component/rerank/vllm_provider.py` (modified, +7/-1)
```diff
@@ -41,7 +41,12 @@
 
 import httpx
 
-from ._errors import retries_exhausted_error, transport_error, upstream_http_error
+from ._errors import (
+    backoff_sleep,
+    retries_exhausted_error,
+    transport_error,
+    upstream_http_error,
+)
 from .protocol import RerankResult, RerankServiceError
 
 
@@ -143,6 +148,7 @@ async def _score_chunk(
                 if response.status_code >= 500 or response.status_code == 429:
                     if attempt == self._max_retries:
                         raise upstream_http_error("vLLM", response)
+                    await backoff_sleep(attempt)
                     continue
                 raise upstream_http_error("vLLM", response)
 
```

**File**: `tests/unit/test_component/test_rerank/test_vllm_provider.py` (modified, +32/-0)
```diff
@@ -185,3 +185,35 @@ def handler(_req: httpx.Request) -> httpx.Response:
     p = VllmRerankProvider(model="m", api_key="", base_url="http://x/v1")
     with pytest.raises(RerankServiceError, match="malformed rerank result"):
         await p.rerank("q", ["a"])
+
+
+async def test_429_retry_waits_between_attempts(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    """A per-minute quota is not survivable by spinning — retries must sleep."""
+    import everos.component.rerank._errors as errmod
+
+    slept: list[float] = []
+
+    async def fake_sleep(seconds: float) -> None:
+        slept.append(seconds)
+
+    monkeypatch.setattr(errmod.asyncio, "sleep", fake_sleep)
+
+    attempts = 0
+
+    def handler(_req: httpx.Request) -> httpx.Response:
+        nonlocal attempts
+        attempts += 1
+        if attempts <= 2:
+            return httpx.Response(429, json={"error": "rate limited"})
+        return _ok_response([{"index": 0, "relevance_score": 0.7}])
+
+    _patch_httpx(monkeypatch, handler)
+    p = VllmRerankProvider(model="m", api_key="k", base_url="http://x/v1")
+    out = await p.rerank("q", ["d"])
+    assert [r.score for r in out] == [0.7]
+    assert attempts == 3
+    # One wait per failed attempt, and each wait is a real (non-zero) budget.
+    assert len(slept) == 2
+    assert all(s >= 0 for s in slept)
```

---

### Incident Patch 9: `2ec82d3a` (2026-09-08)
**Commit Message**: fix(config): move the multimodal default off a preview model (#442)

`google/gemini-3-flash-preview` is a preview listing, so it can be
withdrawn from the router without notice and take every default-config
multimodal install down with it. `google/gemini-3.8-flash` is the
generally available line.

Verified against OpenRouter that the new default still accepts the
`image_url` content parts the parser sends (data-URI PNG round-trip,
correct answer returned).

Updates every place the id is spelled out, not just the shipped default:
default.toml, MultimodalSettings, both READMEs, docs/configuration.md,
docs/multimodal.md, .env.example and templates/env.template.

Co-authored-by: zhanghui <zhanghui@shanda.com>
Co-authored-by: Claude Opus 5 (1M context) <noreply@anthropic.com>

**File**: `.env.example` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ EVEROS_LLM__BASE_URL=https://openrouter.ai/api/v1
 # audio / ...); must support OpenAI image_url parts. Defaults target
 # Gemini via OpenRouter so the same key covers chat + multimodal.
 
-EVEROS_MULTIMODAL__MODEL=google/gemini-3-flash-preview
+EVEROS_MULTIMODAL__MODEL=google/gemini-3.8-flash
 EVEROS_MULTIMODAL__API_KEY=
 EVEROS_MULTIMODAL__BASE_URL=https://openrouter.ai/api/v1
 # Concurrency cap for parallel multimodal calls (default 4):
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -273,7 +273,7 @@ uv pip install 'everos[multimodal]'   # or: pip install 'everos[multimodal]'
 
 This pulls in `everalgo-parser` (with the `[svg]` bundle for SVG support via
 cairosvg). Configure the `[multimodal]` section in `everos.toml`; its default
-model is `google/gemini-3-flash-preview` via OpenRouter.
+model is `google/gemini-3.8-flash` via OpenRouter.
 
 **Office document support requires LibreOffice as a system dependency.**
 The parser shells out to `soffice` (LibreOffice's headless renderer) to
```

**File**: `README.zh-CN.md` (modified, +1/-1)
```diff
@@ -275,7 +275,7 @@ uv pip install 'everos[multimodal]'   # or: pip install 'everos[multimodal]'
 
 这会引入 `everalgo-parser`（包含用于 SVG 支持的 `[svg]` bundle，通过
 cairosvg）。在 `everos.toml` 的 `[multimodal]` 中完成配置；默认模型是通过
-OpenRouter 使用的 `google/gemini-3-flash-preview`。
+OpenRouter 使用的 `google/gemini-3.8-flash`。
 
 **Office 文档支持需要 LibreOffice 作为系统依赖。** parser 会调用
 `soffice`（LibreOffice 的 headless renderer），先把 `.doc` / `.docx` /
```

**File**: `docs/configuration.md` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ Zilliz Cloud endpoint; a Milvus Lite filesystem path is rejected.
 
 | Field | Type | Default | Required | Description |
 |---|---|---|---|---|
-| `model` | string | `"google/gemini-3-flash-preview"` | No | Multimodal parsing model. |
+| `model` | string | `"google/gemini-3.8-flash"` | No | Multimodal parsing model. |
 | `api_key` | string | — | **Yes** | API key. |
 | `base_url` | string | — | No | Custom endpoint URL. |
 | `max_concurrency` | int | `4` | No | Max parallel parsing requests. |
```

**File**: `docs/multimodal.md` (modified, +2/-2)
```diff
@@ -97,7 +97,7 @@ parts. Fill in three fields in `everos.toml`:
 
 ```toml
 [multimodal]
-model    = "google/gemini-3-flash-preview"   # must support image_url parts
+model    = "google/gemini-3.8-flash"   # must support image_url parts
 base_url = "https://openrouter.ai/api/v1"
 api_key  = "<your key>"
 ```
@@ -270,7 +270,7 @@ containers and CI).
 
 | Field | Default | Meaning |
 |---|---|---|
-| `model` | `google/gemini-3-flash-preview` | Parsing model; must accept `image_url` parts |
+| `model` | `google/gemini-3.8-flash` | Parsing model; must accept `image_url` parts |
 | `base_url` | `https://openrouter.ai/api/v1` | OpenAI-compatible base URL |
 | `api_key` | — (required) | API key for the endpoint above |
 | `max_concurrency` | `4` | Cap on parallel multimodal calls within one extraction |
```

---

### Incident Patch 10: `71af620a` (2026-09-03)
**Commit Message**: Fix typos in README.md for EverOS

**File**: `README.md` (modified, +2/-2)
```diff
@@ -21,7 +21,7 @@
 
 <br>
 
-- [Why Ever OS](#why-ever-os)
+- [Why EverOS](#why-ever-os)
 - [Ecosystem Integrations](#ecosystem-integrations)
 - [Quick Start](#quick-start)
 - [Use Cases](#use-cases)
@@ -34,7 +34,7 @@
 </details>
 
 
-## Why Ever OS
+## Why EverOS
 
 EverOS is a Python library and local-first memory runtime for agents and
 makers. It gives one portable memory layer across coding assistants, apps,
```

#### Recent Merged Pull Requests:
- **PR #469** (2026-09-30): fix(knowledge): keep PATCH category moves inside knowledge/ (@dani1005)
- **PR #468** (2026-09-24): fix(deps): pin openai below 3 so a fresh install can call the LLM (@gloryfromca)
- **PR #467** (2026-09-24): chore(release): v1.4.0 (@gloryfromca)
- **PR #466** (2026-09-24): chore(release): v1.4.0rc2 (@gloryfromca)
- **PR #465** (2026-09-24): fix(lancedb): translate the spill failure on the write path too (@gloryfromca)
- **PR #464** (2026-09-24): chore(release): v1.4.0rc1 (@gloryfromca)
- **PR #463** (2026-09-24): fix(lancedb): treat a lance spill failure as retryable (@gloryfromca)
- **PR #462** (2026-09-24): fix(cascade): commit watcher upserts for a path in delivery order (@gloryfromca)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
