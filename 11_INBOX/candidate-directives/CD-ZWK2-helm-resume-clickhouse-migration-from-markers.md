# Candidate Directive: [CD-ZWK2] helm): resume clickhouse migration from markers

<!-- PROVENANCE_START
{
  "source_repository": "openreplay-openreplay-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T19:25:31.018Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-openreplay-openreplay-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [openreplay-openreplay-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T19:25:31.018Z`  
> **Learning ID**: `LEARN-EVO-openreplay-openreplay-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `scripts/helmcharts/openreplay/files/clickhouse.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in openreplay/openreplay. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bcaf9197`: helm): resume clickhouse migration from markers. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `scripts/helmcharts/openreplay/files/clickhouse.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
# Versions to migrate. ClickHouse's own markers decide where to start; the
# requested list (built from the openreplay-version ConfigMap, which only moves
# after a fully successful upgrade) is used only when there are no markers yet.
function migration_versions_from_markers() {
    local requested=$1 state db_version base v
    $ch_client -q "CREATE FUNCTION IF NOT EXISTS openreplay_migration_state AS() -> -1;"
    $ch_client -q "CREATE FUNCTION IF NOT EXISTS openreplay_version AS() -> 'v0.0.0';"
    state=$($ch_client -q "SELECT openreplay_migration_state()" | tr -d '[:space:]')
    db_version=$($ch_client -q "SELECT openreplay_version()" | tr -d '[:space:]')
    migration_versions=()
    if [[ "$db_version" == "v0.0.0" ]]; then
        IFS=',' read -r -a migration_versions <<< "$requested"
        return 0
    fi
    base="${db_version#v}"
    if [[ "$state" != "-1" ]]; then
        if [[ ! -d "${clickhousedir}/${base}" ]]; then
            echo "ERROR: ClickHouse is mid-migration at ${db_version} step ${state}, but this release has no ${base} migration."
            exit 1
        fi
        migration_versions+=("$base")
    fi
    for v in $(ls "$clickhousedir" | grep -v '^cre
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
    IFS=',' read -r -a migration_versions <<< "$1"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bcaf9197` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T19:25:31.150Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795721131149",
    "title": "helm): resume clickhouse migration from markers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "openreplay-openreplay-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "84aafd5d6672a561f1fe2299fd90c8cfe09aa146f13a08ad13768982b315fd8a"
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
        "Harvested/verified timestamp recorded: 2026-11-26T19:25:31.150Z"
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
  "auth_token": "7666833ae4cb5fbf4a325ae153f520250a9b59ec55f7e09ea6d01ad076438d98"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
