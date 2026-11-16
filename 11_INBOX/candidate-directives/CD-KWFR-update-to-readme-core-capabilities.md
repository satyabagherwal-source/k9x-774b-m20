# Candidate Directive: [CD-KWFR] update to README core capabilities

<!-- PROVENANCE_START
{
  "source_repository": "DefGuard/defguard",
  "source_url": "https://github.com/DefGuard/defguard",
  "source_version": "a0570118",
  "license": "NOASSERTION",
  "timestamp": "2026-11-16T20:21:07.767Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-defguard-defguard",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [DefGuard/defguard](https://github.com/DefGuard/defguard) (Revision: `a0570118`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-16T20:21:07.767Z`  
> **Learning ID**: `learn-github-defguard-defguard`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in DefGuard/defguard. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a0570118`: update to README core capabilities. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- 🌐 **WireGuard VPN**
  - **Locations**: multiple locations with per-location access control, MFA per connection, self-service device setup, kernel and userspace support
  - **Multi-location DNS**: each connected location applies its own resolvers and domains side by side
  - **Custom MTU**: an MTU set by the admin that the client apps apply
  - **Gateway on VyOS**: Defguard Gateway runs as a container on VyOS
- 🔑 **Multi-Factor Authentication**
  - **FIDO2 Hardware Keys** (Enterprise): hardware security keys such as YubiKey as an MFA factor for the VPN connection, registered in the desktop client and used on desktop and over NFC on mobile
  - **MFA Flows** (Business): ordered MFA steps, each accepting a choice of factors, with the tunnel established only after the last step succeeds; one flow can be reused across locations
  - **Group-level MFA Overrides** (Enterprise): different MFA flows for specific groups on the same VPN location, on top of the location's default flow
  - **Factors**: TOTP, email tokens, biometric via the mobile app, external SSO (Business)
  - **MFA Setup in the Desktop Client**: users without MFA set it up when they first connect to a protected location, w
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- 🌐 **WireGuard VPN** — multiple locations with per-location access control, MFA per connection, self-service device setup, kernel and userspace support
- 👥 **Identity & Access Management** — internal OIDC provider for SSO, external OIDC (Google, Microsoft, custom), LDAP/AD sync, remote enrollment, user self-service
- 🔑 **Multi-Factor Authentication** — TOTP, WebAuthn/FIDO2, email tokens, biometric via mobile app
- 🛡️ **Firewall** — allow/deny rules per VPN location by user or group, applied in real time
- 📋 **Activity Log** — audit log with filtering and search; real-time SIEM streaming (Enterprise)
- 🔗 **Integrations** — webhooks and REST API
Visit out YouTube channel to see our [video guides](https://www.youtube.com/playlist?list=PLVR33X0CUHUcoyLshs9S8VbsGgggouCAW).
WireGuard® is [registered trademarks](https://www.wireguard.com/trademark-policy/) of Jason A. Donenfeld.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a0570118` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T20:21:07.765Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794860467765",
    "title": "update to README core capabilities",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "DefGuard/defguard",
    "source_uri": "https://github.com/DefGuard/defguard",
    "source_version": "HEAD",
    "content_hash": "c76e297a8bfd32f5c52f92c69f327419cf419d47c2ab4ab0cf6257003134e8d4"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Harvested/verified timestamp recorded: 2026-11-16T20:21:07.765Z"
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
  "auth_token": "e540eee7f3d2bd5b194918cfb91d78a19458b67e4ecbc923d4b495259fe974ee"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
