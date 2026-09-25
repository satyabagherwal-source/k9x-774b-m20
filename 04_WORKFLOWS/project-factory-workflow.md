# Universal Project Factory & Operating System Workflow

> **Canonical reference**: `AI-Builder-Brain/04_WORKFLOWS/project-factory-workflow.md`  
> **Purpose**: Defines the Universal Project Factory & Operating System inside AI-Builder-Brain. Future projects across any tech stack require only an empty folder and the single bootstrap prompt; no separate factory repository is required.

---

## 🔒 Canonical Core Invariant

```
PROJECT FACTORY = ENVIRONMENT INITIALIZATION ONLY.
```

- **Project Factory never generates actual products, websites, SaaS dashboards, calculators, font tools, AdSense units, or business logic.**
- `--intent` specifies **PROJECT CLASS / ENVIRONMENT REQUIREMENTS** (not product build instructions).
- **Two Completely Separate Lifecycle Phases**:
  - **PHASE A — PROJECT FACTORY**: Empty Folder -> Complete Development Environment -> `ENVIRONMENT READY : CERTIFIED` -> **STOP**.
  - **PHASE B — PRODUCT DEVELOPMENT**: Starts ONLY when the user gives a separate prompt: *"Now build my actual product: ______"* -> `PRODUCT READY : CERTIFIED`.

---

## 1. System Topology & Operational Flow

```
[ Master AI-Builder-Brain ] (C:\AI-Builder-Brain)
           │
           │ (Single Bootstrap Prompt in Antigravity IDE)
           ▼
[ Target Project Directory ] (e.g. C:\my-project)
           │
           ├─► Project Intent / Environment Profile Detection (Astro SEO, AI SaaS, Micro Tool, API, etc.)
           ├─► Project Brain Bridge (.project-brain/brain-bridge.json) [Zero-Copy Link]
           ├─► Scaffolding: Environment Starter Instantiation (Astro / React+Vite / Fullstack)
           ├─► Project-Local Brain OS (All 11 Mandatory Governance Files)
           │   ├── PROJECT_CONTEXT.md
           │   ├── PROJECT_RULES.md
           │   ├── PROJECT_KNOWLEDGE.md
           │   ├── PROJECT_SKILLS.md
           │   ├── PROJECT_STATE.json
           │   ├── PROJECT_LEARNING.md
           │   ├── PROJECT_DECISIONS.md
           │   ├── PROJECT_ARCHITECTURE.md
           │   ├── PROJECT_REQUIREMENTS.md
           │   ├── PROJECT_ENVIRONMENT.md
           │   └── ENVIRONMENT_READY_CERTIFICATE.md
           ├─► Independent Git Repository (Local Init + GitHub Remote)
           ├─► Multi-Layer Live Verification (Build + Socket Probe + Quality)
           ├─► Product Generation Boundary Verification (0 Product Code)
           └─► ENVIRONMENT_READY_CERTIFICATE.md (Status: ENVIRONMENT READY : CERTIFIED)
```

---

## 2. Supported Project Classes & Environment Baselines

- **SEO & Google AdSense Micro Websites** (`seo-adsense-micro-website`): Astro 5, Tailwind v4, SEO tooling, AdSense knowledge references, accessibility. *(No Font Finder, no calculators, no AdSense components created)*.
- **Single-page Tool Websites** (`single-page-tool-website`): Astro/Vite reactive islands, Tailwind v4, calculation tooling. *(No domain calculation or tool logic created)*.
- **Micro Tool Websites** (`micro-tool-website`): Multi-route SSG environment.
- **Full-stack AI SaaS Applications** (`ai-saas`): React 19 + Vite frontend, Express API backend runtime, Tailwind v4, DB tooling readiness. *(No SaaS dashboard, no AI inference forms, no business logic created)*.
- **Full-stack Web Applications** (`fullstack-web-app`): React + Vite + Node API.
- **Software-as-a-Service Platforms** (`saas`): Multi-tenant architecture baseline.
- **Micro-SaaS Applications** (`micro-saas`): Lightweight SaaS stack baseline.
- **Interactive AI Applications** (`ai-application`): AI runtime environment.
- **Autonomous AI Agents** (`ai-agent`): Agent framework baseline.
- **API & Backend Microservices** (`api-backend-service`): Express API service baseline.
- **Heavy Web Applications** (`heavy-web-app`): Enterprise full-stack baseline.
- **Automation & Workflow Systems** (`automation-system`): Background worker pipeline.
- **Developer Tools & CLIs** (`developer-tool`): CLI package scaffolding.
- **System / OS Utilities** (`system-os-project`): System daemon/cli environment.
- **Custom / Unknown Projects** (`custom-unknown`): Requirements-first adaptive baseline.

---

## 3. End-to-End Autonomous Bootstrap Lifecycle

1. **Discovery**: Resolves `C:\AI-Builder-Brain` and inspects canonical directories in read-only mode.
2. **Intent & Profile Resolution**: Dynamically resolves tech stack, styling, runtime, MCPs, skills, and verification pillars based on project class.
3. **Environment Pre-flight**: Verifies Node.js, npm, Git, and profile-specific tools.
4. **Scaffolding & OS Generation**: Instantiates golden environment starter and emits all 11 Project-Local Brain files.
5. **Bridge Binding**: Generates `.project-brain/brain-bridge.json` connecting child project to Master Brain in read-only mode.
6. **Targeted Dependency Installation**: Installs only packages required for the resolved profile.
7. **Git & GitHub Initialization**: Initializes independent Git repository, validates identity, creates initial commit, and connects GitHub remote if authorized.
8. **Live Multi-Layer Verification**:
   - Production bundle compilation (`npm run build`).
   - Live runtime server socket probe (HTTP 200 OK).
   - Profile quality verification (baseline environment contracts).
   - **Product Generation Boundary Audit**: Verifies 0 product components, 0 extra pages, 0 business logic.
9. **Environment Ready Certification**: Finalizes `ENVIRONMENT_READY_CERTIFICATE.md` with status `ENVIRONMENT READY : CERTIFIED`.
10. **STOP**: Project Factory terminates. System is now ready for Phase B (Product Development).
