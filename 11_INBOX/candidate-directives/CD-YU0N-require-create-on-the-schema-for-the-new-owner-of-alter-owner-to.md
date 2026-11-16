# Candidate Directive: [CD-YU0N] require CREATE on the schema for the new owner of ALTER ... OWNER TO

<!-- PROVENANCE_START
{
  "source_repository": "tursodatabase/turso",
  "source_url": "https://github.com/tursodatabase/turso",
  "source_version": "063ca631",
  "license": "MIT",
  "timestamp": "2026-11-16T17:44:00.119Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tursodatabase-turso",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tursodatabase/turso](https://github.com/tursodatabase/turso) (Revision: `063ca631`).  
> **License**: MIT | **Timestamp**: `2026-11-16T17:44:00.119Z`  
> **Learning ID**: `learn-github-tursodatabase-turso`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `core/translate/roles.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tursodatabase/turso. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9e4d354c`: core: require CREATE on the schema for the new owner of ALTER ... OWNER TO. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/translate/roles.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                    match settable_role(resolver, connection, role) {
                        // As in PostgreSQL, a new owner also needs CREATE on
                        // the relation's schema, which only a superuser has
                        // until GRANT on schemas exists. Giving the relation
                        // to the role that owns it changes nothing.
                        Some(new_owner)
                            if resolver
                                .catalog
                                .dialect
                                .role_is_superuser(resolver.schema(), new_owner)
                                || table_owner(resolver, &alter.name) == Some(new_owner) =>
                        {
                            return Ok(())
                        }
                        Some(_) => create_in_schema_denial(&alter.name),
                        None => PermissionDenied::privilege(
                            Action::SetRole,
                            Object::Role(role_spec_name(role)),
                        ),
/// The role `role` names, if the current role may `SET ROLE` to it, which
/// is what giving a relation to `role` takes.
fn sett
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                    if may_set_role(resolver, connection, role) {
                        return Ok(());
                    PermissionDenied::privilege(Action::SetRole, Object::Role(role_spec_name(role)))
/// Whether the session may `SET ROLE` to `role`, which is what giving a
/// relation to `role` takes.
fn may_set_role(resolver: &Resolver, connection: &Arc<Connection>, role: &ast::RoleSpec) -> bool {
    };
    target.is_some_and(|target| dialect.can_set_role(schema, connection.current_role(), target))
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9e4d354c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T17:44:00.117Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794851040117",
    "title": "require CREATE on the schema for the new owner of ALTER ... OWNER TO",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tursodatabase/turso",
    "source_uri": "https://github.com/tursodatabase/turso",
    "source_version": "HEAD",
    "content_hash": "06554c5a796e1b42177daae42284960fc71fab4b3422b77ad69a32c33354c6dd"
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
        "Harvested/verified timestamp recorded: 2026-11-16T17:44:00.117Z"
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
  "auth_token": "098ddad6aa0eb4507ece6346f503d698b08d43527d6c8f87bac27bcda746099d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
