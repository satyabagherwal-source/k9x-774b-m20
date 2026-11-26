# Candidate Directive: [CD-ZTCL] resume clickhouse migration from markers

<!-- PROVENANCE_START
{
  "source_repository": "openreplay/openreplay",
  "source_url": "https://github.com/openreplay/openreplay",
  "source_version": "80414abf",
  "license": "NOASSERTION",
  "timestamp": "2026-11-26T19:25:26.997Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-openreplay-openreplay",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [openreplay/openreplay](https://github.com/openreplay/openreplay) (Revision: `80414abf`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-26T19:25:26.997Z`  
> **Learning ID**: `learn-github-openreplay-openreplay`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-26T19:25:26.995Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795721126995",
    "title": "resume clickhouse migration from markers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "openreplay/openreplay",
    "source_uri": "https://github.com/openreplay/openreplay",
    "source_version": "HEAD",
    "content_hash": "13020ec016f4ba2b19bfb9c598bbef3b9e643f88dc6b77d2af432636d4eb22d8"
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
        "Harvested/verified timestamp recorded: 2026-11-26T19:25:26.995Z"
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
  "auth_token": "d88f9030e0d8426d96cbafebe37585b83fdf671b3abafb4d44e51bcaceb310d4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
