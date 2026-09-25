# Master Project Bootstrap Prompt (Canonical User Directive)

> **Purpose**: This is the single, canonical bootstrap prompt to copy and paste into any newly created empty folder opened in Antigravity IDE (or any AI coding environment). It instructs the AI agent to discover the canonical Master Brain (`C:\AI-Builder-Brain`), execute the native Project Factory engine, scaffold the complete development environment, verify live execution, and certify the project as `PROJECT READY`.

---

## The Prompt to Copy & Paste

Copy the entire block below and paste it into the AI Agent chat in your new empty project folder:

```markdown
### SYSTEM DIRECTIVE: Autonomous Project Bootstrap via Canonical AI-Builder-Brain

You are an elite autonomous software engineering agent tasked with bootstrapping a brand new, production-ready web application in this current directory using our central **AI-Builder-Brain** Project Factory operating system.

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
OR execute the canonical steps natively:
1. **Environment Health Check**:
   - Verify Node.js (>= 18.0.0), npm (>= 9.0.0), and Git.
   - Run `gh auth status` to check GitHub CLI authorization status.
2. **Establish Brain Bridge**:
   - Create `.project-brain/` directory with `incidents/`, `lessons/`, and `promotion-queue/`.
   - Write `.project-brain/brain-bridge.json` pointing to `C:\AI-Builder-Brain` in read-only mode.
3. **Scaffold Golden Blueprint from Master Brain**:
   - Copy and instantiate all blueprint files from `C:\AI-Builder-Brain\04_WORKFLOWS\blueprints\astro-tailwind-v4/`:
     * `package.json` (Astro 5 + Tailwind CSS v4 + @tailwindcss/vite)
     * `astro.config.mjs` (Vite tailwindcss plugin + `trailingSlash: 'always'`)
     * `tsconfig.json`
     * `vercel.json` (cleanUrls, security headers, immutable cache)
     * `design.md` (OKLCH color system, typography, glassmorphism tokens)
     * `PROJECT_CONTEXT.md` (Project mission, stack, boundaries)
     * `PROJECT_RULES.md` (Non-destructive invariants, live verification rules)
     * `PROJECT_STATE.json` (Track project status and stage)
     * `.gitignore` (node_modules, dist, .env, .project-brain/scratch/)
     * `src/styles/global.css` (@import "tailwindcss"; @theme with OKLCH tokens, dark mode variant)
     * `src/layouts/BaseLayout.astro` (HTML5, responsive viewport, zero-CLS containers)
     * `src/pages/index.astro` (Semantic HTML5 hero & features)
     * `src/components/` (Header, Hero, Footer)
     * `scripts/` (agent-boot.mjs, verify-build.mjs, verify-dev-server.mjs)
   - Replace `{{PROJECT_NAME}}` with current directory name and `{{CREATION_DATE}}` with current ISO timestamp.

---

### STEP 3: Install Dependencies
Run:
```bash
npm install
```
Verify zero fatal installation errors.

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

### STEP 5: Multi-Layer Live Verification (The 7 Pillars)
Execute real verification commands:
1. **Build Verification**:
   - Run `npm run build`
   - Verify exit code is 0 and `dist/index.html` exists.
2. **Dev Server Live Probe**:
   - Boot dev server (`npm run dev`) on a background port, probe with HTTP GET for status 200, and terminate cleanly.
3. **Design System & CSS Token Verification**:
   - Inspect compiled CSS in `dist/_astro/` to verify `@theme` OKLCH tokens are properly compiled.

---

### STEP 6: Generate Ready Certification & Report
1. Write `PROJECT_READY_CERTIFICATE.md` documenting:
   - Project Name, Timestamp, Environment versions
   - 7 Pillars verification status table
   - Final status: `PROJECT STATUS: READY : CERTIFIED`
2. Update `PROJECT_STATE.json` to `"status": "READY"`.
3. Present a clear, concise summary table to the user with verified artifacts.
```

---

## Autonomous Execution Rules for Agents

- **No Placeholders**: Never leave `TODO` items or empty skeleton files.
- **Evidence Over Confidence**: Never declare success without running actual build and server verification.
- **Zero Master Brain Mutation**: Never modify files in `C:\AI-Builder-Brain` during child project bootstrap.
