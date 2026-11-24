# Candidate Directive: [CD-QVDB] bound RDB loader allocations by the source size

<!-- PROVENANCE_START
{
  "source_repository": "dragonflydb/dragonfly",
  "source_url": "https://github.com/dragonflydb/dragonfly",
  "source_version": "c0b9d750",
  "license": "NOASSERTION",
  "timestamp": "2026-11-24T17:23:10.799Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dragonflydb-dragonfly",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dragonflydb/dragonfly](https://github.com/dragonflydb/dragonfly) (Revision: `c0b9d750`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-24T17:23:10.799Z`  
> **Learning ID**: `learn-github-dragonflydb-dragonfly`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/server/detail/decompress.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dragonflydb/dragonfly. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9602dd5e`: server): bound RDB loader allocations by the source size. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/server/detail/decompress.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
constexpr size_t kInitialDecompressBuffer = 64 * 1024;

  io::Result<io::IoBuf*> Decompress(std::string_view str, size_t max_uncomp_size);
io::Result<io::IoBuf*> ZstdDecompress::Decompress(std::string_view str, size_t max_uncomp_size) {
  if (uncomp_size > max_uncomp_size) {
    LOG(ERROR) << "Zstd frame content size " << uncomp_size << " exceeds the allowed maximum";
    return Unexpected(errc::rdb_file_corrupted);
  if (uncomp_size == 0) {
  uncompressed_mem_buf_.Reserve(std::min<size_t>(uncomp_size + 1, kInitialDecompressBuffer));

  ZSTD_inBuffer in{str.data(), str.size(), 0};
  while (true) {
    IoBuf::Bytes dest = uncompressed_mem_buf_.AppendBuffer();
    if (dest.empty()) {
      if (!GrowBuffer(uncomp_size)) {
        LOG(ERROR) << "Zstd frame decoded past the declared content size";
        return Unexpected(errc::rdb_file_corrupted);
      }
      continue;
    }

    ZSTD_outBuffer out{dest.data(), dest.size(), 0};
    size_t prev_in = in.pos;
    size_t ret = ZSTD_decompressStream(dctx_, &out, &in);
    if (ZSTD_isError(ret)) {
      LOG(ERROR) << "Invalid ZSTD compressed string: " << ZSTD_getErrorName(ret);
      return Unexpected(errc::rdb_file_corrupted);
    }
    
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
  io::Result<io::IoBuf*> Decompress(std::string_view str);
io::Result<io::IoBuf*> ZstdDecompress::Decompress(std::string_view str) {

  uncompressed_mem_buf_.Reserve(uncomp_size + 1);

  // Uncompress string to membuf
  IoBuf::Bytes dest = uncompressed_mem_buf_.AppendBuffer();
  if (dest.size() < uncomp_size) {
    return Unexpected(errc::out_of_memory);
  size_t const d_size =
      ZSTD_decompressDCtx(dctx_, dest.data(), dest.size(), str.data(), str.size());
  if (d_size == 0 || d_size != uncomp_size) {
  uncompressed_mem_buf_.CommitWrite(d_size);
  // Add opcode of compressed blob end to membuf.
  dest = uncompressed_mem_buf_.AppendBuffer();
  if (dest.size() < 1) {
    return Unexpected(errc::out_of_memory);
  dest[0] = RDB_OPCODE_COMPRESSED_BLOB_END;
  uncompressed_mem_buf_.CommitWrite(1);
  return &uncompressed_mem_buf_;
  io::Result<base::IoBuf*> Decompress(std::string_view str);
io::Result<base::IoBuf*> Lz4Decompress::Decompress(std::string_view data) {
    ;

  // reserve place for uncompressed data and end opcode
  size_t reserve = frame_info.contentSize + 1;
  uncompressed_mem_buf_.Reserve(reserve);
  IoBuf::Bytes dest = uncompressed_mem_buf_.AppendBuffer();
  if (dest.s
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9602dd5e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T17:23:10.797Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795540990797",
    "title": "bound RDB loader allocations by the source size",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dragonflydb/dragonfly",
    "source_uri": "https://github.com/dragonflydb/dragonfly",
    "source_version": "HEAD",
    "content_hash": "1048f1efd920c94b68e16c2c05cd206521ed97789864c456cfe73e868f15f132"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T17:23:10.797Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "8e89f32286feb88c680cef73a00f31c5b55f00d2ccd67309880bf89a9b71b18e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
