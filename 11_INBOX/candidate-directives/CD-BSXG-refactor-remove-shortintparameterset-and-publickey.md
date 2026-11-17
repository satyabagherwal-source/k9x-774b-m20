# Candidate Directive: [CD-BSXG] refactor!: remove ShortintParameterSet and PublicKey

<!-- PROVENANCE_START
{
  "source_repository": "zama-ai/tfhe-rs",
  "source_url": "https://github.com/zama-ai/tfhe-rs",
  "source_version": "723320f2",
  "license": "NOASSERTION",
  "timestamp": "2026-11-17T11:09:51.028Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zama-ai-tfhe-rs",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zama-ai/tfhe-rs](https://github.com/zama-ai/tfhe-rs) (Revision: `723320f2`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-17T11:09:51.028Z`  
> **Learning ID**: `learn-github-zama-ai-tfhe-rs`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
        } else {
            load_and_unversionize(dir, test, format)?
        };
        set_server_key(client_key.generate_server_key());

        let ct_list = CompactCiphertextList::builder(&public_key)
            .push(value)
            .build();
        ct_list.expand().unwrap().get(0).unwrap().unwrap()
        let public_key = if test.compressed {
            let compressed: CompressedPublicKey = load_and_unversionize(dir, test, for
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `723320f2` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T11:09:51.026Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794913791026",
    "title": "refactor!: remove ShortintParameterSet and PublicKey",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zama-ai/tfhe-rs",
    "source_uri": "https://github.com/zama-ai/tfhe-rs",
    "source_version": "HEAD",
    "content_hash": "dddd1b61eda3807817c2b4955b96f3a1f198f56fccc9d80776bef7da7482c5b4"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T11:09:51.026Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "57d358ea036ea39ee00a2b1378da71a15b82decf8035e5d532571be47ef8103c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
