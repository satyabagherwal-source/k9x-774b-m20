# Candidate Directive: [CD-XPA2] trim the extensions given to --exts

<!-- PROVENANCE_START
{
  "source_repository": "watchexec/watchexec",
  "source_url": "https://github.com/watchexec/watchexec",
  "source_version": "3e5e4d4a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T13:53:31.706Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-watchexec-watchexec",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [watchexec/watchexec](https://github.com/watchexec/watchexec) (Revision: `3e5e4d4a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T13:53:31.706Z`  
> **Learning ID**: `learn-github-watchexec-watchexec`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/cli/src/filterer.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in watchexec/watchexec. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4e2c9ce7`: cli): trim the extensions given to --exts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/cli/src/filterer.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
		let exts = extensions_to_filter(&args.filtering.filter_extensions);
/// The extensions given to `--exts`, without their leading dot. The option is split on commas
/// only, so `-e "rs, txt"` gives " txt": trim it, and drop the empty entries that a trailing comma
/// leaves, as no file has an empty extension.
fn extensions_to_filter(extensions: &[String]) -> Vec<OsString> {
	extensions
		.iter()
		.map(|e| e.trim())
		.map(|e| e.strip_prefix('.').unwrap_or(e))
		.filter(|e| !e.is_empty())
		.map(OsString::from)
		.collect()
}

	#[test]
	fn extensions_are_trimmed_and_empty_ones_dropped() {
		let extensions = ["rs", " txt", ".md ", "", " ", "tar.gz"]
			.map(String::from)
			.to_vec();
		assert_eq!(
			extensions_to_filter(&extensions),
			["rs", "txt", "md", "tar.gz"].map(OsString::from)
		);
	}

	#[tokio::test]
	async fn an_extension_after_a_comma_and_a_space_still_matches() {
		let origin = dunce::canonicalize(".").unwrap();
		// `-e "rs, txt"` is split on the comma only
		let extensions = ["rs", " txt"].map(String::from).to_vec();
		let filterer = GlobsetFilterer::new(
			&origin,
			Vec::<(String, Option<PathBuf>)>::new(),
			Vec::<(String, Option<PathBuf>)>::new(),
			Vec::<Pa
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
		let exts = args
			.filtering
			.filter_extensions
			.iter()
			.map(|e| OsString::from(e.strip_prefix('.').unwrap_or(e)));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4e2c9ce7` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T13:53:31.704Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795269211704",
    "title": "trim the extensions given to --exts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "watchexec/watchexec",
    "source_uri": "https://github.com/watchexec/watchexec",
    "source_version": "HEAD",
    "content_hash": "31e64e3d9fc0f2c400193cdd3cb91ca12f931efa792ba279ecaac406d02a27d0"
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
        "Harvested/verified timestamp recorded: 2026-11-21T13:53:31.704Z"
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
  "auth_token": "87b5a9dc23917a66c913495aa3d60c607fa7dc39f4a83a2e797e40253bc623f8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
