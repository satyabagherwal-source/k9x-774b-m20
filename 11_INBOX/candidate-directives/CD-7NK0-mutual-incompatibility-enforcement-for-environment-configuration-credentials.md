# Candidate Directive: [CD-7NK0] Mutual Incompatibility Enforcement for Environment & Configuration Credentials

<!-- PROVENANCE_START
{
  "source_repository": "hashicorp/terraform",
  "source_url": "https://github.com/hashicorp/terraform",
  "source_version": "b3fb138b",
  "license": "NOASSERTION",
  "timestamp": "2026-11-17T08:18:39.744Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-hashicorp-terraform",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hashicorp/terraform](https://github.com/hashicorp/terraform) (Revision: `b3fb138b`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-17T08:18:39.744Z`  
> **Learning ID**: `learn-github-hashicorp-terraform`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
		}
	}

	if clientID == "" {
		return "", fmt.Errorf("client ID resolved to empty string; credentials required")
	}

	return clientID, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Silent precedence fallback hiding operator misconfiguration
func ResolveCredentialsSilently(cfg AuthConfig) string {
    // VIOLATION: If operator passes ID_A in config and sets ID_B in pod environment,
    // ID_A silently masks ID_B, or vice-versa, causing cross-tenant operational disasters.
    if cfg.ExplicitClientID != "" {
        return cfg.ExplicitClientID
    }
    return os.Getenv("AZURE_CLIENT_ID")
}
```

**VERIFICATION METHOD**:
Run a parameterized test matrix asserting:
1. `cfg.ExplicitClientID = "A"`, `os.Setenv("AZURE_CLIENT_ID", "B")`, `UseWorkloadIdentity = true` -> returns error containing "mismatch".
2. `cfg.ExplicitClientID = "A"`, `os.Setenv("AZURE_CLIENT_ID", "A")`, `UseWorkloadIdentity = true` -> returns `"A"`, `err == nil`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:18:39.743Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794903519743",
    "title": "Mutual Incompatibility Enforcement for Environment & Configuration Credentials",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hashicorp/terraform",
    "source_uri": "https://github.com/hashicorp/terraform",
    "source_version": "HEAD",
    "content_hash": "1d32851761c38c24d2641b2e126a2fe566b568629ae21ea8d9bfbcb503b223ce"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:18:39.744Z"
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
  "auth_token": "9c4995cd382466e62a29fd478d7fc9074ef3b7154ef583a86105bbe024c9c589"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
