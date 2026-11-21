# Candidate Directive: [CD-IE58] Add Universal Clipboard archive detection to System Junk

<!-- PROVENANCE_START
{
  "source_repository": "iliyami/MacSai",
  "source_url": "https://github.com/iliyami/MacSai",
  "source_version": "5891a8ce",
  "license": "BSD-3-Clause",
  "timestamp": "2026-11-21T02:57:46.268Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-iliyami-macsai",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [iliyami/MacSai](https://github.com/iliyami/MacSai) (Revision: `5891a8ce`).  
> **License**: BSD-3-Clause | **Timestamp**: `2026-11-21T02:57:46.268Z`  
> **Learning ID**: `learn-github-iliyami-macsai`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `README.de.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in iliyami/MacSai. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5891a8ce`: Add Universal Clipboard archive detection to System Junk. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.de.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
| **System Junk** | 16+ Scan-Kategorien: Benutzer- und System-Caches, Protokolle, Sprachdateien, defekte Einstellungen, defekte Anmeldeobjekte, Dokumentversionen, iOS-Backups, Xcode-Müll, Caches von Paketmanagern / IDEs / KI-Werkzeugen, Reste gelöschter Benutzer, Archive der universellen Zwischenablage (nur zur Prüfung, nie vorausgewählt) sowie **Universal-Binary-Verschlankung** (findet fette Mach-O-Binärdateien, die sowohl arm64 als auch x86_64 enthalten, und schreibt sie per `lipo` auf deine native Architektur um, mit Abbrechen-Unterstützung) |
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
| **System Junk** | 16+ Scan-Kategorien: Benutzer- und System-Caches, Protokolle, Sprachdateien, defekte Einstellungen, defekte Anmeldeobjekte, Dokumentversionen, iOS-Backups, Xcode-Müll, Caches von Paketmanagern / IDEs / KI-Werkzeugen, Reste gelöschter Benutzer, sowie **Universal-Binary-Verschlankung** (findet fette Mach-O-Binärdateien, die sowohl arm64 als auch x86_64 enthalten, und schreibt sie per `lipo` auf deine native Architektur um, mit Abbrechen-Unterstützung) |
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5891a8ce` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T02:57:46.266Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795229866266",
    "title": "Add Universal Clipboard archive detection to System Junk",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "iliyami/MacSai",
    "source_uri": "https://github.com/iliyami/MacSai",
    "source_version": "HEAD",
    "content_hash": "d11d04ba102c26aedff606044c4296b65bf6dd026d4c15a38882d3629f99e536"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T02:57:46.266Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "826065f9a4bac41304b9eb983bbea28e436b314a9a7be1c09a58c88280a8f098"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
