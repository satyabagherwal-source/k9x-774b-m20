# Candidate Directive: [CD-5M94] describeBackup missing a log file written after the log begin was recorded

<!-- PROVENANCE_START
{
  "source_repository": "apple/foundationdb",
  "source_url": "https://github.com/apple/foundationdb",
  "source_version": "3f58d752",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T11:11:43.336Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-apple-foundationdb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apple/foundationdb](https://github.com/apple/foundationdb) (Revision: `3f58d752`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T11:11:43.336Z`  
> **Learning ID**: `learn-github-apple-foundationdb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `fdbclient/BackupContainerFileSystem.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apple/foundationdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c7125893`: describeBackup missing a log file written after the log begin was recorded. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `fdbclient/BackupContainerFileSystem.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
		// Verify the job and use its actual bounds before computing restorability. Older
		// descriptors recorded the job start as a point snapshot. Even a correctly bounded
		// descriptor cannot protect an earlier snapshot from expiration if its job is missing.
		for (auto& s : desc.snapshots) {
			if (s.totalSize != 0 || s.endVersion < desc.unreliableEndVersion.orDefault(0)) {
				continue;
			}
			try {
				auto job = co_await readBulkDumpJobId(bc, s, true);
				if (job.empty()) {
					continue;
				}
				auto batches = co_await BackupContainerFileSystem::readBulkDumpRanges(bc, job);
				auto bounds = std::minmax_element(
				    batches.begin(), batches.end(), [](const auto& a, const auto& b) { return a.version < b.version; });
				s.beginVersion = bounds.first->version;
				s.endVersion = bounds.second->version;
			} catch (Error& e) {
				if (!unusableSnapshot(e)) {
					throw;
				}
				TraceEvent(SevWarn, "BackupDescribeUnreadableBulkDump").error(e).detail("Snapshot", s.fileName);
				s.restorable = false;
			}
		}
		// The stored begin can be too high: log files finish out of order, and a describe that ran before the first one
		// existed stored the begin of the first file i
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
		// Verify the job and use its actual bounds before computing restorability. Older
		// descriptors recorded the job start as a point snapshot. Even a correctly bounded
		// descriptor cannot protect an earlier snapshot from expiration if its job is missing.
		for (auto& s : desc.snapshots) {
			if (s.totalSize != 0 || s.endVersion < desc.unreliableEndVersion.orDefault(0)) {
				continue;
			}
			try {
				auto job = co_await readBulkDumpJobId(bc, s, true);
				if (job.empty()) {
					continue;
				}
				auto batches = co_await BackupContainerFileSystem::readBulkDumpRanges(bc, job);
				auto bounds = std::minmax_element(
				    batches.begin(), batches.end(), [](const auto& a, const auto& b) { return a.version < b.version; });
				s.beginVersion = bounds.first->version;
				s.endVersion = bounds.second->version;
			} catch (Error& e) {
				if (!unusableSnapshot(e)) {
					throw;
				}
				TraceEvent(SevWarn, "BackupDescribeUnreadableBulkDump").error(e).detail("Snapshot", s.fileName);
				s.restorable = false;
			}
		}
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c7125893` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T11:11:43.334Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795259503334",
    "title": "describeBackup missing a log file written after the log begin was recorded",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apple/foundationdb",
    "source_uri": "https://github.com/apple/foundationdb",
    "source_version": "HEAD",
    "content_hash": "4721e8783a70986e0c9d10817cf71e3f2653a4e1f5fc54d68f458fb98688b8ce"
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
        "Harvested/verified timestamp recorded: 2026-11-21T11:11:43.334Z"
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
  "auth_token": "406bbb8a69ad07986b4e7288f5134627abe2ad52475afe18f2c3f4f22898d53b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
