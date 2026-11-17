# Candidate Directive: [CD-0133] Cross-Platform Lexicographic Key Sequencing Invariant

<!-- PROVENANCE_START
{
  "source_repository": "agent-field-agentfield-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T06:20:45.459Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-agent-field-agentfield-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [agent-field-agentfield-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T06:20:45.459Z`  
> **Learning ID**: `LEARN-EVO-agent-field-agentfield-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When sequential or time-series events are indexed using string keys (such as BoltDB/bbolt, BadgerDB, or RocksDB key paths), integer identifiers MUST be formatted with zero-padding to their maximum width (e.g., `%020d`), or sort orders MUST be restored via explicit numerical parsing (`slices.SortStableFunc` with `strconv.ParseUint`) before serving. Key glob matching MUST use deterministic POSIX path rules (`path.Match`) rather than host-dependent filesystem rules (`filepath.Match`).

**WHY**:
Embedded KV engines order keys lexicographically: the string `"10"` sorts before `"2"`. If database cursors scan range segments relying on string sorting, consumers receive chronological events out of order, corrupting time-series stream reconstitutions. On Windows, `filepath.Match` interprets `\` as a directory separator, breaking glob patterns designed for cross-platform event keys.

**WHEN TO APPLY**:
Storage engines, cursor-based pagination, LSM-tree key designs, and pattern-matching routers handling structured event keys (e.g., `scope/scopeID/sequence`).

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package storage

import (
	"cmp"
	"path"
	"slices"
	"strconv"
)

// Ensure POSIX cross-platform semantics regardless of host OS
func MatchKeyPatterns(patterns []string, key string) bool {
	if len(patterns) == 0 {
		return true
	}
	for _, pattern := range patterns {
		// MUST use path.Match, NEVER filepath.Match
		if matched, err := path.Match(pattern, key); err == nil && matched {
			return true
		}
	}
	return false
}

func RestoreSequenceOrder(events []*MemoryChangeEvent) {
	// Re-establish numerical order against lexicographically scanned keys
	slices.SortStableFunc(events, func(a, b *MemoryChangeEvent) int {
		ai, _ := strconv.ParseUint(a.ID, 10, 64)
		bi, _ := strconv.ParseUint(b.ID, 10, 64)
		return cmp.Compare(ai, bi)
	})
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Host-dependent globbing and raw lexicographic return
import "path/filepath"

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:20:45.566Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794896445566",
    "title": "Cross-Platform Lexicographic Key Sequencing Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "agent-field-agentfield-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f5f73efadeab010017ddc855a0d06300a968995b029241387461f7e3de4bd204"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:20:45.566Z"
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
  "auth_token": "d32a345219529c720a538edf7958f11f4c71e705fa83265b399a7537bb4412a6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
