# Forensic Learning Record (Deep Inspection): FlowElement-xinliuyuansu/m_flow

> **Canonical Artifact**: `07_PROJECT_LEARNING/flowelement-xinliuyuansu-m_flow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/FlowElement-xinliuyuansu/m_flow](https://github.com/FlowElement-xinliuyuansu/m_flow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:58:19.658Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FlowElement-xinliuyuansu/m_flow`
- **Description**: A bio-inspired cognitive memory engine — a new paradigm for Graph RAG.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 4511 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `alembic/env.py`
```
"""M-Flow Alembic environment — async-first migration runner."""

from __future__ import annotations

import asyncio
import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from m_flow.adapters.relational import Base, get_db_adapter

_log = logging.getLogger("alembic.env")


def _bootstrap() -> None:
    """Resolve DSN, configure Alembic, and dispatch migrations."""
    cfg = context.config
    if cfg.config_file_name:
        fileConfig(cfg.config_file_name)

    db = get_db_adapter()
    _log.info("Database: %s", db.db_uri)
    cfg.set_section_option(cfg.config_ini_section, "SQLALCHEMY_DATABASE_URI", db.db_uri)

    meta = Base.metadata

    if context.is_offline_mode():
        _log.info("Offline mode — emitting SQL to stdout")
        context.configure(
            url=cfg.get_main_option("sqlalchemy.url"),
            target_metadata=meta,
            literal_binds=True,
            dialect_opts={"paramstyle": "named"},
        )
        with context.begin_transaction():
            context.run_migrations()
    else:
        asyncio.run(_run_online(cfg, meta))


async def _run_online(cfg, meta) -> None:
    engine = async_engine_from_config(
        cfg.get_section(cfg.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with engine.connect() as conn:
        await conn.run_sync(
            lambda c: _apply(c, meta),
        )
    await engine.dispose()


def _apply(conn, meta) -> None:
    context.configure(connection=conn, target_metadata=meta)
    with context.begin_transaction():
        context.run_migrations()


_bootstrap()

```

### Core Architecture Module: `alembic/versions/92b3293baa66_mflow_initial_schema.py`
```
"""
M-Flow 0.3 — single bootstrap migration.

The relational schema is owned by SQLAlchemy ORM models and materialised
via ``Base.metadata.create_all`` on first startup.  This stub exists
solely to anchor the Alembic revision graph so that future incremental
migrations can reference a ``down_revision``.

Revision ID: 92b3293baa66
Revises: —
Create Date: 2026-04-02
"""

from __future__ import annotations

from typing import Sequence, Union

revision: str = "92b3293baa66"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No-op: schema is created by the application on startup."""


def downgrade() -> None:
    """No-op: full teardown is not supported via migration."""

```

### Core Architecture Module: `coreference/coreference_module/__init__.py`
```
"""
Chinese Coreference Resolution Module v3.0

Core Features:
1. Chinese word segmentation & entity recognition (person names, titles, locations, places, objects, time)
2. Coreference resolution (replacing pronouns with concrete entities)
3. Time normalization (converting relative time to absolute time ranges)
4. Entity canonicalization (mapping aliases to canonical names)

Architecture:
    Input text -> jieba segmentation -> rule correction -> HMM POS tagging -> entity classification -> coreference resolution -> output

Usage:

1. Quick usage (coreference resolution):
    from coreference_module import resolve

    text = "小明去北京。他在那里工作。"
    result = resolve(text)
    print(result)  # "小明去北京。小明在北京工作。"

2. Detailed usage (with replacement records):
    from coreference_module import CoreferenceResolver

    resolver = CoreferenceResolver()
    resolved, replacements = resolver.resolve_text("小明去北京。他在那里工作。")
    print(resolved)
    print(replacements)
    resolver.reset()

3. Structured output (for Memory Engine):
    from coreference_module import CoreferenceResolver

    resolver = CoreferenceResolver()
    output = resolver.resolve_text_structured("去年我去了北京。那时候天气很好。")
    print(output.resolved_text)    # resolved text
    print(output.mentions)         # entity mention list (with positions)
    print(output.time_extractions) # time normalization results

4. Time normalization:
    from coreference_module import normalize_time
    from datetime import datetime

    result = normalize_time("昨天", datetime(2026, 1, 12))
    print(result.start_dt, result.end_dt, result.precision)

5. Entity extraction:
    from coreference_module import NERService, extract_mentions

    # Method 1: Service class
    service = NERService()
    mentions = service.extract_mentions("小明在学校读书")

    # Method 2: Convenience function
    mentions = extract_mentions("小明在学校读书")

6. Entity canonicalization:
    from coreference_module import create_canonicalizer

    alias_map = {'PER_NAME': {'小张': '张三'}}
    canonicalizer = create_canonicalizer(alias_map)
    result = canonicalizer.canonicalize('小张', 'PER_NAME')
    print(result.canonical_text)  # 张三
"""

# === Tokenizer ===
from .tokenizer import (
    ChineseTokenizer,
    Token,
    Mention,
)

# === Coreference Resolver ===
from .coreference import (
    # Core classes
    CoreferenceResolver,
    StreamCorefSession,
    EntityTracker,
    Entity,
    # Data structures
    CorefOutput,
    Replacement,
    TimeSpan,
    # Convenience functions
    resolve,
    resolve_with_details,
    split_sentences,
)

# === NER Service ===
from .ner_adapter import (
    NERService,
    NERResult,
    MentionWithCanonical,
    extract_mentions,
    extract_entities,
)

# === Time Normalization ===
from .time_normalizer import (
    TimeNormalizer,
    TimeSpan as TimeSpanResult,  # avoid conflict with coreference TimeSpan
    normalize_time,
)

# === Entity Canonicalization ===
from .canonicalizer import (
    BaseCanonicalizer,
    DictCanonicalizer,
    RuleBasedCanonicalizer,
    ChainedCanonicalizer,
    CanonicalResult,  # defined solely in canonicalizer
    AliasCandidate,
    create_canonicalizer,
    canonicalize,
)

__version__ = "3.0.0"
__author__ = "Coreference Resolution System"

__all__ = [
    # === Tokenizer ===
    "ChineseTokenizer",
    "Token",
    "Mention",
    # === Coreference Resolution ===
    "CoreferenceResolver",
    "StreamCorefSession",
    "EntityTracker",
    "Entity",
    "CorefOutput",
    "Replacement",
    "TimeSpan",
    "CanonicalResult",
    "resolve",
    "resolve_with_details",
    "split_sentences",
    # === NER Service ===
    "NERService",
    "NERResult",
    "MentionWithCanonical",
    "extract_mentions",
    "extract_entities",
    # === Time Normalization ===
    "TimeNormalizer",
    "TimeSpanResult",
    "normalize_time",
    # === Entity Canonicalization ===
    "BaseCanonicalizer",
    "DictCanonicalizer",
    "RuleBasedCanonicalizer",
    "ChainedCanonicalizer",
    "AliasCandidate",
    "create_canonicalizer",
    "canonicalize",
]

```

### Core Architecture Module: `coreference/coreference_module/canonicalizer.py`
```
"""
Entity Canonicalization Module (Canonicalizer)

Core Features:
1. Map entity aliases to canonical names
2. Support pluggable mapping backends (in-memory / database / KV store)
3. Return original value when no match is found (never guess)

Design Principles:
- Never modify when no match is found, ensuring alias absence doesn't hurt recall
- Unknown aliases are placed in a "learning candidate queue" for future LLM-based mapping updates
"""

from typing import Dict, Optional, List, Callable
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class CanonicalResult:
    """Canonicalization result"""

    surface_text: str  # original text
    canonical_text: str  # canonicalized result
    entity_type: str  # entity type
    entity_id: Optional[str] = None  # entity ID (optional)
    confidence: float = 1.0  # confidence score
    evidence: str = ""  # evidence source: 'rule', 'alias_map', 'llm', 'default'


@dataclass
class AliasCandidate:
    """Alias candidate pending learning"""

    surface_text: str  # alias text
    entity_type: str  # entity type
    context: str  # context snippet
    timestamp: datetime  # discovery time
    suggested_canonical: Optional[str] = None  # suggested canonical name (if available)


class BaseCanonicalizer:
    """Base class for canonicalizers

    Subclasses must implement the _lookup method to provide specific mapping logic
    """

    def __init__(self):
        # Learning candidate queue
        self.alias_candidates: List[AliasCandidate] = []
        self.max_candidates = 1000  # max candidates to keep

    def canonicalize(self, surface_text: str, entity_type: str, context: str = "") -> CanonicalResult:
        """Canonicalize an entity

        Args:
            surface_text: original text
            entity_type: entity type
            context: context (optional, for disambiguation)

        Returns:
            CanonicalResult: canonicalization result
        """
        # 1. Look up mapping
        result = self._lookup(surface_text, entity_type)

        if result:
            return result

        # 2. Not found, add to candidate queue
        self._add_candidate(surface_text, entity_type, context)

        # 3. Return original value (never guess)
        return CanonicalResult(
            surface_text=surface_text,
            canonical_text=surface_text,  # original value
            entity_type=entity_type,
            confidence=0.5,  # low confidence
            evidence="default",
        )

    def _lookup(self, surface_text: str, entity_type: str) -> Optional[CanonicalResult]:
        """Look up mapping (implemented by subclasses)"""
        raise NotImplementedError

    def _add_candidate(self, surface_text: str, entity_type: str, context: str):
        """Add to candidate queue"""
        candidate = AliasCandidate(
            surface_text=surface_text,
            entity_type=entity_type,
            context=context[:200],  # limit context length
            timestamp=datetime.now(),
        )

        self.alias_candidates.append(candidate)

        # Limit queue size
        if len(self.alias_candidates) > self.max_candidates:
            self.alias_candidates = self.alias_candidates[-self.max_candidates :]

    def get_candidates(self) -> List[AliasCandidate]:
        """Get pending learning candidates"""
        return self.alias_candidates

    def clear_candidates(self):
        """Clear candidate queue"""
        self.alias_candidates.clear()


class DictCanonicalizer(BaseCanonicalizer):
    """In-memory dictionary based canonicalizer

    Suitable for:
    - Small-scale alias mappings
    - Development / testing environments
    - Scenarios without persistence requirements
    """

    def __init__(self, alias_map: Dict[str, Dict[str, str]] = None):
        """
        Args:
            alias_map: alias mapping table {entity_type: {alias: canonical}}
        """
        super().__init__()
        self.alias_map = alias_map or {}

    def _lookup(self, surface_text: str, entity_type: str) -> Optional[CanonicalResult]:
        """Look up mapping from dictionary"""
        type_map = self.alias_map.get(entity_type, {})
        canonical = type_map.get(surface_text)

        if canonical:
            return CanonicalResult(
                surface_text=surface_text,
                canonical_text=canonical,
                entity_type=entity_type,
                confidence=1.0,
                evidence="alias_map",
            )

        return None

    def add_alias(self, alias: str, canonical: str, entity_type: str):
        """Add an alias mapping"""
        if entity_type not in self.alias_map:
            self.alias_map[entity_type] = {}
        self.alias_map[entity_type][alias] = canonical

    def remove_alias(self, alias: str, entity_type: str):
        """Remove an alias mapping"""
        if entity_type in self.alias_map:
            self.alias_map[entity_type].pop(alias, None)


class RuleBasedCanonicalizer(BaseCanonicalizer):
    """Rule-based canonicalizer

    Suitable for:
    - Common variant rules (e.g. nickname -> full name)
    - Standardization (e.g. whitespace removal, fullwidth to halfwidth)
    """

    def __init__(self):
        super().__init__()

        # Common person name alias rules
        self.person_rules = {
            # Rules like nickname -> real name require additional info; simple example here
        }

        # Location name aliases
        self.location_rules = {
            "帝都": "北京",
            "魔都": "上海",
            "花城": "广州",
            "鹏城": "深圳",
            "泉城": "济南",
            "蓉城": "成都",
            "江城": "武汉",
            "春城": "昆明",
            "冰城": "哈尔滨",
            "石头城": "南京",
        }

    def _lookup(self, surface_text: str, entity_type: str) -> Optional[CanonicalResult]:
        """Apply rules"""
        canonical = None

        if entity_type in ["PER_NAME", "PER_TITLE"]:
            canonical = self.person_rules.get(surface_text)
        elif entity_type in ["LOC_NAME", "LOC_PLACE"]:
            canonical = self.location_rules.get(surface_text)

        if canonical:
            return CanonicalResult(
                surface_text=surface_text,
                canonical_text=canonical,
                entity_type=entity_type,
                confidence=0.9,
                evidence="rule",
            )

        return None


class ChainedCanonicalizer(BaseCanonicalizer):
    """Chained canonicalizer

    Tries multiple canonicalizers in order; returns the first match
    """

    def __init__(self, canonicalizers: List[BaseCanonicalizer] = None):
        super().__init__()
        self.canonicalizers = canonicalizers or []

    def add_canonicalizer(self, canonicalizer: BaseCanonicalizer):
        """Add a canonicalizer to the chain"""
        self.canonicalizers.append(canonicalizer)

    def _lookup(self, surface_text: str, entity_type: str) -> Optional[CanonicalResult]:
        """Try each canonicalizer in order"""
        for canonicalizer in self.canonicalizers:
            result = canonicalizer._lookup(surface_text, entity_type)
            if result:
                return result
        return None


# === Convenience Functions ===


def create_canonicalizer(alias_map: Dict[str, Dict[str, str]] = None) -> BaseCanonicalizer:
    """Create a canonicalizer

    Creates a chained canonicalizer by default: rules -> dictionary
    """
    chain = ChainedCanonicalizer()

    # 1. Rule-based canonicalization
    chain.add_canonicalizer(RuleBasedCanonicalizer())

    # 2. Dictionary-based canonicalization
    if alias_map:
        chain.add_canonicalizer(DictCanonicalizer(alias_map))

    return chain


def canonicalize(surface_text: str, entity_type: str) -> CanonicalResult:
    """Quick canonicalization (stateless)"""
    canonicalizer = RuleBasedCanonicalizer()
    return canonicalizer.canonicalize(surface_text, entity_type)


# === Test ===

if __name__ == "__main__"
```

### Core Architecture Module: `coreference/coreference_module/coreference.py`
```
"""
Coreference Resolution Module

Core features:
1. Entity tracking: maintain recently seen persons, objects, locations
2. Pronoun identification: identify pronouns in sentences (he/that/there etc.)
3. Coreference resolution: find suitable antecedents based on pronoun type and context
"""

from typing import List, Dict, Optional, Tuple, Callable, TYPE_CHECKING
from dataclasses import dataclass, field
from collections import deque
from datetime import datetime
import re

from .syntax_adapter import SyntaxAdapter

# Import CanonicalResult (avoid circular import)
if TYPE_CHECKING:
    from .canonicalizer import CanonicalResult as CanonicalResultType
else:
    # Runtime lazy import
    CanonicalResultType = None


def _get_canonical_result():
    """Get CanonicalResult class (lazy import)"""
    from .canonicalizer import CanonicalResult

    return CanonicalResult


def split_sentences(text: str) -> List[Tuple[str, str]]:
    """Smart sentence splitting: supports various punctuation marks

    Args:
        text: input text

    Returns:
        List of (sentence, delimiter) tuples
    """
    results = []
    current = ""
    i = 0

    while i < len(text):
        char = text[i]

        # Check special delimiters
        # 1. Ellipsis (consecutive dots)
        if char in ".。" and i + 2 < len(text) and text[i : i + 3] in ("...", "。。。", "...", "···"):
            # Find full length of ellipsis
            j = i
            while j < len(text) and text[j] in ".。·":
                j += 1
            delim = text[i:j]
            if current.strip():
                results.append((current.strip(), delim))
            current = ""
            i = j
            continue

        # 2. Dash
        if char in "—-" and i + 1 < len(text) and text[i : i + 2] in ("——", "--"):
            delim = text[i : i + 2]
            if current.strip():
                results.append((current.strip(), delim))
            current = ""
            i += 2
            continue

        # 3. Standard sentence-ending punctuation
        if char in "。！？?!":
            if current.strip():
                results.append((current.strip(), char))
            current = ""
            i += 1
            continue

        current += char
        i += 1

    # Handle trailing text without punctuation
    if current.strip():
        results.append((current.strip(), ""))

    return results


# Import tokenizer
try:
    from .tokenizer import ChineseTokenizer, Mention
    from .time_normalizer import TimeNormalizer, normalize_time as _normalize_time
except ImportError:
    from tokenizer import ChineseTokenizer, Mention
    from time_normalizer import TimeNormalizer, normalize_time as _normalize_time


# === Scoring constants for candidate ranking ===


class _ScoreWeights:
    """Named constants for the candidate scoring logic in _find_replacement._score().
    Centralised here so they can be tuned without hunting through 900+ lines."""

    SRL_HIT_BASE = 20000  # base score when SRL arg span matches
    TOKEN_HIT_BASE = 10000  # base score when role-token list matches
    SPEECH_VERB_BONUS = 1500  # bonus for speech verb predicate match
    COMM_VERB_BONUS = 1500  # bonus for communication verb predicate match
    PATIENT_VERB_BONUS = 800  # bonus for patient verb predicate match
    SPEAKER_LISTENER_BONUS = 800  # bonus when candidate matches recent speaker/listener
    PARAGRAPH_RESET_PENALTY = 600  # penalty for cross-paragraph candidates
    STRONG_DECAY_PER_GAP = 300  # per-sentence decay when new entity exists between
    WEAK_DECAY_PER_GAP = 150  # per-sentence decay when no new entity between
    SINGLE_CANDIDATE_BONUS = 200  # bonus when only one candidate and gap ≤ 2
    INITIAL_SCORE = -100000  # initial score before any signal


# === Structured output data types ===


@dataclass
class Replacement:
    """Replacement record"""

    pronoun: str  # original pronoun
    replacement: str  # replacement text
    position: int  # position in sentence
    type: str  # pronoun type
    sentence_id: int = 0  # sentence ID


@dataclass
class TimeSpan:
    """Time span (normalization result)"""

    source_text: str  # original time expression
    start_dt: Optional[datetime] = None  # start time
    end_dt: Optional[datetime] = None  # end time
    precision: str = "UNKNOWN"  # precision: DAY, WEEK, MONTH, YEAR, FUZZY
    start: int = -1  # start position in source text
    end: int = -1  # end position in source text


@dataclass
class CorefOutput:
    """Coreference resolution structured output"""

    original_text: str  # original text
    resolved_text: str  # resolved text
    replacements: List[Replacement]  # replacement records
    mentions: List[Mention]  # entity mentions (from resolved_text)
    time_extractions: List[TimeSpan]  # time normalization results


@dataclass
class Entity:
    """Entity class"""

    text: str  # entity text
    type: str  # entity type: PER_NAME, PER_TITLE, LOC_NAME, LOC_PLACE, OBJ, TIME
    sentence_id: int  # sentence ID where it appears
    position: int  # position in sentence (character index)
    start: int = -1  # character start position
    end: int = -1  # character end position


@dataclass
class Event:
    """Event class - for event/proposition coreference"""

    text: str  # event text (full sentence or predicate phrase)
    verb: str  # main verb
    sentence_id: int  # sentence ID it belongs to
    summary: str = ""  # event summary (verb phrase with subject removed)


class EntityTracker:
    """Entity tracker - maintains recently mentioned entities and events"""

    # Female name characteristic characters
    FEMALE_NAME_CHARS = {
        "红",
        "丽",
        "芳",
        "娟",
        "燕",
        "敏",
        "娜",
        "静",
        "萍",
        "玲",
        "梅",
        "英",
        "华",
        "琴",
        "艳",
        "霞",
        "秀",
        "云",
        "兰",
        "莉",
        "珍",
        "蓉",
        "凤",
        "琳",
        "婷",
        "雪",
        "慧",
        "倩",
        "娇",
        "怡",
        "嫣",
        "媛",
        "妍",
        "颖",
        "婉",
        "悦",
        "妮",
        "雯",
        "琪",
        "薇",
    }

    # Male name characteristic characters
    MALE_NAME_CHARS = {
        "明",
        "强",
        "军",
        "伟",
        "建",
        "国",
        "刚",
        "勇",
        "斌",
        "杰",
        "涛",
        "磊",
        "浩",
        "鹏",
        "锋",
        "辉",
        "超",
        "飞",
        "龙",
        "凯",
        "华",
        "威",
        "雄",
        "峰",
        "波",
        "康",
        "健",
        "志",
        "文",
        "武",
    }

    def __init__(self, max_history: int = 10):
        """
        Args:
            max_history: max number of historical entities to keep
        """
        self.max_history = max_history
        # Five stacks: four entity stacks + one event stack
        self.person_stack: deque = deque(maxlen=max_history)  # persons
        self.object_stack: deque = deque(maxlen=max_history)  # objects
        self.location_stack: deque = deque(maxlen=max_history)  # locations
        self.time_stack: deque = deque(maxlen=max_history)  # time
        self.event_stack: deque = deque(maxlen=max_history)  # events/propositions

        # Unified candidate stack (for ordinal pronouns, records all entity types)
        self.all_mentions_stack: deque = deque(maxlen=max_history * 2)

        # Current sentence entities (for distinguishing subject/object positions)
        self.current_sentence_persons: List[Entity] = []
        self.last_speaker: Optional[Entity] = None
        self.last_listener: Optional[Entity] = None
        self.last_speaker_sid: int = -1
        self.last_listener_sid: int = -1
        self.speaker_chain: deque = deque(maxlen=3)

        self.sentence_count = 0

    def is_female_name(self, name: str) -> bool:
        """Check if name is possibly female"""
        if not name:
            return False
        # Check 
```

### Core Architecture Module: `coreference/coreference_module/ner_adapter.py`
```
"""
NER Service Adapter

Provides a standardized NER interface for Memory Engine consumption.

Main Features:
1. extract(): backward-compatible interface, returns entities grouped by type
2. extract_mentions(): new interface, returns Mention list with position info
"""

from typing import List, Dict, Optional, Callable
from dataclasses import dataclass

try:
    from .tokenizer import ChineseTokenizer, Mention
    from .canonicalizer import CanonicalResult
except ImportError:
    from tokenizer import ChineseTokenizer, Mention
    from canonicalizer import CanonicalResult


@dataclass
class NERResult:
    """NER result (backward-compatible interface)"""

    PER: List[str]  # persons (names + titles)
    LOC: List[str]  # locations (named + places)
    TIME: List[str]  # time expressions
    OBJ: List[str]  # objects


@dataclass
class MentionWithCanonical(Mention):
    """Mention with canonicalization info"""

    canonical: Optional[str] = None  # canonicalized result
    entity_id: Optional[str] = None  # entity ID
    confidence: float = 1.0  # confidence score


class NERService:
    """NER Service"""

    def __init__(self):
        self.tokenizer = ChineseTokenizer()

    def extract(self, text: str) -> NERResult:
        """Extract entities (backward-compatible interface)

        Args:
            text: input text

        Returns:
            NERResult: entities grouped by type
        """
        result = self.tokenizer.analyze(text)

        return NERResult(
            PER=result["person_names"] + result["person_titles"],
            LOC=result["location_names"] + result["location_places"],
            TIME=result["times"],
            OBJ=result["objects"],
        )

    def extract_mentions(
        self, text: str, canonicalizer: Optional[Callable[[str, str], CanonicalResult]] = None
    ) -> List[Mention]:
        """Extract entity Mentions (new interface, with position info)

        Differences from extract():
        1. Preserves entity occurrence order in the original text
        2. Includes precise character position info (start, end)
        3. Supports optional canonicalization

        Args:
            text: input text
            canonicalizer: optional canonicalization function (surface, type) -> CanonicalResult

        Returns:
            List[Mention]: entity mentions in occurrence order
        """
        mentions = self.tokenizer.analyze_mentions(text)

        if canonicalizer:
            # Canonicalize mentions and return version with canonicalization info
            result = []
            for mention in mentions:
                canonical_result = canonicalizer(mention.surface, mention.type)
                result.append(
                    MentionWithCanonical(
                        surface=mention.surface,
                        type=mention.type,
                        start=mention.start,
                        end=mention.end,
                        sentence_id=mention.sentence_id,
                        canonical=canonical_result.canonical_text,
                        entity_id=canonical_result.entity_id,
                        confidence=canonical_result.confidence,
                    )
                )
            return result

        return mentions

    def extract_by_type(self, text: str, entity_type: str) -> List[Mention]:
        """Extract entities by type

        Args:
            text: input text
            entity_type: entity type (PER_NAME, PER_TITLE, LOC_NAME, LOC_PLACE, OBJ, TIME)

        Returns:
            List[Mention]: entities of the specified type
        """
        mentions = self.tokenizer.analyze_mentions(text)
        return [m for m in mentions if m.type == entity_type]

    def extract_persons(self, text: str) -> List[Mention]:
        """Extract person entities (names + titles)"""
        mentions = self.tokenizer.analyze_mentions(text)
        return [m for m in mentions if m.type in ["PER_NAME", "PER_TITLE"]]

    def extract_locations(self, text: str) -> List[Mention]:
        """Extract location entities (named + places)"""
        mentions = self.tokenizer.analyze_mentions(text)
        return [m for m in mentions if m.type in ["LOC_NAME", "LOC_PLACE"]]

    def extract_times(self, text: str) -> List[Mention]:
        """Extract time entities"""
        mentions = self.tokenizer.analyze_mentions(text)
        return [m for m in mentions if m.type == "TIME"]

    def extract_objects(self, text: str) -> List[Mention]:
        """Extract object entities"""
        mentions = self.tokenizer.analyze_mentions(text)
        return [m for m in mentions if m.type == "OBJ"]


# === Convenience Functions ===


def extract_mentions(text: str) -> List[Mention]:
    """Quick mention extraction"""
    service = NERService()
    return service.extract_mentions(text)


def extract_entities(text: str) -> NERResult:
    """Quick entity extraction (backward-compatible interface)"""
    service = NERService()
    return service.extract(text)


# === Test ===

if __name__ == "__main__":
    print("=" * 70)
    print("NER Service Test")
    print("=" * 70)

    service = NERService()

    tests = [
        "小明在学校读书",
        "妈妈去超市买苹果",
        "去年我去了北京",
        "刘德华和张学友是好朋友",
    ]

    for text in tests:
        print(f"\nInput: {text}")

        # Legacy interface
        result = service.extract(text)
        print(f"  Legacy: PER={result.PER}, LOC={result.LOC}, TIME={result.TIME}, OBJ={result.OBJ}")

        # New interface
        mentions = service.extract_mentions(text)
        print(f"  New:    {[(m.surface, m.type, f'[{m.start}:{m.end}]') for m in mentions]}")

```

### Core Architecture Module: `coreference/coreference_module/syntax_adapter.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Lightweight syntax / role adapter layer: prefers available parsers, falls back to heuristic rules.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)
import importlib.util


@dataclass
class RoleHint:
    start: int
    end: int
    role: str  # "subject" | "object"


@dataclass
class SRLArg:
    start: int
    end: int
    role: str  # "subject" | "object"
    pred_start: Optional[int] = None
    pred_end: Optional[int] = None


class SyntaxAdapter:
    def __init__(self, tokenizer, prefer_backend: str = "ltp", max_tokens: int = 40) -> None:
        self.tokenizer = tokenizer
        self.backend = None
        self.prefer_backend = prefer_backend
        self.max_tokens = max_tokens
        self._hanlp_dep = None
        self._ltp = None
        self._cache_sentence: Optional[str] = None
        self._cache_tokens: Optional[List[str]] = None
        self._cache_offsets: Optional[List[tuple[int, int]]] = None
        self._cache_roles: Optional[List[Optional[str]]] = None
        self._cache_heads: Optional[List[int]] = None
        self._cache_rels: Optional[List[str]] = None
        self._cache_srl_hints: Optional[List[RoleHint]] = None
        self._cache_srl_subject: Optional[List[str]] = None
        self._cache_srl_object: Optional[List[str]] = None
        self._cache_srl_args: Optional[List[SRLArg]] = None
        self._hanlp_srl = None
        self._try_load_backend()

    def _try_load_backend(self) -> None:
        order = ("ltp", "hanlp") if self.prefer_backend == "ltp" else ("hanlp", "ltp")
        for name in order:
            if importlib.util.find_spec(name) is not None:
                self.backend = name
                break

    def get_pronoun_role(self, sentence: str, position: int) -> Optional[str]:
        srl_hint = self.get_srl_role_hint(sentence, position)
        if srl_hint:
            return srl_hint
        if self._cache_sentence == sentence and self._cache_offsets and self._cache_roles:
            idx = self._find_token_index(position, self._cache_offsets)
            if idx is not None and idx < len(self._cache_roles):
                return self._cache_roles[idx]
        if self.backend == "hanlp":
            role = self._hanlp_role(sentence, position)
            if role:
                return role
        if self.backend == "ltp":
            role = self._ltp_role(sentence, position)
            if role:
                return role
        # Currently only lightweight heuristics; can be enhanced when backend is available
        return self._heuristic_pronoun_role(sentence, position)

    def get_role_tokens(self, sentence: str) -> dict:
        tokens, roles, _offsets = self._ensure_parsed(sentence)
        if not tokens or not roles:
            return {"subject": [], "object": []}
        sub = [t for t, r in zip(tokens, roles) if r == "subject"]
        obj = [t for t, r in zip(tokens, roles) if r == "object"]
        return {"subject": sub, "object": obj}

    def get_srl_role_hint(self, sentence: str, position: int) -> Optional[str]:
        hints, _sub, _obj = self._ensure_srl(sentence)
        if not hints:
            return None
        for hint in hints:
            if hint.start <= position < hint.end:
                return hint.role
        return None

    def get_srl_role_tokens(self, sentence: str) -> dict:
        _hints, sub, obj = self._ensure_srl(sentence)
        if not sub and not obj:
            return {"subject": [], "object": []}
        return {"subject": sub or [], "object": obj or []}

    def get_srl_args(self, sentence: str) -> List[SRLArg]:
        _hints, _sub, _obj = self._ensure_srl(sentence)
        if self._cache_srl_args is None:
            return []
        return self._cache_srl_args

    def get_event_summary(self, sentence: str) -> Optional[str]:
        if self.backend == "ltp":
            return self._ltp_event_summary(sentence)
        if self.backend == "hanlp":
            return self._hanlp_event_summary(sentence)
        return None

    def get_conj_group_before(self, sentence: str, position: int) -> Optional[str]:
        tokens, offsets, heads, rels = self._ensure_dep(sentence)
        if not tokens or not offsets or not heads or not rels:
            return None
        conj_rels = {"COO", "conj"}
        n = len(tokens)
        parent = list(range(n))

        def find(x: int) -> int:
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x

        def union(a: int, b: int) -> None:
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[rb] = ra

        for i, rel in enumerate(rels):
            if rel in conj_rels:
                h = heads[i] - 1
                if 0 <= h < n:
                    union(i, h)

        groups: dict[int, List[int]] = {}
        for i in range(n):
            if offsets[i][1] > position:
                continue
            r = find(i)
            groups.setdefault(r, []).append(i)

        candidates = [g for g in groups.values() if len(g) >= 2]
        if not candidates:
            return None
        group = max(candidates, key=lambda g: max(offsets[i][1] for i in g))
        group = sorted(group, key=lambda i: offsets[i][0])

        # Filter out conjunctions and punctuation to avoid errors like duplicate conjunctions
        conjunctions = {"和", "与", "及", "或", "跟", "同", "、", "，", ","}
        names = [tokens[i] for i in group if tokens[i] not in conjunctions]

        # Deduplicate
        unique_names = []
        for n in names:
            if n not in unique_names:
                unique_names.append(n)
        names = unique_names

        if len(names) < 2:
            return None
        if all(n in {"公司", "机构", "部门", "团队"} for n in names):
            return None
        if len(names) == 2:
            return names[0] + "和" + names[1]
        return "、".join(names[:-1]) + "和" + names[-1]

    def get_clause_bounds(self, sentence: str) -> List[tuple[int, int]]:
        tokens, offsets, heads, rels = self._ensure_dep(sentence)
        if not tokens or not offsets or not heads or not rels:
            return []
        clause_rels = {"ADV", "CMP", "COO", "SBV", "VOB", "FOB", "POB", "COO", "DBL", "IC", "HED", "RAD", "WP", "MT"}
        clause_dep_rels = {"advcl", "acl", "rcmod", "conj", "ccomp", "xcomp"}
        boundaries = set()
        for i, rel in enumerate(rels):
            if rel in clause_dep_rels:
                boundaries.add(offsets[i][0])
        for i, tok in enumerate(tokens):
            if tok in {"，", ",", "；", ";", "。"}:
                boundaries.add(offsets[i][1])
        points = sorted(b for b in boundaries if 0 < b < len(sentence))
        if not points:
            return [(0, len(sentence))]
        bounds = []
        start = 0
        for b in points:
            bounds.append((start, b))
            start = b
        bounds.append((start, len(sentence)))
        return bounds

    def get_clause_index(self, sentence: str, position: int) -> Optional[int]:
        bounds = self.get_clause_bounds(sentence)
        if not bounds:
            return None
        for i, (s, e) in enumerate(bounds):
            if s <= position < e:
                return i
        return None

    def _heuristic_pronoun_role(self, sentence: str, position: int) -> Optional[str]:
        before = sentence[:position]
        after = sentence[position:]
        # Passive voice: X bei Y..., X is typically the patient
        if "被" in before[-4:]:
            return "object"
        # Ba-construction: X ba Y...
        if "把" in before[-4:]:
            return "object"
        # Prepositional structure: after dui/xiang/gei/gen/he, typically patient or object
        if any(p in before[-3:] for p in ("对", "向", "给", "跟", "和")):
            return 
```

### Core Architecture Module: `coreference/coreference_module/time_normalizer.py`
```
"""
Time Normalization Module

Core Features:
1. Convert relative time expressions (e.g. "yesterday", "last year") to absolute time ranges
2. Does not modify original text, only produces structured TimeSpan

Design Principles:
- Rules must be deterministic to avoid "reference frame drift"
- Fuzzy time (e.g. "recently") outputs FUZZY precision for soft weighting, not hard filtering
"""

from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import Optional, Tuple
import re


@dataclass
class TimeSpan:
    """Time span"""

    source_text: str  # original time expression
    start_dt: Optional[datetime] = None  # start time
    end_dt: Optional[datetime] = None  # end time
    precision: str = "UNKNOWN"  # precision: HOUR, DAY, WEEK, MONTH, YEAR, FUZZY, UNKNOWN
    start: int = -1  # start position in source text
    end: int = -1  # end position in source text


class TimeNormalizer:
    """Time normalizer"""

    # === Day-relative time ===
    DAY_RELATIVE = {
        "今天": 0,
        "今日": 0,
        "昨天": -1,
        "昨日": -1,
        "前天": -2,
        "前日": -2,
        "大前天": -3,
        "明天": 1,
        "明日": 1,
        "后天": 2,
        "后日": 2,
        "大后天": 3,
    }

    # === Week-relative time ===
    WEEK_RELATIVE = {
        "这周": 0,
        "本周": 0,
        "这个星期": 0,
        "上周": -1,
        "上个星期": -1,
        "上上周": -2,
        "下周": 1,
        "下个星期": 1,
        "下下周": 2,
    }

    # === Month-relative time ===
    MONTH_RELATIVE = {
        "这个月": 0,
        "本月": 0,
        "当月": 0,
        "上个月": -1,
        "下个月": 1,
    }

    # === Year-relative time ===
    YEAR_RELATIVE = {
        "今年": 0,
        "去年": -1,
        "前年": -2,
        "明年": 1,
        "后年": 2,
    }

    # === Day of week ===
    WEEKDAY_MAP = {
        "周一": 0,
        "星期一": 0,
        "周二": 1,
        "星期二": 1,
        "周三": 2,
        "星期三": 2,
        "周四": 3,
        "星期四": 3,
        "周五": 4,
        "星期五": 4,
        "周六": 5,
        "星期六": 5,
        "周日": 6,
        "星期日": 6,
        "星期天": 6,
        "周末": 5,  # weekend defaults to Saturday
    }

    # === Time periods ===
    TIME_PERIOD = {
        "早上": (6, 9),
        "上午": (9, 12),
        "中午": (11, 13),
        "下午": (13, 18),
        "傍晚": (17, 19),
        "晚上": (19, 23),
        "深夜": (23, 3),
        "凌晨": (0, 6),
        "半夜": (0, 3),
        "早晨": (5, 8),
        "清晨": (5, 7),
        "黄昏": (17, 19),
    }

    # === Seasons ===
    SEASON_MAP = {
        "春天": (3, 5),
        "春季": (3, 5),
        "夏天": (6, 8),
        "夏季": (6, 8),
        "秋天": (9, 11),
        "秋季": (9, 11),
        "冬天": (12, 2),
        "冬季": (12, 2),
    }

    # === Holidays (approximate dates) ===
    HOLIDAY_MAP = {
        "元旦": (1, 1),
        "元旦节": (1, 1),
        "春节": (1, 28),  # lunar calendar, approximate Gregorian
        "过年": (1, 28),
        "元宵节": (2, 15),  # lunar 1st month 15th, approximate
        "清明": (4, 5),
        "清明节": (4, 5),
        "五一": (5, 1),
        "五一节": (5, 1),
        "劳动节": (5, 1),
        "端午": (6, 10),
        "端午节": (6, 10),  # lunar 5th month 5th, approximate
        "七夕": (8, 14),
        "七夕节": (8, 14),  # lunar 7th month 7th, approximate
        "中秋": (9, 21),
        "中秋节": (9, 21),  # lunar 8th month 15th, approximate
        "国庆": (10, 1),
        "国庆节": (10, 1),
        "十一": (10, 1),
        "重阳": (10, 25),
        "重阳节": (10, 25),  # lunar 9th month 9th, approximate
        "圣诞": (12, 25),
        "圣诞节": (12, 25),
        "平安夜": (12, 24),
        "除夕": (1, 27),  # lunar New Year's Eve, approximate
        "大年三十": (1, 27),
        "大年初一": (1, 28),
    }

    # === Fuzzy time ===
    FUZZY_TIME = {
        "以前",
        "之前",
        "从前",
        "过去",
        "曾经",
        "以后",
        "之后",
        "将来",
        "未来",
        "日后",
        "现在",
        "目前",
        "当前",
        "此刻",
        "眼下",
        "如今",
        "刚才",
        "刚刚",
        "方才",
        "适才",
        "最近",
        "近来",
        "近期",
        "近日",
        "这段时间",
        "那段时间",
    }

    def normalize(
        self, time_text: str, reference: datetime = None, text_start: int = -1, text_end: int = -1
    ) -> TimeSpan:
        """Normalize a time expression

        Args:
            time_text: time text
            reference: reference time (defaults to current time)
            text_start: start position in source text
            text_end: end position in source text

        Returns:
            TimeSpan: normalization result
        """
        if reference is None:
            reference = datetime.now()

        # Try various normalization rules
        result = (
            self._normalize_day_relative(time_text, reference)
            or self._normalize_week_relative(time_text, reference)
            or self._normalize_month_relative(time_text, reference)
            or self._normalize_year_relative(time_text, reference)
            or self._normalize_weekday(time_text, reference)
            or self._normalize_season(time_text, reference)
            or self._normalize_holiday(time_text, reference)
            or self._normalize_fuzzy(time_text, reference)
            or self._normalize_explicit_date(time_text, reference)
        )

        if result:
            result.source_text = time_text
            result.start = text_start
            result.end = text_end
            return result

        # Cannot normalize
        return TimeSpan(source_text=time_text, precision="UNKNOWN", start=text_start, end=text_end)

    def _normalize_day_relative(self, text: str, ref: datetime) -> Optional[TimeSpan]:
        """Normalize day-relative time (yesterday, today, tomorrow, etc.)"""
        if text in self.DAY_RELATIVE:
            delta = self.DAY_RELATIVE[text]
            target = ref.date() + timedelta(days=delta)
            return TimeSpan(
                source_text=text,
                start_dt=datetime.combine(target, datetime.min.time()),
                end_dt=datetime.combine(target + timedelta(days=1), datetime.min.time()),
                precision="DAY",
            )
        return None

    def _normalize_week_relative(self, text: str, ref: datetime) -> Optional[TimeSpan]:
        """Normalize week-relative time (last week, this week, next week, etc.)"""
        if text in self.WEEK_RELATIVE:
            delta = self.WEEK_RELATIVE[text]
            # Calculate target week's Monday
            current_monday = ref.date() - timedelta(days=ref.weekday())
            target_monday = current_monday + timedelta(weeks=delta)
            next_monday = target_monday + timedelta(weeks=1)
            return TimeSpan(
                source_text=text,
                start_dt=datetime.combine(target_monday, datetime.min.time()),
                end_dt=datetime.combine(next_monday, datetime.min.time()),
                precision="WEEK",
            )
        return None

    def _normalize_month_relative(self, text: str, ref: datetime) -> Optional[TimeSpan]:
        """Normalize month-relative time (last month, this month, next month, etc.)"""
        if text in self.MONTH_RELATIVE:
            delta = self.MONTH_RELATIVE[text]
            year = ref.year
            month = ref.month + delta

            # Handle year overflow
            while month < 1:
                month += 12
                year -= 1
            while month > 12:
                month -= 12
                year += 1

            start_dt = datetime(year, month, 1)

            # Calculate next month
            next_month = month + 1
            next_year = year
            if next_month > 12:
                next_month = 1
                next_year += 1
            end_dt = datetime(next_year, next_month, 1)

            return TimeSpan(source_text=text, start_dt=start_dt, end_dt=end_dt, precision="MONTH")
        return None

    def _normalize_year_relative(self, text: str, ref: datetime) -> Optional[TimeSpan]:
        """Normalize year-relative time (last ye
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #116** (2026-05-01): **[bug] Pydantic ValidationError on ActivityDTO (created_at) due to Neo4j datetime format +00:00Z**
  *Symptoms*: ### What happened?  ### Describe the Bug When accessing the `/api/v1/activity` endpoint, the server returns a HTTP 500 Internal Server Error.  The error is caused by a `pydantic_core._pydantic_core.ValidationError` during the instantiation of `ActivityDTO`. Pydantic strictly rejects the `created_at` field because the datetime string ends with dual timezone indicators (`+00:00Z`).  ### Steps to Reproduce 1. Start the M-flow backend with Neo4j and Postgres enabled. 2. Perform some actions (e.g., searches, ingestions) to generate activities. 3. Fetch the recent activities via `GET /api/v1/activity?limit=5` (or navigate to the Activity dashboard in the UI). 4. See error.  ### Error Logs / Traceback ```python 172.26.0.1:50864 - "GET /api/v1/activity?limit=5 HTTP/1.1" 500 [2026-04-23 01:57:16 +0000] [24] [ERROR] Exception in ASGI application Traceback (most recent call last):   ...   File "/opt/m_flow/m_flow/api/v1/activity/routers/get_activity_router.py", line 87, in list_activities     ActivityDTO(   File "/opt/m_flow/.venv/lib/python3.12/site-packages/pydantic/main.py", line 253, in __init__     validated_self = self.__pydantic_validator__.validate_python(data, self_instance=self) pydantic_core._pydantic_core.ValidationError: 1 validation error for ActivityDTO created_at   Input should be a valid datetime or date, unexpected extra characters at the end of the input [type=datetime_from_date_parsing, input_value='2026-04-23T01:38:12.734433+00:00Z', input_type=str]     For further 
  **Post-Mortem & Fix Analysis**:
  > Hi @Adhders, thanks for taking the time to open an issue! If this is a bug report, please make sure you have included: 1. Steps to reproduce the problem 2. Expected behaviour vs actual behaviour 3. A minimal code snippet or configuration that triggers the issue Check out our README at https://github.com/FlowElement-ai/m_flow for additional guidance. A maintainer will follow up as soon as possible.

- **Issue #1** (2026-04-05): **[bug]  install m_flow ERROR**
  *Symptoms*: ### What happened?  ` pip install m_flow` ERROR: Could not find a version that satisfies the requirement m_flow (from versions: none) ERROR: No matching distribution found for m_flow  ### Reproduction steps  PS C:\Users\Administrator\Desktop\study\graphrag_demo> pip install m_flow ERROR: Could not find a version that satisfies the requirement m_flow (from versions: none) ERROR: No matching distribution found for m_flow  ### M-flow version  0.1.0  ### Operating system  Windows  ### Python version  3.13.12  ### Error traceback / logs  ```python  ```  ### Anything else?  _No response_  ### Confirmation  - [x] I searched open issues and this has not been reported yet
  **Post-Mortem & Fix Analysis**:
  > Hi @zSergeant, thanks for taking the time to open an issue! If this is a bug report, please make sure you have included: 1. Steps to reproduce the problem 2. Expected behaviour vs actual behaviour 3. A minimal code snippet or configuration that triggers the issue Check out our README at https://github.com/FlowElement-ai/m_flow for additional guidance. A maintainer will follow up as soon as possible.
  > ## Bug Description m_flow cannot be installed remotely. The installation/download step fails before the project can start normally.  ## Environment - OS: Windows 11 - Python: 13.13.12 - Docker: - Network: - m_flow version / commit: 0.3.1  ## Steps to Reproduce 1. Run:    ```bash pip install m_flow  2.error:   - ERROR: Could not find a version that satisfies the requirement m_flow (from versions: none)   - ERROR: No matching distribution found for m_flow
  > Hi @zSergeant, thanks for reporting this!  The package has now been published to PyPI under the name **`mflow-ai`**. You can install it with:  ```bash pip install mflow-ai ```  After installation, the import remains the same:  ```python import m_flow ```  The README has been updated to reflect the correct install command. Sorry for the confusion — the previous `pip install m_flow` instruction was incorrect as the package had not yet been published at that time.  Let us know if you run into any other issues! 

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

### Incident Patch 1: `0d585cda` (2026-08-03)
**Commit Message**: fix: update all repository references after migration to FlowElement-xinliuyuansu org

- Point GitHub URLs from FlowElement-ai/{m_flow,mflow-benchmarks} to FlowElement-xinliuyuansu
- Migrate fanjing-face-recognition references to the new org
- Fix UI runtime asset download URL (was non-existent m-flow-project/m_flow)
- Fix DCO workflow ORG constant to the real organization
- Correct Helm backend image path to Docker Hub m_flow/m_flow
- Sync CLI docs-url unit test assertion

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `.github/ISSUE_TEMPLATE/config.yml` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ blank_issues_enabled: false
 
 contact_links:
   - name: "📖 Documentation"
-    url: "https://github.com/FlowElement-ai/m_flow#quick-start"
+    url: "https://github.com/FlowElement-xinliuyuansu/m_flow#quick-start"
     about: >-
       Browse the M-flow documentation for setup guides,
       API references, and architecture overviews.
```

**File**: `.github/ISSUE_TEMPLATE/documentation.yml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ body:
     attributes:
       label: Page URL or file path
       description: "Link to the affected file path in this repo or on GitHub."
-      placeholder: "https://github.com/FlowElement-ai/m_flow#quick-start"
+      placeholder: "https://github.com/FlowElement-xinliuyuansu/m_flow#quick-start"
     validations:
       required: true
 
```

**File**: `.github/release-drafter.yml` (modified, +1/-1)
```diff
@@ -35,4 +35,4 @@ template: |
 
   $CHANGES
 
-  **Full Changelog**: https://github.com/FlowElement-ai/m_flow/compare/$PREVIOUS_TAG...v$RESOLVED_VERSION
+  **Full Changelog**: https://github.com/FlowElement-xinliuyuansu/m_flow/compare/$PREVIOUS_TAG...v$RESOLVED_VERSION
```

**File**: `.github/workflows/approve_dco.yaml` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ jobs:
         with:
           github-token: ${{ secrets.GITHUB_TOKEN }}
           script: |
-            const ORG = 'FlowElement-ai';
+            const ORG = 'FlowElement-xinliuyuansu';
             const author = context.payload.pull_request.user.login;
             const body   = context.payload.pull_request.body ?? '';
 
```

**File**: `.github/workflows/community_greetings.yml` (modified, +2/-2)
```diff
@@ -32,7 +32,7 @@ jobs:
             Thank you for opening this pull request.
             A core maintainer will review your changes shortly.
             In the meantime, please make sure you've read our
-            [Contributing Guide](https://github.com/FlowElement-ai/m_flow/blob/main/CONTRIBUTING.md).
+            [Contributing Guide](https://github.com/FlowElement-xinliuyuansu/m_flow/blob/main/CONTRIBUTING.md).
           issue-message: >
             Hi @${{ github.actor }}, thanks for taking the time to open an issue!
 
@@ -41,5 +41,5 @@ jobs:
             2. Expected behaviour vs actual behaviour
             3. A minimal code snippet or configuration that triggers the issue
 
-            Check out our README at https://github.com/FlowElement-ai/m_flow for additional guidance.
+            Check out our README at https://github.com/FlowElement-xinliuyuansu/m_flow for additional guidance.
             A maintainer will follow up as soon as possible.
```

---

### Incident Patch 2: `f56429d0` (2026-05-01)
**Commit Message**: chore: modernize a handful of Python idioms (ruff FURB/RUF autofixes) (#132)

Pure, auto-applied ruff fixes; semantics identical in every case.

- RUF019 (m_flow/adapters/graph/kuzu/adapter.py):
  `if "properties" in data and data["properties"]` → `if data.get("properties")`
- FURB188 × 2 (get_datasets_router.py, get_playground_router.py):
  `if s.startswith(p): s = s[len(p):]` → `s = s.removeprefix(p)`
  (Python 3.9+; repo requires >=3.10)
- FURB122 (api/v1/ui/ui.py):
  `for chunk in iter: f.write(chunk)` → `f.writelines(iter)`
  (file.writelines on binary stream just writes each bytes object,
  no separator)
- FURB105 (eval/__main__.py):
  `print("")` → `print()`
- FURB136 (llm/utils.py):
  `a if a <= b else b` → `min(a, b)`

ruff --select FURB188,FURB136,FURB105,FURB122,RUF019 is now clean.

**File**: `m_flow/adapters/graph/kuzu/adapter.py` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ def _merge_node_props(data: Dict[str, Any]) -> Dict[str, Any]:
     col_created_at = data.pop("created_at", None)
     col_updated_at = data.pop("updated_at", None)
 
-    if "properties" in data and data["properties"]:
+    if data.get("properties"):
         try:
             nested = json.loads(data["properties"])
             del data["properties"]
```

**File**: `m_flow/api/v1/datasets/routers/get_datasets_router.py` (modified, +1/-2)
```diff
@@ -501,8 +501,7 @@ async def download_raw_data(
             raise DataNotFoundError(message=f"Data ({data_id}) not found in dataset ({dataset_id}).")
 
         raw_loc = data_obj.processed_path or ""
-        if raw_loc.startswith("file://"):
-            raw_loc = raw_loc[len("file://") :]
+        raw_loc = raw_loc.removeprefix("file://")
         if not raw_loc or not os.path.exists(raw_loc):
             return JSONResponse(
                 status_code=404,
```

**File**: `m_flow/api/v1/playground/routers/get_playground_router.py` (modified, +1/-2)
```diff
@@ -197,8 +197,7 @@ async def _prepare_chat_context(req: ChatRequest, user: User):
             user_id=str(user.id),
             session_id=req.session_id,
         )
-        if resolved_query.startswith(f"[{speaker_label}] "):
-            resolved_query = resolved_query[len(f"[{speaker_label}] ") :]
+        resolved_query = resolved_query.removeprefix(f"[{speaker_label}] ")
         t3 = _t.perf_counter()
 
         session.add_message("user", req.message, speaker_face_id=req.speaker_face_id)
```

**File**: `m_flow/api/v1/ui/ui.py` (modified, +1/-2)
```diff
@@ -146,8 +146,7 @@ def download_frontend_assets(force: bool = False) -> bool:
             resp = requests.get(url, stream=True, timeout=60)
             resp.raise_for_status()
             with open(archive, "wb") as f:
-                for chunk in resp.iter_content(8192):
-                    f.write(chunk)
+                f.writelines(resp.iter_content(8192))
 
             shutil.rmtree(frontend, ignore_errors=True)
             extract = Path(tmp) / "extracted"
```

**File**: `m_flow/eval/__main__.py` (modified, +1/-1)
```diff
@@ -87,7 +87,7 @@ async def main_async(args):
         progress_callback=progress_callback if not args.quiet else None,
     )
 
-    print("")  # Newline
+    print()  # Newline
 
     # Load baseline (if comparison needed)
     baseline = None
```

---

### Incident Patch 3: `1d6f30bf` (2026-05-01)
**Commit Message**: fix: replace deprecated datetime.utcnow() with timezone-aware equivalent (#129)

datetime.utcnow() is deprecated as of Python 3.12 and will be removed
in a future release. It returns a naive datetime that silently drops
timezone info, which is a common source of subtle bugs.

This replaces the 5 remaining occurrences in the runtime codebase with
`datetime.now(timezone.utc).replace(tzinfo=None)`, which:
- Is not deprecated
- Produces a byte-identical ISO 8601 string (wire-format preserving)
- Keeps the same naive-UTC semantics the surrounding code relies on
  (SQLite columns, JSON logs, Redis/diskcache session records, Kuzu
  edge properties)

No behavior change; silences DeprecationWarning on Py3.12+.

**File**: `m_flow/adapters/cache/fscache/FsCacheAdapter.py` (modified, +2/-2)
```diff
@@ -9,7 +9,7 @@
 
 import json
 import os
-from datetime import datetime
+from datetime import datetime, timezone
 
 import diskcache as dc
 
@@ -65,7 +65,7 @@ async def add_qa(
             key = f"agent_sessions:{user_id}:{session_id}"
 
             entry = {
-                "time": datetime.utcnow().isoformat(),
+                "time": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                 "question": question,
                 "context": context,
                 "answer": answer,
```

**File**: `m_flow/adapters/cache/redis/RedisAdapter.py` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@
 
 import json
 from contextlib import contextmanager
-from datetime import datetime
+from datetime import datetime, timezone
 from typing import Any
 
 import redis
@@ -137,7 +137,7 @@ async def add_qa(
             key = f"agent_sessions:{user_id}:{session_id}"
 
             entry = {
-                "time": datetime.utcnow().isoformat(),
+                "time": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                 "question": question,
                 "context": context,
                 "answer": answer,
```

**File**: `m_flow/api/v1/learn/learn.py` (modified, +2/-2)
```diff
@@ -14,7 +14,7 @@
 
 from typing import Union, Optional, List, Dict, Any
 from uuid import UUID, uuid4
-from datetime import datetime
+from datetime import datetime, timezone
 
 from m_flow.shared.logging_utils import get_logger
 from m_flow.auth.models import User
@@ -327,7 +327,7 @@ async def _create_derived_procedure_edges(
                         "derived_procedure",
                         {
                             "edge_text": f"Episode '{episode.name}' derived into Procedure '{proc.name}'",
-                            "created_at": datetime.utcnow().isoformat(),
+                            "created_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
                         },
                     )
                     edges_created += 1
```

**File**: `m_flow/memory/episodic/episode_size_check.py` (modified, +2/-2)
```diff
@@ -29,7 +29,7 @@
 import json
 import uuid
 from dataclasses import dataclass
-from datetime import datetime
+from datetime import datetime, timezone
 from pathlib import Path
 from typing import Any, Dict, List, Optional, Tuple, TYPE_CHECKING
 
@@ -681,7 +681,7 @@ async def execute_split(
     # 4. Log split history (outside transaction, non-blocking)
     try:
         history_entry = SplitHistoryEntry(
-            timestamp=datetime.utcnow(),
+            timestamp=datetime.now(timezone.utc).replace(tzinfo=None),
             original_episode_id=original_episode_id,
             original_episode_name=original_episode.get("name", ""),
             original_facet_count=len(facets),
```

**File**: `m_flow/storage/episode_metadata.py` (modified, +7/-2)
```diff
@@ -17,7 +17,7 @@
 
 import sqlite3
 import threading
-from datetime import datetime
+from datetime import datetime, timezone
 from pathlib import Path
 from typing import Optional
 
@@ -159,7 +159,12 @@ def set_adapted_threshold(episode_id: str, threshold: int) -> bool:
             (episode_id, adapted_threshold, last_check_time, check_count)
             VALUES (?, ?, ?, ?)
             """,
-            (episode_id, threshold, datetime.utcnow().isoformat(), current_count + 1),
+            (
+                episode_id,
+                threshold,
+                datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
+                current_count + 1,
+            ),
         )
         conn.commit()
 
```

---

### Incident Patch 4: `f0c85024` (2026-05-01)
**Commit Message**: fix(api): redact settings response keys (#128)

Signed-off-by: Alexazhu <alexazzjjtt@163.com>

**File**: `m_flow/api/v1/settings/routers/get_settings_router.py` (modified, +23/-15)
```diff
@@ -12,10 +12,8 @@
 from fastapi import APIRouter, Depends
 from pydantic import Field
 
-from m_flow.api.DTO import InDTO, OutDTO
-from m_flow.llm.config import LLMConfig
-from m_flow.adapters.vector.config import VectorConfig
 from m_flow.adapters.vector.embeddings.config import EmbeddingConfig
+from m_flow.api.DTO import InDTO, OutDTO
 
 if TYPE_CHECKING:
     from m_flow.auth.models import User
@@ -26,16 +24,22 @@
 # ---------------------------------------------------------------------------
 
 
-class LLMSettingsOut(OutDTO, LLMConfig):
-    """LLM configuration output wrapper."""
+class LLMSettingsOut(OutDTO):
+    """Public LLM configuration output wrapper."""
 
-    pass
+    llm_provider: str
+    llm_model: str
+    llm_endpoint: Optional[str] = None
+    llm_api_version: Optional[str] = None
+    llm_api_key: str = ""
 
 
-class VectorDBSettingsOut(OutDTO, VectorConfig):
-    """Vector database configuration output wrapper."""
+class VectorDBSettingsOut(OutDTO):
+    """Public vector database configuration output wrapper."""
 
-    pass
+    vector_db_provider: str
+    vector_db_url: str
+    vector_db_key: str = ""
 
 
 class EmbeddingSettingsOut(OutDTO):
@@ -148,14 +152,18 @@ async def retrieve_settings(user: "User" = Depends(_auth())):
             embedding_endpoint=emb_cfg.embedding_endpoint,
         )
 
-        # Convert Pydantic models to dicts for compatibility
-        llm_dict = base_settings.llm.model_dump()
-        vector_dict = base_settings.vector_db.model_dump()
-
         return SystemSettingsOut(
-            llm=LLMSettingsOut(**{k: v for k, v in llm_dict.items() if k in LLMSettingsOut.model_fields}),
+            llm=LLMSettingsOut(
+                llm_provider=base_settings.llm.provider,
+                llm_model=base_settings.llm.model,
+                llm_endpoint=base_settings.llm.endpoint,
+                llm_api_version=base_settings.llm.api_version,
+                llm_api_key=base_settings.llm.api_key,
+            ),
             vector_db=VectorDBSettingsOut(
-                **{k: v for k, v in vector_dict.items() if k in VectorDBSettingsOut.model_fields}
+                vector_db_provider=base_settings.vector_db.provider,
+                vector_db_url=base_settings.vector_db.url,
+                vector_db_key=base_settings.vector_db.api_key,
             ),
             embedding=embedding_out,
         )
```

**File**: `m_flow/tests/unit/api/test_settings_router_response_contract.py` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+"""Regression tests for the settings API response contract."""
+
+from __future__ import annotations
+
+from types import SimpleNamespace
+from uuid import uuid4
+
+from fastapi.testclient import TestClient
+
+
+def test_settings_response_masks_api_keys_and_omits_internal_fields(monkeypatch):
+    """GET /api/v1/settings should expose only the public, redacted contract."""
+    llm_key = "test-llm-key-1234567890"
+    vector_key = "test-vector-key-1234567890"
+    baml_key = "test-baml-key-1234567890"
+    fallback_key = "test-fallback-key-1234567890"
+
+    monkeypatch.setenv("MFLOW_LLM_PROVIDER", "anthropic")
+    monkeypatch.setenv("MFLOW_LLM_MODEL", "claude-haiku-4-5")
+    monkeypatch.setenv("MFLOW_LLM_API_KEY", llm_key)
+    monkeypatch.setenv("MFLOW_BAML_LLM_API_KEY", baml_key)
+    monkeypatch.setenv("MFLOW_FALLBACK_API_KEY", fallback_key)
+    monkeypatch.setenv("MFLOW_VECTOR_DB_PROVIDER", "lancedb")
+    monkeypatch.setenv("MFLOW_VECTOR_DB_URL", "/tmp/mflow-test-settings.lancedb")
+    monkeypatch.setenv("MFLOW_VECTOR_DB_KEY", vector_key)
+
+    from m_flow.adapters.vector.config import get_vectordb_config
+    from m_flow.api.client import app
+    from m_flow.auth.methods import get_authenticated_user
+    from m_flow.llm.config import get_llm_config
+
+    get_llm_config.cache_clear()
+    get_vectordb_config.cache_clear()
+
+    async def mock_auth():
+        return SimpleNamespace(id=uuid4(), email="settings@test.local", is_active=True, tenant_id=uuid4())
+
+    app.dependency_overrides[get_authenticated_user] = mock_auth
+    try:
+        response = TestClient(app).get("/api/v1/settings")
+    finally:
+        app.dependency_overrides.clear()
+        get_llm_config.cache_clear()
+        get_vectordb_config.cache_clear()
+
+    assert response.status_code == 200, response.text
+    payload = response.json()
+
+    assert payload["llm"]["llmProvider"] == "anthropic"
+    assert payload["llm"]["llmModel"] == "claude-haiku-4-5"
+    assert payload["llm"]["llmApiKey"] != llm_key
+    assert payload["llm"]["llmApiKey"].startswith(llm_key[:10])
+    assert set(payload["llm"]) == {
+        "llmProvider",
+        "llmModel",
+        "llmEndpoint",
+        "llmApiVersion",
+        "llmApiKey",
+    }
+
+    assert payload["vectorDb"]["vectorDbProvider"] == "lancedb"
+    assert payload["vectorDb"]["vectorDbUrl"] == "/tmp/mflow-test-settings.lancedb"
+    assert payload["vectorDb"]["vectorDbKey"] != vector_key
+    assert payload["vectorDb"]["vectorDbKey"].startswith(vector_key[:10])
+    assert set(payload["vectorDb"]) == {
+        "vectorDbProvider",
+        "vectorDbUrl",
+        "vectorDbKey",
+    }
+
+    assert "bamlLlmApiKey" not in payload["llm"]
+    assert "fallbackApiKey" not in payload["llm"]
```

---

### Incident Patch 5: `2a01f7f3` (2026-05-01)
**Commit Message**: fix(api): emit single Z-suffix UTC timestamps to avoid pydantic +00:00Z (#116) (#124)

The codebase had eight call sites all using the idiom
``dt.isoformat() + "Z"`` to mark a datetime as UTC for the frontend.
That works for timezone-naive datetimes (the common in-memory case), but
when the underlying SQLAlchemy column is ``DateTime(timezone=True)`` —
which it is on Postgres deployments — SQLAlchemy returns a
timezone-aware datetime. ``isoformat()`` already emits ``+00:00`` for
those, and the appended ``"Z"`` produces a malformed
``"…+00:00Z"`` double-marker string. Pydantic then rejects it with
``datetime_from_date_parsing``, taking the entire endpoint down with
HTTP 500. Issue #116 reproduced this on
``GET /api/v1/activity?limit=5`` against a Postgres-backed deployment.

Fix

---

* Add ``m_flow.shared.utils.to_iso_z(dt)`` that:
  - returns ``None`` for ``None`` (passthrough),
  - keeps the legacy ``isoformat() + "Z"`` shape for naive datetimes
    (so the wire format the frontend already parses is unchanged), and
  - converts aware datetimes to UTC and emits a single ``Z`` instead of
    ``+00:00`` (so any input — UTC, +08:00, -05:00 — round-trips through
    pydantic).
* Replac

**File**: `m_flow/api/v1/sync/routers/get_sync_router.py` (modified, +3/-3)
```diff
@@ -20,7 +20,7 @@
 from m_flow.auth.permissions.methods import get_specific_user_permission_datasets
 from m_flow.shared.logging_utils import get_logger
 from m_flow.shared.sync.methods import get_running_sync_operations_for_user
-from m_flow.shared.utils import send_telemetry
+from m_flow.shared.utils import send_telemetry, to_iso_z
 
 _log = get_logger()
 
@@ -73,7 +73,7 @@ async def sync_to_cloud(
                             "dataset_ids": active.dataset_ids,
                             "dataset_names": active.dataset_names,
                             "progress_percentage": active.progress_percentage,
-                            "timestamp": active.created_at.isoformat() + "Z" if active.created_at else None,
+                            "timestamp": to_iso_z(active.created_at),
                             "message": f"Active sync: {active.run_id}. Wait for completion.",
                         },
                     },
@@ -131,7 +131,7 @@ async def get_sync_status_overview(
                     "dataset_ids": latest.dataset_ids,
                     "dataset_names": latest.dataset_names,
                     "progress_percentage": latest.progress_percentage,
-                    "created_at": latest.created_at.isoformat() + "Z" if latest.created_at else None,
+                    "created_at": to_iso_z(latest.created_at),
                 }
             return resp
 
```

**File**: `m_flow/data/methods/get_recent_activities.py` (modified, +6/-2)
```diff
@@ -15,6 +15,7 @@
 from sqlalchemy import select, union_all, desc, literal, cast, String
 
 from m_flow.adapters.relational import get_db_adapter
+from m_flow.shared.utils import to_iso_z
 
 
 async def get_recent_activities(
@@ -88,8 +89,11 @@ async def get_recent_activities(
                 "title": _format_title(row.type, row.title),
                 "description": _format_description(row.type, row.description),
                 "status": _map_status(row.type, row.description),
-                # Ensure UTC timezone is included for correct frontend parsing
-                "created_at": row.created_at.isoformat() + "Z" if row.created_at else None,
+                # Ensure UTC timezone is included for correct frontend parsing.
+                # Uses ``to_iso_z`` so timezone-aware values from Postgres
+                # (``timestamp with time zone``) do not produce ``+00:00Z``
+                # double markers that pydantic rejects (issue #116).
+                "created_at": to_iso_z(row.created_at),
             }
             for row in rows
         ]
```

**File**: `m_flow/data/models/Data.py` (modified, +6/-3)
```diff
@@ -19,6 +19,7 @@
 from sqlalchemy.orm import relationship
 
 from m_flow.adapters.relational import Base
+from m_flow.shared.utils import to_iso_z
 
 from .DatasetEntry import DatasetEntry
 
@@ -142,9 +143,11 @@ def to_json(self) -> Dict[str, Any]:
             "extension": self.extension,
             "mimeType": self.mime_type,
             "rawDataLocation": self.processed_path,
-            # Add Z suffix to indicate UTC timezone for correct frontend parsing
-            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
-            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
+            # Use ``to_iso_z`` to emit a single ``Z`` suffix that is well-formed
+            # whether the column stored a naive or timezone-aware datetime
+            # (issue #116: ``+ "Z"`` produced ``+00:00Z`` on Postgres).
+            "createdAt": to_iso_z(self.created_at),
+            "updatedAt": to_iso_z(self.updated_at),
             "nodeSet": self.graph_scope,
             "dataSize": self.data_size,
             "tokenCount": self.token_count,
```

**File**: `m_flow/data/models/Dataset.py` (modified, +6/-3)
```diff
@@ -17,6 +17,7 @@
 from sqlalchemy.orm import relationship
 
 from m_flow.adapters.relational import Base
+from m_flow.shared.utils import to_iso_z
 
 from .DatasetEntry import DatasetEntry
 
@@ -98,9 +99,11 @@ def to_json(self) -> Dict[str, Any]:
         return {
             "id": str(self.id),
             "name": self.name,
-            # Add Z suffix to indicate UTC timezone for correct frontend parsing
-            "createdAt": self.created_at.isoformat() + "Z" if self.created_at else None,
-            "updatedAt": self.updated_at.isoformat() + "Z" if self.updated_at else None,
+            # Use ``to_iso_z`` to emit a single ``Z`` suffix that is well-formed
+            # whether the column stored a naive or timezone-aware datetime
+            # (issue #116: ``+ "Z"`` produced ``+00:00Z`` on Postgres).
+            "createdAt": to_iso_z(self.created_at),
+            "updatedAt": to_iso_z(self.updated_at),
             "ownerId": str(self.owner_id),
             "tenantId": str(self.tenant_id) if self.tenant_id else None,
             "data": [item.to_json() for item in self.data],
```

**File**: `m_flow/pipeline/methods/get_active_pipeline_runs.py` (modified, +2/-1)
```diff
@@ -15,6 +15,7 @@
 from m_flow.adapters.relational import get_db_adapter
 from m_flow.data.models import Dataset
 from m_flow.pipeline.models import WorkflowRun, RunStatus
+from m_flow.shared.utils import to_iso_z
 
 
 async def get_active_pipeline_runs() -> List[Dict[str, Any]]:
@@ -110,7 +111,7 @@ async def get_active_pipeline_runs() -> List[Dict[str, Any]]:
                 "current_step": progress.get("current_step"),
                 "started_at": progress.get("started_at"),
                 "updated_at": progress.get("updated_at"),
-                "created_at": row.created_at.isoformat() + "Z" if row.created_at else None,
+                "created_at": to_iso_z(row.created_at),
             }
         )
 
```

---

### Incident Patch 6: `b73e0fcd` (2026-04-20)
**Commit Message**: fix(mcp): make `query` and `prune` work in remote / API mode (#112) (#115)

When the MCP server runs with `--api-url` (the recommended Docker
production topology), three tools historically raised NotImplementedError
and asked the user to fall back to in-process direct mode — which defeats
the purpose of running M-flow as a separate API service.

This change wires each remote-mode call to a real backend endpoint:

* `MflowClient.query()`        → `POST /api/v1/search/query`
* `MflowClient.prune_data()`   → `POST /api/v1/prune/data`
* `MflowClient.prune_system()` → `POST /api/v1/prune/system`

Backend
-------
The two prune endpoints already existed with full security (FastAPI-Users
superuser auth, confirmation strings DELETE_FILES / DELETE_SYSTEM,
active-pipeline check, distributed Redis lock, cooldown, master switch
MFLOW_ENABLE_PRUNE_API). No backend changes were needed for prune.

For `query`, this PR adds a thin new endpoint
`POST /api/v1/search/query` (in get_search_router.py) that wraps the
existing in-process `m_flow.api.v1.search.search.query()` helper. The
endpoint runs under the authenticated user's session context so dataset
visibility and permission filtering match the ex

**File**: `m_flow-mcp/CHANGELOG.md` (modified, +33/-0)
```diff
@@ -15,6 +15,19 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   (expired LLM key, locked graph DB, malformed input, etc.) was only logged
   server-side. The MCP caller never learned about it, producing a silent
   data-loss scenario.
+- **`query` and `prune` unavailable in remote / API mode (#112).** When the
+  MCP server ran with `--api-url` (the recommended Docker production
+  topology), three tools raised `NotImplementedError` and asked the user
+  to fall back to in-process direct mode, which defeats the purpose of the
+  API architecture. They now call real backend endpoints:
+  - `query()` → `POST /api/v1/search/query` (new endpoint, see *Added*).
+  - `prune_data()` → `POST /api/v1/prune/data`.
+  - `prune_system()` → `POST /api/v1/prune/system`.
+
+  The two prune endpoints already existed with full security (superuser
+  auth, confirmation strings, active-pipeline check, distributed lock,
+  cooldown, master switch) and required no backend changes — the fix was
+  simply to wire the MCP client to call them.
 
 ### Added
 
@@ -34,6 +47,26 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - 11 new unit tests in `test_server_task_tracking.py` covering success,
   failure, status lookup, sync mode (success / error / timeout), and LRU
   eviction.
+- New backend endpoint **`POST /api/v1/search/query`** (in
+  `m_flow/api/v1/search/routers/get_search_router.py`) that wraps the
+  existing in-process `m_flow.api.v1.search.search.query()` helper so the
+  simplified question / mode / top_k contract is reachable over HTTP.
+  Authentication and dataset-visibility rules match the existing
+  `POST /api/v1/search` endpoint.
+- 8 new client tests in `test_m_flow_client_remote_query_prune.py`
+  covering remote-mode `query()`, `prune_data()`, `prune_system()` URL,
+  payload, auth header, and error propagation.
+- 5 new structural tests in
+  `m_flow/tests/unit/api/test_search_simplification.py` confirming the
+  new `/query` endpoint, its DTOs, delegation to the existing helper,
+  and authentication enforcement.
+
+### Changed
+
+- The `prune` and `query` MCP tools now surface backend HTTP error codes
+  (`403` "API disabled", `401` "no superuser token", `409` "active
+  pipelines", `429` "cooldown") with actionable hints, replacing the
+  previous "use direct mode" message which was no longer accurate.
 
 ## [0.6.0] - 2026-03-19
 
```

**File**: `m_flow-mcp/src/m_flow_client.py` (modified, +67/-10)
```diff
@@ -221,16 +221,32 @@ async def delete(
             return await self._engine.delete(data_id=data_id, dataset_id=dataset_id, mode=mode, user=current_user)
 
     async def prune_data(self) -> Dict[str, Any]:
-        """Wipe all user data from the knowledge graph.
+        """Wipe stored file artefacts from the knowledge graph backend.
+
+        In **remote** mode this calls the existing
+        ``POST /api/v1/prune/data`` admin endpoint, which requires:
+
+        * superuser authentication (via ``auth_token``);
+        * the server-side ``MFLOW_ENABLE_PRUNE_API=true`` master switch;
+        * a confirmation string the client supplies on the caller's behalf;
+        * no active pipelines (HTTP 409 if any are running);
+        * a cooldown period since the previous prune (HTTP 429 otherwise).
 
         Returns:
-            Prune outcome.
+            Prune outcome dictionary.
 
         Raises:
-            NotImplementedError: When running in remote mode (no API endpoint).
+            httpx.HTTPStatusError: For any non-2xx response from the API.
         """
         if self._remote:
-            raise NotImplementedError("Data pruning is unavailable in remote mode")
+            url = f"{self._base_url}/api/v1/prune/data"
+            resp = await self._http.post(
+                url,
+                json={"confirm": "DELETE_FILES"},
+                headers=self._auth_headers(),
+            )
+            resp.raise_for_status()
+            return resp.json()
 
         with redirect_stdout(sys.stderr):
             await self._engine.prune.prune_data()
@@ -245,20 +261,38 @@ async def prune_system(
     ) -> Dict[str, Any]:
         """Wipe system-level stores (graph DB, vectors, metadata, cache).
 
+        In **remote** mode this calls ``POST /api/v1/prune/system`` with the
+        same security constraints as :meth:`prune_data` (superuser,
+        ``MFLOW_ENABLE_PRUNE_API``, confirmation string, no-active-pipeline,
+        cooldown).
+
         Args:
             graph: Clear graph database.
             vector: Clear vector indices.
             metadata: Clear relational metadata.
             cache: Clear ephemeral cache.
 
         Returns:
-            Prune outcome.
+            Prune outcome dictionary.
 
         Raises:
-            NotImplementedError: When running in remote mode.
+            httpx.HTTPStatusError: For any non-2xx response from the API.
         """
         if self._remote:
-            raise NotImplementedError("System pruning is unavailable in remote mode")
+            url = f"{self._base_url}/api/v1/prune/system"
+            resp = await self._http.post(
+                url,
+                json={
+                    "confirm": "DELETE_SYSTEM",
+                    "graph": graph,
+                    "vector": vector,
+                    "metadata": metadata,
+                    "cache": cache,
+                },
+                headers=self._auth_headers(),
+            )
+            resp.raise_for_status()
+            return resp.json()
 
         with redirect_stdout(sys.stderr):
             await self._engine.prune.prune_system(graph=graph, vector=vector, metadata=metadata, cache=cache)
@@ -469,20 +503,43 @@ async def query(
     ) -> str:
         """High-level natural-language question interface.
 
+        In **remote** mode this calls ``POST /api/v1/search/query``, which
+        wraps the same in-process ``m_flow.api.v1.search.search.query()``
+        helper used by direct mode under the authenticated user's session.
+
         Args:
             question: Free-form question.
             datasets: Restrict to these datasets.
             mode: Retrieval strategy (episodic / triplet / chunks / procedural / cypher).
             top_k: Result count cap.
 
         Returns:
-            Answer string.
+            Answer string. For triplet mode the LLM-generated ``answer`` is
+            returned; otherwise the retrieved ``context`` is rendered as a

```

**File**: `m_flow-mcp/src/server.py` (modified, +29/-5)
```diff
@@ -24,6 +24,7 @@
 from typing import TYPE_CHECKING, Any, Awaitable, Callable, Dict, Optional
 from uuid import uuid4
 
+import httpx
 import mcp.types as types
 import uvicorn
 from mcp.server import FastMCP
@@ -713,8 +714,27 @@ async def prune(
                 cleared.append("缓存")
 
             return [types.TextContent(type="text", text=f"✅ 已清除: {', '.join(cleared) if cleared else '无'}")]
-        except NotImplementedError:
-            msg = "❌ API 模式不支持 prune 操作，请使用直接模式运行 MCP 服务器"
+        except httpx.HTTPStatusError as http_err:
+            # In API mode the prune endpoint enforces several admin guards
+            # (master-switch flag, superuser auth, active-pipeline check,
+            # cooldown). Surface the server's status code so the caller can
+            # distinguish "feature disabled" from "permission denied" from
+            # "in-flight pipelines blocking" and react appropriately.
+            status_code = http_err.response.status_code
+            try:
+                detail = http_err.response.json().get("detail", str(http_err))
+            except Exception:
+                detail = http_err.response.text or str(http_err)
+            hint_map = {
+                403: "API 模式下 prune 默认关闭。请在 backend 设置 MFLOW_ENABLE_PRUNE_API=true 并以 superuser 身份调用。",
+                401: "未授权：API 模式下 prune 必须携带 superuser 的 auth token。",
+                409: "当前有 pipeline 正在运行，无法执行 prune。",
+                429: "未到 cooldown 间隔，请稍后再试。",
+            }
+            hint = hint_map.get(status_code, "")
+            msg = f"❌ 清空失败 (HTTP {status_code}): {detail}"
+            if hint:
+                msg += f"\n💡 {hint}"
             _log.error(msg)
             return [types.TextContent(type="text", text=msg)]
         except Exception as e:
@@ -997,9 +1017,13 @@ async def query(
 
             _log.info("查询完成")
             return [types.TextContent(type="text", text=answer)]
-        except NotImplementedError as e:
-            msg = f"⚠️ {str(e)}\n请使用直接模式运行 MCP 服务器"
-            _log.warning(msg)
+        except httpx.HTTPStatusError as http_err:
+            try:
+                detail = http_err.response.json().get("error", str(http_err))
+            except Exception:
+                detail = http_err.response.text or str(http_err)
+            msg = f"❌ 查询失败 (HTTP {http_err.response.status_code}): {detail}"
+            _log.error(msg)
             return [types.TextContent(type="text", text=msg)]
         except Exception as e:
             _log.error("查询失败: %s", e)
```

**File**: `m_flow-mcp/src/test_m_flow_client_remote_query_prune.py` (added, +218/-0)
```diff
@@ -0,0 +1,218 @@
+"""Tests for remote-mode `query()` and `prune_*()` (issue #112).
+
+In remote / API mode the MCP client previously raised NotImplementedError for
+these operations. With the fix in place each call now forwards to a real
+backend endpoint:
+
+* ``MflowClient.query()``        -> ``POST /api/v1/search/query``
+* ``MflowClient.prune_data()``   -> ``POST /api/v1/prune/data``
+* ``MflowClient.prune_system()`` -> ``POST /api/v1/prune/system``
+
+These tests stub the underlying ``httpx.AsyncClient`` so we can verify the
+correct URL, payload, auth header, and response handling without exercising
+the live FastAPI service.
+"""
+
+from __future__ import annotations
+
+import asyncio
+import os
+import sys
+from typing import Any
+
+import httpx
+import pytest
+
+sys.path.insert(0, os.path.dirname(__file__))
+
+from m_flow_client import MflowClient  # noqa: E402  -- after sys.path tweak
+
+
+# ---------------------------------------------------------------------------
+# Stub HTTP layer
+# ---------------------------------------------------------------------------
+
+
+class _StubResponse:
+    """Minimal stand-in for httpx.Response."""
+
+    def __init__(self, status_code: int = 200, payload: Any | None = None, text: str = "") -> None:
+        self.status_code = status_code
+        self._payload = payload if payload is not None else {}
+        self.text = text
+
+    def raise_for_status(self) -> None:
+        if 400 <= self.status_code:
+            raise httpx.HTTPStatusError(
+                f"{self.status_code}",
+                request=httpx.Request("POST", "https://example.com"),
+                response=self,  # type: ignore[arg-type]
+            )
+
+    def json(self) -> Any:
+        return self._payload
+
+
+class _StubHTTP:
+    """Recording stub for ``httpx.AsyncClient`` used by remote-mode calls."""
+
+    def __init__(self, *responses: _StubResponse) -> None:
+        # Allow either a single response (used for every call) or a queue of
+        # responses (popped in order). Defaults to a 200/{} reply.
+        if not responses:
+            responses = (_StubResponse(),)
+        self._responses = list(responses)
+        self.calls: list[tuple[str, str, dict[str, Any], dict[str, str]]] = []
+
+    async def post(self, url: str, json: dict[str, Any], headers: dict[str, str]) -> _StubResponse:
+        self.calls.append(("POST", url, json, headers))
+        return self._responses.pop(0) if len(self._responses) > 1 else self._responses[0]
+
+
+def _make_remote_client(token: str = "admin-token") -> MflowClient:
+    client = MflowClient(server_url="https://api.example.com", auth_token=token)
+    return client
+
+
+# ---------------------------------------------------------------------------
+# query() — remote happy paths
+# ---------------------------------------------------------------------------
+
+
+def test_remote_query_posts_simplified_payload_and_returns_answer() -> None:
+    async def run() -> None:
+        client = _make_remote_client()
+        client._http = _StubHTTP(_StubResponse(200, {"answer": "Paris", "context": [], "datasets": ["geo"]}))
+
+        result = await client.query(question="Capital of France?", datasets=["geo"], mode="triplet", top_k=5)
+
+        assert result == "Paris"
+        method, url, payload, headers = client._http.calls[0]
+        assert method == "POST"
+        assert url == "https://api.example.com/api/v1/search/query"
+        assert payload == {
+            "question": "Capital of France?",
+            "mode": "triplet",
+            "top_k": 5,
+            "datasets": ["geo"],
+        }
+        assert headers["Authorization"] == "Bearer admin-token"
+        assert headers["Content-Type"] == "application/json"
+
+    asyncio.run(run())
+
+
+def test_remote_query_returns_context_when_no_answer() -> None:
+    async def run() -> None:
+ 
```

**File**: `m_flow/api/v1/search/routers/get_search_router.py` (modified, +92/-0)
```diff
@@ -131,6 +131,48 @@ class _HistoryEntry(OutDTO):
     created_at: datetime
 
 
+# ---------------------------------------------------------------------------
+# Simplified query DTO (issue #112)
+#
+# Wraps the in-process `m_flow.api.v1.search.search.query()` helper so that
+# remote callers (the MCP server in API mode, third-party clients) can use
+# the same simplified question/mode/top_k contract without having to mint
+# a full SearchPayloadDTO.
+# ---------------------------------------------------------------------------
+
+
+class QueryPayloadDTO(InDTO):
+    """Simplified query request — natural-language question + retrieval mode."""
+
+    question: str = Field(..., description="Natural-language question.")
+    datasets: list[str] | None = Field(
+        default=None,
+        description="Restrict the query to these dataset names. Omit to search all visible datasets.",
+    )
+    mode: str = Field(
+        default="episodic",
+        description="Retrieval mode: episodic | triplet | chunks | procedural | cypher.",
+    )
+    top_k: int = Field(default=10, ge=1, le=100, description="Maximum number of results.")
+
+
+class QueryResponseDTO(OutDTO):
+    """Simplified query response — mirrors `search.QueryResult.to_dict()`."""
+
+    answer: str | None = Field(
+        default=None,
+        description="LLM-generated answer (populated only in triplet mode).",
+    )
+    context: list | dict = Field(
+        default_factory=list,
+        description="Retrieved context (list for episodic/chunks/procedural, dict for triplet).",
+    )
+    datasets: list[str] = Field(
+        default_factory=list,
+        description="Source dataset names that contributed to the result.",
+    )
+
+
 # ---------------------------------------------------------------------------
 # Telemetry Helper
 # ---------------------------------------------------------------------------
@@ -305,4 +347,54 @@ async def execute_search(
         except Exception as err:
             return JSONResponse(status_code=409, content={"error": str(err)})
 
+    @router.post("/query", response_model=QueryResponseDTO)
+    async def execute_query(
+        payload: QueryPayloadDTO,
+        user: "User" = Depends(_auth_dep()),
+    ):
+        """
+        Simplified natural-language query (issue #112).
+
+        Wraps the in-process `m_flow.api.v1.search.search.query()` helper so
+        that the MCP server (and any other remote consumer) can reach the
+        same simplified contract over HTTP. The local function runs under
+        the authenticated user's session context, so dataset visibility and
+        permission filtering match the existing `/api/v1/search` semantics.
+        """
+        from m_flow.api.v1.search.search import query as query_impl
+        from m_flow.auth.exceptions.exceptions import PermissionDeniedError
+
+        _emit_search_telemetry(
+            "Query API Endpoint Invoked",
+            user.id,
+            endpoint="POST /v1/search/query",
+            mode=payload.mode,
+            datasets=payload.datasets,
+            top_k=payload.top_k,
+        )
+
+        # The simplified query helper resolves the seed user internally for
+        # local callers; here we explicitly bind the request user so the
+        # remote path enforces the same access-control boundary as the
+        # existing /api/v1/search endpoint.
+        from m_flow.context_global_variables import set_session_user_context_variable
+
+        set_session_user_context_variable(user)
+
+        try:
+            result = await query_impl(
+                question=payload.question,
+                datasets=payload.datasets,
+                mode=payload.mode,
+                top_k=payload.top_k,
+            )
+            return jsonable_encoder(result.to_dict())
+        except PermissionDeniedError:
+            return JSONResponse(
+                status_code=403,
+                content={"error": "Permission denied for one or more 
```

---

### Incident Patch 7: `71dc2979` (2026-04-20)
**Commit Message**: fix(mcp): surface background-task failures via task registry (#111) (#114)

The MCP `memorize` and `save_interaction` tools were historically
fire-and-forget: they wrapped work in `asyncio.create_task(...)` and
immediately returned a "started" message. If the background coroutine
raised (expired LLM key, locked graph DB, malformed input, etc.), the
failure was only logged server-side and the MCP caller (IDE / agent)
believed the data was memorized when it had actually been dropped — a
silent data-loss scenario.

This change introduces a small bounded in-memory **task registry** in
`m_flow-mcp/src/server.py` and wires both tools through it:

- Each invocation gets a short `task_id` (uuid4 hex prefix).
- The background coroutine is wrapped by `_run_tracked_task`, which
  records `success` or `failed` (with `error_type` / `error_message`)
  into the registry.
- The registry is an `OrderedDict` capped at 100 entries (LRU eviction)
  so it cannot grow unbounded.
- `memorize_status` accepts an optional `task_id` parameter and, when
  provided, returns the recorded outcome instead of pipeline-level
  status. Without `task_id` the historical behaviour is preserved
  (backward compatible).


**File**: `m_flow-mcp/CHANGELOG.md` (modified, +30/-0)
```diff
@@ -5,6 +5,36 @@ All notable changes to the M-flow MCP Server are documented in this file.
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
+## [Unreleased]
+
+### Fixed
+
+- **Silent data loss on background-task failures (#111).** `memorize` and
+  `save_interaction` previously used `asyncio.create_task` and immediately
+  returned a "started" message, so any failure in the background coroutine
+  (expired LLM key, locked graph DB, malformed input, etc.) was only logged
+  server-side. The MCP caller never learned about it, producing a silent
+  data-loss scenario.
+
+### Added
+
+- Module-level **task registry** (bounded LRU, default 100 records) that
+  captures each background task's `state` (`running`/`success`/`failed`),
+  timestamps, dataset, error type, and error message.
+- `memorize` and `save_interaction` now return a **`task_id`** in the
+  response payload that callers can use to poll the outcome.
+- `memorize_status` now accepts an optional **`task_id`** argument and, when
+  provided, returns the recorded task outcome instead of pipeline-level
+  status. Without `task_id` the historical pipeline-level behaviour is
+  preserved (backward compatible).
+- `memorize` and `save_interaction` accept a new **`wait: bool = False`**
+  parameter; when `True` the tool synchronously awaits the background task
+  (with a configurable 600 s timeout) and returns the actual outcome inline,
+  which is useful for CI / scripting flows that need a definitive result.
+- 11 new unit tests in `test_server_task_tracking.py` covering success,
+  failure, status lookup, sync mode (success / error / timeout), and LRU
+  eviction.
+
 ## [0.6.0] - 2026-03-19
 
 ### Added
```

**File**: `m_flow-mcp/src/__init__.py` (modified, +6/-3)
```diff
@@ -14,14 +14,17 @@
     docker compose --profile mcp up -d
 
 Available MCP Tools (11):
-    - memorize         : Convert data to knowledge graph (data, dataset_name)
-    - save_interaction : Save user-agent interaction records (data)
+    - memorize         : Convert data to knowledge graph (data, dataset_name, wait)
+                         Returns a task_id; use `wait=True` for synchronous mode.
+    - save_interaction : Save user-agent interaction records (data, wait)
+                         Returns a task_id; use `wait=True` for synchronous mode.
     - search           : Search knowledge graph (search_query, recall_mode, top_k, datasets,
                          system_prompt, enable_hybrid_search)
     - list_data        : List datasets and data items (dataset_id)
     - delete           : Delete data items (data_id, dataset_id, mode)
     - prune            : Reset knowledge graph (graph, vector, metadata, cache)
-    - memorize_status  : Get memorization pipeline status
+    - memorize_status  : Get memorization pipeline status, or per-task outcome
+                         when called with `task_id` (issue #111).
     - learn            : Extract procedural memory (datasets, episode_ids, run_in_background)
     - update_data      : Update existing data (data_id, data, dataset_id)
     - ingest           : One-step ingestion (data, dataset_name, skip_memorize)
```

**File**: `m_flow-mcp/src/server.py` (modified, +291/-33)
```diff
@@ -14,9 +14,15 @@
 import os
 import subprocess
 import sys
+import traceback
+from collections import OrderedDict
 from contextlib import redirect_stdout
+from dataclasses import asdict, dataclass, field
+from datetime import datetime, timezone
+from enum import Enum
 from pathlib import Path
-from typing import TYPE_CHECKING, Optional
+from typing import TYPE_CHECKING, Any, Awaitable, Callable, Dict, Optional
+from uuid import uuid4
 
 import mcp.types as types
 import uvicorn
@@ -43,6 +49,154 @@
 _CORS_ORIGINS = ["http://localhost:3000"]
 
 
+# ============================================================
+# Background-task tracking (issue #111)
+#
+# The MCP `memorize` and `save_interaction` tools were historically
+# fire-and-forget: they used `asyncio.create_task(...)` and immediately
+# returned a "started" message. If the background coroutine raised
+# (e.g. expired LLM key, locked graph DB, malformed input), the failure
+# was only logged server-side — the MCP caller (IDE / agent) never
+# learned about it, producing a silent data-loss scenario.
+#
+# This module-level registry records each background task's outcome so
+# callers can later query `memorize_status(task_id=...)` and see the
+# actual success / failure / error message. The registry is an in-memory
+# bounded LRU; restarting the MCP server clears it (acceptable for the
+# short-lived agent sessions this server targets).
+# ============================================================
+
+
+class TaskState(str, Enum):
+    RUNNING = "running"
+    SUCCESS = "success"
+    FAILED = "failed"
+
+
+@dataclass
+class TaskRecord:
+    """Outcome of a background MCP task surfaced to the caller."""
+
+    task_id: str
+    tool: str
+    state: TaskState
+    started_at: str
+    finished_at: Optional[str] = None
+    dataset_name: Optional[str] = None
+    error_type: Optional[str] = None
+    error_message: Optional[str] = None
+    metadata: Dict[str, Any] = field(default_factory=dict)
+
+
+# Bounded registry: keep the most recent N task records. Older entries
+# are evicted (LRU) so the dict never grows unbounded.
+_TASK_REGISTRY_MAX = 100
+# Default sync-mode timeout — `wait=True` callers (CI, scripts) get a
+# bounded wait; on timeout the task continues running in the background
+# and can still be queried via `memorize_status(task_id=...)`.
+_WAIT_TIMEOUT_SECS = 600
+
+_task_registry: "OrderedDict[str, TaskRecord]" = OrderedDict()
+_task_registry_lock = asyncio.Lock()
+
+
+def _now_iso() -> str:
+    return datetime.now(timezone.utc).isoformat()
+
+
+def _short_id() -> str:
+    """Generate a short, URL-friendly task ID."""
+    return uuid4().hex[:12]
+
+
+async def _record_task_start(
+    tool: str,
+    dataset_name: Optional[str] = None,
+    **metadata: Any,
+) -> str:
+    """Create a new task record in RUNNING state and return its ID."""
+    task_id = _short_id()
+    record = TaskRecord(
+        task_id=task_id,
+        tool=tool,
+        state=TaskState.RUNNING,
+        started_at=_now_iso(),
+        dataset_name=dataset_name,
+        metadata=dict(metadata),
+    )
+    async with _task_registry_lock:
+        _task_registry[task_id] = record
+        # LRU eviction: drop oldest entries until under the cap.
+        while len(_task_registry) > _TASK_REGISTRY_MAX:
+            _task_registry.popitem(last=False)
+    return task_id
+
+
+async def _record_task_outcome(
+    task_id: str,
+    state: TaskState,
+    error: Optional[BaseException] = None,
+) -> None:
+    """Mark a task as completed (or failed) and record any error."""
+    async with _task_registry_lock:
+        record = _task_registry.get(task_id)
+        if record is None:
+            # Already evicted from the LRU — safe to ignore.
+            return
+        record.state = state
+        record.finished_at = _now_iso()
+        if error is not None:
+            record.error_type = type(error).__name__
+            record.error_message = str(error)
+        # Refresh rece
```

**File**: `m_flow-mcp/src/test_server_task_tracking.py` (added, +320/-0)
```diff
@@ -0,0 +1,320 @@
+"""Tests for the task-tracking machinery introduced for issue #111.
+
+These tests verify that `memorize` and `save_interaction` no longer drop
+background-task failures silently. Each tool now returns a `task_id`, the
+outcome is recorded into a bounded in-memory registry, and
+`memorize_status(task_id=...)` surfaces the actual success / failure to the
+MCP caller. A `wait=True` synchronous mode is also exercised.
+"""
+
+from __future__ import annotations
+
+import asyncio
+from types import SimpleNamespace
+from typing import Any
+
+import pytest
+
+from src import server
+
+
+# ---------------------------------------------------------------------------
+# Helpers
+# ---------------------------------------------------------------------------
+
+
+@pytest.fixture(autouse=True)
+def _reset_registry() -> None:
+    """Each test gets a clean registry so cases are independent."""
+    server._task_registry.clear()
+    yield
+    server._task_registry.clear()
+
+
+def _capture_create_task(scheduled: list[asyncio.Task[Any]], monkeypatch: pytest.MonkeyPatch) -> None:
+    original = asyncio.create_task
+
+    def capture(coro: Any) -> asyncio.Task[Any]:
+        task = original(coro)
+        scheduled.append(task)
+        return task
+
+    monkeypatch.setattr(server.asyncio, "create_task", capture)
+
+
+def _extract_task_id(text: str) -> str:
+    for line in text.splitlines():
+        if line.startswith("task_id:"):
+            return line.split(":", 1)[1].strip().strip('"')
+    raise AssertionError(f"No task_id line in TextContent payload: {text!r}")
+
+
+# ---------------------------------------------------------------------------
+# memorize: success path
+# ---------------------------------------------------------------------------
+
+
+@pytest.mark.asyncio
+async def test_memorize_returns_task_id_and_records_success(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    async def fake_add(content: str, dataset_name: str) -> None:
+        return None
+
+    async def fake_memorize(**kwargs: object) -> None:
+        return None
+
+    scheduled: list[asyncio.Task[Any]] = []
+    monkeypatch.setattr(server, "_client", SimpleNamespace(add=fake_add, memorize=fake_memorize))
+    _capture_create_task(scheduled, monkeypatch)
+
+    result = await server.memorize("hello", dataset_name="beta")
+    await asyncio.gather(*scheduled)
+
+    assert len(result) == 1
+    payload = result[0].text
+    assert "✅ 后台任务已启动" in payload
+    task_id = _extract_task_id(payload)
+
+    record = await server._get_task_record(task_id)
+    assert record is not None
+    assert record.state == server.TaskState.SUCCESS
+    assert record.tool == "memorize"
+    assert record.dataset_name == "beta"
+    assert record.error_message is None
+
+
+# ---------------------------------------------------------------------------
+# memorize: failure path
+# ---------------------------------------------------------------------------
+
+
+@pytest.mark.asyncio
+async def test_memorize_records_failure_when_background_task_raises(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    async def fake_add(content: str, dataset_name: str) -> None:
+        raise RuntimeError("LLM key expired")
+
+    async def fake_memorize(**kwargs: object) -> None:  # pragma: no cover - never reached
+        return None
+
+    scheduled: list[asyncio.Task[Any]] = []
+    monkeypatch.setattr(server, "_client", SimpleNamespace(add=fake_add, memorize=fake_memorize))
+    _capture_create_task(scheduled, monkeypatch)
+
+    result = await server.memorize("hello")
+    # Background task is expected to fail; gather with return_exceptions=True
+    # so the test runner does not see the propagated exception.
+    await asyncio.gather(*scheduled, return_exceptions=True)
+
+    task_id = _extract_task_id(result[0].text)
+    record = await server._get_task_
```

---

### Incident Patch 8: `bc3c73ab` (2026-04-19)
**Commit Message**: fix(tests): skip MiniMax adapter tests when optional anthropic extra is absent

The MiniMax adapter speaks MiniMax's Anthropic-compatible endpoint and imports
`anthropic` at module top-level. `anthropic` is declared as an optional
extra in pyproject.toml, so default CI environments (without
`m_flow[anthropic]` installed) crashed at collection time with
ModuleNotFoundError.

Add a pytest.importorskip("anthropic") at the top of the test module so it
cleanly skips when the optional extra is missing, while still running the
full suite for users who install the extra.

Made-with: Cursor

**File**: `m_flow/tests/unit/infrastructure/llm/test_minimax_adapter.py` (modified, +12/-0)
```diff
@@ -26,6 +26,18 @@
 import pytest
 from pydantic import BaseModel
 
+# The MiniMax adapter imports `anthropic` at module top-level (it speaks MiniMax's
+# Anthropic-compatible endpoint). `anthropic` is declared as an OPTIONAL extra in
+# pyproject.toml ([project.optional-dependencies] anthropic = ["anthropic>=0.26"]),
+# so environments that do not install `m_flow[anthropic]` (e.g. the default CI matrix)
+# would otherwise crash at collection time with ModuleNotFoundError. Skip the whole
+# module cleanly when the optional dependency is absent.
+pytest.importorskip(
+    "anthropic",
+    reason="MiniMax adapter requires the optional `anthropic` extra "
+    "(install with `pip install m_flow[anthropic]`).",
+)
+
 
 # ---------------------------------------------------------------------------
 # Pydantic response models used across tests
```

---

### Incident Patch 9: `b6b9157a` (2026-04-18)
**Commit Message**: fix(ci): make workflow gates fork-aware for external PRs (#83)

Prevent fork PRs from failing due to unavailable trusted secrets by adding lightweight fork checks and conditional CI aggregation, while keeping full strict gates for trusted contexts.

Made-with: Cursor

Signed-off-by: Junting Hua <juntinghua@Juntings-MacBook-Pro.local>
Co-authored-by: Junting Hua <juntinghua@Juntings-MacBook-Pro.local>

**File**: `.github/workflows/release_test.yml` (modified, +1/-0)
```diff
@@ -20,5 +20,6 @@ jobs:
 
   mflow_pre_release_load_suite:
     name: "Execute load & stress test suite"
+    if: ${{ github.event_name != 'pull_request' || !github.event.pull_request.head.repo.fork }}
     uses: ./.github/workflows/load_tests.yml
     secrets: inherit
```

**File**: `.github/workflows/test_suites.yml` (modified, +47/-19)
```diff
@@ -33,21 +33,39 @@ jobs:
   # ─── Tier 1 — Core ─────────────────────────────────────────────────────
   core-tests:
     name: "Core unit & integration tests"
+    if: ${{ github.event_name != 'pull_request' || !github.event.pull_request.head.repo.fork }}
     needs: [gate]
     uses: ./.github/workflows/basic_tests.yml
     secrets: inherit
 
   e2e:
     name: "End-to-end tests"
+    if: ${{ github.event_name != 'pull_request' || !github.event.pull_request.head.repo.fork }}
     needs: [gate]
     uses: ./.github/workflows/e2e_tests.yml
     secrets: inherit
 
   cli:
     name: "CLI regression tests"
+    if: ${{ github.event_name != 'pull_request' || !github.event.pull_request.head.repo.fork }}
     uses: ./.github/workflows/cli_tests.yml
     secrets: inherit
 
+  fork-lite:
+    name: "Fork PR lightweight checks"
+    if: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.repo.fork }}
+    needs: [gate]
+    runs-on: ubuntu-22.04
+    timeout-minutes: 10
+    steps:
+      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4
+        with: {fetch-depth: 0}
+      - uses: ./.github/actions/m_flow_setup
+        with:
+          python-version: "3.11.x"
+      - run: uv run ruff check .
+      - run: uv run ruff format --check .
+
   # ─── Tier 2 — Database backends ────────────────────────────────────────
   graph-db:
     name: "Graph database tests"
@@ -180,6 +198,8 @@ jobs:
     name: "CI status gate"
     if: always()
     needs:
+      - gate
+      - fork-lite
       - core-tests
       - e2e
       - cli
@@ -199,26 +219,34 @@ jobs:
     runs-on: ubuntu-22.04
     timeout-minutes: 5
     steps:
-      - name: Evaluate aggregated results
+      - name: Evaluate aggregated results (fork-aware)
         run: |
-          # Collect all job results into an array for compact evaluation
-          results=(
-            "${{ needs.core-tests.result }}"
-            "${{ needs.e2e.result }}"
-            "${{ needs.cli.result }}"
-            "${{ needs.graph-db.result }}"
-            "${{ needs.notebook.result }}"
-            "${{ needs.os-ubuntu.result }}"
-            "${{ needs.os-extended.result }}"
-            "${{ needs.vector-db.result }}"
-            "${{ needs.examples.result }}"
-            "${{ needs.db-examples.result }}"
-            "${{ needs.relational-db-migrations.result }}"
-            "${{ needs.llm-providers.result }}"
-            "${{ needs.compose-smoke.result }}"
-            "${{ needs.docker-build.result }}"
-            "${{ needs.ollama.result }}"
-          )
+          if [[ "${{ github.event_name }}" == "pull_request" && "${{ github.event.pull_request.head.repo.fork }}" == "true" ]]; then
+            # Fork PR: only require lockfile gate + lightweight lint/format checks
+            results=(
+              "${{ needs.gate.result }}"
+              "${{ needs.fork-lite.result }}"
+            )
+          else
+            # Trusted contexts: keep full strict gate
+            results=(
+              "${{ needs.core-tests.result }}"
+              "${{ needs.e2e.result }}"
+              "${{ needs.cli.result }}"
+              "${{ needs.graph-db.result }}"
+              "${{ needs.notebook.result }}"
+              "${{ needs.os-ubuntu.result }}"
+              "${{ needs.os-extended.result }}"
+              "${{ needs.vector-db.result }}"
+              "${{ needs.examples.result }}"
+              "${{ needs.db-examples.result }}"
+              "${{ needs.relational-db-migrations.result }}"
+              "${{ needs.llm-providers.result }}"
+              "${{ needs.compose-smoke.result }}"
+              "${{ needs.docker-build.result }}"
+              "${{ needs.ollama.result }}"
+            )
+          fi
 
           failed=0
           for r in "${results[@]}"; do
```

---

### Incident Patch 10: `99062ff7` (2026-04-17)
**Commit Message**: fix(ci): avoid secrets context in load-test job condition (#78)

GitHub Actions does not allow using the secrets context in a job-level if expression for this workflow validation path. Add a precheck step and gate later steps via its output instead.

Made-with: Cursor

Co-authored-by: Junting Hua <juntinghua@Juntings-MacBook-Pro.local>

**File**: `.github/workflows/load_tests.yml` (modified, +14/-1)
```diff
@@ -32,7 +32,6 @@ permissions:
 jobs:
   load-test:
     name: Execute load / stress test with S3 storage backend
-    if: ${{ secrets.AWS_S3_DEV_USER_KEY_ID != '' }}
     runs-on: ubuntu-22.04
     timeout-minutes: 60
 
@@ -58,16 +57,30 @@ jobs:
       EMBEDDING_API_VERSION:  ${{ secrets.EMBEDDING_API_VERSION }}
 
     steps:
+      - name: Check S3 credentials availability
+        id: s3-creds
+        run: |
+          if [ -n "${AWS_ACCESS_KEY_ID}" ] && [ -n "${AWS_SECRET_ACCESS_KEY}" ]; then
+            echo "run_load_tests=true" >> "$GITHUB_OUTPUT"
+          else
+            echo "run_load_tests=false" >> "$GITHUB_OUTPUT"
+            echo "Skipping load tests because AWS S3 dev credentials are not configured."
+          fi
+
       - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4
+        if: ${{ steps.s3-creds.outputs.run_load_tests == 'true' }}
 
       - name: Bootstrap M-flow environment (with AWS extras)
         uses: ./.github/actions/m_flow_setup
+        if: ${{ steps.s3-creds.outputs.run_load_tests == 'true' }}
         with:
           python-version: "3.11.x"
           extra-dependencies: "aws"
 
       - name: Display OS file-descriptor limit
+        if: ${{ steps.s3-creds.outputs.run_load_tests == 'true' }}
         run: ulimit -n
 
       - name: Run load test suite
+        if: ${{ steps.s3-creds.outputs.run_load_tests == 'true' }}
         run: uv run python ./m_flow/tests/test_load.py
```

#### Recent Merged Pull Requests:
- **PR #170** (closed): chore: prefix unused loop control variables with underscore (ruff B007) (@alexzhu0)
- **PR #169** (closed): chore: small safety/idiomatic micro-fixes (PYI063, PLW0602, PLW1508) (@alexzhu0)
- **PR #168** (closed): chore: prefer iterable unpacking over list concatenation (ruff RUF005) (@alexzhu0)
- **PR #167** (closed): ci(weighted-edges): fix ruff-action glob so 'Static analysis — weighted-edge sources' can run (@alexzhu0)
- **PR #166** (closed): chore: use str.removeprefix/removesuffix instead of slice (ruff FURB188) (@alexzhu0)
- **PR #165** (closed): chore: drop redundant None default on dict.get() (ruff SIM910) (@alexzhu0)
- **PR #164** (closed): chore: drop redundant "r" mode argument to open() (ruff UP015) (@alexzhu0)
- **PR #156** (closed): chore: use explicit conversion flag in f-strings instead of `str()` (ruff RUF010) (@alexzhu0)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
