# Candidate Directive: [CD-R9UY] ci(e2e): wait for late FIPS images, retry rate-limited lane status publication,

<!-- PROVENANCE_START
{
  "source_repository": "mattermost/mattermost",
  "source_url": "https://github.com/mattermost/mattermost",
  "source_version": "d841da9f",
  "license": "NOASSERTION",
  "timestamp": "2026-11-24T07:07:38.026Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mattermost-mattermost",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mattermost/mattermost](https://github.com/mattermost/mattermost) (Revision: `d841da9f`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-24T07:07:38.026Z`  
> **Learning ID**: `learn-github-mattermost-mattermost`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/e2e-tests-workflows.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mattermost/mattermost. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b1d2e89e`: ci(e2e): wait for late FIPS images, retry rate-limited lane status publication, and fix rolling-upgrade lanes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/e2e-tests-workflows.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
├── server-image-check.yml                 # Gate: one edition's server image is on Docker Hub (not part of E2E)
Before any of this, each orchestrator runs `server-image-check.yml` once per edition it tests, as the jobs `server-image-enterprise` and `server-image-fips`, and every lane of an edition `needs` that edition's job (rolling-upgrade lanes through their Playwright lane). See [Server image check](#server-image-check).

- **No image wait in the templates.** The templates assume the server image exists; the orchestrators check it first (see [Server image check](#server-image-check)).
There is deliberately no `testcontainers:down` first — the runner is fresh, so `upgrade-from`'s clean-slate guard has nothing to trip over. `PW_TESTCONTAINERS_REUSE=true` is what lets `upgrade-to` adopt the stack, survive the swap, and keep every per-spec dispatch on the same upgraded server. `TESTCONTAINERS_RYUK_DISABLED=true` keeps the swapped-in server, which is not started with `withReuse()`, from being reaped when `upgrade-to` exits. Step 2 is skipped when the harness fails; that worker then never reports, the run closes short of `total-reports-expected`, and the version's context goes red.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
There is deliberately no `testcontainers:down` first — the runner is fresh, so `upgrade-from`'s clean-slate guard has nothing to trip over. `PW_TESTCONTAINERS_REUSE=true` is what lets `upgrade-to` adopt the stack, survive the swap, and keep every per-spec dispatch on the same upgraded server. Step 2 is skipped when the harness fails; that worker then never reports, the run closes short of `total-reports-expected`, and the version's context goes red.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b1d2e89e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T07:07:38.023Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795504058023",
    "title": "ci(e2e): wait for late FIPS images, retry rate-limited lane status publication,",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mattermost/mattermost",
    "source_uri": "https://github.com/mattermost/mattermost",
    "source_version": "HEAD",
    "content_hash": "00c7d97ac4bf3673053082c58dbd601e0e6813ea521cba44888dd839f0c1800c"
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
        "Harvested/verified timestamp recorded: 2026-11-24T07:07:38.023Z"
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
  "auth_token": "95ed28792699a806b53768ffec9b3c880bc13f884a603dd0c940d6220f5fd7d3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
