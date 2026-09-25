# ADR-001: Native Project Factory Integration into AI-Builder-Brain

- **Status**: Accepted
- **Date**: 2026-09-25
- **Author**: satyabgherval-source
- **Context**: Autonomous AI Project Operating System Architecture

---

## 1. Context & Problem Statement

In initial architectural explorations, the Project Factory capability was prototyped as a separate external repository (`project-factory-setup`) with independent CLI tools and templates. 

However, this architecture required the human builder to:
1. Manually open, maintain, or run a separate Project Factory codebase.
2. Manually copy scaffolding files or run external binaries across different terminal workspaces.
3. Coordinate synchronization between Master Brain rules and Factory templates.

The builder's ultimate vision is friction-free autonomy:
- Create a new empty folder.
- Open it in Antigravity IDE.
- Paste a single canonical bootstrap prompt into chat.
- The AI agent reads the canonical Master Brain, scaffolds the project, binds a zero-copy Brain Bridge, initializes Git/GitHub, configures the modern web stack (Astro 5 + Tailwind CSS v4 + Vercel), runs live multi-layer verification, and certifies `PROJECT READY`.

---

## 2. Decision

We integrate the entire Project Factory intelligence, blueprints, and execution engine directly and natively into **`AI-Builder-Brain`**:

1. **AI-Builder-Brain as Single Source of Truth**:
   - `AI-Builder-Brain` houses the canonical Project Operating System AND the native Project Factory capability.
   - Separate Project Factory repositories (`C:\project factory setup`) are superseded and no longer a prerequisite for project bootstrapping.

2. **Zero-Copy Brain Bridge Architecture**:
   - Master Brain is NEVER copied into child project folders.
   - Child projects link to Master Brain via a lightweight `.project-brain/brain-bridge.json` configuration in read-only mode.
   - Master Brain canonical files cannot be modified by child projects.

3. **Autonomous Golden Blueprints & Engine**:
   - Production blueprints reside natively in `04_WORKFLOWS/blueprints/astro-tailwind-v4/`.
   - The zero-dependency Node.js automation engine resides in `04_WORKFLOWS/factory-engine/`.
   - The master user bootstrap prompt resides in `10_PROMPTS/project-bootstrap-master-prompt.md`.

4. **Independent Git Repositories**:
   - Each bootstrapped project initializes its own independent Git repository with its own GitHub remote.
   - Master Brain repository remains completely isolated with its own commit history.

---

## 3. Consequences

### Positive:
- **Zero Friction**: A builder never needs to touch or run an external factory repo.
- **Single Source of Truth**: Engineering patterns, skills, error-prevention protocols, and golden templates evolve together in one canonical repository.
- **Pure Portability**: Master Brain remains portable and can bootstrap projects on any machine with standard Node.js and Git.
- **Verifiable Readiness**: Every new project receives automated 7-pillar live verification before code development begins.

### Neutral / Trade-offs:
- Master Brain repository must maintain golden templates and factory scripts up to date via the 13-stage Ecosystem Adaptation Pipeline.
