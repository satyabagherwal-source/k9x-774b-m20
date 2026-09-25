# Universal Project Factory & Operating System Workflow

> **Canonical reference**: `AI-Builder-Brain/04_WORKFLOWS/project-factory-workflow.md`  
> **Purpose**: Defines the Universal Project Factory & Operating System inside AI-Builder-Brain. Future projects across any tech stack require only an empty folder and the single bootstrap prompt; no separate factory repository is required.

---

## 1. System Topology & Operational Flow

```
[ Master AI-Builder-Brain ] (C:\AI-Builder-Brain)
           │
           │ (Single Bootstrap Prompt in Antigravity IDE)
           ▼
[ Target Project Directory ] (e.g. C:\my-project)
           │
           ├─► Project Intent / Profile Detection (Astro SEO, AI SaaS, Micro Tool, API, etc.)
           ├─► Project Brain Bridge (.project-brain/brain-bridge.json) [Zero-Copy Link]
           ├─► Scaffolding: Blueprint Instantiation (Astro / React+Vite / Fullstack)
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
           │   └── PROJECT_READY_CERTIFICATE.md
           ├─► Independent Git Repository (Local Init + GitHub Remote)
           ├─► Multi-Layer Live Verification (Build + Socket Probe + Quality)
           └─► PROJECT_READY_CERTIFICATE.md (Status: CERTIFIED READY)
```

---

## 2. Supported Project Classes

- **SEO & Google AdSense Micro Websites** (`seo-adsense-micro-website`)
- **Single-page Tool Websites** (`single-page-tool-website`)
- **Micro Tool Websites** (`micro-tool-website`)
- **Full-stack AI SaaS Applications** (`ai-saas`)
- **Full-stack Web Applications** (`fullstack-web-app`)
- **Software-as-a-Service Platforms** (`saas`)
- **Micro-SaaS Applications** (`micro-saas`)
- **Interactive AI Applications** (`ai-application`)
- **Autonomous AI Agents** (`ai-agent`)
- **API & Backend Microservices** (`api-backend-service`)
- **Heavy Web Applications** (`heavy-web-app`)
- **Automation & Workflow Systems** (`automation-system`)
- **Developer Tools & CLIs** (`developer-tool`)
- **System / OS Utilities** (`system-os-project`)
- **Custom / Unknown Projects** (`custom-unknown`)

Rule: For custom/unknown projects, the factory determines requirements and architecture first; it NEVER assumes a stack.

---

## 3. End-to-End Autonomous Bootstrap Lifecycle

1. **Discovery**: Resolves `C:\AI-Builder-Brain` and inspects canonical directories in read-only mode.
2. **Intent & Profile Resolution**: Dynamically resolves tech stack, styling, runtime, MCPs, skills, and verification pillars.
3. **Environment Pre-flight**: Verifies Node.js, npm, Git, and profile-specific tools.
4. **Scaffolding & OS Generation**: Instantiates golden blueprint and emits all 11 Project-Local Brain files.
5. **Bridge Binding**: Generates `.project-brain/brain-bridge.json` connecting child project to Master Brain in read-only mode.
6. **Targeted Dependency Installation**: Installs only packages required for the resolved profile.
7. **Git & GitHub Initialization**: Initializes independent Git repository, validates identity, creates initial commit, and connects GitHub remote if authorized.
8. **Live Multi-Layer Verification**:
   - Production bundle compilation (`npm run build`).
   - Live runtime server socket probe (HTTP 200 OK).
   - Profile quality verification (SEO tags / AI API contracts).
9. **Ready Certification**: Finalizes `PROJECT_READY_CERTIFICATE.md` with status `READY : CERTIFIED`.
