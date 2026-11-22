# Candidate Directive: [CD-YGT1] clock-rs config example

<!-- PROVENANCE_START
{
  "source_repository": "simonschubert-linuxcommandlibrary-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T16:57:44.992Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-simonschubert-linuxcommandlibrary-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [simonschubert-linuxcommandlibrary-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T16:57:44.992Z`  
> **Learning ID**: `LEARN-EVO-simonschubert-linuxcommandlibrary-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `assets/commands/clock-rs.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in SimonSchubert/LinuxCommandLibrary. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `36cdd4ea`: clock-rs config example. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Kotlin data structures, boundary deserialization, API parsing, or resource lifecycles matching `assets/commands/clock-rs.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified production-grade fix pattern:
The file is TOML. On Linux it is **~/.config/clock-rs/conf.toml**. Point the variable **CONF PATH** (one underscore between the words) at another file, or set it to **None** to ignore the file on disk:
**[general]**
> **color** (default white), **interval** in milliseconds (default 200), **blink** (default false), **bold** (default false). These match **--color**, **--interval**, **--blink**, and **--bold**.

**[position]**
> **horizontal** and **vertical**, each **start**, **center**, or **end**. Default **center**. These match **--x-pos** and **--y-pos**.
**[date]**
> **fmt** is a chrono strftime pattern (default **%d-%m-%Y**) and matches **--fmt**. **utc** matches **--utc**. The 12-hour key and the hide-seconds key match **-t** and **--hide-seconds**. Each of those two keys is two words joined by an underscore: use and 12h, hide and seconds.
**-t** is only a short flag. The matching configuration key is the 12-hour key under **date**.
```

**NEGATIVE CONSTRAINT**:
```kotlin
// Induced defect failure mode:
The file is TOML. On Linux it is **~/.config/clock-rs/conf.toml**. Another path, or **None** to ignore the file, is the environment variable in this assignment:
```
[general]
color = "magenta"
interval = 250
blink = true
bold = true

[position]
horizontal = "center"
vertical = "center"

[date]
fmt = "%A, %B %d, %Y"
use_12h = true
utc = true
hide_seconds = true
```
**general.color**, **general.interval**, **general.blink**, and **general.bold** match the display flags. **position.horizontal** and **position.vertical** match **--x-pos** and **--y-pos**. The four **date** keys in the example match **--fmt**, **-t**, **--utc**, and **--hide-seconds**, in that order.
**-t** is only a short flag. The matching configuration key is the 12-hour key under **date** in the example above.
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T16:57:45.106Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795366665106",
    "title": "clock-rs config example",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "simonschubert-linuxcommandlibrary-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e1d8054bf396cfc1d289558cb5afacc10d74149feac316e08c19d9a96c41fd19"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
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
        "Harvested/verified timestamp recorded: 2026-11-22T16:57:45.106Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "cfdf0049be24b3e614d19b24d4cd420538c12c6c6cb5f13f92ff0b9312834316"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
