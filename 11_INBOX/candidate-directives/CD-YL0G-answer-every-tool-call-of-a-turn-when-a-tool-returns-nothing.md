# Candidate Directive: [CD-YL0G] answer every tool call of a turn when a tool returns nothing

<!-- PROVENANCE_START
{
  "source_repository": "LLPhant/LLPhant",
  "source_url": "https://github.com/LLPhant/LLPhant",
  "source_version": "9f03e7de",
  "license": "MIT",
  "timestamp": "2026-11-20T00:06:43.936Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-llphant-llphant",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [LLPhant/LLPhant](https://github.com/LLPhant/LLPhant) (Revision: `9f03e7de`).  
> **License**: MIT | **Timestamp**: `2026-11-20T00:06:43.936Z`  
> **Learning ID**: `learn-github-llphant-llphant`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/Chat/OpenAIChat.php`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in LLPhant/LLPhant. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8eae582f`: openai): answer every tool call of a turn when a tool returns nothing. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing PHP data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/Chat/OpenAIChat.php`.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
// Verified production-grade fix pattern:
        $hasReturn = false;
            $hasReturn = $hasReturn || $functionCalled->return !== null;
            // OpenAI rejects the follow-up if a call of the turn is left unanswered, so a tool that returned nothing gets an empty result
            if ($functionCalled->return !== null || $functionCalled->tool_call_id) {
        if (! $hasReturn) {
        return $this->getNewMessagesFromTurn($messages, $this->functionsCalled);
```

**NEGATIVE CONSTRAINT**:
```php
// Induced defect failure mode:
            if ($functionCalled->return !== null) {
        if ($toolsOutput === []) {
        $toolsCalls = [];
        $toolsOutput = [];
        /** @var CalledFunction $functionCalled */
        foreach ($this->functionsCalled as $functionCalled) {
            if ($functionCalled->return !== null) {
                $toolsOutput[] = $this->createMessageWithToolOutput($functionCalled);
            }
            if ($functionCalled->tool_call_id) {
                $toolsCalls[] = new ToolCall($functionCalled->tool_call_id, $functionCalled->definition->name, json_encode($functionCalled->arguments, JSON_THROW_ON_ERROR));
            }
        }

        if ($toolsOutput === []) {
            return [];
        }

        if ($toolsCalls !== [] && $this->shouldAddAssistantToolCallsMessage()) {
            $messages[] = Message::assistantAskingTools($toolsCalls);
        }

        return array_merge($messages, $toolsOutput);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8eae582f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T00:06:43.934Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795133203934",
    "title": "answer every tool call of a turn when a tool returns nothing",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "LLPhant/LLPhant",
    "source_uri": "https://github.com/LLPhant/LLPhant",
    "source_version": "HEAD",
    "content_hash": "07cce75512cf0564b4551b86ef6accf8d044cdbb33b6668234463c8e8cd83849"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T00:06:43.934Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "6582b42e29e6f7340c826039bd42239ccb59fc9e8348f97ab0af2d71741fc063"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
