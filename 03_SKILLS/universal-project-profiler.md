# Universal Project Profiler & Architecture Selection Skill

> **Location**: `AI-Builder-Brain/03_SKILLS/universal-project-profiler.md`  
> **Purpose**: Guides AI agents in analyzing user project intent, detecting project class, and determining optimal architecture without assuming a premature tech stack.

---

## 1. Core Principle: Requirements-First Architecture

Never force a single framework onto every project.
- For high-ranking content/tools/monetization: **Astro 5 + Tailwind CSS v4**.
- For full-stack platforms with dashboards & AI streaming: **React 19 + Node.js/Express API + Vite**.
- For background automation & CLI tooling: **Node.js/TypeScript CLI Engine**.
- For unknown/custom projects: **Determine requirements and architecture first; do not assume a stack**.

---

## 2. Supported Project Classes & Archetypes

| Project Class ID | Archetype Name | Tech Archetype | When to Select |
|---|---|---|---|
| `seo-adsense-micro-website` | SEO & AdSense Micro Site | Astro 5 + Tailwind v4 + Vercel | High-ranking niche content, programmatic SEO, AdSense monetization |
| `single-page-tool-website` | Single-Page Tool Website | Astro/Vite + Canvas + High Precision | Interactive calculator, measurement tool, geometry utility |
| `micro-tool-website` | Micro Tool Hub | Astro 5 Multi-route + Islands | Multi-tool utilities suite sharing design tokens |
| `ai-saas` | Full-stack AI SaaS | React 19 + Express API + Tailwind v4 | Subscription software with AI streaming, auth, and database |
| `fullstack-web-app` | Full-stack Web App | React 19 + Node API | Multi-tier web platform with reactive UI and REST backend |
| `ai-agent` | Autonomous AI Agent | Agent Engine + Tool Calling + MCP | Agentic loops, planning, tool execution, memory graphs |
| `api-backend-service` | API & Microservice | Headless Node/Express API | Headless REST/GraphQL backend with OpenAPI specs |
| `heavy-web-app` | Heavy Web Application | Multi-tier React + Modular Services | Complex enterprise dashboards, real-time telemetry |
| `developer-tool` | Developer Tool / CLI | Node.js / TypeScript CLI | Code generators, build plugins, command-line utilities |
| `custom-unknown` | Custom / Adaptive | Adaptive Requirements-First | Ambiguous or custom domain; determine requirements first |

---

## 3. Capability Resolution Rules

1. **Rule of Minimum Required Footprint**:
   Only install packages and configure tooling that the project actually needs. Never install database drivers for static sites, and never bundle full UI frameworks for headless APIs.

2. **Zero-Copy Governance**:
   Every project receives its own 11-file Project Brain OS and connects to Master Brain via `.project-brain/brain-bridge.json` in read-only mode.
