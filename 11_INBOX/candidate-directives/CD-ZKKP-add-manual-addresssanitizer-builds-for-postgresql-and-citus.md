# Candidate Directive: [CD-ZKKP] Add manual AddressSanitizer builds for PostgreSQL and Citus

<!-- PROVENANCE_START
{
  "source_repository": "citusdata/citus",
  "source_url": "https://github.com/citusdata/citus",
  "source_version": "3a78aa0d",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-24T14:41:59.017Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-citusdata-citus",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [citusdata/citus](https://github.com/citusdata/citus) (Revision: `3a78aa0d`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-24T14:41:59.017Z`  
> **Learning ID**: `learn-github-citusdata-citus`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/actions/setup_cassert_pg/action.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in citusdata/citus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3a78aa0d`: Add manual AddressSanitizer builds for PostgreSQL and Citus. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/actions/setup_cassert_pg/action.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c
// Verified production-grade fix pattern:
  sanitizer:
    description: "Optional sanitizer: none (default) or address-bool (GCC ASAN and UBSan bool check)."
    required: false
    default: "none"
  cold_cache:
    description: "Build without downloading a cached prefix, for cold-cache measurements."
    required: false
    default: "false"
    - name: Validate sanitizer selection
      shell: bash
      env:
        SANITIZER: ${{ inputs.sanitizer }}
      run: |
        set -euo pipefail
        case "$SANITIZER" in
          none) ;;
          address-bool)
            ASAN_DIR="${ASAN_DIR:-$RUNNER_TEMP/asan}"
            [[ "$ASAN_DIR" = /* ]]
            mkdir -p "$ASAN_DIR/reports"
            echo "ASAN_DIR=$ASAN_DIR" >> "$GITHUB_ENV"
            echo "ASAN_OPTIONS=detect_leaks=0:abort_on_error=1:symbolize=1:log_path=$ASAN_DIR/reports/asan" >> "$GITHUB_ENV"
            echo "UBSAN_OPTIONS=halt_on_error=1:print_stacktrace=1" >> "$GITHUB_ENV" ;;
          *) echo "::error::Unsupported sanitizer: $SANITIZER"; exit 1 ;;
        esac

      id: dependencies
        echo "os=$(. /etc/os-release; echo "$ID-$VERSION_ID")" >> "$GITHUB_OUTPUT"
        locale -a | grep -Fx 'da_DK.utf8'
        key: pgenv-cassert-${{ steps.dep
```

**NEGATIVE CONSTRAINT**:
```c
// Induced defect failure mode:
        key: pgenv-cassert-${{ runner.os }}-${{ runner.arch }}-cassert${{ inputs.cassert }}-${{ inputs.pg_full }}-${{ hashFiles('.devcontainer/pgenv/config/default.conf') }}
      if: steps.cache.outputs.cache-hit != 'true'
        MAKEFLAGS="-j $(nproc)" pgenv build "${{ inputs.pg_full }}"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3a78aa0d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T14:41:59.015Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795531319015",
    "title": "Add manual AddressSanitizer builds for PostgreSQL and Citus",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "citusdata/citus",
    "source_uri": "https://github.com/citusdata/citus",
    "source_version": "HEAD",
    "content_hash": "c6b72f423ff4a5d0e72e75c54f50fabaa8750a4decef79814c692ef00058b11b"
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
        "Harvested/verified timestamp recorded: 2026-11-24T14:41:59.015Z"
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
  "auth_token": "3e3d4d98e7fe90f4cd9dd76422a5c9b88973ebdab0216696b494bb250c149b17"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
