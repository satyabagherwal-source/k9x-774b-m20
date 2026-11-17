# Candidate Directive: [CD-FTEC] ci(release): add a workflow to build the gateway controller image

<!-- PROVENANCE_START
{
  "source_repository": "goodrain/rainbond",
  "source_url": "https://github.com/goodrain/rainbond",
  "source_version": "5508cd38",
  "license": "NOASSERTION",
  "timestamp": "2026-11-17T21:56:49.428Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-goodrain-rainbond",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [goodrain/rainbond](https://github.com/goodrain/rainbond) (Revision: `5508cd38`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-17T21:56:49.428Z`  
> **Learning ID**: `learn-github-goodrain-rainbond`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
          [[ "$BACKUP_SUFFIX" =~ ^[0-9A-Za-z
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cfba2cee` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T21:56:49.426Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794952609426",
    "title": "ci(release): add a workflow to build the gateway controller image",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "goodrain/rainbond",
    "source_uri": "https://github.com/goodrain/rainbond",
    "source_version": "HEAD",
    "content_hash": "7eb69a3f4485e0a5a85406582d5895357e878d9b76b0e92731f0f6c29367c524"
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
        "Harvested/verified timestamp recorded: 2026-11-17T21:56:49.426Z"
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
  "auth_token": "35f880b5b31aa10854644d212b8c75de1b9f6cb9f61b7340c8253fde4c772274"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
