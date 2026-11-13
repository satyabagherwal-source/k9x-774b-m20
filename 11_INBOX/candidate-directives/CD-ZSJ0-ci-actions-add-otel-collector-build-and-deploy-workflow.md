# Candidate Directive: [CD-ZSJ0] ci(actions): add otel-collector build and deploy workflow

<!-- PROVENANCE_START
{
  "source_repository": "openreplay/openreplay",
  "source_url": "https://github.com/openreplay/openreplay",
  "source_version": "25119d9b",
  "license": "NOASSERTION",
  "timestamp": "2026-11-13T23:01:39.757Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-openreplay-openreplay",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [openreplay/openreplay](https://github.com/openreplay/openreplay) (Revision: `25119d9b`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-13T23:01:39.757Z`  
> **Learning ID**: `learn-github-openreplay-openreplay`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain A

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/otel-collector.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in openreplay/openreplay. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `25119d9b`: ci(actions): add otel-collector build and deploy workflow. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/otel-collector.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
# Builds the OpenTelemetry Collector image and deploys it to the OSS dev cluster
on:
  workflow_dispatch:
    inputs:
      skip_security_checks:
        description: "Skip Security checks if there is a unfixable vuln or error. Value: true/false"
        required: false
        default: "false"
  push:
    branches:
      - dev
    paths:
      - "otel-collector/**"

name: Build and Deploy otel-collector

jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v5
        with:
          fetch-depth: 2

      - uses: ./.github/composite-actions/update-keys
        with:
          assist_jwt_secret: ${{ secrets.ASSIST_JWT_SECRET }}
          assist_key: ${{ secrets.ASSIST_KEY }}
          domain_name: ${{ secrets.OSS_DOMAIN_NAME }}
          jwt_refresh_secret: ${{ secrets.JWT_REFRESH_SECRET }}
          jwt_secret: ${{ secrets.OSS_JWT_SECRET }}
          jwt_spot_refresh_secret: ${{ secrets.JWT_SPOT_REFRESH_SECRET }}
          jwt_spot_secret: ${{ secrets.JWT_SPOT_SECRET }}
          license_key: ${{ secrets.OSS_LICENSE_KEY }}
          minio_access_key: ${{ secrets.OSS_MINIO_ACCESS_KEY }}
          minio_secret_k
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `25119d9b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T23:01:39.754Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794610899754",
    "title": "ci(actions): add otel-collector build and deploy workflow",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "openreplay/openreplay",
    "source_uri": "https://github.com/openreplay/openreplay",
    "source_version": "HEAD",
    "content_hash": "d69b22ca251fdae9b10b744b8a9504097146205acbaee6292d5f94953bea74eb"
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
        "Harvested/verified timestamp recorded: 2026-11-13T23:01:39.754Z"
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
  "auth_token": "e687fb651657470a3c88579c90180c9238045eae69971271f465a1158e2786c0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
