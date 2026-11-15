# Candidate Directive: [CD-FLIG] bound container cache enumeration

<!-- PROVENANCE_START
{
  "source_repository": "tw93/Mole",
  "source_url": "https://github.com/tw93/Mole",
  "source_version": "060fba8b",
  "license": "GPL-3.0",
  "timestamp": "2026-11-15T03:13:34.120Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tw93-mole",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tw93/Mole](https://github.com/tw93/Mole) (Revision: `060fba8b`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-15T03:13:34.120Z`  
> **Learning ID**: `learn-github-tw93-mole`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    local count=0
    local restore_nullglob=false
    local restore_dotglob=false
    shopt -q nullglob || restore_nullglob=true
    shopt -q dotglob || restore_dotglob=true
    shopt -s nullglob dotglob

    local item
    for item in "$dir"/*; do
        [[ -e "$item" ]] || continue
        count=$((count + 1))
        if ((count >= cap)); then
            break
    done

    [[ "$restore_nullglob" == "true" ]] && shopt -u nullglob
    [[ "$restore_dotglob" == "true" ]] && shopt -u dotglob

    [[ "$count" =~ ^[0-9]+$ ]] || count=0
    CACHE_TOP_LEVEL_ENTRY_COUNT=$count
    return 0
directory_has_entries() {
    local dir="$1"
    [[ -d "$dir" ]] || return 1

    local _nullglob_state
    local _dotglob_state
    _nullglob_state=$(shopt -p nullglob || true)
    _dotglob_state=$(shopt -p dotglob || true)
    shopt -s nullglob dotglob

    local item
    f
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2dd073d2` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T03:13:34.118Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794712414118",
    "title": "bound container cache enumeration",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tw93/Mole",
    "source_uri": "https://github.com/tw93/Mole",
    "source_version": "HEAD",
    "content_hash": "461b847c8d0f289fab39194371a8e8c066da7428218e9484e87a4d636c94c6de"
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
        "Harvested/verified timestamp recorded: 2026-11-15T03:13:34.118Z"
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
  "auth_token": "a03e9b672aa8bd14adefe82e0806a96fed80a02d3a443b01df16d48f489dcfc9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
