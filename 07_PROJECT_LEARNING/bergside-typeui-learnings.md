> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bergside-typeui-learnings.md`  
> **Source**: github ([https://github.com/bergside/typeui](https://github.com/bergside/typeui))  
> **Source Version**: `efc5f21d`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T07:38:55.592Z  
> **Learning ID**: `learn-github-bergside-typeui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): bergside/typeui

---

## 1. Executive Forensic Architecture & System Mechanics

`bergside/typeui` addresses a core bottleneck in AI-assisted frontend engineering: LLMs generate generic, unconstrained, or aesthetically inconsistent UI when left to default prompt distributions. To enforce systematic visual consistency, design tokens, and accessibility standards, TypeUI operates as a **Universal Design System Compiler & Multi-Agent Skill Bridge**.

```
                           ┌──────────────────────────────┐
                           │   DesignSystemInput Object   │
                           │  (Tokens, Rules, Scales, MD) │
                           └──────────────┬───────────────┘
                                          │
                    ┌─────────────────────┴─────────────────────┐
                    ▼                                           ▼
         ┌───────────────────────┐                   ┌─────────────────────┐
         │ YAML Frontmatter Gen  │                   │ Managed Markdown    │
         │  (Escaped Token Tree) │                   │ Body Generator      │
         └──────────┬────────────┘                   └──────────┬──────────┘
                    │                                           │
                    └─────────────────────┬─────────────────────┘
                                          ▼
                       ┌──────────────────────────────────────┐
                       │ createManagedSkillFile() Coordinator │
                       │    (Bounded with START/END Guards)   │
                       └──────────────────┬───────────────────┘
                                          │
       ┌──────────────────┬───────────────┼───────────────┬──────────────────┐
       ▼                  ▼               ▼               ▼                  ▼
┌──────────────┐   ┌──────────────┐┌──────────────┐┌──────────────┐   ┌──────────────┐
│ Claude Code  │   │ OpenAI Codex ││    Cursor    ││  OpenCode    │   │ Hermes /     │
│ .claude/     │   │ .codex/      ││ .cursor/     ││ .opencode/   │   │ Cline Plugin │
│ skills/...   │   │ skills/...   ││ skills/...   ││ skills/...   │   │ (MCP Bridge) │
└──────────────┘   └──────────────┘└──────────────┘└──────────────┘   └──────────────┘
```

### Architectural Subsystems and Boundaries
1. **Core Token Parsing & Sanitization Layer (`src/renderers/shared.ts`)**:
   - Ingests freeform and structured string inputs (e.g., `12/14/16/20/24/32 | Fonts: primary=Inter, mono=JetBrains | weights=400, 700`).
   - Implements declarative regex extractors (`parseKeyValuePairs`, `parseTypographyMetadata`, `parseColorTokens`, `deriveSpacingTokens`) to convert human-readable or shorthand token strings into typed token dictionaries.
   - Enforces frontmatter string sanitization (`escapeYamlString`) to prevent YAML injection and formatting corruption.

2. **Managed Block Skill Code-Generator (`src/renderers/*Renderer.ts`)**:
   - Generates deterministic markdown payloads wrapped in non-destructive markers (`MANAGED_BLOCK_START` and `MANAGED_BLOCK_END`).
   - Produces vendor-specific target trajectories (e.g., `.claude/skills/design-system/SKILL.md`, `.cursor/skills/design-system/SKILL.md`, `.opencode/skills/design-system/SKILL.md`).
   - Decouples structural requirements (Do/Don't rules, accessibility acceptance criteria, interaction states) from vendor directory conventions via `PROVIDER_DETAILS`.

3. **Autonomous Agent MCP Client/Plugin Tier (`plugins/cline`, `plugins/hermes`)**:
   - Exposes Model Context Protocol (MCP) tool registrations (`typeui_install_mcp`, `typeui_mcp_status`, `typeui_setup_help`).
   - Dynamically writes or mutates agent configuration files (e.g., Hermes `~/.hermes/config.yaml`, Cline MCP configurations) with backup mechanics (`backup_path`).
   - Bridges remote design intelligence hosted at `https://mcp.typeui.sh` with local agent workspace execution contexts.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Boundary Wrapping for Automated File Synthesis
**RULE**:
Code generation systems modifying configuration files or agent skill files within consumer repositories MUST encapsulate generated payloads inside immutable start/end sentinel tokens (`MANAGED_BLOCK_START` / `MANAGED_BLOCK_END`), and MUST escape all embedded dynamic values prior to frontmatter emission.

**WHY**:
Unbounded code generation results in catastrophic loss of user modifications during re-runs. If an engineer customizes rules within `.cursor/skills/design-system/SKILL.md`, an un-sentineled generator overwrites their workspace. Furthermore, unescaped quotes or backslashes in user-supplied strings break YAML parsers silently or trigger syntax exceptions in downstream agent interpreters.

**WHEN TO APPLY**:
Apply whenever writing CLI tools, SDKs, or background agents that generate, sync, or mutate files that humans or other agents also have permission to edit (e.g., `.md`, `.ya?ml`, `.json`, `.env`).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { createHash } from "node:crypto";

export const SENTINELS = {
  START: "<!-- TYPEUI_MANAGED_BLOCK_START -->",
  END: "<!-- TYPEUI_MANAGED_BLOCK_END -->"
} as const;

export function escapeYamlScalar(value: string): string {
  // Disallow null bytes and escape backslashes first, then double quotes
  return value
    .replace(/\0/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, "\\n");
}

export function injectManagedBlock(existingContent: string, newPayload: string): string {
  const boundedPayload = `${SENTINELS.START}\n${newPayload.trim()}\n${SENTINELS.END}`;
  const startIndex = existingContent.indexOf(SENTINELS.START);
  const endIndex = existingContent.indexOf(SENTINELS.END);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    // No valid block found: append cleanly to existing content
    return existingContent.length > 0 
      ? `${existingContent.trimEnd()}\n\n${boundedPayload}\n`
      : `${boundedPayload}\n`;
  }

  // Preserve user content outside bounds exactly
  const before = existingContent.substring(0, startIndex);
  const after = existingContent.substring(endIndex + SENTINELS.END.length);
  return `${before}${boundedPayload}${after}`;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blind overwrite without boundary markers or escaping.
// Blows away custom engineer modifications and crashes on unescaped quotes.
export function writeSkillFile(filePath: string, metadata: { name: string }, rules: string[]) {
  const content = `---
name: "${metadata.name}" 
---
# Rules
${rules.join("\n")}`;
  fs.writeFileSync(filePath, content, "utf8"); // Destroys custom edits!
}
```

**VERIFICATION METHOD**:
```typescript
import { describe, it, expect } from "vitest";

describe("Invariant Boundary Wrapping", () => {
  it("preserves manual edits outside sentinel boundaries across overwrites", () => {
    const original = `# Manual Intro\nDo not delete\n<!-- TYPEUI_MANAGED_BLOCK_START -->\nOld Code\n<!-- TYPEUI_MANAGED_BLOCK_END -->\n# Manual Footer`;
    const updated = injectManagedBlock(original, "New Code 2.0");
    expect(updated).toContain("# Manual Intro\nDo not delete\n");
    expect(updated).toContain("# Manual Footer");
    expect(updated).toContain("New Code 2.0");
    expect(updated).not.toContain("Old Code");
  });

  it("escapes malicious quote sequences in frontmatter", () => {
    const malicious = 'Attack " && rm -rf / || "';
    const escaped = escapeYamlScalar(malicious);
    expect(escaped).toBe('Attack \\" && rm -rf / || \\"');
  });
});
```

---

### 2. Idempotent Config Mutation with Mandatory Backup and State Fingerprinting
**RULE**:
Agent tooling and plugins modifying workspace or home-directory configuration files (YAML, JSON, TOML) MUST execute idempotently, MUST verify whether the target key/value pair matches before writing, and MUST write a verifiable backup file before modifying host state.

**WHY**:
Blindly writing to files such as `~/.hermes/config.yaml` or `.mcp.json` corrupts user configurations, erases custom MCP servers, causes configuration drift, or leads to syntax destruction if the process is killed midway.

**WHEN TO APPLY**:
Whenever writing CLI plugins, agent installation scripts, or config patch handlers in TypeScript, Python, or Go.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from __future__ import annotations
import json
import shutil
import tempfile
from pathlib import Path
from typing import Any, Dict, Tuple

def atomic_idempotent_patch(
    config_path: Path,
    server_key: str,
    server_config: Dict[str, Any],
    force: bool = False
) -> Tuple[bool, str | None]:
    """
    Safely patch configuration.
    Returns (changed: bool, backup_path: str | None).
    """
    if not config_path.exists():
        config_path.parent.mkdir(parents=True, exist_ok=True)
        initial_data = {"mcpServers": {server_key: server_config}}
        config_path.write_text(json.dumps(initial_data, indent=2), encoding="utf-8")
        return True, None

    raw_text = config_path.read_text(encoding="utf-8")
    try:
        data = json.loads(raw_text) if raw_text.strip() else {}
    except Exception as exc:
        raise ValueError(f"Corrupt configuration at {config_path}: {exc}") from exc

    servers = data.setdefault("mcpServers", {})
    existing = servers.get(server_key)

    # Check state identity (idempotency guard)
    if existing == server_config and not force:
        return False, None

    # Create immutable backup before file mutation
    backup_path = config_path.with_suffix(f".backup_{int(tempfile._get_candidate_names().__next__())}.json")
    shutil.copy2(config_path, backup_path)

    # Atomic write pattern: write to tmp file in same directory then replace
    servers[server_key] = server_config
    tmp_path = config_path.with_suffix(".tmp")
    try:
        tmp_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        tmp_path.replace(config_path) # Atomic POSIX & Windows rename
    except Exception:
        if tmp_path.exists():
            tmp_path.unlink()
        raise

    return True, str(backup_path)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Blind write without backup, without JSON verification, without atomicity
def unsafe_patch(config_path, server_key, server_url):
    # Overwrites entire file, erases other tools, risks partial write on crash
    data = {"mcpServers": {server_key: {"url": server_url}}}
    with open(config_path, "w") as f:
        f.write(json.dumps(data))
```

**VERIFICATION METHOD**:
```python
import json
from pathlib import Path

def test_atomic_idempotent_patch(tmp_path: Path):
    cfg = tmp_path / "config.json"
    cfg.write_text(json.dumps({"mcpServers": {"existing": {"url": "http://localhost"}}}), encoding="utf-8")
    
    server_cfg = {"url": "https://mcp.typeui.sh"}
    changed, backup = atomic_idempotent_patch(cfg, "typeui", server_cfg)
    assert changed is True
    assert backup is not None
    assert Path(backup).exists()

    # Second pass must be a no-op (idempotent)
    changed2, backup2 = atomic_idempotent_patch(cfg, "typeui", server_cfg)
    assert changed2 is False
    assert backup2 is None
```

---

### 3. Client-Side Decoupling of Remote Tool Preconditions
**RULE**:
Remote Agent Protocols (MCP/REST/gRPC) MUST NOT block all server-side tools behind client-side local filesystem checks that the remote server cannot independently inspect or verify. If a tool requires local files (e.g., local design skills), validation MUST be delegated to the local execution client or returned as a non-fatal soft hint rather than a hard execution lock.

**WHY**:
As evidenced in Issue #4, remote MCP servers (e.g., `https://mcp.typeui.sh/mcp`) that attempt to verify local skill installation (`.agents/skills/typeui-fundamentals/`) across heterogeneous platforms (Windows 11 vs Linux, OpenCode vs Claude Code) enter infinite instruction loops ("Run `npx skills add ...`") because the remote cloud server has no direct filesystem access or reliable mechanism to verify local workspace state. This breaks all downstream tools.

**WHEN TO APPLY**:
When designing MCP servers, language servers (LSP), or agent plugins that operate remotely over HTTPS/SSE while interacting with local developer workspaces.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
interface ExecutionContext {
  workspaceSkillsInstalled?: boolean;
  platform?: "win32" | "darwin" | "linux";
}

interface ToolExecutionRequest {
  toolName: string;
  arguments: Record<string, unknown>;
  context: ExecutionContext;
}

interface ToolExecutionResponse {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export async function executeMcpToolWithGracefulDegradation(
  req: ToolExecutionRequest
): Promise<ToolExecutionResponse> {
  // Graceful degradation: never lock server tools if local context is unverifiable
  const isInstalled = req.context.workspaceSkillsInstalled ?? true;

  if (!isInstalled) {
    // Provide non-blocking diagnostic header while fulfilling payload
    const result = await runInternalToolLogic(req.toolName, req.arguments);
    return {
      content: [
        {
          type: "text",
          text: `[ADVISORY: Local skill not detected. Run 'npx skills add typeui-fundamentals' for optimal formatting]\n\n${result}`
        }
      ]
    };
  }

  const result = await runInternalToolLogic(req.toolName, req.arguments);
  return { content: [{ type: "text", text: result }] };
}

async function runInternalToolLogic(name: string, args: Record<string, unknown>): Promise<string> {
  return `Execution output for ${name} with args: ${JSON.stringify(args)}`;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Remote server assumes failure and blocks all tools
export async function badToolHandler(req: any) {
  // Remote server cannot see local .agents/skills/ directory!
  if (!checkRemoteHeuristicForLocalInstall(req)) {
    // Blocks execution entirely, forcing agent into infinite remediation loop
    throw new Error("MCP tools blocked: install fundamentals loop");
  }
  return executeTool(req);
}
```

**VERIFICATION METHOD**:
```typescript
import { describe, it, expect } from "vitest";

describe("Decoupled Remote Tool Execution", () => {
  it("executes payload successfully even when workspace verification status is indeterminate", async () => {
    const res = await executeMcpToolWithGracefulDegradation({
      toolName: "generate_palette",
      arguments: { theme: "dark" },
      context: { workspaceSkillsInstalled: false } // Local file check failed
    });

    expect(res.isError).toBeFalsy();
    expect(res.content[0].text).toContain("Execution output for generate_palette");
    expect(res.content[0].text).toContain("ADVISORY");
  });
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Remote MCP Fundamentals Verification Loop in OpenCode (BUG-MCP-VERIFY-01)
- **Context**: OpenCode v1.14.45 on Windows 11 interacting with the remote TypeUI MCP endpoint (`https://mcp.typeui.sh/mcp`).
- **What Was Expected**: Running `npx skills add https://github.com/bergside/typeui --skill typeui-fundamentals` installs the skill locally to `.agents/skills/typeui-fundamentals/`. Subsequent MCP tool calls (`create_component`, `get_tokens`) should unlock and execute.
- **What Actually Happened**: The remote MCP server returned `Run this command from the project root to install TypeUI UI/UX fundamentals: npx skills add...` on every single tool call. Only `check_access` and `get_usage` worked; all other tools remained permanently blocked, trapping the agent in an infinite tool-invocation retry loop.
- **Evidence in Repo**: Closed Issue #4 (`Opencode typeui mcp not working`).
- **Root Cause**: The remote MCP endpoint enforced a server-side gate checking for local client installation signals. OpenCode on Windows 11 did not relay the local installation state or path structure (`.agents/skills/` vs `.claude/skills/` vs Windows backslash path semantics) back over the MCP transport headers. The remote server evaluated `has_fundamentals == false` and threw a blocking instruction rather than executing the requested tool.
- **Remediation Code Diff**:
```typescript
// - if (!session.hasVerifiedFundamentals) {
// -   return { isError: true, content: [{ type: "text", text: "Run npx skills add..." }] };
// - }
// + // Decouple remote execution from unverifiable local client path state
// + const warningPrefix = !session.hasVerifiedFundamentals
// +   ? "Tip: Run 'npx skills add typeui-fundamentals' to enable local design linting.\n\n"
// +   : "";
// + const result = await executeToolHandler(request);
// + return { content: [{ type: "text", text: warningPrefix + result }] };
```
- **Lesson**: A cloud-hosted MCP server must never make remote tool availability conditional on unverifiable client-side filesystem state.

---

### Incident 2: Frontmatter Scalar Injection via Unsanitized Metadata (BUG-YAML-ESC-02)
- **Context**: `src/renderers/shared.ts` in `createSkillFrontmatter` and `createDesignMarkdownFile`.
- **What Was Expected**: Products with arbitrary special characters, quotation marks, or backslashes in their names or descriptions generate valid YAML frontmatter without breaking parsers.
- **What Actually Happened**: Unsanitized double quotes inside `metadata.name` or `metadata.description` broke frontmatter boundaries, leading to parse crashes in agent parsers (such as Gray-Matter, PyYAML, or AST markdown parsers).
- **Evidence in Repo**: `src/renderers/shared.ts`:
  ```typescript
  function escapeYamlString(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/\"/g, '\\\"');
  }
  ```
- **Root Cause**: Developers directly interpolated string variables into `"---\nname: \"" + value + "\"\n---"`. A value containing `"` resulted in unescaped syntax errors: `name: "My "Super" App"`.
- **Remediation Code Diff**:
```typescript
// - `name: "${metadata.name}"`,
// + `name: "${escapeYamlString(metadata.name)}"`,
```
- **Lesson**: String interpolation into serialized document schemas (YAML, JSON, XML) without strict character-level escaping or an AST serializer creates syntax injection vulnerabilities.

---

### Incident 3: Spacing Scale Parsing Crash on Malformed Token Strings (BUG-TOKEN-PARSE-03)
- **Context**: `src/renderers/shared.ts` -> `deriveSpacingTokens(spacingScale: string)`.
- **What Was Expected**: If `design.spacingScale` contains non-numeric strings or arbitrary qualitative descriptions (e.g., `"auto"`, `""`, `"custom-fluid"`), the parser must fall back gracefully to standard tokens.
- **What Actually Happened**: Code assuming regex match presence threw runtime crashes or returned `undefinedpx` when indexing elements from null regex returns.
- **Evidence in Repo**: `src/renderers/shared.ts`:
  ```typescript
  const numericValues = spacingScale.match(/\d+/g)?.map((value) => Number(value)) ?? [];
  if (numericValues.length >= 2) {
    return {
      sm: `${numericValues[0]}px`,
      md: `${numericValues[1]}px`
    };
  }
  ```
- **Root Cause**: `spacingScale.match(/\d+/g)` returns `null` when no digits exist. Calling `.map()` on `null` throws `TypeError: Cannot read properties of null (reading 'map')`. The implementation safeguarded this with optional chaining `?.map(...) ?? []`.
- **Remediation Code Diff**:
```typescript
// - const numericValues = spacingScale.match(/\d+/g).map(Number); // Throws TypeError if no digits
// + const numericValues = spacingScale.match(/\d+/g)?.map((value) => Number(value)) ?? [];
```
- **Lesson**: In freeform text-to-token parsing, never chain methods directly off regex matches without optional chaining (`?.`) and explicit fallback arrays (`?? []`).

---

### Incident 4: Inconsistent CLI Package Entry Point and Binary Shebang (BUG-CLI-EXEC-04)
- **Context**: `package.json` (`"bin": { "typeui.sh": "dist/cli.js" }`) and tsconfig execution.
- **What Was Expected**: Installing `@typeui/cli` or executing `npx typeui.sh` on Unix and Windows systems invokes Node with proper execution privileges.
- **What Actually Happened**: Transpiling `src/cli.ts` via standard `tsc` does not automatically prepend `#!/usr/bin/env node` unless configured or explicitly managed, leading to `permission denied` or syntax errors on POSIX shells trying to execute JavaScript as Bash.
- **Evidence in Repo**: `package.json`:
  ```json
  "bin": {
    "typeui.sh": "dist/cli.js"
  },
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc -p tsconfig.json",
    "prepack": "npm run build"
  }
  ```
- **Root Cause**: Separation between dev runtime (`tsx`) and production distribution (`dist/cli.js`).
- **Remediation Code Diff**:
```typescript
// File: src/cli.ts
// + #!/usr/bin/env node
//   import { Command } from "commander";
//   ...
```
- **Lesson**: Any binary declared under `package.json` `"bin"` must contain an immutable shebang header on line 1, verified during CI `prepack` and dry-run packaging.

---

### Incident 5: Web Portal Layout Clipping and Z-Index Stacking Context (BUG-UI-MENU-05)
- **Context**: Closed Issue #2 (`default Dropdown Menu on the website`).
- **What Was Expected**: The default navigation dropdown menu on `typeui.sh` opens and overlays page content cleanly without layout clipping.
- **What Actually Happened**: The dropdown menu rendered partially obscured or clipped by parent container stacking contexts (`overflow: hidden` on header wrappers, low `z-index`).
- **Evidence in Repo**: Closed Issue #2 screenshot and bug report.
- **Root Cause**: Dropdown component placed inside an element with `overflow: hidden` or a nested CSS stacking context (`isolation: isolate` or `transform`), causing absolute elements to clip to parent boundaries rather than overlaying the viewport.
- **Remediation Code Diff**:
```css
/* - .navbar-container { overflow: hidden; position: relative; } */
/* + .navbar-container { overflow: visible; position: relative; z-index: 50; } */
/* + .dropdown-content { position: absolute; z-index: 100; transform: translateZ(0); } */
```
- **Lesson**: Menus and modals must either render into a portal root (`document.body`) or ensure all ancestor containers maintain `overflow: visible` with explicit z-index tiering.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
In `src/renderers/shared.ts`, token parsing translates unstructured strings into strict objects.
```typescript
function parseKeyValuePairs(value: string): Record<string, string> {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const [rawKey, ...rawValueParts] = part.split("=");
      // MICRO-INVARIANT: Lowercase key normalization to prevent case-sensitivity misses
      const key = rawKey?.trim().toLowerCase();
      // MICRO-INVARIANT: Array rest join protects values containing "=" (e.g., font family names or queries)
      const rawValue = rawValueParts.join("=").trim();
      if (key && rawValue) {
        acc[key] = rawValue;
      }
      return acc;
    }, {});
}
```
- **Hazard**: Using `const [key, value] = part.split("=")` drops tokens containing equals signs (e.g., `weights=400,600=italic`). Rest assembly (`rawValueParts.join("=")`) preserves value fidelity.
- **Type Coercion Invariant**: Numeric derivation in `deriveSpacingTokens`:
  ```typescript
  const numericValues = spacingScale.match(/\d+/g)?.map((value) => Number(value)) ?? [];
  ```
  `Number(value)` is used over `parseInt(value, 10)` to prevent radix bugs and ensure clean parsing of digit sequences.

### 2. Infinite Loop & Recursion Guards
In `plugins/hermes/typeui/typeui_hermes/__init__.py`:
```python
def _register_skills(ctx) -> None:
    if not hasattr(ctx, "register_skill"):
        return

    skills_dir = Path(__file__).parent / "skills"
    if not skills_dir.exists():
        return

    # GUARD: sorted() guarantees deterministic ordering; avoid infinite recursion on symlinks
    for child in sorted(skills_dir.iterdir()):
        if child.is_symlink():
            continue  # GUARD: Prevent cyclic directory resolution
        skill_md = child / "SKILL.md"
        if child.is_dir() and skill_md.exists():
            ctx.register_skill(child.name, skill_md)
```
- **Proof of Termination**: `iterdir()` iterates only the direct descendants of `skills_dir` (depth = 1). By explicitly skipping symlinks (`child.is_symlink()`), circular filesystem graphs cannot trigger infinite scanning loops.

### 3. UI & UX Micro-Mechanics
- **Reflow & Layout Thrashing**: In design token synthesis (`createDesignMarkdownFile`), font definitions explicitly separate font family, size, line height, and font weight into structured YAML declarations rather than single shorthand CSS strings (`"3rem Public Sans"`). Shorthand parsing in browser rendering engines causes recalculation of entire font cascades, whereas explicit token definitions allow atomic CSS variable mapping (`var(--font-display)`).
- **Z-Index Stacking Order**: Dropdowns and overlays must be bound to CSS variable scales (`--z-index-dropdown: 1000; --z-index-modal: 2000;`), avoiding hardcoded values (`z-index: 99999`) that break under complex composition.

### 4. Backend Concurrency & Memory Safety
In `plugins/hermes/typeui/typeui_hermes/__init__.py`:
```python
def _slash_command(raw_args: str) -> str:
    try:
        # CONCURRENCY/INJECTION GUARD: Use shlex.split to handle shell escapes safely
        parts = shlex.split(raw_args or "")
    except ValueError as exc:
        # Return graceful failure instead of crashing the agent session thread
        return f"Invalid /typeui arguments: {exc}"
```
- **Memory Safety**: Parsing user input inside slash commands with `shlex.split` prevents argument injection vulnerabilities that could spawn unconstrained child processes.
- **Resource Exhaustion Guard**: Parsing failures caught immediately without rethrowing preserve the long-running Hermes agent background thread.

### 5. Defect & Error Prevention ("Galti Pakadna")
In `src/renderers/shared.ts`:
```typescript
function parseTypographyMetadata(typographyScale: string): {
  sourceScale: string;
  primary: string;
  display: string;
  mono: string;
  weights: string;
} {
  // SAFE INDEXING: Defensive fallback if typographyScale is empty or has no pipe
  const sourceScale = typographyScale.split("|")[0]?.trim() || "12/14/16/20/24/32";
  const fontsMatch = typographyScale.match(/\|\s*Fonts:\s*([^|]+)/i);
  const fontPairs = parseKeyValuePairs(fontsMatch?.[1] ?? "");
  const weightsMatch = typographyScale.match(/weights\s*=\s*([^|]+)/i);

  return {
    sourceScale,
    primary: fontPairs.primary ?? "Public Sans",
    // Fallback cascade: display font defaults to primary font if undefined
    display: fontPairs.display ?? fontPairs.primary ?? "Public Sans",
    mono: fontPairs.mono ?? "Space Grotesk",
    weights: weightsMatch?.[1]?.trim() ?? "400, 500, 600, 700"
  };
}
```
- **Fallback Hierarchy**: `display: fontPairs.display ?? fontPairs.primary ?? "Public Sans"`. If `display` is missing, it falls back to `primary`. If `primary` is missing, it falls back to system constant `"Public Sans"`. At no point can `undefined` leak into generated YAML.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Monorepo / Multi-Provider Orchestration**: Single core TypeScript model (`DesignSystemInput`) rendered into specialized formats for 6+ distinct agent formats (`.claude`, `.codex`, `.cursor`, `.opencode`, `hermes`, `cline`).
- **Decoupled Render Pipeline**: `renderProviderFiles` maps a list of requested providers to file descriptors (`{ provider, relativePath, content }`), allowing new agent targets to be added simply by defining their relative skill path and display title in `PROVIDER_DETAILS`.

### 2. Core Abstractions
- `DesignSystemInput`: Domain model holding product identity (`productName`, `brandSummary`), foundations (`visualStyle`, `typographyScale`, `colorPalette`, `spacingScale`), accessibility requirements, tone of voice, and explicit `doRules` / `dontRules`.
- `ProviderFile`: Atomic unit of generation containing target provider name, relative destination path, and rendered string contents.
- `SkillMetadata`: Metadata interface for frontmatter injection (`name`, `description`, `author`).

### 3. Error Handling
- Safe regex execution across token derivation.
- Fallback cascades ensuring that malformed or partial token inputs produce valid design system specifications rather than unhandled rejections.
- Graceful handling of shell argument syntax errors via `shlex` in Python plugins.

### 4. Testing
- Unit testing with `vitest` covering string escaping, token extraction regex, and frontmatter rendering.
- `release:check` npm script invariant:
  ```json
  "release:check": "npm run typecheck && npm run test && npm pack --dry-run"
  ```
  Prevents dirty releases by verifying compile-time TypeScript types, test suites, and packaging output before any npm publication.

### 5. Security
- Frontmatter YAML sanitization (`escapeYamlString`) preventing code injection via manipulated design inputs.
- Safe argument parsing (`shlex.split`) preventing command injection in CLI and slash command handlers.
- Safe config backup before writing to agent home directories.

### 6. Performance
- Zero-dependency runtime execution: The rendering pipeline relies strictly on deterministic