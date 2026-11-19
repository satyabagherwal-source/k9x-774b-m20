# Candidate Directive: [CD-KNPQ] (YqlSelect) Fix panic on qualified star for inputs without column ord

<!-- PROVENANCE_START
{
  "source_repository": "ytsaurus/ytsaurus",
  "source_url": "https://github.com/ytsaurus/ytsaurus",
  "source_version": "6f9fb9d6",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T02:56:11.534Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-ytsaurus-ytsaurus",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ytsaurus/ytsaurus](https://github.com/ytsaurus/ytsaurus) (Revision: `6f9fb9d6`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T02:56:11.534Z`  
> **Learning ID**: `learn-github-ytsaurus-ytsaurus`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `yql/essentials/core/type_ann/type_ann_sql.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ytsaurus/ytsaurus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3d6a44fa`: YQL-20905: (YqlSelect) Fix panic on qualified star for inputs without column order. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `yql/essentials/core/type_ann/type_ann_sql.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
                                            for (const auto& x : joinInputs) {
                                                auto addColumn = [&](TStringBuf name) {
                                                    if (!name.StartsWith("_yql_")) {
                                                        o.AddColumn(MakeAliasedColumn(x.Alias, name));
                                                    }
                                                };
                                                if (isYql && !x.Order) {
                                                    for (const auto* item : x.Type->GetItems()) {
                                                        addColumn(item->GetName());
                                                    }
                                                } else {
                                                    YQL_ENSURE(x.Order);
                                                    for (const auto& column : *x.Order) {
                                                        addColumn(column.LogicalName);
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
                                            for (ui32 inputIndex = 0; inputIndex < joinInputs.size(); ++inputIndex) {
                                                auto& x = inputs[inputIndex];
                                                YQL_ENSURE(x.Order);
                                                for (const auto& [col, gen_col] : *x.Order) {
                                                    if (!col.StartsWith("_yql_")) {
                                                        o.AddColumn(MakeAliasedColumn(x.Alias, col));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3d6a44fa` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T02:56:11.532Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795056971532",
    "title": "(YqlSelect) Fix panic on qualified star for inputs without column ord",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ytsaurus/ytsaurus",
    "source_uri": "https://github.com/ytsaurus/ytsaurus",
    "source_version": "HEAD",
    "content_hash": "0d5c83c29fd6e077ed243c57792eb06103a14c0e7c9eecf0930a3fa5e51d5a80"
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
        "Harvested/verified timestamp recorded: 2026-11-19T02:56:11.532Z"
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
  "auth_token": "31dabfdb433e9a6dc2ea3416b4ea4d86d3391df6fbb246567ee5dabe24703cb1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
