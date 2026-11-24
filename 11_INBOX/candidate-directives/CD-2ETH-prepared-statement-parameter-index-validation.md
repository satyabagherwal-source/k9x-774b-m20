# Candidate Directive: [CD-2ETH] prepared statement parameter index validation

<!-- PROVENANCE_START
{
  "source_repository": "apache-shardingsphere-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T13:48:12.157Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-apache-shardingsphere-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache-shardingsphere-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T13:48:12.157Z`  
> **Learning ID**: `LEARN-EVO-apache-shardingsphere-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T13:48:12.292Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795528092292",
    "title": "prepared statement parameter index validation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apache-shardingsphere-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "aa63b8de2e5511730d4c2b6214b35db32977f6564d04d039d3f728d05439068c"
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
        "Harvested/verified timestamp recorded: 2026-11-24T13:48:12.292Z"
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
  "auth_token": "dca5e7aa66173b57be8e97c13fcdd18b96784bc546bb62b696a5e92b4464ee23"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
