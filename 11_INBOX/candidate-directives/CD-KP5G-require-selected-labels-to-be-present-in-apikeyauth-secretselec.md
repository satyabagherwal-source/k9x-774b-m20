# Candidate Directive: [CD-KP5G] require selected labels to be present in apiKeyAuth secretSelec

<!-- PROVENANCE_START
{
  "source_repository": "kgateway-dev/kgateway",
  "source_url": "https://github.com/kgateway-dev/kgateway",
  "source_version": "2cd623a3",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T18:20:00.724Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-kgateway-dev-kgateway",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kgateway-dev/kgateway](https://github.com/kgateway-dev/kgateway) (Revision: `2cd623a3`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T18:20:00.724Z`  
> **Learning ID**: `learn-github-kgateway-dev-kgateway`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/krtcollections/refgrant_source_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in kgateway-dev/kgateway. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2cd623a3`: krtcollections): require selected labels to be present in apiKeyAuth secretSelector. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/krtcollections/refgrant_source_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:

// TestSecretsBySelectorLabelMatch pins that a selector matches the way the API server
// matches it: every label has to be present on the secret with the selected value. A
// marker label has an empty value, and a secret without that label must not pass for
// one that carries it.
func TestSecretsBySelectorLabelMatch(t *testing.T) {
	labeled := func(name string, labels map[string]string) *corev1.Secret {
		sec := testSecret()
		sec.Namespace, sec.Name, sec.Labels = "app-ns", name, labels
		return sec
	}
	objs := []any{
		labeled("gold", map[string]string{"keys.example.com/gold": "", "tier": "gold"}),
		labeled("free", map[string]string{"keys.example.com/free": "", "tier": "free"}),
		labeled("gold-valued", map[string]string{"keys.example.com/gold": "true"}),
		labeled("unlabeled", nil),
	}

	tests := []struct {
		name     string
		selector map[string]string
		want     []string
	}{
		{
			name:     "value",
			selector: map[string]string{"tier": "gold"},
			want:     []string{"gold"},
		},
		{
			name:     "empty value needs the label to be present",
			selector: map[string]string{"keys.example.com/gold": ""},
			want:     []string{"gold"},
		},
		{
			name:     "empty value of a 
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2cd623a3` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T18:20:00.722Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795112400722",
    "title": "require selected labels to be present in apiKeyAuth secretSelec",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kgateway-dev/kgateway",
    "source_uri": "https://github.com/kgateway-dev/kgateway",
    "source_version": "HEAD",
    "content_hash": "17b9081e7933de519bcb0ebe54374c6a09a3282672f48ce2ddeb7ffa65111a3a"
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
        "Harvested/verified timestamp recorded: 2026-11-19T18:20:00.722Z"
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
  "auth_token": "fea428d3816997adfe411acf0b222e2c848a15645333388ecdaa18e295fbe648"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
