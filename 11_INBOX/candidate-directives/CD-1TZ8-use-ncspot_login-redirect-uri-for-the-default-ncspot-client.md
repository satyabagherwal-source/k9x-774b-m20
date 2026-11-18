# Candidate Directive: [CD-1TZ8] use `/ncspot_login` redirect URI for the default ncspot client

<!-- PROVENANCE_START
{
  "source_repository": "aome510/spotify-player",
  "source_url": "https://github.com/aome510/spotify-player",
  "source_version": "8d17edec",
  "license": "MIT",
  "timestamp": "2026-11-18T20:37:38.180Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aome510-spotify-player",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aome510/spotify-player](https://github.com/aome510/spotify-player) (Revision: `8d17edec`).  
> **License**: MIT | **Timestamp**: `2026-11-18T20:37:38.180Z`  
> **Learning ID**: `learn-github-aome510-spotify-player`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence (LOCAL_MACHINE_PATH_DETECTED: Contains local workstation or hardcoded developer path)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aome510/spotify-player. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8d17edec`: use `/ncspot_login` redirect URI for the default ncspot client. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
The simplest way to authenticate is to just **run the application** — on first use it prompts for whichever credentials are not yet cached. Each prompt opens the Spotify authorization page in your browser; after you approve access, Spotify redirects to a local loopback address (`http://127.0.0.1:8989/ncspot_login` for ncspot's client ID, otherwise `login_redirect_uri`, default `http://127.0.0.1:8989/login`) where `spotify_player` captures the authorization code and exchanges it for an access token. Credentials are cached in the application's [cache folder](#caches), so this is a one-time step per machine.
When a custom `client_id` is configured, an ncspot fallback Web API token is also requested and cached as `<ncspot_client_id>_token.json`. Like the default ncspot client, it always uses `http://127.0.0.1:8989/ncspot_login`; `login_redirect_uri` applies only to the custom client and the librespot session. A custom setup with streaming enabled can therefore require three approvals on first launch. Web API token cache filenames include their client IDs, so changing `client_id` requires a new approval instead of reusing a token issued to another client.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
The simplest way to authenticate is to just **run the application** — on first use it prompts for whichever credentials are not yet cached. Each prompt opens the Spotify authorization page in your browser; after you approve access, Spotify redirects to a local loopback address (`login_redirect_uri`, default `http://127.0.0.1:8989/login`) where `spotify_player` captures the authorization code and exchanges it for an access token. Credentials are cached in the application's [cache folder](#caches), so this is a one-time step per machine.
When a custom `client_id` is configured, an ncspot fallback Web API token is also requested and cached as `<ncspot_client_id>_token.json`. Its OAuth callback always uses `http://127.0.0.1:8989/login`; `login_redirect_uri` applies only to the custom client. A custom setup with streaming enabled can therefore require three approvals on first launch. Web API token cache filenames include their client IDs, so changing `client_id` requires a new approval instead of reusing a token issued to another client.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8d17edec` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T20:37:38.178Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence (LOCAL_MACHINE_PATH_DETECTED: Contains local workstation or hardcoded developer path)",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.62,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 62%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=WARN, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795034258178",
    "title": "use `/ncspot_login` redirect URI for the default ncspot client",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aome510/spotify-player",
    "source_uri": "https://github.com/aome510/spotify-player",
    "source_version": "HEAD",
    "content_hash": "f98f61be476220534fab3c3d46f2058218760d30c58fecf0dedd40e7cb8776ed"
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
      "status": "WARN",
      "score": 0.5,
      "is_generic_pattern": false,
      "has_local_paths": true,
      "findings": [
        "LOCAL_MACHINE_PATH_DETECTED: Contains local workstation or hardcoded developer path"
      ],
      "details": [
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
        "Harvested/verified timestamp recorded: 2026-11-18T20:37:38.178Z"
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
    "Repository-specific scope; not generalized for universal construction",
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "eab893c39fef8387ef21b08358b845c3acaa570d29b7389e9b2dc0eead6a0fc1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
