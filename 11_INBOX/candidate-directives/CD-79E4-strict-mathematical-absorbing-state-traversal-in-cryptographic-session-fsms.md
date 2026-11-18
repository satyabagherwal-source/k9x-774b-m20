# Candidate Directive: [CD-79E4] Strict Mathematical Absorbing State Traversal in Cryptographic Session FSMs

<!-- PROVENANCE_START
{
  "source_repository": "CrossPaste/crosspaste-desktop",
  "source_url": "https://github.com/CrossPaste/crosspaste-desktop",
  "source_version": "a38884fa",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-18T08:06:01.804Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-crosspaste-crosspaste-desktop",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [CrossPaste/crosspaste-desktop](https://github.com/CrossPaste/crosspaste-desktop) (Revision: `a38884fa`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-18T08:06:01.804Z`  
> **Learning ID**: `learn-github-crosspaste-crosspaste-desktop`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Finite state machines governing cryptographic pairing, mutual authentication, or cryptographic key exchange MUST declare absorbing terminal states whose successor sets are strictly empty (`emptySet()`). Non-terminal state transitions MUST be guarded by an immutable directed transition graph wherein the terminal trusted state is reachable ONLY from the strictly verified commit state. Transitioning from any terminal state to any other state MUST throw an invalid transition exception.

**WHY**:
Without an explicitly verified directed successor graph, race conditions in asynchronous network message handling can process out-of-order packets (e.g., an early `TRUSTED` intent or a late `PEER_CONFIRMED` message arriving after a session was marked `EXPIRED` or `FAILED`). If state transitions are checked with simple mutable assignments (`state = newState`), an attacker can revive an expired pairing session or skip PAKE verification through packet race manipulation.

**WHEN TO APPLY**:
Apply to any cryptographic handshaking mechanism, zero-knowledge proofs, SPAKE2/PAKE protocols, OAuth state trackers, or connection lifecycles across untrusted networks.

**VERIFIED IMPLEMENTATION PATTERN**:
```kotlin
// Verified Pattern: Cryptographic State Machine with Invariant Directed Successors
enum class PairingSessionState {
    INTENT_RECEIVED,
    PIN_AVAILABLE,
    PAKE_NEGOTIATING,
    PEER_CONFIRMED,
    COMMITTING,
    TRUSTED,
    REJECTED,
    CANCELLED,
    EXPIRED,
    FAILED;

    val isTerminal: Boolean
        get() = when (this) {
            TRUSTED, REJECTED, CANCELLED, EXPIRED, FAILED -> true
            else -> false
        }

    fun successors(): Set<PairingSessionState> = when (this) {
        INTENT_RECEIVED  -> setOf(PIN_AVAILABLE) + ABORT_STATES
        PIN_AVAILABLE    -> setOf(PAKE_NEGOTIATING) + ABORT_STATES
        PAKE_NEGOTIATING -> setOf(PIN_AVAILABLE, PEER_CONFIRMED) + ABORT_STATES
        PEER_CONFIRMED   -> setOf(COMMITTING) + ABORT_STATES
        COMMITTING       -> setOf(TRUSTED) + ABORT_STATES
        // Absorbing states have zero successors
        TRUSTED, REJECTED, CANCELLED, EXPIRED, FAILED -> emptySet()
    }

    fun transition(next: PairingSessionState): PairingSessionState {
        if (next == this && !isTerminal) return this
        if (next !in successors()) {
            throw IllegalStateException("Illegal cryptographic transition: $this -> $next")
        }
        return next
    }

    companion object {
        val ABORT_STATES: Set<PairingSessionState> = setOf(REJECTED, CANCELLED, EXPIRED, FAILED)
    }
}
```

**NEGATIVE CONSTRAINT**:
```kotlin
// ANTI-PATTERN: Mutable assignment without directed graph verification
class VulnerableSession {
    var state: PairingSessionState = PairingSessionState.INTENT_RECEIVED

    fun onPacket(packet: Packet) {
        // FATAL: Out-of-order network packets can revive terminated sessions
        // or bypass PAKE straight to TRUSTED
        if (packet.isConfirmed) {
            this.state = PairingSessionState.TRUSTED 
        }
    }
}
```

**VERIFICATION METHOD**:
Exhaustive matrix unit testing to prove no terminal state can transition to any other state:
```kotlin
@Test
fun `prove all terminal states are strictly absorbing`() {
    PairingSessionState.entries.filter { it.isTerminal }.forEach { terminalState ->
        PairingSessionState.entries.forEach { targetState ->
            assertFalse(
                terminalState.successors().contains(targetState),
                "Terminal state $terminalState leaked a transition to $targetState"
            )
        }
    }
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:06:01.801Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989161801",
    "title": "Strict Mathematical Absorbing State Traversal in Cryptographic Session FSMs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "CrossPaste/crosspaste-desktop",
    "source_uri": "https://github.com/CrossPaste/crosspaste-desktop",
    "source_version": "HEAD",
    "content_hash": "333d63381d2f385422b1b5e0ba2069ea653e101ca814cbc27b28e679a9553aff"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:06:01.802Z"
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
  "auth_token": "b64c921a68fa17a3f5e1e891278ce7285ad44c06daede0a7dd72b527ef22e669"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
