# Project Factory & Native Bootstrap Workflow

> Canonical reference: `AI-Builder-Brain/04_WORKFLOWS/project-factory-workflow.md`  
> Purpose: Defines the native, self-contained project bootstrap engine inside AI-Builder-Brain. Future projects require only an empty folder and the single bootstrap prompt; no separate factory repository is required.

---

## 1. System Topology & Operational Flow

```
[ Master AI-Builder-Brain ] (Canonical Intelligence, Governance, Blueprints & Engine)
(c:\AI-Builder-Brain)
           │
           │ (Single Bootstrap Prompt in Antigravity IDE)
           ▼
[ Target Project Directory ] (e.g. c:\my-new-project)
           │
           ├─► Project Brain Bridge (.project-brain/brain-bridge.json) [Zero-Copy Link]
           ├─► Scaffolding: Astro 5 + Tailwind CSS v4 (@theme) + Vercel
           ├─► Local Operating System (PROJECT_CONTEXT.md, PROJECT_RULES.md, PROJECT_STATE.json)
           ├─► Independent Git Repository (Local Init + GitHub Remote)
           ├─► Multi-Layer Live Verification (Build + Socket Probe)
           └─► PROJECT_READY_CERTIFICATE.md (Status: CERTIFIED READY)
```

---

## 2. Native Capabilities Inside AI-Builder-Brain

Unlike previous iterations that contemplated a separate `project-factory-setup` repository, the **AI-Builder-Brain natively houses all Project Factory capabilities**:

| Dimension | Native AI-Builder-Brain Implementation |
|---|---|
| **Canonical Location** | `C:\AI-Builder-Brain` (independent Git repository) |
| **Blueprints** | `04_WORKFLOWS/blueprints/astro-tailwind-v4/` (Full golden templates) |
| **Automation Engine** | `04_WORKFLOWS/factory-engine/bootstrap.mjs` (Zero-dependency Node engine) |
| **Bridge Specification** | `13_GOVERNANCE/brain-bridge-protocol.md` |
| **Verification Gate** | `08_VERIFICATION/project-ready-certification-protocol.md` |
| **Master Prompt** | `10_PROMPTS/project-bootstrap-master-prompt.md` |

---

## 3. End-to-End Autonomous Bootstrap Lifecycle

When an agent executes the bootstrap prompt in an empty folder:

1. **Discovery**: Resolves `C:\AI-Builder-Brain` and validates core folders and documents.
2. **Environment Pre-flight**: Verifies Node.js (>= 18), npm (>= 9), Git, and GitHub CLI.
3. **Bridge Binding**: Generates `.project-brain/brain-bridge.json` connecting child project to Master Brain in read-only mode.
4. **Scaffolding**: Emits Astro 5, Tailwind v4 `@theme`, Vercel config, `design.md`, components, and local state files.
5. **Dependency Installation**: Runs `npm install`.
6. **Git Initialization**: Initializes independent local Git repository and creates initial commit.
7. **GitHub Remote Link**: If `gh auth status` passes and authorized, creates remote repository and pushes code.
8. **Live Multi-Layer Verification**:
   - Compiles static production build (`npm run build`).
   - Probes live dev-server on isolated socket (HTTP 200).
   - Validates OKLCH CSS tokens in `dist/`.
9. **Ready Certification**: Emits `PROJECT_READY_CERTIFICATE.md` with status `READY`.
