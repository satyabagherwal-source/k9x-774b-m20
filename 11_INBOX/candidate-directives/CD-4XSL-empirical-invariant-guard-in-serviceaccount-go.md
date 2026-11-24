# Candidate Directive: [CD-4XSL] Empirical Invariant Guard in serviceaccount.go

<!-- PROVENANCE_START
{
  "source_repository": "kubeedge-kubeedge-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T17:34:06.952Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kubeedge-kubeedge-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kubeedge-kubeedge-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T17:34:06.952Z`  
> **Learning ID**: `LEARN-EVO-kubeedge-kubeedge-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `edge/pkg/metamanager/client/serviceaccount.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kubeedge/kubeedge. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ddced73b`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `edge/pkg/metamanager/client/serviceaccount.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// baseKey is the spec-derived key prefix that identifies the logical token
// (independent of which generation). All generations of the same logical token
// share this prefix. Used for prefix lookup in metaDB.
func baseKey(name, namespace string, tr *authenticationv1.TokenRequest) string {
// KeyFunc returns the per-generation storage key for a TokenRequest. The key
// is the base (spec-derived) key suffixed with the token's exp timestamp so
// that successive refreshed tokens for the same logical token are stored as
// separate rows. This is required to keep the previous (still un-expired)
// token's row in metaDB during the propagation window between a refresh and
// the moment the pod re-reads the new token from its projected volume; without
// it, MetaServer (which authenticates by checking metaDB membership) rejects
// requests bearing the previous token.
//
// Callers without a populated Status.ExpirationTimestamp (i.e., callers that
// only have a TokenRequest spec, like an upstream kubelet refresh call) should
// not use KeyFunc — they should use baseKey and a prefix query.
//
// Keys are nonconfidential and safe to log.
func KeyFunc(name, namespace string, tr *authentica
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// KeyFunc keys should be nonconfidential and safe to log
func KeyFunc(name, namespace string, tr *authenticationv1.TokenRequest) string {
func getTokenLocally(name, namespace string, tr *authenticationv1.TokenRequest) (*authenticationv1.TokenRequest, error) {
	resKey := KeyFunc(name, namespace, tr)
	metas, err := ms.QueryMeta("key", resKey)
		klog.Errorf("query meta %s failed: %v", resKey, err)
	if len(*metas) != 1 {
		klog.Errorf("query meta %s length error", resKey)
		return nil, fmt.Errorf("query meta %s length error", resKey)
	var tokenRequest authenticationv1.TokenRequest
	err = json.Unmarshal([]byte((*metas)[0]), &tokenRequest)
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T17:34:07.123Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795541647123",
    "title": "Empirical Invariant Guard in serviceaccount.go",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kubeedge-kubeedge-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "6187a26a7c21137b50e33277dde1edf24e3e8b0f141be93991078af6ff50e0dc"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T17:34:07.123Z"
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
  "auth_token": "975a6bb0cd451b16a6bf3b14d28012ca33ad915988ec01d47c05ade729b7c57c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
