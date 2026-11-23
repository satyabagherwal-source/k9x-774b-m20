# Candidate Directive: [CD-ZWIK] docs(skills): add agentfield-sdk, a reference skill for coding agents

<!-- PROVENANCE_START
{
  "source_repository": "Agent-Field/agentfield",
  "source_url": "https://github.com/Agent-Field/agentfield",
  "source_version": "198e6e89",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T05:06:42.140Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-agent-field-agentfield",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Agent-Field/agentfield](https://github.com/Agent-Field/agentfield) (Revision: `198e6e89`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T05:06:42.140Z`  
> **Learning ID**: `learn-github-agent-field-agentfield`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `skills/agentfield-sdk/SKILL.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Agent-Field/agentfield. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `198e6e89`: docs(skills): add agentfield-sdk, a reference skill for coding agents. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `skills/agentfield-sdk/SKILL.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
---
name: agentfield-sdk
description: "Reference for writing, running and deploying agents with the AgentField Python and TypeScript SDKs: install, a minimal agent in each language, calling it over REST (sync, async, polling, webhooks), cross-agent calls, human approval, and where identity, policy and audit live. Use when the user asks to build with AgentField, or the project already depends on `agentfield` (PyPI) or `@agentfield/sdk` (npm). If the user asked for a different framework, use that one; this skill only explains how AgentField works."
---

# Building agents with AgentField

AgentField is an open-source (Apache-2.0) framework for running AI agents as
backend services. You write agents as ordinary Python, TypeScript or Go
functions; a Go **control plane** routes every call between them, records each
run, and exposes each agent function as a REST endpoint. Durable async
execution, retries, human approval, shared memory, per-agent cryptographic
identity (W3C DIDs), tag-based access policies and verifiable-credential audit
trails are part of the framework, not add-ons.

Vocabulary used everywhere in the SDKs, CLI and API:

| Term | Meaning |
|---|---|
| control plane | The `
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `198e6e89` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T05:06:42.138Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795410402138",
    "title": "docs(skills): add agentfield-sdk, a reference skill for coding agents",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Agent-Field/agentfield",
    "source_uri": "https://github.com/Agent-Field/agentfield",
    "source_version": "HEAD",
    "content_hash": "c9d1d07e203907755f0c352514e118ab70033194cc500f8e2aab2db154d2effe"
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
        "Harvested/verified timestamp recorded: 2026-11-23T05:06:42.138Z"
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
  "auth_token": "7ceb30d381546c5fc3e852bcced73c0e6f28483410e224bc9e82cc68a458623b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
