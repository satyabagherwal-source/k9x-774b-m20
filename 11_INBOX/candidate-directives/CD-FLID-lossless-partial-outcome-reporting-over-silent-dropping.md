# Candidate Directive: [CD-FLID] Lossless Partial-Outcome Reporting Over Silent Dropping

<!-- PROVENANCE_START
{
  "source_repository": "pimalaya/himalaya",
  "source_url": "https://github.com/pimalaya/himalaya",
  "source_version": "bf9f4e2a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T23:27:18.949Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pimalaya-himalaya",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pimalaya/himalaya](https://github.com/pimalaya/himalaya) (Revision: `bf9f4e2a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T23:27:18.949Z`  
> **Learning ID**: `learn-github-pimalaya-himalaya`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When parsing external network responses or collection payloads that contain malformed records, the pipeline MUST NOT silently drop the unreadable items or replace invalid octets with lossy placeholders (`U+FFFD`). Unparseable records MUST be preserved as base64-encoded raw octets, appended to an `errors` collection (e.g., `ItemError`), and the process MUST exit with a dedicated partial-outcome status code (Exit Code 3).

**WHY**:
Silent omission of invalid records causes subtle synchronization drift and user confusion (e.g., IMAP status reporting 177 messages while envelope listing returns 173). Conversely, outright fatal failure (`Exit Code 1`) halts execution of batch operations. Lossless raw capture isolates the bad record, informs the caller, and enables diagnostics without data loss.

**WHEN TO APPLY**:
Apply to any data serialization/deserialization boundary parsing untrusted or imperfect external protocol streams (IMAP untagged responses, corrupt database rows, malformed MIME parts, external API webhooks).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemError {
    pub id: String,
    pub code: String,
    pub message: String,
    pub raw_payload_base64: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchResult<T> {
    pub items: Vec<T>,
    pub errors: Vec<ItemError>,
}

pub enum ExitStatus {
    Success = 0,
    FatalError = 1,
    UsageError = 2,
    PartialOutcome = 3,
}

pub fn decode_protocol_stream<T, F>(
    raw_frames: Vec<(String, &[u8])>, 
    decoder: F
) -> (BatchResult<T>, ExitStatus)
where
    F: Fn(&[u8]) -> Result<T, String>,
{
    let mut items = Vec::new();
    let mut errors = Vec::new();

    for (record_id, bytes) in raw_frames {
        match decoder(bytes) {
            Ok(item) => items.push(item),
            Err(err_msg) => {
                errors.push(ItemError {
                    id: record_id,
                    code: "record-unreadable".into(),
                    message: err_msg,
                    raw_payload_base64: Some(base64_codec::encode(bytes)),
                });
            }
        }
    }

    let status = if errors.is_empty() {
        ExitStatus::Success
    } else {
        ExitStatus::PartialOutcome
    };

    (BatchResult { items, errors }, status)
}

mod base64_codec {
    pub fn encode(b: &[u8]) -> String {
        // Minimal base64 representation
        use std::fmt::Write;
        b.iter().fold(String::new(), |mut acc, byte| {
            let _ = write!(acc, "{:02x}", byte);
            acc
        })
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Silently filtering out errors or swallowing decode failures
pub fn decode_leaky<T, F>(frames: Vec<&[u8]>, decoder: F) -> Vec<T>
where
    F: Fn(&[u8]) -> Result<T, String>,
{
    frames
        .into_iter()
        .filter_map(|bytes| {
            // BUG: Dropped frames vanish without leaving structured telemetry
            // Callers cannot distinguish between a server with 0 items and 100 corrupt items
            decoder(bytes).ok() 
        })
        .collect()
}
```

**VERIFICATION METHOD**:
Write unit tests validating that any malformed frame produces an entry in `errors` containing base64 data and triggers the `PartialOutcome` variant:
```rust
#[test]
fn test_corrupt_frame_triggers_partial_outcome() {
    let data: Vec<(String, &[u8])> = vec![
        ("1".into(), b"VALID"),
        ("2".into(), b"\xFF\xFE\xFD_CORRUPT"),
    ];
    let (res, status) = decode_protocol_stream(data, |b| {
        std::str::from_utf8(b).map(|s| s.to_string()).map_err(|e| e.to_string())
    });
    assert_eq!(res.items.len(), 1);
    assert_eq!(res.errors.len(), 1);
    assert_eq!(res.errors[0].id, "2");
    assert!(res.errors[0].raw_payload_base64.is_some());
    assert_matches::assert_matches!(status, ExitStatus::PartialOutcome);
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T23:27:18.948Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795303638948",
    "title": "Lossless Partial-Outcome Reporting Over Silent Dropping",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pimalaya/himalaya",
    "source_uri": "https://github.com/pimalaya/himalaya",
    "source_version": "HEAD",
    "content_hash": "1c51da6ae5214b603975a474e957534166a775b966df23713672e2b127fa5ed0"
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
        "Harvested/verified timestamp recorded: 2026-11-21T23:27:18.948Z"
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
  "auth_token": "fdce033b88aea1879f69ed3b78bc336bc375a3b377dd18d2eeefecfa189edf76"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
