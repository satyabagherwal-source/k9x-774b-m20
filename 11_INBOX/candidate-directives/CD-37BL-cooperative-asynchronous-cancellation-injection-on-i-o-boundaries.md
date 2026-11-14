# Candidate Directive: [CD-37BL] Cooperative Asynchronous Cancellation Injection on I/O Boundaries

<!-- PROVENANCE_START
{
  "source_repository": "restatedev-restate-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T05:08:13.783Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-restatedev-restate-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [restatedev-restate-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T05:08:13.783Z`  
> **Learning ID**: `LEARN-EVO-restatedev-restate-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Long-running background operations (such as large snapshot downloads, remote file transfers, or storage migrations) MUST explicitly poll or monitor cancellation signals (`tokio_util::sync::CancellationToken`) at each I/O chunk boundary or pipeline stage. Background loops MUST NOT defer cancellation checks until the terminal processing boundary of an I/O pipeline.

**WHY**:
Network downloads and storage imports can consume tens of minutes and gigabytes of disk and network I/O. If a node is reassigned or decommissioned by the cluster controller during this phase, ignoring the cancellation signal until post-import completion blocks the supervisor loop, starves local disk I/O, delays partition reassignment across the cluster, and leaks system resources on nodes that will never host the partition.

**WHEN TO APPLY**:
- Cluster management, replication setups, and partition migration handlers.
- Snapshot transfer loops, large payload parsers, and batch database operations.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use tokio_util::sync::CancellationToken;
use tokio::io::{AsyncRead, AsyncReadExt};

pub async fn download_snapshot_stream<R, W>(
    mut reader: R,
    mut writer: W,
    cancel: &CancellationToken,
) -> Result<u64, StorageError>
where
    R: AsyncRead + Unpin,
    W: tokio::io::AsyncWrite + Unpin,
{
    let mut buffer = vec![0u8; 64 * 1024];
    let mut total_bytes = 0;

    loop {
        tokio::select! {
            _ = cancel.cancelled() => {
                return Err(StorageError::Cancelled("Snapshot download aborted by supervisor".into()));
            }
            n = reader.read(&mut buffer) => {
                let n = n.map_err(|e| StorageError::Io(e))?;
                if n == 0 {
                    break;
                }
                writer.write_all(&buffer[..n]).await.map_err(|e| StorageError::Io(e))?;
                total_bytes += n as u64;
            }
        }
    }
    writer.flush().await.map_err(|e| StorageError::Io(e))?;
    Ok(total_bytes)
}
```

**NEGATIVE CONSTRAINT**:
```rust

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T05:08:13.905Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794632893905",
    "title": "Cooperative Asynchronous Cancellation Injection on I/O Boundaries",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "restatedev-restate-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "23aaa491794d4973481b9576b234bc31ee36f35520982f6fdbb187d3d799d0e5"
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
        "Harvested/verified timestamp recorded: 2026-11-14T05:08:13.905Z"
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
  "auth_token": "6a8d23ebb13a519dbcb1040799b9658b4505a2d09557b83be3b610f6498acf89"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
