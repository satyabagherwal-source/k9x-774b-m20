# Candidate Directive: [CD-4I31] Support reading encrypted Iceberg deletion vectors

<!-- PROVENANCE_START
{
  "source_repository": "trinodb-trino-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T08:29:34.343Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-trinodb-trino-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trinodb-trino-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T08:29:34.343Z`  
> **Learning ID**: `LEARN-EVO-trinodb-trino-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `plugin/trino-iceberg/src/main/java/io/trino/plugin/iceberg/IcebergPageSourceProvider.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in trinodb/trino. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6af3a192`: Support reading encrypted Iceberg deletion vectors. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `plugin/trino-iceberg/src/main/java/io/trino/plugin/iceberg/IcebergPageSourceProvider.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
import io.trino.plugin.iceberg.encryption.DeletionVectorDecryptionData;
import io.trino.plugin.iceberg.encryption.ParquetFileDecryptionData;
import org.apache.iceberg.encryption.AesGcmInputFile;
import org.apache.iceberg.io.IOUtil;
import org.apache.iceberg.io.SeekableInputStream;
import java.security.GeneralSecurityException;
import static io.airlift.slice.Slices.wrappedBuffer;
import static org.apache.iceberg.encryption.Ciphers.GCM_STREAM_MAGIC_STRING;
                                    deleteFile -> readDeletionVector(fileSystem, deleteFile, memoryContext, arePlaintextFilesAllowedForEncryptedTables(session)),
    private static SerializedDeletionVector readDeletionVector(TrinoFileSystem fileSystem, DeleteFile delete, AggregatedMemoryContext memoryContext, boolean plaintextFilesAllowed)
        try {
            long contentOffset = delete.contentOffset().orElseThrow();
            int contentSize = toIntExact(delete.contentSizeInBytes().orElseThrow());
            Optional<DeletionVectorDecryptionData> decryptionData = delete.fileDecryptionData().map(DeletionVectorDecryptionData.class::cast);
            if (
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
import io.trino.plugin.iceberg.IcebergSplit.ParquetFileDecryptionData;
                                    deleteFile -> readDeletionVector(fileSystem, deleteFile, memoryContext),
    private static SerializedDeletionVector readDeletionVector(TrinoFileSystem fileSystem, DeleteFile delete, AggregatedMemoryContext memoryContext)
        try (TrinoInput trinoInput = trinoInputFile.newInput()) {
            slice = trinoInput.readFully(delete.contentOffset().orElseThrow(), toIntExact(delete.contentSizeInBytes().orElseThrow()));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6af3a192` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T08:29:34.475Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795595374475",
    "title": "Support reading encrypted Iceberg deletion vectors",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trinodb-trino-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9fcc718ae153f05c614d046e1404948b7c6dfc32eba20628e1cd28e04f23cf0a"
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
        "Harvested/verified timestamp recorded: 2026-11-25T08:29:34.475Z"
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
  "auth_token": "84dc796a51b0ef1422bf25c47739b64e1a38e8e1e074566ccdbfac86e7b046f4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
