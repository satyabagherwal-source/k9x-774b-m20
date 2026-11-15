# Candidate Directive: [CD-S0BN] Snapshot-Bound Deferred Dereferencing for Disaggregated Blob Payloads

<!-- PROVENANCE_START
{
  "source_repository": "lancedb-lancedb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T09:27:08.105Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-lancedb-lancedb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lancedb-lancedb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T09:27:08.105Z`  
> **Learning ID**: `LEARN-EVO-lancedb-lancedb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When an engine decouples metadata/scalar queries from deferred payload retrieval (e.g., Blobs, LOBs, out-of-band tensors), the query response MUST inject immutable snapshot provenance (`version` + content digest/UUID) into stream-level metadata. The client MUST bind subsequent payload fetch calls exclusively to that immutable snapshot identity and MUST NOT query the live or floating table HEAD.

**WHY**:
In a multi-version concurrency control (MVCC) or cloud-backed database, concurrent write transactions, table overwrites, or schema mutations occurring between query execution (T1) and deferred payload hydration (T2) cause payload corruption. A query executed at version $V_1$ fetching payloads from $V_2$ produces silent scalar-payload mismatches: Row ID $N$ in $V_1$ might refer to record $A$, but after an overwrite or compaction, Row ID $N$ in $V_2$ refers to record $B$ or points out of bounds.

**WHEN TO APPLY**:
- Systems with separated storage/index engines (vector databases, lakehouses, search engines).
- Columnar layouts with externalized blob storage (Lance Blob v2, Parquet byte-range pointers).
- Distributed SDKs with lazy-loading interfaces (`toArray()`, `toArrow()`, `fetch_blobs()`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Node.js/TypeScript query execution binding deferred reads to response snapshot
export async function collectAndHydrateBlobs(
  query: QueryBase,
  context: QueryContext,
  options: QueryExecutionOptions
): Promise<ArrowTable> {
  const addRowId = !context.withRowId;
  // Execute query stream and retain executed stream schema metadata
  const table = await query.collect(options, addRowId);
  const sources = projectedBlobSources(table.schema, context.projection);

  if (sources.length === 0) {
    return addRowId ? table.select(nonRowIdFields(table.schema)) : table;
  }

  // Extract immutable provenance injected by query node into stream metadata
  const version = table.schema.metadata.get("lancedb:query_version");
  const identity = table.schema.metadata.get("lancedb:query_snapshot");

  if (version === undefined || identity === undefined) {
    throw new Error(
      'blobMode "bytes" requires a trustworthy query snapshot: missing, invalid, ' +
      'or inconsistent x-lancedb-query-version or x-lancedb-query-snapshot headers. ' +
      'Upgrade serving nodes or use blobMode "descriptions".'
    );
  }

  // Materialize an independent read-only handle pinned to the exact version + content hash
  const pinnedSnapshot = await context.table.querySnapshotWithIdentity(
    version,
    identity
  );

  // Fetch binary payloads exclusively through pinned snapshot
  return readBlobBytes(table, sources, pinnedSnapshot, addRowId);
}

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T09:27:08.194Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794734828194",
    "title": "Snapshot-Bound Deferred Dereferencing for Disaggregated Blob Payloads",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lancedb-lancedb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "51723c6b6e3bf0c256762472ee0f8d34a06ac7280756800ddc86cf0cba59df1b"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-15T09:27:08.194Z"
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
  "auth_token": "29261680a3aeafd3e544d89d15e348142587e7ee246e4da9943d64b34d4fcd20"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
