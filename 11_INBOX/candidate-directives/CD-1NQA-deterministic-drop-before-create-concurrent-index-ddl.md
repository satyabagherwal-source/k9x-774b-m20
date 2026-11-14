# Candidate Directive: [CD-1NQA] Deterministic Drop-Before-Create Concurrent Index DDL

<!-- PROVENANCE_START
{
  "source_repository": "authzed/spicedb",
  "source_url": "https://github.com/authzed/spicedb",
  "source_version": "558b84d7",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T05:07:01.858Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-authzed-spicedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [authzed/spicedb](https://github.com/authzed/spicedb) (Revision: `558b84d7`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T05:07:01.858Z`  
> **Learning ID**: `learn-github-authzed-spicedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When generating or applying concurrent database schema migrations (such as PostgreSQL `CREATE INDEX CONCURRENTLY`), the migration driver MUST explicitly execute a `DROP INDEX CONCURRENTLY IF EXISTS` prior to creation and MUST NOT rely on `IF NOT EXISTS` syntax.

**WHY**:
PostgreSQL's `CREATE INDEX CONCURRENTLY IF NOT EXISTS` is not atomic. If a prior attempt failed midway due to a statement timeout, deadlock, or network termination, PostgreSQL marks the index catalog entry as `INVALID` (`indisvalid = false`). Subsequent runs with `IF NOT EXISTS` silently skip the step, leaving behind a broken, un-queried, yet write-penalized invalid index that corrupts future query execution plans.

**WHEN TO APPLY**:
All automated database migrations running in multi-tenant or cloud-native relational databases supporting online/concurrent DDL (e.g., PostgreSQL, CockroachDB).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
func CreateIndexConcurrently(ctx context.Context, conn execer, index common.IndexDefinition) error {
    // 1. Explicitly clean up any preceding invalid or partial index
    dropIndexSQL := fmt.Sprintf("DROP INDEX CONCURRENTLY IF EXISTS %s;", index.Name)
    if _, err := conn.Exec(ctx, dropIndexSQL); err != nil {
        if pgxcommon.IsQueryCanceledError(err) {
            return fmt.Errorf("timeout dropping index %s: %w", index.Name, err)
        }
        return fmt.Errorf("failed dropping index %s: %w", index.Name, err)
    }

    // 2. Safely create index from scratch
    createIndexSQL := fmt.Sprintf("CREATE INDEX CONCURRENTLY %s ON %s;", index.Name, index.ColumnsSQL)
    if _, err := conn.Exec(ctx, createIndexSQL); err != nil {
        if pgxcommon.IsQueryCanceledError(err) {
            return fmt.Errorf("timeout creating index %s: %w", index.Name, err)
        }
        return fmt.Errorf("failed creating index %s: %w", index.Name, err)
    }
    return nil
}
```

**NEGATIVE CONSTRAINT**:
```sql
-- ANTI-PATTERN: If this fails midway, the index exists in an invalid state.
-- Future runs will see it exists, skip creation, and leave queries unindexed.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_relationship_lookup 
ON relation_tuple (namespace, object_id, relation);
```

**VERIFICATION METHOD**:
Verify using PostgreSQL system catalogs in migration integration suites:
```sql
SELECT indexrelid::regclass, indisvalid 
FROM pg_index 
WHERE indisvalid = false;
```
The test suite MUST fail if any row is returned.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T05:07:01.858Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794632821858",
    "title": "Deterministic Drop-Before-Create Concurrent Index DDL",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "authzed/spicedb",
    "source_uri": "https://github.com/authzed/spicedb",
    "source_version": "HEAD",
    "content_hash": "fb95d4befb9c1c03570b1896760503c65153c960486979bd8bb54fec0d95ad87"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-14T05:07:01.858Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "1aabdf0d681b59bb7cbd7834eaa44b04d4776ea57100ac25c0301f784ff12786"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
