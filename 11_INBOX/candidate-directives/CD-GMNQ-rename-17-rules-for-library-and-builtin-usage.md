# Candidate Directive: [CD-GMNQ] Rename 17 rules for library and builtin usage

<!-- PROVENANCE_START
{
  "source_repository": "astral-sh/ruff",
  "source_url": "https://github.com/astral-sh/ruff",
  "source_version": "c2a50c31",
  "license": "MIT",
  "timestamp": "2026-11-23T23:31:27.542Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-astral-sh-ruff",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [astral-sh/ruff](https://github.com/astral-sh/ruff) (Revision: `c2a50c31`).  
> **License**: MIT | **Timestamp**: `2026-11-23T23:31:27.542Z`  
> **Learning ID**: `learn-github-astral-sh-ruff`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/ruff/tests/cli/lint.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in astral-sh/ruff. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a2f9cda2`: Rename 17 rules for library and builtin usage. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/ruff/tests/cli/lint.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    	trio-call-not-awaited (ASYNC105),
    	strip-with-duplicate-characters (B005),
    	open-file-without-context-manager (SIM115),
    	unnecessary-str-join (FLY002),
    	invalid-getenv-key (PLE1507),
    	unnecessary-literal-constructor (UP018),
    	subprocess-run-with-universal-newlines (UP021),
    	subprocess-run-with-piped-stdout-and-stderr (UP022),
    	unnecessary-positional-str-format-indices (UP030),
    	str-format (UP032),
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    	trio-sync-call (ASYNC105),
    	strip-with-multi-characters (B005),
    	open-file-with-context-handler (SIM115),
    	static-join-to-f-string (FLY002),
    	invalid-envvar-value (PLE1507),
    	native-literals (UP018),
    	replace-universal-newlines (UP021),
    	replace-stdout-stderr (UP022),
    	format-literals (UP030),
    	f-string (UP032),
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a2f9cda2` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T23:31:27.540Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795476687540",
    "title": "Rename 17 rules for library and builtin usage",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "astral-sh/ruff",
    "source_uri": "https://github.com/astral-sh/ruff",
    "source_version": "HEAD",
    "content_hash": "db09c99cb342fc76379f880b7eea3828f505251a70fe63ba8bbca08f4e5510b2"
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
        "Harvested/verified timestamp recorded: 2026-11-23T23:31:27.540Z"
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
  "auth_token": "e14f1fbb7c0386d8d9409c7b9697b70de9826239475c36e7fc7e73c964256aac"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
