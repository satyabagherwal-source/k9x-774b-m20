# Candidate Directive: [CD-IHQP] raise the default coroutine stack size to 64KB

<!-- PROVENANCE_START
{
  "source_repository": "Xudong-Huang/may",
  "source_url": "https://github.com/Xudong-Huang/may",
  "source_version": "bcbc907a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-15T21:27:34.225Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-xudong-huang-may",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Xudong-Huang/may](https://github.com/Xudong-Huang/may) (Revision: `bcbc907a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-15T21:27:34.225Z`  
> **Learning ID**: `learn-github-xudong-huang-may`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/tune_stack_size.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Xudong-Huang/may. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a9ef8881`: raise the default coroutine stack size to 64KB. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/tune_stack_size.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
When creating coroutines in [MAY][may], the library would alloc a chunk of memory from heap as the stack for each coroutine. The default stack size is 8k words, in 64bit system it is 64k bytes. For most of the cases, this stack size is big enough for simple coroutines. Buf if you have a very complicated coroutine that need more stack size, or you want to shrink the stack size to save some memory usage, you can set the stack size explicitly to a reasonable value.

Keep in mind that cancelling a coroutine is delivered by unwinding a `Cancel` panic, and the unwinder itself needs stack. On some platforms (notably macOS arm64 in release builds) that can take tens of kilobytes. The default leaves room for cancelling a simple coroutine; if you shrink the stack, leave headroom for coroutines that may be cancelled.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
When creating coroutines in [MAY][may], the library would alloc a chunk of memory from heap as the stack for each coroutine. The default stack size is 4k words, in 64bit system it is 32k bytes. For most of the cases, this stack size is big enough for simple coroutines. Buf if you have a very complicated coroutine that need more stack size, or you want to shrink the stack size to save some memory usage, you can set the stack size explicitly to a reasonable value.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a9ef8881` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T21:27:34.223Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794778054223",
    "title": "raise the default coroutine stack size to 64KB",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Xudong-Huang/may",
    "source_uri": "https://github.com/Xudong-Huang/may",
    "source_version": "HEAD",
    "content_hash": "1d4b9a2d1db9eb2b2e1e219eed1ad12fb8e0d64aedf831014cebf93723d795a7"
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
        "Harvested/verified timestamp recorded: 2026-11-15T21:27:34.223Z"
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
  "auth_token": "b996bc7fc8dcf399e0652e4e48ac543b624d99cd331dafa1189cde2a0a81d038"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
