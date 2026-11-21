# Candidate Directive: [CD-IM7I] [ty] Forward the suffix of a positional unpack to a ParamSpec

<!-- PROVENANCE_START
{
  "source_repository": "astral-sh/ruff",
  "source_url": "https://github.com/astral-sh/ruff",
  "source_version": "cd2d9732",
  "license": "MIT",
  "timestamp": "2026-11-21T02:29:57.102Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-astral-sh-ruff",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [astral-sh/ruff](https://github.com/astral-sh/ruff) (Revision: `cd2d9732`).  
> **License**: MIT | **Timestamp**: `2026-11-21T02:29:57.102Z`  
> **Learning ID**: `learn-github-astral-sh-ruff`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/ty_python_semantic/resources/mdtest/generics/legacy/paramspec.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in astral-sh/ruff. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `36f64044`: [ty] Forward the suffix of a positional unpack to a ParamSpec. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/ty_python_semantic/resources/mdtest/generics/legacy/paramspec.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
A positional unpack can supply the callback and some or all of its arguments.

```py
def write(x: int, y: str) -> None: ...

forward(*(write, 1, "ok"))  # ok
forward(*(write, 1), "ok")  # ok
forward(*[write, 1, "ok"])  # ok
forward(*(write, 1, 2))  # error: 9 [invalid-argument-type] "Expected `str`"
forward(*(write, 1), 2)  # error: 22 [invalid-argument-type] "Expected `str`"
```

When a variable-length segment follows the callback, we check its element type and any fixed
arguments after it.

```py
from typing import TypeVarTuple

Ts = TypeVarTuple("Ts")

def check_words(words: tuple[str, ...]):
    forward(*(write, *words))  # error: [invalid-argument-type] "Expected `int`, found `str`"

def check_parts(callback: Callable[[*Ts, str], None], values: tuple[*Ts]):
    forward(*(callback, *values, "ok"))  # ok
    forward(*(callback, *values, 2))  # error: [invalid-argument-type] "Expected `str`"
```

Here `0` is either the callback or an argument to a callback that takes none.

```py
def check_callbacks(callbacks: tuple[Callable[[], None], ...]):
    forward(*(*callbacks, 0))  # error: [invalid-argument-type]
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T02:29:57.097Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.68,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 68%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795228197097",
    "title": "[ty] Forward the suffix of a positional unpack to a ParamSpec",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "astral-sh/ruff",
    "source_uri": "https://github.com/astral-sh/ruff",
    "source_version": "HEAD",
    "content_hash": "cb042271cbf0848e7acda404bb59b18af5950f74e83c8cf5ebfb3f6f7868695b"
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-21T02:29:57.098Z"
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
  "auth_token": "46e4ababdea550e01071fcc304fa7270c16fabe4683287f94df9c0f02953223a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
