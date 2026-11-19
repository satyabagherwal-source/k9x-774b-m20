# Candidate Directive: [CD-TUHZ] Guard-Then-Consume IOBuffer Separation Invariant

<!-- PROVENANCE_START
{
  "source_repository": "medialab-xan-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T07:43:16.294Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-medialab-xan-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [medialab-xan-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T07:43:16.294Z`  
> **Learning ID**: `LEARN-EVO-medialab-xan-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
IO buffering abstractions MUST NOT combine data consumption/parsing logic with the low-level retrieval and storage of decoded text. The buffer structure MUST remain an inert storage container (providing `&str` or `&[u8]`), and validation guards MUST execute strictly prior to passing the buffer's contents to third-party AST/document parsers.

**WHY**:
Coupling document parsing directly inside an `IOBuffer` forces every data source (raw memory cells, file paths, network streams) to synthesize fake I/O handles or duplicate validation code. It obscures safety guards, hides invalid UTF-8/null-byte checks, and leaks domain-specific error types into generalized I/O layers.

**WHEN TO APPLY**:
Apply in multi-source parsers (supporting files, cell references, stdin, and direct buffers) where data must be decoded and passed into complex third-party document parsers (such as HTML parsers, XML parsers, or JSON document trees).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Production Pattern from src/cmd/scrape.rs refactor
pub struct IOBuffer {
    string: String,
}

impl IOBuffer {
    pub fn read_file_as_str<'a>(
        &'a mut self,
        input_dir: &str,
        filename: &str,
        encoding: Option<EncodingRef>,
    ) -> Result<&'a str, CustomError> {
        self.string.clear();
        // Load into internal buffer and apply optional decoding
        read_path_into_buffer(input_dir, filename, encoding, &mut self.string)?;
        Ok(&self.string)
    }
}

pub enum ScraperTarget<'a> {
    HtmlCell(&'a [u8]),
    HtmlFile { input_dir: &'a str, filename: &'a str, encoding: Option<EncodingRef> },
}

impl<'a> ScraperTarget<'a> {
    pub fn read_html(&self, buffer: &mut IOBuffer) -> Result<Html, CustomError> {
        let html_str: &str = match self {
            Self::HtmlCell(cell) => {
                guard_invalid_html_cell(cell)?; // Invariant check MUST occur here
                std::str::from_utf8(cell)?
            }
            Self::HtmlFile { input_dir, filename, encoding } => {
                buffer.read_file_as_str(input_dir, filename, *encoding)?
            }
        };

        // AST/Document parsing occurs uniformly on the extracted reference
        Ok(Html::parse_document(html_str))

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T07:43:16.391Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795074196391",
    "title": "Guard-Then-Consume IOBuffer Separation Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "medialab-xan-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "10c30cb30c38691f5e64ffd4950da53fb593d5276877e6e5322151874c32de84"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T07:43:16.391Z"
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
  "auth_token": "80832b9b4d9817c8f47838038a51f3c94ae75c3015d0fa066de65ba3fbc4d0a1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
