# Candidate Directive: [CD-OU57] api: honor search cancellation and report timeouts

<!-- PROVENANCE_START
{
  "source_repository": "prometheus-prometheus-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T18:08:35.855Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-prometheus-prometheus-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [prometheus-prometheus-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T18:08:35.855Z`  
> **Learning ID**: `LEARN-EVO-prometheus-prometheus-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain J

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `storage/generic.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in prometheus/prometheus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `77b65d53`: api: honor search cancellation and report timeouts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `storage/generic.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// checkContextEveryNIterations is used in some tight loops to check if the context is done.
const checkContextEveryNIterations = 128

// ApplySearchHints filters, orders, and limits values using a non-nil ctx.
// Values must be ascending unless hints specifies score ordering with a filter.
// Nil hints use the zero-value defaults. Cancellation returns the context error.
func ApplySearchHints(ctx context.Context, values []string, hints *SearchHints) ([]SearchResult, error) {
		return applySearchHintsNoFilter(ctx, values, hints)
			return topKByScore(ctx, values, hints.Filter, hints.Limit)
			return reverseFilterEarlyExit(ctx, values, hints.Filter, hints.Limit)
	return applySearchHintsLinear(ctx, values, hints)
}

func searchHintsContextErr(ctx context.Context, i int) error {
	if i%checkContextEveryNIterations != 0 {
		return nil
	}
	return ctx.Err()
func reverseFilterEarlyExit(ctx context.Context, values []string, filter Filter, limit int) ([]SearchResult, error) {
		if err := searchHintsContextErr(ctx, len(values)-1-i); err != nil {
			return nil, err
		}
	return results, nil
func applySearchHintsNoFilter(ctx context.Context, values []string, hints *SearchHints) ([]SearchResult, e
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// ApplySearchHints filters, sorts, and limits a slice of string values according to hints,
// returning scored SearchResult entries. A nil hints value is treated as the zero value.
// The input values slice is assumed to be ordered ascending by value; the function only
// performs extra work for orderings that differ from this.
//
// Allocation and ordering are tuned to the (Filter, OrderBy, Limit) combination:
//   - Filter == nil: at most Limit entries are copied; OrderByValueDesc walks the input

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T18:08:35.994Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795802915994",
    "title": "api: honor search cancellation and report timeouts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "prometheus-prometheus-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1f6cda261c1bdd6af2adb90641776fc3e54bf124be5bcb614bf3961aecff449e"
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
        "Harvested/verified timestamp recorded: 2026-11-27T18:08:35.994Z"
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
  "auth_token": "1c4011c132f86dc9f54c615c6c9b804637dad2db0b4613def7210a01110656a1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
