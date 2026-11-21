# Candidate Directive: [CD-MZJS] Guarded Bundle Naming via Declared Intention Contracts

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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T00:13:22.935Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795220002935",
    "title": "Guarded Bundle Naming via Declared Intention Contracts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "parcel-bundler-parcel-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e42d850439c43e7b846cfd61d4a80c04da184dc5867a5e270e49a0ef6a11b939"
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
        "Harvested/verified timestamp recorded: 2026-11-21T00:13:22.935Z"
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
  "auth_token": "2760ffebab707cc094d22d825693daf6a8a75b320a5c53813a24f23bd4f883cc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
