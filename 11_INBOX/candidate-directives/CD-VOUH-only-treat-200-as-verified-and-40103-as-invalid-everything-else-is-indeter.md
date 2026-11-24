# Candidate Directive: [CD-VOUH] only treat 200 as verified and 40103 as invalid; everything else is indeter

<!-- PROVENANCE_START
{
  "source_repository": "trufflesecurity/trufflehog",
  "source_url": "https://github.com/trufflesecurity/trufflehog",
  "source_version": "23255461",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-24T23:58:50.249Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-trufflesecurity-trufflehog",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trufflesecurity/trufflehog](https://github.com/trufflesecurity/trufflehog) (Revision: `23255461`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-24T23:58:50.249Z`  
> **Learning ID**: `learn-github-trufflesecurity-trufflehog`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/detectors/duo/duo.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in trufflesecurity/trufflehog. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `23255461`: Duo: only treat 200 as verified and 40103 as invalid; everything else is indeterminate. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/detectors/duo/duo.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"encoding/json"
	"errors"
const (
	adminAPIPath = "/admin/v1/info/summary" // https://duo.com/docs/adminapi#account-info
	authAPIPath  = "/auth/v2/check"         // https://duo.com/docs/authapi#check

	adminApplication = "Admin API"
	authApplication  = "Auth API"

	duoCodeInvalidSignature = 40103
	duoCodeAccessForbidden  = 40301
)

type duoReply struct {
	status int
	code   int
}

// FromData will find and optionally verify Duo secrets in a given set of bytes.
						"application": adminApplication,
						"application": adminApplication,
					verified, application, verificationErr := verifyMatch(ctx, s.getClient(), host, apiKey, apiSecret)
					s1.ExtraData["application"] = application
					s1.SecretParts["application"] = application
// verifyMatch checks the credentials against the Admin API, then the Auth API, and
// returns whether they are valid and which application they belong to.
//
// Only a 200 from either API proves the credentials valid, and only error code 40103
// (invalid signature) from either API proves them invalid: that API recognized the
// integration key and rejected the secret key. Other responses are reported as a verification error.
func verifyMatch(
) (bool
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// FromData will find and optionally verify DeepSeek secrets in a given set of bytes.
						"application": "Admin API",
						"application": "Admin API",
					verified, verificationErr := VerifyAdminToken(ctx, s.getClient(), host, apiKey, apiSecret)
					// we will try auth api verification if admin api verification fails without error,
					// which is in the case of it returning 401 unauthorized due to invalid credentials.
					if !verified && verificationErr == nil {
						var authStatusCode int
						verified, authStatusCode, verificationErr = VerifyAuthToken(ctx, s.getClient(), host, apiKey, apiSecret)
						// The Auth API responds 403 (not 401) when ikey/skey are
						// structurally valid Admin API keys, active or not. That still
						// counts as verified, but the keys remain Admin API keys, so
						// only relabel to Auth API when the check actually succeeded (200).
						if authStatusCode != http.StatusForbidden {
							s1.ExtraData["application"] = "Auth API"
							s1.SecretParts["application"] = "Auth API"
						}
					}
// returns verified=true if credentials are valid and belong to auth api, false if creds are invalid, and error if creds belong to auth api or fo
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `23255461` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T23:58:50.248Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795564730247",
    "title": "only treat 200 as verified and 40103 as invalid; everything else is indeter",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trufflesecurity/trufflehog",
    "source_uri": "https://github.com/trufflesecurity/trufflehog",
    "source_version": "HEAD",
    "content_hash": "22a34bf1461b753e847fd6f9c1acebecec6885ca5828bbfe4e6c74c0e5431a27"
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
        "Harvested/verified timestamp recorded: 2026-11-24T23:58:50.248Z"
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
  "auth_token": "49ad347ddb8f8567c89c62cff8f60d7251dc45d15dd84dd1faee5931f620828e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
