# Candidate Directive: [CD-7X70] Bidirectional Middle-Out Context Budget Truncation Invariant

<!-- PROVENANCE_START
{
  "source_repository": "pulumi-pulumi-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:46:51.698Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pulumi-pulumi-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pulumi-pulumi-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:46:51.698Z`  
> **Learning ID**: `LEARN-EVO-pulumi-pulumi-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When packaging large CLI event streams, error logs, or command diffs for consumption by an LLM or remote analytics service, the client **MUST** apply bidirectional "middle-out" truncation rather than head or tail truncation. The system **MUST** preserve both the beginning (initial execution commands, configuration, initialization events) and the end (panics, terminal stack traces, final summary counters) while excising content strictly from the center.

**WHY**:
LLMs diagnosing failed infrastructure deployments fail when head-truncated (losing the command invoked and input parameters) or tail-truncated (losing the actual fatal error, panic trace, or exit code). Middle execution logs predominantly consist of repetitive progress events, making them the optimal point for truncation.

**WHEN TO APPLY**:
AI agent tooling, copilot prompt payload synthesizers, log ingestion pipelines, and crash reporting layers with strict token/character quotas.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Extracted from pkg/backend/httpstate/client/ai.go
const truncationNotice = "... (truncated) ..."

func TruncateWithMiddleOut(content string, maxChars int) string {
    // If content fits within quota, return unmodified
    if len(content) <= maxChars {
        return content
    }

    // Boundary condition: Quota smaller than or equal to notice text
    if maxChars <= len(truncationNotice) {
        if maxChars <= 0 {
            return ""
        }
        return content[:maxChars]
    }

    // Allocate remaining character budget evenly between head and tail
    remaining := maxChars - len(truncationNotice)
    startLen := (remaining + 1) / 2
    endLen := remaining / 2

    // Retain head context and tail diagnostics, discarding intermediate spam
    return content[:startLen] + truncationNotice + content[len(content)-endLen:]
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Naive head or tail log slicing
func TruncateLogTail(content string, maxChars int) string {
    // VIOLATION: Throws away root command, flags, and early initialization failures
    if len(content) > maxChars {
        return content[len(content)-maxChars:]
    }
    return content
}

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:46:51.851Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794905211851",
    "title": "Bidirectional Middle-Out Context Budget Truncation Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pulumi-pulumi-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "319c5ccc8d721972a9ebc8ab9b9e456cbd4e76644a7fbe1c5b4f8a31c4bd9879"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:46:51.851Z"
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
  "auth_token": "dfd576cecb0ec08e93176f3a8f9b4525cf8da1125cad9b168652e9f19fbefc5a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
