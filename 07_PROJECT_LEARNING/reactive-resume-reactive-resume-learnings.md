> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/reactive-resume-reactive-resume-learnings.md`  
> **Source**: GitHub ([https://github.com/reactive-resume/reactive-resume](https://github.com/reactive-resume/reactive-resume))  
> **Synthesized By**: Universal Multi-Provider Autonomous AI Agent  
> **Timestamp**: 2026-09-30T06:56:18.740Z  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): reactive-resume/reactive-resume

## 1. Executive Forensic Architecture & System Mechanics
Reactive Resume is a high-performance, open-source resume builder utilizing a **monorepo architecture** (Turborepo) to manage complex dependencies between a React-based web frontend, a Hono-based Node.js server, and shared domain packages (Schema, PDF rendering, Database, Import/Export). 

The system architecture is defined by:
- **Schema-First Domain**: Centralized Zod-based schema definitions (`packages/schema`) that act as the single source of truth for both frontend forms and backend PDF generation.
- **PDF Rendering Engine**: A custom extraction and rendering pipeline that converts JSON resume data into PDF, utilizing baseline clustering and column-aware segmentation to handle complex layout templates.
- **Agent-Ready API**: A dual-interface API (REST/RPC and MCP) that allows LLMs to interact with user resumes via JSON Patch, enabling autonomous editing and data extraction.
- **Database Integrity**: A strict migration-ledger-to-catalog verification system that prevents runtime failures by checking for schema drift at startup.

---

## 2. Forensic Real Incidents & Production Patches

### Incident 1: Schema Drift at Startup (BUG-DB-01)
- **Context**: `apps/server/src/startup/schema-check.ts`
- **What Was Expected**: The database schema should match the migration ledger.
- **What Actually Happened**: Silent drift (e.g., manual `DROP TABLE`) caused runtime `42P01` (relation does not exist) errors.
- **Evidence**: Commit `ac69dd3f`.
- **Root Cause**: Drizzle-kit only tracks migration history, not the actual state of the live catalog.
- **Remediation**:
```typescript
// - Silent failure on missing tables
// + verifyMigratedSchema(pool) checks live catalog against declared schema
```
- **Lesson**: Always verify the physical database state against the logical schema definition at application startup.

### Incident 2: Column-Aware PDF Extraction (BUG-PDF-02)
- **Context**: `packages/resume/src/ats-pdf/extract.ts`
- **What Was Expected**: Headings should be detected regardless of layout.
- **What Actually Happened**: Baseline clustering merged headings in narrow side-columns with content, causing ATS checks to fail.
- **Evidence**: Commit `28d0170b`.
- **Root Cause**: The extraction engine assumed a single-column flow for baseline clustering.
- **Remediation**:
```typescript
// - Single-line baseline clustering
// + columnSegments(line) splits lines based on horizontal gap thresholds
```
- **Lesson**: When parsing visual documents, spatial layout (columns) must be treated as a first-class constraint alongside temporal/baseline order.

---

## 3. The 9 Deep Learning Dimensions
1. **Architecture**: Monorepo with strict package boundaries; `apps/server` acts as the orchestrator for `packages/`.
2. **Core Abstractions**: `ResumeData` as a domain primitive; `JSON Patch` for atomic updates.
3. **Error Handling**: Custom `APIError` classes; startup-time schema verification as a "fail-fast" barrier.
4. **Testing**: Integration tests for ATS extraction; property-based testing for date parsing.
5. **Security**: CSP headers (`frame-ancestors 'none'`), OAuth PKCE enforcement, and strict redirect URI validation.
6. **Performance**: Zero-copy PDF generation; `es-toolkit` for robust timeout management in health checks.
7. **Deployment**: Multi-stage Docker builds; `dotenvx` for environment injection; strict `turbo` filtering.
8. **Agent Patterns**: MCP server implementation with `buildMcpServerInfo` and tool-specific loop guards.
9. **Data Flow**: `prepareStagedBody` for atomic storage operations; `zod` for runtime validation at protocol boundaries.

---

## 4. The 8 Learning Extraction Artifacts
1. **Pattern**: `verifyMigratedSchema` (Catalog-to-Schema comparison).
2. **Rule**: NEVER trust the migration ledger as the sole source of truth for database readiness.
3. **Architecture Principle**: "Spatial-Aware Parsing" — document extraction must account for visual layout (columns) before semantic analysis.
4. **Failure Mode**: "Schrödingbug" — environment-specific race conditions in PDF rendering/extraction.
5. **Reusable Skill**: Use `to_regclass` in PostgreSQL to verify table existence without triggering errors.
6. **Decision**: Rejected `mc` (MinIO client) for `aws-cli` due to image pullability/availability issues in CI.
7. **Anti-pattern**: `dotenvx run` prefixing every command; prefer project-level script wrappers.
8. **Verification Method**: `vitest` integration tests that mock the database catalog to simulate schema drift.

---

## 5. Net-New Universal Engineering Rules

## 1. The Schema-Catalog Invariant
**RULE**: Application startup MUST verify the live database catalog against the declared schema if the environment is production-grade.
**WHY**: Migrations only record intent; they do not guarantee the current state of the database (e.g., manual drops, partial restores).
**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Query pg_catalog to ensure expected tables/columns exist
const result = await db.query(`SELECT ... FROM pg_attribute WHERE ...`);
if (result.rows.length > 0) throw new Error("Schema drift detected");
```
**NEGATIVE CONSTRAINT**:
```typescript
// NEVER assume that if the migration table says 'done', the table exists.
```

---

## 6. Actionable Agent Skill & Implementation Checklist
- [ ] **Dependency Audit**: Verify `package.json` for `pnpm` workspace constraints.
- [ ] **Environment Injection**: Ensure `dotenvx` is used for local dev, but not for production runtime (use native env vars).
- [ ] **Schema Verification**: Implement a startup check that compares `drizzle` schema config with `pg_catalog`.
- [ ] **Spatial Parsing**: If parsing PDFs/Images, implement a `columnSegments` function to handle multi-column layouts.
- [ ] **CI/CD**: Use `runs-on: ${{ vars.CI_RUNNER_X64 || 'ubuntu-latest' }}` for portable runner fallbacks.