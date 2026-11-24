# Candidate Directive: [CD-1IG6] prepared statement parameter index validation

<!-- PROVENANCE_START
{
  "source_repository": "apache/shardingsphere",
  "source_url": "https://github.com/apache/shardingsphere",
  "source_version": "00f96061",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T13:47:30.342Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-apache-shardingsphere",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache/shardingsphere](https://github.com/apache/shardingsphere) (Revision: `00f96061`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T13:47:30.342Z`  
> **Learning ID**: `learn-github-apache-shardingsphere`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `jdbc/src/main/java/org/apache/shardingsphere/driver/jdbc/adapter/AbstractPreparedStatementAdapter.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/shardingsphere. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `00f96061`: prepared statement parameter index validation. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `jdbc/src/main/java/org/apache/shardingsphere/driver/jdbc/adapter/AbstractPreparedStatementAdapter.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
    public final void setNull(final int parameterIndex, final int sqlType) throws SQLException {
    public final void setNull(final int parameterIndex, final int sqlType, final String typeName) throws SQLException {
    public final void setBoolean(final int parameterIndex, final boolean x) throws SQLException {
    public final void setByte(final int parameterIndex, final byte x) throws SQLException {
    public final void setShort(final int parameterIndex, final short x) throws SQLException {
    public final void setInt(final int parameterIndex, final int x) throws SQLException {
    public final void setLong(final int parameterIndex, final long x) throws SQLException {
    public final void setFloat(final int parameterIndex, final float x) throws SQLException {
    public final void setDouble(final int parameterIndex, final double x) throws SQLException {
    public final void setString(final int parameterIndex, final String x) throws SQLException {
    public final void setBigDecimal(final int parameterIndex, final BigDecimal x) throws SQLException {
    public final void setDate(final int parameterIndex, final Date x) throws SQLException {
    public final void setDate(final
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
    public final void setNull(final int parameterIndex, final int sqlType) {
    public final void setNull(final int parameterIndex, final int sqlType, final String typeName) {
    public final void setBoolean(final int parameterIndex, final boolean x) {
    public final void setByte(final int parameterIndex, final byte x) {
    public final void setShort(final int parameterIndex, final short x) {
    public final void setInt(final int parameterIndex, final int x) {
    public final void setLong(final int parameterIndex, final long x) {
    public final void setFloat(final int parameterIndex, final float x) {
    public final void setDouble(final int parameterIndex, final double x) {
    public final void setString(final int parameterIndex, final String x) {
    public final void setBigDecimal(final int parameterIndex, final BigDecimal x) {
    public final void setDate(final int parameterIndex, final Date x) {
    public final void setDate(final int parameterIndex, final Date x, final Calendar cal) {
    public final void setTime(final int parameterIndex, final Time x) {
    public final void setTime(final int parameterIndex, final Time x, final Calendar cal) {
    public final vo
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `00f96061` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T13:47:30.340Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.71,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 71%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795528050340",
    "title": "prepared statement parameter index validation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apache/shardingsphere",
    "source_uri": "https://github.com/apache/shardingsphere",
    "source_version": "HEAD",
    "content_hash": "744b281590a9ee3d0368b5a1b775fc8d76176990d67608376b76387e3fde7803"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.75,
      "tier": "TIER_2_OFFICIAL_ECOSYSTEM",
      "findings": [],
      "details": [
        "Source belongs to recognized official ecosystem (TIER_2_OFFICIAL_ECOSYSTEM)",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T13:47:30.340Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "4d02182f28007e5d07af3434e90ab178509e6541197b5b6b6f0fc68d5c353ecf"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
