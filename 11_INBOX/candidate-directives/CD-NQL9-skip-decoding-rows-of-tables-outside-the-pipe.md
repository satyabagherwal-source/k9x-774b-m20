# Candidate Directive: [CD-NQL9] skip decoding rows of tables outside the pipe

<!-- PROVENANCE_START
{
  "source_repository": "PeerDB-io/peerdb",
  "source_url": "https://github.com/PeerDB-io/peerdb",
  "source_version": "73bf425f",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-24T01:28:57.693Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-peerdb-io-peerdb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [PeerDB-io/peerdb](https://github.com/PeerDB-io/peerdb) (Revision: `73bf425f`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-24T01:28:57.693Z`  
> **Learning ID**: `learn-github-peerdb-io-peerdb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `flow/connectors/mysql/cdc.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in PeerDB-io/peerdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `73bf425f`: mysql): skip decoding rows of tables outside the pipe. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `flow/connectors/mysql/cdc.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
func (c *MySqlConnector) startSyncer(ctx context.Context, env map[string]string, tables pipeTables) (*binlogSyncer, error) {
		RowsEventDecodeFunc:   tables.decodeRowsEvent,
	tables pipeTables,
		return c.startCdcStreamingFilePos(ctx, parsedOffset.pos, env, tables)
		return c.startCdcStreamingGtid(ctx, parsedOffset.gset, env, tables)
	tables pipeTables,
	syncer, err := c.startSyncer(ctx, env, tables)
	tables pipeTables,
	syncer, err := c.startSyncer(ctx, env, tables)
	tables := newPipeTables(req)
	syncer, mystream, gset, pos, err := c.startStreaming(ctx, req.LastOffset.Text, req.Env, tables)
				if !tables.has(sourceTableName) {
			tableIdToName[ev.TableID] = qualifiedTableName(ev)
			sourceTableName := qualifiedTableName(ev.Table)
			if tables.has(sourceTableName) {
				destinationTableName := req.TableNameMapping[sourceTableName].Name
				exclusion := req.TableNameMapping[sourceTableName].Exclude
				columns := req.TableNameMapping[sourceTableName].Columns
				shouldWrapJSON := func(fd *protos.FieldDescription) bool {
					return shouldWrapNonObjectJSON(
						fd.Name, types.QValueKind(fd.Type), req.Flags, req.InternalVersion, nativeJSON
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
func (c *MySqlConnector) startSyncer(ctx context.Context, env map[string]string) (*binlogSyncer, error) {
		RowsEventDecodeFunc:   decodeRowsEvent,
		return c.startCdcStreamingFilePos(ctx, parsedOffset.pos, env)
		return c.startCdcStreamingGtid(ctx, parsedOffset.gset, env)
	syncer, err := c.startSyncer(ctx, env)
	syncer, err := c.startSyncer(ctx, env)
	syncer, mystream, gset, pos, err := c.startStreaming(ctx, req.LastOffset.Text, req.Env)
				if req.TableNameSchemaMapping[req.TableNameMapping[sourceTableName].Name] == nil {
			tableIdToName[ev.TableID] = string(ev.Schema) + "." + string(ev.Table)
			sourceTableName := string(ev.Table.Schema) + "." + string(ev.Table.Table) // TODO this is fragile
			destinationTableName := req.TableNameMapping[sourceTableName].Name
			exclusion := req.TableNameMapping[sourceTableName].Exclude
			columns := req.TableNameMapping[sourceTableName].Columns
			shouldWrapJSON := func(fd *protos.FieldDescription) bool {
				return shouldWrapNonObjectJSON(fd.Name, types.QValueKind(fd.Type), req.Flags, req.InternalVersion, nativeJSONEnabled, columns)
			}
			schema := req.TableNameSchemaMapping[destinationTableName]
			if schema != nil {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `73bf425f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T01:28:57.691Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795483737691",
    "title": "skip decoding rows of tables outside the pipe",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "PeerDB-io/peerdb",
    "source_uri": "https://github.com/PeerDB-io/peerdb",
    "source_version": "HEAD",
    "content_hash": "a572020d972fef7871524c5fae12afde014ab864db0ec30110bdf47ff5a8f139"
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
        "Harvested/verified timestamp recorded: 2026-11-24T01:28:57.691Z"
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
  "auth_token": "b46b13fb094a17c25503425c8a12764d2f5d2cfcea262daff406ea67cb0f8857"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
