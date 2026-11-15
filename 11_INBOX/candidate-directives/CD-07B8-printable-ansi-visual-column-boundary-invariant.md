# Candidate Directive: [CD-07B8] Printable ANSI Visual Column Boundary Invariant

<!-- PROVENANCE_START
{
  "source_repository": "simonschubert-linuxcommandlibrary-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T08:09:31.553Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-simonschubert-linuxcommandlibrary-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [simonschubert-linuxcommandlibrary-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T08:09:31.553Z`  
> **Learning ID**: `LEARN-EVO-simonschubert-linuxcommandlibrary-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T08:09:31.651Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794730171651",
    "title": "Printable ANSI Visual Column Boundary Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "simonschubert-linuxcommandlibrary-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9be090539cdf09926c26e51166986ce90dea4fe6797ac502cb71301aedf592c3"
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
        "Harvested/verified timestamp recorded: 2026-11-15T08:09:31.651Z"
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
  "auth_token": "e7611d9b36ace99899802771adca442bf9ba5983e0a82de6cc5e2b14c07a1094"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
