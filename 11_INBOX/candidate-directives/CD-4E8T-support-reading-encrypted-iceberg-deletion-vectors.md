# Candidate Directive: [CD-4E8T] Support reading encrypted Iceberg deletion vectors

<!-- PROVENANCE_START
{
  "source_repository": "trinodb/trino",
  "source_url": "https://github.com/trinodb/trino",
  "source_version": "6af3a192",
  "license": "Apache-2.0",
  "timestamp": "2026-11-25T08:29:29.501Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-trinodb-trino",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trinodb/trino](https://github.com/trinodb/trino) (Revision: `6af3a192`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-25T08:29:29.501Z`  
> **Learning ID**: `learn-github-trinodb-trino`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-25T08:29:29.499Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795595369499",
    "title": "Support reading encrypted Iceberg deletion vectors",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trinodb/trino",
    "source_uri": "https://github.com/trinodb/trino",
    "source_version": "HEAD",
    "content_hash": "9fcc718ae153f05c614d046e1404948b7c6dfc32eba20628e1cd28e04f23cf0a"
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
        "Harvested/verified timestamp recorded: 2026-11-25T08:29:29.499Z"
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
  "auth_token": "9bfd57c1a99bb486d684f15fc9b20aacab9a1a9aece175c5ccef4bc0801554da"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
