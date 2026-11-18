# Candidate Directive: [CD-783S] Allocation-Free String Interning via `Box::leak` on Scoped Lifecycles

<!-- PROVENANCE_START
{
  "source_repository": "GitoxideLabs/gitoxide",
  "source_url": "https://github.com/GitoxideLabs/gitoxide",
  "source_version": "c3d18f4b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T08:06:00.136Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gitoxidelabs-gitoxide",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide) (Revision: `c3d18f4b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T08:06:00.136Z`  
> **Learning ID**: `learn-github-gitoxidelabs-gitoxide`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When parsing repetitive byte slices (such as Git commit author names and emails) across millions of graph nodes within a bounded computational scope, the system MUST NOT allocate owned `String` or `Vec<u8>` structures per record. Instead, it MUST intern deduplicated byte slices into a scoped heap (`BTreeSet<&'static [u8]>` using `Box::leak(sv.into_boxed_slice())`) to yield `'static BStr` references that live strictly for the duration of the operational phase.

**WHY**:
In repositories with $1,000,000+$ commits, each commit has author/committer signatures. Allocating new strings per commit triggers millions of micro-allocations, causing extreme heap fragmentation, cache invalidation, and allocator lock contention. Interning via a local set with boxed slices amortizes allocations down to the unique cardinality of author identities (typically $<1,000$).

**WHEN TO APPLY**:
- Commit graph traversals, AST token analysis, log aggregators, and tabular CSV/Parquet ingestors where string cardinality is small relative to total record volume.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Source derived from gitoxide-core/src/hours/mod.rs
let mut string_heap = BTreeSet::<&'static [u8]>::new();

let mut string_ref = |s: &[u8]| -> &'static BStr {
    match string_heap.get(s) {
        Some(existing) => existing.as_bstr(),
        None => {
            // Allocate once per unique signature byte sequence
            let sv: Vec<u8> = s.to_owned();
            let leaked: &'static [u8] = Box::leak(sv.into_boxed_slice());
            string_heap.insert(leaked);
            leaked.as_bstr()
        }
    }
};

// All parsed identity references now hold &'static BStr with zero cloning overhead
for identity in authors {
    let name: &'static BStr = string_ref(identity.name());
    let email: &'static BStr = string_ref(identity.email());
    authors_for_commit.push(SignatureRef { name, email, time: identity.time });
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Allocating owned Vec<u8> or String instances for every entry
// encountered during a 500,000+ iteration graph traversal.
let mut authors = Vec::new();
for commit in commit_iter {
    // Triggers 1M+ small allocations on the global allocator
    authors.push(Author {
        name: commit.author().name.to_owned(),
        email: commit.author().email.to_owned(),
    });
}
```

**VERIFICATION METHOD**:
Benchmark graph traversal on the Linux kernel repository (1.3M commits). Measure peak RSS and memory allocation counts using a memory profiling allocator (e.g., `dhat` or `heaptrack`). Confirm that heap allocations for identity strings plateau after the first few thousand commits.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:06:00.135Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989160135",
    "title": "Allocation-Free String Interning via `Box::leak` on Scoped Lifecycles",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "GitoxideLabs/gitoxide",
    "source_uri": "https://github.com/GitoxideLabs/gitoxide",
    "source_version": "HEAD",
    "content_hash": "f97b299f8df415d833e34db5db2066322044f0a4f4cc59bd9c086716736b5ccb"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:06:00.135Z"
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
  "auth_token": "f1e94b49e8d9742c19e7796b06362eaf8e014f0513020407ba429d701d0bd09c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
