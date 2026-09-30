# ⚡ Task Complexity Router (Fast Path vs Deep Path)

> **Purpose**: Eliminates wasted tokens, cognitive overload, and over-engineering.  
> Ensures simple tasks are solved in 3 fast steps (< 300 tokens), while complex systems receive proper architectural rigor.

---

## The 3 Execution Tiers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 1: FAST PATH (Simple / Micro Tasks)                                    │
│ Time: < 3 mins | Token Budget: < 400 tokens | Friction: Zero                │
├─────────────────────────────────────────────────────────────────────────────┤
│ Examples:                                                                   │
│ • "Change button color to vibrant indigo"                                   │
│ • "Fix typo in navigation header"                                           │
│ • "Add a responsive hero section / single landing page"                     │
│ • "Create a 30-line node/python utility script"                             │
│ • "Add an environment variable or config key"                               │
│                                                                             │
│ 3-Step Execution:                                                           │
│ 1. Locate: Pinpoint the exact file and line using grep_search.              │
│ 2. Surgical Edit: Apply minimal targeted patch (replace_file_content).      │
│ 3. Instant Check: Verify syntax or run fast build probe. Done!              │
│                                                                             │
│ ⚠️ Invariant: DO NOT run multi-agent fleet, DO NOT write long plans,       │
│               DO NOT load heavy architecture documents.                     │
└─────────────────────────────────────────────────────────────────────────────┘

                                      ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 2: STANDARD PATH (Feature Addition & Component Wiring)                 │
│ Time: 5–20 mins | Token Budget: ~1,500 tokens | Structure: Focused          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Examples:                                                                   │
│ • "Build a contact form with input validation and toast notification"       │
│ • "Create an authenticated API endpoint with rate limiting"                 │
│ • "Add a dark mode toggle with localStorage persistence"                    │
│ • "Wire SQLite / Postgres database queries to a table component"            │
│                                                                             │
│ 4-Step Execution:                                                           │
│ 1. Consult Skill: Check exact pattern in 03_SKILLS/ (Tailwind / SaaS).      │
│ 2. Contract First: Define types / props / schemas clearly.                  │
│ 3. Surgical Assembly: Build component and wire into existing routing.       │
│ 4. Live Verification: Run build (npm run build) & check for regressions.   │
└─────────────────────────────────────────────────────────────────────────────┘

                                      ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│ TIER 3: ENGINEERED PATH (Fullstack Apps & Deep Systems Architecture)         │
│ Time: Multi-Step | Token Budget: Controlled & Phased | Rigor: Maximum       │
├─────────────────────────────────────────────────────────────────────────────┤
│ Examples:                                                                   │
│ • "Build an end-to-end AI SaaS web application from scratch"                │
│ • "Implement a multi-agent orchestration runtime with memory"               │
│ • "Refactor core database layer from REST to WebSockets / gRPC"             │
│ • "Bootstrap an enterprise production project"                              │
│                                                                             │
│ Phased Execution:                                                           │
│ 1. Scaffolding: Use native factory engine (04_WORKFLOWS/factory-engine/).   │
│ 2. Blueprint: Copy production template (04_WORKFLOWS/blueprints/).         │
│ 3. Engineering Rules: Apply Rules 1-14 from 05_KNOWLEDGE/engineering-patterns.md.│
│ 4. Staged Rollout: Build module by module, certifying each stage.          │
│ 5. Certification: Run 08_VERIFICATION/project-ready-certification-protocol.md.│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary Cheat-Sheet for AI Agents

| User Prompt Example | Selected Path | Files to Open |
| :--- | :--- | :--- |
| *"Button ka color blue kar do"* | ⚡ Fast Path | Only target component file. |
| *"Yeh typo fix karo"* | ⚡ Fast Path | Only target file. |
| *"Ek clean modern landing page bana do"* | ⚡ Fast Path | `03_SKILLS/tailwind-v4-css-first-design.md` -> write `index.html` with vanilla CSS/Tailwind. |
| *"Contact form banao with validation"* | 🛠️ Standard Path | Form component + schema validator. |
| *"Ek naya web app ya full software banao"* | 🏗️ Engineered Path | `04_WORKFLOWS/blueprints/` + `04_WORKFLOWS/factory-engine/bootstrap.mjs`. |
| *"Bug aa raha hai ise fix karo"* | 🛡️ Shield Path | `00_START_HERE/SURGICAL_FIX_REGRESSION_SHIELD.md`. |
