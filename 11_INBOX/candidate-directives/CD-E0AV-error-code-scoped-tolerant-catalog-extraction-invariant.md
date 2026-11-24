# Candidate Directive: [CD-E0AV] Error-Code-Scoped Tolerant Catalog Extraction Invariant

<!-- PROVENANCE_START
{
  "source_repository": "t8y2/dbx",
  "source_url": "https://github.com/t8y2/dbx",
  "source_version": "cf1293f6",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T21:53:06.823Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-t8y2-dbx",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [t8y2/dbx](https://github.com/t8y2/dbx) (Revision: `cf1293f6`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T21:53:06.823Z`  
> **Learning ID**: `learn-github-t8y2-dbx`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-24T21:53:06.822Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795557186822",
    "title": "Error-Code-Scoped Tolerant Catalog Extraction Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "t8y2/dbx",
    "source_uri": "https://github.com/t8y2/dbx",
    "source_version": "HEAD",
    "content_hash": "241479bde6043db5432a014df8a936a9b8d0a1e5cb3f4af33ed3ecf2e6a91ff5"
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
        "Harvested/verified timestamp recorded: 2026-11-24T21:53:06.822Z"
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
  "auth_token": "44337a5d6c131f8afd992627726050e7534d389b73a6ee039ccbf950b09f0dfa"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
