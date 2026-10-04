# 🧭 AI Instant Navigator & Precision Task Router

> **Mandate for All Connecting AI Agents (Antigravity, Claude Code, Cursor, Copilot, ChatGPT)**:  
> When connecting to `AI-Builder-Brain` to write code, build a website, app, software, or fix an issue:  
> **READ ONLY THIS FILE FIRST**. Do NOT wander through folders. Do NOT read `07_PROJECT_LEARNING/` (those are forensic post-mortems).  
> Match the user's intent below to jump directly to the exact single file needed in **1 step (< 300 tokens)**.

---

## 1. Instant Intent-to-Resource Matrix (1-Click Routing)

| What the User Wants to Build / Do | 🚀 The Exact File to Open | Key Rule / Pattern to Follow |
| :--- | :--- | :--- |
| **Simple Landing Page / Static Website / HTML & CSS** | [`03_SKILLS/tailwind-v4-css-first-design.md`](file:///c:/AI-Builder-Brain/03_SKILLS/tailwind-v4-css-first-design.md) | Rich aesthetics, glassmorphism, responsive, mobile-first, no placeholders. |
| **Modern Web App (Astro, Next.js, React, Tailwind v4)** | [`04_WORKFLOWS/blueprints/astro-tailwind-v4/`](file:///c:/AI-Builder-Brain/04_WORKFLOWS/blueprints/astro-tailwind-v4/) | Zero-hydration static defaults, component tokens, clean directory layout. |
| **Fullstack SaaS / App / Auth / Database** | [`03_SKILLS/fullstack-ai-saas-architecture.md`](file:///c:/AI-Builder-Brain/03_SKILLS/fullstack-ai-saas-architecture.md) | Tiered storage (SQLite/Postgres), schema contracts, secure environment config. |
| **High-Performance Systems / Backend / CLI (Rust/Go/C++)** | [`03_SKILLS/high-performance-systems-and-compiler-invariants.md`](file:///c:/AI-Builder-Brain/03_SKILLS/high-performance-systems-and-compiler-invariants.md) | Zero-copy buffers, bounded channels, graceful termination, signal handling. |
| **Fix a Bug / Modify Code (Without Breaking Other Features)** | [`00_START_HERE/SURGICAL_FIX_REGRESSION_SHIELD.md`](file:///c:/AI-Builder-Brain/00_START_HERE/SURGICAL_FIX_REGRESSION_SHIELD.md) | **Zero Blast Radius**: Never rewrite unchanged code. Verify existing features remain intact. |
| **AI Agents / Workflows / Tool Calling / MCP Servers** | [`03_SKILLS/universal-mcp-integration.md`](file:///c:/AI-Builder-Brain/03_SKILLS/universal-mcp-integration.md) | Stateless tools, deterministic schemas, schema validation, isolated rate limiting. |
| **SEO, Multilingual, AdSense, Deployment** | [`03_SKILLS/astro-adsense-mastery.md`](file:///c:/AI-Builder-Brain/03_SKILLS/astro-adsense-mastery.md) & [`vercel-deployment-playbook.md`](file:///c:/AI-Builder-Brain/03_SKILLS/vercel-deployment-playbook.md) | Canonical tags, hreflang, zero cumulative layout shift (CLS), build probes. |

---

## 2. ⚡ Task Complexity Fast-Track (Token Saver)

Choose your path based on what the user asked:

```
                  ┌────────────────────────────────────────┐
                  │          USER TASK RECEIVED            │
                  └──────────────────┬─────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
  [ MICRO / SIMPLE ]          [ STANDARD FEATURE ]       [ COMPLEX ARCHITECTURE ]
  - Change color / text       - Add form with validation  - Full app scaffolding
  - Fix button / typo         - Create new page/component - Multi-agent swarm
  - Small script / single API - Connect DB / API endpoint - Major system refactor
         │                           │                           │
         ▼                           ▼                           ▼
   ⚡ FAST PATH                🛠️ STANDARD PATH            🏗️ ENGINEERED PATH
   • 3 Steps Only              • 4 Steps                   • Full Architectural Blueprint
   • < 300 Tokens              • ~1,000 Tokens             • Stage-by-Stage Verification
   (Pinpoint -> Patch -> Check) (Skill -> Wire -> Verify)   (Design -> Build -> Certify)
```

👉 See full guidelines in: [`00_START_HERE/TASK_COMPLEXITY_ROUTER.md`](file:///c:/AI-Builder-Brain/00_START_HERE/TASK_COMPLEXITY_ROUTER.md).

---

## 3. 🚫 The 7 Golden Execution Invariants

1. **NEVER Read `07_PROJECT_LEARNING/` During Coding Tasks**:
   - `07_PROJECT_LEARNING/` contains 130+ exhaustive forensic extraction files (over 2 MB of text).
   - Reading them during web/app building burns 30,000–80,000 tokens for zero benefit.
   - All proven, reusable patterns from those repos have already been distilled into `05_KNOWLEDGE/engineering-patterns.md` and `03_SKILLS/`.
2. **NEVER View Entire Files with > 200 Lines**:
   - Always use `grep_search` to find the exact function, class, or rule keyword.
   - Use `view_file` with `StartLine` and `EndLine` for slices of 30–60 lines.
3. **NEVER Guess Architecture When a Blueprint Exists**:
   - If building an Astro site, copy from [`04_WORKFLOWS/blueprints/astro-tailwind-v4/`](file:///c:/AI-Builder-Brain/04_WORKFLOWS/blueprints/astro-tailwind-v4/).
   - If scaffolding a new project, run the native factory engine: [`04_WORKFLOWS/factory-engine/bootstrap.mjs`](file:///c:/AI-Builder-Brain/04_WORKFLOWS/factory-engine/bootstrap.mjs).
4. **ALWAYS Protect Working Code (Anti-Regression Guarantee)**:
   - When fixing Bug X, you must NOT break Feature Y.
   - Use surgical diffs (`replace_file_content`). Never overwrite entire files unless creating from scratch.
5. **ALWAYS Deep-Dive with Multi-Select Modal (`ask_question`) Before Building**:
   - When a user asks to build, redesign, or enhance any website or application, NEVER assume or guess blindly.
   - Invoke the interactive multi-selector modal (`ask_question` tool with multi-select checkboxes) to nail down core branding, feature priorities, design tokens, and scope before writing code.
6. **NEVER Auto-Commit on Child Project Repositories (Strictly Manual Commits)**:
   - Changes in child projects must remain uncommitted in the local working tree so the user can inspect diffs and discard mistakes easily.
   - Auto-commit & auto-push is permitted EXCLUSIVELY inside `C:\AI-Builder-Brain`.
7. **ALWAYS Build Multi-Page Websites (MPA) by Default**:
   - Unless the user explicitly instructs to make a single-page site, all websites MUST be built as multi-page applications with dedicated static routes for tools, individual specs, categories, handbooks, and licenses. Never cram an entire platform into a single page.
