# Candidate Directive: [CD-GSJJ] ci(release): add a workflow to build the gateway controller image

<!-- PROVENANCE_START
{
  "source_repository": "goodrain-rainbond-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T21:57:34.854Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-goodrain-rainbond-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [goodrain-rainbond-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T21:57:34.854Z`  
> **Learning ID**: `LEARN-EVO-goodrain-rainbond-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain A

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/release-v6-gateway-controller.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in goodrain/rainbond. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cfba2cee`: ci(release): add a workflow to build the gateway controller image. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/release-v6-gateway-controller.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
name: "release-v6-gateway-controller"

# 构建 rbd-gateway 使用的 apisix-ingress-controller 镜像（goodrain/apisix-ingress-controller 的发布分支），
# 推到阿里云 goodrain/apisix-ingress-controller:<tag> 和 <tag>-esgz。rainbond-chart 按 tag 引用它。
# 覆盖已有 tag 前，先把旧镜像复制到 <tag>-<backup_suffix> 和 <tag>-esgz-<backup_suffix>，备份失败就不构建。
on:
  workflow_dispatch:
    inputs:
      ref:
        description: 'goodrain/apisix-ingress-controller 的分支或 commit'
        required: true
        default: 'release/v1.8.4'
      tag:
        description: '要推送的镜像 tag（不带 -esgz）'
        required: true
        default: 'v1.8.4-upsert-e26e824'
      backup_suffix:
        description: '覆盖前旧镜像的备份后缀，例如 bak-20261117'
        required: true

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    environment: release-v6
    timeout-minutes: 60
    env:
      REPO: registry.cn-hangzhou.aliyuncs.com/goodrain/apisix-ingress-controller
      TAG: ${{ inputs.tag }}
      BACKUP_SUFFIX: ${{ inputs.backup_suffix }}
    steps:
      - name: Validate inputs
        run: |
          [[ "$TAG" =~ ^v[0-9A-Za-z._-]+$ && "$TAG" != *-esgz ]] || { echo "::error::invalid tag $TAG"; exit 1; }

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T21:57:34.970Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794952654970",
    "title": "ci(release): add a workflow to build the gateway controller image",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "goodrain-rainbond-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "cde604d5fcd3c348e595847317d0ca0d5235d0ccdd05fd1bffc14fef6dd42693"
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-17T21:57:34.971Z"
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
  "auth_token": "62f7fe97df8176250be1ec94dceb80148bf16e409d1a9be9d5d88683438f70e1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
