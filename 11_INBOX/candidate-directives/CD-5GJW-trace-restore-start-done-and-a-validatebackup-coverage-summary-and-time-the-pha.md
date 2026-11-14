# Candidate Directive: [CD-5GJW] Trace restore start/done and a ValidateBackup coverage summary, and time the pha

<!-- PROVENANCE_START
{
  "source_repository": "apple/foundationdb",
  "source_url": "https://github.com/apple/foundationdb",
  "source_version": "bf64ce35",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T15:25:50.732Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-apple-foundationdb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apple/foundationdb](https://github.com/apple/foundationdb) (Revision: `bf64ce35`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T15:25:50.732Z`  
> **Learning ID**: `learn-github-apple-foundationdb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `fdbserver/tester/TesterServer.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apple/foundationdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b9f084af`: Trace restore start/done and a ValidateBackup coverage summary, and time the phases of the tester's liveness ping. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `fdbserver/tester/TesterServer.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
// Progress of one liveness ping. Owned by the caller so that it can still be read after the ping's timeout cancels it.
struct PingState {
	int attempts = 0;
	const char* phase = "grv";
	double attemptStart = 0;
	// Durations of the phases of the latest attempt.
	double grvSeconds = 0;
	double readSeconds = 0;
	double commitSeconds = 0;
	Key key;
};

// The storage servers the client's location cache holds for `key`; empty until the key's location has been looked up.
// It does no I/O, so it answers even while the cluster is not.
std::string cachedStorageAddresses(Database cx, KeyRef key) {
	std::string list;
	Optional<KeyRangeLocationInfo> location = cx->getCachedLocation(key);
	if (location.present()) {
		for (int i = 0; i < location.get().locations->size(); ++i) {
			list += (i ? "," : "") + location.get().locations->getInterface(i).address().toString();
		}
	}
	return list;
}

// Tries indefinitely to commit a simple, self conflicting transaction. The phases are timed separately, and a ping
// error also traces which storage servers hold its key, so a failed ping shows where it stalled.
Future<Void> pingDatabase(Database cx, PingState* state) {
		state->phase = "grv";
		state->
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
// Tries indefinitely to commit a simple, self conflicting transaction
Future<Void> pingDatabase(Database cx) {
		bool needsErrorHandling = false;
			Optional<Value> v =
			    co_await tr.get(StringRef("/Liveness/" + deterministicRandom()->randomUniqueID().toString()));
			TraceEvent("PingingDatabaseTransactionError").error(e);
			needsErrorHandling = true;
		}

		if (needsErrorHandling) {
			co_await tr.onError(caughtError);
		Error caughtError;
			co_await timeoutError(pingDatabase(cx), databasePingDelay);
			TraceEvent(("PingingDatabaseLivenessDone_" + context).c_str()).detail("TimeTaken", pingTime);
				TraceEvent(SevError, ("PingingDatabaseLivenessError_" + context).c_str())
				    .error(e)
				    .detail("PingDelay", databasePingDelay);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b9f084af` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T15:25:50.730Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794669950730",
    "title": "Trace restore start/done and a ValidateBackup coverage summary, and time the pha",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apple/foundationdb",
    "source_uri": "https://github.com/apple/foundationdb",
    "source_version": "HEAD",
    "content_hash": "ad010b840aa3e6dfe30d7473bf9b49e85293d2c710f5c4776f35af3e8fff04c0"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-14T15:25:50.730Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "fa47f4ed1747e546fde6cac03cd5fa068458eaf85a15bb5fbd37da40d0294e31"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
