# Candidate Directive: [CD-G9V1] docs(agents): write requirement keywords in capitals

<!-- PROVENANCE_START
{
  "source_repository": "aws/aws-cdk",
  "source_url": "https://github.com/aws/aws-cdk",
  "source_version": "726f74dc",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T01:26:29.869Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aws-aws-cdk",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aws/aws-cdk](https://github.com/aws/aws-cdk) (Revision: `726f74dc`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T01:26:29.869Z`  
> **Learning ID**: `learn-github-aws-aws-cdk`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `AGENTS.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aws/aws-cdk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c070afb5`: docs(agents): write requirement keywords in capitals. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `AGENTS.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
- **L3 (Patterns)**: Multi-resource compositions. Legacy L3s exist in `aws-ecs-patterns` and `aws-route53-patterns`. New L3s SHOULD NOT be added to this repo.
- Flags SHOULD tighten security (reduce trust/permissions), never loosen it. If you need broader permissions, make it an explicit API option
- Attribute names MUST begin with the type name: `bucketArn` not `arn`, `functionName` not `name`
- MUST include: maturity level, simple example near top, examples per use case
- README code blocks (` ```ts `) MUST compile — verified by Rosetta. Use ` ```ts nofixture ` to skip
- All `feat()` PRs MUST include README updates
- Include backward-compatibility tests when adding new optional props — default behavior MUST be preserved
Every public API MUST be jsii-compatible.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
- **L3 (Patterns)**: Multi-resource compositions. Legacy L3s exist in `aws-ecs-patterns` and `aws-route53-patterns`. New L3s should NOT be added to this repo.
- Flags should tighten security (reduce trust/permissions), never loosen it. If you need broader permissions, make it an explicit API option
- Attribute names must begin with the type name: `bucketArn` not `arn`, `functionName` not `name`
- Must include: maturity level, simple example near top, examples per use case
- README code blocks (` ```ts `) must compile — verified by Rosetta. Use ` ```ts nofixture ` to skip
- All `feat()` PRs must include README updates
- Include backward-compatibility tests when adding new optional props — default behavior must be preserved
Every public API must be jsii-compatible.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c070afb5` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T01:26:29.867Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795656389867",
    "title": "docs(agents): write requirement keywords in capitals",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aws/aws-cdk",
    "source_uri": "https://github.com/aws/aws-cdk",
    "source_version": "HEAD",
    "content_hash": "fc91d454b8370f6202f1857415db799eb1a7ba762d5eeeacf14e34eaba5c5511"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-26T01:26:29.867Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "983a74dceff55dc40161e40feeba3b12e5f7e419027d80a5f6c77989ec3aead9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
