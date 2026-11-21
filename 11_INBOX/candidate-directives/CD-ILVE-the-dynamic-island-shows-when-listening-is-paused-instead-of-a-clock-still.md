# Candidate Directive: [CD-ILVE] the Dynamic Island shows when listening is paused instead of a clock still

<!-- PROVENANCE_START
{
  "source_repository": "wquguru/cicada",
  "source_url": "https://github.com/wquguru/cicada",
  "source_version": "8450cb9d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T06:13:53.594Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-wquguru-cicada",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [wquguru/cicada](https://github.com/wquguru/cicada) (Revision: `8450cb9d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T06:13:53.594Z`  
> **Learning ID**: `learn-github-wquguru-cicada`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `ios/LiveActivity/CicadaLive.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in wquguru/cicada. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `26248cff`: ios): the Dynamic Island shows when listening is paused instead of a clock still running. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `ios/LiveActivity/CicadaLive.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
                        Text(context.state.paused ? "已暂停" : "正在听").font(.footnote.weight(.semibold))
                            .foregroundStyle(context.state.paused ? .white.opacity(0.6) : LiveInk.accent)
                    if !context.state.paused {
                        Elapsed(since: context.attributes.startedAt).font(.footnote.weight(.semibold))
                            .foregroundStyle(.white).frame(maxWidth: 64, alignment: .trailing).padding(.trailing, 4)
                    }
                    Circle().fill(context.state.paused ? LiveInk.grey : LiveInk.accent).frame(width: 7, height: 7)
                // Paused: a still pause mark, not a clock that keeps running as if it were listening.
                if context.state.paused {
                    Image(systemName: "pause.fill").font(.caption.weight(.semibold)).foregroundStyle(.white.opacity(0.6))
                } else {
                    Elapsed(since: context.attributes.startedAt)
                        .font(.caption.weight(.semibold)).foregroundStyle(LiveInk.accent)
                        .frame(maxWidth: 46)
                }
                Circle().fill(context.state.paused ? LiveInk.grey : LiveInk.acc
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
                        Text("正在听").font(.footnote.weight(.semibold)).foregroundStyle(LiveInk.accent)
                    Elapsed(since: context.attributes.startedAt).font(.footnote.weight(.semibold))
                        .foregroundStyle(.white).frame(maxWidth: 64, alignment: .trailing).padding(.trailing, 4)
                    Circle().fill(LiveInk.accent).frame(width: 7, height: 7)
                Elapsed(since: context.attributes.startedAt)
                    .font(.caption.weight(.semibold)).foregroundStyle(LiveInk.accent)
                    .frame(maxWidth: 46)
                Circle().fill(LiveInk.accent).frame(width: 9, height: 9)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `26248cff` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T06:13:53.592Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795241633592",
    "title": "the Dynamic Island shows when listening is paused instead of a clock still",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "wquguru/cicada",
    "source_uri": "https://github.com/wquguru/cicada",
    "source_version": "HEAD",
    "content_hash": "e401a9a711b029027f5664b89785548d83c129ec89ae5890426c883484122b40"
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
        "Harvested/verified timestamp recorded: 2026-11-21T06:13:53.592Z"
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
  "auth_token": "50adafe7c5359fe4dd8fe7aafa76dc581a34c6b63305461caf9048f0ecc4981c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
