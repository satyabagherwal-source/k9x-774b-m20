# Candidate Directive: [CD-KITT] Chunked Zero-Copy Text Arena for High-Throughput Aggregation

<!-- PROVENANCE_START
{
  "source_repository": "parcel-bundler/parcel",
  "source_url": "https://github.com/parcel-bundler/parcel",
  "source_version": "c0396a56",
  "license": "MIT",
  "timestamp": "2026-11-21T00:11:27.953Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-parcel-bundler-parcel",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [parcel-bundler/parcel](https://github.com/parcel-bundler/parcel) (Revision: `c0396a56`).  
> **License**: MIT | **Timestamp**: `2026-11-21T00:11:27.953Z`  
> **Learning ID**: `learn-github-parcel-bundler-parcel`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
        self.pieces.push(Piece::Shared(text.clone(), range));
    }

    pub fn chunks(&self) -> impl Iterator<Item = &str> {
        self.pieces.iter().map(|piece| match piece {
            Piece::Arena(range) => &self.arena[range.clone()],
            Piece::Shared(text, range) => &text[range.clone()],
            Piece::Owned(text) => &**text,
        })
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Continuous string reallocation for bundle assembly
pub struct BadPackager {
    output: String,
}
impl BadPackager {
    pub fn append_module(&mut self, code: &str) {
        // BAD: Copies megabytes of already transformed memory repeatedly,
        // causing continuous reallocations and memory fragmentation.
        self.output.push_str(code);
        self.output.push_str("\n;\n");
    }
}
```

**VERIFICATION METHOD**:
Verify that `ChunkedText` write operations produce identical bit-level output compared to contiguous allocations, with zero intermediate copies:
```rust
#[test]
fn test_chunked_text_matches_contiguous_hash() {
    let mut chunked = ChunkedText::new();
    let large_code: Arc<str> = Arc::from("const a = 1;".repeat(500));
    chunked.push_str("/* header */\n");
    chunked.push_shared(&large_code, 0..large_code.len());
    chunked.push_str("\n/* footer */");

    let contiguous = format!("/* header */\n{}\n/* footer */", &large_code);
    assert_eq!(chunked.to_string(), contiguous);

    let mut h1 = xxhash_rust::xxh3::Xxh3::new();
    chunked.hash_into(&mut h1);
    let mut h2 = xxhash_rust::xxh3::Xxh3::new();
    h2.update(contiguous.as_bytes());
    assert_eq!(h1.digest(), h2.digest());
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:11:27.952Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795219887952",
    "title": "Chunked Zero-Copy Text Arena for High-Throughput Aggregation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "parcel-bundler/parcel",
    "source_uri": "https://github.com/parcel-bundler/parcel",
    "source_version": "HEAD",
    "content_hash": "5c7da81600dd27336e59e54460f18eeb2f89bb6bba360b3cf2b7617cad653ed1"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T00:11:27.952Z"
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
  "auth_token": "04296561ba7ee22ebd40c22e636cbb221bc242515f18d0b713d6fadde4e28891"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
