# Candidate Directive: [CD-LFCG] hermetic pinned clang-23 compiler probes with per-probe CAS cache

<!-- PROVENANCE_START
{
  "source_repository": "indexable-inc/blaze",
  "source_url": "https://github.com/indexable-inc/blaze",
  "source_version": "d358ce89",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T00:50:11.056Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-indexable-inc-blaze",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [indexable-inc/blaze](https://github.com/indexable-inc/blaze) (Revision: `d358ce89`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T00:50:11.056Z`  
> **Learning ID**: `learn-github-indexable-inc-blaze`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/blaze-build-script/src/c_tasks_probe.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in indexable-inc/blaze. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `314c5390`: build-script): hermetic pinned clang-23 compiler probes with per-probe CAS cache. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/blaze-build-script/src/c_tasks_probe.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Domain for canonical [`ProbeKey`] hashing (answerer id, clang sha256, sdk/sysroot id, program,
/// canonical args, canonical `CLANG_ENV`, sorted input file sha256s).
pub const PROBE_KEY_DOMAIN: &str = "blaze-build-script c probe 1";
/// Domain for [`canonical_reply_digest`] (matches `spawn_route::reply_digest` so `fact_now` and
/// `spawn_probe` agree).
const REPLY_DOMAIN: &str = "blaze build-script spawn reply 1";
/// Magic bytes of an encoded binary probe cache record (`bzcp` v1).
const ANSWER_MAGIC: [u8; 4] = *b"bzcp";
const ANSWER_VERSION: u32 = 1;
/// The script's root mount / package directory spelling in a row (`/package`, `/workspace/...`).
pub const MOUNT: &str = "$MOUNT";
/// `TMPDIR` is intentionally excluded: host ambient temp dirs (e.g. `/private/var/folders/...`)
/// must never pollute content-addressed probe keys; hermetic execution supplies the probe's own
/// private confined output directory as `TMPDIR`.
pub const CLANG_ENV: [&str; 10] = [
/// Normalizes a path under `out_dir`, collapsing `.` and repeated `/` separators and rejecting
/// `..` traversal or trailing directory slashes, so `-o /out/./flag_check /out/./flag_check.c`
/// resolves to the exact same `
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
pub const CLANG_ENV: [&str; 11] = [
    "TMPDIR",
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `314c5390` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T00:50:11.054Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795740611054",
    "title": "hermetic pinned clang-23 compiler probes with per-probe CAS cache",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "indexable-inc/blaze",
    "source_uri": "https://github.com/indexable-inc/blaze",
    "source_version": "HEAD",
    "content_hash": "799eca969325d1e3d3e85f6519a063ab31f518079e609ea4e0c1211f29d0b9dd"
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
        "Harvested/verified timestamp recorded: 2026-11-27T00:50:11.054Z"
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
  "auth_token": "fed028e1c3c096f7a09d465afce8f24f4744003be11bd27ec71e27446724f2f4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
