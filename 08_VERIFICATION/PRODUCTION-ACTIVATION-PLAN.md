# AI-BUILDER-BRAIN — PRODUCTION ACTIVATION PLAN
## Phased Rollout, Feature Flag Governance & Approval Protocol

> **Mission**: Universal Knowledge Distribution & Persistence (Master Execution)  
> **Target Operation**: Promotion from Shadow Observation to Live Multi-Destination Persistence  
> **Approval Boundary Status**: PENDING USER EXPLICIT AUTHORIZATION (Dry-Run / Shadow Ready)  
> **Safety Baseline**: Pre-Universal Backup Verified (`.project-brain/backups/pre-universal-distribution/`)  
> **Date**: 2026-11-13  

---

## 1. Overview & Boundary Enforcement

In strict compliance with **Section 15 (Production Approval Boundary)** of the Master Specification, live multi-destination writes and historical canonical backfill are gated behind explicit user approval.

All underlying engines, discovery modules, registries, synchronizers, and adapters have been constructed, tested (25/25 Master Suite, 41/41 Gateway Suite, 12/12 Prototype Suite), and verified in isolated sandboxes and shadow-observation modes.

This document outlines the four-phase production rollout plan to be executed **only** upon receiving explicit authorization.

---

## 2. Prerequisite Quality Gates (All Currently Satisfied)

| Gate # | Prerequisite Description | Evidence Location | Status |
|---|---|---|---|
| **Gate 1** | SHA-256 Verified Pre-Migration Backup | `.project-brain/backups/pre-universal-distribution/` | **SATISFIED** |
| **Gate 2** | Dynamic Destination Discovery Active | `15_METADATA/universal-destination-registry.json` (102 destinations) | **SATISFIED** |
| **Gate 3** | Zero Silent Loss Fix Implemented & Tested | `04_WORKFLOWS/factory-engine/brain-learning-gateway.mjs` | **SATISFIED** |
| **Gate 4** | 25 Master Acceptance Tests Passing | `08_VERIFICATION/UNIVERSAL-DISTRIBUTION-MASTER-TEST-REPORT.json` | **SATISFIED** |
| **Gate 5** | Historical Backlog Dry-Run Completed | `08_VERIFICATION/HISTORICAL-BACKLOG-REDISTRIBUTION-DRY-RUN.md` | **SATISFIED** |
| **Gate 6** | 24/7 Cloud Harvester Operational Without Interruption | `.github/workflows/24-7-cloud-harvester.yml` (Runs verified green) | **SATISFIED** |

---

## 3. Four-Phase Rollout Roadmap

```
[ PHASE 1: SHADOW OBSERVATION ] ◄── (CURRENT OPERATING STATE)
              │
              ▼ [Requires User Approval Gate A]
[ PHASE 2: CANARY MULTI-DESTINATION WRITES ]
              │
              ▼ [Requires User Approval Gate B]
[ PHASE 3: FULL PRODUCTION MULTI-DESTINATION ACTIVATION ]
              │
              ▼ [Requires User Approval Gate C]
[ PHASE 4: CONTROLLED HISTORICAL BACKLOG BACKFILL ]
```

---

## 4. Phase-by-Phase Execution Details

### Phase 1: Shadow Observation (Current Active State)
- **Status**: ACTIVE & TESTED.
- **Engine**: `universal-distribution-gateway-adapter.mjs`.
- **Mode**: `SHADOW_OBSERVATION` (`ENABLE_UNIVERSAL_DISTRIBUTION_PRODUCTION_WRITES = false`).
- **Behavior**: Primary persistence to `07_PROJECT_LEARNING/` and `05_KNOWLEDGE/engineering-patterns.md` proceeds normally. Multi-artifact routing plans are computed and logged to telemetry, but no secondary files are written.

### Phase 2: Canary Activation (Approval Gate A)
- **Target**: Enable live writes restricted to a single intelligence domain (Domain C: Enterprise Software) and one skill modality.
- **Activation Command**:
  ```powershell
  $env:UNIVERSAL_DISTRIBUTION_CANARY_DOMAINS = "DOMAIN_C"
  $env:ENABLE_UNIVERSAL_DISTRIBUTION_PRODUCTION_WRITES = "true"
  ```
- **Verification Window**: 3 consecutive Cloud Harvester runs.
- **Pass Criteria**: New domain intelligence files written to `05_KNOWLEDGE/domain-intelligence/domain-c-enterprise/` with valid YAML frontmatter, verified SHA-256 hashes, and clean registry synchronizations.

### Phase 3: Full Production Activation (Approval Gate B)
- **Target**: Enable full multi-artifact fan-out across all 102 canonical destinations and 13 domains A–M.
- **Activation Flag**:
  Set permanent configuration in `04_WORKFLOWS/factory-engine/universal-distribution-gateway-adapter.mjs`:
  ```javascript
  const DEFAULT_DISTRIBUTION_MODE = DISTRIBUTION_MODES.CANONICAL_LIVE;
  ```
- **Operational Impact**: Every newly harvested learning package immediately distributes applicable artifacts to:
  - `03_SKILLS/playbooks/`
  - `02_AGENT_INTELLIGENCE/contracts/`
  - `05_KNOWLEDGE/domain-intelligence/domain-*/`
  - `12_DECISIONS/`
  - `08_VERIFICATION/contracts/`
  - `04_WORKFLOWS/factory-engine/blueprints/`
  - `11_INBOX/candidates/` (quarantined items)

### Phase 4: Controlled Historical Backlog Backfill (Approval Gate C)
- **Target**: Safely redistribute the 1,828 historical raw dossiers identified in `HISTORICAL-BACKLOG-REDISTRIBUTION-DRY-RUN.md`.
- **Strategy**: Incremental bounded batch processing.
  - Batch Size: 50 dossiers per execution cycle.
  - Checkpoint File: `08_VERIFICATION/backlog-backfill-progress.json`.
  - Pause Condition: Any single SHA-256 read-back mismatch halts the batch immediately.
- **Execution Script**:
  ```powershell
  node 04_WORKFLOWS/factory-engine/historical-backlog-redistributor.mjs --execute --batch-size 50
  ```
- **Idempotency Guarantee**: `SUPPRESSED_DUPLICATE` ensures re-running the script produces 0 redundant writes.

---

## 5. Explicit Approval Gate Prompts for the User

When the user chooses to proceed with activation, the following exact commands will be requested:

1. **For Phase 2 (Canary)**:
   > "Approve Phase 2 Canary activation for Domain C."
2. **For Phase 3 (Full Live Writes)**:
   > "Approve Phase 3 Full Production Activation of Universal Distribution."
3. **For Phase 4 (Backlog Backfill)**:
   > "Approve Phase 4 Batch 1 (50 dossiers) Backfill."

Until such explicit instructions are provided, the system remains strictly in **Phase 1 Shadow Observation** mode.

