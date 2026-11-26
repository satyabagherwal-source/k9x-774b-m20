# Candidate Directive: [CD-PA9Q] Have cosign verify require https://sigstore.dev/cosign/sign/v1 predicateType

<!-- PROVENANCE_START
{
  "source_repository": "sigstore/cosign",
  "source_url": "https://github.com/sigstore/cosign",
  "source_version": "fd42a8ca",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T00:09:31.454Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-sigstore-cosign",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sigstore/cosign](https://github.com/sigstore/cosign) (Revision: `fd42a8ca`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T00:09:31.454Z`  
> **Learning ID**: `learn-github-sigstore-cosign`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cmd/cosign/cli/verify/verify.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in sigstore/cosign. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fd42a8ca`: Have cosign verify require https://sigstore.dev/cosign/sign/v1 predicateType. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/cosign/cli/verify/verify.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	"github.com/sigstore/cosign/v3/pkg/types"
		var displayName string
			displayName = img
			displayName = ref.Name()
		}
		verifiedOutput, err := transformOutput(verified, displayName)
		if err != nil {
			return err
		}
		if len(verifiedOutput) > 0 {
			PrintVerificationHeader(ctx, displayName, co, bundleVerified, fulcioVerified)
			PrintVerification(ctx, verifiedOutput, c.Output)
		} else {
			return fmt.Errorf("no matching signatures exist")
	// We might not understand bundles not produced by Cosign, so skip them
			continue
			continue
			continue
			continue
			continue
		}
		if intotoStatement.PredicateType != types.CosignSignPredicateType {
			continue
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
			PrintVerificationHeader(ctx, img, co, bundleVerified, fulcioVerified)
			PrintVerification(ctx, verified, c.Output)
			verifiedOutput, err := transformOutput(verified, ref.Name())
			if err == nil {
				verified = verifiedOutput
			}

			PrintVerificationHeader(ctx, ref.Name(), co, bundleVerified, fulcioVerified)
			PrintVerification(ctx, verified, c.Output)
			return nil, err
			return nil, err
			return nil, fmt.Errorf("unable to understand payload type %s", dsseEnvelope.PayloadType)
			return nil, err
			return nil, fmt.Errorf("no intoto subject or digest found")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fd42a8ca` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T00:09:31.452Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795651771452",
    "title": "Have cosign verify require https://sigstore.dev/cosign/sign/v1 predicateType",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "sigstore/cosign",
    "source_uri": "https://github.com/sigstore/cosign",
    "source_version": "HEAD",
    "content_hash": "f06f51b1d7c0823c29ac7fd166c3a25b11edb126e27bba53f1b4a72d7dc9645d"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-26T00:09:31.452Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "2f47e18eb7963324a0b07a14134763cf6d94b1a47cc1c1c5e04528805eca97fb"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
