# AI-BUILDER-BRAIN — MASTER ARCHITECTURE BLUEPRINT
## Universal Construction Intelligence Data System Specification

> **Canonical Authority**: Master System Architecture Document  
> **Location**: `08_VERIFICATION/master-architecture-blueprint.md`  
> **Status**: APPROVED & CANONICAL  
> **Master Axiom**:  
> **"AI THINKS. BRAIN STORES AND SUPPLIES INTELLIGENCE DATA. TOOLS EXECUTE. PRODUCTS DELIVER OUTCOMES."**  
> **Operational Invariant**: **ONLY ADDITION & ENRICHMENT. NEVER DELETION OR WEAKENING.**

---

## 1. Executive Architecture Summary

AI-Builder-Brain is an empirical, model-independent construction intelligence data system. It is designed to decouple AI reasoning from persistent knowledge storage, execution tools, and real-world product outcomes.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        COMPATIBLE AI MODELS                            │
│              GPT · Gemini · Claude · Open-Source Models                │
│             Reasoning, Planning, Decisions & Orchestration             │
└───────────────────────────────────┬▲───────────────────────────────────┘
                                    ││
                                    ││ queries & reasoning directives
                                    ││ supplies verified intelligence
                                    ▼│
┌────────────────────────────────────────────────────────────────────────┐
│                          AI-BUILDER-BRAIN                              │
│       Knowledge · Intelligence · Skills · Workflows · Evidence         │
│             Universal Construction Intelligence Data System            │
└───────────────────────────────────┬▲───────────────────────────────────┘
                                    ││
                                    ││ tool dispatch & constraints
                                    ││ runtime feedback & logs
                                    ▼│
┌────────────────────────────────────────────────────────────────────────┐
│                    TOOLS & EXECUTION INFRASTRUCTURE                    │
│        Repositories · APIs · IDEs · Git · Browsers · Cloud · Tests     │
└───────────────────────────────────┬▲───────────────────────────────────┘
                                    ││
                                    ││ builds, executes, deploys
                                    ││ runtime evidence & signals
                                    ▼│
┌────────────────────────────────────────────────────────────────────────┐
│                      PRODUCTS & REAL-WORLD OUTCOMES                    │
│      Websites · Apps · SaaS · Platforms · Creative Tools · Automations │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼ 🔄 FEEDBACK LOOP
          [Empirical Evidence] ➔ [Candidate Learnings] ➔ 
          [4-Pillar Validation Gate] ➔ [Master Brain Evolution]
```

---

## 2. The 10 Conceptual Architectural Layers

AI-Builder-Brain operates through 10 conceptual layers mapped directly into its 16 canonical directories.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 10: Feedback, Learning & Evolution (.project-brain/PROJECT_LEARNING.md)    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ LAYER 9:  Quality, Verification, Security & Operations (08_VERIFICATION/)        │
├──────────────────────────────────────────────────────────────────────────────────┤
│ LAYER 8:  Project Factory & Product Intelligence (10_DELIVERY/, 11_OPERATIONS/)  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ LAYER 7:  Universal Requirements, Planning & Construction (04_WORKFLOWS/)        │
├──────────────────────────────────────────────────────────────────────────────────┤
│ LAYER 6:  Skills, Capabilities & Workflows (06_SKILLS/, 04_WORKFLOWS/)           │
├──────────────────────────────────────────────────────────────────────────────────┤
│ LAYER 5:  13 Universal Intelligence Domains A–M (05_KNOWLEDGE/)                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ LAYER 4:  Storage, Retrieval & Relationships (.project-brain/cache/)             │
├──────────────────────────────────────────────────────────────────────────────────┤
│ LAYER 3:  Knowledge Intelligence & Processing (03_REASONING/)                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ LAYER 2:  Knowledge Acquisition & Multi-Source Harvesting (02_AGENTS/)           │
├──────────────────────────────────────────────────────────────────────────────────┤
│ LAYER 1:  Foundation, Core & System Invariants (01_CORE/)                        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

### Layer 1: Foundation & Core
- **Primary Role**: System identity, governing principles, model-independent contracts, and project context.
- **Components**:
  - `01_CORE/SYSTEM_VISION_AND_GOALS.md`: Canonical north star and architectural blueprint.
  - `01_CORE/CANONICAL_IDENTITY_AND_GOVERNING_PRINCIPLE.md`: Role separation invariants.
  - `01_CORE/operating-rules.md`: Rules 1–1717 engineering invariants.
  - `01_CORE/agent-rules.md`: Agent behavior and non-destructive boundaries.
- **Inputs**: User directives, master prompts, architectural standards.
- **Outputs**: System boundaries, invariant assertions, execution permissions.
- **Dependencies**: Zero external dependencies; self-contained Markdown specifications.

---

### Layer 2: Knowledge Acquisition
- **Primary Role**: Multi-source harvesting of raw technical knowledge, standards, and repositories.
- **Components**:
  - Local Harvester (`universal-repository-learning-engine.mjs`): Bounded scanning of local fixture and project repos.
  - Cloud Harvester (`.github/workflows/harvest.yml`): Continuous background ingestion from external repositories.
  - Source Catalog (`09_SOURCES/sources-catalog.json`): Registry of authorized knowledge repositories and documentation sites.
- **Inputs**: Repository URLs, local directory paths, documentation schemas.
- **Outputs**: Raw files, repository metadata, AST symbols, commit histories, workflow inventories.
- **Dependencies**: Git CLI, Node.js runtime, network access (for cloud harvesting).

---

### Layer 3: Knowledge Intelligence & Processing
- **Primary Role**: Transformation of raw harvested data into structured, validated candidate knowledge.
- **Components**:
  - Semantic Analyzer: Parses AST, component roles, dependency graphs, and test harnesses.
  - HIQV Gate (`HarvestedIntelligenceQualityValidator`): HMAC cryptographic token verification, anti-tamper validation.
  - 5-Stage Knowledge Lifecycle:
    1. `DISCOVERED`: Source repository identified.
    2. `EXTRACTED`: File contents and structures parsed.
    3. `CANDIDATE`: Potential reusable pattern identified.
    4. `VALIDATED`: Corroborated with empirical tests and cross-repo evidence.
    5. `CANONICAL`: Promoted to core knowledge base (`05_KNOWLEDGE/`).
- **Inputs**: Harvested source code, commit diffs, defect autopsies.
- **Outputs**: Forensic intelligence dossiers (`07_PROJECT_LEARNING/`), promoted rules (`LEARNINGS.md`).
- **Dependencies**: Crypto module, Node.js parser, Layer 2 outputs.

---

### Layer 4: Knowledge Storage, Retrieval & Relationships
- **Primary Role**: Ultra-fast, recallable intelligence delivery to compatible AI models.
- **Components**:
  - BM25 Retrieval Engine (`retrieval-engine.mjs`): Sub-15ms keyword/lexical search across 62,000+ indexed segments.
  - Production Retrieval Index (`.project-brain/cache/retrieval-index.json`): 384 MB pre-computed inverted index.
  - Provenance Ledger (`09_SOURCES/harvest-provenance-ledger.md`): Cryptographic hash tracking for every piece of knowledge.
- **Inputs**: Search queries, task intent, domain filters.
- **Outputs**: Ranked knowledge items, relevant engineering rules, token-budgeted context.
- **Dependencies**: File system, Layer 3 canonical knowledge.

---

### Layer 5: 13 Universal Intelligence Domains
- **Primary Role**: Comprehensive lifecycle coverage across 13 co-equal domains:
  - **Domain A (Human & Need)**: User personas, accessibility, human constraints.
  - **Domain B (Product)**: Problem records, PRD specifications, MVP scoping.
  - **Domain C (Market & Business)**: Business feasibility, pricing models, competitive analysis.
  - **Domain D (Research & Knowledge)**: Technical research, academic papers, empirical benchmarks.
  - **Domain E (Creative)**: Tone, narrative, branding, and copy.
  - **Domain F (Design)**: Design tokens, typography, UI layout systems.
  - **Domain G (Architecture)**: System decomposition, bounded contexts, data schemas, module boundaries.
  - **Domain H (Technical Construction)**: Code implementation, algorithms, build manifests.
  - **Domain I (Content & Information)**: Documentation, user guides, API references.
  - **Domain J (Search & Distribution)**: Discoverability, SEO Schema (JSON-LD), package publishing.
  - **Domain K (Quality & Verification)**: Automated unit/integration tests, negative invariants.
  - **Domain L (Deployment & Operations)**: Containerization, CI/CD manifests, runtime telemetry.
  - **Domain M (Feedback & Evolution)**: Runtime feedback, learning extraction, brain evolution.
- **Inputs**: Product goals, user requirements, domain registries.
- **Outputs**: Multi-domain construction packages, specifications, schemas.
- **Dependencies**: Layer 4 retrieval, Layer 1 core principles.

---

### Layer 6: Skills, Capabilities & Workflows
- **Primary Role**: Reusable procedural execution patterns and coordinated DAG workflows.
- **Components**:
  - Skill Engine (`06_SKILLS/`): Versioned, composable tool procedures.
  - DAG Saga Orchestrator (`test-rule-319-resilient-saga.mjs`): Resilient execution sequences with automated rollback on failure.
  - Capability Registry (`capability-registry.json`): Catalog of empirically proven system capabilities.
- **Inputs**: Task definitions, subtask dependencies.
- **Outputs**: Step-by-step execution traces, failure compensations.
- **Dependencies**: Layer 5 domain intelligence.

---

### Layer 7: Universal Requirements, Planning & Construction
- **Primary Role**: Translating natural-language product goals into concrete executable specifications and source code.
- **Components**:
  - Semantic Decomposer (`semantic-decomposer.mjs`): Epistemic partitioning (Facts, Assumptions, Unknowns, Conflicts), requirements trees, and acyclic construction plan DAGs.
  - Dynamic Blueprint Synthesizer (`universal-code-assembler.mjs`): Resolves multi-language tech stacks (Node.js, Python, Go) and directory structures dynamically.
  - Universal Code Assembler (`universal-code-assembler.mjs`): Generates full source code across 10 archetypes/benchmarks, embeds canonical rule citations, and emits packaging manifests.
- **Inputs**: User product goal string, target language/stack.
- **Outputs**: Multi-file project artifacts, manifests, automated test harnesses.
- **Dependencies**: Layers 4, 5, and 6.

---

### Layer 8: Project Factory & Product Intelligence
- **Primary Role**: Independent child product lifecycle management and workspace separation.
- **Components**:
  - Project Factory CLI (`project-factory-cli.mjs`): Unified CLI entry point (`--goal`, `--stack`, `--target`, `--dry-run`, `--promote-learnings`).
  - Product Separation Boundary:
    * **Master Brain**: Read-only template and intelligence source (`C:\AI-Builder-Brain`).
    * **Product Intelligence**: Project-specific PRD, decisions, and DAG in `.project-brain/construction/`.
    * **Actual Product**: Emitted source code, tests, and configuration in target directory.
  - Dual-Track Git Isolation: Child projects restricted to manual commits (`CHILD_PROJECT = MANUAL_COMMIT_ONLY`).
- **Inputs**: CLI arguments, execution options.
- **Outputs**: Isolated product repositories, verification reports, learning ledgers.
- **Dependencies**: Layer 7 construction engine, child process execution.

---

### Layer 9: Quality, Verification, Security & Operations
- **Primary Role**: Ensuring construction correctness, runtime safety, and disaster recovery.
- **Components**:
  - Automated Sandbox Test Runner: Native test execution (`node --test`, `pytest`, `go test`) asserting exit code 0.
  - Negative Scope Verifier: Explicitly asserts the absence of telemetry, tracking, and unprompted cloud sync.
  - Vault Backup Engine (`vault-backup-engine.mjs`): AES-256-GCM encryption with 100,000 PBKDF2 iterations, Git bundles, and SHA-256 snapshot manifests.
  - Disaster Recovery (`test-remote-to-isolated-restore.mjs`): Tamper detection and isolated restore verification.
- **Inputs**: Emitted product directories, backup passphrases.
- **Outputs**: Exit code proofs, verification reports, encrypted vault snapshots.
- **Dependencies**: Node.js child_process, crypto, Git bundle CLI.

---

### Layer 10: Feedback, Learning & Evolution
- **Primary Role**: Closing the loop by assimilating real construction experiences back into Master Brain.
- **Components**:
  - Project Learning Synthesizer: Generates `.project-brain/PROJECT_LEARNING.md` recording architecture, contracts, and test proofs.
  - Candidate Discovery & Classification: Categorizes lessons into 13 canonical domains.
  - 4-Pillar Validation Barrier:
    1. *Execution Verification*: Must have passing tests with Exit Code 0.
    2. *Non-Triviality*: Must embody substantial architectural patterns (>20 chars invariant).
    3. *Workstation Leak Prevention*: Rejects any local file paths (`C:\Users\`).
    4. *High-Impact Gating*: Staged for human review if affecting governance (Domains A, G, M).
  - Master Brain Promotion Bridge: Promotes approved rules into `LEARNINGS.md` and updates `knowledge-index.json`.
- **Inputs**: Finished child product artifacts, test execution logs.
- **Outputs**: Promoted canonical rules, updated retrieval indexes.
- **Dependencies**: Layers 3, 4, 8, and 9.

---

## 3. Shared Supporting Infrastructure

| Infrastructure Subsystem | Purpose & Function | Implementation Files |
| :--- | :--- | :--- |
| **Knowledge Store** | Permanent storage of validated engineering rules and dossiers | `05_KNOWLEDGE/`, `LEARNINGS.md` |
| **Taxonomy / Ontology** | Canonical 13-domain taxonomy and classification schemas | `05_KNOWLEDGE/domain-registry.json` |
| **Relationship Graph** | Directed dependency edges between components, rules, and domains | `semantic-decomposer.mjs` |
| **Source Registry** | Verified repository sources, commit SHAs, and authority scores | `09_SOURCES/sources-catalog.json` |
| **Retrieval Engine** | Sub-15ms BM25 inverted index search over 384 MB corpus | `retrieval-engine.mjs` |
| **Skill Registry** | Composable tool definitions and execution recipes | `06_SKILLS/` |
| **Workflow Registry** | End-to-end task flows and pipeline stages | `04_WORKFLOWS/` |
| **Capability Registry** | System capabilities with empirical verification proofs | `08_VERIFICATION/` |
| **Evidence Ledger** | Verified test executions, exit codes, assertion counts | `08_VERIFICATION/` |
| **Model Connectors** | Model-agnostic integration contracts (OpenAI, Gemini, Claude, Ollama) | `02_AGENTS/`, `04_WORKFLOWS/` |
| **Tool Connectors** | Sandboxed execution tools (Node, Python, Go, Git, Docker) | `04_WORKFLOWS/factory-engine/` |
| **Project Context** | Project-specific memory, state, and decision tracking | `.project-brain/` |
| **Checkpoints** | Continuity state files for multi-step task resumption | `MASTER_COMPLETION_STATUS.md` |
| **Vault Backup & DR** | AES-256-GCM encrypted snapshot vault with tamper detection | `test-vault-backup-suite.mjs` |
| **Observability** | Execution logging, metrics, error tracking, circuit breakers | `.harvest-locks/`, audit logs |
| **Git Management** | Dual-track policy: safe Master auto-commit vs child manual commit | `master-brain-auto-commit.mjs` |

---

## 4. Architectural Microscopes (Evaluation Framework)

Every subsystem is evaluated through 6 distinct analytical microscopes:

1. **Structural Microscope**: Are code layout, AST, module boundaries, and folder structures strictly compliant with system invariants?
2. **Functional Microscope**: Does the code execute deterministically and produce the expected outputs in runtime environments?
3. **Knowledge Microscope**: Does the subsystem retrieve, apply, and cite correct canonical rules without hallucination?
4. **Quality Microscope**: Are all assertions empirically passing (Exit Code 0) with zero tolerance for skipped tests?
5. **Security Microscope**: Are secrets excluded, file paths sanitized, tamper attempts rejected, and permissions enforced?
6. **Operational Microscope**: Can the system scale, recover from process crashes, maintain locks, and preserve data integrity?

