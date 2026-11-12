---
id: "SYNTH-E3-256-CD-0Y85"
directiveId: "CD-0Y85"
ordinalIndex: 256
title: "security): validate Host header on /api/* to block DNS rebinding (#61)"
status: "REPOSITORY_SPECIFIC"
confidence: 0.45
primaryDomain: "D"
secondaryDomains: ["G", "H", "I", "J", "K", "M"]
targetFolder: "11_INBOX"
sourceRepo: "nexu-io/html-anything"
sourceCommit: "975fb3bc"
parentDossier: "07_PROJECT_LEARNING/nexu-io-html-anything-learnings.md"
timestamp: "2026-11-12T18:54:42.844Z"
---

# security): validate Host header on /api/* to block DNS rebinding (#61)

## 1. Problem Space & Context
In nexu-io/html-anything, unconstrained execution or missing invariant checks around 'security): validate Host header on /api/* to block DNS rebinding (#61)' can induce silent runtime corruption, unexpected resource exhaustion, or deserialization failures during pipeline processing.

## 2. Technical Principle & Implementation Pattern
Enforce deterministic boundaries and explicit contract assertions for 'security): validate Host header on /api/* to block DNS rebinding (#61)' prior to state mutation or execution dispatch.

## 3. Technical Rationale (WHY)
Mandatory technical rationale: Prevents silent state corruption and ensures predictable execution lifecycle across heterogeneous execution environments.

## 4. Operational Boundaries
### When to Apply
Apply whenever initializing, compiling, or executing pipelines interacting with nexu-io/html-anything architectural components or related runtime containers.

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
- **Repository**: `nexu-io/html-anything`
- **Revision Commit**: `975fb3bc`
- **Forensic Dossier**: `07_PROJECT_LEARNING/nexu-io-html-anything-learnings.md`
- **Verification Readiness**: `REPOSITORY_SPECIFIC`
