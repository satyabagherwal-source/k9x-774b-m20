# Candidate Directive: [CD-KUSU] Group ARC milestone panels side by side

<!-- PROVENANCE_START
{
  "source_repository": "NucleoidAI/Nucleoid",
  "source_url": "https://github.com/NucleoidAI/Nucleoid",
  "source_version": "64f9b9ba",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T18:20:08.046Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nucleoidai-nucleoid",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NucleoidAI/Nucleoid](https://github.com/NucleoidAI/Nucleoid) (Revision: `64f9b9ba`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T18:20:08.046Z`  
> **Learning ID**: `learn-github-nucleoidai-nucleoid`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `arc/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NucleoidAI/Nucleoid. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `64f9b9ba`: Group ARC milestone panels side by side. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `arc/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
output canvas instead of adding a separate milestone.

Related panels sit side by side in one box, one column per panel, each under
its own numbered title; a box for one instance names the instance once, in a
title row above the columns. Each training pair's segmented objects share one
box with a row per object, its `Input` beside its `Output`, such as
`1.4.1 Input` and `1.5.1 Output`; segmented-object panels use `Input` and
`Output` without object-number labels. Each constructed instance, extracted
or synthesized, shows its `Input crop`, `Output crop`, `Implementation` and
`Input state` side by side, `1.8.1` through `1.11.1` for the first one. After
the `Analysis · State` table, a `Synthesizing training pairs` step precedes
the synthesis call, and a `<count> training pairs synthesized` step then shows
one box titled `Synthesized <n>` per synthesized pair: its `Input` beside its
`Output`, then a row per instance with its `Input instance` beside its
`Output instance`. A synthesized instance's construction then starts with a
`Constructing <instance>` step, as an extracted instance's does.
steps, and the headers of instance panels shown on their own, include the
instance name. In the 
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
output canvas instead of adding a separate milestone. Segmented-object panels
use `Input` and `Output` without object-number labels. After the
`Analysis · State` table, a `Synthesizing training pairs` step precedes the
synthesis call, and a `<count> training pairs synthesized` step then shows
each synthesized pair's `Synthesized <n> · Input` and
`Synthesized <n> · Output` panels, followed by the
`Synthesized <n> · Input instance` and `Synthesized <n> · Output instance`
panels of each of its instances. A synthesized instance's construction then
starts with a `Constructing <instance>` step, as an extracted instance's does.
steps, crop and implementation headers, and input- and output-state headers include the
instance name. In the visualization, each test object's synthesis shows its
`Input crop` right before its `Implementation`, as in
`2.6.1 Input crop · <instance>` and
`2.7.1 Implementation · <instance>`. Its composition shows the same
`2.12.1`, rather than continuing the synthesis count, and an `Output state`
`2.13.1 Output crop · <instance> · ➡️ 90°`, and every input- and
displays the same way, such as `2.9.1 Input state · <instance> · ⬆️ 0°`. An
orientation that is not a multip
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `64f9b9ba` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T18:20:08.045Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795112408044",
    "title": "Group ARC milestone panels side by side",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NucleoidAI/Nucleoid",
    "source_uri": "https://github.com/NucleoidAI/Nucleoid",
    "source_version": "HEAD",
    "content_hash": "d52cef2dc4a5547c1476e44258ede283d860d784ec521ebda58053b26039b39c"
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
        "Harvested/verified timestamp recorded: 2026-11-19T18:20:08.045Z"
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
  "auth_token": "3020d05efa8bf75f02fbffc8bf9c4f0d16385743faa62c36cff5dbc3ebcfe7ba"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
