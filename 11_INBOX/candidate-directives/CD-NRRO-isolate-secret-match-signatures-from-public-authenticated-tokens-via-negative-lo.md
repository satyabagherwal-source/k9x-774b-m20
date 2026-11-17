# Candidate Directive: [CD-NRRO] Isolate Secret Match Signatures from Public Authenticated Tokens via Negative Lookaheads or Exclusion Blocks

<!-- PROVENANCE_START
{
  "source_repository": "aquasecurity/trivy",
  "source_url": "https://github.com/aquasecurity/trivy",
  "source_version": "00b73947",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T08:31:11.700Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aquasecurity-trivy",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aquasecurity/trivy](https://github.com/aquasecurity/trivy) (Revision: `00b73947`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T08:31:11.700Z`  
> **Learning ID**: `learn-github-aquasecurity-trivy`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**: High-entropy secret and credential scanners MUST decouple pattern matching from context verification by utilizing post-match exclusion blocks or negative assertions. Specifically, public identifiers (such as AWS Access Key IDs `AKIA...`) MUST NOT match if they are embedded within pre-signed URLs, query strings (`AWSAccessKeyId=...`), HTTP Authorization headers (`AWS4-HMAC-SHA256 Credential=...`), or form inputs where the token functions as an authentication context identifier accompanied by an ephemeral cryptographic signature.

**WHY**: AWS Access Key IDs are 20-character base-32 tokens that identify an identity but do not themselves authorize access without the corresponding secret key. In presigned S3 URLs, client-side SDK initializers, and signed API requests, the Key ID is transmitted over public mediums alongside a HMAC-SHA256 signature. Flagging these occurrences generates massive false-positive fatigue while scanning source trees and web assets, masking actual leakage of the companion `SecretAccessKey`.

**WHEN TO APPLY**: Secret scanners, static code analyzers, CI/CD commit hooks, and DLP engines parsing arbitrary source text and configurations.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package secret

import (
	"regexp"
)

type Rule struct {
	ID           string
	Severity     string
	Regex        *regexp.Regexp
	ExcludeBlock ExcludeBlock
}

type ExcludeBlock struct {
	Regexes []*regexp.Regexp
}

// BuildAWSAccessKeyRule isolates secret keys from presigned signatures
func BuildAWSAccessKeyRule() Rule {
	return Rule{
		ID:       "aws-access-key-id",
		Severity: "CRITICAL",
		// Use word boundary \b to allow punctuation like quotes, commas, brackets
		Regex: regexp.MustCompile(`\b((?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16})\b`),
		ExcludeBlock: ExcludeBlock{
			Regexes: []*regexp.Regexp{
				// Presigned S3 SigV4 credentials path
				regexp.MustCompile(`[A-Z0-9]{20}(?:/|%2[Ff])\d{8}(?:/|%2[Ff])`),
				// S3 SigV2 Query parameters
				regexp.MustCompile(`(?:[?&]|%3[Ff]|%26)AWSAccessKeyId(?:=|%3D)[A-Z0-9]{20}`),
				// S3 Authorization header credentials
				regexp.MustCompile(`AWS [A-Z0-9]{20}:`),
			},
		},
	}
}

func (r *Rule) IsExcluded(contextWindow []byte) bool {
	for _, excludeRegex := range r.ExcludeBlock.Regexes {
		if excludeRegex.Match(contextWindow) {
			return true
		}
	}
	return false
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Rigid framing regex requiring quotes that misses keys in JSON/JS/CSV,
// coupled with zero exclusion logic for signed query params.
var BadAWSRegex = regexp.MustCompile(`["'](AKIA[A-Z0-9]{16})["']`)
// Fails to match: keys="AKIA1111111111111111,ASIA2222222222222222"
// Incorrectly alerts on: https://s3.amazonaws.com?AWSAccessKeyId=AKIA1111111111111111&Signature=xyz
```

**VERIFICATION METHOD**:
Execute dual-assertion test suites verifying both punctuation-bounded positive matches and presigned negative exclusions:
```go
func TestAWSAccessKeyScenarios(t *testing.T) {
	rule := BuildAWSAccessKeyRule()
	positives := []string{
		`const c={accessKeyId:"AKIAIOSFODNN7EXAMPLE"};`,
		`keys="AKIAIOSFODNN7EXAMPLE,ASIAIOSFODNN7EXAMPLE"`,
	}
	negatives := []string{
		`https://bucket.s3.amazonaws.com/obj?AWSAccessKeyId=AKIAIOSFODNN7EXAMPLE&Signature=abc`,
		`Authorization: AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20261102/us-east-1/s3/aws4_request`,
	}

	for _, text := range positives {
		require.True(t, rule.Regex.MatchString(text))
		require.False(t, rule.IsExcluded([]byte(text)))
	}
	for _, text := range negatives {
		require.True(t, rule.Regex.MatchString(text))
		require.True(t, rule.IsExcluded([]byte(text)), "Failed to exclude signed context: %s", text)
	}
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:31:11.700Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904271700",
    "title": "Isolate Secret Match Signatures from Public Authenticated Tokens via Negative Lookaheads or Exclusion Blocks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aquasecurity/trivy",
    "source_uri": "https://github.com/aquasecurity/trivy",
    "source_version": "HEAD",
    "content_hash": "f4e0ec357196b79fa69b5724df7390377c76101c5476217f40f5db41d6b05f3d"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:31:11.700Z"
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
  "auth_token": "7072bbd0dfd32cd0df0c80422de76f240f8346da081234be471a63e553b7c947"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
