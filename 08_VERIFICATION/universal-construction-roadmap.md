# AI-BUILDER-BRAIN — UNIVERSAL CONSTRUCTION ROADMAP
## Prioritized Programs (P0–P11) & PAC-006 Controlled Experiment Protocol

> **Canonical Authority**: Master Construction Roadmap & Sequencing Specification  
> **Location**: `08_VERIFICATION/universal-construction-roadmap.md`  
> **Status**: APPROVED & ACTIVE  
> **Axiom**: **Dependencies Must Be Respected. Never Jump to Downstream Construction Without Upstream Verification.**

---

## 1. Executive Roadmap Topology

The 12 Construction Programs (P0–P11) are organized in a strict dependency sequence:

```
┌────────────────────────────────────────────────────────┐
│ P0: Architecture Truth & Evidence Audit (Active/Done) │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ P1: Universal Knowledge Acquisition (Multi-Source)     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ P2: Deep Knowledge Intelligence (Semantic Graph)       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ P3: Universal Retrieval Intelligence (Applicability)   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ P4: A–M Domain Capability Completion (13 Domains)      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ P5: Universal Skills & Workflow Engine (DAG Saga)      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ P6: Requirements & Construction Intelligence (Blueprint)
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ P7: Universal Product Construction (Multi-Stack Code)  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ P8: Project Factory & Product Intelligence (Isolation) │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ P9: Quality, Verification, Security & Operations (DR)  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ P10: Learning & Evolution (PAC-006 2-Project Test)     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ P11: Model, Tool & Ecosystem Independence              │
└────────────────────────────────────────────────────────┘
```

---

## 2. Program-by-Program Specifications

### Program P0: Architecture Truth & Evidence Audit
- **Objective**: Establish complete empirical truth across all 16 canonical folders, verify existing test suites, eliminate dead or unverified claims, and record verified capabilities as `DONE`.
- **Prerequisites**: None (Foundational).
- **Deliverables**:
  - `08_VERIFICATION/master-architecture-blueprint.md`
  - `08_VERIFICATION/capability-and-evidence-ledger.md`
  - `08_VERIFICATION/universal-construction-roadmap.md`
  - `01_CORE/SYSTEM_VISION_AND_GOALS.md`
- **Acceptance Criteria**: All 16 folders mapped, live tests verified with Exit Code 0, and capabilities classified cleanly.
- **Current Status**: 🟢 **`DONE`** (Completed in this session).

---

### Program P1: Universal Knowledge Acquisition
- **Objective**: Expand harvesting beyond GitHub to official documentation, standards (RFCs, W3C, ISO), scientific papers, engineering blogs, and security advisories.
- **Prerequisites**: P0 complete.
- **Sub-Tasks**:
  1. *Source-Specific Adapters*: Build parsers for Markdown documentation, OpenAPI specs, RFC text, and academic PDFs.
  2. *Licensing & Privacy Checkers*: Automated verification of open-source licenses and exclusion of proprietary or private code.
  3. *Incremental Harvester*: Content-hash diffing to prevent redundant re-fetching of unchanged sources.
- **Acceptance Criteria**: Successfully harvest and parse at least 3 non-GitHub sources (e.g. Node.js docs, RFC 7231, Tailwind CSS specs) with provenance tracking.
- **Current Status**: 🟡 **`NEXT ACTIVE PROGRAM`**.

---

### Program P2: Deep Knowledge Intelligence
- **Objective**: Transform raw harvested extractions into rich semantic concept graphs, cross-source conflict resolution, and technology version-applicability boundaries.
- **Prerequisites**: P1.
- **Sub-Tasks**:
  1. *AST Relationship Extractor*: Extract caller/callee graphs and component boundaries.
  2. *Conflict Detection Engine*: Identify contradictory patterns across sources and tag them with confidence ratings.
  3. *Negative Constraint Miner*: Automatically harvest bug-fix diffs (`- Buggy`, `+ Safe`) into anti-pattern rules.
- **Acceptance Criteria**: Detect conflicting patterns in two competing implementations and classify them into context-specific applicability envelopes.
- **Current Status**: ⚪ `PLANNED`.

---

### Program P3: Universal Retrieval Intelligence
- **Objective**: Elevate retrieval from simple keyword BM25 to context-aware applicability retrieval with source-to-answer traceability.
- **Prerequisites**: P2.
- **Sub-Tasks**:
  1. *Applicability Scoring*: Weight rules by runtime environment (e.g. edge vs container vs browser).
  2. *Token-Budget Optimization*: Dynamic snippet summarization fitting within strict model context windows.
  3. *Stale Knowledge Filter*: Deprecate rules targeting obsolete framework versions.
- **Acceptance Criteria**: Querying for a framework-specific pattern returns only version-compatible rules with zero obsolete recommendations.
- **Current Status**: ⚪ `PLANNED`.

---

### Program P4: A–M Domain Capability Completion
- **Objective**: Complete full operational capability across all 13 domains (especially D, E, F, I, J, L) beyond foundational schemas.
- **Prerequisites**: P3.
- **Sub-Tasks**:
  1. *Design System Engine (Domain F)*: Responsive token synthesis, color palettes, and accessible layout trees.
  2. *SEO & Distribution Engine (Domain J)*: Automated sitemap generation, OpenGraph tags, and JSON-LD structured data.
  3. *DevOps & CI/CD Generator (Domain L)*: Production Dockerfiles, GitHub Actions workflows, and health-check probes.
- **Acceptance Criteria**: Generate complete, valid artifacts for all 13 domains for any arbitrary product intent.
- **Current Status**: ⚪ `PLANNED`.

---

### Program P5: Universal Skills & Workflow Engine
- **Objective**: Dynamic skill composition and resilient execution orchestrator with automated rollback.
- **Prerequisites**: P4.
- **Sub-Tasks**:
  1. *Skill Registry v2*: Versioned skill contracts with input/output validation schemas.
  2. *Saga Rollback Engine*: Automated compensating transactions when multi-step tasks fail.
  3. *Skill Telemetry*: Measure execution duration, token overhead, and success rates.
- **Acceptance Criteria**: Simulated mid-pipeline failure triggers clean compensating rollback without residual orphan state.
- **Current Status**: ⚪ `PLANNED`.

---

### Program P6: Requirements & Construction Intelligence
- **Objective**: Full bidirectional translation between natural-language product visions, epistemic requirements DAGs, and multi-file project specifications.
- **Prerequisites**: P5.
- **Sub-Tasks**:
  1. *Interactive Clarifier*: Discovers ambiguities and poses focused questions to the user.
  2. *Dynamic Architecture Formulator*: Automatically selects architectural patterns (Microservices vs Modular Monolith vs Local-First).
- **Acceptance Criteria**: 100% requirements-to-task traceability across all subtasks in the generated DAG.
- **Current Status**: 🟢 **`FOUNDATION DONE`** (Enhancements planned).

---

### Program P7: Universal Product Construction
- **Objective**: Universal code generation spanning desktop apps, mobile backends, CLI tools, web platforms, and AI automations.
- **Prerequisites**: P6.
- **Sub-Tasks**:
  1. *Multi-Language Code Synthesis*: Expand from JS/Python/Go to Rust, C++, and Swift.
  2. *Real Integration Stubs*: Zero-mock external API integrations with simulated sandboxes.
- **Acceptance Criteria**: Generate and execute compilable Rust or Go projects in sandboxes with exit code 0.
- **Current Status**: 🟢 **`5 BENCHMARKS DONE`** (Language expansion planned).

---

### Program P8: Project Factory & Product Intelligence
- **Objective**: Complete workspace isolation between Master Brain and child products.
- **Prerequisites**: P7.
- **Sub-Tasks**:
  1. *Child Project Scaffolder*: Initializes independent Git repos with zero Master Brain inheritance.
  2. *Local Telemetry Collector*: Captures build errors, runtime crashes, and user feedback in `.project-brain/`.
- **Acceptance Criteria**: Child project operates completely standalone without file path references to `C:\AI-Builder-Brain`.
- **Current Status**: 🟢 **`DONE`**.

---

### Program P9: Quality, Verification, Security & Operations
- **Objective**: End-to-end production readiness, security auditing, and automated disaster recovery.
- **Prerequisites**: P8.
- **Sub-Tasks**:
  1. *Static Analysis Barrier*: Automated ESLint, Flake8, and ShellCheck integration.
  2. *Secret Sanitizer*: Blocks hardcoded API keys and tokens from being emitted.
  3. *Vault Snapshot Sync*: Automated scheduled encrypted backups with offline resilience.
- **Acceptance Criteria**: Rejection of insecure code with hardcoded credentials; verified AES-256-GCM vault backup.
- **Current Status**: 🟢 **`VAULT BACKUP DONE`** (Static analysis expansion planned).

---

### Program P10: Learning & Evolution (The PAC-006 Experiment)
- **Objective**: Prove empirically that real project execution results can be validated and promoted to Master Brain, causing a measurable improvement in subsequent product construction.
- **Prerequisites**: P8 and P9.
- **Protocol**: See Section 3 below.
- **Current Status**: 🟡 **`SCHEDULED FOR IMMEDIATE EXECUTION`**.

---

### Program P11: Model, Tool & Ecosystem Independence
- **Objective**: Verify that AI-Builder-Brain operates identically across OpenAI GPT-4o, Anthropic Claude 3.7, Google Gemini 2.0/3.0, DeepSeek R1, and local Ollama models.
- **Prerequisites**: P10.
- **Sub-Tasks**:
  1. *Model Connector Abstraction*: Standardized prompt envelopes and tool-call bridges.
  2. *Cross-Model Benchmark*: Identical construction goals executed across 3 different model families.
- **Acceptance Criteria**: Identical passing test suites (Exit Code 0) generated by at least 2 distinct model families using the same Brain intelligence.
- **Current Status**: ⚪ `PLANNED`.

---

## 3. PAC-006 Controlled 2-Project Experiment Protocol

To prevent flooding the Brain with premature or circular learnings, PAC-006 executes this controlled 2-project comparison experiment:

```
[Master Brain Knowledge Baseline]
             │
             ▼
      [Step 1: Build Project A] ➔ Multi-Tenant SaaS Workspace Platform
             │
             ▼
      [Step 2: Empirical Evidence] ➔ Run tests, capture duration, errors, and fixes
             │
             ▼
      [Step 3: Extract Candidate Learning] ➔ e.g. "Tenant Isolation Memory Invariant"
             │
             ▼
      [Step 4: 4-Pillar Validation Barrier] ➔ Execution (0), Non-Trivial, No Path Leak, Gating
             │
             ▼
      [Step 5: Promote to Master Brain] ➔ Append Rule 1718 to LEARNINGS.md & Index
             │
             ▼
      [Step 6: Build Project B] ➔ Multi-Tenant Webhook Delivery Service
             │                    (Queries and retrieves the new Rule 1718!)
             ▼
      [Step 7: Measure Improvement Delta] ➔ Faster build, fewer steps, higher test coverage
```

### Acceptance Conditions:
1. **Measurable Delta**: Project B must show demonstrable improvement (e.g. reduced defect rate, higher assertion count, lower memory footprint, or zero security vulnerabilities) derived directly from Rule 1718.
2. **Provenance Traceability**: Rule 1718 must trace back to the exact code diff and test failure in Project A.
3. **No Circular Self-Praise**: The improvement must be empirical (automated test execution), not a textual assertion.

