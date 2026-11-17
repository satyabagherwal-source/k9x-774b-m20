# Candidate Directive: [CD-8EMJ] ci: test against CUDA 13.5.0 as well as the baseline toolkit

<!-- PROVENANCE_START
{
  "source_repository": "nvidia-cuda-rust-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T10:11:13.188Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-nvidia-cuda-rust-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nvidia-cuda-rust-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T10:11:13.188Z`  
> **Learning ID**: `LEARN-EVO-nvidia-cuda-rust-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T10:11:13.286Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794910273286",
    "title": "ci: test against CUDA 13.5.0 as well as the baseline toolkit",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nvidia-cuda-rust-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "617739c5fe22029fd83ec1648dd25748d1cdc7cfe7574f78550651e9e06ed448"
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
        "Harvested/verified timestamp recorded: 2026-11-17T10:11:13.287Z"
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
  "auth_token": "4cf1ffd881440198ca34911d277e23cd80f44c8dc0fa8d354a0f0d3229c3c7aa"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
