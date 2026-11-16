# Candidate Directive: [CD-MG0M] remove two deprecated hashicorp_key_management_* variables

<!-- PROVENANCE_START
{
  "source_repository": "mariadb-server-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T04:30:32.762Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-mariadb-server-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mariadb-server-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T04:30:32.762Z`  
> **Learning ID**: `LEARN-EVO-mariadb-server-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `plugin/hashicorp_key_management/hashicorp_key_management_plugin.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MariaDB/server. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `39281811`: remove two deprecated hashicorp_key_management_* variables. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `plugin/hashicorp_key_management/hashicorp_key_management_plugin.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
  if ((rc= curl_run(url, &response_str, caching_enabled)) != OPERATION_OK)
  if ((rc= curl_run(url, &response_str, caching_enabled)) != OPERATION_OK)
  if (caching_enabled && key_version == ENCRYPTION_KEY_VERSION_INVALID)
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
static std::chrono::milliseconds cache_max_time;
  if (with_timeouts && elapsed_ms(info.timestamp, current_time) > cache_max_time)
  {
    return ENCRYPTION_KEY_VERSION_INVALID;
  }
#if MYSQL_VERSION_ID < 130300
static long long cache_timeout;         // for KEY_MAP key_info_cache
static char use_cache_on_timeout;
#endif
static void cache_timeout_update (MYSQL_THD thd,
                                  struct st_mysql_sys_var *var,
                                  void *var_ptr,
                                  const void *save)
{
  long long timeout = * (long long *) save;
  * (long long *) var_ptr = timeout;
  cache_max_time = std::chrono::milliseconds(timeout);
}

static MYSQL_SYSVAR_LONGLONG(cache_timeout, cache_timeout,
  PLUGIN_VAR_RQCMDARG | PLUGIN_VAR_DEPRECATED,
  "Cache timeout for key data (in milliseconds)",
  NULL, cache_timeout_update, INT64_MAX, 0, INT64_MAX, 1);

static MYSQL_SYSVAR_BOOL(use_cache_on_timeout, use_cache_on_timeout,
  PLUGIN_VAR_RQCMDARG | PLUGIN_VAR_DEPRECATED,
  "In case of an error when accessing the vault server "
  "use the value taken from the cache",

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T04:30:32.853Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794803432853",
    "title": "remove two deprecated hashicorp_key_management_* variables",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mariadb-server-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e6000fcaccd415f7358f8f1ff98eeae132dea075901a5eba4ccb4f30ce1ef344"
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
        "Harvested/verified timestamp recorded: 2026-11-16T04:30:32.853Z"
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
  "auth_token": "61d1310423057453dcd44a202964a740c8012bc6d87b65d7f4b027d9682b945b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
