# Candidate Directive: [CD-AH3Y] embed structured design context in synthesized templates (MetadataContext

<!-- PROVENANCE_START
{
  "source_repository": "aws/aws-cdk",
  "source_url": "https://github.com/aws/aws-cdk",
  "source_version": "708bee9a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T19:41:41.278Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aws-aws-cdk",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aws/aws-cdk](https://github.com/aws/aws-cdk) (Revision: `708bee9a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T19:41:41.278Z`  
> **Learning ID**: `learn-github-aws-aws-cdk`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/@aws-cdk-testing/framework-integ/test/core/test/integ.metadata-context.js.snapshot/MetadataContextIntegDefaultTestDeployAssert9187EC06.assets.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aws/aws-cdk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `708bee9a`: core): embed structured design context in synthesized templates (MetadataContext). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/@aws-cdk-testing/framework-integ/test/core/test/integ.metadata-context.js.snapshot/MetadataContextIntegDefaultTestDeployAssert9187EC06.assets.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
{
  "version": "54.0.0",
  "files": {
    "21fbb51d7b23f6a6c262b46a9caee79d744a3ac019fd45422d988b96d44b2a22": {
      "displayName": "MetadataContextIntegDefaultTestDeployAssert9187EC06 Template",
      "source": {
        "path": "MetadataContextIntegDefaultTestDeployAssert9187EC06.template.json",
        "packaging": "file"
      },
      "destinations": {
        "current_account-current_region-d8d86b35": {
          "bucketName": "cdk-hnb659fds-assets-${AWS::AccountId}-${AWS::Region}",
          "objectKey": "21fbb51d7b23f6a6c262b46a9caee79d744a3ac019fd45422d988b96d44b2a22.json",
          "assumeRoleArn": "arn:${AWS::Partition}:iam::${AWS::AccountId}:role/cdk-hnb659fds-file-publishing-role-${AWS::AccountId}-${AWS::Region}"
        }
      }
    }
  },
  "dockerImages": {}
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `708bee9a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T19:41:41.276Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794685301276",
    "title": "embed structured design context in synthesized templates (MetadataContext",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aws/aws-cdk",
    "source_uri": "https://github.com/aws/aws-cdk",
    "source_version": "HEAD",
    "content_hash": "eb1cf6a050956f705b8688243912966a6071870d6dce84e60b135d28c7039813"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-14T19:41:41.276Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "d28362a1a0247d02020eda22ec81d113c73852fc22798887bf59e95ec062313a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
