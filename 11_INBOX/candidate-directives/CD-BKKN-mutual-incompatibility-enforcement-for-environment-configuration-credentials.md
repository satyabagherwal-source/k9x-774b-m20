# Candidate Directive: [CD-BKKN] Mutual Incompatibility Enforcement for Environment & Configuration Credentials

<!-- PROVENANCE_START
{
  "source_repository": "hashicorp-terraform-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:21:42.397Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hashicorp-terraform-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hashicorp-terraform-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:21:42.397Z`  
> **Learning ID**: `LEARN-EVO-hashicorp-terraform-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When an infrastructure tool supports both external identity discovery (e.g., Azure AKS Workload Identity, AWS IAM Roles for Service Accounts) and local user configuration (flags, HCL blocks, environment variables), any discrepancy between the two MUST trigger an immediate, fatal configuration validation error before any network client initialization. A silent override or precedence order MUST NOT be applied if conflicting explicit credentials exist.

**WHY**:
Silent fallbacks or priority overriding in authentication leads to severe security misconfigurations. If a developer accidentally leaves a hardcoded client ID in local config while deploying into a production Kubernetes cluster using Workload Identity, silent fallback could authenticate against a staging tenant or fail with an opaque 403 Forbidden error hours into an execution plan.

**WHEN TO APPLY**:
Authentication providers, SDK wrappers, and backend initialization routines dealing with multiple credential ingress channels (IAM, SSO, ENV, Config File, Workload Identity).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package authcheck

import (
	"fmt"
	"os"
	"strings"
)

type AuthConfig struct {
	ExplicitClientID    string
	ClientIDFilePath    string
	UseWorkloadIdentity bool
}

func ValidateAndResolveClientID(cfg AuthConfig) (string, error) {
	clientID := strings.TrimSpace(cfg.ExplicitClientID)

	// 1. Validate file vs literal token conflict
	if cfg.ClientIDFilePath != "" {
		raw, err := os.ReadFile(cfg.ClientIDFilePath)
		if err != nil {
			return "", fmt.Errorf("reading client ID from file %q: %w", cfg.ClientIDFilePath, err)
		}
		fileClientID := strings.TrimSpace(string(raw))
		if clientID != "" && clientID != fileClientID {
			return "", fmt.Errorf("mismatch between supplied client_id and client_id_file_path contents: remove one or align them")
		}
		clientID = fileClientID
	}

	// 2. Validate external Workload Identity environment conflict
	if cfg.UseWorkloadIdentity {
		envClientID := strings.TrimSpace(os.Getenv("AZURE_CLIENT_ID"))
		if envClientID != "" {
			if clientID != "" && clientID != envClientID {
				return "", fmt.Errorf("mismatch between explicit configuration client ID (%q) and AKS Workload Identity environment client ID (%q)", clientID, envClientID)
			}
			clientID = envClientID

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:21:42.503Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794903702503",
    "title": "Mutual Incompatibility Enforcement for Environment & Configuration Credentials",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hashicorp-terraform-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "89bf5f51d4b0d057fdfbe0c3781be328a97fdf6cdeb2d3f9471cf8c95bee8899"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:21:42.503Z"
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
  "auth_token": "4b14c651cf688a8548b85400c448fe09d282c30180f22ad1e66d26ae1d2f7ee9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
