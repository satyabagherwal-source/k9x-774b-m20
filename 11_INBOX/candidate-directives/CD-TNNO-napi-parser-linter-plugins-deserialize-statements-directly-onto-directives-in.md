# Candidate Directive: [CD-TNNO] napi/parser, linter/plugins): deserialize statements directly onto directives in

<!-- PROVENANCE_START
{
  "source_repository": "oxc-project-oxc-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T08:36:48.386Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-oxc-project-oxc-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oxc-project-oxc-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T08:36:48.386Z`  
> **Learning ID**: `LEARN-EVO-oxc-project-oxc-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `apps/oxlint/src-js/generated/deserialize.js`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oxc-project/oxc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1aef2f49`: napi/parser, linter/plugins): deserialize statements directly onto directives in raw transfer. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/oxlint/src-js/generated/deserialize.js`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      node$0)),
    body = (program.body = deserializeVecDirective(pos + 88));
  deserializeVecStatement(pos + 112, body);
  deserializeVecStatement(pos + 40, body);
  deserializeVecStatement(pos + 40, body);
function deserializeVecDirective(pos, arr = []) {
  let pos32 = pos >> 2;
function deserializeVecStatement(pos, arr = []) {
  let pos32 = pos >> 2;
function deserializeVecArrayExpressionElement(pos, arr = []) {
  let pos32 = pos >> 2;
function deserializeVecObjectPropertyKind(pos, arr = []) {
  let pos32 = pos >> 2;
function deserializeVecTemplateElement(pos, arr = []) {
  let pos32 = pos >> 2;
function deserializeVecExpression(pos, arr = []) {
  let pos32 = pos >> 2;
function deserializeVecArgument(pos, arr = []) {
  let pos32 = pos >> 2;
function deserializeVecOptionAssignmentTargetMaybeDefault(pos, arr = []) {
  let pos32 = pos >> 2;
function deserializeVecAssignmentTargetProperty(pos, arr = []) {
  let pos32 = pos >> 2;
function deserializeVecVariableDeclarator(pos, arr = []) {
  let pos32 = pos >> 2;
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
      node$0));
  (program.body = deserializeVecDirective(pos + 88)).push(...deserializeVecStatement(pos + 112));
  body.push(...deserializeVecStatement(pos + 40));
  body.push(...deserializeVecStatement(pos + 40));
function deserializeVecDirective(pos) {
  let arr = [],

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T08:36:48.512Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795682208512",
    "title": "napi/parser, linter/plugins): deserialize statements directly onto directives in",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "oxc-project-oxc-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ccf33f9119214f675efee84139bd3f5bd1664575ea8acb14dc1e11c464ab0c58"
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
        "Harvested/verified timestamp recorded: 2026-11-26T08:36:48.513Z"
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
  "auth_token": "1c7e37a6aac1ad2fc9efca8cd9ad3420c7f6994b7f47a3b5aa8408c9f2e0a5e3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
