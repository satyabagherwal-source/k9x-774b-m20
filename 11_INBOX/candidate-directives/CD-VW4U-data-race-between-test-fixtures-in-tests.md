# Candidate Directive: [CD-VW4U] data race between test fixtures in tests

<!-- PROVENANCE_START
{
  "source_repository": "siderolabs/talos",
  "source_url": "https://github.com/siderolabs/talos",
  "source_version": "ba4a88b6",
  "license": "MPL-2.0",
  "timestamp": "2026-11-14T03:10:34.350Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-siderolabs-talos",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [siderolabs/talos](https://github.com/siderolabs/talos) (Revision: `ba4a88b6`).  
> **License**: MPL-2.0 | **Timestamp**: `2026-11-14T03:10:34.350Z`  
> **Learning ID**: `learn-github-siderolabs-talos`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `internal/app/machined/pkg/controllers/storage/md_array_reconcile_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in siderolabs/talos. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `768ed463`: data race between test fixtures in tests. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/app/machined/pkg/controllers/storage/md_array_reconcile_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// with runs fn under the fake's lock, for tests that seed or inspect fixture
// state while the controller runtime is running.
func (f *fakeMDProvisioner) with(fn func(f *fakeMDProvisioner)) {
	f.mu.Lock()
	defer f.mu.Unlock()

	fn(f)
}

	suite.md.with(func(f *fakeMDProvisioner) {
		f.findByMember["/dev/nvme0n1"] = "/dev/md0"
		f.details["/dev/md0"] = md.Detail{
			Level:       "raid1",
			RaidDevices: 2,
			Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
		}
	})
	suite.md.with(func(f *fakeMDProvisioner) {
		f.findByMember["/dev/nvme0n1"] = "/dev/md0"
		f.details["/dev/md0"] = md.Detail{
			Level:       "raid1",
			RaidDevices: 2,
			Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
		}
	})
	suite.md.with(func(f *fakeMDProvisioner) {
		f.findByMember["/dev/nvme0n1"] = "/dev/md0"
		f.details["/dev/md0"] = md.Detail{
			Level:       "raid1",
			RaidDevices: 2,
			Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
		}
		f.syncAction["/dev/md0"] = md.SyncActionResync
	})
	suite.md.with(func(f *fakeMDProvisioner) {
		f.findByMember["/dev/nvme0n1"] = "/dev/md0"
		f.details["/dev/md0"] = md.Detail{
			Level:       "raid1",
			RaidDevices: 2,
			Members:     []string{"/dev
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	suite.md.findByMember["/dev/nvme0n1"] = "/dev/md0"
	suite.md.details["/dev/md0"] = md.Detail{
		Level:       "raid1",
		RaidDevices: 2,
		Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
	}
	suite.md.findByMember["/dev/nvme0n1"] = "/dev/md0"
	suite.md.details["/dev/md0"] = md.Detail{
		Level:       "raid1",
		RaidDevices: 2,
		Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
	}
	suite.md.findByMember["/dev/nvme0n1"] = "/dev/md0"
	suite.md.details["/dev/md0"] = md.Detail{
		Level:       "raid1",
		RaidDevices: 2,
		Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
	}
	suite.md.syncAction["/dev/md0"] = md.SyncActionResync
	suite.md.findByMember["/dev/nvme0n1"] = "/dev/md0"
	suite.md.details["/dev/md0"] = md.Detail{
		Level:       "raid1",
		RaidDevices: 2,
		Members:     []string{"/dev/nvme0n1", "/dev/nvme1n1"},
	}
	suite.md.syncAction["/dev/md0"] = md.SyncActionRecover
	suite.md.mu.Lock()
	defer suite.md.mu.Unlock()

	metadata := "1.0"
	if name == "data" {
		metadata = "1.2"
	}
	suite.md.details[device] = md.Detail{
		Level:       "raid1",
		RaidDevices: 2,
		Members:     append([]string(nil), members...),
		Name:        "talos:" + name,
		UUID:        "test-" + na
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `768ed463` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T03:10:34.346Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794625834346",
    "title": "data race between test fixtures in tests",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "siderolabs/talos",
    "source_uri": "https://github.com/siderolabs/talos",
    "source_version": "HEAD",
    "content_hash": "01601fabcbd9d8dadb14f18ac2917a022dcdef4d26f9594f644bc59aefd4207d"
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
        "Harvested/verified timestamp recorded: 2026-11-14T03:10:34.346Z"
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
  "auth_token": "0cb146c4b840475cb79ea925e56a1cbd046846936fbfeca60398db2fd8b177f7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
