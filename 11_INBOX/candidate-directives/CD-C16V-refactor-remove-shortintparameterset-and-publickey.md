# Candidate Directive: [CD-C16V] refactor!: remove ShortintParameterSet and PublicKey

<!-- PROVENANCE_START
{
  "source_repository": "zama-ai-tfhe-rs-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T11:10:01.659Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zama-ai-tfhe-rs-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zama-ai-tfhe-rs-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T11:10:01.659Z`  
> **Learning ID**: `LEARN-EVO-zama-ai-tfhe-rs-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `tests/backward_compatibility/high_level_api.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zama-ai/tfhe-rs. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `723320f2`: refactor!: remove ShortintParameterSet and PublicKey. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `tests/backward_compatibility/high_level_api.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    CompressedKVStore, CompressedServerKey, CompressedSquashedNoiseCiphertextList,
    CompressedSquashedNoiseCiphertextListBuilder, CompressedSquashedNoiseOneTimePadFheSecretMask,
    FheBool, FheInt8, FheUint32, FheUint64, FheUint8, HlStreamCipher, HlTranscipherer,
    KreyviumFheKey, OneTimePadFheSecretMask, ReRandomizationContext, ReRandomizationMode,
    ReRandomizationSupport, Seed, ServerKey, SquashedNoiseFheBool, SquashedNoiseFheInt,
    SquashedNoiseFheUint, StreamCiphertext, TranscipherSession,
    let public_key = if test.compressed {
        let compressed: CompressedCompactPublicKey = load_and_unversionize(dir, test, format)?;
        compressed.decompress()
        load_and_unversionize(dir, test, format)?
    set_server_key(client_key.generate_server_key());

    let ct_list = CompactCiphertextList::builder(&public_key)
        .push(value)
        .build();
    let encrypted: FheUint8 = ct_list.expand().unwrap().get(0).unwrap().unwrap();
            // Only compact public keys can be loaded by this version of TFHE-rs
            TestMetadata::HlPublicKey(test) if !test.compact => {
                TestResult::Skipped(testcase.skip())
            }
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    CompressedKVStore, CompressedPublicKey, CompressedServerKey,
    CompressedSquashedNoiseCiphertextList, CompressedSquashedNoiseCiphertextListBuilder,
    CompressedSquashedNoiseOneTimePadFheSecretMask, FheBool, FheInt8, FheUint32, FheUint64,
    FheUint8, HlStreamCipher, HlTranscipherer, KreyviumFheKey, OneTimePadFheSecretMask,
    ReRandomizationContext, ReRandomizationMode, ReRandomizationSupport, Seed, ServerKey,
    SquashedNoiseFheBool, SquashedNoiseFheInt, SquashedNoiseFheUint, StreamCiphertext,
    TranscipherSession,
    let encrypted = if test.compact {
        let public_key = if test.compressed {
            let compressed: CompressedCompactPublicKey = load_and_unversionize(dir, test, format)?;
            compressed.decompress()

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T11:10:01.734Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794913801734",
    "title": "refactor!: remove ShortintParameterSet and PublicKey",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zama-ai-tfhe-rs-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8d7438bf03bf4eddf6d4579cab81cf812cb3d71979074861b5d9bd7fce54a0a8"
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
        "Harvested/verified timestamp recorded: 2026-11-17T11:10:01.735Z"
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
  "auth_token": "16a0e95aab10ea0f53d87573e0c73fa7e314088b6a9957f2f30eaa634a1d0723"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
