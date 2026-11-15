# Candidate Directive: [CD-03BR] Printable ANSI Visual Column Boundary Invariant

<!-- PROVENANCE_START
{
  "source_repository": "SimonSchubert/LinuxCommandLibrary",
  "source_url": "https://github.com/SimonSchubert/LinuxCommandLibrary",
  "source_version": "6641ebf0",
  "license": "Apache-2.0",
  "timestamp": "2026-11-15T08:09:26.487Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-simonschubert-linuxcommandlibrary",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [SimonSchubert/LinuxCommandLibrary](https://github.com/SimonSchubert/LinuxCommandLibrary) (Revision: `6641ebf0`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-15T08:09:26.487Z`  
> **Learning ID**: `learn-github-simonschubert-linuxcommandlibrary`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When parsing text with embedded hyperlinks or terminal escapes for interactive TUIs, printable visual character column indices MUST be calculated strictly in a single-pass tokenizer against unescaped plain content. Raw string slice operations MUST NOT be performed after styling decorators or ANSI escape sequences have been applied.

**WHY**:
ANSI color and style sequences (e.g., `\u001B[31m`) introduce non-printing byte sequences into strings. If click-boundary coordinates or terminal column spans are measured against styled strings, the reported boundaries will be skewed by the byte-length of the escape codes. This breaks mouse hit-testing in TUIs and causes severe visual alignment distortion when calculating line wrapping and table column dividers.

**WHEN TO APPLY**:
Any CLI, TUI, or terminal emulator pipeline converting Markdown or enriched text into interactive, clickable console output.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// cli/src/commonMain/kotlin/com/linuxcommandlibrary/nativecli/ContentFormatter.kt
data class ManLink(val lineIndex: Int, val startCol: Int, val endCol: Int, val command: String)

fun buildDefaultSection(
    content: String,
    wrapManLink: (label: String, command: String) -> String,
): Section {
    val lines = mutableListOf<String>()
    val links = mutableListOf<ManLink>()

    for (rawLine in content.lines()) {
        val lineIndex = lines.size
        val sb = StringBuilder()
        var visibleCol = 0 // Track printable column width strictly
        var last = 0

        for (match in tokenRegex.findAll(rawLine)) {
            if (match.range.first > last) {
                val plain = rawLine.substring(last, match.range.first)
                sb.append(plain)
                visibleCol += plain.length // Exact printable advancement
            }
            when {
                match.groups[1] != null -> { // Bold
                    val text = match.groupValues[1]
                    sb.append(Theme.boldText(text)) // Adds ANSI escapes to StringBuilder
                    visibleCol += text.length       // Advances visual column by raw text only
                }
                match.groups[4] != null -> { // Man reference link
                    val label = match.groupValues[4]
                    val command = match.groupValues[5]
                    // Store link boundary using unescaped visible column coordinates
                    links.add(ManLink(lineIndex, visibleCol, visibleCol + label.length, command))
                    sb.append(wrapManLink(label, command))
                    visibleCol += label.length
                }
            }
            last = match.range.last + 1
        }
        if (last < rawLine.length) {
            val tail = rawLine.substring(last)
            sb.append(tail)
            visibleCol += tail.length
        }
        lines.add(sb.toString())
    }
    return Section(lines, links)
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Calculating hit coordinates on post-formatted strings
val styledText = "\u001B[1m" + rawText + "\u001B[0m"
// BUG: Length includes the 8 non-printable ANSI escape characters.
// TUI mouse listener mapping click at column 5 will miss the actual target.
val linkEnd = linkStart + styledText.length 
```

**VERIFICATION METHOD**:
Unit-test the formatter with an input line containing bold text preceding a man-page reference: `**bold** [grep](/man/grep)`. Assert that `ManLink.startCol == 5` (the 4 characters of "bold" plus 1 space) despite ANSI escape codes being present in the line string buffer.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T08:09:26.486Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794730166486",
    "title": "Printable ANSI Visual Column Boundary Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "SimonSchubert/LinuxCommandLibrary",
    "source_uri": "https://github.com/SimonSchubert/LinuxCommandLibrary",
    "source_version": "HEAD",
    "content_hash": "29fdc44dc792e0e3df268a591f52bc8d218b13d2b431358e9022352e71c2b6eb"
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
        "Harvested/verified timestamp recorded: 2026-11-15T08:09:26.486Z"
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
  "auth_token": "b67d1cf7a06641de9d7cb2bd82b2cf000adf281d0a582acc71de7b217f1d856d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
