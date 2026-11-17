# Candidate Directive: [CD-3RKU] Invariant Defense Against Concurrency TOCTOU in Filesystem Probing

<!-- PROVENANCE_START
{
  "source_repository": "trinodb/trino",
  "source_url": "https://github.com/trinodb/trino",
  "source_version": "d97ac24e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T08:43:37.951Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-trinodb-trino",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trinodb/trino](https://github.com/trinodb/trino) (Revision: `d97ac24e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T08:43:37.951Z`  
> **Learning ID**: `learn-github-trinodb-trino`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Code MUST NOT invoke existence checks (e.g., `Files.exists(path)`) prior to state read or write operations to decide flow control. Operations MUST directly attempt the required I/O operation and catch precise underlying platform exceptions (e.g., `NoSuchFileException`, `FileAlreadyExistsException`) within the operational boundary.

**WHY**:
Stateless checks (`Files.exists(path)`) create a Time-of-Check to Time-of-Use (TOCTOU) race condition. Between the return of `Files.exists()` and the execution of `Files.readString()`, concurrent processes or OS-level file operations can delete, truncate, or rewrite the resource. Relying on boolean pre-checks causes transient, hard-to-reproduce unhandled runtime failures (e.g., `NoSuchFileException` escaping to caller threads as an `UncheckedIOException`).

**WHEN TO APPLY**:
Apply across any filesystem access, token caching, credential retrieval, lock-file acquisition, or socket probing in multi-threaded or multi-process systems (Java NIO, Python `pathlib`, POSIX C/C++, Go `os`).

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Production-grade pattern from io.trino.client.auth.external.SystemCachedKnownToken
public Optional<Token> getToken()
{
    // Never do: if (!Files.exists(tokenFile)) return Optional.empty();
    try {
        String content = Files.readString(tokenFile).trim();
        if (content.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new Token(content));
    }
    catch (NoSuchFileException e) {
        // Safe: File was deleted or did not exist at the exact moment of open syscall
        return Optional.empty();
    }
    catch (IOException e) {
        throw new UncheckedIOException("Failed to read token from " + tokenFile, e);
    }
}
```

**NEGATIVE CONSTRAINT**:
```java
// ANTI-PATTERN: TOCTOU race hazard
public Optional<Token> getTokenBuggy()
{
    if (!Files.exists(tokenFile)) { // Time of check
        return Optional.empty();
    }
    // Race window: Another thread/process can delete tokenFile here!
    try {
        String content = Files.readString(tokenFile).trim(); // Time of use -> Throws NoSuchFileException!
        return Optional.of(new Token(content));
    }
    catch (IOException e) {
        throw new UncheckedIOException(e); // Fatal crash on normal concurrent operation
    }
}
```

**VERIFICATION METHOD**:
Enforce static analysis rule banning `Files.exists` immediately followed by `Files.read*` or `Files.newInputStream`. Verify via concurrent stress test spawning 1 writer loop and 1 reader loop over a single file path executing concurrently for >= 3 seconds without catching uncaught I/O exceptions.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:43:37.948Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794905017948",
    "title": "Invariant Defense Against Concurrency TOCTOU in Filesystem Probing",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trinodb/trino",
    "source_uri": "https://github.com/trinodb/trino",
    "source_version": "HEAD",
    "content_hash": "8d439a88034586d3b523c90d5fc959c16cb80b7a0d0a0d0563a6dfa98f55fca0"
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
        "Expresses generalized engineering invariants (6 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:43:37.948Z"
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
  "auth_token": "93445fe9d59b37e94b15d7fbf32fd5e0facc889579faca7b630b4b4a1833b32a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
