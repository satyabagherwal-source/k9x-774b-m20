# Full-stack AI SaaS Architecture & Implementation Skill

> **Location**: `AI-Builder-Brain/03_SKILLS/fullstack-ai-saas-architecture.md`  
> **Purpose**: Guides agents in constructing enterprise-ready full-stack AI SaaS applications with streaming, robust error boundaries, and live verification.

---

## 1. Architectural Topology

```
[ Client: React 19 + Vite ] ──► [ Tailwind v4 CSS-First UI ]
              │
              ▼ (JSON / SSE Stream)
[ API Service: Node.js / Express ] ──► [ Model Provider / AI Engine ]
              │
              ▼
[ Local Memory / Database ]
```

---

## 2. Mandatory Health & Telemetry Endpoint

Every AI SaaS backend service MUST provide `/api/health` returning:
```json
{
  "status": "ok",
  "service": "project-name-ai-service",
  "timestamp": "ISO-8601",
  "version": "1.0.0",
  "mcpConnected": true,
  "activeModel": "gpt-4o / claude-3-5"
}
```

---

## 3. Core Invariants for AI SaaS Applications

1. **Defensive Error Boundaries (Rule 5)**:
   External AI API responses must be deserialized defensively. Timeouts, rate-limits, or malformed chunks must never crash the React render tree.

2. **Fresh-State Persistence (Rule 1)**:
   Async token counters, user prompt logs, and billing usage MUST query fresh state before persisting mutation patches.

3. **Collision-Resistant Identity (Rule 8)**:
   Generation IDs and conversation session IDs must use `crypto.randomUUID()`.
