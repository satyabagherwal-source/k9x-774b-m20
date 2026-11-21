# Candidate Directive: [CD-6XZA] Network Wake-Backoff Partition Invariant

<!-- PROVENANCE_START
{
  "source_repository": "yazinsai/OpenOats",
  "source_url": "https://github.com/yazinsai/OpenOats",
  "source_version": "2d6e6ce5",
  "license": "MIT",
  "timestamp": "2026-11-21T08:24:47.494Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-yazinsai-openoats",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yazinsai/OpenOats](https://github.com/yazinsai/OpenOats) (Revision: `2d6e6ce5`).  
> **License**: MIT | **Timestamp**: `2026-11-21T08:24:47.494Z`  
> **Learning ID**: `learn-github-yazinsai-openoats`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
            try await sleep(delay)
            delay *= 2
        }
        fatalError("unreachable")
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Failing immediately on transport-layer offline state
do {
    let (data, response) = try await session.data(for: request)
} catch let error as URLError {
    // FATAL FLAW: Treating lack of internet as permanent client failure
    if error.code == .notConnectedToInternet || error.code == .dnsLookupFailed {
        throw PermanentWorkerError.noNetwork // Aborts instantly on lid wake
    }
}
```

**VERIFICATION METHOD**:
Implement an automated unit test injecting a mock network session (`StubHTTP`) configured to throw `URLError(.notConnectedToInternet)` on attempt 1, `URLError(.dnsLookupFailed)` on attempt 2, and return `200 OK` on attempt 3. Assert that the client performs all 3 attempts without throwing, returning the successful payload.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T08:24:47.494Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795249487494",
    "title": "Network Wake-Backoff Partition Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yazinsai/OpenOats",
    "source_uri": "https://github.com/yazinsai/OpenOats",
    "source_version": "HEAD",
    "content_hash": "83c3413d4fb65f1204386bd35820b98922ae7dc54a65825771ba45b1a4c7a20f"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T08:24:47.494Z"
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
  "auth_token": "1d8846a0f251e3849b9b74ac7463498cddcc937c84e0c1c683480d8628ac4b59"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
