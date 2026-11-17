# Candidate Directive: [CD-I9XJ] Invariant Preservation Across Reference-Counted Container Conversions

<!-- PROVENANCE_START
{
  "source_repository": "GitoxideLabs/gitoxide",
  "source_url": "https://github.com/GitoxideLabs/gitoxide",
  "source_version": "ab7c5dc0",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T02:50:59.911Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gitoxidelabs-gitoxide",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide) (Revision: `ab7c5dc0`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T02:50:59.911Z`  
> **Learning ID**: `learn-github-gitoxidelabs-gitoxide`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When transforming a resource handle or proxy object between concurrency boundaries (e.g., converting a thread-local `Rc`-backed handle to a multi-threaded `Arc`-backed handle via an `into_arc()` constructor), the constructor **MUST** exhaustively propagate and replicate all operational policies, caches, filters, and safety tokens from the source handle. It **MUST NOT** instantiate the new handle with default configuration values unless the type system explicitly drops the underlying capabilities.

**WHY**:
Resetting policies during container migration (such as dropping `ignore_replacements`, pack-unload prevention locks, or recursion depth caps) causes silent divergence in domain-level reads. An `Arc`-migrated handle querying an object graph will suddenly read raw commits instead of replaced commits, or drop mapped memory windows for deleted packs during concurrent GC cycles, causing panics or data corruption.

**WHEN TO APPLY**:
Apply in any high-concurrency Rust or C++ system using handle-based resource wrappers where thread-local contexts (`Rc`, single-threaded handles) are promoted to cross-thread contexts (`Arc`, thread pools).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Production Pattern from gix-odb/src/store_impls/dynamic/handle.rs
impl super::Handle<std::rc::Rc<super::Store>> {
    /// Convert an Rc-backed handle into an Arc-backed thread-safe handle
    /// while preserving all operational policies and safety tokens.
    pub fn into_arc(self) -> std::io::Result<super::Handle<std::sync::Arc<super::Store>>> {
        let loose_compression = self.loose_compression;
        let store = std::sync::Arc::new(super::Store::try_from(self.store_ref())?);
        let mut cache = store.to_handle_arc();
        
        // EXPLICIT POLICY PROPAGATION (Zero default leakage)
        cache.refresh = self.refresh;
        cache.ignore_replacements = self.ignore_replacements;
        cache.max_recursion_depth = self.max_recursion_depth;
        cache.loose_compression = loose_compression;
        
        // Preserve memory stability tokens
        if matches!(self.token.as_ref(), Some(Mode::KeepDeletedPacksAvailable)) {
            cache.prevent_pack_unload();
        }
        
        Ok(cache)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// CRITICAL BUG: Do not construct fresh handles without copying handle invariants
impl super::Handle<std::rc::Rc<super::Store>> {
    pub fn into_arc(self) -> std::io::Result<super::Handle<std::sync::Arc<super::Store>>> {
        let store = std::sync::Arc::new(super::Store::try_from(self.store_ref())?);
        // BUG: `to_handle_arc()` populates default policies.
        // `ignore_replacements` resets to default `false`.
        // `token` is dropped, allowing packs to be unmapped under active reads!
        Ok(store.to_handle_arc())
    }
}
```

**VERIFICATION METHOD**:
Enforce handle policy parity tests on conversion:
```rust
#[test]
fn handle_conversion_preserves_policy_invariants() {
    let mut handle = odb_at("path").unwrap();
    handle.prevent_pack_unload();
    handle.ignore_replacements = true;
    
    let converted = handle.clone().into_arc().expect("conversion succeeds");
    assert_eq!(converted.ignore_replacements, handle.ignore_replacements);
    assert_eq!(converted.token.is_some(), handle.token.is_some());
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T02:50:59.909Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794883859909",
    "title": "Invariant Preservation Across Reference-Counted Container Conversions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "GitoxideLabs/gitoxide",
    "source_uri": "https://github.com/GitoxideLabs/gitoxide",
    "source_version": "HEAD",
    "content_hash": "2960821186f4ccb90d27198a38db82b4bf3b5c1faedac72b740104a8b151e80d"
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
        "Harvested/verified timestamp recorded: 2026-11-17T02:50:59.909Z"
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
  "auth_token": "45ce5c923e933b2f85b6c79b877644b61fbfd4b59295bb33aed1e58e3c0a2f75"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
