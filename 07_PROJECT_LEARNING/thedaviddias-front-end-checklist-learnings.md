> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/thedaviddias-front-end-checklist-learnings.md`  
> **Source**: GitHub ([https://github.com/thedaviddias/Front-End-Checklist](https://github.com/thedaviddias/Front-End-Checklist))  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-09-30T13:55:27.596Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): thedaviddias/Front-End-Checklist

## 1. Executive Forensic Architecture & System Mechanics
The `Front-End-Checklist` is a high-availability, content-driven platform that bridges the gap between static documentation and autonomous agent workflows. It functions as a **headless content engine** (using Content Collections/MDX) coupled with a **distributed MCP (Model Context Protocol) server**. 

**Architectural Boundaries:**
- **Content Layer**: MDX-based rule definitions with strict structural validation.
- **Service Layer**: Next.js App Router with `use cache` directives for performance.
- **Agent Layer**: An MCP server that exposes the rule corpus as tools for LLMs, featuring telemetry-gated usage tracking and rate-limiting.
- **CI/CD Layer**: A dual-provider (GitHub/Gitea) routing system that enforces strict build-time validation of content structure and type safety.

---

## 2. Forensic Real Incidents & Production Patches

### Incident 1: MCP Telemetry Cost Explosion (BUG-MCP-01)
- **Context**: `apps/web/app/api/mcp/route.ts`
- **What Was Expected**: Telemetry should be opt-in to prevent database write-amplification on high-traffic public endpoints.
- **What Actually Happened**: Telemetry was enabled by default, causing excessive DB writes for every tool call from automated agents.
- **Evidence**: Commit `67bacf9b`, `docs/mcp-quality.md`
- **Root Cause**: Default-enabled boolean flag in the MCP handler configuration.
- **Remediation Code Diff**:
```typescript
// - telemetryEnabled: !MCP_TELEMETRY_DISABLED
// + telemetryEnabled: MCP_TELEMETRY_ENABLED
```
- **Lesson**: Default to "Disabled" for all side-effect-heavy telemetry in public-facing API endpoints.

### Incident 2: Unstable Build-Time Auth Secrets (BUG-AUTH-02)
- **Context**: `packages/auth/src/auth.ts`
- **What Was Expected**: Build-time type checking without requiring production secrets.
- **What Actually Happened**: Missing secrets caused build failures during CI/CD pipeline execution.
- **Evidence**: Commit `31ed5426`
- **Root Cause**: Hard dependency on environment variables during the `phase-production-build` lifecycle.
- **Remediation Code Diff**:
```typescript
// - clientId: process.env.GITHUB_CLIENT_ID ?? ''
// + clientId: githubClientId // (where githubClientId defaults to 'build-only' during build phase)
```
- **Lesson**: Decouple build-time configuration from runtime secret injection using phase-aware defaults.

---

## 3. The 9 Deep Learning Dimensions
1. **Architecture**: Monorepo (Turborepo) with strict workspace isolation.
2. **Core Abstractions**: `checklistFrameworkSchema` as a domain primitive for all rule-related operations.
3. **Error Handling**: Graceful degradation using fallback data (e.g., `sponsors-fallback.json`) when external APIs fail.
4. **Testing**: Playwright-based E2E smoke tests with `webServer` orchestration.
5. **Security**: `throwIfBot()` middleware to prevent scraping/abuse of the MCP endpoint.
6. **Performance**: `use cache` directives and `cacheLife` for aggressive revalidation control.
7. **Deployment**: Vercel-based CI/CD with custom `vercel.json` git-branch gating.
8. **Agent Patterns**: MCP tool definitions that map directly to the rule corpus, allowing LLMs to perform "structured audits."
9. **Data Flow**: Immutable MDX content flow; mutations are strictly handled via Server Actions with Zod validation.

---

## 4. The 8 Learning Extraction Artifacts
1. **Pattern**: **Fallback-Resilient Data Fetching**: Always provide a local JSON fallback for external API dependencies.
2. **Rule**: **MUST** validate content structure (rules/guides) before the build phase.
3. **Architecture Principle**: **Agent-First API Design**: Expose internal logic as MCP tools to enable autonomous consumption.
4. **Failure Mode**: **Build-Time Secret Dependency**: Hard-coding secrets in build scripts breaks CI/CD portability.
5. **Reusable Skill**: Use `pnpm --filter` to isolate CI tasks for specific workspaces.
6. **Decision**: Use `next/cache` over standard SWR/React Query for server-side performance.
7. **Anti-pattern**: `cancel-in-progress: true` in CI for production-routed builds (prevents race conditions but kills deployment stability).
8. **Verification Method**: `pnpm validate:rule-structure` (Custom TSX script).

---

## 5. Net-New Universal Engineering Rules

## 1. The "Build-Phase-Aware" Configuration Rule
**RULE**: Configuration objects MUST use `process.env.NEXT_PHASE` to inject dummy values during build-time, preventing runtime-secret dependency.
**WHY**: Prevents CI/CD pipeline failures when secrets are not available during static analysis or build steps.
**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
const secret = process.env.SECRET ?? (isBuild ? 'dummy-build-secret' : undefined);
```

---

## 6. Actionable Agent Skill & Implementation Checklist
1. **Audit Workspace**: Run `pnpm list -r` to identify all packages.
2. **Verify CI**: Check `.github/workflows` for pinned actions (SHA-based).
3. **Validate Content**: Execute `pnpm validate:rule-structure` to ensure MDX integrity.
4. **Check Telemetry**: Ensure all API routes have `telemetryEnabled` flags defaulted to `false`.
5. **Test E2E**: Run `pnpm test:e2e` to verify critical user paths (Home -> Counter).
6. **Secure MCP**: Ensure the MCP endpoint has a `RateLimit` implementation (sliding window).