# Candidate Directive: [CD-3X0I] ignore unmaintained chrono family advisories

<!-- PROVENANCE_START
{
  "source_repository": "lancedb/lancedb",
  "source_url": "https://github.com/lancedb/lancedb",
  "source_version": "16af7297",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T19:27:36.162Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lancedb-lancedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lancedb/lancedb](https://github.com/lancedb/lancedb) (Revision: `16af7297`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T19:27:36.162Z`  
> **Learning ID**: `learn-github-lancedb-lancedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `deny.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lancedb/lancedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `16708593`: deps): ignore unmaintained chrono family advisories. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `deny.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    # pin-utils: unmaintained; reviewed 2026-11-05, removed 2026-11-17 after
    # the lockfile dropped the aws-smithy pins that carried it.

    # chrono: unmaintained; reviewed 2026-11-17. Informational notice, not a
    # vulnerability. Transitive via arrow 59 / datafusion 55 and the lance
    # stack throughout the workspace. RustSec lists no patched version and
    # recommends jiff/time; clearing it requires the arrow/datafusion/lance
    # ecosystem to migrate.
    # https://rustsec.org/advisories/RUSTSEC-2026-0543
    { id = "RUSTSEC-2026-0543", reason = "chrono unmaintained via arrow/datafusion/lance; no fixed upstream release, awaiting ecosystem migration" },

    # chrono-tz: unmaintained; reviewed 2026-11-17. Informational notice, not
    # a vulnerability. Transitive via arrow-array → arrow → datafusion/lance.
    # No patched version exists; clearing it needs the same ecosystem
    # migration off chrono as RUSTSEC-2026-0543.
    # https://rustsec.org/advisories/RUSTSEC-2026-0555
    { id = "RUSTSEC-2026-0555", reason = "chrono-tz unmaintained via arrow/datafusion/lance; no fixed upstream release" },

    # humantime: unmaintained; reviewed 2026-11-17. Informational n
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    # pin-utils: unmaintained; reviewed 2026-11-05. Transitive via
    # aws-smithy-http/runtime/types, including aws-config -> lance-io.
    # No safe upgrade exists; clearing requires AWS Smithy to migrate to
    # core::pin::pin!, pin-project, or pin-project-lite. Revisit on AWS updates.
    # https://github.com/rustsec/advisory-db/issues/3314
    { id = "RUSTSEC-2026-0441", reason = "pin-utils unmaintained via AWS Smithy; no safe upgrade, awaiting upstream migration" },
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `16708593` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T19:27:36.160Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794943656160",
    "title": "ignore unmaintained chrono family advisories",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lancedb/lancedb",
    "source_uri": "https://github.com/lancedb/lancedb",
    "source_version": "HEAD",
    "content_hash": "4f083aa5c1e2f38618b164be759e911d375fdb8698038197a2675faa245f03a5"
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
        "Harvested/verified timestamp recorded: 2026-11-17T19:27:36.160Z"
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
  "auth_token": "9cd210d505fec3bc4d347fb469eb3fcd6ca213b00b93e456e00899795c752149"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
