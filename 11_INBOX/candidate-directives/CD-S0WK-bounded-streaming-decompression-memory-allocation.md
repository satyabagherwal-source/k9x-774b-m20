# Candidate Directive: [CD-S0WK] Bounded Streaming Decompression Memory Allocation

<!-- PROVENANCE_START
{
  "source_repository": "freenet-freenet-core-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T09:34:51.926Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-freenet-freenet-core-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet-freenet-core-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T09:34:51.926Z`  
> **Learning ID**: `LEARN-EVO-freenet-freenet-core-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Any decompression or unarchiving stream parsing untrusted inputs MUST establish an explicit, hard memory allocation ceiling on internal decoder structures prior to initializing the stream, AND MUST read stream entry headers into bounded intermediate buffers verified against the exact remaining bytes of the enclosing container. It MUST NOT allocate memory dynamically based on self-reported, unvalidated header lengths.

**WHY**:
Formats like `.xz` (LZMA2) allow a small input stream (e.g., 64 bytes) to declare an arbitrary dictionary size (up to 2 GiB or more). Standard library decoders that allocate the dictionary immediately upon encountering the block header will cause rapid host Out-Of-Memory (OOM) crashes and kernel SIGKILL termination. Similarly, allocating vectors based on pre-read 32-bit/64-bit metadata size tags without checking whether those bytes exist in the underlying slice allows an attacker to force arbitrary heap allocations using single-byte truncated inputs.

**WHEN TO APPLY**:
Apply in any subsystem processing compressed archives (`tar.xz`, `zip`, `gzip`, `zstd`) from untrusted network sources, decentralized contract states, or user-uploaded file attachments.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// In crates/core/src/server/app_packaging.rs
use std::io::{Cursor, Read};
use xz2::stream::Stream;
use xz2::read::XzDecoder;
use tar::Archive;

// Explicit 96 MiB cap admitting up to standard preset 9 (64 MiB dict) while rejecting gigabyte bombs
const MAX_XZ_DECODER_MEM_BYTES: u64 = 96 * 1024 * 1024;
const MAX_DECOMPRESSED_STREAM_BYTES: u64 = 50 * 1024 * 1024;

pub fn decode_untrusted_archive(data: &[u8]) -> Result<Archive<LimitedReader<XzDecoder<&[u8]>>>, DecompressError> {
    // 1. Strict memory bound passed directly into liblzma stream initialization
    let stream = Stream::new_stream_decoder(MAX_XZ_DECODER_MEM_BYTES, 0)
        .map_err(|e| DecompressError::UnpackingError(anyhow::anyhow!(e)))?;

    // 2. Wrap decoder in a deterministic byte-counting LimitedReader
    let decoder = XzDecoder::new_stream(data, stream);
    let limited = LimitedReader {
        inner: decoder,
        remaining: MAX_DECOMPRESSED_STREAM_BYTES,
    };

    Ok(Archive::new(limited))
}

pub fn unpack_state_slice(state: &[u8]) -> Result<Vec<u8>, DecompressError> {
    let total_len = state.len() as u64;
    let mut cursor = Cursor::new(state);

    // Read 8-byte length prefix
    let mut len_buf = [0u8; 8];
    cursor.read_exact(&mut len_buf).map_err(|_| DecompressError::Truncated)?;
    let reported_size = u64::from_le_bytes(len_buf);

    // Hard ceiling check
    if reported_size > 1024 * 1024 {
        return Err(DecompressError::PayloadTooLarge);
    }

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:34:52.051Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795858492051",
    "title": "Bounded Streaming Decompression Memory Allocation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet-freenet-core-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ff22931a5df53c5d25ad6152698d03671189efc762d6047ec74b730bd96a8c6a"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-28T09:34:52.051Z"
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
  "auth_token": "1737edfdeb75c18f7b864d4aeecef25662de41b72aff2aef39ec9c6a7e8c0baa"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
