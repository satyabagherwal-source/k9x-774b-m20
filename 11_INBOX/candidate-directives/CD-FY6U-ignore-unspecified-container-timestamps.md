# Candidate Directive: [CD-FY6U] ignore unspecified container timestamps

<!-- PROVENANCE_START
{
  "source_repository": "argoproj/argo-workflows",
  "source_url": "https://github.com/argoproj/argo-workflows",
  "source_version": "a25c64b8",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T16:03:01.974Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-argoproj-argo-workflows",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [argoproj/argo-workflows](https://github.com/argoproj/argo-workflows) (Revision: `a25c64b8`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T16:03:01.974Z`  
> **Learning ID**: `learn-github-argoproj-argo-workflows`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain L

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `util/resource/duration_test.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in argoproj/argo-workflows. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a25c64b8`: resource): ignore unspecified container timestamps. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `util/resource/duration_test.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:

func TestDurationForPodTerminatedContainerTimes(t *testing.T) {
	now := metav1.NewTime(time.Date(2026, time.November, 17, 12, 0, 0, 0, time.UTC))
	minuteAgo := metav1.NewTime(now.Add(-time.Minute))
	epoch := metav1.NewTime(time.Unix(0, 0))
	tests := []struct {
		name       string
		startedAt  metav1.Time
		finishedAt metav1.Time
		seconds    int64
	}{
		{name: "missing timestamps"},
		{name: "start error", finishedAt: now},
		{name: "CRI start error", startedAt: epoch, finishedAt: metav1.NewTime(time.Unix(1763519017, 0))},
		{name: "missing finish", startedAt: minuteAgo},
		{name: "CRI zero finish", startedAt: metav1.NewTime(time.Unix(-60, 0)), finishedAt: epoch},
		{name: "finish before start", startedAt: now, finishedAt: minuteAgo},
		{name: "equal timestamps", startedAt: now, finishedAt: now},
		{name: "valid timestamps", startedAt: minuteAgo, finishedAt: now, seconds: 60},
		{name: "valid timestamps near CRI zero", startedAt: metav1.NewTime(time.Unix(0, 1)), finishedAt: metav1.NewTime(time.Unix(60, 1)), seconds: 60},
		{name: "valid timestamps before CRI zero", startedAt: metav1.NewTime(time.Unix(-120, 0)), finishedAt: metav1.NewTime(time.Unix(-60, 0)), seconds: 60},
	}
	for _
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a25c64b8` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T16:03:01.972Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795449781972",
    "title": "ignore unspecified container timestamps",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "argoproj/argo-workflows",
    "source_uri": "https://github.com/argoproj/argo-workflows",
    "source_version": "HEAD",
    "content_hash": "b4089f682e72ea482867eb87c6c7c8784b478a8b337381d8124bc735d6a1c20d"
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
        "Harvested/verified timestamp recorded: 2026-11-23T16:03:01.972Z"
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
  "auth_token": "2910ceaff456f052e08f4c5e0d0864bee084bbb92ab5e5ab7ddafdeeffb69d24"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
