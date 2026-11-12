---
id: "SYNTH-E3-213-CD-O5WV"
directiveId: "CD-O5WV"
ordinalIndex: 213
title: "docs: rename CLAUDE.md to AGENTS.md and require the constitution (#1615)"
status: "REPOSITORY_SPECIFIC"
confidence: 0.45
primaryDomain: "M"
secondaryDomains: ["D", "G", "H", "I", "J", "K"]
targetFolder: "02_AGENT_INTELLIGENCE"
sourceRepo: "pamburus/hl"
sourceCommit: "3a71b1a5"
parentDossier: "07_PROJECT_LEARNING/arxanas-git-branchless-learnings.md"
timestamp: "2026-11-12T18:54:42.588Z"
---

# docs: rename CLAUDE.md to AGENTS.md and require the constitution (#1615)

## 1. Problem Space & Context
In pamburus/hl, unconstrained execution or missing invariant checks around 'docs: rename CLAUDE.md to AGENTS.md and require the constitution (#1615)' can induce silent runtime corruption, unexpected resource exhaustion, or deserialization failures during pipeline processing.

## 2. Technical Principle & Implementation Pattern
Enforce deterministic boundaries and explicit contract assertions for 'docs: rename CLAUDE.md to AGENTS.md and require the constitution (#1615)' prior to state mutation or execution dispatch.

## 3. Technical Rationale (WHY)
Mandatory technical rationale: Prevents silent state corruption and ensures predictable execution lifecycle across heterogeneous execution environments.

## 4. Operational Boundaries
### When to Apply
Apply whenever initializing, compiling, or executing pipelines interacting with pamburus/hl architectural components or related runtime containers.

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
- **Repository**: `pamburus/hl`
- **Revision Commit**: `3a71b1a5`
- **Forensic Dossier**: `07_PROJECT_LEARNING/arxanas-git-branchless-learnings.md`
- **Verification Readiness**: `REPOSITORY_SPECIFIC`
