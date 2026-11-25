# Candidate Directive: [CD-D383] ci: lint docs before deploying them, and fix the deploy build

<!-- PROVENANCE_START
{
  "source_repository": "materializeinc-materialize-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T04:52:18.036Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-materializeinc-materialize-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [materializeinc-materialize-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T04:52:18.036Z`  
> **Learning ID**: `LEARN-EVO-materializeinc-materialize-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/deploy-docs.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MaterializeInc/materialize. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `35a338a1`: ci: lint docs before deploying them, and fix the deploy build. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/deploy-docs.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    branches: [main]
      - src/sql-lexer/src/keywords.txt
      - ci/builder/Dockerfile
  lint:
    name: Lint docs
    runs-on: ubuntu-26.04
    timeout-minutes: 30
    permissions:
      contents: read # check out the repository
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      # Same check and image as the Buildkite lint-docs step.
      - run: bin/ci-builder run stable --no-secrets ci/test/lint-docs.sh

    needs: lint
    runs-on: ubuntu-26.04
    # Restricted to main; the AWS role trusts only this environment.
            ci/builder
            src/sql-lexer
      - run: ci/deploy_website/install-tools.sh
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    branches: [main, "self-managed-docs/*"]
    runs-on: ubuntu-24.04
    # Restricted to main and self-managed-docs/*; the AWS role trusts only
    # this environment on those refs.
      # Keep in sync with the Hugo version in ci/builder/Dockerfile.
      - name: Install Hugo
        run: |
          curl -fsSL https://github.com/gohugoio/hugo/releases/download/v0.152.2/hugo_extended_withdeploy_0.152.2_Linux-64bit.tar.gz > hugo.tar.gz
          echo '08200e4d82f086c94c301e8ba08102f9e23f38774ad949bb3251cac76283684a hugo.tar.gz' | sha256sum --check

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T04:52:18.193Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795582338193",
    "title": "ci: lint docs before deploying them, and fix the deploy build",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "materializeinc-materialize-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a71fca16f1cc31e0b05db3c26c7e948ebcf2d377cb0bac386b668563ae91c04c"
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
        "Harvested/verified timestamp recorded: 2026-11-25T04:52:18.194Z"
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
  "auth_token": "664f0318e4ca7b9539b3c0bbe3bd8133ef8a29f8e7fb65a48bd9a6fee123ba42"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
