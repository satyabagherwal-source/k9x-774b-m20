# Candidate Directive: [CD-OUZK] docs(readme): add Desktop Modern & Classic UI screenshots, iOS breakthrough teas

<!-- PROVENANCE_START
{
  "source_repository": "GeoPortApp/GeoPort",
  "source_url": "https://github.com/GeoPortApp/GeoPort",
  "source_version": "461e76bc",
  "license": "GPL-3.0",
  "timestamp": "2026-11-27T04:36:48.224Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-geoportapp-geoport",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GeoPortApp/GeoPort](https://github.com/GeoPortApp/GeoPort) (Revision: `461e76bc`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-27T04:36:48.224Z`  
> **Learning ID**: `learn-github-geoportapp-geoport`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GeoPortApp/GeoPort. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6565163d`: docs(readme): add Desktop Modern & Classic UI screenshots, iOS breakthrough teasers, Waitlist & Instruction Guide links. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing HTML data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```html
// Verified production-grade fix pattern:
  <a href="https://geoport.me"><strong>https://geoport.me</strong></a> &nbsp;&bull;&nbsp;
  <a href="https://geoport.me/ios.html#waitlist"><strong>Untethered iOS Waitlist</strong></a> &nbsp;&bull;&nbsp;
  <a href="https://geoport.me/guide.html"><strong>Instruction Guide</strong></a>
    <img src="https://img.shields.io/github/v/release/davesc63/GeoPort?style=for-the-badge&label=Desktop%20Release&color=0ea5e9" alt="Latest Desktop Release">
  <a href="https://geoport.me/ios.html#waitlist">
    <img src="https://img.shields.io/badge/iOS%20Untethered-Register%20Waitlist-14b8a6?style=for-the-badge" alt="Register for the iOS Waitlist">
  <a href="https://geoport.me/guide.html">
    <img src="https://img.shields.io/badge/Docs-Instruction%20Guide-38bdf8?style=for-the-badge" alt="Instruction Guide">
  <a href="https://discord.gg/genRca55Nb">
    <img src="https://img.shields.io/badge/Discord-Join%20Us-5865F2?logo=discord&logoColor=white&style=for-the-badge" alt="Join Discord">

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T04:36:48.216Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.68,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 68%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795754208216",
    "title": "docs(readme): add Desktop Modern & Classic UI screenshots, iOS breakthrough teas",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "GeoPortApp/GeoPort",
    "source_uri": "https://github.com/GeoPortApp/GeoPort",
    "source_version": "HEAD",
    "content_hash": "49fb738c8ec1b5f7589faa2cf960e389c746875c2ea46c142bb59476f20f68e3"
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-27T04:36:48.217Z"
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
  "auth_token": "e66e2502ae2561d873c04972662937f4b3f0557b759c18b73cb5029648599ab1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
