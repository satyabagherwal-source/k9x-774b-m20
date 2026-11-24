# Candidate Directive: [CD-ZP7L] Add manual AddressSanitizer builds for PostgreSQL and Citus

<!-- PROVENANCE_START
{
  "source_repository": "citusdata-citus-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T14:42:04.903Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-citusdata-citus-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [citusdata-citus-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T14:42:04.903Z`  
> **Learning ID**: `LEARN-EVO-citusdata-citus-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T14:42:05.024Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795531325024",
    "title": "Add manual AddressSanitizer builds for PostgreSQL and Citus",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "citusdata-citus-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "fd079980cccf8ac0430f593a9bdb23fc5854fd53a544dac25f2c624e5f86c99e"
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
        "Harvested/verified timestamp recorded: 2026-11-24T14:42:05.024Z"
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
  "auth_token": "fd97a144e0a11d0d98b60fa70b487117ce7f14a3a08afced20cb548733b9e790"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
