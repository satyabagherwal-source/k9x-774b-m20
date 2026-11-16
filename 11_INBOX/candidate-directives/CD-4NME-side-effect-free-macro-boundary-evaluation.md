# Candidate Directive: [CD-4NME] Side-Effect Free Macro Boundary Evaluation

<!-- PROVENANCE_START
{
  "source_repository": "cilium-cilium-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T03:48:43.223Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-cilium-cilium-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [cilium-cilium-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T03:48:43.223Z`  
> **Learning ID**: `LEARN-EVO-cilium-cilium-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
C macro utilities evaluating comparisons (`min`, `max`, `clamp`) MUST wrap expression parameters into distinct block-scoped local variables of identical type and inject pointer equality checks to force compile-time type-safety warnings, explicitly avoiding multiple evaluations of expressions possessing side effects (such as post-increments or function calls).

**WHY**:
Evaluating `min(x++, y)` in a naïve macro `#define min(a,b) ((a)<(b)?(a):(b))` executes `x++` twice if `x < y`, causing data corruption, non-deterministic packet drops, and buffer overrun exploits inside network drivers and eBPF hook routines.

**WHEN TO APPLY**:
All C-based kernels, eBPF helper libraries, embedded systems, and system runtimes.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
/* Verified Production Datapath: bpf/lib/utils.h */
#pragma once

#define __min(t_x, t_y, x, y)      \
({                                 \
    t_x _x = (x);                  \
    t_y _y = (y);                  \
    (void)(&_x == &_y);            \
    _x < _y ? _x : _y;             \
})

#define __max(t_x, t_y, x, y)      \
({                                 \
    t_x _x = (x);                  \
    t_y _y = (y);                  \
    (void)(&_x == &_y);            \
    _x > _y ? _x : _y;             \
})

#define min(x, y) \
    __min(typeof(x), typeof(y), x, y)

#define max(x, y) \
    __max(typeof(x), typeof(y), x, y)
```

**NEGATIVE CONSTRAINT**:
```c
// ANTI-PATTERN: Classic macro double-evaluation flaw
#define MIN_UNSAFE(x, y) ((x) < (y) ? (x) : (y))

// Fails catastrophically:
// int target_len = MIN_UNSAFE(offset++, max_len); 
// offset gets incremented TWICE!
```

**VERIFICATION METHOD**:
Run GCC/Clang with `-Werror=type-limits -Werror=unused-value`. Write a test case passing expressions with mutations:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:48:43.286Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794800923286",
    "title": "Side-Effect Free Macro Boundary Evaluation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "cilium-cilium-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "d36f2f300dbf6a689d93ac8075f2ee8a4b91c22256f64358daaed535677303ad"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:48:43.286Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "63a720d5561908ffd2507e415238788b452d64cd51efb9cc6d5dd57e6681cfb4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
