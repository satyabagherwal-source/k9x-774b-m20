# Forensic Learning Record (Deep Inspection): browserbase/stagehand

> **Canonical Artifact**: `07_PROJECT_LEARNING/browserbase-stagehand-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/browserbase/stagehand](https://github.com/browserbase/stagehand))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:32:45.811Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `browserbase/stagehand`
- **Description**: The SDK to extract data and interact with any site on the web. Get started with Claude Code, Codex, Eve, Mastra, and more.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 25490 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `oxlint.config.ts`
```
import { defineConfig } from "oxlint";
import { stagehandRuleConfig } from "./rules/oxlint/stagehand-plugin.ts";

export default defineConfig({
  jsPlugins: [{ name: "stagehand", specifier: "./rules/oxlint/stagehand-plugin.ts" }],
  rules: {
    "no-console": "error",
    "typescript/no-deprecated": "warn",
    ...stagehandRuleConfig,
  },
  overrides: [
    {
      files: ["packages/cli/**/*.{js,ts}"],
      rules: {
        "no-console": "off",
        "stagehand/no-renamed-imports": "off",
      },
    },
    {
      files: ["packages/evals/**/*.ts"],
      rules: {
        "no-console": "off",
      },
    },
    {
      files: ["packages/sdk-ts/examples/**/*.ts"],
      rules: {
        "no-console": "off",
      },
    },
    {
      files: ["packages/docs/scripts/**/*.js"],
      rules: {
        "no-console": "off",
      },
    },
  ],
  options: { typeAware: true },
});

```

### Core Architecture Module: `packages/cli/bin/run.js`
```
#!/usr/bin/env node
import { config as loadDotenvConfig } from "dotenv";

// `BROWSE_LOAD_DOTENV` controls whether `browse` auto-loads a `.env` file
// from the current working directory. This is deprecated: a future release
// will flip the default to "off" so `browse` only reads `process.env`,
// matching how most CLIs used across many unrelated projects behave. Until
// then we keep loading `.env` by default (unset behaves exactly as before)
// but warn once when we actually pull a value from it, so users relying on
// the implicit default get a heads-up before the default changes.
const dotenvToggle = process.env.BROWSE_LOAD_DOTENV;
const dotenvOptedOut =
  dotenvToggle !== undefined &&
  ["0", "false", "no"].includes(dotenvToggle.toLowerCase());

if (!dotenvOptedOut) {
  const keysBeforeLoad = new Set(Object.keys(process.env));
  const { parsed } = loadDotenvConfig();
  const appliedFromDotenv = Object.keys(parsed ?? {}).filter(
    (key) => !keysBeforeLoad.has(key),
  );

  if (appliedFromDotenv.length > 0 && dotenvToggle === undefined) {
    console.error(
      `[browse] Loaded ${appliedFromDotenv.join(", ")} from .env. Auto-loading .env is deprecated and will be disabled by default in a future release -- export these variables in your shell instead, or set BROWSE_LOAD_DOTENV=1 to keep this behavior explicitly once that happens. Set BROWSE_LOAD_DOTENV=0 to opt out today. Run \`browse doctor\` to check for conflicts with your shell environment.`,
    );
  }
}

globalThis.oclif = {
  ...globalThis.oclif,
  enableAutoTranspile: false,
};

const { execute } = await import("@oclif/core");
await execute({ dir: import.meta.url });

```

### Core Architecture Module: `packages/cli/eslint.config.mjs`
```
import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "out/**",
      ".cache/**",
      ".browserbase/**",
      "**/.browserbase/**",
      "*.tgz",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      security,
    },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "security/detect-eval-with-expression": "error",
      "preserve-caught-error": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.name='Function']",
          message: "Dynamic function construction is prohibited.",
        },
        {
          selector: "NewExpression[callee.name='Function']",
          message: "Dynamic function construction is prohibited.",
        },
        {
          selector:
            "CallExpression[callee.object.name='globalThis'][callee.property.name='Function']",
          message:
            "Dynamic function construction via globalThis.Function is prohibited.",
        },
      ],
    },
  },
];

```

### Core Architecture Module: `packages/cli/src/base.ts`
```
import { Command } from "@oclif/core";

import { CommandFailure } from "./lib/errors.js";
import { setCliVersion } from "./lib/identity.js";
import { recordCommandError } from "./lib/telemetry.js";

export abstract class BrowseCommand extends Command {
  public override async init(): Promise<void> {
    await super.init();
    // Seed the CLI version from oclif's Config (the single source of truth) so
    // non-command contexts — remote session userMetadata and cloud API headers
    // — can stamp the real version without any filesystem read. This runs in
    // every process before run(), including the background `browse daemon` that
    // creates Browserbase sessions, so cli_version never regresses to "unknown".
    setCliVersion(this.config.version);
  }

  protected override async catch(
    err: Error & { exitCode?: number },
  ): Promise<unknown> {
    if (err instanceof CommandFailure) {
      recordCommandError("runtime", "COMMAND_FAILURE", err.telemetry);
      process.stderr.write(`${err.message}\n`);
      this.exit(err.exitCode);
    }

    return super.catch(err);
  }
}

```

### Core Architecture Module: `packages/cli/src/commands/back.ts`
```
import { BrowseCommand } from "../base.js";
import {
  driverCommandFlags,
  runDriverCommandFromFlags,
  timeoutMsFlag,
  waitUntilFlag,
} from "../lib/driver/command-cli.js";

export default class Back extends BrowseCommand {
  static override description = "Navigate the active browser page backward.";

  static override examples = [
    "browse back",
    "browse back --session research",
    "browse back --wait domcontentloaded",
  ];

  static override flags = {
    ...driverCommandFlags,
    timeout: timeoutMsFlag,
    wait: waitUntilFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Back);
    await runDriverCommandFromFlags(
      "back",
      { timeoutMs: flags.timeout, waitUntil: flags.wait },
      flags,
    );
  }
}

```

### Core Architecture Module: `packages/cli/src/commands/cdp.ts`
```
import { Args, Flags } from "@oclif/core";

import { BrowseCommand } from "../base.js";
import { DEFAULT_CDP_DOMAINS, tailCdp } from "../lib/driver/cdp-tail.js";

export default class Cdp extends BrowseCommand {
  static override description =
    "Attach to a CDP endpoint and stream DevTools protocol events.";

  static override examples = [
    "browse cdp 9222",
    "browse cdp http://127.0.0.1:9222",
    "browse cdp ws://127.0.0.1:9222/devtools/browser/<id> --domain Network --domain Page",
    "browse cdp 9222 --pretty",
  ];

  static override args = {
    target: Args.string({
      description: "CDP WebSocket URL, http(s) DevTools URL, or local port.",
      required: true,
    }),
  };

  static override flags = {
    domain: Flags.string({
      description: `CDP domain to enable. Repeat for multiple domains. Defaults to ${DEFAULT_CDP_DOMAINS.join(", ")}.`,
      helpValue: "<domain>",
      multiple: true,
    }),
    pretty: Flags.boolean({
      description:
        "Print compact human-readable event lines instead of NDJSON.",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Cdp);
    await tailCdp(args.target, { domains: flags.domain, pretty: flags.pretty });
  }
}

```

### Core Architecture Module: `packages/cli/src/commands/click.ts`
```
import { Args } from "@oclif/core";

import { BrowseCommand } from "../base.js";
import {
  driverCommandFlags,
  runDriverCommandFromFlags,
} from "../lib/driver/command-cli.js";

export default class Click extends BrowseCommand {
  static override description =
    "Click an element by snapshot ref, XPath, or selector. Use `browse mouse click` for raw coordinates.";

  static override examples = [
    "browse click @0-12",
    "browse click 'button[type=submit]'",
    "browse click @0-12 --session research",
  ];

  static override args = {
    selector: Args.string({
      description: "Snapshot ref such as @0-12, XPath, or selector.",
      required: true,
    }),
  };

  static override flags = {
    ...driverCommandFlags,
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Click);
    await runDriverCommandFromFlags(
      "click",
      { selector: args.selector },
      flags,
    );
  }
}

```

### Core Architecture Module: `packages/cli/src/commands/cloud/contexts/add.ts`
```
import { Args, Flags } from "@oclif/core";

import {
  contextNameRequirement,
  getContextAlias,
  isValidContextName,
  saveContextAlias,
} from "../../../lib/cloud/contexts-store.js";
import { fail } from "../../../lib/errors.js";
import { outputJson } from "../../../lib/output.js";
import { BrowseCommand } from "../../../base.js";

export default class ContextsAdd extends BrowseCommand {
  static override description =
    "Save a local name for an existing Browserbase context ID so you can reuse it by name (e.g. an ID a teammate shared or one created on another device).";
  static override examples = [
    "browse cloud contexts add github 45ed525f-63a5-490d-b4c4-853f50643b90",
    "browse cloud contexts add github <new-id> --force",
  ];

  static override args = {
    name: Args.string({ required: true, description: "Local name to save." }),
    id: Args.string({
      required: true,
      description: "Existing Browserbase context ID.",
    }),
  };

  static override flags = {
    force: Flags.boolean({
      description: "Overwrite the name if it is already saved locally.",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(ContextsAdd);

    if (!isValidContextName(args.name)) {
      fail(`Invalid context name "${args.name}". ${contextNameRequirement()}`);
    }
    // Normalize before storing so whitespace-padded input isn't saved and later
    // resolved as a bogus context id.
    const id = args.id.trim();
    if (id.length === 0) {
      fail("Context ID cannot be empty.");
    }
    if (!flags.force && (await getContextAlias(args.name))) {
      fail(
        `A context named "${args.name}" already exists locally. Pass --force to overwrite, ` +
          `or remove it with "browse cloud contexts delete ${args.name}".`,
      );
    }

    await saveContextAlias(args.name, {
      id,
      createdAt: new Date().toISOString(),
    });
    outputJson({ name: args.name, id });
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2356** (2026-07-31): **fix: make missing daemon errors actionable**
  *Symptoms*: ## Summary  - translate daemon socket `ECONNREFUSED` and `ENOENT` failures into a human-readable error - print the exact `browse open` command that restarts the requested session - document that API keys are forwarded to an already-running daemon and that `browse stop` is idempotent - preserve regression coverage for late environment variables and exit-code-zero cleanup  ## Root cause  The daemon client passed raw Unix socket errors through to users when the daemon disappeared between the readiness check and the request. Agents received `ECONNREFUSED` without a recovery command.  ## Impact  Agents now get an actionable `daemon_not_running` failure with the exact command needed to restart the session. Recovery command arguments are shell-quoted, and a daemon disappearing between status and stop is treated as an already-stopped session. Cleanup synchronizes with daemon startup so it preserves a replacement daemon that starts during the stop race. The bundled SKILL.md also makes the already-fixed env timing and stop behavior explicit.  ## E2E Test Matrix  | Command / flow | Observed output | Confidence / sufficiency | | --- | --- | --- | | `pnpm --filter browse build` | TypeScript compilation and oclif manifest generation completed successfully. | Proves the exact local CLI code under review builds; does not exercise a live browser. | | `pnpm --filter browse test:cli` | 25 test files passed; 366/366 tests passed. This includes deterministic daemon disappearance/restart races, ad
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: 030c02ae69c9648e4fa3a92ff3af77a0133e50b6  **The changes in this PR will be included in the next version bump.**  <details><summary>This PR includes changesets to release 0 packages</summary>    When changesets are added to this PR, you'll see the packages that this PR includes changesets for and the associated semver types  </details>  Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/browserbase/stagehand/new/kylejeong/gro-1908-cli-reliability?filename=.changeset/metal-impalas-study.md&value=---%0A%22browse%22%3A%20patch%0A---%0A%0A%5BGRO-1908%5D%20Make%20missing%20daemon%20errors%20actionable%0A)  

- **Issue #897** (2025-07-25): **[fix] ensure selfHeal respects arguments**
  *Symptoms*: # why On self healing we were finding the selector, but nor remembering the arguments previously passed; so either they were empty or the LLM was hallucinating them. This PR fixes this  # what changed Updated the logic from selfHealing to reuse the previously passed arguments and method  # test plan - [x] Added evals to act and regression (`evals/tasks/heal_*.ts`)
  **Post-Mortem & Fix Analysis**:
  > ###  🦋  Changeset detected  Latest commit: 31e36c483d7826af669335f0e404f1107a8dd0c9  **The changes in this PR will be included in the next version bump.**    Not sure what this means? [Click here  to learn what changesets are](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md).  [Click here if you're a maintainer who wants to add another changeset to this PR](https://github.com/browserbase/stagehand/new/miguel/stg-562-fix-bug-with-self-heal-forgetting-arguments?filename=.changeset/ten-beds-invent.md&value=---%0A%22%40fake-scope%2Ffake-pkg%22%3A%20patch%0A---%0A%0A%5Bfix%5D%20ensure%20selfHeal%20respects%20arguments%0A)  

- **Issue #313** (2025-05-09): **Bug: forcing tool use for anthropic**
  *Symptoms*: During extraction, Claude will extract some data, continue chunking, and encounter a chunk with no relevant data to extract. Claude is forced to use the `print_extracted_data` tool even when there is no new data. This results in a tool use error, and we therefore lose all the previously extracted data.   We should not force Claude to use the `print_extracted_data` tool on an empty array.

- **Issue #301** (2025-01-03): **stagehand.act interacts with stagehand-nav components**
  *Symptoms*: I updated from stagehand version 1.3 to 1.6 so I could remove the debug dom elements without having to run manual cleanup   Note: they still are present in my session with `debugDom: false` <img width="1245" alt="image" src="https://github.com/user-attachments/assets/3bcfd1fd-7294-4845-8979-165face6f6af" />  It seems like the system prompts update (https://github.com/browserbase/stagehand/blob/main/lib/prompt.ts#L22)  For me this has caused the agent to now attempt to resolve actions by clicking these debugDom elements. Which ends up in an endless loop where it clicks the button and clicks it again. (Note I downgraded to 1.3 and this behaviour is not seen) Heres a small snippet of the log for a acting on a url https://zip.co/us with `action=close any popups, banners, terms and conditions that are present when you navigate to the homepage.`  ``` [stagehand:action] received response from LLM {"response":{"value":"{\"method\":\"click\",\"element\":0,\"args\":[],\"step\":\"Clicked on the 'Next' button to potentially close a popup or navigate through a carousel.\",\"why\":\"This button might be part of a popup or carousel that needs to be closed or navigated through to access the main content.\",\"completed\":false}","type":"object"}} [stagehand:action] executing method {"method":{"value":"click","type":"string"},"elementId":{"value":"0","type":"integer"},"xpaths":{"value":"[\"/html/body[1]/button[2]\",\"//html/body/button[2]\"]","type":"object"},"args":{"value":"[]","
  **Post-Mortem & Fix Analysis**:
  > Thanks so much for making this a GitHub issue! @seanmcguire12 pointed this out internally when running evals. Appreciate the detailed write-up, but idk if a system-prompt is going to help here. We should probably just deprecate/remove stagehand nav; I don't personally find it very useful, and it's clearly causing some bugs.
  > Fixed in #360 

- **Issue #251** (2024-12-01): **no such file or directory, mkdtemp '/tmp/pwtestXXXXXX'**
  *Symptoms*: index.js ``` import { Stagehand } from "@browserbasehq/stagehand"; import { z } from "zod";  const stagehand = new Stagehand({     env: "LOCAL",     headless: true, });  await stagehand.init(); await stagehand.page.goto("https://github.com/browserbase/stagehand"); await stagehand.act({ action: "click on the contributors" }); const contributor = await stagehand.extract({     instruction: "extract the top contributor",     schema: z.object({         username: z.string(),         url: z.string(),     }), }); console.log(`Our favorite contributor is ${contributor.username}`); ```  package.json ``` {   "name": "TestApp",   "version": "1.0.0",   "description": "",   "type": "module",   "main": "index.js",   "scripts": {     "test": "echo \"Error: no test specified\" && exit 1"   },   "keywords": [],   "author": "",   "license": "ISC",   "dependencies": {     "@browserbasehq/stagehand": "^1.3.0",     "zod": "^3.23.8"   } } ```  command ``` node index.js ```  output - error ``` 2024-12-01T14:53:57.200Z::[stagehand:init] launching local browser {"headless":{"value":"true","type":"boolean"}} Error in init: Error: ENOENT: no such file or directory, mkdtemp '/tmp/pwtestXXXXXX'     at Object.mkdtempSync (node:fs:2993:18)     at <Obfuscated_Path>\node_modules\.pnpm\@browserbasehq+stagehand@1.3.0_@playwright+test@1.49.0_deepmerge@4.3.1_dotenv@16.4.5_openai@4_XXXXXX\node_modules\@browserbasehq\stagehand\dist\index.js:3318:41     at Gener

- **Issue #185** (2025-05-08): **Add safe typing**
  *Symptoms*: Typing is a mess right now. It's really hard to add types to browser-side code, and there's a lot of `as any` types. We want to enforce strong typing wherever possible to avoid simple errors and exposing private methods

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

### Incident Patch 1: `7a6cb5ad` (2026-09-30)
**Commit Message**: docs: fix broken links in Go, Java, and evals pages (#3076)

# why
Three links in the v3 docs are broken, and two Go code samples were
rewritten into links, so they no longer show valid Go.

# what changed
- `v3/sdk/go.mdx`: restore `param.Override[T](value)` and
`param.Override[stagehand.FooParams](12)`. Both had been turned into
links to non-existent files (`stagehand-go/blob/main/value` and `/12`).
The restored text matches the stagehand-go README.
- `v3/sdk/java.mdx`: the OkHttp logging interceptor link pointed at
`square/okhttp/tree/master`. That repo's default branch is `main`, and
`master` no longer resolves.
- `v3/basics/evals.mdx`: `evals.config.json` moved to
`packages/evals/evals.config.json`. The link used the old top-level
path.

# test plan
Checked each new target on GitHub (`packages/evals/evals.config.json` on
main, `okhttp-logging-interceptor` on okhttp main) and compared the Go
snippets against the stagehand-go README. Docs-only change, no Changeset
needed per CONTRIBUTING.md.


<!-- This is an auto-generated description by cubic. -->
---
## Summary by cubic
Fixes three broken links in the v3 docs.

- Go: the `param.Override[T](value)` and
`param.Override[stagehan

**File**: `packages/docs/v3/basics/evals.mdx` (modified, +1/-1)
```diff
@@ -131,7 +131,7 @@ evals run b:osworld -f source=Mind2Web
 
 #### Configuration Files
 
-You can view the specific evals in [`evals/tasks`](https://github.com/browserbase/stagehand/tree/main/packages/evals/tasks). Each eval is grouped into eval categories based on [`evals/evals.config.json`](https://github.com/browserbase/stagehand/blob/main/evals/evals.config.json).
+You can view the specific evals in [`evals/tasks`](https://github.com/browserbase/stagehand/tree/main/packages/evals/tasks). Each eval is grouped into eval categories based on [`evals/evals.config.json`](https://github.com/browserbase/stagehand/blob/main/packages/evals/evals.config.json).
 
 
 #### Viewing eval results
```

**File**: `packages/docs/v3/sdk/go.mdx` (modified, +2/-2)
```diff
@@ -268,7 +268,7 @@ Request structs contain a `.SetExtraFields(map[string]any)` method which can sen
 fields in the request body. Extra fields overwrite any struct fields with a matching
 key. For security reasons, only use `SetExtraFields` with trusted data.
 
-To send a custom value instead of a struct, use `param.Override[T](https://github.com/browserbase/stagehand-go/blob/main/value)`.
+To send a custom value instead of a struct, use `param.Override[T](value)`.
 
 ```go
 // In cases where the API specifies a given type,
@@ -278,7 +278,7 @@ p.SetExtraFields(map[string]any{
 })
 
 // Send a number instead of an object
-custom := param.Override[stagehand.FooParams](https://github.com/browserbase/stagehand-go/blob/main/12)
+custom := param.Override[stagehand.FooParams](12)
 ```
 
 ### Request unions
```

**File**: `packages/docs/v3/sdk/java.mdx` (modified, +1/-1)
```diff
@@ -475,7 +475,7 @@ The SDK throws custom unchecked exception types:
 
 ## Logging
 
-The SDK uses the standard [OkHttp logging interceptor](https://github.com/square/okhttp/tree/master/okhttp-logging-interceptor).
+The SDK uses the standard [OkHttp logging interceptor](https://github.com/square/okhttp/tree/main/okhttp-logging-interceptor).
 
 Enable logging by setting the `STAGEHAND_LOG` environment variable to `info`:
 
```

---

### Incident Patch 2: `4696e94a` (2026-09-30)
**Commit Message**: docs: Prose guide fix and clarify purpose of template (#3077)

# why

Fixing a prose issue surfaced in another PR, and while in there, added
clarity about the functions starter code and what could be replaced

# what changed

* Updates docs prose from "we recommend" to "Browserbase recommends"
* Specifies which node version
* Adds a note about the template code and what must stay vs be replaced

# test plan


<!-- This is an auto-generated description by cubic. -->
---
## Summary by cubic
Fixes prose in the deployment guide and clarifies that the Functions
template is starter code you replace.

- Changes "we recommend" to "Browserbase recommends" and specifies
Node.js 22.18 or later.
- Explains that the template contains a starter Function to replace, and
notes to keep the `defineFn` call and update the function name
consistently.

<sup>Written for commit 1f6ff6575b1c3c8364cc9b9621c8db8d7090763a.
Summary will update on new commits.</sup>

<a
href="https://cubic.dev/pr/browserbase/stagehand/pull/3077?utm_source=github"
target="_blank" rel="noopener noreferrer"
data-no-image-dialog="true"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://www.cubic.dev/buttons/revi

**File**: `packages/docs/v4/best-practices/deployments.mdx` (modified, +7/-5)
```diff
@@ -3,14 +3,14 @@ title: 'Deploying Stagehand'
 description: 'Deploy your AI agents and automations to the cloud'
 ---
 
-We recommend that you deploy Stagehand as a [Browserbase Function](https://docs.browserbase.com/platform/functions/quickstart). The Function runs next to its browser session on Browserbase, and it reads your API key from an encrypted project secret. You do not need a separate server, a Chrome binary, or a secrets store.
+Browserbase recommends that you deploy Stagehand as a [Browserbase Function](https://docs.browserbase.com/platform/functions/quickstart). The Function runs next to its browser session on Browserbase, and it reads your API key from an encrypted project secret. You do not need a separate server, a Chrome binary, or a secrets store.
 
 Stagehand also runs on other platforms. If Functions is not a good fit for you, see [Other deployment options](#other-deployment-options).
 
 ## Prerequisites
 
 - A Browserbase API key from [Settings](https://www.browserbase.com/settings)
-- Node.js and pnpm
+- Node.js 22.18 or later and pnpm
 - The `browse` CLI:
 
 ```bash
@@ -19,9 +19,11 @@ npm install -g browse
 
 ## Deploy a Stagehand Function
 
+These steps start from a template project. The template contains a starter Function that you replace with your own Stagehand code before you publish.
+
 <Steps>
 
-<Step title="Create the project">
+<Step title="Initialize a Functions project">
 
 ```bash
 browse functions init my-stagehand-function
@@ -44,9 +46,9 @@ In `index.ts`, replace `your-extension-id` with the `id` from the output.
 
 </Step>
 
-<Step title="Review the Function">
+<Step title="Replace the starter Function">
 
-The initializer creates this Function in `index.ts`. It connects Stagehand to the session that Browserbase creates for each invocation, then extracts the top stories from Hacker News:
+This is the starter Function in `index.ts`. Replace the template with the Stagehand code that you want to deploy. Keep the `defineFn` call. If you change the name `my-function`, use the new name in the steps that follow.
 
 ```typescript
 import { defineFn } from "@browserbasehq/sdk-functions";
```

---

### Incident Patch 3: `8308d8dc` (2026-09-30)
**Commit Message**: fix(cli): Functions CLI updates for `init` and `publish` (#3055)

# why

* Before Browserbase had secrets support, `functions init` would install
a playwright template. But now we support secrets so we can update the
starter template to showcase Stagehand.
* There were some rough edges around the `functions publish` command
related to pnpm 11. Added a few updates so that the functions CLI works
out of the box.

# what changed

# test plan

It works if nothing in this path errors:
1. [in stagehand repo] `pnpm build && cd packages/cli`
2. `alias browse-dev="node $HOME/[your dev
path]/stagehand/packages/cli/bin/run.js"` to set a local version of the
`browse` cli called `browse-dev`
3. `cd [your dev path, _not_ in stagehand repo] && browse-dev functions
init branch-test && cd branch-test`
4. `browse-dev cloud extensions upload
node_modules/@browserbasehq/stagehand/dist/assets/stagehand-extension.zip`
and then replace `your-extension-id` in `index.ts`
5. `browse-dev cloud secrets create BROWSERBASE_API_KEY --env
BROWSERBASE_API_KEY` to store your secret API key for use in the
deployed function
6. `browse-dev functions dev index.ts`
7. (in a new terminal) `curl -X POST
http://127.0.0.1:1

**File**: `.changeset/functions-init-stagehand.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"browse": patch
+---
+
+`functions init` now scaffolds a Stagehand project. It installs `@browserbasehq/stagehand` instead of `playwright-core`, installs the zod version that Stagehand uses, and writes a Stagehand starter function.
```

**File**: `.changeset/functions-lockfile-pnpm11.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+"browse": patch
+---
+
+Fix Functions builds that failed because of how `functions publish` generated `package-lock.json` or how `functions init` set up pnpm:
+
+- `functions publish` now generates `package-lock.json` without registry URLs, so private npm registries work.
+- `functions publish` now resolves local `file:` dependencies by building `package-lock.json` from the uploaded files rather than just `package.json`.
+- `functions publish` now prints npm's error output when it can't generate `package-lock.json`.
+- `functions init` now writes a `pnpm-workspace.yaml` that allows the esbuild build script, required by pnpm 11+.
```

**File**: `packages/cli/src/lib/functions/dev.ts` (modified, +3/-1)
```diff
@@ -35,6 +35,7 @@ interface InvocationContext {
     id: string;
     connectUrl: string;
   };
+  secrets: Record<string, string>;
 }
 
 interface PendingConnection {
@@ -587,7 +588,8 @@ async function routeRequest(
     const accepted = bridge.triggerInvocation(
       functionName,
       params,
-      { session },
+      // Match production, which always sends secrets.
+      { session, secrets: {} },
       corsHeaders,
       response,
     );
```

**File**: `packages/cli/src/lib/functions/init.ts` (modified, +82/-20)
```diff
@@ -1,5 +1,5 @@
 import { spawnSync } from "node:child_process";
-import { existsSync } from "node:fs";
+import { existsSync, readFileSync } from "node:fs";
 import { mkdir, writeFile } from "node:fs/promises";
 import { join, resolve } from "node:path";
 
@@ -21,24 +21,50 @@ dist/
 `;
 
 const starterFunctionTemplate = `import { defineFn } from "@browserbasehq/sdk-functions";
-import { chromium } from "playwright-core";
-
-defineFn("my-function", async (context) => {
-  const browser = await chromium.connectOverCDP(context.session.connectUrl);
-  const page = browser.contexts()[0]!.pages()[0]!;
-
-  await page.goto("https://news.ycombinator.com");
-  await page.waitForSelector(".athing", { timeout: 30_000 });
+import { browserbase, Stagehand } from "@browserbasehq/stagehand";
+import { z } from "zod/v4";
+
+defineFn(
+  "my-function",
+  async (context) => {
+    const browser = await browserbase.connect({
+      // The local dev server has no secrets, so fall back to .env.
+      apiKey:
+        context.secrets.BROWSERBASE_API_KEY ?? process.env.BROWSERBASE_API_KEY!,
+      sessionId: context.session.id,
+    });
+    // In this example, Stagehand uses the Model Gateway where Browserbase charges for the tokens
+    const stagehand = await Stagehand.create({ browser });
+    const page = (await browser.context.activePage())!;
+
+    await page.goto("https://news.ycombinator.com");
+    const { data } = await stagehand.extract(
+      "Extract the top 3 stories with their rank, title, and link URL.",
+      z.object({
+        stories: z
+          .array(z.object({ rank: z.number(), title: z.string(), url: z.string() }))
+          .max(3),
+      }),
+    );
 
-  const titles = await page.$$eval(".athing .titleline > a", (elements) =>
-    elements.slice(0, 3).map((element) => element.textContent),
-  );
+    await stagehand.close();
+    return {
+      message: "Successfully fetched top Hacker News stories",
+      timestamp: new Date().toISOString(),
+      results: data.stories,
+    };
+  },
+  {
+    // Upload the Stagehand extension once, then paste its ID here:
+    //   browse cloud extensions upload node_modules/@browserbasehq/stagehand/dist/assets/stagehand-extension.zip
+    sessionConfig: { extensionId: "your-extension-id" },
+  },
+);
+`;
 
-  return {
-    message: "Fetched top Hacker News titles",
-    titles,
-  };
-});
+// pnpm 11 and later fail installs when esbuild's build script is not approved.
+const pnpmWorkspaceTemplate = `allowBuilds:
+  esbuild: true
 `;
 
 const tsconfigTemplate = `{
@@ -95,14 +121,27 @@ export async function initFunctionsProject({
   await writeFile(join(projectRoot, ".gitignore"), gitignoreTemplate);
   await writeFile(join(projectRoot, "index.ts"), starterFunctionTemplate);
   await writeFile(join(projectRoot, "tsconfig.json"), tsconfigTemplate);
+  if (packageManager === "pnpm") {
+    await writeFile(
+      join(projectRoot, "pnpm-workspace.yaml"),
+      pnpmWorkspaceTemplate,
+    );
+  }
 
   const install = packageManager === "pnpm" ? ["add"] : ["install"];
   const installDev =
     packageManager === "pnpm" ? ["add", "-D"] : ["install", "--save-dev"];
 
   runPackageManager(
     packageManager,
-    [...install, "@browserbasehq/sdk-functions", "playwright-core"],
+    [...install, "@browserbasehq/sdk-functions", "@browserbasehq/stagehand"],
+    projectRoot,
+  );
+  // Match Stagehand's version of zod in order to pass type checks.
+  const zodVersion = readStagehandZodVersion(projectRoot);
+  runPackageManager(
+    packageManager,
+    [...install, zodVersion ? `zod@${zodVersion}` : "zod"],
     projectRoot,
   );
   runPackageManager(
@@ -127,8 +166,11 @@ export async function initFunctionsProject({
         nextSteps: [
           `cd ${projectName}`,
           "Edit .env with your Browserbase API key",
-          packageManager === "pnpm" ? "pnpm dev" : "npm run dev",
-          packageManager === "pnpm" ? "pnpm run deploy" : "npm run deploy",
+          "brows
```

**File**: `packages/cli/src/lib/functions/publish.ts` (modified, +19/-6)
```diff
@@ -215,17 +215,30 @@ function ensureArchiveLockfile(
 
   const tempDir = join(tmpdir(), `bb-functions-lockgen-${randomUUID()}`);
   mkdirSync(tempDir, { recursive: true });
-  copyFileSync(join(root, "package.json"), join(tempDir, "package.json"));
+  // Copy the files that publish uploads, so npm resolves local dependencies the same way the build does.
+  for (const entry of entries) {
+    const target = join(tempDir, entry);
+    mkdirSync(dirname(target), { recursive: true });
+    copyFileSync(join(root, entry), target);
+  }
 
-  const result = spawnSync("npm", ["install", "--package-lock-only"], {
-    cwd: tempDir,
-    stdio: "pipe",
-  });
+  // Omit resolved URLs so the builder installs from its own registry rather than the one on your machine.
+  const result = spawnSync(
+    "npm",
+    ["install", "--package-lock-only", "--omit-lockfile-registry-resolved"],
+    {
+      cwd: tempDir,
+      stdio: "pipe",
+    },
+  );
 
   if (result.status !== 0) {
     rmSync(tempDir, { recursive: true, force: true });
+    const npmOutput = result.error
+      ? result.error.message
+      : result.stderr.toString().trim();
     fail(
-      "Failed to generate package-lock.json for the Functions build archive.",
+      `Failed to generate package-lock.json for the Functions build archive.${npmOutput ? `\n${npmOutput}` : ""}`,
     );
   }
 
```

---

### Incident Patch 4: `ad2bf12e` (2026-09-28)
**Commit Message**: [chore]: fix failing CI due to external website change (#3069)

# why
- example.com changed, this broke some smoke tests in our ci
# what changed
- swapped it to a hosted eval site that is similar to example.com


<!-- This is an auto-generated description by cubic. -->
---
## Summary by cubic
Fixes failing CI smoke tests by replacing `https://example.com` with a
hosted eval site that mirrors example.com across the Go, Python, and
TypeScript SDK examples and the TypeScript Browserbase smoke test.

<sup>Written for commit dfd525ef832cdfb963d3e7e2013ac834ceadd296.
Summary will update on new commits.</sup>

<a
href="https://cubic.dev/pr/browserbase/stagehand/pull/3069?utm_source=github"
target="_blank" rel="noopener noreferrer"
data-no-image-dialog="true"><picture><source
media="(prefers-color-scheme: dark)"
srcset="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"><source
media="(prefers-color-scheme: light)"
srcset="https://www.cubic.dev/buttons/review-in-cubic-light.svg"><img
alt="Review in cubic"
src="https://www.cubic.dev/buttons/review-in-cubic-dark.svg"></picture></a>

<!-- End of auto-generated description by cubic. -->

**File**: `packages/sdk-go/examples/extract.go` (modified, +1/-1)
```diff
@@ -51,7 +51,7 @@ func run(ctx context.Context) (err error) {
 		return errors.New("Stagehand initialized without an active page")
 	}
 	page := pages[0]
-	if _, err := page.Goto(ctx, "https://example.com", nil); err != nil {
+	if _, err := page.Goto(ctx, "https://browserbase.github.io/stagehand-eval-sites/sites/example/", nil); err != nil {
 		return err
 	}
 
```

**File**: `packages/sdk-python/examples/extract.py` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ async def main() -> None:
             page = (await browser.context.pages())[0]
             if page is None:
                 raise RuntimeError("Stagehand initialized without an active page")
-            await page.goto("https://example.com")
+            await page.goto("https://browserbase.github.io/stagehand-eval-sites/sites/example/")
 
             result = await stagehand.extract(
                 "Extract the page heading and description",
```

**File**: `packages/sdk-ts/examples/extract.ts` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ const stagehand = await Stagehand.create({
 });
 
 const [page] = await browser.context.pages();
-await page.goto("https://example.com");
+await page.goto("https://browserbase.github.io/stagehand-eval-sites/sites/example/");
 
 const result = await stagehand.extract(
   "Extract the page heading and description",
```

**File**: `packages/sdk-ts/tests/browser-runtime/stagehandBrowserbaseSmoke.test.ts` (modified, +4/-3)
```diff
@@ -6,6 +6,7 @@ import { browserbase, Stagehand, type StagehandBrowser } from "../../src/index.j
 
 const browserbaseApiKey = process.env.BROWSERBASE_API_KEY;
 const shouldRun = process.env.BROWSERBASE_SMOKE === "1" || Boolean(browserbaseApiKey);
+const exampleTestSite = "https://browserbase.github.io/stagehand-eval-sites/sites/example/";
 const webMCPTestSite = "https://browserbase.github.io/stagehand-eval-sites/sites/webmcp-test/";
 
 describe.runIf(shouldRun)("Stagehand TS SDK Browserbase smoke", () => {
@@ -43,9 +44,9 @@ describe.runIf(shouldRun)("Stagehand TS SDK Browserbase smoke", () => {
     const page =
       (await stagehand.browser.context.pages())[0] ?? (await stagehand.browser.context.newPage());
 
-    await page.goto("https://example.com", { waitUntil: "load" });
+    await page.goto(exampleTestSite, { waitUntil: "load" });
 
-    await expect(page.url()).resolves.toBe("https://example.com/");
+    await expect(page.url()).resolves.toBe(exampleTestSite);
     await expect(page.title()).resolves.toBe("Example Domain");
     await expect(page.locator("h1").innerText()).resolves.toBe("Example Domain");
   });
@@ -116,7 +117,7 @@ describe.runIf(shouldRun)("Stagehand TS SDK Browserbase smoke", () => {
     }
     const firstStagehand = stagehand;
     const page = (await browser.context.pages())[0] ?? (await browser.context.newPage());
-    await page.goto("https://example.com", { waitUntil: "load" });
+    await page.goto(exampleTestSite, { waitUntil: "load" });
     const pageId = page.pageId;
 
     await expect(firstStagehand.close()).resolves.toBeUndefined();
```

---

### Incident Patch 5: `70f4e91f` (2026-09-26)
**Commit Message**: fix(extension): read text() from direct child text nodes (#2728) (#3052)

thanks @mikhail-koviazin for the contribution here!

## why

The composed-tree XPath parser evaluates `text()` and `.` through the
same helper, `element.textContent`. In XPath these are not the same
thing: `.` is the string-value of the element, so it covers the whole
subtree, while `text()` is the node-set of the element's **direct child
text nodes**.

This parser is not a rare path. It takes over whenever the document
contains a shadow root anywhere, so a single unrelated web component on
the page changes what a locator matches, silently and with no error.

Measured against `document.evaluate()` on a build of `main`
(`a73da68b`), fixture served over http. The only difference between a
run that matches native and a run that does not is one unrelated
`attachShadow()` call elsewhere in the same document:

| XPath | `document.evaluate()` | Stagehand |
| --- | --- | --- |
| `//button[text()='Save']` | 1 | 2 |
| `//div[text()='a']` | 1 | 0 |
| `//div[contains(text(),'b')]` | 0 | 1 |
| `//div[@id='split'][text()='y']` | 1 | 0 |
| `//div[@id='split'][contains(text(),'y')]` | 0 | 1 | |
`//div[@id='split'][normalize-

**File**: `.changeset/xpath-text-node-predicates.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+"@browserbasehq/stagehand-extension": patch
+"@browserbasehq/stagehand-go": patch
+"@browserbasehq/stagehand": patch
+"@browserbasehq/stagehand-python": patch
+---
+
+Match native XPath semantics for `text()` predicates when a shadow root routes locators through the composed-tree parser
```

**File**: `packages/extension/dom/locatorScripts/xpathParser.ts` (modified, +56/-13)
```diff
@@ -1,3 +1,12 @@
+/**
+ * Which string a text predicate reads.
+ *
+ * `self` is `.` — the string-value of the element, i.e. its whole subtree text.
+ * `text` is `text()` — the node-set of direct child text nodes, which is not the
+ * same string and does not compare the same way (see `evaluatePredicate`).
+ */
+export type XPathTextSource = "self" | "text";
+
 export type XPathPredicate =
   | { type: "index"; index: number }
   | { type: "attrEquals"; name: string; value: string; normalize?: boolean }
@@ -14,8 +23,8 @@ export type XPathPredicate =
       value: string;
       normalize?: boolean;
     }
-  | { type: "textEquals"; value: string; normalize?: boolean }
-  | { type: "textContains"; value: string; normalize?: boolean }
+  | { type: "textEquals"; value: string; normalize?: boolean; source?: XPathTextSource }
+  | { type: "textContains"; value: string; normalize?: boolean; source?: XPathTextSource }
   | { type: "and"; predicates: XPathPredicate[] }
   | { type: "or"; predicates: XPathPredicate[] }
   | { type: "not"; predicate: XPathPredicate };
@@ -39,7 +48,8 @@ export interface XPathStep {
  *  - Attribute equality predicates (`[@attr='value']`, `[@attr="value"]`)
  *  - Attribute existence (`[@attr]`)
  *  - Attribute contains/starts-with (`contains(@attr,'v')`, `starts-with(@attr,'v')`)
- *  - Text equality/contains (`[text()='v']`, `[contains(text(),'v')]`, `[.='v']`)
+ *  - Text equality/contains (`[text()='v']`, `[contains(text(),'v')]`, `[.='v']`),
+ *    where `text()` reads direct child text nodes and `.` the whole subtree
  *  - normalize-space on text/attributes (`[normalize-space(text())='v']`)
  *  - Basic boolean predicates (`and`, `or`, `not(...)`)
  *  - Multiple predicates per step (`[@class='foo'][2]`)
@@ -211,13 +221,14 @@ function parseAtomicPredicate(input: string): XPathPredicate | null {
   }
 
   const normalizeTextMatch = input.match(
-    new RegExp(`^normalize-space\\(\\s*(?:text\\(\\)|\\.)\\s*\\)\\s*=\\s*${quoted}$`),
+    new RegExp(`^normalize-space\\(\\s*(text\\(\\)|\\.)\\s*\\)\\s*=\\s*${quoted}$`),
   );
   if (normalizeTextMatch) {
     return {
       type: "textEquals",
-      value: normalizeTextMatch[1] ?? normalizeTextMatch[2] ?? "",
+      value: normalizeTextMatch[2] ?? normalizeTextMatch[3] ?? "",
       normalize: true,
+      source: textSource(normalizeTextMatch[1]),
     };
   }
 
@@ -257,21 +268,23 @@ function parseAtomicPredicate(input: string): XPathPredicate | null {
     };
   }
 
-  const textEqualsMatch = input.match(new RegExp(`^(?:text\\(\\)|\\.)\\s*=\\s*${quoted}$`));
+  const textEqualsMatch = input.match(new RegExp(`^(text\\(\\)|\\.)\\s*=\\s*${quoted}$`));
   if (textEqualsMatch) {
     return {
       type: "textEquals",
-      value: textEqualsMatch[1] ?? textEqualsMatch[2] ?? "",
+      value: textEqualsMatch[2] ?? textEqualsMatch[3] ?? "",
+      source: textSource(textEqualsMatch[1]),
     };
   }
 
   const textContainsMatch = input.match(
-    new RegExp(`^contains\\(\\s*(?:text\\(\\)|\\.)\\s*,\\s*${quoted}\\s*\\)$`),
+    new RegExp(`^contains\\(\\s*(text\\(\\)|\\.)\\s*,\\s*${quoted}\\s*\\)$`),
   );
   if (textContainsMatch) {
     return {
       type: "textContains",
-      value: textContainsMatch[1] ?? textContainsMatch[2] ?? "",
+      value: textContainsMatch[2] ?? textContainsMatch[3] ?? "",
+      source: textSource(textContainsMatch[1]),
     };
   }
 
@@ -370,10 +383,30 @@ function hasBalancedParens(input: string): boolean {
 
 const normalizeSpace = (value: string): string => value.replace(/\s+/g, " ").trim();
 
+const TEXT_NODE = 3;
+
+function textSource(token: string | undefined): XPathTextSource {
+  return token === "text()" ? "text" : "self";
+}
+
 function textValue(element: Element): string {
   return String(element.textContent ?? "");
 }
 
+/** The node-set `text()` selects: direct child text nodes, in document order. */
+function childTextValues(element: Element): string[] {
+  const values: string[] = [];
+  for (const node 
```

**File**: `packages/extension/tests/xpath-text-predicates.test.ts` (added, +47/-0)
```diff
@@ -0,0 +1,47 @@
+import { describe, expect, it } from "vitest";
+import { parseXPathSteps } from "../dom/locatorScripts/xpathParser.js";
+
+function predicatesOf(xpath: string) {
+  return parseXPathSteps(xpath)[0]?.predicates;
+}
+
+describe("parseXPathSteps text predicates", () => {
+  it("keeps text() and . apart", () => {
+    expect(predicatesOf("//button[text()='Save']")).toEqual([
+      { type: "textEquals", value: "Save", source: "text" },
+    ]);
+    expect(predicatesOf("//button[.='Save']")).toEqual([
+      { type: "textEquals", value: "Save", source: "self" },
+    ]);
+  });
+
+  it("keeps them apart inside contains() and normalize-space()", () => {
+    expect(predicatesOf("//button[contains(text(),'Sa')]")).toEqual([
+      { type: "textContains", value: "Sa", source: "text" },
+    ]);
+    expect(predicatesOf("//button[contains(.,'Sa')]")).toEqual([
+      { type: "textContains", value: "Sa", source: "self" },
+    ]);
+    expect(predicatesOf("//button[normalize-space(text())='Save']")).toEqual([
+      { type: "textEquals", value: "Save", normalize: true, source: "text" },
+    ]);
+    expect(predicatesOf("//button[normalize-space(.)='Save']")).toEqual([
+      { type: "textEquals", value: "Save", normalize: true, source: "self" },
+    ]);
+  });
+
+  it("carries the source through boolean predicates", () => {
+    expect(predicatesOf("//button[text()='Save' or .='Save']")).toEqual([
+      {
+        type: "or",
+        predicates: [
+          { type: "textEquals", value: "Save", source: "text" },
+          { type: "textEquals", value: "Save", source: "self" },
+        ],
+      },
+    ]);
+    expect(predicatesOf("//button[not(text()='Save')]")).toEqual([
+      { type: "not", predicate: { type: "textEquals", value: "Save", source: "text" } },
+    ]);
+  });
+});
```

**File**: `packages/sdk-ts/tests/integration/locatorXPathTextPredicates.test.ts` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+import { afterAll, beforeAll, describe, expect, it } from "vitest";
+import type { Stagehand } from "../../src/index.js";
+import {
+  closeStagehand,
+  createStagehand,
+  firstPage,
+  startFixtureServer,
+  type FixtureServer,
+} from "./_support.js";
+
+// A shadow root anywhere in the document routes XPath through the composed-tree parser
+// instead of document.evaluate(), and that parser is only reachable over http: data: URLs
+// keep the native engine, so these cases have to be served to exercise it at all.
+const FIXTURE = `<!doctype html>
+<html>
+  <body>
+    <button id="wrapped"><span>Save</span></button>
+    <button id="direct">Save</button>
+    <div id="mixed">a<span>b</span></div>
+    <div id="split">x<br />y</div>
+    <div id="widget"></div>
+    <script>
+      document.getElementById("widget").attachShadow({ mode: "open" }).innerHTML =
+        "<span>unrelated widget</span>";
+    </script>
+  </body>
+</html>`;
+
+describe("XPath text() predicates with a shadow root in the document", () => {
+  let fixtureServer: FixtureServer;
+  let stagehand: Stagehand;
+
+  beforeAll(async () => {
+    fixtureServer = await startFixtureServer(FIXTURE);
+    stagehand = await createStagehand();
+  });
+
+  afterAll(async () => {
+    await closeStagehand(stagehand);
+    await fixtureServer.close();
+  });
+
+  it("reads text() from direct child text nodes only", async () => {
+    const page = await firstPage(stagehand);
+    await page.goto(fixtureServer.url, { waitUntil: "load" });
+
+    // #wrapped holds its label in a <span>, so it has no direct text child to match.
+    await expect.poll(() => page.locator("xpath=//button[text()='Save']").count()).toBe(1);
+    await expect(page.locator("xpath=//button[text()='Save']").innerHtml()).resolves.toBe("Save");
+
+    // `.` is the string-value of the element, so it still sees the whole subtree.
+    await expect(page.locator("xpath=//button[.='Save']").count()).resolves.toBe(2);
+
+    await expect(page.locator("xpath=//div[text()='a']").count()).resolves.toBe(1);
+    await expect(page.locator("xpath=//div[contains(text(),'b')]").count()).resolves.toBe(0);
+  });
+
+  it("compares a node-set existentially and collapses it inside functions", async () => {
+    const page = await firstPage(stagehand);
+    await page.goto(fixtureServer.url, { waitUntil: "load" });
+
+    // #split has two text nodes, `x` and `y`: `=` holds when either one matches.
+    await expect.poll(() => page.locator("xpath=//div[@id='split'][text()='y']").count()).toBe(1);
+
+    // contains() and normalize-space() take a string, so the node-set collapses to `x`.
+    await expect(
+      page.locator("xpath=//div[@id='split'][contains(text(),'y')]").count(),
+    ).resolves.toBe(0);
+    await expect(
+      page.locator("xpath=//div[@id='split'][normalize-space(text())='x']").count(),
+    ).resolves.toBe(1);
+  });
+});
```

**File**: `scripts/test-integration.ts` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@ export const integrationTestGroups = {
     "locatorContentMethods",
     "locatorCount",
     "locatorNth",
+    "locatorXPathTextPredicates",
     "textSelectorInnermost",
   ],
   "local/locators-write": ["locatorFill", "locatorInputMethods", "locatorSelectOption"],
```

---

### Incident Patch 6: `4da1a213` (2026-09-26)
**Commit Message**: [Claimed #2738] fix(protocol): make telemetry export opt-in (#3045)

Mirrored from external contributor PR #2738 after approval by
@miguelg719.

Original author: @abhinavkr26104
Original PR: https://github.com/browserbase/stagehand/pull/2738
Approved source head SHA: `e77c269fcc7ab33d2b76f213f26da62b77b1e826`

@abhinavkr26104, please continue any follow-up discussion on this
mirrored PR. When the external PR gets new commits, this same internal
PR will be marked stale until the latest external commit is approved and
refreshed here.

## Original description
# why

The v4 init schema supplied `https://example.com/v1/traces` whenever
callers omitted telemetry. The extension treated that placeholder as an
intentional OTLP destination, creating guaranteed-failing background
exports and possible shutdown delays for otherwise default Stagehand
instances.

Fixes #2732

# what changed

- Make `stagehand.init` telemetry optional instead of injecting a
placeholder endpoint.
- Leave extension tracing inert when no telemetry configuration is
supplied while preserving explicit OTLP export behavior.
- Regenerate Python and Go protocol models and the embedded Go extension
bundle.
- Keep Go's exist

**File**: `.changeset/disable-placeholder-telemetry.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+"@browserbasehq/stagehand": patch
+"@browserbasehq/stagehand-go": patch
+"@browserbasehq/stagehand-python": patch
+"@browserbasehq/stagehand-extension": patch
+"@browserbasehq/stagehand-protocol": patch
+---
+
+Keep telemetry disabled unless an OTLP traces endpoint is explicitly configured.
```

**File**: `packages/extension/tests/rpc-router.test.ts` (modified, +1/-1)
```diff
@@ -288,7 +288,7 @@ describe("Stagehand RPC router", () => {
     const logs: string[] = [];
     const initializeStagehand = vi.fn(async () => {
       expect(configureTracing).toHaveBeenCalledWith(
-        expect.any(Object),
+        undefined,
         expect.objectContaining({ name: "stagehand-sdk-ts", version: "4.0.0" }),
       );
       return { initialized: true as const, pages: [] };
```

**File**: `packages/extension/tests/stagehand-tracing.test.ts` (modified, +23/-1)
```diff
@@ -6,7 +6,7 @@ import {
   type SpanProcessor,
 } from "@opentelemetry/sdk-trace-web";
 import { ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
-import { afterEach, describe, expect, it } from "vitest";
+import { afterEach, describe, expect, it, vi } from "vitest";
 import extensionPackageJson from "../package.json" with { type: "json" };
 import { createStagehandTracing, createStagehandTracingRuntime } from "../tracing.ts";
 
@@ -17,6 +17,28 @@ afterEach(async () => {
 });
 
 describe("Stagehand tracing", () => {
+  it("does not create a tracing runtime when telemetry is omitted", async () => {
+    const forceFlush = vi.fn(async () => {});
+    const shutdown = vi.fn(async () => {});
+    const processor: SpanProcessor = {
+      forceFlush,
+      onEnd: vi.fn(),
+      onStart: vi.fn(),
+      shutdown,
+    };
+    const tracing = createStagehandTracing(
+      { registerGlobals: false },
+      { spanProcessors: [processor] },
+    );
+
+    tracing.configure(undefined, { name: "stagehand-sdk-test", version: "4.0.0" });
+    await tracing.forceFlush();
+    await tracing.shutdown();
+
+    expect(forceFlush).not.toHaveBeenCalled();
+    expect(shutdown).not.toHaveBeenCalled();
+  });
+
   it("fans out every finished span to every installed span processor", async () => {
     const firstExporter = new InMemorySpanExporter();
     const secondExporter = new InMemorySpanExporter();
```

**File**: `packages/extension/tracing.ts` (modified, +5/-1)
```diff
@@ -36,7 +36,7 @@ type StagehandTracingRuntime = {
 };
 
 export type StagehandTracing = StagehandTracingRuntime & {
-  configure(telemetry: TelemetryConfig, clientInfo: ImplementationInfo): Promise<void>;
+  configure(telemetry: TelemetryConfig | undefined, clientInfo: ImplementationInfo): Promise<void>;
 };
 
 type StagehandTracingRuntimeDependencies = {
@@ -117,6 +117,10 @@ export function createStagehandTracing(
         const previousRuntime = runtime;
         runtime = undefined;
         await previousRuntime?.shutdown();
+        activeTelemetry = undefined;
+        activeClientInfo = undefined;
+        // Without an explicit telemetry sink, tracing stays inert: no OTLP export.
+        if (!telemetry) return;
 
         const registerGlobals = options.registerGlobals !== false && !globalsRegistered;
         runtime = createStagehandTracingRuntime(
```

**File**: `packages/protocol/schemas.ts` (modified, +1/-8)
```diff
@@ -1578,13 +1578,6 @@ export const LocatorDescriptorSchema = z
   })
   .meta({ id: "LocatorDescriptor" });
 
-export const DEFAULT_TELEMETRY_CONFIG = {
-  traces: {
-    endpoint: "https://example.com/v1/traces", // TODO: Replace with the Browserbase OTLP traces ingestion endpoint.
-    headers: {},
-  },
-};
-
 export const ImplementationInfoSchema = z
   .strictObject({
     name: z.string().min(1),
@@ -1639,7 +1632,7 @@ export const StagehandInitParamsSchema = z
       description:
         "Default model configuration; when omitted and a Browserbase Model Gateway session is available, Browserbase selects a model automatically for inference calls",
     }),
-    telemetry: TelemetryConfigSchema.default(DEFAULT_TELEMETRY_CONFIG),
+    telemetry: TelemetryConfigSchema.optional(),
     logLevel: z.enum(["off", "error", "warn", "info", "debug"]).default("info"),
     systemPrompt: z.string().optional(),
     selfHeal: z.boolean().optional(),
```

---

### Incident Patch 7: `514970e1` (2026-09-24)
**Commit Message**: fix: verify cached local Chrome debug port before trusting it (#2542)

## What's the issue?

Browse can fail to connect to a healthy local Chrome because it trusts
an old browser connection URL saved in the profile's
`DevToolsActivePort` file. The existing check only confirms that
something is listening on the cached port; it does not confirm that the
saved browser target still exists.

For example, the file points to
`ws://127.0.0.1:9222/devtools/browser/old-id`, while the running Chrome
exposes `/devtools/browser/new-id`. Browse selects `old-id`, and the
connection fails with a 404 or connection reset.

This PR checks the cached target against Chrome's live `/json/version`
response. If they disagree, Browse discards the stale candidate and uses
its existing live-endpoint fallback. It compares URL paths so
`localhost` versus `127.0.0.1` does not invalidate a matching target,
and probes each port only once per discovery call.

## When does it happen?

1. A Chrome instance leaves a `DevToolsActivePort` file behind after
exiting.
2. A later browser instance uses the same debugging port, but has a
different browser target ID. An old profile file can therefore point to
a port now owned

**File**: `.changeset/tired-hounds-repair.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"browse": patch
+---
+
+Fix local browser discovery (`--auto-connect`, `browse doctor`) trusting a stale cached debugging port after a different Chrome process later reuses that same port.
```

**File**: `packages/cli/src/lib/driver/local-cdp-discovery.ts` (modified, +60/-25)
```diff
@@ -91,26 +91,6 @@ export async function readDevToolsActivePort(
   }
 }
 
-function isPortReachable(port: number, timeoutMs = 500): Promise<boolean> {
-  return new Promise((resolve) => {
-    const socket = net.createConnection({ host: "127.0.0.1", port });
-    const timer = setTimeout(() => {
-      socket.destroy();
-      resolve(false);
-    }, timeoutMs);
-
-    socket.on("connect", () => {
-      clearTimeout(timer);
-      socket.destroy();
-      resolve(true);
-    });
-    socket.on("error", () => {
-      clearTimeout(timer);
-      resolve(false);
-    });
-  });
-}
-
 async function probeJsonVersion(port: number): Promise<string | null> {
   const controller = new AbortController();
   const timer = setTimeout(() => controller.abort(), 2000);
@@ -131,6 +111,54 @@ async function probeJsonVersion(port: number): Promise<string | null> {
   }
 }
 
+/**
+ * Multiple candidates (several profile dirs, or a profile dir and a fallback
+ * port) can reference the same port within one discovery call. Memoize the
+ * live /json/version probe per port so that port is only actually hit once.
+ */
+function createJsonVersionProbe(): (port: number) => Promise<string | null> {
+  const cache = new Map<number, Promise<string | null>>();
+  return (port) => {
+    let pending = cache.get(port);
+    if (!pending) {
+      pending = probeJsonVersion(port);
+      cache.set(port, pending);
+    }
+    return pending;
+  };
+}
+
+function wsPathname(wsUrl: string): string | null {
+  try {
+    return new URL(wsUrl).pathname;
+  } catch {
+    return null;
+  }
+}
+
+/**
+ * A DevToolsActivePort file only reflects the browser instance that wrote it.
+ * If a different process later binds the same port (a very likely collision,
+ * since 9222 is the near-universal default debugging port), the cached
+ * port+wsPath pair points at a target that no longer exists. Confirm the
+ * port's live /json/version still reports this exact target before trusting
+ * it. Compare pathnames only (not the full URL) since Chrome can report the
+ * host as "127.0.0.1" or "localhost" depending on version/platform.
+ */
+async function isDevToolsActivePortFresh(
+  info: DevToolsActivePortInfo,
+  probe: (port: number) => Promise<string | null> = probeJsonVersion,
+): Promise<boolean> {
+  const liveWsUrl = await probe(info.port);
+  if (!liveWsUrl) return false;
+  const expectedPathname = wsPathname(
+    buildDevToolsWsUrl(info.port, info.wsPath),
+  );
+  return (
+    expectedPathname !== null && wsPathname(liveWsUrl) === expectedPathname
+  );
+}
+
 async function verifyCdpWebSocket(wsUrl: string): Promise<boolean> {
   return new Promise((resolve) => {
     const url = new URL(wsUrl);
@@ -177,11 +205,12 @@ async function verifyCdpWebSocket(wsUrl: string): Promise<boolean> {
 async function resolveDevToolsActivePortUrl(
   port: number,
   userDataDirs: string[],
+  probe: (port: number) => Promise<string | null>,
 ): Promise<string | null> {
   for (const dir of userDataDirs) {
     const info = await readDevToolsActivePort(dir);
     if (!info || info.port !== port) continue;
-    if (!(await isPortReachable(info.port))) continue;
+    if (!(await isDevToolsActivePortFresh(info, probe))) continue;
     return buildDevToolsWsUrl(info.port, info.wsPath);
   }
 
@@ -193,9 +222,14 @@ export async function resolveWsTargetFromPort(
   options: ResolveWsTargetFromPortOptions = {},
 ): Promise<string> {
   const userDataDirs = options.userDataDirs ?? getChromeUserDataDirs();
-  const devToolsUrl = await resolveDevToolsActivePortUrl(port, userDataDirs);
+  const probe = createJsonVersionProbe();
+  const devToolsUrl = await resolveDevToolsActivePortUrl(
+    port,
+    userDataDirs,
+    probe,
+  );
   if (devToolsUrl) return devToolsUrl;
-  const jsonVersionUrl = await probeJsonVersion(port);
+  const jsonVersionUrl = await probe(port);
   if (jsonVersionUrl) return jsonVersionUrl;
   const fallback = buildDevToolsWsUrl(port, "/devtools/browser");
   if
```

**File**: `packages/cli/tests/local-cdp-discovery.test.ts` (added, +232/-0)
```diff
@@ -0,0 +1,232 @@
+import { mkdtemp, rm, writeFile } from "node:fs/promises";
+import { createServer, type Server } from "node:http";
+import { tmpdir } from "node:os";
+import { join } from "node:path";
+import type { AddressInfo } from "node:net";
+
+import { afterEach, describe, expect, it } from "vitest";
+
+import {
+  discoverLocalCdp,
+  resolveWsTargetFromPort,
+} from "../src/lib/driver/local-cdp-discovery.js";
+
+/**
+ * Starts a fake CDP HTTP server on an OS-assigned port. `wsPathForPort` gets
+ * the bound port so it can bake the real port into the reported
+ * webSocketDebuggerUrl, mirroring how a real browser reports itself.
+ */
+async function startFakeCdpServer(
+  wsPathForPort: (port: number) => string,
+): Promise<{
+  port: number;
+  wsUrl: string;
+  requestCount: () => number;
+  close: () => Promise<void>;
+}> {
+  let wsUrl = "";
+  let requests = 0;
+  const server: Server = createServer((req, res) => {
+    if (req.url === "/json/version") {
+      requests += 1;
+      res.writeHead(200, { "content-type": "application/json" });
+      res.end(JSON.stringify({ webSocketDebuggerUrl: wsUrl }));
+      return;
+    }
+    res.writeHead(404);
+    res.end();
+  });
+
+  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
+  const { port } = server.address() as AddressInfo;
+  wsUrl = wsPathForPort(port);
+
+  return {
+    port,
+    wsUrl,
+    requestCount: () => requests,
+    close: () => new Promise((resolve) => server.close(() => resolve())),
+  };
+}
+
+async function writeDevToolsActivePort(
+  dir: string,
+  port: number,
+  wsPath: string,
+): Promise<void> {
+  await writeFile(
+    join(dir, "DevToolsActivePort"),
+    `${port}\n${wsPath}\n`,
+    "utf8",
+  );
+}
+
+describe("local CDP discovery", () => {
+  const tempDirs: string[] = [];
+  const servers: Array<() => Promise<void>> = [];
+
+  afterEach(async () => {
+    await Promise.all(servers.splice(0).map((close) => close()));
+    await Promise.all(
+      tempDirs
+        .splice(0)
+        .map((dir) => rm(dir, { recursive: true, force: true })),
+    );
+  });
+
+  it("resolveWsTargetFromPort ignores a stale DevToolsActivePort file when the live browser reports a different target", async () => {
+    const userDataDir = await mkdtemp(join(tmpdir(), "browse-cdp-stale-"));
+    tempDirs.push(userDataDir);
+
+    const {
+      port,
+      wsUrl: liveWsUrl,
+      close,
+    } = await startFakeCdpServer(
+      (p) => `ws://127.0.0.1:${p}/devtools/browser/live-id`,
+    );
+    servers.push(close);
+
+    // Simulate a leftover file from a previous Chrome instance that used to
+    // listen on this same port under a different browser id.
+    await writeDevToolsActivePort(
+      userDataDir,
+      port,
+      "/devtools/browser/stale-id",
+    );
+
+    const resolved = await resolveWsTargetFromPort(port, {
+      userDataDirs: [userDataDir],
+    });
+
+    expect(resolved).toBe(liveWsUrl);
+    expect(resolved).not.toContain("stale-id");
+  });
+
+  it("resolveWsTargetFromPort trusts a DevToolsActivePort file that matches the live browser", async () => {
+    const userDataDir = await mkdtemp(join(tmpdir(), "browse-cdp-fresh-"));
+    tempDirs.push(userDataDir);
+
+    const {
+      port,
+      wsUrl: liveWsUrl,
+      close,
+    } = await startFakeCdpServer(
+      (p) => `ws://127.0.0.1:${p}/devtools/browser/current-id`,
+    );
+    servers.push(close);
+
+    await writeDevToolsActivePort(
+      userDataDir,
+      port,
+      "/devtools/browser/current-id",
+    );
+
+    const resolved = await resolveWsTargetFromPort(port, {
+      userDataDirs: [userDataDir],
+    });
+
+    expect(resolved).toBe(liveWsUrl);
+  });
+
+  it("discoverLocalCdp skips a stale DevToolsActivePort candidate and falls back to a live fallback-port probe", async () => {
+    const userDataDir = await mkdtemp(join(tmpdir(), "browse-cdp-discover-"));
+    tempDirs.push(userDataDir);
+
+    const {
+      port,
+   
```

---

### Incident Patch 8: `f3543d32` (2026-09-23)
**Commit Message**: [fix]: wait for the locator world when a deep XPath crosses an iframe (#2978)

Thanks @trippyogi for the contribution! 

Fixes #2324.

Fix locator failures when entering an iframe whose Stagehand helpers are
still initializing, and correctly target the iframe element when an
XPath ends at the iframe.

- `xpath=/html/body/iframe[1]` stays in the parent document and targets
the iframe element without waiting for its contents.
- `xpath=/html/body/iframe[1]/html/body/button` enters the child frame
and waits for its locator helpers before resolving the button.

Frame transitions now wait for the locator world instead of the main
JavaScript world. Readiness retries use a **best-effort 1.2-second
budget per transition**, with attempts requesting up to 200 ms. Each
attempt rechecks session ownership so out-of-process iframe adoption
does not leave the wait on a stale session. Already-ready frames proceed
immediately.

If readiness fails, the error identifies the frame and configured
readiness budget and preserves the underlying failure as its cause. It
is no longer swallowed and replaced with a generic content-frame lookup
error.

This budget is not a hard operation timeout: fallback check

**File**: `.changeset/iframe-locator-world-readiness.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+---
+"@browserbasehq/stagehand-extension": patch
+"@browserbasehq/stagehand": patch
+"@browserbasehq/stagehand-python": patch
+"@browserbasehq/stagehand-go": patch
+---
+
+Fix locator failures when entering loading iframes, and correctly target iframe elements when an XPath ends at the iframe.
```

**File**: `packages/extension/tests/deep-locator.test.ts` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+import { describe, expect, it } from "vitest";
+import { planDeepXPathTarget } from "../understudy/deepLocator.js";
+
+describe("planDeepXPathTarget", () => {
+  it("keeps a trailing iframe as the parent-frame selector (no hop)", () => {
+    expect(planDeepXPathTarget("xpath=/html/body/iframe[1]")).toEqual({
+      frameHopSelectors: [],
+      finalSelector: "xpath=/html/body/iframe[1]",
+    });
+  });
+
+  it("hops into an iframe when further steps follow", () => {
+    expect(planDeepXPathTarget("xpath=/html/iframe[1]/html/body/button")).toEqual({
+      frameHopSelectors: ["xpath=/html/iframe[1]"],
+      finalSelector: "xpath=/html/body/button",
+    });
+  });
+
+  it("hops once then keeps a nested trailing iframe as the in-frame target", () => {
+    expect(planDeepXPathTarget("xpath=/html/iframe[1]/html/iframe[2]")).toEqual({
+      frameHopSelectors: ["xpath=/html/iframe[1]"],
+      finalSelector: "xpath=/html/iframe[2]",
+    });
+  });
+
+  it("supports nested crossing iframes", () => {
+    expect(planDeepXPathTarget("xpath=/html/iframe[1]/html/iframe[2]/html/body/button")).toEqual({
+      frameHopSelectors: ["xpath=/html/iframe[1]", "xpath=/html/iframe[2]"],
+      finalSelector: "xpath=/html/body/button",
+    });
+  });
+
+  it("treats frame the same as iframe for hop detection", () => {
+    expect(planDeepXPathTarget("/html/body/frame[1]/html/body/div")).toEqual({
+      frameHopSelectors: ["xpath=/html/body/frame[1]"],
+      finalSelector: "xpath=/html/body/div",
+    });
+  });
+});
```

**File**: `packages/extension/tests/frame-locator.test.ts` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+import { afterEach, describe, expect, it, vi } from "vitest";
+import type { CDPSessionLike } from "../understudy/cdp.js";
+import { executionContexts } from "../understudy/executionContextRegistry.js";
+import type { Frame } from "../understudy/frame.js";
+import { FrameLocator } from "../understudy/frameLocator.js";
+import type { Page } from "../understudy/page.js";
+
+function createSession(id: string): CDPSessionLike {
+  const send = vi.fn(async (method: string): Promise<unknown> => {
+    if (method === "DOM.describeNode") return { node: { backendNodeId: 1 } };
+    if (method === "DOM.getFrameOwner") return { backendNodeId: 1 };
+    return {};
+  });
+  return {
+    id,
+    send: send as CDPSessionLike["send"],
+    on: vi.fn(),
+    off: vi.fn(),
+    close: vi.fn(),
+  };
+}
+
+function createFrameLocator(
+  initialSession: CDPSessionLike,
+  getSessionForFrame: () => CDPSessionLike,
+): { locator: FrameLocator; childFrame: Frame } {
+  const childFrame = { frameId: "child" } as Frame;
+  const root = {
+    frameId: "parent",
+    session: initialSession,
+    locator: () => ({
+      resolveNode: async () => ({ objectId: "iframe-object" }),
+    }),
+  } as unknown as Frame;
+  const page = {
+    getFullFrameTree: () => ({
+      frame: { id: "parent" },
+      childFrames: [{ frame: { id: "child" } }],
+    }),
+    getSessionForFrame,
+    frameForId: () => childFrame,
+  } as unknown as Page;
+
+  return {
+    locator: new FrameLocator(page, "xpath=/html/body/iframe[1]", undefined, root),
+    childFrame,
+  };
+}
+
+describe("FrameLocator readiness", () => {
+  afterEach(() => {
+    vi.useRealTimers();
+    vi.restoreAllMocks();
+  });
+
+  it("reports the readiness budget and preserves the underlying failure", async () => {
+    const session = createSession("session-a");
+    const readinessError = new Error("Stagehand extension world not ready for frame child");
+    vi.useFakeTimers();
+    vi.setSystemTime(0);
+    vi.spyOn(executionContexts, "waitForLocatorWorld").mockImplementation(async () => {
+      vi.setSystemTime(1_200);
+      throw readinessError;
+    });
+    const { locator } = createFrameLocator(session, () => session);
+
+    await expect(locator.resolveFrame()).rejects.toMatchObject({
+      message: "Locator world not ready for frame child: exhausted 1200 ms frame-readiness budget",
+      cause: readinessError,
+    });
+  });
+
+  it("stops retrying at the readiness budget and preserves the last error", async () => {
+    const session = createSession("session-a");
+    const initialError = new Error("Locator world is still initializing");
+    const lastError = new Error("Stagehand extension world not ready for frame child");
+    vi.useFakeTimers();
+    vi.setSystemTime(0);
+    const waitForLocatorWorld = vi
+      .spyOn(executionContexts, "waitForLocatorWorld")
+      .mockImplementation(async (_session, _frameId, timeout) => {
+        // Simulate attempts that overrun their requested slice, as fallback can.
+        vi.setSystemTime(Date.now() + timeout! + 50);
+        throw Date.now() >= 1_200 ? lastError : initialError;
+      });
+    const { locator } = createFrameLocator(session, () => session);
+
+    await expect(locator.resolveFrame()).rejects.toMatchObject({
+      message: "Locator world not ready for frame child: exhausted 1200 ms frame-readiness budget",
+      cause: lastError,
+    });
+    expect(waitForLocatorWorld.mock.calls.map((call) => call[2])).toEqual([
+      200, 200, 200, 200, 200,
+    ]);
+    expect(Date.now()).toBe(1_250);
+  });
+
+  it("caps the final readiness attempt to the remaining budget", async () => {
+    const session = createSession("session-a");
+    const readinessError = new Error("Stagehand extension world not ready for frame child");
+    vi.useFakeTimers();
+    vi.setSystemTime(0);
+    const waitForLocatorWorld = vi
+      .spyOn(executionContexts, "waitForLocatorWorld")
+      .mockImplementation(async (
```

**File**: `packages/extension/understudy/deepLocator.ts` (modified, +34/-19)
```diff
@@ -212,34 +212,49 @@ export function deepLocatorFromPage(
   return new DeepLocatorDelegate(page, root, selector);
 }
 
-async function resolveDeepXPathTarget(
-  page: Page,
-  root: Frame,
-  xpathOrSelector: string,
-): Promise<ResolvedLocatorTarget> {
+/**
+ * Plan deep-XPath frame hops without resolving frames.
+ * An iframe/frame step becomes a hop only when further selector steps follow it,
+ * so a trailing iframe remains a parent-frame element target.
+ */
+export function planDeepXPathTarget(xpathOrSelector: string): {
+  frameHopSelectors: string[];
+  finalSelector: string;
+} {
   let path = xpathOrSelector.trim();
   if (path.startsWith("xpath=")) path = path.slice("xpath=".length).trim();
   if (!path.startsWith("/")) path = "/" + path;
 
   const steps = parseXPath(path);
-  let fl: FrameLocator | undefined;
+  const frameHopSelectors: string[] = [];
   let buf: Step[] = [];
 
-  const flushIntoFrameLocator = () => {
-    if (!buf.length) return;
-    const selectorForIframe = "xpath=" + buildXPathFromSteps(buf);
-    fl = fl
-      ? fl.frameLocator(selectorForIframe)
-      : frameLocatorFromFrame(page, root, selectorForIframe);
-    buf = [];
-  };
-
-  for (const st of steps) {
+  for (let i = 0; i < steps.length; i++) {
+    const st = steps[i]!;
     buf.push(st);
-    if (IFRAME_STEP_RE.test(st.name)) flushIntoFrameLocator();
+    const hasStepsAfter = i < steps.length - 1;
+    if (IFRAME_STEP_RE.test(st.name) && hasStepsAfter) {
+      frameHopSelectors.push("xpath=" + buildXPathFromSteps(buf));
+      buf = [];
+    }
   }
 
-  const finalSelector = "xpath=" + buildXPathFromSteps(buf);
+  return {
+    frameHopSelectors,
+    finalSelector: "xpath=" + buildXPathFromSteps(buf),
+  };
+}
+
+async function resolveDeepXPathTarget(
+  page: Page,
+  root: Frame,
+  xpathOrSelector: string,
+): Promise<ResolvedLocatorTarget> {
+  const plan = planDeepXPathTarget(xpathOrSelector);
+  let fl: FrameLocator | undefined;
+  for (const hop of plan.frameHopSelectors) {
+    fl = fl ? fl.frameLocator(hop) : frameLocatorFromFrame(page, root, hop);
+  }
   const targetFrame = fl ? await fl.resolveFrame() : root;
-  return { frame: targetFrame, selector: finalSelector };
+  return { frame: targetFrame, selector: plan.finalSelector };
 }
```

**File**: `packages/extension/understudy/frameLocator.ts` (modified, +39/-80)
```diff
@@ -4,6 +4,14 @@ import type { Page } from "./page.js";
 import { Frame } from "./frame.js";
 import { executionContexts } from "./executionContextRegistry.js";
 
+/** Best-effort readiness budget for frame transitions, not an overall operation timeout. */
+const FRAME_LOCATOR_READY_TIMEOUT_MS = 1_200;
+/**
+ * Best-effort timeout for each locator-world attempt. Fallback eligibility can
+ * extend an attempt while it waits for the main world.
+ */
+const LOCATOR_WORLD_ATTEMPT_TIMEOUT_MS = 200;
+
 /**
  * FrameLocator: resolves iframe elements to their child Frames and allows
  * creating locators scoped to that frame. Supports chaining.
@@ -52,18 +60,23 @@ export class FrameLocator {
       );
 
       for (const fid of childIds) {
+        let owner: {
+          backendNodeId: Protocol.DOM.BackendNodeId;
+          nodeId?: Protocol.DOM.NodeId;
+        };
         try {
-          const owner = await parentSession.send<{
+          owner = await parentSession.send<{
             backendNodeId: Protocol.DOM.BackendNodeId;
             nodeId?: Protocol.DOM.NodeId;
           }>("DOM.getFrameOwner", { frameId: fid as Protocol.Page.FrameId });
-          if (owner.backendNodeId === iframeBackendNodeId) {
-            // Ensure child frame is ready (handles OOPIF adoption or same-process)
-            await ensureChildFrameReady(this.page, parentFrame, fid, 1200);
-            return this.page.frameForId(fid);
-          }
         } catch {
           // ignore and try next
+          continue;
+        }
+        if (owner.backendNodeId === iframeBackendNodeId) {
+          // Readiness failures must propagate after the matching child is identified.
+          await ensureChildFrameReady(this.page, fid, FRAME_LOCATOR_READY_TIMEOUT_MS);
+          return this.page.frameForId(fid);
         }
       }
       throw new Error(`Unable to obtain a content frame for selector: ${this.selector}`);
@@ -186,90 +199,36 @@ function findFrameNode(
 }
 
 /**
- * Ensure we can evaluate in the child frame with minimal delay.
- * - If the child is same-process: parent session owns it and main world appears quickly.
- * - If OOPIF and adoption not finished: wait briefly for ownership change, then main world.
+ * Block until the Stagehand locator/extension world is usable in the child frame.
+ * Re-resolves CDP session ownership on each attempt so OOPIF adoption cannot pin
+ * the wait to a stale session for the full budget.
  */
 async function ensureChildFrameReady(
   page: Page,
-  parentFrame: Frame,
   childFrameId: string,
   budgetMs: number,
 ): Promise<void> {
-  const parentSession = parentFrame.session;
   const deadline = Date.now() + Math.max(0, budgetMs);
+  let lastError: unknown;
 
-  // If already owned by a different session (OOPIF adopted), wait briefly there.
-  const owner = page.getSessionForFrame(childFrameId);
-  if (owner && owner !== parentSession) {
+  while (Date.now() < deadline) {
+    const session = page.getSessionForFrame(childFrameId);
+    const remaining = deadline - Date.now();
+    if (remaining <= 0) break;
     try {
-      await executionContexts.waitForMainWorld(owner, childFrameId, 600);
-    } catch {
-      // best effort
+      await executionContexts.waitForLocatorWorld(
+        session,
+        childFrameId,
+        Math.min(remaining, LOCATOR_WORLD_ATTEMPT_TIMEOUT_MS),
+      );
+      if (page.getSessionForFrame(childFrameId) === session) return;
+    } catch (error) {
+      lastError = error;
     }
-    return;
   }
 
-  const hasMainWorldOnParent = (): boolean => {
-    try {
-      return executionContexts.getMainWorld(parentSession, childFrameId) !== null;
-    } catch {
-      return false;
-    }
-  };
-
-  if (hasMainWorldOnParent()) return;
-
-  await parentSession.send("Page.setLifecycleEventsEnabled", { enabled: true }).catch(() => {});
-  await parentSession.send("Runtime.enable").catch(() => {});
-
-  await new Promise<void>((resolve) => {
-    let done = false;
-    const finis
```

---

### Incident Patch 9: `21f44435` (2026-09-23)
**Commit Message**: fix(cli): resolve template sources and align setup instructions (#2799)

## 1. What is the problem?

`browse templates clone playwright` passes the public catalog slug
`playwright` to the scaffolder, although the [catalog
entry](https://www.browserbase.com/api/templates/playwright) identifies
its source as `playwright/quickstart-playwright`. The scaffolder expects
`quickstart-playwright`. Puppeteer and Selenium have the same mismatch.

The printed setup instructions also ignore the generated project's
package manager and Python environment: TypeScript always gets npm
commands, and Python can get `uv sync` followed by bare `python
main.py`.

## 2. Why does it matter, and what changes?

Users select a valid catalog template but can receive the wrong project
or instructions that run outside its dependency environment. The CLI
should translate the catalog's public identifier into the source
identifier and print commands consistent with the generated project.

This change targets V4 `main` and:

- Uses the final directory component of `sourcePath`, falling back to
`slug` when absent. For example, `playwright/quickstart-playwright`
becomes `quickstart-playwright`; an entry without `sourc

**File**: `.changeset/tidy-template-sources.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"browse": patch
+---
+
+Use catalog source paths when cloning templates and print setup commands that match the generated project's package manager and Python environment.
```

**File**: `packages/cli/src/lib/templates/api.ts` (modified, +2/-0)
```diff
@@ -9,6 +9,7 @@ export interface Template {
   description?: string;
   descriptionTitle?: string;
   source?: string;
+  sourcePath?: string;
   category: string[];
   tags: string[];
   commands: string[];
@@ -176,6 +177,7 @@ function parseTemplate(payload: unknown, context: string): Template {
       "descriptionTitle",
     ),
     source: optionalString(payload.source, context, "source"),
+    sourcePath: optionalString(payload.sourcePath, context, "sourcePath"),
     category: optionalStringArray(payload.category, context, "category"),
     tags: optionalStringArray(payload.tags, context, "tags"),
     commands: optionalStringArray(payload.commands, context, "commands"),
```

**File**: `packages/cli/src/lib/templates/scaffold.ts` (modified, +46/-20)
```diff
@@ -68,6 +68,10 @@ export async function cloneTemplate(
   const parentDir = dirname(dest);
   const projectName = basename(dest);
   const scaffolder = getScaffolder(language);
+  // create-browser-app identifies a template by its final source directory.
+  const scaffolderTemplate = basename(
+    options.template.sourcePath || options.template.slug,
+  );
   await mkdir(parentDir, { recursive: true });
   const existingEntries = await getDirectoryEntryNames(parentDir);
 
@@ -80,12 +84,7 @@ export async function cloneTemplate(
   try {
     runCommand(
       scaffolder.command,
-      [
-        ...scaffolder.argsPrefix,
-        projectName,
-        "--template",
-        options.template.slug,
-      ],
+      [...scaffolder.argsPrefix, projectName, "--template", scaffolderTemplate],
       parentDir,
     );
 
@@ -258,30 +257,31 @@ async function findCreatedProjectDir(
   return null;
 }
 
-async function buildNextSteps(
+export async function buildNextSteps(
   dest: string,
   displayPath: string,
   language: TemplateLanguage,
 ): Promise<string[]> {
   const nextSteps = [`cd ${displayPath}`];
 
   if (language === "typescript") {
-    if (existsSync(join(dest, "package.json"))) {
-      nextSteps.push("npm install");
+    const packageJson = await readPackageJson(dest);
+    const packageManager = resolvePackageManager(packageJson?.packageManager);
+    if (packageJson) {
+      nextSteps.push(`${packageManager} install`);
     }
 
     if (existsSync(join(dest, ".env.example"))) {
       nextSteps.push("cp .env.example .env");
     }
 
-    const packageJson = await readPackageJson(dest);
     if (packageJson?.scripts?.dev) {
-      nextSteps.push("npm run dev");
+      nextSteps.push(runPackageScript(packageManager, "dev"));
       return nextSteps;
     }
 
     if (packageJson?.scripts?.start) {
-      nextSteps.push("npm start");
+      nextSteps.push(runPackageScript(packageManager, "start"));
       return nextSteps;
     }
 
@@ -292,35 +292,61 @@ async function buildNextSteps(
     return nextSteps;
   }
 
-  if (existsSync(join(dest, "pyproject.toml"))) {
+  const hasPyproject = existsSync(join(dest, "pyproject.toml"));
+  const hasRequirements = existsSync(join(dest, "requirements.txt"));
+  if (hasPyproject) {
     nextSteps.push("uv sync");
-  } else if (existsSync(join(dest, "requirements.txt"))) {
-    nextSteps.push("pip install -r requirements.txt");
+  } else if (hasRequirements) {
+    nextSteps.push("uv venv && uv pip install -r requirements.txt");
   }
 
   if (existsSync(join(dest, ".env.example"))) {
     nextSteps.push("cp .env.example .env");
   }
 
   if (existsSync(join(dest, "main.py"))) {
-    nextSteps.push("python main.py");
+    nextSteps.push("uv run python main.py");
   }
 
   return nextSteps;
 }
 
-async function readPackageJson(
-  dest: string,
-): Promise<{ scripts?: Record<string, string> } | null> {
+async function readPackageJson(dest: string): Promise<{
+  packageManager?: string;
+  scripts?: Record<string, string>;
+} | null> {
   const packageJsonPath = join(dest, "package.json");
   if (!existsSync(packageJsonPath)) {
     return null;
   }
 
   try {
     const contents = await readFile(packageJsonPath, "utf8");
-    return JSON.parse(contents) as { scripts?: Record<string, string> };
+    return JSON.parse(contents) as {
+      packageManager?: string;
+      scripts?: Record<string, string>;
+    };
   } catch {
     return null;
   }
 }
+
+type PackageManager = "bun" | "npm" | "pnpm" | "yarn";
+
+function resolvePackageManager(packageManager?: string): PackageManager {
+  const name = packageManager?.split("@")[0];
+  if (name === "bun" || name === "pnpm" || name === "yarn") {
+    return name;
+  }
+  return "npm";
+}
+
+function runPackageScript(
+  packageManager: PackageManager,
+  script: string,
+): string {
+  if (packageManager === "npm" || packageManager === "bun") {
+    return `${packageManager} run ${script}`;
+  }
+  return `${packageManager} ${script}`;
```

**File**: `packages/cli/tests/cli-templates.test.ts` (modified, +48/-10)
```diff
@@ -11,6 +11,7 @@ import {
 } from "./helpers/fake-browserbase-server.js";
 import { runCli } from "./helpers/run-cli.js";
 import { itPosix } from "./helpers/platform.js";
+import { buildNextSteps } from "../src/lib/templates/scaffold.js";
 
 interface TemplateFixture {
   category: string[];
@@ -19,6 +20,7 @@ interface TemplateFixture {
   shortDescription: string;
   slug: string;
   source: string;
+  sourcePath?: string;
   steps: string[];
   tags: string[];
   title: string;
@@ -28,12 +30,13 @@ const templates: TemplateFixture[] = [
   {
     category: ["Web Automation", "E-commerce"],
     commands: [
-      "npx create-browser-app --template amazon-product-scraping",
-      "uvx create-browser-app --template amazon-product-scraping",
+      "npx create-browser-app --template amazon-product-scraping-starter",
+      "uvx create-browser-app --template amazon-product-scraping-starter",
     ],
     description: "Automatically scrape Amazon search results.",
     shortDescription: "Extract product data from Amazon search results.",
     slug: "amazon-product-scraping",
+    sourcePath: "commerce/amazon-product-scraping-starter",
     source: "Browserbase",
     steps: ["Open Amazon", "Extract product data"],
     tags: ["TypeScript", "Python", "Stagehand"],
@@ -78,6 +81,40 @@ afterEach(async () => {
 });
 
 describe("templates commands", () => {
+  it.each([
+    [undefined, "dev", "npm install", "npm run dev"],
+    ["npm@10.0.0", "start", "npm install", "npm run start"],
+    ["pnpm@10.0.0", "dev", "pnpm install", "pnpm dev"],
+    ["yarn@4.0.0", "start", "yarn install", "yarn start"],
+    ["bun@1.0.0", "dev", "bun install", "bun run dev"],
+  ] as const)(
+    "prints runnable %s setup instructions",
+    async (packageManager, script, install, run) => {
+      const dest = await createTempDir("browse-templates-manager-");
+      await writeFile(
+        join(dest, "package.json"),
+        JSON.stringify({
+          packageManager,
+          scripts: { [script]: "node index.js" },
+        }),
+      );
+      await expect(
+        buildNextSteps(dest, "my-app", "typescript"),
+      ).resolves.toEqual(["cd my-app", install, run]);
+    },
+  );
+
+  it("installs and runs requirements-based Python in the same uv environment", async () => {
+    const dest = await createTempDir("browse-templates-requirements-");
+    await writeFile(join(dest, "requirements.txt"), "requests\n");
+    await writeFile(join(dest, "main.py"), "print('hello')\n");
+    await expect(buildNextSteps(dest, "my-app", "python")).resolves.toEqual([
+      "cd my-app",
+      "uv venv && uv pip install -r requirements.txt",
+      "uv run python main.py",
+    ]);
+  });
+
   it("lists templates from the templates API", async () => {
     await withTemplatesApi(async ({ baseUrl, requests }) => {
       const result = await runCli(["templates", "list", "--format", "table"], {
@@ -257,7 +294,7 @@ describe("templates commands", () => {
           'printf \'npx %s\\n\' "$*" >> "$BB_STUB_LOG"',
           'project="$2"',
           'mkdir -p "$project"',
-          'printf \'{"name":"stub-app","scripts":{"dev":"tsx index.ts"}}\\n\' > "$project/package.json"',
+          'printf \'{"name":"stub-app","packageManager":"pnpm@10.24.0","scripts":{"dev":"tsx index.ts"}}\\n\' > "$project/package.json"',
           "printf 'BROWSERBASE_API_KEY=\\n' > \"$project/.env.example\"",
         ].join("\n"),
       );
@@ -281,16 +318,16 @@ describe("templates commands", () => {
           "/amazon-product-scraping",
         ]);
         expect(await readFile(logPath, "utf8")).toContain(
-          "npx create-browser-app@latest my-scraper --template amazon-product-scraping",
+          "npx create-browser-app@latest my-scraper --template amazon-product-scraping-starter",
         );
         expect(result.stdout).toContain(
           `Scaffolding typescript/amazon-product-scraping into ${dest}...`,
         );
         expect(result.stdout).toContain(`Template sc
```

---

### Incident Patch 10: `0721ee22` (2026-09-22)
**Commit Message**: fix(cli): restore V3 network capture through a CDP sidecar (#2849)

## Summary

Restore Browse V3 network-capture behavior on Stagehand V4 through a
CLI-private CDP sidecar, without committing core Stagehand, its
protocol, or generated SDKs to a public network-event schema.

## Stack (#2872)

1. #2833 — exact Browse V3 baseline import
2. #2834 — Stagehand V4 runtime and standard command parity
3. #2869 — CLI-owned cursor overlay
4. **#2849 — CLI-private CDP sidecar; V3 network parity**
5. #2835 — remove `--return-xpath`; supported V3 parity/release
checkpoint
6. #2838 — eval and packaging integration
7. #2839 — managed Context names (fast-follow)
8. #2701 — shared Functions core consumer (fast-follow)

## Architecture

- Lazily open one CLI-private browser-level CDP WebSocket using the
endpoint already held by the initialized Stagehand client.
- Attach a flattened CDP session to the active V4 page target.
- Present the unchanged V3 network writer with the same `on` / `off` /
`send` session shape.
- On `network off`, remove listeners, send `Network.disable`, and detach
the page target.
- Keep the browser-level sidecar WebSocket alive across off/on cycles;
closing an auxiliary Browse

**File**: `packages/cli/src/lib/driver/commands/network.ts` (modified, +2/-1)
```diff
@@ -3,7 +3,8 @@ import type { DriverCommandHandlers } from "./types.js";
 export const networkHandlers: DriverCommandHandlers = {
   async "network.on"(manager) {
     const page = await manager.activePage();
-    return manager.network.enable(page);
+    const websocketUrl = await manager.networkWebSocketDebuggerUrl();
+    return manager.network.enable(page, websocketUrl);
   },
 
   async "network.off"(manager) {
```

**File**: `packages/cli/src/lib/driver/network-capture.ts` (modified, +104/-47)
```diff
@@ -7,7 +7,10 @@ import {
   getNetworkDir,
   writePrivateFile,
 } from "./daemon/paths.js";
-import { DriverError } from "./errors.js";
+import {
+  NetworkCdpSidecar,
+  type NetworkCdpSession,
+} from "./network-cdp-sidecar.js";
 
 interface PendingRequest {
   body: string | null;
@@ -26,71 +29,102 @@ interface ResponseMetadata {
   statusText: string;
 }
 
-type CdpSession = {
-  off?: (event: string, listener: (...args: unknown[]) => void) => void;
-  on: (event: string, listener: (...args: unknown[]) => void) => void;
-  send: <T = unknown>(
-    method: string,
-    params?: Record<string, unknown>,
-  ) => Promise<T>;
+type StagehandV4Page = {
+  pageId: string;
 };
 
+/**
+ * The V3 Browse network writer, adapted only at the CDP-session boundary.
+ * Keeping request correlation and the on-disk request/response schema here
+ * unchanged gives the V4 CLI observable parity without adding a public
+ * Stagehand network-event API.
+ */
 export class NetworkCapture {
-  private cdpSession: CdpSession | null = null;
+  private cdpSession: NetworkCdpSession | null = null;
   private counter = 0;
   private enabled = false;
+  private lifecycle: Promise<void> = Promise.resolve();
   private readonly pendingRequests = new Map<string, PendingRequest>();
   private readonly requestDirs = new Map<string, Promise<string | null>>();
   private readonly requestStartTimes = new Map<string, number>();
   private readonly responseMetadata = new Map<string, ResponseMetadata>();
-  private readonly listeners: Array<[string, (...args: unknown[]) => void]> =
-    [];
+  private readonly listeners: Array<[string, (params: unknown) => void]> = [];
   private networkDir: string | null = null;
 
-  constructor(private readonly session: string) {}
+  constructor(
+    private readonly session: string,
+    private readonly sidecar = new NetworkCdpSidecar(),
+  ) {}
 
   async enable(
-    page: unknown,
+    page: StagehandV4Page,
+    browserWebSocketDebuggerUrl: string,
   ): Promise<{ alreadyEnabled?: boolean; enabled: true; path: string }> {
-    if (this.enabled && this.networkDir) {
+    return this.runLifecycle(() =>
+      this.enableNow(page, browserWebSocketDebuggerUrl),
+    );
+  }
+
+  async disable(): Promise<{
+    alreadyDisabled?: boolean;
+    enabled: false;
+    path: string | null;
+  }> {
+    return this.runLifecycle(() => this.disableNow());
+  }
+
+  private async enableNow(
+    page: StagehandV4Page,
+    browserWebSocketDebuggerUrl: string,
+  ): Promise<{ alreadyEnabled?: boolean; enabled: true; path: string }> {
+    if (this.enabled && this.networkDir && this.cdpSession?.connected) {
       return { alreadyEnabled: true, enabled: true, path: this.networkDir };
     }
-
-    const cdpSession = await this.networkCdpSession(page);
+    if (this.enabled) await this.disableNow();
 
     await ensureRuntimeDir();
     this.networkDir = getNetworkDir(this.session);
     await ensurePrivateDir(this.networkDir);
-    this.counter = 0;
+    this.counter = await nextRequestCounter(this.networkDir);
     this.pendingRequests.clear();
     this.requestDirs.clear();
     this.requestStartTimes.clear();
     this.responseMetadata.clear();
 
+    const cdpSession = await this.sidecar.attach(
+      browserWebSocketDebuggerUrl,
+      page.pageId,
+    );
     this.cdpSession = cdpSession;
-    await cdpSession.send("Network.enable", {
-      maxResourceBufferSize: 5_000_000,
-      maxTotalBufferSize: 10_000_000,
-    });
+    try {
+      await cdpSession.send("Network.enable", {
+        maxResourceBufferSize: 5_000_000,
+        maxTotalBufferSize: 10_000_000,
+      });
 
-    this.addListener("Network.requestWillBeSent", (params) => {
-      void this.handleRequestWillBeSent(params);
-    });
-    this.addListener("Network.responseReceived", (params) => {
-      this.handleResponseReceived(params);
-    });
-    this.addListener("Network.loadingFinished", (params) => {
-      void this.handleLoadingFinished(params);
-    })
```

**File**: `packages/cli/src/lib/driver/network-cdp-sidecar.ts` (added, +307/-0)
```diff
@@ -0,0 +1,307 @@
+import WebSocket from "ws";
+
+import { DriverError } from "./errors.js";
+
+type CdpEventListener = (params: unknown) => void;
+
+interface CdpMessage {
+  error?: { code: number; message: string };
+  id?: number;
+  method?: string;
+  params?: unknown;
+  result?: unknown;
+  sessionId?: string;
+}
+
+interface PendingCommand {
+  method: string;
+  reject: (error: Error) => void;
+  resolve: (result: unknown) => void;
+}
+
+export interface NetworkCdpSession {
+  readonly connected: boolean;
+  detach(): Promise<void>;
+  off(event: string, listener: CdpEventListener): void;
+  on(event: string, listener: CdpEventListener): void;
+  send<T = unknown>(
+    method: string,
+    params?: Record<string, unknown>,
+  ): Promise<T>;
+}
+
+export type NetworkCdpWebSocketFactory = (url: string) => WebSocket;
+
+/**
+ * A CLI-owned browser-level CDP connection used only for V3-compatible
+ * network capture. The connection is intentionally kept alive across
+ * `network off`/`network on`: Browserbase treats closing an auxiliary browser
+ * WebSocket as a browser-session disconnect. It is closed only with the Browse
+ * driver session.
+ */
+export class NetworkCdpSidecar {
+  private connecting: Promise<void> | null = null;
+  private nextId = 1;
+  private readonly pending = new Map<number, PendingCommand>();
+  private readonly sessions = new Map<
+    string,
+    Map<string, Set<CdpEventListener>>
+  >();
+  private socket: WebSocket | null = null;
+  private websocketUrl: string | null = null;
+
+  constructor(
+    private readonly createWebSocket: NetworkCdpWebSocketFactory = (url) =>
+      new WebSocket(url),
+  ) {}
+
+  async attach(
+    websocketUrl: string,
+    targetId: string,
+  ): Promise<NetworkCdpSession> {
+    await this.ensureConnected(websocketUrl);
+    const { sessionId } = await this.sendCommand<{ sessionId: string }>(
+      "Target.attachToTarget",
+      { flatten: true, targetId },
+    );
+    this.sessions.set(sessionId, new Map());
+    return new AttachedNetworkCdpSession(this, sessionId);
+  }
+
+  close(): void {
+    const socket = this.socket;
+    this.disconnect(
+      socket,
+      new DriverError("Network capture CDP sidecar closed.", {
+        code: "network_sidecar_closed",
+      }),
+    );
+    if (
+      socket &&
+      (socket.readyState === WebSocket.OPEN ||
+        socket.readyState === WebSocket.CONNECTING)
+    ) {
+      socket.close();
+    }
+  }
+
+  hasSession(sessionId: string): boolean {
+    return (
+      this.socket?.readyState === WebSocket.OPEN && this.sessions.has(sessionId)
+    );
+  }
+
+  on(sessionId: string, event: string, listener: CdpEventListener): void {
+    const listeners = this.sessions.get(sessionId);
+    if (!listeners) return;
+    const eventListeners = listeners.get(event) ?? new Set<CdpEventListener>();
+    eventListeners.add(listener);
+    listeners.set(event, eventListeners);
+  }
+
+  off(sessionId: string, event: string, listener: CdpEventListener): void {
+    const listeners = this.sessions.get(sessionId);
+    const eventListeners = listeners?.get(event);
+    eventListeners?.delete(listener);
+    if (eventListeners?.size === 0) listeners?.delete(event);
+  }
+
+  async sendToSession<T = unknown>(
+    sessionId: string,
+    method: string,
+    params: Record<string, unknown> = {},
+  ): Promise<T> {
+    if (!this.sessions.has(sessionId)) {
+      throw new DriverError("Network capture CDP session is detached.", {
+        code: "network_sidecar_detached",
+      });
+    }
+    return this.sendCommand<T>(method, params, sessionId);
+  }
+
+  async detach(sessionId: string): Promise<void> {
+    if (!this.sessions.has(sessionId)) return;
+    this.sessions.delete(sessionId);
+    await this.sendCommand("Target.detachFromTarget", { sessionId }).catch(
+      () => undefined,
+    );
+  }
+
+  private async ensureConnected(websocketUrl: string): Promise<void> {
+    if (this.socket?.readyState === WebSocke
```

**File**: `packages/cli/src/lib/driver/session-manager.ts` (modified, +13/-1)
```diff
@@ -161,6 +161,18 @@ export class DriverSessionManager {
     return this.stagehand;
   }
 
+  async networkWebSocketDebuggerUrl(): Promise<string> {
+    const stagehand = await this.stagehandInstance();
+    const websocketUrl = stagehand.rpcClient?.browserWebSocketDebuggerUrl;
+    if (!websocketUrl) {
+      throw new DriverError(
+        "Stagehand did not expose the browser CDP endpoint required for network capture.",
+        { code: "network_sidecar_endpoint_unavailable" },
+      );
+    }
+    return websocketUrl;
+  }
+
   async status(): Promise<DriverStatus> {
     if (!this.stagehand || !this.context) {
       return {
@@ -212,7 +224,7 @@ export class DriverSessionManager {
     this.browserbaseIdentityValue = {};
     this.initFailure = null;
     this.consecutiveInitFailures = 0;
-    await this.network.disable().catch(() => undefined);
+    await this.network.close().catch(() => undefined);
     if (stagehand) {
       await stagehand.close().catch(() => undefined);
     }
```

**File**: `packages/cli/tests/driver-commands.test.ts` (modified, +8/-8)
```diff
@@ -520,24 +520,24 @@ describe("driver commands", () => {
     }
   });
 
-  it("reports the isolated V4 network-capture gap", async () => {
+  it("enables sidecar network capture", async () => {
     const page = {};
     const network = {
-      enable: vi.fn(async () => {
-        throw new Error("Network capture is not available");
-      }),
+      enable: vi.fn(async () => ({ enabled: true, path: "/tmp/network" })),
     };
     const manager = {
       activePage: vi.fn(async () => page),
       network,
+      networkWebSocketDebuggerUrl: vi.fn(async () => "ws://sidecar.test"),
     } as unknown as Parameters<
       NonNullable<(typeof networkHandlers)["network.on"]>
     >[0];
 
-    await expect(networkHandlers["network.on"]!(manager, {})).rejects.toThrow(
-      "Network capture is not available",
-    );
-    expect(network.enable).toHaveBeenCalledWith(page);
+    await expect(networkHandlers["network.on"]!(manager, {})).resolves.toEqual({
+      enabled: true,
+      path: "/tmp/network",
+    });
+    expect(network.enable).toHaveBeenCalledWith(page, "ws://sidecar.test");
   });
 
   it("installs the CLI-owned cursor overlay", async () => {
```

#### Recent Merged Pull Requests:
- **PR #3077** (2026-09-30): docs: Prose guide fix and clarify purpose of template (@akeimach)
- **PR #3076** (2026-09-30): docs: fix broken links in Go, Java, and evals pages (@pratikgx)
- **PR #3075** (2026-09-30): docs: Update Stagehand deployment docs with Functions support (#3056) (@akeimach)
- **PR #3070** (2026-09-28): docs: reorganize integrations and add Stripe WebMCP guide (#3011) (@Kylejeong2)
- **PR #3069** (2026-09-28): [chore]: fix failing CI due to external website change (@seanmcguire12)
- **PR #3066** (2026-09-28): [chore]: use absolute gh URLs for readme links (@seanmcguire12)
- **PR #3056** (2026-09-30): docs: Update Stagehand deployment docs with Functions support (@akeimach)
- **PR #3055** (2026-09-30): fix(cli): Functions CLI updates for `init` and `publish` (@akeimach)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
