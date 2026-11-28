# Candidate Directive: [CD-MUPV] Bounded Streaming Decompression Memory Allocation

<!-- PROVENANCE_START
{
  "source_repository": "freenet/freenet-core",
  "source_url": "https://github.com/freenet/freenet-core",
  "source_version": "eb8f4fc3",
  "license": "NOASSERTION",
  "timestamp": "2026-11-28T09:30:50.755Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-freenet-freenet-core",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet/freenet-core](https://github.com/freenet/freenet-core) (Revision: `eb8f4fc3`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-28T09:30:50.755Z`  
> **Learning ID**: `learn-github-freenet-freenet-core`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

    // Verify remaining bytes before allocation (PREVENT TOCTOU / OOM VIA ZERO-BYTES ALLOCATION)
    let remaining = total_len.saturating_sub(cursor.position());
    if reported_size > remaining {
        return Err(DecompressError::TruncatedPayload {
            claimed: reported_size,
            actual: remaining,
        });
    }

    let mut payload = vec![0u8; reported_size as usize];
    cursor.read_exact(&mut payload).map_err(|_| DecompressError::Truncated)?;
    Ok(payload)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER initialize XzDecoder without an explicit memory limit
let decoder = XzDecoder::new(untrusted_slice); // CRASH HAZARD: Attacker LZMA2 dict_prop 0x26 requests 2 GiB heap!

// NEVER allocate a Vec based directly on an untrusted header tag
let reported_size = cursor.read_u64::<LittleEndian>()?;
let mut buffer = vec![0; reported_size as usize]; // CRASH HAZARD: If slice only has 8 bytes, attacker allocates 4 GB!
cursor.read_exact(&mut buffer)?;
```

**VERIFICATION METHOD**:
Run unit tests passing synthetic streams with malicious LZMA2 `dict_prop` values (e.g., `0x20` for 256 MiB or `0x26` for 2 GiB) against `decode_untrusted_archive`. Assert that the function returns an `UnpackingError` immediately upon stream creation without allocating memory beyond `MAX_XZ_DECODER_MEM_BYTES`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:30:50.752Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795858250752",
    "title": "Bounded Streaming Decompression Memory Allocation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet/freenet-core",
    "source_uri": "https://github.com/freenet/freenet-core",
    "source_version": "HEAD",
    "content_hash": "4fe8edb4df5860932d8150b4b811a8e915245c9762646b4a24787878df450638"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-28T09:30:50.752Z"
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
  "auth_token": "46c8afc4ca2cc5b16b5e99b8851f70e57bc2588478a96f7455c8e045fd840ca7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
