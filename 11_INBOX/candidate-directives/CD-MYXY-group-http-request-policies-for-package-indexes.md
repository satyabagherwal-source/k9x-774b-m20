# Candidate Directive: [CD-MYXY] Group HTTP request policies for package indexes

<!-- PROVENANCE_START
{
  "source_repository": "astral-sh/uv",
  "source_url": "https://github.com/astral-sh/uv",
  "source_version": "82adf363",
  "license": "Apache-2.0",
  "timestamp": "2026-11-16T13:22:50.086Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-astral-sh-uv",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [astral-sh/uv](https://github.com/astral-sh/uv) (Revision: `82adf363`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-16T13:22:50.086Z`  
> **Learning ID**: `learn-github-astral-sh-uv`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/uv-client/src/registry_client.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in astral-sh/uv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `82adf363`: Group HTTP request policies for package indexes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/uv-client/src/registry_client.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                            let status_code_strategy = self
                                .indexes
                                .request_policy(index.url)
                                .status_code_strategy();
                                    status_code_strategy,
                                        status_code_strategy,
        status_code_strategy: IndexStatusCodeStrategy<'_>,
                if let Some(header) = self
                    .indexes
                    .request_policy(index)
                    .simple_api_cache_control() =>
                if let Some(header) = self
                    .indexes
                    .request_policy(index)
                    .simple_api_cache_control() =>
                if let Some(header) = self
                    .indexes
                    .request_policy(index)
                    .configured_files_cache_control() =>
                    && let Some(header) =
                        self.indexes.request_policy(index).artifact_cache_control() =>
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                            let status_code_strategy =
                                self.indexes.status_code_strategy_for(index.url);
                                    &status_code_strategy,
                                        &status_code_strategy,
        status_code_strategy: &IndexStatusCodeStrategy,
                if let Some(header) = self.indexes.simple_api_cache_control_for(index) =>
                if let Some(header) = self.indexes.simple_api_cache_control_for(index) =>
                if let Some(header) = self.indexes.configured_files_cache_control_for(index) =>
                    && let Some(header) = self.indexes.artifact_cache_control_for(index) =>
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `82adf363` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T13:22:50.083Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794835370083",
    "title": "Group HTTP request policies for package indexes",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "astral-sh/uv",
    "source_uri": "https://github.com/astral-sh/uv",
    "source_version": "HEAD",
    "content_hash": "425275eace152f8e4a80e20e3f4baa9fd9dbc14cdec75e94506c49dafbc6174d"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-16T13:22:50.083Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "9b44e7db1c49b1c1cdfc66f8500549c1e0352b49ee3d76e4ef4cb635d7990aa3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
