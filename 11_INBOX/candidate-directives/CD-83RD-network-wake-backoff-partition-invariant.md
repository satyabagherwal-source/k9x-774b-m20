# Candidate Directive: [CD-83RD] Network Wake-Backoff Partition Invariant

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
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Background network retry mechanisms executing immediately upon operating system sleep-to-wake transitions MUST classify DNS resolution failures (`.dnsLookupFailed`, `.cannotFindHost`) and initial transport disconnection (`.notConnectedToInternet`, `.networkConnectionLost`) as transient retryable states, and MUST provide an exponential backoff threshold window of at least 15 to 30 seconds.

**WHY**:
When an OS (specifically macOS) awakes from system sleep (e.g., lid open), the CPU immediately resumes paused threads and queues background workers *before* the network interface controller (NIC) has associated with the local Wi-Fi base station, completed the 802.11 4-way handshake, or obtained an IP/DNS lease via DHCP. If HTTP/gRPC clients fail fast on `URLError.notConnectedToInternet`, jobs resumed on wake fail immediately and transition permanently into dead-letter or "Needs Attention" states.

**WHEN TO APPLY**:
Any desktop or mobile application utilizing background workers, upload synchronization queues, or cloud API integrations executing across device sleep/wake boundaries.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
public struct CloudClient: Sendable {
    public var backend: String
    public var session: URLSession
    public var attempts = 5
    public var sleep: @Sendable (Duration) async throws -> Void = { try await Task.sleep(for: $0) }

    /// Dropped or not-yet-available connections.
    /// The offline errors matter after sleep: jobs resumed as the Mac wakes
    /// fire before Wi-Fi rejoins; ~15s-30s backoff bridges this latency window.
    public static let retriedNetworkErrors: Set<URLError.Code> = [
        .timedOut,
        .networkConnectionLost,
        .cannotConnectToHost,
        .notConnectedToInternet,
        .dnsLookupFailed,
        .cannotFindHost,
    ]

    public func send(_ request: URLRequest) async throws -> Data {
        var delay = Duration.seconds(1)
        for attempt in 1... {
            let last = attempt >= attempts
            do {
                let (data, response) = try await session.data(for: request)
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                if (200..<300).contains(status) { return data }
                if status == 401 || status == 403 {
                    throw CloudError.invalidKey(backend: backend)
                }
                guard (status == 429 || status >= 500), !last else {
                    throw CloudError.http(backend: backend, status: status, message: Self.message(in: data))
                }
                if let after = (response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Retry-After").flatMap(Double.init) {
                    delay = .seconds(min(after, 60))
                }
            } catch let error as URLError where !last && Self.retriedNetworkErrors.contains(error.code) {
                // Transient wake / offline condition: catch and proceed to sleep & backoff
            }

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T08:25:41.640Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795249541640",
    "title": "Network Wake-Backoff Partition Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yazinsai-openoats-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "d52ee3501d55f9030e5f978e4c38d41acbbc5d6e882169bfef32b7012150b6c3"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-21T08:25:41.640Z"
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
  "auth_token": "99dad80e8469e1bb6c6498b97fe44354d09875ff51593afb29954a736b990c0a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
