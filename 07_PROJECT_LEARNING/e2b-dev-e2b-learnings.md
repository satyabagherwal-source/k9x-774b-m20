# Forensic Learning Record (Deep Inspection): e2b-dev/E2B

> **Canonical Artifact**: `07_PROJECT_LEARNING/e2b-dev-e2b-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/e2b-dev/E2B](https://github.com/e2b-dev/E2B))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:22:00.436Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `e2b-dev/E2B`
- **Description**: Open-source, secure environment with real-world tools for enterprise-grade agents.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 14053 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/cli/src/api.ts`
```
import * as boxen from 'boxen'
import * as e2b from 'e2b'

import * as packageJSON from '../package.json'
import { getUserConfig, UserConfig } from './user'
import { asBold, asPrimary } from './utils/format'

// Must run before any ConnectionConfig is constructed (including the
// module-level one below) — configs read the integration at construction time.
e2b.ConnectionConfig.setIntegration(`e2b-cli/${packageJSON.version}`)

export type Teams =
  e2b.paths['/teams']['get']['responses'][200]['content']['application/json']

export let apiKey = process.env.E2B_API_KEY
export const projectId = process.env.E2B_PROJECT_ID || process.env.E2B_TEAM_ID

const authErrorBox = () => {
  const body = `You must be logged in to use this command. Run ${asBold(
    'e2b auth login'
  )}.

If you are seeing this message in CI/CD you may need to set the ${asBold(
    'E2B_API_KEY'
  )} environment variable.
Visit ${asPrimary('https://e2b.dev/dashboard?tab=keys')} to get the API key.`
  return boxen.default(body, {
    width: 70,
    float: 'center',
    padding: 0.5,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'redBright',
  })
}

export function ensureAPIKey() {
  // If apiKey is not already set (either from env var or from user config), try to get it from config file
  if (!apiKey) {
    const userConfig = getUserConfig()
    apiKey = userConfig?.projectApiKey
  }

  if (!apiKey) {
    console.error(authErrorBox())
    process.exit(1)
  } else {
    return apiKey
  }
}

export function ensureUserConfig(): UserConfig {
  const userConfig = getUserConfig()
  if (!userConfig) {
    console.error('No user config found, run `e2b auth login` to log in first.')
    process.exit(1)
  }
  return userConfig
}

/**
 * Resolve project ID with proper precedence:
 * 1. CLI --project flag (or the deprecated --team flag)
 * 2. E2B_PROJECT_ID env var (or the deprecated E2B_TEAM_ID)
 * 3. ~/.e2b/config.json projectId (only if E2B_API_KEY env var is NOT set,
 *    to avoid mismatch between env var API key and config file project ID)
 */
export function resolveProjectId(cliProjectId?: string): string | undefined {
  if (cliProjectId) return cliProjectId
  if (projectId) return projectId
  if (!process.env.E2B_API_KEY) {
    const config = getUserConfig()
    return config?.projectId
  }
  return undefined
}

const userConfig = getUserConfig()

export const connectionConfig = new e2b.ConnectionConfig({
  apiKey: process.env.E2B_API_KEY || userConfig?.projectApiKey,
})

// `e2b auth login` runs before any API key exists, and this client is built at
// import time, so don't require an API key here.
export const client = new e2b.ApiClient(connectionConfig, {
  requireApiKey: false,
})

```

### Core Architecture Module: `packages/cli/src/commands/auth/configure.ts`
```
import * as commander from 'commander'
import * as chalk from 'chalk'
import * as e2b from 'e2b'

import {
  USER_CONFIG_PATH,
  getConfigRefreshTimestamp,
  getUserConfig,
  writeUserConfig,
} from 'src/user'
import { ensureUserConfig, Teams } from 'src/api'
import { ensureValidAccessToken } from 'src/utils/token-refresh'
import { asBold, asFormattedTeam } from '../../utils/format'
import { handleE2BRequestError } from '../../utils/errors'

export const configureCommand = new commander.Command('configure')
  .description('configure user')
  .action(async () => {
    const inquirer = await import('inquirer')

    console.log('Configuring user...\n')

    // A file that exists but fails validation counts as signed out too —
    // getUserConfig returns null for it (and prints the deprecation message).
    if (!getUserConfig()) {
      console.log('No user config found, run `e2b auth login` to log in first.')
      return
    }

    // ensureValidAccessToken may refresh tokens and write them to disk.
    // Re-read the config afterwards so we persist the refreshed tokens
    // instead of overwriting them with stale in-memory copies.
    const accessToken = await ensureValidAccessToken()
    const userConfig = ensureUserConfig()

    const config = new e2b.ConnectionConfig({
      apiHeaders: { Authorization: `Bearer ${accessToken}` },
    })
    const authClient = new e2b.ApiClient(config, { requireApiKey: false })

    const res = await authClient.api.GET('/teams', {
      signal: config.getSignal(),
    })

    handleE2BRequestError(res, 'Error getting projects')
    const teams = res.data as Teams

    const team = (
      await inquirer.default.prompt([
        {
          name: 'project',
          message: chalk.default.underline('Select project'),
          type: 'list',
          pageSize: 50,
          choices: teams.map((team) => ({
            name: asFormattedTeam(team, userConfig.projectId),
            value: team,
          })),
        },
      ])
    )['project']

    userConfig.projectName = team.name
    userConfig.projectId = team.teamID
    userConfig.projectApiKey = team.apiKey
    userConfig.last_refresh = getConfigRefreshTimestamp()
    writeUserConfig(USER_CONFIG_PATH, userConfig)

    console.log(`Project ${asBold(team.name)} (${team.teamID}) selected.\n`)
  })

```

### Core Architecture Module: `packages/cli/src/commands/auth/index.ts`
```
import * as commander from 'commander'
import { loginCommand } from './login'
import { logoutCommand } from './logout'
import { infoCommand } from './info'
import { configureCommand } from './configure'

export const authCommand = new commander.Command('auth')
  .description('authentication commands')
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
  .addCommand(infoCommand)
  .addCommand(configureCommand)

```

### Core Architecture Module: `packages/cli/src/commands/auth/info.ts`
```
import * as commander from 'commander'

import { getUserConfig } from 'src/user'
import { asFormattedConfig, asFormattedError } from 'src/utils/format'

export const infoCommand = new commander.Command('info')
  .description('get information about the current user')
  .action(async () => {
    let userConfig
    try {
      userConfig = getUserConfig()
    } catch (err) {
      console.error(asFormattedError('Failed to read user config', err))
    }

    if (!userConfig) {
      console.log('Not logged in')
      return
    }

    console.log(asFormattedConfig(userConfig))

    process.exit(0)
  })

```

### Core Architecture Module: `packages/cli/src/commands/auth/login.ts`
```
import * as listen from 'async-listen'
import * as commander from 'commander'
import * as http from 'http'
import * as e2b from 'e2b'

import { pkg } from 'src'
import {
  DOCS_BASE,
  getConfigRefreshTimestamp,
  getUserConfig,
  writeUserConfig,
  USER_CONFIG_PATH,
  UserConfig,
} from 'src/user'
import { asBold, asFormattedConfig, asFormattedError } from 'src/utils/format'
import { openUrlInBrowser } from 'src/utils/openBrowser'
import { connectionConfig, Teams } from 'src/api'
import { handleE2BRequestError } from '../../utils/errors'

export const loginCommand = new commander.Command('login')
  .description('log in to CLI')
  .action(async () => {
    let userConfig: UserConfig | null = null

    try {
      userConfig = getUserConfig()
    } catch (err) {
      console.error(asFormattedError('Failed to read user config', err))
    }
    if (userConfig) {
      console.log(
        `\nAlready logged in. ${asFormattedConfig(
          userConfig
        )}.\n\nIf you want to log in as a different user, log out first by running 'e2b auth logout'.\nTo change the project, run 'e2b auth configure'.\n`
      )
      return
    } else if (!userConfig) {
      console.log('Attempting to log in...')
      const signInResponse = await signInWithBrowser()
      if (!signInResponse) {
        console.info('Login aborted')
        return
      }

      const accessToken = signInResponse.accessToken

      const signal = connectionConfig.getSignal()
      const config = new e2b.ConnectionConfig({
        apiHeaders: { Authorization: `Bearer ${accessToken}` },
      })
      const client = new e2b.ApiClient(config, { requireApiKey: false })
      const res = await client.api.GET('/teams', {
        signal,
      })

      handleE2BRequestError(res, 'Error getting projects')
      const teams = res.data as Teams

      const defaultTeam = teams.find((team) => team.isDefault)
      if (!defaultTeam) {
        console.error(
          asFormattedError('No default project found, please contact support')
        )
        process.exit(1)
      }

      userConfig = {
        version: 2,
        identity: {
          email: signInResponse.email,
        },
        oauth: {
          token_endpoint: signInResponse.tokenEndpoint,
          revoke_endpoint: signInResponse.revokeEndpoint,
          client_id: signInResponse.clientId,
        },
        tokens: {
          access_token: accessToken,
          refresh_token: signInResponse.refreshToken,
        },
        last_refresh: getConfigRefreshTimestamp(),
        projectName: defaultTeam.name,
        projectId: defaultTeam.teamID,
        projectApiKey: defaultTeam.apiKey,
      }

      writeUserConfig(USER_CONFIG_PATH, userConfig)
    }

    console.log(
      `Logged in as ${asBold(
        userConfig.identity.email
      )} with selected project ${asBold(userConfig.projectName)}`
    )
    process.exit(0)
  })

interface SignInWithBrowserResponse {
  email: string
  accessToken: string
  refreshToken: string
  tokenEndpoint: string
  revokeEndpoint: string
  clientId: string
}

async function signInWithBrowser(): Promise<SignInWithBrowserResponse> {
  const server = http.createServer()
  const { port } = await listen.default(server, 0, '127.0.0.1')
  const loginUrl = new URL(`${DOCS_BASE}/api/cli`)
  loginUrl.searchParams.set('next', `http://localhost:${port}`)
  loginUrl.searchParams.set('cliVersion', pkg.version)

  return new Promise((resolve, reject) => {
    server.once('request', (req, res) => {
      // Close the HTTP connection to prevent `server.close()` from hanging
      res.setHeader('connection', 'close')
      const followUpUrl = new URL(`${DOCS_BASE}/api/cli`)
      const searchParams = new URL(req.url || '/', 'http://localhost')
        .searchParams
      const searchParamsObj = Object.fromEntries(
        searchParams.entries()
      ) as unknown as SignInWithBrowserResponse & {
        error?: string
      }
      const { error } = searchParamsObj
      if (error) {
        reject(new Error(error))
        followUpUrl.searchParams.set('state', 'error')
        followUpUrl.searchParams.set('error', error)
      } else if (
        !searchParamsObj.email ||
        !searchParamsObj.accessToken ||
        !searchParamsObj.refreshToken ||
        !searchParamsObj.tokenEndpoint ||
        !searchParamsObj.revokeEndpoint ||
        !searchParamsObj.clientId
      ) {
        reject(new Error('Incomplete login response from server'))
        followUpUrl.searchParams.set('state', 'error')
        followUpUrl.searchParams.set(
          'error',
          'Incomplete login response from server'
        )
      } else {
        resolve(searchParamsObj)
        followUpUrl.searchParams.set('state', 'success')
        followUpUrl.searchParams.set('email', searchParamsObj.email!)
      }

      res.statusCode = 302
      res.setHeader('location', followUpUrl.href)
      res.end()
    })

    let manualUrlPrinted = false
    const printManualUrl = () => {
      if (manualUrlPrinted) return
      manualUrlPrinted = true
      console.log(
        `\nCould not open a browser automatically. Please open the following URL manually to continue:\n\n${loginUrl.toString()}\n\nIf interactive login is unavailable, you can also authenticate by setting the ${asBold(
          'E2B_API_KEY'
        )} environment variable instead.\n`
      )
    }

    openUrlInBrowser(loginUrl.toString(), printManualUrl)
  })
}

```

### Core Architecture Module: `packages/cli/src/commands/auth/logout.ts`
```
import * as commander from 'commander'
import * as fs from 'fs'

import { getUserConfig, USER_CONFIG_PATH } from 'src/user'

export const logoutCommand = new commander.Command('logout')
  .description('log out of CLI')
  .action(async () => {
    if (!fs.existsSync(USER_CONFIG_PATH)) {
      console.log('Not logged in, nothing to do')
      return
    }

    let config
    try {
      config = getUserConfig()
    } catch {
      // Malformed config file — proceed to delete it below
    }
    if (config) {
      await fetch(config.oauth.revoke_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: config.tokens.refresh_token,
          token_type_hint: 'refresh_token',
          client_id: config.oauth.client_id,
        }),
      }).catch(() => {})
    }

    if (fs.existsSync(USER_CONFIG_PATH)) {
      fs.unlinkSync(USER_CONFIG_PATH)
    }
    console.log('Logged out.')
  })

```

### Core Architecture Module: `packages/cli/src/commands/index.ts`
```
import * as commander from 'commander'

import { asPrimary } from 'src/utils/format'
import { templateCommand } from './template'
import { sandboxCommand } from './sandbox'
import { authCommand } from './auth'

export const program = new commander.Command()
  // Fixed so help reads `e2b` however the entrypoint is invoked (npm bin
  // symlink, `node dist/index.js`, or a distro wrapper script).
  .name('e2b')
  .enablePositionalOptions()
  .description(
    `Create sandbox templates from Dockerfiles by running ${asPrimary(
      'e2b template create'
    )} then use our SDKs to create sandboxes from these templates.

Visit ${asPrimary(
      'E2B docs (https://e2b.dev/docs)'
    )} to learn how to create sandbox templates and start sandboxes.
`
  )
  .addCommand(authCommand)
  .addCommand(templateCommand)
  .addCommand(sandboxCommand)

```

### Core Architecture Module: `packages/cli/src/commands/sandbox/connect.ts`
```
import * as e2b from 'e2b'
import * as commander from 'commander'

import { spawnConnectedTerminal, TerminalOpts } from 'src/terminal'
import { asBold, asPrimary } from 'src/utils/format'
import { ensureAPIKey } from '../../api'
import { parseEnv } from 'src/utils/env'
import { printDashboardSandboxInspectUrl } from 'src/utils/urls'

export const connectCommand = new commander.Command('connect')
  .description('connect terminal to already running sandbox')
  .argument('<sandboxID>', `connect to sandbox with ${asBold('<sandboxID>')}`)
  .option('-u, --user <user>', 'user to start the terminal session as')
  .option('-c, --cwd <dir>', 'working directory for the terminal session')
  .option(
    '-e, --env <KEY=VALUE>',
    'set environment variable for the terminal session (repeatable)',
    parseEnv,
    {} as Record<string, string>
  )
  .alias('cn')
  .action(
    async (
      sandboxID: string,
      opts: { user?: string; cwd?: string; env?: Record<string, string> }
    ) => {
      try {
        const apiKey = ensureAPIKey()

        if (!sandboxID) {
          console.error('You need to specify sandbox ID')
          process.exit(1)
        }

        await connectToSandbox({
          apiKey,
          sandboxID,
          terminal: {
            user: opts.user,
            cwd: opts.cwd,
            envs:
              opts.env && Object.keys(opts.env).length > 0
                ? opts.env
                : undefined,
          },
        })
        // We explicitly call exit because the sandbox is keeping the program alive.
        // We also don't want to call sandbox.close because that would disconnect other users from the edit session.
        process.exit(0)
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )

async function connectToSandbox({
  apiKey,
  sandboxID,
  terminal,
}: {
  apiKey: string
  sandboxID: string
  terminal?: TerminalOpts
}) {
  const sandbox = await e2b.Sandbox.connect(sandboxID, { apiKey })

  printDashboardSandboxInspectUrl(sandbox.sandboxId)

  console.log(
    `Terminal connecting to sandbox ${asPrimary(`${sandbox.sandboxId}`)}`
  )
  await spawnConnectedTerminal(sandbox, terminal)
  console.log(
    `Closing terminal connection to sandbox ${asPrimary(sandbox.sandboxId)}`
  )
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1841** (2026-09-09): **Volume.create skips the OpenAPI name pattern**
  *Symptoms*: OpenAPI `NewVolume.name` pattern is `^[a-zA-Z0-9_-]+$`. In the Python SDK with E2B_API_KEY unset, `Volume.create('')` and `Volume.create('vol name')` both raised AuthenticationException from get_api_client, so nothing checks the name before the API client is built. JS `Volume.create` in packages/js-sdk/src/volume/index.ts also builds ApiClient and POSTs /volumes with no name check. 
  **Post-Mortem & Fix Analysis**:
  > **Triage**  - **type**: bug - **priority**: medium - **complexity**: small - **affected_area**: js-sdk/volume, python-sdk/volume - **actionable**: yes - **needs_clarification**: false - **summary**: Add client-side validation of the volume name against the OpenAPI `^[a-zA-Z0-9_-]+$` pattern in both the JS and Python SDK `Volume.create` before building the API client, so invalid names fail fast with a clear error instead of an auth/API error.  [Written by Devin](https://app.devin.ai/sessions/36700c42b2e34c0bb56d6168481013d9)
  > I'll take this. With E2B_API_KEY unset, Volume.create('') and Volume.create('vol name') raised AuthenticationException from get_api_client. OpenAPI NewVolume.name is ^[a-zA-Z0-9_-]+$. Python and JS create both build the API client with no name check. 
  > Closing this as we discussed in the PR - the validation is done server-side.

- **Issue #1840** (2026-09-09): **Python Sandbox.create(timeout=0) sends the 300s default instead of 0**
  *Symptoms*: Python `Sandbox.create(timeout=0)` with a mocked `post_sandboxes` posted `timeout: 300`. Same for `Sandbox.connect(..., timeout=0)` via mocked `post_sandboxes_sandbox_id_connect`. Sync `_create` uses `timeout or cls.default_sandbox_timeout` (300) and sync `_cls_connect` uses `timeout or SandboxBase.default_sandbox_timeout`, so 0 is treated as unset. JS create uses `timeoutMs ?? defaultSandboxTimeoutMs`, which leaves 0 alone. 
  **Post-Mortem & Fix Analysis**:
  > **Triage**  - **type**: bug - **priority**: medium - **complexity**: trivial - **affected_area**: python-sdk/sandbox create+connect timeout handling - **actionable**: yes - **needs_clarification**: false - **summary**: In the Python SDK, `Sandbox.create(timeout=0)` and `Sandbox.connect(..., timeout=0)` fall back to the 300s default because they use `timeout or default_sandbox_timeout`, treating an explicit 0 as unset, unlike the JS SDK which uses `??`.  [Written by Devin](https://app.devin.ai/sessions/d00c3f630f144e4db6e321b191e5808b)
  > I'll take this. Mocked post_sandboxes: Sandbox.create(timeout=0) posted 300. Mocked connect: timeout=0 also posted 300. Sync _create and _cls_connect use `timeout or default`. 
  > Closing this as we discussed in the PR - this is currently on purpose.

- **Issue #1833** (2026-09-09): **Secret.create skips the name rules that Secret.fill already enforces**
  *Symptoms*: Secret.fill('') and Secret.fill('a}b') raise InvalidArgumentException, but Secret.create('', 'v') and Secret.create('a}b', 'v') skip that check: in the python-sdk venv with E2B_API_KEY unset they raise AuthenticationException from get_api_client instead. JS matches: in packages/js-sdk/src/secret.ts validateSecretName is only called from fill(), and create() constructs ApiClient first. 
  **Post-Mortem & Fix Analysis**:
  > **Triage**  - **type**: bug - **priority**: medium - **complexity**: small - **affected_area**: js-sdk/secret, python-sdk/secret (sync + async) - **actionable**: yes - **needs_clarification**: false - **summary**: `Secret.create()` in both the JS and Python SDKs skips the secret-name validation that `Secret.fill()` enforces, so invalid names fail later with an unrelated `AuthenticationException`/API error instead of an `InvalidArgumentException`; the fix is to validate the name before constructing the API client in all three implementations.  [Written by Devin](https://app.devin.ai/sessions/308fa38631134659b104f73340a8791d)
  > I'll take this. Reproduced with no E2B_API_KEY: Secret.fill('') raises InvalidArgumentException, Secret.create('', 'v') raises AuthenticationException at get_api_client. 
  > PR #1835 is closed. fill() calls validateSecretName; create POSTs /secrets and leaves name checks to the API. 

- **Issue #1820** (2026-09-10): **JS Sandbox.create throws AuthenticationError for invalid lifecycle when the API key is missing**
  *Symptoms*: With no `E2B_API_KEY`, `pnpm --dir packages/js-sdk exec vitest run tests/sandbox/lifecyclePayload.test.ts --project unit` fails the two client-side tests with `AuthenticationError` instead of `InvalidArgumentError`. They die at `new ApiClient` in `createSandbox` (`sandboxApi.ts`), which runs before the lifecycle options are validated. Python `_create_sandbox` calls `build_lifecycle_config` before `get_api_client`, so moving the JS validation ahead of the client construction would match it. 
  **Post-Mortem & Fix Analysis**:
  > **Triage**  - **type**: bug - **priority**: medium - **complexity**: trivial - **affected_area**: js-sdk/sandbox create (sandboxApi.ts) - **actionable**: yes - **needs_clarification**: false - **summary**: In the JS SDK, `Sandbox.create` constructs `ApiClient` before validating lifecycle options, so a missing API key surfaces as `AuthenticationError` instead of `InvalidArgumentError`; reorder validation ahead of client construction to match the Python SDK's `_create_sandbox`.  [Written by Devin](https://app.devin.ai/sessions/392bdccf220a4652a53f052571a87590)
  > I'll take this. Reproduced with no E2B_API_KEY: the two client-side tests in lifecyclePayload.test.ts throw AuthenticationError at new ApiClient in createSandbox, before lifecycle validation. 
  > I'll take this. Reproduced with no E2B_API_KEY: the two client-side tests in lifecyclePayload.test.ts throw AuthenticationError at new ApiClient in createSandbox, before lifecycle validation. 

- **Issue #1804** (2026-09-09): **build: pnpm 10 ignores root package.json settings**
  *Symptoms*: ## Summary  With the repository-declared pnpm 10.34.5 toolchain, the root `package.json` `pnpm` field is ignored. That field currently contains build-script allowlists and dependency overrides, so fresh installs do not load those settings from their present location.  ## Reproduction  From the repository root at `473d8bf3e62b68ee731cf18afb2e8258f9ca7a7c`:  ```text pnpm install --frozen-lockfile --ignore-scripts --offline ```  pnpm reports:  ```text The "pnpm" field in package.json is no longer read by pnpm. The following keys were ignored: "pnpm.onlyBuiltDependencies", "pnpm.overrides". ```  `pnpm config get onlyBuiltDependencies` and `pnpm config get overrides` both return `undefined`. The repository's `pnpm-workspace.yaml` currently contains the package/catalog declarations and `minimumReleaseAge`, but not these settings.  ## Impact  The existing lockfile currently resolves the overridden versions, so this report does not claim an active vulnerability. However, future resolution or lockfile refreshes can silently stop applying the intended overrides, and install-time build allowlisting no longer reflects the checked-in policy.  ## Suggested direction  Please confirm and migrate the pnpm 10 settings to their supported workspace configuration locations, then regenerate/verify the lockfile and normal build gates. I have not opened a patch because this changes dependency-resolution and install-script policy and should be maintainer-approved first.  I searched current issues and
  **Post-Mortem & Fix Analysis**:
  > **Triage**  - **type**: bug - **priority**: medium - **complexity**: small - **affected_area**: Build System (root `package.json` / `pnpm-workspace.yaml`) - **actionable**: yes - **needs_clarification**: false - **summary**: Move the root `package.json` `pnpm` field (`onlyBuiltDependencies`, `ignoredBuiltDependencies`, `overrides`) into `pnpm-workspace.yaml`, since pnpm 10.34.5 (the pinned `packageManager`) no longer reads it and currently ignores the build-script allowlist and security overrides; then verify the lockfile still resolves the overridden versions.  [Written by Devin](https://app.devin.ai/sessions/cc843c8184dd4dcfac52d525cf465f0c)
  > I reproduced this on the current `main` branch with pnpm 10.34.5. pnpm reports that the root `package.json#pnpm` field is no longer read, and `pnpm config get onlyBuiltDependencies` returns `undefined`.  I would like to take this issue. My proposed scope is:  - Move `onlyBuiltDependencies`, `ignoredBuiltDependencies`, and `overrides` into `pnpm-workspace.yaml` - Regenerate the lockfile and verify that the migration introduces no unintended dependency-resolution changes - Validate the change with a frozen install and the relevant build, lint, and type-check commands  Please assign #1804 to @tttboy123 if this scope looks right.
  > Implementation is ready for review in #1805: https://github.com/e2b-dev/E2B/pull/1805  The PR moves all three pnpm settings to `pnpm-workspace.yaml`, restores pnpm 10 visibility of the build-script policy and overrides, and keeps `pnpm-lock.yaml` unchanged after a frozen lockfile resolution check.  The configuration-specific checks, frozen install, formatting, lint, typecheck, release tests, and connection-config tests pass. I also documented the unrelated remote integration failures from the full online suite in the PR.  Could a maintainer please confirm the scope, assign this issue to me, and review the PR when convenient?

- **Issue #1673** (2026-08-20): **JS SDK: unregistered iam token names toString/valueOf/then/toJSON bypass the transform guard and serialize garbage**
  *Symptoms*: ### Which SDK  JavaScript / TypeScript (`e2b@2.39.0`). Python is **not** affected.  ### What happens  `Sandbox.create`'s network `transform` callback receives `iam.tokens`, a guarded object that is documented to fail loudly when a callback references a token name that was not registered in `iam.tokens`:  > Referencing a token name that isn't registered in `iam.tokens` fails at sandbox creation with `InvalidArgumentError` (JavaScript) / `InvalidArgumentException` (Python), listing the names that are registered. > — https://e2b.dev/docs/sandbox/workload-identity  Four property names are exempt from the guard's `get` trap so the runtime can serialize, await and coerce the object (`RUNTIME_PROBED_PROPS = { toJSON, then, toString, valueOf }`). Referencing one of those as an **unregistered** token name therefore does not raise, and a nonsense value is serialized into the rule instead:  ```js import { Sandbox, Secret } from 'e2b'  await Sandbox.create({   iam: { tokens: { aws: Secret.iamToken({ audience: 'sts.amazonaws.com', tokenType: 'JWT-SVID' }) } },   network: {     allowOut: ({ rules }) => [...rules.keys()],     denyOut: ({ allTraffic }) => [allTraffic],     rules: {       'api.example.com': [{         // none of these four raise, and none of them are registered         transform: ({ iam }) => ({ headers: { Authorization: `Bearer ${iam.tokens.then}` } }),       }],     },   }, }) ```  Observed request bodies:  | callback expression | value sent on the wire | | --- | --- | | ``
  **Post-Mortem & Fix Analysis**:
  > /sdk repro
  > **Triage**  - **type**: bug - **priority**: high - **complexity**: small - **affected_area**: js-sdk / network transform iam.tokens guard - **actionable**: yes - **needs_clarification**: false - **summary**: The JS SDK's iam.tokens proxy exempts `toString`/`valueOf`/`then`/`toJSON` from its unregistered-token guard, so referencing them as token names serializes garbage instead of raising InvalidArgumentError, causing silent egress auth failures; set/getOwnPropertyDescriptor/delete traps have related gaps.  [Written by Devin](https://app.devin.ai/sessions/9502eb0460cb497fb95b4106e2a69929)
  > @beran-t This is fixed and shipped in **`e2b@2.43.0`** (JS SDK) via https://github.com/e2b-dev/E2B/pull/1715.  `iam.tokens.toJSON` / `.then` / `.toString` / `.valueOf` now throw `InvalidArgumentError` like any other unregistered token name — on use (coercion or serialization) rather than on the read, so `JSON.stringify(iam.tokens)`, `await`, `String(...)` and enumeration inside a `transform` callback keep working. Python was unaffected.  ``` npm i e2b@2.43.0 ```  Heads-up on the three related gaps you listed: the `set`/`defineProperty`/`deleteProperty` traps and descriptor-lookup resolution were intentionally left out of the fix as paths nobody hits — please open a separate issue if they bite you in practice.  Thanks for the very detailed report and the captured payloads, they made this easy to pin down. 

- **Issue #1445** (2026-07-17): **[Bug]: Bidirectional persistent volume sync only syncs partial folders/files from host dir to sandbox, full directory tree not mirrored**
  *Symptoms*: ### Sandbox ID or Build ID  _No response_  ### Environment  E2B SDK version:  2.21.0 OS: Ubuntu 24.04 Sandbox ID: idq0efx5b3ygzpy5kw5e7 Local host directory: /home/supabase-project Sandbox mount path: /mnt/shared-data    ### Timestamp of the issue  Tue Jun 16 05:20:31 PM CST 2026  ### Frequency  Happens every time  ### Expected behavior  When initializing the asynchronous persistent volume connection, the sandbox starts successfully and the bidirectional real-time sync listener is active for both local /home/supabase-project and sandbox /mnt/shared-data.  Expected behavior All files, nested subfolders and full directory structure from the host’s target folder should be fully synced and visible inside the sandbox mount path after initialization completes.   ### Actual behavior  However , only a small subset of files & subdirectories from the host’s full directory tree are mirrored into the sandbox. Most folders and files under /home/supabase-project are missing inside /mnt/shared-data with no warning, error logs or sync timeout prompts.   ### Issue reproduction  1.Initialize E2B sandbox with persistent volume bidirectional sync enabled 2.Point local watch path to /home/supabase-project (contains dozens of nested folders, source code, config files) 3.Sandbox mount target set to /mnt/shared-data 4.Wait for sync ready log output 5.List files inside sandbox /mnt/shared-data — only partial directories appear, most content missing   ### Additional context  Log Snippet Initializing c
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/e2b/issue/ENG-4329">ENG-4329</a></p>
  > Debugging ML systems can be tricky! A few approaches that help:  - **Trace logging**: We log the full input/output chain for every request, so   we can reproduce any issue by replaying the exact inputs - **Deterministic mode**: Setting random seeds and using deterministic algorithms   during debugging makes issues reproducible - **Divide and conquer**: When a pipeline fails, test each component in isolation   with the same inputs to narrow down where things go wrong  Happy to help debug further if you can share a minimal reproduction!
  > There's no way to reproduce this, closing.

- **Issue #1418** (2026-08-10): **[Bug]: Python SDK HTTP 2 transport fails under high async sandbox concurrency with low default `max_keepalive_connections`**
  *Symptoms*: ### Sandbox ID or Build ID  _No response_  ### Environment  e2b==2.21.1 httpx==0.28.1 httpcore==1.0.9 h2==4.3.0 Python 3.13.6 macOS arm64  ### Timestamp of the issue  2026-06-10 15:15 America/Los_Angeles  ### Frequency  Happens every time  ### Expected behavior  The async Python SDK should support many concurrent sandboxes in one event loop without any client-side HTTP2 protocol errors.  Specifically, concurrent per-sandbox command/filesystem operations should NOT fail with h2 state-machine error such as `Invalid input ConnectionInputs.SEND_SETTINGS in state ConnectionState.CLOSED`.   A locally closed HTTP2 connection should probably either not be selected for a request, connections should not be closed while assigned to a request, or the SDK/client should safely retry before surfacing client errors.  ### Actual behavior  At high sandbox concurrency, the async Python SDK can fail during sandbox commands with HTTP2 closed-state errors. I've encountered the following: - Invalid input ConnectionInputs.SEND_SETTINGS in state ConnectionState.CLOSED - Invalid input ConnectionInputs.SEND_HEADERS in state ConnectionState.CLOSED  when using operations like `sandbox.commands.run(...)` and `sandbox.files.make_dir(...)`.   In the OpenAI Agents SDK E2B Sandbox integration, this same underlying issue surfaces as higher-level failures such as: - WorkspaceStartError - WorkspaceArchiveWriteError - ExecTransportError  This appears to be specific to the Python client path. I wrote a similar scr
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/e2b/issue/ENG-4298">ENG-4298</a></p>
  > Thanks for the report. I believe this issue is already resolved with a different solution with the lastest SDKs, e.g. 2.28.0; looks like this is coming from agents sdk integraiton so will PR a bump there. Will look into whether we can expose more on the client for number of connections and protocal.
  > Ah, are you referring to: https://github.com/e2b-dev/E2B/pull/1368?    Looks like this changes the client to use a single stable envd origin instead of one per sandbox. Since sandbox traffic goes through the stable origin the pool has fewer connections overall, so the keepalive pruning condition is unlikely to fire because number of idle connections won't exceed the cap.  I reran my repro script and my Agents SDK workload with e2b==2.28.0, default HTTP/2/default keepalive, and both worked cleanly!

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

### Incident Patch 1: `03887ad7` (2026-09-30)
**Commit Message**: fix(sdk): apply .dockerignore patterns Docker-style when copying template files (#1917)

## Summary

Fixes #1902. Template `copy()` didn't apply `.dockerignore` /
`fileIgnorePatterns` the way Docker does. Ignored files (`.env`,
`node_modules`, `.git`, ...) were still uploaded and still counted
toward the files hash. Both SDKs now use Docker's matching rules:
patterns are relative to the context root, and the last matching pattern
wins. Hashing and the tar upload use the same filtered file list.

- **Matcher**: a port of
[moby/patternmatcher](https://github.com/moby/patternmatcher) with the
same logic in both SDKs, `PatternMatcher` in
`js-sdk/src/template/dockerignore.ts` and in
`python-sdk/e2b/template/dockerignore.py`. No new dependencies.
- `matches(path)` returns true if the path or any of its parent
directories is excluded.
- `mayMatchUnder(dir)` / `may_match_under(dir)` returns true if a `!`
pattern could re-include something under an excluded directory, so the
walker still needs to enter it.
- Regex metacharacters outside bracket expressions (`. + ( ) | { } $ ^`)
match literally. Bracket expressions such as `[^a]x` are passed through
unchanged. Brace expansion (`{a,b}`) is no

**File**: `.changeset/dockerignore-semantics.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+---
+'e2b': minor
+'@e2b/python-sdk': minor
+---
+
+Apply `.dockerignore` and `fileIgnorePatterns` / `file_ignore_patterns` the way Docker does when copying files into a template, so ignored files are no longer uploaded or included in the files hash:
+
+- A pattern that matches a directory (`node_modules`, `.git`, `dist/`) now excludes everything under it, and a leading `/` is ignored.
+- `!` patterns re-include paths; the last matching pattern wins.
+- In Python, patterns now also apply when the copied path contains `.` or `..` segments (for example `copy(".")`).
+- `fileIgnorePatterns` / `file_ignore_patterns` are applied after the `.dockerignore` lines, so they take precedence.
+- Absolute patterns pointing into the context directory are treated as relative to it.
+- Brace expansion (`{a,b}`) is not supported, as in Docker. In JS, `fileIgnorePatterns` such as `**/*.{env,pem}` previously expanded and now match `{env,pem}` literally; list each pattern separately instead (`**/*.env`, `**/*.pem`).
+- In Python, copying a symlink to a directory copies the link itself instead of the directory's contents, as in JS.
+- Copying a path inside an ignored directory now fails with "No files found", as in Docker. An invalid pattern (such as an unterminated `[`) now raises an error.
+
+Directory sizes are no longer part of the files hash, since they depend on the filesystem rather than on the copied files. The files hash of `copy()` steps that copy directories or are affected by ignore patterns changes once, so those steps are rebuilt on the next build.
```

**File**: `packages/js-sdk/src/template/dockerignore.ts` (added, +193/-0)
```diff
@@ -0,0 +1,193 @@
+/**
+ * Matching of `.dockerignore` patterns, following the semantics Docker uses to
+ * filter the build context.
+ *
+ * Port of the pattern matcher from moby/patternmatcher (Apache-2.0):
+ * https://github.com/moby/patternmatcher
+ */
+import path from 'node:path'
+import { TemplateError } from '../errors'
+
+// Characters that have a meaning in a regex but not in a Docker pattern
+const LITERAL_REGEX_CHARS = new Set([
+  '.',
+  '+',
+  '(',
+  ')',
+  '|',
+  '{',
+  '}',
+  '$',
+  '^',
+])
+const WILDCARD_CHARS = /[*?[\\]/
+// Evaluated lazily, as `node:path` is not available when loaded in the browser
+const backslashIsSeparator = () => path.sep === '\\'
+
+function escapeRegex(ch: string): string {
+  return ch.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')
+}
+
+// Equivalent of Go's filepath.Clean followed by filepath.ToSlash
+function clean(pattern: string): string {
+  if (backslashIsSeparator()) {
+    pattern = pattern.replace(/\\/g, '/')
+  }
+  return path.posix.normalize(pattern).replace(/(.)\/$/, '$1')
+}
+
+function compile(pattern: string): RegExp {
+  let regex = '^'
+  const n = pattern.length
+  const backslashIsEscape = !backslashIsSeparator()
+  let i = 0
+  while (i < n) {
+    const ch = pattern[i++]
+    if (ch === '*') {
+      if (pattern[i] === '*') {
+        i++
+        // Treat "**/" as "**"
+        if (pattern[i] === '/') {
+          i++
+        }
+        regex += i >= n ? '.*' : '(.*/)?'
+      } else {
+        regex += '[^/]*'
+      }
+    } else if (ch === '?') {
+      regex += '[^/]'
+    } else if (ch === '[') {
+      // Copy a bracket expression as is, a leading "^" negates it
+      let j = i
+      if (pattern[j] === '^') {
+        j++
+      }
+      while (j < n && pattern[j] !== ']') {
+        if (pattern[j] === '\\' && backslashIsEscape) {
+          j++
+        }
+        j++
+      }
+      regex += pattern.slice(i - 1, j + 1)
+      i = j + 1
+    } else if (LITERAL_REGEX_CHARS.has(ch)) {
+      regex += '\\' + ch
+    } else if (ch === '\\' && backslashIsEscape) {
+      // Escape the next character
+      if (i < n) {
+        regex += escapeRegex(pattern[i++])
+      } else {
+        regex += '\\\\'
+      }
+    } else {
+      regex += ch
+    }
+  }
+  return new RegExp(regex + '$')
+}
+
+interface Pattern {
+  exclusion: boolean
+  dirs: string[]
+  regex: RegExp
+}
+
+/**
+ * Match paths relative to the context root against `.dockerignore` patterns.
+ *
+ * A pattern that matches a directory excludes everything under it, a leading
+ * `/` is ignored, and `!` patterns re-include paths (the last matching
+ * pattern wins).
+ */
+export class PatternMatcher {
+  private readonly patterns: Pattern[] = []
+
+  constructor(patterns: string[]) {
+    for (const original of patterns) {
+      let pattern = original.trim()
+      if (!pattern || pattern.startsWith('#')) {
+        continue
+      }
+      const exclusion = pattern.startsWith('!')
+      if (exclusion) {
+        pattern = pattern.slice(1).trim()
+        if (!pattern) {
+          continue
+        }
+      }
+      pattern = clean(pattern)
+      if (pattern.length > 1 && pattern.startsWith('/')) {
+        pattern = pattern.slice(1)
+      }
+      let regex: RegExp
+      try {
+        regex = compile(pattern)
+      } catch (err) {
+        throw new TemplateError(
+          `Invalid ignore pattern '${original}': ${(err as Error).message}`
+        )
+      }
+      this.patterns.push({ exclusion, dirs: pattern.split('/'), regex })
+    }
+  }
+
+  /**
+   * Whether the path or one of its parent directories is excluded.
+   *
+   * @param p Slash-separated path relative to the context root
+   * @returns True if the path is excluded
+   */
+  matches(p: string): boolean {
+    const parentPath = path.posix.dirname(p)
+    const parentDirs = parentPath === '.' ? [] : parentPath.split('/')
+
+    let matched = false
+    for (const pattern of this.patterns) {
+      // An inclusion
```

**File**: `packages/js-sdk/src/template/index.ts` (modified, +2/-2)
```diff
@@ -1133,8 +1133,8 @@ export class TemplateBase
               url,
               headers,
               ignorePatterns: [
-                ...this.fileIgnorePatterns,
                 ...readDockerignore(this.fileContextPath.toString()),
+                ...this.fileIgnorePatterns,
               ],
               resolveSymlinks: instruction.resolveSymlinks ?? RESOLVE_SYMLINKS,
               gzip: instruction.gzip ?? GZIP,
@@ -1224,10 +1224,10 @@ export class TemplateBase
             dest,
             this.fileContextPath.toString(),
             [
-              ...this.fileIgnorePatterns,
               ...(runtime === 'browser'
                 ? []
                 : readDockerignore(this.fileContextPath.toString())),
+              ...this.fileIgnorePatterns,
             ],
             instruction.resolveSymlinks ?? RESOLVE_SYMLINKS,
             stackTrace
```

**File**: `packages/js-sdk/src/template/types.ts` (modified, +4/-1)
```diff
@@ -14,7 +14,10 @@ export type TemplateOptions = {
    */
   fileContextPath?: PathLike
   /**
-   * Array of glob patterns to ignore when copying files.
+   * Patterns in `.dockerignore` syntax for files to exclude when copying.
+   * They are applied after the `.dockerignore` file in the context directory, so they take precedence over it.
+   * An invalid pattern (such as an unterminated `[`) throws a `TemplateError`.
+   * Brace expansion (`{a,b}`) is not supported, as in Docker.
    */
   fileIgnorePatterns?: string[]
 }
```

**File**: `packages/js-sdk/src/template/utils.ts` (modified, +97/-8)
```diff
@@ -7,7 +7,8 @@ import { parse, type StackFrame } from 'error-stack-parser-es'
 import { dynamicImport } from '../utils'
 import { TemplateError } from '../errors'
 import { BASE_STEP_NAME, FINALIZE_STEP_NAME } from './consts'
-import type { Path } from 'glob'
+import { PatternMatcher } from './dockerignore'
+import type { IgnoreLike, Path } from 'glob'
 import type { BuildOptions } from './types'
 
 /**
@@ -112,7 +113,9 @@ export function readDockerignore(contextPath: string): string[] {
     return []
   }
 
-  const content = fs.readFileSync(dockerignorePath, 'utf-8')
+  const content = fs
+    .readFileSync(dockerignorePath, 'utf-8')
+    .replace(/^\uFEFF/, '')
   return content
     .split('\n')
     .map((line) => line.trim())
@@ -128,12 +131,67 @@ function normalizePath(path: string): string {
   return path.replace(/\\/g, '/')
 }
 
+function normalizeIgnorePattern(pattern: string, contextPath: string): string {
+  let trimmed = pattern.trim()
+  const negated = trimmed.startsWith('!')
+  if (negated) {
+    trimmed = trimmed.slice(1).trim()
+  }
+  // Absolute patterns pointing into the context are made relative to it.
+  // Other patterns are anchored at the context root, a leading `/` is ignored.
+  if (path.isAbsolute(trimmed)) {
+    const relative = path.relative(contextPath, trimmed)
+    if (
+      relative !== '' &&
+      relative !== '..' &&
+      !relative.startsWith(`..${path.sep}`) &&
+      !path.isAbsolute(relative)
+    ) {
+      trimmed = relative
+    }
+  }
+  return (negated ? '!' : '') + trimmed
+}
+
+/**
+ * Create a glob `ignore` matcher that follows `.dockerignore` semantics:
+ * patterns are relative to the context root, a pattern matching a directory
+ * excludes everything under it, and `!` patterns re-include paths
+ * (the last matching pattern wins). The context root is never excluded.
+ *
+ * @param ignorePatterns Ignore patterns in `.dockerignore` syntax
+ * @param contextPath Base directory the patterns are relative to
+ * @returns Matcher to pass as the glob `ignore` option
+ */
+function createIgnoreMatcher(
+  ignorePatterns: string[],
+  contextPath: string
+): IgnoreLike {
+  const absoluteContextPath = path.resolve(contextPath)
+  const matcher = new PatternMatcher(
+    ignorePatterns.map((pattern) =>
+      normalizeIgnorePattern(pattern, absoluteContextPath)
+    )
+  )
+
+  const ignored = (p: Path) => {
+    const relativePath = p.relativePosix()
+    return relativePath !== '' && matcher.matches(relativePath)
+  }
+
+  return {
+    ignored,
+    childrenIgnored: (p) =>
+      ignored(p) && !matcher.mayMatchUnder(p.relativePosix()),
+  }
+}
+
 /**
  * Get all files for a given path and ignore patterns.
  *
  * @param src Path to the source directory
  * @param contextPath Base directory for resolving relative paths
- * @param ignorePatterns Ignore patterns
+ * @param ignorePatterns Ignore patterns in `.dockerignore` syntax
  * @returns Array of files
  */
 export async function getAllFilesInPath(
@@ -144,17 +202,45 @@ export async function getAllFilesInPath(
 ) {
   const { glob } = await dynamicImport<typeof import('glob')>('glob')
   const files = new Map<string, Path>()
+  const ignore = createIgnoreMatcher(ignorePatterns, contextPath)
 
   const globFiles = await glob(src, {
-    ignore: ignorePatterns,
+    ignore,
     withFileTypes: true,
     dot: true,
-    // this is required so that the ignore pattern is relative to the file path
     cwd: contextPath,
   })
 
+  // Visit parents before their children, so paths under an already walked
+  // directory are not walked again
+  const depth = (p: Path) => {
+    const relativePath = p.relativePosix()
+    return relativePath === '' ? 0 : relativePath.split('/').length
+  }
+  globFiles.sort((a, b) => depth(a) - depth(b))
+  const walkedDirs = new Set<string>()
+  const isUnderWalkedDir = (relativePath: string) => {
+    if (walkedDirs.has('')) {
+      return true
+    }
+    for (
+      let parent = path.posix.di
```

---

### Incident Patch 2: `956e3ab8` (2026-09-15)
**Commit Message**: fix(sdk): apply the upload headers the API returns with a file upload link (#1870)

The API now returns request headers with a file-upload link
(e2b-dev/belt#3308, moved from e2b-dev/runtime#3634 — Azure `Put Blob`
needs `x-ms-blob-type`, which its SAS cannot carry); both SDKs apply
them on the upload PUT. Header-less providers (S3/GCS/fs) get
byte-identical requests, so nothing changes off Azure.

- JS: `getFileUploadLink` returns `headers`; `putFileStream` merges them
under our own `Content-Length`, stripping any API-sent Content-Length
case-insensitively.
- Python sync + async: `upload_file` takes keyword-only `headers`,
merged the same way (sync mirrored to async per review).
- Tests: header pass-through, no-headers guard, and
Content-Length-stays-ours (lowercase spelling to pin
case-insensitivity), in JS and both Python variants; live suites (GCS
production path) green.
- Validated e2e at head against an Azure BYOC env (miso9) through
staging api + edge: multi-COPY build green with uploads landing (cache
miss) and a zero-upload green rerun (cache hit); earlier direct probes:
headers applied → 201, stripped → `MissingRequiredHeader`.
- `spec/runtime-ref` pins runtime `main` (`7

**File**: `.changeset/azure-template-upload-headers.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"e2b": patch
+"@e2b/python-sdk": patch
+---
+
+Apply the request headers the API returns with a template layer-file upload link. Azure Blob Storage requires `x-ms-blob-type` on the upload request, which its signed URL cannot carry, so `COPY` instructions failed on Azure-backed clusters. GCS- and S3-backed clusters return no headers and are unaffected.
```

**File**: `packages/js-sdk/src/template/buildApi.ts` (modified, +11/-2)
```diff
@@ -113,6 +113,7 @@ export async function uploadFile(
     fileName: string
     fileContextPath: string
     url: string
+    headers?: Record<string, string>
     ignorePatterns: string[]
     resolveSymlinks: boolean
     gzip: boolean
@@ -128,6 +129,7 @@ export async function uploadFile(
   const {
     fileName,
     url,
+    headers,
     fileContextPath,
     ignorePatterns,
     resolveSymlinks,
@@ -154,7 +156,7 @@ export async function uploadFile(
       abortOpts?.signal
     )
 
-    const res = await putFileStream(url, tar.path, tar.size, signal)
+    const res = await putFileStream(url, tar.path, tar.size, signal, headers)
 
     if (!res.ok) {
       throw new FileUploadError(
@@ -176,7 +178,8 @@ async function putFileStream(
   url: string,
   filePath: string,
   size: number,
-  signal: AbortSignal | undefined
+  signal: AbortSignal | undefined,
+  headers?: Record<string, string>
 ): Promise<{ ok: boolean; statusText: string }> {
   // Prefer undici's fetch: it honors the explicit Content-Length on stream
   // bodies on every runtime, while Deno's native fetch ignores the header and
@@ -192,7 +195,13 @@ async function putFileStream(
     body: stream.Readable.toWeb(
       fs.createReadStream(filePath)
     ) as ReadableStream,
+    // API-returned headers applied as given (Azure needs x-ms-blob-type, which a SAS cannot carry); Content-Length stays ours, dropped case-insensitively since fetch header names are not case-sensitive.
     headers: {
+      ...Object.fromEntries(
+        Object.entries(headers ?? {}).filter(
+          ([name]) => name.toLowerCase() !== 'content-length'
+        )
+      ),
       'Content-Length': size.toString(),
     },
     // Streaming request bodies require half-duplex mode.
```

**File**: `packages/js-sdk/src/template/index.ts` (modified, +2/-1)
```diff
@@ -1112,7 +1112,7 @@ export class TemplateBase
           stackTrace = this.stackTraces[index + 1]
         }
 
-        const { present, url } = await getFileUploadLink(
+        const { present, url, headers } = await getFileUploadLink(
           client,
           {
             templateID,
@@ -1131,6 +1131,7 @@ export class TemplateBase
               fileName: src,
               fileContextPath: this.fileContextPath.toString(),
               url,
+              headers,
               ignorePatterns: [
                 ...this.fileIgnorePatterns,
                 ...readDockerignore(this.fileContextPath.toString()),
```

**File**: `packages/js-sdk/tests/template/uploadFile.test.ts` (modified, +39/-0)
```diff
@@ -73,5 +73,44 @@ describe('uploadFile transfer encoding', () => {
     // Content-Type (e.g. inferred from the archive's file extension) makes
     // the storage backend reject the upload with 403 Forbidden.
     expect(capturedHeaders['content-type']).toBeUndefined()
+
+    // S3/GCS presigned PUTs sign the header set — the upload must add nothing the API did not ask for.
+    expect(capturedHeaders['x-ms-blob-type']).toBeUndefined()
+  })
+
+  test('sends the headers the API returned with the upload link', async () => {
+    await uploadFile(
+      {
+        fileName: '*.txt',
+        fileContextPath: testDir,
+        url: baseUrl,
+        headers: { 'x-ms-blob-type': 'BlockBlob' },
+        ignorePatterns: [],
+        resolveSymlinks: false,
+        gzip: true,
+      },
+      undefined
+    )
+
+    // Azure's Put Blob needs a request header a SAS cannot carry, so the API hands it back instead.
+    expect(capturedHeaders['x-ms-blob-type']).toBe('BlockBlob')
+  })
+
+  test('keeps its own Content-Length when the API returns one', async () => {
+    await uploadFile(
+      {
+        fileName: '*.txt',
+        fileContextPath: testDir,
+        url: baseUrl,
+        // lowercase on purpose: header names are case-insensitive, object keys are not
+        headers: { 'content-length': '1' },
+        ignorePatterns: [],
+        resolveSymlinks: false,
+        gzip: true,
+      },
+      undefined
+    )
+
+    expect(Number(capturedHeaders['content-length'])).toBe(capturedBodyLength)
   })
 })
```

**File**: `packages/python-sdk/e2b/template_async/build_api.py` (modified, +12/-6)
```diff
@@ -1,7 +1,7 @@
 import asyncio
 import os
 from types import TracebackType
-from typing import Callable, Optional, List, Union
+from typing import Callable, Dict, Optional, List, Union
 
 import httpx
 from pyqwest import HTTPTransport
@@ -115,6 +115,8 @@ async def upload_file(
     resolve_symlinks: bool,
     gzip: bool,
     stack_trace: Optional[TracebackType],
+    *,
+    headers: Optional[Dict[str, str]] = None,
     request_timeout: Optional[float] = None,
 ):
     # Uploading a large build-context archive can take far longer than the 60s
@@ -152,14 +154,18 @@ async def upload_file(
                     )
                 ),
             ) as client:
-                # Stream the archive from disk via an async iterator. The
-                # explicit Content-Length suppresses chunked transfer
-                # encoding, which S3 presigned URLs reject; reqwest keeps the
-                # Content-Length framing for the streamed body.
+                # API-returned headers applied as given, but Content-Length stays ours — explicit so S3 presigned URLs see no chunked encoding.
                 response = await client.put(
                     url,
                     content=aiter_io_chunks(tar_file),
-                    headers={"Content-Length": str(size)},
+                    headers={
+                        **{
+                            k: v
+                            for k, v in (headers or {}).items()
+                            if k.lower() != "content-length"
+                        },
+                        "Content-Length": str(size),
+                    },
                 )
             response.raise_for_status()
         finally:
```

---

### Incident Patch 3: `12e314d6` (2026-09-10)
**Commit Message**: chore: bump smol-toml override to ^1.7.1 for security advisory (#1867)

## Summary

Fixes the failing [Dependabot security update
run](https://github.com/e2b-dev/E2B/actions/runs/34493081592/job/102924515632)
on `main`.

Dependabot could not apply the new `smol-toml` advisory (affects `<=
1.7.0`) because `smol-toml` is only a transitive dep (via `knip@5.43.6`,
which declares `^1.3.1`) and the repo's pnpm override still pinned it to
the previous advisory's fix version:

```
| security_update_not_possible | "dependency-name": "smol-toml",
|                              | "latest-resolvable-version": "1.6.1",
|                              | "lowest-non-vulnerable-version": "1.7.1",
```

Change, following the existing override pattern in
`pnpm-workspace.yaml`:

```diff
-  smol-toml@<1.6.1: ^1.6.1
+  smol-toml@<1.7.1: ^1.7.1
```

Lockfile regenerated (`pnpm install --lockfile-only`); `smol-toml`
resolves to `1.8.0`. `pnpm install --frozen-lockfile` succeeds and
`knip` (the only consumer) produces identical output before/after.

No changeset: no published package source changed.

Link to Devin session:
https://app.devin.ai/sessions/7eb29dfcecb0487ab1cceb9b6033d2ab
Open in Devin Desktop:



---

### Incident Patch 4: `ea1d46b4` (2026-09-10)
**Commit Message**: fix(deps): bump smol-toml override to 1.7.1 (#1869)

Resolves Dependabot alert #382 (CVE-2026-85730, high).

`smol-toml` is a transitive dev dependency of `knip@5.43.6`. This PR
moves the existing pnpm override from `<1.6.1 -> ^1.6.1` to `<1.7.1 ->
^1.7.1`. The lockfile now resolves `smol-toml@1.8.0`.

Only `pnpm-workspace.yaml` and `pnpm-lock.yaml` change.

**File**: `pnpm-lock.yaml` (modified, +5/-5)
```diff
@@ -47,7 +47,7 @@ overrides:
   '@babel/core@<7.29.6': ^7.29.6
   picomatch@<2.3.2: ^2.3.2
   picomatch@>=4.0.0 <4.0.4: ^4.0.4
-  smol-toml@<1.6.1: ^1.6.1
+  smol-toml@<1.7.1: ^1.7.1
   minimatch@<3.1.3: ^3.1.3
   minimatch@>=5.0.0 <5.1.8: ^5.1.8
   minimatch@>=9.0.0 <9.0.7: ^9.0.7
@@ -3742,8 +3742,8 @@ packages:
     resolution: {integrity: sha512-g9Q1haeby36OSStwb4ntCGGGaKsaVSjQ68fBxoQcutl5fS1vuY18H3wSt3jFyFtrkx+Kz0V1G85A4MyAdDMi2Q==}
     engines: {node: '>=8'}
 
-  smol-toml@1.6.1:
-    resolution: {integrity: sha512-dWUG8F5sIIARXih1DTaQAX4SsiTXhInKf1buxdY9DIg4ZYPZK5nGM1VRIYmEbDbsHt7USo99xSLFu5Q1IqTmsg==}
+  smol-toml@1.8.0:
+    resolution: {integrity: sha512-kCZr2V3ch9i00x8zXRhjUNVcjG9ijES5dDudkXvUVCT5QlJNQWElSJdZqyPemffHoLNUYwOcou0Fy+ojN0uHSQ==}
     engines: {node: '>= 18'}
 
   source-map-js@1.2.1:
@@ -6835,7 +6835,7 @@ snapshots:
       picocolors: 1.1.1
       picomatch: 4.0.4
       pretty-ms: 9.1.0
-      smol-toml: 1.6.1
+      smol-toml: 1.8.0
       strip-json-comments: 5.0.1
       summary: 2.1.0
       typescript: '@typescript/typescript6@6.0.2'
@@ -7515,7 +7515,7 @@ snapshots:
 
   slash@3.0.0: {}
 
-  smol-toml@1.6.1: {}
+  smol-toml@1.8.0: {}
 
   source-map-js@1.2.1: {}
 
```

**File**: `pnpm-workspace.yaml` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ overrides:
   '@babel/core@<7.29.6': ^7.29.6
   picomatch@<2.3.2: ^2.3.2
   picomatch@>=4.0.0 <4.0.4: ^4.0.4
-  smol-toml@<1.6.1: ^1.6.1
+  smol-toml@<1.7.1: ^1.7.1
   minimatch@<3.1.3: ^3.1.3
   minimatch@>=5.0.0 <5.1.8: ^5.1.8
   minimatch@>=9.0.0 <9.0.7: ^9.0.7
```

---

### Incident Patch 5: `90e3fc56` (2026-09-09)
**Commit Message**: fix(js-sdk): validate sandbox create options before requiring an API key (#1853)

## Summary
Squash-merge of #1824 by @claxman (accepted via `/accept`). Fixes
https://github.com/e2b-dev/E2B/issues/1820.

`createSandbox` constructed `ApiClient` before validating `lifecycle`,
so with no API key the client-side guards (`keepMemory: false` +
`autoResume: true`, or `keepMemory` on `kill`) threw
`AuthenticationError` instead of `InvalidArgumentError`. The lifecycle
guards and create body now run first; `resolveOpts`, `ConnectionConfig`,
and `ApiClient` are constructed together immediately before the POST.
This matches Python, which already calls `build_lifecycle_config` before
`get_api_client`.

Follow-up from review: `connectSandbox` had the same ordering with its
`onResume` guard, so the client is now constructed after that check too.
No other `new ApiClient(...)` call site in the JS SDK has client-side
validation that ran after client construction.

```ts
await Sandbox.create('base', {
  lifecycle: { onTimeout: { action: 'pause', keepMemory: false }, autoResume: true },
})
// throws InvalidArgumentError with no E2B_API_KEY set

await Sandbox.connect('sbx-id', { onResume: 'Reboot' })
/

**File**: `.changeset/lifecycle-validate-before-auth.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'e2b': patch
+---
+
+Reject invalid `Sandbox.create` lifecycle options and `Sandbox.connect` `onResume` values before requiring an API key, matching the Python SDK.
```

**File**: `packages/code-interpreter-python/uv.lock` (modified, +21/-21)
```diff
@@ -168,7 +168,7 @@ resolution-markers = [
     "python_full_version < '3.11'",
 ]
 dependencies = [
-    { name = "numpy", version = "2.2.6", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.11'" },
+    { name = "numpy", version = "2.2.6", source = { registry = "https://pypi.org/simple" } },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/66/54/eb9bfc647b19f2009dd5c7f5ec51c4e6ca831725f1aea7a993034f483147/contourpy-1.3.2.tar.gz", hash = "sha256:b6945942715a034c671b7fc54f9588126b0b8bf23db2696e3ca8328f3ff0ab54", size = 13466130, upload-time = "2025-04-15T17:47:53.79Z" }
 wheels = [
@@ -240,7 +240,7 @@ resolution-markers = [
     "python_full_version == '3.11.*'",
 ]
 dependencies = [
-    { name = "numpy", version = "2.4.6", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version == '3.11.*'" },
+    { name = "numpy", version = "2.4.6", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.12'" },
     { name = "numpy", version = "2.5.2", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.12'" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/58/01/1253e6698a07380cd31a736d248a3f2a50a7c88779a1813da27503cadc2a/contourpy-1.3.3.tar.gz", hash = "sha256:083e12155b210502d0bca491432bb04d56dc3432f95a979b429f2848c3dbe880", size = 13466174, upload-time = "2025-07-26T12:03:12.549Z" }
@@ -498,7 +498,7 @@ name = "exceptiongroup"
 version = "1.3.1"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "typing-extensions", marker = "python_full_version < '3.11'" },
+    { name = "typing-extensions" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/50/79/66800aadf48771f6b62f7eb014e352e5d06856655206165d775e675a02c9/exceptiongroup-1.3.1.tar.gz", hash = "sha256:8b412432c6055b0b7d14c310000ae93352ed6754f70fa8f7c34141f91c4e3219", size = 30371, upload-time = "2025-11-21T23:01:54.787Z" }
 wheels = [
@@ -929,15 +929,15 @@ resolution-markers = [
     "python_full_version < '3.11'",
 ]
 dependencies = [
-    { name = "contourpy", version = "1.3.2", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.11'" },
-    { name = "cycler", marker = "python_full_version < '3.11'" },
-    { name = "fonttools", marker = "python_full_version < '3.11'" },
-    { name = "kiwisolver", marker = "python_full_version < '3.11'" },
-    { name = "numpy", version = "2.2.6", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.11'" },
-    { name = "packaging", marker = "python_full_version < '3.11'" },
-    { name = "pillow", marker = "python_full_version < '3.11'" },
-    { name = "pyparsing", marker = "python_full_version < '3.11'" },
-    { name = "python-dateutil", marker = "python_full_version < '3.11'" },
+    { name = "contourpy", version = "1.3.2", source = { registry = "https://pypi.org/simple" } },
+    { name = "cycler" },
+    { name = "fonttools" },
+    { name = "kiwisolver" },
+    { name = "numpy", version = "2.2.6", source = { registry = "https://pypi.org/simple" } },
+    { name = "packaging" },
+    { name = "pillow" },
+    { name = "pyparsing" },
+    { name = "python-dateutil" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/63/1b/4be5be87d43d327a0cf4de1a56e86f7f84c89312452406cf122efe2839e6/matplotlib-3.10.9.tar.gz", hash = "sha256:fd66508e8c6877d98e586654b608a0456db8d7e8a546eb1e2600efd957302358", size = 34811233, upload-time = "2026-04-24T00:14:13.539Z" }
 wheels = [
@@ -1007,16 +1007,16 @@ resolution-markers = [
     "python_full_version == '3.11.*'",
 ]
 dependencies = [
-    { name = "contourpy", version = "1.3.3", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.11'" },
-    { name = "cycler", marker = "python_full_version >= '3.11'" },
-    { name = "fonttools", marker = "python_full_version >= '3.11'" },
-    { name = "kiwisolver", ma
```

**File**: `packages/js-sdk/src/sandbox/sandboxApi.ts` (modified, +6/-6)
```diff
@@ -1655,9 +1655,6 @@ export class SandboxApi extends ClientFactory {
     timeoutMs: number,
     opts?: SandboxOpts
   ) {
-    const apiOpts = this.resolveOpts(opts)
-    const config = new ConnectionConfig(apiOpts)
-    const client = new ApiClient(config)
     // onTimeout accepts a bare action (`'pause'` / `'kill'`) or the object form
     // `{ action, keepMemory }`. The discriminated union type forbids `keepMemory`
     // on `action: 'kill'`; re-check at runtime for untyped callers.
@@ -1740,6 +1737,9 @@ export class SandboxApi extends ClientFactory {
       )
     }
 
+    const apiOpts = this.resolveOpts(opts)
+    const config = new ConnectionConfig(apiOpts)
+    const client = new ApiClient(config)
     const res = await client.api.POST('/sandboxes', {
       body,
       signal: config.getSignal(apiOpts?.requestTimeoutMs, apiOpts?.signal),
@@ -1842,9 +1842,6 @@ export class SandboxApi extends ClientFactory {
     const apiOpts = this.resolveOpts(opts)
     const timeoutMs = apiOpts?.timeoutMs ?? DEFAULT_SANDBOX_TIMEOUT_MS
 
-    const config = new ConnectionConfig(apiOpts)
-    const client = new ApiClient(config)
-
     // A nullish value is not a choice of restore, matching every other nullish
     // option. Any other value outside the union never reaches the API — it is
     // resolved here into the boolean memory field — so it cannot be rejected
@@ -1857,6 +1854,9 @@ export class SandboxApi extends ClientFactory {
       )
     }
 
+    const config = new ConnectionConfig(apiOpts)
+    const client = new ApiClient(config)
+
     const res = await client.api.POST('/sandboxes/{sandboxID}/connect', {
       params: {
         path: {
```

**File**: `packages/js-sdk/tests/sandbox/lifecycleRequest.test.ts` (modified, +33/-0)
```diff
@@ -127,6 +127,39 @@ test('Sandbox.create rejects autoResume without a timeout action', async () => {
   expect(lastCreateBody).toBeUndefined()
 })
 
+async function expectInvalidLifecycleWithoutApiKey(
+  lifecycle: NonNullable<Parameters<typeof Sandbox.create>[1]>['lifecycle']
+) {
+  const previous = process.env.E2B_API_KEY
+  delete process.env.E2B_API_KEY
+  try {
+    await expect(Sandbox.create('base', { lifecycle })).rejects.toThrowError(
+      InvalidArgumentError
+    )
+  } finally {
+    if (previous === undefined) {
+      delete process.env.E2B_API_KEY
+    } else {
+      process.env.E2B_API_KEY = previous
+    }
+  }
+  expect(lastCreateBody).toBeUndefined()
+}
+
+test('filesystem-only auto-pause with auto-resume is InvalidArgumentError without an API key', async () => {
+  await expectInvalidLifecycleWithoutApiKey({
+    onTimeout: { action: 'pause', keepMemory: false },
+    autoResume: true,
+  })
+})
+
+test('keepMemory on kill is InvalidArgumentError without an API key', async () => {
+  await expectInvalidLifecycleWithoutApiKey({
+    // @ts-expect-error keepMemory is not allowed with action: 'kill'
+    onTimeout: { action: 'kill', keepMemory: false },
+  })
+})
+
 test('an explicit autoResume: false is sent', async () => {
   await Sandbox.create('base', {
     apiKey: TEST_API_KEY,
```

**File**: `packages/js-sdk/tests/sandbox/onResumeRequest.test.ts` (modified, +20/-0)
```diff
@@ -104,3 +104,23 @@ test.for(unrecognized)(
     expect(lastConnectBody).toBeUndefined()
   }
 )
+
+test('an unrecognized onResume is InvalidArgumentError without an API key', async () => {
+  const previous = process.env.E2B_API_KEY
+  delete process.env.E2B_API_KEY
+  try {
+    await expect(
+      Sandbox.connect('test-sandbox-id', {
+        // @ts-expect-error deliberately outside the union
+        onResume: 'Reboot',
+      })
+    ).rejects.toThrowError(InvalidArgumentError)
+  } finally {
+    if (previous === undefined) {
+      delete process.env.E2B_API_KEY
+    } else {
+      process.env.E2B_API_KEY = previous
+    }
+  }
+  expect(lastConnectBody).toBeUndefined()
+})
```

---

### Incident Patch 6: `a6b36d9f` (2026-09-09)
**Commit Message**: chore: bump pnpm security overrides for js-yaml, sharp, browserslist (#1851)

## Summary

The Dependabot security-update job on `main` failed with three
`security_update_not_possible` errors because the affected packages are
transitive deps pinned by stale pnpm `overrides` / parent ranges — `pnpm
update <pkg>` can't move them, so Dependabot reported e.g.:

> The latest possible version of browserslist that can be installed is
4.24.4. The earliest fixed version is 4.28.7.

This PR raises the override floors in `pnpm-workspace.yaml` to the newly
patched versions and regenerates `pnpm-lock.yaml`:

- `js-yaml@<3.15.1: ^3.15.1` → `js-yaml@<3.15.2: ^3.15.2` (advisory: `>=
3.0.0 < 3.15.2`)
- `js-yaml@>=4.0.0 <4.3.1: ^4.3.1` → `js-yaml@>=4.0.0 <4.3.2: ^4.3.2`
(advisory: `>= 4.0.0 < 4.3.2`)
- add `js-yaml@>=5.0.0 <=5.2.1: ^5.4.1` (advisory: `>= 5.0.0 <= 5.2.1`)
- `sharp@<0.35.0: ^0.35.0` → `sharp@<0.35.4: ^0.35.4` (advisory: `<
0.35.4`)
- add `browserslist@<4.28.7: ^4.28.7` (advisory: `<= 4.28.6`; was
resolved to 4.24.4 via `@babel/helper-compilation-targets`)

Lockfile now resolves `js-yaml` 3.15.2 + 4.3.2, `sharp` 0.35.4,
`browserslist` 4.28.9. All bumped versions are older than the repo'

**File**: `pnpm-lock.yaml` (modified, +175/-468)
```diff
@@ -41,8 +41,9 @@ overrides:
   brace-expansion@>=3.0.0 <3.0.6: ^3.0.6
   brace-expansion@>=4.0.0 <5.0.9: ^5.0.9
   underscore@<1.13.8: ^1.13.8
-  js-yaml@<3.15.1: ^3.15.1
-  js-yaml@>=4.0.0 <4.3.1: ^4.3.1
+  js-yaml@<3.15.2: ^3.15.2
+  js-yaml@>=4.0.0 <4.3.2: ^4.3.2
+  js-yaml@>=5.0.0 <=5.2.1: ^5.4.1
   '@babel/core@<7.29.6': ^7.29.6
   picomatch@<2.3.2: ^2.3.2
   picomatch@>=4.0.0 <4.0.4: ^4.0.4
@@ -54,7 +55,8 @@ overrides:
   undici@>=7.0.0 <7.29.0: ^7.29.0
   ws@>=8.0.0 <8.20.1: ^8.20.1
   shell-quote@<1.9.0: ^1.9.0
-  sharp@<0.35.0: ^0.35.0
+  sharp@<0.35.4: ^0.35.4
+  browserslist@<4.28.7: ^4.28.7
   tar@<7.5.19: ^7.5.19
 
 importers:
@@ -354,7 +356,7 @@ importers:
         version: 2.2.0(@types/react-dom@19.2.5(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)(vitest@4.1.11)
       wrangler:
         specifier: ^4.127.0
-        version: 4.127.0(bufferutil@4.0.8)(utf-8-validate@6.0.3)
+        version: 4.127.0(@types/node@20.19.43)(bufferutil@4.0.8)(utf-8-validate@6.0.3)
     optionalDependencies:
       undici8:
         specifier: npm:undici@8.10.1
@@ -661,9 +663,6 @@ packages:
     resolution: {integrity: sha512-IchNf6dN4tHoMFIn/7OE8LWZ19Y6q/67Bmf6vnGREv8RSbBVb9LPJxEcnwrcwX6ixSvaiGoomAUvu4YSxXrVgw==}
     engines: {node: '>=12'}
 
-  '@emnapi/runtime@1.11.1':
-    resolution: {integrity: sha512-vgj7R3y3Wgx24IQaGPA/R6YFXLHVMOZ0uVEyIQPaWs+rd1AzfEMXlAC22FYwO1XkKR6NPsq7mUandH8oIRdZFw==}
-
   '@emnapi/runtime@1.11.3':
     resolution: {integrity: sha512-Xz4Tpyki7XyrpbUK1jR1AhdAdaXyhhY4lZ3neLodmhpuWfy2PAQN5B46sAiU4liOXGLkHypn/qU+jvfWSCYYLA==}
 
@@ -990,318 +989,160 @@ packages:
     resolution: {integrity: sha512-Td76q7j57o/tLVdgS746cYARfSyxk8iEfRxewL9h4OMzYhbW4TAcppl0mT4eyqXddh6L/jwoM75mo7ixa/pCeQ==}
     engines: {node: '>=18'}
 
-  '@img/sharp-darwin-arm64@0.35.2':
-    resolution: {integrity: sha512-eEieHsMksAW4IiO5NzauESRl2D2qz3J/kwUxUrSfV06A93eEaRfMpHXyUb1mAqrR7i8U9A0GRqE9pjn6u1Jjpg==}
-    engines: {node: '>=20.9.0'}
-    cpu: [arm64]
-    os: [darwin]
-
-  '@img/sharp-darwin-arm64@0.35.3':
-    resolution: {integrity: sha512-RMnFX7YQsMoh7lWfcM4NEHHymBX/rLuKNPVM84XE9ONPcaSCDgE7CHIHpSgPcO2xcRthgBy1HfNO319mwhIAkg==}
+  '@img/sharp-darwin-arm64@0.35.4':
+    resolution: {integrity: sha512-Uhfl4V4lhP2nbUVF9+hyH1+luj86f1gUFeo8ALYxFoULoU+G87D43BfeMP8XHsk9boxAnCY/bf2EHwhA7MuGsA==}
     engines: {node: '>=20.9.0'}
     cpu: [arm64]
     os: [darwin]
 
-  '@img/sharp-darwin-x64@0.35.2':
-    resolution: {integrity: sha512-BaktuGPCeHJMARpodR8jK4uKiZrPAy9WrfQW0sdI37clracq8Bp01AYS3SZgi5FS/y5twa9t4+LIuuxQjqRrWw==}
-    engines: {node: '>=20.9.0'}
-    cpu: [x64]
-    os: [darwin]
-
-  '@img/sharp-darwin-x64@0.35.3':
-    resolution: {integrity: sha512-Xo+5uFBtLN0BKqieTxiFzFPQAUlBbbH5iBKyRX/z1JrbnYsHTfKJnUfL8+p2TPXr1pXqao4eeL4Rl144uDpK9w==}
+  '@img/sharp-darwin-x64@0.35.4':
+    resolution: {integrity: sha512-hWniXY3bG5qKpkKrAwPe4y+VTPmf086YQAnkxWh7uA1YrlRouWGa0M0Mxj3ZjnXFkv7/TD1bTy9lGUK26vRvWw==}
     engines: {node: '>=20.9.0'}
     cpu: [x64]
     os: [darwin]
 
-  '@img/sharp-freebsd-wasm32@0.35.2':
-    resolution: {integrity: sha512-YoAxdnd8hPUkvLHd3bWY+YA8nw3xM/RyRopYucNsWHVSan8NLVM3X2volsfoRDcXdUJPg6tXahSd7HXPK7lRnw==}
-    engines: {node: '>=20.9.0'}
-    os: [freebsd]
-
-  '@img/sharp-freebsd-wasm32@0.35.3':
-    resolution: {integrity: sha512-lUxcqWIj2wMQ9BrwNjngcr1gWUr5xgaGThBRqPPalIC2n67Cqj1uPh8NnA/ZhAg8hUbKl+kVHKwgUIwe6ZYPrg==}
+  '@img/sharp-freebsd-wasm32@0.35.4':
+    resolution: {integrity: sha512-lIsKw/BU+kjB4eZjxrYrZmwOJYi3Ajrv66iAlBmUPyKc3HpnloevB1g3wxGD9P/5BbQ1brBGl65VRRrCvQDEqA==}
     engines: {node: '>=20.9.0'}
     os: [freebsd]
 
-  '@img/sharp-libvips-darwin-arm64@1.3.1':
-    resolution: {integrity: sha512-4V/M3roRMTYjiwZY9IOVQOE8OyeCxFAkYmyZDrZl51uOKjibm3oeEJ4WAmLxutAfzFbC9jqUiPs2gbnGflH+7g==}
+  '@img/sharp-libvips-darwin-arm64@1.3.3':
+    resolution: {integrity: sha512-suTBPTDGrI9WodccaDdwZItTSaBYASlBk1NSfElSHrUfzu3szG6lvIF58+WiFvnfzuK8ZBFS5zE00PxqxnRiPg==
```

**File**: `pnpm-workspace.yaml` (modified, +5/-3)
```diff
@@ -20,8 +20,9 @@ overrides:
   brace-expansion@>=3.0.0 <3.0.6: ^3.0.6
   brace-expansion@>=4.0.0 <5.0.9: ^5.0.9
   underscore@<1.13.8: ^1.13.8
-  js-yaml@<3.15.1: ^3.15.1
-  js-yaml@>=4.0.0 <4.3.1: ^4.3.1
+  js-yaml@<3.15.2: ^3.15.2
+  js-yaml@>=4.0.0 <4.3.2: ^4.3.2
+  js-yaml@>=5.0.0 <=5.2.1: ^5.4.1
   '@babel/core@<7.29.6': ^7.29.6
   picomatch@<2.3.2: ^2.3.2
   picomatch@>=4.0.0 <4.0.4: ^4.0.4
@@ -33,7 +34,8 @@ overrides:
   undici@>=7.0.0 <7.29.0: ^7.29.0
   ws@>=8.0.0 <8.20.1: ^8.20.1
   shell-quote@<1.9.0: ^1.9.0
-  sharp@<0.35.0: ^0.35.0
+  sharp@<0.35.4: ^0.35.4
+  browserslist@<4.28.7: ^4.28.7
   tar@<7.5.19: ^7.5.19
 
 catalog:
```

---

### Incident Patch 7: `58c81f10` (2026-09-08)
**Commit Message**: fix: reject unrecognized onTimeout and onResume values (#1822)

`onTimeout` / `on_timeout` and `onResume` / `on_resume` are string
vocabularies the SDK resolves into a **boolean** before building the
request. The value never leaves the client, so the API sees a
well-formed request and a typo cannot be rejected server-side. Today the
SDK silently resolves an unrecognized value to the *other* literal.

For `onTimeout` that is destructive. Verified against staging with a 15s
timeout:

| `on_timeout` | wire | outcome at timeout |
|---|---|---|
| `'pause'` | `autoPause: true` | paused, resumed fine |
| `'Pause'` | `autoPause: false` | **gone — `SandboxNotFoundException`**
|

Same for `'PAUSE'`, `'pause\n'`, `'paused'`, `True`. A caller who asks
for their sandbox to be preserved and mistypes the case gets it and its
snapshot deleted, with no error at create and none at timeout.
`onResume="Reboot"` is the milder version of the same bug: the memory
the caller asked to skip is restored, `connect()` returns success, and
the rescue silently did not happen.

Both now raise `InvalidArgumentError` / `InvalidArgumentException`
naming the valid values. A **nullish** value still means "not
configur

**File**: `.changeset/validate-lifecycle-enums.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'e2b': patch
+'@e2b/python-sdk': patch
+---
+
+`onTimeout` / `on_timeout` and `onResume` / `on_resume` now raise `InvalidArgumentError` / `InvalidArgumentException` for a value outside their two literals, instead of silently resolving it to the other one. Both are resolved into a boolean before the request is built, so the value never reaches the API and a typo cannot be rejected server-side: `on_timeout="Pause"` previously resolved to `kill` and deleted the sandbox and its snapshot at timeout, and `on_resume="Reboot"` previously restored the memory the caller asked to skip. A nullish value still means "not configured" and leaves the choice to the API.
```

**File**: `packages/desktop-python/uv.lock` (modified, +2/-2)
```diff
@@ -352,7 +352,7 @@ wheels = [
 
 [[package]]
 name = "e2b"
-version = "2.46.4"
+version = "2.47.0"
 source = { editable = "../python-sdk" }
 dependencies = [
     { name = "attrs" },
@@ -487,7 +487,7 @@ name = "exceptiongroup"
 version = "1.3.1"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "typing-extensions", marker = "python_full_version < '3.13'" },
+    { name = "typing-extensions" },
 ]
 sdist = { url = "https://files.pythonhosted.org/packages/50/79/66800aadf48771f6b62f7eb014e352e5d06856655206165d775e675a02c9/exceptiongroup-1.3.1.tar.gz", hash = "sha256:8b412432c6055b0b7d14c310000ae93352ed6754f70fa8f7c34141f91c4e3219", size = 30371, upload-time = "2025-11-21T23:01:54.787Z" }
 wheels = [
```

**File**: `packages/js-sdk/src/sandbox/sandboxApi.ts` (modified, +29/-1)
```diff
@@ -456,6 +456,8 @@ export type SandboxLifecycle = {
    * `'kill'`, or `{ action, keepMemory }` to also control the pause snapshot kind.
    * Omitted from the create request when unset, leaving the API's default
    * (currently `kill`) in effect.
+   *
+   * @throws {@link InvalidArgumentError} if the action is outside the two literals.
    */
   onTimeout: SandboxOnTimeout
 
@@ -693,6 +695,7 @@ export type SandboxConnectOpts = ConnectionOpts & {
    * already running.
    *
    * @default 'restore'
+   * @throws {@link InvalidArgumentError} if the value is outside the two literals.
    */
   onResume?: SandboxOnResume
 }
@@ -1645,6 +1648,19 @@ export class SandboxApi extends ClientFactory {
     const onTimeoutConfigured = requestedOnTimeout != null
     const onTimeout = requestedOnTimeout ?? 'kill'
     const action = typeof onTimeout === 'string' ? onTimeout : onTimeout.action
+    const allowedActions = ['pause', 'kill']
+    if (onTimeoutConfigured && !allowedActions.includes(action)) {
+      // Name the field the caller wrote: the object form's bad value is on
+      // `.action`, not on `onTimeout` itself.
+      const field =
+        typeof onTimeout === 'string' ? 'onTimeout' : 'onTimeout.action'
+      throw new InvalidArgumentError(
+        `${field} must be one of: ${allowedActions.join(', ')} (got ${JSON.stringify(action)}).`
+      )
+    }
+    // The action never reaches the API — it is resolved here into the boolean
+    // autoPause — so an unrecognized value cannot be rejected server-side, and
+    // resolving it to kill would delete the sandbox a caller asked to preserve.
     const hasKeepMemory =
       typeof onTimeout !== 'string' && 'keepMemory' in onTimeout
     const keepMemory =
@@ -1809,6 +1825,18 @@ export class SandboxApi extends ClientFactory {
     const config = new ConnectionConfig(apiOpts)
     const client = new ApiClient(config)
 
+    // A nullish value is not a choice of restore, matching every other nullish
+    // option. Any other value outside the union never reaches the API — it is
+    // resolved here into the boolean memory field — so it cannot be rejected
+    // server-side, and resolving it to restore would silently skip the reboot.
+    const onResume = apiOpts?.onResume ?? undefined
+    const allowedOnResume = ['restore', 'reboot']
+    if (onResume !== undefined && !allowedOnResume.includes(onResume)) {
+      throw new InvalidArgumentError(
+        `onResume must be one of: ${allowedOnResume.join(', ')} (got ${JSON.stringify(onResume)}).`
+      )
+    }
+
     const res = await client.api.POST('/sandboxes/{sandboxID}/connect', {
       params: {
         path: {
@@ -1817,7 +1845,7 @@ export class SandboxApi extends ClientFactory {
       },
       body: {
         timeout: timeoutToSeconds(timeoutMs),
-        memory: apiOpts?.onResume === 'reboot' ? false : undefined,
+        memory: onResume === 'reboot' ? false : undefined,
       },
       signal: config.getSignal(apiOpts?.requestTimeoutMs, apiOpts?.signal),
     })
```

**File**: `packages/js-sdk/tests/sandbox/lifecycleRequest.test.ts` (modified, +47/-0)
```diff
@@ -154,3 +154,50 @@ test('an explicit null autoResume from an untyped caller is omitted', async () =
 
   expect(lastCreateBody).not.toHaveProperty('autoResume')
 })
+
+// onTimeout is resolved into the boolean autoPause before the request is built,
+// so the API never sees the action and cannot reject a typo. Resolving it to
+// kill would delete a sandbox the caller asked to preserve.
+const unrecognizedOnTimeout = [
+  'Pause',
+  'PAUSE',
+  'pause\n',
+  'paused',
+  true,
+  { action: 'Pause' },
+  {},
+]
+
+test.for(unrecognizedOnTimeout)(
+  'an unrecognized onTimeout %o is rejected',
+  async (onTimeout) => {
+    await expect(
+      Sandbox.create('base', {
+        apiKey: TEST_API_KEY,
+        // @ts-expect-error deliberately outside the union
+        lifecycle: { onTimeout },
+      })
+    ).rejects.toThrowError(InvalidArgumentError)
+
+    expect(lastCreateBody).toBeUndefined()
+  }
+)
+
+test.for([
+  ['Pause', 'onTimeout'],
+  [{ action: 'Pause' }, 'onTimeout.action'],
+  [{}, 'onTimeout.action'],
+] as const)(
+  'the error for %o names the field the caller wrote',
+  async ([onTimeout, expectedField]) => {
+    await expect(
+      Sandbox.create('base', {
+        apiKey: TEST_API_KEY,
+        // @ts-expect-error deliberately outside the union
+        lifecycle: { onTimeout },
+      })
+    ).rejects.toThrowError(
+      new RegExp(`^${expectedField.replace('.', '\\.')} must be one of`)
+    )
+  }
+)
```

**File**: `packages/js-sdk/tests/sandbox/onResumeRequest.test.ts` (modified, +32/-6)
```diff
@@ -2,7 +2,7 @@ import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
 import { http, HttpResponse } from 'msw'
 import { setupServer } from 'msw/node'
 
-import { Sandbox } from '../../src'
+import { InvalidArgumentError, Sandbox } from '../../src'
 import { TEST_API_KEY, apiUrl } from '../setup'
 
 let lastConnectBody: Record<string, unknown> | undefined
@@ -67,14 +67,40 @@ test('sandbox.connect carries onResume on the instance form too', async () => {
   expect(lastConnectBody).not.toHaveProperty('memory')
 })
 
-test('an untyped onResume value never sends memory: false', async () => {
-  // Untyped callers can pass anything; only the 'reboot' literal opts into a
-  // cold boot, so an unrecognized value must fall back to a memory restore.
+test('a nullish onResume is treated as absent', async () => {
   await Sandbox.connect('test-sandbox-id', {
     apiKey: TEST_API_KEY,
-    // @ts-expect-error 'Reboot' is not a valid onResume value
-    onResume: 'Reboot',
+    // @ts-expect-error null is not a valid onResume value
+    onResume: null,
   })
 
   expect(lastConnectBody).not.toHaveProperty('memory')
 })
+
+// The option is resolved into a boolean before the request is built, so the API
+// never sees it and cannot reject a typo. Falling back to a restore would
+// silently skip the reboot the caller asked for.
+const unrecognized = [
+  'Reboot',
+  'REBOOT',
+  'reboot\n',
+  ' reboot',
+  'rebooted',
+  false,
+  0,
+]
+
+test.for(unrecognized)(
+  'an unrecognized onResume %o is rejected',
+  async (value) => {
+    await expect(
+      Sandbox.connect('test-sandbox-id', {
+        apiKey: TEST_API_KEY,
+        // @ts-expect-error deliberately outside the union
+        onResume: value,
+      })
+    ).rejects.toThrowError(InvalidArgumentError)
+
+    expect(lastConnectBody).toBeUndefined()
+  }
+)
```

---

### Incident Patch 8: `69fc8dc4` (2026-09-07)
**Commit Message**: fix(build): move pnpm settings to workspace config (#1817)

## Summary

Squash of #1805 by @tttboy123 (accepted via `/accept`), rebased onto a
fresh branch for merging into `main`.

- pnpm 10 ignores the `package.json#pnpm` field; move those settings to
`pnpm-workspace.yaml` so they take effect again
- restores the `onlyBuiltDependencies` / `ignoredBuiltDependencies`
build-script policy and dependency security `overrides`
- lockfile resolution is unchanged (`pnpm install --frozen-lockfile`
passes)

Closes #1804

## Verification (from #1805)

- `pnpm config get onlyBuiltDependencies --json`,
`ignoredBuiltDependencies`, `overrides`
- `pnpm install --lockfile-only --frozen-lockfile` / `pnpm install
--frozen-lockfile`
- `pnpm lint`, `pnpm typecheck`, `pnpm test:release` (10/10)
- `pnpm --dir packages/js-sdk exec vitest run --project
connectionConfig` (42/42)

Link to Devin session:
https://app.devin.ai/sessions/57c4e4aa425a472b8e94650a437fafc3
Open in Devin Desktop:
https://app.devin.ai/desktop/session/57c4e4aa425a472b8e94650a437fafc3?variant=devin

Co-authored-by: Boyce <95002055+tttboy123@users.noreply.github.com>
Co-authored-by: Mish Ushakov <10400064+mishushakov@users.noreply.githu

**File**: `package.json` (modified, +0/-37)
```diff
@@ -34,42 +34,5 @@
   },
   "engines": {
     "pnpm": ">=10.16.0 <11"
-  },
-  "pnpm": {
-    "onlyBuiltDependencies": [
-      "esbuild",
-      "workerd"
-    ],
-    "ignoredBuiltDependencies": [
-      "bufferutil",
-      "msw",
-      "utf-8-validate"
-    ],
-    "overrides": {
-      "rollup@>=4": ">=4.59.0",
-      "postcss@<8.5.10": "^8.5.10",
-      "vite@>=6.0.0 <6.4.3": "^6.4.3",
-      "lodash@<4.18.0": "^4.18.0",
-      "brace-expansion@<1.1.18": "^1.1.18",
-      "brace-expansion@>=2.0.0 <2.1.4": "^2.1.4",
-      "brace-expansion@>=3.0.0 <3.0.6": "^3.0.6",
-      "brace-expansion@>=4.0.0 <5.0.9": "^5.0.9",
-      "underscore@<1.13.8": "^1.13.8",
-      "js-yaml@<3.15.1": "^3.15.1",
-      "js-yaml@>=4.0.0 <4.3.1": "^4.3.1",
-      "@babel/core@<7.29.6": "^7.29.6",
-      "picomatch@<2.3.2": "^2.3.2",
-      "picomatch@>=4.0.0 <4.0.4": "^4.0.4",
-      "smol-toml@<1.6.1": "^1.6.1",
-      "minimatch@<3.1.3": "^3.1.3",
-      "minimatch@>=5.0.0 <5.1.8": "^5.1.8",
-      "minimatch@>=9.0.0 <9.0.7": "^9.0.7",
-      "minimatch@>=10.0.0 <10.2.3": "^10.2.3",
-      "undici@>=7.0.0 <7.29.0": "^7.29.0",
-      "ws@>=8.0.0 <8.20.1": "^8.20.1",
-      "shell-quote@<1.9.0": "^1.9.0",
-      "sharp@<0.35.0": "^0.35.0",
-      "tar@<7.5.19": "^7.5.19"
-    }
   }
 }
```

**File**: `pnpm-workspace.yaml` (modified, +35/-0)
```diff
@@ -1,6 +1,41 @@
 packages:
   - packages/*
 
+onlyBuiltDependencies:
+  - esbuild
+  - workerd
+
+ignoredBuiltDependencies:
+  - bufferutil
+  - msw
+  - utf-8-validate
+
+overrides:
+  rollup@>=4: '>=4.59.0'
+  postcss@<8.5.10: ^8.5.10
+  vite@>=6.0.0 <6.4.3: ^6.4.3
+  lodash@<4.18.0: ^4.18.0
+  brace-expansion@<1.1.18: ^1.1.18
+  brace-expansion@>=2.0.0 <2.1.4: ^2.1.4
+  brace-expansion@>=3.0.0 <3.0.6: ^3.0.6
+  brace-expansion@>=4.0.0 <5.0.9: ^5.0.9
+  underscore@<1.13.8: ^1.13.8
+  js-yaml@<3.15.1: ^3.15.1
+  js-yaml@>=4.0.0 <4.3.1: ^4.3.1
+  '@babel/core@<7.29.6': ^7.29.6
+  picomatch@<2.3.2: ^2.3.2
+  picomatch@>=4.0.0 <4.0.4: ^4.0.4
+  smol-toml@<1.6.1: ^1.6.1
+  minimatch@<3.1.3: ^3.1.3
+  minimatch@>=5.0.0 <5.1.8: ^5.1.8
+  minimatch@>=9.0.0 <9.0.7: ^9.0.7
+  minimatch@>=10.0.0 <10.2.3: ^10.2.3
+  undici@>=7.0.0 <7.29.0: ^7.29.0
+  ws@>=8.0.0 <8.20.1: ^8.20.1
+  shell-quote@<1.9.0: ^1.9.0
+  sharp@<0.35.0: ^0.35.0
+  tar@<7.5.19: ^7.5.19
+
 catalog:
   '@types/node': ^20.19.19
   '@typescript/native': npm:typescript@^7.0.2
```

---

### Incident Patch 9: `5921af65` (2026-09-07)
**Commit Message**: docs(js): fix copy-pasted JSDoc params and an ungrammatical error message (#1815)

## Summary
Squash-merge of #1807 by @simpleqt (accepted via `/accept`), re-opened
against `main` from an in-repo branch, plus the third item from the
original PR description that hadn't been pushed.

- `packages/js-sdk/src/sandbox/index.ts` `uploadUrl`: `@param opts
download url options.` → `upload url options.`
- `packages/code-interpreter-js/src/sandbox.ts`: thrown error `Not
response body: …` → `No response body: …`
- `packages/desktop-js/src/sandbox.ts` `drag`: JSDoc documented
`from`/`to` but the signature destructured `[x1, y1]`/`[x2, y2]`.
Signature now `drag(from: [number, number], to: [number, number])`
(spread into `moveMouse`); public type unchanged.

Docs/text only; no changeset.

Link to Devin session:
https://app.devin.ai/sessions/b0ae0c6517c849cf8a9a121d27c51ae5
Open in Devin Desktop:
https://app.devin.ai/desktop/session/b0ae0c6517c849cf8a9a121d27c51ae5?variant=devin

---------

Co-authored-by: 陈志谦 <89645338+simpleqt@users.noreply.github.com>
Co-authored-by: Devin AI <158243242+devin-ai-integration[bot]@users.noreply.github.com>

**File**: `packages/code-interpreter-js/src/sandbox.ts` (modified, +1/-1)
```diff
@@ -255,7 +255,7 @@ export class Sandbox extends BaseSandbox {
 
       if (!res.body) {
         throw new Error(
-          `Not response body: ${res.statusText} ${await res?.text()}`
+          `No response body: ${res.statusText} ${await res?.text()}`
         )
       }
 
```

**File**: `packages/desktop-js/src/sandbox.ts` (modified, +5/-8)
```diff
@@ -448,16 +448,13 @@ export class Sandbox extends SandboxBase {
 
   /**
    * Drag the mouse from the given position to the given position.
-   * @param from - The starting position.
-   * @param to - The ending position.
+   * @param from - The starting position as `[x, y]`.
+   * @param to - The ending position as `[x, y]`.
    */
-  async drag(
-    [x1, y1]: [number, number],
-    [x2, y2]: [number, number]
-  ): Promise<void> {
-    await this.moveMouse(x1, y1)
+  async drag(from: [number, number], to: [number, number]): Promise<void> {
+    await this.moveMouse(...from)
     await this.mousePress()
-    await this.moveMouse(x2, y2)
+    await this.moveMouse(...to)
     await this.mouseRelease()
   }
 
```

**File**: `packages/js-sdk/src/sandbox/index.ts` (modified, +1/-1)
```diff
@@ -746,7 +746,7 @@ export class Sandbox extends SandboxApi {
    *
    * @param path path to the file in the sandbox.
    *
-   * @param opts download url options.
+   * @param opts upload url options.
    *
    * @returns URL for uploading file.
    */
```

---

### Incident Patch 10: `6146cd00` (2026-09-02)
**Commit Message**: fix(release): isolate Python SDK-only publishes (#1799)

## Summary

- Select an isolated publisher when the Changesets release plan contains
only `@e2b/python-sdk`.
- Upload only the base Python SDK, then create only its tag. The
existing Changesets action pushes that tag and creates the GitHub
release. No npm, Desktop, or Code Interpreter uploads run on this path.
- Add a Python patch changeset for a fresh `e2b 2.46.4` release. No
recovery switch or credential changes.

[Release
33677741645](https://github.com/e2b-dev/E2B/actions/runs/33677741645/job/100408304950)
selected only Python SDK tests but ran every Python publish hook.
Desktop rejected the shared project-scoped token with a 403, which
stopped the overall publish. The release plan is now captured before
versioning consumes the changesets, so a Python-only release stays
Python-only through uploading and tagging.

## Verification

- Ten release-tooling tests pass, including isolated selection,
unchanged multi-package selection, empty-plan rejection, SDK-only
upload/tag commands, and upload/tag failures. Five new tests failed
before implementation. Registry and tag commands are stubbed; nothing
was uploaded locally.
- The a

**File**: `.changeset/sunny-tigers-attend.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@e2b/python-sdk': patch
+---
+
+Improve reliability for high-concurrency sandbox workloads by spreading envd traffic across four HTTP/2 connection pools. Set `E2B_ENVD_POOL_SHARDS` before importing the SDK to adjust the pool count.
```

**File**: `.github/scripts/publish_command.cjs` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+const fs = require('node:fs')
+
+const { releases } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
+if (!Array.isArray(releases) || releases.length === 0) {
+  throw new Error('Cannot publish without a release plan')
+}
+
+console.log(
+  releases.length === 1 && releases[0].name === '@e2b/python-sdk'
+    ? 'pnpm run publish:python-sdk'
+    : 'pnpm run publish'
+)
```

**File**: `.github/scripts/publish_python_sdk.sh` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+#!/bin/sh
+
+set -eu
+
+pnpm --filter @e2b/python-sdk run postPublish
+
+VERSION=$(node -p "require('./packages/python-sdk/package.json').version")
+TAG="@e2b/python-sdk@${VERSION}"
+git tag -a "$TAG" -m "$TAG"
+# changesets/action pushes this tag and creates the GitHub release.
+printf 'New tag: %s\n' "$TAG"
```

**File**: `.github/scripts/release.test.cjs` (modified, +83/-4)
```diff
@@ -6,8 +6,10 @@ const path = require('node:path')
 const { test } = require('node:test')
 
 const { scripts } = require('../../package.json')
+const root = path.resolve(__dirname, '../..')
+const { version } = require('../../packages/python-sdk/package.json')
 
-function publish(t, fail = '') {
+function publish(t, fail = '', script = scripts.publish) {
   const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-release-'))
   t.after(() => fs.rmSync(cwd, { recursive: true, force: true }))
   const bin = path.join(cwd, 'bin')
@@ -18,9 +20,14 @@ function publish(t, fail = '') {
     '#!/bin/sh\nprintf "%s\\n" "$*" >> "$RELEASE_COMMANDS"\n[ "$*" != "$FAIL_COMMAND" ]\n',
     { mode: 0o755 }
   )
+  fs.writeFileSync(
+    path.join(bin, 'git'),
+    '#!/bin/sh\nprintf "git %s\\n" "$*" >> "$RELEASE_COMMANDS"\n[ "git $*" != "$FAIL_COMMAND" ]\n',
+    { mode: 0o755 }
+  )
   const log = path.join(cwd, 'commands')
-  const result = spawnSync('sh', ['-c', scripts.publish], {
-    cwd,
+  const result = spawnSync('sh', ['-c', script], {
+    cwd: root,
     env: {
       ...process.env,
       PATH: `${bin}${path.delimiter}${process.env.PATH}`,
@@ -31,7 +38,9 @@ function publish(t, fail = '') {
   })
   return {
     ...result,
-    commands: fs.readFileSync(log, 'utf8').trim().split('\n'),
+    commands: fs.existsSync(log)
+      ? fs.readFileSync(log, 'utf8').trim().split('\n')
+      : [],
   }
 }
 
@@ -62,3 +71,73 @@ test('an npm failure remains a failed release after Python succeeds', (t) => {
   assert.notEqual(result.status, 0)
   assert.deepEqual(result.commands, [build, python, npm])
 })
+
+function publishCommand(t, releases) {
+  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'e2b-release-plan-'))
+  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }))
+  const plan = path.join(cwd, 'plan.json')
+  fs.writeFileSync(plan, JSON.stringify({ releases }))
+  return spawnSync(
+    process.execPath,
+    [path.join(__dirname, 'publish_command.cjs'), plan],
+    {
+      encoding: 'utf8',
+    }
+  )
+}
+
+test('a Python SDK-only release plan selects the isolated publisher', (t) => {
+  const result = publishCommand(t, [
+    {
+      name: '@e2b/python-sdk',
+      type: 'patch',
+      oldVersion: '2.46.3',
+      newVersion: '2.46.4',
+    },
+  ])
+  assert.equal(result.status, 0, result.stderr)
+  assert.equal(result.stdout.trim(), 'pnpm run publish:python-sdk')
+})
+
+test('other release plans retain the workspace publisher', (t) => {
+  for (const releases of [
+    [{ name: 'e2b' }],
+    [{ name: '@e2b/python-sdk' }, { name: '@e2b/desktop' }],
+  ]) {
+    const result = publishCommand(t, releases)
+    assert.equal(result.status, 0, result.stderr)
+    assert.equal(result.stdout.trim(), 'pnpm run publish')
+  }
+})
+
+test('an empty release plan cannot default to publishing everything', (t) => {
+  const result = publishCommand(t, [])
+  assert.notEqual(result.status, 0)
+  assert.equal(result.stdout, '')
+})
+
+const sdkPython = '--filter @e2b/python-sdk run postPublish'
+const sdkTag = `@e2b/python-sdk@${version}`
+const tagCommand = `git tag -a ${sdkTag} -m ${sdkTag}`
+const sdkScript = scripts['publish:python-sdk']
+
+test('the isolated publisher uploads and tags only the base Python SDK', (t) => {
+  const result = publish(t, '', sdkScript)
+  assert.equal(result.status, 0, result.stderr)
+  assert.deepEqual(result.commands, [sdkPython, tagCommand])
+  assert.equal(result.stdout.trim(), `New tag: ${sdkTag}`)
+})
+
+test('a failed SDK upload creates no tag or release marker', (t) => {
+  const result = publish(t, sdkPython, sdkScript)
+  assert.notEqual(result.status, 0)
+  assert.deepEqual(result.commands, [sdkPython])
+  assert.equal(result.stdout, '')
+})
+
+test('a failed tag command emits no release marker', (t) => {
+  const result = publish(t, tagCommand, sdkScript)
+  assert.notEqual(result.status, 0)
+  assert.deepEqual(result.commands, [sdkPython, tagCommand])
+  assert.equal(result.stdout, '')

```

**File**: `.github/workflows/publish_packages.yml` (modified, +8/-1)
```diff
@@ -68,6 +68,13 @@ jobs:
       - name: Install dependencies
         run: pnpm install --frozen-lockfile
 
+      - name: Select publisher
+        id: publisher
+        run: |
+          pnpm changeset status --output="$RUNNER_TEMP/release-plan.json"
+          COMMAND=$(node .github/scripts/publish_command.cjs "$RUNNER_TEMP/release-plan.json")
+          echo "command=$COMMAND" >> "$GITHUB_OUTPUT"
+
       - name: Create new versions
         run: pnpm run version
         env:
@@ -95,7 +102,7 @@ jobs:
         id: release
         uses: changesets/action@a45c4d594aa4e2c509dc14a9f2b3b67ba3780d0d # v1.9.0
         with:
-          publish: pnpm run publish
+          publish: ${{ steps.publisher.outputs.command }}
           createGithubReleases: true
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### Recent Merged Pull Requests:
- **PR #1919** (closed): chore: drop poetry.lock from VS Code excludes (@devin-ai-integration[bot])
- **PR #1917** (2026-09-30): fix(sdk): apply .dockerignore patterns Docker-style when copying template files (@devin-ai-integration[bot])
- **PR #1916** (2026-09-30): chore: remove TASTE.md and its reference in CLAUDE.md (@devin-ai-integration[bot])
- **PR #1915** (2026-09-30): test: move create-payload tests to their request-boundary owners (@devin-ai-integration[bot])
- **PR #1911** (2026-09-29): Revise self-hosting guide and supported providers (@tomassrnka)
- **PR #1910** (closed): feat: add @e2b/x402 — pay-per-sandbox access via x402 (draft) (@maokao96)
- **PR #1909** (2026-09-30): Cap sandbox fork count at 20 (@dobrac)
- **PR #1907** (2026-09-30): chore(sdk): remove dead constant/attribute and de-duplicate Commands handle setup (@devin-ai-integration[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
