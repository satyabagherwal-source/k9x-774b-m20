# Candidate Directive: [CD-1PY9] Cooperative Asynchronous Cancellation Injection on I/O Boundaries

<!-- PROVENANCE_START
{
  "source_repository": "restatedev/restate",
  "source_url": "https://github.com/restatedev/restate",
  "source_version": "7dd495f7",
  "license": "NOASSERTION",
  "timestamp": "2026-11-14T05:07:04.737Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-restatedev-restate",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [restatedev/restate](https://github.com/restatedev/restate) (Revision: `7dd495f7`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-14T05:07:04.737Z`  
> **Learning ID**: `learn-github-restatedev-restate`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
// ANTI-PATTERN: Awaiting monolithic completion before checking cancellation
pub async fn run_partition_open(cancel: CancellationToken) -> Result<(), Error> {
    // Blocks for 30 minutes on large snapshots; cancellation signal completely unobserved!
    let snapshot = download_latest_snapshot().await?;
    
    // RocksDB CF import starts even if cancellation was requested 25 minutes ago
    import_cf(snapshot).await?; 

    if cancel.is_cancelled() {
        // Way too late: 30 minutes of I/O and CPU wasted
        return Err(Error::Cancelled);
    }
    Ok(())
}
```

**VERIFICATION METHOD**:
Implement a mock asynchronous source emitting chunks with an artificial delay. Verify that firing `cancel.cancel()` during the stream terminates the future immediately without reading subsequent chunks:
```rust
#[tokio::test]
async fn test_cancellation_aborts_in_flight_download() {
    let cancel = CancellationToken::new();
    let cancel_clone = cancel.clone();
    
    let (tx, rx) = tokio::io::duplex(1024);
    tokio::spawn(async move {
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
        cancel_clone.cancel();
    });

    let result = download_snapshot_stream(rx, tokio::io::sink(), &cancel).await;
    assert!(matches!(result, Err(StorageError::Cancelled(_))));
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T05:07:04.737Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794632824737",
    "title": "Cooperative Asynchronous Cancellation Injection on I/O Boundaries",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "restatedev/restate",
    "source_uri": "https://github.com/restatedev/restate",
    "source_version": "HEAD",
    "content_hash": "071dab23a94e767c34fd69d5bbdda1eabb847c61e881d72b4935e5cae9cbd04c"
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
        "Harvested/verified timestamp recorded: 2026-11-14T05:07:04.737Z"
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
  "auth_token": "37af223cc786cd8a19e3dbd90f9a459d710193708125e4a431247bd8d5040c4a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
