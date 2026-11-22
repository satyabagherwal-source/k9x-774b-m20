# Candidate Directive: [CD-15SY] serv): stop two replicas colliding on revision bumps and metric ticks

<!-- PROVENANCE_START
{
  "source_repository": "dosco-deeporg-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T04:52:00.666Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dosco-deeporg-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dosco-deeporg-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T04:52:00.666Z`  
> **Learning ID**: `LEARN-EVO-dosco-deeporg-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T04:52:00.797Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795323120796",
    "title": "serv): stop two replicas colliding on revision bumps and metric ticks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dosco-deeporg-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "99527ab0235c3c5973b2f0cabeff3f8ab7b40faacf3b985173c885515395e249"
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
        "Harvested/verified timestamp recorded: 2026-11-22T04:52:00.797Z"
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
  "auth_token": "be9084b584ab603726d4fd72af2a520e5e5a2b19caec73040d1374be091c3a79"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
