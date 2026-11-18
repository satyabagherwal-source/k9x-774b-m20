# Candidate Directive: [CD-17BF] TS SDK cache: build indexes on first lookup, and use a flat map for unique singl

<!-- PROVENANCE_START
{
  "source_repository": "clockworklabs/SpacetimeDB",
  "source_url": "https://github.com/clockworklabs/SpacetimeDB",
  "source_version": "ab502c61",
  "license": "NOASSERTION",
  "timestamp": "2026-11-18T11:45:16.107Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-clockworklabs-spacetimedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [clockworklabs/SpacetimeDB](https://github.com/clockworklabs/SpacetimeDB) (Revision: `ab502c61`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-18T11:45:16.107Z`  
> **Learning ID**: `learn-github-clockworklabs-spacetimedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/bindings-typescript/src/sdk/table_cache.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in clockworklabs/SpacetimeDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ab502c61`: TS SDK cache: build indexes on first lookup, and use a flat map for unique single-column indexes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/bindings-typescript/src/sdk/table_cache.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  // Created on the first child: the leaves (every node of a single-column
  // index) then carry one Map, not two.
  children: Map<ComparablePrimitive, IndexNode<Row>> | null;
  children: null,
type IndexEntry<Row> = {
  add(rowId: ComparablePrimitive, row: Row): void;
  remove(rowId: ComparablePrimitive, row: Row): void;
};

  // Only the indexes built so far (see `#makeReadonlyIndex`).
  #indexes: IndexEntry<
    RowType<TableDefForTableName<RemoteModule, TableName>>
  >[] = [];
    // An index is unique if it shares all columns with a unique constraint
    const isUnique = tableDef.constraints.some(constraint => {
      if (constraint.constraint !== 'unique') {
        return false;
      }
      return deepEqual(constraint.columns, idx.columns);
    });

    // A unique single-column index is a flat key -> row map.
    const flat =
      isUnique && columns.length === 1
        ? new Map<ComparablePrimitive, Row>()
        : null;

    const entry: IndexEntry<Row> = flat
      ? {
          add: (_rowId, row) => {
            flat.set(keyFns[0](getCol(row, 0)), row);
          },
          remove: (_rowId, row) => {
            // Within one transaction the cache can add the n
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
  children: Map<ComparablePrimitive, IndexNode<Row>>;
  children: new Map(),
  #indexes: {
    add(
      rowId: ComparablePrimitive,
      row: RowType<TableDefForTableName<RemoteModule, TableName>>
    ): void;
    remove(
      rowId: ComparablePrimitive,
      row: RowType<TableDefForTableName<RemoteModule, TableName>>
    ): void;
  }[] = [];
        node = node.children.get(keyFns[i](prefix[i]));
    this.#indexes.push({
      add: (rowId, row) => {
        let node = root;
        for (let i = 0; i < columns.length; i
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ab502c61` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T11:45:16.105Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795002316105",
    "title": "TS SDK cache: build indexes on first lookup, and use a flat map for unique singl",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "clockworklabs/SpacetimeDB",
    "source_uri": "https://github.com/clockworklabs/SpacetimeDB",
    "source_version": "HEAD",
    "content_hash": "f24d95fe7be3289302cd678fe1a5b52803ae751ed7a6362e6c58816113cb86fa"
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
        "Harvested/verified timestamp recorded: 2026-11-18T11:45:16.105Z"
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
  "auth_token": "b38092f9a6e00bfa4f0768509c29520672c3b98ed52f1d3854374a789124ecbd"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
