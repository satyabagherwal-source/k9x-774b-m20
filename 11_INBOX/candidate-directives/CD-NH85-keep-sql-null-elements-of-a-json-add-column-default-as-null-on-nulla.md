# Candidate Directive: [CD-NH85] keep SQL NULL elements of a json[] ADD COLUMN default as NULL on nulla

<!-- PROVENANCE_START
{
  "source_repository": "PeerDB-io/peerdb",
  "source_url": "https://github.com/PeerDB-io/peerdb",
  "source_version": "5868e6e7",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-18T02:42:43.061Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-peerdb-io-peerdb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [PeerDB-io/peerdb](https://github.com/PeerDB-io/peerdb) (Revision: `5868e6e7`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-18T02:42:43.061Z`  
> **Learning ID**: `learn-github-peerdb-io-peerdb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `flow/connectors/postgres/cdc.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in PeerDB-io/peerdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0993bcf9`: postgres: keep SQL NULL elements of a json[] ADD COLUMN default as NULL on nullable mirrors. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `flow/connectors/postgres/cdc.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// json[]/jsonb[] columns, domains included, whose missing value the catalog also reads element by element
	var addedJSONArrayColumnNames []string
			if qkind := types.QValueKind(currRelMap[column.Name]); qkind == types.QValueKindArrayJSON || qkind == types.QValueKindArrayJSONB {
				addedJSONArrayColumnNames = append(addedJSONArrayColumnNames, column.Name)
			}
	addedColumnCatalogInfo, err := p.fetchAddedColumnCatalogInfo(ctx, mappedRelID, addedColumnNames, addedJSONArrayColumnNames)
				// the destination adds a json[] column as Array(Nullable(JSON)) under the nullable setting
				if literal, ok := defaultExprFromPostgresMissingValue(*missingValue, qkind, wrapJSON,
					schemaDelta.NullableEnabled, catalogInfo.missingNullElements); ok {
	// missingNullElements marks the SQL NULL elements of a json[]/jsonb[] missing value, which missingJSON
	// renders as JSON null just like a 'null' element.
	missingNullElements []bool
	hasMissing          bool
	notNull             bool
	ctx context.Context, relID uint32, columnNames []string, jsonArrayColumnNames []string,
	// to_json renders SQL NULL and 'null' elements alike; the last column reads the elements as text[], which keeps them apar
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	addedColumnCatalogInfo, err := p.fetchAddedColumnCatalogInfo(ctx, mappedRelID, addedColumnNames)
				if literal, ok := defaultExprFromPostgresMissingValue(*missingValue, qkind, wrapJSON); ok {
	hasMissing  bool
	notNull     bool
	ctx context.Context, relID uint32, columnNames []string,
		CASE WHEN a.atthasmissing THEN (pg_catalog.to_json(a.attmissingval)->0)::text END
		relID, columnNames)
	if _, err := pgx.ForEachRow(rows, []any{&name, &notNull, &hasMissing, &missingValue, &missingJSON}, func() error {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0993bcf9` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T02:42:43.058Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794969763058",
    "title": "keep SQL NULL elements of a json[] ADD COLUMN default as NULL on nulla",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "PeerDB-io/peerdb",
    "source_uri": "https://github.com/PeerDB-io/peerdb",
    "source_version": "HEAD",
    "content_hash": "661119828452dea784f2cf5be69cfdc0e59df5da96d9b0531ffc7df1af5762b9"
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
        "Harvested/verified timestamp recorded: 2026-11-18T02:42:43.058Z"
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
  "auth_token": "583dae38d8db0781a0e2b7453fb5f267617a7cdc2c5a714a70e435d195563847"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
