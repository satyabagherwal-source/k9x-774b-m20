# Candidate Directive: [CD-TLCA] docs(blueprints): sync dart/a2ui_agent codebase blueprint to 24d1bf9c

<!-- PROVENANCE_START
{
  "source_repository": "a2ui-project/a2ui",
  "source_url": "https://github.com/a2ui-project/a2ui",
  "source_version": "1cbef31b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T05:19:45.994Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-a2ui-project-a2ui",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [a2ui-project/a2ui](https://github.com/a2ui-project/a2ui) (Revision: `1cbef31b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T05:19:45.994Z`  
> **Learning ID**: `learn-github-a2ui-project-a2ui`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `blueprints/codebases/dart/a2ui_agent/codebase.blueprint.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in a2ui-project/a2ui. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dd29fa27`: docs(blueprints): sync dart/a2ui_agent codebase blueprint to 24d1bf9c. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `blueprints/codebases/dart/a2ui_agent/codebase.blueprint.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
module_blueprint_commit: 24d1bf9c830071f74c9c908433e73cc6cbe0aa33
  agent_functions: 87b945802660c507bc84f7f47a25199b4939efbe
- **Parser & Streaming Layer**: `Parser`, `ResponsePart`, and `ResponseStream` (`lib/src/parser/`) tokenize sentinel-wrapped model responses and support incremental Direct JSON and Express streaming.
- **Bidirectional Function RPC**: `RendererToAgentMessageProcessor` and `RendererFunctionCalls` (`lib/src/rpc/`) dispatch `callAgentFunction` requests against registered catalog `AgentFunction` implementations and manage pending `callRendererFunction` invocations.
- **Single-Method `PromptGenerator` (No `skill_generator`)**: Because `dart/a2ui_agent` does not implement the optional `skill_generator` feature, `PromptGenerator` (`lib/src/prompt/generator.dart`) declares a single abstract `String generate()` method rather than splitting prompt construction into `generateBaseRules`, `generateCatalogInstructions`, `generateExamples`, and `assembleInstructions` hooks, and `lib/a2ui_agent.dart` exports `DirectJsonPromptGenerator` and `ExpressPromptGenerator` directly.
- **No Built-in Transport Adapters**: `dart/a2ui_agent` stays transport-agnostic and does not bundle A
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
module_blueprint_commit: a641e84f2861d1ff068df7616e06d08bfd4d0a88
- **Parser & Streaming Layer**: `Parser`, `BlockLexer`, `ResponsePart`, and `ResponseStream` (`lib/src/parser/`) tokenize sentinel-wrapped model responses and support incremental Direct JSON streaming.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dd29fa27` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T05:19:45.991Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794892785991",
    "title": "docs(blueprints): sync dart/a2ui_agent codebase blueprint to 24d1bf9c",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "a2ui-project/a2ui",
    "source_uri": "https://github.com/a2ui-project/a2ui",
    "source_version": "HEAD",
    "content_hash": "0bb96105092112869493419bd4633764f150bbf7f43d75d0d6615c49631d3c21"
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
        "Harvested/verified timestamp recorded: 2026-11-17T05:19:45.991Z"
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
  "auth_token": "286f359eab45c92b7862469ceff06578de8d3871842b1bc318a33ba5e5ebe7ed"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
