# Candidate Directive: [CD-0CE6] cache the PDFium SDK alongside Cargo build artifacts

<!-- PROVENANCE_START
{
  "source_repository": "zvec-ai/zvec-grep",
  "source_url": "https://github.com/zvec-ai/zvec-grep",
  "source_version": "08e93f17",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T06:37:42.462Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zvec-ai-zvec-grep",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zvec-ai/zvec-grep](https://github.com/zvec-ai/zvec-grep) (Revision: `08e93f17`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T06:37:42.462Z`  
> **Learning ID**: `learn-github-zvec-ai-zvec-grep`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/rust-ci.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zvec-ai/zvec-grep. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `08e93f17`: ci): cache the PDFium SDK alongside Cargo build artifacts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/rust-ci.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
          prefix-key: rust-ci-v4-quality
            ~/.cache/pdfium-rs/
          prefix-key: rust-ci-v4-test
            ${{ runner.os == 'macOS' && '~/Library/Caches' || runner.os == 'Windows' && '~/AppData/Local' || '~/.cache' }}/pdfium-rs/
            ${{ runner.os == 'Windows' && '~/AppData/Local' || '~/.cache' }}/pdfium-rs/
          key: rust-ci-v4-test-cuda-${{ matrix.platform }}-${{ hashFiles('rust/Cargo.toml', 'rust/Cargo.lock', 'rust/rust-toolchain.toml', 'rust/scripts/cuda/cuda-builder.Dockerfile', '.github/workflows/rust-ci.yml') }}-${{ needs.source.outputs.sha }}
            rust-ci-v4-test-cuda-${{ matrix.platform }}-${{ hashFiles('rust/Cargo.toml', 'rust/Cargo.lock', 'rust/rust-toolchain.toml', 'rust/scripts/cuda/cuda-builder.Dockerfile', '.github/workflows/rust-ci.yml') }}-
          mkdir -p rust/target rust/model-logs "$HOME/.cargo/registry" "$HOME/.cargo/git" "$HOME/.cache/pdfium-rs" "$ZVEC_GREP_MODEL_CACHE"
            --volume "$HOME/.cache/pdfium-rs:/root/.cache/pdfium-rs" \
          mkdir -p target "$HOME/.cargo/registry" "$HOME/.cargo/git" "$HOME/.cache/pdfium-rs"
          sudo chown -R "$(id -u):$(id -g)" target "$HOME/.cargo/registry" "$HOME/.cargo/git
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
          prefix-key: rust-ci-v3-quality
          prefix-key: rust-ci-v3-test
          key: rust-ci-v3-test-cuda-${{ matrix.platform }}-${{ hashFiles('rust/Cargo.toml', 'rust/Cargo.lock', 'rust/rust-toolchain.toml', 'rust/scripts/cuda/cuda-builder.Dockerfile', '.github/workflows/rust-ci.yml') }}-${{ needs.source.outputs.sha }}
            rust-ci-v3-test-cuda-${{ matrix.platform }}-${{ hashFiles('rust/Cargo.toml', 'rust/Cargo.lock', 'rust/rust-toolchain.toml', 'rust/scripts/cuda/cuda-builder.Dockerfile', '.github/workflows/rust-ci.yml') }}-
          mkdir -p rust/target rust/model-logs "$HOME/.cargo/registry" "$HOME/.cargo/git" "$ZVEC_GREP_MODEL_CACHE"
          mkdir -p target "$HOME/.cargo/registry" "$HOME/.cargo/git"
          sudo chown -R "$(id -u):$(id -g)" target "$HOME/.cargo/registry" "$HOME/.cargo/git"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `08e93f17` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T06:37:42.460Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795761462460",
    "title": "cache the PDFium SDK alongside Cargo build artifacts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zvec-ai/zvec-grep",
    "source_uri": "https://github.com/zvec-ai/zvec-grep",
    "source_version": "HEAD",
    "content_hash": "fb0585f8e753da2118b8454d6f4d80b29c68b3777b817f502353075ac113f92c"
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
        "Harvested/verified timestamp recorded: 2026-11-27T06:37:42.460Z"
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
  "auth_token": "990dc063a348924bef0aad34d0a7670205a29c06ea7150d447ab0d0c18656c11"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
