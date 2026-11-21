# Candidate Directive: [CD-MZJT] Chunked Zero-Copy Text Arena for High-Throughput Aggregation

<!-- PROVENANCE_START
{
  "source_repository": "parcel-bundler-parcel-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T00:13:22.792Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-parcel-bundler-parcel-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [parcel-bundler-parcel-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T00:13:22.792Z`  
> **Learning ID**: `LEARN-EVO-parcel-bundler-parcel-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Compilers and packagers aggregating heterogeneous textual slices (code, source maps, headers, injected module wrappers) MUST NOT repeatedly concatenate into intermediate heap-allocated `String` or `Vec<u8>` buffers. Instead, they MUST implement a piecewise chunked buffer that copies only sub-threshold fragments into a contiguous arena, while capturing large slices via reference-counted pointers (`Arc<str>`) or moves (`Box<str>`), emitting directly via vectored I/O.

**WHY**:
Bundling thousands of modules produces gigabytes of ephemeral memory allocations if string concatenation is used. Re-allocating and copying large transformed module buffers consumes memory bandwidth, triggers kernel page faults, and ruins CPU cache locality. A tiered piecewise buffer prevents intermediate copying of large modules while avoiding the overhead of thousands of tiny allocations for structural glue syntax (commas, semicolons, function headers).

**WHEN TO APPLY**:
- In linkers, bundlers, source map generators, and code packagers combining thousands of disparate source code fragments.
- When feeding compiled content directly to disk I/O or network sockets.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// crates/core/src/chunked_text.rs
#[derive(Default, Debug, Clone)]
pub struct ChunkedText {
    pieces: Vec<Piece>,
    arena: String,
    len: usize,
}

#[derive(Debug, Clone)]
enum Piece {
    Arena(Range<usize>),
    Shared(Arc<str>, Range<usize>),
    Owned(Box<str>),
}

const MIN_PIECE_LEN: usize = 256;

impl ChunkedText {
    pub fn push_str(&mut self, text: &str) {
        if text.is_empty() { return; }
        let start = self.arena.len();
        self.arena.push_str(text);
        self.len += text.len();
        // Coalesce adjacent arena writes into a single range
        match self.pieces.last_mut() {
            Some(Piece::Arena(range)) if range.end == start => range.end = self.arena.len(),
            _ => self.pieces.push(Piece::Arena(start..self.arena.len())),
        }
    }

    pub fn push_shared(&mut self, text: &Arc<str>, range: Range<usize>) {
        // Below MIN_PIECE_LEN, reference tracking costs more than memcpy
        if range.len() < MIN_PIECE_LEN {
            self.push_str(&text[range]);
            return;
        }
        self.len += range.len();

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:13:22.936Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795220002936",
    "title": "Chunked Zero-Copy Text Arena for High-Throughput Aggregation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "parcel-bundler-parcel-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "6e66b1a841fe4b01df0c884eee7c2275631fa850013909010a1be2b3e2aa9cdd"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T00:13:22.936Z"
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
  "auth_token": "23fede5524bae0fab41d3a44a03c96a27440e7aa60f4bd1cc45d656cf98303f9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
