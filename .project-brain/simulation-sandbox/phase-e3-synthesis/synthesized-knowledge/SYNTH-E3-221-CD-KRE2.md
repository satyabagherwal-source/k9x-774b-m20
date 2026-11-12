---
id: "SYNTH-E3-221-CD-KRE2"
directiveId: "CD-KRE2"
ordinalIndex: 221
title: "sha2: fix SHA-512 backend selection (#935)"
status: "REPOSITORY_SPECIFIC"
confidence: 0.45
primaryDomain: "M"
secondaryDomains: ["D", "G", "H", "I", "J", "K"]
targetFolder: "14_EVOLUTION"
sourceRepo: "RustCrypto/hashes"
sourceCommit: "7bd9889c"
parentDossier: "07_PROJECT_LEARNING/rustcrypto-hashes-learnings.md"
timestamp: "2026-11-12T18:54:42.680Z"
---

# sha2: fix SHA-512 backend selection (#935)

## 1. Problem Space & Context
In RustCrypto/hashes, unconstrained execution or missing invariant checks around 'sha2: fix SHA-512 backend selection (#935)' can induce silent runtime corruption, unexpected resource exhaustion, or deserialization failures during pipeline processing.

## 2. Technical Principle & Implementation Pattern
Enforce deterministic boundaries and explicit contract assertions for 'sha2: fix SHA-512 backend selection (#935)' prior to state mutation or execution dispatch.

## 3. Technical Rationale (WHY)
Mandatory technical rationale: Prevents silent state corruption and ensures predictable execution lifecycle across heterogeneous execution environments.

## 4. Operational Boundaries
### When to Apply
Apply whenever initializing, compiling, or executing pipelines interacting with RustCrypto/hashes architectural components or related runtime containers.

### When NOT to Apply
Do not apply in trivial, isolated mock test fixtures or read-only static schema inspection where runtime mutations cannot occur.

## 5. Negative Constraints (Anti-Patterns)
> [!WARNING]
> ANTI-PATTERN: Do NOT execute unvalidated or unbounded operations without strict pre-condition parameter clamping and boundary verification.

## 6. Failure Modes & Limitations
Unchecked execution leads to memory fragmentation, infinite decoding loops, or premature pipeline termination.

## 7. Implementation Guidance
Implement pre-execution contract checks, clamp all dynamic buffer allocations, and verify termination conditions at each iteration loop.

## 8. Verification Protocol
Execute automated property-based test harness validating boundary assertions and exit-code contracts with zero-network probes.

## 9. Provenance & Epistemic Audit
- **Repository**: `RustCrypto/hashes`
- **Revision Commit**: `7bd9889c`
- **Forensic Dossier**: `07_PROJECT_LEARNING/rustcrypto-hashes-learnings.md`
- **Verification Readiness**: `REPOSITORY_SPECIFIC`
