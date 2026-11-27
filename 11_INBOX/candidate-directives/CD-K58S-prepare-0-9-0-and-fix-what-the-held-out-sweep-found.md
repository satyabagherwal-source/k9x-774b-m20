# Candidate Directive: [CD-K58S] Prepare 0.9.0, and fix what the held-out sweep found

<!-- PROVENANCE_START
{
  "source_repository": "bahdotsh-wrkflw-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T07:49:05.385Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-bahdotsh-wrkflw-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [bahdotsh-wrkflw-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T07:49:05.385Z`  
> **Learning ID**: `LEARN-EVO-bahdotsh-wrkflw-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain A

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/release.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in bahdotsh/wrkflw. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7234f173`: Prepare 0.9.0, and fix what the held-out sweep found. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/release.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# A tag with a suffix, such as v0.9.0-rc.1, is a rehearsal: it builds the
# archives, publishes the runner base image and makes a GitHub pre-release,
# and leaves crates.io alone. Use one to try scripts/install.sh
# (WRKFLW_VERSION=v0.9.0-rc.1) and to make a new runner image's package
# public before the release that needs it. A rehearsal only warns about a
# private package, so once it is public, rerun its "Publish the runner base
# image" job and see it pass with no warning: that is the check a release
# stops on, and the rehearsal is the only place it runs before one.
      # private package breaks no run: it takes away the faster first run,
      # silently, on every machine. So a release stops here, before anything
      # is published, until the package is public (rerun this job then); a
      # rehearsal only says so, as it is how the package first appears.
          # Only a refusal says the package is private, and it comes from
          # either request: GHCR refuses an anonymous token for a private
          # package (403) before the manifest is asked for. Anything else,
          # such as a network error or a 5xx left after curl's retries, says
          # nothing abo
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
      # private package fails nothing; it only takes away the faster first
      # run. Say so, rather than fail the release.
          token=$(curl -fsS "https://ghcr.io/token?scope=repository:${name}:pull" | jq -r .token)
          if ! curl -fsS -o /dev/null \
              -H "Authorization: Bearer ${token}" \
              -H "Accept: application/vnd.oci.image.index.v1+json" \
              "https://ghcr.io/v2/${name}/manifests/${tag}"; then
            echo "::warning::${IMAGE} can't be pulled anonymously: make the package public in its settings, or wrkflw builds the image on each machine"
    # because publishing to crates.io is irreversible
    if: startsWith(github.ref, 'refs/tags/v')
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7234f173` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T07:49:05.542Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795765745542",
    "title": "Prepare 0.9.0, and fix what the held-out sweep found",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "bahdotsh-wrkflw-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1395ef39b0c5eeed0a34b9f06f47c88df3d951204d3d4f6302e30f91817b3c0c"
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
        "Harvested/verified timestamp recorded: 2026-11-27T07:49:05.543Z"
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
  "auth_token": "445ffc098c78e7e37af421a8e2a527d7219a401473782daa76b95c375adaf82f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
