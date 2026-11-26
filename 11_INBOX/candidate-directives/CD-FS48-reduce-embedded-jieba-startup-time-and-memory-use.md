# Candidate Directive: [CD-FS48] reduce embedded Jieba startup time and memory use

<!-- PROVENANCE_START
{
  "source_repository": "alibaba/zvec",
  "source_url": "https://github.com/alibaba/zvec",
  "source_version": "ee15ab0a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T18:41:52.664Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-alibaba-zvec",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [alibaba/zvec](https://github.com/alibaba/zvec) (Revision: `ee15ab0a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T18:41:52.664Z`  
> **Learning ID**: `learn-github-alibaba-zvec`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `scripts/generate_jieba_embedded_dict.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in alibaba/zvec. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ee15ab0a`: fts): reduce embedded Jieba startup time and memory use. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `scripts/generate_jieba_embedded_dict.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
"""Generate the precompiled Jieba main dictionary and embedded HMM model.
import itertools
import struct
def compile_dictionary(source: bytes) -> tuple[bytes, str]:
    """Store cppjieba entries in source order, in little-endian columns.

    Each entry has a uint16 rune count, uint16 tag byte count and uint32
    frequency. The variable-length columns hold UTF-32LE words and UTF-8 tags.
    """
    word_lengths = bytearray()
    tag_lengths = bytearray()
    frequencies = bytearray()
    words = bytearray()
    tags = bytearray()
    counts = []
    spellings = []
    for line in source.splitlines():
        word, count, tag = line.split()
        spelling = word.decode("utf-8")
        spellings.append(spelling)
        runes = spelling.encode("utf-32-le")
        frequency = int(count)
        if not (0 < frequency <= 0xFFFFFFFF):
            raise ValueError(f"invalid dictionary frequency: {count!r}")
        word_lengths.extend(struct.pack("<H", len(runes) // 4))
        tag_lengths.extend(struct.pack("<H", len(tag)))
        frequencies.extend(struct.pack("<I", frequency))
        words.extend(runes)
        tags.extend(tag)
        counts.append(frequency)

    if not counts
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
"""Generate embedded Jieba dictionaries as raw LZ4 blocks.
        stream.write(f"constexpr std::size_t {symbol}OriginalSize = {len(original)};\n")
 
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ee15ab0a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T18:41:52.662Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795718512662",
    "title": "reduce embedded Jieba startup time and memory use",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "alibaba/zvec",
    "source_uri": "https://github.com/alibaba/zvec",
    "source_version": "HEAD",
    "content_hash": "2dfabf431b515538475205c1e4cb65fa9d5980693f62de33a25f8313f0f04308"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.6,
      "tier": "TIER_3_COMMUNITY_OPEN",
      "findings": [],
      "details": [
        "Source originates from community open repository",
        "Source version unpinned (HEAD), subject to upstream drift",
        "Cryptographic SHA-256 payload integrity hash present"
      ]
    },
    "evidence_quality": {
      "status": "FAIL",
      "score": 0,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [],
      "details": [
        "Direct empirical evidence ratio: 0% (0/4)",
        "Evidence-to-claim lexical alignment: 0%"
      ]
    },
    "technical_correctness": {
      "status": "PASS",
      "score": 1,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": false,
      "opposing_rule": null,
      "unsupported_assumptions": [],
      "findings": [],
      "details": [
        "No direct opposition with canonical operating directives",
        "Substantive technical content verified (> 40 chars)"
      ]
    },
    "reusability": {
      "status": "PASS",
      "score": 1,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
        "Expresses generalized engineering invariants (4 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 1,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)",
        "Includes explicit negative example / anti-pattern contrast"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-26T18:41:52.662Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "PASS",
      "score": 1,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": false,
      "conflicting_rule": null,
      "findings": [],
      "details": []
    }
  },
  "detected_contradictions": [],
  "missing_information": [
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "c3f8fe0f532fd788eec172d45a42d46b2f90744746cda89260ea133703b0929e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
