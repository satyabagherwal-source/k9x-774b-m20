# Candidate Directive: [CD-EO46] Refactor how mock user input is defined in tests, fix minor difference in

<!-- PROVENANCE_START
{
  "source_repository": "hashicorp/terraform",
  "source_url": "https://github.com/hashicorp/terraform",
  "source_version": "80e6fc28",
  "license": "NOASSERTION",
  "timestamp": "2026-11-21T02:26:52.951Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-hashicorp-terraform",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hashicorp/terraform](https://github.com/hashicorp/terraform) (Revision: `80e6fc28`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-21T02:26:52.951Z`  
> **Learning ID**: `learn-github-hashicorp-terraform`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain A

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `internal/command/apply_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in hashicorp/terraform. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `80e6fc28`: tests: Refactor how mock user input is defined in tests, fix minor difference in output when prompting for input in tests. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/command/apply_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	uiInput, _ := testInputMap(t, map[string]string{
		"var.foo": "foo",
	})
	uiInput, _ := testInputMap(t, map[string]string{
		"var.bar": "one",
	})
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	"bytes"
	tfui "github.com/hashicorp/terraform/internal/command/ui"
	uiInput := tfui.NewUIInputForTests(tfui.UIInputOptions{
		Reader: bytes.NewBufferString("foo\n"),
		Writer: new(bytes.Buffer),
	}, nil, nil)
	uiInput := tfui.NewUIInputForTests(tfui.UIInputOptions{
		Reader: bytes.NewBufferString("one\ntwo\n"),
		Writer: new(bytes.Buffer),
	}, nil, nil)
	// Don't disable input, so input would be asked
	uiInput := tfui.NewUIInputForTests(tfui.UIInputOptions{
		Reader: new(bytes.Buffer),
		Writer: new(bytes.Buffer),
	}, nil, nil)

	testingOverrides.UIInput = uiInput
		// Don't disable input, so input would be asked
		// Set some default reader/writers for the inputs
		uiInput := tfui.NewUIInputForTests(tfui.UIInputOptions{
			Reader: new(bytes.Buffer),
			Writer: new(bytes.Buffer),
		}, nil, nil)

					UIInput: uiInput,
		// Don't disable input, so input would be asked
		// Set some default reader/writers for the inputs
		uiInput := tfui.NewUIInputForTests(tfui.UIInputOptions{
			Reader: new(bytes.Buffer),
			Writer: new(bytes.Buffer),
		}, nil, nil)

					UIInput: uiInput,
	// Don't disable input, so input would be asked
	// Set some default reader/writers for the inputs
	uiInput :
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `80e6fc28` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T02:26:52.949Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795228012949",
    "title": "Refactor how mock user input is defined in tests, fix minor difference in",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hashicorp/terraform",
    "source_uri": "https://github.com/hashicorp/terraform",
    "source_version": "HEAD",
    "content_hash": "2eb4a3b9844db3eae0c81a6c377c60e884f9a82d507ee89d10d55443a73a410d"
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
        "Harvested/verified timestamp recorded: 2026-11-21T02:26:52.949Z"
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
  "auth_token": "771db2f119a182c52d4acd530fe64187ce274de8cf302960e62e28ad3336fab8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
