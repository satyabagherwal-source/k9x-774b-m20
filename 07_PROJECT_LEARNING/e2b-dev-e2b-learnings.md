# Forensic Learning Record (Deep Inspection): e2b-dev/E2B

> **Canonical Artifact**: `07_PROJECT_LEARNING/e2b-dev-e2b-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/e2b-dev/E2B](https://github.com/e2b-dev/E2B))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:53:41.373Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `e2b-dev/E2B`
- **Description**: Open-source, secure environment with real-world tools for enterprise-grade agents.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 14185 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/cli/src/commands/sandbox/utils.ts`
```
import { wait } from '../../utils/wait'
import { asBold } from '../../utils/format'
import { Sandbox } from 'e2b'
import { ensureAPIKey } from 'src/api'

export function formatEnum(e: { [key: string]: string }) {
  return Object.values(e)
    .map((level) => asBold(level))
    .join(', ')
}

export enum Format {
  JSON = 'json',
  PRETTY = 'pretty',
}

const maxRuntime = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

export function waitForSandboxEnd(sandboxID: string) {
  let running = true

  async function monitor() {
    const startTime = new Date().getTime()

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const currentTime = new Date().getTime()
      const elapsedTime = currentTime - startTime // Time elapsed in milliseconds

      // Check if 24 hours (in milliseconds) have passed
      if (elapsedTime >= maxRuntime) {
        break
      }

      running = await isRunning(sandboxID)
      if (!running) {
        break
      }

      await wait(5000)
    }
  }

  monitor()

  return () => running
}

export async function isRunning(sandboxID: string) {
  try {
    const apiKey = ensureAPIKey()
    const info = await Sandbox.getInfo(sandboxID, {
      apiKey,
    })
    return info.state === 'running'
  } catch (err) {
    console.error(`Failed to check sandbox status: ${err}`)
    return false
  }
}

export function parseMetadata(metadataRaw?: string) {
  let metadata: Record<string, string> | undefined = undefined
  if (metadataRaw && metadataRaw.length > 0) {
    const parsedMetadata: Record<string, string> = {}
    metadataRaw.split(',').map((pair: string) => {
      const [key, value] = pair.split('=')
      if (key && value) {
        parsedMetadata[key.trim()] = value.trim()
      }
    })

    metadata = parsedMetadata
  }

  return metadata
}

```

### Core Architecture Module: `packages/cli/src/commands/template/generators/file-utils.ts`
```
import * as fs from 'fs'
import * as path from 'path'

/**
 * Write content to a file, creating directories if needed
 */
export async function writeFileContent(
  filePath: string,
  content: string
): Promise<void> {
  if (fs.existsSync(filePath)) {
    throw new Error(
      `File ${filePath} already exists. Aborting to avoid overwrite.`
    )
  }

  // Ensure directory exists
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    await fs.promises.mkdir(dir, { recursive: true })
  }

  await fs.promises.writeFile(filePath, content)
}

```

### Core Architecture Module: `packages/cli/src/utils/commands2md.ts`
```
import { Command } from 'commander'
import fs from 'fs'
import json2md from 'json2md'
import path from 'path'

/**
 * Converts command objects to Markdown documentation.
 * This function takes an array of command objects and generates a structured
 * Markdown document describing each command, its usage, options, and subcommands.
 * @returns A string containing the entire markdown documentation for all commands.
 */
export function commands2md(commands: Command[]): void {
  const outputDir = 'sdk_ref'
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  function commandToMd(
    command: any,
    parentName: string = ''
  ): [string, string] {
    const commandName = command.name() as string
    const fullName = parentName ? `${parentName} ${commandName}` : commandName

    const mdStructure = [
      { h2: `e2b ${fullName}` },
      { p: command.description() },
      { h3: 'Usage' },
      {
        code: {
          language: 'bash',
          content: `e2b ${fullName} ${command.usage()}`,
        },
      },
      ...(command.options.length > 0
        ? [
            { h3: 'Options' },
            {
              ul: command.options.map(
                (y: any) =>
                  `\`${y.flags}: ${y.description} ${
                    y.defaultValue !== undefined
                      ? `[default: ${y.defaultValue}]`
                      : ''
                  }\``
              ),
            },
          ]
        : []),
    ]

    let mdContent = json2md(mdStructure)

    // Process subcommands
    command.commands.forEach((subcommand: any) => {
      const [, subMdContent] = commandToMd(subcommand, fullName)
      mdContent += subMdContent + '\n\n'
    })

    // Clean the mdContent from terminal colors and escape HTML characters
    mdContent = mdContent
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/\[1m/g, '')
      .replace(/\[22m/g, '')
      .replace(/\[34m/g, '')
      .replace(/\[39m/g, '')
      .replace(/\[38;2;255;183;102m/g, '')

    return [fullName, mdContent]
  }

  commands.forEach((command: any) => {
    try {
      const [commandName, mdContent] = commandToMd(command)
      const fileName = `${commandName}.md`
      const filePath = path.join(outputDir, fileName)
      fs.writeFileSync(filePath, mdContent)
      console.log(`Generated documentation for ${commandName} at ${filePath}`)
    } catch (error) {
      console.error(`Error processing command: ${command.name()}`)
      console.error(error)
    }
  })
}

```

### Core Architecture Module: `packages/cli/src/utils/confirm.ts`
```
export async function confirm(text: string, defaultAnswer = false) {
  const inquirer = await import('inquirer')
  const confirmAnswers = await inquirer.default.prompt([
    {
      name: 'confirm',
      type: 'confirm',
      default: defaultAnswer,
      message: text,
    },
  ])

  return confirmAnswers['confirm'] as boolean
}

```

### Core Architecture Module: `packages/cli/src/utils/env.ts`
```
/**
 * Commander arg parser for repeatable `--env KEY=VALUE` flags.
 *
 * Accumulates parsed pairs into `previous` so the flag can be passed multiple
 * times. Values may contain `=` (only the first `=` separates key from value).
 */
export function parseEnv(
  value: string,
  previous: Record<string, string>
): Record<string, string> {
  const [key, ...rest] = value.split('=')
  if (key && rest.length > 0) {
    previous[key] = rest.join('=')
  }
  return previous
}

```

### Core Architecture Module: `packages/cli/src/utils/errors.ts`
```
import status from 'statuses'

/**
 * Thrown when a request to E2B API occurs.
 */
export class E2BRequestError extends Error {
  constructor(message: any) {
    super(message)
    this.name = 'E2BRequestError'
  }
}

type E2BResponseError = { code?: number; message?: string }

type E2BResponse<TData> =
  | {
      data: TData
      error?: undefined
    }
  | {
      data?: undefined
      error: E2BResponseError
    }

function throwE2BRequestError(error: E2BResponseError, errMsg?: string): never {
  let message: string
  const code = error.code ?? 0
  switch (code) {
    case 400:
      message = 'bad request'
      break
    case 401:
      message = 'unauthorized'
      break
    case 403:
      message = 'forbidden'
      break
    case 404:
      message = 'not found'
      break
    case 500:
      message = 'internal server error'
      break
    default:
      message = status.message[code] || 'unknown error'
      break
  }

  throw new E2BRequestError(
    `${errMsg && `${errMsg}: `}[${code}] ${message && `${message}: `}${
      error.message ?? 'no message'
    }`
  )
}

export function handleE2BRequestError(
  res: { error: E2BResponseError },
  errMsg?: string
): never
export function handleE2BRequestError<TData>(
  res: E2BResponse<TData>,
  errMsg?: string
): asserts res is { data: TData; error?: undefined }
export function handleE2BRequestError(
  res: E2BResponse<unknown>,
  errMsg?: string
) {
  if (!res.error) {
    return
  }
  throwE2BRequestError(res.error, errMsg)
}

```

### Core Architecture Module: `packages/cli/src/utils/filesystem.ts`
```
import * as path from 'path'

export function getRoot(templatePath?: string) {
  const defaultPath = process.cwd()
  if (!templatePath) return defaultPath
  if (path.isAbsolute(templatePath)) return templatePath
  return path.resolve(defaultPath, templatePath)
}

export function cwdRelative(absolutePath: string) {
  return path.relative(process.cwd(), absolutePath)
}

```

### Core Architecture Module: `packages/cli/src/utils/format.ts`
```
import * as chalk from 'chalk'
import * as e2b from 'e2b'
import * as highlight from 'cli-highlight'
import * as boxen from 'boxen'

import { cwdRelative } from './filesystem'
import { UserConfig } from '../user'

export const primaryColor = '#FFB766'

export function asFormattedConfig(config: UserConfig) {
  const email = asBold(config.identity.email)
  const project = config.projectName
    ? asBold(config.projectName)
    : asRed('Log out and log in to get project name')
  const projectId = asBold(config.projectId)
  return `You are logged in as ${email},\nSelected project: ${project} (${projectId})`
}

export function asFormattedTeam(
  team: e2b.components['schemas']['Team'],
  selected: string
) {
  const name = asBold(team.name)
  const id = asBold(team.teamID)
  const isSelected =
    team.teamID == selected ? asPrimary(' (currently selected project)') : ''
  return `${name} (${id})${isSelected}`
}

export type SandboxTemplateRef = Pick<
  e2b.components['schemas']['Template'],
  'templateID'
> & {
  aliases?: e2b.components['schemas']['Template']['aliases']
}

export function asFormattedSandboxTemplate(template: SandboxTemplateRef) {
  const aliases = listAliases(template.aliases)

  const name = aliases ? asBold(aliases) : ''
  const id = `${template.templateID} `

  return `${id}${name}`.trim()
}

export function asRed(text: string) {
  return chalk.default.redBright(text)
}

export function asFormattedError(text: string | undefined, err?: any) {
  return chalk.default.redBright(
    `${text ? `${text} \n` : ''}${err ? err.stack : ''}\n`
  )
}

export function asBold(content: string) {
  return chalk.default.bold(content)
}

export function asPrimary(content: string) {
  return chalk.default.hex(primaryColor)(content)
}

export function asTimestamp(content: string) {
  return chalk.default.blue(content)
}

export function asLocal(pathInLocal?: string) {
  return chalk.default.blue(pathInLocal)
}

export function asLocalRelative(absolutePathInLocal?: string) {
  if (!absolutePathInLocal) return ''
  return asLocal('./' + cwdRelative(absolutePathInLocal))
}

export function withUnderline(content: string) {
  return chalk.default.underline(content)
}

export function listAliases(aliases: string[] | undefined) {
  if (!aliases) return undefined
  return aliases.join(', ')
}

export function asTypescript(code: string) {
  return highlight.default(code, {
    language: 'typescript',
    ignoreIllegals: true,
  })
}

export function asPython(code: string) {
  return highlight.default(code, { language: 'python', ignoreIllegals: true })
}

export const borderStyle = {
  topLeft: '',
  topRight: '',
  bottomLeft: '',
  bottomRight: '',
  top: '',
  bottom: '',
  left: '',
  right: '',
} as const

const horizontalPadding = 2
const verticalPadding = 1

export function withDelimiter(
  content: string,
  title: string,
  isLast?: boolean
) {
  return boxen.default(content, {
    borderStyle: {
      ...borderStyle,
      top: '─',
      bottom: isLast ? '─' : '',
    },
    titleAlignment: 'center',
    float: 'left',
    title: title ? asBold(title) : undefined,
    margin: {
      top: 0,
      bottom: 0,
      left: 1,
      right: 0,
    },
    fullscreen: (w) => [w, 0],
    padding: {
      bottom: isLast ? verticalPadding : 0,
      left: horizontalPadding,
      right: horizontalPadding,
      top: verticalPadding,
    },
  })
}

```

### Core Architecture Module: `packages/cli/src/utils/openBrowser.ts`
```
import { spawn } from 'child_process'

// Spawn the platform's URL opener ourselves so the 'error' listener is attached
// synchronously. The `open` package (v9.x) only attaches its listener after a
// microtask, by which point a `spawn` ENOENT (e.g. missing `xdg-open` on
// headless Linux) has already been emitted and crashes the process — see
// sindresorhus/open#144.
export function openUrlInBrowser(url: string, onError: () => void): void {
  let command: string
  let args: string[]
  if (process.platform === 'darwin') {
    command = 'open'
    args = [url]
  } else if (process.platform === 'win32') {
    command = 'cmd'
    args = ['/c', 'start', '""', url.replace(/&/g, '^&')]
  } else {
    command = 'xdg-open'
    args = [url]
  }

  try {
    const child = spawn(command, args, { stdio: 'ignore', detached: true })
    child.once('error', onError)
    child.unref()
  } catch {
    onError()
  }
}

```

### Core Architecture Module: `packages/cli/src/utils/signal.ts`
```
import * as os from 'os'

// Signals we handle - filtered to those defined by the OS.
// Note: SIGKILL and SIGSTOP cannot be caught.
const HANDLED_SIGNALS = (
  ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT', 'SIGABRT', 'SIGPIPE'] as const
).filter((sig) => sig in os.constants.signals)

export function setupSignalHandlers(
  onSignal: NodeJS.SignalsListener
): () => void {
  HANDLED_SIGNALS.forEach((sig) => process.on(sig, onSignal))

  return () =>
    HANDLED_SIGNALS.forEach((sig) => process.removeListener(sig, onSignal))
}

```

### Core Architecture Module: `packages/cli/src/utils/table.ts`
```
import { wcswidth } from 'simple-wcswidth'

// Renders tables in the style of kubectl (k8s.io/cli-runtime/pkg/printers):
// uppercase headers, left-aligned columns separated by spaces, no borders.
// https://github.com/kubernetes/cli-runtime/blob/master/pkg/printers/tableprinter.go

const COLUMN_PADDING = 3

export interface Column<T> {
  header: string
  value: (item: T) => string | null | undefined
}

/**
 * Renders `items` as a borderless, space-aligned table on stdout: a header
 * line of uppercased column headers followed by one line per item.
 *
 * @param items rows to render, in the order they should be printed.
 * @param columns column definitions; each one extracts a single cell from an item.
 *
 * @example
 * ```ts
 * renderTable(sandboxes, [
 *   { header: 'Sandbox ID', value: (sandbox) => sandbox.sandboxId },
 *   { header: 'State', value: (sandbox) => sandbox.state },
 * ])
 * ```
 */
export function renderTable<T>(items: T[], columns: Column<T>[]) {
  const headers = columns.map((column) => column.header.toUpperCase())
  const rows = items.map((item) =>
    columns.map((column) => column.value(item) ?? '')
  )

  const widths = headers.map((header, i) =>
    rows.reduce((max, row) => Math.max(max, wcswidth(row[i])), wcswidth(header))
  )

  for (const line of [headers, ...rows]) {
    console.log(
      line
        .map((cell, i) =>
          i === line.length - 1
            ? cell
            : cell + ' '.repeat(widths[i] + COLUMN_PADDING - wcswidth(cell))
        )
        .join('')
        .trimEnd()
    )
  }
}

```

### Core Architecture Module: `packages/cli/src/utils/templateName.ts`
```
/**
 * Allowed template name (alias) format, matching the server-side validation in
 * e2b-dev/runtime (`id.identifierRegex`): the name is trimmed and lowercased,
 * then must contain only lowercase letters, numbers, dashes and underscores.
 */
const templateNameRegex = /^[a-z0-9-_]+$/

const MAX_TEMPLATE_NAME_LENGTH = 128

/**
 * Validates a template name and returns its normalized form (trimmed and
 * lowercased), matching how the server normalizes it.
 */
export function validateTemplateName(name: string): string {
  const cleaned = name?.trim().toLowerCase()
  if (!cleaned) {
    throw new Error('Template name cannot be empty')
  }
  if (!templateNameRegex.test(cleaned)) {
    throw new Error(
      'Template name must contain only letters, numbers, dashes and underscores'
    )
  }
  if (cleaned.length > MAX_TEMPLATE_NAME_LENGTH) {
    throw new Error(
      `Template name must be at most ${MAX_TEMPLATE_NAME_LENGTH} characters long`
    )
  }
  return cleaned
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1933** (2026-10-05): **[Bug]: Dockerignore **.txt patterns do not exclude template files in either SDK**
  *Symptoms*: ### Sandbox ID or Build ID  Not applicable: offline template file selection; no sandbox or build was created.  ### Environment  Current main `a9c58ab2b81ba3d948819a55bbecae9b2617b347`, JS and Python SDK 2.52.0, Windows, Node 22.23.2, Python 3.12.14, pnpm 10.34.5.  ### Timestamp  2026-10-02 22:34 +08:00.  ### Frequency  Happens every time with the local reproducer.  ### Expected behavior  A Dockerignore pattern `**.txt` should exclude paths ending in `.txt`, including `root.txt` and `src/nested.txt`. Moby's [suffix-match implementation](https://github.com/moby/patternmatcher/blob/main/patternmatcher.go#L304-L311) handles a leading `**` followed by a literal suffix.  ### Actual behavior  Both SDKs leave these files in the list used for template copy. The port always compiles a non-final `**` into `(.*/)?`, omitting Moby's literal-suffix case. `**.txt` therefore matches a filename literally named `.txt`, rather than `root.txt`.  ### Reproduction  No API key or cloud sandbox is needed:  ```python from pathlib import Path from tempfile import TemporaryDirectory from e2b.template.utils import get_all_files_in_path  with TemporaryDirectory() as context:     root = Path(context)     (root / "src").mkdir()     (root / "root.txt").write_text("x")     (root / "src" / "nested.txt").write_text("x")     files = get_all_files_in_path(".", context, ["**.txt"])     print([Path(p).relative_to(root).as_posix() for p in files]) ```  On main, the output contains both `root.txt` and `src/nested.tx
  **Post-Mortem & Fix Analysis**:
  > **Triage**  - **type**: bug - **priority**: medium - **complexity**: small - **affected_area**: js-sdk/template + python-sdk/template (dockerignore pattern matching in `getAllFilesInPath` / `get_all_files_in_path`) - **actionable**: yes - **needs_clarification**: false - **summary**: In both SDKs, the dockerignore-to-regex port compiles a non-final leading `**` as `(.*/)?`, so a pattern like `**.txt` doesn't exclude `root.txt` or `src/nested.txt` (Moby treats it as a literal-suffix match). Clear offline repro included; the reporter says this is an edge case left over after #1917 and has a patch ready.  [Written by Devin](https://app.devin.ai/sessions/34bfd265ddd24ed580844067c242044c) 
  > @siye566 thanks for reporting this and for the clear offline repro (and for #1934). The fix shipped in https://github.com/e2b-dev/E2B/pull/1935: a leading `**` followed by literal characters (e.g. `**.txt`) now matches at any depth, as it does in BuildKit, in both SDKs.  It's in **`e2b` 2.52.1** (JS SDK on npm and Python SDK on PyPI):  ``` npm i e2b@2.52.1 pip install -U e2b==2.52.1 ```  [Written by Devin](https://app.devin.ai/sessions/e52705efb509421db9d1de4dd3c2b412) 

- **Issue #1902** (2026-10-01): **[Bug]: Template copy() includes files that .dockerignore / fileIgnorePatterns should exclude (JS + Python)**
  *Symptoms*: ### Sandbox ID or Build ID  N/A. Client-side bug, reproducible offline without building anything.  ### Environment  - `e2b` (JS) 2.51.0 and `e2b` (Python) 2.51.0, current `main` (`ccaf9fc0`) - glob 13.0.6, wcmatch 11.0.1 - macOS 26.5.2, Node 24.12.0, Python 3.14.2  ### Timestamp of the issue  2026-09-25 UTC (not time-dependent)  ### Frequency  Happens every time  ### Expected behavior  Paths matched by `.dockerignore` or `fileIgnorePatterns` (`file_ignore_patterns` in Python) stay out of the file set that `copy()` hashes and uploads, as they do in a Docker build context:  - Patterns apply no matter how `src` is written (`.`, `./`, `./src`, `src/.`, `dist/../src`, `src`), and the context root itself is never excluded. - A pattern that matches a directory (`node_modules`, `.git`, `dist/`, `src/generated`, `**/node_modules`) excludes everything under it. - A leading `/` is ignored, as in Docker (`/node_modules` is the same as `node_modules`).  The docs say the same: files matching `.dockerignore` and `fileIgnorePatterns` "are excluded from uploads and hash calculations" ([Base image](https://docs.e2b.dev/template/base-image)). Their example, `fileIgnorePatterns: [".git", "node_modules"]`, is hit by bug 2 below (and bug 1 in Python) and uploads both directories' contents with `copy('.')`.  ### Actual behavior  The shared collector (`getAllFilesInPath` in JS, `get_all_files_in_path` in Python) has three bugs. The files hash and the upload tar both use its output.  1. **Python only
  **Post-Mortem & Fix Analysis**:
  > I'd like to work on this and will open a PR with the proposed fix (both SDKs, with tests and a changeset). Input on the `!` negation question above is welcome before then.
  > **Triage**  - **type**: bug - **priority**: high - **complexity**: medium - **affected_area**: js-sdk/template utils (`getAllFilesInPath`) + python-sdk/template utils (`get_all_files_in_path`) - **actionable**: yes - **needs_clarification**: false - **summary**: `.dockerignore` / `fileIgnorePatterns` are not applied Docker-style in both SDKs' template `copy()` file collector (directory patterns don't exclude contents, leading `/` matches nothing, Python skips patterns when `src` has `.`/`..` segments), causing ignored files such as `.env`, `node_modules` and `.git` to be uploaded into templates and to churn the files hash; the reporter has volunteered a PR and asks maintainers to decide whether `!` negation support should land in the same PR or as a follow-up.  [Written by Devin](https://app.devin.ai/sessions/93ffaf7d2a39413daaf6bf95a3e1c306)
  > Userspace ignore lists like .dockerignore or .gitignore are fragile boundaries for secret containment because glob parsers often fail on edge cases: trailing slashes, symlink resolution, case-insensitive filesystems, and subpath traversal. If an agent or template builder relies strictly on regex string matching, sensitive files like .env, private keys, or credentials inevitably slip through.  A robust defense-in-depth approach is to enforce secret masking at the VFS inode layer: 1. In unprivileged Linux mount namespaces, mount an empty, read-only tmpfs over known sensitive files (~/.ssh, ~/.aws, .env) with file mode 0000. 2. Even if a template packaging script traverses the entire home or project directory, reading the masked paths returns an immediate permission error or empty content at the kernel boundary. 3. Landlock LSM rules can restrict directory enumeration and openat() calls outside the intended source tree.  We implemented this pattern in [Vetto](https://github.com/shleder/ve

- **Issue #1895** (2026-10-05): **[Bug]: JS SDK: filesystem watch handle.stop() always fires onExit with a TimeoutError blaming 'requestTimeoutMs'**
  *Symptoms*: ### Sandbox ID or Build ID  N/A — no sandbox or template is involved. Reproduced deterministically against a local mock envd server speaking the Connect protocol, driving the same `@connectrpc/connect-web` transport the SDK uses.  ### Environment  - `e2b` JS SDK **2.50.0**, commit `6a608ef8770221283a8d307cedcd587a69213944` (current `main`) - Node.js v22.23.2, vitest 4.1.11, macOS 15 (arm64)  ### Timestamp of the issue  2026-09-25 18:51 UTC (deterministic — reproduces on every run)  ### Frequency  Happens every time  ### Expected behavior  `await handle.stop()` — the documented way to end a watch — should end the watch cleanly and call `onExit` with no argument. `WatchOpts` types the callback as `onExit?: (err?: Error) => void | Promise<void>`, "Callback to call when the watch operation stops" (`packages/js-sdk/src/sandbox/filesystem/index.ts:340-343`).  Basis: PR #1480 (commit `de0c4016`, "fix(sdk): correct filesystem watch handle callback and timeout behavior") added exactly this handling to the Python sibling in the same commit (`packages/python-sdk/e2b/sandbox_async/filesystem/watch_handle.py:87-92`):  ```python except asyncio.CancelledError:     # `stop()` cancels this task to end the watch. Treat it as a clean,     # user-initiated end: fire `on_exit` (with no error), then propagate     # the cancellation so the task still finishes as cancelled.     await self._call_on_exit(None) ```  That commit's changeset (`.changeset/watch-handle-fixes.md`) states the intended cross-
  **Post-Mortem & Fix Analysis**:
  > **Triage**  - **type**: bug - **priority**: high - **complexity**: small - **affected_area**: js-sdk/filesystem watch handle (`watchHandle.ts`, `envd/rpc.ts` error mapping) - **actionable**: yes - **needs_clarification**: false - **summary**: In the JS SDK, a user-initiated `WatchHandle.stop()` aborts the Connect stream and the resulting `Code.Canceled` error is mapped to a `TimeoutError` blaming `requestTimeoutMs` and passed to `onExit`, instead of treating the stop as a clean end (`onExit()` with no error) as the Python SDK already does since #1480; a deterministic mock-envd repro and a proposed fix (a `stopped` flag consulted in `handleEvents`) are included.  [Written by Devin](https://app.devin.ai/sessions/9f5d5ed188464221b9c1e56f15c8cedb)
  > <!-- oss-claim --> Reproduced this. Root cause: packages/js-sdk/src/sandbox/filesystem/watchHandle.ts:93-95 (pre-fix) — stop() only aborts the request and sets nothing marking the stop as user-initiated, so the canceled ConnectError it triggers is mapped by packages/js-sdk/src/envd/rpc.ts:80-83 (Code.Canceled -> TimeoutError blaming 'requestTimeoutMs') and passed to onExit.  Minimal reproduction: ``` npx vitest run tests/sandbox/watchstop.repro.test.ts (in packages/js-sdk, with the repro test file from the issue body) ```  Observed output: ``` exitErr.name: TimeoutError exitErr.message: [canceled] This operation was aborted: This error is likely due to exceeding 'requestTimeoutMs'. You can pass the request timeout value as an option when making the request. AssertionError: expected false to be true (at watchstop.repro.test.ts:129) stack: watchHandle.ts:107 -> rpc.ts:146 -> rpc.ts:109 -> rpc.ts:81 ```  Happy to open a PR with this fix, or to be assigned if you prefer to take it.
  > This issue is typical of async watcher implementations where the event loop handle is not unreferenced or cleared when stop() is invoked. If handle.stop() triggers an internal teardown promise while a fallback timeout timer remains active in the background, the timer callback executes anyway upon expiring and reports a false timeout.  To prevent spurious watcher events in async SDKs: 1. Store the active timeout timer ID inside the watch handle instance, and explicitly invoke clearTimeout() at the very beginning of stop(). 2. Call unref() on the timer in Node.js environments so that an idle watch timer does not hold the event loop open. 3. Close the underlying kernel notification descriptor (inotify_rm_watch / close event stream) synchronously before resolving the teardown promise.  In [Vetto](https://github.com/shleder/vetto), we manage sandboxed filesystem events and process supervision with monotonic timers and strict cancellation tokens, ensuring that session teardown terminates all

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

### Incident Patch 1: `af8d7a58` (2026-10-05)
**Commit Message**: fix(code-interpreter): preserve UTF-8 across response chunks (#1946)

## Summary
Lands community PR #1945 by @fhgffy (squash-merged into this branch)
onto `main`. Fixes #1944.

`readLines` in `packages/code-interpreter-js/src/utils.ts` now reuses
one streaming `TextDecoder` across response chunks (`decode(chunk, {
stream: true })`) and flushes it at EOF. Before, a multi-byte character
split across chunks turned into `�`, which corrupted results, logs and
callbacks.

Adds regression tests in
`packages/code-interpreter-js/tests/utils.test.ts` that split CJK, emoji
and accented text into 1/2/3/4/7-byte chunks. They also cover empty
input, trailing newlines, an unterminated last line and a truncated
final character. A patch changeset for `@e2b/code-interpreter` is
included.

The Python SDK already decodes incrementally through HTTPX, so it
doesn't need a matching change.

Link to Devin session:
https://app.devin.ai/sessions/8767348ad64746cbbdaf72f29e9a51bf
Open in Devin Desktop:
https://app.devin.ai/desktop/session/8767348ad64746cbbdaf72f29e9a51bf?variant=devin
<!-- devin-review-badge-begin -->

---

<a href="https://app.devin.ai/review/e2b-dev/e2b/pull/1946"
target="_blank"><picture><

**File**: `.changeset/calm-streamed-unicode.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@e2b/code-interpreter': patch
+---
+
+Preserve Unicode characters split across response chunks in code execution output.
```

**File**: `packages/code-interpreter-js/src/utils.ts` (modified, +3/-1)
```diff
@@ -65,17 +65,19 @@ export function isConnectionClosedError(error: unknown): boolean {
 
 export async function* readLines(stream: ReadableStream<Uint8Array>) {
   const reader = stream.getReader()
+  const decoder = new TextDecoder()
   let buffer = ''
 
   try {
     while (true) {
       const { done, value } = await reader.read()
 
       if (value !== undefined) {
-        buffer += new TextDecoder().decode(value)
+        buffer += decoder.decode(value, { stream: true })
       }
 
       if (done) {
+        buffer += decoder.decode()
         if (buffer.length > 0) {
           yield buffer
         }
```

**File**: `packages/code-interpreter-js/tests/utils.test.ts` (added, +64/-0)
```diff
@@ -0,0 +1,64 @@
+import { expect, test } from 'vitest'
+
+import { readLines } from '../src/utils'
+
+test.each([1, 2, 3, 4, 7])(
+  'preserves UTF-8 output split into %s-byte chunks',
+  async (chunkSize) => {
+    const expected = ['{"text":"你好 🌍 café"}', '{"text":"日本語 🚀"}']
+    const bytes = new TextEncoder().encode(expected.join('\n'))
+    const stream = new ReadableStream<Uint8Array>({
+      start(controller) {
+        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
+          controller.enqueue(bytes.slice(offset, offset + chunkSize))
+        }
+        controller.close()
+      },
+    })
+    const lines: string[] = []
+
+    for await (const line of readLines(stream)) {
+      lines.push(line)
+    }
+
+    expect(lines).toEqual(expected)
+    expect(stream.locked).toBe(false)
+  }
+)
+
+test.each(['', 'first\n\nlast\n', 'first\nlast', '🌍\n你好\n'])(
+  'preserves complete lines and an unterminated final line: %j',
+  async (text) => {
+    const stream = new ReadableStream<Uint8Array>({
+      start(controller) {
+        controller.enqueue(new TextEncoder().encode(text))
+        controller.close()
+      },
+    })
+    const lines: string[] = []
+
+    for await (const line of readLines(stream)) {
+      lines.push(line)
+    }
+
+    const expected = text.split('\n')
+    if (expected.at(-1) === '') expected.pop()
+    expect(lines).toEqual(expected)
+  }
+)
+
+test('flushes an incomplete UTF-8 sequence when the stream ends', async () => {
+  const stream = new ReadableStream<Uint8Array>({
+    start(controller) {
+      controller.enqueue(new Uint8Array([0xe4, 0xbd]))
+      controller.close()
+    },
+  })
+  const lines: string[] = []
+
+  for await (const line of readLines(stream)) {
+    lines.push(line)
+  }
+
+  expect(lines).toEqual(['\uFFFD'])
+})
```

---

### Incident Patch 2: `b3bb6531` (2026-10-05)
**Commit Message**: fix(sdk): remove E2B_USER_AGENT_SOURCE and CI-only request diagnostics (#1927)

## Summary

Removes the `E2B_USER_AGENT_SOURCE` env var added in #1794, so SDK
behavior no longer depends on whether code runs in CI. The variable
shipped in the last release, so this PR includes a patch changeset for
`e2b`, `@e2b/python-sdk`, `@e2b/code-interpreter` and
`@e2b/code-interpreter-python`.

What goes away (js-sdk, python-sdk, both Code Interpreter SDKs):
- `ConnectionConfig.requestSource` / `request_source` and the
`source/<value>` token in the User-Agent.
- `?source=<value>` on Code Interpreter Jupyter requests.
`getJupyterRequestUrl` / `_jupyter_request_url` are removed and the URLs
are back to `${jupyterUrl}/execute` etc.
- The `=== 'ci'` paths:
- the API logger is installed only when a `logger` is passed (no
fallback to `console.error` or the `e2b.ci` logger);
  - no `X-E2B-Trace-ID` in log lines;
- no `(trace_id=…)` suffix in Code Interpreter errors (the
`includeDiagnostics` / `include_diagnostics` args are removed).
- `E2B_USER_AGENT_SOURCE: ci` in every workflow,
`vitest.cloudflare.config.mts` and the Cloudflare `wrangler.jsonc`.

Code Interpreter errors for statuses other than 404 a

**File**: `.changeset/remove-request-source.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+"e2b": patch
+"@e2b/python-sdk": patch
+"@e2b/code-interpreter": patch
+"@e2b/code-interpreter-python": patch
+---
+
+Remove the `E2B_USER_AGENT_SOURCE` environment variable. The SDKs no longer add a `source/<value>` User-Agent token, append `?source=` to Code Interpreter requests, or log trace IDs and add `(trace_id=…)` to error messages when it is set to `ci`, so SDK behavior no longer depends on that variable.
+
+Code Interpreter errors for statuses other than 404 and 502 now use the same `<status> <reason>[: <body>]` message in JS and Python: JS includes the response body, and Python falls back to the reason phrase when the body is empty.
```

**File**: `.github/workflows/cli_tests.yml` (modified, +0/-3)
```diff
@@ -14,9 +14,6 @@ on:
 permissions:
   contents: read
 
-env:
-  E2B_USER_AGENT_SOURCE: ci
-
 jobs:
   test:
     defaults:
```

**File**: `.github/workflows/code_interpreter_js_tests.yml` (modified, +0/-3)
```diff
@@ -23,9 +23,6 @@ on:
 permissions:
   contents: read
 
-env:
-  E2B_USER_AGENT_SOURCE: ci
-
 jobs:
   test:
     defaults:
```

**File**: `.github/workflows/code_interpreter_python_tests.yml` (modified, +0/-3)
```diff
@@ -18,9 +18,6 @@ on:
 permissions:
   contents: read
 
-env:
-  E2B_USER_AGENT_SOURCE: ci
-
 jobs:
   test:
     defaults:
```

**File**: `.github/workflows/desktop_js_tests.yml` (modified, +0/-3)
```diff
@@ -18,9 +18,6 @@ on:
 permissions:
   contents: read
 
-env:
-  E2B_USER_AGENT_SOURCE: ci
-
 jobs:
   test:
     defaults:
```

**File**: `.github/workflows/desktop_python_tests.yml` (modified, +0/-3)
```diff
@@ -18,9 +18,6 @@ on:
 permissions:
   contents: read
 
-env:
-  E2B_USER_AGENT_SOURCE: ci
-
 jobs:
   test:
     defaults:
```

**File**: `.github/workflows/js_sdk_tests.yml` (modified, +0/-3)
```diff
@@ -19,9 +19,6 @@ on:
 permissions:
   contents: read
 
-env:
-  E2B_USER_AGENT_SOURCE: ci
-
 jobs:
   test:
     defaults:
```

**File**: `.github/workflows/python_sdk_tests.yml` (modified, +0/-3)
```diff
@@ -14,9 +14,6 @@ on:
 permissions:
   contents: read
 
-env:
-  E2B_USER_AGENT_SOURCE: ci
-
 jobs:
   test:
     defaults:
```

---

### Incident Patch 3: `cc296178` (2026-10-05)
**Commit Message**: fix(sdk): match BuildKit in .dockerignore pattern matching (#1935)

## Summary

Fixes three cases where the JS and Python `.dockerignore` matchers
(`PatternMatcher`) pick different files than `docker build` (BuildKit).
I found them by checking both SDKs against Moby and BuildKit's
`fsutil.Walk`.

1. **A leading `**` followed by plain text** (`**.txt`, `**git`, …)
never matched (#1933). `compile()` now uses moby's match types, defined
as a `MatchType` / `_MatchType` enum: `Exact`, `Prefix` (`foo**`),
`Suffix` (pattern starts with `**`), and `Regex`. Only `Regex` builds a
regex, so `**.txt` becomes `path.endsWith('.txt')`, exactly like moby's
`strings.HasSuffix`. This also avoids the newline edge cases a regex
shortcut has (`a\n.txt`, and `a.txt\n` in Python). Python regexes now
end in `\Z`, not `$`, to match Go's `$`.
2. **A `!` pattern that only matches a parent folder no longer
re-includes the file.** We ported `MatchesOrParentMatches`, but BuildKit
filters with `MatchesUsingParentResults`. That evaluates each parent
folder first and passes along which patterns matched it, and a pattern
skipped at a parent doesn't count for the files under it. `matches(p)`
now does the same, walki

**File**: `.changeset/dockerignore-buildkit-parity.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'e2b': patch
+'@e2b/python-sdk': patch
+---
+
+Match BuildKit when filtering the template build context with `.dockerignore`: a leading `**` followed by literal characters (e.g. `**.txt`) now matches at any depth, a negated pattern matching only a parent directory (e.g. `src/app.ts` then `!src`) no longer re-includes the path, and in the JS SDK `?` and bracket expressions match characters outside the BMP (e.g. emoji) as a single character.
```

**File**: `packages/js-sdk/src/template/dockerignore.ts` (modified, +141/-28)
```diff
@@ -25,7 +25,64 @@ const WILDCARD_CHARS = /[*?[\\]/
 const backslashIsSeparator = () => path.sep === '\\'
 
 function escapeRegex(ch: string): string {
-  return ch.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')
+  return ch.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
+}
+
+// Escapes that keep their regex meaning in a bracket expression, like in Python
+const CLASS_ESCAPES = new Set('dDsSwWfnrtv')
+const CLASS_CONTROL_ESCAPES: Record<string, string> = { a: '\\x07', b: '\\x08' }
+const CLASS_HEX_ESCAPE_LENGTHS: Record<string, number> = { x: 2, u: 4, U: 8 }
+// Characters that must stay escaped in a bracket expression with the `u` flag
+const CLASS_SYNTAX_CHARS = new Set('^$\\.*+?()[]{}|/-')
+
+// Make a bracket expression body valid with the regex `u` flag
+function translateClass(body: string, backslashIsEscape: boolean): string {
+  let cls = ''
+  let i = 0
+  while (i < body.length) {
+    const ch = body[i++]
+    if (ch !== '\\') {
+      cls += ch
+    } else if (!backslashIsEscape || i >= body.length) {
+      cls += '\\\\'
+    } else {
+      const next = body[i++]
+      if (CLASS_ESCAPES.has(next)) {
+        cls += '\\' + next
+      } else if (next in CLASS_CONTROL_ESCAPES) {
+        cls += CLASS_CONTROL_ESCAPES[next]
+      } else if (next in CLASS_HEX_ESCAPE_LENGTHS) {
+        const length = CLASS_HEX_ESCAPE_LENGTHS[next]
+        const hex = body.slice(i, i + length)
+        if (hex.length < length || !/^[0-9a-fA-F]+$/.test(hex)) {
+          throw new Error(`incomplete escape \\${next}${hex}`)
+        }
+        const code = parseInt(hex, 16)
+        if (code > 0x10ffff) {
+          throw new Error(`bad escape \\${next}${hex}`)
+        }
+        cls += `\\u{${code.toString(16)}}`
+        i += length
+      } else if (/[0-7]/.test(next)) {
+        let octal = next
+        while (octal.length < 3 && /[0-7]/.test(body[i] ?? '')) {
+          octal += body[i++]
+        }
+        const code = parseInt(octal, 8)
+        if (code > 0o377) {
+          throw new Error(
+            `octal escape value \\${octal} outside of range 0-0o377`
+          )
+        }
+        cls += `\\u{${code.toString(16)}}`
+      } else if (/[A-Za-z0-9]/.test(next)) {
+        throw new Error(`bad escape \\${next}`)
+      } else {
+        cls += CLASS_SYNTAX_CHARS.has(next) ? '\\' + next : next
+      }
+    }
+  }
+  return cls
 }
 
 // Equivalent of Go's filepath.Clean followed by filepath.ToSlash
@@ -36,12 +93,25 @@ function clean(pattern: string): string {
   return path.posix.normalize(pattern).replace(/(.)\/$/, '$1')
 }
 
-function compile(pattern: string): RegExp {
+type Matcher = (p: string) => boolean
+
+enum MatchType {
+  Exact = 'exact',
+  Prefix = 'prefix',
+  Suffix = 'suffix',
+  Regex = 'regex',
+}
+
+// Like moby, use plain string checks for patterns without wildcards and only
+// fall back to a regex otherwise
+function compile(pattern: string): Matcher {
   let regex = '^'
+  let matchType = MatchType.Exact
   const n = pattern.length
   const backslashIsEscape = !backslashIsSeparator()
   let i = 0
   while (i < n) {
+    const first = i === 0
     const ch = pattern[i++]
     if (ch === '*') {
       if (pattern[i] === '*') {
@@ -50,14 +120,26 @@ function compile(pattern: string): RegExp {
         if (pattern[i] === '/') {
           i++
         }
-        regex += i >= n ? '.*' : '(.*/)?'
+        if (i >= n) {
+          regex += '.*'
+          matchType =
+            matchType === MatchType.Exact ? MatchType.Prefix : MatchType.Regex
+        } else {
+          regex += '(.*/)?'
+          matchType = MatchType.Regex
+        }
+        if (first) {
+          matchType = MatchType.Suffix
+        }
       } else {
         regex += '[^/]*'
+        matchType = MatchType.Regex
       }
     } else if (ch === '?') {
       regex += '[^/]'
+      matchType = MatchType.Regex
     } else if (ch === '[') {
-      // Copy a bracket expression as is, a leading "^" negates it
+      // Copy a bracket expression, a leading "^" negates it
       let j = i
       if (pattern[j] === '^') {
         j++
@@ -68,28 +150,54 @@ function compile(pattern: string): RegExp {
         }
         j++
       }
-      regex += pattern.slice(i - 1, j + 1)
+      regex +=
+        '[' +
+        translateClass(pattern.slice(i, Math.min(j, n)), backslashIsEscape) +
+        (j < n ? ']' : '')
       i = j + 1
+      matchType = MatchType.Regex
+    } else if (ch === ']') {
+      regex += '\\]'
+      matchType = MatchType.Regex
     } else if (LITERAL_REGEX_CHARS.has(ch)) {
       regex += '\\' + ch
     } else if (ch === '\\' && backslashIsEscape) {
       // Escape the next character
       if (i < n) {
         regex += escapeRegex(pattern[i++])
+        matchType = MatchType.Regex
       } else {
         regex += '\\\\'
       }
     } else {
       regex += ch
     }
   }
-  return new RegExp(regex + '$')
+
+  switch (matchType) {
+    case MatchType.Exact:
+      return (p) => p === pattern
+    case 
```

**File**: `packages/js-sdk/tests/template/utils/getAllFilesInPath.test.ts` (modified, +45/-0)
```diff
@@ -413,6 +413,34 @@ describe('getAllFilesInPath', () => {
       ])
     })
 
+    test('should not re-include a path through a negated parent directory', async () => {
+      const files = await relativePaths('.', ['src/app.ts', '**/*.js', '!src'])
+      expect(files).not.toContain('src/app.ts')
+      expect(files).not.toContain('src/node_modules/lib.js')
+      expect(files).toContain('src/app.spec.ts')
+    })
+
+    test('should match a leading globstar with a literal suffix', async () => {
+      for (const name of ['root.txt', 'src/nested.txt', 'keep.txt.bak']) {
+        await writeFile(join(testDir, name), 'x')
+      }
+      const files = await relativePaths('.', ['**.txt', '**/generated'])
+      expect(files).not.toContain('root.txt')
+      expect(files).not.toContain('src/nested.txt')
+      expect(files).not.toContain('src/generated/api.ts')
+      expect(files).toContain('keep.txt.bak')
+    })
+
+    test('should match characters outside the BMP as a single character', async () => {
+      for (const name of ['😀.txt', '😀😀.txt']) {
+        await writeFile(join(testDir, name), 'x')
+      }
+      const files = await relativePaths('*', ['?.txt'])
+      expect(files).not.toContain('😀.txt')
+      expect(files).toContain('😀😀.txt')
+      expect(await relativePaths('*', ['[😀]?.txt'])).not.toContain('😀😀.txt')
+    })
+
     test('should make absolute patterns inside the context relative', async () => {
       const files = await relativePaths('.', [
         join(testDir, 'src'),
@@ -438,6 +466,23 @@ describe('getAllFilesInPath', () => {
       )
     })
 
+    test.skipIf(process.platform === 'win32')(
+      'should handle escapes in a bracket expression like Python',
+      async () => {
+        await expect(
+          getAllFilesInPath('.', testDir, ['[\\q]'])
+        ).rejects.toThrow("Invalid ignore pattern '[\\q]'")
+        await writeFile(join(testDir, 'a'), 'x')
+        expect(await relativePaths('*', ['[\\a]'])).toContain('a')
+        await writeFile(join(testDir, 'b'), 'x')
+        await writeFile(join(testDir, 'c'), 'x')
+        const files = await relativePaths('*', ['[\\x61]', '[\\142]'])
+        expect(files).not.toContain('a')
+        expect(files).not.toContain('b')
+        expect(files).toContain('c')
+      }
+    )
+
     test('should keep the files hash stable when ignored files change', async () => {
       const hash = () =>
         calculateFilesHash('.', '/app', testDir, ['.git'], false, undefined)
```

**File**: `packages/python-sdk/e2b/template/dockerignore.py` (modified, +70/-23)
```diff
@@ -9,7 +9,8 @@
 import os
 import posixpath
 import re
-from typing import List
+from enum import Enum
+from typing import Callable, List
 
 from e2b.exceptions import TemplateException
 
@@ -19,17 +20,28 @@
 _BACKSLASH_IS_SEPARATOR = os.sep == "\\"
 
 
+class _MatchType(Enum):
+    EXACT = "exact"
+    PREFIX = "prefix"
+    SUFFIX = "suffix"
+    REGEX = "regex"
+
+
 def _clean(pattern: str) -> str:
     # Equivalent of Go's filepath.Clean followed by filepath.ToSlash
     if _BACKSLASH_IS_SEPARATOR:
         pattern = pattern.replace("\\", "/")
     return posixpath.normpath(re.sub("/+", "/", pattern))
 
 
-def _compile(pattern: str) -> "re.Pattern[str]":
+def _compile(pattern: str) -> Callable[[str], bool]:
+    # Like moby, use plain string checks for patterns without wildcards and
+    # only fall back to a regex otherwise
     regex = "^"
+    match_type = _MatchType.EXACT
     i, n = 0, len(pattern)
     while i < n:
+        first = i == 0
         ch = pattern[i]
         i += 1
         if ch == "*":
@@ -38,11 +50,24 @@ def _compile(pattern: str) -> "re.Pattern[str]":
                 # Treat "**/" as "**"
                 if i < n and pattern[i] == "/":
                     i += 1
-                regex += ".*" if i >= n else "(.*/)?"
+                if i >= n:
+                    regex += ".*"
+                    match_type = (
+                        _MatchType.PREFIX
+                        if match_type is _MatchType.EXACT
+                        else _MatchType.REGEX
+                    )
+                else:
+                    regex += "(.*/)?"
+                    match_type = _MatchType.REGEX
+                if first:
+                    match_type = _MatchType.SUFFIX
             else:
                 regex += "[^/]*"
+                match_type = _MatchType.REGEX
         elif ch == "?":
             regex += "[^/]"
+            match_type = _MatchType.REGEX
         elif ch == "[":
             # Copy a bracket expression as is, a leading "^" negates it
             j = i
@@ -54,28 +79,43 @@ def _compile(pattern: str) -> "re.Pattern[str]":
                 j += 1
             regex += pattern[i - 1 : j + 1]
             i = j + 1
+            match_type = _MatchType.REGEX
+        elif ch == "]":
+            regex += ch
+            match_type = _MatchType.REGEX
         elif ch in _LITERAL_REGEX_CHARS:
             regex += "\\" + ch
         elif ch == "\\" and not _BACKSLASH_IS_SEPARATOR:
             # Escape the next character
             if i < n:
                 regex += re.escape(pattern[i])
                 i += 1
+                match_type = _MatchType.REGEX
             else:
                 regex += "\\\\"
         else:
             regex += ch
-    return re.compile(regex + "$")
+
+    if match_type is _MatchType.EXACT:
+        return lambda path: path == pattern
+    if match_type is _MatchType.PREFIX:
+        prefix = pattern[:-2]
+        return lambda path: path.startswith(prefix)
+    if match_type is _MatchType.SUFFIX:
+        suffix = pattern[2:]
+        # "**/foo" also matches "foo"
+        return lambda path: path.endswith(suffix) or (
+            suffix.startswith("/") and path == suffix[1:]
+        )
+    compiled = re.compile(regex + r"\Z")
+    return lambda path: compiled.match(path) is not None
 
 
 class _Pattern:
     def __init__(self, cleaned_pattern: str, exclusion: bool):
         self.exclusion = exclusion
         self.dirs = cleaned_pattern.split("/")
-        self._regex = _compile(cleaned_pattern)
-
-    def match(self, path: str) -> bool:
-        return self._regex.match(path) is not None
+        self.match = _compile(cleaned_pattern)
 
 
 class PatternMatcher:
@@ -110,26 +150,33 @@ def __init__(self, patterns: List[str]):
 
     def matches(self, path: str) -> bool:
         """
-        Whether the path or one of its parent directories is excluded.
+        Whether the path is excluded. Like BuildKit, the patterns are evaluated
+        on each parent directory first, and a pattern that matched a parent
+        directory also matches the paths under it.
 
         :param path: Slash-separated path relative to the context root
         :return: True if the path is excluded
         """
-        parent_path = posixpath.dirname(path)
-        parent_dirs = parent_path.split("/") if parent_path else []
-
+        segments = path.split("/")
+        parent_matched: List[bool] = []
         matched = False
-        for pattern in self._patterns:
-            # An inclusion can't change an already matched path, and an
-            # exclusion can't change a path that hasn't matched yet
-            if pattern.exclusion != matched:
-                continue
-            match = pattern.match(path) or any(
-                pattern.match("/".join(parent_dirs[: i + 1]))
-                for i in range(len(parent_dirs))
-            )
-            if match:
-                matched = not pattern.exclusion
+        for depth 
```

**File**: `packages/python-sdk/tests/shared/template/utils/test_get_all_files_in_path.py` (modified, +46/-0)
```diff
@@ -407,6 +407,35 @@ def test_should_reinclude_paths_matched_by_a_negated_pattern(self, test_dir):
             "src/node_modules/lib.js",
         ]
 
+    def test_should_not_reinclude_a_path_through_a_negated_parent_directory(
+        self, test_dir
+    ):
+        files = self.relative_paths(".", test_dir, ["src/app.ts", "**/*.js", "!src"])
+        assert "src/app.ts" not in files
+        assert "src/node_modules/lib.js" not in files
+        assert "src/app.spec.ts" in files
+
+    def test_should_match_a_leading_globstar_with_a_literal_suffix(self, test_dir):
+        for name in ["root.txt", "src/nested.txt", "keep.txt.bak"]:
+            with open(os.path.join(test_dir, name), "w") as f:
+                f.write("x")
+        files = self.relative_paths(".", test_dir, ["**.txt", "**/generated"])
+        assert "root.txt" not in files
+        assert "src/nested.txt" not in files
+        assert "src/generated/api.ts" not in files
+        assert "keep.txt.bak" in files
+
+    def test_should_match_characters_outside_the_bmp_as_a_single_character(
+        self, test_dir
+    ):
+        for name in ["😀.txt", "😀😀.txt"]:
+            with open(os.path.join(test_dir, name), "w") as f:
+                f.write("x")
+        files = self.relative_paths("*", test_dir, ["?.txt"])
+        assert "😀.txt" not in files
+        assert "😀😀.txt" in files
+        assert "😀😀.txt" not in self.relative_paths("*", test_dir, ["[😀]?.txt"])
+
     def test_should_make_absolute_patterns_inside_the_context_relative(self, test_dir):
         files = self.relative_paths(
             ".",
@@ -432,6 +461,23 @@ def test_should_raise_on_an_invalid_pattern(self, test_dir):
         with pytest.raises(TemplateException, match="Invalid ignore pattern '\\[abc'"):
             get_all_files_in_path(".", test_dir, ["[abc"])
 
+    @pytest.mark.skipif(sys.platform == "win32", reason="Backslash is a separator")
+    def test_should_handle_escapes_in_a_bracket_expression_like_python(self, test_dir):
+        with pytest.raises(
+            TemplateException, match=r"Invalid ignore pattern '\[\\q\]'"
+        ):
+            get_all_files_in_path(".", test_dir, ["[\\q]"])
+        with open(os.path.join(test_dir, "a"), "w") as f:
+            f.write("x")
+        assert "a" in self.relative_paths("*", test_dir, ["[\\a]"])
+        for name in ["b", "c"]:
+            with open(os.path.join(test_dir, name), "w") as f:
+                f.write("x")
+        files = self.relative_paths("*", test_dir, ["[\\x61]", "[\\142]"])
+        assert "a" not in files
+        assert "b" not in files
+        assert "c" in files
+
     def test_should_keep_the_files_hash_stable_when_ignored_files_change(
         self, test_dir
     ):
```

---

### Incident Patch 4: `a9d17ceb` (2026-10-02)
**Commit Message**: fix(deps): bump brace-expansion 1.x/2.x/3.x overrides to patched versions (CVE-2026-102276/77/78) (#1929)

## Summary

The Dependabot security-update job on `main`
([run](https://github.com/e2b-dev/E2B/actions/runs/36995679736/job/110801731144))
fails because the lockfile still pins vulnerable
`brace-expansion@1.1.18` (and `2.1.4`).
https://github.com/e2b-dev/E2B/pull/1928 only bumped the 5.x line; the
same advisories also cover the 1.x/2.x/3.x lines, and the pnpm override
floors (`^1.1.18`, `^2.1.4`) keep Dependabot from resolving a fix:

```
INFO The latest possible version of brace-expansion that can be installed is 1.1.18
INFO The earliest fixed version is 1.1.21.
| security_update_not_possible | "dependency-name": "brace-expansion", "latest-resolvable-version": "1.1.18", "lowest-non-vulnerable-version": "1.1.21" |
```

Raise every `brace-expansion` override floor to the first version
patched against all three advisories (GHSA-6j4f-fj2g-mc7p,
GHSA-qhr7-859c-m2p7, GHSA-q2hr-2g5m-vwhr):

```diff
-  brace-expansion@<1.1.18: ^1.1.18
-  brace-expansion@>=2.0.0 <2.1.4: ^2.1.4
-  brace-expansion@>=3.0.0 <3.0.6: ^3.0.6
-  brace-expansion@>=4.0.0 <5.0.11: ^5.0.11
+  brace-expansion@<1.1

**File**: `pnpm-lock.yaml` (modified, +12/-12)
```diff
@@ -36,10 +36,10 @@ overrides:
   postcss@<8.5.10: ^8.5.10
   vite@>=6.0.0 <6.4.3: ^6.4.3
   lodash@<4.18.0: ^4.18.0
-  brace-expansion@<1.1.18: ^1.1.18
-  brace-expansion@>=2.0.0 <2.1.4: ^2.1.4
-  brace-expansion@>=3.0.0 <3.0.6: ^3.0.6
-  brace-expansion@>=4.0.0 <5.0.11: ^5.0.11
+  brace-expansion@<1.1.21: ^1.1.21
+  brace-expansion@>=2.0.0 <2.1.7: ^2.1.7
+  brace-expansion@>=3.0.0 <3.0.9: ^3.0.9
+  brace-expansion@>=4.0.0 <5.0.12: ^5.0.12
   underscore@<1.13.8: ^1.13.8
   js-yaml@<3.15.2: ^3.15.2
   js-yaml@>=4.0.0 <4.3.2: ^4.3.2
@@ -2381,11 +2381,11 @@ packages:
     resolution: {integrity: sha512-2hCgjEmP8YLWQ130n2FerGv7rYpfBmnmp9Uy2Le1vge6X3gZIfSmEzP5QTDElFxcvVcXlEn8Aq6MU/PZygIOog==}
     engines: {node: '>=14.16'}
 
-  brace-expansion@1.1.18:
-    resolution: {integrity: sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==}
+  brace-expansion@1.1.21:
+    resolution: {integrity: sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==}
 
-  brace-expansion@2.1.4:
-    resolution: {integrity: sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==}
+  brace-expansion@2.1.7:
+    resolution: {integrity: sha512-uZbew1NqdmPDTMJ8ah1y+b+9QEJrfkXFk3RcTQw3X0jW/xRUvFKsg1CfQdSYGdTbXZWExtU3J3ccxtnfw1Fi0g==}
 
   brace-expansion@5.0.12:
     resolution: {integrity: sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==}
@@ -5872,12 +5872,12 @@ snapshots:
       widest-line: 4.0.1
       wrap-ansi: 8.1.0
 
-  brace-expansion@1.1.18:
+  brace-expansion@1.1.21:
     dependencies:
       balanced-match: 1.0.2
       concat-map: 0.0.1
 
-  brace-expansion@2.1.4:
+  brace-expansion@2.1.7:
     dependencies:
       balanced-match: 1.0.2
 
@@ -6863,11 +6863,11 @@ snapshots:
 
   minimatch@3.1.5:
     dependencies:
-      brace-expansion: 1.1.18
+      brace-expansion: 1.1.21
 
   minimatch@5.1.9:
     dependencies:
-      brace-expansion: 2.1.4
+      brace-expansion: 2.1.7
 
   minimist@1.2.8: {}
 
```

**File**: `pnpm-workspace.yaml` (modified, +4/-4)
```diff
@@ -15,10 +15,10 @@ overrides:
   postcss@<8.5.10: ^8.5.10
   vite@>=6.0.0 <6.4.3: ^6.4.3
   lodash@<4.18.0: ^4.18.0
-  brace-expansion@<1.1.18: ^1.1.18
-  brace-expansion@>=2.0.0 <2.1.4: ^2.1.4
-  brace-expansion@>=3.0.0 <3.0.6: ^3.0.6
-  brace-expansion@>=4.0.0 <5.0.11: ^5.0.11
+  brace-expansion@<1.1.21: ^1.1.21
+  brace-expansion@>=2.0.0 <2.1.7: ^2.1.7
+  brace-expansion@>=3.0.0 <3.0.9: ^3.0.9
+  brace-expansion@>=4.0.0 <5.0.12: ^5.0.12
   underscore@<1.13.8: ^1.13.8
   js-yaml@<3.15.2: ^3.15.2
   js-yaml@>=4.0.0 <4.3.2: ^4.3.2
```

---

### Incident Patch 5: `a9c58ab2` (2026-10-02)
**Commit Message**: fix(deps): CVE-2026-102276 (high) + CVE-2026-102278 (high) — bump brace-expansion override to ^5.0.11 (#1928)

## Summary

`pnpm audit` flags `brace-expansion@5.0.9`. The SDK pulls it in at
runtime through `e2b → glob → minimatch@10.2.5 → brace-expansion`.
`glob` is a runtime dependency of `packages/js-sdk`: `template/utils.ts`
dynamically imports it to expand user-supplied `Template.copy()` source
patterns, so published code can reach it.

| Advisory | Severity | Issue | Fixed in (5.x) |
|---|---|---|---|
| CVE-2026-102276 /
[GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p)
| high | DoS via uncontrolled recursion in `parseCommaParts` | 5.0.10 |
| CVE-2026-102278 /
[GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7)
| high | DoS via uncontrolled recursion on nested brace groups | 5.0.11
|
| CVE-2026-102277 /
[GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr)
| moderate | Quadratic-time `{a},b}` rewrite | 5.0.12 |

```diff
 # pnpm-workspace.yaml overrides
-  brace-expansion@>=4.0.0 <5.0.9: ^5.0.9
+  brace-expansion@>=4.0.0 <5.0.11: ^5.0.11
 # pnpm-lock.yaml
-brace-expansion 5.0.9
+brace-expansion 5.0.12
```

**One PR 

**File**: `pnpm-lock.yaml` (modified, +5/-5)
```diff
@@ -39,7 +39,7 @@ overrides:
   brace-expansion@<1.1.18: ^1.1.18
   brace-expansion@>=2.0.0 <2.1.4: ^2.1.4
   brace-expansion@>=3.0.0 <3.0.6: ^3.0.6
-  brace-expansion@>=4.0.0 <5.0.9: ^5.0.9
+  brace-expansion@>=4.0.0 <5.0.11: ^5.0.11
   underscore@<1.13.8: ^1.13.8
   js-yaml@<3.15.2: ^3.15.2
   js-yaml@>=4.0.0 <4.3.2: ^4.3.2
@@ -2387,8 +2387,8 @@ packages:
   brace-expansion@2.1.4:
     resolution: {integrity: sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==}
 
-  brace-expansion@5.0.9:
-    resolution: {integrity: sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==}
+  brace-expansion@5.0.12:
+    resolution: {integrity: sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==}
     engines: {node: 20 || >=22}
 
   braces@3.0.3:
@@ -5881,7 +5881,7 @@ snapshots:
     dependencies:
       balanced-match: 1.0.2
 
-  brace-expansion@5.0.9:
+  brace-expansion@5.0.12:
     dependencies:
       balanced-match: 4.0.4
 
@@ -6859,7 +6859,7 @@ snapshots:
 
   minimatch@10.2.5:
     dependencies:
-      brace-expansion: 5.0.9
+      brace-expansion: 5.0.12
 
   minimatch@3.1.5:
     dependencies:
```

**File**: `pnpm-workspace.yaml` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ overrides:
   brace-expansion@<1.1.18: ^1.1.18
   brace-expansion@>=2.0.0 <2.1.4: ^2.1.4
   brace-expansion@>=3.0.0 <3.0.6: ^3.0.6
-  brace-expansion@>=4.0.0 <5.0.9: ^5.0.9
+  brace-expansion@>=4.0.0 <5.0.11: ^5.0.11
   underscore@<1.13.8: ^1.13.8
   js-yaml@<3.15.2: ^3.15.2
   js-yaml@>=4.0.0 <4.3.2: ^4.3.2
```

---

### Incident Patch 6: `d0ed5c1f` (2026-10-01)
**Commit Message**: fix(js-sdk): treat WatchHandle.stop() as a clean watch end (#1923)

## Summary

Squashed version of community PR
https://github.com/e2b-dev/E2B/pull/1912 by @harshitgavita-07. Fixes
#1895.

`WatchHandle.stop()` aborts the watch stream. The abort surfaced as a
Connect cancellation, which was mapped to `TimeoutError` and passed to
`onExit`, so every user-initiated stop looked like a request timeout.
The handle now records the stop, and a stream error that arrives after
it ends the watch cleanly:

```ts
async stop() {
  this.stopped = true
  this.handleStop()
}

private async *iterateEvents() {
  try { for await (const event of this.events) ... }
  catch (err) {
    if (this.stopped) return
    throw await handleRpcErrorWithHealthCheck(err, this.checkHealth)
  }
}
```

The suppression covers only the stream iterator, so `onEvent` rejections
still reach `onExit`, including ones raised after `stop()`. After
`stop()`, `onExit` is called asynchronously with no argument, which
matches what async Python `AsyncWatchHandle.stop()` passes (#1480). This
is now documented in the JSDoc on `stop()` and `WatchOpts.onExit`.

Tests in `packages/js-sdk/tests/sandbox/files/watchHandle.test.ts` cover
th

**File**: `.changeset/watch-stop-clean-exit.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'e2b': patch
+---
+
+fix(js-sdk): treat `WatchHandle.stop()` as a clean watch end - `onExit` now fires with no error instead of a `TimeoutError` blaming `requestTimeoutMs`, matching the Python SDK behavior.
```

**File**: `packages/js-sdk/src/sandbox/filesystem/index.ts` (modified, +3/-0)
```diff
@@ -339,6 +339,9 @@ export interface WatchOpts extends FilesystemRequestOpts {
   timeoutMs?: number
   /**
    * Callback to call when the watch operation stops.
+   *
+   * `err` is `undefined` after {@link WatchHandle.stop} or a clean stream end,
+   * and is set only when the watch fails.
    */
   onExit?: (err?: Error) => void | Promise<void>
   /**
```

**File**: `packages/js-sdk/src/sandbox/filesystem/watchHandle.ts` (modified, +9/-0)
```diff
@@ -77,6 +77,8 @@ export interface FilesystemEvent {
  * Use {@link WatchHandle.stop} to stop watching the directory.
  */
 export class WatchHandle {
+  private stopped = false
+
   constructor(
     private readonly handleStop: () => void,
     private readonly events: AsyncIterable<WatchDirResponse>,
@@ -89,8 +91,11 @@ export class WatchHandle {
 
   /**
    * Stop watching the directory.
+   *
+   * `onExit` is then called asynchronously, with no error.
    */
   async stop() {
+    this.stopped = true
     this.handleStop()
   }
 
@@ -104,6 +109,10 @@ export class WatchHandle {
         }
       }
     } catch (err) {
+      // `stop()` aborts the stream, so a stream error after it is a clean end.
+      if (this.stopped) {
+        return
+      }
       throw await handleRpcErrorWithHealthCheck(err, this.checkHealth)
     }
   }
```

**File**: `packages/js-sdk/tests/sandbox/files/watchHandle.test.ts` (modified, +80/-0)
```diff
@@ -1,3 +1,4 @@
+import { Code, ConnectError } from '@connectrpc/connect'
 import { describe, expect, it, vi } from 'vitest'
 
 import { EventType } from '../../../src/envd/filesystem/filesystem_pb'
@@ -131,4 +132,83 @@ describe('WatchHandle', () => {
       expect(stopped).toBe(true)
     })
   })
+
+  it('calls onExit with no argument when the watch is stopped by the user', async () => {
+    // Simulates the transport: the stream stays open until `handleStop`
+    // aborts it, then surfaces the abort as a Connect cancellation (which
+    // `handleRpcError` would map to `TimeoutError`).
+    let abortStream: (() => void) | undefined
+    const stream = (async function* () {
+      await new Promise<never>((_, reject) => {
+        abortStream = () =>
+          reject(new ConnectError('This operation was aborted', Code.Canceled))
+      })
+    })()
+
+    let exitArgs: unknown[] | undefined
+
+    const handle = new WatchHandle(
+      () => abortStream?.(),
+      stream,
+      undefined,
+      (...args: unknown[]) => {
+        exitArgs = args
+      }
+    )
+
+    await handle.stop()
+
+    await vi.waitFor(() => {
+      expect(exitArgs).toBeDefined()
+    })
+    // A user-initiated stop is a clean end - no error is passed to onExit.
+    expect(exitArgs).toEqual([])
+  })
+
+  it('still reports stream errors when the watch was not stopped by the user', async () => {
+    const failure = new Error('stream broke')
+
+    const stream = (async function* () {
+      throw failure
+    })()
+
+    let exitArgs: unknown[] | undefined
+
+    new WatchHandle(
+      () => {},
+      stream,
+      undefined,
+      (...args: unknown[]) => {
+        exitArgs = args
+      }
+    )
+
+    await vi.waitFor(() => {
+      expect(exitArgs).toBeDefined()
+    })
+    expect(exitArgs).toEqual([failure])
+  })
+
+  it('still reports onEvent errors raised after the watch is stopped', async () => {
+    const failure = new Error('onEvent failed')
+    let handle: WatchHandle | undefined
+    let exitArgs: unknown[] | undefined
+
+    handle = new WatchHandle(
+      () => {},
+      events([filesystemEvent('a.txt')]),
+      async () => {
+        await handle?.stop()
+        throw failure
+      },
+      (...args: unknown[]) => {
+        exitArgs = args
+      }
+    )
+
+    await vi.waitFor(() => {
+      expect(exitArgs).toBeDefined()
+    })
+    expect(exitArgs).toEqual([failure])
+  })
 })
```

---

### Incident Patch 7: `3ba1d05e` (2026-10-01)
**Commit Message**: fix(sdk): retry 502 only for replayable operations, stop replaying secret updates (#1924)

## Summary

Follow-up to https://github.com/e2b-dev/E2B/pull/1888, addressing its
two Devin Review findings.

**1. A 502 retry could create a second sandbox (or other resource).**
#1888 assumed that 502/503 always mean the request was rejected before
it was processed. In belt that holds for 503: placement/busy errors
happen before anything is created, or after a synchronous rollback. It
does not hold for 502:
- The API's sandbox handlers never return 502, so for `POST /sandboxes`
a 502 comes from the load balancer or proxy in front of the API. That
can happen after the backend already created the sandbox.
- `secrets.go` `sendSecretsBackendResponseError` returns 502 *after* the
secret-manager call succeeded.

A 502 is now gated by the same `isReplayable` / `is_replayable`
allowlist that #1888 introduced for post-write network errors:

```
status ∉ {429, 502, 503}               → return response
502 and !isReplayable(request)         → return response        (new)
Retry-After (delta-seconds)            → wait that long
429 without Retry-After                → return response
502/503 without Ret

**File**: `.changeset/python-retry-bad-gateway-replayable.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@e2b/python-sdk": patch
+---
+
+Retry a `502` response only for operations that are safe to replay: a gateway may answer `502` after the API already processed the request, so a `502` from sandbox creation, fork, snapshot or another resource-creating `POST` is returned instead of being retried (which could create a duplicate). `503` is still retried for every operation. Secret updates (`POST /secrets/{id}`) are no longer replayed after a `502` or a dropped connection, as each update appends a new version.
```

**File**: `.changeset/retry-bad-gateway-replayable.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"e2b": patch
+---
+
+Retry a `502` response only for operations that are safe to replay: a gateway may answer `502` after the API already processed the request, so a `502` from sandbox creation, fork, snapshot or another resource-creating `POST` is returned instead of being retried (which could create a duplicate). `503` is still retried for every operation. Secret updates (`POST /secrets/{id}`) are no longer replayed after a `502` or a dropped connection, as each update appends a new version.
```

**File**: `packages/js-sdk/src/connectionConfig.ts` (modified, +4/-2)
```diff
@@ -88,8 +88,10 @@ export interface ConnectionOpts {
    * Number of control-plane API retries after a 429, 502 or 503 response or
    * a failure to establish the connection (refused, DNS, unreachable host).
    * Any other network error (dropped connection, opaque browser/Workers
-   * `TypeError`) is retried too, except for operations that create a resource
-   * (e.g. sandbox creation), as the server may already have processed them.
+   * `TypeError`) is retried too. A 502 and those network errors are not
+   * retried for operations that create a resource (e.g. sandbox creation) or
+   * append to one (secret update), as the server may already have processed
+   * them.
    * A 429 is retried only with a valid, non-negative integer delta-seconds
    * `Retry-After` header (HTTP-date and malformed values are not retried).
    * 502 and 503 honor such a `Retry-After` when present; otherwise they and
```

**File**: `packages/js-sdk/src/retry.ts` (modified, +18/-14)
```diff
@@ -26,12 +26,13 @@ const CONNECTION_ERROR_SYSCALLS = new Set(['connect', 'getaddrinfo'])
 // Deno reports hyper's connect-phase failures as `client error (Connect)`.
 const DENO_CONNECTION_ERROR = /client error \(Connect\)/
 // GET/PUT/PATCH/DELETE are idempotent by HTTP semantics. A POST is retried
-// after a network error that may have occurred once the request was written
-// only if it is listed here: a replay is a no-op or fails with a 404/409 the
-// SDK already tolerates. POSTs that mint a resource without a client-supplied
-// idempotency key (sandbox/fork/snapshot/API-key/volume/secret/webhook
-// creation) must stay off the list — a replay could create a duplicate — and
-// so does any new POST until it is reviewed. Connection-establishment failures
+// after a 502 or a network error that may have occurred once the request was
+// written only if it is listed here: a replay is a no-op or fails with a
+// 404/409 the SDK already tolerates. POSTs that mint a resource without a
+// client-supplied idempotency key (sandbox/fork/snapshot/API-key/volume/secret/
+// webhook creation) or append to one (secret update) must stay off the list —
+// a replay could create a duplicate — and so does any new POST until it is
+// reviewed. Connection-establishment failures
 // are retried for every operation regardless: the request never left.
 const REPLAYABLE_METHODS = new Set(['GET', 'PUT', 'PATCH', 'DELETE'])
 const REPLAYABLE_OPERATIONS: [method: string, path: RegExp][] = [
@@ -42,7 +43,6 @@ const REPLAYABLE_OPERATIONS: [method: string, path: RegExp][] = [
   ['POST', /^\/templates\/tags$/],
   ['POST', /^\/nodes\/[^/]+$/],
   ['POST', /^\/admin\/teams\/[^/]+\/(sandboxes\/kill|builds\/cancel)$/],
-  ['POST', /^\/secrets\/[^/]+$/],
 ]
 
 export function resolveRetries(retries: number): number {
@@ -90,8 +90,8 @@ export function isConnectionError(error: unknown, depth = 0): boolean {
 }
 
 /**
- * Whether `request` may be sent again after a network error that may have
- * occurred once the request was written (see `REPLAYABLE_OPERATIONS`).
+ * Whether `request` may be sent again after a 502 or a network error that may
+ * have occurred once the request was written (see `REPLAYABLE_OPERATIONS`).
  */
 export function isReplayable(request: Request): boolean {
   if (REPLAYABLE_METHODS.has(request.method)) return true
@@ -150,14 +150,17 @@ function backoffMs(attempt: number, random: () => number): number {
  * Delay before the next attempt, or `undefined` when the response is not
  * retried: `Retry-After` when the server sends a usable one, otherwise
  * exponential backoff with jitter for 502/503. A 429 without `Retry-After`
- * is not retried.
+ * is not retried, nor is a 502 for a non-replayable request: a gateway may
+ * answer 502 after the backend already processed it.
  */
 function retryDelayMs(
   response: Response,
   attempt: number,
+  replayable: boolean,
   random: () => number
 ): number | undefined {
   if (!RETRYABLE_STATUSES.has(response.status)) return undefined
+  if (response.status === 502 && !replayable) return undefined
 
   const retryAfter = parseRetryAfter(response.headers.get('Retry-After'))
   if (retryAfter !== undefined) return retryAfter * 1000
@@ -167,9 +170,10 @@ function retryDelayMs(
 }
 
 /**
- * Retry replayable requests after a 429 carrying `Retry-After`, a 502/503
- * (using `Retry-After` when present, exponential backoff otherwise) or a
- * network failure (exponential backoff; see {@link isRetryableFetchError}).
+ * Retry requests after a 429 carrying `Retry-After`, a 503 or — for replayable
+ * requests ({@link isReplayable}) — a 502 (using `Retry-After` when present,
+ * exponential backoff otherwise), or a network failure (exponential backoff;
+ * see {@link isRetryableFetchError}).
  */
 export function withRetry(
   fetchImpl: typeof fetch,
@@ -223,7 +227,7 @@ export function withRetry(
       }
       if (attempt === retries) return response
 
-      const delayMs = retryDelayMs(response, attempt, random)
+      const delayMs = retryDelayMs(response, attempt, replayable, random)
       if (delayMs === undefined || monotonic() + delayMs >= deadline) {
         return response
       }
```

**File**: `packages/js-sdk/tests/retry.test.ts` (modified, +42/-1)
```diff
@@ -213,6 +213,47 @@ test.each([502, 503])(
   }
 )
 
+test.each([
+  ['POST', '/sandboxes', 1],
+  ['POST', '/secrets/secret-1', 1],
+  ['POST', '/sandboxes/sbx-1/pause', 2],
+  ['GET', '/sandboxes', 2],
+])('a 502 for %s %s is attempted %i time(s)', async (method, path, calls) => {
+  const statuses = [502, 200]
+  const fetchImpl = vi.fn(
+    async () => new Response(null, { status: statuses.shift() })
+  ) as typeof fetch
+  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
+    monotonic: () => 0,
+    sleep: async () => {},
+  })
+
+  const response = await fetchWithRetry(`https://api.e2b.test${path}`, {
+    method,
+  })
+
+  expect(response.status).toBe(calls === 1 ? 502 : 200)
+  expect(fetchImpl).toHaveBeenCalledTimes(calls)
+})
+
+test('retries a 503 for a non-replayable POST', async () => {
+  const statuses = [503, 200]
+  const fetchImpl = vi.fn(
+    async () => new Response(null, { status: statuses.shift() })
+  ) as typeof fetch
+  const fetchWithRetry = withRetry(fetchImpl, 3, 60_000, {
+    monotonic: () => 0,
+    sleep: async () => {},
+  })
+
+  const response = await fetchWithRetry('https://api.e2b.test/sandboxes', {
+    method: 'POST',
+  })
+
+  expect(response.status).toBe(200)
+  expect(fetchImpl).toHaveBeenCalledTimes(2)
+})
+
 test('caps the backoff for long retry sequences', async () => {
   const fetchImpl = vi.fn(
     async () => new Response(null, { status: 503 })
@@ -496,6 +537,7 @@ const nonReplayable = [
   ['POST', '/admin/teams/team-1/api-keys'],
   ['POST', '/volumes'],
   ['POST', '/secrets'],
+  ['POST', '/secrets/secret-1'],
   ['POST', '/events/webhooks'],
   // POSTs not on the allowlist: unknown and near-miss paths
   ['POST', '/sandboxes/sbx-1/pause/extra'],
@@ -523,7 +565,6 @@ const replayable = [
   ['POST', '/nodes/node-1'],
   ['POST', '/admin/teams/team-1/sandboxes/kill'],
   ['POST', '/admin/teams/team-1/builds/cancel'],
-  ['POST', '/secrets/secret-1'],
   ['DELETE', '/volumes/vol-1'],
   ['PATCH', '/events/webhooks/hook-1'],
 ]
```

**File**: `packages/python-sdk/e2b/connection_config.py` (modified, +4/-3)
```diff
@@ -71,9 +71,10 @@ class ApiParams(TypedDict, total=False):
 
     retries: Optional[int]
     """Number of control-plane HTTP retries after a 429, 502 or 503 response or
-    a network error once the request was written (dropped connection). The
-    latter is not retried for operations that create a resource (e.g. sandbox
-    creation), as the server may already have processed them; failures to
+    a network error once the request was written (dropped connection). A 502
+    and such network errors are not retried for operations that create a
+    resource (e.g. sandbox creation) or append to one (secret update), as the
+    server may already have processed them; failures to
     establish the connection are retried separately for every operation, see
     ``E2B_CONNECTION_RETRIES``.
     A 429 is retried only with a valid, non-negative integer delta-seconds
```

**File**: `packages/python-sdk/e2b/retry.py` (modified, +23/-16)
```diff
@@ -16,12 +16,13 @@
 RETRYABLE_STATUSES = frozenset({429, 502, 503})
 
 # GET/PUT/PATCH/DELETE are idempotent by HTTP semantics. A POST is retried
-# after a network error that may have occurred once the request was written
-# only if it is listed here: a replay is a no-op or fails with a 404/409 the
-# SDK already tolerates. POSTs that mint a resource without a client-supplied
-# idempotency key (sandbox/fork/snapshot/API-key/volume/secret/webhook
-# creation) must stay off the list — a replay could create a duplicate — and
-# so does any new POST until it is reviewed. (Connection-establishment
+# after a 502 or a network error that may have occurred once the request was
+# written only if it is listed here: a replay is a no-op or fails with a
+# 404/409 the SDK already tolerates. POSTs that mint a resource without a
+# client-supplied idempotency key (sandbox/fork/snapshot/API-key/volume/secret/
+# webhook creation) or append to one (secret update) must stay off the list —
+# a replay could create a duplicate — and so does any new POST until it is
+# reviewed. (Connection-establishment
 # failures are retried for every operation by ``ConnectionRetryTransport``
 # underneath: the request never left.)
 REPLAYABLE_METHODS = frozenset({"GET", "PUT", "PATCH", "DELETE"})
@@ -33,7 +34,6 @@
     ("POST", re.compile(r"^/templates/tags$")),
     ("POST", re.compile(r"^/nodes/[^/]+$")),
     ("POST", re.compile(r"^/admin/teams/[^/]+/(sandboxes/kill|builds/cancel)$")),
-    ("POST", re.compile(r"^/secrets/[^/]+$")),
 ]
 
 # Raised by the pyqwest httpx adapter once the request was (at least partially)
@@ -63,8 +63,8 @@ def parse_retry_after(value: Optional[str]) -> Optional[int]:
 
 
 def is_replayable(request: httpx.Request) -> bool:
-    """Whether ``request`` may be sent again after a network error that may
-    have occurred once it was written (see ``REPLAYABLE_OPERATIONS``)."""
+    """Whether ``request`` may be sent again after a 502 or a network error
+    that may have occurred once it was written (see ``REPLAYABLE_OPERATIONS``)."""
     if request.method in REPLAYABLE_METHODS:
         return True
     path = request.url.path
@@ -80,14 +80,20 @@ def _backoff_delay(attempt: int, random_: Callable[[], float]) -> float:
 
 
 def _retry_delay(
-    response: httpx.Response, attempt: int, random_: Callable[[], float]
+    response: httpx.Response,
+    attempt: int,
+    replayable: bool,
+    random_: Callable[[], float],
 ) -> Optional[float]:
     """Delay before the next attempt, or ``None`` when the response is not
     retried: ``Retry-After`` when the server sends a usable one, otherwise
     exponential backoff with jitter for 502/503. A 429 without ``Retry-After``
-    is not retried."""
+    is not retried, nor is a 502 for a non-replayable request: a gateway may
+    answer 502 after the backend already processed it."""
     if response.status_code not in RETRYABLE_STATUSES:
         return None
+    if response.status_code == 502 and not replayable:
+        return None
 
     retry_after = parse_retry_after(response.headers.get("Retry-After"))
     if retry_after is not None:
@@ -133,9 +139,10 @@ def _request_deadline(request: httpx.Request, monotonic: Callable[[], float]) ->
 
 
 class RetryableTransport(httpx.BaseTransport):
-    """Retry replayable requests after a 429 carrying ``Retry-After`` or a
-    502/503 (using ``Retry-After`` when present, exponential backoff
-    otherwise), and — for replayable operations (``is_replayable``) — after a network error once the request was written."""
+    """Retry requests after a 429 carrying ``Retry-After`` or a 503, and — for
+    replayable operations (``is_replayable``) — after a 502 (using
+    ``Retry-After`` when present, exponential backoff otherwise) or a network
+    error once the request was written."""
 
     def __init__(
         self,
@@ -186,7 +193,7 @@ def handle_request(self, request: httpx.Request) -> httpx.Response:
             if attempt == self.retries:
                 return response
 
-            delay = _retry_delay(response, attempt, self._random)
+            delay = _retry_delay(response, attempt, replayable, self._random)
             if delay is None or self._monotonic() + delay >= deadline:
                 return response
 
@@ -252,7 +259,7 @@ async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
             if attempt == self.retries:
                 return response
 
-            delay = _retry_delay(response, attempt, self._random)
+            delay = _retry_delay(response, attempt, replayable, self._random)
             if delay is None or self._monotonic() + delay >= deadline:
                 return response
 
```

**File**: `packages/python-sdk/tests/test_rate_limit_retry_transport.py` (modified, +66/-3)
```diff
@@ -180,7 +180,9 @@ def test_retries_unavailable_status_with_exponential_backoff_and_jitter(status):
     inner = FakeTransport([status, status, status, 200], retry_after=None)
     sleeps = []
     randoms = iter([0.0, 1.0, 0.5])
-    request = httpx.Request("POST", "https://api.test", content=b"payload")
+    request = httpx.Request(
+        "POST", "https://api.test/sandboxes/sbx-1/pause", content=b"payload"
+    )
 
     response = RetryableTransport(
         inner,
@@ -196,6 +198,37 @@ def test_retries_unavailable_status_with_exponential_backoff_and_jitter(status):
     assert all(item.is_closed for item in inner.responses[:-1])
 
 
+@pytest.mark.parametrize(
+    ("method", "path", "attempts"),
+    [
+        ("POST", "/sandboxes", 1),
+        ("POST", "/secrets/secret-1", 1),
+        ("POST", "/sandboxes/sbx-1/pause", 2),
+        ("GET", "/sandboxes", 2),
+    ],
+)
+def test_bad_gateway_is_retried_only_for_replayable_operations(method, path, attempts):
+    inner = FakeTransport([502, 200], retry_after=None)
+
+    response = RetryableTransport(
+        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
+    ).handle_request(httpx.Request(method, f"https://api.test{path}", content=b"p"))
+
+    assert response.status_code == (502 if attempts == 1 else 200)
+    assert len(inner.requests) == attempts
+
+
+def test_service_unavailable_is_retried_for_non_replayable_operation():
+    inner = FakeTransport([503, 200], retry_after=None)
+
+    response = RetryableTransport(
+        inner, retries=3, sleep=lambda _: None, monotonic=lambda: 0.0
+    ).handle_request(httpx.Request("POST", "https://api.test/sandboxes", content=b"p"))
+
+    assert response.status_code == 200
+    assert len(inner.requests) == 2
+
+
 def test_backoff_is_capped_for_long_retry_sequences():
     inner = FakeTransport([503] * 9, retry_after=None)
     sleeps = []
@@ -410,6 +443,7 @@ def test_close_leaves_cached_transport_open():
     ("POST", "/admin/teams/team-1/api-keys"),
     ("POST", "/volumes"),
     ("POST", "/secrets"),
+    ("POST", "/secrets/secret-1"),
     ("POST", "/events/webhooks"),
     # POSTs not on the allowlist: unknown and near-miss paths
     ("POST", "/sandboxes/sbx-1/pause/extra"),
@@ -437,7 +471,6 @@ def test_close_leaves_cached_transport_open():
     ("POST", "/nodes/node-1"),
     ("POST", "/admin/teams/team-1/sandboxes/kill"),
     ("POST", "/admin/teams/team-1/builds/cancel"),
-    ("POST", "/secrets/secret-1"),
     ("DELETE", "/volumes/vol-1"),
     ("PATCH", "/events/webhooks/hook-1"),
 ]
@@ -627,7 +660,9 @@ async def sleep(delay):
         monotonic=lambda: 0.0,
         random_=lambda: next(randoms),
     ).handle_async_request(
-        httpx.Request("POST", "https://api.test", content=b"payload")
+        httpx.Request(
+            "POST", "https://api.test/sandboxes/sbx-1/pause", content=b"payload"
+        )
     )
 
     assert response.status_code == 200
@@ -636,6 +671,34 @@ async def sleep(delay):
     assert all(item.is_closed for item in inner.responses[:-1])
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    ("method", "path", "attempts"),
+    [
+        ("POST", "/sandboxes", 1),
+        ("POST", "/secrets/secret-1", 1),
+        ("POST", "/sandboxes/sbx-1/pause", 2),
+        ("GET", "/sandboxes", 2),
+    ],
+)
+async def test_async_bad_gateway_is_retried_only_for_replayable_operations(
+    method, path, attempts
+):
+    inner = FakeAsyncTransport([502, 200], retry_after=None)
+
+    async def sleep(_):
+        pass
+
+    response = await AsyncRetryableTransport(
+        inner, retries=3, sleep=sleep, monotonic=lambda: 0.0
+    ).handle_async_request(
+        httpx.Request(method, f"https://api.test{path}", content=b"p")
+    )
+
+    assert response.status_code == (502 if attempts == 1 else 200)
+    assert len(inner.requests) == attempts
+
+
 @pytest.mark.asyncio
 @pytest.mark.parametrize("status", [400, 404, 500, 504])
 async def test_async_does_not_retry_other_status_codes(status):
```

---

### Incident Patch 8: `4065e93b` (2026-10-01)
**Commit Message**: fix(deps): CVE-2026-97687 (high) + CVE-2026-97689 (high) — bump urllib3 to 2.8.0 in desktop-python (#1921)

## Summary

`pip-audit` on `packages/desktop-python/uv.lock` flags `urllib3==2.7.0`,
which comes in through the `e2b-desktop` runtime dependency `requests`
(`e2b-desktop → requests → urllib3`):

| Advisory | Severity | Issue |
|---|---|---|
| CVE-2026-97687 /
[GHSA-8988-9cw3-xx77](https://github.com/advisories/GHSA-8988-9cw3-xx77)
| high | HTTPS proxy TLS configuration may be ignored or overridden |
| CVE-2026-97689 /
[GHSA-vxq7-64xx-v4gw](https://github.com/advisories/GHSA-vxq7-64xx-v4gw)
| high | `HTTPResponse.stream()`/`read_chunked()` reads an unbounded
chunk-size line into memory |
| CVE-2026-97688 /
[GHSA-gh4c-6fx4-qh6g](https://github.com/advisories/GHSA-gh4c-6fx4-qh6g)
| medium | Chunked Deflate streaming can loop forever |

All three are fixed only in `urllib3 2.8.0` (published 2026-09-15).
Since the fix is the same version bump, one PR covers both high CVEs
(plus the medium) instead of two identical PRs.

```diff
 # packages/desktop-python/pyproject.toml
 dependencies = [
     "requests>=2.32.3,<3",
+    "urllib3>=2.8.0,<3",
 ]
 # packages/desktop-python/uv.lock
-ur

**File**: `.changeset/desktop-python-urllib3-floor.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@e2b/desktop-python": patch
+---
+
+Require `urllib3>=2.8.0` so installs pick up the fixes for CVE-2026-97687 (HTTPS proxy TLS configuration ignored) and CVE-2026-97689 (unbounded chunk-size line buffering).
```

**File**: `packages/desktop-python/pyproject.toml` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ requires-python = ">=3.10"
 dependencies = [
     "e2b>=2.44.0,<3.0.0",
     "requests>=2.32.3,<3",
+    "urllib3>=2.8.0,<3",
     "pillow>=12.0.0,<13",
 ]
 
```

**File**: `packages/desktop-python/uv.lock` (modified, +5/-3)
```diff
@@ -431,6 +431,7 @@ dependencies = [
     { name = "e2b" },
     { name = "pillow" },
     { name = "requests" },
+    { name = "urllib3" },
 ]
 
 [package.dev-dependencies]
@@ -448,6 +449,7 @@ requires-dist = [
     { name = "e2b", editable = "../python-sdk" },
     { name = "pillow", specifier = ">=12.0.0,<13" },
     { name = "requests", specifier = ">=2.32.3,<3" },
+    { name = "urllib3", specifier = ">=2.8.0,<3" },
 ]
 
 [package.metadata.requires-dev]
@@ -1625,11 +1627,11 @@ wheels = [
 
 [[package]]
 name = "urllib3"
-version = "2.7.0"
+version = "2.8.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/53/0c/06f8b233b8fd13b9e5ee11424ef85419ba0d8ba0b3138bf360be2ff56953/urllib3-2.7.0.tar.gz", hash = "sha256:231e0ec3b63ceb14667c67be60f2f2c40a518cb38b03af60abc813da26505f4c", size = 433602, upload-time = "2026-05-07T16:13:18.596Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/e3/05/b17359e1cefb4f909b5e40b1b90a496d987258916dbbf88e842c729f510e/urllib3-2.8.0.tar.gz", hash = "sha256:63bf2ead4c879426ebf22ef2a781eeb4aa3b4ae798a0435506f8687fd5bb9b63", size = 458972, upload-time = "2026-09-15T19:29:36.253Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/7f/3e/5db95bcf282c52709639744ca2a8b149baccf648e39c8cc87553df9eae0c/urllib3-2.7.0-py3-none-any.whl", hash = "sha256:9fb4c81ebbb1ce9531cce37674bbc6f1360472bc18ca9a553ede278ef7276897", size = 131087, upload-time = "2026-05-07T16:13:17.151Z" },
+    { url = "https://files.pythonhosted.org/packages/92/9d/c4e665119135114480843e7ab388fa94d8480650450e6f8e26b70d323a4c/urllib3-2.8.0-py3-none-any.whl", hash = "sha256:0cf3cae568d36aa9576b28dfb35f11328f1cb974ca7647d9475ebb86c75ac6e3", size = 135717, upload-time = "2026-09-15T19:29:34.577Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 9: `03887ad7` (2026-09-30)
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
+      // An inclusion can't change an already matched path, and an
+      // exclusion can't change a path that hasn't matched yet
+      if (pattern.exclusion !== matched) {
+        continue
+      }
+      const match =
+        pattern.regex.test(p) ||
+        parentDirs.some((_, i) =>
+          pattern.regex.test(parentDirs.slice(0, i + 1).join('/'))
+        )
+      if (match) {
+        matched = !pattern.exclusion
+      }
+    }
+    return matched
+  }
+
+  /**
+   * Whether a `!` pattern could re-include a path under the directory,
+   * in which case an excluded directory must still be walked.
+   *
+   * @param dirPath Slash-separated directory path relative to the context root
+   * @returns True if a path under the directory could be re-included
+   */
+  mayMatchUnder(dirPath: string): boolean {
+    const dirSegments = dirPath.split('/')
+    return this.patterns.some(
+      (pattern) =>
+        pattern.exclusion && patternMayMatchUnder(pattern, dirSegments)
+    )
+  }
+}
+
+function
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
+      let parent = path.posix.dirname(relativePath);
+      parent !== '.' && parent !== '/';
+      parent = path.posix.dirname(parent)
+    ) {
+      if (walkedDirs.has(parent)) {
+        return true
+      }
+    }
+    return false
+  }
+
   for (const file of globFiles) {
+    if (isUnderWalkedDir(file.relativePosix())) {
+      continue
+    }
     if (file.isDirectory()) {
+      walkedDirs.add(file.relativePosix())
       // For directories, add the directory itself and all files inside it
       if (includeDirectories) {
         files.set(file.fullpath(), file)
@@ -166,7 +252,7 @@ export async function getAllFilesInPath(
         path.join(file.relative() || '.', '**/*')
       )
       const dirFiles = await glob(dirPattern, {
-        ignore: ignorePatterns,
+        ignore,
         withFileTypes: true,
         dot: true,
         cwd: contextPath,
@@ -194,7 +280,7 @@ export async function getAllFilesInPath(
  * @param src Source path pattern for files to copy
  * @param dest Destination path where fi
```

**File**: `packages/js-sdk/tests/template/utils/getAllFilesInPath.test.ts` (modified, +190/-4)
```diff
@@ -1,8 +1,12 @@
 import { expect, test, describe, beforeAll, afterAll, beforeEach } from 'vitest'
-import { writeFile, mkdir, mkdtemp, rm } from 'fs/promises'
+import { appendFile, writeFile, mkdir, mkdtemp, rm, symlink } from 'fs/promises'
 import { tmpdir } from 'os'
-import { join, basename } from 'path'
-import { getAllFilesInPath } from '../../../src/template/utils'
+import { join, basename, relative } from 'path'
+import {
+  calculateFilesHash,
+  getAllFilesInPath,
+  readDockerignore,
+} from '../../../src/template/utils'
 
 describe('getAllFilesInPath', () => {
   // A temp directory, so a test run never writes into the repository tree.
@@ -320,10 +324,192 @@ describe('getAllFilesInPath', () => {
       '**/*.spec.*',
     ])
 
-    expect(files).toHaveLength(6) // 3 files + 3 directories (src, components, utils)
+    // 3 files + 4 directories (src, components, utils and the emptied tests,
+    // since `tests/**` matches the contents of `tests`, as in Docker)
+    expect(files).toHaveLength(7)
     expect(files.some((f) => f.fullpath().endsWith('index.ts'))).toBe(true)
     expect(files.some((f) => f.fullpath().endsWith('Button.tsx'))).toBe(true)
     expect(files.some((f) => f.fullpath().endsWith('helper.ts'))).toBe(true)
     expect(files.some((f) => f.fullpath().endsWith('test.spec.ts'))).toBe(false)
   })
+
+  describe('.dockerignore semantics', () => {
+    const relativePaths = async (src: string, ignorePatterns: string[]) =>
+      (await getAllFilesInPath(src, testDir, ignorePatterns))
+        .map((f) => relative(testDir, f.fullpath()).replace(/\\/g, '/') || '.')
+        .sort()
+
+    beforeEach(async () => {
+      await mkdir(join(testDir, 'node_modules', 'pkg'), { recursive: true })
+      await mkdir(join(testDir, 'src', 'generated'), { recursive: true })
+      await mkdir(join(testDir, 'src', 'node_modules'), { recursive: true })
+      await mkdir(join(testDir, '.git'), { recursive: true })
+      await writeFile(join(testDir, '.env'), 'SECRET=1')
+      await writeFile(join(testDir, 'node_modules', 'pkg', 'index.js'), 'x')
+      await writeFile(join(testDir, 'src', 'app.ts'), 'x')
+      await writeFile(join(testDir, 'src', 'app.spec.ts'), 'x')
+      await writeFile(join(testDir, 'src', 'generated', 'api.ts'), 'x')
+      await writeFile(join(testDir, 'src', 'node_modules', 'lib.js'), 'x')
+      await writeFile(join(testDir, '.git', 'HEAD'), 'ref')
+    })
+
+    const patterns = [
+      '.env',
+      'node_modules',
+      '.git',
+      '**/*.spec.*',
+      'src/generated',
+    ]
+
+    test.each(['.', './', './src', 'src', 'src/.', 'src/../src'])(
+      'should exclude ignored directories with their contents for %s',
+      async (src) => {
+        const files = await relativePaths(src, patterns)
+        const expected = [
+          'src',
+          'src/app.ts',
+          'src/node_modules',
+          'src/node_modules/lib.js',
+        ]
+        const copiesRoot = src === '.' || src === './'
+        expect(files).toEqual(copiesRoot ? ['.', ...expected] : expected)
+      }
+    )
+
+    test('should ignore a leading slash and a trailing slash', async () => {
+      const files = await relativePaths('.', [
+        '/node_modules',
+        '/.git/',
+        'src/',
+      ])
+      expect(files).toEqual(['.', '.env'])
+    })
+
+    test('should never exclude the context root', async () => {
+      const files = await relativePaths('.', ['.', '.*', 'src', 'node_modules'])
+      expect(files).toEqual(['.'])
+    })
+
+    test('should not copy paths inside an ignored directory', async () => {
+      const files = await relativePaths('node_modules/pkg', ['node_modules'])
+      expect(files).toEqual([])
+    })
+
+    test('should re-include paths matched by a negated pattern', async () => {
+      const files = await relativePaths('.', [
+        '*',
+        '!src',
+        'src/generated',
+        '!node_modules/pkg/index.js',
+      ])
+      expect(files).toEqual([
+        '.',
+        'node_modules/pkg/index.js',
+        'src',
+        'src/app.spec.ts',
+        'src/app.ts',
+        'src/node_modules',
+        'src/node_modules/lib.js',
+      ])
+    })
+
+    test('should make absolute patterns inside the context relative', async () => {
+      const files = await relativePaths('.', [
+        join(testDir, 'src'),
+        join(testDir, 'node_modules', '**'),
+        '.git',
+      ])
+      expect(files).toEqual(['.', '.env', 'node_modules'])
+    })
+
+    test('should match regex special characters literally', async () => {
+      await writeFile(join(testDir, 'file (1).txt'), 'x')
+      await writeFile(join(testDir, 'c++'), 'x')
+      await writeFile(join(testDir, 'a'), 'x')
+      const files = await relativePaths('*', ['file (1).txt', 'c++', 'a|b'])
+      expect(files).not.toContain('file (1).txt')
+      expect(files).not.toContain('c++')
+      expect(files).toContain('a')
+    })
+
+    test('should throw on an invalid pa
```

**File**: `packages/python-sdk/e2b/template/dockerignore.py` (added, +159/-0)
```diff
@@ -0,0 +1,159 @@
+"""
+Matching of `.dockerignore` patterns, following the semantics Docker uses to
+filter the build context.
+
+Port of the pattern matcher from moby/patternmatcher (Apache-2.0):
+https://github.com/moby/patternmatcher
+"""
+
+import os
+import posixpath
+import re
+from typing import List
+
+from e2b.exceptions import TemplateException
+
+# Characters that have a meaning in a regex but not in a Docker pattern
+_LITERAL_REGEX_CHARS = set(".+()|{}$^")
+_WILDCARD_CHARS = re.compile(r"[*?\[\\]")
+_BACKSLASH_IS_SEPARATOR = os.sep == "\\"
+
+
+def _clean(pattern: str) -> str:
+    # Equivalent of Go's filepath.Clean followed by filepath.ToSlash
+    if _BACKSLASH_IS_SEPARATOR:
+        pattern = pattern.replace("\\", "/")
+    return posixpath.normpath(re.sub("/+", "/", pattern))
+
+
+def _compile(pattern: str) -> "re.Pattern[str]":
+    regex = "^"
+    i, n = 0, len(pattern)
+    while i < n:
+        ch = pattern[i]
+        i += 1
+        if ch == "*":
+            if i < n and pattern[i] == "*":
+                i += 1
+                # Treat "**/" as "**"
+                if i < n and pattern[i] == "/":
+                    i += 1
+                regex += ".*" if i >= n else "(.*/)?"
+            else:
+                regex += "[^/]*"
+        elif ch == "?":
+            regex += "[^/]"
+        elif ch == "[":
+            # Copy a bracket expression as is, a leading "^" negates it
+            j = i
+            if j < n and pattern[j] == "^":
+                j += 1
+            while j < n and pattern[j] != "]":
+                if pattern[j] == "\\" and not _BACKSLASH_IS_SEPARATOR:
+                    j += 1
+                j += 1
+            regex += pattern[i - 1 : j + 1]
+            i = j + 1
+        elif ch in _LITERAL_REGEX_CHARS:
+            regex += "\\" + ch
+        elif ch == "\\" and not _BACKSLASH_IS_SEPARATOR:
+            # Escape the next character
+            if i < n:
+                regex += re.escape(pattern[i])
+                i += 1
+            else:
+                regex += "\\\\"
+        else:
+            regex += ch
+    return re.compile(regex + "$")
+
+
+class _Pattern:
+    def __init__(self, cleaned_pattern: str, exclusion: bool):
+        self.exclusion = exclusion
+        self.dirs = cleaned_pattern.split("/")
+        self._regex = _compile(cleaned_pattern)
+
+    def match(self, path: str) -> bool:
+        return self._regex.match(path) is not None
+
+
+class PatternMatcher:
+    """
+    Match paths relative to the context root against `.dockerignore` patterns.
+
+    A pattern that matches a directory excludes everything under it, a leading
+    `/` is ignored, and `!` patterns re-include paths (the last matching
+    pattern wins).
+    """
+
+    def __init__(self, patterns: List[str]):
+        self._patterns: List[_Pattern] = []
+        for original in patterns:
+            pattern = original.strip()
+            if not pattern or pattern.startswith("#"):
+                continue
+            exclusion = pattern.startswith("!")
+            if exclusion:
+                pattern = pattern[1:].strip()
+                if not pattern:
+                    continue
+            pattern = _clean(pattern)
+            if len(pattern) > 1 and pattern.startswith("/"):
+                pattern = pattern[1:]
+            try:
+                self._patterns.append(_Pattern(pattern, exclusion))
+            except re.error as e:
+                raise TemplateException(
+                    f"Invalid ignore pattern '{original}': {e}"
+                ) from e
+
+    def matches(self, path: str) -> bool:
+        """
+        Whether the path or one of its parent directories is excluded.
+
+        :param path: Slash-separated path relative to the context root
+        :return: True if the path is excluded
+        """
+        parent_path = posixpath.dirname(path)
+        parent_dirs = parent_path.split("/") if parent_path else []
+
+        matched = False
+        for pattern in self._patterns:
+            # An inclusion can't change an already matched path, and an
+            # exclusion can't change a path that hasn't matched yet
+            if pattern.exclusion != matched:
+                continue
+            match = pattern.match(path) or any(
+                pattern.match("/".join(parent_dirs[: i + 1]))
+                for i in range(len(parent_dirs))
+            )
+            if match:
+                matched = not pattern.exclusion
+        return matched
+
+    def may_match_under(self, dir_path: str) -> bool:
+        """
+        Whether a `!` pattern could re-include a path under the directory,
+        in which case an excluded directory must still be walked.
+
+        :param dir_path: Slash-separated directory path relative to the context root
+        :return: True if a path under the directory could be re-included
+        """
+        dir_segments = dir_path.split("/")
+        for pattern in self._patt
```

**File**: `packages/python-sdk/e2b/template/main.py` (modified, +2/-2)
```diff
@@ -766,7 +766,7 @@ def __init__(
         Create a new template builder instance.
 
         :param file_context_path: Base path for resolving relative file paths in copy operations
-        :param file_ignore_patterns: List of glob patterns to ignore when copying files
+        :param file_ignore_patterns: Patterns in `.dockerignore` syntax for files to exclude when copying. They are applied after the `.dockerignore` file in the context directory, so they take precedence over it. An invalid pattern (such as an unterminated `[`) raises a :class:`TemplateException`. Brace expansion (`{a,b}`) is not supported, as in Docker
         """
         self._default_base_image: str = "e2bdev/base"
         self._base_image: Optional[str] = self._default_base_image
@@ -1249,8 +1249,8 @@ def _instructions_with_hashes(
                     dest,
                     self._file_context_path,
                     [
-                        *self._file_ignore_patterns,
                         *read_dockerignore(self._file_context_path),
+                        *self._file_ignore_patterns,
                     ],
                     resolve_symlinks
                     if resolve_symlinks is not None
```

---

### Incident Patch 10: `d010c7fb` (2026-09-29)
**Commit Message**: Revise self-hosting guide and supported providers (#1911)

Updated self-hosting guide link and added supported platforms.

**File**: `README.md` (modified, +3/-3)
```diff
@@ -103,10 +103,10 @@ Visit our [Cookbook](https://github.com/e2b-dev/e2b-cookbook/tree/main) to get i
 
 ## Self-hosting
 
-Read the [self-hosting guide](https://github.com/e2b-dev/infra/blob/main/self-host.md) to learn how to set up the [E2B infrastructure](https://github.com/e2b-dev/infra) on your own. The infrastructure is deployed using Terraform. 
+Read the [embed deployment guide](https://github.com/e2b-dev/runtime/blob/main/embed/README.md) to learn how to set up the [E2B runtime](https://github.com/e2b-dev/runtime) on your own. The infrastructure is deployed using Terraform. 
 
 Supported cloud providers:
 - 🟢 AWS
 - 🟢 Google Cloud (GCP)
-- [ ] Azure
-- [ ] General Linux machine
+- 🟢 Azure
+- 🟢 General Linux machine (via Embed) 
```

---

### Incident Patch 11: `3e5a48b0` (2026-09-16)
**Commit Message**: js-sdk: run the msw-mocked suites in the browser leg (#1871)

## Summary

Follow-up to #1609. The ten suites that mock the API with msw (`client`,
`abortSignal`, `egressProxy`, `iam`, `lifecycleRequest`,
`networkTransform`, `onResumeRequest`, `secret`, `volume`, `volume/file`
— 188 tests) were excluded from the browser leg only because they
imported `msw/node`, whose entry pulls in `node:http`. The SDK code they
cover (Secrets, Volumes, cancellation, workload identity,
lifecycle/network request shapes, `E2B` client binding) is
browser-runnable, so this makes them run in Chromium too, unchanged for
Node/Bun/Deno/Workers.

**Runtime-aware helper.** The suites now import `setupMockApi` from
`tests/mockApi.ts` instead of `setupServer` from `msw/node`:

```ts
interface MockApi {
  listen(options?: SharedOptions): Promise<void>  // async: a browser has to activate the worker first
  close(): Promise<void>
  use / resetHandlers / events                     // same as SetupServer
}
```

- `tests/mockApi.ts` wraps `setupServer` (Node and the compat runtimes).
- `tests/runtimes/browser/mockApi.ts` wraps `setupWorker` from
`msw/browser` (`listen → worker.start({ quiet: true })`, `close →
work

**File**: `packages/js-sdk/tests/client.test.ts` (modified, +24/-18)
```diff
@@ -1,6 +1,5 @@
 import { afterAll, afterEach, assert, beforeAll, expect, test } from 'vitest'
 import { http, HttpResponse } from 'msw'
-import { setupServer } from 'msw/node'
 
 import DefaultExport, {
   type ConnectionOpts,
@@ -11,7 +10,9 @@ import DefaultExport, {
   TemplateBase,
   Volume,
 } from '../src'
+import { runtime } from '../src/utils'
 import { TEST_API_KEY } from './setup'
+import { setupMockApi } from './mockApi'
 
 const API_KEY_A = `e2b_${'a'.repeat(40)}`
 const API_KEY_B = `e2b_${'b'.repeat(40)}`
@@ -51,7 +52,7 @@ const secretResponse = {
   updatedAt: new Date().toISOString(),
 }
 
-const server = setupServer(
+const server = setupMockApi(
   http.post(/\/sandboxes$/, async ({ request }) => {
     record(request)
     return HttpResponse.json(sandboxResponse)
@@ -107,7 +108,7 @@ const envOverrides = {
   E2B_DEBUG: undefined,
 }
 
-beforeAll(() => {
+beforeAll(async () => {
   for (const [key, value] of Object.entries(envOverrides)) {
     envBackup[key] = process.env[key]
     if (value === undefined) {
@@ -117,11 +118,11 @@ beforeAll(() => {
     }
   }
 
-  server.listen({ onUnhandledRequest: 'error' })
+  await server.listen({ onUnhandledRequest: 'error' })
 })
 
-afterAll(() => {
-  server.close()
+afterAll(async () => {
+  await server.close()
 
   for (const [key, value] of Object.entries(envBackup)) {
     if (value === undefined) {
@@ -346,18 +347,23 @@ test('client.Template statics use the client config', async () => {
   assert.equal(lastRequest().apiKey, API_KEY_B)
 })
 
-test('client.Template builds template instances', async () => {
-  const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A })
-  const template = client.Template().fromPythonImage('3')
-
-  assert.instanceOf(template, TemplateBase)
-  assert.instanceOf(template, client.Template)
-  assert.instanceOf(new client.Template(), client.Template)
-  assert.equal(
-    await client.Template.toDockerfile(template),
-    await Template.toDockerfile(Template().fromPythonImage('3'))
-  )
-})
+// The template builder is Node-only (node:path/node:fs); tests/template/** is
+// excluded from the browser suite for the same reason.
+test.skipIf(runtime === 'browser')(
+  'client.Template builds template instances',
+  async () => {
+    const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A })
+    const template = client.Template().fromPythonImage('3')
+
+    assert.instanceOf(template, TemplateBase)
+    assert.instanceOf(template, client.Template)
+    assert.instanceOf(new client.Template(), client.Template)
+    assert.equal(
+      await client.Template.toDockerfile(template),
+      await Template.toDockerfile(Template().fromPythonImage('3'))
+    )
+  }
+)
 
 test('client.Template can be rebound to a variable', async () => {
   const client = new E2B({ apiKey: API_KEY_A, domain: DOMAIN_A })
```

**File**: `packages/js-sdk/tests/mockApi.ts` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import type { RequestHandler, SharedOptions } from 'msw'
+import { setupServer, type SetupServer } from 'msw/node'
+
+/**
+ * A mocked E2B API for the unit suites that don't talk to a real backend.
+ *
+ * The handlers are plain msw and run everywhere; only the interception does
+ * not. Node — and the runtimes with a Node compatibility layer — patch the
+ * HTTP clients in-process through `msw/node`, whose entry pulls in
+ * `node:http`. A browser can't load that and intercepts at the network layer
+ * instead, through a Service Worker from `msw/browser`; the browser config
+ * swaps in tests/runtimes/browser/mockApi.ts for this module. Both expose
+ * this shape, so a suite written against it runs on every leg unchanged.
+ */
+export interface MockApi {
+  /**
+   * Starts intercepting requests. Async because a browser has to register
+   * and activate the worker first; on Node it resolves immediately.
+   */
+  listen(options?: SharedOptions): Promise<void>
+  /** Stops intercepting requests. */
+  close(): Promise<void>
+  /** Prepends handlers to the active list until the next `resetHandlers`. */
+  use: SetupServer['use']
+  /** Restores the initial handlers, or replaces them when some are given. */
+  resetHandlers: SetupServer['resetHandlers']
+  /** Life-cycle events, e.g. `request:start`. */
+  events: SetupServer['events']
+}
+
+export function setupMockApi(...handlers: RequestHandler[]): MockApi {
+  const server = setupServer(...handlers)
+
+  return {
+    async listen(options) {
+      server.listen(options)
+    },
+    async close() {
+      server.close()
+    },
+    use: (...next) => server.use(...next),
+    resetHandlers: (...next) => server.resetHandlers(...next),
+    events: server.events,
+  }
+}
```

**File**: `packages/js-sdk/tests/runtimes/browser/mockApi.ts` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+import type { RequestHandler } from 'msw'
+import { setupWorker } from 'msw/browser'
+
+import type { MockApi } from '../../mockApi'
+
+/**
+ * Browser implementation of tests/mockApi.ts, served in place of it by the
+ * browser config. Requests are intercepted by a Service Worker registered
+ * from `/mockServiceWorker.js`, which the config serves straight out of the
+ * installed `msw` package so the script can't fall out of step with the
+ * library.
+ *
+ * The worker is shared by every test file (one registration per origin), but
+ * it only intercepts for clients that have called `start()`, and vitest runs
+ * each file in its own iframe — so a suite's handlers never see another
+ * suite's traffic.
+ */
+export function setupMockApi(...handlers: RequestHandler[]): MockApi {
+  const worker = setupWorker(...handlers)
+
+  return {
+    async listen(options) {
+      // `quiet` drops msw's per-request console group, which vitest would
+      // otherwise forward to the terminal for every mocked call.
+      await worker.start({ ...options, quiet: true })
+    },
+    async close() {
+      worker.stop()
+    },
+    use: (...next) => worker.use(...next),
+    resetHandlers: (...next) => worker.resetHandlers(...next),
+    events: worker.events,
+  }
+}
```

**File**: `packages/js-sdk/tests/runtimes/browser/vitest.config.mts` (modified, +46/-16)
```diff
@@ -1,6 +1,11 @@
+import { createReadStream } from 'node:fs'
+import { createRequire } from 'node:module'
+import { dirname, join, sep } from 'node:path'
+import { fileURLToPath } from 'node:url'
+
 import { playwright } from '@vitest/browser-playwright'
 import { config } from 'dotenv'
-import { defineConfig } from 'vitest/config'
+import { defineConfig, type Plugin } from 'vitest/config'
 
 // Real env vars win over `.env`, matching dotenv's own precedence.
 const env = { ...config().parsed, ...process.env }
@@ -12,6 +17,45 @@ const testEnv = Object.fromEntries(
   Object.entries(env).filter(([name]) => name.startsWith('E2B_'))
 ) as Record<string, string>
 
+// Vite module ids always use `/`, also on Windows.
+const toModuleId = (path: string) => path.split(sep).join('/')
+
+const testsDir = fileURLToPath(new URL('../..', import.meta.url))
+const nodeMockApi = toModuleId(join(testsDir, 'mockApi.ts'))
+const browserMockApi = toModuleId(
+  fileURLToPath(new URL('./mockApi.ts', import.meta.url))
+)
+const workerScript = join(
+  dirname(createRequire(import.meta.url).resolve('msw/package.json')),
+  'lib/mockServiceWorker.js'
+)
+
+// The suites that mock the API import `setupMockApi` from tests/mockApi.ts,
+// which wraps `msw/node` — an entry that pulls in node:http and can't be
+// served to a browser. Redirect that one module to the Service Worker-backed
+// implementation, and serve msw's worker script at the URL `worker.start()`
+// registers by default, straight from the installed package rather than a
+// checked-in copy that would drift from the library version.
+const browserMockApiPlugin: Plugin = {
+  name: 'e2b:browser-mock-api',
+  // Before Vite's own resolver, which would otherwise settle the import first.
+  enforce: 'pre',
+  async resolveId(source, importer, options) {
+    if (!importer || !/\bmockApi(\.ts)?$/.test(source)) return
+    const resolved = await this.resolve(source, importer, {
+      ...options,
+      skipSelf: true,
+    })
+    return resolved?.id === nodeMockApi ? browserMockApi : undefined
+  },
+  configureServer(server) {
+    server.middlewares.use('/mockServiceWorker.js', (_req, res) => {
+      res.setHeader('Content-Type', 'text/javascript')
+      createReadStream(workerScript).pipe(res)
+    })
+  },
+}
+
 // Runs the unit + connectionConfig projects (same coverage as test:bun /
 // test:deno / test:cf) inside a real Chromium via Playwright, against src.
 // Nothing is skipped for being a browser: the suites that can't run here are
@@ -20,6 +64,7 @@ const testEnv = Object.fromEntries(
 // (`corsHttpServerCmd` in tests/setup.ts), the way a browser app's own server
 // would be configured.
 export default defineConfig({
+  plugins: [browserMockApiPlugin],
   test: {
     name: 'browser',
     include: [
@@ -40,21 +85,6 @@ export default defineConfig({
       // The browser never takes that path — `createRuntimeFetch` late-binds
       // the global fetch outside Node — so there is nothing to cover here.
       'tests/undici.test.ts',
-      // These mock the API with msw's `setupServer`, whose `msw/node` entry
-      // pulls in node:http and can't be served to the browser. Porting them
-      // means `setupWorker` plus a service worker served from a public dir.
-      // Any new suite that imports `msw/node` belongs here — `grep -rl msw/node
-      // tests/` lists the full set (tests/template/** is already excluded).
-      'tests/client.test.ts',
-      'tests/sandbox/abortSignal.test.ts',
-      'tests/sandbox/egressProxy.test.ts',
-      'tests/sandbox/iam.test.ts',
-      'tests/sandbox/lifecycleRequest.test.ts',
-      'tests/sandbox/networkTransform.test.ts',
-      'tests/sandbox/onResumeRequest.test.ts',
-      'tests/secret/secret.test.ts',
-      'tests/volume/file.test.ts',
-      'tests/volume/volume.test.ts',
     ],
     globals: false,
     testTimeout: 30_000,
```

**File**: `packages/js-sdk/tests/sandbox/abortSignal.test.ts` (modified, +2/-2)
```diff
@@ -1,9 +1,9 @@
 import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
 import { http, HttpResponse } from 'msw'
-import { setupServer } from 'msw/node'
 
 import { Sandbox } from '../../src'
 import { TEST_API_KEY, apiUrl } from '../setup'
+import { setupMockApi } from '../mockApi'
 
 // Hold the request open until the caller aborts. If the signal is already
 // aborted by the time the handler runs, `addEventListener('abort', …)` would
@@ -34,7 +34,7 @@ const restHandlers = [
   }),
 ]
 
-const server = setupServer(...restHandlers)
+const server = setupMockApi(...restHandlers)
 
 beforeAll(() =>
   server.listen({
```

**File**: `packages/js-sdk/tests/sandbox/egressProxy.test.ts` (modified, +2/-2)
```diff
@@ -1,17 +1,17 @@
 import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
 import { http, HttpResponse } from 'msw'
-import { setupServer } from 'msw/node'
 
 import { Sandbox } from '../../src'
 import { TEST_API_KEY, apiUrl } from '../setup'
+import { setupMockApi } from '../mockApi'
 
 const sandboxId = 'test-sandbox-id'
 
 let lastCreateBody: Record<string, any> | undefined
 let lastUpdateBody: Record<string, any> | undefined
 let sandboxNetwork: Record<string, any> | undefined
 
-const server = setupServer(
+const server = setupMockApi(
   http.post(apiUrl('/sandboxes'), async ({ request }) => {
     lastCreateBody = (await request.json()) as Record<string, any>
     return HttpResponse.json({
```

**File**: `packages/js-sdk/tests/sandbox/iam.test.ts` (modified, +2/-2)
```diff
@@ -1,16 +1,16 @@
 import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
 import { http, HttpResponse } from 'msw'
-import { setupServer } from 'msw/node'
 
 import { InvalidArgumentError, Sandbox, Secret } from '../../src'
 import { iamTokenPlaceholders } from '../../src/sandbox/iam'
 import { TEST_API_KEY, apiUrl } from '../setup'
+import { setupMockApi } from '../mockApi'
 
 const RUNTIME_PROBED_PROPS = ['toJSON', 'then', 'toString', 'valueOf']
 
 let lastCreateBody: Record<string, unknown> | undefined
 
-const server = setupServer(
+const server = setupMockApi(
   http.post(apiUrl('/sandboxes'), async ({ request }) => {
     lastCreateBody = (await request.json()) as Record<string, unknown>
     return HttpResponse.json({
```

**File**: `packages/js-sdk/tests/sandbox/lifecycleRequest.test.ts` (modified, +2/-2)
```diff
@@ -1,13 +1,13 @@
 import { afterAll, afterEach, beforeAll, expect, test } from 'vitest'
 import { http, HttpResponse } from 'msw'
-import { setupServer } from 'msw/node'
 
 import { InvalidArgumentError, Sandbox } from '../../src'
 import { TEST_API_KEY, apiUrl } from '../setup'
+import { setupMockApi } from '../mockApi'
 
 let lastCreateBody: Record<string, unknown> | undefined
 
-const server = setupServer(
+const server = setupMockApi(
   http.post(apiUrl('/sandboxes'), async ({ request }) => {
     lastCreateBody = (await request.json()) as Record<string, unknown>
     return HttpResponse.json({
```

---

### Incident Patch 12: `956e3ab8` (2026-09-15)
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

**File**: `packages/python-sdk/e2b/template_async/main.py` (modified, +6/-0)
```diff
@@ -4,6 +4,7 @@
 from typing_extensions import Unpack
 
 from e2b.api.client.client import AuthenticatedClient
+from e2b.api.client.types import Unset
 from e2b.connection_config import ApiParams, ConnectionConfig
 from e2b.template.consts import GZIP, RESOLVE_SYMLINKS
 from e2b.template.logger import LogEntry, LogEntryEnd, LogEntryStart
@@ -137,6 +138,11 @@ async def _build(
                     resolve_symlinks,
                     gzip,
                     stack_trace,
+                    headers=(
+                        file_info.headers.to_dict()
+                        if not isinstance(file_info.headers, Unset)
+                        else None
+                    ),
                     request_timeout=request_timeout,
                 )
                 if on_build_logs:
```

**File**: `packages/python-sdk/e2b/template_sync/build_api.py` (modified, +18/-6)
```diff
@@ -1,6 +1,7 @@
+import os
 import time
 from types import TracebackType
-from typing import Callable, Optional, List, Union
+from typing import Callable, Dict, Optional, List, Union
 
 import httpx
 from pyqwest import SyncHTTPTransport
@@ -113,6 +114,8 @@ def upload_file(
     resolve_symlinks: bool,
     gzip: bool,
     stack_trace: Optional[TracebackType],
+    *,
+    headers: Optional[Dict[str, str]] = None,
     request_timeout: Optional[float] = None,
 ):
     # Uploading a large build-context archive can take far longer than the 60s
@@ -127,6 +130,7 @@ def upload_file(
         tar_file = tar_file_stream(
             file_name, context_path, ignore_patterns, resolve_symlinks, gzip
         )
+        size = os.fstat(tar_file.fileno()).st_size
         try:
             # Through the pyqwest adapter the upload timeout is a
             # whole-request deadline for the entire transfer, not a per-write
@@ -148,11 +152,19 @@ def upload_file(
                     )
                 ),
             ) as client:
-                # httpx streams the archive from disk in chunks and sets
-                # Content-Length from the file size—S3 presigned URLs reject
-                # chunked transfer encoding, and reqwest keeps the
-                # Content-Length framing for the streamed body.
-                response = client.put(url, content=tar_file)
+                # API-returned headers applied as given, but Content-Length stays ours — explicit so S3 presigned URLs see no chunked encoding.
+                response = client.put(
+                    url,
+                    content=tar_file,
+                    headers={
+                        **{
+                            k: v
+                            for k, v in (headers or {}).items()
+                            if k.lower() != "content-length"
+                        },
+                        "Content-Length": str(size),
+                    },
+                )
             response.raise_for_status()
         finally:
             # Closing the spooled temp file is best-effort: a failure here
```

**File**: `packages/python-sdk/e2b/template_sync/main.py` (modified, +6/-0)
```diff
@@ -4,6 +4,7 @@
 from typing_extensions import Unpack
 
 from e2b.api.client.client import AuthenticatedClient
+from e2b.api.client.types import Unset
 from e2b.connection_config import ApiParams, ConnectionConfig
 
 from e2b.api.client_sync import get_api_client
@@ -137,6 +138,11 @@ def _build(
                     resolve_symlinks,
                     gzip,
                     stack_trace,
+                    headers=(
+                        file_info.headers.to_dict()
+                        if not isinstance(file_info.headers, Unset)
+                        else None
+                    ),
                     request_timeout=request_timeout,
                 )
                 if on_build_logs:
```

---

### Incident Patch 13: `5b015ad7` (2026-09-14)
**Commit Message**: chore: remove the V1 template build footprint (#1875)

## Summary

The V1 template build API is gone from the server: `POST /templates`,
`POST /templates/{templateID}`,
`POST /templates/{templateID}/builds/{buildID}` and `POST /v2/templates`
were removed in
e2b-dev/runtime `87968fc1e1fa`, and control planes carrying that change
answer `410 Gone`. This
drops the client-side footprint that was left behind. Two independently
droppable hunks.

- **Generated clients follow the spec pin.** `spec/runtime-ref` →
e2b-dev/runtime `433d1d5fbbd2`
and `make codegen`; no spec or generated file was hand-edited. The four
operations and the
`TemplateLegacy`, `TemplateBuildRequest`, `TemplateBuildRequestV2`
schemas disappear from
`spec/openapi.yml`, `packages/js-sdk/src/api/schema.gen.ts` and the
Python client (three models,
four operation modules). Nothing hand-written imported them. The
changeset is **minor** on `e2b`
and `@e2b/python-sdk` and enumerates every removed name, following the
schema prune in #1803:
the names leave the published type and module surface even though no SDK
method returned them.
- **The CLI's V1 build stub is gone.** `e2b template build` (alias `bd`)
was hidden, printed a


**File**: `.changeset/remove-template-build-v1-clients.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+---
+'e2b': minor
+'@e2b/python-sdk': minor
+---
+
+Removed the V1 template build operations and schemas from the generated API clients. The API no longer serves them (runtime `87968fc1e1fa`); control planes carrying that change answer `410 Gone`. Template builds go through the Template SDK.
+
+Visible removal, classified minor: the JS `paths` namespace loses `POST /templates`, `POST /templates/{templateID}`, `POST /templates/{templateID}/builds/{buildID}` and `POST /v2/templates`, and `components['schemas']` loses `TemplateLegacy`, `TemplateBuildRequest` and `TemplateBuildRequestV2`; the Python `e2b.api.client.models` package loses `TemplateLegacy`, `TemplateBuildRequest` and `TemplateBuildRequestV2`, and `e2b.api.client.api.templates` loses the `post_templates`, `post_templates_template_id`, `post_templates_template_id_builds_build_id` and `post_v2_templates` modules. No SDK method accepted or returned them; code that imported these names directly must drop the import.
+
+The regenerated clients also pick up a documented `429` on most operations, a `409` on template create (v3), the upload-request `headers` on the build file-upload link, `minLength: 1` on the v2 build source fields, and a deprecation marker on the always-empty `logs` field of the build status.
```

**File**: `.changeset/remove-template-build-v1-command.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@e2b/cli': patch
+---
+
+Removed the hidden `e2b template build` command (alias `bd`). It printed a V1 deprecation notice and exited 1; the V1 build system it fronted is gone from the API. A script still calling it now gets commander's unknown-command error with the same exit code. Build templates with `e2b template create` or the Template SDK; `e2b template migrate` still converts a V1 project (see https://e2b.dev/docs/template/migration-v2).
```

**File**: `packages/cli/src/commands/template/build.ts` (removed, +0/-37)
```diff
@@ -1,37 +0,0 @@
-import * as boxen from 'boxen'
-import * as commander from 'commander'
-import { asBold, asPrimary } from '../../utils/format'
-
-export const buildCommand = new commander.Command('build')
-  .description('Deprecated: use `e2b template create` instead.')
-  .argument('[template]', 'unused')
-  .allowUnknownOption(true)
-  .alias('bd')
-  .action(async () => {
-    const deprecationMessage = `${asBold('DEPRECATION WARNING')}
-
-This is the v1 build system which is now deprecated.
-Please migrate to the new build system v2.
-
-Migration guide: ${asPrimary('https://e2b.dev/docs/template/migration-v2')}`
-
-    const deprecationWarning = boxen.default(deprecationMessage, {
-      padding: {
-        bottom: 0,
-        top: 0,
-        left: 2,
-        right: 2,
-      },
-      margin: {
-        top: 1,
-        bottom: 1,
-        left: 0,
-        right: 0,
-      },
-      borderColor: 'yellow',
-      borderStyle: 'round',
-    })
-
-    console.log(deprecationWarning)
-    process.exit(1)
-  })
```

**File**: `packages/cli/src/commands/template/index.ts` (modified, +0/-2)
```diff
@@ -1,7 +1,6 @@
 import * as commander from 'commander'
 
 import { createCommand } from './create'
-import { buildCommand } from './build'
 import { deleteCommand } from './delete'
 import { initCommand } from './init'
 import { listCommand } from './list'
@@ -12,7 +11,6 @@ export const templateCommand = new commander.Command('template')
   .description('manage sandbox templates')
   .alias('tpl')
   .addCommand(createCommand)
-  .addCommand(buildCommand, { hidden: true })
   .addCommand(listCommand)
   .addCommand(initCommand)
   .addCommand(deleteCommand)
```

**File**: `packages/js-sdk/src/api/schema.gen.ts` (modified, +57/-206)
```diff
@@ -39,6 +39,7 @@ export interface paths {
                 };
                 400: components["responses"]["400"];
                 401: components["responses"]["401"];
+                429: components["responses"]["429"];
                 500: components["responses"]["500"];
             };
         };
@@ -71,6 +72,7 @@ export interface paths {
                 };
                 400: components["responses"]["400"];
                 401: components["responses"]["401"];
+                429: components["responses"]["429"];
                 500: components["responses"]["500"];
                 503: components["responses"]["503"];
                 504: components["responses"]["504"];
@@ -115,6 +117,7 @@ export interface paths {
                 };
                 401: components["responses"]["401"];
                 404: components["responses"]["404"];
+                429: components["responses"]["429"];
                 500: components["responses"]["500"];
             };
         };
@@ -144,6 +147,7 @@ export interface paths {
                 };
                 401: components["responses"]["401"];
                 404: components["responses"]["404"];
+                429: components["responses"]["429"];
                 500: components["responses"]["500"];
             };
         };
@@ -202,6 +206,7 @@ export interface paths {
                 401: components["responses"]["401"];
                 404: components["responses"]["404"];
                 409: components["responses"]["409"];
+                429: components["responses"]["429"];
                 500: components["responses"]["500"];
                 503: components["responses"]["503"];
                 504: components["responses"]["504"];
@@ -253,6 +258,7 @@ export interface paths {
                 401: components["responses"]["401"];
                 404: components["responses"]["404"];
                 409: components["responses"]["409"];
+                429: components["responses"]["429"];
                 500: components["responses"]["500"];
                 503: components["responses"]["503"];
             };
@@ -302,6 +308,7 @@ export interface paths {
                 };
                 401: components["responses"]["401"];
                 404: components["responses"]["404"];
+                429: components["responses"]["429"];
                 500: components["responses"]["500"];
             };
         };
@@ -351,6 +358,7 @@ export interface paths {
                 400: components["responses"]["400"];
                 401: components["responses"]["401"];
                 404: components["responses"]["404"];
+                429: components["responses"]["429"];
                 500: components["responses"]["500"];
             };
         };
@@ -399,6 +407,7 @@ export interface paths {
                 401: components["responses"]["401"];
                 404: components["responses"]["404"];
                 409: components["responses"]["409"];
+                429: components["responses"]["429"];
                 500: components["responses"]["500"];
             };
         };
@@ -447,6 +456,7 @@ export interface paths {
                 401: components["responses"]["401"];
                 404: components["responses"]["404"];
                 409: components["responses"]["409"];
+                429: components["responses"]["429"];
                 500: components["responses"]["500"];
                 503: components["responses"]["503"];
             };
@@ -494,6 +504,7 @@ export interface paths {
                 };
                 401: components["responses"]["401"];
                 404: components["responses"]["404"];
+                429: components["responses"]["429"];
             };
         };
         delete?: never;
@@ -544,6 +555,7 @@ export interface paths {
                 401: components["responses"]["401"];
                 404: components["responses"]["404"];
                 409: components["responses"]["409"];
+                429: components["responses"]["429"];
                 500: components["responses"]["500"];
                 503: components["responses"]["503"];
                 504: components["responses"]["504"];
@@ -595,6 +607,7 @@ export interface paths {
                 400: components["responses"]["400"];
                 401: components["responses"]["401"];
                 404: components["responses"]["404"];
+                429: components["responses"]["429"];
                 500: components["responses"]["500"];
             };
         };
@@ -641,6 +654,7 @@ export interface paths {
                 };
                 401: components["responses"]["401"];
                 404: components["responses"]["404"];
+                429: components["responses"]["429"];
                 500: components["responses"]["500"];
             };
         };
@@ -684,6 +698,7 @@ export interface paths {
                 };
                 400: components["responses"]["400"];
                 401: comp
```

**File**: `packages/js-sdk/src/template/types.ts` (modified, +2/-2)
```diff
@@ -140,8 +140,8 @@ export type TemplateBuildStatusResponse = {
    */
   logEntries: LogEntry[]
   /**
-   * Build logs (raw strings).
-   * @deprecated Use `logEntries` instead.
+   * Build logs (raw strings). Always empty since the V1 build path was removed.
+   * @deprecated Use `logEntries` instead. Will be removed in the next major version.
    */
   logs: string[]
   /**
```

**File**: `packages/python-sdk/e2b/api/client/api/sandboxes/delete_sandboxes_sandbox_id.py` (modified, +4/-0)
```diff
@@ -34,6 +34,10 @@ def _parse_response(
         response_404 = Error.from_dict(response.json())
 
         return response_404
+    if response.status_code == 429:
+        response_429 = Error.from_dict(response.json())
+
+        return response_429
     if response.status_code == 500:
         response_500 = Error.from_dict(response.json())
 
```

**File**: `packages/python-sdk/e2b/api/client/api/sandboxes/get_sandboxes.py` (modified, +4/-0)
```diff
@@ -49,6 +49,10 @@ def _parse_response(
         response_401 = Error.from_dict(response.json())
 
         return response_401
+    if response.status_code == 429:
+        response_429 = Error.from_dict(response.json())
+
+        return response_429
     if response.status_code == 500:
         response_500 = Error.from_dict(response.json())
 
```

---

### Incident Patch 14: `80496c0f` (2026-09-14)
**Commit Message**: test(js-sdk): run the full unit test suite in a browser (#1609)

> [!NOTE]
> **Both upstream blockers have rolled out — the browser leg is green,
with nothing gated or skipped for being a browser.**
>
> | needed | blocked | status |
> | --- | --- | --- |
> |
~~[infra#3388](https://github.com/e2b-dev/infra/commit/e832b1ed40f488dd1159fdece027bad004522be0)~~
| ~~6 `Sandbox.list({ limit })` pagination tests~~ | **rolled out
2026-07-24** |
> | ~~[belt#2068](https://github.com/e2b-dev/belt/pull/2068)~~ | ~~13
stopped-sandbox tests~~ | **rolled out 2026-08-26** |
> | ~~belt#2068 on the **traffic-token path**~~ | ~~`sandbox requires
traffic access token`~~ | **rolled out — the test passes as of
2026-09-09** |
>
> The 15th failure was **not** an infra problem and is **fixed in this
PR** (`1964dde`) — see [the browser's connection-drop wording](#sdk-294)
below.
>
> `pnpm test:browser` against production, 2026-09-09: **77 files (76
passed, 1 skipped), 424 tests (420 passed, 4 skipped), 0 failing**,
143s. The last gap — the proxy answering a traffic-token `403` and its
preflight without CORS headers — is closed on the orchestrator side, so
`sandbox requires traffic access token` now reads the 

**File**: `.changeset/olive-jars-tap.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'e2b': patch
+---
+
+Fix uploads of non-native `ReadableStream`s in the browser silently sending the text `[object ReadableStream]` instead of the data. Buffering a stream drained it with `new Response(stream)`, which accepts any async iterable on Node (an undici extension) but only its own stream class in a browser, stringifying anything else. Streams are now drained through the reader, which every implementation supports.
```

**File**: `.changeset/soft-moons-repeat.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'e2b': patch
+---
+
+Report a sandbox killed mid-request as an actionable `TimeoutError` in the browser. When the connection to a sandbox drops mid-request the SDK probes the sandbox's health to tell a killed sandbox apart from a transient network blip, but the probe only ran for connection-dropped wordings it recognized, and the browser's (`network error`) was missing — so killing a sandbox while a command was running surfaced a generic `SandboxError: [unknown] network error` instead of `TimeoutError: ... The sandbox was killed or reached its end of life while the request was in flight.`
```

**File**: `.github/workflows/js_sdk_tests.yml` (modified, +27/-14)
```diff
@@ -8,7 +8,7 @@ on:
         type: string
         default: ''
       node-only:
-        description: 'Run only the Node legs (skip Bun, Deno, and Cloudflare)'
+        description: 'Run only the Node legs (skip Bun, Deno, Cloudflare, and the browser)'
         required: false
         type: boolean
         default: false
@@ -31,18 +31,22 @@ jobs:
     name: JS SDK - ${{ matrix.runtime }} (${{ matrix.os }})
     strategy:
       fail-fast: false
-      # Each runtime keeps one live-test worker, so all six runtime/OS jobs can
-      # run together without restoring Vitest's default worker multiplication.
-      max-parallel: 6
+      # Each runtime keeps one live-test worker, so all seven runtime/OS jobs
+      # can run together without restoring Vitest's default worker
+      # multiplication.
+      max-parallel: 7
       # With node-only (set by staging callers) the matrix collapses to the
-      # Node legs: the Bun/Deno/Cloudflare legs re-run suites the Node legs
-      # already cover and add sandbox/build load without extra backend
-      # signal, so the other runtimes are exercised against production only.
+      # Node legs: the Bun/Deno/Cloudflare/browser legs re-run suites the Node
+      # legs already cover and add sandbox/build load, so the other runtimes
+      # are exercised against production only. Note this does drop backend
+      # signal for the browser leg specifically — it's the only one that
+      # depends on the API's CORS headers — so a staging-only CORS regression
+      # surfaces on the production run rather than before merge.
       matrix:
         include: >-
           ${{ inputs.node-only
             && fromJSON('[{"runtime": "node", "os": "ubuntu-22.04"}, {"runtime": "node", "os": "windows-latest"}]')
-            || fromJSON('[{"runtime": "node", "os": "ubuntu-22.04"}, {"runtime": "node", "os": "windows-latest"}, {"runtime": "bun", "os": "ubuntu-22.04"}, {"runtime": "deno", "os": "ubuntu-22.04"}, {"runtime": "cloudflare", "os": "ubuntu-22.04"}, {"runtime": "cloudflare-deploy", "os": "ubuntu-22.04"}]') }}
+            || fromJSON('[{"runtime": "node", "os": "ubuntu-22.04"}, {"runtime": "node", "os": "windows-latest"}, {"runtime": "bun", "os": "ubuntu-22.04"}, {"runtime": "deno", "os": "ubuntu-22.04"}, {"runtime": "cloudflare", "os": "ubuntu-22.04"}, {"runtime": "cloudflare-deploy", "os": "ubuntu-22.04"}, {"runtime": "browser", "os": "ubuntu-22.04"}]') }}
     runs-on: ${{ matrix.os }}
     env:
       E2B_TEST_MAX_WORKERS: 1
@@ -90,22 +94,21 @@ jobs:
         run: |
           pnpm install --frozen-lockfile
 
-      # Only the Node runtime runs the vitest `browser` project, which drives
-      # Chromium through Playwright.
+      # Only the browser leg needs Chromium, which Playwright drives.
       - name: Get Playwright version
-        if: matrix.runtime == 'node'
+        if: matrix.runtime == 'browser'
         id: playwright-version
         run: echo "version=$(node -p "require('playwright/package.json').version")" >> "$GITHUB_OUTPUT"
 
       - name: Cache Playwright browsers
-        if: matrix.runtime == 'node'
+        if: matrix.runtime == 'browser'
         uses: actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830 # v4.3.0
         with:
-          path: ${{ matrix.os == 'windows-latest' && '~/AppData/Local/ms-playwright' || '~/.cache/ms-playwright' }}
+          path: ~/.cache/ms-playwright
           key: playwright-${{ runner.os }}-${{ steps.playwright-version.outputs.version }}
 
       - name: Install Playwright Chromium
-        if: matrix.runtime == 'node'
+        if: matrix.runtime == 'browser'
         run: pnpm run playwright:install
 
       # The unit bundle test and the Cloudflare deploy config fail in CI when
@@ -163,3 +166,13 @@ jobs:
         env:
           E2B_API_KEY: ${{ secrets.E2B_API_KEY }}
           E2B_DOMAIN: ${{ inputs.E2B_DOMAIN }}
+
+      # Full unit + connectionConfig suite inside Chromium (vitest browser mode).
+      # Chromium comes from the cached install step above; `pretest:browser`
+      # covers local runs, where it's a no-op once installed.
+      - name: Run test suite in the browser
+        if: matrix.runtime == 'browser'
+        run: pnpm test:browser
+        env:
+          E2B_API_KEY: ${{ secrets.E2B_API_KEY }}
+          E2B_DOMAIN: ${{ inputs.E2B_DOMAIN }}
```

**File**: `packages/js-sdk/package.json` (modified, +2/-7)
```diff
@@ -35,6 +35,8 @@
     "generate:mcp": "json2ts -i ./../../spec/mcp-server.json -o src/sandbox/mcp.d.ts --unreachableDefinitions --style.singleQuote --no-style.semi",
     "check-deps": "knip",
     "playwright:install": "playwright install chromium",
+    "pretest:browser": "pnpm run playwright:install",
+    "test:browser": "vitest run --config tests/runtimes/browser/vitest.config.mts",
     "test:bun": "bunx --bun vitest run --project unit --project connectionConfig --project template",
     "test:cf": "vitest run --config tests/runtimes/cloudflare/vitest.config.mts",
     "test:cf:deploy": "vitest run --config tests/runtimes/cloudflare-deploy/vitest.config.mts",
@@ -46,13 +48,9 @@
   "devDependencies": {
     "@cloudflare/vitest-pool-workers": "^0.18.7",
     "@redocly/cli": "2.51.2",
-    "@testing-library/react": "^16.3.3",
     "@types/node": "catalog:",
     "@types/platform": "^1.3.6",
-    "@types/react": "^19.2.18",
-    "@types/react-dom": "^19.2.5",
     "@typescript/native": "catalog:",
-    "@vitejs/plugin-react": "^4.3.4",
     "@vitest/browser": "catalog:",
     "@vitest/browser-playwright": "catalog:",
     "dotenv": "^16.4.5",
@@ -63,12 +61,9 @@
     "npm-run-all": "^4.1.5",
     "openapi-typescript": "^7.13.0",
     "playwright": "^1.63.0",
-    "react": "^19.2.8",
-    "react-dom": "^19.2.8",
     "tsdown": "catalog:",
     "typescript": "catalog:",
     "vitest": "catalog:",
-    "vitest-browser-react": "^2.3.0",
     "wrangler": "^4.129.0"
   },
   "files": [
```

**File**: `packages/js-sdk/src/envd/rpc.ts` (modified, +2/-0)
```diff
@@ -29,12 +29,14 @@ export type SandboxHealthCheck = () => Promise<boolean | undefined>
  *   - Bun:                 `The socket connection was closed unexpectedly`
  *   - Deno:                `error reading a body from connection`
  *   - Cloudflare Workers:  `Network connection lost`
+ *   - Browser:             `network error`
  */
 const CONNECTION_TERMINATED_MESSAGES = [
   'terminated',
   'The socket connection was closed unexpectedly',
   'error reading a body from connection',
   'Network connection lost',
+  'network error',
 ]
 
 /**
```

**File**: `packages/js-sdk/src/utils.ts` (modified, +15/-2)
```diff
@@ -168,9 +168,22 @@ export async function toBlob(
   if (isBlobLike(data)) {
     return new Blob([await data.arrayBuffer()], { type: data.type })
   }
-  // ReadableStream - must consume to get Blob
+  // ReadableStream - must consume to get Blob. Drained through the reader
+  // rather than `new Response(stream)`: the platform only accepts a body it
+  // recognizes, and what counts differs per runtime (undici takes any async
+  // iterable, a browser takes only its own stream class and stringifies the
+  // rest to "[object ReadableStream]"). The reader is the portable part.
   if (isReadableStreamLike(data)) {
-    return new Response(toDispatchableStream(data)).blob()
+    const reader = data.getReader()
+    const chunks: BlobPart[] = []
+    for (;;) {
+      const { done, value } = await reader.read()
+      if (done) {
+        break
+      }
+      chunks.push(value)
+    }
+    return new Blob(chunks)
   }
   // String or ArrayBuffer - create Blob. A cross-realm ArrayBuffer needs no
   // special handling: buffer sources are recognized by V8, not by brand.
```

**File**: `packages/js-sdk/tests/api/http2.test.ts` (modified, +0/-2)
```diff
@@ -3,8 +3,6 @@ import { afterEach, expect, test, vi } from 'vitest'
 afterEach(() => {
   vi.restoreAllMocks()
   vi.resetModules()
-  vi.doUnmock('undici')
-  vi.doUnmock('../../src/utils')
   delete process.env.E2B_API_CONNECTIONS
   delete process.env.E2B_API_INFLIGHT_REQUESTS
 })
```

**File**: `packages/js-sdk/tests/api/list.test.ts` (modified, +2/-3)
```diff
@@ -1,5 +1,4 @@
 import { assert } from 'vitest'
-import { randomUUID } from 'crypto'
 
 import { Sandbox, SandboxInfo } from '../../src'
 import { sandboxTest, isDebug } from '../setup.js'
@@ -20,7 +19,7 @@ sandboxTest.skipIf(isDebug)(
 )
 
 sandboxTest.skipIf(isDebug)('list sandboxes with filter', async () => {
-  const uniqueId = randomUUID()
+  const uniqueId = crypto.randomUUID()
   const extraSbx = await Sandbox.create({ metadata: { uniqueId } })
 
   try {
@@ -316,7 +315,7 @@ sandboxTest.skipIf(isDebug)(
 )
 
 sandboxTest.skipIf(isDebug)('list sandboxes with filter', async () => {
-  const uniqueId = randomUUID()
+  const uniqueId = crypto.randomUUID()
   const extraSbx = await Sandbox.create({ metadata: { uniqueId } })
 
   try {
```

---

### Incident Patch 15: `804021ee` (2026-09-10)
**Commit Message**: test: skip the deprecated git suites unless ENABLE_GIT_TESTS is set (#1863)

## Summary

The sandbox `git` API is deprecated, so its test suites are now opt-in
behind an `ENABLE_GIT_TESTS` env var — the same pattern the live volume
tests used with `ENABLE_VOLUME_TESTS` (#1526) before they were mocked.
Everything under `packages/js-sdk/tests/sandbox/git/` and
`packages/python-sdk/tests/shared/git/` is skipped by default, including
the offline unit tests (`helpers.test.ts`, `validation.test.ts`,
`test_args.py`, `test_parity.py`).

- **JS** — `tests/setup.ts` gains `isGitTestsEnabled` and a `gitTest =
sandboxTest.skipIf(!isGitTestsEnabled)` fixture; the sandbox-backed git
tests switch from `sandboxTest` to `gitTest`, and the two unit files use
`describe.skipIf` / `test.skipIf` with the same flag.
- **Python** — `tests/shared/git/conftest.py` adds an autouse fixture
that calls `pytest.skip("skipped because ENABLE_GIT_TESTS is not set")`;
autouse fixtures resolve before `git_sandbox`, so no sandbox is created
for skipped tests.

Nothing in CI sets the flag, so the git suites no longer run there. To
run them locally:

```sh
ENABLE_GIT_TESTS=1 pnpm run test              # js-sdk
ENABLE_GI

**File**: `packages/js-sdk/tests/sandbox/git/add.test.ts` (modified, +2/-2)
```diff
@@ -1,9 +1,9 @@
 import { expect } from 'vitest'
 
-import { sandboxTest } from '../../setup.js'
+import { gitTest } from '../../setup.js'
 import { cleanupBaseDir, createBaseDir, createRepo } from './helpers.js'
 
-sandboxTest('git add stages files', async ({ sandbox }) => {
+gitTest('git add stages files', async ({ sandbox }) => {
   const baseDir = await createBaseDir(sandbox)
 
   try {
```

**File**: `packages/js-sdk/tests/sandbox/git/branches.test.ts` (modified, +5/-5)
```diff
@@ -1,13 +1,13 @@
 import { expect } from 'vitest'
 
-import { sandboxTest } from '../../setup.js'
+import { gitTest } from '../../setup.js'
 import {
   cleanupBaseDir,
   createBaseDir,
   createRepoWithCommit,
 } from './helpers.js'
 
-sandboxTest('git branches lists current and feature', async ({ sandbox }) => {
+gitTest('git branches lists current and feature', async ({ sandbox }) => {
   const baseDir = await createBaseDir(sandbox)
 
   try {
@@ -23,7 +23,7 @@ sandboxTest('git branches lists current and feature', async ({ sandbox }) => {
   }
 })
 
-sandboxTest('git checkoutBranch switches branch', async ({ sandbox }) => {
+gitTest('git checkoutBranch switches branch', async ({ sandbox }) => {
   const baseDir = await createBaseDir(sandbox)
 
   try {
@@ -43,7 +43,7 @@ sandboxTest('git checkoutBranch switches branch', async ({ sandbox }) => {
   }
 })
 
-sandboxTest(
+gitTest(
   'git createBranch creates and checks out branch',
   async ({ sandbox }) => {
     const baseDir = await createBaseDir(sandbox)
@@ -61,7 +61,7 @@ sandboxTest(
   }
 )
 
-sandboxTest('git deleteBranch removes branch', async ({ sandbox }) => {
+gitTest('git deleteBranch removes branch', async ({ sandbox }) => {
   const baseDir = await createBaseDir(sandbox)
 
   try {
```

**File**: `packages/js-sdk/tests/sandbox/git/clone.test.ts` (modified, +2/-2)
```diff
@@ -1,14 +1,14 @@
 import { expect } from 'vitest'
 
-import { sandboxTest } from '../../setup.js'
+import { gitTest } from '../../setup.js'
 import {
   cleanupBaseDir,
   createBaseDir,
   createRepoWithCommit,
   startGitDaemon,
 } from './helpers.js'
 
-sandboxTest('git clone fetches repo', async ({ sandbox }) => {
+gitTest('git clone fetches repo', async ({ sandbox }) => {
   const baseDir = await createBaseDir(sandbox)
 
   try {
```

**File**: `packages/js-sdk/tests/sandbox/git/commit.test.ts` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
 import { expect } from 'vitest'
 
-import { sandboxTest } from '../../setup.js'
+import { gitTest } from '../../setup.js'
 import {
   AUTHOR_EMAIL,
   AUTHOR_NAME,
@@ -9,7 +9,7 @@ import {
   createRepo,
 } from './helpers.js'
 
-sandboxTest('git commit creates commit', async ({ sandbox }) => {
+gitTest('git commit creates commit', async ({ sandbox }) => {
   const baseDir = await createBaseDir(sandbox)
 
   try {
@@ -31,7 +31,7 @@ sandboxTest('git commit creates commit', async ({ sandbox }) => {
   }
 })
 
-sandboxTest(
+gitTest(
   'git commit uses config for missing author fields',
   async ({ sandbox }) => {
     const baseDir = await createBaseDir(sandbox)
```

**File**: `packages/js-sdk/tests/sandbox/git/config.test.ts` (modified, +22/-25)
```diff
@@ -1,6 +1,6 @@
 import { expect } from 'vitest'
 
-import { sandboxTest } from '../../setup.js'
+import { gitTest } from '../../setup.js'
 import {
   AUTHOR_EMAIL,
   AUTHOR_NAME,
@@ -9,7 +9,7 @@ import {
   createRepo,
 } from './helpers.js'
 
-sandboxTest('git getConfig reads local config', async ({ sandbox }) => {
+gitTest('git getConfig reads local config', async ({ sandbox }) => {
   const baseDir = await createBaseDir(sandbox)
 
   try {
@@ -34,7 +34,7 @@ sandboxTest('git getConfig reads local config', async ({ sandbox }) => {
   }
 })
 
-sandboxTest('git setConfig updates local config', async ({ sandbox }) => {
+gitTest('git setConfig updates local config', async ({ sandbox }) => {
   const baseDir = await createBaseDir(sandbox)
 
   try {
@@ -61,27 +61,24 @@ sandboxTest('git setConfig updates local config', async ({ sandbox }) => {
   }
 })
 
-sandboxTest(
-  'git configureUser sets global user config',
-  async ({ sandbox }) => {
-    await sandbox.git.configureUser(AUTHOR_NAME, AUTHOR_EMAIL)
+gitTest('git configureUser sets global user config', async ({ sandbox }) => {
+  await sandbox.git.configureUser(AUTHOR_NAME, AUTHOR_EMAIL)
 
-    const name = (
-      await sandbox.commands.run('git config --global --get user.name')
-    ).stdout.trim()
-    const email = (
-      await sandbox.commands.run('git config --global --get user.email')
-    ).stdout.trim()
-    const configuredName = await sandbox.git.getConfig('user.name', {
-      scope: 'global',
-    })
-    const configuredEmail = await sandbox.git.getConfig('user.email', {
-      scope: 'global',
-    })
+  const name = (
+    await sandbox.commands.run('git config --global --get user.name')
+  ).stdout.trim()
+  const email = (
+    await sandbox.commands.run('git config --global --get user.email')
+  ).stdout.trim()
+  const configuredName = await sandbox.git.getConfig('user.name', {
+    scope: 'global',
+  })
+  const configuredEmail = await sandbox.git.getConfig('user.email', {
+    scope: 'global',
+  })
 
-    expect(name).toBe(AUTHOR_NAME)
-    expect(email).toBe(AUTHOR_EMAIL)
-    expect(configuredName).toBe(AUTHOR_NAME)
-    expect(configuredEmail).toBe(AUTHOR_EMAIL)
-  }
-)
+  expect(name).toBe(AUTHOR_NAME)
+  expect(email).toBe(AUTHOR_EMAIL)
+  expect(configuredName).toBe(AUTHOR_NAME)
+  expect(configuredEmail).toBe(AUTHOR_EMAIL)
+})
```

**File**: `packages/js-sdk/tests/sandbox/git/dangerouslyAuthenticate.test.ts` (modified, +2/-2)
```diff
@@ -1,9 +1,9 @@
 import { expect } from 'vitest'
 
-import { sandboxTest } from '../../setup.js'
+import { gitTest } from '../../setup.js'
 import { HOST, PASSWORD, PROTOCOL, USERNAME } from './helpers.js'
 
-sandboxTest('git dangerouslyAuthenticate sets helper', async ({ sandbox }) => {
+gitTest('git dangerouslyAuthenticate sets helper', async ({ sandbox }) => {
   await sandbox.git.dangerouslyAuthenticate({
     username: USERNAME,
     password: PASSWORD,
```

**File**: `packages/js-sdk/tests/sandbox/git/helpers.test.ts` (modified, +2/-1)
```diff
@@ -1,8 +1,9 @@
 import { describe, expect, test, vi } from 'vitest'
 
+import { isGitTestsEnabled } from '../../setup.js'
 import { cleanupBaseDir } from './helpers.js'
 
-describe('cleanupBaseDir', () => {
+describe.skipIf(!isGitTestsEnabled)('cleanupBaseDir', () => {
   test('retries a Cloudflare dropped connection once', async () => {
     const run = vi
       .fn()
```

**File**: `packages/js-sdk/tests/sandbox/git/init.test.ts` (modified, +2/-2)
```diff
@@ -1,9 +1,9 @@
 import { expect } from 'vitest'
 
-import { sandboxTest } from '../../setup.js'
+import { gitTest } from '../../setup.js'
 import { cleanupBaseDir, createBaseDir } from './helpers.js'
 
-sandboxTest('git init', async ({ sandbox }) => {
+gitTest('git init', async ({ sandbox }) => {
   const baseDir = await createBaseDir(sandbox)
 
   try {
```

#### Recent Merged Pull Requests:
- **PR #1946** (2026-10-05): fix(code-interpreter): preserve UTF-8 across response chunks (@devin-ai-integration[bot])
- **PR #1945** (2026-10-05): fix(code-interpreter): preserve UTF-8 across response chunks (@fhgffy)
- **PR #1942** (2026-10-05): chore(deps): scheduled dependency updates for js-sdk / cli / python-sdk (@devin-ai-integration[bot])
- **PR #1941** (2026-10-05): chore(sdk): share sandbox create response mapping and command handle setup (@devin-ai-integration[bot])
- **PR #1940** (closed): fix(sdk): encode sandbox metadata filters once (@DevChiniwala)
- **PR #1937** (2026-10-02): ci(sdk-tests): cancel superseded runs on the same PR (@charlie-e2b)
- **PR #1935** (2026-10-05): fix(sdk): match BuildKit in .dockerignore pattern matching (@devin-ai-integration[bot])
- **PR #1934** (closed): fix(sdk): match literal suffixes after leading dockerignore globstars (@siye566)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
