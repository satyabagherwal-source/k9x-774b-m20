# AI-Builder-Brain — Phase D3 Specification
## Capability-Aware Routing & Execution Decomposition
### Stage 1: Specification-First Architecture & Implementation Plan

- **Date:** 2026-11-02
- **Governing Document:** `TEMP_EXPANSION_MASTER_PLAN.md` (AI-Builder-Brain: Final Unified Expansion Plan)
- **Phase & Milestone:** Phase D — Milestone D3 (Stage 1: Specification-First Implementation Planning)
- **Status:** `PROPOSED — SPECIFICATION COMPLETE (STAGE 1)`
- **Operational Mode:** STRICT READ-ONLY (No runtime code modified; zero files staged or committed)
- **Target Specification Path:** `08_VERIFICATION/phase-d3-capability-aware-routing-spec.md`

---

## 1. Executive Summary & Core Mission

In Phase D1, the Universal Task Contract was extended to support optional capability declarations (`required_capabilities`). In Phase D2, runtime **Pre-flight Status Gating** was implemented and verified with 155 green assertions, guaranteeing that tasks requiring unknown, missing, unverified, or ambiguous capabilities fail closed before execution begins.

**Phase D3: Capability-Aware Routing & Execution Decomposition** represents the next controlled architectural evolution. Its mission is to transform the system from a passive status-checker into an active, capability-aware task orchestrator:

1. **Intelligent Decomposition:** Break high-level user tasks into fine-grained, verifiable subtasks with explicit inputs, outputs, and verification barriers.
2. **Capability-to-Subtask Routing:** Map each subtask to the exact canonical capability required, validating against `15_METADATA/capability-registry.json`.
3. **Execution Dependency Graph (DAG):** Formulate execution plans as Directed Acyclic Graphs, enforcing topological dependencies, identifying parallelizable branches, and managing failure cascades.
4. **Dynamic Skill Binding:** Connect declarative markdown playbooks from `03_SKILLS/` to concrete subtask actions.
5. **Durable State & Recovery:** Guarantee that execution state, evidence, and checkpoints persist in `.project-brain/task-checkpoints.json` across process crashes and restarts.

> [!IMPORTANT]
> **Safety Invariant for Stage 1**: This document defines the blueprint, data contracts, acceptance criteria, and rollback strategies. **No runtime code is modified in this stage.** Implementation will occur in strictly scoped, individually verified milestones (D3.1 through D3.4) only upon explicit user authorization.

---

## 2. Baseline Reconnaissance & Architecture Map

### 2.1 Actual Git State Verification
- **Current Branch:** `main`
- **Current HEAD SHA:** `60b13d2dc0859d7407a5190daea2c41f1cdf8873` (Commit message: `capability`)
- **Working Tree State:** Local uncommitted changes for user review:
  - `M 04_WORKFLOWS/factory-engine/brain-connector.mjs` (D2 Gating integration)
  - `M 04_WORKFLOWS/factory-engine/capability-registry.mjs` (D2 `checkCapabilityReadiness`)
  - `M .project-brain/task-checkpoints.json` (Test checkpoint append)
  - `M 15_METADATA/capability-catalog.md` (Sync timestamp)
  - `?? 04_WORKFLOWS/factory-engine/test-capability-gating.mjs` (D2 Test Suite - 69 assertions)
  - `?? 08_VERIFICATION/phase-d2-capability-gating-checkpoint.md` (D2 Checkpoint Report)
  - `?? 08_VERIFICATION/phase-d3-capability-aware-routing-spec.md` (This Specification)
- **Active Background Processes:** Zero long-running background tasks; Cloud Harvester cron (`*/20 * * * *`) intact in GitHub Actions.

### 2.2 Existing Architecture Component Inventory

Every existing component is categorized using the required status labels:

| Component / File | Purpose & Interface | Category Label |
|---|---|---|
| `task-contract.mjs` | Task contract schema, creation, and D1 `required_capabilities` validator | `EXISTING AND VERIFIED` |
| `capability-registry.mjs` | Registry loading, querying, dependency graphs, and D2 readiness checks | `EXISTING AND VERIFIED` |
| `brain-connector.mjs` | Context resolution, BM25 retrieval, D2 status gating, execution pipeline | `EXISTING AND VERIFIED` |
| `task-planner.mjs` | DAG cycle validation (Kahn's algorithm), type-based decomposition, step progression | `EXISTING AND VERIFIED` |
| `skill-runner.mjs` | Markdown skill discovery in `03_SKILLS/`, invariant parsing, task binding | `EXISTING AND VERIFIED` |
| `concurrency-coordinator.mjs` | File-based PID mutex locks, stale-lock recovery (`.harvest-locks`) | `EXISTING AND VERIFIED` |
| `15_METADATA/capability-registry.json` | Authoritative 14-capability registry (9 Verified Working) | `EXISTING AND VERIFIED` |
| `15_METADATA/capability-schema.json` | Canonical schema with 28 required fields | `EXISTING AND VERIFIED` |
| `.project-brain/task-checkpoints.json` | Durable JSON checkpoint storage | `EXISTING AND VERIFIED` |
| `deferred-improvements-register.md` | Persistent technical debt register (`DIB-001` DONE, `DIB-002` OPEN) | `EXISTING AND VERIFIED` |
| **D3 Capability Routing Engine** | Dynamic matching of tasks to registered capabilities | `PROPOSED — NOT IMPLEMENTED` |
| **D3 Subtask Contract Extension** | Subtask data schema with inputs/outputs/capabilities | `PROPOSED — NOT IMPLEMENTED` |
| **D3 Multi-Branch DAG Scheduler** | Concurrent/parallel DAG branch execution with process mutex | `PROPOSED — NOT IMPLEMENTED` |
| **D3 Predictive Capability Ranker** | Heuristic candidate ranking (strictly advisory) | `PROPOSED — NOT IMPLEMENTED` |

---

## 3. Reusable Modules & Interfaces

Phase D3 will **reuse existing, verified components** rather than re-implementing core algorithms:

1. **DAG Validation & Cycle Detection:**
   - *Module:* `04_WORKFLOWS/factory-engine/task-planner.mjs`
   - *Function:* `validatePlanDAG(steps)`
   - *Status:* `EXISTING AND VERIFIED`
   - *Reuse:* Validates numerical or string step dependencies, detects duplicate IDs, missing dependencies, and self-referencing cycles using Kahn's topological sort algorithm.
2. **Step Progression & State Advancement:**
   - *Module:* `04_WORKFLOWS/factory-engine/task-planner.mjs`
   - *Functions:* `getNextExecutableSteps(contract)`, `advanceStep(contract, stepId, stepEvidence)`
   - *Status:* `EXISTING AND VERIFIED`
   - *Reuse:* Tracks completed dependencies, advances state from `PENDING` to `COMPLETED`/`FAILED`, and persists checkpoints.
3. **Capability Gating & Readiness Checks:**
   - *Module:* `04_WORKFLOWS/factory-engine/capability-registry.mjs`
   - *Functions:* `checkCapabilityReadiness(requiredCapabilities, options)`, `getCapabilityById(id, reg)`
   - *Status:* `EXISTING AND VERIFIED`
   - *Reuse:* Enforces the `ELIGIBLE_CAPABILITY_STATUSES = ['VERIFIED WORKING']` invariant.
4. **Skill Discovery & Invariant Extraction:**
   - *Module:* `04_WORKFLOWS/factory-engine/skill-runner.mjs`
   - *Functions:* `listRegisteredSkills()`, `getSkillDefinition(skillId)`, `bindSkillToTask(contract, skillId)`
   - *Status:* `EXISTING AND VERIFIED`
   - *Reuse:* Discovers 18 markdown playbooks in `03_SKILLS/` and parses negative constraints and verification probes.
5. **Process Mutex Concurrency Coordination:**
   - *Module:* `04_WORKFLOWS/factory-engine/concurrency-coordinator.mjs`
   - *Functions:* `getConcurrencyMode()`, PID lock acquisition and release
   - *Status:* `EXISTING AND VERIFIED`
   - *Reuse:* Enforces process boundaries if parallel branches are evaluated.

---

## 4. Proposed Data Contracts

To maintain complete backward compatibility, existing Task Contracts will continue to function without modification. Phase D3 introduces an extended, backward-compatible subtask structure inside `contract.execution_plan`.

### 4.1 Subtask Contract Specification (`PROPOSED — NOT IMPLEMENTED`)

Each node in the decomposition graph adheres to this schema:

```typescript
interface DecomposedSubtask {
  // Stable identification
  step_id: number;                          // Monotonically increasing integer (1, 2, 3...)
  subtask_id: string;                       // Unique subtask identifier (e.g., "task-1793-sub-1")
  title: string;                            // Concise human-readable action title
  action: string;                           // Concrete, unambiguous instruction
  task_type: "MICRO_FIX" | "FEATURE" | "SYSTEM_BUILD" | "AUDIT" | "REFACTOR";

  // Capability & Skill Routing
  required_capabilities: string[];          // Must match ^CAP-[A-Z0-9-]+$ (e.g., ["CAP-DISASTER-RECOVERY-VAULT"])
  assigned_skill_id?: string;               // Optional skill slug from 03_SKILLS/ (e.g., "tailwind-v4-css-first-design")

  // Dependency Graph & Concurrency
  depends_on: number[];                     // Array of prerequisite step_id numbers
  parallelizable: boolean;                  // True if this step can execute concurrently with sibling steps
  resource_locks: string[];                 // Files or subsystems locked during execution (e.g., ["src/config.json"])

  // Verification & Safety Barriers
  verification_probe: string;               // Automated terminal command or assertion (e.g., "npm test")
  acceptance_criteria: string[];            // Concrete criteria for completion
  input_contract: {                         // Expected input state
    required_files?: string[];
    prerequisite_state?: Record<string, any>;
  };
  output_contract: {                        // Expected output artifacts
    produced_files?: string[];
    evidence_keys?: string[];
  };

  // Execution State & Lifecycle
  status: "PENDING" | "READY" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "SKIPPED";
  retry_count: number;                      // Max allowed retries (default: 1)
  retries_attempted: number;                // Current retry count (default: 0)
  failure_reason: string | null;            // Detailed failure message if status === 'FAILED'
  evidence: Record<string, any>;            // Verified evidence payload
  completed_at: string | null;              // ISO-8601 timestamp
}
```

### 4.2 Extended Contract Execution Plan (`PROPOSED — NOT IMPLEMENTED`)

In the parent `TaskContract`, `contract.execution_plan` is typed as `Array<DecomposedSubtask>`.
When `contract.required_capabilities` is declared at the root level, the root capabilities represent the union of all subtask capabilities:
$$\text{contract.required\_capabilities} = \bigcup_{s \in \text{steps}} s.\text{required\_capabilities}$$

---

## 5. Task Understanding & Decomposition Engine Design

### 5.1 Deterministic Template-Driven Decomposition (`PROPOSED — NOT IMPLEMENTED`)

Task decomposition must be predictable, auditable, and repeatable. Rather than relying on non-deterministic LLM hallucinations, the primary decomposition mechanism is **Deterministic Rule-Based Decomposition**:

1. **Archetype Dispatcher:**
   - The contract's `task_type` (`MICRO_FIX`, `FEATURE`, `SYSTEM_BUILD`, `AUDIT`, `REFACTOR`) selects a verified decomposition template from `task-planner.mjs`.
2. **Capability Annotation:**
   - The template defines the standard step sequences and assigns baseline capability requirements to each step:
     - *Scaffolding / Environment:* Requires `CAP-PROJECT-FACTORY-BOOTSTRAP`
     - *Context / Knowledge Resolution:* Requires `CAP-HYBRID-KNOWLEDGE-RETRIEVAL`
     - *Vault / State Backup:* Requires `CAP-DISASTER-RECOVERY-VAULT`
     - *Multi-Page SEO / Routing:* Requires `CAP-MULTILINGUAL-SEO-INTELLIGENCE`
     - *Persistent Learning:* Requires `CAP-PERSISTENT-LEARNING-HARVESTING`
3. **Contract Parameter Binding:**
   - Dynamic parameters from `contract.task_profile` (e.g. `language`, `framework`, `security_implications`) refine step actions and verification probes.
4. **Validation Barrier:**
   - The generated plan is immediately validated via `validatePlanDAG(steps)` before any execution begins.

---

## 6. Capability-Aware Routing Engine Design

```
+---------------------------------------------------------------------------------+
|                              User Task Contract                                 |
+---------------------------------------------------------------------------------+
                                       |
                                       v
+---------------------------------------------------------------------------------+
|                        Task Decomposition Engine (DAG)                          |
+---------------------------------------------------------------------------------+
           |                                                      |
           v                                                      v
  [Subtask 1: Vault Backup]                              [Subtask 2: Scaffolding]
  required: CAP-DISASTER-RECOVERY-VAULT                  required: CAP-PROJECT-FACTORY-BOOTSTRAP
           |                                                      |
           +---------------------------+--------------------------+
                                       |
                                       v
+---------------------------------------------------------------------------------+
|                  Capability Routing & Gating Barrier (Phase D2)                 |
|               (Verifies against 15_METADATA/capability-registry.json)           |
+---------------------------------------------------------------------------------+
           |                                                      |
     [All VERIFIED]                                       [Any NOT VERIFIED]
           |                                                      |
           v                                                      v
+-----------------------+                              +--------------------------+
|  Topological Execution|                              | Immediate Pipeline Halt  |
|     (Sequential /     |                              | (status = FAILED;        |
|    Safe Mutexed)      |                              |  report Known Gaps)      |
+-----------------------+                              +--------------------------+
```

### 6.1 Routing & Resolution Invariants

1. **Registry Authoritative Truth (`EXISTING AND VERIFIED`):**
   - Capability existence and eligibility are resolved strictly against `15_METADATA/capability-registry.json`. No hardcoded capability tables outside the registry.
2. **Strict Eligibility Barrier (`EXISTING AND VERIFIED`):**
   - Only capabilities with status `VERIFIED WORKING` are eligible for routing.
   - Statuses `MISSING`, `PRESENT BUT UNVERIFIED`, and `PARTIALLY IMPLEMENTED` trigger immediate rejection.
3. **Fail-Closed Fallback Policy (`PROPOSED — NOT IMPLEMENTED`):**
   - If a required capability is ineligible:
     - The subtask transitions to `FAILED`.
     - The parent contract transitions to `FAILED`.
     - Execution is aborted immediately.
     - The failure reason includes the exact missing capability ID, current status, and documented known gaps.
     - **No silent degradation, no fake mock completion, no unverified heuristic execution.**

---

## 7. Execution Dependency Graph / DAG Engine Design

### 7.1 Graph Representation & Cycle Prevention (`EXISTING AND VERIFIED`)

Execution plans are structured as Directed Acyclic Graphs:
- **Nodes ($V$):** `DecomposedSubtask` objects identified by unique `step_id`.
- **Edges ($E$):** Directed dependencies defined in `depends_on`. A directed edge $(u, v)$ means subtask $u$ must reach `COMPLETED` before subtask $v$ can become `READY`.
- **Cycle Prevention:**
  - Before execution, `validatePlanDAG(steps)` performs Kahn's topological sort.
  - If the count of visited nodes does not equal $|V|$, a cycle exists, and the plan is rejected with an explicit cycle trace.

### 7.2 Concurrency & Parallel Execution Policy (`PROPOSED — NOT IMPLEMENTED`)

> [!CAUTION]
> **Parallel Execution Safety Condition:**
> By default, all steps execute **sequentially** in topological order. Parallel execution introduces race conditions, cache corruption, and Windows CRLF/file-lock conflicts.

Parallel execution of two independent steps ($s_a$ and $s_b$) is permitted **ONLY IF ALL** of the following conditions are met:
1. Both steps have all dependencies satisfied (`getNextExecutableSteps`).
2. Both steps declare `parallelizable === true`.
3. The intersection of their `resource_locks` is empty:
   $$\text{resource\_locks}(s_a) \cap \text{resource\_locks}(s_b) = \emptyset$$
4. Global concurrency mode in `harvest-control.json` is set to `PARALLEL_MULTI_AGENT` (verified via `concurrency-coordinator.mjs`).
5. Process mutex locks are successfully acquired via `concurrency-coordinator.mjs`.

If any condition is not met, steps must execute sequentially.

### 7.3 Crash Recovery & Checkpoint Resumption (`EXISTING AND VERIFIED`)

- After every step completion, `advanceStep()` calls `recordTaskCheckpoint()`.
- Checkpoints are saved in `.project-brain/task-checkpoints.json`.
- If an agent or process restarts mid-task, `loadTaskCheckpoint(taskId)` reconstructs the plan:
  - Steps with `status === 'COMPLETED'` are skipped.
  - The first `PENDING` step with satisfied dependencies is resumed.
  - Zero redundant execution.

---

## 8. Dynamic Skill Binding Design

### 8.1 Discovery & Matching Protocol (`PROPOSED — NOT IMPLEMENTED`)

1. **Skill Discovery:**
   - `listRegisteredSkills()` scans `03_SKILLS/` and discovers all available `.md` playbooks (`EXISTING AND VERIFIED`).
2. **Explicit Skill Binding:**
   - If a subtask specifies `assigned_skill_id` (e.g., `tailwind-v4-css-first-design`), `getSkillDefinition(skillId)` parses the playbook.
3. **Invariant & Constraint Injection:**
   - Invariants from the skill are injected into `contract.constraints.negative_constraints`.
   - Verification probes (e.g. `npm run build`, `npm test`) are bound to the subtask's `verification_probe`.
4. **Binding Validation Barrier:**
   - If an `assigned_skill_id` cannot be found in `03_SKILLS/`, the subtask fails with `SKILL_NOT_FOUND`.

---

## 9. Predictive Capability Selection: Architectural Decision

### 9.1 Evaluation: Predictive Selection vs. Deterministic Routing

We evaluated whether a predictive / probabilistic capability selector (e.g., LLM-based embeddings or heuristic classifiers) should choose capabilities for user tasks.

| Dimension | Deterministic Registry Routing | Predictive / Heuristic Selection |
|---|---|---|
| **Predictability** | 100% deterministic & repeatable | Non-deterministic, temperature-sensitive |
| **Auditability** | Explicit rule/contract mapping | Black-box scoring |
| **Security / Safety** | Zero risk of hallucinated capabilities | High risk of hallucinating non-existent IDs |
| **Verification Barrier** | Strictly enforces `VERIFIED WORKING` | May attempt to bypass gating on high similarity |

### 9.2 Concrete Architectural Decision

> [!IMPORTANT]
> **Architectural Decision on Predictive Selection:**
> 1. **Primary Routing is Deterministic:** Tasks and subtasks select capabilities based on explicit task contracts, template archetypes, or keyword matching against canonical registry domains.
> 2. **Predictions Are Strictly Advisory:** If a predictive selector is implemented in the future, its scope is strictly restricted to **ranking recommendations during task authoring**.
> 3. **Zero Execution Authority:** Under no circumstances can a predictive score grant execution permission. Every candidate capability **must pass D2 Status Gating** (`checkCapabilityReadiness`) against `15_METADATA/capability-registry.json`.
> 4. **Fail-Closed on Uncertainty:** When ambiguity or low confidence occurs, the system must report uncertainty and prompt the user rather than guess.

---

## 10. Failure Modes, Safety Barriers & Rollback Strategy

### 10.1 Failure Modes & Mitigations

| Failure Mode | Impact | Mitigation Strategy |
|---|---|---|
| **Cyclic Dependency in Plan** | Infinite loop / deadlock | Kahn's algorithm in `validatePlanDAG()` rejects before execution. |
| **Missing / Ineligible Capability** | Execution failure | Pre-flight D2 gating halts pipeline with `status = FAILED`. |
| **Subtask Step Failure** | Partial work / corruption | `advanceStep()` marks step `FAILED`; halts dependent branches; persists checkpoint. |
| **File Resource Contention** | Write race conditions | `resource_locks` validation; defaults to sequential execution. |
| **Process Crash Mid-Pipeline** | Orphaned task state | `.project-brain/task-checkpoints.json` preserves exact step state for resumption. |
| **Registry Malformation / Duplicates** | Ambiguous capability binding | `checkCapabilityReadiness()` returns `REGISTRY_MALFORMED` or `REGISTRY_AMBIGUOUS_DUPLICATE`. |

### 10.2 Rollback Strategy & Non-Destructive Blast Radius

- All Phase D3 changes are isolated to `04_WORKFLOWS/factory-engine/` and test suites.
- No modifications will touch canonical Master Brain folders (`01_CORE`, `05_KNOWLEDGE`, `09_SOURCES`).
- If an implementation milestone fails verification:
  - Working tree changes can be reverted surgically via Git without impacting Phase C or Phase D1/D2 code.
  - Checkpoints in `.project-brain/task-checkpoints.json` maintain forward/backward schema compatibility.

---

## 11. Backward Compatibility & Non-Regression Invariants

1. **Legacy Task Compatibility:**
   - Any task where `required_capabilities` is `undefined` continues to execute with standard legacy behavior. Gating is bypassed.
2. **D1 Contract Validation:**
   - All 44 assertions in `test-task-connector.mjs` must continue to pass 100%.
3. **D2 Capability Gating:**
   - All 69 assertions in `test-capability-gating.mjs` must continue to pass 100%.
4. **Registry Integrity:**
   - All 42 assertions in `test-capability-registry.mjs` must continue to pass 100%.
5. **Locked Architecture Preservation:**
   - All 16 locked canonical directories (`00_START_HERE` through `15_METADATA`) remain unmodified.
6. **Cloud Harvester Preservation:**
   - `.github/workflows/24-7-cloud-harvester.yml` continues running its `*/20 * * * *` schedule untouched.

---

## 12. Comprehensive Acceptance Criteria & Test Matrix

When Phase D3 implementation milestones are executed, the following test matrix must be implemented in a dedicated test suite (`test-capability-routing.mjs`):

| Test ID | Test Scenario | Expected Outcome |
|---|---|---|
| **TC-D3-01** | Legacy contract decomposition | Generates standard plan without capability requirements; executes cleanly |
| **TC-D3-02** | Single-capability subtask routing | Subtask binds verified capability (`CAP-DISASTER-RECOVERY-VAULT`); gating passes |
| **TC-D3-03** | Multi-capability subtask routing | Multiple subtasks bind distinct verified capabilities; all pass gating |
| **TC-D3-04** | Subtask with unverified capability | Subtask requiring `CAP-ACCESSIBILITY-COMPLIANCE-AUDIT` fails gating; pipeline halts |
| **TC-D3-05** | Subtask with missing capability | Subtask requiring `CAP-INTERNET-SCALE-REPO-DISCOVERY` fails gating; pipeline halts |
| **TC-D3-06** | Subtask with unknown capability ID | Subtask requiring `CAP-NON-EXISTENT-XYZ` fails gating; reports `NOT_FOUND` |
| **TC-D3-07** | DAG cycle detection | Plan with circular dependency A -> B -> A is rejected by `validatePlanDAG` |
| **TC-D3-08** | Topological step progression | Dependent steps remain `PENDING` until prerequisite steps reach `COMPLETED` |
| **TC-D3-09** | Parallel branch eligibility | Independent steps with non-overlapping resource locks marked parallelizable |
| **TC-D3-10** | Resource lock conflict prevention | Independent steps with overlapping locks forced to sequential execution |
| **TC-D3-11** | Dynamic skill discovery & binding | Subtask with `assigned_skill_id` binds invariants and verification probes |
| **TC-D3-12** | Unknown skill rejection | Subtask with invalid skill ID fails with `SKILL_NOT_FOUND` |
| **TC-D3-13** | Mid-pipeline failure & halting | Step failure halts execution; downstream dependent steps marked `SKIPPED` |
| **TC-D3-14** | Durable checkpoint resumption | Pipeline resumes from last completed step using persisted checkpoint |

---

## 13. Open Questions & Unresolved Technical Risks

1. **`DIB-002` (Open Item in Deferred Register):**
   - *Observation:* `test-retrieval-engine.mjs` cold rebuild takes ~2,880ms against a 2,000ms threshold due to 8,251-document corpus size.
   - *D3 Impact:* Subtask decomposition and routing rely on BM25 retrieval for rule resolution. Warm queries remain fast at 11ms, so D3 runtime routing is unaffected. `DIB-002` remains OPEN and tracked.
2. **Windows File-Locking & CRLF Line Endings:**
   - *Risk:* Concurrent subtasks modifying files on Windows NTFS can trigger `EBUSY` or `EPERM` locks, and git line endings can differ between LF and CRLF.
   - *Mitigation:* Sequential execution remains the default. Parallel execution requires explicit file-set disjointness and mutex acquisition.

---

## 14. Proposed Phased Implementation Milestones

To maintain safety and auditability, Phase D3 must be executed in 4 small, verifiable milestones:

```
[Phase D3.1] Subtask Data Contract & Decomposition Extension
     | (Verify: contract tests pass, schema validation clean)
     v
[Phase D3.2] Capability-to-Subtask Routing & Status Gating Validator
     | (Verify: routing tests pass, ineligible capabilities halt subtasks)
     v
[Phase D3.3] DAG Execution Engine & Dynamic Skill Binding
     | (Verify: topological ordering, skill invariant binding, lock checks)
     v
[Phase D3.4] End-to-End Pipeline Integration, Recovery & Regression
     | (Verify: 100% test pass across D1, D2, D3 suites; durable recovery)
     v
[Phase D3 Complete] -> Await Phase E Authorization
```

### Milestone D3.1 — Subtask Data Contract & Decomposition Extension
- **Scope:** Define `DecomposedSubtask` schema in `task-contract.mjs`; extend `planTaskDecomposition()` to attach subtask capability metadata; preserve legacy contracts.
- **Affected Files:** `04_WORKFLOWS/factory-engine/task-contract.mjs`, `04_WORKFLOWS/factory-engine/task-planner.mjs`.
- **Verification:** Unit tests confirming schema validity, subtask ID generation, and backward compatibility.

### Milestone D3.2 — Capability-to-Subtask Routing & Status Gating Validator
- **Scope:** Connect subtask `required_capabilities` to `checkCapabilityReadiness()`; ensure every subtask is gated individually before execution.
- **Affected Files:** `04_WORKFLOWS/factory-engine/brain-connector.mjs`, `04_WORKFLOWS/factory-engine/capability-registry.mjs`.
- **Verification:** Tests proving subtasks with ineligible capabilities are rejected before prompt formatting.

### Milestone D3.3 — DAG Execution Engine & Dynamic Skill Binding
- **Scope:** Enhance `getNextExecutableSteps` and `advanceStep` for subtask capability tracking; integrate `bindSkillToTask` at subtask level; add resource lock checking.
- **Affected Files:** `04_WORKFLOWS/factory-engine/task-planner.mjs`, `04_WORKFLOWS/factory-engine/skill-runner.mjs`.
- **Verification:** Tests proving topological step execution, dynamic skill invariant injection, and resource lock conflict prevention.

### Milestone D3.4 — End-to-End Pipeline Integration, Recovery & Regression
- **Scope:** Connect subtask DAG execution into `executeUniversalTaskPipeline()`; test checkpoint resumption and full regression suite.
- **Affected Files:** `04_WORKFLOWS/factory-engine/brain-connector.mjs`, `04_WORKFLOWS/factory-engine/test-capability-routing.mjs`.
- **Verification:** Complete regression test run (D1 + D2 + D3 suites), checkpoint recovery proof, zero git diff warnings.

