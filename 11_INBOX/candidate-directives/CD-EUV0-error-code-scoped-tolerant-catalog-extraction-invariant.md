# Candidate Directive: [CD-EUV0] Error-Code-Scoped Tolerant Catalog Extraction Invariant

<!-- PROVENANCE_START
{
  "source_repository": "t8y2-dbx-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T21:53:46.273Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-t8y2-dbx-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [t8y2-dbx-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T21:53:46.273Z`  
> **Learning ID**: `LEARN-EVO-t8y2-dbx-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When reading catalog metadata (table comments, column defaults, constraint remarks) through legacy or strict database drivers, unmappable or malformed decorative attributes MUST be caught and defaulted to `None`/`null` ONLY when matched against the exact vendor character-conversion error code. Catch-all `SQLException` or generic error suppression MUST NOT be used, and connection-level character decoding parameters MUST NOT be downgraded or softened.

**WHY**:
Legacy databases often contain corrupt comments encoded in deprecated code pages (e.g., GBK, CP937 bytes in an EUC-JP database). Softening connection-level decoders (such as setting character substitution flags) silences encoding errors on subsequent data writes, leading to silent, irreversible user data corruption. Conversely, letting decorative catalog read failures fail the query prevents entire schemas from opening in UI/metadata explorers.

**WHEN TO APPLY**:
Applies to all JDBC, ODBC, and native wire driver bridges when extracting optional catalog metadata fields (remarks, comments, column defaults) from systems with heterogeneous client histories (DB2, Oracle, Sybase, Informix).

**VERIFIED IMPLEMENTATION PATTERN**:
```java
public final class CatalogDefensiveReader {
    // Exact IBM DB2 JCC code for character conversion exception
    private static final int DB2_UNDECODABLE_CATALOG_VALUE_ERROR = -4220;

    public static String safeMetadataString(ResultSet rs, String column) throws SQLException {
        try {
            return rs.getString(column);
        } catch (SQLException e) {
            // Strictly scope tolerance to known conversion error
            if (e.getErrorCode() != DB2_UNDECODABLE_CATALOG_VALUE_ERROR) {
                throw e; // Bubble up permission, connection, or syntax faults
            }
            return null; // Gracefully degrade decorative attribute
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```java
// NEVER loosen global connection properties to bypass metadata bugs
Properties props = new Properties();
// CATASTROPHIC: Bypasses metadata decoding errors but causes writes
// with unencodable characters to be silently replaced by '?' or corrupted!
props.setProperty("db2.jcc.charsetDecoderEncoder", "3");
```

**VERIFICATION METHOD**:
Mock a JDBC `ResultSet` throwing a `SQLException` with error code `-4220` when column `REMARKS` is read: assert that `safeMetadataString` returns `null` and the table row is returned intact. Then mock error code `-4476` (e.g., authorization failure) and assert that `safeMetadataString` rethrows the exception, failing the operation.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T21:53:46.427Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795557226427",
    "title": "Error-Code-Scoped Tolerant Catalog Extraction Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "t8y2-dbx-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "241479bde6043db5432a014df8a936a9b8d0a1e5cb3f4af33ed3ecf2e6a91ff5"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T21:53:46.427Z"
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
  "auth_token": "af947a07e4c2089c7f4b70e4827cc8c684625a9608008e064285566c02d83fe1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
