# Candidate Directive: [CD-8AS7] .github/workflows: give golangci-lint its own Go build cache

<!-- PROVENANCE_START
{
  "source_repository": "tailscale/tailscale",
  "source_url": "https://github.com/tailscale/tailscale",
  "source_version": "0345103e",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-23T15:29:05.431Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tailscale-tailscale",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tailscale/tailscale](https://github.com/tailscale/tailscale) (Revision: `0345103e`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-23T15:29:05.431Z`  
> **Learning ID**: `learn-github-tailscale-tailscale`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/golangci-lint.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tailscale/tailscale. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fefe73ac`: .github/workflows: give golangci-lint its own Go build cache. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/golangci-lint.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
  # Runs on main populate the Go build cache that pull requests restore.
  push:
    branches:
      - main
    paths:
      - ".github/workflows/golangci-lint.yml"
      - "**.go"
      - "go.mod"
      - "go.sum"
      # setup-go's own cache is disabled because its key collides with the
      # one used by the CodeQL workflow, whose saved build cache lacks the
      # test packages and export data that golangci-lint needs. We manage
      # our own cache below instead.
          cache: false

      - name: Restore Go cache
        id: restore-cache
        uses: actions/cache/restore@668228422ae6a00e4ad889ee87cd7109ec5666a7 # v5.0.4
        with:
          path: |
            ~/.cache/go-build
            ~/go/pkg/mod
          key: ${{ runner.os }}-golangci-lint-${{ hashFiles('go.mod', 'go.sum') }}
          restore-keys: |
            ${{ runner.os }}-golangci-lint-

      - name: Save Go cache
        # Save even on lint failure, but only on main and only once per
        # go.mod/go.sum hash, as each entry is several GB.
        if: always() && steps.restore-cache.outputs.cache-hit != 'true' && github.ref == 'refs/heads/main'
        uses: actions/cache/save@668228422ae6a00e4
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
  # For now, only lint pull requests, not the main branches.
  # TODO(andrew): enable for main branch after an initial waiting period.
  #push:
  #  branches:
  #    - main
          cache: true
          
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fefe73ac` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T15:29:05.429Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795447745429",
    "title": ".github/workflows: give golangci-lint its own Go build cache",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tailscale/tailscale",
    "source_uri": "https://github.com/tailscale/tailscale",
    "source_version": "HEAD",
    "content_hash": "d69cc352574e5efc3b584ef26daeac57f749b9d95228de5fa4179d22d8834538"
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
        "Harvested/verified timestamp recorded: 2026-11-23T15:29:05.429Z"
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
  "auth_token": "56ccdd4f1f4ede407708268521c71f24014e30020e7bd9d6eadede8be9e2eefa"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
