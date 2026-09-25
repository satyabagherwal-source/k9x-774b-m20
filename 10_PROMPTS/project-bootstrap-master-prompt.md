# Universal Project Bootstrap Master Prompt (Canonical User Directive)

> **Purpose**: This is the single, universal bootstrap prompt to copy and paste into any newly created empty folder opened in Antigravity IDE (or any AI coding environment). It instructs the AI agent to discover the canonical Master Brain (`C:\AI-Builder-Brain`), execute the Universal Project Factory engine, resolve the optimal architecture based on project intent, install only required dependencies, verify live execution, and certify the project as `PROJECT READY`.

---

## The Prompt to Copy & Paste

Copy the entire block below and paste it into the AI Agent chat in your new empty project folder:

```markdown
### SYSTEM DIRECTIVE: Universal Autonomous Project Bootstrap via AI-Builder-Brain

You are an elite autonomous software engineering agent tasked with bootstrapping a brand new, production-ready project in this current directory using our central **AI-Builder-Brain** Universal Project Factory & Operating System.

Follow this strict, non-negotiable execution sequence from start to finish:

---

### STEP 1: Discover & Verify Master AI-Builder-Brain
1. Locate the canonical Master Brain at:
   - Primary: `C:\AI-Builder-Brain`
   - Fallback: check environment variable `AI_BUILDER_BRAIN_PATH` or parent directory `..\AI-Builder-Brain`
2. Inspect the Master Brain path to verify that core directories (`00_START_HERE`, `01_CORE`, `04_WORKFLOWS`) are present.
3. Enforce the **Zero-Copy Rule**: You must NEVER copy the Master Brain repository into this folder. Master Brain is strictly read-only.

---

### STEP 2: Execute Scaffolding & Setup
You can either run the native factory bootstrap command:
```bash
node C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\bootstrap.mjs --target .
```
*(Optionally append `--type <type>` or `--intent "<description>"` if specific archetypes like `seo-adsense-micro-website`, `ai-saas`, `fullstack-web-app`, `api-backend-service`, etc. are desired).*

OR execute the canonical steps natively:
1. **Detect Project Intent & Profile**:
   - Analyze requirements: determine whether the project is an SEO Micro Website, Single-Page Tool, Full-stack Web App, AI SaaS, API Service, Automation System, or Custom/Adaptive.
   - Select architecture, styling, and runtimes accordingly.
2. **Environment Pre-flight**:
   - Verify Node.js (>= 18.0.0), npm, and Git.
   - Run `gh auth status` to check GitHub CLI authorization status.
3. **Establish Zero-Copy Brain Bridge**:
   - Create `.project-brain/` directory with `incidents/`, `lessons/`, and `promotion-queue/`.
   - Write `.project-brain/brain-bridge.json` pointing to `C:\AI-Builder-Brain` in read-only mode with selective knowledge indexing.
4. **Scaffold Golden Blueprint & Generate All 11 Project Brain OS Files**:
   - Instantiate matching blueprint from Master Brain (`astro-tailwind-v4` or `fullstack-ai-saas`).
   - Generate all 11 canonical project-local Brain files:
     * `PROJECT_CONTEXT.md` (Project mission, stack, boundaries)
     * `PROJECT_RULES.md` (Non-destructive invariants, live verification rules)
     * `PROJECT_KNOWLEDGE.md` (Selectively resolved patterns from Master Brain)
     * `PROJECT_SKILLS.md` (Selectively resolved skills & MCPs)
     * `PROJECT_STATE.json` (Machine-readable state, capabilities, milestones)
     * `PROJECT_LEARNING.md` (Forensic incident & learning register)
     * `PROJECT_DECISIONS.md` (Architecture Decision Records ADR-001, ADR-002)
     * `PROJECT_ARCHITECTURE.md` (Directory topology, component layout)
     * `PROJECT_REQUIREMENTS.md` (Functional, quality, and acceptance criteria)
     * `PROJECT_ENVIRONMENT.md` (Tool versions and environment boundary)
     * `PROJECT_READY_CERTIFICATE.md` (Certified readiness proof)

---

### STEP 3: Install Targeted Dependencies
Run:
```bash
npm install
```
Verify zero fatal installation errors. Only install what the project actually needs!

---

### STEP 4: Independent Git & GitHub Initialization
1. Initialize local git repository:
   ```bash
   git init -b main
   ```
2. Stage and commit initial scaffolding:
   ```bash
   git add .
   git commit -m "feat: initial bootstrap from canonical AI-Builder-Brain"
   ```
3. If `gh auth status` indicates logged-in status and user authorizes remote repo creation:
   - Run `gh repo create <project-name> --source=. --remote=origin --private --push`
   - If not authenticated, record in `PROJECT_STATE.json` as `LOCAL_GIT_INITIALIZED` and proceed.

---

### STEP 5: Multi-Layer Live Verification
Execute real verification commands:
1. **Build Verification**:
   - Run `npm run build`
   - Verify exit code is 0 and production bundle (`dist/index.html`) exists.
2. **Server Live Probe**:
   - Boot dev/API server on an isolated background port, probe with HTTP GET for status 200, and terminate cleanly.
3. **Quality Verification**:
   - For Web/SEO: Verify metadata, canonical link, and compiled CSS tokens.
   - For AI/API: Verify `/api/health` returns HTTP 200 and JSON contract.

---

### STEP 6: Generate Ready Certification & Report
1. Write `PROJECT_READY_CERTIFICATE.md` documenting:
   - Project Name, Profile, Timestamp, Environment versions
   - Multi-Pillar verification status table
   - Final status: `PROJECT STATUS: READY : CERTIFIED`
2. Update `PROJECT_STATE.json` to `"status": "READY"`.
3. Present a clear, concise summary table to the user with verified artifacts.
```

---

## Autonomous Execution Rules for Agents

- **No Premature Stack Assumptions**: Determine project class and requirements first.
- **Minimal Required Footprint**: Only install packages strictly needed for the profile.
- **Evidence Over Confidence**: Never declare success without running actual build and server verification.
- **Zero Master Brain Mutation**: Never modify files in `C:\AI-Builder-Brain` during child project bootstrap.
