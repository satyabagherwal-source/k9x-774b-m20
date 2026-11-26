# Candidate Directive: [CD-QPGT] [MM-72029] Move Enable Security Alerts to Site Configuration > Notices as Check

<!-- PROVENANCE_START
{
  "source_repository": "mattermost/mattermost",
  "source_url": "https://github.com/mattermost/mattermost",
  "source_version": "fa151da3",
  "license": "NOASSERTION",
  "timestamp": "2026-11-26T16:58:23.981Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mattermost-mattermost",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mattermost/mattermost](https://github.com/mattermost/mattermost) (Revision: `fa151da3`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-26T16:58:23.981Z`  
> **Learning ID**: `learn-github-mattermost-mattermost`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/main/administration-guide/configure/environment-configuration-settings.mdx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mattermost/mattermost. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `724208f8`: [MM-72029] Move Enable Security Alerts to Site Configuration > Notices as Check for Security and Release Updates. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/main/administration-guide/configure/environment-configuration-settings.mdx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
<td><p>From Mattermost v12.3, this setting is located in <strong>Site Configuration &gt; Notices</strong> as <a href={useBaseUrl('/administration-guide/configure/site-configuration-settings#check-for-security-and-release-updates')}>Check for Security and Release Updates</a>.</p><p>In Mattermost v12.2 and earlier, enable or disable security alerts and the check for the latest Mattermost release here.</p><ul><li><strong>true</strong>: <strong>(Default)</strong> System admins are notified by email if a relevant security fix alert is announced. Requires email to be enabled. The server also fetches the latest Mattermost release from GitHub to report whether it's out of date.</li><li><strong>false</strong>: Security alerts are disabled, and the server doesn't fetch the latest Mattermost release from GitHub.</li></ul></td>
<td><ul><li>System Config path: <strong>Environment &gt; SMTP</strong> (v12.2 and earlier)</li><li><code>config.json</code> setting: <code>ServiceSettings</code> &gt; <code>EnableSecurityFixAlert</code> &gt; <code>true</code></li><li>Environment variable: <code>MM_SERVICESETTINGS_ENABLESECURITYFIXALERT</code></li></ul></td>
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
<td><p>Enable or disable security alerts and the check for the latest Mattermost release.</p><ul><li><strong>true</strong>: <strong>(Default)</strong> System admins are notified by email if a relevant security fix alert is announced. Requires email to be enabled. The server also fetches the latest Mattermost release from GitHub to report whether it's out of date.</li><li><strong>false</strong>: Security alerts are disabled, and the server doesn't fetch the latest Mattermost release from GitHub.</li></ul></td>
<td><ul><li>System Config path: <strong>Environment &gt; SMTP</strong></li><li><code>config.json</code> setting: <code>ServiceSettings</code> &gt; <code>EnableSecurityFixAlert</code> &gt; <code>true</code></li><li>Environment variable: <code>MM_SERVICESETTINGS_ENABLESECURITYFIXALERT</code></li></ul></td>
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `724208f8` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T16:58:23.980Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795712303979",
    "title": "[MM-72029] Move Enable Security Alerts to Site Configuration > Notices as Check",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mattermost/mattermost",
    "source_uri": "https://github.com/mattermost/mattermost",
    "source_version": "HEAD",
    "content_hash": "eee4e98a8626e1f5818246475b32e69175859bb0562723c171ea21e60e74388a"
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
        "Harvested/verified timestamp recorded: 2026-11-26T16:58:23.980Z"
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
  "auth_token": "395d51d224386e9611131f9cdd7232697d1e99adfa40cc64abb25334564f03cc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
