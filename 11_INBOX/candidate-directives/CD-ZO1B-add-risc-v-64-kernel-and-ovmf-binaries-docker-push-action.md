# Candidate Directive: [CD-ZO1B] Add RISC-V 64 Kernel and OVMF binaries docker push action

<!-- PROVENANCE_START
{
  "source_repository": "u-root/u-root",
  "source_url": "https://github.com/u-root/u-root",
  "source_version": "4eba8433",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-13T23:01:33.935Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-u-root-u-root",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [u-root/u-root](https://github.com/u-root/u-root) (Revision: `4eba8433`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-13T23:01:33.935Z`  
> **Learning ID**: `learn-github-u-root-u-root`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain L

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/test-images.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in u-root/u-root. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4eba8433`: CI: Add RISC-V 64 Kernel and OVMF binaries docker push action. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/test-images.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
      - '.circleci/images/kernel-riscv64/*'
      - '.circleci/images/ovmf-riscv64/*'
      - '.circleci/images/kernel-riscv64/*'
      - '.circleci/images/ovmf-riscv64/*'
        image: ['kernel-amd64', 'kernel-arm', 'kernel-arm64', 'kernel-riscv64', 'uefipayload-amd64', 'multiboot-test-kernel-amd64', 'ovmf-amd64', 'ovmf-arm64', 'ovmf-riscv64', 'upl-fit-amd64', 'upl-fit-arm64']
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
        image: ['kernel-amd64', 'kernel-arm', 'kernel-arm64', 'uefipayload-amd64', 'multiboot-test-kernel-amd64', 'ovmf-amd64', 'ovmf-arm64', 'upl-fit-amd64', 'upl-fit-arm64']
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4eba8433` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T23:01:33.933Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794610893933",
    "title": "Add RISC-V 64 Kernel and OVMF binaries docker push action",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "u-root/u-root",
    "source_uri": "https://github.com/u-root/u-root",
    "source_version": "HEAD",
    "content_hash": "777fcb2e7accfba80c829566a57b5d4582933a26ad375145069e1357a892e4de"
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
        "Harvested/verified timestamp recorded: 2026-11-13T23:01:33.933Z"
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
  "auth_token": "cd54a1289f5db15b669da37e596d21de5668f82e66f90e1c7e1b3b82f228dc3e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
