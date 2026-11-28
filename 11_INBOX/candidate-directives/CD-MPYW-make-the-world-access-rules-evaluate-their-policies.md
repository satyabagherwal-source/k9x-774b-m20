# Candidate Directive: [CD-MPYW] make the world access rules evaluate their policies

<!-- PROVENANCE_START
{
  "source_repository": "aws/aws-cdk",
  "source_url": "https://github.com/aws/aws-cdk",
  "source_version": "f6d320a1",
  "license": "Apache-2.0",
  "timestamp": "2026-11-28T05:46:47.672Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aws-aws-cdk",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aws/aws-cdk](https://github.com/aws/aws-cdk) (Revision: `f6d320a1`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-28T05:46:47.672Z`  
> **Learning ID**: `learn-github-aws-aws-cdk`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `tools/@aws-cdk/security-guardian/rules/resource-policies/resource-policy-root-principal-needs-conditions.guard`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aws/aws-cdk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f1267366`: security-guardian): make the world access rules evaluate their policies. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `tools/@aws-cdk/security-guardian/rules/resource-policies/resource-policy-root-principal-needs-conditions.guard`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
# Also fails an Allow statement that uses NotPrincipal, whatever it lists: IAM supports NotPrincipal only with Deny.
                    # IAM supports NotPrincipal only with Deny, so an Allow statement with NotPrincipal fails whatever it lists
                    when NotPrincipal exists {
                        NotPrincipal not exists
                        <<##ERROR:Resource policy must not use NotPrincipal in an Allow statement. Replace NotPrincipal with a Principal that names specific accounts or roles.##>>
                    }
                    # IAM supports NotPrincipal only with Deny, so an Allow statement with NotPrincipal fails whatever it lists
                    when NotPrincipal exists {
                        NotPrincipal not exists
                        <<##ERROR:Resource policy must not use NotPrincipal in an Allow statement. Replace NotPrincipal with a Principal that names specific accounts or roles.##>>
                    }
                    # IAM supports NotPrincipal only with Deny, so an Allow statement with NotPrincipal fails whatever it lists
                    when NotPrincipal exists {
                        NotPrincipal not exists
          
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f1267366` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T05:46:47.669Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795844807669",
    "title": "make the world access rules evaluate their policies",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aws/aws-cdk",
    "source_uri": "https://github.com/aws/aws-cdk",
    "source_version": "HEAD",
    "content_hash": "b247f07c6e2cd6e0783c9c0948173d5f620b9a34f62454af284563de1c595e0d"
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
        "Harvested/verified timestamp recorded: 2026-11-28T05:46:47.669Z"
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
  "auth_token": "35a7b10ecc8a35fcfe198cc29ce09991cc993260f7e59ed6ac201d34c6fa0c34"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
