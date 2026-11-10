# AI-BUILDER-BRAIN — PAC-006 CONTROLLED EXPERIMENT DESIGN
## Two-Project Knowledge Transfer & Empirical Learning Delta Specification

> **Canonical Authority**: PAC-006 Experiment Specification  
> **Location**: `08_VERIFICATION/pac-006-controlled-experiment-design.md`  
> **Status**: APPROVED & READY FOR EXECUTION  
> **Mission**: Prove that real project outcomes can be validated through an independent barrier, promoted into Master Brain, and retrieved by a subsequent project to produce a measurable, verified improvement delta.  
> **Governing Invariant**: **Zero self-validation. Project A cannot certify its own learning as universally valid.**

---

## 1. Experiment Topology & The 7-Step Transfer Loop

```
┌────────────────────────────────────────────────────────────────────────┐
│                        STEP 1: CONSTRUCT PROJECT A                     │
│           Product: TenantDataAnalyticsEngine (DATA_PRODUCT)            │
│       Goal: Multi-tenant metrics engine with quota & anomalies         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      STEP 2: GATHER EMPIRICAL EVIDENCE                 │
│      Run native tests, record duration, capture buffer leak fix        │
│          Evidence: Exit Code 0, passing assertions, memory bounds      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     STEP 3: EXTRACT CANDIDATE LEARNING                 │
│    Pattern: Multi-tenant composite namespace & bounded rolling window  │
│    Invariant: tenantId:metric namespace with oldest-point eviction     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              STEP 4: INDEPENDENT 4-PILLAR VALIDATION BARRIER           │
│   Pillar 1: Execution proof (Exit Code 0 in isolated sandbox)          │
│   Pillar 2: Substantive non-speculative causal invariant (>25 chars)   │
│   Pillar 3: Zero workstation path leaks (no C:\Users\, no local ports) │
│   Pillar 4: Domain non-contradiction & storage boundary approval       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 STEP 5: PROMOTE TO MASTER BRAIN STORAGE                │
│       Append Rule 1720 to LEARNINGS.md & index in Domain G/H           │
│         Knowledge Stage transitioned: CANDIDATE ➔ CANONICAL            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        STEP 6: CONSTRUCT PROJECT B                     │
│           Product: TenantWebhookDeliveryEngine (API_PLATFORM)          │
│        Goal: Multi-tenant webhook delivery with per-tenant queues      │
│      Brain queries Domain G/H ➔ RETRIEVES NEWLY PROMOTED RULE 1720!    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                STEP 7: MEASURE EMPIRICAL IMPROVEMENT DELTA             │
│      Compare Project B outcomes vs Project A and baseline:             │
│   - Zero tenant queue leak defects (derived from Rule 1720)            │
│   - 100% tenant isolation test pass rate                               │
│   - Documented delta improvement proof                                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Project A Specification: `TenantDataAnalyticsEngine`

- **Category**: `DATA_PRODUCT`
- **Product Intent**: *"Build a multi-tenant time-series metrics analytics engine with per-tenant quota enforcement and statistical anomaly detection"*
- **Archetype**: `DATA_PRODUCT` with Multi-Tenant Partitioning
- **Key Technical Problem to Solve**:
  In a multi-tenant in-memory data product, unpartitioned metric names allow Tenant A to overwrite or inspect Tenant B's metrics (`cpu_usage`). Furthermore, unbounded data point ingestion causes heap exhaustion.
- **Architectural Solution in Project A**:
  1. Enforces composite namespace keys: `const partitionKey = `${tenantId}:${metric}`;`
  2. Enforces a maximum window capacity (e.g. 1000 points per metric) with FIFO rolling eviction.
- **Artifacts Generated**:
  - `src/models/schema.mjs`: `validateTenantMetricPoint(point)`
  - `src/core/engine.mjs`: `TenantDataAnalyticsEngine`
  - `src/index.mjs`: Exporting application kernel
  - `tests/application.test.mjs`: 100% native Node.js test harness
  - `.project-brain/PROJECT_LEARNING.md`: Project learning ledger

---

## 3. Candidate Learning Extraction & 4-Pillar Validation

From Project A's execution evidence, the candidate learning is formulated:

* **Category**: Architecture & Boundaries (Domain G) / Construction (Domain H)
* **Proposed Rule**: *Rule 1720 (Multi-Tenant Composite Namespace & Bounded Rolling Window Invariant)*
* **Causal Mechanism**: *"Multi-tenant in-memory analytical engines and queues must enforce composite namespace keys (`${tenantId}:${resourceKey}`) and capacity-bounded buffers with deterministic FIFO eviction prior to aggregation, preventing cross-tenant data leaks and memory exhaustion."*
* **Validation Barrier Gates**:
  1. **Pillar 1 (Execution Verification)**: Project A test suite must exit strictly with Code 0. Non-zero exit code triggers immediate rejection (`REJECTED_UNVERIFIED`).
  2. **Pillar 2 (Knowledge Claim)**: Explains the exact failure mechanism (memory leak / cross-tenant bleeding) and corrective invariant.
  3. **Pillar 3 (Cross-Context Applicability)**: Stripped of all workstation paths (`C:\Users\Admin\...`) and applicable across any multi-tenant service.
  4. **Pillar 4 (Canonical Promotion Gate)**: Evaluated against `05_KNOWLEDGE/domain-registry.json` for contradictions. Promoted atomically to canonical Master Brain.

---

## 4. Project B Specification: `TenantWebhookDeliveryEngine`

- **Category**: `API_PLATFORM`
- **Product Intent**: *"Build a multi-tenant webhook delivery engine with per-tenant rate limits, HMAC signatures, and queue capacity bounds"*
- **Archetype**: `API_PLATFORM` with Multi-Tenant Queue Partitioning
- **Knowledge Retrieval**:
  When Project B is synthesized, the Brain retrieves Domain G/H intelligence using query `"multi-tenant bounded partition isolation"`.
  **Rule 1720 is returned as a top-ranked guideline!**
- **Application of Retrived Rule 1720**:
  Project B's webhook queue engine implements Rule 1720 directly:
  `const queueKey = `${tenantId}:${webhookEndpoint}`;`
  with per-queue FIFO bounded limits (max 500 queued deliveries per tenant).
- **Test Suite**:
  Tests that Tenant A's webhook backlog cannot starve Tenant B's webhook delivery, and messages cannot cross tenant boundaries.

---

## 5. Comparative Measurement Matrix (The Delta Proof)

| Metric | Project A (Learning Source) | Project B (Learning Consumer) | Acceptance Condition for PAC-006 |
| :--- | :--- | :--- | :--- |
| **Requirements Fidelity** | 100% user intent satisfied | 100% user intent satisfied | Equal or higher |
| **Master Brain Rule Recall** | Baseline rules (1670, 1708, 1713) | **Includes newly promoted Rule 1720** | **Must retrieve Rule 1720** |
| **Tenant Isolation Architecture** | Discovered & implemented during build | Reused proven pattern directly from Brain | Zero rework / instant adoption |
| **Defect Rate on First Assembly** | 1 buffer overflow trapped & fixed | 0 cross-tenant leaks (pre-empted) | **Measurable defect reduction** |
| **Automated Test Assertions** | 100% passing (Exit Code 0) | 100% passing (Exit Code 0) | Strictly Exit Code 0 |
| **Workstation Path Leaks** | 0 path leaks | 0 path leaks | Strictly 0 leaks |
| **Cross-Domain Bleed** | None (Data product focused) | None (API platform focused) | Clean domain boundaries |

---

## 6. PAC-006 Experiment Engine Implementation Plan

The experiment will be implemented in a dedicated, isolated test script:
`04_WORKFLOWS/factory-engine/test-pac006-controlled-experiment.mjs`

### Execution Sequence:
1. `Step 1`: Clean sandbox initialization (`.project-brain/simulation-sandbox/pac006-experiment/`).
2. `Step 2`: Construct Project A (`TenantDataAnalyticsEngine`), execute tests, capture Exit Code 0.
3. `Step 3`: Extract candidate learning from Project A's `.project-brain/PROJECT_LEARNING.md`.
4. `Step 4`: Submit candidate through `validateProjectLearningCandidate` (4-Pillar Validation).
5. `Step 5`: Promote validated rule into `LEARNINGS.md` as Rule 1720.
6. `Step 6`: Construct Project B (`TenantWebhookDeliveryEngine`), execute searchBrain to prove Rule 1720 is retrieved and embedded in `src/core/brain-knowledge-manifest.json`.
7. `Step 7`: Execute Project B tests in sandbox, capture Exit Code 0, and verify comparative improvement delta.
8. `Step 8`: Clean sandbox teardown.

