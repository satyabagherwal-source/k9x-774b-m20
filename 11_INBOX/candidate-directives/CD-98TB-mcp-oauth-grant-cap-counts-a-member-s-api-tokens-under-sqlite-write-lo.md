# Candidate Directive: [CD-98TB] MCP OAuth grant cap counts a member's API tokens under SQLite write lo

<!-- PROVENANCE_START
{
  "source_repository": "nezhahq/nezha",
  "source_url": "https://github.com/nezhahq/nezha",
  "source_version": "76b07b58",
  "license": "WTFPL",
  "timestamp": "2026-11-20T17:58:46.751Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nezhahq-nezha",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nezhahq/nezha](https://github.com/nezhahq/nezha) (Revision: `76b07b58`).  
> **License**: WTFPL | **Timestamp**: `2026-11-20T17:58:46.751Z`  
> **Learning ID**: `learn-github-nezhahq-nezha`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cmd/dashboard/controller/mcp_oauth_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nezhahq/nezha. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2008d645`: security: MCP OAuth grant cap counts a member's API tokens under SQLite write lock (DoS). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/dashboard/controller/mcp_oauth_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:

// The cap of 100 authorizations per user is counted on mcp_oauth_grants. A
// member's personal API tokens share api_tokens with the OAuth permission
// identities, have no quota and may be named "OAuth: ..." by their owner, so
// they must neither be read under the write lock nor use up the cap.
func TestMCPOAuthGrantCapCountsGrantsNotAPITokens(t *testing.T) {
	s := setupMCPOAuthSession(t)
	expiry := time.Now().Add(time.Hour)
	for i := range 100 {
		require.NoError(t, singleton.DB.Create(&model.APIToken{UserID: s.userID, Name: "OAuth: personal", TokenHash: model.HashAPIToken("personal-" + strconv.Itoa(i)), ExpiresAt: &expiry}).Error)
	}
	s.tokens(t)
	var grant model.MCPOAuthGrant
	require.NoError(t, singleton.DB.First(&grant).Error)
	require.Equal(t, s.userID, grant.UserID)

	for i := range 99 {
		name := "filler-" + strconv.Itoa(i)
		permission := model.APIToken{UserID: s.userID, Name: "renamed by its owner", TokenHash: model.HashAPIToken(name), ExpiresAt: &expiry}
		require.NoError(t, singleton.DB.Create(&permission).Error)
		require.NoError(t, singleton.DB.Create(&model.MCPOAuthGrant{ID: name, APITokenID: permission.ID, UserID: s.userID, ClientID: s.clientID, AccessHash: mode
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2008d645` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T17:58:46.749Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795197526749",
    "title": "MCP OAuth grant cap counts a member's API tokens under SQLite write lo",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nezhahq/nezha",
    "source_uri": "https://github.com/nezhahq/nezha",
    "source_version": "HEAD",
    "content_hash": "a05c6a59d4628af4cfa50e1cc90dbbc8dd8b751a48c8d6d9cded7a0eca2dba20"
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
        "Harvested/verified timestamp recorded: 2026-11-20T17:58:46.749Z"
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
  "auth_token": "5d87a1de51481fa4abfde1ce41a89ca2624754c1fa6585994958ee0fa57479ee"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
