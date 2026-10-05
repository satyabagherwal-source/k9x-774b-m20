# Forensic Learning Record (Deep Inspection): affaan-m/ECC

> **Canonical Artifact**: `07_PROJECT_LEARNING/affaan-m-ecc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/affaan-m/ECC](https://github.com/affaan-m/ECC))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:07:30.642Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `affaan-m/ECC`
- **Description**: The agent harness performance optimization system. Skills, instincts, memory, security, and research-first development for Claude Code, Codex, Opencode, Cursor and beyond.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 273469 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.cursor/hooks/adapter.js`
```
#!/usr/bin/env node
/**
 * Cursor-to-Claude Code Hook Adapter
 * Transforms Cursor stdin JSON to Claude Code hook format,
 * then delegates to existing scripts/hooks/*.js
 */

const { execFileSync } = require('child_process');
const path = require('path');

const MAX_STDIN = 1024 * 1024;

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      if (data.length < MAX_STDIN) data += chunk.substring(0, MAX_STDIN - data.length);
    });
    process.stdin.on('end', () => resolve(data));
  });
}

function getPluginRoot() {
  return path.resolve(__dirname, '..', '..');
}

function transformToClaude(cursorInput, overrides = {}) {
  return {
    tool_input: {
      command: cursorInput.command || cursorInput.args?.command || '',
      file_path: cursorInput.path || cursorInput.file || cursorInput.args?.filePath || '',
      ...overrides.tool_input,
    },
    tool_output: {
      output: cursorInput.output || cursorInput.result || '',
      ...overrides.tool_output,
    },
    transcript_path: cursorInput.transcript_path || cursorInput.transcriptPath || cursorInput.session?.transcript_path || '',
    _cursor: {
      conversation_id: cursorInput.conversation_id,
      hook_event_name: cursorInput.hook_event_name,
      workspace_roots: cursorInput.workspace_roots,
      model: cursorInput.model,
    },
  };
}

function runExistingHook(scriptName, stdinData) {
  const scriptPath = path.join(getPluginRoot(), 'scripts', 'hooks', scriptName);
  try {
    execFileSync('node', [scriptPath], {
      input: typeof stdinData === 'string' ? stdinData : JSON.stringify(stdinData),
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
      cwd: process.cwd(),
    });
  } catch (e) {
    if (e.status === 2) process.exit(2); // Forward blocking exit code
  }
}

function hookEnabled(hookId, allowedProfiles = ['standard', 'strict']) {
  const rawProfile = String(process.env.ECC_HOOK_PROFILE || 'standard').toLowerCase();
  const profile = ['minimal', 'standard', 'strict'].includes(rawProfile) ? rawProfile : 'standard';

  const disabled = new Set(
    String(process.env.ECC_DISABLED_HOOKS || '')
      .split(',')
      .map(v => v.trim().toLowerCase())
      .filter(Boolean)
  );

  if (disabled.has(String(hookId || '').toLowerCase())) {
    return false;
  }

  return allowedProfiles.includes(profile);
}

module.exports = { readStdin, getPluginRoot, transformToClaude, runExistingHook, hookEnabled };

```

### Core Architecture Module: `.cursor/hooks/after-file-edit.js`
```
#!/usr/bin/env node
const { hookEnabled, readStdin, runExistingHook, transformToClaude } = require('./adapter');
readStdin().then(raw => {
  try {
    const input = JSON.parse(raw);
    const claudeInput = transformToClaude(input, {
      tool_input: { file_path: input.path || input.file || '' }
    });
    const claudeStr = JSON.stringify(claudeInput);

    // Accumulate edited paths for batch format+typecheck at stop time
    runExistingHook('post-edit-accumulator.js', claudeStr);
    runExistingHook('post-edit-console-warn.js', claudeStr);
    if (hookEnabled('post:edit:design-quality-check', ['standard', 'strict'])) {
      runExistingHook('design-quality-check.js', claudeStr);
    }
  } catch {}
  process.stdout.write(raw);
}).catch(() => process.exit(0));

```

### Core Architecture Module: `.cursor/hooks/after-mcp-execution.js`
```
#!/usr/bin/env node
const { readStdin } = require('./adapter');
readStdin().then(raw => {
  try {
    const input = JSON.parse(raw);
    const server = input.server || input.mcp_server || 'unknown';
    const tool = input.tool || input.mcp_tool || 'unknown';
    const success = input.error ? 'FAILED' : 'OK';
    console.error(`[ECC] MCP result: ${server}/${tool} - ${success}`);
  } catch {}
  process.stdout.write(raw);
}).catch(() => process.exit(0));

```

### Core Architecture Module: `.cursor/hooks/after-shell-execution.js`
```
#!/usr/bin/env node
const { readStdin, hookEnabled } = require('./adapter');

readStdin().then(raw => {
  try {
    const input = JSON.parse(raw || '{}');
    const cmd = String(input.command || input.args?.command || '');
    const output = String(input.output || input.result || '');

    if (hookEnabled('post:bash:pr-created', ['standard', 'strict']) && /\bgh\s+pr\s+create\b/.test(cmd)) {
      const m = output.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/);
      if (m) {
        console.error('[ECC] PR created: ' + m[0]);
        const repo = m[0].replace(/https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/, '$1');
        const pr = m[0].replace(/.+\/pull\/(\d+)/, '$1');
        console.error('[ECC] To review: gh pr review ' + pr + ' --repo ' + repo);
      }
    }

    if (hookEnabled('post:bash:build-complete', ['standard', 'strict']) && /(npm run build|pnpm build|yarn build)/.test(cmd)) {
      console.error('[ECC] Build completed');
    }
  } catch {
    // noop
  }

  process.stdout.write(raw);
}).catch(() => process.exit(0));

```

### Core Architecture Module: `.cursor/hooks/after-tab-file-edit.js`
```
#!/usr/bin/env node
const { readStdin, runExistingHook, transformToClaude } = require('./adapter');
readStdin().then(raw => {
  try {
    const input = JSON.parse(raw);
    const claudeInput = transformToClaude(input, {
      tool_input: { file_path: input.path || input.file || '' }
    });
    runExistingHook('post-edit-format.js', JSON.stringify(claudeInput));
  } catch {}
  process.stdout.write(raw);
}).catch(() => process.exit(0));

```

### Core Architecture Module: `.cursor/hooks/before-mcp-execution.js`
```
#!/usr/bin/env node
const { readStdin } = require('./adapter');
readStdin().then(raw => {
  try {
    const input = JSON.parse(raw);
    const server = input.server || input.mcp_server || 'unknown';
    const tool = input.tool || input.mcp_tool || 'unknown';
    console.error(`[ECC] MCP invocation: ${server}/${tool}`);
  } catch {}
  process.stdout.write(raw);
}).catch(() => process.exit(0));

```

### Core Architecture Module: `.cursor/hooks/before-read-file.js`
```
#!/usr/bin/env node
const { readStdin } = require('./adapter');
readStdin().then(raw => {
  try {
    const input = JSON.parse(raw);
    const filePath = input.path || input.file || '';
    if (/\.(env|key|pem)$|\.env\.|credentials|secret/i.test(filePath)) {
      console.error('[ECC] WARNING: Reading sensitive file: ' + filePath);
      console.error('[ECC] Ensure this data is not exposed in outputs');
    }
  } catch {}
  process.stdout.write(raw);
}).catch(() => process.exit(0));

```

### Core Architecture Module: `.cursor/hooks/before-shell-execution-block-no-verify.js`
```
#!/usr/bin/env node
/**
 * Cursor wrapper for block-no-verify.
 *
 * Cursor hooks previously called `npx block-no-verify@1.1.2`, an external
 * package whose matcher over-matches: it blocks legitimate `git commit`
 * whenever the literal string `--no-verify` (or `no-verify`) appears
 * anywhere in the command string, including inside the commit message
 * body. See issue #2107.
 *
 * The Claude Code surface already routes through the local, in-repo hook
 * `scripts/hooks/block-no-verify.js`, which performs flag-position-aware
 * tokenisation (skipping the value of `-m`, `-F`, `-am "..."`, etc.) and
 * passes 25 regression tests covering every false-positive case.
 *
 * This wrapper gives Cursor the same matcher: read Cursor stdin, transform
 * to the Claude Code `tool_input.command` shape the local hook understands,
 * delegate to its exported `run()`, then forward the exit code and stderr.
 */

'use strict';

const { readStdin, hookEnabled } = require('./adapter');
const { run } = require('../../scripts/hooks/block-no-verify');

readStdin()
  .then(raw => {
    if (!hookEnabled('pre:bash:block-no-verify', ['minimal', 'standard', 'strict'])) {
      process.stdout.write(raw);
      return;
    }

    let command = '';
    try {
      const parsed = JSON.parse(raw || '{}');
      command = String(parsed.command || parsed.args?.command || '');
    } catch {
      command = String(raw || '');
    }

    // Local hook accepts either the raw command string or a Claude-Code
    // shaped `{ tool_input: { command } }` JSON. Pass the Claude shape so
    // the JSON branch in extractCommand() is exercised the same way the
    // Claude Code surface exercises it — keeps the two surfaces on the
    // same code path.
    const claudeInput = JSON.stringify({ tool_input: { command } });
    const result = run(claudeInput);

    if (result && result.exitCode === 2) {
      if (result.stderr) {
        process.stderr.write(String(result.stderr) + '\n');
      }
      process.exit(2);
    }

    process.stdout.write(raw);
  })
  .catch(() => {
    // Per repo rule: hooks must exit 0 on non-critical errors and never
    // unexpectedly block tool execution. A parse / transport error here
    // is non-critical — fall through.
    process.exit(0);
  });

```

### Core Architecture Module: `.cursor/hooks/before-shell-execution.js`
```
#!/usr/bin/env node
const { readStdin, hookEnabled } = require('./adapter');
const { splitShellSegments } = require('../../scripts/lib/shell-split');

readStdin()
  .then(raw => {
    try {
      const input = JSON.parse(raw || '{}');
      const cmd = String(input.command || input.args?.command || '');

      if (hookEnabled('pre:bash:dev-server-block', ['standard', 'strict']) && process.platform !== 'win32') {
        const segments = splitShellSegments(cmd);
        const tmuxLauncher = /^\s*tmux\s+(new|new-session|new-window|split-window)\b/;
        const devPattern = /\b(npm\s+run\s+dev|pnpm(?:\s+run)?\s+dev|yarn\s+dev|bun\s+run\s+dev)\b/;
        const hasBlockedDev = segments.some(segment => devPattern.test(segment) && !tmuxLauncher.test(segment));
        if (hasBlockedDev) {
          console.error('[ECC] BLOCKED: Dev server must run in tmux for log access');
          console.error('[ECC] Use: tmux new-session -d -s dev "npm run dev"');
          process.exit(2);
        }
      }

      if (
        hookEnabled('pre:bash:tmux-reminder', ['strict']) &&
        process.platform !== 'win32' &&
        !process.env.TMUX &&
        /(npm (install|test)|pnpm (install|test)|yarn (install|test)?|bun (install|test)|cargo build|make\b|docker\b|pytest|vitest|playwright)/.test(cmd)
      ) {
        console.error('[ECC] Consider running in tmux for session persistence');
      }

      if (hookEnabled('pre:bash:git-push-reminder', ['strict']) && /\bgit\s+push\b/.test(cmd)) {
        console.error('[ECC] Review changes before push: git diff origin/main...HEAD');
      }
    } catch {
      // noop
    }

    process.stdout.write(raw);
  })
  .catch(() => process.exit(0));

```

### Core Architecture Module: `.cursor/hooks/before-submit-prompt.js`
```
#!/usr/bin/env node
const { readStdin } = require('./adapter');
readStdin().then(raw => {
  try {
    const input = JSON.parse(raw);
    const prompt = input.prompt || input.content || input.message || '';
    const secretPatterns = [
      /sk-[a-zA-Z0-9]{20,}/,       // OpenAI API keys
      /ghp_[a-zA-Z0-9]{36,}/,      // GitHub personal access tokens
      /AKIA[A-Z0-9]{16}/,          // AWS access keys
      /xox[bpsa]-[a-zA-Z0-9-]+/,   // Slack tokens
      /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, // Private keys
    ];
    for (const pattern of secretPatterns) {
      if (pattern.test(prompt)) {
        console.error('[ECC] WARNING: Potential secret detected in prompt!');
        console.error('[ECC] Remove secrets before submitting. Use environment variables instead.');
        break;
      }
    }
  } catch {}
  process.stdout.write(raw);
}).catch(() => process.exit(0));

```

### Core Architecture Module: `.cursor/hooks/before-tab-file-read.js`
```
#!/usr/bin/env node
const { readStdin } = require('./adapter');
readStdin().then(raw => {
  try {
    const input = JSON.parse(raw);
    const filePath = input.path || input.file || '';
    if (/\.(env|key|pem)$|\.env\.|credentials|secret/i.test(filePath)) {
      console.error('[ECC] BLOCKED: Tab cannot read sensitive file: ' + filePath);
      process.exit(2);
    }
  } catch {}
  process.stdout.write(raw);
}).catch(() => process.exit(0));

```

### Core Architecture Module: `.cursor/hooks/pre-compact.js`
```
#!/usr/bin/env node
const { readStdin, runExistingHook, transformToClaude } = require('./adapter');
readStdin().then(raw => {
  const claudeInput = JSON.parse(raw || '{}');
  runExistingHook('pre-compact.js', transformToClaude(claudeInput));
  process.stdout.write(raw);
}).catch(() => process.exit(0));

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3203** (2026-09-21): **[Problem] Installation Error**
  *Symptoms*: ### What is the impact?  ECC will not install  ### What happened?  Error: Claude Code command failed: error: unknown option '--config'  ``` ➜  ~ npx ecc-universal@2.2.1 setup  Need to install the following packages: ecc-universal@2.2.1 Ok to proceed? (y) y   Where should Claude enable ecc@ecc?   1. Global user — Available in every project for this user.   2. Shared project — Stored in repository settings for collaborators.   3. Private project — Enabled only here without committing the choice. Choose [1]: 1  How should ECC hooks run?   1. Off — Keep skills and commands without local hook automation.   2. Minimal — Run only the lightest lifecycle and safety automation.   3. Standard — Balanced quality and safety automation.   4. Strict — Use the strongest checks and reminders. Choose [3]: 3 Apply claude-plugin setup at user scope with hooks=standard? [y/N] y Error: Claude Code command failed: error: unknown option '--config' ```  ### Harness  Claude Code  ### Install method  ecc or ecc-install CLI  ### Operating system  macOS  ### ECC and harness versions  ECC 2.2.1, Claude 2.2553.1 (c38127) 2026-09-18T00:41:58.000Z  ### Optional redacted diagnostics  _No response_
  **Post-Mortem & Fix Analysis**:
  > The fix in #3205 covers the main case — `claude-plugin-setup.js` no longer passes the removed `--config` flag. Two things worth knowing if you land here from a search: first, the fix is not on npm yet (`npm view ecc-universal version` still reports 2.2.1), so `npx ecc-universal@2.2.2 setup` 404s and 2.2.1 reproduces this exact error — the marketplace path is the working install route until a release cuts. Second, the sibling call site in `claude-scope-migration.js` was missed by that PR and still passes `--config` on main; it is now tracked in #3214, so if you hit this error during a scope migration rather than a first install, that is the thread to watch. If this is still biting your team, I'm available for a short paid engagement to close it out.

- **Issue #3112** (2026-09-19): **[Problem] Bug: OpenCode app stops responding after installing ECC (ERR_MODULE_NOT_FOUND on custom tools)**
  *Symptoms*: ### What is the impact?  ECC installs, but nothing loads  ### What happened?  # Bug: OpenCode app stops responding after installing ECC (ERR_MODULE_NOT_FOUND on custom tools)  ## Summary  After installing ECC (profile `full`, target `opencode-home`), the OpenCode application no longer responds to any prompt. Sessions start but produce no model output, and the logs show `prompt_async failed` with `ERR_MODULE_NOT_FOUND` on the ECC custom tools.  ## Environment  - OpenCode **1.18.25** (macOS desktop app + CLI) - ECC **2.2.1** (commit `8321021c`), installed `2026-09-13T13:17:06Z` - Install target: `opencode-home` -> root `/Users/<user>/.config/opencode` - Install state file: `~/.config/opencode/ecc-install-state.json`  ## Symptom  1. Every new session fails silently with no model response. 2. OpenCode log (`~/.local/share/opencode/log/opencode.log`):  ``` ERROR message="prompt_async failed" sessionID=ses_... cause="Cause([Die(Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../.config/opencode/tools/run-tests.js' imported from .../.config/opencode/tools/index.ts)])" ```  The failure happens while **building the tool registry** (`ToolRegistry.state` -> `SessionTools.resolve`), i.e. **before** any model request - so the app stops responding entirely.  ## Root cause  ECC installs the **TypeScript source barrels** into OpenCode's active directories, but these barrels import modules using the **`.js`** extension while only `.ts` files exist next to them (the matching `.js` files onl
  **Post-Mortem & Fix Analysis**:
  > Confirming this is fixed on main: `.opencode/tools/index.ts` now imports its eight tools with `.ts` extensions (`./run-tests.ts`, `./check-coverage.ts`, etc.), so the home install no longer references `dist/`-only files and the `ERR_MODULE_NOT_FOUND` during tool-registry build can't recur from that path. If you're still on the 2.2.1 install from commit 8321021c, the copies under `~/.config/opencode/tools/` keep the old `.js` imports until rewritten — re-run the installer (or its repair path) so the files are refreshed, then sessions should produce output again.

- **Issue #2886** (2026-09-19): **gateguard destructive-command detector matches heredoc body text, not just the actual command**
  *Symptoms*: Ran into this while writing a migration doc — a plain `cat > notes.md <<'EOF' ... EOF` command got blocked because the heredoc content (documentation text, nothing being executed) happened to contain words the destructive-command matcher looks for.  Traced it to `isDestructiveBash()` in `scripts/hooks/gateguard-fact-force.js` (~line 669-715):  - `DESTRUCTIVE_SQL_DD` (`drop table|delete from|truncate|dd if=`) is regex-tested against `flattened = explodeSubshells(stripQuotedStrings(raw))`, which is basically the whole command text. `stripQuotedStrings` blanks out `'...'` and `"..."` but a heredoc body isn't inside quotes, so none of that text gets stripped before the regex runs. - On the `rm` side, `isDestructiveRm()` is token-based (needs the segment's first token to literally be `rm`), but segment splitting (`splitCommandSegments`) only splits on `;|&` and has no concept of heredocs. If the heredoc body happens to contain a `;` followed by prose that starts with "rm -rf ...", that also gets read as its own segment and can trip the rm check too.  Repro:  ``` cat > migration-notes.md <<'EOF' This migration will DROP TABLE old_sessions once we've verified nothing reads from it anymore. EOF ```  That's just writing a markdown file. Nothing here touches a database, but the gate treats the phrase sitting inside the heredoc the same as if it were literally the command being run.  There's already a precedent for this exact class of bug: #352 was the same root cause (heredoc body text
  **Post-Mortem & Fix Analysis**:
  > Went to fix this and it looks like it's already resolved on `main` — `isDestructiveBash()` in `scripts/hooks/gateguard-fact-force.js` now runs `stripHeredocBodies(raw)` before any of the destructive regex/tokenizing (line ~680), and that strip happens before both the `DESTRUCTIVE_SQL_DD` regex pass and the `collectExecutableBodies`/`splitCommandSegments` path that feeds `isDestructiveRm`. That's the same fix direction suggested in this issue.  I checked out current `main` (commit `e04ea0b9`) and ran the exact repro from the issue description directly against `isDestructiveBash` (bypassing the routine first-command gate so only the destructive-detector result shows):  ``` cat > migration-notes.md <<'EOF' This migration will DROP TABLE old_sessions once we've verified nothing reads from it anymore. EOF ``` -> not flagged as destructive.  ``` drop table old_sessions; rm -rf / ``` -> both still correctly denied as destructive (no regression).  There's also test coverage for this exact scen
  > The stripHeredocBodies pass now on main covers the reported repro — quoted heredoc bodies are dropped before the destructive regexes and segment tokenizing run. One class it deliberately does not cover: isProvenPassiveHeredocLine in scripts/hooks/gateguard-heredoc.js only treats cat/tee receivers as passive. Any other stdin consumer — jq . <<'EOF', md5sum <<EOF, a node runner <<'EOF' — makes stripHeredocBodies return the raw command unchanged (fail closed), so destructive-looking prose in the heredoc body is matched as a command again. But the shell never executes heredoc payloads as commands regardless of the receiver; only unquoted $()/backtick substitutions execute, and those are already retained separately for classification. So the passive-sink whitelist could be generalized from "cat/tee only" to "any simple receiver without operators or substitutions", keeping the existing ambiguity fail-closed. If this is still biting your team, I'm available for a short paid engagement to clos
  > The stripHeredocBodies pass now on main covers the reported repro — quoted heredoc bodies are dropped before the destructive regexes and segment tokenizing run. One class it deliberately does not cover: isProvenPassiveHeredocLine in scripts/hooks/gateguard-heredoc.js only treats cat/tee receivers as passive. Any other stdin consumer — jq . <<'EOF', md5sum <<EOF, a node runner <<'EOF' — makes stripHeredocBodies return the raw command unchanged (fail closed), so destructive-looking prose in the heredoc body is matched as a command again. But the shell never executes heredoc payloads as commands regardless of the receiver; only unquoted $()/backtick substitutions execute, and those are already retained separately for classification. So the passive-sink whitelist could be generalized from "cat/tee only" to "any simple receiver without operators or substitutions", keeping the existing ambiguity fail-closed. If this is still biting your team, I'm available for a short paid engagement to clos

- **Issue #2876** (2026-09-02): **Test suite writes to the real ~/.claude/session-aliases.json — HOME isolation torn down at line 828 of 1830**
  *Symptoms*: ## Summary  `tests/lib/session-aliases.test.js` tears down its HOME isolation at **line 828**, but the file is **1830 lines long**. Every test after that point operates on the **real** `~/.claude/session-aliases.json` instead of the temp directory.  The suite reports **105 passed / 0 failed** either way, so this never surfaces as a test failure.  I found this because my own `~/.claude/session-aliases.json` had been carrying the Round 125 fixture (`__proto__` → `/evil/path`, title `"Prototype Pollution Attempt"`) since 2026-03-22.  ## Root cause  ```js // line 19-22 — isolation established (this part works correctly) const tmpHome = path.join(os.tmpdir(), `ecc-alias-test-${Date.now()}`); process.env.HOME = tmpHome; process.env.USERPROFILE = tmpHome;  // line 828-839 — isolation torn down, ~1000 lines before the last test process.env.HOME = origHome; process.env.USERPROFILE = origUserProfile; fs.rmSync(tmpHome, { recursive: true, force: true });  // line 1755+ — Round 125 still running, now against the REAL file const aliasesPath = aliases.getAliasesPath();   // → ~/.claude/session-aliases.json fs.writeFileSync(aliasesPath, rawJson); ```  After line 839 there are **19 remaining call sites** of `getAliasesPath()` / `writeFileSync` operating on the real path. One of them, at **line 936**, is `fs.writeFileSync(aliasesPath, '')` — it will **truncate** a user's real aliases file.  Only Round 70 (lines ~999-1054) protects itself, with its own local `isoHome` + try/finally.  ## Eviden
  **Post-Mortem & Fix Analysis**:
  > Audit confirmation on current main 656d4b57: the cleanup still restores HOME and USERPROFILE around line 829, before the remaining test rounds. The focused suite can report 105 passed and 0 failed while writing the 411-byte Round 125 fixture to the real ~/.claude/session-aliases.json. PR #2877 is open, mergeable, and has a fully passing matrix. Do not run this suite without an explicitly disposable HOME and USERPROFILE until that fix lands.
  > Confirmed landed: PR #2877 (merged as de899ac) removed the mid-file global teardown - current tests/lib/session-aliases.test.js still captures origHome/origUserProfile at lines 19-20 but no longer restores them around line 828; later rounds scope their own isolation (savedProfile + try/finally, lines 988+), so nothing past that point touches the real home. Worth re-running the report's two-liner as the closing check:  ``` HOME=/tmp/fakehome USERPROFILE=/tmp/fakehome node tests/lib/session-aliases.test.js cat /tmp/fakehome/.claude/session-aliases.json   # expect: no such file ```  Follow-up worth considering: 1830 lines in one test file is what let a teardown 1000 lines early pass green - splitting rounds into files would make this class of bug structural. Happy to ship a working implementation as a small paid engagement if that's useful.
  > Confirmed landed: PR #2877 (merged as de899ac) removed the mid-file global teardown - current tests/lib/session-aliases.test.js still captures origHome/origUserProfile at lines 19-20 but no longer restores them around line 828; later rounds scope their own isolation (savedProfile + try/finally, lines 988+), so nothing past that point touches the real home. Worth re-running the report's two-liner as the closing check:  ``` HOME=/tmp/fakehome USERPROFILE=/tmp/fakehome node tests/lib/session-aliases.test.js cat /tmp/fakehome/.claude/session-aliases.json   # expect: no such file ```  Follow-up worth considering: 1830 lines in one test file is what let a teardown 1000 lines early pass green - splitting rounds into files would make this class of bug structural.

- **Issue #2771** (2026-08-27): **[Problem] Cannot uninstall `sync-ecc-to-codex.sh` installation: "No ECC install-stage files" error**
  *Symptoms*: ### What is the impact?  Doctor or repair does not recover the install  ### What happened?  ## Background I previously installed ECC into my Codex environment using the `scripts/sync-ecc-to-codex.sh` script.  Now, I want to migrate to the modern, officially recommended installation method (either via `npx ecc-universal install --guided` or the native Codex plugin approach).  ## The Problem Before performing the new installation, I attempted to clean up the existing ECC setup. I ran the uninstall command:  ```Bash node scripts/ecc.js uninstall # (also tried npx ecc-universal uninstall) ```  However, the command failed to remove the legacy installation and returned the following error:  `No ECC install-stage files for current home/project context`  Because the old `.sh` script simply copied files into `~/.codex` and appended configurations to `config.toml` without leaving package manager metadata, the new uninstaller cannot detect or clean it up.  ## Questions  What is the recommended and safest way to manually clean up all artifacts left by `sync-ecc-to-codex.sh`?  I want to make sure I don't accidentally break my core Codex configuration or wipe my conversation history during the manual cleanup. Any guidance on this migration path would be greatly appreciated!  ### Harness  Codex app or CLI  ### Install method  Codex sync script  ### Operating system  Linux  ### ECC and harness versions  ECC 2.1.0; Codex 0.147.0  ### Optional redacted diagnostics  _No response_
  **Post-Mortem & Fix Analysis**:
  > This closed with no answer, so here is the concrete map, verified against scripts/sync-ecc-to-codex.sh on main. A legacy sync leaves: ~/.codex/agents/, ~/.codex/prompts/, ~/.codex/docs/CODEX-NAVIGATION-GUIDE.md, ~/.codex/docs/COMMAND-AGENT-MAP.md, ~/.codex/COMMANDS-QUICK-REF.md, ~/.codex/CONTRIBUTING.md, ~/.codex/.github/PULL_REQUEST_TEMPLATE.md, a marker-delimited ECC block in ~/.codex/AGENTS.md, ECC [mcp_servers.*] entries in config.toml, and global git hooks. Keep ~/.codex/backups/ecc-<stamp>/ - that is the pre-sync config. Current main also ships scripts/codex/legacy-sync-state.js with rollback support, but only for installs made by the new script; yours predates it, so manual removal per the list is the path. Conversation history is never touched.  If this is still biting your team, I'm available for a short paid engagement to close it out.
  > This closed with no answer, so here is the concrete map, verified against scripts/sync-ecc-to-codex.sh on main. A legacy sync leaves: ~/.codex/agents/, ~/.codex/prompts/, ~/.codex/docs/CODEX-NAVIGATION-GUIDE.md, ~/.codex/docs/COMMAND-AGENT-MAP.md, ~/.codex/COMMANDS-QUICK-REF.md, ~/.codex/CONTRIBUTING.md, ~/.codex/.github/PULL_REQUEST_TEMPLATE.md, a marker-delimited ECC block in ~/.codex/AGENTS.md, ECC [mcp_servers.*] entries in config.toml, and global git hooks. Keep ~/.codex/backups/ecc-<stamp>/ - that is the pre-sync config. Current main also ships scripts/codex/legacy-sync-state.js with rollback support, but only for installs made by the new script; yours predates it, so manual removal per the list is the path. Conversation history is never touched.  If this is still biting your team, I'm available for a short paid engagement to close it out.

- **Issue #2735** (2026-08-29): **[Problem]**
  *Symptoms*: ### What is the impact?  ECC will not install  ### What happened?  Tried to install by the npx and received:  ! npx ecc-universal setup npm error could not determine ex ecutable to run npm error A complete log of this … +3 lines  ecc-universal package no runnable bin. npx cannot find executable.  Likely causes: - Package no exist on npm (typo in name) - Package exist but no bin field - Need scope/different name  Check:    Ran 1 shell command  Package real (v2.1.0) but no bin named ecc-universal. Bins are ecc, ecc-install, etc. npx picks bin = package name → none match → "could not determine executable".  ### Harness  Claude Code  ### Install method  None  ### Operating system  macOS  ### ECC and harness versions  _No response_  ### Optional redacted diagnostics  _No response_
  **Post-Mortem & Fix Analysis**:
  > Are you running the command from inside the ECC repository?
  > Thanks for bringing this to our attention. The guided `npx ecc-universal setup` flow was intended for the 2.2.0 release and is not included in the current 2.1.0 npm package. We’ve opened #2767 to mark it as coming soon.  For now, please use Claude Code’s native install commands:  ``` /plugin marketplace add https://github.com/affaan-m/ECC /plugin install ecc@ecc ```  Sorry for the confusion, and thank you for reporting it!!
  > Thanks again for bringing this to our attention. The README correction is now merged in #2767: the native Claude plugin install is first, all currently working installation options come before the unreleased package commands, and the guided `npx` setup is clearly marked **Coming soon in release 2.2** at the bottom of the install area. We are leaving this issue open to track the actual 2.2 release.

- **Issue #2730** (2026-08-29): **Privacy: skill-comply runner.py persists operator's home path into written compliance reports**
  *Symptoms*: ## Summary  `skills/skill-comply/scripts/runner.py`'s `_parse_stream_json()` persists raw, unredacted tool-call data into the `ObservationEvent`s that `grade()` scores and `generate_report()` writes to `results/<skill>.md` — a report meant to be read, shared, and reviewed.  ```python input_str = (     json.dumps(tool_input)[:5000]     if isinstance(tool_input, dict)     else str(tool_input)[:5000] ) ```  `--add-dir` restricts the compliance-test agent's *additional* accessible directory to the sandbox (`SANDBOX_BASE = Path("/tmp/skill-comply-sandbox")`), but that doesn't stop the agent's own tool calls (a `Bash` command using `~` expansion, a scenario `setup_commands` entry referencing a dotfile, etc.) from emitting the operator's home directory into `tool_input`/`tool_response` content — which then lands verbatim, truncated but not sanitized, in the written report.  ## Why this is worth a real fix here (not just "don't run it on sensitive scenarios")  `skill-comply` is explicitly meant to test skills/rules against realistic prompts (`uv run python -m scripts.run ~/.claude/rules/common/testing.md`), and its own `SKILL.md` describes the reports as self-contained artifacts meant to be reviewed. A tool whose entire purpose is producing a shareable compliance report shouldn't require the operator to remember to scrub their own home path out of the output by hand.  ## Fix  Patch ready (traced and verified locally): a small `_redact_home_path()` helper (pure stdlib, `Path.home()`) 
  **Post-Mortem & Fix Analysis**:
  > Cross-ref: filed the sibling issue in agentic-stack (same shape — raw tool-call payload persisted into a durable, shareable artifact): https://github.com/codejunkie99/agentic-stack/issues/66
  > The redaction landed on main: skills/skill-comply/scripts/runner.py:126 defines _redact_home_path(), and _redact_home_paths() deep-walks dict keys and list leaves of the observation payload before serialization - matching the scoped approach proposed here. One residual edge worth a follow-up test: the pattern is built from str(Path.home()) alone, so a realpath'd home (macOS firmlink /System/Volumes/Data/Users/<name>) or a symlinked home still leaks verbatim. Cheap hardening:  ``` homes = {str(Path.home()), os.path.realpath(Path.home())} ```  The Windows case-insensitive handling already in place should apply to both variants. If you'd rather not patch this yourself, I take on short paid engagements for exactly this kind of fix.
  > The redaction landed on main: skills/skill-comply/scripts/runner.py:126 defines _redact_home_path(), and _redact_home_paths() deep-walks dict keys and list leaves of the observation payload before serialization - matching the scoped approach proposed in this thread. One residual edge worth a follow-up test: the pattern is built from str(Path.home()) alone, so a realpath'd home (macOS firmlink /System/Volumes/Data/Users/<name>) or a symlinked home still leaks verbatim. Cheap hardening:  ``` homes = {str(Path.home()), os.path.realpath(Path.home())} ```  The Windows case-insensitive handling already in place should apply to both variants. If you'd rather not patch this yourself, I take on short paid engagements for exactly this kind of fix.

- **Issue #2675** (2026-08-29): **gan-evaluator agent instructs Playwright MCP use but declares no MCP tools — live-app evaluation silently degrades on the /gan-build path**
  *Symptoms*: ## Summary  `agents/gan-evaluator.md` instructs the agent to drive the live application with Playwright MCP, but its own `tools:` frontmatter does not include any `mcp__playwright__*` entry. The agent therefore cannot do the one thing that distinguishes the GAN harness from ordinary code review: testing the **running** app.  This affects the `/gan-build` and `/gan-design` (Task-tool) path — the path most users take. It is the same class of gap noted as a footnote in #2674, but that issue covers `scripts/gan-harness.sh`; this one is the agent definitions, and the two are fixed in different places.  ## Evidence  `agents/gan-evaluator.md:4`  ```yaml tools: Read, Write, Bash, Grep, Glob ```  `agents/gan-evaluator.md:45-54` — the agent's own instructions:  ``` ### Step 2: Launch Browser Testing  # Use Playwright MCP to interact with the live app  # Navigate to the app playwright navigate http://localhost:${GAN_DEV_SERVER_PORT:-3000}  # Take initial screenshot playwright screenshot --name "initial-load" ```  The description field says the same: *"Tests the live running application via Playwright, scores against rubric…"*  And `commands/gan-build.md:10` defaults the mode to playwright:  ``` 5. `--eval-mode MODE` — (optional, default "playwright") one of: playwright, screenshot, code-only ```  So the default path asks for browser testing, the agent is told to perform browser testing, and the agent is not granted a browser tool.  ## Why this matters more than it looks  SKILL.md frames
  **Post-Mortem & Fix Analysis**:
  > Confirmed. The default /gan-build path asks for Playwright evaluation, but agents/gan-evaluator.md grants only Read, Write, Bash, Grep, and Glob. The evaluator can therefore produce a confident score after a silent static-analysis fallback.  I’ve marked this P1/churn separately from #2674 because the owner surface is the agent definition and evaluator result contract. The fix should both grant/verify the intended MCP tools and record the eval mode actually achieved; otherwise a missing MCP server will recreate the same silent degradation. 
  > Closing as resolved by the Playwright capability and achieved-mode changes incorporated through #2870. The evaluator now has the declared Playwright MCP tools and must report whether live evaluation ran or degraded.
  > Confirmed fixed on main: agents/gan-evaluator.md frontmatter now declares six mcp__playwright__* tools (browser_navigate, browser_click, browser_take_screenshot, browser_snapshot, browser_type, browser_fill_form), so the agent can actually drive the live app on the /gan-build path as its own instructions require. Closing as resolved is accurate. One residual suggestion: worth a one-pass audit across the other gan-* agent definitions to confirm none of them instruct tools they don't declare — that declare-what-you-invoke pattern is what prevented this silent degradation, and it only holds if every sibling follows it.

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `759d841b` (2026-09-29)
**Commit Message**: merge: preserve PR #3243 rollback redraw regression

**File**: `tests/lib/control-plane-view-ui.test.js` (modified, +10/-0)
```diff
@@ -539,11 +539,21 @@ let failures = 0;
       const eventsBefore = textOf(repaired.elements.get('events'));
       const lanesBefore = textOf(repaired.elements.get('lanes'));
       const markersBefore = markerShapes(repaired.context);
+      const logBeforeMalformed = repaired.context.log.length;
       await repaired.pollAgain();
       assert.strictEqual(textOf(repaired.elements.get('events')), eventsBefore, `${name}: retain previous events`);
       assert.strictEqual(textOf(repaired.elements.get('lanes')), lanesBefore, `${name}: retain previous lanes`);
       assert.strictEqual(repaired.elements.get('status').textContent, 'offline');
       const drawStart = repaired.context.log.length;
+      // When the malformed data fails after draw() started, the rollback
+      // redraws immediately, so the retained markers must be on the canvas
+      // before any resize. Checking only after resizeAgain() would pass even
+      // with the immediate redraw removed, since resize redraws the accepted
+      // view on its own.
+      if (name === 'drawing') {
+        assert.deepStrictEqual(markerShapes({ log: repaired.context.log.slice(logBeforeMalformed) }), markersBefore,
+          `${name}: the rollback must redraw the retained markers immediately`);
+      }
       assert.doesNotThrow(() => repaired.resizeAgain(), `${name}: resize must use the last accepted view`);
       assert.deepStrictEqual(markerShapes({ log: repaired.context.log.slice(drawStart) }), markersBefore);
       assert.match(repaired.labelOf('c'), /unavailable.*unknown/i);
```

---

### Incident Patch 2: `51a59a11` (2026-09-29)
**Commit Message**: test(gateguard): align spawned hook timeouts

**File**: `tests/hooks/gateguard-fact-force.test.js` (modified, +2/-2)
```diff
@@ -677,7 +677,7 @@ function runDdRegressionTests() {
         const input = { tool_name: 'Bash', tool_input: { command } };
         const result = spawnSync(process.execPath, [runner, 'pre:bash:gateguard-fact-force',
           'scripts/hooks/gateguard-fact-force.js', 'standard,strict'], {
-          input: JSON.stringify(input), encoding: 'utf8', timeout: 3000,
+          input: JSON.stringify(input), encoding: 'utf8', timeout: 15000,
           env: { ...process.env, ...environment }, stdio: ['pipe', 'pipe', 'pipe']
         });
         assert.ifError(result.error);
@@ -707,7 +707,7 @@ function runDdRegressionTests() {
       const result = spawnSync(process.execPath, [runner, 'pre:bash:gateguard-fact-force',
         'scripts/hooks/gateguard-fact-force.js', 'standard,strict'], {
         input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'dd if=input' } }),
-        encoding: 'utf8', timeout: 3000,
+        encoding: 'utf8', timeout: 15000,
         env: { ...process.env, ...environment, ECC_DISABLED_HOOKS: 'pre:bash:gateguard-fact-force' },
         stdio: ['pipe', 'pipe', 'pipe']
       });
```

---

### Incident Patch 3: `bd9402f7` (2026-09-29)
**Commit Message**: fix(hooks): scope MCP health checks to MCP tools (#2838)

Anchor the PreToolUse and PostToolUseFailure MCP health-check matchers so non-MCP tool calls do not spawn the health hook.

**File**: `hooks/hooks.json` (modified, +2/-2)
```diff
@@ -70,7 +70,7 @@
         ]
       },
       {
-        "matcher": ".*",
+        "matcher": "^mcp__",
         "hooks": [
           {
             "type": "command",
@@ -145,7 +145,7 @@
     ],
     "PostToolUseFailure": [
       {
-        "matcher": ".*",
+        "matcher": "^mcp__",
         "hooks": [
           {
             "type": "command",
```

**File**: `hooks/hooks.metadata.json` (modified, +2/-2)
```diff
@@ -40,7 +40,7 @@
       {
         "id": "pre:mcp-health-check",
         "description": "Check MCP server health before MCP tool execution and block unhealthy MCP calls",
-        "fingerprint": "922686364d01"
+        "fingerprint": "a68881c27a83"
       },
       {
         "id": "pre:edit-write:gateguard-fact-force",
@@ -83,7 +83,7 @@
       {
         "id": "post:mcp-health-check",
         "description": "Track failed MCP tool calls, mark unhealthy servers, and attempt reconnect",
-        "fingerprint": "9e25549c1229"
+        "fingerprint": "edbf5346288f"
       },
       {
         "id": "post:skill:track",
```

**File**: `tests/hooks/hooks.test.js` (modified, +25/-0)
```diff
@@ -2748,6 +2748,31 @@ async function runTests() {
     passed++;
   else failed++;
 
+  if (
+    test('MCP health-check hooks use anchored ^mcp__ matcher (no wildcard spawns)', () => {
+      const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
+      const hooks = readHooksConfig(hooksPath);
+
+      const preMcp = hooks.hooks.PreToolUse.filter(entry => JSON.stringify(entry).includes('pre:mcp-health-check'));
+      assert.strictEqual(preMcp.length, 1, 'Should define exactly one PreToolUse mcp-health-check entry');
+      assert.strictEqual(
+        preMcp[0].matcher,
+        '^mcp__',
+        `PreToolUse mcp-health-check matcher must be anchored '^mcp__' so it only spawns on genuine MCP tool names (got ${preMcp[0].matcher})`
+      );
+
+      const postMcp = hooks.hooks.PostToolUseFailure.filter(entry => JSON.stringify(entry).includes('post:mcp-health-check'));
+      assert.strictEqual(postMcp.length, 1, 'Should define exactly one PostToolUseFailure mcp-health-check entry');
+      assert.strictEqual(
+        postMcp[0].matcher,
+        '^mcp__',
+        `PostToolUseFailure mcp-health-check matcher must be anchored '^mcp__' so it only spawns on genuine MCP tool failures (got ${postMcp[0].matcher})`
+      );
+    })
+  )
+    passed++;
+  else failed++;
+
   if (
     test('hooks.json gives PowerShell dedicated GateGuard and governance routes', () => {
       const hooksPath = path.join(__dirname, '..', '..', 'hooks', 'hooks.json');
```

---

### Incident Patch 4: `7ffea709` (2026-09-28)
**Commit Message**: fix(hooks): distinguish Biome configs from results files

Preserve the original contributor histories and apply the exact independently reviewed repair.

Source-Parent: 74023e568908f528c9d9ae1a9bae501f4c1f2e38
Review-Manifest-SHA256: 208a6350119857df7c1e5b83a46cdba0b7f7399f58ed60167397920c7a21b454

**File**: `scripts/hooks/config-protection.js` (modified, +5/-4)
```diff
@@ -43,9 +43,12 @@ const PROTECTED_FILES = new Set([
   'prettier.config.js',
   'prettier.config.cjs',
   'prettier.config.mjs',
-  // Biome
+  // Biome's discovered filenames. Custom --config-path/extends targets need
+  // reference context; an arbitrary biome.* basename is not sufficient.
   'biome.json',
   'biome.jsonc',
+  '.biome.json',
+  '.biome.jsonc',
   // Ruff (Python)
   '.ruff.toml',
   'ruff.toml',
@@ -82,11 +85,9 @@ const PROTECTED_FILES = new Set([
  */
 const PROTECTED_PATTERNS = [
   // eslint.config.base.mjs, prettier.config.shared.cjs, stylelint.config.local.js ...
-  /^(eslint|prettier|stylelint|commitlint|oxlint|biome)\.config(\.[A-Za-z0-9_-]+)*\.(js|mjs|cjs|ts|mts|cts)$/i,
+  /^(eslint|prettier|stylelint|commitlint|oxlint)\.config(\.[A-Za-z0-9_-]+)*\.(js|mjs|cjs|ts|mts|cts)$/i,
   // .eslintrc.base.json, .prettierrc.shared.yml ...
   /^\.(eslintrc|prettierrc|stylelintrc|markdownlintrc)(\.[A-Za-z0-9_-]+)*\.(js|cjs|mjs|json|jsonc|yml|yaml|toml)$/i,
-  // biome.base.json, biome.shared.jsonc
-  /^biome(\.[A-Za-z0-9_-]+)*\.jsonc?$/i,
 ];
 
 function isProtectedName(basename) {
```

**File**: `tests/hooks/config-protection.test.js` (modified, +30/-2)
```diff
@@ -332,8 +332,8 @@ function runTests() {
         const names = [
           'eslint.config.base.mjs', 'prettier.config.shared.cjs', '.eslintrc.base.json', 'ESLint.Config.Base.MJS',
           'stylelint.config.local.ts', 'commitlint.config.shared.cts', 'oxlint.config.base.mts',
-          'biome.config.shared.js', '.prettierrc.shared.yml', '.stylelintrc.team.toml',
-          '.markdownlintrc.team.jsonc', 'biome.shared.jsonc', 'BIOME.Team.Base.JSON'
+          '.prettierrc.shared.yml', '.stylelintrc.team.toml',
+          '.markdownlintrc.team.jsonc'
         ];
         for (const name of names) {
           const absPath = path.join(tmpDir, name);
@@ -380,6 +380,34 @@ function runTests() {
     })
   );
 
+  results.push(
+    test('Biome filenames protect discovered configs without blocking ordinary result files', () => {
+      return withOwnedDirectory(fs.mkdtempSync(path.join(os.tmpdir(), 'ecc-config-protect-biome-')), tmpDir => {
+        // Arbitrary --config-path/extends targets need reference context; their
+        // basename alone does not prove that a file is Biome configuration.
+        const cases = [
+          ['biome.results.json', 0], ['biome.report.jsonc', 0],
+          ['biome.json', 2], ['biome.jsonc', 2], ['.biome.json', 2], ['.biome.jsonc', 2],
+          ['BIOME.JSON', 2], ['.BIOME.JSONC', 2],
+          ['biome.shared.jsonc', 0],
+          ['BIOME.Team.Base.JSON', 0], ['biome.config.shared.js', 0], ['biome.json.bak', 0],
+        ];
+        for (const [name, expected] of cases) {
+          const absPath = path.join(tmpDir, name);
+          const input = { tool_name: 'Write', tool_input: { file_path: absPath, content: '{}' } };
+          // Start each spelling independently on case-insensitive filesystems.
+          fs.rmSync(absPath, { force: true });
+          assert.strictEqual(runHook(input).code, 0, 'First creation should be allowed: ' + name);
+          fs.writeFileSync(absPath, '{}');
+          const result = runHook(input);
+          assert.strictEqual(result.code, expected, 'Unexpected filename classification: ' + name);
+          assert.strictEqual(result.stdout, '', 'No raw input should be echoed: ' + name);
+          assert.strictEqual(fs.readFileSync(absPath, 'utf8'), '{}', 'Hook must not modify the fixture');
+        }
+      });
+    })
+  );
+
   const passed = results.filter(result => result === 'passed').length;
   const failed = results.filter(result => result === 'failed').length;
   const skipped = results.filter(result => result === 'skipped').length;
```

---

### Incident Patch 5: `eca84624` (2026-09-28)
**Commit Message**: fix(hooks): track append assignments in Git override checks

Preserve the original contributor histories and apply the exact independently reviewed repair.

Source-Parent: dee884656eb5ed3bee0129d63fd762e146672a41
Review-Manifest-SHA256: 0c7eeef7c2722a605d049daf2dc3c2473c10dd616005afcba21049fc036d8ce9

**File**: `scripts/hooks/block-no-verify.js` (modified, +51/-24)
```diff
@@ -244,6 +244,19 @@ function checkGitWords(words, budget, start = 0, environmentOverride = false) {
   return null;
 }
 
+// Keep literal outcomes and the empty result of an unresolved expansion. The
+// latter is a base for later visible += operands, not arbitrary evaluation.
+function assignmentValues(prior, operand, append, dynamic, budget) {
+  const base = prior === undefined ? '' : prior;
+  budget.spend((append ? base.length : 0) + operand.length + 1);
+  const values = new Set([append ? base + operand : operand]);
+  if (dynamic) {
+    if (prior !== undefined) values.add(prior);
+    values.add(append ? base : '');
+  }
+  return [...values];
+}
+
 // Only explicit option grammars remove wrapper operands. Unknown launchers are
 // opaque/conservative, never guessed from a name found among data arguments.
 function executableWords(words, budget, inherited = new Map(), callerValues = inherited) {
@@ -262,25 +275,30 @@ function executableWords(words, budget, inherited = new Map(), callerValues = in
   function assignment(token) {
     const { value, dynamic } = token;
     const equals = value.indexOf('=');
-    const key = value.slice(0, equals);
+    const append = !environmentAssignments && value[equals - 1] === '+';
+    const key = value.slice(0, append ? equals - 1 : equals);
     if (/^GIT_CONFIG_(?:COUNT|PARAMETERS|(?:KEY|VALUE)_[0-9]+)$/.test(key)) {
-      const assigned = value.slice(equals + 1);
+      const operand = value.slice(equals + 1);
       const count = environments.length;
       budget.spend(count + 1);
       for (let n = 0; n < count; n++) {
         const environment = environments[n];
-        // Expansion precedes env's reset. Caller values remain separate from
-        // the child environment; keep both that possible value and the new
-        // literal spelling without interpreting expansion syntax.
-        if (dynamic && callerValues.has(key)) {
+        // Shell prefix appends can see local values, even when not exported.
+        // Repeated operands use the prior outcome in this same prefix.
+        const prior = prefixAssignments.has(key) && environment.has(key)
+          ? environment.get(key) : callerValues.get(key);
+        const values = assignmentValues(prior, operand, append, dynamic, budget);
+        for (const alternative of values.slice(1)) {
           budget.spend(environment.size + 1);
-          const prior = new Map(environment);
-          prior.set(key, callerValues.get(key));
-          environments.push(prior);
+          const variant = new Map(environment);
+          variant.set(key, alternative);
+          environments.push(variant);
         }
-        environment.set(key, assigned);
+        environment.set(key, values[0]);
       }
-      prefixAssignments.set(key, assigned);
+      // Retain ordered operations so same-shell states apply each append once.
+      if (!prefixAssignments.has(key)) prefixAssignments.set(key, []);
+      prefixAssignments.get(key).push({ value: operand, append, dynamic });
       if (dynamic) dynamicAssignments.add(key);
     }
   }
@@ -297,7 +315,7 @@ function executableWords(words, budget, inherited = new Map(), callerValues = in
   while (i < words.length) {
     const token = words[i];
     budget.spend(token.value.length + token.raw.length + 1);
-    if (assignments && /^[A-Za-z_][A-Za-z0-9_]*=/.test(environmentAssignments ? token.value : token.raw)) { assignment(token); i++; continue; }
+    if (assignments && /^[A-Za-z_][A-Za-z0-9_]*\+?=/.test(environmentAssignments ? token.value : token.raw)) { assignment(token); i++; continue; }
     if (!token.quoted && CONTROL_WORDS.has(token.value)) { i++; continue; }
     const name = basename(token.value);
     if (name === 'command') {
@@ -479,21 +497,30 @@ function updateShellState(state, normalized, budget) {
   const states = [state];
   const result = (handled, changed, uncertain = false) => ({ handled, changed, uncertain, states });
   if (!local) return result(false, false);
-  function assign(name, value, dynamic = false) {
+  function assign(name, value, dynamic = false, append = false) {
     const count = states.length;
     budget.spend(count + 1);
     for (let n = 0; n < count; n++) {
       const current = states[n];
       if (current.readonly.has(name)) continue;
-      // Preserve the known possible value AND the new literal spelling.
-      // Both alternatives subsequently receive the declaration attributes.
-      if (dynamic && current.variables.has(name)) states.push(copyShellState(current, budget));
-      current.variables.set(name, value);
+      const values = assignmentValues(current.variables.get(name), value, append, dynamic, budget);
+      for (const alternative of values.slice(1)) {
+        const variant = copyShellState(current, budget);
+        variant.variables.set(name, alternative);
+        states.push(variant);
+      }
+      current.variables.set(name, values[0]);
     }
   }
-  if (assignmentOnly) {
+  function a
```

**File**: `tests/hooks/block-no-verify.test.js` (modified, +132/-1)
```diff
@@ -1812,7 +1812,138 @@ const stickyEnvironmentCases = Object.freeze([
   ["readonly print flag assignment prevents later reset", 2, "export GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; readonly -p GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; unset GIT_CONFIG_PARAMETERS; git commit"],
   ["readonly print flag safe Git control", 0, "readonly -p GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git status"]
 ]);
-for (const [family, expected, command] of stickyEnvironmentCases) {
+// Append assignments are shell syntax before a command or in declarations.
+// env's NAME+=VALUE is a different, literal variable name, not shell append.
+const appendEnvironmentCases = [
+  ['prefix from unset', 'GIT_CONFIG_PARAMETERS+="\'core.hooksPath=/dev/null\'"'],
+  ['export from unset', 'export GIT_CONFIG_PARAMETERS+="\'core.hooksPath=/dev/null\'";'],
+  ['declare from unset', 'declare -x GIT_CONFIG_PARAMETERS+="\'core.hooksPath=/dev/null\'";'],
+  ['typeset from unset', 'typeset -x GIT_CONFIG_PARAMETERS+="\'core.hooksPath=/dev/null\'";'],
+  ['standalone then export', 'GIT_CONFIG_PARAMETERS+="\'core.hooksPath=/dev/null\'"; export GIT_CONFIG_PARAMETERS;'],
+  ['append to exported safe parameters', 'export GIT_CONFIG_PARAMETERS="\'color.ui=false\'"; GIT_CONFIG_PARAMETERS+=" \'core.hooksPath=/dev/null\'";'],
+  ['append split declaration', 'export GIT_CONFIG_PARAMETERS="\'core.hooks"; export GIT_CONFIG_PARAMETERS+="Path=/dev/null\'";'],
+  ['append split standalone', 'GIT_CONFIG_PARAMETERS="\'core.hooks"; GIT_CONFIG_PARAMETERS+="Path=/dev/null\'"; export GIT_CONFIG_PARAMETERS;'],
+  ['append split prefix from local', 'GIT_CONFIG_PARAMETERS="\'core.hooks"; GIT_CONFIG_PARAMETERS+="Path=/dev/null\'"'],
+  ['multiple prefix operands', 'GIT_CONFIG_PARAMETERS="\'core.hooks" GIT_CONFIG_PARAMETERS+="Path=/dev/null\'"'],
+  ['count triplet prefix', 'GIT_CONFIG_COUNT+=1 GIT_CONFIG_KEY_0+=core.hooksPath GIT_CONFIG_VALUE_0+=/dev/null'],
+  ['count triplet declaration', 'export GIT_CONFIG_COUNT+=1 GIT_CONFIG_KEY_0+=core.hooksPath GIT_CONFIG_VALUE_0+=/dev/null;'],
+  ['split key declaration', 'export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core. GIT_CONFIG_VALUE_0=/dev/null; declare -x GIT_CONFIG_KEY_0+=hooksPath;'],
+  ['split key prefix', 'GIT_CONFIG_KEY_0=core.; GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0+=hooksPath GIT_CONFIG_VALUE_0=/dev/null'],
+  ['conditional append possible', 'false && export GIT_CONFIG_PARAMETERS+="\'core.hooksPath=/dev/null\'";'],
+  ['append cannot erase prior unknown-value alternative', 'export GIT_CONFIG_PARAMETERS="\'core.hooksPath=/dev/null\'"; GIT_CONFIG_PARAMETERS+="$UNKNOWN";'],
+  ['dynamic prefix cannot erase prior alternative', 'export GIT_CONFIG_PARAMETERS="\'core.hooksPath=/dev/null\'"; GIT_CONFIG_PARAMETERS+="$UNKNOWN"'],
+  ['dynamic declaration retains new literal operand', 'export GIT_CONFIG_PARAMETERS=""; export GIT_CONFIG_PARAMETERS+="\'core.hooksPath=/dev/null\'$UNKNOWN";'],
+  ['dynamic prefix retains new literal operand', 'GIT_CONFIG_PARAMETERS+="\'core.hooksPath=/dev/null\'$UNKNOWN"'],
+];
+const appendCases = [];
+for (const [family, setup] of appendEnvironmentCases) {
+  appendCases.push([`append ${family}`, 2, `${setup} git commit`]);
+  appendCases.push([`append ${family} safe Git control`, 0, `${setup} git status`]);
+}
+appendCases.push(
+  ['unexported append stays local', 0, 'GIT_CONFIG_PARAMETERS+="\'core.hooksPath=/dev/null\'"; git commit'],
+  ['export attribute removal remains effective', 0, 'export GIT_CONFIG_PARAMETERS+="\'core.hooksPath=/dev/null\'"; export -n GIT_CONFIG_PARAMETERS; git commit'],
+  ['explicit unset removes appended state', 0, 'export GIT_CONFIG_PARAMETERS+="\'core.hooksPath=/dev/null\'"; unset GIT_CONFIG_PARAMETERS; git commit'],
+  ['child environment reset removes appended state', 0, 'export GIT_CONFIG_PARAMETERS+="\'core.hooksPath=/dev/null\'"; env -i git commit'],
+  ['env append-like name is literal data', 0, 'env GIT_CONFIG_PARAMETERS+="\'core.hooksPath=/dev/null\'" git commit'],
+  ['env append-like name after reset is literal data', 0, 'export GIT_CONFIG_PARAMETERS="\'core.hooksPath=/dev/null\'"; env -i GIT_CONFIG_PARAMETERS+= git commit'],
+  ['env literal name does not reset real exported key', 2, 'export GIT_CONFIG_PARAMETERS="\'core.hooksPath=/dev/null\'"; env GIT_CONFIG_PARAMETERS+= git commit'],
+  ['quoted shell assignment name stays data', 0, '"GIT_CONFIG_PARAMETERS+=\'core.hooksPath=/dev/null\'" git commit'],
+  ['readonly safe value cannot acquire appended override', 0, 'declare -rx GIT_CONFIG_PARAMETERS=""; GIT_CONFIG_PARAMETERS+="\'core.hooksPath=/dev/null\'"; git commit'],
+  ['readonly unsafe value cannot lose override through append', 2, 'export GIT_CONFIG_PARAMETERS="\'core.hooksPath=/dev/null\'"; readonly GIT_CONFIG_PARAMETERS; GIT_CONFIG_PARAMETERS+="x"; git commit'],
+  ['ordinary append parameters do not disable hooks', 0, 'export GIT_CONFIG_PARAMETERS="\'color.ui="; GIT_CONFIG_PARAMETERS+="false\'"; git commit'],
+  ['
```

---

### Incident Patch 6: `dee88465` (2026-09-28)
**Commit Message**: fix(hooks): preserve Git configuration across shell command scopes

Preserve contributor history while applying the exact reviewed current-main repair.

Source-PR: https://github.com/affaan-m/ECC/pull/2965
Source-Parent: ec0753bc7f6a986d36a36367cd89f6ad125c4bac
Review-Manifest-SHA256: 0172e3e695e672305f9bc41b0d385d2a299d8ec520c763dd9d7f6da743f76971

**File**: `scripts/hooks/block-no-verify.js` (modified, +258/-34)
```diff
@@ -173,8 +173,8 @@ function isGitExecutable(value) {
   return name === 'git' || name === 'git.exe';
 }
 
-// Only explicit command-scoped assignments are tracked. No host environment,
-// exported shell state, arbitrary expansion or external configuration is read.
+// Only literal values from this supplied shell task are tracked. No host
+// environment, arbitrary expansion or external configuration is read.
 function gitEnvironmentOverride(environment, budget) {
   const count = environment.get('GIT_CONFIG_COUNT') || '';
   budget.spend(count.length + environment.size + 1);
@@ -246,51 +246,90 @@ function checkGitWords(words, budget, start = 0, environmentOverride = false) {
 
 // Only explicit option grammars remove wrapper operands. Unknown launchers are
 // opaque/conservative, never guessed from a name found among data arguments.
-function executableWords(words, budget, inherited = new Map()) {
+function executableWords(words, budget, inherited = new Map(), callerValues = inherited) {
   budget.spend(inherited.size + 1);
-  const environment = new Map(inherited);
+  const environments = [new Map(inherited)];
+  const prefixAssignments = new Map();
+  let local = true;
+  let assignmentOnly = true;
+  const dynamicAssignments = new Set();
+  function result(values) { return { words: values, environments, prefixAssignments, local, assignmentOnly, dynamicAssignments }; }
   function suffix(start) {
     budget.spend(words.length - start);
-    return { words: words.slice(start), environment };
+    assignmentOnly = false;
+    return result(words.slice(start));
   }
-  function assignment(value) {
+  function assignment(token) {
+    const { value, dynamic } = token;
     const equals = value.indexOf('=');
     const key = value.slice(0, equals);
-    if (/^GIT_CONFIG_(?:COUNT|PARAMETERS|(?:KEY|VALUE)_[0-9]+)$/.test(key)) environment.set(key, value.slice(equals + 1));
+    if (/^GIT_CONFIG_(?:COUNT|PARAMETERS|(?:KEY|VALUE)_[0-9]+)$/.test(key)) {
+      const assigned = value.slice(equals + 1);
+      const count = environments.length;
+      budget.spend(count + 1);
+      for (let n = 0; n < count; n++) {
+        const environment = environments[n];
+        // Expansion precedes env's reset. Caller values remain separate from
+        // the child environment; keep both that possible value and the new
+        // literal spelling without interpreting expansion syntax.
+        if (dynamic && callerValues.has(key)) {
+          budget.spend(environment.size + 1);
+          const prior = new Map(environment);
+          prior.set(key, callerValues.get(key));
+          environments.push(prior);
+        }
+        environment.set(key, assigned);
+      }
+      prefixAssignments.set(key, assigned);
+      if (dynamic) dynamicAssignments.add(key);
+    }
+  }
+  function resetEnvironment(name) {
+    budget.spend(environments.length + 1);
+    for (const environment of environments) {
+      if (name === undefined) environment.clear();
+      else environment.delete(name);
+    }
   }
   let i = 0;
   let assignments = true;
   let environmentAssignments = false;
   while (i < words.length) {
     const token = words[i];
     budget.spend(token.value.length + token.raw.length + 1);
-    if (assignments && /^[A-Za-z_][A-Za-z0-9_]*=/.test(environmentAssignments ? token.value : token.raw)) { assignment(token.value); i++; continue; }
+    if (assignments && /^[A-Za-z_][A-Za-z0-9_]*=/.test(environmentAssignments ? token.value : token.raw)) { assignment(token); i++; continue; }
     if (!token.quoted && CONTROL_WORDS.has(token.value)) { i++; continue; }
     const name = basename(token.value);
     if (name === 'command') {
+      assignmentOnly = false;
+      local &&= token.value === 'command';
       i++;
       while (words[i]?.value.startsWith('-')) {
         const flag = words[i++].value;
         budget.spend(flag.length + 1);
         if (flag === '--') break;
-        if (/^-[pvV]+$/.test(flag) && /[vV]/.test(flag)) return { words: [], environment };
+        if (/^-[pvV]+$/.test(flag) && /[vV]/.test(flag)) return result([]);
         if (!/^-p+$/.test(flag)) return suffix(i - 1);
       }
       assignments = false; continue;
     }
     if (name === 'exec') {
+      assignmentOnly = false;
+      local = false;
       i++;
       while (words[i]?.value.startsWith('-')) {
         const flag = words[i++].value;
         budget.spend(flag.length + 1);
         if (flag === '--') break;
         if (/^-[cl]*a$/.test(flag)) i++;
         else if (!/^-([cl]*a.+|[cl]+)$/.test(flag)) return suffix(i - 1);
-        if (flag.slice(1).split('a', 1)[0].includes('c')) environment.clear();
+        if (flag.slice(1).split('a', 1)[0].includes('c')) resetEnvironment();
       }
       assignments = false; continue;
     }
     if (name === 'env' || name === 'sudo' || name === 'doas') {
+      assignmentOnly = false;
+      local = false;
       const env = name === 'env';
       const values = env
         ? ne
```

**File**: `scripts/hooks/lib/shell-scan.js` (modified, +53/-12)
```diff
@@ -247,13 +247,16 @@ function scanShell(input, budget) {
   const commands = [];
   const nested = [];
   const pendingHeredocs = [];
-  let current = { words: [], redirects: [], pipeFrom: null };
+  const rootScope = { parent: null, isolated: false, conditional: false };
+  let scope = rootScope;
+  const command = pipeFrom => ({ words: [], redirects: [], pipeFrom, nested: [], scope });
+  let current = command(null);
   let word = null;
   let quote = null;
   let pendingRedirect = null;
   let i = 0;
   function begin() {
-    if (!word) word = { value: '', start: i, end: i, quoted: false, literal: true };
+    if (!word) word = { value: '', start: i, end: i, quoted: false, literal: true, dynamic: false };
   }
   function flushWord() {
     if (!word) return;
@@ -262,24 +265,35 @@ function scanShell(input, budget) {
     if (pendingRedirect) {
       const redirect = { operator: pendingRedirect, word, body: '' };
       current.redirects.push(redirect);
-      if (pendingRedirect === '<<' || pendingRedirect === '<<-') pendingHeredocs.push(redirect);
+      if (pendingRedirect === '<<' || pendingRedirect === '<<-') pendingHeredocs.push({ redirect, owner: current });
       pendingRedirect = null;
     } else current.words.push(word);
     word = null;
   }
-  function flushCommand(pipe = false) {
+  function flushCommand(pipe = false, background = false) {
     flushWord();
     const previous = current;
+    previous.pipeTo = pipe;
+    previous.background = background;
+    if (previous.closedScope && (pipe || background)) {
+      previous.closedScope.isolated = true;
+      previous.closedScope.pipelineLast = false;
+    }
+    const first = previous.words[0];
+    if (first && !first.quoted && ['if', 'then', 'elif', 'else', 'while', 'until', 'do', 'case', 'for', 'select', 'function'].includes(first.value)) scope.conditional = true;
     if (previous.words.length || previous.redirects.length) commands.push(previous);
-    current = { words: [], redirects: [], pipeFrom: pipe ? previous : null };
+    current = command(pipe ? previous : null);
     pendingRedirect = null;
   }
   function consumeHeredocs() {
-    for (const redirect of pendingHeredocs) {
+    for (const { redirect, owner } of pendingHeredocs) {
       const region = heredocBody(input, i, redirect, budget);
       redirect.body = region.body;
       i = region.end;
-      if (!redirect.word.quoted) nested.push(...scanExpansions(redirect.body, budget));
+      if (!redirect.word.quoted) {
+        const regions = scanExpansions(redirect.body, budget);
+        for (const text of regions) { budget.spend(); nested.push(text); owner.nested.push(text); }
+      }
     }
     pendingHeredocs.length = 0;
   }
@@ -307,9 +321,14 @@ function scanShell(input, budget) {
       word.value += next; i += 2; continue;
     }
     if (hasExpansion(input, i, quote === null)) {
-      begin(); word.literal = false;
+      begin(); word.literal = false; word.dynamic = true;
       const region = executionRegion(input, i, budget);
-      nested.push(region.text); word.value += '\u0000'; i = region.end; continue;
+      nested.push(region.text); current.nested.push(region.text); word.value += '\u0000'; i = region.end; continue;
+    }
+    // Parameter expansions remain opaque values. Escaped/single/ANSI-C
+    // quoted dollars have already been consumed as data above.
+    if (c === '$' && /[A-Za-z0-9_@*#?$!{-]/.test(input[i + 1] || '')) {
+      begin(); word.dynamic = true;
     }
     if (quote === '"') {
       if (c === '"') quote = null;
@@ -329,7 +348,29 @@ function scanShell(input, budget) {
     const braceKeyword = (c === '{' || c === '}') && !word && current.words.length === 0 && /[\s;&|]/.test(input[i + 1] || ' ');
     if (c === '\n' || c === ';' || c === '&' || c === '|' || c === '(' || c === ')' || braceKeyword) {
       const pipe = c === '|' && input[i + 1] !== '|';
-      flushCommand(pipe);
+      const background = c === '&' && input[i + 1] !== '&';
+      if ((c === '&' || c === '|') && input[i + 1] === c) scope.conditional = true;
+      const incomingPipe = Boolean(current.pipeFrom);
+      if (c === '(') {
+        flushWord();
+        // A function definition does not execute its body. Function grammar
+        // is unsupported: keep pre-definition alternatives instead of using
+        // flattened body mutations to certify a later command as safe.
+        if (current.words.length === 1 && !current.words[0].quoted &&
+            /^[A-Za-z_][A-Za-z0-9_]*$/.test(current.words[0].value)) scope.conditional = true;
+      }
+      flushCommand(pipe, background);
+      if (c === '(' || (braceKeyword && c === '{')) {
+        scope = { parent: scope, isolated: c === '(' || incomingPipe, conditional: false, pipelineLast: c === '{' && incomingPipe };
+        current.scope = scope;
+      } else if ((c === ')' || (braceKeyword && c === '}')) && scope.parent) {
+        const closedScope = scope;
+        scope = scope.parent;
+      
```

**File**: `tests/hooks/block-no-verify.test.js` (modified, +618/-1)
```diff
@@ -545,6 +545,21 @@ function countedClassification(command, quota) {
   const context = vm.createContext({});
   vm.runInContext(`
     globalThis.copiedElements = 0;
+    globalThis.copiedStateEntries = 0;
+    const NativeMap = Map;
+    const NativeSet = Set;
+    globalThis.Map = class extends NativeMap {
+      constructor(entries) {
+        super();
+        if (entries) for (const [key, value] of entries) { globalThis.copiedStateEntries++; super.set(key, value); }
+      }
+    };
+    globalThis.Set = class extends NativeSet {
+      constructor(entries) {
+        super();
+        if (entries) for (const value of entries) { globalThis.copiedStateEntries++; super.add(value); }
+      }
+    };
     const originalSlice = Array.prototype.slice;
     Array.prototype.slice = function(start = 0, end = this.length) {
       const a = start < 0 ? Math.max(0, this.length + start) : Math.min(this.length, start);
@@ -586,7 +601,8 @@ function countedClassification(command, quota) {
     assert.strictEqual(name, './lib/shell-scan');
     return instrumentedLexer;
   });
-  return { result: hookModule.exports.run(command), copiedElements: context.copiedElements, spent, valueReads };
+  const result = hookModule.exports.run(command);
+  return { result, copiedElements: context.copiedElements, copiedStateEntries: context.copiedStateEntries, spent, valueReads };
 }
 for (const n of [64, 128]) {
   if (test(`opaque Git candidates avoid quadratic suffix copies at ${n}`, () => {
@@ -1215,6 +1231,607 @@ for (const [family, expected, command] of reviewFollowupCases) {
   })) passed++; else failed++;
 }
 
+
+// Literal shell-state propagation; witness text is never executed. Pipeline-last
+// and conditional state changes are conservative alternatives, not flow proofs.
+const stickyEnvironmentCases = Object.freeze([
+  [
+    "literal exported parameter",
+    2,
+    "export GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git commit -m x"
+  ],
+  [
+    "exported ordinary Git control",
+    0,
+    "export GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git status"
+  ],
+  [
+    "literal exported parameter",
+    2,
+    "declare -x GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git commit -m x"
+  ],
+  [
+    "exported ordinary Git control",
+    0,
+    "declare -x GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git status"
+  ],
+  [
+    "literal exported parameter",
+    2,
+    "typeset -x GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git commit -m x"
+  ],
+  [
+    "exported ordinary Git control",
+    0,
+    "typeset -x GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git status"
+  ],
+  [
+    "literal exported parameter",
+    2,
+    "declare -gx GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git commit -m x"
+  ],
+  [
+    "exported ordinary Git control",
+    0,
+    "declare -gx GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git status"
+  ],
+  [
+    "literal exported parameter",
+    2,
+    "typeset -gx GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git commit -m x"
+  ],
+  [
+    "exported ordinary Git control",
+    0,
+    "typeset -gx GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git status"
+  ],
+  [
+    "literal exported parameter",
+    2,
+    "export -- GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git commit -m x"
+  ],
+  [
+    "exported ordinary Git control",
+    0,
+    "export -- GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git status"
+  ],
+  [
+    "sticky export order",
+    2,
+    "GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; export GIT_CONFIG_PARAMETERS; git commit"
+  ],
+  [
+    "sticky export order",
+    2,
+    "export GIT_CONFIG_PARAMETERS; GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git commit"
+  ],
+  [
+    "sticky export order",
+    2,
+    "export GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"\ngit push"
+  ],
+  [
+    "sticky export order",
+    2,
+    "export GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; GIT_CONFIG_PARAMETERS=''; GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git am patches"
+  ],
+  [
+    "sticky export order",
+    2,
+    "export GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; readonly GIT_CONFIG_PARAMETERS; git merge main"
+  ],
+  [
+    "sticky export order",
+    2,
+    "export GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; command git rebase main"
+  ],
+  [
+    "sticky export order",
+    2,
+    "export GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; env -i git status; git commit"
+  ],
+  [
+    "sticky export order",
+    2,
+    "export GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; env -u GIT_CONFIG_PARAMETERS git status; git commit"
+  ],
+  [
+    "literal variable/export boundary",
+    0,
+    "GIT_CONFIG_PARAMETERS=\"'core.hooksPath=/dev/null'\"; git commit"
+  ],
+  [
+    "literal variable/export boundary",
+    0,
+    "declare GIT_CONFIG_PARAMETERS=\"'core.ho
```

---

### Incident Patch 7: `e7d69ac9` (2026-09-28)
**Commit Message**: Merge reviewed PR2879 missing-declaration regression correction

Source-PR: https://github.com/affaan-m/ECC/pull/2879
Review-Manifest-SHA256: d561b12170431bc2f5ec9baa80548a656fca9e55b4bb6b11bd756be4e6cab199

**File**: `tests/ci/locale-agent-frontmatter.test.js` (modified, +3/-3)
```diff
@@ -138,7 +138,7 @@ function main() {
         const fields = frontmatter(filePath);
         if (!fields) continue;
         const want = canonical.get(file).model;
-        if (want !== undefined && fields.model !== undefined && fields.model !== want) {
+        if (want !== undefined && fields.model !== want) {
           drift.push(`${rel(filePath)}: ${fields.model} != ${want}`);
         }
       }
@@ -156,9 +156,9 @@ function main() {
         if (!fields) continue;
         const want = toolSet(canonical.get(file).tools);
         const have = toolSet(fields.tools);
-        if (want === null || have === null) continue;
+        if (want === null) continue;
         if (!sameSet(want, have)) {
-          drift.push(`${rel(filePath)}: [${[...have]}] != [${[...want]}]`);
+          drift.push(`${rel(filePath)}: ${have === null ? '<missing>' : `[${[...have]}]`} != [${[...want]}]`);
         }
       }
       assert.deepStrictEqual(
```

---

### Incident Patch 8: `de5119dc` (2026-09-28)
**Commit Message**: fix(locale): reject missing canonical agent declarations

Preserve contributor history while applying the exact reviewed current-main repair.

Source-PR: https://github.com/affaan-m/ECC/pull/2879
Source-Parent: cc9914ce772a82449dacbfe3f12a493f14a9424a
Review-Manifest-SHA256: d561b12170431bc2f5ec9baa80548a656fca9e55b4bb6b11bd756be4e6cab199

**File**: `tests/ci/locale-agent-frontmatter.test.js` (modified, +3/-3)
```diff
@@ -138,7 +138,7 @@ function main() {
         const fields = frontmatter(filePath);
         if (!fields) continue;
         const want = canonical.get(file).model;
-        if (want !== undefined && fields.model !== undefined && fields.model !== want) {
+        if (want !== undefined && fields.model !== want) {
           drift.push(`${rel(filePath)}: ${fields.model} != ${want}`);
         }
       }
@@ -156,9 +156,9 @@ function main() {
         if (!fields) continue;
         const want = toolSet(canonical.get(file).tools);
         const have = toolSet(fields.tools);
-        if (want === null || have === null) continue;
+        if (want === null) continue;
         if (!sameSet(want, have)) {
-          drift.push(`${rel(filePath)}: [${[...have]}] != [${[...want]}]`);
+          drift.push(`${rel(filePath)}: ${have === null ? '<missing>' : `[${[...have]}]`} != [${[...want]}]`);
         }
       }
       assert.deepStrictEqual(
```

---

### Incident Patch 9: `74023e56` (2026-09-28)
**Commit Message**: fix(config-protection): protect qualified shared linter configurations

Preserve contributor history while applying the exact reviewed current-main repair.

Source-PR: https://github.com/affaan-m/ECC/pull/2835
Source-Parent: e58bb26647793ed05c6e3b7d55d7fad63d556b4d
Integration-Main: d3b8a3e908904e242ed2dbe66af62cca71131419
Review-Manifest-SHA256: 2b591ee5fc545e0d552a58dd6f473f196ca773a194c33b87359f5c0447187e26

**File**: `.adal/README.md` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+# ECC for AdaL CLI
+
+This directory contains the ECC (Everything Claude Code) configuration for the AdaL CLI harness.
+
+## What is installed
+
+- `rules/` — shared coding rules and guidelines
+- `skills/` — reusable skills
+- `commands/` — slash commands
+- `AGENTS.md` — agent instructions
+
+## Manual install
+
+```bash
+bash ./install.sh --target adal --profile minimal
+```
+
+## Notes
+
+- The `adal` target installs into the project-level `./.adal/` directory.
+- AdaL's own config (`~/.adal/settings.json`, MCP servers, plugins) is **not** touched by ECC install.
+- Use `npx ecc-universal doctor --target adal` to check install health.
+- use an installed
```

**File**: `.agents/plugins/marketplace.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   "plugins": [
     {
       "name": "ecc",
-      "version": "2.2.0",
+      "version": "2.2.2",
       "source": {
         "source": "local",
         "path": "./"
```

**File**: `.agents/skills/agent-introspection-debugging/SKILL.md` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 ---
 name: agent-introspection-debugging
 description: Structured self-debugging workflow for AI agent failures using capture, diagnosis, contained recovery, and introspection reports. Use when an agent run fails and you need a reproducible diagnosis instead of a retry.
+license: MIT
 ---
 
 # Agent Introspection Debugging
```

**File**: `.agents/skills/agent-sort/SKILL.md` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 ---
 name: agent-sort
 description: Build an evidence-backed ECC install plan for a specific repo by sorting skills, commands, rules, hooks, and extras into DAILY vs LIBRARY buckets using parallel repo-aware review passes. Use when ECC should be trimmed to what a project actually needs instead of loading the full bundle.
+license: MIT
 ---
 
 # Agent Sort
```

**File**: `.agents/skills/api-design/SKILL.md` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 ---
 name: api-design
 description: REST API design patterns including resource naming, status codes, pagination, filtering, error responses, versioning, and rate limiting for production APIs. Use when designing or reviewing REST endpoints, resource names, status codes, pagination, or versioning.
+license: MIT
 ---
 
 # API Design Patterns
```

**File**: `.agents/skills/article-writing/SKILL.md` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 ---
 name: article-writing
 description: Write articles, guides, blog posts, tutorials, newsletter issues, and other long-form content in a distinctive voice derived from supplied examples or brand guidance. Use when the user wants polished written content longer than a paragraph, especially when voice consistency, structure, and credibility matter.
+license: MIT
 ---
 
 # Article Writing
```

**File**: `.agents/skills/backend-patterns/SKILL.md` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 ---
 name: backend-patterns
 description: Backend architecture patterns, API design, database optimization, and server-side best practices for Node.js, Express, and Next.js API routes. Use when building or reviewing Node.js, Express, or Next.js API routes and their data access.
+license: MIT
 ---
 
 # Backend Development Patterns
```

**File**: `.agents/skills/benchmark-methodology/SKILL.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ description: >-
   visual craft, offer packaging, evidence, enterprise-readiness, thought
   leadership, pricing, client's strategic tension) with explicit 1–5 rubrics
   and a tension-plot. Precedes competitive-report-structure.
+license: MIT
 ---
 
 # Benchmark Methodology
```

---

### Incident Patch 10: `339db5b0` (2026-09-28)
**Commit Message**: fix(config-protection): guard current config and ignore filenames

Preserve contributor history while applying the exact reviewed current-main repair.

Source-PR: https://github.com/affaan-m/ECC/pull/2845
Source-Parent: e19e74a7fc3513017bbc227c3be73933eaa3a11e
Integration-Main: d3b8a3e908904e242ed2dbe66af62cca71131419
Review-Manifest-SHA256: 02ef909e8553e93554ec8fb615b9299fd3ee6a0d7dc250ee2375ce80ce538060

**File**: `.adal/README.md` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+# ECC for AdaL CLI
+
+This directory contains the ECC (Everything Claude Code) configuration for the AdaL CLI harness.
+
+## What is installed
+
+- `rules/` — shared coding rules and guidelines
+- `skills/` — reusable skills
+- `commands/` — slash commands
+- `AGENTS.md` — agent instructions
+
+## Manual install
+
+```bash
+bash ./install.sh --target adal --profile minimal
+```
+
+## Notes
+
+- The `adal` target installs into the project-level `./.adal/` directory.
+- AdaL's own config (`~/.adal/settings.json`, MCP servers, plugins) is **not** touched by ECC install.
+- Use `npx ecc-universal doctor --target adal` to check install health.
+- use an installed
```

**File**: `.agents/plugins/marketplace.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   "plugins": [
     {
       "name": "ecc",
-      "version": "2.2.0",
+      "version": "2.2.2",
       "source": {
         "source": "local",
         "path": "./"
```

**File**: `.agents/skills/agent-introspection-debugging/SKILL.md` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 ---
 name: agent-introspection-debugging
 description: Structured self-debugging workflow for AI agent failures using capture, diagnosis, contained recovery, and introspection reports. Use when an agent run fails and you need a reproducible diagnosis instead of a retry.
+license: MIT
 ---
 
 # Agent Introspection Debugging
```

**File**: `.agents/skills/agent-sort/SKILL.md` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 ---
 name: agent-sort
 description: Build an evidence-backed ECC install plan for a specific repo by sorting skills, commands, rules, hooks, and extras into DAILY vs LIBRARY buckets using parallel repo-aware review passes. Use when ECC should be trimmed to what a project actually needs instead of loading the full bundle.
+license: MIT
 ---
 
 # Agent Sort
```

**File**: `.agents/skills/api-design/SKILL.md` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 ---
 name: api-design
 description: REST API design patterns including resource naming, status codes, pagination, filtering, error responses, versioning, and rate limiting for production APIs. Use when designing or reviewing REST endpoints, resource names, status codes, pagination, or versioning.
+license: MIT
 ---
 
 # API Design Patterns
```

**File**: `.agents/skills/article-writing/SKILL.md` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 ---
 name: article-writing
 description: Write articles, guides, blog posts, tutorials, newsletter issues, and other long-form content in a distinctive voice derived from supplied examples or brand guidance. Use when the user wants polished written content longer than a paragraph, especially when voice consistency, structure, and credibility matter.
+license: MIT
 ---
 
 # Article Writing
```

**File**: `.agents/skills/backend-patterns/SKILL.md` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 ---
 name: backend-patterns
 description: Backend architecture patterns, API design, database optimization, and server-side best practices for Node.js, Express, and Next.js API routes. Use when building or reviewing Node.js, Express, or Next.js API routes and their data access.
+license: MIT
 ---
 
 # Backend Development Patterns
```

**File**: `.agents/skills/benchmark-methodology/SKILL.md` (modified, +1/-0)
```diff
@@ -6,6 +6,7 @@ description: >-
   visual craft, offer packaging, evidence, enterprise-readiness, thought
   leadership, pricing, client's strategic tension) with explicit 1–5 rubrics
   and a tension-plot. Precedes competitive-report-structure.
+license: MIT
 ---
 
 # Benchmark Methodology
```

---

### Incident Patch 11: `9886c333` (2026-09-28)
**Commit Message**: fix(batch): preserve Plan Canvas cleanup on every failure path

Source-PR: https://github.com/affaan-m/ECC/pull/3241
Source-Commit: 63f30ffc366b0ee4dea73ea4f96625176370dda9
Reviewed-Manifest-SHA256: efb1271980b7e706b4ee237320ca86e8515e6012dce0802af36ec12dbdebc7a4

**File**: `tests/scripts/plan-canvas.test.js` (modified, +547/-365)
```diff
@@ -21,6 +21,11 @@ const { createPlanCanvasServer } = require('../../scripts/lib/plan-canvas/server
 
 class SkippedTest extends Error {}
 
+function failureText(error) {
+  try { return error?.stack || error?.message || String(error); }
+  catch { return 'Unprintable thrown value'; }
+}
+
 function createTestRunner(log = console.log) {
   let results = { passed: 0, failed: 0, skipped: 0 };
   return {
@@ -36,7 +41,7 @@ function createTestRunner(log = console.log) {
           log(`  SKIP ${name}: ${error.message}`);
         } else {
           results = { ...results, failed: results.failed + 1 };
-          log(`  FAIL ${name}\n    Error: ${error.stack || error.message}`);
+          log(`  FAIL ${name}\n    Error: ${failureText(error)}`);
         }
       }
     }
@@ -102,6 +107,42 @@ async function withFixtureCleanup(callback, cleanups) {
   return result;
 }
 
+// Explicit close and finally cleanup await the same attempt, including failure.
+function onceCleanup(cleanup) {
+  let pending;
+  return () => {
+    if (!pending) pending = Promise.resolve().then(cleanup);
+    return pending;
+  };
+}
+
+async function withResourceScope(callback) {
+  const clients = [];
+  const servers = [];
+  const roots = [];
+  const own = (group, cleanup) => {
+    const close = onceCleanup(cleanup);
+    group.push(close);
+    return close;
+  };
+  const resources = {
+    client: cleanup => own(clients, cleanup),
+    server: cleanup => own(servers, cleanup),
+    root: cleanup => own(roots, cleanup),
+  };
+  return withFixtureCleanup(() => callback(resources), () => [...clients, ...servers, ...roots]);
+}
+
+// Requests are owned before setup writes or awaits. Destroy the response and
+// request independently so one cleanup failure cannot leave the other open.
+function ownHttpClient(req, getResponse, resources) {
+  const cleanup = () => withFixtureCleanup(() => {}, () => {
+    const response = getResponse();
+    return [...(response ? [() => response.destroy()] : []), () => req.destroy()];
+  });
+  return resources ? resources.client(cleanup) : onceCleanup(cleanup);
+}
+
 // Capture fresh real dispatchers without binding sockets. Each request captures
 // its own filesystem facade; the fixture owns those canvases until teardown.
 // Artifact bodies are inert response bytes, never executed in a browser.
@@ -673,10 +714,13 @@ async function fixtureIsolationTests(test) {
   }
 }
 
-function request(port, method, requestPath, { body = null, headers = {} } = {}) {
-  return new Promise((resolve, reject) => {
+function request(port, method, requestPath, {
+  body = null, headers = {}, resources, transport = http, onData = () => {}
+} = {}) {
+  let response;
+  const pending = new Promise((resolve, reject) => {
     const payload = body === null ? null : JSON.stringify(body);
-    const req = http.request(
+    const req = transport.request(
       {
         host: '127.0.0.1',
         port,
@@ -688,31 +732,41 @@ function request(port, method, requestPath, { body = null, headers = {} } = {})
           : headers
       },
       res => {
+        response = res;
+        res.on('error', reject);
         let data = '';
         res.on('data', chunk => {
           data += chunk;
+          onData(chunk);
         });
         res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
       }
     );
+    ownHttpClient(req, () => response, resources);
     req.on('error', reject);
     if (payload) req.write(payload);
     req.end();
   });
+  // Cleanup can reject an abandoned long-poll; awaiters still see this rejection.
+  pending.catch(() => {});
+  return pending;
 }
 
 function jsonBody(res) {
   return JSON.parse(res.body.trim());
 }
 
 // Open an SSE stream and collect parsed events into `received`.
-function openSse(port, key) {
+function openSse(port, key, { resources, transport = http } = {}) {
   const received = [];
   let close = () => {};
+  let response;
   const ready = new Promise((resolve, reject) => {
-    const req = http.get(
+    const req = transport.get(
       { host: '127.0.0.1', port, path: `/events/${key}`, agent: false },
       res => {
+        response = res;
+        res.on('error', reject);
         let buffer = '';
         res.on('data', chunk => {
           buffer += chunk;
@@ -730,9 +784,10 @@ function openSse(port, key) {
         resolve();
       }
     );
+    close = ownHttpClient(req, () => response, resources);
     req.on('error', reject);
-    close = () => req.destroy();
   });
+  ready.catch(() => {});
   return { received, ready, close: () => close() };
 }
 
@@ -751,6 +806,128 @@ function waitFor(predicate, { timeoutMs = 3000, intervalMs = 20 } = {}) {
   });
 }
 
+// Deterministic ownership checks: no socket/listener or shared module mutation.
+async function integrationCleanupTests(test) {
+  async function capture(callback) {
+    try { return { threw: false, value: await callback() }; }
+    catch (error) { return { t
```

---

### Incident Patch 12: `2b9164c0` (2026-09-28)
**Commit Message**: fix(gateguard): inspect SQL clients behind supported launchers

Preserve contributor history while applying the exact reviewed current-main repair.

Source-PR: https://github.com/affaan-m/ECC/pull/2829
Source-Parent: c4b18b452da394ea1ab0ffda749f6e00e2175ceb
Review-Manifest-SHA256: 16b9e4c854b6cfc38efc99d0913fe7f3018a68b9b1c194b50f4a1e06511975cd

**File**: `scripts/hooks/gateguard-fact-force.js` (modified, +2/-2)
```diff
@@ -545,7 +545,7 @@ function wrapperValueOption(arg, valueFlags) {
   return null;
 }
 
-// Explicit external-launcher argv grammars for dd and shell-wrapper discovery.
+// Explicit external-launcher argv grammars for dd, SQL clients and shell-wrapper discovery.
 // Unknown flags do not justify guessing which later argument executes.
 // This literal allowlist cannot prove arbitrary custom-wrapper semantics or
 // resolve dynamically selected executables; quoted operand text stays data.
@@ -777,7 +777,7 @@ function unwrapLeadWrappers(tokens, allowShellBuiltins = true, allowDdLaunchers
  */
 function isDestructiveSqlClient(tokens) {
   if (!tokens || tokens.length === 0) return false;
-  const argv = unwrapLeadWrappers(tokens);
+  const argv = unwrapLeadWrappers(tokens, true, true);
   if (!SQL_CLIENT_COMMANDS.has(commandBasename(argv[0]))) return false;
   return DESTRUCTIVE_SQL.test(stripSqlLiterals(argv.join(' ')));
 }
```

**File**: `tests/hooks/gateguard-fact-force.test.js` (modified, +47/-0)
```diff
@@ -602,6 +602,53 @@ function runDdRegressionTests() {
   ];
   try {
     hook = loadDirectHook();
+    // Launcher operands stay data; only the resolved SQL client consumes SQL.
+    const wrappedSqlDestructive = [
+      'timeout 5 psql -c "drop table users"',
+      'time psql -c "truncate audit_log"',
+      '/usr/bin/time -f "%E" psql -c "drop table users"',
+      '/usr/bin/time -q --output-file timing.log mysql -e "delete from sessions"',
+      'nice -n 5 mariadb -e "delete from sessions"',
+      'nohup sqlite3 fixture.db "drop table users"',
+      'stdbuf -oL psql -c "truncate audit_log"',
+      'ionice -c 2 -n 4 psql -c "drop table users"',
+      'setsid -w sqlcmd -Q "drop table users"',
+      'xargs -r -n 1 psql -c "drop table users"',
+      "env -S 'timeout 5 psql' -c 'drop table users'",
+      'timeout 5 nice -n 1 nohup psql -c "drop table users"',
+      'time -p command -- psql -c "truncate audit_log"',
+      "timeout 5 sh -c 'psql -c \"drop table users\"'"
+    ];
+    const wrappedSqlPassive = [
+      'timeout 5 echo "psql -c drop table users"',
+      'time -p printf "%s" "truncate audit_log"',
+      '/usr/bin/time -f "psql drop table" echo ok',
+      '/usr/bin/time -o psql echo "drop table users"',
+      'nice -n psql echo "drop table users"',
+      'ionice -c psql echo "drop table users"',
+      'stdbuf -o psql echo "drop table users"',
+      'xargs -I psql echo "drop table users"',
+      'xargs -E psql echo "drop table users"',
+      'setsid --help psql -c "drop table users"',
+      'ionice -p 123 psql -c "drop table users"',
+      '/usr/bin/time --help psql -c "drop table users"',
+      '/usr/bin/time --version psql -c "drop table users"',
+      'command -v psql "drop table users"',
+      'timeout 5 psql -c "SELECT \'drop table\' AS label"',
+      "time '-p' psql -c 'drop table users'",
+      'env time command psql -c "drop table users"',
+      'echo "timeout 5 psql -c drop table users"'
+    ];
+    for (const [commands, expected] of [
+      [wrappedSqlDestructive, ['gateguard.bash-compatible-destructive']],
+      [wrappedSqlPassive, []]
+    ]) {
+      for (const command of commands) {
+        check(`SQL launcher classification: ${JSON.stringify(command)}`, () => {
+          assert.deepStrictEqual(hook.classifyDestructiveCommand('Bash', command), expected);
+        });
+      }
+    }
     for (const command of destructive) {
       check(`dd/preservation destructive: ${JSON.stringify(command)}`, () => {
         assert.deepStrictEqual(hook.classifyDestructiveCommand('Bash', command), [
```

---

### Incident Patch 13: `ec0753bc` (2026-09-28)
**Commit Message**: fix(hooks): preserve shell boundaries and detect literal hook bypasses

Preserve contributor history while applying the exact reviewed current-main repair.

Source-PR: https://github.com/affaan-m/ECC/pull/2965
Source-Parent: de480c65fdbbdf8b0b6ffce0f16c0968791c5fbd
Review-Manifest-SHA256: 53ead3eb859a4c6c13d6751b1fe4f9a94f1a5d35a37430f6b8524c50e903490b

**File**: `scripts/hooks/block-no-verify.js` (modified, +94/-33)
```diff
@@ -159,28 +159,68 @@ function isNoVerifyLongFlag(value) {
 }
 
 const PROTECTED_GIT_COMMANDS = new Set(['commit', 'push', 'merge', 'cherry-pick', 'rebase', 'am']);
-const GIT_GLOBAL_VALUES = new Set(['-c', '-C', '--work-tree', '--git-dir', '--namespace', '--super-prefix']);
+const GIT_GLOBAL_VALUES = new Set(['-c', '-C', '--config-env', '--work-tree', '--git-dir', '--namespace', '--super-prefix']);
 const SHELLS = new Set(['sh', 'bash', 'dash', 'zsh', 'ksh']);
-const DATA_COMMANDS = new Set(['echo', 'printf', 'cat', 'grep', 'head', 'tail', 'wc', 'sort', 'uniq', ':', 'true', 'false']);
+const DATA_COMMANDS = new Set(['echo', 'printf', 'cat', 'tee', 'grep', 'head', 'tail', 'wc', 'sort', 'uniq', ':', 'true', 'false']);
 const CONTROL_WORDS = new Set(['!', 'if', 'then', 'elif', 'while', 'until', 'do', 'else']);
 
 function basename(value) {
   return value.replace(/\\/g, '/').split('/').pop();
 }
 
-function checkGitWords(words, budget, start = 0) {
+function isGitExecutable(value) {
+  const name = basename(value).toLowerCase();
+  return name === 'git' || name === 'git.exe';
+}
+
+// Only explicit command-scoped assignments are tracked. No host environment,
+// exported shell state, arbitrary expansion or external configuration is read.
+function gitEnvironmentOverride(environment, budget) {
+  const count = environment.get('GIT_CONFIG_COUNT') || '';
+  budget.spend(count.length + environment.size + 1);
+  // Git uses strtoul: leading ASCII whitespace/+ are accepted, trailing bytes
+  // and counts above INT_MAX are rejected. Bound work by assignments we own.
+  const configured = /^[ \t\r\n\v\f]*\+?[0-9]+(?![\s\S])/.test(count) ? Number(count) : 0;
+  if (configured > 0 && configured <= 0x7fffffff && configured <= environment.size / 2) {
+    let override = false;
+    let complete = true;
+    for (let i = 0; i < configured; i++) {
+      budget.spend();
+      const key = environment.get(`GIT_CONFIG_KEY_${i}`);
+      if (key === undefined || !environment.has(`GIT_CONFIG_VALUE_${i}`)) { complete = false; break; }
+      budget.spend(key.length + 1);
+      override ||= key.toLowerCase() === 'core.hookspath';
+    }
+    if (complete && override) return true;
+  }
+  const parameters = environment.get('GIT_CONFIG_PARAMETERS');
+  if (parameters) {
+    budget.spend(parameters.length + 1);
+    // Git's old 'key=value' and new 'key'='value' forms both use quote removal.
+    // This inspects literal keys only; nested regions are never executed.
+    for (const command of scanShell(parameters, budget).commands) {
+      for (const word of command.words) {
+        budget.spend(word.value.length + 1);
+        if (word.value.toLowerCase().startsWith(GIT_CONFIG_KEY_PREFIX)) return true;
+      }
+    }
+  }
+  return false;
+}
+
+function checkGitWords(words, budget, start = 0, environmentOverride = false) {
   let index = start + 1;
-  let override = false;
+  let override = environmentOverride;
   for (; index < words.length; index++) {
     const value = words[index].value;
     budget.spend(value.length + 1);
     if (!value.startsWith('-')) break;
     if (value === '--') { index++; break; }
-    if (value === '-c') {
+    if (value === '-c' || value === '--config-env') {
       const setting = words[index + 1]?.value || '';
       budget.spend(setting.length + 1);
       override ||= setting.toLowerCase().startsWith(GIT_CONFIG_KEY_PREFIX);
-    } else if (value.toLowerCase().startsWith(`-c${GIT_CONFIG_KEY_PREFIX}`)) override = true;
+    } else if (value.toLowerCase().startsWith(`-c${GIT_CONFIG_KEY_PREFIX}`) || value.toLowerCase().startsWith(`--config-env=${GIT_CONFIG_KEY_PREFIX}`)) override = true;
     if (GIT_GLOBAL_VALUES.has(value)) index++;
   }
   const command = words[index]?.value;
@@ -206,18 +246,25 @@ function checkGitWords(words, budget, start = 0) {
 
 // Only explicit option grammars remove wrapper operands. Unknown launchers are
 // opaque/conservative, never guessed from a name found among data arguments.
-function executableWords(words, budget) {
+function executableWords(words, budget, inherited = new Map()) {
+  budget.spend(inherited.size + 1);
+  const environment = new Map(inherited);
   function suffix(start) {
     budget.spend(words.length - start);
-    return words.slice(start);
+    return { words: words.slice(start), environment };
+  }
+  function assignment(value) {
+    const equals = value.indexOf('=');
+    const key = value.slice(0, equals);
+    if (/^GIT_CONFIG_(?:COUNT|PARAMETERS|(?:KEY|VALUE)_[0-9]+)$/.test(key)) environment.set(key, value.slice(equals + 1));
   }
   let i = 0;
   let assignments = true;
   let environmentAssignments = false;
   while (i < words.length) {
     const token = words[i];
     budget.spend(token.value.length + token.raw.length + 1);
-    if (assignments && /^[A-Za-z_][A-Za-z0-9_]*=/.test(environmentAssignments ? token.value : token.raw)) { i++; continue; }
+    if (assignments && /^[A-Za-z_][A-Za-z0-9_]*=/.test(environmentAssignments ? t
```

**File**: `scripts/hooks/lib/shell-scan.js` (modified, +15/-5)
```diff
@@ -151,7 +151,8 @@ function executionRegion(input, start, budget) {
     budget.spend();
     const state = stack[stack.length - 1];
     const c = input[i];
-    if (state.quote === "'") {
+    if (state.quote === "'" || state.quote === "$'") {
+      if (state.quote === "$'" && c === '\\' && i + 1 < input.length) { i++; continue; }
       if (c === "'") state.quote = null;
       continue;
     }
@@ -167,6 +168,9 @@ function executionRegion(input, start, budget) {
       if (c === '"') state.quote = null;
       continue;
     }
+    if (c === '$' && input[i + 1] === "'") {
+      state.quote = "$'"; state.word += "$'"; state.quotedWord = true; i++; continue;
+    }
     if (c === '"' || c === "'") { state.quote = c; state.word += c; state.quotedWord = true; continue; }
     if (c === '#' && /[\s;|&()]/.test(input[i - 1] || ' ')) {
       while (i < input.length && input[i] !== '\n') { budget.spend(); i++; }
@@ -282,7 +286,13 @@ function scanShell(input, budget) {
   while (i < input.length) {
     budget.spend();
     const c = input[i];
-    if (quote === "'") {
+    if (quote === "'" || quote === "$'") {
+      if (quote === "$'" && c === '\\' && i + 1 < input.length) {
+        const next = input[i + 1];
+        // Preserve boundaries without claiming general ANSI-C escape expansion.
+        word.value += next === "'" || next === '\\' ? next : c + next;
+        i += 2; continue;
+      }
       if (c === "'") quote = null;
       else word.value += c;
       i++; continue;
@@ -307,9 +317,9 @@ function scanShell(input, budget) {
       i++; continue;
     }
     if (c === '$' && input[i + 1] === "'") {
-      // Literal ANSI-C words without escape interpretation; escaped/generated
-      // names are not claimed to be a complete expansion implementation.
-      begin(); word.quoted = true; quote = "'"; i += 2; continue;
+      // ANSI-C escaped quotes do not close the word; its contents never expand.
+      // Numeric/control escapes and generated names remain outside this grammar.
+      begin(); word.quoted = true; quote = "$'"; i += 2; continue;
     }
     if (c === '"' || c === "'") { begin(); word.quoted = true; quote = c; i++; continue; }
     if (c === '#' && !word) {
```

**File**: `tests/hooks/block-no-verify.test.js` (modified, +514/-0)
```diff
@@ -701,6 +701,520 @@ for (const shell of ['sh', 'dash', 'ksh']) {
   }
 }
 
+
+// Review-followup witnesses remain inert strings passed only to the classifier.
+const reviewFollowupCases = [
+  [
+    "transformed executable pipeline",
+    2,
+    "printf '%s' x | sed 's/x/git push --no-verify/' | bash"
+  ],
+  [
+    "transformed executable pipeline",
+    2,
+    "printf '%s' x | sed 's/x/git commit -n/' | sh"
+  ],
+  [
+    "transformed executable pipeline",
+    2,
+    "printf '%s' x | sed 's|x|GIT push --no-verify|' | env bash -s"
+  ],
+  [
+    "transformed executable pipeline",
+    2,
+    "printf '%s' x | sed 's/x/git push --no-verify/' | tee file | bash"
+  ],
+  [
+    "transformed executable pipeline",
+    2,
+    "echo \"$(printf '%s' x | sed 's/x/git push --no-verify/' | bash)\""
+  ],
+  [
+    "transformed executable pipeline",
+    0,
+    "printf '%s' x | sed 's/x/git push --no-verify/'"
+  ],
+  [
+    "transformed executable pipeline",
+    0,
+    "printf '%s' x | sed 's/x/git push --no-verify/' | tee file"
+  ],
+  [
+    "transformed executable pipeline",
+    0,
+    "printf '%s' x | sed 's/x/echo safe/' | bash"
+  ],
+  [
+    "transformed executable pipeline",
+    0,
+    "printf '%s' x | sed 's/x/git status/' | bash"
+  ],
+  [
+    "transformed executable pipeline",
+    0,
+    "printf '%s' x | sed 's/x/git push --no-verify/' | bash script.sh"
+  ],
+  [
+    "transformed executable pipeline",
+    0,
+    "printf '%s' x | sed 's/x/git push --no-verify/' | bash -c 'echo safe'"
+  ],
+  [
+    "tee data versus executable sink",
+    0,
+    "tee file <<'EOF'\ngit push --no-verify\nEOF"
+  ],
+  [
+    "tee data versus executable sink",
+    0,
+    "tee -a file <<EOF\ngit push --no-verify\nEOF"
+  ],
+  [
+    "tee data versus executable sink",
+    0,
+    "tee file <<'EOF'\n$(git push --no-verify)\nEOF"
+  ],
+  [
+    "tee data versus executable sink",
+    2,
+    "tee file <<EOF\n$(git push --no-verify)\nEOF"
+  ],
+  [
+    "tee data versus executable sink",
+    2,
+    "tee file <<'EOF' | bash\ngit push --no-verify\nEOF"
+  ],
+  [
+    "tee data versus executable sink",
+    2,
+    "tee file <<'EOF' | cat | sh -s\ngit push --no-verify\nEOF"
+  ],
+  [
+    "tee data versus executable sink",
+    0,
+    "tee file <<'EOF' | cat\ngit push --no-verify\nEOF"
+  ],
+  [
+    "tee data versus executable sink",
+    0,
+    "tee file <<'EOF' | bash -c 'echo safe'\ngit push --no-verify\nEOF"
+  ],
+  [
+    "Git basename case",
+    2,
+    "GIT commit -n -m x"
+  ],
+  [
+    "Git basename case",
+    2,
+    "GIT push --no-verify"
+  ],
+  [
+    "Git basename case",
+    0,
+    "GIT status"
+  ],
+  [
+    "Git basename case",
+    0,
+    "GIT commit -m \"git push --no-verify\""
+  ],
+  [
+    "Git basename case",
+    2,
+    "Git commit -n -m x"
+  ],
+  [
+    "Git basename case",
+    2,
+    "Git push --no-verify"
+  ],
+  [
+    "Git basename case",
+    0,
+    "Git status"
+  ],
+  [
+    "Git basename case",
+    0,
+    "Git commit -m \"git push --no-verify\""
+  ],
+  [
+    "Git basename case",
+    2,
+    "git.EXE commit -n -m x"
+  ],
+  [
+    "Git basename case",
+    2,
+    "git.EXE push --no-verify"
+  ],
+  [
+    "Git basename case",
+    0,
+    "git.EXE status"
+  ],
+  [
+    "Git basename case",
+    0,
+    "git.EXE commit -m \"git push --no-verify\""
+  ],
+  [
+    "Git basename case",
+    2,
+    "/opt/bin/GiT commit -n -m x"
+  ],
+  [
+    "Git basename case",
+    2,
+    "/opt/bin/GiT push --no-verify"
+  ],
+  [
+    "Git basename case",
+    0,
+    "/opt/bin/GiT status"
+  ],
+  [
+    "Git basename case",
+    0,
+    "/opt/bin/GiT commit -m \"git push --no-verify\""
+  ],
+  [
+    "Git basename case",
+    2,
+    "\"C:\\\\tools\\\\git.EXE\" commit -n -m x"
+  ],
+  [
+    "Git basename case",
+    2,
+    "\"C:\\\\tools\\\\git.EXE\" push --no-verify"
+  ],
+  [
+    "Git basename case",
+    0,
+    "\"C:\\\\tools\\\\git.EXE\" status"
+  ],
+  [
+    "Git basename case",
+    0,
+    "\"C:\\\\tools\\\\git.EXE\" commit -m \"git push --no-verify\""
+  ],
+  [
+    "opaque Git basename case",
+    2,
+    "unknown 'GIT push --no-verify'"
+  ],
+  [
+    "passive Git basename case",
+    0,
+    "echo 'GIT push --no-verify'"
+  ],
+  [
+    "Git config-env",
+    2,
+    "HP=/dev/null git --config-env=core.hooksPath=HP commit -m x"
+  ],
+  [
+    "Git config-env",
+    2,
+    "git --config-env=CORE.HOOKSPATH=HP push origin main"
+  ],
+  [
+    "Git config-env",
+    2,
+    "git --config-env core.hooksPath=HP commit -m x"
+  ],
+  [
+    "Git config-env",
+    0,
+    "git --config-env=color.ui=COLOR commit -m x"
+  ],
+  [
+    "Git config-env",
+    0,
+    "git --config-env=core.hooksPath=HP status"
+  ],
+  [
+    "Git config-env",
+    0,
+    "git commit -m \"--config-env=core.hooksPath=HP\""
+  ],
+  [
+    "Git config-env",
+    0,
+    "echo 'HP=/dev/null git --config-env=core.hooksPath=HP commit'"
+  ],
+  [
+    
```

---

### Incident Patch 14: `46df9ccc` (2026-09-28)
**Commit Message**: fix(install): preserve inactive user configs and recheck consent before completion

Preserve contributor history while applying the exact reviewed current-main repair.

Source-PR: https://github.com/affaan-m/ECC/pull/3008
Source-Parent: 615b7f107a21b67532944f3f321c61dd282060c3
Review-Manifest-SHA256: dcec1e51ab4e14305f1daf1f020cf1d1f4f990137a5941b17ab4d9a0db108b2c

**File**: `scripts/lib/install-lifecycle.js` (modified, +26/-9)
```diff
@@ -1598,11 +1598,21 @@ function analyzeRecord(record, context) {
     };
   }
 
+  let planningFailureReported = false;
   if (record.adapter.target === 'opencode') {
+    let checks;
     try {
-      preflightOpenCodeHookDeactivation(record, context, { requireInactive: true });
+      checks = prepareOpenCodeHookDeactivationChecks(record, context, { requireInactive: true });
     } catch (error) {
-      issues.push(buildIssue('error', 'opencode-hook-consent-violation', error.message));
+      planningFailureReported = true;
+      issues.push(buildIssue('error', 'resolution-unavailable', error.message));
+    }
+    if (checks) {
+      try {
+        for (const check of checks) assertOpenCodeRepairHookDeactivation(check.plan, check.options);
+      } catch (error) {
+        issues.push(buildIssue('error', 'opencode-hook-consent-violation', error.message));
+      }
     }
   }
 
@@ -1708,7 +1718,7 @@ function analyzeRecord(record, context) {
     issues.push(buildIssue('warning', 'repo-version-mismatch', `Recorded repo version ${state.source.repoVersion} differs from current repo version ${context.packageVersion}`));
   }
 
-  if (!state.request.legacyMode) {
+  if (!state.request.legacyMode && !planningFailureReported) {
     try {
       const desiredPlan = resolveRecordedManifestPlan(record, context);
 
@@ -1939,9 +1949,9 @@ function assertOpenCodeRepairHookDeactivation(plan, options = {}) {
   return assertOpenCodeHookDeactivationReady(plan, options);
 }
 
-function preflightOpenCodeHookDeactivation(record, context, options = {}) {
+function prepareOpenCodeHookDeactivationChecks(record, context, options = {}) {
   if (record.adapter.target !== 'opencode') {
-    return;
+    return [];
   }
   const rawPlan = createRepairPlanFromRecord(record, context, {
     // Planning must reject unsafe existing activations before a repair build
@@ -1964,12 +1974,19 @@ function preflightOpenCodeHookDeactivation(record, context, options = {}) {
     // Migration does not replay operations into the old root. Inspect existing
     // activations there, without treating historical merge-json records as new
     // writes; the canonical destination is validated separately below.
-    assertOpenCodeRepairHookDeactivation({ ...legacyPlan, operations: [] }, { allowVerifiedLegacyRemoval: true });
-    assertOpenCodeRepairHookDeactivation(rawPlan, options);
-    return;
+    return [
+      { plan: { ...legacyPlan, operations: [] }, options: { allowVerifiedLegacyRemoval: true } },
+      { plan: rawPlan, options },
+    ];
   }
   const { plan } = prepareRepairMigration(rawPlan, record);
-  assertOpenCodeRepairHookDeactivation(plan, options);
+  return [{ plan, options }];
+}
+
+function preflightOpenCodeHookDeactivation(record, context, options = {}) {
+  for (const check of prepareOpenCodeHookDeactivationChecks(record, context, options)) {
+    assertOpenCodeRepairHookDeactivation(check.plan, check.options);
+  }
 }
 
 function repairInstalledStates(options = {}) {
```

**File**: `scripts/lib/install/apply.js` (modified, +4/-2)
```diff
@@ -497,8 +497,8 @@ function assertOpenCodeHookDeactivationReady(plan, options = {}) {
       }
       continue;
     }
-    if (inactive && (kind === 'plugin' || options.allowVerifiedLegacyRemoval)) continue;
     const recorded = previous.get(key);
+    if (inactive && (kind === 'plugin' || options.allowVerifiedLegacyRemoval || !recorded)) continue;
     if (options.allowVerifiedLegacyRemoval && recorded) {
       const verified = verifyManagedLegacyFile(recorded, {
         targetRoot: plan.targetRoot, installStatePath: plan.installStatePath,
@@ -918,7 +918,9 @@ function applyInstallPlanLocked(plan, dependencies = {}, settingsLockHeld = fals
         );
       }
 
-      assertOpenCodeHookDeactivationReady(appliedPlan, { requireInactive: true });
+      // Include preserved user configs omitted from the write plan: they must
+      // still be inactive before we record a completed install.
+      assertOpenCodeHookDeactivationReady(plan, { requireInactive: true });
       finalState = stateWithContentDigests(migration.finalState, appliedPlan);
       if (typeof beforeInstallStateWrite === 'function') {
         beforeInstallStateWrite({ plan: appliedPlan, state: finalState });
```

**File**: `tests/lib/opencode-hook-consent-safety.test.js` (modified, +120/-0)
```diff
@@ -294,6 +294,66 @@ function runTests() {
     assert.strictEqual(fs.existsSync(`${value.installStatePath}.ecc.lock`), false);
   }));
   for (const consent of [null, 'declined']) {
+    for (const plugin of [undefined, ['user-plugin']]) {
+      test(`fresh ${consent || 'default'} apply preserves inactive user config ${JSON.stringify(plugin)}`, () => fixture(value => {
+        fs.unlinkSync(value.installStatePath);
+        fs.unlinkSync(path.join(value.targetRoot, 'plugins/ecc-hooks.ts'));
+        const destination = path.join(value.targetRoot, 'opencode.json');
+        const content = `${JSON.stringify({ userSetting: 'keep formatting', plugin }, null, 4)}\n`;
+        fs.writeFileSync(destination, content);
+        const result = applyInstallPlan(withHookConsent(value.basePlan, consent));
+        assert.strictEqual(result.applied, true);
+        assert.strictEqual(fs.readFileSync(destination, 'utf8'), content);
+        assert.ok(result.warnings.includes(`Skipped user-owned file ${destination}: the existing file is not recorded in ECC install-state.`));
+        assert.ok(result.skippedOperations.some(operation => operation.destinationPath === destination));
+        for (const operations of [result.operations, readInstallState(value.installStatePath).operations]) {
+          assert.ok(!operations.some(operation => operation.destinationPath === destination), 'Do not adopt a user config');
+        }
+        assert.strictEqual(fs.readFileSync(path.join(value.targetRoot, 'plugins/ecc-hooks.ts'), 'utf8'),
+          'export default async () => ({});\n');
+        assert.strictEqual(fs.existsSync(`${value.installStatePath}.ecc.lock`), false);
+      }));
+    }
+    test(`fresh ${consent || 'default'} apply still refuses active unrecorded config`, () => fixture(value => {
+      fs.unlinkSync(value.installStatePath);
+      fs.unlinkSync(path.join(value.targetRoot, 'plugins/ecc-hooks.ts'));
+      const destination = path.join(value.targetRoot, 'opencode.json');
+      const content = fs.readFileSync(destination);
+      assert.throws(() => applyInstallPlan(withHookConsent(value.basePlan, consent)), /Refusing OpenCode hook deactivation/);
+      assert.deepStrictEqual(fs.readFileSync(destination), content);
+      assert.strictEqual(fs.existsSync(path.join(value.targetRoot, 'plugins/ecc-hooks.ts')), false);
+      assert.strictEqual(fs.existsSync(value.installStatePath), false);
+      assert.strictEqual(fs.existsSync(`${value.installStatePath}.ecc.lock`), false);
+    }));
+    test(`fresh ${consent || 'default'} apply rechecks skipped user config after writes`, () => fixture(value => {
+      fs.unlinkSync(value.installStatePath);
+      const plugin = path.join(value.targetRoot, 'plugins/ecc-hooks.ts');
+      fs.unlinkSync(plugin);
+      const destination = path.join(value.targetRoot, 'opencode.json');
+      fs.writeFileSync(destination, '{"userSetting":"initially inactive"}\n');
+      const activated = '{"plugin":["./plugins"],"userSetting":"late edit"}\n';
+      let injected = false;
+      const stateWritePhases = [];
+      assert.throws(() => applyInstallPlan(withHookConsent(value.basePlan, consent), {
+        beforeInstallStateWrite() { stateWritePhases.push(injected); },
+        beforeOperationWrite({ operation }) {
+          if (operation.destinationPath === plugin) {
+            injected = true;
+            fs.writeFileSync(destination, activated);
+          }
+        },
+      }), /OpenCode hook activation remains active/);
+      assert.ok(injected, 'Exercise the write boundary after preserving the inactive config');
+      assert.strictEqual(fs.readFileSync(destination, 'utf8'), activated);
+      assert.ok(!stateWritePhases.includes(true), 'Do not reach final state persistence');
+      // A retryable bridge may record the inert plugin already written, but
+      // must never adopt the preserved user config after this refusal.
+      const checkpoint = readInstallState(value.installStatePath);
+      assert.deepStrictEqual(checkpoint.operations.map(operation => operation.destinationPath), [plugin]);
+      assert.strictEqual(fs.readFileSync(plugin, 'utf8'), 'export default async () => ({});\n');
+      assert.strictEqual(checkpoint.operations[0].contentSha256, sha256(fs.readFileSync(plugin)));
+      assert.strictEqual(fs.existsSync(`${value.installStatePath}.ecc.lock`), false);
+    }));
     test(`fresh ${consent || 'default'} apply preserves unrelated unrecorded plugin aliases`, () => fixture(value => {
       fs.unlinkSync(value.installStatePath);
       for (const operation of value.basePlan.operations) fs.unlinkSync(operation.destinationPath);
@@ -310,6 +370,66 @@ function runTests() {
       }
     }));
   }
+  for (const missingDigest of [false, true]) {
+    test(`apply refuses inactive managed config with ${missingDigest ? 'missing digest' : 'changed bytes'}`, () => fixture(value => {
+      const destination = path.join(value.targetRoot, 'opencode.json');
+   
```

---

### Incident Patch 15: `13b3c598` (2026-09-28)
**Commit Message**: test(observer): dispatch status through a fixed private wrapper

Preserve contributor history while applying the exact reviewed current-main repair.

Source-PR: https://github.com/affaan-m/ECC/pull/2878
Source-Parent: 57da51c74bc6ae27f8dfdeb5e61128dc7e4d3905
Review-Manifest-SHA256: a9ff9a500e307cc9031349f086a0d754c3c72fddf999bb97dfbc9c6d7a7b04bd

**File**: `tests/skills/observer-status-instinct-count.test.js` (modified, +39/-4)
```diff
@@ -95,8 +95,10 @@ function runStatus(files, { run = spawnSync, setup = () => {}, remove = fs.rmSyn
     // Only this foreground shell's own PID is advertised. No observer, sleep,
     // provider or other background child is started or signalled.
     const program = 'printf "%s\\n" "$$" > "$CLV2_HOMUNCULUS_DIR/.observer.pid"\nexec "$BASH" "$1" status';
-    const result = run(bashBinary, ['--noprofile', '--norc', '-c', program,
-      'observer-status-test', toShellPath(observerScript)], {
+    const wrapper = path.join(fixture.root, 'status-wrapper.sh');
+    fs.writeFileSync(wrapper, `${program}\n`, { flag: 'wx', mode: 0o600 });
+    const result = run(bashBinary, ['--noprofile', '--norc', toShellPath(wrapper),
+      toShellPath(observerScript)], {
       cwd: fixture.root, encoding: 'utf8', env: fixture.env,
       timeout: childTimeoutMs, maxBuffer: childMaxBuffer, killSignal: 'SIGKILL',
     });
@@ -142,8 +144,9 @@ function cleanupTests() {
         assert.ok(options.env.CLV2_CONFIG.endsWith('/absent-config.json'));
         assert.ok(!fs.existsSync(options.env.CLV2_CONFIG));
         assert.strictEqual(args.at(-1), toShellPath(observerScript));
-        assert.match(args[3], /\nexec "\$BASH" "\$1" status$/);
-        assert.doesNotMatch(args[3], /sleep|kill|&/);
+        const program = args.includes('-c') ? args[3] : fs.readFileSync(path.join(root, 'status-wrapper.sh'), 'utf8');
+        assert.match(program, /\nexec "\$BASH" "\$1" status\n?$/);
+        assert.doesNotMatch(program, /sleep|kill|&/);
         return { status: 0, stdout: 'Instincts: 0\n', stderr: '' };
       } }), 0);
       assert.ok(!fs.existsSync(root));
@@ -228,6 +231,38 @@ function buildTests() {
         return result;
       } }), 1);
     })],
+    ['status dispatches a fixed private wrapper file without inline shell code', () => {
+      let root;
+      assert.strictEqual(runStatus([], { run: (_command, args, options) => {
+        root = options.cwd;
+        assert.deepStrictEqual(args.slice(0, 2), ['--noprofile', '--norc']);
+        assert.ok(!args.includes('-c'), 'status must dispatch a wrapper file, not inline code');
+        assert.strictEqual(args.length, 4);
+        const wrapper = path.join(root, 'status-wrapper.sh');
+        assert.strictEqual(args[2], toShellPath(wrapper));
+        assert.strictEqual(args[3], toShellPath(observerScript));
+        assert.strictEqual(fs.readFileSync(wrapper, 'utf8'),
+          'printf "%s\\n" "$$" > "$CLV2_HOMUNCULUS_DIR/.observer.pid"\nexec "$BASH" "$1" status\n');
+        if (process.platform !== 'win32') assert.strictEqual(fs.statSync(wrapper).mode & 0o777, 0o600);
+        return { status: 0, stdout: 'Instincts: 0\n', stderr: '' };
+      } }), 0);
+      assert.ok(!fs.existsSync(root));
+    }],
+    ['status target path metacharacters remain data and exec retains the advertised PID', shellTest(() => {
+      let target;
+      assert.strictEqual(runStatus([], { setup: fixture => {
+        target = path.join(fixture.root, 'status \' $() `literal` ; &.sh');
+        fs.writeFileSync(target,
+          '[ "$#" -eq 1 ] && [ "$1" = status ] || exit 96\n'
+          + 'IFS= read -r advertised < "$CLV2_HOMUNCULUS_DIR/.observer.pid"\n'
+          + '[ "$advertised" = "$$" ] || exit 95\n'
+          + 'printf "Instincts: 0\\n"\n', { flag: 'wx', mode: 0o600 });
+      }, run: (command, args, options) => {
+        assert.strictEqual(args.at(-1), toShellPath(observerScript));
+        return spawnSync(command, [...args.slice(0, -1), toShellPath(target)], options);
+      } }), 0);
+      assert.ok(!fs.existsSync(target));
+    })],
     ['linked regular files count without traversing directory links', shellTest(() => {
       assert.strictEqual(runStatus(['a.md', 'b.yaml', 'c.yml', 'd.YAML', '.note.MD',
         '.md', '.yaml', '.YML', 'notes.txt', 'nested/deep.md'], { setup: value => {
```

#### Recent Merged Pull Requests:
- **PR #3390** (closed): docs: clarify Kubernetes PDB rollout boundaries (@dajiaohuang)
- **PR #3389** (closed): test: diagnose incomplete agreement CLI fixture processes (@dajiaohuang)
- **PR #3381** (closed): docs: correct Railway rollback guidance (@dajiaohuang)
- **PR #3363** (2026-10-02): docs(ja-JP): match current sponsors (@affaan-m)
- **PR #3330** (2026-10-01): chore: retire the Everything Claude Code name, ECC only (@affaan-m)
- **PR #3329** (2026-10-01): chore(release): 2.2.3, ECC-only naming in pi/core and a longer npm publish wait (@affaan-m)
- **PR #3310** (closed): fix(repair): honor global dry-run before mutation (@dajiaohuang)
- **PR #3306** (closed): fix: discover legacy plugin caches after missing current cache (@dajiaohuang)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
