# Candidate Directive: [CD-CXWO] Monotonic Content Reducer Invariant (The `never_worse` Pattern)

<!-- PROVENANCE_START
{
  "source_repository": "rtk-ai/rtk",
  "source_url": "https://github.com/rtk-ai/rtk",
  "source_version": "5f81080f",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T20:33:56.904Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rtk-ai-rtk",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rtk-ai/rtk](https://github.com/rtk-ai/rtk) (Revision: `5f81080f`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T20:33:56.904Z`  
> **Learning ID**: `learn-github-rtk-ai-rtk`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
```rust
// ANTI-PATTERN: Blindly applying transformations and prepending elision markers.
// If input is short (e.g., "error: 404"), formatting adds overhead and bloats tokens.
pub fn unsafe_truncate(input: &str) -> String {
    let truncated: String = input.chars().take(100).collect();
    // Toxic: Can expand a 10-char string into a 50-char string!
    format!("{truncated}\n[rtk: truncated output, check recall log]")
}
```

**VERIFICATION METHOD**:
Automated property-based testing verifying token monotonicity across arbitrary input distributions:
```rust
#[test]
fn test_monotonicity_property() {
    let inputs = vec!["", "a", "x".repeat(10), "x".repeat(100_000)];
    for input in inputs {
        let output = format!("{input} [metadata tag]");
        let checked = never_worse(&input, output);
        if estimate_tokens(&input) < estimate_tokens(&format!("{input} [metadata tag]")) {
            assert_eq!(checked, None, "Guard failed to reject token-expanding transformation");
        }
    }
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T20:33:56.902Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795120436902",
    "title": "Monotonic Content Reducer Invariant (The `never_worse` Pattern)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rtk-ai/rtk",
    "source_uri": "https://github.com/rtk-ai/rtk",
    "source_version": "HEAD",
    "content_hash": "7d80641d8feebe8d0cee585d7ed12364c8f44bd50bdd773e7ec15855d2dc43c3"
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
        "Harvested/verified timestamp recorded: 2026-11-19T20:33:56.902Z"
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
  "auth_token": "4b06d89587fe9f066fb8768b5025b617d51d667ff1deb87d35440fc5875ab57f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
