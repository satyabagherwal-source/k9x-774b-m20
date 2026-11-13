# Candidate Directive: [CD-UJ4F] Merge pull request #131190 from groeneai/null-as-default-type-default

<!-- PROVENANCE_START
{
  "source_repository": "ClickHouse/ClickHouse",
  "source_url": "https://github.com/ClickHouse/ClickHouse",
  "source_version": "c08eec9b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-13T15:29:40.431Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-clickhouse-clickhouse",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse) (Revision: `c08eec9b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-13T15:29:40.431Z`  
> **Learning ID**: `learn-github-clickhouse-clickhouse`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/DataTypes/Serializations/SerializationNullable.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ClickHouse/ClickHouse. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3a137ccd`: Merge pull request #131190 from groeneai/null-as-default-type-default. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/DataTypes/Serializations/SerializationNullable.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
/// Deserialize value into non-nullable column. In case of NULL, insert the default of nested_type (if given) and set is_null to true.
static ReturnType deserializeImpl(IColumn & column, ReadBuffer & buf, CheckForNull && check_for_null, DeserializeNested && deserialize_nested, bool & is_null, const IDataType * nested_type = nullptr)
        if (nested_type && !nested_type->isDefaultInsertTrivial())
            nested_type->insertDefaultInto(column);
        else
            column.insertDefault();
ReturnType  deserializeTextEscapedAndRawImpl(IColumn & column, ReadBuffer & istr, const FormatSettings & settings, const SerializationPtr & nested_serialization, bool & is_null, const IDataType * nested_type = nullptr)
        return deserializeImpl<ReturnType>(column, istr, check_for_null, deserialize_nested, is_null, nested_type);
    return deserializeImpl<ReturnType>(column, peekable_buf, check_for_null, deserialize_nested_with_check, is_null, nested_type);
bool SerializationNullable::deserializeNullAsDefaultOrNestedTextEscaped(IColumn & nested_column, ReadBuffer & istr, const FormatSettings & settings, const SerializationPtr & nested_serialization, const IDataType * nested_type)
    
```

**NEGATIVE CONSTRAINT**:
```c++
// Anti-pattern to NEVER write (induced failure mode):
/// Deserialize value into non-nullable column. In case of NULL, insert default and set is_null to true.
static ReturnType deserializeImpl(IColumn & column, ReadBuffer & buf, CheckForNull && check_for_null, DeserializeNested && deserialize_nested, bool & is_null)
        column.insertDefault();
ReturnType  deserializeTextEscapedAndRawImpl(IColumn & column, ReadBuffer & istr, const FormatSettings & settings, const SerializationPtr & nested_serialization, bool & is_null)
        return deserializeImpl<ReturnType>(column, istr, check_for_null, deserialize_nested, is_null);
    return deserializeImpl<ReturnType>(column, peekable_buf, check_for_null, deserialize_nested_with_check, is_null);
bool SerializationNullable::deserializeNullAsDefaultOrNestedTextEscaped(IColumn & nested_column, ReadBuffer & istr, const FormatSettings & settings, const SerializationPtr & nested_serialization)
    deserializeTextEscapedAndRawImpl<void, true>(nested_column, istr, settings, nested_serialization, is_null);
bool SerializationNullable::deserializeNullAsDefaultOrNestedTextRaw(IColumn & nested_column, ReadBuffer & istr, const FormatSettings & settings, const SerializationPtr & nested_serialization)
    d
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3a137ccd` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T15:29:40.429Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0.51,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 51%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=FAIL.",
  "item": {
    "id": "cand-1794583780429",
    "title": "Merge pull request #131190 from groeneai/null-as-default-type-default",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ClickHouse/ClickHouse",
    "source_uri": "https://github.com/ClickHouse/ClickHouse",
    "source_version": "HEAD",
    "content_hash": "58253bdb3789b77ac90b85c53e16cc91953d79075356513b1e11c2e24ba8a415"
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
      "status": "FAIL",
      "score": 0.4,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": true,
      "opposing_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "unsupported_assumptions": [],
      "findings": [
        "DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write')"
      ],
      "details": [
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
        "Harvested/verified timestamp recorded: 2026-11-13T15:29:40.429Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "FAIL",
      "score": 0.4,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": true,
      "conflicting_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "findings": [
        "CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
      ],
      "details": []
    }
  },
  "detected_contradictions": [
    "Canonical opposition: Clashes with RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
    "Conflict with RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
  ],
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
  "auth_token": "653398ca9fd549b7187a7dcb18377f1f3ef2e9523d10af9969911b1fdad4be6e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
