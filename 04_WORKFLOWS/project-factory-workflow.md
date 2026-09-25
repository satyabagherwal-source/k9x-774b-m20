# Project Factory & Bootstrap Workflow

## 1. System Topology & Operational Flow

```
[ Master AI-Builder-Brain ] (Canonical Intelligence & Governance)
           │
           │ (Read-Only Canonical Rules, Protocols, Patterns)
           ▼
  [ AI Project Factory ] (Executable Scaffolding & Verification Engine)
           │
           │ (Single-Command Bootstrap & Scaffolding)
           ▼
[ Target Project Directory ]
           │
           ├─► Project Brain Bridge (.project-brain/brain-bridge.json)
           ├─► Independent Git Repository (Local + GitHub Remote)
           ├─► Astro 5 + Tailwind v4 + Vercel Architecture
           ├─► Local Context & Rules (PROJECT_CONTEXT.md, PROJECT_RULES.md)
           └─► Multi-Layer Live Verification Suite
```

---

## 2. Factory Responsibilities vs Master Brain Responsibilities

| Dimension | Master AI-Builder-Brain | AI Project Factory |
|---|---|---|
| **Role** | Canonical Source of Truth | Executable Automation Engine |
| **Contents** | Principles, Protocols, Engineering Patterns | CLI, Scripts, Scaffolder, Live Probes |
| **Git Identity** | Dedicated Repo (`AI-Builder-Brain`) | Dedicated Repo (`project-factory-setup`) |
| **Write Policy** | Protected; human-review required | Version-controlled releases |
| **Project Interaction** | Referenced via Brain Bridge | Generates and verifies project environment |

---

## 3. End-to-End Project Creation Cycle

1. **Trigger**: Builder or agent invokes `node bin/project-factory.mjs bootstrap --target <path> --name <name>`.
2. **Environment Pre-flight**: Probes Node, npm, Git, GitHub CLI auth, and Vercel.
3. **Bridge Binding**: Resolves Master Brain location, validates 16 core folders, establishes read-only bridge.
4. **Scaffolding**: Emits Astro 5, Tailwind v4 CSS-first `@theme`, Vercel config, `design.md`, and local state files.
5. **Git Initialization**: Inits independent Git repository and creates initial commit.
6. **Live Multi-Layer Verification**: Runs live production build and probes dev-server socket for HTTP 200.
7. **Certification**: Generates `PROJECT_READY_CERTIFICATE.md` with status `READY`.
