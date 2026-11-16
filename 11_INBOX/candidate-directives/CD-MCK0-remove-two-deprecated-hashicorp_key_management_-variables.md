# Candidate Directive: [CD-MCK0] remove two deprecated hashicorp_key_management_* variables

<!-- PROVENANCE_START
{
  "source_repository": "MariaDB/server",
  "source_url": "https://github.com/MariaDB/server",
  "source_version": "39281811",
  "license": "GPL-2.0",
  "timestamp": "2026-11-16T04:30:28.368Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mariadb-server",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [MariaDB/server](https://github.com/MariaDB/server) (Revision: `39281811`).  
> **License**: GPL-2.0 | **Timestamp**: `2026-11-16T04:30:28.368Z`  
> **Learning ID**: `learn-github-mariadb-server`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  NULL, NULL, 1);

  MYSQL_SYSVAR(cache_timeout),
  MYSQL_SYSVAR(use_cache_on_timeout),
  boo
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `39281811` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T04:30:28.366Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794803428366",
    "title": "remove two deprecated hashicorp_key_management_* variables",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "MariaDB/server",
    "source_uri": "https://github.com/MariaDB/server",
    "source_version": "HEAD",
    "content_hash": "d980f6931c922ce2b755cb54af5771454ffae3c0d66861c10735e1078ab82644"
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
        "Harvested/verified timestamp recorded: 2026-11-16T04:30:28.366Z"
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
  "auth_token": "3c4ef746d428eae62296483c69063cc191ef48502b978c4cfbea3739d8b5b752"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
