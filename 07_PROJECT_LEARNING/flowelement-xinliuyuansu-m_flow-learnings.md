# Forensic Learning Record (Deep Inspection): FlowElement-xinliuyuansu/m_flow

> **Canonical Artifact**: `07_PROJECT_LEARNING/flowelement-xinliuyuansu-m_flow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/FlowElement-xinliuyuansu/m_flow](https://github.com/FlowElement-xinliuyuansu/m_flow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:10:57.276Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `FlowElement-xinliuyuansu/m_flow`
- **Description**: A bio-inspired cognitive memory engine — a new paradigm for Graph RAG.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 4512 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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

if __name__ == "__main__":
    print("=" * 70)
    print("Entity Canonicalization Test")
    print("=" * 70)

    # Create canonicalizer
    alias_map = {
        "PER_NAME": {
            "小张": "张三",
            "张子": "张三",
            "老王": "王五",
        },
        "LOC_NAME": {
            "BJ": "北京",
            "SH": "上海",
        },
    }

    canonicalizer = create_canonicalizer(alias_map)

    tests = [
        ("小张", "PER_NAME"),
        ("张子", "PER_NAME"),
        ("李四", "PER_NAME"),  # unknown, should return original value
        ("帝都", "LOC_NAME"),  # rule match
        ("魔都", "LOC_NAME"),  # rule match
        ("BJ", "LOC_NAME"),  # dictionary match
        ("杭州", "LOC_NAME"),  # unknown
    ]

    for surface, etype in tests:
        result = canonicalizer.canonicalize(surface, etype)
        print(
            f"  {surface:8} ({etype}) -> {result.canonical_text} "
            f"[conf={result.confidence:.1f}, evidence={result.evidence}]"
        )

    print()
    print("Learning candidates:")
    for candidate in canonicalizer.get_candidates():
        print(f"  {candidate.surface_text} ({candidate.entity_type})")

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
        # Check for female characteristic characters in name
        return any(char in self.FEMALE_NAME_CHARS for char in name)

    def is_male_name(self, name: str) -> bool:
        """Check if name is possibly male"""
        if not name:
            return False
        # Check for male characteristic characters in name
        return any(char in self.MALE_NAME_CHARS for char in name)

    def add_entity(self, entity: Entity):
        """Add entity to corresponding stack"""
        if entity.type in ["PER_NAME", "PER_TITLE"]:
            self.person_stack.append(entity)
            self.current_sentence_persons.append(entity)
        elif entity.type == "OBJ":
            self.object_stack.append(entity)
        elif entity.type in ["LOC_NAME", "LOC_PLACE"]:
            self.location_stack.append(entity)
        elif entity.type == "TIME":
            self.time_stack.append(entity)

        # Also add to unified candidate stack (for ordinal pronouns)
        self.all_mentions_stack.append(entity)

    def add_event(self, event: Event):
        """Add event to event stack"""
        self.event_stack.append(event)

    def get_event(self, prefer_recent: bool = True) -> Optional[Event]:
        """Get event"""
        if not self.event_stack:
            return None
        return self.event_stack[-1] if prefer_recent else self.event_stack[0]

    def get_first_and_last_mentions(self, prefer_type: str = None) -> Tuple[Optional[Entity], Optional[Entity]]:
        """Get first and last entities (for ordinal pronouns: former/latter)

        Fix:
        - "former" refers to the first mentioned entity
        - "latter" refers to the last mentioned entity

        Args:
            prefer_type: preferred entity type, e.g. 'PER_NAME' over 'PER_TITLE'
        """
        if len(self.all_mentions_stack) < 2:
            return (None, None)

        # Deduplicate: keep only first occurrence of same-name entities
        seen = set()
        unique = []

        # First try using only pr
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
            return "object"
        # If followed immediately by a verb, likely subject
        tokens = self.tokenizer.tokenize(after[:4])
        for t in tokens:
            if t.pos in {"v", "vd", "vn"}:
                return "subject"
            break
        return None

    def _ensure_hanlp(self) -> None:
        if self._hanlp_dep is not None:
            return
        import hanlp

        self._hanlp_dep = hanlp.load(hanlp.pretrained.dep.CTB9_DEP_ELECTRA_SMALL)

    def _ensure_hanlp_srl(self) -> None:
        if self._hanlp_srl is not None:
            return
        import hanlp

        self._hanlp_srl = hanlp.load(hanlp.pretrained.srl.CPB3_SRL_ELECTRA_SMALL)

    def _ensure_ltp(self) -> None:
        if self._ltp is not None:
            return
        from ltp import LTP

        self._ltp = LTP()

    def _get_offsets(self, tokens: List[str], sentence: str) -> List[tuple[int, int]]:
        offsets: List[tuple[int, int]] = []
        cursor = 0
        for tok in tokens:
            idx = sentence.find(tok, cursor)
            if idx < 0:
                idx = cursor
            start = idx
            end = idx + len(tok)
            offsets.append((start, end))
            cursor = end
        return offsets

    def _find_token_index(self, position: int, offsets: List[tuple[int, int]]) -> Optional[int]:
        for i, (s, e) in enumerate(offsets):
            if s <= position < e:
                return i
        return None

    def _ensure_parsed(
        self, sentence: str
    ) -> tuple[Optional[List[str]], Optional[List[Optional[str]]], Optional[List[tuple[int, int]]]]:
        if self._cache_sentence == sentence and self._cache_tokens and self._cache_offsets and self._cache_roles:
            return self._cache_tokens, self._cache_roles, self._cache_offsets
        if self.backend == "hanlp":
            _ = self._hanlp_role(sentence, 0)
        elif self.backend == "ltp":
            _ = self._ltp_role(sentence, 0)
        if self._cache_sentence == sen
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
        """Normalize year-relative time (last year, this year, next year, etc.)"""
        if text in self.YEAR_RELATIVE:
            delta = self.YEAR_RELATIVE[text]
            target_year = ref.year + delta
            return TimeSpan(
                source_text=text,
                start_dt=datetime(target_year, 1, 1),
                end_dt=datetime(target_year + 1, 1, 1),
                precision="YEAR",
            )
        return None

    def _normalize_weekday(self, text: str, ref: datetime) -> Optional[TimeSpan]:
        """Normalize day of week"""
        if text in self.WEEKDAY_MAP:
            target_weekday = self.WEEKDAY_MAP[text]
            current_weekday = ref.weekday()

            # Calculate the nearest occurrence of this weekday (could be past or future)
            delta = target_weekday - current_weekday
            if delta > 0:
                delta -= 7  # default to past occurrence

            target = ref.date() + timedelta(days=delta)
            return TimeSpan(
                source_text=text,
                start_dt=datetime.combine(target, datetime.min.time()),
                end_dt=datetime.combine(target + timedelta(days=1), datetime.min.time()),
                precision="DAY",
            )
        return None

    def _normalize_season(self, text: str, ref: datetime) -> Optional[TimeSpan]:
        """Normalize season"""
        if text in self.SEASON_MAP:
            start_month, end_month = self.SEASON_MAP[text]
            year = ref.year

            # Handle winter crossing year boundary
            if start_month > end_month:  # winter 12-2
                if ref.month < 6:
                    # Currently first half of year: winter = last Dec to this Feb
                    start_dt = datetime(year - 1, start_month, 1)
                    end_dt = datetime(year, end_month + 1, 1)
                else:
                    # Currently second half of year: winter = this Dec to next Feb
                    start_dt = datetime(year, start_month, 1)
                
```

### Core Architecture Module: `coreference/coreference_module/tokenizer.py`
```
"""
Chinese Tokenizer - Fine-grained Classification v2
Fixes jieba segmentation/POS tagging issues
"""

import re
import jieba
import jieba.posseg as pseg
from typing import List, Dict, Tuple
from dataclasses import dataclass


@dataclass
class Token:
    """Token result"""

    word: str
    pos: str
    entity_type: str = "O"
    start: int = -1  # start character position
    end: int = -1  # end character position


@dataclass
class Mention:
    """Entity mention (with position info)"""

    surface: str  # surface text
    type: str  # entity type: PER_NAME, PER_TITLE, LOC_NAME, LOC_PLACE, OBJ, TIME
    start: int  # start character position
    end: int  # end character position
    sentence_id: int = 0  # sentence ID (optional)


class ChineseTokenizer:
    """
    Chinese Tokenizer - Fine-grained Classification

    Entity types:
    - PER_NAME:  person names (e.g. Xiao Ming, Liu Dehua, Zhang San)
    - PER_TITLE: person titles (e.g. mama, doctor, girl)
    - LOC_NAME:  location names (e.g. Beijing, Shanghai, New York)
    - LOC_PLACE: places (e.g. school, hospital, supermarket)
    - OBJ:       objects
    - O:         other
    """

    # === Person title words (not names, but person references) ===
    PERSON_TITLES = {
        # Kinship titles
        "妈妈",
        "爸爸",
        "父亲",
        "母亲",
        "爷爷",
        "奶奶",
        "姥姥",
        "姥爷",
        "外公",
        "外婆",
        "公公",
        "婆婆",
        "岳父",
        "岳母",
        "哥哥",
        "姐姐",
        "弟弟",
        "妹妹",
        "叔叔",
        "阿姨",
        "舅舅",
        "姑姑",
        "伯伯",
        "婶婶",
        "姨妈",
        "姨父",
        "舅妈",
        "姑父",
        "儿子",
        "女儿",
        "孙子",
        "孙女",
        "外孙",
        "外孙女",
        "丈夫",
        "妻子",
        "老公",
        "老婆",
        "爱人",
        "媳妇",
        "女婿",
        # Professional titles
        "医生",
        "护士",
        "老师",
        "教授",
        "学生",
        "警察",
        "司机",
        "厨师",
        "工人",
        "农民",
        "程序员",
        "科学家",
        "设计师",
        "工程师",
        "律师",
        "法官",
        "经理",
        "老板",
        "员工",
        "同事",
        "秘书",
        "助理",
        "主任",
        "院长",
        "师傅",
        "徒弟",
        "教练",
        "运动员",
        "演员",
        "歌手",
        "导演",
        "记者",
        "服务员",
        "售货员",
        "快递员",
        "外卖员",
        "保安",
        "保洁",
        "主播",
        "博主",
        "网红",
        "明星",
        "艺人",
        "歌星",
        "影星",
        "UP主",
        "老铁",
        "兄弟",
        "姐妹",
        "小哥",
        "小姐姐",
        "小哥哥",
        "大神",
        "大佬",
        "帅哥",
        "美女",
        "靓仔",
        "靓女",
        "小伙",
        "姑娘",
        "少女",
        "小姑娘",
        "太太",
        "夫人",
        "女士",
        "先生",
        "小姐",
        "员工",
        "职员",
        "同事",
        "小朋友",
        "大人",
        "成年人",
        "未成年人",
        "青少年",
        "中年人",
        # Administrative titles
        "市长",
        "县长",
        "区长",
        "镇长",
        "村长",
        "书记",
        "委员",
        "代表",
        "局长",
        "处长",
        "科长",
        "股长",
        "组长",
        "队长",
        "班长",
        "总统",
        "主席",
        "总理",
        "部长",
        "厅长",
        "司长",
        "署长",
        "将军",
        "司令",
        "军长",
        "师长",
        "团长",
        "营长",
        "连长",
        "排长",
        "选手",
        "冠军",
        "亚军",
        "季军",
        "球员",
        "球星",
        "教练员",
        # Service staff (note: some words are both nouns and verbs, avoid adding here)
        "客服",
        "前台",
        "导购",
        "柜员",
        "出纳",
        "会计",
        "审计",
        # Person descriptions (can be referred to by he/she)
        "男孩",
        "女孩",
        "小男孩",
        "小女孩",
        "男人",
        "女人",
        "老人",
        "年轻人",
        "孩子",
        "少年",
        "青年",
        "中年",
        "老年",
        "婴儿",
        "幼儿",
        "儿童",
        "小偷",
        "罪犯",
        "嫌疑人",
        "受害者",
        "证人",
        "原告",
        "被告",
        "牙医",
        "兽医",
        "中医",
        "西医",
        "名医",
        "大夫",
        "研究生",
        "博士生",
        "硕士生",
        "本科生",
        "高中生",
        "初中生",
        "小学生",
        # Social titles
        "同学",
        "朋友",
        "同事",
        "邻居",
        "客户",
        "顾客",
        "乘客",
        "病人",
        "患者",
        "伤员",
        "嫌疑人",
        "证人",
        "被告",
        "原告",
        "小偷",
        "骗子",
        "罪犯",
        "技术人员",
        "工作人员",
        "服务人员",
        # General titles (keep those that can refer to specific individuals)
        "先生",
        "女士",
        "小姐",
        "姑娘",
        "小伙",
        "小伙子",
        "大爷",
        "大妈",
        "大叔",
        "大婶",
        "男人",
        "女人",
        "孩子",
        "小孩",
        "老人",
        "年轻人",
        "中年人",
        "少年",
        "青年",
        "老年人",
        "男孩",
        "女孩",
        "男生",
        "女生",
        "男士",
        "女士",
        "老头",
        "老太太",
        # Note: generic terms like 'person', 'people', 'everyone' are not included as they are indefinite references
    }

    # === Place words (not named locations) ===
    PLACE_WORDS = {
        # Commercial places
        "超市",
        "商店",
        "店铺",
        "商场",
        "市场",
        "菜市场",
        "批发市场",
        "餐厅",
        "饭店",
        "酒店",
        "宾馆",
        "旅馆",
        "民宿",
        "酒吧",
        "咖啡厅",
        "药店",
        "书店",
        "花店",
        "水果店",
        "便利店",
        "专卖店",
        "银行",
        "邮局",
        "快递站",
        # Educational places
        "学校",
        "大学",
        "中学",
        "小学",
        "幼儿园",
        "培训班",
        "补习班",
        "教室",
        "实验室",
        "图书馆",
        "阅览室",
        "自习室",
        "办公室",
        "操场",
        "体育馆",
        "游泳池",
        "食堂",
        "宿舍",
        "礼堂",
        # Medical places
        "医院",
        "诊所",
        "卫生院",
        "门诊",
        "急诊",
        "病房",
        "手术室",
        "药房",
        "化验室",
        "检查室",
        # Office/work places
        "公司",
        "工厂",
        "车间",
        "仓库",
        "办公室",
        "会议室",
        "接待室",
        "写字楼",
        "园区",
        "基地",
        # Transportation places
        "机场",
        "车站",
        "火车站",
        "汽车站",
        "地铁站",
        "码头",
        "港口",
        "停车场",
        "加油站",
        "服务区",
        # Public places
        "公园",
        "广场",
        "博物馆",
        "美术馆",
        "展览馆",
        "科技馆",
        "电影院",
        "剧院",
        "音乐厅",
        "体育场",
        "游乐场",
        "派出所",
        "警察局",
        "法院",
        "政府",
        "市政府",
        # Residential places (houses/yards moved to OBJECT_WORDS, can be referred by "it")
        "家",
        "家里",
        "房间",
        "卧室",
        "客厅",
        "厨房",
        "卫生间",
        "阳台",
        "楼上",
        "楼下",
        "门口",
        "地下室",
        "车库",
        "小区",
        "社区",
        "村子",
        "胡同",
        "弄堂",
        "厕所",
        "洗手间",
        "盥洗室",
        "浴室",
        "储藏室",
        "杂物间",
        "阁楼",
        # Natural places
        "山上",
        "山下",
        "河边",
        "湖边",
        "海边",
        "田里",
        "地里",
        "林子",
        # Service places
        "网吧",
        "理发店",
        "美发店",
        "健身房",
        "洗浴中心",
        "足疗店",
        "修理店",
        "洗车店",
        "干洗店",
        "照相馆",
        "婚纱店",
        "诊所",
        "牙科",
        "眼科",
        "美容院",
        "按摩店",
        # Modern places
        "直播间",
        "录音棚",
        "摄影棚",
        "演播室",
        "工作室",
        "健身中心",
        "购物中心",
        "娱乐中心",
        "文化中心",
        "会展中心",
        "美食广场",
        "美食街",
        "步行街",
        "商业街",
        "网咖",
        "电竞馆",
        "桌游吧",
        "KTV",
        "酒吧",
    }

    # === Object words ===
    OBJECT_WORDS = {
        # Animals (can be referred by "it/they")
        "猫",
        "狗",
        "鸟",
        "鱼",
        "兔子",
        "老鼠",
        "蛇",
        "龟",
        "乌龟",
        "狮子",
        "老虎",
        "豹",
        "熊",
        "狼",
        "狐狸",
        "鹿",
        "马",
        "牛",
        "羊",
        "猪",
        "鸡",
        "鸭",
        "鹅",
        "鸽子",
        "麻雀",
        "燕子",
        "乌鸦",
        "喜鹊",
        "孔雀",
        "蝴蝶",
        "蜜蜂",
        "蚂蚁",
        "蟑螂",
        "蚊子",
        "苍蝇",
        "大象",
        "长颈鹿",
        "斑马",
        "河马",
        "犀牛",
        "熊猫",
        "猴子",
        "猩猩",
        "海豚",
        "鲸鱼",
        "鲨鱼",
        "章鱼",
        "螃蟹",
        "虾",
        "贝壳",
        "小猫",
        "小狗",
        "小鸟",
        "小鱼",
        "宠物",
        "动物",
        "鸟儿",
        "狗儿",
        "猫儿",
        "兔儿",  # Animals with "er" suffix
        # Food
        "苹果",
        "香蕉",
        "橘子",
        "葡萄",
        "西瓜",
        "草莓",
        "梨",
        "桃",
        "面包",
        "蛋糕",
        "饼干",
        "糖果",
        "巧克力",
        "冰淇淋",
        "饺子",
        "面条",
        "米饭",
        "馒头",
        "包子",
        "粥",
        "牛奶",
        "咖啡",
        "茶",
        "果汁",
        "可乐",
        "啤酒",
        "酒",
        "水",
        "菜",
        "肉",
        "鱼",
        "蛋",
        "饭",
        "药",
        # Electronics
        "电视",
        "电脑",
        "手机",
        "平板",
        "相机",
        "耳机",
        "音箱",
        "冰箱",
        "洗衣机",
        "空调",
        "微波炉",
        "电饭煲",
        "电话",
        "短信",
        "邮件",
        "视频",
        "音乐",
        "游戏",
        "直播",
        "微信",
        "抖音",
        "微博",
        "淘宝",
        "支付宝",
        "B站",
        "照片",
        "图片",
        "文章",
        "帖子",
        "评论",
        "弹幕",
        "报纸",
        "杂志",
        "小说",
        "故事",
        "新闻",
        "广播",
        "节目",
        "频道",
        # Vehicles
        "火车",
        "飞机",
        "轮船",
        "出租车",
        "公交车",
        "地铁",
        "高铁",
     
```

### Core Architecture Module: `coreference/english_coreference/__init__.py`
```
from .coreference import CoreferenceResolver, StreamCorefSession, EntityTracker
from .tokenizer import EnglishTokenizer
from .ner_adapter import EnglishNerAdapter

__all__ = [
    "CoreferenceResolver",
    "StreamCorefSession",
    "EntityTracker",
    "EnglishTokenizer",
    "EnglishNerAdapter",
]

```

### Core Architecture Module: `coreference/english_coreference/coreference.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
English coreference resolution: rule-first, conservative replacement.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from .ner_adapter import Entity, EnglishNerAdapter
from .tokenizer import EnglishTokenizer


@dataclass
class Replacement:
    sentence_id: int
    position: int
    pronoun: str
    replacement: str
    start: int
    end: int


class EntityTracker:
    def __init__(self, max_history: int = 10) -> None:
        """
        Initialize EntityTracker with bounded history.

        Args:
            max_history: Maximum number of entities to keep in each stack.
                        Higher values improve resolution accuracy but use more memory.
        """
        self.max_history = max_history
        self.person_stack: deque = deque(maxlen=max_history)
        self.object_stack: deque = deque(maxlen=max_history)
        self.location_stack: deque = deque(maxlen=max_history)
        self.group_stack: deque = deque(maxlen=max_history)
        self.time_stack: deque = deque(maxlen=max_history)
        self.event_stack: deque = deque(maxlen=max_history)
        self.sentence_count = 0
        self.sentence_texts: List[str] = []

    def clear(self) -> None:
        self.person_stack.clear()
        self.object_stack.clear()
        self.location_stack.clear()
        self.group_stack.clear()
        self.time_stack.clear()
        self.event_stack.clear()
        self.sentence_count = 0
        self.sentence_texts.clear()

    def next_sentence(self) -> None:
        self.sentence_count += 1

    def set_sentence_text(self, sentence_id: int, text: str) -> None:
        if sentence_id == len(self.sentence_texts):
            self.sentence_texts.append(text)
        elif 0 <= sentence_id < len(self.sentence_texts):
            self.sentence_texts[sentence_id] = text

    def get_prev_sentence_text(self, sentence_id: int) -> Optional[str]:
        if sentence_id <= 0:
            return None
        if sentence_id - 1 < len(self.sentence_texts):
            return self.sentence_texts[sentence_id - 1]
        return None

    def add(self, entity: Entity) -> None:
        if entity.type in {"PER", "PER_TITLE"}:
            self.person_stack.append(entity)
        elif entity.type in {"GROUP"}:
            self.group_stack.append(entity)
        elif entity.type in {"LOC_ORG"}:
            self.location_stack.append(entity)
        elif entity.type == "TIME":
            self.time_stack.append(entity)
        elif entity.type == "EVENT":
            self.event_stack.append(entity)
        else:
            self.object_stack.append(entity)

    def _filter_before(self, items: List[Entity], sentence_id: int, pos: int) -> List[Entity]:
        out: List[Entity] = []
        for e in items:
            if e.sentence_id < sentence_id:
                out.append(e)
            elif e.sentence_id == sentence_id and e.start < pos:
                out.append(e)
        return out

    def get_person_before(
        self,
        sentence_id: int,
        pos: int,
        role: Optional[str] = None,
        gender: Optional[str] = None,
    ) -> Optional[Entity]:
        items = self._filter_before(self.person_stack, sentence_id, pos)
        if not items:
            return None
        candidates = items
        # Filter by gender first (if available), then by role; fallback if empty after filtering
        if gender:
            gender_items = [e for e in candidates if e.gender == gender]
            if gender_items:
                candidates = gender_items
        if role:
            role_items = [e for e in candidates if e.role == role]
            if role_items:
                candidates = role_items
        return candidates[-1]

    def get_object_before(self, sentence_id: int, pos: int) -> Optional[Entity]:
        items = self._filter_before(self.object_stack, sentence_id, pos)
        return items[-1] if items else None

    def get_location_before(self, sentence_id: int, pos: int) -> Optional[Entity]:
        items = self._filter_before(self.location_stack, sentence_id, pos)
        return items[-1] if items else None

    def get_group_before(self, sentence_id: int, pos: int) -> Optional[Entity]:
        items = self._filter_before(self.group_stack, sentence_id, pos)
        return items[-1] if items else None

    def get_event_before(self, sentence_id: int, pos: int) -> Optional[Entity]:
        items = self._filter_before(self.event_stack, sentence_id, pos)
        return items[-1] if items else None

    def get_objects_text_before(self, sentence_id: int, pos: int) -> Optional[str]:
        objs = self._filter_before(self.object_stack, sentence_id, pos)
        if len(objs) < 2:
            return None
        # Use most recent sentence only
        last_sid = max(e.sentence_id for e in objs)
        same = [e for e in objs if e.sentence_id == last_sid]
        # If subject role exists, prefer subject set
        subj = [e for e in same if e.role == "SUBJ"]
        if len(subj) >= 2:
            # Merge other OBJs in same sentence (deduplicate keeping order)
            merged: List[Entity] = []
            for e in same:
                if e in subj or e.role == "SUBJ":
                    merged.append(e)
            for e in same:
                if e not in merged:
                    merged.append(e)
            same = merged
        names: List[str] = []
        for e in same:
            if e.text not in names:
                names.append(e.text)
        if len(names) < 2:
            return None
        if len(names) == 2:
            return names[0] + " and " + names[1]
        return ", ".join(names[:-1]) + " and " + names[-1]

    def get_objects_text_before_obj_only(self, sentence_id: int, pos: int) -> Optional[str]:
        objs = self._filter_before(self.object_stack, sentence_id, pos)
        if not objs:
            return None
        last_sid = max(e.sentence_id for e in objs)
        same = [e for e in objs if e.sentence_id == last_sid and e.role != "SUBJ"]
        if not same:
            return None
        names: List[str] = []
        for e in same:
            if e.text not in names:
                names.append(e.text)
        if len(names) == 1:
            return names[0]
        if len(names) == 2:
            return names[0] + " and " + names[1]
        return ", ".join(names[:-1]) + " and " + names[-1]

    def get_objects_subjects_text_before(self, sentence_id: int, pos: int) -> Optional[str]:
        objs = self._filter_before(self.object_stack, sentence_id, pos)
        if len(objs) < 2:
            return None
        last_sid = max(e.sentence_id for e in objs)
        same = [e for e in objs if e.sentence_id == last_sid and e.role == "SUBJ"]
        names: List[str] = []
        for e in same:
            if e.text not in names:
                names.append(e.text)
        if len(names) < 2:
            return None
        if len(names) == 2:
            return names[0] + " and " + names[1]
        return ", ".join(names[:-1]) + " and " + names[-1]

    def get_persons_text_before(self, sentence_id: int, pos: int) -> Optional[str]:
        persons = self._filter_before(self.person_stack, sentence_id, pos)
        if len(persons) < 2:
            return None
        last_sid = max(e.sentence_id for e in persons)
        same = [e for e in persons if e.sentence_id == last_sid]
        names: List[str] = []
        for e in same:
            if e.text not in names:
                names.append(e.text)
        if len(names) < 2:
            return None
        if len(names) == 2:
            return names[0] + " and " + names[1]
        return ", ".join(names[:-1]) + " and " + names[-1]

    def get_groups_text_before(self, sentence_id: int, pos: int) -> Optional[str]:
        groups = self._filter_before(self.group_stack, sentence_id, pos)
        if len(groups) < 2:
            return None
        last_sid = max(e.sentence_id for e in groups)
        same = [e for e in groups if e.sentence_id == last_sid]
        names: List[str] = []
        for e in same:
            if e.text not in names and e.norm not in names:
                names.append(e.text)
        if len(names) < 2:
            return None
        if len(names) == 2:
            return names[0] + " and " + names[1]
        return ", ".join(names[:-1]) + " and " + names[-1]

    def get_locations_text_before(self, sentence_id: int, pos: int) -> Optional[str]:
        locs = self._filter_before(self.location_stack, sentence_id, pos)
        if len(locs) < 2:
            return None
        last_sid = max(e.sentence_id for e in locs)
        same = [e for e in locs if e.sentence_id == last_sid]
        names: List[str] = []
        for e in same:
            if e.text not in names and e.norm not in names:
                names.append(e.text)
        if len(names) < 2:
            return None
        if len(names) == 2:
            return names[0] + " and " + names[1]
        return ", ".join(names[:-1]) + " and " + names[-1]

    def has_multiple_persons_before(self, sentence_id: int, pos: int) -> bool:
        # Only consider multi-person ambiguity within current sentence
        persons = [e for e in self.person_stack if e.sentence_id == sentence_id and e.start < pos]
        uniq = []
        for e in persons:
            key = e.norm or e.text
            if key not in uniq:
                uniq.append(key)
        return len(uniq) >= 2

    def has_multiple_subjects_in_prev_sentence(self, sentence_id: int) -> bool:
        prev = [e for e in self.person_stack if e.sentence_id == sentence_id - 1 and e.role == "SUBJ"]
        uniq = []
        for e in prev:
            key = e.norm or e.text
            if key not in uniq:
                uniq.append(key)
        if len(uniq) >= 2:
            return True
        # If single SUBJ entity is it
```

### Core Architecture Module: `coreference/english_coreference/ner_adapter.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
NER result normalization: align entity types with Chinese implementation.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from .tokenizer import Mention


@dataclass
class Entity:
    text: str
    type: str
    start: int
    end: int
    sentence_id: int
    norm: str = ""
    role: str = ""
    gender: str = ""


class EnglishNerAdapter:
    ABSTRACT_OBJECT_WORDS = {
        "plan",
        "decision",
        "issue",
        "message",
        "agreement",
        "result",
        "impact",
        "policy",
        "process",
        "proposal",
        "strategy",
        "schedule",
        "delay",
        "change",
        "adjustment",
        "problem",
        "solution",
        "idea",
        "feedback",
        "risk",
        "priority",
        "constraint",
        "goal",
        "assumption",
        "conclusion",
    }
    PERSON_TITLES = {
        "mr",
        "mrs",
        "ms",
        "dr",
        "prof",
        "ceo",
        "cfo",
        "cto",
        "manager",
        "lead",
        "director",
        "president",
        "chairman",
        "founder",
        "investor",
        "mentor",
        "client",
        "auditor",
        "lawyer",
        "editor",
        "author",
        "coach",
        "player",
        "journalist",
        "mayor",
        "minister",
        "delegate",
        "doctor",
        "patient",
        "engineer",
        "engineers",
        "designer",
        "designers",
        "analyst",
        "analysts",
        "trader",
        "traders",
        "professor",
        "student",
        "auditor",
        "teacher",
        "analyst",
        "buyer",
        "nurse",
        "vendor",
        "surgeon",
        "witness",
        "witnesses",
        "judge",
        "advisor",
    }
    COMMON_MALE_NAMES = {"john", "bob", "tom", "jerry", "mike", "smith", "daniel", "mark", "noah", "liam", "alex"}
    COMMON_FEMALE_NAMES = {
        "mary",
        "alice",
        "sarah",
        "lee",
        "ms",
        "mrs",
        "miss",
        "emily",
        "lena",
        "mia",
        "emma",
        "ava",
        "zoe",
        "iris",
        "olivia",
        "nina",
    }
    ORG_HEADS = {
        "company",
        "team",
        "group",
        "department",
        "committee",
        "board",
        "firm",
        "organization",
        "org",
        "corp",
        "startup",
        "agency",
        "clinic",
    }
    GROUP_HEADS = {"team", "group", "department", "committee", "board"}

    def normalize(self, mentions: List[Mention], sentence_id: int) -> List[Entity]:
        entities: List[Entity] = []
        for m in mentions:
            etype = self._map_type(m)
            norm = self._normalize_text(m.text, etype)
            gender = m.gender if m.gender else (self._gender_from_text(m.text) if etype in {"PER", "PER_TITLE"} else "")
            entities.append(
                Entity(
                    text=m.text,
                    type=etype,
                    start=m.start,
                    end=m.end,
                    sentence_id=sentence_id,
                    norm=norm,
                    role=m.role,
                    gender=gender,
                )
            )
        return entities

    def _gender_from_text(self, text: str) -> str:
        t = text.strip().lower()

        # Conjunction (X and Y) may contain different genders, return empty gender
        if " and " in t or ", " in t:
            return ""

        if t.startswith("mr ") or t.startswith("mr.") or t == "mr":
            return "M"
        if t.startswith("mrs ") or t.startswith("mrs.") or t == "mrs":
            return "F"
        if t.startswith("ms ") or t.startswith("ms.") or t == "ms":
            return "F"
        if t.startswith("miss ") or t == "miss":
            return "F"
        # Lightweight guess based on common English names
        last = t.replace(".", "").split()[-1] if t.replace(".", "").split() else ""
        if last in self.COMMON_MALE_NAMES:
            return "M"
        if last in self.COMMON_FEMALE_NAMES:
            return "F"
        return ""

    def _normalize_text(self, text: str, etype: str) -> str:
        t = text.strip()
        low = t.lower()
        if etype in {"PER", "PER_TITLE"}:
            # Remove title, keep surname/last word
            parts = low.replace(".", "").split()
            if parts and parts[0] in self.PERSON_TITLES and len(parts) >= 2:
                return parts[-1]
            return parts[-1] if parts else low
        if etype in {"LOC_ORG", "GROUP"}:
            # Remove articles (the) and common company suffixes
            for p in ("the ",):
                if low.startswith(p):
                    low = low[len(p) :]
            for suf in (" inc", " ltd", " corp", " corporation", " llc"):
                if low.endswith(suf):
                    low = low[: -len(suf)]
            return low
        if etype == "OBJ":
            for art in ("the ", "a ", "an "):
                if low.startswith(art):
                    low = low[len(art) :]
            parts = [p for p in low.replace(".", "").split() if p]
            if parts:
                return parts[-1]
        return low

    def _map_type(self, m: Mention) -> str:
        label = m.type.upper()
        text = m.text.strip().lower()

        # NP handling: check org/group first, then check for person name
        if label == "NP":
            raw = m.text.strip()
            low_raw = raw.lower()
            tokens = [t.strip(",") for t in low_raw.split() if t.strip(",")]
            for h in self.GROUP_HEADS:
                if low_raw.endswith(" " + h) or low_raw == h or low_raw.startswith(("the " + h, "a " + h, "an " + h)):
                    return "GROUP"
            for h in self.ORG_HEADS:
                if low_raw.endswith(" " + h) or low_raw == h or low_raw.startswith(("the " + h, "a " + h, "an " + h)):
                    return "LOC_ORG"
            for t in self.PERSON_TITLES:
                if low_raw == t or low_raw.startswith(("the " + t, "a " + t, "an " + t, t + " ")):
                    return "PER_TITLE"
            for t in self.PERSON_TITLES:
                if t in tokens:
                    return "PER_TITLE"
            # NP starting with article is more likely a common noun
            if low_raw.startswith(("the ", "a ", "an ")):
                return "OBJ"
            # Capitalized word -> likely person name
            if raw and any(w and w[0].isupper() for w in raw.split()):
                return "PER"

        if label == "PERSON":
            return "PER"
        if label in {"ORG", "GPE", "LOC", "FAC"}:
            if text in self.COMMON_MALE_NAMES or text in self.COMMON_FEMALE_NAMES:
                return "PER"
            for t in self.PERSON_TITLES:
                if text == t or text.startswith(t + " ") or text.startswith("the " + t):
                    return "PER_TITLE"
            for h in self.GROUP_HEADS:
                if text.endswith(" " + h) or text == h:
                    return "GROUP"
            return "LOC_ORG"
        if label in {"DATE", "TIME"}:
            return "TIME"

        # NP fallback: prefer abstract objects
        for w in self.ABSTRACT_OBJECT_WORDS:
            if w in text:
                return "OBJ"
        for t in self.PERSON_TITLES:
            if (
                text.startswith(t + " ")
                or text == t
                or text.startswith("the " + t)
                or text.startswith("a " + t)
                or text.startswith("an " + t)
            ):
                return "PER_TITLE"
        for h in self.ORG_HEADS:
            if text.endswith(" " + h) or text == h:
                if h in self.GROUP_HEADS:
                    return "GROUP"
                return "LOC_ORG"
        return "OBJ"

```

### Core Architecture Module: `coreference/english_coreference/tokenizer.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
English tokenization and mention extraction (based on spaCy, conservative NP+NER extraction).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class Mention:
    text: str
    type: str
    start: int
    end: int
    role: str = ""
    gender: str = ""


class EnglishTokenizer:
    def __init__(self, spacy_model: str = "en_core_web_sm") -> None:
        self._nlp = None
        self._model_name = spacy_model

    def _load(self) -> None:
        if self._nlp is not None:
            return
        try:
            import spacy
        except Exception as exc:  # pragma: no cover
            raise RuntimeError("spaCy not installed. Please run: pip install spacy") from exc
        try:
            self._nlp = spacy.load(self._model_name)
        except Exception as exc:  # pragma: no cover
            raise RuntimeError(
                f"spaCy model '{self._model_name}' not found. Run: python -m spacy download en_core_web_sm"
            ) from exc

    def sentence_split(self, text: str) -> List[str]:
        self._load()
        doc = self._nlp(text)
        return [sent.text for sent in doc.sents]

    def parse(self, text: str):
        self._load()
        return self._nlp(text)

    def analyze_mentions(self, text: str) -> List[Mention]:
        """
        Extract mentions: prioritize NER entities, then NP.
        """
        self._load()
        doc = self._nlp(text)
        mentions: List[Mention] = []

        # 1) NER entities
        for ent in doc.ents:
            mentions.append(
                Mention(
                    text=ent.text,
                    type=ent.label_,
                    start=ent.start_char,
                    end=ent.end_char,
                    role="",
                    gender="",
                )
            )

        # 2) NP chunks (exclude NER overlaps, but can backfill roles)
        def _overlap(a_start: int, a_end: int) -> bool:
            for m in mentions:
                if not (a_end <= m.start or a_start >= m.end):
                    return True
            return False

        def _fill_role(a_start: int, a_end: int, role: str, gender: str) -> None:
            if not role:
                role = ""
            for m in mentions:
                if not (a_end <= m.start or a_start >= m.end):
                    if role:
                        m.role = role
                    if gender:
                        m.gender = gender

        for np in doc.noun_chunks:
            # Filter out NPs consisting only of pronouns/determiners
            pos_tags = {t.pos_ for t in np}
            if pos_tags.issubset({"PRON", "DET"}):
                continue
            role = ""
            if np.root.dep_ in {"nsubj", "nsubjpass"}:
                role = "SUBJ"
            elif np.root.dep_ in {"dobj", "obj", "pobj"}:
                role = "OBJ"
            elif np.root.dep_ == "conj":
                head = np.root.head
                while head.dep_ == "conj" and head.head is not None:
                    head = head.head
                head_dep = head.dep_
                if head_dep in {"nsubj", "nsubjpass"}:
                    role = "SUBJ"
                elif head_dep in {"dobj", "obj", "pobj"}:
                    role = "OBJ"
            gender = ""
            low_np = np.text.lower()
            if low_np.startswith("mr ") or low_np.startswith("mr."):
                gender = "M"
            elif (
                low_np.startswith("ms ")
                or low_np.startswith("ms.")
                or low_np.startswith("mrs ")
                or low_np.startswith("mrs.")
                or low_np.startswith("miss ")
            ):
                gender = "F"
            if _overlap(np.start_char, np.end_char):
                _fill_role(np.start_char, np.end_char, role, gender)
                continue
            mentions.append(
                Mention(
                    text=np.text,
                    type="NP",
                    start=np.start_char,
                    end=np.end_char,
                    role=role,
                    gender=gender,
                )
            )

        # sort by position
        mentions.sort(key=lambda m: (m.start, m.end))
        return mentions

    def pos_at(self, text: str, char_index: int) -> Optional[str]:
        """
        Return POS tag (coarse) for a given character position, used for auxiliary rules.
        """
        self._load()
        doc = self._nlp(text)
        for tok in doc:
            if tok.idx <= char_index < tok.idx + len(tok):
                return tok.pos_
        return None

    def extract_event_summary(self, text: str, report_verbs: set[str]) -> Optional[str]:
        """
        Extract coarse-grained event summary: prioritize object/complement noun phrases of report verbs.
        """
        self._load()
        doc = self._nlp(text)
        verb_idx = None
        verb_token = None
        for tok in doc:
            if tok.lemma_.lower() in report_verbs or tok.text.lower() in report_verbs:
                verb_idx = tok.idx
                verb_token = tok
                break
        if verb_token is None or verb_idx is None:
            return None

        # 1) Dependency relation priority: dobj/obj/attr/pobj
        targets = []
        for child in verb_token.children:
            if child.dep_ in {"dobj", "obj", "attr", "pobj"}:
                targets.append(child)
        if targets:
            # Find the NP containing this token
            for np in doc.noun_chunks:
                for t in targets:
                    if np.start <= t.i < np.end:
                        return np.text
            return targets[0].text

        # 2) fallback: first NP after the verb
        for np in doc.noun_chunks:
            if np.start_char > verb_idx:
                return np.text
        return None

    def extract_root_verb(self, text: str) -> Optional[str]:
        self._load()
        doc = self._nlp(text)
        root = None
        for tok in doc:
            if tok.dep_ == "ROOT":
                root = tok
                break
        if root is None:
            return None
        if root.pos_ == "VERB":
            return root.lemma_.lower()
        return None

```

### Core Architecture Module: `m_flow-frontend/src/components/playground/CorefDebugPanel.tsx`
```
"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Users, MapPin, Clock, Box, Zap, ArrowRight, MessageSquare } from "lucide-react";

interface EntityInfo {
  text: string;
  type: string;
  sentence_id: number;
}

export interface CorefDebugData {
  turn_count: number;
  original_query: string;
  resolved_query: string;
  replacements: Array<{ pronoun?: string; replacement?: string; position?: number }>;
  entity_stacks: {
    persons: EntityInfo[];
    objects: EntityInfo[];
    locations: EntityInfo[];
    times: EntityInfo[];
    events: EntityInfo[];
  };
  sentence_count: number;
  last_speaker: string | null;
  last_listener: string | null;
}

interface CorefDebugPanelProps {
  data: CorefDebugData | null;
  history: CorefDebugData[];
}

function EntityStack({ label, icon, entities, color }: {
  label: string;
  icon: React.ReactNode;
  entities: EntityInfo[];
  color: string;
}) {
  if (entities.length === 0) return null;
  return (
    <div className="flex items-start gap-2">
      <div className={`mt-0.5 ${color}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-[#686868] mb-0.5">{label}</div>
        <div className="flex flex-wrap gap-1">
          {entities.map((e, i) => (
            <span
              key={i}
              className="inline-block px-1.5 py-0.5 rounded text-[10px] border border-[#303030] bg-[#161616] text-[#909090]"
            >
              {e.text}
              <span className="text-[#505050] ml-0.5">s{e.sentence_id}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CorefDebugPanel({ data, history }: CorefDebugPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  if (!data && history.length === 0) return null;

  const allEntries = [...history, ...(data ? [data] : [])];

  return (
    <div className="border-t border-[#222222]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2 text-[11px] text-[#686868] hover:text-[#909090] transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <MessageSquare size={11} />
        <span>Coreference Resolution</span>
        {data && (
          <span className="ml-auto text-[10px] tabular-nums text-[#686868]">
            Turn {data.turn_count} &middot; {data.sentence_count} sentences tracked
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2.5">
          {/* Current resolution */}
          {data && data.original_query !== data.resolved_query && (
            <div className="p-2.5 rounded-lg bg-[#121212] border border-[#252525]">
              <div className="text-[10px] text-[#585858] mb-1.5">Current Resolution</div>
              <div className="flex items-start gap-2 text-xs">
                <div className="flex-1 p-1.5 rounded bg-[#0e0e0e] border border-[#222222] text-[#b09070] break-all">
                  {data.original_query}
                </div>
                <ArrowRight size={14} className="text-[#444444] mt-1 flex-shrink-0" />
                <div className="flex-1 p-1.5 rounded bg-[#0e0e0e] border border-[#222222] text-[#70a088] break-all">
                  {data.resolved_query}
                </div>
              </div>
              {data.replacements.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {data.replacements.map((r, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[#181818] text-[#808080] border border-[#2a2a2a]">
                      {r.pronoun || "?"} → {r.replacement || "?"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {data && data.original_query === data.resolved_query && (
            <div className="p-2 rounded-lg bg-[#121212] border border-[#252525] text-[10px] text-[#585858]">
              No resolutions needed — input: <span className="text-[#909090]">{data.original_query}</span>
            </div>
          )}

          {/* Entity tracker state */}
          {data && (
            <div className="p-2.5 rounded-lg bg-[#121212] border border-[#252525] space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[10px] text-[#585858]">Entity Tracker State</div>
                <div className="flex gap-2 text-[10px] text-[#585858]">
                  {data.last_speaker && (
                    <span>Speaker: <span className="text-[#808080]">{data.last_speaker}</span></span>
                  )}
                  {data.last_listener && (
                    <span>Listener: <span className="text-[#808080]">{data.last_listener}</span></span>
                  )}
                </div>
              </div>
              <EntityStack label="Persons" icon={<Users size={10} />} entities={data.entity_stacks.persons} color="text-[#687080]" />
              <EntityStack label="Objects" icon={<Box size={10} />} entities={data.entity_stacks.objects} color="text-[#806858]" />
              <EntityStack label="Locations" icon={<MapPin size={10} />} entities={data.entity_stacks.locations} color="text-[#608070]" />
              <EntityStack label="Times" icon={<Clock size={10} />} entities={data.entity_stacks.times} color="text-[#706880]" />
              <EntityStack label="Events" icon={<Zap size={10} />} entities={data.entity_stacks.events} color="text-[#806068]" />
            </div>
          )}

          {/* Accumulated history */}
          {allEntries.length > 1 && (
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-1.5 text-[10px] text-[#585858] hover:text-[#808080] transition-colors"
              >
                {showHistory ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                Accumulated Context ({allEntries.length} turns)
              </button>
              {showHistory && (
                <div className="mt-1.5 space-y-1 max-h-[200px] overflow-y-auto">
                  {allEntries.map((entry, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 p-1.5 rounded text-[10px] ${
                        i === allEntries.length - 1
                          ? "bg-[#161616] border border-[#2a2a2a]"
                          : "bg-[#0e0e0e]"
                      }`}
                    >
                      <span className="text-[#484848] tabular-nums flex-shrink-0 w-4 text-right">
                        {i + 1}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[#808080] break-all">{entry.original_query}</div>
                        {entry.original_query !== entry.resolved_query && (
                          <div className="text-[#70a088] break-all mt-0.5">
                            → {entry.resolved_query}
                            {entry.replacements.map((r, ri) => (
                              <span key={ri} className="ml-1 text-[#687080]">
                                [{r.pronoun}→{r.replacement}]
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

Co-authored-by: Cursor <[REDACTED_EMAIL]>

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

**File**: `.github/workflows/test_ollama.yml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 # M-Flow — Ollama integration gate (phi4 + avr/sfr-embedding-mistral).
 # -----------------------------------------------------------------------------
 # Reusable workflow: local-LLM smoke on BuildJet (≥32 GB RAM). Repository:
-# FlowElement-ai/m_flow — header and job layout are project-specific; keep in sync
+# FlowElement-xinliuyuansu/m_flow — header and job layout are project-specific; keep in sync
 # with the project README LLM configuration examples only by semantics, not text.
 # -----------------------------------------------------------------------------
 name: test | Ollama Local-LLM Integration
```

**File**: `.github/workflows/update-contributors.yml` (modified, +2/-2)
```diff
@@ -28,8 +28,8 @@ jobs:
             echo ""
             echo "Thank you to everyone who has contributed to M-flow!"
             echo ""
-            echo '<a href="https://github.com/FlowElement-ai/m_flow/graphs/contributors">'
-            echo '  <img src="https://contrib.rocks/image?repo=FlowElement-ai/m_flow" />'
+            echo '<a href="https://github.com/FlowElement-xinliuyuansu/m_flow/graphs/contributors">'
+            echo '  <img src="https://contrib.rocks/image?repo=FlowElement-xinliuyuansu/m_flow" />'
             echo "</a>"
             echo ""
             echo "## Top Contributors"
```

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -102,4 +102,4 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - LanceDB vector storage integration
 - KuzuDB graph database adapter
 
-For detailed release notes, see [GitHub Releases](https://github.com/FlowElement-ai/m_flow/releases).
+For detailed release notes, see [GitHub Releases](https://github.com/FlowElement-xinliuyuansu/m_flow/releases).
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

**File**: `m_flow/llm/utils.py` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ def get_max_chunk_tokens() -> int:
     half_llm_context = language_model.max_completion_tokens // 2
     embedding_cap = embedding_backend.max_completion_tokens
 
-    return embedding_cap if embedding_cap <= half_llm_context else half_llm_context
+    return min(embedding_cap, half_llm_context)
 
 
 def get_model_max_completion_tokens(model_name: str) -> Optional[int]:
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

Signed-off-by: Alexazhu <[REDACTED_EMAIL]>

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

**File**: `m_flow/shared/utils.py` (modified, +41/-0)
```diff
@@ -149,6 +149,47 @@ def _stop() -> None:
 start_visualization_server = launch_viz_server  # alias
 
 
+# ---------------------------------------------------------------------------
+# Datetime serialization
+# ---------------------------------------------------------------------------
+
+
+def to_iso_z(dt: Optional[datetime]) -> Optional[str]:
+    """Serialize a datetime to an ISO-8601 string ending with a single ``Z``.
+
+    The previous idiom ``dt.isoformat() + "Z"`` is **buggy when ``dt`` is
+    timezone-aware**, because ``isoformat()`` already emits an offset such as
+    ``"+00:00"`` and the appended ``"Z"`` produces a double timezone marker
+    (``"…+00:00Z"``) that pydantic rejects with ``datetime_from_date_parsing``.
+
+    This helper guarantees a single, well-formed UTC marker in every case:
+
+    - ``None`` → ``None`` (passthrough).
+    - timezone-naive datetimes are *assumed* to be UTC (the same assumption
+      the legacy ``+ "Z"`` idiom encoded) and are serialized with a trailing
+      ``Z`` directly.
+    - timezone-aware datetimes are converted to UTC and then serialized with
+      ``Z`` substituted for the ``+00:00`` offset.
+
+    Examples
+    --------
+    >>> from datetime import datetime, timezone, timedelta
+    >>> to_iso_z(None) is None
+    True
+    >>> to_iso_z(datetime(2026, 4, 23, 1, 38, 12, 734433))
+    '2026-04-23T01:38:12.734433Z'
+    >>> to_iso_z(datetime(2026, 4, 23, 1, 38, 12, 734433, tzinfo=timezone.utc))
+    '2026-04-23T01:38:12.734433Z'
+    >>> to_iso_z(datetime(2026, 4, 23, 9, 38, 12, 734433, tzinfo=timezone(timedelta(hours=8))))
+    '2026-04-23T01:38:12.734433Z'
+    """
+    if dt is None:
+        return None
+    if dt.tzinfo is None:
+        return dt.isoformat() + "Z"
+    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
+
+
 # ---------------------------------------------------------------------------
 # Visualization helpers (bokeh logo embedding kept for compat)
 # ---------------------------------------------------------------------------
```

**File**: `m_flow/tests/unit/shared/test_to_iso_z.py` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+"""Unit tests for ``m_flow.shared.utils.to_iso_z`` (issue #116).
+
+The legacy idiom ``dt.isoformat() + "Z"`` produced a malformed double timezone
+marker (``"…+00:00Z"``) when the datetime was timezone-aware — for example
+when read from a Postgres ``timestamp with time zone`` column. Pydantic
+rejected those strings with ``datetime_from_date_parsing``, causing
+``ActivityDTO``, ``DatasetDTO`` and ``Dataset.to_json()`` callers to crash
+with HTTP 500.
+
+These tests pin the corrected behaviour: a single, well-formed UTC marker in
+every input case.
+"""
+
+from __future__ import annotations
+
+from datetime import datetime, timedelta, timezone
+
+import pytest
+
+from m_flow.shared.utils import to_iso_z
+
+
+class TestToIsoZ:
+    """Pinning ``to_iso_z`` semantics across naive / aware inputs."""
+
+    def test_returns_none_for_none_input(self) -> None:
+        assert to_iso_z(None) is None
+
+    def test_naive_datetime_keeps_isoformat_and_appends_single_z(self) -> None:
+        # The same shape the legacy ``+ "Z"`` idiom produced for naive values.
+        assert to_iso_z(datetime(2026, 4, 23, 1, 38, 12, 734433)) == "2026-04-23T01:38:12.734433Z"
+
+    def test_naive_datetime_without_microseconds(self) -> None:
+        assert to_iso_z(datetime(2026, 4, 23, 12, 30, 0)) == "2026-04-23T12:30:00Z"
+
+    def test_aware_utc_datetime_does_not_emit_double_marker(self) -> None:
+        # Regression for issue #116: a Postgres ``timestamp with time zone``
+        # column yields a tzinfo-aware datetime in UTC; the legacy idiom
+        # produced ``2026-04-23T01:38:12.734433+00:00Z``.
+        result = to_iso_z(datetime(2026, 4, 23, 1, 38, 12, 734433, tzinfo=timezone.utc))
+        assert result == "2026-04-23T01:38:12.734433Z"
+        assert "+00:00" not in (result or "")
+        assert (result or "").count("Z") == 1
+
+    def test_aware_non_utc_datetime_is_normalised_to_utc(self) -> None:
+        # 09:38 +08:00 is the same instant as 01:38 UTC.
+        beijing = timezone(timedelta(hours=8))
+        result = to_iso_z(datetime(2026, 4, 23, 9, 38, 12, 734433, tzinfo=beijing))
+        assert result == "2026-04-23T01:38:12.734433Z"
+
+    def test_negative_offset_is_normalised(self) -> None:
+        eastern = timezone(timedelta(hours=-5))
+        result = to_iso_z(datetime(2026, 4, 22, 20, 38, 12, 734433, tzinfo=eastern))
+        assert result == "2026-04-23T01:38:12.734433Z"
+
+    @pytest.mark.parametrize(
+        "dt",
+        [
+            datetime(2026, 1, 1, 0, 0, 0),
+            datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc),
+            datetime(2026, 1, 1, 8, 0, 0, tzinfo=timezone(timedelta(hours=8))),
+        ],
+    )
+    def test_output_is_pydantic_parseable(self, dt: datetime) -> None:
+        # The original failure mode in #116 was pydantic refusing to accept the
+        # serialized string; verify any output ``to_iso_z`` produces survives a
+        # full parse round-trip.
+        from pydantic import TypeAdapter
+
+        s = to_iso_z(dt)
+        assert s is not None
+        parsed = TypeAdapter(datetime).validate_python(s)
+        assert parsed.tzinfo is not None
+        assert parsed.utcoffset() == timedelta(0)
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
+            string. The contract matches the historical direct-mode return
+            shape so existing callers (the MCP ``query`` tool) need no
+            changes.
 
         Raises:
-            NotImplementedError: When running in remote mode.
+            httpx.HTTPStatusError: For any non-2xx response from the API.
         """
         if self._remote:
-            raise NotImplementedError("High-level query is unavailable in remote mode")
+            url = f"{self._base_url}/api/v1/search/query"
+            payload: Dict[str, Any] = {"question": question, "mode": mode, "top_k": top_k}
+            if datasets is not None:
+                payload["datasets"] = datasets
+            resp = await self._http.post(url, json=payload, headers=self._auth_headers())
+            resp.raise_for_status()
+            data = resp.json()
+            if isinstance(data, dict):
+                # Mirror direct-mode collapse: prefer LLM answer, otherwise
+                # surface the 
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
+        client = _make_remote_client(token="t")
+        client._http = _StubHTTP(
+            _StubResponse(200, {"answer": None, "context": ["episode-1", "episode-2"], "datasets": []})
+        )
+
+        result = await client.query(question="Recent events?", mode="episodic")
+
+        # Without an LLM-generated answer, the context list is rendered as a
+        # string for downstream MCP TextContent rendering.
+        assert "episode-1" in result
+        assert "episode-2" in result
+
+    asyncio.run(run())
+
+
+def test_remote_query_omits_datasets_when_not_provided() -> None:
+    async def run() -> None:
+        client = _make_remote_client(token="t")
+        client._http = _StubHTTP(_StubResponse(200, {"answer": "ok", "context": [], "datasets": []}))
+
+        await client.query(question="anything?")
+
+        _, _, payload, _ = client._http.calls[0]
+        assert "datasets" not in payload  # absent rather than null
+        assert payload["mo
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
+                content={"error": "Permission denied for one or more requested datasets."},
+            )
+        except Exception as err:
+            return JSONResponse(status_code=409, content={"error": str(err)})
+
     return router
```

**File**: `m_flow/tests/unit/api/test_search_simplification.py` (modified, +57/-0)
```diff
@@ -249,5 +249,62 @@ def _get_search_file(self) -> pathlib.Path:
         return mflow_root / "api" / "v1" / "search" / "search.py"
 
 
+# ============================================================
+# Test the simplified /query HTTP endpoint added for issue #112
+# ============================================================
+
+
+class TestSimplifiedQueryEndpoint:
+    """Verify the POST /api/v1/search/query endpoint is wired up."""
+
+    def test_router_declares_query_payload_dto(self):
+        """The new endpoint exposes a typed request body."""
+        router_file = self._get_router_file()
+        content = router_file.read_text()
+        assert "class QueryPayloadDTO" in content
+        assert "question:" in content
+        assert "mode:" in content
+        assert "top_k:" in content
+
+    def test_router_declares_query_response_dto(self):
+        """The new endpoint declares a typed response."""
+        router_file = self._get_router_file()
+        content = router_file.read_text()
+        assert "class QueryResponseDTO" in content
+        assert "answer:" in content
+        assert "context:" in content
+        assert "datasets:" in content
+
+    def test_router_registers_post_query_endpoint(self):
+        """Confirm POST /query is registered on the search router."""
+        router_file = self._get_router_file()
+        content = router_file.read_text()
+        assert '@router.post("/query"' in content
+        assert "async def execute_query" in content
+
+    def test_endpoint_delegates_to_search_query(self):
+        """The handler must delegate to the existing query() helper."""
+        router_file = self._get_router_file()
+        content = router_file.read_text()
+        # The handler imports and awaits the simplified query() function
+        # rather than re-implementing the logic.
+        assert "from m_flow.api.v1.search.search import query as query_impl" in content
+        assert "await query_impl(" in content
+
+    def test_endpoint_enforces_authentication(self):
+        """The handler depends on the authenticated-user fixture."""
+        router_file = self._get_router_file()
+        content = router_file.read_text()
+        # `_auth_dep()` is the project's authenticated-user dependency.
+        # Both /search and /search/query must use it so that dataset
+        # visibility and permission enforcement match.
+        assert content.count("Depends(_auth_dep())") >= 2
+
+    def _get_router_file(self) -> pathlib.Path:
+        current = pathlib.Path(__file__)
+        mflow_root = current.parent.parent.parent.parent
+        return mflow_root / "api" / "v1" / "search" / "routers" / "get_search_router.py"
+
+
 if __name__ == "__main__":
     pytest.main([__file__, "-v"])
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
+        # Refresh recency so that completed records are not the first
+        # to be evicted while RUNNING placeholders age.
+        _task_registry.move_to_end(task_id)
+
+
+async def _get_task_record(task_id: str) -> Optional[TaskRecord]:
+    async with _task_registry_lock:
+        return _task_registry.get(task_id)
+
+
+async def _run_tracked_task(
+    task_id: str,
+    coro_factory: Callable[[], Awaitable[None]],
+) -> None:
+    """Execute a background coroutine and record its outcome.
+
+    Wraps the user-provided coroutine factory so any exception is captured
+    into the task registry. Errors are still logged at ERROR level so the
+    existing log-based observability continues to work; the registry only
+    adds an additional channel that callers can poll.
+    """
+    try:
+        await coro_factory()
+        await _record_task_outcome(task_id, TaskState.SUCCESS)
+    except Exception as exc:
+        _log.error("[task=%s] background task failed: %s", task_id, exc)
+        _log.debug(
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
+    record = await server._get_task_record(task_id)
+    assert record is not None
+    assert record.state == server.TaskState.FAILED
+    assert record.error_type == "RuntimeError"
+    assert "LLM key expired" in (record.error_message or "")
+
+
+# ---------------------------------------------------------------------------
+# memorize_status: per-task lookup
+# ---------------------------------------------------------------------------
+
+
+@pytest.mark.asyncio
+async def test_memorize_status_with_task_id_returns_record(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    async def fake_add(content: str, dataset_name: str) -> None:
+        raise ValueError("graph DB locked")
+
+    async def fake_memorize(**kwargs: object) -> None:  # pragma: no cover
+        return None
+
+    scheduled: list[asyncio.Task[Any]] = []
+    monkeypatch.setattr(server, "_client", SimpleNamespace(add=fake_add, memorize=fake_memorize))
+    _capture_create_task(scheduled, monkeypatch)
+
+    started = await s
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

### Incident Patch 9: `4a061454` (2026-04-19)
**Commit Message**: docs(readme): simplify retrieval examples and add visual guides (#86)

Make the retrieval comparison more accessible for non-technical readers, emphasize key points with clearer formatting, and add diagrams for association propagation and multi-granularity anchors.

Made-with: Cursor

Co-authored-by: Junting Hua <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +52/-14)
```diff
@@ -28,35 +28,37 @@ The real shift is not whether a system builds a graph, but what the graph is all
 
 In most RAG systems, retrieval is still dominated by similarity: the query is embedded, textual units are ranked by vector distance, and structure—if present—mainly helps organize, summarize, or expand context. Many GraphRAG systems add entities, relations, and community structure, but the graph often remains supportive rather than decisive in scoring.
 
-M-flow takes a different approach. Vector search is used primarily to open candidate entry points across multiple granularities. From there, retrieval becomes graph-led: evidence moves through typed, semantically weighted edges, and each knowledge unit is scored by the strongest supporting path that links it to the query.
+M-flow takes a different approach: the graph is the scoring engine. When a query arrives, vector search casts a wide net across multiple granularities to find entry points. Then **the graph takes over** — propagating evidence along typed, semantically weighted edges, and scoring each knowledge unit by the *strongest* chain of reasoning that connects it to the query.
 
-That distinction matters because similarity and relevance are not identical. Similarity is proximity in representation space. Relevance is whether the system can connect the query to the answer through a coherent structure of evidence.
+That distinction matters because similarity and relevance are not identical.  
+*Similarity* is proximity in representation space. *Relevance* is whether the system can connect the query to the answer through a coherent structure of evidence.
 
-Consider the query **"Why did the migration fail?"**
+<u>Similar</u> and <u>relevant</u> sometimes overlap, but they are fundamentally different.  
+Consider a non-technical query: **"Why did I miss my flight?"**
 
 **Traditional retrieval** — matches by surface similarity:
 
 ```mermaid
 flowchart LR
-    Q["Query: Why did the\nmigration fail?"] -->|"embed → cosine similarity"| C1["Chunk: Database migration\nbest practices checklist"]
-    C1 -->|"✗ wrong answer"| R["keywords match,\nbut answers a\ndifferent question"]
+    Q["Query: Why did I\nmiss my flight?"] -->|"embed → similarity"| C1["Document: airport checklist\n(passport, baggage, gate)"]
+    C1 -->|"✗ sounds related,\nbut not causal"| R["good travel tips,\nwrong explanation"]
 ```
 
-**M-flow retrieval** — traces through the knowledge graph:
+**M-flow retrieval** — traces through a causal memory path:
 
 ```mermaid
 flowchart LR
-    Q["Query: Why did the\nmigration fail?"] -->|search| FP["FacetPoint\nconnection pool\nexhausted at 2:47 AM"]
-    FP -->|"edge:pool failure caused\nservice downtime"| F["Facet\nRedis failure\nanalysis"]
-    F -->|"edge:core incident\ndetails"| E["Episode\nProduction outage\nFeb 12"]
-    E -->|"✓ correct result"| R["Redis connection pool\nexhausted under peak load"]
+    Q["Query: Why did I\nmiss my flight?"] -->|anchor| FP["FacetPoint\nalarm dismissed at 6:30"]
+    FP -->|"led to"| F["Facet\nleft home 40 min late"]
+    F -->|"caused"| E["Episode\nmissed airport check-in"]
+    E -->|"✓ useful answer"| R["Primary cause:\nlate departure from home"]
 ```
 
-> Zero keyword overlap with "migration" — found through graph path, not text similarity.
+> **Key idea:** the answer is found through an *evidence path*, not keyword overlap.
 
-The graph finds the answer not by matching words, but by following the chain of evidence. This difference — **from distance-based ranking to path-based reasoning** — is what drives M-flow's consistent advantage across benchmarks.
+The graph finds the answer not by matching words, but by following the chain of evidence. This difference — **from candidate matching to path-cost retrieval** — is what drives M-flow's advantage in our reported benchmarks.
 
-**M-flow operates like a cognitive system: it captures signal at the sharpest point of detail, traces associations through structured memory, and arrives at the right answer the way human recall does.**
+**M-flow operates like a cognitive system:** it captures signal at the sharpest point of detail, traces associations through structured memory, and arrives at the right answer the way human recall does.
 
 ## How It Works
 
@@ -69,7 +71,43 @@ M-flow organizes knowledge into a four-level **Cone Graph** — a layered hierar
 | **FacetPoint** | An atomic assertion or fact derived from a Facet | *"Was the P99 target under 500ms?"* |
 | **Entity** | A named thing — person, tool, metric — linked across all Episodes | *"Tell me about GPT-4o"* → surfaces all related contexts |
 
-Retrieval is **graph-routed**: the system casts a wide net across all levels, projects hits into the knowledge graph, propagates cost along every possible path, and scores each Episode by its **tightest chain of evidence**. One strong path is enough — the way a single association triggers an entire memory.
+Retrieval is **graph-routed**: the system casts a wide ne
```

---

### Incident Patch 10: `b6b9157a` (2026-04-18)
**Commit Message**: fix(ci): make workflow gates fork-aware for external PRs (#83)

Prevent fork PRs from failing due to unavailable trusted secrets by adding lightweight fork checks and conditional CI aggregation, while keeping full strict gates for trusted contexts.

Made-with: Cursor

Signed-off-by: Junting Hua <[REDACTED_EMAIL]>
Co-authored-by: Junting Hua <[REDACTED_EMAIL]>

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

### Incident Patch 11: `99062ff7` (2026-04-17)
**Commit Message**: fix(ci): avoid secrets context in load-test job condition (#78)

GitHub Actions does not allow using the secrets context in a job-level if expression for this workflow validation path. Add a precheck step and gate later steps via its output instead.

Made-with: Cursor

Co-authored-by: Junting Hua <[REDACTED_EMAIL]>

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

---

### Incident Patch 12: `e057346f` (2026-04-17)
**Commit Message**: fix(ci): align reusable load-test secrets with workflow usage (#77)

Declare the S3 secret names expected by the load test job so workflow_call validation no longer fails before jobs start.

Made-with: Cursor

Co-authored-by: Junting Hua <[REDACTED_EMAIL]>

**File**: `.github/workflows/load_tests.yml` (modified, +2/-2)
```diff
@@ -23,8 +23,8 @@ on:
       EMBEDDING_API_KEY:      { required: true }
       EMBEDDING_API_VERSION:  { required: false }
       OPENAI_API_KEY:         { required: true }
-      AWS_ACCESS_KEY_ID:      { required: false }
-      AWS_SECRET_ACCESS_KEY:  { required: false }
+      AWS_S3_DEV_USER_KEY_ID:      { required: false }
+      AWS_S3_DEV_USER_SECRET_KEY:  { required: false }
 
 permissions:
   contents: read
```

---

### Incident Patch 13: `e837df98` (2026-04-17)
**Commit Message**: fix(mcp): avoid json content-type for remote update uploads (#76)

**File**: `m_flow-mcp/src/m_flow_client.py` (modified, +5/-3)
```diff
@@ -45,9 +45,11 @@ def __init__(
 
             self._engine = _mf
 
-    def _auth_headers(self) -> Dict[str, str]:
+    def _auth_headers(self, include_json_content_type: bool = True) -> Dict[str, str]:
         """Build common request headers including optional authorization."""
-        hdrs: Dict[str, str] = {"Content-Type": "application/json"}
+        hdrs: Dict[str, str] = {}
+        if include_json_content_type:
+            hdrs["Content-Type"] = "application/json"
         if self._token:
             hdrs["Authorization"] = f"Bearer {self._token}"
         return hdrs
@@ -395,7 +397,7 @@ async def update(
                 url,
                 params={"data_id": data_id, "dataset_id": dataset_id},
                 files=payload,
-                headers=self._auth_headers(),
+                headers=self._auth_headers(include_json_content_type=False),
             )
             resp.raise_for_status()
             return resp.json()
```

**File**: `m_flow-mcp/src/test_m_flow_client.py` (modified, +31/-0)
```diff
@@ -53,11 +53,42 @@ def json(self) -> dict:
 class RecordingAsyncClient:
     def __init__(self) -> None:
         self.posts: list[tuple[str, dict, dict]] = []
+        self.patches: list[tuple[str, dict, list, dict]] = []
 
     async def post(self, url: str, json: dict, headers: dict) -> DummyResponse:
         self.posts.append((url, json, headers))
         return DummyResponse({"success": True, "message": "started"})
 
+    async def patch(self, url: str, params: dict, files: list, headers: dict) -> DummyResponse:
+        self.patches.append((url, params, files, headers))
+        return DummyResponse({"success": True, "message": "updated"})
+
+
+def test_remote_update_uses_multipart_without_json_content_type() -> None:
+    async def run() -> None:
+        client = MflowClient(server_url="https://example.com", auth_token="secret")
+        client._http = RecordingAsyncClient()
+
+        result = await client.update(
+            data_id="11111111-1111-1111-1111-111111111111",
+            dataset_id="22222222-2222-2222-2222-222222222222",
+            data="patched content",
+        )
+
+        assert result == {"success": True, "message": "updated"}
+        assert client._http.patches
+
+        url, params, files, headers = client._http.patches[0]
+        assert url == "https://example.com/api/v1/update"
+        assert params == {
+            "data_id": "11111111-1111-1111-1111-111111111111",
+            "dataset_id": "22222222-2222-2222-2222-222222222222",
+        }
+        assert headers == {"Authorization": "Bearer secret"}
+        assert files[0][0] == "data"
+
+    asyncio.run(run())
+
 
 def test_remote_learn_targets_requested_dataset_names() -> None:
     async def run() -> None:
```

---

### Incident Patch 14: `e0881a87` (2026-04-17)
**Commit Message**: fix(mcp): pass datasets through local search client (#75)

**File**: `m_flow-mcp/src/m_flow_client.py` (modified, +2/-0)
```diff
@@ -180,6 +180,8 @@ async def search(
                 "query_text": query_text,
                 "top_k": top_k,
             }
+            if datasets:
+                params["datasets"] = datasets
             if system_prompt:
                 params["system_prompt"] = system_prompt
             if enable_hybrid_search is not None:
```

**File**: `m_flow-mcp/src/test_m_flow_client.py` (modified, +28/-0)
```diff
@@ -3,6 +3,7 @@
 import asyncio
 import os
 import sys
+from types import SimpleNamespace
 
 import pytest
 
@@ -11,6 +12,33 @@
 from m_flow_client import MflowClient
 
 
+def test_direct_search_forwards_datasets_to_engine() -> None:
+    async def run() -> None:
+        client = object.__new__(MflowClient)
+        client._remote = False
+
+        captured: dict[str, object] = {}
+
+        async def fake_search(**kwargs: object) -> dict[str, str]:
+            captured.update(kwargs)
+            return {"status": "ok"}
+
+        client._engine = SimpleNamespace(search=fake_search)
+
+        result = await client.search(
+            query_text="where is alpha",
+            query_type="EPISODIC",
+            datasets=["alpha"],
+            top_k=3,
+        )
+
+        assert result == {"status": "ok"}
+        assert captured["datasets"] == ["alpha"]
+        assert captured["top_k"] == 3
+
+    asyncio.run(run())
+
+
 class DummyResponse:
     def __init__(self, payload: dict):
         self._payload = payload
```

---

### Incident Patch 15: `acf9136e` (2026-04-17)
**Commit Message**: fix(mcp): memorize the requested dataset in remote mode (#72)

* fix(mcp): memorize the requested dataset in remote mode

* test(mcp): cover requested dataset in remote memorize

**File**: `m_flow-mcp/src/server.py` (modified, +1/-1)
```diff
@@ -120,7 +120,7 @@ async def _task(content: str, ds_name: str = "main_dataset"):
             try:
                 _log.info("记忆化处理开始: dataset=%s", ds_name)
                 await _client.add(content, dataset_name=ds_name)
-                await _client.memorize(enable_content_routing=False)
+                await _client.memorize(datasets=[ds_name], enable_content_routing=False)
                 _log.info("记忆化处理完成: dataset=%s", ds_name)
             except Exception as e:
                 _log.error("记忆化处理失败: %s", e)
```

**File**: `m_flow-mcp/src/test_server_memorize.py` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+from __future__ import annotations
+
+import asyncio
+from types import SimpleNamespace
+
+import pytest
+
+from src import server
+
+
+@pytest.mark.asyncio
+async def test_memorize_passes_requested_dataset_name_to_client_memorize(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    calls: list[tuple[str, object]] = []
+    scheduled: list[asyncio.Task[None]] = []
+
+    async def fake_add(content: str, dataset_name: str) -> None:
+        calls.append(("add", {"content": content, "dataset_name": dataset_name}))
+
+    async def fake_memorize(**kwargs: object) -> None:
+        calls.append(("memorize", kwargs))
+
+    original_create_task = asyncio.create_task
+
+    def capture_task(coro: object) -> asyncio.Task[None]:
+        task = original_create_task(coro)
+        scheduled.append(task)
+        return task
+
+    monkeypatch.setattr(server, "_client", SimpleNamespace(add=fake_add, memorize=fake_memorize))
+    monkeypatch.setattr(server.asyncio, "create_task", capture_task)
+
+    result = await server.memorize("hello", dataset_name="beta")
+    await asyncio.gather(*scheduled)
+
+    assert len(result) == 1
+    assert calls == [
+        ("add", {"content": "hello", "dataset_name": "beta"}),
+        ("memorize", {"datasets": ["beta"], "enable_content_routing": False}),
+    ]
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
