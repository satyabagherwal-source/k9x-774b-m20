# Candidate Directive: [CD-56BO] eval): benchmark test-version labels drop "governed" on the next publish

<!-- PROVENANCE_START
{
  "source_repository": "dosco-graphjin-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T22:19:52.920Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dosco-graphjin-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dosco-graphjin-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T22:19:52.920Z`  
> **Learning ID**: `LEARN-EVO-dosco-graphjin-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-19T22:19:53.027Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795126793027",
    "title": "eval): benchmark test-version labels drop \"governed\" on the next publish",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dosco-graphjin-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c8b5cc3299a34da3174ea350bf4c5ad9c72016107d60e1349d9365cbeb92ba72"
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:19:53.028Z"
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
  "auth_token": "4fea4eab59af30b447cccce27c63d296226ccc7f29d8bd1e32b73be63b4dd452"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
