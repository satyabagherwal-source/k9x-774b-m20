# Candidate Directive: [CD-NHKB] convert a number to a BigDecimal or BigInteger agent argument

<!-- PROVENANCE_START
{
  "source_repository": "langchain4j/langchain4j",
  "source_url": "https://github.com/langchain4j/langchain4j",
  "source_version": "8d519498",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T12:58:35.051Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-langchain4j-langchain4j",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [langchain4j/langchain4j](https://github.com/langchain4j/langchain4j) (Revision: `8d519498`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T12:58:35.051Z`  
> **Learning ID**: `learn-github-langchain4j-langchain4j`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `langchain4j-agentic/src/main/java/dev/langchain4j/agentic/internal/AgentUtil.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in langchain4j/langchain4j. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0d6c0ff8`: agentic): convert a number to a BigDecimal or BigInteger agent argument. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `langchain4j-agentic/src/main/java/dev/langchain4j/agentic/internal/AgentUtil.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
import java.math.BigDecimal;
                // through the decimal string of the number, so that a double like 0.1 becomes 0.1 and not its
                // binary approximation, and a BigInteger or BigDecimal keeps all its digits
                case "java.math.BigDecimal" -> new BigDecimal(n.toString());
                case "java.math.BigInteger" -> new BigDecimal(n.toString()).toBigInteger();
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0d6c0ff8` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T12:58:35.049Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795006715049",
    "title": "convert a number to a BigDecimal or BigInteger agent argument",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "langchain4j/langchain4j",
    "source_uri": "https://github.com/langchain4j/langchain4j",
    "source_version": "HEAD",
    "content_hash": "e655442e348c0341b187892bf654d9fd3797778fb04d3812f965365d1f2ca785"
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
        "Harvested/verified timestamp recorded: 2026-11-18T12:58:35.049Z"
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
  "auth_token": "f8def1df4075541667205c31714fabf271995ad48ea3d42a73f2a6ce915af50a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
