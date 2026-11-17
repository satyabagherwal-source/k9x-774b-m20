# Candidate Directive: [CD-IY80] Invariant Preservation Across Reference-Counted Container Conversions

<!-- PROVENANCE_START
{
  "source_repository": "gitoxidelabs-gitoxide-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T02:51:31.273Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-gitoxidelabs-gitoxide-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gitoxidelabs-gitoxide-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T02:51:31.273Z`  
> **Learning ID**: `LEARN-EVO-gitoxidelabs-gitoxide-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T02:51:31.389Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794883891389",
    "title": "Invariant Preservation Across Reference-Counted Container Conversions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gitoxidelabs-gitoxide-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "2569078a3a890b33de28217d685b8f0d69228250e4abd8336bce16d324a5b95b"
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
        "Harvested/verified timestamp recorded: 2026-11-17T02:51:31.390Z"
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
  "auth_token": "f87d636ecfcb886b750aff8da897808a7527f60240b79e54a098c1db2ca1c364"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
