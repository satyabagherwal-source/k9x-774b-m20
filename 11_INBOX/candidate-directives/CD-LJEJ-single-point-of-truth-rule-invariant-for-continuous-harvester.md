# Candidate Directive: [CD-LJEJ] Single-Point-of-Truth Rule Invariant for Continuous Harvester

<!-- PROVENANCE_START
{
  "source_repository": "proof-system/canonical-rule-sentinel",
  "source_url": "https://github.com/proof-system/canonical-rule-sentinel",
  "source_version": "commit-proof-1234",
  "license": "MIT",
  "timestamp": "2026-11-13T14:54:41.275Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-proof-system-canonical-rule-sentinel",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [proof-system/canonical-rule-sentinel](https://github.com/proof-system/canonical-rule-sentinel) (Revision: `commit-pro`).  
> **License**: MIT | **Timestamp**: `2026-11-13T14:54:41.275Z`  
> **Learning ID**: `learn-github-proof-system-canonical-rule-sentinel`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Every harvested intelligence invariant extracted from software repositories MUST be automatically appended to 05_KNOWLEDGE/engineering-patterns.md without diversion.

**WHY**:
Diverting rules away from engineering-patterns.md starves the primary knowledge base and causes retrieval engines to fail when seeking verified engineering patterns.

**WHEN TO APPLY**:
Apply to all automated harvesting, classification, and distribution gateways across the AI-Builder-Brain fleet.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
export function persistEngineeringRule(rule: EngineeringRule, patternsPath: string): void {
  fs.appendFileSync(patternsPath, formatRule(rule), 'utf-8');
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// BAD: Diverting rules into staging inbox or secondary folders only
if (rule.topic === 'feedback') {
  stageInInboxOnly(rule);
}
```

**VERIFICATION METHOD**:
Automated read-back verification asserting rule number and title existence in engineering-patterns.md.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T14:54:41.270Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794581681270",
    "title": "Single-Point-of-Truth Rule Invariant for Continuous Harvester",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "proof-system/canonical-rule-sentinel",
    "source_uri": "https://github.com/proof-system/canonical-rule-sentinel",
    "source_version": "HEAD",
    "content_hash": "25f048206c20ae573a78030da7f03dc994a0598d17981308fa4ceb49444cd6c7"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-13T14:54:41.271Z"
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
  "auth_token": "af27ac7f1180cada371a1cc8b6c9eedca44fafcb8263c6dabc8ab64f0c782621"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
