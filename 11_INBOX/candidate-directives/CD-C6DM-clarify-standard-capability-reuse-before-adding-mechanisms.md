# Candidate Directive: [CD-C6DM] Clarify standard capability reuse before adding mechanisms

<!-- PROVENANCE_START
{
  "source_repository": "apache/shardingsphere",
  "source_url": "https://github.com/apache/shardingsphere",
  "source_version": "03aa12d5",
  "license": "Apache-2.0",
  "timestamp": "2026-11-25T07:39:33.322Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-apache-shardingsphere",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache/shardingsphere](https://github.com/apache/shardingsphere) (Revision: `03aa12d5`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-25T07:39:33.322Z`  
> **Learning ID**: `learn-github-apache-shardingsphere`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.codex/harness/agents/cases.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/shardingsphere. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `03aa12d5`: Clarify standard capability reuse before adding mechanisms. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `.codex/harness/agents/cases.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
policy_assertions = [{source = "implementation-rules", statements = ["Before choosing an implementation, inspect applicable standard language and platform capabilities as well as the current behavior owner, relevant architecture and sibling modules for existing capabilities and patterns that fit the required responsibilities, contracts and dependency boundaries.", "Among designs that satisfy these prerequisites, first preserve the maintained architecture already present in the repository, including its behavior owners, module boundaries, and design patterns, unless the user explicitly requires an authorized architecture change.", "Prefer direct reuse, then composition or delegation, then an existing extension point."]}]
policy_assertions = [{source = "review-pr", statements = ["`Full path`: trace the relevant production or test entry path end to end; inspect setup, wrappers, earlier calls, generators, and consuming runtime.", "`Counter-evidence`: check the strongest evidence that could disprove the finding, especially author or maintainer replies and version-specific facts.", "`Necessity`: the requested change is required for safety, correctness, or an applicable repository design 
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
policy_assertions = [{source = "implementation-rules", statements = ["Before choosing an implementation, inspect the current behavior owner, relevant architecture and sibling modules for existing capabilities and patterns that fit the required responsibilities, contracts and dependency boundaries.", "Among designs that satisfy these prerequisites, first preserve the maintained architecture already present in the repository, including its behavior owners, module boundaries, and design patterns, unless the user explicitly requires an authorized architecture change.", "Prefer direct reuse, then composition or delegation, then an existing extension point."]}]
policy_assertions = [{source = "review-pr", statements = ["`Full path`: trace the relevant production or test entry path end to end; inspect setup, wrappers, earlier calls, generators, and consuming runtime.", "`Counter-evidence`: check the strongest evidence that could disprove the finding, especially author or maintainer replies and version-specific facts.", "`Necessity`: the requested change is required for safety, correctness, or an applicable repository design or contract rule in the selected focus, not merely cleaner or pref
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `03aa12d5` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T07:39:33.320Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.71,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 71%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795592373320",
    "title": "Clarify standard capability reuse before adding mechanisms",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apache/shardingsphere",
    "source_uri": "https://github.com/apache/shardingsphere",
    "source_version": "HEAD",
    "content_hash": "5b8fbb2aa43838b50c35d92014ad78659fe1a439e064169216e8e76b796a143e"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.75,
      "tier": "TIER_2_OFFICIAL_ECOSYSTEM",
      "findings": [],
      "details": [
        "Source belongs to recognized official ecosystem (TIER_2_OFFICIAL_ECOSYSTEM)",
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
        "Harvested/verified timestamp recorded: 2026-11-25T07:39:33.320Z"
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
  "auth_token": "55276c06b36347b9492d24b61650f53d8c79d8ff2a15006b316995e669c7e0cc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
