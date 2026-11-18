# Candidate Directive: [CD-Y36J] Preserve sampled V6 trace IDs and reject zero tracing IDs

<!-- PROVENANCE_START
{
  "source_repository": "apple/foundationdb",
  "source_url": "https://github.com/apple/foundationdb",
  "source_version": "33871e2f",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T07:30:54.235Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-apple-foundationdb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apple/foundationdb](https://github.com/apple/foundationdb) (Revision: `33871e2f`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T07:30:54.235Z`  
> **Learning ID**: `learn-github-apple-foundationdb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `bindings/c/test/unit/unit_tests.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apple/foundationdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dc406d9f`: Preserve sampled V6 trace IDs and reject zero tracing IDs. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `bindings/c/test/unit/unit_tests.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
static void wait_for_client_connection() {
	// The external client may still be connecting. Keep the retrying read in a separate
	// transaction so tracing options can be set before any reads in the test transaction.
	get_value(key(""), /* snapshot */ true, {});
}

	wait_for_client_connection();
	wait_for_client_connection();
	std::string_view expectedDetail;
	SUBCASE("invalid tracing ID") {
		constexpr std::string_view idKey = "\xff\xff/tracing/transaction_id";
		expectedDetail = "transaction_id";
		SUBCASE("out-of-range decimal transaction ID") {
			tr.set(idKey, "18446744073709551616");
		}
		SUBCASE("non-hexadecimal digit in transaction ID") {
			tr.set(idKey, "0000000000000001000000000000000g");
		}
		SUBCASE("zero decimal transaction ID") {
			tr.set(idKey, "0");
		}
		SUBCASE("zero hexadecimal transaction ID") {
			tr.set(idKey, "00000000000000000000000000000000");
		}
	SUBCASE("invalid maintenance duration") {
		constexpr std::string_view zoneKey = "\xff\xff/management/maintenance/zone1";
		expectedDetail = "duration";
		SUBCASE("non-numeric maintenance duration") {
			tr.set(zoneKey, "abc");
		}
		SUBCASE("non-finite maintenance duration") {
			tr.set(zoneKey, "nan");
		}

```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
	SUBCASE("out-of-range decimal transaction ID") {
		tr.set("\xff\xff/tracing/transaction_id", "18446744073709551616");
	}
	SUBCASE("non-hexadecimal digit in transaction ID") {
		tr.set("\xff\xff/tracing/transaction_id", "0000000000000001000000000000000g");
	}
	SUBCASE("non-numeric maintenance duration") {
		tr.set("\xff\xff/management/maintenance/zone1", "abc");
	}
	SUBCASE("non-finite maintenance duration") {
		tr.set("\xff\xff/management/maintenance/zone1", "nan");
	SUBCASE("maintenance duration exceeds the version range") {
		tr.set("\xff\xff/management/maintenance/zone1", "1e30");
	CHECK(present);
	CHECK(length > 0);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dc406d9f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T07:30:54.233Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794987054233",
    "title": "Preserve sampled V6 trace IDs and reject zero tracing IDs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apple/foundationdb",
    "source_uri": "https://github.com/apple/foundationdb",
    "source_version": "HEAD",
    "content_hash": "af886fa1b22cb6b0850f043f9020394520a8e76a491c76a6ec351284e7835d64"
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
        "Harvested/verified timestamp recorded: 2026-11-18T07:30:54.233Z"
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
  "auth_token": "7e4c2ff97b7b81cac35bb94df80e82efd672d99d1e07a2eb461012673f4f66ec"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
