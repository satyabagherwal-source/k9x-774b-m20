# Candidate Directive: [CD-EDIM] handle out-of-range and negative scalars in scalar max and min

<!-- PROVENANCE_START
{
  "source_repository": "zama-ai/tfhe-rs",
  "source_url": "https://github.com/zama-ai/tfhe-rs",
  "source_version": "f8710f06",
  "license": "NOASSERTION",
  "timestamp": "2026-11-20T11:30:51.502Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zama-ai-tfhe-rs",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zama-ai/tfhe-rs](https://github.com/zama-ai/tfhe-rs) (Revision: `f8710f06`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-20T11:30:51.502Z`  
> **Learning ID**: `learn-github-zama-ai-tfhe-rs`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `tfhe/src/integer/gpu/server_key/radix/scalar_comparison.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zama-ai/tfhe-rs. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f8710f06`: gpu): handle out-of-range and negative scalars in scalar max and min. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `tfhe/src/integer/gpu/server_key/radix/scalar_comparison.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
enum ScalarDispatch<T> {
    OutOfBounds(std::cmp::Ordering),
    NegativeInRange(T),
    Backend,
}

    fn dispatch_scalar<Scalar, T>(
        &self,
        ct: &T,
        scalar: Scalar,
        streams: &CudaStreams,
    ) -> ScalarDispatch<T>
    where
        T: CudaIntegerRadixCiphertext,
        Scalar: DecomposableInto<u64>,
    {
        if let Some(ordering) = self.is_scalar_out_of_bounds(ct, scalar) {
            return ScalarDispatch::OutOfBounds(ordering);
        }
        // The backend takes a non-negative scalar. A negative scalar in range (signed ciphertexts
        // only) is used as a trivial ciphertext.
        if scalar < Scalar::ZERO {
            let num_blocks = ct.as_ref().d_blocks.lwe_ciphertext_count().0;
            let scalar_as_trivial =
                unsafe { self.create_trivial_radix_async(scalar, num_blocks, streams) };
            return ScalarDispatch::NegativeInRange(scalar_as_trivial);
        }
        ScalarDispatch::Backend
    }

            match self.dispatch_scalar(ct, scalar, streams) {
                ScalarDispatch::OutOfBounds(std::cmp::Ordering::Greater) => {
                    CudaBooleanBlock::from_cuda_radix_ciphertext(res
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            match self.is_scalar_out_of_bounds(ct, scalar) {
                Some(std::cmp::Ordering::Greater) => {
                    return CudaBooleanBlock::from_cuda_radix_ciphertext(result.into_inner());
                Some(std::cmp::Ordering::Less) => {
                    return CudaBooleanBlock::from_cuda_radix_ciphertext(result.into_inner());
                Some(std::cmp::Ordering::Equal) => unreachable!("Internal error: invalid value"),
                None => {
                    // scalar is in range, fallthrough
            }

            if scalar >= Scalar::ZERO {
                self.unchecked_signed_and_unsigned_scalar_comparison(ct, scalar, op, true, streams)
            } else {
                let scalar_as_trivial = self.create_trivial_radix(scalar, num_blocks, streams);
                self.unchecked_comparison(ct, &scalar_as_trivial, op, streams)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f8710f06` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T11:30:51.500Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795174251500",
    "title": "handle out-of-range and negative scalars in scalar max and min",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zama-ai/tfhe-rs",
    "source_uri": "https://github.com/zama-ai/tfhe-rs",
    "source_version": "HEAD",
    "content_hash": "3be54b6abf4af185e57faf7a81ab5624ee50fb212d816fd5e69ae8d6f1da064f"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T11:30:51.500Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "b3310c3b1c744a203564c20815eeef9f1600b8a99e288f58b03b80029825e83f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
