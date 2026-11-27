# Candidate Directive: [CD-WKCG] [RED-224927] Fix building from source on macOS when other Redis modules install

<!-- PROVENANCE_START
{
  "source_repository": "RediSearch/RediSearch",
  "source_url": "https://github.com/RediSearch/RediSearch",
  "source_version": "078550d7",
  "license": "NOASSERTION",
  "timestamp": "2026-11-27T07:30:45.376Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-redisearch-redisearch",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [RediSearch/RediSearch](https://github.com/RediSearch/RediSearch) (Revision: `078550d7`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-27T07:30:45.376Z`  
> **Learning ID**: `learn-github-redisearch-redisearch`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `build.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RediSearch/RediSearch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ff955074`: [RED-224927] Fix building from source on macOS when other Redis modules install an older LLVM. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `build.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#-----------------------------------------------------------------------------
# Function: select_macos_compilers
# Set MACOS_C_COMPILER/MACOS_CXX_COMPILER to clang/clang++ from PATH when that
# is Apple clang or LLVM_VERSION. Otherwise use the LLVM that
# .install/install_llvm.sh installs, and export LIBCLANG_PATH so bindgen loads
# the same LLVM's libclang; fall back to PATH if that LLVM is not installed.
#
# PATH can hold the wrong LLVM: when Redis bootstraps several modules into one
# environment, modules bootstrapped after this one put an older Homebrew LLVM
# ahead of ours, and that LLVM's libc++ lacks C++20 features SVS uses. Apple
# clang is kept because Homebrew's packages of Redis build with it.
#-----------------------------------------------------------------------------
select_macos_compilers() {
  local LLVM_VERSION LLVM_FULL_VERSION
  source "$ROOT/.install/LLVM_VERSION.sh"

  MACOS_C_COMPILER=clang
  MACOS_CXX_COMPILER=clang++
  local path_banner
  path_banner=$({ clang --version 2>/dev/null || true; } | head -n1)
  if [[ "$path_banner" == "Apple clang"* || \
        "$(clang_major_version clang)" == "$LLVM_VERSION" ]]; then
    return
  fi

  # Same locations, in t
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    CMAKE_BASIC_ARGS="$CMAKE_BASIC_ARGS -DCMAKE_C_COMPILER=clang -DCMAKE_CXX_COMPILER=clang++"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ff955074` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T07:30:45.375Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795764645375",
    "title": "[RED-224927] Fix building from source on macOS when other Redis modules install",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "RediSearch/RediSearch",
    "source_uri": "https://github.com/RediSearch/RediSearch",
    "source_version": "HEAD",
    "content_hash": "549d6b17a5b904e33cdeda8e0ab76fca7dc21a8abb22a2f1024c0278d2e07c11"
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
        "Harvested/verified timestamp recorded: 2026-11-27T07:30:45.375Z"
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
  "auth_token": "a3243f4ef4fbec4d853ae2560b5e996e25b186eb2797fe22d764eadb8ecd5e87"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
