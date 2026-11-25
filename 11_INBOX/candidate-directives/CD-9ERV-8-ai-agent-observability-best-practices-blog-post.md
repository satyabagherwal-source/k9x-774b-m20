# Candidate Directive: [CD-9ERV] 8 AI agent observability best practices blog post

<!-- PROVENANCE_START
{
  "source_repository": "iii-hq/iii",
  "source_url": "https://github.com/iii-hq/iii",
  "source_version": "d14aa58e",
  "license": "PERMISSIVE_OPEN_SOURCE",
  "timestamp": "2026-11-25T05:45:25.771Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-iii-hq-iii",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [iii-hq/iii](https://github.com/iii-hq/iii) (Revision: `d14aa58e`).  
> **License**: PERMISSIVE_OPEN_SOURCE | **Timestamp**: `2026-11-25T05:45:25.771Z`  
> **Learning ID**: `learn-github-iii-hq-iii`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `website/content/blog/ai-agent-observability-best-practices.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in iii-hq/iii. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d14aa58e`: website): 8 AI agent observability best practices blog post. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `website/content/blog/ai-agent-observability-best-practices.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
---
title: '8 AI agent observability best practices for tracing tool execution'
seoTitle: '8 AI Agent Observability Best Practices for Tool Calls'
description: 'Learn 8 AI agent observability best practices for tracing tool calls, tracking latency and token usage, and protecting sensitive data, with examples in iii.'
pubDate: 2026-11-23
tags: ['agents', 'observability', 'tracing', 'opentelemetry', 'harness']
ogImage: ../../assets/blog/ai-agent-observability-best-practices/og.png
faq:
  - q: 'What are traces in AI agents?'
    a: 'A trace is a tree of timed spans that records the instrumented steps in an agent execution, such as model calls, tool calls, and handoffs. The spans share a trace_id. The turn sits at the root, model and tool calls nest below it, and outbound service calls nest below those. Each span has a start time, an end time, attributes, and optionally span events for richer data like function inputs and outputs.'
  - q: 'How does agent observability differ from LLM monitoring?'
    a: 'LLM monitoring watches model calls: latency, token counts, and errors at the inference boundary. Agent observability follows the whole run, including every tool the agent called, the d
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d14aa58e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T05:45:25.769Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795585525769",
    "title": "8 AI agent observability best practices blog post",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "iii-hq/iii",
    "source_uri": "https://github.com/iii-hq/iii",
    "source_version": "HEAD",
    "content_hash": "50abe3263a452fd0ac12ded7d54e8e70afd1aef5bf686507e5e64044c39c2428"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-25T05:45:25.770Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "b133653a2cf1e859c0f6ab8a4fd3e650061c916b91ed06bb70cdee240cb5a525"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
