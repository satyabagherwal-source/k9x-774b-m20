# Candidate Directive: [CD-7I6U] Empirical Invariant Guard in cache.go

<!-- PROVENANCE_START
{
  "source_repository": "karmada-io/karmada",
  "source_url": "https://github.com/karmada-io/karmada",
  "source_version": "6d007132",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T12:59:31.159Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-karmada-io-karmada",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [karmada-io/karmada](https://github.com/karmada-io/karmada) (Revision: `6d007132`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T12:59:31.159Z`  
> **Learning ID**: `learn-github-karmada-io-karmada`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pkg/search/proxy/framework/plugins/cache/cache.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in karmada-io/karmada. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6d007132`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `pkg/search/proxy/framework/plugins/cache/cache.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	jsonserializer "k8s.io/apimachinery/pkg/runtime/serializer/json"
		supportedMediaTypes:  newCacheMediaTypes(),
func newCacheMediaTypes() []runtime.SerializerInfo {
	mediaTypes := unstructuredscheme.NewUnstructuredNegotiatedSerializer().SupportedMediaTypes()
	for i := range mediaTypes {
		if mediaTypes[i].MediaType != "application/json" {
			continue
		}
		// Stream LIST items instead of buffering the entire JSON response. Keep
		// the upstream pretty, YAML, and watch serializers unchanged.
		mediaTypes[i].Serializer = jsonserializer.NewSerializerWithOptions(
			jsonserializer.DefaultMetaFactory,
			unstructuredscheme.NewUnstructuredCreator(),
			unstructuredscheme.NewUnstructuredObjectTyper(),
			jsonserializer.SerializerOptions{StreamingCollectionsEncoding: true},
		)
	}
	return mediaTypes
}

```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
		supportedMediaTypes:  unstructuredscheme.NewUnstructuredNegotiatedSerializer().SupportedMediaTypes(),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6d007132` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T12:59:31.157Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795697971157",
    "title": "Empirical Invariant Guard in cache.go",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "karmada-io/karmada",
    "source_uri": "https://github.com/karmada-io/karmada",
    "source_version": "HEAD",
    "content_hash": "a615f3c90115d818fb1ad2b24bf944d413f8dec2745dd292cc7dcbb98bdf6a24"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-26T12:59:31.157Z"
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
  "auth_token": "a8ff16df338be1f59751fea0dac37d5df77ceb04b49a9813433f83f96b0b5005"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
