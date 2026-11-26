# Candidate Directive: [CD-1QO5] align compatibility rules with their guides and prune the review skills

<!-- PROVENANCE_START
{
  "source_repository": "aws/aws-cdk",
  "source_url": "https://github.com/aws/aws-cdk",
  "source_version": "ff323598",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T18:58:57.221Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aws-aws-cdk",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aws/aws-cdk](https://github.com/aws/aws-cdk) (Revision: `ff323598`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T18:58:57.221Z`  
> **Learning ID**: `learn-github-aws-aws-cdk`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `skills/cdk-review/cdk-construct-design-review/SKILL.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aws/aws-cdk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6efedd4d`: skills): align compatibility rules with their guides and prune the review skills. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `skills/cdk-review/cdk-construct-design-review/SKILL.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
2. **Check the diff against the rules,** judging the shape the changed surface produces. For each rule
   check both directions: what is present and violating, and what the kind owes but the diff omits.
   Before flagging an absence, confirm the service supports the affordance in the authoritative AWS
   takes one value. Stop once you can name the defect and cite its rule — file + section.
`message` as the complete posted comment (observation, impact, a fix once you have checked one, and the
guideline cited inline by file + section). This dimension's `category` is one of: Feature placement &
abstraction, Design Guidelines conformance, Clarity/simplicity/consistency, Footgun-free & ages-well
interface quality.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
2. **Check the diff against the rules.** Walk the changed surface family by family — **Feature placement**,
   **Abstraction / L1 leak**, **Conformance**, **Footgun / ages-well** — judging the shape it produces. For
   each rule check both directions: what is present and violating, and what the kind owes but the diff
   omits. Before flagging an absence, confirm the service supports the affordance in the authoritative AWS
   takes one value. Stop once you can name the defect and cite its rule — file + section — with the concrete
   fix.
Beyond the shared exclusions in `cdk-review-principles` (pre-existing, cosmetics, out-of-scope,
no-nit-quota), stay silent on the following — not even as OPTIONAL — because none is a design defect in
the changed surface. When a defect belongs to a different dimension, leave it — it's outside your scope.

`message` as the complete posted comment (observation, impact, concrete fix, and the guideline cited
inline by file + section). This dimension's `category` is one of: Feature placement & abstraction,
Design Guidelines conformance, Clarity/simplicity/consistency, Footgun-free & ages-well interface
quality.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6efedd4d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T18:58:57.219Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795719537219",
    "title": "align compatibility rules with their guides and prune the review skills",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aws/aws-cdk",
    "source_uri": "https://github.com/aws/aws-cdk",
    "source_version": "HEAD",
    "content_hash": "4fac87d91e175417ac1c4241a4a115c25a94424c88fd26645c557698b5e1bc7f"
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
        "Harvested/verified timestamp recorded: 2026-11-26T18:58:57.219Z"
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
  "auth_token": "659b060c85fc77ccbf18d3bf5b901d847241705fc13dc3550451b35cc55f9986"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
