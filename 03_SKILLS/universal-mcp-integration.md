# Universal Model Context Protocol (MCP) Integration Skill

> **Location**: `AI-Builder-Brain/03_SKILLS/universal-mcp-integration.md`  
> **Purpose**: Governs the selective resolution, configuration, and verification of Model Context Protocol (MCP) servers across child projects.

---

## 1. Architectural Mandate: No Universal Hard-Coded MCPs

MCP servers MUST NOT be injected as universal hard-coded dependencies into every project.
Only install and configure an MCP server when:
1. It directly serves the project profile (e.g., `astro-docs` for Astro SEO, `postgres` for SaaS, `filesystem` for Developer Tools).
2. It passes the credential and security audit.
3. Live health verification succeeds.

---

## 2. Canonical Registry Architecture

All supported MCP servers are registered in Master Brain at:
`C:\AI-Builder-Brain\04_WORKFLOWS\factory-engine\mcp-registry.json`

| MCP Key | Name | Supported Project Profiles |
|---|---|---|
| `astro-docs` | Astro Documentation MCP | `seo-adsense-micro-website`, `single-page-tool-website` |
| `postgres` | PostgreSQL MCP Inspector | `saas`, `micro-saas`, `fullstack-web-app`, `ai-saas` |
| `filesystem` | Scoped Filesystem MCP | `developer-tool`, `automation-system` |
| `fetch` | Web Fetch MCP | `ai-agent`, `automation-system` |
| `github` | GitHub MCP | `developer-tool`, `automation-system`, `saas` |
| `memory` | Graph Knowledge Memory MCP | `ai-agent`, `ai-application`, `ai-saas` |

---

## 3. Post-Installation Health Verification

After configuring an MCP server, run:
```javascript
import { verifyMCPHealth } from './mcp-registry.mjs';
const health = verifyMCPHealth('astro-docs', projectRoot);
console.log('MCP Health:', health.status); // MUST return 'ACTIVE_AND_VERIFIED'
```
If required credentials (e.g. database URL, tokens) are missing, the MCP enters `CREDENTIALS_MISSING` and activates the defined safe local fallback without blocking project bootstrap.
