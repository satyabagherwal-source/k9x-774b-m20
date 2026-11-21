# Candidate Directive: [CD-83RD] Presigned Host Boundary Validation for Third-Party Ingestion

<!-- PROVENANCE_START
{
  "source_repository": "yazinsai-openoats-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T08:25:41.528Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-yazinsai-openoats-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yazinsai-openoats-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T08:25:41.528Z`  
> **Learning ID**: `LEARN-EVO-yazinsai-openoats-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When an API workflow splits file upload and job submission across two phases (Phase 1: obtain presigned upload target; Phase 2: submit presigned URL to ingestion engine), the client MUST cryptographically/stringently validate that the received upload destination URL matches an explicit domain allowlist or the root API host before dispatching binary data or credentials.

**WHY**:
If an upstream service or man-in-the-middle responds with an arbitrary or hijacked `upload_url`, a client sending data or bearing authorization tokens to that URL can leak audio recordings, PII, or API keys to external, untrusted infrastructure (SSRF / Credential Reflection Attack).

**WHEN TO APPLY**:
All multi-step cloud transcription or blob upload architectures (e.g., AssemblyAI, AWS S3 presigned URLs, Google Cloud Storage signed endpoints).

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Inside AssemblyAITranscription.swift
let upload: Upload = try await send(
    url.appendingPathComponent("upload"), 
    body: try Data(contentsOf: chunk.url), 
    type: "application/octet-stream"
)

// Invariant: The upload address goes back to AssemblyAI with the key;
// strictly verify protocol and hostname suffix before delegating.
guard let audioURL = URL(string: upload.upload_url),
      audioURL.scheme == "https",
      let host = audioURL.host(),
      host == url.host() || host.hasSuffix(".assemblyai.com")
else {
    throw CloudError.badResponse(backend: client.backend)
}

// Safe to proceed with dispatching audio URL reference
var job: [String: Any] = ["audio_url": audioURL.absoluteString, "speaker_labels": diarize]
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Blindly trusting server-provided upload URLs
let upload: Upload = try await send(uploadInitURL)
// VULNERABILITY: If upload_url is redirected to "attacker-controlled-bucket.com",
// subsequent requests will upload sensitive unencrypted room audio directly to attacker.
var job = ["audio_url": upload.upload_url]
```

**VERIFICATION METHOD**:
Unit test setting `upload_url` to `https://evil-server.com/test.m4a` and `http://api.assemblyai.com/test.m4a` (unencrypted HTTP). Assert that both trigger `CloudError.badResponse` and abort before dispatching the job payload.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T08:25:41.641Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795249541641",
    "title": "Presigned Host Boundary Validation for Third-Party Ingestion",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yazinsai-openoats-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "3cd6ffa64bea38b39e67acf6f9e7fb6adb17d8a592df7be26326bd03e6246841"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T08:25:41.641Z"
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
  "auth_token": "bc2b7f349a4fb36fe91a2330017a90aca9291aa5c7e74a58f00e02e590052672"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
