# Candidate Directive: [CD-GKJE] clean): bound container cache enumeration

<!-- PROVENANCE_START
{
  "source_repository": "tw93-mole-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T03:14:19.392Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tw93-mole-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tw93-mole-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T03:14:19.392Z`  
> **Learning ID**: `LEARN-EVO-tw93-mole-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain L

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `lib/clean/user.sh`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tw93/Mole. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2dd073d2`: clean): bound container cache enumeration. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `lib/clean/user.sh`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
# Complete, NUL-delimited directory snapshots for the container cache scans.
# A Bash glob opens the directory before any loop checkpoint can run (#1973).
# Keep both enumeration and sorting in the bounded producer, discard partial
# output on failure, and reuse the snapshot for counting and cleanup. Callers
# own the array so nested scans cannot replace another caller's candidates.
_container_cache_list_entries() {
    local entries_file="${2:-}"
    local owns_entries_file=false
    _MOLE_CONTAINER_CACHE_ENTRIES=()
    local timeout_seconds
    if ! timeout_seconds=$(_mole_timeout_with_deadline "$MOLE_TIMEOUT_MEDIUM_PROBE_SEC" \
        "${_MOLE_CLEAN_SECTION_DEADLINE:-}"); then
        debug_log "Container cache scan budget exhausted: $dir"
        return 1
    fi
    if [[ -z "$entries_file" ]]; then
        entries_file=$(create_temp_file) || return 1
        owns_entries_file=true
    fi
    local scan_rc=0
    run_with_timeout "$timeout_seconds" "$FIND_BSD" "$dir" \
        -mindepth 1 -maxdepth 1 -print0 > "$entries_file" 2> /dev/null || scan_rc=$?
    if [[ $scan_rc -eq 0 ]]; then
        if timeout_seconds=$(_mole_timeout_with_deadline "$MOLE_TIMEOUT_MEDIUM_PROBE_SEC" \
 
```

**NEGATIVE CONSTRAINT**:
```shell
// Induced defect failure mode:
# App caches (merged: macOS system caches + Sandboxed apps).
# Runs in the caller's shell and returns the count in
# CACHE_TOP_LEVEL_ENTRY_COUNT: it is called once per container, and a command
# substitution plus two $(shopt -p) captures cost three forks each time.
cache_top_level_entry_count_capped() {
    local cap="${2:-101}"

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T03:14:19.509Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794712459509",
    "title": "clean): bound container cache enumeration",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tw93-mole-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "67fa0fb3d752befb10a2b7a9bfb401339e3f707925a82ca755fe6bd4e9a5c015"
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
        "Harvested/verified timestamp recorded: 2026-11-15T03:14:19.510Z"
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
  "auth_token": "fe09492f50eb664cd312db20d502d2b0b23121a6a80b245117592365cde52bdf"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
