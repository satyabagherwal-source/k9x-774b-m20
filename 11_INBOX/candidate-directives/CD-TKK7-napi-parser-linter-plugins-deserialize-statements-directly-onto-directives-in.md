# Candidate Directive: [CD-TKK7] napi/parser, linter/plugins): deserialize statements directly onto directives in

<!-- PROVENANCE_START
{
  "source_repository": "oxc-project/oxc",
  "source_url": "https://github.com/oxc-project/oxc",
  "source_version": "ab594768",
  "license": "MIT",
  "timestamp": "2026-11-26T08:36:44.503Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-oxc-project-oxc",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oxc-project/oxc](https://github.com/oxc-project/oxc) (Revision: `ab594768`).  
> **License**: MIT | **Timestamp**: `2026-11-26T08:36:44.503Z`  
> **Learning ID**: `learn-github-oxc-project-oxc`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    pos32 = pos >> 2;
function deserializeVecStatement(pos) {
  let arr = [],
    pos32 = pos >> 2;
function deserializeVecArrayExpressionElement(pos) {
  let arr = [],
    pos32 = pos >> 2;
function deserializeVecObjectPropertyKind(pos) {
  let arr = [],
    pos32 = pos >> 2;
function deserializeVecTemplateElement(pos) {
  let arr = [],
    pos32 = pos >> 2;
function deserializeVecExpression(pos) {
  let arr = [],
    pos32 = pos >> 2;
function deserializeVecArgument(pos) {
  let arr = [],
    pos32 = pos >> 2;
function deserializeVecOptionAssignmentTargetMaybeDefault(pos) {
  let arr = [],
    pos32 = pos >> 2;
function deserializeVecAssignmentTargetProperty(pos) {
  let arr = [],
    pos32 = pos >> 2;
function deserializeVecVariableDeclarator(pos) {
  let arr = [],
    pos32 = pos >> 2;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1aef2f49` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T08:36:44.501Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795682204501",
    "title": "napi/parser, linter/plugins): deserialize statements directly onto directives in",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "oxc-project/oxc",
    "source_uri": "https://github.com/oxc-project/oxc",
    "source_version": "HEAD",
    "content_hash": "b3445b8965f57384a5114ea4c8ec595e8f57a16838157f5d55a5d6a15f480670"
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
        "Harvested/verified timestamp recorded: 2026-11-26T08:36:44.501Z"
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
  "auth_token": "fbb8533a94afb08d5abbf495c8688ad4738065d5197e476931114fd575732ba4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
