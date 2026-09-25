# Universal Project Ready Multi-Pillar Certification Protocol

> **Canonical reference**: `AI-Builder-Brain/08_VERIFICATION/project-ready-certification-protocol.md`  
> **Purpose**: Mandatory verification gatekeeper that evaluates every newly bootstrapped child project across dynamic live pillars before certifying it as READY for product development.

---

## 1. Overview & Operational Mandate

A project is never declared ready based merely on files existing or commands returning without visible crash text. It must be certified through active execution across the **Universal Multi-Pillar Verification Suite**:

```
[ Pillar 1: Brain Bridge Link & Zero-Copy Boundary ]
                       ↓
[ Pillar 2: Environment Toolchain Health ]
                       ↓
[ Pillar 3: Project-Local Brain OS (All 11 Files) ]
                       ↓
[ Pillar 4: Architecture & Configuration Integrity ]
                       ↓
[ Pillar 5: Production Build Compilation (Exit 0) ]
                       ↓
[ Pillar 6: Live Server Socket Probe (HTTP 200 OK) ]
                       ↓
[ Pillar 7: Quality Verification (SEO or AI/API Health) ]
                       ↓
[ Pillar 8: Git & Repository Clean Working Tree ]
                       ↓
[ PROJECT_READY_CERTIFICATE.md: READY : CERTIFIED ]
```

---

## 2. Dynamic Pillars Audit Table

| Pillar | Verification Gate | Pass Criteria |
|---|---|---|
| **1. Brain Bridge** | `.project-brain/brain-bridge.json` | Master Brain reachable, read-only enforced, selective indexing |
| **2. System Environment** | Node.js, npm, Git, tools | Required tools present, zero fatal missing dependencies |
| **3. Project Governance** | All 11 Project Brain OS files | All 11 files present and non-empty, plus .project-brain dirs |
| **4. Architecture & Config** | Framework config + CSS-first styling | Valid config file (Astro/Vite) and Tailwind v4 @theme tokens |
| **5. Build Integrity** | Static production bundle | `npm run build` exits 0, `dist/index.html` generated |
| **6. Runtime Probe** | Dev / API server on isolated port | HTTP 200 OK within 15 seconds, clean shutdown |
| **7. Quality & Contracts** | Profile-specific quality checks | Web/SEO: Meta & canonical tags; AI: Health API endpoint |
| **8. Git Repository** | Local repository & initial commit | Repo initialized, clean tree, initial commit created |
| **9. MCP Health** | Configured MCP servers | Verified connection or safe offline fallback active |

---

## 3. Certification Status Levels

- **PROJECT STATUS: READY : CERTIFIED**  
  All critical gates pass cleanly. Ready for immediate feature development.
- **PROJECT STATUS: PARTIAL**  
  Core build and runtime succeed; non-blocking auxiliary items (e.g. GitHub auth or offline Master Brain fallback) noted.
- **PROJECT STATUS: BLOCKED**  
  Fatal blocker detected (missing tool, failed build, server crash). Feature development must not proceed.
