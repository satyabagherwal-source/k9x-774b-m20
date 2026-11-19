# Candidate Directive: [CD-89J8] Multi-Turn Reasoning Tag Stripping In Model Conversations

<!-- PROVENANCE_START
{
  "source_repository": "mintplex-labs-anything-llm-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T09:18:27.774Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-mintplex-labs-anything-llm-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mintplex-labs-anything-llm-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T09:18:27.774Z`  
> **Learning ID**: `LEARN-EVO-mintplex-labs-anything-llm-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Before submitting chat history arrays to local or open-source reasoning models (e.g., DeepSeek-R1, Gemma-4, Qwen-2.5-Coder via Ollama/vLLM), the ingestion layer MUST sanitize all previous assistant responses by stripping inline internal reasoning blocks (`<think>[\s\S]*?(?:<\/think>|$)`). Unterminated or stream-truncated `<think>` blocks MUST be cleanly sliced to the end of the content string.

**WHY**:
Modern chain-of-thought models rely on prompt formats where thought tokens indicate internal cognitive scratchpads. When previous turns replay raw `<think>` content inside the `assistant` conversation turn, models with proprietary reasoning templates mimic the replayed textual tokens rather than invoking their true native thinking mode. This leads to models hallucinating answers *inside* simulated think tags, emitting malformed agent outputs, bypassing tool-calling loops, and exhausting model output token context limits.

**WHEN TO APPLY**:
All chat completions, tool execution loops, and autonomous agent history builders interfacing with reasoning-capable models (DeepSeek R1, Gemma, QwQ, etc.) where reasoning content is captured during streaming.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// server/utils/AiProviders/sanitizer.js

/**
 * Sanitizes chat history prior to LLM submission.
 * Removes replayed <think> tokens, handling multiline and unterminated tags.
 *
 * @param {Array<{role: string, content: any}>} messages
 * @returns {Array<{role: string, content: any}>}
 */
function stripHistoryReasoning(messages = []) {
  if (!Array.isArray(messages)) return [];

  return messages.map((message) => {
    // Invariant: Only sanitize assistant text messages
    if (!message || message.role !== "assistant" || typeof message.content !== "string") {
      return message;
    }

    // RegEx Invariant: Matches opening <think>, all characters non-greedily,
    // and terminates at EITHER explicit </think> OR end of input ($) for incomplete streams.
    const cleanContent = message.content
      .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "")
      .trim();

    return {
      ...message,
      content: cleanContent,
    };
  });
}
```

**NEGATIVE CONSTRAINT**:
```javascript
// CRITICAL FAILURE: Passing raw history back to LLM context
function constructPrompt({ chatHistory, userPrompt }) {
  return [
    { role: "system", content: "You are a helpful assistant." },

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T09:18:27.907Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795079907907",
    "title": "Multi-Turn Reasoning Tag Stripping In Model Conversations",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mintplex-labs-anything-llm-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "52037716cf88bb2e412bef7c810922799bb44aec0871ce19af4e9057c5d6400f"
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
        "Harvested/verified timestamp recorded: 2026-11-19T09:18:27.908Z"
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
  "auth_token": "c9143af95d446ad540557b315a1c2d1523be7e1c00cc0fb2921dfc4b7540fdbc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
