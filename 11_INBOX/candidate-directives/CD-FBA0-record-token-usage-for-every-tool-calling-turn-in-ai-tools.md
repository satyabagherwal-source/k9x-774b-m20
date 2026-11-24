# Candidate Directive: [CD-FBA0] record token usage for every tool-calling turn in ai(tools=...)

<!-- PROVENANCE_START
{
  "source_repository": "Agent-Field/agentfield",
  "source_url": "https://github.com/Agent-Field/agentfield",
  "source_version": "1b3c68a3",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T03:14:23.064Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-agent-field-agentfield",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Agent-Field/agentfield](https://github.com/Agent-Field/agentfield) (Revision: `1b3c68a3`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T03:14:23.064Z`  
> **Learning ID**: `learn-github-agent-field-agentfield`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence (UNSUPPORTED_ASSUMPTIONS: Absolute infallibility claim lacks failure boundary)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `sdk/python/agentfield/agent_ai.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Agent-Field/agentfield. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dc802dcb`: sdk-python): record token usage for every tool-calling turn in ai(tools=...). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `sdk/python/agentfield/agent_ai.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
                    turn_resp = await rate_limiter.execute_with_retry(
                        _call_with_fallbacks
                    )
                else:
                    turn_resp = await _call_with_fallbacks()
                try:
                    _record_tool_turn_usage(turn_resp, params)
                except Exception as e:
                    # Usage accounting is an observation side effect: it must
                    # never fail a completion that already succeeded.
                    log_debug(f"Tool loop: usage recording failed: {e}")
                return turn_resp

            def _record_tool_turn_usage(turn_resp, params):
                """Record token usage for one LLM turn of the tool loop."""
                from agentfield.cost_tracker import (
                    derive_provider,
                    get_current_cost_tracker,
                )
                from .multimodal_response import detect_multimodal_response
                from .usage_routing import routing_provider

                tracker = get_current_cost_tracker() or getattr(
                    self.agent, "cost_tracker", None
                )
                if tracker is None:
 
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
                    return await rate_limiter.execute_with_retry(_call_with_fallbacks)
                return await _call_with_fallbacks()
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dc802dcb` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T03:14:23.062Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence (UNSUPPORTED_ASSUMPTIONS: Absolute infallibility claim lacks failure boundary)",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.65,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 65%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=WARN, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795490063062",
    "title": "record token usage for every tool-calling turn in ai(tools=...)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Agent-Field/agentfield",
    "source_uri": "https://github.com/Agent-Field/agentfield",
    "source_version": "HEAD",
    "content_hash": "972fc50d745c40d1976b06f5b39c8cd751d75f9ef25fc5ea529b302108aa40a9"
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
      "status": "WARN",
      "score": 0.85,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": false,
      "opposing_rule": null,
      "unsupported_assumptions": [
        "Absolute infallibility claim lacks failure boundary"
      ],
      "findings": [
        "UNSUPPORTED_ASSUMPTIONS: Absolute infallibility claim lacks failure boundary"
      ],
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
        "Harvested/verified timestamp recorded: 2026-11-24T03:14:23.062Z"
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
  "auth_token": "8c297860d07201d65841784dad7056af9d48b762ae4a6763ae8307c8865ba59c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
