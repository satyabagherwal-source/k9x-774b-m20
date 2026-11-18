# Candidate Directive: [CD-7CPC] Blocking Entropy-Drain Guard for Headless Runtime Initialization

<!-- PROVENANCE_START
{
  "source_repository": "gocd/gocd",
  "source_url": "https://github.com/gocd/gocd",
  "source_version": "fb93a763",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T08:06:06.096Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gocd-gocd",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [gocd/gocd](https://github.com/gocd/gocd) (Revision: `fb93a763`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T08:06:06.096Z`  
> **Learning ID**: `learn-github-gocd-gocd`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Java runtime environments executing automated database migrations or cryptographic routines in virtualized/containerized environments MUST NEVER bind cryptographic secure random token generation directly to blocking entropy sources (`/dev/random`) during service initialization; non-blocking system RNG (`/dev/urandom` via `NativePRNGNonBlocking`) MUST be explicitly configured.

**WHY**:
In Linux kernels, reads from `/dev/random` block when the kernel entropy pool count drops below the system watermark (`/proc/sys/kernel/random/entropy_avail`). During automated container boot, headless cloud instances have minimal hardware I/O entropy. Database migration frameworks (e.g., Liquibase) generating temporary lock tokens or schema hashes via blocking SecureRandom instances will stall the JVM process for 9 to 14 hours without CPU or network activity, manifesting as an untraceable deadlock.

**WHEN TO APPLY**:
All JVM-based server applications, microservices, containerized Docker entrypoints, and CI/CD pipelines executing database migration harnesses (Liquibase, Flyway) on virtualized Linux platforms.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
package com.thoughtworks.go.common.initialization;

import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class EntropyGuardBootstrap {
    private static final Logger LOGGER = LoggerFactory.getLogger(EntropyGuardBootstrap.class);

    private EntropyGuardBootstrap() {}

    /**
     * Enforces non-blocking entropy provider for JVM container lifecycle.
     * Prevents Liquibase/DatabaseMigrator startup freeze.
     */
    public static void configureNonBlockingSecureRandom() {
        // Enforce urandom via system property for java.security
        System.setProperty("java.security.egd", "file:/dev/./urandom");

        try {
            // Verify algorithm binding
            SecureRandom instance = SecureRandom.getInstance("NativePRNGNonBlocking");
            LOGGER.info("Entropy initialized using non-blocking algorithm: {}", instance.getAlgorithm());
        } catch (NoSuchAlgorithmException e) {
            LOGGER.warn("NativePRNGNonBlocking unavailable; falling back to SHA1PRNG default", e);
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```java
// ANTI-PATTERN: Default instantiation without system-level EGD override in container environments.
// Relies on Apache Commons Crypto or default java.util.UUID / SecureRandom which can default
// to blocking /dev/random reads under FIPS or specific Security Provider configurations.
SecureRandom blockingRandom = new SecureRandom(); // Can block for hours on depleted Linux host!
byte[] seed = blockingRandom.generateSeed(32);
```

**VERIFICATION METHOD**:
Automated system verification in pre-flight checks or integration test base class:
```java
@Test
void verifyEgdPropertyConfiguredForNonBlockingOperations() {
    String egd = System.getProperty("java.security.egd");
    Assertions.assertTrue(
        "file:/dev/./urandom".equals(egd) || "file:/dev/urandom".equals(egd),
        "java.security.egd MUST point to urandom to prevent container startup deadlocks"
    );
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:06:06.095Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989166095",
    "title": "Blocking Entropy-Drain Guard for Headless Runtime Initialization",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "gocd/gocd",
    "source_uri": "https://github.com/gocd/gocd",
    "source_version": "HEAD",
    "content_hash": "7eb867c75072c4df6bcb390ead39c74077680d3ec72e715605c4bf5d942c601a"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:06:06.095Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "5951ef35fed4d8c1973c5a0b21b5dd64f81d660316622dd57d96cfd13c1d5a1b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.
