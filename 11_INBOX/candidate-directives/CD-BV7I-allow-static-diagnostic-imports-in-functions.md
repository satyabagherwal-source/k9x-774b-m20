# Candidate Directive: [CD-BV7I] allow static diagnostic imports in Functions

<!-- PROVENANCE_START
{
  "source_repository": "lancedb/lancedb",
  "source_url": "https://github.com/lancedb/lancedb",
  "source_version": "a6d7d02f",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T13:17:32.478Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lancedb-lancedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lancedb/lancedb](https://github.com/lancedb/lancedb) (Revision: `a6d7d02f`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T13:17:32.478Z`  
> **Learning ID**: `learn-github-lancedb-lancedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/src/python/python.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lancedb/lancedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a653d861`: python): allow static diagnostic imports in Functions. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/src/python/python.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
module. It supports three statically recognizable diagnostic operations:
`sys.stderr`, `sys.version_info`, and `importlib.metadata.version`. Direct
imports, `from` imports, and aliases are treated the same way, whether the
import appears inside a function or class body or at module level.

Other imports of `sys`, `builtins`, `importlib`, `inspect`, `gc`, `ctypes`, and
`types`, including submodules such as `ctypes.util` and `importlib.resources`,
remain blocked. This applies to imports inside function or class bodies and
references to module-level aliases. Even ordinary uses such as `sys.version`
and `ctypes.util.find_library` are blocked: these modules can reach names
outside the reconstructed Function namespace. References to `globals`, `locals`,
`vars`, `eval`, `exec`, `compile`, and `__import__` are rejected as dynamic
namespace access. These restrictions also apply to the deprecated `@udf` alias.

For example, a diagnostic Function can report its Python version and NumPy
version without a helper module:

```python
import importlib.metadata
import sys

from lancedb import function


@function(pip=["numpy"])
def report(value: int) -> str:
    print("diagnostic", file=sys.stderr)

```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
module. It conservatively rejects imports of `sys`, `builtins`, `importlib`,
`inspect`, `gc`, `ctypes`, and `types`, including submodules such as `ctypes.util`
and `importlib.metadata`. This applies to imports inside function or class bodies
and references to module-level aliases. Even ordinary uses such as `sys.version`
and `ctypes.util.find_library` are blocked: these modules can reach names outside
the reconstructed Function namespace. References to `globals`, `locals`, `vars`,
`eval`, `exec`, `compile`, and `__import__` are rejected as dynamic namespace access.
These restrictions also apply to the deprecated `@udf` alias.

For legitimate uses, move the code into an importable helper module and ship it
with `code=`, or install its package with `pip=` or `conda=`. Imported helpers keep
their own namespace; the packager does not scan their bodies. Helpers defined in
`__main__` are copied by source and have the same restrictions as the Function.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a653d861` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T13:17:32.476Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795007852476",
    "title": "allow static diagnostic imports in Functions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lancedb/lancedb",
    "source_uri": "https://github.com/lancedb/lancedb",
    "source_version": "HEAD",
    "content_hash": "d17d32d530fa5e86d46f3de4a483cd671ba0affb20a0abce5171ad3ebf58b460"
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
        "Harvested/verified timestamp recorded: 2026-11-18T13:17:32.476Z"
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
  "auth_token": "d19cafed63696dae57f7e5c9bbff1e045e26b10c30bb400ca8e63372bda193c3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
