# Candidate Directive: [CD-MITU] validate pack source slugs on consume to block path traversal

<!-- PROVENANCE_START
{
  "source_repository": "xerj-org/xerj",
  "source_url": "https://github.com/xerj-org/xerj",
  "source_version": "35ccd192",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T02:55:20.274Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-xerj-org-xerj",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [xerj-org/xerj](https://github.com/xerj-org/xerj) (Revision: `35ccd192`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T02:55:20.274Z`  
> **Learning ID**: `learn-github-xerj-org-xerj`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `engine/crates/xerj-autoindex/src/harvest/pack.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in xerj-org/xerj. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e774cf7c`: autoindex): validate pack source slugs on consume to block path traversal. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `engine/crates/xerj-autoindex/src/harvest/pack.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    // #3166: the slug becomes a directory under the corpus on consume
    // (`corpora/<name>/<slug>`), so it is gated here, before any path is
    // built from it, using the same gate the recipe build path applies. A
    // checksum cannot stand in for this: SHA256SUMS is authored by the
    // same party as the manifest, so a self-consistent malicious pack
    // verifies clean.
    for s in &sources {
        if let Err(e) = xerj_common::xccode::pathgate::valid_slug(&s.slug) {
            bail!(at(&format!("source slug: {e}")));
        }
    /// Rewrite SHA256SUMS from the bytes now on disk, so a test that edits
    /// manifest.json can reach the slug check instead of dying on a
    /// checksum first.
    fn rehash_sums(pack_dir: &Path) {
        let sums_raw = std::fs::read_to_string(pack_dir.join("SHA256SUMS")).unwrap();
        let mut fresh = String::new();
        for line in sums_raw.lines() {
            let (_, name) = line.split_once("  ").unwrap();
            let file_bytes = std::fs::read(pack_dir.join(name)).unwrap();
            fresh.push_str(&format!(
                "{}  {}\n",
                hex(&Sha256::digest(&file_bytes)),
                name
        
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    if sources.iter().any(|s| s.slug.is_empty()) {
        bail!(at("a manifest source has no slug"));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e774cf7c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T02:55:20.272Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795661720272",
    "title": "validate pack source slugs on consume to block path traversal",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "xerj-org/xerj",
    "source_uri": "https://github.com/xerj-org/xerj",
    "source_version": "HEAD",
    "content_hash": "5e6e8cf76d09ef941a18c7f6f360e615509ba0d16f6379058c7fdaca477033e4"
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
        "Harvested/verified timestamp recorded: 2026-11-26T02:55:20.272Z"
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
  "auth_token": "f11d281d892152f7b2fcd98ede33deababfd60393e7020d67e65687dad540699"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
