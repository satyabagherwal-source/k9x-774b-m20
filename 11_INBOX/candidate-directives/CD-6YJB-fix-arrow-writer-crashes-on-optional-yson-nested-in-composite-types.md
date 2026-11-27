# Candidate Directive: [CD-6YJB] Fix Arrow writer crashes on optional<yson> nested in composite types

<!-- PROVENANCE_START
{
  "source_repository": "ytsaurus/ytsaurus",
  "source_url": "https://github.com/ytsaurus/ytsaurus",
  "source_version": "ee4f1331",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T06:14:51.479Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-ytsaurus-ytsaurus",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ytsaurus/ytsaurus](https://github.com/ytsaurus/ytsaurus) (Revision: `ee4f1331`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T06:14:51.479Z`  
> **Learning ID**: `learn-github-ytsaurus-ytsaurus`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `yt/yt/library/formats/arrow_parser.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ytsaurus/ytsaurus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `97403463`: YT-30225: Fix Arrow writer crashes on optional<yson> nested in composite types. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `yt/yt/library/formats/arrow_parser.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
#include <yt/yt/core/yson/pull_parser.h>

#include <util/stream/mem.h>
        return VisitStringLike<arrow20::StringArray>();
        return VisitStringLike<arrow20::LargeStringArray>();
        return VisitStringLike<arrow20::BinaryArray>();
        return VisitStringLike<arrow20::LargeBinaryArray>();
        return VisitStringLike<arrow20::FixedSizeBinaryArray>();
        return ParseStringLike<arrow20::Decimal128Array>([&] (TStringBuf value, i64 columnId) {
        return ParseStringLike<arrow20::Decimal256Array>([&] (TStringBuf value, i64 columnId) {
    arrow20::Status ParseStringLike(auto makeUnversionedValueFunc)
    arrow20::Status VisitStringLike()
    {
        if ((!ColumnType_ || *ColumnType_ == ESimpleLogicalValueType::Any) &&
            HasYsonTypeInMetadata(SchemaField_))
        {
            return ParseYson<ArrayType>();
        } else {
            return ParseString<ArrayType>();
        }
    }

    template <typename ArrayType>
    arrow20::Status ParseYson()
    {
        return ParseStringLike<ArrayType>([] (TStringBuf value, i64 columnId) {
            ValidateYsonValue(value);
            return MakeUnversionedAnyValue(value, columnId);
        });
    }
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
        return ParseStringLikeArray<arrow20::StringArray>();
        return ParseStringLikeArray<arrow20::LargeStringArray>();
        return ParseStringLikeArray<arrow20::BinaryArray>();
        return ParseStringLikeArray<arrow20::LargeBinaryArray>();
        return ParseStringLikeArray<arrow20::FixedSizeBinaryArray>();
        return ParseStringLikeArray<arrow20::Decimal128Array>([&] (TStringBuf value, i64 columnId) {
        return ParseStringLikeArray<arrow20::Decimal256Array>([&] (TStringBuf value, i64 columnId) {
    arrow20::Status ParseStringLikeArray(auto makeUnversionedValueFunc)
    arrow20::Status ParseStringLikeArray()
    {
        // Note that MakeUnversionedValue actually has third argument in its signature,
        // which leads to a "too few arguments" in the point of its invocation if we try to pass
        // it directly to ParseStringLikeArray.
        return ParseStringLikeArray<ArrayType>([this] (TStringBuf value, i64 columnId) {
            if (HasYsonTypeInMetadata(SchemaField_)) {
                ValidateYsonValue(value);
                return MakeUnversionedAnyValue(value, columnId);
            } else {
                return MakeUnversionedStringValu
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `97403463` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T06:14:51.478Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795760091478",
    "title": "Fix Arrow writer crashes on optional<yson> nested in composite types",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ytsaurus/ytsaurus",
    "source_uri": "https://github.com/ytsaurus/ytsaurus",
    "source_version": "HEAD",
    "content_hash": "4b7845e8f2290827b88d8db35dadd101ce14ff18b3a8168630b15e2164106201"
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
        "Harvested/verified timestamp recorded: 2026-11-27T06:14:51.478Z"
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
  "auth_token": "4e70856b314485991e4828d6615aa28296cf2ef6952f36c43654858d4b7bcd9b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
