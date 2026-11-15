# Candidate Directive: [CD-L0R0] Snapshot-Bound Deferred Dereferencing for Disaggregated Blob Payloads

<!-- PROVENANCE_START
{
  "source_repository": "lancedb/lancedb",
  "source_url": "https://github.com/lancedb/lancedb",
  "source_version": "f17a07a2",
  "license": "Apache-2.0",
  "timestamp": "2026-11-15T09:21:42.156Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lancedb-lancedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lancedb/lancedb](https://github.com/lancedb/lancedb) (Revision: `f17a07a2`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-15T09:21:42.156Z`  
> **Learning ID**: `learn-github-lancedb-lancedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
```

```rust
// Rust remote query hybrid fusion snapshot verification
let snapshot = |schema: SchemaRef| {
    schema
        .metadata()
        .get("lancedb:query_version")
        .zip(schema.metadata().get("lancedb:query_snapshot"))
        .map(|(version, identity)| (version.clone(), identity.clone()))
};

let stream_schemas = (fts_results.schema(), vec_results.schema());
let fts_snapshot = snapshot(stream_schemas.0.clone());
let vec_snapshot = snapshot(stream_schemas.1.clone());

// Require strict identity equivalence across all producing legs of a hybrid query
let query_snapshot = fts_snapshot.filter(|value| Some(value) == vec_snapshot.as_ref());
if query_snapshot.is_none() && self.parent.as_native().is_none() {
    return Err(Error::InvalidInput {
        message: "Hybrid query legs resolved against inconsistent snapshot identities".into(),
    });
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Querying live table handle for deferred blob chunks
async function unsafeReadBlobs(table: Table, rowIds: bigint[]): Promise<Buffer[]> {
  // FAILS: If another worker committed an overwrite or compaction between the vector query 
  // and this call, table.fetchBlobs reads unaligned bytes from the current HEAD version.
  return await table.fetchBlobs("image_bytes", rowIds); 
}
```

**VERIFICATION METHOD**:
1. Integration test setting up a local HTTP mock server representing a remote dataset.
2. Execute query returning version $V_1$ with dataset identity `v1:aaaa...`.
3. Concurrently commit a complete table overwrite advancing the dataset to $V_2$ with identity `v1:bbbb...` reusing the same row IDs.
4. Execute payload fetch. Assert that the client sends `x-lancedb-query-snapshot: v1:aaaa...` and rejects responses from $V_2$, failing explicitly with mismatched provenance errors instead of returning corrupt bytes.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T09:21:42.154Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794734502154",
    "title": "Snapshot-Bound Deferred Dereferencing for Disaggregated Blob Payloads",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lancedb/lancedb",
    "source_uri": "https://github.com/lancedb/lancedb",
    "source_version": "HEAD",
    "content_hash": "f9d7dc8b68dde5710908c1289762fed2f9061cd92047477812ecb89c6d21f38f"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-15T09:21:42.154Z"
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
  "auth_token": "2ad07681b6e0e5ca96a79adb0d716764d67a981c30ac5e47bc4b7efb1227c57e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
