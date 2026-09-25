# Project Ready 7-Pillar Certification Protocol

> Canonical reference: `AI-Builder-Brain/08_VERIFICATION/project-ready-certification-protocol.md`  
> Purpose: Mandatory verification gatekeeper that evaluates every newly bootstrapped child project across 7 live pillars before certifying it as READY for product development.

---

## 1. Overview & Operational Mandate

A project is never declared ready based merely on files existing or commands returning without visible crash text. It must be certified through active execution across the **7 Mandatory Pillars**.

```
[ Pillar 1: Brain Bridge ]
        ↓
[ Pillar 2: Environment Health ]
        ↓
[ Pillar 3: Project Context & Rules ]
        ↓
[ Pillar 4: Architecture & Tailwind v4 ]
        ↓
[ Pillar 5: Static Build Compilation ]
        ↓
[ Pillar 6: Dev Server Socket Probe (HTTP 200) ]
        ↓
[ Pillar 7: Design System & CSS Token Verification ]
        ↓
[ PROJECT_READY_CERTIFICATE.md: READY ]
```

---

## 2. The 7 Certification Pillars

| Pillar | Requirement | Verification Method | Pass Criteria |
|---|---|---|---|
| **1. Brain Bridge** | Master Brain reachable, read-only boundary enforced, valid metadata | Read & parse `.project-brain/brain-bridge.json` | Master Brain path exists; read-only flag true |
| **2. Environment** | Node.js (>= 18), npm (>= 9), Git initialized | Run version commands and inspect output | Correct versions detected, zero fatal missing tools |
| **3. Project Governance** | `PROJECT_CONTEXT.md`, `PROJECT_RULES.md`, `PROJECT_STATE.json`, `design.md` present | File existence & schema validation | All 4 core governance files exist and non-empty |
| **4. Architecture & Config** | Astro 5 + Tailwind v4 CSS-first `@theme` | Inspect `astro.config.mjs` and `src/styles/global.css` | Vite plugin configured; `@theme` and `@import "tailwindcss"` present |
| **5. Build Integrity** | Static production bundle compiles cleanly | Execute `npm run build` | Exit code 0, `dist/index.html` generated |
| **6. Dev Server & Runtime** | Dev server boots and responds on local socket | Spawn `npm run dev` on isolated port, HTTP GET `/` | HTTP 200 OK within 15 seconds; clean shutdown |
| **7. Design System** | OKLCH tokens, responsive layout, dark mode | Inspect compiled CSS in `dist/_astro/*.css` | Custom OKLCH color properties compiled |

---

## 3. Certification Status Levels

- **PROJECT STATUS: READY**
  All 7 pillars pass cleanly. Ready for immediate feature development.
- **PROJECT STATUS: PARTIAL**
  Core project files, build, and runtime succeed, but non-blocking auxiliary items (e.g. GitHub CLI auth pending or Master Brain offline fallback) are noted.
- **PROJECT STATUS: BLOCKED**
  Any fatal failure (Node/npm missing, build failure, server crash, broken styles). Feature development MUST NOT proceed until unblocked.

---

## 4. Output Artifact: `PROJECT_READY_CERTIFICATE.md`

Every run of the certification suite writes `PROJECT_READY_CERTIFICATE.md` in the project root containing:
- Project Name and Timestamp (ISO 8601)
- Pillar-by-pillar status table
- Runtime environment details (Node version, OS, Git commit hash)
- Final Certified Status
