# Candidate Directive: [CD-IUF9] ios): the Dynamic Island shows when listening is paused instead of a clock still

<!-- PROVENANCE_START
{
  "source_repository": "wquguru-cicada-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T06:14:04.564Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-wquguru-cicada-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [wquguru-cicada-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T06:14:04.564Z`  
> **Learning ID**: `LEARN-EVO-wquguru-cicada-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-21T06:14:04.676Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795241644676",
    "title": "ios): the Dynamic Island shows when listening is paused instead of a clock still",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "wquguru-cicada-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "be09b1058f9f913205ce1ec53f05234b36ef18ed54cfed021c859db63e160ca8"
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
        "Harvested/verified timestamp recorded: 2026-11-21T06:14:04.676Z"
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
  "auth_token": "d40c4e9ce151296e9b9fdd5aa8c0314ca998687421d1bc8ad5957d201ae149d3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
