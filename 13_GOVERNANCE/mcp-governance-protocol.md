# Model Context Protocol (MCP) Governance Protocol

> **Canonical Reference**: `AI-Builder-Brain/13_GOVERNANCE/mcp-governance-protocol.md`  
> **Mandate**: Establishes security, privacy, and architecture rules for integrating MCP servers into child projects.

---

## 1. Governance Rules

1. **Selective Integration Only**:
   MCP servers must never be injected globally. They must be resolved dynamically based on the project profile.

2. **Zero Master Brain Mutation**:
   MCP servers configured in child projects MUST NOT be granted write access to Master Brain (`C:\AI-Builder-Brain`).

3. **Credential Isolation**:
   Database connection strings, personal access tokens, and API keys MUST NOT be hard-coded into `brain-bridge.json` or committed to version control.

4. **Graceful Offline Fallback**:
   If an MCP server is unreachable or credentials are absent, the application and agent MUST continue using standard local file or CLI mechanisms.
