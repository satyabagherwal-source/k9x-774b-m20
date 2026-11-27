# Candidate Directive: [CD-OWNV] route Bitdefender VPN to its uninstaller and guard extension and AI

<!-- PROVENANCE_START
{
  "source_repository": "tw93/Mole",
  "source_url": "https://github.com/tw93/Mole",
  "source_version": "3da229e1",
  "license": "GPL-3.0",
  "timestamp": "2026-11-27T09:44:46.171Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tw93-mole",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tw93/Mole](https://github.com/tw93/Mole) (Revision: `3da229e1`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-27T09:44:46.171Z`  
> **Learning ID**: `learn-github-tw93-mole`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `lib/core/app_protection.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Mole. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b5fd0ed4`: protection): route Bitdefender VPN to its uninstaller and guard extension and AI data. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `lib/core/app_protection.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
            # Chromium extension storage: settings, state, declarative rules and
            # the MV3 service worker scripts. Mole Mac once offered Service
            # Worker/ScriptCache and broke MV3 extensions. No rule lists these;
            # this keeps a future glob from reaching them (Mole CLI (Windows)
            # e4e29c99). Service Worker/CacheStorage stays cleanable.
            */"Local Extension Settings" | */"Local Extension Settings/"* | \
                */"Sync Extension Settings" | */"Sync Extension Settings/"* | \
                */"Managed Extension Settings" | */"Managed Extension Settings/"* | \
                */"Extension State" | */"Extension State/"* | \
                */"Extension Rules" | */"Extension Rules/"* | \
                */"Extension Scripts" | */"Extension Scripts/"* | \
                */"Service Worker/ScriptCache" | */"Service Worker/ScriptCache/"* | \
                */"Service Worker/Database" | */"Service Worker/Database/"*)
                return 0
                ;;
        # The other AI tool stores Mole Mac's PathGuard refuses: plans, tasks,
        # plugins, skills, memories, attachments, generated images and session
        # 
```

**NEGATIVE CONSTRAINT**:
```shell
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b5fd0ed4` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T09:44:46.169Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795772686169",
    "title": "route Bitdefender VPN to its uninstaller and guard extension and AI",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tw93/Mole",
    "source_uri": "https://github.com/tw93/Mole",
    "source_version": "HEAD",
    "content_hash": "e796e7d193d06a1dfc8c33cc8c9c56bc3fc84520ca8ba94d3863085ea6968999"
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
        "Harvested/verified timestamp recorded: 2026-11-27T09:44:46.169Z"
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
  "auth_token": "1660e9e751da5856a46bd24c0184f5fa6d2eb86c06fc2cda45c057c86cf7a689"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
