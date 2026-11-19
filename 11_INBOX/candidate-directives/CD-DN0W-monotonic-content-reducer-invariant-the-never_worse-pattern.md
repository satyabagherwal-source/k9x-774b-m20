# Candidate Directive: [CD-DN0W] Monotonic Content Reducer Invariant (The `never_worse` Pattern)

<!-- PROVENANCE_START
{
  "source_repository": "rtk-ai-rtk-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T20:34:29.344Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rtk-ai-rtk-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rtk-ai-rtk-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T20:34:29.344Z`  
> **Learning ID**: `LEARN-EVO-rtk-ai-rtk-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
Any optimizer, compressor, deduplicator, or token-reduction transform MUST guarantee that its output is strictly fewer tokens (or equal tokens with distinct mutated semantics) than its input. If the transformed representation equals the input OR expands token cost (due to inserted metadata, delimiters, or structural framing), the engine MUST reject the transformation and return the original raw input.

**WHY**:
Context processors frequently append elision indicators, line trackers, or structural envelopes (e.g., `[base64 data, 12 KB elided]`, `[50 lines elided]`). When applied to small payloads, degenerate string structures, or dense binary fragments, this metadata can cause the token count to exceed the original size. Without an explicit floor, iterative multi-pass pipelines trigger context bloating and prompt cache fragmentation.

**WHEN TO APPLY**:
Apply to all context-window compilers, prompt compression routines, serialization decoders, AST minifiers, and LLM tool output filters.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::panic::{catch_unwind, AssertUnwindSafe};

/// Estimates token consumption via an ecosystem-standard heuristic or fast BPE tokenizer.
pub fn estimate_tokens(text: &str) -> usize {
    // 1 token ~= 4 chars in average text, or invoke BPE estimator
    text.len().div_ceil(4)
}

/// Enforces the Monotonic Reducer invariant.
/// Rejects no-ops and any transformation that inflates token volume.
pub fn never_worse(input: &str, output: String) -> Option<String> {
    if output == input {
        return None;
    }
    if estimate_tokens(&output) > estimate_tokens(input) {
        return None;
    }
    Some(output)
}

/// Runs a sequence of transformation methods across a content block, 
/// containing panics at the boundary and rejecting toxic/expanding outputs.
pub fn run_guarded_pipeline<F>(input: &str, transform_chain: F) -> String 
where
    F: FnOnce(&str) -> String,
{
    let guarded_output = catch_unwind(AssertUnwindSafe(|| {
        transform_chain(input)
    })).ok();

    match guarded_output {
        Some(candidate) => never_worse(input, candidate).unwrap_or_else(|| input.to_string()),
        None => input.to_string(), // Method panicked: degrade gracefully to raw input
    }
}
```

**NEGATIVE CONSTRAINT**:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T20:34:29.452Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795120469452",
    "title": "Monotonic Content Reducer Invariant (The `never_worse` Pattern)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rtk-ai-rtk-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "540f74b325a59149576052417f7bc064a8d5a802ee56106b30df7bf79d2b7007"
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
        "Harvested/verified timestamp recorded: 2026-11-19T20:34:29.453Z"
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
  "auth_token": "4324986502821c1571755dc072ac060f8a3e6c81c545e94f646e1cedf1633df8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
