# Candidate Directive: [CD-9XKQ] docs(incidents): record I-79 to I-84 for the fixes since V1.72.0

<!-- PROVENANCE_START
{
  "source_repository": "tw93/Mole",
  "source_url": "https://github.com/tw93/Mole",
  "source_version": "7966afdd",
  "license": "GPL-3.0",
  "timestamp": "2026-11-19T10:15:44.954Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tw93-mole",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tw93/Mole](https://github.com/tw93/Mole) (Revision: `7966afdd`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-19T10:15:44.954Z`  
> **Learning ID**: `learn-github-tw93-mole`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/incidents.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Mole. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4ae277c0`: docs(incidents): record I-79 to I-84 for the fixes since V1.72.0. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/incidents.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
| I-79 | 2026-11-17 | `mo uninstall` on Alfred 4 left `com.runningwithcrayons.Alfred-Preferences.plist` behind: embedded helper bundle ids were read only under `Contents/Library/LoginItems/`, and Alfred ships its settings app under `Contents/Preferences/` (#2027, #2028) | unknown | c47ea46e | write-time | `embedded bundle ids include a helper app under Contents/Preferences (#2027)` |
| I-80 | 2026-11-14 | A per-item size probe that failed without a signal, in old browser and updater cleanup, device firmware, Tart caches and the Handoff pasteboard, returned its status and cancelled the whole `mo clean` run instead of only leaving that item unsized (#1997) | unknown | fa6bbea9 | review | `old browser and updater cleanup continues on non-signal size failure and stops on signal`, `clean_tart_caches tolerates non-signal size failures before and after prune` |
| I-81 | 2026-11-14 | `mo optimize` stopped every later task when one task's sizing, scan or plist-read probe timed out, because cache refresh, saved state, launch agent and shared file list handlers passed status 124 up to the run (#2003) | unknown | 97f66d63 | review | `cache refresh sizing timeouts finish the run while removal t
```

**NEGATIVE CONSTRAINT**:
```shell
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4ae277c0` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T10:15:44.953Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795083344953",
    "title": "docs(incidents): record I-79 to I-84 for the fixes since V1.72.0",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tw93/Mole",
    "source_uri": "https://github.com/tw93/Mole",
    "source_version": "HEAD",
    "content_hash": "bc0f69d10a74d15ac68bf11f9861c6b671581572f5bdc8d1dfcb78128de517b5"
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
        "Harvested/verified timestamp recorded: 2026-11-19T10:15:44.953Z"
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
  "auth_token": "2cb4fd000e25ea57d39866f29722e02ba2662f9d15b6b6316c639c5e108bf351"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
