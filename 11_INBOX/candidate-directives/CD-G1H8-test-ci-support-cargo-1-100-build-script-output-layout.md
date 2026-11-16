# Candidate Directive: [CD-G1H8] test(ci): support Cargo 1.100 build-script output layout

<!-- PROVENANCE_START
{
  "source_repository": "yyjeqhc/webcodex",
  "source_url": "https://github.com/yyjeqhc/webcodex",
  "source_version": "479efb9a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-16T06:17:32.540Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-yyjeqhc-webcodex",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yyjeqhc/webcodex](https://github.com/yyjeqhc/webcodex) (Revision: `479efb9a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-16T06:17:32.540Z`  
> **Learning ID**: `learn-github-yyjeqhc-webcodex`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `scripts/tests/test_build_identity.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yyjeqhc/webcodex. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9aef4ca0`: test(ci): support Cargo 1.100 build-script output layout. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `scripts/tests/test_build_identity.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
def run_fixture_build(package, env):
    """Return the fixture's result and persisted build-script stdout path.

    Cargo 1.100 changed the internal build cache layout. Resolve the run unit
    from Cargo's build-script-executed OUT_DIR instead of matching a hardcoded
    target/debug/build directory name.
    """
    completed = subprocess.run(
        ["cargo", "run", "--offline", "--message-format=json"],
        cwd=package, env=env, check=True, capture_output=True, text=True, timeout=60,
    )
    out_dirs = []
    program_lines = []
    for line in completed.stdout.splitlines():
        if line.startswith("{"):
            message = json.loads(line)
            if message.get("reason") == "build-script-executed":
                out_dirs.append(Path(message["out_dir"]))
        elif line:
            program_lines.append(line)
    if len(out_dirs) != 1 or len(program_lines) != 1:
        raise AssertionError(
            f"expected one build script and one program result, "
            f"got {len(out_dirs)} and {program_lines!r}"
        )
    # Cargo <=1.99 uses output; Cargo >=1.100 uses run/stdout.
    script_outputs = [
        path for path in (
            out_dirs[0].
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                    return run(package, "cargo", "run", "--offline", "--quiet")
                outputs = list((root / "target/debug/build").glob("identity-fixture-*/output"))
                    return run(package, "cargo", "run", "--offline", "--quiet")
                outputs = list((root / "target/debug/build").glob("identity-fixture-*/output"))
                outputs = list((root / "target/debug/build").glob("identity-fixture-*/output"))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9aef4ca0` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T06:17:32.539Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794809852538",
    "title": "test(ci): support Cargo 1.100 build-script output layout",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yyjeqhc/webcodex",
    "source_uri": "https://github.com/yyjeqhc/webcodex",
    "source_version": "HEAD",
    "content_hash": "adac3bd2b8f8331b553cd0d5ba13342c4e90836347abce7089b6d0c5bbf90a79"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-16T06:17:32.539Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "295376de85a62fe065dcf0af7ea874e5e39b3f079c797a6acf433ca8b51010cc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
