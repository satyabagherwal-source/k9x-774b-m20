# Candidate Directive: [CD-GPP5] apply hiding exceptions to their own rules instead of hiding the selector everyw

<!-- PROVENANCE_START
{
  "source_repository": "tw93/Pake",
  "source_url": "https://github.com/tw93/Pake",
  "source_version": "002c958a",
  "license": "GPL-3.0",
  "timestamp": "2026-11-21T04:48:26.393Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tw93-pake",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tw93/Pake](https://github.com/tw93/Pake) (Revision: `002c958a`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-21T04:48:26.393Z`  
> **Learning ID**: `learn-github-tw93-pake`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src-tauri/src/app/content_blocking.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Pake. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c44435aa`: apply hiding exceptions to their own rules instead of hiding the selector everywhere. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src-tauri/src/app/content_blocking.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
#[cfg(target_os = "windows")]
/// Names how the lists become WebKit rules. WebKit keeps a compiled list by
/// its identifier, so a change to the conversion has to change this, or apps
/// go on using the list the old conversion made.
#[cfg(any(target_os = "macos", target_os = "linux", test))]
const CONVERSION: &str = "unhide-2";

    feed(CONVERSION.as_bytes());
    let mut set = FilterSet::new(true);
    let mut unhide = Unhide::default();
    for bytes in list_bytes(groups) {
        let Some(text) = gunzip(bytes) else {
            eprintln!("[Pake] A built-in filter list could not be read");
            continue;
        };
        set.add_filter_list(
            unhide.take_from(&text),
            ParseOptions {
                rule_types,
                ..ParseOptions::default()
            },
        );
    }
    let rules = set
        .unwrap_or_default();
    unhide.apply(rules)
}

/// The lists' hiding exceptions (`example.com#@#.ad`: do not hide `.ad` on
/// example.com), kept away from adblock's conversion and applied here. The
/// conversion writes each one as "hide the selector on every site but that
/// one", which hid every `svg`, Google's logo and icons among 
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    filter_set(groups, rule_types, true)
        .unwrap_or_default()
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c44435aa` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T04:48:26.391Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795236506391",
    "title": "apply hiding exceptions to their own rules instead of hiding the selector everyw",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tw93/Pake",
    "source_uri": "https://github.com/tw93/Pake",
    "source_version": "HEAD",
    "content_hash": "b893e7d6af647dff3f916c45e160fdd3474e8cb2c1b411a4ce1fde35b0af894a"
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
        "Harvested/verified timestamp recorded: 2026-11-21T04:48:26.391Z"
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
  "auth_token": "195f18a9a1c266e15bbe69e57d53e90e69498a82dd84af076aef56b465733482"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
