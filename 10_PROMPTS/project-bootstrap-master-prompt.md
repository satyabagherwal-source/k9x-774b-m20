# Universal Project Bootstrap Master Prompt (Canonical User Directive)

> **Purpose**: This is the single, universal bootstrap prompt to copy and paste into any newly created empty folder opened in Antigravity IDE (or any AI coding environment). It instructs the AI agent to discover the canonical Master Brain (`C:\AI-Builder-Brain`), execute the Universal Project Factory engine, resolve the development environment based on project intent, install only required dependencies, verify live execution, and certify the project as `ENVIRONMENT READY`.

---

## 🔒 Canonical Core Invariant

```
PROJECT FACTORY = ENVIRONMENT INITIALIZATION ONLY.
```

- **Project Factory never generates actual products, websites, SaaS dashboards, calculators, font tools, AdSense units, or business logic.**
- `--intent` specifies **PROJECT CLASS / ENVIRONMENT REQUIREMENTS** (not product build instructions).
- **Two Separate Lifecycle Phases**:
  1. **PHASE A — PROJECT FACTORY**: Empty Folder -> Complete Development Environment -> `ENVIRONMENT READY : CERTIFIED` -> **STOP**.
  2. **PHASE B — PRODUCT DEVELOPMENT**: Starts ONLY when the user gives a separate prompt: *"Now build my actual product: ______"*.

---

## The Prompt to Copy & Paste

Copy the entire block below and paste it into the AI Agent chat in your new empty project folder:

```markdown
### SYSTEM DIRECTIVE: Universal Autonomous Project Bootstrap via AI-Builder-Brain

You are an elite autonomous software engineering agent tasked with bootstrapping a brand new development environment in this current directory using our central **AI-Builder-Brain** Universal Project Factory & Operating System.

Follow this strict, non-negotiable execution sequence from start to finish:

---

### CRITICAL BOUNDARY RULE: ENVIRONMENT INITIALIZATION ONLY
Your task in this bootstrap phase is STRICTLY to establish the DEVELOPMENT ENVIRONMENT, BRAIN OS, AND VERIFICATION INFRASTRUCTURE.
- Do NOT build the actual product, website, SaaS, features, or business logic.
- Do NOT create product pages, calculators, font finders, or AdSense components.
- If `--intent` mentions a product (e.g., "font finder"), use it ONLY to determine the project class (e.g. SEO/AdSense micro website) and record it as context for Phase B.
- Your goal is strictly: `ENVIRONMENT READY : CERTIFIED`.

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
*(Optionally append `--type <type>` or `--intent "<description>"` to specify environment archetype like `seo-adsense-micro-website`, `ai-saas`, `fullstack-web-app`, `api-backend-service`, etc.).*

OR execute the canonical steps natively:
1. **Detect Project Intent & Environment Profile**:
   - Analyze requirements: determine whether the project environment is an SEO Micro Website, Single-Page Tool, Full-stack Web App, AI SaaS, API Service, Automation System, or Custom/Adaptive.
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
     * `PROJECT_CONTEXT.md` (Project mission, stack, boundaries, Phase A status)
     * `PROJECT_RULES.md` (Factory Boundary Invariant, non-destructive rules)
     * `PROJECT_KNOWLEDGE.md` (Selectively resolved patterns from Master Brain)
     * `PROJECT_SKILLS.md` (Selectively resolved skills & MCPs)
     * `PROJECT_STATE.json` (Phase A schema, capabilities, milestones)
     * `PROJECT_LEARNING.md` (Forensic incident & learning register)
     * `PROJECT_DECISIONS.md` (Architecture Decision Records ADR-001, ADR-002, ADR-003)
     * `PROJECT_ARCHITECTURE.md` (Directory topology, environment layer)
     * `PROJECT_REQUIREMENTS.md` (Environment criteria satisfied; product criteria pending Phase B)
     * `PROJECT_ENVIRONMENT.md` (Tool versions and environment boundary)
     * `ENVIRONMENT_READY_CERTIFICATE.md` (Certified environment readiness proof)

---

### STEP 3: Install Targeted Dependencies
Run:
```bash
npm install
```
Verify zero fatal installation errors. Only install what the project environment actually needs!

---

### STEP 4: Independent Git Repository Setup (Commit Managed by User)
1. Initialize local git repository:
   ```bash
   git init -b main
   ```
2. Verify `.gitignore` is properly configured.
3. **Auto-commit disabled**: Commits are managed directly by the user when ready. Factory only performs repository setup.


---

### STEP 5: Multi-Layer Live Verification & Boundary Audit
Execute real verification commands:
1. **Build Verification**:
   - Run `npm run build`
   - Verify exit code is 0 and production bundle (`dist/index.html`) exists.
2. **Server Live Probe**:
   - Boot dev/API server on an isolated background port, probe with HTTP GET for status 200, and terminate cleanly.
3. **Product Generation Boundary Audit**:
   - Verify that 0 product components exist in `src/components/`.
   - Verify that 0 product feature pages exist in `src/pages/`.
   - Verify that 0 business logic was implemented.
   - If any product code is detected: FAIL with `FACTORY BOUNDARY VIOLATION`.

---

### STEP 6: Generate Environment Ready Certification & Report
1. Finalize `ENVIRONMENT_READY_CERTIFICATE.md` documenting:
   - Project Name, Profile, Timestamp, Environment versions
   - 10-Pillar verification status table (including Product Boundary: PASS)
   - Final status: `ENVIRONMENT STATUS: ENVIRONMENT READY : CERTIFIED`
2. Update `PROJECT_STATE.json` to `"status": "ENVIRONMENT_READY"`, `"productStatus": "NOT_STARTED"`.
3. Present a clear, concise summary table to the user with verified artifacts.
4. **STOP EXECUTION.** Do NOT proceed to build the product. Wait for the user's Phase B prompt.
```

---

## Canonical User Experience Flow

```
NEW EMPTY FOLDER
      ↓
ANTIGRAVITY OPEN
      ↓
UNIVERSAL BOOTSTRAP PROMPT
      ↓
FACTORY ENGINE EXECUTES
      ↓
COMPLETE DEVELOPMENT ENVIRONMENT READY
      ↓
ENVIRONMENT READY : CERTIFIED
      ↓
STOP.
      ↓
(User enters subsequent prompt: "Now build my actual product: ______")
      ↓
PHASE B: PRODUCT DEVELOPMENT STARTS
```
