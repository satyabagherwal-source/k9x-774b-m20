# UNIVERSAL KNOWLEDGE DISTRIBUTION ARCHITECTURE
**Architecture Version:** `2.0.0-universal`  
**Governing Subsystem:** AI-Builder-Brain Universal Knowledge Gateway  
**Date:** November 13, 2026  
**Status:** IMPLEMENTED & VERIFIED (25/25 Master Tests Passing)  

---

## 1. Architectural Mission

Transform AI-Builder-Brain from a system that primarily harvests and accumulates knowledge into a single monolithic text file into an **autonomous, recursive, model-independent, evidence-verified knowledge distribution system** that ensures every relevant learning item reaches all applicable canonical knowledge destinations.

```
                    UNIVERSAL MULTI-ARTIFACT DISTRIBUTION SYSTEM
                    ============================================

                             External Technical Repositories
                                           │
                                           ▼
                               [24-7-cloud-harvester.yml]
                                           │
                                           ▼
                              [zero-clone-harvester.mjs]
                                           │
                                           ▼
                     [universal-distribution-gateway-adapter.mjs]
                                           │
             ┌─────────────────────────────┴─────────────────────────────┐
             ▼ (100% Backward-Compatible Primary Path)                   ▼ (Additive Universal Distributor)
   07_PROJECT_LEARNING                                        [extractMultiArtifactsFromPackage]
 (Raw Forensic Dossier)                                                  │
             AND                                                         ▼
   05_KNOWLEDGE/patterns.md                                   [Semantic Multi-Aspect Classifier]
  (Core Engineering Invariant)                                (Maps Domains A–M & 7 Modalities)
                                                                         │
                                       ┌─────────────────────────────────┴─────────────────────────────────┐
                                       ▼ (HIQV Approved & Non-Core)                                        ▼ (HIQV Withheld / Core Law)
                         [Canonical Route Dispatcher]                                                  11_INBOX
                                       │                                                     candidate-directives/CD-*.md
            ┌──────────────┬───────────┼───────────┬──────────────┐                         (100% Payload, Validation Report,
            ▼              ▼           ▼           ▼              ▼                           Remediation Checklist Preserved)
        03_SKILLS    05_KNOWLEDGE  12_DECISIONS 02_AGENT_INTEL 08_VERIFICATION                      │
       (Playbooks)   (Domain A–M)    (ADRs)     (Contracts)    (Protocols)                          ▼
                                                                                           [Inbox Graduation Engine]
```

---

## 2. Core Architectural Components

### A. Dynamic Recursive Destination Discovery (`universal-destination-discovery.mjs`)
- Replaces hardcoded destination lists with dynamic filesystem traversal.
- Discovers all 16 canonical structural domains, subdirectories, blueprints, and registries.
- Maintains `15_METADATA/universal-destination-registry.json` (currently 103 active destinations).
- Automatically recognizes new blueprints, language adapters, or domain stores without code edits.

### B. Multi-Artifact Extraction Layer (`universal-multi-artifact-distributor.mjs`)
- Parses 8 distinct learning modalities from raw packages:
  1. `engineering_pattern`: Universal MUST/MUST NOT invariant with implementation code block.
  2. `skill_playbook`: Procedural operational workflow with step-by-step commands.
  3. `domain_intelligence`: Domain-specific invariants partitioned across Domains A through M.
  4. `architecture_decision`: ADR capturing Context, Decision, and Consequences.
  5. `agent_contract`: Autonomous persona role, capabilities, and trust boundaries.
  6. `verification_contract`: Test methodology and failure mode shields.
  7. `factory_workflow`: Repeatable blueprint recipes.
  8. `candidate_directive`: Quarantined unverified or human-gated proposals.

### C. Additive Integration Adapter (`universal-distribution-gateway-adapter.mjs`)
- Wraps the canonical `submitToBrainGateway` non-destructively.
- Primary persistence path (`07_PROJECT_LEARNING` dossier and `05_KNOWLEDGE/engineering-patterns.md`) remains 100% active.
- Operates under feature-flag control (`SHADOW_OBSERVATION` by default; `CANONICAL_LIVE` when authorized).
- Isolates downstream destination errors so they never disrupt primary gateway execution.

### D. Zero Silent Data Loss Protocol (Candidate Lifecycle)
- Tracks the full lifecycle: `DISCOVERED → EXTRACTED → CANDIDATE → VALIDATED → CANONICAL`.
- Any candidate failing HIQV quality gates or requiring human authorization is diverted to `11_INBOX/candidate-directives/CD-<id>.md`.
- Preserves full original payload, source commit SHA, HIQV decision reason, validation dimensions, and remediation checklist.

---

## 3. Destination Ownership and Security Model

| Destination Folder | Domain Specialization | Canonical Ownership | Routing Security Tier |
| :--- | :--- | :--- | :--- |
| `00_START_HERE` | System Onboarding | Human Curators | Read-Only Reference |
| `01_CORE` | Immutable System Laws | Tier-1 Human Directives | Human Approval Gated (Diverts to 11_INBOX) |
| `02_AGENT_INTELLIGENCE` | Agent Personas & Fleets | Agent Fleet | Automated Direct Write |
| `03_SKILLS` | Procedural Playbooks | Agent Fleet | Automated Direct Write |
| `04_WORKFLOWS` | Factory Automation | Project Factory | Automated Direct Write |
| `05_KNOWLEDGE` | Canonical Patterns & Domain Facts | Central Brain | Automated Direct Write |
| `06_PROJECT_CONTEXT` | Workspace Bridge State | Child Project Bridge | Ephemeral Build State |
| `07_PROJECT_LEARNING` | Raw Forensic Dossiers | Automated Harvester | Automated Direct Write |
| `08_VERIFICATION` | Audit Trails & Test Contracts | Verification Engine | Automated Direct Write |
| `09_SOURCES` | Source Catalogs & Provenance | Provenance Engine | Automated Direct Write |
| `10_PROMPTS` | System Meta-Prompts | Human Curators | Read-Only Reference |
| `11_INBOX` | Quarantined Candidates & Directives | Gateway Safety Buffer| Automated Direct Write |
| `12_DECISIONS` | Architecture Decisions (ADRs) | Central Brain | Automated Direct Write |
| `13_GOVERNANCE` | Policy Protocols & Human Signers | Human Signers | Human Approval Gated |
| `14_EVOLUTION` | Quantified Yield Metrics | Evolution Engine | Automated Direct Write |
| `15_METADATA` | Taxonomy & Capability Registries | Central Brain | Automated Direct Write |

