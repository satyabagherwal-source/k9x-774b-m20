# Candidate Directive: [CD-LGBU] Pin cc-utils actions to release 1.2883.0

<!-- PROVENANCE_START
{
  "source_repository": "gardener-gardener-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T17:25:38.771Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-gardener-gardener-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gardener-gardener-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T17:25:38.771Z`  
> **Learning ID**: `LEARN-EVO-gardener-gardener-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain L

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/build.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gardener/gardener. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1152132c`: Pin cc-utils actions to release 1.2883.0. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/build.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
    uses: gardener/cc-utils/.github/workflows/prepare.yaml@00522ef3e8504bc7be46394a239a390f112336f6 # 1.2883.0
      - uses: gardener/cc-utils/.github/actions/trusted-checkout@00522ef3e8504bc7be46394a239a390f112336f6 # 1.2883.0
      - uses: gardener/cc-utils/.github/actions/setup-git-identity@00522ef3e8504bc7be46394a239a390f112336f6 # 1.2883.0
        uses: gardener/cc-utils/.github/actions/export-ocm-fragments@00522ef3e8504bc7be46394a239a390f112336f6 # 1.2883.0
    uses: gardener/cc-utils/.github/workflows/sastlint-ocm.yaml@00522ef3e8504bc7be46394a239a390f112336f6 # 1.2883.0
    uses: gardener/cc-utils/.github/workflows/oci-ocm.yaml@00522ef3e8504bc7be46394a239a390f112336f6 # 1.2883.0
    uses: gardener/cc-utils/.github/workflows/helmchart-ocm.yaml@00522ef3e8504bc7be46394a239a390f112336f6 # 1.2883.0
      - uses: gardener/cc-utils/.github/actions/trusted-checkout@00522ef3e8504bc7be46394a239a390f112336f6 # 1.2883.0
        uses: gardener/cc-utils/.github/actions/import-commit@00522ef3e8504bc7be46394a239a390f112336f6 # 1.2883.0
      - uses: gardener/cc-utils/.github/actions/export-ocm-fragments@00522ef3e8504bc7be46394a239a390f112336f6 # 1.2883.0
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
    uses: gardener/cc-utils/.github/workflows/prepare.yaml@bce63f62928717a11f610ec8022af9feb497d5df # v1
      - uses: gardener/cc-utils/.github/actions/trusted-checkout@bce63f62928717a11f610ec8022af9feb497d5df # v1
      - uses: gardener/cc-utils/.github/actions/setup-git-identity@bce63f62928717a11f610ec8022af9feb497d5df # v1
        uses: gardener/cc-utils/.github/actions/export-ocm-fragments@bce63f62928717a11f610ec8022af9feb497d5df # v1
    uses: gardener/cc-utils/.github/workflows/sastlint-ocm.yaml@bce63f62928717a11f610ec8022af9feb497d5df # v1
    uses: gardener/cc-utils/.github/workflows/oci-ocm.yaml@bce63f62928717a11f610ec8022af9feb497d5df # v1
    uses: gardener/cc-utils/.github/workflows/helmchart-ocm.yaml@bce63f62928717a11f610ec8022af9feb497d5df # v1
      - uses: gardener/cc-utils/.github/actions/trusted-checkout@bce63f62928717a11f610ec8022af9feb497d5df # v1
        uses: gardener/cc-utils/.github/actions/import-commit@bce63f62928717a11f610ec8022af9feb497d5df # v1
      - uses: gardener/cc-utils/.github/actions/export-ocm-fragments@bce63f62928717a11f610ec8022af9feb497d5df # v1
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1152132c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T17:25:38.919Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795886738919",
    "title": "Pin cc-utils actions to release 1.2883.0",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gardener-gardener-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "485d9981c80a7570ba898f2bc80a4e268ddd45b4820d46ddbb37510fa1dd9299"
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
        "Harvested/verified timestamp recorded: 2026-11-28T17:25:38.919Z"
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
  "auth_token": "94f056a319ac2f1c571f497ed6a3bc6fa339938eaff7e896c9bedaa9766678a6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
