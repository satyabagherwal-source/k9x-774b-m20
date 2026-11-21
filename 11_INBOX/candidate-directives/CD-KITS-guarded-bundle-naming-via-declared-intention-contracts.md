# Candidate Directive: [CD-KITS] Guarded Bundle Naming via Declared Intention Contracts

<!-- PROVENANCE_START
{
  "source_repository": "parcel-bundler/parcel",
  "source_url": "https://github.com/parcel-bundler/parcel",
  "source_version": "c0396a56",
  "license": "MIT",
  "timestamp": "2026-11-21T00:11:27.952Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-parcel-bundler-parcel",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [parcel-bundler/parcel](https://github.com/parcel-bundler/parcel) (Revision: `c0396a56`).  
> **License**: MIT | **Timestamp**: `2026-11-21T00:11:27.952Z`  
> **Learning ID**: `learn-github-parcel-bundler-parcel`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
During packager execution, bundle referencing MUST require explicit access declaration (`begin_packaging([declared_ids])`). Any read of an unresolved bundle's final dist URL or file name without prior declaration MUST immediately panic in debug/test builds and reject compilation, rather than silently falling back to un-hashed or provisional identifiers.

**WHY**:
Bundle naming in production requires content hashing (`xxh3_128`). Bundle A can only know Bundle B's content hash if B is packaged before A. If packagers are allowed to read arbitrary bundle names without declaring dependencies:
1. Concurrent packaging threads face race conditions where B's hash may or may not be resolved when A reads it.
2. Silent use of provisional/template names leads to broken production hyperlinks or non-deterministic cache invalidation.
3. Undeclared cycles deadlock the packager thread pool.

**WHEN TO APPLY**:
- In any compiler, packager, or asset-pipeline backend generating content-hashed output files.
- In distributed build graphs where compilation targets embed generated target hashes.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// crates/core/src/bundle.rs
pub struct NameState {
    final_path: OnceLock<PathId>,
    declared: Mutex<Option<Box<[u64]>>>,
    status: AtomicU8,
}

impl Bundle {
    pub fn begin_packaging(&self, mut declared: Vec<u64>) {
        declared.sort_unstable();
        declared.dedup();
        *self.name_state.declared.lock().unwrap() = Some(declared.into_boxed_slice());
    }

    pub fn end_packaging(&self) {
        *self.name_state.declared.lock().unwrap() = None;
    }

    pub fn may_access(&self, target: &Bundle) -> bool {
        target.id == self.id
            || match &*self.name_state.declared.lock().unwrap() {
                Some(declared) => declared.binary_search(&target.id).is_ok(),
                None => true, // Outside of packaging phase
            }
    }

    pub fn check_name_access(&self, target: &Bundle) {
        if !self.may_access(target) {
            panic!(
                "The packager for bundle {} accessed the name of bundle {}, \
                 which it did not declare in `Content::bundle_dependencies`.",
                self.stable_key(),
                target.stable_key()
            );
        }
    }

    pub fn relative_url(&self, from: &Bundle) -> Option<String> {
        from.check_name_access(self);
        let path = if self.id == from.id {
            self.current_path()?
        } else {
            self.reference_path()?
        };
        Some(path.relative_url(&from.dist_path?))
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Unchecked name resolution yields silent, intermittent data races
pub fn relative_url_unsafe(&self, from: &Bundle) -> Option<String> {
    // BAD: If self is currently being hashed in another thread, this either returns
    // a non-hashed fallback template name or reads half-written state.
    let path = self.dist_path.or_else(|| self.name_state.final_path.get().copied())?;
    Some(path.relative_url(&from.dist_path?))
}
```

**VERIFICATION METHOD**:
Enforce check using automated contract failure tests:
```rust
#[test]
#[should_panic(expected = "which it did not declare in `Content::bundle_dependencies`")]
fn test_undeclared_name_access_panics() {
    let a = create_test_bundle(1, "a.js");
    let b = create_test_bundle(2, "b.js");
    // Bundle 'a' only declares dependency on ID 3
    a.begin_packaging(vec![3]);
    let _ = b.relative_url(&a); // Panics: target 'b' (ID 2) was not declared
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:11:27.951Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795219887951",
    "title": "Guarded Bundle Naming via Declared Intention Contracts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "parcel-bundler/parcel",
    "source_uri": "https://github.com/parcel-bundler/parcel",
    "source_version": "HEAD",
    "content_hash": "9c1844a01d5af68ce5b4f9d83c33e258131fb6eb0beba0f1bea405d5bbb4d3d3"
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-21T00:11:27.951Z"
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
  "auth_token": "4b251b2f5266c7d048816b5e44f8ca9090358eaba4e946351a916be57c49ab80"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
