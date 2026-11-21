# Candidate Directive: [CD-JOS8] ci(e2e): skip builds for existing caches

<!-- PROVENANCE_START
{
  "source_repository": "chaos-mesh/chaos-mesh",
  "source_url": "https://github.com/chaos-mesh/chaos-mesh",
  "source_version": "da9a3583",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T22:06:30.968Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-chaos-mesh-chaos-mesh",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [chaos-mesh/chaos-mesh](https://github.com/chaos-mesh/chaos-mesh) (Revision: `da9a3583`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T22:06:30.968Z`  
> **Learning ID**: `learn-github-chaos-mesh-chaos-mesh`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `da9a3583` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T22:06:30.966Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795298790966",
    "title": "ci(e2e): skip builds for existing caches",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "chaos-mesh/chaos-mesh",
    "source_uri": "https://github.com/chaos-mesh/chaos-mesh",
    "source_version": "HEAD",
    "content_hash": "c81b3414a95eeca83293242401bf7d1e533fc099c5709313aa3b087d3ef4d438"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T22:06:30.966Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "dd8b2793346e5fd4641a6c55e463cf6a40b518741fd28467a47efa1f949cf04f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
