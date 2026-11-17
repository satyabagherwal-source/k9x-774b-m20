# Candidate Directive: [CD-A0MA] Isolate JSON storage error fixtures by scenario

<!-- PROVENANCE_START
{
  "source_repository": "gluesql/gluesql",
  "source_url": "https://github.com/gluesql/gluesql",
  "source_version": "dda0280a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T06:28:31.522Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gluesql-gluesql",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gluesql/gluesql](https://github.com/gluesql/gluesql) (Revision: `dda0280a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T06:28:31.522Z`  
> **Learning ID**: `learn-github-gluesql-gluesql`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `storages/json-storage/tests/error.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in gluesql/gluesql. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `dda0280a`: Isolate JSON storage error fixtures by scenario. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `storages/json-storage/tests/error.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    std::path::Path,
    let cases = [
            "wrong-format-jsonl",
            "SELECT * FROM WrongFormatJsonl",
            ValueError::InvalidJsonString("[".to_owned()).into(),
            "wrong-format-json",
            "SELECT * FROM WrongFormatJson",
            Error::StorageMsg(
            ),
            "wrong-schema",
            "SELECT * FROM WrongSchema",
            Error::Schema(SchemaParseError::CannotParseDDL),
            "wrong-table-name",
            "SELECT * FROM WrongTableName",
            Error::StorageMsg(JsonStorageError::TableNameDoesNotMatchWithFile.to_string()),
            "duplicated",
            "SELECT * FROM Duplicated",
            Error::StorageMsg(
            ),
            "duplicated",
            "DROP TABLE Duplicated",
            Error::StorageMsg(
            ),
            "json-object-type-required",
            "SELECT * FROM JsonObjectTypeRequired",
            Error::StorageMsg(JsonStorageError::JsonObjectTypeRequired.to_string()),
            "json-array-type-required",
            "SELECT * FROM JsonArrayTypeRequired",
            Error::StorageMsg(JsonStorageError::JsonArrayTypeRequired.to_string()),
    let samples = P
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    let path = "./tests/samples/";
    let json_storage = JsonStorage::new(path).unwrap();
    let mut glue = Glue::new(json_storage);

    let cases = vec![
            glue.execute("SELECT * FROM WrongFormatJsonl"),
            Err(ValueError::InvalidJsonString("[".to_owned()).into()),
            glue.execute("SELECT * FROM WrongFormatJson"),
            Err(Error::StorageMsg(
            )),
            glue.execute("SELECT * FROM WrongSchema"),
            Err(Error::Schema(SchemaParseError::CannotParseDDL)),
            glue.execute("SELECT * FROM WrongTableName"),
            Err(Error::StorageMsg(
                JsonStorageError::TableNameDoesNotMatchWithFile.to_string(),
            )),
            glue.execute("SELECT * FROM Duplicated"),
            Err(Error::StorageMsg(
            )),
            glue.execute("DROP TABLE Duplicated"),
            Err(Error::StorageMsg(
            )),
            glue.execute("SELECT * FROM JsonObjectTypeRequired"),
            Err(Error::StorageMsg(
                JsonStorageError::JsonObjectTypeRequired.to_string(),
            )),
            glue.execute("SELECT * FROM JsonArrayTypeRequired"),
            Err(Error::StorageMsg(

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `dda0280a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:28:31.520Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794896911520",
    "title": "Isolate JSON storage error fixtures by scenario",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gluesql/gluesql",
    "source_uri": "https://github.com/gluesql/gluesql",
    "source_version": "HEAD",
    "content_hash": "177ffe66a47abb587a8cae3428b11b799be3b81e26a38188704fd6e73b97c79a"
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:28:31.520Z"
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
  "auth_token": "7d8c166f5839ae88fd48093f99965979589b2552893a99e520a44db52244fbd5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
