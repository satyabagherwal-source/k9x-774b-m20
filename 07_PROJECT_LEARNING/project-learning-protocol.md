# Project Learning Protocol & Deep Forensic Standard

This folder captures exhaustive, multi-dimensional engineering intelligence produced by real project work and deep codebase autopsies before that learning is promoted into the Master Brain.

---

## 1. Cardinal Law: Depth Over Velocity

> **"Bhale hi 1 din ka kaam 10 din me ho paye, par totally deep learning karni h na ki shallow."**  
> *(Even if 1 day's work takes 10 days to complete, learning must be completely deep, exhaustive, and forensic. Shallow summaries are strictly prohibited).*

### Non-Negotiable Invariants:
1. **Zero Fluff**: Never generate high-level marketing overviews, promotional descriptions, or generic bullet points.
2. **Empirical Code Grounding**: Every documented defect, rule, and pattern must cite real repository code, commit SHAs, line numbers, or test suites.
3. **Before/After Diff Requirement**: Every production incident must show the actual code patch (`- Buggy Code`, `+ Safe Invariant`).
4. **Substance Threshold**: Any candidate rule failing the 200+ character substance requirement or missing concrete negative constraints with anti-pattern code is strictly rejected.

---

## 2. Canonical Structure of a Deep Forensic Learning Record

Every file created in `07_PROJECT_LEARNING/[project]-learnings.md` (e.g. `ollama-learnings.md`, `llamacpp-learnings.md`, `ai-builder-brain-factory-engine-learnings.md`) MUST contain these 5 sections:

### Section 1: Executive Forensic Architecture & System Mechanics
- Core problem solved and subsystem decoupling.
- Decoupled modular boundaries, memory/hardware resource allocation, and concurrency barriers.

### Section 2: Forensic Real Incidents & Production Patches (Minimum 5 to 15 Real Incidents)
For each real bug fix/incident discovered from the commits, patches, and issues, document:
- **Context**: Subsystem and file path
- **What Was Expected**: The required functional and invariant behavior
- **What Actually Happened**: The precise failure mode (memory leak, race condition, OOM, deadlock)
- **Evidence in Repo**: Commit SHA, PR link, exact file path, and tests
- **Root Cause**: Deep forensic root-cause analysis
- **Remediation Code Diff**: Real `-` and `+` code blocks showing the fix
- **Lesson**: Generalized engineering invariant

### Section 3: The 9 Deep Learning Dimensions
Deep forensic analysis across:
1. **Architecture**: Subsystem layout, modular boundaries, decoupling strategy.
2. **Core Abstractions**: Foundational types, domain interfaces, invariant contracts.
3. **Error Handling**: Exception hierarchies, recovery barriers, rollback strategies.
4. **Testing**: Unit invariants, mock philosophies, automated regression shields.
5. **Security**: Threat mitigation, input sanitization, capability containment.
6. **Performance**: Allocation bottlenecks, memory caching, algorithmic optimizations.
7. **Deployment**: Container definitions, CI/CD pipeline invariants, runtime configs.
8. **Agent Patterns**: Autonomous tool integrations, execution loop bounds, memory caching.
9. **Data Flow**: Mutation lifecycle, serialization protocols, asynchronous pipelines.

### Section 4: The 8 Learning Extraction Artifacts
Synthesizing:
1. **Pattern**: Production-grade verified pattern with complete code.
2. **Rule**: Universal invariant (MUST / MUST NOT) to enforce across software systems.
3. **Architecture Principle**: High-level architectural law and structural trade-off.
4. **Failure Mode**: Precise technical breakdown of the bug/crash/exploit observed.
5. **Reusable Skill**: Step-by-step procedural workflow/checklist for an AI coding agent.
6. **Decision**: Engineering design trade-off and forensic rationale why alternatives were rejected.
7. **Anti-pattern**: Negative constraint with concrete "bad code" to NEVER write.
8. **Verification Method**: Concrete automated test, assert, lint, or check to prove compliance.

### Section 5: Promotion Boundary & Master Brain Synchronization
- Candidate rules meeting the strict schema are staged for promotion into `05_KNOWLEDGE/engineering-patterns.md`.
- Project-specific facts remain safely in this project record without bloating the core rules.

