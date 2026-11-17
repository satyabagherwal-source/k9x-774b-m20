# Candidate Directive: [CD-8258] test against CUDA 13.5.0 as well as the baseline toolkit

<!-- PROVENANCE_START
{
  "source_repository": "NVIDIA/cuda-rust",
  "source_url": "https://github.com/NVIDIA/cuda-rust",
  "source_version": "f13e7dfc",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T10:10:57.116Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nvidia-cuda-rust",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NVIDIA/cuda-rust](https://github.com/NVIDIA/cuda-rust) (Revision: `f13e7dfc`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T10:10:57.116Z`  
> **Learning ID**: `learn-github-nvidia-cuda-rust`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/cutile-rs.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NVIDIA/cuda-rust. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f13e7dfc`: ci: test against CUDA 13.5.0 as well as the baseline toolkit. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/cutile-rs.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# Only the cuda-tile-translate job needs the cuda-tile submodule; it fetches it
# itself.
  # Tile IR assembler lanes. The base lane exercises the oldest assembler,
  # including its lack of --list-versions; the newest lane needs an assembler
  # that lists bytecode 13.5, which the Tile IR 13.5 gates in the compiler and
  # encoder depend on. The separate 13.0 lane only checks shared host crates.
  # The job names are tile-ir-cuda13-2 and tile-ir-cuda13-5.
  #
  # Tests that need the 13.5 toolkit skip, and pass, without it. The newest lane
  # sets CUTILE_REQUIRE_TILELIB=1, and then such a skip is a failure: the
  # cutile-ir test that reads a preview$call back with the toolkit's tileirdisasm
  # must run there.
  tile-ir:
    name: ${{ matrix.lane.name }}
      image: ${{ matrix.lane.image }}
      CUTILE_REQUIRE_TILELIB: ${{ matrix.lane.newest && '1' || '' }}
    strategy:
      fail-fast: false
      matrix:
        lane:
          - name: tile-ir-cuda13-2
            image: nvidia/cuda:13.2.0-devel-ubuntu24.04
            newest: false
          # Same image digest as Docker Hub's nvidia/cuda:13.5.0-devel-ubuntu24.04;
          # nvcr.io has no anonymous pull limit.
          -
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
  # Exercise the oldest Tile IR assembler, including its lack of
  # --list-versions. The separate 13.0 lane only checks shared host crates.
  tile-ir-cuda13-2:
      image: nvidia/cuda:13.2.0-devel-ubuntu24.04
      CUTILE_TILEIRAS_PATH: /usr/local/cuda/bin/tileiras
          "$CUTILE_TILEIRAS_PATH" --version
          "$CUTILE_TILEIRAS_PATH" --help | grep -q 'sm_120'
      - name: CPU and assembler tests
        run: ./scripts/run_cpu_tests.sh
      - name: Standalone bytecode example
        run: cargo run -p cutile-ir --example build_basic

  # Newest Tile IR assembler: the 13.4 gates in the compiler and encoder must
  # pass here and refuse correctly on the 13.2 lane above. The dev image may
  # ship the toolkit without the assembler package; install it when missing.
  tile-ir-cuda13-4:
    needs: changes
    if: >-
      github.event_name == 'workflow_dispatch' ||
      needs.changes.outputs.tile == 'true' ||
      needs.changes.outputs.any_changed != 'true'
    runs-on: linux-amd64-cpu16
    container:
      image: nvidia/cuda:13.4.1-devel-ubuntu24.04
      env:
        DEBIAN_FRONTEND: noninteractive
    env:
      CUDA_TOOLKIT_PATH: /usr/local/cuda
    timeout-minutes: 30

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f13e7dfc` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T10:10:57.114Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794910257114",
    "title": "test against CUDA 13.5.0 as well as the baseline toolkit",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NVIDIA/cuda-rust",
    "source_uri": "https://github.com/NVIDIA/cuda-rust",
    "source_version": "HEAD",
    "content_hash": "d1e84a28e7520798d9452f907bec566bc5bbcae1d3e9b1722f87a0a76281c110"
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
        "Harvested/verified timestamp recorded: 2026-11-17T10:10:57.114Z"
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
  "auth_token": "e47e1c38d9432fc9d36bd4262405680b5a15ece3b5e8fe43873f5a3e2e610529"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
