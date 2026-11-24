# Candidate Directive: [CD-R04U] server): bound RDB loader allocations by the source size

<!-- PROVENANCE_START
{
  "source_repository": "dragonflydb-dragonfly-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T17:23:16.840Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dragonflydb-dragonfly-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dragonflydb-dragonfly-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T17:23:16.840Z`  
> **Learning ID**: `LEARN-EVO-dragonflydb-dragonfly-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T17:23:16.973Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795540996973",
    "title": "server): bound RDB loader allocations by the source size",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dragonflydb-dragonfly-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b5274500328d84c7e141a4b0e476882095151b12ad9886e10ee98e5ab9d58150"
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
        "Harvested/verified timestamp recorded: 2026-11-24T17:23:16.973Z"
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
  "auth_token": "625fd27ef55ba6115670f8998656ffa6819341bc15b81e05b06282369aeb3545"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
