# Forensic Learning Record (Deep Inspection): upstash/context7

> **Canonical Artifact**: `07_PROJECT_LEARNING/upstash-context7-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/upstash/context7](https://github.com/upstash/context7))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T03:08:20.636Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `upstash/context7`
- **Description**: Context7 Platform -- Up-to-date code documentation for LLMs and AI code editors
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 62540 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eslint.config.js`
```
import tseslint from "typescript-eslint";
import eslintPluginPrettier from "eslint-plugin-prettier";

export default tseslint.config({
  // Base ESLint configuration
  ignores: ["node_modules/**", "build/**", "dist/**", ".git/**", ".github/**"],
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    parser: tseslint.parser,
    parserOptions: {},
    globals: {
      // Add Node.js globals
      process: "readonly",
      require: "readonly",
      module: "writable",
      console: "readonly",
    },
  },
  // Settings for all files
  linterOptions: {
    reportUnusedDisableDirectives: true,
  },
  // Apply ESLint recommended rules
  extends: [tseslint.configs.recommended],
  plugins: {
    prettier: eslintPluginPrettier,
  },
  rules: {
    // TypeScript rules
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    // Prettier integration
    "prettier/prettier": "error",
  },
});

```

### Core Architecture Module: `packages/cli/eslint.config.js`
```
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import eslintPluginPrettier from "eslint-plugin-prettier";

export default defineConfig(
  {
    // Base ESLint configuration
    ignores: ["node_modules/**", "build/**", "dist/**", ".git/**", ".github/**", "tsup.config.ts", "vitest.config.ts"],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        // Add Node.js globals
        process: "readonly",
        require: "readonly",
        module: "writable",
        console: "readonly",
      },
    },
    // Settings for all files
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      prettier: eslintPluginPrettier,
    },
    rules: {
      // TypeScript recommended rules
      ...tseslint.configs.recommended.rules,
      // TypeScript rules
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      // Prettier integration
      "prettier/prettier": "error",
    },
  },
  {
    // Commands must not hand-roll the "load tokens, check expiry" dance: it
    // skips the refresh and silently degrades to an anonymous request.
    files: ["src/commands/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "../utils/auth.js",
              importNames: ["loadTokens", "isTokenExpired"],
              message: "Use getValidAccessToken() so an expired token refreshes.",
            },
          ],
        },
      ],
    },
  }
);

```

### Core Architecture Module: `packages/cli/src/commands/auth.ts`
```
import { Command } from "commander";
import pc from "picocolors";
import ora from "ora";
import open from "open";
import boxen from "boxen";
import {
  saveTokens,
  clearTokens,
  getValidAccessToken,
  isContext7ApiKey,
  startDeviceAuthorization,
  pollDeviceToken,
  DEFAULT_DEVICE_POLL_INTERVAL_SECONDS,
} from "../utils/auth.js";

import { trackEvent } from "../utils/tracking.js";
import { CLI_CLIENT_ID } from "../constants.js";
import { getBaseUrl } from "../utils/api.js";

export function registerAuthCommands(program: Command): void {
  program
    .command("login")
    .description("Log in to Context7")
    .option("--no-browser", "Don't open browser automatically")
    .action(async (options) => {
      await loginCommand(options);
    });

  program
    .command("logout")
    .description("Log out of Context7")
    .action(() => {
      logoutCommand();
    });

  program
    .command("whoami")
    .description("Show current login status")
    .action(async () => {
      await whoamiCommand();
    });
}

function renderDeviceCodeBox(
  userCode: string,
  verificationUri: string,
  verificationUriComplete: string | undefined
): string {
  const codeLine = `${pc.dim("Your one-time code:")}\n\n    ${pc.green(pc.bold(userCode))}`;
  // Per RFC 8628 §3.3, even when verification_uri_complete is available we
  // still show the bare verification_uri so users on screen readers / paper
  // can type it manually.
  const linkLine = verificationUriComplete
    ? `${pc.dim("Open this link to approve:")}\n${pc.cyan(verificationUriComplete)}\n\n${pc.dim("Or visit")} ${pc.cyan(verificationUri)} ${pc.dim("and enter the code above.")}`
    : `${pc.dim("Visit:")} ${pc.cyan(verificationUri)}`;
  return boxen(`${codeLine}\n\n${linkLine}`, {
    title: "Sign in to Context7",
    titleAlignment: "left",
    padding: 1,
    margin: { top: 1, bottom: 1, left: 2, right: 2 },
    borderStyle: "round",
    borderColor: "gray",
  });
}

/** Prints a prompt and resolves on the next keypress. No-op when stdin isn't a TTY. */
function waitForEnter(prompt: string): Promise<void> {
  if (!process.stdin.isTTY) return Promise.resolve();
  return new Promise<void>((resolve) => {
    process.stdout.write(`  ${pc.dim(prompt)} `);
    const onData = (chunk: Buffer) => {
      // Ctrl-C
      if (chunk[0] === 0x03) {
        process.stdin.removeListener("data", onData);
        process.stdin.setRawMode?.(false);
        process.stdin.pause();
        process.stdout.write("\n");
        process.exit(130);
      }
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
      process.stdout.write("\n");
      resolve();
    };
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

async function announceIdentity(accessToken: string): Promise<string> {
  if (isContext7ApiKey(accessToken)) return "Authenticated with API key";

  try {
    const whoami = await fetchWhoami(accessToken);
    const name = whoami.email || whoami.name;
    if (!name) return "Login successful!";
    const team = whoami.teamspace?.name;
    return team
      ? `Logged in as ${pc.bold(name)} ${pc.dim(`(${team})`)}`
      : `Logged in as ${pc.bold(name)}`;
  } catch {
    return "Login successful!";
  }
}

export async function performLogin(openBrowser = true): Promise<string | null> {
  const baseUrl = getBaseUrl();
  const spinner = ora("Preparing login...").start();

  let authorization;
  try {
    authorization = await startDeviceAuthorization(baseUrl, CLI_CLIENT_ID);
  } catch (error) {
    spinner.fail(pc.red("Login failed"));
    if (error instanceof Error) console.error(pc.red(error.message));
    return null;
  }

  spinner.stop();

  console.log(
    renderDeviceCodeBox(
      authorization.user_code,
      authorization.verification_uri,
      authorization.verification_uri_complete
    )
  );

  const target = authorization.verification_uri_complete ?? authorization.verification_uri;
  if (openBrowser) {
    await waitForEnter("Press Enter to open the browser, or Ctrl-C to quit...");
    try {
      await open(target);
    } catch {
      console.log(pc.dim(`  Couldn't open a browser — visit the link above manually.`));
    }
  } else {
    console.log(pc.dim("  Open the link above in any browser to continue."));
    console.log("");
  }

  const waitingSpinner = ora({ text: "Waiting for authorization...", indent: 2 }).start();

  const deadline = Date.now() + authorization.expires_in * 1000;
  let intervalMs = (authorization.interval ?? DEFAULT_DEVICE_POLL_INTERVAL_SECONDS) * 1000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    try {
      const result = await pollDeviceToken(baseUrl, CLI_CLIENT_ID, authorization.device_code);
      if (result.status === "approved" && result.tokens) {
        saveTokens(result.tokens);
        const successText = await announceIdentity(result.tokens.access_token);
        waitingSpinner.succeed(pc.green(successText));
        return result.tokens.access_token;
      }
      if (result.status === "slow_down") {
        intervalMs += 5000;
        continue;
      }
      if (result.status === "denied") {
        waitingSpinner.fail(pc.red("Authorization denied."));
        return null;
      }
      if (result.status === "expired") {
        waitingSpinner.fail(pc.red("Code expired. Run login again."));
        return null;
      }
      if (result.status === "transient") {
        // RFC 8628 §3.5: client MUST unilaterally reduce polling frequency on
        // connection timeout. Apply +5s like slow_down so a flaky network or
        // 5xx burst doesn't keep hitting at the original cadence.
        intervalMs += 5000;
        continue;
      }
      // pending — keep polling at the current cadence.
    } catch (error) {
      waitingSpinner.fail(pc.red("Login failed"));
      if (error instanceof Error) console.error(pc.red(error.message));
      return null;
    }
  }

  waitingSpinner.fail(pc.red("Code expired without approval."));
  return null;
}

async function loginCommand(options: { browser: boolean }): Promise<void> {
  trackEvent("command", { name: "login" });
  const existingToken = await getValidAccessToken();
  if (existingToken) {
    console.log(pc.yellow("You are already logged in."));
    console.log(pc.dim("Run 'ctx7 logout' first if you want to log in with a different account."));
    return;
  }
  clearTokens();

  const token = await performLogin(options.browser);
  if (!token) {
    process.exit(1);
  }
  console.log("");
  console.log(pc.dim("You can now use authenticated Context7 features."));
}

function logoutCommand(): void {
  trackEvent("command", { name: "logout" });
  if (clearTokens()) {
    console.log(pc.green("Logged out successfully."));
  } else {
    console.log(pc.yellow("You are not logged in."));
  }
}

async function whoamiCommand(): Promise<void> {
  trackEvent("command", { name: "whoami" });
  const accessToken = await getValidAccessToken();

  if (!accessToken) {
    console.log(pc.yellow("Not logged in."));
    console.log(pc.dim("Run 'ctx7 login' to authenticate."));
    return;
  }

  console.log(pc.green("Logged in"));

  if (isContext7ApiKey(accessToken)) {
    return;
  }

  try {
    const whoami = await fetchWhoami(accessToken);
    if (whoami.name) {
      console.log(`${pc.dim("Name:".padEnd(13))}${whoami.name}`);
    }
    if (whoami.email) {
      console.log(`${pc.dim("Email:".padEnd(13))}${whoami.email}`);
    }
    if (whoami.teamspace) {
      console.log(`${pc.dim("Teamspace:".padEnd(13))}${whoami.teamspace.name}`);
    }
  } catch (error) {
    console.log(
      pc.dim(
        error instanceof SessionRejectedError
          ? "Session was rejected by the server. Run 'ctx7 logout', then 'ctx7 login' to sign in again."
          : "Could not verify your session. Try again later."
      )
    );
  }
}

interface WhoamiR
```

### Core Architecture Module: `packages/cli/src/commands/generate.ts`
```
import { Command } from "commander";
import pc from "picocolors";
import ora from "ora";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import { spawn } from "child_process";
import { input, select } from "@inquirer/prompts";

import {
  searchLibraries,
  getSkillQuestions,
  generateSkillStructured,
  getSkillQuota,
} from "../utils/api.js";
import { getValidAccessToken } from "../utils/auth.js";
import { performLogin } from "./auth.js";
import { log } from "../utils/logger.js";
import { promptForInstallTargets, getTargetDirs } from "../utils/ide.js";
import selectOrInput from "../utils/selectOrInput.js";
import { checkboxWithHover, terminalLink } from "../utils/prompts.js";
import { trackEvent } from "../utils/tracking.js";
import { getPreviewsDir } from "../utils/storage-paths.js";
import type {
  GenerateOptions,
  LibrarySearchResult,
  SkillAnswer,
  StructuredGenerateInput,
  GenerateStreamEvent,
  ToolResultSnippet,
} from "../types.js";

interface QueryLogEntry {
  query: string;
  libraryId?: string;
  results: ToolResultSnippet[];
}

// TODO(deprecate-skills-phase-2): Remove this deprecated Skill Hub generation
// subcommand after legacy `ctx7 skills generate` support is dropped.
export function registerGenerateCommand(skillCommand: Command): void {
  skillCommand
    .command("generate")
    .alias("gen")
    .alias("g")
    .option("-o, --output <dir>", "Output directory (default: current directory)")
    .option("--all", "Generate for all detected IDEs")
    .option("--global", "Generate in global skills directory")
    .option("--claude", "Claude Code (.claude/skills/)")
    .option("--cursor", "Cursor (.cursor/skills/)")
    .option("--universal", "Universal (.agents/skills/)")
    .option("--antigravity", "Antigravity (.agent/skills/)")
    .description("Generate a skill for a library using AI")
    .action(async (options: GenerateOptions) => {
      await generateCommand(options);
    });
}

async function generateCommand(options: GenerateOptions): Promise<void> {
  trackEvent("command", { name: "generate" });
  log.blank();

  let accessToken = await getValidAccessToken();
  if (!accessToken) {
    log.info("Authentication required. Logging in...");
    log.blank();
    const token = await performLogin();
    if (!token) {
      log.error("Login failed. Please try again.");
      return;
    }
    accessToken = token;
    log.blank();
  }

  const initSpinner = ora().start();
  const quota = await getSkillQuota(accessToken);

  if (quota.error) {
    initSpinner.fail(pc.red("Failed to initialize"));
    return;
  }

  if (quota.tier !== "unlimited" && quota.remaining < 1) {
    initSpinner.fail(pc.red("Weekly skill generation limit reached"));
    log.blank();
    console.log(
      `  You've used ${pc.bold(pc.white(quota.used.toString()))}/${pc.bold(pc.white(quota.limit.toString()))} skill generations this week.`
    );
    console.log(
      `  Your quota resets on ${pc.yellow(new Date(quota.resetDate!).toLocaleDateString())}.`
    );
    log.blank();
    if (quota.tier === "free") {
      console.log(
        `  ${pc.yellow("Tip:")} Upgrade to Pro for ${pc.bold("10")} generations per week.`
      );
      console.log(`  Visit ${pc.green("https://context7.com/dashboard")} to upgrade.`);
    }
    return;
  }

  initSpinner.stop();
  initSpinner.clear();

  console.log(pc.bold("What should your agent become an expert at?\n"));
  console.log(
    pc.dim(
      "Skills should encode best practices, constraints, and decision-making —\nnot step-by-step tutorials or one-off tasks.\n"
    )
  );
  console.log(pc.yellow("Examples:"));
  // prettier-ignore
  {
    console.log(pc.red('  ✕ "Deploy a Next.js app to Vercel"'));
    console.log(pc.green('  ✓ "Best practices and constraints for deploying Next.js apps to Vercel"'));
    log.blank();
    console.log(pc.red('  ✕ "Use Tailwind for responsive design"'));
    console.log(pc.green('  ✓ "Responsive layout decision-making with Tailwind CSS"'));
    log.blank();
    console.log(pc.red('  ✕ "Build OAuth with NextAuth"'));
    console.log(pc.green('  ✓ "OAuth authentication patterns and pitfalls with NextAuth.js"'));
  }
  log.blank();

  let motivation: string;
  try {
    motivation = await input({
      message: "Describe the expertise:",
    });

    if (!motivation.trim()) {
      log.warn("Expertise description is required");
      return;
    }
    motivation = motivation.trim();
  } catch {
    log.warn("Generation cancelled");
    return;
  }

  log.blank();
  console.log(
    pc.dim(
      "To generate this skill, we will read relevant documentation and examples\nfrom Context7.\n"
    )
  );
  console.log(
    pc.dim(
      "These sources are used to:\n• extract best practices and constraints\n• compare patterns across official docs and examples\n• avoid outdated or incorrect guidance\n"
    )
  );
  console.log(pc.dim("You can adjust which sources the skill is based on.\n"));

  const searchSpinner = ora("Finding relevant sources...").start();
  const searchResult = await searchLibraries(motivation, accessToken);

  if (searchResult.error || !searchResult.results?.length) {
    searchSpinner.fail(pc.red("No sources found"));
    log.warn(searchResult.message || "Try a different description");
    return;
  }

  searchSpinner.succeed(pc.green(`Found ${searchResult.results.length} relevant sources`));
  log.blank();

  if (searchResult.searchFilterApplied) {
    log.warn(
      "Your results only include libraries matching your teamspace's library filters. To adjust quality thresholds or blocked libraries, update your filters at https://context7.com/dashboard?tab=policies"
    );
    log.blank();
  }

  let selectedLibraries: LibrarySearchResult[];
  try {
    const formatProjectId = (id: string) => {
      return id.startsWith("/") ? id.slice(1) : id;
    };

    const isGitHubRepo = (id: string): boolean => {
      const cleanId = id.startsWith("/") ? id.slice(1) : id;
      const parts = cleanId.split("/");
      if (parts.length !== 2) return false;
      const nonGitHubPrefixes = ["websites", "packages", "npm", "docs", "libraries", "llmstxt"];
      return !nonGitHubPrefixes.includes(parts[0].toLowerCase());
    };

    const libraries = searchResult.results.slice(0, 5);
    const indexWidth = libraries.length.toString().length;
    const maxNameLen = Math.max(...libraries.map((lib) => lib.title.length));

    const libraryChoices = libraries.map((lib, index) => {
      const projectId = formatProjectId(lib.id);
      const isGitHub = isGitHubRepo(lib.id);
      const indexStr = pc.dim(`${(index + 1).toString().padStart(indexWidth)}.`);
      const paddedName = lib.title.padEnd(maxNameLen);

      const libUrl = `https://context7.com${lib.id}`;
      const libLink = terminalLink(lib.title, libUrl, pc.white);
      const sourceUrl = isGitHub
        ? `https://github.com/${projectId}`
        : `https://context7.com${lib.id}`;
      const repoLink = terminalLink(projectId, sourceUrl, pc.white);

      const starsLine =
        lib.stars && isGitHub ? [`${pc.yellow("Stars:")}       ${lib.stars.toLocaleString()}`] : [];

      const metadataLines = [
        pc.dim("─".repeat(50)),
        "",
        `${pc.yellow("Library:")}     ${libLink}`,
        `${pc.yellow("Source:")}      ${repoLink}`,
        `${pc.yellow("Snippets:")}    ${lib.totalSnippets.toLocaleString()}`,
        ...starsLine,
        `${pc.yellow("Description:")}`,
        pc.white(lib.description || "No description"),
      ];

      return {
        name: `${indexStr} ${paddedName}  ${pc.dim(`(${projectId})`)}`,
        value: lib,
        description: metadataLines.join("\n"),
      };
    });

    selectedLibraries = await checkboxWithHover(
      {
        message: "Select sources:",
        choices: libraryChoices,
        pageSize: 10,
        loop: false,
      },
      { getName: (lib) => `${lib.title} (${formatProjectId(li
```

### Core Architecture Module: `packages/cli/src/commands/remove.ts`
```
import { Command } from "commander";
import pc from "picocolors";
import ora from "ora";
import { checkboxWithHover } from "../utils/prompts.js";
import { log } from "../utils/logger.js";
import { trackEvent } from "../utils/tracking.js";
import { ALL_AGENT_NAMES, getAgent, type SetupAgent } from "../setup/agents.js";
import {
  readJsonConfig,
  readTomlServerExists,
  removeServerEntry,
  writeJsonConfig,
  resolveMcpPath,
  removeTomlServer,
} from "../setup/mcp-writer.js";
import { join } from "path";
import { access, readFile, rm, writeFile } from "fs/promises";

type Scope = "global" | "project";
type UninstallMode = "mcp" | "cli";

type UninstallOptions = Partial<Record<SetupAgent, boolean>> & {
  project?: boolean;
  yes?: boolean;
  all?: boolean;
  cli?: boolean;
  mcp?: boolean;
};

interface CleanupStatus {
  status: string;
  path: string;
}

interface SkillCleanupStatus extends CleanupStatus {
  name: string;
}

interface AgentCleanupResult {
  agent: string;
  mcp?: CleanupStatus;
  rule?: CleanupStatus;
  skills?: SkillCleanupStatus[];
}

const CHECKBOX_THEME = {
  style: {
    highlight: (text: string) => pc.green(text),
    disabledChoice: (text: string) => ` ${pc.dim("◯")} ${pc.dim(text)}`,
  },
};

const CONTEXT7_SECTION_MARKER = "<!-- context7 -->";
const MODE_SKILLS: Record<UninstallMode, readonly string[]> = {
  mcp: ["context7-mcp"],
  cli: ["find-docs"],
};

const MODE_LABELS: Record<UninstallMode, string> = {
  mcp: "MCP",
  cli: "CLI + Skills",
};

export function registerRemoveCommand(program: Command): void {
  const command = program
    .command("remove")
    .alias("uninstall")
    .description("Remove Context7 setup from your AI coding agent");

  for (const name of ALL_AGENT_NAMES) {
    const agent = getAgent(name);
    command.option(`--${name}`, `Remove from ${agent.displayName}`);
  }

  command
    .option("--all", "Remove both MCP setup and CLI + Skills setup")
    .option("--mcp", "Remove MCP setup")
    .option("--cli", "Remove CLI + Skills setup")
    .option("-p, --project", "Remove from the current project instead of global config")
    .option("-y, --yes", "Skip confirmation prompts")
    .action(async (options: UninstallOptions) => {
      await removeCommand(options);
    });
}

function getSelectedAgents(options: UninstallOptions): SetupAgent[] {
  return ALL_AGENT_NAMES.filter((name) => options[name]);
}

async function promptAgents(detected: SetupAgent[]): Promise<SetupAgent[] | null> {
  const choices = detected.map((name) => ({
    name: getAgent(name).displayName,
    value: name,
  }));

  if (detected.length > 0) {
    log.dim(`Detected: ${detected.map((agent) => getAgent(agent).displayName).join(", ")}`);
  }

  try {
    return await checkboxWithHover(
      {
        message: "Which agents do you want to remove Context7 setup from?",
        choices,
        loop: false,
        theme: CHECKBOX_THEME,
      },
      { getName: (agent: SetupAgent) => getAgent(agent).displayName }
    );
  } catch {
    return null;
  }
}

async function promptModes(modes: UninstallMode[]): Promise<UninstallMode[] | null> {
  const choices = modes.map((mode) => ({
    name: MODE_LABELS[mode],
    value: mode,
  }));

  try {
    return await checkboxWithHover(
      {
        message: "Which Context7 setup modes do you want to remove?",
        choices,
        loop: false,
        theme: CHECKBOX_THEME,
      },
      { getName: (mode: UninstallMode) => MODE_LABELS[mode] }
    );
  } catch {
    return null;
  }
}

async function resolveAgents(options: UninstallOptions, scope: Scope): Promise<SetupAgent[]> {
  const explicit = getSelectedAgents(options);
  if (explicit.length > 0) return explicit;

  const detected = await detectConfiguredAgents(scope);
  if (detected.length > 0 && options.yes) return detected;

  if (detected.length === 0) {
    log.warn(
      `No Context7 setup detected. Pass one of: ${ALL_AGENT_NAMES.map((name) => `--${name}`).join(", ")}.`
    );
    return [];
  }

  log.blank();
  const selected = await promptAgents(detected);
  if (!selected) {
    log.warn("Remove cancelled");
    return [];
  }

  return selected;
}

function resolveFlagModes(options: UninstallOptions): UninstallMode[] {
  if (options.all) return ["mcp", "cli"];

  const selected: UninstallMode[] = [];

  if (options.mcp) selected.push("mcp");
  if (options.cli) selected.push("cli");

  return selected.length > 0 ? selected : ["mcp", "cli"];
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function hasMcpConfig(agentName: SetupAgent, scope: Scope): Promise<boolean> {
  const agent = getAgent(agentName);
  // Agents with no project-level MCP (e.g. Antigravity) only have a global
  // config — there's nothing to detect at project scope.
  if (scope === "project" && agent.mcp.projectPaths.length === 0) return false;
  const candidates =
    scope === "global"
      ? agent.mcp.globalPaths
      : agent.mcp.projectPaths.map((path) => join(process.cwd(), path));
  const mcpPath = await resolveMcpPath(candidates);

  if (mcpPath.endsWith(".toml")) {
    return readTomlServerExists(mcpPath, "context7");
  }

  let existing: Record<string, unknown>;
  try {
    existing = await readJsonConfig(mcpPath);
  } catch (err) {
    log.warn(
      `Skipped ${mcpPath}: could not parse (${err instanceof Error ? err.message : String(err)})`
    );
    return false;
  }
  const section = existing[agent.mcp.configKey];
  return (
    !!section && typeof section === "object" && !Array.isArray(section) && "context7" in section
  );
}

async function hasRule(agentName: SetupAgent, scope: Scope): Promise<boolean> {
  const agent = getAgent(agentName);
  const rule = agent.rule;

  if (rule.kind === "file") {
    const ruleDir =
      scope === "global" ? rule.dir("global") : join(process.cwd(), rule.dir("project"));
    return pathExists(join(ruleDir, rule.filename));
  }

  const filePath =
    scope === "global" ? rule.file("global") : join(process.cwd(), rule.file("project"));

  try {
    const existing = await readFile(filePath, "utf-8");
    return existing.includes(CONTEXT7_SECTION_MARKER);
  } catch {
    return false;
  }
}

async function hasSkill(agentName: SetupAgent, scope: Scope, skillName: string): Promise<boolean> {
  const agent = getAgent(agentName);
  const skillsDir =
    scope === "global"
      ? agent.skill.dir("global")
      : join(process.cwd(), agent.skill.dir("project"));
  return pathExists(join(skillsDir, skillName));
}

async function detectAvailableModes(agents: SetupAgent[], scope: Scope): Promise<UninstallMode[]> {
  let hasMcpArtifacts = false;
  let hasCliArtifacts = false;
  let hasRuleArtifacts = false;

  for (const agent of agents) {
    hasMcpArtifacts =
      hasMcpArtifacts ||
      (await hasMcpConfig(agent, scope)) ||
      (await hasSkill(agent, scope, MODE_SKILLS.mcp[0]));
    hasCliArtifacts = hasCliArtifacts || (await hasSkill(agent, scope, MODE_SKILLS.cli[0]));
    hasRuleArtifacts = hasRuleArtifacts || (await hasRule(agent, scope));
  }

  const modes: UninstallMode[] = [];
  if (hasMcpArtifacts) modes.push("mcp");
  if (hasCliArtifacts) modes.push("cli");

  if (modes.length === 0 && hasRuleArtifacts) {
    return ["mcp", "cli"];
  }

  return modes;
}

async function hasAnyContext7Artifacts(agent: SetupAgent, scope: Scope): Promise<boolean> {
  return (
    (await hasMcpConfig(agent, scope)) ||
    (await hasRule(agent, scope)) ||
    (await hasSkill(agent, scope, MODE_SKILLS.mcp[0])) ||
    (await hasSkill(agent, scope, MODE_SKILLS.cli[0]))
  );
}

async function detectConfiguredAgents(scope: Scope): Promise<SetupAgent[]> {
  const detected: SetupAgent[] = [];

  for (const agent of ALL_AGENT_NAMES) {
    if (await hasAnyContext7Artifacts(agent, scope)) {
      detected.push(agent);
    }
  }

  return detected;
}

async function resolveModes(
  options: UninstallOptions,
  agents: 
```

### Core Architecture Module: `packages/cli/src/commands/setup.ts`
```
import { Command } from "commander";
import pc from "picocolors";
import ora from "ora";
import { password, select } from "@inquirer/prompts";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";

import { log } from "../utils/logger.js";
import { checkboxWithHover } from "../utils/prompts.js";
import { trackEvent } from "../utils/tracking.js";
import { downloadSkill } from "../utils/api.js";
import { installSkillFiles } from "../utils/installer.js";
import { performLogin } from "./auth.js";
import { saveTokens, getValidAccessToken } from "../utils/auth.js";
import type { SkillFile } from "../types.js";
import { resolveSetupApiKey } from "../setup/auth.js";
import {
  type SetupAgent,
  type AuthOptions,
  type Transport,
  AUTH_MODE_LABELS,
  ALL_AGENT_NAMES,
  getAgent,
  detectAgents,
} from "../setup/agents.js";
import {
  customizeSkillFilesForAgent,
  getBundledMcpSkillFiles,
  getBundledRuleContent,
  getRuleContent,
} from "../setup/templates.js";
import {
  getMcpUrl,
  getOnPremMcpAuthStatus,
  resolveSetupDeployment,
  type CustomSetupDeployment,
  type SetupDeployment,
} from "../setup/deployment.js";
import {
  readJsonConfig,
  mergeServerEntry,
  writeJsonConfig,
  resolveMcpPath,
  appendTomlServer,
  patchTomlStdioApiKey,
  isStdioContext7Entry,
  patchStdioApiKey,
  getJsonServerEntry,
} from "../setup/mcp-writer.js";

type Scope = "global" | "project";
type SetupMode = "mcp" | "cli";
interface McpSkillPayload {
  files: SkillFile[];
  status: "installed" | "installed (bundled)" | "installed (bundled fallback)";
}

type SetupOptions = Partial<Record<SetupAgent, boolean>> & {
  project?: boolean;
  yes?: boolean;
  apiKey?: string;
  oauth?: boolean;
  cli?: boolean;
  mcp?: boolean;
  stdio?: boolean;
  baseUrl?: string;
};

function resolveTransport(options: SetupOptions): Transport {
  return options.stdio ? "stdio" : "http";
}

const CHECKBOX_THEME = {
  style: {
    highlight: (text: string) => pc.green(text),
    disabledChoice: (text: string) => ` ${pc.dim("◯")} ${pc.dim(text)}`,
  },
};

function getSelectedAgents(options: SetupOptions): SetupAgent[] {
  return ALL_AGENT_NAMES.filter((name) => options[name]);
}

export function registerSetupCommand(program: Command): void {
  const command = program.command("setup").description("Set up Context7 for your AI coding agent");

  for (const name of ALL_AGENT_NAMES) {
    const agent = getAgent(name);
    command.option(`--${name}`, agent.setupDescription ?? `Set up for ${agent.displayName}`);
  }

  command
    .option("--mcp", "Set up MCP server mode")
    .option("--cli", "Set up CLI + Skills mode (no MCP server)")
    .option("-p, --project", "Configure for current project instead of globally")
    .option("-y, --yes", "Skip confirmation prompts")
    .option("--api-key <key>", "Use API key authentication")
    .option("--oauth", "Use OAuth endpoint (IDE handles auth flow)")
    .option("--stdio", "Configure the MCP server as a local stdio process (default: HTTP)")
    // The root option handles shared API configuration; this local declaration also
    // lets Commander accept --base-url after `setup`.
    .option("--base-url <url>", "Use a custom Context7 deployment (for example, on-premise)")
    .action(async (_options: SetupOptions, command: Command) => {
      await setupCommand(command.optsWithGlobals<SetupOptions>());
    });
}

async function promptForOnPremApiKey(deployment: CustomSetupDeployment): Promise<string | null> {
  try {
    return await password({
      message: `Personal API key (create one at ${deployment.baseUrl}/account)`,
      mask: true,
      validate: (value) => value.trim().length > 0 || "API key is required",
    }).then((value) => value.trim());
  } catch {
    log.error("Setup cancelled before a personal API key was entered.");
    return null;
  }
}

async function resolveAuth(
  options: SetupOptions,
  deployment: SetupDeployment
): Promise<AuthOptions | null> {
  const explicitApiKey = options.apiKey?.trim();

  if (deployment.kind === "custom") {
    try {
      if (!(await getOnPremMcpAuthStatus(deployment))) return { mode: "none" };
    } catch (err) {
      log.error(
        `Could not check MCP authentication at ${deployment.baseUrl}: ${err instanceof Error ? err.message : String(err)}`
      );
      process.exitCode = 1;
      return null;
    }

    const apiKey = explicitApiKey || process.env.CONTEXT7_API_KEY?.trim();
    if (apiKey) return { mode: "api-key", apiKey };

    if (!options.yes) {
      const promptedApiKey = await promptForOnPremApiKey(deployment);
      return promptedApiKey ? { mode: "api-key", apiKey: promptedApiKey } : null;
    }

    log.error(
      `MCP authentication is enabled at ${deployment.baseUrl}. Pass --api-key, set CONTEXT7_API_KEY, or rerun without --yes to enter a personal API key securely.`
    );
    process.exitCode = 1;
    return null;
  }

  if (explicitApiKey) return { mode: "api-key", apiKey: explicitApiKey };
  if (options.oauth) return { mode: "oauth" };

  const resolvedApiKey = await resolveSetupApiKey();
  if (!resolvedApiKey) return null;
  return { mode: "api-key", apiKey: resolvedApiKey };
}

function getSetupValidationError(
  mode: SetupMode,
  options: SetupOptions,
  deployment: SetupDeployment
): string | null {
  if (deployment.kind === "custom") {
    if (mode === "cli") {
      return "--base-url currently supports MCP setup only. Use --mcp with an on-premise deployment.";
    }
    if (options.stdio) {
      return "--stdio is not supported with --base-url. On-premise setup uses the HTTP /mcp endpoint.";
    }
    if (options.oauth) {
      return "--oauth is only supported by hosted Context7. Use a personal on-premise API key.";
    }
  }

  if (mode === "mcp" && options.stdio && options.oauth) {
    return "--stdio is incompatible with --oauth (OAuth uses the hosted HTTP endpoint).";
  }
  return null;
}

async function resolveMode(options: SetupOptions): Promise<SetupMode> {
  if (options.cli) return "cli";
  if (options.baseUrl || options.mcp || options.yes || options.oauth || options.stdio) return "mcp";

  return select<SetupMode>({
    message: "How should your agent access Context7?",
    choices: [
      {
        name: `MCP server\n    ${pc.dim("Agent calls Context7 tools via MCP protocol to retrieve up-to-date library docs")}`,
        value: "mcp" as SetupMode,
      },
      {
        name: `CLI + Skills\n    ${pc.dim("Installs a find-docs skill that guides your agent to fetch up-to-date library docs using ")}${pc.dim(pc.bold("ctx7"))}${pc.dim(" CLI commands")}`,
        value: "cli" as SetupMode,
      },
    ],
    theme: {
      style: {
        highlight: (text: string) => pc.green(text),
        answer: (text: string) => pc.green(text.split("\n")[0].trim()),
      },
    },
  });
}

async function resolveCliAuth(apiKey?: string): Promise<void> {
  if (apiKey) {
    saveTokens({ access_token: apiKey, token_type: "bearer" });
    log.blank();
    log.plain(`${pc.green("✔")} Authenticated`);
    return;
  }

  const validToken = await getValidAccessToken();
  if (validToken) {
    log.blank();
    log.plain(`${pc.green("✔")} Authenticated`);
    return;
  }

  await performLogin();
}

async function promptAgents(): Promise<SetupAgent[] | null> {
  const choices = ALL_AGENT_NAMES.map((name) => ({
    name: getAgent(name).displayName,
    value: name,
  }));

  const message = "Which agents do you want to set up?";

  try {
    return await checkboxWithHover(
      {
        message,
        choices,
        loop: false,
        theme: CHECKBOX_THEME,
      },
      { getName: (a: SetupAgent) => getAgent(a).displayName }
    );
  } catch {
    return null;
  }
}

async function resolveAgents(options: SetupOptions, scope: Scope): Promise<SetupAgent[]> {
  const explicit = getSelectedAgents(options);
  if (explicit.length > 0) return explicit;

  const detected = await detectAgents(scope);

  if (detected.length > 0 && 
```

### Core Architecture Module: `packages/cli/src/commands/skill.ts`
```
import { Command } from "commander";
import pc from "picocolors";
import ora from "ora";
import { readdir, rm } from "fs/promises";
import { join } from "path";

import { parseSkillInput } from "../utils/parse-input.js";
import {
  listProjectSkills,
  searchSkills,
  suggestSkills,
  downloadSkill,
  getSkill,
} from "../utils/api.js";
import { log } from "../utils/logger.js";
import {
  promptForInstallTargets,
  promptForSingleTarget,
  getTargetDirs,
  getTargetDirFromSelection,
  getSelectedIdes,
  hasExplicitIdeOption,
} from "../utils/ide.js";
import {
  checkboxWithHover,
  terminalLink,
  formatPopularity,
  formatTrust,
  formatInstallRange,
  getTrustLabel,
} from "../utils/prompts.js";
import { installSkillFiles, symlinkSkill } from "../utils/installer.js";
import { assertSkillNameInRoot } from "../utils/skill-name.js";
import { listSkillsFromGitHub, getSkillFromGitHub } from "../utils/github.js";
import { trackEvent } from "../utils/tracking.js";
import { registerGenerateCommand } from "./generate.js";
import type {
  Skill,
  SkillSearchResult,
  AddOptions,
  ListOptions,
  RemoveOptions,
  SuggestOptions,
  InstallTargets,
  Scope,
} from "../types.js";
import {
  IDE_NAMES,
  IDE_PATHS,
  IDE_GLOBAL_PATHS,
  UNIVERSAL_SKILLS_PATH,
  UNIVERSAL_SKILLS_GLOBAL_PATH,
  UNIVERSAL_AGENTS_LABEL,
  VENDOR_SPECIFIC_AGENTS,
} from "../types.js";
import { homedir } from "os";
import { detectProjectDependencies } from "../utils/deps.js";
import { getValidAccessToken } from "../utils/auth.js";

const SKILL_HUB_DEPRECATION_WARNING =
  "Warning: Skill commands are deprecated and will stop working in the next major release.";

// TODO(deprecate-skills-phase-2): Delete this Skill Hub command tree once the
// deprecated `ctx7 skills ...` compatibility window closes. Do not remove the
// setup-installed Context7 skills with it.
function warnSkillHubDeprecated(): void {
  console.error(pc.yellow(SKILL_HUB_DEPRECATION_WARNING));
  console.error("");
}

function logInstallSummary(
  targets: InstallTargets,
  targetDirs: string[],
  skillNames: string[]
): void {
  log.blank();
  const hasUniversal = targets.ides.some((ide) => ide === "universal");
  const vendorIdes = targets.ides.filter((ide) => ide !== "universal");

  let dirIndex = 0;
  if (hasUniversal && dirIndex < targetDirs.length) {
    log.plain(`${pc.bold("Universal")} ${pc.dim(targetDirs[dirIndex])}`);
    for (const name of skillNames) {
      log.itemAdd(name);
    }
    dirIndex++;
  }

  for (const ide of vendorIdes) {
    if (dirIndex >= targetDirs.length) break;
    log.plain(`${pc.bold(IDE_NAMES[ide])} ${pc.dim(targetDirs[dirIndex])}`);
    for (const name of skillNames) {
      log.itemAdd(name);
    }
    dirIndex++;
  }

  log.blank();
}

export function registerSkillCommands(program: Command): void {
  const skill = program
    .command("skills", { hidden: true })
    .alias("skill")
    .description("Manage AI coding skills")
    .hook("preAction", () => {
      warnSkillHubDeprecated();
    });

  // Register generate subcommand
  registerGenerateCommand(skill);

  skill
    .command("install")
    .alias("i")
    .alias("add")
    .argument("<repository>", "GitHub repository (/owner/repo)")
    .argument("[skill]", "Specific skill name to install")
    .option("--all", "Install all skills without prompting")
    .option("--all-agents", "Install to all supported agent locations")
    .option("-y, --yes", "Skip confirmation prompts")
    .option("--global", "Install globally instead of current directory")
    .option("--claude", "Claude Code (.claude/skills/)")
    .option("--cursor", "Cursor (.cursor/skills/)")
    .option("--universal", "Universal (.agents/skills/)")
    .option("--antigravity", "Antigravity (.agent/skills/)")
    .description("Install skills from a repository")
    .action(async (project: string, skillName: string | undefined, options: AddOptions) => {
      await installCommand(project, skillName, options);
    });

  skill
    .command("search")
    .alias("s")
    .argument("<keywords...>", "Search keywords")
    .description("Search for skills across all indexed repositories")
    .action(async (keywords: string[]) => {
      await searchCommand(keywords.join(" "));
    });

  skill
    .command("list")
    .alias("ls")
    .option("--json", "Output as JSON")
    .option("--global", "List global skills")
    .option("--claude", "Claude Code (.claude/skills/)")
    .option("--cursor", "Cursor (.cursor/skills/)")
    .option("--universal", "Universal (.agents/skills/)")
    .option("--antigravity", "Antigravity (.agent/skills/)")
    .description("List installed skills")
    .action(async (options: ListOptions) => {
      await listCommand(options);
    });

  skill
    .command("remove")
    .alias("rm")
    .alias("delete")
    .argument("<name>", "Skill name to remove")
    .option("--global", "Remove from global skills")
    .option("--claude", "Claude Code (.claude/skills/)")
    .option("--cursor", "Cursor (.cursor/skills/)")
    .option("--universal", "Universal (.agents/skills/)")
    .option("--antigravity", "Antigravity (.agent/skills/)")
    .description("Remove an installed skill")
    .action(async (name: string, options: RemoveOptions) => {
      await removeCommand(name, options);
    });

  skill
    .command("info")
    .argument("<repository>", "GitHub repository (/owner/repo)")
    .description("Show skills in a repository")
    .action(async (project: string) => {
      await infoCommand(project);
    });

  skill
    .command("suggest")
    .option("--global", "Install globally instead of current directory")
    .option("--claude", "Claude Code (.claude/skills/)")
    .option("--cursor", "Cursor (.cursor/skills/)")
    .option("--universal", "Universal (.agents/skills/)")
    .option("--antigravity", "Antigravity (.agent/skills/)")
    .description("Suggest skills based on your project dependencies")
    .action(async (options: SuggestOptions) => {
      await suggestCommand(options);
    });
}

export function registerSkillAliases(program: Command): void {
  program
    .command("si", { hidden: true })
    .argument("<repository>", "GitHub repository (/owner/repo)")
    .argument("[skill]", "Specific skill name to install")
    .option("--all", "Install all skills without prompting")
    .option("--all-agents", "Install to all supported agent locations")
    .option("-y, --yes", "Skip confirmation prompts")
    .option("--global", "Install globally instead of current directory")
    .option("--claude", "Claude Code (.claude/skills/)")
    .option("--cursor", "Cursor (.cursor/skills/)")
    .option("--universal", "Universal (.agents/skills/)")
    .option("--antigravity", "Antigravity (.agent/skills/)")
    .description("Install skills (alias for: skills install)")
    .action(async (project: string, skillName: string | undefined, options: AddOptions) => {
      warnSkillHubDeprecated();
      await installCommand(project, skillName, options);
    });

  program
    .command("ss", { hidden: true })
    .argument("<keywords...>", "Search keywords")
    .description("Search for skills (alias for: skills search)")
    .action(async (keywords: string[]) => {
      warnSkillHubDeprecated();
      await searchCommand(keywords.join(" "));
    });

  program
    .command("ssg", { hidden: true })
    .option("--global", "Install globally instead of current directory")
    .option("--claude", "Claude Code (.claude/skills/)")
    .option("--cursor", "Cursor (.cursor/skills/)")
    .option("--universal", "Universal (.agents/skills/)")
    .option("--antigravity", "Antigravity (.agent/skills/)")
    .description("Suggest skills (alias for: skills suggest)")
    .action(async (options: SuggestOptions) => {
      warnSkillHubDeprecated();
      await suggestCommand(options);
    });
}

async function installCommand(
  input: string,
  skillName: string | undefined,
  options: AddOptions
): Promise<void> {
  trackEvent("command", { name: "install" });
 
```

### Core Architecture Module: `packages/cli/src/commands/upgrade.ts`
```
import { confirm } from "@inquirer/prompts";
import { spawn } from "child_process";
import { Command } from "commander";
import pc from "picocolors";
import { VERSION } from "../constants.js";
import { log } from "../utils/logger.js";
import { trackEvent } from "../utils/tracking.js";
import {
  checkForUpdates,
  getUpgradePlan,
  markUpdateNotificationShown,
  shouldShowUpdateNotification,
  shouldSkipUpdateNotifier,
  type UpgradePlan,
} from "../utils/update-check.js";

interface UpgradeOptions {
  yes?: boolean;
  check?: boolean;
}

export function registerUpgradeCommand(program: Command): void {
  program
    .command("upgrade")
    .description("Check for a newer ctx7 version and upgrade when possible")
    .option("-y, --yes", "Run the suggested upgrade command without prompting")
    .option("--check", "Only check for updates without running the upgrade command")
    .action(async (options: UpgradeOptions) => {
      await upgradeCommand(options);
    });
}

function runCommand(command: string, args: string[]): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("close", (code) => resolve(code));
  });
}

export async function runUpgradePlan(plan: UpgradePlan): Promise<number | null> {
  return runCommand(plan.command, plan.args);
}

function showUpgradeFailureHelp(plan: UpgradePlan): void {
  log.info(`Try rerunning: ${pc.cyan(plan.displayCommand)}`);

  const isGlobalNpmInstall =
    (plan.installMethod === "npm-global" || plan.installMethod === "unknown") &&
    plan.command === "npm" &&
    plan.args.includes("-g");
  const isGlobalAltInstall =
    (plan.installMethod === "pnpm-global" || plan.installMethod === "bun-global") &&
    plan.args.includes("-g");

  if (isGlobalNpmInstall) {
    log.dim(
      "If this failed due to permissions, your global npm directory may require elevated privileges on this machine."
    );
  } else if (isGlobalAltInstall) {
    log.dim(
      "If this failed due to permissions, your global package manager install location may require additional privileges on this machine."
    );
  }
}

export async function maybeShowUpgradeNotice(
  options: {
    actionName?: string;
    argv?: string[];
    isInteractive?: boolean;
  } = {}
): Promise<void> {
  const actionName = options.actionName ?? "";
  const argv = options.argv ?? process.argv;
  const isInteractive =
    options.isInteractive ?? Boolean(process.stdout.isTTY && process.stdin.isTTY);

  if (!isInteractive || shouldSkipUpdateNotifier(argv) || actionName === "upgrade") {
    return;
  }

  const info = await checkForUpdates();
  if (!info || !info.updateAvailable || !(await shouldShowUpdateNotification(info))) {
    return;
  }

  log.blank();
  if (info.upgradePlan.needsExplicitVersion) {
    log.box([
      `${pc.white(pc.bold("Update available:"))} ${pc.green(pc.bold(`v${info.currentVersion}`))} ${pc.dim("->")} ${pc.green(pc.bold(`v${info.latestVersion}`))}`,
      `${pc.white("Use")} ${pc.yellow(pc.bold(info.upgradePlan.displayCommand))} ${pc.white("to run the latest version")}`,
    ]);
    await markUpdateNotificationShown(info.latestVersion);
    log.blank();
    return;
  }

  if (!info.upgradePlan.canRun) {
    log.box([
      `${pc.white(pc.bold("Update available:"))} ${pc.green(pc.bold(`v${info.currentVersion}`))} ${pc.dim("->")} ${pc.green(pc.bold(`v${info.latestVersion}`))}`,
      `${pc.white("Run")} ${pc.yellow(pc.bold("ctx7 upgrade"))} ${pc.white("for update steps")}`,
      `${pc.white("Or run")} ${pc.yellow(info.upgradePlan.displayCommand)}`,
    ]);
    await markUpdateNotificationShown(info.latestVersion);
    log.blank();
    return;
  }

  log.box([
    `${pc.white(pc.bold("Update available:"))} ${pc.green(pc.bold(`v${info.currentVersion}`))} ${pc.dim("->")} ${pc.green(pc.bold(`v${info.latestVersion}`))}`,
    `${pc.white("Run")} ${pc.yellow(pc.bold("ctx7 upgrade"))} ${pc.white("to update now")}`,
    `${pc.white("Or run")} ${pc.yellow(info.upgradePlan.displayCommand)}`,
  ]);
  await markUpdateNotificationShown(info.latestVersion);
  log.blank();
}

async function upgradeCommand(options: UpgradeOptions): Promise<void> {
  trackEvent("command", { name: "upgrade" });

  const info = await checkForUpdates({ force: true });
  const plan = info?.upgradePlan ?? getUpgradePlan();

  if (!info) {
    log.warn("Couldn't check for updates right now.");
    log.info(`Try again later or run ${pc.cyan(plan.displayCommand)} manually.`);
    return;
  }

  if (!info.updateAvailable) {
    log.success(`ctx7 is up to date (${pc.bold(`v${VERSION}`)})`);
    return;
  }

  log.blank();
  log.info(
    `Update available: ${pc.bold(`v${info.currentVersion}`)} ${pc.dim("->")} ${pc.bold(`v${info.latestVersion}`)}`
  );

  if (plan.needsExplicitVersion) {
    log.info(`You're using an ephemeral runner (${plan.installMethod}).`);
    log.info(`Use ${pc.cyan(plan.displayCommand)} to run the latest version immediately.`);
    log.info(`Or install globally with ${pc.cyan("npm install -g ctx7@latest")}.`);
    return;
  }

  if (!plan.canRun) {
    log.info(`Run ${pc.cyan(plan.displayCommand)} to update your installed version.`);
    return;
  }

  log.info(`Upgrade command: ${pc.cyan(plan.displayCommand)}`);

  if (options.check) {
    return;
  }

  let shouldRun = options.yes ?? false;
  if (!shouldRun && process.stdout.isTTY) {
    shouldRun = await confirm({
      message: `Run ${plan.displayCommand} now?`,
      default: true,
    });
  }

  if (!shouldRun) {
    log.dim("Upgrade skipped.");
    return;
  }

  log.blank();
  const exitCode = await runUpgradePlan(plan);

  if (exitCode === 0) {
    log.blank();
    log.success("Upgrade complete.");
    log.info(`Run ${pc.cyan("ctx7 --version")} to verify the installed version.`);
    return;
  }

  log.blank();
  log.error(`Upgrade command exited with code ${exitCode ?? "unknown"}.`);
  showUpgradeFailureHelp(plan);
  process.exitCode = 1;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3167** (2026-09-23): **[Bug]: context7 Claude Code plugin always fails with HTTP 401 when CONTEXT7_API_KEY is not set**
  *Symptoms*: ## Summary  The official `context7` plugin for Claude Code ships an `.mcp.json` that always sends an `Authorization` header, defaulting to an **empty string** when `CONTEXT7_API_KEY` is unset.  Because the header is present (even though empty), Claude Code considers the server "pre-authenticated" and **disables its OAuth fallback**. The empty header is then rejected by `https://mcp.context7.com/mcp` with HTTP 401, and the server can never connect.  Completing the browser OAuth flow does not help: the token is obtained and stored successfully, but it is never attached to the request because the static header takes precedence.  ## Environment  | Item | Value | | --- | --- | | Plugin | `context7@claude-plugins-official` | | Claude Code | VS Code extension (native extension host) | | OS | Windows 10 Enterprise LTSC 2021 (19044) | | Shell | PowerShell 5.1 | | `CONTEXT7_API_KEY` | not set (process, User and Machine scopes all empty) |  ## Offending configuration  `external_plugins/context7/.mcp.json`:  ```json {   "mcpServers": {     "context7": {       "type": "http",       "url": "https://mcp.context7.com/mcp?client=claude-code-plugin",       "headers": {         "Authorization": "${CONTEXT7_API_KEY:-}"       }     }   } } ```  When `CONTEXT7_API_KEY` is unset, the `:-` default expands to an empty string, so the client sends a literal `Authorization:` header with no value.  ## Steps to reproduce  1. Make sure `CONTEXT7_API_KEY` is **not** defined in the environment. 2. Install th
  **Post-Mortem & Fix Analysis**:
  > Hey @LeXaMeN, we're aware of this issue and talking with Anthropic team to resolve it as soon as possible. 
  > Looks like the issue is with the plugin sending an empty `Authorization` header when `CONTEXT7_API_KEY` isn't set, which prevents the OAuth fallback from kicking in. Have you tried adjusting the `.mcp.json` to avoid sending the header if the key is unset? 
  > This is fixed so closing

- **Issue #3162** (2026-09-21): **[Bug]: Error checking public website during Context7 submission**
  *Symptoms*: ### MCP Client  Other (specify in description)  ### Context7 MCP Version  N/A — remote Streamable HTTP MCP endpoint; no local @upstash/context7-mcp package installed  ### Bug Description  MCP Client: Other (ChatGPT Desktop / Codex Desktop)  Submitting the public Pilot documentation website to Context7 fails with “Error checking website”.  The Context7 API key is valid: library searches succeed. However, submitting either the website root or its static documentation index does not return a library identifier.  This appears to be a website validation/crawling issue rather than an authentication issue.  ### Steps to Reproduce  1. Configure Context7 as a remote Streamable HTTP MCP server at:    https://mcp.context7.com/mcp  2. Authenticate with a valid Context7 API key stored securely outside project files.  3. Confirm authentication works with:    GET /api/v2/libs/search  4. Submit the public website through:    POST /api/v2/add/website     {      "websiteUrl": "https://doc.pilot-gps.com/",      "websiteBaseUrl": "https://doc.pilot-gps.com/"    }  5. Retry with the static documentation index:     {      "websiteUrl": "https://doc.pilot-gps.com/contents.html",      "websiteBaseUrl": "https://doc.pilot-gps.com/"    }  ### Expected Behavior  Context7 should validate and submit the public documentation website successfully, returning a library identifier for later documentation queries.  ### Actual Behavior  Both website-submission requests take approximately 30 seconds and fail. No
  **Post-Mortem & Fix Analysis**:
  > I will take this issue. Please assign it to me.  The problem seems to be with the website validation or crawling process. The error message "Error checking website" suggests this. I will first check the code handling the POST request to `/api/v2/add/website`. I will look for any conditions or exceptions that might cause this error. A small fix might involve adjusting the validation logic or improving error handling to provide more specific feedback. I'll also verify if the absence of llms.txt, sitemap.xml, or robots.txt affects the process. 
  > Hi, sorry for the delay. The issue is now fixed and library is being processed [here](https://context7.com/websites/doc_pilot-gps). Thanks for reporting.

- **Issue #3132** (2026-09-08): **[Bug]: Retrofit documentation is outdated: Context7 returns 2.11.0 instead of latest 3.0.0**
  *Symptoms*: ### MCP Client  Other (specify in description)  ### Context7 MCP Version  latest  ### Bug Description  ## Description  Context7 appears to return outdated documentation for Retrofit.  When using Context7 through the remote MCP server in Codex Desktop, Context7 resolves Retrofit to:  `/lysine-dev/retrofit`  However, the documentation returned by Context7 appears to be based on Retrofit 2.11.0.  The latest stable version of Retrofit is 3.0.0.  ## Steps to reproduce  1. Configure Context7 in Codex Desktop using the remote MCP server:     `https://mcp.context7.com/mcp`  2. Ask Codex:     > Please use Context7 to check the latest version of Retrofit and show me the basic usage of Retrofit.Builder.  3. Context7 resolves Retrofit to:     `/lysine-dev/retrofit`  4. Context7 returns documentation and examples based on Retrofit 2.11.0.  ## Expected behavior  Context7 should return documentation for the latest stable version of Retrofit (3.0.0), or clearly indicate which version the returned documentation belongs to.  If Context7 intentionally provides documentation for an older version, it would be helpful to clearly identify the version so that users do not mistake it for the latest documentation.  ## Actual behavior  Context7 returns documentation based on Retrofit 2.11.0, even though Retrofit 3.0.0 is the latest stable release.  This can potentially cause an AI coding agent to generate code based on outdated APIs or dependencies.  ## Environment  - Client: Codex Desktop - MCP: Conte
  **Post-Mortem & Fix Analysis**:
  > Hi, the latest version uses the default branch's latest code, but i've added version 3.0 for you as well https://context7.com/lysine-dev/retrofit/3.0.0?tab=logs 

- **Issue #3095** (2026-08-28): **[Bug]: pdf upload failed**
  *Symptoms*: ### MCP Client  Other (specify in description)  ### Context7 MCP Version  new  ### Bug Description  when i try to upload a pfd into my pro account it fails  ### Steps to Reproduce  go to upload a pfd in the admin and it wont upload. pdf size is 7mb  ### Expected Behavior  pdf to upload to my account  ### Actual Behavior  pdf failed to upload  ### Error Messages / Logs  ```shell none ```  ### Transport Method  http  ### Node.js Version  _No response_  ### Operating System  _No response_  ### Configuration  ```json  ```  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hey, could you give it another shot? We've just released the new version of our PDF converter. It should be working fine right now.
  > Works thanksCorey WalterOn Aug 28, 2026, at 4:12 AM, Fahreddin Özcan ***@***.***> wrote:﻿fahreddinozcan left a comment (upstash/context7#3095) Hey, could you give it another shot? We've just released the new version of our PDF converter. It should be working fine right now.  —Reply to this email directly, view it on GitHub, or unsubscribe.You are receiving this because you authored the thread.Message ID: ***@***.***>

- **Issue #3074** (2026-08-25): **[Bug]: Error checking website**
  *Symptoms*: ### MCP Client  Other (specify in description)  ### Context7 MCP Version  not applicable  ### Bug Description  I tried using https://context7.com/add-library?tab=website to add official documentation for NTSL language for Nelogica's Profit trading platform. It is hosted at https://ajuda.nelogica.com.br/hc/pt-br/articles/360046443212-Documenta%C3%A7%C3%A3o-NTSL-Compilado-de-fun%C3%A7%C3%B5es-e-instru%C3%A7%C3%B5es-de-usabilidade with a main link to https://www.nelogica.com.br/manualntsl that redirects to (https://downloadserver-cdn.nelogica.com.br/content/profit/manual_ntsl/ManualNTSL.pdf). I tried different combinations of the 3 links but it always lead to "Error checking website If you think this is a mistake, please open an issue."  ### Steps to Reproduce  1. Visit https://context7.com/add-library?tab=website 2. Fill in the URL/advanced fields with any combination of  https://www.nelogica.com.br/manualntsl , https://downloadserver-cdn.nelogica.com.br/content/profit/manual_ntsl/ManualNTSL.pdf , or https://ajuda.nelogica.com.br/hc/pt-br/articles/360046443212-Documenta%C3%A7%C3%A3o-NTSL-Compilado-de-fun%C3%A7%C3%B5es-e-instru%C3%A7%C3%B5es-de-usabilidade  ### Expected Behavior  Accepts documentation  ### Actual Behavior  Error  ### Error Messages / Logs  ```shell  ```  ### Transport Method  stdio (default)  ### Node.js Version  _No response_  ### Operating System  _No response_  ### Configuration  ```json  ```  ### Additional Context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed report. We investigated this and confirmed the problem. The manualntsl URL redirects directly to a PDF. Our website importer currently expects HTML documentation and does not support direct or redirected PDF URLs, so it incorrectly returns the generic “Error checking website” message. As a workaround, please download ManualNTSL.pdf and add it using the PDF Upload tab on the Add Library page. We’ll track improving the error message and handling PDF redirects more gracefully. Thanks again for reporting this!

- **Issue #2970** (2026-08-02): **[Bug]: OAuth metadata mismatch: token_endpoint_auth_methods_supported says "client_secret_basic" but token endpoint expects client_secret_post**
  *Symptoms*: ### MCP Client  Other (specify in description)  ### Context7 MCP Version  N/A (using remote MCP)  ### Bug Description  `https://context7.com/.well-known/oauth-authorization-server` advertises: ``` "token_endpoint_auth_methods_supported": [     "client_secret_basic",     "client_secret_post" ] ``` Basic authentication exchange fails:  ```shell curl \   --basic \   --user "$CLIENT_ID:$CLIENT_SECRET" \   -X POST https://context7.com/api/oauth/token \   -H 'Content-Type: application/x-www-form-urlencoded' \   --data-urlencode 'grant_type=authorization_code' \   --data-urlencode "code=$CODE" \   --data-urlencode "redirect_uri=$REDIRECT_URI" \   --data-urlencode "code_verifier=$CODE_VERIFIER" ```  ```json {"error":"invalid_request","error_description":"The request is missing a required parameter, includes an invalid parameter value, includes a parameter more than once, or is otherwise malformed. Client credentials missing or malformed in both HTTP Authorization header and HTTP POST body."} ```  ### Steps to Reproduce  1. Configure Basic Authentication ```shell AUTH_METHOD='client_secret_basic' REDIRECT_URI='http://localhost:8765/callback' ```  2. Dynamically Register the Client ```shell REG=$(curl -sS -X POST https://context7.com/api/oauth/register \   -H 'Content-Type: application/json' \   -d "$(jq -n \     --arg redirect "$REDIRECT_URI" \     --arg method "$AUTH_METHOD" \     '{       redirect_uris: [$redirect],       client_name: "curl-oauth-reproduction",       grant_types: ["
  **Post-Mortem & Fix Analysis**:
  > Hey, investigating.
  > We found the root cause. There was a mistake on our proxy causing some headers to be dropped. Will be fixed soon.
  > Should be fixed now!

- **Issue #2963** (2026-08-02): **[Bug]: Codex MCP server enabled but Context7 tools are not exposed**
  *Symptoms*: ### MCP Client  Other (specify in description)  ### Context7 MCP Version  0.5.6  ### Bug Description  After successful `npx ctx7 setup`, Codex recognizes Context7 as an enabled MCP server, but the active Codex task does not expose any Context7 tools. In particular, `resolve-library-id` and `query-docs` are missing, so I cannot perform an end-to-end documentation lookup.  ### Steps to Reproduce  1. Run `npx ctx7 setup`. 2. Choose “MCP server” and “Codex”. 3. Authenticate successfully. 4. Start a Codex task. 5. Attempt to discover or invoke Context7 tools such as `resolve-library-id` or `query-docs`.  ### Expected Behavior  The Context7 MCP server loads into the Codex task and exposes its documentation lookup tools, including `resolve-library-id` and `query-docs`.  ### Actual Behavior  The installer reports success and `codex mcp list` shows Context7 as enabled, but the active task has no callable Context7 tools. Because the tools are absent, no library-resolution or documentation-query request can be made.  ### Error Messages / Logs  ```shell `codex mcp list`:  Name       Url                              Status   Auth context7   https://mcp.context7.com/mcp     enabled  Unsupported  Expected tools missing from the active task: - resolve-library-id - query-docs ```  ### Transport Method  http  ### Node.js Version  Node.js: v26.0.0  ### Operating System  macOS: 26.5.1  ### Configuration  ```json [mcp_servers.context7] type = "http" url = "https://mcp.context7.com/mcp"  [mcp_serv
  **Post-Mortem & Fix Analysis**:
  > Hey, this issue is due to Codex starting an unnecessary OAuth flow in a case where it shouldn't and fail. It behaves against the spec unless you set header as `Authotization: Bearer XXXX`.  If you rerun the `npx ctx7@latest setup` command now with `0.5.7`, your config should be updated and the issue is fixed. Please let me know.

- **Issue #2947** (2026-07-29): **[Bug]: Unable to parse Quantinuum's Guppy language guide**
  *Symptoms*: ### MCP Client  Cursor  ### Context7 MCP Version  3.2.5  ### Bug Description  This is a new library built on top of Python for Quantum Computing: https://docs.quantinuum.com/guppy/language_guide/language_guide_index.html  <img width="1920" height="1265" alt="Image" src="https://github.com/user-attachments/assets/32adf233-27e3-48d2-b796-c602710c253b" />  Here's the error message: No snippets found in the repo  ``` Jul 22, 19:29:57 Skipping file language_guide.md: File too small (29 chars) Jul 22, 19:29:57 Parsing completed Jul 22, 19:29:57 Finalizing project with error Jul 22, 19:29:57 No snippets found in the repo Jul 22, 19:29:57 Process completed with failure ```  ### Steps to Reproduce  1. Opened https://context7.com/add-library?tab=website 2. Pasted [https://docs.quantinuum.com/guppy/language_guide/language_guide_index.html](this URL) in the URL field 3. Clicked Submit  <img width="1920" height="1117" alt="Image" src="https://github.com/user-attachments/assets/ec9ea2b1-3e7d-4309-a8c9-bcb6014b43d8" />  ### Expected Behavior  Should get web crawler to start parsing  ### Actual Behavior  Unable to fetch via MCP because web crawler couldn't complete its process.  ### Error Messages / Logs  ```shell Jul 22, 19:29:32 Repository cloned successfully Jul 22, 19:29:32 Starting repository analysis using model: google/gemini-3.5-flash Jul 22, 19:29:56 Repository analysis completed (cost: $0.031737) Jul 22, 19:29:56 Cleaned up isolated directory: /tmp/context7-opencode-wr5V6A Jul 22, 
  **Post-Mortem & Fix Analysis**:
  > Hi, the issue is fixed now. Here is the [refreshed project](https://context7.com/websites/quantinuum_guppy).

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

### Incident Patch 1: `d812afe2` (2026-09-28)
**Commit Message**: fix(claude-plugin): match the official plugin and drop the API key header (#3252)

* fix(claude-plugin): drop API key header so OAuth works

Match the official marketplace config without the Authorization header,
and prepare the plugin for the Claude directory portal.

* chore(claude-plugin): match the official plugin contents

Remove the skill, agent, and command so the plugin only ships the MCP
server, like the listing in claude-plugins-official.

* docs(claude-plugin): update Claude Code docs for the MCP-only plugin

Remove the skill, agent, command, and CONTEXT7_API_KEY docs, point API
key users to ctx7 setup or a manual MCP config, and narrow the README
data statement to the tool-call parameters the model writes.

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
       "name": "context7",
       "source": "./plugins/claude/context7",
       "description": "Up-to-date documentation lookup. Pull version-specific documentation and code examples directly from source repositories into your LLM context.",
-      "version": "1.0.3"
+      "version": "1.0.4"
     }
   ]
 }
```

**File**: `docs/clients/claude-code.mdx` (modified, +5/-123)
```diff
@@ -3,7 +3,7 @@ title: Claude Code
 description: Using Context7 with Claude Code
 ---
 
-Context7 integrates with Claude Code to provide current library documentation instead of relying on training data. Claude Code supports skills, agents, and commands that make documentation lookups more powerful.
+Context7 integrates with Claude Code to provide current library documentation instead of relying on training data. Set it up with `ctx7 setup`, or install the Context7 plugin.
 
 ## Installation
 
@@ -36,30 +36,11 @@ use context7 with /supabase/supabase for authentication docs
 use context7 with /vercel/next.js for app router setup
 ```
 
-<Tip>
-With the [Context7 plugin](#the-context7-plugin) installed, you get additional agents and commands on top of the skill.
-</Tip>
-
 ---
 
 ## The Context7 Plugin
 
-The full Context7 plugin for Claude Code includes more than just the MCP server:
-
-<CardGroup cols={2}>
-<Card title="MCP Server" icon="server">
-The tools for fetching documentation (`resolve-library-id`, `query-docs`)
-</Card>
-<Card title="Skills" icon="sparkles">
-Auto-triggers documentation lookups when you ask about libraries
-</Card>
-<Card title="Agents" icon="robot">
-A `docs-researcher` agent for focused lookups that keep context lean
-</Card>
-<Card title="Commands" icon="terminal">
-`/context7:docs` for manual documentation queries
-</Card>
-</CardGroup>
+The Context7 plugin connects Claude Code to the hosted Context7 MCP server (`https://mcp.context7.com/mcp`). It adds the `resolve-library-id` and `query-docs` tools, with no local Node.js, npm, or npx required.
 
 ### Installing the Plugin
 
@@ -70,109 +51,10 @@ The plugin is available from the Context7 marketplace. Run these commands in Cla
 /plugin install context7@context7-marketplace
 ```
 
-This adds the Context7 marketplace and installs the plugin with skills, agents, and commands.
-
-### Using Your API Key with the Plugin
-
-Without an API key, the plugin connects anonymously and shares the anonymous rate limits. To use your own plan, create an API key in the [Context7 dashboard](https://context7.com/dashboard) and export it as an environment variable before launching Claude Code:
+### Signing In
 
-```bash
-# e.g. in ~/.zshrc or ~/.bashrc
-export CONTEXT7_API_KEY="your-api-key"
-```
-
-The plugin reads `CONTEXT7_API_KEY` from your environment automatically. Restart Claude Code after setting it, then confirm requests are counted against your plan in the [dashboard](https://context7.com/dashboard).
+After installing the plugin, restart Claude Code and run `/mcp`. Select Context7 and follow the browser sign-in flow. No API key is required.
 
 <Note>
-If the variable is not set, the plugin still works — requests just go through the anonymous tier, which has lower rate limits.
+The plugin does not read `CONTEXT7_API_KEY`. To use an API key, for example on a headless, SSH, or CI host, run `npx ctx7 setup --claude` or add the MCP server manually as described in [All MCP Clients](/resources/all-clients).
 </Note>
-
-### Skills
-
-#### Documentation Lookup Skill
-
-This skill triggers automatically when you ask about libraries, frameworks, or need code examples. You don't need to type "use context7" — the skill recognizes when documentation would help.
-
-<AccordionGroup>
-<Accordion title="What triggers the skill">
-- Setup questions: "How do I configure Next.js middleware?"
-- Code generation: "Write a Prisma query for user relations"
-- API references: "What are the Supabase auth methods?"
-- Framework mentions: React, Vue, Svelte, Express, Tailwind, etc.
-</Accordion>
-<Accordion title="How it works">
-1. **Resolve**: Finds the library ID using `resolve-library-id` with your question as context
-2. **Select**: Picks the best match based on name accuracy and quality scores
-3. **Fetch**: Calls `query-docs` with the library ID and your specific question
-4. **Return**: Provides code examples and explanations from current documentation
-</Accordion>
-</AccordionGr
```

**File**: `packages/cli/src/__tests__/plugin-manifests.test.ts` (modified, +5/-19)
```diff
@@ -1,34 +1,20 @@
 import { describe, test, expect } from "vitest";
 import { readFile } from "fs/promises";
 import { join } from "path";
-import { execFile } from "child_process";
-import { promisify } from "util";
 
 const REPO_ROOT = join(import.meta.dirname, "..", "..", "..", "..");
-const execFileAsync = promisify(execFile);
 
 describe("plugin MCP manifests", () => {
-  test("Claude uses an API key only when one is set", async () => {
+  test("Claude sends no Authorization header so OAuth can run", async () => {
     const relPath = "plugins/claude/context7/.mcp.json";
     const raw = await readFile(join(REPO_ROOT, relPath), "utf-8");
     const config = JSON.parse(raw) as {
-      mcpServers: { context7: { headers?: Record<string, string>; headersHelper: string } };
+      mcpServers: { context7: Record<string, unknown> };
     };
-    expect(config.mcpServers.context7.headers).toBeUndefined();
-    expect(config.mcpServers.context7.headersHelper).toBe(
-      'node "${CLAUDE_PLUGIN_ROOT}/scripts/headers.mjs"'
-    );
-
-    const helper = join(REPO_ROOT, "plugins/claude/context7/scripts/headers.mjs");
-    const withoutKey = await execFileAsync(process.execPath, [helper], {
-      env: { ...process.env, CONTEXT7_API_KEY: "" },
-    });
-    expect(JSON.parse(withoutKey.stdout)).toEqual({});
-
-    const withKey = await execFileAsync(process.execPath, [helper], {
-      env: { ...process.env, CONTEXT7_API_KEY: "ctx7sk-test" },
+    expect(config.mcpServers.context7).toEqual({
+      type: "http",
+      url: "https://mcp.context7.com/mcp?client=claude-code-plugin",
     });
-    expect(JSON.parse(withKey.stdout)).toEqual({ Authorization: "ctx7sk-test" });
   });
 
   test("Copilot passes the raw API key via Authorization", async () => {
```

**File**: `plugins/claude/context7/.claude-plugin/plugin.json` (modified, +9/-3)
```diff
@@ -1,8 +1,14 @@
 {
   "name": "context7",
-  "version": "1.0.3",
+  "version": "1.0.4",
   "description": "Upstash Context7 MCP server for up-to-date documentation lookup. Pull version-specific documentation and code examples directly from source repositories into your LLM context.",
   "author": {
-    "name": "Upstash"
-  }
+    "name": "Upstash",
+    "email": "context7@upstash.com",
+    "url": "https://upstash.com"
+  },
+  "homepage": "https://context7.com",
+  "repository": "https://github.com/upstash/context7",
+  "license": "MIT",
+  "keywords": ["documentation", "context", "mcp", "library-docs"]
 }
```

**File**: `plugins/claude/context7/.mcp.json` (modified, +1/-2)
```diff
@@ -2,8 +2,7 @@
   "mcpServers": {
     "context7": {
       "type": "http",
-      "url": "https://mcp.context7.com/mcp?client=claude-code-plugin",
-      "headersHelper": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/headers.mjs\""
+      "url": "https://mcp.context7.com/mcp?client=claude-code-plugin"
     }
   }
 }
```

---

### Incident Patch 2: `ec97797f` (2026-09-09)
**Commit Message**: fix(pnpm): classify ignored dependency builds (#3170)

**File**: `pnpm-workspace.yaml` (modified, +3/-0)
```diff
@@ -2,6 +2,9 @@ packages:
   - "packages/*"
 
 allowBuilds:
+  "@google/genai": false
   esbuild: true
+  msgpackr-extract: false
+  protobufjs: false
 
 minimumReleaseAge: 10080
```

---

### Incident Patch 3: `0087bab2` (2026-09-09)
**Commit Message**: fix(mcp): allow empty Claude plugin API key (#3168)

**File**: `.changeset/tidy-dogs-connect.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@upstash/context7-mcp": patch
+---
+
+Allow the Claude Code plugin to use anonymous access when its API key header is empty.
```

**File**: `packages/mcp/src/index.ts` (modified, +6/-1)
```diff
@@ -37,7 +37,12 @@ function getPluginFromRequest(req: express.Request): typeof CLAUDE_CODE_PLUGIN |
 
 function requiresAuthentication(req: express.Request, plugin?: typeof CLAUDE_CODE_PLUGIN): boolean {
   // The MCP routes live on a router mounted at /mcp, so req.path is relative to it.
-  return `${req.baseUrl}${req.path}` === "/mcp/oauth" || Boolean(plugin);
+  const isOAuthEndpoint = `${req.baseUrl}${req.path}` === "/mcp/oauth";
+  // The current official Claude plugin expands an unset API key to an empty header.
+  const hasEmptyPluginAuthorization =
+    plugin === CLAUDE_CODE_PLUGIN && req.headers.authorization === "";
+
+  return isOAuthEndpoint || (Boolean(plugin) && !hasEmptyPluginAuthorization);
 }
 
 // Parse CLI arguments using commander
```

**File**: `packages/mcp/test/integration.test.ts` (modified, +14/-2)
```diff
@@ -455,10 +455,22 @@ describe("plugin authentication", () => {
     expect(res.wwwAuthenticate).toContain("/.well-known/oauth-protected-resource");
   });
 
+  test("allows the Claude Code plugin's empty API key fallback", async () => {
+    const res = await postMcp(`${httpUrl}?client=claude-code-plugin`, {
+      Authorization: "",
+    });
+
+    expect(res.status).toBe(200);
+  });
+
   test("keeps the OAuth endpoint protected", async () => {
-    const res = await postMcp(httpUrl.replace(/\/mcp$/, "/mcp/oauth"));
+    const oauthUrl = httpUrl.replace(/\/mcp$/, "/mcp/oauth");
+    const emptyHeaderRes = await postMcp(`${oauthUrl}?client=claude-code-plugin`, {
+      Authorization: "",
+    });
 
-    expect(res.status).toBe(401);
+    expect((await postMcp(oauthUrl)).status).toBe(401);
+    expect(emptyHeaderRes.status).toBe(401);
   });
 
   test("tracks authenticated plugin requests separately", async () => {
```

---

### Incident Patch 4: `4eff2b90` (2026-09-04)
**Commit Message**: feat(sdk): add production HTTP controls and fix review findings (#3137)

* ctx7-2663: address SDK review findings

* ctx7-2663: tighten SDK test architecture

* ctx7-2663: address SDK type review

* feat(sdk): add production HTTP controls

* refactor(sdk): align HTTP conventions with redis-js

* refactor(sdk): decompose HTTP transport

* refactor(sdk): tighten retry API

* ctx7-2663: address latest SDK review

**File**: `.changeset/ctx7-2663-sdk-reviews.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+"@upstash/context7-sdk": minor
+---
+
+Fix response type inference for runtime-selected formats, honor disabled retries, and separate deterministic SDK tests from live API integration tests. Calls that forward options whose response format is selected at runtime now correctly return an array-or-string union and may require result narrowing.
+
+Add production HTTP controls while keeping API-key authentication required: client and per-request timeouts, abort signals, configurable transient HTTP retries, native fetch cache settings, custom fetch/base URL/header/keepalive support, URL validation, response metadata hooks, and structured `Context7Error` fields for status, code, request ID, rate limits, retryability, malformed JSON, and cause.
+
+Requests now time out after 30 seconds by default. Set `timeout: false` on the client or an individual request to disable the timeout.
```

**File**: `.github/workflows/test.yml` (modified, +6/-0)
```diff
@@ -82,3 +82,9 @@ jobs:
         run: pnpm test
         env:
           CONTEXT7_API_KEY: ${{ secrets.CONTEXT7_API_KEY }}
+
+      - name: SDK Integration Test
+        if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
+        run: pnpm --filter @upstash/context7-sdk test:integration
+        env:
+          CONTEXT7_API_KEY: ${{ secrets.CONTEXT7_API_KEY }}
```

**File**: `docs/sdks/ts/commands/get-context.mdx` (modified, +9/-0)
```diff
@@ -26,6 +26,15 @@ Retrieve documentation context for a specific library. Returns documentation as
 
       Default: `"json"`
     </ParamField>
+    <ParamField path="signal" type="AbortSignal">
+      Abort signal for cancelling this request.
+    </ParamField>
+    <ParamField path="timeout" type="number | false">
+      Per-request timeout in milliseconds. Use `false` to disable the client timeout.
+    </ParamField>
+    <ParamField path="cache" type="CacheSetting">
+      Native fetch cache mode. Use `false` to omit the cache option.
+    </ParamField>
   </Expandable>
 </ParamField>
 
```

**File**: `docs/sdks/ts/commands/search-library.mdx` (modified, +17/-0)
```diff
@@ -17,6 +17,23 @@ Search across available libraries. Returns an array of matching libraries with m
   The library name to search for
 </ParamField>
 
+<ParamField path="options" type="SearchLibraryOptions">
+  <Expandable title="properties">
+    <ParamField path="type" type="'json' | 'txt'">
+      Format of the response. Defaults to `json`.
+    </ParamField>
+    <ParamField path="signal" type="AbortSignal">
+      Abort signal for cancelling this request.
+    </ParamField>
+    <ParamField path="timeout" type="number | false">
+      Per-request timeout in milliseconds. Use `false` to disable the client timeout.
+    </ParamField>
+    <ParamField path="cache" type="CacheSetting">
+      Native fetch cache mode. Use `false` to omit the cache option.
+    </ParamField>
+  </Expandable>
+</ParamField>
+
 ## Response
 
 Returns `Library[]` - an array of library objects.
```

**File**: `docs/sdks/ts/getting-started.mdx` (modified, +45/-1)
```diff
@@ -79,6 +79,42 @@ const client = new Context7({
   `process.env.CONTEXT7_API_KEY`
 </Note>
 
+#### Production HTTP configuration
+
+The SDK applies a 30-second request timeout and retries transient network failures, `408`, `425`,
+`429`, and `5xx` responses. Only `GET` requests are retried; mutating requests remain
+single-attempt.
+
+```typescript
+const client = new Context7({
+  apiKey: "YOUR_API_KEY",
+  timeout: 10_000,
+  retry: {
+    retries: 3,
+    backoff: (attempt) => 100 * 2 ** attempt,
+  },
+  onResponse: ({ status, requestId, rateLimit, attempt }) => {
+    console.log({ status, requestId, rateLimit, attempt });
+  },
+});
+```
+
+You can also configure `baseUrl`, additional `headers`, `keepAlive`, the native fetch `cache` mode,
+a client-wide abort `signal`, or a custom `fetch` implementation. The SDK always sets
+`Authorization` from the configured API key; additional headers cannot override it.
+
+Following the same convention as `@upstash/redis`, a signal factory can provide a fresh timeout
+signal for each request:
+
+```typescript
+const client = new Context7({
+  apiKey: "YOUR_API_KEY",
+  signal: () => AbortSignal.timeout(10_000),
+});
+```
+
+Set `retry: false` to make exactly one request or `timeout: false` to disable the default timeout.
+
 ## Quick Start Example
 
 ```typescript
@@ -104,6 +140,7 @@ console.log(docs[0].title, docs[0].content);
 // Get documentation context as plain text
 const context = await client.getContext("How do I use hooks?", "/facebook/react", {
   type: "txt",
+  timeout: 5_000,
 });
 console.log(context);
 ```
@@ -121,7 +158,14 @@ try {
   const context = await client.getContext("query", "/invalid/library");
 } catch (error) {
   if (error instanceof Context7Error) {
-    console.error("Context7 API Error:", error.message);
+    console.error("Context7 API Error:", {
+      message: error.message,
+      code: error.code,
+      status: error.status,
+      requestId: error.requestId,
+      rateLimit: error.rateLimit,
+      retryable: error.retryable,
+    });
   } else {
     console.error("Unexpected error:", error);
   }
```

---

### Incident Patch 5: `76140fc3` (2026-08-31)
**Commit Message**: fix(cli): reuse device login API key during setup (#3109)

**File**: `.changeset/fuzzy-ravens-setup.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"ctx7": patch
+---
+
+Use API keys returned by the device login flow directly during MCP setup instead of sending them to a dashboard session endpoint to generate another key.
```

**File**: `docs/clients/cli.mdx` (modified, +1/-1)
```diff
@@ -148,7 +148,7 @@ ctx7 setup --api-key YOUR_API_KEY
 ctx7 setup --oauth
 ```
 
-Without `--api-key` or `--oauth`, setup runs the OAuth device flow: it shows a verification link and short code that you open on any device to sign in, so it works the same locally or on a remote, headless, or SSH host. MCP mode additionally generates a new API key after login. `--oauth` is MCP-only — use it when an IDE handles the auth flow on your behalf.
+Without `--api-key` or `--oauth`, setup runs the OAuth device flow: it shows a verification link and short code that you open on any device to sign in, so it works the same locally or on a remote, headless, or SSH host. The device flow returns an API key that setup uses for authentication. `--oauth` is MCP-only — use it when an IDE handles the auth flow on your behalf.
 
 **What gets written — MCP mode:**
 
```

**File**: `packages/cli/src/__tests__/auth-commands.test.ts` (modified, +26/-8)
```diff
@@ -7,14 +7,17 @@ const mockSaveTokens = vi.fn();
 const mockStartDeviceAuthorization = vi.fn();
 const mockPollDeviceToken = vi.fn();
 
-vi.mock("../utils/auth.js", () => ({
-  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
-  clearTokens: (...args: unknown[]) => mockClearTokens(...args),
-  saveTokens: (...args: unknown[]) => mockSaveTokens(...args),
-  startDeviceAuthorization: (...args: unknown[]) => mockStartDeviceAuthorization(...args),
-  pollDeviceToken: (...args: unknown[]) => mockPollDeviceToken(...args),
-  DEFAULT_DEVICE_POLL_INTERVAL_SECONDS: 5,
-}));
+vi.mock("../utils/auth.js", async (importOriginal) => {
+  const original = await importOriginal<typeof import("../utils/auth.js")>();
+  return {
+    ...original,
+    getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
+    clearTokens: (...args: unknown[]) => mockClearTokens(...args),
+    saveTokens: (...args: unknown[]) => mockSaveTokens(...args),
+    startDeviceAuthorization: (...args: unknown[]) => mockStartDeviceAuthorization(...args),
+    pollDeviceToken: (...args: unknown[]) => mockPollDeviceToken(...args),
+  };
+});
 
 vi.mock("../utils/tracking.js", () => ({
   trackEvent: vi.fn(),
@@ -148,6 +151,19 @@ describe("whoami command", () => {
     expect(logOutput.some((l) => l.includes("test@example.com"))).toBe(true);
   });
 
+  test("reports API-key authentication without calling the dashboard", async () => {
+    mockGetValidAccessToken.mockResolvedValue("ctx7sk-valid-key");
+    const fetchMock = vi.fn();
+    vi.stubGlobal("fetch", fetchMock);
+
+    await runCommand("whoami");
+
+    expect(logOutput.some((l) => l.includes("Logged in"))).toBe(true);
+    expect(logOutput).toHaveLength(1);
+    expect(logOutput.some((l) => l.includes("Session may be expired"))).toBe(false);
+    expect(fetchMock).not.toHaveBeenCalled();
+  });
+
   test("shows session expired hint when fetch fails", async () => {
     mockGetValidAccessToken.mockResolvedValue("valid-token");
     vi.stubGlobal(
@@ -200,6 +216,8 @@ describe("performLogin", () => {
       access_token: "ctx7sk-x",
       token_type: "bearer",
     });
+    expect(fetch).not.toHaveBeenCalled();
+    expect(mockSpinner.succeed).toHaveBeenCalledWith(expect.stringContaining("API key"));
   });
 
   test("returns null on denied", async () => {
```

**File**: `packages/cli/src/__tests__/auth-utils.test.ts` (modified, +11/-0)
```diff
@@ -22,6 +22,7 @@ import {
   loadTokens,
   clearTokens,
   isTokenExpired,
+  isContext7ApiKey,
   getValidAccessToken,
   startDeviceAuthorization,
   pollDeviceToken,
@@ -220,6 +221,16 @@ describe("isTokenExpired", () => {
   });
 });
 
+describe("isContext7ApiKey", () => {
+  test("recognizes Context7 API keys", () => {
+    expect(isContext7ApiKey("ctx7sk-example")).toBe(true);
+  });
+
+  test("rejects OAuth access tokens", () => {
+    expect(isContext7ApiKey("legacy-oauth-token")).toBe(false);
+  });
+});
+
 describe("getValidAccessToken", () => {
   test("returns undefined when no tokens stored", async () => {
     mfs.existsSync.mockReturnValue(false);
```

**File**: `packages/cli/src/__tests__/setup-auth.test.ts` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+import { beforeEach, describe, expect, test, vi } from "vitest";
+
+const mockGetValidAccessToken = vi.fn();
+vi.mock("../utils/auth.js", async (importOriginal) => {
+  const original = await importOriginal<typeof import("../utils/auth.js")>();
+  return {
+    ...original,
+    getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
+  };
+});
+
+const mockPerformLogin = vi.fn();
+vi.mock("../commands/auth.js", () => ({
+  performLogin: (...args: unknown[]) => mockPerformLogin(...args),
+}));
+
+const mockSpinner = {
+  start: vi.fn().mockReturnThis(),
+  succeed: vi.fn().mockReturnThis(),
+  fail: vi.fn().mockReturnThis(),
+};
+vi.mock("ora", () => ({ default: () => mockSpinner }));
+
+vi.mock("../utils/api.js", async (importOriginal) => {
+  const original = await importOriginal<typeof import("../utils/api.js")>();
+  return {
+    ...original,
+    getBaseUrl: () => "https://test.context7.com",
+  };
+});
+
+import { resolveSetupApiKey } from "../setup/auth.js";
+
+describe("setup authentication", () => {
+  beforeEach(() => {
+    vi.clearAllMocks();
+    vi.unstubAllGlobals();
+  });
+
+  test("uses a stored device-flow API key directly", async () => {
+    mockGetValidAccessToken.mockResolvedValue("ctx7sk-device-key");
+    const fetchMock = vi.fn();
+    vi.stubGlobal("fetch", fetchMock);
+
+    await expect(resolveSetupApiKey()).resolves.toBe("ctx7sk-device-key");
+
+    expect(mockPerformLogin).not.toHaveBeenCalled();
+    expect(fetchMock).not.toHaveBeenCalled();
+    expect(mockSpinner.start).not.toHaveBeenCalled();
+  });
+
+  test("uses a newly authenticated device-flow API key directly", async () => {
+    mockGetValidAccessToken.mockResolvedValue(undefined);
+    mockPerformLogin.mockResolvedValue("ctx7sk-new-key");
+    const fetchMock = vi.fn();
+    vi.stubGlobal("fetch", fetchMock);
+
+    await expect(resolveSetupApiKey()).resolves.toBe("ctx7sk-new-key");
+
+    expect(fetchMock).not.toHaveBeenCalled();
+  });
+
+  test("still exchanges a legacy OAuth access token for an API key", async () => {
+    mockGetValidAccessToken.mockResolvedValue("legacy-oauth-token");
+    const fetchMock = vi.fn().mockResolvedValue({
+      ok: true,
+      json: () => Promise.resolve({ data: { apiKey: "ctx7sk-generated-key" } }),
+    });
+    vi.stubGlobal("fetch", fetchMock);
+
+    await expect(resolveSetupApiKey()).resolves.toBe("ctx7sk-generated-key");
+
+    expect(fetchMock).toHaveBeenCalledWith(
+      "https://test.context7.com/api/dashboard/api-keys",
+      expect.objectContaining({
+        method: "POST",
+        headers: expect.objectContaining({ Authorization: "Bearer legacy-oauth-token" }),
+      })
+    );
+  });
+});
```

---

### Incident Patch 6: `2a851fcd` (2026-08-31)
**Commit Message**: fix(mcp): remove legacy client IP encryption (#3112)

**File**: `.changeset/remove-legacy-client-ip.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@upstash/context7-mcp": patch
+---
+
+Remove the legacy AES-CBC client-IP header now that authenticated assertions are deployed.
```

**File**: `.env.example` (modified, +0/-3)
```diff
@@ -16,9 +16,6 @@ MCP_CLIENT_IP_ASSERTION_KEY=
 # Maximum concurrent MCP subscription streams per HTTP process.
 MCP_MAX_SUBSCRIPTIONS=16000
 
-# Temporary legacy rollout key. Removal is tracked by CTX7-2536.
-CLIENT_IP_ENCRYPTION_KEY=
-
 # Network / certificates
 HTTPS_PROXY=
 NODE_EXTRA_CA_CERTS=
```

**File**: `docs/security/data-privacy.mdx` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ When you use Context7 through an MCP client, the AI assistant (not the user dire
 - API key (if provided, for authentication)
 - MCP client name and version (e.g., IDE info, for analytics)
 - Transport type (`stdio` or `http`)
-- Client IP address, encrypted with AES-256-CBC (HTTP transport only, for rate limiting)
+- Client IP address, sent as a short-lived authenticated AES-256-GCM assertion by hosted HTTP deployments (for rate limiting)
 
 <Note>
   The MCP client formulates search queries on your behalf and is instructed not to include
```

**File**: `packages/mcp/src/lib/encryption.ts` (modified, +4/-27)
```diff
@@ -3,7 +3,6 @@ import { isIP } from "node:net";
 import { SERVER_VERSION } from "./constants.js";
 import type { ClientContext } from "./types.js";
 
-const LEGACY_ALGORITHM = "aes-256-cbc";
 const ASSERTION_ALGORITHM = "aes-256-gcm";
 const ASSERTION_VERSION = "v1";
 let reportedInvalidAssertionKey = false;
@@ -13,26 +12,11 @@ function validateEncryptionKey(key: string): boolean {
   return /^[0-9a-fA-F]{64}$/.test(key);
 }
 
-function encryptionKey(name: "MCP_CLIENT_IP_ASSERTION_KEY" | "CLIENT_IP_ENCRYPTION_KEY") {
-  const key = process.env[name];
+function assertionKey() {
+  const key = process.env.MCP_CLIENT_IP_ASSERTION_KEY;
   return key && validateEncryptionKey(key) ? Buffer.from(key, "hex") : null;
 }
 
-/**
- * Temporary compatibility header for API deployments that predate authenticated assertions.
- * This header is ignored by patched API deployments. Removal is tracked by CTX7-2536.
- */
-function encryptLegacyClientIp(clientIp: string, key: Buffer): string | null {
-  try {
-    const iv = randomBytes(16);
-    const cipher = createCipheriv(LEGACY_ALGORITHM, key, iv);
-    const encrypted = Buffer.concat([cipher.update(clientIp, "utf8"), cipher.final()]);
-    return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
-  } catch {
-    return null;
-  }
-}
-
 /**
  * Create a short-lived, authenticated client-IP assertion.
  * Format: v1:<unix timestamp seconds>:<12-byte nonce hex>:<ciphertext + tag hex>
@@ -42,7 +26,7 @@ export function createClientIpAssertion(
   nowMs = Date.now(),
   nonce = randomBytes(12)
 ): string | null {
-  const key = encryptionKey("MCP_CLIENT_IP_ASSERTION_KEY");
+  const key = assertionKey();
   if (!key) {
     if (!reportedInvalidAssertionKey) {
       reportedInvalidAssertionKey = true;
@@ -79,14 +63,7 @@ export function generateHeaders(context: ClientContext): Record<string, string>
 
   if (context.clientIp) {
     const assertion = createClientIpAssertion(context.clientIp);
-    if (assertion) {
-      headers["mcp-client-ip-assertion"] = assertion;
-
-      // Producer-first rollout compatibility. Removal is tracked by CTX7-2536.
-      const key = encryptionKey("CLIENT_IP_ENCRYPTION_KEY");
-      const legacyValue = key ? encryptLegacyClientIp(context.clientIp, key) : null;
-      if (legacyValue) headers["mcp-client-ip"] = legacyValue;
-    }
+    if (assertion) headers["mcp-client-ip-assertion"] = assertion;
   }
   if (context.sessionId) {
     headers["mcp-session-id"] = context.sessionId;
```

**File**: `packages/mcp/test/encryption.test.ts` (modified, +2/-5)
```diff
@@ -8,12 +8,10 @@ const NONCE = Buffer.from("00112233445566778899aabb", "hex");
 describe("client IP assertions", () => {
   beforeEach(() => {
     process.env.MCP_CLIENT_IP_ASSERTION_KEY = KEY;
-    process.env.CLIENT_IP_ENCRYPTION_KEY = KEY;
   });
 
   afterEach(() => {
     delete process.env.MCP_CLIENT_IP_ASSERTION_KEY;
-    delete process.env.CLIENT_IP_ENCRYPTION_KEY;
   });
 
   test("creates a versioned AES-GCM assertion", () => {
@@ -24,16 +22,15 @@ describe("client IP assertions", () => {
     );
   });
 
-  test("emits authenticated and rollout-compatible headers", () => {
+  test("emits only the authenticated assertion header", () => {
     const headers = generateHeaders({ clientIp: "203.0.113.99" });
 
     expect(headers["mcp-client-ip-assertion"]).toMatch(/^v1:/);
-    expect(headers["mcp-client-ip"]).toMatch(/^[0-9a-f]{32}:[0-9a-f]+$/);
+    expect(headers["mcp-client-ip"]).toBeUndefined();
   });
 
   test("fails closed instead of sending plaintext when the key is absent or invalid", () => {
     delete process.env.MCP_CLIENT_IP_ASSERTION_KEY;
-    delete process.env.CLIENT_IP_ENCRYPTION_KEY;
     expect(
       generateHeaders({ clientIp: "203.0.113.99" })["mcp-client-ip-assertion"]
     ).toBeUndefined();
```

---

### Incident Patch 7: `4e980f6b` (2026-08-28)
**Commit Message**: fix(mcp): increase HTTP subscription capacity (#3101)

* fix(mcp): increase HTTP subscription capacity

* fix(mcp): use benchmarked subscription capacity

* fix(mcp): set subscription ceiling to 24k

* fix(mcp): start subscription ceiling at 16k

* fix(mcp): clarify subscription limit safeguards

**File**: `.changeset/quiet-dodos-listen.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@upstash/context7-mcp": patch
+---
+
+Increase the default HTTP subscription capacity and allow deployments to configure it with `MCP_MAX_SUBSCRIPTIONS`.
```

**File**: `.env.example` (modified, +3/-0)
```diff
@@ -13,6 +13,9 @@ OPENAI_APPS_CHALLENGE_TOKEN=
 # Required for hosted HTTP deployments. Must match context7.com.
 MCP_CLIENT_IP_ASSERTION_KEY=
 
+# Maximum concurrent MCP subscription streams per HTTP process.
+MCP_MAX_SUBSCRIPTIONS=16000
+
 # Temporary legacy rollout key. Removal is tracked by CTX7-2536.
 CLIENT_IP_ENCRYPTION_KEY=
 
```

**File**: `packages/mcp/src/index.ts` (modified, +2/-0)
```diff
@@ -24,6 +24,7 @@ import {
   OPENAI_APPS_CHALLENGE_TOKEN,
 } from "./lib/constants.js";
 import { maybeElicitAuthSignIn } from "./lib/auth/auth-prompt.js";
+import { getMaxSubscriptions } from "./lib/subscriptions.js";
 
 /** Default HTTP server port */
 const DEFAULT_PORT = 3000;
@@ -380,6 +381,7 @@ async function main() {
     // go idle and the gateway reaps them at streamIdleTimeout (300s).
     const mcpHandler = createMcpHandler(() => createMcpServer(), {
       keepAliveMs: 0,
+      maxSubscriptions: getMaxSubscriptions(),
       onerror: (error) => console.error("MCP handler error:", error),
     });
     // Without onerror, request-conversion / handler.fetch throws are answered
```

**File**: `packages/mcp/src/lib/subscriptions.ts` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+// 16k stayed near baseline latency in Docker; 32,768 raised tools/list p95 to ~39 ms.
+export const DEFAULT_MAX_SUBSCRIPTIONS = 16_000;
+
+export function getMaxSubscriptions(value = process.env.MCP_MAX_SUBSCRIPTIONS): number {
+  if (value === undefined) return DEFAULT_MAX_SUBSCRIPTIONS;
+
+  const parsed = Number(value);
+  if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
+
+  console.warn(`Invalid MCP_MAX_SUBSCRIPTIONS; using the default of ${DEFAULT_MAX_SUBSCRIPTIONS}.`);
+  return DEFAULT_MAX_SUBSCRIPTIONS;
+}
```

**File**: `packages/mcp/test/subscriptions.test.ts` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+import { afterEach, describe, expect, test, vi } from "vitest";
+import { DEFAULT_MAX_SUBSCRIPTIONS, getMaxSubscriptions } from "../src/lib/subscriptions.js";
+
+describe("getMaxSubscriptions", () => {
+  afterEach(() => {
+    vi.restoreAllMocks();
+  });
+
+  test("defaults to 16000 subscriptions", () => {
+    expect(getMaxSubscriptions(undefined)).toBe(DEFAULT_MAX_SUBSCRIPTIONS);
+  });
+
+  test("accepts a positive integer override", () => {
+    expect(getMaxSubscriptions("8192")).toBe(8_192);
+  });
+
+  test.each(["0", "-1", "1.5", "invalid", "Infinity"])(
+    "falls back for invalid value %s",
+    (value) => {
+      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
+
+      expect(getMaxSubscriptions(value)).toBe(DEFAULT_MAX_SUBSCRIPTIONS);
+      expect(warn).toHaveBeenCalledOnce();
+    }
+  );
+});
```

---

### Incident Patch 8: `794cc6ba` (2026-08-28)
**Commit Message**: fix(mcp): authenticate forwarded client IP assertions (#3088)

* fix(mcp): sign forwarded client IP assertions

* fix(mcp): trust proxy-derived client addresses

* fix(mcp): preserve legacy rollout key

* fix(mcp): validate asserted client addresses

* fix(mcp): retain CGNAT proxy support

**File**: `.changeset/signed-client-ip-assertions.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@upstash/context7-mcp": patch
+---
+
+Authenticate hosted MCP client-IP forwarding with short-lived AES-GCM assertions.
```

**File**: `.env.example` (modified, +5/-0)
```diff
@@ -9,6 +9,11 @@ OAUTH_JWKS_URL=
 EMA_ISSUER=
 AUTH_SERVER_URL=
 OPENAI_APPS_CHALLENGE_TOKEN=
+
+# Required for hosted HTTP deployments. Must match context7.com.
+MCP_CLIENT_IP_ASSERTION_KEY=
+
+# Temporary legacy rollout key. Removal is tracked by CTX7-2536.
 CLIENT_IP_ENCRYPTION_KEY=
 
 # Network / certificates
```

**File**: `packages/mcp/src/index.ts` (modified, +4/-2)
```diff
@@ -24,7 +24,6 @@ import {
   OPENAI_APPS_CHALLENGE_TOKEN,
 } from "./lib/constants.js";
 import { maybeElicitAuthSignIn } from "./lib/auth/auth-prompt.js";
-import { getClientIp } from "./lib/client-ip.js";
 
 /** Default HTTP server port */
 const DEFAULT_PORT = 3000;
@@ -316,6 +315,9 @@ async function main() {
     const initialPort = CLI_PORT ?? DEFAULT_PORT;
 
     const app = express();
+    // Only private/local infrastructure may supply forwarding headers. Express
+    // then walks the chain right-to-left and ignores attacker-added prefixes.
+    app.set("trust proxy", ["loopback", "linklocal", "uniquelocal", "100.64.0.0/10"]);
     app.use(express.json());
 
     app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
@@ -433,7 +435,7 @@ async function main() {
         }
 
         const context: ClientContext = {
-          clientIp: getClientIp(req),
+          clientIp: req.ip,
           apiKey: apiKey,
           clientInfo: extractClientInfoFromUserAgent(req.headers["user-agent"]),
           transport: "http",
```

**File**: `packages/mcp/src/lib/client-ip.ts` (removed, +0/-78)
```diff
@@ -1,78 +0,0 @@
-import type express from "express";
-
-function stripIpv4MappedPrefix(ip: string): string {
-  return ip.replace(/^::ffff:/i, "");
-}
-
-/**
- * Returns true for RFC1918, CGNAT, loopback, link-local, and IPv6 private ranges.
- */
-export function isPrivateOrLocalIp(ip: string): boolean {
-  const plainIp = stripIpv4MappedPrefix(ip).toLowerCase();
-
-  if (plainIp.includes(".")) {
-    return (
-      plainIp.startsWith("10.") ||
-      plainIp.startsWith("192.168.") ||
-      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(plainIp) ||
-      /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./.test(plainIp) ||
-      plainIp.startsWith("127.") ||
-      plainIp.startsWith("169.254.")
-    );
-  }
-
-  // ::1 loopback in any textual form (e.g. "0::1", "0:0:0:0:0:0:0:1")
-  if (/^[0:]+1$/.test(plainIp)) {
-    return true;
-  }
-
-  // First hextets in fe80::/10 and fc00::/7 start with a non-zero digit, so a
-  // valid textual form always spells out all 4 digits.
-
-  // fe80::/10 link-local
-  if (/^fe[89ab][0-9a-f]:/.test(plainIp)) {
-    return true;
-  }
-
-  // fc00::/7 unique local
-  if (/^f[cd][0-9a-f]{2}:/.test(plainIp)) {
-    return true;
-  }
-
-  return false;
-}
-
-function pickClientIpFromForwardedList(ipList: string[]): string | undefined {
-  for (const ip of ipList) {
-    const plainIp = stripIpv4MappedPrefix(ip);
-    if (!isPrivateOrLocalIp(plainIp)) {
-      return plainIp;
-    }
-  }
-
-  if (ipList.length === 0) {
-    return undefined;
-  }
-
-  return stripIpv4MappedPrefix(ipList[0]);
-}
-
-/**
- * Extract client IP address from request headers.
- * Handles X-Forwarded-For header for proxied requests.
- */
-export function getClientIp(req: express.Request): string | undefined {
-  const forwardedFor = req.headers["x-forwarded-for"] || req.headers["X-Forwarded-For"];
-
-  if (forwardedFor) {
-    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
-    const ipList = ips.split(",").map((ip) => ip.trim());
-    return pickClientIpFromForwardedList(ipList);
-  }
-
-  if (req.socket?.remoteAddress) {
-    return stripIpv4MappedPrefix(req.socket.remoteAddress);
-  }
-
-  return undefined;
-}
```

**File**: `packages/mcp/src/lib/encryption.ts` (modified, +62/-16)
```diff
@@ -1,31 +1,69 @@
 import { createCipheriv, randomBytes } from "crypto";
+import { isIP } from "node:net";
 import { SERVER_VERSION } from "./constants.js";
 import type { ClientContext } from "./types.js";
 
-const DEFAULT_ENCRYPTION_KEY = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";
-const ENCRYPTION_KEY = process.env.CLIENT_IP_ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY;
-const ALGORITHM = "aes-256-cbc";
+const LEGACY_ALGORITHM = "aes-256-cbc";
+const ASSERTION_ALGORITHM = "aes-256-gcm";
+const ASSERTION_VERSION = "v1";
+let reportedInvalidAssertionKey = false;
 
 function validateEncryptionKey(key: string): boolean {
   // Must be exactly 64 hex characters (32 bytes)
   return /^[0-9a-fA-F]{64}$/.test(key);
 }
 
-function encryptClientIp(clientIp: string): string {
-  if (!validateEncryptionKey(ENCRYPTION_KEY)) {
-    console.error("Invalid encryption key format. Must be 64 hex characters.");
-    return clientIp; // Fallback to unencrypted
-  }
+function encryptionKey(name: "MCP_CLIENT_IP_ASSERTION_KEY" | "CLIENT_IP_ENCRYPTION_KEY") {
+  const key = process.env[name];
+  return key && validateEncryptionKey(key) ? Buffer.from(key, "hex") : null;
+}
 
+/**
+ * Temporary compatibility header for API deployments that predate authenticated assertions.
+ * This header is ignored by patched API deployments. Removal is tracked by CTX7-2536.
+ */
+function encryptLegacyClientIp(clientIp: string, key: Buffer): string | null {
   try {
     const iv = randomBytes(16);
-    const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);
-    let encrypted = cipher.update(clientIp, "utf8", "hex");
-    encrypted += cipher.final("hex");
-    return iv.toString("hex") + ":" + encrypted;
-  } catch (error) {
-    console.error("Error encrypting client IP:", error);
-    return clientIp; // Fallback to unencrypted
+    const cipher = createCipheriv(LEGACY_ALGORITHM, key, iv);
+    const encrypted = Buffer.concat([cipher.update(clientIp, "utf8"), cipher.final()]);
+    return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
+  } catch {
+    return null;
+  }
+}
+
+/**
+ * Create a short-lived, authenticated client-IP assertion.
+ * Format: v1:<unix timestamp seconds>:<12-byte nonce hex>:<ciphertext + tag hex>
+ */
+export function createClientIpAssertion(
+  clientIp: string,
+  nowMs = Date.now(),
+  nonce = randomBytes(12)
+): string | null {
+  const key = encryptionKey("MCP_CLIENT_IP_ASSERTION_KEY");
+  if (!key) {
+    if (!reportedInvalidAssertionKey) {
+      reportedInvalidAssertionKey = true;
+      console.error(
+        "MCP_CLIENT_IP_ASSERTION_KEY is missing or invalid; client IP assertions are disabled."
+      );
+    }
+    return null;
+  }
+  if (nonce.length !== 12 || isIP(clientIp) === 0) return null;
+
+  try {
+    const timestamp = Math.floor(nowMs / 1000).toString();
+    const aad = `${ASSERTION_VERSION}:${timestamp}`;
+    const cipher = createCipheriv(ASSERTION_ALGORITHM, key, nonce);
+    cipher.setAAD(Buffer.from(aad, "utf8"));
+    const ciphertext = Buffer.concat([cipher.update(clientIp, "utf8"), cipher.final()]);
+    const ciphertextAndTag = Buffer.concat([ciphertext, cipher.getAuthTag()]);
+    return `${aad}:${nonce.toString("hex")}:${ciphertextAndTag.toString("hex")}`;
+  } catch {
+    return null;
   }
 }
 
@@ -40,7 +78,15 @@ export function generateHeaders(context: ClientContext): Record<string, string>
   };
 
   if (context.clientIp) {
-    headers["mcp-client-ip"] = encryptClientIp(context.clientIp);
+    const assertion = createClientIpAssertion(context.clientIp);
+    if (assertion) {
+      headers["mcp-client-ip-assertion"] = assertion;
+
+      // Producer-first rollout compatibility. Removal is tracked by CTX7-2536.
+      const key = encryptionKey("CLIENT_IP_ENCRYPTION_KEY");
+      const legacyValue = key ? encryptLegacyClientIp(context.clientIp, key) : null;
+      if (legacyValue) headers["mcp-client-ip"] = legacyValue;
+    }
   }
   if (contex
```

---

### Incident Patch 9: `0e96f6eb` (2026-08-28)
**Commit Message**: fix: repair MCP Registry publishing and automate it on release (#3097)

**File**: `.github/workflows/mcp-registry.yml` (modified, +16/-17)
```diff
@@ -4,9 +4,10 @@ on:
   workflow_dispatch:
     inputs:
       version:
-        description: "Version to publish (defaults to package.json version)"
+        description: "Version to publish (defaults to packages/mcp/package.json version)"
         required: false
         type: string
+  workflow_call:
 
 jobs:
   publish-mcp:
@@ -24,31 +25,29 @@ jobs:
         with:
           node-version: lts/*
 
-      - name: Set version
+      - name: Set version in server.json
         run: |
-          if [ -n "${{ inputs.version }}" ]; then
-            VERSION="${{ inputs.version }}"
-            # Remove 'v' prefix if it exists
-            VERSION="${VERSION#v}"
-          else
+          VERSION="${{ inputs.version }}"
+          VERSION="${VERSION#v}"
+          if [ -z "$VERSION" ]; then
             VERSION=$(node -p "require('./packages/mcp/package.json').version")
           fi
-          echo "VERSION=$VERSION" >> $GITHUB_ENV
           echo "Publishing version: $VERSION"
-
-      - name: Update package version in server.json
-        run: |
-          echo $(jq --arg v "${{ env.VERSION }}" '.version = $v | .packages[0].version = $v' server.json) > server.json
-
-      - name: Validate server.json
-        run: npx mcp-registry-validator validate server.json
+          jq --arg v "$VERSION" '.version = $v | .packages[].version = $v' server.json > server.tmp && mv server.tmp server.json
 
       - name: Install MCP Publisher
         run: |
-          curl -L "https://github.com/modelcontextprotocol/registry/releases/download/v1.4.0/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher
+          curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher
 
       - name: Login to MCP Registry
         run: ./mcp-publisher login github-oidc
 
       - name: Publish to MCP Registry
-        run: ./mcp-publisher publish
+        # Retry to tolerate npm propagation delay when chained after a release
+        run: |
+          for i in 1 2 3; do
+            ./mcp-publisher publish && exit 0
+            echo "Publish failed (attempt $i), retrying in 30s..."
+            sleep 30
+          done
+          exit 1
```

**File**: `.github/workflows/release.yml` (modified, +14/-0)
```diff
@@ -14,6 +14,9 @@ jobs:
     permissions:
       contents: write
       pull-requests: write
+    outputs:
+      published: ${{ steps.changesets.outputs.published }}
+      publishedPackages: ${{ steps.changesets.outputs.publishedPackages }}
     steps:
       - name: Checkout Repo
         uses: actions/checkout@v7
@@ -48,3 +51,14 @@ jobs:
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
           NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
+
+  publish-mcp-registry:
+    name: Publish to MCP Registry
+    needs: release
+    # changesets pushes tags with GITHUB_TOKEN, which cannot trigger other
+    # workflows — so the registry publish must chain off this job directly.
+    if: needs.release.outputs.published == 'true' && contains(needs.release.outputs.publishedPackages, '"@upstash/context7-mcp"')
+    permissions:
+      id-token: write
+      contents: read
+    uses: ./.github/workflows/mcp-registry.yml
```

**File**: `server.json` (modified, +2/-19)
```diff
@@ -14,29 +14,12 @@
       "mimeType": "image/png"
     }
   ],
-  "version": "2.0.0",
+  "version": "4.0.3",
   "packages": [
     {
       "registryType": "npm",
       "identifier": "@upstash/context7-mcp",
-      "version": "2.0.2",
-      "transport": {
-        "type": "stdio"
-      },
-      "environmentVariables": [
-        {
-          "name": "CONTEXT7_API_KEY",
-          "description": "API key for authentication",
-          "isRequired": false,
-          "isSecret": true
-        }
-      ]
-    },
-    {
-      "registryType": "mcpb",
-      "identifier": "https://github.com/upstash/context7/releases/download/@upstash/context7-mcp@2.0.2/context7.mcpb",
-      "version": "2.0.2",
-      "fileSha256": "aea76f179ceb92d22c289147c9d8343fb558d6dec93b144c9794e99239bb8194",
+      "version": "4.0.3",
       "transport": {
         "type": "stdio"
       },
```

---

### Incident Patch 10: `8fa6c6b9` (2026-08-27)
**Commit Message**: fix(mcp): honor advertised X-Context7-API-Key header (#3091)

* fix(mcp): honor advertised API key header (CTX7-2534)

* chore: add changeset for MCP API key header

**File**: `.changeset/honest-keys-authenticate.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@upstash/context7-mcp": patch
+---
+
+Honor the advertised `X-Context7-API-Key` header in HTTP MCP requests.
```

**File**: `packages/mcp/src/index.ts` (modified, +1/-0)
```diff
@@ -355,6 +355,7 @@ async function main() {
     const extractApiKey = (req: express.Request): string | undefined => {
       return (
         extractBearerToken(req.headers.authorization) ||
+        extractHeaderValue(req.headers["x-context7-api-key"]) ||
         extractHeaderValue(req.headers["context7-api-key"]) ||
         extractHeaderValue(req.headers["x-api-key"]) ||
         extractHeaderValue(req.headers["context7_api_key"]) ||
```

**File**: `packages/mcp/test/integration.test.ts` (modified, +26/-0)
```diff
@@ -135,6 +135,32 @@ describe("OAuth discovery", () => {
   });
 });
 
+describe("HTTP API key headers", () => {
+  test("accepts the advertised X-Context7-API-Key header", async () => {
+    const apiKey = "ctx7sk-advertised-header-test";
+    const client = new Client({ name: "api-key-header-test", version: "1.0.0" });
+
+    await client.connect(
+      new StreamableHTTPClientTransport(new URL(httpUrl), {
+        requestInit: { headers: { "X-Context7-API-Key": apiKey } },
+      })
+    );
+
+    try {
+      requests.length = 0;
+      await client.callTool({
+        name: "query-docs",
+        arguments: { libraryId: "/vercel/next.js", query: "app router" },
+      });
+
+      const apiCall = requests.find((request) => request.path === "/v2/context");
+      expect(apiCall?.headers.authorization).toBe(`Bearer ${apiKey}`);
+    } finally {
+      await client.close();
+    }
+  });
+});
+
 describe.each([
   ["http", "modern"],
   ["http", "legacy"],
```

#### Recent Merged Pull Requests:
- **PR #3256** (2026-09-29): CTX7-2965: Remove low-value tests (@enesgules)
- **PR #3254** (2026-09-28): test(tools-ai-sdk): run model tests through OpenRouter (@fahreddinozcan)
- **PR #3252** (2026-09-28): fix(claude-plugin): match the official plugin and drop the API key header (@fahreddinozcan)
- **PR #3250** (2026-09-28): CTX7-2943: Document port 3000 default for docs7 dev (@enesgules)
- **PR #3248** (2026-09-25): CTX7-2940: Document final Search API pricing (@fahreddinozcan)
- **PR #3238** (2026-09-24): CTX7-2913: Add Docs7 custom domains docs page (@enesgules)
- **PR #3237** (closed): docs: 1 review fix for #3236 (broken links) (@context7[bot])
- **PR #3236** (closed): docs: update Search API pricing (@enesakar)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
