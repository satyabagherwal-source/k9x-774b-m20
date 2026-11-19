# Candidate Directive: [CD-TI38] verify via identity endpoint so proxy 403s aren't reported as live

<!-- PROVENANCE_START
{
  "source_repository": "trufflesecurity/trufflehog",
  "source_url": "https://github.com/trufflesecurity/trufflehog",
  "source_version": "d232362a",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-19T23:34:47.252Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-trufflesecurity-trufflehog",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trufflesecurity/trufflehog](https://github.com/trufflesecurity/trufflehog) (Revision: `d232362a`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-19T23:34:47.252Z`  
> **Learning ID**: `learn-github-trufflesecurity-trufflehog`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/detectors/saucelabs/saucelabs.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in trufflesecurity/trufflehog. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d232362a`: Saucelabs: verify via identity endpoint so proxy 403s aren't reported as live. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/detectors/saucelabs/saucelabs.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"encoding/json"
	client *http.Client
	defaultClient = common.SaneHttpClient()
	baseUrlPat  = regexp.MustCompile(`\b(api\.(?:us|eu)-(?:west|east|central)-[0-9]\.saucelabs\.com)\b`)
type identityResponse struct {
	Sub string `json:"sub"`
}

func (s Scanner) getClient() *http.Client {
	if s.client != nil {
		return s.client
	}
	return defaultClient
}

					isVerified, verificationErr := verifySauceLabKey(ctx, s.getClient(), userName, key, baseURL)
// verifySauceLabKey calls the identity endpoint, which accepts any valid credential regardless of role
// and is documented to return only 200 or 401. Any other response (e.g. a 403 from a proxy) is indeterminate.
	apiURL := fmt.Sprintf("https://%s/auth/v1/identity", baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, http.NoBody)
	case http.StatusOK:
		var identity identityResponse
		if err := json.NewDecoder(resp.Body).Decode(&identity); err != nil {
			return false, fmt.Errorf("unexpected response body: %w", err)
		}
		if identity.Sub == "" {
			return false, fmt.Errorf("unexpected response body: missing account id")
		}
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	client = common.SaneHttpClient()
	baseUrlPat  = regexp.MustCompile(`\b(api\.(?:us|eu)-(?:west|east|central)-[0-9].saucelabs\.com)\b`)
					isVerified, verificationErr := verifySauceLabKey(ctx, client, userName, key, baseURL)
	apiURL := fmt.Sprintf("https://%s/team-management/v1/teams", baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	case http.StatusOK, http.StatusForbidden:
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d232362a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T23:34:47.250Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795131287250",
    "title": "verify via identity endpoint so proxy 403s aren't reported as live",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trufflesecurity/trufflehog",
    "source_uri": "https://github.com/trufflesecurity/trufflehog",
    "source_version": "HEAD",
    "content_hash": "b46f0440677d1c7dec796446f357ce5fecaa21ed87490799a18dfd961fadb199"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T23:34:47.250Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "b383231cefe7fd45f5cfb67e6344e8b168d1a75b1272608d0cedb47d6e032ccb"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
