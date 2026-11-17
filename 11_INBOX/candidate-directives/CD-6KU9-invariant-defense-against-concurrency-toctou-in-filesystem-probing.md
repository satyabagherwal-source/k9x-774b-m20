# Candidate Directive: [CD-6KU9] Invariant Defense Against Concurrency TOCTOU in Filesystem Probing

<!-- PROVENANCE_START
{
  "source_repository": "trinodb-trino-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:45:49.058Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-trinodb-trino-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trinodb-trino-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:45:49.058Z`  
> **Learning ID**: `LEARN-EVO-trinodb-trino-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:45:49.182Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794905149182",
    "title": "Invariant Defense Against Concurrency TOCTOU in Filesystem Probing",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trinodb-trino-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "da5aa176d54cc3ed7f8778c1d0b4067ae13fd5150a6bf677edac2c41de562255"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:45:49.182Z"
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
  "auth_token": "c89db06c484553d8f585703a8006c1f7ef56757a8458ac2566d17a54b33192e5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
