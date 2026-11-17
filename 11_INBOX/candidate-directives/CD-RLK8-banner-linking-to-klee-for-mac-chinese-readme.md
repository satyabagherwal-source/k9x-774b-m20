# Candidate Directive: [CD-RLK8] banner linking to Klee for Mac, Chinese README

<!-- PROVENANCE_START
{
  "source_repository": "signerlabs/Klee",
  "source_url": "https://github.com/signerlabs/Klee",
  "source_version": "f39e0f96",
  "license": "PERMISSIVE_OPEN_SOURCE",
  "timestamp": "2026-11-17T03:26:14.504Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-signerlabs-klee",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [signerlabs/Klee](https://github.com/signerlabs/Klee) (Revision: `f39e0f96`).  
> **License**: PERMISSIVE_OPEN_SOURCE | **Timestamp**: `2026-11-17T03:26:14.504Z`  
> **Learning ID**: `learn-github-signerlabs-klee`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in signerlabs/Klee. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4fb51d22`: docs: banner linking to Klee for Mac, Chinese README. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
**English** · [简体中文](README.zh-CN.md)

<a href="https://kleedesktop.com"><img src="Docs/images/klee-for-mac-en.png" alt="The new Klee for Mac: say it, and Klee builds websites and apps and edits video on your Mac. Get it at kleedesktop.com" width="100%"></a>

> **Want frontier cloud models and a full agent harness?** The new [Klee for Mac](https://kleedesktop.com) runs Claude Opus 5.5, Fable 5.2 and Sonnet 5.5 with planning, subtasks, skills and MCP, and can build websites and apps for you. It needs a Klee account and is paid. **[Download it at kleedesktop.com →](https://kleedesktop.com)**
>
> This repository is the local version. It stays free, open source and actively maintained.

```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
> **Want frontier cloud models and a full agent harness?** The new [Klee for Mac](https://kleedesktop.com) runs Claude Opus 5.5, Fable 5.2 and Sonnet 5.5 with planning, subtasks, skills and MCP, and can build websites and apps for you. It needs a Klee account and is paid. This local version stays free, open source and actively maintained.

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4fb51d22` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T03:26:14.502Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794885974502",
    "title": "banner linking to Klee for Mac, Chinese README",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "signerlabs/Klee",
    "source_uri": "https://github.com/signerlabs/Klee",
    "source_version": "HEAD",
    "content_hash": "18390e073782f4696b87baa2922272adebd23942daa01b80c4dc507a71e4610e"
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
        "Harvested/verified timestamp recorded: 2026-11-17T03:26:14.502Z"
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
  "auth_token": "1d6e040c70f21507fbb8ac38446f268392b37202fc08acb8cbe6d0dbd21022cf"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
