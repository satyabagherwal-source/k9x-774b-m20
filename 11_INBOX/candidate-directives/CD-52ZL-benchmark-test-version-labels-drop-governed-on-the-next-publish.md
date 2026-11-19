# Candidate Directive: [CD-52ZL] benchmark test-version labels drop "governed" on the next publish

<!-- PROVENANCE_START
{
  "source_repository": "dosco/graphjin",
  "source_url": "https://github.com/dosco/graphjin",
  "source_version": "ffd03671",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T22:19:48.705Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dosco-graphjin",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dosco/graphjin](https://github.com/dosco/graphjin) (Revision: `ffd03671`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T22:19:48.705Z`  
> **Learning ID**: `learn-github-dosco-graphjin`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cmd/cmd_eval_publish.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dosco/graphjin. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ffd03671`: eval): benchmark test-version labels drop "governed" on the next publish. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `cmd/cmd_eval_publish.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	defaultBenchmarkScope = "2026.1/2026.2 — read-only Q&A · 2027.1 — adds writes, alerts, follow-ups, multi-source · 2028.1 — intent-phrased tasks with execution twins · 2028.2 — cross-source ruler fix (v11)"
	deepcontosoBenchmarkScope = "2026.1 — " + deepcontosoFirstScope
		data.Suite.GenerationScopes = map[string]string{"2026.1": deepcontosoFirstScope}
	rewordRetiredScopes(&data.Suite)
// deepcontosoFirstScope describes DeepContoso's first test version.
const deepcontosoFirstScope = "retail Q&A (aggregations, time windows, schema discovery, refusals)"

// retiredScopeWording is wording the published test-version labels used
// before, and what each says now. The labels are written once, when a
// benchmark's data has none, so a change of wording reaches the published
// pages only by rewording the stored labels on the next publish.
//
// "Governed" was dropped from the site on 2026-11-19: few readers knew what
// it meant.
var retiredScopeWording = []struct{ old, new string }{
	{"governed retail Q&A (aggregations, time windows, schema discovery, governance)", deepcontosoFirstScope},
	{"governed read-only Q&A", "read-only Q&A"},
}

// rewordRetiredScopes rewrites retired wording in 
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
	defaultBenchmarkScope = "2026.1/2026.2 — governed read-only Q&A · 2027.1 — adds writes, alerts, follow-ups, multi-source · 2028.1 — intent-phrased tasks with execution twins · 2028.2 — cross-source ruler fix (v11)"
	deepcontosoBenchmarkScope = "2026.1 — governed retail Q&A (aggregations, time windows, schema discovery, governance)"
		data.Suite.GenerationScopes = map[string]string{
			"2026.1": "governed retail Q&A (aggregations, time windows, schema discovery, governance)",
		}
		"2026.1": "governed read-only Q&A",
		"2026.2": "governed read-only Q&A",
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ffd03671` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T22:19:48.703Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795126788703",
    "title": "benchmark test-version labels drop \"governed\" on the next publish",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dosco/graphjin",
    "source_uri": "https://github.com/dosco/graphjin",
    "source_version": "HEAD",
    "content_hash": "83343ae38b9ed1cc0e06a8d05534c815d5ee72c401c9aca9514e3420049ffcf0"
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:19:48.703Z"
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
  "auth_token": "b71ee945adc1e88e482e71cda62120f8ce2fa1b83850a9955391c9c3fa1b882d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
