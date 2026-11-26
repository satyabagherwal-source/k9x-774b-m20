# Candidate Directive: [CD-1Z75] skills): align compatibility rules with their guides and prune the review skills

<!-- PROVENANCE_START
{
  "source_repository": "aws-aws-cdk-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T18:59:08.149Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-aws-aws-cdk-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aws-aws-cdk-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T18:59:08.149Z`  
> **Learning ID**: `LEARN-EVO-aws-aws-cdk-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-26T18:59:08.272Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795719548272",
    "title": "skills): align compatibility rules with their guides and prune the review skills",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aws-aws-cdk-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b9e4629159b743e297b3f44c902941214a2a6b8e257fb5ec477feaeb57347c23"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
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
        "Harvested/verified timestamp recorded: 2026-11-26T18:59:08.272Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "ed1aadc7c622b0dab8fcaee8178a4d4c59cbc32a859a8b39e517969a8f7b4b8a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
