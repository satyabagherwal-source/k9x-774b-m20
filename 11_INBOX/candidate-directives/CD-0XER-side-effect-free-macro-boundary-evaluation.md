# Candidate Directive: [CD-0XER] Side-Effect Free Macro Boundary Evaluation

<!-- PROVENANCE_START
{
  "source_repository": "cilium/cilium",
  "source_url": "https://github.com/cilium/cilium",
  "source_version": "d3bfd511",
  "license": "Apache-2.0",
  "timestamp": "2026-11-16T03:45:49.347Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-cilium-cilium",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [cilium/cilium](https://github.com/cilium/cilium) (Revision: `d3bfd511`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-16T03:45:49.347Z`  
> **Learning ID**: `learn-github-cilium-cilium`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
```c
int i = 0, j = 10;
int res = min(i++, j);
assert(i == 1);
assert(res == 0);
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:45:49.347Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794800749347",
    "title": "Side-Effect Free Macro Boundary Evaluation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "cilium/cilium",
    "source_uri": "https://github.com/cilium/cilium",
    "source_version": "HEAD",
    "content_hash": "fd0fe56a4bc709af5db0347b43623bb5a33f6af4e89f12c378b00875f2148b6a"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:45:49.347Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "ce8920bf2f056ee0a810c11d272fe501f868daee97a4fa80022578a989c55542"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
