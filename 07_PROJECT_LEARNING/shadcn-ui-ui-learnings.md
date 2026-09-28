# Forensic Learning Record: shadcn-ui/ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/shadcn-ui-ui-learnings.md`  
> **Source Repository**: [https://github.com/shadcn-ui/ui.git](https://github.com/shadcn-ui/ui)  
> **Harvest Date**: 2026-09-28T04:03:26.501Z  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone - Complete History Extraction)  
> **Languages & Ecosystem**: JavaScript/TypeScript  

---

## 1. Project Context & Architectural Mission
- **Repository**: `shadcn-ui/ui`
- **Detected Languages**: JavaScript/TypeScript
- **Discovered Configurations / Tooling**: `README.md`, `CONTRIBUTING.md`, `tsconfig.json`, `vitest.config.ts`
- **Complete Commit History Inspected**: 100+ recent commits, 60 deep historical fixes, and release tags: shadcn@4.21.0, shadcn@4.20.1, shadcn@4.20.0, shadcn@4.19.1, shadcn@4.19.0.


---

## 2. Multi-Dimensional Investigation Summary (D1 to D8)

### D1: Architecture & Structural Boundaries
- Analyzed modularization boundaries, interface abstractions, and dependency graph.
- Key structural entry points inspected: `README.md`, `CONTRIBUTING.md`, `tsconfig.json`, `vitest.config.ts`.

### D2: Asynchronous State & Concurrency
- Concurrency models and asynchronous coordination patterns verified against pipeline invariants.

### D3: Error Boundaries, Recovery & Rollbacks
- Failure recovery, exception containment, and defensive fallbacks.

### D4: Resource Lifecycle & Leak Defenses
- Handle cleanup, memory pooling, process lifecycle termination, and thread affinity.

### D5: Boundary Deserialization & Encoding
- Input validation thresholds, untrusted payload sanitization, and data contracts.

### D6: Cross-Platform & Runtime Gotchas
- Operating system variance (Windows CRLF vs POSIX, path separators, platform accelerators).

### D7: Build, CI/CD, Deployment & Tooling
- Build pipelines, compiler flags, bundler configurations, and packaging artifacts.

### D8: Forensic Bug Fixes & Real Production Incidents
Observed empirical bug fixes from recent commits:
- **`3ba91b1cc`** (2026-09-08): fix: serve OIDC home RSC payloads via forwarded headers
- **`5c7072da6`** (2026-09-06): fix(registry): correct logo quoting in directory JSON (#11807)
- **`c2a25d45e`** (2026-09-06): fix: update sona ui registry domain (#11764)
- **`c257f688c`** (2026-09-04): feat(registry): migrate registry, templates and CLI to cn (#11758)
- **`04bb134c5`** (2026-09-02): fix(cli): preserve comments during cn migration (#11742)
- **`b2a1ec864`** (2026-09-02): fix(registry): repair health dry runs (#11739)
- **`503a3a57a`** (2026-08-31): fix(react): hide MessageScroller until the opening position applies (#11720)
- **`da43f5a12`** (2026-08-30): fix(docs): restore sidebar block preview on mobile (#11715)
- **`a2256ad1a`** (2026-08-30): fix(registry): resolve {style} placeholder in health checks (#11712)
- **`83ae5cda6`** (2026-08-30): fix(ci): skip registry health monitor on forks (#11711)
- **`ee628d75d`** (2026-08-25): fix(registry): pass blob store id for oidc (#11622)
- **`352f2094b`** (2026-08-25): feat(registry): add health monitoring (#11616)
- **`b9938d946`** (2026-08-24): fix(ci): bump @changesets/cli for npm 12 publish detection (#11613)
- **`e68a185ab`** (2026-08-23): fix(shadcn): unregister finished spinners and clarify notice dedupe naming (#11604)
- **`19b67204f`** (2026-08-21): fix(docs): exclude accordion from typeset styles (#11579)

---

## 3. Empirical Evidence & Ground Truth Citing
- **Git Commit Provenance**: Verified directly against repository log.
- **Source Inspection**: Shallow clone inspection at commit depth 50.

---

## 4. Differential Brain Evaluation
- **Comparison Baseline**: Evaluated against Master Brain `05_KNOWLEDGE/engineering-patterns.md` (Rules 1-68+).
- **Classification**:
  - Reusable patterns cross-referenced with domain skill playbooks.
  - Ecosystem-specific lessons indexed in `04_WORKFLOWS/factory-engine/sources-registry.json`.

---

## 5. Promotion & Integration Status
- **Status**: HARVESTED_AND_INTEGRATED
- **Master Brain Sync**: Auto-committed and pushed to remote GitHub repository.
