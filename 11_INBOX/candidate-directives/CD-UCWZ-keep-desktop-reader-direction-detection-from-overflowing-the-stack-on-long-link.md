# Candidate Directive: [CD-UCWZ] Keep desktop reader direction detection from overflowing the stack on long link

<!-- PROVENANCE_START
{
  "source_repository": "prof18/feed-flow",
  "source_url": "https://github.com/prof18/feed-flow",
  "source_version": "dcaa91c6",
  "license": "Apache-2.0",
  "timestamp": "2026-11-25T15:21:35.459Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-prof18-feed-flow",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [prof18/feed-flow](https://github.com/prof18/feed-flow) (Revision: `dcaa91c6`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-25T15:21:35.459Z`  
> **Learning ID**: `learn-github-prof18-feed-flow`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `shared/src/jvmMain/kotlin/com/prof18/feedflow/shared/domain/ReaderModeMarkdown.kt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in prof18/feed-flow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7898d03c`: Keep desktop reader direction detection from overflowing the stack on long link destinations. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `shared/src/jvmMain/kotlin/com/prof18/feedflow/shared/domain/ReaderModeMarkdown.kt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
// optionally followed by a quoted title with escaped quotes. Each run of plain characters is one greedy
// character class and only escapes start a new group iteration: java.util.regex recurses once per iteration
// of a repeated group, so `(?:\\.|[^)])*` overflows the UI thread's stack on a long URL such as a data: image.
    """\((?:<[^>\\]*(?:\\.[^>\\]*)*>|[^)\\\s]*(?:\\.[^)\\\s]*)*)(?:\s+"[^"\\]*(?:\\.[^"\\]*)*")?\)"""
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
// optionally followed by a quoted title with escaped quotes.
    """\((?:<(?:\\.|[^>\\])*>|(?:\\.|[^)\\\s])*)(?:\s+"(?:\\.|[^"\\])*")?\)"""
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7898d03c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T15:21:35.457Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795620095457",
    "title": "Keep desktop reader direction detection from overflowing the stack on long link",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "prof18/feed-flow",
    "source_uri": "https://github.com/prof18/feed-flow",
    "source_version": "HEAD",
    "content_hash": "025ebfed99d2782e74ec23806f6555fae08665e0f65cd7450996e8635ce78345"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
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
        "Direct empirical evidence ratio: 0% (0/5)",
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
        "Harvested/verified timestamp recorded: 2026-11-25T15:21:35.457Z"
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
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "0f4df8af1e17bf65b6d7d2071b36b5524359ad24d83e0e65fd1879ada4130b4a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
