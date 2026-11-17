# Candidate Directive: [CD-P7XD] Isolate Secret Match Signatures from Public Authenticated Tokens via Negative Lookaheads or Exclusion Blocks

<!-- PROVENANCE_START
{
  "source_repository": "aquasecurity-trivy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:32:19.198Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-aquasecurity-trivy-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aquasecurity-trivy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:32:19.198Z`  
> **Learning ID**: `LEARN-EVO-aquasecurity-trivy-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:32:19.297Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904339297",
    "title": "Isolate Secret Match Signatures from Public Authenticated Tokens via Negative Lookaheads or Exclusion Blocks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aquasecurity-trivy-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "20858e6873f76fb54dcaa13fb92e3d0ea20daa139a94d39c4e5c01d96b4dc8ac"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-17T08:32:19.297Z"
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
  "auth_token": "0c6d63531cf23ded86283f173b1895ccd353a7b0f79c230d229d87f5717d29d6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
