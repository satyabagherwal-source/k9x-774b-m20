# Candidate Directive: [CD-VYTP] Multi-Turn Reasoning Tag Stripping In Model Conversations

<!-- PROVENANCE_START
{
  "source_repository": "Mintplex-Labs/anything-llm",
  "source_url": "https://github.com/Mintplex-Labs/anything-llm",
  "source_version": "2f6a451f",
  "license": "MIT",
  "timestamp": "2026-11-19T09:08:54.157Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mintplex-labs-anything-llm",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Mintplex-Labs/anything-llm](https://github.com/Mintplex-Labs/anything-llm) (Revision: `2f6a451f`).  
> **License**: MIT | **Timestamp**: `2026-11-19T09:08:54.157Z`  
> **Learning ID**: `learn-github-mintplex-labs-anything-llm`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    // DANGER: chatHistory contains "<think>I need to search db...</think> Here is the answer."
    // Model confuses previous thought tags with current turn scratchpad!
    ...chatHistory,
    { role: "user", content: userPrompt }
  ];
}
```

**VERIFICATION METHOD**:
Jest unit test evaluating both balanced and unclosed reasoning blocks:
```javascript
test("stripHistoryReasoning handles closed and unclosed tags", () => {
  const input = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "<think>Hidden steps</think>Real Answer" },
    { role: "assistant", content: "<think>Unterminated step that crashed" }
  ];
  const output = stripHistoryReasoning(input);
  expect(output[1].content).toBe("Real Answer");
  expect(output[2].content).toBe("");
});
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T09:08:54.156Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795079334156",
    "title": "Multi-Turn Reasoning Tag Stripping In Model Conversations",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Mintplex-Labs/anything-llm",
    "source_uri": "https://github.com/Mintplex-Labs/anything-llm",
    "source_version": "HEAD",
    "content_hash": "aced701ee240fe1f70cb04e89355ad35cb80b20174685bb445ea16d8630692f8"
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
        "Harvested/verified timestamp recorded: 2026-11-19T09:08:54.156Z"
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
  "auth_token": "3d499ed82b6abfa506bc57e0a5321aaacc21c31310dddb659b8fab02bf958552"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
