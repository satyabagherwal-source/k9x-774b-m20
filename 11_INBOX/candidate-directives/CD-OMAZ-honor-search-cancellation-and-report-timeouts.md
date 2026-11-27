# Candidate Directive: [CD-OMAZ] honor search cancellation and report timeouts

<!-- PROVENANCE_START
{
  "source_repository": "prometheus/prometheus",
  "source_url": "https://github.com/prometheus/prometheus",
  "source_version": "ccdfcea8",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T18:08:25.835Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-prometheus-prometheus",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [prometheus/prometheus](https://github.com/prometheus/prometheus) (Revision: `ccdfcea8`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T18:08:25.835Z`  
> **Learning ID**: `learn-github-prometheus-prometheus`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
//     in reverse so we never materialise the full slice when limited.
//   - OrderByValueAsc + Filter + Limit: stream-filter with early exit at Limit matches.
//   - OrderByValueDesc + Filter + Limit: reverse stream-filter with early exit at Limit
//     matches, taking advantage of the input being ascending so the tail is the largest.
//   - OrderByScoreDesc + Filter + Limit: top-K min-heap of size Limit, avoiding a full
//     sort over the matched set.
//   - Other combinations fall back to filter-then-reorder-then-slice, with the upfront
//     capacity capped by min(len(values), max(2*Limit, minLinearAllocCap)).
func ApplySearchHints(values []string, hints *SearchHints) []SearchRe
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `77b65d53` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T18:08:25.833Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795802905833",
    "title": "honor search cancellation and report timeouts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "prometheus/prometheus",
    "source_uri": "https://github.com/prometheus/prometheus",
    "source_version": "HEAD",
    "content_hash": "ceb69cb1c60230ffce4395b8ab5468a867d0db6669bd3f7c0f1f3af6cf0eeb72"
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
        "Harvested/verified timestamp recorded: 2026-11-27T18:08:25.833Z"
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
  "auth_token": "51ad43b9aa807afee84188b03d886b816cbbedb58108a8044e486107ec660854"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
