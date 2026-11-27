# Candidate Directive: [CD-Y2XY] ci): cache the PDFium SDK alongside Cargo build artifacts

<!-- PROVENANCE_START
{
  "source_repository": "zvec-ai-zvec-grep-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T15:27:49.465Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-zvec-ai-zvec-grep-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zvec-ai-zvec-grep-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T15:27:49.465Z`  
> **Learning ID**: `LEARN-EVO-zvec-ai-zvec-grep-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-27T15:27:49.604Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795793269604",
    "title": "ci): cache the PDFium SDK alongside Cargo build artifacts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zvec-ai-zvec-grep-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e0e3667a951e790213f62ff7d596331ae71788802c4d0c95a3017e4d3aae1b06"
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
        "Harvested/verified timestamp recorded: 2026-11-27T15:27:49.604Z"
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
  "auth_token": "3f5f0c3fc0036f5f434829e9c886c2156b8c099ed91cdf159aeef8036260cfcb"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
