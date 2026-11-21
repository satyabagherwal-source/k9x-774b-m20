# Candidate Directive: [CD-JRK6] ci(e2e): skip builds for existing caches

<!-- PROVENANCE_START
{
  "source_repository": "chaos-mesh-chaos-mesh-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T22:06:34.480Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-chaos-mesh-chaos-mesh-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [chaos-mesh-chaos-mesh-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T22:06:34.480Z`  
> **Learning ID**: `LEARN-EVO-chaos-mesh-chaos-mesh-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/e2e_test_upload_cache.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in chaos-mesh/chaos-mesh. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `da9a3583`: ci(e2e): skip builds for existing caches. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/e2e_test_upload_cache.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
    env:
      CACHE_KEY_PREFIX: e2e-image-build-cache
      # Cache lookups outside the default branch can match its cache.
      - name: Check for build cache
        id: cache
        if: github.ref == format('refs/heads/{0}', github.event.repository.default_branch)
        uses: actions/cache/restore@v6
        with:
          path: cache
          key: ${{ env.CACHE_KEY_PREFIX }}-${{ runner.os }}
          lookup-only: true
        if: steps.cache.outputs.cache-hit != 'true'
        if: steps.cache.outputs.cache-hit != 'true'
        if: steps.cache.outputs.cache-hit != 'true'
          key: ${{ env.CACHE_KEY_PREFIX }}-${{ runner.os }}
    env:
      CACHE_KEY_PREFIX: e2e-binary-build-cache
      - name: Check for build cache
        id: cache
        if: github.ref == format('refs/heads/{0}', github.event.repository.default_branch)
        uses: actions/cache/restore@v6
        with:
          path: cache
          key: ${{ env.CACHE_KEY_PREFIX }}-${{ runner.os }}
          lookup-only: true
        if: steps.cache.outputs.cache-hit != 'true'
        if: steps.cache.outputs.cache-hit != 'true'
        if: steps.cache.outputs.cache-hit != 'true'
          key: ${{ env.CACHE_KE
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
          key: e2e-image-build-cache-${{ runner.os }}
          key: e2e-binary-build-cache-${{ runner.os }}

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T22:06:34.563Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795298794562",
    "title": "ci(e2e): skip builds for existing caches",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "chaos-mesh-chaos-mesh-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ec86f054a842c57be279115d6473f93e7bfbbdfd346dfe2fd9e88e1b4221306c"
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
        "Harvested/verified timestamp recorded: 2026-11-21T22:06:34.563Z"
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
  "auth_token": "fccad1ed5247bf122d44d6bd10b716d0136318e291ef7820c3f7036319fe5471"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
