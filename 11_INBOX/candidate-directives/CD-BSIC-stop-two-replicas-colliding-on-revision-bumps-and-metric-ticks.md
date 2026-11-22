# Candidate Directive: [CD-BSIC] stop two replicas colliding on revision bumps and metric ticks

<!-- PROVENANCE_START
{
  "source_repository": "dosco/deeporg",
  "source_url": "https://github.com/dosco/graphjin",
  "source_version": "85c58cdb",
  "license": "Apache-2.0",
  "timestamp": "2026-11-22T02:40:18.709Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dosco-deeporg",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dosco/deeporg](https://github.com/dosco/graphjin) (Revision: `85c58cdb`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-22T02:40:18.709Z`  
> **Learning ID**: `learn-github-dosco-deeporg`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `serv/artifacts.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dosco/deeporg. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `73d7188e`: serv): stop two replicas colliding on revision bumps and metric ticks. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `serv/artifacts.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// bumpArtifactRevision moves a domain's revision on by one.
//
// Several replicas bump the same domain at the same moment, so the increment
// is one statement that the database applies atomically. Direct SQL for the
// same reason as claimTaskVerification: the internal GraphQL mutation API
// cannot add to a column or report the affected-row count. Reading the
// revision and writing it back let two replicas both insert a domain's first
// row, and the second failed on the primary key; it also let a slow replica
// write an older number over a newer one.
	db, dbType, _, ok := s.artifactDB()
	if !ok {
	revisions := artifactTableName(dbType, s.conf.Core.EffectiveArtifactsConfig().Schema, "revisions")
	domainCol := quoteStoreIdent(dbType, "domain")
	revisionCol := quoteStoreIdent(dbType, "revision")
	updatedAtCol := quoteStoreIdent(dbType, "updated_at")
	now := time.Now().UTC()
	var updatedAt any = now.Format(time.RFC3339)
	if dbType == "postgres" || dbType == "" {
		updatedAt = now
	}
	increment := func() (bool, error) {
		res, err := s.internalStoreExec(ctx, db, dbType,
			fmt.Sprintf("UPDATE %s SET %s = %s + 1, %s = %s WHERE %s = %s",
				revisions, revisionCol, revisionCol,
			
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	if _, _, _, ok := s.artifactDB(); !ok {
	now := time.Now().UTC().Format(time.RFC3339)
	current, err := s.artifactRevision(ctx, domain)
	if err != nil {
		return err
	input := map[string]any{"domain": domain, "revision": current + 1, "updated_at": now}
	if current == 0 {
		_, err = s.internalStoreMutationRows(ctx, "revisions", `insert: $input`, revisionStoreFields, map[string]any{"input": input})
	_, err = s.internalStoreMutationRows(ctx, "revisions", `where: { domain: { eq: $domain } }, update: $input`, revisionStoreFields, map[string]any{"domain": domain, "input": map[string]any{"revision": current + 1, "updated_at": now}})
	return err
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `73d7188e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T02:40:18.707Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795315218707",
    "title": "stop two replicas colliding on revision bumps and metric ticks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dosco/deeporg",
    "source_uri": "https://github.com/dosco/graphjin",
    "source_version": "HEAD",
    "content_hash": "b46169122f50ec04b7e8fc3bdaa9737e5f7bd0de36c711a08a6a5cdec447698b"
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
        "Harvested/verified timestamp recorded: 2026-11-22T02:40:18.707Z"
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
  "auth_token": "0c47b330eab93957620f8ba886b04e7dd7bd4dc9606112b03954c9615f6ba25c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
