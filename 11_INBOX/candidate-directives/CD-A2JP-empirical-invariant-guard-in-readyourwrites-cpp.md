# Candidate Directive: [CD-A2JP] Empirical Invariant Guard in ReadYourWrites.cpp

<!-- PROVENANCE_START
{
  "source_repository": "apple-foundationdb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T00:36:58.489Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-apple-foundationdb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apple-foundationdb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T00:36:58.489Z`  
> **Learning ID**: `LEARN-EVO-apple-foundationdb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `fdbclient/ReadYourWrites.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apple/foundationdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `04c62ec9`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `fdbclient/ReadYourWrites.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
			auto& flushedRanges = ryw->nativeWriteRanges;
			if (!flushedRanges.empty()) {
				// Commit appends the remaining conflicts and sorts the native array in place. Keep the flushed
				// descriptors in a separate array; their key bytes already belong to the retained arena.
				VectorRef<KeyRangeRef> saved;
				saved.append(flushedRanges.arena(), flushedRanges.begin(), flushedRanges.size());
				flushedRanges.contents() = saved;
			}
	for (const auto& range : nativeWriteRanges)
		writeConflicts.insert(range.withPrefix(writeConflictRangeKeysRange.begin, result.arena()), "1"_sr);
			nativeWriteRanges = tr.writeConflictRanges();
TEST_CASE("/fdbclient/ReadYourWrites/writeConflictRangesAfterVersionstampedKey") {
	auto db = DatabaseContext::create(
	    makeReference<AsyncVar<ClientDBInfo>>(), Never(), LocalityData(), EnableLocalityLoadBalance::False);
	ReadYourWritesTransaction tr(db);
	tr.clear(KeyRangeRef("a"_sr, "c"_sr));
	tr.atomicOp("b0123456789\x01\x00\x00\x00"_sr, "v"_sr, MutationRef::SetVersionstampedKey);
	tr.setVersion(100);

	auto ranges = tr.getWriteConflictRangeIntersecting(writeConflictRangeKeysRange);
	ASSERT_EQ(ranges.size(), 2);
	ASSERT_EQ(ranges[0], KeyValueRef(writeC
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
		for (const auto& range : nativeWriteRanges)
			writeConflicts.insert(range.withPrefix(writeConflictRangeKeysRange.begin, result.arena()), "1"_sr);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `04c62ec9` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T00:36:58.593Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794789418593",
    "title": "Empirical Invariant Guard in ReadYourWrites.cpp",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apple-foundationdb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "38769679c80fd8178b71e34e67d0b1894a63ac3269d5285ac0af0f74b4e5a048"
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
        "Harvested/verified timestamp recorded: 2026-11-16T00:36:58.594Z"
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
  "auth_token": "a9b91f7693aa407c116f099173c956de444f2976a4b65535b5a1e527b399fcbe"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
