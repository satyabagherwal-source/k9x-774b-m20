# Candidate Directive: [CD-RW90] Guard-Then-Consume IOBuffer Separation Invariant

<!-- PROVENANCE_START
{
  "source_repository": "medialab/xan",
  "source_url": "https://github.com/medialab/xan",
  "source_version": "7e357947",
  "license": "Unlicense",
  "timestamp": "2026-11-19T07:41:45.348Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-medialab-xan",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [medialab/xan](https://github.com/medialab/xan) (Revision: `7e357947`).  
> **License**: Unlicense | **Timestamp**: `2026-11-19T07:41:45.348Z`  
> **Learning ID**: `learn-github-medialab-xan`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Leaking domain parsing into IO Buffer and bypassing uniform guards
impl IOBuffer {
    fn read_file_as_html(&mut self, input_dir: &str, filename: &str, encoding: Option<EncodingRef>) -> Result<Html, CustomError> {
        // High coupling: IOBuffer now knows about Html parser
        self.read_file_as_str(input_dir, filename, encoding)
            .map(Html::parse_document)
    }
}
```

**VERIFICATION METHOD**:
Implement architectural boundary testing via `cargo clippy` or static AST analysis ensuring that `IOBuffer` has no dependency imports referencing parsing engines (`Html`, `Value`, `Tree`).

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T07:41:45.347Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795074105347",
    "title": "Guard-Then-Consume IOBuffer Separation Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "medialab/xan",
    "source_uri": "https://github.com/medialab/xan",
    "source_version": "HEAD",
    "content_hash": "5b4b6a31fc311805bd1ac72fcd46b2c0edd14f111ebb50df93002c2e750d265d"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T07:41:45.347Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "b9b31d7089fcc56f901fbcbd155ed788b37a9791013e17669c04286420775e17"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
