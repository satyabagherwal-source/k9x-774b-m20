# Candidate Directive: [CD-H23I] Lossless Partial-Outcome Reporting Over Silent Dropping

<!-- PROVENANCE_START
{
  "source_repository": "pimalaya-himalaya-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T23:28:26.969Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pimalaya-himalaya-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pimalaya-himalaya-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T23:28:26.969Z`  
> **Learning ID**: `LEARN-EVO-pimalaya-himalaya-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T23:28:27.101Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795303707101",
    "title": "Lossless Partial-Outcome Reporting Over Silent Dropping",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pimalaya-himalaya-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "cab74e561c9e7bf902e99113cadae8072b2bbe4210e713c4350db52e883f06a2"
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-21T23:28:27.101Z"
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
  "auth_token": "3fe87c651152c680a3b0a63e02e4bdb0b892b110060ebf596cfda63e3456e2c4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
